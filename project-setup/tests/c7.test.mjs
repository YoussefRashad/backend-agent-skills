// C7 tests lane: the twelve component assertions of "C7. Allow classification and retirement".
//
// Written from the frozen plan only, before any implementation exists:
//   docs/plans/2026-10-19-project-setup-v3-rc1-c7.md   (sections 1-9 and the freeze addendum: C7-PQ1 = A, C7-PQ2 = A and C7-P3-1 to C7-P3-3, which win over earlier sections)
// Under the frozen architecture plan docs/plans/2026-10-15-project-setup-v3-rc1.md and the landed contracts it builds on: C11a (tests/rc1-cases.mjs,
// tests/run-component-tests.mjs, tests/helpers/v2-baseline.mjs), C1 (assets/tools/security-policy.mjs), C2 (scripts/apply.mjs, scripts/ownership.mjs,
// scripts/lib.mjs), C3 (scripts/merge-claude-settings.mjs, scripts/migrate-security-paths.mjs, data/runtime-units.json, tests/c3.test.mjs), C4, C5 and C6
// (scripts/merge-claude-settings.mjs hooks-only staging, tests/c6.test.mjs, decisions I6-1 to I6-10). Plan 2.2, 4.1 and 4.11 give the tests lane this file,
// tests/fixtures/allow-cases.json, the tests/rc1-cases.mjs registration, the R29 aggregation in tests/run-tests.mjs and the explicit edits of tests/c3.test.mjs
// and tests/c6.test.mjs; those edits live in those files. The implementer must not edit any of them.
//
// Importing this module runs nothing. Every production module and every registry module (rc1-cases.mjs imports this file, so a static import back would be
// circular) is imported lazily inside run(context). A missing module, export or fixture fails one assertion with a diagnostic; it never breaks the import.
//
// Every run(context) returns { failures, skipped: null }. There is no skip path. Scratch data lives under context.tmp only. No classifier corpus row launches a
// process (plan 4.2): rows run in-process; processes are spawned only for command-output, staging and transaction cases.
//
// Where the plan does not pin a value a test would need, the test asserts only what is pinned. The gaps are listed in the delegation report as PLAN-GAP
// lines; the places they touch carry a comment starting with "PLAN-GAP".
import fs from 'node:fs';
import os from 'node:os';
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
const WIN = process.platform === 'win32';
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
const normText = (s) => { let t = Buffer.isBuffer(s) ? s.toString('utf8') : String(s); if (t.charCodeAt(0) === 0xfeff) t = t.slice(1); t = t.replace(/\r\n?/g, '\n'); if (!t.endsWith('\n')) t += '\n'; return t; };
const NH = (s) => sha(Buffer.from(normText(s), 'utf8'));
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
async function importOrFail(failures, url, label) {
  try { return await import(url); } catch (e) { failures.push(`cannot import ${label}: ${errMsg(e)}`); return null; }
}

// ------------------------------------------------------------- scratch ----
// The native (long-name) real path: Git, the setup scripts and the code under test all report that spelling.
function scratchDir(context, label) {
  fs.mkdirSync(context.tmp, { recursive: true });
  return fs.realpathSync.native(fs.mkdtempSync(path.join(context.tmp, `c7-${label}-`)));
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
// The retained diagnostics: a plain file in the kept scratch directory (process counts and the host path spellings that were exercised).
function diag(context, line) { try { fs.mkdirSync(context.tmp, { recursive: true }); fs.appendFileSync(path.join(context.tmp, 'c7-diagnostics.log'), `${line}\n`); } catch { /* best effort */ } }

// ------------------------------------------------------- import safety ----
// Same criteria as C1-C6: no spawn, no filesystem write, no output, no process.exit, no exit code, no environment change.
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
// Process accounting (plan 4.10 gives an estimate, not an assertion): every spawn made by this file is counted and the total is retained in the diagnostics file.
const PROCESS_COUNTS = new Map();
function countProcess(context, n = 1) { PROCESS_COUNTS.set(context.tmp, (PROCESS_COUNTS.get(context.tmp) || 0) + n); }
function flushProcessCount(context, label) { diag(context, `processes after ${label}: ${PROCESS_COUNTS.get(context.tmp) || 0}`); }

// ============================================================ literals ====
// Written out independently of the implementation (plan 4.1: expected descriptors; plan 3.3: the exact diagnostic strings; plan 4.3: S, M and F).
const COMPONENT_INVENTORY = [
  ['R53/C7/classifier', 'shared allows receive exact classes and severities'],
  ['R53/C7/ownership', 'validated exact ownership controls classification'],
  ['R53/C7/discovery', 'discovery reports shared rules and personal settings guidance'],
  ['R54/C7/refusal', 'merge refuses new managed execution permissions'],
  ['R85/C7/inventory', 'every installed managed allow is listed'],
  ['R85/C7/retirement', 'retirement removes only selected managed identities'],
  ['R85/C7/staging', 'allow staging preserves deny and hook projections'],
  ['R85/C7/preservation', 'unselected rules and unchanged bytes survive'],
  ['R85/C7/transaction', 'approved retirement commits content and omissions together'],
  ['R86/C7/reconciliation', 'absent allows reconcile through metadata operations'],
  ['R86/C7/binding-rollback', 'retirement bindings and rollback preserve reviewed state'],
  ['V2/C7/contracts', 'C7 exports errors and component contracts are exact'],
];
const EXPECTED_DESCRIPTORS = COMPONENT_INVENTORY.map(([id, name]) => ({ id, name }));

const CLASSIFY_REL = 'scripts/classify-allows.mjs';
const MERGE_REL = 'scripts/merge-claude-settings.mjs';
const FIXTURE_REL = 'tests/fixtures/allow-cases.json';
const CLASSIFY_EXPORTS = ['classifyAllow', 'inspectAllows'];
const MERGE_EXPORTS = ['mergeManagedDenies', 'mergeManagedHooks', 'retireManagedAllows'];
const REF_CLAUDE = 'references/claude.md';
const REF_STATE = 'references/state-and-apply.md';

// Targets (project-relative) and the production catalog of C6 plan 2.7 (the runtime unit is unchanged by C7, plan 2.3).
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
  [T_HELPER]: 'assets/tools/security-policy.mjs', [T_CORE]: 'assets/tools/git-safe-core.mjs', [T_GUARD_CORE]: 'assets/tools/guard-raw-git-core.mjs', [T_REVIEW]: 'assets/tools/review-diff.mjs',
  [T_ENTRY]: 'assets/tools/git-safe.mjs', [T_GUARD]: 'assets/tools/guard-raw-git.mjs', [T_SELFTEST]: 'assets/tools/hooks-selftest.mjs',
};
const ROLE_OF = { [T_HELPER]: 'helper', [T_CORE]: 'helper', [T_GUARD_CORE]: 'helper', [T_REVIEW]: 'helper', [T_ENTRY]: 'entrypoint', [T_GUARD]: 'entrypoint', [T_SELFTEST]: 'entrypoint' };
const CATALOG_PRODUCTION = { schema: 1, units: UNIT.map((t) => ({ source: SRC_OF[t], target: t, role: ROLE_OF[t], policySchemas: [1, 2] })) };

// Plan 4.3: the canonical data. S, M and F exactly; J is jsonText.
const A = 'Bash(npm test)';
const B = 'Bash(node .ai/tools/git-safe.mjs *)';
const C = 'Bash(git status)';
const U = 'Bash(npm run lint)';
const D = 'Read(**/.env.*)';
const G = 'Bash(*)';
const J = jsonText;
const mkS = (allow = [U, A, C, B]) => ({ permissions: { allow: [...allow], deny: [D], ask: ['Bash(git push *)'] }, env: { FIXTURE_FLAG: 'public-fixture-value' } });
const mkM = (allow = [A, C, B]) => ({ 'permissions.allow': [...allow], 'permissions.deny': [D], heldBack: [] });
const mkF = ({ managed = mkM(), record = {}, schema = 3 } = {}) => ({
  schema, skill: 'project-setup', skillVersion: '2.0.0', mode: 'update', agents: ['claude', 'codex'], sourceCommit: null,
  files: { [T_SETTINGS]: { ownership: 'keys', managed, ...record } },
});

// Plan 3.3: the exact diagnostic strings. Q is JSON.stringify; OWNER is "managed" or "user".
const Q = (rule) => JSON.stringify(rule);
const REPO = (rule, owner) => `Shared ${owner} allow ${Q(rule)} runs repository code without a prompt; move it to .claude/settings.local.json if you accept this risk on your own machine.`;
const BROAD = (rule, owner) => `Shared ${owner} allow ${Q(rule)} permits arbitrary commands without a prompt; move it to .claude/settings.local.json if you accept this risk on your own machine.`;
const LOCAL = '.claude/settings.local.json is personal and is not managed by project-setup; permissions there do not protect the team.';
// Plan 4.3: the expected-value constructors, written here and never calling production exports.
const RM = (r) => ({ rule: r, ownership: 'managed', classification: 'repo-code', level: 'warn', detail: REPO(r, 'managed') });
const RU = (r) => ({ rule: r, ownership: 'user', classification: 'repo-code', level: 'warn', detail: REPO(r, 'user') });
const OM = (r) => ({ rule: r, ownership: 'managed', classification: 'other', level: 'none', detail: null });
const OU = (r) => ({ rule: r, ownership: 'user', classification: 'other', level: 'none', detail: null });
const BM = (r) => ({ rule: r, ownership: 'managed', classification: 'broad', level: 'fail', detail: BROAD(r, 'managed') });
const BU = (r) => ({ rule: r, ownership: 'user', classification: 'broad', level: 'warn', detail: BROAD(r, 'user') });
const I = (r, p, c, l) => ({ rule: r, present: p, classification: c, level: l });
const WR = (d) => ({ level: 'warn', check: 'allow-repo-code', detail: d });
const WB = (d) => ({ level: 'warn', check: 'allow-broad', detail: d });
const FB = (d) => ({ level: 'fail', check: 'allow-broad', detail: d });
const LI = { level: 'info', check: 'allow-local', detail: LOCAL };
// The classification of every corpus row under both ownership values (plan 3.2 table).
function classRow(rule, ownership, cls) {
  if (cls === 'other') return { rule, ownership, classification: 'other', level: 'none', detail: null };
  if (cls === 'repo-code') return { rule, ownership, classification: 'repo-code', level: 'warn', detail: REPO(rule, ownership) };
  return { rule, ownership, classification: 'broad', level: ownership === 'managed' ? 'fail' : 'warn', detail: BROAD(rule, ownership) };
}
// Plan 4.3, 4.5 and 4.7: P0, P1 and the inventory shapes.
const P0 = () => ({
  rules: [RU(U), RM(A), OM(C), RM(B)],
  managed: [I(A, true, 'repo-code', 'warn'), I(C, true, 'other', 'none'), I(B, true, 'repo-code', 'warn')],
  omitted: [],
  results: [WR(REPO(U, 'user')), WR(REPO(A, 'managed')), WR(REPO(B, 'managed')), LI],
});
const P1 = () => ({
  rules: [RU(U), OM(C), RM(B)],
  managed: [I(C, true, 'other', 'none'), I(B, true, 'repo-code', 'warn')],
  omitted: [A],
  results: [WR(REPO(U, 'user')), WR(REPO(B, 'managed')), LI],
});
const D3Report = () => ({
  rules: [RU(U), RU(A), OU(C), RU(B)], managed: [], omitted: [],
  results: [WR(REPO(U, 'user')), WR(REPO(A, 'user')), WR(REPO(B, 'user')), LI],
});
const INV0 = () => [I(A, true, 'repo-code', 'warn'), I(C, true, 'other', 'none'), I(B, true, 'repo-code', 'warn')];
const EMPTY_REPORT = () => ({ rules: [], managed: [], omitted: [], results: [LI] });
const ALLOWS_KEYS = ['rules', 'managed', 'omitted', 'results'];
const RETIRE_KEYS = ['listed', 'retired', 'alreadyAbsent', 'alreadyOmitted', 'retained'];
const RET = (o) => ({ listed: [], retired: [], alreadyAbsent: [], alreadyOmitted: [], retained: [], ...o });
// Plan 4.7: the retirement staging success envelope, in its key order.
const ENV_OK = ({ changed, metadataChanged, draft, allows, retirement }) => ({ ok: true, changed, metadataChanged, needsDecision: false, draft, report: { allows, retirement } });

// Plan 3.10 and C2: approval reasons and refusal texts.
const R_ALLOW = 'draft removes or reorders existing permissions.allow entries';
const R_SETTINGS = 'settings ownership or managed metadata changes';
const R_OMIT = 'approved omission records change';
const R_HOOKS = 'draft changes user settings key "hooks"';
const MSG = {
  PLAN_REJECTED: 'plan rejected',
  DRIFT: 'changes since prepare; nothing was written. Re-run prepare and get approval again.',
  UNRELATED: '--approve-user-content names files that do not need it; refusing broad approvals',
};
const approvalSuffix = (t) => `Show the diff; re-run prepare with --approve-user-content ${t} only after the user approves it`;
const contentApprovalError = (t, reasons) => `${reasons.join('; ')}. ${approvalSuffix(t)}`;
const metaApprovalError = (t) => `metadata changes require --approve-user-content ${t}`;
const NOOP_BODY = { ok: true, committed: false, reason: 'nothing to change (zero diff)' };
const GENERIC_RESERVED_OUT = jsonText({ ok: false, error: 'RUN_ID_RESERVED: run id is reserved for review artifacts' });
// Plan 3.9: the exact error text of every new CLI failure category (the path is appended where the plan names it).
const ST = {
  USAGE: 'usage: merge-claude-settings.mjs --run-id <id> --retire-allow-file <path>',
  JSON: (p) => `invalid allow staging JSON: ${p}`,
  METADATA: (p) => `invalid allow staging metadata: ${p}`,
  MANIFEST: 'invalid allow staging manifest: .ai/manifest.json',
  CONFLICT: (p) => `conflicting allow staging request: ${p}`,
  PATH: (p) => `unsafe allow staging path: ${p}`,
  PROTECTED: (p) => `allow staging input is protected: ${p}`,
  IO: (p) => `cannot read allow staging input: ${p}`,
  WRITE: (p) => `cannot write allow staging output: ${p}`,
  OUTSIDE: 'allow selection file must be inside the project',
  DRAFTVAULT: 'allow selection file must be outside setup draft and vault directories',
};
const ERR_SELECTION = 'ALLOW_SELECTION: retire must contain unique recorded managed allows or allow omissions';
const ERR_SETTINGS = 'ALLOW_SETTINGS: settings permissions.allow must be a string array';
const ERR_CLASSIFY_INPUT = 'ALLOW_INPUT: invalid allow classification input';
const ERR_BROAD = (r) => `refusing managed broad allow ${Q(r)}; move it to .claude/settings.local.json if you accept this risk on your own machine`;
const ERR_REPO = (r) => `refusing managed repository-code allow ${Q(r)}; move it to .claude/settings.local.json if you accept this risk on your own machine`;
const ERR_NEW = (r) => `nonempty --allow-file is not supported in v3: ${Q(r)}`;
const ORDER_ERROR = 'normal merge cannot follow allow retirement staging; start a new run and stage denies and hooks before retiring allows';

// The run ID of the staging, transaction and rollback fixtures (plan 4.7).
const RID = 'run-c7-0001';
const SELECTION_REL = `.ai/.run/${RID}/retire-allows.json`;
const runRel = (id, name) => `.ai/.run/${id}/${name}`;
const draftRel = (id) => `.ai/.run/${id}/drafts/.claude/settings.json`;
// Plan 4.11 and C6 plan 3.7: the managed hook (H) and its settings entry (E); C7 neither changes nor consumes them except through the exemption.
const HOOK_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs"';
const H = { event: 'PreToolUse', matcher: 'Bash|PowerShell', command: HOOK_COMMAND };
const E = { matcher: 'Bash|PowerShell', hooks: [{ type: 'command', command: HOOK_COMMAND }] };

// ====================================================== module loaders ====
async function loadClassify(failures, context) {
  const m = await importOrFail(failures, scriptUrl(context, 'classify-allows.mjs'), CLASSIFY_REL);
  if (!m) return null;
  const missing = CLASSIFY_EXPORTS.filter((n) => typeof m[n] !== 'function');
  if (missing.length) { failures.push(`${CLASSIFY_REL} lacks exports: ${missing.join(', ')}`); return null; }
  return m;
}
async function loadMerge(failures, context) {
  const m = await importOrFail(failures, scriptUrl(context, 'merge-claude-settings.mjs'), MERGE_REL);
  if (!m) return null;
  if (typeof m.retireManagedAllows !== 'function') { failures.push(`${MERGE_REL} lacks the retireManagedAllows export`); return null; }
  return m;
}
// The fixture of plan 4.2: schema 1, three keys per row, the 74 explicit IDs A01-A74 in order.
const CORPUS_IDS = Array.from({ length: 74 }, (_, i) => `A${String(i + 1).padStart(2, '0')}`);
function loadCorpus(check, context) {
  const file = readJson(path.join(context.skillRoot, ...FIXTURE_REL.split('/')));
  if (!file) { check(false, `${FIXTURE_REL} is readable JSON`); return null; }
  check(eq(keysOf(file), ['schema', 'cases']) && file.schema === 1 && Array.isArray(file.cases), 'the fixture has exactly schema 1 and cases', keysOf(file));
  if (!Array.isArray(file.cases)) return null;
  const ids = file.cases.map((c) => c && c.id);
  check(eq(ids, CORPUS_IDS), 'the fixture holds the 74 plan rows A01-A74, in order', { count: ids.length });
  check(file.cases.every((c) => c && eq(keysOf(c), ['id', 'rule', 'classification']) && typeof c.rule === 'string' && ['repo-code', 'broad', 'other'].includes(c.classification)), 'every fixture row is { id, rule, classification } with the pinned domain');
  const count = (k) => file.cases.filter((c) => c && c.classification === k).length;
  check(count('broad') === 9 && count('repo-code') === 45 && count('other') === 20, 'the plan table has 9 broad, 45 repo-code and 20 other rows', { broad: count('broad'), repoCode: count('repo-code'), other: count('other') });
  return file.cases;
}
const clip = (s) => show(String(s).length > 90 ? `${String(s).slice(0, 90)}... (${String(s).length} chars)` : s);
// An expected Error: own string code, an Error instance, the exact message (or a predicate for the messages the plan leaves open).
async function expectErr(check, label, fn, code, message) {
  const r = await attempt(fn);
  if (!r.threw) { check(false, `${label}: expected ${code}, got a result`, r.value); return null; }
  const e = r.error;
  check(e instanceof Error, `${label}: an Error instance`, e && e.constructor && e.constructor.name);
  check(hasOwn(e, 'code') && typeof e.code === 'string' && e.code === code, `${label}: code ${code}`, { code: e && e.code, message: e && e.message });
  if (typeof message === 'function') check(e && typeof e.message === 'string' && message(e.message), `${label}: the message has the pinned shape`, e && e.message);
  else check(e && e.message === message, `${label}: message is exactly ${show(message)}`, e && e.message);
  return e;
}

