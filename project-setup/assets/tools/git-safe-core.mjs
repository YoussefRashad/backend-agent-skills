// git-safe core: read-only Git object commands with secret paths omitted or refused, shell-free and bounded. Installed
// as .ai/tools/git-safe-core.mjs beside security-policy.mjs, review-diff.mjs (C5) and the thin git-safe.mjs CLI: one
// reviewed catalog unit.
//
// Plan: docs/plans/2026-10-18-project-setup-v3-rc1-c4.md sections 2.5 and 3, with the freeze addendum C4-P3-1..7.
//
// What this gets right that the v2 reader did not:
//   - One explicit grammar per subcommand (C4-PQ1). v2 passed unknown options and pathspecs through, so every Git
//     option was a potential bypass. Here Git sees only vectors this file builds from parsed values.
//   - Revisions resolve to commit IDs first and only IDs reach later commands: an object form (HEAD:.env, a blob ID)
//     never selects content, and a ref that moves mid-command changes nothing.
//   - Protection is C1's matcher over NUL-framed inventories (case-insensitive, Windows aliases); lookup keeps the exact
//     case. Selectors and exclusions are literal pathspecs, so `*`, `:` or a leading dash in a name is just a name.
//   - The complete result is bounded (1 MiB) before anything is emitted: a refusal never follows a partial patch.
//   - Settings that run programs (external diff, textconv, fsmonitor, pager) or change output modes are overridden per
//     call and environment-injected configuration is removed; the user's config files (safe.directory) stay usable.
//
// Importing the module defines it and nothing else: no process, file read, output or environment change.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { matchesPolicyPath, parseSecurityPolicy, validateRepoPath } from './security-policy.mjs';

export const MAX_OUTPUT_BYTES = 1048576;
export const MAX_GIT_ARG_UNITS = 24000;
const MAX_COUNT = 2147483647;
const COMMANDS = ['diff', 'log', 'show', 'cat', 'ls', 'grep'];

// Plan 3.2 and 3.9: exact strings.
export const SUPPORTED_FORMS = Object.freeze({
  diff: 'diff <A>..<B>|<A>...<B> [--stat|--name-status|--name-only] [-- <paths>]',
  log: 'log [-p] [--oneline] [-n<k>|--max-count=<k>] <rev>|<A>..<B>|<A>...<B> [-- <paths>]',
  show: 'show <commit> [--stat|--name-status] [-- <paths>]',
  cat: 'cat <commit> -- <path>',
  ls: 'ls <commit> [-- <paths>]',
  grep: 'grep <commit> <pattern> [-- <paths>]',
});
export const NARROWING_GUIDANCE = Object.freeze({
  diff: 'Narrow with -- <paths> or a smaller commit range.',
  log: 'Narrow with -- <paths>, attached -n<k>, or a smaller commit range.',
  show: 'Narrow with -- <paths>.',
  cat: 'Use grep with a more selective pattern or select a smaller file.',
  ls: 'Narrow with -- <paths>.',
  grep: 'Narrow with -- <paths> or a more selective pattern.',
});

// ---------------------------------------------------------------- errors ----
// Plan 3.9: an own string code and a message starting with "CODE: ". No revision, path, pattern, policy text, native
// exception or Git output is ever interpolated.
const DETAIL = {
  GIT_SAFE_INPUT: 'invalid Git helper input',
  GIT_SAFE_COMMAND: 'supported commands: diff, log, show, cat, ls, grep, review-diff', // C5 plan 2.7 adds review-diff
  GIT_SAFE_VERSION: 'Git 2.31 or later is required',
  GIT_SAFE_REPOSITORY: 'not inside a Git repository',
  GIT_SAFE_POLICY_IO: 'cannot read .ai/security-paths.json; refusing to run without a valid policy',
  GIT_SAFE_SECRET: 'requested path is protected by the security policy',
  GIT_SAFE_REVISION: 'revision does not resolve to a commit',
  GIT_SAFE_RECORD: 'invalid Git metadata; no result was emitted',
  GIT_SAFE_GIT: 'Git operation failed; no result was emitted',
  GIT_SAFE_INTERNAL: 'internal failure; no result was emitted',
  GIT_SAFE_ARG_LIMIT: 'Git arguments exceed the safe invocation bound; narrow with -- <paths> or a smaller commit range. No result was emitted.',
};
const OWN_ERRORS = new WeakSet();
function gsError(code, message = `${code}: ${DETAIL[code]}`) {
  const e = new Error(message);
  e.code = code;
  OWN_ERRORS.add(e);
  return e;
}
const inputError = () => gsError('GIT_SAFE_INPUT');
const argError = (cmd) => gsError('GIT_SAFE_ARGUMENT', `GIT_SAFE_ARGUMENT: unsupported arguments; supported: ${SUPPORTED_FORMS[cmd]}`);
// The low-level bound (session.git) has no guidance; executeGitSafe adds the command's (plan 3.9).
const limitError = (cmd) => gsError('GIT_SAFE_LIMIT', `GIT_SAFE_LIMIT: output exceeds ${MAX_OUTPUT_BYTES} bytes${cmd
  ? `. ${NARROWING_GUIDANCE[cmd]} No partial result was emitted; this review is not complete.` : ''}`);
