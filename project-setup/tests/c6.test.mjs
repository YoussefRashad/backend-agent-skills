// C6 tests lane: the twelve component assertions of "C6. Raw-Git hook, merge and self-test".
//
// Written from the frozen plan only, before any implementation exists:
//   docs/plans/2026-10-19-project-setup-v3-rc1-c6.md   (sections 1-9 and the C6-P2-1 to C6-P2-10 addendum, which wins over earlier sections)
// Under the frozen architecture plan docs/plans/2026-10-15-project-setup-v3-rc1.md and the landed contracts it builds on: C11a (tests/rc1-cases.mjs,
// tests/run-component-tests.mjs, tests/helpers/v2-baseline.mjs), C1 (assets/tools/security-policy.mjs), C2 (scripts/apply.mjs, scripts/ownership.mjs,
// scripts/lib.mjs), C3 (scripts/merge-claude-settings.mjs, scripts/migrate-security-paths.mjs, data/runtime-units.json), C4 (assets/tools/git-safe*.mjs,
// tests/c4.test.mjs) and C5 (tests/c5.test.mjs). Plan 2.1 and 4.8 give the tests lane this file, tests/fixtures/guard-raw-git-cases.json, the
// tests/rc1-cases.mjs registration, the R29 aggregation and freshSetup edits in tests/run-tests.mjs, the exact merge export list in tests/c3.test.mjs, the
// production catalog, unit and order expectations in tests/c4.test.mjs and the production catalog check in tests/c5.test.mjs; those edits live in those files.
// The implementer must not edit any of them.
//
// Importing this module runs nothing. Every production module and every registry module (rc1-cases.mjs imports this file, so a static import back would be
// circular) is imported lazily inside run(context). A missing module or export fails one assertion with a diagnostic; it never breaks the import.
//
// Every run(context) returns { failures, skipped: null }. There is no skip path. Scratch data lives under context.tmp only. No parser row launches a
// process (plan 4.8): rows run in-process through inspectCommand and evaluateHookInput; processes are spawned only for the process-contract, CLI byte,
// staging and transaction, and self-test cases.
//
// Where the plan does not pin a value a test would need, the test asserts only what is pinned. The gaps are listed in the delegation report as PLAN-GAP
// lines; the places they touch carry a comment starting with "PLAN-GAP".
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp, { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// ===================================================== generic utilities ====
const eq = (a, b) => isDeepStrictEqual(a, b);
const hasOwn = (o, k) => o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k);
const errMsg = (e) => String((e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) || e).slice(0, 500);
// Diagnostics are ASCII-only whatever the data holds.
function show(v) {
  let s;
  try { s = typeof v === 'string' ? JSON.stringify(v) : (JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? String(x) : x)) ?? String(v)); } catch { s = String(v); }
  return s.replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).slice(0, 700);
}
function mkCheck(failures) { return (cond, msg, detail) => { if (!cond) failures.push(detail === undefined ? msg : `${msg} :: ${show(detail)}`); }; }
function deepFreeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(deepFreeze); Object.freeze(v); } return v; }
function deepFrozen(v) { if (v === null || typeof v !== 'object') return true; return Object.isFrozen(v) && Object.values(v).every(deepFrozen); }
const clone = (v) => JSON.parse(JSON.stringify(v));
const sorted = (a) => [...a].sort();
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const jsonText = (v) => JSON.stringify(v, null, 2) + '\n';
const fwd = (p) => String(p).replace(/\\/g, '/');
const bytes = (s) => (Buffer.isBuffer(s) ? s : Buffer.from(s, 'utf8'));
const WIN = process.platform === 'win32';
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
const normText = (s) => { let t = Buffer.isBuffer(s) ? s.toString('utf8') : String(s); if (t.charCodeAt(0) === 0xfeff) t = t.slice(1); t = t.replace(/\r\n?/g, '\n'); if (!t.endsWith('\n')) t += '\n'; return t; };
const NH = (s) => sha(Buffer.from(normText(s), 'utf8'));
const sameBuf = (a, b) => Buffer.isBuffer(a) && Buffer.isBuffer(b) && Buffer.compare(a, b) === 0;
const keysOf = (o) => (o !== null && typeof o === 'object' ? Object.keys(o) : null);

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
function needFns(failures, mod, names) {
  const missing = names.filter((n) => typeof (mod && mod[n]) !== 'function');
  if (missing.length) failures.push(`missing exports: ${missing.join(', ')}`);
  return missing.length === 0;
}

// ------------------------------------------------------------- scratch ----
// The native (long-name) real path: Git, the setup scripts and the code under test all report that spelling.
function scratchDir(context, label) {
  fs.mkdirSync(context.tmp, { recursive: true });
  return fs.realpathSync.native(fs.mkdtempSync(path.join(context.tmp, `c6-${label}-`)));
}
const rmrf = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* best effort */ } };
// Links created by a test are unlinked by name before a scratch directory is removed, so a recursive removal never reaches through one.
const createdLinks = new Set();
function dropLink(link) { try { fs.unlinkSync(link); } catch { try { fs.rmdirSync(link); } catch { /* already gone */ } } createdLinks.delete(link); }
async function withScratch(context, label, fn) {
  const dir = scratchDir(context, label);
  try { return await fn(dir); } finally {
    for (const l of [...createdLinks]) { if (l === dir || l.startsWith(dir + path.sep)) dropLink(l); }
    rmrf(dir);
  }
}
const readBytes = (p) => { try { return fs.readFileSync(p); } catch { return null; } };
const readText = (p) => { const b = readBytes(p); return b === null ? null : b.toString('utf8'); };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const exists = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };
function putFile(p, data) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); }
const sameBytes = (a, b) => a !== null && b !== null && Buffer.compare(a, b) === 0;
function cloneTree(src, dst) { fs.cpSync(src, dst, { recursive: true }); return dst; }
function linkDir(target, link) {
  try { fs.symlinkSync(target, link, WIN ? 'junction' : 'dir'); createdLinks.add(link); return true; } catch { return false; }
}
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
// The retained diagnostics: a plain file in the kept scratch directory (process counts and optional subcases that were not exercised).
function diag(context, line) { try { fs.mkdirSync(context.tmp, { recursive: true }); fs.appendFileSync(path.join(context.tmp, 'c6-diagnostics.log'), `${line}\n`); } catch { /* best effort */ } }

// ------------------------------------------------------- import safety ----
// Same criteria as C1-C5: no spawn, no filesystem write, no output, no process.exit, no exit code, no environment change.
const PROBE_SOURCE = [
  "import cp from 'node:child_process';",
  "import fs from 'node:fs';",
  "import { syncBuiltinESMExports } from 'node:module';",
  "const log = { spawns: [], writes: [], stdout: [], stderr: [], exits: [], err: null, names: [], exitCode: null, env: 0 };",
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
let probeSeq = 0;
function checkImportSafe(check, label, context, dir, url, expectNames) {
  const file = path.join(dir, `probe-${++probeSeq}.mjs`);
  fs.writeFileSync(file, PROBE_SOURCE);
  const r = spawnSync(process.execPath, [file, url], { cwd: dir, env: { ...context.env }, encoding: 'utf8', windowsHide: true, shell: false, timeout: 60000 });
  countProcess(context);
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
// Process accounting (plan 4.8 gives a budget): every spawn made by this file is counted and the total is retained in the diagnostics file.
const PROCESS_COUNTS = new Map();
function countProcess(context, n = 1) { PROCESS_COUNTS.set(context.tmp, (PROCESS_COUNTS.get(context.tmp) || 0) + n); }
function flushProcessCount(context, label) { diag(context, `processes after ${label}: ${PROCESS_COUNTS.get(context.tmp) || 0}`); }

// ============================================================ literals ====
// Written out independently of the implementation (plan 4.1: expected descriptors; plan 3.7: H and E; plan 3.1: the three process outcomes).
const COMPONENT_INVENTORY = [
  ['R50/C6/parser', 'raw Git parser handles frozen command forms'],
  ['R50/C6/sanctioned', 'seven sanctioned commands preserve later raw Git checks'],
  ['R50/C6/documentation', 'hook limitations and host verification remain explicit'],
  ['R51/C6/process', 'hook stdin streams and alternate paths are exact'],
  ['R51/C6/malformed', 'malformed input follows the frozen fail-open contract'],
  ['R52/C6/merge', 'conditional hook merge preserves users and reruns'],
  ['R52/C6/staging', 'hooks-only staging preserves migration projections'],
  ['R79/C6/identity', 'hook identity preserves event matcher options and order'],
  ['V2/C6/transaction', 'hook settings and ownership share existing approval rules'],
  ['R72/C6/selftest', 'installed hook self-test reports exact outcomes'],
  ['V2/C6/runtime-unit', 'hook assets extend the reviewed runtime unit'],
  ['R84/C6/arguments', 'stash patch and alias rules preserve orchestrator commands'],
];
const EXPECTED_DESCRIPTORS = COMPONENT_INVENTORY.map(([id, name]) => ({ id, name }));

const BLOCKED = ['diff', 'show', 'log', 'blame', 'cat-file', 'grep', 'archive', 'format-patch', 'whatchanged', 'stash', 'reflog', 'diff-tree', 'range-diff'];
const HOOK_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs"';
const H = { event: 'PreToolUse', matcher: 'Bash|PowerShell', command: HOOK_COMMAND };
const E = { matcher: 'Bash|PowerShell', hooks: [{ type: 'command', command: HOOK_COMMAND }] };
const BLOCK_STDERR = 'guard-raw-git: raw Git command blocked; use node .ai/tools/git-safe.mjs\n';
const MALFORMED_STDERR = 'guard-raw-git: could not parse command; allowed without checking\n';
const OUT = {
  allow: { exitCode: 0, stdout: '', stderr: '' },
  block: { exitCode: 2, stdout: '', stderr: BLOCK_STDERR },
  malformed: { exitCode: 1, stdout: '', stderr: MALFORMED_STDERR },
};
const SKIP_READY = 'guard-raw-git.mjs not staged or installed';
const SKIP_CONTAINER = 'hooks or PreToolUse has an unsupported container; managed hook not added';
const envelope = (tool, command) => JSON.stringify({ tool_name: tool, tool_input: { command } });
const MIN_ALLOW = envelope('Bash', 'git status');
const MIN_BLOCK = envelope('Bash', 'git diff');

const GUARD_REL = 'assets/tools/guard-raw-git.mjs';
const GUARD_CORE_REL = 'assets/tools/guard-raw-git-core.mjs';
const SELFTEST_REL = 'assets/tools/hooks-selftest.mjs';
const MERGE_REL = 'scripts/merge-claude-settings.mjs';
const CORE_EXPORTS = ['BLOCKED_SUBCOMMANDS', 'RAW_GIT_HOOK', 'evaluateHookInput', 'inspectCommand'];
const SELFTEST_EXPORTS = ['runHooksSelfTest'];
const MERGE_EXPORTS = ['mergeManagedDenies', 'mergeManagedHooks'];
const FIXTURE_REL = 'tests/fixtures/guard-raw-git-cases.json';

// Targets (project-relative) and the production catalog of plan 2.7, exactly (rows in order).
const T_POLICY = '.ai/security-paths.json';
const T_SETTINGS = '.claude/settings.json';
const T_MANIFEST = '.ai/manifest.json';
const T_HELPER = '.ai/tools/security-policy.mjs';
const T_CORE = '.ai/tools/git-safe-core.mjs';
const T_GUARD_CORE = '.ai/tools/guard-raw-git-core.mjs';
const T_REVIEW = '.ai/tools/review-diff.mjs';
const T_ENTRY = '.ai/tools/git-safe.mjs';
const T_GUARD = '.ai/tools/guard-raw-git.mjs';
const T_SELFTEST = '.ai/tools/hooks-selftest.mjs';
const T_CATALOG = 'data/runtime-units.json';
const UNIT = [T_HELPER, T_CORE, T_GUARD_CORE, T_REVIEW, T_ENTRY, T_GUARD, T_SELFTEST];
const SRC_OF = {
  [T_HELPER]: 'assets/tools/security-policy.mjs', [T_CORE]: 'assets/tools/git-safe-core.mjs', [T_GUARD_CORE]: GUARD_CORE_REL, [T_REVIEW]: 'assets/tools/review-diff.mjs',
  [T_ENTRY]: 'assets/tools/git-safe.mjs', [T_GUARD]: GUARD_REL, [T_SELFTEST]: SELFTEST_REL,
};
const ROLE_OF = { [T_HELPER]: 'helper', [T_CORE]: 'helper', [T_GUARD_CORE]: 'helper', [T_REVIEW]: 'helper', [T_ENTRY]: 'entrypoint', [T_GUARD]: 'entrypoint', [T_SELFTEST]: 'entrypoint' };
const CATALOG_PRODUCTION = { schema: 1, units: UNIT.map((t) => ({ source: SRC_OF[t], target: t, role: ROLE_OF[t], policySchemas: [1, 2] })) };
const MSG = {
  PLAN_REJECTED: 'plan rejected',
  TOOL_UNREVIEWED: (t) => `TOOL_UNIT_UNREVIEWED: reviewed tool bytes required: ${t}`,
  DRIFT: 'changes since prepare; nothing was written. Re-run prepare and get approval again.',
  UNRELATED: '--approve-user-content names files that do not need it; refusing broad approvals',
};
const R_HOOKS = 'draft changes user settings key "hooks"';
const R_SETTINGS = 'settings ownership or managed metadata changes';
const approvalSuffix = (t) => `Show the diff; re-run prepare with --approve-user-content ${t} only after the user approves it`;
const contentApprovalError = (t, reasons) => `${reasons.join('; ')}. ${approvalSuffix(t)}`;
const metaApprovalError = (t) => `metadata changes require --approve-user-content ${t}`;
const NOOP_BODY = { ok: true, committed: false, reason: 'nothing to change (zero diff)' };
const GENERIC_RESERVED_OUT = jsonText({ ok: false, error: 'RUN_ID_RESERVED: run id is reserved for review artifacts' });

// Test-defined merge symbols of plan 4.4 (H and E above are independent literals matching section 3.7).
const U = { matcher: 'Bash', hooks: [{ type: 'command', command: 'node before.mjs', timeout: 9 }] };
const V = { matcher: 'PowerShell', hooks: [{ type: 'command', command: 'node after.mjs', async: true }] };
const O = { matcher: H.matcher, hooks: [{ type: 'command', command: H.command, timeout: 17, statusMessage: 'Keep' }], userOption: 'Keep' };
const A = { matcher: 'Bash', hooks: [{ type: 'command', command: H.command }] };
const L = { matcher: 'Write', command: 'x' };
const REP = (o = {}) => ({ added: [], alreadyPresent: [], alreadyCovered: [], skipped: null, ...o });
const ADD = REP({ added: [H] });
const OWN = REP({ alreadyPresent: [H] });
const USER = REP({ alreadyCovered: [H] });
const BAD = REP({ skipped: SKIP_CONTAINER });
const OFF = REP({ skipped: SKIP_READY });

// ====================================================== module loaders ====
async function loadCore(failures, context) {
  const m = await importOrFail(failures, assetUrl(context, GUARD_CORE_REL), GUARD_CORE_REL);
  if (!m) return null;
  const missing = CORE_EXPORTS.filter((n) => !(n in m));
  if (missing.length) { failures.push(`${GUARD_CORE_REL} lacks exports: ${missing.join(', ')}`); return null; }
  return m;
}
async function loadMerge(failures, context) {
  const m = await importOrFail(failures, scriptUrl(context, 'merge-claude-settings.mjs'), MERGE_REL);
  if (!m) return null;
  if (typeof m.mergeManagedHooks !== 'function') { failures.push(`${MERGE_REL} lacks the mergeManagedHooks export`); return null; }
  return m;
}
async function loadSelftest(failures, context) {
  const m = await importOrFail(failures, assetUrl(context, SELFTEST_REL), SELFTEST_REL);
  if (!m) return null;
  if (typeof m.runHooksSelfTest !== 'function') { failures.push(`${SELFTEST_REL} lacks the runHooksSelfTest export`); return null; }
  return m;
}
// The fixture of plan 4.2: schema 1, four keys per row, unique IDs. The 158 plan rows (P01-P113, H01-H09, S01-S16, G01-G08, the eight raw followers,
// L01-L04) are all required; the ten X rows pin behavior stated by the C6-P2-2 and C6-P2-3 addendum items.
const PLAN_ROW_IDS = (() => {
  const ids = [];
  for (let i = 1; i <= 113; i++) ids.push(`P${String(i).padStart(2, '0')}`);
  for (let i = 1; i <= 9; i++) ids.push(`H0${i}`);
  for (let i = 1; i <= 16; i++) ids.push(`S${String(i).padStart(2, '0')}`);
  for (let i = 1; i <= 8; i++) ids.push(`G0${i}`);
  for (let i = 1; i <= 8; i++) ids.push(`G0${i}-raw`);
  for (let i = 1; i <= 4; i++) ids.push(`L0${i}`);
  return ids;
})();
const EXTRA_ROW_IDS = Array.from({ length: 10 }, (_, i) => `X${String(i + 1).padStart(2, '0')}`);
function loadRows(check, context) {
  const file = readJson(path.join(context.skillRoot, ...FIXTURE_REL.split('/')));
  if (!file) { check(false, `${FIXTURE_REL} is readable JSON`); return null; }
  check(eq(keysOf(file), ['schema', 'cases']) && file.schema === 1 && Array.isArray(file.cases), 'the fixture has exactly schema 1 and cases', keysOf(file));
  if (!Array.isArray(file.cases)) return null;
  const ids = file.cases.map((c) => c && c.id);
  check(new Set(ids).size === ids.length, 'fixture row IDs are unique');
  check(file.cases.every((c) => c && eq(keysOf(c), ['id', 'toolName', 'command', 'expected']) && typeof c.id === 'string' && ['Bash', 'PowerShell'].includes(c.toolName) && typeof c.command === 'string' && ['allow', 'block', 'malformed'].includes(c.expected)), 'every fixture row is { id, toolName, command, expected } with the pinned domains');
  check(eq(ids, [...PLAN_ROW_IDS, ...EXTRA_ROW_IDS]), `the fixture holds the 158 plan rows then the ten addendum rows (${PLAN_ROW_IDS.length + EXTRA_ROW_IDS.length} in all), in order`, { count: ids.length });
  return file.cases;
}
// Which descriptor owns a row: every row runs in exactly one group.
function groupOf(id) {
  if (/^G\d\d(-raw)?$/.test(id) || id === 'P102' || id === 'P103') return 'sanctioned';
  const n = /^P(\d+)$/.exec(id);
  const p = n ? Number(n[1]) : null;
  if (/^S\d\d$/.test(id)) return 'arguments';
  if (p !== null && ((p >= 39 && p <= 66) || p === 73 || p === 77 || (p >= 81 && p <= 86) || p === 109)) return 'arguments';
  return 'parser';
}
const clip = (s) => show(String(s).length > 90 ? `${String(s).slice(0, 90)}... (${String(s).length} chars)` : s);
// Plan 4.2: each row is tested in-process through inspectCommand and, in the minimum envelope, through evaluateHookInput (the full outcome object).
function runRows(check, core, rows) {
  for (const row of rows) {
    let a;
    let b;
    try { a = core.inspectCommand(row.command, row.toolName); } catch (e) { check(false, `${row.id} ${clip(row.command)}: inspectCommand threw`, errMsg(e)); continue; }
    check(a === row.expected, `${row.id} ${clip(row.command)}: inspectCommand is ${row.expected}`, a);
    try { b = core.evaluateHookInput(envelope(row.toolName, row.command)); } catch (e) { check(false, `${row.id}: evaluateHookInput threw`, errMsg(e)); continue; }
    check(eq(b, OUT[row.expected]), `${row.id} ${clip(row.command)}: evaluateHookInput is the exact ${row.expected} outcome`, b);
  }
}
// A crude comment stripper for the static purity checks (not string aware; used only for negative searches).
const stripComments = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');

// ================================================== parser assertions ====
// Sync recorders for the purity claim of plan 2.3: the core performs no filesystem access, environment lookup or spawning.
function withRecorders(fn) {
  const hits = [];
  const patched = [];
  const wrap = (obj, name, tag) => { const o = obj[name]; if (typeof o !== 'function') return; obj[name] = function () { hits.push(`${tag}.${name}`); return o.apply(this, arguments); }; patched.push([obj, name, o]); };
  for (const n of ['readFileSync', 'openSync', 'statSync', 'lstatSync', 'existsSync', 'readdirSync', 'writeFileSync', 'accessSync', 'realpathSync']) wrap(fs, n, 'fs');
  for (const n of ['spawnSync', 'spawn', 'execSync', 'execFileSync', 'exec', 'execFile', 'fork']) wrap(cp, n, 'child_process');
  const realEnv = process.env;
  process.env = new Proxy(realEnv, {
    get(t, k, r) { hits.push(`env.get ${String(k)}`); return Reflect.get(t, k, r); },
    has(t, k) { hits.push(`env.has ${String(k)}`); return Reflect.has(t, k); },
    ownKeys(t) { hits.push('env.ownKeys'); return Reflect.ownKeys(t); },
  });
  let result;
  let error = null;
  try { result = fn(); } catch (e) { error = e; } finally {
    process.env = realEnv;
    for (const [obj, name, o] of patched) obj[name] = o;
  }
  return { hits, result, error };
}

async function parserGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    const rows = loadRows(check, context);
    if (!core || !rows) return;
    await step('the core exports exactly the four names; the blocked list and the hook constant are frozen and exact; both functions are synchronous and pure', async () => {
      check(eq(sorted(Object.keys(core)), sorted(CORE_EXPORTS)), `${GUARD_CORE_REL} exports exactly ${CORE_EXPORTS.join(', ')}`, Object.keys(core));
      check(Array.isArray(core.BLOCKED_SUBCOMMANDS) && eq([...core.BLOCKED_SUBCOMMANDS], BLOCKED) && core.BLOCKED_SUBCOMMANDS.length === 13, 'BLOCKED_SUBCOMMANDS is the 13 pinned strings in the pinned order', core.BLOCKED_SUBCOMMANDS);
      check(Object.isFrozen(core.BLOCKED_SUBCOMMANDS), 'BLOCKED_SUBCOMMANDS is frozen');
      check(eq(core.RAW_GIT_HOOK, H) && eq(Object.keys(core.RAW_GIT_HOOK || {}), ['event', 'matcher', 'command']) && deepFrozen(core.RAW_GIT_HOOK), 'RAW_GIT_HOOK is the frozen { event, matcher, command } of plan 3.7', core.RAW_GIT_HOOK);
      check(typeof core.inspectCommand === 'function' && typeof core.evaluateHookInput === 'function', 'both functions are exported');
      const a = core.inspectCommand('git status');
      const b = core.evaluateHookInput(MIN_ALLOW);
      check(typeof a === 'string' && !(a && typeof a.then === 'function') && b && typeof b === 'object' && typeof b.then !== 'function', 'inspectCommand and evaluateHookInput return plain values, not promises', { a: typeof a, b: typeof b });
    });
    await step('import safety: importing the core performs no write, spawn, output, exit or environment change', async () => {
      await withScratch(context, 'probe-core', async (dir) => { checkImportSafe(check, GUARD_CORE_REL, context, dir, assetUrl(context, GUARD_CORE_REL), CORE_EXPORTS); });
    });
    await step('purity: no filesystem access, environment lookup or spawn while the functions run (recorded), and no such import in the source', async () => {
      const sample = rows.filter((r) => ['P01', 'P28', 'P32', 'P35', 'P53', 'P70', 'P76', 'H01', 'G03-raw', 'S05'].includes(r.id));
      const rec = withRecorders(() => {
        const out = [];
        for (const r of sample) { out.push(core.inspectCommand(r.command, r.toolName)); out.push(core.evaluateHookInput(envelope(r.toolName, r.command))); }
        return out;
      });
      check(rec.error === null, 'the recorded run did not throw', rec.error && errMsg(rec.error));
      check(rec.hits.length === 0, 'no fs, child_process or process.env access happened during inspectCommand and evaluateHookInput', rec.hits.slice(0, 5));
      const src = readText(path.join(context.skillRoot, ...GUARD_CORE_REL.split('/')));
      if (src === null) { check(false, `${GUARD_CORE_REL} is readable`); return; }
      const code = stripComments(src);
      check(!/\bfrom\s*['"](node:)?(fs|child_process|os|process|worker_threads|net|http|https|readline)(\/[a-z]+)?['"]/.test(code) && !/\brequire\s*\(/.test(code), 'the core imports no fs, child_process, os, process or network module');
      check(!/\bprocess\.(env|argv|exit|stdin|stdout|stderr|exitCode|cwd)\b/.test(code), 'the core never touches process.env, argv, streams, exit or cwd');
    });
    await step('the parser rows of plan 4.2 (the P, H, L and X rows not owned by the other two groups)', async () => {
      const mine = rows.filter((r) => groupOf(r.id) === 'parser');
      check(mine.length === 97, 'the parser group owns the 97 remaining rows', mine.length);
      runRows(check, core, mine);
    });
    await step('plan 3.2 and 3.3: invalid types are malformed rather than thrown; lexical failures anywhere win over a block; NUL, dangling escapes and unmatched constructs are malformed', async () => {
      const inspect = (c, t) => (t === undefined ? core.inspectCommand(c) : core.inspectCommand(c, t));
      check(inspect('git diff') === 'block', 'the tool name defaults to Bash when omitted (git diff blocks)');
      check(inspect('git diff', 'PowerShell') === 'block' && inspect('git status', 'PowerShell') === 'allow', 'the PowerShell tool name is accepted');
      for (const bad of [7, null, undefined, {}, [], true, Buffer.from('git status')]) {
        const r = await attempt(() => core.inspectCommand(bad));
        check(!r.threw && r.value === 'malformed', `a non-string command ${show(bad)} is malformed and never throws`, r.threw ? errMsg(r.error) : r.value);
      }
      for (const t of [7, null, {}, true]) {
        const r = await attempt(() => core.inspectCommand('git status', t));
        check(!r.threw && r.value === 'malformed', `a non-string tool name ${show(t)} is malformed and never throws`, r.threw ? errMsg(r.error) : r.value);
      }
      // PLAN-GAP: the plan pins the omitted tool name only; an explicit undefined and an unknown string tool name are not pinned, so only "no throw and a valid result" is asserted.
      for (const t of [undefined, 'Other', 'bash', '']) {
        const r = await attempt(() => core.inspectCommand('git status', t));
        check(!r.threw && ['allow', 'block', 'malformed'].includes(r.value), `tool name ${show(t)}: no throw and one of the three results`, r.threw ? errMsg(r.error) : r.value);
      }
      const lexical = [
        ['a NUL byte', 'git status\0'], ['a Bash dangling escape', 'git status \\'], ['an unterminated command substitution', 'echo $(git status'], ['an unpaired backtick', 'echo `git status'],
        ['an unterminated single quote', "git commit -m 'x"], ['a lexical failure after a block', 'git diff; echo "unterminated'], ['a lexical failure before a block', 'echo "unterminated; git diff'],
        ['an unterminated heredoc after a block', "git log; cat <<'EOF'\nbody"], ['an unterminated process substitution', 'cat <(git log'],
      ];
      for (const [label, c] of lexical) check(inspect(c) === 'malformed', `${label} is malformed (lexical failure wins over a block)`, inspect(c));
      check(inspect("git commit -m 'x", 'PowerShell') === 'malformed' && inspect('git status `', 'PowerShell') === 'malformed', 'PowerShell: an unterminated quote and a final escaping backtick are malformed');
      const nest = (n, open, close) => open.repeat(n) + 'git status' + close.repeat(n);
      // PLAN-GAP: "nested groups/substitutions limited to 128, greater depth is malformed" does not say how depth is counted at the top level; the boundary below treats 128 enclosing constructs as allowed and 129 as malformed.
      check(inspect(nest(128, '$(', ')')) === 'allow' && inspect(nest(129, '$(', ')')) === 'malformed', 'substitution depth: 128 nested is allowed and 129 is malformed', { at: inspect(nest(128, '$(', ')')), over: inspect(nest(129, '$(', ')')) });
      check(inspect(nest(128, '(', ')')) === 'allow' && inspect(nest(129, '(', ')')) === 'malformed', 'group depth: 128 nested is allowed and 129 is malformed', { at: inspect(nest(128, '(', ')')), over: inspect(nest(129, '(', ')')) });
      check(inspect(nest(300, '$(', ')')) === 'malformed', 'a deeper nest never overflows the stack into a throw');
    });
    await step('plan 3.4 and C6-P2-2: several pending heredocs, exact terminator lines, here-string bodies, substitution contexts and comments inside them; executables that are not Git', async () => {
      const rowsX = [
        ["cat <<'A' <<'B'\ngit diff\nA\ngit show\nB\ngit status", 'Bash', 'allow'], ["cat <<'A' <<'B'\none\nA\ntwo\nB\ngit log", 'Bash', 'block'],
        ["cat <<'EOF'\nEOF \ngit log\nEOF", 'Bash', 'allow'], ['cat <<EOF\n  EOF\ngit log\nEOF', 'Bash', 'allow'], ['cat <<-EOF\n\t\tgit log\n\tEOF\ngit status', 'Bash', 'allow'],
        ["cat <<'EOF'\ngit diff\nEOF\ngit show", 'Bash', 'block'], ['cat <<EOF\nbody', 'Bash', 'malformed'], ['cat <<', 'Bash', 'malformed'], ["cat <<''\nx\n", 'Bash', 'malformed'],
        ["git commit -m @'\nfoo '@\n'@", 'PowerShell', 'allow'], ["git commit -m @'\nbody\n'@; git log", 'PowerShell', 'block'], ["git commit -m @'\nbody\n'@\ngit status", 'PowerShell', 'allow'],
        ["git status @'x'", 'PowerShell', 'allow'], ['git commit -m @"\n$(git log)\n"@', 'PowerShell', 'allow'],
        ['echo "$(echo \'a)b\')"', 'Bash', 'allow'], ['echo $(echo "a)b")', 'Bash', 'allow'], ['echo $(git status # git log\n)', 'Bash', 'allow'], ['echo "$(git log # c\n)"', 'Bash', 'block'],
        ['echo $(cat <<EOF\ngit log\nEOF\n)', 'Bash', 'allow'], ["echo `cat <<'EOF'\ngit log\nEOF\n`", 'Bash', 'allow'], ['echo <(cat <<EOF\nx\nEOF\n)', 'Bash', 'allow'],
        ['git-wrapper log', 'Bash', 'allow'], ['git.dll log', 'Bash', 'allow'], ['git-safe.mjs log', 'Bash', 'allow'], ['./git-wrapper show HEAD', 'Bash', 'allow'], ['mygit.exe diff', 'Bash', 'allow'],
        ['./tools/git log', 'Bash', 'block'], ['"./my tools/git.exe" log', 'Bash', 'block'], ["'/usr/bin/git' diff", 'Bash', 'block'], ['GIT.EXE show HEAD', 'Bash', 'block'], ['/usr/bin/GIT log', 'Bash', 'block'],
      ];
      for (const [c, t, want] of rowsX) check(core.inspectCommand(c, t) === want, `${t}: ${clip(c)} is ${want}`, core.inspectCommand(c, t));
    });
  });
}

// ================================================ R50/C6/sanctioned ====
async function sanctionedGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    const rows = loadRows(check, context);
    if (!core || !rows) return;
    await step('G01-G08 are allowed, every raw follower (G01-raw to G07-raw with && git log, G08-raw with ; git show HEAD) blocks, and a PowerShell node invocation stays allowed until a later raw segment', async () => {
      const mine = rows.filter((r) => groupOf(r.id) === 'sanctioned');
      check(mine.length === 18, 'the group owns G01-G08, the eight followers, P102 and P103', mine.map((r) => r.id));
      for (const name of ['diff', 'log', 'show', 'cat', 'ls', 'grep', 'review-diff']) {
        check(mine.some((r) => r.expected === 'allow' && r.command.startsWith(`node .ai/tools/git-safe.mjs ${name} `)), `a sanctioned row exercises git-safe ${name}`);
      }
      check(mine.filter((r) => r.id.endsWith('-raw')).every((r) => r.expected === 'block'), 'every follower row expects a block');
      runRows(check, core, mine);
    });
    await step('there is no git-safe substring exemption: a raw Git command that merely names git-safe still blocks', async () => {
      for (const c of ['git log node .ai/tools/git-safe.mjs', 'git show HEAD # node .ai/tools/git-safe.mjs', 'echo node .ai/tools/git-safe.mjs && git diff', 'node .ai/tools/git-safe.mjs log $(git show HEAD)', 'git -c core.x=.ai/tools/git-safe.mjs log']) {
        check(core.inspectCommand(c) === 'block', `still blocked: ${clip(c)}`, core.inspectCommand(c));
      }
      for (const c of ['node .ai/tools/git-safe.mjs log', 'node ./.ai/tools/git-safe.mjs show HEAD', 'node "$CLAUDE_PROJECT_DIR/.ai/tools/git-safe.mjs" ls HEAD', 'git status && node .ai/tools/git-safe.mjs log -p -n1 HEAD']) {
        check(core.inspectCommand(c) === 'allow', `not raw Git: ${clip(c)}`, core.inspectCommand(c));
      }
    });
  });
}

