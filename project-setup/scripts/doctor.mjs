#!/usr/bin/env node
// Review-lane doctor: audits the lane options a launcher will use and the local diagnostics that decide whether a
// Codex worker can start cleanly. It reports configuration and diagnostic evidence only.
//
// Plan: docs/plans/2026-10-20-project-setup-v3-rc1-c10.md section 3.
//
// What it does: runs exactly one `codex mcp list --json` with the validated lane options (no shell, no other Codex
// command), reads the newest permitted sandbox log, and on Windows inventories processes through one fixed CIM query.
// What it never does: start a model session or a sandbox probe, read authentication or sandbox-secret files, follow a
// log link, kill or restart a process, edit configuration or logs, or retry. A ready report therefore establishes that
// the supplied configuration and the available diagnostics passed these checks, not that a later worker runs with the
// same options and not that connector tools are absent or the sandbox enforces anything.
//
// What this gets right that an ad hoc check does not:
//   - The argument grammar is closed. No general -c override, no attached values, no positional command and no shell
//     quoting is interpreted: a value is one argv element, and a rejected token is never echoed.
//   - An unknown or unavailable measurement (no log, an unreadable log, an incomplete process inventory) is reported as
//     unknown and keeps the lane not ready. Nothing substitutes a passing result for a check that could not run.
//   - A disabled MCP server counts only when the caller's own disable override covers it: an incidentally disabled
//     server says nothing about the launcher's coverage.
//   - The first Codex found on PATH is the one examined. An unsupported first candidate stops resolution instead of
//     silently switching to another installation, and a Windows npm shim is never read or executed: its package
//     entrypoint is run with the absolute Node.
//
// main(argv, dependencies) returns { exitCode, stdout, stderr } and never writes a stream, exits or sets
// process.exitCode; only the direct-entry block at the end does. Importing the module only defines it.
//
// Usage: node doctor.mjs --disable apps --disable plugins [-c mcp_servers.<name>.enabled=false ...]
//                        [-p <profile> | --profile <profile>] [-C <directory> | --cd <directory>]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const J = (v) => JSON.stringify(v, null, 2) + '\n';
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ---------------------------------------------------------------- arguments ----
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
const IDENTIFIER = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/;
const OVERRIDE = /^mcp_servers\.([A-Za-z0-9_][A-Za-z0-9_-]{0,63})\.enabled=false$/;
const OPTIONS = new Set(['--disable', '-c', '-p', '--profile', '-C', '--cd']);
const ARG_MESSAGES = {
  DOCTOR_ARGV: 'arguments must be strings',
  DOCTOR_CONTROL: 'control characters are not allowed',
  DOCTOR_VALUE: 'option requires a value',
  DOCTOR_DUPLICATE: 'option may be supplied only once',
  DOCTOR_DISABLE: 'only apps and plugins may be disabled',
  DOCTOR_OVERRIDE: 'only a named MCP disable override is allowed',
  DOCTOR_PROFILE: 'invalid profile identifier',
  DOCTOR_DIRECTORY: 'invalid directory value',
  DOCTOR_OPTION: 'unsupported argument',
};

function argError(code) {
  return Object.assign(new Error(`${code}: ${ARG_MESSAGES[code]}`), { code });
}

// Plan 3.2: nonempty, not option-like, no double quote, not wrapped in literal single quotes, and a drive prefix only
// when followed by a separator (C:repo is drive-relative on Windows, so it is rejected on every platform).
function validDirectory(v) {
  if (v === '' || v.startsWith('-') || v.includes('"')) return false;
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return false;
  if (/^[A-Za-z]:/.test(v) && !/^[A-Za-z]:[\\/]/.test(v)) return false;
  return true;
}

/**
 * Plan 3.2: the exact lane-option grammar. Shape first (DOCTOR_ARGV), then a control scan of every token
 * (DOCTOR_CONTROL), then left to right; for a recognized option: missing value, duplication, then value validity.
 * Returns { disableApps, disablePlugins, servers, profile, directory, argv } with --profile and --cd canonicalized to
 * -p and -C, accepted order kept. The input is never mutated.
 */
