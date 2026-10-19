// C4 tests lane: the seventeen component assertions of "C4. Git object commands and bounded argument builders".
//
// Written from the frozen plan only, before any implementation exists:
//   docs/plans/2026-10-18-project-setup-v3-rc1-c4.md   (sections 1-9 and the C4-P3-1 to C4-P3-7 addendum, which wins over earlier sections)
// Under the frozen architecture plan docs/plans/2026-10-15-project-setup-v3-rc1.md and the landed contracts it builds on: C11a (tests/rc1-cases.mjs,
// tests/run-component-tests.mjs, tests/helpers/v2-baseline.mjs), C1 (assets/tools/security-policy.mjs), C2 (scripts/ownership.mjs, apply.mjs) and C3
// (scripts/migrate-security-paths.mjs, data/runtime-units.json, tests/c3.test.mjs). Plan 2.2 gives the tests lane this file, tests/fixtures/git-safe-cases.json,
// the tests/rc1-cases.mjs registration, the R01 and freshSetup edits in tests/run-tests.mjs and the production-catalog edits in tests/c3.test.mjs; those
// edits live in those files. The implementer must not edit this file, the fixture, or any of them.
//
// Importing this module runs nothing. Every production module and every registry module (rc1-cases.mjs imports this file, so a static import back would be
// circular) is imported lazily inside run(context). A missing module or export fails one assertion with a diagnostic; it never breaks the import.
//
// Every run(context) returns { failures, skipped: null }. There is no skip path: an unavailable optional subcase (a Windows file symlink without privilege) is
// simply not exercised. Scratch data lives under context.tmp only; nothing is ever written or deleted anywhere else.
//
// How the plan's seams are used (plan 4.3):
//   - the execute and readFile seams of createGitSession/main carry the policy-consumer matrices (R74, R97, R47), every exact-argv assertion, malformed
//     metadata, failure mapping and the byte boundaries; the fake executor below answers by recognizing the pinned operation vectors of plan 3.3-3.6, and the
//     expected vectors are restated independently in this file (never taken from the code under test);
//   - real Git is used for cat, ls, grep, the history regressions, exact case, isolation, the installed entrypoint and the oversized blob. Git objects with
//     Windows-hostile names are created by git fast-import (one process per repository), never as worktree files.
//
// Where the plan does not pin a value a test would need, the test asserts only what is pinned. The gaps are listed in the delegation report as PLAN-GAP
// lines; the places they touch carry a comment starting with "PLAN-GAP". Readings the plan implies but does not spell out:
//   - the format strings of the summary formats and of --oneline are not literally pinned (only the defaults are); the argv builders pin their behavior, so
//     the parser tests assert them leniently (a nonempty string, distinct from the default and consistent across commands);
//   - the errors of an executor rejection or an E2BIG/ENAMETOOLONG spelling beyond the bare codes are asserted only as far as C4-P3-1 pins them.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// ===================================================== generic utilities ====
const eq = (a, b) => isDeepStrictEqual(a, b);
const hasOwn = (o, k) => o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k);
const errMsg = (e) => String((e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) || e).slice(0, 500);
// Diagnostics are ASCII-only whatever the data holds.
function show(v) {
  let s;
  const bufText = (x) => `<Buffer ${x.data.length}: ${Buffer.from(x.data.slice(0, 120)).toString('latin1')}>`; // Buffer.toJSON runs before the replacer
  try { s = typeof v === 'string' ? JSON.stringify(v) : (JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? String(x) : x && x.type === 'Buffer' && Array.isArray(x.data) ? bufText(x) : x)) ?? String(v)); } catch { s = String(v); }
  return s.replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).slice(0, 700);
}
function mkCheck(failures) { return (cond, msg, detail) => { if (!cond) failures.push(detail === undefined ? msg : `${msg} :: ${show(detail)}`); }; }
function deepFreeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(deepFreeze); Object.freeze(v); } return v; }
function deepFrozen(v) { if (v === null || typeof v !== 'object') return true; return Object.isFrozen(v) && Object.values(v).every(deepFrozen); }
const clone = (v) => JSON.parse(JSON.stringify(v));
const sorted = (a) => [...a].sort();
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const jsonText = (v) => JSON.stringify(v, null, 2) + '\n';
const fwd = (p) => String(p).replace(/\\/g, '/');
const H64 = (c) => c.repeat(64);
const normText = (s) => { let t = Buffer.isBuffer(s) ? s.toString('utf8') : String(s); if (t.charCodeAt(0) === 0xfeff) t = t.slice(1); t = t.replace(/\r\n?/g, '\n'); if (!t.endsWith('\n')) t += '\n'; return t; };
const NH = (s) => sha(Buffer.from(normText(s), 'utf8'));
const bytes = (s) => (Buffer.isBuffer(s) ? s : Buffer.from(s, 'utf8'));
const utf8Cmp = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
const byUtf8 = (list) => [...list].sort(utf8Cmp);
const uniq = (list) => [...new Set(list)];
const nul = (names) => Buffer.from(names.map((n) => `${n}\0`).join(''), 'utf8');
const sameBuf = (a, b) => Buffer.isBuffer(a) && Buffer.isBuffer(b) && Buffer.compare(a, b) === 0;
const WIN = process.platform === 'win32';

// A group that fails hundreds of assertions would bury its own report; the cap keeps the first failures and counts the rest.
const FAILURE_CAP = 60;
// Runs one assertion body. `step` isolates sections so one failing section never hides the others.
async function runAssertion(body) {
  const failures = [];
  const check = mkCheck(failures);
  const step = async (name, fn) => { try { await fn(); } catch (e) { failures.push(`${name}: threw: ${errMsg(e)}`); } };
  try { await body({ failures, check, step }); } catch (e) { failures.push(`threw: ${errMsg(e)}`); }
  if (failures.length > FAILURE_CAP) { const more = failures.length - FAILURE_CAP; failures.length = FAILURE_CAP; failures.push(`(${more} more failures not shown)`); }
  return { failures, skipped: null };
}
async function attempt(fn) { try { return { threw: false, value: await fn() }; } catch (e) { return { threw: true, error: e }; } }

const scriptUrl = (context, name) => pathToFileURL(path.join(context.skillRoot, 'scripts', name)).href;
const assetUrl = (context, rel) => pathToFileURL(path.join(context.skillRoot, ...rel.split('/'))).href;
async function importOrFail(failures, url, label) {
  try { return await import(url); } catch (e) { failures.push(`cannot import ${label}: ${errMsg(e)}`); return null; }
}
const needSibling = (failures, rel) => importOrFail(failures, new URL(rel, import.meta.url).href, `tests/${rel}`);
function needFns(failures, mod, names) {
  const missing = names.filter((n) => typeof (mod && mod[n]) !== 'function');
  if (missing.length) failures.push(`missing exports: ${missing.join(', ')}`);
  return missing.length === 0;
}

// ------------------------------------------------------------- scratch ----
function scratchDir(context, label) {
  fs.mkdirSync(context.tmp, { recursive: true });
  return fs.mkdtempSync(path.join(context.tmp, `c4-${label}-`));
}
const rmrf = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* best effort */ } };
async function withScratch(context, label, fn) {
  const dir = scratchDir(context, label);
  try { return await fn(dir); } finally { rmrf(dir); }
}
const readBytes = (p) => { try { return fs.readFileSync(p); } catch { return null; } };
const readText = (p) => { const b = readBytes(p); return b === null ? null : b.toString('utf8'); };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const exists = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };
function putFile(p, data) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); }
const sameBytes = (a, b) => a !== null && b !== null && Buffer.compare(a, b) === 0;
function cloneTree(src, dst) { fs.cpSync(src, dst, { recursive: true }); return dst; }
function walkTree(root, skipTop = []) {
  const out = [];
  const rec = (dir, rel) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!rel && skipTop.includes(e.name)) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) out.push([r, 'link', null]);
      else if (e.isDirectory()) { out.push([r, 'dir', null]); rec(full, r); } else out.push([r, 'file', sha(fs.readFileSync(full))]);
    }
  };
  rec(root, '');
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
const snapshotTree = (root, skipTop = []) => JSON.stringify(walkTree(root, skipTop));

// ------------------------------------------------------- import safety ----
// Same criteria as C1/C2/C3/C11a: no spawn, no filesystem write, no output, no process.exit, no exit code.
const PROBE_SOURCE = [
  "import cp from 'node:child_process';",
  "import fs from 'node:fs';",
  "import { syncBuiltinESMExports } from 'node:module';",
  "const log = { spawns: [], writes: [], reads: [], stdout: [], stderr: [], exits: [], err: null, names: [], exitCode: null, env: 0 };",
  "for (const k of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) { const o = cp[k]; cp[k] = function () { log.spawns.push(k); return o.apply(this, arguments); }; }",
  "const W = ['writeFileSync', 'appendFileSync', 'mkdirSync', 'mkdtempSync', 'rmSync', 'rmdirSync', 'unlinkSync', 'renameSync', 'copyFileSync', 'cpSync', 'symlinkSync', 'linkSync', 'truncateSync', 'createWriteStream', 'writeFile', 'appendFile', 'mkdir', 'mkdtemp', 'rm', 'rmdir', 'unlink', 'rename', 'copyFile', 'cp', 'symlink'];",
  "for (const k of W) { if (typeof fs[k] === 'function') { const o = fs[k]; fs[k] = function () { log.writes.push(k); return o.apply(this, arguments); }; } }",
  "for (const k of W) { if (typeof fs.promises[k] === 'function') { const o = fs.promises[k]; fs.promises[k] = function () { log.writes.push('promises.' + k); return o.apply(this, arguments); }; } }",
  "const ow = process.stdout.write, ew = process.stderr.write;",
  "process.stdout.write = function (c) { log.stdout.push(String(c)); return true; };",
  "process.stderr.write = function (c) { log.stderr.push(String(c)); return true; };",
  "process.exit = function (c) { log.exits.push(c === undefined ? null : c); };",
  "syncBuiltinESMExports();",
  "const envBefore = JSON.stringify(Object.entries(process.env).sort());",
  "const before = process.exitCode;",
  "try { const m = await import(process.argv[2]); log.names = Object.keys(m).sort(); } catch (e) { log.err = String(e && e.message ? e.message : e); }",
  "log.exitCode = process.exitCode === before || process.exitCode === undefined ? null : process.exitCode;",
  "log.env = JSON.stringify(Object.entries(process.env).sort()) === envBefore ? 0 : 1;",
  "process.stdout.write = ow; process.stderr.write = ew;",
  "process.stdout.write(JSON.stringify(log) + '\\n');",
].join('\n') + '\n';
function checkImportSafe(check, label, context, dir, url, expectNames) {
  const file = path.join(dir, `probe-${Math.random().toString(36).slice(2, 8)}.mjs`);
  fs.writeFileSync(file, PROBE_SOURCE);
  const r = spawnSync(process.execPath, [file, url], { cwd: dir, env: { ...context.env }, encoding: 'utf8', windowsHide: true, shell: false, timeout: 60000 });
  let log = null; try { log = JSON.parse(String(r.stdout).trim().split('\n').pop()); } catch { /* reported below */ }
  check(r.status === 0 && log, `${label}: the import probe ran`, { status: r.status, stderr: String(r.stderr).slice(0, 300), stdout: String(r.stdout).slice(0, 300) });
  if (!log) return null;
  check(log.err === null, `${label}: imports cleanly`, log.err);
  check(log.spawns.length === 0, `${label}: import spawns no subprocess`, log.spawns);
  check(log.writes.length === 0, `${label}: import writes nothing`, log.writes);
  check(log.stdout.length === 0 && log.stderr.length === 0, `${label}: import prints nothing`, { out: log.stdout.join('').slice(0, 200), err: log.stderr.join('').slice(0, 200) });
  check(log.exits.length === 0 && log.exitCode === null, `${label}: import neither exits nor sets an exit code`, { exits: log.exits, exitCode: log.exitCode });
  check(log.env === 0, `${label}: import does not change the environment`);
  if (expectNames) check(eq(log.names, sorted(expectNames)), `${label}: the export set is exactly ${expectNames.join(', ')}`, log.names);
  return log;
}
// Runs fn while recording (and swallowing) any attempt to write a process stream or exit.
async function withStreamGuard(fn) {
  const rec = { out: [], err: [], exits: [], value: undefined, threw: null };
  const ow = process.stdout.write, ew = process.stderr.write, ex = process.exit, code0 = process.exitCode;
  const cb = (rest) => { const f = rest.find((x) => typeof x === 'function'); if (f) f(); };
  process.stdout.write = function (c, ...rest) { rec.out.push(String(c)); cb(rest); return true; };
  process.stderr.write = function (c, ...rest) { rec.err.push(String(c)); cb(rest); return true; };
  process.exit = function (c) { rec.exits.push(c); throw new Error('process.exit called'); };
  try { rec.value = await fn(); } catch (e) { rec.threw = e; } finally { process.stdout.write = ow; process.stderr.write = ew; process.exit = ex; }
  rec.exitCodeChanged = process.exitCode !== code0;
  return rec;
}

// ============================================================ literals ====
// Written out independently of the implementation (plan 4.1: "Add these descriptors").
const COMPONENT_INVENTORY = [
  ['R41/C4/cat', 'commit blob reads and secret refusals'],
  ['R42/C4/ls', 'literal tree listings omit protected paths'],
  ['R42/C4/grep', 'tree grep filters secrets and distinguishes no match'],
  ['R43/C4/history', 'historical secret paths remain protected'],
  ['R47/C4/project-policy', 'project additions reach Git commands'],
  ['R74/C4/corpus', 'shared policy corpus reaches Git consumers'],
  ['R75/C4/exact-case', 'Git lookup preserves exact path case'],
  ['R75/C4/nul-records', 'NUL records preserve unusual path names'],
  ['R76/C4/arguments', 'explicit command grammars and literal selectors'],
  ['R76/C4/revisions', 'content commands receive resolved commits'],
  ['R76/C4/isolation', 'Git configuration and executable filters are isolated'],
  ['R76/C4/failures', 'policy and Git failures emit no content'],
  ['R76/C4/limits', 'whole results obey the exact byte limit'],
  ['R76/C4/narrowing', 'limit diagnostics preserve incomplete review scope'],
  ['R97/C4/environment-names', 'environment name variants stay protected'],
  ['R80/C4/runtime-targets', 'every plan requires a complete reviewed runtime unit'],
  ['R78/C4/reader-unit', 'reviewed reader opens schema two migration'],
];
const EXPECTED_DESCRIPTORS = COMPONENT_INVENTORY.map(([id, name]) => ({ id, name }));

// Plan 2.5 and 3.4: constants, the exact export set, the fixed Git prefix and the argument-bound formula.
const MAX_BYTES = 1048576;
const MAX_UNITS = 24000;
const CORE_REL = 'assets/tools/git-safe-core.mjs';
const ENTRY_REL = 'assets/tools/git-safe.mjs';
const CORE_EXPORTS = ['MAX_GIT_ARG_UNITS', 'MAX_OUTPUT_BYTES', 'NARROWING_GUIDANCE', 'SUPPORTED_FORMS', 'createGitSession', 'executeGitSafe', 'main', 'parseGitSafeArgs', 'sanitizeGitEnvironment'];
const COMMANDS = ['diff', 'log', 'show', 'cat', 'ls', 'grep'];
const SUPPORTED_FORMS = {
  diff: 'diff <A>..<B>|<A>...<B> [--stat|--name-status|--name-only] [-- <paths>]',
  log: 'log [-p] [--oneline] [-n<k>|--max-count=<k>] <rev>|<A>..<B>|<A>...<B> [-- <paths>]',
  show: 'show <commit> [--stat|--name-status] [-- <paths>]',
  cat: 'cat <commit> -- <path>',
  ls: 'ls <commit> [-- <paths>]',
  grep: 'grep <commit> <pattern> [-- <paths>]',
};
const NARROWING = {
  diff: 'Narrow with -- <paths> or a smaller commit range.',
  log: 'Narrow with -- <paths>, attached -n<k>, or a smaller commit range.',
  show: 'Narrow with -- <paths>.',
  cat: 'Use grep with a more selective pattern or select a smaller file.',
  ls: 'Narrow with -- <paths>.',
  grep: 'Narrow with -- <paths> or a more selective pattern.',
};
const NULL_DEVICE = WIN ? 'NUL' : '/dev/null';
const prefixOf = (nullDevice = NULL_DEVICE) => [
  '--no-pager',
  '-c', 'core.fsmonitor=false', '-c', 'core.quotePath=true', '-c', 'submodule.recurse=false', '-c', 'log.showSignature=false', '-c', 'log.showNotes=false',
  '-c', 'log.follow=false', '-c', 'log.mailmap=false', '-c', 'log.diffMerges=off', '-c', 'diff.renames=false', '-c', 'diff.submodule=short',
  '-c', 'diff.relative=false', '-c', 'diff.noprefix=false', '-c', 'diff.mnemonicPrefix=false', '-c', 'diff.context=3', '-c', 'diff.interHunkContext=0',
  '-c', 'diff.algorithm=myers', '-c', 'diff.indentHeuristic=false', '-c', 'diff.suppressBlankEmpty=false', '-c', `diff.orderFile=${nullDevice}`, '-c', 'color.ui=false',
];
const PREFIX = prefixOf();
const argvUnits = (argv) => argv.reduce((sum, a) => sum + 2 * a.length + 3, 0);

// Plan 3.9: every error line. A core error is an Error with an own string code and a message that starts with "<CODE>: ".
const E = {
  INPUT: 'GIT_SAFE_INPUT: invalid Git helper input',
  // C5 plan 2.7 changes this one detail of the frozen C4 contract: the diagnostic now also names review-diff. It is the only C4 message that changes.
  COMMAND: 'GIT_SAFE_COMMAND: supported commands: diff, log, show, cat, ls, grep, review-diff',
  ARGUMENT: (cmd) => `GIT_SAFE_ARGUMENT: unsupported arguments; supported: ${SUPPORTED_FORMS[cmd]}`,
  VERSION: 'GIT_SAFE_VERSION: Git 2.31 or later is required',
  REPOSITORY: 'GIT_SAFE_REPOSITORY: not inside a Git repository',
  POLICY_IO: 'GIT_SAFE_POLICY_IO: cannot read .ai/security-paths.json; refusing to run without a valid policy',
  SECRET: 'GIT_SAFE_SECRET: requested path is protected by the security policy',
  REVISION: 'GIT_SAFE_REVISION: revision does not resolve to a commit',
  RECORD: 'GIT_SAFE_RECORD: invalid Git metadata; no result was emitted',
  GIT: 'GIT_SAFE_GIT: Git operation failed; no result was emitted',
  ARG_LIMIT: 'GIT_SAFE_ARG_LIMIT: Git arguments exceed the safe invocation bound; narrow with -- <paths> or a smaller commit range. No result was emitted.',
  LIMIT_LOW: 'GIT_SAFE_LIMIT: output exceeds 1048576 bytes',
  LIMIT: (cmd) => `GIT_SAFE_LIMIT: output exceeds 1048576 bytes. ${NARROWING[cmd]} No partial result was emitted; this review is not complete.`,
};
const codeOf = (message) => message.slice(0, message.indexOf(':'));
const stderrLine = (message) => `git-safe: ${message}\n`;
const EMPTY = Buffer.alloc(0);

// Plan 3.4: the environment names that are removed, and the five that are then set (restated independently).
const ENV_REMOVE = ['GIT_CONFIG', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT', 'GIT_EXTERNAL_DIFF', 'GIT_DIFF_OPTS', 'GIT_PAGER', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_NAMESPACE', 'GIT_PREFIX', 'GIT_ATTR_SOURCE', 'GIT_REPLACE_REF_BASE', 'GIT_NO_REPLACE_OBJECTS', 'GIT_TERMINAL_PROMPT',
  'GIT_OPTIONAL_LOCKS', 'GIT_LITERAL_PATHSPECS', 'GIT_GLOB_PATHSPECS', 'GIT_NOGLOB_PATHSPECS', 'GIT_ICASE_PATHSPECS', 'PAGER'];
