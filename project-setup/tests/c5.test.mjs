// C5 tests lane: the eighteen component assertions of "C5. Review-diff and artifact lifecycle".
//
// Written from the frozen plan only, before any implementation exists:
//   docs/plans/2026-10-19-project-setup-v3-rc1-c5.md   (sections 1-9 and the C5-P2-1 to C5-P2-10 addendum, which wins over earlier sections)
// Under the frozen architecture plan docs/plans/2026-10-15-project-setup-v3-rc1.md and the landed contracts it builds on: C11a (tests/rc1-cases.mjs,
// tests/run-component-tests.mjs), C1 (assets/tools/security-policy.mjs), C2 (scripts/apply.mjs, scripts/lib.mjs), C3 (scripts/migrate-security-paths.mjs,
// data/runtime-units.json) and C4 (assets/tools/git-safe-core.mjs, git-safe.mjs, tests/c4.test.mjs). Plan 2.3 gives the tests lane this file,
// tests/fixtures/review-diff-cases.json, the tests/rc1-cases.mjs registration, the R01 and freshSetup edits in tests/run-tests.mjs, the production
// runtime-unit edits in tests/c4.test.mjs and the live-acceptance subsection; those edits live in those files. The implementer must not edit any of them.
//
// Importing this module runs nothing. Every production module and every registry module (rc1-cases.mjs imports this file, so a static import back would be
// circular) is imported lazily inside run(context). A missing module or export fails one assertion with a diagnostic; it never breaks the import.
//
// Every run(context) returns { failures, skipped: null }. There is no skip path: an unavailable optional subcase (a file symlink without privilege) is
// simply not exercised and is noted in context.tmp/c5-diagnostics.log (the retained diagnostics of plan 4.3). Scratch data lives under context.tmp only.
//
// How the plan's seams are used (plan 4.2):
//   - C4's execute and readFile seams carry the synthetic Git metadata and content, every exact-argv assertion and the failure matrices; the fake executor
//     below answers by recognizing the pinned operation vectors of plan 3.5 and 3.6, and the expected vectors are restated independently in this file;
//   - C5's filesystem seam (plan 2.6) is exercised in two forms: an in-memory implementation of the ten pinned methods (for hostile names, injected
//     failures, call ordering and publication races) and the real filesystem wrapped by a recorder (for real junctions, real bytes and real sizes);
//   - real Git is used only where plan 4.2 names it: the diverged graph with a dirty trusted checkout, local tracked/untracked semantics, autocrlf,
//     stat-dirty content, skip-worktree, the removed-index case, the clean-filter sentinel, the embedded repository inventory, renderer conformance
//     (C5-P2-5), the installed CLI with a missing helper, and the lifecycle CLI guards.
//
// Where the plan does not pin a value a test would need, the test asserts only what is pinned. The gaps are listed in the delegation report as PLAN-GAP
// lines; the places they touch carry a comment starting with "PLAN-GAP".
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
const bytes = (s) => (Buffer.isBuffer(s) ? s : Buffer.from(s, 'utf8'));
const utf8Cmp = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
const byUtf8 = (list) => [...list].sort(utf8Cmp);
const uniq = (list) => [...new Set(list)];
const nul = (names) => Buffer.from(names.map((n) => `${n}\0`).join(''), 'utf8');
const sameBuf = (a, b) => Buffer.isBuffer(a) && Buffer.isBuffer(b) && Buffer.compare(a, b) === 0;
const WIN = process.platform === 'win32';
const EMPTY = Buffer.alloc(0);
const textOf = (b) => (Buffer.isBuffer(b) ? b.toString('utf8') : String(b));
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
const relPosix = (root, p) => fwd(path.relative(root, String(p)));
const cat = (...parts) => Buffer.concat(parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(String(p), 'utf8'))));

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
// Runs fn while recording (and swallowing) any attempt to write a process stream or exit; the exit code is restored.
async function withStreamGuard(fn) {
  const rec = { out: [], err: [], exits: [], value: undefined, threw: null };
  const ow = process.stdout.write; const ew = process.stderr.write; const ex = process.exit; const code0 = process.exitCode;
  const cb = (rest) => { const f = rest.find((x) => typeof x === 'function'); if (f) f(); };
  process.stdout.write = function (c, ...rest) { rec.out.push(String(c)); cb(rest); return true; };
  process.stderr.write = function (c, ...rest) { rec.err.push(String(c)); cb(rest); return true; };
  process.exit = function (c) { rec.exits.push(c); throw new Error('process.exit called'); };
  try { rec.value = await fn(); } catch (e) { rec.threw = e; } finally { process.stdout.write = ow; process.stderr.write = ew; process.exit = ex; }
  rec.exitCodeChanged = process.exitCode !== code0;
  if (rec.exitCodeChanged) process.exitCode = code0;
  return rec;
}

const scriptUrl = (context, name) => pathToFileURL(path.join(context.skillRoot, 'scripts', name)).href;
const assetUrl = (context, rel) => pathToFileURL(path.join(context.skillRoot, ...rel.split('/'))).href;
async function importOrFail(failures, url, label) {
  try { return await import(url); } catch (e) { failures.push(`cannot import ${label}: ${errMsg(e)}`); return null; }
}
const needSibling = (failures, rel) => importOrFail(failures, new URL(rel, import.meta.url).href, `tests/${rel}`);

// ------------------------------------------------------------- scratch ----
// The native (long-name) real path: Git, the setup scripts and the code under test all report that spelling, so every recorded path compares equal to it.
function scratchDir(context, label) {
  fs.mkdirSync(context.tmp, { recursive: true });
  return fs.realpathSync.native(fs.mkdtempSync(path.join(context.tmp, `c5-${label}-`)));
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
// The retained diagnostics of plan 4.3 ("record that optional subcase in retained diagnostics"): a plain file in the kept scratch directory.
function diag(context, line) { try { fs.mkdirSync(context.tmp, { recursive: true }); fs.appendFileSync(path.join(context.tmp, 'c5-diagnostics.log'), `${line}\n`); } catch { /* best effort */ } }

// ------------------------------------------------------- import safety ----
// Same criteria as C1-C4: no spawn, no filesystem write, no output, no process.exit, no exit code, no environment change.
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

// ============================================================ literals ====
// Written out independently of the implementation (plan 4.1: "Write expected descriptors independently").
const COMPONENT_INVENTORY = [
  ['R65/C5/local', 'local review includes safe working changes'],
  ['R65/C5/index', 'local review leaves the index and Git state unchanged'],
  ['R66/C5/limits-documentation', 'copied secret content limitation is documented'],
  ['R90/C5/committed', 'committed review excludes trusted checkout changes'],
  ['R90/C5/identity', 'review headers record resolved comparison identity'],
  ['R91/C5/inputs', 'disk inputs are checked before content reads'],
  ['R91/C5/artifacts', 'artifact paths and names are confined'],
  ['R91/C5/links', 'links junctions and escapes are refused'],
  ['R91/C5/publication', 'exclusive publication preserves existing files'],
  ['R92/C5/reserved', 'setup lifecycle rejects reserved review aliases'],
  ['R92/C5/cleanup', 'setup cleanup preserves review artifacts'],
  ['R92/C5/stdout', 'stdout review creates no artifacts'],
  ['R74/C5/corpus', 'shared policy corpus reaches both review modes'],
  ['R76/C5/arguments', 'review grammar and Git vectors are pinned'],
  ['R76/C5/failures', 'review failures emit no partial content'],
  ['R97/C5/environment-names', 'environment name variants stay excluded'],
  ['R100/C5/limits', 'complete review results obey the byte limit'],
  ['R100/C5/narrowing', 'literal narrowing covers safe review subsets'],
];
const EXPECTED_DESCRIPTORS = COMPONENT_INVENTORY.map(([id, name]) => ({ id, name }));

const MAX_BYTES = 1048576;
const MAX_UNITS = 24000;
const CORE_REL = 'assets/tools/git-safe-core.mjs';
const ENTRY_REL = 'assets/tools/git-safe.mjs';
const REVIEW_REL = 'assets/tools/review-diff.mjs';
const POLICY_REL = 'assets/tools/security-policy.mjs';
const REVIEW_EXPORTS = ['REVIEW_FORM', 'defaultReviewArtifactPath', 'parseReviewArgs', 'reviewMain'];
const CORE_EXPORTS = ['MAX_GIT_ARG_UNITS', 'MAX_OUTPUT_BYTES', 'NARROWING_GUIDANCE', 'SUPPORTED_FORMS', 'createGitSession', 'executeGitSafe', 'main', 'parseGitSafeArgs', 'sanitizeGitEnvironment'];
const REVIEW_FORM = 'review-diff --base <ref> [--head <ref>] [--out <file>] [-- <paths>...]';
const COMMANDS = ['diff', 'log', 'show', 'cat', 'ls', 'grep'];
const COMMANDS_TEXT = 'diff, log, show, cat, ls, grep, review-diff';
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

// Plan 3.13: every error line. A library error is an Error with an own string code and a message that starts with "<CODE>: ".
const E = {
  INPUT: 'GIT_SAFE_INPUT: invalid Git helper input',
  COMMAND: `GIT_SAFE_COMMAND: supported commands: ${COMMANDS_TEXT}`,
  ARGUMENT: `GIT_SAFE_ARGUMENT: unsupported arguments; supported: ${REVIEW_FORM}`,
  VERSION: 'GIT_SAFE_VERSION: Git 2.31 or later is required',
  REPOSITORY: 'GIT_SAFE_REPOSITORY: not inside a Git repository',
  POLICY_IO: 'GIT_SAFE_POLICY_IO: cannot read .ai/security-paths.json; refusing to run without a valid policy',
  SECRET: 'GIT_SAFE_SECRET: requested path is protected by the security policy',
  REVISION: 'GIT_SAFE_REVISION: revision does not resolve to a commit',
  RECORD: 'GIT_SAFE_RECORD: invalid Git metadata; no result was emitted',
  GIT: 'GIT_SAFE_GIT: Git operation failed; no result was emitted',
  INTERNAL: 'GIT_SAFE_INTERNAL: internal failure; no result was emitted',
  ARG_LIMIT: 'GIT_SAFE_ARG_LIMIT: Git arguments exceed the safe invocation bound; narrow with -- <paths> or a smaller commit range. No result was emitted.',
  LIMIT: 'GIT_SAFE_LIMIT: output exceeds 1048576 bytes. Narrow with -- <paths>. No partial result was emitted; this review is not complete.',
  OUT: 'REVIEW_OUT: output must be a Windows-safe .diff file directly under .ai/.run/review/',
  PATH: 'REVIEW_PATH: unsafe review filesystem path; no result was emitted',
  TYPE: 'REVIEW_TYPE: review input is not a regular file; no result was emitted',
  IO: 'REVIEW_IO: review filesystem operation failed; no result was emitted',
  UNMERGED: 'REVIEW_UNMERGED: selected paths contain unresolved index entries; no result was emitted',
  ARTIFACT_INPUT: 'REVIEW_ARTIFACT_INPUT: review artifacts cannot be selected as review input',
  EXISTS: 'REVIEW_EXISTS: review artifact already exists; choose another output name',
  CLEANUP: 'REVIEW_CLEANUP: artifact cleanup failed; discard the incomplete artifact',
  IGNORE: 'REVIEW_IGNORE: .ai/.run/.gitignore must contain exactly "*\\n"; no artifact was written',
};
const codeOf = (message) => message.slice(0, message.indexOf(':'));
const stderrLine = (message) => `git-safe: ${message}\n`;

// Plan 3.4 and C4 3.4: the environment names that are removed, and the five that are then set (restated independently).
const ENV_REMOVE = ['GIT_CONFIG', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT', 'GIT_EXTERNAL_DIFF', 'GIT_DIFF_OPTS', 'GIT_PAGER', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_NAMESPACE', 'GIT_PREFIX', 'GIT_ATTR_SOURCE', 'GIT_REPLACE_REF_BASE', 'GIT_NO_REPLACE_OBJECTS', 'GIT_TERMINAL_PROMPT',
  'GIT_OPTIONAL_LOCKS', 'GIT_LITERAL_PATHSPECS', 'GIT_GLOB_PATHSPECS', 'GIT_NOGLOB_PATHSPECS', 'GIT_ICASE_PATHSPECS', 'PAGER'];
const ENV_SET = { GIT_PAGER: 'cat', PAGER: 'cat', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1' };
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
// A restatement of plan 3.4-3.6 (every operation vector, without the fixed prefix P).
const LIT = (p) => `:(literal)${p}`;
const EXC = (p) => `:(exclude,literal)${p}`;
const D_FLAGS = ['--no-ext-diff', '--no-textconv', '--no-renames', '--no-color', '--submodule=short', '--ignore-submodules=none', '--src-prefix=a/', '--dst-prefix=b/'];
const FIXED_EXCL = ['.ai/.run/review', '.ai/.run/.gitignore'];
// C5-P2-1: one list, deduplicated by exact string and sorted once by UTF-8 bytes; E maps every element.
const E_OF = (names = []) => byUtf8(uniq([...names, ...FIXED_EXCL])).map(EXC);
const V_VERSION = ['--version'];
const V_ROOT = ['rev-parse', '--show-toplevel'];
const V_RESOLVE = (rev) => ['rev-parse', '--verify', '--quiet', '--end-of-options', `${rev}^{commit}`];
const V_MB = (a, b) => ['merge-base', a, b];
const V_INV_C = (m, h, L = []) => ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--no-color', '--ignore-submodules=none', '--name-only', '-z', m, h, '--', ...L];
const V_DIFF_C = (m, h, L = [], X = E_OF()) => ['diff', ...D_FLAGS, '--patch', m, h, '--', ...L, ...X];
const V_TREE = (m) => ['ls-tree', '-r', '-z', '--full-tree', m];
const V_CACHED = (L = []) => ['ls-files', '--cached', '--stage', '-z', '--', ...L];
const V_OTHERS = (L = []) => ['ls-files', '--others', '--exclude-standard', '-z', '--', ...L];
const V_DI = (m, L = [], X = E_OF()) => ['diff-index', ...D_FLAGS, '-p', m, '--', ...L, ...X];
const sel = (...p) => p.map(LIT);

// The fixed identities of plan 4.3 R90/C5/identity.
const B1 = '1'.repeat(40);
const H2 = '2'.repeat(40);
const M3 = '3'.repeat(40);
const MODE_C = 'committed-head';
const MODE_L = 'local-worktree';
const hdr = (mode, b = B1, h = H2, m = M3) => `# review-diff mode=${mode} base=${b} head=${h} merge-base=${m}\n\n`;
const HDR_C = hdr(MODE_C);
const HDR_L = hdr(MODE_L);
const RD = (...a) => ['review-diff', ...a];
const ARGV_C = RD('--base', 'base-ref', '--head', 'head-ref');
const ARGV_L = RD('--base', 'base-ref');
// The operation vectors of one run with the default seam identities (spellings base-ref, head-ref and HEAD).
const OPS_C = ({ L = [], X = E_OF(), content = true } = {}) => [V_RESOLVE('base-ref'), V_RESOLVE('head-ref'), V_MB(B1, H2), V_INV_C(M3, H2, L), ...(content ? [V_DIFF_C(M3, H2, L, X)] : [])];
const OPS_L = ({ L = [], X = E_OF(), diffIndex = true } = {}) => [V_RESOLVE('base-ref'), V_RESOLVE('HEAD'), V_MB(B1, H2), V_TREE(M3), V_CACHED(L), V_OTHERS(L), ...(diffIndex ? [V_DI(M3, L, X)] : [])];

// ===================================================== the execute seam ====
// A fake executor that answers by recognizing the pinned operation vectors (plan 3.5 and 3.6). It records every call exactly as the code made it, so tests
// compare complete argv arrays, the cwd, the environment and the limit. Nothing here is taken from the code under test.
const fakeOid = (s) => sha1(`c5-fake:${s}`);
const OID_BLOB = 'a6b681bf44990ef08933f24aa3102b9ac8f2c194';
const OID_A = 'a'.repeat(40);
const okRes = (stdout, status = 0) => ({ status, signal: null, error: null, stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(String(stdout), 'utf8'), overflow: false });
const asRes = (x) => (Buffer.isBuffer(x) || typeof x === 'string' ? okRes(x) : x);
const bad = (status, stdout = '') => ({ status, signal: null, error: null, stdout: Buffer.from(stdout), overflow: false });
// Tree records (C4 3.5): an entry is a path string (a regular file) or { path, mode, type, oid }.
function treeBuf(entries) {
  return Buffer.from(entries.map((e) => {
    const o = typeof e === 'string' ? { path: e } : e;
    return `${o.mode || '100644'} ${o.type || (o.mode === '160000' ? 'commit' : 'blob')} ${o.oid || OID_BLOB}\t${o.path}\0`;
  }).join(''), 'utf8');
}
// Index records (plan 3.6): <mode> SP <oid> SP <stage> TAB <path> NUL; an entry is a path or { path, mode, oid, stage }.
function idxBuf(entries) {
  return Buffer.from(entries.map((e) => {
    const o = typeof e === 'string' ? { path: e } : e;
    return `${o.mode || '100644'} ${o.oid || OID_A} ${o.stage === undefined ? 0 : o.stage}\t${o.path}\0`;
  }).join(''), 'utf8');
}
function kindOf(op) {
  const n = op[0];
  if (n === '--version') return 'version';
  if (n === 'rev-parse' && op[1] === '--show-toplevel') return 'root';
  if (n === 'rev-parse' && op[1] === '--verify') return 'resolve';
  if (n === 'merge-base') return 'mergeBase';
  if (n === 'ls-tree') return 'tree';
  if (n === 'ls-files') return op.includes('--cached') ? 'cached' : op.includes('--others') ? 'others' : 'unknown';
  if (n === 'diff-index') return 'diffIndex';
  if (n === 'diff') return op.includes('-z') ? 'invDiff' : 'diff';
  return 'unknown';
}
const CONTENT_KINDS = ['diff', 'diffIndex'];
function seamPaths(context) {
  const base = path.resolve(context.tmp, 'c5-seam');
  return { root: path.join(base, 'repo'), start: path.join(base, 'start') };
}
const SEAM_ENV = {
  PATH: process.env.PATH || process.env.Path || '/usr/bin', HOME: '/seam/home', USERPROFILE: '/seam/home', GIT_CONFIG_GLOBAL: '/seam/global.gitconfig', GIT_CONFIG_SYSTEM: '/seam/system.gitconfig',
  GIT_CONFIG_NOSYSTEM: '1', GIT_TEST_ASSUME_DIFFERENT_OWNER: '1', GIT_PAGER: 'less', PAGER: 'less', GIT_EXTERNAL_DIFF: '/seam/ext-diff', GIT_DIR: '/seam/elsewhere',
  GIT_INDEX_FILE: '/seam/caller.index', GIT_OPTIONAL_LOCKS: '1', FOO_BAR: 'kept',
};
// The default world: the spellings base-ref, head-ref and HEAD resolve to the fixed identities and the merge-base is M3.
const DEF_IDS = { 'base-ref': B1, 'head-ref': H2, HEAD: H2 };
function makeFake(context, o = {}) {
  const paths = seamPaths(context);
  const calls = [];
  const S = {
    version: 'git version 2.53.0.windows.2\r\n', root: `${fwd(paths.root)}\n`, ids: { ...DEF_IDS }, missing: new Set(), invDiff: EMPTY, tree: [], treeBuf: null,
    cached: EMPTY, others: EMPTY, content: Buffer.from('CONTENT\n'), mergeBase: `${M3}\n`, handle: null, resolveOut: null, ...o,
  };
  if (o.ids) S.ids = { ...DEF_IDS, ...o.ids };
  const execute = async (req) => {
    const call = { argv: Array.isArray(req.argv) ? req.argv.map(String) : req.argv, cwd: req.cwd, env: { ...req.env }, limit: req.limit, keys: Object.keys(req) };
    calls.push(call);
    const op = call.argv.slice(PREFIX.length);
    call.op = op; call.kind = kindOf(op); call.prefixOk = eq(call.argv.slice(0, PREFIX.length), PREFIX);
    if (S.handle) {
      const r = await S.handle(call.kind, op, call, calls.length - 1);
      if (r !== undefined) return r !== null && typeof r === 'object' && hasOwn(r, '__raw') ? r.__raw : asRes(r); // { __raw: v } hands v to the code verbatim
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
      case 'mergeBase': return pick(S.mergeBase);
      case 'invDiff': return pick(S.invDiff);
      case 'tree': return pick(S.treeBuf !== null ? S.treeBuf : treeBuf(S.tree));
      case 'cached': return pick(S.cached);
      case 'others': return pick(S.others);
      case 'diff': case 'diffIndex': return pick(S.content);
      default: return { status: 127, signal: null, error: null, stdout: EMPTY, overflow: false };
    }
  };
  return { execute, calls, S, paths, ops: () => calls.slice(2).map((c) => c.op), kinds: () => calls.map((c) => c.kind) };
}
const DEFAULT_POLICY = { schema: 2, patterns: [{ anchor: 'any', glob: '**/.env*' }], projectPatterns: [{ anchor: 'root', glob: 'private/**' }] };
const pol2 = (patterns, projectPatterns = []) => ({ schema: 2, patterns, projectPatterns });
const PL = pol2([{ anchor: 'any', glob: '**/.env*' }], [{ anchor: 'root', glob: 'private/**' }]);

// Imports the review helper once per assertion: a missing module or export is a failure of that assertion, never of the registry.
async function loadReview(failures, context) {
  const rv = await importOrFail(failures, assetUrl(context, REVIEW_REL), REVIEW_REL);
  if (!rv) return null;
  const missing = REVIEW_EXPORTS.filter((n) => !(n in rv));
  if (missing.length) { failures.push(`${REVIEW_REL} lacks exports: ${missing.join(', ')}`); return null; }
  return rv;
}
const loadCore = (failures, context) => importOrFail(failures, assetUrl(context, CORE_REL), CORE_REL);
// A library error: an Error with an own string code and a message that starts with "<CODE>: " (plan 3.13). `message` is the whole message.
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

// ================================================= filesystem seams (plan 2.6) ====
// The ten methods of the pinned seam. TEN is the exact set; `readSync` is served lazily (see makeSeam) because C5-P2-9 needs a bounded read the ten-method
// list does not provide (PLAN-GAP: the plan does not say through which seam method min(size, 8000) bytes are read).
const TEN = ['lstatSync', 'realpathSync', 'mkdirSync', 'openSync', 'fstatSync', 'readFileSync', 'writeSync', 'fsyncSync', 'closeSync', 'unlinkSync'];
const FO = fs.constants;
const fsErr = (code, op, p) => Object.assign(new Error(`${code}: injected failure in ${op}`), { code, syscall: op, path: typeof p === 'string' ? p : undefined });
const S_IFMT = 0o170000;
class VStats {
  constructor(o) { Object.assign(this, o); }
  isFile() { return (this.mode & S_IFMT) === 0o100000; }
  isDirectory() { return (this.mode & S_IFMT) === 0o040000; }
  isSymbolicLink() { return (this.mode & S_IFMT) === 0o120000; }
  isFIFO() { return (this.mode & S_IFMT) === 0o010000; }
  isBlockDevice() { return false; }
  isCharacterDevice() { return false; }
  isSocket() { return false; }
}
// An in-memory filesystem of nodes keyed by resolved path: directories, files, links and a FIFO. Every ancestor of the root exists. Identity is the node's ino;
// an open descriptor stays bound to its node, so a replacement between a check and an open is visible as a different ino.
function makeVfs(rootAbs) {
  const nodes = new Map();
  const K = (p) => path.resolve(String(p));
  let inoSeq = 5000;
  let fdSeq = 100;
  const fds = new Map();
  const mk = (kind, extra = {}) => ({ kind, ino: ++inoSeq, mode: kind === 'dir' ? 0o755 : 0o644, ...extra });
  const ancestors = (p) => { const out = []; let cur = path.resolve(p); for (;;) { out.push(cur); const up = path.dirname(cur); if (up === cur) break; cur = up; } return out; };
  const ensureDirs = (p) => { for (const a of ancestors(p)) if (!nodes.has(K(a))) nodes.set(K(a), mk('dir')); };
  ensureDirs(rootAbs);
  const abs = (rel) => path.resolve(rootAbs, ...String(rel).split('/'));
  function realpathV(p, depth = 0) {
    if (depth > 20) throw fsErr('ELOOP', 'realpath', p);
    const a = path.resolve(String(p));
    const rootPart = path.parse(a).root;
    const parts = a.slice(rootPart.length).split(path.sep).filter(Boolean);
    let cur = rootPart;
    for (let i = 0; i < parts.length; i++) {
      cur = path.join(cur, parts[i]);
      const n = nodes.get(K(cur));
      if (!n) throw fsErr('ENOENT', 'realpath', p);
      if (n.kind === 'link') return realpathV(path.join(path.resolve(path.dirname(cur), n.target), ...parts.slice(i + 1)), depth + 1);
    }
    return cur;
  }
  function locate(p, followLeaf) {
    const a = path.resolve(String(p));
    const parent = realpathV(path.dirname(a));
    let full = path.join(parent, path.basename(a));
    let n = nodes.get(K(full)) || null;
    let hops = 0;
    while (n && n.kind === 'link' && followLeaf) {
      if (++hops > 20) throw fsErr('ELOOP', 'open', p);
      full = realpathV(path.resolve(path.dirname(full), n.target));
      n = nodes.get(K(full)) || null;
    }
    return { n, full };
  }
  const fmtOf = { file: 0o100000, dir: 0o040000, link: 0o120000, other: 0o010000 };
  const statOf = (n) => new VStats({
    dev: 1, ino: n.ino, mode: fmtOf[n.kind] | (n.mode & 0o7777), nlink: 1, uid: 0, gid: 0, rdev: 0, blksize: 4096, blocks: 0,
    size: n.sizeOverride !== undefined ? n.sizeOverride : n.kind === 'file' ? n.data.length : 0, atimeMs: 0, mtimeMs: n.mtimeMs || 0, ctimeMs: 0, birthtimeMs: 0,
  });
  const entry = (fd) => { const e = fds.get(fd); if (!e) throw fsErr('EBADF', 'fd', String(fd)); return e; };
  const v = {
    root: rootAbs,
    maxWrite: Infinity,
    dir(rel) { ensureDirs(abs(rel)); return nodes.get(K(abs(rel))); },
    file(rel, data, o = {}) { ensureDirs(path.dirname(abs(rel))); const n = mk('file', { data: Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8'), ...o }); nodes.set(K(abs(rel)), n); return n; },
    link(rel, target) { ensureDirs(path.dirname(abs(rel))); const n = mk('link', { target }); nodes.set(K(abs(rel)), n); return n; },
    other(rel) { ensureDirs(path.dirname(abs(rel))); const n = mk('other'); nodes.set(K(abs(rel)), n); return n; },
    get(rel) { return nodes.get(K(abs(rel))) || null; },
    has(rel) { return nodes.has(K(abs(rel))); },
    remove(rel) { nodes.delete(K(abs(rel))); },
    bytesOf(rel) { const n = v.get(rel); return n && n.kind === 'file' ? Buffer.from(n.data) : null; },
    openFds() { return [...fds.keys()]; },
    // Every file, directory and link below the root: [relative path, kind, sha256 of the bytes].
    snapshot() {
      const out = [];
      for (const [k, n] of nodes) {
        const r = path.relative(rootAbs, k);
        if (r === '' || r.startsWith('..') || path.isAbsolute(r)) continue;
        out.push([fwd(r), n.kind, n.kind === 'file' ? sha(n.data) : null]);
      }
      return JSON.stringify(out.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)));
    },
    realpath: realpathV,
  };
  v.impl = {
    lstatSync(p, opts) { const { n } = locate(p, false); if (!n) { if (opts && opts.throwIfNoEntry === false) return undefined; throw fsErr('ENOENT', 'lstat', p); } return statOf(n); },
    realpathSync(p) { return realpathV(p); },
    mkdirSync(p) {
      const a = path.resolve(String(p));
      const par = locate(path.dirname(a), true);
      if (!par.n) throw fsErr('ENOENT', 'mkdir', p);
      if (par.n.kind !== 'dir') throw fsErr('ENOTDIR', 'mkdir', p);
      const full = path.join(par.full, path.basename(a));
      if (nodes.has(K(full))) throw fsErr('EEXIST', 'mkdir', p);
      nodes.set(K(full), mk('dir'));
    },
    openSync(p, flags, mode) {
      const f = flags === undefined ? 'r' : flags;
      const str = typeof f === 'string';
      const write = str ? /[wa+]/.test(f) : (f & (FO.O_WRONLY | FO.O_RDWR | FO.O_CREAT)) !== 0;
      const excl = str ? f.includes('x') : (f & FO.O_EXCL) !== 0;
      const nofollow = !str && FO.O_NOFOLLOW !== undefined && (f & FO.O_NOFOLLOW) !== 0;
      let node;
      if (write) {
        const par = locate(path.dirname(path.resolve(String(p))), true);
        if (!par.n) throw fsErr('ENOENT', 'open', p);
        if (par.n.kind !== 'dir') throw fsErr('ENOTDIR', 'open', p);
        const { n, full } = locate(p, false);
        if (n && excl) throw fsErr('EEXIST', 'open', p);
        if (n && n.kind === 'link') throw fsErr('ELOOP', 'open', p);
        if (n && n.kind === 'dir') throw fsErr('EISDIR', 'open', p);
        if (n) { n.data = Buffer.alloc(0); node = n; } else { node = mk('file', { data: Buffer.alloc(0), mode: (mode === undefined ? 0o666 : mode) & 0o777 }); nodes.set(K(full), node); }
      } else {
        const l = locate(p, false);
        if (l.n && l.n.kind === 'link' && nofollow) throw fsErr('ELOOP', 'open', p);
        const r = locate(p, true);
        if (!r.n) throw fsErr('ENOENT', 'open', p);
        node = r.n;
      }
      const fd = ++fdSeq;
      fds.set(fd, { node, path: String(p), write });
      return fd;
    },
    fstatSync(fd) { return statOf(entry(fd).node); },
    readFileSync(x) {
      if (typeof x === 'number') { const n = entry(x).node; if (n.kind !== 'file') throw fsErr('EISDIR', 'read', String(x)); return Buffer.from(n.data); }
      const { n } = locate(x, true);
      if (!n) throw fsErr('ENOENT', 'open', x);
      if (n.kind !== 'file') throw fsErr('EISDIR', 'read', x);
      return Buffer.from(n.data);
    },
    readSync(fd, buf, off = 0, len = buf.length, pos = null) {
      const n = entry(fd).node;
      const start = pos === null || pos === undefined ? 0 : Number(pos);
      const chunk = n.data.subarray(start, start + len);
      chunk.copy(buf, off);
      return chunk.length;
    },
    writeSync(fd, data, off, len) {
      const e = entry(fd);
      if (!e.write) throw fsErr('EBADF', 'write', String(fd));
      const b = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      const o = off === undefined ? 0 : off;
      const l = len === undefined ? b.length - o : len;
      const n = Math.min(l, v.maxWrite);
      e.node.data = Buffer.concat([e.node.data, b.subarray(o, o + n)]);
      return n;
    },
    fsyncSync(fd) { entry(fd); },
    closeSync(fd) { entry(fd); fds.delete(fd); },
    unlinkSync(p) {
      const { n, full } = locate(p, false);
      if (!n) throw fsErr('ENOENT', 'unlink', p);
      if (n.kind === 'dir') throw fsErr('EPERM', 'unlink', p);
      nodes.delete(K(full));
    },
  };
  return v;
}
// The real filesystem behind the same ten methods (and readSync). realpathSync is the native resolver, as plan 2.6 pins for the default.
function realImpl() {
  return {
    lstatSync: (...a) => fs.lstatSync(...a), realpathSync: (p) => fs.realpathSync.native(p), mkdirSync: (...a) => fs.mkdirSync(...a), openSync: (...a) => fs.openSync(...a),
    fstatSync: (...a) => fs.fstatSync(...a), readFileSync: (...a) => fs.readFileSync(...a), writeSync: (...a) => fs.writeSync(...a), fsyncSync: (...a) => fs.fsyncSync(...a),
    closeSync: (...a) => fs.closeSync(...a), unlinkSync: (...a) => fs.unlinkSync(...a), readSync: (...a) => fs.readSync(...a),
  };
}
// A recording wrapper over an implementation. The returned `fs` holds exactly the ten pinned methods as own keys; any other method of the implementation (readSync)
// is served lazily through a proxy and recorded as well. faults: [{ op, when?(args, entry), once?, hook?(args, entry), error?: code, result?: value|fn, mutate?(result, args) }].
const shortArg = (a) => (typeof a === 'string' || typeof a === 'number' || typeof a === 'boolean' || a === null || a === undefined ? a : Buffer.isBuffer(a) ? `<Buffer ${a.length}>` : a && a.constructor && a.constructor.name === 'Uint8Array' ? `<Uint8Array ${a.length}>` : '<object>');
function makeSeam(impl, { faults = [], plain = false } = {}) {
  const log = [];
  const counts = {};
  let bytesRead = 0;
  const wrap = (op) => (...args) => {
    counts[op] = (counts[op] || 0) + 1;
    const ent = { op, n: counts[op], args: args.map(shortArg), rawArgs: args };
    log.push(ent);
    for (const f of faults) {
      if (f.op !== op || f.done) continue;
      if (f.when && !f.when(args, ent)) continue;
      if (f.once) f.done = true;
      if (f.hook) f.hook(args, ent);
      if (f.error) { ent.fault = f.error; throw fsErr(f.error, op, args[0]); }
      if (hasOwn(f, 'result')) { ent.fault = 'result'; return typeof f.result === 'function' ? f.result(args, ent) : f.result; }
      if (f.mutate) { const r = impl[op](...args); ent.fault = 'mutate'; return f.mutate(r, args); }
    }
    const r = impl[op](...args);
    if (op === 'openSync') ent.result = r;
    if (op === 'readFileSync' && Buffer.isBuffer(r)) bytesRead += r.length;
    if (op === 'readSync' && Number.isInteger(r)) bytesRead += r;
    return r;
  };
  const ten = {};
  for (const op of TEN) ten[op] = wrap(op);
  ten.realpathSync.native = ten.realpathSync;
  const extras = {};
  const fsObj = plain ? ten : new Proxy(ten, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'string' && typeof impl[k] === 'function') { if (!extras[k]) extras[k] = wrap(k); return extras[k]; }
      return undefined;
    },
  });
  return {
    fs: fsObj, log, faults,
    bytesRead: () => bytesRead,
    ops: (...names) => log.filter((e) => names.includes(e.op)),
    paths: (...names) => log.filter((e) => names.includes(e.op)).map((e) => e.args[0]),
    under: (root, rel) => { const base = path.resolve(root, ...rel.split('/')).toLowerCase(); return log.filter((e) => typeof e.args[0] === 'string' && (path.resolve(e.args[0]).toLowerCase() === base || path.resolve(e.args[0]).toLowerCase().startsWith(base + path.sep))); },
    count: () => log.length,
    reset: () => { log.length = 0; bytesRead = 0; for (const k of Object.keys(counts)) counts[k] = 0; },
  };
}
// A seam whose every method fails: a committed stdout review must never touch the working files (plan 4.3 R90/C5/committed).
function throwingSeam() {
  const impl = {};
  for (const op of [...TEN, 'readSync']) impl[op] = () => { throw fsErr('EIO', op); };
  return makeSeam(impl);
}
// The real or in-memory seam of one run; o.vfs / o.real select the implementation, o.faults inject failures.
const vfsSeam = (vfs, o = {}) => makeSeam(vfs.impl, o);
const realSeam = (o = {}) => makeSeam(realImpl(), o);

