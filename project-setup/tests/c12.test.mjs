// C12 tests lane: the eight component assertions of "C12. Review fixes".
//
// Written from the frozen plan only, before any implementation exists:
//   docs/plans/2026-10-21-project-setup-v3-rc1-c12.md   (sections C12-1 to C12-18 and the freeze addendum C12-P2-1 to C12-P2-5, which wins over earlier sections)
// Under the frozen architecture plan docs/plans/2026-10-15-project-setup-v3-rc1.md and the landed contracts it amends: C11a (tests/rc1-cases.mjs, tests/run-component-tests.mjs), C1 (assets/tools/security-policy.mjs), C2 and C3
// (scripts/apply.mjs, scripts/ownership.mjs, scripts/migrate-security-paths.mjs, scripts/render-permissions.mjs), C4 to C6 (data/runtime-units.json, assets/tools/guard-raw-git-core.mjs, assets/tools/hooks-selftest.mjs), C8 to C10 (the
// reviewer and docs-sync definitions, SKILL.md and the references, doctor and validate) and C11b (install/release.mjs, the candidate documentation pins). Plan C12-13 gives the tests lane this file, the tests/rc1-cases.mjs registration, the single
// R29 aggregation in tests/run-tests.mjs (decision K12), evaluation 21 in evals/evals.json and the frozen-test edits listed in C12-11, C12-12, C12-13 and C12-15; those edits live in those files. The implementer must not edit any of them.
//
// Importing this module runs nothing. Every production module and the registry module (rc1-cases.mjs imports this file, so a static import back would be circular) is imported lazily inside run(context). A missing module, export or
// fixture fails one assertion with a diagnostic; it never breaks the import.
//
// Every run(context) returns { failures, skipped: null }. There is no skip path: an unavailable optional subcase (a file symlink without privilege) is recorded in the diagnostics file and is never a skip, while a missing
// directory junction (mandatory on Windows) fails the assertion. Scratch data lives under context.tmp only. Every project is a synthetic ASCII fixture, every scanner is a stub or a missing executable, and no user configuration, real
// scanner, release build or network service is touched. Process launches are counted per group (harness-counted, spawnSync only) and retained with the elapsed time in <context.tmp>/c12-diagnostics.log; the plan's budget is a recorded
// target (400 launches, 600 s), never an assertion.
//
// Where the plan does not pin a value a test would need, the test asserts only what is pinned. The gaps are listed in the delegation report as PLAN-GAP lines; the places they touch carry a comment starting with "PLAN-GAP".
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
function show(v, cap = 700) {
  let s;
  try { s = typeof v === 'string' ? JSON.stringify(v) : (JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? String(x) : x)) ?? String(v)); } catch { s = String(v); }
  return s.replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).slice(0, cap);
}
function mkCheck(failures) { return (cond, msg, detail) => { if (!cond) failures.push(detail === undefined ? msg : `${msg} :: ${show(detail)}`); }; }
function deepFreeze(v) { if (v !== null && typeof v === 'object') { for (const x of Object.values(v)) deepFreeze(x); Object.freeze(v); } return v; }
const clone = (v) => JSON.parse(JSON.stringify(v));
const sorted = (a) => [...a].sort();
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const jsonText = (v) => JSON.stringify(v, null, 2) + '\n';
const WIN = process.platform === 'win32';
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
const clip = (s) => show(String(s).length > 90 ? `${String(s).slice(0, 90)}... (${String(s).length} chars)` : s);
const lc = (p) => (WIN ? String(p).toLowerCase() : String(p));
const normText = (s) => { let t = Buffer.isBuffer(s) ? s.toString('utf8') : String(s); if (t.charCodeAt(0) === 0xfeff) t = t.slice(1); t = t.replace(/\r\n?/g, '\n'); if (!t.endsWith('\n')) t += '\n'; return t; };
// The normalized hash of the apply manifest: text without BOM, LF line ends, one final LF, hashed with SHA-256. Computed here, never taken from a production function.
const NH = (s) => sha(Buffer.from(normText(s), 'utf8'));
const LF = (s) => String(s).replace(/\r\n/g, '\n');

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
async function importOrFail(failures, url, label) {
  try { return await import(url); } catch (e) { failures.push(`cannot import ${label}: ${errMsg(e)}`); return null; }
}
const skillPath = (context, rel) => path.join(context.skillRoot, ...rel.split('/'));
const skillUrl = (context, rel) => pathToFileURL(skillPath(context, rel)).href;

// ------------------------------------------------------------- scratch ----
// The native (long-name) real path: Git, the setup scripts and the code under test all report that spelling.
function scratchDir(context, label) {
  fs.mkdirSync(context.tmp, { recursive: true });
  return fs.realpathSync.native(fs.mkdtempSync(path.join(context.tmp, `c12-${label}-`)));
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
// A directory link: a junction on Windows (no privilege needed), a symbolic directory link elsewhere. Returns false when it cannot be created.
function linkDir(target, link) {
  try { fs.symlinkSync(target, link, WIN ? 'junction' : 'dir'); createdLinks.add(link); return true; } catch { return false; }
}
// A deterministic listing of a tree: relative path, kind and SHA-256 of every file. Links are listed, never followed.
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
function cloneTree(src, dst) { fs.cpSync(src, dst, { recursive: true }); return dst; }
function listFiles(dir, accept = () => true) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && accept(e.name)).map((e) => e.name).sort(); } catch { return null; }
}

// The retained diagnostics: a plain file in the kept scratch directory (process counts, elapsed time, optional-subcase notes).
function diag(context, line) { try { fs.mkdirSync(context.tmp, { recursive: true }); fs.appendFileSync(path.join(context.tmp, 'c12-diagnostics.log'), `${line}\n`); } catch { /* best effort */ } }
// Process accounting (C12-13): every spawnSync launch made by this file is counted per component run and retained in the diagnostics file.
const PROCESS_COUNTS = new Map();
const STARTED = new Map();
function countProcess(context, n = 1) { PROCESS_COUNTS.set(context.tmp, (PROCESS_COUNTS.get(context.tmp) || 0) + n); }
const processMark = (context) => PROCESS_COUNTS.get(context.tmp) || 0;
function startClock(context) { if (!STARTED.has(context.tmp)) STARTED.set(context.tmp, Date.now()); }
function flushProcessCount(context, label, mark) {
  const elapsed = Math.round((Date.now() - (STARTED.get(context.tmp) || Date.now())) / 1000);
  diag(context, `processes in ${label}: ${processMark(context) - mark} (cumulative ${processMark(context)}, counting method: every spawnSync launch of this file; elapsed ${elapsed} s since the first group)`);
}
// A shell-free Node launch: absolute node, absolute script, 60 s timeout, 16 MiB buffer. A spawn failure, signal or timeout is "dead" and fails the calling assertion.
function execNode(context, { cwd, script, args = [], preload = null, env = null, input }) {
  countProcess(context);
  const pre = Array.isArray(preload) ? preload : preload ? [preload] : [];
  const argv = [...pre.flatMap((p) => ['--require', p]), script, ...args];
  const r = spawnSync(process.execPath, argv, { cwd: cwd || context.tmp, env: env || context.env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 60000, maxBuffer: 16777216, input });
  let dead = null;
  if (r.error) dead = `${r.error.code || 'error'}: ${String(r.error.message).slice(0, 120)}`;
  else if (r.signal) dead = `signal ${r.signal}`;
  const stdout = r.stdout || '';
  const stderr = r.stderr || '';
  let json = null;
  try { json = JSON.parse(stdout); } catch { /* not JSON */ }
  return { code: r.status, stdout, stderr, json, dead };
}
const fmtOk = (r) => r.json !== null && typeof r.json === 'object' && r.stdout === jsonText(r.json);
function gitIn(context, cwd, args) {
  countProcess(context);
  const r = spawnSync('git', args, { cwd, env: context.env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 60000 });
  return { code: r.status, stdout: String(r.stdout || '').trim(), stderr: String(r.stderr || '').trim() };
}
function makeRepo(context, dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  const a = gitIn(context, dir, ['init', '-q']);
  for (const [rel, data] of Object.entries(files)) putFile(path.join(dir, ...rel.split('/')), data);
  gitIn(context, dir, ['add', '-A']);
  const c = gitIn(context, dir, ['commit', '-qm', 'init']);
  if (a.code !== 0 || c.code !== 0) throw new Error(`cannot create the fixture repository: ${a.stderr} ${c.stderr}`);
  return dir;
}
function commitAll(context, dir, msg = 'fixture') {
  gitIn(context, dir, ['add', '-A']);
  const c = gitIn(context, dir, ['commit', '-qm', msg, '--allow-empty']);
  if (c.code !== 0) throw new Error(`cannot commit the fixture: ${c.stderr}`);
}

// ============================================================ literals ====
// Written out independently of the implementation (plan C12-13: the descriptors; C12-4, C12-5, C12-7 and C12-9: the gate, the matrix and the entry function; C12-11: the prose).
const COMPONENT_INVENTORY = [
  ['R47/C12/policy-preservation', 'installed policy protections survive reruns'],
  ['R80/C12/policy-gates', 'policy regression gates bind review and commit'],
  ['V2/C12/entrypoints', 'alternate script paths execute the intended CLI'],
  ['R51/C12/config-env', 'environment configuration aliases cannot bypass the hook'],
  ['R80/C12/runtime-unit', 'changed guard cores require the reviewed runtime unit'],
  ['A5-templates/C12/documentation', 'review corrections preserve agent and policy boundaries'],
  ['RC1/C12/pins', 'intentional documentation edits update only affected pins'],
  ['V2/C12/contracts', 'C12 registration and evaluation contracts are exact'],
];
const EXPECTED_DESCRIPTORS = COMPONENT_INVENTORY.map(([id, name]) => ({ id, name }));

const T_POLICY = '.ai/security-paths.json';
const T_SETTINGS = '.claude/settings.json';
const T_MANIFEST = '.ai/manifest.json';
const T_DECISIONS = 'security-decisions.json';
const RUNTIME_MEMBERS = ['security-policy.mjs', 'git-safe-core.mjs', 'guard-raw-git-core.mjs', 'review-diff.mjs', 'git-safe.mjs', 'guard-raw-git.mjs', 'hooks-selftest.mjs'];
const RUNTIME_ROLES = ['helper', 'helper', 'helper', 'helper', 'entrypoint', 'entrypoint', 'entrypoint'];
const HOOK_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs"';
// Plan C12-4: the fixed refusal text, the code and the exit.
const REGRESSION_CODE = 'APPLY_POLICY_REGRESSION';
const REGRESSION_TEXT = 'policy draft is invalid, lowers the schema, or removes installed entries outside the reviewed migration workflow';
const MIGRATION_REQUIRED_TEXT = 'schema-2 policy changes with installed tools require security-decisions.json';
const MISMATCH_TEXT = (t) => `MIGRATION_OUTPUT_MISMATCH: staged migration output does not match decisions: ${t}`;
const DRIFT_TEXT = 'changes since prepare; nothing was written. Re-run prepare and get approval again.';
// A string that must never be echoed: it sits inside the rejected drafts, so any echo of the rejected content or of the C1 message would carry it.
const MARKER = 'c12-rejected-marker-9f3a';
const C1_ECHO = /policy\.(schema|patterns|projectPatterns)|patterns\[\d+\]\.glob|must be valid JSON|unsupported syntax|(^|[^A-Z_])POLICY_(JSON|ROOT|VALUE|SCHEMA|PATTERNS|PROJECT_PATTERNS|ENTRY|GLOB|ANCHOR|LEGACY|PATH|TEXT)/;

// ======================================================= policy fixtures ====
const shippedCache = new Map();
function shipped(context) {
  if (!shippedCache.has(context.skillRoot)) {
    const text = readText(skillPath(context, 'data/secret-paths.json'));
    const v2Text = readText(skillPath(context, 'data/secret-paths-v2.0.0.json'));
    const tools = {};
    for (const m of RUNTIME_MEMBERS) tools[m] = readText(skillPath(context, `assets/tools/${m}`));
    shippedCache.set(context.skillRoot, { text, policy: JSON.parse(text), v2Text, v2: JSON.parse(v2Text), tools });
  }
  return shippedCache.get(context.skillRoot);
}
const inferredAnchor = (glob) => (glob.startsWith('**/') ? 'any' : 'root');
const anchored = (list) => list.map((e) => ({ anchor: inferredAnchor(e.glob), ...e }));
const identity = (e) => JSON.stringify([e.anchor === undefined ? inferredAnchor(e.glob) : e.anchor, e.glob.toLowerCase()]);
const ADD1 = { glob: 'internal-keys/**', kind: 'dir' };
const ADD2 = { glob: '**/*.vault', kind: 'key' };
const ADD3 = { glob: 'zz-extra/**', kind: 'dir' };
const P1 = { anchor: 'root', glob: 'internal-secrets/**', kind: 'dir' };
const P2 = { anchor: 'any', glob: '**/*.vault', kind: 'key' };
const BENIGN = { anchor: 'root', glob: 'zz-benign/**', kind: 'dir' };
// The installed policies of the fixtures. Schema 1 holds raw entries (anchors inferred); schema 2 holds explicit anchors and the project's own entries.
const policyS1 = (context) => ({ schema: 1, patterns: [...shipped(context).policy.patterns, ADD1, ADD2] });
const policyS2 = (context) => ({ schema: 2, patterns: anchored(shipped(context).policy.patterns), projectPatterns: [P1, P2] });
// The migration base: a schema-2 policy whose managed list is the v2.0.0 baseline minus one deletion plus one addition, with two project entries; the manifest records the full baseline.
const V2_DELETED = '**/*.p12';
const MIG_ADDITION = { anchor: 'root', glob: 'extra-keys/**', kind: 'dir' };
const policyM = (context) => ({ schema: 2, patterns: [...anchored(shipped(context).v2.patterns).filter((e) => e.glob !== V2_DELETED), MIG_ADDITION], projectPatterns: [P1, P2] });
const manifestOf = (files, over = {}) => ({ schema: 3, skill: 'project-setup', skillVersion: '3.0.0-rc.1', mode: 'update', agents: [], sourceCommit: null, files, ...over });
const GITIGNORE = '.claude/settings.local.json\nCLAUDE.local.md\n';

// Project builders. Every base is created once per component run and cloned (a file copy) per case.
const baseCache = new Map();
function cachedBase(context, name, build) {
  const key = `${context.tmp}|${name}`;
  if (!baseCache.has(key)) baseCache.set(key, Promise.resolve().then(build));
  return baseCache.get(key);
}
function mkBase(context, label, files) {
  const dir = scratchDir(context, `base-${label}`);
  const root = path.join(dir, 'root');
  makeRepo(context, root, { 'package.json': '{"name":"fixture-app"}\n', 'README.md': '# fixture\n', 'docs/guide.md': '# guide\n', '.gitignore': GITIGNORE, ...files });
  return { dir, root };
}
const getFreshBase = (context) => cachedBase(context, 'fresh', () => mkBase(context, 'fresh', {}));
const getS1Base = (context) => cachedBase(context, 's1', () => mkBase(context, 's1', { [T_POLICY]: jsonText(policyS1(context)) }));
// Schema 1 with a manifest that records the policy as fully managed and unedited: a policy change then needs no approval, and a stale manifestAfter would be refused by the manifest check.
const getS1FullBase = (context) => cachedBase(context, 's1full', () => {
  const text = jsonText(policyS1(context));
  return mkBase(context, 's1full', { [T_POLICY]: text, [T_MANIFEST]: jsonText(manifestOf({ [T_POLICY]: { ownership: 'full', sha256: NH(text) } })) });
});
const getS2Base = (context) => cachedBase(context, 's2', () => mkBase(context, 's2', { [T_POLICY]: jsonText(policyS2(context)) }));
// The schema-2 migration base: policy, a manifest recording the v2.0.0 managed list as the keys baseline, and settings with an empty deny list. No runtime member is installed.
const getMigBase = (context) => cachedBase(context, 'mig', () => {
  const s = shipped(context);
  const manifest = manifestOf({
    [T_POLICY]: { ownership: 'keys', managed: { schema: 2, patterns: anchored(s.v2.patterns) } },
    [T_SETTINGS]: { ownership: 'keys', managed: { 'permissions.deny': [] } },
  });
  return mkBase(context, 'mig', { [T_POLICY]: jsonText(policyM(context)), [T_MANIFEST]: jsonText(manifest), [T_SETTINGS]: jsonText({ permissions: { deny: [] } }) });
});
async function useBase(failures, name, getter, context) {
  try { return await getter(context); } catch (e) { failures.push(`cannot build the ${name} fixture: ${errMsg(e)}`); return null; }
}
const cloneBase = (scratch, base, label) => cloneTree(base.root, path.join(scratch, label));
// A stub for one runtime consumer: any catalog target that exists makes a schema-2 policy draft need the migration workflow.
const CONSUMER = '.ai/tools/git-safe.mjs';
function addConsumer(root) { putFile(path.join(root, ...CONSUMER.split('/')), '// consumer stub\n'); }

// ============================================================= kit ====
// One toolkit per assertion group: every call goes through the group's `check`, so a dead process is reported once, where it happened.
function makeKit(context, check, skillRoot = context.skillRoot) {
  const scripts = (name) => path.join(skillRoot, 'scripts', `${name}.mjs`);
  const launch = (label, script, args, o = {}) => {
    const r = execNode(context, { cwd: o.cwd, script, args, preload: o.preload || null, env: o.env || null });
    if (r.dead && !o.allowDead) check(false, `${label}: the process did not end normally`, r.dead);
    return r;
  };
  const kit = {
    scripts,
    apply: (root, args, o = {}) => launch(`apply ${args[0]}`, scripts('apply'), args, { cwd: root, ...o }),
    lock: (root, args, o = {}) => launch(`lock ${args[0]}`, scripts('lock'), args, { cwd: root, ...o }),
    script: (name, root, args, o = {}) => launch(name, scripts(name), args, { cwd: root, ...o }),
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
    commit(root, id, planSha, o = {}) { return kit.apply(root, ['commit', '--run-id', id, '--approved-plan', planSha], o); },
    diff(root, id, o = {}) { return kit.apply(root, ['diff', '--project', root, '--run-id', id], o); },
    report(root, o = {}) { return launch('migrate report', scripts('migrate-security-paths'), ['report', '--project', root], { cwd: root, ...o }); },
    stage(root, id, o = {}) { return launch('migrate stage', scripts('migrate-security-paths'), ['stage', '--project', root, '--run-id', id], { cwd: root, ...o }); },
    render(root, args, o = {}) { return launch('render', scripts('render-permissions'), args, { cwd: root, ...o }); },
  };
  return kit;
}
const runDirOf = (root, id) => path.join(root, '.ai', '.run', id);
const runFile = (root, id, ...segs) => path.join(runDirOf(root, id), ...segs);
const draftPath = (root, id, rel) => path.join(runDirOf(root, id), 'drafts', ...rel.split('/'));
const projPath = (root, rel) => path.join(root, ...rel.split('/'));
const putDraft = (root, id, rel, data) => putFile(draftPath(root, id, rel), data);
const putRequest = (root, id, name, value) => putFile(runFile(root, id, name), typeof value === 'string' || Buffer.isBuffer(value) ? value : jsonText(value));
const readPlan = (root, id) => readJson(runFile(root, id, 'plan.json'));
const lockOwnerPath = (root) => path.join(root, '.ai', '.setup.lock', 'owner.json');
const manifestPath = (root) => path.join(root, '.ai', 'manifest.json');
const projectSnapshot = (root) => snapshotTree(root, ['.git']);
// What a rejection must leave untouched (C12-5): every project, run, request, plan, manifest and lock byte, and the absence of a journal.
function noWriteState(root, id) { return { project: projectSnapshot(root), lock: readBytes(lockOwnerPath(root)), journal: exists(runFile(root, id, 'journal.json')) }; }
function checkNoWrite(check, label, root, id, before) {
  check(!exists(runFile(root, id, 'journal.json')), `${label}: no journal`);
  check(projectSnapshot(root) === before.project, `${label}: no project file, manifest, plan, request or run file changed`);
  check(sameBytes(readBytes(lockOwnerPath(root)), before.lock), `${label}: the lock bytes are unchanged (no heartbeat)`);
}
// Rewrites one draft of a prepared run and the plan operation that binds it (C12-5: "rewritten prepared plan with consistent bindings"), then returns the new plan hash.
function forgeDraft(root, id, target, draftText) {
  const plan = readPlan(root, id);
  const op = plan.ops.find((o) => o.target === target);
  const bytes = Buffer.from(draftText, 'utf8');
  putFile(draftPath(root, id, target), bytes);
  op.sourceSha256 = sha(bytes);
  const text = jsonText(plan);
  putFile(runFile(root, id, 'plan.json'), text);
  return sha(Buffer.from(text, 'utf8'));
}
const forgePolicy = (root, id, draftText) => forgeDraft(root, id, T_POLICY, draftText);

// Response expectations ------------------------------------------------------
// F: a direct failure { ok, code, error, target } (two-space JSON, one final LF, empty stderr).
function expectF(check, label, r, { code, exit, error = null, target }) {
  check(r.code === exit, `${label}: exit code ${exit}`, { code: r.code, stdout: r.stdout.slice(0, 300), stderr: r.stderr.slice(0, 200) });
  check(r.stderr === '', `${label}: empty stderr`, r.stderr.slice(0, 200));
  check(r.json !== null && fmtOk(r), `${label}: two-space JSON with one final LF`, r.stdout.slice(0, 200));
  if (!r.json) return;
  check(r.json.ok === false && r.json.code === code, `${label}: ok false with code ${code}`, { ok: r.json.ok, code: r.json.code, error: r.json.error });
  if (typeof error === 'string') check(r.json.error === error, `${label}: error is exactly ${show(error)}`, r.json.error);
  if (target !== undefined) {
    check(r.json.target === target, `${label}: target is ${target}`, r.json.target);
    check(eq(sorted(Object.keys(r.json)), ['code', 'error', 'ok', 'target']), `${label}: the envelope holds exactly ok, code, error and target`, Object.keys(r.json));
  }
}
// P: the prepare rejection, one entry per affected target.
function expectP(check, label, r, entries) {
  check(r.code === 3 && r.stderr === '', `${label}: exit 3 with empty stderr`, { code: r.code, stdout: r.stdout.slice(0, 400), stderr: r.stderr.slice(0, 200) });
  check(r.json !== null && fmtOk(r), `${label}: two-space JSON with one final LF`, r.stdout.slice(0, 200));
  check(eq(r.json, { ok: false, code: 'APPLY_PLAN_REJECTED', error: 'plan rejected', errors: entries }), `${label}: the exact plan rejection`, r.json);
}


// ============================================ shared policy-run helpers ====
const RUN_ID = 'run-c12-a';
const REG = { code: REGRESSION_CODE, error: REGRESSION_TEXT, target: T_POLICY };
const MR = { code: 'MIGRATION_REQUIRED', error: MIGRATION_REQUIRED_TEXT, target: T_POLICY };
const MISMATCH = { code: 'MIGRATION_OUTPUT_MISMATCH', error: MISMATCH_TEXT(T_POLICY), target: T_POLICY };
const echoOf = (r) => `${r.stdout}${r.stderr}`;
// One phase outcome. kind "P" is the prepare rejection (one entry), "F" a direct failure; want is "ok" or { code, error, target, exit }.
function expectOutcome(check, label, kind, r, want) {
  if (want === 'ok') {
    check(r.code === 0 && r.json && r.json.ok === true, `${label}: succeeds`, { code: r.code, out: r.stdout.slice(0, 300) });
    return;
  }
  if (kind === 'P') expectP(check, label, r, [{ target: want.target, code: want.code, error: want.error }]);
  else expectF(check, label, r, { code: want.code, exit: want.exit || 3, error: want.error, target: want.target });
  if (want.code === REGRESSION_CODE) {
    check(!echoOf(r).includes(MARKER) && !C1_ECHO.test(echoOf(r)), `${label}: neither the rejected content nor a C1 message is echoed`, echoOf(r).slice(0, 300));
    check(!/"(files|vault|diff|plan|planSha256)"/.test(r.stdout), `${label}: no review content, plan or plan hash is rendered`, r.stdout.slice(0, 200));
  }
}
// The prepared state every forged phase starts from: a begun run, and a clone of it holding a valid additive policy draft that prepare accepted with the exact path approval.
function preparedState(kit, check, dir, base, label, benign, approve = [T_POLICY]) {
  const b0 = cloneBase(dir, base, `${label}-b0`);
  if (!kit.begin(b0, RUN_ID)) return null;
  const bp = cloneTree(b0, path.join(dir, `${label}-bp`));
  putDraft(bp, RUN_ID, T_POLICY, benign);
  const prep = kit.prepare(bp, RUN_ID, { approve });
  check(prep.code === 0 && prep.json && prep.json.ok === true, `${label}: the benign additive draft prepares`, { code: prep.code, out: prep.stdout.slice(0, 300) });
  if (!(prep.code === 0 && prep.json && prep.json.ok === true)) return null;
  const plan = readPlan(bp, RUN_ID);
  check(plan && plan.ops.some((o) => o.target === T_POLICY && o.action === 'modify') && !('security' in plan), `${label}: the benign plan holds a policy modify operation and no security evidence`, plan && plan.ops.map((o) => [o.target, o.action]));
  return { b0, bp, sha: prep.json.planSha256, dir, label };
}
// A matrix row: the same draft is exercised through prepare, the unprepared diff, the prepared diff of a rewritten plan and the commit of that plan.
// row = { label, draft, consumers, approve, extra (extra drafts), expect: { prepare, diff, prepared, commit } } with REG as the default for every phase.
function runRow(kit, check, state, row, n) {
  const want = { prepare: REG, diff: REG, prepared: REG, commit: REG, ...(row.expect || {}) };
  const tag = `${state.label}/${row.label}`;
  const p = cloneTree(state.b0, path.join(state.dir, `${state.label}-p${n}`));
  if (row.consumers) addConsumer(p);
  putDraft(p, RUN_ID, T_POLICY, row.draft);
  for (const [rel, data] of Object.entries(row.extra || {})) putDraft(p, RUN_ID, rel, data);
  let before = noWriteState(p, RUN_ID);
  const r1 = kit.prepare(p, RUN_ID, { approve: row.approve || [] });
  expectOutcome(check, `${tag} prepare`, 'P', r1, want.prepare);
  if (want.prepare !== 'ok') checkNoWrite(check, `${tag} prepare`, p, RUN_ID, before);
  if (want.prepare !== 'ok') {
    before = noWriteState(p, RUN_ID);
    const r2 = kit.diff(p, RUN_ID);
    expectOutcome(check, `${tag} unprepared diff`, 'F', r2, want.diff);
    check(projectSnapshot(p) === before.project, `${tag} unprepared diff: nothing is written`);
  }
  if (row.forged === false) return;
  const f = cloneTree(state.bp, path.join(state.dir, `${state.label}-f${n}`));
  const sha2 = forgePolicy(f, RUN_ID, row.draft);
  if (row.consumers) addConsumer(f);
  before = noWriteState(f, RUN_ID);
  const r3 = kit.diff(f, RUN_ID);
  expectOutcome(check, `${tag} prepared diff (rewritten plan, consistent bindings)`, 'F', r3, want.prepared);
  check(projectSnapshot(f) === before.project, `${tag} prepared diff: nothing is written`);
  const r4 = kit.commit(f, RUN_ID, sha2);
  expectOutcome(check, `${tag} commit (bound, hash-approved forged plan)`, 'F', r4, want.commit);
  if (want.commit !== 'ok') checkNoWrite(check, `${tag} commit`, f, RUN_ID, before);
}