const ENV_SET = { GIT_PAGER: 'cat', PAGER: 'cat', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1' };
const ENV_PRESERVED = ['HOME', 'USERPROFILE', 'PATH', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_NOSYSTEM', 'GIT_TEST_ASSUME_DIFFERENT_OWNER'];
function expectedEnv(input) {
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    const u = k.toUpperCase();
    if (ENV_REMOVE.includes(u) || /^GIT_CONFIG_KEY_[0-9]+$/.test(u) || /^GIT_CONFIG_VALUE_[0-9]+$/.test(u)) continue;
    out[k] = v;
  }
  return Object.assign(out, ENV_SET);
}
const entriesOf = (o) => Object.entries(o).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

// ---------------------------------------------- independent vector builders ----
// A restatement of plan 3.5 and 3.6: every operation vector (without the fixed prefix P).
const LIT = (p) => `:(literal)${p}`;
const EXC = (p) => `:(exclude,literal)${p}`;
const D_FLAGS = ['--no-ext-diff', '--no-textconv', '--no-renames', '--no-color', '--submodule=short', '--ignore-submodules=none', '--src-prefix=a/', '--dst-prefix=b/'];
const H_FLAGS = ['--no-notes', '--no-decorate', '--no-show-signature', '--no-use-mailmap', '--date=default', '--encoding=UTF-8'];
const FMT = {
  patch: ['--patch'],
  'name-status': ['--name-status'],
  'name-only': ['--name-only'],
  stat: ['--stat', '--stat-width=80', '--stat-name-width=40', '--stat-graph-width=30'],
};
const V_VERSION = ['--version'];
const V_ROOT = ['rev-parse', '--show-toplevel'];
const V_RESOLVE = (rev) => ['rev-parse', '--verify', '--quiet', '--end-of-options', `${rev}^{commit}`];
const V_MERGE_BASE = (a, b) => ['merge-base', a, b];
const V_INV_DIFF = (left, right, L) => ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--no-color', '--ignore-submodules=none', '--name-only', '-z', left, right, '--', ...L];
const V_INV_SHOW = (c, L) => ['diff-tree', '--root', '-r', '-m', '--no-commit-id', '--no-ext-diff', '--no-textconv', '--no-renames', '--ignore-submodules=none', '--name-only', '-z', c, '--', ...L];
const V_INV_LOG = (expr, L) => ['log', '--format=', '--no-ext-diff', '--no-textconv', '--no-renames', '--no-color', '--no-notes', '--no-decorate', '--no-show-signature', '--no-use-mailmap', '--ignore-submodules=none', '--name-only', '-z', '--diff-merges=separate', '--full-history', expr, '--', ...L];
const V_INV_TREE = (c) => ['ls-tree', '-r', '-z', '--full-tree', c];
const V_DIFF = (fmt, left, right, L, X) => ['diff', ...D_FLAGS, ...FMT[fmt], left, right, '--', ...L, ...X];
const V_LOG = ({ oneline = false, p = false, n = null }, expr, L, X) => ['log', ...D_FLAGS, ...H_FLAGS, ...(oneline ? ['--oneline', '--abbrev=12'] : ['--format=medium', '--no-abbrev-commit']), ...(p ? ['-p'] : []), ...(n === null ? [] : [`--max-count=${n}`]), expr, '--', ...L, ...X];
const V_SHOW = (fmt, c, L, X) => ['show', ...D_FLAGS, ...H_FLAGS, '--format=medium', '--no-abbrev-commit', '--cc', ...FMT[fmt], c, '--', ...L, ...X];
const V_CAT = (c, p) => ['cat-file', 'blob', `${c}:${p}`];
const V_GREP = (pattern, c, L, X) => ['grep', '--no-textconv', '--no-color', '--full-name', '--no-column', '--no-heading', '--no-break', '-G', '-I', '-n', '-z', '-e', pattern, c, '--', ...L, ...X];
const INV_KINDS = ['invDiff', 'invShow', 'invLog', 'invTree'];
// The kind of an operation vector, for the limit it must carry (plan 3.8) and for the fake executor's routing.
function kindOf(op) {
  const n = op[0];
  if (n === '--version') return 'version';
  if (n === 'rev-parse' && op[1] === '--show-toplevel') return 'root';
  if (n === 'rev-parse' && op[1] === '--verify') return 'resolve';
  if (n === 'merge-base') return 'mergeBase';
  if (n === 'diff-tree') return 'invShow';
  if (n === 'ls-tree') return 'invTree';
  if (n === 'diff') return op.includes('-z') ? 'invDiff' : 'content';
  if (n === 'log') return op.includes('-z') ? 'invLog' : 'content';
  if (n === 'cat-file' || n === 'show' || n === 'grep') return 'content';
  return 'unknown';
}

// Plan 4.2: the argument rows, written out independently of the fixture file (the fixture is compared with them).
const ARG_ROWS = [
  ['A01', ['diff', 'c4-base..c4-head'], true], ['A02', ['diff', 'c4-base...c4-head', '--stat'], true], ['A03', ['diff', '--name-status', 'c4-base..c4-head'], true],
  ['A04', ['diff', 'c4-base..c4-head', '--name-only', '--', 'src'], true], ['A05', ['log', '-p', 'HEAD~1..HEAD'], true], ['A06', ['log', '--oneline', '-n2', 'c4-head'], true],
  ['A07', ['log', '--max-count=0', 'c4-base...c4-head'], true], ['A08', ['show', 'c4-head'], true], ['A09', ['show', '--stat', 'c4-head', '--', 'safe.txt'], true],
  ['A10', ['show', 'c4-head', '--name-status'], true], ['A11', ['cat', 'c4-head', '--', 'safe.txt'], true], ['A12', ['ls', 'c4-head', '--', 'src'], true],
  ['A13', ['grep', 'c4-head', '-needle', '--', 'safe.txt'], true], ['A14', ['grep', 'c4-head', ''], true], ['A15', ['log', '--reverse', 'c4-head'], false],
  ['A16', ['diff', '--cached', 'c4-base..c4-head'], false], ['A17', ['show', '--format=short', 'c4-head'], false], ['A18', ['log', '-n', '2', 'c4-head'], false],
  ['A19', ['log', '^c4-base', 'c4-head'], false], ['A20', ['show', 'HEAD:.env'], false], ['A21', ['cat', '--help', '--', 'safe.txt'], false], ['A22', ['diff', '-c'], false],
  ['A23', ['ls', 'c4-head', '--'], false], ['A24', ['cat', 'c4-head', '--', './safe.txt'], false], ['A25', ['cat', 'c4-head', '--', 'a/../safe.txt'], false],
  ['A26', ['grep', 'c4-head', 'a\u0000b'], false], ['A27', ['show', 'HEAD^'], true], ['A28', ['show', 'HEAD~'], true], ['A29', ['diff', 'HEAD'], false],
  ['A30', ['grep', 'c4-head', '--'], true], ['A31', ['grep', 'c4-head', '--', '--', 'safe.txt'], true],
];
const NAME_ROWS = [
  ['N01', 'safe.txt'], ['N02', 'MixedCase.txt'], ['N03', 'space name.txt'], ['N04', 'tab\tname.txt'], ['N05', 'line\nname.txt'], ['N06', 'docs/r\u00e9sum\u00e9.txt'],
  ['N07', '-dash.txt'], ['N08', 'a*b.txt'], ['N09', ':(glob)literal.txt'],
];
// Plan 3.2: the exact parser result of every accepted row. `*` marks a format string the plan does not spell out (PLAN-GAP: only the defaults are pinned).
const SUMMARY = '*';
const EXPECTED_PARSE = {
  A01: { subcommand: 'diff', revisions: ['c4-base..c4-head'], paths: [], format: 'patch', patch: true, maxCount: null, pattern: null },
  A02: { subcommand: 'diff', revisions: ['c4-base...c4-head'], paths: [], format: SUMMARY, patch: false, maxCount: null, pattern: null },
  A03: { subcommand: 'diff', revisions: ['c4-base..c4-head'], paths: [], format: SUMMARY, patch: false, maxCount: null, pattern: null },
  A04: { subcommand: 'diff', revisions: ['c4-base..c4-head'], paths: ['src'], format: SUMMARY, patch: false, maxCount: null, pattern: null },
  A05: { subcommand: 'log', revisions: ['HEAD~1..HEAD'], paths: [], format: 'medium', patch: true, maxCount: null, pattern: null },
  A06: { subcommand: 'log', revisions: ['c4-head'], paths: [], format: SUMMARY, patch: false, maxCount: 2, pattern: null },
  A07: { subcommand: 'log', revisions: ['c4-base...c4-head'], paths: [], format: 'medium', patch: false, maxCount: 0, pattern: null },
  A08: { subcommand: 'show', revisions: ['c4-head'], paths: [], format: 'patch', patch: true, maxCount: null, pattern: null },
  A09: { subcommand: 'show', revisions: ['c4-head'], paths: ['safe.txt'], format: SUMMARY, patch: false, maxCount: null, pattern: null },
  A10: { subcommand: 'show', revisions: ['c4-head'], paths: [], format: SUMMARY, patch: false, maxCount: null, pattern: null },
  A11: { subcommand: 'cat', revisions: ['c4-head'], paths: ['safe.txt'], format: null, patch: false, maxCount: null, pattern: null },
  A12: { subcommand: 'ls', revisions: ['c4-head'], paths: ['src'], format: 'name-only', patch: false, maxCount: null, pattern: null },
  A13: { subcommand: 'grep', revisions: ['c4-head'], paths: ['safe.txt'], format: null, patch: false, maxCount: null, pattern: '-needle' },
  A14: { subcommand: 'grep', revisions: ['c4-head'], paths: [], format: null, patch: false, maxCount: null, pattern: '' },
  A27: { subcommand: 'show', revisions: ['HEAD^'], paths: [], format: 'patch', patch: true, maxCount: null, pattern: null },
  A28: { subcommand: 'show', revisions: ['HEAD~'], paths: [], format: 'patch', patch: true, maxCount: null, pattern: null },
  A30: { subcommand: 'grep', revisions: ['c4-head'], paths: [], format: null, patch: false, maxCount: null, pattern: '--' },
  A31: { subcommand: 'grep', revisions: ['c4-head'], paths: ['safe.txt'], format: null, patch: false, maxCount: null, pattern: '--' },
};
const PARSE_KEYS = ['subcommand', 'revisions', 'paths', 'format', 'patch', 'maxCount', 'pattern'];
const DEFAULT_FORMAT = { diff: 'patch', log: 'medium', show: 'patch', cat: null, ls: 'name-only', grep: null };

const FIXTURE_FILE = (context) => path.join(context.skillRoot, 'tests', 'fixtures', 'git-safe-cases.json');
const CORPUS_FILE = (context) => path.join(context.skillRoot, 'tests', 'fixtures', 'security-policy-corpus.json');
// Loads the plan 4.2 fixture and checks it against the independent literals above. Returns { args, names } or null.
function loadFixture(check, context) {
  const f = readJson(FIXTURE_FILE(context));
  if (!f) { check(false, 'tests/fixtures/git-safe-cases.json is readable JSON'); return null; }
  check(eq(Object.keys(f), ['schema', 'arguments', 'names']) && f.schema === 1, 'the fixture has exactly schema 1, arguments and names, in that order', Object.keys(f));
  const wantArgs = ARG_ROWS.map(([id, argv, accepted]) => ({ id, argv, command: argv[0], accepted }));
  const wantNames = NAME_ROWS.map(([id, p]) => ({ id, path: p, content: 'needle\n' }));
  check(eq(f.arguments, wantArgs), 'the argument rows are A01-A31 with command equal to argv[0], in the pinned order', f.arguments && f.arguments.map((r) => r.id));
  check(eq(f.names, wantNames), 'the name rows are N01-N09 with content "needle\\n", in the pinned order', f.names && f.names.map((r) => r.id));
  check((f.arguments || []).every((r) => eq(Object.keys(r), ['id', 'argv', 'command', 'accepted'])) && (f.names || []).every((r) => eq(Object.keys(r), ['id', 'path', 'content'])), 'every fixture row has exactly its pinned keys');
  const accepted = (f.arguments || []).filter((r) => r.accepted).map((r) => r.id);
  check(eq(accepted, [...Array.from({ length: 14 }, (_, i) => `A${String(i + 1).padStart(2, '0')}`), 'A27', 'A28', 'A30', 'A31']), 'the accepted rows are A01-A14, A27-A28 and A30-A31', accepted);
  return { args: f.arguments || [], names: f.names || [] };
}

// ================================================= core loading helpers ====
const needCore = (failures, context) => importOrFail(failures, assetUrl(context, CORE_REL), CORE_REL);
async function loadCore(failures, context) {
  const core = await needCore(failures, context);
  if (!core) return null;
  const missing = CORE_EXPORTS.filter((n) => !(n in core));
  if (missing.length) { failures.push(`${CORE_REL} lacks exports: ${missing.join(', ')}`); return null; }
  return core;
}
// A core error: an Error with an own string code and a message that starts with "<CODE>: " (plan 3.9). `message` is the whole message.
async function expectErr(check, label, fn, message) {
  const r = await attempt(fn);
  if (!r.threw) { check(false, `${label}: expected ${codeOf(message)}, got a result`, r.value); return null; }
  const e = r.error;
  check(e instanceof Error, `${label}: an Error instance`, e && e.constructor && e.constructor.name);
  check(hasOwn(e, 'code') && typeof e.code === 'string', `${label}: an own string code`, e && e.code);
  check(e && e.code === codeOf(message), `${label}: code ${codeOf(message)}`, { code: e && e.code, message: e && e.message });
  check(e && e.message === message, `${label}: message is exactly ${show(message)}`, e && e.message);
  return e;
}

// ===================================================== the execute seam ====
// A fake executor that answers by recognizing the pinned operation vectors (plan 3.3-3.6). It records every call exactly as the core made it, so tests
// compare complete argv arrays, the cwd, the environment and the limit. Nothing here is taken from the code under test.
const fakeOid = (s) => sha1(`c4-fake:${s}`);
const OID_BLOB = 'a6b681bf44990ef08933f24aa3102b9ac8f2c194';
const okRes = (stdout, status = 0) => ({ status, signal: null, error: null, stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(String(stdout), 'utf8'), overflow: false });
const asRes = (x) => (Buffer.isBuffer(x) || typeof x === 'string' ? okRes(x) : x);
// Tree records (plan 3.5): an entry is a path string (a regular file) or { path, mode, type, oid }.
function treeBuf(entries) {
  return Buffer.from(entries.map((e) => {
    const o = typeof e === 'string' ? { path: e } : e;
    return `${o.mode || '100644'} ${o.type || 'blob'} ${o.oid || OID_BLOB}\t${o.path}\0`;
  }).join(''), 'utf8');
}
function seamPaths(context) {
  const base = path.resolve(context.tmp, 'c4-seam');
  return { root: path.join(base, 'repo'), start: path.join(base, 'start') };
}
const SEAM_ENV = {
  PATH: process.env.PATH || process.env.Path || '/usr/bin', HOME: '/seam/home', USERPROFILE: '/seam/home', GIT_CONFIG_GLOBAL: '/seam/global.gitconfig', GIT_CONFIG_SYSTEM: '/seam/system.gitconfig',
  GIT_CONFIG_NOSYSTEM: '1', GIT_TEST_ASSUME_DIFFERENT_OWNER: '1', GIT_PAGER: 'less', PAGER: 'less', GIT_EXTERNAL_DIFF: '/seam/ext-diff', GIT_DIR: '/seam/elsewhere', FOO_BAR: 'kept',
};
function makeFake(context, o = {}) {
  const paths = seamPaths(context);
  const calls = [];
  const S = { version: 'git version 2.53.0.windows.2\r\n', root: `${fwd(paths.root)}\n`, ids: {}, missing: new Set(), inv: {}, tree: [], content: Buffer.from('CONTENT\n'), mergeBase: null, handle: null, resolveOut: null, ...o };
  const execute = async (req) => {
    const call = { argv: Array.isArray(req.argv) ? req.argv.map(String) : req.argv, cwd: req.cwd, env: { ...req.env }, limit: req.limit, keys: Object.keys(req) };
    calls.push(call);
    const op = call.argv.slice(PREFIX.length);
    call.op = op; call.kind = kindOf(op); call.prefixOk = eq(call.argv.slice(0, PREFIX.length), PREFIX);
    if (S.handle) {
      const r = await S.handle(call.kind, op, call, calls.length - 1);
      if (r !== undefined) return r !== null && typeof r === 'object' && hasOwn(r, '__raw') ? r.__raw : asRes(r); // { __raw: v } hands v to the core verbatim, also a string
    }
    const pick = (v) => { const x = typeof v === 'function' ? v(op, call) : v; return asRes(x === undefined || x === null ? EMPTY : x); };
    switch (call.kind) {
      case 'version': return pick(S.version);
      case 'root': return pick(S.root);
      case 'resolve': {
        const sp = op[4].slice(0, -'^{commit}'.length);
        if (S.missing.has(sp)) return { status: 1, signal: null, error: null, stdout: EMPTY, overflow: false };
        if (S.resolveOut) return pick(S.resolveOut(sp));
        return okRes(`${S.ids[sp] || fakeOid(sp)}\n`);
      }
      case 'mergeBase': return pick(S.mergeBase !== null ? S.mergeBase : `${fakeOid(`merge-base:${op[1]}:${op[2]}`)}\n`);
      case 'invDiff': return pick(S.inv.diff);
      case 'invShow': return pick(S.inv.show);
      case 'invLog': return pick(S.inv.log);
      case 'invTree': return pick(S.inv.tree !== undefined ? S.inv.tree : treeBuf(S.tree));
      case 'content': return pick(S.content);
      default: return { status: 127, signal: null, error: null, stdout: EMPTY, overflow: false };
    }
  };
  return { execute, calls, S, paths, ops: () => calls.slice(2).map((c) => c.op), kinds: () => calls.map((c) => c.kind) };
}
const DEFAULT_POLICY = { schema: 2, patterns: [{ anchor: 'any', glob: '**/.env*' }], projectPatterns: [{ anchor: 'root', glob: 'private/**' }] };
const pol2 = (patterns, projectPatterns = []) => ({ schema: 2, patterns, projectPatterns });
// Runs main with the seams. o.world configures the fake; o.policy / o.policyText / o.policyBuf the installed policy; o.fake reuses a fake.
async function seamMain(core, context, argv, o = {}) {
  const fake = o.fake || makeFake(context, o.world || {});
  const reads = [];
  const policyBuf = o.policyBuf !== undefined ? o.policyBuf : bytes(typeof o.policyText === 'string' ? o.policyText : jsonText(o.policy !== undefined ? o.policy : DEFAULT_POLICY));
  const readFile = o.readFile || (async (p) => { reads.push(p); return policyBuf; });
  const deps = { cwd: fake.paths.start, env: o.env || SEAM_ENV, execute: fake.execute, readFile };
  const r = await core.main(argv, deps);
  return { r, fake, reads, ops: fake.ops() };
}
// main's exact result (plan 2.5, 3.9): { exitCode, stdout: Buffer, stderr: string }.
function expectMain(check, label, r, { exit, stdout = EMPTY, stderr = '' }) {
  check(r !== null && typeof r === 'object' && eq(sorted(Object.keys(r)), ['exitCode', 'stderr', 'stdout']), `${label}: the result holds exactly exitCode, stdout, stderr`, r && Object.keys(r));
  if (!r) return;
  check(r.exitCode === exit, `${label}: exit code ${exit}`, r.exitCode);
  check(Buffer.isBuffer(r.stdout) && sameBuf(r.stdout, bytes(stdout)), `${label}: stdout is exactly the expected bytes`, { got: r.stdout && r.stdout.length, want: bytes(stdout).length, head: Buffer.isBuffer(r.stdout) ? r.stdout.subarray(0, 160) : r.stdout });
  check(typeof r.stderr === 'string' && r.stderr === stderr, `${label}: stderr is exactly ${show(stderr.slice(0, 200))}`, r.stderr);
}
const failMain = (message) => ({ exit: 2, stdout: EMPTY, stderr: stderrLine(message) });
// The session calls: version then root, both with the starting cwd; every later call has the normalized root as cwd; every call has the exact prefix, the exact keys,
// the sanitized environment and its limit by kind (plan 2.5, 3.3, 3.4, 3.8). Returns the operation vectors after them.
function checkCalls(check, label, fake, { env = SEAM_ENV, session = true } = {}) {
  const calls = fake.calls;
  const wantEnv = entriesOf(expectedEnv(env));
  const rootCwd = path.resolve(fwd(fake.paths.root));
  const startCwd = path.resolve(fake.paths.start);
  calls.forEach((c, i) => {
    check(c.prefixOk, `${label}: call ${i} (${c.kind}) starts with the exact fixed prefix P`, c.argv && c.argv.slice(0, 6));
    check(eq(sorted(c.keys), ['argv', 'cwd', 'env', 'limit']), `${label}: call ${i} receives exactly argv, cwd, env, limit`, c.keys);
    check(eq(entriesOf(c.env), wantEnv), `${label}: call ${i} receives the sanitized environment`, c.env && Object.keys(c.env).sort());
    // PLAN-GAP: 3.8 pins limit null for version, root, resolution and inventory calls and the output limit for content calls; merge-base is metadata but not named, so either value is accepted for it.
    const wantLimit = c.kind === 'content' ? MAX_BYTES : null;
    check(c.kind === 'mergeBase' ? c.limit === null || c.limit === MAX_BYTES : c.limit === wantLimit, `${label}: call ${i} (${c.kind}) has limit ${wantLimit}`, c.limit);
    if (session && i < 2) check(c.cwd === startCwd, `${label}: call ${i} runs in the starting cwd`, c.cwd);
    else check(c.cwd === rootCwd, `${label}: call ${i} (${c.kind}) runs in the normalized root`, c.cwd);
  });
  if (session) {
    check(calls[0] && eq(calls[0].op, V_VERSION), `${label}: the first call is --version`, calls[0] && calls[0].op);
    check(calls[1] && eq(calls[1].op, V_ROOT), `${label}: the second call is rev-parse --show-toplevel`, calls[1] && calls[1].op);
  }
}
// Complete operation vectors, in order, after the two session calls.
function checkOps(check, label, fake, expected, o = {}) {
  checkCalls(check, label, fake, o);
  const got = fake.ops();
  check(eq(got, expected), `${label}: the exact operation vectors`, { got: got.map((g) => g.slice(0, 14)), want: expected.map((g) => g.slice(0, 14)) });
}
// Revisions as the world resolves them: the resolved ID of a spelling.
const rid = (sp) => fakeOid(sp);

// ============================================================= real Git ====
function gitRun(context, cwd, args, { input, env } = {}) {
  const r = spawnSync('git', args, { cwd, env: env || context.env, input, encoding: 'buffer', shell: false, windowsHide: true, timeout: 120000, maxBuffer: 1 << 28 });
  const out = r.stdout || EMPTY;
  return { code: r.status, out, err: r.stderr || EMPTY, text: out.toString('utf8').trim(), error: r.error || null };
}
const gitOk = (context, cwd, args, o) => { const r = gitRun(context, cwd, args, o); if (r.code !== 0) throw new Error(`git ${args.slice(0, 3).join(' ')} failed (${r.code}): ${r.err.toString('utf8').slice(0, 200)}`); return r; };
// git fast-import stream (one process builds a whole repository). Paths are always C-style quoted; a file is a string/Buffer, { mode: '120000', content },
// or { mode: '160000', sha }. Every commit lists its complete tree (deleteall first), so a tree is exactly what the test says.
const qpath = (p) => {
  let out = '"';
  for (const b of Buffer.from(p, 'utf8')) {
    if (b === 0x22) out += '\\"';
    else if (b === 0x5c) out += '\\\\';
    else if (b === 0x0a) out += '\\n';
    else if (b === 0x09) out += '\\t';
    else if (b >= 0x20 && b < 0x7f) out += String.fromCharCode(b);
    else out += `\\${b.toString(8).padStart(3, '0')}`;
  }
  return `${out}"`;
};
const fiData = (buf) => [Buffer.from(`data ${buf.length}\n`), buf, Buffer.from('\n')];
function fiStream(commits) {
  const marks = new Map();
  const parts = [];
  commits.forEach((c, i) => {
    marks.set(c.ref, i + 1);
    parts.push(Buffer.from(`commit refs/heads/${c.ref}\nmark :${i + 1}\nauthor Fixture <fixture@example.invalid> ${c.when} +0000\ncommitter Fixture <fixture@example.invalid> ${c.when} +0000\n`));
    parts.push(...fiData(Buffer.from(c.message)));
    const parents = (c.parents || []).map((p) => { if (!marks.has(p)) throw new Error(`fixture parent ${p} is not defined before ${c.ref}`); return marks.get(p); });
    if (parents.length) { parts.push(Buffer.from(`from :${parents[0]}\n`)); for (const m of parents.slice(1)) parts.push(Buffer.from(`merge :${m}\n`)); }
    parts.push(Buffer.from('deleteall\n'));
    for (const [p, v] of Object.entries(c.files)) {
      if (v && typeof v === 'object' && !Buffer.isBuffer(v)) {
        if (v.mode === '160000') parts.push(Buffer.from(`M 160000 ${v.sha} ${qpath(p)}\n`));
        else { parts.push(Buffer.from(`M ${v.mode} inline ${qpath(p)}\n`)); parts.push(...fiData(Buffer.from(v.content))); }
      } else { parts.push(Buffer.from(`M 100644 inline ${qpath(p)}\n`)); parts.push(...fiData(Buffer.isBuffer(v) ? v : Buffer.from(String(v)))); }
    }
    parts.push(Buffer.from('\n'));
  });
  return Buffer.concat(parts);
}
// The expected text of the "safe change" commit (plan 4.6): S metadata, tree path and the independently computed blob prefixes.
const blob7 = (content) => sha1(Buffer.concat([Buffer.from(`blob ${Buffer.byteLength(content)}\0`), Buffer.from(content)])).slice(0, 7);
const safeChangeText = (sid, file) => [
  `commit ${sid}`, 'Author: Fixture <fixture@example.invalid>', 'Date:   Tue Nov 14 22:13:20 2023 +0000', '', '    safe change', '',
  `diff --git a/${file} b/${file}`, `index ${blob7('before\n')}..${blob7('after\n')} 100644`, `--- a/${file}`, `+++ b/${file}`, '@@ -1 +1 @@', '-before', '+after', '',
].join('\n');
const MARK = { env: 'C4-DUMMY-ENV-SECRET', priv: 'C4-DUMMY-PRIVATE-SECRET' };
const GITLINK_SHA = '1111111111111111111111111111111111111111';
const BIN_BYTES = Buffer.from([0x00, 0x01, 0x02, 0xff, 0x00, 0x0a, 0x00]);
// Every repository the real-Git assertions use, in one fast-import stream. Refs are plain branch names; `main` is not created, HEAD points at c4-head.
function fxCommits() {
  const names = {};
  for (const [, p] of NAME_ROWS) names[p] = 'needle\n';
  const headFiles = {
    ...names, 'src/a.txt': 'src-needle\n', '.env': `${MARK.env}\n`, 'private/token.txt': `${MARK.priv}\n`, 'nested/private/token.txt': 'nested-visible\n', 'empty.txt': '', 'bin.dat': BIN_BYTES,
    'binneedle.dat': Buffer.from('needle\0\x01\n'), 'dir/inner.txt': 'dir-needle\n', 'Case.txt': 'upper\n', 'case.txt': 'lower\n',
    link: { mode: '120000', content: 'safe.txt' }, sub: { mode: '160000', sha: GITLINK_SHA },
  };
  const tenLines = Array.from({ length: 10 }, (_, i) => `shared line ${i + 1}\n`).join('');
  const commits = [];
  const add = (ref, when, message, parents, files) => commits.push({ ref, when, message, parents, files });
  add('c4-base', 1699990000, 'base\n', [], { 'safe.txt': 'base\n', 'src/a.txt': 'a-base\n' });
  add('c4-head', 1699990100, 'head\n', ['c4-base'], headFiles);
  // R42: the listing and grep tree of plan 4.5, and the regular-expression tree.
  add('lsgrep', 1699990200, 'ls and grep\n', [], { '.env': 'C4-DUMMY-LS-ENV needle\n', 'private/key.txt': 'C4-DUMMY-LS-KEY needle\n', 'safe.txt': 'needle\n', 'src/a.txt': 'needle\n' });
  add('rx', 1699990300, 'regular expressions\n', [], { 'rx.txt': 'a|b literal\nonly-b\n', 'neg.txt': '-needle here\n', 'dd.txt': 'a -- b\n' });
  // R43 count regression 1 (all protected): A -> B -> C.
  add('cnt1-a', 1699991000, 'a\n', [], { 'README.md': 'readme\n' });
  add('cnt1-b', 1699991100, 'b\n', ['cnt1-a'], { 'README.md': 'readme\n', 'private/older.txt': 'C4-DUMMY-OLDER\n' });
  add('cnt1-c', 1699991200, 'c\n', ['cnt1-b'], { 'README.md': 'readme\n', 'private/older.txt': 'C4-DUMMY-OLDER\n', 'private/newer.txt': 'C4-DUMMY-NEWER\n' });
  // R43 count regression 2 (an older safe change): A -> S -> B -> C, S with the pinned metadata.
  add('cnt2-a', 1699999000, 'a\n', [], { 'safe.txt': 'before\n' });
  add('cnt2-s', 1700000000, 'safe change\n', ['cnt2-a'], { 'safe.txt': 'after\n' });
  add('cnt2-b', 1700000100, 'b\n', ['cnt2-s'], { 'safe.txt': 'after\n', 'private/older.txt': 'C4-DUMMY-OLDER\n' });
  add('cnt2-c', 1700000200, 'c\n', ['cnt2-b'], { 'safe.txt': 'after\n', 'private/older.txt': 'C4-DUMMY-OLDER\n', 'private/newer.txt': 'C4-DUMMY-NEWER\n' });
  // R43 path-limited merge history: M's parents are [V, P2]; V's tree equals S, M's tree equals P2.
  const S3 = { 'src/safe.txt': 'after\n' };
  add('mh-a', 1699999000, 'base\n', [], { 'src/safe.txt': 'before\n' });
  add('mh-s', 1700000000, 'safe change\n', ['mh-a'], S3);
  add('mh-u', 1700000100, 'add hidden\n', ['mh-s'], { ...S3, 'src/hidden.pem': 'C4-DUMMY-HIDDEN-PEM\n' });
  add('mh-v', 1700000200, 'remove hidden\n', ['mh-u'], { ...S3 });
  add('mh-p2', 1700000300, 'add current\n', ['mh-s'], { ...S3, 'src/current.pem': 'C4-DUMMY-CURRENT-PEM\n' });
  add('mh-m', 1700000400, 'merge\n', ['mh-v', 'mh-p2'], { ...S3, 'src/current.pem': 'C4-DUMMY-CURRENT-PEM\n' });
  // R43 history coverage: addition, modification and deletion of protected files, a root commit, a protected-only commit.
  add('hx0', 1700001000, 'root\n', [], { 'safe.txt': 's0\n', 'private/mod.txt': 'C4-DUMMY-MOD0\n', 'private/del.txt': 'C4-DUMMY-DEL0\n', '.env': 'C4-DUMMY-HX-ENV\n' });
  add('hx1', 1700001100, 'one\n', ['hx0'], { 'safe.txt': 's1\n', 'private/mod.txt': 'C4-DUMMY-MOD1\n', 'private/add.txt': 'C4-DUMMY-ADD1\n', '.env': 'C4-DUMMY-HX-ENV\n' });
  add('hx2', 1700001200, 'two\n', ['hx1'], { 'safe.txt': 's2\n', 'private/mod.txt': 'C4-DUMMY-MOD1\n', '.env': 'C4-DUMMY-HX-ENV\n' });
  add('hx3', 1700001300, 'protected only\n', ['hx2'], { 'safe.txt': 's2\n', 'private/mod.txt': 'C4-DUMMY-MOD3\n', '.env': 'C4-DUMMY-HX-ENV\n' });
  // A merge whose protected file differs from both parents.
  add('mg0', 1700002000, 'base\n', [], { 'safe.txt': 's\n', 'private/a.txt': 'C4-DUMMY-A0\n' });
  add('mg1', 1700002100, 'one\n', ['mg0'], { 'safe.txt': 's\n', 'private/a.txt': 'C4-DUMMY-A1\n', 'p1.txt': 'p1\n' });
  add('mg2', 1700002200, 'two\n', ['mg0'], { 'safe.txt': 's\n', 'private/a.txt': 'C4-DUMMY-A2\n', 'p2.txt': 'p2\n' });
  add('mgm', 1700002300, 'merge\n', ['mg1', 'mg2'], { 'safe.txt': 's\n', 'private/a.txt': 'C4-DUMMY-AM\n', 'p1.txt': 'p1\n', 'p2.txt': 'p2\n' });
  // A protected file name that later becomes a directory.
  add('dl0', 1700003000, 'zero\n', [], { 'safe.txt': 's\n' });
  add('dl1', 1700003100, 'file\n', ['dl0'], { 'safe.txt': 's\n', secret: 'C4-DUMMY-SECRETFILE\n' });
  add('dl2', 1700003200, 'directory\n', ['dl1'], { 'safe.txt': 's\n', 'secret/inner.txt': 'inner-visible\n' });
  // log.follow: a protected file renamed to a safe path with one line changed.
  add('fl0', 1700004000, 'private file\n', [], { 'private/old.txt': `C4-DUMMY-OLD-PRIVATE-LINE\n${tenLines}` });
  add('fl1', 1700004100, 'rename\n', ['fl0'], { 'safe/new.txt': `public first line\n${tenLines}` });
  // Two safe files changed together, for ordering and prefix checks.
  add('ty0', 1700005000, 'zero\n', [], { 'b.txt': 'b0\n', 'a.txt': 'a0\n' });
  add('ty1', 1700005100, 'two files\n', ['ty0'], { 'b.txt': 'b1\n', 'a.txt': 'a1\n' });
  // R47: a commit whose own policy file differs from the installed policy (it protects nothing).
  add('pol', 1700006000, 'policy commit\n', [], { '.ai/security-paths.json': jsonText(pol2([], [])), 'private/x.txt': `${MARK.priv}\n`, 'safe.txt': 'safe\n' });
  // R76 limits: two blobs at and just over the output limit.
  add('big', 1700007000, 'big blobs\n', [], { 'big-ok.bin': Buffer.alloc(1048576, 0x61), 'big-over.bin': Buffer.alloc(1048577, 0x62), 'small.txt': 'small\n' });
  return commits;
}
const FX_REFS = fxCommits().map((c) => c.ref);
// The shared real repository, built once per context.tmp: init, one fast-import, a symbolic HEAD, two tags and abbreviation 7.
const fxCache = new Map();
function getFx(context) {
  const key = context.tmp;
  if (!fxCache.has(key)) {
    fxCache.set(key, Promise.resolve().then(() => {
      const dir = scratchDir(context, 'fx');
      const root = path.join(dir, 'repo');
      fs.mkdirSync(root);
      gitOk(context, root, ['init', '-q']);
      gitOk(context, root, ['config', 'core.abbrev', '7']);
      // Objects that differ only by case need core.ignorecase=false while they are written; the repository then reads as a Windows checkout would (ignorecase on).
      gitOk(context, root, ['-c', 'core.protectNTFS=false', '-c', 'core.ignorecase=false', 'fast-import', '--quiet'], { input: fiStream(fxCommits()) });
      gitOk(context, root, ['config', 'core.ignorecase', 'true']);
      gitOk(context, root, ['symbolic-ref', 'HEAD', 'refs/heads/c4-head']);
      const ids = {};
      const refs = gitOk(context, root, ['for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads']).text.split('\n');
      for (const l of refs) { const [r, o] = l.split(' '); ids[r] = o; }
      gitOk(context, root, ['tag', 'lt-tag', ids['c4-base']]);
      gitOk(context, root, ['tag', '-a', 'at-tag', '-m', 'annotated', ids['c4-head']]);
      gitOk(context, root, ['tag', 'v1.2', ids['c4-base']]);
      gitOk(context, root, ['tag', 'v1.3', ids['c4-head']]);
      ids['at-tag-object'] = gitOk(context, root, ['rev-parse', 'at-tag']).text;
      return { dir, root, ids, realRoot: fs.realpathSync.native(root) };
    }));
  }
  return fxCache.get(key);
}
async function useFx(failures, context) {
  try { return await getFx(context); } catch (e) { failures.push(`cannot build the real Git fixture: ${errMsg(e)}`); return null; }
}
// A seam executor that runs the real Git with the request the core made, and records it (argv, cwd, limit, status, stdout).
function realExecutor(log = null) {
  return async (req) => {
    const r = spawnSync('git', req.argv, { cwd: req.cwd, env: req.env, encoding: 'buffer', shell: false, windowsHide: true, maxBuffer: 1 << 29, timeout: 120000 });
    let result;
    if (r.error) result = { status: null, signal: null, error: String(r.error.code || r.error.message || 'error'), stdout: EMPTY, overflow: false };
    else if (r.signal) result = { status: null, signal: String(r.signal), error: null, stdout: EMPTY, overflow: false };
    else if (req.limit !== null && r.stdout.length > req.limit) result = { status: null, signal: null, error: null, stdout: r.stdout.subarray(0, req.limit), overflow: true };
    else result = { status: r.status, signal: null, error: null, stdout: r.stdout, overflow: false };
    if (log) log.push({ argv: req.argv, op: req.argv.slice(PREFIX.length), cwd: req.cwd, limit: req.limit, status: r.status, stdout: result.stdout, stderr: r.stderr });
    return result;
  };
}
// A session over the shared repository with a recorder. `reset()` forgets everything after the two session calls.
async function openReal(core, context, fx, policy, o = {}) {
  const log = [];
  const policyBuf = bytes(typeof policy === 'string' ? policy : jsonText(policy));
  const session = await core.createGitSession({ cwd: o.cwd || fx.root, env: o.env || context.env, execute: realExecutor(log), readFile: async () => policyBuf });
  const h = { session, log, reset: () => { log.length = 2; }, ops: () => log.slice(2).map((l) => l.op), kinds: () => log.slice(2).map((l) => kindOf(l.op)) };
  h.run = async (argv) => { h.reset(); const req = core.parseGitSafeArgs(argv); return core.executeGitSafe(req, session); };
  h.attempt = async (argv) => attempt(() => h.run(argv));
  return h;
}
const rev = (fx, ref) => fx.ids[ref];

// ========================================================== environments ====
// A fixture-owned global Git configuration: the harness configuration plus extra text, selected through GIT_CONFIG_GLOBAL (never $HOME/.gitconfig).
let cfgSeq = 0;
const cfgVal = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
function isoEnv(context, extraConfig = '', extraEnv = {}) {
  const base = readText(context.env.GIT_CONFIG_GLOBAL) || '[user]\n\tname = Fixture\n\temail = fixture@example.invalid\n';
  const file = path.join(context.tmp, `c4-cfg-${++cfgSeq}.gitconfig`);
  fs.mkdirSync(context.tmp, { recursive: true });
  fs.writeFileSync(file, `${base}\n${extraConfig}\n`);
  return { ...context.env, GIT_CONFIG_GLOBAL: file, GIT_CONFIG_NOSYSTEM: '1', ...extraEnv };
}
const PL = pol2([{ anchor: 'any', glob: '**/.env*' }], [{ anchor: 'root', glob: 'private/**' }]);

// ================================================== R41/C4/cat ====
// Plan 3.6 (cat), 4.4: committed blob bytes, secret refusals before resolution, aliases, links, gitlinks, the recorded argv.
async function catGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    const fx = await useFx(failures, context);
    if (!core || !fx) return;
    const head = rev(fx, 'c4-head');
    const h = await openReal(core, context, fx, PL);
    await step('real Git: cat returns exactly the committed bytes; a dirty worktree copy does not change them; the recorded vectors are the resolution and the pinned cat-file', async () => {
      const out = await h.attempt(['cat', 'c4-head', '--', 'safe.txt']);
      check(!out.threw && sameBuf(out.value, Buffer.from('needle\n')), 'committed bytes of safe.txt', out.threw ? errMsg(out.error) : out.value);
      check(eq(h.ops(), [V_RESOLVE('c4-head'), V_CAT(head, 'safe.txt')]), 'the argv is the resolution of the revision, then cat-file blob <resolved id>:<path> (plan 3.6)', h.ops());
      check(h.log.slice(2).every((l) => eq(l.argv.slice(0, PREFIX.length), PREFIX)), 'every call carries the exact fixed prefix');
      check(h.log[3] && h.log[3].limit === MAX_BYTES && h.log[2] && h.log[2].limit === null, 'resolution has no limit; cat-file has the output limit', h.log.slice(2).map((l) => l.limit));
      putFile(path.join(fx.root, 'safe.txt'), 'DIRTY WORKTREE VERSION\n');
      const dirty = await h.attempt(['cat', 'c4-head', '--', 'safe.txt']);
      check(!dirty.threw && sameBuf(dirty.value, Buffer.from('needle\n')), 'a dirty worktree version of the file does not replace the committed bytes', dirty.threw ? errMsg(dirty.error) : dirty.value);
    });
    await step('real Git: an empty blob, a binary blob with NUL and a symlink (its link text, not its target)', async () => {
      const empty = await h.attempt(['cat', 'c4-head', '--', 'empty.txt']);
      check(!empty.threw && Buffer.isBuffer(empty.value) && empty.value.length === 0, 'an empty blob returns zero bytes', empty.threw ? errMsg(empty.error) : empty.value);
      const bin = await h.attempt(['cat', 'c4-head', '--', 'bin.dat']);
      check(!bin.threw && sameBuf(bin.value, BIN_BYTES), 'a binary blob including NUL is returned unchanged', bin.threw ? errMsg(bin.error) : bin.value);
      const link = await h.attempt(['cat', 'c4-head', '--', 'link']);
      check(!link.threw && sameBuf(link.value, Buffer.from('safe.txt')), 'a symlink returns its link-text blob and is not followed', link.threw ? errMsg(link.error) : link.value);
      const nested = await h.attempt(['cat', 'c4-head', '--', 'nested/private/token.txt']);
      check(!nested.threw && sameBuf(nested.value, Buffer.from('nested-visible\n')), 'a root-anchored entry leaves nested/private visible', nested.threw ? errMsg(nested.error) : nested.value);
    });
    await step('real Git: a missing path, a directory and a gitlink are GIT_SAFE_GIT', async () => {
      for (const p of ['no-such-file.txt', 'dir', 'sub']) {
        const r = await h.attempt(['cat', 'c4-head', '--', p]);
        check(r.threw && r.error.code === 'GIT_SAFE_GIT' && r.error.message === E.GIT, `${p}: GIT_SAFE_GIT`, r.threw ? r.error.message : r.value);
      }
    });
    await step('a protected path is GIT_SAFE_SECRET before any revision resolution or cat-file call, for exact, case and adopted Windows alias spellings', async () => {
      const paths = ['.env', 'private/token.txt', 'PRIVATE/TOKEN.TXT', '.ENV', 'nested/.env.local', '.env.', '.env ', '.env::$DATA', 'Private/Token.txt'];
      for (const p of paths) {
        const r = await h.attempt(['cat', 'c4-head', '--', p]);
        check(r.threw && r.error.code === 'GIT_SAFE_SECRET' && r.error.message === E.SECRET, `${show(p)} is refused with the secret error`, r.threw ? r.error.message : r.value);
        check(h.log.length === 2, `${show(p)}: no Git call followed the policy check`, h.ops());
      }
      // the same through main and the seams: exit 2, empty stdout, the exact line; one policy read, no call after the session
      for (const p of paths) {
        const s = await seamMain(core, context, ['cat', 'c4-head', '--', p]);
        expectMain(check, `main cat ${show(p)}`, s.r, failMain(E.SECRET));
        check(s.fake.calls.length === 2 && s.reads.length === 1, `main cat ${show(p)}: only the version and root calls, one policy read`, { calls: s.fake.calls.length, reads: s.reads.length });
      }
    });
    await step('seam: cat issues the pinned vectors after the resolved commit, returns the bytes unchanged (NUL, CRLF, invalid UTF-8) and exits 0, also for an empty blob', async () => {
      const raw = Buffer.from([0x61, 0x00, 0x0d, 0x0a, 0xc3, 0x28, 0xff, 0x0a]);
      for (const [label, content] of [['bytes', raw], ['empty', EMPTY]]) {
        const s = await seamMain(core, context, ['cat', 'c4-head', '--', 'safe.txt'], { world: { content } });
        expectMain(check, `cat ${label}`, s.r, { exit: 0, stdout: content });
        checkOps(check, `cat ${label}`, s.fake, [V_RESOLVE('c4-head'), V_CAT(rid('c4-head'), 'safe.txt')]);
        check(eq(s.reads, [path.join(s.fake.paths.root, '.ai', 'security-paths.json')]), `cat ${label}: the policy is read once from the native root path`, s.reads);
      }
      // the original case is looked up as written, never lowercased
      const s = await seamMain(core, context, ['cat', 'c4-head', '--', 'MixedCase.txt']);
      check(eq(s.ops, [V_RESOLVE('c4-head'), V_CAT(rid('c4-head'), 'MixedCase.txt')]), 'an unprotected MixedCase.txt is looked up with its original case', s.ops);
    });
    await step('caller object syntax is refused before every Git call (and before the policy read)', async () => {
      for (const argv of [['cat', 'HEAD:.env', '--', 'safe.txt'], ['cat', ':.env', '--', 'safe.txt'], ['cat', 'HEAD^{tree}', '--', 'safe.txt'], ['cat', 'HEAD@{1}', '--', 'safe.txt'], ['cat', 'c4-head:safe.txt'], ['show', 'HEAD:.env'], ['cat', '--', 'safe.txt']]) {
        const s = await seamMain(core, context, argv);
        expectMain(check, `main ${argv.join(' ')}`, s.r, failMain(E.ARGUMENT(argv[0])));
        check(s.fake.calls.length === 0 && s.reads.length === 0, `main ${argv.join(' ')}: no executor call and no policy read`, { calls: s.fake.calls.length, reads: s.reads.length });
      }
    });
    await step('real Git through main: stdout is the committed bytes, stderr empty, exit 0', async () => {
      const r = await core.main(['cat', 'c4-head', '--', 'safe.txt'], { cwd: fx.root, env: context.env, readFile: async () => bytes(jsonText(PL)) });
      expectMain(check, 'main cat', r, { exit: 0, stdout: 'needle\n' });
    });
  });
}

// ================================================== R42/C4/ls ====
// Plan 3.5 (ls and grep inventory), 3.6 (ls), 4.5.
async function lsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    const fx = await useFx(failures, context);
    if (!core || !fx) return;
    const C = rev(fx, 'lsgrep');
    const h = await openReal(core, context, fx, PL);
    const ls = async (...argv) => { const r = await h.attempt(['ls', ...argv]); return r.threw ? `THREW ${errMsg(r.error)}` : r.value; };
    await step('real Git: the exact listings, selectors, duplicates, misses and protected-only selections', async () => {
      check(sameBuf(await ls(C), Buffer.from('safe.txt\0src/a.txt\0')), 'ls C lists exactly the unprotected names, each followed by one NUL');
      check(eq(h.ops(), [V_RESOLVE(C), V_INV_TREE(C)]), 'ls resolves the commit and runs one recursive tree inventory; there is no content call', h.ops());
      check(sameBuf(await ls(C, '--', 'src'), Buffer.from('src/a.txt\0')), 'a directory selector lists its descendants');
      check(sameBuf(await ls(C, '--', 'safe.txt'), Buffer.from('safe.txt\0')), 'an exact-file selector lists that file');
      check(sameBuf(await ls(C, '--', 'src', 'src'), Buffer.from('src/a.txt\0')), 'duplicate selectors list a path once');
      check(sameBuf(await ls(C, '--', 'no-such'), EMPTY), 'a missing selector selects nothing (zero bytes)');
      check(sameBuf(await ls(C, '--', 'private'), EMPTY) && sameBuf(await ls(C, '--', '.env'), EMPTY), 'a protected-only selection returns zero bytes');
    });
    await step('real Git: literal wildcard names and magic-looking names are never interpreted', async () => {
      const head = rev(fx, 'c4-head');
      check(sameBuf(await ls(head, '--', 'a*b.txt'), Buffer.from('a*b.txt\0')), 'a literal wildcard name selects exactly that name');
      check(sameBuf(await ls(head, '--', '*.txt'), EMPTY), 'a selector *.txt is a literal name: nothing matches it');
      check(sameBuf(await ls(head, '--', ':(glob)literal.txt'), Buffer.from(':(glob)literal.txt\0')), 'a selector beginning with : is a literal name');
      check(sameBuf(await ls(head, '--', ':(glob)*.txt'), EMPTY), 'a magic-looking selector with a wildcard matches nothing');
      check(sameBuf(await ls(head, '--', '-dash.txt'), Buffer.from('-dash.txt\0')), 'a leading-dash selector is a plain path after the separator');
      // PLAN-GAP: 3.6 says ls returns the selected unprotected paths of the tree inventory; that symlink and gitlink entries are listed is the reading of 'accept exactly these mode/type pairs'.
      const all = await ls(head);
      const want = byUtf8(['-dash.txt', ':(glob)literal.txt', 'Case.txt', 'MixedCase.txt', 'a*b.txt', 'bin.dat', 'binneedle.dat', 'case.txt', 'dir/inner.txt', 'docs/r\u00e9sum\u00e9.txt', 'empty.txt', 'line\nname.txt', 'link', 'nested/private/token.txt', 'safe.txt', 'space name.txt', 'src/a.txt', 'sub', 'tab\tname.txt']);
      check(sameBuf(all, nul(want)), 'the full listing of the names tree: protected .env and private/ omitted, every other entry (symlink and gitlink included) once, UTF-8 byte order', Buffer.isBuffer(all) ? all.toString('utf8') : all);
    });
    await step('seam: a protected-only selection and an empty tree exit 0 with zero bytes and make no content call', async () => {
      const w = { tree: ['.env', 'private/k', 'safe.txt', 'src/a.txt'] };
      const s = await seamMain(core, context, ['ls', 'c4-head', '--', 'private'], { world: w });
      expectMain(check, 'main ls (protected-only)', s.r, { exit: 0, stdout: EMPTY });
      checkOps(check, 'ls protected-only', s.fake, [V_RESOLVE('c4-head'), V_INV_TREE(rid('c4-head'))]);
      const e = await seamMain(core, context, ['ls', 'c4-head'], { world: { tree: [] } });
      expectMain(check, 'main ls (empty tree)', e.r, { exit: 0, stdout: EMPTY });
      const a = await seamMain(core, context, ['ls', 'c4-head'], { world: w });
      expectMain(check, 'main ls (mixed)', a.r, { exit: 0, stdout: 'safe.txt\0src/a.txt\0' });
      const tree = ['safe.txt', 'src/a.txt', 'srcx/b.txt', 'private/k'];
      const un = await seamMain(core, context, ['ls', 'c4-head', '--', 'src/a.txt', 'sr', 'safe.txt', 'safe.txt', 'private/k'], { world: { tree } });
      expectMain(check, 'ls with an exact file under a directory, a non-boundary prefix, a duplicate and a protected selector', un.r, { exit: 0, stdout: 'safe.txt\0src/a.txt\0' });
      const pre = await seamMain(core, context, ['ls', 'c4-head', '--', 'sr'], { world: { tree } });
      expectMain(check, 'a selector is a path prefix on a component boundary only (sr does not select src/a.txt or srcx/b.txt)', pre.r, { exit: 0, stdout: EMPTY });
      const dir = await seamMain(core, context, ['ls', 'c4-head', '--', 'src', 'srcx'], { world: { tree } });
      expectMain(check, 'several directory selectors list the union, sorted', dir.r, { exit: 0, stdout: 'src/a.txt\0srcx/b.txt\0' });
    });
  });
}

// ================================================== R42/C4/grep ====
// Plan 3.5, 3.6 (grep), 4.5.
async function grepGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    const fx = await useFx(failures, context);
    if (!core || !fx) return;
    const C = rev(fx, 'lsgrep');
    const RX = rev(fx, 'rx');
    const h = await openReal(core, context, fx, PL);
    const grep = async (...argv) => { const r = await h.attempt(['grep', ...argv]); return r.threw ? `THREW ${errMsg(r.error)}` : r.value; };
    await step('real Git: the pinned NUL framing, the empty pattern, a leading-dash pattern and the pattern --', async () => {
      check(sameBuf(await grep(C, 'needle', '--', 'safe.txt'), Buffer.from(`${C}:safe.txt\0` + '1\0' + 'needle\n')), 'a matching safe file returns <commit>:<path> NUL <line> NUL <text> LF exactly');
      check(eq(h.ops(), [V_RESOLVE(C), V_INV_TREE(C), V_GREP('needle', C, [LIT('safe.txt')], [])]), 'the vectors: resolution, one tree inventory, the pinned grep with -e, the resolved ID and the separator', h.ops());
      const both = Buffer.from(`${C}:safe.txt\0` + '1\0' + 'needle\n' + `${C}:src/a.txt\0` + '1\0' + 'needle\n');
      check(sameBuf(await grep(C, 'needle'), both), 'with no selector every unprotected match is returned and no protected file content appears (the protected files also contain the pattern)');
      check(sameBuf(await grep(C, ''), both), 'the empty pattern matches every line of the unprotected files');
      check(sameBuf(await grep(RX, '-needle'), Buffer.from(`${RX}:neg.txt\0` + '1\0' + '-needle here\n')), 'a pattern beginning with - is passed after -e');
      check(sameBuf(await grep(RX, '--'), Buffer.from(`${RX}:dd.txt\0` + '1\0' + 'a -- b\n')), 'the pattern -- without selectors searches for two hyphens');
      check(sameBuf(await grep(RX, '--', '--', 'dd.txt'), Buffer.from(`${RX}:dd.txt\0` + '1\0' + 'a -- b\n')), 'grep C -- -- dd.txt searches for -- in the literal selector dd.txt');
      check(sameBuf(await grep(RX, 'zzz-no-match'), EMPTY), 'no match is an empty successful result');
    });
    await step('real Git: basic regular expressions and the pinned framing despite extended-regexp and column configuration', async () => {
      const env = isoEnv(context, '[grep]\n\textendedRegexp = true\n\tpatternType = extended\n\tcolumn = true\n\tlineNumber = false\n');
      const hh = await openReal(core, context, fx, PL, { env });
      const r = await hh.attempt(['grep', RX, 'a|b']);
      check(!r.threw && sameBuf(r.value, Buffer.from(`${RX}:rx.txt\0` + '1\0' + 'a|b literal\n')), 'a|b is a literal in a basic expression (an extended expression would also match only-b and a -- b)', r.threw ? errMsg(r.error) : r.value);
      const r2 = await hh.attempt(['grep', C, 'needle', '--', 'safe.txt']);
      check(!r2.threw && sameBuf(r2.value, Buffer.from(`${C}:safe.txt\0` + '1\0' + 'needle\n')), 'grep.column does not add a column field', r2.threw ? errMsg(r2.error) : r2.value);
    });
    await step('real Git: binary content is omitted; an invalid expression is GIT_SAFE_GIT', async () => {
      const head = rev(fx, 'c4-head');
      check(sameBuf(await grep(head, 'needle', '--', 'binneedle.dat'), EMPTY), 'a binary file that contains the pattern is not matched (-I)');
      check(sameBuf(await grep(head, 'needle', '--', 'safe.txt', 'binneedle.dat'), Buffer.from(`${head}:safe.txt\0` + '1\0' + 'needle\n')), 'only the text match is returned when a binary file is also selected');
      const bad = await h.attempt(['grep', C, '[', '--', 'safe.txt']);
      check(bad.threw && bad.error.message === E.GIT, 'an invalid basic regular expression is GIT_SAFE_GIT', bad.threw ? bad.error.message : bad.value);
    });
    await step('seam: status 1 with empty output exits 0; status 1 with output, status 2, a signal and a spawn failure are the exact Git failure', async () => {
      const w = (content) => ({ tree: ['safe.txt'], content });
      const none = await seamMain(core, context, ['grep', 'c4-head', 'x'], { world: w({ status: 1, signal: null, error: null, stdout: EMPTY, overflow: false }) });
      expectMain(check, 'no match', none.r, { exit: 0, stdout: EMPTY });
      const bad = [
        ['status 1 with output', { status: 1, signal: null, error: null, stdout: Buffer.from('MARKER-LEAK\n'), overflow: false }],
        ['status 2', { status: 2, signal: null, error: null, stdout: Buffer.from('MARKER-LEAK\n'), overflow: false }],
        ['status 128 with empty output', { status: 128, signal: null, error: null, stdout: EMPTY, overflow: false }],
        ['a signal', { status: null, signal: 'SIGKILL', error: null, stdout: Buffer.from('MARKER-LEAK\n'), overflow: false }],
        ['a spawn failure', { status: null, signal: null, error: 'ENOENT MARKER-LEAK', stdout: EMPTY, overflow: false }],
      ];
      for (const [label, content] of bad) {
        const s = await seamMain(core, context, ['grep', 'c4-head', 'x'], { world: w(content) });
        expectMain(check, label, s.r, failMain(E.GIT));
      }
      const ok = await seamMain(core, context, ['grep', 'c4-head', 'x'], { world: w(Buffer.from(`${rid('c4-head')}:safe.txt\0` + '1\0' + 'x\n')) });
      expectMain(check, 'status 0', ok.r, { exit: 0, stdout: `${rid('c4-head')}:safe.txt\0` + '1\0' + 'x\n' });
    });
    await step('seam: an all-protected selection makes no content call; the exclusions are exactly the protected names under the selectors (all of them without selectors)', async () => {
      const tree = ['.env', 'private/k', 'safe.txt', 'src/.env', 'src/a.txt', 'src2/.env'];
      const c = rid('c4-head');
      const allProt = await seamMain(core, context, ['grep', 'c4-head', 'x'], { world: { tree: ['.env', 'private/k'] } });
      expectMain(check, 'all protected', allProt.r, { exit: 0, stdout: EMPTY });
      checkOps(check, 'all protected', allProt.fake, [V_RESOLVE('c4-head'), V_INV_TREE(c)]);
      const sel = await seamMain(core, context, ['grep', 'c4-head', 'x', '--', 'private'], { world: { tree } });
      expectMain(check, 'selected all-protected', sel.r, { exit: 0, stdout: EMPTY });
      checkOps(check, 'selected all-protected', sel.fake, [V_RESOLVE('c4-head'), V_INV_TREE(c)]);
      const whole = await seamMain(core, context, ['grep', 'c4-head', 'x'], { world: { tree } });
      checkOps(check, 'no selectors', whole.fake, [V_RESOLVE('c4-head'), V_INV_TREE(c), V_GREP('x', c, [], [EXC('.env'), EXC('private/k'), EXC('src/.env'), EXC('src2/.env')])]);
      const narrow = await seamMain(core, context, ['grep', 'c4-head', 'x', '--', 'src'], { world: { tree } });
      checkOps(check, 'selector src', narrow.fake, [V_RESOLVE('c4-head'), V_INV_TREE(c), V_GREP('x', c, [LIT('src')], [EXC('src/.env')])]);
      const two = await seamMain(core, context, ['grep', 'c4-head', 'x', '--', 'src', 'private', 'safe.txt'], { world: { tree } });
      checkOps(check, 'selectors src private safe.txt', two.fake, [V_RESOLVE('c4-head'), V_INV_TREE(c), V_GREP('x', c, [LIT('src'), LIT('private'), LIT('safe.txt')], [EXC('private/k'), EXC('src/.env')])]);
      const lit = await seamMain(core, context, ['grep', 'c4-head', '-x', '--', ':(glob)*', '--'], { world: { tree: [':(glob)*', 'z/.env'] } });
      checkOps(check, 'literal magic selector and a literal --', lit.fake, [V_RESOLVE('c4-head'), V_INV_TREE(c), V_GREP('-x', c, [LIT(':(glob)*'), LIT('--')], [])]);
    });
    await step('argument bound: hundreds of protected names outside the selector cannot make the narrowed grep exceed the limit, while the same unselected request does', async () => {
      const prot = Array.from({ length: 800 }, (_, i) => `private/${String(i).padStart(4, '0')}-${'x'.repeat(30)}.txt`);
      const tree = [...prot, 'src/a.txt', 'safe.txt'];
      const c = rid('c4-head');
      const narrow = await seamMain(core, context, ['grep', 'c4-head', 'needle', '--', 'src'], { world: { tree, content: Buffer.from('M\n') } });
      expectMain(check, 'narrowed grep', narrow.r, { exit: 0, stdout: 'M\n' });
      checkOps(check, 'narrowed grep', narrow.fake, [V_RESOLVE('c4-head'), V_INV_TREE(c), V_GREP('needle', c, [LIT('src')], [])]);
      const whole = await seamMain(core, context, ['grep', 'c4-head', 'needle'], { world: { tree, content: Buffer.from('M\n') } });
      expectMain(check, 'whole-tree grep', whole.r, failMain(E.ARG_LIMIT));
      check(whole.fake.calls.every((x) => x.kind !== 'content'), 'the oversized content call was never made', whole.fake.kinds());
    });
  });
}