// ============================================================ the run harness ====
// Runs reviewMain with the seams. o.world configures the fake; o.policy / o.policyText / o.policyBuf the installed policy; o.seam the filesystem seam;
// o.fake reuses a fake; o.env, o.cwd override the defaults.
async function seamReview(rv, context, argv, o = {}) {
  const fake = o.fake || makeFake(context, o.world || {});
  const reads = [];
  const policyBuf = o.policyBuf !== undefined ? o.policyBuf : bytes(typeof o.policyText === 'string' ? o.policyText : jsonText(o.policy !== undefined ? o.policy : DEFAULT_POLICY));
  const readFile = o.readFile || (async (p) => { reads.push(p); return policyBuf; });
  const deps = { cwd: o.cwd || fake.paths.start, env: o.env || SEAM_ENV, execute: fake.execute, readFile };
  if (o.seam) deps.fs = o.seam.fs;
  if (o.extraDeps) Object.assign(deps, o.extraDeps);
  const r = await rv.reviewMain(argv, deps);
  return { r, fake, reads, ops: fake.ops(), seam: o.seam || null };
}
// reviewMain's exact result (plan 2.6): { exitCode, stdout: Buffer, stderr: string }.
function expectRes(check, label, r, { exit, stdout = EMPTY, stderr = '' }) {
  check(r !== null && typeof r === 'object' && eq(sorted(Object.keys(r)), ['exitCode', 'stderr', 'stdout']), `${label}: the result holds exactly exitCode, stdout, stderr`, r && Object.keys(r));
  if (!r) return;
  check(r.exitCode === exit, `${label}: exit code ${exit}`, r.exitCode);
  check(Buffer.isBuffer(r.stdout) && sameBuf(r.stdout, bytes(stdout)), `${label}: stdout is exactly the expected bytes`, { got: r.stdout && r.stdout.length, want: bytes(stdout).length, head: Buffer.isBuffer(r.stdout) ? r.stdout.subarray(0, 200) : r.stdout, wantHead: bytes(stdout).subarray(0, 200) });
  check(typeof r.stderr === 'string' && r.stderr === stderr, `${label}: stderr is exactly ${show(stderr.slice(0, 200))}`, r.stderr);
}
const failRes = (message) => ({ exit: 2, stdout: EMPTY, stderr: stderrLine(message) });
// The session calls: version then root, both with the starting cwd; every later call has the normalized root as cwd; every call has the exact prefix, the exact keys,
// the sanitized environment and its limit by kind (plan 3.4, 3.5, 3.6; C4 3.8).
function checkCalls(check, label, fake, { env = SEAM_ENV, session = true } = {}) {
  const calls = fake.calls;
  const wantEnv = entriesOf(expectedEnv(env));
  const rootCwd = path.resolve(fwd(fake.paths.root));
  const startCwd = path.resolve(fake.paths.start);
  calls.forEach((c, i) => {
    check(c.prefixOk, `${label}: call ${i} (${c.kind}) starts with the exact fixed prefix P`, c.argv && c.argv.slice(0, 6));
    check(eq(sorted(c.keys), ['argv', 'cwd', 'env', 'limit']), `${label}: call ${i} receives exactly argv, cwd, env, limit`, c.keys);
    check(eq(entriesOf(c.env), wantEnv), `${label}: call ${i} receives the sanitized environment`, c.env && Object.keys(c.env).sort());
    // PLAN-GAP: 3.5 says "metadata uses limit: null" without naming merge-base; either value is accepted for it, as in C4.
    const wantLimit = CONTENT_KINDS.includes(c.kind) ? MAX_BYTES : null;
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

// ============================================================= real Git ====
function gitRun(context, cwd, args, { input, env } = {}) {
  const r = spawnSync('git', args, { cwd, env: env || context.env, input, encoding: 'buffer', shell: false, windowsHide: true, timeout: 120000, maxBuffer: 1 << 28 });
  const out = r.stdout || EMPTY;
  return { code: r.status, out, err: r.stderr || EMPTY, text: out.toString('utf8').trim(), error: r.error || null };
}
const gitOk = (context, cwd, args, o) => { const r = gitRun(context, cwd, args, o); if (r.code !== 0) throw new Error(`git ${args.slice(0, 3).join(' ')} failed (${r.code}): ${r.err.toString('utf8').slice(0, 200)}`); return r; };
// git fast-import stream: one process builds a whole history. Every commit lists its complete tree (deleteall first).
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
    for (const [p, d] of Object.entries(c.files)) { parts.push(Buffer.from(`M 100644 inline ${qpath(p)}\n`)); parts.push(...fiData(Buffer.isBuffer(d) ? d : Buffer.from(String(d)))); }
    parts.push(Buffer.from('\n'));
  });
  return Buffer.concat(parts);
}
// A seam executor that runs the real Git with the request the code made, and records it.
function realExecutor(log = null, intercept = null) {
  return async (req) => {
    const kind = kindOf(req.argv.slice(PREFIX.length));
    if (intercept) { const r = await intercept(kind, req); if (r !== undefined) { if (log) log.push({ argv: req.argv, op: req.argv.slice(PREFIX.length), kind, cwd: req.cwd, env: req.env, limit: req.limit, status: r.status, injected: true }); return r; } }
    const r = spawnSync('git', req.argv, { cwd: req.cwd, env: req.env, encoding: 'buffer', shell: false, windowsHide: true, maxBuffer: 1 << 29, timeout: 120000 });
    let result;
    if (r.error) result = { status: null, signal: null, error: String(r.error.code || r.error.message || 'error'), stdout: EMPTY, overflow: false };
    else if (r.signal) result = { status: null, signal: String(r.signal), error: null, stdout: EMPTY, overflow: false };
    else if (req.limit !== null && r.stdout.length > req.limit) result = { status: null, signal: null, error: null, stdout: r.stdout.subarray(0, req.limit), overflow: true };
    else result = { status: r.status, signal: null, error: null, stdout: r.stdout, overflow: false };
    if (log) log.push({ argv: req.argv, op: req.argv.slice(PREFIX.length), kind, cwd: req.cwd, env: req.env, limit: req.limit, status: r.status, stdout: result.stdout });
    return result;
  };
}
// The raw reference of Git's own bytes, built from this file's flags (never from the code under test).
const rawGit = (context, cwd, args) => gitOk(context, cwd, [...PREFIX, ...args]).out;
// A review over a real repository: real Git through the recording executor, the installed-policy seam, an optional filesystem seam.
async function realReview(rv, context, root, argv, o = {}) {
  const log = [];
  const policyBuf = bytes(jsonText(o.policy !== undefined ? o.policy : PL));
  const deps = { cwd: o.cwd || root, env: o.env || context.env, execute: realExecutor(log, o.intercept || null), readFile: async () => policyBuf };
  if (o.seam) deps.fs = o.seam.fs;
  const r = await rv.reviewMain(argv, deps);
  return { r, log, ops: log.slice(2).map((l) => l.op), kinds: log.slice(2).map((l) => l.kind) };
}

// ====================================== the reference renderer (plan 3.8) ====
// An independent restatement of the untracked new-file patch, used to build expected bytes. Quoting follows Git with core.quotePath=true.
function gitQuoted(text) {
  let out = '';
  let need = false;
  const esc = { 0x07: '\\a', 0x08: '\\b', 0x09: '\\t', 0x0a: '\\n', 0x0b: '\\v', 0x0c: '\\f', 0x0d: '\\r', 0x22: '\\"', 0x5c: '\\\\' };
  for (const b of Buffer.from(text, 'utf8')) {
    if (hasOwn(esc, b)) { out += esc[b]; need = true; } else if (b < 0x20 || b > 0x7e) { out += `\\${b.toString(8).padStart(3, '0')}`; need = true; } else out += String.fromCharCode(b);
  }
  return need ? `"${out}"` : out;
}
function splitBodyLines(data) {
  const lines = [];
  let start = 0;
  for (let i = 0; i < data.length; i++) if (data[i] === 0x0a) { lines.push(data.subarray(start, i)); start = i + 1; }
  const terminated = start === data.length;
  if (!terminated) lines.push(data.subarray(start));
  return { lines, terminated };
}
// exec: whether any executable permission bit is set (POSIX only; the mode is always 100644 on Windows).
function refRender(name, data, { exec = false } = {}) {
  const a = gitQuoted(`a/${name}`);
  const b = gitQuoted(`b/${name}`);
  const mode = WIN ? '100644' : exec ? '100755' : '100644';
  const parts = [Buffer.from(`diff --git ${a} ${b}\nnew file mode ${mode}\n`)];
  if (data.length === 0) return Buffer.concat(parts);
  if (data.subarray(0, 8000).includes(0)) { parts.push(Buffer.from(`Binary files /dev/null and ${b} differ\n`)); return Buffer.concat(parts); }
  const { lines, terminated } = splitBodyLines(data);
  const hunk = lines.length === 1 ? '@@ -0,0 +1 @@' : `@@ -0,0 +1,${lines.length} @@`;
  parts.push(Buffer.from(`--- /dev/null\n+++ ${b}${b.includes(' ') ? '\t' : ''}\n${hunk}\n`)); // C5-P2-4: TAB iff the emitted label contains a space
  for (const l of lines) parts.push(Buffer.from('+'), l, Buffer.from('\n'));
  if (!terminated) parts.push(Buffer.from('\\ No newline at end of file\n'));
  return Buffer.concat(parts);
}
// The untracked section of a result: every file rendered, in UTF-8 byte path order.
const refSection = (files) => Buffer.concat(byUtf8(Object.keys(files)).map((n) => refRender(n, bytes(files[n]))));