// ================================================= R84/C6/arguments ====
async function argumentsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    const rows = loadRows(check, context);
    if (!core || !rows) return;
    await step('S01-S16 (every stash form blocks), the patch and alias rows, the missing-value rows and the ordinary orchestrator commands', async () => {
      const mine = rows.filter((r) => groupOf(r.id) === 'arguments');
      check(mine.filter((r) => /^S\d\d$/.test(r.id)).length === 16 && mine.filter((r) => /^S\d\d$/.test(r.id)).every((r) => r.expected === 'block'), 'sixteen stash rows, all expecting a block');
      check(['P53', 'P57', 'P58', 'P59', 'P62', 'P63', 'P64', 'P65'].every((id) => mine.some((r) => r.id === id && r.expected === 'allow')), 'the ordinary commit, push, checkout, merge, reset and status rows are owned here and allowed');
      runRows(check, core, mine);
    });
    await step('standalone patch arguments: attached values, bundled flags, valued options and the -- marker follow the consumption table of plan 3.5', async () => {
      const cases = [
        ['git commit -m -p', 'allow'], ['git commit -F -p', 'allow'], ['git commit --file -p', 'allow'], ['git commit --message -p', 'allow'], ['git commit -C HEAD -p', 'block'],
        ['git commit -c HEAD --patch', 'block'], ['git commit --reuse-message HEAD --patch', 'block'], ['git commit -mfoo -p', 'block'], ['git commit -m-p', 'allow'], ['git commit --author=-p', 'allow'],
        ['git commit --author -p', 'allow'], ['git commit --date -p', 'allow'], ['git commit --template -p', 'allow'], ['git commit --cleanup -p', 'allow'], ['git checkout -b -p', 'allow'],
        ['git checkout -B -p', 'allow'], ['git checkout --orphan -p', 'allow'], ['git fetch --upload-pack -p', 'allow'], ['git fetch --receive-pack -p', 'allow'], ['git fetch --repo -p', 'allow'],
        ['git add -p', 'block'], ['git add --patch', 'block'], ['git add -- --patch', 'block'], ['git checkout --patch', 'block'], ['git reset -p', 'block'], ['git restore -p', 'block'],
        // PLAN-GAP: none; bundled short flags are explicitly outside the standalone rule (plan 3.5), so -ap is allowed.
        ['git add -ap', 'allow'], ['git commit --author', 'allow'], ['git commit -F', 'allow'],
      ];
      for (const [c, want] of cases) check(core.inspectCommand(c) === want, `${clip(c)}: ${want}`, core.inspectCommand(c));
    });
    await step('inline alias overrides: the key is the part before the first =, attached, separate, quoted and upper-case spellings block; other configuration keys do not', async () => {
      const cases = [
        ['git -c alias.x status', 'block'], ['git -c Alias.X=log status', 'block'], ['git -calias.x=status status', 'block'], ["git -c 'alias.x=!git log' status", 'block'], ['git -c "alias.x" status', 'block'],
        ['git -C . -c alias.y=z status', 'block'], ['git -c core.alias=x status', 'allow'], ['git -c color.ui=alias.x status', 'allow'], ['git -c user.name=alias.x status', 'allow'],
        ['git -c alias.x=status -c color.ui=false status', 'block'],
      ];
      for (const [c, want] of cases) check(core.inspectCommand(c) === want, `${clip(c)}: ${want}`, core.inspectCommand(c));
    });
    await step('recognized global options consume their value; an unrecognized option does not consume the next token', async () => {
      const cases = [
        ['git -C src status', 'allow'], ['git -C src diff', 'block'], ['git --namespace x status', 'allow'], ['git --namespace=x log', 'block'], ['git --work-tree w --git-dir g log', 'block'],
        ['git --bare log', 'block'], ['git --no-optional-locks diff', 'block'], ['git --literal-pathspecs show HEAD', 'block'], ['git --unknown log', 'block'], ['git --unknown status', 'allow'],
        ['git -C . status', 'allow'], ['git -C', 'malformed'], ['git --git-dir', 'malformed'], ['git -c', 'malformed'], ['git -C . --work-tree', 'malformed'],
      ];
      for (const [c, want] of cases) check(core.inspectCommand(c) === want, `${clip(c)}: ${want}`, core.inspectCommand(c));
    });
  });
}

// ============================================== R50/C6/documentation ====
const README_PARAGRAPHS = [
  'The Claude raw-Git hook is a guardrail, not a sandbox. It blocks the documented raw-history commands and standalone patch arguments while permitting ordinary orchestrator commands and the seven git-safe commands. A separate raw-Git command after git-safe is still checked. Setup draft review uses apply.mjs diff; git diff --no-index has no exemption.',
  'Known gaps include sh -c, aliases, scripts that spawn Git and node -e. PowerShell gaps include indirect or computed invocation, dynamically constructed command names, script blocks and encoded commands. Backtick handling does not make this a complete shell parser.',
  `The installed candidate is ${HOOK_COMMAND}. Host portability is TO VERIFY. Direct Node self-tests do not establish host launch, matcher, input-envelope or exit-handling behavior.`,
  'The hook executes project code and therefore depends on the trusted-checkout boundary.',
];
const SELFTEST_TRANSCRIPT = 'PASS  guard-raw-git/allowed\nPASS  guard-raw-git/blocked\nPASS  guard-raw-git/malformed\n3 PASS / 0 FAIL\n';
const CLAUDE_TABLE = ['| Exit | stdout | stderr | Intended host result |', '| --- | --- | --- | --- |', '| 0 | empty | empty | permit |', '| 2 | empty | blocked message | deny |', '| 1 | empty | malformed message | continue with warning |'];
async function documentationGroup(context) {
  return runAssertion(async ({ check, step }) => {
    await step('README.md carries the four hook paragraphs of plan 3.13 (line wrapping is free)', async () => {
      const doc = readText(path.join(context.skillRoot, 'README.md'));
      if (doc === null) { check(false, 'README.md is readable'); return; }
      const flat = squash(doc);
      for (const [i, p] of README_PARAGRAPHS.entries()) check(flat.includes(squash(p)), `README hook paragraph ${i + 1} is present`, p.slice(0, 80));
    });
    await step('references/claude.md replaces the obsolete default-hook text and carries the pinned substrings, the exact table and the two process messages', async () => {
      const raw = readText(path.join(context.skillRoot, 'references', 'claude.md'));
      if (raw === null) { check(false, 'references/claude.md is readable'); return; }
      const doc = raw.replace(/\r\n/g, '\n');
      const flat = squash(doc);
      check(!doc.includes('Not generated by default. If the user asks for one, use the current shape and read the event from stdin JSON:'), 'the obsolete "Not generated by default" sentence is gone');
      check(flat.includes(squash(JSON.stringify(E, null, 2))), 'the canonical E JSON of plan 3.7 is shown (whitespace is free)');
      for (const s of ['PreToolUse', 'Bash|PowerShell', 'node .ai/tools/hooks-selftest.mjs', '--hooks-only', SKIP_READY, 'TO VERIFY']) check(doc.includes(s), `the document contains ${show(s)}`);
      check(doc.includes('guard-raw-git: raw Git command blocked; use node .ai/tools/git-safe.mjs') && doc.includes('guard-raw-git: could not parse command; allowed without checking'), 'the complete BLOCK and MALFORMED messages are present');
      const lines = doc.split('\n').map((l) => l.replace(/\s+$/, ''));
      const at = lines.indexOf(CLAUDE_TABLE[0]);
      check(at >= 0 && CLAUDE_TABLE.every((row, i) => lines[at + i] === row), 'the exact exit table of plan 3.13 is present as consecutive lines', at);
      check(doc.includes(SELFTEST_TRANSCRIPT.trimEnd().split('\n')[0]) && SELFTEST_TRANSCRIPT.trimEnd().split('\n').every((l) => doc.includes(l)), 'the exact self-test success transcript lines are stated');
      // PLAN-GAP: the plan lists topics the document must "also state" (host uncertainties, conditional insertion, non-adoption of user duplicates, hooks-only layering, C10's exact-output requirement) without
      // exact wording. Only stable tokens are asserted: the tool_input.command field, backslash and non-ASCII path uncertainties, and C10.
      for (const s of ['tool_input.command', 'C10']) check(doc.includes(s), `the document names ${s}`);
      check(/backslash/i.test(doc) && /non-ASCII/i.test(doc), 'the Git Bash backslash and non-ASCII project path uncertainties are named');
    });
  });
}