// ================================================ R43/C4/history ====
// Plan 3.5 (inventories), 3.6 (content vectors), 4.6: historical secret paths, the count regressions, the path-limited merge-history regression.
const POL_PRIVATE = pol2([], [{ anchor: 'root', glob: 'private/**' }]);
const POL_PEM = pol2([], [{ anchor: 'root', glob: 'src/*.pem' }]);
const POL_HX = pol2([{ anchor: 'any', glob: '**/.env*' }], [{ anchor: 'root', glob: 'private/**' }]);
const POL_SECRET_FILE = pol2([], [{ anchor: 'root', glob: 'secret' }]);
const textOf = (b) => (Buffer.isBuffer(b) ? b.toString('utf8') : String(b));
const namesOf = (buf) => String(textOf(buf)).split('\0').filter((x) => x !== '');
async function history(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    const fx = await useFx(failures, context);
    if (!core || !fx) return;
    const id = (ref) => rev(fx, ref);
    // A real run: the result or the thrown error, with the recorded vectors.
    const noLeak = (label, out) => {
      const t = textOf(out);
      check(!/C4-DUMMY/.test(t), `${label}: no dummy marker appears in the content`, t.slice(0, 200));
      check(!/diff --git a\/(private|src\/[a-z]+\.pem)/.test(t) && !t.includes('private/'), `${label}: no protected patch header or path appears in the content`, t.slice(0, 200));
    };
    await step('count regression: an all-protected range (A -> B -> C) with -n1: one count-free inventory, no content call, empty success', async () => {
      const A = id('cnt1-a'); const C = id('cnt1-c');
      const h = await openReal(core, context, fx, POL_PRIVATE);
      const r = await h.attempt(['log', '-p', '-n1', 'cnt1-a..cnt1-c']);
      check(!r.threw && Buffer.isBuffer(r.value) && r.value.length === 0, 'the result is empty', r.threw ? errMsg(r.error) : r.value);
      const expr = `${A}..${C}`;
      check(eq(h.ops(), [V_RESOLVE('cnt1-a'), V_RESOLVE('cnt1-c'), V_INV_LOG(expr, [])]), 'exactly the two resolutions and ONE log inventory over the resolved A..C; no content call', h.ops());
      const inv = h.ops()[2] || [];
      check(inv.includes('--diff-merges=separate') && inv.includes('--full-history'), 'the inventory argv carries --diff-merges=separate and --full-history', inv);
      check(!inv.includes('-n1') && !inv.some((a) => a.startsWith('--max-count')), 'the inventory has no -n1 and no --max-count', inv);
      const names = namesOf(h.log[4] && h.log[4].stdout);
      check(names.includes('private/older.txt') && names.includes('private/newer.txt'), 'the parsed inventory names include both protected names', names);
      const log2 = [];
      const m = await core.main(['log', '-p', '-n1', 'cnt1-a..cnt1-c'], { cwd: fx.root, env: context.env, execute: realExecutor(log2), readFile: async () => bytes(jsonText(POL_PRIVATE)) });
      expectMain(check, 'main log -p -n1 A..C', m, { exit: 0, stdout: EMPTY });
      check(!log2.some((l) => kindOf(l.op) === 'content'), 'main made no content call', log2.map((l) => kindOf(l.op)));
    });
    await step('count regression: an older safe change (A -> S -> B -> C) with -n1 is returned exactly; the count applies to the content log only; both exclusions in UTF-8 order', async () => {
      const A = id('cnt2-a'); const C = id('cnt2-c'); const S = id('cnt2-s');
      const h = await openReal(core, context, fx, POL_PRIVATE);
      const r = await h.attempt(['log', '-p', '-n1', 'cnt2-a..cnt2-c']);
      const expr = `${A}..${C}`;
      check(!r.threw && textOf(r.value) === safeChangeText(S, 'safe.txt'), 'stdout is exactly the safe change commit text (no B or C header, no protected content)', r.threw ? errMsg(r.error) : textOf(r.value));
      check(eq(h.ops(), [V_RESOLVE('cnt2-a'), V_RESOLVE('cnt2-c'), V_INV_LOG(expr, []), V_LOG({ p: true, n: 1 }, expr, [], [EXC('private/newer.txt'), EXC('private/older.txt')])]), 'the inventory has no count; the content log has --max-count=1 and both exclusions in UTF-8 order', h.ops());
      check(h.log[5] && h.log[5].limit === MAX_BYTES && h.log[4] && h.log[4].limit === null, 'the inventory is unbounded metadata; the content log carries the output limit', h.log.slice(2).map((l) => l.limit));
      const log2 = [];
      const m = await core.main(['log', '-p', '-n1', 'cnt2-a..cnt2-c'], { cwd: fx.root, env: context.env, execute: realExecutor(log2), readFile: async () => bytes(jsonText(POL_PRIVATE)) });
      expectMain(check, 'main log -p -n1 A..C', m, { exit: 0, stdout: safeChangeText(S, 'safe.txt') });
    });
    await step('path-limited merge-history regression: the parent-ordered fixture, the inventory sees every protected path, the content log returns S only', async () => {
      const rp = gitRun(context, fx.root, ['rev-parse', 'mh-m^1', 'mh-m^2', 'mh-v^{tree}', 'mh-s^{tree}', 'mh-m^{tree}', 'mh-p2^{tree}']);
      const l = rp.text.split('\n');
      check(l[0] === id('mh-v') && l[1] === id('mh-p2') && l[2] === l[3] && l[4] === l[5] && l[2] !== l[4], 'fixture control: M has parents [V, P2]; V tree equals S; M tree equals P2', l);
      const A = id('mh-a'); const M = id('mh-m'); const S = id('mh-s');
      const h = await openReal(core, context, fx, POL_PEM);
      const r = await h.attempt(['log', '-p', '-n1', 'mh-a..mh-m', '--', 'src']);
      const expr = `${A}..${M}`;
      check(!r.threw && textOf(r.value) === safeChangeText(S, 'src/safe.txt'), 'stdout is exactly the S commit text with src/safe.txt (no U, V, hidden or current header)', r.threw ? errMsg(r.error) : textOf(r.value));
      check(eq(h.ops(), [V_RESOLVE('mh-a'), V_RESOLVE('mh-m'), V_INV_LOG(expr, [LIT('src')]), V_LOG({ p: true, n: 1 }, expr, [LIT('src')], [EXC('src/current.pem'), EXC('src/hidden.pem')])]), 'inventory: --diff-merges=separate, --full-history, the resolved range, -- :(literal)src and no count; content: --max-count=1, :(literal)src and both historical exclusions', h.ops());
      const names = uniq(namesOf(h.log[4] && h.log[4].stdout));
      check(eq(byUtf8(names), ['src/current.pem', 'src/hidden.pem', 'src/safe.txt']), 'the inventory names include all three paths', names);
      noLeak('merge-history content', r.threw ? '' : r.value);
      check(!textOf(r.value).includes('add hidden') && !textOf(r.value).includes('remove hidden'), 'neither the U nor the V header appears');
    });
    await step('addition, modification and deletion of protected files, two-dot and three-dot diff: the historical names are the exclusions and no marker reaches the content', async () => {
      const h = await openReal(core, context, fx, POL_HX);
      const A0 = id('hx0'); const A1 = id('hx1'); const A2 = id('hx2');
      const two = await h.attempt(['diff', 'hx0..hx2']);
      check(!two.threw && /diff --git a\/safe\.txt b\/safe\.txt/.test(textOf(two.value)), 'two-dot diff returns the safe patch', two.threw ? errMsg(two.error) : textOf(two.value).slice(0, 200));
      noLeak('two-dot diff', two.threw ? '' : two.value);
      check(eq(h.ops(), [V_RESOLVE('hx0'), V_RESOLVE('hx2'), V_INV_DIFF(A0, A2, []), V_DIFF('patch', A0, A2, [], [EXC('private/del.txt'), EXC('private/mod.txt')])]), 'two-dot diff: the deleted and the modified protected names are excluded (the unchanged .env and the never-present add.txt are not)', h.ops());
      const three = await h.attempt(['diff', 'hx0...hx2']);
      check(!three.threw, 'three-dot diff succeeds', three.threw ? errMsg(three.error) : null);
      noLeak('three-dot diff', three.threw ? '' : three.value);
      check(eq(h.ops(), [V_RESOLVE('hx0'), V_RESOLVE('hx2'), V_MERGE_BASE(A0, A2), V_INV_DIFF(A0, A2, []), V_DIFF('patch', A0, A2, [], [EXC('private/del.txt'), EXC('private/mod.txt')])]), 'three-dot diff: merge-base first (the single ordinary result), its ID as the left side', h.ops());
      const all = await h.attempt(['diff', 'hx0..hx1']);
      noLeak('diff addition, modification and deletion', all.threw ? '' : all.value);
      check(eq(h.ops().slice(2), [V_INV_DIFF(A0, A1, []), V_DIFF('patch', A0, A1, [], [EXC('private/add.txt'), EXC('private/del.txt'), EXC('private/mod.txt')])]), 'an added, a modified and a deleted protected file are all excluded', h.ops().slice(2));
    });
    await step('log over a range: a protected file added and removed inside the range is excluded although it is absent at the range head; a merge inventory uses explicit separate diffs', async () => {
      const h = await openReal(core, context, fx, POL_HX);
      const A0 = id('hx0'); const A2 = id('hx2');
      const r = await h.attempt(['log', '-p', 'hx0..hx2']);
      check(!r.threw && /diff --git a\/safe\.txt b\/safe\.txt/.test(textOf(r.value)), 'log -p returns the safe patches', r.threw ? errMsg(r.error) : textOf(r.value).slice(0, 200));
      noLeak('log -p range', r.threw ? '' : r.value);
      const expr = `${A0}..${A2}`;
      check(eq(h.ops(), [V_RESOLVE('hx0'), V_RESOLVE('hx2'), V_INV_LOG(expr, []), V_LOG({ p: true }, expr, [], [EXC('private/add.txt'), EXC('private/del.txt'), EXC('private/mod.txt')])]), 'exclusions hold the historical names, including private/add.txt that is absent at the range head', h.ops());
      const M0 = id('mg0'); const MM = id('mgm');
      const m = await h.attempt(['log', '-p', 'mg0..mgm']);
      noLeak('log -p merge range', m.threw ? '' : m.value);
      const mexpr = `${M0}..${MM}`;
      check(eq(h.ops(), [V_RESOLVE('mg0'), V_RESOLVE('mgm'), V_INV_LOG(mexpr, []), V_LOG({ p: true }, mexpr, [], [EXC('private/a.txt')])]), 'the merge inventory lists the protected file changed by the merge (explicit separate diffs)', h.ops());
      check(eq(byUtf8(uniq(namesOf(h.log[4] && h.log[4].stdout))).filter((n) => n.startsWith('private/') || n.startsWith('p')), ['p1.txt', 'p2.txt', 'private/a.txt']), 'the inventory saw the names of both parent sides and of the protected file', namesOf(h.log[4] && h.log[4].stdout));
    });
    await step('root show and merge show: every parent is inventoried in one diff-tree process and every protected name is excluded', async () => {
      const h = await openReal(core, context, fx, POL_HX);
      const R = id('hx0');
      const root = await h.attempt(['show', 'hx0']);
      check(!root.threw && textOf(root.value).startsWith(`commit ${R}\n`) && /diff --git a\/safe\.txt b\/safe\.txt/.test(textOf(root.value)), 'root show returns the commit and the safe patch', root.threw ? errMsg(root.error) : textOf(root.value).slice(0, 200));
      noLeak('root show', root.threw ? '' : root.value);
      check(eq(h.ops(), [V_RESOLVE('hx0'), V_INV_SHOW(R, []), V_SHOW('patch', R, [], [EXC('.env'), EXC('private/del.txt'), EXC('private/mod.txt')])]), 'root show: the root commit is inventoried against the empty tree and the protected names are excluded', h.ops());
      const MM = id('mgm');
      const merge = await h.attempt(['show', 'mgm']);
      check(!merge.threw && textOf(merge.value).startsWith(`commit ${MM}\n`), 'merge show returns the commit header', merge.threw ? errMsg(merge.error) : textOf(merge.value).slice(0, 200));
      noLeak('merge show', merge.threw ? '' : merge.value);
      check(eq(h.ops(), [V_RESOLVE('mgm'), V_INV_SHOW(MM, []), V_SHOW('patch', MM, [], [EXC('private/a.txt')])]), 'merge show: one diff-tree -m process, the protected file that differs from every parent is excluded', h.ops());
      check(eq(byUtf8(uniq(namesOf(h.log[3] && h.log[3].stdout))), ['p1.txt', 'p2.txt', 'private/a.txt']), 'the inventory covers the changes against both parents', namesOf(h.log[3] && h.log[3].stdout));
    });
    await step('a protected file name that later becomes a directory: the literal exclusion keeps the historical file out of the content (over-filtering is accepted)', async () => {
      const h = await openReal(core, context, fx, POL_SECRET_FILE);
      const A = id('dl0'); const C = id('dl2');
      const r = await h.attempt(['log', '-p', 'dl0..dl2']);
      check(!r.threw, 'log succeeds', r.threw ? errMsg(r.error) : null);
      check(!/C4-DUMMY/.test(textOf(r.value)), 'the historical secret file content does not appear', textOf(r.value).slice(0, 200));
      const expr = `${A}..${C}`;
      check(eq(h.ops(), [V_RESOLVE('dl0'), V_RESOLVE('dl2'), V_INV_LOG(expr, []), V_LOG({ p: true }, expr, [], [EXC('secret')])]), 'the exclusion is the literal historical name', h.ops());
    });
    await step('empty and protected-only ranges and commits: empty success without a content call', async () => {
      const h = await openReal(core, context, fx, POL_HX);
      const A2 = id('hx2'); const A3 = id('hx3');
      const same = await h.attempt(['diff', 'hx2..hx2']);
      check(!same.threw && same.value.length === 0 && eq(h.ops(), [V_RESOLVE('hx2'), V_INV_DIFF(A2, A2, [])]), 'an empty diff range: one resolution of the repeated spelling, one inventory, empty result', h.ops());
      const cases = [
        [['diff', 'hx2..hx3'], [V_RESOLVE('hx2'), V_RESOLVE('hx3'), V_INV_DIFF(A2, A3, [])]],
        [['log', '-p', 'hx2..hx3'], [V_RESOLVE('hx2'), V_RESOLVE('hx3'), V_INV_LOG(`${A2}..${A3}`, [])]],
        [['log', '-p', 'hx2..hx2'], [V_RESOLVE('hx2'), V_INV_LOG(`${A2}..${A2}`, [])]],
        [['show', 'hx3'], [V_RESOLVE('hx3'), V_INV_SHOW(A3, [])]],
      ];
      for (const [argv, ops] of cases) {
        const r = await h.attempt(argv);
        check(!r.threw && r.value.length === 0 && eq(h.ops(), ops), `${argv.join(' ')}: empty result and no content call`, r.threw ? errMsg(r.error) : h.ops());
      }
    });
  });
}

// ============================================ the six policy consumers ====
// Each consumer is one command over one path, with the vectors and the results the plan pins for a protected and for an unprotected name (plan 3.5-3.7, 4.7).
const CONSUMERS = ['cat', 'ls', 'grep', 'diff', 'log', 'show'];
const DUMMY = Buffer.from('C4-DUMMY-CONTENT\n');
function consumer(cmd, P) {
  const C = rid('c4-head'); const B = rid('c4-base');
  const L = [LIT(P)];
  const res = V_RESOLVE('c4-head');
  const two = [V_RESOLVE('c4-base'), V_RESOLVE('c4-head')];
  const empty = { exit: 0, stdout: EMPTY };
  switch (cmd) {
    case 'cat':
      return { argv: ['cat', 'c4-head', '--', P], world: { content: DUMMY }, prot: failMain(E.SECRET), protOps: [], vis: { exit: 0, stdout: DUMMY }, visOps: [res, V_CAT(C, P)] };
    case 'ls':
      return { argv: ['ls', 'c4-head', '--', P], world: { tree: [P] }, prot: empty, protOps: [res, V_INV_TREE(C)], vis: { exit: 0, stdout: nul([P]) }, visOps: [res, V_INV_TREE(C)] };
    case 'grep': {
      const framed = Buffer.from(`${C}:${P}\0` + '1\0' + 'needle\n');
      return { argv: ['grep', 'c4-head', 'needle', '--', P], world: { tree: [P], content: framed }, prot: empty, protOps: [res, V_INV_TREE(C)], vis: { exit: 0, stdout: framed }, visOps: [res, V_INV_TREE(C), V_GREP('needle', C, L, [])] };
    }
    case 'diff':
      return { argv: ['diff', 'c4-base..c4-head', '--', P], world: { inv: { diff: nul([P]) }, content: DUMMY }, prot: empty, protOps: [...two, V_INV_DIFF(B, C, L)], vis: { exit: 0, stdout: DUMMY }, visOps: [...two, V_INV_DIFF(B, C, L), V_DIFF('patch', B, C, L, [])] };
    case 'log': {
      const expr = `${B}..${C}`;
      return { argv: ['log', '-p', 'c4-base..c4-head', '--', P], world: { inv: { log: nul([P]) }, content: DUMMY }, prot: empty, protOps: [...two, V_INV_LOG(expr, L)], vis: { exit: 0, stdout: DUMMY }, visOps: [...two, V_INV_LOG(expr, L), V_LOG({ p: true }, expr, L, [])] };
    }
    case 'show':
      return { argv: ['show', 'c4-head', '--', P], world: { inv: { show: nul([P]) }, content: DUMMY }, prot: empty, protOps: [res, V_INV_SHOW(C, L)], vis: { exit: 0, stdout: DUMMY }, visOps: [res, V_INV_SHOW(C, L), V_SHOW('patch', C, L, [])] };
    default: throw new Error(`unknown consumer ${cmd}`);
  }
}
// Runs one consumer over one path and policy and compares the result and the operation vectors with the expectation for a protected or unprotected name.
async function runConsumer(core, context, check, label, cmd, P, policy, isProtected, { full = false } = {}) {
  const c = consumer(cmd, P);
  const s = await seamMain(core, context, c.argv, { world: c.world, policy });
  const want = isProtected ? c.prot : c.vis;
  const wantOps = isProtected ? c.protOps : c.visOps;
  expectMain(check, label, s.r, want);
  if (full) checkOps(check, label, s.fake, wantOps);
  else check(eq(s.ops, wantOps), `${label}: the operation vectors`, { got: s.ops.map((o) => o.slice(0, 5)), want: wantOps.map((o) => o.slice(0, 5)) });
  if (isProtected) check(!textOf(s.r.stdout).includes('C4-DUMMY'), `${label}: no dummy content is emitted for a protected name`);
  return s;
}
// plan 4.7: every row through all six consumers, once in managed patterns and once in project patterns (the other collection empty).
const placementsOf = (entry) => [['managed patterns', pol2([entry], [])], ['project patterns', pol2([], [entry])]];
async function consumerMatrix(core, context, check, rows) {
  let n = 0;
  for (const row of rows) {
    for (const [where, policy] of placementsOf(row.entry)) {
      for (const cmd of CONSUMERS) { await runConsumer(core, context, check, `${row.id} ${where} ${cmd}`, cmd, row.path, policy, row.expected, { full: n === 0 }); n++; }
    }
  }
  return n;
}
function loadCorpus(check, context) {
  const c = readJson(CORPUS_FILE(context));
  if (!c || !Array.isArray(c.matches) || !Array.isArray(c.rejectedEntries)) { check(false, 'tests/fixtures/security-policy-corpus.json is readable'); return null; }
  return c;
}

// ============================================== R47/C4/project-policy ====
// Plan 4.7: the effective policy reaches every command: root and any-depth project entries, managed plus project, a reviewed commit with another policy, schema 1 and 2.
const VARIANTS = [
  { name: 'a root project entry', policy: pol2([], [{ anchor: 'root', glob: 'private/**' }]), schema: 2, prot: ['private/token.txt', 'PRIVATE/Token.txt'], vis: ['nested/private/token.txt', 'safe.txt'] },
  { name: 'its any-depth counterpart', policy: pol2([], [{ anchor: 'any', glob: '**/private/**' }]), schema: 2, prot: ['private/token.txt', 'nested/private/token.txt', 'a/b/PRIVATE/x'], vis: ['safe.txt', 'private'] },
  { name: 'a managed entry plus a project entry', policy: pol2([{ anchor: 'any', glob: '**/.env*' }], [{ anchor: 'root', glob: 'private/**' }]), schema: 2, prot: ['.env', 'src/.env.local', 'private/x'], vis: ['safe.txt', 'nested/private/x'] },
  { name: 'an installed schema 1 policy adapted by C1', policy: { schema: 1, patterns: [{ glob: '**/.env*' }, { glob: 'private/**' }] }, schema: 1, prot: ['.env', 'src/.env.local', 'private/x'], vis: ['safe.txt', 'nested/private/x'] },
  { name: 'an installed schema 2 policy', policy: pol2([{ anchor: 'any', glob: '**/*.pem' }], [{ anchor: 'root', glob: 'secrets/**' }, { anchor: 'any', glob: '**/.env*' }]), schema: 2, prot: ['a/key.pem', 'secrets/k', 'x/.envrc'], vis: ['secrets', 'nested/secrets/k', 'key.pem.txt'] },
];
async function projectPolicy(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    if (!core) return;
    await step('every command refuses or omits the protected names and keeps the visible ones, for each policy shape', async () => {
      for (const v of VARIANTS) {
        for (const cmd of CONSUMERS) {
          for (const p of v.prot) await runConsumer(core, context, check, `${v.name} / ${cmd} / protected ${show(p)}`, cmd, p, v.policy, true);
          for (const p of v.vis) await runConsumer(core, context, check, `${v.name} / ${cmd} / visible ${show(p)}`, cmd, p, v.policy, false);
        }
      }
    });
    await step('the session exposes the effective policy deeply frozen, the source schema, and reads the installed policy once from the exact native path', async () => {
      for (const v of VARIANTS) {
        const fake = makeFake(context, {});
        const reads = [];
        const session = await core.createGitSession({ cwd: fake.paths.start, env: SEAM_ENV, execute: fake.execute, readFile: async (p) => { reads.push(p); return bytes(jsonText(v.policy)); } });
        check(session && eq(sorted(Object.keys(session)), ['git', 'listTree', 'policy', 'resolveCommit', 'root', 'sourceSchema']) && Object.isFrozen(session), `${v.name}: the session is frozen with exactly root, policy, sourceSchema, git, resolveCommit, listTree`, session && Object.keys(session));
        check(session && session.sourceSchema === v.schema, `${v.name}: sourceSchema is ${v.schema}`, session && session.sourceSchema);
        check(session && deepFrozen(session.policy) && Array.isArray(session.policy.patterns) && Array.isArray(session.policy.projectPatterns), `${v.name}: the policy is deeply frozen and holds patterns and projectPatterns`, session && session.policy);
        const pairs = (a) => a.map((e) => [e.anchor, e.glob]);
        const wantM = pairs(v.policy.patterns.map((e) => ({ anchor: e.anchor || (e.glob.startsWith('**/') ? 'any' : 'root'), glob: e.glob })));
        const wantP = pairs((v.policy.projectPatterns || []).map((e) => ({ anchor: e.anchor || (e.glob.startsWith('**/') ? 'any' : 'root'), glob: e.glob })));
        check(session && eq(pairs(session.policy.patterns), wantM) && eq(pairs(session.policy.projectPatterns), wantP), `${v.name}: managed and project entries are both present with their anchors`, session && session.policy);
        check(eq(reads, [path.join(fake.paths.root, '.ai', 'security-paths.json')]), `${v.name}: one policy read at path.join(root, ".ai", "security-paths.json")`, reads);
        check(session && session.root === path.resolve(fwd(fake.paths.root)), `${v.name}: root is the normalized absolute root`, session && session.root);
      }
    });
    await step('a reviewed commit carrying a different policy never replaces the installed one (seam: no vector reads the policy file; real Git: an empty committed policy does not unprotect private/)', async () => {
      const s = await seamMain(core, context, ['cat', 'c4-head', '--', '.ai/security-paths.json'], { policy: VARIANTS[0].policy });
      check(eq(s.ops, [V_RESOLVE('c4-head'), V_CAT(rid('c4-head'), '.ai/security-paths.json')]) && s.reads.length === 1, 'the policy file of the commit is just a path: one policy read, no other policy lookup', { ops: s.ops, reads: s.reads.length });
      const fx = await useFx(failures, context);
      if (!fx) return;
      const h = await openReal(core, context, fx, POL_PRIVATE);
      const r = await h.attempt(['show', 'pol']);
      const t = textOf(r.threw ? '' : r.value);
      check(!r.threw && /diff --git a\/safe\.txt b\/safe\.txt/.test(t) && !t.includes('C4-DUMMY') && !t.includes('private/x.txt'), 'show of a commit whose own policy file is empty still omits private/x.txt (the installed policy governs)', r.threw ? errMsg(r.error) : t.slice(0, 300));
      const c = await h.attempt(['cat', 'pol', '--', 'private/x.txt']);
      check(c.threw && c.error.message === E.SECRET, 'cat of the protected path is refused whatever the commit policy says', c.threw ? c.error.message : c.value);
    });
  });
}

// ================================================ R74/C4/corpus ====
// Plan 4.7: the shared corpus through the six consumers (78 matching rows, both placements) and the 27 rejected entries through an installed schema-2 policy.
async function corpusGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    if (!core) return;
    const corpus = loadCorpus(check, context);
    if (!corpus) return;
    check(corpus.matches.length === 78 && corpus.rejectedEntries.length === 27, 'the shared corpus has 78 matching rows and 27 rejected entries', { matches: corpus.matches.length, rejected: corpus.rejectedEntries.length });
    await step('all 78 matching rows through cat, ls, grep, diff, log and show, in managed and in project patterns; the classification comes from the corpus', async () => {
      const n = await consumerMatrix(core, context, check, corpus.matches);
      check(n === 78 * 2 * 6, 'every row ran in both placements through all six consumers', n);
    });
    await step('the 27 rejected entries fail an installed schema-2 policy at patterns[0] and at projectPatterns[0] with the corpus code and the location rewritten', async () => {
      for (const row of corpus.rejectedEntries) {
        for (const [where, loc, policy] of [['patterns', 'patterns[0]', pol2([row.entry], [])], ['projectPatterns', 'projectPatterns[0]', pol2([], [row.entry])]]) {
          const message = row.message.replace('entry.', `${loc}.`);
          const s = await seamMain(core, context, ['ls', 'c4-head'], { policy });
          expectMain(check, `${row.id} in ${where}`, s.r, failMain(message));
          check(s.fake.calls.length === 2 && codeOf(message) === row.code, `${row.id} in ${where}: no resolution or content operation follows the policy rejection`, s.fake.kinds());
        }
      }
    });
    await step('real Git representative set through the installed three-file reader: cat, ls and grep with managed and project entries', async () => {
      const fx = await useFx(failures, context);
      if (!fx) return;
      const proj = installFxReader(context, fx, failures);
      if (!proj) return;
      const C = rev(fx, 'lsgrep');
      const cli = (args) => execNode(context, { cwd: fx.root, script: proj.entry, args });
      const cat = cli(['cat', C, '--', 'safe.txt']);
      check(cat.dead === null && cat.code === 0 && cat.stdout === 'needle\n' && cat.stderr === '', 'installed reader: cat of a safe file', { code: cat.code, out: cat.stdout.slice(0, 100), err: cat.stderr.slice(0, 200) });
      for (const p of ['.env', 'private/key.txt']) {
        const r = cli(['cat', C, '--', p]);
        check(r.code === 2 && r.stdout === '' && r.stderr === stderrLine(E.SECRET), `installed reader: cat ${p} is the secret refusal (managed and project entries)`, { code: r.code, out: r.stdout.slice(0, 100), err: r.stderr.slice(0, 200) });
      }
      const ls = cli(['ls', C]);
      check(ls.code === 0 && ls.stdout === 'safe.txt\0src/a.txt\0' && ls.stderr === '', 'installed reader: ls omits protected paths', { code: ls.code, out: ls.stdout.slice(0, 100), err: ls.stderr.slice(0, 200) });
      const gr = cli(['grep', C, 'needle']);
      check(gr.code === 0 && gr.stdout === `${C}:safe.txt\0` + '1\0' + 'needle\n' + `${C}:src/a.txt\0` + '1\0' + 'needle\n' && gr.stderr === '', 'installed reader: grep omits protected matches', { code: gr.code, out: gr.stdout.slice(0, 200), err: gr.stderr.slice(0, 200) });
    });
  });
}

// ===================================================== processes ====
function execNode(context, { cwd, script, args = [], env = null, preload = null }) {
  const pre = Array.isArray(preload) ? preload : preload ? [preload] : [];
  const argv = [...pre.flatMap((p) => ['--require', p]), script, ...args];
  const r = spawnSync(process.execPath, argv, { cwd, env: env || context.env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 120000, maxBuffer: 16777216 });
  let dead = null;
  if (r.error) dead = `${r.error.code || 'error'}: ${String(r.error.message).slice(0, 120)}`;
  else if (r.signal) dead = `signal ${r.signal}`;
  const stdout = r.stdout || '';
  let json = null;
  try { json = JSON.parse(stdout); } catch { /* not JSON */ }
  return { code: r.status, stdout, stderr: r.stderr || '', json, dead };
}
// The three real files installed into the shared repository with the plan 4.7 policy (schema 2, a managed and a project entry). Idempotent.
const installed = new Map();
function installFxReader(context, fx, failures) {
  if (installed.has(fx.root)) return installed.get(fx.root);
  const tools = path.join(fx.root, '.ai', 'tools');
  const files = { 'security-policy.mjs': 'assets/tools/security-policy.mjs', 'git-safe-core.mjs': CORE_REL, 'git-safe.mjs': ENTRY_REL };
  for (const [name, src] of Object.entries(files)) {
    const b = readBytes(path.join(context.skillRoot, ...src.split('/')));
    if (b === null) { failures.push(`cannot read ${src}`); installed.set(fx.root, null); return null; }
    putFile(path.join(tools, name), b);
  }
  putFile(path.join(fx.root, '.ai', 'security-paths.json'), jsonText(PL));
  const r = { entry: path.join(tools, 'git-safe.mjs') };
  installed.set(fx.root, r);
  return r;
}

// =============================================== R97/C4/environment-names ====
async function environmentNames(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    if (!core) return;
    const corpus = loadCorpus(check, context);
    if (!corpus) return;
    const rows = corpus.matches.filter((r) => r.id.startsWith('E'));
    check(rows.length === 19 && rows.every((r) => eq(r.entry, { anchor: 'any', glob: '**/.env*' })), 'the environment-name rows are E01-E19, all with the any-depth **/.env* entry', rows.map((r) => r.id));
    await step('E01-E19 through all six consumers in managed and project placements', async () => {
      const n = await consumerMatrix(core, context, check, rows);
      check(n === 19 * 2 * 6, 'every environment row ran in both placements through all six consumers', n);
    });
    await step('there is no template exception: .env.example, .env.sample and .env.template are refused by cat and omitted by every other command; root and nested spellings and case variants are covered', async () => {
      const policy = pol2([{ anchor: 'any', glob: '**/.env*' }], []);
      for (const p of ['.env', '.env.example', '.env.sample', '.env.template', '.envrc', '.env-prod', 'config/.env.example', 'src/deep/.env-prod', 'SRC/.ENVRC', 'src/.EnV.ExAmPlE']) {
        for (const cmd of CONSUMERS) await runConsumer(core, context, check, `template ${cmd} ${show(p)}`, cmd, p, policy, true);
      }
      for (const p of ['env', 'dotenv', 'x.env', '.en', '.envdir/file.txt']) {
        for (const cmd of CONSUMERS) await runConsumer(core, context, check, `visible ${cmd} ${show(p)}`, cmd, p, policy, false);
      }
    });
  });
}

// ============================================== R75/C4/exact-case ====
async function exactCase(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    if (!core) return;
    await step('secret matching folds case on every platform; unprotected lookup keeps the original spelling; exclusions keep the inventory spelling', async () => {
      const pol = pol2([], [{ anchor: 'root', glob: 'private/**' }]);
      for (const p of ['private/token.txt', 'PRIVATE/token.txt', 'Private/Token.TXT', 'pRiVaTe/X']) {
        for (const cmd of CONSUMERS) await runConsumer(core, context, check, `${cmd} ${show(p)} (folded)`, cmd, p, pol, true);
      }
      for (const p of ['MixedCase.txt', 'mixedcase.txt', 'MIXEDCASE.TXT', 'Docs/ReadMe.md']) {
        for (const cmd of CONSUMERS) await runConsumer(core, context, check, `${cmd} ${show(p)} (exact)`, cmd, p, pol, false);
      }
      const C = rid('c4-head'); const B = rid('c4-base');
      const s = await seamMain(core, context, ['diff', 'c4-base..c4-head'], { policy: pol, world: { inv: { diff: nul(['PRIVATE/Key.txt', 'Mixed/Case.TXT', 'private/lower.txt']) }, content: DUMMY } });
      check(eq(s.ops, [V_RESOLVE('c4-base'), V_RESOLVE('c4-head'), V_INV_DIFF(B, C, []), V_DIFF('patch', B, C, [], [EXC('PRIVATE/Key.txt'), EXC('private/lower.txt')])]), 'the exclusions use the exact inventory spelling (not lowercased) and the unprotected mixed-case name stays visible', s.ops);
      const g = await seamMain(core, context, ['ls', 'c4-head'], { policy: pol, world: { tree: ['MixedCase.txt', 'mixedcase.txt', 'Private/K'] } });
      expectMain(check, 'ls keeps both spellings of an unprotected name', g.r, { exit: 0, stdout: nul(['MixedCase.txt', 'mixedcase.txt']) });
    });
    await step('real Git: two tree entries that differ only by case stay distinct and the wrong case fails instead of selecting another spelling', async () => {
      const fx = await useFx(failures, context);
      if (!fx) return;
      const h = await openReal(core, context, fx, PL);
      const cat = async (p) => h.attempt(['cat', 'c4-head', '--', p]);
      const up = await cat('Case.txt'); const lo = await cat('case.txt'); const bad = await cat('CASE.TXT'); const bad2 = await cat('cAse.txt');
      check(!up.threw && sameBuf(up.value, Buffer.from('upper\n')), 'Case.txt returns its own bytes', up.threw ? errMsg(up.error) : up.value);
      check(!lo.threw && sameBuf(lo.value, Buffer.from('lower\n')), 'case.txt returns its own bytes', lo.threw ? errMsg(lo.error) : lo.value);
      for (const [label, r] of [['CASE.TXT', bad], ['cAse.txt', bad2]]) check(r.threw && r.error.message === E.GIT, `the wrong case ${label} is GIT_SAFE_GIT, not another spelling`, r.threw ? r.error.message : r.value);
      const head = rev(fx, 'c4-head');
      const lsUp = await h.attempt(['ls', 'c4-head', '--', 'Case.txt']); const lsLo = await h.attempt(['ls', 'c4-head', '--', 'case.txt']); const lsBad = await h.attempt(['ls', 'c4-head', '--', 'CASE.txt']);
      check(!lsUp.threw && sameBuf(lsUp.value, Buffer.from('Case.txt\0')) && !lsLo.threw && sameBuf(lsLo.value, Buffer.from('case.txt\0')) && !lsBad.threw && lsBad.value.length === 0, 'ls selects by exact case: each spelling alone, a wrong spelling nothing', [lsUp, lsLo, lsBad].map((x) => (x.threw ? errMsg(x.error) : textOf(x.value))));
      const gU = await h.attempt(['grep', 'c4-head', 'upper', '--', 'Case.txt']); const gL = await h.attempt(['grep', 'c4-head', 'upper', '--', 'case.txt']);
      check(!gU.threw && sameBuf(gU.value, Buffer.from(`${head}:Case.txt\0` + '1\0' + 'upper\n')) && !gL.threw && gL.value.length === 0, 'grep scopes by exact case: the upper-case file matches, the lower-case file does not', [gU, gL].map((x) => (x.threw ? errMsg(x.error) : textOf(x.value))));
    });
  });
}