// ================================================================ fixtures ====
const CASES_FILE = (context) => path.join(context.skillRoot, 'tests', 'fixtures', 'review-diff-cases.json');
const CORPUS_FILE = (context) => path.join(context.skillRoot, 'tests', 'fixtures', 'security-policy-corpus.json');
const rangeIds = (prefix, from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(2, '0')}`);
// Loads plan 4.2's declarative fixture and checks its shape against the pinned row identifiers. Returns the parsed object or null.
function loadCases(check, context) {
  const f = readJson(CASES_FILE(context));
  if (!f) { check(false, 'tests/fixtures/review-diff-cases.json is readable JSON'); return null; }
  check(eq(Object.keys(f), ['schema', 'grammar', 'outputs', 'aliases', 'renderer']) && f.schema === 1, 'the fixture has exactly schema 1, grammar, outputs, aliases and renderer, in that order', Object.keys(f));
  check(eq((f.grammar || []).map((r) => r.id), [...rangeIds('G', 1, 14), ...rangeIds('G', 20, 60), ...rangeIds('C', 1, 7)]), 'the grammar rows are G01-G14, G20-G60 and C01-C07, in order', (f.grammar || []).map((r) => r.id));
  check(eq((f.outputs || []).map((r) => r.id), [...rangeIds('O', 1, 11), ...rangeIds('X', 1, 54)]), 'the output rows are O01-O11 and X01-X54, in order', (f.outputs || []).map((r) => r.id));
  check(eq((f.aliases || []).map((r) => r.id), rangeIds('A', 1, 23)), 'the alias rows are A01-A23, in order', (f.aliases || []).map((r) => r.id));
  check(eq((f.renderer || []).map((r) => r.id), rangeIds('N', 1, 25)), 'the renderer rows are N01-N25, in order', (f.renderer || []).map((r) => r.id));
  check((f.grammar || []).every((r) => Array.isArray(r.argv) && (hasOwn(r, 'result') !== hasOwn(r, 'error'))) && (f.outputs || []).every((r) => typeof r.out === 'string' && typeof r.accepted === 'boolean')
    && (f.aliases || []).every((r) => typeof r.input === 'string' && typeof r.reserved === 'boolean') && (f.renderer || []).every((r) => typeof r.path === 'string' && typeof r.hex === 'string' && typeof r.expected === 'string'), 'every fixture row has its pinned keys');
  return f;
}
const MODE_TEXT = (row) => (WIN ? '100644' : row.exec ? '100755' : '100644');
// The bytes the fixture pins for a renderer row, with the platform mode substituted.
const rowExpected = (row) => cat(row.expected.replace(/\{MODE\}/g, MODE_TEXT(row)), row.rawTailHex ? Buffer.from(row.rawTailHex, 'hex') : EMPTY);
const rowData = (row) => Buffer.from(row.hex, 'hex');

const baseCache = new Map();
function cached(context, name, build) {
  const key = `${context.tmp}|${name}`;
  if (!baseCache.has(key)) baseCache.set(key, Promise.resolve().then(build));
  return baseCache.get(key);
}
const blob7 = (content) => sha1(Buffer.concat([Buffer.from(`blob ${Buffer.byteLength(content)}\0`), Buffer.from(content)])).slice(0, 7);

// Seam world helpers: a fake executor and an in-memory filesystem sharing one root, with files the run may (or must not) read.
function seamWorld(context, { world = {}, files = {}, faults = [], plain = false } = {}) {
  const fake = makeFake(context, world);
  const vfs = makeVfs(fake.paths.root);
  for (const [n, d] of Object.entries(files)) vfs.file(n, d);
  // faults may be a function of (vfs, root): hooks that change the in-memory filesystem mid-run need the instance.
  const seam = vfsSeam(vfs, { faults: typeof faults === 'function' ? faults(vfs, fake.paths.root) : faults, plain });
  return { fake, vfs, seam, root: fake.paths.root };
}
// The names a seam recorded, relative to the root, ignoring the root itself.
const touched = (sw) => uniq(sw.seam.log.filter((e) => typeof e.args[0] === 'string').map((e) => relPosix(sw.root, e.args[0])).filter((r) => r !== ''));

// ============================================ the real review repositories ====
// G: the diverged graph of plan 4.2. base0 (the merge-base M) <- side (B) and topic (H, the checked-out HEAD). H changes safe, protected and artifact paths.
const G_BASE = {
  '.gitignore': '*.log\n', 'keep.txt': 'k1\nk2\nk3\n', 'mod.txt': 'm1\nm2\nm3\n', 'del.txt': 'del\n', 'del2.txt': 'del2\n', 'restore.txt': 'r-base\n', 'skipw.txt': 'skip\n',
  'rmidx.txt': 'rmidx\n', '.env': 'M-ENV-SECRET-MARKER\n', 'private/p.txt': 'M-PRIVATE-MARKER\n', 'src/a.txt': 'a-base\n',
};
const G_SAFE_NAMES = ['.gitignore', 'keep.txt', 'mod.txt', 'del.txt', 'del2.txt', 'restore.txt', 'skipw.txt', 'rmidx.txt', 'src/a.txt', 'h-only.txt', 'staged-add.txt', 'ghost.txt'];
function gCommits() {
  const side = { ...G_BASE, 'b-only.txt': 'b-only\n' };
  const topic = {
    ...G_BASE, 'mod.txt': 'm1\nM2-TOPIC\nm3\n', 'h-only.txt': 'h-only\n', '.env': 'H-ENV-SECRET-MARKER\n', 'private/q.txt': 'H-PRIVATE-MARKER\n',
    '.ai/.run/review/old.diff': 'OLD-ARTIFACT-MARKER\n', '.ai/.run/.gitignore': '*\n',
  };
  return [
    { ref: 'base0', when: 1700000000, message: 'base\n', parents: [], files: G_BASE },
    { ref: 'side', when: 1700000100, message: 'side\n', parents: ['base0'], files: side },
    { ref: 'topic', when: 1700000200, message: 'topic\n', parents: ['base0'], files: topic },
  ];
}
const getG = (context) => cached(context, 'g', () => {
  const dir = scratchDir(context, 'g');
  const root = path.join(dir, 'repo');
  fs.mkdirSync(root);
  gitOk(context, root, ['init', '-q']);
  gitOk(context, root, ['config', 'core.abbrev', '7']);
  gitOk(context, root, ['fast-import', '--quiet'], { input: fiStream(gCommits()) });
  gitOk(context, root, ['symbolic-ref', 'HEAD', 'refs/heads/topic']);
  gitOk(context, root, ['reset', '-q', '--hard']);
  const ids = {};
  for (const l of gitOk(context, root, ['for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads']).text.split('\n')) { const [r, o] = l.split(' '); ids[r] = o; }
  return { dir, root, ids };
});
async function useG(failures, context) {
  try { return await getG(context); } catch (e) { failures.push(`cannot build the real Git fixture G: ${errMsg(e)}`); return null; }
}
// A working copy of G for one assertion; the shared graph stays untouched.
function cloneG(context, g, label) {
  const dst = path.join(scratchDir(context, `g-${label}`), 'repo');
  cloneTree(g.root, dst);
  return dst;
}
const wr = (root, rel, data) => putFile(path.join(root, ...rel.split('/')), data);
const rm = (root, rel) => fs.rmSync(path.join(root, ...rel.split('/')), { force: true });
// The dirty trusted checkout of plan 4.3 R90: a staged addition, an unstaged modification and an untracked file, each with a marker.
function dirtyTrusted(context, root) {
  wr(root, 'staged-marker.txt', 'STAGED-DIRTY-MARKER\n');
  gitOk(context, root, ['add', '--', 'staged-marker.txt']);
  wr(root, 'keep.txt', 'k1\nUNSTAGED-DIRTY-MARKER\nk3\n');
  wr(root, 'untracked-marker.txt', 'UNTRACKED-DIRTY-MARKER\n');
}
// The local working state of plan 4.3 R65/C5/local (HEAD is topic; the comparison base is side, so M is base0).
const G_UNTRACKED = { 'new.txt': 'new\n', 'rmidx.txt': 'rmidx\n', '\u00fcn\u00ef.txt': 'u\n' };
function dirtyLocal(context, root) {
  const g = (...a) => gitOk(context, root, a);
  wr(root, 'staged-add.txt', 'staged\n'); wr(root, 'ghost.txt', 'g\n'); wr(root, 'restore.txt', 'r-changed\n');
  g('add', '--', 'staged-add.txt', 'ghost.txt', 'restore.txt');
  rm(root, 'ghost.txt'); // an index addition absent from M and missing from disk
  wr(root, 'restore.txt', 'r-base\n'); // a staged change restored to the base content in the working file
  wr(root, 'keep.txt', 'k1\nk2-LOCAL\nk3\n'); // an unstaged modification
  rm(root, 'del.txt'); // an unstaged tracked deletion
  g('rm', '-q', '--', 'del2.txt'); // a staged tracked deletion
  g('rm', '--cached', '-q', '--', 'rmidx.txt'); // removed from the index, still present and not ignored
  g('update-index', '--skip-worktree', 'skipw.txt'); rm(root, 'skipw.txt'); // a missing skip-worktree entry
  wr(root, '.env', 'LOCAL-ENV-SECRET-MARKER\n'); // protected tracked, modified
  for (const [n, d] of Object.entries(G_UNTRACKED)) if (n !== 'rmidx.txt') wr(root, n, d);
  wr(root, 'trace.log', 'IGNORED-MARKER\n'); // ignored by the committed .gitignore
  wr(root, '.env.local', 'LOCAL-ENVLOCAL-MARKER\n'); wr(root, 'private/new.txt', 'LOCAL-PRIVATE-MARKER\n'); // protected untracked
  wr(root, '.ai/.run/review/fresh.diff', 'FRESH-ARTIFACT-MARKER\n'); rm(root, '.ai/.run/.gitignore'); // an earlier artifact Git now reports as untracked
}
const G_MARKERS = ['M-ENV-SECRET-MARKER', 'H-ENV-SECRET-MARKER', 'LOCAL-ENV-SECRET-MARKER', 'LOCAL-ENVLOCAL-MARKER', 'M-PRIVATE-MARKER', 'H-PRIVATE-MARKER', 'LOCAL-PRIVATE-MARKER', 'IGNORED-MARKER', 'OLD-ARTIFACT-MARKER', 'FRESH-ARTIFACT-MARKER'];
const hasAny = (buf, markers) => markers.filter((m) => textOf(buf).includes(m));
// The first offset where two buffers differ, with a window around it (a diagnostic only).
function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return { at: i, got: a.subarray(Math.max(0, i - 40), i + 80).toString('latin1'), want: b.subarray(Math.max(0, i - 40), i + 80).toString('latin1'), gotLen: a.length, wantLen: b.length };
}

// ============================================== R65/C5/local ====
// Plan 3.3, 3.6-3.8, 4.3 R65/C5/local and C5-P2-1 to C5-P2-8: the local-worktree mode through the seams and through real Git.
async function localGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rv = await loadReview(failures, context);
    if (!rv) return;
    const cases = loadCases(check, context);
    await step('seam: the header, the Git tracked patch and the byte-sorted untracked patches; protected names are exclusions before diff-index; no protected, artifact or tracked name is read', async () => {
      const tree = ['keep.txt', 'mod.txt', 'del.txt', '.env', 'private/p.txt', 'src/a.txt'];
      const index = ['keep.txt', 'mod.txt', '.env', 'private/p.txt', 'src/a.txt', 'added.txt', '.ai/.run/review/old.diff', '.ai/.run/.gitignore'];
      const others = ['zeta.txt', 'alpha.txt', '.env.local', 'private/new.txt', '.ai/.run/review/fresh.diff', '\u00fcber.txt', 'Beta.txt'];
      const files = { 'zeta.txt': 'zeta\n', 'alpha.txt': 'alpha\n', '\u00fcber.txt': 'ue\n', 'Beta.txt': 'beta\n', '.env.local': 'SEAM-ENVLOCAL-MARKER\n', 'private/new.txt': 'SEAM-PRIVATE-MARKER\n', '.ai/.run/review/fresh.diff': 'SEAM-ARTIFACT-MARKER\n', 'keep.txt': 'TRACKED-DISK-MARKER\n' };
      const sw = seamWorld(context, { world: { tree, cached: idxBuf(index), others: nul(others), content: Buffer.from('TRACKED-PATCH\n') }, files });
      const s = await seamReview(rv, context, ARGV_L, { fake: sw.fake, seam: sw.seam });
      const want = cat(HDR_L, 'TRACKED-PATCH\n', refSection({ 'zeta.txt': 'zeta\n', 'alpha.txt': 'alpha\n', '\u00fcber.txt': 'ue\n', 'Beta.txt': 'beta\n' }));
      expectRes(check, 'local review', s.r, { exit: 0, stdout: want });
      checkOps(check, 'local review', sw.fake, OPS_L({ X: E_OF(['.env', 'private/p.txt', '.ai/.run/review/old.diff']) }));
      check(!hasAny(s.r.stdout, ['SEAM-ENVLOCAL-MARKER', 'SEAM-PRIVATE-MARKER', 'SEAM-ARTIFACT-MARKER', 'TRACKED-DISK-MARKER']).length, 'no protected, artifact or tracked working-file content appears in the result');
      const opened = sw.seam.ops('openSync').map((e) => relPosix(sw.root, e.args[0]));
      check(eq(opened, ['Beta.txt', 'alpha.txt', 'zeta.txt', '\u00fcber.txt']), 'only the four safe untracked files were opened, in UTF-8 byte path order', opened);
      check(touched(sw).every((n) => ['Beta.txt', 'alpha.txt', 'zeta.txt', '\u00fcber.txt'].includes(n)), 'no other name (tracked, protected, artifact) was examined on disk', touched(sw));
      check(sw.seam.ops('readFileSync').every((e) => typeof e.args[0] === 'number'), 'content is read through the checked descriptor, never through a path', sw.seam.ops('readFileSync').map((e) => e.args[0]));
      check(sw.seam.ops('openSync').every((e) => { const fl = e.args[1]; return (typeof fl === 'string' ? fl === 'r' : (fl & (FO.O_WRONLY | FO.O_RDWR | FO.O_CREAT | FO.O_EXCL | FO.O_TRUNC)) === 0 && (FO.O_NOFOLLOW === undefined || (fl & FO.O_NOFOLLOW) !== 0)); }), 'files are opened read-only, with O_NOFOLLOW where the platform has it', sw.seam.ops('openSync').map((e) => e.args[1]));
      check(sw.seam.ops('mkdirSync', 'writeSync', 'unlinkSync', 'fsyncSync').length === 0, 'a stdout review performs no write operation');
      check(sw.vfs.openFds().length === 0, 'every descriptor was closed', sw.vfs.openFds());
      check(eq(s.reads, [path.join(sw.fake.paths.root, '.ai', 'security-paths.json')]), 'the installed policy was read once from the native root path', s.reads);
    });
    await step('seam: exclusions come from the union of the M tree and the index: exact spellings, duplicates removed, one UTF-8 byte sort (C5-P2-1); artifact inputs join the list', async () => {
      const astral = '.env\u{10000}';
      const bmp = '.env\uff5e';
      const tree = ['.ENV', '.env', 'ok.txt', astral, 'PRIVATE/Tree.txt', '.ai/.run/review/t.diff'];
      const index = ['.env', bmp, 'ok.txt', 'private/Index.txt', '.AI/.RUN/REVIEW/idx.diff', 'src/.Env.local'];
      const sw = seamWorld(context, { world: { tree, cached: idxBuf(index), content: Buffer.from('P\n') } });
      const s = await seamReview(rv, context, ARGV_L, { fake: sw.fake, seam: sw.seam });
      const names = ['.ENV', '.env', astral, 'PRIVATE/Tree.txt', '.ai/.run/review/t.diff', bmp, 'private/Index.txt', '.AI/.RUN/REVIEW/idx.diff', 'src/.Env.local'];
      expectRes(check, 'union', s.r, { exit: 0, stdout: cat(HDR_L, 'P\n') });
      checkOps(check, 'union', sw.fake, OPS_L({ X: E_OF(names) }));
      const x = sw.fake.ops()[6].filter((a) => a.startsWith(':(exclude,literal)')).map((a) => a.slice(':(exclude,literal)'.length));
      check(x.indexOf(bmp) >= 0 && x.indexOf(astral) > x.indexOf(bmp), 'the BMP name sorts before the astral name (UTF-8 byte order, not UTF-16 code units)', x);
      check(new Set(x).size === x.length, 'the exclusion list holds no duplicate', x);
    });
    await step('seam: a selected unresolved index entry is REVIEW_UNMERGED before diff-index; protected, artifact and unselected unresolved entries are omitted; special modes are delegated to Git', async () => {
      const calls = (sw) => sw.fake.ops();
      for (const stage of [1, 2, 3]) {
        const sw = seamWorld(context, { world: { tree: ['a.txt'], cached: idxBuf([{ path: 'a.txt', stage }]), others: nul(['u.txt']) }, files: { 'u.txt': 'u\n' } });
        const s = await seamReview(rv, context, ARGV_L, { fake: sw.fake, seam: sw.seam });
        expectRes(check, `unresolved stage ${stage}`, s.r, failRes(E.UNMERGED));
        check(calls(sw).length === 6 && !sw.fake.kinds().includes('diffIndex'), `stage ${stage}: all three inventories were collected, no diff-index followed`, sw.fake.kinds());
        check(sw.seam.count() === 0, `stage ${stage}: no file was examined (the untracked file was not read after the failure)`, touched(sw));
      }
      const three = seamWorld(context, { world: { tree: ['a.txt'], cached: idxBuf([{ path: 'a.txt', stage: 1 }, { path: 'a.txt', stage: 2 }, { path: 'a.txt', stage: 3 }]) } });
      expectRes(check, 'a three-stage conflict', (await seamReview(rv, context, ARGV_L, { fake: three.fake, seam: three.seam })).r, failRes(E.UNMERGED));
      const prot = seamWorld(context, { world: { tree: ['.env', 'ok.txt'], cached: idxBuf([{ path: '.env', stage: 2 }, 'ok.txt']), content: Buffer.from('P\n') } });
      const p = await seamReview(rv, context, ARGV_L, { fake: prot.fake, seam: prot.seam });
      expectRes(check, 'a protected unresolved entry', p.r, { exit: 0, stdout: cat(HDR_L, 'P\n') });
      checkOps(check, 'a protected unresolved entry', prot.fake, OPS_L({ X: E_OF(['.env']) }));
      const art = seamWorld(context, { world: { tree: ['ok.txt'], cached: idxBuf(['ok.txt', { path: '.ai/.run/review/x.diff', stage: 3 }]), content: Buffer.from('P\n') } });
      expectRes(check, 'an artifact-input unresolved entry', (await seamReview(rv, context, ARGV_L, { fake: art.fake, seam: art.seam })).r, { exit: 0, stdout: cat(HDR_L, 'P\n') });
      const uns = seamWorld(context, { world: { tree: ['src/a.txt', 'other/b.txt'], cached: idxBuf(['src/a.txt', { path: 'other/b.txt', stage: 2 }]), content: Buffer.from('P\n') } });
      expectRes(check, 'an unselected unresolved entry', (await seamReview(rv, context, RD('--base', 'base-ref', '--', 'src'), { fake: uns.fake, seam: uns.seam })).r, { exit: 0, stdout: cat(HDR_L, 'P\n') });
      const modes = seamWorld(context, { world: { tree: [{ path: 'ln', mode: '120000' }, { path: 'sub', mode: '160000' }, { path: 'x.sh', mode: '100755' }], cached: idxBuf([{ path: 'ln', mode: '120000' }, { path: 'sub', mode: '160000', oid: 'b'.repeat(40) }, { path: 'x.sh', mode: '100755' }]), content: Buffer.from('GIT-OWNED\n') } });
      const m = await seamReview(rv, context, ARGV_L, { fake: modes.fake, seam: modes.seam });
      expectRes(check, 'symlink, gitlink and executable entries', m.r, { exit: 0, stdout: cat(HDR_L, 'GIT-OWNED\n') });
      check(modes.seam.count() === 0, 'tracked symlinks and gitlinks are never examined on disk and carry no REVIEW_TYPE check (Git handles them)', touched(modes));
    });
    await step('seam: no selected unprotected tracked entry omits the content call (C5-P2-2) and untracked processing still runs; an empty world is header-only without any filesystem call', async () => {
      const a = seamWorld(context, { world: { tree: ['.env'], cached: idxBuf(['.env']), others: nul(['u.txt']), content: Buffer.from('MUST-NOT-RUN\n') }, files: { 'u.txt': 'u\n' } });
      const sa = await seamReview(rv, context, ARGV_L, { fake: a.fake, seam: a.seam });
      expectRes(check, 'only protected tracked entries', sa.r, { exit: 0, stdout: cat(HDR_L, refSection({ 'u.txt': 'u\n' })) });
      checkOps(check, 'only protected tracked entries', a.fake, OPS_L({ diffIndex: false }));
      const b = seamWorld(context, { world: { tree: ['.ai/.run/review/old.diff'], cached: idxBuf(['.ai/.run/.gitignore']), content: Buffer.from('MUST-NOT-RUN\n') } });
      const sb = await seamReview(rv, context, ARGV_L, { fake: b.fake, seam: b.seam });
      expectRes(check, 'only artifact inputs', sb.r, { exit: 0, stdout: HDR_L });
      checkOps(check, 'only artifact inputs', b.fake, OPS_L({ diffIndex: false }));
      const c = seamWorld(context, { world: { content: Buffer.from('MUST-NOT-RUN\n') } });
      const sc = await seamReview(rv, context, ARGV_L, { fake: c.fake, seam: c.seam });
      expectRes(check, 'an empty change', sc.r, { exit: 0, stdout: HDR_L });
      check(c.seam.count() === 0 && eq(sc.fake.kinds(), ['version', 'root', 'resolve', 'resolve', 'mergeBase', 'tree', 'cached', 'others']), 'an empty change makes no filesystem call and no content call', { fs: c.seam.count(), kinds: sc.fake.kinds() });
      const d = seamWorld(context, { world: { tree: ['a/x.txt'], cached: idxBuf(['a/x.txt']), others: nul(['b/u.txt', 'a/v.txt']), content: Buffer.from('MUST-NOT-RUN\n') }, files: { 'b/u.txt': 'bu\n', 'a/v.txt': 'av\n' } });
      const sd = await seamReview(rv, context, RD('--base', 'base-ref', '--', 'b'), { fake: d.fake, seam: d.seam });
      expectRes(check, 'a selector that selects no tracked name', sd.r, { exit: 0, stdout: cat(HDR_L, refSection({ 'b/u.txt': 'bu\n' })) });
      checkOps(check, 'a selector that selects no tracked name', d.fake, OPS_L({ L: sel('b'), diffIndex: false }));
    });
    await step('seam: the untracked new-file renderer, row by row (N01-N25), each one alone and all together; the bytes are exactly the fixture and the independent oracle', async () => {
      if (!cases) return;
      for (const row of cases.renderer) {
        const want = rowExpected(row);
        check(sameBuf(want, refRender(row.path, rowData(row), { exec: row.exec })), `${row.id}: the fixture text equals the independent oracle`, { want: want.toString('latin1').slice(0, 200), oracle: refRender(row.path, rowData(row), { exec: row.exec }).toString('latin1').slice(0, 200) });
        const sw = seamWorld(context, { world: { others: nul([row.path]) }, files: {} });
        sw.vfs.file(row.path, rowData(row), { mode: row.exec ? 0o755 : 0o644 });
        const s = await seamReview(rv, context, ARGV_L, { fake: sw.fake, seam: sw.seam });
        expectRes(check, `${row.id} ${show(row.path)}`, s.r, { exit: 0, stdout: cat(HDR_L, want) });
      }
      const all = seamWorld(context, { world: { others: nul(cases.renderer.map((r) => r.path).reverse()) } });
      for (const row of cases.renderer) all.vfs.file(row.path, rowData(row), { mode: row.exec ? 0o755 : 0o644 });
      const s = await seamReview(rv, context, ARGV_L, { fake: all.fake, seam: all.seam });
      const wantAll = cat(HDR_L, ...byUtf8(cases.renderer.map((r) => r.path)).map((n) => rowExpected(cases.renderer.find((r) => r.path === n))));
      expectRes(check, 'all rows in one review (UTF-8 byte path order, no separator or extra blank line between patches)', s.r, { exit: 0, stdout: wantAll });
    });
    await step('seam: binary detection at the 8000-byte boundary, hunk header counts and every executable permission bit', async () => {
      const mk = (len, nulAt) => { const b = Buffer.alloc(len, 0x61); b[len - 1] = 0x0a; if (nulAt !== null) b[nulAt] = 0; return b; };
      const rows = [['nul7999.bin', mk(8200, 7999), true], ['nul8000.txt', mk(8200, 8000), false], ['len8000-last.bin', mk(8000, 7999), true], ['len8000-text.txt', mk(8000, null), false], ['short-last-nul.bin', Buffer.from([0x61, 0x62, 0x00]), true], ['nul0.bin', mk(8200, 0), true], ['len8001-nul8000.txt', mk(8001, 8000), false]];
      for (const [name, data, binary] of rows) {
        const sw = seamWorld(context, { world: { others: nul([name]) } });
        sw.vfs.file(name, data);
        const s = await seamReview(rv, context, ARGV_L, { fake: sw.fake, seam: sw.seam });
        expectRes(check, `${name}`, s.r, { exit: 0, stdout: cat(HDR_L, refRender(name, data)) });
        check(textOf(s.r.stdout).includes('Binary files /dev/null and b/') === binary && textOf(s.r.stdout).includes('@@ -0,0 +1') === !binary, `${name}: ${binary ? 'binary line' : 'text hunk'} (a NUL within the first 8000 bytes is binary)`, textOf(s.r.stdout).slice(0, 160));
      }
      for (const n of [1, 2, 3, 1234]) {
        const data = Buffer.from(Array.from({ length: n }, (_, i) => `row ${i}\n`).join(''));
        const sw = seamWorld(context, { world: { others: nul(['h.txt']) } });
        sw.vfs.file('h.txt', data);
        const s = await seamReview(rv, context, ARGV_L, { fake: sw.fake, seam: sw.seam });
        check(textOf(s.r.stdout).includes(n === 1 ? '@@ -0,0 +1 @@\n' : `@@ -0,0 +1,${n} @@\n`), `${n} line(s): the hunk header is exactly ${n === 1 ? '@@ -0,0 +1 @@' : `@@ -0,0 +1,${n} @@`}`, textOf(s.r.stdout).slice(0, 200));
      }
      for (const mode of [0o644, 0o755, 0o700, 0o744, 0o601, 0o010, 0o600]) {
        const sw = seamWorld(context, { world: { others: nul(['m.sh']) } });
        sw.vfs.file('m.sh', 'x\n', { mode });
        const s = await seamReview(rv, context, ARGV_L, { fake: sw.fake, seam: sw.seam });
        expectRes(check, `permission bits 0${mode.toString(8)}`, s.r, { exit: 0, stdout: cat(HDR_L, refRender('m.sh', Buffer.from('x\n'), { exec: (mode & 0o111) !== 0 })) });
      }
    });
    await step('seam: the first failure is returned and nothing follows it (C5-P2-3): candidates run one at a time in UTF-8 order, each finishing before the next starts', async () => {
      const sw = seamWorld(context, { world: { others: nul(['b.txt', 'a.txt', 'c.txt']) }, files: { 'a.txt': 'a\n', 'b.txt': 'b\n', 'c.txt': 'c\n' } });
      const s = await seamReview(rv, context, ARGV_L, { fake: sw.fake, seam: sw.seam });
      expectRes(check, 'three candidates', s.r, { exit: 0, stdout: cat(HDR_L, refSection({ 'a.txt': 'a\n', 'b.txt': 'b\n', 'c.txt': 'c\n' })) });
      const seq = sw.seam.log.filter((e) => typeof e.args[0] === 'string' || ['readFileSync', 'fstatSync', 'closeSync', 'readSync'].includes(e.op));
      const firstOf = (name) => sw.seam.log.findIndex((e) => e.op === 'openSync' && relPosix(sw.root, e.args[0]) === name);
      const closeAfter = (name) => { const i = firstOf(name); return sw.seam.log.findIndex((e, j) => j > i && e.op === 'closeSync'); };
      check(firstOf('a.txt') < closeAfter('a.txt') && closeAfter('a.txt') < firstOf('b.txt') && firstOf('b.txt') < closeAfter('b.txt') && closeAfter('b.txt') < firstOf('c.txt'), 'each candidate is opened, read and closed before the next one is opened', seq.map((e) => `${e.op}:${e.args[0] && String(e.args[0]).slice(-8)}`));
      const faulty = seamWorld(context, { world: { others: nul(['b.txt', 'a.txt', 'c.txt']) }, files: { 'a.txt': 'a\n', 'b.txt': 'b\n', 'c.txt': 'c\n' }, faults: [{ op: 'lstatSync', when: (args) => path.basename(String(args[0])) === 'b.txt', error: 'EACCES' }] });
      const f = await seamReview(rv, context, ARGV_L, { fake: faulty.fake, seam: faulty.seam });
      expectRes(check, 'a failure on the second candidate', f.r, failRes(E.IO));
      check(!touched(faulty).includes('c.txt'), 'no filesystem call follows the failure: the third candidate was never examined', touched(faulty));
      check(faulty.fake.calls.length === 8, 'no Git call follows the failure either', faulty.fake.kinds());
    });
    await step('seam: selection is the literal predicate on every inventory, including synthetic ones that ignore the pathspecs: a name matches a selector exactly or below it on a component boundary, case-sensitively, with no glob', async () => {
      // tracked inventories: the protected names that reach the exclusion list are exactly the selected ones
      const prot = ['.env', 'a/.env', 'a/b/.env', 'ab/.env', 'abc/.env', 'A/.env', 'a*/.env', 'ax/.env'];
      const tracked = seamWorld(context, { world: { tree: [...prot, 'a/ok.txt'], cached: idxBuf([...prot, 'a/ok.txt']), content: Buffer.from('P\n') } });
      const t1 = await seamReview(rv, context, RD('--base', 'base-ref', '--', 'a'), { fake: tracked.fake, seam: tracked.seam });
      checkOps(check, 'selector a', tracked.fake, OPS_L({ L: sel('a'), X: E_OF(['a/.env', 'a/b/.env']) }));
      expectRes(check, 'selector a', t1.r, { exit: 0, stdout: cat(HDR_L, 'P\n') });
      const star = seamWorld(context, { world: { tree: [...prot, 'a*/ok.txt'], cached: idxBuf([...prot, 'a*/ok.txt']), content: Buffer.from('P\n') } });
      await seamReview(rv, context, RD('--base', 'base-ref', '--', 'a*'), { fake: star.fake, seam: star.seam });
      checkOps(check, 'selector a* (a literal name, not a glob)', star.fake, OPS_L({ L: sel('a*'), X: E_OF(['a*/.env']) }));
      // untracked inventories: only selected candidates are examined
      const names = ['u/x.txt', 'ux/y.txt', 'U/z.txt', 'u*', 'uabc', 'v/w.txt'];
      const un = seamWorld(context, { world: { others: nul(names) }, files: Object.fromEntries(names.map((n) => [n, `${n}\n`])) });
      const u1 = await seamReview(rv, context, RD('--base', 'base-ref', '--', 'u'), { fake: un.fake, seam: un.seam });
      expectRes(check, 'untracked selector u', u1.r, { exit: 0, stdout: cat(HDR_L, refSection({ 'u/x.txt': 'u/x.txt\n' })) });
      const un2 = seamWorld(context, { world: { others: nul(names) }, files: Object.fromEntries(names.map((n) => [n, `${n}\n`])) });
      const u2 = await seamReview(rv, context, RD('--base', 'base-ref', '--', 'u*'), { fake: un2.fake, seam: un2.seam });
      expectRes(check, 'untracked selector u* (literal)', u2.r, { exit: 0, stdout: cat(HDR_L, refSection({ 'u*': 'u*\n' })) });
      check(!touched(un2).includes('uabc') && !touched(un2).includes('u/x.txt'), 'a glob-looking selector never reaches other names', touched(un2));
      const none = seamWorld(context, { world: { others: nul(names) }, files: Object.fromEntries(names.map((n) => [n, `${n}\n`])) });
      const u3 = await seamReview(rv, context, RD('--base', 'base-ref', '--', 'no-such'), { fake: none.fake, seam: none.seam });
      expectRes(check, 'a selector that matches nothing', u3.r, { exit: 0, stdout: HDR_L });
      check(none.seam.count() === 0, 'nothing is examined when nothing is selected', touched(none));
    });
    // ---------------------------------------------------------- real Git ----
    const g = await useG(failures, context);
    if (g) {
      await step('real Git: staged, unstaged, deleted, removed-from-index, restored, ghost and skip-worktree states; protected, ignored and artifact paths stay out; the bytes are the header, Git\'s patch, then the byte-sorted untracked patches', async () => {
        const root = cloneG(context, g, 'local');
        dirtyLocal(context, root);
        const M = g.ids.base0;
        const rawTracked = rawGit(context, root, ['diff-index', ...D_FLAGS, '-p', M, '--', ...G_SAFE_NAMES.map(LIT)]);
        const rt = textOf(rawTracked);
        // fixture sanity: the states produce what the plan says Git does with them
        check(rt.includes('diff --git a/h-only.txt b/h-only.txt\nnew file mode') && rt.includes('diff --git a/staged-add.txt b/staged-add.txt\nnew file mode') && rt.includes('+k2-LOCAL') && rt.includes('+M2-TOPIC'), 'fixture sanity: additions and modifications appear in Git\'s own patch', rt.slice(0, 300));
        check(['del.txt', 'del2.txt', 'rmidx.txt'].every((n) => rt.includes(`diff --git a/${n} b/${n}\ndeleted file mode`)), 'fixture sanity: the unstaged deletion, the staged deletion and the removed-from-index file are tracked deletions', rt.slice(0, 300));
        check(!rt.includes('restore.txt') && !rt.includes('ghost.txt') && !rt.includes('skipw.txt'), 'fixture sanity: a restored change, an index addition missing from disk and a missing skip-worktree entry produce no patch', rt.slice(0, 300));
        const seam = realSeam();
        const run = await realReview(rv, context, root, ARGV_L.map((a) => (a === 'base-ref' ? 'side' : a)), { seam });
        const want = cat(hdr(MODE_L, g.ids.side, g.ids.topic, M), rawTracked, refSection(G_UNTRACKED));
        expectRes(check, 'local review of the dirty clone', run.r, { exit: 0, stdout: want });
        if (!sameBuf(run.r.stdout, want)) check(false, 'first difference from the expected bytes', firstDiff(run.r.stdout, want));
        check(!hasAny(run.r.stdout, G_MARKERS).length, 'no protected, ignored or artifact marker appears in the result', hasAny(run.r.stdout, G_MARKERS));
        check(textOf(run.r.stdout).split('diff --git a/rmidx.txt b/rmidx.txt\n').length === 3, 'the removed-from-index file appears twice: a tracked deletion, then an untracked new-file patch (never merged)');
        const di = run.ops.find((o) => o[0] === 'diff-index');
        const wantX = E_OF(['.env', 'private/p.txt', 'private/q.txt', '.ai/.run/review/old.diff']);
        check(di && eq(di, V_DI(M, [], wantX)), 'diff-index carries the exclusions built from the M tree and the index (protected names and artifact inputs), sorted once', di && di.slice(-8));
        check(eq(run.kinds, ['resolve', 'resolve', 'mergeBase', 'tree', 'cached', 'others', 'diffIndex']), 'the Git operations are the two resolutions, the merge-base, three inventories and diff-index (nine processes with the session calls)', run.kinds);
        const opened = seam.ops('openSync').map((e) => relPosix(root, e.args[0]));
        check(eq(opened, ['new.txt', 'rmidx.txt', '\u00fcn\u00ef.txt']), 'only the safe untracked files were opened', opened);
        check(!opened.some((n) => /env|private|fresh|trace/.test(n)), 'no protected, ignored or artifact file was opened', opened);
      });
      await step('real Git: the removed-from-index file is a tracked deletion plus a separate new-file patch even when selected alone', async () => {
        const root = cloneG(context, g, 'rmidx');
        gitOk(context, root, ['rm', '--cached', '-q', '--', 'rmidx.txt']);
        const run = await realReview(rv, context, root, RD('--base', 'side', '--', 'rmidx.txt'), { seam: realSeam() });
        const M = g.ids.base0;
        const want = cat(hdr(MODE_L, g.ids.side, g.ids.topic, M), rawGit(context, root, ['diff-index', ...D_FLAGS, '-p', M, '--', LIT('rmidx.txt')]), refRender('rmidx.txt', Buffer.from('rmidx\n')));
        expectRes(check, 'selected removed-from-index file', run.r, { exit: 0, stdout: want });
      });
    }
    // ----------------------------------------------- conformance and autocrlf ----
    await step('real Git: autocrlf (C5-P2-8) leaves a CRLF copy of an LF blob without a hunk, gives exactly Git\'s contextual hunk for a one-line change with no CR in it, and keeps untracked CR bytes raw; then the renderer matches Git byte for byte (C5-P2-5)', async () => {
      const dir = scratchDir(context, 'rconf');
      const root = path.join(dir, 'repo');
      fs.mkdirSync(root);
      const g2 = (...a) => gitOk(context, root, a);
      g2('init', '-q');
      g2('config', 'core.autocrlf', 'true');
      wr(root, 'lf.txt', 'one\ntwo\nthree\n');
      g2('add', '--', 'lf.txt');
      g2('commit', '-qm', 'lf');
      const head = g2('rev-parse', 'HEAD').text;
      check(!gitRun(context, root, ['cat-file', '-p', 'HEAD:lf.txt']).out.includes(13), 'fixture sanity: the committed blob is LF');
      const argv = RD('--base', 'HEAD');
      wr(root, 'lf.txt', 'one\r\ntwo\r\nthree\r\n');
      const r1 = await realReview(rv, context, root, argv, { seam: realSeam() });
      expectRes(check, 'a CRLF working copy of an identical LF blob', r1.r, { exit: 0, stdout: hdr(MODE_L, head, head, head) });
      wr(root, 'lf.txt', 'one\r\nTWO\r\nthree\r\n');
      wr(root, 'crlf-raw.txt', 'a\r\nb\r\n');
      const r2 = await realReview(rv, context, root, argv, { seam: realSeam() });
      const tracked = `diff --git a/lf.txt b/lf.txt\nindex ${blob7('one\ntwo\nthree\n')}..${blob7('one\nTWO\nthree\n')} 100644\n--- a/lf.txt\n+++ b/lf.txt\n@@ -1,3 +1,3 @@\n one\n-two\n+TWO\n three\n`;
      expectRes(check, 'a one-line change in a CRLF working copy', r2.r, { exit: 0, stdout: cat(hdr(MODE_L, head, head, head), tracked, refRender('crlf-raw.txt', Buffer.from('a\r\nb\r\n'))) });
      const trackedPart = textOf(r2.r.stdout).split('diff --git a/crlf-raw.txt')[0];
      check(!trackedPart.includes('\r'), 'the tracked hunk contains no CR byte', trackedPart.slice(0, 300));
      check(r2.r.stdout.includes(Buffer.from('+a\r\n+b\r\n')), 'an untracked CRLF file keeps its CR bytes (raw rendering, unlike normalized tracked content)');
      // --- renderer conformance: the same untracked files, marked intent-to-add, against Git's own patch (index lines removed)
      g2('config', 'core.autocrlf', 'false');
      g2('checkout', '-q', '--', 'lf.txt');
      const files = {
        'space name.txt': 'a\n', 'r\u00e9sum\u00e9 v2.txt': 'b\n', 'one.txt': 'only\n', 'multi.txt': 'l1\nl2\nl3\n', 'unterm.txt': 'x\ny', 'bin.dat': Buffer.from([1, 0, 2, 10]), 'crlf-raw.txt': 'a\r\nb\r\n',
        'empty.txt': '', 'bom.txt': Buffer.from([0xef, 0xbb, 0xbf, 0x68, 0x0a]), '\u00fcn\u00ef.txt': 'u\n', 'blank.txt': '\n',
      };
      if (!WIN) Object.assign(files, { 'tab\there.txt': 'x\n', 'q"uote.txt': 'x\n' });
      for (const [n, d] of Object.entries(files)) if (n !== 'crlf-raw.txt') wr(root, n, d);
      const seam = realSeam();
      const run = await realReview(rv, context, root, argv, { seam });
      const section = run.r.stdout.subarray(hdr(MODE_L, head, head, head).length);
      g2('add', '-N', '--', ...byUtf8(Object.keys(files)));
      const names = byUtf8(Object.keys(files));
      const rawAll = gitOk(context, root, ['-c', 'core.quotePath=true', 'diff', '--no-ext-diff', '--no-textconv', '--src-prefix=a/', '--dst-prefix=b/', '--', ...names]).out;
      const stripped = Buffer.from(rawAll.toString('latin1').split('\n').filter((l) => !l.startsWith('index ')).join('\n'), 'latin1');
      check(run.r.exitCode === 0 && run.r.stderr === '' && run.r.stdout.subarray(0, hdr(MODE_L, head, head, head).length).equals(Buffer.from(hdr(MODE_L, head, head, head))), 'the conformance review succeeded with the pinned header', { code: run.r.exitCode, err: run.r.stderr.slice(0, 200) });
      check(sameBuf(section, stripped), 'the untracked section equals Git\'s own new-file patch with the index lines removed, byte for byte, for every name', firstDiff(section, stripped));
      check(sameBuf(section, refSection(files)), 'and equals the independent oracle', firstDiff(section, refSection(files)));
      if (!sameBuf(section, stripped)) {
        // diagnostics: which names differ (each name against Git, one process each)
        for (const n of names) {
          const one = gitOk(context, root, ['-c', 'core.quotePath=true', 'diff', '--no-ext-diff', '--no-textconv', '--src-prefix=a/', '--dst-prefix=b/', '--', n]).out.toString('latin1').split('\n').filter((l) => !l.startsWith('index ')).join('\n');
          check(refRender(n, bytes(files[n])).toString('latin1') === one, `conformance of ${show(n)}`, { git: one.slice(0, 200), ours: refRender(n, bytes(files[n])).toString('latin1').slice(0, 200) });
        }
      }
    });
  });
}

// ============================================== R65/C5/index ====
// Plan 3.4, 3.6, 4.3 R65/C5/index and C5-P2-7: no mutating Git operation, no index refresh, no caller index; real Git keeps the index and every .git byte.
const MUTATING = ['add', 'update-index', 'read-tree', 'checkout', 'hash-object', 'status', 'stash', 'reset', 'commit', 'gc', 'fsck', 'write-tree', 'symbolic-ref', 'config', 'merge', 'rebase', 'clean', 'rm', 'mv'];
const RO_COMMITTED = new Set(['--version', 'rev-parse', 'merge-base', 'diff']);
const RO_LOCAL = new Set(['--version', 'rev-parse', 'merge-base', 'ls-tree', 'ls-files', 'diff-index']);
const OLD_TIME = () => new Date(Date.now() - 3600 * 1000);
async function indexGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rv = await loadReview(failures, context);
    if (!rv) return;
    await step('seam: both modes issue only read-only plumbing; local mode never runs a porcelain worktree diff; no caller index reaches Git and optional locks stay off', async () => {
      for (const [label, argv, allowed] of [['committed', ARGV_C, RO_COMMITTED], ['local', ARGV_L, RO_LOCAL]]) {
        const sw = seamWorld(context, { world: { invDiff: nul(['a.txt']), tree: ['a.txt'], cached: idxBuf(['a.txt']), content: Buffer.from('P\n') } });
        const s = await seamReview(rv, context, argv, { fake: sw.fake, seam: sw.seam });
        check(s.r.exitCode === 0, `${label}: the review succeeds`, s.r.stderr);
        const verbs = sw.fake.calls.map((c) => c.op[0]);
        check(verbs.length >= 5 && verbs.every((v) => allowed.has(v)), `${label}: every Git operation is one of the read-only verbs ${[...allowed].join(', ')}`, verbs);
        check(!verbs.some((v) => MUTATING.includes(v)), `${label}: no mutating verb appears`, verbs);
        if (label === 'local') check(!verbs.includes('diff'), 'local: no porcelain worktree diff is ever used (diff-index plumbing only)', verbs);
        check(sw.fake.calls.every((c) => !Object.keys(c.env).some((k) => k.toUpperCase() === 'GIT_INDEX_FILE') && c.env.GIT_OPTIONAL_LOCKS === '0'), `${label}: the caller's GIT_INDEX_FILE is removed from every call and GIT_OPTIONAL_LOCKS is 0`);
        check(!sw.fake.calls.some((c) => c.op.some((a) => a === '--index' || a === '--cached' && c.op[0] !== 'ls-files')), `${label}: no index-refreshing or index-comparing option is used outside the pinned ls-files call`);
        checkCalls(check, label, sw.fake);
      }
    });
    const g = await useG(failures, context);
    if (g) {
      await step('real Git: the raw index and every .git file are identical before and after review, on success and on an injected failure; a stat-dirty, content-identical file gives header-only output', async () => {
        const root = cloneG(context, g, 'index');
        const gitDir = path.join(root, '.git');
        const snap = () => ({ index: readBytes(path.join(gitDir, 'index')), all: snapshotTree(gitDir) });
        const same = (a, b) => sameBytes(a.index, b.index) && a.all === b.all;
        const observe = () => ({ status: gitOk(context, root, ['--no-optional-locks', 'status', '--short']).text, stash: gitOk(context, root, ['--no-optional-locks', 'stash', 'list']).text });
        const caller = path.join(scratchDir(context, 'callerindex'), 'caller.index');
        // 1. only a stat-dirty file (its mtime is an hour away from the index entry's; the bytes are unchanged)
        fs.utimesSync(path.join(root, 'keep.txt'), OLD_TIME(), OLD_TIME());
        const o0 = observe();
        const b1 = snap();
        const r1 = await realReview(rv, context, root, RD('--base', 'topic'), { seam: realSeam(), env: { ...context.env, GIT_INDEX_FILE: caller } });
        const a1 = snap(); // taken before any verification status command
        const o1 = observe();
        expectRes(check, 'a stat-dirty content-identical file', r1.r, { exit: 0, stdout: hdr(MODE_L, g.ids.topic, g.ids.topic, g.ids.topic) });
        check(same(b1, a1), 'the raw index and every .git file path and byte are unchanged (stat-dirty file, success)', { before: b1.index && b1.index.length, after: a1.index && a1.index.length });
        check(o0.status === o1.status && o0.stash === o1.stash, 'the status and stash observations (git --no-optional-locks) are the same before and after', { o0, o1 });
        check(!exists(caller), 'the caller-supplied index file was neither used nor created');
        check(r1.log.every((l) => !Object.keys(l.env).some((k) => k.toUpperCase() === 'GIT_INDEX_FILE') && l.env.GIT_OPTIONAL_LOCKS === '0'), 'no real Git call received a caller index or enabled optional locks');
        // 2. a dirty working state, success
        dirtyLocal(context, root);
        const o2 = observe();
        const b2 = snap();
        const r2 = await realReview(rv, context, root, RD('--base', 'side'), { seam: realSeam() });
        const a2 = snap();
        const o3 = observe();
        check(r2.r.exitCode === 0 && r2.r.stdout.length > hdr(MODE_L, g.ids.side, g.ids.topic, g.ids.base0).length && r2.r.stderr === '', 'the dirty review succeeds with content', { code: r2.r.exitCode, err: r2.r.stderr.slice(0, 200) });
        check(same(b2, a2), 'the raw index and every .git file are unchanged by a successful review of a dirty working state');
        check(o2.status === o3.status && o2.stash === o3.stash, 'the status and stash observations are unchanged by that review', { o2, o3 });
        check(r2.ops.every((o) => RO_LOCAL.has(o[0])) && !r2.ops.some((o) => MUTATING.includes(o[0])), 'the real trace holds only read-only plumbing', r2.ops.map((o) => o[0]));
        // 3. an injected failure at the content step and at an inventory step
        for (const kind of ['diffIndex', 'tree']) {
          const b = snap();
          const f = await realReview(rv, context, root, RD('--base', 'side'), { seam: realSeam(), intercept: (k) => (k === kind ? { status: 128, signal: null, error: null, stdout: EMPTY, overflow: false } : undefined) });
          expectRes(check, `an injected ${kind} failure`, f.r, failRes(E.GIT));
          check(same(b, snap()), `the raw index and every .git file are unchanged after an injected ${kind} failure`);
        }
      });
    }
    await step('real Git: a configured clean-filter sentinel runs for selected safe tracked content and never for protected tracked paths or untracked files (C5-P2-7); the index stays unchanged', async () => {
      const dir = scratchDir(context, 'filter');
      const root = path.join(dir, 'repo');
      fs.mkdirSync(root);
      const log = path.join(dir, 'sentinel.log');
      const script = path.join(dir, 'clean.mjs');
      putFile(script, "import fs from 'node:fs';\nconst chunks = [];\nfor await (const c of process.stdin) chunks.push(c);\nfs.appendFileSync(process.argv[2], `${process.argv[3]}\\n`);\nprocess.stdout.write(Buffer.concat(chunks));\n");
      const g2 = (...a) => gitOk(context, root, a);
      g2('init', '-q');
      g2('config', 'filter.sentinel.clean', `"${fwd(process.execPath)}" "${fwd(script)}" "${fwd(log)}" %f`);
      for (const [n, d] of Object.entries({ '.gitattributes': '* filter=sentinel\n', 'safe.txt': 's\n', 'other.txt': 'o\n', '.env': 'E\n', 'private/p.txt': 'P\n' })) wr(root, n, d);
      g2('add', '-A');
      g2('commit', '-qm', 'filter fixture');
      fs.writeFileSync(log, ''); // C5-P2-7: truncated after every add and commit, immediately before the review call
      for (const n of ['safe.txt', '.env', 'private/p.txt']) fs.utimesSync(path.join(root, n), OLD_TIME(), OLD_TIME());
      wr(root, 'untracked.txt', 'u\n');
      wr(root, '.env.local', 'ENVLOCAL-FILTER-MARKER\n');
      const head = g2('rev-parse', 'HEAD').text;
      const idx0 = readBytes(path.join(root, '.git', 'index'));
      const run = await realReview(rv, context, root, RD('--base', 'HEAD'), { seam: realSeam() });
      expectRes(check, 'review with a clean filter configured', run.r, { exit: 0, stdout: cat(hdr(MODE_L, head, head, head), refSection({ 'untracked.txt': 'u\n' })) });
      const logged = (readText(log) || '').split('\n').filter(Boolean);
      check(logged.includes('safe.txt'), 'the sentinel ran at least once for the selected safe stat-dirty tracked file (tracked conversion is permitted)', logged);
      check(!logged.some((n) => n === '.env' || n.startsWith('private/') || n === 'untracked.txt' || n === '.env.local'), 'the sentinel never ran for a protected tracked path or an untracked file', logged);
      check(sameBytes(idx0, readBytes(path.join(root, '.git', 'index'))), 'the index bytes are unchanged (no claim is made about filter-owned writes elsewhere)');
      fs.writeFileSync(log, '');
      gitOk(context, root, [...PREFIX, 'diff-index', ...D_FLAGS, '-p', 'HEAD']);
      check((readText(log) || '').split('\n').includes('.env'), 'control: an unrestricted diff-index does run the filter for the protected path, so the exclusion is what protects it', readText(log));
    });
  });
}

// ============================================== R66/C5/limits-documentation ====
// Plan 3.14 and 4.3 R66/C5/limits-documentation: the required text of references/security.md and tests/live/LIVE-ACCEPTANCE.md, and the limitation it states.
const SUPPORTED_FORMS = {
  diff: 'diff <A>..<B>|<A>...<B> [--stat|--name-status|--name-only] [-- <paths>]',
  log: 'log [-p] [--oneline] [-n<k>|--max-count=<k>] <rev>|<A>..<B>|<A>...<B> [-- <paths>]',
  show: 'show <commit> [--stat|--name-status] [-- <paths>]',
  cat: 'cat <commit> -- <path>',
  ls: 'ls <commit> [-- <paths>]',
  grep: 'grep <commit> <pattern> [-- <paths>]',
};
const DOC_TEXT = [
  'The sanctioned review interface is:',
  'node .ai/tools/git-safe.mjs review-diff --base <ref> [--head <ref>] [--out <file>] [-- <paths>...]',
  'With --head, review-diff compares the resolved merge-base to the resolved head commit. The trusted checkout\'s staged, unstaged and untracked changes are excluded. Without --head, it compares the merge-base of base and current HEAD with the local working state, including staged, unstaged and non-ignored untracked changes.',
  'Tracked local changes use Git\'s diff-index plumbing, preserving Git\'s normalization and skip-worktree behavior without refreshing the index. Configured clean/process filters may run for selected safe tracked files. Such filters are trusted configuration and may have their own side effects, including Git LFS object-cache writes.',
  // PLAN-GAP: the sentence "An untracked file larger than 1,048,576 bytes is refused before its body is read." of plan 3.14 is replaced in substance by C5-P2-9 (large binaries are rendered; a large text file is refused after at most 8000 bytes are read) but the addendum gives no replacement wording; the sentence is therefore asserted only as far as it still holds (see DOC_LARGE).
  'Untracked files are checked before reading and rendered in-process as new files.',
  'Their bytes are raw: CRLF is preserved, unlike tracked content normalized by Git.',
  'A selected embedded repository is refused as a nonregular input.',
  'A path removed from the index but still present as untracked content appears twice: a tracked deletion followed by an untracked new-file patch.',
  'The result header records the mode, resolved base, resolved head and merge-base IDs. Selectors are literal repository-relative paths. A protected selector is refused; protected descendants of a selected directory are omitted.',
  'Stdout is the default. Reviewers use stdout or an artifact supplied by the orchestrator. They do not use --out. The orchestrator may create a new artifact directly under .ai/.run/review/ and pass its path to the reviewer. Output paths are repository-root-relative, even when invoked from a subdirectory. Artifact creation is exclusive. The default name is a Windows-safe UTC timestamp, for example 20261019T123456789Z.diff.',
  'The setup run ID review and its case or trailing-dot/space aliases are reserved. Older setup runs with those names require manual resolution. A reserved setup-lock owner can be removed with lock.mjs break --confirm-unknown-owner after the existing human recovery decision. That operation removes the lock, not the review directory.',
  'Review output, including its header, is limited to 1,048,576 bytes. An oversized result is refused whole. Narrow with -- <paths>, then record both the reviewed subset and the scope still unreviewed. A narrowed result does not establish that the full change was reviewed.',
  'Path rules cannot detect secret content copied to an unrelated allowed path. They are not a content scanner and cannot guarantee that a review diff is secret-free.',
];
const LIVE_TEXT = [
  'Run the reviewer from a trusted checkout. The maintainer supplies base and head refs. Do not check out the reviewed branch.',
  'Use git --no-optional-locks status for status observations. Do not use ordinary git status, which can refresh the index. Record status and stash observations, then capture the raw index hash and .git file inventory immediately before review. Capture the post-review index and .git snapshot before any verification status command.',
  'From a separate orchestrator step, run git-safe review-diff with --base, --head and an unused --out path under .ai/.run/review/. Pass that path to the reviewer. Require the reviewer to record the mode and resolved IDs from the artifact header. The reviewer makes no artifact write.',
  'Repeat with stdout-only review-diff. Require identical review bytes and no review-helper filesystem write. A dirty trusted checkout must not contribute staged, unstaged or untracked content to the committed-head result.',
  'Separately exercise local-worktree mode on a branch the maintainer authored. Require staged, unstaged and ordinary non-ignored untracked changes, protected paths absent, and index bytes unchanged. Use a fixture with no configured content filters for the full .git byte comparison. Record any configured filter and its side effects separately; filter writes are not evidence that diff-index refreshed the index.',
  'Record versions, commands, exit codes, artifact hash and observed changes. Fixture preparation and component tests are preflight, not live host proof. C8 supplies canonical reviewer instructions and the self-review warning; C10 supplies host-control reporting.',
];
async function docsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    await step('references/security.md names all four runtime files, keeps the six forms, adds the review form and carries the required review text (line wrapping is free)', async () => {
      const doc = readText(path.join(context.skillRoot, 'references', 'security.md'));
      if (doc === null) { check(false, 'references/security.md is readable'); return; }
      const flat = squash(doc);
      for (const [i, p] of DOC_TEXT.entries()) check(flat.includes(squash(p)), `required review text ${i + 1} is present`, p.slice(0, 90));
      for (const cmd of COMMANDS) check(flat.includes(squash(SUPPORTED_FORMS[cmd])), `the original supported form of ${cmd} is kept`, SUPPORTED_FORMS[cmd]);
      check(doc.includes(REVIEW_FORM), 'the supported forms list the review form', REVIEW_FORM);
      for (const f of ['git-safe.mjs', 'git-safe-core.mjs', 'review-diff.mjs', 'security-policy.mjs']) check(doc.includes(f), `the runtime-unit description names ${f}`);
      check(!/unit of\s+three\s+files/i.test(doc), 'the runtime-unit description no longer says three files');
      check(/larger than 1,048,576 bytes/.test(flat), 'PLAN-GAP: the oversized untracked file sentence is still present in some form (its exact wording after C5-P2-9 is not pinned)');
      check(flat.includes('not a content scanner') && flat.includes('secret content copied to an unrelated allowed path'), 'the copied-content limitation is stated, not a claim of content scanning');
    });
    await step('tests/live/LIVE-ACCEPTANCE.md carries the C5 review-diff procedure with host evidence pending, and does not mark it passed', async () => {
      const doc = readText(path.join(context.skillRoot, 'tests', 'live', 'LIVE-ACCEPTANCE.md'));
      if (doc === null) { check(false, 'tests/live/LIVE-ACCEPTANCE.md is readable'); return; }
      const flat = squash(doc);
      check(/C5 review-diff procedure \(host evidence pending\)/.test(doc), 'the subsection named "C5 review-diff procedure (host evidence pending)" exists');
      for (const [i, p] of LIVE_TEXT.entries()) check(flat.includes(squash(p)), `required live procedure text ${i + 1} is present`, p.slice(0, 90));
    });
    const rv = await loadReview(failures, context);
    if (!rv) return;
    await step('behavior: a synthetic marker copied to an unrelated allowed filename is not detected (the limitation is real), and untracked CRLF is rendered raw', async () => {
      const sw = seamWorld(context, { world: { others: nul(['notes/copied.txt', 'crlf.txt']) }, files: { 'notes/copied.txt': 'COPIED-SYNTHETIC-CANARY-MARKER\n', 'crlf.txt': 'a\r\nb\r\n' } });
      const s = await seamReview(rv, context, ARGV_L, { fake: sw.fake, seam: sw.seam });
      expectRes(check, 'copied content under an allowed name', s.r, { exit: 0, stdout: cat(HDR_L, refSection({ 'notes/copied.txt': 'COPIED-SYNTHETIC-CANARY-MARKER\n', 'crlf.txt': 'a\r\nb\r\n' })) });
      check(textOf(s.r.stdout).includes('COPIED-SYNTHETIC-CANARY-MARKER') && s.r.stdout.includes(Buffer.from('+a\r\n+b\r\n')), 'the marker appears in the output (path rules only) and the CR bytes are kept');
    });
  });
}