// ================================================= R51/C6/process ====
// Plan 3.1, 3.6 and 4.3: direct hook processes with exact status and stream bytes. One process per case; no parser row launches one.
function runHook(context, o = {}) {
  const pre = (o.preload ? [o.preload] : []).flatMap((p) => ['--require', p]);
  const r = spawnSync(process.execPath, [...pre, o.hook, ...(o.args || [])], {
    input: o.input, cwd: o.cwd || path.dirname(o.hook), env: o.env || context.env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 60000, maxBuffer: 8388608,
  });
  countProcess(context);
  return { code: r.status, signal: r.signal, error: r.error ? String(r.error.code || r.error.message) : null, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function expectOutcome(check, label, r, outcome) {
  check(r.error === null && r.signal === null, `${label}: the process ended normally`, { error: r.error, signal: r.signal });
  check(r.code === outcome.exitCode && r.stdout === outcome.stdout && r.stderr === outcome.stderr, `${label}: exit ${outcome.exitCode} with the exact stream bytes`, { code: r.code, stdout: clip(r.stdout), stderr: clip(r.stderr) });
}
const hookPathOf = (context) => path.join(context.skillRoot, ...GUARD_REL.split('/'));
async function processGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const rows = loadRows(check, context);
    const row = (id) => (rows || []).find((r) => r.id === id);
    const hook = hookPathOf(context);
    const p35 = row('P35');
    const p70 = row('P70');
    const p107 = row('P107');
    if (!rows || !p35 || !p70 || !p107) { failures.push('the fixture rows P35, P70 and P107 are required by the process cases'); return; }
    const run = (input, o = {}) => runHook(context, { hook, input, ...o });
    await step('cases 1-9: allow, block, the PowerShell escape block, and the five malformed inputs (invalid JSON, {}, command:7, an unterminated quote, unexpected argv, the nesting limit)', async () => {
      expectOutcome(check, 'case 1 Bash git status', run(MIN_ALLOW), OUT.allow);
      expectOutcome(check, 'case 2 Bash git diff', run(MIN_BLOCK), OUT.block);
      expectOutcome(check, 'case 3 PowerShell P35', run(envelope(p35.toolName, p35.command)), OUT.block);
      expectOutcome(check, 'case 4 invalid JSON', run('{'), OUT.malformed);
      expectOutcome(check, 'case 5 {}', run('{}'), OUT.malformed);
      expectOutcome(check, 'case 6 command:7', run('{"tool_name":"Bash","tool_input":{"command":7}}'), OUT.malformed);
      expectOutcome(check, 'case 7 an unterminated quoted command', run(envelope(p70.toolName, p70.command)), OUT.malformed);
      expectOutcome(check, 'case 8 valid allow input with unexpected argv', run(MIN_ALLOW, { args: ['--unexpected'] }), OUT.malformed);
      expectOutcome(check, 'case 9 P107 nesting beyond the limit (a RangeError must not leak a stack trace)', run(envelope(p107.toolName, p107.command)), OUT.malformed);
    });
    await step('case 10: launched through a directory junction (a symlink off Windows) whose launch path differs from the real path, git diff still blocks (never a silent successful no-op)', async () => {
      const guard = readBytes(hook);
      const core = readBytes(path.join(context.skillRoot, ...GUARD_CORE_REL.split('/')));
      if (guard === null || core === null) { check(false, 'the guard entrypoint and core sources are readable for the alternate-path launch'); return; }
      await withScratch(context, 'alt', async (dir) => {
        const proj = path.join(dir, 'project');
        putFile(path.join(proj, '.ai', 'tools', 'guard-raw-git.mjs'), guard);
        putFile(path.join(proj, '.ai', 'tools', 'guard-raw-git-core.mjs'), core);
        const link = path.join(dir, 'project-link');
        // Failure to establish the alternate path fails the assertion; it is never silently omitted (C4 launch-test decision).
        if (!linkDir(proj, link)) { check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'} for the alternate-path launch`); return; }
        const via = path.join(link, '.ai', 'tools', 'guard-raw-git.mjs');
        const real = fs.realpathSync.native(via);
        const lc = (p) => (WIN ? path.resolve(p).toLowerCase() : path.resolve(p));
        check(exists(via) && lc(real) !== lc(via), 'premise: the launch path differs from the real path', { via, real });
        expectOutcome(check, 'case 10 alternate-path launch', runHook(context, { hook: via, input: MIN_BLOCK, cwd: link }), OUT.block);
      });
    });
    await step('case 11 (C6-P2-5): a failing fs.readFileSync(0) through a -r preload is the exact malformed result, with no stack trace', async () => {
      await withScratch(context, 'stdin', async (dir) => {
        const pre = path.join(dir, 'break-stdin.cjs');
        fs.writeFileSync(pre, [
          "'use strict';", "const fs = require('fs');", 'const rfs = fs.readFileSync;', 'const rs = fs.readSync;',
          "const boom = () => { const e = new Error('EIO: injected stdin failure'); e.code = 'EIO'; throw e; };",
          'fs.readFileSync = function (p) { if (p === 0 || p === "/dev/stdin") boom(); return rfs.apply(this, arguments); };',
          'fs.readSync = function (fd) { if (fd === 0) boom(); return rs.apply(this, arguments); };',
        ].join('\n') + '\n');
        const r = run(MIN_ALLOW, { preload: pre });
        expectOutcome(check, 'case 11 stdin read failure', r, OUT.malformed);
        check(!/(at |Error|EIO|injected|\.mjs)/.test(r.stderr.replace(MALFORMED_STDERR, '')), 'no native error text or stack trace follows the fixed message', clip(r.stderr));
      });
    });
    await step('C6-P2-4: a missing guard core is the same exact malformed result (the core is loaded with a dynamic import inside the same try/catch)', async () => {
      const guard = readBytes(hook);
      if (guard === null) { check(false, 'the guard entrypoint source is readable'); return; }
      // PLAN-GAP: the process budget of plan 4.8 lists 10 direct hook invocations plus the stdin case; this one process covers the C6-P2-4 addendum item and is counted in the diagnostics.
      await withScratch(context, 'nocore', async (dir) => {
        putFile(path.join(dir, 'guard-raw-git.mjs'), guard);
        expectOutcome(check, 'a guard entrypoint beside no core', runHook(context, { hook: path.join(dir, 'guard-raw-git.mjs'), input: MIN_ALLOW, cwd: dir }), OUT.malformed);
      });
    });
    flushProcessCount(context, 'R51/C6/process');
  });
}

// ================================================ R51/C6/malformed ====
const ENVELOPE_MATRIX = [
  '', 'null', '[]', '{"tool_name":"Bash"}', '{"tool_name":"Bash","tool_input":[]}', '{"tool_name":"Other","tool_input":{"command":"git status"}}',
  '{"tool_input":{"command":"git status"}}', '{"tool_name":"Bash","tool_input":{"command":null}}',
];
async function malformedGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    if (!core) return;
    const ev = (t) => core.evaluateHookInput(t);
    await step('the plan 4.3 envelope matrix: every case equals the exact malformed outcome (no JSON permission response, nothing echoed)', async () => {
      for (const t of ENVELOPE_MATRIX) check(eq(ev(t), OUT.malformed), `malformed envelope ${show(t)}`, ev(t));
    });
    await step('further malformed inputs: structure, types, exact tool names, multiple documents, trailing text and non-string input', async () => {
      const bad = [
        '{', '[', '"x"', '5', 'true', '{"tool_name":"Bash","tool_input":{"command":"git status"}} x', '{"tool_name":"Bash","tool_input":{"command":"git status"}}{"tool_name":"Bash","tool_input":{"command":"git status"}}',
        '{"tool_name":"bash","tool_input":{"command":"git status"}}', '{"tool_name":"powershell","tool_input":{"command":"git status"}}', '{"tool_name":"Bash ","tool_input":{"command":"git status"}}',
        '{"tool_name":["Bash"],"tool_input":{"command":"git status"}}', '{"tool_name":"Bash","tool_input":null}', '{"tool_name":"Bash","tool_input":"git status"}',
        '{"tool_name":"Bash","tool_input":{"command":7}}', '{"tool_name":"Bash","tool_input":{"command":["git","status"]}}', '{"tool_name":"Bash","tool_input":{}}',
        '{"tool_name":"Bash","tool_input":{"cmd":"git status"}}', '{"tool_name":null,"tool_input":{"command":"git status"}}', '{"tool_name":"Bash","tool_input":{"command":"git commit \\"SECRET-MARKER-123"}}',
        '['.repeat(200000),
      ];
      for (const t of bad) {
        const r = await attempt(() => ev(t));
        check(!r.threw && eq(r.value, OUT.malformed), `malformed input ${clip(t)}`, r.threw ? errMsg(r.error) : r.value);
      }
      for (const t of [undefined, null, 7, {}, [], true, Buffer.from(MIN_ALLOW)]) {
        const r = await attempt(() => ev(t));
        check(!r.threw && eq(r.value, OUT.malformed), `non-string input ${show(t)} is malformed and never throws`, r.threw ? errMsg(r.error) : r.value);
      }
    });
    await step('valid inputs: extra host fields are ignored, surrounding JSON whitespace is allowed, both tool names work, an empty command allows', async () => {
      const ex = '{"session_id":"s","hook_event_name":"PreToolUse","cwd":"/x","tool_name":"Bash","tool_input":{"command":"git status","description":"d","extra":[1,{"a":2}]},"extra":null}';
      check(eq(ev(ex), OUT.allow), 'extra fields do not change an allow', ev(ex));
      check(eq(ev(ex.replace('git status', 'git diff')), OUT.block), 'extra fields do not change a block');
      check(eq(ev(`  \n\t${MIN_ALLOW}\r\n  `), OUT.allow), 'surrounding JSON whitespace is allowed');
      check(eq(ev(envelope('PowerShell', 'git status')), OUT.allow) && eq(ev(envelope('PowerShell', 'git diff')), OUT.block), 'the PowerShell tool name is accepted');
      check(eq(ev(envelope('Bash', '')), OUT.allow) && eq(ev(envelope('Bash', '   ')), OUT.allow), 'empty and whitespace-only commands allow');
      check(eq(ev(envelope('Bash', 'git commit -m "caf\u00e9 \u4e2d"')), OUT.allow), 'non-ASCII text inside a command is ordinary');
    });
    await step('outcome objects are fresh plain values with exactly exitCode, stdout and stderr', async () => {
      const a = ev(MIN_ALLOW);
      const b = ev(MIN_BLOCK);
      check(eq(Object.keys(a), ['exitCode', 'stdout', 'stderr']) && eq(Object.keys(b), ['exitCode', 'stdout', 'stderr']), 'the outcome keys are exactly exitCode, stdout, stderr', { a: Object.keys(a), b: Object.keys(b) });
      a.exitCode = 99;
      check(ev(MIN_ALLOW).exitCode === 0, 'mutating a returned outcome does not change later results');
    });
  });
}