export function parseDoctorArgs(argv) {
  if (!Array.isArray(argv)) throw argError('DOCTOR_ARGV');
  for (let i = 0; i < argv.length; i++) if (typeof argv[i] !== 'string') throw argError('DOCTOR_ARGV');
  for (let i = 0; i < argv.length; i++) if (CONTROL.test(argv[i])) throw argError('DOCTOR_CONTROL');
  const out = { disableApps: false, disablePlugins: false, servers: [], profile: null, directory: null, argv: [] };
  let profileSeen = false;
  let directorySeen = false;
  for (let i = 0; i < argv.length; i += 2) {
    const option = argv[i];
    if (!OPTIONS.has(option)) throw argError('DOCTOR_OPTION');
    const value = argv[i + 1];
    if (value === undefined || OPTIONS.has(value)) throw argError('DOCTOR_VALUE');
    if (option === '--disable') {
      if (value !== 'apps' && value !== 'plugins') throw argError('DOCTOR_DISABLE');
      const key = value === 'apps' ? 'disableApps' : 'disablePlugins';
      if (out[key]) throw argError('DOCTOR_DUPLICATE');
      out[key] = true;
      out.argv.push('--disable', value);
    } else if (option === '-c') {
      const m = OVERRIDE.exec(value);
      if (!m) throw argError('DOCTOR_OVERRIDE');
      if (out.servers.includes(m[1])) throw argError('DOCTOR_DUPLICATE');
      out.servers.push(m[1]);
      out.argv.push('-c', value);
    } else if (option === '-p' || option === '--profile') {
      if (profileSeen) throw argError('DOCTOR_DUPLICATE');
      if (!IDENTIFIER.test(value)) throw argError('DOCTOR_PROFILE');
      profileSeen = true;
      out.profile = value;
      out.argv.push('-p', value);
    } else {
      if (directorySeen) throw argError('DOCTOR_DUPLICATE');
      if (!validDirectory(value)) throw argError('DOCTOR_DIRECTORY');
      directorySeen = true;
      out.directory = value;
      out.argv.push('-C', value);
    }
  }
  return out;
}

// ------------------------------------------------------------- dependencies ----
const DEPENDENCY_KEYS = ['context', 'fs', 'execute'];
const CONTEXT_KEYS = ['cwd', 'env', 'home', 'node', 'platform'];
const FS_KEYS = ['lstatSync', 'realpathSync', 'readdirSync', 'readFileSync'];

function optionsError() {
  return Object.assign(new Error('DOCTOR_OPTIONS: invalid doctor dependencies'), { code: 'DOCTOR_OPTIONS' });
}

function readContext(c) {
  if (!isObj(c)) throw optionsError();
  const keys = Object.keys(c).sort();
  if (keys.length !== CONTEXT_KEYS.length || keys.some((k, i) => k !== CONTEXT_KEYS[i])) throw optionsError();
  if (typeof c.platform !== 'string' || c.platform === '') throw optionsError();
  const P = c.platform === 'win32' ? path.win32 : path.posix;
  for (const k of ['cwd', 'home', 'node']) if (typeof c[k] !== 'string' || !P.isAbsolute(c[k])) throw optionsError();
  if (!isObj(c.env) || Object.keys(c.env).some((k) => typeof c.env[k] !== 'string')) throw optionsError();
  return { platform: c.platform, cwd: c.cwd, home: c.home, env: c.env, node: c.node };
}