// ============================================== R90/C5/committed ====
// Plan 3.5, C5-P2-1, C5-P2-2 and 4.3 R90/C5/committed: the M-to-H object patch only; the trusted checkout never contributes.
async function committedGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rv = await loadReview(failures, context);
    if (!rv) return;
    await step('seam: committed review issues the pinned resolution, merge-base, inventory and content vectors with resolved IDs only, never queries the working state, and touches no working file', async () => {
      const world = { invDiff: nul(['src/a.txt']), content: Buffer.from('PATCH\n'), tree: ['STALE-TREE.txt'], cached: idxBuf(['STALE-INDEX.txt']), others: nul(['STALE-UNTRACKED.txt']) };
      const fake = makeFake(context, world);
      const seam = throwingSeam();
      const s = await seamReview(rv, context, ARGV_C, { fake, seam });
      expectRes(check, 'committed review', s.r, { exit: 0, stdout: cat(HDR_C, 'PATCH\n') });
      checkOps(check, 'committed review', fake, OPS_C());
      check(!fake.kinds().some((k) => ['tree', 'cached', 'others', 'diffIndex'].includes(k)), 'no tree, index, untracked or worktree comparison is requested in committed mode', fake.kinds());
      check(!fake.ops().slice(3).flat().some((a) => /base-ref|head-ref/.test(a)), 'the inventory and content vectors carry the resolved IDs, not the caller spellings');
      check(seam.count() === 0, 'a seam that fails on every working-file call is never called: committed stdout review makes no filesystem call', seam.log.map((e) => e.op));
    });
    await step('seam: exclusions are the selected protected and artifact names of the changed-path inventory plus the two fixed literals, deduplicated and sorted once (C5-P2-1); unselected names do not appear', async () => {
      const names = ['src/a.txt', '.env', 'private/x', '.ai/.run/review/old.diff', 'src/a.txt', '.ENV', 'src/.Env.local'];
      const w1 = makeFake(context, { invDiff: nul(names), content: Buffer.from('P\n') });
      const s1 = await seamReview(rv, context, ARGV_C, { fake: w1, seam: throwingSeam() });
      expectRes(check, 'whole range', s1.r, { exit: 0, stdout: cat(HDR_C, 'P\n') });
      checkOps(check, 'whole range', w1, OPS_C({ X: E_OF(['.env', 'private/x', '.ai/.run/review/old.diff', '.ENV', 'src/.Env.local']) }));
      const w2 = makeFake(context, { invDiff: nul(names), content: Buffer.from('P\n') });
      await seamReview(rv, context, RD('--base', 'base-ref', '--head', 'head-ref', '--', 'src'), { fake: w2, seam: throwingSeam() });
      checkOps(check, 'selector src', w2, OPS_C({ L: sel('src'), X: E_OF(['src/.Env.local']) }));
      const w3 = makeFake(context, { invDiff: nul(['.env', '.ai/.run/review/a.diff']), content: Buffer.from('MUST-NOT-RUN\n') });
      const s3 = await seamReview(rv, context, ARGV_C, { fake: w3, seam: throwingSeam() });
      expectRes(check, 'protected and artifact changes only', s3.r, { exit: 0, stdout: HDR_C });
      checkOps(check, 'protected and artifact changes only', w3, OPS_C({ content: false }));
    });
    await step('seam: names-only framing: empty records are ignored, names are never trimmed or split on LF, and an exclusion keeps the exact spelling (a name with a trailing space or a line feed)', async () => {
      const raw = Buffer.from('a.txt\0\0src/.env\nx\0 lead.txt\0.env \0trail.txt \0\0', 'utf8');
      const fake = makeFake(context, { invDiff: raw, content: Buffer.from('P\n') });
      const s = await seamReview(rv, context, ARGV_C, { fake, seam: throwingSeam() });
      expectRes(check, 'framing', s.r, { exit: 0, stdout: cat(HDR_C, 'P\n') });
      checkOps(check, 'framing', fake, OPS_C({ X: E_OF(['src/.env\nx', '.env ']) }));
    });
    await step('seam: a range whose only change is a force-tracked artifact, or only protected paths, or nothing, is header-only with no content call (C5-P2-2)', async () => {
      for (const [label, inv] of [['a force-tracked artifact', ['.ai/.run/review/forced.diff']], ['the self-ignore file', ['.ai/.run/.gitignore']], ['an aliased artifact', ['.AI/.RUN/REVIEW./A.DIFF']], ['a protected path', ['private/k']], ['nothing', []]]) {
        const fake = makeFake(context, { invDiff: nul(inv), content: Buffer.from('MUST-NOT-RUN\n') });
        const s = await seamReview(rv, context, ARGV_C, { fake, seam: throwingSeam() });
        expectRes(check, label, s.r, { exit: 0, stdout: HDR_C });
        checkOps(check, label, fake, OPS_C({ content: false }));
      }
    });
    const g = await useG(failures, context);
    if (g) {
      await step('real Git: a diverged graph (M differs from B and H) and a dirty trusted checkout: only the M-to-H object patch appears', async () => {
        const root = cloneG(context, g, 'committed');
        dirtyTrusted(context, root);
        const M = g.ids.base0;
        check(M !== g.ids.side && M !== g.ids.topic && g.ids.side !== g.ids.topic, 'fixture sanity: M, B and H are three distinct commits');
        check(gitOk(context, root, ['merge-base', 'side', 'topic']).text === M, 'fixture sanity: the merge-base of side and topic is the base commit');
        const seam = throwingSeam();
        const run = await realReview(rv, context, root, RD('--base', 'side', '--head', 'topic'), { seam });
        const raw = rawGit(context, root, ['diff', ...D_FLAGS, '--patch', M, g.ids.topic, '--', LIT('h-only.txt'), LIT('mod.txt')]);
        const want = cat(hdr(MODE_C, g.ids.side, g.ids.topic, M), raw);
        expectRes(check, 'committed review of the diverged graph', run.r, { exit: 0, stdout: want });
        if (!sameBuf(run.r.stdout, want)) check(false, 'first difference', firstDiff(run.r.stdout, want));
        check(!hasAny(run.r.stdout, ['STAGED-DIRTY-MARKER', 'UNSTAGED-DIRTY-MARKER', 'UNTRACKED-DIRTY-MARKER', 'b-only', ...G_MARKERS]).length, 'no dirty-checkout marker, no B-only change, no protected or artifact marker appears', hasAny(run.r.stdout, ['STAGED-DIRTY-MARKER', 'UNSTAGED-DIRTY-MARKER', 'UNTRACKED-DIRTY-MARKER', 'b-only', ...G_MARKERS]));
        check(eq(run.kinds, ['resolve', 'resolve', 'mergeBase', 'invDiff', 'diff']), 'the Git operations are two resolutions, the merge-base, the inventory and the content diff', run.kinds);
        const content = run.ops[4];
        check(eq(content, V_DIFF_C(M, g.ids.topic, [], E_OF(['.env', 'private/q.txt', '.ai/.run/review/old.diff']))), 'the content vector uses the resolved IDs and excludes the protected and force-tracked artifact names', content && content.slice(-8));
        check(seam.count() === 0, 'the trusted checkout\'s files were not touched');
      });
    }
  });
}

// ============================================== R90/C5/identity ====
// Plan 3.3, 3.5 and 4.3 R90/C5/identity: the header records resolved identities only.
async function identityGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rv = await loadReview(failures, context);
    if (!rv) return;
    await step('both modes: the exact header, one blank line, no timestamp, caller spelling or path; empty results are the header and blank line only', async () => {
      const c = await seamReview(rv, context, ARGV_C, { world: {}, seam: throwingSeam() });
      expectRes(check, 'committed empty result', c.r, { exit: 0, stdout: `# review-diff mode=committed-head base=${B1} head=${H2} merge-base=${M3}\n\n` });
      const l = await seamReview(rv, context, ARGV_L, { world: {} });
      expectRes(check, 'local empty result', l.r, { exit: 0, stdout: `# review-diff mode=local-worktree base=${B1} head=${H2} merge-base=${M3}\n\n` });
      check(!/base-ref|head-ref|HEAD|\d{4}-\d\d-\d\d|[A-Za-z]:\\|\/seam\//.test(textOf(c.r.stdout) + textOf(l.r.stdout)), 'the header holds no caller spelling, timestamp or absolute path');
    });
    await step('equal endpoint spellings resolve once; different spellings resolving to one ID resolve twice; 64-digit IDs; mixed lengths; the default HEAD', async () => {
      const same = makeFake(context, {});
      const s1 = await seamReview(rv, context, RD('--base', 'x', '--head', 'x'), { fake: same, seam: throwingSeam() });
      const X = fakeOid('x');
      expectRes(check, 'same spelling', s1.r, { exit: 0, stdout: hdr(MODE_C, X, X, M3) });
      checkOps(check, 'same spelling', same, [V_RESOLVE('x'), V_MB(X, X), V_INV_C(M3, X)]);
      const head = makeFake(context, {});
      const s2 = await seamReview(rv, context, RD('--base', 'HEAD'), { fake: head });
      expectRes(check, 'base HEAD in local mode', s2.r, { exit: 0, stdout: hdr(MODE_L, H2, H2, M3) });
      checkOps(check, 'base HEAD in local mode', head, [V_RESOLVE('HEAD'), V_MB(H2, H2), V_TREE(M3), V_CACHED(), V_OTHERS()]);
      const two = makeFake(context, { ids: { main: B1, 'origin/main': B1 } });
      const s3 = await seamReview(rv, context, RD('--base', 'main', '--head', 'origin/main'), { fake: two, seam: throwingSeam() });
      expectRes(check, 'two spellings of one commit', s3.r, { exit: 0, stdout: hdr(MODE_C, B1, B1, M3) });
      checkOps(check, 'two spellings of one commit', two, [V_RESOLVE('main'), V_RESOLVE('origin/main'), V_MB(B1, B1), V_INV_C(M3, B1)]);
      const b64 = 'b'.repeat(64); const h64 = 'c'.repeat(64); const m64 = 'd'.repeat(64);
      for (const [label, b, h, m] of [['64-digit IDs', b64, h64, m64], ['mixed lengths', B1, h64, M3], ['64-digit merge-base only', B1, H2, m64]]) {
        const f = makeFake(context, { ids: { 'base-ref': b, 'head-ref': h }, mergeBase: `${m}\n` });
        const s = await seamReview(rv, context, ARGV_C, { fake: f, seam: throwingSeam() });
        expectRes(check, label, s.r, { exit: 0, stdout: hdr(MODE_C, b, h, m) });
        checkOps(check, label, f, [V_RESOLVE('base-ref'), V_RESOLVE('head-ref'), V_MB(b, h), V_INV_C(m, h)]);
      }
      const crlf = makeFake(context, { mergeBase: `${M3}\r\n` });
      const sc = await seamReview(rv, context, ARGV_C, { fake: crlf, seam: throwingSeam() });
      expectRes(check, 'a CRLF-terminated merge-base', sc.r, { exit: 0, stdout: HDR_C });
    });
    await step('a ref that moves after resolution changes nothing: every later vector and the header use the first resolved IDs', async () => {
      const moves = {};
      const world = { resolveOut: (sp) => { moves[sp] = (moves[sp] || 0) + 1; return `${moves[sp] === 1 ? B1 : '9'.repeat(40)}\n`; }, invDiff: nul(['a.txt']), content: Buffer.from('P\n') };
      const f = makeFake(context, world);
      const s = await seamReview(rv, context, RD('--base', 'moving', '--head', 'moving'), { fake: f, seam: throwingSeam() });
      expectRes(check, 'moving ref', s.r, { exit: 0, stdout: cat(hdr(MODE_C, B1, B1, M3), 'P\n') });
      check(moves.moving === 1 && f.kinds().filter((k) => k === 'resolve').length === 1, 'the ref was resolved exactly once', moves);
      check(f.ops().slice(1).flat().every((a) => !/^9+$/.test(a)), 'no later vector carries a re-resolved ID');
      const local = makeFake(context, { resolveOut: world.resolveOut, tree: ['a.txt'], cached: idxBuf(['a.txt']), content: Buffer.from('P\n') });
      moves.HEAD = 0; moves.moving = 0;
      const l = await seamReview(rv, context, RD('--base', 'HEAD'), { fake: local });
      check(l.r.exitCode === 0 && textOf(l.r.stdout).startsWith(hdr(MODE_L, B1, B1, M3)) && moves.HEAD === 1, 'local mode with base HEAD resolves HEAD once and records that ID for both endpoints', { out: textOf(l.r.stdout).slice(0, 150), moves });
    });
    await step('a malformed or failed merge-base is a record or Git failure; nothing follows it', async () => {
      const bads = [
        ['no terminator', M3], ['uppercase', `${'A'.repeat(40)}\n`], ['39 digits', `${'3'.repeat(39)}\n`], ['41 digits', `${'3'.repeat(41)}\n`], ['65 digits', `${'3'.repeat(65)}\n`], ['two lines', `${M3}\n${M3}\n`],
        ['leading space', ` ${M3}\n`], ['trailing text', `${M3} x\n`], ['empty', ''], ['only LF', '\n'], ['not hex', `${'g'.repeat(40)}\n`], ['double LF', `${M3}\n\n`], ['invalid UTF-8', Buffer.from([0xff, 0x0a])],
      ];
      for (const [label, out] of bads) {
        for (const [mode, argv, seamOpt] of [['committed', ARGV_C, throwingSeam()], ['local', ARGV_L, undefined]]) {
          const f = makeFake(context, { mergeBase: out });
          const s = await seamReview(rv, context, argv, { fake: f, seam: seamOpt });
          expectRes(check, `${mode}: merge-base ${label}`, s.r, failRes(E.RECORD));
          check(f.calls.length === 5, `${mode}: merge-base ${label}: no inventory follows`, f.kinds());
        }
      }
      for (const [label, res, msg] of [['a nonzero status', bad(1, 'MARKER-LEAK'), E.GIT], ['status 128', bad(128), E.GIT], ['a signal', { status: null, signal: 'SIGKILL', error: null, stdout: EMPTY, overflow: false }, E.GIT], ['a spawn error', { status: null, signal: null, error: 'ENOENT', stdout: EMPTY, overflow: false }, E.GIT]]) {
        const f = makeFake(context, { mergeBase: res });
        const s = await seamReview(rv, context, ARGV_C, { fake: f, seam: throwingSeam() });
        expectRes(check, `merge-base ${label}`, s.r, failRes(msg));
        check(!s.r.stderr.includes('MARKER-LEAK'), `merge-base ${label}: Git output is never echoed`);
      }
    });
  });
}

// ============================================== the embedded repository fixture ====
// E: an outer repository whose only untracked entry is an embedded repository (plan 4.3 R91/C5/inputs, C5-P2-6). Built once, cloned by users that add files.
const getE = (context) => cached(context, 'e', () => {
  const dir = scratchDir(context, 'e');
  const root = path.join(dir, 'repo');
  fs.mkdirSync(root);
  gitOk(context, root, ['init', '-q']);
  wr(root, 'a.txt', 'a\n');
  gitOk(context, root, ['add', '--', 'a.txt']);
  gitOk(context, root, ['commit', '-qm', 'outer']);
  const emb = path.join(root, 'emb');
  fs.mkdirSync(emb);
  gitOk(context, emb, ['init', '-q']);
  wr(emb, 'x.txt', 'embedded-content\n');
  gitOk(context, emb, ['add', '--', 'x.txt']);
  gitOk(context, emb, ['commit', '-qm', 'inner']);
  return { dir, root };
});

// ============================================== R91/C5/inputs ====
// Plan 3.7, C5-P2-3, C5-P2-6, C5-P2-9 and 4.3 R91/C5/inputs: every untracked read is checked first; nothing is read after a refusal.
const HANDLED = /^git-safe: (REVIEW_[A-Z]+|GIT_SAFE_[A-Z_]+): /;
async function inputsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rv = await loadReview(failures, context);
    if (!rv) return;
    // One untracked-candidate scenario: the inventory, the in-memory files, injected faults, the expected result and whether anything may be opened.
    const scen = async (label, { others, setup = () => {}, faults = [], argv = ARGV_L, want, opens = false, nothing = false }) => {
      const sw = seamWorld(context, { world: { others: Buffer.isBuffer(others) ? others : nul(others) }, faults });
      setup(sw.vfs, sw.root, sw);
      const s = await seamReview(rv, context, argv, { fake: sw.fake, seam: sw.seam });
      if (want) expectRes(check, label, s.r, want);
      if (!opens) check(sw.seam.ops('openSync', 'readFileSync', 'readSync').length === 0, `${label}: nothing was opened and no body was read`, sw.seam.ops('openSync', 'readFileSync').map((e) => e.args[0]));
      if (nothing) check(sw.seam.count() === 0, `${label}: no filesystem call at all`, touched(sw));
      check(sw.vfs.openFds().length === 0, `${label}: every opened descriptor was closed`, sw.vfs.openFds());
      return { s, sw };
    };
    await step('protected, aliased and escaping names are refused or omitted before any open; nonregular leaves, links and unsafe ancestors are exact errors', async () => {
      await scen('protected spellings and artifact inputs are omitted without any access', { others: ['.env.local', 'private/new.txt', '.ai/.run/review/x.diff', 'sub/.ENV'], setup: (v) => { for (const n of ['.env.local', 'private/new.txt', '.ai/.run/review/x.diff', 'sub/.ENV']) v.file(n, 'PROTECTED-OR-ARTIFACT-MARKER\n'); }, want: { exit: 0, stdout: HDR_L }, nothing: true });
      const alias = (result) => (root) => [{ op: 'realpathSync', when: (a) => path.basename(String(a[0])) === 'alias.txt', result: typeof result === 'function' ? result(root) : result }];
      await scen('a safe spelling whose realpath-relative name is protected is the secret error', { others: ['docs/alias.txt'], setup: (v) => { v.file('docs/alias.txt', 'A\n'); v.file('.env', 'SECRET\n'); }, faults: (v, root) => alias((r) => path.join(r, '.env'))(root), want: failRes(E.SECRET) });
      await scen('a realpath that is a case alias of a protected name is the secret error', { others: ['docs/alias.txt'], setup: (v) => { v.file('docs/alias.txt', 'A\n'); }, faults: (v, root) => alias((r) => path.join(r, 'PRIVATE', 'Token.TXT'))(root), want: failRes(E.SECRET) });
      for (const [label, f] of [['a sibling outside the root', (r) => path.join(path.dirname(r), 'outside-e.txt')], ['the parent of the root exactly', (r) => path.dirname(r)], ['another top-level directory', (r) => path.join(path.parse(r).root, 'elsewhere', 'x.txt')]]) {
        await scen(`an escaping realpath (${label}) is REVIEW_PATH`, { others: ['docs/alias.txt'], setup: (v) => { v.file('docs/alias.txt', 'A\n'); }, faults: (v, root) => alias(f)(root), want: failRes(E.PATH) });
      }
      const inside = await scen('a realpath such as ..work stays inside the root (only exactly .. or ..<separator> escapes)', { others: ['docs/alias.txt'], setup: (v) => { v.file('docs/alias.txt', 'A\n'); }, faults: (v, root) => alias((r) => path.join(r, '..work', 'note.txt'))(root), opens: true });
      expectRes(check, '..work', inside.s.r, { exit: 0, stdout: cat(HDR_L, refSection({ 'docs/alias.txt': 'A\n' })) });
      await scen('a FIFO leaf is REVIEW_TYPE before open', { others: ['fifo.txt'], setup: (v) => v.other('fifo.txt'), want: failRes(E.TYPE) });
      await scen('a directory leaf is REVIEW_TYPE before open', { others: ['dir.txt'], setup: (v) => v.dir('dir.txt'), want: failRes(E.TYPE) });
      await scen('a linked ancestor is REVIEW_PATH before open', { others: ['lnk/x.txt'], setup: (v, root) => { v.file('real/x.txt', 'Z\n'); v.link('lnk', path.join(root, 'real')); }, want: failRes(E.PATH) });
      await scen('a linked leaf is REVIEW_PATH before open', { others: ['leaf.txt'], setup: (v, root) => { v.file('t.txt', 'Z\n'); v.link('leaf.txt', path.join(root, 't.txt')); }, want: failRes(E.PATH) });
      await scen('a non-directory ancestor is REVIEW_PATH before open', { others: ['f.txt/x.txt'], setup: (v) => v.file('f.txt', 'x\n'), want: failRes(E.PATH) });
      await scen('a dangling link is refused before open', { others: ['dangling.txt'], setup: (v, root) => v.link('dangling.txt', path.join(root, 'missing-target')), want: failRes(E.PATH) });
      if (WIN) {
        for (const n of ['a:b.txt', 'dir/x:y.txt', 'x.txt::$DATA']) {
          // PLAN-GAP: plan 3.7 says a ':' in an untracked candidate component is rejected on Windows without naming the code; any handled failure with no open is accepted.
          const { s } = await scen(`on Windows a ':' in a candidate component (${show(n)}) is rejected before open`, { others: [n], setup: (v) => v.file(n, 'S\n') });
          check(s.r.exitCode === 2 && s.r.stdout.length === 0 && HANDLED.test(s.r.stderr), `${show(n)}: a handled failure with empty stdout`, { code: s.r.exitCode, err: s.r.stderr.slice(0, 200) });
        }
      }
    });
    await step('oversized descriptors (C5-P2-9): a large text file is refused after at most 8000 bytes were read; a large binary is one binary line; the exact limit permits reading; growth is caught', async () => {
      const text = Buffer.alloc(8000, 0x61);
      const bin = Buffer.alloc(8000, 0x00);
      const big = await scen('a 1048577-byte text file', { others: ['big.txt'], setup: (v) => { v.file('big.txt', text, { sizeOverride: MAX_BYTES + 1 }); }, want: failRes(E.LIMIT), opens: true });
      check(big.sw.seam.bytesRead() <= 8000, 'the refusal came after at most 8000 body bytes were read', big.sw.seam.bytesRead());
      const binary = await scen('a 1048577-byte binary file', { others: ['big.bin'], setup: (v) => { v.file('big.bin', bin, { sizeOverride: MAX_BYTES + 1 }); }, want: { exit: 0, stdout: cat(HDR_L, refRender('big.bin', bin)) }, opens: true });
      check(binary.sw.seam.bytesRead() <= 8000, 'a binary line is rendered without reading further (at most 8000 bytes)', binary.sw.seam.bytesRead());
      await scen('a text file of exactly 1048576 bytes may be read', { others: ['edge.txt'], setup: (v) => { v.file('edge.txt', text, { sizeOverride: MAX_BYTES }); }, want: { exit: 0, stdout: cat(HDR_L, refRender('edge.txt', text)) }, opens: true });
      // the size seen at the descriptor (20000) is above the first chunk and below the limit, so a full read follows; the returned Buffer is then over the limit
      await scen('a file that grows past the limit after its size was checked', { others: ['grow.txt'], setup: (v) => { v.file('grow.txt', Buffer.alloc(MAX_BYTES + 1, 0x61), { sizeOverride: 20000 }); }, want: failRes(E.LIMIT), opens: true });
    });
    await step('invalid inventory records are GIT_SAFE_RECORD and no file is examined; the three inventories are all parsed before any filtering', async () => {
      const raw = (s) => Buffer.from(s, 'utf8');
      const cases = [['a missing terminator', raw('a.txt')], ['a parent segment', raw('../x\0')], ['a double trailing slash', raw('a//\0')], ['a lone slash', raw('/\0')], ['a nested double slash', raw('a/b//\0')], ['a dot directory marker', raw('./\0')],
        ['a parent directory marker', raw('../\0')], ['invalid UTF-8', Buffer.from([0xff, 0x00])], ['a backslash', raw('a\\b\0')], ['an absolute path', raw('/abs/x\0')], ['a drive path', raw('C:/x\0')], ['an embedded marker with a double slash', raw('emb//\0')], ['a slash after a dot segment', raw('a/./\0')]];
      for (const [label, buf] of cases) await scen(`untracked record: ${label}`, { others: buf, setup: (v) => v.file('a.txt', 'x\n'), want: failRes(E.RECORD), nothing: true });
      const sw = seamWorld(context, { world: { tree: ['.env'], cached: idxBuf(['.env']), others: raw('bad\\name\0'), content: Buffer.from('MUST-NOT-RUN\n') } });
      const s = await seamReview(rv, context, ARGV_L, { fake: sw.fake, seam: sw.seam });
      expectRes(check, 'a malformed untracked record with only protected tracked entries', s.r, failRes(E.RECORD));
      check(!sw.fake.kinds().includes('diffIndex'), 'no content call follows a record failure', sw.fake.kinds());
    });
    await step('embedded repository markers (C5-P2-6): a selected unprotected marker is REVIEW_TYPE and is never opened; unselected, protected and artifact markers are omitted', async () => {
      await scen('a selected marker', { others: ['emb/'], want: failRes(E.TYPE) });
      const first = await scen('a regular file ahead of the marker is processed first, then the marker fails the whole review', { others: ['emb/', 'a.txt'], setup: (v) => v.file('a.txt', 'a\n'), want: failRes(E.TYPE), opens: true });
      check(first.sw.seam.ops('openSync').length === 1 && relPosix(first.sw.root, first.sw.seam.ops('openSync')[0].args[0]) === 'a.txt', 'only the regular file ahead of the marker (UTF-8 order) was opened', first.sw.seam.ops('openSync').map((e) => e.args[0]));
      const after = await scen('a regular file after the marker is never reached', { others: ['emb/', 'z.txt'], setup: (v) => v.file('z.txt', 'z\n'), want: failRes(E.TYPE) });
      check(!touched(after.sw).includes('z.txt'), 'the file after the failing marker was never examined', touched(after.sw));
      await scen('an unselected marker', { others: ['emb/', 'ok.txt'], setup: (v) => v.file('ok.txt', 'ok\n'), argv: RD('--base', 'base-ref', '--', 'ok.txt'), want: { exit: 0, stdout: cat(HDR_L, refSection({ 'ok.txt': 'ok\n' })) }, opens: true });
      await scen('a selector below the marker name selects nothing of it', { others: ['emb/'], argv: RD('--base', 'base-ref', '--', 'other'), want: { exit: 0, stdout: HDR_L }, nothing: true });
      await scen('a marker selected by name', { others: ['emb/', 'ok.txt'], setup: (v) => v.file('ok.txt', 'ok\n'), argv: RD('--base', 'base-ref', '--', 'emb'), want: failRes(E.TYPE) });
      await scen('protected, nested protected and artifact markers are omitted', { others: ['.env-repo/', 'private/repo/', '.ai/.run/review/'], want: { exit: 0, stdout: HDR_L }, nothing: true });
    });
    await step('filesystem failures after enumeration map to REVIEW_IO at every operation, in order, and nothing follows; malformed return values are REVIEW_IO', async () => {
      const f = (op, extra = {}) => ({ op, when: (a) => op === 'fstatSync' || op === 'readFileSync' || op === 'readSync' || path.basename(String(a[0])) === 'f.txt', once: true, ...extra });
      await scen('a listed file that disappeared (ENOENT)', { others: ['gone.txt'], want: failRes(E.IO) });
      for (const op of ['lstatSync', 'realpathSync', 'openSync', 'fstatSync']) {
        const r = await scen(`EACCES at ${op}`, { others: ['f.txt', 'g.txt'], setup: (v) => { v.file('f.txt', 'f\n'); v.file('g.txt', 'g\n'); }, faults: [f(op, { error: 'EACCES' })], want: failRes(E.IO), opens: true });
        check(!touched(r.sw).includes('g.txt'), `EACCES at ${op}: the next candidate was never examined`, touched(r.sw));
      }
      const read = await scen('EACCES at the body read', { others: ['f.txt', 'g.txt'], setup: (v) => { v.file('f.txt', 'f\n'); v.file('g.txt', 'g\n'); }, faults: [f('readFileSync', { error: 'EACCES' }), f('readSync', { error: 'EACCES' })], want: failRes(E.IO), opens: true });
      check(!touched(read.sw).includes('g.txt'), 'EACCES at the read: the next candidate was never examined', touched(read.sw));
      const base = { others: ['f.txt'], setup: (v) => v.file('f.txt', 'f\n'), want: failRes(E.IO), opens: true };
      const sizeOf = (size) => ({ op: 'fstatSync', mutate: (st) => Object.assign(Object.create(Object.getPrototypeOf(st)), st, { size }) });
      for (const [label, fault] of [
        ['lstat returns null', { op: 'lstatSync', when: (a) => path.basename(String(a[0])) === 'f.txt', result: null }], ['lstat returns an empty object', { op: 'lstatSync', when: (a) => path.basename(String(a[0])) === 'f.txt', result: {} }],
        ['realpath returns an empty string', { op: 'realpathSync', when: (a) => path.basename(String(a[0])) === 'f.txt', result: '' }], ['realpath returns a number', { op: 'realpathSync', when: (a) => path.basename(String(a[0])) === 'f.txt', result: 5 }],
        ['fstat returns null', { op: 'fstatSync', result: null }], ['fstat size -1', sizeOf(-1)], ['fstat size 1.5', sizeOf(1.5)], ['fstat size NaN', sizeOf(NaN)], ['fstat size is a string', sizeOf('5')], ['fstat size beyond the safe integers', sizeOf(2 ** 53)], ['fstat size Infinity', sizeOf(Infinity)],
      ]) await scen(label, { ...base, faults: [{ ...fault, once: true }] });
      // a file above the bounded first chunk, so a full read always follows
      const base9 = { others: ['f.txt'], setup: (v) => v.file('f.txt', Buffer.alloc(9000, 0x61)), want: failRes(E.IO), opens: true };
      for (const [label, fault] of [['the full read returns a string', { op: 'readFileSync', result: 'f' }], ['the full read returns null', { op: 'readFileSync', result: null }]]) await scen(label, { ...base9, faults: [{ ...fault, once: true }] });
      // PLAN-GAP: the bounded first read of C5-P2-9 is not one of the ten pinned methods; when an implementation uses readSync for it, a malformed count is REVIEW_IO (asserted only when readSync was called)
      for (const [label, result] of [['a string count', 'x'], ['a negative count', -1], ['a count above the request', 99999], ['a fractional count', 1.5]]) {
        const r = await scen(`readSync returns ${label}`, { ...base9, faults: [{ op: 'readSync', once: true, result }], want: null });
        if (r.sw.seam.ops('readSync').length > 0) expectRes(check, `readSync returns ${label}`, r.s.r, failRes(E.IO));
      }
    });
    await step('a file replaced between the check and the open is refused before its body is read (identity must match)', async () => {
      // PLAN-GAP: plan 3.7 requires fstatSync to identify the same regular file checked before open but names no code; any handled failure without a body read is accepted.
      const r = await scen('replacement between lstat and open', { others: ['swap.txt'], setup: (v) => v.file('swap.txt', 'ORIGINAL-MARKER\n'), faults: (v) => [{ op: 'openSync', once: true, hook: () => { v.file('swap.txt', 'REPLACEMENT-MARKER\n'); } }], opens: true });
      check(r.s.r.exitCode === 2 && r.s.r.stdout.length === 0 && HANDLED.test(r.s.r.stderr), 'a handled failure with empty stdout', { code: r.s.r.exitCode, err: r.s.r.stderr.slice(0, 200) });
      check(r.sw.seam.bytesRead() === 0 && !textOf(r.s.r.stdout).includes('REPLACEMENT-MARKER'), 'no body of the replacement was read or emitted', r.sw.seam.bytesRead());
    });
    await step('an unrelated unsafe candidate outside the narrowed selection does not block review', async () => {
      const r = await scen('narrowing past an unsafe path', {
        others: ['bad/link.txt', 'ok/a.txt'], setup: (v, root) => { v.file('real/x.txt', 'Z\n'); v.link('bad', path.join(root, 'real')); v.file('ok/a.txt', 'ok\n'); },
        argv: RD('--base', 'base-ref', '--', 'ok'), want: { exit: 0, stdout: cat(HDR_L, refSection({ 'ok/a.txt': 'ok\n' })) }, opens: true,
      });
      check(!touched(r.sw).some((n) => n.startsWith('bad')), 'the unselected unsafe path was never examined', touched(r.sw));
      await scen('without narrowing the same unsafe path is refused', { others: ['bad/link.txt', 'ok/a.txt'], setup: (v, root) => { v.file('real/x.txt', 'Z\n'); v.link('bad', path.join(root, 'real')); v.file('ok/a.txt', 'ok\n'); }, want: failRes(E.PATH), opens: true });
    });
    const e = await (async () => { try { return await getE(context); } catch (err) { failures.push(`cannot build the embedded repository fixture: ${errMsg(err)}`); return null; } })();
    if (e) {
      await step('real Git: an embedded untracked repository is inventoried as exactly dir/ followed by NUL (fixture sanity), selecting it is REVIEW_TYPE without any open or read, and narrowing past it succeeds', async () => {
        const others = gitOk(context, e.root, ['ls-files', '--others', '--exclude-standard', '-z']).out;
        check(sameBuf(others, Buffer.from('emb/\0')), 'fixture sanity: ls-files --others --exclude-standard -z reports exactly emb/ NUL for the embedded repository', others);
        const seam = realSeam();
        const run = await realReview(rv, context, e.root, RD('--base', 'HEAD'), { seam });
        expectRes(check, 'review selecting the embedded repository', run.r, failRes(E.TYPE));
        check(seam.under(e.root, 'emb').filter((x) => ['openSync', 'readFileSync', 'readSync'].includes(x.op)).length === 0, 'nothing under the embedded repository was opened or read', seam.under(e.root, 'emb').map((x) => x.op));
        const narrow = await realReview(rv, context, e.root, RD('--base', 'HEAD', '--', 'a.txt'), { seam: realSeam() });
        const head = gitOk(context, e.root, ['rev-parse', 'HEAD']).text;
        expectRes(check, 'narrowing to the tracked file', narrow.r, { exit: 0, stdout: hdr(MODE_L, head, head, head) });
        const byName = await realReview(rv, context, e.root, RD('--base', 'HEAD', '--', 'emb'), { seam: realSeam() });
        expectRes(check, 'selecting emb by name', byName.r, failRes(E.TYPE));
      });
    }
  });
}