// ================================================ R53/C7/classifier ====
// Plan 2.4, 3.1-3.4 and 4.2: the pure classifier and inspection, in process. The corpus rows run with both ownership values and the complete return object is
// compared with the plan's literal severity and message formulas (restated above, never read from production).
const OWNERS = ['managed', 'user'];
const CLASS_KEYS = ['rule', 'ownership', 'classification', 'level', 'detail'];
const inspectCall = (mod, input) => mod.inspectAllows(input);
// PLAN-GAP: the plan pins the exact message of classifyAllow's ALLOW_INPUT only; for the object APIs (inspectAllows, retireManagedAllows) it pins the code ALLOW_INPUT
// and not its text, so the tests assert the "ALLOW_INPUT: " prefix.
const allowInputMsg = (m) => typeof m === 'string' && m.startsWith('ALLOW_INPUT: ');
async function classifierGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mod = await loadClassify(failures, context);
    const rows = loadCorpus(check, context);
    if (!mod || !rows) return;
    await step('classify-allows.mjs exports exactly classifyAllow and inspectAllows, both synchronous', async () => {
      check(eq(sorted(Object.keys(mod)), sorted(CLASSIFY_EXPORTS)), `${CLASSIFY_REL} exports exactly ${CLASSIFY_EXPORTS.join(', ')}`, Object.keys(mod));
      const a = mod.classifyAllow('Bash(git status)', 'managed');
      const b = mod.inspectAllows({ settings: {}, managed: {}, omissions: {} });
      check(a && typeof a === 'object' && typeof a.then !== 'function' && b && typeof b === 'object' && typeof b.then !== 'function', 'both functions return plain values, not promises');
    });
    await step('the 74 corpus rows A01-A74, each with both ownership values: the complete return object, in its key order', async () => {
      for (const row of rows) {
        for (const owner of OWNERS) {
          let got;
          try { got = mod.classifyAllow(row.rule, owner); } catch (e) { check(false, `${row.id} ${owner}: classifyAllow threw`, errMsg(e)); continue; }
          const want = classRow(row.rule, owner, row.classification);
          check(eq(got, want) && eq(keysOf(got), CLASS_KEYS), `${row.id} ${owner} ${clip(row.rule)}: ${row.classification} with the exact level and message`, got);
        }
      }
    });
    await step('the severity table: repo-code warns for both owners, broad fails only when managed, other has level none and detail null', async () => {
      const lvl = (rule, owner) => mod.classifyAllow(rule, owner).level;
      check(lvl('Bash(npm test)', 'managed') === 'warn' && lvl('Bash(npm test)', 'user') === 'warn', 'repo-code is warn for managed and user');
      check(lvl('Bash(*)', 'managed') === 'fail' && lvl('Bash(*)', 'user') === 'warn', 'broad is fail for managed and warn for user');
      const o = mod.classifyAllow('Bash(git status)', 'managed');
      check(o.level === 'none' && o.detail === null && o.classification === 'other', 'other is none with a null detail', o);
    });
    await step('invalid classifyAllow arguments throw ALLOW_INPUT with the exact message', async () => {
      const bad = [[7, 'managed'], [null, 'managed'], [undefined, 'managed'], [{}, 'user'], [['Bash(x)'], 'user'], ['Bash(x)', 'Managed'], ['Bash(x)', 'USER'], ['Bash(x)', ''], ['Bash(x)', null], ['Bash(x)', undefined], ['Bash(x)', 'owner'], ['Bash(x)', ' user']];
      for (const args of bad) await expectErr(check, `classifyAllow(${show(args)})`, () => mod.classifyAllow(...args), 'ALLOW_INPUT', ERR_CLASSIFY_INPUT);
      await expectErr(check, 'classifyAllow()', () => mod.classifyAllow(), 'ALLOW_INPUT', ERR_CLASSIFY_INPUT);
    });
    await step('diagnostic escaping: embedded quotes, backslashes and newlines are JSON-escaped and never create a diagnostic line', async () => {
      const q = 'Bash(node -e "require(\'./task\')")';
      for (const owner of OWNERS) {
        const got = mod.classifyAllow(q, owner);
        check(eq(got, classRow(q, owner, 'repo-code')) && got.detail.includes('\\"require(') && !/[\r\n]/.test(got.detail), `${owner}: embedded double quotes are escaped as a backslash and a quote in the one-line message`, got.detail);
      }
      const bs = 'PowerShell(.\\scripts\\check.ps1 *)';
      const got = mod.classifyAllow(bs, 'user');
      check(got.detail === REPO(bs, 'user') && got.detail.includes('.\\\\scripts\\\\check.ps1'), 'backslashes are doubled in the message', got.detail);
      // PLAN-GAP: the plan does not say whether a newline inside a quoted token keeps a rule recognizable as Bash(...). When it is classified as repo-code its message must be the
      // escaped one-line formula; when it is classified as other it has no message. Both outcomes are accepted.
      const rule = 'Bash(npm run "a\nb")';
      for (const owner of OWNERS) {
        const g = mod.classifyAllow(rule, owner);
        if (g.classification === 'repo-code') check(eq(g, classRow(rule, owner, 'repo-code')) && typeof g.detail === 'string' && !/[\r\n]/.test(g.detail) && g.detail.includes('\\n'), `${owner}: a repo-code rule with an embedded newline has the escaped one-line message`, g.detail);
        else check(eq(g, classRow(rule, owner, 'other')), `${owner}: otherwise the rule is other with no message`, g);
      }
      const r = mod.inspectAllows({ settings: { permissions: { allow: [rule, q] } }, managed: {}, omissions: {} });
      check(r.results.every((x) => typeof x.detail === 'string' && !/[\r\n]/.test(x.detail)) && eq(r.results[r.results.length - 1], LI), 'every inspection row is one line and the personal-settings row is last', r.results);
    });
    await step('the returned classification is detached and mutable; the same call twice gives equal values', async () => {
      const a = mod.classifyAllow('Bash(npm test)', 'user');
      check(!Object.isFrozen(a), 'the result is a mutable object');
      a.rule = 'changed'; a.level = 'none';
      const b = mod.classifyAllow('Bash(npm test)', 'user');
      check(eq(b, classRow('Bash(npm test)', 'user', 'repo-code')), 'a later call is unaffected by mutation of an earlier result', b);
    });

    // ----------------------------------------------------- inspectAllows ----
    await step('inspectAllows of S, M and no omissions is exactly P0; the result is detached, mutable and leaves a deeply frozen input untouched', async () => {
      const input = deepFreeze({ settings: mkS(), managed: mkM(), omissions: {} });
      const r = await attempt(() => inspectCall(mod, input));
      check(!r.threw, 'a deeply frozen input is accepted', r.threw ? errMsg(r.error) : null);
      if (r.threw) return;
      check(eq(r.value, P0()) && eq(keysOf(r.value), ALLOWS_KEYS), 'the complete inspection is P0, in its key order', r.value);
      check(!deepFrozen(r.value) && !Object.isFrozen(r.value), 'the result is mutable JSON');
      r.value.rules[0].rule = 'x'; r.value.managed.length = 0; r.value.results.length = 0;
      check(eq(input, { settings: mkS(), managed: mkM(), omissions: {} }), 'mutating the result never reaches the input');
      const again = inspectCall(mod, { settings: mkS(), managed: mkM(), omissions: {} });
      check(eq(again, P0()), 'a second call is not affected by the mutation');
    });
    await step('inventory and rules: every installed managed entry, absent ones included and computed as managed; duplicates and order preserved; no restoring and no inference', async () => {
      const absent = inspectCall(mod, { settings: { permissions: { allow: [U, A, C] } }, managed: mkM(), omissions: {} });
      check(eq(absent.managed, [I(A, true, 'repo-code', 'warn'), I(C, true, 'other', 'none'), I(B, false, 'repo-code', 'warn')]), 'B is listed with present false and its managed classification', absent.managed);
      check(eq(absent.results, [WR(REPO(U, 'user')), WR(REPO(A, 'managed')), LI]), 'an absent entry generates no execution warning', absent.results);
      check(eq(absent.rules, [RU(U), RM(A), OM(C)]), 'rules lists only the occurrences present in the shared array', absent.rules);
      const dup = inspectCall(mod, { settings: { permissions: { allow: [U, A, C, A] } }, managed: { 'permissions.allow': [A, C, B, A] }, omissions: {} });
      check(eq(dup.rules, [RU(U), RM(A), OM(C), RM(A)]), 'a duplicate shared occurrence is two rules, in settings order', dup.rules);
      check(eq(dup.managed, [I(A, true, 'repo-code', 'warn'), I(C, true, 'other', 'none'), I(B, false, 'repo-code', 'warn'), I(A, true, 'repo-code', 'warn')]), 'a duplicate managed record is two inventory rows, in metadata order', dup.managed);
      check(eq(dup.results, [WR(REPO(U, 'user')), WR(REPO(A, 'managed')), WR(REPO(A, 'managed')), LI]), 'one result row per risky shared occurrence, duplicates kept', dup.results);
      const none = inspectCall(mod, { settings: {}, managed: {}, omissions: {} });
      check(eq(none, EMPTY_REPORT()) && eq(keysOf(none), ALLOWS_KEYS), 'no settings, no metadata: empty arrays and only the personal-settings row', none);
      const noAllow = inspectCall(mod, { settings: { permissions: { deny: [D] } }, managed: { 'permissions.deny': [D] }, omissions: {} });
      check(eq(noAllow, EMPTY_REPORT()), 'deny metadata and deny rules are never classified or reported as allows', noAllow);
    });
    await step('results: repo-code and broad rows in settings order, broad managed fails and broad user warns, the personal-settings row is last and never duplicated', async () => {
      const r = inspectCall(mod, { settings: { permissions: { allow: [G, A, U] } }, managed: { 'permissions.allow': [G, A] }, omissions: {} });
      check(eq(r.rules, [BM(G), RM(A), RU(U)]), 'rules: the managed broad rule, the managed repo-code rule, the user repo-code rule', r.rules);
      check(eq(r.managed, [I(G, true, 'broad', 'fail'), I(A, true, 'repo-code', 'warn')]), 'inventory: the broad entry has level fail', r.managed);
      check(eq(r.results, [FB(BROAD(G, 'managed')), WR(REPO(A, 'managed')), WR(REPO(U, 'user')), LI]), 'results keep settings order with the managed broad row failing', r.results);
      const u = inspectCall(mod, { settings: { permissions: { allow: [G] } }, managed: {}, omissions: {} });
      check(eq(u.results, [WB(BROAD(G, 'user')), LI]), 'a user broad rule is a warning', u.results);
      check(r.results.filter((x) => x.check === 'allow-local').length === 1 && eq(r.results[r.results.length - 1], LI), 'exactly one allow-local row, last');
    });
    await step('omissions and overlap: omitted lists the exact installed allow omissions; an identity in both managed and omissions is managed and both records are reported', async () => {
      const om = inspectCall(mod, { settings: mkS([U, C, B]), managed: mkM([C, B]), omissions: { 'permissions.allow': [A] } });
      check(eq(om, P1()), 'the retired state with an allow omission is exactly P1', om);
      const both = inspectCall(mod, { settings: { permissions: { allow: [A] } }, managed: { 'permissions.allow': [A] }, omissions: { 'permissions.allow': [A] } });
      check(eq(both.rules, [RM(A)]) && eq(both.omitted, [A]) && eq(both.managed, [I(A, true, 'repo-code', 'warn')]), 'overlap: the rule is managed, the inventory row and the omission are both reported', both);
      const deny = inspectCall(mod, { settings: {}, managed: {}, omissions: { 'permissions.deny': [{ anchor: 'any', glob: '**/.x' }] } });
      check(eq(deny.omitted, []), 'deny omissions are not allow omissions', deny.omitted);
    });
    await step('identity is exact: no trimming, no case folding and no inference from familiar tool paths', async () => {
      const spaced = 'Bash(npm  test)';
      const trailing = 'Bash(npm test )';
      const r = inspectCall(mod, { settings: { permissions: { allow: [A, spaced] } }, managed: { 'permissions.allow': ['Bash(NPM test)', trailing] }, omissions: {} });
      check(eq(r.rules, [RU(A), RU(spaced)]), 'neither a case change nor different inner or trailing whitespace makes a shared rule managed', r.rules);
      check(eq(r.managed, [I('Bash(NPM test)', false, 'repo-code', 'warn'), I(trailing, false, 'repo-code', 'warn')]), 'neither managed record is present; the original strings are kept unchanged', r.managed);
    });
    await step('validation and precedence of inspectAllows: ALLOW_INPUT, ALLOW_SETTINGS, the C2 reader errors in order', async () => {
      const ok3 = { settings: {}, managed: {}, omissions: {} };
      const plainBad = [null, [], 'x', 7, true, undefined];
      for (const v of plainBad) await expectErr(check, `outer input ${show(v)}`, () => mod.inspectAllows(v), 'ALLOW_INPUT', allowInputMsg);
      await expectErr(check, 'a missing omissions key', () => mod.inspectAllows({ settings: {}, managed: {} }), 'ALLOW_INPUT', allowInputMsg);
      await expectErr(check, 'a missing settings key', () => mod.inspectAllows({ managed: {}, omissions: {} }), 'ALLOW_INPUT', allowInputMsg);
      await expectErr(check, 'an unknown key (retire is not an inspection key)', () => mod.inspectAllows({ ...ok3, retire: [] }), 'ALLOW_INPUT', allowInputMsg);
      await expectErr(check, 'an unknown key (extra)', () => mod.inspectAllows({ ...ok3, extra: 1 }), 'ALLOW_INPUT', allowInputMsg);
      class Box {}
      await expectErr(check, 'a class instance is not a plain object', () => mod.inspectAllows(Object.assign(new Box(), ok3)), 'ALLOW_INPUT', allowInputMsg);
      const np = Object.assign(Object.create(null), clone(ok3));
      const r = await attempt(() => mod.inspectAllows(np));
      check(!r.threw && eq(r.value, EMPTY_REPORT()), 'a null-prototype outer object is plain', r.threw ? errMsg(r.error) : r.value);
      // order 2: the exact settings error, for every malformed shape
      const badSettings = [null, [], 'x', 7, { permissions: null }, { permissions: [] }, { permissions: 'x' }, { permissions: { allow: {} } }, { permissions: { allow: 'x' } }, { permissions: { allow: [1] } }, { permissions: { allow: [null] } }, { permissions: { allow: [A, 7] } }, { permissions: { allow: null } }];
      for (const s of badSettings) await expectErr(check, `settings ${show(s)}`, () => mod.inspectAllows({ ...ok3, settings: s }), 'ALLOW_SETTINGS', ERR_SETTINGS);
      // orders 3 and 4: the C2 readers' own errors (their codes and prefixed messages), never preempted by ALLOW_INPUT
      const managedBad = [[7, 'OWNERSHIP_SHAPE', 'OWNERSHIP_SHAPE: managed'], [[], 'OWNERSHIP_SHAPE', 'OWNERSHIP_SHAPE: managed'], [null, 'OWNERSHIP_SHAPE', 'OWNERSHIP_SHAPE: managed'],
        [{ 'permissions.allow': 'x' }, 'OWNERSHIP_SHAPE', 'OWNERSHIP_SHAPE: managed.permissions.allow'], [{ extra: 1 }, 'OWNERSHIP_FIELD', 'OWNERSHIP_FIELD: managed.extra']];
      for (const [v, code, msg] of managedBad) await expectErr(check, `managed ${show(v)}`, () => mod.inspectAllows({ ...ok3, managed: v }), code, msg);
      const omitBad = [[7, 'OMISSIONS_SHAPE', 'OMISSIONS_SHAPE: omissions'], [[], 'OMISSIONS_SHAPE', 'OMISSIONS_SHAPE: omissions'], [{ 'permissions.allow': 'x' }, 'OMISSIONS_SHAPE', 'OMISSIONS_SHAPE: omissions.permissions.allow'],
        [{ 'permissions.allow': [A, A] }, 'OMISSIONS_DUPLICATE', 'OMISSIONS_DUPLICATE: omissions.permissions.allow[1]']];
      for (const [v, code, msg] of omitBad) await expectErr(check, `omissions ${show(v)}`, () => mod.inspectAllows({ ...ok3, omissions: v }), code, msg);
      // precedence between the orders
      await expectErr(check, 'order 1 beats order 2', () => mod.inspectAllows({ settings: null, managed: {} }), 'ALLOW_INPUT', allowInputMsg);
      await expectErr(check, 'order 2 beats order 3', () => mod.inspectAllows({ settings: null, managed: 7, omissions: 7 }), 'ALLOW_SETTINGS', ERR_SETTINGS);
      await expectErr(check, 'order 3 beats order 4', () => mod.inspectAllows({ settings: {}, managed: 7, omissions: 7 }), 'OWNERSHIP_SHAPE', 'OWNERSHIP_SHAPE: managed');
    });
  });
}

// ============================================ toolkit: repositories and CLIs ====
// Every CLI call is shell-free with the absolute Node executable; a process that ends abnormally fails the calling assertion once.
function execNode(context, { cwd, script, args = [], env = null, preload = null }) {
  const pre = Array.isArray(preload) ? preload : preload ? [preload] : [];
  const argv = [...pre.flatMap((p) => ['--require', p]), script, ...args];
  const r = spawnSync(process.execPath, argv, { cwd, env: env || context.env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 180000, maxBuffer: 16777216 });
  countProcess(context);
  let dead = null;
  if (r.error) dead = `${r.error.code || 'error'}: ${String(r.error.message).slice(0, 120)}`;
  else if (r.signal) dead = `signal ${r.signal}`;
  const stdout = r.stdout || '';
  let json = null;
  try { json = JSON.parse(stdout); } catch { /* not JSON */ }
  return { code: r.status, stdout, stderr: r.stderr || '', json, dead };
}
// Discovery must never see the real user's Claude or Codex homes: HOME and USERPROFILE are already isolated by the context, and the two override variables
// point at directories that do not exist.
const detectEnv = (context) => ({ ...context.env, CLAUDE_CONFIG_DIR: path.join(context.tmp, 'c7-iso', 'claude'), CODEX_HOME: path.join(context.tmp, 'c7-iso', 'codex') });
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
    detect: (root, o = {}) => invoke('detect', scripts('detect'), [], { cwd: root, env: detectEnv(context), ...o }),
    withSkill: (other) => makeKit(context, check, other),
    begin(root, id) {
      const a = kit.lock(root, ['acquire', '--run-id', id]);
      const b = kit.apply(root, ['init', '--run-id', id]);
      check(a.code === 0 && b.code === 0, `begin ${id}: lock acquire and init succeed`, { a: a.stdout.slice(0, 200), b: b.stdout.slice(0, 200) });
      return a.code === 0 && b.code === 0;
    },
    release: (root, id) => kit.lock(root, ['release', '--run-id', id]),
    // Plan 4.8: prepare --run-id <id> --mode update --agents claude,codex, with the approvals appended when given.
    prepare(root, id, o = {}) {
      const args = ['prepare', '--run-id', id, '--mode', o.mode || 'update', '--agents', o.agents || 'claude,codex'];
      if (o.approve && o.approve.length) args.push('--approve-user-content', o.approve.join(','));
      return kit.apply(root, args, o);
    },
    commit: (root, id, planSha, o = {}) => kit.apply(root, ['commit', '--run-id', id, '--approved-plan', planSha], o),
    diff: (root, id, o = {}) => kit.apply(o.cwd || root, ['diff', '--project', o.project !== undefined ? o.project : root, '--run-id', id], o),
    rollback: (root, id, o = {}) => kit.apply(root, ['rollback', '--run-id', id], o),
    hooksOnly: (root, id, o = {}) => kit.merge(root, ['--run-id', id, '--hooks-only'], o),
    report: (root, o = {}) => invoke('migrate report', scripts('migrate-security-paths'), ['report', '--project', root], { cwd: root, ...o }),
    stage: (root, id, o = {}) => invoke('migrate stage', scripts('migrate-security-paths'), ['stage', '--project', root, '--run-id', id], { cwd: root, ...o }),
    // Plan 3.8: the retirement staging command; the selection file is written first when a selection is given.
    retire(root, id, selection, o = {}) {
      const rel = o.rel || runRel(id, 'retire-allows.json');
      if (o.body !== undefined) putFile(path.isAbsolute(rel) ? rel : path.join(root, ...rel.split('/')), o.body);
      else if (selection !== undefined) putFile(path.isAbsolute(rel) ? rel : path.join(root, ...rel.split('/')), jsonText(selection));
      return kit.merge(root, o.args || ['--run-id', id, '--retire-allow-file', o.arg !== undefined ? o.arg : rel], o);
    },
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
const manifestPath = (root) => path.join(root, '.ai', 'manifest.json');
const readManifestFile = (root) => readJson(manifestPath(root));
const projectSnapshot = (root) => snapshotTree(root, ['.git']);
// Everything outside the run directory: the project's files, manifest, lock and policy (a write failure may leave run-local staging partly updated).
const outsideRunSnapshot = (root) => JSON.stringify(walkTree(root, ['.git']).filter(([rel]) => !rel.startsWith('.ai/.run')));
const runSnapshot = (root, id) => new Map(walkTree(runFile(root, id), []).filter(([, kind]) => kind === 'file').map(([rel, , digest]) => [rel, digest]));
const changedRunFiles = (a, b) => [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k)).sort();
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
// A project settings file in the serialization style of plan 4.7: indentation, EOL, BOM and final newline.
function ser(v, { indent = 2, eol = '\n', bom = false, final = true } = {}) {
  let t = JSON.stringify(v, null, indent);
  if (final) t += '\n';
  if (eol === '\r\n') t = t.replace(/\n/g, '\r\n');
  return (bom ? '\ufeff' : '') + t;
}
// The indentation and EOL a settings text uses (the first indented key decides; any CRLF decides the EOL).
function styleOf(text) {
  const t = String(text).replace(/^\ufeff/, '');
  const m = t.match(/\n([ \t]+)"/);
  return { indent: m ? m[1] : 2, eol: /\r\n/.test(t) ? '\r\n' : '\n' };
}
function editSettings(root, mutate) {
  const p = projPath(root, T_SETTINGS);
  const text = readText(p);
  const obj = JSON.parse(text.replace(/^\ufeff/, ''));
  mutate(obj);
  putFile(p, ser(obj, styleOf(text)));
  return readBytes(p);
}
function editManifest(root, mutate) {
  const obj = readManifestFile(root);
  mutate(obj);
  putFile(manifestPath(root), jsonText(obj));
  return readBytes(manifestPath(root));
}
// Plan 4.8: the expected changed settings bytes of a genuine installation: the parsed object with permissions.allow filtered by exact membership in K, written
// with the installed indentation (or two spaces), one final newline, LF converted to the installed EOL, no BOM; every other field and its insertion order identical.
function retiredText(text, K) {
  const style = styleOf(text);
  const P = JSON.parse(String(text).replace(/^\ufeff/, ''));
  P.permissions.allow = P.permissions.allow.filter((r) => !K.includes(r));
  return ser(P, { indent: style.indent, eol: style.eol, bom: false, final: true });
}
// The three request files of plan 4.7 for a retirement of [A] from the canonical S, F and M.
const REQ_BYTES = () => ({
  ownership: J({ [T_SETTINGS]: 'keys' }),
  managed: J({ [T_SETTINGS]: { 'permissions.allow': [C, B] } }),
  omissions: J({ [T_SETTINGS]: { 'permissions.allow': [A] } }),
});
const SEL_A = [A];
// Plan C7-P3-2: the raw TEMP-based spelling of a path under the temporary directory (identical when the host has no distinct short spelling).
function rawSpelling(p) {
  const rawTemp = process.env.TEMP || process.env.TMP || os.tmpdir();
  let longTemp;
  try { longTemp = fs.realpathSync.native(rawTemp); } catch { return p; }
  const lp = WIN ? p.toLowerCase() : p;
  const lt = WIN ? longTemp.toLowerCase() : longTemp;
  if (lp === lt || lp.startsWith(lt + path.sep)) return rawTemp + p.slice(longTemp.length);
  return p;
}
// Plan 3.6: containment by native canonical forms: inside gives the canonical project-relative POSIX path; outside gives the canonical absolute POSIX path.
function canonicalTarget(root, file) {
  const cf = fs.realpathSync.native(file);
  const cr = fs.realpathSync.native(root);
  const rel = path.relative(cr, cf);
  const outside = rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
  return outside ? cf.replace(/\\/g, '/') : rel.replace(/\\/g, '/');
}

// The trusted sources of the seven runtime members, read from the skill (never from the code under test beyond its own shipped files).
function loadTrusted(failures, context) {
  const bytesOf = {};
  const missing = [];
  for (const t of UNIT) {
    const b = readBytes(path.join(context.skillRoot, ...SRC_OF[t].split('/')));
    if (b === null) missing.push(SRC_OF[t]); else bytesOf[t] = b;
  }
  if (missing.length) { failures.push(`cannot read the trusted runtime sources: ${missing.join(', ')}`); return null; }
  return bytesOf;
}
const stageUnit = (root, id, tb) => { for (const t of UNIT) putDraft(root, id, t, tb[t]); };

// ----------------------------------------------- command-output expectations ----
// The C7 CLI failure envelope of plan 3.9: { ok:false, code, error, target }, two-space JSON, final LF, stdout only, empty stderr.
function expectStageErr(check, label, r, { code, exit, error, target }) {
  check(r.dead === null || r.dead === undefined, `${label}: the process ended normally`, r.dead);
  check(r.code === exit, `${label}: exit code ${exit}`, { code: r.code, stdout: r.stdout.slice(0, 300), stderr: r.stderr.slice(0, 200) });
  check(r.stderr === '', `${label}: empty stderr`, r.stderr.slice(0, 200));
  check(r.stdout === jsonText({ ok: false, code, error, target }), `${label}: the exact envelope { ok, code, error, target } (two-space JSON, one final LF)`, r.stdout.slice(0, 400));
}
// The retirement staging success envelope of plan 3.8 and 4.7: exit 0, empty stderr, byte-exact two-space JSON in the pinned key order.
function expectRetireOk(check, label, r, want) {
  check(r.dead === null || r.dead === undefined, `${label}: the process ended normally`, r.dead);
  check(r.code === 0 && r.stderr === '', `${label}: exit 0 with empty stderr`, { code: r.code, stdout: r.stdout.slice(0, 400), stderr: r.stderr.slice(0, 200) });
  check(r.json !== null && r.stdout === jsonText(r.json), `${label}: two-space JSON with one final LF`, r.stdout.slice(0, 200));
  if (!r.json) return false;
  check(eq(keysOf(r.json), ['ok', 'changed', 'metadataChanged', 'needsDecision', 'draft', 'report']) && eq(keysOf(r.json.report), ['allows', 'retirement']) && eq(keysOf(r.json.report.allows), ALLOWS_KEYS) && eq(keysOf(r.json.report.retirement), RETIRE_KEYS), `${label}: the envelope keys are in the pinned order`, { top: keysOf(r.json), report: keysOf(r.json.report) });
  const same = r.stdout === jsonText(want);
  check(same, `${label}: the exact envelope values`, r.json);
  return same;
}
// A prepare rejection with one entry per affected target (C2): exit 3, empty stderr, two-space JSON with one final LF.
function expectP(check, label, r, entries, exit = 3) {
  check(r.code === exit && r.stderr === '' && r.stdout === jsonText({ ok: false, code: 'APPLY_PLAN_REJECTED', error: MSG.PLAN_REJECTED, errors: entries }), `${label}: the exact plan rejection`, { code: r.code, out: r.stdout.slice(0, 600), err: r.stderr.slice(0, 200) });
}
const approvalEntry = (reasons) => [{ target: T_SETTINGS, code: 'APPLY_APPROVAL_REQUIRED', error: contentApprovalError(T_SETTINGS, reasons) }];
const metaEntry = () => [{ target: T_SETTINGS, code: 'APPLY_APPROVAL_REQUIRED', error: metaApprovalError(T_SETTINGS) }];
// The literal metadata operation of plan 4.8 for S, F and a retirement of [A].
const META_OP_A = () => ({
  kind: 'file', target: T_SETTINGS,
  before: { ownership: 'keys', managed: { 'permissions.allow': [A, C, B], 'permissions.deny': [D], heldBack: [] } },
  after: { ownership: 'keys', managed: { 'permissions.allow': [C, B], 'permissions.deny': [D], heldBack: [] }, omissions: { 'permissions.allow': [A] } },
  requiresApproval: true,
  reasons: [R_SETTINGS, R_OMIT],
});

// ------------------------------------------------------ injected failures ----
// Node -r preloads intercepting the default fs methods for exact-path reads and writes (plan 4.10). Nothing patches a production function.
let preloadSeq = 0;
const watchList = (paths) => [...new Set(paths.flatMap((p) => { const abs = path.resolve(p); const out = [WIN ? abs.toLowerCase() : abs]; try { out.push(WIN ? fs.realpathSync.native(abs).toLowerCase() : fs.realpathSync.native(abs)); } catch { /* absent */ } return out; }))];
// A read recorder: every read of the watched paths is logged and allowed.
function readGuard(dir, paths) {
  const log = path.join(dir, `guard-${++preloadSeq}.log`);
  const watch = watchList(paths);
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
// A read breaker: every read of a watched path fails with EIO (an injected input failure).
function readBreaker(dir, paths) {
  const file = path.join(dir, `break-reads-${++preloadSeq}.cjs`);
  fs.writeFileSync(file, [
    "'use strict';", "const fs = require('fs');", "const path = require('path');", `const WATCH = ${JSON.stringify(watchList(paths))};`, "const WIN = process.platform === 'win32';",
    "const hit = (p) => { try { const s = typeof p === 'string' ? p : Buffer.isBuffer(p) ? p.toString() : null; if (s === null) return false; const a = path.resolve(s); return WATCH.includes(WIN ? a.toLowerCase() : a); } catch (e) { return false; } };",
    "const boom = (p) => { const e = new Error('EIO: injected read failure'); e.code = 'EIO'; e.path = String(p); throw e; };",
    "for (const name of ['readFileSync', 'openSync']) { const orig = fs[name]; fs[name] = function (p) { if (hit(p)) boom(p); return orig.apply(this, arguments); }; }",
  ].join('\n') + '\n');
  return file;
}
// C7-P3-1: a persistent, non-retried EIO at the final atomic rename to one destination: the retry loop for EACCES, EPERM and EBUSY never runs.
function renameBreaker(dir, destinations) {
  const file = path.join(dir, `break-rename-${++preloadSeq}.cjs`);
  fs.writeFileSync(file, [
    "'use strict';", "const fs = require('fs');", "const path = require('path');", `const WATCH = ${JSON.stringify(watchList(destinations))};`, "const WIN = process.platform === 'win32';",
    "const hit = (p) => { try { const s = typeof p === 'string' ? p : Buffer.isBuffer(p) ? p.toString() : null; if (s === null) return false; const a = path.resolve(s); return WATCH.includes(WIN ? a.toLowerCase() : a); } catch (e) { return false; } };",
    "const orig = fs.renameSync;",
    "fs.renameSync = function (from, to) { if (hit(to)) { const e = new Error('EIO: injected rename failure'); e.code = 'EIO'; e.syscall = 'rename'; e.path = String(from); e.dest = String(to); throw e; } return orig.apply(this, arguments); };",
  ].join('\n') + '\n');
  return file;
}

// ================================================ synthetic and genuine projects ====
// The synthetic project: S as .claude/settings.json and F as .ai/manifest.json, committed, the lock held and the run RID initialized (clones inherit all three).
const getBase = (context) => cached(context, 'base', async () => {
  const dir = scratchDir(context, 'base');
  const root = path.join(dir, 'root');
  makeRepo(context, root, { 'package.json': '{"name":"fixture-app"}\n', 'src/a.ts': 'export {}\n', [T_SETTINGS]: J(mkS()), [T_MANIFEST]: J(mkF()) });
  const kit = makeKit(context, mkCheck([]));
  if (!kit.begin(root, RID)) throw new Error('cannot begin a run in the synthetic project');
  return { dir, root };
});
async function useBase(failures, context) {
  try { return await getBase(context); } catch (e) { failures.push(`cannot build the synthetic project: ${errMsg(e)}`); return null; }
}
// A genuine v2 installation built by the tagged scripts (C11a) with managed allows [A, C, B], committed. Provenance and the original bytes are retained.
const getV2 = (context) => cached(context, 'v2', async () => {
  const dir = scratchDir(context, 'base-v2');
  const root = path.join(dir, 'root');
  const work = path.join(dir, 'work');
  makeRepo(context, root, { 'package.json': '{"name":"fixture-app"}\n', 'src/a.ts': 'export {}\n' });
  const h = await import(new URL('./helpers/v2-baseline.mjs', import.meta.url).href);
  const built = await h.createV2InstalledFixture({ repository: context.repository, root, workDir: work, projectName: 'fixture-wallet-api', managedAllows: [A, C, B] });
  commitAll(context, root, 'v2 installed');
  return { dir, root, work, provenance: built.provenance, settingsBytes: readBytes(projPath(root, T_SETTINGS)), manifestBytes: readBytes(manifestPath(root)) };
});
async function useV2(failures, context) {
  try { return await getV2(context); } catch (e) { failures.push(`cannot build the genuine v2 installation: ${errMsg(e)}`); return null; }
}
// Plan 4.8: V3-base is a prior successful apply run on a clone of the genuine v2 installation: an empty run, prepare with --mode update --agents claude,codex and
// no path approval, commit of its schema-only conversion with the returned plan hash, lock release, settings bytes unchanged and manifest schema 3.
const getV3 = (context) => cached(context, 'v3base', async () => {
  const fails = [];
  const check = mkCheck(fails);
  const v2 = await getV2(context);
  const dir = scratchDir(context, 'base-v3');
  const root = cloneTree(v2.root, path.join(dir, 'root'));
  const kit = makeKit(context, check);
  const id = 'run-c7-base';
  const began = kit.begin(root, id);
  const p = began ? kit.prepare(root, id) : null;
  check(p && p.code === 0 && p.json && p.json.ok === true, 'V3-base: prepare of the schema-only conversion needs no approval', p && p.stdout.slice(0, 400));
  const c = p && p.json && p.json.planSha256 ? kit.commit(root, id, p.json.planSha256) : null;
  check(c && c.code === 0 && c.json && c.json.committed === true, 'V3-base: the conversion commits', c && c.stdout.slice(0, 400));
  const rel = kit.release(root, id);
  check(rel.code === 0, 'V3-base: the lock is released', rel.stdout.slice(0, 200));
  check(sameBytes(readBytes(projPath(root, T_SETTINGS)), v2.settingsBytes), 'V3-base: the settings bytes are unchanged');
  const man = readManifestFile(root);
  check(man && man.schema === 3, 'V3-base: the manifest is schema 3', man && man.schema);
  return { dir, root, v2, fails, settingsBytes: readBytes(projPath(root, T_SETTINGS)), manifestBytes: readBytes(manifestPath(root)) };
});
async function useV3(failures, context) {
  try {
    const v3 = await getV3(context);
    for (const f of v3.fails) failures.push(`scenario build: ${f}`);
    return v3.fails.length ? null : v3;
  } catch (e) { failures.push(`cannot build V3-base: ${errMsg(e)}`); return null; }
}

// ============================================ discovery fixtures and checks ====
// Plan 3.5 and 4.4: discovery appends allows last in claude and appends the allow warn and fail details to the top-level warnings.
const CLAUDE_KEYS = ['settingsJson', 'settingsLocalJson', 'agents', 'skills', 'rulesDir', 'claudeignore', 'userInstructionFilesMode', 'allows'];
const FAILED = (error) => ({ rules: null, managed: null, omitted: null, results: [{ level: 'fail', check: 'allow-input', detail: error }, LI] });
const E_MANIFEST = 'invalid .ai/manifest.json; allow ownership was not classified';
const E_JSON = 'invalid .claude/settings.json; shared allows were not classified';
const E_UNSAFE = 'unsafe .claude/settings.json; shared allows were not classified';
const E_PROTECTED = '.claude/settings.json is protected; shared allows were not classified';
const E_READ = 'cannot read .claude/settings.json; shared allows were not classified';
const W_MANIFEST = 'invalid .ai/manifest.json; repair or restore it before setup';
// The allow warnings (level warn or fail) of a pinned report, in result order; the personal-settings row is never a warning.
const warningsOf = (report) => report.results.filter((x) => x.level === 'warn' || x.level === 'fail').map((x) => x.detail);
const BASE_FILES = { 'package.json': '{"name":"fixture-app"}\n', 'src/a.ts': 'export {}\n' };
// A committed synthetic repository for a discovery case: settings and manifest values are objects (serialized with J) or raw strings; null or undefined omits the file.
function detectFx(context, dir, label, o = {}) {
  const files = { ...BASE_FILES };
  const put = (rel, v) => { if (v !== undefined && v !== null) files[rel] = typeof v === 'string' ? v : J(v); };
  put(T_SETTINGS, o.settings);
  put(T_MANIFEST, o.manifest);
  put('.claude/settings.local.json', o.local);
  put(T_POLICY, o.policy);
  return makeRepo(context, path.join(dir, label), files);
}
// One discovery run: exit 0, empty stderr, two-space JSON, the claude keys with allows last, the exact allows report, and the allow warnings at the end of warnings
// (or the complete warnings array when `warnings` is given).
function expectDetect(check, label, r, { allows, warnings = null, tail = null }) {
  check(r.dead === null, `${label}: the process ended normally`, r.dead);
  check(r.code === 0 && r.stderr === '' && r.json && r.json.ok === true, `${label}: discovery exits 0 with empty stderr`, { code: r.code, err: r.stderr.slice(0, 200), out: r.stdout.slice(0, 200) });
  check(r.json !== null && r.stdout === jsonText(r.json), `${label}: two-space JSON with one final LF`, r.stdout.slice(0, 120));
  if (!r.json || !r.json.claude) return;
  check(eq(keysOf(r.json.claude), CLAUDE_KEYS), `${label}: allows is the last claude key, after userInstructionFilesMode`, keysOf(r.json.claude));
  check(eq(r.json.claude.allows, allows) && eq(keysOf(r.json.claude.allows), ALLOWS_KEYS), `${label}: claude.allows is exactly the pinned report`, r.json.claude.allows);
  const w = r.json.warnings;
  if (warnings !== null) check(eq(w, warnings), `${label}: the complete top-level warnings array is exactly the pinned one`, w);
  if (tail !== null) check(Array.isArray(w) && eq(w.slice(w.length - tail.length), tail), `${label}: the allow warnings come last, in result order`, w);
  check(Array.isArray(w) && !w.includes(LOCAL), `${label}: the personal-settings row is never a warning`);
}

// ================================================= R53/C7/ownership ====
// Plan 3.1 and 4.4: exact string identity of validated installed metadata decides ownership. Cases 1 and 5 also run in process; every case runs through discovery.
async function ownershipGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mod = await loadClassify(failures, context);
    if (!mod) return;
    const kit = makeKit(context, check);
    await step('pure: case 1 (uppercase managed rule does not own the lowercase shared rule) and case 5 (deny metadata) in process', async () => {
      const upper = 'Bash(NPM test)';
      const r = mod.inspectAllows({ settings: { permissions: { allow: [A] } }, managed: { 'permissions.allow': [upper] }, omissions: {} });
      check(eq(r, { rules: [RU(A)], managed: [I(upper, false, 'repo-code', 'warn')], omitted: [], results: [WR(REPO(A, 'user')), LI] }), 'case 1: rules [RU(A)], the uppercase rule listed absent as repo-code warn, results [WR, LI], omitted []', r);
      const d = mod.inspectAllows({ settings: { permissions: { deny: [G, A] } }, managed: { 'permissions.deny': [G, A] }, omissions: {} });
      check(eq(d, EMPTY_REPORT()), 'case 5: no allow warning, failure or deny reclassification', d);
    });
    await withScratch(context, 'own', async (dir) => {
      const own = (label, o) => detectFx(context, dir, label, o);
      await step('case 1 through discovery: the shared lowercase rule stays user-owned and the uppercase managed record is listed absent', async () => {
        const upper = 'Bash(NPM test)';
        const root = own('c1', { settings: { permissions: { allow: [A] } }, manifest: mkF({ managed: { 'permissions.allow': [upper] } }) });
        const allows = { rules: [RU(A)], managed: [I(upper, false, 'repo-code', 'warn')], omitted: [], results: [WR(REPO(A, 'user')), LI] };
        expectDetect(check, 'case 1', kit.detect(root), { allows, tail: [REPO(A, 'user')] });
      });
      await step('case 2: a schema-2 manifest of S and M classifies exactly as P0 and discovery still reports needs update', async () => {
        const root = own('c2', { settings: mkS(), manifest: mkF({ schema: 2 }) });
        const r = kit.detect(root);
        expectDetect(check, 'case 2', r, { allows: P0(), tail: warningsOf(P0()) });
        const man = r.json && r.json.ai && r.json.ai.manifest;
        check(man && man.status === 'needs update' && man.needsUpdate === true && man.schema === 2, 'the existing manifest discovery reports needs update', man);
      });
      await step('case 3: a settings record that is not keys ownership supplies no ownership: everything is user-owned (D3Report)', async () => {
        const manifest = mkF();
        manifest.files[T_SETTINGS] = { ownership: 'merged' };
        const root = own('c3', { settings: mkS(), manifest });
        expectDetect(check, 'case 3', kit.detect(root), { allows: D3Report(), tail: warningsOf(D3Report()) });
      });
      await step('case 4: malformed manifest bytes: the exact failure report and, in the clean fixture, exactly the two warnings', async () => {
        const root = own('c4', { settings: mkS(), manifest: '{\n' });
        expectDetect(check, 'case 4', kit.detect(root), { allows: FAILED(E_MANIFEST), warnings: [W_MANIFEST, E_MANIFEST] });
      });
      await step('case 5: deny-only settings and deny-only metadata with empty omissions report no allow row', async () => {
        const root = own('c5', { settings: { permissions: { deny: [G, A] } }, manifest: mkF({ managed: { 'permissions.deny': [G, A] }, record: { omissions: {} } }) });
        expectDetect(check, 'case 5', kit.detect(root), { allows: EMPTY_REPORT(), tail: [] });
      });
      await step('case 6: an allow omission is reported in omitted and does not change ownership or the warnings', async () => {
        const root = own('c6', { settings: mkS(), manifest: mkF({ record: { omissions: { 'permissions.allow': [A] } } }) });
        const allows = { rules: [RU(U), RM(A), OM(C), RM(B)], managed: INV0(), omitted: [A], results: [WR(REPO(U, 'user')), WR(REPO(A, 'managed')), WR(REPO(B, 'managed')), LI] };
        expectDetect(check, 'case 6', kit.detect(root), { allows, tail: [REPO(U, 'user'), REPO(A, 'managed'), REPO(B, 'managed')] });
      });
    });
    flushProcessCount(context, 'R53/C7/ownership');
  });
}