// C1's code for policy bytes that are not UTF-8 (plan 3.3), built here because C1 only ever sees decoded text.
function policyJsonError() {
  const e = new Error('POLICY_JSON: policy text must be valid JSON');
  e.code = 'POLICY_JSON';
  return e;
}

// --------------------------------------------------------------- helpers ----
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
// A dense array of primitive strings: a hole, a String object or any other element type fails.
function denseStrings(a) {
  if (!Array.isArray(a)) return false;
  for (let i = 0; i < a.length; i++) if (!own(a, i) || typeof a[i] !== 'string') return false;
  return true;
}
function define(target, key, value) {
  Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
}
function deepFreeze(v) {
  if (v !== null && typeof v === 'object') { Object.values(v).forEach(deepFreeze); Object.freeze(v); }
  return v;
}
// Strict UTF-8; the BOM is kept so C1 applies its own BOM rule to policy text.
const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const utf8 = (buf) => { try { return UTF8.decode(buf); } catch { return null; } };
const validPath = (p) => { try { validateRepoPath(p); return true; } catch { return false; } };
// UTF-8 byte order, not UTF-16 code units or locale.
const byUtf8 = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
const EMPTY = () => Buffer.alloc(0);
const OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const OID_LINE = /^([0-9a-f]{40}|[0-9a-f]{64})\r?\n$/;