// ======================================================= R80/C12/policy-gates ====
// Plan C12-4 and C12-5: the private gate, its fixed code, exit and text, its placement relative to the earlier errors, and every refusal row of the matrix. Fixtures are synthetic ASCII; every refusal asserts that no
// project, manifest, lock, plan, request or journal byte changed and that neither the rejected content nor a C1 message is echoed.
async function policyGates(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const kit = makeKit(context, check);
    const s1 = await useBase(failures, 'schema-1 policy', getS1Base, context);
    const s2 = await useBase(failures, 'schema-2 policy', getS2Base, context);
    const s1full = await useBase(failures, 'schema-1 policy recorded as full', getS1FullBase, context);
    const mig = await useBase(failures, 'migration', getMigBase, context);
    const sh = shipped(context);
    const S1 = policyS1(context);
    const S2 = policyS2(context);
    const withoutGlob = (list, glob) => list.filter((e) => e.glob !== glob);
    await withScratch(context, 'gates', async (dir) => {
      if (s1) {
        const state = preparedState(kit, check, dir, s1, 's1', jsonText({ ...S1, patterns: [...S1.patterns, BENIGN] }));
        await step('schema 1 installed: invalid or lowering-free drafts that lose installed patterns are refused in prepare, both diffs and commit with the fixed text, with and without runtime consumers', async () => {
          if (!state) return;
          const rows = [
            { label: 'invalid JSON', draft: `{ "schema": 1, "patterns": [ "${MARKER}` },
            { label: 'C1-invalid schema-1 policy', draft: jsonText({ schema: 1, patterns: [{ glob: `[${MARKER}`, kind: 'dir' }] }) },
            { label: 'shipped schema-1 defaults replace the additions', draft: sh.text },
            { label: 'shipped defaults replace the additions even when the content approval is supplied (approval cannot bypass the gate)', draft: sh.text, approve: [T_POLICY] },
            { label: 'shipped defaults replace the additions with runtime consumers installed', draft: sh.text, consumers: true },
            { label: 'one managed identity removed in a schema-1 draft', draft: jsonText({ schema: 1, patterns: withoutGlob(S1.patterns, '**/*.pem') }) },
            { label: 'one managed identity removed in a schema-1 draft with runtime consumers installed', draft: jsonText({ schema: 1, patterns: withoutGlob(S1.patterns, '**/*.pem') }), consumers: true },
            { label: 'one managed identity removed in a schema-2 draft without consumers', draft: jsonText({ schema: 2, patterns: withoutGlob(anchored(S1.patterns), '**/*.pem'), projectPatterns: [] }) },
            { label: 'C1-invalid schema-2 draft without consumers', draft: jsonText({ schema: 2, patterns: [{ anchor: 'any', glob: `**/[${MARKER}`, kind: 'dir' }], projectPatterns: [] }) },
          ];
          rows.forEach((row, i) => runRow(kit, check, state, row, i));
        });
        await step('schema 1 installed with runtime consumers: a schema-2 draft needs the existing workflow first (MIGRATION_REQUIRED in prepare, unprepared diff and commit), while the prepared diff has no workflow check and reaches the gate', async () => {
          if (!state) return;
          const rows = [
            { label: 'one managed identity removed in a schema-2 draft', consumers: true, draft: jsonText({ schema: 2, patterns: withoutGlob(anchored(S1.patterns), '**/*.pem'), projectPatterns: [] }), expect: { prepare: MR, diff: MR, commit: MR, prepared: REG } },
            { label: 'C1-invalid schema-2 draft (the workflow gate also applies)', consumers: true, draft: jsonText({ schema: 2, patterns: [{ anchor: 'any', glob: `**/[${MARKER}`, kind: 'dir' }], projectPatterns: [] }), expect: { prepare: MR, diff: MR, commit: MR, prepared: REG } },
            { label: 'conversion to schema 2 with every identity retained (no regression, workflow still required)', consumers: true, draft: jsonText({ schema: 2, patterns: anchored(S1.patterns), projectPatterns: [] }), approve: [T_POLICY], expect: { prepare: MR, diff: MR, commit: MR, prepared: 'ok' } },
          ];
          rows.forEach((row, i) => runRow(kit, check, state, row, 20 + i));
        });
      }
      if (s1full) {
        const state = preparedState(kit, check, dir, s1full, 's1full', jsonText({ ...S1, patterns: [...S1.patterns, BENIGN] }), []);
        await step('with a manifest that records the policy as fully managed, the gate still comes first at commit: a forged plan whose manifest no longer matches its rewritten draft is the regression, never the manifest mismatch', async () => {
          if (!state) return;
          const f = cloneTree(state.bp, path.join(dir, 's1full-forged'));
          const draft = sh.text;
          const sha2 = forgePolicy(f, RUN_ID, draft);
          const before = noWriteState(f, RUN_ID);
          expectOutcome(check, 'a fully managed policy rewritten into a regression: commit', 'F', kit.commit(f, RUN_ID, sha2), REG);
          checkNoWrite(check, 'a fully managed policy rewritten into a regression: commit', f, RUN_ID, before);
          // control: the same rewritten plan with a harmless draft reaches the manifest check, so the manifest really would have refused it
          const g = cloneTree(state.bp, path.join(dir, 's1full-control'));
          const sha3 = forgePolicy(g, RUN_ID, jsonText({ ...S1, patterns: [...S1.patterns, { anchor: 'root', glob: 'zz-other/**' }] }));
          const c = kit.commit(g, RUN_ID, sha3);
          check(c.code === 4 && c.json && c.json.ok === false && c.json.code === 'APPLY_MANIFEST_MISMATCH', 'control: a harmless rewrite of the same plan is refused by the manifest check (exit 4), proving the ordering above is meaningful', { code: c.code, out: c.stdout.slice(0, 300) });
        });
      }
      if (s1) {
        await step('the gate comes before the complete-unit check: a run holding the seven runtime drafts with an altered core and a regression policy draft reports the regression in prepare, the unprepared diff, the prepared diff of a rewritten plan and commit', async () => {
          const sh2 = shipped(context);
          const core = 'guard-raw-git-core.mjs';
          const staleCore = `${sh2.tools[core]}\n// c12 stale core\n`;
          const b0 = cloneBase(dir, s1, 'order-b0');
          if (!kit.begin(b0, RUN_ID)) return;
          const unitDrafts = (root, coreText) => { for (const m of RUNTIME_MEMBERS) putDraft(root, RUN_ID, `.ai/tools/${m}`, m === core ? coreText : sh2.tools[m]); };
          // prepare and the unprepared diff
          const p = cloneTree(b0, path.join(dir, 'order-p'));
          unitDrafts(p, staleCore);
          putDraft(p, RUN_ID, T_POLICY, sh2.text);
          const before = noWriteState(p, RUN_ID);
          expectOutcome(check, 'regression plus an altered runtime core: prepare', 'P', kit.prepare(p, RUN_ID, { approve: [T_POLICY] }), REG);
          checkNoWrite(check, 'regression plus an altered runtime core: prepare', p, RUN_ID, before);
          expectOutcome(check, 'regression plus an altered runtime core: unprepared diff', 'F', kit.diff(p, RUN_ID), REG);
          // the prepared diff and commit of a rewritten plan that was valid when prepared
          const bp = cloneTree(b0, path.join(dir, 'order-bp'));
          unitDrafts(bp, sh2.tools[core]);
          putDraft(bp, RUN_ID, T_POLICY, jsonText({ ...S1, patterns: [...S1.patterns, BENIGN] }));
          const prep = kit.prepare(bp, RUN_ID, { approve: [T_POLICY] });
          check(prep.code === 0 && prep.json && prep.json.ok === true, 'the seven runtime drafts with an additive policy draft prepare', { code: prep.code, out: prep.stdout.slice(0, 300) });
          if (prep.code !== 0) return;
          forgeDraft(bp, RUN_ID, CORE_TARGET, staleCore);
          const sha2 = forgePolicy(bp, RUN_ID, sh2.text);
          const snap = noWriteState(bp, RUN_ID);
          expectOutcome(check, 'rewritten plan with an altered core and a regression: prepared diff', 'F', kit.diff(bp, RUN_ID), REG);
          expectOutcome(check, 'rewritten plan with an altered core and a regression: commit', 'F', kit.commit(bp, RUN_ID, sha2), REG);
          checkNoWrite(check, 'rewritten plan with an altered core and a regression: commit', bp, RUN_ID, snap);
        });
      }
      if (s2) {
        const state = preparedState(kit, check, dir, s2, 's2', jsonText({ ...S2, patterns: [...S2.patterns, BENIGN] }));
        await step('schema 2 installed: a downgrade, an invalid draft and the loss of a managed or project identity (removed, renamed, narrowed or moved to managed patterns) are refused without consumers', async () => {
          if (!state) return;
          const rawShipped = sh.policy.patterns;
          const keepProject = [P1, P2];
          const rows = [
            { label: 'schema 2 replaced by schema 1 with every identity kept (only the schema lowers)', draft: jsonText({ schema: 1, patterns: rawShipped, projectPatterns: keepProject }) },
            { label: 'schema 2 replaced by the shipped schema-1 defaults', draft: sh.text },
            { label: 'schema-2 draft that is C1-invalid', draft: jsonText({ schema: 2, patterns: S2.patterns, projectPatterns: [{ anchor: 'any', glob: `**/[${MARKER}` }] }) },
            { label: 'one managed identity removed', draft: jsonText({ ...S2, patterns: withoutGlob(S2.patterns, '**/*.pem') }) },
            { label: 'one project identity removed', draft: jsonText({ ...S2, projectPatterns: [P2] }) },
            { label: 'one project identity renamed', draft: jsonText({ ...S2, projectPatterns: [{ ...P1, glob: 'internal-secrets-renamed/**' }, P2] }) },
            { label: 'one project identity narrowed', draft: jsonText({ ...S2, projectPatterns: [{ ...P1, glob: 'internal-secrets/sub/**' }, P2] }) },
            { label: 'one project identity moved to managed patterns', draft: jsonText({ ...S2, patterns: [...S2.patterns, P1], projectPatterns: [P2] }) },
          ];
          rows.forEach((row, i) => runRow(kit, check, state, row, i));
        });
        await step('schema 2 installed with runtime consumers: the workflow requirement comes first in prepare, unprepared diff and commit; a schema-1 downgrade is not a workflow draft and reaches the gate everywhere', async () => {
          if (!state) return;
          const rows = [
            { label: 'one managed identity removed', consumers: true, draft: jsonText({ ...S2, patterns: withoutGlob(S2.patterns, '**/*.pem') }), expect: { prepare: MR, diff: MR, commit: MR, prepared: REG } },
            { label: 'one project identity removed', consumers: true, draft: jsonText({ ...S2, projectPatterns: [P2] }), expect: { prepare: MR, diff: MR, commit: MR, prepared: REG } },
            { label: 'one project identity moved to managed patterns', consumers: true, draft: jsonText({ ...S2, patterns: [...S2.patterns, P1], projectPatterns: [P2] }), expect: { prepare: MR, diff: MR, commit: MR, prepared: REG } },
            { label: 'schema 2 replaced by schema 1', consumers: true, draft: jsonText({ schema: 1, patterns: sh.policy.patterns, projectPatterns: [P1, P2] }) },
            { label: 'an additive schema-2 draft keeps the existing workflow requirement', consumers: true, draft: jsonText({ ...S2, patterns: [...S2.patterns, BENIGN, { anchor: 'root', glob: 'zz-another/**' }] }), approve: [T_POLICY], expect: { prepare: MR, diff: MR, commit: MR, prepared: 'ok' } },
          ];
          rows.forEach((row, i) => runRow(kit, check, state, row, 30 + i));
        });
        await step('a refusal never reports an earlier-error run twice and never evaluates approvals: structural and secret-target refusals win, ordinary approvals are not evaluated, and an unrelated approval changes nothing', async () => {
          if (!state) return;
          const regression = jsonText({ ...S2, projectPatterns: [P2] });
          // earlier structural refusals (write scope and a secret target) win; the gate is never evaluated and there is no regression entry (with the policy approval supplied, only the earlier refusal remains)
          for (const [label, rel, code, errorText] of [['a write outside the documentation scope', 'src/x.ts', 'APPLY_WRITE_SCOPE', 'write outside documentation scope: src/x.ts'], ['a secret-pattern target', 'secrets/c12-note.txt', 'APPLY_SECRET_TARGET', 'agent drafts may not target secret-pattern paths']]) {
            const c = cloneTree(state.b0, path.join(dir, `s2-struct-${rel.replace(/\W/g, '')}`));
            putDraft(c, RUN_ID, T_POLICY, regression);
            putDraft(c, RUN_ID, rel, 'x\n');
            const before = noWriteState(c, RUN_ID);
            const r = kit.prepare(c, RUN_ID, { approve: [T_POLICY] });
            expectP(check, `${label}: prepare reports only the earlier refusal`, r, [{ target: rel, code, error: errorText }]);
            checkNoWrite(check, `${label}: prepare`, c, RUN_ID, before);
            const d = kit.diff(c, RUN_ID);
            check(d.code === 3 && d.json && d.json.ok === false && d.json.code === code && d.json.code !== REGRESSION_CODE, `${label}: the unprepared diff reports the same earlier refusal, not the regression`, { code: d.code, out: d.stdout.slice(0, 300) });
          }
          // an ordinary approval requirement (a pre-existing docs/guide.md changed outside managed blocks) and an unrelated approval are never evaluated: only the regression control entry
          const a = cloneTree(state.b0, path.join(dir, 's2-approvals'));
          putDraft(a, RUN_ID, T_POLICY, regression);
          putDraft(a, RUN_ID, 'docs/guide.md', '# guide\n\nchanged by the draft\n');
          const before = noWriteState(a, RUN_ID);
          expectP(check, 'regression plus an ordinary approval requirement: only the regression control refusal', kit.prepare(a, RUN_ID, {}), [{ target: T_POLICY, code: REGRESSION_CODE, error: REGRESSION_TEXT }]);
          expectP(check, 'regression plus an unrelated approval: only the regression control refusal', kit.prepare(a, RUN_ID, { approve: ['docs/not-needed.md'] }), [{ target: T_POLICY, code: REGRESSION_CODE, error: REGRESSION_TEXT }]);
          expectP(check, 'regression with both approvals supplied: still only the regression control refusal', kit.prepare(a, RUN_ID, { approve: [T_POLICY, 'docs/guide.md'] }), [{ target: T_POLICY, code: REGRESSION_CODE, error: REGRESSION_TEXT }]);
          checkNoWrite(check, 'the approval cases: prepare', a, RUN_ID, before);
        });
        await step('binding drift keeps its precedence on a prepared plan: a draft or the installed policy changed after prepare is APPLY_DRIFT (exit 4) in the prepared diff and in commit, even when the plan was rewritten into a regression', async () => {
          if (!state) return;
          const regression = jsonText({ ...S2, projectPatterns: [P2] });
          for (const [label, mutate] of [
            ['a draft changed after prepare', (r) => fs.appendFileSync(draftPath(r, RUN_ID, T_POLICY), '\n')],
            ['the installed policy changed after prepare', (r) => fs.appendFileSync(projPath(r, T_POLICY), '\n')],
          ]) {
            const f = cloneTree(state.bp, path.join(dir, `s2-drift-${label.split(' ')[1]}`));
            const sha2 = forgePolicy(f, RUN_ID, regression);
            mutate(f);
            const before = noWriteState(f, RUN_ID);
            const d = kit.diff(f, RUN_ID);
            check(d.code === 4 && d.json && d.json.ok === false && d.json.code === 'APPLY_DRIFT' && d.json.error === DRIFT_TEXT, `${label}: the prepared diff is APPLY_DRIFT with exit 4`, { code: d.code, out: d.stdout.slice(0, 300) });
            const c = kit.commit(f, RUN_ID, sha2);
            check(c.code === 4 && c.json && c.json.ok === false && c.json.code === 'APPLY_DRIFT' && c.json.error === DRIFT_TEXT, `${label}: commit is APPLY_DRIFT with exit 4`, { code: c.code, out: c.stdout.slice(0, 300) });
            checkNoWrite(check, `${label}: commit`, f, RUN_ID, before);
          }
        });
        if (state) await aliasGates(context, kit, check, step, dir, state, S2);
      }
      if (mig) {
        await migrationGates(context, kit, check, step, dir, mig);
      }
    });
    flushProcessCount(context, 'R80/C12/policy-gates', mark);
  });
}

// The decisions rows (valid decisions, a rewritten plan carrying plan.security, and the C3 error precedence), on the schema-2 migration base.
function decisionsFor(report, rep) {
  const entries = []; const coverage = [];
  for (const r of report.requiredDecisions) {
    if (r.id.startsWith('coverage:')) { coverage.push({ id: r.id, action: 'include' }); continue; }
    const e = report.entries.find((x) => x.id === r.id);
    entries.push({ id: r.id, action: e.classification === 'deletion' ? 'omit' : 'project' });
  }
  return { schema: 1, reportSha256: rep.reportSha256, entries, coverage, denyOmissions: [], dropDenyOwnership: [], overrideUserExceptions: false };
}
// A prepared migration: begin, report, decisions, stage and a prepare that approves exactly the paths the run asks for. Returns the state each row clones.
function migrationRun(kit, check, dir, base, label, id = RUN_ID) {
  const root = cloneBase(dir, base, `${label}-begin`);
  if (!kit.begin(root, id)) return null;
  const rep = kit.report(root);
  check(rep.code === 0 && rep.json && rep.json.ok === true && rep.json.report, `${label}: the migration report succeeds`, rep.stdout.slice(0, 300));
  if (!(rep.json && rep.json.report)) return null;
  const decisions = decisionsFor(rep.json.report, rep.json);
  return { begun: root, report: rep.json.report, reportJson: rep.json, decisions, id, dir, label, kit, check };
}
function stagedMigration(m, label) {
  const root = cloneTree(m.begun, path.join(m.dir, `${m.label}-${label}`));
  putRequest(root, m.id, T_DECISIONS, m.decisions);
  const st = m.kit.stage(root, m.id);
  m.check(st.code === 0 && st.json && st.json.ok === true, `${m.label}/${label}: stage succeeds`, st.stdout.slice(0, 300));
  return st.code === 0 ? root : null;
}
function prepareApproving(kit, root, id, approve = [T_POLICY]) {
  let list = [...approve];
  let last = null;
  for (let i = 0; i < 4; i++) {
    last = kit.prepare(root, id, { approve: list });
    if (last.code === 0) break;
    const errors = (last.json && last.json.errors) || [];
    if (!errors.length || errors.some((e) => e.code !== 'APPLY_APPROVAL_REQUIRED')) break;
    const need = errors.map((e) => e.target).filter((t) => !list.includes(t));
    if (!need.length) break;
    list = [...list, ...need];
  }
  return { prep: last, approved: list, ok: last.code === 0 && last.json && last.json.ok === true, sha: last.json && last.json.planSha256 };
}
async function migrationGates(context, kit, check, step, dir, base) {
  const m = migrationRun(kit, check, dir, base, 'mig');
  if (!m) return;
  const sh = shipped(context);
  const invalidJson = `{ "schema": 2, "patterns": [ "${MARKER}`;
  const downgrade = jsonText({ schema: 1, patterns: sh.policy.patterns });
  const staged = stagedMigration(m, 'staged');
  const preparedRoot = staged ? cloneTree(staged, path.join(dir, 'mig-prepared')) : null;
  const prep = preparedRoot ? prepareApproving(kit, preparedRoot, m.id) : null;
  check(prep && prep.ok === true, 'the valid staged migration prepares (the evidence all later rows rewrite)', prep && { approved: prep.approved, out: prep.prep.stdout.slice(0, 300) });
  await step('valid decisions with an invalid or lowering draft: MIGRATION_OUTPUT_MISMATCH in prepare, the unprepared diff and the prepared diff of a rewritten plan carrying plan.security; the bound, hash-approved forged plan reaches APPLY_POLICY_REGRESSION in commit', async () => {
    if (!staged || !prep || !prep.ok) return;
    const plan0 = readPlan(preparedRoot, m.id);
    check(plan0 && plan0.security && typeof plan0.security.decisionsSha256 === 'string', 'the valid prepared migration carries plan.security', plan0 && Object.keys(plan0));
    for (const [label, draft] of [['an invalid JSON draft', invalidJson], ['a schema-2 policy replaced by schema 1 (downgrade)', downgrade]]) {
      const tag = `decisions + ${label}`;
      const p = cloneTree(staged, path.join(dir, `mig-p-${label.split(' ')[1]}`));
      putDraft(p, m.id, T_POLICY, draft);
      let before = noWriteState(p, m.id);
      expectP(check, `${tag}: prepare`, kit.prepare(p, m.id, { approve: [T_POLICY] }), [{ target: T_POLICY, code: MISMATCH.code, error: MISMATCH.error }]);
      checkNoWrite(check, `${tag}: prepare`, p, m.id, before);
      before = noWriteState(p, m.id);
      expectF(check, `${tag}: unprepared diff`, kit.diff(p, m.id), { code: MISMATCH.code, exit: 3, error: MISMATCH.error, target: T_POLICY });
      check(projectSnapshot(p) === before.project, `${tag}: the unprepared diff writes nothing`);
      const f = cloneTree(preparedRoot, path.join(dir, `mig-f-${label.split(' ')[1]}`));
      const sha2 = forgePolicy(f, m.id, draft);
      check(readPlan(f, m.id).security !== undefined, `${tag}: the rewritten plan still carries plan.security`);
      before = noWriteState(f, m.id);
      expectF(check, `${tag}: prepared diff of the rewritten plan`, kit.diff(f, m.id), { code: MISMATCH.code, exit: 3, error: MISMATCH.error, target: T_POLICY });
      check(projectSnapshot(f) === before.project, `${tag}: the prepared diff writes nothing`);
      const r = kit.commit(f, m.id, sha2);
      expectOutcome(check, `${tag}: commit of the bound, hash-approved forged plan`, 'F', r, REG);
      checkNoWrite(check, `${tag}: commit`, f, m.id, before);
    }
    // the gate also comes before the migration tool-unit check at commit: an altered core draft in the same forged plan does not change the refusal
    const both = cloneTree(preparedRoot, path.join(dir, 'mig-f-both'));
    forgeDraft(both, m.id, CORE_TARGET, `${readText(draftPath(both, m.id, CORE_TARGET))}\n// c12 stale core\n`);
    const shaBoth = forgePolicy(both, m.id, invalidJson);
    const beforeBoth = noWriteState(both, m.id);
    expectOutcome(check, 'decisions + an invalid policy draft and an altered core draft: commit', 'F', kit.commit(both, m.id, shaBoth), REG);
    checkNoWrite(check, 'decisions + invalid policy and altered core: commit', both, m.id, beforeBoth);
  });
  await step('project-pattern loss and a downgrade stay forbidden at commit even with plan.security (a forged plan that drops an installed project identity)', async () => {
    if (!staged || !prep || !prep.ok) return;
    const dropProject = (() => { const d = JSON.parse(readText(draftPath(preparedRoot, m.id, T_POLICY))); d.projectPatterns = d.projectPatterns.filter((e) => e.glob !== P1.glob); return jsonText(d); })();
    const f = cloneTree(preparedRoot, path.join(dir, 'mig-f-projectloss'));
    const sha2 = forgePolicy(f, m.id, dropProject);
    const before = noWriteState(f, m.id);
    const r = kit.commit(f, m.id, sha2);
    expectOutcome(check, 'plan.security present: a draft that drops an installed project identity is refused at commit', 'F', r, REG);
    checkNoWrite(check, 'project-pattern loss: commit', f, m.id, before);
    // managed-pattern loss keeps C3's reviewed semantics: the valid staged migration itself omits and moves managed entries, so its own commit is not refused by the gate
    const ok = cloneTree(preparedRoot, path.join(dir, 'mig-f-valid'));
    const c = kit.commit(ok, m.id, prep.sha);
    check(c.code === 0 && c.json && c.json.ok === true && c.json.committed === true, 'the valid reviewed migration (managed move, omission and broader environment replacement) commits', { code: c.code, out: c.stdout.slice(0, 300) });
  });
  await step('malformed, stale, incomplete and inconsistent decisions keep their existing C3 code, in prepare and the unprepared diff, ahead of the policy gate (an invalid policy draft is present in each run)', async () => {
    const good = m.decisions;
    const dropOne = { ...good, coverage: good.coverage.slice(1) };
    const variants = [
      ['malformed decisions (not the documented shape)', '{}', 'MIGRATION_DECISIONS'],
      ['malformed decisions (not JSON)', '{ not json', 'MIGRATION_DECISIONS'],
      ['a stale report hash', { ...good, reportSha256: '0'.repeat(64) }, 'MIGRATION_REPORT_CHANGED'],
      ['an incomplete decision list', dropOne, 'MIGRATION_DECISION_REQUIRED'],
      ['an inconsistent action (a choice the report does not offer)', { ...good, entries: good.entries.map((e, i) => (i === 0 ? { ...e, action: 'restore' } : e)) }, 'MIGRATION_DECISIONS'],
    ];
    variants.forEach(([label, dec, code], i) => {
      const c = cloneTree(m.begun, path.join(dir, `mig-dec-${i}`));
      putDraft(c, m.id, T_POLICY, invalidJson);
      putRequest(c, m.id, T_DECISIONS, dec);
      const before = noWriteState(c, m.id);
      const r = kit.prepare(c, m.id, { approve: [T_POLICY] });
      const entry = r.json && Array.isArray(r.json.errors) ? r.json.errors : [];
      check(r.code === 3 && r.stderr === '' && r.json && r.json.code === 'APPLY_PLAN_REJECTED' && entry.length === 1 && entry[0].code === code && entry[0].error.startsWith(`${code}: `) && entry[0].code !== REGRESSION_CODE, `${label}: prepare reports exactly ${code}`, { code: r.code, out: r.stdout.slice(0, 300) });
      checkNoWrite(check, `${label}: prepare`, c, m.id, before);
      const d = kit.diff(c, m.id);
      check(d.code === 3 && d.json && d.json.ok === false && d.json.code === code && d.json.code !== REGRESSION_CODE && typeof d.json.error === 'string' && d.json.error.startsWith(`${code}: `), `${label}: the unprepared diff reports exactly ${code}`, { code: d.code, out: d.stdout.slice(0, 300) });
      check(projectSnapshot(c) === before.project, `${label}: the unprepared diff writes nothing`);
    });
  });
}