// Plan 3.3: every seam is optional; defaults are built here, when main runs, never at import time.
function readDependencies(d) {
  const deps = d === undefined ? {} : d;
  if (!isObj(deps)) throw optionsError();
  if (Object.keys(deps).some((k) => !DEPENDENCY_KEYS.includes(k))) throw optionsError();
  const context = own(deps, 'context')
    ? readContext(deps.context)
    : { platform: process.platform, cwd: process.cwd(), home: os.homedir(), env: process.env, node: process.execPath };
  let fsApi;
  if (own(deps, 'fs')) {
    if (!isObj(deps.fs) || FS_KEYS.some((k) => typeof deps.fs[k] !== 'function')) throw optionsError();
    fsApi = deps.fs;
  } else {
    fsApi = {
      lstatSync: (p) => fs.lstatSync(p),
      realpathSync: (p) => fs.realpathSync.native(p),
      readdirSync: (p) => fs.readdirSync(p),
      readFileSync: (p) => fs.readFileSync(p),
    };
  }
  let execute;
  if (own(deps, 'execute')) {
    if (typeof deps.execute !== 'function') throw optionsError();
    execute = deps.execute;
  } else execute = (executable, argv, options) => cp.spawnSync(executable, argv, options);
  return { context, fsApi, execute };
}

// ------------------------------------------------------------- diagnostics ----
const LOG_NAME = /^sandbox\.[A-Za-z0-9._-]+\.log$/;
const SETUP_REFRESH_ERROR = /\bsetup refresh\b.*\berrors?\b|\berror\b.*\bsetup refresh\b/i;
const LOG_LIMIT = 1048576;
const LINE_LIMIT = 1024;
const INVENTORY_COMMAND = '[Console]::OutputEncoding=[Text.Encoding]::UTF8;'
  + 'ConvertTo-Json -InputObject @(Get-CimInstance Win32_Process | '
  + 'Select-Object ProcessId,Name,ExecutablePath) -Compress';

const DETAIL = {
  context: { pass: 'Effective lane options established', fail: 'Effective lane directory and both apps/plugins disable flags are required' },
  entrypoint: { pass: 'Supported Codex entrypoint established', fail: 'Supported Codex entrypoint could not be established', 'not-run': 'Entrypoint check not run' },
  mcp: {
    pass: 'Every listed MCP server is disabled and covered',
    DOCTOR_CLI: 'Codex MCP configuration check failed',
    DOCTOR_OUTPUT: 'Codex MCP configuration output is invalid',
    DOCTOR_ENABLED: 'At least one listed MCP server is enabled',
    DOCTOR_CONFIGURATION: 'Disable coverage for every listed MCP server could not be established',
    'not-run': 'MCP configuration check not run',
  },
  log: {
    pass: 'Newest sandbox log has no setup-refresh error',
    DOCTOR_LOG_ABSENT: 'No sandbox log is available',
    DOCTOR_LOG_UNREADABLE: 'Newest sandbox log could not be read',
    DOCTOR_LOG_ERROR: 'Newest sandbox log contains a setup-refresh error',
  },
  processes: {
    pass: 'No matching Codex Desktop or cua_node process observed',
    DOCTOR_PROCESS_RUNNING: 'Codex Desktop or cua_node processes are running; quit Codex Desktop and retry',
    DOCTOR_PROCESS_UNAVAILABLE: 'Windows process inventory could not be established',
    'not-applicable': 'Windows process inventory is not applicable',
  },
};
const checkRow = (check, status, code, detail) => ({ check, status, code, detail });

// Plan 3.3 and 3.5: an integer status 0, no signal, no error, two string streams and an empty stderr. Anything else,
// including spawnSync's error-plus-signal timeout and an ENOBUFS overflow, is a failed result. Extra keys are ignored.
function processSucceeded(r) {
  if (!isObj(r)) return false;
  if (!Number.isInteger(r.status) || r.status !== 0 || r.signal !== null) return false;
  if (r.error !== undefined && r.error !== null) return false;
  return typeof r.stdout === 'string' && typeof r.stderr === 'string' && r.stderr === '';
}