// ============================================ toolkit: repositories and CLIs ====
// Every CLI call is shell-free with the absolute Node executable; a process that ends abnormally fails the calling assertion once.
function execNode(context, { cwd, script, args = [], env = null, preload = null }) {
  const pre = Array.isArray(preload) ? preload : preload ? [preload] : [];
  const argv = [...pre.flatMap((p) => ['--require', p]), script, ...args];
  const r = spawnSync(process.execPath, argv, { cwd, env: env || context.env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 120000, maxBuffer: 16777216 });
  countProcess(context);
  let dead = null;
  if (r.error) dead = `${r.error.code || 'error'}: ${String(r.error.message).slice(0, 120)}`;
  else if (r.signal) dead = `signal ${r.signal}`;
  const stdout = r.stdout || '';
  let json = null;
  try { json = JSON.parse(stdout); } catch { /* not JSON */ }
  return { code: r.status, stdout, stderr: r.stderr || '', json, dead };
}
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
    merge: (root, args, o = {}) => invoke('merge-claude-settings', scripts('merge-claude-settings'), args, { cwd: root, ...o }),
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
    hooksOnly: (root, id, o = {}) => kit.merge(root, ['--run-id', id, '--hooks-only'], o),
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
const readManifestFile = (root) => readJson(manifestPath(root));
const projectSnapshot = (root) => snapshotTree(root, ['.git']);
// Everything outside the run directory: the project's files, manifest, lock and policy (a write failure may leave run-local staging partly updated).
const outsideRunSnapshot = (root) => JSON.stringify(walkTree(root, ['.git']).filter(([rel]) => !rel.startsWith('.ai/.run')));
const draftRel = (id) => `.ai/.run/${id}/drafts/.claude/settings.json`;
const runRel = (id, name) => `.ai/.run/${id}/${name}`;
function gitCmd(context, cwd, args) {
  const r = spawnSync('git', args, { cwd, env: context.env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 60000 });
  countProcess(context);
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
// The run ID of every hooks-only fixture (plan 4.5 names run-c6-bytes; the other staging and transaction fixtures use it too, so one prepared base serves them all).
const RID = 'run-c6-bytes';
// A plain synthetic repository, committed, with the lock held and the run initialized (clones inherit both). No settings file, no policy, no manifest.
const getPlain = (context) => cached(context, 'plain', async () => {
  const dir = scratchDir(context, 'plain');
  const root = path.join(dir, 'root');
  makeRepo(context, root, { 'package.json': '{"name":"fixture-app"}\n', 'src/a.ts': 'export {}\n' });
  const kit = makeKit(context, mkCheck([]));
  if (!kit.begin(root, RID)) throw new Error('cannot begin a run in the plain project');
  return { dir, root };
});
async function usePlain(failures, context) {
  try { return await getPlain(context); } catch (e) { failures.push(`cannot build the plain project: ${errMsg(e)}`); return null; }
}
// The trusted sources of the seven runtime members, read from the skill (never from the code under test beyond its own shipped files).
function trustedUnit(context) {
  const bytesOf = {};
  const missing = [];
  for (const t of UNIT) {
    const b = readBytes(path.join(context.skillRoot, ...SRC_OF[t].split('/')));
    if (b === null) missing.push(SRC_OF[t]); else bytesOf[t] = b;
  }
  return { bytes: bytesOf, missing };
}
function loadTrusted(failures, context) {
  const t = trustedUnit(context);
  if (t.missing.length) { failures.push(`cannot read the trusted runtime sources: ${t.missing.join(', ')}`); return null; }
  return t.bytes;
}
// Stages the guard entrypoint and its core as drafts (what C3 stage does for every catalog member).
function stageGuard(root, id, tb, over = {}) {
  putDraft(root, id, T_GUARD, over[T_GUARD] !== undefined ? over[T_GUARD] : tb[T_GUARD]);
  putDraft(root, id, T_GUARD_CORE, over[T_GUARD_CORE] !== undefined ? over[T_GUARD_CORE] : tb[T_GUARD_CORE]);
}
function installGuard(root, tb, over = {}) {
  putFile(projPath(root, T_GUARD), over[T_GUARD] !== undefined ? over[T_GUARD] : tb[T_GUARD]);
  putFile(projPath(root, T_GUARD_CORE), over[T_GUARD_CORE] !== undefined ? over[T_GUARD_CORE] : tb[T_GUARD_CORE]);
}
// A project settings file in the serialization style of plan 4.5: indentation, EOL, BOM and final newline.
function ser(v, { indent = 2, eol = '\n', bom = false, final = true } = {}) {
  let t = JSON.stringify(v, null, indent);
  if (final) t += '\n';
  if (eol === '\r\n') t = t.replace(/\n/g, '\r\n');
  return (bom ? '\ufeff' : '') + t;
}
const OWNER_KEYS = { [T_SETTINGS]: 'keys' };
const manifestOf = (files) => jsonText({ schema: 3, skill: 'project-setup', skillVersion: '3.0.0-rc.1', mode: 'update', agents: ['claude'], sourceCommit: null, files });

// F: the C6 staging failure envelope of plan 3.10: { ok:false, code, error, target }, two-space JSON, final LF, stdout only, empty stderr.
function expectStageErr(check, label, r, { code, exit, error, target }) {
  check(r.dead === null || r.dead === undefined, `${label}: the process ended normally`, r.dead);
  check(r.code === exit, `${label}: exit code ${exit}`, { code: r.code, stdout: r.stdout.slice(0, 300), stderr: r.stderr.slice(0, 200) });
  check(r.stderr === '', `${label}: empty stderr`, r.stderr.slice(0, 200));
  check(r.stdout === jsonText({ ok: false, code, error, target }), `${label}: the exact envelope { ok, code, error, target } (two-space JSON, one final LF)`, r.stdout.slice(0, 400));
}
// The hooks-only success envelope of plan 3.9, in its key order.
function expectHooksOk(check, label, r, { changed, metadataChanged, draft, report }) {
  check(r.dead === null || r.dead === undefined, `${label}: the process ended normally`, r.dead);
  check(r.code === 0 && r.stderr === '', `${label}: exit 0 with empty stderr`, { code: r.code, stdout: r.stdout.slice(0, 300), stderr: r.stderr.slice(0, 200) });
  check(r.json !== null && r.stdout === jsonText(r.json), `${label}: two-space JSON with one final LF`, r.stdout.slice(0, 200));
  if (!r.json) return false;
  check(eq(keysOf(r.json), ['ok', 'changed', 'metadataChanged', 'needsDecision', 'draft', 'report']) && eq(keysOf(r.json.report), ['hooks']) && eq(keysOf(r.json.report.hooks), ['added', 'alreadyPresent', 'alreadyCovered', 'skipped']), `${label}: the envelope keys are in the pinned order`, { top: keysOf(r.json), report: keysOf(r.json.report), hooks: keysOf(r.json.report && r.json.report.hooks) });
  const want = { ok: true, changed, metadataChanged, needsDecision: false, draft, report: { hooks: report } };
  check(eq(r.json, want), `${label}: the exact envelope values`, r.json);
  return eq(r.json, want);
}
// A read recorder (a -r preload): every read of the watched paths is logged and allowed.
let preloadSeq = 0;
function readGuard(dir, paths) {
  const log = path.join(dir, `guard-${++preloadSeq}.log`);
  const watch = [...new Set(paths.flatMap((p) => { const abs = path.resolve(p); const out = [WIN ? abs.toLowerCase() : abs]; try { out.push(WIN ? fs.realpathSync.native(abs).toLowerCase() : fs.realpathSync.native(abs)); } catch { /* absent */ } return out; }))];
  const source = [
    "'use strict';", "const fs = require('fs');", "const path = require('path');", `const CFG = ${JSON.stringify({ log, watch })};`, "const WIN = process.platform === 'win32';",
    "const norm = (p) => { let s; try { s = typeof p === 'string' ? p : Buffer.isBuffer(p) ? p.toString() : null; } catch (e) { return null; } if (s === null) return null; let a; try { a = path.resolve(s); } catch (e) { return null; } return WIN ? a.toLowerCase() : a; };",
    'const hit = (p) => { const n = norm(p); return n !== null && CFG.watch.includes(n); };',
    "const note = (op, p) => { try { fs.appendFileSync(CFG.log, JSON.stringify({ op: op, path: String(p) }) + '\\n'); } catch (e) { /* ignore */ } };",
    "for (const name of ['readFileSync', 'openSync']) { const orig = fs[name]; fs[name] = function (p) { if (hit(p)) note(name, p); return orig.apply(this, arguments); }; }",
  ].join('\n') + '\n';
  const file = path.join(dir, `guard-${preloadSeq}.cjs`);
  fs.writeFileSync(file, source);
  return { file, hits: () => (readText(log) || '').split('\n').filter(Boolean) };
}
// A write breaker (a -r preload): every write-like call that names a path under .ai/.run fails with EACCES.
function writeBreaker(dir) {
  const file = path.join(dir, `break-writes-${++preloadSeq}.cjs`);
  fs.writeFileSync(file, [
    "'use strict';", "const fs = require('fs');", 'const bad = (p) => { try { return typeof p === "string" && p.replace(/\\\\/g, "/").includes("/.ai/.run/"); } catch (e) { return false; } };',
    "const boom = (p) => { const e = new Error('EACCES: injected write failure'); e.code = 'EACCES'; e.path = String(p); throw e; };",
    "for (const name of ['writeFileSync', 'appendFileSync', 'renameSync', 'copyFileSync', 'mkdirSync', 'cpSync', 'symlinkSync', 'linkSync', 'truncateSync', 'unlinkSync', 'rmSync']) {",
    '  const orig = fs[name]; if (typeof orig !== "function") continue;',
    '  fs[name] = function () { for (let i = 0; i < Math.min(arguments.length, 2); i++) if (bad(arguments[i])) boom(arguments[i]); return orig.apply(this, arguments); };',
    '}',
    "const open = fs.openSync;",
    'fs.openSync = function (p, flags) { const w = typeof flags === "string" ? /[wax+]/.test(flags) : typeof flags === "number" && (flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT)) !== 0; if (w && bad(p)) boom(p); return open.apply(this, arguments); };',
  ].join('\n') + '\n');
  return file;
}
// A read breaker (a -r preload): every read of a watched path fails with EIO (an injected input failure for HOOK_STAGE_IO).
function readBreaker(dir, paths) {
  const watch = [...new Set(paths.flatMap((p) => { const abs = path.resolve(p); const out = [WIN ? abs.toLowerCase() : abs]; try { out.push(WIN ? fs.realpathSync.native(abs).toLowerCase() : fs.realpathSync.native(abs)); } catch { /* absent */ } return out; }))];
  const file = path.join(dir, `break-reads-${++preloadSeq}.cjs`);
  fs.writeFileSync(file, [
    "'use strict';", "const fs = require('fs');", "const path = require('path');", `const WATCH = ${JSON.stringify(watch)};`, "const WIN = process.platform === 'win32';",
    "const hit = (p) => { try { const s = typeof p === 'string' ? p : Buffer.isBuffer(p) ? p.toString() : null; if (s === null) return false; const a = path.resolve(s); return WATCH.includes(WIN ? a.toLowerCase() : a); } catch (e) { return false; } };",
    "const boom = (p) => { const e = new Error('EIO: injected read failure'); e.code = 'EIO'; e.path = String(p); throw e; };",
    "for (const name of ['readFileSync', 'openSync']) { const orig = fs[name]; fs[name] = function (p) { if (hit(p)) boom(p); return orig.apply(this, arguments); }; }",
  ].join('\n') + '\n');
  return file;
}

// ==================================================== R52/C6/merge ====
// Plan 3.7 and 4.4: the pure merge (M01-M14 and the additional checks, values only), then plan 4.5: the CLI byte fixtures C11, C12 and C14 and the normal-merge
// key placement. The pure rows assert values; serialization is asserted only by the CLI fixtures.
async function expectErr(check, label, fn, code, message) {
  const r = await attempt(fn);
  if (!r.threw) { check(false, `${label}: expected ${code}, got a result`, r.value); return null; }
  const e = r.error;
  check(e instanceof Error, `${label}: an Error instance`, e && e.constructor && e.constructor.name);
  check(hasOwn(e, 'code') && typeof e.code === 'string' && e.code === code, `${label}: code ${code}`, { code: e && e.code, message: e && e.message });
  check(e && e.message === message, `${label}: message is exactly ${show(message)}`, e && e.message);
  return e;
}
const hooksOf = (preTool) => ({ hooks: { PreToolUse: preTool } });
const M03_SETTINGS = hooksOf([U, O, V]);
const M01_RESULT = hooksOf([E]);
// [id, settings input, managed input, settings result, managed result, report]
const MERGE_ROWS = [
  ['M01', {}, {}, M01_RESULT, { hooks: [H] }, ADD],
  ['M02', hooksOf([U, V]), {}, hooksOf([U, V, E]), { hooks: [H] }, ADD],
  ['M03', M03_SETTINGS, { hooks: [H] }, M03_SETTINGS, { hooks: [H] }, OWN],
  ['M04', M03_SETTINGS, {}, M03_SETTINGS, {}, USER],
  ['M05', { hooks: { PostToolUse: [E] } }, {}, { hooks: { PostToolUse: [E], PreToolUse: [E] } }, { hooks: [H] }, ADD],
  ['M06', hooksOf([A]), {}, hooksOf([A, E]), { hooks: [H] }, ADD],
  ['M07', hooksOf([E, E]), {}, hooksOf([E, E]), {}, USER],
  ['M08', { hooks: [] }, {}, { hooks: [] }, {}, BAD],
  ['M09', hooksOf({}), { hooks: [] }, hooksOf({}), { hooks: [] }, BAD],
  ['M10', { hooks: { PostToolUse: [L] } }, {}, { hooks: { PostToolUse: [L], PreToolUse: [E] } }, { hooks: [H] }, ADD],
  ['M11', { permissions: { deny: [] }, hooks: { PreToolUse: [U, V] } }, {}, { permissions: { deny: [] }, hooks: { PreToolUse: [U, V, E] } }, { hooks: [H] }, ADD],
  ['M12', M03_SETTINGS, { hooks: [H] }, M03_SETTINGS, { hooks: [H] }, OWN],
  ['M13', hooksOf([U, V]), { hooks: [H] }, hooksOf([U, V, E]), { hooks: [H] }, ADD],
  ['M14', M01_RESULT, { hooks: [H] }, M01_RESULT, { hooks: [H] }, OWN],
];
const HX = { event: 'PostToolUse', matcher: 'Write', command: 'node old.mjs' };
function runMerge(m, settings, managed, guardReady = true) {
  const input = deepFreeze(clone({ settings, managed, guardReady }));
  return { input, out: m.mergeManagedHooks(input) };
}
async function pureMergeChecks(check, step, m) {
  await step('M01-M14: settings, metadata and report values, with frozen inputs', async () => {
    for (const [id, s, mg, ws, wm, wr] of MERGE_ROWS) {
      const r = await attempt(() => runMerge(m, s, mg));
      if (r.threw) { check(false, `${id}: threw`, errMsg(r.error)); continue; }
      const { out } = r.value;
      check(eq(out.settings, ws), `${id}: the settings result`, out.settings);
      check(eq(out.managed, wm), `${id}: the managed metadata result`, out.managed);
      check(eq(out.report, wr), `${id}: the report`, out.report);
      check(eq(keysOf(out), ['settings', 'managed', 'report']) && eq(keysOf(out.report), ['added', 'alreadyPresent', 'alreadyCovered', 'skipped']), `${id}: the result and report keys are in the pinned order`, { top: keysOf(out), report: keysOf(out.report) });
    }
  });
  await step('additional pure checks: a duplicate with ownership, guardReady false and its precedence, owned identities, detached mutable results', async () => {
    const dup = runMerge(m, hooksOf([E, E]), { hooks: [H] });
    check(eq(dup.out.report, OWN) && eq(dup.out.settings, hooksOf([E, E])) && eq(dup.out.managed, { hooks: [H] }), 'M07 with an owned H: OWN once, both occurrences preserved', dup.out);
    const off = runMerge(m, {}, {}, false);
    check(eq(off.out.settings, {}) && eq(off.out.managed, {}) && eq(off.out.report, OFF), 'M01 with guardReady false: {}, {} and the readiness skip', off.out);
    const bad = runMerge(m, { hooks: [] }, {}, false);
    check(eq(bad.out.settings, { hooks: [] }) && eq(bad.out.managed, {}) && eq(bad.out.report, OFF), 'M08 with guardReady false: the readiness skip takes precedence over the container skip', bad.out);
    const offOwned = runMerge(m, hooksOf([U]), { hooks: [HX] }, false);
    check(eq(offOwned.out.settings, hooksOf([U])) && eq(offOwned.out.managed, { hooks: [HX] }) && eq(offOwned.out.report, OFF), 'guardReady false preserves settings and owned metadata exactly', offOwned.out);
    const nested = runMerge(m, hooksOf([{ matcher: H.matcher, hooks: [{ type: 'command', command: 'other' }, { type: 'command', command: H.command }] }]), {});
    check(eq(nested.out.report, USER) && eq(nested.out.settings, nested.input.settings), 'an occurrence nested beside another hook of the same entry is recognized (alreadyCovered, untouched)', nested.out.report);
    const respelled = runMerge(m, M03_SETTINGS, { hooks: [{ command: H.command, matcher: H.matcher, event: H.event }] });
    check(eq(respelled.out.report, OWN), 'a recorded identity spelled in another key order is still the same identity', respelled.out.report);
    const res = runMerge(m, hooksOf([U, V]), {});
    check(!Object.isFrozen(res.out.settings) && !Object.isFrozen(res.out.managed) && !Object.isFrozen(res.out.report) && res.out.settings !== res.input.settings && res.out.managed !== res.input.managed, 'results are detached, mutable JSON');
    check(res.out.settings.hooks.PreToolUse[0] !== res.input.settings.hooks.PreToolUse[0], 'the user entries in the result are copies of the input entries');
    res.out.settings.hooks.PreToolUse.push('x');
    res.out.managed.hooks.push('y');
    check(eq(res.input.settings, hooksOf([U, V])) && eq(res.input.managed, {}), 'mutating a result never changes the frozen inputs');
    const same = runMerge(m, M03_SETTINGS, { hooks: [H] });
    check(same.out.settings !== same.input.settings && !Object.isFrozen(same.out.settings), 'an unchanged result is detached too');
    check(typeof res.out.then !== 'function', 'the function is synchronous');
  });
  await step('non-matching spellings are appended, never adopted: type, matcher, command and event must all match exactly', async () => {
    const variants = [
      ['a prompt-typed hook', { matcher: H.matcher, hooks: [{ type: 'prompt', command: H.command }] }],
      ['a hook with no type', { matcher: H.matcher, hooks: [{ command: H.command }] }],
      ['a matcher with a trailing space', { matcher: `${H.matcher} `, hooks: [{ type: 'command', command: H.command }] }],
      ['a lower-case matcher', { matcher: 'bash|powershell', hooks: [{ type: 'command', command: H.command }] }],
      ['a wider matcher', { matcher: `${H.matcher}|Edit`, hooks: [{ type: 'command', command: H.command }] }],
      ['a command with a trailing space', { matcher: H.matcher, hooks: [{ type: 'command', command: `${H.command} ` }] }],
      ['a command with an argument', { matcher: H.matcher, hooks: [{ type: 'command', command: `${H.command} --x` }] }],
      ['a single-quoted command', { matcher: H.matcher, hooks: [{ type: 'command', command: H.command.replace(/"/g, "'") }] }],
    ];
    for (const [label, entry] of variants) {
      const r = runMerge(m, hooksOf([entry]), {});
      check(eq(r.out.report, ADD) && eq(r.out.settings, hooksOf([entry, E])) && eq(r.out.managed, { hooks: [H] }), `${label}: not an occurrence; E is appended and H owned`, r.out);
    }
    const lowerEvent = runMerge(m, { hooks: { pretooluse: [E] } }, {});
    check(eq(lowerEvent.out.report, ADD) && eq(lowerEvent.out.settings, { hooks: { pretooluse: [E], PreToolUse: [E] } }), 'a lower-case event container is a different event', lowerEvent.out);
    const otherEvent = runMerge(m, { hooks: { PostToolUse: [E] } }, { hooks: [H] });
    check(eq(otherEvent.out.report, ADD) && eq(otherEvent.out.managed, { hooks: [H] }), 'an owned H whose occurrence exists only under another event is restored once under PreToolUse', otherEvent.out);
  });
  await step('key placement and metadata order: PreToolUse last in hooks, hooks last in settings and in managed metadata; unrelated metadata keeps its values and order', async () => {
    const a = runMerge(m, M01_RESULT, {});
    check(eq(keysOf(a.out.settings), ['hooks']), 'M01-shaped input keeps one hooks key', keysOf(a.out.settings));
    const b = runMerge(m, { hooks: { PostToolUse: [L] } }, {});
    check(eq(keysOf(b.out.settings.hooks), ['PostToolUse', 'PreToolUse']), 'a created PreToolUse key goes last in hooks', keysOf(b.out.settings.hooks));
    const c = runMerge(m, { permissions: { deny: ['Read(x)'] }, env: { A: '1' } }, { 'permissions.deny': ['Read(x)'], heldBack: [] });
    check(eq(keysOf(c.out.settings), ['permissions', 'env', 'hooks']), 'a created hooks key goes last in settings, after permissions', keysOf(c.out.settings));
    check(eq(keysOf(c.out.managed), ['permissions.deny', 'heldBack', 'hooks']) && eq(c.out.managed.hooks, [H]), 'a created managed.hooks key goes last in managed metadata', keysOf(c.out.managed));
    const d = runMerge(m, hooksOf([U]), { heldBack: ['Read(y)'], 'permissions.deny': ['x', 'y'], hooks: [HX] });
    check(eq(keysOf(d.out.managed), ['heldBack', 'permissions.deny', 'hooks']) && eq(d.out.managed, { heldBack: ['Read(y)'], 'permissions.deny': ['x', 'y'], hooks: [HX, H] }), 'adding H appends after the other managed identities; unrelated keys keep their values and order', d.out.managed);
    const e = runMerge(m, hooksOf([E]), { hooks: [] });
    check(eq(e.out.managed, { hooks: [] }) && eq(e.out.report, USER), 'an existing empty managed.hooks array is preserved, not deleted', e.out);
    const f = runMerge(m, hooksOf([E]), {});
    check(!hasOwn(f.out.managed, 'hooks'), 'with no owned hook and no managed.hooks key the key stays absent');
  });
  await step('invalid API input throws exactly HOOK_INPUT, before any metadata check; metadata errors propagate unchanged from C2, with guardReady true and false', async () => {
    const MSG_INPUT = 'HOOK_INPUT: invalid hook merge input';
    const base = { settings: {}, managed: {}, guardReady: true };
    const inputs = [
      ['null', null], ['undefined', undefined], ['an array', []], ['a number', 5], ['a string', 'x'], ['an empty object', {}],
      ['no guardReady', { settings: {}, managed: {} }], ['no managed', { settings: {}, guardReady: true }], ['no settings', { managed: {}, guardReady: true }], ['an extra key', { ...base, extra: 1 }],
      ['array settings', { ...base, settings: [] }], ['null settings', { ...base, settings: null }], ['array managed', { ...base, managed: [] }], ['null managed', { ...base, managed: null }],
      ['a string guardReady', { ...base, guardReady: 'true' }], ['a numeric guardReady', { ...base, guardReady: 1 }], ['an undefined guardReady', { ...base, guardReady: undefined }],
    ];
    for (const [label, input] of inputs) await expectErr(check, `input ${label}`, () => m.mergeManagedHooks(input), 'HOOK_INPUT', MSG_INPUT);
    const meta = [
      ['hooks that is not an array', { hooks: 'x' }, 'OWNERSHIP_SHAPE', 'OWNERSHIP_SHAPE: managed.hooks'],
      ['a duplicate identity', { hooks: [H, H] }, 'HOOK_DUPLICATE', 'HOOK_DUPLICATE: hooks[1]'],
      ['an incomplete identity', { hooks: [{ event: 'PreToolUse' }] }, 'HOOK_IDENTITY', 'HOOK_IDENTITY: event, matcher and command are required'],
      ['an unknown field', { nope: 1 }, 'OWNERSHIP_FIELD', 'OWNERSHIP_FIELD: managed.nope'],
    ];
    for (const ready of [true, false]) for (const [label, managed, code, message] of meta) await expectErr(check, `metadata ${label} (guardReady ${ready})`, () => m.mergeManagedHooks({ settings: {}, managed, guardReady: ready }), code, message);
  });
}

async function mergeGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const m = await loadMerge(failures, context);
    if (!m) return;
    await step('scripts/merge-claude-settings.mjs exports exactly mergeManagedDenies and mergeManagedHooks and stays import safe', async () => {
      await withScratch(context, 'probe-merge', async (dir) => { checkImportSafe(check, MERGE_REL, context, dir, scriptUrl(context, 'merge-claude-settings.mjs'), MERGE_EXPORTS); });
    });
    await pureMergeChecks(check, step, m);
    const plain = await usePlain(failures, context);
    const tb = loadTrusted(failures, context);
    if (!plain || !tb) return;
    const kit = makeKit(context, check);
    // The shared start of C11 and C14; C14 continues from C11's resulting run state.
    const M11_IN = { permissions: { deny: [] }, hooks: { PreToolUse: [U, V] } };
    const M11_OUT = { permissions: { deny: [] }, hooks: { PreToolUse: [U, V, E] } };
    const STYLE11 = { indent: 4, eol: '\r\n' };
    let c11Root = null;
    await withScratch(context, 'bytes', async (dir) => {
      await step('C11: a project settings file with four spaces and CRLF, no draft, no installed ownership: the draft, both request files and the envelope are exact bytes', async () => {
        const root = cloneTree(plain.root, path.join(dir, 'c11'));
        const settingsBytes = Buffer.from(ser(M11_IN, STYLE11), 'utf8');
        putFile(projPath(root, T_SETTINGS), settingsBytes);
        stageGuard(root, RID, tb);
        const before = readBytes(projPath(root, T_SETTINGS));
        const watch = readGuard(dir, [projPath(root, T_SETTINGS)]);
        const r = kit.hooksOnly(root, RID, { preload: watch.file });
        expectHooksOk(check, 'C11', r, { changed: true, metadataChanged: true, draft: draftRel(RID), report: ADD });
        check(watch.hits().length > 0, 'control: the read recorder observes the settings read (so the later zero-read assertions are meaningful)', watch.hits().length);
        check(sameBytes(readBytes(draftPath(root, RID, T_SETTINGS)), Buffer.from(ser(M11_OUT, STYLE11), 'utf8')), 'C11: the settings draft is the M11 result in four spaces and CRLF, no BOM, one final newline', clip(readText(draftPath(root, RID, T_SETTINGS))));
        check(readText(runFile(root, RID, 'ownership.json')) === jsonText(OWNER_KEYS), 'C11: ownership.json is exactly J({".claude/settings.json":"keys"})', readText(runFile(root, RID, 'ownership.json')));
        check(readText(runFile(root, RID, 'managed-keys.json')) === jsonText({ [T_SETTINGS]: { hooks: [H] } }), 'C11: managed-keys.json is exactly J({".claude/settings.json":{hooks:[H]}})', readText(runFile(root, RID, 'managed-keys.json')));
        for (const name of ['omissions.json', 'manifest-metadata.json', 'transaction-inputs.json']) check(!exists(runFile(root, RID, name)), `C11: no unrelated request file ${name} was created`);
        check(sameBytes(readBytes(projPath(root, T_SETTINGS)), before), 'C11: the project settings bytes are unchanged (the draft is the only output)');
        check(!exists(projPath(root, T_MANIFEST)) && !exists(projPath(root, '.ai/security-paths.json')), 'C11: no project manifest or policy was created');
        c11Root = root;
      });
      await step('C14: invoked again from the C11 run state, the draft and both request files are preserved byte for byte; the envelope reports the owned hook with the draft still present', async () => {
        if (!c11Root) { check(false, 'C14 needs the C11 run state'); return; }
        const root = cloneTree(c11Root, path.join(dir, 'c14'));
        const snap = { d: readBytes(draftPath(root, RID, T_SETTINGS)), o: readBytes(runFile(root, RID, 'ownership.json')), m: readBytes(runFile(root, RID, 'managed-keys.json')), p: readBytes(projPath(root, T_SETTINGS)) };
        const r = kit.hooksOnly(root, RID);
        expectHooksOk(check, 'C14', r, { changed: false, metadataChanged: false, draft: draftRel(RID), report: OWN });
        check(sameBytes(readBytes(draftPath(root, RID, T_SETTINGS)), snap.d) && sameBytes(readBytes(runFile(root, RID, 'ownership.json')), snap.o) && sameBytes(readBytes(runFile(root, RID, 'managed-keys.json')), snap.m) && sameBytes(readBytes(projPath(root, T_SETTINGS)), snap.p), 'C14: the draft, both request files and the project settings are byte for byte unchanged');
      });
      await step('C12: a BOM, tab-indented, no-final-newline project file whose manifest already owns H, with the request files already exact: nothing is written and no draft is created', async () => {
        const root = cloneTree(plain.root, path.join(dir, 'c12'));
        const settingsBytes = Buffer.from(ser(M03_SETTINGS, { indent: '\t', bom: true, final: false }), 'utf8');
        putFile(projPath(root, T_SETTINGS), settingsBytes);
        putFile(manifestPath(root), manifestOf({ [T_SETTINGS]: { ownership: 'keys', managed: { hooks: [H] } } }));
        putRequest(root, RID, 'ownership.json', OWNER_KEYS);
        putRequest(root, RID, 'managed-keys.json', { [T_SETTINGS]: { hooks: [H] } });
        stageGuard(root, RID, tb);
        const snap = { o: readBytes(runFile(root, RID, 'ownership.json')), m: readBytes(runFile(root, RID, 'managed-keys.json')), man: readBytes(manifestPath(root)) };
        const r = kit.hooksOnly(root, RID);
        expectHooksOk(check, 'C12', r, { changed: false, metadataChanged: false, draft: null, report: OWN });
        check(sameBytes(readBytes(projPath(root, T_SETTINGS)), settingsBytes), 'C12: the original project bytes (BOM, tabs, no final newline) are unchanged');
        check(!exists(draftPath(root, RID, T_SETTINGS)), 'C12: no settings draft is created');
        check(sameBytes(readBytes(runFile(root, RID, 'ownership.json')), snap.o) && sameBytes(readBytes(runFile(root, RID, 'managed-keys.json')), snap.m) && sameBytes(readBytes(manifestPath(root)), snap.man), 'C12: the request files and the manifest are byte for byte unchanged');
      });
      await step('C6-P2-8: the normal merge with no project settings file and a trusted staged guard writes a draft whose root keys are exactly $schema, permissions, hooks and whose hooks are exactly { PreToolUse: [E] }; it records H', async () => {
        const root = cloneTree(plain.root, path.join(dir, 'normal'));
        stageGuard(root, RID, tb);
        const r = kit.merge(root, ['--run-id', RID]);
        check(r.code === 0 && r.json && r.json.ok === true && r.stderr === '', 'the normal merge succeeds', { code: r.code, out: r.stdout.slice(0, 300), err: r.stderr.slice(0, 200) });
        const draft = readJson(draftPath(root, RID, T_SETTINGS));
        check(draft && eq(Object.keys(draft), ['$schema', 'permissions', 'hooks']), 'the draft root keys are exactly $schema, permissions, hooks, in that order', draft && Object.keys(draft));
        check(draft && eq(draft.hooks, { PreToolUse: [E] }) && eq(Object.keys(draft.hooks), ['PreToolUse']), 'hooks is exactly { PreToolUse: [E] }', draft && draft.hooks);
        check(r.json && r.json.report && eq(r.json.report.hooks, ADD) && r.json.report.added && Array.isArray(r.json.report.added.deny), 'the report keeps its existing shape and adds report.hooks (ADD)', r.json && r.json.report && Object.keys(r.json.report));
        const req = readJson(runFile(root, RID, 'managed-keys.json'));
        check(req && req[T_SETTINGS] && eq(req[T_SETTINGS].hooks, [H]) && Array.isArray(req[T_SETTINGS]['permissions.deny']) && eq(req[T_SETTINGS].heldBack, []), 'the managed-keys request keeps the deny ownership and heldBack and adds hooks [H]', req && req[T_SETTINGS] && Object.keys(req[T_SETTINGS]));
        check(eq(readJson(runFile(root, RID, 'ownership.json')), OWNER_KEYS), 'the ownership request declares keys');
      });
    });
    flushProcessCount(context, 'R52/C6/merge');
  });
}

// ==================================================== R79/C6/identity ====
const IDENTITY_STRING = '["PreToolUse","Bash|PowerShell","node \\"$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs\\""]';
async function identityGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const m = await loadMerge(failures, context);
    const core = await loadCore(failures, context);
    const own = await importOrFail(failures, scriptUrl(context, 'ownership.mjs'), 'scripts/ownership.mjs');
    if (!m || !core || !own || !needFns(failures, own, ['hookIdentity', 'readManagedMetadata'])) return;
    await step('the managed hook identity is exactly the C2 composite of event, matcher and command', async () => {
      check(own.hookIdentity(H) === IDENTITY_STRING && own.hookIdentity(H) === JSON.stringify([H.event, H.matcher, H.command]), 'hookIdentity(H) is the exact JSON string of plan 3.7', own.hookIdentity(H));
      check(own.hookIdentity(core.RAW_GIT_HOOK) === IDENTITY_STRING, 'the core constant RAW_GIT_HOOK has that identity', core.RAW_GIT_HOOK);
      for (const [label, h] of [['event case', { ...H, event: 'pretooluse' }], ['matcher case', { ...H, matcher: 'bash|powershell' }], ['command spacing', { ...H, command: `${H.command} ` }], ['another event', { ...H, event: 'PostToolUse' }]]) {
        check(own.hookIdentity(h) !== IDENTITY_STRING, `identity strings are exact: ${label} differs`);
      }
      const r = runMerge(m, {}, {});
      check(eq(r.out.managed.hooks, [H]) && eq(keysOf(r.out.managed.hooks[0]), ['event', 'matcher', 'command']) && own.hookIdentity(r.out.managed.hooks[0]) === IDENTITY_STRING, 'the stored metadata is H (event, matcher, command in that key order), never E', r.out.managed);
      const v = await attempt(() => own.readManagedMetadata('.claude/settings.json', r.out.managed));
      check(!v.threw, 'the merged managed metadata passes the C2 reader', v.threw ? errMsg(v.error) : null);
    });
    await step('options are not identity: an occurrence with extra options and a user field is the same hook; user entries keep their options and order', async () => {
      const r = runMerge(m, M03_SETTINGS, { hooks: [H] });
      check(eq(r.out.report, OWN) && eq(r.out.settings, M03_SETTINGS) && eq(r.out.settings.hooks.PreToolUse[1], O), 'O (timeout 17, statusMessage, userOption) is recognized and stays byte-equal in value and position', r.out);
      const a = runMerge(m, hooksOf([U, V]), {});
      check(eq(a.out.settings.hooks.PreToolUse.slice(0, 2), [U, V]) && eq(a.out.settings.hooks.PreToolUse[2], E) && a.out.settings.hooks.PreToolUse.length === 3, 'U and V keep their options and order; E is the last element', a.out.settings);
      const b = runMerge(m, hooksOf([V, U]), {});
      check(eq(b.out.settings.hooks.PreToolUse, [V, U, E]), 'a user order that is not alphabetical or by matcher is preserved', b.out.settings);
    });
    await step('the same command under another event or matcher is not a managed occurrence and is preserved', async () => {
      const post = runMerge(m, { hooks: { PostToolUse: [E] } }, {});
      check(eq(post.out.settings.hooks.PostToolUse, [E]) && eq(post.out.settings.hooks.PreToolUse, [E]) && eq(post.out.report, ADD), 'the PostToolUse copy stays and a PreToolUse entry is added', post.out.settings);
      const other = runMerge(m, hooksOf([A]), {});
      check(eq(other.out.settings.hooks.PreToolUse, [A, E]) && eq(other.out.report, ADD), 'the same command under matcher Bash stays and E is added', other.out.settings);
      const legacy = runMerge(m, { hooks: { PostToolUse: [L], PreToolUse: [L, U] } }, {});
      check(eq(legacy.out.settings.hooks.PostToolUse, [L]) && eq(legacy.out.settings.hooks.PreToolUse, [L, U, E]), 'legacy hook shapes survive in place', legacy.out.settings);
    });
    await step('unowned identical user hooks are never adopted; duplicates are neither removed nor fatal; an owned hook is not duplicated on rerun', async () => {
      const user = runMerge(m, hooksOf([U, O, V]), {});
      check(eq(user.out.report, USER) && !hasOwn(user.out.managed, 'hooks'), 'an identical user hook stays user-owned (alreadyCovered, no managed.hooks key)', user.out);
      const dups = runMerge(m, hooksOf([E, E, E]), {});
      check(eq(dups.out.report, USER) && dups.out.settings.hooks.PreToolUse.length === 3, 'three duplicate occurrences are preserved and not fatal', dups.out);
      const first = runMerge(m, hooksOf([U]), {});
      const second = runMerge(m, first.out.settings, first.out.managed);
      check(eq(second.out.report, OWN) && eq(second.out.settings, first.out.settings) && eq(second.out.managed, first.out.managed), 'merging the result again is a no-op reported as alreadyPresent', second.out);
    });
  });
}