// ============================================ I12-2: case-variant aliases of protected targets ====
// Decision I12-2 (docs/plans/2026-10-21-project-setup-v3-rc1-c12-decisions.md, review finding C12-R1; it wins over the frozen plan). The policy gate, the C3 workflow gate and the control-file handling select targets by exact string, so on a
// case-insensitive filesystem a draft spelled `.ai/SECURITY-PATHS.JSON` writes the installed policy past all three. apply.mjs refuses, with the existing code APPLY_PATH and its existing text `unsafe path: <target>`, any draft target or
// declared transaction input whose ASCII case fold equals a protected canonical target but whose spelling differs. Protected: the two control files, every runtime-unit target of the shipped catalog and (decision I12-2a, which wins) the
// manifest `.ai/manifest.json`, whose canonical spelling keeps APPLY_MANIFEST_DRAFT. The refusal runs before approvals in
// prepare and in loading a prepared plan for both diffs and commit, on every platform. The canonical spelling is not this refusal, a name that differs by more than case is not, and neither is a name that folds to a protected target only
// under a Unicode fold (the rule names the ASCII fold).
//
// Readings recorded by decision I12-2a (they were PLAN-GAPs when the tests were written):
// - exit and envelope: the decision says "its existing text and exit" without a number. APPLY_PATH has two existing exits: the thrown unsafe path of a link, junction or escape (exit 2, text built from the run-relative source) and the
//   per-target refusal that returns { code, error } (exit 3; in prepare one APPLY_PLAN_REJECTED entry, in the diffs and commit a direct { ok, code, error } failure). Only the second carries the text `unsafe path: <target>` with the target as
//   written (declaredInputRefusal, checkSource), so the tests pin it: exit 3, prepare as the exact plan rejection, every other phase as the three-key envelope. A reading as exit 2 would change ALIAS_EXIT and expectAliasP.
// - order: the refusal is asserted for `.claude/` aliases on every platform; on a case-sensitive filesystem `.claude/SETTINGS.JSON` is also outside the write allowlist, so it must come before the write-scope check.
// - fold: ASCII only (A-Z to a-z); a name that folds to a protected target only under Unicode case rules keeps its existing outcome (the controls below).
// - an alias inside a forged plan's metadata.transactionInputs keeps the existing APPLY_PLAN_INVALID (exit 1), pinned by the forged-input rows.
//
// Decision I12-4 (review round 2, C12-R3 and C12-R4; written before the implementation): the same refusal covers the other Windows spellings of a protected target. Compared per component, as C1 does (security-policy.mjs, `alternatives`): the
// ASCII case fold, the prefix before the component's first ":" (an NTFS stream suffix such as "::$DATA"), and both with trailing ASCII dots and spaces removed. A name with any such form equal to a protected target whose spelling differs
// is APPLY_PATH, at the same boundaries and in the same order (before the write scope, so `.claude./settings.json` is APPLY_PATH, not APPLY_WRITE_SCOPE). The fold stays ASCII only. 8.3 short names are not modelled. C12-R4: the protected
// runtime targets come from the catalog's target list alone (a missing runtime source cannot empty it); an unreadable catalog fails closed for names under `.ai/tools/` whose spelling is not its own canonical form.
// Reading of the platform: Node addresses Windows paths with the extended prefix, so a draft file spelled with a trailing dot or space is a literal, distinct name there, while a "::$DATA" draft is the default stream of the canonical file. A
// draft row whose spelling the drafts directory does not list as written (the stream forms on Windows) is therefore recorded in the diagnostics and left out of the draft rows (never a skip); the same spelling is still covered as a declared
// input and as the operation of a forged plan, where it is only text. PLAN-GAP: C12-R3 describes a plan whose source inventory keeps the canonical draft name while the operation names the alias; it is bound consistently only where the
// alias resolves to the canonical draft (the stream form here); elsewhere the plan is refused by the alias rule before any binding is compared, which is what the rows assert.
const ALIAS_CODE = 'APPLY_PATH';
const ALIAS_EXIT = 3;
const aliasText = (t) => `unsafe path: ${t}`;
const RUNTIME_TARGETS = RUNTIME_MEMBERS.map((m) => `.ai/tools/${m}`);
const KELVIN = String.fromCodePoint(0x212a); // U+212A: lower-cases to ASCII "k" with String#toLowerCase, never under the ASCII fold
const LONG_S = String.fromCodePoint(0x17f); // U+017F: upper-cases to ASCII "S" with String#toUpperCase, never under the ASCII fold
const POLICY_ALIASES = ['.ai/SECURITY-PATHS.JSON', '.ai/Security-Paths.json', '.ai/security-paths.jsoN', '.AI/security-paths.json'];
const SETTINGS_ALIASES = ['.claude/SETTINGS.JSON', '.claude/Settings.json', '.claude/settings.jsoN', '.CLAUDE/settings.json'];
const RUNTIME_ALIASES = RUNTIME_MEMBERS.map((m) => `.ai/TOOLS/${m.toUpperCase()}`);
const GIT_SAFE_ALIASES = ['.ai/tools/git-safe.mjS', '.AI/tools/git-safe.mjs'];
const MANIFEST_ALIASES = ['.ai/MANIFEST.JSON', '.ai/Manifest.json', '.ai/manifest.jsoN', '.AI/manifest.json'];
const MANIFEST_DRAFT = { code: 'APPLY_MANIFEST_DRAFT', error: 'the manifest is written by commit, not drafted' };
// I12-4 spellings: trailing dot, trailing space, dot-space-dot, a stream suffix, a trailing dot on a directory component, a case change with a trailing dot, and a stream suffix on a directory component.
const POLICY_SPELLINGS = ['.ai/security-paths.json.', '.ai/security-paths.json ', '.ai/security-paths.json. .', '.ai/security-paths.json::$DATA', '.ai./security-paths.json', '.AI/Security-Paths.json.', '.ai::$INDEX_ALLOCATION/security-paths.json'];
const SETTINGS_SPELLINGS = ['.claude/settings.json.', '.claude/settings.json ', '.claude/settings.json. .', '.claude/settings.json::$DATA', '.claude./settings.json', '.CLAUDE/Settings.json.'];
const MANIFEST_SPELLINGS = ['.ai/manifest.json.', '.ai/manifest.json ', '.ai/manifest.json. .', '.ai/manifest.json::$DATA', '.ai./manifest.json', '.AI/Manifest.json.'];
const RUNTIME_SPELLINGS = ['.ai/tools/git-safe.mjs.', '.ai/tools/git-safe.mjs ', '.ai/tools/git-safe.mjs. .', '.ai/tools/git-safe.mjs::$DATA', '.ai/tools./git-safe.mjs', '.ai./tools/git-safe.mjs', '.AI/TOOLS/Git-Safe.mjs.'];
// The draft every alias row carries: a valid schema-2 policy that drops an installed project identity and holds the marker (so any echo of the rejected content is caught). Written to the alias, it is the regression the gate exists for.
const aliasDraftOf = (S2) => jsonText({ ...S2, projectPatterns: [P2], patterns: [...S2.patterns, { anchor: 'root', glob: `zz-${MARKER}/**`, kind: 'dir' }] });

// The prepare refusal: exactly one APPLY_PATH entry for the alias, as written.
function expectAliasP(check, label, r, target) {
  expectP(check, label, r, [{ target, code: ALIAS_CODE, error: aliasText(target) }]);
  check(!echoOf(r).includes(MARKER), `${label}: the rejected draft content is not echoed`, echoOf(r).slice(0, 300));
}
// A direct refusal (the diffs and commit): the existing APPLY_PATH envelope, nothing rendered, nothing echoed.
function expectAliasF(check, label, r, target) {
  expectF(check, label, r, { code: ALIAS_CODE, exit: ALIAS_EXIT, error: aliasText(target) });
  if (r.json) check(eq(sorted(Object.keys(r.json)), ['code', 'error', 'ok']), `${label}: the envelope holds exactly ok, code and error`, Object.keys(r.json));
  check(!/"(files|vault|diff|plan|planSha256)"/.test(r.stdout), `${label}: no review content, plan or plan hash is rendered`, r.stdout.slice(0, 200));
  check(!echoOf(r).includes(MARKER), `${label}: the rejected draft content is not echoed`, echoOf(r).slice(0, 300));
}
// A prepared run rewritten so its one operation targets `target` (consistent bindings otherwise): the draft moves to that spelling, the operation, the inventory and the bound inputs follow, and the new plan hash is returned. The binding of an
// alias is what the filesystem gives: the installed bytes on a case-insensitive one, absence on a case-sensitive one.
function forgeTargetOp(root, id, target, draftText) {
  const plan = readPlan(root, id);
  const op = plan.ops.find((o) => o.target === T_POLICY);
  const bytes = Buffer.from(draftText, 'utf8');
  rmrf(path.join(runDirOf(root, id), 'drafts'));
  putDraft(root, id, target, bytes);
  const installed = readBytes(projPath(root, target));
  op.target = target;
  op.source = `drafts/${target}`;
  op.sourceSha256 = sha(bytes);
  op.preRawSha = installed === null ? null : sha(installed);
  op.action = installed === null ? 'create' : 'modify';
  plan.sourceInventory = draftNames(root, id).map((t) => ({ target: t, origin: 'draft' })); // what the drafts directory lists (a stream spelling lists the canonical name)
  if (!plan.inputs.some((i) => i.target === target)) plan.inputs = [...plan.inputs, { target, preRawSha: op.preRawSha }];
  const text = jsonText(plan);
  putFile(runFile(root, id, 'plan.json'), text);
  return sha(Buffer.from(text, 'utf8'));
}
// A fresh clone of a run state for one alias phase: every phase gets its own directory.
let aliasSeq = 0;
const aliasClone = (state, base, label) => cloneTree(base, path.join(state.dir, `i122-${++aliasSeq}-${label}`));
// The drafts of a run as the directory lists them: the names an inventory would report.
const draftNames = (root, id) => walkTree(path.join(runDirOf(root, id), 'drafts')).filter(([, kind]) => kind === 'file').map(([rel]) => rel);
// C12-R3: the operation names the alias while the drafts directory, the source inventory and the draft bytes keep the canonical policy draft (a stream spelling resolves to those bytes; a literal spelling is refused before any binding is read).
function forgeKeepingInventory(root, id, alias, draftText) {
  const plan = readPlan(root, id);
  const op = plan.ops.find((o) => o.target === T_POLICY);
  const bytes = Buffer.from(draftText, 'utf8');
  putFile(draftPath(root, id, T_POLICY), bytes);
  const installed = readBytes(projPath(root, alias));
  op.target = alias;
  op.source = `drafts/${alias}`;
  op.sourceSha256 = sha(bytes);
  op.preRawSha = installed === null ? null : sha(installed);
  op.action = installed === null ? 'create' : 'modify';
  if (!plan.inputs.some((i) => i.target === alias)) plan.inputs = [...plan.inputs, { target: alias, preRawSha: op.preRawSha }];
  const text = jsonText(plan);
  putFile(runFile(root, id, 'plan.json'), text);
  return sha(Buffer.from(text, 'utf8'));
}

// Every draft alias: prepare (also with the exact content approval for the rows that carry it), then the unprepared diff, each on its own clone of the begun run.
function aliasDraftRows(context, kit, check, state, rows) {
  rows.forEach((row, i) => {
    const tag = `${row.tag || 'I12-2'} draft alias ${show(row.alias)}${row.consumers ? ' (runtime consumer installed)' : ''}${row.manifest ? ' (manifest installed)' : ''}`;
    const fresh = (kind) => {
      const p = aliasClone(state, state.b0, `d${i}-${kind}`);
      if (row.consumers) addConsumer(p);
      if (row.manifest) putFile(manifestPath(p), jsonText(manifestOf({})));
      try { putDraft(p, RUN_ID, row.alias, row.draft); } catch { /* the name cannot be created here; reported below */ }
      return p;
    };
    // The draft must exist as written for the row to mean anything: where the filesystem lists another name (a stream spelling on Windows) the subcase is recorded and left out, never a skip.
    if (!draftNames(fresh('probe'), RUN_ID).includes(row.alias)) { diag(context, `${tag} left out: this filesystem does not list the draft under that spelling`); return; }
    // The content approval is passed trimmed by the command line, so a spelling with trailing white space has no approval variant.
    for (const approve of row.approve && row.alias === row.alias.trim() ? [[], [row.alias]] : [[]]) {
      const p = fresh(approve.length ? 'pa' : 'p');
      const before = noWriteState(p, RUN_ID);
      const label = `${tag}: prepare${approve.length ? ' with the content approval' : ''}`;
      expectAliasP(check, label, kit.prepare(p, RUN_ID, { approve }), row.alias);
      checkNoWrite(check, label, p, RUN_ID, before);
    }
    const d = fresh('d');
    const before = noWriteState(d, RUN_ID);
    expectAliasF(check, `${tag}: unprepared diff`, kit.diff(d, RUN_ID), row.alias);
    check(projectSnapshot(d) === before.project, `${tag}: the unprepared diff writes nothing`);
  });
}
// A forged prepared plan whose operation targets an alias: the prepared diff and the bound, hash-approved commit both refuse, render nothing and write nothing.
function aliasForgedRows(kit, check, state, aliases, draft, forge = forgeTargetOp, tagPrefix = 'I12-2') {
  aliases.forEach((alias, i) => {
    const tag = `${tagPrefix} forged plan with an operation on ${show(alias)}`;
    const f = aliasClone(state, state.bp, `f${i}`);
    const sha2 = forge(f, RUN_ID, alias, draft);
    const before = noWriteState(f, RUN_ID);
    expectAliasF(check, `${tag}: prepared diff`, kit.diff(f, RUN_ID), alias);
    check(projectSnapshot(f) === before.project, `${tag}: the prepared diff writes nothing`);
    expectAliasF(check, `${tag}: commit of the bound, hash-approved plan`, kit.commit(f, RUN_ID, sha2), alias);
    checkNoWrite(check, `${tag}: commit`, f, RUN_ID, before);
  });
}
// A forged prepared plan whose metadata.transactionInputs holds an alias, with the request file, its bound hash and the bound input all consistent: loading the plan refuses it as APPLY_PLAN_INVALID (exit 1), the existing mapping of a
// refused declared input in a prepared plan (decision I12-2a), in the prepared diff and in the bound, hash-approved commit. Nothing is rendered or written. The same forging with an unrelated input renders, so only the alias is refused.
function forgeDeclaredInput(root, id, input) {
  const plan = readPlan(root, id);
  const list = [input];
  putRequest(root, id, 'transaction-inputs.json', list);
  plan.metadata.transactionInputs = list;
  plan.metadata.transactionInputsSha256 = sha(readBytes(runFile(root, id, 'transaction-inputs.json')));
  const installed = readBytes(projPath(root, input));
  plan.inputs = [...plan.inputs, { target: input, preRawSha: installed === null ? null : sha(installed) }];
  const text = jsonText(plan);
  putFile(runFile(root, id, 'plan.json'), text);
  return sha(Buffer.from(text, 'utf8'));
}
const PLAN_INVALID = { code: 'APPLY_PLAN_INVALID', error: 'invalid prepared plan; run prepare again' };
function expectPlanInvalid(check, label, r) {
  expectF(check, label, r, { code: PLAN_INVALID.code, exit: 1, error: PLAN_INVALID.error });
  if (r.json) check(eq(sorted(Object.keys(r.json)), ['code', 'error', 'ok']), `${label}: the envelope holds exactly ok, code and error`, Object.keys(r.json));
  check(!/"(files|vault|diff|plan|planSha256)"/.test(r.stdout), `${label}: no review content, plan or plan hash is rendered`, r.stdout.slice(0, 200));
}
function aliasForgedInputRows(kit, check, state, aliases) {
  aliases.forEach((alias, i) => {
    const tag = `I12-2a forged plan declaring the input ${show(alias)}`;
    const f = aliasClone(state, state.bp, `fi${i}`);
    const sha2 = forgeDeclaredInput(f, RUN_ID, alias);
    const before = noWriteState(f, RUN_ID);
    expectPlanInvalid(check, `${tag}: prepared diff`, kit.diff(f, RUN_ID));
    check(projectSnapshot(f) === before.project, `${tag}: the prepared diff writes nothing`);
    expectPlanInvalid(check, `${tag}: commit of the bound, hash-approved plan`, kit.commit(f, RUN_ID, sha2));
    checkNoWrite(check, `${tag}: commit`, f, RUN_ID, before);
  });
  // control: the same forging with an input that is no alias keeps every binding consistent, so the refusals above are the alias rule alone
  const g = cloneTree(state.bp, path.join(state.dir, 'i122-fi-control'));
  forgeDeclaredInput(g, RUN_ID, 'docs/Security-Paths.json');
  const before = projectSnapshot(g);
  const d = kit.diff(g, RUN_ID);
  check(d.code === 0 && d.json && d.json.ok === true && d.json.prepared === true, 'I12-2a control: a forged plan declaring an unrelated input renders in the prepared diff', { code: d.code, out: d.stdout.slice(0, 300) });
  check(projectSnapshot(g) === before, 'I12-2a control: the prepared diff writes nothing');
}
// A declared transaction input spelled as an alias: prepare and the unprepared diff refuse it by name; the canonical spelling beside it is not refused.
function aliasInputRows(kit, check, state, aliases, tagPrefix = 'I12-2') {
  aliases.forEach((alias, i) => {
    const tag = `${tagPrefix} declared input ${show(alias)}`;
    const fresh = (kind, inputs) => {
      const p = aliasClone(state, state.b0, `i${i}-${kind}`);
      putRequest(p, RUN_ID, 'transaction-inputs.json', inputs);
      return p;
    };
    const p = fresh('p', [alias]);
    const before = noWriteState(p, RUN_ID);
    expectAliasP(check, `${tag}: prepare`, kit.prepare(p, RUN_ID, {}), alias);
    checkNoWrite(check, `${tag}: prepare`, p, RUN_ID, before);
    const d = fresh('d', [alias]);
    const beforeD = noWriteState(d, RUN_ID);
    expectAliasF(check, `${tag}: unprepared diff`, kit.diff(d, RUN_ID), alias);
    check(projectSnapshot(d) === beforeD.project, `${tag}: the unprepared diff writes nothing`);
  });
  if (tagPrefix === 'I12-2') [[T_SETTINGS, '.claude/SETTINGS.JSON'], [T_MANIFEST, '.ai/MANIFEST.JSON']].forEach(([canonical, alias], i) => {
    const both = cloneTree(state.b0, path.join(state.dir, `i122-i-both${i}`));
    putRequest(both, RUN_ID, 'transaction-inputs.json', [canonical, alias]);
    const beforeBoth = noWriteState(both, RUN_ID);
    expectAliasP(check, `I12-2 declared inputs holding the canonical spelling ${canonical} and its alias: only the alias is refused (prepare)`, kit.prepare(both, RUN_ID, {}), alias);
    checkNoWrite(check, `I12-2 declared canonical spelling ${canonical} and its alias: prepare`, both, RUN_ID, beforeBoth);
  });
}
// Negative controls: names that are not aliases of a protected target are not refused by this rule.
function aliasControls(context, kit, check, state, S2) {
  const names = [
    ['docs/Security-Paths.json', 'the policy file name in another directory'],
    ['.ai/security-paths.json.bak', 'the policy name with a suffix'],
    ['.ai/Tools/notes.md', 'a case-variant directory holding a name no catalog target has'],
    ['.ai/TOOLS/GIT-SAFE.MJS.BAK', 'a runtime-unit name with a suffix'],
    ['docs/security-paths.json.', 'the policy name with a trailing dot in another directory'],
  ];
  const longS = `.ai/security-path${LONG_S}.json`;
  // The long s names the installed policy only on a filesystem that folds it; there the name is an alias the ASCII rule does not cover, so the subcase is recorded and left out (never a skip).
  if (exists(projPath(state.b0, longS))) diag(context, `I12-2 control ${show(longS)} left out: this filesystem folds U+017F onto the installed policy name`);
  else names.push([longS, 'a name that folds to the policy name only under a Unicode upper-casing (the long s)']);
  names.forEach(([name, why], i) => {
    const tag = `I12-2 control ${show(name)} (${why})`;
    const p = cloneTree(state.b0, path.join(state.dir, `i122-c${i}`));
    putDraft(p, RUN_ID, name, aliasDraftOf(S2));
    const r = kit.prepare(p, RUN_ID, {});
    check(r.code === 0 && r.json && r.json.ok === true && r.json.changed === 1 && r.json.ops.length === 1 && r.json.ops[0].target === name && r.json.ops[0].action === 'create', `${tag}: prepare accepts it as a new file`, { code: r.code, out: r.stdout.slice(0, 300) });
    const q = cloneTree(state.b0, path.join(state.dir, `i122-cd${i}`));
    putDraft(q, RUN_ID, name, aliasDraftOf(S2));
    const d = kit.diff(q, RUN_ID);
    check(d.code === 0 && d.json && d.json.ok === true && d.json.prepared === false && Array.isArray(d.json.files) && d.json.files.length === 1 && d.json.files[0].target === name, `${tag}: the unprepared diff renders it`, { code: d.code, out: d.stdout.slice(0, 300) });
  });
  // The Kelvin sign lower-cases to "k" under String#toLowerCase, which is how C1 and C4's complete-unit check match a runtime target, so that existing check still refuses this untrusted draft in its own words. This rule names the ASCII
  // fold: it must not answer with APPLY_PATH, so the refusal is exactly the existing unit refusal (unchanged by I12-2) in prepare and in the unprepared diff.
  const kelvin = `.ai/tools/hoo${KELVIN}s-selftest.mjs`;
  const u = UNREVIEWED('.ai/tools/security-policy.mjs');
  const kp = cloneTree(state.b0, path.join(state.dir, 'i122-c-kelvin-p'));
  putDraft(kp, RUN_ID, kelvin, aliasDraftOf(S2));
  const kBefore = noWriteState(kp, RUN_ID);
  expectP(check, `I12-2 control ${show(kelvin)}: prepare keeps the existing unit refusal, not APPLY_PATH`, kit.prepare(kp, RUN_ID, {}), [{ target: u.target, code: u.code, error: u.error }]);
  checkNoWrite(check, 'I12-2 control: the Kelvin name in prepare', kp, RUN_ID, kBefore);
  const kd = cloneTree(state.b0, path.join(state.dir, 'i122-c-kelvin-d'));
  putDraft(kd, RUN_ID, kelvin, aliasDraftOf(S2));
  expectF(check, `I12-2 control ${show(kelvin)}: the unprepared diff keeps the existing unit refusal, not APPLY_PATH`, kit.diff(kd, RUN_ID), { code: u.code, exit: 3, error: u.error, target: u.target });
  // The canonical settings spelling is accepted as a draft target and as a declared input (the policy and the runtime unit already have canonical controls in this descriptor).
  const c = cloneTree(state.b0, path.join(state.dir, 'i122-c-settings'));
  putDraft(c, RUN_ID, T_SETTINGS, '{}\n');
  const cs = kit.prepare(c, RUN_ID, {});
  check(cs.code === 0 && cs.json && cs.json.ok === true && cs.json.ops.some((o) => o.target === T_SETTINGS && o.action === 'create'), 'I12-2 control: the canonical settings spelling is accepted as a draft target', { code: cs.code, out: cs.stdout.slice(0, 300) });
  const k = cloneTree(state.b0, path.join(state.dir, 'i122-c-inputs'));
  putRequest(k, RUN_ID, 'transaction-inputs.json', [T_SETTINGS, T_POLICY, T_MANIFEST]);
  const ki = kit.prepare(k, RUN_ID, {});
  check(ki.code === 0 && ki.json && ki.json.ok === true, 'I12-2 control: the canonical spellings of both control files and of the manifest are accepted as declared inputs', { code: ki.code, out: ki.stdout.slice(0, 300) });
  // I12-4: a name that merely holds a dot or a colon elsewhere has no form equal to a protected target, so this rule leaves it to the existing checks (which accept these as declared inputs).
  const di = aliasClone(state, state.b0, 'c-dots');
  putRequest(di, RUN_ID, 'transaction-inputs.json', ['.ai/security-paths.json.bak', '.ai/security-paths:json', 'docs/security-paths.json.']);
  const dr = kit.prepare(di, RUN_ID, {});
  check(dr.code === 0 && dr.json && dr.json.ok === true, 'I12-4 control: names that only hold a dot or a colon elsewhere are not refused as declared inputs', { code: dr.code, out: dr.stdout.slice(0, 300) });
  // I12-2a: the canonical manifest spelling keeps its own refusal, as a draft in prepare and in the unprepared diff, and as the operation of a forged plan in the prepared diff (no alias refusal, no other code).
  const mp = cloneTree(state.b0, path.join(state.dir, 'i122-c-manifest-p'));
  putDraft(mp, RUN_ID, T_MANIFEST, aliasDraftOf(S2));
  const mBefore = noWriteState(mp, RUN_ID);
  expectP(check, 'I12-2a control: the canonical manifest draft keeps APPLY_MANIFEST_DRAFT in prepare', kit.prepare(mp, RUN_ID, {}), [{ target: T_MANIFEST, ...MANIFEST_DRAFT }]);
  checkNoWrite(check, 'I12-2a control: the canonical manifest draft in prepare', mp, RUN_ID, mBefore);
  const md = cloneTree(state.b0, path.join(state.dir, 'i122-c-manifest-d'));
  putDraft(md, RUN_ID, T_MANIFEST, aliasDraftOf(S2));
  expectF(check, 'I12-2a control: the canonical manifest draft keeps APPLY_MANIFEST_DRAFT in the unprepared diff', kit.diff(md, RUN_ID), { ...MANIFEST_DRAFT, exit: 3 });
  const mf = cloneTree(state.bp, path.join(state.dir, 'i122-c-manifest-f'));
  forgeTargetOp(mf, RUN_ID, T_MANIFEST, aliasDraftOf(S2));
  expectF(check, 'I12-2a control: a forged plan operating on the canonical manifest keeps APPLY_MANIFEST_DRAFT in the prepared diff', kit.diff(mf, RUN_ID), { ...MANIFEST_DRAFT, exit: 3 });
}
// C12-R4, in isolated copies of the skill (the repository's own files are never touched): the protected runtime targets come from the catalog's target list alone, so a missing runtime source cannot empty it, and an unreadable
// catalog fails closed for names under `.ai/tools/` that are not their own canonical form.
function aliasUnreadableRows(context, kit, check, state, dir) {
  const ALIAS = '.ai/tools/GIT-SAFE.mjs';
  const noSource = copySkillWith(context, path.join(dir, 'i124-skill-nosource'));
  fs.rmSync(path.join(noSource, 'assets', 'tools', 'review-diff.mjs'));
  const kitNoSource = makeKit(context, check, noSource);
  const noCatalog = copySkillWith(context, path.join(dir, 'i124-skill-nocatalog'));
  fs.writeFileSync(path.join(noCatalog, 'data', 'runtime-units.json'), '{ not json');
  const kitNoCatalog = makeKit(context, check, noCatalog);
  const declare = (names) => { const p = aliasClone(state, state.b0, 'r4'); putRequest(p, RUN_ID, 'transaction-inputs.json', names); return p; };
  // a valid catalog, one runtime source missing: a declarations-only plan declaring an alias is still refused by name (prepare and the unprepared diff); a canonical declaration is not refused
  for (const alias of [ALIAS, '.ai/tools/git-safe.mjs.', '.ai/tools/git-safe.mjs::$DATA']) {
    const tag = `I12-4 C12-R4 (a runtime source is missing) declared ${show(alias)}`;
    const p = declare([alias]);
    const before = noWriteState(p, RUN_ID);
    expectAliasP(check, `${tag}: prepare`, kitNoSource.prepare(p, RUN_ID, {}), alias);
    checkNoWrite(check, `${tag}: prepare`, p, RUN_ID, before);
    expectAliasF(check, `${tag}: unprepared diff`, kitNoSource.diff(declare([alias]), RUN_ID), alias);
  }
  const canon = kitNoSource.prepare(declare(['.ai/tools/git-safe.mjs']), RUN_ID, {});
  check(canon.code === 0 && canon.json && canon.json.ok === true, 'I12-4 C12-R4 control: with a runtime source missing, the canonical declaration is not refused by the alias rule', { code: canon.code, out: canon.stdout.slice(0, 300) });
  // the same alias embedded in a forged plan's metadata.transactionInputs: loading the plan refuses it as APPLY_PLAN_INVALID, before the catalog is consulted for anything else
  const f = aliasClone(state, state.bp, 'r4-forged');
  const sha2 = forgeDeclaredInput(f, RUN_ID, ALIAS);
  const fBefore = noWriteState(f, RUN_ID);
  expectPlanInvalid(check, 'I12-4 C12-R4 (a runtime source is missing) forged plan declaring the alias: prepared diff', kitNoSource.diff(f, RUN_ID));
  check(projectSnapshot(f) === fBefore.project, 'I12-4 C12-R4: the prepared diff writes nothing');
  expectPlanInvalid(check, 'I12-4 C12-R4 (a runtime source is missing) forged plan declaring the alias: commit of the bound, hash-approved plan', kitNoSource.commit(f, RUN_ID, sha2));
  checkNoWrite(check, 'I12-4 C12-R4: commit', f, RUN_ID, fBefore);
  // an unreadable catalog: the fixed names stay protected and every non-canonical name under .ai/tools/ is refused, as a declared input and as a draft; a name that is its own canonical form is not
  for (const alias of [ALIAS, '.ai/tools/git-safe.mjs.', '.ai/tools/Brand-New.mjs']) {
    const tag = `I12-4 C12-R4 (the catalog is unreadable) declared ${show(alias)}`;
    const p = declare([alias]);
    const before = noWriteState(p, RUN_ID);
    expectAliasP(check, `${tag}: prepare`, kitNoCatalog.prepare(p, RUN_ID, {}), alias);
    checkNoWrite(check, `${tag}: prepare`, p, RUN_ID, before);
    expectAliasF(check, `${tag}: unprepared diff`, kitNoCatalog.diff(declare([alias]), RUN_ID), alias);
  }
  const draftRoot = aliasClone(state, state.b0, 'r4-draft');
  putDraft(draftRoot, RUN_ID, ALIAS, aliasDraftOf(policyS2(context)));
  const draftBefore = noWriteState(draftRoot, RUN_ID);
  expectAliasP(check, `I12-4 C12-R4 (the catalog is unreadable) draft ${show(ALIAS)}: prepare`, kitNoCatalog.prepare(draftRoot, RUN_ID, {}), ALIAS);
  checkNoWrite(check, 'I12-4 C12-R4 (the catalog is unreadable) draft: prepare', draftRoot, RUN_ID, draftBefore);
  const canonNoCatalog = kitNoCatalog.prepare(declare(['.ai/tools/brand-new.mjs']), RUN_ID, {});
  check(canonNoCatalog.code === 0 && canonNoCatalog.json && canonNoCatalog.json.ok === true, 'I12-4 C12-R4 control: with the catalog unreadable, a name under .ai/tools/ that is its own canonical form is not refused by the alias rule', { code: canonNoCatalog.code, out: canonNoCatalog.stdout.slice(0, 300) });
  const readable = kit.prepare(declare(['.ai/tools/Brand-New.mjs']), RUN_ID, {});
  check(readable.code === 0 && readable.json && readable.json.ok === true, 'I12-4 C12-R4 control: with the catalog readable, a non-canonical name that is no catalog alias is not refused (the fail-closed rule applies only to an unreadable catalog)', { code: readable.code, out: readable.stdout.slice(0, 300) });
}
async function aliasGates(context, kit, check, step, dir, state, S2) {
  const draft = aliasDraftOf(S2);
  await step('I12-2 the alias set covers every protected target: the two control files, the manifest and every runtime-unit target of the shipped catalog', async () => {
    const catalog = readJson(skillPath(context, 'data/runtime-units.json'));
    check(catalog && Array.isArray(catalog.units) && eq(sorted(catalog.units.map((u) => u.target)), sorted(RUNTIME_TARGETS)), 'the runtime-unit targets this test aliases are exactly the catalog targets', catalog && catalog.units && catalog.units.map((u) => u.target));
    const all = [...POLICY_ALIASES, ...SETTINGS_ALIASES, ...MANIFEST_ALIASES, ...RUNTIME_ALIASES, ...GIT_SAFE_ALIASES];
    const protectedTargets = [T_POLICY, T_SETTINGS, T_MANIFEST, ...RUNTIME_TARGETS];
    check(all.every((a) => !protectedTargets.includes(a) && protectedTargets.includes(a.replace(/[A-Z]/g, (ch) => ch.toLowerCase()))), 'every alias differs in spelling and folds under the ASCII fold to exactly one protected target', all.filter((a) => protectedTargets.includes(a) || !protectedTargets.includes(a.replace(/[A-Z]/g, (ch) => ch.toLowerCase()))));
    check(!protectedTargets.some((t) => t.replace(/[A-Z]/g, (ch) => ch.toLowerCase()) !== t), 'every canonical target is already ASCII lower case (the canonical spelling is its own fold)', protectedTargets);
  });
  await step('I12-2 a draft spelled as a case variant of the installed policy, a settings file, the manifest or a runtime-unit target is refused by name before any approval, in prepare (with and without the content approval) and in the unprepared diff, and nothing is written', async () => {
    const rows = [
      ...POLICY_ALIASES.map((alias, i) => ({ alias, draft, approve: i < 2 })),
      { alias: POLICY_ALIASES[0], draft, consumers: true },
      ...SETTINGS_ALIASES.map((alias, i) => ({ alias, draft, approve: i === 0 })),
      ...MANIFEST_ALIASES.map((alias, i) => ({ alias, draft, approve: i < 2 })),
      { alias: MANIFEST_ALIASES[0], draft, approve: true, manifest: true },
      ...RUNTIME_ALIASES.map((alias, i) => ({ alias, draft, approve: RUNTIME_MEMBERS[i] === 'git-safe.mjs' })),
      ...GIT_SAFE_ALIASES.map((alias) => ({ alias, draft })),
    ];
    aliasDraftRows(context, kit, check, state, rows);
  });
  await step('I12-4 a draft spelled with a trailing dot or space, both, a stream suffix, a dotted or streamed directory or a case change plus a dot on a protected target is refused by name before any approval, in prepare (with and without the content approval) and in the unprepared diff, and nothing is written', async () => {
    const rows = [
      ...POLICY_SPELLINGS.map((alias, i) => ({ tag: 'I12-4', alias, draft, approve: i === 0 || i === 3 })),
      ...SETTINGS_SPELLINGS.map((alias, i) => ({ tag: 'I12-4', alias, draft, approve: i === 0 })),
      ...MANIFEST_SPELLINGS.map((alias, i) => ({ tag: 'I12-4', alias, draft, approve: i === 0 })),
      ...RUNTIME_SPELLINGS.map((alias, i) => ({ tag: 'I12-4', alias, draft, approve: i === 0 })),
    ];
    aliasDraftRows(context, kit, check, state, rows);
  });
  await step('I12-4 a rewritten prepared plan whose operation names one of these spellings is refused by name in the prepared diff and in the bound, hash-approved commit, with nothing rendered and nothing written', async () => {
    const spellings = [
      ...POLICY_SPELLINGS.filter((s, i) => i !== 6), ...SETTINGS_SPELLINGS.filter((s, i) => i === 0 || i === 3 || i === 4), ...MANIFEST_SPELLINGS.filter((s, i) => i === 0 || i === 3 || i === 5),
      ...RUNTIME_SPELLINGS.filter((s, i) => i === 0 || i === 3 || i === 4 || i === 5),
    ];
    aliasForgedRows(kit, check, state, spellings, draft, forgeTargetOp, 'I12-4');
  });
  await step('I12-4 C12-R3: a forged, consistently bound, hash-approved plan whose source inventory keeps the canonical policy draft name while the operation names a trailing-dot, trailing-space or stream spelling is refused by name in the prepared diff and in commit, and the installed policy is unchanged', async () => {
    aliasForgedRows(kit, check, state, ['.ai/security-paths.json.', '.ai/security-paths.json ', '.ai/security-paths.json::$DATA'], draft, forgeKeepingInventory, 'I12-4 C12-R3 (canonical source inventory)');
  });
  await step('I12-4 a declared transaction input spelled with a trailing dot or space, both, a stream suffix, a dotted or streamed directory or a case change plus a dot is refused by name in prepare and in the unprepared diff', async () => {
    aliasInputRows(kit, check, state, [...POLICY_SPELLINGS, ...SETTINGS_SPELLINGS, ...MANIFEST_SPELLINGS, ...RUNTIME_SPELLINGS], 'I12-4');
  });
  await step('I12-4 C12-R4: a missing runtime source cannot empty the protected runtime targets, and an unreadable catalog fails closed under .ai/tools/ (isolated skill copies)', async () => {
    aliasUnreadableRows(context, kit, check, state, dir);
  });
  await step('I12-2 a rewritten prepared plan whose operation targets an alias is refused by name in the prepared diff and in the bound, hash-approved commit, before the gate, with nothing rendered and nothing written; an unrelated target in the same forged shape is not refused', async () => {
    aliasForgedRows(kit, check, state, [POLICY_ALIASES[0], POLICY_ALIASES[3], SETTINGS_ALIASES[0], MANIFEST_ALIASES[0], MANIFEST_ALIASES[3], RUNTIME_ALIASES[4]], draft);
    // control: the same forging with a target that is no alias keeps every binding consistent, so the refusals above are the alias rule alone
    const g = cloneTree(state.bp, path.join(dir, 'i122-f-control'));
    forgeTargetOp(g, RUN_ID, 'docs/Security-Paths.json', '# note\n');
    const before = projectSnapshot(g);
    const d = kit.diff(g, RUN_ID);
    check(d.code === 0 && d.json && d.json.ok === true && d.json.prepared === true && Array.isArray(d.json.files) && d.json.files.length === 1 && d.json.files[0].target === 'docs/Security-Paths.json', 'I12-2 control: a forged plan on an unrelated target renders in the prepared diff', { code: d.code, out: d.stdout.slice(0, 300) });
    check(projectSnapshot(g) === before, 'I12-2 control: the prepared diff writes nothing');
  });
  await step('I12-2 a declared transaction input spelled as an alias of a protected target is refused by name in prepare and in the unprepared diff, even beside the canonical spelling', async () => {
    aliasInputRows(kit, check, state, [POLICY_ALIASES[0], POLICY_ALIASES[2], SETTINGS_ALIASES[0], SETTINGS_ALIASES[3], MANIFEST_ALIASES[0], MANIFEST_ALIASES[2], RUNTIME_ALIASES[4], GIT_SAFE_ALIASES[0]]);
  });
  await step('I12-2a an alias inside a forged prepared plan\'s metadata.transactionInputs keeps the existing APPLY_PLAN_INVALID (exit 1) in the prepared diff and in the bound, hash-approved commit; an unrelated input in the same forged shape is not refused', async () => {
    aliasForgedInputRows(kit, check, state, [POLICY_ALIASES[0], SETTINGS_ALIASES[0], MANIFEST_ALIASES[0], RUNTIME_ALIASES[4]]);
  });
  await step('I12-2 names that are not aliases (another directory, a suffix, a Unicode-only fold) and the canonical spellings (settings, declared inputs, the manifest keeping APPLY_MANIFEST_DRAFT) are not refused by this rule', async () => {
    aliasControls(context, kit, check, state, S2);
  });
}