// ----------------------------------------------------------- environment ----
// Plan 3.4: removal is case-insensitive by name; the user's GIT_CONFIG_GLOBAL/SYSTEM/NOSYSTEM are kept on purpose.
const ENV_REMOVE = new Set([
  'GIT_CONFIG', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT', 'GIT_EXTERNAL_DIFF', 'GIT_DIFF_OPTS', 'GIT_PAGER', 'GIT_DIR',
  'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_NAMESPACE', 'GIT_PREFIX', 'GIT_ATTR_SOURCE', 'GIT_REPLACE_REF_BASE', 'GIT_NO_REPLACE_OBJECTS', 'GIT_TERMINAL_PROMPT',
  'GIT_OPTIONAL_LOCKS', 'GIT_LITERAL_PATHSPECS', 'GIT_GLOB_PATHSPECS', 'GIT_NOGLOB_PATHSPECS', 'GIT_ICASE_PATHSPECS', 'PAGER',
]);
const ENV_NUMBERED = /^GIT_CONFIG_(?:KEY|VALUE)_[0-9]+$/;
const ENV_SET = { GIT_PAGER: 'cat', PAGER: 'cat', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1' };

/** Plan 2.5 and 3.4: a new ordinary object; the input is never mutated and the platform plays no part. */
export function sanitizeGitEnvironment(input) {
  if (!isPlain(input)) throw inputError();
  const out = {};
  for (const k of Object.keys(input)) {
    const v = input[k];
    if (typeof v !== 'string') throw inputError();
    const u = k.toUpperCase();
    if (!ENV_REMOVE.has(u) && !ENV_NUMBERED.test(u)) define(out, k, v);
  }
  for (const [k, v] of Object.entries(ENV_SET)) define(out, k, v);
  return out;
}

// ---------------------------------------------------------------- grammar ----
// Plan 3.2: base [A-Za-z0-9_][A-Za-z0-9_./-]* then ~ ^ ~N ^N suffixes (canonical N). The base never holds `..`, a
// trailing `/` or an empty component; `:`, `@`, braces, whitespace, NUL, backslash and a leading `-` or `^` all fail.
const SINGLE = /^[A-Za-z0-9_][A-Za-z0-9_./-]*(?:[~^](?:0|[1-9][0-9]*)?)*$/;
function isSingle(s) {
  if (typeof s !== 'string' || !SINGLE.test(s)) return false;
  const base = /^[^~^]*/.exec(s)[0];
  return !base.includes('..') && !base.endsWith('/') && !base.includes('//');
}
// A range splits at the first `..`; a following `.` makes it `...`. Both endpoints must be single revisions, so
// `a....b`, `A..`, `..B` and `A..B..C` fail. kind: range (diff), any (log), single (show, cat, ls, grep).
const KIND = { diff: 'range', log: 'any', show: 'single', cat: 'single', ls: 'single', grep: 'single' };
function revisionShape(s, kind) {
  if (typeof s !== 'string') return null;
  const i = s.indexOf('..');
  if (i < 0) return kind !== 'range' && isSingle(s) ? { endpoints: [s], op: null } : null;
  const op = s[i + 2] === '.' ? '...' : '..';
  const left = s.slice(0, i);
  const right = s.slice(i + op.length);
  return kind !== 'single' && isSingle(left) && isSingle(right) ? { endpoints: [left, right], op } : null;
}

const DEFAULT_FORMAT = { diff: 'patch', log: 'medium', show: 'patch', cat: null, ls: 'name-only', grep: null };
const FORMATS = { diff: ['patch', 'stat', 'name-status', 'name-only'], log: ['medium', 'oneline'], show: ['patch', 'stat', 'name-status'], cat: [null], ls: ['name-only'], grep: [null] };
const SUMMARY = { diff: { '--stat': 'stat', '--name-status': 'name-status', '--name-only': 'name-only' }, show: { '--stat': 'stat', '--name-status': 'name-status' } };
const countOf = (v) => (/^(?:0|[1-9][0-9]{0,9})$/.test(v) && Number(v) <= MAX_COUNT ? Number(v) : null);
// Selectors pass C1 path validation unchanged and are deduplicated in first-occurrence order.
function selectors(list, bad) {
  const seen = new Set();
  for (const p of list) { if (!validPath(p)) throw bad(); seen.add(p); }
  return [...seen];
}

/**
 * Plan 2.5 and 3.2: { subcommand, revisions, paths, format, patch, maxCount, pattern }. Each diff/log/show option at
 * most once, anywhere before the separator; summary formats and count spellings exclusive; detached values refused.
 * cat, ls and grep take fixed positions; grep's pattern is always the token after the commit, even `--`.
 */
export function parseGitSafeArgs(argv) {
  if (!denseStrings(argv)) throw inputError();
  const sub = argv[0];
  if (!COMMANDS.includes(sub)) throw gsError('GIT_SAFE_COMMAND');
  const bad = () => argError(sub);
  const rest = argv.slice(1);
  const out = { subcommand: sub, revisions: null, paths: [], format: DEFAULT_FORMAT[sub], patch: sub === 'diff' || sub === 'show', maxCount: null, pattern: null };
  const positional = [];
  if (KIND[sub] === 'single' && sub !== 'show') {
    const fixed = sub === 'grep' ? 2 : 1;
    if (rest.length < fixed) throw bad();
    positional.push(rest[0]);
    if (sub === 'grep') { if (rest[1].includes('\u0000')) throw bad(); out.pattern = rest[1]; }
    const tail = rest.slice(fixed);
    if (sub === 'cat' ? tail.length !== 2 || tail[0] !== '--' : tail.length !== 0 && (tail[0] !== '--' || tail.length < 2)) throw bad();
    out.paths = selectors(tail.slice(1), bad);
  } else {
    const sep = rest.indexOf('--');
    if (sep >= 0) {
      if (sep === rest.length - 1) throw bad(); // a separator must be followed by at least one path
      out.paths = selectors(rest.slice(sep + 1), bad);
    }
    let summary = null; let p = false; let oneline = false; let n = null;
    for (const a of sep < 0 ? rest : rest.slice(0, sep)) {
      if (!a.startsWith('-')) positional.push(a);
      else if (SUMMARY[sub] && own(SUMMARY[sub], a) && summary === null) summary = SUMMARY[sub][a];
      else if (sub === 'log' && a === '-p' && !p) p = true;
      else if (sub === 'log' && a === '--oneline' && !oneline) oneline = true;
      else if (sub === 'log' && n === null && (a.startsWith('-n') || a.startsWith('--max-count='))) {
        n = countOf(a.startsWith('-n') ? a.slice(2) : a.slice('--max-count='.length));
        if (n === null) throw bad();
      } else throw bad();
    }
    if (sub === 'log') Object.assign(out, { format: oneline ? 'oneline' : 'medium', patch: p, maxCount: n });
    else if (summary !== null) Object.assign(out, { format: summary, patch: false });
  }
  if (positional.length !== 1 || revisionShape(positional[0], KIND[sub]) === null) throw bad();
  out.revisions = [positional[0]];
  return out;
}

// A hand-built request is revalidated completely (plan 2.5): exact keys, field combinations, grammar, paths, duplicates.
const REQUEST_KEYS = ['subcommand', 'revisions', 'paths', 'format', 'patch', 'maxCount', 'pattern'].sort().join('\u0000');
function validRequest(r) {
  if (!isPlain(r) || Object.keys(r).sort().join('\u0000') !== REQUEST_KEYS) return false;
  const { subcommand: sub, revisions, paths, format, patch, maxCount, pattern } = r;
  if (!COMMANDS.includes(sub) || !denseStrings(revisions) || revisions.length !== 1 || revisionShape(revisions[0], KIND[sub]) === null) return false;
  if (!denseStrings(paths) || new Set(paths).size !== paths.length || !paths.every(validPath) || (sub === 'cat' && paths.length !== 1)) return false;
  if (!FORMATS[sub].includes(format) || typeof patch !== 'boolean') return false;
  if (sub === 'diff' || sub === 'show' ? patch !== (format === 'patch') : sub !== 'log' && patch) return false;
  if (maxCount !== null && !(sub === 'log' && Number.isInteger(maxCount) && maxCount >= 0 && maxCount <= MAX_COUNT)) return false;
  return sub === 'grep' ? typeof pattern === 'string' && !pattern.includes('\u0000') : pattern === null;
}

// --------------------------------------------------------------- executor ----
// Plan 3.4: the fixed prefix P of every call. diff.orderFile names the null device of the platform snapshot.
function prefixFor(nullDevice) {
  const c = ['core.fsmonitor=false', 'core.quotePath=true', 'submodule.recurse=false', 'log.showSignature=false', 'log.showNotes=false',
    'log.follow=false', 'log.mailmap=false', 'log.diffMerges=off', 'diff.renames=false', 'diff.submodule=short', 'diff.relative=false',
    'diff.noprefix=false', 'diff.mnemonicPrefix=false', 'diff.context=3', 'diff.interHunkContext=0', 'diff.algorithm=myers',
    'diff.indentHeuristic=false', 'diff.suppressBlankEmpty=false', `diff.orderFile=${nullDevice}`, 'color.ui=false'];
  return ['--no-pager', ...c.flatMap((kv) => ['-c', kv])];
}

/**
 * Plan 2.5 and 3.8: the production executor. Always `git`, no shell, hidden window, stdin closed. Output is buffered,
 * never streamed; a bounded call that sees byte limit+1 stops the child and reports overflow without the bytes. Git
 * stderr is drained and dropped.
 */
function executeGit({ argv, cwd, env, limit }) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; resolve(r); } };
    const failed = (e) => done({ status: null, signal: null, error: String((e && e.code) || 'ESPAWN'), stdout: Buffer.alloc(0), overflow: false });
    let child;
    try { child = spawn('git', argv, { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { failed(e); return; }
    const chunks = [];
    let size = 0;
    let overflow = false;
    child.stdout.on('data', (c) => {
      if (overflow) return;
      size += c.length;
      if (limit !== null && size > limit) { overflow = true; chunks.length = 0; child.kill(); return; }
      chunks.push(c);
    });
    child.stderr.on('data', () => {});
    child.on('error', failed);
    child.on('close', (code, signal) => {
      if (overflow) done({ status: null, signal: null, error: null, stdout: Buffer.alloc(0), overflow: true });
      else if (signal) done({ status: null, signal: String(signal), error: null, stdout: Buffer.alloc(0), overflow: false });
      else done({ status: code, signal: null, error: null, stdout: Buffer.concat(chunks), overflow: false });
    });
  });
}