// ================================================ R53/C7/discovery ====
async function discoveryGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const kit = makeKit(context, check);
    await withScratch(context, 'disc', async (dir) => {
      const fx = (label, o) => detectFx(context, dir, label, o);
      await step('D1: S and M with B absent and a user broad rule; personal permissions never appear; the complete warnings array is exact', async () => {
        const sentinel = 'Bash(npm run LOCAL_ONLY_SENTINEL)';
        const root = fx('d1', { settings: mkS([U, A, C, G]), manifest: mkF(), local: { permissions: { allow: [sentinel, 'Read(**)'] } } });
        const allows = {
          rules: [RU(U), RM(A), OM(C), BU(G)],
          managed: [I(A, true, 'repo-code', 'warn'), I(C, true, 'other', 'none'), I(B, false, 'repo-code', 'warn')],
          omitted: [],
          results: [WR(REPO(U, 'user')), WR(REPO(A, 'managed')), WB(BROAD(G, 'user')), LI],
        };
        const watch = readGuard(dir, [projPath(root, T_SETTINGS)]);
        const r = kit.detect(root, { preload: watch.file });
        expectDetect(check, 'D1', r, { allows, warnings: [REPO(U, 'user'), REPO(A, 'managed'), BROAD(G, 'user')] });
        check(!String(JSON.stringify(r.json && r.json.claude && r.json.claude.allows)).includes('LOCAL_ONLY_SENTINEL') && !(r.stdout || '').includes('LOCAL_ONLY_SENTINEL'), 'the personal-settings permissions are neither classified nor printed');
        check(r.json && r.json.claude && r.json.claude.settingsLocalJson === true, 'the personal settings file exists and the existing inventory still reports it');
        check(watch.hits().length > 0, 'control: the read recorder observes the shared settings read (so the later zero-read assertions are meaningful)', watch.hits().length);
      });
      await step('D2: a managed broad rule is a fail row and an appended warning, and discovery still exits 0', async () => {
        const root = fx('d2', { settings: { permissions: { allow: [G] } }, manifest: mkF({ managed: { 'permissions.allow': [G] } }) });
        const allows = { rules: [BM(G)], managed: [I(G, true, 'broad', 'fail')], omitted: [], results: [FB(BROAD(G, 'managed')), LI] };
        expectDetect(check, 'D2', kit.detect(root), { allows, warnings: [BROAD(G, 'managed')] });
      });
      await step('D3: no manifest: every shared rule is user-owned', async () => {
        const root = fx('d3', { settings: mkS() });
        expectDetect(check, 'D3', kit.detect(root), { allows: D3Report(), warnings: [REPO(U, 'user'), REPO(A, 'user'), REPO(B, 'user')] });
      });
      await step('D4: a manifest and no settings file: the inventory lists every entry absent, no allow warning, only the personal-settings row', async () => {
        const root = fx('d4', { manifest: mkF() });
        const allows = { rules: [], managed: [I(A, false, 'repo-code', 'warn'), I(C, false, 'other', 'none'), I(B, false, 'repo-code', 'warn')], omitted: [], results: [LI] };
        expectDetect(check, 'D4', kit.detect(root), { allows, warnings: [] });
      });
      await step('existing skillOverrides discovery continues independently of the allow report', async () => {
        const root = fx('ovr', { settings: { permissions: { allow: [U] }, skillOverrides: { k1: 'bogus' } }, local: { skillOverrides: { k2: 'bogus2' }, permissions: { allow: ['Bash(npm run LOCAL_ONLY_SENTINEL)'] } } });
        const r = kit.detect(root);
        expectDetect(check, 'skillOverrides fixture', r, { allows: { rules: [RU(U)], managed: [], omitted: [], results: [WR(REPO(U, 'user')), LI] }, tail: [REPO(U, 'user')] });
        check(r.json && eq(r.json.invalidOverrides, [{ layer: 'shared project', key: 'k1', value: 'bogus' }, { layer: 'project-local', key: 'k2', value: 'bogus2' }]), 'both layers are still scanned for invalid skillOverrides values', r.json && r.json.invalidOverrides);
        check(r.json && Array.isArray(r.json.warnings) && r.json.warnings.length === 3 && /^skillOverrides "k1" in shared project settings/.test(r.json.warnings[0]) && /^skillOverrides "k2" in project-local settings/.test(r.json.warnings[1]), 'the two skillOverrides warnings precede the allow warning', r.json && r.json.warnings);
      });

      // ------------------------------------------------ the failure reports ----
      const protect = (glob) => jsonText({ schema: 2, patterns: [{ anchor: 'any', glob: '**/.env*' }], projectPatterns: [{ anchor: 'root', glob }] });
      await step('invalid settings JSON: the exact failure report and, in the clean fixture, exactly that one warning', async () => {
        const root = fx('badjson', { settings: '{', manifest: mkF() });
        expectDetect(check, 'invalid settings JSON', kit.detect(root), { allows: FAILED(E_JSON), warnings: [E_JSON] });
      });
      await step('malformed policy: every path is protected, so the protected-settings row is reported and shared settings are never read, present or absent', async () => {
        for (const withSettings of [true, false]) {
          const root = fx(`badpolicy-${withSettings}`, { settings: withSettings ? mkS() : undefined, policy: '{' });
          const watch = readGuard(dir, [projPath(root, T_SETTINGS)]);
          const r = kit.detect(root, { preload: watch.file });
          expectDetect(check, `malformed policy, settings ${withSettings ? 'present' : 'absent'}`, r, { allows: FAILED(E_PROTECTED), tail: [E_PROTECTED] });
          check(watch.hits().length === 0, `malformed policy, settings ${withSettings ? 'present' : 'absent'}: the shared settings were never read, override discovery included`, watch.hits().slice(0, 3));
        }
      });
      await step('protected settings (a project policy pattern): the protected row and no read of the file', async () => {
        const root = fx('protected', { settings: mkS(), policy: protect(T_SETTINGS) });
        const watch = readGuard(dir, [projPath(root, T_SETTINGS)]);
        const r = kit.detect(root, { preload: watch.file });
        expectDetect(check, 'protected settings', r, { allows: FAILED(E_PROTECTED), tail: [E_PROTECTED] });
        check(watch.hits().length === 0, 'protected settings: the file was never read, override discovery included', watch.hits().slice(0, 3));
      });
      await step('unsafe shared settings (a junctioned .claude directory): the unsafe row and no read through the link', async () => {
        const root = fx('junction', { settings: mkS() });
        const ext = path.join(dir, 'ext-junction');
        putFile(path.join(ext, 'settings.json'), J(mkS()));
        fs.rmSync(projPath(root, '.claude'), { recursive: true, force: true });
        if (!linkDir(ext, projPath(root, '.claude'))) { check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'}`); return; }
        const watch = readGuard(dir, [projPath(root, T_SETTINGS), path.join(ext, 'settings.json')]);
        const r = kit.detect(root, { preload: watch.file });
        expectDetect(check, 'junctioned .claude', r, { allows: FAILED(E_UNSAFE), tail: [E_UNSAFE] });
        check(watch.hits().length === 0, 'junctioned .claude: nothing was read through the link, override discovery included', watch.hits().slice(0, 3));
      });
      await step('other read failures: the cannot-read row', async () => {
        // PLAN-GAP: the plan names no way to provoke a read failure; an injected EIO on fs.readFileSync and fs.openSync of the settings path (a -r preload) is used.
        const root = fx('ioerr', { settings: mkS(), manifest: mkF() });
        const brk = readBreaker(dir, [projPath(root, T_SETTINGS)]);
        expectDetect(check, 'unreadable settings', kit.detect(root, { preload: brk }), { allows: FAILED(E_READ), tail: [E_READ] });
      });
      await step('invalid-manifest precedence: an invalid manifest wins over protected settings', async () => {
        const root = fx('precedence', { settings: mkS(), manifest: '{\n', policy: protect(T_SETTINGS) });
        expectDetect(check, 'invalid manifest with protected settings', kit.detect(root), { allows: FAILED(E_MANIFEST), tail: [E_MANIFEST] });
      });
    });
    flushProcessCount(context, 'R53/C7/discovery');
  });
}

// ================================================== R54/C7/refusal ====
// Plan 3.6 and 4.6 (with C7-PQ1 = A): every nonempty --allow-file is refused with the exact envelope, before any draft or request is written; the normal report gains
// allows last; a pending allow retirement stops the normal merge.
const REPORT_KEYS = ['added', 'alreadyPresent', 'conflicts', 'ineffective', 'malformedHooks', 'info', 'heldBack', 'alreadyCovered', 'retainedManagedDenies', 'ownershipDropped', 'hooks', 'allows'];
async function refusalGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const base = await useBase(failures, context);
    if (!base) return;
    const kit = makeKit(context, check);
    await withScratch(context, 'refuse', async (dir) => {
      let n = 0;
      const fresh = (label) => cloneTree(base.root, path.join(dir, `${label}-${++n}`));
      const allowAt = (file, rules) => { putFile(file, typeof rules === 'string' ? rules : jsonText(rules)); return file; };
      const stagedKeys = (root) => readJson(runFile(root, RID, 'managed-keys.json'));

      await step('the four plan rows and more: broad wins over repository-code, which wins over other; the first occurrence of the winning category is named; the exact envelope, exit 3, nothing written', async () => {
        const root = fresh('rows');
        const file = path.join(root, 'allow-in.json');
        const rows = [
          [[G], 'ALLOW_BROAD', ERR_BROAD(G)],
          [['Bash(node .ai/tools/*)'], 'ALLOW_REPO_CODE', ERR_REPO('Bash(node .ai/tools/*)')],
          [[C], 'ALLOW_NEW', ERR_NEW(C)],
          [['Bash(node x.mjs)', G], 'ALLOW_BROAD', ERR_BROAD(G)],
          [['Bash(git log)'], 'ALLOW_NEW', ERR_NEW('Bash(git log)')],
          [[G, 'PowerShell(*)'], 'ALLOW_BROAD', ERR_BROAD(G)],
          [['Bash(git log)', 'Bash(node a.mjs)', 'Bash(node b.mjs)'], 'ALLOW_REPO_CODE', ERR_REPO('Bash(node a.mjs)')],
          [['Read(**)', 'Bash(git log)'], 'ALLOW_NEW', ERR_NEW('Read(**)')],
          [['PowerShell(pwsh -Command *)'], 'ALLOW_REPO_CODE', ERR_REPO('PowerShell(pwsh -Command *)')],
          [[U], 'ALLOW_REPO_CODE', ERR_REPO(U)],
        ];
        for (const [rules, code, error] of rows) {
          allowAt(file, rules);
          const snap = projectSnapshot(root);
          expectStageErr(check, `${show(rules)} -> ${code}`, kit.merge(root, ['--run-id', RID, '--allow-file', file]), { code, exit: 3, error, target: 'allow-in.json' });
          check(projectSnapshot(root) === snap, `${show(rules)}: no draft, request or project file changed`);
        }
        check(!exists(draftPath(root, RID, T_SETTINGS)) && !exists(runFile(root, RID, 'managed-keys.json')) && !exists(runFile(root, RID, 'ownership.json')), 'no draft and no request file exist after every refusal');
        // C is installed as managed in this project, and the row [C] shows that the wording does not call the rule new; Bash(git log) is not recorded and gets the same wording.
        check(ERR_NEW(C) === 'nonempty --allow-file is not supported in v3: "Bash(git status)"', 'the pinned ALLOW_NEW wording names an installed managed rule without calling it new');
      });
      await step('the reported target is the canonical spelling: inside gives the canonical project-relative POSIX path, outside the canonical absolute POSIX path, whatever spelling or cwd is used', async () => {
        const root = fresh('targets');
        fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
        const inside = allowAt(path.join(root, 'allow-in.json'), [C]);
        const outside = allowAt(path.join(dir, 'outside', 'allow-out.json'), [C]);
        // C7-P3-3: the outside file lives under context.tmp, outside the project; its expected target is computed after the file exists.
        const outsideTarget = fs.realpathSync.native(outside).replace(/\\/g, '/');
        check(canonicalTarget(root, outside) === outsideTarget && canonicalTarget(root, inside) === 'allow-in.json', 'the expected targets follow the plan containment definition', { outside: outsideTarget, inside: canonicalTarget(root, inside) });
        const rawIn = rawSpelling(inside);
        const rawOut = rawSpelling(outside);
        diag(context, `refusal spellings: inside ${rawIn === inside ? 'identical' : 'distinct'}, outside ${rawOut === outside ? 'identical' : 'distinct'}`);
        const cases = [
          ['inside, canonical spelling, cwd root', inside, root, 'allow-in.json'],
          ['inside, raw TEMP spelling, cwd root', rawIn, root, 'allow-in.json'],
          ['inside, relative from a subdirectory', path.relative(path.join(root, 'sub'), inside), path.join(root, 'sub'), 'allow-in.json'],
          ['outside, canonical spelling', outside, root, outsideTarget],
          ['outside, raw TEMP spelling', rawOut, root, outsideTarget],
          ['outside, relative from a subdirectory', path.relative(path.join(root, 'sub'), outside), path.join(root, 'sub'), outsideTarget],
        ];
        for (const [label, arg, cwd, target] of cases) {
          const snap = projectSnapshot(root);
          expectStageErr(check, label, kit.merge(cwd, ['--run-id', RID, '--allow-file', arg]), { code: 'ALLOW_NEW', exit: 3, error: ERR_NEW(C), target });
          check(projectSnapshot(root) === snap, `${label}: nothing written`);
        }
      });
      await step('legacy parse and type failures keep their envelopes: invalid JSON is exit 3, a non-array or non-string element is exit 1, both without a code field', async () => {
        const root = fresh('legacy');
        const file = path.join(root, 'allow-in.json');
        const snap = projectSnapshot(root);
        allowAt(file, '{');
        const a = kit.merge(root, ['--run-id', RID, '--allow-file', file]);
        check(a.code === 3 && a.stderr === '' && a.stdout === jsonText({ ok: false, error: '--allow-file is not valid JSON (content not shown)' }), 'invalid JSON: exit 3 and the exact legacy envelope', { code: a.code, out: a.stdout.slice(0, 200) });
        for (const body of ['{"a":1}', '[1]', '["Bash(x)", null]', '"Bash(x)"']) {
          allowAt(file, body);
          const b = kit.merge(root, ['--run-id', RID, '--allow-file', file]);
          check(b.code === 1 && b.stderr === '' && b.stdout === jsonText({ ok: false, error: '--allow-file must contain a JSON array of rule strings' }), `${body}: exit 1 and the exact legacy envelope`, { code: b.code, out: b.stdout.slice(0, 200) });
        }
        check(!exists(draftPath(root, RID, T_SETTINGS)) && !exists(runFile(root, RID, 'managed-keys.json')) && !exists(runFile(root, RID, 'ownership.json')), 'no draft and no request after the failures');
        void snap;
      });
      await step('no allow file and an empty allow file both succeed without requesting a new allow field; an already staged allow field survives either invocation', async () => {
        const requested = (root) => { const k = stagedKeys(root); return k !== null && hasOwn(k, T_SETTINGS) && hasOwn(k[T_SETTINGS], 'permissions.allow'); };
        const noStage = fresh('empty-clean');
        const a = kit.merge(noStage, ['--run-id', RID]);
        check(a.code === 0 && a.json && a.json.ok === true && a.stderr === '', 'no allow file: the merge succeeds', { code: a.code, out: a.stdout.slice(0, 300) });
        check(stagedKeys(noStage) !== null && !requested(noStage), 'no allow file: managed-keys.json exists and requests no permissions.allow', stagedKeys(noStage));
        const noStage2 = fresh('empty-clean');
        const b = kit.merge(noStage2, ['--run-id', RID, '--allow-file', allowAt(path.join(noStage2, 'allow-in.json'), [])]);
        check(b.code === 0 && b.json && b.json.ok === true && b.stderr === '', 'an empty allow file: the merge succeeds', { code: b.code, out: b.stdout.slice(0, 300) });
        check(stagedKeys(noStage2) !== null && !requested(noStage2), 'an empty allow file: managed-keys.json requests no permissions.allow (not [])', stagedKeys(noStage2));
        for (const [label, args] of [['no allow file', () => ['--run-id', RID]], ['an empty allow file', (r) => ['--run-id', RID, '--allow-file', allowAt(path.join(r, 'allow-in.json'), [])]]]) {
          const root = fresh('empty-staged');
          putRequest(root, RID, 'managed-keys.json', { [T_SETTINGS]: { 'permissions.allow': [U] } });
          const r = kit.merge(root, args(root));
          check(r.code === 0 && r.json && r.json.ok === true, `${label}: the merge succeeds with a staged allow field`, { code: r.code, out: r.stdout.slice(0, 300) });
          const keys = stagedKeys(root);
          check(keys && eq(keys[T_SETTINGS]['permissions.allow'], [U]), `${label}: the staged managed allow field [U] survives`, keys && keys[T_SETTINGS]);
        }
      });
      await step('the normal report: allows is the last key; it classifies the resulting settings with the installed metadata and ignores staged requests; added.allow is [] and alreadyPresent holds deny results only', async () => {
        const root = fresh('report');
        putRequest(root, RID, 'managed-keys.json', { [T_SETTINGS]: { 'permissions.allow': [U] } });
        const r = kit.merge(root, ['--run-id', RID]);
        check(r.code === 0 && r.stderr === '' && r.json && r.json.ok === true && r.stdout === jsonText(r.json), 'the normal merge succeeds with two-space JSON', { code: r.code, out: r.stdout.slice(0, 300), err: r.stderr.slice(0, 200) });
        const rep = r.json && r.json.report;
        if (!rep) return;
        check(eq(keysOf(rep), REPORT_KEYS), 'the report keys are the legacy keys, then hooks, then allows last', keysOf(rep));
        check(eq(rep.allows, P0()) && eq(keysOf(rep.allows), ALLOWS_KEYS), 'report.allows is exactly P0', rep.allows);
        check(eq(rep.added.allow, []) && eq(keysOf(rep.added), ['deny', 'allow']), 'report.added.allow is [] and the legacy added object keeps its keys', rep.added);
        check(Array.isArray(rep.alreadyPresent) && rep.alreadyPresent.every((x) => ![U, A, C, B].includes(x)), 'alreadyPresent holds deny results only: no allow rule is listed', rep.alreadyPresent);
        const keys = stagedKeys(root);
        check(keys && eq(keys[T_SETTINGS]['permissions.allow'], [U]), 'the staged allow field is untouched by the report', keys && keys[T_SETTINGS]);
        const draft = readJson(draftPath(root, RID, T_SETTINGS));
        check(draft && eq(draft.permissions.allow, [U, A, C, B]), 'the draft keeps every allow rule in its place', draft && draft.permissions);
        // The same formula without a manifest: everything is user-owned (D3Report).
        const noMan = fresh('report-noman');
        fs.rmSync(manifestPath(noMan), { force: true });
        const r2 = kit.merge(noMan, ['--run-id', RID]);
        check(r2.code === 0 && r2.json && r2.json.ok === true && eq(r2.json.report && r2.json.report.allows, D3Report()), 'without a manifest the normal report is D3Report', r2.json && r2.json.report && r2.json.report.allows);
      });
      await step('malformed allow arrays and an invalid manifest keep the legacy failures, before any write', async () => {
        const cases = [
          ['a non-string allow array', (r) => putFile(projPath(r, T_SETTINGS), J({ permissions: { allow: [1] } })), 'DENY_SETTINGS: settings permissions must contain string arrays'],
          ['an allow value that is not an array', (r) => putFile(projPath(r, T_SETTINGS), J({ permissions: { allow: 'x' } })), 'DENY_SETTINGS: settings permissions must contain string arrays'],
          ['an invalid installed manifest', (r) => putFile(manifestPath(r), '{"schema":3}\n'), 'MANIFEST_INVALID: invalid manifest'],
        ];
        for (const [label, setup, error] of cases) {
          const root = fresh('legacy-fail');
          setup(root);
          const snap = projectSnapshot(root);
          const r = kit.merge(root, ['--run-id', RID]);
          check(r.code === 3 && r.stderr === '' && r.stdout === jsonText({ ok: false, error }), `${label}: exit 3 and the exact legacy { ok, error } envelope`, { code: r.code, out: r.stdout.slice(0, 300) });
          check(projectSnapshot(root) === snap, `${label}: nothing was written`);
        }
      });
      await step('the normal-merge order guard: a pending allow retirement stops the normal merge with the exact envelope; nothing changes; an empty staged allow omission request does too; a deny-only omission request does not', async () => {
        const target = runRel(RID, 'omissions.json');
        const guard = { code: 'ALLOW_STAGE_ORDER', exit: 3, error: ORDER_ERROR, target };
        const a = fresh('order');
        const st = kit.retire(a, RID, SEL_A);
        check(st.code === 0 && st.json && st.json.ok === true, 'control: the retirement of [A] stages', { code: st.code, out: st.stdout.slice(0, 300) });
        const snap = projectSnapshot(a);
        expectStageErr(check, 'normal merge after staging [A]', kit.merge(a, ['--run-id', RID]), guard);
        check(projectSnapshot(a) === snap, 'normal merge after staging [A]: every run file and project byte is unchanged');
        const bad = path.join(a, 'allow-bad.json');
        putFile(bad, '{');
        const snap2 = projectSnapshot(a);
        expectStageErr(check, 'the guard runs before the allow file is parsed', kit.merge(a, ['--run-id', RID, '--allow-file', bad]), guard);
        check(projectSnapshot(a) === snap2, 'the guard before allow-file parsing: nothing written');
        const b = fresh('order-empty');
        putRequest(b, RID, 'omissions.json', { [T_SETTINGS]: { 'permissions.allow': [] } });
        const snapB = projectSnapshot(b);
        expectStageErr(check, 'an explicit empty staged allow-omission request', kit.merge(b, ['--run-id', RID]), guard);
        check(projectSnapshot(b) === snapB, 'an explicit empty staged allow-omission request: nothing written');
        const c = fresh('order-deny');
        putRequest(c, RID, 'omissions.json', { [T_SETTINGS]: { 'permissions.deny': [{ anchor: 'any', glob: '**/.x' }] } });
        const rc = kit.merge(c, ['--run-id', RID]);
        check(rc.code === 0 && rc.json && rc.json.ok === true && rc.stderr === '', 'a deny-only omission request does not trigger the guard', { code: rc.code, out: rc.stdout.slice(0, 300) });
        const d = fresh('order-hooks');
        check(kit.retire(d, RID, SEL_A).code === 0, 'control: [A] stages in a second project');
        const rh = kit.hooksOnly(d, RID);
        check(rh.code === 0 && rh.stderr === '' && rh.json && rh.json.ok === true && eq(keysOf(rh.json.report), ['hooks']), 'hooks-only staging is unaffected by a pending allow retirement', { code: rh.code, out: rh.stdout.slice(0, 300) });
        // Unreadable or invalid guard inputs use the plan 3.9 envelopes.
        const e = fresh('order-json');
        putRequest(e, RID, 'omissions.json', '{');
        expectStageErr(check, 'invalid JSON in omissions.json', kit.merge(e, ['--run-id', RID]), { code: 'ALLOW_STAGE_JSON', exit: 3, error: ST.JSON(target), target });
        const f = fresh('order-meta');
        putRequest(f, RID, 'omissions.json', []);
        expectStageErr(check, 'a wrong container in omissions.json', kit.merge(f, ['--run-id', RID]), { code: 'ALLOW_STAGE_METADATA', exit: 3, error: ST.METADATA(target), target });
        const g = fresh('order-meta2');
        putRequest(g, RID, 'omissions.json', { [T_SETTINGS]: { 'permissions.allow': [A, A] } });
        expectStageErr(check, 'a repeated identity in a staged allow omission', kit.merge(g, ['--run-id', RID]), { code: 'ALLOW_STAGE_METADATA', exit: 3, error: ST.METADATA(target), target });
      });
    });
    flushProcessCount(context, 'R54/C7/refusal');
  });
}