// ==================================================== R47/C12/policy-preservation ====
// Plan C12-3, C12-5 and C12-6: what survives a rerun. A fresh install keeps the shipped schema-1 default with full ownership, an invalid fresh draft keeps the ordinary C2 behavior, an invalid or unreadable installed policy
// is an error and never evidence of absence, an absent or unchanged policy draft adds no refusal, retained identities (case, anchors, order, duplicates), additions and a schema conversion pass the new gate, the shipped defaults
// can never replace an installed policy, and a reviewed migration (managed move, omission, broader environment replacement) succeeds with the project entries represented in every control and the ownership record kept.
const ID_PRESERVE = 'run-c12-p';
async function policyPreservation(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const kit = makeKit(context, check);
    const sh = shipped(context);
    const S1 = policyS1(context);
    const S2 = policyS2(context);
    const fresh = await useBase(failures, 'fresh', getFreshBase, context);
    const s1 = await useBase(failures, 'schema-1 policy', getS1Base, context);
    const s2 = await useBase(failures, 'schema-2 policy', getS2Base, context);
    const mig = await useBase(failures, 'migration', getMigBase, context);
    await withScratch(context, 'preserve', async (dir) => {
      let n = 0;
      // A complete accepted run: begin, the unprepared diff, prepare (first without the approval when one is needed), the prepared diff, commit.
      const accepted = (label, base, draftText, o = {}) => {
        const root = cloneBase(dir, base, `${label.replace(/\W+/g, '-')}-${++n}`);
        if (o.consumers) addConsumer(root);
        if (!kit.begin(root, ID_PRESERVE)) return null;
        putDraft(root, ID_PRESERVE, T_POLICY, draftText);
        for (const [rel, data] of Object.entries(o.extra || {})) putDraft(root, ID_PRESERVE, rel, data);
        const d = kit.diff(root, ID_PRESERVE);
        check(d.code === 0 && d.json && d.json.ok === true && d.json.prepared === false && d.json.files.some((f) => f.target === T_POLICY), `${label}: the unprepared diff lists the policy draft`, { code: d.code, out: d.stdout.slice(0, 300) });
        if (o.needsApproval !== false) {
          const bare = kit.prepare(root, ID_PRESERVE, { mode: o.mode });
          const entries = bare.json && Array.isArray(bare.json.errors) ? bare.json.errors : [];
          check(bare.code === 3 && entries.length === 1 && entries[0].code === 'APPLY_APPROVAL_REQUIRED' && entries[0].target === T_POLICY && entries[0].error.includes(`--approve-user-content ${T_POLICY}`), `${label}: without the path approval the existing approval requirement applies (not the gate)`, { code: bare.code, out: bare.stdout.slice(0, 300) });
        }
        const prep = kit.prepare(root, ID_PRESERVE, { mode: o.mode, approve: o.needsApproval === false ? [] : [T_POLICY] });
        check(prep.code === 0 && prep.json && prep.json.ok === true, `${label}: prepare succeeds`, { code: prep.code, out: prep.stdout.slice(0, 300) });
        if (prep.code !== 0) return null;
        const pd = kit.diff(root, ID_PRESERVE);
        check(pd.code === 0 && pd.json && pd.json.ok === true && pd.json.prepared === true, `${label}: the prepared diff succeeds`, { code: pd.code, out: pd.stdout.slice(0, 300) });
        const c = kit.commit(root, ID_PRESERVE, prep.json.planSha256);
        check(c.code === 0 && c.json && c.json.ok === true && c.json.committed === true, `${label}: commit succeeds`, { code: c.code, out: c.stdout.slice(0, 300) });
        check(sameBytes(readBytes(projPath(root, T_POLICY)), Buffer.from(draftText, 'utf8')), `${label}: the installed policy is the approved draft`);
        return { root };
      };

      await step('no installed policy: the shipped schema-1 default installs with full ownership and its normalized hash; an invalid fresh draft keeps the ordinary C2 handling (no gate)', async () => {
        if (!fresh) return;
        const root = cloneBase(dir, fresh, 'fresh-ok');
        if (!kit.begin(root, ID_PRESERVE)) return;
        putDraft(root, ID_PRESERVE, T_POLICY, sh.text);
        const prep = kit.prepare(root, ID_PRESERVE, { mode: 'fresh' });
        check(prep.code === 0 && prep.json && prep.json.ok === true, 'the shipped default prepares in a project without a policy', { code: prep.code, out: prep.stdout.slice(0, 300) });
        if (prep.code !== 0) return;
        const c = kit.commit(root, ID_PRESERVE, prep.json.planSha256);
        check(c.code === 0 && c.json && c.json.committed === true, 'the fresh install commits', { code: c.code, out: c.stdout.slice(0, 300) });
        const manifest = readJson(manifestPath(root));
        check(manifest && eq(manifest.files[T_POLICY], { ownership: 'full', sha256: NH(sh.text) }), 'the policy record is full ownership with the normalized hash of the shipped bytes (the fresh-install exception)', manifest && manifest.files[T_POLICY]);
        check(sameBytes(readBytes(projPath(root, T_POLICY)), Buffer.from(sh.text, 'utf8')), 'the installed policy is the shipped default byte for byte');
        // an invalid fresh draft: ordinary handling, exactly like an invalid draft with no installed policy in C2 (the draft is reviewable and prepares)
        const bad = cloneBase(dir, fresh, 'fresh-invalid');
        if (!kit.begin(bad, ID_PRESERVE)) return;
        const invalid = jsonText({ schema: 1, patterns: [{ glob: `[${MARKER}`, kind: 'dir' }] });
        putDraft(bad, ID_PRESERVE, T_POLICY, invalid);
        const d = kit.diff(bad, ID_PRESERVE);
        check(d.code === 0 && d.json && d.json.ok === true && d.json.files.some((f) => f.target === T_POLICY), 'an invalid fresh draft is an ordinary draft in the unprepared diff (no C12 validation of fresh drafts)', { code: d.code, out: d.stdout.slice(0, 300) });
        const p = kit.prepare(bad, ID_PRESERVE, { mode: 'fresh' });
        check(p.code === 0 && p.json && p.json.ok === true && !p.stdout.includes(REGRESSION_CODE), 'an invalid fresh draft prepares as before and is never refused by the gate', { code: p.code, out: p.stdout.slice(0, 300) });
      });

      await step('an invalid or unreadable installed policy is an error and never evidence of absence: the existing installed-policy or input error, never a fallback and never the regression refusal', async () => {
        if (!s1) return;
        const variants = [
          ['unsupported glob grammar', (r) => putFile(projPath(r, T_POLICY), jsonText({ schema: 1, patterns: [{ glob: `[${MARKER}`, kind: 'dir' }] })), /^POLICY_/, /^POLICY_/, 3],
          ['text that is not JSON', (r) => putFile(projPath(r, T_POLICY), '{ not json'), /^POLICY_/, /^POLICY_/, 3],
          ['a directory in place of the policy file', (r) => { fs.rmSync(projPath(r, T_POLICY)); fs.mkdirSync(projPath(r, T_POLICY)); }, /^APPLY_INPUT_IO$/, /^APPLY_DIFF_IO$/, 2],
        ];
        variants.forEach(([label, mutate, prepareCode, diffCode, diffExit], i) => {
          const root = cloneBase(dir, s1, `installed-bad-${i}`);
          mutate(root);
          if (!kit.begin(root, ID_PRESERVE)) return;
          putDraft(root, ID_PRESERVE, T_POLICY, sh.text);
          const before = noWriteState(root, ID_PRESERVE);
          const p = kit.prepare(root, ID_PRESERVE, { approve: [T_POLICY] });
          const errors = p.json && Array.isArray(p.json.errors) ? p.json.errors : [];
          check(p.code === 3 && p.json && p.json.code === 'APPLY_PLAN_REJECTED' && errors.length === 1 && prepareCode.test(errors[0].code) && errors[0].code !== REGRESSION_CODE, `${label}: prepare reports the existing installed-policy error`, { code: p.code, out: p.stdout.slice(0, 300) });
          checkNoWrite(check, `${label}: prepare`, root, ID_PRESERVE, before);
          const d = kit.diff(root, ID_PRESERVE);
          check(d.code === diffExit && d.json && d.json.ok === false && diffCode.test(d.json.code) && d.json.code !== REGRESSION_CODE, `${label}: the unprepared diff reports the existing error with exit ${diffExit}`, { code: d.code, out: d.stdout.slice(0, 300) });
          check(projectSnapshot(root) === before.project, `${label}: nothing is written`);
        });
      });

      await step('a rerun with no policy draft, or an unchanged draft, adds no refusal and no migration requirement (also with schema 2 and runtime consumers)', async () => {
        if (!s1 || !s2) return;
        const a = cloneBase(dir, s1, 'rerun-nodraft');
        if (kit.begin(a, ID_PRESERVE)) {
          putDraft(a, ID_PRESERVE, 'docs/note.md', '# note\n');
          const before = readBytes(projPath(a, T_POLICY));
          const prep = kit.prepare(a, ID_PRESERVE);
          check(prep.code === 0 && prep.json && prep.json.ok === true && !prep.json.ops.some((o) => o.target === T_POLICY), 'a run without a policy draft prepares and holds no policy operation', { code: prep.code, out: prep.stdout.slice(0, 300) });
          const c = prep.code === 0 ? kit.commit(a, ID_PRESERVE, prep.json.planSha256) : null;
          check(c && c.code === 0 && c.json && c.json.committed === true, 'it commits', c && { code: c.code, out: c.stdout.slice(0, 300) });
          check(sameBytes(readBytes(projPath(a, T_POLICY)), before), 'the installed policy bytes are untouched');
        }
        const b = cloneBase(dir, s2, 'rerun-unchanged');
        addConsumer(b);
        if (kit.begin(b, ID_PRESERVE)) {
          putDraft(b, ID_PRESERVE, T_POLICY, readText(projPath(b, T_POLICY)));
          putDraft(b, ID_PRESERVE, 'docs/note.md', '# note\n');
          const prep = kit.prepare(b, ID_PRESERVE);
          const op = prep.json && prep.json.ops ? prep.json.ops.find((o) => o.target === T_POLICY) : null;
          check(prep.code === 0 && prep.json && prep.json.ok === true && !op, 'an unchanged schema-2 policy draft with runtime consumers needs no decisions and carries no policy write', { code: prep.code, out: prep.stdout.slice(0, 300) });
          const plan = readPlan(b, ID_PRESERVE);
          check(plan && plan.ops.some((o) => o.target === T_POLICY && o.action === 'unchanged') && !('security' in plan), 'the plan records the policy operation as unchanged', plan && plan.ops.map((o) => [o.target, o.action]));
          const c = prep.code === 0 ? kit.commit(b, ID_PRESERVE, prep.json.planSha256) : null;
          check(c && c.code === 0 && c.json && c.json.committed === true, 'it commits', c && { code: c.code, out: c.stdout.slice(0, 300) });
        }
      });

      await step('identities retained with case changes, inferred anchors, reordering and duplicate copies, additive drafts and a schema-1 to schema-2 conversion pass the gate; the existing content approval still applies', async () => {
        if (!s1 || !s2) return;
        const caseChanged = S1.patterns.map((e) => (e.glob === '**/.env*' ? { ...e, glob: '**/.ENV*' } : e));
        const retainedS1 = jsonText({ schema: 1, patterns: [...[...caseChanged].reverse(), { ...ADD1, anchor: 'root' }, ADD1] });
        accepted('schema 1 identities retained (case, explicit anchor, reversed order, a duplicate copy)', s1, retainedS1);
        accepted('schema 1 additive draft', s1, jsonText({ schema: 1, patterns: [...S1.patterns, ADD3] }));
        accepted('schema 1 to schema 2 with every identity retained and no runtime consumer', s1, jsonText({ schema: 2, patterns: anchored(S1.patterns), projectPatterns: [] }));
        accepted('schema 2 additive draft (a managed and a project addition)', s2, jsonText({ ...S2, patterns: [...S2.patterns, { anchor: 'root', glob: 'zz-extra/**', kind: 'dir' }], projectPatterns: [...S2.projectPatterns, { anchor: 'root', glob: 'zz-project/**' }] }));
        accepted('schema 2 identities retained (case, reversed order, a duplicate copy)', s2, jsonText({ ...S2, patterns: [...[...S2.patterns].reverse().map((e) => (e.glob === '**/*.pem' ? { ...e, glob: '**/*.PEM' } : e)), S2.patterns[0]], projectPatterns: [P2, P1, { ...P1, glob: 'INTERNAL-SECRETS/**' }] }));
      });

      await step('the shipped defaults can never replace an installed policy: a rerun draft equal to data/secret-paths.json is refused in prepare (also with the path approval) and in the unprepared diff, and the installed bytes survive', async () => {
        if (!s1 || !s2) return;
        for (const [label, base] of [['schema 1 with additions', s1], ['schema 2 with project entries', s2]]) {
          const root = cloneBase(dir, base, `defaults-${label.split(' ')[1]}`);
          if (!kit.begin(root, ID_PRESERVE)) continue;
          putDraft(root, ID_PRESERVE, T_POLICY, sh.text);
          const installed = readBytes(projPath(root, T_POLICY));
          const before = noWriteState(root, ID_PRESERVE);
          expectP(check, `${label}: prepare without approval`, kit.prepare(root, ID_PRESERVE, {}), [{ target: T_POLICY, code: REGRESSION_CODE, error: REGRESSION_TEXT }]);
          expectP(check, `${label}: prepare with the path approval`, kit.prepare(root, ID_PRESERVE, { approve: [T_POLICY] }), [{ target: T_POLICY, code: REGRESSION_CODE, error: REGRESSION_TEXT }]);
          expectF(check, `${label}: unprepared diff`, kit.diff(root, ID_PRESERVE), { code: REGRESSION_CODE, exit: 3, error: REGRESSION_TEXT, target: T_POLICY });
          checkNoWrite(check, `${label}`, root, ID_PRESERVE, before);
          check(sameBytes(readBytes(projPath(root, T_POLICY)), installed), `${label}: the installed policy bytes survive`);
        }
      });

      await step('the never-read boundary is the union of the shipped defaults and the installed policy (C12-6): a path only the installed projectPatterns name is refused as a draft target, in the review and by the block reader, while an unprotected neighbour is not', async () => {
        if (!s2) return;
        const root = cloneBase(dir, s2, 'union');
        if (!kit.begin(root, ID_PRESERVE)) return;
        const projectOnly = 'internal-secrets/c12-note.md'; // named by the installed projectPatterns only, never by the shipped defaults
        const neighbour = 'docs/c12-note.md';
        check(!sh.policy.patterns.some((e) => e.glob.startsWith('internal-secrets')), 'the fixture path is really unnamed by the shipped defaults');
        putDraft(root, ID_PRESERVE, projectOnly, 'x\n');
        const before = noWriteState(root, ID_PRESERVE);
        expectP(check, 'a draft targeting a project-protected path: prepare', kit.prepare(root, ID_PRESERVE, {}), [{ target: projectOnly, code: 'APPLY_SECRET_TARGET', error: 'agent drafts may not target secret-pattern paths' }]);
        checkNoWrite(check, 'a project-protected draft target: prepare', root, ID_PRESERVE, before);
        const d = kit.diff(root, ID_PRESERVE);
        check(d.code === 3 && d.json && d.json.ok === false && d.json.code === 'APPLY_SECRET_TARGET' && d.json.error === `refusing textual diff of secret target: ${projectOnly}`, 'the unprepared diff refuses the project-protected target', { code: d.code, out: d.stdout.slice(0, 300) });
        const blocked = kit.script('blocks', root, ['check', '--file', projectOnly]);
        check(blocked.code === 1 && blocked.json && blocked.json.ok === false && /secret-pattern path/.test(String(blocked.json.error)) && !hasOwn(blocked.json, 'exists'), 'the block reader refuses the project-protected path before reading it', { code: blocked.code, out: blocked.stdout.slice(0, 300) });
        const open = kit.script('blocks', root, ['check', '--file', neighbour]);
        check(open.code === 0 && open.json && open.json.ok === true && open.json.exists === false, 'an unprotected neighbour path is still readable by the block reader (negative control)', { code: open.code, out: open.stdout.slice(0, 300) });
      });

      await step('a reviewed migration (managed move, managed omission, broader environment replacement) succeeds: project entries survive, the ownership record is keys with managed patterns only, every control represents the project protections, and a rerun without a policy draft preserves the record', async () => {
        if (!mig) return;
        const m = migrationRun(kit, check, dir, mig, 'pres-mig', ID_PRESERVE);
        if (!m) return;
        const root = stagedMigration(m, 'run');
        if (!root) return;
        const dec = m.decisions;
        check(dec.entries.some((e) => e.action === 'project') && dec.entries.some((e) => e.action === 'omit') && dec.coverage.length >= 1 && dec.coverage.every((c) => c.action === 'include'), 'the decisions move a managed addition to the project, omit a deleted managed entry and include the replacement coverage', dec);
        const prep = prepareApproving(kit, root, ID_PRESERVE);
        check(prep.ok === true, 'the reviewed migration prepares with the exact approvals', { approved: prep.approved, out: prep.prep.stdout.slice(0, 300) });
        if (!prep.ok) return;
        const plan = readPlan(root, ID_PRESERVE);
        check(plan && plan.security && plan.ops.some((o) => o.target === T_POLICY && o.action === 'modify'), 'the plan carries the policy modification and plan.security', plan && Object.keys(plan));
        const pd = kit.diff(root, ID_PRESERVE);
        check(pd.code === 0 && pd.json && pd.json.ok === true && pd.json.prepared === true && pd.json.security, 'the prepared diff succeeds with the migration evidence', { code: pd.code, out: pd.stdout.slice(0, 200) });
        const c = kit.commit(root, ID_PRESERVE, prep.sha);
        check(c.code === 0 && c.json && c.json.ok === true && c.json.committed === true, 'the reviewed migration commits', { code: c.code, out: c.stdout.slice(0, 300) });
        const policy = readJson(projPath(root, T_POLICY));
        const manifest = readJson(manifestPath(root));
        const rec = manifest && manifest.files[T_POLICY];
        check(policy && policy.schema === 2 && eq(policy.projectPatterns, [P1, P2, MIG_ADDITION]), 'projectPatterns keep both project entries unchanged, in order, and gain the moved addition', policy && policy.projectPatterns);
        check(policy && !policy.patterns.some((e) => e.glob === V2_DELETED || e.glob === MIG_ADDITION.glob || e.glob === P1.glob) && policy.patterns.some((e) => e.glob === '**/.env*') && !policy.patterns.some((e) => e.glob === '**/.env' || e.glob === '**/.env.*'), 'the managed patterns omit the deleted entry, hold no project entry and replace the two old environment globs with the broader one', policy && policy.patterns.map((e) => e.glob));
        check(rec && rec.ownership === 'keys' && rec.managed && rec.managed.schema === 2 && eq(rec.managed.patterns, policy.patterns) && !hasOwn(rec.managed, 'projectPatterns'), 'the recorded ownership is keys and the managed metadata holds the managed patterns, never projectPatterns', rec && Object.keys(rec));
        check(rec && !JSON.stringify(rec).includes('internal-secrets') && !JSON.stringify(rec).includes(MIG_ADDITION.glob), 'no project glob appears anywhere in the recorded managed metadata');
        check(rec && rec.omissions && eq(rec.omissions.patterns.map((e) => e.glob), [V2_DELETED]), 'the recorded omission is the deleted managed entry', rec && rec.omissions);
        // every control represents the project protections
        const settings = readJson(projPath(root, T_SETTINGS));
        const rendered = kit.render(root, ['json', '--project', root]);
        check(rendered.code === 0 && rendered.json && rendered.json.ok === true, 'the controls render from the installed policy', rendered.stdout.slice(0, 200));
        const globs = [P1.glob, P2.glob, MIG_ADDITION.glob];
        const rj = rendered.json || { claude: { permissionsDeny: [], readDeny: [] }, gitPathspecExcludes: [], codexSnippet: '' };
        for (const g of globs) {
          check(rj.claude.readDeny.some((r) => r.includes(g)), `the Claude read deny rules cover the project glob ${g}`);
          check(settings && settings.permissions.deny.some((r) => r.includes(g)), `the committed .claude/settings.json denies the project glob ${g}`);
          check(rj.gitPathspecExcludes.some((x) => x.includes(g)), `the Git pathspec excludes cover the project glob ${g}`);
          check(String(rj.codexSnippet).includes(g), `the Codex snippet covers the project glob ${g}`);
        }
        check(settings && rj.claude.permissionsDeny.every((r) => settings.permissions.deny.includes(r)), 'every rendered Claude deny is present in the committed settings');
        const snippet = kit.render(root, ['codex-snippet', '--project', root]);
        check(snippet.code === 0 && manifest && manifest.codexSnippetSha256 === sha(Buffer.from(snippet.stdout, 'utf8')), 'the recorded snippet hash is the hash of the snippet rendered from the installed policy', manifest && manifest.codexSnippetSha256);
        // a rerun without a policy draft preserves the installed ownership record; an unchanged draft adds nothing; the shipped defaults are refused
        const installedBytes = readBytes(projPath(root, T_POLICY));
        const released = kit.lock(root, ['release', '--run-id', ID_PRESERVE]);
        check(released.code === 0, 'the first run releases its lock', released.stdout.slice(0, 200));
        const second = 'run-c12-q';
        if (kit.begin(root, second)) {
          putDraft(root, second, 'docs/rerun-note.md', '# rerun\n');
          const p2 = kit.prepare(root, second);
          check(p2.code === 0 && p2.json && p2.json.ok === true && !p2.json.ops.some((o) => o.target === T_POLICY), 'a rerun without a policy draft prepares with no policy operation', { code: p2.code, out: p2.stdout.slice(0, 300) });
          const c2 = p2.code === 0 ? kit.commit(root, second, p2.json.planSha256) : null;
          check(c2 && c2.code === 0 && c2.json && c2.json.committed === true, 'the rerun commits', c2 && { code: c2.code, out: c2.stdout.slice(0, 300) });
          const after = readJson(manifestPath(root));
          check(after && eq(after.files[T_POLICY], rec), 'the installed ownership record of the policy is preserved byte for byte by the rerun', after && after.files[T_POLICY]);
          check(sameBytes(readBytes(projPath(root, T_POLICY)), installedBytes), 'the installed policy bytes are preserved by the rerun');
          // rerunning from the shipped defaults (the exact scenario of the finding) cannot replace the policy: a third run after the second one released its lock
          const released2 = kit.lock(root, ['release', '--run-id', second]);
          check(released2.code === 0, 'the rerun releases its lock', released2.stdout.slice(0, 200));
          const third = 'run-c12-r';
          if (kit.begin(root, third)) {
            putDraft(root, third, T_POLICY, sh.text);
            const bad = noWriteState(root, third);
            expectP(check, 'a rerun from the shipped defaults with the path approval supplied', kit.prepare(root, third, { approve: [T_POLICY] }), [{ target: T_POLICY, code: REGRESSION_CODE, error: REGRESSION_TEXT }]);
            expectF(check, 'a rerun from the shipped defaults: unprepared diff', kit.diff(root, third), { code: REGRESSION_CODE, exit: 3, error: REGRESSION_TEXT, target: T_POLICY });
            checkNoWrite(check, 'the shipped-defaults rerun', root, third, bad);
            check(sameBytes(readBytes(projPath(root, T_POLICY)), installedBytes), 'the installed policy bytes survive the refused rerun');
          }
        }
      });
    });
    flushProcessCount(context, 'R47/C12/policy-preservation', mark);
  });
}


