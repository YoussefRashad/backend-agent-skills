#!/usr/bin/env node
// Shipped-agent baseline checker (C8): verifies the six v2.0.0 agent and wrapper snapshots this skill copy ships under
// data/v2.0.0/assets/ before an agent compares installed v2 agents or wrappers against them.
//
// Plan: docs/plans/2026-10-19-project-setup-v3-rc1-c8.md section 3.7 (decision PQ8-1: six embedded raw SHA256 pins).
//
// What this gets right that a "read the snapshot and compare" step does not:
//   - The pins are embedded here, not supplied by a caller and not taken from installer metadata (.installed.json):
//     a missing, unreadable or altered snapshot stops the migration instead of becoming the new baseline.
//   - Bytes are hashed raw. No EOL, BOM or whitespace normalization, so a CRLF conversion or a removed final LF is an
//     altered snapshot, not an equal one.
//   - Every path component below the canonical skill root is checked with lstat: a symlink or junction anywhere in the
//     chain, a non-directory component or a nonregular leaf is refused. The root itself may be an alias (it is
//     canonicalized once with the native realpath); ancestors above it are never inspected.
//   - Errors name the affected table path only, never a native absolute path, an exception message or file content.
//
// Residual: the lstat checks and the read are separate calls, so a concurrent swap is detected only as far as the
// opened file's identity (fstat device and inode) still matching the checked leaf. This checker covers its own six
// snapshot paths; it does not make arbitrary agent file reads atomic or no-follow.
//
// distribution-only setup code: it is not installed under .ai/tools, reads no project file, policy, manifest, Git
// metadata or installer metadata, spawns nothing and writes nothing. Importing the module only defines it; the CLI runs
// only when the file is the entry point.
//
// Usage: node check-agent-baselines.mjs   (no arguments)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASELINE = 'v2.0.0';

// Plan 3.7: the pin table, in table order. Paths are skill-relative POSIX paths.
export const AGENT_BASELINES = Object.freeze([
  ['data/v2.0.0/assets/agents/reviewer.md', '06dd68ac2019369f03e66fc3729a9522286487e643b319a1cd52695d2d35b12d'],
  ['data/v2.0.0/assets/agents/docs-sync.md', '217562b10ee8d43f47d085307172921f8789b7e8373056f9475e9642bf448571'],
  ['data/v2.0.0/assets/wrappers/claude-reviewer.md', '284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423'],
  ['data/v2.0.0/assets/wrappers/claude-docs-sync.md', '36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43'],
  ['data/v2.0.0/assets/wrappers/codex-reviewer.toml', '017b9c905f5cc033552ce981340ab04fd794bd8615f8745fe9c1f3048a52bddf'],
  ['data/v2.0.0/assets/wrappers/codex-docs_sync.toml', 'd860e92f20147e70ec61f7fbaaa79d18b385bd7bc8ac247f1f43d2d179f873f0'],
].map(([p, sha256]) => Object.freeze({ path: p, sha256 })));

// Plan 3.7: the error table. The message prefix follows C3's "<CODE>: <detail>" convention, except usage.
const EXIT = { AGENT_BASELINE_INPUT: 3, AGENT_BASELINE_IO: 2, AGENT_BASELINE_INVALID: 3, AGENT_BASELINE_USAGE: 1 };
const MESSAGE = {
  AGENT_BASELINE_INPUT: () => 'AGENT_BASELINE_INPUT: options must contain only an absolute skillRoot string',
  AGENT_BASELINE_IO: (t) => `AGENT_BASELINE_IO: cannot read ${BASELINE} baseline: ${t}`,
  AGENT_BASELINE_INVALID: (t) => `AGENT_BASELINE_INVALID: cannot verify ${BASELINE} baseline: ${t}; stop migration`,
  AGENT_BASELINE_USAGE: () => 'usage: check-agent-baselines.mjs',
};

class AgentBaselineError extends Error {
  constructor(code, target) {
    super(MESSAGE[code](target));
    this.name = 'AgentBaselineError';
    this.code = code;
    this.target = target;
  }
}
const fail = (code, target = null) => { throw new AgentBaselineError(code, target); };

const J = (value) => JSON.stringify(value, null, 2) + '\n';
const isPlainObject = (v) => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