// ============================================ skill copies and the genuine v2 base ====
// A scratch copy of the skill: its scripts run unchanged; a mutation may remove or replace a file.
function copySkill(context, dest, { mutate = null } = {}) {
  for (const part of ['scripts', 'assets', 'data']) fs.cpSync(path.join(context.skillRoot, part), path.join(dest, part), { recursive: true });
  fs.copyFileSync(path.join(context.skillRoot, 'VERSION'), path.join(dest, 'VERSION'));
  if (mutate) mutate(dest);
  return dest;
}
// A genuine v2 installation built by the tagged scripts (C11a), committed. The helper's own child processes are not counted by this file.
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
// begin, report, decisions, stage (the toolkit of the C3 and C4 tests).
function startMigration(kit, check, root, id, decide) {
  if (!kit.begin(root, id)) return { ok: false, root, id };
  const rep = kit.report(root);
  const report = rep.json && rep.json.report;
  check(rep.code === 0 && report, `${id}: the report succeeds`, rep.stdout.slice(0, 300));
  if (!report) return { ok: false, root, id };
  putRequest(root, id, 'security-decisions.json', decide(report));
  const st = kit.stage(root, id);
  return { ok: st.code === 0 && st.json && st.json.ok === true, root, id, report, st };
}
// Prepares with the approvals the run asks for, starting from `approve`; every refusal seen on the way is kept.
function prepareApproving(kit, root, id, approve = [T_POLICY], o = {}) {
  let list = [...approve];
  let last = null;
  const seen = [];
  for (let i = 0; i < 4; i++) {
    last = kit.prepare(root, id, { ...o, approve: list });
    if (last.code === 0) break;
    const errors = (last.json && last.json.errors) || [];
    seen.push(...errors);
    if (!errors.length || errors.some((e) => e.code !== 'APPROVAL_REQUIRED' && e.code !== 'APPLY_APPROVAL_REQUIRED')) break;
    const need = errors.map((e) => e.target).filter((t) => !list.includes(t));
    if (!need.length) break;
    list = [...list, ...need];
  }
  return { prep: last, approved: list, seen, ok: last.code === 0 && last.json && last.json.ok === true, plan: readPlan(root, id), sha: last.json && last.json.planSha256, root, id };
}
// Decisions of the genuine-v2 integration (plan 4.6 step 3): include two of the three new coverage rows, omit the third (a recorded policy omission, so its deny
// is not generated), and drop the ownership of one retired deny string (a retained/dropped choice that needs the settings approval).
const GID = 'run-c6-gv2';
const DROPPED = 'Read(**/.env.*)';
function genuineDecisions(report) {
  const idx = report.coverage.findIndex((c) => /htpasswd/.test(JSON.stringify(c)));
  const pick = idx >= 0 ? idx : report.coverage.length - 1;
  return decisionsFile(report, { coverage: report.coverage.map((c, i) => ({ id: c.id, action: i === pick ? 'omit' : 'include' })), dropDenyOwnership: [DROPPED] });
}
// What hooks-only is expected to do to a settings value: E appended last, creating PreToolUse and then hooks as needed (plan 3.7).
function withE(settings) {
  const s = clone(settings);
  if (!hasOwn(s, 'hooks')) { s.hooks = { PreToolUse: [clone(E)] }; return s; }
  if (!hasOwn(s.hooks, 'PreToolUse')) { s.hooks.PreToolUse = [clone(E)]; return s; }
  s.hooks.PreToolUse.push(clone(E));
  return s;
}
const runSnapshot = (root, id) => new Map(walkTree(runFile(root, id), []).filter(([, kind]) => kind === 'file').map(([rel, , digest]) => [rel, digest]));
// The shared genuine-v2 state: a control run with C3 stage only (the approvals C3 requires), then the main run with C3 stage followed by hooks-only.
const getGenuine = (context) => cached(context, 'genuine', async () => {
  const fails = [];
  const check = mkCheck(fails);
  const v2 = await getV2Base(context);
  const dir = scratchDir(context, 'genuine');
  const kit = makeKit(context, check);
  // the control: the same decisions, C3 stage, no hooks-only; its approvals are the set C3 alone requires
  const control = cloneTree(v2.root, path.join(dir, 'control'));
  const cs = startMigration(kit, check, control, GID, genuineDecisions);
  const ctl = cs.ok ? prepareApproving(kit, control, GID) : { ok: false, approved: [], seen: [], prep: cs.st };
  // the main run
  const root = cloneTree(v2.root, path.join(dir, 'main'));
  const ms = startMigration(kit, check, root, GID, genuineDecisions);
  const staged = { files: ms.ok ? runSnapshot(root, GID) : new Map(), settingsDraft: ms.ok ? readJson(draftPath(root, GID, T_SETTINGS)) : null, settingsDraftBytes: ms.ok ? readBytes(draftPath(root, GID, T_SETTINGS)) : null };
  const hooks = ms.ok ? kit.hooksOnly(root, GID) : null;
  return { dir, v2, control: { root: control, ok: ctl.ok, approved: ctl.approved, seen: ctl.seen, prep: ctl.prep }, root, started: ms, staged, hooks, after: ms.ok ? runSnapshot(root, GID) : new Map(), fails };
});