// ========================================================= V2/C12/entrypoints ====
// Plan C12-7 and C12-8 with the freeze addendum C12-P2-3 and C12-P2-4: seven scripts replace their spelling-only entry guards by the local isEntryPoint() whose text is identical to scripts/validate.mjs:603-609; doctor, validate and
// hooks-selftest already carry it; apply, canary, detect and lock stay unconditional CLIs; libraries carry no guard; no production file is added. The behavior is proved by launches, never by a new helper: direct absolute and
// relative paths, a path with spaces, a real directory junction (mandatory on Windows; a directory symlink elsewhere), a case variant on Windows, an optional file symlink (diagnostic only), and import probes whose argv[1] is
// missing, a different existing file or a nonexistent file (realpath failure). Direct and alternate launches are compared for exit code, stdout and stderr, never merely for termination.
const ENTRY_FUNCTION_LINES = [
  'function isEntryPoint() {',
  '  if (!process.argv[1]) return false;',
  '  const self = fileURLToPath(import.meta.url);',
  "  const fold = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);",
  '  if (fold(path.resolve(process.argv[1])) === fold(path.resolve(self))) return true;',
  '  try { return fold(fs.realpathSync.native(process.argv[1])) === fold(fs.realpathSync.native(self)); } catch { return false; }',
  '}',
];
const ENTRY_FUNCTION = ENTRY_FUNCTION_LINES.join('\n');
const CHANGED_SCRIPTS = ['blocks', 'check-agent-baselines', 'env-keys', 'merge-claude-settings', 'migrate-security-paths', 'render-permissions', 'secret-scan'];
const ALREADY_EQUIVALENT = ['scripts/doctor.mjs', 'scripts/validate.mjs', 'assets/tools/hooks-selftest.mjs'];
const UNCONDITIONAL = ['scripts/apply.mjs', 'scripts/canary.mjs', 'scripts/detect.mjs', 'scripts/lock.mjs', 'assets/tools/git-safe.mjs', 'assets/tools/guard-raw-git.mjs', 'install/install.mjs'];
const LIBRARIES = ['scripts/classify-allows.mjs', 'scripts/globs.mjs', 'scripts/lib.mjs', 'scripts/ownership.mjs', 'scripts/schemas.mjs', 'scripts/toml.mjs', 'assets/tools/security-policy.mjs', 'assets/tools/git-safe-core.mjs', 'assets/tools/guard-raw-git-core.mjs', 'assets/tools/review-diff.mjs'];
const SCRIPT_INVENTORY = ['apply.mjs', 'blocks.mjs', 'canary.mjs', 'check-agent-baselines.mjs', 'classify-allows.mjs', 'detect.mjs', 'doctor.mjs', 'env-keys.mjs', 'globs.mjs', 'lib.mjs', 'lock.mjs', 'merge-claude-settings.mjs', 'migrate-security-paths.mjs', 'ownership.mjs', 'render-permissions.mjs', 'schemas.mjs', 'secret-scan.mjs', 'toml.mjs', 'validate.mjs'];
const TOOL_INVENTORY = ['git-safe-core.mjs', 'git-safe.mjs', 'guard-raw-git-core.mjs', 'guard-raw-git.mjs', 'hooks-selftest.mjs', 'review-diff.mjs', 'security-policy.mjs'];
const LIB_EXPORTS = ['ENV_TEMPLATE_RE', 'IS_WINDOWS', 'SKILL_DIR', 'WRITE_ALLOWLIST', 'WRITE_DENYLIST', 'assertNotLink', 'assertNotSecretInput', 'assertWritable', 'atomicWrite', 'canonicalPath', 'classifyEnvTemplate', 'detectEol', 'fail', 'git', 'globToRegExp', 'hostId', 'isSecretPath', 'loadEffectivePolicy', 'loadSecretSpec', 'matchesAny', 'normalizeText', 'normalizedHash', 'ok', 'parseArgs', 'rawFileHash', 'readInRepo', 'readJsonFile', 'repoRoot', 'run', 'safeResolve', 'secretGlobs', 'secureDir', 'secureDirRel', 'setFilesystemRoot', 'sha256', 'skillVersion', 'toPosix', 'validateRunId', 'writeInRepo'];
const BASELINE_PATHS = ['data/v2.0.0/assets/agents/reviewer.md', 'data/v2.0.0/assets/agents/docs-sync.md', 'data/v2.0.0/assets/wrappers/claude-reviewer.md', 'data/v2.0.0/assets/wrappers/claude-docs-sync.md', 'data/v2.0.0/assets/wrappers/codex-reviewer.toml', 'data/v2.0.0/assets/wrappers/codex-docs_sync.toml'];
const BASELINE_OK = jsonText({ ok: true, baseline: 'v2.0.0', files: BASELINE_PATHS });
const COUNT = (text, needle) => String(text).split(needle).length - 1;
// The function text of a file: from its declaration to the first closing brace at the start of a line (the body has none), LF-normalized.
function entryFunctionOf(text) {
  const t = LF(text);
  const start = t.indexOf('function isEntryPoint() {');
  if (start < 0) return null;
  const end = t.indexOf('\n}\n', start);
  return end < 0 ? null : t.slice(start, end + 2);
}

// The import probe: one child per script, several evaluations of the unchanged module (query-suffixed specifiers re-run its top level) with a different process.argv[1] each. Output, process.exit and the exit code are trapped.
const PROBE_SOURCE = String.raw`import { pathToFileURL } from 'node:url';
const target = process.argv[2];
const variants = JSON.parse(process.argv[3]);
const out = []; const err = []; const exits = [];
const ow = process.stdout.write; const ew = process.stderr.write; const ex = process.exit;
process.stdout.write = function (c) { out.push(String(c)); return true; };
process.stderr.write = function (c) { err.push(String(c)); return true; };
process.exit = function (c) { exits.push(c); throw new Error('process.exit called'); };
const results = [];
for (const v of variants) {
  out.length = 0; err.length = 0; exits.length = 0; process.exitCode = undefined;
  if (v.argv1 === null) process.argv.length = 1; else process.argv[1] = v.argv1;
  let thrown = null;
  try { await import(pathToFileURL(target).href + '?c12probe=' + results.length); } catch (e) { thrown = String(e && e.message).slice(0, 160); }
  await new Promise((r) => setTimeout(r, 60));
  results.push({ name: v.name, out: out.join(''), err: err.join(''), exits: [...exits], exitCode: process.exitCode === undefined ? null : process.exitCode, thrown });
}
process.stdout.write = ow; process.stderr.write = ew; process.exit = ex;
process.stdout.write(JSON.stringify(results) + '\n');
`;
// A scanner stub: intercepts the gitleaks probe and scan by patching child_process.spawnSync (a CommonJS preload), everything else passes through. No real scanner is ever started.
const SCAN_STUB_SOURCE = (cfg) => String.raw`'use strict';
const cp = require('child_process');
const fs = require('fs');
const { syncBuiltinESMExports } = require('module');
const CFG = ${JSON.stringify(cfg)};
const orig = cp.spawnSync;
function isScanner(cmd, args) { const text = [String(cmd), ...(Array.isArray(args) ? args.map(String) : [])].join(' '); return /gitleaks/i.test(text); }
cp.spawnSync = function (cmd, args, opts) {
  if (!isScanner(cmd, args)) return orig.apply(this, arguments);
  const words = typeof cmd === 'string' && (!Array.isArray(args) || args.length === 0) ? cmd.match(/"[^"]*"|\S+/g).map((w) => w.replace(/^"|"$/g, '')) : [String(cmd), ...(Array.isArray(args) ? args.map(String) : [])];
  const isProbe = words.includes('version') && !words.includes('dir') && !words.includes('git');
  if (isProbe) return { status: 0, stdout: '8.99.0-stub\n', stderr: '', error: null };
  const i = words.indexOf('--report-path');
  if (i >= 0) fs.writeFileSync(words[i + 1], JSON.stringify(CFG.report));
  return { status: 0, stdout: '', stderr: '', error: null };
};
syncBuiltinESMExports();
`;

const entryWorlds = new Map();
// The scratch world of the launches: a copy of the skill (scripts, assets, data, install, VERSION) under a path with spaces, a project with an initialized run, a junction to the copy, a relative spelling, a case variant,
// a minimal skill holding only the baseline checker and its six snapshots (intact and corrupted copies, each with its own junction).
function entryWorld(context, kit, check) {
  if (entryWorlds.has(context.tmp)) return entryWorlds.get(context.tmp);
  const dir = scratchDir(context, 'entry');
  const copy = path.join(dir, 'skill copy');
  for (const part of ['scripts', 'assets', 'data', 'install']) fs.cpSync(skillPath(context, part), path.join(copy, part), { recursive: true });
  fs.copyFileSync(skillPath(context, 'VERSION'), path.join(copy, 'VERSION'));
  const proj = makeRepo(context, path.join(dir, 'proj'), { 'package.json': '{"name":"fixture-app"}\n', 'NOTES.md': '# notes\n' });
  const runId = 'run-c12-e';
  kit.begin(proj, runId);
  const junction = path.join(dir, 'link to skill');
  const w = { dir, copy, proj, runId, junction, junctionOk: linkDir(copy, junction), notes: [] };
  const minimal = (label, corrupt) => {
    const root = path.join(dir, label);
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.copyFileSync(skillPath(context, 'scripts/check-agent-baselines.mjs'), path.join(root, 'scripts', 'check-agent-baselines.mjs'));
    for (const rel of BASELINE_PATHS) putFile(path.join(root, ...rel.split('/')), fs.readFileSync(skillPath(context, rel)));
    if (corrupt) fs.appendFileSync(path.join(root, ...BASELINE_PATHS[0].split('/')), 'c12 corruption\n');
    const link = path.join(dir, `${label} link`);
    return { root, link, linkOk: linkDir(root, link) };
  };
  w.good = minimal('skill-min-good', false);
  w.bad = minimal('skill-min-bad', true);
  entryWorlds.set(context.tmp, w);
  return w;
}
const alike = (a, b) => a.code === b.code && a.stdout === b.stdout && a.stderr === b.stderr;

async function entrypoints(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const kit = makeKit(context, check);
    await step('plan C12-7: the seven changed scripts, doctor, validate and hooks-selftest carry a local isEntryPoint() whose text is identical to the plan literal (after line-ending normalization); nothing else holds a spelling guard', async () => {
      for (const name of CHANGED_SCRIPTS) {
        const rel = `scripts/${name}.mjs`;
        const text = readText(skillPath(context, rel));
        if (text === null) { check(false, `${rel} is readable`); continue; }
        const fn = entryFunctionOf(text);
        check(fn === ENTRY_FUNCTION && COUNT(text, 'function isEntryPoint(') === 1, `${rel}: exactly one isEntryPoint() and its text equals the plan function`, fn && fn.split('\n'));
        check(!/\bconst norm\b/.test(text) && !/\bisMain\b/.test(text), `${rel}: the unused norm helper and the isMain variable are removed (C12-P2-4)`);
        check(COUNT(text, 'if (isEntryPoint())') === 1, `${rel}: the CLI starts only under "if (isEntryPoint())"`);
        check(/^import (?:\* as )?fs\b[^\n]*from 'node:fs';$/m.test(LF(text)) && /^import path\b[^\n]*from 'node:path';$/m.test(LF(text)) && /^import \{[^}]*\bfileURLToPath\b[^}]*\} from 'node:url';$/m.test(LF(text)), `${rel}: fs, path and fileURLToPath are imported by the file itself (no new production file)`);
        check(fn !== null && COUNT(text, 'process.argv[1]') === COUNT(fn, 'process.argv[1]'), `${rel}: process.argv[1] is read only inside the entry function (no second spelling guard)`);
      }
      for (const rel of ALREADY_EQUIVALENT) {
        const text = readText(skillPath(context, rel));
        if (text === null) { check(false, `${rel} is readable`); continue; }
        const fn = entryFunctionOf(text);
        check(fn === ENTRY_FUNCTION && COUNT(text, 'function isEntryPoint(') === 1, `${rel}: the existing guard is the identical function`, fn && fn.split('\n'));
        check(fn !== null && COUNT(text, 'process.argv[1]') === COUNT(fn, 'process.argv[1]'), `${rel}: process.argv[1] is read only inside the entry function`);
      }
      for (const rel of UNCONDITIONAL) {
        const text = readText(skillPath(context, rel));
        check(text !== null && !text.includes('isEntryPoint') && !text.includes('process.argv[1]'), `${rel}: stays an unconditional CLI (no entry guard added)`);
      }
      for (const rel of LIBRARIES) {
        const text = readText(skillPath(context, rel));
        check(text !== null && !text.includes('isEntryPoint') && !text.includes('process.argv[1]'), `${rel}: a library carries no entry guard`);
      }
      const release = readText(skillPath(context, 'install/release.mjs'));
      check(release !== null && /function invokedDirectly\(\)/.test(release) && release.includes('realpathSync.native(entry)') && !release.includes('function isEntryPoint('), 'install/release.mjs keeps its existing equivalent guard unchanged');
    });
    await step('plan C12-7 and C12-14: no production file is added (no is-entry-point helper), the script, tool and install inventories are exactly the landed ones, and lib.mjs keeps its export set', async () => {
      check(eq(listFiles(skillPath(context, 'scripts')), SCRIPT_INVENTORY), 'scripts/ holds exactly the nineteen landed files', listFiles(skillPath(context, 'scripts')));
      check(eq(listFiles(skillPath(context, 'assets/tools')), TOOL_INVENTORY), 'assets/tools/ holds exactly the seven landed files', listFiles(skillPath(context, 'assets/tools')));
      check(eq(listFiles(skillPath(context, 'install')), ['install.mjs', 'release.mjs']), 'install/ holds exactly installer and release builder', listFiles(skillPath(context, 'install')));
      const found = [];
      const walk = (rel) => { for (const e of fs.readdirSync(skillPath(context, rel), { withFileTypes: true })) { const r = `${rel}/${e.name}`; if (e.isDirectory()) walk(r); else if (/entry-?point/i.test(e.name)) found.push(r); } };
      for (const top of ['scripts', 'assets', 'install']) walk(top);
      check(found.length === 0, 'no file named like an entry-point helper exists under scripts, assets or install', found);
      const lib = await importOrFail(failures, skillUrl(context, 'scripts/lib.mjs'), 'scripts/lib.mjs');
      if (lib) check(eq(Object.keys(lib).sort(), [...LIB_EXPORTS].sort()), 'lib.mjs exports exactly the landed names (unchanged)', Object.keys(lib).sort());
    });

    const w = entryWorld(context, kit, check);
    check(w.junctionOk === true && w.good.linkOk === true && w.bad.linkOk === true, WIN ? 'real directory junctions can be created (mandatory on Windows)' : 'directory symlinks can be created', { junction: w.junctionOk, good: w.good.linkOk, bad: w.bad.linkOk });
    const real = (rel) => skillPath(context, rel);
    const inCopy = (rel) => path.join(w.copy, ...rel.split('/'));
    const probes = [
      { name: 'blocks', args: ['check', '--file', 'NOTES.md'], expect: (r) => r.code === 0 && r.stdout === jsonText({ ok: true, file: 'NOTES.md', exists: true, blocks: [], errors: [] }) && r.stderr === '' },
      { name: 'check-agent-baselines', args: [], cwd: w.proj, expect: (r) => r.code === 0 && r.stdout === BASELINE_OK && r.stderr === '' },
      { name: 'env-keys', args: ['keys', '--template', 'auto'], expect: (r) => r.code === 0 && r.json && r.json.ok === true && r.json.file === '.env.example' && r.json.exists === false && eq(r.json.keys, []) && r.stderr === '' },
      { name: 'merge-claude-settings', args: [], expect: (r) => r.code === 1 && r.json && r.json.ok === false && /^invalid run id/.test(r.json.error) && r.stderr === '' },
      { name: 'migrate-security-paths', args: ['report', '--project', w.proj], expect: (r) => r.code === 0 && r.json && r.json.ok === true && r.json.report && r.json.report.baseline === 'fresh' && typeof r.json.reportSha256 === 'string' && r.stderr === '' },
      { name: 'render-permissions', args: ['pathspec'], expect: (r) => r.code === 0 && r.stdout.startsWith(':(exclude,glob,icase)**/.env*\n') && r.stdout.split('\n').length > 18 && r.stderr === '' },
      { name: 'secret-scan', args: ['--run-id', w.runId, '--gitleaks', 'c12-no-such-scanner'], expect: (r) => r.code === 0 && r.stdout === jsonText({ ok: true, status: 'not-scanned', reason: 'gitleaks not installed', scope: 'worktree' }) && r.stderr === '' },
    ];
    for (const p of probes) {
      await step(`${p.name}: the direct launch prints the expected output, and every alternate launch (copy with spaces, relative path, directory junction, Windows case variant) prints the identical output with the identical exit code`, async () => {
        const rel = `scripts/${p.name}.mjs`;
        const cwd = p.cwd || w.proj;
        const launch = (script) => execNode(context, { cwd, script, args: p.args });
        const direct = launch(real(rel));
        check(!direct.dead && p.expect(direct), `${p.name}: the direct absolute launch (real checkout) produces the expected output`, { code: direct.code, out: direct.stdout.slice(0, 240), err: direct.stderr.slice(0, 160), dead: direct.dead });
        const variants = [['an absolute path with spaces (copy)', inCopy(rel)], ['a relative path', path.relative(cwd, inCopy(rel))], ['a directory junction', path.join(w.junction, ...rel.split('/'))]];
        if (WIN) variants.push(['a case variant', `${inCopy(rel).slice(0, -'.mjs'.length).toUpperCase()}.mjs`]);
        for (const [label, script] of variants) {
          if (label === 'a relative path') check(!path.isAbsolute(script), `${p.name}: the relative spelling is really relative`, script);
          const r = launch(script);
          check(!r.dead, `${p.name} via ${label}: the process ended normally`, r.dead);
          check(r.stdout !== '' || r.stderr !== '' || r.code !== 0, `${p.name} via ${label}: not a silent exit 0 (the CLI really ran)`, { code: r.code });
          check(alike(r, direct), `${p.name} via ${label}: same exit code, stdout and stderr as the direct launch`, { direct: { code: direct.code, out: direct.stdout.slice(0, 160) }, alt: { code: r.code, out: r.stdout.slice(0, 160), err: r.stderr.slice(0, 160) } });
        }
        // an optional file symlink: diagnostic only, never a skip and never a failure
        if (p.name === 'blocks') {
          const fileLink = path.join(w.dir, 'blocks-link.mjs');
          let made = false;
          try { fs.symlinkSync(inCopy(rel), fileLink, 'file'); made = true; } catch (e) { diag(context, `file symlink not exercised (${e && e.code}); optional subcase`); }
          if (made) {
            const r = launch(fileLink);
            check(alike(r, direct), 'blocks via a file symlink (optional): same exit code, stdout and stderr as the direct launch', { code: r.code, out: r.stdout.slice(0, 160) });
            try { fs.unlinkSync(fileLink); } catch { /* best effort */ }
          }
        }
      });
    }
    await step('secret-scan reports "scanned" through an alternate path exactly as directly (a stub scanner, never a real one); a silent exit 0 is never accepted', async () => {
      const stub = path.join(w.dir, 'scan-stub.cjs');
      fs.writeFileSync(stub, SCAN_STUB_SOURCE({ report: [] }));
      const args = ['--run-id', w.runId];
      const direct = execNode(context, { cwd: w.proj, script: real('scripts/secret-scan.mjs'), args, preload: stub });
      check(!direct.dead && direct.code === 0 && direct.json && direct.json.ok === true && direct.json.status === 'scanned' && direct.json.count === 0 && eq(direct.json.findings, []) && direct.json.scope === 'worktree' && String(direct.json.tool).startsWith('gitleaks 8.99.0-stub') && direct.stderr === '', 'the direct stubbed scan returns the explicit scanned report', { code: direct.code, out: direct.stdout.slice(0, 300) });
      const alt = execNode(context, { cwd: w.proj, script: path.join(w.junction, 'scripts', 'secret-scan.mjs'), args, preload: stub });
      check(!alt.dead && alt.stdout !== '' && alike(alt, direct), 'the junction launch returns the identical scanned report (never a silent exit 0)', { code: alt.code, out: alt.stdout.slice(0, 300) });
    });
    await step('check-agent-baselines: the exact success JSON through the junction, and baseline corruption is reported through the junction exactly as directly (exit 3, the failure JSON naming the table path only)', async () => {
      const goodDirect = execNode(context, { cwd: w.proj, script: path.join(w.good.root, 'scripts', 'check-agent-baselines.mjs'), args: [] });
      const goodLink = execNode(context, { cwd: w.proj, script: path.join(w.good.link, 'scripts', 'check-agent-baselines.mjs'), args: [] });
      check(goodDirect.code === 0 && goodDirect.stdout === BASELINE_OK && goodDirect.stderr === '', 'the intact minimal copy verifies directly with the exact success JSON', { code: goodDirect.code, out: goodDirect.stdout.slice(0, 200) });
      check(goodLink.code === 0 && goodLink.stdout === BASELINE_OK && goodLink.stderr === '', 'the intact minimal copy verifies through the junction with the exact success JSON', { code: goodLink.code, out: goodLink.stdout.slice(0, 200), err: goodLink.stderr.slice(0, 120) });
      const target = BASELINE_PATHS[0];
      const failureText = jsonText({ ok: false, code: 'AGENT_BASELINE_INVALID', error: `AGENT_BASELINE_INVALID: cannot verify v2.0.0 baseline: ${target}; stop migration`, target });
      const badDirect = execNode(context, { cwd: w.proj, script: path.join(w.bad.root, 'scripts', 'check-agent-baselines.mjs'), args: [] });
      const badLink = execNode(context, { cwd: w.proj, script: path.join(w.bad.link, 'scripts', 'check-agent-baselines.mjs'), args: [] });
      check(badDirect.code === 3 && badDirect.stdout === failureText && badDirect.stderr === '', 'the corrupted copy fails directly with exit 3 and the exact failure JSON', { code: badDirect.code, out: badDirect.stdout.slice(0, 300) });
      check(badLink.code === 3 && badLink.stdout === failureText && badLink.stderr === '', 'the corrupted copy fails through the junction with exit 3 and the exact failure JSON (a corrupted baseline can never look like a silent success)', { code: badLink.code, out: badLink.stdout.slice(0, 300), err: badLink.stderr.slice(0, 120) });
      check(!badLink.stdout.includes(w.bad.root) && !badLink.stdout.includes(path.basename(w.bad.root)), 'the failure names the table path only, never a native absolute path');
    });
    const safe = [
      { rel: 'scripts/doctor.mjs', args: ['--c12-unsupported'], expect: (r) => r.code === 2 && r.stdout === jsonText({ ok: false, code: 'DOCTOR_OPTION', error: 'DOCTOR_OPTION: unsupported argument' }) && r.stderr === '' },
      { rel: 'scripts/validate.mjs', args: ['--c12-unsupported'], expect: (r) => r.code === 2 && r.stdout === jsonText({ ok: false, code: 'VALIDATE_USAGE', error: 'usage: validate.mjs [--json]' }) && r.stderr === '' },
      { rel: 'assets/tools/hooks-selftest.mjs', args: ['extra'], expect: (r) => r.code === 1 && r.stdout === '' && r.stderr === 'hooks-selftest: usage: node .ai/tools/hooks-selftest.mjs\n' },
      { rel: 'install/release.mjs', args: [], expect: (r) => r.code === 1 && r.stdout === '' && r.stderr === 'RELEASE_USAGE: usage: release.mjs --tag <tag> --out <directory>\n' },
    ];
    await step('doctor, validate, hooks-selftest and the release builder: a safe argument-validation launch gives the same result directly and through the junction (no release is built, no real scanner or agent runs)', async () => {
      for (const s of safe) {
        const direct = execNode(context, { cwd: w.proj, script: real(s.rel), args: s.args });
        check(!direct.dead && s.expect(direct), `${s.rel}: the direct launch gives the documented argument-validation result`, { code: direct.code, out: direct.stdout.slice(0, 200), err: direct.stderr.slice(0, 160) });
        const alt = execNode(context, { cwd: w.proj, script: path.join(w.junction, ...s.rel.split('/')), args: s.args });
        check(!alt.dead && alike(alt, direct), `${s.rel}: the junction launch gives the identical exit code, stdout and stderr`, { code: alt.code, out: alt.stdout.slice(0, 200), err: alt.stderr.slice(0, 160) });
      }
    });
    await step('import probes: with process.argv[1] missing, naming a different existing file, naming another production script or naming a nonexistent file (realpath failure), importing each guarded module prints nothing, exits nothing, sets no exit status and runs no CLI', async () => {
      const probeFile = path.join(w.dir, 'import-probe.mjs');
      fs.writeFileSync(probeFile, PROBE_SOURCE);
      const variants = [
        { name: 'argv[1] missing', argv1: null },
        { name: 'argv[1] is a different existing file', argv1: probeFile },
        { name: 'argv[1] is another production script', argv1: inCopy('scripts/lib.mjs') },
        { name: 'argv[1] is a nonexistent file', argv1: path.join(w.dir, 'no-such-directory', 'missing-entry.mjs') },
      ];
      for (const rel of [...CHANGED_SCRIPTS.map((n) => `scripts/${n}.mjs`), ...ALREADY_EQUIVALENT]) {
        const text = readText(inCopy(rel));
        if (entryFunctionOf(text || '') !== ENTRY_FUNCTION) { check(false, `${rel}: not probed because its entry function is not the plan function`); continue; }
        const r = execNode(context, { cwd: w.proj, script: probeFile, args: [inCopy(rel), JSON.stringify(variants)] });
        let results = null;
        try { results = JSON.parse(r.stdout.trim().split('\n').pop()); } catch { /* reported below */ }
        check(!r.dead && Array.isArray(results) && results.length === variants.length, `${rel}: the import probe produced its result`, { code: r.code, out: r.stdout.slice(0, 200), err: r.stderr.slice(0, 200) });
        for (const v of results || []) {
          check(v.thrown === null && v.out === '' && v.err === '' && eq(v.exits, []) && v.exitCode === null, `${rel}: import with ${v.name} prints nothing, never exits, sets no exit status and runs no CLI`, v);
        }
      }
    });
    // the links this group created are unlinked by name, so no later recursive removal can reach through one
    for (const l of [w.junction, w.good.link, w.bad.link]) dropLink(l);
    entryWorlds.delete(context.tmp);
    flushProcessCount(context, 'V2/C12/entrypoints', mark);
  });
}