// ============================================== R91/C5/artifacts ====
// Plan 3.10, 4.3 R91/C5/artifacts: the output grammar, the default name and root-relative resolution.
const OUT = '.ai/.run/review/p.diff';
const ARGV_OUT = RD('--base', 'base-ref', '--head', 'head-ref', '--out', OUT);
const PUB_WORLD = { invDiff: nul(['src/a.txt']), content: Buffer.from('CONTENT\n') };
const WANT_ART = cat(HDR_C, 'CONTENT\n');
async function artifactsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rv = await loadReview(failures, context);
    if (!rv) return;
    const cases = loadCases(check, context);
    await step('every output row of the fixture: accepted names round-trip, every other spelling is REVIEW_OUT in the parser', async () => {
      if (!cases) return;
      for (const row of cases.outputs) {
        const argv = ['review-diff', '--base', 'a', '--out', row.out];
        if (row.accepted) {
          const r = await attempt(() => rv.parseReviewArgs(argv));
          check(!r.threw && r.value.out === row.out && r.value.base === 'a' && r.value.head === null && eq(r.value.paths, []), `${row.id}: ${show(row.out)} is accepted unchanged`, r.threw ? errMsg(r.error) : r.value);
        } else await expectErr(check, `${row.id} ${show(row.out)}`, () => rv.parseReviewArgs(argv), E.OUT);
      }
      check(rv.parseReviewArgs(['review-diff', '--base', 'a', '--out', `.ai/.run/review/${'a'.repeat(123)}.diff`]).out.length === 16 + 128, 'a 128-character filename is accepted');
      await expectErr(check, 'a 129-character filename', () => rv.parseReviewArgs(['review-diff', '--base', 'a', '--out', `.ai/.run/review/${'a'.repeat(124)}.diff`]), E.OUT);
      check(rv.parseReviewArgs(['review-diff', '--base', 'a', '--out', '.ai/.run/review/a.diff']).out === '.ai/.run/review/a.diff', 'a 6-character filename is the shortest accepted');
      for (const n of ['COM1', 'com2', 'Com3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'lpt2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'Lpt9', 'CON', 'PRN', 'AUX', 'NUL']) {
        await expectErr(check, `the device name ${n} before the first dot`, () => rv.parseReviewArgs(['review-diff', '--base', 'a', '--out', `.ai/.run/review/${n}.diff`]), E.OUT);
        await expectErr(check, `the device name ${n} before a later dot`, () => rv.parseReviewArgs(['review-diff', '--base', 'a', '--out', `.ai/.run/review/${n}.x.diff`]), E.OUT);
      }
    });
    await step('a lexical failure makes zero Git, filesystem and policy calls and is the exact REVIEW_OUT line', async () => {
      for (const out of ['/abs/a.diff', '.ai/.run/review/../a.diff', '.ai/.run/review/CON.diff', '.ai/.run/review/a b.diff', `.ai/.run/review/${'a'.repeat(124)}.diff`, '']) {
        const fake = makeFake(context, PUB_WORLD);
        const seam = throwingSeam();
        const s = await seamReview(rv, context, RD('--base', 'base-ref', '--head', 'head-ref', '--out', out), { fake, seam });
        expectRes(check, `out ${show(out).slice(0, 40)}`, s.r, failRes(E.OUT));
        check(fake.calls.length === 0 && seam.count() === 0 && s.reads.length === 0, `out ${show(out).slice(0, 40)}: no Git call, no filesystem call, no policy read`, { git: fake.calls.length, fs: seam.count(), reads: s.reads.length });
      }
    });
    await step('defaultReviewArtifactPath: the exact timestamp transformation, the year range, no mutation, and invalid inputs', async () => {
      const f = rv.defaultReviewArtifactPath;
      check(typeof f === 'function' && f.length <= 1, 'defaultReviewArtifactPath is a function of one optional argument');
      const d = new Date('2026-10-19T12:34:56.789Z');
      const t0 = d.getTime();
      check(f(d) === '.ai/.run/review/20261019T123456789Z.diff', 'the pinned example', f(d));
      check(d.getTime() === t0, 'the Date is not mutated');
      for (const [iso, want] of [['0000-01-01T00:00:00.000Z', '.ai/.run/review/00000101T000000000Z.diff'], ['9999-12-31T23:59:59.999Z', '.ai/.run/review/99991231T235959999Z.diff'], ['2026-01-02T03:04:05.006Z', '.ai/.run/review/20260102T030405006Z.diff'], ['1970-01-01T00:00:00.000Z', '.ai/.run/review/19700101T000000000Z.diff']]) {
        const r = await attempt(() => f(new Date(iso)));
        check(!r.threw && r.value === want, `${iso} gives ${want}`, r.threw ? errMsg(r.error) : r.value);
      }
      const now = f();
      check(/^\.ai\/\.run\/review\/\d{8}T\d{9}Z\.diff$/.test(now), 'no argument uses the current time', now);
      check(rv.parseReviewArgs(['review-diff', '--base', 'a', '--out', f(d)]).out === f(d), 'the default path passes the output grammar');
      for (const [label, v] of [['an invalid Date', new Date(NaN)], ['a year above 9999', new Date(Date.UTC(10000, 0, 1))], ['a negative year', new Date(Date.UTC(-1, 0, 1))], ['null', null], ['a string', '2026-10-19T12:34:56.789Z'], ['a number', 0], ['an object', {}], ['an array', []], ['a Date-like object', { toISOString: () => '2026-10-19T12:34:56.789Z' }]]) {
        await expectErr(check, `defaultReviewArtifactPath(${label})`, () => f(v), E.INPUT);
      }
    });
    await step('invoked from a repository subdirectory, the artifact is created under the repository root (not the cwd) and the same root-relative path is echoed; the default filesystem is the real one', async () => {
      const dir = scratchDir(context, 'subdir');
      const root = path.join(dir, 'repo');
      const cwd = path.join(root, 'sub', 'deep');
      fs.mkdirSync(cwd, { recursive: true });
      const fake = makeFake(context, { root: `${fwd(root)}\n`, ...PUB_WORLD });
      const r = await rv.reviewMain(RD('--base', 'base-ref', '--head', 'head-ref', '--out', OUT), { cwd, env: SEAM_ENV, execute: fake.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      expectRes(check, 'review from a subdirectory', r, { exit: 0, stdout: `${OUT}\n` });
      check(sameBytes(readBytes(path.join(root, '.ai', '.run', 'review', 'p.diff')), WANT_ART), 'the artifact is under the repository root and holds the stdout-mode bytes');
      check(!exists(path.join(cwd, '.ai')) && !exists(path.join(root, 'sub', '.ai')), 'nothing was created under the working directory');
      check(fake.calls.slice(2).every((c) => c.cwd === path.resolve(root)) && fake.calls.slice(0, 2).every((c) => c.cwd === path.resolve(cwd)), 'the Git calls run in the repository root after the session calls', fake.calls.map((c) => c.cwd));
      check(sameBytes(readBytes(path.join(root, '.ai', '.run', '.gitignore')), Buffer.from('*\n')), 'the self-ignore file holds exactly the two bytes 2a 0a');
    });
  });
}

// ============================================== R91/C5/links ====
// Plan 3.7, 3.10, 4.3 R91/C5/links: real junctions (mandatory, never skipped), links, escapes and an alternate root spelling.
function makeDirLink(target, link) {
  try { fs.symlinkSync(target, link, WIN ? 'junction' : 'dir'); return null; } catch (e) { return errMsg(e); }
}
async function linksGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rv = await loadReview(failures, context);
    if (!rv) return;
    const outsideOf = (dir, name) => { const o = path.join(dir, name); putFile(path.join(o, 'sentinel.txt'), `SENTINEL-${name}\n`); return o; };
    const link = (label, target, at) => { const err = makeDirLink(target, at); if (err) check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'} for ${label} (mandatory, never skipped)`, err); return err === null; };
    const out = (root, argv, seam, o = {}) => {
      const fake = makeFake(context, { root: `${fwd(o.rootSpelling || root)}\n`, ...PUB_WORLD, ...(o.world || {}) });
      return { fake, run: rv.reviewMain(argv, { cwd: root, env: SEAM_ENV, execute: fake.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)), ...(seam ? { fs: seam.fs } : {}) }) };
    };
    await step('a junction at .ai, at .ai/.run, at .ai/.run/review, or as the artifact leaf is REVIEW_PATH; the outside directory is never written', async () => {
      for (const [label, build] of [
        ['.ai', (root, o) => link('.ai', o, path.join(root, '.ai'))],
        ['.ai/.run', (root, o) => { fs.mkdirSync(path.join(root, '.ai')); return link('.ai/.run', o, path.join(root, '.ai', '.run')); }],
        ['.ai/.run/review', (root, o) => { fs.mkdirSync(path.join(root, '.ai', '.run'), { recursive: true }); return link('.ai/.run/review', o, path.join(root, '.ai', '.run', 'review')); }],
        ['the artifact leaf', (root, o) => { fs.mkdirSync(path.join(root, '.ai', '.run', 'review'), { recursive: true }); return link('the artifact leaf', o, path.join(root, '.ai', '.run', 'review', 'p.diff')); }],
      ]) {
        const dir = scratchDir(context, 'lnk');
        const root = path.join(dir, 'repo');
        fs.mkdirSync(root);
        const outside = outsideOf(dir, 'outside');
        const before = snapshotTree(outside);
        if (!build(root, outside)) continue;
        const seam = realSeam();
        const { run } = out(root, ARGV_OUT, seam);
        const r = await run;
        expectRes(check, `junction at ${label}`, r, failRes(E.PATH));
        check(snapshotTree(outside) === before, `junction at ${label}: the outside directory and its sentinel are unchanged and nothing was created in it`, walkTree(outside));
        check(!seam.ops('unlinkSync').some((e) => !String(e.args[0]).startsWith(root)), `junction at ${label}: nothing outside the repository was unlinked`);
      }
    });
    await step('a junction ancestor or leaf of an untracked candidate, a file symlink (when permitted) and a non-directory ancestor are REVIEW_PATH with no open', async () => {
      for (const [label, name, build] of [
        ['an untracked ancestor', 'docs/x.txt', (root, o) => link('an untracked ancestor', o, path.join(root, 'docs'))],
        ['an untracked directory leaf', 'leaf', (root, o) => link('an untracked directory leaf', o, path.join(root, 'leaf'))],
        ['a deeper untracked ancestor', 'a/b/x.txt', (root, o) => { fs.mkdirSync(path.join(root, 'a')); return link('a deeper untracked ancestor', o, path.join(root, 'a', 'b')); }],
      ]) {
        const dir = scratchDir(context, 'lnk2');
        const root = path.join(dir, 'repo');
        fs.mkdirSync(root);
        const outside = outsideOf(dir, 'outside');
        putFile(path.join(outside, 'x.txt'), 'OUTSIDE-UNTRACKED-MARKER\n');
        const before = snapshotTree(outside);
        if (!build(root, outside)) continue;
        const seam = realSeam();
        const { run } = out(root, ARGV_L, seam, { world: { others: nul([name]) } });
        const r = await run;
        expectRes(check, label, r, failRes(E.PATH));
        check(seam.ops('openSync', 'readFileSync', 'readSync').length === 0 && !textOf(r.stdout).includes('OUTSIDE-UNTRACKED-MARKER'), `${label}: nothing was opened and the outside content never appears`, seam.ops('openSync').map((e) => e.args[0]));
        check(snapshotTree(outside) === before, `${label}: the outside directory is unchanged`);
      }
      const dir = scratchDir(context, 'lnk3');
      const root = path.join(dir, 'repo');
      fs.mkdirSync(root);
      putFile(path.join(root, 'target.txt'), 'T\n');
      let fileLink = true;
      try { fs.symlinkSync(path.join(root, 'target.txt'), path.join(root, 'flink.txt'), 'file'); } catch (e) { fileLink = false; diag(context, `R91/C5/links: optional file-symlink subcase not exercised (${String(e.code || e.message)}); the mandatory junction and synthetic link cases ran.`); }
      if (fileLink) {
        const seam = realSeam();
        const { run } = out(root, ARGV_L, seam, { world: { others: nul(['flink.txt']) } });
        expectRes(check, 'a file symlink leaf', await run, failRes(E.PATH));
        check(seam.ops('openSync', 'readFileSync', 'readSync').length === 0, 'a file symlink leaf is never opened');
      }
      putFile(path.join(root, 'plain.txt'), 'P\n');
      const seam2 = realSeam();
      const { run: run2 } = out(root, ARGV_L, seam2, { world: { others: nul(['plain.txt/x.txt']) } });
      expectRes(check, 'a regular file as an ancestor', await run2, failRes(E.PATH));
      const dir4 = scratchDir(context, 'lnk4');
      const root4 = path.join(dir4, 'repo');
      fs.mkdirSync(root4);
      putFile(path.join(root4, '.ai'), 'I-AM-A-FILE\n');
      const { run: run3 } = out(root4, ARGV_OUT, realSeam());
      expectRes(check, '.ai as a regular file', await run3, failRes(E.PATH));
      check(sameBytes(readBytes(path.join(root4, '.ai')), Buffer.from('I-AM-A-FILE\n')), 'the regular file that blocks .ai is unchanged');
    });
    await step('a supported alternate spelling of the checkout root is canonicalized; links below the canonical root are still refused', async () => {
      const dir = scratchDir(context, 'lnk5');
      const real = path.join(dir, 'real-root');
      const alias = path.join(dir, 'alias-root');
      fs.mkdirSync(real);
      if (!link('the alternate root spelling', real, alias)) return;
      putFile(path.join(real, 'd', 'n.txt'), 'N\n');
      const seam = realSeam();
      const { run } = out(real, ARGV_L, seam, { rootSpelling: alias, world: { others: nul(['d/n.txt']) } });
      expectRes(check, 'an untracked file below a junction-spelled root', await run, { exit: 0, stdout: cat(HDR_L, refSection({ 'd/n.txt': 'N\n' })) });
      const art = out(real, ARGV_OUT, realSeam(), { rootSpelling: alias });
      expectRes(check, 'an artifact below a junction-spelled root', await art.run, { exit: 0, stdout: `${OUT}\n` });
      check(sameBytes(readBytes(path.join(real, '.ai', '.run', 'review', 'p.diff')), WANT_ART), 'the artifact was created under the real root');
      const outside = outsideOf(dir, 'outside');
      if (!link('a link below the canonical root', outside, path.join(real, 'inner'))) return;
      putFile(path.join(outside, 'x.txt'), 'X\n');
      const below = out(real, ARGV_L, realSeam(), { rootSpelling: alias, world: { others: nul(['inner/x.txt']) } });
      expectRes(check, 'a link below the canonical root', await below.run, failRes(E.PATH));
    });
    await step('synthetic escapes of the artifact chain: a realpath that leaves the repository for .ai/.run/review is REVIEW_PATH and nothing is written', async () => {
      const sw = seamWorld(context, { world: PUB_WORLD, faults: (v, root) => [{ op: 'realpathSync', when: (a) => path.resolve(String(a[0])) === path.join(root, '.ai', '.run', 'review'), result: path.join(path.dirname(root), 'elsewhere', 'review') }] });
      sw.vfs.dir('.ai/.run/review');
      sw.vfs.file('.ai/.run/.gitignore', '*\n');
      const s = await seamReview(rv, context, ARGV_OUT, { fake: sw.fake, seam: sw.seam });
      expectRes(check, 'a synthetic realpath escape', s.r, failRes(E.PATH));
      check(sw.seam.ops('unlinkSync', 'writeSync').length === 0 && !sw.vfs.has(OUT), 'no artifact was written or removed', sw.seam.log.map((e) => e.op));
    });
  });
}

// ============================================== R91/C5/publication ====
// Plan 3.10, 3.11 and 4.3 R91/C5/publication: the exact publication order, exclusivity, preservation and cleanup, through the in-memory seam and the real filesystem.
const IGN = '.ai/.run/.gitignore';
const isWriteOpen = (flags) => (typeof flags === 'string' ? /[wa+]/.test(flags) : (flags & (FO.O_WRONLY | FO.O_RDWR | FO.O_CREAT)) !== 0);
// The effect trace of a run: directory creations, write-mode opens, writes, syncs, closes and unlinks, by root-relative path.
function effects(sw) {
  const fdPath = new Map();
  const out = [];
  for (const e of sw.seam.log) {
    if (e.op === 'openSync' && isWriteOpen(e.args[1])) { if (typeof e.result === 'number') fdPath.set(e.result, relPosix(sw.root, e.args[0])); out.push(`open:${relPosix(sw.root, e.args[0])}`); }
    else if (e.op === 'mkdirSync') out.push(`mkdir:${relPosix(sw.root, e.args[0])}`);
    else if (e.op === 'unlinkSync') out.push(`unlink:${relPosix(sw.root, e.args[0])}`);
    else if (['writeSync', 'fsyncSync', 'closeSync'].includes(e.op) && fdPath.has(e.args[0])) out.push(`${e.op.replace('Sync', '')}:${fdPath.get(e.args[0])}`);
  }
  return out.filter((x, i, a) => !(x.startsWith('write:') && a[i - 1] === x));
}
const FRESH_TRACE = ['mkdir:.ai', 'mkdir:.ai/.run', `open:${IGN}`, `write:${IGN}`, `fsync:${IGN}`, `close:${IGN}`, 'mkdir:.ai/.run/review', `open:${OUT}`, `write:${OUT}`, `fsync:${OUT}`, `close:${OUT}`];
const writeOpensOf = (sw) => sw.seam.ops('openSync').filter((e) => isWriteOpen(e.args[1]));
async function publicationGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rv = await loadReview(failures, context);
    if (!rv) return;
    // One publication scenario in the in-memory filesystem: faults is a function of (vfs, root); setup prepares existing state.
    const pub = async ({ setup = () => {}, faults = [], maxWrite, argv = ARGV_OUT } = {}) => {
      const sw = seamWorld(context, { world: PUB_WORLD, faults });
      setup(sw.vfs, sw.root);
      if (maxWrite) sw.vfs.maxWrite = maxWrite;
      const s = await seamReview(rv, context, argv, { fake: sw.fake, seam: sw.seam });
      return { sw, s };
    };
    const dirsAndIgnore = (v) => { v.dir('.ai/.run'); v.file(IGN, '*\n'); };
    const nothingEmitted = (label, r) => check(r.stdout.length === 0 && !r.stdout.includes(Buffer.from(OUT)) && r.exitCode === 2, `${label}: neither the path nor a patch was emitted`, r.stdout.subarray(0, 80));
    await step('a fresh publication creates the directories, the exact self-ignore bytes (written, synced and closed first), then the artifact exclusively with mode 0o600; success prints only the path', async () => {
      const { sw, s } = await pub();
      expectRes(check, 'fresh publication', s.r, { exit: 0, stdout: `${OUT}\n` });
      check(eq(effects(sw), FRESH_TRACE), 'the effect order is mkdir .ai, mkdir .ai/.run, the self-ignore (open, write, fsync, close), mkdir review, then the artifact (open, write, fsync, close)', effects(sw));
      check(sameBuf(sw.vfs.bytesOf(IGN), Buffer.from([0x2a, 0x0a])), 'the self-ignore file holds exactly 2a 0a', sw.vfs.bytesOf(IGN));
      check(sameBuf(sw.vfs.bytesOf(OUT), WANT_ART), 'the artifact holds the complete stdout-mode bytes');
      const opens = writeOpensOf(sw);
      const art = opens.find((e) => relPosix(sw.root, e.args[0]) === OUT);
      const ign = opens.find((e) => relPosix(sw.root, e.args[0]) === IGN);
      check(art && art.args[1] === 'wx' && art.args[2] === 0o600, 'the artifact is opened with openSync(path, "wx", 0o600)', art && art.args);
      check(ign && (ign.args[1] === 'wx' || (typeof ign.args[1] === 'number' && (ign.args[1] & FO.O_EXCL) !== 0)), 'the self-ignore file is created exclusively', ign && ign.args);
      check(sw.seam.ops('mkdirSync').every((e) => !(e.rawArgs[1] && e.rawArgs[1].recursive)), 'directories are created non-recursively, one component at a time');
      check(sw.vfs.openFds().length === 0 && sw.seam.ops('unlinkSync').length === 0, 'every descriptor is closed and nothing is unlinked on success');
      const std = await seamReview(rv, context, ARGV_C, { fake: makeFake(context, PUB_WORLD), seam: throwingSeam() });
      check(sameBuf(sw.vfs.bytesOf(OUT), std.r.stdout), 'the artifact bytes equal the stdout-mode bytes');
    });
    await step('existing directories and an existing exact self-ignore file are accepted and never rewritten', async () => {
      const a = await pub({ setup: (v) => { v.dir('.ai/.run'); } });
      expectRes(check, 'existing directories', a.s.r, { exit: 0, stdout: `${OUT}\n` });
      check(eq(effects(a.sw), FRESH_TRACE.filter((x) => x !== 'mkdir:.ai' && x !== 'mkdir:.ai/.run')), 'only the missing parts are created', effects(a.sw));
      const b = await pub({ setup: dirsAndIgnore });
      expectRes(check, 'existing exact ignore bytes', b.s.r, { exit: 0, stdout: `${OUT}\n` });
      check(eq(effects(b.sw), ['mkdir:.ai/.run/review', `open:${OUT}`, `write:${OUT}`, `fsync:${OUT}`, `close:${OUT}`]), 'the existing self-ignore file is not opened for writing; the review directory and the artifact are created', effects(b.sw));
      check(sameBuf(b.sw.vfs.bytesOf(IGN), Buffer.from('*\n')), 'its bytes are unchanged');
      const c = await pub({ setup: (v) => { dirsAndIgnore(v); v.dir('.ai/.run/review'); v.file('.ai/.run/review/other.diff', 'OTHER-ARTIFACT\n'); } });
      expectRes(check, 'a sibling artifact', c.s.r, { exit: 0, stdout: `${OUT}\n` });
      check(sameBuf(c.sw.vfs.bytesOf('.ai/.run/review/other.diff'), Buffer.from('OTHER-ARTIFACT\n')), 'a sibling artifact is preserved byte for byte');
    });
    await step('different self-ignore bytes are REVIEW_IGNORE and are never overwritten; no artifact and no review directory result', async () => {
      for (const [label, data] of [['CRLF', '*\r\n'], ['no LF', '*'], ['an extra comment', '# keep\n*\n'], ['a BOM', '\ufeff*\n'], ['empty', ''], ['two stars', '**\n'], ['two lines', '*\n*\n']]) {
        const { sw, s } = await pub({ setup: (v) => { v.dir('.ai/.run'); v.file(IGN, data); } });
        expectRes(check, `self-ignore ${label}`, s.r, failRes(E.IGNORE));
        check(sameBuf(sw.vfs.bytesOf(IGN), Buffer.from(data, 'utf8')) && !sw.vfs.has(OUT) && !sw.vfs.has('.ai/.run/review'), `self-ignore ${label}: unchanged, no artifact, no review directory`);
        check(effects(sw).length === 0, `self-ignore ${label}: no write-mode effect at all`, effects(sw));
      }
    });
    await step('an existing regular artifact is REVIEW_EXISTS and untouched; an existing nonregular artifact is REVIEW_PATH; an exclusive-create race is REVIEW_EXISTS and the winner is preserved', async () => {
      const ex = await pub({ setup: (v) => { dirsAndIgnore(v); v.file(OUT, 'EXISTING-ARTIFACT\n'); } });
      expectRes(check, 'an existing artifact', ex.s.r, failRes(E.EXISTS));
      check(sameBuf(ex.sw.vfs.bytesOf(OUT), Buffer.from('EXISTING-ARTIFACT\n')) && ex.sw.seam.ops('writeSync', 'unlinkSync').length === 0, 'the existing artifact is unchanged and nothing was written or removed');
      for (const [label, make] of [['a directory', (v) => v.dir(OUT)], ['a link', (v, root) => { v.file('elsewhere.diff', 'E\n'); v.link(OUT, path.join(root, 'elsewhere.diff')); }], ['a FIFO', (v) => v.other(OUT)]]) {
        const r = await pub({ setup: (v, root) => { dirsAndIgnore(v); v.dir('.ai/.run/review'); make(v, root); } });
        expectRes(check, `a nonregular artifact (${label})`, r.s.r, failRes(E.PATH));
        check(r.sw.seam.ops('writeSync', 'unlinkSync').length === 0, `a nonregular artifact (${label}): nothing was written or removed`);
      }
      const race = await pub({ setup: dirsAndIgnore, faults: (v) => [{ op: 'openSync', when: (a) => String(a[0]).endsWith('p.diff') && isWriteOpen(a[1]), once: true, hook: () => { v.dir('.ai/.run/review'); v.file(OUT, 'RACE-WINNER\n'); } }] });
      expectRes(check, 'an exclusive-create race', race.s.r, failRes(E.EXISTS));
      check(sameBuf(race.sw.vfs.bytesOf(OUT), Buffer.from('RACE-WINNER\n')) && race.sw.seam.ops('writeSync', 'unlinkSync').length === 0, 'the racing winner is preserved and never replaced or removed');
      const injected = await pub({ setup: (v) => { dirsAndIgnore(v); v.dir('.ai/.run/review'); }, faults: [{ op: 'openSync', when: (a) => String(a[0]).endsWith('p.diff'), once: true, error: 'EEXIST' }] });
      expectRes(check, 'an injected EEXIST', injected.s.r, failRes(E.EXISTS));
      check(injected.sw.seam.ops('unlinkSync').length === 0, 'nothing is unlinked after an exclusive-open EEXIST');
    });
    await step('create races on directories and the self-ignore file are revalidated: a real directory or an identical ignore file continues, a link or different bytes does not', async () => {
      const mkdirRace = await pub({ faults: (v) => [{ op: 'mkdirSync', when: (a) => String(a[0]).endsWith('.ai'), once: true, hook: () => { v.dir('.ai'); } }] });
      expectRes(check, 'a racing directory creation', mkdirRace.s.r, { exit: 0, stdout: `${OUT}\n` });
      const linkRace = await pub({ faults: (v, root) => [{ op: 'mkdirSync', when: (a) => String(a[0]).endsWith('.ai'), once: true, hook: () => { v.dir('outside-race'); v.link('.ai', path.join(root, 'outside-race')); } }] });
      expectRes(check, 'a directory raced into a link', linkRace.s.r, failRes(E.PATH));
      check(linkRace.sw.seam.ops('writeSync').length === 0, 'nothing was written through the raced link');
      const same = await pub({ setup: (v) => v.dir('.ai/.run'), faults: (v) => [{ op: 'openSync', when: (a) => String(a[0]).endsWith('.gitignore') && isWriteOpen(a[1]), once: true, hook: () => { v.file(IGN, '*\n'); } }] });
      expectRes(check, 'another creator wrote the exact ignore bytes', same.s.r, { exit: 0, stdout: `${OUT}\n` });
      check(sameBuf(same.sw.vfs.bytesOf(IGN), Buffer.from('*\n')), 'the winner\'s ignore file is kept');
      const diff = await pub({ setup: (v) => v.dir('.ai/.run'), faults: (v) => [{ op: 'openSync', when: (a) => String(a[0]).endsWith('.gitignore') && isWriteOpen(a[1]), once: true, hook: () => { v.file(IGN, 'DIFFERENT\n'); } }] });
      expectRes(check, 'another creator wrote different ignore bytes', diff.s.r, failRes(E.IGNORE));
      check(sameBuf(diff.sw.vfs.bytesOf(IGN), Buffer.from('DIFFERENT\n')) && !diff.sw.vfs.has(OUT), 'the winner\'s bytes are untouched and no artifact exists');
    });
    await step('a policy that protects the requested artifact path or the self-ignore path is the secret error before any resolution and any filesystem call; stdout mode is unaffected by such a policy', async () => {
      for (const [label, policy] of [
        ['the artifact directory', pol2([], [{ anchor: 'root', glob: '.ai/.run/review/**' }])], ['the exact artifact', pol2([], [{ anchor: 'root', glob: OUT }])], ['the self-ignore path', pol2([], [{ anchor: 'root', glob: IGN }])],
        ['all of .ai', pol2([], [{ anchor: 'root', glob: '.ai/**' }])], ['an any-depth ignore name', pol2([{ anchor: 'any', glob: '**/.gitignore' }], [])], ['a case alias of the ignore path', pol2([], [{ anchor: 'root', glob: '.AI/.RUN/.GITIGNORE' }])],
      ]) {
        const sw = seamWorld(context, { world: PUB_WORLD });
        const s = await seamReview(rv, context, ARGV_OUT, { fake: sw.fake, seam: sw.seam, policy });
        expectRes(check, `a policy protecting ${label}`, s.r, failRes(E.SECRET));
        check(sw.fake.calls.length === 2 && sw.seam.count() === 0, `a policy protecting ${label}: the refusal precedes every resolution and filesystem call`, { git: sw.fake.kinds(), fs: sw.seam.count() });
        const std = await seamReview(rv, context, ARGV_C, { world: PUB_WORLD, seam: throwingSeam(), policy });
        check(std.r.exitCode === 0, `a policy protecting ${label}: a stdout review is not affected (no output path is involved)`, std.r.stderr);
      }
    });
    await step('the artifact chain is revalidated before the artifact is opened: a review directory that became a link after its creation is REVIEW_PATH and nothing is written through it', async () => {
      const { sw, s } = await pub({ faults: (v, root) => [{ op: 'mkdirSync', when: (a) => String(a[0]).endsWith('review'), mutate: (r) => { v.dir('elsewhere'); v.remove('.ai/.run/review'); v.link('.ai/.run/review', path.join(root, 'elsewhere')); return r; } }] });
      expectRes(check, 'a swapped review directory', s.r, failRes(E.PATH));
      check(!sw.vfs.has('elsewhere/p.diff') && sw.seam.ops('writeSync').length <= 1, 'no artifact was created behind the link (at most the self-ignore write happened)', sw.seam.ops('writeSync').length);
      nothingEmitted('a swapped review directory', s.r);
    });
    await step('short writes complete the whole buffer; a zero-byte write is a failure and not a retry loop', async () => {
      const short = await pub({ maxWrite: 5 });
      expectRes(check, 'short writes', short.s.r, { exit: 0, stdout: `${OUT}\n` });
      check(sameBuf(short.sw.vfs.bytesOf(OUT), WANT_ART) && sameBuf(short.sw.vfs.bytesOf(IGN), Buffer.from('*\n')), 'both files are complete');
      check(short.sw.seam.ops('writeSync').length > 3, 'the artifact needed several writes', short.sw.seam.ops('writeSync').length);
      const zero = await pub({ faults: [{ op: 'writeSync', when: (a, e) => e.n === 2, result: 0 }] });
      expectRes(check, 'a zero-byte write', zero.s.r, failRes(E.IO));
      check(zero.sw.seam.ops('writeSync').length === 2, 'no retry loop: the self-ignore write plus exactly one artifact write attempt', zero.sw.seam.ops('writeSync').length);
      check(!zero.sw.vfs.has(OUT), 'the newly created incomplete artifact was removed');
      nothingEmitted('a zero-byte write', zero.s.r);
    });
    await step('write, sync, close and directory failures: REVIEW_IO, descriptors closed, the incomplete file removed, a completed self-ignore file and directories kept, nothing emitted', async () => {
      const cases = [
        ['a write failure', [{ op: 'writeSync', when: (a, e) => e.n === 2, error: 'EIO' }]], ['an fsync failure', [{ op: 'fsyncSync', when: (a, e) => e.n === 2, error: 'EIO' }]],
        ['a close failure', [{ op: 'closeSync', when: (a, e) => e.n === 2, error: 'EIO' }]], ['a directory creation failure', [{ op: 'mkdirSync', when: (a) => String(a[0]).endsWith('review'), error: 'EACCES' }]],
      ];
      for (const [label, faults] of cases) {
        const { sw, s } = await pub({ faults });
        expectRes(check, label, s.r, failRes(E.IO));
        check(!sw.vfs.has(OUT), `${label}: no artifact file remains`);
        check(sameBuf(sw.vfs.bytesOf(IGN), Buffer.from('*\n')) && sw.vfs.has('.ai/.run'), `${label}: the completed self-ignore file and the directories are kept`);
        check(label === 'a close failure' || sw.vfs.openFds().length === 0, `${label}: owned descriptors were closed`, sw.vfs.openFds());
        check(sw.seam.ops('unlinkSync').every((e) => relPosix(sw.root, e.args[0]) === OUT), `${label}: only the newly created artifact was unlinked`, sw.seam.ops('unlinkSync').map((e) => e.args[0]));
      }
      const ign = await pub({ faults: [{ op: 'writeSync', when: (a, e) => e.n === 1, error: 'EIO' }] });
      check(ign.s.r.exitCode === 2 && ign.s.r.stdout.length === 0 && HANDLED.test(ign.s.r.stderr) && !ign.sw.vfs.has(OUT) && !ign.sw.vfs.has('.ai/.run/review'), 'a self-ignore write failure ends the run with a handled error and creates no artifact or review directory', { code: ign.s.r.exitCode, err: ign.s.r.stderr.slice(0, 200) });
      check(!ign.sw.vfs.has(IGN) || ign.sw.vfs.bytesOf(IGN).length <= 2, 'PLAN-GAP: an incomplete self-ignore file is removed or at most the two valid bytes (the plan does not pin which)', ign.sw.vfs.bytesOf(IGN));
    });
    await step('cleanup never deletes a replacement and never traverses a replaced parent: an identity change, an unlink failure or a swapped directory is REVIEW_CLEANUP', async () => {
      const replaced = await pub({ faults: (v) => [{ op: 'writeSync', when: (a, e) => e.n === 2, hook: () => { v.file(OUT, 'REPLACEMENT-BYTES\n'); }, error: 'EIO' }] });
      expectRes(check, 'a replaced artifact', replaced.s.r, failRes(E.CLEANUP));
      check(sameBuf(replaced.sw.vfs.bytesOf(OUT), Buffer.from('REPLACEMENT-BYTES\n')) && replaced.sw.seam.ops('unlinkSync').length === 0, 'the replacement file is preserved and was never unlinked');
      const stuck = await pub({ faults: [{ op: 'writeSync', when: (a, e) => e.n === 2, error: 'EIO' }, { op: 'unlinkSync', error: 'EPERM' }] });
      expectRes(check, 'an unlink failure', stuck.s.r, failRes(E.CLEANUP));
      check(stuck.sw.vfs.has(OUT), 'the incomplete file that could not be removed is reported, not hidden');
      const swapped = await pub({ faults: (v, root) => [{ op: 'writeSync', when: (a, e) => e.n === 2, hook: () => { v.file('elsewhere/p.diff', 'VICTIM-BYTES\n'); v.remove('.ai/.run/review'); v.link('.ai/.run/review', path.join(root, 'elsewhere')); }, error: 'EIO' }] });
      expectRes(check, 'a swapped parent directory', swapped.s.r, failRes(E.CLEANUP));
      check(sameBuf(swapped.sw.vfs.bytesOf('elsewhere/p.diff'), Buffer.from('VICTIM-BYTES\n')) && swapped.sw.seam.ops('unlinkSync').length === 0, 'the file behind the swapped parent was never unlinked');
      for (const r of [replaced, stuck, swapped]) nothingEmitted('a failed cleanup', r.s.r);
    });
    await step('real filesystem: exact bytes on disk, exclusivity on a second run, the self-ignore file left alone, and stdout equality', async () => {
      const dir = scratchDir(context, 'pubreal');
      const root = path.join(dir, 'repo');
      fs.mkdirSync(root);
      const run = (out, seam) => {
        const fake = makeFake(context, { root: `${fwd(root)}\n`, ...PUB_WORLD });
        return rv.reviewMain(RD('--base', 'base-ref', '--head', 'head-ref', '--out', out), { cwd: root, env: SEAM_ENV, execute: fake.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)), ...(seam ? { fs: seam.fs } : {}) });
      };
      expectRes(check, 'a first real publication', await run('.ai/.run/review/one.diff'), { exit: 0, stdout: '.ai/.run/review/one.diff\n' });
      check(sameBytes(readBytes(path.join(root, '.ai', '.run', '.gitignore')), Buffer.from([0x2a, 0x0a])), 'the self-ignore file holds 2a 0a on disk');
      check(sameBytes(readBytes(path.join(root, '.ai', '.run', 'review', 'one.diff')), WANT_ART), 'the artifact holds the stdout-mode bytes on disk');
      const seam = realSeam();
      expectRes(check, 'the same name again', await run('.ai/.run/review/one.diff', seam), failRes(E.EXISTS));
      check(sameBytes(readBytes(path.join(root, '.ai', '.run', 'review', 'one.diff')), WANT_ART), 'the existing artifact is unchanged');
      const seam2 = realSeam();
      expectRes(check, 'a second name', await run('.ai/.run/review/two.diff', seam2), { exit: 0, stdout: '.ai/.run/review/two.diff\n' });
      check(writeOpensOf({ seam: seam2, root }).map((e) => relPosix(root, e.args[0])).join() === '.ai/.run/review/two.diff', 'only the new artifact was opened for writing; the existing self-ignore file was left alone', writeOpensOf({ seam: seam2, root }).map((e) => e.args[0]));
      check(sameBytes(readBytes(path.join(root, '.ai', '.run', 'review', 'two.diff')), WANT_ART) && sameBytes(readBytes(path.join(root, '.ai', '.run', 'review', 'one.diff')), WANT_ART), 'both artifacts hold the same complete bytes');
      const std = await rv.reviewMain(ARGV_C, { cwd: root, env: SEAM_ENV, execute: makeFake(context, { root: `${fwd(root)}\n`, ...PUB_WORLD }).execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      check(sameBuf(std.stdout, WANT_ART), 'stdout mode returns exactly the artifact bytes');
    });
  });
}