// Plan 3.7: exactly the own key skillRoot (a data property), an absolute nonempty string without NUL, on an object whose
// prototype is Object.prototype or null. Checked before any filesystem access.
function validRoot(options) {
  if (!isPlainObject(options)) return null;
  const keys = Reflect.ownKeys(options);
  if (keys.length !== 1 || keys[0] !== 'skillRoot') return null;
  const desc = Object.getOwnPropertyDescriptor(options, 'skillRoot');
  if (!desc || !('value' in desc)) return null;
  const root = desc.value;
  if (typeof root !== 'string' || root === '' || root.includes('\0') || !path.isAbsolute(root)) return null;
  return root;
}

function checkPin(canonicalRoot, pin) {
  const segments = pin.path.split('/');
  let current = canonicalRoot;
  let leafStat = null;
  for (let i = 0; i < segments.length; i++) {
    current = path.join(current, segments[i]);
    let st;
    try { st = fs.lstatSync(current); } catch { fail('AGENT_BASELINE_IO', pin.path); }
    if (st.isSymbolicLink()) fail('AGENT_BASELINE_INVALID', pin.path);
    if (i < segments.length - 1) {
      if (!st.isDirectory()) fail('AGENT_BASELINE_INVALID', pin.path);
    } else {
      if (!st.isFile()) fail('AGENT_BASELINE_INVALID', pin.path);
      leafStat = st;
    }
  }
  let fd;
  try { fd = fs.openSync(current, 'r'); } catch { fail('AGENT_BASELINE_IO', pin.path); }
  let bytes;
  try {
    let opened;
    try { opened = fs.fstatSync(fd); } catch { fail('AGENT_BASELINE_IO', pin.path); }
    // The opened file must still be the regular file the lstat chain checked.
    if (!opened.isFile() || opened.dev !== leafStat.dev || opened.ino !== leafStat.ino) fail('AGENT_BASELINE_INVALID', pin.path);
    try { bytes = fs.readFileSync(fd); } catch { fail('AGENT_BASELINE_IO', pin.path); }
  } finally {
    try { fs.closeSync(fd); } catch { /* the descriptor is released with the process */ }
  }
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== pin.sha256) fail('AGENT_BASELINE_INVALID', pin.path);
}

// Plan 3.7: synchronous; verifies the six pins in table order and stops at the first failure. Returns fresh data.
export function verifyAgentBaselines(options) {
  const root = validRoot(options);
  if (root === null) fail('AGENT_BASELINE_INPUT');
  let canonicalRoot;
  let rootStat;
  try {
    canonicalRoot = fs.realpathSync.native(root);
    rootStat = fs.statSync(canonicalRoot);
  } catch { fail('AGENT_BASELINE_IO', '.'); }
  if (!rootStat.isDirectory()) fail('AGENT_BASELINE_INVALID', '.');
  for (const pin of AGENT_BASELINES) checkPin(canonicalRoot, pin);
  return { ok: true, baseline: BASELINE, files: AGENT_BASELINES.map(({ path: p }) => p) };
}

const failureResult = (e) => ({ exitCode: EXIT[e.code], stdout: J({ ok: false, code: e.code, error: e.message, target: e.target }), stderr: '' });

// Plan 3.7: synchronous, writes no stream and never exits. argv must be an empty array; any other argv is the usage
// result before dependency or filesystem access. Dependencies are {} (the default root: the directory above this
// module's scripts/ directory) or exactly { skillRoot }, validated like the verifier's options.
export function main(argv, dependencies = {}) {
  if (!Array.isArray(argv) || argv.length !== 0) return failureResult(new AgentBaselineError('AGENT_BASELINE_USAGE', null));
  try {
    let options;
    if (isPlainObject(dependencies) && Reflect.ownKeys(dependencies).length === 0) {
      options = { skillRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') };
    } else options = dependencies;
    return { exitCode: 0, stdout: J(verifyAgentBaselines(options)), stderr: '' };
  } catch (e) {
    if (e instanceof AgentBaselineError) return failureResult(e);
    throw e;
  }
}

const norm = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
if (Boolean(process.argv[1]) && norm(process.argv[1]) === norm(fileURLToPath(import.meta.url))) {
  const r = main(process.argv.slice(2));
  process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  process.exitCode = r.exitCode;
}