// ========================================================= R51/C12/config-env ====
// Plan C12-9 and C12-10: the hook core consumes both global forms (--config-env=alias.name=VARIABLE and --config-env alias.name=VARIABLE), inspects the key before the first "=" with the existing ASCII-case-insensitive alias.*
// rule, never reads or expands the named variable, keeps option text in messages, comments and literal bodies as data, leaves post-subcommand parsing, the lexical-failure precedence and the fail-open warning unchanged, and keeps its
// four exports. The parser matrix runs in process under both shell modes (positive and negative controls); a handful of real hook launches prove the process contract with the variable set to adversarial content.
const BLOCK_MESSAGE = 'guard-raw-git: raw Git command blocked; use node .ai/tools/git-safe.mjs\n';
const MALFORMED_MESSAGE = 'guard-raw-git: could not parse command; allowed without checking\n';
const BLOCKED_LIST = ['diff', 'show', 'log', 'blame', 'cat-file', 'grep', 'archive', 'format-patch', 'whatchanged', 'stash', 'reflog', 'diff-tree', 'range-diff'];
const RAW_GIT_HOOK_IDENTITY = { event: 'PreToolUse', matcher: 'Bash|PowerShell', command: HOOK_COMMAND };
const CORE_EXPORTS = ['BLOCKED_SUBCOMMANDS', 'RAW_GIT_HOOK', 'evaluateHookInput', 'inspectCommand'];
// [label, command, expected] for both shells (the commands are valid in Bash and PowerShell alike).
const CONFIG_ENV_ROWS = [
  // the option absent: the existing behavior (negative controls)
  ['absent option: plain status', 'git status', 'allow'],
  ['absent option: log', 'git log', 'block'],
  ['absent option: -c with a non-alias key', 'git -c core.pager=cat status', 'allow'],
  ['absent option: -c with an alias key (existing rule)', 'git -c alias.st=status status', 'block'],
  ['absent option: option text in a commit message', 'git commit -m "alias.x --config-env=alias.x=V"', 'allow'],
  // a non-alias key: its value is consumed and the actual subcommand is still inspected
  ['non-alias key, attached form, allowed subcommand', 'git --config-env=core.pager=PAGER_VAR status', 'allow'],
  ['non-alias key, separate form, allowed subcommand', 'git --config-env core.pager=PAGER_VAR status', 'allow'],
  ['non-alias key, attached form, blocked subcommand', 'git --config-env=core.pager=PAGER_VAR log', 'block'],
  ['non-alias key, separate form, blocked subcommand', 'git --config-env core.pager=PAGER_VAR log', 'block'],
  ['non-alias key, separate form, blocked subcommand diff', 'git --config-env user.name=NAME_VAR diff', 'block'],
  ['non-alias key, a commit with a message', 'git --config-env=core.pager=PAGER_VAR commit -m "a message"', 'allow'],
  ['a key that only contains alias is not an alias key (aliases.x)', 'git --config-env=aliases.x=V status', 'allow'],
  ['a key that only contains alias is not an alias key (core.alias)', 'git --config-env core.alias=V status', 'allow'],
  ['a key that is exactly alias without a dot', 'git --config-env=alias status', 'allow'],
  ['a separate value that is exactly alias without a dot', 'git --config-env alias status', 'allow'],
  // an alias key blocks even with an otherwise allowed subcommand
  ['alias key, attached form, allowed subcommand', 'git --config-env=alias.st=STATUS_VAR status', 'block'],
  ['alias key, separate form, allowed subcommand', 'git --config-env alias.st=STATUS_VAR status', 'block'],
  ['alias key, attached form, a commit', 'git --config-env=alias.ci=CI_VAR commit -m "msg"', 'block'],
  ['alias key, separate form, no subcommand at all', 'git --config-env alias.x=VAR', 'block'],
  ['alias key, attached form, blocked subcommand too', 'git --config-env=alias.log=X log', 'block'],
  // mixed-case keys follow the same ASCII-case-insensitive key rule
  ['mixed case, attached form (ALIAS.)', 'git --config-env=ALIAS.st=VAR status', 'block'],
  ['mixed case, separate form (Alias.St)', 'git --config-env Alias.St=VAR status', 'block'],
  ['mixed case, attached form (aLiAs.)', 'git --config-env=aLiAs.x=V status', 'block'],
  // empty or malformed attached assignments: no Git configuration validation, a visibly identified alias key still blocks
  ['empty attached assignment is not an alias key', 'git --config-env= status', 'allow'],
  ['attached alias key without an assignment', 'git --config-env=alias.st status', 'block'],
  ['attached alias key with an empty variable name', 'git --config-env=alias.st= status', 'block'],
  ['attached alias key with an empty alias name', 'git --config-env=alias. status', 'block'],
  ['empty separate value is consumed', 'git --config-env "" status', 'allow'],
  // quoted values, multiple globals
  ['quoted attached alias key', 'git --config-env="alias.st=STATUS_VAR" status', 'block'],
  ['quoted separate alias key', "git --config-env 'alias.st=STATUS_VAR' status", 'block'],
  ['quoted non-alias key', 'git --config-env="core.pager=PAGER_VAR" status', 'allow'],
  ['quoted whole option, alias key', 'git "--config-env=alias.st=STATUS_VAR" status', 'block'],
  ['another global before the option', 'git -C . --config-env alias.st=V status', 'block'],
  ['a non-alias option after another global', 'git --git-dir=.git --config-env=core.pager=V status', 'allow'],
  ['two options, the alias one second', 'git --config-env=core.a=V --config-env=alias.b=V status', 'block'],
  ['two options, the alias one first', 'git --config-env=alias.a=V --config-env=core.b=V status', 'block'],
  ['a work-tree option, the alias option and a blocked subcommand', 'git --work-tree . --config-env=alias.a=V log', 'block'],
  ['-c and --config-env together without an alias', 'git -c core.pager=cat --config-env=core.editor=ED status', 'allow'],
  ['an alias key behind several other globals', 'git -C . --git-dir=.git -c core.pager=cat --config-env alias.x=V status', 'block'],
  // option text that is data stays data
  ['option text in an echo', 'echo git --config-env=alias.x=V status', 'allow'],
  ['option text in a commit message value', 'git commit -m "--config-env=alias.x=V"', 'allow'],
  ['option text as a separate commit message value', "git commit -m '--config-env alias.x=V'", 'allow'],
  ['option text in a comment', 'git status # --config-env=alias.x=V log', 'allow'],
  ['option text in a whole-line comment', '# git --config-env=alias.x=V status', 'allow'],
  // post-subcommand parsing is unchanged: after the subcommand the option is an ordinary argument
  ['after the subcommand, attached form', 'git status --config-env=alias.x=V', 'allow'],
  ['after the subcommand, separate form', 'git commit --config-env alias.x=V -m msg', 'allow'],
  ['after the subcommand a standalone -p still blocks', 'git status --config-env=alias.x=V -p', 'block'],
  // a recognized option without its value keeps the existing missing/malformed handling, and the alias and patch precedence
  ['missing separate value', 'git --config-env', 'malformed'],
  ['missing separate value after a safe option', 'git -c core.pager=cat --config-env', 'malformed'],
  ['missing separate value after an alias -c', 'git -c alias.x=1 --config-env', 'block'],
  ['missing separate value after a standalone -p', 'git -p --config-env', 'block'],
  // the lexical-failure precedence is unchanged: a failure anywhere wins over a block anywhere
  ['a block followed by an unterminated quote', "git --config-env=alias.x=V status; echo 'unterminated", 'malformed'],
  ['an unterminated quote before a block', "echo 'unterminated; git --config-env alias.x=V status", 'malformed'],
  // every command position is inspected
  ['an alias option in a later command position', 'git status; git --config-env=alias.x=V status', 'block'],
  ['an alias option after && behind git-safe', 'node .ai/tools/git-safe.mjs log && git --config-env alias.x=V status', 'block'],
];
const BASH_ONLY_ROWS = [
  ['a Bash heredoc body is a literal body', "cat <<'EOF'\ngit --config-env=alias.x=V status\nEOF", 'allow'],
  ['an alias option after a Bash heredoc still blocks', "cat <<'EOF'\nbody\nEOF\ngit --config-env=alias.x=V status", 'block'],
  ['an alias option inside $() is inspected', 'echo $(git --config-env=alias.x=V status)', 'block'],
];
const PS_ONLY_ROWS = [
  ['a PowerShell here-string body is a literal body', "@'\ngit --config-env=alias.x=V status\n'@", 'allow'],
  ['a PowerShell call operator with an alias option', '& git --config-env=alias.x=V status', 'block'],
  ['an alias option after a PowerShell here-string still blocks', "@'\nbody\n'@\ngit --config-env=alias.x=V status", 'block'],
];
async function configEnv(context) {
  startClock(context);
  fs.mkdirSync(context.tmp, { recursive: true });
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const core = await importOrFail(failures, skillUrl(context, 'assets/tools/guard-raw-git-core.mjs'), 'assets/tools/guard-raw-git-core.mjs');
    if (!core) return;
    await step('plan C12-9 and C12-10: CORE_EXPORTS stay exactly the four exports, the blocked list and the hook identity are unchanged', async () => {
      check(eq(Object.keys(core).sort(), CORE_EXPORTS), 'the core exports exactly BLOCKED_SUBCOMMANDS, RAW_GIT_HOOK, evaluateHookInput and inspectCommand', Object.keys(core).sort());
      check(eq([...core.BLOCKED_SUBCOMMANDS], BLOCKED_LIST) && Object.isFrozen(core.BLOCKED_SUBCOMMANDS), 'BLOCKED_SUBCOMMANDS keeps its thirteen frozen names in order', core.BLOCKED_SUBCOMMANDS);
      check(eq({ ...core.RAW_GIT_HOOK }, RAW_GIT_HOOK_IDENTITY) && Object.isFrozen(core.RAW_GIT_HOOK), 'RAW_GIT_HOOK keeps event PreToolUse, matcher Bash|PowerShell and the exact command', core.RAW_GIT_HOOK);
    });
    await step('the parser matrix: every row is judged exactly as the plan requires in Bash mode and in PowerShell mode (positive and negative controls, both forms, quoting, multiple globals, mixed case, data, post-subcommand, lexical precedence, missing value)', async () => {
      const all = (shell) => [...CONFIG_ENV_ROWS, ...(shell === 'Bash' ? BASH_ONLY_ROWS : PS_ONLY_ROWS)];
      for (const shell of ['Bash', 'PowerShell']) {
        for (const [label, command, want] of all(shell)) {
          const got = core.inspectCommand(command, shell);
          check(got === want, `${shell}: ${label}: ${show(command, 120)} is ${want}`, got);
        }
      }
      const blocks = CONFIG_ENV_ROWS.filter((r) => r[2] === 'block').length;
      const allows = CONFIG_ENV_ROWS.filter((r) => r[2] === 'allow').length;
      check(blocks >= 20 && allows >= 15 && CONFIG_ENV_ROWS.some((r) => r[2] === 'malformed'), 'the matrix holds positive controls (blocks), negative controls (allows) and the fail-open case', { blocks, allows });
    });
    await step('the named environment variable is never read or expanded: the whole matrix runs with a canary variable set to adversarial content and no environment access is observed', async () => {
      const canary = 'C12_CONFIG_ENV_CANARY';
      const hadCanary = hasOwn(process.env, canary);
      const previous = process.env[canary];
      process.env[canary] = 'alias.hack=log';
      const log = [];
      const realEnv = process.env;
      process.env = new Proxy(realEnv, { get(t, k, r) { if (typeof k === 'string') log.push(`get.${k}`); return Reflect.get(t, k, r); }, has(t, k) { log.push(`has.${String(k)}`); return Reflect.has(t, k); }, ownKeys(t) { log.push('keys'); return Reflect.ownKeys(t); } });
      const results = [];
      try {
        for (const shell of ['Bash', 'PowerShell']) {
          for (const [, command, want] of CONFIG_ENV_ROWS) results.push([core.inspectCommand(command.replace(/PAGER_VAR|STATUS_VAR|NAME_VAR|CI_VAR|VAR/g, canary), shell), want]);
          results.push([core.inspectCommand(`git --config-env=core.pager=${canary} status`, shell), 'allow']);
          results.push([core.inspectCommand(`git --config-env alias.st=${canary} status`, shell), 'block']);
        }
      } finally {
        process.env = realEnv;
        if (hadCanary) process.env[canary] = previous; else delete process.env[canary];
      }
      check(log.length === 0, 'the parser never touches process.env (no get, has or keys)', log.slice(0, 5));
      check(results.every(([got, want]) => got === want), 'the verdicts do not depend on the variable name or its value', results.filter(([got, want]) => got !== want).slice(0, 3));
    });
    await step('the hook process contract with the variable set: block (exit 2, the fixed message), allow (exit 0, silent) and malformed (exit 1, the fixed warning) through the real entrypoint, in both shell modes', async () => {
      const hook = skillPath(context, 'assets/tools/guard-raw-git.mjs');
      const env = { ...context.env, C12_CONFIG_ENV_VAR: 'alias.hack=log' };
      const input = (command, tool = 'Bash') => JSON.stringify({ tool_name: tool, tool_input: { command } });
      const cases = [
        ['Bash alias key, attached', input('git --config-env=alias.st=C12_CONFIG_ENV_VAR status'), 2, '', BLOCK_MESSAGE],
        ['Bash alias key, separate', input('git --config-env alias.st=C12_CONFIG_ENV_VAR status'), 2, '', BLOCK_MESSAGE],
        ['PowerShell alias key, separate', input('git --config-env alias.st=C12_CONFIG_ENV_VAR status', 'PowerShell'), 2, '', BLOCK_MESSAGE],
        ['Bash non-alias key', input('git --config-env=core.pager=C12_CONFIG_ENV_VAR status'), 0, '', ''],
        ['PowerShell non-alias key', input('git --config-env core.pager=C12_CONFIG_ENV_VAR status', 'PowerShell'), 0, '', ''],
        ['Bash missing value', input('git --config-env'), 1, '', MALFORMED_MESSAGE],
      ];
      for (const [label, stdin, code, out, err] of cases) {
        const r = execNode(context, { cwd: context.tmp, script: hook, args: [], env, input: stdin });
        check(!r.dead && r.code === code && r.stdout === out && r.stderr === err, `${label}: exit ${code}, stdout ${show(out)} and the fixed stderr`, { code: r.code, out: r.stdout.slice(0, 120), err: r.stderr.slice(0, 160), dead: r.dead });
      }
      // the same decisions through evaluateHookInput in process (no process at all)
      for (const [label, stdin, code, out, err] of cases) {
        const r = core.evaluateHookInput(stdin);
        check(eq(r, { exitCode: code, stdout: out, stderr: err }), `${label}: evaluateHookInput returns the same fixed outcome`, r);
      }
    });
    flushProcessCount(context, 'R51/C12/config-env', mark);
  });
}


// ======================================================= R80/C12/runtime-unit ====
// Plan C12-10: F4 changes the core's bytes but no runtime identity. The catalog keeps its seven members, order, roles and policy schemas; the hook identity is unchanged; trusted hashes derive from the current source bytes; applying the
// updated core records its new normalized hash; old or altered core bytes satisfy neither hook readiness nor a coupled runtime update while the complete current unit succeeds; the stale-core refusal, the complete-unit check, the input
// binding and the migration coupling stay enforced; hooks-selftest keeps its exact three-case transcript.
// PLAN-GAP: the plan names "old/altered core bytes" without fixing the old bytes, so staleness is simulated by altering the current core (appending a comment line) in one place and by the pinned normalized hash of the pre-C12 core
// (OLD_CORE_NH, computed from the committed file before C12) in another; no historical core copy is shipped or reconstructed.
const OLD_CORE_NH = 'db322078ace0f59c8fa71ab7a30065b586e55e87a5560866032a6c46135ff2f9';
const CORE_TARGET = '.ai/tools/guard-raw-git-core.mjs';
const SELFTEST_OK = 'PASS  guard-raw-git/allowed\nPASS  guard-raw-git/blocked\nPASS  guard-raw-git/malformed\n3 PASS / 0 FAIL\n';
const UNREVIEWED = (t) => ({ code: 'TOOL_UNIT_UNREVIEWED', error: `TOOL_UNIT_UNREVIEWED: reviewed tool bytes required: ${t}`, target: t });
const EXPECTED_CATALOG = { schema: 1, units: RUNTIME_MEMBERS.map((m, i) => ({ source: `assets/tools/${m}`, target: `.ai/tools/${m}`, role: RUNTIME_ROLES[i], policySchemas: [1, 2] })) };
const staleOf = (text, tag) => `${text}\n// c12 stale ${tag}\n`;
// A scratch copy of the skill (its scripts run unchanged); `core` replaces the core source when given.
function copySkillWith(context, dest, core = null) {
  for (const part of ['scripts', 'assets', 'data']) fs.cpSync(skillPath(context, part), path.join(dest, part), { recursive: true });
  fs.copyFileSync(skillPath(context, 'VERSION'), path.join(dest, 'VERSION'));
  if (core !== null) fs.writeFileSync(path.join(dest, 'assets', 'tools', 'guard-raw-git-core.mjs'), core);
  return dest;
}
async function runtimeUnit(context) {
  startClock(context);
  fs.mkdirSync(context.tmp, { recursive: true });
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const kit = makeKit(context, check);
    const sh = shipped(context);
    const fresh = await useBase(failures, 'fresh', getFreshBase, context);
    await step('plan C12-10: data/runtime-units.json keeps its seven members, order, roles and supported policy schemas; the hook identity is unchanged; the guard core changed bytes (its normalized hash is no longer the pre-C12 hash)', async () => {
      const catalog = readJson(skillPath(context, 'data/runtime-units.json'));
      check(eq(catalog, EXPECTED_CATALOG), 'the catalog is exactly the seven landed members with roles helper x4, entrypoint x3 and policySchemas [1, 2]', catalog);
      const core = await importOrFail(failures, skillUrl(context, 'assets/tools/guard-raw-git-core.mjs'), 'assets/tools/guard-raw-git-core.mjs');
      if (core) check(eq({ ...core.RAW_GIT_HOOK }, { event: 'PreToolUse', matcher: 'Bash|PowerShell', command: HOOK_COMMAND }), 'RAW_GIT_HOOK keeps event, matcher and command', core.RAW_GIT_HOOK);
      check(NH(sh.tools['guard-raw-git-core.mjs']) !== OLD_CORE_NH, 'the shipped core is not the pre-C12 core (F4 changes the core bytes, so reviewed runtime hashes must move with them)');
      for (const m of RUNTIME_MEMBERS) check(sh.tools[m] !== null && sh.tools[m] !== undefined, `assets/tools/${m} is readable (every catalog source exists)`);
    });
    await step('the installed self-test keeps its exact three-case transcript (launched from the real asset; the parser cases of C12 live in this component)', async () => {
      const r = execNode(context, { cwd: context.tmp, script: skillPath(context, 'assets/tools/hooks-selftest.mjs'), args: [] });
      countProcess(context, 3); // the self-test launches the hook three times itself
      check(!r.dead && r.code === 0 && r.stdout === SELFTEST_OK && r.stderr === '', 'hooks-selftest prints exactly the three PASS lines and 3 PASS / 0 FAIL, exit 0, empty stderr', { code: r.code, out: r.stdout.slice(0, 300), err: r.stderr.slice(0, 160), dead: r.dead });
      const st = await importOrFail(failures, skillUrl(context, 'assets/tools/hooks-selftest.mjs'), 'assets/tools/hooks-selftest.mjs');
      if (st) {
        const seen = [];
        const res = await st.runHooksSelfTest({ hookPath: skillPath(context, 'assets/tools/guard-raw-git.mjs'), execute: (...a) => { seen.push(a); return { status: 0, stdout: '', stderr: '' }; } });
        check(res && eq(res.cases.map((c) => c.id), ['allowed', 'blocked', 'malformed']) && seen.length === 3, 'the self-test has exactly the three cases allowed, blocked and malformed (no new case was added)', res && res.cases && res.cases.map((c) => c.id));
        check(eq(seen.map((a) => a[2].input), ['{"tool_name":"Bash","tool_input":{"command":"git status"}}', '{"tool_name":"Bash","tool_input":{"command":"git diff"}}', '{']), 'its three fixed inputs are unchanged (the new parser cases are in R51/C12/config-env, never here)', seen.map((a) => a[2] && a[2].input));
      }
    });
    await withScratch(context, 'runtime', async (dir) => {
      // ---- the complete current unit installs, records its new normalized hashes, and every altered or stale form is refused
      await step('a complete current unit (seven members from the shipped sources) prepares and commits and the manifest records each member as full with its normalized hash, the core with its new one', async () => {
        if (!fresh) return;
        const begun = cloneBase(dir, fresh, 'unit-begun');
        if (!kit.begin(begun, RUN_ID)) return;
        const prepared = cloneTree(begun, path.join(dir, 'unit-prepared'));
        for (const m of RUNTIME_MEMBERS) putDraft(prepared, RUN_ID, `.ai/tools/${m}`, sh.tools[m]);
        const prep = kit.prepare(prepared, RUN_ID, { mode: 'fresh' });
        check(prep.code === 0 && prep.json && prep.json.ok === true, 'the complete current unit prepares', { code: prep.code, out: prep.stdout.slice(0, 300) });
        if (prep.code !== 0) return;
        const pd = kit.diff(prepared, RUN_ID);
        check(pd.code === 0 && pd.json && pd.json.ok === true && pd.json.prepared === true, 'its prepared diff succeeds', { code: pd.code, out: pd.stdout.slice(0, 200) });
        // a forged plan whose core draft is stale or altered is refused at the prepared diff and at commit with the complete-unit refusal
        const forged = cloneTree(prepared, path.join(dir, 'unit-forged'));
        const sha2 = forgeDraft(forged, RUN_ID, CORE_TARGET, staleOf(sh.tools['guard-raw-git-core.mjs'], 'core'));
        let before = noWriteState(forged, RUN_ID);
        expectF(check, 'forged altered core: prepared diff', kit.diff(forged, RUN_ID), { ...UNREVIEWED(CORE_TARGET), exit: 3 });
        check(projectSnapshot(forged) === before.project, 'forged altered core: the prepared diff writes nothing');
        expectF(check, 'forged altered core: commit of the bound, hash-approved plan', kit.commit(forged, RUN_ID, sha2), { ...UNREVIEWED(CORE_TARGET), exit: 3 });
        checkNoWrite(check, 'forged altered core: commit', forged, RUN_ID, before);
        const c = kit.commit(prepared, RUN_ID, prep.json.planSha256);
        check(c.code === 0 && c.json && c.json.committed === true, 'the complete current unit commits', { code: c.code, out: c.stdout.slice(0, 300) });
        const manifest = readJson(manifestPath(prepared));
        for (const m of RUNTIME_MEMBERS) {
          const rec = manifest && manifest.files[`.ai/tools/${m}`];
          check(rec && eq(rec, { ownership: 'full', sha256: NH(sh.tools[m]) }), `the manifest records .ai/tools/${m} as full with its normalized hash`, rec);
          check(sameBytes(readBytes(projPath(prepared, `.ai/tools/${m}`)), Buffer.from(sh.tools[m], 'utf8')), `.ai/tools/${m} is installed with the shipped bytes`);
        }
        const core = manifest && manifest.files[CORE_TARGET];
        check(core && core.sha256 === NH(sh.tools['guard-raw-git-core.mjs']) && core.sha256 !== OLD_CORE_NH, 'the core record carries the new normalized hash, not the pre-C12 one', core);
        // an altered core among the drafts is refused at prepare and in the unprepared diff, before any approval
        const altered = cloneTree(begun, path.join(dir, 'unit-altered'));
        for (const m of RUNTIME_MEMBERS) putDraft(altered, RUN_ID, `.ai/tools/${m}`, m === 'guard-raw-git-core.mjs' ? staleOf(sh.tools[m], 'core') : sh.tools[m]);
        before = noWriteState(altered, RUN_ID);
        expectP(check, 'an altered core among the seven drafts: prepare', kit.prepare(altered, RUN_ID, { mode: 'fresh' }), [{ target: CORE_TARGET, code: 'TOOL_UNIT_UNREVIEWED', error: UNREVIEWED(CORE_TARGET).error }]);
        checkNoWrite(check, 'an altered core: prepare', altered, RUN_ID, before);
        expectF(check, 'an altered core among the seven drafts: unprepared diff', kit.diff(altered, RUN_ID), { ...UNREVIEWED(CORE_TARGET), exit: 3 });
      });
      await step('an installed stale core: updating another member alone is refused (the core is neither updated nor a bound reviewed input), a stale core declared as an input is refused, and the complete current unit updates the recorded core to its new normalized hash', async () => {
        const staleCore = staleOf(sh.tools['guard-raw-git-core.mjs'], 'core');
        const staleEntry = staleOf(sh.tools['git-safe.mjs'], 'entry');
        const files = {};
        const records = {};
        for (const m of RUNTIME_MEMBERS) {
          const text = m === 'guard-raw-git-core.mjs' ? staleCore : m === 'git-safe.mjs' ? staleEntry : sh.tools[m];
          files[`.ai/tools/${m}`] = text;
          records[`.ai/tools/${m}`] = { ownership: 'full', sha256: NH(text) };
        }
        files[T_MANIFEST] = jsonText(manifestOf(records));
        const base = mkBase(context, 'stale-unit', files);
        const begun = cloneBase(dir, base, 'stale-begun');
        if (!kit.begin(begun, RUN_ID)) return;
        const declare = (root, targets) => putRequest(root, RUN_ID, 'transaction-inputs.json', targets);
        const benignInputs = ['.ai/tools/security-policy.mjs', '.ai/tools/git-safe-core.mjs'];
        // (1) only git-safe.mjs is updated; security-policy and git-safe-core are declared (reviewed) inputs, the core is not
        const one = cloneTree(begun, path.join(dir, 'stale-one'));
        putDraft(one, RUN_ID, '.ai/tools/git-safe.mjs', sh.tools['git-safe.mjs']);
        declare(one, benignInputs);
        let before = noWriteState(one, RUN_ID);
        expectP(check, 'stale core, another member updated alone: prepare', kit.prepare(one, RUN_ID, {}), [{ target: CORE_TARGET, code: 'TOOL_UNIT_UNREVIEWED', error: UNREVIEWED(CORE_TARGET).error }]);
        checkNoWrite(check, 'stale core refusal: prepare', one, RUN_ID, before);
        expectF(check, 'stale core, another member updated alone: unprepared diff', kit.diff(one, RUN_ID), { ...UNREVIEWED(CORE_TARGET), exit: 3 });
        // (2) the stale core is declared as a transaction input: bound bytes that are not the reviewed bytes never satisfy the unit
        const two = cloneTree(begun, path.join(dir, 'stale-two'));
        putDraft(two, RUN_ID, '.ai/tools/git-safe.mjs', sh.tools['git-safe.mjs']);
        declare(two, [...benignInputs, CORE_TARGET]);
        before = noWriteState(two, RUN_ID);
        expectP(check, 'stale core declared as an input: prepare', kit.prepare(two, RUN_ID, {}), [{ target: CORE_TARGET, code: 'TOOL_UNIT_UNREVIEWED', error: UNREVIEWED(CORE_TARGET).error }]);
        checkNoWrite(check, 'stale core declared as input: prepare', two, RUN_ID, before);
        // (3) the complete current unit: the core and git-safe are replaced by the shipped bytes, the other five are reviewed inputs
        const three = cloneTree(begun, path.join(dir, 'stale-three'));
        putDraft(three, RUN_ID, CORE_TARGET, sh.tools['guard-raw-git-core.mjs']);
        putDraft(three, RUN_ID, '.ai/tools/git-safe.mjs', sh.tools['git-safe.mjs']);
        declare(three, RUNTIME_MEMBERS.filter((m) => m !== 'guard-raw-git-core.mjs' && m !== 'git-safe.mjs').map((m) => `.ai/tools/${m}`));
        const prep = kit.prepare(three, RUN_ID, {});
        check(prep.code === 0 && prep.json && prep.json.ok === true, 'the current core and entrypoint with the other five members as reviewed inputs prepare', { code: prep.code, out: prep.stdout.slice(0, 300) });
        if (prep.code !== 0) return;
        const c = kit.commit(three, RUN_ID, prep.json.planSha256);
        check(c.code === 0 && c.json && c.json.committed === true, 'the update commits', { code: c.code, out: c.stdout.slice(0, 300) });
        const manifest = readJson(manifestPath(three));
        const rec = manifest && manifest.files[CORE_TARGET];
        check(rec && eq(rec, { ownership: 'full', sha256: NH(sh.tools['guard-raw-git-core.mjs']) }) && rec.sha256 !== OLD_CORE_NH, 'the updated core is recorded with its new normalized hash (the stale hash is gone)', rec);
        check(manifest && eq(manifest.files['.ai/tools/git-safe.mjs'], { ownership: 'full', sha256: NH(sh.tools['git-safe.mjs']) }) && eq(manifest.files['.ai/tools/review-diff.mjs'], records['.ai/tools/review-diff.mjs']), 'the entrypoint record moved too and an unchanged member keeps its record', manifest && Object.keys(manifest.files));
      });
      await step('trusted hashes derive from the current source bytes: from a skill whose core source is altered, the altered unit is the reviewed one (it installs) and the pristine core is the stale one (it is refused)', async () => {
        if (!fresh) return;
        const altered = staleOf(sh.tools['guard-raw-git-core.mjs'], 'source');
        const skillB = copySkillWith(context, path.join(dir, 'skill-b'), altered);
        const kitB = makeKit(context, check, skillB);
        const begun = cloneBase(dir, fresh, 'copy-begun');
        if (!kitB.begin(begun, RUN_ID)) return;
        const good = cloneTree(begun, path.join(dir, 'copy-good'));
        for (const m of RUNTIME_MEMBERS) putDraft(good, RUN_ID, `.ai/tools/${m}`, m === 'guard-raw-git-core.mjs' ? altered : sh.tools[m]);
        const prep = kitB.prepare(good, RUN_ID, { mode: 'fresh' });
        check(prep.code === 0 && prep.json && prep.json.ok === true, 'the unit built from the altered current source prepares under that skill copy', { code: prep.code, out: prep.stdout.slice(0, 300) });
        const old = cloneTree(begun, path.join(dir, 'copy-old'));
        for (const m of RUNTIME_MEMBERS) putDraft(old, RUN_ID, `.ai/tools/${m}`, sh.tools[m]);
        expectP(check, 'the pristine core under a skill whose source differs: prepare', kitB.prepare(old, RUN_ID, { mode: 'fresh' }), [{ target: CORE_TARGET, code: 'TOOL_UNIT_UNREVIEWED', error: UNREVIEWED(CORE_TARGET).error }]);
      });
      await step('hook readiness needs the current guard unit: --hooks-only adds the canonical hook only when the installed or staged guard and core equal the skill source (current unit ready; an old or altered core, from either side, is not ready; a staged current core is ready)', async () => {
        const skillA = copySkillWith(context, path.join(dir, 'skill-a'));
        const alteredCore = staleOf(sh.tools['guard-raw-git-core.mjs'], 'hook');
        const skillB = copySkillWith(context, path.join(dir, 'skill-b2'), alteredCore);
        const guard = sh.tools['guard-raw-git.mjs'];
        const core = sh.tools['guard-raw-git-core.mjs'];
        const base = mkBase(context, 'hooks', { [T_SETTINGS]: jsonText({ permissions: { deny: [] } }) });
        const begun = cloneBase(dir, base, 'hooks-begun');
        if (!kit.begin(begun, RUN_ID)) return;
        const HOOK = { event: 'PreToolUse', matcher: 'Bash|PowerShell', command: HOOK_COMMAND };
        const scenario = (label, skill, installed, staged, ready) => {
          const root = cloneTree(begun, path.join(dir, `hooks-${label.replace(/\W+/g, '-')}`));
          if (installed) { putFile(projPath(root, '.ai/tools/guard-raw-git.mjs'), installed.guard); putFile(projPath(root, '.ai/tools/guard-raw-git-core.mjs'), installed.core); }
          if (staged) { putDraft(root, RUN_ID, '.ai/tools/guard-raw-git.mjs', staged.guard); putDraft(root, RUN_ID, '.ai/tools/guard-raw-git-core.mjs', staged.core); }
          const r = execNode(context, { cwd: root, script: path.join(skill, 'scripts', 'merge-claude-settings.mjs'), args: ['--run-id', RUN_ID, '--hooks-only'], env: context.env });
          const hooks = r.json && r.json.report && r.json.report.hooks;
          if (ready) {
            check(r.code === 0 && r.json && r.json.ok === true && r.json.changed === true && hooks && eq(hooks.added, [HOOK]) && hooks.skipped === null && exists(draftPath(root, RUN_ID, T_SETTINGS)), `${label}: the canonical hook is added and a settings draft is staged`, { code: r.code, out: r.stdout.slice(0, 300) });
          } else {
            check(r.code === 0 && r.json && r.json.ok === true && r.json.changed === false && hooks && eq(hooks.added, []) && hooks.skipped === 'guard-raw-git.mjs not staged or installed' && !exists(draftPath(root, RUN_ID, T_SETTINGS)), `${label}: the hook is not added ("guard-raw-git.mjs not staged or installed") and no settings draft is staged`, { code: r.code, out: r.stdout.slice(0, 300) });
          }
        };
        scenario('current unit installed', skillA, { guard, core }, null, true);
        scenario('altered skill core, installed core is the old one', skillB, { guard, core }, null, false);
        scenario('pristine skill, installed core is altered', skillA, { guard, core: alteredCore }, null, false);
        scenario('altered skill core, installed core equals it (the complete current unit)', skillB, { guard, core: alteredCore }, null, true);
        scenario('altered skill core, a staged current core replaces the old installed one', skillB, { guard, core }, { guard, core: alteredCore }, true);
        scenario('pristine skill, a staged altered core never falls back to the installed current one', skillA, { guard, core }, { guard, core: alteredCore }, false);
      });
      await step('the migration coupling stays enforced: a staged migration whose core draft is altered is MIGRATION_OUTPUT_MISMATCH at the core in prepare and in the unprepared diff', async () => {
        const mig = await useBase(failures, 'migration', getMigBase, context);
        if (!mig) return;
        const m = migrationRun(kit, check, dir, mig, 'rt-mig');
        if (!m) return;
        const staged = stagedMigration(m, 'staged');
        if (!staged) return;
        const core = readText(draftPath(staged, m.id, CORE_TARGET));
        check(core === sh.tools['guard-raw-git-core.mjs'], 'the stage supplies the current core from the same skill copy');
        putDraft(staged, m.id, CORE_TARGET, staleOf(core, 'migration'));
        const before = noWriteState(staged, m.id);
        const want = { code: 'MIGRATION_OUTPUT_MISMATCH', error: MISMATCH_TEXT(CORE_TARGET), target: CORE_TARGET };
        expectP(check, 'a coupled migration with an altered core draft: prepare', kit.prepare(staged, m.id, { approve: [T_POLICY] }), [{ target: want.target, code: want.code, error: want.error }]);
        checkNoWrite(check, 'altered core in a migration: prepare', staged, m.id, before);
        expectF(check, 'a coupled migration with an altered core draft: unprepared diff', kit.diff(staged, m.id), { code: want.code, exit: 3, error: want.error, target: want.target });
      });
    });
    flushProcessCount(context, 'R80/C12/runtime-unit', mark);
  });
}