// ================================================= the setup-script toolkit ====
// Every CLI call is shell-free with the absolute Node executable; a dead process fails the calling assertion once.
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
function makeKit(context, check) {
  const scripts = (name) => path.join(context.skillRoot, 'scripts', `${name}.mjs`);
  const invoke = (label, scriptPath, args, o = {}) => {
    const r = execNode(context, { cwd: o.cwd, script: scriptPath, args, preload: o.preload || null, env: o.env || null });
    if (r.dead && !o.allowDead) check(false, `${label}: the process did not end normally`, r.dead);
    return r;
  };
  const kit = {
    scripts,
    lock: (root, args, o = {}) => invoke(`lock ${args[0]}`, scripts('lock'), args, { cwd: root, ...o }),
    apply: (root, args, o = {}) => invoke(`apply ${args[0]}`, scripts('apply'), args, { cwd: root, ...o }),
    script: (name, root, args, o = {}) => invoke(name, scripts(name), args, { cwd: root, ...o }),
    begin(root, id) {
      const a = kit.lock(root, ['acquire', '--run-id', id]);
      const b = kit.apply(root, ['init', '--run-id', id]);
      check(a.code === 0 && b.code === 0, `begin ${id}: lock acquire and init succeed`, { a: a.stdout.slice(0, 200), b: b.stdout.slice(0, 200) });
      return a.code === 0 && b.code === 0;
    },
  };
  return kit;
}
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
// A recording, failing git first on PATH (the technique of the C2, C3 and C4 tests): on Windows a copy of Node named git.exe and a preload that recognizes it
// and exits 91; elsewhere a shell script. Every Git use of a command run with shim.env is recorded.
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
  return { env, rec, reset: () => fs.writeFileSync(rec, ''), records: () => (readText(rec) || '').split('\n').filter(Boolean) };
}
// A preload that records every filesystem call whose path lies under the watched prefixes (the scratch project root by default). Distribution module
// loading happens outside the project root and is never recorded. Components are compared with trailing dots and spaces removed and case folded, so an
// alias of a watched directory is recorded too. The log lives outside the project.
let recSeq = 0;
function fsRecorder(dir, root, watchRels = null) {
  const id = ++recSeq;
  const log = path.join(dir, `fsrec-${id}.log`);
  const file = path.join(dir, `fsrec-${id}.cjs`);
  const cfg = { log, prefixes: (watchRels === null ? [''] : watchRels).map((r) => path.join(path.resolve(root), ...r.split('/').filter(Boolean))) };
  const source = [
    "'use strict';",
    "const fs = require('fs');",
    "const path = require('path');",
    "const { fileURLToPath } = require('url');",
    `const CFG = ${JSON.stringify(cfg)};`,
    'const append = fs.appendFileSync;',
    "const canon = (p) => path.resolve(p).split(path.sep).map((s) => s.replace(/[. ]+$/, '').toLowerCase()).join(path.sep);",
    'const PFX = CFG.prefixes.map(canon);',
    "const toPath = (p) => { try { if (typeof p === 'string') return p; if (Buffer.isBuffer(p)) return p.toString(); if (p instanceof URL) return fileURLToPath(p); } catch (e) { return null; } return null; };",
    "const under = (p) => { const s = toPath(p); if (s === null) return false; let c; try { c = canon(s); } catch (e) { return false; } return PFX.some((q) => c === q || c.startsWith(q + path.sep)); };",
    "const note = (op, p) => { try { append(CFG.log, JSON.stringify({ op: op, path: String(toPath(p)) }) + '\\n'); } catch (e) { /* ignore */ } };",
    "const SYNC = ['readFileSync', 'openSync', 'statSync', 'lstatSync', 'readdirSync', 'existsSync', 'accessSync', 'realpathSync', 'mkdirSync', 'writeFileSync', 'appendFileSync', 'rmSync', 'unlinkSync', 'renameSync', 'opendirSync', 'readlinkSync', 'copyFileSync', 'rmdirSync', 'mkdtempSync', 'cpSync', 'symlinkSync'];",
    "for (const n of SYNC) { const orig = fs[n]; if (typeof orig !== 'function') continue; fs[n] = function (p) { if (under(p)) note(n, p); return orig.apply(this, arguments); }; }",
    "if (typeof fs.realpathSync.native === 'function') { const o = fs.realpathSync.native; fs.realpathSync.native = function (p) { if (under(p)) note('realpathSync.native', p); return o.apply(this, arguments); }; }",
    "const CB = ['readFile', 'stat', 'lstat', 'readdir', 'access', 'mkdir', 'writeFile', 'open', 'appendFile', 'rm', 'unlink', 'rename', 'realpath', 'readlink', 'opendir'];",
    "for (const n of CB) { const orig = fs[n]; if (typeof orig !== 'function') continue; fs[n] = function (p) { if (under(p)) note(n, p); return orig.apply(this, arguments); }; }",
    "for (const n of CB.concat(['cp', 'copyFile'])) { const orig = fs.promises[n]; if (typeof orig !== 'function') continue; fs.promises[n] = function (p) { if (under(p)) note('promises.' + n, p); return orig.apply(this, arguments); }; }",
  ].join('\n') + '\n';
  fs.writeFileSync(file, source);
  fs.writeFileSync(log, '');
  return { file, hits: () => (readText(log) || '').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return l; } }), reset: () => fs.writeFileSync(log, '') };
}

// The reserved-ID failures of plan 3.12, serialized exactly as the plan says (JSON.stringify(object, null, 2) + LF).
const RESERVED_OUT = `${JSON.stringify({ ok: false, code: 'RUN_ID_RESERVED', error: 'run id is reserved for review artifacts' }, null, 2)}\n`;
const GENERIC_RESERVED_OUT = `${JSON.stringify({ ok: false, error: 'RUN_ID_RESERVED: run id is reserved for review artifacts' }, null, 2)}\n`;
const MIGRATION_USAGE_OUT = `${JSON.stringify({ ok: false, code: 'MIGRATION_USAGE', error: 'usage: migrate-security-paths.mjs report --project <root> OR stage --project <root> --run-id <id>' }, null, 2)}\n`;
const DIFF_USAGE_OUT = `${JSON.stringify({ ok: false, code: 'APPLY_DIFF_USAGE', error: 'usage: apply.mjs diff --project <root> --run-id <id>' }, null, 2)}\n`;
const invalidIdOut = (s) => `${JSON.stringify({ ok: false, error: `invalid run id "${s}": use 4-64 chars [A-Za-z0-9._-], starting alphanumeric, no ".."` }, null, 2)}\n`;
const RESERVED_MESSAGE = 'RUN_ID_RESERVED: run id is reserved for review artifacts';
const OWNER = (runId) => ({ runId, host: 'planted-host', agent: 'unknown', skillVersion: '0.0.0', acquiredAt: '2026-01-01T00:00:00.000Z', heartbeatAt: '2026-01-01T00:00:00.000Z' });
const lockDirOf = (root) => path.join(root, '.ai', '.setup.lock');
const plantLock = (root, owner) => putFile(path.join(lockDirOf(root), 'owner.json'), `${JSON.stringify(owner, null, 2)}\n`);
const expectReserved = (check, label, r, out = RESERVED_OUT) => {
  check(r.code === 1 && r.stderr === '' && r.stdout === out, `${label}: the exact pretty JSON, exit 1, empty stderr`, { code: r.code, stdout: r.stdout.slice(0, 220), stderr: r.stderr.slice(0, 100) });
};

// ============================================== R92/C5/reserved ====
// Plan 3.12 and 4.3 R92/C5/reserved: validateRunId reserves review and its aliases; every lifecycle command refuses them before root discovery.
async function reservedGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const cases = loadCases(check, context);
    const lib = await importOrFail(failures, scriptUrl(context, 'lib.mjs'), 'scripts/lib.mjs');
    if (lib && typeof lib.validateRunId !== 'function') { failures.push('scripts/lib.mjs lacks validateRunId'); return; }
    if (lib && cases) {
      await step('validateRunId: every alias is reserved with the exact code and message, ordinary identifiers are unchanged, other invalid identifiers keep the existing error', async () => {
        for (const row of cases.aliases) {
          const r = await attempt(() => lib.validateRunId(row.input));
          if (row.reserved) {
            check(r.threw && r.error instanceof Error && hasOwn(r.error, 'code') && r.error.code === 'RUN_ID_RESERVED' && r.error.message === RESERVED_MESSAGE, `${row.id} ${show(row.input)}: reserved with code RUN_ID_RESERVED and the exact message`, r.threw ? { code: r.error.code, message: r.error.message } : r.value);
          } else if (row.valid) {
            check(!r.threw && r.value === row.input, `${row.id} ${show(row.input)}: an ordinary valid identifier is returned unchanged`, r.threw ? errMsg(r.error) : r.value);
          } else {
            check(r.threw && r.error.code !== 'RUN_ID_RESERVED' && r.error.message === `invalid run id "${row.input}": use 4-64 chars [A-Za-z0-9._-], starting alphanumeric, no ".."`, `${row.id} ${show(row.input)}: the existing invalid-identifier error`, r.threw ? r.error.message : r.value);
          }
        }
        for (const v of [undefined, null, true]) {
          const r = await attempt(() => lib.validateRunId(v));
          check(r.threw && r.error.message === 'invalid run id "": use 4-64 chars [A-Za-z0-9._-], starting alphanumeric, no ".."', `${String(v)} still converts to an empty string and keeps the existing error`, r.threw ? r.error.message : r.value);
        }
        // canonicalization only compares: it never turns an invalid identifier into an accepted one
        for (const bad of ['rev', 'review/..', 're view', 'review\n', '.review.']) {
          const r = await attempt(() => lib.validateRunId(bad));
          check(r.threw && r.error.code !== 'RUN_ID_RESERVED', `${show(bad)}: never accepted and not mistaken for the reserved name`, r.threw ? r.error.message : r.value);
        }
      });
    }
    const kit = makeKit(context, check);
    const dir = scratchDir(context, 'reserved');
    const proj = makeRepo(context, path.join(dir, 'proj'), { 'package.json': '{"name":"fixture-app"}\n', 'src/a.ts': 'export {}\n', 'README.md': '# r\n' });
    const shim = makeGitShim(context, dir);
    await step('every lifecycle command refuses a reserved alias with the exact envelope before any Git call and before any project filesystem access; duplicates and --confirm-run-id are scanned too', async () => {
      // controls: the shim and the recorder are not blind
      const c1 = kit.lock(proj, ['status'], { env: shim.env });
      check(shim.records().length >= 1, 'control: a lock status through the shim reaches the failing Git (so a zero below is meaningful)', { code: c1.code, records: shim.records().length });
      const recCtl = fsRecorder(dir, proj);
      kit.lock(proj, ['status'], { preload: recCtl.file });
      check(recCtl.hits().length >= 1, 'control: a lock status records project-root filesystem calls (so a zero below is meaningful)', recCtl.hits().length);
      shim.reset();
      const rec = fsRecorder(dir, proj);
      const ID = 'a'.repeat(64);
      const table = [
        ['lock', ['acquire', '--run-id', 'review']], ['lock', ['heartbeat', '--run-id', 'REVIEW']], ['lock', ['status', '--run-id', 'Review']], ['lock', ['release', '--run-id', 'review.']],
        ['lock', ['break', '--confirm-run-id', 'review ']],
        ['apply', ['init', '--run-id', 'review']], ['apply', ['diff', '--project', proj, '--run-id', 'Review.']], ['apply', ['prepare', '--run-id', 'REVIEW ', '--mode', 'update']],
        ['apply', ['commit', '--run-id', 'review...', '--approved-plan', ID]], ['apply', ['status', '--run-id', 'review. .']], ['apply', ['rollback', '--run-id', 'rEvIeW']], ['apply', ['cleanup', '--run-id', 'review.']],
        ['lock', ['acquire', '--run-id', 'run-ok01', '--run-id', 'review']], ['lock', ['acquire', '--run-id', 'review', '--run-id', 'run-ok01']],
        ['apply', ['init', '--run-id', 'run-ok01', '--confirm-run-id', 'review']], ['lock', ['break', '--confirm-run-id', 'review', '--confirm-unknown-owner']],
        ['lock', ['break', '--confirm-unknown-owner', '--confirm-run-id', 'REVIEW']], ['apply', ['cleanup', '--run-id', 'review', '--confirm-manual-resolution']],
        ['apply', ['diff', '--run-id', 'review', '--project', proj]], ['lock', ['acquire', '--agent', 'claude', '--run-id', 'review.']],
      ];
      for (const [script, args] of table) {
        const r = kit[script](proj, args, { env: shim.env, preload: rec.file });
        expectReserved(check, `${script} ${args.join(' ').slice(0, 70)}`, r);
      }
      check(shim.records().length === 0, 'no Git invocation happened for any reserved identifier', shim.records().slice(0, 3));
      check(rec.hits().length === 0, 'no project-root filesystem call happened for any reserved identifier', rec.hits().slice(0, 5));
      check(!exists(path.join(proj, '.ai')), 'nothing was created in the project', walkTree(proj, ['.git']).map((x) => x[0]));
    });
    await step('tokens that are not a scanned value keep the existing behavior: a missing value, a value beginning with --, a hidden value; the invalid diff identifier keeps C2 usage; ordinary lookalikes work', async () => {
      const e = invalidIdOut('');
      for (const args of [['acquire', '--run-id'], ['acquire', '--run-id', '--x'], ['acquire', '--run-id', '--x', 'review'], ['heartbeat', '--run-id', '--agent', 'review']]) {
        const r = kit.lock(proj, args);
        check(r.code === 1 && r.stderr === '' && r.stdout === e, `lock ${args.join(' ')}: the existing invalid-identifier failure, not the reserved one`, { code: r.code, stdout: r.stdout.slice(0, 200) });
      }
      const d = kit.apply(proj, ['diff', '--project', proj, '--run-id', 'abc']);
      check(d.code === 1 && d.stderr === '' && d.stdout === DIFF_USAGE_OUT, 'an ordinary invalid diff identifier keeps APPLY_DIFF_USAGE', { code: d.code, stdout: d.stdout.slice(0, 200) });
      for (const ok of ['review-1', 'reviewx']) {
        const a = kit.lock(proj, ['acquire', '--run-id', ok]);
        check(a.code === 0 && a.json && a.json.acquired === true, `lock acquire accepts the ordinary identifier ${ok}`, a.stdout.slice(0, 200));
        const r = kit.lock(proj, ['release', '--run-id', ok]);
        check(r.code === 0 && r.json && r.json.released === true, `lock release accepts ${ok}`, r.stdout.slice(0, 200));
      }
    });
    await step('the other validateRunId callers keep their own envelopes: the generic failure for blocks, env-keys, merge-claude-settings, secret-scan and canary; the migration usage failure for migrate-security-paths stage; nothing is created', async () => {
      putFile(path.join(proj, 'content.txt'), 'c\n');
      putFile(path.join(proj, 'keys.json'), '[]\n');
      const before = snapshotTree(proj, ['.git']);
      const table = [
        ['blocks', ['upsert', '--file', '.gitignore', '--id', 'x', '--content', 'content.txt', '--run-id', 'review'], GENERIC_RESERVED_OUT], ['env-keys', ['merge', '--keys', 'keys.json', '--run-id', 'Review'], GENERIC_RESERVED_OUT],
        ['merge-claude-settings', ['--run-id', 'review.'], GENERIC_RESERVED_OUT], ['secret-scan', ['--run-id', 'REVIEW'], GENERIC_RESERVED_OUT], ['canary', ['setup', '--run-id', 'review '], GENERIC_RESERVED_OUT],
        ['migrate-security-paths', ['stage', '--project', proj, '--run-id', 'review'], MIGRATION_USAGE_OUT],
      ];
      for (const [name, args, out] of table) {
        const r = kit.script(name, proj, args);
        expectReserved(check, `${name} ${args.slice(-2).join(' ')}`, r, out);
      }
      check(snapshotTree(proj, ['.git']) === before, 'no review draft, run directory, canary directory or other file was created by any of them');
    });
    await step('a readable reserved setup-lock owner: status reports it; break without the recovery flag is the reserved failure; break with --confirm-unknown-owner removes only the lock; a reserved --confirm-run-id still fails early', async () => {
      const p2 = makeRepo(context, path.join(dir, 'proj2'), { 'package.json': '{"name":"fixture-app"}\n' });
      const sentinel = () => snapshotTree(path.join(p2, '.ai', '.run'));
      putFile(path.join(p2, '.ai', '.run', 'review', 'keep.diff'), 'KEEP-ARTIFACT\n');
      putFile(path.join(p2, '.ai', '.run', '.gitignore'), '*\n');
      const baseline = sentinel();
      for (const ownerId of ['review', 'Review.']) {
        const owner = OWNER(ownerId);
        plantLock(p2, owner);
        const st = kit.lock(p2, ['status']);
        check(st.code === 0 && st.json && st.json.ok === true && st.json.held === true && st.json.owner && st.json.owner.runId === ownerId && st.json.ownerReadable === true, `status reports the readable reserved owner ${ownerId}`, st.stdout.slice(0, 300));
        const b0 = kit.lock(p2, ['break']);
        expectReserved(check, `break without the recovery flag (owner ${ownerId})`, b0);
        const bo = kit.lock(p2, ['break', '--confirm-run-id', 'run-other1']);
        // PLAN-GAP: break with a readable reserved owner and an ordinary --confirm-run-id but no recovery flag is not spelled out; the reserved failure or the existing mismatch failure are both refusals and the lock must stay.
        check(bo.code !== 0 && exists(path.join(lockDirOf(p2), 'owner.json')), `break with an ordinary --confirm-run-id but no recovery flag is a refusal and keeps the lock (owner ${ownerId})`, { code: bo.code, stdout: bo.stdout.slice(0, 200) });
        const bc = kit.lock(p2, ['break', '--confirm-run-id', 'review', '--confirm-unknown-owner']);
        expectReserved(check, `a reserved --confirm-run-id with the recovery flag (owner ${ownerId})`, bc);
        check(exists(path.join(lockDirOf(p2), 'owner.json')), `the lock is still there after the refusals (owner ${ownerId})`);
        const ok = kit.lock(p2, ['break', '--confirm-unknown-owner']);
        const want = { ok: true, broken: true, previousOwner: owner, next: 'check every run with apply.mjs status for a partial apply' };
        check(ok.code === 0 && ok.stderr === '' && eq(ok.json, want) && ok.stdout === jsonText(want), `break with --confirm-unknown-owner succeeds with the existing break envelope (owner ${ownerId})`, { code: ok.code, stdout: ok.stdout.slice(0, 300) });
        check(!exists(lockDirOf(p2)), `the setup lock is removed (owner ${ownerId})`);
        check(sentinel() === baseline, `the review directory and the self-ignore file are untouched (owner ${ownerId})`);
      }
      // ordinary owners and unknown owners keep their behavior
      plantLock(p2, OWNER('run-aaaa'));
      const wrong = kit.lock(p2, ['break', '--confirm-run-id', 'run-bbbb']);
      check(wrong.code === 2 && wrong.json && wrong.json.ok === false && exists(lockDirOf(p2)), 'an ordinary owner still needs the matching --confirm-run-id', { code: wrong.code, stdout: wrong.stdout.slice(0, 200) });
      const right = kit.lock(p2, ['break', '--confirm-run-id', 'run-aaaa']);
      check(right.code === 0 && right.json && right.json.broken === true && right.json.previousOwner && right.json.previousOwner.runId === 'run-aaaa' && !exists(lockDirOf(p2)), 'the matching ordinary owner is broken as before', right.stdout.slice(0, 200));
      putFile(path.join(lockDirOf(p2), 'owner.json'), 'not json\n');
      const unk = kit.lock(p2, ['break', '--confirm-unknown-owner']);
      check(unk.code === 0 && unk.json && unk.json.broken === true && unk.json.previousOwner === 'unknown' && !exists(lockDirOf(p2)), 'an unreadable owner is still broken with --confirm-unknown-owner and reported as unknown', unk.stdout.slice(0, 200));
    });
  });
}

// ============================================== R92/C5/cleanup ====
// Plan 3.12 and 4.3 R92/C5/cleanup: cleanup never reaches the review directory; a planted journal there never blocks an ordinary prepare.
async function cleanupGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const kit = makeKit(context, check);
    const dir = scratchDir(context, 'cleanup');
    const proj = makeRepo(context, path.join(dir, 'proj'), { 'package.json': '{"name":"fixture-app"}\n', 'src/a.ts': 'export {}\n', 'docs/note.md': '# note\n' });
    const reviewDir = path.join(proj, '.ai', '.run', 'review');
    const ignoreFile = path.join(proj, '.ai', '.run', '.gitignore');
    const reviewState = () => `${snapshotTree(reviewDir)}|${(readBytes(ignoreFile) || Buffer.alloc(0)).toString('hex')}`;
    putFile(path.join(reviewDir, 'a.diff'), 'ARTIFACT-A\n');
    putFile(path.join(reviewDir, 'b.diff'), 'ARTIFACT-B\n');
    putFile(ignoreFile, '*\n');
    const baseline = reviewState();
    await step('cleanup of a reserved alias, with or without --confirm-manual-resolution, fails before any access to the review directory and leaves every sentinel unchanged', async () => {
      check(kit.begin(proj, 'run-c5-one'), 'an ordinary run begins');
      const recCtl = fsRecorder(dir, proj, ['.ai/.run/run-c5-one']);
      kit.apply(proj, ['status', '--run-id', 'run-c5-one'], { preload: recCtl.file });
      check(recCtl.hits().length >= 1, 'control: the recorder sees an ordinary run directory being read', recCtl.hits().length);
      const rec = fsRecorder(dir, proj, ['.ai/.run/review']);
      for (const alias of ['review', 'REVIEW', 'review.', 'review ', 'Review. .']) {
        for (const flags of [[], ['--confirm-manual-resolution']]) {
          const r = kit.apply(proj, ['cleanup', '--run-id', alias, ...flags], { preload: rec.file });
          expectReserved(check, `cleanup ${show(alias)} ${flags.join(' ')}`, r);
          check(reviewState() === baseline, `cleanup ${show(alias)} ${flags.join(' ')}: the review artifacts and the self-ignore bytes are unchanged`);
        }
      }
      check(rec.hits().length === 0, 'the review directory (or any alias spelling of it) was never accessed by a refused cleanup', rec.hits().slice(0, 4));
    });
    await step('cleanup of an eligible ordinary run keeps its existing envelope and preserves the review subtree and the self-ignore file', async () => {
      const r = kit.apply(proj, ['cleanup', '--run-id', 'run-c5-one']);
      check(r.code === 0 && r.stderr === '' && r.json && r.json.ok === true && r.json.removed === '.ai/.run/run-c5-one' && r.json.state === 'fresh', 'the ordinary cleanup succeeds with its existing success envelope', { code: r.code, stdout: r.stdout.slice(0, 300) });
      check(!exists(path.join(proj, '.ai', '.run', 'run-c5-one')), 'the ordinary run directory is gone');
      check(reviewState() === baseline, 'the sibling review artifacts and .ai/.run/.gitignore are preserved byte for byte');
      const rel = kit.lock(proj, ['release', '--run-id', 'run-c5-one']);
      check(rel.code === 0, 'the lock is released', rel.stdout.slice(0, 200));
    });
    await step('a partial journal planted in the reserved directory never blocks an ordinary prepare and is never read', async () => {
      putFile(path.join(reviewDir, 'journal.json'), '{"committed":false,"entries":[{"state":"applied"}]}');
      const planted = reviewState();
      check(kit.begin(proj, 'run-c5-two'), 'a second ordinary run begins');
      putFile(path.join(proj, '.ai', '.run', 'run-c5-two', 'drafts', 'docs', 'c5-note.md'), '# a c5 note\n');
      const rec = fsRecorder(dir, proj, ['.ai/.run/review']);
      const p = kit.apply(proj, ['prepare', '--run-id', 'run-c5-two', '--mode', 'update'], { preload: rec.file });
      check(p.code === 0 && p.json && p.json.ok === true && /^[0-9a-f]{64}$/.test(p.json.planSha256 || ''), 'prepare succeeds under the existing C2 and C3 rules (no lifecycle refusal, exit 0)', { code: p.code, stdout: p.stdout.slice(0, 300) });
      check(rec.hits().length === 0, 'the planted journal and the review directory were skipped before any access', rec.hits().slice(0, 4));
      check(reviewState() === planted, 'the review directory is unchanged by prepare');
      const ctl = fsRecorder(dir, proj, ['.ai/.run/run-c5-two']);
      kit.apply(proj, ['status', '--run-id', 'run-c5-two'], { preload: ctl.file });
      check(ctl.hits().length >= 1, 'control: the same kind of recorder does observe reads of an ordinary run', ctl.hits().length);
    });
  });
}

// ============================================== R92/C5/stdout ====
// Plan 3.9, 3.11 and 4.3 R92/C5/stdout: a stdout review writes nothing and never ingests earlier artifacts; reviewers read the orchestrator's artifact.
async function stdoutGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rv = await loadReview(failures, context);
    if (!rv) return;
    await step('with .ai/.run absent, a stdout review in either mode performs no mkdir, write-open, write, sync or unlink', async () => {
      for (const [label, argv, world] of [['committed', ARGV_C, { invDiff: nul(['src/a.txt']), content: Buffer.from('P\n') }], ['local', ARGV_L, { tree: ['a.txt'], cached: idxBuf(['a.txt']), others: nul(['n.txt']), content: Buffer.from('P\n') }]]) {
        const sw = seamWorld(context, { world });
        sw.vfs.file('n.txt', 'n\n');
        const before = sw.vfs.snapshot();
        const s = await seamReview(rv, context, argv, { fake: sw.fake, seam: sw.seam });
        check(s.r.exitCode === 0, `${label}: the review succeeds`, s.r.stderr);
        check(sw.seam.ops('mkdirSync', 'writeSync', 'fsyncSync', 'unlinkSync').length === 0 && writeOpensOf(sw).length === 0, `${label}: no write operation of any kind`, sw.seam.log.map((e) => e.op));
        check(sw.vfs.snapshot() === before && !sw.vfs.has('.ai'), `${label}: the filesystem is unchanged and .ai was not created`);
      }
    });
    await step('explicit selectors that match the artifact inputs are REVIEW_ARTIFACT_INPUT before any resolution (after the protected-selector check); containing directories and lookalikes stay valid and their artifact descendants are omitted', async () => {
      const bad = ['.ai/.run/review/a.diff', '.ai/.run/review', '.ai/.run/review/sub/x.diff', '.ai/.run/.gitignore', '.AI/.RUN/REVIEW/a.diff', '.ai/.run/review./a.diff', '.ai/.run/.gitignore.', '.ai/.run/.GITIGNORE'];
      for (const sel1 of bad) {
        for (const [mode, argv, seamOpt] of [['committed', RD('--base', 'base-ref', '--head', 'head-ref', '--', sel1), throwingSeam()], ['local', RD('--base', 'base-ref', '--', sel1), undefined]]) {
          const f = makeFake(context, {});
          const s = await seamReview(rv, context, argv, { fake: f, seam: seamOpt });
          expectRes(check, `${mode} selector ${show(sel1)}`, s.r, failRes(E.ARTIFACT_INPUT));
          check(f.calls.length === 2, `${mode} selector ${show(sel1)}: the refusal precedes every resolution`, f.kinds());
        }
      }
      const mixed = await seamReview(rv, context, RD('--base', 'base-ref', '--', 'src', '.ai/.run/review/a.diff'), { world: {} });
      expectRes(check, 'a safe selector next to an artifact selector', mixed.r, failRes(E.ARTIFACT_INPUT));
      const both = await seamReview(rv, context, RD('--base', 'base-ref', '--', '.ai/.run/review/a.diff'), { world: {}, policy: pol2([], [{ anchor: 'root', glob: '.ai/.run/review/**' }]) });
      expectRes(check, 'a selector that is protected and an artifact input is the secret error', both.r, failRes(E.SECRET));
      for (const sel1 of ['.ai', '.ai/.run']) {
        const f = makeFake(context, { invDiff: nul(['.ai/.run/review/x.diff', '.ai/.run/other.txt']), content: Buffer.from('P\n') });
        const s = await seamReview(rv, context, RD('--base', 'base-ref', '--head', 'head-ref', '--', sel1), { fake: f, seam: throwingSeam() });
        expectRes(check, `a containing directory selector ${sel1}`, s.r, { exit: 0, stdout: cat(HDR_C, 'P\n') });
        checkOps(check, `a containing directory selector ${sel1}`, f, OPS_C({ L: sel(sel1), X: E_OF(['.ai/.run/review/x.diff']) }));
      }
      for (const sel1 of ['.ai/.run/reviews', '.ai/.run/review-1', '.ai/.run/gitignore', 'x/.ai/.run/review/a.diff', '.ai/run/review/a.diff']) {
        const f = makeFake(context, {});
        const s = await seamReview(rv, context, RD('--base', 'base-ref', '--head', 'head-ref', '--', sel1), { fake: f, seam: throwingSeam() });
        expectRes(check, `the lookalike selector ${sel1}`, s.r, { exit: 0, stdout: HDR_C });
      }
    });
    await step('regression 1 (local): an earlier artifact that Git reports as untracked (no self-ignore file) is omitted without a body read; regression 2 (committed): a force-tracked artifact is excluded from the content vector and the output', async () => {
      const sw = seamWorld(context, { world: { others: nul(['.ai/.run/review/prev.diff', '.AI/.RUN/REVIEW/Other.diff', 'src/n.txt']) }, files: { '.ai/.run/review/prev.diff': 'PREV-ARTIFACT-MARKER\n', '.AI/.RUN/REVIEW/Other.diff': 'OTHER-ARTIFACT-MARKER\n', 'src/n.txt': 'n\n' } });
      check(!sw.vfs.has('.ai/.run/.gitignore'), 'premise: the self-ignore file is absent, so Git would report the artifact');
      const s = await seamReview(rv, context, ARGV_L, { fake: sw.fake, seam: sw.seam });
      expectRes(check, 'local ingestion regression', s.r, { exit: 0, stdout: cat(HDR_L, refSection({ 'src/n.txt': 'n\n' })) });
      check(!touched(sw).some((n) => /review/i.test(n)), 'no artifact path was examined or opened', touched(sw));
      const fake = makeFake(context, { invDiff: nul(['src/a.txt', '.ai/.run/review/forced.diff']), content: Buffer.from('P\n') });
      const c = await seamReview(rv, context, ARGV_C, { fake, seam: throwingSeam() });
      expectRes(check, 'committed ingestion regression', c.r, { exit: 0, stdout: cat(HDR_C, 'P\n') });
      checkOps(check, 'committed ingestion regression', fake, OPS_C({ X: E_OF(['.ai/.run/review/forced.diff']) }));
    });
    await step('the orchestrator creates an artifact with --out; the reviewer reads it and the header, runs stdout-only reviews, and nothing it touches changes; the artifact bytes equal the stdout bytes', async () => {
      const sw = seamWorld(context, { world: PUB_WORLD });
      const orch = await seamReview(rv, context, ARGV_OUT, { fake: sw.fake, seam: sw.seam });
      expectRes(check, 'orchestrator simulation', orch.r, { exit: 0, stdout: `${OUT}\n` });
      const art = sw.vfs.bytesOf(OUT);
      check(sameBuf(art, WANT_ART), 'the artifact holds the review bytes');
      const first = textOf(art).split('\n')[0];
      check(first === `# review-diff mode=committed-head base=${B1} head=${H2} merge-base=${M3}`, 'the reviewer can record the mode and the resolved IDs from the artifact header', first);
      sw.vfs.file('src/n.txt', 'n\n');
      for (const [label, argv, world] of [['committed', ARGV_C, { ...PUB_WORLD }], ['local, Git reporting the artifact as untracked', ARGV_L, { others: nul([OUT, 'src/n.txt']), content: Buffer.from('P\n') }]]) {
        sw.seam.reset();
        const snap2 = sw.vfs.snapshot();
        const s = await seamReview(rv, context, argv, { fake: makeFake(context, world), seam: sw.seam });
        check(s.r.exitCode === 0 && !textOf(s.r.stdout).includes('+# review-diff'), `${label}: the stdout review succeeds and does not ingest the artifact`, textOf(s.r.stdout).slice(0, 200));
        check(sw.seam.ops('mkdirSync', 'writeSync', 'unlinkSync', 'fsyncSync').length === 0 && writeOpensOf(sw).length === 0, `${label}: the reviewer-side run performs no publication`);
        check(sw.seam.paths('openSync').every((p) => !String(p).endsWith('p.diff')), `${label}: the artifact was not opened by the review`, sw.seam.paths('openSync'));
        check(sw.vfs.snapshot() === snap2, `${label}: the filesystem, including every artifact byte, is unchanged`);
        check(sameBuf(sw.vfs.bytesOf(OUT), WANT_ART), `${label}: the earlier artifact bytes remain unchanged`);
      }
    });
  });
}