const RESULT_KEYS = 'error\u0000overflow\u0000signal\u0000status\u0000stdout';
// Plan 2.5 executor seam: exact keys, types and combinations; overflow only for a bounded call.
function validResult(r, limit) {
  if (!isPlain(r) || Object.keys(r).sort().join('\u0000') !== RESULT_KEYS) return false;
  const { status, signal, error, stdout, overflow } = r;
  if (!(status === null || (Number.isInteger(status) && status >= 0 && status <= 255))) return false;
  if (!(signal === null || (typeof signal === 'string' && signal !== '')) || !(error === null || (typeof error === 'string' && error !== ''))) return false;
  if (!Buffer.isBuffer(stdout) || typeof overflow !== 'boolean' || (signal !== null && error !== null)) return false;
  // I4-1: overflow is valid only on a bounded call with status, signal and error all null; otherwise the usual rule.
  if (overflow) return limit !== null && status === null && signal === null && error === null;
  return status !== null ? signal === null && error === null : signal !== null || error !== null;
}
const LENGTH_ERROR = /^(?:E2BIG|ENAMETOOLONG)\b/;

/**
 * One executor call (C4-P3-1): the argument bound before any process; a rejection, throw, invalid result, signal or
 * spawn error is GIT_SAFE_GIT, E2BIG/ENAMETOOLONG GIT_SAFE_ARG_LIMIT, overflow or an oversized Buffer GIT_SAFE_LIMIT.
 * Returns { status, stdout }; what a nonzero status means is the caller's stage-specific decision.
 */