// ================================================= R85/C7/inventory ====
// Plan 4.5: a genuine v2 installation with managed allows [A, C, B]; only after installation the controlled changes; the inventory through detect; then selection [].
async function inventoryGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const v2 = await useV2(failures, context);
    if (!v2) return;
    const kit = makeKit(context, check);
    await withScratch(context, 'inv', async (dir) => {
      await step('every installed managed allow is listed, absent, duplicate and safe entries included, through detect and through the staging report', async () => {
        const root = cloneTree(v2.root, path.join(dir, 'inv'));
        check(eq(readJson(manifestPath(root)).files[T_SETTINGS].managed['permissions.allow'], [A, C, B]), 'control: the genuine v2 manifest records the managed allows [A, C, B]', readJson(manifestPath(root)).files[T_SETTINGS].managed);
        editSettings(root, (s) => { s.permissions.allow = [U, A, C, A]; });
        editManifest(root, (man) => { man.files[T_SETTINGS].managed['permissions.allow'] = [A, C, B, A]; });
        const d = kit.detect(root);
        const al = d.json && d.json.claude && d.json.claude.allows;
        check(d.code === 0 && al, 'discovery succeeds on the edited genuine installation', { code: d.code, out: d.stdout.slice(0, 200) });
        const inv = [I(A, true, 'repo-code', 'warn'), I(C, true, 'other', 'none'), I(B, false, 'repo-code', 'warn'), I(A, true, 'repo-code', 'warn')];
        check(al && eq(al.managed, inv), 'claude.allows.managed lists all four metadata occurrences, in order, B absent and A twice', al && al.managed);
        check(al && eq(al.rules, [RU(U), RM(A), OM(C), RM(A)]), 'claude.allows.rules is [RU(U), RM(A), OM(C), RM(A)]', al && al.rules);
        check(al && eq(al.results, [WR(REPO(U, 'user')), WR(REPO(A, 'managed')), WR(REPO(A, 'managed')), LI]), 'claude.allows.results keeps both occurrences of A, then the personal-settings row', al && al.results);
        if (!kit.begin(root, RID)) return;
        const r = kit.retire(root, RID, []);
        const want = ENV_OK({ changed: false, metadataChanged: false, draft: null, allows: al, retirement: { listed: inv, retired: [], alreadyAbsent: [], alreadyOmitted: [], retained: [A, C, B, A] } });
        expectRetireOk(check, 'selection [] against the schema-2 installation', r, want);
        for (const f of ['ownership.json', 'managed-keys.json', 'omissions.json']) check(!exists(runFile(root, RID, f)), `selection []: no ${f} is created`);
        check(!exists(draftPath(root, RID, T_SETTINGS)), 'selection []: no settings draft is created');
      });
    });
    flushProcessCount(context, 'R85/C7/inventory');
  });
}

// ================================================ R85/C7/retirement ====
// Plan 3.7 and 4.5: the pure retirement in process.
const RESULT_KEYS = ['settings', 'managed', 'omissions', 'report'];
async function retirementGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const m = await loadMerge(failures, context);
    if (!m) return;
    const retire = (input) => m.retireManagedAllows(deepFreeze(clone(input)));
    const mkIn = (allow = [U, A, C, B], managed = mkM(), omissions = {}, sel = []) => ({ settings: mkS(allow), managed, omissions, retire: sel });
    await step('retireManagedAllows is a synchronous export; the result is detached mutable JSON and a deeply frozen input is untouched', async () => {
      const input = deepFreeze(mkIn(undefined, undefined, undefined, [A]));
      const r = await attempt(() => m.retireManagedAllows(input));
      check(!r.threw, 'a deeply frozen input is accepted', r.threw ? errMsg(r.error) : null);
      if (r.threw) return;
      check(typeof r.value.then !== 'function' && eq(keysOf(r.value), RESULT_KEYS) && eq(keysOf(r.value.report), RETIRE_KEYS), 'a plain result with the keys settings, managed, omissions, report and the five report keys, in order', { top: keysOf(r.value), report: keysOf(r.value.report) });
      check(!deepFrozen(r.value), 'the result is mutable');
      r.value.settings.permissions.allow.push('x'); r.value.managed['permissions.allow'].length = 0; r.value.report.retired.push('y');
      check(eq(input, mkIn(undefined, undefined, undefined, [A])), 'mutating the result never reaches the input');
    });
    await step('the canonical rows: [] changes nothing; [A], [B, A] and [C] remove only the selected identities and append omissions in installed managed order', async () => {
      const rows = [
        [[], [U, A, C, B], [A, C, B], null],
        [[A], [U, C, B], [C, B], [A]],
        [[B, A], [U, C], [C], [A, B]],
        [[C], [U, A, B], [A, B], [C]],
      ];
      for (const [sel, sAllow, mAllow, omit] of rows) {
        const out = retire(mkIn(undefined, undefined, undefined, sel));
        check(eq(out.settings, mkS(sAllow)) && eq(keysOf(out.settings), ['permissions', 'env']) && eq(keysOf(out.settings.permissions), ['allow', 'deny', 'ask']), `${show(sel)}: settings allow is ${show(sAllow)}; deny, ask and env are unchanged and keep their order`, out.settings);
        check(eq(out.managed, mkM(mAllow)) && eq(keysOf(out.managed), ['permissions.allow', 'permissions.deny', 'heldBack']), `${show(sel)}: managed allow is ${show(mAllow)}; deny ownership and heldBack are unchanged`, out.managed);
        check(eq(out.omissions, omit === null ? {} : { 'permissions.allow': omit }), `${show(sel)}: allow omissions ${omit === null ? 'stay absent' : show(omit)}`, out.omissions);
        const retired = [A, C, B].filter((r) => sel.includes(r));
        check(eq(out.report, { listed: INV0(), retired, alreadyAbsent: [], alreadyOmitted: [], retained: mAllow }), `${show(sel)}: the exact report`, out.report);
      }
      const bad = await attempt(() => retire(mkIn(undefined, undefined, undefined, [U])));
      check(bad.threw && bad.error.code === 'ALLOW_SELECTION' && bad.error.message === ERR_SELECTION, '[U]: a user-owned rule is refused with ALLOW_SELECTION', bad.threw ? bad.error.message : bad.value);
    });
    await step('the exact report of [A]', async () => {
      const out = retire(mkIn(undefined, undefined, undefined, [A]));
      check(eq(out.report, RET({ listed: INV0(), retired: [A], retained: [C, B] })), 'listed is the pre-retirement inventory, retired [A], retained [C, B]', out.report);
    });
    await step('already absent: a selected managed allow missing from the shared array is alreadyAbsent, still leaves managed ownership and still records the omission', async () => {
      const out = retire(mkIn([U, C, B], undefined, undefined, [A]));
      check(eq(out.report, RET({ listed: [I(A, false, 'repo-code', 'warn'), I(C, true, 'other', 'none'), I(B, true, 'repo-code', 'warn')], alreadyAbsent: [A], retained: [C, B] })), 'retired is [] and alreadyAbsent [A]', out.report);
      check(eq(out.settings, mkS([U, C, B])) && eq(out.managed['permissions.allow'], [C, B]) && eq(out.omissions, { 'permissions.allow': [A] }), 'settings unchanged, ownership removed, omission recorded', out);
      const none = { settings: { permissions: { deny: [D] } }, managed: mkM(), omissions: {}, retire: [A] };
      const o2 = retire(none);
      check(eq(o2.settings, { permissions: { deny: [D] } }) && !hasOwn(o2.settings.permissions, 'allow'), 'an absent allow key plus a recorded A is metadata-only: the allow key is not created', o2.settings);
      check(eq(o2.report.alreadyAbsent, [A]) && eq(o2.report.retired, []) && eq(o2.managed['permissions.allow'], [C, B]) && eq(o2.omissions, { 'permissions.allow': [A] }), 'and the ownership and omission still change', o2);
    });
    await step('already omitted and a user re-add: an omission-only identity is reported once, in installed omission order, and a rule present again is preserved as user-owned', async () => {
      const after = mkIn([U, C, B], mkM([C, B]), { 'permissions.allow': [A] }, [A]);
      const out = retire(after);
      check(eq(out.report, RET({ listed: [I(C, true, 'other', 'none'), I(B, true, 'repo-code', 'warn')], alreadyOmitted: [A], retained: [C, B] })), 'after committed retirement, selecting A reports alreadyOmitted [A]', out.report);
      check(eq(out.settings, after.settings) && eq(out.managed, after.managed) && eq(out.omissions, after.omissions), 'and changes nothing', out);
      const readded = retire(mkIn([U, A, C, B], mkM([C, B]), { 'permissions.allow': [A] }, [A]));
      check(eq(readded.settings, mkS([U, A, C, B])) && eq(readded.report.alreadyOmitted, [A]) && eq(readded.report.retired, []), 'a user re-added A is preserved (it is not managed any more)', readded);
      const two = retire(mkIn([U], mkM([]), { 'permissions.allow': ['Bash(git log)', 'Bash(git diff)'] }, ['Bash(git diff)', 'Bash(git log)']));
      check(eq(two.report.alreadyOmitted, ['Bash(git log)', 'Bash(git diff)']), 'alreadyOmitted follows the installed omission order, not the selection order', two.report);
      const mixed = retire(mkIn([U, A, C, B], mkM(), { 'permissions.allow': ['Bash(git log)'] }, ['Bash(git log)', A]));
      check(eq(mixed.report.retired, [A]) && eq(mixed.report.alreadyOmitted, ['Bash(git log)']) && eq(mixed.omissions, { 'permissions.allow': ['Bash(git log)', A] }), 'a mixed selection retires the managed identity and keeps the existing omission first', mixed);
    });
    await step('duplicates and overlap: every identical shared and managed occurrence is removed, one identity and one omission is reported; an overlapping managed and omitted identity retires to the one existing omission', async () => {
      const dup = retire({ settings: mkS([U, A, C, A, B]), managed: mkM([A, C, B, A]), omissions: {}, retire: [A] });
      check(eq(dup.settings, mkS([U, C, B])) && eq(dup.managed['permissions.allow'], [C, B]) && eq(dup.omissions, { 'permissions.allow': [A] }), 'all A occurrences leave the shared array and the managed array; one omission', dup);
      check(eq(dup.report, RET({ listed: [I(A, true, 'repo-code', 'warn'), I(C, true, 'other', 'none'), I(B, true, 'repo-code', 'warn'), I(A, true, 'repo-code', 'warn')], retired: [A], retained: [C, B] })), 'A is reported once, the listed inventory keeps both occurrences', dup.report);
      const ov = retire({ settings: mkS([A, C]), managed: { 'permissions.allow': [A, C] }, omissions: { 'permissions.allow': [A] }, retire: [A] });
      check(eq(ov.managed['permissions.allow'], [C]) && eq(ov.omissions, { 'permissions.allow': [A] }) && eq(ov.report.retired, [A]) && eq(ov.report.alreadyOmitted, []), 'managed ownership takes precedence: the managed identity goes, the existing omission is preserved exactly once', ov);
      check(eq(ov.settings.permissions.allow, [C]), 'the shared occurrence is removed', ov.settings);
    });
    await step('preservation: an existing empty allow array, deny omissions, heldBack, hooks and every other C2-permitted field survive; nothing is normalized', async () => {
      const mans = { 'permissions.allow': [A], 'permissions.deny': [D], hooks: [H], heldBack: ['Read(y)'] };
      const oms = { 'permissions.deny': [{ anchor: 'any', glob: '**/.x' }] };
      const rest = { hooks: { PreToolUse: [E] }, custom: { keep: [2, 1] } };
      // An existing empty allow array stays as it is (here A is already absent, so the retirement is metadata-only).
      const out = retire({ settings: { permissions: { allow: [], deny: [D] }, ...rest }, managed: mans, omissions: oms, retire: [A] });
      check(eq(out.settings, { permissions: { allow: [], deny: [D] }, ...rest }) && eq(out.settings.permissions.allow, []), 'the existing empty allow array stays; hooks and unrelated fields are unchanged', out.settings);
      check(eq(out.report.alreadyAbsent, [A]) && eq(out.report.retired, []) && eq(out.report.retained, []), 'A is alreadyAbsent and nothing is retained', out.report);
      check(eq(out.managed['permissions.deny'], [D]) && eq(out.managed.hooks, [H]) && eq(out.managed.heldBack, ['Read(y)']), 'managed deny, hooks and heldBack are unchanged', out.managed);
      check(eq(keysOf(out.managed).filter((k) => k !== 'permissions.allow'), ['permissions.deny', 'hooks', 'heldBack']), 'the other managed fields keep their order', keysOf(out.managed));
      // PLAN-GAP: where a newly created allow key sits among the other keys of the omissions object is not pinned, so only the values are asserted.
      check(eq(out.omissions, { 'permissions.deny': [{ anchor: 'any', glob: '**/.x' }], 'permissions.allow': [A] }), 'deny omissions are unchanged; the allow omission is added', out.omissions);
      // PLAN-GAP: whether an allow array that retirement empties stays as [] or loses its key is not pinned, so either is accepted; nothing else may change.
      const emptied = retire({ settings: { permissions: { allow: [A], deny: [D] }, ...rest }, managed: mans, omissions: {}, retire: [A] });
      const leftShared = emptied.settings.permissions.allow;
      const leftManaged = emptied.managed['permissions.allow'];
      check((leftShared === undefined || eq(leftShared, [])) && (leftManaged === undefined || eq(leftManaged, [])), 'an emptied shared or managed allow array is [] or absent', { shared: leftShared, managed: leftManaged });
      check(eq(emptied.settings.permissions.deny, [D]) && eq(emptied.settings.hooks, rest.hooks) && eq(emptied.settings.custom, rest.custom) && eq(emptied.managed['permissions.deny'], [D]) && eq(emptied.managed.hooks, [H]) && eq(emptied.report.retired, [A]) && eq(emptied.report.retained, []) && eq(emptied.omissions, { 'permissions.allow': [A] }), 'everything else about the emptying retirement is as specified', emptied);
    });
    await step('selection errors: ALLOW_SELECTION with its exact message for a repeated, non-string, user-owned, case-changed or unrecorded selection', async () => {
      const sels = [[A, A], [7], [U], ['Bash(NPM test)'], ['bash(npm test)'], [null], [[A]], [`${A} `], ['Bash(git log)'], [A, 'Bash(git log)']];
      for (const sel of sels) await expectErr(check, `retire ${show(sel)}`, () => retire(mkIn(undefined, undefined, undefined, sel)), 'ALLOW_SELECTION', ERR_SELECTION);
    });
    await step('validation and precedence: retire must be an array (ALLOW_INPUT, even with malformed settings); settings, managed and omissions errors keep their codes and exact messages; selection is last', async () => {
      const ok = () => mkIn();
      for (const v of [{}, 'x', null, 7, undefined]) await expectErr(check, `retire ${show(v)} with malformed settings`, () => m.retireManagedAllows({ settings: 7, managed: 7, omissions: 7, retire: v }), 'ALLOW_INPUT', allowInputMsg);
      for (const v of [null, [], 'x', 7, undefined]) await expectErr(check, `outer input ${show(v)}`, () => m.retireManagedAllows(v), 'ALLOW_INPUT', allowInputMsg);
      await expectErr(check, 'a missing retire key', () => m.retireManagedAllows({ settings: {}, managed: {}, omissions: {} }), 'ALLOW_INPUT', allowInputMsg);
      await expectErr(check, 'an unknown key', () => m.retireManagedAllows({ ...ok(), extra: 1 }), 'ALLOW_INPUT', allowInputMsg);
      for (const s of [7, [], null, 'x', { permissions: null }, { permissions: { allow: 'x' } }, { permissions: { allow: [1] } }]) await expectErr(check, `settings ${show(s)}`, () => m.retireManagedAllows({ ...ok(), settings: s }), 'ALLOW_SETTINGS', ERR_SETTINGS);
      await expectErr(check, 'non-object managed', () => m.retireManagedAllows({ ...ok(), managed: 7 }), 'OWNERSHIP_SHAPE', 'OWNERSHIP_SHAPE: managed');
      await expectErr(check, 'a malformed managed allow array', () => m.retireManagedAllows({ ...ok(), managed: { 'permissions.allow': 'x' } }), 'OWNERSHIP_SHAPE', 'OWNERSHIP_SHAPE: managed.permissions.allow');
      await expectErr(check, 'non-object omissions', () => m.retireManagedAllows({ ...ok(), omissions: 7 }), 'OMISSIONS_SHAPE', 'OMISSIONS_SHAPE: omissions');
      await expectErr(check, 'a repeated allow omission', () => m.retireManagedAllows({ ...ok(), omissions: { 'permissions.allow': [A, A] } }), 'OMISSIONS_DUPLICATE', 'OMISSIONS_DUPLICATE: omissions.permissions.allow[1]');
      await expectErr(check, 'unknown managed.extra', () => m.retireManagedAllows({ ...ok(), managed: { ...mkM(), extra: ['x'] }, retire: [A] }), 'OWNERSHIP_FIELD', 'OWNERSHIP_FIELD: managed.extra');
      await expectErr(check, 'settings errors beat managed errors', () => m.retireManagedAllows({ settings: 7, managed: 7, omissions: 7, retire: [] }), 'ALLOW_SETTINGS', ERR_SETTINGS);
      await expectErr(check, 'managed errors beat omission errors', () => m.retireManagedAllows({ settings: {}, managed: 7, omissions: 7, retire: [] }), 'OWNERSHIP_SHAPE', 'OWNERSHIP_SHAPE: managed');
      await expectErr(check, 'omission errors beat selection errors', () => m.retireManagedAllows({ settings: {}, managed: {}, omissions: 7, retire: ['x'] }), 'OMISSIONS_SHAPE', 'OMISSIONS_SHAPE: omissions');
      await expectErr(check, 'ALLOW_INPUT beats everything', () => m.retireManagedAllows({ settings: 7, managed: 7, omissions: 7, retire: {} }), 'ALLOW_INPUT', allowInputMsg);
    });
  });
}

// ================================================ layered C3, C6 and C7 staging ====
// Plan 4.9: the genuine v2 installation with [A, C, B]; C3 stage with the known-unchanged literal decisions; C6 hooks-only; then C7 [A]. Built once; each snapshot is
// kept so the assertions never derive an expected value from what the implementation under test produced later.
const LID = 'run-c7-lay1';
const decisionsFor = (report) => ({
  schema: 1, reportSha256: sha(Buffer.from(jsonText(report), 'utf8')), entries: [],
  coverage: [{ id: 'coverage:0', action: 'include' }, { id: 'coverage:7', action: 'include' }, { id: 'coverage:18', action: 'include' }],
  denyOmissions: [], dropDenyOwnership: [], overrideUserExceptions: false,
});
const getLayered = (context) => cached(context, 'layered', async () => {
  const fails = [];
  const check = mkCheck(fails);
  const v2 = await getV2(context);
  const dir = scratchDir(context, 'layered');
  const kit = makeKit(context, check);
  const root = cloneTree(v2.root, path.join(dir, 'root'));
  const out = { dir, root, v2, fails };
  if (!kit.begin(root, LID)) return out;
  const rep = kit.report(root);
  const report = rep.json && rep.json.report;
  check(rep.code === 0 && report, 'the migration report succeeds', rep.stdout.slice(0, 300));
  if (!report) return out;
  putRequest(root, LID, 'security-decisions.json', decisionsFor(report));
  const st = kit.stage(root, LID);
  out.stage = st;
  const capture = () => ({ files: runSnapshot(root, LID), draft: readJson(draftPath(root, LID, T_SETTINGS)), draftBytes: readBytes(draftPath(root, LID, T_SETTINGS)), managed: readJson(runFile(root, LID, 'managed-keys.json')), ownership: readJson(runFile(root, LID, 'ownership.json')) });
  out.c3 = capture();
  out.hooks = kit.hooksOnly(root, LID);
  out.afterHooks = capture();
  out.retire = kit.retire(root, LID, SEL_A);
  out.afterRetire = capture();
  out.afterRetire.omissions = readText(runFile(root, LID, 'omissions.json'));
  return out;
});