// =================================================== R52/C6/staging ====
async function stagingGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const plain = await usePlain(failures, context);
    const tb = loadTrusted(failures, context);
    if (!plain || !tb) return;
    const kit = makeKit(context, check);
    const S0 = hooksOf([U, V]);
    await withScratch(context, 'staging', async (dir) => {
      let n = 0;
      const fresh = (label) => cloneTree(plain.root, path.join(dir, `${label}-${++n}`));
      const settingsAt = (root, value, style) => putFile(projPath(root, T_SETTINGS), ser(value, style));
      const noRequests = (root) => ['ownership.json', 'managed-keys.json', 'omissions.json', 'manifest-metadata.json', 'transaction-inputs.json'].filter((f) => exists(runFile(root, RID, f)));

      await step('readiness: no guard anywhere adds nothing (hooks-only and normal merge report the readiness skip and create no hook request)', async () => {
        const root = fresh('off');
        settingsAt(root, S0);
        const before = projectSnapshot(root);
        const r = kit.hooksOnly(root, RID);
        expectHooksOk(check, 'hooks-only without a guard', r, { changed: false, metadataChanged: false, draft: null, report: OFF });
        check(projectSnapshot(root) === before, 'hooks-only without a guard changed no file and created no draft or request');
        const nm = kit.merge(root, ['--run-id', RID]);
        check(nm.code === 0 && nm.json && nm.json.ok === true && eq(nm.json.report && nm.json.report.hooks, OFF), 'the normal merge reports the same readiness skip and still succeeds', { code: nm.code, out: nm.stdout.slice(0, 300) });
        const draft = readJson(draftPath(root, RID, T_SETTINGS));
        check(draft && eq(draft.hooks, S0.hooks) && Array.isArray(draft.permissions && draft.permissions.deny), 'the normal merge draft adds the deny rules and leaves hooks exactly as the user wrote them', draft && Object.keys(draft));
        const req = readJson(runFile(root, RID, 'managed-keys.json'));
        check(req && req[T_SETTINGS] && !hasOwn(req[T_SETTINGS], 'hooks'), 'the managed-keys request has no hooks field', req && req[T_SETTINGS] && Object.keys(req[T_SETTINGS]));
      });
      await step('readiness: a trusted staged guard adds the hook; with no settings file and no draft the base is the $schema object, serialized with two spaces and LF', async () => {
        const root = fresh('staged');
        stageGuard(root, RID, tb);
        const r = kit.hooksOnly(root, RID);
        expectHooksOk(check, 'staged guard, no settings anywhere', r, { changed: true, metadataChanged: true, draft: draftRel(RID), report: ADD });
        const want = ser({ $schema: 'https://json.schemastore.org/claude-code-settings.json', hooks: { PreToolUse: [E] } });
        check(readText(draftPath(root, RID, T_SETTINGS)) === want, 'the draft is the $schema base plus hooks, J(value) bytes', clip(readText(draftPath(root, RID, T_SETTINGS))));
        check(!exists(projPath(root, T_SETTINGS)), 'no project settings file was created');
      });
      await step('readiness: normalized equality (BOM and CRLF) of a staged guard still counts as reviewed; any other difference, even a trailing comment, does not', async () => {
        const bom = (b) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(normText(b).replace(/\n/g, '\r\n'), 'utf8')]);
        const a = fresh('bom');
        stageGuard(a, RID, tb, { [T_GUARD]: bom(tb[T_GUARD]), [T_GUARD_CORE]: bom(tb[T_GUARD_CORE]) });
        expectHooksOk(check, 'BOM and CRLF staged guard', kit.hooksOnly(a, RID), { changed: true, metadataChanged: true, draft: draftRel(RID), report: ADD });
        const b = fresh('claim');
        stageGuard(b, RID, tb, { [T_GUARD]: Buffer.concat([tb[T_GUARD], Buffer.from('// reviewed: yes\n')]) });
        expectHooksOk(check, 'a staged guard with a version-claim comment', kit.hooksOnly(b, RID), { changed: false, metadataChanged: false, draft: null, report: OFF });
        check(noRequests(b).length === 0 && !exists(draftPath(b, RID, T_SETTINGS)), 'the unreviewed guard created no draft and no request');
      });
      await step('readiness: an unreviewed staged guard does not fall back to a reviewed installed guard', async () => {
        const root = fresh('draftwins');
        installGuard(root, tb);
        stageGuard(root, RID, tb, { [T_GUARD]: Buffer.from('// not the reviewed guard\n') });
        expectHooksOk(check, 'unreviewed draft plus trusted installed guard', kit.hooksOnly(root, RID), { changed: false, metadataChanged: false, draft: null, report: OFF });
        check(noRequests(root).length === 0, 'no request file was created (and no installed input was declared)', noRequests(root));
      });
      await step('readiness (C6-P2-4): the guard core must meet the candidate rule too; a missing staged core and an altered installed core are the readiness skip', async () => {
        const a = fresh('nocore-draft');
        putDraft(a, RID, T_GUARD, tb[T_GUARD]);
        expectHooksOk(check, 'trusted staged guard, core nowhere', kit.hooksOnly(a, RID), { changed: false, metadataChanged: false, draft: null, report: OFF });
        const c = fresh('badcore-installed');
        installGuard(c, tb, { [T_GUARD_CORE]: Buffer.concat([tb[T_GUARD_CORE], Buffer.from('// altered\n')]) });
        expectHooksOk(check, 'trusted installed guard, altered installed core', kit.hooksOnly(c, RID), { changed: false, metadataChanged: false, draft: null, report: OFF });
        check([a, c].every((r) => noRequests(r).length === 0 && !exists(draftPath(r, RID, T_SETTINGS))), 'neither created a draft or a request');
      });
      await step('C6-P2-1: a trusted installed guard with no draft adds the hook and appends the guard and its core to transaction-inputs.json (keeping order, without duplicates); prepare then needs no settings approval', async () => {
        const mk = (label, inputs) => {
          const root = fresh(label);
          installGuard(root, tb);
          putFile(projPath(root, 'docs/x.md'), '# x\n');
          settingsAt(root, S0);
          if (inputs) putRequest(root, RID, 'transaction-inputs.json', inputs);
          return root;
        };
        const root = mk('inputs-a', ['docs/x.md']);
        const r = kit.hooksOnly(root, RID);
        expectHooksOk(check, 'installed guard readiness', r, { changed: true, metadataChanged: true, draft: draftRel(RID), report: ADD });
        check(readText(runFile(root, RID, 'transaction-inputs.json')) === jsonText(['docs/x.md', T_GUARD, T_GUARD_CORE]), 'transaction-inputs.json is the old entry, then the guard, then its core', readText(runFile(root, RID, 'transaction-inputs.json')));
        const again = kit.hooksOnly(root, RID);
        expectHooksOk(check, 'the same run again', again, { changed: false, metadataChanged: false, draft: draftRel(RID), report: OWN });
        check(readText(runFile(root, RID, 'transaction-inputs.json')) === jsonText(['docs/x.md', T_GUARD, T_GUARD_CORE]), 'the second run adds no duplicate and leaves the file as it was');
        const p = kit.prepare(root, RID);
        check(p.code === 0 && p.json && p.json.ok === true, 'prepare needs no settings approval for the canonical append with a reviewed, declared installed guard', { code: p.code, out: p.stdout.slice(0, 400) });
        const op = p.json && p.json.ops && p.json.ops.find((o) => o.target === T_SETTINGS);
        check(op && op.userContentChange === false && eq(op.userContentReasons, []), 'the settings op has userContentChange false and no reasons (C6-P2-7)', op);
        const plan = readPlan(root, RID);
        check(plan && eq(plan.metadata.transactionInputs, ['docs/x.md', T_GUARD, T_GUARD_CORE]) && [T_GUARD, T_GUARD_CORE].every((t) => plan.inputs.some((i) => i.target === t)), 'the declared inputs are bound in the plan', plan && plan.metadata.transactionInputs);
        const b = mk('inputs-b', [T_GUARD]);
        expectHooksOk(check, 'only the guard declared', kit.hooksOnly(b, RID), { changed: true, metadataChanged: true, draft: draftRel(RID), report: ADD });
        check(readText(runFile(b, RID, 'transaction-inputs.json')) === jsonText([T_GUARD, T_GUARD_CORE]), 'the missing core is appended after the declared guard', readText(runFile(b, RID, 'transaction-inputs.json')));
      });
      await step('a staged guard does not declare installed inputs: transaction-inputs.json is untouched', async () => {
        const root = fresh('nodecl');
        stageGuard(root, RID, tb);
        putRequest(root, RID, 'transaction-inputs.json', ['docs/x.md']);
        putFile(projPath(root, 'docs/x.md'), '# x\n');
        const before = readBytes(runFile(root, RID, 'transaction-inputs.json'));
        expectHooksOk(check, 'staged guard with a declared input', kit.hooksOnly(root, RID), { changed: true, metadataChanged: true, draft: draftRel(RID), report: ADD });
        check(sameBytes(readBytes(runFile(root, RID, 'transaction-inputs.json')), before), 'transaction-inputs.json is byte for byte unchanged');
      });
      await step('malformed containers are successful skips for both modes, and the normal deny merge still succeeds', async () => {
        for (const [label, settings] of [['hooks that is an array', { hooks: [] }], ['PreToolUse that is an object', hooksOf({})]]) {
          const root = fresh('bad');
          stageGuard(root, RID, tb);
          settingsAt(root, settings);
          const before = projectSnapshot(root);
          expectHooksOk(check, `hooks-only with ${label}`, kit.hooksOnly(root, RID), { changed: false, metadataChanged: false, draft: null, report: BAD });
          check(projectSnapshot(root) === before, `${label}: hooks-only changed nothing`);
        }
        const root = fresh('bad-normal');
        stageGuard(root, RID, tb);
        settingsAt(root, { hooks: [] });
        const r = kit.merge(root, ['--run-id', RID]);
        check(r.code === 0 && r.json && r.json.ok === true && eq(r.json.report && r.json.report.hooks, BAD), 'the normal merge succeeds with the container skip', { code: r.code, out: r.stdout.slice(0, 300) });
        const draft = readJson(draftPath(root, RID, T_SETTINGS));
        check(draft && eq(draft.hooks, []) && Array.isArray(draft.permissions && draft.permissions.deny) && draft.permissions.deny.length > 0, 'the deny rules were merged and the malformed hooks value was left alone', draft && Object.keys(draft));
      });
      await step('staged unrelated settings fields and request fields survive: the draft keeps every other value, the request files keep every other target, field and byte', async () => {
        const root = fresh('survive');
        const staged = { $schema: 'https://json.schemastore.org/claude-code-settings.json', env: { KEEP: '1' }, permissions: { deny: ['Read(x)'], allow: ['Bash(npm test)'] }, hooks: { PostToolUse: [U] } };
        settingsAt(root, { env: { OLD: '1' } });
        putDraft(root, RID, T_SETTINGS, ser(staged));
        const POLICY_REC = { schema: 2, patterns: [{ anchor: 'any', glob: '**/.env*' }] };
        const own = { [T_POLICY]: 'keys', [T_SETTINGS]: 'keys' };
        const managed = { [T_POLICY]: POLICY_REC, [T_SETTINGS]: { 'permissions.deny': ['Read(x)'], heldBack: ['Read(y)'] } };
        const omit = { [T_SETTINGS]: { 'permissions.deny': [{ anchor: 'any', glob: '**/.x' }] } };
        const meta = { codexSnippetSha256: 'a'.repeat(64) };
        putRequest(root, RID, 'ownership.json', own);
        putRequest(root, RID, 'managed-keys.json', managed);
        putRequest(root, RID, 'omissions.json', omit);
        putRequest(root, RID, 'manifest-metadata.json', meta);
        putRequest(root, RID, 'transaction-inputs.json', ['docs/a.md']);
        putFile(projPath(root, 'docs/a.md'), '# a\n');
        stageGuard(root, RID, tb);
        const keep = { o: readBytes(runFile(root, RID, 'ownership.json')), om: readBytes(runFile(root, RID, 'omissions.json')), mm: readBytes(runFile(root, RID, 'manifest-metadata.json')), ti: readBytes(runFile(root, RID, 'transaction-inputs.json')) };
        const r = kit.hooksOnly(root, RID);
        expectHooksOk(check, 'rich staged state', r, { changed: true, metadataChanged: true, draft: draftRel(RID), report: ADD });
        const draft = readJson(draftPath(root, RID, T_SETTINGS));
        check(draft && eq(draft, withE(staged)) && eq(Object.keys(draft), ['$schema', 'env', 'permissions', 'hooks']) && eq(Object.keys(draft.hooks), ['PostToolUse', 'PreToolUse']), 'the draft is the staged value plus E; every other field and key order survive', draft);
        const wantManaged = { [T_POLICY]: POLICY_REC, [T_SETTINGS]: { 'permissions.deny': ['Read(x)'], heldBack: ['Read(y)'], hooks: [H] } };
        check(readText(runFile(root, RID, 'managed-keys.json')) === jsonText(wantManaged), 'managed-keys.json: only the hooks field of the settings record changed (J bytes)', clip(readText(runFile(root, RID, 'managed-keys.json'))));
        check(sameBytes(readBytes(runFile(root, RID, 'ownership.json')), keep.o) && sameBytes(readBytes(runFile(root, RID, 'omissions.json')), keep.om) && sameBytes(readBytes(runFile(root, RID, 'manifest-metadata.json')), keep.mm) && sameBytes(readBytes(runFile(root, RID, 'transaction-inputs.json')), keep.ti), 'ownership, omissions, manifest metadata and transaction inputs are byte for byte unchanged');
        check(readText(projPath(root, T_SETTINGS)) === ser({ env: { OLD: '1' } }), 'the project settings are untouched');
      });
      await step('the draft keeps the original project file indentation and EOL even when the base is a staged draft', async () => {
        const root = fresh('style');
        settingsAt(root, { env: { OLD: '1' } }, { indent: 4, eol: '\r\n' });
        putDraft(root, RID, T_SETTINGS, ser({ env: { NEW: '2' } })); // a two-space LF draft
        stageGuard(root, RID, tb);
        expectHooksOk(check, 'style from the project file', kit.hooksOnly(root, RID), { changed: true, metadataChanged: true, draft: draftRel(RID), report: ADD });
        check(readText(draftPath(root, RID, T_SETTINGS)) === ser({ env: { NEW: '2' }, hooks: { PreToolUse: [E] } }, { indent: 4, eol: '\r\n' }), 'the rewritten draft is four spaces and CRLF with one final newline', clip(readText(draftPath(root, RID, T_SETTINGS))));
      });

      // ------------------------------------------------------- the error table ----
      const USAGE = 'usage: merge-claude-settings.mjs --run-id <id> --hooks-only';
      const errorRoot = (label, setup) => {
        const root = fresh(label);
        stageGuard(root, RID, tb);
        if (setup) setup(root);
        return root;
      };
      await step('HOOK_STAGE_USAGE (exit 1, target null): duplicate, positional, unknown and conflicting options leave every byte untouched; a reserved run ID keeps the generic reserved failure', async () => {
        const root = errorRoot('usage');
        putFile(path.join(root, 'allow.json'), '[]\n');
        const before = projectSnapshot(root);
        const argvs = [
          ['--run-id', RID, '--hooks-only', '--hooks-only'], ['--run-id', RID, '--run-id', RID, '--hooks-only'], ['--hooks-only', '--run-id', RID, '--allow-file', 'allow.json'],
          ['--hooks-only', '--run-id', RID, '--override-user-exceptions'], ['--hooks-only', '--run-id', RID, '--bogus'], ['--hooks-only', '--run-id', RID, 'positional'],
        ];
        for (const argv of argvs) expectStageErr(check, `usage ${argv.join(' ')}`, kit.merge(root, argv), { code: 'HOOK_STAGE_USAGE', exit: 1, error: USAGE, target: null });
        check(projectSnapshot(root) === before, 'no usage failure wrote anything');
        // PLAN-GAP: a missing --run-id is "existing run-ID validation" territory; only exit 1 with a JSON failure and empty stderr is asserted.
        const none = kit.merge(root, ['--hooks-only']);
        check(none.code === 1 && none.stderr === '' && none.json && none.json.ok === false, 'a missing --run-id fails with exit 1 and a JSON failure', { code: none.code, out: none.stdout.slice(0, 200) });
        const reserved = kit.merge(root, ['--hooks-only', '--run-id', 'review']);
        check(reserved.code === 1 && reserved.stderr === '' && reserved.stdout === GENERIC_RESERVED_OUT, 'the reserved review run ID keeps the existing generic failure (C5)', { code: reserved.code, out: reserved.stdout.slice(0, 200) });
        check(projectSnapshot(root) === before, 'neither wrote anything');
      });
      await step('HOOK_STAGE_JSON (exit 3): invalid or non-object installed settings, an invalid staged draft and invalid request JSON name the exact path and write nothing', async () => {
        const cases = [
          ['installed settings that are not JSON', (r) => putFile(projPath(r, T_SETTINGS), '{'), T_SETTINGS],
          ['installed settings whose root is an array', (r) => putFile(projPath(r, T_SETTINGS), '[]\n'), T_SETTINGS],
          ['a staged settings draft that is not JSON', (r) => putDraft(r, RID, T_SETTINGS, '{'), draftRel(RID)],
          ['an ownership request that is not JSON', (r) => putRequest(r, RID, 'ownership.json', '{'), runRel(RID, 'ownership.json')],
          ['a managed-keys request that is not JSON', (r) => putRequest(r, RID, 'managed-keys.json', '{'), runRel(RID, 'managed-keys.json')],
        ];
        for (const [label, setup, target] of cases) {
          const root = errorRoot('json', setup);
          const before = projectSnapshot(root);
          expectStageErr(check, label, kit.hooksOnly(root, RID), { code: 'HOOK_STAGE_JSON', exit: 3, error: `invalid hook staging JSON: ${target}`, target });
          check(projectSnapshot(root) === before, `${label}: no file changed`);
        }
      });
      await step('HOOK_STAGE_METADATA (exit 3): an invalid request structure, invalid managed metadata and a conflicting ownership request fail without overwriting', async () => {
        const cases = [
          ['a managed-keys request that is an array', (r) => putRequest(r, RID, 'managed-keys.json', []), runRel(RID, 'managed-keys.json')],
          ['invalid managed hooks metadata', (r) => putRequest(r, RID, 'managed-keys.json', { [T_SETTINGS]: { hooks: 'x' } }), runRel(RID, 'managed-keys.json')],
          ['a conflicting ownership request for the settings file', (r) => putRequest(r, RID, 'ownership.json', { [T_SETTINGS]: 'full' }), runRel(RID, 'ownership.json')],
        ];
        for (const [label, setup, target] of cases) {
          const root = errorRoot('meta', setup);
          const before = projectSnapshot(root);
          expectStageErr(check, label, kit.hooksOnly(root, RID), { code: 'HOOK_STAGE_METADATA', exit: 3, error: `invalid hook staging metadata: ${target}`, target });
          check(projectSnapshot(root) === before, `${label}: no file changed (the conflicting request was not overwritten)`);
        }
      });
      await step('HOOK_STAGE_MANIFEST (exit 3): an unparseable or invalid installed manifest names .ai/manifest.json', async () => {
        for (const [label, body] of [['an unparseable manifest', '{'], ['a manifest of the right schema number but no fields', '{"schema":3}\n']]) {
          const root = errorRoot('manifest', (r) => putFile(manifestPath(r), body));
          const before = projectSnapshot(root);
          expectStageErr(check, label, kit.hooksOnly(root, RID), { code: 'HOOK_STAGE_MANIFEST', exit: 3, error: 'invalid hook staging manifest: .ai/manifest.json', target: T_MANIFEST });
          check(projectSnapshot(root) === before, `${label}: no file changed`);
        }
      });
      await step('HOOK_STAGE_PATH (exit 2): a linked settings directory, a linked installed-guard directory and a linked run drafts directory are refused without reading through the link', async () => {
        // PLAN-GAP: the plan does not say whether the offending link or the file below it is named; either spelling is accepted, and the error must name the same path as the target.
        const linkCase = async (label, linkRel, extRel, files, setup, watchRels) => {
          const root = errorRoot(label, setup);
          const ext = path.join(dir, `ext-${label}-${n}`);
          for (const [name, data] of Object.entries(files)) putFile(path.join(ext, name), data);
          fs.rmSync(projPath(root, linkRel), { recursive: true, force: true });
          if (!linkDir(ext, projPath(root, linkRel))) { check(false, `${label}: cannot create the ${WIN ? 'junction' : 'directory symlink'}`); return; }
          const watch = readGuard(dir, watchRels(root, ext));
          const before = projectSnapshot(root);
          const r = kit.hooksOnly(root, RID, { preload: watch.file });
          const ok = r.code === 2 && r.stderr === '' && r.json && r.json.ok === false && r.json.code === 'HOOK_STAGE_PATH' && (typeof extRel === 'function' ? extRel(r.json.target) : extRel.includes(r.json.target)) && r.json.error === `unsafe hook staging path: ${r.json.target}` && eq(keysOf(r.json), ['ok', 'code', 'error', 'target']) && r.stdout === jsonText(r.json);
          check(ok, `${label}: HOOK_STAGE_PATH, exit 2, the error names the target path`, { code: r.code, out: r.stdout.slice(0, 300), err: r.stderr.slice(0, 200) });
          check(watch.hits().length === 0, `${label}: nothing was read through the link`, watch.hits().slice(0, 3));
          check(projectSnapshot(root) === before, `${label}: nothing was written`);
        };
        await linkCase('linked-settings', '.claude', ['.claude', T_SETTINGS], { 'settings.json': ser(S0) }, (r) => fs.mkdirSync(projPath(r, '.claude'), { recursive: true }), (r, ext) => [projPath(r, T_SETTINGS), path.join(ext, 'settings.json')]);
        await linkCase('linked-guard', '.ai/tools', ['.ai/tools', T_GUARD], { 'guard-raw-git.mjs': tb[T_GUARD], 'guard-raw-git-core.mjs': tb[T_GUARD_CORE] }, (r) => {
          // no staged guard in this case: readiness would come from the installed (linked) guard
          rmrf(draftPath(r, RID, T_GUARD)); rmrf(draftPath(r, RID, T_GUARD_CORE)); putFile(projPath(r, '.ai/tools/placeholder.txt'), 'x\n');
        }, (r, ext) => [projPath(r, T_GUARD), path.join(ext, 'guard-raw-git.mjs'), path.join(ext, 'guard-raw-git-core.mjs')]);
        // a linked run directory: the staged drafts live behind a junction (run input paths are never followed)
        await linkCase('linked-drafts', `.ai/.run/${RID}/drafts`, (t) => typeof t === 'string' && t.startsWith(`.ai/.run/${RID}/drafts`), { '.ai/tools/guard-raw-git.mjs': tb[T_GUARD], '.ai/tools/guard-raw-git-core.mjs': tb[T_GUARD_CORE] }, null,
          (r, ext) => [path.join(ext, '.ai', 'tools', 'guard-raw-git.mjs'), path.join(ext, '.ai', 'tools', 'guard-raw-git-core.mjs')]);
      });
      await step('HOOK_STAGE_PROTECTED (exit 3): a settings file, a guard and a guard core protected by the installed policy are refused before any content read', async () => {
        const protect = (glob) => jsonText({ schema: 2, patterns: [{ anchor: 'any', glob: '**/.env*' }], projectPatterns: [{ anchor: 'root', glob }] });
        const cases = [
          ['protected settings', T_SETTINGS, (r) => { putFile(projPath(r, T_POLICY), protect(T_SETTINGS)); settingsAt(r, S0); }, [T_SETTINGS]],
          ['a protected installed guard', T_GUARD, (r) => { rmrf(draftPath(r, RID, T_GUARD)); rmrf(draftPath(r, RID, T_GUARD_CORE)); installGuard(r, tb); putFile(projPath(r, T_POLICY), protect(T_GUARD)); settingsAt(r, S0); }, [T_GUARD]],
          ['a protected installed guard core', T_GUARD_CORE, (r) => { rmrf(draftPath(r, RID, T_GUARD)); rmrf(draftPath(r, RID, T_GUARD_CORE)); installGuard(r, tb); putFile(projPath(r, T_POLICY), protect(T_GUARD_CORE)); settingsAt(r, S0); }, [T_GUARD_CORE]],
        ];
        for (const [label, target, setup, watched] of cases) {
          const root = errorRoot('prot', setup);
          const watch = readGuard(dir, watched.map((t) => projPath(root, t)));
          const before = projectSnapshot(root);
          const r = kit.hooksOnly(root, RID, { preload: watch.file });
          expectStageErr(check, label, r, { code: 'HOOK_STAGE_PROTECTED', exit: 3, error: `hook staging input is protected: ${target}`, target });
          check(watch.hits().length === 0, `${label}: the protected path was never read`, watch.hits().slice(0, 3));
          check(projectSnapshot(root) === before, `${label}: nothing was written`);
        }
      });
      await step('HOOK_STAGE_IO (exit 2): a settings file that cannot be read fails with the exact read error', async () => {
        // PLAN-GAP: the plan names no way to provoke a read failure. An injected EIO on fs.readFileSync and fs.openSync of the settings path (a -r preload) is used; an implementation that
        // reads through another API than those two would not see the failure.
        const root = errorRoot('io', (r) => settingsAt(r, S0));
        const brk = readBreaker(dir, [projPath(root, T_SETTINGS)]);
        const before = projectSnapshot(root);
        expectStageErr(check, 'an unreadable settings file', kit.hooksOnly(root, RID, { preload: brk }), { code: 'HOOK_STAGE_IO', exit: 2, error: `cannot read hook staging input: ${T_SETTINGS}`, target: T_SETTINGS });
        check(projectSnapshot(root) === before, 'nothing was written');
      });
      await step('HOOK_STAGE_SOURCE (exit 3): a skill copy without the trusted guard source names its skill-relative path', async () => {
        const skill = copySkill(context, path.join(scratchDir(context, 'nosource'), 'project-setup'), { mutate: (s) => rmrf(path.join(s, ...GUARD_REL.split('/'))) });
        const root = errorRoot('source', (r) => settingsAt(r, S0));
        const before = projectSnapshot(root);
        expectStageErr(check, 'a missing trusted guard source', kit.withSkill(skill).hooksOnly(root, RID), { code: 'HOOK_STAGE_SOURCE', exit: 3, error: 'trusted hook source is unavailable: assets/tools/guard-raw-git.mjs', target: 'assets/tools/guard-raw-git.mjs' });
        check(projectSnapshot(root) === before, 'nothing was written');
      });
      await step('HOOK_STAGE_WRITE (exit 2): an output that cannot be written fails with the exact error, and the project files are never changed', async () => {
        // PLAN-GAP: which output fails first (the draft or a request file) is not pinned, so the target is any run-local output path and the error must name that same path.
        const root = errorRoot('write', (r) => settingsAt(r, S0));
        const brk = writeBreaker(dir);
        const before = outsideRunSnapshot(root);
        const r = kit.hooksOnly(root, RID, { preload: brk });
        const t = r.json && r.json.target;
        check(r.code === 2 && r.stderr === '' && r.json && r.json.ok === false && r.json.code === 'HOOK_STAGE_WRITE' && typeof t === 'string' && t.startsWith(`.ai/.run/${RID}/`) && r.json.error === `cannot write hook staging output: ${t}` && r.stdout === jsonText({ ok: false, code: 'HOOK_STAGE_WRITE', error: `cannot write hook staging output: ${t}`, target: t }), 'HOOK_STAGE_WRITE, exit 2, the exact envelope naming a run-local output', { code: r.code, out: r.stdout.slice(0, 300), err: r.stderr.slice(0, 200) });
        check(outsideRunSnapshot(root) === before, 'no project file, manifest or lock changed');
      });
    });
    flushProcessCount(context, 'R52/C6/staging (before the genuine v2 run)');

    // ------------------------------------------------------ genuine v2 ----
    await step('genuine v2: C3 stage, then hooks-only: the staged deny array, deny ownership, heldBack, omissions and decision bytes are unchanged, and E is present (plan 4.6 steps 1-7)', async () => {
      let g;
      try { g = await getGenuine(context); } catch (e) { failures.push(`cannot build the genuine v2 scenario: ${errMsg(e)}`); return; }
      for (const f of g.fails) failures.push(`scenario build: ${f}`);
      check(g.control.ok === true, 'the control (C3 stage only) prepares: it fixes the approval set C3 requires', g.control.prep && g.control.prep.stdout.slice(0, 300));
      check(g.started && g.started.ok === true, 'the main run stages through C3 (production catalog, all seven members)', g.started && g.started.st && g.started.st.stdout.slice(0, 300));
      if (!g.started || !g.started.ok || !g.hooks) return;
      const staged = (g.started.st.json && g.started.st.json.staged) || [];
      for (const t of UNIT) check(staged.includes(`drafts/${t}`), `C3 stage staged ${t}`, staged);
      check(g.staged.settingsDraft !== null && Array.isArray(g.staged.settingsDraft.permissions && g.staged.settingsDraft.permissions.deny), 'a staged settings draft with a deny array exists before hooks-only', g.staged.settingsDraft && Object.keys(g.staged.settingsDraft));
      expectHooksOk(check, 'hooks-only after C3 stage', g.hooks, { changed: true, metadataChanged: true, draft: draftRel(GID), report: ADD });
      const changed = [...new Set([...g.staged.files.keys(), ...g.after.keys()])].filter((k) => g.staged.files.get(k) !== g.after.get(k)).sort();
      check(eq(changed, ['drafts/.claude/settings.json', 'managed-keys.json']), 'hooks-only changed exactly the settings draft and managed-keys.json (every other run file is byte for byte unchanged and none was added or removed)', changed);
      const after = readJson(draftPath(g.root, GID, T_SETTINGS));
      const before = g.staged.settingsDraft;
      check(after && eq(after, withE(before)), 'the settings draft is the staged value plus E, nothing else', after && Object.keys(after));
      check(after && eq(after.permissions.deny, before.permissions.deny), 'the staged deny array is unchanged, in order', after && after.permissions && after.permissions.deny.length);
      const project = readBytes(projPath(g.v2.root, T_SETTINGS));
      const indentMatch = project && project.toString('utf8').match(/\n([ \t]+)"/);
      const style = { indent: indentMatch ? indentMatch[1] : 2, eol: project && project.toString('utf8').includes('\r\n') ? '\r\n' : '\n' };
      check(readText(draftPath(g.root, GID, T_SETTINGS)) === ser(withE(before), style), 'the draft keeps the original project file indentation and EOL, with no BOM and one final newline', clip(readText(draftPath(g.root, GID, T_SETTINGS))));
      const mk = readJson(runFile(g.root, GID, 'managed-keys.json'));
      const mk0 = (() => { try { return JSON.parse(readText(runFile(g.control.root, GID, 'managed-keys.json'))); } catch { return null; } })();
      check(mk0 !== null && mk && eq(mk[T_SETTINGS], { ...mk0[T_SETTINGS], hooks: [H] }) && eq(Object.keys(mk[T_SETTINGS]), [...Object.keys(mk0[T_SETTINGS]), 'hooks']), 'the settings record is C3\'s record plus a final hooks [H]: the deny ownership and heldBack are unchanged', mk && mk[T_SETTINGS]);
      check(mk && mk0 && eq(mk[T_POLICY], mk0[T_POLICY]), 'the policy record is unchanged');
      check(!(mk[T_SETTINGS]['permissions.deny'] || []).includes(DROPPED), 'the dropped ownership choice is still dropped', mk[T_SETTINGS]['permissions.deny']);
      check(eq(readJson(runFile(g.root, GID, 'ownership.json')), readJson(runFile(g.control.root, GID, 'ownership.json'))), 'the ownership request is unchanged (both targets keep keys)');
    });
    flushProcessCount(context, 'R52/C6/staging');
  });
}