async function call(state, argv, cwd, limit) {
  const full = [...state.prefix, ...argv];
  if (full.reduce((sum, a) => sum + 2 * a.length + 3, 0) > MAX_GIT_ARG_UNITS) throw gsError('GIT_SAFE_ARG_LIMIT');
  let r;
  try { r = await state.execute({ argv: full, cwd, env: { ...state.env }, limit }); } catch { throw gsError('GIT_SAFE_GIT'); }
  if (!validResult(r, limit)) throw gsError('GIT_SAFE_GIT');
  if (r.overflow || (limit !== null && r.stdout.length > limit)) throw limitError(null);
  if (r.error !== null) throw gsError(LENGTH_ERROR.test(r.error) ? 'GIT_SAFE_ARG_LIMIT' : 'GIT_SAFE_GIT');
  if (r.signal !== null) throw gsError('GIT_SAFE_GIT');
  return { status: r.status, stdout: r.stdout };
}

// ---------------------------------------------------------------- records ----
// Plan 3.5: strict UTF-8, NUL-terminated; empty records ignored; every name passes C1 structure; nothing is trimmed.
function parseNames(buf) {
  if (buf.length === 0) return [];
  const text = utf8(buf);
  if (text === null || !text.endsWith('\u0000')) throw gsError('GIT_SAFE_RECORD');
  const names = text.slice(0, -1).split('\u0000').filter((n) => n !== '');
  if (!names.every(validPath)) throw gsError('GIT_SAFE_RECORD');
  return names;
}
// <mode> SP <type> SP <oid> TAB <path> NUL, split at the first TAB; only these mode/type pairs (no 100664, no trees).
const TREE_HEADER = /^(100644 blob|100755 blob|120000 blob|160000 commit) ([0-9a-f]{40}|[0-9a-f]{64})$/;
function parseTree(buf) {
  if (buf.length === 0) return [];
  const text = utf8(buf);
  if (text === null || !text.endsWith('\u0000')) throw gsError('GIT_SAFE_RECORD');
  return text.slice(0, -1).split('\u0000').map((rec) => {
    const tab = rec.indexOf('\t');
    const m = tab < 0 ? null : TREE_HEADER.exec(rec.slice(0, tab));
    const p = rec.slice(tab + 1);
    if (!m || !validPath(p)) throw gsError('GIT_SAFE_RECORD');
    const [mode, type] = m[1].split(' ');
    return { mode, type, oid: m[2], path: p };
  });
}