// =================================================== R85/C7/staging ====
async function stagingGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const base = await useBase(failures, context);
    if (!base) return;
    const kit = makeKit(context, check);
    await withScratch(context, 'staging', async (dir) => {
      let n = 0;
      const fresh = (label) => cloneTree(base.root, path.join(dir, `${label}-${++n}`));
      const REPEAT_REPORT = () => RET({ listed: [I(A, false, 'repo-code', 'warn'), I(C, true, 'other', 'none'), I(B, true, 'repo-code', 'warn')], alreadyAbsent: [A], retained: [C, B] });
      const FIRST_REPORT = () => RET({ listed: INV0(), retired: [A], retained: [C, B] });
      let firstRoot = null;

      await step('the first stage of [A]: the exact envelope, the exact draft bytes J(S1) and the three exact request files; the installed settings and manifest are untouched', async () => {
        const root = fresh('first');
        const before = outsideRunSnapshot(root);
        const r = kit.retire(root, RID, SEL_A);
        expectRetireOk(check, 'first stage', r, ENV_OK({ changed: true, metadataChanged: true, draft: draftRel(RID), allows: P1(), retirement: FIRST_REPORT() }));
        check(readText(draftPath(root, RID, T_SETTINGS)) === J(mkS([U, C, B])), 'the settings draft is exactly J(S1)', clip(readText(draftPath(root, RID, T_SETTINGS))));
        const want = REQ_BYTES();
        check(readText(runFile(root, RID, 'ownership.json')) === want.ownership, 'ownership.json is exactly J({".claude/settings.json":"keys"})', readText(runFile(root, RID, 'ownership.json')));
        check(readText(runFile(root, RID, 'managed-keys.json')) === want.managed, 'managed-keys.json is exactly J of the patched allow field [C, B] and nothing else', readText(runFile(root, RID, 'managed-keys.json')));
        check(readText(runFile(root, RID, 'omissions.json')) === want.omissions, 'omissions.json is exactly J of the allow omission [A] and nothing else', readText(runFile(root, RID, 'omissions.json')));
        for (const f of ['manifest-metadata.json', 'transaction-inputs.json']) check(!exists(runFile(root, RID, f)), `no unrelated request file ${f} was created`);
        check(outsideRunSnapshot(root) === before, 'the installed settings, the manifest, the lock and every other project file are byte for byte unchanged');
        firstRoot = root;
      });
      await step('the same-run repeat of [A]: A is now listed absent (the draft is the base, the installed ownership is the authority), the exact envelope, every draft and request byte unchanged', async () => {
        if (!firstRoot) { check(false, 'the repeat needs the first-stage state'); return; }
        const root = cloneTree(firstRoot, path.join(dir, `repeat-${++n}`));
        const before = runSnapshot(root, RID);
        const r = kit.retire(root, RID, undefined);
        expectRetireOk(check, 'same-run repeat', r, ENV_OK({ changed: false, metadataChanged: false, draft: draftRel(RID), allows: P1(), retirement: REPEAT_REPORT() }));
        check(changedRunFiles(before, runSnapshot(root, RID)).length === 0, 'every draft and request file is byte for byte unchanged', changedRunFiles(before, runSnapshot(root, RID)));
      });
      await step('selection []: no draft, no request files, changed and metadataChanged false, draft null, the original inventory and retained [A, C, B]', async () => {
        const root = fresh('empty');
        const r = kit.retire(root, RID, []);
        expectRetireOk(check, 'selection []', r, ENV_OK({ changed: false, metadataChanged: false, draft: null, allows: P0(), retirement: RET({ listed: INV0(), retained: [A, C, B] }) }));
        const created = [...runSnapshot(root, RID).keys()].filter((k) => k !== 'retire-allows.json');
        check(created.length === 0, 'nothing but the selection file exists in the run', created);
      });
      await step('an already-absent A: S1 installed with F and M unchanged: no draft, the same three request files, changed false, metadataChanged true, the repeat retirement report', async () => {
        const root = fresh('absent');
        putFile(projPath(root, T_SETTINGS), J(mkS([U, C, B])));
        const r = kit.retire(root, RID, SEL_A);
        expectRetireOk(check, 'absent A', r, ENV_OK({ changed: false, metadataChanged: true, draft: null, allows: P1(), retirement: REPEAT_REPORT() }));
        const want = REQ_BYTES();
        check(!exists(draftPath(root, RID, T_SETTINGS)), 'no settings draft is written');
        check(readText(runFile(root, RID, 'ownership.json')) === want.ownership && readText(runFile(root, RID, 'managed-keys.json')) === want.managed && readText(runFile(root, RID, 'omissions.json')) === want.omissions, 'the same three request files as for a present A', { own: readText(runFile(root, RID, 'ownership.json')), man: readText(runFile(root, RID, 'managed-keys.json')), om: readText(runFile(root, RID, 'omissions.json')) });
      });
      await step('amending a pending retirement conflicts (managed request first, no write); a selection that reorders to the same result is not an amendment', async () => {
        if (!firstRoot) { check(false, 'the conflict needs the first-stage state'); return; }
        const root = cloneTree(firstRoot, path.join(dir, `amend-${++n}`));
        putFile(path.join(root, ...SELECTION_REL.split('/')), J([B]));
        const snap = projectSnapshot(root);
        const mkT = runRel(RID, 'managed-keys.json');
        expectStageErr(check, 'a pending [A] changed to [B]', kit.retire(root, RID, undefined), { code: 'ALLOW_STAGE_CONFLICT', exit: 3, error: ST.CONFLICT(mkT), target: mkT });
        check(projectSnapshot(root) === snap, 'the conflict wrote nothing and erased nothing');
        putFile(path.join(root, ...SELECTION_REL.split('/')), J([A, B]));
        const snap2 = projectSnapshot(root);
        expectStageErr(check, 'a pending [A] widened to [A, B]', kit.retire(root, RID, undefined), { code: 'ALLOW_STAGE_CONFLICT', exit: 3, error: ST.CONFLICT(mkT), target: mkT });
        check(projectSnapshot(root) === snap2, 'widening conflicts too and writes nothing');
        // order-insensitive amendment: [B, A] then [A, B] produce the same result
        const r2 = fresh('reorder');
        const first = kit.retire(r2, RID, [B, A]);
        check(first.code === 0 && first.json && first.json.ok === true && first.json.changed === true, 'control: [B, A] stages', { code: first.code, out: first.stdout.slice(0, 300) });
        check(eq(readJson(runFile(r2, RID, 'omissions.json')), { [T_SETTINGS]: { 'permissions.allow': [A, B] } }) && eq(readJson(runFile(r2, RID, 'managed-keys.json')), { [T_SETTINGS]: { 'permissions.allow': [C] } }), 'the omissions follow the installed managed order [A, B], not the selection order', { om: readJson(runFile(r2, RID, 'omissions.json')), man: readJson(runFile(r2, RID, 'managed-keys.json')) });
        const before = runSnapshot(r2, RID);
        putFile(path.join(r2, ...SELECTION_REL.split('/')), J([A, B]));
        const mid = runSnapshot(r2, RID);
        const second = kit.retire(r2, RID, undefined);
        check(second.code === 0 && second.stderr === '' && second.json && second.json.ok === true && second.json.changed === false && second.json.metadataChanged === false, 'the reordered selection [A, B] is accepted as the same result: nothing changed', { code: second.code, out: second.stdout.slice(0, 400) });
        check(changedRunFiles(mid, runSnapshot(r2, RID)).length === 0 && before.size > 0, 'and no request or draft byte changed');
      });
      await step('staged requests: a field equal to its installed value is accepted and patched; an absent installed omission is not []; a third value conflicts, omissions after managed; nothing is written on a conflict', async () => {
        const mkT = runRel(RID, 'managed-keys.json');
        const omT = runRel(RID, 'omissions.json');
        const seeded = (label, managed, omissions, ownership = false) => {
          const root = fresh(label);
          if (ownership) putRequest(root, RID, 'ownership.json', { [T_SETTINGS]: 'keys' });
          if (managed !== undefined) putRequest(root, RID, 'managed-keys.json', { [T_SETTINGS]: { 'permissions.allow': managed } });
          if (omissions !== undefined) putRequest(root, RID, 'omissions.json', { [T_SETTINGS]: { 'permissions.allow': omissions } });
          putFile(path.join(root, ...SELECTION_REL.split('/')), J([A]));
          return root;
        };
        const a = seeded('inst-equal', [A, C, B]);
        const ra = kit.retire(a, RID, undefined);
        check(ra.code === 0 && ra.json && ra.json.ok === true && ra.json.metadataChanged === true, 'a staged managed allow field equal to the installed value is accepted', { code: ra.code, out: ra.stdout.slice(0, 300) });
        check(readText(runFile(a, RID, 'managed-keys.json')) === REQ_BYTES().managed, 'and it is patched to the resulting value [C, B]', readText(runFile(a, RID, 'managed-keys.json')));
        const b = seeded('om-third', [C, B], [B]);
        const sb = projectSnapshot(b);
        expectStageErr(check, 'managed equal to the result, omissions a third value', kit.retire(b, RID, undefined), { code: 'ALLOW_STAGE_CONFLICT', exit: 3, error: ST.CONFLICT(omT), target: omT });
        check(projectSnapshot(b) === sb, 'the omission conflict wrote nothing');
        const c = seeded('om-empty', undefined, []);
        expectStageErr(check, 'an absent installed omission is distinct from []', kit.retire(c, RID, undefined), { code: 'ALLOW_STAGE_CONFLICT', exit: 3, error: ST.CONFLICT(omT), target: omT });
        const d = seeded('man-empty', [], [A]);
        expectStageErr(check, 'managed [] is a third value; the managed conflict is reported before the omission request', kit.retire(d, RID, undefined), { code: 'ALLOW_STAGE_CONFLICT', exit: 3, error: ST.CONFLICT(mkT), target: mkT });
        const e = seeded('both-result', [C, B], [A], true);
        const eBefore = runSnapshot(e, RID);
        const re = kit.retire(e, RID, undefined);
        check(re.code === 0 && re.json && re.json.ok === true && re.json.metadataChanged === false && re.json.changed === true, 'requests equal to this invocation\'s result are accepted unchanged (the draft is still written)', { code: re.code, out: re.stdout.slice(0, 300) });
        check(eq(changedRunFiles(eBefore, runSnapshot(e, RID)), ['drafts/.claude/settings.json']), 'only the draft changed: the three equal request files keep their bytes', changedRunFiles(eBefore, runSnapshot(e, RID)));
      });
      await step('a forged managed request cannot authorize a user rule: eligibility fails first with ALLOW_SELECTION, and a conflicting ownership request is ALLOW_STAGE_METADATA before the selection is looked at', async () => {
        const root = fresh('forged');
        putRequest(root, RID, 'managed-keys.json', { [T_SETTINGS]: { 'permissions.allow': [U, A, C, B] } });
        putFile(path.join(root, ...SELECTION_REL.split('/')), J([U]));
        const snap = projectSnapshot(root);
        expectStageErr(check, 'selection [U] with a forged managed request', kit.retire(root, RID, undefined), { code: 'ALLOW_SELECTION', exit: 3, error: ERR_SELECTION, target: SELECTION_REL });
        check(projectSnapshot(root) === snap, 'the forged-selection failure wrote nothing');
        const own = runRel(RID, 'ownership.json');
        for (const sel of [[U], [A]]) {
          const r2 = fresh('full');
          putRequest(r2, RID, 'ownership.json', { [T_SETTINGS]: 'full' });
          putFile(path.join(r2, ...SELECTION_REL.split('/')), J(sel));
          const s2 = projectSnapshot(r2);
          expectStageErr(check, `ownership "full" with selection ${show(sel)}`, kit.retire(r2, RID, undefined), { code: 'ALLOW_STAGE_METADATA', exit: 3, error: ST.METADATA(own), target: own });
          check(projectSnapshot(r2) === s2, `ownership "full" with selection ${show(sel)}: nothing written`);
        }
      });
      await step('a settings draft is the base when present: a draft that already lacks A reports alreadyAbsent and is not rewritten', async () => {
        const root = fresh('draftbase');
        putDraft(root, RID, T_SETTINGS, ser(mkS([U, C, B]), { indent: 4, eol: '\r\n' }));
        const draftBefore = readBytes(draftPath(root, RID, T_SETTINGS));
        const r = kit.retire(root, RID, SEL_A);
        expectRetireOk(check, 'draft already without A', r, ENV_OK({ changed: false, metadataChanged: true, draft: draftRel(RID), allows: P1(), retirement: REPEAT_REPORT() }));
        check(sameBytes(readBytes(draftPath(root, RID, T_SETTINGS)), draftBefore), 'equal values retain the base bytes: the draft is not rewritten (four spaces and CRLF kept)');
      });
      await step('staged unrelated settings fields and request fields survive: only the settings draft and the allow fields of the three requests change; other targets, fields, transaction inputs and manifest metadata keep their bytes', async () => {
        const root = fresh('rich');
        const staged = { $schema: 'https://json.schemastore.org/claude-code-settings.json', env: { KEEP: '1' }, permissions: { deny: ['Read(x)'], allow: [U, A, C, B] }, hooks: { PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'node w.mjs' }] }] } };
        putDraft(root, RID, T_SETTINGS, ser(staged));
        const POLICY_REC = { schema: 2, patterns: [{ anchor: 'any', glob: '**/.env*' }] };
        const own = { [T_POLICY]: 'keys', [T_SETTINGS]: 'keys' };
        const managed = { [T_POLICY]: POLICY_REC, [T_SETTINGS]: { 'permissions.deny': ['Read(x)'], heldBack: ['Read(y)'], hooks: [H] } };
        const omit = { [T_POLICY]: { patterns: [{ anchor: 'any', glob: '**/.y' }] }, [T_SETTINGS]: { 'permissions.deny': [{ anchor: 'any', glob: '**/.x' }] } };
        putRequest(root, RID, 'ownership.json', own);
        putRequest(root, RID, 'managed-keys.json', managed);
        putRequest(root, RID, 'omissions.json', omit);
        putRequest(root, RID, 'manifest-metadata.json', { codexSnippetSha256: 'a'.repeat(64) });
        putRequest(root, RID, 'transaction-inputs.json', ['docs/a.md']);
        putFile(projPath(root, 'docs/a.md'), '# a\n');
        const before = runSnapshot(root, RID);
        const r = kit.retire(root, RID, SEL_A);
        check(r.code === 0 && r.json && r.json.ok === true && r.json.changed === true && r.json.metadataChanged === true, 'the stage succeeds over a rich staged state', { code: r.code, out: r.stdout.slice(0, 400) });
        const draft = readJson(draftPath(root, RID, T_SETTINGS));
        check(draft && eq(draft, { ...staged, permissions: { deny: ['Read(x)'], allow: [U, C, B] } }) && eq(keysOf(draft), keysOf(staged)) && eq(keysOf(draft.permissions), ['deny', 'allow']), 'the draft is the staged value minus A; every other field and the key order survive', draft);
        const mk = readJson(runFile(root, RID, 'managed-keys.json'));
        check(mk && eq(mk, { [T_POLICY]: POLICY_REC, [T_SETTINGS]: { ...managed[T_SETTINGS], 'permissions.allow': [C, B] } }), 'managed-keys.json: the policy record, deny, heldBack and hooks are unchanged and the allow field is [C, B]', mk);
        const om = readJson(runFile(root, RID, 'omissions.json'));
        check(om && eq(om, { [T_POLICY]: omit[T_POLICY], [T_SETTINGS]: { ...omit[T_SETTINGS], 'permissions.allow': [A] } }), 'omissions.json: the policy omissions and the deny omissions are unchanged and the allow omission is [A]', om);
        const changed = changedRunFiles(before, runSnapshot(root, RID));
        check(eq(changed, ['drafts/.claude/settings.json', 'managed-keys.json', 'omissions.json', 'retire-allows.json']), 'only the settings draft and the allow requests changed (retire-allows.json is the selection written for this run): ownership.json, manifest-metadata.json and transaction-inputs.json keep their bytes', changed);
      });
    });
    flushProcessCount(context, 'R85/C7/staging (synthetic)');

    // ------------------------------------------------------ genuine v2, layered ----
    await step('layered C3, C6 and C7: the C3 deny projection, deny ownership, heldBack, policy record, decisions and every other run file survive; the hook stays; only the allow fields and the draft allow list change', async () => {
      let g;
      try { g = await getLayered(context); } catch (e) { failures.push(`cannot build the layered scenario: ${errMsg(e)}`); return; }
      for (const f of g.fails) failures.push(`scenario build: ${f}`);
      check(g.stage && g.stage.code === 0 && g.stage.json && g.stage.json.ok === true, 'C3 stage succeeds with the known-unchanged decisions', g.stage && g.stage.stdout.slice(0, 300));
      if (!g.stage || !g.stage.json || g.stage.json.ok !== true) return;
      for (const t of UNIT) check((g.stage.json.staged || []).includes(`drafts/${t}`), `C3 staged the runtime member ${t}`, g.stage.json.staged);
      check(g.hooks && g.hooks.code === 0 && g.hooks.json && g.hooks.json.ok === true && eq(g.hooks.json.report && g.hooks.json.report.hooks && g.hooks.json.report.hooks.added, [H]), 'C6 hooks-only adds the managed hook', g.hooks && g.hooks.stdout.slice(0, 300));
      const rd = g.afterRetire;
      const rh = g.afterHooks;
      const inv = [I(A, true, 'repo-code', 'warn'), I(C, true, 'other', 'none'), I(B, true, 'repo-code', 'warn')];
      const allows = { rules: [OM(C), RM(B)], managed: [I(C, true, 'other', 'none'), I(B, true, 'repo-code', 'warn')], omitted: [A], results: [WR(REPO(B, 'managed')), LI] };
      expectRetireOk(check, 'C7 stage after C3 and C6', g.retire, ENV_OK({ changed: true, metadataChanged: true, draft: draftRel(LID), allows, retirement: RET({ listed: inv, retired: [A], retained: [C, B] }) }));
      check(rd.draft && rh.draft && eq(rd.draft, { ...rh.draft, permissions: { ...rh.draft.permissions, allow: [C, B] } }), 'the settings draft is the post-hooks draft with only the allow list reduced (deny array, E and every other field unchanged)', rd.draft && Object.keys(rd.draft));
      check(rd.draft && rh.draft && eq(rd.draft.permissions.deny, rh.draft.permissions.deny) && eq(rd.draft.permissions.deny, g.c3.draft.permissions.deny) && eq(rd.draft.hooks, rh.draft.hooks) && eq(keysOf(rd.draft), keysOf(rh.draft)) && eq(keysOf(rd.draft.permissions), keysOf(rh.draft.permissions)), 'C3\'s deny array, the managed hook and the key orders are unchanged', rd.draft && Object.keys(rd.draft));
      const s1 = rd.managed && rd.managed[T_SETTINGS];
      const s0 = rh.managed && rh.managed[T_SETTINGS];
      check(s1 && s0 && eq(s1, { ...s0, 'permissions.allow': [C, B] }), 'managed-keys.json: the deny ownership, heldBack and hooks [H] of C3 and C6 are unchanged; only the allow field is added', s1 && Object.keys(s1));
      check(rd.managed && rh.managed && eq(rd.managed[T_POLICY], rh.managed[T_POLICY]) && eq(rd.managed[T_POLICY], g.c3.managed[T_POLICY]), 'the policy record is unchanged');
      check(rd.omissions === J({ [T_SETTINGS]: { 'permissions.allow': [A] } }), 'omissions.json holds exactly the allow omission [A] (C3 staged no deny omissions)', rd.omissions);
      check(rd.files.get('ownership.json') === rh.files.get('ownership.json') && eq(rd.ownership, { [T_POLICY]: 'keys', [T_SETTINGS]: 'keys' }), 'ownership.json is byte for byte unchanged (both targets keep keys)');
      const changed = changedRunFiles(rh.files, rd.files);
      check(eq(changed, ['drafts/.claude/settings.json', 'managed-keys.json', 'omissions.json', 'retire-allows.json']), 'every other run file (the policy draft, the seven runtime drafts, decisions, manifest metadata) is byte for byte unchanged', changed);
      check(sameBytes(readBytes(projPath(g.root, T_SETTINGS)), g.v2.settingsBytes) && sameBytes(readBytes(manifestPath(g.root)), g.v2.manifestBytes), 'the installed settings and manifest are the genuine v2 bytes');
    });
    flushProcessCount(context, 'R85/C7/staging');
  });
}

// ============================================= R85/C7/preservation ====
// Plan 4.7 byte variations: unchanged bytes survive, changed settings use the installed style, equal request values keep their formatting.
async function preservationGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const base = await useBase(failures, context);
    if (!base) return;
    const kit = makeKit(context, check);
    await withScratch(context, 'preserve', async (dir) => {
      let n = 0;
      const fresh = (label) => cloneTree(base.root, path.join(dir, `${label}-${++n}`));
      const STYLE = { indent: '\t', eol: '\r\n', bom: true, final: false };
      await step('an installed BOM, tab-indented, CRLF, no-final-newline file with no selection: every installed byte is retained and nothing is staged', async () => {
        const root = fresh('keep');
        const orig = Buffer.from(ser(mkS(), STYLE), 'utf8');
        putFile(projPath(root, T_SETTINGS), orig);
        const r = kit.retire(root, RID, []);
        expectRetireOk(check, 'selection [] over an odd style', r, ENV_OK({ changed: false, metadataChanged: false, draft: null, allows: P0(), retirement: RET({ listed: INV0(), retained: [A, C, B] }) }));
        check(sameBytes(readBytes(projPath(root, T_SETTINGS)), orig), 'the installed settings keep the BOM, tabs, CRLF and the missing final newline');
        check(!exists(draftPath(root, RID, T_SETTINGS)), 'no draft is created');
      });
      await step('a selected retirement over the same style: tabs, CRLF, no BOM and exactly one final CRLF, values and order otherwise preserved', async () => {
        const root = fresh('restyle');
        const orig = Buffer.from(ser(mkS(), STYLE), 'utf8');
        putFile(projPath(root, T_SETTINGS), orig);
        const r = kit.retire(root, RID, SEL_A);
        check(r.code === 0 && r.json && r.json.ok === true && r.json.changed === true, 'the stage succeeds', { code: r.code, out: r.stdout.slice(0, 300) });
        const want = Buffer.from(ser(mkS([U, C, B]), { indent: '\t', eol: '\r\n', bom: false, final: true }), 'utf8');
        check(sameBytes(readBytes(draftPath(root, RID, T_SETTINGS)), want), 'the draft uses the installed indentation and EOL, has no BOM and ends with exactly one CRLF', clip(readText(draftPath(root, RID, T_SETTINGS))));
        check(sameBytes(readBytes(projPath(root, T_SETTINGS)), orig), 'the installed file is unchanged (the draft is the only output)');
        const d = readText(draftPath(root, RID, T_SETTINGS));
        check(d !== null && !d.startsWith('\ufeff') && d.endsWith('}\r\n') && !d.endsWith('\r\n\r\n') && !/[^\r]\n/.test(d), 'no BOM, one final CRLF, no bare LF', clip(d));
      });
      await step('without a detectable installed style (a compact one-line file) a changed draft is two spaces and LF with exactly one final newline', async () => {
        const root = fresh('compact');
        putFile(projPath(root, T_SETTINGS), `${JSON.stringify(mkS())}\n`);
        const r = kit.retire(root, RID, SEL_A);
        check(r.code === 0 && r.json && r.json.ok === true && r.json.changed === true, 'the stage succeeds', { code: r.code, out: r.stdout.slice(0, 300) });
        check(readText(draftPath(root, RID, T_SETTINGS)) === J(mkS([U, C, B])), 'the draft is two-space LF with one final newline', clip(readText(draftPath(root, RID, T_SETTINGS))));
      });
      await step('request values that already equal the result but are formatted differently keep their original bytes; the draft is still written', async () => {
        const root = fresh('reqfmt');
        const own = '{ ".claude/settings.json" : "keys" }';
        const man = JSON.stringify({ [T_SETTINGS]: { 'permissions.allow': [C, B] } });
        const omit = JSON.stringify({ [T_SETTINGS]: { 'permissions.allow': [A] } }, null, 4);
        putRequest(root, RID, 'ownership.json', own);
        putRequest(root, RID, 'managed-keys.json', man);
        putRequest(root, RID, 'omissions.json', omit);
        const r = kit.retire(root, RID, SEL_A);
        expectRetireOk(check, 'equal requests, odd formatting', r, ENV_OK({ changed: true, metadataChanged: false, draft: draftRel(RID), allows: P1(), retirement: RET({ listed: INV0(), retired: [A], retained: [C, B] }) }));
        check(readText(runFile(root, RID, 'ownership.json')) === own && readText(runFile(root, RID, 'managed-keys.json')) === man && readText(runFile(root, RID, 'omissions.json')) === omit, 'the three request files keep their original bytes', { own: readText(runFile(root, RID, 'ownership.json')), man: readText(runFile(root, RID, 'managed-keys.json')) });
      });
      await step('an existing draft with unrelated user fields: those fields and their order are preserved; changed output uses the installed two-space LF style, not the draft\'s four spaces and CRLF', async () => {
        const root = fresh('draftfields');
        const staged = { env: { LATE: '1' }, permissions: { allow: [U, A, C, B], deny: [D] }, zzz: [3, 1, 2], $schema: 'x' };
        putDraft(root, RID, T_SETTINGS, ser(staged, { indent: 4, eol: '\r\n' }));
        const r = kit.retire(root, RID, SEL_A);
        check(r.code === 0 && r.json && r.json.ok === true && r.json.changed === true && r.json.draft === draftRel(RID), 'the stage succeeds and names the draft', { code: r.code, out: r.stdout.slice(0, 300) });
        const want = { env: { LATE: '1' }, permissions: { allow: [U, C, B], deny: [D] }, zzz: [3, 1, 2], $schema: 'x' };
        check(readText(draftPath(root, RID, T_SETTINGS)) === ser(want), 'the draft keeps its fields and key order, loses only A, and is written in the installed two-space LF style', clip(readText(draftPath(root, RID, T_SETTINGS))));
        check(r.json && eq(r.json.report.allows, P1()), 'the report classifies the resulting draft', r.json && r.json.report && r.json.report.allows);
      });
      await step('unselected and user rules keep their relative order, and the manifest and lock are untouched, in a mixed selection', async () => {
        const root = fresh('order');
        putFile(projPath(root, T_SETTINGS), J(mkS([U, B, C, A, 'Bash(git log)'])));
        const before = outsideRunSnapshot(root);
        const r = kit.retire(root, RID, [C]);
        check(r.code === 0 && r.json && r.json.ok === true && r.json.changed === true, 'the stage succeeds', { code: r.code, out: r.stdout.slice(0, 300) });
        check(readText(draftPath(root, RID, T_SETTINGS)) === J(mkS([U, B, A, 'Bash(git log)'])), 'U, B, A and the unrecorded user rule keep their relative order', clip(readText(draftPath(root, RID, T_SETTINGS))));
        check(eq(readJson(runFile(root, RID, 'managed-keys.json')), { [T_SETTINGS]: { 'permissions.allow': [A, B] } }) && eq(readJson(runFile(root, RID, 'omissions.json')), { [T_SETTINGS]: { 'permissions.allow': [C] } }), 'the managed list keeps A and B in installed order; only C is omitted', { man: readJson(runFile(root, RID, 'managed-keys.json')), om: readJson(runFile(root, RID, 'omissions.json')) });
        check(outsideRunSnapshot(root) === before, 'nothing outside the run changed');
      });
    });
    flushProcessCount(context, 'R85/C7/preservation');
  });
}