// =================================================== V2/C6/transaction ====
// Plan 3.11 and 4.6: the narrow content-approval exemption for the canonical managed addition, every mutation that must still need approval, the C2 metadata
// approvals, the combined message, drift, one-journal commit, the genuine no-op, rollback, and the genuine v2 transaction (steps 8-12).
// P: a prepare rejection with one entry per affected target (plan 4.5 of C4 / C2): exit 3, empty stderr, two-space JSON with one final LF.
function expectP(check, label, r, entries, exit = 3) {
  check(r.code === exit && r.stderr === '' && r.stdout === jsonText({ ok: false, code: 'APPLY_PLAN_REJECTED', error: MSG.PLAN_REJECTED, errors: entries }), `${label}: the exact plan rejection`, { code: r.code, out: r.stdout.slice(0, 500), err: r.stderr.slice(0, 200) });
}
const refuseHooks = (extra = []) => [{ target: T_SETTINGS, code: 'APPLY_APPROVAL_REQUIRED', error: contentApprovalError(T_SETTINGS, [R_HOOKS, ...extra]) }];
const L2 = { matcher: 'Write', hooks: [{ type: 'command', command: 'node w.mjs' }] };
async function transactionGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const plain = await usePlain(failures, context);
    const tb = loadTrusted(failures, context);
    if (!plain || !tb) return;
    const kit = makeKit(context, check);
    const S3 = hooksOf([U, V]);
    await withScratch(context, 'txn', async (dir) => {
      let n = 0;
      // One scenario = a clone of the prepared plain project with a project settings file, an optional settings draft, the request files hooks-only would stage,
      // and the reviewed runtime members as drafts ('staged'), as installed files (installed), or absent.
      const scenario = (label, o = {}) => {
        const root = cloneTree(plain.root, path.join(dir, `${label}-${++n}`));
        if (o.settings !== undefined) putFile(projPath(root, T_SETTINGS), ser(o.settings));
        if (o.draft !== undefined) putDraft(root, RID, T_SETTINGS, ser(o.draft));
        if (o.requests !== false) {
          putRequest(root, RID, 'ownership.json', o.ownership || OWNER_KEYS);
          putRequest(root, RID, 'managed-keys.json', { [T_SETTINGS]: o.managed || { hooks: [H] } });
        }
        if (o.unit === 'staged') for (const t of UNIT) putDraft(root, RID, t, tb[t]);
        if (o.installed) installGuard(root, tb, o.installed === true ? {} : o.installed);
        if (o.declared) putRequest(root, RID, 'transaction-inputs.json', o.declared);
        if (o.manifest) putFile(manifestPath(root), manifestOf(o.manifest));
        return root;
      };
      const prep = (root, approve = [], o = {}) => kit.prepare(root, RID, { approve, ...o });
      const okPrep = (label, r) => {
        check(r.code === 0 && r.stderr === '' && r.json && r.json.ok === true, `${label}: prepare succeeds with no approval`, { code: r.code, out: r.stdout.slice(0, 500), err: r.stderr.slice(0, 200) });
        const op = r.json && r.json.ops && r.json.ops.find((x) => x.target === T_SETTINGS);
        check(op && op.userContentChange === false && eq(op.userContentReasons, []), `${label}: the settings op has userContentChange false and userContentReasons [] (C6-P2-7)`, op);
        return r;
      };

      await step('exact canonical append with a reviewed staged guard (all seven members staged) needs no settings approval: hooks absent, PreToolUse absent, PreToolUse present', async () => {
        const shapes = [
          ['hooks absent', { env: { A: '1' } }, (s) => ({ ...s, hooks: { PreToolUse: [E] } })],
          ['PreToolUse absent', { hooks: { PostToolUse: [L2] } }, (s) => ({ hooks: { PostToolUse: [L2], PreToolUse: [E] } })],
          ['PreToolUse present', S3, () => hooksOf([U, V, E])],
        ];
        for (const [label, settings, draftOf] of shapes) {
          const root = scenario('ex', { settings, draft: draftOf(settings), unit: 'staged' });
          okPrep(`staged guard, ${label}`, prep(root));
        }
      });
      await step('the same append with a reviewed installed guard needs a declared transaction input: declared and unchanged passes; undeclared (never read), altered guard and altered core need approval', async () => {
        const draft = hooksOf([U, V, E]);
        const ok = scenario('inst-ok', { settings: S3, draft, installed: true, declared: [T_GUARD, T_GUARD_CORE] });
        const r = okPrep('declared reviewed installed guard', prep(ok));
        const plan = readPlan(ok, RID);
        check(plan && [T_GUARD, T_GUARD_CORE].every((t) => plan.metadata.transactionInputs.includes(t) && plan.inputs.some((i) => i.target === t)), 'the declared installed guard and core are bound inputs of the plan', plan && plan.metadata.transactionInputs);
        void r;
        const undeclared = scenario('inst-undecl', { settings: S3, draft, installed: true });
        const watch = readGuard(dir, [projPath(undeclared, T_GUARD), projPath(undeclared, T_GUARD_CORE)]);
        expectP(check, 'an installed guard that is not a declared input', prep(undeclared, [], { preload: watch.file }), refuseHooks());
        check(watch.hits().length === 0, 'the undeclared installed guard and core were never read (no role is added silently)', watch.hits().slice(0, 3));
        const altered = scenario('inst-alt', { settings: S3, draft, installed: { [T_GUARD]: Buffer.concat([tb[T_GUARD], Buffer.from('// altered\n')]) }, declared: [T_GUARD, T_GUARD_CORE] });
        expectP(check, 'a declared installed guard with altered bytes', prep(altered), refuseHooks());
        const alteredCore = scenario('inst-altcore', { settings: S3, draft, installed: { [T_GUARD_CORE]: Buffer.concat([tb[T_GUARD_CORE], Buffer.from('// altered\n')]) }, declared: [T_GUARD, T_GUARD_CORE] });
        expectP(check, 'a declared installed core with altered bytes', prep(alteredCore), refuseHooks());
      });
      await step('with no reviewed guard anywhere the exemption is unavailable: the normal hooks-change approval reason is kept', async () => {
        const root = scenario('noguard', { settings: S3, draft: hooksOf([U, V, E]) });
        expectP(check, 'canonical append, no guard', prep(root), refuseHooks());
        check(!exists(runFile(root, RID, 'plan.json')), 'a rejected prepare writes no plan');
        const ok = prep(root, [T_SETTINGS]);
        check(ok.code === 0 && ok.json && ok.json.ok === true, 'with the path approved the same plan prepares', { code: ok.code, out: ok.stdout.slice(0, 300) });
        const op = ok.json && ok.json.ops && ok.json.ops.find((x) => x.target === T_SETTINGS);
        check(op && op.userContentChange === true && eq(op.userContentReasons, [R_HOOKS]), 'and the hooks reason is the only content reason', op);
      });
      await step('anything but the exact canonical append needs the normal approval, even with a reviewed staged guard: altered command, matcher, event, options, key order, extra fields, placement, duplicates', async () => {
        const mutated = [
          ['an altered command', (e) => ({ ...e, hooks: [{ type: 'command', command: `${H.command} ` }] })],
          ['an altered matcher', (e) => ({ ...e, matcher: 'Bash' })],
          ['an option added inside the hook', (e) => ({ ...e, hooks: [{ type: 'command', command: H.command, timeout: 5 }] })],
          ['the matcher and hooks keys swapped', (e) => ({ hooks: e.hooks, matcher: e.matcher })],
          ['the type and command keys swapped', (e) => ({ matcher: e.matcher, hooks: [{ command: H.command, type: 'command' }] })],
          ['an extra entry-level field', (e) => ({ ...e, userOption: 1 })],
          ['a second hook in the entry', (e) => ({ ...e, hooks: [...e.hooks, { type: 'command', command: 'node more.mjs' }] })],
        ];
        for (const [label, fn] of mutated) {
          const root = scenario('mut', { settings: S3, draft: hooksOf([U, V, fn(E)]), unit: 'staged' });
          expectP(check, label, prep(root), refuseHooks());
        }
        const others = [
          ['E under another event', { hooks: { PreToolUse: [U, V], PostToolUse: [E] } }],
          ['E in a non-final position', hooksOf([U, E, V])],
          ['E appended twice', hooksOf([U, V, E, E])],
          ['a user hook edited next to the append', hooksOf([{ ...U, hooks: [{ ...U.hooks[0], timeout: 10 }] }, V, E])],
          ['a user hook removed next to the append', hooksOf([U, E])],
          ['user hooks reordered next to the append', hooksOf([V, U, E])],
        ];
        for (const [label, draft] of others) {
          const root = scenario('mut', { settings: S3, draft, unit: 'staged' });
          expectP(check, label, prep(root), refuseHooks());
        }
      });
      await step('managed identity change or removal needs the C2 metadata approval; a metadata-only removal writes no settings and commits with approval', async () => {
        const recorded = (hooks) => ({ [T_SETTINGS]: { ownership: 'keys', managed: { hooks } } });
        const base = (label, requested) => scenario(label, { settings: hooksOf([U, V, E]), managed: { hooks: requested }, manifest: recorded([H]) });
        const H2 = { ...H, command: 'node other.mjs' };
        expectP(check, 'an identity replaced by another', prep(base('rep', [H2])), [{ target: T_SETTINGS, code: 'APPLY_APPROVAL_REQUIRED', error: metaApprovalError(T_SETTINGS) }]);
        const root = base('rm', []);
        const before = readBytes(projPath(root, T_SETTINGS));
        expectP(check, 'a metadata-only removal', prep(root), [{ target: T_SETTINGS, code: 'APPLY_APPROVAL_REQUIRED', error: metaApprovalError(T_SETTINGS) }]);
        check(!exists(runFile(root, RID, 'plan.json')), 'the refusal wrote no plan');
        const p = prep(root, [T_SETTINGS]);
        check(p.code === 0 && p.json && p.json.ok === true, 'with the settings path approved the removal prepares', { code: p.code, out: p.stdout.slice(0, 300) });
        const plan = readPlan(root, RID);
        check(plan && !plan.ops.some((o) => o.target === T_SETTINGS) && plan.metadataOps.some((m) => m.kind === 'file' && m.target === T_SETTINGS && eq(m.reasons, [R_SETTINGS])), 'the plan has a settings metadata operation (reason: settings ownership or managed metadata changes) and no settings content operation', plan && plan.ops.map((o) => o.target));
        const c = kit.commit(root, RID, p.json && p.json.planSha256);
        check(c.code === 0 && c.json && c.json.committed === true, 'commit succeeds', { code: c.code, out: c.stdout.slice(0, 300) });
        check(sameBytes(readBytes(projPath(root, T_SETTINGS)), before), 'no settings write: the project settings bytes are unchanged');
        const rec = readManifestFile(root);
        check(rec && eq(rec.files[T_SETTINGS].managed.hooks, []), 'the manifest records the removal as an empty managed.hooks array', rec && rec.files[T_SETTINGS]);
      });
      await step('combined hook content and ownership changes give the exact combined message; with approval content and metadata commit together under one journal; drift after prepare is refused; rollback preserves a later edit (exit 6)', async () => {
        const HX = { event: 'PostToolUse', matcher: 'Write', command: 'node old.mjs' };
        const altered = { ...E, hooks: [{ type: 'command', command: `${H.command} ` }] };
        const root = scenario('combo', { settings: S3, draft: hooksOf([U, V, altered]), unit: 'staged', managed: { hooks: [H] }, manifest: { [T_SETTINGS]: { ownership: 'keys', managed: { hooks: [HX] } } } });
        expectP(check, 'altered hook content plus a replaced managed identity', prep(root), [{ target: T_SETTINGS, code: 'APPLY_APPROVAL_REQUIRED', error: 'draft changes user settings key "hooks"; settings ownership or managed metadata changes. Show the diff; re-run prepare with --approve-user-content .claude/settings.json only after the user approves it' }]);
        const p = prep(root, [T_SETTINGS]);
        check(p.code === 0 && p.json && p.json.ok === true, 'with the settings path approved the combined plan prepares', { code: p.code, out: p.stdout.slice(0, 300) });
        if (!(p.code === 0 && p.json)) return;
        const op = p.json.ops.find((x) => x.target === T_SETTINGS);
        check(op && op.userContentChange === true && eq(op.userContentReasons, [R_HOOKS]), 'the settings op carries the hooks reason', op);
        const sha1 = p.json.planSha256;
        // drift: a draft changed after prepare is refused by the prepared review and by commit, with nothing written
        const drift = cloneTree(root, path.join(dir, `combo-drift-${++n}`));
        putDraft(drift, RID, T_SETTINGS, ser({ ...hooksOf([U, V, altered]), env: { LATE: '1' } }));
        const before = projectSnapshot(drift);
        const dc = kit.commit(drift, RID, sha1);
        check(dc.code === 4 && dc.json && dc.json.code === 'APPLY_DRIFT' && dc.json.error === MSG.DRIFT && Array.isArray(dc.json.drift) && dc.json.drift.some((d) => d.target === T_SETTINGS && d.what === 'draft changed after prepare (unreviewed content)'), 'a draft changed after prepare is APPLY_DRIFT (exit 4) naming the settings draft', { code: dc.code, out: dc.stdout.slice(0, 400) });
        check(projectSnapshot(drift) === before, 'the refused commit wrote nothing');
        // commit
        const c = kit.commit(root, RID, sha1);
        check(c.code === 0 && c.json && c.json.committed === true, 'commit succeeds (approved content and metadata together)', { code: c.code, out: c.stdout.slice(0, 400) });
        const j = readJournal(root, RID);
        const targets = j ? j.entries.map((e) => e.target) : [];
        check(j && targets.includes(T_SETTINGS) && targets[targets.length - 1] === T_MANIFEST && j.entries.every((e) => e.state === 'applied'), 'one journal holds the settings content and the manifest (written last), all applied', targets);
        const written = readJson(projPath(root, T_SETTINGS));
        check(written && eq(written.hooks.PreToolUse, [U, V, altered]), 'the approved settings content was written', written && written.hooks);
        const rec = readManifestFile(root);
        check(rec && eq(rec.files[T_SETTINGS].managed.hooks, [H]), 'the manifest records H as the managed hook', rec && rec.files[T_SETTINGS]);
        // rollback after a later edit: the existing exit-6 behavior preserves the edit
        const later = ser({ ...written, later: { edit: true } });
        putFile(projPath(root, T_SETTINGS), later);
        const rb = kit.rollback(root, RID);
        check(rb.code === 6 && rb.stderr === '', 'rollback after a later edit stays incomplete (exit 6)', { code: rb.code, out: rb.stdout.slice(0, 300) });
        check(readText(projPath(root, T_SETTINGS)) === later, 'the later edit is preserved byte for byte');
      });
      await step('an equal rerun is a genuine no-op: the hook is already present and owned, hooks-only only records its request files, prepare has no work and commit changes nothing', async () => {
        const root = scenario('rerun', { settings: hooksOf([U, V, E]), requests: false, installed: true, manifest: { [T_SETTINGS]: { ownership: 'keys', managed: { hooks: [H] } } } });
        const r = kit.hooksOnly(root, RID);
        expectHooksOk(check, 'rerun hooks-only', r, { changed: false, metadataChanged: true, draft: null, report: OWN });
        check(readText(runFile(root, RID, 'transaction-inputs.json')) === jsonText([T_GUARD, T_GUARD_CORE]), 'the installed guard and core are declared inputs', readText(runFile(root, RID, 'transaction-inputs.json')));
        const settingsBytes = readBytes(projPath(root, T_SETTINGS));
        const manifestBytes = readBytes(manifestPath(root));
        const p = prep(root);
        check(p.code === 0 && p.json && p.json.ok === true && p.json.changed === 0 && p.json.metadataChanged === 0, 'prepare finds no content and no metadata change', { code: p.code, out: p.stdout.slice(0, 400) });
        const plan = readPlan(root, RID);
        check(plan && plan.manifestAfter === null, 'a genuine no-op has manifestAfter null', plan && plan.manifestAfter);
        const c = kit.commit(root, RID, p.json && p.json.planSha256);
        check(c.code === 0 && c.stderr === '' && c.stdout === jsonText(NOOP_BODY), 'commit prints the exact no-op response', { code: c.code, out: c.stdout.slice(0, 300) });
        check(!exists(runFile(root, RID, 'journal.json')) && sameBytes(readBytes(projPath(root, T_SETTINGS)), settingsBytes) && sameBytes(readBytes(manifestPath(root)), manifestBytes), 'no journal, and the settings and manifest bytes are unchanged');
      });
    });

    // ---------------------------------------------------- genuine v2 (steps 8-12) ----
    await step('genuine v2: prepare needs exactly the approvals C3 requires (no refusal names hooks, none is unrelated), the prepared diff passes, commit installs the seven-member unit, E and H together, and rollback restores the original bytes', async () => {
      let g;
      try { g = await getGenuine(context); } catch (e) { failures.push(`cannot build the genuine v2 scenario: ${errMsg(e)}`); return; }
      for (const f of g.fails) failures.push(`scenario build: ${f}`);
      if (!g.started || !g.started.ok || !g.hooks || g.hooks.code !== 0 || !g.control.ok) { check(false, 'the staged genuine v2 state with hooks-only and its control are required', { started: !!(g.started && g.started.ok), hooks: g.hooks && g.hooks.code, control: g.control.ok }); return; }
      await withScratch(context, 'gv2', async (dir2) => {
        const root = cloneTree(g.root, path.join(dir2, 'r'));
        const p = prepareApproving(kit, root, GID, [T_POLICY]);
        check(p.ok === true, 'prepare succeeds with the approvals it asks for', p.prep && p.prep.stdout.slice(0, 500));
        if (!p.ok) return;
        check(eq(sorted(p.approved), sorted(g.control.approved)), 'the approval set equals the one C3 alone required for the same decisions (C6-P2-10)', { main: p.approved, control: g.control.approved });
        check(eq(p.seen, g.control.seen), 'every refusal on the way is identical to the control: hooks-only added no required approval', { main: p.seen, control: g.control.seen });
        check(p.seen.every((e) => e.code !== 'APPLY_APPROVAL_UNRELATED' && !/hooks/.test(e.error)), 'no refusal names hooks and none is APPLY_APPROVAL_UNRELATED', p.seen);
        const op = p.prep.json.ops.find((x) => x.target === T_SETTINGS);
        check(op && eq(op.userContentReasons, []) && op.userContentChange === false, 'the settings op has no content reason: the canonical append is exempt', op);
        const pd = kit.diff(root, GID);
        check(pd.code === 0 && pd.json && pd.json.ok === true && pd.json.prepared === true, 'the prepared diff passes', { code: pd.code, out: pd.stdout.slice(0, 300) });
        const c = kit.commit(root, GID, p.sha);
        check(c.code === 0 && c.json && c.json.committed === true, 'commit succeeds with the approved hash', { code: c.code, out: c.stdout.slice(0, 400) });
        const created = (t) => t !== T_ENTRY;
        check(c.json && eq(c.json.written, [...UNIT.map((t) => ({ target: t, created: created(t) })), { target: T_SETTINGS, created: false }, { target: T_POLICY, created: false }, { target: T_MANIFEST, created: false }]), 'the seven members are written in catalog order, then settings, the dependent policy and the manifest last', c.json && c.json.written);
        for (const t of UNIT) check(NH(readBytes(projPath(root, t)) || '') === NH(tb[t]), `${t}: installed equal to its trusted source`);
        const settings = readJson(projPath(root, T_SETTINGS));
        const staged = g.staged.settingsDraft;
        check(settings && eq(settings, withE(staged)) && eq(settings.hooks.PreToolUse[settings.hooks.PreToolUse.length - 1], E), 'the installed settings are the staged value plus E (last in PreToolUse)', settings && Object.keys(settings));
        const rec = readManifestFile(root);
        check(rec && eq(rec.files[T_SETTINGS].managed.hooks, [H]) && eq(rec.files[T_SETTINGS].managed['permissions.deny'], readJson(runFile(g.root, GID, 'managed-keys.json'))[T_SETTINGS]['permissions.deny']), 'the manifest records H and the C3 deny ownership', rec && rec.files[T_SETTINGS]);
        check(UNIT.every((t) => rec.files[t] && rec.files[t].ownership === 'full' && rec.files[t].sha256 === NH(readBytes(projPath(root, t)))), 'the seven runtime members are recorded as full with the hash of their installed bytes', UNIT.map((t) => rec.files[t]));
        const rb = kit.rollback(root, GID);
        check(rb.code === 0 && rb.json && rb.json.complete === true, 'rollback completes through the same journal', { code: rb.code, out: rb.stdout.slice(0, 300) });
        for (const t of [T_SETTINGS, T_POLICY, T_ENTRY, T_MANIFEST]) check(sameBytes(readBytes(projPath(root, t)), readBytes(projPath(g.v2.root, t))), `${t}: the exact genuine v2 bytes are back`);
        check(UNIT.filter((t) => t !== T_ENTRY).every((t) => !exists(projPath(root, t))), 'the newly created runtime members are removed');
      });
    });
    flushProcessCount(context, 'V2/C6/transaction');
  });
}