// ---------------------------------------------------------------- session ----
const SESSIONS = new WeakMap(); // session -> private state; the brand a copy or a forgery cannot carry
const SESSION_KEYS = ['cwd', 'env', 'execute', 'readFile'];
const GIT_KEYS = ['limit', 'allowFailure'];
const VERSION = /^git version (\d+)\.(\d+)(?:\.(\d+))?(?:[.\- ][^\r\n]*)?\r?\n$/;
const processEnv = () => Object.fromEntries(Object.entries(process.env).filter(([, v]) => typeof v === 'string'));

// Every option is validated before any dependency is called (plan 2.5).
function readOptions(options) {
  if (!isPlain(options) || !Object.keys(options).every((k) => SESSION_KEYS.includes(k))) throw inputError();
  const { cwd, env, execute, readFile } = options;
  if (cwd !== undefined && (typeof cwd !== 'string' || cwd === '' || !path.isAbsolute(cwd))) throw inputError();
  if ((execute !== undefined && typeof execute !== 'function') || (readFile !== undefined && typeof readFile !== 'function')) throw inputError();
  return {
    start: path.resolve(cwd !== undefined ? cwd : process.cwd()),
    env: sanitizeGitEnvironment(env !== undefined ? env : processEnv()),
    execute: execute || executeGit,
    readFile: readFile || ((p) => fs.promises.readFile(p)),
  };
}

async function resolveIn(state, revision) {
  const r = await call(state, ['rev-parse', '--verify', '--quiet', '--end-of-options', `${revision}^{commit}`], state.root, null);
  if (r.status !== 0) throw gsError('GIT_SAFE_REVISION');
  const m = OID_LINE.exec(utf8(r.stdout) || '');
  if (!m) throw gsError('GIT_SAFE_RECORD');
  return m[1];
}
async function treeIn(state, commit) {
  const r = await call(state, ['ls-tree', '-r', '-z', '--full-tree', commit], state.root, null);
  if (r.status !== 0) throw gsError('GIT_SAFE_GIT');
  return parseTree(r.stdout);
}

/**
 * Plan 2.5 and 3.3: platform snapshot and prefix, the version (once per session), the root, then the installed policy
 * read once through C1 (no shipped-default, legacy or empty fallback). Returns a frozen, privately branded session.
 */
export async function createGitSession(options = {}) {
  const o = readOptions(options);
  const state = { ...o, prefix: prefixFor(process.platform === 'win32' ? 'NUL' : '/dev/null'), root: null, policy: null };
  const v = await call(state, ['--version'], o.start, null);
  if (v.status !== 0) throw gsError('GIT_SAFE_GIT');
  const m = VERSION.exec(utf8(v.stdout) || '');
  if (!m || !(Number(m[1]) > 2 || (Number(m[1]) === 2 && Number(m[2]) >= 31))) throw gsError('GIT_SAFE_VERSION');
  const t = await call(state, ['rev-parse', '--show-toplevel'], o.start, null);
  if (t.status !== 0) throw gsError('GIT_SAFE_REPOSITORY');
  const raw = utf8(t.stdout);
  const top = raw === null ? null : raw.endsWith('\r\n') ? raw.slice(0, -2) : raw.endsWith('\n') ? raw.slice(0, -1) : null;
  if (!top || /[\r\n]/.test(top) || !path.isAbsolute(top)) throw gsError('GIT_SAFE_REPOSITORY');
  state.root = path.resolve(top);
  let buf;
  try { buf = await o.readFile(path.join(state.root, '.ai', 'security-paths.json')); } catch { throw gsError('GIT_SAFE_POLICY_IO'); }
  if (!Buffer.isBuffer(buf)) throw gsError('GIT_SAFE_POLICY_IO');
  const text = utf8(buf);
  if (text === null) throw policyJsonError();
  const parsed = parseSecurityPolicy(text);
  state.policy = deepFreeze(parsed.policy);

  // The low-level methods (plan 2.5) for trusted consumers with their own specified operation; not an argv CLI surface.
  const git = async (argv, opts = {}) => {
    if (!denseStrings(argv) || !isPlain(opts) || !Object.keys(opts).every((k) => GIT_KEYS.includes(k))) throw inputError();
    const limit = opts.limit === undefined ? null : opts.limit;
    const allowFailure = opts.allowFailure === undefined ? false : opts.allowFailure;
    if ((limit !== null && limit !== MAX_OUTPUT_BYTES) || typeof allowFailure !== 'boolean') throw inputError();
    const r = await call(state, argv, state.root, limit);
    if (r.status !== 0 && !allowFailure) throw gsError('GIT_SAFE_GIT');
    return { status: r.status, stdout: r.stdout };
  };
  const resolveCommit = async (revision) => { if (!isSingle(revision)) throw inputError(); return resolveIn(state, revision); };
  const listTree = async (commitId) => { if (typeof commitId !== 'string' || !OID.test(commitId)) throw inputError(); return treeIn(state, commitId); };
  const session = Object.freeze({ root: state.root, policy: state.policy, sourceSchema: parsed.sourceSchema, git, resolveCommit, listTree });
  SESSIONS.set(session, state);
  return session;
}