// ================================================ transaction helpers ====
const settingsOpOf = (r) => (r.json && Array.isArray(r.json.ops) ? r.json.ops.find((o) => o.target === T_SETTINGS) : undefined);
function okPrepare(check, label, r) {
  check(r.code === 0 && r.stderr === '' && r.json && r.json.ok === true && typeof r.json.planSha256 === 'string', `${label}: prepare succeeds`, { code: r.code, out: r.stdout.slice(0, 500), err: r.stderr.slice(0, 200) });
  return r;
}
// Commit and the facts every retirement commit shares: the journal holds the settings content (when there is any) and the manifest last, all applied.
function commitOk(check, label, kit, root, id, sha256, writtenTargets) {
  const c = kit.commit(root, id, sha256);
  check(c.code === 0 && c.stderr === '' && c.json && c.json.committed === true, `${label}: commit succeeds`, { code: c.code, out: c.stdout.slice(0, 500), err: c.stderr.slice(0, 200) });
  if (!(c.json && c.json.committed === true)) return c;
  check(eq((c.json.written || []).map((w) => w.target), writtenTargets) && (c.json.written || []).every((w) => w.created === false), `${label}: written is exactly ${show(writtenTargets)} (every target existed), the manifest last`, c.json.written);
  const j = readJournal(root, id);
  check(j && j.committed === true && eq(j.entries.map((e) => e.target), writtenTargets) && j.entries.every((e) => e.state === 'applied'), `${label}: one journal holds ${show(writtenTargets)}, all applied`, j && j.entries.map((e) => [e.target, e.state]));
  return c;
}
const recordOf = (root) => { const m = readManifestFile(root); return m && m.files ? m.files[T_SETTINGS] : null; };

// ================================================ R85/C7/transaction ====
// Plan 3.10, 4.8 and 4.9: one reviewed transaction: the approval path, the exact operations and reasons, the diffs, the journal order, and the layered and isolated
// C3/C6/C7 interaction.
async function transactionGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const base = await useBase(failures, context);
    const tb = loadTrusted(failures, context);
    if (!base || !tb) return;
    const kit = makeKit(context, check);
    await withScratch(context, 'txn', async (dir) => {
      let n = 0;
      const fresh = (label) => cloneTree(base.root, path.join(dir, `${label}-${++n}`));
      const staged = (label, edit = null) => {
        const root = fresh(label);
        if (edit) edit(root);
        const r = kit.retire(root, RID, SEL_A);
        check(r.code === 0 && r.json && r.json.ok === true, `${label}: the retirement of [A] stages`, { code: r.code, out: r.stdout.slice(0, 300) });
        return root;
      };

      await step('unapproved prepare is the exact plan rejection with one entry (content and metadata reasons in order); no plan is written and no installed byte changes', async () => {
        const root = staged('unapproved');
        const before = outsideRunSnapshot(root);
        expectP(check, 'prepare without approval', kit.prepare(root, RID), approvalEntry([R_ALLOW, R_SETTINGS, R_OMIT]));
        check(!exists(runFile(root, RID, 'plan.json')) && outsideRunSnapshot(root) === before, 'a rejected prepare writes no plan and changes no project byte');
        const unrelated = kit.prepare(root, RID, { approve: [T_POLICY] });
        check(unrelated.code === 3 && unrelated.json && unrelated.json.code === 'APPLY_PLAN_REJECTED', 'an approval naming another file does not satisfy the settings approval', { code: unrelated.code, out: unrelated.stdout.slice(0, 300) });
      });
      await step('approved prepare: exactly the settings content operation (userContentChange true with the allow-removal reason) and the exact literal metadata operation of plan 4.8', async () => {
        const root = staged('approved');
        const p = okPrepare(check, 'approved prepare', kit.prepare(root, RID, { approve: [T_SETTINGS] }));
        if (!p.json || p.json.ok !== true) return;
        const ops = p.json.ops || [];
        check(ops.length === 1 && ops[0].target === T_SETTINGS && ops[0].action === 'modify' && ops[0].origin === 'draft' && ops[0].userContentChange === true && eq(ops[0].userContentReasons, [R_ALLOW]), 'one settings operation: modify, draft, userContentChange true, reasons [the allow-removal reason]', ops);
        check(p.json.changed === 1 && p.json.metadataChanged === 1, 'one content change and one metadata operation', { changed: p.json.changed, metadataChanged: p.json.metadataChanged });
        check(eq(p.json.metadataOps, [META_OP_A()]), 'the complete metadataOps array is the plan literal (before, after with omissions, requiresApproval true, the two reasons in order)', p.json.metadataOps);
        check(eq(p.json.ownershipOverrides, { [T_SETTINGS]: 'keys' }), 'the ownership override is keys', p.json.ownershipOverrides);
        const plan = readPlan(root, RID);
        check(plan && eq(plan.metadataOps, [META_OP_A()]) && eq(plan.ops.map((o) => o.target), [T_SETTINGS]), 'the stored plan holds the same operations', plan && plan.metadataOps);
        const rec = plan && plan.manifestAfter && plan.manifestAfter.files[T_SETTINGS];
        check(rec && JSON.stringify(rec) === JSON.stringify({ ownership: 'keys', managed: mkM([C, B]), omissions: { 'permissions.allow': [A] } }), 'the manifest to write records the reduced managed allows and the omission', rec);
      });
      await step('the unprepared diff shows the settings removal and the requests; the prepared diff shows the settings removal and the metadata operation; both are read-only', async () => {
        const root = staged('diffs');
        const before = projectSnapshot(root);
        const d0 = kit.diff(root, RID);
        check(d0.code === 0 && d0.stderr === '' && d0.json && d0.json.ok === true && d0.json.prepared === false && d0.json.planSha256 === null && d0.json.metadataOps === null, 'the unprepared diff succeeds as an unapproved preview', { code: d0.code, out: d0.stdout.slice(0, 300) });
        const f0 = d0.json && d0.json.files && d0.json.files.find((f) => f.target === T_SETTINGS);
        const lines0 = f0 && typeof f0.diff === 'string' ? f0.diff.split('\n') : [];
        check(f0 && f0.action === 'modify' && lines0.includes('-      "Bash(npm test)",') && !lines0.some((l) => l.startsWith('+') && l.includes('Bash(npm test)')), 'the unprepared diff removes the line of A and adds none', lines0.slice(0, 12));
        const req = d0.json && d0.json.metadataRequests;
        check(req && eq(req.ownership, { [T_SETTINGS]: 'keys' }) && eq(req.managedKeys, { [T_SETTINGS]: { 'permissions.allow': [C, B] } }) && eq(req.omissions, { [T_SETTINGS]: { 'permissions.allow': [A] } }) && req.manifestMetadata === null && req.transactionInputs === null, 'the unprepared diff reports exactly the three staged requests', req);
        check(projectSnapshot(root) === before, 'the unprepared diff changed nothing');
        const p = okPrepare(check, 'prepare for the prepared diff', kit.prepare(root, RID, { approve: [T_SETTINGS] }));
        const snapP = projectSnapshot(root);
        const d1 = kit.diff(root, RID);
        check(d1.code === 0 && d1.json && d1.json.ok === true && d1.json.prepared === true && d1.json.planSha256 === (p.json && p.json.planSha256) && d1.json.metadataRequests === null, 'the prepared diff reports the plan hash', { code: d1.code, out: d1.stdout.slice(0, 300) });
        check(d1.json && eq(d1.json.metadataOps, [META_OP_A()]), 'the prepared diff shows the exact metadata operation', d1.json && d1.json.metadataOps);
        const f1 = d1.json && d1.json.files && d1.json.files.find((f) => f.target === T_SETTINGS);
        check(f1 && typeof f1.diff === 'string' && f1.diff.split('\n').includes('-      "Bash(npm test)",'), 'the prepared diff shows the settings removal', f1 && f1.action);
        check(projectSnapshot(root) === snapP, 'the prepared diff changed nothing');
      });
      await step('commit writes the settings before the manifest in one journal; user allows and unselected ownership survive', async () => {
        const root = staged('commit');
        const p = okPrepare(check, 'prepare before commit', kit.prepare(root, RID, { approve: [T_SETTINGS] }));
        if (!p.json || p.json.ok !== true) return;
        const filesBefore = readManifestFile(root).files;
        commitOk(check, 'content retirement', kit, root, RID, p.json.planSha256, [T_SETTINGS, T_MANIFEST]);
        check(readText(projPath(root, T_SETTINGS)) === J(mkS([U, C, B])), 'the installed settings are exactly J(S1): the user rule U and the unselected C and B remain', clip(readText(projPath(root, T_SETTINGS))));
        const rec = recordOf(root);
        check(rec && JSON.stringify(rec) === JSON.stringify({ ownership: 'keys', managed: mkM([C, B]), omissions: { 'permissions.allow': [A] } }), 'the manifest record: C and B still owned, A removed from ownership and recorded as an omission, deny and heldBack untouched', rec);
        const after = readManifestFile(root).files;
        check(eq(Object.keys(after), Object.keys(filesBefore)), 'no other manifest record was added or removed');
      });
      await step('record-level extension fields survive the commit: the complete resulting settings record is exactly the plan literal', async () => {
        const root = fresh('ext');
        editManifest(root, (m) => { m.files[T_SETTINGS].fixtureNote = 'keep'; });
        const r = kit.retire(root, RID, SEL_A);
        check(r.code === 0 && r.json && r.json.ok === true, 'the retirement stages over a record with a fixtureNote', { code: r.code, out: r.stdout.slice(0, 300) });
        const p = okPrepare(check, 'prepare with a record extension', kit.prepare(root, RID, { approve: [T_SETTINGS] }));
        if (!p.json || p.json.ok !== true) return;
        commitOk(check, 'extension record', kit, root, RID, p.json.planSha256, [T_SETTINGS, T_MANIFEST]);
        const want = { fixtureNote: 'keep', ownership: 'keys', managed: { 'permissions.allow': [C, B], 'permissions.deny': [D], heldBack: [] }, omissions: { 'permissions.allow': [A] } };
        check(JSON.stringify(recordOf(root)) === JSON.stringify(want), 'the resulting record is exactly { fixtureNote, ownership, managed, omissions } with the pinned values and order', recordOf(root));
      });
    });
    flushProcessCount(context, 'R85/C7/transaction (synthetic)');

    // ---------------------------------------------------- genuine V3-base ----
    await step('genuine V3-base, present A: staging, the unapproved and approved prepare, the diffs, the commit order, survival of user and unselected rules, then a new-run no-op, an unrelated approval and a user re-add', async () => {
      const v3 = await useV3(failures, context);
      if (!v3) return;
      await withScratch(context, 'v3', async (dir) => {
        const root = cloneTree(v3.root, path.join(dir, 'present'));
        editSettings(root, (s) => { s.permissions.allow = [U, ...s.permissions.allow]; });
        const T = readText(projPath(root, T_SETTINGS));
        check(eq(JSON.parse(T).permissions.allow, [U, A, C, B]), 'control: the controlled edit gives [U, A, C, B]', JSON.parse(T).permissions.allow);
        if (!kit.begin(root, RID)) return;
        const st = kit.retire(root, RID, SEL_A);
        check(st.code === 0 && st.json && st.json.ok === true && st.json.changed === true && st.json.metadataChanged === true && st.json.draft === draftRel(RID) && eq(st.json.report && st.json.report.retirement, RET({ listed: INV0(), retired: [A], retained: [C, B] })), 'stage [A]: the retirement report over the genuine inventory', { code: st.code, out: st.stdout.slice(0, 500) });
        check(readText(draftPath(root, RID, T_SETTINGS)) === retiredText(T, [A]), 'the draft is the installed object with A filtered out, in the installed style, one final newline, no BOM', clip(readText(draftPath(root, RID, T_SETTINGS))));
        const d0 = kit.diff(root, RID);
        const f0 = d0.json && d0.json.files && d0.json.files.find((f) => f.target === T_SETTINGS);
        check(d0.code === 0 && d0.json && d0.json.prepared === false && f0 && f0.action === 'modify' && f0.diff.split('\n').includes('-      "Bash(npm test)",') && d0.json.metadataRequests && eq(d0.json.metadataRequests.omissions, { [T_SETTINGS]: { 'permissions.allow': [A] } }), 'the unprepared diff shows the removal and the omission request', { code: d0.code, out: d0.stdout.slice(0, 300) });
        expectP(check, 'genuine prepare without approval', kit.prepare(root, RID), approvalEntry([R_ALLOW, R_SETTINGS, R_OMIT]));
        const filesBefore = readManifestFile(root).files;
        const p = okPrepare(check, 'genuine approved prepare', kit.prepare(root, RID, { approve: [T_SETTINGS] }));
        if (!p.json || p.json.ok !== true) return;
        const op = settingsOpOf(p);
        check(p.json.ops.length === 1 && op && op.userContentChange === true && eq(op.userContentReasons, [R_ALLOW]), 'exactly one operation: the settings content change with the allow-removal reason', p.json.ops);
        const mo = p.json.metadataOps || [];
        check(mo.length === 1 && mo[0].kind === 'file' && mo[0].target === T_SETTINGS && mo[0].requiresApproval === true && eq(mo[0].reasons, [R_SETTINGS, R_OMIT]), 'V3-base has exactly one metadata operation, the settings file operation, with the two reasons', mo);
        const b0 = mo[0] && mo[0].before; const a0 = mo[0] && mo[0].after;
        check(b0 && a0 && eq(b0.managed['permissions.allow'], [A, C, B]) && eq(a0.managed['permissions.allow'], [C, B]) && eq(a0.omissions, { 'permissions.allow': [A] }) && b0.omissions === undefined && eq({ ...a0.managed, 'permissions.allow': null }, { ...b0.managed, 'permissions.allow': null }), 'the managed allow list shrinks to [C, B], the omission is added, every other managed field is identical', mo[0]);
        const d1 = kit.diff(root, RID);
        check(d1.code === 0 && d1.json && d1.json.prepared === true && d1.json.planSha256 === p.json.planSha256, 'the prepared diff passes with the plan hash', { code: d1.code, out: d1.stdout.slice(0, 300) });
        commitOk(check, 'genuine present retirement', kit, root, RID, p.json.planSha256, [T_SETTINGS, T_MANIFEST]);
        check(readText(projPath(root, T_SETTINGS)) === retiredText(T, [A]), 'the installed settings are exactly the expected bytes', clip(readText(projPath(root, T_SETTINGS))));
        const rec = recordOf(root);
        check(rec && eq(rec.managed['permissions.allow'], [C, B]) && eq(rec.omissions, { 'permissions.allow': [A] }) && eq(rec.managed['permissions.deny'], filesBefore[T_SETTINGS].managed['permissions.deny']), 'the manifest record: C and B owned, the omission recorded, the deny ownership unchanged', rec);
        const after = readManifestFile(root).files;
        check(eq(Object.keys(after).filter((k) => k !== T_SETTINGS).map((k) => after[k]), Object.keys(filesBefore).filter((k) => k !== T_SETTINGS).map((k) => filesBefore[k])), 'every other manifest record is unchanged');
        check(JSON.parse(readText(projPath(root, T_SETTINGS))).permissions.allow.includes(U), 'the user rule U survives');

        // a new run with the omitted selection has nothing to do
        const rel = kit.release(root, RID);
        check(rel.code === 0, 'the first run releases its lock', rel.stdout.slice(0, 200));
        const R2 = 'run-c7-0002';
        if (!kit.begin(root, R2)) return;
        const settingsBytes = readBytes(projPath(root, T_SETTINGS));
        const manifestBytes = readBytes(manifestPath(root));
        const st2 = kit.retire(root, R2, SEL_A);
        check(st2.code === 0 && st2.json && st2.json.ok === true && st2.json.changed === false && st2.json.metadataChanged === false && st2.json.draft === null && eq(st2.json.report && st2.json.report.retirement.alreadyOmitted, [A]) && eq(st2.json.report.retirement.retired, []), 'selecting the omitted A in a new run is alreadyOmitted with no change', { code: st2.code, out: st2.stdout.slice(0, 500) });
        const p2 = okPrepare(check, 'no-op prepare', kit.prepare(root, R2));
        check(p2.json && p2.json.changed === 0 && p2.json.metadataChanged === 0, 'prepare finds no content and no metadata change and needs no settings approval', p2.json && { changed: p2.json.changed, metadataChanged: p2.json.metadataChanged });
        const un = kit.prepare(root, R2, { approve: [T_SETTINGS] });
        expectP(check, 'an approval for a no-op run', un, [{ target: T_SETTINGS, code: 'APPLY_APPROVAL_UNRELATED', error: MSG.UNRELATED }]);
        const p3 = okPrepare(check, 'no-op prepare again', kit.prepare(root, R2));
        const c2 = kit.commit(root, R2, p3.json && p3.json.planSha256);
        check(c2.code === 0 && c2.stderr === '' && c2.stdout === jsonText(NOOP_BODY), 'the genuine no-op commit prints exactly the zero-diff response', { code: c2.code, out: c2.stdout.slice(0, 300) });
        check(!exists(runFile(root, R2, 'journal.json')) && sameBytes(readBytes(projPath(root, T_SETTINGS)), settingsBytes) && sameBytes(readBytes(manifestPath(root)), manifestBytes), 'no journal, and the settings and manifest bytes are unchanged');

        // a user re-adds A after the retirement: it is preserved as a user rule
        check(kit.release(root, R2).code === 0, 'the second run releases its lock');
        editSettings(root, (s) => { s.permissions.allow = [...s.permissions.allow, A]; });
        const R3 = 'run-c7-0003';
        if (!kit.begin(root, R3)) return;
        const st3 = kit.retire(root, R3, SEL_A);
        check(st3.code === 0 && st3.json && st3.json.ok === true && st3.json.changed === false && st3.json.metadataChanged === false && st3.json.draft === null && eq(st3.json.report.retirement.alreadyOmitted, [A]), 'a re-added A is alreadyOmitted and is left alone', { code: st3.code, out: st3.stdout.slice(0, 500) });
        check(st3.json && st3.json.report && st3.json.report.allows.rules.some((r) => r.rule === A && r.ownership === 'user' && r.classification === 'repo-code') && eq(st3.json.report.allows.omitted, [A]), 'the report shows A as a user-owned repository-code rule and as an installed omission', st3.json && st3.json.report && st3.json.report.allows);
      });
    });
    flushProcessCount(context, 'R85/C7/transaction (genuine V3-base)');

    // --------------------------------------------- schema-2 conversion op ----
    await step('a retirement over a genuine schema-2 installation has the settings file operation plus the schema-conversion manifest operation', async () => {
      const v2 = await useV2(failures, context);
      if (!v2) return;
      await withScratch(context, 'v2txn', async (dir) => {
        const root = cloneTree(v2.root, path.join(dir, 'root'));
        if (!kit.begin(root, RID)) return;
        const st = kit.retire(root, RID, SEL_A);
        check(st.code === 0 && st.json && st.json.ok === true && st.json.changed === true, 'the retirement stages over the schema-2 installation', { code: st.code, out: st.stdout.slice(0, 300) });
        const p = okPrepare(check, 'schema-2 approved prepare', kit.prepare(root, RID, { approve: [T_SETTINGS] }));
        const mo = (p.json && p.json.metadataOps) || [];
        check(eq(mo.map((m) => m.kind), ['file', 'manifest']) && mo[0].target === T_SETTINGS && eq(mo[0].reasons, [R_SETTINGS, R_OMIT]), 'the metadata operations are the settings file operation, then the manifest operation', mo.map((m) => [m.kind, m.target]));
        check(mo[1] && mo[1].target === T_MANIFEST && mo[1].requiresApproval === false && mo[1].before && mo[1].before.schema === 2 && mo[1].after && mo[1].after.schema === 3, 'the manifest operation converts schema 2 to 3 and needs no approval of its own', mo[1]);
      });
    });

    // -------------------------------------------- layered C3, C6 and C7 ----
    await step('layered C3, C6 and C7: prepare needs exactly the policy and settings approvals; the settings reason is the allow removal alone; one commit installs the seven-member unit, E and H and the retirement', async () => {
      let g;
      try { g = await getLayered(context); } catch (e) { failures.push(`cannot build the layered scenario: ${errMsg(e)}`); return; }
      for (const f of g.fails) failures.push(`scenario build: ${f}`);
      if (!g.retire || g.retire.code !== 0 || !g.retire.json || g.retire.json.ok !== true) { check(false, 'the layered staging (C3, C6, C7) is required', g.retire && g.retire.stdout.slice(0, 300)); return; }
      await withScratch(context, 'lay', async (dir) => {
        const root = cloneTree(g.root, path.join(dir, 'root'));
        // without the settings approval the retirement is refused with its own reasons; C6 adds no approval
        const only = kit.prepare(root, LID, { approve: [T_POLICY] });
        expectP(check, 'policy approval only', only, approvalEntry([R_ALLOW, R_SETTINGS, R_OMIT]));
        const p = okPrepare(check, 'layered prepare', kit.prepare(root, LID, { approve: [T_POLICY, T_SETTINGS] }));
        if (!p.json || p.json.ok !== true) return;
        const op = settingsOpOf(p);
        check(op && op.userContentChange === true && eq(op.userContentReasons, [R_ALLOW]), 'the settings operation carries the allow-removal reason only: the canonical hook append is exempt', op);
        const mo = p.json.metadataOps || [];
        const so = mo.find((m) => m.kind === 'file' && m.target === T_SETTINGS);
        check(so && eq(so.reasons, [R_SETTINGS, R_OMIT]) && mo.some((m) => m.kind === 'manifest') && mo.some((m) => m.kind === 'file' && m.target === T_POLICY), 'the metadata operations are the settings file operation (two reasons), the policy migration operation and the schema-conversion manifest operation', mo.map((m) => [m.kind, m.target, m.reasons]));
        const pd = kit.diff(root, LID);
        check(pd.code === 0 && pd.json && pd.json.ok === true && pd.json.prepared === true, 'the prepared diff passes', { code: pd.code, out: pd.stdout.slice(0, 300) });
        const c = kit.commit(root, LID, p.json.planSha256);
        check(c.code === 0 && c.json && c.json.committed === true, 'commit succeeds with the approved hash', { code: c.code, out: c.stdout.slice(0, 400) });
        const written = (c.json && c.json.written || []).map((w) => w.target);
        check(UNIT.every((t) => written.includes(t)) && written.includes(T_SETTINGS) && written.includes(T_POLICY) && written[written.length - 1] === T_MANIFEST && written.indexOf(T_SETTINGS) < written.indexOf(T_MANIFEST), 'one transaction writes the seven runtime members, the settings and the policy, and the manifest last', written);
        for (const t of UNIT) check(NH(readBytes(projPath(root, t)) || '') === NH(tb[t]), `${t}: installed equal to its trusted source`);
        const inst = readJson(projPath(root, T_SETTINGS));
        const draft = g.afterRetire.draft;
        check(inst && draft && eq(inst, draft) && eq(inst.permissions.allow, [C, B]) && eq(inst.hooks.PreToolUse[inst.hooks.PreToolUse.length - 1], E) && eq(inst.permissions.deny, g.c3.draft.permissions.deny), 'the installed settings are the staged draft: allow [C, B], E last in PreToolUse, C3\'s deny array', inst && Object.keys(inst));
        const rec = recordOf(root);
        const staged = g.afterRetire.managed[T_SETTINGS];
        check(rec && eq(rec.managed['permissions.allow'], [C, B]) && eq(rec.managed.hooks, [H]) && eq(rec.managed['permissions.deny'], staged['permissions.deny']) && eq(rec.managed.heldBack, staged.heldBack) && eq(rec.omissions, { 'permissions.allow': [A] }), 'the manifest record: reduced allow ownership, H, C3\'s deny ownership and heldBack, and the omission', rec);
        const man = readManifestFile(root);
        check(man && man.schema === 3 && UNIT.every((t) => man.files[t] && man.files[t].ownership === 'full') && man.files[T_POLICY].ownership === 'keys', 'the manifest is schema 3, records the seven members as full and the policy as keys', man && Object.keys(man.files));
      });
    });
    flushProcessCount(context, 'R85/C7/transaction (layered)');

    // ------------------------------------------- isolated C6 interaction ----
    await step('isolated C6 interaction over S and F with the seven reviewed members staged: hook only, hook plus present A, hook plus absent A, and a noncanonical hook mutation', async () => {
      await withScratch(context, 'c6mix', async (dir) => {
        let m = 0;
        const OWN_FULL = Object.fromEntries(UNIT.map((t) => [t, 'full']));
        const scenario = (label, edit = null) => {
          const root = cloneTree(base.root, path.join(dir, `${label}-${++m}`));
          if (edit) edit(root);
          stageUnit(root, RID, tb);
          putRequest(root, RID, 'ownership.json', OWN_FULL);
          const h = kit.hooksOnly(root, RID);
          check(h.code === 0 && h.json && h.json.ok === true && eq(h.json.report && h.json.report.hooks && h.json.report.hooks.added, [H]), `${label}: hooks-only stages the managed hook`, { code: h.code, out: h.stdout.slice(0, 300) });
          return root;
        };
        // 1. hook only: no settings approval
        const a = scenario('hook-only');
        const pa = okPrepare(check, 'hook only', kit.prepare(a, RID));
        const oa = settingsOpOf(pa);
        check(oa && oa.userContentChange === false && eq(oa.userContentReasons, []), 'hook only: userContentChange false and no reasons, no settings approval', oa);
        // 2. hook plus present A
        const b = scenario('hook-present');
        const sb = kit.retire(b, RID, SEL_A);
        check(sb.code === 0 && sb.json && sb.json.ok === true && sb.json.changed === true, 'hook plus present A: the retirement stages after hooks-only', { code: sb.code, out: sb.stdout.slice(0, 300) });
        expectP(check, 'hook plus present A without approval', kit.prepare(b, RID), approvalEntry([R_ALLOW, R_SETTINGS, R_OMIT]));
        const pb = okPrepare(check, 'hook plus present A, approved', kit.prepare(b, RID, { approve: [T_SETTINGS] }));
        const ob = settingsOpOf(pb);
        check(ob && ob.userContentChange === true && eq(ob.userContentReasons, [R_ALLOW]), 'hook plus present A: true with the exact allow-removal reason (the hook append is exempt, the removal is not)', ob);
        // 3. hook plus absent A
        const c = scenario('hook-absent', (r) => putFile(projPath(r, T_SETTINGS), J(mkS([U, C, B]))));
        const sc = kit.retire(c, RID, SEL_A);
        check(sc.code === 0 && sc.json && sc.json.ok === true && sc.json.metadataChanged === true, 'hook plus absent A: the retirement stages after hooks-only', { code: sc.code, out: sc.stdout.slice(0, 300) });
        expectP(check, 'hook plus absent A without approval', kit.prepare(c, RID), metaEntry());
        const pc = okPrepare(check, 'hook plus absent A, approved', kit.prepare(c, RID, { approve: [T_SETTINGS] }));
        const oc = settingsOpOf(pc);
        check(oc && oc.userContentChange === false && eq(oc.userContentReasons, []), 'hook plus absent A: the content stays exempt, no hooks reason appears', oc);
        // 4. a noncanonical hook mutation keeps C6's hooks reason
        const d = scenario('hook-mutated');
        const sd = kit.retire(d, RID, SEL_A);
        check(sd.code === 0 && sd.json && sd.json.ok === true, 'a noncanonical mutation: the retirement stages', { code: sd.code, out: sd.stdout.slice(0, 300) });
        const dp = draftPath(d, RID, T_SETTINGS);
        const dj = readJson(dp);
        if (dj && dj.hooks && Array.isArray(dj.hooks.PreToolUse)) {
          const last = dj.hooks.PreToolUse[dj.hooks.PreToolUse.length - 1];
          last.hooks[0].command = `${H.command} `;
          putFile(dp, ser(dj));
        } else check(false, 'the staged draft has the hook entry to mutate', dj && Object.keys(dj));
        const rd = kit.prepare(d, RID);
        const errs = rd.json && rd.json.errors;
        // PLAN-GAP: with a noncanonical hook change next to an allow removal, the plan pins only that the hooks reason is retained; whether the allow-removal reason is also
        // listed is not pinned, so the entry must begin with the hooks reason and carry both metadata reasons and the standard suffix.
        check(rd.code === 3 && rd.stderr === '' && rd.json && rd.json.code === 'APPLY_PLAN_REJECTED' && Array.isArray(errs) && errs.length === 1 && errs[0].target === T_SETTINGS && errs[0].code === 'APPLY_APPROVAL_REQUIRED' && errs[0].error.startsWith(`${R_HOOKS}; `) && errs[0].error.includes(R_SETTINGS) && errs[0].error.includes(R_OMIT) && errs[0].error.endsWith(`. ${approvalSuffix(T_SETTINGS)}`), 'a noncanonical hook change keeps the hooks reason first, with the metadata reasons', { code: rd.code, out: rd.stdout.slice(0, 600) });
        const rda = okPrepare(check, 'noncanonical mutation, approved', kit.prepare(d, RID, { approve: [T_SETTINGS] }));
        const od = settingsOpOf(rda);
        check(od && od.userContentChange === true && Array.isArray(od.userContentReasons) && od.userContentReasons[0] === R_HOOKS, 'the approved operation lists the hooks reason', od);
      });
    });
    flushProcessCount(context, 'R85/C7/transaction');
  });
}