// ===================================================== R72/C6/selftest ====
// Plan 2.6 and 3.12: the executor seam (exact calls, every mismatch, every invalid result), then the real CLI cases. The expected outputs are restated here;
// nothing is imported from the production hook.
const ST_CASES = [
  { id: 'allowed', input: MIN_ALLOW, status: 0, stdout: '', stderr: '' },
  { id: 'blocked', input: MIN_BLOCK, status: 2, stdout: '', stderr: BLOCK_STDERR },
  { id: 'malformed', input: '{', status: 1, stdout: '', stderr: MALFORMED_STDERR },
];
const stOk = (c) => ({ status: c.status, signal: null, error: null, stdout: c.stdout, stderr: c.stderr });
const stTranscript = (flags) => `${ST_CASES.map((c, i) => `${flags[i] ? 'PASS' : 'FAIL'}  guard-raw-git/${c.id}`).join('\n')}\n${flags.filter(Boolean).length} PASS / ${flags.filter((f) => !f).length} FAIL\n`;
const stExpect = (flags) => ({
  ok: flags.every(Boolean), code: flags.every(Boolean) ? null : 'HOOK_SELFTEST_FAILED', cases: ST_CASES.map((c, i) => ({ id: c.id, passed: flags[i] })),
  exitCode: flags.every(Boolean) ? 0 : 1, stdout: stTranscript(flags), stderr: '',
});
// A recording executor: `over[i]` replaces the answer of call i (a result, or a function of (case, options) that may throw or return a promise).
function stExec(over = {}, sync = false) {
  const calls = [];
  const execute = (executable, argv, options) => {
    const i = calls.length;
    calls.push({ executable, argv: [...argv], options: { ...options }, optionKeys: Object.keys(options) });
    const c = ST_CASES.find((x) => x.input === options.input) || ST_CASES[Math.min(i, 2)];
    let r = stOk(c);
    if (over[i] !== undefined) r = typeof over[i] === 'function' ? over[i](c, options) : over[i];
    return sync || (r && typeof r.then === 'function') ? r : Promise.resolve(r);
  };
  return { execute, calls };
}
async function selftestGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const st = await loadSelftest(failures, context);
    if (!st) return;
    const hookPath = path.join(context.tmp, 'c6-fake-hook', 'guard-raw-git.mjs');
    const run = (o) => st.runHooksSelfTest({ hookPath, ...o });
    await step('import safety: the module exports exactly runHooksSelfTest and importing it spawns and writes nothing', async () => {
      await withScratch(context, 'probe-selftest', async (dir) => { checkImportSafe(check, SELFTEST_REL, context, dir, assetUrl(context, SELFTEST_REL), SELFTEST_EXPORTS); });
    });
    await step('the executor receives process.execPath, [hookPath] and the exact options for the three pinned inputs, in order; all passing gives the exact success result', async () => {
      const e = stExec();
      const r = await run({ execute: e.execute });
      check(eq(r, stExpect([true, true, true])), 'the success result: ok true, code null, three passed cases, exit 0, the exact transcript, empty stderr', r);
      check(eq(keysOf(r), ['ok', 'code', 'cases', 'exitCode', 'stdout', 'stderr']) && r.cases.every((c) => eq(keysOf(c), ['id', 'passed'])), 'the result keys are in the pinned order');
      check(e.calls.length === 3 && e.calls.every((c) => c.executable === process.execPath && eq(c.argv, [hookPath])), 'three calls, each with process.execPath and [hookPath]', e.calls.map((c) => [c.executable, c.argv]));
      check(eq(e.calls.map((c) => c.options.input), ST_CASES.map((c) => c.input)), 'the exact stdin of each case, in order (allowed, blocked, malformed)', e.calls.map((c) => c.options.input));
      check(e.calls.every((c) => eq(c.optionKeys.slice().sort(), ['encoding', 'input', 'maxBuffer', 'shell', 'timeout', 'windowsHide']) && c.options.shell === false && c.options.windowsHide === true && c.options.encoding === 'utf8' && c.options.timeout === 5000 && c.options.maxBuffer === 65536), 'the options are exactly input, shell false, windowsHide true, encoding utf8, timeout 5000, maxBuffer 65536', e.calls.map((c) => c.options));
      const s = await run({ execute: stExec({}, true).execute });
      check(eq(s, stExpect([true, true, true])), 'a synchronous executor result is accepted too');
    });
    await step('the default hookPath is the absolute sibling guard-raw-git.mjs; an injected hookPath is passed through exactly', async () => {
      const e = stExec();
      await st.runHooksSelfTest({ execute: e.execute });
      const want = path.join(context.skillRoot, 'assets', 'tools', 'guard-raw-git.mjs');
      const lc = (p) => (WIN ? path.resolve(p).toLowerCase() : path.resolve(p));
      check(e.calls.length === 3 && e.calls.every((c) => path.isAbsolute(c.argv[0]) && lc(c.argv[0]) === lc(want)), 'the default path is the sibling of the module, absolute', e.calls.map((c) => c.argv));
      const custom = path.join(context.tmp, 'c6-other', 'hook.mjs');
      const f = stExec();
      await st.runHooksSelfTest({ hookPath: custom, execute: f.execute });
      check(f.calls.every((c) => eq(c.argv, [custom])), 'an injected absolute hookPath is the only argument', f.calls.map((c) => c.argv));
    });
    await step('every single-case mismatch fails that case only, continues with the others and reports the exact failure transcript', async () => {
      const mutations = [
        ['a wrong status', (c) => ({ ...stOk(c), status: c.status === 0 ? 1 : c.status === 2 ? 0 : 2 })],
        ['unexpected stdout', (c) => ({ ...stOk(c), stdout: 'unexpected' })],
        ['unexpected stderr', (c) => ({ ...stOk(c), stderr: c.stderr + 'extra\n' })],
        ['the other message on stderr', (c) => ({ ...stOk(c), stderr: c.id === 'blocked' ? MALFORMED_STDERR : c.id === 'malformed' ? BLOCK_STDERR : 'x\n' })],
        ['a signal', (c) => ({ ...stOk(c), signal: 'SIGTERM' })],
      ];
      for (let i = 0; i < 3; i++) {
        for (const [label, mut] of mutations) {
          const flags = [true, true, true]; flags[i] = false;
          const e = stExec({ [i]: mut });
          const r = await run({ execute: e.execute });
          check(eq(r, stExpect(flags)) && e.calls.length === 3, `${ST_CASES[i].id}: ${label}`, r);
        }
      }
    });
    await step('invalid executor results fail the case: non-integer or missing status, invalid signal, a present error, missing or non-string streams, non-objects; extra keys are ignored (C6-P2-9)', async () => {
      const bad = [
        ['status 1.5', (c) => ({ ...stOk(c), status: 1.5 })], ['status as a string', (c) => ({ ...stOk(c), status: String(c.status) })], ['status NaN', (c) => ({ ...stOk(c), status: NaN })],
        ['status undefined', (c) => ({ ...stOk(c), status: undefined })], ['status null', (c) => ({ ...stOk(c), status: null })],
        ['signal undefined', (c) => { const r = stOk(c); delete r.signal; return r; }], ['signal a number', (c) => ({ ...stOk(c), signal: 9 })],
        ['error an Error', (c) => ({ ...stOk(c), error: new Error('x') })], ['error a string', (c) => ({ ...stOk(c), error: 'ENOENT' })], ['error 0', (c) => ({ ...stOk(c), error: 0 })],
        ['stdout missing', (c) => { const r = stOk(c); delete r.stdout; return r; }], ['stdout a Buffer', (c) => ({ ...stOk(c), stdout: Buffer.from(c.stdout) })], ['stdout null', (c) => ({ ...stOk(c), stdout: null })],
        ['stderr missing', (c) => { const r = stOk(c); delete r.stderr; return r; }], ['stderr a Buffer', (c) => ({ ...stOk(c), stderr: Buffer.from(c.stderr) })], ['stderr a number', (c) => ({ ...stOk(c), stderr: 0 })],
        ['the result undefined', () => undefined], ['the result null', () => null], ['the result a string', () => 'ok'], ['the result an array', (c) => [stOk(c)]],
      ];
      for (const [label, mut] of bad) {
        const e = stExec({ 0: mut });
        const r = await attempt(() => run({ execute: e.execute }));
        check(!r.threw && eq(r.value, stExpect([false, true, true])), `invalid result (${label}) fails the allowed case only`, r.threw ? errMsg(r.error) : r.value);
      }
      const extra = stExec({ 0: (c) => ({ ...stOk(c), error: undefined, pid: 4242, output: [null, '', ''] }), 1: (c) => ({ ...stOk(c), pid: 1 }) });
      const r = await run({ execute: extra.execute });
      check(eq(r, stExpect([true, true, true])), 'extra keys (pid, output) and an undefined error field are ignored', r);
    });
    await step('executor throws and rejections, spawn errors, timeouts and signals are failed cases; the run continues; no child output or native error text is forwarded', async () => {
      const MARK = 'NATIVE-ERR-MARKER';
      const kinds = [
        ['a synchronous throw', () => { throw new Error(MARK); }],
        ['a rejected promise', () => Promise.reject(new Error(MARK))],
        ['a spawn error', (c) => ({ status: null, signal: null, error: Object.assign(new Error(`spawnSync ${MARK}`), { code: 'ENOENT' }), stdout: '', stderr: '' })],
        ['a timeout', (c) => ({ status: null, signal: 'SIGTERM', error: Object.assign(new Error(`spawnSync ${MARK}`), { code: 'ETIMEDOUT' }), stdout: '', stderr: '' })],
        ['a signal exit with output', (c) => ({ status: null, signal: 'SIGKILL', error: null, stdout: 'CHILD-OUT-MARKER', stderr: 'CHILD-ERR-MARKER' })],
      ];
      for (let i = 0; i < 3; i++) {
        for (const [label, fn] of kinds) {
          const flags = [true, true, true]; flags[i] = false;
          const e = stExec({ [i]: fn });
          const r = await attempt(() => run({ execute: e.execute }));
          check(!r.threw && eq(r.value, stExpect(flags)) && e.calls.length === 3, `${ST_CASES[i].id}: ${label}`, r.threw ? errMsg(r.error) : r.value);
          if (!r.threw) check(!/MARKER/.test(r.value.stdout) && r.value.stderr === '', `${ST_CASES[i].id}: ${label}: nothing from the child or the native error is forwarded`, { stdout: r.value.stdout, stderr: r.value.stderr });
        }
      }
    });
    await step('all-failed results and the always-zero silent hook produce the pinned transcripts and exit code 1', async () => {
      const missing = stExec({ 0: { status: 1, signal: null, error: null, stdout: '', stderr: 'Error: Cannot find module' }, 1: { status: 1, signal: null, error: null, stdout: '', stderr: 'Error: Cannot find module' }, 2: { status: 1, signal: null, error: null, stdout: '', stderr: 'Error: Cannot find module' } });
      const a = await run({ execute: missing.execute });
      check(eq(a, stExpect([false, false, false])) && a.stdout === 'FAIL  guard-raw-git/allowed\nFAIL  guard-raw-git/blocked\nFAIL  guard-raw-git/malformed\n0 PASS / 3 FAIL\n', 'a missing hook: three FAIL lines and 0 PASS / 3 FAIL', a);
      const zero = { status: 0, signal: null, error: null, stdout: '', stderr: '' };
      const silent = stExec({ 0: zero, 1: zero, 2: zero });
      const b = await run({ execute: silent.execute });
      check(eq(b, stExpect([true, false, false])) && b.stdout === 'PASS  guard-raw-git/allowed\nFAIL  guard-raw-git/blocked\nFAIL  guard-raw-git/malformed\n1 PASS / 2 FAIL\n', 'an always-zero silent hook: 1 PASS / 2 FAIL', b);
      check(b.ok === false && b.code === 'HOOK_SELFTEST_FAILED' && b.exitCode === 1 && b.stderr === '', 'the failure result: ok false, code HOOK_SELFTEST_FAILED, exit 1, empty stderr');
    });
    await step('invalid options throw exactly HOOK_SELFTEST_OPTIONS: a non-object, unknown keys, an invalid or relative hookPath, a non-function execute', async () => {
      const MSG_OPT = 'HOOK_SELFTEST_OPTIONS: invalid self-test options';
      // PLAN-GAP: null and arrays as the options value are not pinned ("a non-object options value"), so they are not tested.
      const bad = [['a number', 5], ['a string', 'x'], ['true', true], ['an unknown key', { foo: 1 }], ['an unknown key beside valid ones', { hookPath, execute: stExec().execute, extra: 1 }],
        ['a numeric hookPath', { hookPath: 5 }], ['an empty hookPath', { hookPath: '' }], ['a relative hookPath', { hookPath: 'guard-raw-git.mjs' }], ['a dot-relative hookPath', { hookPath: './guard-raw-git.mjs' }],
        ['a numeric execute', { hookPath, execute: 5 }], ['a string execute', { hookPath, execute: 'x' }], ['a null execute', { hookPath, execute: null }]];
      for (const [label, o] of bad) await expectErr(check, `options ${label}`, () => st.runHooksSelfTest(o), 'HOOK_SELFTEST_OPTIONS', MSG_OPT);
      const fine = await attempt(() => st.runHooksSelfTest({ hookPath, execute: stExec().execute }));
      check(!fine.threw && fine.value.ok === true, 'control: valid options are accepted', fine.threw ? errMsg(fine.error) : fine.value);
    });
    await step('the real CLI: the installed real guard prints the exact success transcript; an always-zero silent guard prints the exact 1 PASS / 2 FAIL transcript; an unexpected argument prints the exact usage', async () => {
      const selftest = readBytes(path.join(context.skillRoot, ...SELFTEST_REL.split('/')));
      const guard = readBytes(hookPathOf(context));
      const core = readBytes(path.join(context.skillRoot, ...GUARD_CORE_REL.split('/')));
      if (selftest === null || guard === null || core === null) { check(false, 'the self-test, guard and core sources are readable'); return; }
      await withScratch(context, 'selftest-cli', async (dir) => {
        const real = path.join(dir, 'real', '.ai', 'tools');
        putFile(path.join(real, 'hooks-selftest.mjs'), selftest);
        putFile(path.join(real, 'guard-raw-git.mjs'), guard);
        putFile(path.join(real, 'guard-raw-git-core.mjs'), core);
        const ok = execNode(context, { cwd: dir, script: path.join(real, 'hooks-selftest.mjs'), args: [] });
        check(ok.dead === null && ok.code === 0 && ok.stdout === SELFTEST_TRANSCRIPT && ok.stderr === '', 'installed real guard, run from another directory: exit 0, the exact transcript, empty stderr', { code: ok.code, out: ok.stdout.slice(0, 300), err: ok.stderr.slice(0, 300) });
        const silent = path.join(dir, 'silent', '.ai', 'tools');
        putFile(path.join(silent, 'hooks-selftest.mjs'), selftest);
        putFile(path.join(silent, 'guard-raw-git.mjs'), '// a hook that does nothing\n');
        const bad = execNode(context, { cwd: dir, script: path.join(silent, 'hooks-selftest.mjs'), args: [] });
        check(bad.dead === null && bad.code === 1 && bad.stdout === 'PASS  guard-raw-git/allowed\nFAIL  guard-raw-git/blocked\nFAIL  guard-raw-git/malformed\n1 PASS / 2 FAIL\n' && bad.stderr === '', 'always-zero silent guard: exit 1, the exact 1 PASS / 2 FAIL transcript, empty stderr', { code: bad.code, out: bad.stdout.slice(0, 300), err: bad.stderr.slice(0, 300) });
        const usage = execNode(context, { cwd: dir, script: path.join(real, 'hooks-selftest.mjs'), args: ['extra'] });
        check(usage.dead === null && usage.code === 1 && usage.stdout === '' && usage.stderr === 'hooks-selftest: usage: node .ai/tools/hooks-selftest.mjs\n', 'an unexpected argument: exit 1, empty stdout, the exact usage line on stderr', { code: usage.code, out: usage.stdout.slice(0, 200), err: usage.stderr.slice(0, 200) });
      });
    });
    flushProcessCount(context, 'R72/C6/selftest');
  });
}

// =================================================== V2/C6/runtime-unit ====
const needSibling = (failures, rel) => importOrFail(failures, new URL(rel, import.meta.url).href, `tests/${rel}`);
async function runtimeUnitGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    await step('data/runtime-units.json is exactly the seven-row catalog of plan 2.7 (roles, [1, 2] schemas, order) and every source exists', async () => {
      const file = readJson(path.join(context.skillRoot, T_CATALOG));
      check(eq(file, CATALOG_PRODUCTION), 'the catalog lists security-policy, git-safe-core, guard-raw-git-core, review-diff (helpers) then git-safe, guard-raw-git, hooks-selftest (entrypoints), in that order, each [1, 2]', file);
      for (const t of UNIT) check(readBytes(path.join(context.skillRoot, ...SRC_OF[t].split('/'))) !== null, `${SRC_OF[t]} exists`);
    });
    await step('the guard entrypoint is an unconditional thin CLI: no export, no argv[1] comparison, no process.exit, a dynamic core import inside one try/catch, stdin through fs.readFileSync(0) and process.exitCode', async () => {
      const src = readText(hookPathOf(context));
      if (src === null) { check(false, `${GUARD_REL} is readable`); return; }
      const code = stripComments(src);
      check(!/^\s*export\s/m.test(code), 'it exports nothing');
      check(!(/process\.argv\s*\[\s*1\s*\]/.test(code) && /import\.meta/.test(code)) && !/process\.argv\s*\[\s*1\s*\]/.test(code), 'it never compares argv[1] with import.meta.url');
      check(!/\bprocess\.exit\s*\(/.test(code), 'it never calls process.exit');
      check(/\bprocess\.exitCode\s*=/.test(code), 'it sets process.exitCode');
      check(/\.readFileSync\s*\(\s*0\s*\)/.test(code) && /^\s*import\s+\w+\s+from\s+['"](node:)?fs['"]/m.test(code), 'it reads stdin with readFileSync(0) through the default node:fs object (C6-P2-5)');
      check(/await\s+import\s*\(\s*['"]\.\/guard-raw-git-core\.mjs['"]\s*\)/.test(code), 'it loads the core with await import(\'./guard-raw-git-core.mjs\') (C6-P2-4)');
      check(!/^\s*import\s[^;]*guard-raw-git-core/m.test(code), 'it has no static import of the core');
      const at = code.search(/await\s+import\s*\(\s*['"]\.\/guard-raw-git-core\.mjs/);
      const tryAt = code.lastIndexOf('try', at);
      const catchAt = code.indexOf('catch', at);
      check(at > 0 && tryAt >= 0 && catchAt > at, 'the dynamic import sits inside a try block with a catch after it', { at, tryAt, catchAt });
    });
    const plain = await usePlain(failures, context);
    const tb = loadTrusted(failures, context);
    if (plain && tb) {
      const kit = makeKit(context, check);
      await withScratch(context, 'unit', async (dir) => {
        await step('a missing guard core, guard entrypoint or self-test with all other members valid is TOOL_UNIT_UNREVIEWED naming that member: exit 3 in the existing P envelope', async () => {
          for (const missing of [T_GUARD_CORE, T_GUARD, T_SELFTEST]) {
            const root = cloneTree(plain.root, path.join(dir, `missing-${path.basename(missing)}`));
            for (const t of UNIT) if (t !== missing) putDraft(root, RID, t, tb[t]);
            const r = kit.prepare(root, RID);
            expectP(check, `without ${missing}`, r, [{ target: missing, code: 'TOOL_UNIT_UNREVIEWED', error: MSG.TOOL_UNREVIEWED(missing) }]);
            check(!exists(runFile(root, RID, 'plan.json')), `without ${missing}: no plan was written`);
          }
        });
        await step('the complete reviewed unit prepares and commits in catalog write order, installs all seven members equal to their trusted sources and records them as full', async () => {
          const root = cloneTree(plain.root, path.join(dir, 'complete'));
          for (const t of UNIT) putDraft(root, RID, t, tb[t]);
          const p = kit.prepare(root, RID);
          check(p.code === 0 && p.json && p.json.ok === true, 'the seven trusted drafts prepare', { code: p.code, out: p.stdout.slice(0, 400) });
          if (!(p.code === 0 && p.json)) return;
          check(eq(readPlan(root, RID).ops.map((o) => o.target), UNIT), 'the plan operations are in the exact table order', readPlan(root, RID).ops.map((o) => o.target));
          const c = kit.commit(root, RID, p.json.planSha256);
          check(c.code === 0 && c.json && c.json.committed === true && eq(c.json.written.map((w) => w.target), [...UNIT, T_MANIFEST]) && UNIT.every((t) => c.json.written.some((w) => w.target === t && w.created === true)), 'commit writes the seven new members in table order, then the manifest last', c.json && c.json.written);
          for (const t of UNIT) check(NH(readBytes(projPath(root, t)) || '') === NH(tb[t]), `${t}: installed equal to its trusted source`);
          const rec = readManifestFile(root);
          check(rec && UNIT.every((t) => rec.files[t] && rec.files[t].ownership === 'full' && rec.files[t].sha256 === NH(readBytes(projPath(root, t)))), 'the seven members are recorded as full with the hash of their installed bytes', rec && UNIT.map((t) => rec.files[t]));
        });
      });
    }
    await step('registration: COMPONENT_ASSERTIONS.C6 is the twelve descriptors of plan 4.1 in order, written independently; COMPONENT_IMPLEMENTATIONS.C6 holds exactly the C6_IMPLEMENTATIONS objects; no complete numbered case or host record is added', async () => {
      const rc = await needSibling(failures, 'rc1-cases.mjs');
      if (!rc) return;
      const exp = rc.COMPONENT_ASSERTIONS && rc.COMPONENT_ASSERTIONS.C6;
      check(Array.isArray(exp) && eq(JSON.parse(JSON.stringify(exp)), EXPECTED_DESCRIPTORS) && deepFrozen(exp), 'COMPONENT_ASSERTIONS.C6 is the twelve descriptors, in order, deep-frozen', exp);
      const impls = rc.COMPONENT_IMPLEMENTATIONS && rc.COMPONENT_IMPLEMENTATIONS.C6;
      check(Array.isArray(impls) && Object.isFrozen(impls) && impls.length === C6_IMPLEMENTATIONS.length && impls.every((x, i) => x === C6_IMPLEMENTATIONS[i]), 'COMPONENT_IMPLEMENTATIONS.C6 is a frozen array of the C6_IMPLEMENTATIONS objects, in order', impls && impls.length);
      check(Object.isFrozen(C6_IMPLEMENTATIONS) && eq(C6_IMPLEMENTATIONS.map((x) => x.id), EXPECTED_DESCRIPTORS.map((d) => d.id)) && C6_IMPLEMENTATIONS.every((x) => typeof x.run === 'function' && Object.isFrozen(x)), 'C6_IMPLEMENTATIONS is a frozen array of the twelve IDs with callable run functions');
      const calls = [];
      const ret = rc.registerRc1Cases((...a) => calls.push(a), { repository: context.repository });
      check(calls.length === 0 && (ret === undefined || (ret && typeof ret.then === 'function')), 'registerRc1Cases still registers no complete numbered case', calls.length);
      check(!rc.REQUIRED_CASE_IDS.some((x) => x.includes('/C6/')), 'no complete-case inventory names a C6 sub-assertion');
    });
    flushProcessCount(context, 'V2/C6/runtime-unit');
  });
}

// ============================================================ registration ====
// The array wired into COMPONENT_IMPLEMENTATIONS.C6 (plan 4.1): frozen, descriptors frozen, in the plan order. Imports perform no work.
export const C6_IMPLEMENTATIONS = Object.freeze([
  { id: 'R50/C6/parser', run: (context) => parserGroup(context) },
  { id: 'R50/C6/sanctioned', run: (context) => sanctionedGroup(context) },
  { id: 'R50/C6/documentation', run: (context) => documentationGroup(context) },
  { id: 'R51/C6/process', run: (context) => processGroup(context) },
  { id: 'R51/C6/malformed', run: (context) => malformedGroup(context) },
  { id: 'R52/C6/merge', run: (context) => mergeGroup(context) },
  { id: 'R52/C6/staging', run: (context) => stagingGroup(context) },
  { id: 'R79/C6/identity', run: (context) => identityGroup(context) },
  { id: 'V2/C6/transaction', run: (context) => transactionGroup(context) },
  { id: 'R72/C6/selftest', run: (context) => selftestGroup(context) },
  { id: 'V2/C6/runtime-unit', run: (context) => runtimeUnitGroup(context) },
  { id: 'R84/C6/arguments', run: (context) => argumentsGroup(context) },
].map((d) => Object.freeze(d)));