// ---------------------------------------------------------------- execute ----
// Plan 3.6: the diff flags D and the header flags H.
const D = ['--no-ext-diff', '--no-textconv', '--no-renames', '--no-color', '--submodule=short', '--ignore-submodules=none', '--src-prefix=a/', '--dst-prefix=b/'];
const H = ['--no-notes', '--no-decorate', '--no-show-signature', '--no-use-mailmap', '--date=default', '--encoding=UTF-8'];
const FORMAT = {
  patch: ['--patch'], 'name-status': ['--name-status'], 'name-only': ['--name-only'],
  stat: ['--stat', '--stat-width=80', '--stat-name-width=40', '--stat-graph-width=30'],
};
const under = (n, sel) => sel.length === 0 || sel.some((s) => n === s || n.startsWith(`${s}/`));

/**
 * Plan 3.1 order: request and session checks, the cat policy check, commit resolution (once per distinct spelling),
 * zero-count log, one inventory, C1 classification into literal exclusions, empty success when nothing unprotected is
 * selected, then one bounded content call. Returns the complete stdout; nothing is emitted here.
 */
export async function executeGitSafe(request, session) {
  if (!validRequest(request)) throw inputError();
  const state = SESSIONS.get(session);
  if (!state) throw inputError();
  const { subcommand: sub, revisions, paths, format, patch, maxCount, pattern } = request;
  const isProtected = (p) => matchesPolicyPath(p, state.policy);
  if (sub === 'cat' && isProtected(paths[0])) throw gsError('GIT_SAFE_SECRET');

  const shape = revisionShape(revisions[0], KIND[sub]);
  const ids = new Map();
  for (const sp of shape.endpoints) if (!ids.has(sp)) ids.set(sp, await resolveIn(state, sp));
  const [A, B] = shape.endpoints.map((sp) => ids.get(sp));
  if (sub === 'log' && maxCount === 0) return EMPTY();

  const L = paths.map((p) => `:(literal)${p}`);
  // Protected names, deduplicated and UTF-8 sorted, become exclusions in their exact inventory spelling (plan 3.5).
  const classify = (names) => {
    const all = [...new Set(names)];
    const prot = all.filter(isProtected).sort(byUtf8);
    return { visible: all.length > prot.length, E: prot.map((p) => `:(exclude,literal)${p}`) };
  };
  const inventory = async (argv) => {
    const r = await call(state, argv, state.root, null);
    if (r.status !== 0) throw gsError('GIT_SAFE_GIT');
    return classify(parseNames(r.stdout));
  };
  const content = async (argv, noMatchOk = false) => {
    let r;
    try { r = await call(state, argv, state.root, MAX_OUTPUT_BYTES); } catch (e) { throw e.code === 'GIT_SAFE_LIMIT' ? limitError(sub) : e; }
    if (r.status === 0) return r.stdout;
    if (noMatchOk && r.status === 1 && r.stdout.length === 0) return EMPTY(); // grep: no match is success
    throw gsError('GIT_SAFE_GIT');
  };

  if (sub === 'cat') return content(['cat-file', 'blob', `${A}:${paths[0]}`]);
  if (sub === 'diff') {
    let left = A;
    if (shape.op === '...') {
      const r = await call(state, ['merge-base', A, B], state.root, null);
      if (r.status !== 0) throw gsError('GIT_SAFE_GIT');
      const m = OID_LINE.exec(utf8(r.stdout) || '');
      if (!m) throw gsError('GIT_SAFE_RECORD');
      left = m[1];
    }
    const { visible, E } = await inventory(['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--no-color', '--ignore-submodules=none', '--name-only', '-z', left, B, '--', ...L]);
    return visible ? content(['diff', ...D, ...FORMAT[format], left, B, '--', ...L, ...E]) : EMPTY();
  }
  if (sub === 'log') {
    // C4-PQ2: one count-free inventory over the whole resolved expression; the count reaches the content log only.
    const expr = shape.op === null ? A : `${A}${shape.op}${B}`;
    const { visible, E } = await inventory(['log', '--format=', '--no-ext-diff', '--no-textconv', '--no-renames', '--no-color', '--no-notes', '--no-decorate',
      '--no-show-signature', '--no-use-mailmap', '--ignore-submodules=none', '--name-only', '-z', '--diff-merges=separate', '--full-history', expr, '--', ...L]);
    if (!visible) return EMPTY();
    const fmt = format === 'oneline' ? ['--oneline', '--abbrev=12'] : ['--format=medium', '--no-abbrev-commit'];
    return content(['log', ...D, ...H, ...fmt, ...(patch ? ['-p'] : []), ...(maxCount === null ? [] : [`--max-count=${maxCount}`]), expr, '--', ...L, ...E]);
  }
  if (sub === 'show') {
    const { visible, E } = await inventory(['diff-tree', '--root', '-r', '-m', '--no-commit-id', '--no-ext-diff', '--no-textconv', '--no-renames', '--ignore-submodules=none', '--name-only', '-z', A, '--', ...L]);
    return visible ? content(['show', ...D, ...H, '--format=medium', '--no-abbrev-commit', '--cc', ...FORMAT[format], A, '--', ...L, ...E]) : EMPTY();
  }
  // ls and grep: one recursive tree inventory, selected locally by literal path or directory prefix.
  const selected = (await treeIn(state, A)).map((e) => e.path).filter((n) => under(n, paths));
  if (sub === 'ls') {
    const names = [...new Set(selected)].filter((n) => !isProtected(n)).sort(byUtf8);
    const out = Buffer.from(names.map((n) => `${n}\u0000`).join(''), 'utf8');
    if (out.length > MAX_OUTPUT_BYTES) throw limitError('ls');
    return out;
  }
  // grep: exclusions are only the protected names under the selectors (all of them without selectors).
  const { visible, E } = classify(selected);
  return visible ? content(['grep', '--no-textconv', '--no-color', '--full-name', '--no-column', '--no-heading', '--no-break', '-G', '-I', '-n', '-z', '-e', pattern, A, '--', ...L, ...E], true) : EMPTY();
}