// ============================================== R86/C7/reconciliation ====
// Plan 4.8: an already-absent allow reconciles through an explicit metadata operation that needs the same approval, writes only the manifest and leaves the
// settings bytes alone; a mixed selection is one content change and one metadata operation in one transaction.
async function reconciliationGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const base = await useBase(failures, context);
    if (!base) return;
    const kit = makeKit(context, check);
    await withScratch(context, 'recon', async (dir) => {
      await step('synthetic S1 with F unchanged: the unapproved prepare is the exact metadata-only entry; the approved plan has no content operation and the literal metadata operation; commit backs up and writes only the manifest', async () => {
        const root = cloneTree(base.root, path.join(dir, 'syn'));
        const s1 = J(mkS([U, C, B]));
        putFile(projPath(root, T_SETTINGS), s1);
        const st = kit.retire(root, RID, SEL_A);
        check(st.code === 0 && st.json && st.json.ok === true && st.json.changed === false && st.json.metadataChanged === true && st.json.draft === null, 'the retirement of an absent A stages metadata only', { code: st.code, out: st.stdout.slice(0, 300) });
        const before = outsideRunSnapshot(root);
        expectP(check, 'absent A without approval', kit.prepare(root, RID), metaEntry());
        check(!exists(runFile(root, RID, 'plan.json')) && outsideRunSnapshot(root) === before, 'a rejected prepare writes no plan and changes no installed byte');
        const p = okPrepare(check, 'absent A, approved', kit.prepare(root, RID, { approve: [T_SETTINGS] }));
        if (!p.json || p.json.ok !== true) return;
        check(eq(p.json.ops, []) && p.json.changed === 0 && p.json.metadataChanged === 1 && eq(p.json.metadataOps, [META_OP_A()]), 'no settings content operation and the same literal metadata operation as a present A', { ops: p.json.ops, metadataOps: p.json.metadataOps });
        const c = commitOk(check, 'metadata-only retirement', kit, root, RID, p.json.planSha256, [T_MANIFEST]);
        void c;
        check(readText(projPath(root, T_SETTINGS)) === s1, 'the settings raw bytes are identical');
        check(exists(path.join(root, '.ai', '.run', RID, 'vault', 'backup', '.ai', 'manifest.json')) && !exists(path.join(root, '.ai', '.run', RID, 'vault', 'backup', '.claude', 'settings.json')), 'only the manifest was backed up');
        const rec = recordOf(root);
        check(rec && JSON.stringify(rec) === JSON.stringify({ ownership: 'keys', managed: mkM([C, B]), omissions: { 'permissions.allow': [A] } }), 'the manifest records the reduced ownership and the omission', rec);
        check(!exists(draftPath(root, RID, T_SETTINGS)), 'no settings draft was ever created');
      });

      // ------------------------------------------------------- genuine V3-base ----
      const v3 = await useV3(failures, context);
      if (!v3) return;
      await step('genuine V3-base, absent A: missing approval gives the exact metadata-only entry, the approved commit writes only the manifest, settings stay identical, and a new-run normal merge never restores the omitted allow', async () => {
        const root = cloneTree(v3.root, path.join(dir, 'abs'));
        editSettings(root, (s) => { s.permissions.allow = [U, C, B]; });
        const T = readBytes(projPath(root, T_SETTINGS));
        if (!kit.begin(root, RID)) return;
        const st = kit.retire(root, RID, SEL_A);
        check(st.code === 0 && st.json && st.json.ok === true && st.json.changed === false && st.json.metadataChanged === true && st.json.draft === null && eq(st.json.report.retirement, RET({ listed: [I(A, false, 'repo-code', 'warn'), I(C, true, 'other', 'none'), I(B, true, 'repo-code', 'warn')], alreadyAbsent: [A], retained: [C, B] })), 'stage [A] over a genuine installation where A is already gone', { code: st.code, out: st.stdout.slice(0, 500) });
        expectP(check, 'genuine absent A without approval', kit.prepare(root, RID), metaEntry());
        const p = okPrepare(check, 'genuine absent A, approved', kit.prepare(root, RID, { approve: [T_SETTINGS] }));
        if (!p.json || p.json.ok !== true) return;
        const mo = p.json.metadataOps || [];
        check(p.json.ops.length === 0 && mo.length === 1 && mo[0].kind === 'file' && mo[0].target === T_SETTINGS && eq(mo[0].reasons, [R_SETTINGS, R_OMIT]) && eq(mo[0].after.managed['permissions.allow'], [C, B]) && eq(mo[0].after.omissions, { 'permissions.allow': [A] }), 'no content operation and exactly one settings file metadata operation', { ops: p.json.ops, metadataOps: mo });
        commitOk(check, 'genuine metadata-only retirement', kit, root, RID, p.json.planSha256, [T_MANIFEST]);
        check(sameBytes(readBytes(projPath(root, T_SETTINGS)), T), 'the settings raw bytes are identical');
        check(exists(path.join(root, '.ai', '.run', RID, 'vault', 'backup', '.ai', 'manifest.json')) && !exists(path.join(root, '.ai', '.run', RID, 'vault', 'backup', '.claude', 'settings.json')), 'only the manifest was backed up');
        // a new run: the normal merge does not restore the omitted allow
        check(kit.release(root, RID).code === 0, 'the first run releases its lock');
        const R2 = 'run-c7-0002';
        if (!kit.begin(root, R2)) return;
        const mg = kit.merge(root, ['--run-id', R2]);
        check(mg.code === 0 && mg.json && mg.json.ok === true && mg.stderr === '', 'the new-run normal merge succeeds (no order guard: the pending retirement was committed)', { code: mg.code, out: mg.stdout.slice(0, 300) });
        const draft = readJson(draftPath(root, R2, T_SETTINGS));
        // The merge writes a draft only when the settings values change (an installation whose deny list is complete leaves none), so an absent draft is as good as an unchanged allow list.
        const live = draft !== null ? draft : readJson(projPath(root, T_SETTINGS));
        check(live && eq(live.permissions.allow, [U, C, B]), 'the omitted allow A is not restored: the draft (or, with no draft, the installed settings) keeps allow [U, C, B]', live && live.permissions && live.permissions.allow);
        check(mg.json && mg.json.report && eq(mg.json.report.allows.omitted, [A]) && !mg.json.report.allows.rules.some((r) => r.rule === A) && eq(mg.json.report.allows.managed.map((r) => r.rule), [C, B]) && eq(mg.json.report.added.allow, []), 'the report shows the omission, no A rule and the reduced inventory', mg.json && mg.json.report && mg.json.report.allows);
        const keys = readJson(runFile(root, R2, 'managed-keys.json'));
        check(keys && keys[T_SETTINGS] && !hasOwn(keys[T_SETTINGS], 'permissions.allow'), 'the merge requests no permissions.allow', keys && keys[T_SETTINGS] && Object.keys(keys[T_SETTINGS]));
      });
      await step('mixed R86 case over V3-base, B absent and A present, selection [A, B]: one content change and one metadata operation, one approval, the journal writes the settings then the manifest', async () => {
        const root = cloneTree(v3.root, path.join(dir, 'mixed'));
        editSettings(root, (s) => { s.permissions.allow = [U, A, C]; });
        const T = readText(projPath(root, T_SETTINGS));
        if (!kit.begin(root, RID)) return;
        const st = kit.retire(root, RID, [A, B]);
        check(st.code === 0 && st.json && st.json.ok === true && st.json.changed === true && st.json.metadataChanged === true && eq(st.json.report.retirement, RET({ listed: [I(A, true, 'repo-code', 'warn'), I(C, true, 'other', 'none'), I(B, false, 'repo-code', 'warn')], retired: [A], alreadyAbsent: [B], retained: [C] })), 'stage [A, B]: retired [A], alreadyAbsent [B], retained [C]', { code: st.code, out: st.stdout.slice(0, 500) });
        check(eq(readJson(runFile(root, RID, 'omissions.json')), { [T_SETTINGS]: { 'permissions.allow': [A, B] } }) && eq(readJson(runFile(root, RID, 'managed-keys.json'))[T_SETTINGS]['permissions.allow'], [C]), 'the new omissions are [A, B] and the managed allows [C]', { om: readJson(runFile(root, RID, 'omissions.json')) });
        expectP(check, 'mixed selection without approval', kit.prepare(root, RID), approvalEntry([R_ALLOW, R_SETTINGS, R_OMIT]));
        const p = okPrepare(check, 'mixed selection, approved once', kit.prepare(root, RID, { approve: [T_SETTINGS] }));
        if (!p.json || p.json.ok !== true) return;
        const op = settingsOpOf(p);
        const mo = p.json.metadataOps || [];
        check(p.json.ops.length === 1 && op && op.userContentChange === true && eq(op.userContentReasons, [R_ALLOW]) && mo.length === 1 && mo[0].kind === 'file' && mo[0].target === T_SETTINGS && eq(mo[0].after.managed['permissions.allow'], [C]) && eq(mo[0].after.omissions, { 'permissions.allow': [A, B] }), 'one settings content change and one settings metadata operation; one approval covers both', { ops: p.json.ops, metadataOps: mo });
        commitOk(check, 'mixed retirement', kit, root, RID, p.json.planSha256, [T_SETTINGS, T_MANIFEST]);
        check(readText(projPath(root, T_SETTINGS)) === retiredText(T, [A, B]), 'the settings before and after differ only by the removal of A', clip(readText(projPath(root, T_SETTINGS))));
        const rec = recordOf(root);
        check(rec && eq(rec.managed['permissions.allow'], [C]) && eq(rec.omissions, { 'permissions.allow': [A, B] }), 'the manifest records [C] as managed and [A, B] as omitted', rec);
      });
    });
    flushProcessCount(context, 'R86/C7/reconciliation');
  });
}

// ============================================ R86/C7/binding-rollback ====
// Plan 4.10: the approved plan binds the settings, the request files and the manifest; rollback restores the exact bytes through the same journal, and never an
// edit made after the commit. Existing C2 envelopes are used; apply failures are not wrapped in C7 envelopes.
async function bindingGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const base = await useBase(failures, context);
    if (!base) return;
    const kit = makeKit(context, check);
    await withScratch(context, 'bind', async (dir) => {
      let n = 0;
      const fresh = (label) => cloneTree(base.root, path.join(dir, `${label}-${++n}`));
      // A staged and prepared retirement; absent selects the metadata-only variant (A already gone from the installed settings).
      const prepared = (label, o = {}) => {
        const root = fresh(label);
        if (o.absent) putFile(projPath(root, T_SETTINGS), J(mkS([U, C, B])));
        const st = kit.retire(root, RID, SEL_A);
        const p = kit.prepare(root, RID, { approve: [T_SETTINGS] });
        check(st.code === 0 && st.json && st.json.ok === true && p.code === 0 && p.json && p.json.ok === true, `${label}: the retirement stages and prepares with the settings approval`, { stage: st.stdout.slice(0, 200), prepare: p.stdout.slice(0, 300) });
        return { root, sha: p.json && p.json.planSha256, settings: readBytes(projPath(root, T_SETTINGS)), manifest: readBytes(manifestPath(root)) };
      };
      const expectDrift = (label, r, what, target) => {
        check(r.code === 4 && r.stderr === '' && r.json && r.json.ok === false && r.json.code === 'APPLY_DRIFT' && r.json.error === MSG.DRIFT && Array.isArray(r.json.drift) && r.json.drift.some((d) => d.what === what && (target === undefined || d.target === target)), `${label}: exit 4, APPLY_DRIFT, the existing drift text and "${what}"`, { code: r.code, out: r.stdout.slice(0, 500) });
      };
      await step('settings changed after prepare: exit 4, APPLY_DRIFT with "target changed since prepare", for commit and for the prepared diff; no journal and no project write', async () => {
        const p = prepared('drift-settings');
        putFile(projPath(p.root, T_SETTINGS), ser({ ...mkS(), late: { edit: 1 } }));
        const snap = projectSnapshot(p.root);
        expectDrift('commit', kit.commit(p.root, RID, p.sha), 'target changed since prepare', T_SETTINGS);
        expectDrift('prepared diff', kit.diff(p.root, RID), 'target changed since prepare', T_SETTINGS);
        check(!exists(runFile(p.root, RID, 'journal.json')) && projectSnapshot(p.root) === snap, 'the refusals wrote no journal and no byte');
      });
      await step('omission request changed after prepare: exit 4, APPLY_DRIFT with "manifest metadata changed after prepare (unreviewed ownership)"; no journal and no project write', async () => {
        const p = prepared('drift-request');
        putRequest(p.root, RID, 'omissions.json', { [T_SETTINGS]: { 'permissions.allow': [A, B] } });
        const snap = projectSnapshot(p.root);
        expectDrift('commit', kit.commit(p.root, RID, p.sha), 'manifest metadata changed after prepare (unreviewed ownership)', 'omissions.json');
        check(!exists(runFile(p.root, RID, 'journal.json')) && projectSnapshot(p.root) === snap, 'the refusal wrote no journal and no byte');
        check(sameBytes(readBytes(projPath(p.root, T_SETTINGS)), p.settings) && sameBytes(readBytes(manifestPath(p.root)), p.manifest), 'the installed settings and manifest are the pre-commit bytes');
      });
      await step('content rollback restores the exact original settings and manifest bytes through the same journal', async () => {
        const p = prepared('rollback-content');
        const c = kit.commit(p.root, RID, p.sha);
        check(c.code === 0 && c.json && c.json.committed === true, 'commit succeeds', { code: c.code, out: c.stdout.slice(0, 300) });
        check(!sameBytes(readBytes(projPath(p.root, T_SETTINGS)), p.settings) && !sameBytes(readBytes(manifestPath(p.root)), p.manifest), 'control: the commit changed both files');
        const rb = kit.rollback(p.root, RID);
        check(rb.code === 0 && rb.stderr === '' && rb.json && rb.json.ok === true && rb.json.complete === true && eq(sorted(rb.json.restored || []), sorted([T_SETTINGS, T_MANIFEST])), 'rollback completes and restores the settings and the manifest', { code: rb.code, out: rb.stdout.slice(0, 300) });
        check(sameBytes(readBytes(projPath(p.root, T_SETTINGS)), p.settings) && sameBytes(readBytes(manifestPath(p.root)), p.manifest), 'the exact original settings and manifest bytes are back');
      });
      await step('metadata-only rollback restores the manifest only; the settings are never touched', async () => {
        const p = prepared('rollback-meta', { absent: true });
        const c = kit.commit(p.root, RID, p.sha);
        check(c.code === 0 && c.json && c.json.committed === true && eq((c.json.written || []).map((w) => w.target), [T_MANIFEST]), 'commit writes only the manifest', { code: c.code, out: c.stdout.slice(0, 300) });
        const rb = kit.rollback(p.root, RID);
        check(rb.code === 0 && rb.json && rb.json.complete === true && eq(rb.json.restored, [T_MANIFEST]), 'rollback restores only the manifest', { code: rb.code, out: rb.stdout.slice(0, 300) });
        check(sameBytes(readBytes(manifestPath(p.root)), p.manifest) && sameBytes(readBytes(projPath(p.root, T_SETTINGS)), p.settings), 'the manifest is back to its original bytes and the settings are identical throughout');
      });
      await step('a later settings edit survives rollback: exit 6, the edit is kept byte for byte, the backups are retained', async () => {
        const p = prepared('rollback-later');
        const c = kit.commit(p.root, RID, p.sha);
        check(c.code === 0 && c.json && c.json.committed === true, 'commit succeeds', { code: c.code, out: c.stdout.slice(0, 300) });
        const later = ser({ ...JSON.parse(readText(projPath(p.root, T_SETTINGS))), later: { edit: true } });
        putFile(projPath(p.root, T_SETTINGS), later);
        const rb = kit.rollback(p.root, RID);
        check(rb.code === 6 && rb.stderr === '' && rb.json && rb.json.ok === false, 'rollback after a later edit is incomplete: exit 6', { code: rb.code, out: rb.stdout.slice(0, 300) });
        check(readText(projPath(p.root, T_SETTINGS)) === later, 'the later edit is preserved byte for byte');
        const backup = readBytes(path.join(p.root, '.ai', '.run', RID, 'vault', 'backup', '.claude', 'settings.json'));
        check(sameBytes(backup, p.settings), 'the settings backup is retained and holds the original bytes');
      });
    });
    flushProcessCount(context, 'R86/C7/binding-rollback');
  });
}

// ===================================================== V2/C7/contracts ====
const protectPolicy = (glob) => jsonText({ schema: 2, patterns: [{ anchor: 'any', glob: '**/.env*' }], projectPatterns: [{ anchor: 'root', glob }] });
// Plan 3.11: the quoted paragraphs, as single lines; the leading "> " and the line breaks of the plan are whitespace and collapse the same way.
const PARAS_CLAUDE = [
  'Shared allow rules can run repository code without another prompt. Project-setup classifies package runners, interpreters and local executable paths as repository-code execution. These rules produce warnings whether managed or user-owned. Broad shell allows fail classification when managed and warn when user-owned. Other rules produce no classification finding; that is not a safety certification.',
  'If a developer accepts a warned permission on their own machine, move it to `.claude/settings.local.json`. That file is personal and is not managed by project-setup. Its permissions do not protect the team. The classifier is a lexical warning mechanism, not a sandbox.',
  'Project-setup MUST NOT add managed allows through the v3 merge workflow. Existing managed allows MUST remain unchanged unless selected for retirement and approved through apply.',
];
const PARAS_STATE = [
  'Allow omissions identify exact permission strings. They are separate from managed ownership. Retiring an allow removes only its selected managed identity and records its omission in the same reviewed transaction. An already-absent allow uses an explicit metadata operation and still requires approval for `.claude/settings.json`. Unselected and user-owned rules remain.',
  'Stage policy and deny changes first, hooks second, and allow retirement last. Use `merge-claude-settings.mjs --run-id <id> --retire-allow-file <path>` with a selection file inside the project and outside setup draft and vault directories. Normal merge refuses a pending allow-omission request. Start a new run to amend a pending retirement selection.',
  'Staging is not approval. Review both content and metadata with apply diff, prepare with the required path approvals, and approve the resulting plan hash. Metadata-only retirement leaves settings bytes unchanged. Rollback restores ownership and omissions through the same journal, subject to protection for later edits. An already-omitted identity is not restored on rerun.',
];
// The C2 paragraphs of references/state-and-apply.md that plan 3.11 says to preserve verbatim (draft review, and the zero-diff paragraph).
const KEEP_STATE = [
  'Review drafts with the apply command. It renders target-versus-draft differences in-process without invoking Git, including during root discovery. The explicit project root is checked through the filesystem. Review does not acquire or refresh a lock, create directories, write a plan, or initialize a journal.',
  'Before prepare, this is an unapproved preview. After prepare, the report identifies planSha256 and refuses changed inputs. Vault files appear only as key names and value classifications. Review metadata operations even when the affected file bytes are unchanged. Any changed input requires a new prepare and approval.',
  'A genuine no-op has neither content writes nor metadata operations. Commit still requires this run\'s lock and rechecks the prepared inputs. It leaves project files, manifest bytes and lock bytes unchanged and creates no journal. An ownership, omission, snippet or schema change can be a metadata operation even when every content operation is unchanged.',
];
const needSibling = (failures, rel) => importOrFail(failures, new URL(rel, import.meta.url).href, `tests/${rel}`);