// ============================================= R75/C4/nul-records ====
const SHA256_OID = 'a'.repeat(64);
async function nulRecords(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    if (!core) return;
    const fixture = loadFixture(check, context);
    const C = rid('c4-head'); const B = rid('c4-base');
    const nameList = (fixture ? fixture.names.map((r) => r.path) : NAME_ROWS.map(([, p]) => p));
    await step('every N01-N09 name survives tree parsing and ls framing unchanged, sorted by UTF-8 bytes (including a 64-digit object ID, symlink and gitlink entries)', async () => {
      const tree = [...nameList, { path: 'exec.sh', mode: '100755' }, { path: 'lnk', mode: '120000' }, { path: 'sub', mode: '160000', type: 'commit', oid: GITLINK_SHA }, { path: 'wide.txt', oid: SHA256_OID }, '.env', 'private/x'];
      const s = await seamMain(core, context, ['ls', 'c4-head'], { world: { tree } });
      expectMain(check, 'ls of the N rows', s.r, { exit: 0, stdout: nul(byUtf8([...nameList, 'exec.sh', 'lnk', 'sub', 'wide.txt'])) });
      checkOps(check, 'ls of the N rows', s.fake, [V_RESOLVE('c4-head'), V_INV_TREE(C)]);
      for (const [, p] of NAME_ROWS) {
        const c = await seamMain(core, context, ['cat', 'c4-head', '--', p], { world: { content: Buffer.from('needle\n') } });
        expectMain(check, `cat ${show(p)}`, c.r, { exit: 0, stdout: 'needle\n' });
        check(eq(c.ops, [V_RESOLVE('c4-head'), V_CAT(C, p)]), `cat ${show(p)}: the path is passed unchanged`, c.ops);
        const g = await seamMain(core, context, ['grep', 'c4-head', 'needle', '--', p], { world: { tree: nameList, content: Buffer.from('G\n') } });
        check(eq(g.ops, [V_RESOLVE('c4-head'), V_INV_TREE(C), V_GREP('needle', C, [LIT(p)], [])]), `grep ${show(p)}: one literal selector, no exclusion`, g.ops);
      }
    });
    await step('names-only inventories keep LF, TAB, space and non-ASCII names whole: protected unusual names are excluded exactly, in UTF-8 order, for diff, show and log', async () => {
      const pol = pol2([], [{ anchor: 'root', glob: 'tab?name.txt' }, { anchor: 'root', glob: 'line?name.txt' }, { anchor: 'root', glob: 'space?name.txt' }, { anchor: 'root', glob: 'docs/*.txt' }, { anchor: 'root', glob: 'private/**' }]);
      const names = [...nameList, 'private/x', 'tab\tname.txt', 'line\nname.txt'];
      const X = byUtf8(['docs/r\u00e9sum\u00e9.txt', 'line\nname.txt', 'private/x', 'space name.txt', 'tab\tname.txt']).map(EXC);
      const inv = nul(names);
      const d = await seamMain(core, context, ['diff', 'c4-base..c4-head'], { policy: pol, world: { inv: { diff: inv }, content: DUMMY } });
      check(eq(d.ops, [V_RESOLVE('c4-base'), V_RESOLVE('c4-head'), V_INV_DIFF(B, C, []), V_DIFF('patch', B, C, [], X)]), 'diff: the exclusions are the unusual names, unsplit', d.ops.map((o) => o.slice(-7)));
      const sh = await seamMain(core, context, ['show', 'c4-head'], { policy: pol, world: { inv: { show: inv }, content: DUMMY } });
      check(eq(sh.ops, [V_RESOLVE('c4-head'), V_INV_SHOW(C, []), V_SHOW('patch', C, [], X)]), 'show: the exclusions are the unusual names, unsplit', sh.ops.map((o) => o.slice(-7)));
      const lg = await seamMain(core, context, ['log', '-p', 'c4-base..c4-head'], { policy: pol, world: { inv: { log: inv }, content: DUMMY } });
      check(eq(lg.ops, [V_RESOLVE('c4-base'), V_RESOLVE('c4-head'), V_INV_LOG(`${B}..${C}`, []), V_LOG({ p: true }, `${B}..${C}`, [], X)]), 'log: the exclusions are the unusual names, unsplit', lg.ops.map((o) => o.slice(-7)));
      const gr = await seamMain(core, context, ['grep', 'c4-head', 'needle'], { policy: pol, world: { tree: names, content: DUMMY } });
      check(eq(gr.ops, [V_RESOLVE('c4-head'), V_INV_TREE(C), V_GREP('needle', C, [], X)]), 'grep: the same exclusions from the tree inventory', gr.ops.map((o) => o.slice(-7)));
    });
    await step('sorting is by UTF-8 bytes, not by UTF-16 code units or locale; duplicates collapse; empty NUL records are ignored', async () => {
      const unsorted = ['z.txt', 'Z.txt', '\u00e9.txt', '\uff61.txt', '\u{10000}.txt', 'a.txt', 'Z.txt'];
      const want = ['Z.txt', 'a.txt', 'z.txt', '\u00e9.txt', '\uff61.txt', '\u{10000}.txt'];
      check(eq(byUtf8(uniq(unsorted)), want) && !eq([...uniq(unsorted)].sort(), want), 'premise: the pinned order differs from the default JavaScript sort', want);
      const ls = await seamMain(core, context, ['ls', 'c4-head'], { world: { tree: unsorted } });
      expectMain(check, 'ls order', ls.r, { exit: 0, stdout: nul(want) });
      const pol = pol2([], [{ anchor: 'root', glob: '*.txt' }]);
      const d = await seamMain(core, context, ['diff', 'c4-base..c4-head'], { policy: pol, world: { inv: { diff: nul(unsorted) }, content: DUMMY } });
      check(d.ops.length === 3 && eq(d.ops[2], V_INV_DIFF(B, C, [])), 'a fully protected, unsorted, duplicated inventory runs no content call', d.ops.map((o) => o.slice(0, 3)));
      const pol2b = pol2([], [{ anchor: 'root', glob: '*.pem' }]);
      const mixed = ['z.pem', 'Z.pem', '\u00e9.pem', '\uff61.pem', '\u{10000}.pem', 'a.pem', 'keep.txt', 'Z.pem'];
      const d2 = await seamMain(core, context, ['diff', 'c4-base..c4-head'], { policy: pol2b, world: { inv: { diff: nul(mixed) }, content: DUMMY } });
      check(eq(d2.ops[3], V_DIFF('patch', B, C, [], byUtf8(uniq(mixed.filter((n) => n.endsWith('.pem')))).map(EXC))), 'exclusions are deduplicated and sorted by UTF-8 bytes', d2.ops[3] && d2.ops[3].slice(-8));
      const empties = await seamMain(core, context, ['diff', 'c4-base..c4-head'], { policy: pol, world: { inv: { diff: Buffer.from('keep.pem\0\0private-a.txt\0\0\0') }, content: DUMMY } });
      check(eq(empties.ops[3], V_DIFF('patch', B, C, [], [EXC('private-a.txt')])) || empties.ops.length === 3, 'empty NUL records are ignored (never a path)', empties.ops.map((o) => o.slice(0, 3)));
      const emptyAll = await seamMain(core, context, ['diff', 'c4-base..c4-head'], { world: { inv: { diff: EMPTY }, content: DUMMY } });
      expectMain(check, 'empty stdout is a valid empty inventory', emptyAll.r, { exit: 0, stdout: EMPTY });
    });
    await step('malformed metadata fails the whole command with GIT_SAFE_RECORD before any content call', async () => {
      const badNames = [
        ['no final NUL', Buffer.from('a.txt')], ['no final NUL after a record', Buffer.from('a.txt\0b.txt')], ['invalid UTF-8', Buffer.from([0x61, 0xff, 0x00])], ['a lone surrogate byte sequence', Buffer.from([0xed, 0xa0, 0x80, 0x00])],
        ['an absolute path', Buffer.from('/abs.txt\0')], ['an empty component', Buffer.from('a//b\0')], ['a dot component', Buffer.from('./a\0')], ['a dot-dot component', Buffer.from('a/../b\0')], ['a backslash', Buffer.from('a\\b\0')], ['a trailing slash', Buffer.from('a/\0')],
        ['a drive path', Buffer.from('C:/x\0')], ['one good record then a bad one', Buffer.from('ok.txt\0../x\0')],
      ];
      for (const [label, inv] of badNames) {
        for (const [cmd, argv, key] of [['diff', ['diff', 'c4-base..c4-head'], 'diff'], ['show', ['show', 'c4-head'], 'show'], ['log', ['log', '-p', 'c4-base..c4-head'], 'log']]) {
          const s = await seamMain(core, context, argv, { world: { inv: { [key]: inv }, content: DUMMY } });
          expectMain(check, `${cmd} with ${label}`, s.r, failMain(E.RECORD));
          check(s.fake.calls.every((c) => c.kind !== 'content'), `${cmd} with ${label}: no content call followed`, s.fake.kinds());
        }
      }
      const good = `100644 blob ${OID_BLOB}\tp.txt\0`;
      const badTree = [
        ['no final NUL', Buffer.from(good.slice(0, -1))], ['a bad separator (two spaces)', Buffer.from(`100644  blob ${OID_BLOB}\tp.txt\0`)], ['a tab instead of the first space', Buffer.from(`100644\tblob ${OID_BLOB}\tp.txt\0`)],
        ['no TAB before the path', Buffer.from(`100644 blob ${OID_BLOB} p.txt\0`)], ['an extra header field', Buffer.from(`100644 blob ${OID_BLOB} 12\tp.txt\0`)], ['an upper-case object ID', Buffer.from(`100644 blob ${OID_BLOB.toUpperCase()}\tp.txt\0`)],
        ['a 41-digit object ID', Buffer.from(`100644 blob ${OID_BLOB}0\tp.txt\0`)], ['a 39-digit object ID', Buffer.from(`100644 blob ${OID_BLOB.slice(1)}\tp.txt\0`)], ['a non-hex object ID', Buffer.from(`100644 blob ${'g'.repeat(40)}\tp.txt\0`)],
        ['legacy mode 100664', Buffer.from(`100664 blob ${OID_BLOB}\tp.txt\0`)], ['a tree entry', Buffer.from(`040000 tree ${OID_BLOB}\tdir\0`)], ['mode and type mismatch', Buffer.from(`100644 commit ${OID_BLOB}\tp.txt\0`)],
        ['a gitlink typed blob', Buffer.from(`160000 blob ${OID_BLOB}\tsub\0`)], ['a symlink typed commit', Buffer.from(`120000 commit ${OID_BLOB}\tl\0`)], ['an unknown mode', Buffer.from(`100666 blob ${OID_BLOB}\tp.txt\0`)],
        ['invalid UTF-8 in the path', Buffer.concat([Buffer.from(`100644 blob ${OID_BLOB}\tp`), Buffer.from([0xff]), Buffer.from('.txt\0')])], ['an invalid path (a//b)', Buffer.from(`100644 blob ${OID_BLOB}\ta//b\0`)], ['an absolute path', Buffer.from(`100644 blob ${OID_BLOB}\t/p.txt\0`)],
        ['a good record then a bad one', Buffer.from(`${good}100664 blob ${OID_BLOB}\tq.txt\0`)], ['garbage', Buffer.from('garbage\0')],
      ];
      for (const [label, inv] of badTree) {
        for (const [cmd, argv] of [['ls', ['ls', 'c4-head']], ['grep', ['grep', 'c4-head', 'needle']]]) {
          const s = await seamMain(core, context, argv, { world: { inv: { tree: inv }, content: DUMMY } });
          expectMain(check, `${cmd} with ${label}`, s.r, failMain(E.RECORD));
          check(s.fake.calls.every((c) => c.kind !== 'content'), `${cmd} with ${label}: no content call followed`, s.fake.kinds());
        }
      }
      const ok = await seamMain(core, context, ['ls', 'c4-head'], { world: { inv: { tree: Buffer.from(good) } } });
      expectMain(check, 'control: a well-formed record', ok.r, { exit: 0, stdout: 'p.txt\0' });
    });
  });
}

// ============================================== R76/C4/arguments ====
// Plan 2.4, 2.5, 3.2, 3.6, 4.2, 4.9: the exact public surface, the explicit grammars, literal selectors, hand-built requests, complete argv arrays and the argument bound.
const FORMAT_KEY = Symbol('format');
function compareParse(check, label, got, want) {
  check(got !== null && typeof got === 'object' && eq(sorted(Object.keys(got)), sorted(PARSE_KEYS)), `${label}: the result has exactly ${PARSE_KEYS.join(', ')}`, got && Object.keys(got));
  if (!got) return;
  for (const k of PARSE_KEYS) {
    if (k === 'format' && want.format === SUMMARY) {
      // PLAN-GAP: the summary and --oneline format strings are not pinned; only that they are nonempty strings that differ from the default.
      check(typeof got.format === 'string' && got.format !== '' && got.format !== DEFAULT_FORMAT[want.subcommand], `${label}: format is a nonempty string different from the default`, got.format);
    } else check(eq(got[k], want[k]), `${label}: ${k} is ${show(want[k])}`, got[k]);
  }
}
const OK_FORMS = [
  [['diff', '--stat', 'a..b'], { subcommand: 'diff', revisions: ['a..b'], paths: [], patch: false }],
  [['diff', 'a..b', '--stat'], { subcommand: 'diff', revisions: ['a..b'], paths: [], patch: false }],
  [['diff', 'a..b', '--name-only', '--', 'p'], { subcommand: 'diff', revisions: ['a..b'], paths: ['p'], patch: false }],
  [['diff', 'v1.2..v1.3'], { subcommand: 'diff', revisions: ['v1.2..v1.3'], paths: [], patch: true, format: 'patch' }],
  [['diff', 'a...b', '--', 'x', 'y'], { subcommand: 'diff', revisions: ['a...b'], paths: ['x', 'y'], patch: true }],
  [['log', '-p', '--oneline', '-n3', 'a..b'], { subcommand: 'log', revisions: ['a..b'], patch: true, maxCount: 3 }],
  [['log', 'a..b', '-n3', '--oneline', '-p'], { subcommand: 'log', revisions: ['a..b'], patch: true, maxCount: 3 }],
  [['log', '--oneline', 'a...b', '--max-count=3', '-p'], { subcommand: 'log', revisions: ['a...b'], patch: true, maxCount: 3 }],
  [['log', 'x'], { subcommand: 'log', revisions: ['x'], paths: [], format: 'medium', patch: false, maxCount: null }],
  [['log', '-n0', 'x'], { subcommand: 'log', revisions: ['x'], maxCount: 0 }],
  [['log', '-n2147483647', 'x'], { subcommand: 'log', revisions: ['x'], maxCount: 2147483647 }],
  [['log', '--max-count=2147483647', 'x'], { subcommand: 'log', revisions: ['x'], maxCount: 2147483647 }],
  [['log', 'HEAD~3..HEAD^2~1', '--', 'p'], { subcommand: 'log', revisions: ['HEAD~3..HEAD^2~1'], paths: ['p'] }],
  [['show', '--stat', 'c'], { subcommand: 'show', revisions: ['c'], patch: false }],
  [['show', 'c', '--name-status', '--', 'p', 'q'], { subcommand: 'show', revisions: ['c'], paths: ['p', 'q'], patch: false }],
  [['ls', 'c', '--', 'b', 'a', 'b', 'a'], { subcommand: 'ls', revisions: ['c'], paths: ['b', 'a'], format: 'name-only' }],
  [['ls', 'c', '--', '--', 'a'], { subcommand: 'ls', revisions: ['c'], paths: ['--', 'a'] }],
  [['ls', 'c', '--', '-dash', 'a*b', ':(glob)x', ':/top', ':(exclude)y'], { subcommand: 'ls', revisions: ['c'], paths: ['-dash', 'a*b', ':(glob)x', ':/top', ':(exclude)y'] }],
  [['ls', 'c'], { subcommand: 'ls', revisions: ['c'], paths: [] }],
  [['cat', 'c', '--', '--'], { subcommand: 'cat', revisions: ['c'], paths: ['--'], format: null, patch: false }],
  [['cat', 'c', '--', 'sp ace\tx'], { subcommand: 'cat', revisions: ['c'], paths: ['sp ace\tx'] }],
  [['grep', 'c', 'p', '--', 'a', 'b'], { subcommand: 'grep', revisions: ['c'], paths: ['a', 'b'], pattern: 'p' }],
  [['grep', 'c', '--', '--', '--'], { subcommand: 'grep', revisions: ['c'], paths: ['--'], pattern: '--' }],
  [['grep', 'c', 'a\nb'], { subcommand: 'grep', revisions: ['c'], paths: [], pattern: 'a\nb' }],
  [['grep', 'c', '--stat'], { subcommand: 'grep', revisions: ['c'], paths: [], pattern: '--stat' }],
  [['grep', 'c', '-e', '--', 'x'], { subcommand: 'grep', revisions: ['c'], paths: ['x'], pattern: '-e' }],
];
// Bases and suffixes (plan 3.2): accepted by `show <rev>` with the original string kept in revisions.
const OK_REVS = ['HEAD', 'main', 'v1.2', 'feature/x-y_z', 'refs/heads/main', '_x', '0123abcd', 'a.b', 'HEAD^', 'HEAD~', 'HEAD~3', 'HEAD^2', 'HEAD^2~3', 'HEAD~~', 'HEAD^^', 'HEAD~3^2', 'HEAD~10', 'HEAD^0', 'a'.repeat(40), 'a'.repeat(64)];
const BAD_REVS = ['.hidden', '-x', '--x', 'a b', 'a\tb', 'a\nb', 'a\\b', 'a:b', ':a', 'a@b', '@', 'HEAD@{1}', 'HEAD^{commit}', 'HEAD^{tree}', '{x}', 'a//b', '/a', 'a/', 'a..b', 'a...b', 'HEAD~01', 'HEAD~-1', 'HEAD~x', 'HEAD^x', 'HEAD~~x', 'HEAD^{', 'HEAD~ 1', 'HEAD^!', 'HEAD^@', 'HEAD^-1', 'HEAD^-', '^HEAD', '', 'a\0b', 'HEAD:.env', 'HEAD~1.5', 'HEAD~1e1', 'HEAD~+1', '%', 'a?b', 'a*b', 'a[b',];
const BAD_RANGES = ['a..', '..b', 'a...', '...b', 'a....b', 'a..b..c', 'a...b..c', 'a..b...c', '..', '...', 'a..b ', ' a..b', 'a.. b', '^a..b', 'a..^b', 'a..b^!', 'a:x..b', 'a..b:x', 'a@{1}..b'];
const DANGEROUS = ['--no-index', '--no-index=x', '--output=x', '--ext-diff', '--textconv', '-c', '-cfoo=bar', '--exec=x', '--upload-pack=x', '--config=x', '--git-dir=x', '--work-tree=x', '--pathspec-from-file=x', '--pathspec-file-nul', '--stdin', '-O', '-Ox', '--orderfile=x', '-L', '-L1,1:x', '--line-range=1,1:x', '--contents', '--contents=x'];
const COMPAT_REFUSALS = [
  ['diff', 'HEAD'], ['diff', '--cached', 'a..b'], ['diff', '--staged', 'a..b'], ['diff', '--cached'], ['diff', '--staged', 'a..b', '--', 'p'],
  ['log', '--reverse', 'x'], ['log', '--all'], ['log', '--all', 'x'], ['log', '--branches', 'x'], ['log', '--tags', 'x'], ['log', '--remotes', 'x'], ['log', '--follow', 'x', '--', 'p'], ['log', '--follow', 'x'],
  ['log', '--format=%H', 'x'], ['log', '--pretty=oneline', 'x'], ['log', '--first-parent', 'x'], ['log', '--merges', 'x'], ['log', '--no-merges', 'x'], ['log', '--graph', 'x'], ['log', '--decorate', 'x'],
  ['log', '--stat', 'x'], ['log', '--name-only', 'x'], ['log', '--name-status', 'x'], ['log', '--patch', 'x'], ['log', '-U5', 'x'], ['log', '--author=x', 'x'], ['log', '--since=1.day', 'x'], ['log', '-S', 'x', 'y'],
  ['show', '--format=short', 'c'], ['show', '--pretty=raw', 'c'], ['show', '--format=%H', 'c'], ['show', '--oneline', 'c'], ['show', '-p', 'c'], ['show', '--name-only', 'c'], ['show', '-n1', 'c'], ['show', '--no-patch', 'c'], ['show', '-s', 'c'],
  ['diff', '-M', 'a..b'], ['diff', '-M50%', 'a..b'], ['diff', '-C', 'a..b'], ['diff', '--find-renames', 'a..b'], ['diff', '--find-copies', 'a..b'], ['diff', '-B', 'a..b'], ['diff', '--diff-algorithm=patience', 'a..b'],
  ['diff', '--patience', 'a..b'], ['diff', '--histogram', 'a..b'], ['diff', '--minimal', 'a..b'], ['diff', '-U5', 'a..b'], ['diff', '--unified=5', 'a..b'], ['diff', '-w', 'a..b'], ['diff', '--color', 'a..b'], ['diff', '--no-color', 'a..b'],
  ['diff', '--stat=100', 'a..b'], ['diff', '-z', 'a..b'], ['diff', '--numstat', 'a..b'], ['diff', '--shortstat', 'a..b'], ['diff', '--raw', 'a..b'], ['diff', '-p', 'a..b'], ['diff', '--patch', 'a..b'], ['diff', '--oneline', 'a..b'], ['diff', '-n1', 'a..b'], ['diff', '--relative', 'a..b'],
  ['diff', '--stat', '--', 'p'], ['diff', '--', 'p'], ['diff', 'a..b', 'c..d'], ['diff', 'a', 'b'],
  ['log', '^a', 'b'], ['log', '^a'], ['log', 'a', '^b'], ['log', 'a', 'b'], ['show', 'a', 'b'], ['show', 'HEAD^!'], ['show', 'HEAD^@'], ['show', 'HEAD^-1'], ['show', 'a..b'], ['show', 'a...b'], ['cat', 'a..b', '--', 'x'], ['ls', 'a..b'], ['grep', 'a..b', 'p'],
  ['diff'], ['log'], ['show'], ['log', '-p'], ['log', '-n1'], ['show', '--stat'], ['cat'], ['ls'], ['grep'], ['grep', 'c'],
  ['log', '-n', '1', 'x'], ['log', '-n'], ['log', '--max-count', '1', 'x'], ['log', '-p', '-p', 'x'], ['log', '--oneline', '--oneline', 'x'], ['diff', '--stat', '--stat', 'a..b'], ['show', '--stat', '--stat', 'c'], ['show', '--name-status', '--name-status', 'c'],
  ['diff', '--stat', '--name-only', 'a..b'], ['diff', '--name-status', '--name-only', 'a..b'], ['diff', '--stat', '--name-status', 'a..b'], ['show', '--stat', '--name-status', 'c'],
  ['log', '-n1', '--max-count=1', 'x'], ['log', '-n1', '-n1', 'x'], ['log', '-n1', '-n2', 'x'], ['log', '--max-count=1', '--max-count=1', 'x'], ['log', '--max-count=1', '-n1', 'x'],
  ['log', '-n2147483648', 'x'], ['log', '--max-count=2147483648', 'x'], ['log', '-n99999999999999999999', 'x'], ['log', '-n+1', 'x'], ['log', '-n-1', 'x'], ['log', '-n01', 'x'], ['log', '-n00', 'x'], ['log', '-n1.5', 'x'], ['log', '-n1e3', 'x'],
  ['log', '-n 1', 'x'], ['log', '-nx', 'x'], ['log', '-n0x1', 'x'], ['log', '--max-count=', 'x'], ['log', '--max-count=+1', 'x'], ['log', '--max-count=-1', 'x'], ['log', '--max-count=01', 'x'], ['log', '--max-count= 1', 'x'], ['log', '--max-count=1 ', 'x'], ['log', '--max-count=1.0', 'x'],
  ['cat', 'c'], ['cat', 'c', '--'], ['cat', 'c', '--', 'a', 'b'], ['cat', 'c', 'a'], ['cat', '--', 'x'], ['cat', 'c', '--', ''], ['cat', 'c', '-x', '--', 'a'], ['ls', 'c', 'x'], ['ls', 'c', '--'], ['ls', 'c', '-z'], ['ls', '--name-only', 'c'],
  ['grep', 'c', 'p', 'x'], ['grep', 'c', 'p', '--'], ['grep', 'c', '--', 'x'], ['grep', 'c', 'p', '--', ''], ['grep', 'c', '-i', 'p'], ['grep', '-e', 'p', 'c'],
];
const BAD_PATHS = ['./x', 'a/../x', 'a//x', '/abs', '\\abs', 'C:/x', 'C:x', 'a\\b', 'x/', 'a/', '', '..', '.', 'a/.', 'a/./b', 'a/..', '../a'];