// ------------------------------------------------------------------- main ----
/**
 * Plan 2.5 and 3.9: arguments before any session; streams and the exit code are the caller's (git-safe.mjs).
 * C5 plan 2.7: after the container check, review-diff is delegated to the lazily imported review helper, which owns
 * its grammar, dependency keys and result. The six object commands never import it, so they keep working without it;
 * a missing or broken helper is GIT_SAFE_INTERNAL for review-diff only.
 */
export async function main(argv, dependencies = {}) {
  try {
    if (!denseStrings(argv)) throw inputError();
    if (argv[0] === 'review-diff') {
      let helper;
      try { helper = await import('./review-diff.mjs'); } catch { throw gsError('GIT_SAFE_INTERNAL'); }
      return await helper.reviewMain(argv, dependencies);
    }
    const request = parseGitSafeArgs(argv);
    const session = await createGitSession(dependencies);
    return { exitCode: 0, stdout: await executeGitSafe(request, session), stderr: '' };
  } catch (e) {
    const known = e instanceof Error && (OWN_ERRORS.has(e) || (typeof e.code === 'string' && /^POLICY_[A-Z_]+$/.test(e.code) && e.message.startsWith(`${e.code}: `)));
    return { exitCode: 2, stdout: Buffer.alloc(0), stderr: `git-safe: ${known ? e.message : `GIT_SAFE_INTERNAL: ${DETAIL.GIT_SAFE_INTERNAL}`}\n` };
  }
}