async function contractsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    // ------------------------------------------------ exports and imports ----
    await step('the classifier and the merge module export exactly their sets and import safely; the classifier is distribution-only and is not part of the runtime unit', async () => {
      await withScratch(context, 'probe', async (dir) => {
        checkImportSafe(check, CLASSIFY_REL, context, dir, scriptUrl(context, 'classify-allows.mjs'), CLASSIFY_EXPORTS);
        checkImportSafe(check, MERGE_REL, context, dir, scriptUrl(context, 'merge-claude-settings.mjs'), MERGE_EXPORTS);
      });
      const catalog = readJson(path.join(context.skillRoot, T_CATALOG));
      check(eq(catalog, CATALOG_PRODUCTION), 'data/runtime-units.json is unchanged: the seven-row catalog', catalog);
      const toolsDir = path.join(context.skillRoot, 'assets', 'tools');
      const names = (() => { try { return fs.readdirSync(toolsDir); } catch { return []; } })();
      check(!names.some((x) => /classify-allows/.test(x)), 'no classifier file ships under assets/tools', names);
      const importing = names.filter((x) => /\.mjs$/.test(x)).filter((x) => /classify-allows/.test(readText(path.join(toolsDir, x)) || ''));
      check(importing.length === 0, 'no installed tool imports or names the classifier', importing);
    });
    await step('this module exports exactly C7_IMPLEMENTATIONS', async () => {
      const own = await attempt(() => import(import.meta.url));
      check(!own.threw && eq(Object.keys(own.value), ['C7_IMPLEMENTATIONS']), 'tests/c7.test.mjs exports exactly C7_IMPLEMENTATIONS', own.threw ? errMsg(own.error) : Object.keys(own.value));
    });

    // ------------------------------------------------------ reference text ----
    await step('references: each quoted paragraph of plan 3.11 occurs in its file as an exact whitespace-normalized substring, and the C2 paragraphs it preserves are still there', async () => {
      const claude = readText(path.join(context.skillRoot, ...REF_CLAUDE.split('/')));
      const state = readText(path.join(context.skillRoot, ...REF_STATE.split('/')));
      if (claude === null || state === null) { check(false, 'both reference files are readable', { claude: claude !== null, state: state !== null }); return; }
      const nc = squash(claude);
      const ns = squash(state);
      PARAS_CLAUDE.forEach((p, i) => check(nc.includes(squash(p)), `${REF_CLAUDE}: paragraph ${i + 1} of plan 3.11 occurs verbatim`, clip(p)));
      PARAS_STATE.forEach((p, i) => check(ns.includes(squash(p)), `${REF_STATE}: paragraph ${i + 1} of plan 3.11 occurs verbatim`, clip(p)));
      KEEP_STATE.forEach((p, i) => check(ns.includes(squash(p)), `${REF_STATE}: the preserved C2 paragraph ${i + 1} is unchanged`, clip(p)));
    });

    // ----------------------------------------------------- the error table ----
    const base = await useBase(failures, context);
    if (base) {
      const kit = makeKit(context, check);
      await withScratch(context, 'errors', async (dir) => {
        let n = 0;
        const fresh = (label) => cloneTree(base.root, path.join(dir, `${label}-${++n}`));
        const selPath = (root) => path.join(root, ...SELECTION_REL.split('/'));
        // A clone with a selection of [A] already written; setup may change anything else.
        const errRoot = (label, setup = null, selection = SEL_A) => {
          const root = fresh(label);
          if (selection !== null) putFile(selPath(root), jsonText(selection));
          if (setup) setup(root);
          return root;
        };
        const stage = (root, o = {}) => kit.retire(root, RID, undefined, o);
        const mkT = runRel(RID, 'managed-keys.json');
        const omT = runRel(RID, 'omissions.json');
        const ownT = runRel(RID, 'ownership.json');
        const lenientFail = (label, r, codes) => {
          check(r.code === 1 && r.stderr === '' && r.json && r.json.ok === false && r.stdout === jsonText(r.json) && (codes === null || codes.includes(r.json.code)), `${label}: exit 1 with a JSON failure and empty stderr`, { code: r.code, out: r.stdout.slice(0, 300), err: r.stderr.slice(0, 200) });
        };

        await step('ALLOW_STAGE_USAGE (exit 1, target null): duplicate, positional, missing-value, unknown and conflicting options leave every byte untouched; a reserved run ID keeps the generic failure', async () => {
          const root = errRoot('usage');
          const sel = SELECTION_REL;
          const before = projectSnapshot(root);
          const argvs = [
            ['--run-id', RID, '--retire-allow-file', sel, '--retire-allow-file', sel], ['--run-id', RID, '--run-id', RID, '--retire-allow-file', sel],
            ['--run-id', RID, '--retire-allow-file', sel, 'positional'], ['--run-id', RID, '--retire-allow-file'], ['--retire-allow-file', '--run-id', RID],
            ['--run-id', RID, '--retire-allow-file', sel, '--bogus'], ['--run-id', RID, '--retire-allow-file', sel, '--allow-file', sel],
            ['--run-id', RID, '--retire-allow-file', sel, '--override-user-exceptions'],
          ];
          for (const argv of argvs) expectStageErr(check, `usage ${argv.join(' ')}`, kit.merge(root, argv), { code: 'ALLOW_STAGE_USAGE', exit: 1, error: ST.USAGE, target: null });
          // PLAN-GAP: with --hooks-only the plan only says the combination is rejected; the hooks-only parser may answer with its own usage code, and a missing --run-id is
          // "existing run-ID validation" territory. Only exit 1, a JSON failure and empty stderr are asserted for those two.
          lenientFail('--retire-allow-file with --hooks-only', kit.merge(root, ['--run-id', RID, '--retire-allow-file', sel, '--hooks-only']), ['ALLOW_STAGE_USAGE', 'HOOK_STAGE_USAGE']);
          lenientFail('--retire-allow-file without --run-id', kit.merge(root, ['--retire-allow-file', sel]), null);
          const reserved = kit.merge(root, ['--run-id', 'review', '--retire-allow-file', sel]);
          check(reserved.code === 1 && reserved.stderr === '' && reserved.stdout === GENERIC_RESERVED_OUT, 'the reserved review run ID keeps the existing generic failure (C5)', { code: reserved.code, out: reserved.stdout.slice(0, 200) });
          check(projectSnapshot(root) === before, 'no usage failure wrote anything');
        });
        await step('ALLOW_STAGE_JSON (exit 3): invalid installed settings, draft, selection and request files name the exact path and write nothing', async () => {
          const cases = [
            ['installed settings that are not JSON', (r) => putFile(projPath(r, T_SETTINGS), '{'), T_SETTINGS],
            ['a staged settings draft that is not JSON', (r) => putDraft(r, RID, T_SETTINGS, '{'), draftRel(RID)],
            ['a selection that is not JSON', (r) => putFile(selPath(r), '{'), SELECTION_REL],
            ['an ownership request that is not JSON', (r) => putRequest(r, RID, 'ownership.json', '{'), ownT],
            ['a managed-keys request that is not JSON', (r) => putRequest(r, RID, 'managed-keys.json', '{'), mkT],
            ['an omissions request that is not JSON', (r) => putRequest(r, RID, 'omissions.json', '{'), omT],
          ];
          for (const [label, setup, target] of cases) {
            const root = errRoot('json', setup);
            const before = projectSnapshot(root);
            expectStageErr(check, label, stage(root), { code: 'ALLOW_STAGE_JSON', exit: 3, error: ST.JSON(target), target });
            check(projectSnapshot(root) === before, `${label}: no file changed`);
          }
        });
        await step('ALLOW_STAGE_METADATA (exit 3): an invalid request structure, typed metadata or ownership names the request file and writes nothing', async () => {
          const cases = [
            ['a managed-keys request that is an array', (r) => putRequest(r, RID, 'managed-keys.json', []), mkT],
            ['a managed allow field that is not a string array', (r) => putRequest(r, RID, 'managed-keys.json', { [T_SETTINGS]: { 'permissions.allow': 'x' } }), mkT],
            ['an unknown managed field', (r) => putRequest(r, RID, 'managed-keys.json', { [T_SETTINGS]: { extra: [] } }), mkT],
            ['an omissions request that is an array', (r) => putRequest(r, RID, 'omissions.json', []), omT],
            ['a repeated allow omission', (r) => putRequest(r, RID, 'omissions.json', { [T_SETTINGS]: { 'permissions.allow': [A, A] } }), omT],
            ['an ownership request that is an array', (r) => putRequest(r, RID, 'ownership.json', []), ownT],
            ['a conflicting ownership request "full"', (r) => putRequest(r, RID, 'ownership.json', { [T_SETTINGS]: 'full' }), ownT],
          ];
          for (const [label, setup, target] of cases) {
            const root = errRoot('meta', setup);
            const before = projectSnapshot(root);
            expectStageErr(check, label, stage(root), { code: 'ALLOW_STAGE_METADATA', exit: 3, error: ST.METADATA(target), target });
            check(projectSnapshot(root) === before, `${label}: no file changed`);
          }
        });
        await step('ALLOW_STAGE_MANIFEST (exit 3): an unparseable manifest, a manifest of the right schema with no fields and invalid managed metadata name .ai/manifest.json', async () => {
          const bad = [['an unparseable manifest', '{'], ['a schema-3 manifest with no fields', '{"schema":3}\n'], ['managed metadata with an unknown field', jsonText(mkF({ managed: { ...mkM(), extra: ['x'] } }))]];
          for (const [label, body] of bad) {
            const root = errRoot('manifest', (r) => putFile(manifestPath(r), body));
            const before = projectSnapshot(root);
            expectStageErr(check, label, stage(root), { code: 'ALLOW_STAGE_MANIFEST', exit: 3, error: ST.MANIFEST, target: T_MANIFEST });
            check(projectSnapshot(root) === before, `${label}: no file changed`);
          }
        });
        await step('ALLOW_STAGE_CONFLICT (exit 3): amending a pending retirement names the managed request and writes nothing', async () => {
          const root = errRoot('conflict');
          const first = stage(root);
          check(first.code === 0 && first.json && first.json.ok === true, 'control: [A] stages', { code: first.code, out: first.stdout.slice(0, 300) });
          putFile(selPath(root), jsonText([B]));
          const before = projectSnapshot(root);
          expectStageErr(check, 'a pending [A] changed to [B]', stage(root), { code: 'ALLOW_STAGE_CONFLICT', exit: 3, error: ST.CONFLICT(mkT), target: mkT });
          check(projectSnapshot(root) === before, 'the conflict wrote nothing');
        });
        await step('pure failures keep their code and complete prefixed message (exit 3): ALLOW_SELECTION and a wrong selection container target the selection file, ALLOW_SETTINGS targets the selected settings base', async () => {
          for (const sel of [[U], [A, A], [7]]) {
            const root = errRoot('selection', null, sel);
            const before = projectSnapshot(root);
            expectStageErr(check, `selection ${show(sel)}`, stage(root), { code: 'ALLOW_SELECTION', exit: 3, error: ERR_SELECTION, target: SELECTION_REL });
            check(projectSnapshot(root) === before, `selection ${show(sel)}: nothing written`);
          }
          const wrong = errRoot('container', null, {});
          const rw = stage(wrong);
          check(rw.code === 3 && rw.stderr === '' && rw.json && rw.stdout === jsonText(rw.json) && eq(keysOf(rw.json), ['ok', 'code', 'error', 'target']) && rw.json.ok === false && rw.json.code === 'ALLOW_INPUT' && allowInputMsg(rw.json.error) && rw.json.target === SELECTION_REL, 'a selection that is not an array: ALLOW_INPUT, exit 3, the selection file as target', { code: rw.code, out: rw.stdout.slice(0, 300) });
          const s1 = errRoot('settings', (r) => putFile(projPath(r, T_SETTINGS), J({ permissions: { allow: 'x' } })));
          expectStageErr(check, 'installed settings with a malformed allow array', stage(s1), { code: 'ALLOW_SETTINGS', exit: 3, error: ERR_SETTINGS, target: T_SETTINGS });
          const s2 = errRoot('settings-draft', (r) => putDraft(r, RID, T_SETTINGS, J({ permissions: { allow: [1] } })));
          expectStageErr(check, 'a settings draft (the base) with a malformed allow array', stage(s2), { code: 'ALLOW_SETTINGS', exit: 3, error: ERR_SETTINGS, target: draftRel(RID) });
        });
        await step('ALLOW_STAGE_PATH (exit 2): outside the project, inside any run drafts or vault subtree, and links or junctions on the settings or selection chain, all refused before the body is read', async () => {
          const body = '["MARKER_SELECTION_BODY"]\n';
          const probe = (label, file, want) => {
            const root = want.root;
            const watch = readGuard(dir, [file]);
            const before = projectSnapshot(root);
            const r = stage(root, { arg: want.arg !== undefined ? want.arg : file, preload: watch.file });
            expectStageErr(check, label, r, want.envelope);
            check(watch.hits().length === 0, `${label}: the selection body was never read`, watch.hits().slice(0, 3));
            check(!r.stdout.includes('MARKER_SELECTION_BODY') && !r.stderr.includes('MARKER_SELECTION_BODY'), `${label}: the marker body never appears in the output`);
            check(projectSnapshot(root) === before, `${label}: nothing was written`);
          };
          const outRoot = errRoot('p-out');
          const outside = path.join(dir, 'outside-sel', 'selection.json');
          putFile(outside, body);
          probe('a selection outside the project', outside, { root: outRoot, envelope: { code: 'ALLOW_STAGE_PATH', exit: 2, error: ST.OUTSIDE, target: null } });
          const dRoot = errRoot('p-drafts');
          const dFile = path.join(dRoot, '.ai', '.run', RID, 'drafts', 'selection.json');
          putFile(dFile, body);
          const dTarget = canonicalTarget(dRoot, dFile);
          check(dTarget === '.ai/.run/run-c7-0001/drafts/selection.json', 'the expected draft target is the canonical project-relative spelling', dTarget);
          probe('a selection in the run drafts directory', dFile, { root: dRoot, envelope: { code: 'ALLOW_STAGE_PATH', exit: 2, error: ST.DRAFTVAULT, target: dTarget } });
          const vRoot = errRoot('p-vault');
          const vFile = path.join(vRoot, '.ai', '.run', RID, 'vault', 'files', 'selection.json');
          putFile(vFile, body);
          probe('a selection in vault/files', vFile, { root: vRoot, envelope: { code: 'ALLOW_STAGE_PATH', exit: 2, error: ST.DRAFTVAULT, target: canonicalTarget(vRoot, vFile) } });
          const oRoot = errRoot('p-other');
          const oFile = path.join(oRoot, '.ai', '.run', 'run-c7-other', 'drafts', 'selection.json');
          putFile(oFile, body);
          probe('a selection in the drafts directory of another run', oFile, { root: oRoot, envelope: { code: 'ALLOW_STAGE_PATH', exit: 2, error: ST.DRAFTVAULT, target: canonicalTarget(oRoot, oFile) } });
          // links and junctions: the offending link or the path below it is named (PLAN-GAP: the plan does not say which); the error repeats the target
          const linkProbe = (label, root, files, okTargets, mk) => {
            const watch = readGuard(dir, files);
            const before = projectSnapshot(root);
            const r = stage(root, { preload: watch.file, ...mk });
            const ok = r.code === 2 && r.stderr === '' && r.json && r.json.ok === false && r.json.code === 'ALLOW_STAGE_PATH' && okTargets(r.json.target) && r.json.error === ST.PATH(r.json.target) && eq(keysOf(r.json), ['ok', 'code', 'error', 'target']) && r.stdout === jsonText(r.json);
            check(ok, `${label}: ALLOW_STAGE_PATH, exit 2, the error names the target path`, { code: r.code, out: r.stdout.slice(0, 300), err: r.stderr.slice(0, 200) });
            check(watch.hits().length === 0, `${label}: nothing was read through the link`, watch.hits().slice(0, 3));
            check(projectSnapshot(root) === before, `${label}: nothing was written`);
          };
          const jRoot = errRoot('p-junction');
          const ext = path.join(dir, 'ext-claude');
          putFile(path.join(ext, 'settings.json'), J(mkS()));
          fs.rmSync(projPath(jRoot, '.claude'), { recursive: true, force: true });
          if (linkDir(ext, projPath(jRoot, '.claude'))) linkProbe('a junctioned .claude directory', jRoot, [projPath(jRoot, T_SETTINGS), path.join(ext, 'settings.json')], (t) => ['.claude', T_SETTINGS].includes(t), {});
          else check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'} for .claude`);
          const sRoot = errRoot('p-chain', null, null);
          const real = path.join(sRoot, 'realsel');
          putFile(path.join(real, 'retire.json'), body);
          const link = path.join(sRoot, 'linksel');
          if (linkDir(real, link)) linkProbe('a junction in the selection parent chain', sRoot, [path.join(real, 'retire.json'), path.join(link, 'retire.json')], (t) => ['linksel', 'linksel/retire.json'].includes(t), { arg: 'linksel/retire.json' });
          else check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'} for the selection chain`);
        });
        await step('C7-P3-2: a selection reached through the raw TEMP spelling of the project path is accepted and gives exactly the first [A] success envelope', async () => {
          const root = errRoot('p-short');
          const raw = rawSpelling(root);
          diag(context, `short-spelling case: ${raw === root ? 'identical spellings (no distinct short spelling on this host)' : 'distinct spellings'}`);
          const arg = path.join(raw, ...SELECTION_REL.split('/'));
          const r = stage(root, { arg });
          expectRetireOk(check, 'raw TEMP spelling of the selection path', r, ENV_OK({ changed: true, metadataChanged: true, draft: draftRel(RID), allows: P1(), retirement: RET({ listed: INV0(), retired: [A], retained: [C, B] }) }));
          const want = REQ_BYTES();
          check(readText(draftPath(root, RID, T_SETTINGS)) === J(mkS([U, C, B])) && readText(runFile(root, RID, 'ownership.json')) === want.ownership && readText(runFile(root, RID, 'managed-keys.json')) === want.managed && readText(runFile(root, RID, 'omissions.json')) === want.omissions, 'the draft and the three requests are the exact plan bytes');
        });
        await step('ALLOW_STAGE_PROTECTED (exit 3): a settings file protected by the installed policy and a protected selection input are refused before any read', async () => {
          const sRoot = errRoot('prot-settings', (r) => putFile(projPath(r, T_POLICY), protectPolicy(T_SETTINGS)));
          const w1 = readGuard(dir, [projPath(sRoot, T_SETTINGS)]);
          const b1 = projectSnapshot(sRoot);
          expectStageErr(check, 'protected settings', stage(sRoot, { preload: w1.file }), { code: 'ALLOW_STAGE_PROTECTED', exit: 3, error: ST.PROTECTED(T_SETTINGS), target: T_SETTINGS });
          check(w1.hits().length === 0, 'protected settings: the file was never read', w1.hits().slice(0, 3));
          check(projectSnapshot(sRoot) === b1, 'protected settings: nothing was written');
          const dRoot = errRoot('prot-draft', (r) => { putFile(projPath(r, T_POLICY), protectPolicy(T_SETTINGS)); putDraft(r, RID, T_SETTINGS, J(mkS())); });
          const w2 = readGuard(dir, [draftPath(dRoot, RID, T_SETTINGS)]);
          expectStageErr(check, 'a settings draft behind protected settings', stage(dRoot, { preload: w2.file }), { code: 'ALLOW_STAGE_PROTECTED', exit: 3, error: ST.PROTECTED(T_SETTINGS), target: T_SETTINGS });
          check(w2.hits().length === 0, 'the staged draft of protected settings was never read', w2.hits().slice(0, 3));
          const selRel = 'secrets/retire-allows.json';
          const pRoot = errRoot('prot-selection', null, null);
          putFile(path.join(pRoot, ...selRel.split('/')), '["MARKER_PROTECTED_BODY"]\n');
          const w3 = readGuard(dir, [path.join(pRoot, ...selRel.split('/'))]);
          const b3 = projectSnapshot(pRoot);
          const r3 = stage(pRoot, { arg: selRel, preload: w3.file });
          expectStageErr(check, 'a protected selection input', r3, { code: 'ALLOW_STAGE_PROTECTED', exit: 3, error: ST.PROTECTED(selRel), target: selRel });
          check(w3.hits().length === 0 && !r3.stdout.includes('MARKER_PROTECTED_BODY'), 'the protected selection was never read and its body never appears', w3.hits().slice(0, 3));
          check(projectSnapshot(pRoot) === b3, 'protected selection: nothing was written');
        });
        await step('ALLOW_STAGE_IO (exit 2): a settings file or a selection that cannot be read fails with the exact read error', async () => {
          // PLAN-GAP: the plan names no way to provoke a read failure; an injected EIO on fs.readFileSync and fs.openSync of the path (a -r preload) is used.
          const a = errRoot('io-settings');
          const bA = projectSnapshot(a);
          expectStageErr(check, 'an unreadable settings file', stage(a, { preload: readBreaker(dir, [projPath(a, T_SETTINGS)]) }), { code: 'ALLOW_STAGE_IO', exit: 2, error: ST.IO(T_SETTINGS), target: T_SETTINGS });
          check(projectSnapshot(a) === bA, 'an unreadable settings file: nothing was written');
          const s = errRoot('io-selection');
          const bS = projectSnapshot(s);
          expectStageErr(check, 'an unreadable selection', stage(s, { preload: readBreaker(dir, [selPath(s)]) }), { code: 'ALLOW_STAGE_IO', exit: 2, error: ST.IO(SELECTION_REL), target: SELECTION_REL });
          check(projectSnapshot(s) === bS, 'an unreadable selection: nothing was written');
          // PLAN-GAP: a selection file that does not exist is not pinned; only a JSON failure from the ALLOW_STAGE family with exit 2 or 3 and nothing written is asserted.
          const m = errRoot('io-missing', null, null);
          const bM = projectSnapshot(m);
          const rm = stage(m);
          check(rm.stderr === '' && rm.json && rm.json.ok === false && typeof rm.json.code === 'string' && /^ALLOW_/.test(rm.json.code) && [2, 3].includes(rm.code) && projectSnapshot(m) === bM, 'a missing selection file fails with an ALLOW_* JSON failure and writes nothing', { code: rm.code, out: rm.stdout.slice(0, 300) });
        });
        await step('ALLOW_STAGE_WRITE (exit 2): an injected EIO at the final rename of each output, in turn, gives the exact envelope and exactly the plan table of surviving outputs, each with its section 4.7 bytes', async () => {
          // C7-P3-1: the failure is a persistent, non-retried EIO at the atomic rename to one final destination.
          const want = REQ_BYTES();
          const bytesOf = { draft: J(mkS([U, C, B])), ownership: want.ownership, managed: want.managed };
          const files = { draft: 'drafts/.claude/settings.json', ownership: 'ownership.json', managed: 'managed-keys.json', omissions: 'omissions.json' };
          const table = [
            ['the settings draft', draftRel(RID), []],
            ['ownership.json', ownT, ['draft']],
            ['managed-keys.json', mkT, ['draft', 'ownership']],
            ['omissions.json', omT, ['draft', 'ownership', 'managed']],
          ];
          for (const [label, target, survivors] of table) {
            const root = errRoot('write');
            const brk = renameBreaker(dir, [path.join(root, ...target.split('/'))]);
            const runBefore = runSnapshot(root, RID);
            const outsideBefore = outsideRunSnapshot(root);
            const selBefore = readBytes(selPath(root));
            const r = stage(root, { preload: brk });
            expectStageErr(check, `EIO at ${label}`, r, { code: 'ALLOW_STAGE_WRITE', exit: 2, error: ST.WRITE(target), target });
            check(!(r.json && r.json.changed !== undefined), `EIO at ${label}: no success envelope was printed`);
            const after = runSnapshot(root, RID);
            const created = changedRunFiles(runBefore, after).filter((k) => !k.includes('.ps-tmp-'));
            const expectNames = survivors.map((s) => files[s]).sort();
            check(eq(created, expectNames), `EIO at ${label}: exactly the earlier outputs exist afterwards; the failed and every later destination are absent`, { created, expected: expectNames });
            for (const s of survivors.filter((x) => bytesOf[x] !== undefined)) check(readText(path.join(root, '.ai', '.run', RID, ...files[s].split('/'))) === bytesOf[s], `EIO at ${label}: the surviving ${files[s]} has the exact section 4.7 bytes`);
            check(outsideRunSnapshot(root) === outsideBefore && sameBytes(readBytes(selPath(root)), selBefore), `EIO at ${label}: the installed settings and manifest and the selection file are unchanged`);
          }
        });
      });
    }

    // ---------------------------------------------------------- registration ----
    await step('registration: COMPONENT_ASSERTIONS.C7 is the twelve descriptors of plan 4.1 in order, written independently; COMPONENT_IMPLEMENTATIONS.C7 holds exactly the C7_IMPLEMENTATIONS objects; R29 aggregates C7 after C6; no complete numbered case is added', async () => {
      const rc = await needSibling(failures, 'rc1-cases.mjs');
      if (!rc) return;
      const exp = rc.COMPONENT_ASSERTIONS && rc.COMPONENT_ASSERTIONS.C7;
      check(Array.isArray(exp) && eq(JSON.parse(JSON.stringify(exp)), EXPECTED_DESCRIPTORS) && deepFrozen(exp), 'COMPONENT_ASSERTIONS.C7 is the twelve descriptors, in order, deep-frozen', exp);
      const impls = rc.COMPONENT_IMPLEMENTATIONS && rc.COMPONENT_IMPLEMENTATIONS.C7;
      check(Array.isArray(impls) && Object.isFrozen(impls) && impls.length === C7_IMPLEMENTATIONS.length && impls.every((x, i) => x === C7_IMPLEMENTATIONS[i]), 'COMPONENT_IMPLEMENTATIONS.C7 is a frozen array of the C7_IMPLEMENTATIONS objects, in order', impls && impls.length);
      check(Object.isFrozen(C7_IMPLEMENTATIONS) && eq(C7_IMPLEMENTATIONS.map((x) => x.id), EXPECTED_DESCRIPTORS.map((d) => d.id)) && C7_IMPLEMENTATIONS.every((x) => typeof x.run === 'function' && Object.isFrozen(x)), 'C7_IMPLEMENTATIONS is a frozen array of the twelve IDs with callable run functions');
      const calls = [];
      const ret = rc.registerRc1Cases((...a) => calls.push(a), { repository: context.repository });
      check(calls.length === 0 && (ret === undefined || (ret && typeof ret.then === 'function')), 'registerRc1Cases still registers no complete numbered case', calls.length);
      check(!rc.REQUIRED_CASE_IDS.some((x) => x.includes('/C7/')), 'no complete-case inventory names a C7 sub-assertion');
      const runner = readText(new URL('./run-tests.mjs', import.meta.url));
      const at6 = runner === null ? -1 : runner.indexOf("runComponentAssertions('C6'");
      const at7 = runner === null ? -1 : runner.indexOf("runComponentAssertions('C7'");
      const r29 = runner === null ? -1 : runner.lastIndexOf("test('R29'", at6);
      const r30 = runner === null ? -1 : runner.indexOf("test('R30'", at6);
      check(at6 >= 0 && r29 >= 0 && at6 > r29 && at7 > at6 && r30 > at7 && runner.indexOf("runComponentAssertions('C7'", at7 + 1) < 0, 'run-tests.mjs runs the C7 component assertions once, after the C6 aggregation, inside R29', { r29, at6, at7, r30 });
    });
    flushProcessCount(context, 'V2/C7/contracts');
  });
}

// ============================================================ registration ====
// The array wired into COMPONENT_IMPLEMENTATIONS.C7 (plan 4.1): frozen, descriptors frozen, in the plan order. Imports perform no work.
export const C7_IMPLEMENTATIONS = Object.freeze([
  { id: 'R53/C7/classifier', run: (context) => classifierGroup(context) },
  { id: 'R53/C7/ownership', run: (context) => ownershipGroup(context) },
  { id: 'R53/C7/discovery', run: (context) => discoveryGroup(context) },
  { id: 'R54/C7/refusal', run: (context) => refusalGroup(context) },
  { id: 'R85/C7/inventory', run: (context) => inventoryGroup(context) },
  { id: 'R85/C7/retirement', run: (context) => retirementGroup(context) },
  { id: 'R85/C7/staging', run: (context) => stagingGroup(context) },
  { id: 'R85/C7/preservation', run: (context) => preservationGroup(context) },
  { id: 'R85/C7/transaction', run: (context) => transactionGroup(context) },
  { id: 'R86/C7/reconciliation', run: (context) => reconciliationGroup(context) },
  { id: 'R86/C7/binding-rollback', run: (context) => bindingGroup(context) },
  { id: 'V2/C7/contracts', run: (context) => contractsGroup(context) },
].map((d) => Object.freeze(d)));