// A complete request world for the argv tables: both inventories hold one safe and two protected names (one repeated).
function tableWorld(extra = {}) {
  return {
    inv: { diff: nul(['src/a.txt', '.env', 'private/x.txt', 'src/a.txt']), show: nul(['src/a.txt', '.env', 'private/x.txt']), log: nul(['src/a.txt', 'private/x.txt', '.env', 'src/a.txt']) },
    tree: ['src/a.txt', '.env', 'private/x.txt', 'safe.txt'], content: Buffer.from('OUT\n'), ...extra,
  };
}
const XCL = [EXC('.env'), EXC('private/x.txt')];
// The pad for the argument bound: the smallest filler such that the argv has exactly `target` units.
function padTo(build, target, filler = 'p') {
  const units = (n) => argvUnits([...PREFIX, ...build(filler.repeat(n))]);
  const u0 = units(0);
  const step = units(1) - u0;
  const n = (target - u0) / step;
  return Number.isInteger(n) && n >= 0 ? filler.repeat(n) : null;
}
async function argumentsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    if (!core) return;
    const fixture = loadFixture(check, context);
    const parse = (argv) => core.parseGitSafeArgs(argv);
    await step('the exact public surface: import safety, the nine exports, constants, frozen maps, and the unconditional thin entrypoint', async () => {
      await withScratch(context, 'imp', async (dir) => { checkImportSafe(check, CORE_REL, context, dir, assetUrl(context, CORE_REL), CORE_EXPORTS); });
      check(core.MAX_OUTPUT_BYTES === MAX_BYTES && core.MAX_GIT_ARG_UNITS === MAX_UNITS, 'MAX_OUTPUT_BYTES is 1048576 and MAX_GIT_ARG_UNITS is 24000', [core.MAX_OUTPUT_BYTES, core.MAX_GIT_ARG_UNITS]);
      check(Object.isFrozen(core.SUPPORTED_FORMS) && eq(sorted(Object.keys(core.SUPPORTED_FORMS)), sorted(COMMANDS)) && eq({ ...core.SUPPORTED_FORMS }, SUPPORTED_FORMS), 'SUPPORTED_FORMS is frozen with exactly the six pinned strings', core.SUPPORTED_FORMS);
      check(Object.isFrozen(core.NARROWING_GUIDANCE) && eq(sorted(Object.keys(core.NARROWING_GUIDANCE)), sorted(COMMANDS)) && eq({ ...core.NARROWING_GUIDANCE }, NARROWING), 'NARROWING_GUIDANCE is frozen with exactly the six pinned strings', core.NARROWING_GUIDANCE);
      const entry = readText(path.join(context.skillRoot, ...ENTRY_REL.split('/'))) || '';
      // PLAN-GAP: 2.4 shows the entrypoint text but does not say whether comments may be added; the assertions below pin its behavior-bearing statements, not its exact bytes.
      check(/^#!\/usr\/bin\/env node\n/.test(entry), 'the entrypoint keeps the node shebang');
      check(/import \{ main \} from '\.\/git-safe-core\.mjs';/.test(entry) && /await main\(process\.argv\.slice\(2\)\)/.test(entry), 'the entrypoint imports main from the sibling core and runs it on process.argv.slice(2) unconditionally', entry.slice(0, 400));
      check(/process\.stdout\.write\(result\.stdout\)/.test(entry) && /process\.stderr\.write\(result\.stderr\)/.test(entry) && /process\.exitCode = result\.exitCode/.test(entry), 'it writes stdout and stderr and sets process.exitCode from the result');
      check(!/import\.meta\.url/.test(entry) && !/argv\[1\]/.test(entry) && !/export /.test(entry), 'there is no argv[1] versus import.meta.url comparison and no export', entry.slice(0, 400));
    });
    await step('registration: COMPONENT_ASSERTIONS.C4 is the seventeen descriptors of plan 4.1 in order, written independently of the implementations, and COMPONENT_IMPLEMENTATIONS.C4 holds exactly the descriptor objects of C4_IMPLEMENTATIONS', async () => {
      const rc = await needSibling(failures, 'rc1-cases.mjs');
      if (!rc) return;
      const exp = rc.COMPONENT_ASSERTIONS && rc.COMPONENT_ASSERTIONS.C4;
      check(Array.isArray(exp) && eq(JSON.parse(JSON.stringify(exp)), EXPECTED_DESCRIPTORS) && deepFrozen(exp), 'COMPONENT_ASSERTIONS.C4 is the seventeen descriptors, in order, deep-frozen', exp);
      const impls = rc.COMPONENT_IMPLEMENTATIONS && rc.COMPONENT_IMPLEMENTATIONS.C4;
      check(Array.isArray(impls) && Object.isFrozen(impls) && impls.length === C4_IMPLEMENTATIONS.length && impls.every((x, i) => x === C4_IMPLEMENTATIONS[i]), 'COMPONENT_IMPLEMENTATIONS.C4 is a frozen array of the C4_IMPLEMENTATIONS objects, in order', impls && impls.length);
      check(Object.isFrozen(C4_IMPLEMENTATIONS) && eq(C4_IMPLEMENTATIONS.map((x) => x.id), EXPECTED_DESCRIPTORS.map((d) => d.id)) && C4_IMPLEMENTATIONS.every((x) => typeof x.run === 'function' && Object.isFrozen(x)), 'C4_IMPLEMENTATIONS is a frozen array of the seventeen IDs with callable run functions');
      const calls = [];
      const ret = rc.registerRc1Cases((...a) => calls.push(a), context);
      check(calls.length === 0 && (ret === undefined || (ret && typeof ret.then === 'function')), 'registerRc1Cases still registers no complete numbered case', calls.length);
      check(!rc.REQUIRED_CASE_IDS.some((x) => x.includes('/C4/')) && eq(rc.BASELINE_CASE_IDS.length, 60) && eq(rc.RC1_CASE_IDS.length, 40), 'the complete-case inventories are untouched', { baseline: rc.BASELINE_CASE_IDS.length, rc1: rc.RC1_CASE_IDS.length });
    });
    await step('the fixture rows A01-A31: accepted rows give the exact result, refused rows the exact usage error; arguments are parsed before any session, call or policy read', async () => {
      if (!fixture) return;
      const fmts = {};
      for (const row of fixture.args) {
        const r = await attempt(() => parse(row.argv));
        if (row.accepted) {
          check(!r.threw, `${row.id}: accepted`, r.threw ? errMsg(r.error) : null);
          if (!r.threw) {
            compareParse(check, row.id, r.value, EXPECTED_PARSE[row.id]);
            fmts[row.id] = r.value.format;
            check(eq(parse(row.argv), r.value), `${row.id}: parsing is deterministic`);
          }
        } else await expectErr(check, `${row.id} ${show(row.argv).slice(0, 60)}`, () => parse(row.argv), E.ARGUMENT(row.command));
        if (!row.accepted) {
          const s = await seamMain(core, context, row.argv, { world: tableWorld() });
          expectMain(check, `main ${row.id}`, s.r, failMain(E.ARGUMENT(row.command)));
          check(s.fake.calls.length === 0 && s.reads.length === 0, `main ${row.id}: arguments are parsed before any executor call or policy read`, { calls: s.fake.calls.length, reads: s.reads.length });
        }
      }
      // PLAN-GAP: the summary format strings are not pinned; they must at least be consistent across commands and distinct from each other.
      check(fmts.A02 === fmts.A09 && fmts.A03 === fmts.A10 && fmts.A02 !== fmts.A03 && fmts.A03 !== fmts.A04 && fmts.A02 !== fmts.A04, 'the stat, name-status and name-only formats are consistent across diff and show and distinct from each other', fmts);
    });
    await step('every accepted option position, order independence, duplicates, exclusive formats, counts, literal selectors, and the pattern rules', async () => {
      for (const [argv, want] of OK_FORMS) {
        const r = await attempt(() => parse(argv));
        check(!r.threw, `accepts ${show(argv).slice(0, 80)}`, r.threw ? errMsg(r.error) : null);
        if (r.threw) continue;
        for (const [k, v] of Object.entries(want)) check(eq(r.value[k], v), `${show(argv).slice(0, 70)}: ${k} is ${show(v)}`, r.value[k]);
        check(eq(sorted(Object.keys(r.value)), sorted(PARSE_KEYS)), `${show(argv).slice(0, 70)}: exactly the pinned keys`, Object.keys(r.value));
      }
      const a = parse(['log', '-p', '--oneline', '-n3', 'a..b']); const b = parse(['log', 'a..b', '--oneline', '-p', '-n3']); const c = parse(['log', '--oneline', '-n3', '-p', 'a..b', '--', 'p']);
      check(eq(a, b) && eq({ ...c, paths: [] }, a), 'options may appear in any order and any position before the separator');
      check(eq(parse(Object.freeze(['cat', 'c', '--', 'p'])).paths, ['p']), 'a frozen argv array is accepted and not mutated');
      for (const rv of OK_REVS) {
        const r = await attempt(() => parse(['show', rv]));
        check(!r.threw && eq(r.value.revisions, [rv]), `show accepts the revision ${show(rv)} and keeps the original string`, r.threw ? errMsg(r.error) : r.value.revisions);
        const d = await attempt(() => parse(['diff', `${rv}..HEAD`]));
        check(!d.threw && eq(d.value.revisions, [`${rv}..HEAD`]), `a range starting at ${show(rv)} accepts both endpoints and stays one string`, d.threw ? errMsg(d.error) : d.value.revisions);
        const t3 = await attempt(() => parse(['log', `HEAD...${rv}`]));
        check(!t3.threw && eq(t3.value.revisions, [`HEAD...${rv}`]), `a three-dot range ending at ${show(rv)} accepts both endpoints and stays one string`, t3.threw ? errMsg(t3.error) : t3.value.revisions);
      }
      for (const rv of BAD_REVS) await expectErr(check, `show refuses the revision ${show(rv)}`, () => parse(['show', rv]), E.ARGUMENT('show'));
      for (const rg of BAD_RANGES) {
        await expectErr(check, `diff refuses the range ${show(rg)}`, () => parse(['diff', rg]), E.ARGUMENT('diff'));
        await expectErr(check, `log refuses the range ${show(rg)}`, () => parse(['log', rg]), E.ARGUMENT('log'));
      }
      for (const v of ['v1.2..v1.3', 'a...b', 'HEAD~1..HEAD', 'HEAD^2..HEAD~3^']) check(eq(parse(['diff', v]).revisions, [v]) && eq(parse(['log', v]).revisions, [v]), `the range ${v} is accepted by diff and log and stays one string`);
    });
    await step('the intentional compatibility refusals, the dangerous options, bad selectors and NUL in every position are the exact usage error of their command', async () => {
      for (const argv of COMPAT_REFUSALS) await expectErr(check, `refuses ${show(argv).slice(0, 90)}`, () => parse(argv), E.ARGUMENT(argv[0]));
      for (const cmd of ['diff', 'log', 'show']) {
        for (const opt of DANGEROUS) {
          const argv = cmd === 'diff' ? [cmd, opt, 'a..b'] : [cmd, opt, 'c'];
          await expectErr(check, `${cmd} refuses ${opt}`, () => parse(argv), E.ARGUMENT(cmd));
          await expectErr(check, `${cmd} refuses ${opt} after the revision`, () => parse(cmd === 'diff' ? [cmd, 'a..b', opt] : [cmd, 'c', opt]), E.ARGUMENT(cmd));
        }
      }
      for (const cmd of ['cat', 'ls', 'grep']) for (const opt of DANGEROUS.slice(0, 6)) await expectErr(check, `${cmd} accepts no option: ${opt}`, () => parse(cmd === 'grep' ? [cmd, opt, 'c', 'p'] : [cmd, opt, 'c', '--', 'x']), E.ARGUMENT(cmd));
      for (const p of BAD_PATHS) {
        for (const cmd of ['cat', 'ls']) await expectErr(check, `${cmd} refuses the selector ${show(p)}`, () => parse([cmd, 'c', '--', p]), E.ARGUMENT(cmd));
        await expectErr(check, `diff refuses the selector ${show(p)}`, () => parse(['diff', 'a..b', '--', p]), E.ARGUMENT('diff'));
        await expectErr(check, `grep refuses the selector ${show(p)}`, () => parse(['grep', 'c', 'x', '--', p]), E.ARGUMENT('grep'));
      }
      const samples = { diff: ['diff', 'a..b', '--stat', '--', 'p'], log: ['log', '-p', '-n1', 'a..b', '--', 'p'], show: ['show', 'c', '--stat', '--', 'p'], cat: ['cat', 'c', '--', 'p'], ls: ['ls', 'c', '--', 'p'], grep: ['grep', 'c', 'pat', '--', 'p'] };
      for (const [cmd, argv] of Object.entries(samples)) {
        check(!(await attempt(() => parse(argv))).threw, `control: the ${cmd} sample parses`);
        for (let i = 1; i < argv.length; i++) {
          const bad = [...argv]; bad[i] = `${bad[i]}\0`;
          await expectErr(check, `${cmd}: NUL at position ${i}`, () => parse(bad), E.ARGUMENT(cmd));
        }
      }
      for (const cmd of COMMANDS) await expectErr(check, `NUL in the command name ${cmd}`, () => parse([`${cmd}\0`, 'c']), E.COMMAND);
    });
    await step('an absent or unknown command is GIT_SAFE_COMMAND; a wrong container or element type is GIT_SAFE_INPUT', async () => {
      for (const argv of [[], [''], ['status'], ['DIFF'], ['diff '], ['ls-tree', 'c'], ['--version'], ['-h'], ['help'], ['rev-parse', 'HEAD'], ['cat-file', 'blob', 'x']]) await expectErr(check, `COMMAND for ${show(argv)}`, () => parse(argv), E.COMMAND);
      const sparse = new Array(3); sparse[0] = 'diff'; sparse[2] = 'a..b';
      for (const [label, v] of [['undefined', undefined], ['null', null], ['a string', 'diff'], ['an object', {}], ['a number element', ['diff', 1]], ['a null element', ['diff', null]], ['a nested array', [['diff']]], ['an undefined element', ['cat', undefined]], ['a sparse array', sparse], ['a String object element', [new String('diff')]], ['a number', 5], ['a function', () => []]]) {
        await expectErr(check, `INPUT for ${label}`, () => parse(v), E.INPUT);
      }
      const s = await seamMain(core, context, ['diff', 1]);
      expectMain(check, 'main with a non-string element', s.r, failMain(E.INPUT));
      const n = await core.main('diff', { cwd: s.fake.paths.start, env: SEAM_ENV, execute: s.fake.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      expectMain(check, 'main with a string instead of an array', n, failMain(E.INPUT));
      check(s.fake.calls.length === 0, 'neither main call made an executor call', s.fake.kinds());
    });
    await step('hand-built requests: every invalid field, key set, path, revision, combination and duplicate is GIT_SAFE_INPUT before any executor call; a deep-frozen valid request is accepted and not mutated', async () => {
      const fake = makeFake(context, tableWorld());
      const session = await core.createGitSession({ cwd: fake.paths.start, env: SEAM_ENV, execute: fake.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      const valid = {
        diff: parse(['diff', 'a..b']), log: parse(['log', '-p', 'a..b']), show: parse(['show', 'c']), cat: parse(['cat', 'c', '--', 'p']), ls: parse(['ls', 'c']), grep: parse(['grep', 'c', 'pat']),
      };
      const variants = [];
      const add = (label, req) => variants.push([label, req]);
      for (const [cmd, v] of Object.entries(valid)) {
        const m = (f) => { const c = clone(v); f(c); return c; };
        for (const k of PARSE_KEYS) add(`${cmd}: key ${k} missing`, m((c) => { delete c[k]; }));
        add(`${cmd}: an extra key`, m((c) => { c.extra = 1; }));
        add(`${cmd}: subcommand unknown`, m((c) => { c.subcommand = 'status'; }));
        add(`${cmd}: subcommand not a string`, m((c) => { c.subcommand = 5; }));
        add(`${cmd}: revisions empty`, m((c) => { c.revisions = []; }));
        add(`${cmd}: two revisions`, m((c) => { c.revisions = ['a', 'b']; }));
        add(`${cmd}: revisions a string`, m((c) => { c.revisions = 'a'; }));
        add(`${cmd}: a revision that is not a string`, m((c) => { c.revisions = [5]; }));
        add(`${cmd}: an object-form revision`, m((c) => { c.revisions = ['HEAD:.env']; }));
        add(`${cmd}: an option as the revision`, m((c) => { c.revisions = ['--all']; }));
        add(`${cmd}: paths a string`, m((c) => { c.paths = 'x'; }));
        add(`${cmd}: a path that is not a string`, m((c) => { c.paths = [5]; }));
        add(`${cmd}: an invalid path`, m((c) => { c.paths = ['../x']; }));
        add(`${cmd}: an empty path`, m((c) => { c.paths = ['']; }));
        add(`${cmd}: a duplicate path`, m((c) => { c.paths = ['a', 'a']; }));
        add(`${cmd}: patch not a boolean`, m((c) => { c.patch = 'true'; }));
        add(`${cmd}: format unknown`, m((c) => { c.format = 'bogus'; }));
        add(`${cmd}: format a number`, m((c) => { c.format = 5; }));
        add(`${cmd}: maxCount a string`, m((c) => { c.maxCount = '1'; }));
        add(`${cmd}: maxCount NaN`, m((c) => { c.maxCount = NaN; }));
        add(`${cmd}: pattern a number`, m((c) => { c.pattern = 5; }));
        if (cmd !== 'log') add(`${cmd}: a count outside log`, m((c) => { c.maxCount = 1; }));
        if (cmd !== 'log') add(`${cmd}: a zero count outside log`, m((c) => { c.maxCount = 0; }));
        if (cmd !== 'grep') add(`${cmd}: a pattern outside grep`, m((c) => { c.pattern = 'x'; }));
        if (cmd !== 'grep') add(`${cmd}: an empty pattern outside grep`, m((c) => { c.pattern = ''; }));
        if (cmd === 'log') for (const mc of [-1, 1.5, 2147483648, Infinity]) add(`log: maxCount ${mc}`, m((c) => { c.maxCount = mc; }));
        if (cmd === 'grep') { add('grep: a null pattern', m((c) => { c.pattern = null; })); add('grep: a pattern with NUL', m((c) => { c.pattern = 'a\0b'; })); }
        if (cmd === 'cat') { add('cat: no path', m((c) => { c.paths = []; })); add('cat: two paths', m((c) => { c.paths = ['a', 'b']; })); add('cat: a non-null format', m((c) => { c.format = 'patch'; })); add('cat: patch true', m((c) => { c.patch = true; })); }
        if (cmd === 'grep') add('grep: a non-null format', m((c) => { c.format = 'patch'; }));
        if (cmd === 'ls') add('ls: patch true', m((c) => { c.patch = true; }));
        if (cmd === 'diff') add('diff: a single revision instead of a range', m((c) => { c.revisions = ['a']; }));
        if (cmd !== 'diff' && cmd !== 'log') add(`${cmd}: a range instead of a commit`, m((c) => { c.revisions = ['a..b']; }));
      }
      for (const bad of [null, undefined, 5, 'x', [], () => ({}), Object.create(valid.cat)]) add(`not a request object (${show(bad)})`, bad);
      for (const [label, req] of variants) {
        const before = fake.calls.length;
        await expectErr(check, `hand-built request: ${label}`, () => core.executeGitSafe(req, session), E.INPUT);
        check(fake.calls.length === before, `hand-built request ${label}: no executor call`, fake.calls.length - before);
      }
      const frozen = deepFreeze(clone(valid.cat));
      const before = clone(frozen);
      const ok = await attempt(() => core.executeGitSafe(frozen, session));
      check(!ok.threw && Buffer.isBuffer(ok.value) && eq(frozen, before), 'a deep-frozen valid request is accepted and not mutated', ok.threw ? errMsg(ok.error) : null);
    });
    await step('a foreign, copied or forged session is GIT_SAFE_INPUT before any session or executor call', async () => {
      const fake = makeFake(context, tableWorld());
      const session = await core.createGitSession({ cwd: fake.paths.start, env: SEAM_ENV, execute: fake.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      const req = core.parseGitSafeArgs(['cat', 'c', '--', 'p']);
      const spyCalls = [];
      const spy = (name) => async (...a) => { spyCalls.push(name); return null; };
      const other = await import(`${assetUrl(context, CORE_REL)}?c4-foreign`);
      const fake2 = makeFake(context, tableWorld());
      const foreign = await other.createGitSession({ cwd: fake2.paths.start, env: SEAM_ENV, execute: fake2.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      const forged = { root: session.root, policy: session.policy, sourceSchema: session.sourceSchema, git: spy('git'), resolveCommit: spy('resolveCommit'), listTree: spy('listTree') };
      const copies = [
        ['a spread copy', { ...session }], ['a frozen copy', Object.freeze({ ...session })], ['a null-prototype copy', Object.assign(Object.create(null), session)], ['an object inheriting the session', Object.create(session)],
        ['a forged session with spies', forged], ['a frozen forged session', Object.freeze({ ...forged })], ['a session of another core instance', foreign], ['null', null], ['undefined', undefined], ['an empty object', {}], ['a string', 'session'],
      ];
      for (const [label, s] of copies) {
        const before = fake.calls.length + fake2.calls.length;
        await expectErr(check, `session: ${label}`, () => core.executeGitSafe(req, s), E.INPUT);
        check(fake.calls.length + fake2.calls.length === before && spyCalls.length === 0, `session: ${label}: no session method and no executor was called`, { calls: fake.calls.length + fake2.calls.length - before, spies: spyCalls });
      }
      const ok = await attempt(() => core.executeGitSafe(req, session));
      check(!ok.threw, 'control: the genuine session works', ok.threw ? errMsg(ok.error) : null);
    });
    await step('createGitSession accepts only cwd, env, execute and readFile: unknown keys, wrong types and a relative cwd are GIT_SAFE_INPUT before any dependency call', async () => {
      const fake = makeFake(context, tableWorld());
      const reads = [];
      const readFile = async (p) => { reads.push(p); return bytes(jsonText(DEFAULT_POLICY)); };
      const good = { cwd: fake.paths.start, env: SEAM_ENV, execute: fake.execute, readFile };
      const bad = [
        ['an unknown key', { ...good, shell: true }], ['a relative cwd', { ...good, cwd: 'relative/dir' }], ['an empty cwd', { ...good, cwd: '' }], ['a numeric cwd', { ...good, cwd: 5 }], ['a non-string env value', { ...good, env: { PATH: 5 } }],
        ['an env array', { ...good, env: [] }], ['a string execute', { ...good, execute: 'git' }], ['a numeric readFile', { ...good, readFile: 5 }],
        ['options that are an array', [good]], ['options that are a string', 'x'], ['null options', null],
      ];
      for (const [label, o] of bad) {
        await expectErr(check, `createGitSession with ${label}`, () => core.createGitSession(o), E.INPUT);
      }
      check(fake.calls.length === 0 && reads.length === 0, 'no dependency was called by any invalid option set', { calls: fake.calls.length, reads: reads.length });
      for (const [label, o] of [['an unknown key', { ...good, shell: true }], ['a relative cwd', { ...good, cwd: 'rel' }]]) {
        const r = await core.main(['ls', 'c4-head'], o);
        expectMain(check, `main with ${label}`, r, failMain(E.INPUT));
      }
      check(fake.calls.length === 0 && reads.length === 0, 'main made no dependency call either', { calls: fake.calls.length, reads: reads.length });
      const ok = await attempt(() => core.createGitSession({ cwd: fake.paths.start, execute: fake.execute, readFile, env: { ...SEAM_ENV } }));
      check(!ok.threw, 'control: a valid option set works', ok.threw ? errMsg(ok.error) : null);
      const snap = clone(SEAM_ENV);
      await core.createGitSession({ cwd: fake.paths.start, env: SEAM_ENV, execute: fake.execute, readFile });
      check(eq(SEAM_ENV, snap), 'the caller environment object is not mutated');
    });
    await step('complete argv arrays for every inventory and content variant, including the fixed prefix, resolved IDs and literal selectors', async () => {
      const B = rid('c4-base'); const C = rid('c4-head'); const M = rid(`merge-base:${B}:${C}`);
      const sel = (...p) => p.map(LIT);
      const cases = [
        ['diff patch', ['diff', 'c4-base..c4-head'], [V_RESOLVE('c4-base'), V_RESOLVE('c4-head'), V_INV_DIFF(B, C, []), V_DIFF('patch', B, C, [], XCL)]],
        ['diff three-dot --stat with paths', ['diff', 'c4-base...c4-head', '--stat', '--', 'src', 'docs'], [V_RESOLVE('c4-base'), V_RESOLVE('c4-head'), V_MERGE_BASE(B, C), V_INV_DIFF(M, C, sel('src', 'docs')), V_DIFF('stat', M, C, sel('src', 'docs'), XCL)]],
        ['diff --name-status', ['diff', '--name-status', 'c4-base..c4-head'], [V_RESOLVE('c4-base'), V_RESOLVE('c4-head'), V_INV_DIFF(B, C, []), V_DIFF('name-status', B, C, [], XCL)]],
        ['diff --name-only with a path', ['diff', 'c4-base..c4-head', '--name-only', '--', 'src'], [V_RESOLVE('c4-base'), V_RESOLVE('c4-head'), V_INV_DIFF(B, C, sel('src')), V_DIFF('name-only', B, C, sel('src'), XCL)]],
        ['diff of ancestry spellings', ['diff', 'HEAD~1..HEAD'], [V_RESOLVE('HEAD~1'), V_RESOLVE('HEAD'), V_INV_DIFF(rid('HEAD~1'), rid('HEAD'), []), V_DIFF('patch', rid('HEAD~1'), rid('HEAD'), [], XCL)]],
        ['log single revision', ['log', 'c4-head'], [V_RESOLVE('c4-head'), V_INV_LOG(C, []), V_LOG({}, C, [], XCL)]],
        ['log -p two-dot', ['log', '-p', 'c4-base..c4-head'], [V_RESOLVE('c4-base'), V_RESOLVE('c4-head'), V_INV_LOG(`${B}..${C}`, []), V_LOG({ p: true }, `${B}..${C}`, [], XCL)]],
        ['log --oneline -n2', ['log', '--oneline', '-n2', 'c4-head'], [V_RESOLVE('c4-head'), V_INV_LOG(C, []), V_LOG({ oneline: true, n: 2 }, C, [], XCL)]],
        ['log three-dot with every option and a path (no merge-base call)', ['log', '--max-count=5', '-p', '--oneline', 'c4-base...c4-head', '--', 'src'], [V_RESOLVE('c4-base'), V_RESOLVE('c4-head'), V_INV_LOG(`${B}...${C}`, sel('src')), V_LOG({ oneline: true, p: true, n: 5 }, `${B}...${C}`, sel('src'), XCL)]],
        ['show patch', ['show', 'c4-head'], [V_RESOLVE('c4-head'), V_INV_SHOW(C, []), V_SHOW('patch', C, [], XCL)]],
        ['show --stat with a path', ['show', '--stat', 'c4-head', '--', 'safe.txt'], [V_RESOLVE('c4-head'), V_INV_SHOW(C, sel('safe.txt')), V_SHOW('stat', C, sel('safe.txt'), XCL)]],
        ['show --name-status', ['show', 'c4-head', '--name-status'], [V_RESOLVE('c4-head'), V_INV_SHOW(C, []), V_SHOW('name-status', C, [], XCL)]],
        ['cat', ['cat', 'c4-head', '--', 'safe.txt'], [V_RESOLVE('c4-head'), V_CAT(C, 'safe.txt')]],
        ['ls', ['ls', 'c4-head', '--', 'src'], [V_RESOLVE('c4-head'), V_INV_TREE(C)]],
        ['grep with paths', ['grep', 'c4-head', 'needle', '--', 'src', 'safe.txt'], [V_RESOLVE('c4-head'), V_INV_TREE(C), V_GREP('needle', C, sel('src', 'safe.txt'), [])]],
        ['grep without paths', ['grep', 'c4-head', '-e'], [V_RESOLVE('c4-head'), V_INV_TREE(C), V_GREP('-e', C, [], XCL)]],
      ];
      // with the selectors src and safe.txt no protected tree name lies under them, so the grep exclusions are empty
      for (const [label, argv, ops] of cases) {
        const s = await seamMain(core, context, argv, { world: tableWorld() });
        expectMain(check, `main ${label}`, s.r, { exit: 0, stdout: argv[0] === 'ls' ? 'src/a.txt\0' : 'OUT\n' });
        checkOps(check, label, s.fake, ops);
      }
    });
    await step('the argument bound: exactly 24000 units pass, more fail with the exact error before any process, UTF-16 length counts, E2BIG and ENAMETOOLONG map to the same error, many safe names never expand', async () => {
      const C = rid('c4-head');
      const catPad = padTo((p) => V_CAT(C, p), MAX_UNITS);
      check(catPad !== null, 'premise: a cat path of exactly 24000 units exists');
      if (catPad !== null) {
        const at = await seamMain(core, context, ['cat', 'c4-head', '--', catPad], { world: { content: Buffer.from('FIT\n') } });
        expectMain(check, 'cat at exactly 24000 units', at.r, { exit: 0, stdout: 'FIT\n' });
        check(at.fake.calls.some((c) => c.kind === 'content' && argvUnits(c.argv) === MAX_UNITS), 'the executor received the 24000-unit call', at.fake.calls.map((c) => argvUnits(c.argv)));
        const over = await seamMain(core, context, ['cat', 'c4-head', '--', `${catPad}pp`], { world: { content: Buffer.from('FIT\n') } });
        expectMain(check, 'cat above 24000 units', over.r, failMain(E.ARG_LIMIT));
        check(over.fake.calls.every((c) => argvUnits(c.argv) <= MAX_UNITS) && over.fake.calls.every((c) => c.kind !== 'content'), 'no oversized executor call was made', over.fake.calls.map((c) => argvUnits(c.argv)));
      }
      const grepOdd = padTo((p) => V_GREP('x', C, [LIT(p)], []), MAX_UNITS + 1, 's');
      check(grepOdd !== null, 'premise: a one-selector grep of exactly 24001 units exists');
      if (grepOdd !== null) {
        const s = await seamMain(core, context, ['grep', 'c4-head', 'x', '--', grepOdd], { world: { tree: [grepOdd], content: Buffer.from('G\n') } });
        expectMain(check, 'grep at 24001 units', s.r, failMain(E.ARG_LIMIT));
        check(s.fake.calls.every((c) => c.kind !== 'content'), 'no content call at 24001 units', s.fake.kinds());
        const fit = grepOdd.slice(0, -1);
        const f = await seamMain(core, context, ['grep', 'c4-head', 'x', '--', fit], { world: { tree: [fit], content: Buffer.from('G\n') } });
        expectMain(check, 'grep at 23999 units', f.r, { exit: 0, stdout: 'G\n' });
      }
      const astral = '\u{10000}';
      const base0 = argvUnits([...PREFIX, ...V_CAT(C, '')]);
      const m = Math.ceil((MAX_UNITS - base0) / 4) + 1;
      const wide = astral.repeat(m);
      check(argvUnits([...PREFIX, ...V_CAT(C, wide)]) > MAX_UNITS && argvUnits([...PREFIX, ...V_CAT(C, 'x'.repeat(m))]) < MAX_UNITS, 'premise: the astral path exceeds the bound in UTF-16 units but not in code points');
      const w = await seamMain(core, context, ['cat', 'c4-head', '--', wide], { world: { content: Buffer.from('W\n') } });
      expectMain(check, 'cat of an astral-character path over the UTF-16 bound', w.r, failMain(E.ARG_LIMIT));
      // PLAN-GAP: the spelling of an executor length failure is not pinned beyond the codes E2BIG and ENAMETOOLONG; the bare codes are used as the result's error string.
      for (const code of ['E2BIG', 'ENAMETOOLONG']) {
        const r = await seamMain(core, context, ['cat', 'c4-head', '--', 'safe.txt'], { world: { content: { status: null, signal: null, error: code, stdout: EMPTY, overflow: false } } });
        expectMain(check, `an executor ${code}`, r.r, failMain(E.ARG_LIMIT));
      }
      const safe = Array.from({ length: 5000 }, (_, i) => `docs/safe-file-${i}-${'y'.repeat(40)}.txt`);
      const many = await seamMain(core, context, ['diff', 'c4-base..c4-head'], { world: { inv: { diff: nul(safe) }, content: Buffer.from('MANY\n') } });
      expectMain(check, 'many safe names', many.r, { exit: 0, stdout: 'MANY\n' });
      check(eq(many.ops[3], V_DIFF('patch', rid('c4-base'), C, [], [])) && !many.ops[3].some((a) => a.startsWith(':(')), 'safe names are never expanded into positive pathspecs', many.ops[3] && many.ops[3].slice(-4));
      const prot = Array.from({ length: 600 }, (_, i) => `private/${String(i).padStart(4, '0')}-${'z'.repeat(40)}.txt`);
      const heavy = await seamMain(core, context, ['diff', 'c4-base..c4-head'], { world: { inv: { diff: nul([...prot, 'ok.txt']) }, content: Buffer.from('HEAVY\n') } });
      expectMain(check, 'many protected names', heavy.r, failMain(E.ARG_LIMIT));
      check(heavy.fake.calls.every((c) => c.kind !== 'content') && heavy.fake.calls.every((c) => argvUnits(c.argv) <= MAX_UNITS), 'the oversized content call was not made', heavy.fake.kinds());
    });
  });
}

// ================================================= R76/C4/revisions ====
// Plan 3.3 (commit resolution), 3.2, 4.9: content commands receive resolved commits.
async function revisions(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    const fx = await useFx(failures, context);
    if (!core || !fx) return;
    const head = rev(fx, 'c4-head'); const base = rev(fx, 'c4-base');
    const h = await openReal(core, context, fx, PL);
    const cat = async (spelling, p = 'safe.txt') => h.attempt(['cat', spelling, '--', p]);
    await step('real Git: a branch, a lightweight tag, an annotated tag, a full ID and bare and numbered ancestry all resolve to commits', async () => {
      const want = (r, bytes_) => !r.threw && sameBuf(r.value, Buffer.from(bytes_));
      for (const [sp, text] of [['c4-head', 'needle\n'], ['c4-base', 'base\n'], ['lt-tag', 'base\n'], ['at-tag', 'needle\n'], [head, 'needle\n'], [head.slice(0, 12), 'needle\n'], ['c4-head^', 'base\n'], ['c4-head~', 'base\n'], ['c4-head~1', 'base\n'], ['c4-head^0', 'needle\n'], ['at-tag~', 'base\n']]) {
        const r = await cat(sp);
        check(want(r, text), `cat ${sp.slice(0, 14)} -- safe.txt is ${show(text)}`, r.threw ? errMsg(r.error) : r.value);
        check(eq(h.ops()[0], V_RESOLVE(sp)), `${sp.slice(0, 14)}: the resolution vector is rev-parse --verify --quiet --end-of-options <spelling>^{commit}`, h.ops()[0]);
      }
      const num = await cat('mh-m^2', 'src/current.pem'); const first = await cat('mh-m^1', 'src/current.pem'); const two = await cat('mh-m~2', 'src/hidden.pem');
      check(!num.threw && sameBuf(num.value, Buffer.from('C4-DUMMY-CURRENT-PEM\n')), 'a numbered parent (^2) selects the second parent', num.threw ? errMsg(num.error) : num.value);
      check(first.threw && first.error.message === E.GIT, 'the first parent does not hold that file', first.threw ? first.error.message : first.value);
      check(!two.threw && sameBuf(two.value, Buffer.from('C4-DUMMY-HIDDEN-PEM\n')), 'a numbered ancestor (~2) selects the grandparent chain', two.threw ? errMsg(two.error) : two.value);
    });
    await step('real Git: a blob ID, a tree ID, a missing revision and a root-parent are GIT_SAFE_REVISION; content uses the resolved ID', async () => {
      const blobId = gitOk(context, fx.root, ['rev-parse', 'c4-head:safe.txt']).text;
      const treeId = gitOk(context, fx.root, ['rev-parse', 'c4-head^{tree}']).text;
      for (const [label, sp] of [['a blob ID', blobId], ['a tree ID', treeId], ['a missing name', 'no-such-ref'], ['a missing 40-digit ID', '0'.repeat(40)], ['a missing ancestor', 'c4-base~1'], ['too many parents', 'c4-head^3']]) {
        const r = await cat(sp);
        check(r.threw && r.error.code === 'GIT_SAFE_REVISION' && r.error.message === E.REVISION, `${label} is GIT_SAFE_REVISION`, r.threw ? r.error.message : r.value);
        check(h.log.slice(2).every((l) => kindOf(l.op) === 'resolve'), `${label}: no content call followed`, h.kinds());
      }
      for (const argv of [['show', blobId], ['ls', treeId], ['diff', `${blobId}..${treeId}`]]) {
        const r = await h.attempt(argv);
        check(r.threw && r.error.message === E.REVISION, `${argv.join(' ').slice(0, 40)}: an object ID that is not a commit is refused`, r.threw ? r.error.message : r.value);
      }
    });
    await step('seam: one resolution per distinct spelling, in first-occurrence order; LF and CRLF output; the resolved IDs reach the content argv', async () => {
      const B = rid('c4-base'); const C = rid('c4-head');
      const same = await seamMain(core, context, ['diff', 'c4-head..c4-head'], { world: tableWorld() });
      check(eq(same.ops, [V_RESOLVE('c4-head'), V_INV_DIFF(C, C, []), V_DIFF('patch', C, C, [], XCL)]), 'a repeated spelling is resolved once', same.ops.map((o) => o.slice(0, 5)));
      const lg = await seamMain(core, context, ['log', '-p', 'HEAD..HEAD~'], { world: tableWorld() });
      check(eq(lg.ops.slice(0, 2), [V_RESOLVE('HEAD'), V_RESOLVE('HEAD~')]), 'two spellings are resolved in the order of first occurrence', lg.ops.slice(0, 2));
      for (const [label, f] of [['LF', (o) => `${o}\n`], ['CRLF', (o) => `${o}\r\n`]]) {
        const s = await seamMain(core, context, ['cat', 'c4-head', '--', 'safe.txt'], { world: { resolveOut: (sp) => f(fakeOid(sp)), content: Buffer.from('OK\n') } });
        expectMain(check, `${label} resolution output`, s.r, { exit: 0, stdout: 'OK\n' });
        check(eq(s.ops, [V_RESOLVE('c4-head'), V_CAT(C, 'safe.txt')]), `${label} resolution output: the content vector uses the resolved ID`, s.ops);
      }
      const wide = await seamMain(core, context, ['cat', 'c4-head', '--', 'safe.txt'], { world: { resolveOut: () => `${'a'.repeat(64)}\n`, content: Buffer.from('OK\n') } });
      check(eq(wide.ops[1], V_CAT('a'.repeat(64), 'safe.txt')), 'a 64-digit object ID is accepted', wide.ops);
      for (const argv of [['show', 'c4-head'], ['ls', 'c4-head'], ['grep', 'c4-head', 'x'], ['diff', 'c4-base..c4-head'], ['log', 'c4-head']]) {
        const s = await seamMain(core, context, argv, { world: tableWorld() });
        const used = JSON.stringify(s.ops.slice(argv[0] === 'diff' ? 2 : 1));
        check(!used.includes('c4-head') && !used.includes('c4-base') && used.includes(argv[0] === 'diff' ? B : C), `${argv[0]}: no caller revision string reaches an inventory or content vector`, used.slice(0, 200));
      }
    });
    await step('seam: a nonzero resolution is GIT_SAFE_REVISION; malformed or empty successful output is GIT_SAFE_RECORD; the first failed endpoint ends the command', async () => {
      const miss = await seamMain(core, context, ['diff', 'c4-base..c4-head'], { world: { ...tableWorld(), missing: new Set(['c4-base']) } });
      expectMain(check, 'a missing first endpoint', miss.r, failMain(E.REVISION));
      check(miss.fake.calls.every((c) => ['version', 'root', 'resolve'].includes(c.kind)), 'no inventory or content call happens after a failed resolution', miss.fake.kinds());
      const miss2 = await seamMain(core, context, ['diff', 'c4-base..c4-head'], { world: { ...tableWorld(), missing: new Set(['c4-head']) } });
      expectMain(check, 'a missing second endpoint', miss2.r, failMain(E.REVISION));
      const good = fakeOid('x');
      const malformed = [['empty output', ''], ['no terminator', good], ['upper case', `${good.toUpperCase()}\n`], ['39 digits', `${good.slice(1)}\n`], ['41 digits', `${good}0\n`], ['two lines', `${good}\n${good}\n`], ['extra text', `${good} x\n`], ['a leading space', ` ${good}\n`], ['non-hex', `${'g'.repeat(40)}\n`], ['only LF', '\n'], ['a lone CR', `${good}\r`], ['a trailing blank line', `${good}\n\n`]];
      for (const [label, out] of malformed) {
        const s = await seamMain(core, context, ['cat', 'c4-head', '--', 'safe.txt'], { world: { resolveOut: () => out, content: Buffer.from('LEAK\n') } });
        expectMain(check, `resolution output: ${label}`, s.r, failMain(E.RECORD));
        check(s.fake.calls.every((c) => c.kind !== 'content'), `resolution output ${label}: no content call`, s.fake.kinds());
      }
    });
    await step('seam: three-dot diff takes the ordinary single merge-base as the left side; nonzero is GIT_SAFE_GIT; empty or malformed output is GIT_SAFE_RECORD', async () => {
      const B = rid('c4-base'); const C = rid('c4-head');
      const mb = fakeOid('the-merge-base');
      const ok = await seamMain(core, context, ['diff', 'c4-base...c4-head'], { world: { ...tableWorld(), mergeBase: `${mb}\n` } });
      check(eq(ok.ops, [V_RESOLVE('c4-base'), V_RESOLVE('c4-head'), V_MERGE_BASE(B, C), V_INV_DIFF(mb, C, []), V_DIFF('patch', mb, C, [], XCL)]), 'merge-base A B (no --all), then the inventory and the content use its ID as the left side', ok.ops.map((o) => o.slice(0, 4)));
      const bad = await seamMain(core, context, ['diff', 'c4-base...c4-head'], { world: { ...tableWorld(), handle: (kind) => (kind === 'mergeBase' ? { status: 1, signal: null, error: null, stdout: EMPTY, overflow: false } : undefined) } });
      expectMain(check, 'merge-base nonzero', bad.r, failMain(E.GIT));
      for (const [label, out] of [['empty', ''], ['no terminator', mb], ['upper case', `${mb.toUpperCase()}\n`], ['two lines', `${mb}\n${mb}\n`], ['short', `${mb.slice(2)}\n`], ['extra', `${mb} x\n`]]) {
        const s = await seamMain(core, context, ['diff', 'c4-base...c4-head'], { world: { ...tableWorld(), mergeBase: out } });
        expectMain(check, `merge-base output: ${label}`, s.r, failMain(E.RECORD));
        check(s.fake.calls.every((c) => c.kind !== 'invDiff' && c.kind !== 'content'), `merge-base output ${label}: no inventory or content call`, s.fake.kinds());
      }
      const two = await seamMain(core, context, ['diff', 'c4-base..c4-head'], { world: tableWorld() });
      check(!two.fake.calls.some((c) => c.kind === 'mergeBase'), 'a two-dot diff never calls merge-base', two.fake.kinds());
    });
    await step('seam: a ref that moves after resolution does not change the content argv; zero-count log runs the policy and the resolution only; no rev-list and one inventory', async () => {
      const first = fakeOid('moving-old'); const second = fakeOid('moving-new');
      const ids = { moving: first };
      const mv = await seamMain(core, context, ['show', 'moving'], { world: { ...tableWorld(), ids, handle: (kind) => { if (kind === 'invShow') ids.moving = second; return undefined; } } });
      check(eq(mv.ops, [V_RESOLVE('moving'), V_INV_SHOW(first, []), V_SHOW('patch', first, [], XCL)]), 'the inventory and content use the originally resolved ID after the ref moved', mv.ops.map((o) => o.slice(0, 4)));
      check(mv.fake.calls.filter((c) => c.kind === 'resolve').length === 1, 'the moved ref was resolved exactly once');
      const z = await seamMain(core, context, ['log', '--max-count=0', 'c4-base...c4-head'], { world: tableWorld() });
      expectMain(check, 'log --max-count=0', z.r, { exit: 0, stdout: EMPTY });
      check(eq(z.ops, [V_RESOLVE('c4-base'), V_RESOLVE('c4-head')]) && z.reads.length === 1, 'version, root, policy and resolution run; inventory and content do not', { ops: z.ops.map((o) => o.slice(0, 5)), reads: z.reads.length });
      const z1 = await seamMain(core, context, ['log', '-p', '-n0', 'c4-head'], { world: tableWorld() });
      check(eq(z1.ops, [V_RESOLVE('c4-head')]) && z1.r.exitCode === 0, 'a single-revision zero-count log resolves and stops', z1.ops.map((o) => o.slice(0, 5)));
      const zm = await seamMain(core, context, ['log', '-n0', 'c4-head'], { world: { ...tableWorld(), missing: new Set(['c4-head']) } });
      expectMain(check, 'zero-count log of a missing revision', zm.r, failMain(E.REVISION));
      const zp = await seamMain(core, context, ['log', '-n0', 'c4-head'], { policyText: '{ not json' });
      check(zp.r.exitCode === 2 && zp.r.stderr.startsWith('git-safe: POLICY_JSON: ') && zp.fake.calls.length === 2, 'zero-count log still validates the policy', zp.r.stderr);
      for (const argv of [['log', '-p', 'c4-base..c4-head'], ['log', 'c4-head'], ['diff', 'c4-base...c4-head'], ['show', 'c4-head']]) {
        const s = await seamMain(core, context, argv, { world: tableWorld() });
        check(!s.fake.calls.some((c) => c.argv.includes('rev-list')) && s.fake.calls.filter((c) => c.kind.startsWith('inv')).length === 1, `${argv[0]}: no rev-list and exactly one inventory process`, s.fake.kinds());
      }
    });
  });
}

// ============================================== R76/C4/isolation ====
// Plan 3.3, 3.4, 4.10 and C4-P3-2 to C4-P3-4: environment sanitizing, the fixed prefix, the preserved configuration sources, executable filters and the installed
// entrypoint. Real Git is used for the sentinel and configuration tests; the version table uses the seam.
const q = (s) => `"${fwd(s)}"`;
async function withPlatform(platform, fn) {
  const d = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  try { return await fn(); } finally { Object.defineProperty(process, 'platform', d); }
}
const VERSION_OK = ['git version 2.31.0\n', 'git version 2.31\n', 'git version 2.53.0.windows.2\r\n', 'git version 3.0.0\n', 'git version 2.39.5 (Apple Git-154)\n', 'git version 2.100.0\n', 'git version 10.2.0\n', 'git version 2.31.0-rc1\n', 'git version 2.31.0.0\n'];
const VERSION_BAD = ['git version 2.30.9\n', 'git version 2.30.9.windows.1\n', 'git version 2.9.0\n', 'git version 1.99.0\n', 'git version 2\n', '', '\n', 'garbage\n', 'git version\n', 'git version 2.31.0', 'git version 2.31.0\nextra\n', 'git version 2.31.0\n\n', ' git version 2.31.0\n', 'GIT VERSION 2.31.0\n', 'git version x.y\n', Buffer.from([0x67, 0x69, 0x74, 0x20, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f, 0x6e, 0x20, 0x32, 0x2e, 0x33, 0x31, 0xff, 0x0a])];
async function isolation(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    const fx = await useFx(failures, context);
    if (!core) return;
    await step('sanitizeGitEnvironment: every removed name in every case, numbered keys, the five fixed values, every other value preserved, a new ordinary object, the input untouched', async () => {
      const input = {};
      for (const n of ENV_REMOVE) input[n] = `value-of-${n}`;
      Object.assign(input, { HOME: '/h', USERPROFILE: '/u', PATH: '/p', GIT_CONFIG_GLOBAL: '/fixture/global.cfg', GIT_CONFIG_SYSTEM: '/fixture/system.cfg', GIT_CONFIG_NOSYSTEM: '1', GIT_TEST_ASSUME_DIFFERENT_OWNER: '1', FOO: 'bar', EMPTY_VALUE: '',
        GIT_CONFIG_KEY_0: 'k', GIT_CONFIG_VALUE_0: 'v', GIT_CONFIG_KEY_12: 'k', GIT_CONFIG_VALUE_345: 'v', GIT_CONFIG_KEY_X: 'kept', GIT_CONFIG_VALUE_: 'kept', GIT_CONFIG_KEYS: 'kept', GIT_CONFIG_KEY_1a: 'kept', MY_GIT_PAGER: 'kept', GIT_PAGER_X: 'kept', Path: 'C:/mixed-case-path' });
      const frozen = deepFreeze(clone(input));
      const out = await attempt(() => core.sanitizeGitEnvironment(frozen));
      check(!out.threw && !(out.value && typeof out.value.then === 'function'), 'the sanitizer is synchronous and accepts a frozen plain object', out.threw ? errMsg(out.error) : null);
      if (out.threw) return;
      check(eq(entriesOf(out.value), entriesOf(expectedEnv(input))), 'the result is the input without the removed names (and numbered keys), with exactly the five fixed values set', out.value);
      check(Object.getPrototypeOf(out.value) === Object.prototype && out.value !== frozen, 'a new ordinary object, not the input');
      check(eq(frozen, input), 'the input object is not mutated');
      for (const k of ENV_PRESERVED) if (hasOwn(input, k)) check(out.value[k] === input[k], `${k} is preserved exactly`, out.value[k]);
      check(out.value.GIT_CONFIG_GLOBAL === '/fixture/global.cfg' && out.value.GIT_CONFIG_SYSTEM === '/fixture/system.cfg' && out.value.GIT_CONFIG_NOSYSTEM === '1', 'the user-selected configuration sources are kept, never replaced by null devices');
      for (const k of ['GIT_CONFIG_KEY_X', 'GIT_CONFIG_VALUE_', 'GIT_CONFIG_KEYS', 'GIT_CONFIG_KEY_1a', 'MY_GIT_PAGER', 'GIT_PAGER_X', 'Path', 'EMPTY_VALUE']) check(out.value[k] === input[k], `the lookalike or unrelated ${k} is not removed`, out.value[k]);
      const lower = {}; const mixed = {};
      for (const n of ENV_REMOVE) { lower[n.toLowerCase()] = 'x'; mixed[n.charAt(0) + n.slice(1).toLowerCase()] = 'x'; }
      Object.assign(lower, { git_config_key_0: 'k', git_config_value_7: 'v' }); Object.assign(mixed, { Git_Config_Key_3: 'k', Git_Config_Value_9: 'v' });
      for (const [label, env] of [['lower-case', lower], ['mixed-case', mixed]]) {
        const r = core.sanitizeGitEnvironment({ ...env, KEEP_ME: 'yes' });
        check(eq(entriesOf(r), entriesOf({ ...ENV_SET, KEEP_ME: 'yes' })), `${label} spellings of every removed name are removed (removal is case-insensitive) and the fixed values are set`, r);
      }
      const hosted = [];
      for (const p of ['win32', 'linux', 'darwin']) hosted.push(await withPlatform(p, async () => core.sanitizeGitEnvironment(clone(input))));
      check(eq(entriesOf(hosted[0]), entriesOf(hosted[1])) && eq(entriesOf(hosted[1]), entriesOf(hosted[2])), 'the result depends only on the input, not on the platform');
      for (const [label, v] of [['null', null], ['undefined', undefined], ['an array', []], ['a string', 'x'], ['a number', 5], ['a number value', { A: 1 }], ['an undefined value', { A: undefined }], ['a null value', { A: null }], ['an object value', { A: {} }], ['a Map', new Map()]]) {
        await expectErr(check, `sanitizer rejects ${label}`, () => core.sanitizeGitEnvironment(v), E.INPUT);
      }
    });
    await step('seam: every executor call gets the sanitized environment; injected configuration, numbered keys and case variants never reach it; the caller object is untouched', async () => {
      const env = { ...SEAM_ENV, git_pager: 'x', GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'diff.external', GIT_CONFIG_VALUE_0: '/bad', Git_Literal_Pathspecs: '1', GIT_ICASE_PATHSPECS: '1', Pager: 'more', GIT_ATTR_SOURCE: 'x', GIT_REPLACE_REF_BASE: 'x' };
      const snap = clone(env);
      const s = await seamMain(core, context, ['show', 'c4-head'], { env, world: tableWorld() });
      checkCalls(check, 'sanitized environment', s.fake, { env });
      check(s.fake.calls.length >= 5 && eq(env, snap), 'five or more calls were checked and the caller environment is unchanged', s.fake.calls.length);
      const c = s.fake.calls[0].env;
      check(!Object.keys(c).some((k) => /^(git_config_(key|value)_|git_literal|git_icase|git_config_count|git_attr_source|git_replace_ref_base)/i.test(k)) && !Object.keys(c).includes('git_pager') && !Object.keys(c).includes('Pager') && c.GIT_PAGER === 'cat' && c.PAGER === 'cat' && c.GIT_TERMINAL_PROMPT === '0' && c.GIT_OPTIONAL_LOCKS === '0' && c.GIT_NO_REPLACE_OBJECTS === '1', 'the executor environment holds the five fixed values and none of the injected names', Object.keys(c).sort());
      check(c.GIT_CONFIG_GLOBAL === SEAM_ENV.GIT_CONFIG_GLOBAL && c.GIT_CONFIG_SYSTEM === SEAM_ENV.GIT_CONFIG_SYSTEM && c.GIT_CONFIG_NOSYSTEM === '1' && c.GIT_TEST_ASSUME_DIFFERENT_OWNER === '1', 'GIT_CONFIG_GLOBAL, GIT_CONFIG_SYSTEM, GIT_CONFIG_NOSYSTEM and the safe.directory test variable are passed exactly');
    });
    await step('the session snapshots process.platform at creation: NUL on Windows, /dev/null elsewhere, whatever the platform is later', async () => {
      for (const [plat, dev] of [['linux', '/dev/null'], ['win32', 'NUL'], ['darwin', '/dev/null']]) {
        const fake = makeFake(context, tableWorld());
        const session = await withPlatform(plat, () => core.createGitSession({ cwd: fake.paths.start, env: SEAM_ENV, execute: fake.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) }));
        const out = await attempt(() => core.executeGitSafe(core.parseGitSafeArgs(['cat', 'c4-head', '--', 'safe.txt']), session));
        check(!out.threw && fake.calls.length === 4, `${plat}: the session works after the platform changed back`, out.threw ? errMsg(out.error) : fake.calls.length);
        const want = prefixOf(dev);
        check(fake.calls.every((c) => eq(c.argv.slice(0, want.length), want)), `${plat}: every call, also those after the platform changed, carries diff.orderFile=${dev}`, fake.calls.map((c) => c.argv[want.indexOf(`diff.orderFile=${dev}`)]));
        check(eq(want.filter((a) => a.startsWith('diff.orderFile=')), [`diff.orderFile=${dev}`]), `premise: the expected prefix holds the ${dev} order file`);
      }
    });
    await step('the version table (C4-P3-2): accepted and refused spellings; a refusal stops before the root lookup, the policy read and every later operation; the check runs once per session', async () => {
      for (const v of VERSION_OK) {
        const s = await seamMain(core, context, ['ls', 'c4-head'], { world: { version: v, tree: ['a.txt'] } });
        expectMain(check, `version ${show(String(v)).slice(0, 50)}`, s.r, { exit: 0, stdout: 'a.txt\0' });
      }
      for (const v of VERSION_BAD) {
        const s = await seamMain(core, context, ['ls', 'c4-head'], { world: { version: v, tree: ['a.txt'] } });
        expectMain(check, `version ${show(Buffer.isBuffer(v) ? 'bytes' : v).slice(0, 50)}`, s.r, failMain(E.VERSION));
        check(s.fake.calls.length === 1 && s.reads.length === 0, 'a version refusal makes no root lookup, no policy read and no later call', { calls: s.fake.calls.length, reads: s.reads.length });
      }
      for (const [label, res] of [['a nonzero status', { status: 1, signal: null, error: null, stdout: Buffer.from('MARKER'), overflow: false }], ['a spawn failure', { status: null, signal: null, error: 'ENOENT', stdout: EMPTY, overflow: false }]]) {
        const s = await seamMain(core, context, ['ls', 'c4-head'], { world: { version: res } });
        expectMain(check, `version command: ${label}`, s.r, failMain(E.GIT));
        check(s.fake.calls.length === 1 && s.reads.length === 0, `version command ${label}: nothing follows`, s.fake.kinds());
      }
      const fake = makeFake(context, tableWorld());
      const session = await core.createGitSession({ cwd: fake.paths.start, env: SEAM_ENV, execute: fake.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      for (const argv of [['cat', 'c4-head', '--', 'safe.txt'], ['ls', 'c4-head'], ['show', 'c4-head']]) await core.executeGitSafe(core.parseGitSafeArgs(argv), session);
      check(fake.calls.filter((c) => c.kind === 'version').length === 1 && fake.calls.filter((c) => c.kind === 'root').length === 1, 'the version and the root are checked once per session, not once per command', fake.kinds());
    });
    if (!fx) return;
    const proj = installFxReader(context, fx, failures);
    await step('safe.directory (C4-P3-3): the installed CLI uses the fixture-owned global file selected by GIT_CONFIG_GLOBAL; an empty file gives the exact repository error', async () => {
      if (!proj) return;
      const allow = path.join(context.tmp, 'c4-safe-directory.gitconfig');
      putFile(allow, '[safe]\n\tdirectory = *\n');
      const empty = path.join(context.tmp, 'c4-safe-directory-empty.gitconfig');
      putFile(empty, '');
      const base = { ...context.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TEST_ASSUME_DIFFERENT_OWNER: '1' };
      const head = rev(fx, 'c4-head');
      const ok = execNode(context, { cwd: fx.root, script: proj.entry, args: ['cat', head, '--', 'safe.txt'], env: { ...base, GIT_CONFIG_GLOBAL: allow } });
      check(ok.dead === null && ok.code === 0 && ok.stderr === '' && ok.stdout.length > 0, 'with safe.directory = * in the selected file the command succeeds', { code: ok.code, err: ok.stderr.slice(0, 200), out: ok.stdout.slice(0, 60) });
      const no = execNode(context, { cwd: fx.root, script: proj.entry, args: ['cat', head, '--', 'safe.txt'], env: { ...base, GIT_CONFIG_GLOBAL: empty } });
      check(no.dead === null && no.code === 2 && no.stdout === '' && no.stderr === stderrLine(E.REPOSITORY), 'control: an empty global file gives exactly git-safe: GIT_SAFE_REPOSITORY (exit 2, empty stdout)', { code: no.code, out: no.stdout.slice(0, 60), err: no.stderr.slice(0, 200) });
      // the same variables at the seam: the fixture-owned file path and the ownership test variable reach every executor call exactly as given
      const seamEnv = { ...SEAM_ENV, GIT_CONFIG_GLOBAL: allow, GIT_CONFIG_NOSYSTEM: '1', GIT_TEST_ASSUME_DIFFERENT_OWNER: '1' };
      const s = await seamMain(core, context, ['cat', 'c4-head', '--', 'safe.txt'], { env: seamEnv });
      check(s.fake.calls.length === 4 && s.fake.calls.every((c) => c.env.GIT_CONFIG_GLOBAL === allow && c.env.GIT_CONFIG_NOSYSTEM === '1' && c.env.GIT_TEST_ASSUME_DIFFERENT_OWNER === '1'), 'at the seam GIT_CONFIG_GLOBAL is the fixture-owned file on every call and the other two variables are preserved', s.fake.calls.map((c) => c.env.GIT_CONFIG_GLOBAL));
    });
    await step('the installed entrypoint executes through a supported alternate path (C4-P3-4): a junction on Windows, a directory symlink elsewhere', async () => {
      if (!proj) return;
      const link = path.join(scratchDir(context, 'link'), 'project-link');
      // I4-3: a junction (no privilege needed) or a directory symlink that cannot be created is a failure, never a silent skip: the step never passes without running the launch
      let linked = true;
      try { fs.symlinkSync(fx.root, link, WIN ? 'junction' : 'dir'); } catch (e) { linked = false; check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'} for the alternate-path launch (C4-P3-4)`, errMsg(e)); }
      if (!linked) return;
      check(exists(path.join(link, '.ai', 'tools', 'git-safe.mjs')), 'premise: the installed entrypoint is reachable through the link spelling');
      const head = rev(fx, 'c4-head');
      const r = execNode(context, { cwd: link, script: path.join(link, '.ai', 'tools', 'git-safe.mjs'), args: ['cat', head, '--', 'safe.txt'] });
      check(r.dead === null && r.code === 0 && r.stdout === 'needle\n' && r.stderr === '', 'through the link spelling the CLI prints the committed bytes (never an empty successful no-op)', { code: r.code, out: r.stdout.slice(0, 80), err: r.stderr.slice(0, 200) });
      const direct = execNode(context, { cwd: fx.root, script: proj.entry, args: ['cat', head, '--', 'nope.txt'] });
      check(direct.code === 2 && direct.stderr === stderrLine(E.GIT) && direct.stdout === '', 'control: a failing command through the real path exits 2 with the exact line', { code: direct.code, err: direct.stderr.slice(0, 200) });
    });
    await step('hostile configuration and injected environment: no external diff, textconv, fsmonitor or pager runs, and every output keeps the pinned shape and bytes', async () => {
      const dir = scratchDir(context, 'iso');
      const repo = cloneTree(fx.root, path.join(dir, 'repo'));
      const sentinel = path.join(dir, 'sentinel.log');
      const scripts = path.join(dir, 'scripts');
      putFile(path.join(scripts, 'sentinel.mjs'), "import fs from 'node:fs';\nfs.appendFileSync(process.argv[2], `${process.argv[3]}\\n`);\n");
      putFile(path.join(scripts, 'textconv.mjs'), "import fs from 'node:fs';\nfs.appendFileSync(process.argv[2], 'textconv\\n');\nprocess.stdout.write('TEXTCONV-OUTPUT\\n');\n");
      const cmd = (kind) => `${q(process.execPath)} ${q(path.join(scripts, 'sentinel.mjs'))} ${q(sentinel)} ${kind}`;
      const tcCmd = `${q(process.execPath)} ${q(path.join(scripts, 'textconv.mjs'))} ${q(sentinel)}`;
      const order = path.join(dir, 'orderfile');
      putFile(order, 'b.txt\na.txt\n');
      putFile(path.join(repo, '.gitattributes'), '*.txt diff=c4tc\n');
      putFile(path.join(repo, '.mailmap'), 'Mapped Name <mapped@example.invalid> <fixture@example.invalid>\n');
      const hostile = [
        '[core]', `\tpager = ${cfgVal(cmd('pager'))}`, `\tfsmonitor = ${cfgVal(cmd('fsmonitor'))}`, '\tquotePath = false',
        '[diff]', `\texternal = ${cfgVal(cmd('ext'))}`, '\trenames = copies', '\tnoprefix = true', '\tmnemonicPrefix = true', '\tsrcPrefix = SRC/', '\tdstPrefix = DST/', '\tcontext = 9', '\talgorithm = patience',
        '\tindentHeuristic = true', '\tsuppressBlankEmpty = true', '\trelative = true', '\tsubmodule = log', `\torderFile = ${cfgVal(fwd(order))}`,
        '[diff "c4tc"]', `\ttextconv = ${cfgVal(tcCmd)}`,
        '[color]', '\tui = always', '[log]', '\tfollow = true', '\tshowNotes = true', '\tshowSignature = true', '\tmailmap = true', '\tdiffMerges = first-parent',
        '[grep]', '\tpatternType = extended', '\textendedRegexp = true', '\tcolumn = true', '[submodule]', '\trecurse = true',
        '[pager]', '\tlog = true', '\tdiff = true', '\tshow = true', '\tgrep = true',
      ].join('\n');
      const env0 = isoEnv(context, hostile);
      // the same keys also in the repository-local configuration
      fs.appendFileSync(path.join(repo, '.git', 'config'), `${hostile}\n`);
      const inject = {
        GIT_EXTERNAL_DIFF: cmd('env-ext'), GIT_PAGER: cmd('env-pager'), PAGER: cmd('env-pager'), GIT_CONFIG_PARAMETERS: `'diff.external=${cmd('env-params')}'`, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'diff.external', GIT_CONFIG_VALUE_0: cmd('env-count'),
        GIT_DIFF_OPTS: '--unified=0', GIT_LITERAL_PATHSPECS: '1', GIT_GLOB_PATHSPECS: '1', GIT_ICASE_PATHSPECS: '1', GIT_DIR: path.join(dir, 'nope.git'), GIT_WORK_TREE: path.join(dir, 'nope-wt'), GIT_INDEX_FILE: path.join(dir, 'nope.index'),
        GIT_OBJECT_DIRECTORY: path.join(dir, 'nope-objects'), GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(dir, 'nope-alt'), GIT_NAMESPACE: 'bogus', GIT_PREFIX: 'bogus/', GIT_ATTR_SOURCE: 'bogus', GIT_REPLACE_REF_BASE: 'refs/bogus/',
        GIT_NO_REPLACE_OBJECTS: '0', GIT_OPTIONAL_LOCKS: '1', GIT_COMMON_DIR: path.join(dir, 'nope-common'),
      };
      const S = rev(fx, 'cnt2-s');
      gitOk(context, repo, ['notes', 'add', '-m', 'C4-NOTE-MARKER', S], { env: context.env });
      // controls: the mechanisms really fire when Git runs unrestricted in this configuration
      const raw = (args, extra = {}) => gitRun(context, repo, args, { env: { ...env0, ...extra } });
      raw(['--no-pager', 'diff', rev(fx, 'cnt2-a'), S]);
      check(readText(sentinel) !== null && /\bext\b/.test(readText(sentinel)), 'control: an unrestricted git diff runs the configured external diff', readText(sentinel));
      rmrf(sentinel);
      raw(['--no-pager', 'diff', '--no-ext-diff', rev(fx, 'cnt2-a'), S]);
      check(readText(sentinel) !== null && /textconv/.test(readText(sentinel)), 'control: an unrestricted git diff --no-ext-diff runs the configured textconv', readText(sentinel));
      rmrf(sentinel);
      const noteRaw = raw(['--no-pager', 'log', '-1', S]).text;
      check(noteRaw.includes('C4-NOTE-MARKER'), 'control: log.showNotes shows the note when Git runs unrestricted', noteRaw.slice(0, 300));
      const env = { ...env0, ...inject };
      const sess = await core.createGitSession({ cwd: repo, env, readFile: async () => bytes(jsonText(PL)) });
      const run = async (argv) => { const r = await attempt(() => core.executeGitSafe(core.parseGitSafeArgs(argv), sess)); return r.threw ? `THREW ${errMsg(r.error)}` : r.value; };
      const o1 = await run(['log', '-p', '-n1', 'cnt2-a..cnt2-c']);
      check(textOf(o1) === safeChangeText(S, 'safe.txt'), 'log -p -n1 is exactly the pinned text under hostile global, local and environment configuration (no color, notes, signature, mailmap, prefix, textconv or external diff change)', textOf(o1).slice(0, 400));
      const o2 = await run(['show', 'cnt2-s']);
      check(textOf(o2) === safeChangeText(S, 'safe.txt'), 'show is exactly the pinned text', textOf(o2).slice(0, 400));
      const o3 = await run(['diff', 'cnt2-a..cnt2-s']);
      check(textOf(o3) === safeChangeText(S, 'safe.txt').split('\n\n    safe change\n\n')[1], 'diff --patch is exactly the pinned patch with the a/ b/ prefixes', textOf(o3).slice(0, 400));
      const o4 = await run(['diff', 'ty0..ty1']);
      const two = (f, a, b) => [`diff --git a/${f} b/${f}`, `index ${blob7(a)}..${blob7(b)} 100644`, `--- a/${f}`, `+++ b/${f}`, '@@ -1 +1 @@', `-${a.trim()}`, `+${b.trim()}`, ''].join('\n');
      check(textOf(o4) === two('a.txt', 'a0\n', 'a1\n') + two('b.txt', 'b0\n', 'b1\n'), 'a configured order file does not reorder the files: a.txt before b.txt', textOf(o4).slice(0, 400));
      const o5 = await run(['grep', 'c4-head', 'needle', '--', 'safe.txt']);
      check(textOf(o5) === `${rev(fx, 'c4-head')}:safe.txt\0` + '1\0' + 'needle\n', 'grep keeps its framing under grep.column and extended-regexp configuration', textOf(o5).slice(0, 200));
      const o6 = await run(['cat', 'c4-head', '--', 'safe.txt']);
      check(textOf(o6) === 'needle\n', 'cat is unaffected', textOf(o6).slice(0, 100));
      const o7 = await run(['ls', 'lsgrep']);
      check(textOf(o7) === 'safe.txt\0src/a.txt\0', 'ls is unaffected', textOf(o7).slice(0, 100));
      const o8 = await run(['show', 'hx0']);
      check(!/C4-DUMMY/.test(textOf(o8)) && /diff --git a\/safe\.txt/.test(textOf(o8)), 'a root show under hostile configuration still omits protected content', textOf(o8).slice(0, 200));
      check(!exists(sentinel), 'no sentinel was written: no external diff, textconv, fsmonitor or pager executed (global, local and environment configuration)', readText(sentinel));
      // PLAN-GAP: whether an unrestricted git status fires the fsmonitor hook, and whether a pager can be forced without a terminal, is not pinned; no control is asserted for them, the sentinel must be absent either way.
      // log.follow cannot expose a protected path through a renamed safe path
      const leak = raw(['--no-pager', 'log', '-p', '--follow', '-M', '--no-textconv', '--no-ext-diff', 'fl0..fl1', '--', 'safe/new.txt']).text;
      check(leak.includes('C4-DUMMY-OLD-PRIVATE-LINE'), 'control: log --follow with renames would show the protected old line', leak.slice(0, 300));
      const fl = await run(['log', '-p', 'fl0..fl1', '--', 'safe/new.txt']);
      check(!/C4-DUMMY/.test(textOf(fl)) && /diff --git a\/safe\/new\.txt b\/safe\/new\.txt/.test(textOf(fl)) && /new file mode/.test(textOf(fl)), 'log.follow=true cannot expose the protected history through the renamed safe path (the file appears as a plain addition)', textOf(fl).slice(0, 300));
      check(!exists(sentinel), 'still no sentinel after the follow run', readText(sentinel));
    });
  });
}

// ================================================ R76/C4/failures ====
// Plan 3.3, 3.8, 3.9, 4.10 and C4-P3-1: policy and Git failures emit no content and only the specified diagnostic.
const LEAK = 'C4-DUMMY-LEAK-MARKER';
const badResults = (limitNull) => [
  ['a null result', null], ['a string result', { __raw: 'ok' }], ['an array result', []], ['an empty object', {}],
  ['a missing status', { signal: null, error: null, stdout: EMPTY, overflow: false }], ['a missing signal', { status: 0, error: null, stdout: EMPTY, overflow: false }], ['a missing error', { status: 0, signal: null, stdout: EMPTY, overflow: false }],
  ['a missing stdout', { status: 0, signal: null, error: null, overflow: false }], ['a missing overflow', { status: 0, signal: null, error: null, stdout: EMPTY }],
  ['an extra key', { status: 0, signal: null, error: null, stdout: EMPTY, overflow: false, extra: 1 }],
  ['status 256', { status: 256, signal: null, error: null, stdout: EMPTY, overflow: false }], ['status -1', { status: -1, signal: null, error: null, stdout: EMPTY, overflow: false }],
  ['status 1.5', { status: 1.5, signal: null, error: null, stdout: EMPTY, overflow: false }], ['a string status', { status: '0', signal: null, error: null, stdout: EMPTY, overflow: false }],
  ['an undefined status', { status: undefined, signal: null, error: null, stdout: EMPTY, overflow: false }],
  ['null status with no failure and no overflow', { status: null, signal: null, error: null, stdout: Buffer.from(LEAK), overflow: false }],
  ['status 0 with a signal', { status: 0, signal: 'SIGTERM', error: null, stdout: Buffer.from(LEAK), overflow: false }], ['status 0 with an error', { status: 0, signal: null, error: LEAK, stdout: Buffer.from(LEAK), overflow: false }],
  ['both a signal and an error', { status: null, signal: 'SIGTERM', error: LEAK, stdout: Buffer.from(LEAK), overflow: false }], ['an empty signal', { status: null, signal: '', error: null, stdout: EMPTY, overflow: false }],
  ['an empty error', { status: null, signal: null, error: '', stdout: EMPTY, overflow: false }], ['a numeric signal', { status: null, signal: 9, error: null, stdout: EMPTY, overflow: false }],
  ['a string stdout', { status: 0, signal: null, error: null, stdout: LEAK, overflow: false }], ['a null stdout', { status: 0, signal: null, error: null, stdout: null, overflow: false }],
  ['a Uint8Array stdout', { status: 0, signal: null, error: null, stdout: new Uint8Array([1, 2]), overflow: false }], ['a non-boolean overflow', { status: 0, signal: null, error: null, stdout: EMPTY, overflow: 'no' }],
  ...(limitNull ? [['overflow on an unbounded call', { status: null, signal: null, error: null, stdout: Buffer.from(LEAK), overflow: true }]] : []),
  // I4-1: overflow does not relax the other rules; only the all-null overflow result is valid, so an inconsistent combination is the Git failure, never the limit error
  ['overflow true with status 0 and a signal', { status: 0, signal: 'SIGTERM', error: null, stdout: Buffer.from(LEAK), overflow: true }],
  ['overflow true with status 0 and an error', { status: 0, signal: null, error: LEAK, stdout: Buffer.from(LEAK), overflow: true }],
  ['overflow true with both a signal and an error', { status: null, signal: 'SIGTERM', error: LEAK, stdout: Buffer.from(LEAK), overflow: true }],
  ['overflow true with a status and no failure', { status: 0, signal: null, error: null, stdout: Buffer.from(LEAK), overflow: true }],
  ['overflow true with a status 1, a signal and an oversized Buffer', { status: 1, signal: 'SIGKILL', error: null, stdout: Buffer.alloc(MAX_BYTES + 1, 0x78), overflow: true }],
];
const STAGES = [
  ['version', ['ls', 'c4-head'], 'version', true], ['root', ['ls', 'c4-head'], 'root', true], ['resolution', ['cat', 'c4-head', '--', 'safe.txt'], 'resolve', true],
  ['inventory', ['ls', 'c4-head'], 'invTree', true], ['content', ['cat', 'c4-head', '--', 'safe.txt'], 'content', false],
];
async function failuresGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    if (!core) return;
    await step('policy failures: an unreadable or non-Buffer result, invalid JSON or UTF-8, malformed fields and unknown schemas keep their exact codes; the raw policy is never echoed; nothing follows', async () => {
      const marker = LEAK;
      const withMarker = (o) => jsonText({ ...o, note: marker });
      const cases = [
        ['a missing file (ENOENT)', { readFile: async () => { throw Object.assign(new Error(`ENOENT ${marker}`), { code: 'ENOENT' }); } }, E.POLICY_IO],
        ['an unreadable file (EACCES)', { readFile: async () => { throw Object.assign(new Error(`EACCES ${marker}`), { code: 'EACCES' }); } }, E.POLICY_IO],
        ['a synchronous throw', { readFile: () => { throw new Error(marker); } }, E.POLICY_IO],
        ['a string result', { readFile: async () => jsonText(DEFAULT_POLICY) }, E.POLICY_IO], ['an undefined result', { readFile: async () => undefined }, E.POLICY_IO], ['a null result', { readFile: async () => null }, E.POLICY_IO],
        ['an object result', { readFile: async () => ({ length: 2 }) }, E.POLICY_IO], ['a Uint8Array result', { readFile: async () => new Uint8Array(Buffer.from(jsonText(DEFAULT_POLICY))) }, E.POLICY_IO],
        ['invalid JSON text', { policyText: `{ not json ${marker}` }, 'POLICY_JSON: policy text must be valid JSON'],
        ['invalid UTF-8', { policyBuf: Buffer.concat([Buffer.from('{"schema":2,"note":"'), Buffer.from([0xff, 0xfe]), Buffer.from(`${marker}"}`)]) }, 'POLICY_JSON: policy text must be valid JSON'],
        ['a root that is an array', { policyText: `[${JSON.stringify(marker)}]` }, 'POLICY_ROOT: policy must be a JSON object'], ['a root that is null', { policyText: 'null' }, 'POLICY_ROOT: policy must be a JSON object'],
        ['a missing schema', { policyText: withMarker({ patterns: [], projectPatterns: [] }) }, 'POLICY_SCHEMA: policy.schema must be 1 or 2'], ['schema 3', { policyText: withMarker({ schema: 3, patterns: [], projectPatterns: [] }) }, 'POLICY_SCHEMA: policy.schema must be 1 or 2'],
        ['a string schema', { policyText: withMarker({ schema: '2', patterns: [], projectPatterns: [] }) }, 'POLICY_SCHEMA: policy.schema must be 1 or 2'], ['schema 0', { policyText: withMarker({ schema: 0, patterns: [] }) }, 'POLICY_SCHEMA: policy.schema must be 1 or 2'],
        ['missing patterns', { policyText: withMarker({ schema: 2, projectPatterns: [] }) }, 'POLICY_PATTERNS: policy.patterns must be an array'], ['patterns not an array', { policyText: withMarker({ schema: 2, patterns: {}, projectPatterns: [] }) }, 'POLICY_PATTERNS: policy.patterns must be an array'],
        ['missing projectPatterns in schema 2', { policyText: withMarker({ schema: 2, patterns: [] }) }, 'POLICY_PROJECT_PATTERNS: policy.projectPatterns must be an array'], ['projectPatterns not an array', { policyText: withMarker({ schema: 2, patterns: [], projectPatterns: 'x' }) }, 'POLICY_PROJECT_PATTERNS: policy.projectPatterns must be an array'],
        ['an entry that is not an object', { policyText: jsonText({ schema: 2, patterns: [5], projectPatterns: [] }) }, 'POLICY_ENTRY: patterns[0] must be an object'],
        ['a project entry that is not an object', { policyText: jsonText({ schema: 2, patterns: [], projectPatterns: [{ anchor: 'any', glob: '**/x' }, null] }) }, 'POLICY_ENTRY: projectPatterns[1] must be an object'],
        ['an entry without a glob', { policyText: jsonText({ schema: 2, patterns: [{ anchor: 'any' }], projectPatterns: [] }) }, 'POLICY_GLOB: patterns[0].glob must be a nonempty string'],
        ['an unknown anchor', { policyText: jsonText({ schema: 2, patterns: [{ anchor: 'sometimes', glob: '**/x' }], projectPatterns: [] }) }, 'POLICY_ANCHOR: patterns[0].anchor must be "any" or "root"'],
      ];
      for (const [label, o, message] of cases) {
        for (const argv of [['ls', 'c4-head'], ['cat', 'c4-head', '--', 'safe.txt']]) {
          const s = await seamMain(core, context, argv, { ...o });
          expectMain(check, `${label} (${argv[0]})`, s.r, failMain(message));
          check(s.fake.calls.length === 2, `${label} (${argv[0]}): no revision resolution or content operation follows`, s.fake.kinds());
          check(!s.r.stderr.includes(marker) && !textOf(s.r.stdout).includes(marker), `${label} (${argv[0]}): the raw policy and the native exception are never echoed`);
        }
      }
      for (const [label, o] of [['an explicitly empty schema 2 policy', { policy: pol2([], []) }], ['an empty schema 1 policy', { policy: { schema: 1, patterns: [] } }], ['a policy with a BOM', { policyBuf: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(jsonText(pol2([], [])))]) }]]) {
        const s = await seamMain(core, context, ['ls', 'c4-head'], { ...o, world: { tree: ['.env', 'a.txt'] } });
        expectMain(check, label, s.r, { exit: 0, stdout: nul(['.env', 'a.txt']) });
      }
    });
    await step('root failures: a nonzero status or an invalid output is the repository error; CRLF and forward-slash roots are accepted and normalized', async () => {
      const s0 = await seamMain(core, context, ['ls', 'c4-head'], { world: { root: { status: 128, signal: null, error: null, stdout: Buffer.from(LEAK), overflow: false } } });
      expectMain(check, 'rev-parse failure', s0.r, failMain(E.REPOSITORY));
      check(s0.reads.length === 0 && s0.fake.calls.length === 2, 'no policy read follows a root failure', s0.fake.kinds());
      const badRoots = [['empty output', ''], ['only LF', '\n'], ['only CRLF', '\r\n'], ['a relative path', 'relative/dir\n'], ['an embedded LF', 'abc\ndef\n'], ['an embedded CR', 'abc\rdef\n'], ['whitespace only', '   \n'], ['invalid UTF-8', Buffer.from([0x2f, 0xff, 0x0a])], ['no terminator and relative', 'relative'], ['a double terminator', `${fwd(path.resolve('/'))}\n\n`]];
      for (const [label, out] of badRoots) {
        const s = await seamMain(core, context, ['ls', 'c4-head'], { world: { root: out, tree: ['a.txt'] } });
        expectMain(check, `root output: ${label}`, s.r, failMain(E.REPOSITORY));
        check(s.reads.length === 0, `root output ${label}: the policy is not read`, s.reads.length);
      }
      const fake = makeFake(context, { tree: ['a.txt'] });
      for (const [label, text] of [['CRLF', `${fwd(fake.paths.root)}\r\n`], ['LF', `${fwd(fake.paths.root)}\n`], ['a native-separator path', `${fake.paths.root}\n`], ['no terminator', fwd(fake.paths.root)]]) {
        const s = await seamMain(core, context, ['ls', 'c4-head'], { world: { root: text, tree: ['a.txt'] } });
        if (label === 'no terminator') { check(s.r.exitCode === 0 || s.r.stderr === stderrLine(E.REPOSITORY), 'PLAN-GAP: a root without a terminator is either accepted or the repository error', s.r.stderr); continue; }
        expectMain(check, `root output: ${label}`, s.r, { exit: 0, stdout: 'a.txt\0' });
        check(eq(s.reads, [path.join(s.fake.paths.root, '.ai', 'security-paths.json')]) && s.fake.calls.slice(2).every((c) => c.cwd === path.resolve(fwd(s.fake.paths.root))), `root output ${label}: the root is normalized for the policy path and every later cwd`, { reads: s.reads, cwd: s.fake.calls[2] && s.fake.calls[2].cwd });
      }
    });
    await step('status-level failures: a failed inventory or content call is the exact Git failure; the stage-specific nonzero codes are REVISION and GIT', async () => {
      const bad = (status, stdout = LEAK) => ({ status, signal: null, error: null, stdout: Buffer.from(stdout), overflow: false });
      for (const [label, argv, world, message] of [
        ['diff inventory', ['diff', 'c4-base..c4-head'], { handle: (k) => (k === 'invDiff' ? bad(128) : undefined) }, E.GIT],
        ['show inventory', ['show', 'c4-head'], { handle: (k) => (k === 'invShow' ? bad(1) : undefined) }, E.GIT],
        ['log inventory', ['log', 'c4-head'], { handle: (k) => (k === 'invLog' ? bad(2) : undefined) }, E.GIT],
        ['tree inventory (ls)', ['ls', 'c4-head'], { handle: (k) => (k === 'invTree' ? bad(128) : undefined) }, E.GIT],
        ['tree inventory (grep)', ['grep', 'c4-head', 'x'], { handle: (k) => (k === 'invTree' ? bad(128) : undefined) }, E.GIT],
        ['diff content', ['diff', 'c4-base..c4-head'], { content: bad(128) }, E.GIT], ['log content', ['log', '-p', 'c4-head'], { content: bad(1) }, E.GIT], ['show content', ['show', 'c4-head'], { content: bad(128) }, E.GIT],
        ['cat content', ['cat', 'c4-head', '--', 'safe.txt'], { content: bad(128) }, E.GIT], ['cat content status 1', ['cat', 'c4-head', '--', 'safe.txt'], { content: bad(1) }, E.GIT],
        ['grep content status 2', ['grep', 'c4-head', 'x'], { content: bad(2) }, E.GIT],
        ['resolution', ['cat', 'c4-head', '--', 'safe.txt'], { missing: new Set(['c4-head']) }, E.REVISION],
      ]) {
        const s = await seamMain(core, context, argv, { world: tableWorld(world) });
        expectMain(check, label, s.r, failMain(message));
        check(!s.r.stderr.includes(LEAK) && !textOf(s.r.stdout).includes(LEAK), `${label}: Git output is never copied into the diagnostic`);
      }
    });
    await step('executor-level mapping (C4-P3-1) at every stage: invalid results, signals, spawn errors, rejected promises and throws are the Git failure; E2BIG and ENAMETOOLONG are the argument-limit error; Git output and error strings never appear', async () => {
      for (const [stage, argv, kind, unbounded] of STAGES) {
        for (const [label, res] of badResults(unbounded)) {
          let used = false;
          const s = await seamMain(core, context, argv, { world: tableWorld({ handle: (k) => { if (k === kind && !used) { used = true; return res; } return undefined; } }) });
          expectMain(check, `${stage}: ${label}`, s.r, failMain(E.GIT));
        }
        const variants = [
          ['a signal', { status: null, signal: 'SIGKILL', error: null, stdout: Buffer.from(LEAK), overflow: false }, E.GIT], ['a spawn error', { status: null, signal: null, error: `ENOENT ${LEAK}`, stdout: Buffer.from(LEAK), overflow: false }, E.GIT],
          ['E2BIG', { status: null, signal: null, error: 'E2BIG', stdout: EMPTY, overflow: false }, E.ARG_LIMIT], ['ENAMETOOLONG', { status: null, signal: null, error: 'ENAMETOOLONG', stdout: EMPTY, overflow: false }, E.ARG_LIMIT],
        ];
        for (const [label, res, message] of variants) {
          let used = false;
          const s = await seamMain(core, context, argv, { world: tableWorld({ handle: (k) => { if (k === kind && !used) { used = true; return res; } return undefined; } }) });
          expectMain(check, `${stage}: ${label}`, s.r, failMain(message));
          check(!s.r.stderr.includes(LEAK), `${stage}: ${label}: the injected text never reaches the diagnostic`);
        }
        for (const [label, mk] of [['a rejected promise', () => Promise.reject(new Error(LEAK))], ['a synchronous throw', () => { throw new Error(LEAK); }]]) {
          let used = false;
          const s = await seamMain(core, context, argv, { world: tableWorld({ handle: (k) => { if (k === kind && !used) { used = true; return mk(); } return undefined; } }) });
          expectMain(check, `${stage}: ${label}`, s.r, failMain(E.GIT));
        }
      }
      // the permitted all-null overflow result at a bounded call stays the command-specific limit error (I4-1 keeps it passing)
      for (const [label, argv] of [['cat', ['cat', 'c4-head', '--', 'safe.txt']], ['diff', ['diff', 'c4-base..c4-head']], ['grep', ['grep', 'c4-head', 'needle']]]) {
        const s = await seamMain(core, context, argv, { world: tableWorld({ content: { status: null, signal: null, error: null, stdout: Buffer.from(LEAK), overflow: true } }) });
        expectMain(check, `${label}: the all-null overflow result is still the limit error`, s.r, failMain(E.LIMIT(label)));
      }
      for (const [label, res] of [['a successful normal result', { status: 0, signal: null, error: null, stdout: EMPTY, overflow: false }]]) {
        const s = await seamMain(core, context, ['ls', 'c4-head'], { world: { tree: ['a.txt'], handle: (k) => (k === 'invTree' ? res : undefined) } });
        expectMain(check, `control: ${label}`, s.r, { exit: 0, stdout: EMPTY });
      }
    });
    await step('session.git, resolveCommit and listTree: the low-level contract', async () => {
      const fake = makeFake(context, { tree: ['a.txt', { path: 'sub', mode: '160000', type: 'commit', oid: GITLINK_SHA }] });
      const session = await core.createGitSession({ cwd: fake.paths.start, env: SEAM_ENV, execute: fake.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      const resolveArgv = V_RESOLVE('x');
      const fail1 = { status: 1, signal: null, error: null, stdout: Buffer.from('MARK'), overflow: false };
      const own = makeFake(context, { handle: (k) => (k === 'resolve' ? fail1 : undefined) });
      const s2 = await core.createGitSession({ cwd: own.paths.start, env: SEAM_ENV, execute: own.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      await expectErr(check, 'a normal nonzero status throws', () => s2.git(resolveArgv), E.GIT);
      const allowed = await attempt(() => s2.git(resolveArgv, { allowFailure: true }));
      check(!allowed.threw && eq(sorted(Object.keys(allowed.value)), ['status', 'stdout']) && allowed.value.status === 1 && Buffer.isBuffer(allowed.value.stdout), 'allowFailure returns exactly { status, stdout }', allowed.threw ? errMsg(allowed.error) : allowed.value);
      const sigFake = makeFake(context, { handle: (k) => (k === 'resolve' ? { status: null, signal: 'SIGTERM', error: null, stdout: EMPTY, overflow: false } : undefined) });
      const s3 = await core.createGitSession({ cwd: sigFake.paths.start, env: SEAM_ENV, execute: sigFake.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      await expectErr(check, 'a signal always throws, even with allowFailure', () => s3.git(resolveArgv, { allowFailure: true }), E.GIT);
      for (const [label, argv, opts] of [['a non-array argv', 'status', undefined], ['a non-string element', ['rev-parse', 5], undefined], ['an unknown option key', ['rev-parse', 'HEAD'], { shell: true }], ['a bad limit', ['rev-parse', 'HEAD'], { limit: 5 }], ['a non-boolean allowFailure', ['rev-parse', 'HEAD'], { allowFailure: 'yes' }], ['a sparse argv', new Array(2), undefined]]) {
        const before = fake.calls.length;
        await expectErr(check, `session.git: ${label}`, () => session.git(argv, opts), E.INPUT);
        check(fake.calls.length === before, `session.git ${label}: no executor call`);
      }
      const lim = await attempt(() => session.git(V_ROOT, { limit: MAX_BYTES }));
      check(!lim.threw && fake.calls[fake.calls.length - 1].limit === MAX_BYTES && eq(fake.calls[fake.calls.length - 1].argv.slice(0, PREFIX.length), PREFIX), 'the limit option reaches the executor and the fixed prefix is added to the caller argv', lim.threw ? errMsg(lim.error) : null);
      const over = makeFake(context, { handle: (k) => (k === 'unknown' ? { status: null, signal: null, error: null, stdout: Buffer.alloc(MAX_BYTES + 1), overflow: true } : undefined) });
      const s4 = await core.createGitSession({ cwd: over.paths.start, env: SEAM_ENV, execute: over.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      await expectErr(check, 'session.git overflow', () => s4.git(['foo'], { limit: MAX_BYTES }), E.LIMIT_LOW);
      const rc = await attempt(() => session.resolveCommit('c4-head'));
      check(!rc.threw && rc.value === rid('c4-head') && /^[0-9a-f]{40}$/.test(rc.value), 'resolveCommit returns the lowercase object ID', rc.threw ? errMsg(rc.error) : rc.value);
      for (const bad of ['HEAD:.env', 5, 'a..b', '', '-x', null]) await expectErr(check, `resolveCommit(${show(bad)})`, () => session.resolveCommit(bad), E.INPUT);
      const lt = await attempt(() => session.listTree(rid('c4-head')));
      check(!lt.threw && eq(lt.value, [{ mode: '100644', type: 'blob', oid: OID_BLOB, path: 'a.txt' }, { mode: '160000', type: 'commit', oid: GITLINK_SHA, path: 'sub' }]), 'listTree returns { mode, type, oid, path } strings in Git order', lt.threw ? errMsg(lt.error) : lt.value);
      for (const bad of ['abc', 'A'.repeat(40), 'a'.repeat(41), 5, '', 'HEAD', null]) await expectErr(check, `listTree(${show(bad)})`, () => session.listTree(bad), E.INPUT);
      check(!(await attempt(() => session.listTree('a'.repeat(64)))).threw, 'listTree accepts a 64-digit commit ID');
    });
  });
}

// ================================================== R76/C4/limits ====
// Plan 3.8, 4.11: the complete result of every command is bounded at 1,048,576 bytes, exactly; the bound counts bytes; nothing partial is returned.
// Names that make the NUL-framed ls result exactly n bytes: every name is unique, at most 255 characters, and the total is the sum of (length + 1).
function lsNames(n) {
  if (n === 0) return [];
  const c = Math.ceil(n / 256);
  const total = n - c;
  const base = Math.floor(total / c);
  const extra = total % c;
  return Array.from({ length: c }, (_, i) => {
    const len = base + (i < extra ? 1 : 0);
    return (String(i).padStart(4, '0') + 'x'.repeat(len)).slice(0, len);
  });
}
// One minimal scenario per command: its argv, the world for a given result size or shape, and the expected stdout for a successful content.
const LIMIT_RUNS = {
  diff: { argv: ['diff', 'c4-base..c4-head'], world: (content) => tableWorld({ content }), want: (content) => content },
  log: { argv: ['log', '-p', 'c4-base..c4-head'], world: (content) => tableWorld({ content }), want: (content) => content },
  show: { argv: ['show', 'c4-head'], world: (content) => tableWorld({ content }), want: (content) => content },
  cat: { argv: ['cat', 'c4-head', '--', 'safe.txt'], world: (content) => ({ content }), want: (content) => content },
  grep: { argv: ['grep', 'c4-head', 'needle'], world: (content) => tableWorld({ content }), want: (content) => content },
  ls: { argv: ['ls', 'c4-head'], world: (n) => ({ tree: lsNames(n) }), want: (n) => nul(byUtf8(lsNames(n))) },
};
const SIZES = [0, MAX_BYTES - 1, MAX_BYTES, MAX_BYTES + 1];
async function limitsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    if (!core) return;
    await step('the exact byte boundary for all six commands: 0, 1048575 and 1048576 bytes pass unchanged; 1048577 fails with the command-specific line and no partial output', async () => {
      for (const cmd of COMMANDS) {
        const run = LIMIT_RUNS[cmd];
        for (const size of SIZES) {
          const arg = cmd === 'ls' ? size : Buffer.alloc(size, 0x78);
          const s = await seamMain(core, context, run.argv, { world: run.world(arg) });
          if (size <= MAX_BYTES) {
            const want = run.want(arg);
            check(want.length === size, `premise: the ${cmd} scenario produces exactly ${size} bytes`, want.length);
            expectMain(check, `${cmd} with ${size} bytes`, s.r, { exit: 0, stdout: want });
          } else expectMain(check, `${cmd} with ${size} bytes`, s.r, failMain(E.LIMIT(cmd)));
        }
      }
    });
    await step('multibyte data: a count of characters below the limit whose bytes cross it fails; the bytes at the limit pass', async () => {
      const over = Buffer.from('\u20ac'.repeat(349526), 'utf8');
      const fits = Buffer.from(`${'\u20ac'.repeat(349525)}a`, 'utf8');
      check(over.length === MAX_BYTES + 2 && fits.length === MAX_BYTES && '\u20ac'.repeat(349526).length < MAX_BYTES, 'premise: 349526 characters are below 1048576 characters but 1048578 bytes');
      for (const cmd of ['cat', 'diff', 'grep', 'show', 'log']) {
        const run = LIMIT_RUNS[cmd];
        const a = await seamMain(core, context, run.argv, { world: run.world(over) });
        expectMain(check, `${cmd} multibyte over the limit`, a.r, failMain(E.LIMIT(cmd)));
        const b = await seamMain(core, context, run.argv, { world: run.world(fits) });
        expectMain(check, `${cmd} multibyte at the limit`, b.r, { exit: 0, stdout: fits });
      }
    });
    await step('headers and framing count: log and show headers and the grep path prefix are part of the byte total', async () => {
      const C = rid('c4-head');
      const shaped = (head, total) => Buffer.concat([Buffer.from(head, 'utf8'), Buffer.alloc(total - Buffer.byteLength(head), 0x7a)]);
      const heads = { log: `commit ${C}\nAuthor: Fixture <fixture@example.invalid>\nDate:   Tue Nov 14 22:13:20 2023 +0000\n\n    big\n\n`, show: `commit ${C}\nAuthor: Fixture <fixture@example.invalid>\n\n`, grep: `${C}:safe.txt\0` + '1\0' };
      for (const [cmd, head] of Object.entries(heads)) {
        const run = LIMIT_RUNS[cmd];
        const ok = shaped(head, MAX_BYTES); const no = shaped(head, MAX_BYTES + 1);
        const a = await seamMain(core, context, run.argv, { world: run.world(ok) });
        expectMain(check, `${cmd} with its header, exactly at the limit`, a.r, { exit: 0, stdout: ok });
        const b = await seamMain(core, context, run.argv, { world: run.world(no) });
        expectMain(check, `${cmd} with its header, one byte over`, b.r, failMain(E.LIMIT(cmd)));
      }
    });
    await step('both overflow paths: overflow true (also with a short or partial stdout) and an oversized Buffer with overflow false', async () => {
      for (const cmd of ['cat', 'diff', 'log', 'show', 'grep']) {
        const run = LIMIT_RUNS[cmd];
        for (const [label, stdout] of [['a full-size Buffer', Buffer.alloc(MAX_BYTES + 1, 0x78)], ['a partial prefix', Buffer.from('PARTIAL-PREFIX\n')], ['an empty Buffer', EMPTY]]) {
          const w = run.world(Buffer.alloc(0));
          w.content = { status: null, signal: null, error: null, stdout, overflow: true };
          const s = await seamMain(core, context, run.argv, { world: w });
          expectMain(check, `${cmd}: overflow true with ${label}`, s.r, failMain(E.LIMIT(cmd)));
        }
        const w2 = run.world(Buffer.alloc(0));
        w2.content = { status: 0, signal: null, error: null, stdout: Buffer.alloc(MAX_BYTES + 1, 0x78), overflow: false };
        const t = await seamMain(core, context, run.argv, { world: w2 });
        expectMain(check, `${cmd}: an oversized Buffer with overflow false`, t.r, failMain(E.LIMIT(cmd)));
      }
    });
    await step('metadata inventories larger than 1 MiB are not the output bound: the final stdout is checked alone', async () => {
      const big = Array.from({ length: 12000 }, (_, i) => `private/${String(i).padStart(5, '0')}-${'m'.repeat(120)}.txt`);
      const bigTxt = nul(big);
      check(bigTxt.length > MAX_BYTES, 'premise: the inventory is larger than the output bound', bigTxt.length);
      for (const [argv, key] of [[['diff', 'c4-base..c4-head'], 'diff'], [['show', 'c4-head'], 'show'], [['log', '-p', 'c4-base..c4-head'], 'log']]) {
        const s = await seamMain(core, context, argv, { world: { inv: { [key]: bigTxt }, content: Buffer.from('MUST-NOT-RUN\n') } });
        expectMain(check, `${argv[0]} with a ${bigTxt.length}-byte inventory of protected names`, s.r, { exit: 0, stdout: EMPTY });
        check(s.fake.calls.every((c) => c.kind !== 'content'), `${argv[0]}: no content call for an all-protected inventory`, s.fake.kinds());
      }
      const tree = [...big.map((p) => `docs/${p.slice(8)}`), 'keep/me.txt'];
      const ls = await seamMain(core, context, ['ls', 'c4-head', '--', 'keep'], { world: { tree } });
      expectMain(check, 'ls with an oversized tree inventory and a narrow selector', ls.r, { exit: 0, stdout: 'keep/me.txt\0' });
      const gr = await seamMain(core, context, ['grep', 'c4-head', 'x', '--', 'keep'], { world: { tree, content: Buffer.from('HIT\n') } });
      expectMain(check, 'grep with an oversized tree inventory and a narrow selector', gr.r, { exit: 0, stdout: 'HIT\n' });
      check(Buffer.byteLength(treeBuf(tree)) > MAX_BYTES, 'premise: the tree inventory exceeds the output bound', Buffer.byteLength(treeBuf(tree)));
    });
    await step('production capture: a real blob at the limit passes unchanged; one byte more fails through the real executor with nothing streamed', async () => {
      const fx = await useFx(failures, context);
      if (!fx) return;
      const C = rev(fx, 'big');
      const policy = async () => bytes(jsonText(PL));
      const ok = await withStreamGuard(() => core.main(['cat', C, '--', 'big-ok.bin'], { cwd: fx.root, env: context.env, readFile: policy }));
      check(ok.threw === null && ok.out.length === 0 && ok.err.length === 0 && ok.exits.length === 0 && !ok.exitCodeChanged, 'main wrote nothing to the process streams and set no exit code', ok.threw && errMsg(ok.threw));
      check(ok.value && ok.value.exitCode === 0 && sameBuf(ok.value.stdout, Buffer.alloc(MAX_BYTES, 0x61)) && ok.value.stderr === '', 'cat of a 1048576-byte blob returns it unchanged', ok.value && { code: ok.value.exitCode, len: ok.value.stdout.length, err: ok.value.stderr });
      const over = await withStreamGuard(() => core.main(['cat', C, '--', 'big-over.bin'], { cwd: fx.root, env: context.env, readFile: policy }));
      check(over.threw === null && over.out.length === 0 && over.err.length === 0, 'main wrote nothing to the process streams for the oversized blob', over.threw && errMsg(over.threw));
      expectMain(check, 'cat of a 1048577-byte blob', over.value, failMain(E.LIMIT('cat')));
      const sh = await withStreamGuard(() => core.main(['show', C], { cwd: fx.root, env: context.env, readFile: policy }));
      expectMain(check, 'show of a commit whose patch exceeds the bound', sh.value, failMain(E.LIMIT('show')));
      const small = await withStreamGuard(() => core.main(['cat', C, '--', 'small.txt'], { cwd: fx.root, env: context.env, readFile: policy }));
      expectMain(check, 'control: a small blob of the same commit', small.value, { exit: 0, stdout: 'small\n' });
    });
  });
}

// ================================================ R76/C4/narrowing ====
// Plan 3.9, 4.11: the guidance map, the command-specific limit lines, the low-level limit error and the required reference text.
const REF_PARAGRAPHS = [
  'Every git-safe command limits its complete stdout result to 1,048,576 bytes. Exactly that many bytes is allowed. Larger results are refused without partial output. Narrow paths with -- <paths>; for log, use attached -n<k> or a smaller commit range. For an oversized cat result, use grep with a more selective pattern or select a smaller file. A refused result is not a completed review. After narrowing, record the reviewed subset and the scope still unreviewed.',
  'Log counts limit content output, not the names-only policy inventory. That inventory runs once over the full resolved expression. A single-revision log may walk the full reachable history; use a smaller commit range to reduce that work.',
  'Paths are literal and repository-root-relative. Secret checks are case-insensitive through the shared policy; Git object lookup preserves exact case. The installed policy is required. The reader supports policy schemas 1 and 2 and refuses unknown schemas.',
  'Git 2.31 or later is required. The reader preserves the user\'s global and system configuration sources, including safe.directory, while removing environment-injected keys and overriding the execution and output settings used by these commands.',
];
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
async function narrowing(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    if (!core) return;
    await step('NARROWING_GUIDANCE is the exact frozen map and every limit line is the pinned sentence for its command', async () => {
      check(Object.isFrozen(core.NARROWING_GUIDANCE) && eq({ ...core.NARROWING_GUIDANCE }, NARROWING) && eq(sorted(Object.keys(core.NARROWING_GUIDANCE)), sorted(COMMANDS)), 'the guidance map is exactly the six pinned sentences', core.NARROWING_GUIDANCE);
      for (const cmd of COMMANDS) {
        const run = LIMIT_RUNS[cmd];
        const s = await seamMain(core, context, run.argv, { world: run.world(cmd === 'ls' ? MAX_BYTES + 1 : Buffer.alloc(MAX_BYTES + 1, 0x78)) });
        const want = `git-safe: GIT_SAFE_LIMIT: output exceeds 1048576 bytes. ${NARROWING[cmd]} No partial result was emitted; this review is not complete.\n`;
        expectMain(check, `${cmd} limit line`, s.r, { exit: 2, stdout: EMPTY, stderr: want });
        check(s.r.stderr.endsWith('No partial result was emitted; this review is not complete.\n') && !/review is complete|completed review|fully reviewed/i.test(s.r.stderr), `${cmd}: the message never describes the narrowed subset as a completed review`, s.r.stderr);
      }
    });
    await step('the low-level session.git limit error is the bare GIT_SAFE_LIMIT line; executeGitSafe adds the guidance', async () => {
      const w = makeFake(context, { handle: (k, op) => (op[0] === 'rev-parse' && op[1] === '--git-dir' ? { status: null, signal: null, error: null, stdout: Buffer.alloc(MAX_BYTES + 1), overflow: true } : undefined) });
      const session = await core.createGitSession({ cwd: w.paths.start, env: SEAM_ENV, execute: w.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      await expectErr(check, 'session.git overflow', () => session.git(['rev-parse', '--git-dir'], { limit: MAX_BYTES }), E.LIMIT_LOW);
      const big = makeFake(context, tableWorld({ content: Buffer.alloc(MAX_BYTES + 1, 0x78) }));
      const s2 = await core.createGitSession({ cwd: big.paths.start, env: SEAM_ENV, execute: big.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      for (const cmd of ['diff', 'log', 'show', 'cat', 'grep']) await expectErr(check, `executeGitSafe ${cmd} over the limit`, () => core.executeGitSafe(core.parseGitSafeArgs(LIMIT_RUNS[cmd].argv), s2), E.LIMIT(cmd));
      const lsFake = makeFake(context, { tree: lsNames(MAX_BYTES + 1) });
      const s3 = await core.createGitSession({ cwd: lsFake.paths.start, env: SEAM_ENV, execute: lsFake.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      await expectErr(check, 'executeGitSafe ls over the limit', () => core.executeGitSafe(core.parseGitSafeArgs(['ls', 'c4-head']), s3), E.LIMIT('ls'));
    });
    await step('references/security.md carries the six supported forms, the minimum Git version, the supported schemas and the four required paragraphs', async () => {
      const doc = readText(path.join(context.skillRoot, 'references', 'security.md'));
      if (doc === null) { check(false, 'references/security.md is readable'); return; }
      const flat = squash(doc);
      for (const [i, p] of REF_PARAGRAPHS.entries()) check(flat.includes(squash(p)), `required reference paragraph ${i + 1} is present (line wrapping is free)`, p.slice(0, 80));
      for (const cmd of COMMANDS) check(flat.includes(squash(SUPPORTED_FORMS[cmd])), `the supported form of ${cmd} is listed`, SUPPORTED_FORMS[cmd]);
      check(/Git 2\.31/.test(doc) && /schemas? 1 and 2/.test(doc), 'the minimum Git version and the supported policy schemas are named');
    });
  });
}

// ============================================ apply and migration toolkit ====
// The same toolkit shape as the C3 tests: every CLI call is shell-free with the absolute Node executable; a dead process fails the calling assertion once.
const T_POLICY = '.ai/security-paths.json';
const T_SETTINGS = '.claude/settings.json';
const T_MANIFEST = '.ai/manifest.json';
const T_HELPER = '.ai/tools/security-policy.mjs';
const T_CORE = '.ai/tools/git-safe-core.mjs';
const T_REVIEW = '.ai/tools/review-diff.mjs';
const T_ENTRY = '.ai/tools/git-safe.mjs';
const T_CATALOG = 'data/runtime-units.json';
const T_DECISIONS = 'security-decisions.json';
const UNIT = [T_HELPER, T_CORE, T_REVIEW, T_ENTRY];
const SRC_OF = { [T_HELPER]: 'assets/tools/security-policy.mjs', [T_CORE]: 'assets/tools/git-safe-core.mjs', [T_REVIEW]: 'assets/tools/review-diff.mjs', [T_ENTRY]: 'assets/tools/git-safe.mjs' };
// C4 plan 2.3 as extended by C5 plan 2.4: the production catalog, exactly (the review helper is the third member, before the entrypoint).
const CATALOG_PRODUCTION = {
  schema: 1,
  units: [
    { source: 'assets/tools/security-policy.mjs', target: T_HELPER, role: 'helper', policySchemas: [1, 2] },
    { source: 'assets/tools/git-safe-core.mjs', target: T_CORE, role: 'helper', policySchemas: [1, 2] },
    { source: 'assets/tools/review-diff.mjs', target: T_REVIEW, role: 'helper', policySchemas: [1, 2] },
    { source: 'assets/tools/git-safe.mjs', target: T_ENTRY, role: 'entrypoint', policySchemas: [1, 2] },
  ],
};
// Target lookup: the synthetic three-member catalogs below never depend on a position in the production catalog.
const unitOf = (target) => CATALOG_PRODUCTION.units.find((u) => u.target === target);
const MSG = {
  PLAN_REJECTED: 'plan rejected',
  TOOL_UNREVIEWED: (t) => `TOOL_UNIT_UNREVIEWED: reviewed tool bytes required: ${t}`,
  TOOL_INCOMPATIBLE: (t) => `TOOL_UNIT_INCOMPATIBLE: compatible reviewed reader required: ${t}`,
  MIGRATION_REQUIRED: 'schema-2 policy changes with installed tools require security-decisions.json',
  DRIFT: 'changes since prepare; nothing was written. Re-run prepare and get approval again.',
  SECRET_PREPARE: 'agent drafts may not target secret-pattern paths',
};
const approvalSuffix = (t) => `Show the diff; re-run prepare with --approve-user-content ${t} only after the user approves it`;
const contentApprovalError = (t, reasons) => `${reasons.join('; ')}. ${approvalSuffix(t)}`;
const NOT_OWNED = 'draft changes content outside managed blocks (pre-existing file the skill does not own)';
const fmtOk = (r) => r.json !== null && typeof r.json === 'object' && r.stdout === jsonText(r.json);
function makeKit(context, check, skillRoot = context.skillRoot) {
  const scripts = (name) => path.join(skillRoot, 'scripts', `${name}.mjs`);
  const invoke = (label, scriptPath, args, o = {}) => {
    const r = execNode(context, { cwd: o.cwd, script: scriptPath, args, preload: o.preload || null, env: o.env || null });
    if (r.dead && !o.allowDead) check(false, `${label}: the process did not end normally`, r.dead);
    return r;
  };
  const kit = {
    context, check, scripts, skillRoot,
    apply: (root, args, o = {}) => invoke(`apply ${args[0]}`, scripts('apply'), args, { cwd: root, ...o }),
    lock: (root, args, o = {}) => invoke(`lock ${args[0]}`, scripts('lock'), args, { cwd: root, ...o }),
    withSkill: (other) => makeKit(context, check, other),
    begin(root, id) {
      const a = kit.lock(root, ['acquire', '--run-id', id]);
      const b = kit.apply(root, ['init', '--run-id', id]);
      check(a.code === 0 && b.code === 0, `begin ${id}: lock acquire and init succeed`, { a: a.stdout.slice(0, 200), b: b.stdout.slice(0, 200) });
      return a.code === 0 && b.code === 0;
    },
    prepare(root, id, o = {}) {
      const args = ['prepare', '--run-id', id, '--mode', o.mode || 'update'];
      if (o.approve && o.approve.length) args.push('--approve-user-content', o.approve.join(','));
      return kit.apply(root, args, o);
    },
    commit: (root, id, planSha, o = {}) => kit.apply(root, ['commit', '--run-id', id, '--approved-plan', planSha], o),
    diff: (root, id, o = {}) => kit.apply(o.cwd || root, ['diff', '--project', o.project !== undefined ? o.project : root, '--run-id', id], o),
    rollback: (root, id, o = {}) => kit.apply(root, ['rollback', '--run-id', id], o),
    report: (root, o = {}) => invoke('migrate report', scripts('migrate-security-paths'), ['report', '--project', root], { cwd: root, ...o }),
    stage: (root, id, o = {}) => invoke('migrate stage', scripts('migrate-security-paths'), ['stage', '--project', root, '--run-id', id], { cwd: root, ...o }),
  };
  return kit;
}
const runFile = (root, id, ...segs) => path.join(root, '.ai', '.run', id, ...segs);
const draftPath = (root, id, rel) => path.join(root, '.ai', '.run', id, 'drafts', ...rel.split('/'));
const projPath = (root, rel) => path.join(root, ...rel.split('/'));
const putDraft = (root, id, rel, data) => putFile(draftPath(root, id, rel), data);
const putRequest = (root, id, name, value) => putFile(runFile(root, id, name), typeof value === 'string' || Buffer.isBuffer(value) ? value : jsonText(value));
const readPlan = (root, id) => readJson(runFile(root, id, 'plan.json'));
const readJournal = (root, id) => readJson(runFile(root, id, 'journal.json'));
const planShaOf = (root, id) => { const b = readBytes(runFile(root, id, 'plan.json')); return b === null ? null : sha(b); };
const lockOwnerPath = (root) => path.join(root, '.ai', '.setup.lock', 'owner.json');
const manifestPath = (root) => path.join(root, '.ai', 'manifest.json');
const projectSnapshot = (root) => snapshotTree(root, ['.git']);
const byTarget = (a, b) => (a.target < b.target ? -1 : a.target > b.target ? 1 : 0);
const noWriteState = (root, id) => ({ project: projectSnapshot(root), lock: readBytes(lockOwnerPath(root)), journal: exists(runFile(root, id, 'journal.json')) });
function checkNoWrite(check, label, root, id, before) {
  check(!exists(runFile(root, id, 'journal.json')), `${label}: no journal`);
  check(projectSnapshot(root) === before.project, `${label}: no project file, plan, run file, manifest or lock changed`);
  check(sameBytes(readBytes(lockOwnerPath(root)), before.lock), `${label}: the lock bytes are unchanged (no heartbeat)`);
}
// F: a direct failure { ok:false, code, error } (plus the named extras): two-space JSON, one final LF, empty stderr (plan 3.10).
function expectF(check, label, r, { code, exit, error = null, target } = {}) {
  check(r.code === exit, `${label}: exit code ${exit}`, { code: r.code, stdout: r.stdout.slice(0, 300), stderr: r.stderr.slice(0, 200) });
  check(r.stderr === '', `${label}: empty stderr`, r.stderr.slice(0, 200));
  check(r.json !== null && fmtOk(r), `${label}: two-space JSON with one final LF`, r.stdout.slice(0, 200));
  if (!r.json) return;
  check(r.json.ok === false && r.json.code === code, `${label}: ok false with code ${code}`, { ok: r.json.ok, code: r.json.code, error: r.json.error });
  if (typeof error === 'string') check(r.json.error === error, `${label}: error is exactly ${show(error)}`, r.json.error);
  const want = sorted(['ok', 'code', 'error', ...(target !== undefined ? ['target'] : [])]);
  check(eq(sorted(Object.keys(r.json)), want), `${label}: the envelope holds exactly ${want.join(', ')}`, Object.keys(r.json));
  if (target !== undefined) check(r.json.target === target, `${label}: target is ${target}`, r.json.target);
}
// P: a prepare rejection with one entry per affected target (plan 3.10).
function expectP(check, label, r, entries, exit = 3) {
  check(r.code === exit, `${label}: exit code ${exit}`, { code: r.code, stdout: r.stdout.slice(0, 400), stderr: r.stderr.slice(0, 200) });
  check(r.stderr === '', `${label}: empty stderr`, r.stderr.slice(0, 200));
  check(r.json !== null && fmtOk(r), `${label}: two-space JSON with one final LF`, r.stdout.slice(0, 200));
  check(eq(r.json, { ok: false, code: 'APPLY_PLAN_REJECTED', error: MSG.PLAN_REJECTED, errors: entries }), `${label}: the exact plan rejection`, r.json);
}
// ---------------------------------------------------------------- git repositories ----
function gitCmd(context, cwd, args) {
  const r = spawnSync('git', args, { cwd, env: context.env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 60000 });
  return { code: r.status, stdout: String(r.stdout || '').trim(), stderr: String(r.stderr || '').trim() };
}
function makeRepo(context, dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  const a = gitCmd(context, dir, ['init', '-q']);
  for (const [rel, data] of Object.entries(files)) putFile(path.join(dir, ...rel.split('/')), data);
  gitCmd(context, dir, ['add', '-A']);
  const c = gitCmd(context, dir, ['commit', '-qm', 'init']);
  if (a.code !== 0 || c.code !== 0) throw new Error(`cannot create the fixture repository: ${a.stderr} ${c.stderr}`);
  return dir;
}
function commitAll(context, dir, msg = 'fixture') {
  gitCmd(context, dir, ['add', '-A']);
  const c = gitCmd(context, dir, ['commit', '-qm', msg, '--allow-empty']);
  if (c.code !== 0) throw new Error(`cannot commit the fixture: ${c.stderr}`);
}
const baseCache = new Map();
function cached(context, name, build) {
  const key = `${context.tmp}|${name}`;
  if (!baseCache.has(key)) baseCache.set(key, Promise.resolve().then(build));
  return baseCache.get(key);
}
// A genuine v2 installation built by the tagged scripts (C11a), committed.
const getV2Base = (context) => cached(context, 'v2', async () => {
  const dir = scratchDir(context, 'base-v2');
  const root = path.join(dir, 'root');
  const work = path.join(dir, 'work');
  makeRepo(context, root, { 'package.json': '{"name":"fixture-app"}\n', 'src/a.ts': 'export {}\n' });
  const h = await import(new URL('./helpers/v2-baseline.mjs', import.meta.url).href);
  await h.createV2InstalledFixture({ repository: context.repository, root, workDir: work, projectName: 'fixture-wallet-api' });
  commitAll(context, root, 'v2 installed');
  return { dir, root, work };
});
const reportHashOf = (report) => sha(Buffer.from(jsonText(report), 'utf8'));
const decisionsFile = (report, over = {}) => ({ schema: 1, reportSha256: reportHashOf(report), entries: [], coverage: [], denyOmissions: [], dropDenyOwnership: [], overrideUserExceptions: false, ...over });
const coverAll = (report, action = 'include') => report.coverage.map((c) => ({ id: c.id, action }));
function startMigration(kit, check, root, id, spec = {}) {
  if (!kit.begin(root, id)) return { ok: false, root, id };
  const rep = kit.report(root);
  const report = rep.json && rep.json.report;
  check(rep.code === 0 && report, `${id}: the report succeeds`, rep.stdout.slice(0, 300));
  if (!report) return { ok: false, root, id };
  putRequest(root, id, T_DECISIONS, spec.decide ? spec.decide(report) : decisionsFile(report, { coverage: coverAll(report) }));
  const st = kit.stage(root, id);
  return { ok: st.code === 0 && st.json && st.json.ok === true, root, id, report, st };
}
function prepareApproving(kit, root, id, approve = [T_POLICY], o = {}) {
  let list = [...approve];
  let last = null;
  for (let i = 0; i < 4; i++) {
    last = kit.prepare(root, id, { ...o, approve: list });
    if (last.code === 0) break;
    const errors = (last.json && last.json.errors) || [];
    if (!errors.length || errors.some((e) => e.code !== 'APPLY_APPROVAL_REQUIRED')) break;
    const need = errors.map((e) => e.target).filter((t) => !list.includes(t));
    if (!need.length) break;
    list = [...list, ...need];
  }
  return { prep: last, approved: list, ok: last.code === 0 && last.json && last.json.ok === true, plan: readPlan(root, id), sha: last.json && last.json.planSha256, root, id };
}
// A scratch copy of the skill: its scripts run unchanged; a catalog and a reader asset may be replaced for one case.
function copySkill(context, dest, { catalog = null, reader = null, mutate = null } = {}) {
  for (const part of ['scripts', 'assets', 'data']) fs.cpSync(path.join(context.skillRoot, part), path.join(dest, part), { recursive: true });
  fs.copyFileSync(path.join(context.skillRoot, 'VERSION'), path.join(dest, 'VERSION'));
  if (catalog !== null) putFile(path.join(dest, 'data', 'runtime-units.json'), jsonText(catalog));
  if (reader !== null) putFile(path.join(dest, 'assets', 'tools', 'git-safe.mjs'), reader);
  if (mutate) mutate(dest);
  return dest;
}
// A rewrite of one file of a copy of a prepared run, returning the approved hash of the rewritten plan.
function forgePlan(root, id, mutate) {
  const plan = readPlan(root, id);
  mutate(plan, root);
  putFile(runFile(root, id, 'plan.json'), jsonText(plan));
  return planShaOf(root, id);
}
// A read recorder: every read of the watched paths is logged (and allowed).
let preloadSeq = 0;
function readGuard(dir, paths) {
  const log = path.join(dir, `guard-${++preloadSeq}.log`);
  const watch = [...new Set(paths.flatMap((p) => { const abs = path.resolve(p); const out = [WIN ? abs.toLowerCase() : abs]; try { out.push(WIN ? fs.realpathSync.native(abs).toLowerCase() : fs.realpathSync.native(abs)); } catch { /* absent */ } return out; }))];
  const source = [
    "'use strict';", "const fs = require('fs');", "const path = require('path');", `const CFG = ${JSON.stringify({ log, watch })};`, "const WIN = process.platform === 'win32';",
    "const norm = (p) => { let s; try { s = typeof p === 'string' ? p : Buffer.isBuffer(p) ? p.toString() : null; } catch (e) { return null; } if (s === null) return null; let a; try { a = path.resolve(s); } catch (e) { return null; } return WIN ? a.toLowerCase() : a; };",
    "const hit = (p) => { const n = norm(p); return n !== null && CFG.watch.includes(n); };",
    "const note = (op, p) => { try { fs.appendFileSync(CFG.log, JSON.stringify({ op: op, path: String(p) }) + '\\n'); } catch (e) { /* ignore */ } };",
    "for (const name of ['readFileSync', 'openSync']) { const orig = fs[name]; fs[name] = function (p) { if (hit(p)) note(name, p); return orig.apply(this, arguments); }; }",
  ].join('\n') + '\n';
  const file = path.join(dir, `guard-${preloadSeq}.cjs`);
  fs.writeFileSync(file, source);
  return { file, hits: () => (readText(log) || '').split('\n').filter(Boolean) };
}

// A recording, failing git first on PATH (the technique of the C2 and C3 tests): on Windows a copy of Node named git.exe and a preload that recognizes it and
// exits 91; elsewhere a shell script. Every Git use of a command run with shim.env is recorded.
let shimSeq = 0;
function makeGitShim(context, parent) {
  const dir = path.join(parent, `git-shim-${++shimSeq}`);
  const shimDir = path.join(dir, 'bin');
  fs.mkdirSync(shimDir, { recursive: true });
  const rec = path.join(dir, 'git-records.jsonl');
  fs.writeFileSync(rec, '');
  const env = {};
  let origPath = null;
  for (const [k, v] of Object.entries(context.env)) {
    if (k.toUpperCase() === 'PATH') { if (origPath === null) origPath = v; continue; }
    env[k] = v;
  }
  env.PATH = `${shimDir}${path.delimiter}${origPath === null ? '' : origPath}`;
  if (WIN) {
    const preload = path.join(dir, 'git-shim.cjs');
    fs.writeFileSync(preload, ["'use strict';", "const path = require('path');", "const fs = require('fs');", "if (path.basename(process.execPath).toLowerCase() === 'git.exe') {",
      `  fs.appendFileSync(${JSON.stringify(rec)}, JSON.stringify(process.argv.slice(1)) + '\\n');`, '  process.exit(91);', '}'].join('\n') + '\n');
    fs.copyFileSync(process.execPath, path.join(shimDir, 'git.exe'));
    env.NODE_OPTIONS = [context.env.NODE_OPTIONS, `--require "${fwd(preload)}"`].filter(Boolean).join(' ');
  } else {
    const recorder = path.join(dir, 'git-recorder.cjs');
    fs.writeFileSync(recorder, `'use strict';\nrequire('fs').appendFileSync(${JSON.stringify(rec)}, JSON.stringify(process.argv.slice(2)) + '\\n');\nprocess.exit(91);\n`);
    const sh = path.join(shimDir, 'git');
    fs.writeFileSync(sh, `#!/bin/sh\nexec "${process.execPath}" "${recorder}" "$@"\n`);
    fs.chmodSync(sh, 0o755);
  }
  return { env, rec, records: () => (readText(rec) || '').split('\n').filter(Boolean) };
}

// ============================================== R80/C4/runtime-targets ====
// Plan 3.10 and 4.13: any plan that creates or modifies a catalog runtime target ends with every catalog member equal to its current trusted source.
const ARB = '// arbitrary runtime content that is not a reviewed tool\n';
const CID = 'run-c4-a';
const trustedBytes = (context, target) => readBytes(path.join(context.skillRoot, ...SRC_OF[target].split('/')));
const asLines = (b) => normText(b);
// Base projects, built once per variant, with the lock held and the run initialized (clones inherit both).
async function getRt(context, failures, variant) {
  return cached(context, `rt-${variant}`, async () => {
    const dir = scratchDir(context, `rt-${variant}`);
    const root = path.join(dir, 'root');
    const files = { 'package.json': '{"name":"fixture-app"}\n', 'src/a.ts': 'export {}\n', 'docs/note.md': '# note\n' };
    const v2 = await getV2Base(context);
    const oldReader = readBytes(path.join(v2.root, ...T_ENTRY.split('/')));
    const trusted = {}; for (const t of UNIT) trusted[t] = trustedBytes(context, t);
    const miss = UNIT.filter((t) => trusted[t] === null);
    if (miss.length) throw new Error(`cannot read the trusted sources of ${miss.join(', ')}`);
    const shippedPolicy = readBytes(path.join(context.skillRoot, 'data', 'secret-paths.json'));
    const s2policy = jsonText(pol2([{ anchor: 'any', glob: '**/.env*' }], []));
    switch (variant) {
      case 'none': break;
      case 's2full': files[T_POLICY] = s2policy; for (const t of UNIT) files[t] = trusted[t]; break;
      case 's2old': files[T_POLICY] = s2policy; files[T_HELPER] = trusted[T_HELPER]; files[T_CORE] = trusted[T_CORE]; files[T_REVIEW] = trusted[T_REVIEW]; files[T_ENTRY] = oldReader; break;
      case 's1old': files[T_POLICY] = shippedPolicy; files[T_ENTRY] = oldReader; break;
      case 'userentry': files[T_ENTRY] = Buffer.from('// a reader the user wrote\n'); break;
      case 'protcore': files[T_POLICY] = jsonText(pol2([], [{ anchor: 'root', glob: T_CORE }])); files[T_HELPER] = trusted[T_HELPER]; files[T_CORE] = trusted[T_CORE]; files[T_REVIEW] = trusted[T_REVIEW]; files[T_ENTRY] = oldReader; break;
      default: throw new Error(`unknown variant ${variant}`);
    }
    makeRepo(context, root, files);
    const kit = makeKit(context, mkCheck([]));
    const ok = kit.begin(root, CID);
    if (!ok) throw new Error(`cannot begin a run in the ${variant} project`);
    return { dir, root, oldReader, trusted };
  });
}
async function useRt(failures, context, variant) {
  try { return await getRt(context, failures, variant); } catch (e) { failures.push(`cannot build the ${variant} project: ${errMsg(e)}`); return null; }
}
// A prepared ordinary plan (a new documentation file only) in a clone of the variant; the base for forged plans.
async function getRtPrepared(context, failures, variant) {
  return cached(context, `rtp-${variant}`, async () => {
    const rt = await getRt(context, failures, variant);
    const dir = scratchDir(context, `rtp-${variant}`);
    const root = cloneTree(rt.root, path.join(dir, 'root'));
    const kit = makeKit(context, mkCheck([]));
    putDraft(root, CID, 'docs/c4-new.md', '# a new document\n');
    const prep = kit.prepare(root, CID);
    if (prep.code !== 0) throw new Error(`the clean ordinary plan did not prepare: ${prep.stdout.slice(0, 200)}`);
    return { dir, root, rt, sha: prep.json.planSha256 };
  });
}
// Adds runtime operations (with their drafts and bindings) and declared installed inputs to a prepared plan, hash-approved by rewriting it.
function forgeRuntime(root, id, { drafts, declared = [], claim = {} }) {
  const planFile = runFile(root, id, 'plan.json');
  const plan = readJson(planFile);
  for (const [t, data] of Object.entries(drafts)) {
    putDraft(root, id, t, data);
    const installed = readBytes(projPath(root, t));
    const draftBytes = bytes(data);
    const action = installed === null ? 'create' : normText(installed) === normText(draftBytes) ? 'unchanged' : 'modify';
    plan.ops.push({ target: t, origin: 'draft', source: `drafts/${t}`, sourceSha256: claim[t] || sha(draftBytes), action, preRawSha: installed === null ? null : sha(installed), eol: '\n', linesBefore: null, linesAfter: 1, uncommittedUserChanges: false, userContentChange: false, userContentReasons: [] });
    plan.sourceInventory.push({ target: t, origin: 'draft' });
    plan.inputs.push({ target: t, preRawSha: installed === null ? null : sha(installed) });
  }
  if (declared.length) {
    putRequest(root, id, 'transaction-inputs.json', declared);
    plan.metadata.transactionInputs = declared;
    plan.metadata.transactionInputsSha256 = sha(readBytes(runFile(root, id, 'transaction-inputs.json')));
    for (const t of declared) plan.inputs.push({ target: t, preRawSha: sha(readBytes(projPath(root, t))) });
  }
  plan.ops.sort(byTarget); plan.sourceInventory.sort(byTarget); plan.inputs.sort(byTarget);
  putFile(planFile, jsonText(plan));
  return planShaOf(root, id);
}
async function runtimeTargets(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const kit = makeKit(context, check);
    const v2 = await getV2Base(context).catch((e) => { failures.push(`cannot build the genuine v2 fixture: ${errMsg(e)}`); return null; });
    if (!v2) return;
    const OLD = readBytes(path.join(v2.root, ...T_ENTRY.split('/')));
    const T = {}; for (const t of UNIT) T[t] = trustedBytes(context, t);
    if (UNIT.some((t) => T[t] === null)) { failures.push(`cannot read the trusted runtime sources: ${UNIT.filter((t) => T[t] === null).join(', ')}`); return; }
    const ALIAS = '.ai/tools/GIT-SAFE.mjs';
    const unrev = (t) => ({ code: 'TOOL_UNIT_UNREVIEWED', error: MSG.TOOL_UNREVIEWED(t), target: t });
    // One refusal scenario at the four boundaries. spec: { base, drafts, declared, expect: target (UNREVIEWED), lenient: [codes] }.
    async function refusal(label, dir, spec) {
      const rt = await useRt(failures, context, spec.base);
      if (!rt) return;
      const root = cloneTree(rt.root, path.join(dir, `u-${label.replace(/\W+/g, '-').slice(0, 24)}-${++seq}`));
      for (const [t, data] of Object.entries(spec.drafts)) putDraft(root, CID, t, data);
      if (spec.declared && spec.declared.length) putRequest(root, CID, 'transaction-inputs.json', spec.declared);
      const guard = spec.noRead ? readGuard(dir, spec.noRead.map((t) => projPath(root, t))) : null;
      const gopt = guard ? { preload: guard.file } : {};
      const before = noWriteState(root, CID);
      const accepted = spec.lenient || null;
      const f = kit.diff(root, CID, gopt);
      if (accepted) {
        check(f.code === 3 && f.json && f.json.ok === false && accepted.includes(f.json.code) && f.json.target === spec.expect && f.stderr === '', `${label}: unprepared diff refuses ${spec.expect} (${accepted.join(' or ')})`, { code: f.code, out: f.stdout.slice(0, 300) });
      } else expectF(check, `${label}: unprepared diff`, f, { ...unrev(spec.expect), exit: 3 });
      const p = kit.prepare(root, CID, gopt);
      if (accepted) {
        const e = p.json && p.json.errors && p.json.errors[0];
        check(p.code === 3 && p.stderr === '' && p.json && p.json.code === 'APPLY_PLAN_REJECTED' && p.json.errors.length === 1 && e && e.target === spec.expect && accepted.includes(e.code), `${label}: prepare refuses ${spec.expect} (${accepted.join(' or ')})`, { code: p.code, out: p.stdout.slice(0, 300) });
      } else expectP(check, `${label}: prepare`, p, [{ target: spec.expect, code: 'TOOL_UNIT_UNREVIEWED', error: MSG.TOOL_UNREVIEWED(spec.expect) }]);
      check(projectSnapshot(root) === before.project && sameBytes(readBytes(lockOwnerPath(root)), before.lock) && !exists(runFile(root, CID, 'plan.json')) && !exists(runFile(root, CID, 'journal.json')), `${label}: the refused diff and prepare wrote no plan, journal, manifest, project file or heartbeat`);
      if (guard) check(guard.hits().length === 0, `${label}: the unbound installed target was never read`, guard.hits().slice(0, 3));
      // the same drafts in a prepared plan: a forged but hash-approved plan proves prepare is not the only boundary
      const base = await getRtPrepared(context, failures, spec.base).catch((e) => { failures.push(`${label}: ${errMsg(e)}`); return null; });
      if (!base) return;
      const fr = cloneTree(base.root, path.join(dir, `f-${seq}`));
      const sha1 = forgeRuntime(fr, CID, { drafts: spec.drafts, declared: spec.declared || [] });
      const fb = noWriteState(fr, CID);
      // I4-2: the prepared review and commit run against the clone `fr`, so they get their own guard on fr's paths (the guard above watches the other clone) and its reads are asserted independently
      const fguard = spec.noRead ? readGuard(dir, spec.noRead.map((t) => projPath(fr, t))) : null;
      const fopt = fguard ? { preload: fguard.file } : {};
      const pd = kit.diff(fr, CID, fopt);
      if (accepted) check(pd.code === 3 && pd.json && pd.json.ok === false && accepted.includes(pd.json.code) && pd.json.target === spec.expect && pd.stderr === '', `${label}: prepared diff refuses ${spec.expect}`, { code: pd.code, out: pd.stdout.slice(0, 300) });
      else expectF(check, `${label}: prepared diff`, pd, { ...unrev(spec.expect), exit: 3 });
      check(!/"files"|"diff"/.test(pd.stdout), `${label}: the prepared review builds no printable review text before refusing`, pd.stdout.slice(0, 120));
      const pc = kit.commit(fr, CID, sha1, fopt);
      if (accepted) check(pc.code === 3 && pc.json && pc.json.ok === false && accepted.includes(pc.json.code) && pc.json.target === spec.expect && pc.stderr === '', `${label}: commit refuses ${spec.expect}`, { code: pc.code, out: pc.stdout.slice(0, 300) });
      else expectF(check, `${label}: commit`, pc, { ...unrev(spec.expect), exit: 3 });
      checkNoWrite(check, `${label}: commit`, fr, CID, fb);
      if (fguard) {
        check(fguard.hits().length === 0, `${label}: the unbound installed target was not read by the prepared review or commit (guard on the clone they ran against)`, fguard.hits().slice(0, 3));
        // control: the same kind of guard does observe a read of a bound target of that clone (the first drafted target is hashed against its binding), so an empty record above is not a blind guard
        const bound = Object.keys(spec.drafts)[0];
        const cguard = readGuard(dir, [projPath(fr, bound)]);
        kit.diff(fr, CID, { preload: cguard.file });
        check(cguard.hits().length > 0, `${label}: control: a guard on the bound target ${bound} records the prepared review's read`, cguard.hits().length);
      }
    }
    let seq = 0;
    await withScratch(context, 'r80', async (dir) => {
      await step('a bad or missing runtime candidate is TOOL_UNIT_UNREVIEWED with the canonical target in the exact P envelope at prepare and the exact F envelope at both reviews and commit, with no write', async () => {
        await refusal('already-schema-2 downgrade', dir, { base: 's2full', drafts: { [T_ENTRY]: OLD }, declared: [T_HELPER, T_CORE, T_REVIEW], expect: T_ENTRY });
        await refusal('schema-1 plan with an arbitrary core', dir, { base: 's1old', drafts: { [T_HELPER]: T[T_HELPER], [T_CORE]: ARB, [T_ENTRY]: T[T_ENTRY] }, expect: T_CORE });
        await refusal('correct entrypoint with a missing core', dir, { base: 'none', drafts: { [T_HELPER]: T[T_HELPER], [T_ENTRY]: T[T_ENTRY] }, expect: T_CORE });
        await refusal('one matching target, another member missing', dir, { base: 'none', drafts: { [T_HELPER]: T[T_HELPER] }, expect: T_CORE });
        await refusal('correct helpers (including the review helper) with an outdated reader', dir, { base: 'none', drafts: { [T_HELPER]: T[T_HELPER], [T_CORE]: T[T_CORE], [T_REVIEW]: T[T_REVIEW], [T_ENTRY]: OLD }, expect: T_ENTRY });
        await refusal('helper trusted, core and entrypoint arbitrary: the core first', dir, { base: 'none', drafts: { [T_HELPER]: T[T_HELPER], [T_CORE]: ARB, [T_ENTRY]: ARB }, expect: T_CORE });
        await refusal('unchanged members without declarations, the first is named and unread', dir, { base: 's2old', drafts: { [T_ENTRY]: T[T_ENTRY] }, declared: [], expect: T_HELPER, noRead: [T_HELPER, T_CORE] });
        await refusal('only the helper declared: the core is the first without a role', dir, { base: 's2old', drafts: { [T_ENTRY]: T[T_ENTRY] }, declared: [T_HELPER], expect: T_CORE, noRead: [T_CORE] });
        // PLAN-GAP: 3.10 says an alias operation does not satisfy a missing canonical member 'on a host where it is a different file', and also prescribes lexical recognition
        // with no realpath lookup. The two alias scenarios assert the lexical behavior on every host: an alias never stands in for the canonical member and must itself be trusted.
        await refusal('a trusted case alias does not satisfy the missing canonical entrypoint', dir, { base: 'none', drafts: { [T_HELPER]: T[T_HELPER], [T_CORE]: T[T_CORE], [T_REVIEW]: T[T_REVIEW], [ALIAS]: T[T_ENTRY] }, expect: T_ENTRY });
        await refusal('an arbitrary case alias is refused and the canonical target is named', dir, { base: 's2full', drafts: { [ALIAS]: ARB }, declared: UNIT, expect: T_ENTRY });
        // PLAN-GAP: the code for a protected unchanged member (UNREVIEWED or the migration protected-input refusal) is not pinned for ordinary plans; the target and the absence of a read are.
        await refusal('a protected unchanged member is never read', dir, { base: 'protcore', drafts: { [T_ENTRY]: T[T_ENTRY] }, declared: [T_HELPER], expect: T_CORE, noRead: [T_CORE], lenient: ['TOOL_UNIT_UNREVIEWED', 'MIGRATION_PROTECTED_INPUT'] });
      });
      await step('earlier analysis errors are never replaced by the runtime check; the existing capability, schema-2 workflow and migration-output errors keep their precedence', async () => {
        const rt = await useRt(failures, context, 'none');
        if (rt) {
          const root = cloneTree(rt.root, path.join(dir, `early-${++seq}`));
          putDraft(root, CID, T_ENTRY, ARB); putDraft(root, CID, '.env', 'C4-DUMMY=1\n');
          const p = kit.prepare(root, CID);
          const errs = (p.json && p.json.errors) || [];
          check(p.code === 3 && errs.length === 1 && errs[0].target === '.env' && errs[0].code === 'APPLY_SECRET_TARGET' && errs[0].error === MSG.SECRET_PREPARE && !errs.some((e) => e.code === 'TOOL_UNIT_UNREVIEWED'), 'a secret-path draft is the only rejection; the runtime error does not replace or join it', p.json);
          const d = kit.diff(root, CID);
          check(d.code === 3 && d.json && d.json.code === 'APPLY_SECRET_TARGET', 'the unprepared review reports the same earlier error', d.json && d.json.code);
        }
        const s2 = await useRt(failures, context, 's2full');
        if (s2) {
          const root = cloneTree(s2.rt ? s2.rt.root : s2.root, path.join(dir, `req-${++seq}`));
          const pol = readJson(projPath(root, T_POLICY));
          pol.projectPatterns = [{ anchor: 'root', glob: 'env/**' }];
          putDraft(root, CID, T_POLICY, jsonText(pol)); putDraft(root, CID, T_ENTRY, ARB);
          expectP(check, 'MIGRATION_REQUIRED keeps its precedence over the runtime check', kit.prepare(root, CID), [{ target: T_POLICY, code: 'MIGRATION_REQUIRED', error: MSG.MIGRATION_REQUIRED }]);
          expectF(check, 'the unprepared review too', kit.diff(root, CID), { code: 'MIGRATION_REQUIRED', exit: 3, error: MSG.MIGRATION_REQUIRED, target: T_POLICY });
        }
        // capability: a scratch catalog whose entrypoint declares [1] keeps TOOL_UNIT_INCOMPATIBLE before any candidate comparison
        const skillDir = scratchDir(context, 'cap-skill');
        const catalog = { schema: 1, units: [unitOf(T_HELPER), unitOf(T_CORE), { ...unitOf(T_ENTRY), policySchemas: [1] }] };
        const skill = copySkill(context, path.join(skillDir, 'project-setup'), { catalog });
        const k2 = kit.withSkill(skill);
        const mig = cloneTree(v2.root, path.join(dir, `cap-${++seq}`));
        const st = startMigration(k2, check, mig, 'run-c4-cap');
        check(st.ok === true, 'a genuine v2 migration stages against the scratch incompatible catalog', st.st && st.st.stdout.slice(0, 300));
        if (st.ok) expectP(check, 'an entrypoint catalog entry without schema 2 stays TOOL_UNIT_INCOMPATIBLE', k2.prepare(mig, 'run-c4-cap', { approve: [T_POLICY] }), [{ target: T_ENTRY, code: 'TOOL_UNIT_INCOMPATIBLE', error: MSG.TOOL_INCOMPATIBLE(T_ENTRY) }]);
      });
      await step('a malformed trusted catalog is TOOL_CATALOG with target data/runtime-units.json: P at prepare, F at both reviews and commit', async () => {
        const catalog = { schema: 1, units: [unitOf(T_HELPER)] };
        const skill = copySkill(context, path.join(scratchDir(context, 'bad-catalog'), 'project-setup'), { catalog });
        const kb = kit.withSkill(skill);
        const entry = { code: 'TOOL_CATALOG', error: 'TOOL_CATALOG: invalid runtime unit catalog', target: T_CATALOG };
        const rt = await useRt(failures, context, 'none');
        if (rt) {
          const root = cloneTree(rt.root, path.join(dir, `badcat-${++seq}`));
          putDraft(root, CID, T_HELPER, T[T_HELPER]);
          expectF(check, 'unprepared review with a malformed catalog', kb.diff(root, CID), { ...entry, exit: 3 });
          expectP(check, 'prepare with a malformed catalog', kb.prepare(root, CID), [{ target: T_CATALOG, code: 'TOOL_CATALOG', error: entry.error }]);
          check(!exists(runFile(root, CID, 'plan.json')), 'no plan was written');
        }
        const base = await getRtPrepared(context, failures, 'none').catch((e) => { failures.push(errMsg(e)); return null; });
        if (base) {
          const fr = cloneTree(base.root, path.join(dir, `badcat-f-${seq}`));
          const sha1 = forgeRuntime(fr, CID, { drafts: { [T_HELPER]: T[T_HELPER] } });
          const fb = noWriteState(fr, CID);
          expectF(check, 'prepared review with a malformed catalog', kb.diff(fr, CID), { ...entry, exit: 3 });
          expectF(check, 'commit with a malformed catalog', kb.commit(fr, CID, sha1), { ...entry, exit: 3 });
          checkNoWrite(check, 'malformed catalog (commit)', fr, CID, fb);
        }
      });
      await step('apply keeps its no-Git property: the runtime comparison uses file and hash operations only, in the unprepared and the prepared review, in refusal and in success', async () => {
        const nn = await useRt(failures, context, 'none');
        const base = await getRtPrepared(context, failures, 'none').catch((e) => { failures.push(errMsg(e)); return null; });
        if (!nn || !base) return;
        const shim = makeGitShim(context, dir);
        const bad = cloneTree(nn.root, path.join(dir, `nogit-bad-${++seq}`));
        for (const t of UNIT) putDraft(bad, CID, t, t === T_CORE ? ARB : T[t]);
        expectF(check, 'unprepared review (refusal) under the git shim', kit.diff(bad, CID, { env: shim.env }), { ...unrev(T_CORE), exit: 3 });
        check(shim.records().length === 0, 'the refused unprepared review invoked no Git command', shim.records());
        const good = cloneTree(nn.root, path.join(dir, `nogit-ok-${seq}`));
        for (const t of UNIT) putDraft(good, CID, t, T[t]);
        const ud = kit.diff(good, CID, { env: shim.env });
        check(ud.code === 0 && ud.json && ud.json.ok === true, 'the successful unprepared review under the git shim', ud.stdout.slice(0, 200));
        check(shim.records().length === 0, 'the successful unprepared review invoked no Git command', shim.records());
        const fr = cloneTree(base.root, path.join(dir, `nogit-f-${seq}`));
        forgeRuntime(fr, CID, { drafts: { [T_HELPER]: ARB } });
        expectF(check, 'prepared review (refusal) under the git shim', kit.diff(fr, CID, { env: shim.env }), { ...unrev(T_HELPER), exit: 3 });
        check(shim.records().length === 0, 'the refused prepared review invoked no Git command', shim.records());
        const pre = kit.prepare(good, CID);
        check(pre.code === 0, 'the complete trusted unit prepares', pre.stdout.slice(0, 200));
        if (pre.code === 0) {
          const pd = kit.diff(good, CID, { env: shim.env });
          check(pd.code === 0 && pd.json && pd.json.ok === true && pd.json.prepared === true, 'the successful prepared review under the git shim', pd.stdout.slice(0, 200));
          check(shim.records().length === 0, 'the successful prepared review invoked no Git command', shim.records());
        }
        const ctl = cloneTree(nn.root, path.join(dir, `nogit-ctl-${seq}`));
        putDraft(ctl, CID, 'docs/c4-ctl.md', '# control\n');
        kit.prepare(ctl, CID, { env: shim.env });
        check(shim.records().length > 0, 'control: this shim does intercept the Git use of prepare', shim.records().length);
      });
      await step('positive controls: an ordinary plan without a runtime target forces no upgrade; a complete trusted unit (also with BOM, CRLF and lone CR) and a partial update with declared trusted members pass prepare, both reviews and commit, with the pinned write order and the existing approvals', async () => {
        // no forced upgrade
        const old = await useRt(failures, context, 's1old');
        if (old) {
          const root = cloneTree(old.root, path.join(dir, `noforce-${++seq}`));
          putDraft(root, CID, 'docs/c4-note.md', '# note\n');
          const ud = kit.diff(root, CID);
          check(ud.code === 0 && ud.json && ud.json.ok === true, 'unrelated plan: the unprepared review passes', ud.stdout.slice(0, 200));
          const p = kit.prepare(root, CID);
          check(p.code === 0 && p.json && p.json.ok === true && !readPlan(root, CID).ops.some((o) => UNIT.includes(o.target)), 'unrelated plan: prepare passes with no runtime operation although the installed reader is old and the helper and core are missing', p.stdout.slice(0, 300));
          if (p.code === 0) {
            const pd = kit.diff(root, CID);
            check(pd.code === 0 && pd.json && pd.json.ok === true && pd.json.prepared === true, 'unrelated plan: the prepared review passes', pd.stdout.slice(0, 200));
            const c = kit.commit(root, CID, p.json.planSha256);
            check(c.code === 0 && c.json && c.json.committed === true, 'unrelated plan: commit passes', c.stdout.slice(0, 300));
            check(sameBytes(readBytes(projPath(root, T_ENTRY)), old.oldReader) && !exists(projPath(root, T_HELPER)), 'the old reader stays and nothing was installed');
          }
        }
        // a complete trusted unit over a user-edited entrypoint needs the existing approval; then all four boundaries pass and the write order is pinned
        const ue = await useRt(failures, context, 'userentry');
        if (ue) {
          const root = cloneTree(ue.root, path.join(dir, `unit-${++seq}`));
          for (const t of UNIT) putDraft(root, CID, t, T[t]);
          const ud = kit.diff(root, CID);
          check(ud.code === 0 && ud.json && ud.json.ok === true && ud.json.prepared === false, 'complete unit: the unprepared review passes (it never asks for approvals)', ud.stdout.slice(0, 300));
          expectP(check, 'complete unit over a user-edited entrypoint: trusted bytes do not approve replacing user content', kit.prepare(root, CID), [{ target: T_ENTRY, code: 'APPLY_APPROVAL_REQUIRED', error: contentApprovalError(T_ENTRY, [NOT_OWNED]) }]);
          const p = prepareApproving(kit, root, CID, [T_ENTRY]);
          check(p.ok === true && eq(p.plan.ops.map((o) => o.target), UNIT), 'with its path approved the plan prepares with the runtime operations in catalog write order (helper, other helpers, entrypoint)', p.prep && p.prep.stdout.slice(0, 300));
          if (p.ok) {
            const pd = kit.diff(root, CID);
            check(pd.code === 0 && pd.json && pd.json.ok === true && pd.json.prepared === true, 'complete unit: the prepared review passes', pd.stdout.slice(0, 200));
            const c = kit.commit(root, CID, p.sha);
            check(c.code === 0 && c.json && c.json.committed === true && eq(c.json.written.map((w) => w.target), [...UNIT, T_MANIFEST]), 'complete unit: commit writes the helper, the core, the entrypoint, then the manifest last', c.json && c.json.written);
            for (const t of UNIT) check(NH(readBytes(projPath(root, t)) || '') === NH(T[t]), `${t}: installed equal to its trusted source`);
          }
        }
        // a partial update with declared, trusted, untouched members (C4-P3-7)
        const so = await useRt(failures, context, 's2old');
        if (so) {
          const root = cloneTree(so.root, path.join(dir, `partial-${++seq}`));
          putDraft(root, CID, T_ENTRY, T[T_ENTRY]);
          putRequest(root, CID, 'transaction-inputs.json', [T_HELPER, T_CORE, T_REVIEW]);
          const ud = kit.diff(root, CID);
          check(ud.code === 0 && ud.json && ud.json.ok === true, 'partial update: the unprepared review passes', ud.stdout.slice(0, 300));
          const p = prepareApproving(kit, root, CID, [T_ENTRY]);
          check(p.ok === true && p.plan.metadata.transactionInputs.includes(T_HELPER) && p.plan.metadata.transactionInputs.includes(T_CORE) && p.plan.metadata.transactionInputs.includes(T_REVIEW), 'partial update: prepare passes with the helper, the core and the review helper declared and bound', p.prep && p.prep.stdout.slice(0, 300));
          if (p.ok) {
            const pd = kit.diff(root, CID);
            check(pd.code === 0 && pd.json && pd.json.ok === true && pd.json.prepared === true, 'partial update: the prepared review passes', pd.stdout.slice(0, 200));
            const c = kit.commit(root, CID, p.sha);
            check(c.code === 0 && c.json && c.json.committed === true && eq(c.json.written.map((w) => w.target), [T_ENTRY, T_MANIFEST]) && NH(readBytes(projPath(root, T_ENTRY))) === NH(T[T_ENTRY]), 'partial update: commit writes the entrypoint and the manifest', c.json && c.json.written);
          }
        }
        // normalized equality: BOM, CRLF and lone CR compare equal
        const nn = await useRt(failures, context, 'none');
        if (nn) {
          const root = cloneTree(nn.root, path.join(dir, `norm-${++seq}`));
          const bom = (b) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(normText(b).replace(/\n/g, '\r\n'), 'utf8')]);
          const lone = (b) => Buffer.from(normText(b).replace(/\n/g, '\r'), 'utf8');
          putDraft(root, CID, T_HELPER, bom(T[T_HELPER])); putDraft(root, CID, T_CORE, lone(T[T_CORE])); putDraft(root, CID, T_REVIEW, bom(T[T_REVIEW])); putDraft(root, CID, T_ENTRY, bom(T[T_ENTRY]));
          // I4-4: the unprepared review accepts the normalized-equal drafts too (it never prepares, so this is its own boundary)
          const nud = kit.diff(root, CID);
          check(nud.code === 0 && nud.json && nud.json.ok === true && nud.json.prepared === false, 'normalized-equal drafts (BOM and CRLF, lone CR, BOM) pass the unprepared review (C4-P3-5)', nud.stdout.slice(0, 300));
          const p = kit.prepare(root, CID);
          check(p.code === 0 && p.json && p.json.ok === true, 'a BOM and CRLF draft, a lone-CR draft and a BOM draft all equal their trusted sources after normalization (C4-P3-5)', p.stdout.slice(0, 300));
          if (p.code === 0) {
            const sha1 = p.json.planSha256;
            const npd = kit.diff(root, CID);
            check(npd.code === 0 && npd.json && npd.json.ok === true && npd.json.prepared === true && npd.json.planSha256 === sha1, 'the same drafts pass the prepared review of that plan (C4-P3-5)', npd.stdout.slice(0, 300));
            check(UNIT.every((t) => npd.json && Array.isArray(npd.json.files) && npd.json.files.some((x) => x.target === t)), 'the prepared review lists all four normalized-equal runtime targets', npd.json && npd.json.files && npd.json.files.map((x) => x.target));
            // raw input drift is still detected although the LF version is normalized-equal
            const drift = cloneTree(root, path.join(dir, `drift-${seq}`));
            putDraft(drift, CID, T_HELPER, T[T_HELPER]);
            const dd = kit.diff(drift, CID);
            check(dd.code === 4 && dd.json && dd.json.code === 'APPLY_DRIFT' && dd.json.error === MSG.DRIFT && eq(dd.json.drift, [{ target: T_HELPER, what: 'draft changed after prepare (unreviewed content)' }]), 'a raw draft change with normalized equality is still drift in the prepared review', dd.json);
            const dbefore = noWriteState(drift, CID);
            const dc = kit.commit(drift, CID, sha1);
            check(dc.code === 4 && dc.json && dc.json.code === 'APPLY_DRIFT', 'and in commit', dc.json);
            checkNoWrite(check, 'raw drift (commit)', drift, CID, dbefore);
            // a changed trusted source after prepare
            const skillDir = scratchDir(context, 'chg-skill');
            const skill = copySkill(context, path.join(skillDir, 'project-setup'), { mutate: (s) => fs.appendFileSync(path.join(s, ...SRC_OF[T_HELPER].split('/')), '// a newly reviewed helper\n') });
            const k2 = kit.withSkill(skill);
            const chg = cloneTree(root, path.join(dir, `chg-${seq}`));
            const cbefore = noWriteState(chg, CID);
            expectF(check, 'a trusted source changed after prepare (prepared review)', k2.diff(chg, CID), { ...unrev(T_HELPER), exit: 3 });
            expectF(check, 'a trusted source changed after prepare (commit)', k2.commit(chg, CID, sha1), { ...unrev(T_HELPER), exit: 3 });
            checkNoWrite(check, 'changed trusted source (commit)', chg, CID, cbefore);
            const ok = kit.commit(cloneTree(root, path.join(dir, `ok-${seq}`)), CID, sha1);
            check(ok.code === 0 && ok.json && ok.json.committed === true, 'control: the unchanged trusted skill commits the same plan', ok.stdout.slice(0, 300));
          }
        }
      });
      await step('forged plans: a claimed source hash and a rewritten plan hash cannot authorize different runtime bytes', async () => {
        const base = await getRtPrepared(context, failures, 'none').catch((e) => { failures.push(errMsg(e)); return null; });
        if (!base) return;
        // PLAN-GAP: 4.13 names a 'forged claimed source hash' without a code. A claimed hash that disagrees with the draft bytes is APPLY_DRIFT today (C2 binding) and the runtime check would
        // say TOOL_UNIT_UNREVIEWED; either refusal, with no write, is accepted.
        const claim = {};
        for (const t of UNIT) claim[t] = sha(T[t]);
        const fr = cloneTree(base.root, path.join(dir, `claim-${++seq}`));
        const shaClaim = forgeRuntime(fr, CID, { drafts: { [T_HELPER]: T[T_HELPER], [T_CORE]: ARB, [T_ENTRY]: T[T_ENTRY] }, claim });
        const fb = noWriteState(fr, CID);
        const pd = kit.diff(fr, CID);
        check(pd.code !== 0 && pd.json && pd.json.ok === false && ['APPLY_DRIFT', 'TOOL_UNIT_UNREVIEWED'].includes(pd.json.code), 'a plan that claims the trusted source hash for arbitrary draft bytes is refused by the prepared review', { code: pd.code, out: pd.stdout.slice(0, 300) });
        const pc = kit.commit(fr, CID, shaClaim);
        check(pc.code !== 0 && pc.json && pc.json.ok === false && ['APPLY_DRIFT', 'TOOL_UNIT_UNREVIEWED'].includes(pc.json.code), 'and by commit', { code: pc.code, out: pc.stdout.slice(0, 300) });
        checkNoWrite(check, 'claimed source hash (commit)', fr, CID, fb);
        check(!exists(projPath(fr, T_CORE)), 'the arbitrary core was not installed');
      });
      await step('a migration with arbitrary runtime content keeps its existing refusal at every boundary and installs nothing', async () => {
        const mig = await getProdMigration(context, failures);
        if (!mig || !mig.p.ok) { check(false, 'the production migration prepared', mig && mig.p && mig.p.prep && mig.p.prep.stdout.slice(0, 300)); return; }
        // PLAN-GAP: 4.13 lists this case but pins no code; 3.10 keeps the existing precedence (MIGRATION_OUTPUT_MISMATCH from the staged projection check, TOOL_UNIT_UNREVIEWED from the
        // candidate check). Either code is accepted at every boundary; the target (the reader) and the absence of any write are asserted.
        const okCodes = ['MIGRATION_OUTPUT_MISMATCH', 'TOOL_UNIT_UNREVIEWED'];
        const root = cloneTree(mig.root, path.join(dir, `migarb-${++seq}`));
        // arbitrary staged reader: the staged draft and the approved plan agree with each other, not with the trusted source
        putDraft(root, mig.id, T_ENTRY, ARB);
        const newSha = forgePlan(root, mig.id, (plan) => { plan.ops.find((o) => o.target === T_ENTRY).sourceSha256 = sha(Buffer.from(ARB)); });
        const before = noWriteState(root, mig.id);
        const pd = kit.diff(root, mig.id);
        check(pd.code === 3 && pd.json && pd.json.ok === false && okCodes.includes(pd.json.code) && pd.json.target === T_ENTRY, 'prepared review: a migration whose staged reader is arbitrary is refused for the reader', { code: pd.code, out: pd.stdout.slice(0, 300) });
        const pc = kit.commit(root, mig.id, newSha);
        check(pc.code === 3 && pc.json && pc.json.ok === false && okCodes.includes(pc.json.code) && pc.json.target === T_ENTRY, 'commit: the same refusal', { code: pc.code, out: pc.stdout.slice(0, 300) });
        checkNoWrite(check, 'arbitrary migration reader (commit)', root, mig.id, before);
        const un = cloneTree(mig.v2.root, path.join(dir, `migarb-un-${seq}`));
        const st = startMigration(kit, check, un, 'run-c4-un');
        if (st.ok) {
          putDraft(un, 'run-c4-un', T_ENTRY, ARB);
          const ud = kit.diff(un, 'run-c4-un');
          check(ud.code === 3 && ud.json && ud.json.ok === false && okCodes.includes(ud.json.code) && ud.json.target === T_ENTRY, 'unprepared review: an arbitrary staged reader is refused', { code: ud.code, out: ud.stdout.slice(0, 300) });
          const pp = kit.prepare(un, 'run-c4-un', { approve: [T_POLICY] });
          const e = pp.json && pp.json.errors && pp.json.errors[0];
          check(pp.code === 3 && e && e.target === T_ENTRY && okCodes.includes(e.code), 'prepare: the same refusal', { code: pp.code, out: pp.stdout.slice(0, 300) });
        } else check(false, 'the migration stages', st.st && st.st.stdout.slice(0, 300));
      });
    });
  });
}

// ============================================== R78/C4/reader-unit ====
// Plan 2.3, 4.14: the production catalog, the three installed files, schemas 1, 2 and 3 through the installed CLI, the production migration and its rollback.
const getProdMigration = (context, failures) => cached(context, 'prod-migration', async () => {
  const fails = [];
  const check = mkCheck(fails);
  const v2 = await getV2Base(context);
  const dir = scratchDir(context, 'prod-mig');
  const root = cloneTree(v2.root, path.join(dir, 'root'));
  const kit = makeKit(context, check);
  const id = 'run-c4-prod';
  const s = startMigration(kit, check, root, id);
  const p = s.ok ? prepareApproving(kit, root, id) : { ok: false, prep: s.st };
  return { dir, root, id, s, p, fails, v2 };
});
async function readerUnit(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const kit = makeKit(context, check);
    await step('the production catalog is exactly the four-unit catalog (C5 plan 2.4) with roles, order and [1, 2] capabilities', async () => {
      const file = readJson(path.join(context.skillRoot, T_CATALOG));
      check(eq(file, CATALOG_PRODUCTION), 'data/runtime-units.json holds exactly security-policy.mjs, git-safe-core.mjs, review-diff.mjs (helpers) and git-safe.mjs (entrypoint), in that order, each [1, 2]', file);
      for (const t of UNIT) check(readBytes(path.join(context.skillRoot, ...SRC_OF[t].split('/'))) !== null, `${SRC_OF[t]} exists`);
    });
    await step('the installed four-file reader unit works with schema 1 and schema 2 policies and refuses schema 3 with the exact line, before any resolution or content operation', async () => {
      await withScratch(context, 'inst', async (dir) => {
        const root = makeRepo(context, path.join(dir, 'proj'), { 'safe.txt': 'needle\n', '.env': 'C4-DUMMY-INSTALLED\n', 'src/a.txt': 'a\n' });
        for (const t of UNIT) {
          const b = trustedBytes(context, t);
          if (b === null) { check(false, `cannot read the trusted source of ${t}`); return; }
          putFile(projPath(root, t), b);
        }
        const run = (args) => execNode(context, { cwd: root, script: projPath(root, T_ENTRY), args });
        const policies = [
          ['schema 1', { schema: 1, patterns: [{ glob: '**/.env*' }] }],
          ['schema 2', pol2([{ anchor: 'any', glob: '**/.env*' }], [{ anchor: 'root', glob: 'secret/**' }])],
          ['an empty schema 2 policy', pol2([], [])],
        ];
        for (const [label, pol] of policies) {
          putFile(projPath(root, T_POLICY), jsonText(pol));
          const cat = run(['cat', 'HEAD', '--', 'safe.txt']);
          check(cat.dead === null && cat.code === 0 && cat.stdout === 'needle\n' && cat.stderr === '', `${label}: cat of a safe file`, { code: cat.code, out: cat.stdout.slice(0, 80), err: cat.stderr.slice(0, 200) });
          const env = run(['cat', 'HEAD', '--', '.env']);
          if (label === 'an empty schema 2 policy') check(env.code === 0 && env.stdout === 'C4-DUMMY-INSTALLED\n', 'an explicitly empty policy protects nothing', { code: env.code });
          else check(env.code === 2 && env.stdout === '' && env.stderr === stderrLine(E.SECRET), `${label}: .env is refused`, { code: env.code, out: env.stdout.slice(0, 80), err: env.stderr.slice(0, 200) });
        }
        putFile(projPath(root, T_POLICY), jsonText({ schema: 3, patterns: [], projectPatterns: [] }));
        const r3 = run(['cat', 'no-such-ref', '--', 'safe.txt']);
        check(r3.dead === null && r3.code === 2 && r3.stdout === '' && r3.stderr === 'git-safe: POLICY_SCHEMA: policy.schema must be 1 or 2\n', 'schema 3: exactly the policy-schema line (a policy rejection precedes revision resolution: the unresolvable revision is not reported)', { code: r3.code, out: r3.stdout.slice(0, 80), err: r3.stderr.slice(0, 200) });
        for (const argv of [['ls', 'HEAD'], ['diff', 'HEAD~1..HEAD']]) {
          const r = run(argv);
          check(r.code === 2 && r.stdout === '' && r.stderr === 'git-safe: POLICY_SCHEMA: policy.schema must be 1 or 2\n', `schema 3: ${argv[0]} gives the same line`, { code: r.code, err: r.stderr.slice(0, 200) });
        }
        rmrf(projPath(root, T_POLICY));
        const gone = run(['ls', 'HEAD']);
        check(gone.code === 2 && gone.stdout === '' && gone.stderr === stderrLine(E.POLICY_IO), 'a missing installed policy is refused with the exact policy-IO line (no fallback to shipped defaults)', { code: gone.code, err: gone.stderr.slice(0, 200) });
      });
    });
    await step('the production schema-2 migration of a genuine v2 install now succeeds: the complete unit is staged, runtime files precede the policy, the manifest is last, the installed reader works, rollback restores the genuine v2 state', async () => {
      const mig = await getProdMigration(context, failures);
      if (!mig) return;
      for (const f of mig.fails) failures.push(`scenario build: ${f}`);
      check(mig.s.ok === true, 'the genuine v2 migration stages against the production catalog', mig.s.st && mig.s.st.stdout.slice(0, 300));
      const staged = (mig.s.st && mig.s.st.json && mig.s.st.json.staged) || [];
      for (const t of UNIT) check(staged.includes(`drafts/${t}`), `${t} is staged`, staged);
      check(mig.p.ok === true, 'the production migration prepares (it no longer fails with TOOL_UNIT_INCOMPATIBLE)', mig.p.prep && mig.p.prep.stdout.slice(0, 400));
      if (!mig.p.ok) return;
      check(eq(mig.p.plan.ops.map((o) => o.target), [T_HELPER, T_CORE, T_REVIEW, T_ENTRY, T_SETTINGS, T_POLICY]), 'plan operations: the runtime unit in catalog write order, then settings, the dependent policy last', mig.p.plan.ops.map((o) => o.target));
      await withScratch(context, 'prodrun', async (dir) => {
        const r = cloneTree(mig.root, path.join(dir, 'r'));
        const original = (rel) => readBytes(projPath(mig.v2.root, rel));
        const c = kit.commit(r, mig.id, mig.p.sha);
        check(c.code === 0 && c.json && c.json.committed === true && eq(c.json.written, [{ target: T_HELPER, created: true }, { target: T_CORE, created: true }, { target: T_REVIEW, created: true }, { target: T_ENTRY, created: false }, { target: T_SETTINGS, created: false }, { target: T_POLICY, created: false }, { target: T_MANIFEST, created: false }]), 'commit writes the helper, the core and the review helper (created), the entrypoint, the settings, the policy, then the manifest last', c.json && c.json.written);
        const j = readJournal(r, mig.id);
        check(j && eq(j.entries.map((e) => e.target), [T_HELPER, T_CORE, T_REVIEW, T_ENTRY, T_SETTINGS, T_POLICY, T_MANIFEST]) && j.entries.every((e) => e.state === 'applied'), 'one journal lists every entry applied in that order', j && j.entries.map((e) => `${e.target}:${e.state}`));
        for (const t of UNIT) check(NH(readBytes(projPath(r, t)) || '') === NH(trustedBytes(context, t) || ''), `${t}: installed equal to its trusted source`);
        const rec = readJson(manifestPath(r)).files;
        check(UNIT.every((t) => rec[t] && rec[t].ownership === 'full' && rec[t].sha256 === NH(readBytes(projPath(r, t)))), 'the helper, the core and the reader are recorded as full with the hash of their installed bytes', UNIT.map((t) => rec[t]));
        const run = (args, o = {}) => execNode(context, { cwd: r, script: projPath(r, T_ENTRY), args, ...o });
        const cat = run(['cat', 'HEAD', '--', 'src/a.ts']);
        check(cat.dead === null && cat.code === 0 && cat.stdout === 'export {}\n' && cat.stderr === '', 'the installed reader cats a committed file under the migrated schema-2 policy', { code: cat.code, out: cat.stdout.slice(0, 80), err: cat.stderr.slice(0, 200) });
        const ls = run(['ls', 'HEAD']);
        check(ls.code === 0 && ls.stdout.includes('src/a.ts\0') && ls.stdout.includes('package.json\0') && ls.stderr === '', 'the installed reader lists the committed tree', { code: ls.code, out: ls.stdout.slice(0, 120), err: ls.stderr.slice(0, 200) });
        const schemaOf = readJson(projPath(r, T_POLICY)).schema;
        check(schemaOf === 2, 'the migrated policy is schema 2', schemaOf);
        const bad = cloneTree(r, path.join(dir, 'bad'));
        const pol = readJson(projPath(bad, T_POLICY)); pol.schema = 3;
        putFile(projPath(bad, T_POLICY), jsonText(pol));
        const r3 = execNode(context, { cwd: bad, script: projPath(bad, T_ENTRY), args: ['cat', 'HEAD', '--', 'src/a.ts'] });
        check(r3.code === 2 && r3.stdout === '' && r3.stderr === 'git-safe: POLICY_SCHEMA: policy.schema must be 1 or 2\n', 'unknown-schema rejection occurs through the installed CLI of the migrated project', { code: r3.code, err: r3.stderr.slice(0, 200) });
        const rb = kit.rollback(r, mig.id);
        check(rb.code === 0 && rb.json && rb.json.complete === true, 'rollback completes through the same journal', rb.stdout.slice(0, 300));
        for (const t of [T_POLICY, T_SETTINGS, T_ENTRY, T_MANIFEST]) check(sameBytes(readBytes(projPath(r, t)), original(t)), `${t}: the exact genuine v2 bytes are back`);
        check(!exists(projPath(r, T_HELPER)) && !exists(projPath(r, T_CORE)) && !exists(projPath(r, T_REVIEW)), 'the newly created helper, core and review helper are removed');
      });
    });
  });
}

// ============================================================ registration ====
// The array wired into COMPONENT_IMPLEMENTATIONS.C4 (plan 4.1): frozen, descriptors frozen, in the plan order. Imports perform no work.
export const C4_IMPLEMENTATIONS = Object.freeze([
  { id: 'R41/C4/cat', run: (context) => catGroup(context) },
  { id: 'R42/C4/ls', run: (context) => lsGroup(context) },
  { id: 'R42/C4/grep', run: (context) => grepGroup(context) },
  { id: 'R43/C4/history', run: (context) => history(context) },
  { id: 'R47/C4/project-policy', run: (context) => projectPolicy(context) },
  { id: 'R74/C4/corpus', run: (context) => corpusGroup(context) },
  { id: 'R75/C4/exact-case', run: (context) => exactCase(context) },
  { id: 'R75/C4/nul-records', run: (context) => nulRecords(context) },
  { id: 'R76/C4/arguments', run: (context) => argumentsGroup(context) },
  { id: 'R76/C4/revisions', run: (context) => revisions(context) },
  { id: 'R76/C4/isolation', run: (context) => isolation(context) },
  { id: 'R76/C4/failures', run: (context) => failuresGroup(context) },
  { id: 'R76/C4/limits', run: (context) => limitsGroup(context) },
  { id: 'R76/C4/narrowing', run: (context) => narrowing(context) },
  { id: 'R97/C4/environment-names', run: (context) => environmentNames(context) },
  { id: 'R80/C4/runtime-targets', run: (context) => runtimeTargets(context) },
  { id: 'R78/C4/reader-unit', run: (context) => readerUnit(context) },
].map((d) => Object.freeze(d)));