// ============================================== A5-templates/C12/documentation ====
// Plan C12-3, C12-6, C12-9, C12-11 and C12-14 (exact prose where the plan gives it, plan-fixed substrings and meaning rules where it does not): the Phase 1 step 3 policy workflow, never-read rule 2 and its installed-policy clause, README line 16,
// references/security.md, state-and-apply.md, docs-generation.md, claude.md (the stale integration sentence, the Blocked list, the two stale v2 references), the two Codex wrapper comments, the Claude wrappers (byte-identical to their v2
// snapshots) and the docs-sync agent (two exact paragraphs, no launcher claim; the reviewer unchanged).
// PLAN-GAP: the plan fixes four exact texts (the rule 2 substring, the two docs-sync paragraphs, the claude.md sentence) and describes the rest by meaning. Those meanings are asserted with wording-tolerant patterns on the sentence level
// (each pattern is stated in its check label), never by a verbatim sentence. The identification of "the two stale prospective v2 references" is inferred as the "while writing v2" sentences of references/claude.md and references/codex.md.
const RULE2_SUBSTRING = '`data/secret-paths.json` (`.env`, `.env.*` including `.env.example`, keys, certs, `secrets/`, `credentials/`,';
const RULE2_REMAINDER = '`.npmrc`, the run vault)';
const SEVEN_FENCE = ['```text', ...RUNTIME_MEMBERS, '```'].join('\n');
const STAGE_PARAGRAPH = 'Stage all seven runtime members as one reviewed compatible unit. Declining replacement of an edited member prevents the coupled policy update. Do not install the new policy with old or unreviewed readers.';
const DOCS_NO_FALLBACK = 'Do not retry a failed or denied read through another tool, change the sandbox, request full access, or use a connector as a fallback. Instructions are guidance, not a sandbox.';
const DOCS_FOUR_COMMANDS = 'Never run `git checkout`, `git switch`, `gh pr checkout` or `git worktree add`. Do not fetch refs yourself; the user supplies or fetches the ref.';
const REVIEWER_NO_FALLBACK = 'Do not retry a failed or denied read through another tool, change the sandbox, request full access, or use a connector as a fallback. Instructions are guidance, not a sandbox; the review lane also requires the launcher isolation described in the setup documentation.';
const REVIEWER_FOUR_COMMANDS = 'Never run `git checkout`, `git switch`, `gh pr checkout` or `git worktree add`. Do not fetch the reviewed branch yourself; the user supplies or fetches the ref.';
const STDOUT_SENTENCES = 'Consume review-diff stdout or an artifact supplied by the orchestrator. Reviewers do not use `--out`, redirect stdout to a file, or create review artifacts. Docs-sync follows the same rule.';
const CLAUDE_SELFTEST_SENTENCE = '`validate.mjs` (C10) runs it during validation; `doctor.mjs` does not run it.';
const CLAUDE_REJECTIONS = [['a missing self-test', /missing self-test/], ['a launch failure', /launch failure/], ['a timeout', /timeout/], ['a nonzero exit', /nonzero exit/], ['nonempty stderr', /nonempty stderr/], ['empty stdout', /empty stdout/], ['a nonexact transcript', /(any stdout other than the exact transcript|nonexact transcript)/]];
// Pins of the unchanged content around the edited wrapper comments (SHA-256 of the LF text after the first line, computed from the committed wrappers before C12).
const CODEX_WRAPPER_REST = { 'assets/wrappers/codex-reviewer.toml': ['45811d671721d44be2d15c5c98f0163815aeb5d8081c6e1652f095657b20eaf8', 'reviewer'], 'assets/wrappers/codex-docs_sync.toml': ['ff931323250a906609691e2549cc7e7173aef46efd304feea28245a3102a2771', 'docs-sync'] };
const CLAUDE_WRAPPER_PIN = { 'assets/wrappers/claude-reviewer.md': '284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423', 'assets/wrappers/claude-docs-sync.md': '36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43' };
const between = (text, startMarker, endMarker) => {
  if (text === null) return null;
  const s = text.indexOf(startMarker);
  if (s < 0) return null;
  const e = text.indexOf(endMarker, s + startMarker.length);
  return e < 0 ? text.slice(s) : text.slice(s, e);
};
const sentencesOf = (text) => squash(text).split(/(?<=[.!?])\s+(?=[A-Z`*(])/);
const someSentence = (text, ...res) => sentencesOf(text).some((s) => res.every((re) => re.test(s)));
async function documentation(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const doc = (rel) => { const t = readText(skillPath(context, rel)); if (t === null) check(false, `${rel} is readable`); return t === null ? null : LF(t); };
    const skill = doc('SKILL.md');
    const readme = doc('README.md');
    const security = doc('references/security.md');
    const state = doc('references/state-and-apply.md');
    const docgen = doc('references/docs-generation.md');
    const claude = doc('references/claude.md');
    const codex = doc('references/codex.md');
    const migration = doc('references/migration-v2.md');
    const docsync = doc('assets/agents/docs-sync.md');
    const reviewer = doc('assets/agents/reviewer.md');
    await step('SKILL.md rule 2 keeps the exact C9 substring and the rest of its example list, then covers the union of the shipped defaults and the installed policy (patterns and projectPatterns), the shipped fallback on absence and fail-closed on an invalid installed policy', async () => {
      const rule2 = between(skill, '2. **Never read secrets.**', '\n3. **Nothing is overwritten silently.**');
      check(rule2 !== null, 'rule 2 is found between rules 1 and 3');
      if (rule2 === null) return;
      check(squash(rule2).includes(RULE2_SUBSTRING), 'rule 2 holds the whitespace-normalized substring "data/secret-paths.json (.env, .env.* including .env.example, keys, certs, secrets/, credentials/," verbatim', clip(RULE2_SUBSTRING));
      check(squash(rule2).includes(RULE2_REMAINDER), 'rule 2 retains the remainder of the existing example list (.npmrc, the run vault)');
      const s = squash(rule2);
      check(s.includes('.ai/security-paths.json') && /\bpatterns\b/.test(s) && /\bprojectPatterns\b/.test(s), 'rule 2 names the installed .ai/security-paths.json with both patterns and projectPatterns', s.slice(0, 200));
      check(/\bunion\b|\bboth\b/i.test(s) && /installed/i.test(s) && /shipped/i.test(s), 'rule 2 states the boundary as the union (or both) of the shipped defaults and the installed policy (wording-tolerant: union|both, installed, shipped)');
      check(someSentence(rule2, /(absen|missing|no installed)/i, /(shipped|fallback|defaults)/i), 'rule 2 says that an absent installed policy permits the shipped fallback (a sentence naming absence and the shipped fallback)');
      check(someSentence(rule2, /(invalid|unreadable|malformed)/i, /fail(s)? closed/i), 'rule 2 says that an invalid installed policy fails closed (a sentence naming invalid and fails closed)');
      check(/\benv-keys\.mjs\b/.test(rule2) && /Env variable \*\*names\*\*/.test(rule2) && /git-safe\.mjs/.test(rule2) && /names-only discovery/.test(rule2), 'rule 2 keeps the env-keys names-only wording, the git-safe reader sentence and the names-only discovery sentence');
      check(squash(rule2).includes('The only environment-template exception is the reviewed project-setup `env-keys.mjs` and `apply.mjs` flow for the root `.env.example`.'), 'the script-only template exception paragraph is retained');
    });
    await step('SKILL.md Phase 1 step 3: the shipped default is copied only with no installed policy (full ownership); an installed policy is never overwritten by data/secret-paths.json; the three triggers, the report/decisions/stage workflow, the error rule, keys ownership and the rerun rule are stated; the seven-name fence and the unit paragraph are verbatim', async () => {
      const step3 = between(skill, '\n3. Security policy', '\n4. Settings');
      check(step3 !== null, 'Phase 1 step 3 is found between steps 2 and 4');
      if (step3 === null) return;
      const s = squash(step3);
      check(step3.split('\n').map((l) => l.replace(/^ {1,8}/, '')).join('\n').includes(SEVEN_FENCE), 'the existing seven-name runtime fence is preserved verbatim, in its order (list indentation aside)', step3.slice(-400));
      check(s.includes(STAGE_PARAGRAPH), 'the paragraph beginning "Stage all seven runtime members as one reviewed compatible unit." is preserved verbatim');
      check(!/Otherwise copy\s+`data\/secret-paths\.json`/.test(step3), 'the old unconditional "Otherwise copy data/secret-paths.json" sentence is gone');
      check(someSentence(step3, /\b(no|without|absent|missing|not installed|not present)\b/i, /`data\/secret-paths\.json`/, /\bcopy\b/i), 'with no installed policy, copying the shipped default is the fresh-install path (a sentence naming absence of the installed policy, the shipped file and copying)');
      check(/`full`/.test(s) && /fresh/i.test(s), 'the fresh-install path keeps full ownership (names `full` and a fresh install)');
      check(someSentence(step3, /(never|do not|must not)/i, /copy/i, /`data\/secret-paths\.json`/, /(over|onto|replace)/i) || someSentence(step3, /(never|do not|must not)/i, /(overwrite|replace)/i, /installed/i), 'with an installed policy the shipped file is never copied over it (a sentence with never/do not, copy or replace, and the shipped file or the installed policy)');
      check(/update/i.test(s) && /schema-2/.test(s) && /manifest/i.test(s), 'trigger: detect reports mode update with a schema-2 manifest');
      check(/behind/i.test(s) && /unknown/i.test(s) && /baseline/i.test(s), 'trigger: managed patterns behind the skill or an unknown installed baseline');
      check(/edited since install/i.test(s), 'trigger (addendum C12-P2-1): the security-state row "managed patterns edited since install"');
      check(/(user|the user) requests? a policy change|requests? a policy change|policy change/i.test(s), 'trigger: the user requests a policy change');
      check(/report/i.test(s) && /decision/i.test(s) && /stage/i.test(s) && s.includes('references/migration-v2.md'), 'the workflow is the migration report, recorded explicit decisions and the stage, as described in references/migration-v2.md');
      check(someSentence(step3, /(invalid|unreadable)/i, /installed/i, /error/i) && /evidence of absence|not (as )?evidence|never .{0,40}absen/i.test(s), 'an invalid or unreadable installed policy is an error, never evidence of absence');
      check(/`keys`/.test(s) && /\bprojectPatterns\b/.test(s) && /managed `?patterns`?/i.test(s), 'a migration-staged policy has keys ownership and its managed metadata holds managed patterns, never projectPatterns');
      check(/(rerun|re-run|rerunning)/i.test(s) && /preserv/i.test(s) && /ownership record|installed ownership/i.test(s), 'a rerun without a policy draft preserves the installed ownership record');
      check(!/--file/.test(skill || ''), 'SKILL.md contains no --file text');
    });
    await step('README.md no longer calls the shipped file the single source for every control and distinguishes shipped defaults from installed project additions', async () => {
      const line = readme === null ? null : readme.split('\n').find((l) => /^data\//.test(l));
      check(line !== undefined && line !== null, 'the README inventory has its data/ line');
      if (!line) return;
      check(line.includes('secret-paths.json') && !/single source for every (secret )?control/i.test(line), 'the data/ line still names secret-paths.json and no longer claims it is the single source for every control', line);
      check(/shipped|default/i.test(line) && /(installed|project)/i.test(line), 'the data/ line says shipped defaults and distinguishes installed project additions (wording-tolerant: shipped|default and installed|project)', line);
    });
    await step('references/security.md section 1 states the policy workflow (triggers, report, decisions, stage), the shipped-plus-installed refusal union and the installed effective policy used by renderers and Git readers', async () => {
      const sec1 = between(security, '## 1. Secret paths', '\n## 2. ');
      check(sec1 !== null, 'section 1 is found');
      if (sec1 === null) return;
      const s = squash(sec1);
      check(s.includes('`data/secret-paths.json`') && s.includes('`.ai/security-paths.json`') && /\bprojectPatterns\b/.test(s), 'it names the shipped file, the installed policy and projectPatterns');
      check(someSentence(sec1, /(never|do not|must not)/i, /(copy|overwrite|replace)/i, /(shipped|`data\/secret-paths\.json`)/i), 'an installed policy is never replaced by copying the shipped defaults (a sentence with never/do not, copy|overwrite|replace and the shipped file)');
      check(/update/i.test(s) && /schema-2/.test(s) && /behind/i.test(s) && /unknown/i.test(s) && /edited since install/i.test(s) && /policy change/i.test(s), 'the update, schema-2, behind, unknown baseline, edited-since-install and user-request triggers are described');
      check(/report/i.test(s) && /decision/i.test(s) && /stage/i.test(s), 'the report, decisions and stage workflow is described');
      check(/refusal/i.test(s) && /(union|both)/i.test(s) && /effective/i.test(s) && /(render|reader)/i.test(s), 'the refusal union is distinguished from the installed effective policy used by renderers and Git readers (wording-tolerant: refusal, union|both, effective, render|reader)');
      check(squash(security).includes('The only environment-template exception is the reviewed project-setup `env-keys.mjs` and `apply.mjs` flow for the root `.env.example`.') && /redact/i.test(security), 'the env-keys exception, scanner exception and redaction wording are preserved');
    });
    await step('references/state-and-apply.md and references/docs-generation.md: the fresh-policy full-ownership exception is clear, and no text implies that every installed policy is fully managed', async () => {
      const fresh = state === null ? [] : state.split('\n').filter((l) => l.includes('.ai/security-paths.json'));
      check(fresh.length > 0 && fresh.some((l) => /`full`/.test(l) || /\bfull\b/.test(l)) && fresh.some((l) => /fresh|first install|no installed policy/i.test(l)), 'state-and-apply.md says a fresh policy is created with full ownership (a line naming .ai/security-paths.json with full and fresh|first install|no installed policy)', fresh.map((l) => l.slice(0, 160)));
      check(state !== null && /\| `keys` \|[^\n]*`\.ai\/security-paths\.json`/.test(state), 'the keys ownership row still covers .ai/security-paths.json');
      const row = docgen === null ? null : docgen.split('\n').find((l) => l.startsWith('| `.ai/security-paths.json` |'));
      check(row !== undefined && row !== null, 'docs-generation.md has its .ai/security-paths.json row');
      if (!row) return;
      check(/(fresh|first|initial|new project)/i.test(row) && (/`keys`/.test(row) || /migrat/i.test(row)), 'the row distinguishes the initial creation of the policy from its later state under keys ownership or migration (wording-tolerant: fresh|first|initial and `keys`|migrat)', row.slice(0, 300));
      check(!/fully managed/i.test(row) && !/every installed policy is (fully )?managed/i.test(docgen), 'the row no longer implies a fully managed policy');
    });
    await step('references/migration-v2.md keeps the runtime fence, the unit paragraph and the report, decisions and stage workflow', async () => {
      check(migration !== null && RUNTIME_MEMBERS.every((m) => migration.includes(`\`${m}\``)), 'the seven runtime names stay in the stage description');
      check(migration !== null && squash(migration).includes(STAGE_PARAGRAPH), 'the unit paragraph is preserved verbatim');
      check(migration !== null && migration.includes('node <SKILL_DIR>/scripts/migrate-security-paths.mjs report --project .') && migration.includes('node <SKILL_DIR>/scripts/migrate-security-paths.mjs stage --project . --run-id <id>'), 'the report and stage commands are preserved');
    });
    await step('references/claude.md: the stale integration sentence is replaced by the exact C10 wording with every rejection criterion kept; the Blocked list names --config-env alias.*; the stale prospective v2 reference is gone (also in codex.md)', async () => {
      const selftest = between(claude, '### Installed self-test', '\n### ');
      check(selftest !== null, 'the Installed self-test section is found');
      if (selftest !== null) {
        const s = squash(selftest);
        check(s.includes(CLAUDE_SELFTEST_SENTENCE), 'the section holds exactly "`validate.mjs` (C10) runs it during validation; `doctor.mjs` does not run it."', clip(CLAUDE_SELFTEST_SENTENCE));
        check(!s.includes('that integration is not part of this change'), 'the stale "that integration is not part of this change" wording is gone');
        for (const [label, re] of CLAUDE_REJECTIONS) check(re.test(s), `the section keeps the rejection criterion ${label}`);
        check(/direct hook behavior/.test(s) && /not that Claude (runs|loads) it|Claude hook loading/.test(s) && /not that settings reference the hook/.test(s), 'the distinction between direct execution and Claude hook loading is preserved');
        check(selftest.includes('PASS  guard-raw-git/allowed') && selftest.includes('3 PASS / 0 FAIL'), 'the exact transcript fence is preserved');
      }
      const blocked = claude === null ? null : (claude.split('\n\n').find((p) => p.startsWith('Blocked: ')) || null);
      check(blocked !== null && squash(blocked).includes('`--config-env alias.*`') && squash(blocked).includes('an inline `-c alias.*` override'), 'the Blocked list names "`--config-env alias.*`" next to the existing inline -c alias.* override', blocked && squash(blocked).slice(0, 240));
      check(claude !== null && !/while writing v2/i.test(claude) && /checked against the Claude Code docs/i.test(claude), 'references/claude.md no longer says "while writing v2" and still says it was checked against the Claude Code docs');
      check(codex !== null && !/while writing v2/i.test(codex) && /checked against the Codex docs/i.test(codex), 'references/codex.md no longer says "while writing v2" and still says it was checked against the Codex docs');
    });
    await step('the Codex wrappers change only their stale version comment (first line, same canonical path) and the Claude wrappers stay byte-identical to their v2 snapshots', async () => {
      for (const [rel, [pin, name]] of Object.entries(CODEX_WRAPPER_REST)) {
        const text = doc(rel);
        if (text === null) continue;
        const lines = text.split('\n');
        check(new RegExp(`^# Codex custom agent wrapper\\b[^\\n]*project-setup[^\\n]*Canonical definition: \\.ai/agents/${name}\\.md$`).test(lines[0]) && !/\bv\d/i.test(lines[0]) && !/\d\.\d/.test(lines[0]), `${rel}: the first line is a version-neutral wrapper comment that still names project-setup and the same canonical definition`, lines[0]);
        check(sha(Buffer.from(lines.slice(1).join('\n'), 'utf8')) === pin, `${rel}: every other byte is unchanged (SHA-256 of the text after the first line)`);
      }
      for (const [rel, pin] of Object.entries(CLAUDE_WRAPPER_PIN)) {
        const raw = readBytes(skillPath(context, rel));
        const snap = readBytes(skillPath(context, rel.replace('assets/wrappers/', 'data/v2.0.0/assets/wrappers/')));
        check(raw !== null && sha(raw) === pin && snap !== null && Buffer.compare(raw, snap) === 0, `${rel}: byte-identical to its v2 snapshot (and to the pinned digest)`, raw && sha(raw));
      }
    });
    await step('the docs-sync agent carries the two exact docs-sync paragraphs and makes no launcher claim, keeps the review-diff stdout sentence followed by "Docs-sync follows the same rule.", and the reviewer keeps its own unchanged paragraphs', async () => {
      const rules = between(docsync, '## Rules', '\n## Output');
      check(rules !== null, 'the docs-sync Rules section is found');
      if (rules !== null) {
        check(squash(rules).includes(DOCS_NO_FALLBACK), 'docs-sync: the no-retry, no-sandbox-change, no-connector-fallback paragraph is exactly the docs-sync text', clip(DOCS_NO_FALLBACK));
        check(squash(rules).includes(DOCS_FOUR_COMMANDS), 'docs-sync: the four-command ban with "Do not fetch refs yourself" is exactly the docs-sync text', clip(DOCS_FOUR_COMMANDS));
        check(!/launcher/i.test(docsync) && !/review lane/i.test(docsync) && !squash(docsync).includes('the reviewed branch yourself'), 'docs-sync asserts no launcher, no review lane and no reviewed-branch fetch sentence');
      }
      check(docsync !== null && squash(docsync).includes(STDOUT_SENTENCES), 'the review-diff stdout sentence is followed by "Docs-sync follows the same rule." (C8 judgment call g)');
      check(docsync !== null && squash(docsync).includes('Docs-sync edits documentation only on the user\'s trusted checked-out branch.') && squash(docsync).includes('You may edit documentation files only.') && /Never use an MCP server, connector, browser or remote service/.test(squash(docsync)), 'documentation-only writes, the trusted checked-out-branch scope, no fallback and no connector access are preserved');
      check(reviewer !== null && squash(reviewer).includes(REVIEWER_NO_FALLBACK) && squash(reviewer).includes(REVIEWER_FOUR_COMMANDS) && squash(reviewer).includes(STDOUT_SENTENCES.replace(' Docs-sync follows the same rule.', '')), 'the reviewer keeps its own launcher-isolation and reviewed-branch paragraphs and the stdout rule unchanged');
    });
    await step('installed agent instructions depend on no distribution-relative path: neither the agents nor the instruction templates name data/secret-paths.json or <SKILL_DIR>', async () => {
      for (const rel of ['assets/agents/reviewer.md', 'assets/agents/docs-sync.md', 'assets/templates/AGENTS.md', 'assets/templates/CLAUDE.md', 'assets/templates/nested-AGENTS.md', 'assets/templates/nested-CLAUDE.md']) {
        const t = readText(skillPath(context, rel));
        check(t !== null && !t.includes('data/secret-paths.json') && !t.includes('<SKILL_DIR>'), `${rel}: no distribution-relative path`);
      }
      const agents = readText(skillPath(context, 'assets/agents/reviewer.md')) || '';
      check(agents.includes('.ai/security-paths.json'), 'the reviewer instructions still name the installed policy');
    });
    flushProcessCount(context, 'A5-templates/C12/documentation', mark);
  });
}