async function diagnose(options, { context, fsApi, execute }) {
  const win = context.platform === 'win32';
  const P = win ? path.win32 : path.posix;
  const delimiter = win ? ';' : ':';
  // Plan 3.3: case-insensitive, first insertion wins on Windows; the exact key elsewhere.
  const envGet = (name) => {
    if (!win) return own(context.env, name) ? context.env[name] : undefined;
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(context.env)) if (k.toLowerCase() === lower) return v;
    return undefined;
  };
  const execOptions = (timeout) => ({ cwd: context.cwd, env: context.env, shell: false, windowsHide: true, encoding: 'utf8', timeout, maxBuffer: 1048576 });
  // One call, never retried. A throw, a rejected promise and a failed result are one outcome (null); nothing about
  // them, the child's streams included, is reported.
  const call = async (executable, argv, timeout) => {
    try {
      const r = await execute(executable, argv, execOptions(timeout));
      return processSucceeded(r) ? r.stdout : null;
    } catch {
      return null;
    }
  };

  // ---- context (plan 3.4) ----
  const effective = options.directory === null ? P.resolve(context.cwd) : P.resolve(context.cwd, options.directory);
  let directoryValid = false;
  try { directoryValid = fsApi.lstatSync(fsApi.realpathSync(effective)).isDirectory(); } catch { directoryValid = false; }
  const contextPass = directoryValid && options.disableApps && options.disablePlugins;
  const checks = [];
  checks.push(contextPass
    ? checkRow('context', 'pass', null, DETAIL.context.pass)
    : checkRow('context', 'fail', 'DOCTOR_CONFIGURATION', DETAIL.context.fail));

  // ---- entrypoint (plan 3.4): the first discovered PATH candidate decides ----
  const O = [...options.argv, 'mcp', 'list', '--json'];
  const establish = (candidate, name) => {
    try {
      const real = fsApi.realpathSync(candidate);
      if (typeof real !== 'string' || !P.isAbsolute(real)) return null;
      const st = fsApi.lstatSync(real);
      if (!st.isFile()) return null;
      if (name === 'codex.cmd') {
        // The standard npm shim layout; the shim body is never read, parsed or executed.
        const entry = fsApi.realpathSync(P.join(P.dirname(real), 'node_modules', '@openai', 'codex', 'bin', 'codex.js'));
        if (typeof entry !== 'string' || !P.isAbsolute(entry) || !fsApi.lstatSync(entry).isFile()) return null;
        return { executable: context.node, argv: [entry, ...O] };
      }
      if (!win && (st.mode & 0o111) === 0) return null;
      return { executable: real, argv: O };
    } catch {
      return null;
    }
  };
  const resolveEntrypoint = () => {
    const value = envGet('PATH');
    if (typeof value !== 'string') return null;
    const names = win ? ['codex.exe', 'codex.cmd'] : ['codex'];
    for (const dir of value.split(delimiter)) {
      if (dir === '' || !P.isAbsolute(dir)) continue;
      for (const name of names) {
        const candidate = P.join(dir, name);
        try { fsApi.lstatSync(candidate); } catch (e) {
          if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) continue;
          return null;
        }
        return establish(candidate, name);
      }
    }
    return null;
  };

  let servers = [];
  if (!contextPass) {
    checks.push(checkRow('entrypoint', 'not-run', null, DETAIL.entrypoint['not-run']));
    checks.push(checkRow('mcp', 'not-run', null, DETAIL.mcp['not-run']));
  } else {
    const entry = resolveEntrypoint();
    if (entry === null) {
      checks.push(checkRow('entrypoint', 'fail', 'DOCTOR_ENTRYPOINT', DETAIL.entrypoint.fail));
      checks.push(checkRow('mcp', 'not-run', null, DETAIL.mcp['not-run']));
    } else {
      checks.push(checkRow('entrypoint', 'pass', null, DETAIL.entrypoint.pass));
      // ---- MCP configuration (plan 3.5) ----
      const stdout = await call(entry.executable, entry.argv, 10000);
      let code = null;
      if (stdout === null) code = 'DOCTOR_CLI';
      else {
        let list = null;
        try { list = JSON.parse(stdout); } catch { list = null; }
        const names = new Set();
        const valid = Array.isArray(list) && list.every((item) => {
          if (!isObj(item) || typeof item.name !== 'string' || !IDENTIFIER.test(item.name) || typeof item.enabled !== 'boolean') return false;
          if (names.has(item.name)) return false;
          names.add(item.name);
          return true;
        });
        if (!valid) code = 'DOCTOR_OUTPUT';
        else {
          servers = list.map((item) => ({ name: item.name, enabled: item.enabled, covered: options.servers.includes(item.name) }));
          if (servers.some((s) => s.enabled)) code = 'DOCTOR_ENABLED';
          else if (servers.some((s) => !s.covered)) code = 'DOCTOR_CONFIGURATION';
        }
      }
      checks.push(code === null ? checkRow('mcp', 'pass', null, DETAIL.mcp.pass) : checkRow('mcp', 'fail', code, DETAIL.mcp[code]));
    }
  }

  // ---- sandbox log (plan 3.6): the newest permitted log only, never a fallback ----
  const log = (() => {
    const unreadable = (file = null, mtime = null) => ({ code: 'DOCTOR_LOG_UNREADABLE', file, mtime, firstError: null });
    const home = envGet('CODEX_HOME');
    let base;
    if (typeof home === 'string' && home !== '') {
      if (!P.isAbsolute(home)) return unreadable();
      base = home;
    } else base = P.join(context.home, '.codex');
    const dir = P.join(base, '.sandbox');
    let st;
    try { st = fsApi.lstatSync(dir); } catch (e) {
      return e && (e.code === 'ENOENT' || e.code === 'ENOTDIR') ? { code: 'DOCTOR_LOG_ABSENT', file: null, mtime: null, firstError: null } : unreadable();
    }
    if (st.isSymbolicLink() || !st.isDirectory()) return unreadable();
    let names;
    try { names = fsApi.readdirSync(dir); } catch { return unreadable(); }
    if (!Array.isArray(names)) return unreadable();
    const candidates = [];
    for (const name of names) {
      if (typeof name !== 'string' || !LOG_NAME.test(name)) continue;
      let s;
      try { s = fsApi.lstatSync(P.join(dir, name)); } catch { return unreadable(); }
      const m = s.mtimeMs;
      if (typeof m !== 'number' || !Number.isFinite(m) || Number.isNaN(new Date(m).getTime())) return unreadable();
      candidates.push({ name, s, m });
    }
    if (!candidates.length) return { code: 'DOCTOR_LOG_ABSENT', file: null, mtime: null, firstError: null };
    candidates.sort((a, b) => (b.m - a.m) || (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
    const best = candidates[0];
    const file = best.name;
    const mtime = new Date(best.m).toISOString();
    if (best.s.isSymbolicLink() || !best.s.isFile() || !(best.s.size <= LOG_LIMIT)) return unreadable(file, mtime);
    let text;
    try {
      const body = fsApi.readFileSync(P.join(dir, file));
      if (Buffer.isBuffer(body)) {
        if (body.length > LOG_LIMIT) return unreadable(file, mtime);
        text = body.toString('utf8');
      } else if (typeof body === 'string') text = body;
      else return unreadable(file, mtime);
    } catch {
      return unreadable(file, mtime);
    }
    const line = text.split(/\r\n|\n|\r/).find((l) => SETUP_REFRESH_ERROR.test(l));
    if (line === undefined) return { code: null, file, mtime, firstError: null };
    return { code: 'DOCTOR_LOG_ERROR', file, mtime, firstError: line.length <= LINE_LIMIT ? line : `${line.slice(0, LINE_LIMIT)} [truncated]` };
  })();
  if (log.code === null) checks.push(checkRow('sandbox-log', 'pass', null, DETAIL.log.pass));
  else checks.push(checkRow('sandbox-log', log.code === 'DOCTOR_LOG_ERROR' ? 'fail' : 'unknown', log.code, DETAIL.log[log.code]));

  // ---- Windows process inventory (plan 3.7) ----
  let processes = [];
  if (!win) checks.push(checkRow('processes', 'not-applicable', null, DETAIL.processes['not-applicable']));
  else {
    const inventory = await (async () => {
      const root = envGet('SystemRoot');
      if (typeof root !== 'string' || root === '' || !P.isAbsolute(root)) return null;
      const stdout = await call(P.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', INVENTORY_COMMAND], 15000);
      if (stdout === null) return null;
      let list = null;
      try { list = JSON.parse(stdout); } catch { return null; }
      if (!Array.isArray(list)) return null;
      const records = [];
      for (const r of list) {
        if (!isObj(r) || !Number.isInteger(r.ProcessId) || r.ProcessId <= 0 || typeof r.Name !== 'string' || r.Name === '') return null;
        if (r.ExecutablePath !== null && (typeof r.ExecutablePath !== 'string' || !P.isAbsolute(r.ExecutablePath))) return null;
        records.push({ pid: r.ProcessId, name: r.Name, exe: r.ExecutablePath });
      }
      // A relevant process whose path is hidden from this query cannot be classified; it is not assumed harmless.
      if (records.some((r) => r.exe === null && /codex|cua_node/i.test(r.name))) return null;
      const matches = [];
      for (const r of records) {
        if (r.exe === null) continue;
        const p = r.exe.replace(/\\/g, '/').toLowerCase();
        const pkg = /(?:^|\/)windowsapps\/([^/]+)\//.exec(p);
        const kind = p.includes('/runtimes/cua_node/') ? 'cua-node' : pkg && pkg[1].includes('codex') ? 'desktop' : null;
        if (kind) matches.push({ pid: r.pid, name: r.name, kind });
      }
      return matches.sort((a, b) => (a.pid - b.pid) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    })();
    if (inventory === null) checks.push(checkRow('processes', 'unknown', 'DOCTOR_PROCESS_UNAVAILABLE', DETAIL.processes.DOCTOR_PROCESS_UNAVAILABLE));
    else if (inventory.length) {
      processes = inventory;
      checks.push(checkRow('processes', 'fail', 'DOCTOR_PROCESS_RUNNING', DETAIL.processes.DOCTOR_PROCESS_RUNNING));
    } else checks.push(checkRow('processes', 'pass', null, DETAIL.processes.pass));
  }

  const ready = checks.every((c) => c.status === 'pass' || c.status === 'not-applicable');
  return {
    ok: ready,
    ready,
    scope: 'configuration-and-diagnostics',
    context: { directory: directoryValid ? effective : null, profile: options.profile },
    checks,
    servers,
    sandboxLog: { file: log.file, mtime: log.mtime, firstError: log.firstError },
    processes,
    runtimeEvidence: { connectorTools: 'not-verified', sandbox: 'not-verified' },
  };
}

/**
 * The doctor as a function (plan 2.4 and 3.1). A syntactically invalid argv resolves exit 2 with
 * { ok:false, code, error } before any default is built or any filesystem or executor is used; invalid dependencies
 * reject with DOCTOR_OPTIONS; otherwise the complete report with exit 0 when ready and 1 when not. stderr is empty.
 */
export async function main(argv, dependencies) {
  let options;
  try { options = parseDoctorArgs(argv); } catch (e) {
    if (e instanceof Error && own(e, 'code') && own(ARG_MESSAGES, e.code)) return { exitCode: 2, stdout: J({ ok: false, code: e.code, error: e.message }), stderr: '' };
    throw e;
  }
  const report = await diagnose(options, readDependencies(dependencies));
  return { exitCode: report.ready ? 0 : 1, stdout: J(report), stderr: '' };
}

// ---------------------------------------------------------------- CLI ----
// The entry check compares resolved paths and, failing that, native real paths, so a launch through a junction
// (tested) or, through realpath, an 8.3 short name (untested) still runs the CLI (an alternate launch path that
// missed it would print nothing).
function isEntryPoint() {
  if (!process.argv[1]) return false;
  const self = fileURLToPath(import.meta.url);
  const fold = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  if (fold(path.resolve(process.argv[1])) === fold(path.resolve(self))) return true;
  try { return fold(fs.realpathSync.native(process.argv[1])) === fold(fs.realpathSync.native(self)); } catch { return false; }
}

if (isEntryPoint()) {
  main(process.argv.slice(2)).then((r) => {
    process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    process.exitCode = r.exitCode;
  }, () => {
    process.stderr.write('doctor.mjs: internal error\n');
    process.exitCode = 1;
  });
}