// ============================================== the policy consumer matrix ====
// Plan 4.3 R74/C5/corpus and R97/C5/environment-names: each corpus row reaches both review modes as an inventory candidate and as an explicit selector.
const VISIBLE = 'visible-ok.txt';
const DUMMY = Buffer.from('C5-DUMMY-PATCH\n');
const MODES = ['committed', 'tracked', 'untracked', 'selector'];
const placementsOf = (entry) => [['managed patterns', pol2([entry], [])], ['project patterns', pol2([], [entry])]];
// One corpus row in one mode and one placement. isProt is the classification the corpus pins for the name.
// everything: the entry protects every name (the root ** row), so the companion visible name is protected too and no content call can run.
async function runCorpusRow(rv, context, check, label, mode, P, policy, isProt, everything = false) {
  if (mode === 'committed') {
    const fake = makeFake(context, { invDiff: nul([P, VISIBLE]), content: DUMMY });
    const s = await seamReview(rv, context, ARGV_C, { fake, seam: throwingSeam(), policy });
    expectRes(check, `${label} committed`, s.r, { exit: 0, stdout: everything ? HDR_C : cat(HDR_C, DUMMY) });
    check(eq(fake.ops(), everything ? OPS_C({ content: false }) : OPS_C({ X: E_OF(isProt ? [P] : []) })), `${label} committed: ${isProt ? 'the protected name is an exclusion in the content vector' : 'the visible name stays visible (no exclusion)'}`, fake.ops()[4] && fake.ops()[4].slice(-5));
  } else if (mode === 'tracked') {
    const fake = makeFake(context, { tree: [P, VISIBLE], cached: idxBuf([P, VISIBLE]), content: DUMMY });
    const s = await seamReview(rv, context, ARGV_L, { fake, seam: throwingSeam(), policy });
    expectRes(check, `${label} tracked`, s.r, { exit: 0, stdout: everything ? HDR_L : cat(HDR_L, DUMMY) });
    check(eq(fake.ops(), everything ? OPS_L({ diffIndex: false }) : OPS_L({ X: E_OF(isProt ? [P] : []) })), `${label} tracked: ${isProt ? 'the protected name is excluded before diff-index' : 'the visible name is not excluded'}`, fake.ops()[6] && fake.ops()[6].slice(-5));
  } else if (mode === 'untracked') {
    const sw = seamWorld(context, { world: { others: nul([P]) } });
    sw.vfs.file(P, 'u\n');
    const s = await seamReview(rv, context, ARGV_L, { fake: sw.fake, seam: sw.seam, policy });
    checkOpsLoose(check, `${label} untracked`, sw.fake, OPS_L({ diffIndex: false }));
    if (isProt) {
      expectRes(check, `${label} untracked`, s.r, { exit: 0, stdout: HDR_L });
      check(sw.seam.count() === 0, `${label} untracked: a protected name is omitted with no filesystem access`, touched(sw));
    } else if (WIN && P.includes(':')) {
      check(s.r.exitCode === 2 && s.r.stdout.length === 0 && HANDLED.test(s.r.stderr) && sw.seam.ops('openSync').length === 0, `${label} untracked: a ':' component is rejected on Windows before open`, { code: s.r.exitCode, err: s.r.stderr.slice(0, 120) });
    } else expectRes(check, `${label} untracked`, s.r, { exit: 0, stdout: cat(HDR_L, refRender(P, Buffer.from('u\n'))) });
  } else {
    const fake = makeFake(context, {});
    const s = await seamReview(rv, context, RD('--base', 'base-ref', '--', P), { fake, seam: throwingSeam(), policy });
    if (isProt) {
      expectRes(check, `${label} selector`, s.r, failRes(E.SECRET));
      check(fake.calls.length === 2, `${label} selector: the secret error precedes every resolution`, fake.kinds());
    } else {
      expectRes(check, `${label} selector`, s.r, { exit: 0, stdout: HDR_L });
      check(eq(fake.ops(), OPS_L({ L: sel(P), diffIndex: false })), `${label} selector: the visible name is a literal selector`, fake.ops().slice(4).map((o) => o.slice(-2)));
    }
  }
}
function checkOpsLoose(check, label, fake, expected) {
  check(eq(fake.ops(), expected), `${label}: the operation vectors`, { got: fake.ops().map((g) => g.slice(0, 8)), want: expected.map((g) => g.slice(0, 8)) });
}
async function matrix(rv, context, check, rows, modes = MODES) {
  let n = 0;
  for (const row of rows) {
    for (const [where, policy] of placementsOf(row.entry)) {
      for (const mode of modes) { await runCorpusRow(rv, context, check, `${row.id} ${where}`, mode, row.path, policy, row.expected, row.entry.glob === '**'); n++; }
    }
  }
  return n;
}
function loadCorpus(check, context) {
  const c = readJson(CORPUS_FILE(context));
  if (!c || !Array.isArray(c.matches) || !Array.isArray(c.rejectedEntries)) { check(false, 'tests/fixtures/security-policy-corpus.json is readable'); return null; }
  return c;
}

// ============================================== R74/C5/corpus ====
async function corpusGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rv = await loadReview(failures, context);
    if (!rv) return;
    const corpus = loadCorpus(check, context);
    if (!corpus) return;
    check(corpus.matches.length === 78 && corpus.rejectedEntries.length === 27, 'the shared corpus has 78 matching rows and 27 rejected entries', { matches: corpus.matches.length, rejected: corpus.rejectedEntries.length });
    await step('all 78 matching rows, in managed and project patterns, through committed inventories, tracked (M tree and index) names, untracked names and explicit selectors', async () => {
      const n = await matrix(rv, context, check, corpus.matches);
      check(n === 78 * 2 * 4, 'every row ran in both placements and all four routes', n);
    });
    await step('the 27 rejected entries fail an installed schema-2 policy with the corpus code and the location rewritten, in both modes, before any resolution or content operation', async () => {
      for (const row of corpus.rejectedEntries) {
        for (const [where, loc, policy] of [['patterns', 'patterns[0]', pol2([row.entry], [])], ['projectPatterns', 'projectPatterns[0]', pol2([], [row.entry])]]) {
          const message = row.message.replace('entry.', `${loc}.`);
          for (const [mode, argv, seamOpt] of [['committed', ARGV_C, throwingSeam()], ['local', ARGV_L, undefined]]) {
            const f = makeFake(context, {});
            const s = await seamReview(rv, context, argv, { fake: f, policy, seam: seamOpt });
            expectRes(check, `${row.id} in ${where} (${mode})`, s.r, failRes(message));
            check(f.calls.length === 2 && codeOf(message) === row.code, `${row.id} in ${where} (${mode}): no resolution or content operation follows the policy rejection`, f.kinds());
          }
        }
      }
    });
    await step('a malformed installed policy retains the C1 errors and a missing or unreadable one is the policy-IO error; none reaches resolution', async () => {
      const marker = 'C5-LEAK-MARKER';
      const withMarker = (o) => jsonText({ ...o, note: marker });
      const cases = [
        ['invalid JSON', { policyText: `{ not json ${marker}` }, 'POLICY_JSON: policy text must be valid JSON'], ['invalid UTF-8', { policyBuf: Buffer.concat([Buffer.from('{"schema":2,"note":"'), Buffer.from([0xff, 0xfe]), Buffer.from('"}')]) }, 'POLICY_JSON: policy text must be valid JSON'],
        ['an array root', { policyText: `[${JSON.stringify(marker)}]` }, 'POLICY_ROOT: policy must be a JSON object'], ['schema 3', { policyText: withMarker({ schema: 3, patterns: [], projectPatterns: [] }) }, 'POLICY_SCHEMA: policy.schema must be 1 or 2'],
        ['missing patterns', { policyText: withMarker({ schema: 2, projectPatterns: [] }) }, 'POLICY_PATTERNS: policy.patterns must be an array'], ['missing projectPatterns', { policyText: withMarker({ schema: 2, patterns: [] }) }, 'POLICY_PROJECT_PATTERNS: policy.projectPatterns must be an array'],
        ['an entry that is not an object', { policyText: jsonText({ schema: 2, patterns: [5], projectPatterns: [] }) }, 'POLICY_ENTRY: patterns[0] must be an object'], ['an entry without a glob', { policyText: jsonText({ schema: 2, patterns: [], projectPatterns: [{ anchor: 'any' }] }) }, 'POLICY_GLOB: projectPatterns[0].glob must be a nonempty string'],
        ['an unknown anchor', { policyText: jsonText({ schema: 2, patterns: [{ anchor: 'sometimes', glob: '**/x' }], projectPatterns: [] }) }, 'POLICY_ANCHOR: patterns[0].anchor must be "any" or "root"'],
        ['a missing file', { readFile: async () => { throw Object.assign(new Error(`ENOENT ${marker}`), { code: 'ENOENT' }); } }, E.POLICY_IO], ['an unreadable file', { readFile: async () => { throw Object.assign(new Error(`EACCES ${marker}`), { code: 'EACCES' }); } }, E.POLICY_IO],
        ['a string result', { readFile: async () => jsonText(DEFAULT_POLICY) }, E.POLICY_IO],
      ];
      for (const [label, o, message] of cases) {
        for (const [mode, argv, seamOpt] of [['committed', ARGV_C, throwingSeam()], ['local', ARGV_L, undefined]]) {
          const f = makeFake(context, {});
          const s = await seamReview(rv, context, argv, { fake: f, seam: seamOpt, ...o });
          expectRes(check, `${label} (${mode})`, s.r, failRes(message));
          check(f.calls.length === 2 && !s.r.stderr.includes(marker), `${label} (${mode}): nothing follows and the raw policy is never echoed`, f.kinds());
        }
      }
    });
    await step('the installed trusted policy governs, not a policy file in the reviewed commit: no vector reads the policy path and an empty installed policy protects nothing', async () => {
      const f = makeFake(context, { invDiff: nul(['.ai/security-paths.json', '.env']), content: Buffer.from('P\n') });
      const s = await seamReview(rv, context, ARGV_C, { fake: f, seam: throwingSeam(), policy: pol2([], []) });
      expectRes(check, 'an explicitly empty installed policy', s.r, { exit: 0, stdout: cat(HDR_C, 'P\n') });
      checkOps(check, 'an explicitly empty installed policy', f, OPS_C({ X: E_OF() }));
      check(eq(s.reads, [path.join(f.paths.root, '.ai', 'security-paths.json')]), 'the policy was read once, from the native root path', s.reads);
    });
  });
}

// ============================================== R97/C5/environment-names ====
async function environmentNames(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rv = await loadReview(failures, context);
    if (!rv) return;
    const corpus = loadCorpus(check, context);
    if (!corpus) return;
    const rows = corpus.matches.filter((r) => r.id.startsWith('E'));
    check(rows.length === 19 && rows.every((r) => eq(r.entry, { anchor: 'any', glob: '**/.env*' })), 'the environment-name rows are E01-E19, all with the any-depth **/.env* entry', rows.map((r) => r.id));
    await step('E01-E19 through committed, tracked, untracked and selector routes in managed and project placements', async () => {
      const n = await matrix(rv, context, check, rows);
      check(n === 19 * 2 * 4, 'every environment row ran in both placements and all four routes', n);
    });
    await step('there is no template exception: .env.example, .env.sample and .env.template are excluded or refused like any other name; root and nested spellings and case variants are covered', async () => {
      const policy = pol2([{ anchor: 'any', glob: '**/.env*' }], []);
      const extra = ['.env', '.env.example', '.env.sample', '.env.template', '.envrc', '.env-prod', 'config/.env.example', 'src/deep/.env-prod', 'SRC/.ENVRC', 'src/.EnV.ExAmPlE', '.ENV.EXAMPLE'];
      for (const p of extra) for (const mode of MODES) await runCorpusRow(rv, context, check, `template ${show(p)}`, mode, p, policy, true);
      for (const p of ['env', 'dotenv', 'x.env', '.en', '.envdir/file.txt']) for (const mode of MODES) await runCorpusRow(rv, context, check, `visible ${show(p)}`, mode, p, policy, false);
    });
  });
}

// ============================================== R76/C5/arguments ====
// Plan 2.2, 2.6, 3.1, 3.4-3.6, 3.13, 4.3 R76/C5/arguments: the exact public surface, the grammar, every Git vector and the argument bound.
// The smallest filler such that the vector has exactly `target` units; `extra` appends one more one-character selector to move the parity (plan 3.4).
function findPad(build, target) {
  for (const extra of [false, true]) {
    const units = (n) => argvUnits([...PREFIX, ...build('p'.repeat(n), extra)]);
    const u0 = units(0);
    const n = (target - u0) / (units(1) - u0);
    if (Number.isInteger(n) && n >= 0) return { pad: 'p'.repeat(n), extra };
  }
  return null;
}
async function argumentsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rv = await loadReview(failures, context);
    const core = await loadCore(failures, context);
    if (!rv || !core) return;
    const cases = loadCases(check, context);
    await step('the exact public surface: import safety, four exports, the form string, the C4 core unchanged apart from the command diagnostic', async () => {
      await withScratch(context, 'imp', async (dir) => { checkImportSafe(check, REVIEW_REL, context, dir, assetUrl(context, REVIEW_REL), REVIEW_EXPORTS); });
      check(rv.REVIEW_FORM === REVIEW_FORM && typeof rv.parseReviewArgs === 'function' && typeof rv.defaultReviewArtifactPath === 'function' && typeof rv.reviewMain === 'function', 'REVIEW_FORM is the pinned string and the three functions exist', rv.REVIEW_FORM);
      check(eq(sorted(Object.keys(core)), sorted(CORE_EXPORTS)), 'C5 adds no export to the C4 core (the nine exports remain)', Object.keys(core));
      check(Object.isFrozen(core.SUPPORTED_FORMS) && eq(sorted(Object.keys(core.SUPPORTED_FORMS)), sorted(COMMANDS)) && eq({ ...core.SUPPORTED_FORMS }, SUPPORTED_FORMS), 'the six-command maps are unchanged', core.SUPPORTED_FORMS);
      check(eq(sorted(Object.keys(core.NARROWING_GUIDANCE)), sorted(COMMANDS)) && core.NARROWING_GUIDANCE.show === 'Narrow with -- <paths>.', 'the narrowing guidance keeps its six entries', core.NARROWING_GUIDANCE);
      for (const argv of [[], ['status'], ['review-diff', '--base', 'x'], ['DIFF', 'a..b'], ['--version']]) await expectErr(check, `C4's parser with ${show(argv)}`, () => core.parseGitSafeArgs(argv), E.COMMAND);
      for (const argv of [['status'], [], [''], ['diff', 'a..b']]) await expectErr(check, `parseReviewArgs(${show(argv)})`, () => rv.parseReviewArgs(argv), E.COMMAND);
      const s = await seamReview(rv, context, ['status'], { world: {} });
      expectRes(check, 'reviewMain with another command', s.r, failRes(E.COMMAND));
      check(s.fake.calls.length === 0, 'a wrong command makes no Git call');
      const fake = makeFake(context, {});
      const session = await core.createGitSession({ cwd: fake.paths.start, env: SEAM_ENV, execute: fake.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      await expectErr(check, 'a hand-built review-diff request', () => core.executeGitSafe({ subcommand: 'review-diff', revisions: ['a'], paths: [], format: 'patch', patch: true, maxCount: null, pattern: null }, session), E.INPUT);
    });
    await step('registration: COMPONENT_ASSERTIONS.C5 is the eighteen descriptors of plan 4.1 in order, written independently, and COMPONENT_IMPLEMENTATIONS.C5 holds exactly the descriptor objects of C5_IMPLEMENTATIONS', async () => {
      const rc = await needSibling(failures, 'rc1-cases.mjs');
      if (!rc) return;
      const exp = rc.COMPONENT_ASSERTIONS && rc.COMPONENT_ASSERTIONS.C5;
      check(Array.isArray(exp) && eq(JSON.parse(JSON.stringify(exp)), EXPECTED_DESCRIPTORS) && deepFrozen(exp), 'COMPONENT_ASSERTIONS.C5 is the eighteen descriptors, in order, deep-frozen', exp);
      const impls = rc.COMPONENT_IMPLEMENTATIONS && rc.COMPONENT_IMPLEMENTATIONS.C5;
      check(Array.isArray(impls) && Object.isFrozen(impls) && impls.length === C5_IMPLEMENTATIONS.length && impls.every((x, i) => x === C5_IMPLEMENTATIONS[i]), 'COMPONENT_IMPLEMENTATIONS.C5 is a frozen array of the C5_IMPLEMENTATIONS objects, in order', impls && impls.length);
      check(Object.isFrozen(C5_IMPLEMENTATIONS) && eq(C5_IMPLEMENTATIONS.map((x) => x.id), EXPECTED_DESCRIPTORS.map((d) => d.id)) && C5_IMPLEMENTATIONS.every((x) => typeof x.run === 'function' && Object.isFrozen(x)), 'C5_IMPLEMENTATIONS is a frozen array of the eighteen IDs with callable run functions');
      const calls = [];
      const ret = rc.registerRc1Cases((...a) => calls.push(a), { repository: context.repository });
      check(calls.length === 0 && (ret === undefined || (ret && typeof ret.then === 'function')), 'registerRc1Cases still registers no complete numbered case', calls.length);
      check(!rc.REQUIRED_CASE_IDS.some((x) => x.includes('/C5/')) && rc.BASELINE_CASE_IDS.length === 60 && rc.RC1_CASE_IDS.length === 40, 'the complete-case inventories are untouched', { baseline: rc.BASELINE_CASE_IDS.length, rc1: rc.RC1_CASE_IDS.length });
    });
    await step('the grammar table of the fixture: accepted rows give the exact result, refused rows the exact error and no filesystem or Git work; options in any order; duplicates; value tokens; literal paths', async () => {
      if (!cases) return;
      const E_OF_KIND = { ARGUMENT: E.ARGUMENT, OUT: E.OUT, COMMAND: E.COMMAND, INPUT: E.INPUT };
      for (const row of cases.grammar) {
        if (hasOwn(row, 'result')) {
          const r = await attempt(() => rv.parseReviewArgs(row.argv));
          check(!r.threw && eq(r.value, row.result) && eq(sorted(Object.keys(r.value)), ['base', 'head', 'out', 'paths']), `${row.id}: accepted with the exact result`, r.threw ? errMsg(r.error) : r.value);
          if (!r.threw) check(eq(rv.parseReviewArgs(row.argv), r.value) && Object.getPrototypeOf(r.value) === Object.prototype && Array.isArray(r.value.paths), `${row.id}: deterministic plain result`);
        } else await expectErr(check, `${row.id} ${show(row.argv).slice(0, 80)}`, () => rv.parseReviewArgs(row.argv), E_OF_KIND[row.error]);
      }
      const frozen = Object.freeze(['review-diff', '--base', 'a', '--', 'p']);
      check(eq(rv.parseReviewArgs(frozen).paths, ['p']), 'a frozen argv is accepted and not mutated');
      const sparse = new Array(3); sparse[0] = 'review-diff'; sparse[2] = 'x';
      for (const [label, v] of [['undefined', undefined], ['null', null], ['a string', 'review-diff'], ['an object', {}], ['a number element', ['review-diff', 1]], ['a null element', ['review-diff', null]], ['an undefined element', ['review-diff', undefined]], ['a nested array', [['review-diff']]], ['a sparse array', sparse], ['a String object element', [new String('review-diff')]], ['a number', 5], ['a function', () => []]]) {
        await expectErr(check, `INPUT for ${label}`, () => rv.parseReviewArgs(v), E.INPUT);
      }
      // through reviewMain: argument failures happen before any session, Git call, filesystem call or policy read
      for (const row of cases.grammar.filter((r) => hasOwn(r, 'error')).slice(0, 40)) {
        const fake = makeFake(context, {});
        const seam = throwingSeam();
        const s = await seamReview(rv, context, row.argv, { fake, seam });
        expectRes(check, `reviewMain ${row.id}`, s.r, failRes(E_OF_KIND[row.error]));
        check(fake.calls.length === 0 && seam.count() === 0 && s.reads.length === 0, `reviewMain ${row.id}: arguments are parsed before any dependency call`, { git: fake.calls.length, fs: seam.count(), reads: s.reads.length });
      }
    });
    await step('dependency keys: only cwd, env, execute, readFile and fs; every invalid shape is GIT_SAFE_INPUT before any dependency call; argument errors win over dependency errors; non-review commands accept no fs key', async () => {
      const fake0 = makeFake(context, { invDiff: nul(['a.txt']) });
      const seam0 = vfsSeam(makeVfs(fake0.paths.root), { plain: true });
      const reads = [];
      const good = { cwd: fake0.paths.start, env: SEAM_ENV, execute: fake0.execute, readFile: async (p) => { reads.push(p); return bytes(jsonText(DEFAULT_POLICY)); }, fs: seam0.fs };
      const ten = (drop) => { const o = { ...seam0.fs }; if (drop) delete o[drop]; return o; };
      const bads = [
        ['an unknown key', { ...good, shell: true }], ['a relative cwd', { ...good, cwd: 'rel/dir' }], ['an empty cwd', { ...good, cwd: '' }], ['a numeric cwd', { ...good, cwd: 5 }], ['a non-string env value', { ...good, env: { PATH: 5 } }],
        ['an env array', { ...good, env: [] }], ['a string execute', { ...good, execute: 'git' }], ['a numeric readFile', { ...good, readFile: 5 }], ['a string fs', { ...good, fs: 'node:fs' }], ['an array fs', { ...good, fs: [] }], ['a null fs', { ...good, fs: null }],
        ['a missing fs method (unlinkSync)', { ...good, fs: ten('unlinkSync') }], ['a missing fs method (openSync)', { ...good, fs: ten('openSync') }], ['a non-function fs method', { ...good, fs: { ...ten(), closeSync: 5 } }],
        ['an fs holding only some methods', { ...good, fs: { lstatSync: () => null } }], ['an empty fs object', { ...good, fs: {} }],
      ];
      for (const [label, deps] of bads) {
        const before = fake0.calls.length + reads.length + seam0.count();
        const r = await rv.reviewMain(ARGV_C, deps);
        expectRes(check, `reviewMain with ${label}`, r, failRes(E.INPUT));
        check(fake0.calls.length + reads.length + seam0.count() === before, `reviewMain with ${label}: no dependency was called`, { calls: fake0.calls.length, reads: reads.length });
      }
      for (const d of [null, 5, 'x', []]) expectRes(check, `reviewMain with dependencies ${show(d)}`, await rv.reviewMain(ARGV_C, d), failRes(E.INPUT));
      expectRes(check, 'an argument error beats a dependency error', await rv.reviewMain(RD('--base'), { ...good, shell: true }), failRes(E.ARGUMENT));
      expectRes(check, 'an output error beats a dependency error', await rv.reviewMain(RD('--base', 'a', '--out', 'bad'), { ...good, shell: true }), failRes(E.OUT));
      const ok = await rv.reviewMain(ARGV_C, { ...good, fs: ten() });
      check(ok.exitCode === 0, 'control: exactly the ten methods plus the four other keys is accepted', ok.stderr);
      for (const [label, argv] of [['a success', ARGV_C], ['an argument failure', RD('--base')], ['a Git failure', RD('--base', 'a', '--head', 'b', '--out', '.ai/.run/review/x.diff')]]) {
        const g = await withStreamGuard(() => rv.reviewMain(argv, { ...good, fs: ten(), execute: label === 'a Git failure' ? async () => ({ status: 128, signal: null, error: null, stdout: EMPTY, overflow: false }) : good.execute }));
        check(g.threw === null && g.out.length === 0 && g.err.length === 0 && g.exits.length === 0 && !g.exitCodeChanged, `reviewMain never writes a process stream or sets exit state (${label})`, { out: g.out.length, err: g.err.length, exits: g.exits, threw: g.threw && errMsg(g.threw) });
      }
      const via = await core.main(ARGV_C, { cwd: fake0.paths.start, env: SEAM_ENV, execute: makeFake(context, { invDiff: nul(['a.txt']) }).execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)) });
      const direct = await seamReview(rv, context, ARGV_C, { world: { invDiff: nul(['a.txt']) } });
      check(via.exitCode === 0 && sameBuf(via.stdout, direct.r.stdout) && via.stderr === direct.r.stderr, 'the C4 main delegates review-diff to the helper and returns its exact result', { via: via.stdout.length, direct: direct.r.stdout.length });
      const noFs = await core.main(['ls', 'c4-head'], { cwd: fake0.paths.start, env: SEAM_ENV, execute: fake0.execute, readFile: good.readFile, fs: seam0.fs });
      expectRes(check, 'a non-review command with an fs key', noFs, failRes(E.INPUT));
      const str = await core.main('review-diff', { cwd: fake0.paths.start, env: SEAM_ENV, execute: fake0.execute, readFile: good.readFile });
      expectRes(check, 'main with a string container', str, failRes(E.INPUT));
      const unk = await core.main(ARGV_C, { cwd: fake0.paths.start, env: SEAM_ENV, execute: fake0.execute, readFile: good.readFile, other: 1 });
      expectRes(check, 'main review-diff with an unknown key', unk, failRes(E.INPUT));
    });
    await step('every Git vector, in both modes, with the fixed prefix, resolved IDs, original-spelling literal selectors and the single sorted exclusion list; no magic expansion and no positive safe-name expansion', async () => {
      const selArgs = ['src', 'Docs/ReadMe.md', 'a*', 'a?', ':(glob)x', '--', '-dash', 'src', 'MixedCase.TXT'];
      const wantL = sel('src', 'Docs/ReadMe.md', 'a*', 'a?', ':(glob)x', '--', '-dash', 'MixedCase.TXT');
      const names = ['src/a.txt', 'src/.Env.local', 'Docs/ReadMe.md', 'a*/.env', '-dash/.env.x', 'other/.env', 'MixedCase.TXT/.ENV', ':(glob)x/ok.txt'];
      const selectedProtected = ['src/.Env.local', 'a*/.env', '-dash/.env.x', 'MixedCase.TXT/.ENV'];
      const c = makeFake(context, { invDiff: nul(names), content: Buffer.from('P\n') });
      const sc = await seamReview(rv, context, RD('--base', 'base-ref', '--head', 'head-ref', '--', ...selArgs), { fake: c, seam: throwingSeam() });
      expectRes(check, 'committed with selectors', sc.r, { exit: 0, stdout: cat(HDR_C, 'P\n') });
      checkOps(check, 'committed with selectors', c, OPS_C({ L: wantL, X: E_OF(selectedProtected) }));
      const l = makeFake(context, { tree: names, cached: idxBuf(names), content: Buffer.from('P\n') });
      const sl = await seamReview(rv, context, RD('--base', 'base-ref', '--', ...selArgs), { fake: l });
      expectRes(check, 'local with selectors', sl.r, { exit: 0, stdout: cat(HDR_L, 'P\n') });
      checkOps(check, 'local with selectors', l, OPS_L({ L: wantL, X: E_OF(selectedProtected) }));
      const safe = Array.from({ length: 5000 }, (_, i) => `docs/safe-file-${i}-${'y'.repeat(40)}.txt`);
      const many = makeFake(context, { invDiff: nul(safe), content: Buffer.from('MANY\n') });
      const sm = await seamReview(rv, context, ARGV_C, { fake: many, seam: throwingSeam() });
      expectRes(check, 'many safe names', sm.r, { exit: 0, stdout: cat(HDR_C, 'MANY\n') });
      check(eq(many.ops()[4], V_DIFF_C(M3, H2, [], E_OF())) && !many.ops()[4].some((a) => a.startsWith(':(literal)')), 'safe names are never expanded into positive pathspecs', many.ops()[4] && many.ops()[4].slice(-4));
      const env = { ...SEAM_ENV, git_pager: 'x', GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'diff.external', GIT_CONFIG_VALUE_0: '/bad', Git_Literal_Pathspecs: '1', GIT_ICASE_PATHSPECS: '1', Pager: 'more', git_index_file: '/other.index', GIT_OPTIONAL_LOCKS: '1' };
      const e = makeFake(context, { invDiff: nul(['a.txt']), tree: ['a.txt'], cached: idxBuf(['a.txt']) });
      const snap = clone(env);
      await seamReview(rv, context, ARGV_L, { fake: e, env });
      checkCalls(check, 'injected environment', e, { env });
      check(eq(env, snap), 'the caller environment object is not mutated');
    });
    await step('the argument bound: exactly 24000 units pass and 24001 fail with the exact error before any process, in both modes; the narrowed request can avoid it', async () => {
      const cases2 = [
        ['committed', (pad, extra) => V_DIFF_C(M3, H2, sel(pad, ...(extra ? ['q'] : [])), E_OF()), (pad, extra) => RD('--base', 'base-ref', '--head', 'head-ref', '--', pad, ...(extra ? ['q'] : [])), (pad) => ({ invDiff: nul([`${pad}/x.txt`]), content: Buffer.from('FIT\n') }), true],
        ['local', (pad, extra) => V_DI(M3, sel(pad, ...(extra ? ['q'] : [])), E_OF()), (pad, extra) => RD('--base', 'base-ref', '--', pad, ...(extra ? ['q'] : [])), (pad) => ({ tree: [`${pad}/x.txt`], cached: idxBuf([`${pad}/x.txt`]), content: Buffer.from('FIT\n') }), false],
      ];
      for (const [label, build, argvOf, worldOf, isC] of cases2) {
        const at = findPad(build, MAX_UNITS);
        const over = findPad(build, MAX_UNITS + 1);
        check(at !== null && over !== null, `${label}: premise: vectors of exactly 24000 and 24001 units exist`, { at: !!at, over: !!over });
        if (at) {
          const f = makeFake(context, worldOf(at.pad));
          const s = await seamReview(rv, context, argvOf(at.pad, at.extra), { fake: f, seam: isC ? throwingSeam() : undefined });
          expectRes(check, `${label} at exactly 24000 units`, s.r, { exit: 0, stdout: cat(isC ? HDR_C : HDR_L, 'FIT\n') });
          check(f.calls.some((x) => CONTENT_KINDS.includes(x.kind) && argvUnits(x.argv) === MAX_UNITS), `${label}: the executor received the 24000-unit call`, f.calls.map((x) => argvUnits(x.argv)));
        }
        if (over) {
          const f = makeFake(context, worldOf(over.pad));
          const s = await seamReview(rv, context, argvOf(over.pad, over.extra), { fake: f, seam: isC ? throwingSeam() : undefined });
          expectRes(check, `${label} at 24001 units`, s.r, failRes(E.ARG_LIMIT));
          check(f.calls.every((x) => argvUnits(x.argv) <= MAX_UNITS) && !f.kinds().some((k) => CONTENT_KINDS.includes(k)), `${label}: no oversized and no content call reached the executor`, f.calls.map((x) => argvUnits(x.argv)));
        }
      }
    });
    await step('the production runtime catalog lists four members in the pinned order and the helper source exists; the installed unit works through the real CLI with and without its helper', async () => {
      const catalog = readJson(path.join(context.skillRoot, 'data', 'runtime-units.json'));
      const unit = (source, target, role) => ({ source, target, role, policySchemas: [1, 2] });
      check(eq(catalog, { schema: 1, units: [unit('assets/tools/security-policy.mjs', '.ai/tools/security-policy.mjs', 'helper'), unit('assets/tools/git-safe-core.mjs', '.ai/tools/git-safe-core.mjs', 'helper'), unit(REVIEW_REL, '.ai/tools/review-diff.mjs', 'helper'), unit('assets/tools/git-safe.mjs', '.ai/tools/git-safe.mjs', 'entrypoint')] }), 'data/runtime-units.json is exactly the four-member catalog: policy helper, core, review helper, entrypoint', catalog);
      check(readBytes(path.join(context.skillRoot, ...REVIEW_REL.split('/'))) !== null, `${REVIEW_REL} exists`);
      await installedCli(context, failures, check, 'complete');
    });
  });
}
// The installed CLI over a real repository (plan 4.3 R76/C5/failures, R76/C5/arguments): a unit without the review helper, then the complete unit.
async function installedCli(context, failures, check, phase) {
  let e;
  try { e = await getE(context); } catch (err) { failures.push(`cannot build the embedded repository fixture: ${errMsg(err)}`); return; }
  const root = path.join(scratchDir(context, 'cli'), 'repo');
  cloneTree(e.root, root);
  const tools = path.join(root, '.ai', 'tools');
  const copy = (rel) => { const b = readBytes(path.join(context.skillRoot, ...rel.split('/'))); if (b === null) { check(false, `cannot read ${rel}`); return false; } putFile(path.join(tools, path.basename(rel)), b); return true; };
  if (![POLICY_REL, CORE_REL, ENTRY_REL].every(copy)) return;
  putFile(path.join(root, '.ai', 'security-paths.json'), jsonText(PL));
  const head = gitOk(context, root, ['rev-parse', 'HEAD']).text;
  const cli = (args, cwd = root) => execNode(context, { cwd, script: path.join(tools, 'git-safe.mjs'), args });
  if (phase === 'missing') {
  const missing = cli(RD('--base', 'HEAD', '--head', 'HEAD'));
  check(missing.dead === null && missing.code === 2 && missing.stdout === '' && missing.stderr === stderrLine(E.INTERNAL), 'a unit missing only review-diff.mjs: review-diff is GIT_SAFE_INTERNAL (exit 2, empty stdout, the standard diagnostic)', { code: missing.code, out: missing.stdout.slice(0, 100), err: missing.stderr.slice(0, 200) });
  const cat1 = cli(['cat', 'HEAD', '--', 'a.txt']);
  check(cat1.dead === null && cat1.code === 0 && cat1.stdout === 'a\n' && cat1.stderr === '', 'an original command (cat) still works without the helper', { code: cat1.code, out: cat1.stdout.slice(0, 80), err: cat1.stderr.slice(0, 200) });
  const ls1 = cli(['ls', 'HEAD']);
  check(ls1.dead === null && ls1.code === 0 && ls1.stdout === 'a.txt\0' && ls1.stderr === '', 'ls still works without the helper', { code: ls1.code, out: ls1.stdout.slice(0, 80) });
  return;
  }
  if (!copy(REVIEW_REL)) return;
  const full = cli(RD('--base', 'HEAD', '--head', 'HEAD'));
  check(full.dead === null && full.code === 0 && full.stdout === hdr(MODE_C, head, head, head) && full.stderr === '', 'with the complete unit the installed CLI dispatches review-diff and prints the header', { code: full.code, out: full.stdout.slice(0, 200), err: full.stderr.slice(0, 200) });
  fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
  const art = cli(RD('--base', 'HEAD', '--head', 'HEAD', '--out', '.ai/.run/review/cli.diff'), path.join(root, 'sub'));
  check(art.dead === null && art.code === 0 && art.stdout === '.ai/.run/review/cli.diff\n' && art.stderr === '' && sameBytes(readBytes(path.join(root, '.ai', '.run', 'review', 'cli.diff')), Buffer.from(hdr(MODE_C, head, head, head))), 'from a subdirectory the CLI creates the artifact under the root and prints the root-relative path', { code: art.code, out: art.stdout.slice(0, 200), err: art.stderr.slice(0, 200) });
  const again = cli(RD('--base', 'HEAD', '--head', 'HEAD', '--out', '.ai/.run/review/cli.diff'));
  check(again.code === 2 && again.stdout === '' && again.stderr === stderrLine(E.EXISTS), 'a second creation of the same artifact is REVIEW_EXISTS through the CLI', { code: again.code, err: again.stderr.slice(0, 200) });
  const bad = cli(RD('--base'));
  check(bad.code === 2 && bad.stdout === '' && bad.stderr === stderrLine(E.ARGUMENT), 'a grammar error through the CLI is the exact argument line', { code: bad.code, err: bad.stderr.slice(0, 200) });
}