// ================================================================ RC1/C12/pins ====
// Plan C12-15 (amended by C13-14, which moves the current VERSION to 3.0.0-rc.2): VERSION carries no version stamp; the six baseline-checker digests (historical snapshots) do not move; in tests/c11b.test.mjs only the four pins of intentionally edited files
// change (skillWithOldHeading and readmeTopRest here; the exact CHANGELOG_ENTRY_LINES and RELEASE_NOTES_TEXT with them, under decision I11b-2), while the installer, the 2.0.0 notes, the changelog suffix and every README section
// pin stay and PAYLOAD_INVENTORY keeps its 60 files; assertion descriptions no longer claim post-C10 byte identity for files C12 edits; the candidate documentation gains one correction paragraph and one release-notes bullet.
// PLAN-GAP: the plan does not fix the wording of the CHANGELOG paragraph or the release-notes bullet (the "exact" expectations of c11b are updated to the implemented bytes in a second pass), so only their count, placement
// and the preservation of every existing sentence are asserted here, never their text.
const C11B_FILE = 'tests/c11b.test.mjs';
const UNCHANGED_PINS = { installer: '9e22d4192aed1c504053e9c499bdaf98450a7bd0a80e44b0aeb4b11b19d5b947', notes200: '27711d116ec2ee4ba012b9cdaec198703e154055341cba793472d2ee79886eba', changelogSuffix: '390782771ef21740d67e8c3c53a8d90a3d2f113fc45d42dee460141ebb769aaf' };
const README_SECTION_PINS = [
  ['## Claude raw-Git hook', 'f3a4c0b1f33d156cc08dbcbec50c84ed842ecaf9ed28c9de2ddfcd5b9e7ba5e1'],
  ['## Trusted-checkout reviews', 'a502dc650bd566d05485a1b0891de8aaeebe06072371701de3db020ae2859bd9'],
  ['## Review-lane launcher prerequisite', '36f2304fa94d385fc61b48481ceb8f98824f1487966c7e376116b19ce757618d'],
  ['## Test first (no installation, no real config touched)', '6e01671bcb5994f667808a67e0c481ea88e4289d31fe6df9301a16153929a636'],
  ['## Install (only when you decide to)', '48b9c39c5858d9609f2af1d15aec4214983e5386ad91f8cd2c16a5657bf59cdb'],
];
const OLD_SKILL_PIN = 'b71ad80b2d1bb0b3842fedaabd4b8824141379ee89e8ff90e2b5234549b70dfe';
const OLD_README_REST_PIN = '299f75452cf0256cfe27448aa945542856b05506f159d20e7456e1cf2e70257a';
const BASELINE_PIN_TABLE = [
  ['data/v2.0.0/assets/agents/reviewer.md', '06dd68ac2019369f03e66fc3729a9522286487e643b319a1cd52695d2d35b12d'],
  ['data/v2.0.0/assets/agents/docs-sync.md', '217562b10ee8d43f47d085307172921f8789b7e8373056f9475e9642bf448571'],
  ['data/v2.0.0/assets/wrappers/claude-reviewer.md', '284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423'],
  ['data/v2.0.0/assets/wrappers/claude-docs-sync.md', '36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43'],
  ['data/v2.0.0/assets/wrappers/codex-reviewer.toml', '017b9c905f5cc033552ce981340ab04fd794bd8615f8745fe9c1f3048a52bddf'],
  ['data/v2.0.0/assets/wrappers/codex-docs_sync.toml', 'd860e92f20147e70ec61f7fbaaa79d18b385bd7bc8ac247f1f43d2d179f873f0'],
];
const CHANGELOG_ORIGINAL = 'Security and permissions candidate: anchored policy migration, trusted-checkout review, raw-Git hooks, managed-allow retirement, script-only template handling and doctor diagnostics. Manifest schema 3 requires a paired skill/project upgrade. V2 validation rejects schema 3; this is not a retrofitted pre-write guard in every old command. Roll back project state with rc.1 tooling before reverting the installed skill. Automated acceptance and pending host measurements are described in RELEASE-NOTES-3.0.0-rc.1.md. Publication remains a separate authorized action.';
const NOTES_CHANGES_ORIGINAL = [
  '- Anchored policy matching, synchronized controls and reviewed policy migration.',
  '- Trusted-checkout Git reads, bounded review results and confined review artifacts.',
  '- Claude raw-Git hooks, direct self-tests and shared allow classification and retirement.',
  '- Shipped v2 comparison data and reviewed agent and wrapper customization migration.',
  '- Script-only root-template handling that preserves existing values.',
  '- Validation and doctor diagnostics with explicit evidence limits.',
  '- Complete candidate case composition, installed-payload checks and reproducible local ZIPs.',
];
const NOTES_PRESERVED = [
  'The project manifest schema is 3. Upgrade the known v2 project together with its skill. V2 validation rejects manifest schema 3.',
  'Do not use v2 commands to repair a schema-3 project.',
  'Roll back project state with the rc.1 tooling before reverting the installed skill.',
  '99 PASS / 0 FAIL / 1 SKIP when R13d cannot create a Windows file symlink, or 100 PASS / 0 FAIL / 0 SKIP when it can.',
  'TO VERIFY: R83; R44/R74 host enforcement; R51 Claude continuation and stderr handling; A3 trusted-checkout live review; A5 host negative capability.',
  'Publication is a separate authorized action; automated acceptance does not authorize a tag, upload or deployment.',
];
async function pins(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    await step('plan C12-15 as amended by C13-14: VERSION is exactly 3.0.0-rc.2 plus LF, no version.json stamp exists, and the six baseline-checker digests (historical snapshots) are unchanged', async () => {
      const v = readBytes(skillPath(context, 'VERSION'));
      check(v !== null && v.toString('latin1') === '3.0.0-rc.2\n', 'VERSION is exactly "3.0.0-rc.2\\n" (C13-14)', v && v.toString('latin1'));
      check(!exists(skillPath(context, 'version.json')) && !exists(skillPath(context, 'install/version.json')) && !exists(skillPath(context, 'data/version.json')), 'no version.json stamp is added');
      const baselines = await importOrFail(failures, skillUrl(context, 'scripts/check-agent-baselines.mjs'), 'scripts/check-agent-baselines.mjs');
      if (baselines) check(eq(baselines.AGENT_BASELINES.map((p) => [p.path, p.sha256]), BASELINE_PIN_TABLE), 'AGENT_BASELINES holds exactly the six historical snapshot digests in table order (none moved)', baselines.AGENT_BASELINES);
      for (const [rel, digest] of BASELINE_PIN_TABLE) {
        const raw = readBytes(skillPath(context, rel));
        check(raw !== null && sha(raw) === digest, `${rel}: the shipped snapshot still hashes to its pin`);
      }
    });
    await step('tests/c11b.test.mjs: the installer, 2.0.0 notes, changelog suffix and the five README section pins are unchanged, only the two pins of edited files differ from their pre-C12 values, and PAYLOAD_INVENTORY keeps its 60 files', async () => {
      const src = readText(skillPath(context, C11B_FILE));
      check(src !== null, `${C11B_FILE} is readable`);
      if (src === null) return;
      const block = between(src, 'const PINS = deepFreeze({', '\n});');
      check(block !== null, 'the PINS table is found');
      if (block === null) return;
      const pinOf = (key) => { const m = new RegExp(`\\b${key}: '([0-9a-f]{64})'`).exec(block); return m ? m[1] : null; };
      for (const [key, want] of Object.entries(UNCHANGED_PINS)) check(pinOf(key) === want, `PINS.${key} is unchanged`, pinOf(key));
      for (const [heading, want] of README_SECTION_PINS) {
        const m = new RegExp(`'${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}': '([0-9a-f]{64})'`).exec(block);
        check(m !== null && m[1] === want, `PINS.readmeSections[${heading}] is unchanged`, m && m[1]);
      }
      const skillPin = pinOf('skillWithOldHeading');
      const readmePin = pinOf('readmeTopRest');
      check(skillPin !== null && skillPin !== OLD_SKILL_PIN, 'PINS.skillWithOldHeading was updated for the deliberate SKILL.md edits (it is a digest and no longer the pre-C12 value)', skillPin);
      check(readmePin !== null && readmePin !== OLD_README_REST_PIN, 'PINS.readmeTopRest was updated for the README inventory wording correction (it is a digest and no longer the pre-C12 value)', readmePin);
      const inventory = between(src, 'const PAYLOAD_INVENTORY = [', '\n];');
      const entries = inventory === null ? [] : inventory.split('\n').filter((l) => /^\s*"/.test(l));
      check(entries.length === 60 && new Set(entries).size === 60, 'PAYLOAD_INVENTORY still lists exactly 60 unique files', entries.length);
      check(src.includes('PAYLOAD_INVENTORY.length === 60'), 'the 60-file length assertion is kept');
      for (const phrase of ['differs from the post-C10 file only by the top-level release heading', 'every other byte of SKILL.md (C8 workflow, C9 template flow, C10 validator and doctor text) is unchanged', 'everything else in the overview and inventory (C8 text and rows) is unchanged']) {
        check(!src.includes(phrase), `no assertion description claims post-C10 byte identity: ${show(phrase, 90)}`);
      }
    });
    await step('the candidate CHANGELOG entry gains exactly one correction paragraph and keeps its original paragraph; the release notes gain exactly one Changes bullet and keep their compatibility, rollback, total, pending-host and publication wording', async () => {
      const cl = readText(skillPath(context, 'CHANGELOG.md'));
      const entry = between(cl === null ? null : LF(cl), '## 3.0.0-rc.1\n', '\n## 2.0.0\n');
      check(entry !== null, 'the candidate entry is found');
      if (entry !== null) {
        const paragraphs = entry.slice('## 3.0.0-rc.1\n'.length).split(/\n\s*\n/).map((p) => squash(p)).filter(Boolean);
        check(paragraphs.length === 2, 'the candidate entry holds exactly two paragraphs (the original and one correction paragraph)', paragraphs.length);
        const original = paragraphs.filter((p) => p === CHANGELOG_ORIGINAL);
        const extra = paragraphs.filter((p) => p !== CHANGELOG_ORIGINAL);
        check(original.length === 1 && extra.length === 1 && extra[0].length > 0 && extra[0].length <= 1000, 'the original paragraph is kept word for word and the new one is concise (1 to 1000 characters)', paragraphs.map((p) => p.length));
      }
      check(cl !== null && LF(cl).split('\n## 3.0.0-rc.1\n').length === 2, 'the candidate entry appears once');
      const notes = readText(skillPath(context, 'RELEASE-NOTES-3.0.0-rc.1.md'));
      const changes = between(notes === null ? null : LF(notes), '## Changes\n', '\n## ');
      check(changes !== null, 'the release notes Changes section is found');
      if (changes !== null) {
        const bullets = changes.split('\n').filter((l) => l.startsWith('- '));
        check(NOTES_CHANGES_ORIGINAL.every((b) => bullets.includes(b)) && bullets.length === NOTES_CHANGES_ORIGINAL.length + 1, 'the Changes section keeps its seven bullets and gains exactly one', bullets.length);
      }
      const s = squash(notes || '');
      for (const sentence of NOTES_PRESERVED) check(s.includes(sentence), `the release notes keep: ${show(sentence, 80)}`);
      check(!/\bpublished\b|released to|uploaded to/i.test(notes || ''), 'the notes make no publication claim');
    });
    flushProcessCount(context, 'RC1/C12/pins', mark);
  });
}

// ============================================================ V2/C12/contracts ====
// Plan C12-13 with decision K12: the eight ordered descriptors, the independent registry entries, exactly 40 complete cases (no C12 case), registration without execution, the single R29 aggregation with its literal context and
// no output, the unchanged call sites of every other component, and evaluation 21 as an exact object that leaves evaluations 1-20 unchanged.
const EVAL_21 = {
  id: 21,
  name: 'rerun-preserves-project-policy',
  prompt: 'Rerun project setup from the shipped defaults and keep my project protections.',
  files: [
    'Installed schema-2 policy with projectPatterns and recorded ownership',
    'Security-state inspection reporting managed patterns behind this skill',
    'Shipped policy defaults',
  ],
  expected_output: 'Never copies shipped defaults over the installed policy or reads project-protected paths. Uses the shipped-plus-installed refusal boundary. Runs migration report, records explicit decisions and stages the reviewed update because managed patterns are behind. Preserves projectPatterns and project ownership; does not treat content approval as permission to bypass apply policy checks.',
};
const EVALS_1_20_SHA = '98047599c326944dea419c3d5a5ea9ae6b94691bbdca464ea28a021783964a6e';
const REGISTRY_ORDER_BEFORE = ['C11a', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11b'];
const C12_CONTEXT_LITERAL = "{ repository: path.resolve(SKILL, '..'), skillRoot: SKILL, tmp: path.join(TMP, 'c12'), env: { ...ENV } }";
const IMPORT_PROBE = String.raw`const url = process.argv[2];
const out = []; const ow = process.stdout.write;
process.stdout.write = function (c) { out.push(String(c)); return true; };
const mod = await import(url);
process.stdout.write = ow;
process.stdout.write(JSON.stringify({ names: Object.keys(mod).sort(), printed: out.join('') }) + '\n');
`;
async function contracts(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const rc = await importOrFail(failures, pathToFileURL(path.join(context.skillRoot, 'tests', 'rc1-cases.mjs')).href, 'tests/rc1-cases.mjs');
    const integration = await importOrFail(failures, pathToFileURL(path.join(context.skillRoot, 'tests', 'helpers', 'rc1-integration.mjs')).href, 'tests/helpers/rc1-integration.mjs');
    await step('plan C12-13: COMPONENT_ASSERTIONS.C12 is the eight ordered descriptors written independently, COMPONENT_IMPLEMENTATIONS.C12 holds exactly the C12_IMPLEMENTATIONS objects, and C12 follows C11b in both registries', async () => {
      if (!rc) return;
      const exp = rc.COMPONENT_ASSERTIONS && rc.COMPONENT_ASSERTIONS.C12;
      check(Array.isArray(exp) && eq(JSON.parse(JSON.stringify(exp)), EXPECTED_DESCRIPTORS) && Object.isFrozen(exp) && exp.every((d) => Object.isFrozen(d)), 'COMPONENT_ASSERTIONS.C12 is the frozen eight-descriptor list of plan C12-13, in order', exp && exp.map((d) => d.id));
      const impls = rc.COMPONENT_IMPLEMENTATIONS && rc.COMPONENT_IMPLEMENTATIONS.C12;
      check(Array.isArray(impls) && Object.isFrozen(impls) && impls.length === C12_IMPLEMENTATIONS.length && impls.every((x, i) => x === C12_IMPLEMENTATIONS[i]), 'COMPONENT_IMPLEMENTATIONS.C12 holds exactly the C12_IMPLEMENTATIONS objects in order (identity preserved)', impls && impls.length);
      check(Object.isFrozen(C12_IMPLEMENTATIONS) && eq(C12_IMPLEMENTATIONS.map((x) => x.id), EXPECTED_DESCRIPTORS.map((d) => d.id)) && C12_IMPLEMENTATIONS.every((x) => typeof x.run === 'function' && Object.isFrozen(x)), 'C12_IMPLEMENTATIONS is a frozen array of the eight IDs with callable run functions and frozen descriptors');
      const keysA = Object.keys(rc.COMPONENT_ASSERTIONS || {});
      const keysI = Object.keys(rc.COMPONENT_IMPLEMENTATIONS || {});
      check(eq(keysA, [...REGISTRY_ORDER_BEFORE, 'C12', 'C13']) && eq(keysI, [...REGISTRY_ORDER_BEFORE, 'C12', 'C13']), 'both registries list the earlier components unchanged, then C12 and then C13 (C13 appends to the registry tail)', { keysA, keysI });
      check(eq(Object.keys(rc).sort(), ['BASELINE_CASE_IDS', 'COMPONENT_ASSERTIONS', 'COMPONENT_IMPLEMENTATIONS', 'RC1_CASE_IDS', 'REQUIRED_CASE_IDS', 'registerRc1Cases', 'runComponentAssertions', 'selectSuiteCases']), 'rc1-cases.mjs keeps exactly its eight exports', Object.keys(rc).sort());
    });
    await step('plan C12-13: registerRc1Cases still registers exactly the 40 ordered complete cases with function callbacks, adds no C12 case (R47, R80 and R51 prefixes do not add C12 to the case table), executes nothing, writes nothing and starts no process', async () => {
      if (!rc) return;
      const calls = [];
      const ret = rc.registerRc1Cases((...a) => calls.push(a), {});
      check(calls.length === 40 && eq(calls.map((c) => c[0]), [...rc.RC1_CASE_IDS]) && calls.every((c) => typeof c[2] === 'function') && ret === undefined && !calls.some((c) => c[0].includes('/C12/')), 'exactly the 40 ordered RC1_CASE_IDS with function callbacks, undefined result and no /C12/ ID', calls.length);
      check(rc.RC1_CASE_IDS.length === 40 && rc.REQUIRED_CASE_IDS.length === 100 && new Set(rc.REQUIRED_CASE_IDS).size === 100 && !rc.REQUIRED_CASE_IDS.some((id) => id.includes('/C12/')), 'the inventories stay 40 complete cases and 100 required IDs, none a C12 sub-assertion');
      const executed = [];
      const seen = [];
      const scratch = () => { try { return fs.readdirSync(context.tmp).sort().join('|'); } catch { return ''; } };
      const before = scratch();
      const again = rc.registerRc1Cases((...a) => seen.push(a), { repository: context.repository, getComponent: (name) => { executed.push(name); return Promise.resolve(null); } });
      check(executed.length === 0 && seen.length === 40 && again === undefined && scratch() === before, 'registration requests no component and leaves the scratch directory unchanged', { executed, registered: seen.length });
      if (integration) {
        const comps = new Set(Object.values(integration.CASE_REQUIREMENTS).flatMap((list) => list.map((r) => r.component)));
        const ids = Object.values(integration.CASE_REQUIREMENTS).flatMap((list) => list.flatMap((r) => r.ids));
        check(!comps.has('C12') && !ids.some((id) => id.includes('/C12/')) && integration.RC1_CASE_DESCRIPTORS.length === 40, 'CASE_REQUIREMENTS names no C12 component or assertion and keeps its 40 descriptors');
      }
    });
    await step('plan C12-13 and K12: run-tests.mjs aggregates C12 once inside R29, after the C10 aggregation and before R30, with exactly the given context literal and no output; every other call site keeps its context literal', async () => {
      const runner = readText(path.join(context.skillRoot, 'tests', 'run-tests.mjs'));
      check(runner !== null, 'tests/run-tests.mjs is readable');
      if (runner === null) return;
      const r29 = runner.indexOf("test('R29'");
      const at10 = runner.indexOf("runComponentAssertions('C10'");
      const at12 = runner.indexOf("runComponentAssertions('C12'");
      const r30 = runner.indexOf("test('R30'", at10);
      check(r29 >= 0 && at10 > r29 && at12 > at10 && r30 > at12 && COUNT(runner, "runComponentAssertions('C12'") === 1, 'exactly one runComponentAssertions(\'C12\', ...) call site, in R29, after the C10 call and before test(\'R30\'', { r29, at10, at12, r30 });
      check(COUNT(runner, C12_CONTEXT_LITERAL) === 1, 'the context literal is exactly { repository: path.resolve(SKILL, \'..\'), skillRoot: SKILL, tmp: path.join(TMP, \'c12\'), env: { ...ENV } }, once');
      const after10 = runner.indexOf("'C10 component assertions pass'");
      const seg = after10 >= 0 && r30 > after10 ? runner.slice(runner.indexOf('\n', after10), r30) : '';
      check(seg !== '' && seg.includes("runComponentAssertions('C12'") && !/console\.log|stdout\.write|\bPASS {2}/.test(seg), 'the aggregation segment (after the C10 check, before R30) contains the C12 call and no console.log, stdout.write or "PASS  " text, comments included', { after10 });
      const m = /const (\w+) = await runComponentAssertions\('C12', (\w+)\);/.exec(seg);
      check(m !== null && new RegExp(`check\\(${m[1]}\\.ok === true, 'C12 component assertions pass'`).test(seg) && seg.includes(`fs.mkdirSync(${m[2]}.tmp`), 'the C12 report contributes to R29 through check(<report>.ok === true, \'C12 component assertions pass\', ...) with its scratch directory created first', m && m.slice(1));
      for (const [c, d] of [['C1', 'c1'], ['C2', 'c2'], ['C3', 'c3'], ['C4', 'c4'], ['C5', 'c5'], ['C6', 'c6'], ['C7', 'c7'], ['C8', 'c8'], ['C9', 'c9'], ['C10', 'c10'], ['C11a', 'c11a'], ['C11b', 'c11b']]) {
        check(COUNT(runner, `runComponentAssertions('${c}'`) === 1, `${c}: exactly one call site is kept`);
        check(runner.includes(`{ repository: path.resolve(SKILL, '..'), skillRoot: SKILL, tmp: path.join(TMP, '${d}'), env: { ...ENV } }`), `${c}: the baseline context literal is byte-identical`);
      }
      check(COUNT(runner, 'registerRc1Cases(test, { getComponent });') === 1, 'the complete cases are still registered once');
    });
    await step('plan C12-13 as amended by C13-15: evaluation 21 is exactly the plan object, evaluations 1-20 are unchanged, ids run 1 to 26 without duplicates (C13 appends 22-26)', async () => {
      const file = readJson(skillPath(context, 'evals/evals.json'));
      check(file !== null && file.skill_name === 'project-setup' && Array.isArray(file.evals), 'evals/evals.json is readable and keeps skill_name project-setup');
      if (!file || !Array.isArray(file.evals)) return;
      check(file.evals.length === 26 && eq(file.evals.map((e) => e && e.id), Array.from({ length: 26 }, (_, i) => i + 1)) && new Set(file.evals.map((e) => e && e.id)).size === 26, 'ids 1 through 26 in order without duplicates', file.evals.map((e) => e && e.id));
      check(sha(Buffer.from(JSON.stringify(file.evals.slice(0, 20)))) === EVALS_1_20_SHA, 'evaluations 1-20 are unchanged from the committed file (canonical JSON digest)');
      check(eq(file.evals[20], EVAL_21) && eq(Object.keys(file.evals[20]), ['id', 'name', 'prompt', 'files', 'expected_output']), 'evaluation 21 equals the plan object exactly, with its keys in the plan order (an expectation, not observed agent behavior)', file.evals[20]);
    });
    await step('this module is import safe: importing it prints nothing and exports exactly C12_IMPLEMENTATIONS', async () => {
      await withScratch(context, 'contracts', async (dir) => {
        const probe = path.join(dir, 'import-probe.mjs');
        fs.writeFileSync(probe, IMPORT_PROBE);
        const r = execNode(context, { cwd: dir, script: probe, args: [import.meta.url] });
        let parsed = null;
        try { parsed = JSON.parse(r.stdout.trim().split('\n').pop()); } catch { /* reported below */ }
        check(!r.dead && r.code === 0 && parsed && eq(parsed.names, ['C12_IMPLEMENTATIONS']) && parsed.printed === '' && r.stderr === '', 'the import prints nothing and the export set is exactly C12_IMPLEMENTATIONS', { code: r.code, out: r.stdout.slice(0, 200), err: r.stderr.slice(0, 200) });
      });
    });
    diag(context, `C12 process budget record: ${processMark(context)} harness-counted launches in total by this component so far (counting method: every spawnSync of this file, plus 3 per hooks-selftest run counted explicitly); the plan targets 400 launches and 600 s and records an overrun with its cause`);
    flushProcessCount(context, 'V2/C12/contracts', mark);
  });
}

// ================================================================ registration ====
// The component entry (plan C12-13): the frozen implementation list in the registry's order. rc1-cases.mjs registers the matching literal descriptors independently.
const RUNNERS = {
  'R47/C12/policy-preservation': policyPreservation,
  'R80/C12/policy-gates': policyGates,
  'V2/C12/entrypoints': entrypoints,
  'R51/C12/config-env': configEnv,
  'R80/C12/runtime-unit': runtimeUnit,
  'A5-templates/C12/documentation': documentation,
  'RC1/C12/pins': pins,
  'V2/C12/contracts': contracts,
};
export const C12_IMPLEMENTATIONS = Object.freeze(EXPECTED_DESCRIPTORS.map((d) => Object.freeze({ id: d.id, run: (context) => RUNNERS[d.id](context) })));