// ============================================== R76/C5/failures ====
const LEAK = 'C5-LEAK-MARKER';
async function failuresGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rv = await loadReview(failures, context);
    if (!rv) return;
    const world = (extra = {}) => ({ invDiff: nul(['a.txt']), tree: ['a.txt'], cached: idxBuf(['a.txt']), others: nul(['u.txt']), content: Buffer.from('P\n'), ...extra });
    const go = async (mode, o = {}) => {
      const sw = seamWorld(context, { world: world(o.world), files: { 'u.txt': 'u\n' } });
      const argv = mode === 'committed' ? ARGV_C : ARGV_L;
      const s = await seamReview(rv, context, argv, { fake: sw.fake, seam: mode === 'committed' ? throwingSeam() : sw.seam, ...o.deps });
      return { s, sw, fake: sw.fake };
    };
    await step('Git below 2.31, a failing version command, root failures: the exact line, nothing later, no policy read', async () => {
      for (const v of ['git version 2.30.9\n', 'git version 2.30.9.windows.1\n', 'git version 1.99.0\n', 'garbage\n', '', 'git version 2.31.0', Buffer.from([0x67, 0x69, 0x74, 0x20, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f, 0x6e, 0x20, 0x32, 0x2e, 0x33, 0x31, 0xff, 0x0a])]) {
        for (const mode of ['committed', 'local']) {
          const r = await go(mode, { world: { version: v } });
          expectRes(check, `version ${show(Buffer.isBuffer(v) ? 'bytes' : v).slice(0, 40)} (${mode})`, r.s.r, failRes(E.VERSION));
          check(r.fake.calls.length === 1 && r.s.reads.length === 0, `version refusal (${mode}): no root lookup, no policy read, no later call`, { calls: r.fake.calls.length, reads: r.s.reads.length });
        }
      }
      for (const v of ['git version 2.31.0\n', 'git version 2.53.0.windows.2\r\n', 'git version 3.0.0\n']) {
        const r = await go('committed', { world: { version: v } });
        check(r.s.r.exitCode === 0, `version ${show(v)} is accepted`, r.s.r.stderr);
      }
      for (const [label, res] of [['a nonzero version status', bad(1, LEAK)], ['a spawn failure', { status: null, signal: null, error: 'ENOENT', stdout: EMPTY, overflow: false }]]) {
        const r = await go('committed', { world: { version: res } });
        expectRes(check, label, r.s.r, failRes(E.GIT));
        check(r.fake.calls.length === 1, `${label}: nothing follows`);
      }
      const s0 = await go('local', { world: { root: bad(128, LEAK) } });
      expectRes(check, 'a failing root lookup', s0.s.r, failRes(E.REPOSITORY));
      check(s0.s.reads.length === 0 && s0.fake.calls.length === 2, 'no policy read follows a root failure', s0.fake.kinds());
      for (const [label, out] of [['empty output', ''], ['a relative path', 'relative/dir\n'], ['an embedded LF', 'abc\ndef\n'], ['whitespace only', '   \n']]) {
        const r = await go('local', { world: { root: out } });
        expectRes(check, `root output: ${label}`, r.s.r, failRes(E.REPOSITORY));
      }
    });
    await step('revisions: a missing or non-commit base or head is REVISION and stops there; malformed resolution output is a record failure', async () => {
      for (const mode of ['committed', 'local']) {
        const baseMissing = await go(mode, { world: { missing: new Set(['base-ref']) } });
        expectRes(check, `a missing base (${mode})`, baseMissing.s.r, failRes(E.REVISION));
        check(baseMissing.fake.calls.length === 3, `a missing base (${mode}): the head is not resolved`, baseMissing.fake.kinds());
        const headMissing = await go(mode, { world: { missing: new Set([mode === 'committed' ? 'head-ref' : 'HEAD']) } });
        expectRes(check, `a missing head (${mode})`, headMissing.s.r, failRes(E.REVISION));
        check(headMissing.fake.calls.length === 4, `a missing head (${mode}): no merge-base follows`, headMissing.fake.kinds());
        for (const [label, out] of [['no terminator', B1], ['uppercase', `${'A'.repeat(40)}\n`], ['39 digits', `${'1'.repeat(39)}\n`], ['two lines', `${B1}\n${B1}\n`], ['empty', ''], ['text', 'not an id\n']]) {
          const r = await go(mode, { world: { resolveOut: () => out } });
          expectRes(check, `resolution output ${label} (${mode})`, r.s.r, failRes(E.RECORD));
          check(r.fake.calls.length === 3, `resolution output ${label} (${mode}): nothing follows`, r.fake.kinds());
        }
      }
    });
    await step('malformed inventories are record failures that emit nothing and start no content operation: unterminated, unsafe names, bad UTF-8, trees, index records and untracked records', async () => {
      const raw = (s) => Buffer.from(s, 'utf8');
      const nameBad = [['a missing terminator', raw('a.txt')], ['a parent segment', raw('../x\0')], ['an absolute path', raw('/abs\0')], ['a backslash', raw('a\\b\0')], ['invalid UTF-8', Buffer.from([0xff, 0x00])], ['a drive path', raw('C:/x\0')], ['a trailing slash', raw('a/\0')]];
      for (const [label, buf] of nameBad) {
        const c = await go('committed', { world: { invDiff: buf } });
        expectRes(check, `committed inventory: ${label}`, c.s.r, failRes(E.RECORD));
        check(!c.fake.kinds().includes('diff'), `committed inventory: ${label}: no content call`, c.fake.kinds());
        if (label !== 'a trailing slash') {
          const o = await go('local', { world: { others: buf } });
          expectRes(check, `untracked inventory: ${label}`, o.s.r, failRes(E.RECORD));
          check(!o.fake.kinds().includes('diffIndex') && o.sw.seam.count() === 0, `untracked inventory: ${label}: no content call and no file read`, o.fake.kinds());
        }
      }
      const idxBad = [
        ['stage 4', raw(`100644 ${OID_A} 4\ta.txt\0`)], ['a bad mode', raw(`100664 ${OID_A} 0\ta.txt\0`)], ['a tree mode', raw(`040000 ${OID_A} 0\ta.txt\0`)], ['an uppercase object ID', raw(`100644 ${'A'.repeat(40)} 0\ta.txt\0`)], ['a short object ID', raw(`100644 ${'a'.repeat(39)} 0\ta.txt\0`)],
        ['no TAB', raw(`100644 ${OID_A} 0 a.txt\0`)], ['an extra field', raw(`100644 ${OID_A} 0 x\ta.txt\0`)], ['a missing stage', raw(`100644 ${OID_A}\ta.txt\0`)], ['a duplicate path and stage', idxBuf(['a.txt', 'a.txt'])], ['a missing terminator', raw(`100644 ${OID_A} 0\ta.txt`)],
        ['an invalid path', raw(`100644 ${OID_A} 0\t../a.txt\0`)], ['invalid UTF-8', Buffer.concat([raw(`100644 ${OID_A} 0\t`), Buffer.from([0xff, 0x00])])], ['a LF-framed record', raw(`100644 ${OID_A} 0\ta.txt\n`)], ['a space instead of a stage', raw(`100644 ${OID_A} x\ta.txt\0`)],
      ];
      for (const [label, buf] of idxBad) {
        const r = await go('local', { world: { cached: buf } });
        expectRes(check, `index record: ${label}`, r.s.r, failRes(E.RECORD));
        check(!r.fake.kinds().includes('diffIndex') && r.sw.seam.count() === 0, `index record: ${label}: no content call and no file read`, r.fake.kinds());
      }
      const okStages = await go('local', { world: { cached: idxBuf([{ path: 'm.txt', stage: 1 }, { path: 'm.txt', stage: 2 }, { path: 'm.txt', stage: 3 }]) } });
      expectRes(check, 'three stages of one path are valid records (then unresolved)', okStages.s.r, failRes(E.UNMERGED));
      for (const [label, buf] of [['an unknown mode', raw(`100664 blob ${OID_BLOB}\ta.txt\0`)], ['a tree entry', raw(`040000 tree ${OID_BLOB}\ta.txt\0`)], ['a missing terminator', raw(`100644 blob ${OID_BLOB}\ta.txt`)], ['an invalid path', raw(`100644 blob ${OID_BLOB}\t../a.txt\0`)]]) {
        const r = await go('local', { world: { treeBuf: buf } });
        expectRes(check, `tree record: ${label}`, r.s.r, failRes(E.RECORD));
        check(!r.fake.kinds().includes('diffIndex'), `tree record: ${label}: no content call`, r.fake.kinds());
      }
    });
    await step('nonzero status of any metadata or content call, executor rejection, throw, signal, spawn error and malformed result are the exact Git failure; length errors are the argument-limit line; nothing later runs and no marker leaks', async () => {
      const stages = [['committed', 'mergeBase', 5], ['committed', 'invDiff', 6], ['committed', 'diff', 7], ['local', 'tree', 6], ['local', 'cached', 7], ['local', 'others', 8], ['local', 'diffIndex', 9], ['local', 'resolve', 3], ['committed', 'resolve', 3]];
      const shapes = [
        ['a nonzero status', () => bad(1, LEAK)], ['status 128', () => bad(128, LEAK)], ['a signal', () => ({ status: null, signal: 'SIGKILL', error: null, stdout: Buffer.from(LEAK), overflow: false })],
        ['a spawn error', () => ({ status: null, signal: null, error: `ENOENT ${LEAK}`, stdout: EMPTY, overflow: false })], ['a null result', () => ({ __raw: null })], ['a string result', () => ({ __raw: LEAK })],
        ['an empty object', () => ({ __raw: {} })], ['an extra key', () => ({ __raw: { status: 0, signal: null, error: null, stdout: EMPTY, overflow: false, extra: LEAK } })], ['a string stdout', () => ({ __raw: { status: 0, signal: null, error: null, stdout: LEAK, overflow: false } })],
        ['status 256', () => bad(256, LEAK)], ['both a signal and an error', () => ({ status: null, signal: 'SIGTERM', error: LEAK, stdout: EMPTY, overflow: false })],
      ];
      for (const [mode, kind, count] of stages) {
        for (const [label, make] of shapes) {
          const r = await go(mode, { world: { handle: (k) => (k === kind ? make() : undefined) } });
          // a resolution that fails with a plain nonzero status is the revision error (C4 3.3); every other shape is the Git failure
          const want = kind === 'resolve' && ['a nonzero status', 'status 128'].includes(label) ? E.REVISION : E.GIT;
          expectRes(check, `${mode} ${kind}: ${label}`, r.s.r, failRes(want));
          check(r.fake.calls.length === count && !r.s.r.stderr.includes(LEAK), `${mode} ${kind}: ${label}: nothing runs after the failing call and the marker never leaks`, r.fake.kinds());
        }
        const rej = await go(mode, { world: { handle: (k) => { if (k === kind) throw new Error(LEAK); return undefined; } } });
        expectRes(check, `${mode} ${kind}: an executor rejection`, rej.s.r, failRes(E.GIT));
        for (const code of ['E2BIG', 'ENAMETOOLONG']) {
          const r = await go(mode, { world: { handle: (k) => (k === kind ? { status: null, signal: null, error: code, stdout: EMPTY, overflow: false } : undefined) } });
          expectRes(check, `${mode} ${kind}: ${code}`, r.s.r, failRes(E.ARG_LIMIT));
        }
      }
      const sync = await go('committed', { deps: { extraDeps: { execute: () => { throw new Error(LEAK); } } } });
      expectRes(check, 'a synchronous executor throw', sync.s.r, failRes(E.GIT));
    });
    await step('an unexpected exception in the helper is GIT_SAFE_INTERNAL, never its own text', async () => {
      const evil = () => { const o = {}; for (const k of ['status', 'signal', 'error', 'stdout', 'overflow']) Object.defineProperty(o, k, { enumerable: true, get() { throw new Error(LEAK); } }); return { __raw: o }; };
      for (const [mode, kind] of [['committed', 'resolve'], ['committed', 'mergeBase'], ['committed', 'invDiff'], ['committed', 'diff'], ['local', 'tree'], ['local', 'diffIndex']]) {
        const r = await go(mode, { world: { handle: (k) => (k === kind ? evil() : undefined) } });
        expectRes(check, `${mode} ${kind}: an unexpected exception`, r.s.r, failRes(E.INTERNAL));
        check(!r.s.r.stderr.includes(LEAK), `${mode} ${kind}: the exception text never leaks`);
      }
    });
    await step('every failure leaves empty stdout and the one-line diagnostic; the installed CLI is covered by the complete-unit check of R76/C5/arguments and the missing helper below', async () => {
      await installedCli(context, failures, check, 'missing');
    });
  });
}

// ============================================== R100/C5/limits ====
// Plan 3.13, 4.3 R100/C5/limits and C5-P2-9: the whole result (header included) is bounded at 1,048,576 bytes; nothing partial is ever emitted or created.
// n bytes of multibyte content: two-byte characters, plus one ASCII byte for an odd length.
const mbBytes = (n) => Buffer.from(`${'\u00e9'.repeat(Math.floor(n / 2))}${n % 2 ? 'x' : ''}`, 'utf8');
const BOUNDARY = [MAX_BYTES - 1, MAX_BYTES, MAX_BYTES + 1];
async function limitsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rv = await loadReview(failures, context);
    if (!rv) return;
    await step('both modes, stdout destination: 1048575 and 1048576 bytes succeed with the exact bytes (header and multibyte content included); 1048577 is the exact limit error with empty stdout', async () => {
      for (const n of BOUNDARY) {
        const cWant = cat(HDR_C, mbBytes(n - HDR_C.length));
        const c = await seamReview(rv, context, ARGV_C, { world: { invDiff: nul(['a.txt']), content: mbBytes(n - HDR_C.length) }, seam: throwingSeam() });
        if (n <= MAX_BYTES) { expectRes(check, `committed ${n} bytes`, c.r, { exit: 0, stdout: cWant }); check(c.r.stdout.length === n, `committed ${n}: the result is exactly ${n} bytes`, c.r.stdout.length); } else expectRes(check, `committed ${n} bytes`, c.r, failRes(E.LIMIT));
        const lWant = cat(HDR_L, mbBytes(n - HDR_L.length));
        const l = await seamReview(rv, context, ARGV_L, { world: { tree: ['a.txt'], cached: idxBuf(['a.txt']), content: mbBytes(n - HDR_L.length) } });
        if (n <= MAX_BYTES) { expectRes(check, `local ${n} bytes`, l.r, { exit: 0, stdout: lWant }); check(l.r.stdout.length === n, `local ${n}: the result is exactly ${n} bytes`, l.r.stdout.length); } else expectRes(check, `local ${n} bytes`, l.r, failRes(E.LIMIT));
      }
    });
    await step('both modes, artifact destination: the artifact holds exactly the stdout-mode bytes at 1048575 and 1048576; 1048577 creates no directory, no file and no self-ignore file', async () => {
      for (const [mode, argvOf, world, hdrLen] of [
        ['committed', (o) => RD('--base', 'base-ref', '--head', 'head-ref', '--out', o), (len) => ({ invDiff: nul(['a.txt']), content: mbBytes(len) }), HDR_C.length],
        ['local', (o) => RD('--base', 'base-ref', '--out', o), (len) => ({ tree: ['a.txt'], cached: idxBuf(['a.txt']), content: mbBytes(len) }), HDR_L.length],
      ]) {
        for (const n of BOUNDARY) {
          const sw = seamWorld(context, { world: world(n - hdrLen) });
          const before = sw.vfs.snapshot();
          const s = await seamReview(rv, context, argvOf(OUT), { fake: sw.fake, seam: sw.seam });
          if (n <= MAX_BYTES) {
            expectRes(check, `${mode} artifact of ${n} bytes`, s.r, { exit: 0, stdout: `${OUT}\n` });
            const std = await seamReview(rv, context, argvOf(OUT).slice(0, -2), { world: world(n - hdrLen), seam: mode === 'committed' ? throwingSeam() : undefined });
            check(sameBuf(sw.vfs.bytesOf(OUT), std.r.stdout) && sw.vfs.bytesOf(OUT).length === n, `${mode} artifact of ${n} bytes: equals the stdout-mode bytes and is exactly ${n} bytes`, sw.vfs.bytesOf(OUT) && sw.vfs.bytesOf(OUT).length);
          } else {
            expectRes(check, `${mode} artifact of ${n} bytes`, s.r, failRes(E.LIMIT));
            check(sw.seam.ops('mkdirSync', 'writeSync', 'fsyncSync', 'unlinkSync').length === 0 && writeOpensOf(sw).length === 0 && sw.vfs.snapshot() === before && !sw.vfs.has('.ai'), `${mode} artifact of ${n} bytes: no directory, file or self-ignore file was created (the size check precedes publication)`, sw.seam.log.map((e) => e.op));
          }
        }
      }
    });
    await step('executor-reported overflow and an oversized Buffer with overflow false are the exact limit error, in both modes', async () => {
      const over = { status: null, signal: null, error: null, stdout: EMPTY, overflow: true };
      for (const [label, content] of [['executor-reported overflow', over], ['an oversized Buffer with overflow false', { status: 0, signal: null, error: null, stdout: Buffer.alloc(MAX_BYTES + 1, 0x78), overflow: false }]]) {
        const c = await seamReview(rv, context, ARGV_C, { world: { invDiff: nul(['a.txt']), content }, seam: throwingSeam() });
        expectRes(check, `committed: ${label}`, c.r, failRes(E.LIMIT));
        const l = await seamReview(rv, context, ARGV_L, { world: { tree: ['a.txt'], cached: idxBuf(['a.txt']), content } });
        expectRes(check, `local: ${label}`, l.r, failRes(E.LIMIT));
      }
      const exact = await seamReview(rv, context, ARGV_L, { world: { tree: ['a.txt'], cached: idxBuf(['a.txt']), content: { status: 0, signal: null, error: null, stdout: Buffer.alloc(MAX_BYTES, 0x78), overflow: false } } });
      expectRes(check, 'a tracked patch of exactly 1048576 bytes is itself within the executor bound but not within the whole-result bound', exact.r, failRes(E.LIMIT));
    });
    await step('aggregate overflow: a tracked patch and an untracked file that each fit but together exceed the bound are refused whole; the boundary is exact across both pieces', async () => {
      const unt = refRender('u.txt', Buffer.from('line\n'));
      const mk = async (trackedLen) => {
        const sw = seamWorld(context, { world: { tree: ['a.txt'], cached: idxBuf(['a.txt']), others: nul(['u.txt']), content: mbBytes(trackedLen) }, files: { 'u.txt': 'line\n' } });
        return seamReview(rv, context, ARGV_L, { fake: sw.fake, seam: sw.seam });
      };
      for (const n of BOUNDARY) {
        const tracked = n - HDR_L.length - unt.length;
        const s = await mk(tracked);
        if (n <= MAX_BYTES) { expectRes(check, `tracked plus untracked = ${n}`, s.r, { exit: 0, stdout: cat(HDR_L, mbBytes(tracked), unt) }); check(s.r.stdout.length === n, `tracked plus untracked = ${n}: exactly ${n} bytes`, s.r.stdout.length); } else expectRes(check, `tracked plus untracked = ${n}`, s.r, failRes(E.LIMIT));
      }
      const big = Buffer.from(Array.from({ length: 40000 }, () => 'abcdefgh\n').join(''));
      const sw = seamWorld(context, { world: { tree: ['a.txt'], cached: idxBuf(['a.txt']), others: nul(['big.txt']), content: mbBytes(700000) } });
      sw.vfs.file('big.txt', big);
      const s = await seamReview(rv, context, ARGV_L, { fake: sw.fake, seam: sw.seam });
      expectRes(check, 'two smaller pieces that overflow together', s.r, failRes(E.LIMIT));
      check(big.length < MAX_BYTES && 700000 < MAX_BYTES, 'premise: each piece alone is below the bound');
      const many = Array.from({ length: 60 }, (_, i) => `f${String(i).padStart(2, '0')}.txt`);
      const sw2 = seamWorld(context, { world: { others: nul(many) } });
      for (const n of many) sw2.vfs.file(n, Buffer.alloc(20000, 0x61));
      const s2 = await seamReview(rv, context, ARGV_L, { fake: sw2.fake, seam: sw2.seam });
      expectRes(check, 'sixty untracked files that overflow together', s2.r, failRes(E.LIMIT));
    });
    await step('real files (C5-P2-9): a 1048577-byte binary is one binary line after at most 8000 bytes were read; a 1048577-byte text file is refused after at most 8000 bytes; a text file of exactly 1048576 bytes may be read but cannot fit; binary detection at the 8000-byte boundary', async () => {
      const dir = scratchDir(context, 'limits-real');
      const root = path.join(dir, 'repo');
      fs.mkdirSync(root);
      const mkBin = (len) => { const b = Buffer.alloc(len, 0x62); b[0] = 0; return b; };
      const run = async (names) => {
        const fake = makeFake(context, { root: `${fwd(root)}\n`, others: nul(names) });
        const seam = realSeam();
        const r = await rv.reviewMain(ARGV_L, { cwd: root, env: SEAM_ENV, execute: fake.execute, readFile: async () => bytes(jsonText(DEFAULT_POLICY)), fs: seam.fs });
        return { r, seam };
      };
      putFile(path.join(root, 'bin-big.bin'), mkBin(MAX_BYTES + 1));
      const a = await run(['bin-big.bin']);
      expectRes(check, 'a 1048577-byte binary', a.r, { exit: 0, stdout: cat(HDR_L, refRender('bin-big.bin', mkBin(8000))) });
      check(a.seam.bytesRead() <= 8000, 'only the first chunk (at most 8000 bytes) of the binary was read', a.seam.bytesRead());
      putFile(path.join(root, 'bin-edge.bin'), mkBin(MAX_BYTES));
      const b = await run(['bin-edge.bin']);
      expectRes(check, 'a 1048576-byte binary', b.r, { exit: 0, stdout: cat(HDR_L, refRender('bin-edge.bin', mkBin(8000))) });
      check(b.seam.bytesRead() <= 8000, 'a binary of exactly the limit is rendered without reading further', b.seam.bytesRead());
      putFile(path.join(root, 'text-big.txt'), Buffer.alloc(MAX_BYTES + 1, 0x61));
      const c = await run(['text-big.txt']);
      expectRes(check, 'a 1048577-byte text file', c.r, failRes(E.LIMIT));
      check(c.seam.bytesRead() <= 8000, 'the refusal came after at most 8000 body bytes were read', c.seam.bytesRead());
      putFile(path.join(root, 'text-edge.txt'), Buffer.alloc(MAX_BYTES, 0x61));
      const d = await run(['text-edge.txt']);
      expectRes(check, 'a text file of exactly 1048576 bytes', d.r, failRes(E.LIMIT));
      const nulAt = (len, at) => { const x = Buffer.alloc(len, 0x61); x[len - 1] = 0x0a; x[at] = 0; return x; };
      putFile(path.join(root, 'n7999.bin'), nulAt(8200, 7999));
      putFile(path.join(root, 'n8000.txt'), nulAt(8200, 8000));
      for (const [name, data] of [['n7999.bin', nulAt(8200, 7999)], ['n8000.txt', nulAt(8200, 8000)]]) {
        const r = await run([name]);
        expectRes(check, `real file ${name}`, r.r, { exit: 0, stdout: cat(HDR_L, refRender(name, data)) });
      }
    });
  });
}

// ============================================== R100/C5/narrowing ====
// Plan 4.3 R100/C5/narrowing: literal selection narrows a refused review to subsets that fit, never reports a subset as the full review, and shrinks the exclusion list.
async function narrowingGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rv = await loadReview(failures, context);
    if (!rv) return;
    const A = Buffer.alloc(600000, 0x41);
    const Bb = Buffer.alloc(600000, 0x42);
    const literals = (op) => op.slice(op.indexOf('--') + 1).filter((x) => x.startsWith(':(literal)')).map((x) => x.slice(':(literal)'.length));
    const byLiteral = (kind) => (k, op) => {
      if (k !== kind) return undefined;
      const L = literals(op);
      return L.length === 1 && L[0] === 'a' ? A : L.length === 1 && L[0] === 'b' ? Bb : Buffer.alloc(1200000, 0x43);
    };
    await step('two safe changes that together exceed the bound but fit alone: the full review is refused whole, each literal selection succeeds, and together they cover every safe changed path; no subset claims to be the full review', async () => {
      for (const [mode, kind, world, argvOf] of [
        ['committed', 'diff', { invDiff: nul(['a/x.txt', 'b/y.txt']) }, (...p) => RD('--base', 'base-ref', '--head', 'head-ref', ...(p.length ? ['--', ...p] : []))],
        ['local', 'diffIndex', { tree: ['a/x.txt', 'b/y.txt'], cached: idxBuf(['a/x.txt', 'b/y.txt']) }, (...p) => RD('--base', 'base-ref', ...(p.length ? ['--', ...p] : []))],
      ]) {
        const hdrOf = mode === 'committed' ? HDR_C : HDR_L;
        const run = (...p) => seamReview(rv, context, argvOf(...p), { world: { ...world, handle: byLiteral(kind) }, seam: mode === 'committed' ? throwingSeam() : undefined });
        const full = await run();
        expectRes(check, `${mode}: the full review`, full.r, failRes(E.LIMIT));
        check(/not complete\.\n$/.test(full.r.stderr) && !/review is complete|fully reviewed/i.test(full.r.stderr), `${mode}: the refusal says the review is not complete`, full.r.stderr);
        const a = await run('a');
        const b = await run('b');
        expectRes(check, `${mode}: selection a`, a.r, { exit: 0, stdout: cat(hdrOf, A) });
        expectRes(check, `${mode}: selection b`, b.r, { exit: 0, stdout: cat(hdrOf, Bb) });
        const covered = uniq([...literals(a.fake.ops().find((o) => o[0] === (mode === 'committed' ? 'diff' : 'diff-index')) || []), ...literals(b.fake.ops().find((o) => o[0] === (mode === 'committed' ? 'diff' : 'diff-index')) || [])]);
        check(eq(sorted(covered), ['a', 'b']), `${mode}: the two narrowed reviews together select every safe changed directory`, covered);
        check(!/complete/i.test(textOf(a.r.stdout).slice(0, 200)) && !textOf(a.r.stdout).includes('full review'), `${mode}: a narrowed result carries no claim of being the full review`);
        const both = await run('a', 'b');
        expectRes(check, `${mode}: both selections together are the full review again`, both.r, failRes(E.LIMIT));
      }
      // untracked files: the same literal predicate narrows an overflowing set
      const names = ['a/u.txt', 'b/u.txt'];
      const mkSw = () => { const sw = seamWorld(context, { world: { others: nul(names) } }); for (const n of names) sw.vfs.file(n, Buffer.alloc(600000, 0x7a)); return sw; };
      const w0 = mkSw();
      expectRes(check, 'untracked: the full review', (await seamReview(rv, context, ARGV_L, { fake: w0.fake, seam: w0.seam })).r, failRes(E.LIMIT));
      for (const n of ['a', 'b']) {
        const w = mkSw();
        const s = await seamReview(rv, context, RD('--base', 'base-ref', '--', n), { fake: w.fake, seam: w.seam });
        expectRes(check, `untracked: selection ${n}`, s.r, { exit: 0, stdout: cat(HDR_L, refRender(`${n}/u.txt`, Buffer.alloc(600000, 0x7a))) });
        check(!touched(w).some((x) => x.startsWith(n === 'a' ? 'b/' : 'a/')), `untracked: selection ${n} never examines the other file`, touched(w));
      }
    });
    await step('directory selection excludes protected descendants; explicit protected selection fails in both modes; a literal a* does not select abc; a missing selector is a header-only success', async () => {
      const inv = ['a/ok.txt', 'a/.env', 'a/sub/.ENV.local', 'b/.env', 'abc/ok.txt', 'abc/.env', 'a*/.env'];
      const c = makeFake(context, { invDiff: nul(inv), content: Buffer.from('P\n') });
      await seamReview(rv, context, RD('--base', 'base-ref', '--head', 'head-ref', '--', 'a'), { fake: c, seam: throwingSeam() });
      checkOps(check, 'a directory selection (committed)', c, OPS_C({ L: sel('a'), X: E_OF(['a/.env', 'a/sub/.ENV.local']) }));
      const l = makeFake(context, { tree: inv, cached: idxBuf(inv), content: Buffer.from('P\n') });
      await seamReview(rv, context, RD('--base', 'base-ref', '--', 'a'), { fake: l });
      checkOps(check, 'a directory selection (local)', l, OPS_L({ L: sel('a'), X: E_OF(['a/.env', 'a/sub/.ENV.local']) }));
      for (const [mode, argv, seamOpt] of [['committed', RD('--base', 'base-ref', '--head', 'head-ref', '--', '.env'), throwingSeam()], ['local', RD('--base', 'base-ref', '--', 'ok.txt', 'private/x'), undefined], ['local', RD('--base', 'base-ref', '--', '.ENV'), undefined]]) {
        const f = makeFake(context, { invDiff: nul(inv), tree: inv });
        const s = await seamReview(rv, context, argv, { fake: f, seam: seamOpt });
        expectRes(check, `${mode}: an explicit protected selection`, s.r, failRes(E.SECRET));
        check(f.calls.length === 2, `${mode}: the refusal precedes every resolution`, f.kinds());
      }
      const star = makeFake(context, { invDiff: nul(['abc/ok.txt', 'abc/.env']), content: Buffer.from('MUST-NOT-RUN\n') });
      const s1 = await seamReview(rv, context, RD('--base', 'base-ref', '--head', 'head-ref', '--', 'a*'), { fake: star, seam: throwingSeam() });
      expectRes(check, 'a* does not select abc', s1.r, { exit: 0, stdout: HDR_C });
      checkOps(check, 'a* does not select abc', star, OPS_C({ L: sel('a*'), content: false }));
      const miss = makeFake(context, { tree: ['x/ok.txt'], cached: idxBuf(['x/ok.txt']), content: Buffer.from('MUST-NOT-RUN\n') });
      const s2 = await seamReview(rv, context, RD('--base', 'base-ref', '--', 'no-such'), { fake: miss });
      expectRes(check, 'a missing selector', s2.r, { exit: 0, stdout: HDR_L });
      checkOps(check, 'a missing selector', miss, OPS_L({ L: sel('no-such'), diffIndex: false }));
    });
    await step('narrowing removes unrelated protected names from the exclusion list and avoids the argument bound that the whole review hits', async () => {
      const prot = Array.from({ length: 400 }, (_, i) => `private/${String(i).padStart(4, '0')}-${'z'.repeat(40)}.txt`);
      for (const [mode, world, argvOf, seamOpt] of [
        ['committed', { invDiff: nul([...prot, 'src/a.txt']), content: Buffer.from('NARROW\n') }, (...p) => RD('--base', 'base-ref', '--head', 'head-ref', ...(p.length ? ['--', ...p] : [])), () => throwingSeam()],
        ['local', { tree: [...prot, 'src/a.txt'], cached: idxBuf([...prot, 'src/a.txt']), content: Buffer.from('NARROW\n') }, (...p) => RD('--base', 'base-ref', ...(p.length ? ['--', ...p] : [])), () => undefined],
      ]) {
        const whole = makeFake(context, world);
        const sw = await seamReview(rv, context, argvOf(), { fake: whole, seam: seamOpt() });
        expectRes(check, `${mode}: the whole review`, sw.r, failRes(E.ARG_LIMIT));
        check(!whole.kinds().some((k) => CONTENT_KINDS.includes(k)) && whole.calls.every((x) => argvUnits(x.argv) <= MAX_UNITS), `${mode}: the oversized content call never reached the executor`, whole.calls.map((x) => argvUnits(x.argv)));
        const narrow = makeFake(context, world);
        const sn = await seamReview(rv, context, argvOf('src'), { fake: narrow, seam: seamOpt() });
        expectRes(check, `${mode}: the narrowed review`, sn.r, { exit: 0, stdout: cat(mode === 'committed' ? HDR_C : HDR_L, 'NARROW\n') });
        const content = narrow.ops().find((o) => (mode === 'committed' ? o[0] === 'diff' && o.includes('--patch') : o[0] === 'diff-index'));
        check(content && eq(content, mode === 'committed' ? V_DIFF_C(M3, H2, sel('src'), E_OF()) : V_DI(M3, sel('src'), E_OF())), `${mode}: the narrowed vector carries none of the unrelated protected names`, content && content.slice(-4));
      }
    });
  });
}

// ============================================================ registration ====
// The array wired into COMPONENT_IMPLEMENTATIONS.C5 (plan 4.1): frozen, descriptors frozen, in the plan order. Imports perform no work.
export const C5_IMPLEMENTATIONS = Object.freeze([
  { id: 'R65/C5/local', run: (context) => localGroup(context) },
  { id: 'R65/C5/index', run: (context) => indexGroup(context) },
  { id: 'R66/C5/limits-documentation', run: (context) => docsGroup(context) },
  { id: 'R90/C5/committed', run: (context) => committedGroup(context) },
  { id: 'R90/C5/identity', run: (context) => identityGroup(context) },
  { id: 'R91/C5/inputs', run: (context) => inputsGroup(context) },
  { id: 'R91/C5/artifacts', run: (context) => artifactsGroup(context) },
  { id: 'R91/C5/links', run: (context) => linksGroup(context) },
  { id: 'R91/C5/publication', run: (context) => publicationGroup(context) },
  { id: 'R92/C5/reserved', run: (context) => reservedGroup(context) },
  { id: 'R92/C5/cleanup', run: (context) => cleanupGroup(context) },
  { id: 'R92/C5/stdout', run: (context) => stdoutGroup(context) },
  { id: 'R74/C5/corpus', run: (context) => corpusGroup(context) },
  { id: 'R76/C5/arguments', run: (context) => argumentsGroup(context) },
  { id: 'R76/C5/failures', run: (context) => failuresGroup(context) },
  { id: 'R97/C5/environment-names', run: (context) => environmentNames(context) },
  { id: 'R100/C5/limits', run: (context) => limitsGroup(context) },
  { id: 'R100/C5/narrowing', run: (context) => narrowingGroup(context) },
].map((d) => Object.freeze(d)));
