// C3 tests lane: the eighteen component assertions of "C3. Policy migration and synchronized controls".
//
// Written from the frozen plan only, before any implementation exists:
//   docs/plans/2026-10-18-project-setup-v3-rc1-c3.md   (sections 1-8 and the C3-P3-1 to C3-P3-5 addendum, which wins over earlier sections)
// Under the frozen architecture plan docs/plans/2026-10-15-project-setup-v3-rc1.md and the landed contracts it builds on: C11a (tests/rc1-cases.mjs,
// tests/run-component-tests.mjs, tests/helpers/v2-baseline.mjs), C1 (assets/tools/security-policy.mjs), C2 (scripts/ownership.mjs, apply.mjs, the
// five request files, the journal) and docs/plans/2026-10-18-project-setup-v3-rc1-c2-followup-decisions.md (I2-10, the manifest derivation check).
// Plan 2.2 gives the tests lane the tests/rc1-cases.mjs registration, the R09/R15/R17 edits in tests/run-tests.mjs and the I2-10 control in
// tests/c2.test.mjs; those edits live in those files. The implementer must not edit this file, tests/fixtures/rc1-migrations.json, or any of them.
//
// Importing this module runs nothing. Every production module and every registry module (rc1-cases.mjs and run-component-tests.mjs; rc1-cases.mjs
// imports this file, so a static import back would be circular) is imported lazily inside run(context). A missing module or export fails one
// assertion with a diagnostic; it never breaks the import.
//
// Every run(context) returns { failures, skipped: null }. There is no skip path: an unavailable optional subcase (a Windows file symlink without
// privilege) is simply not exercised. Scratch data lives under context.tmp only; nothing is ever written or deleted anywhere else. The only fixture
// checked in is tests/fixtures/rc1-migrations.json (plan 4.2); expected values in it are literal and independent of the implementation.
//
// Installed fixtures start from a genuine v2 installation built by the tagged scripts (tests/helpers/v2-baseline.mjs createV2InstalledFixture) and are
// edited only afterwards (plan 4.2). Successful coupled migrations before C4 run against a scratch COPY of the skill whose data/runtime-units.json is
// replaced and whose Git-reader asset is a synthetic reader that declares policy schemas [1, 2] and really imports the shared helper (plan 4.2). No
// production override exists or is used.
//
// Where the plan does not pin a value a test would need, the test asserts only what is pinned. The gaps are listed in the delegation report as
// PLAN-GAP lines; the places they touch carry a comment starting with "PLAN-GAP". Readings the plan implies but does not spell out:
//   - a prepare rejection entry for a C3 refusal names the target the plan lists in 3.12 ("Prepare targets are pinned"), one entry per refusal;
//   - the staged request files other than manifest-metadata.json are asserted only through what prepare and the plan show about them;
//   - recorded omissions are compared by identity (anchor and lowercase glob), because the plan says "record its exact identity" without fixing
//     the other fields of the stored entry.
import fs, { readFileSync as boundReadFileSync, statSync as boundStatSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import crypto from 'node:crypto';
import childProcessModule, { spawnSync } from 'node:child_process';
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
const toPosix = (p) => String(p).replace(/\\/g, '/');
const HEX64 = /^[0-9a-f]{64}$/;
const H64 = (c) => c.repeat(64);
const normText = (s) => { let t = Buffer.isBuffer(s) ? s.toString('utf8') : String(s); if (t.charCodeAt(0) === 0xfeff) t = t.slice(1); t = t.replace(/\r\n?/g, '\n'); if (!t.endsWith('\n')) t += '\n'; return t; };
const NH = (s) => sha(Buffer.from(normText(s), 'utf8'));
const lineCount = (s) => normText(s).split('\n').length - 1;

// A group that fails 400 assertions would bury its own report; the cap keeps the first failures and counts the rest.
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
const needScript = (failures, context, name) => importOrFail(failures, scriptUrl(context, name), `scripts/${name}`);
// A script that is (or may still be) a CLI at import time must not be imported into this process: a top-level process.exit would end the whole
// component run, and R15 embeds it. It is first imported in a child process under the import probe; only a clean probe allows the real import.
const probeCache = new Map();
function probeImport(context, url) {
  if (probeCache.has(url)) return probeCache.get(url);
  const dir = scratchDir(context, 'probe');
  const file = path.join(dir, 'probe.mjs');
  fs.writeFileSync(file, PROBE_SOURCE);
  const r = spawnSync(process.execPath, [file, url], { cwd: dir, env: { ...context.env }, encoding: 'utf8', windowsHide: true, shell: false, timeout: 60000 });
  let log = null; try { log = JSON.parse(String(r.stdout).trim().split('\n').pop()); } catch { /* unreadable */ }
  let result;
  if (!log) result = { safe: false, why: `the probe produced no result (status ${r.status})`, err: null };
  else if (log.err !== null) result = { safe: false, why: log.err, err: log.err };
  else if (log.spawns.length || log.writes.length || log.stdout.length || log.stderr.length || log.exits.length || log.exitCode !== null) result = { safe: false, why: `import ran code: spawns ${log.spawns.length}, writes ${log.writes.length}, stdout ${log.stdout.length}, exits ${log.exits.length}`, err: null };
  else result = { safe: true, why: null, err: null };
  probeCache.set(url, result);
  rmrf(dir);
  return result;
}
async function needSafeScript(failures, context, name) {
  const url = scriptUrl(context, name);
  const p = probeImport(context, url);
  if (!p.safe) {
    failures.push(p.err !== null ? `cannot import scripts/${name}: ${String(p.err).slice(0, 200)}` : `scripts/${name} is not import-safe, so it is not imported into the test process: ${p.why}`);
    return null;
  }
  return importOrFail(failures, url, `scripts/${name}`);
}
const needPolicyModule = (failures, context) => importOrFail(failures, assetUrl(context, 'assets/tools/security-policy.mjs'), 'assets/tools/security-policy.mjs');
const needSibling = (failures, rel) => importOrFail(failures, new URL(rel, import.meta.url).href, `tests/${rel}`);
function needFns(failures, mod, names) {
  const missing = names.filter((n) => typeof (mod && mod[n]) !== 'function');
  if (missing.length) failures.push(`missing exports: ${missing.join(', ')}`);
  return missing.length === 0;
}

// ------------------------------------------------------------- scratch ----
function scratchDir(context, label) {
  fs.mkdirSync(context.tmp, { recursive: true });
  return fs.mkdtempSync(path.join(context.tmp, `c3-${label}-`));
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

// Structural helpers for returned JSON data: plain prototypes, and no object shared with the input (returned data is detached).
function protoIssues(v, where = '$', seen = new Set()) {
  const out = [];
  if (v === null || typeof v !== 'object' || seen.has(v)) return out;
  seen.add(v);
  if (Array.isArray(v)) {
    if (Object.getPrototypeOf(v) !== Array.prototype) out.push(`${where}: array prototype`);
    v.forEach((x, i) => out.push(...protoIssues(x, `${where}[${i}]`, seen)));
  } else {
    if (Object.getPrototypeOf(v) !== Object.prototype) out.push(`${where}: object prototype`);
    for (const k of Object.keys(v)) out.push(...protoIssues(v[k], `${where}.${k}`, seen));
  }
  return out;
}
function objectsOf(v, into = new Set()) {
  if (v === null || typeof v !== 'object' || into.has(v)) return into;
  into.add(v);
  for (const k of Object.keys(v)) objectsOf(v[k], into);
  return into;
}
function sharedObjects(input, output) {
  const inSet = objectsOf(input);
  return [...objectsOf(output)].filter((o) => inSet.has(o)).length;
}

// ------------------------------------------------------- import safety ----
// Same criteria as C1/C2/C11a: no spawn, no filesystem write, no output, no process.exit, no exit code.
const PROBE_SOURCE = [
  "import cp from 'node:child_process';",
  "import fs from 'node:fs';",
  "import { syncBuiltinESMExports } from 'node:module';",
  "const log = { spawns: [], writes: [], stdout: [], stderr: [], exits: [], err: null, names: [], exitCode: null };",
  "for (const k of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) { const o = cp[k]; cp[k] = function () { log.spawns.push(k); return o.apply(this, arguments); }; }",
  "const W = ['writeFileSync', 'appendFileSync', 'mkdirSync', 'mkdtempSync', 'rmSync', 'rmdirSync', 'unlinkSync', 'renameSync', 'copyFileSync', 'cpSync', 'symlinkSync', 'linkSync', 'truncateSync', 'createWriteStream', 'writeFile', 'appendFile', 'mkdir', 'mkdtemp', 'rm', 'rmdir', 'unlink', 'rename', 'copyFile', 'cp', 'symlink'];",
  "for (const k of W) { if (typeof fs[k] === 'function') { const o = fs[k]; fs[k] = function () { log.writes.push(k); return o.apply(this, arguments); }; } }",
  "for (const k of W) { if (typeof fs.promises[k] === 'function') { const o = fs.promises[k]; fs.promises[k] = function () { log.writes.push('promises.' + k); return o.apply(this, arguments); }; } }",
  "const ow = process.stdout.write, ew = process.stderr.write;",
  "process.stdout.write = function (c) { log.stdout.push(String(c)); return true; };",
  "process.stderr.write = function (c) { log.stderr.push(String(c)); return true; };",
  "process.exit = function (c) { log.exits.push(c === undefined ? null : c); };",
  "syncBuiltinESMExports();",
  "const before = process.exitCode;",
  "try { const m = await import(process.argv[2]); log.names = Object.keys(m).sort(); } catch (e) { log.err = String(e && e.message ? e.message : e); }",
  "log.exitCode = process.exitCode === before || process.exitCode === undefined ? null : process.exitCode;",
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
// Runs fn with filesystem, process-spawning, process-stream and environment access observed (and still allowed), to show a pure function
// touches none of them. The window is one synchronous call, so nothing else interleaves.
const spawnSyncHolder = childProcessModule;
function observeEffects(fn) {
  const fsMethods = ['readFileSync', 'writeFileSync', 'appendFileSync', 'statSync', 'lstatSync', 'readdirSync', 'existsSync', 'openSync', 'mkdirSync', 'rmSync', 'renameSync', 'realpathSync', 'accessSync', 'readSync'];
  const log = [];
  const saved = [];
  for (const k of fsMethods) { if (typeof fs[k] === 'function') { const o = fs[k]; saved.push([fs, k, o]); fs[k] = function (...a) { log.push(`fs.${k}`); return o.apply(this, a); }; } }
  for (const k of ['spawnSync', 'execSync', 'execFileSync', 'spawn', 'exec', 'execFile', 'fork']) { const o = spawnSyncHolder[k]; if (typeof o === 'function') { saved.push([spawnSyncHolder, k, o]); spawnSyncHolder[k] = function (...a) { log.push(`child_process.${k}`); return o.apply(this, a); }; } }
  // C12-12: the named ESM exports of the builtins are snapshots; without this call a module that imported readFileSync or spawnSync by name would never see the wrappers.
  syncBuiltinESMExports();
  const realEnv = process.env;
  process.env = new Proxy(realEnv, { get(t, k, r) { if (typeof k === 'string') log.push(`env.${k}`); return Reflect.get(t, k, r); }, has(t, k) { log.push(`env.has.${String(k)}`); return Reflect.has(t, k); }, ownKeys(t) { log.push('env.keys'); return Reflect.ownKeys(t); } });
  let value; let thrown = null;
  try { value = fn(); } catch (e) { thrown = e; } finally {
    process.env = realEnv;
    for (const [obj, k, o] of saved) obj[k] = o;
    syncBuiltinESMExports();
  }
  return { value, thrown, log };
}
// C12-12: the builtin functions as they are before any observation window, to prove that every window restores them (the default objects and the named ESM bindings alike).
const OBSERVED_ORIGINALS = Object.freeze({ readFileSync: fs.readFileSync, statSync: fs.statSync, spawnSync: childProcessModule.spawnSync, execFileSync: childProcessModule.execFileSync, env: process.env });
function observerRestored() {
  return fs.readFileSync === OBSERVED_ORIGINALS.readFileSync && boundReadFileSync === OBSERVED_ORIGINALS.readFileSync
    && fs.statSync === OBSERVED_ORIGINALS.statSync && boundStatSync === OBSERVED_ORIGINALS.statSync
    && childProcessModule.spawnSync === OBSERVED_ORIGINALS.spawnSync && spawnSync === OBSERVED_ORIGINALS.spawnSync
    && childProcessModule.execFileSync === OBSERVED_ORIGINALS.execFileSync && process.env === OBSERVED_ORIGINALS.env;
}

// ============================================================ literals ====
// Written out independently of the implementation (plan 4.1: "Register these exact descriptors").
const COMPONENT_INVENTORY = [
  ['R44/C3/anchors', 'anchored control rendering'],
  ['R47/C3/project-controls', 'project patterns reach every rendered control'],
  ['R74/C3/rendering', 'shared corpus and stored rendering spelling'],
  ['R48/C3/project-moves', 'approved project pattern moves'],
  ['R78/C3/baseline', 'installed records establish baseline identity'],
  ['R78/C3/migration', 'versioned migration preserves project fields'],
  ['R78/C3/replacement-coverage', 'replacement coverage needs its own decision'],
  ['R52/C3/user-denies', 'identical user denies stay user owned'],
  ['R85/C3/retained-denies', 'retired deny bytes and ownership survive'],
  ['R80/C3/snapshot', 'one approved snapshot binds migration outputs'],
  ['R80/C3/tool-unit', 'policy migration requires compatible reviewed tools'],
  ['R80/C3/manifest-after', 'commit verifies the derived manifest'],
  ['R81/C3/recorded-patterns', 'recorded patterns distinguish drift and behind'],
  ['R82/C3/snippet', 'recorded snippet hash detects stale rendering'],
  ['R97/C3/environment-controls', 'environment variants receive rendered coverage'],
  ['Q4/C3/scan-labels', 'protected findings remain scanned and redacted'],
  ['V2/C3/recovery', 'coupled migration rolls back through one journal'],
  ['V2/C3/module-contract', 'C3 exports errors and component contracts'],
];
const EXPECTED_DESCRIPTORS = COMPONENT_INVENTORY.map(([id, name]) => ({ id, name }));
const C11A_DESCRIPTORS = [
  { id: 'V2/C11a/tag-identity', name: 'trusted v2 tag identity' },
  { id: 'V2/C11a/snapshot-inventory', name: 'exhaustive v2 snapshot mapping' },
  { id: 'V2/C11a/snapshot-bytes', name: 'raw tagged snapshot byte parity' },
  { id: 'V2/C11a/installed-fixture', name: 'tagged v2 installation and provenance' },
  { id: 'V2/C11a/fixture-failures', name: 'v2 fixture failures are fatal' },
  { id: 'V2/C11a/live-v2', name: 'live v2 fixture and existing kinds' },
  { id: 'V2/C11a/component-records', name: 'strict component result contract' },
  { id: 'V2/C11a/strict-gate', name: 'strict rc1 acceptance contract' },
];
const C1_DESCRIPTORS = [
  { id: 'R45/C1/grammar', name: 'policy grammar and PQ1 rejection' },
  { id: 'R45/C1/schema', name: 'strict policy schemas and errors' },
  { id: 'R44/C1/anchors', name: 'root and any-depth matching' },
  { id: 'R74/C1/case', name: 'platform-independent case matching' },
  { id: 'R74/C1/corpus', name: 'shared policy matching corpus' },
  { id: 'R74/C1/deduplication', name: 'effective entries preserve source metadata' },
  { id: 'R75/C1/path-validation', name: 'structural checks preserve exact path names' },
  { id: 'R78/C1/legacy-adapter', name: 'validated non-writing schema-1 adapter' },
  { id: 'R97/C1/environment-names', name: 'environment-name variant matching' },
  { id: 'V2/C1/source-helpers', name: 'source helpers use shared policy semantics' },
  { id: 'V2/C1/exception-overlap', name: 'user exception overlap stays conservative' },
  { id: 'V2/C1/module-contract', name: 'standalone module and component contracts' },
];
const C2_DESCRIPTORS = [
  { id: 'R79/C2/policy-schema', name: 'complete policy ownership metadata' },
  { id: 'R79/C2/settings-schema', name: 'permission and hook ownership schemas' },
  { id: 'R79/C2/manifest-schema', name: 'manifest schema 3 and legacy input' },
  { id: 'R86/C2/omissions', name: 'exact persistent omission identities' },
  { id: 'R86/C2/metadata-only', name: 'approved metadata without content writes' },
  { id: 'R86/C2/mixed-transaction', name: 'one content and metadata transaction' },
  { id: 'R80/C2/input-binding', name: 'all approved inputs remain bound' },
  { id: 'R02/C2/diff-output', name: 'deterministic read-only draft review' },
  { id: 'R02/C2/no-git', name: 'draft review invokes no Git' },
  { id: 'R02/C2/diff-safety', name: 'secret and unsafe targets are refused' },
  { id: 'R15/C2/metadata-binding', name: 'metadata presence and bytes are approved' },
  { id: 'R29/C2/approval-noop', name: 'unchanged-file approvals and genuine no-op' },
  { id: 'V2/C2/recovery', name: 'metadata transaction recovery preserves later edits' },
  { id: 'V2/C2/module-contract', name: 'shared exports and component registration' },
];
// Plan 6: the exact assertion lines of the C3 component command.
const PLAN6_RECORDS = [
  'PASS  R44/C3/anchors  anchored control rendering',
  'PASS  R47/C3/project-controls  project patterns reach every rendered control',
  'PASS  R74/C3/rendering  shared corpus and stored rendering spelling',
  'PASS  R48/C3/project-moves  approved project pattern moves',
  'PASS  R78/C3/baseline  installed records establish baseline identity',
  'PASS  R78/C3/migration  versioned migration preserves project fields',
  'PASS  R78/C3/replacement-coverage  replacement coverage needs its own decision',
  'PASS  R52/C3/user-denies  identical user denies stay user owned',
  'PASS  R85/C3/retained-denies  retired deny bytes and ownership survive',
  'PASS  R80/C3/snapshot  one approved snapshot binds migration outputs',
  'PASS  R80/C3/tool-unit  policy migration requires compatible reviewed tools',
  'PASS  R80/C3/manifest-after  commit verifies the derived manifest',
  'PASS  R81/C3/recorded-patterns  recorded patterns distinguish drift and behind',
  'PASS  R82/C3/snippet  recorded snippet hash detects stale rendering',
  'PASS  R97/C3/environment-controls  environment variants receive rendered coverage',
  'PASS  Q4/C3/scan-labels  protected findings remain scanned and redacted',
  'PASS  V2/C3/recovery  coupled migration rolls back through one journal',
  'PASS  V2/C3/module-contract  C3 exports errors and component contracts',
];
// Plan 2.1 and 2.4: the exact export sets. lib.mjs keeps every export it has at 5c1ff93 (C2 added two) and adds loadEffectivePolicy.
const LIB_OLD_EXPORTS = ['ENV_TEMPLATE_RE', 'IS_WINDOWS', 'SKILL_DIR', 'WRITE_ALLOWLIST', 'WRITE_DENYLIST', 'assertNotLink', 'assertNotSecretInput', 'assertWritable', 'atomicWrite', 'canonicalPath', 'classifyEnvTemplate', 'detectEol', 'fail', 'git', 'globToRegExp', 'hostId', 'isSecretPath', 'loadSecretSpec', 'matchesAny', 'normalizeText', 'normalizedHash', 'ok', 'parseArgs', 'rawFileHash', 'readInRepo', 'readJsonFile', 'repoRoot', 'run', 'safeResolve', 'secretGlobs', 'secureDir', 'secureDirRel', 'setFilesystemRoot', 'sha256', 'skillVersion', 'toPosix', 'validateRunId', 'writeInRepo'];
const LIB_NEW_EXPORTS = ['loadEffectivePolicy'];
const RENDER_EXPORTS = ['CLAUDE_COMMAND_DENY', 'renderSecurityControls'];
// C6 plan 2.5 and 4.8 and C7 plan 2.4 and 4.11: the merge module exports exactly mergeManagedDenies, mergeManagedHooks (C6) and retireManagedAllows (C7); the first two keep their signatures and behavior.
const MERGE_EXPORTS = ['mergeManagedDenies', 'mergeManagedHooks', 'retireManagedAllows'];
const MIGRATE_EXPORTS = ['checkSecurityToolUnit', 'classifySecurityMigration', 'inspectSecurityState', 'readRuntimeUnits', 'resolveSecurityMigration'];
const SCAN_EXPORTS = ['labelScanFindings'];
const CASE_EXPORTS = ['C3_IMPLEMENTATIONS'];
const RC1_CASES_EXPORTS = ['BASELINE_CASE_IDS', 'COMPONENT_ASSERTIONS', 'COMPONENT_IMPLEMENTATIONS', 'RC1_CASE_IDS', 'REQUIRED_CASE_IDS', 'registerRc1Cases', 'runComponentAssertions', 'selectSuiteCases'];

// Control files and targets.
const T_POLICY = '.ai/security-paths.json';
const T_SETTINGS = '.claude/settings.json';
const T_MANIFEST = '.ai/manifest.json';
const T_HELPER = '.ai/tools/security-policy.mjs';
const T_READER = '.ai/tools/git-safe.mjs';
const T_DECISIONS = 'security-decisions.json';
const T_CATALOG = 'data/runtime-units.json';
const R_POLICY = 'policy ownership or managed metadata changes';
const R_SETTINGS = 'settings ownership or managed metadata changes';
const R_OMIT = 'approved omission records change';
const approvalSuffix = (t) => `Show the diff; re-run prepare with --approve-user-content ${t} only after the user approves it`;
const metaApprovalError = (t) => `metadata changes require --approve-user-content ${t}`;
const contentApprovalError = (t, reasons) => `${reasons.join('; ')}. ${approvalSuffix(t)}`;
const EDITED_FULL = 'fully managed file was edited by the user since install';
const MSG = {
  PLAN_INVALID: 'invalid prepared plan; run prepare again',
  PLAN_REJECTED: 'plan rejected',
  DRIFT: 'changes since prepare; nothing was written. Re-run prepare and get approval again.',
  MANIFEST_MISMATCH: 'prepared manifest does not match reviewed operations; run prepare again',
  MIGRATION_REQUIRED: 'schema-2 policy changes with installed tools require security-decisions.json',
  SECRET_PREPARE: 'agent drafts may not target secret-pattern paths',
  SCOPE: (t) => `write outside documentation scope: ${t}`,
  RENDER_USAGE: 'usage: render-permissions.mjs json|codex-snippet|pathspec [--project <root>]',
  MIGRATION_USAGE: 'usage: migrate-security-paths.mjs report --project <root> OR stage --project <root> --run-id <id>',
  ALIAS: 'refusing to read a secret-pattern path through an alias',
  TOOL_INCOMPATIBLE: (t) => `TOOL_UNIT_INCOMPATIBLE: compatible reviewed reader required: ${t}`,
  TOOL_UNREVIEWED: (t) => `TOOL_UNIT_UNREVIEWED: reviewed tool bytes required: ${t}`,
  TOOL_CATALOG: 'TOOL_CATALOG: invalid runtime unit catalog',
  OUTPUT_MISMATCH: (t) => `MIGRATION_OUTPUT_MISMATCH: staged migration output does not match decisions: ${t}`,
  DECISION_REQUIRED: (id) => `MIGRATION_DECISION_REQUIRED: explicit decision required for ${id}`,
  REPORT_CHANGED: 'MIGRATION_REPORT_CHANGED: migration report changed; review decisions again',
  DECISIONS: 'MIGRATION_DECISIONS: invalid security migration decisions',
  MANIFEST_INVALID: 'MANIFEST_INVALID: invalid manifest',
  MANIFEST_SCHEMA: 'MANIFEST_SCHEMA: schema must be 2 or 3',
  SCAN_NOTE: 'Matches are redacted and not shown. Protected paths, run vaults and canary files are included. Report file:line:rule to the user; never open the files.',
};
// Section 5.3 drift descriptions of C2, plus the one row C3 adds.
const DRIFT_WHAT = {
  INVENTORY: 'draft inventory changed since prepare',
  TARGET: 'target changed since prepare',
  INPUT: 'transaction input changed since prepare',
  SOURCE: 'draft changed after prepare (unreviewed content)',
  REQUEST: 'manifest metadata changed after prepare (unreviewed ownership)',
  MANIFEST: 'manifest changed since prepare',
  DECISIONS: 'security decisions changed since prepare',
};
const dr = (target, what) => ({ target, what });
const REQUEST_FILES = ['ownership.json', 'managed-keys.json', 'omissions.json', 'manifest-metadata.json', 'transaction-inputs.json'];
const reviewText = (id) => `Review with: node <SKILL_DIR>/scripts/apply.mjs diff --project . --run-id ${id}. Vault files are shown only as key names and value classifications. The user approves this planSha256; pass it to commit --approved-plan.`;
const ORDINARY_PLAN_KEYS = ['agents', 'head', 'host', 'inputs', 'manifestAfter', 'manifestPreRawSha', 'metadata', 'metadataOps', 'mode', 'ops', 'planSchema', 'preparedAt', 'runId', 'skillVersion', 'sourceInventory'];
const PREPARE_KEYS = ['changed', 'metadataChanged', 'metadataOps', 'ok', 'ops', 'ownershipOverrides', 'plan', 'planSha256', 'review', 'unchanged'];
const NOOP_BODY = { ok: true, committed: false, reason: 'nothing to change (zero diff)' };

// Plan 3.3: the unchanged command deny list, in order.
const COMMAND_DENY = [
  'Bash(rm -rf *)', 'Bash(git reset --hard*)', 'Bash(git clean *)', 'Bash(git push --force*)', 'Bash(git push -f*)', 'Bash(git checkout -- *)',
  'Bash(git restore *)', 'Bash(curl * | bash*)', 'Bash(curl * | sh*)', 'Bash(wget * | bash*)', 'Bash(npm publish*)', 'Bash(terraform apply*)',
  'Bash(terraform destroy*)', 'Bash(kubectl delete *)', 'Bash(helm uninstall *)', 'PowerShell(Remove-Item * -Recurse*)', 'PowerShell(git reset --hard*)',
  'PowerShell(git clean *)', 'PowerShell(git push --force*)', 'PowerShell(git push -f*)', 'PowerShell(npm publish*)', 'PowerShell(Invoke-Expression *)',
  'PowerShell(iex *)',
];
// Plan 3.9: the initial trusted runtime-unit catalog. At C4 the shipped catalog changed (docs/plans/2026-10-18-project-setup-v3-rc1-c4.md section 2.3: the
// git-safe-core helper was added and the reader now declares [1, 2]), so this literal is no longer the shipped file. It is kept as the synthetic INCOMPATIBLE
// catalog of these tests (the entrypoint declares schema 1 only) and every test that needs an incompatible reader uses it in a scratch skill copy.
// The exact production catalog is asserted by R78/C4/reader-unit.
const CATALOG_INITIAL = {
  schema: 1,
  units: [
    { source: 'assets/tools/security-policy.mjs', target: T_HELPER, role: 'helper', policySchemas: [1, 2] },
    { source: 'assets/tools/git-safe.mjs', target: T_READER, role: 'entrypoint', policySchemas: [1] },
  ],
};
const CATALOG_COMPAT = { schema: 1, units: [CATALOG_INITIAL.units[0], { ...CATALOG_INITIAL.units[1], policySchemas: [1, 2] }] };

// ---------------------------------------------- independent rendering rules ----
// A restatement of plan 3.3, so no expected value comes from the code under test.
const idKey = (e) => JSON.stringify([e.anchor, e.glob.toLowerCase()]);
const inferAnchor = (glob) => (glob.startsWith('**/') ? 'any' : 'root');
// The effective entries of a policy: managed before project, first source spelling per identity, schema-1 anchors inferred.
function effectiveEntries(policy) {
  const out = [];
  const seen = new Set();
  for (const e of [...(policy.patterns || []), ...(policy.projectPatterns || [])]) {
    const entry = { anchor: hasOwn(e, 'anchor') ? e.anchor : inferAnchor(e.glob), glob: e.glob };
    const k = idKey(entry);
    if (!seen.has(k)) { seen.add(k); out.push(entry); }
  }
  return out;
}
const SNIPPET_PERM = (keys, depth) => [
  '# --- project-setup v3: Codex deny-read profile -------------------------------------------',
  '# REVIEW before use. Paste into your USER config (%USERPROFILE%\\.codex\\config.toml or ~/.codex/config.toml).',
  '# The skill never writes this file.',
  '#',
  '# CRITICAL: profiles do not compose with legacy sandbox settings. If `sandbox_mode` or',
  '# [sandbox_workspace_write] appears in ANY loaded config file, or you pass --sandbox, Codex uses',
  '# the legacy settings and this profile is silently inactive. Remove them first.',
  '#',
  '# WINDOWS: with the non-admin ("unelevated") sandbox, Codex 0.160.1 REFUSES TO START with this profile',
  '# ("cannot enforce deny-read restrictions directly; refusing to run unsandboxed"). Only use it with the',
  '# admin-installed Windows sandbox or under WSL2, and verify with a canary run.',
  '#',
  '# Deny-read globs are pre-expanded into a snapshot before the sandbox starts (Linux/WSL/native',
  '# Windows). Files created later in the session may not be covered: verify with canary.mjs.',
  'default_permissions = "project-setup"',
  '',
  '[permissions.project-setup]',
  'description = "Workspace write with secret paths denied (project-setup v3)"',
  'extends = ":workspace"',
  '',
  '[permissions.project-setup.filesystem]',
  `glob_scan_max_depth = ${depth}`,
  '"~/.ssh" = "deny"',
  '"~/.aws" = "deny"',
  '"~/.gnupg" = "deny"',
  '',
  '[permissions.project-setup.filesystem.":workspace_roots"]',
  ...keys.map((k) => `${k} = "deny"`),
  '',
  '# Optional: OS-enforced read-only profile for the reviewer agent. Only after this exists AND a',
  '# canary run passes, add `default_permissions = "project-setup-readonly"` to .codex/agents/reviewer.toml.',
  '[permissions.project-setup-readonly]',
  'description = "Read-only with secret paths denied (project-setup v3 reviewer)"',
  'extends = ":read-only"',
  '',
  '[permissions.project-setup-readonly.filesystem]',
  `glob_scan_max_depth = ${depth}`,
  '"~/.ssh" = "deny"',
  '"~/.aws" = "deny"',
  '"~/.gnupg" = "deny"',
  '',
  '[permissions.project-setup-readonly.filesystem.":workspace_roots"]',
  ...keys.map((k) => `${k} = "deny"`),
  '# -----------------------------------------------------------------------------------------',
].join('\n') + '\n';
function expectedControls(policy) {
  const eff = effectiveEntries(policy);
  const depth = hasOwn(policy, 'codexGlobScanMaxDepth') ? policy.codexGlobScanMaxDepth : 6;
  const readDeny = eff.map((e) => `Read(${e.anchor === 'root' ? '/' : ''}${e.glob})`);
  return {
    claude: { permissionsDeny: [...readDeny, ...COMMAND_DENY], readDeny, commandDeny: [...COMMAND_DENY] },
    gitPathspecExcludes: eff.map((e) => `:(exclude,glob,icase)${e.glob}`),
    codexSnippet: SNIPPET_PERM(eff.map((e) => JSON.stringify(e.glob)), depth),
  };
}
const snippetHash = (policy) => sha(Buffer.from(expectedControls(policy).codexSnippet, 'utf8'));
const anchored = (e) => ({ anchor: hasOwn(e, 'anchor') ? e.anchor : inferAnchor(e.glob), ...e });

// ========================================================= processes ====
// Every CLI call is shell-free, uses the absolute Node executable and absolute script paths, a 60 s timeout and a 16 MiB buffer. A spawn failure,
// signal, timeout or truncated output is "dead" and fails the calling assertion.
function execNode(context, { cwd, script, args = [], preload = null, env = null }) {
  const pre = Array.isArray(preload) ? preload : preload ? [preload] : [];
  const argv = [...pre.flatMap((p) => ['--require', p]), script, ...args];
  const r = spawnSync(process.execPath, argv, { cwd, env: env || context.env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 60000, maxBuffer: 16777216 });
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
const headShort = (context, dir) => gitCmd(context, dir, ['rev-parse', '--short', 'HEAD']).stdout;

// ============================================================= kit ====
// One toolkit per assertion group: every call goes through the group's `check`, so a dead process is reported once, where it happened. A kit
// can be pointed at a scratch COPY of the skill (the synthetic compatible reader scenarios).
function makeKit(context, check, skillRoot = context.skillRoot) {
  const scripts = (name) => path.join(skillRoot, 'scripts', `${name}.mjs`);
  const exec = (label, scriptPath, args, o = {}) => {
    const r = execNode(context, { cwd: o.cwd, script: scriptPath, args, preload: o.preload || null, env: o.env || null });
    if (r.dead && !o.allowDead) check(false, `${label}: the process did not end normally`, r.dead);
    return r;
  };
  const kit = {
    context, check, scripts, skillRoot,
    apply: (root, args, o = {}) => exec(`apply ${args[0]}`, scripts('apply'), args, { cwd: root, ...o }),
    lock: (root, args, o = {}) => exec(`lock ${args[0]}`, scripts('lock'), args, { cwd: root, ...o }),
    script: (name, root, args, o = {}) => exec(name, scripts(name), args, { cwd: root, ...o }),
    withSkill: (other) => makeKit(context, check, other),
    begin(root, id) {
      const a = kit.lock(root, ['acquire', '--run-id', id]);
      const b = kit.apply(root, ['init', '--run-id', id]);
      check(a.code === 0 && b.code === 0, `begin ${id}: lock acquire and init succeed`, { a: a.stdout.slice(0, 200), b: b.stdout.slice(0, 200) });
      return a.code === 0 && b.code === 0;
    },
    prepare(root, id, o = {}) {
      const args = ['prepare', '--run-id', id, '--mode', o.mode || 'update'];
      if (o.agents) args.push('--agents', o.agents);
      if (o.approve && o.approve.length) args.push('--approve-user-content', o.approve.join(','));
      return kit.apply(root, args, o);
    },
    commit(root, id, planSha, o = {}) { return kit.apply(root, ['commit', '--run-id', id, '--approved-plan', planSha], o); },
    diff(root, id, o = {}) { return kit.apply(o.cwd || root, ['diff', '--project', o.project !== undefined ? o.project : root, '--run-id', id], o); },
    status: (root, id, o = {}) => kit.apply(root, ['status', '--run-id', id], o),
    rollback: (root, id, o = {}) => kit.apply(root, ['rollback', '--run-id', id], o),
    report: (root, o = {}) => exec('migrate report', scripts('migrate-security-paths'), ['report', '--project', o.project !== undefined ? o.project : root], { cwd: root, ...o }),
    stage: (root, id, o = {}) => exec('migrate stage', scripts('migrate-security-paths'), ['stage', '--project', o.project !== undefined ? o.project : root, '--run-id', id], { cwd: root, ...o }),
    migrate: (root, args, o = {}) => exec(`migrate ${args[0]}`, scripts('migrate-security-paths'), args, { cwd: root, ...o }),
    render: (root, args, o = {}) => exec('render', scripts('render-permissions'), args, { cwd: root, ...o }),
    detect: (root, o = {}) => exec('detect', scripts('detect'), [], { cwd: root, ...o }),
    validate: (root, o = {}) => exec('validate', scripts('validate'), [], { cwd: root, ...o }),
  };
  return kit;
}

// ------------------------------------------------------ run-dir helpers ----
const runDirOf = (root, id) => path.join(root, '.ai', '.run', id);
const runFile = (root, id, ...segs) => path.join(runDirOf(root, id), ...segs);
const draftPath = (root, id, rel) => path.join(runDirOf(root, id), 'drafts', ...rel.split('/'));
const projPath = (root, rel) => path.join(root, ...rel.split('/'));
function putDraft(root, id, rel, data) { putFile(draftPath(root, id, rel), data); }
function putRequest(root, id, name, value) { putFile(runFile(root, id, name), typeof value === 'string' || Buffer.isBuffer(value) ? value : jsonText(value)); }
const readPlan = (root, id) => readJson(runFile(root, id, 'plan.json'));
const readJournal = (root, id) => readJson(runFile(root, id, 'journal.json'));
const planShaOf = (root, id) => { const b = readBytes(runFile(root, id, 'plan.json')); return b === null ? null : sha(b); };
const lockOwnerPath = (root) => path.join(root, '.ai', '.setup.lock', 'owner.json');
const manifestPath = (root) => path.join(root, '.ai', 'manifest.json');
const readManifestFile = (root) => readJson(manifestPath(root));
const headerOf = (m) => { const h = { ...m }; delete h.files; return h; };
const projectSnapshot = (root) => snapshotTree(root, ['.git']);
const sortedFiles = (files) => { const out = {}; for (const k of Object.keys(files).sort()) out[k] = files[k]; return out; };
const byTarget = (a, b) => (a.target < b.target ? -1 : a.target > b.target ? 1 : 0);
function writeRequests(root, id, reqs) { for (const [name, value] of Object.entries(reqs || {})) putRequest(root, id, name, value); }
// A prepared run on a project: lock, init, files, requests, prepare. Returns { ok, root, id, prep, plan, sha }.
function prepared(kit, root, id, setup, o = {}) {
  if (!kit.begin(root, id)) return { ok: false };
  if (setup) setup(root, id);
  const prep = kit.prepare(root, id, o);
  return { ok: prep.code === 0 && prep.json && prep.json.ok === true, root, id, prep, plan: readPlan(root, id), sha: prep.json && prep.json.planSha256 };
}
function runSpec(kit, root, id, spec = {}) {
  return prepared(kit, root, id, (r, i) => {
    for (const [rel, data] of Object.entries(spec.drafts || {})) putDraft(r, i, rel, data);
    writeRequests(r, i, spec.requests);
  }, spec.o || {});
}
// What a rejected plan, a lock or a project must look like after a failure that happens before any write.
function noWriteState(root, id) { return { project: projectSnapshot(root), lock: readBytes(lockOwnerPath(root)), journal: exists(runFile(root, id, 'journal.json')) }; }
function checkNoWrite(check, label, root, id, before) {
  check(!exists(runFile(root, id, 'journal.json')), `${label}: no journal`);
  check(projectSnapshot(root) === before.project, `${label}: no project file, run file or lock changed`);
  check(sameBytes(readBytes(lockOwnerPath(root)), before.lock), `${label}: the lock bytes are unchanged (no heartbeat)`);
}

// Response expectations ------------------------------------------------------
// F: a direct failure { ok:false, code, error } (plus named extra keys). Two-space JSON, one final LF, empty stderr (plan 3.12).
function expectF(check, label, r, { code, exit, error = null, extra = [], target } = {}) {
  check(r.code === exit, `${label}: exit code ${exit}`, { code: r.code, stdout: r.stdout.slice(0, 300), stderr: r.stderr.slice(0, 200) });
  check(r.stderr === '', `${label}: empty stderr`, r.stderr.slice(0, 200));
  check(r.json !== null && fmtOk(r), `${label}: two-space JSON with one final LF`, r.stdout.slice(0, 200));
  if (!r.json) return;
  check(r.json.ok === false && r.json.code === code, `${label}: ok false with code ${code}`, { ok: r.json.ok, code: r.json.code, error: r.json.error });
  if (typeof error === 'string') check(r.json.error === error, `${label}: error is exactly ${show(error)}`, r.json.error);
  else if (error instanceof RegExp) check(typeof r.json.error === 'string' && error.test(r.json.error), `${label}: error matches ${error}`, r.json.error);
  const extras = target !== undefined ? [...extra, 'target'] : extra;
  const want = sorted(['ok', 'code', 'error', ...extras]);
  check(eq(sorted(Object.keys(r.json)), want), `${label}: the envelope holds exactly ${want.join(', ')}`, Object.keys(r.json));
  if (target !== undefined) check(r.json.target === target, `${label}: target is ${target}`, r.json.target);
}
// P: a prepare rejection with one entry per affected target, in JavaScript string order (plan 3.12).
function expectP(check, label, r, entries, exit = 3) {
  check(r.code === exit, `${label}: exit code ${exit}`, { code: r.code, stdout: r.stdout.slice(0, 400), stderr: r.stderr.slice(0, 200) });
  check(r.stderr === '', `${label}: empty stderr`, r.stderr.slice(0, 200));
  check(r.json !== null && fmtOk(r), `${label}: two-space JSON with one final LF`, r.stdout.slice(0, 200));
  check(eq(r.json, { ok: false, code: 'APPLY_PLAN_REJECTED', error: MSG.PLAN_REJECTED, errors: entries }), `${label}: the exact plan rejection`, r.json);
}
// A prepare rejection whose entries are checked one by one; entries are { target, code, error }.
function expectPEntry(check, label, r, entry) {
  const errors = r.json && Array.isArray(r.json.errors) ? r.json.errors : [];
  check(r.code === 3 && r.stderr === '' && r.json && r.json.code === 'APPLY_PLAN_REJECTED' && r.json.error === MSG.PLAN_REJECTED, `${label}: a plan rejection, exit 3, empty stderr`, { code: r.code, out: r.stdout.slice(0, 300) });
  check(errors.some((e) => eq(e, entry)), `${label}: the entry ${show(entry)}`, errors);
}

// ========================================================== preloads ====
// External CommonJS preloads: node --require <absolute-preload.cjs> <absolute-script.mjs> ... The fixture paths are embedded as JSON literals; no
// production fault flag or environment override exists or is used.
const WIN = process.platform === 'win32';
const fold = (s) => (WIN ? s.toLowerCase() : s);
function keysOfPath(p) {
  const abs = path.resolve(p);
  const out = [];
  let d = path.dirname(abs);
  try { d = fs.realpathSync.native(d); } catch { /* keep the spelling */ }
  out.push(fold(path.join(d, path.basename(abs))));
  try { out.push(fold(fs.realpathSync.native(abs))); } catch { /* absent */ }
  return out;
}
const destKey = (p) => keysOfPath(p)[0];
const GUARD_SOURCE = (cfg) => [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  `const CFG = ${JSON.stringify(cfg)};`,
  "const WIN = process.platform === 'win32';",
  "const fold = (s) => (WIN ? s.toLowerCase() : s);",
  "const WATCH = new Set(CFG.watch);",
  "function toStr(p) { if (typeof p === 'string') return p; if (p instanceof URL) return require('url').fileURLToPath(p); if (Buffer.isBuffer(p)) return p.toString(); return null; }",
  "function keysOf(p) { const s = toStr(p); if (s === null) return []; let abs; try { abs = path.resolve(s); } catch (e) { return []; } const out = []; let d = path.dirname(abs); try { d = fs.realpathSync.native(d); } catch (e) { /* keep */ } out.push(fold(path.join(d, path.basename(abs)))); try { out.push(fold(fs.realpathSync.native(abs))); } catch (e) { /* absent */ } return out; }",
  "function note(op, key) { try { fs.appendFileSync(CFG.log, JSON.stringify({ op: op, key: key }) + '\\n'); } catch (e) { /* ignore */ } }",
  "function touched(p, op) { let found = false; for (const k of keysOf(p)) { if (WATCH.has(k)) { note(op, k); found = true; } } return found; }",
  "function boom() { const e = new Error('C3 injected read failure'); e.code = 'EACCES'; e.syscall = 'open'; return e; }",
  "function wrap(obj, name, isRead) { const orig = obj[name]; if (typeof orig !== 'function') return; obj[name] = function (p, second) { if (isRead(second) && touched(p, name) && CFG.mode === 'fail') throw boom(); return orig.apply(this, arguments); }; }",
  "const always = () => true;",
  "const readFlag = (f) => f === undefined || f === null || (typeof f === 'string' && (f.charAt(0) === 'r' || f.indexOf('+') >= 0)) || (typeof f === 'number' && (f & 3) !== 1);",
  "wrap(fs, 'readFileSync', always); wrap(fs, 'readFile', always); wrap(fs, 'createReadStream', always); wrap(fs.promises, 'readFile', always);",
  "wrap(fs, 'openSync', readFlag); wrap(fs, 'open', readFlag);",
].join('\n') + '\n';
const FAULT_SOURCE = (cfg) => [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  `const CFG = ${JSON.stringify(cfg)};`,
  "const WIN = process.platform === 'win32';",
  "const fold = (s) => (WIN ? s.toLowerCase() : s);",
  "function keyOf(p) { let abs; try { abs = path.resolve(String(p)); } catch (e) { return null; } let d = path.dirname(abs); try { d = fs.realpathSync.native(d); } catch (e) { /* keep */ } return fold(path.join(d, path.basename(abs))); }",
  "function note(o) { try { fs.appendFileSync(CFG.log, JSON.stringify(o) + '\\n'); } catch (e) { /* ignore */ } }",
  "const counts = {};",
  "const origRename = fs.renameSync;",
  "fs.renameSync = function (from, to) {",
  "  const k = keyOf(to);",
  "  for (let i = 0; i < CFG.rules.length; i++) {",
  "    const r = CFG.rules[i];",
  "    if (r.dest !== k) continue;",
  "    counts[i] = (counts[i] || 0) + 1;",
  "    if (counts[i] !== r.nth) continue;",
  "    if (r.action === 'throw') { note({ rule: i, n: counts[i], action: 'throw' }); const e = new Error('C3 injected rename failure'); e.code = 'EIO'; throw e; }",
  "    if (r.action === 'exit-after') { const res = origRename.apply(this, arguments); note({ rule: i, n: counts[i], action: 'exit-after' }); process.exit(r.exitCode); return res; }",
  "  }",
  "  return origRename.apply(this, arguments);",
  "};",
].join('\n') + '\n';
let preloadSeq = 0;
function writePreload(dir, source) { const f = path.join(dir, `preload-${++preloadSeq}.cjs`); fs.writeFileSync(f, source); return f; }
const parseLog = (text) => (text || '').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return l; } });
// Read recording / read failure for a set of watched paths. mode "record" lets the read proceed, "fail" throws EACCES.
function makeGuard(dir, paths, mode = 'record') {
  const log = path.join(dir, `guard-${preloadSeq + 1}.log`);
  const watch = [...new Set(paths.flatMap((p) => keysOfPath(p)))];
  const file = writePreload(dir, GUARD_SOURCE({ log, watch, mode }));
  return { file, log, hits: () => parseLog(readText(log)) };
}
// Read limit (C3-P3-1): counts the logical reads of the watched files (a readFileSync and the openSync it makes count once) and fails every read after the
// first cfg.allow of them with an EACCES that carries its path. cfg.allow Infinity only counts.
const READLIMIT_SOURCE = (cfg) => [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  `const CFG = ${JSON.stringify(cfg)};`,
  "const WIN = process.platform === 'win32';",
  "const fold = (s) => (WIN ? s.toLowerCase() : s);",
  "const WATCH = new Set(CFG.watch);",
  "let depth = 0; let count = 0;",
  "function toStr(p) { return typeof p === 'string' ? p : (Buffer.isBuffer(p) ? p.toString() : null); }",
  "function hit(p) { const s = toStr(p); if (s === null) return false; let abs; try { abs = path.resolve(s); } catch (e) { return false; } let d = path.dirname(abs); try { d = fs.realpathSync.native(d); } catch (e) { /* keep */ } if (WATCH.has(fold(path.join(d, path.basename(abs))))) return true; try { return WATCH.has(fold(fs.realpathSync.native(abs))); } catch (e) { return false; } }",
  "function note(o) { try { fs.appendFileSync(CFG.log, JSON.stringify(o) + '\\n'); } catch (e) { /* ignore */ } }",
  "function count1(p, op) { count++; note({ op: op, n: count }); if (count > CFG.allow) { const e = new Error('C3 injected read failure'); e.code = 'EACCES'; e.syscall = 'open'; e.path = String(p); throw e; } }",
  "const origRead = fs.readFileSync;",
  "fs.readFileSync = function (p) { if (hit(p)) count1(p, 'readFileSync'); depth++; try { return origRead.apply(this, arguments); } finally { depth--; } };",
  "const origOpen = fs.openSync;",
  "fs.openSync = function (p, flags) { if (depth === 0 && hit(p) && (flags === undefined || flags === null || (typeof flags === 'string' && (flags.charAt(0) === 'r' || flags.indexOf('+') >= 0)))) count1(p, 'openSync'); return origOpen.apply(this, arguments); };",
].join('\n') + '\n';
function makeReadLimit(dir, paths, allow) {
  const log = path.join(dir, `readlimit-${preloadSeq + 1}.log`);
  const watch = [...new Set(paths.flatMap((p) => keysOfPath(p)))];
  const file = writePreload(dir, READLIMIT_SOURCE({ log, watch, allow: allow === Infinity ? 1e9 : allow }));
  return { file, log, reads: () => parseLog(readText(log)).length };
}
// Rename fault injection: rules are { dest: <file path>, nth, action: "throw" | "exit-after", exitCode }.
function makeFault(dir, rules) {
  const log = path.join(dir, `fault-${preloadSeq + 1}.log`);
  const file = writePreload(dir, FAULT_SOURCE({ log, rules: rules.map((r) => ({ dest: destKey(r.dest), nth: r.nth || 1, action: r.action, exitCode: r.exitCode || 137 })) }));
  return { file, log, fired: () => parseLog(readText(log)) };
}
// A recording, failing git first on PATH. Windows: a copy of Node named git.exe, a preload that recognizes it and exits 91.
let shimSeq = 0;
function makeGitShim(context, parent) {
  const dir = path.join(parent, `git-shim-${++shimSeq}`); // its own directory and records file: a record can never come from another shim
  fs.mkdirSync(dir, { recursive: true });
  const shimDir = path.join(dir, 'bin');
  fs.mkdirSync(shimDir, { recursive: true });
  const rec = path.join(dir, 'git-records.jsonl');
  fs.writeFileSync(rec, '');
  const env = {};
  let origPath = null;
  for (const [k, v] of Object.entries(context.env)) {
    if (k.toUpperCase() === 'PATH') { if (origPath === null) origPath = v; continue; } // every case variant of PATH is removed
    env[k] = v;
  }
  env.PATH = `${shimDir}${path.delimiter}${origPath === null ? '' : origPath}`;
  if (WIN) {
    const preload = path.join(dir, 'git-shim.cjs');
    fs.writeFileSync(preload, [
      "'use strict';", "const path = require('path');", "const fs = require('fs');",
      "if (path.basename(process.execPath).toLowerCase() === 'git.exe') {",
      `  fs.appendFileSync(${JSON.stringify(rec)}, JSON.stringify(process.argv.slice(1)) + '\\n');`,
      '  process.exit(91);', '}',
    ].join('\n') + '\n');
    fs.copyFileSync(process.execPath, path.join(shimDir, 'git.exe'));
    env.NODE_OPTIONS = [context.env.NODE_OPTIONS, `--require "${toPosix(preload)}"`].filter(Boolean).join(' ');
  } else {
    const recorder = path.join(dir, 'git-recorder.cjs');
    fs.writeFileSync(recorder, `'use strict';\nrequire('fs').appendFileSync(${JSON.stringify(rec)}, JSON.stringify(process.argv.slice(2)) + '\\n');\nprocess.exit(91);\n`);
    const sh = path.join(shimDir, 'git');
    fs.writeFileSync(sh, `#!/bin/sh\nexec "${process.execPath}" "${recorder}" "$@"\n`);
    fs.chmodSync(sh, 0o755);
  }
  return { env, rec, records: () => (readText(rec) || '').split('\n').filter(Boolean), clear: () => fs.writeFileSync(rec, '') };
}
// A native-realpath replacement for one exact path (plan 4.2): the stubbed call returns `to`. Every other path passes through.
const REALPATH_SOURCE = (cfg) => [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  `const CFG = ${JSON.stringify(cfg)};`,
  "const WIN = process.platform === 'win32';",
  "const fold = (s) => (WIN ? s.toLowerCase() : s);",
  "const orig = fs.realpathSync.native;",
  "function note(o) { try { fs.appendFileSync(CFG.log, JSON.stringify(o) + '\\n'); } catch (e) { /* ignore */ } }",
  "function keyOf(p) { let abs; try { abs = path.resolve(String(p)); } catch (e) { return null; } let d = path.dirname(abs); try { d = orig.call(fs.realpathSync, d); } catch (e) { /* keep */ } return fold(path.join(d, path.basename(abs))); }",
  "fs.realpathSync.native = function (p) {",
  "  const key = keyOf(p);",
  "  if (key !== null && key === CFG.from) { note({ op: 'realpath', from: key }); return CFG.to; }",
  "  return orig.apply(this, arguments);",
  "};",
].join('\n') + '\n';
function makeRealpathStub(dir, from, to) {
  const log = path.join(dir, `realpath-${preloadSeq + 1}.log`);
  const file = writePreload(dir, REALPATH_SOURCE({ log, from: destKey(from), to }));
  return { file, log, hits: () => parseLog(readText(log)) };
}
// A scanner stub (plan 4.2): intercepts the gitleaks probe and scan by patching child_process.spawnSync, everything else passes through.
// cfg.mode: "ok" (writes cfg.report as the JSON report), "missing" (the probe fails), "fail" (the scan exits 2), "rawreport" (writes cfg.raw).
const SCAN_STUB_SOURCE = (cfg) => [
  "'use strict';",
  "const cp = require('child_process');",
  "const fs = require('fs');",
  "const { syncBuiltinESMExports } = require('module');",
  `const CFG = ${JSON.stringify(cfg)};`,
  "const orig = cp.spawnSync;",
  "function note(o) { try { fs.appendFileSync(CFG.log, JSON.stringify(o) + '\\n'); } catch (e) { /* ignore */ } }",
  "function isScanner(cmd, args) { const text = [String(cmd), ...(Array.isArray(args) ? args.map(String) : [])].join(' '); return /gitleaks/i.test(text); }",
  "cp.spawnSync = function (cmd, args, opts) {",
  "  if (!isScanner(cmd, args)) return orig.apply(this, arguments);",
  "  const words = typeof cmd === 'string' && (!Array.isArray(args) || args.length === 0) ? cmd.match(/\"[^\"]*\"|\\S+/g).map((w) => w.replace(/^\"|\"$/g, '')) : [String(cmd), ...(Array.isArray(args) ? args.map(String) : [])];",
  "  note({ argv: words });",
  "  const isProbe = words.includes('version') && !words.includes('dir') && !words.includes('git');",
  "  if (isProbe) return CFG.mode === 'missing' ? { status: 1, stdout: '', stderr: 'not found', error: null } : { status: 0, stdout: '8.99.0-stub\\n', stderr: '', error: null };",
  "  if (CFG.mode === 'fail') return { status: 2, stdout: '', stderr: 'scan failed', error: null };",
  "  const i = words.indexOf('--report-path');",
  "  if (i >= 0) fs.writeFileSync(words[i + 1], CFG.mode === 'rawreport' ? CFG.raw : JSON.stringify(CFG.report));",
  "  return { status: 0, stdout: '', stderr: '', error: null };",
  "};",
  "syncBuiltinESMExports();",
].join('\n') + '\n';
function makeScanStub(dir, cfg) {
  const log = path.join(dir, `scan-${preloadSeq + 1}.log`);
  const file = writePreload(dir, SCAN_STUB_SOURCE({ log, mode: 'ok', report: [], raw: '', ...cfg }));
  return { file, log, calls: () => parseLog(readText(log)) };
}

// ======================================================== fixtures ====
// Lazily built, cached per context.tmp, never deleted by a test (the harness removes the whole tmp directory).
const baseCache = new Map();
function cached(context, name, build) {
  const key = `${context.tmp}|${name}`;
  if (!baseCache.has(key)) baseCache.set(key, Promise.resolve().then(build));
  return baseCache.get(key);
}
const getPlainBase = (context) => cached(context, 'plain', () => {
  const dir = scratchDir(context, 'base-plain');
  const root = path.join(dir, 'root');
  makeRepo(context, root, { 'package.json': '{"name":"fixture-app"}\n', 'src/a.ts': 'export {}\n' });
  return { dir, root };
});
// A genuine v2 installation: the tagged scripts ran in a synthetic repository (plan 4.2).
const getV2Base = (context) => cached(context, 'v2', async () => {
  const dir = scratchDir(context, 'base-v2');
  const root = path.join(dir, 'root');
  const work = path.join(dir, 'work');
  makeRepo(context, root, { 'package.json': '{"name":"fixture-app"}\n', 'src/a.ts': 'export {}\n' });
  const h = await import(new URL('./helpers/v2-baseline.mjs', import.meta.url).href);
  await h.createV2InstalledFixture({ repository: context.repository, root, workDir: work, projectName: 'fixture-wallet-api' });
  commitAll(context, root, 'v2 installed');
  return { dir, root, work, tagged: path.join(work, 'source', 'project-setup') };
});
// Schema 3 derived by rewriting only the manifest: same records, JavaScript key order.
function craftV3(context, root) {
  const m = readManifestFile(root);
  putFile(manifestPath(root), jsonText({ schema: 3, skill: m.skill, skillVersion: m.skillVersion, mode: m.mode, agents: m.agents, sourceCommit: m.sourceCommit, files: sortedFiles(m.files) }));
  commitAll(context, root, 'schema 3 manifest');
}
const getV3Base = (context) => cached(context, 'v3', async () => {
  const v2 = await getV2Base(context);
  const dir = scratchDir(context, 'base-v3');
  const root = cloneTree(v2.root, path.join(dir, 'root'));
  craftV3(context, root);
  return { dir, root, tagged: v2.tagged };
});
async function useBase(failures, name, getter, context) {
  try { return await getter(context); } catch (e) { failures.push(`cannot build the ${name} fixture: ${errMsg(e)}`); return null; }
}
function cloneBase(scratch, base, label) { return cloneTree(typeof base === 'string' ? base : base.root, path.join(scratch, label)); }
// Facts of an installed v2 project that several groups need (read from its own files, never from the code under test).
function baseFacts(root) {
  const manifest = readManifestFile(root);
  const policy = readJson(projPath(root, T_POLICY));
  const settingsRec = manifest.files[T_SETTINGS];
  return {
    manifest, policy, settingsRec, policyRec: manifest.files[T_POLICY], deny: settingsRec.managed['permissions.deny'],
    policyManaged: { schema: policy.schema, patterns: policy.patterns.map((e) => ({ anchor: 'any', ...e })) },
  };
}

// =================================================== error expectations ====
// New thrown errors are Error objects with an own string code, and a message that starts with "<code>: " (plan 3.12).
async function expectErr(check, label, fn, code, message = null) {
  const r = await attempt(fn);
  if (!r.threw) { check(false, `${label}: expected ${code}, got a result`, r.value); return null; }
  const e = r.error;
  check(e instanceof Error, `${label}: an Error instance`, e && e.constructor && e.constructor.name);
  check(hasOwn(e, 'code') && typeof e.code === 'string', `${label}: an own string code`, e && e.code);
  check(e && e.code === code, `${label}: code ${code}`, { code: e && e.code, message: e && e.message });
  if (message !== null) check(e && e.message === message, `${label}: message is exactly ${show(message)}`, e && e.message);
  else check(e && typeof e.message === 'string' && e.message.startsWith(`${code}: `), `${label}: the message starts with "${code}: "`, e && e.message);
  return e;
}
// For outcomes the plan pins only partly: an Error with an own string code and a message prefixed by it, the code in `codes` when given.
async function expectErrAny(check, label, fn, codes = null) {
  const r = await attempt(fn);
  if (!r.threw) { check(false, `${label}: expected an error, got a result`, r.value); return null; }
  const e = r.error;
  check(e instanceof Error && hasOwn(e, 'code') && typeof e.code === 'string', `${label}: an Error with an own string code`, e && e.code);
  check(e && typeof e.message === 'string' && typeof e.code === 'string' && e.message.startsWith(`${e.code}: `), `${label}: the message starts with its code`, e && e.message);
  if (codes) check(e && codes.includes(e.code), `${label}: the code is one of ${codes.join(', ')}`, e && e.code);
  return e;
}
// Runs an accepted pure call: the input is deep-frozen (so a mutation throws or fails), the result must be synchronous data detached from it.
async function runPure(check, label, fn, input) {
  const snapshot = clone(input);
  const frozen = deepFreeze(clone(input));
  const r = await attempt(() => fn(frozen));
  if (r.threw) { check(false, `${label}: accepted`, errMsg(r.error)); return null; }
  check(!(r.value && typeof r.value.then === 'function'), `${label}: synchronous`);
  check(r.value !== frozen && sharedObjects(frozen, r.value) === 0, `${label}: the result is detached from the input`);
  check(protoIssues(r.value).length === 0, `${label}: the result holds only plain objects and arrays`, protoIssues(r.value).slice(0, 3));
  check(eq(frozen, snapshot), `${label}: the input is not mutated`);
  return r.value;
}

// ============================================== shared rendering helpers ====
const countOf = (text, needle) => String(text).split(needle).length - 1;
// A schema-2 policy with one list of managed entries and an optional project list.
const pol2 = (patterns, projectPatterns = [], extra = {}) => ({ schema: 2, patterns, projectPatterns, ...extra });
// Plan 3.2, restated: the current shipped defaults, built from the immutable v2 snapshot (an input) and the plan text. Returns the parsed document.
function expectedShippedDoc(context) {
  const v2 = readJson(path.join(context.skillRoot, 'data', 'secret-paths-v2.0.0.json'));
  const list = [{ glob: '**/.env*', kind: 'env', note: 'Includes .env.example. Agents never read any .env* file; scripts/env-keys.mjs extracts key NAMES only.' }, ...clone(v2.patterns.slice(2))];
  list.splice(list.findIndex((e) => e.glob === '**/*.cer') + 1, 0, { glob: '**/*.cert', kind: 'cert' });
  list.splice(list.findIndex((e) => e.glob === '**/.npmrc') + 1, 0, { glob: '**/.htpasswd', kind: 'credential' });
  return { ...clone(v2), $comment: 'Secret-path defaults. Rendered controls use the effective project policy. Secret scanning includes protected paths and labels findings; it does not exclude them.', patterns: list };
}
// Compares a rendered result with the independent expectation and checks its structure (plan 2.4, 3.3).
function checkControls(check, label, got, policy) {
  const want = expectedControls(policy);
  check(got && eq(Object.keys(got), ['claude', 'gitPathspecExcludes', 'codexSnippet']), `${label}: the result keys are claude, gitPathspecExcludes, codexSnippet`, got && Object.keys(got));
  if (!got) return;
  check(got.claude && eq(Object.keys(got.claude), ['permissionsDeny', 'readDeny', 'commandDeny']), `${label}: claude holds permissionsDeny, readDeny, commandDeny`, got.claude && Object.keys(got.claude));
  check(eq(got.claude && got.claude.readDeny, want.claude.readDeny), `${label}: the Read denies`, got.claude && got.claude.readDeny);
  check(eq(got.claude && got.claude.commandDeny, COMMAND_DENY), `${label}: the command denies are the unchanged list`);
  check(eq(got.claude && got.claude.permissionsDeny, want.claude.permissionsDeny), `${label}: permissionsDeny is readDeny followed by commandDeny`);
  check(eq(got.gitPathspecExcludes, want.gitPathspecExcludes), `${label}: the Git pathspec exclusions`, got.gitPathspecExcludes);
  check(got.codexSnippet === want.codexSnippet, `${label}: the complete Codex snippet is the preserved template with only the permitted substitutions`, typeof got.codexSnippet === 'string' ? got.codexSnippet.slice(0, 300) : got.codexSnippet);
  check(protoIssues(got).length === 0, `${label}: only plain objects and arrays`, protoIssues(got).slice(0, 3));
}

// ================================================== R44/C3/anchors ====
// Plan 3.3 and 4.3: the A1 forms per anchor, the unchanged command denies, no leading slash outside Claude.
async function anchors(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const m = await needSafeScript(failures, context, 'render-permissions.mjs');
    if (!m || !needFns(failures, m, ['renderSecurityControls'])) return;
    const render = (p) => m.renderSecurityControls(p);
    await step('CLAUDE_COMMAND_DENY is the frozen, ordered list of plan 3.3', async () => {
      check(Array.isArray(m.CLAUDE_COMMAND_DENY) && Object.isFrozen(m.CLAUDE_COMMAND_DENY), 'CLAUDE_COMMAND_DENY is a frozen array', m.CLAUDE_COMMAND_DENY && Object.isFrozen(m.CLAUDE_COMMAND_DENY));
      check(eq([...(m.CLAUDE_COMMAND_DENY || [])], COMMAND_DENY), 'it holds the 23 command denies, in order, unchanged', m.CLAUDE_COMMAND_DENY);
    });
    await step('a root-anchored entry: Read(/Env/**), the Git form without a slash, the Codex key without a slash, in both profiles', async () => {
      const policy = pol2([{ anchor: 'root', glob: 'Env/**' }]);
      const out = await runPure(check, 'root Env/**', render, policy);
      if (!out) return;
      check(eq(out.claude.readDeny, ['Read(/Env/**)']), 'Read(/Env/**) with the stored spelling', out.claude.readDeny);
      check(eq(out.gitPathspecExcludes, [':(exclude,glob,icase)Env/**']), 'the Git form is :(exclude,glob,icase)Env/** with no leading slash', out.gitPathspecExcludes);
      check(countOf(out.codexSnippet, '"Env/**" = "deny"') === 2 && !out.codexSnippet.includes('"/Env/**"'), 'the Codex key "Env/**" = "deny" appears once per profile and never with a slash', countOf(out.codexSnippet, '"Env/**" = "deny"'));
      const parts = out.codexSnippet.split('[permissions.project-setup-readonly]');
      check(parts.length === 2 && countOf(parts[0], '"Env/**" = "deny"') === 1 && countOf(parts[1], '"Env/**" = "deny"') === 1, 'one key in the workspace profile and one in the read-only profile');
      checkControls(check, 'root Env/**', out, policy);
    });
    await step('an any-anchored entry renders the corresponding A1 forms', async () => {
      const policy = pol2([{ anchor: 'any', glob: '**/*.pem' }]);
      const out = await runPure(check, 'any **/*.pem', render, policy);
      if (!out) return;
      check(eq(out.claude.readDeny, ['Read(**/*.pem)']) && eq(out.gitPathspecExcludes, [':(exclude,glob,icase)**/*.pem']) && countOf(out.codexSnippet, '"**/*.pem" = "deny"') === 2, 'Read(**/*.pem), :(exclude,glob,icase)**/*.pem and the key "**/*.pem"', out.claude.readDeny);
      checkControls(check, 'any **/*.pem', out, policy);
    });
    await step('both anchors together keep effective-entry order, one rule per identity per renderer', async () => {
      const policy = pol2([{ anchor: 'root', glob: 'a/b' }, { anchor: 'any', glob: '**/c' }], [{ anchor: 'root', glob: 'd' }]);
      const out = await runPure(check, 'mixed anchors', render, policy);
      if (out) {
        check(eq(out.claude.readDeny, ['Read(/a/b)', 'Read(**/c)', 'Read(/d)']) && eq(out.gitPathspecExcludes, [':(exclude,glob,icase)a/b', ':(exclude,glob,icase)**/c', ':(exclude,glob,icase)d']), 'managed entries precede project entries in every renderer', out.claude.readDeny);
        checkControls(check, 'mixed anchors', out, policy);
      }
    });
    await step('the command denies are a detached copy; permissionsDeny is readDeny followed by commandDeny', async () => {
      const a = render(pol2([{ anchor: 'any', glob: '**/x' }]));
      a.claude.commandDeny.push('Bash(extra)');
      a.claude.commandDeny[0] = 'mutated';
      const b = render(pol2([{ anchor: 'any', glob: '**/x' }]));
      check(eq(b.claude.commandDeny, COMMAND_DENY) && eq([...m.CLAUDE_COMMAND_DENY], COMMAND_DENY), 'mutating one result never changes the constant or a later result');
      check(b.claude.commandDeny !== m.CLAUDE_COMMAND_DENY, 'commandDeny is not the shared constant itself');
      check(eq(b.claude.permissionsDeny, [...b.claude.readDeny, ...COMMAND_DENY]), 'permissionsDeny is the Read denies followed by the command denies');
    });
    await step('empty patterns: no Read denies and no Git lines, the command denies remain, the snippet keeps both profiles', async () => {
      const policy = pol2([]);
      const out = await runPure(check, 'empty policy', render, policy);
      if (!out) return;
      check(eq(out.claude.readDeny, []) && eq(out.gitPathspecExcludes, []) && eq(out.claude.commandDeny, COMMAND_DENY) && eq(out.claude.permissionsDeny, COMMAND_DENY), 'zero Read denies, zero exclusions, the 23 command denies', out.claude);
      check(countOf(out.codexSnippet, '= "deny"') === 6, 'no generated key remains (only the three static home denies per profile)', countOf(out.codexSnippet, '= "deny"'));
      checkControls(check, 'empty policy', out, policy);
    });
    await step('a policy that C1 rejects is never partly rendered: the C1 error propagates', async () => {
      await expectErr(check, 'schema 3', () => render({ schema: 3, patterns: [], projectPatterns: [] }), 'POLICY_SCHEMA', 'POLICY_SCHEMA: policy.schema must be 1 or 2');
      await expectErr(check, 'a bad glob', () => render(pol2([{ anchor: 'root', glob: 'a**b' }])), 'POLICY_GLOBSTAR');
    });
  });
}

// ========================================= R47/C3/project-controls ====
// Plan 3.3 and 4.3: project entries reach every renderer; first-source spelling; the CLI loads the installed policy, never the defaults.
async function projectControls(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const render = await needSafeScript(failures, context, 'render-permissions.mjs');
    const lib = await needScript(failures, context, 'lib.mjs');
    const c1 = await needPolicyModule(failures, context);
    const kit = makeKit(context, check);
    const shipped = expectedShippedDoc(context);
    if (render && needFns(failures, render, ['renderSecurityControls'])) {
      await step('managed .env* plus project root env/** and cert/**: all three identities in every renderer', async () => {
        const policy = pol2([{ anchor: 'any', glob: '**/.env*', kind: 'env' }], [{ anchor: 'root', glob: 'env/**' }, { anchor: 'root', glob: 'cert/**' }]);
        const out = await runPure(check, 'project controls', render.renderSecurityControls, policy);
        if (!out) return;
        check(eq(out.claude.readDeny, ['Read(**/.env*)', 'Read(/env/**)', 'Read(/cert/**)']), 'Claude: the managed rule, then the project rules in order', out.claude.readDeny);
        check(eq(out.gitPathspecExcludes, [':(exclude,glob,icase)**/.env*', ':(exclude,glob,icase)env/**', ':(exclude,glob,icase)cert/**']), 'Git: all three exclusions', out.gitPathspecExcludes);
        for (const key of ['"**/.env*"', '"env/**"', '"cert/**"']) check(countOf(out.codexSnippet, `${key} = "deny"`) === 2, `Codex: ${key} appears in both profiles`);
        checkControls(check, 'project controls', out, policy);
      });
      await step('an identity present in both lists renders once, with the first source spelling', async () => {
        const policy = pol2([{ anchor: 'any', glob: '**/.ENV*', kind: 'env' }], [{ anchor: 'any', glob: '**/.env*' }, { anchor: 'root', glob: 'env/**' }, { anchor: 'root', glob: 'ENV/**' }]);
        const out = await runPure(check, 'duplicate across lists', render.renderSecurityControls, policy);
        if (!out) return;
        check(eq(out.claude.readDeny, ['Read(**/.ENV*)', 'Read(/env/**)']), 'one Read deny per identity: the managed spelling, then the first project spelling', out.claude.readDeny);
        check(eq(out.gitPathspecExcludes, [':(exclude,glob,icase)**/.ENV*', ':(exclude,glob,icase)env/**']), 'one Git exclusion per identity with the same spelling', out.gitPathspecExcludes);
        check(!out.codexSnippet.includes('"**/.env*" = "deny"') && !out.codexSnippet.includes('"ENV/**" = "deny"') && countOf(out.codexSnippet, '"**/.ENV*" = "deny"') === 2, 'one Codex key per identity per profile with the same spelling');
      });
    }
    // ---- the CLI ----
    await withScratch(context, 'r47', async (dir) => {
      const project = path.join(dir, 'proj');
      const elsewhere = path.join(dir, 'elsewhere');
      fs.mkdirSync(elsewhere, { recursive: true });
      const policy = pol2([{ anchor: 'any', glob: '**/.env*', kind: 'env' }], [{ anchor: 'root', glob: 'env/**' }, { anchor: 'root', glob: 'cert/**' }]);
      putFile(projPath(project, T_POLICY), jsonText(policy));
      const policyBytes = readBytes(projPath(project, T_POLICY));
      await step('render-permissions json --project loads the installed file, not the defaults; source names it', async () => {
        const r = kit.render(elsewhere, ['json', '--project', project]);
        const want = { ok: true, source: '.ai/security-paths.json', ...expectedControls(policy) };
        check(r.code === 0 && r.stderr === '' && r.stdout === jsonText(want), 'exactly J({ok:true, source, ...controls}) with the installed policy', { code: r.code, out: r.stdout.slice(0, 300), err: r.stderr.slice(0, 200) });
        const d = kit.render(project, ['json', '--project', project]);
        check(d.code === 0 && d.stdout === r.stdout, 'the working directory does not matter');
        const n = kit.render(elsewhere, ['--project', project]);
        check(n.code === 0 && n.stdout === r.stdout, 'no subcommand means json');
        check(sameBytes(readBytes(projPath(project, T_POLICY)), policyBytes), 'the policy file is never written');
      });
      await step('codex-snippet and pathspec --project print the exact snippet and one exclusion per line', async () => {
        const s = kit.render(elsewhere, ['codex-snippet', '--project', project]);
        check(s.code === 0 && s.stderr === '' && s.stdout === expectedControls(policy).codexSnippet, 'codex-snippet prints the exact snippet, LF, one final LF', { code: s.code, out: s.stdout.slice(0, 200) });
        const p = kit.render(elsewhere, ['pathspec', '--project', project]);
        check(p.code === 0 && p.stderr === '' && p.stdout === `${expectedControls(policy).gitPathspecExcludes.join('\n')}\n`, 'pathspec prints one exclusion per line with a final LF', { code: p.code, out: p.stdout.slice(0, 200) });
        const emptyProject = path.join(dir, 'empty-proj');
        putFile(projPath(emptyProject, T_POLICY), jsonText(pol2([])));
        const e = kit.render(elsewhere, ['pathspec', '--project', emptyProject]);
        check(e.code === 0 && e.stderr === '' && e.stdout === '', 'zero exclusions print an empty string', { code: e.code, out: e.stdout });
      });
      await step('without --project (or with a root that has no installed policy) the shipped defaults render and source says so', async () => {
        const want = { ok: true, source: 'data/secret-paths.json', ...expectedControls(shipped) };
        const r = kit.render(elsewhere, ['json']);
        check(r.code === 0 && r.stderr === '' && r.stdout === jsonText(want), 'the controls of data/secret-paths.json (the 20-entry document of plan 3.2)', { code: r.code, out: r.stdout.slice(0, 200), err: r.stderr.slice(0, 200) });
        const bare = path.join(dir, 'bare');
        fs.mkdirSync(bare, { recursive: true });
        const b = kit.render(elsewhere, ['json', '--project', bare]);
        check(b.code === 0 && b.stdout === r.stdout, 'only an absent installed policy falls back to the skill', { code: b.code, out: b.stdout.slice(0, 200) });
      });
      await step('a present malformed installed policy fails with the C1 code and message (F, exit 3) and never renders defaults', async () => {
        const bad = [
          ['invalid JSON', '{ not json', 'POLICY_JSON', 'POLICY_JSON: policy text must be valid JSON'],
          ['an unsupported schema', jsonText({ schema: 3, patterns: [], projectPatterns: [] }), 'POLICY_SCHEMA', 'POLICY_SCHEMA: policy.schema must be 1 or 2'],
          ['an invalid glob', jsonText(pol2([{ anchor: 'root', glob: 'a**b' }])), 'POLICY_GLOBSTAR', 'POLICY_GLOBSTAR: patterns[0].glob must use * or a separate **/ component; ** must be a whole component'],
        ];
        for (const [label, text, code, message] of bad) {
          const root = path.join(dir, `bad-${code}`);
          putFile(projPath(root, T_POLICY), text);
          for (const sub of ['json', 'codex-snippet', 'pathspec']) {
            const r = kit.render(elsewhere, [sub, '--project', root]);
            expectF(check, `${label} (${sub})`, r, { code, exit: 3, error: message });
          }
        }
      });
      await step('an unreadable installed policy (a directory in its place) is POLICY_IO (F, exit 2)', async () => {
        const root = path.join(dir, 'io');
        fs.mkdirSync(projPath(root, T_POLICY), { recursive: true });
        const r = kit.render(elsewhere, ['json', '--project', root]);
        expectF(check, 'unreadable policy', r, { code: 'POLICY_IO', exit: 2, error: /^POLICY_IO: cannot read security policy: \S+$/ });
      });
      if (lib && needFns(failures, lib, ['loadEffectivePolicy']) && c1) {
        await step('lib.loadEffectivePolicy: the skill defaults, an installed policy, a fall-back only for an absent file, errors without fall-back', async () => {
          const load = lib.loadEffectivePolicy;
          const skill = load(null);
          check(eq(Object.keys(skill), ['source', 'sourceSchema', 'policy', 'effectivePatterns']), 'the result holds source, sourceSchema, policy, effectivePatterns', Object.keys(skill));
          const wantSkill = c1.readSecurityPolicy(readJson(path.join(context.skillRoot, 'data', 'secret-paths.json')));
          check(skill.source === 'skill' && skill.sourceSchema === 1 && eq(skill.policy, wantSkill.policy) && eq(skill.effectivePatterns, wantSkill.effectivePatterns), 'no root loads the shipped defaults: C1 result, sourceSchema 1, source "skill"', { source: skill.source, schema: skill.sourceSchema });
          const installed = load(project);
          const wantProject = c1.readSecurityPolicy(policy);
          check(installed.source === 'project' && installed.sourceSchema === 2 && eq(installed.policy, wantProject.policy) && eq(installed.effectivePatterns, wantProject.effectivePatterns), 'a root with an installed policy loads it (source "project"), with the C1 source references', { source: installed.source, schema: installed.sourceSchema });
          check(installed.effectivePatterns.every((e) => Array.isArray(e.sources) && e.sources.length >= 1), 'effective patterns keep their source references');
          const bare = load(path.join(dir, 'bare'));
          check(bare.source === 'skill' && eq(bare.policy, wantSkill.policy), 'an absent installed policy falls back to the skill (no Git is needed to find the root)', bare.source);
          check(!(installed && typeof installed.then === 'function'), 'the loader is synchronous');
          const mutated = clone(installed);
          mutated.policy.patterns.push({ anchor: 'any', glob: '**/zz' });
          check(eq(load(project).policy, wantProject.policy), 'mutating a returned result never affects a later load');
          await expectErr(check, 'a malformed installed policy does not fall back', () => load(path.join(dir, 'bad-POLICY_JSON')), 'POLICY_JSON', 'POLICY_JSON: policy text must be valid JSON');
          await expectErr(check, 'an unreadable installed policy', () => load(path.join(dir, 'io')), 'POLICY_IO');
        });
      }
    });
  });
}

// ================================================ R74/C3/rendering ====
// Plan 3.3 and 4.3: the C1 shared corpus rendered, first-source spelling, no case companions, schema-1 adaptation, the template, the depth rules.
const CORPUS_FILE = (context) => path.join(context.skillRoot, 'tests', 'fixtures', 'security-policy-corpus.json');
async function rendering(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const m = await needSafeScript(failures, context, 'render-permissions.mjs');
    const kit = makeKit(context, check);
    if (m && needFns(failures, m, ['renderSecurityControls'])) {
      const render = m.renderSecurityControls;
      await step('every valid entry of the shared C1 corpus renders its A1 forms: one identity, one rule per renderer', async () => {
        const corpus = readJson(CORPUS_FILE(context));
        if (!corpus || !Array.isArray(corpus.matches)) { check(false, 'the shared corpus is readable'); return; }
        const seen = new Set();
        let rows = 0;
        for (const row of corpus.matches) {
          const k = JSON.stringify(row.entry);
          if (seen.has(k)) continue;
          seen.add(k);
          rows++;
          const policy = pol2([row.entry]);
          const r = await attempt(() => render(deepFreeze(clone(policy))));
          if (r.threw) { check(false, `corpus ${row.id} renders`, errMsg(r.error)); continue; }
          const out = r.value;
          const ok = eq(out.claude.readDeny, [`Read(${row.entry.anchor === 'root' ? '/' : ''}${row.entry.glob})`]) && eq(out.gitPathspecExcludes, [`:(exclude,glob,icase)${row.entry.glob}`])
            && countOf(out.codexSnippet, `${JSON.stringify(row.entry.glob)} = "deny"`) === 2 && out.codexSnippet === expectedControls(policy).codexSnippet;
          check(ok, `corpus ${row.id} (${row.entry.anchor} ${JSON.stringify(row.entry.glob)}): one identity with the stored spelling in every renderer`, { read: out.claude.readDeny, git: out.gitPathspecExcludes });
        }
        check(rows >= 30, 'the corpus yields at least thirty distinct entries', rows);
      });
      await step('every rejected entry of the corpus fails with C1\'s code and message at policy location patterns[0]', async () => {
        const corpus = readJson(CORPUS_FILE(context));
        if (!corpus || !Array.isArray(corpus.rejectedEntries)) { check(false, 'the shared corpus holds rejectedEntries'); return; }
        for (const row of corpus.rejectedEntries) {
          const message = row.message.replace(/^([A-Z_]+): entry/, '$1: patterns[0]');
          await expectErr(check, `corpus ${row.id}`, () => render(pol2([row.entry])), row.code, message);
        }
      });
      await step('mixed-case duplicates: the first source spelling wins in every renderer, in both source orders and within one list', async () => {
        for (const [label, policy, spelling] of [
          ['managed upper, project lower', pol2([{ anchor: 'any', glob: '**/.ENV.*' }], [{ anchor: 'any', glob: '**/.env.*' }]), '**/.ENV.*'],
          ['managed lower, project upper', pol2([{ anchor: 'any', glob: '**/.env.*' }], [{ anchor: 'any', glob: '**/.ENV.*' }]), '**/.env.*'],
          ['two managed spellings', pol2([{ anchor: 'any', glob: '**/*.PEM' }, { anchor: 'any', glob: '**/*.pem' }]), '**/*.PEM'],
          ['root identities', pol2([{ anchor: 'root', glob: 'ENV/**' }], [{ anchor: 'root', glob: 'env/**' }]), 'ENV/**'],
        ]) {
          const out = await runPure(check, label, render, policy);
          if (!out) continue;
          const slash = policy.patterns[0].anchor === 'root' ? '/' : '';
          check(out.claude.readDeny.length === 1 && out.claude.readDeny[0] === `Read(${slash}${spelling})`, `${label}: one Read deny with the first spelling`, out.claude.readDeny);
          check(eq(out.gitPathspecExcludes, [`:(exclude,glob,icase)${spelling}`]) && countOf(out.codexSnippet, `"${spelling}" = "deny"`) === 2, `${label}: one Git exclusion and one Codex key per profile, same spelling`, out.gitPathspecExcludes);
        }
      });
      await step('no case companions and no extra rule groups: an upper-case entry renders exactly itself', async () => {
        const policy = pol2([{ anchor: 'any', glob: '**/.ENV' }, { anchor: 'root', glob: 'Secrets/**' }]);
        const out = await runPure(check, 'upper-case entries', render, policy);
        if (!out) return;
        check(eq(out.claude.readDeny, ['Read(**/.ENV)', 'Read(/Secrets/**)']), 'no lowercase companion Read deny', out.claude.readDeny);
        check(out.gitPathspecExcludes.length === 2 && out.claude.permissionsDeny.length === 2 + COMMAND_DENY.length, 'no extra Git line and no extra Claude rule group', out.gitPathspecExcludes);
        check(!/"\*\*\/\.env" = "deny"|"secrets\/\*\*" = "deny"/.test(out.codexSnippet), 'no lowercase Codex key');
      });
      await step('a schema-1 policy renders by adapting it, without writing; schema-1 anchors are inferred', async () => {
        const v1 = { schema: 1, patterns: [{ glob: '**/*.pem', kind: 'key' }, { glob: 'env/**' }], projectPatterns: [{ glob: 'cert/**' }], codexGlobScanMaxDepth: 9, contentRisk: { globs: [] } };
        const out = await runPure(check, 'schema 1', render, v1);
        if (out) {
          check(eq(out.claude.readDeny, ['Read(**/*.pem)', 'Read(/env/**)', 'Read(/cert/**)']), 'any for a **/ glob, root otherwise', out.claude.readDeny);
          checkControls(check, 'schema 1', out, v1);
        }
      });
      await step('the complete snippet is the preserved template with only the permitted substitutions (LF, one final LF), for several policies', async () => {
        for (const [label, policy] of [
          ['the 20-entry shipped document', expectedShippedDoc(context)],
          ['depth 12 with a project entry', pol2([{ anchor: 'any', glob: '**/.env*' }], [{ anchor: 'root', glob: 'env/**' }], { codexGlobScanMaxDepth: 12 })],
          ['depth 1', pol2([{ anchor: 'any', glob: '**/k' }], [], { codexGlobScanMaxDepth: 1 })],
          ['depth 100', pol2([{ anchor: 'any', glob: '**/k' }], [], { codexGlobScanMaxDepth: 100 })],
        ]) {
          const out = await runPure(check, label, render, policy);
          if (!out) continue;
          check(out.codexSnippet === expectedControls(policy).codexSnippet, `${label}: the snippet equals the template with the v3 labels, the generated keys and the depth`, out.codexSnippet.slice(0, 200));
          check(!out.codexSnippet.includes('\r') && out.codexSnippet.endsWith('\n') && !out.codexSnippet.endsWith('\n\n'), `${label}: LF only and exactly one final LF`);
          check(!out.codexSnippet.includes('project-setup v2'), `${label}: no v2 label remains`);
          check(countOf(out.codexSnippet, `glob_scan_max_depth = ${hasOwn(policy, 'codexGlobScanMaxDepth') ? policy.codexGlobScanMaxDepth : 6}`) === 2, `${label}: the depth appears once per profile`);
        }
        const missing = render(pol2([]));
        check(countOf(missing.codexSnippet, 'glob_scan_max_depth = 6') === 2, 'a missing codexGlobScanMaxDepth means 6');
      });
      await step('an invalid depth is RENDER_DEPTH; the boundary values 1 and 100 are accepted', async () => {
        for (const bad of [0, 101, 2.5, -3, '6', true, 1000]) {
          await expectErr(check, `depth ${show(bad)}`, () => render(pol2([], [], { codexGlobScanMaxDepth: bad })), 'RENDER_DEPTH', 'RENDER_DEPTH: codexGlobScanMaxDepth must be an integer from 1 through 100');
        }
        for (const good of [1, 100]) {
          const r = await attempt(() => render(pol2([], [], { codexGlobScanMaxDepth: good })));
          check(!r.threw && countOf(r.value.codexSnippet, `glob_scan_max_depth = ${good}`) === 2, `depth ${good} is accepted`, r.threw ? errMsg(r.error) : null);
        }
      });
    }
    await withScratch(context, 'r74', async (dir) => {
      const project = path.join(dir, 'proj');
      putFile(projPath(project, T_POLICY), jsonText(pol2([{ anchor: 'any', glob: '**/k' }])));
      await step('the CLI rejects duplicate, unknown and incomplete arguments with the exact RENDER_USAGE (F, exit 1)', async () => {
        const bad = [['bogus'], ['json', 'json'], ['json', 'pathspec'], ['--project'], ['json', '--project'], ['--project', project, '--project', project], ['json', '--unknown'], ['json', '--project', project, 'extra'], ['--project', project, 'bogus', 'x'], ['codex-snippet', '--project', '']];
        for (const args of bad) {
          const r = kit.render(dir, args);
          expectF(check, `render ${args.join(' ')}`, r, { code: 'RENDER_USAGE', exit: 1, error: MSG.RENDER_USAGE });
        }
        const ok = kit.render(dir, ['--project', project]);
        check(ok.code === 0 && ok.json && ok.json.ok === true, 'a lone --project is the json subcommand', ok.stdout.slice(0, 120));
      });
    });
  });
}

// ===================================== R97/C3/environment-controls ====
// Plan 3.2 and 4.3: the shipped document, the rendered coverage of .env* / *.cert / .htpasswd, paired with C1's matching results.
async function environmentControls(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const m = await needSafeScript(failures, context, 'render-permissions.mjs');
    const c1 = await needPolicyModule(failures, context);
    const kit = makeKit(context, check);
    const want = expectedShippedDoc(context);
    await step('data/secret-paths.json is the 20-entry schema-1 document of plan 3.2: new coverage at indices 0, 7 and 18, nothing else changed', async () => {
      const file = readJson(path.join(context.skillRoot, 'data', 'secret-paths.json'));
      check(file && file.schema === 1 && Array.isArray(file.patterns) && file.patterns.length === 20, 'schema 1 with 20 entries', file && file.patterns && file.patterns.length);
      check(eq(file, want), 'the document equals the plan 3.2 construction from the v2 snapshot (first two entries replaced by **/.env*, *.cert after *.cer, .htpasswd after .npmrc, $comment replaced, everything else preserved)', file && file.patterns && file.patterns.map((e) => e.glob));
      const globs = (file && file.patterns ? file.patterns : []).map((e) => e.glob);
      check(globs[0] === '**/.env*' && globs[7] === '**/*.cert' && globs[18] === '**/.htpasswd' && !globs.includes('**/.env') && !globs.includes('**/.env.*'), 'one **/.env* and no old environment entry; coverage at indices 0, 7 and 18', globs);
      const snapshot = readJson(path.join(context.skillRoot, 'data', 'secret-paths-v2.0.0.json'));
      check(snapshot && snapshot.patterns.length === 19 && snapshot.patterns[0].glob === '**/.env' && snapshot.patterns[1].glob === '**/.env.*', 'the v2 snapshot is untouched (19 entries, the two old environment entries first)');
    });
    if (m && needFns(failures, m, ['renderSecurityControls'])) {
      await step('the rendered forms of .env*, *.cert and .htpasswd are exact in every renderer', async () => {
        const out = await runPure(check, 'shipped document', m.renderSecurityControls, want);
        if (!out) return;
        for (const [glob, label] of [['**/.env*', '.env*'], ['**/*.cert', '*.cert'], ['**/.htpasswd', '.htpasswd']]) {
          check(out.claude.readDeny.includes(`Read(${glob})`), `${label}: Read(${glob})`);
          check(out.gitPathspecExcludes.includes(`:(exclude,glob,icase)${glob}`), `${label}: :(exclude,glob,icase)${glob}`);
          check(countOf(out.codexSnippet, `"${glob}" = "deny"`) === 2, `${label}: the Codex key in both profiles`);
        }
        check(!out.claude.readDeny.includes('Read(**/.env)') && !out.claude.readDeny.includes('Read(**/.env.*)'), 'no old environment rule is rendered from the new defaults');
        check(out.claude.readDeny.length === 20 && out.gitPathspecExcludes.length === 20, 'one rule per identity, 20 of them', out.claude.readDeny.length);
        checkControls(check, 'shipped document', out, want);
      });
    }
    if (c1 && needFns(failures, c1, ['matchesPolicyPath', 'readSecurityPolicy'])) {
      await step('rendered coverage is paired with C1\'s matching results for the environment variants (coverage, not host enforcement)', async () => {
        const matches = (p, policy = want) => c1.matchesPolicyPath(p, policy);
        for (const p of ['.env', '.env.local', '.envrc', '.environment', '.env-prod', '.env.example', 'src/.env', 'src/deep/.env.local', 'SRC/.ENV.Local', 'src/.EnVrc']) check(matches(p) === true, `${p} is covered by the new defaults`);
        for (const p of ['env', 'dotenv', 'x.env', '.en', '.envdir/file.txt', 'src/env/file']) check(matches(p) === false, `${p} is not covered`);
        for (const p of ['a.cert', 'src/a.CERT', '.htpasswd', 'dir/.HTPASSWD', 'x/.htpasswd']) check(matches(p) === true, `${p} is covered (new coverage)`);
        const v2 = readJson(path.join(context.skillRoot, 'data', 'secret-paths-v2.0.0.json'));
        check(matches('.env', v2) === true && matches('.env.local', v2) === true && matches('.envrc', v2) === false && matches('.environment', v2) === false && matches('a.cert', v2) === false && matches('.htpasswd', v2) === false, 'the v2 defaults leave .envrc, .environment, *.cert and .htpasswd uncovered: the gap C3 closes');
        const eff = effectiveEntries(want);
        check(eff.length === 20 && eff.every((e) => e.anchor === 'any'), 'twenty any-anchored identities');
        check(c1.readSecurityPolicy(want).effectivePatterns.length === 20, 'C1 sees the same identity count');
      });
    }
    await withScratch(context, 'r97', async (dir) => {
      await step('the CLI renders the shipped defaults with the new coverage and without the old environment rules', async () => {
        const r = kit.render(dir, ['json']);
        const j = r.json || {};
        check(r.code === 0 && j.ok === true && j.source === 'data/secret-paths.json', 'json exits 0 with the shipped source', { code: r.code, out: r.stdout.slice(0, 200) });
        const read = (j.claude && j.claude.readDeny) || [];
        check(read.includes('Read(**/.env*)') && read.includes('Read(**/*.cert)') && read.includes('Read(**/.htpasswd)') && !read.includes('Read(**/.env)') && !read.includes('Read(**/.env.*)'), 'the new Read denies and no old ones', read);
        const p = kit.render(dir, ['pathspec']);
        check(p.code === 0 && p.stdout.split('\n').includes(':(exclude,glob,icase)**/.env*') && p.stdout.split('\n').includes(':(exclude,glob,icase)**/.htpasswd'), 'the pathspec output carries the new exclusions', p.stdout.slice(0, 200));
      });
    });
  });
}

// ======================================== migration classification helpers ====
const FIXTURE_FILE = (context) => path.join(context.skillRoot, 'tests', 'fixtures', 'rc1-migrations.json');
const idKeys = (list) => sorted((list || []).map(idKey));
const reportHashOf = (report) => sha(Buffer.from(jsonText(report), 'utf8'));
// The first path at which two JSON values differ (a twenty-row report is unreadable as one diagnostic).
function diffPath(a, b, where = '$') {
  if (eq(a, b)) return null;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return `${where}: ${show(a).slice(0, 120)} vs ${show(b).slice(0, 120)}`;
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  for (const k of keys) { const d = diffPath(a[k], b[k], `${where}.${k}`); if (d) return d; }
  return where;
}
function loadMigrationFixture(check, context) {
  const f = readJson(FIXTURE_FILE(context));
  check(f && f.schema === 1 && Array.isArray(f.cases), 'tests/fixtures/rc1-migrations.json is readable with schema 1 and a cases array');
  return f && Array.isArray(f.cases) ? f : null;
}
const REQUIRED_CASE_IDS_C3 = ['known-unchanged', 'current-shipped', 'missing-record', 'unrecognized-hash', 'malformed-hash', 'recorded-schema1', 'metadata-edit', 'changed-glob', 'project-move', 'deleted-base', 'old-env-omission', 'replacement-omitted', 'unknown-current-matches-v2', 'preserved-fields', 'duplicate-entries', 'contradictory-decisions'];
// Runs one fixture case against the pure API. Returns { report, result } (either may be null). "@report" in the decisions is the identity of the
// implementation's own report, an input token; the report itself is compared with the literal expectation.
async function runMigrationCase(check, mig, c, label) {
  const exp = c.expected;
  if (exp.error && c.decisions === null) {
    await expectErr(check, `${label}: classification`, () => mig.classifySecurityMigration(deepFreeze(clone(c.input))), exp.error.code, exp.error.message);
    return { report: null, result: null };
  }
  const report = await runPure(check, `${label}: classification`, mig.classifySecurityMigration, c.input);
  if (!report) return { report: null, result: null };
  if (exp.report !== null) check(eq(report, exp.report), `${label}: the report equals the literal expectation`, diffPath(report, exp.report));
  if (c.decisions === null) return { report, result: null };
  const dec = clone(c.decisions);
  if (dec.reportSha256 === '@report') dec.reportSha256 = reportHashOf(report);
  if (exp.error) {
    await expectErr(check, `${label}: resolution`, () => mig.resolveSecurityMigration(deepFreeze(clone(c.input)), deepFreeze(clone(dec))), exp.error.code, exp.error.message);
    return { report, result: null };
  }
  const decFrozen = deepFreeze(clone(dec));
  const result = await runPure(check, `${label}: resolution`, (i) => mig.resolveSecurityMigration(i, decFrozen), c.input);
  if (!result) return { report, result: null };
  check(eq(Object.keys(result).sort(), ['managed', 'omissions', 'policy', 'report']), `${label}: the result holds policy, managed, omissions and report`, Object.keys(result));
  check(eq(result.report, report), `${label}: the resolution carries the same report`, diffPath(result.report, report));
  if (exp.policy !== null) check(eq(result.policy, exp.policy), `${label}: the resolved policy`, diffPath(result.policy, exp.policy));
  if (exp.managed !== null) check(eq(result.managed, exp.managed), `${label}: the resolved managed list`, diffPath(result.managed, exp.managed));
  if (exp.omissions !== null) {
    check(result.omissions && eq(Object.keys(result.omissions), ['patterns']) && Array.isArray(result.omissions.patterns), `${label}: omissions holds only patterns`, result.omissions);
    check(eq(idKeys(result.omissions && result.omissions.patterns), idKeys(exp.omissions.patterns)), `${label}: the recorded omissions have exactly the expected identities`, result.omissions && result.omissions.patterns);
  }
  const p = result.policy;
  if (p) {
    check(p.schema === 2 && Array.isArray(p.patterns) && Array.isArray(p.projectPatterns), `${label}: a schema-2 policy with both lists`, p && p.schema);
    check([...(p.patterns || []), ...(p.projectPatterns || [])].every((e) => e && (e.anchor === 'any' || e.anchor === 'root')), `${label}: every entry has an explicit anchor`);
    check(eq(result.managed && result.managed.patterns, p.patterns) && result.managed.schema === 2, `${label}: managed is the schema-2 list of the resolved managed entries`);
  }
  return { report, result };
}
const byId = (fixture) => new Map(fixture.cases.map((c) => [c.id, c]));
// A valid MigrationInput for the decision-error matrix, taken from the fixture (a clean v2 policy with its recorded hash).
const decisionsFor = (c, report, patch = {}) => ({ ...clone(c.decisions), reportSha256: reportHashOf(report), ...patch });

// ============================================== R78/C3/baseline ====
// Plan 3.4 and 4.4: how an installed record establishes the baseline; the malformed-record corner; the CLI report on a genuine v2 install.
const BASELINE_EXPECT = {
  'known-unchanged': 'v2.0.0', 'current-shipped': 'shipped', 'missing-record': 'unknown', 'unrecognized-hash': 'unknown', 'unknown-current-matches-v2': 'unknown',
  'recorded-schema1': 'recorded', 'recorded-schema2': 'recorded', fresh: 'fresh', 'missing-policy-known-record': 'v2.0.0', 'hashes-agree': 'v2.0.0',
};
async function baseline(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mig = await needSafeScript(failures, context, 'migrate-security-paths.mjs');
    const fixture = loadMigrationFixture(check, context);
    const kit = makeKit(context, check);
    if (mig && needFns(failures, mig, ['classifySecurityMigration', 'resolveSecurityMigration']) && fixture) {
      const cases = byId(fixture);
      await step('the fixture has every required case ID of plan 4.2', async () => {
        for (const id of REQUIRED_CASE_IDS_C3) check(cases.has(id), `the fixture has case ${id}`);
        check(new Set(fixture.cases.map((c) => c.id)).size === fixture.cases.length, 'no duplicate case ID');
      });
      await step('each baseline kind: v2.0.0, shipped, recorded (both policy schemas), unknown, fresh, and a known record without a policy', async () => {
        for (const [id, kind] of Object.entries(BASELINE_EXPECT)) {
          const c = cases.get(id);
          if (!c) { check(false, `case ${id} exists`); continue; }
          const { report } = await runMigrationCase(check, mig, c, id);
          check(report && report.baseline === kind, `${id}: baseline ${kind}`, report && report.baseline);
          if (!report) continue;
          check(report.baselineSha256 === (kind === 'v2.0.0' ? c.input.baselineSha256 : kind === 'shipped' ? c.input.desiredSha256 : null), `${id}: baselineSha256 is the v2 hash for v2.0.0, the desired hash for shipped, otherwise null`, report.baselineSha256);
          check(report.sourceSchema === (c.input.policy === null ? null : c.input.policy.schema), `${id}: sourceSchema is the current policy's schema, or null when absent`, report.sourceSchema);
        }
      });
      await step('a known shipped installation needs no unknown-baseline decisions; a clean v2 policy needs exactly coverage 0, 7 and 18', async () => {
        const shipped = cases.get('current-shipped');
        const rep = shipped && (await runMigrationCase(check, mig, shipped, 'current-shipped')).report;
        check(rep && eq(rep.requiredDecisions, []) && eq(rep.coverage, []) && rep.entries.every((e) => e.classification === 'unchanged'), 'current-shipped: twenty unchanged rows, no coverage, no decision at all', rep && rep.requiredDecisions);
        const clean = cases.get('known-unchanged');
        const crep = clean && (await runMigrationCase(check, mig, clean, 'known-unchanged')).report;
        check(crep && eq(crep.requiredDecisions.map((d) => d.id), ['coverage:0', 'coverage:7', 'coverage:18']) && crep.requiredDecisions.every((d) => eq(d.choices, ['include', 'omit'])), 'known-unchanged: coverage:0, coverage:7 and coverage:18, each with include and omit', crep && crep.requiredDecisions);
      });
      await step('a missing record, an unrecognized 64-hex record and bytes that equal v2 all give the unknown treatment: every current row is a managed edit with before null', async () => {
        for (const id of ['missing-record', 'unrecognized-hash', 'unknown-current-matches-v2']) {
          const c = cases.get(id);
          const rep = c && (await runMigrationCase(check, mig, c, id)).report;
          check(rep && rep.entries.length > 0 && rep.entries.every((e) => e.classification === 'managed-edit' && e.before === null && e.current !== null), `${id}: every row is managed-edit with before null`, rep && rep.entries.slice(0, 2));
          check(rep && rep.requiredDecisions.filter((d) => d.id.startsWith('current:')).every((d) => eq(d.choices, ['keep', 'project', 'omit'])), `${id}: unknown managed edits offer keep, project and omit only`);
        }
      });
      await step('a full policy record with a missing or malformed hash is MANIFEST_INVALID, never unknown-baseline migration', async () => {
        for (const id of ['malformed-hash', 'malformed-hash-missing']) {
          const c = cases.get(id);
          if (!c) { check(false, `case ${id} exists`); continue; }
          await runMigrationCase(check, mig, c, id);
        }
      });
      await step('a manifest or a policy that fails its shared reader propagates that reader\'s error', async () => {
        const base = clone(cases.get('known-unchanged').input);
        const bad = (patch) => deepFreeze(clone({ ...base, ...patch }));
        await expectErr(check, 'unsupported manifest schema', () => mig.classifySecurityMigration(bad({ manifest: { ...base.manifest, schema: 4 } })), 'MANIFEST_SCHEMA', MSG.MANIFEST_SCHEMA);
        await expectErr(check, 'a manifest that is not an object', () => mig.classifySecurityMigration(bad({ manifest: 'x' })), 'MANIFEST_INVALID', MSG.MANIFEST_INVALID);
        await expectErr(check, 'a policy with an unsupported schema', () => mig.classifySecurityMigration(bad({ policy: { schema: 3, patterns: [] } })), 'POLICY_SCHEMA', 'POLICY_SCHEMA: policy.schema must be 1 or 2');
        await expectErr(check, 'a policy entry C1 rejects', () => mig.classifySecurityMigration(bad({ policy: { schema: 2, patterns: [{ anchor: 'root', glob: 'a**b' }], projectPatterns: [] } })), 'POLICY_GLOBSTAR', 'POLICY_GLOBSTAR: patterns[0].glob must use * or a separate **/ component; ** must be a whole component');
      });
      await step('the input must hold exactly the documented fields', async () => {
        const base = clone(cases.get('known-unchanged').input);
        const code = 'MIGRATION_INPUT';
        const message = 'MIGRATION_INPUT: migration input must contain the documented fields';
        for (const [label, input] of [['null', null], ['an array', []], ['a string', 'x'], ['an empty object', {}], ['an extra field', { ...base, extra: 1 }]]) {
          await expectErr(check, `input ${label}`, () => mig.classifySecurityMigration(deepFreeze(clone(input))), code, message);
        }
        for (const field of ['policy', 'manifest', 'baselinePolicy', 'baselineSha256', 'desiredPolicy', 'desiredSha256']) {
          const input = clone(base);
          delete input[field];
          await expectErr(check, `input without ${field}`, () => mig.classifySecurityMigration(deepFreeze(input)), code, message);
        }
        for (const [label, patch] of [['a malformed baseline hash', { baselineSha256: 'ABC' }], ['an upper-case desired hash', { desiredSha256: 'A'.repeat(64) }], ['an invalid baseline policy', { baselinePolicy: { schema: 3, patterns: [] } }], ['an invalid desired policy', { desiredPolicy: { schema: 1, patterns: [{ glob: 'a**b' }] } }]]) {
          // PLAN-GAP: the pure API "validates its supplied data" but 3.12 pins MIGRATION_BASELINE_INVALID only for missing or invalid shipped files, and the
          // MIGRATION_INPUT text names "the documented fields". The code for invalid baseline or desired data is therefore one of the two, or C1's own.
          await expectErrAny(check, `${label}`, () => mig.classifySecurityMigration(deepFreeze(clone({ ...base, ...patch }))), ['MIGRATION_INPUT', 'MIGRATION_BASELINE_INVALID', 'POLICY_SCHEMA', 'POLICY_ANCHOR', 'POLICY_GLOBSTAR']);
        }
      });
    }
    // ------------------------------------------------ the CLI on a genuine v2 installation ----
    const v2 = await useBase(failures, 'genuine v2', getV2Base, context);
    if (v2) {
      await withScratch(context, 'r78b', async (dir) => {
        const fixtureCases = fixture ? byId(fixture) : new Map();
        const root = cloneBase(dir, v2, 'p');
        const facts = baseFacts(root);
        await step('report --project on a genuine v2 install: the exact envelope, baseline v2.0.0, recorded denies, no file created, no Git', async () => {
          const before = projectSnapshot(root);
          const shim = makeGitShim(context, dir);
          const r = kit.report(root, { env: shim.env });
          check(r.code === 0 && r.stderr === '' && r.json && fmtOk(r), 'exit 0, empty stderr, two-space JSON with one final LF', { code: r.code, out: r.stdout.slice(0, 300), err: r.stderr.slice(0, 200) });
          const j = r.json || {};
          check(eq(Object.keys(j), ['ok', 'report', 'reportSha256']) && j.ok === true, 'the envelope is { ok, report, reportSha256 } in that order', Object.keys(j));
          check(j.report && j.reportSha256 === reportHashOf(j.report), 'reportSha256 is the SHA-256 of the two-space JSON of the report', j.reportSha256);
          const base = fixtureCases.get('known-unchanged');
          if (base && j.report) {
            const want = { ...clone(base.expected.report), retainedManagedDenies: facts.deny };
            check(eq(j.report, want), 'the report is the clean v2 report: 19 unchanged rows, coverage 0, 7 and 18, the whole recorded deny list retained', diffPath(j.report, want));
            check(j.report.baselineSha256 === facts.policyRec.sha256, 'baselineSha256 is the hash the v2 manifest recorded for the policy (the normalized hash of the snapshot bytes)', j.report.baselineSha256);
          }
          check(projectSnapshot(root) === before, 'no directory, lock, draft, plan or journal was created');
          check(shim.records().length === 0, 'no Git command was started', shim.records());
          const control = kit.begin(root, 'run-c3-ctl') && kit.prepare(root, 'run-c3-ctl', { env: shim.env });
          check(control && shim.records().length > 0, 'control: the shim does intercept the Git use of prepare', shim.records().length);
        });
        await step('a current shipped installation reports baseline shipped; changing the record or deleting it reports unknown, whatever the policy bytes are', async () => {
          const shippedRoot = cloneBase(dir, v2, 'shipped');
          const shippedBytes = readBytes(path.join(context.skillRoot, 'data', 'secret-paths.json'));
          if (!shippedBytes) { check(false, 'data/secret-paths.json is readable'); return; }
          putFile(projPath(shippedRoot, T_POLICY), shippedBytes);
          const m = readManifestFile(shippedRoot);
          m.files[T_POLICY] = { ownership: 'full', sha256: NH(shippedBytes) };
          putFile(manifestPath(shippedRoot), jsonText(m));
          commitAll(context, shippedRoot, 'shipped policy');
          const r = kit.report(shippedRoot);
          check(r.code === 0 && r.json && r.json.report && r.json.report.baseline === 'shipped' && r.json.report.baselineSha256 === NH(shippedBytes) && eq(r.json.report.requiredDecisions, []), 'baseline shipped, its hash, and no required decision', r.json && r.json.report && { baseline: r.json.report.baseline, req: r.json.report.requiredDecisions.length });
          const unrec = cloneBase(dir, v2, 'unrecognized');
          const um = readManifestFile(unrec);
          um.files[T_POLICY] = { ownership: 'full', sha256: H64('c') };
          putFile(manifestPath(unrec), jsonText(um));
          const ur = kit.report(unrec);
          check(ur.code === 0 && ur.json && ur.json.report.baseline === 'unknown' && ur.json.report.entries.every((e) => e.classification === 'managed-edit' && e.before === null), 'an unrecognized hash on bytes that equal v2 stays unknown', ur.json && ur.json.report && ur.json.report.baseline);
          const noRec = cloneBase(dir, v2, 'norecord');
          const nm = readManifestFile(noRec);
          delete nm.files[T_POLICY];
          putFile(manifestPath(noRec), jsonText(nm));
          const nr = kit.report(noRec);
          check(nr.code === 0 && nr.json && nr.json.report.baseline === 'unknown', 'a valid manifest without a policy record is unknown', nr.json && nr.json.report && nr.json.report.baseline);
        });
        await step('invalid manifest JSON and an unsupported manifest schema use their pinned report and stage errors; prepare refuses a malformed hash with the exact envelope and writes no plan', async () => {
          const badJson = cloneBase(dir, v2, 'badjson');
          putFile(manifestPath(badJson), '{ not json');
          expectF(check, 'report: invalid manifest JSON', kit.report(badJson), { code: 'MANIFEST_INVALID', exit: 3, error: MSG.MANIFEST_INVALID });
          const badSchema = cloneBase(dir, v2, 'badschema');
          const sm = readManifestFile(badSchema); sm.schema = 4;
          putFile(manifestPath(badSchema), jsonText(sm));
          expectF(check, 'report: unsupported manifest schema', kit.report(badSchema), { code: 'MANIFEST_SCHEMA', exit: 3, error: MSG.MANIFEST_SCHEMA });
          for (const [label, r, code, msg] of [['invalid JSON', badJson, 'MANIFEST_INVALID', MSG.MANIFEST_INVALID], ['unsupported schema', badSchema, 'MANIFEST_SCHEMA', MSG.MANIFEST_SCHEMA]]) {
            if (!kit.begin(r, 'run-c3-st')) continue;
            putRequest(r, 'run-c3-st', T_DECISIONS, { schema: 1, reportSha256: H64('0'), entries: [], coverage: [], denyOmissions: [], dropDenyOwnership: [], overrideUserExceptions: false });
            expectF(check, `stage: ${label}`, kit.stage(r, 'run-c3-st'), { code, exit: 3, error: msg });
          }
          const bad = cloneBase(dir, v2, 'badhash');
          const bm = readManifestFile(bad);
          bm.files[T_POLICY] = { ownership: 'full', sha256: 'not-a-hash' };
          putFile(manifestPath(bad), jsonText(bm));
          commitAll(context, bad, 'malformed hash');
          check(kit.begin(bad, 'run-c3-mh'), 'the run starts');
          const p = kit.prepare(bad, 'run-c3-mh');
          expectP(check, 'prepare: a malformed policy hash', p, [{ target: T_MANIFEST, code: 'MANIFEST_INVALID', error: MSG.MANIFEST_INVALID }]);
          check(!exists(runFile(bad, 'run-c3-mh', 'plan.json')), 'prepare wrote no plan');
          const sch = cloneBase(dir, v2, 'badschema2');
          putFile(manifestPath(sch), jsonText(sm));
          commitAll(context, sch, 'bad schema');
          kit.begin(sch, 'run-c3-ms');
          expectP(check, 'prepare: an unsupported manifest schema', kit.prepare(sch, 'run-c3-ms'), [{ target: T_MANIFEST, code: 'MANIFEST_SCHEMA', error: MSG.MANIFEST_SCHEMA }]);
          const nj = cloneBase(dir, v2, 'badjson-prepare');
          putFile(manifestPath(nj), '{ not json');
          commitAll(context, nj, 'invalid manifest JSON');
          kit.begin(nj, 'run-c3-mj');
          expectP(check, 'prepare: invalid manifest JSON', kit.prepare(nj, 'run-c3-mj'), [{ target: T_MANIFEST, code: 'MANIFEST_INVALID', error: MSG.MANIFEST_INVALID }]);
          check(!exists(runFile(nj, 'run-c3-mj', 'plan.json')), 'prepare wrote no plan for an invalid manifest');
        });
        await step('the migration CLI accepts exactly report --project and stage --project --run-id: anything else is MIGRATION_USAGE (F, exit 1)', async () => {
          const bad = [[], ['report'], ['report', '--project'], ['report', '--project', root, 'extra'], ['report', '--project', root, '--project', root], ['stage', '--project', root], ['stage', '--run-id', 'run-c3-x1'],
            ['stage', '--project', root, '--run-id', 'bad id!'], ['stage', '--project', root, '--run-id', 'a'], ['stage', '--project', root, '--run-id', 'run-c3-x1', '--run-id', 'run-c3-x1'], ['reprt', '--project', root], ['report', '--project', root, '--unknown'], ['report', '--project', root, '--run-id', 'run-c3-x1'], ['stage', '--project', root, '--run-id', 'run-c3-x1', 'extra']];
          for (const args of bad) expectF(check, `migrate ${args.join(' ')}`, kit.migrate(root, args), { code: 'MIGRATION_USAGE', exit: 1, error: MSG.MIGRATION_USAGE });
        });
      });
    }
  });
}

// ============================================== R78/C3/migration ====
// Plan 3.4, 3.5 and 4.4: versioned migration preserves fields, resolves exactly the chosen actions, and refuses bad decisions with the exact errors.
const MIGRATION_CASES = ['known-unchanged', 'metadata-edit', 'metadata-edit-replace', 'metadata-edit-project', 'metadata-edit-omit', 'changed-glob', 'deleted-base', 'deleted-base-omitted', 'preserved-fields', 'duplicate-entries', 'missing-record', 'missing-policy-known-record', 'fresh', 'recorded-schema1', 'current-shipped'];
async function migration(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mig = await needSafeScript(failures, context, 'migrate-security-paths.mjs');
    const fixture = loadMigrationFixture(check, context);
    if (!mig || !needFns(failures, mig, ['classifySecurityMigration', 'resolveSecurityMigration']) || !fixture) return;
    const cases = byId(fixture);
    await step('the clean v2 policy yields unchanged rows, coverage 0, 7 and 18, and resolves to the schema-2 list with the new identities appended', async () => {
      await runMigrationCase(check, mig, cases.get('known-unchanged'), 'known-unchanged');
    });
    await step('a changed note is one managed edit: keep preserves it, replace restores the baseline fields, project and omit remove it from managed with the baseline identity omitted', async () => {
      for (const id of ['metadata-edit', 'metadata-edit-replace', 'metadata-edit-project', 'metadata-edit-omit']) await runMigrationCase(check, mig, cases.get(id), id);
      const rep = (await runMigrationCase(check, mig, cases.get('metadata-edit'), 'metadata-edit (report)')).report;
      check(rep && rep.entries.filter((e) => e.classification === 'managed-edit').length === 1 && rep.entries.filter((e) => e.classification === 'deletion' || e.classification === 'project-addition').length === 0, 'exactly one managed edit and no addition or deletion', rep && rep.entries.map((e) => e.classification));
      check(rep && eq(rep.requiredDecisions[0], { id: 'current:4', choices: ['keep', 'replace', 'project', 'omit'] }), 'a known managed edit offers keep, replace, project, omit in that order', rep && rep.requiredDecisions[0]);
    });
    await step('a changed glob is one project addition plus one deletion, never an edit; a deletion needs restore or omit unless it is already exactly omitted', async () => {
      const rep = (await runMigrationCase(check, mig, cases.get('changed-glob'), 'changed-glob')).report;
      check(rep && rep.entries.map((e) => e.classification).join(',') === 'unchanged,unchanged,unchanged,project-addition,unchanged,deletion' && rep.entries.map((e) => e.id).join(',') === 'current:0,current:1,current:2,current:3,current:4,baseline:3', 'rows appear in current order, then the unmatched baseline rows (current:<index>, baseline:<index>)', rep && rep.entries.map((e) => `${e.id}:${e.classification}`));
      check(rep && eq(rep.requiredDecisions.slice(0, 2), [{ id: 'current:3', choices: ['project', 'keep', 'omit'] }, { id: 'baseline:3', choices: ['restore', 'omit'] }]), 'an addition offers project, keep, omit; a deletion offers restore, omit', rep && rep.requiredDecisions.slice(0, 2));
      await runMigrationCase(check, mig, cases.get('deleted-base'), 'deleted-base');
      const omitted = (await runMigrationCase(check, mig, cases.get('deleted-base-omitted'), 'deleted-base-omitted')).report;
      check(omitted && omitted.entries.some((e) => e.classification === 'deletion') && !omitted.requiredDecisions.some((d) => d.id === 'baseline:4'), 'an already exactly omitted deletion is reported but needs no decision', omitted && omitted.requiredDecisions.map((d) => d.id));
    });
    await step('top-level extensions, contentRisk, depth, entry extensions and existing project entries are preserved exactly', async () => {
      await runMigrationCase(check, mig, cases.get('preserved-fields'), 'preserved-fields');
      await runMigrationCase(check, mig, cases.get('project-move'), 'project-move');
    });
    await step('duplicate entry occurrences are classified one by one with first-unused matching, and the installed deny list keeps its duplicates', async () => {
      await runMigrationCase(check, mig, cases.get('duplicate-entries'), 'duplicate-entries');
    });
    await step('every other fixture resolves exactly as written (unknown, fresh, recorded, shipped and missing-policy corners)', async () => {
      for (const id of MIGRATION_CASES.filter((x) => !['known-unchanged', 'metadata-edit', 'metadata-edit-replace', 'metadata-edit-project', 'metadata-edit-omit', 'changed-glob', 'deleted-base', 'deleted-base-omitted', 'preserved-fields', 'duplicate-entries'].includes(x))) {
        const c = cases.get(id);
        if (!c) { check(false, `case ${id} exists`); continue; }
        await runMigrationCase(check, mig, c, id);
      }
    });
    // ---- decisions ----
    const clean = cases.get('known-unchanged');
    const changed = cases.get('changed-glob');
    if (!clean || !changed) return;
    const cleanReport = mig.classifySecurityMigration(deepFreeze(clone(clean.input)));
    const changedReport = mig.classifySecurityMigration(deepFreeze(clone(changed.input)));
    const resolveOf = (c, report, patch) => () => mig.resolveSecurityMigration(deepFreeze(clone(c.input)), deepFreeze(decisionsFor(c, report, patch)));
    await step('a mismatching report hash is MIGRATION_REPORT_CHANGED', async () => {
      await expectErr(check, 'another report hash', resolveOf(clean, cleanReport, { reportSha256: H64('a') }), 'MIGRATION_REPORT_CHANGED', MSG.REPORT_CHANGED);
      const raw = deepFreeze(decisionsFor(clean, cleanReport));
      check(raw.reportSha256 === sha(Buffer.from(jsonText(cleanReport), 'utf8')), 'the identity of a report is the SHA-256 of its two-space JSON, not of the decision file', raw.reportSha256);
      const r = await attempt(() => mig.resolveSecurityMigration(deepFreeze(clone(clean.input)), raw));
      check(!r.threw, 'the report hash computed from the report is accepted', r.threw ? errMsg(r.error) : null);
    });
    await step('missing required choices are MIGRATION_DECISION_REQUIRED naming the first required ID in report order', async () => {
      await expectErr(check, 'no coverage decision at all', resolveOf(clean, cleanReport, { coverage: [] }), 'MIGRATION_DECISION_REQUIRED', MSG.DECISION_REQUIRED('coverage:0'));
      await expectErr(check, 'only coverage:0 decided', resolveOf(clean, cleanReport, { coverage: [{ id: 'coverage:0', action: 'include' }] }), 'MIGRATION_DECISION_REQUIRED', MSG.DECISION_REQUIRED('coverage:7'));
      await expectErr(check, 'entries come before coverage', resolveOf(changed, changedReport, { entries: [], coverage: changed.decisions.coverage }), 'MIGRATION_DECISION_REQUIRED', MSG.DECISION_REQUIRED('current:3'));
      await expectErr(check, 'a deletion is the second entry decision', resolveOf(changed, changedReport, { entries: [{ id: 'current:3', action: 'keep' }] }), 'MIGRATION_DECISION_REQUIRED', MSG.DECISION_REQUIRED('baseline:3'));
    });
    await step('unknown fields, duplicate or unknown IDs, actions outside the reported choices, decisions for rows needing none and a wrong schema are MIGRATION_DECISIONS', async () => {
      const cov = clean.decisions.coverage;
      const bad = [
        ['an unknown field', { extra: true }], ['a wrong schema number', { schema: 2 }], ['a string schema', { schema: '1' }],
        ['a duplicate coverage ID', { coverage: [...cov, { id: 'coverage:0', action: 'include' }] }], ['an unknown coverage ID', { coverage: [...cov, { id: 'coverage:5', action: 'include' }] }],
        ['an action outside the choices', { coverage: [{ id: 'coverage:0', action: 'keep' }, cov[1], cov[2]] }], ['an unknown action', { coverage: [{ id: 'coverage:0', action: 'maybe' }, cov[1], cov[2]] }],
        ['a decision for an unchanged row', { entries: [{ id: 'current:0', action: 'keep' }] }], ['an entry decision with an unknown ID', { entries: [{ id: 'nope', action: 'keep' }] }],
        ['entries that is not an array', { entries: {} }], ['a row with an extra field', { coverage: [{ id: 'coverage:0', action: 'include', why: 'x' }, cov[1], cov[2]] }],
        ['denyOmissions that is not an array', { denyOmissions: {} }], ['dropDenyOwnership that is not an array of strings', { dropDenyOwnership: [1] }], ['overrideUserExceptions that is not a boolean', { overrideUserExceptions: 'yes' }],
      ];
      for (const [label, patch] of bad) await expectErr(check, label, resolveOf(clean, cleanReport, patch), 'MIGRATION_DECISIONS', MSG.DECISIONS);
      for (const [label, value] of [['null', null], ['a string', 'x'], ['an array', []]]) {
        await expectErr(check, `decisions ${label}`, () => mig.resolveSecurityMigration(deepFreeze(clone(clean.input)), deepFreeze(clone(value))), 'MIGRATION_DECISIONS', MSG.DECISIONS);
      }
      const noHash = decisionsFor(clean, cleanReport); delete noHash.reportSha256;
      await expectErr(check, 'a missing report hash', () => mig.resolveSecurityMigration(deepFreeze(clone(clean.input)), deepFreeze(noHash)), 'MIGRATION_DECISIONS', MSG.DECISIONS);
    });
    await step('contradictory choices are MIGRATION_DECISIONS', async () => {
      await runMigrationCase(check, mig, cases.get('contradictory-decisions'), 'contradictory-decisions');
      // a known baseline entry moved to project cannot also be restored as managed
      const c = cases.get('changed-glob');
      await expectErr(check, 'omit and restore of the same deletion is one decision only', resolveOf(c, changedReport, { entries: [{ id: 'current:3', action: 'keep' }, { id: 'baseline:3', action: 'omit' }, { id: 'baseline:3', action: 'restore' }] }), 'MIGRATION_DECISIONS', MSG.DECISIONS);
    });
    await step('the pure functions are synchronous, leave frozen input untouched and return fresh data', async () => {
      const a = mig.resolveSecurityMigration(deepFreeze(clone(clean.input)), deepFreeze(decisionsFor(clean, cleanReport)));
      const b = mig.resolveSecurityMigration(deepFreeze(clone(clean.input)), deepFreeze(decisionsFor(clean, cleanReport)));
      check(eq(a, b) && a !== b && a.policy !== b.policy && a.policy.patterns[0] !== b.policy.patterns[0], 'equal inputs give equal, unshared results');
      a.policy.patterns.push({ anchor: 'any', glob: '**/zz' });
      check(eq(mig.resolveSecurityMigration(deepFreeze(clone(clean.input)), deepFreeze(decisionsFor(clean, cleanReport))), b), 'mutating a result never affects a later call');
    });
  });
}

// ===================================== R78/C3/replacement-coverage ====
// Plan 3.4, 3.5 and 4.4: the new identity needs its own decision; an old omission neither decides nor approves it.
async function replacementCoverage(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mig = await needSafeScript(failures, context, 'migrate-security-paths.mjs');
    const fixture = loadMigrationFixture(check, context);
    if (!mig || !needFns(failures, mig, ['classifySecurityMigration', 'resolveSecurityMigration']) || !fixture) return;
    const cases = byId(fixture);
    await step('the anchored schema-1 keys omission fixture reports the old omission under the new environment coverage and still requires coverage:0', async () => {
      const c = cases.get('old-env-omission');
      const rep = c && (await runMigrationCase(check, mig, c, 'old-env-omission')).report;
      const cov0 = rep && rep.coverage.find((x) => x.id === 'coverage:0');
      check(cov0 && eq(cov0.replaces.map((e) => e.glob), ['**/.env', '**/.env.*']) && eq(cov0.previousOmissions.map((e) => e.glob), ['**/.env.*']) && cov0.alreadyEffective === false, 'coverage:0 replaces **/.env then **/.env.* and lists the old omission', cov0);
      check(rep && rep.requiredDecisions.some((d) => d.id === 'coverage:0'), 'the old omission does not decide the new coverage: coverage:0 is still required', rep && rep.requiredDecisions);
      check(rep && rep.baseline === 'recorded' && c.input.manifest.files[T_POLICY].managed.schema === 1 && c.input.manifest.files[T_POLICY].managed.patterns.every((e) => e.anchor === 'any') && c.input.manifest.files[T_POLICY].omissions.patterns.every((e) => e.anchor === 'any'), 'the fixture is a valid schema-1 keys record with explicit anchors on every managed entry and omission');
    });
    await step('including the replacement adds **/.env*, retires the unchanged old entry and keeps the old omission record', async () => {
      await runMigrationCase(check, mig, cases.get('old-env-omission'), 'old-env-omission');
    });
    await step('omitting the replacement preserves the unomitted old environment entries and records only the new identity', async () => {
      await runMigrationCase(check, mig, cases.get('replacement-omitted'), 'replacement-omitted');
    });
    await step('separately omitting one old entry removes only that exact identity; the replacement omission does not retire the other old entry', async () => {
      await runMigrationCase(check, mig, cases.get('env-old-omitted'), 'env-old-omitted');
    });
    await step('an exact omission of a desired new identity suppresses that coverage row, also when the omission is spelled in another case', async () => {
      for (const id of ['omitted-new-identity', 'omission-case-folded']) {
        const rep = (await runMigrationCase(check, mig, cases.get(id), id)).report;
        check(rep && eq(rep.coverage.map((x) => x.id), ['coverage:0']), `${id}: only coverage:0 remains (the omitted identity has no row)`, rep && rep.coverage.map((x) => x.id));
      }
    });
    await step('root versus any and broad overlap do not count: a root-anchored or wider omission never suppresses the desired any-anchored identity (C2 identity, not overlap)', async () => {
      const c = clone(cases.get('omitted-new-identity'));
      for (const [label, omission] of [['a root-anchored *.cert', { anchor: 'root', glob: '*.cert' }], ['a broader **/*.ce*', { anchor: 'any', glob: '**/*.ce*' }], ['a directory-prefix **/cert/**', { anchor: 'any', glob: '**/cert/**' }]]) {
        const input = clone(c.input);
        input.manifest.files[T_POLICY].omissions.patterns = [omission];
        const rep = await runPure(check, label, mig.classifySecurityMigration, input);
        check(rep && eq(rep.coverage.map((x) => x.id), ['coverage:0', 'coverage:2']), `${label}: the cert coverage row stays`, rep && rep.coverage.map((x) => x.id));
      }
    });
    await step('unknown baselines still show the applicable old replacements', async () => {
      const rep = (await runMigrationCase(check, mig, cases.get('unknown-current-matches-v2'), 'unknown-current-matches-v2')).report;
      const cov0 = rep && rep.coverage.find((x) => x.id === 'coverage:0');
      check(cov0 && eq(cov0.replaces.map((e) => e.glob), ['**/.env', '**/.env.*']) && eq(cov0.previousOmissions, []), 'coverage:0 names the old environment entries found in the current policy', cov0 && cov0.replaces);
      check(rep && rep.coverage.length === 20 && rep.coverage.filter((x) => x.alreadyEffective).length === 17, 'every desired identity has a row; 17 are already effective', rep && rep.coverage.filter((x) => x.alreadyEffective).length);
      const missing = (await runMigrationCase(check, mig, cases.get('missing-record'), 'missing-record')).report;
      const mc0 = missing && missing.coverage.find((x) => x.id === 'coverage:0');
      check(mc0 && eq(mc0.replaces.map((e) => e.glob), ['**/.env']), 'only the old entry that exists is listed in replaces', mc0 && mc0.replaces);
    });
    await step('an addition moved to project ownership plus included coverage for the same identity keeps both sources; the contradictory omit plus include is MIGRATION_DECISIONS', async () => {
      const both = (await runMigrationCase(check, mig, cases.get('addition-project-include'), 'addition-project-include')).report;
      check(both && both.coverage.find((x) => x.id === 'coverage:0').alreadyEffective === true, 'the identity is already effective through the current addition, which is not approval to install managed coverage', both && both.coverage[0]);
      await runMigrationCase(check, mig, cases.get('contradictory-decisions'), 'contradictory-decisions');
    });
  });
}

// ============================================ R52/C3/user-denies ====
// Plan 3.6 and 4.5: the pure deny merge (ownership, held-back rules, both legacy conflict shapes) and the merge CLI report mapping.
const CONFLICT_HELD = (rule, exceptions) => ({ rule, overridesUserExceptions: exceptions, effect: 'appending this rule cancels the user exception(s); decision required' });
const CONFLICT_CARVED = (rule, negations) => ({ rule, carvedBy: negations, effect: 'user negations after this rule may exempt paths from it; review with the user' });
const REPORT_KEYS = ['added', 'alreadyCovered', 'alreadyPresent', 'conflicts', 'heldBack', 'ownershipDropped', 'retained'];
const KEEP_EXC = 'Read(![.]env.example)'; // unsupported bracket syntax: conservatively overlapping everything
// The resolved policy of a clean v2 migration (plan 3.5): seventeen retained entries, then the three new identities.
function cleanMigrationPolicy(context) {
  const doc = expectedShippedDoc(context);
  const v2 = readJson(path.join(context.skillRoot, 'data', 'secret-paths-v2.0.0.json'));
  const anchoredList = (list) => list.map((e) => ({ anchor: 'any', ...e }));
  const retained = anchoredList(v2.patterns.slice(2));
  const added = anchoredList(doc.patterns.filter((e) => ['**/.env*', '**/*.cert', '**/.htpasswd'].includes(e.glob)));
  return { $comment: v2.$comment, schema: 2, patterns: [...retained, ...added], projectPatterns: [], contentRisk: clone(v2.contentRisk), codexGlobScanMaxDepth: 6 };
}
async function userDenies(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const m = await needSafeScript(failures, context, 'merge-claude-settings.mjs');
    const kit = makeKit(context, check);
    const shipped = expectedShippedDoc(context);
    const projects = [{ anchor: 'root', glob: 'env/**' }, { anchor: 'root', glob: 'cert/**' }];
    const policy = pol2(shipped.patterns.map((e) => ({ anchor: 'any', ...e })), projects);
    const desired = expectedControls(policy).claude.permissionsDeny;
    const migrated = cleanMigrationPolicy(context);
    const v2deny = baseFactsDeny(context);
    const call = (o) => ({ settings: {}, managed: {}, policy, omissions: {}, dropOwnership: [], overrideUserExceptions: false, ...o });
    if (m && needFns(failures, m, ['mergeManagedDenies'])) {
      const merge = (o) => m.mergeManagedDenies(o);
      await step('identical user denies stay in place and user-owned: alreadyPresent and alreadyCovered, never new ownership; every missing desired rule is appended in renderer order and owned', async () => {
        const settings = { $schema: 'https://json.schemastore.org/claude-code-settings.json', permissions: { deny: ['Read(/env/**)', 'Bash(user-thing)', 'Read(/cert/**)'], allow: ['Bash(npm test)'] }, custom: { keep: [2, 1] } };
        const out = await runPure(check, 'user denies', merge, call({ settings }));
        if (!out) return;
        const present = new Set(settings.permissions.deny);
        const added = desired.filter((r) => !present.has(r));
        check(eq(Object.keys(out), ['settings', 'managed', 'omissions', 'report']), 'the result holds settings, managed, omissions and report', Object.keys(out));
        check(eq(out.settings.permissions.deny, [...settings.permissions.deny, ...added]), 'the user denies keep their positions; the missing desired rules follow in renderer order', out.settings.permissions.deny.slice(0, 5));
        check(out.settings.permissions.deny[0] === 'Read(/env/**)' && out.settings.permissions.deny[1] === 'Bash(user-thing)' && out.settings.permissions.deny[2] === 'Read(/cert/**)', 'Read(/env/**) and Read(/cert/**) remain in the same positions');
        check(eq(out.settings.permissions.allow, ['Bash(npm test)']) && eq(out.settings.custom, { keep: [2, 1] }) && out.settings.$schema === settings.$schema, 'allow, $schema and unrelated fields are untouched');
        check(eq(sorted(Object.keys(out.report)), REPORT_KEYS), 'the DenyReport has exactly its seven fields', Object.keys(out.report));
        check(eq(out.report.alreadyPresent, ['Read(/env/**)', 'Read(/cert/**)']) && eq(out.report.alreadyCovered, ['Read(/env/**)', 'Read(/cert/**)']), 'Read(/env/**) and Read(/cert/**) are alreadyPresent and alreadyCovered', { present: out.report.alreadyPresent, covered: out.report.alreadyCovered });
        check(eq(out.report.added, added) && eq(out.report.heldBack, []) && eq(out.report.conflicts, []) && eq(out.report.retained, []) && eq(out.report.ownershipDropped, []), 'added is the missing desired rules in renderer order; nothing held back, retained or dropped', { added: out.report.added.length });
        check(eq(out.managed['permissions.deny'], added) && eq(out.managed.heldBack, []), 'new ownership is the appended rules only; the user-owned ones are not owned', out.managed);
        check(!out.managed['permissions.deny'].includes('Read(/env/**)') && !out.managed['permissions.deny'].includes('Read(/cert/**)'), 'identical user denies are never recorded as managed');
      });
      await step('existing duplicate strings stay byte-equivalent when no settings value changes; the owned list adds nothing', async () => {
        const settings = { permissions: { deny: [...desired, desired[0], 'Bash(user-thing)', desired[3], desired[0]] } };
        const out = await runPure(check, 'duplicates', merge, call({ settings }));
        if (!out) return;
        check(eq(out.settings, settings), 'the settings value is equal to the input, duplicates and order included', out.settings.permissions.deny.length);
        check(eq(out.report.added, []) && eq(out.report.alreadyPresent, desired) && eq(out.managed['permissions.deny'] || [], []), 'nothing is added, every desired rule is alreadyPresent, ownership gains nothing');
      });
      await step('a clean v2 migration state: retired managed denies keep their bytes and their ownership; only the three new Read rules are appended and owned', async () => {
        const wantDesired = expectedControls(migrated).claude.permissionsDeny;
        const settings = { $schema: 'x', permissions: { deny: [...v2deny], allow: ['Bash(npm test)', 'Bash(node .ai/tools/git-safe.mjs *)'] } };
        const managed = { 'permissions.deny': [...v2deny], 'permissions.allow': ['Bash(npm test)', 'Bash(node .ai/tools/git-safe.mjs *)'], hooks: [{ event: 'PreToolUse', matcher: 'Bash', command: 'node check.mjs' }], heldBack: ['Read(old)'] };
        const out = await runPure(check, 'retired denies', merge, call({ settings, managed, policy: migrated }));
        if (!out) return;
        const added = wantDesired.filter((r) => !v2deny.includes(r));
        check(eq(added, ['Read(**/.env*)', 'Read(**/*.cert)', 'Read(**/.htpasswd)']), 'premise: the three new identities are the only missing rules', added);
        check(eq(out.settings.permissions.deny, [...v2deny, ...added]), 'the whole previous list keeps its bytes and positions; the new rules follow', out.settings.permissions.deny.length);
        check(out.settings.permissions.deny.includes('Read(**/.env)') && out.settings.permissions.deny.includes('Read(**/.env.*)'), 'Read(**/.env) and Read(**/.env.*) survive although the renderer no longer lists them');
        check(eq(out.managed['permissions.deny'], [...v2deny, ...added]), 'ownership is the retained previous list plus the appended rules, without duplicates', out.managed['permissions.deny'].length);
        check(eq(out.report.added, added) && out.report.alreadyCovered.length === 0, 'added is exactly the three; previously managed rules are alreadyPresent but not alreadyCovered', { covered: out.report.alreadyCovered.length });
        const ret = out.report.retained;
        check(ret.includes('Read(**/.env)') && ret.includes('Read(**/.env.*)') && ret.indexOf('Read(**/.env)') < ret.indexOf('Read(**/.env.*)') && ret.every((r) => v2deny.includes(r)), 'retained holds the retired previous rules in previous order', ret);
        check(eq(out.managed['permissions.allow'], managed['permissions.allow']) && eq(out.managed.hooks, managed.hooks), 'managed allow and hook fields survive unchanged');
        check(eq(out.managed.heldBack, []), 'managed.heldBack becomes the current heldBack array, [] included');
      });
      await step('a retired rule that is absent from the settings keeps its metadata and is never restored; nothing is removed because the renderer list lacks it', async () => {
        const without = v2deny.filter((r) => r !== 'Read(**/.env)' && r !== 'Read(**/.env.*)');
        const out = await runPure(check, 'absent retired', merge, call({ settings: { permissions: { deny: without } }, managed: { 'permissions.deny': [...v2deny] }, policy: migrated }));
        if (!out) return;
        check(!out.settings.permissions.deny.includes('Read(**/.env)') && !out.settings.permissions.deny.includes('Read(**/.env.*)'), 'the absent retired strings are not appended again', out.settings.permissions.deny.filter((r) => r.includes('.env')));
        check(out.managed['permissions.deny'].includes('Read(**/.env)') && out.managed['permissions.deny'].includes('Read(**/.env.*)'), 'their ownership metadata is retained');
        check(out.report.retained.includes('Read(**/.env)') && out.report.retained.includes('Read(**/.env.*)'), 'both appear in retained');
        check(v2deny.every((r) => out.managed['permissions.deny'].includes(r)), 'no previous managed string was dropped because the renderer list lacks it');
      });
      await step('dropOwnership removes the named metadata only: settings bytes stay, nothing is re-added or re-adopted; an unknown selection is DENY_OWNERSHIP_SELECTION', async () => {
        const settings = { permissions: { deny: [...v2deny] } };
        const managed = { 'permissions.deny': [...v2deny] };
        const out = await runPure(check, 'drop', merge, call({ settings, managed, policy: migrated, dropOwnership: ['Read(**/.env)', 'Read(**/*.pem)'] }));
        if (out) {
          check(!out.managed['permissions.deny'].includes('Read(**/.env)') && !out.managed['permissions.deny'].includes('Read(**/*.pem)') && out.managed['permissions.deny'].includes('Read(**/.env.*)'), 'the selected strings leave the metadata; the others stay', out.managed['permissions.deny'].slice(0, 3));
          check(out.settings.permissions.deny.slice(0, v2deny.length).every((r, i) => r === v2deny[i]), 'the settings bytes still carry every string, in order');
          check(eq(out.report.ownershipDropped, ['Read(**/.env)', 'Read(**/*.pem)']), 'ownershipDropped follows previous managed order without repeats', out.report.ownershipDropped);
          check(!out.report.added.includes('Read(**/*.pem)') && !out.managed['permissions.deny'].includes('Read(**/*.pem)'), 'a selected desired rule is not re-adopted during the same merge');
        }
        const absent = await runPure(check, 'drop of an absent desired rule', merge, call({ settings: { permissions: { deny: v2deny.filter((r) => r !== 'Read(**/*.pem)') } }, managed, policy: migrated, dropOwnership: ['Read(**/*.pem)'] }));
        if (absent) check(!absent.settings.permissions.deny.includes('Read(**/*.pem)') && !absent.report.added.includes('Read(**/*.pem)') && !absent.managed['permissions.deny'].includes('Read(**/*.pem)'), 'a selected rule is not re-added or re-adopted', absent.report.added);
        for (const [label, sel] of [['a string nobody recorded', ['Read(nope)']], ['a user-owned string', ['Bash(user-thing)']], ['one good and one unknown', ['Read(**/.env)', 'Read(nope)']]]) {
          await expectErr(check, label, () => merge(deepFreeze(clone(call({ settings: { permissions: { deny: [...v2deny, 'Bash(user-thing)'] } }, managed, policy: migrated, dropOwnership: sel })))), 'DENY_OWNERSHIP_SELECTION', 'DENY_OWNERSHIP_SELECTION: dropOwnership must name only recorded managed deny strings');
        }
      });
      await step('a user exception that may overlap holds the missing rule back (legacy conflict shape) unless overrideUserExceptions; provably disjoint exceptions hold back nothing', async () => {
        const settings = { permissions: { deny: [KEEP_EXC] } };
        const held = await runPure(check, 'held back', merge, call({ settings }));
        if (held) {
          check(held.report.heldBack.includes('Read(**/.env*)') && !held.report.added.includes('Read(**/.env*)') && !held.settings.permissions.deny.includes('Read(**/.env*)'), 'Read(**/.env*) is held back and not appended', held.report.heldBack.slice(0, 3));
          check(held.report.conflicts.some((c) => eq(c, CONFLICT_HELD('Read(**/.env*)', [KEEP_EXC]))), 'the legacy conflict object: rule, overridesUserExceptions, effect', held.report.conflicts[0]);
          check(held.report.added.includes('Bash(rm -rf *)') && !held.report.heldBack.some((r) => !r.startsWith('Read(')), 'only Read and Edit rules can be held back; command denies are appended');
          check(eq(held.managed.heldBack, held.report.heldBack) && !held.report.heldBack.some((r) => held.managed['permissions.deny'].includes(r)), 'managed.heldBack is exactly the current result and held-back rules are not owned');
          check(held.settings.permissions.deny[0] === KEEP_EXC, 'the user exception keeps its position');
        }
        const forced = await runPure(check, 'override', merge, call({ settings, overrideUserExceptions: true }));
        if (forced) {
          check(forced.report.added.includes('Read(**/.env*)') && forced.report.heldBack.length === 0 && forced.settings.permissions.deny.indexOf('Read(**/.env*)') > 0, 'an explicit override appends the rule after the exception', forced.report.heldBack.length);
          check(forced.managed['permissions.deny'].includes('Read(**/.env*)') && eq(forced.managed.heldBack, []), 'the appended rule is owned; heldBack is []');
        }
        const disjoint = await runPure(check, 'disjoint', merge, call({ settings: { permissions: { deny: ['Read(!docs/README.md)'] } } }));
        if (disjoint) check(eq(disjoint.report.heldBack, []) && eq(disjoint.report.conflicts, []) && disjoint.report.added.includes('Read(**/.env*)'), 'a provably disjoint exception holds nothing back and creates no conflict', { held: disjoint.report.heldBack.length, conflicts: disjoint.report.conflicts });
      });
      await step('an existing desired Read rule before a later user negation keeps its place and is reported with the legacy carvedBy shape', async () => {
        const settings = { permissions: { deny: ['Read(**/.env*)', 'Read(!.env.example)'] } };
        const out = await runPure(check, 'carved', merge, call({ settings }));
        if (!out) return;
        check(out.report.conflicts.some((c) => eq(c, CONFLICT_CARVED('Read(**/.env*)', ['Read(!.env.example)']))), 'the legacy carvedBy conflict object', out.report.conflicts);
        check(out.settings.permissions.deny[0] === 'Read(**/.env*)' && out.settings.permissions.deny[1] === 'Read(!.env.example)', 'reporting never rewrites or reorders the user rules');
        check(out.report.alreadyPresent.includes('Read(**/.env*)') && out.report.conflicts.every((c) => hasOwn(c, 'carvedBy') || hasOwn(c, 'overridesUserExceptions')), 'the rule is alreadyPresent; every conflict has one of the two legacy shapes');
      });
      await step('settings deny omissions suppress newly generated Read denies without deleting strings or ownership; allow omissions are preserved', async () => {
        const omitted = { anchor: 'any', glob: '**/.npmrc' };
        const absent = await runPure(check, 'omitted and absent', merge, call({ settings: { permissions: { deny: [] } }, omissions: { 'permissions.deny': [omitted], 'permissions.allow': ['Bash(x)'] } }));
        if (absent) {
          check(!absent.report.added.includes('Read(**/.npmrc)') && !absent.settings.permissions.deny.includes('Read(**/.npmrc)') && absent.report.added.includes('Read(**/.env*)'), 'the omitted rule is not generated; the others are', absent.report.added.slice(0, 3));
          check(absent.omissions && eq(absent.omissions['permissions.allow'], ['Bash(x)']) && eq(absent.omissions['permissions.deny'], [omitted]), 'the omissions come back: the allow omissions preserved, the deny omissions as given', absent.omissions);
        }
        const present = await runPure(check, 'omitted and present', merge, call({ settings: { permissions: { deny: ['Read(**/.npmrc)'] } }, managed: { 'permissions.deny': ['Read(**/.npmrc)'] }, omissions: { 'permissions.deny': [omitted] } }));
        if (present) check(present.settings.permissions.deny[0] === 'Read(**/.npmrc)' && present.managed['permissions.deny'].includes('Read(**/.npmrc)'), 'an omission never deletes an existing string or its ownership');
      });
      await step('settings whose permissions are not string arrays are DENY_SETTINGS', async () => {
        for (const [label, settings] of [['a string deny', { permissions: { deny: 'x' } }], ['a number inside deny', { permissions: { deny: [1] } }], ['a null inside deny', { permissions: { deny: ['a', null] } }], ['a string allow', { permissions: { allow: 'x' } }], ['an object allow', { permissions: { allow: {} } }]]) {
          await expectErr(check, label, () => merge(deepFreeze(clone(call({ settings })))), 'DENY_SETTINGS', 'DENY_SETTINGS: settings permissions must contain string arrays');
        }
      });
    }
    // ---------------------------------------------------------------- the CLI ----
    await withScratch(context, 'r52', async (dir) => {
      const mk = (name, settings, extra = {}) => {
        const root = makeRepo(context, path.join(dir, name), { 'package.json': '{}\n', '.claude/settings.json': typeof settings === 'string' ? settings : jsonText(settings), ...extra });
        return root;
      };
      const runMerge = (root, id, args = [], o = {}) => { kit.begin(root, id); return kit.script('merge-claude-settings', root, ['--run-id', id, ...args], o); };
      const reqOf = (root, id, name) => readJson(runFile(root, id, name));
      await step('the CLI report maps the pure result: legacy added/alreadyPresent, conflicts, heldBack, alreadyCovered, retainedManagedDenies, ownershipDropped, the unchanged diagnostics and the C7 allows report', async () => {
        const settings = { permissions: { deny: ['Read(**/.npmrc)', 'Read(!docs/README.md)', 'Bash(DROP TABLE x)'], allow: ['Bash(other)'] }, hooks: { PreToolUse: [{ matcher: 'Bash', command: 'x' }] } };
        const root = mk('map', settings);
        // C7 plan 4.11 item 2: no nonempty allow file (every nonempty --allow-file is refused, R54/C7/refusal); the report maps the deny results only.
        const r = runMerge(root, 'run-c3-m1');
        check(r.code === 0 && r.json && r.json.ok === true, 'the merge succeeds', { code: r.code, out: r.stdout.slice(0, 300), err: r.stderr.slice(0, 200) });
        const rep = (r.json && r.json.report) || {};
        const shippedDesired = expectedControls(shipped).claude.permissionsDeny;
        const addedDeny = shippedDesired.filter((x) => !settings.permissions.deny.includes(x));
        check(eq(rep.added, { deny: addedDeny, allow: [] }), 'added is the legacy { deny, allow } object and its allow list is always empty (C7 adds no allow)', rep.added && { deny: rep.added.deny && rep.added.deny.length, allow: rep.added.allow });
        check(eq(rep.alreadyPresent, ['Read(**/.npmrc)']), 'alreadyPresent: the deny results only', rep.alreadyPresent);
        check(eq(rep.alreadyCovered, ['Read(**/.npmrc)']), 'alreadyCovered: the identical user rule', rep.alreadyCovered);
        check(eq(rep.heldBack, []) && eq(rep.retainedManagedDenies, []) && eq(rep.ownershipDropped, []), 'heldBack, retainedManagedDenies and ownershipDropped are empty here', { held: rep.heldBack, ret: rep.retainedManagedDenies, drop: rep.ownershipDropped });
        check(rep.conflicts && rep.conflicts.some((c) => eq(c, CONFLICT_CARVED('Read(**/.npmrc)', ['Read(!docs/README.md)']))), 'the legacy carvedBy conflict is reported', rep.conflicts);
        check(eq(rep.ineffective, [{ rule: 'Bash(DROP TABLE x)', why: 'SQL text is not a shell command; protect databases with least-privilege DB users' }]), 'the ineffective diagnostic is unchanged', rep.ineffective);
        check(eq(rep.malformedHooks, [{ event: 'PreToolUse', index: 0, matcher: 'Bash', note: 'legacy shape; Claude Code does not run it. Ask the user: remove or convert.' }]), 'the malformedHooks diagnostic is unchanged', rep.malformedHooks);
        check(Array.isArray(rep.info) && rep.info.some((x) => eq(x, { userNegations: ['Read(!docs/README.md)'] })), 'the info diagnostic lists the user negations', rep.info);
        check(r.json.needsDecision === true && r.json.changed === true, 'a conflict needs a decision; the settings changed');
        const draft = readJson(draftPath(root, 'run-c3-m1', T_SETTINGS));
        check(draft && eq(draft.permissions.deny, [...settings.permissions.deny, ...addedDeny]) && eq(draft.permissions.allow, ['Bash(other)']) && eq(draft.hooks, settings.hooks), 'the draft keeps every user entry in place and appends the missing deny rules; the allow list is untouched', draft && draft.permissions.deny.length);
        const mk2 = reqOf(root, 'run-c3-m1', 'managed-keys.json');
        check(mk2 && !hasOwn(mk2[T_SETTINGS], 'permissions.allow'), 'no permissions.allow field is introduced in the managed request', mk2 && Object.keys(mk2[T_SETTINGS]));
        check(eq(Object.keys(rep), ['added', 'alreadyPresent', 'conflicts', 'ineffective', 'malformedHooks', 'info', 'heldBack', 'alreadyCovered', 'retainedManagedDenies', 'ownershipDropped', 'hooks', 'allows']), 'the report keys are the legacy keys, then hooks, then allows last (C7 plan 4.11)', Object.keys(rep));
        check(eq(rep.allows, { rules: [{ rule: 'Bash(other)', ownership: 'user', classification: 'other', level: 'none', detail: null }], managed: [], omitted: [], results: [{ level: 'info', check: 'allow-local', detail: '.claude/settings.local.json is personal and is not managed by project-setup; permissions there do not protect the team.' }] }), 'report.allows classifies the user-owned allow as other and carries only the personal-settings row', rep.allows);
        check(mk2 && eq(mk2[T_SETTINGS]['permissions.deny'], addedDeny) && eq(mk2[T_SETTINGS].heldBack, []), 'the managed-keys request owns the appended denies only (the user-owned Read(**/.npmrc) is not claimed), heldBack []', mk2 && mk2[T_SETTINGS]);
        check(mk2 && !mk2[T_SETTINGS]['permissions.deny'].includes('Read(**/.npmrc)'), 'the identical user rule is not in the managed request');
        check(eq(reqOf(root, 'run-c3-m1', 'ownership.json'), { [T_SETTINGS]: 'keys' }), 'the ownership request declares keys');
      });
      // C7 plan 4.11 item 3: no allow file and an empty one each introduce no permissions.allow; a valid staged allow field is preserved by both; every nonempty
      // allow-file refusal expectation moved to R54/C7/refusal (tests/c7.test.mjs).
      await step('with no --allow-file and with an empty one the managed-keys request has no permissions.allow; a staged allow field is preserved by both', async () => {
        putFile(path.join(dir, 'allow-empty.json'), jsonText([]));
        const none = mk('allow-none', { permissions: { deny: [] } });
        const n1 = runMerge(none, 'run-c3-m3');
        const r1 = reqOf(none, 'run-c3-m3', 'managed-keys.json');
        check(n1.code === 0 && r1 && !hasOwn(r1[T_SETTINGS], 'permissions.allow'), 'no allow file and nothing staged: permissions.allow is omitted from the request', r1 && Object.keys(r1[T_SETTINGS]));
        const empty = mk('allow-empty', { permissions: { deny: [] } });
        const n2 = runMerge(empty, 'run-c3-m2', ['--allow-file', path.join(dir, 'allow-empty.json')]);
        const r2 = reqOf(empty, 'run-c3-m2', 'managed-keys.json');
        check(n2.code === 0 && r2 && !hasOwn(r2[T_SETTINGS], 'permissions.allow'), 'an empty allow file: permissions.allow is not requested either (not [])', r2 && Object.keys(r2[T_SETTINGS]));
        const staged = mk('allow-staged', { permissions: { deny: [], allow: [] } });
        kit.begin(staged, 'run-c3-m6');
        putRequest(staged, 'run-c3-m6', 'managed-keys.json', { [T_SETTINGS]: { 'permissions.allow': ['Bash(npm test)'] } });
        const withNone = kit.script('merge-claude-settings', staged, ['--run-id', 'run-c3-m6']);
        const k1 = reqOf(staged, 'run-c3-m6', 'managed-keys.json');
        check(withNone.code === 0 && k1 && eq(k1[T_SETTINGS]['permissions.allow'], ['Bash(npm test)']), 'a later run without an allow file keeps the already staged allow field', k1 && k1[T_SETTINGS]);
        const withEmpty = kit.script('merge-claude-settings', staged, ['--run-id', 'run-c3-m6', '--allow-file', path.join(dir, 'allow-empty.json')]);
        const k2 = reqOf(staged, 'run-c3-m6', 'managed-keys.json');
        check(withEmpty.code === 0 && k2 && eq(k2[T_SETTINGS]['permissions.allow'], ['Bash(npm test)']), 'a run with an empty allow file keeps the already staged allow field too', k2 && k2[T_SETTINGS]);
      });
      await step('settings values that do not change keep the original bytes and create no settings draft', async () => {
        const all = expectedControls(shipped).claude.permissionsDeny;
        const text = JSON.stringify({ permissions: { deny: all, allow: [] } }, null, 4) + '\n';
        const root = mk('same', text);
        const r = runMerge(root, 'run-c3-m4');
        check(r.code === 0 && r.json && r.json.ok === true && r.json.changed === false && r.json.draft === null, 'changed false, no draft', { code: r.code, out: r.stdout.slice(0, 300) });
        check(!exists(draftPath(root, 'run-c3-m4', T_SETTINGS)), 'no settings draft file exists');
        check(readText(projPath(root, T_SETTINGS)) === text, 'the settings bytes are untouched');
        const rep = (r.json && r.json.report) || {};
        check(eq(rep.alreadyPresent, all) && eq(rep.alreadyCovered, all) && eq(rep.added && rep.added.deny, []), 'every rule is present and user-owned', { present: rep.alreadyPresent && rep.alreadyPresent.length });
      });
      await step('the merge CLI no longer starts the renderer: importing and running it spawns no node child of render-permissions', async () => {
        const root = mk('nospawn', { permissions: { deny: [] } });
        kit.begin(root, 'run-c3-m5');
        const log = path.join(dir, 'spawns.log');
        const pre = writePreload(dir, [
          "'use strict';", "const cp = require('child_process'); const fs = require('fs');",
          `const LOG = ${JSON.stringify(log)};`,
          "for (const k of ['spawnSync', 'spawn', 'execFileSync', 'execSync', 'execFile', 'exec']) { const o = cp[k]; cp[k] = function () { try { fs.appendFileSync(LOG, JSON.stringify([k].concat(Array.prototype.slice.call(arguments, 0, 2))) + '\\n'); } catch (e) { /* ignore */ } return o.apply(this, arguments); }; }",
        ].join('\n') + '\n');
        const r = kit.script('merge-claude-settings', root, ['--run-id', 'run-c3-m5'], { preload: pre });
        const calls = parseLog(readText(log));
        check(r.code === 0, 'the merge runs', { code: r.code, out: r.stdout.slice(0, 200) });
        check(!calls.some((c) => JSON.stringify(c).includes('render-permissions')), 'no process runs render-permissions.mjs (the deny merge is in-process)', calls.filter((c) => JSON.stringify(c).includes('render')).slice(0, 2));
      });
    });
  });
}
// The managed deny list a genuine v2 project records (read from the immutable v2 snapshot data and the v2 command list, never from the code under test).
function baseFactsDeny(context) {
  const v2 = readJson(path.join(context.skillRoot, 'data', 'secret-paths-v2.0.0.json'));
  return [...v2.patterns.map((e) => `Read(${e.glob})`), ...COMMAND_DENY];
}

// ================================================ migration scenarios ====
// A synthetic Git reader (plan 4.2): it declares policy schemas [1, 2] in the replaced catalog and genuinely imports the shared helper and parses the
// installed policy of either schema. It is test data; no production file is replaced and no production override exists.
const SYNTH_READER = [
  '// Synthetic C3 test reader: really imports the shared helper and parses a policy of schema 1 or 2.',
  "import fs from 'node:fs';",
  "import { parseSecurityPolicy } from './security-policy.mjs';",
  "const text = fs.readFileSync(new URL('../security-paths.json', import.meta.url), 'utf8');",
  'const r = parseSecurityPolicy(text);',
  "process.stdout.write(JSON.stringify({ ok: true, sourceSchema: r.sourceSchema, patterns: r.effectivePatterns.length }) + '\\n');",
].join('\n') + '\n';
// A scratch copy of the skill: its scripts run unchanged; only the trusted catalog and the reader asset are replaced.
function copySkill(context, dest, { catalog = CATALOG_COMPAT, reader = SYNTH_READER } = {}) {
  for (const part of ['scripts', 'assets', 'data']) fs.cpSync(path.join(context.skillRoot, part), path.join(dest, part), { recursive: true });
  fs.copyFileSync(path.join(context.skillRoot, 'VERSION'), path.join(dest, 'VERSION'));
  if (catalog !== null) putFile(path.join(dest, 'data', 'runtime-units.json'), jsonText(catalog));
  if (reader !== null) putFile(path.join(dest, 'assets', 'tools', 'git-safe.mjs'), reader);
  return dest;
}
const getSynthSkill = (context) => cached(context, 'skill-synth', () => {
  const dir = scratchDir(context, 'skill-synth');
  return { dir, root: copySkill(context, path.join(dir, 'project-setup')) };
});
// A skill copy derived from the synthetic one for one case.
function deriveSkill(synth, dir, label, mutate = null) {
  const dest = cloneTree(synth.root, path.join(dir, label));
  if (mutate) mutate(dest);
  return dest;
}
const SKILL_REVIEWED = (skillRoot, source) => NH(readBytes(path.join(skillRoot, ...source.split('/'))) || '');

// The clean migration expectations of a genuine v2 install: the resolved policy, the new Read denies, the snippet.
const NEW_READS = ['Read(**/.env*)', 'Read(**/*.cert)', 'Read(**/.htpasswd)'];
function cleanExpect(context, root) {
  const facts = baseFacts(root);
  const policy = cleanMigrationPolicy(context);
  const v2 = facts.policy;
  return {
    facts, policy,
    resolved: { ...v2, schema: 2, patterns: policy.patterns, projectPatterns: [] },
    managed: { schema: 2, patterns: policy.patterns },
    snippet: expectedControls(policy).codexSnippet,
    snippetSha: snippetHash(policy),
    denyAfter: [...facts.deny, ...NEW_READS],
  };
}
const decisionsFile = (report, over = {}) => ({ schema: 1, reportSha256: reportHashOf(report), entries: [], coverage: [], denyOmissions: [], dropDenyOwnership: [], overrideUserExceptions: false, ...over });
const coverAll = (report, action = 'include') => report.coverage.map((c) => ({ id: c.id, action }));
const editPolicy = (context, root, fn) => {
  const p = readJson(projPath(root, T_POLICY));
  fn(p);
  putFile(projPath(root, T_POLICY), jsonText(p));
  commitAll(context, root, 'policy edit');
};
// begin, report, decisions, stage. spec.decide(report) returns the decisions object (default: include every coverage row).
function startMigration(kit, check, root, id, spec = {}) {
  if (!kit.begin(root, id)) return { ok: false, root, id };
  const rep = kit.report(root);
  const report = rep.json && rep.json.report;
  check(rep.code === 0 && report, `${id}: the report succeeds`, rep.stdout.slice(0, 300));
  if (!report) return { ok: false, root, id };
  const decisions = spec.decide ? spec.decide(report) : decisionsFile(report, { coverage: coverAll(report) });
  putRequest(root, id, T_DECISIONS, decisions);
  const st = kit.stage(root, id);
  return { ok: st.code === 0 && st.json && st.json.ok === true, root, id, report, decisions, st, reportSha: rep.json.reportSha256 };
}
// Prepares with exactly the path approvals the run asks for, starting from `approve` (the playing-the-user helper of the baseline suite).
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
// The staged outputs of a clean migration, read from the run directory.
const stagedPolicy = (root, id) => readJson(draftPath(root, id, T_POLICY));
const stagedSettings = (root, id) => readJson(draftPath(root, id, T_SETTINGS));

// ========================================== R48/C3/project-moves ====
// Plan 3.5, 4.4: a project addition stays a reported addition until an explicit decision; project moves need the C2 path approval.
async function projectMoves(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const v2 = await useBase(failures, 'genuine v2', getV2Base, context);
    const synth = await useBase(failures, 'synthetic skill', getSynthSkill, context);
    const mig = await needSafeScript(failures, context, 'migrate-security-paths.mjs');
    const fixture = loadMigrationFixture(check, context);
    if (mig && fixture && needFns(failures, mig, ['classifySecurityMigration', 'resolveSecurityMigration'])) {
      await step('pure: the root-anchored addition is reported, moved to the end of projectPatterns after an existing project entry, and not recorded as managed', async () => {
        const c = byId(fixture).get('project-move');
        if (!c) { check(false, 'the project-move case exists'); return; }
        const { report } = await runMigrationCase(check, mig, c, 'project-move');
        check(report && report.entries[5].classification === 'project-addition' && eq(report.entries[5].current, { anchor: 'root', glob: 'env/**' }), 'the added root env/** is a project-addition row', report && report.entries[5]);
        check(report && eq(report.requiredDecisions[0], { id: 'current:5', choices: ['project', 'keep', 'omit'] }), 'it stays undecided until an explicit decision: project, keep, omit', report && report.requiredDecisions[0]);
      });
    }
    if (!v2 || !synth) return;
    await withScratch(context, 'r48', async (dir) => {
      const kit = makeKit(context, check, synth.root);
      const ADD = { glob: 'env/**' }; // schema 1: the anchor is inferred (root)
      const EXISTING = { anchor: 'root', glob: 'cert/**', note: 'existing' };
      const prepareRoot = (label) => {
        const root = cloneBase(dir, v2, label);
        editPolicy(context, root, (p) => { p.patterns.push(ADD); p.projectPatterns = [EXISTING]; });
        return root;
      };
      await step('the added root env/** is a reported addition; without a decision stage names it first', async () => {
        const root = prepareRoot('undecided');
        kit.begin(root, 'run-c3-pm0');
        const rep = kit.report(root).json;
        const report = rep && rep.report;
        const row = report && report.entries.find((e) => eq(e.current, { anchor: 'root', glob: 'env/**' }));
        check(row && row.classification === 'project-addition' && row.before === null && row.id === 'current:19', 'a project-addition row current:19 with before null', row);
        check(report && eq(report.requiredDecisions.slice(0, 1), [{ id: 'current:19', choices: ['project', 'keep', 'omit'] }]), 'the first required decision is current:19', report && report.requiredDecisions.slice(0, 2));
        putRequest(root, 'run-c3-pm0', T_DECISIONS, decisionsFile(report, { coverage: coverAll(report) }));
        expectF(check, 'stage without the addition decision', kit.stage(root, 'run-c3-pm0'), { code: 'MIGRATION_DECISION_REQUIRED', exit: 3, error: MSG.DECISION_REQUIRED('current:19') });
      });
      await step('project: the complete entry goes to the end of projectPatterns; prepare without the policy approval is APPLY_APPROVAL_REQUIRED; with it, managed metadata excludes the entry and the effective rendering includes it', async () => {
        const root = prepareRoot('project');
        const s = startMigration(kit, check, root, 'run-c3-pm1', { decide: (r) => decisionsFile(r, { entries: [{ id: 'current:19', action: 'project' }], coverage: coverAll(r) }) });
        check(s.ok === true, 'stage succeeds', s.st && s.st.stdout.slice(0, 300));
        if (!s.ok) return;
        const draft = stagedPolicy(root, 'run-c3-pm1');
        check(draft && draft.schema === 2 && eq(draft.projectPatterns, [EXISTING, { anchor: 'root', glob: 'env/**' }]), 'the staged policy keeps the existing project entry first and appends the moved entry', draft && draft.projectPatterns);
        check(draft && !draft.patterns.some((e) => e.glob === 'env/**') && draft.patterns.length === 20, 'the moved entry left the managed list (20 managed entries)', draft && draft.patterns.length);
        const refused = kit.prepare(root, 'run-c3-pm1');
        const policyEntry = ((refused.json && refused.json.errors) || []).find((e) => e.target === T_POLICY);
        check(refused.code === 3 && policyEntry && policyEntry.code === 'APPLY_APPROVAL_REQUIRED' && policyEntry.error === contentApprovalError(T_POLICY, [EDITED_FULL, R_POLICY]), 'prepare without the path approval refuses the policy with the C2 approval text', policyEntry);
        check(((refused.json && refused.json.errors) || []).every((e) => e.code === 'APPLY_APPROVAL_REQUIRED'), 'every refusal is an approval refusal (the decisions and tools are fine)', refused.json && refused.json.errors);
        check(!exists(runFile(root, 'run-c3-pm1', 'plan.json')), 'no plan was written');
        const p = prepareApproving(kit, root, 'run-c3-pm1');
        check(p.ok === true, 'prepare succeeds with the required path approvals', p.prep && p.prep.stdout.slice(0, 400));
        if (!p.ok) return;
        const managedReq = p.plan.metadata.managedKeys[T_POLICY];
        check(managedReq && managedReq.schema === 2 && !idKeys(managedReq.patterns).includes(idKey({ anchor: 'root', glob: 'env/**' })) && !idKeys(managedReq.patterns).includes(idKey(EXISTING)), 'managed metadata excludes the moved entry and the existing project entry', managedReq && managedReq.patterns.length);
        const c = kit.commit(root, 'run-c3-pm1', p.sha);
        check(c.code === 0 && c.json && c.json.committed === true, 'commit succeeds', c.stdout.slice(0, 300));
        const installed = readJson(projPath(root, T_POLICY));
        check(installed && eq(installed.projectPatterns, [EXISTING, { anchor: 'root', glob: 'env/**' }]), 'the installed policy lists both project entries in order', installed && installed.projectPatterns);
        const rec = readManifestFile(root).files[T_POLICY];
        check(rec && rec.ownership === 'keys' && eq(rec.managed.patterns, draft.patterns) && !hasOwn(rec, 'omissions'), 'the manifest records keys ownership with the managed list only (no projectPatterns, no empty omissions)', rec && Object.keys(rec));
        const rendered = kit.render(root, ['json', '--project', root]);
        check(rendered.json && rendered.json.claude && rendered.json.claude.readDeny.includes('Read(/env/**)') && rendered.json.claude.readDeny.includes('Read(/cert/**)'), 'the effective rendering still includes the moved entry and the existing project entry', rendered.json && rendered.json.claude && rendered.json.claude.readDeny.slice(-3));
        const settings = readJson(projPath(root, T_SETTINGS));
        check(settings && settings.permissions.deny.includes('Read(/env/**)') && settings.permissions.deny.includes('Read(/cert/**)'), 'the settings carry the project rules', settings && settings.permissions.deny.slice(-4));
      });
      await step('keep: the addition is recorded as managed through the same approval; the existing project entry stays project-owned and unadopted', async () => {
        const root = prepareRoot('keep');
        const s = startMigration(kit, check, root, 'run-c3-pm2', { decide: (r) => decisionsFile(r, { entries: [{ id: 'current:19', action: 'keep' }], coverage: coverAll(r) }) });
        check(s.ok === true, 'stage succeeds', s.st && s.st.stdout.slice(0, 300));
        if (!s.ok) return;
        const refused = kit.prepare(root, 'run-c3-pm2');
        check(refused.code === 3 && ((refused.json && refused.json.errors) || []).some((e) => e.target === T_POLICY && e.code === 'APPLY_APPROVAL_REQUIRED'), 'keeping a managed addition also needs the policy path approval', refused.stdout.slice(0, 300));
        const p = prepareApproving(kit, root, 'run-c3-pm2');
        check(p.ok === true, 'prepare succeeds with the approvals', p.prep && p.prep.stdout.slice(0, 300));
        if (!p.ok) return;
        const managedReq = p.plan.metadata.managedKeys[T_POLICY];
        check(managedReq && idKeys(managedReq.patterns).includes(idKey({ anchor: 'root', glob: 'env/**' })) && !idKeys(managedReq.patterns).includes(idKey(EXISTING)), 'managed metadata holds the kept addition and never the existing project entry', managedReq && managedReq.patterns.length);
        const draft = stagedPolicy(root, 'run-c3-pm2');
        check(draft && eq(draft.projectPatterns, [EXISTING]), 'projectPatterns is unchanged', draft && draft.projectPatterns);
      });
    });
  });
}

// ====================================== R85/C3/retained-denies ====
// Plan 3.6 and 4.5: retired deny bytes and ownership survive a replacement migration; omissions and drops are explicit and approved.
async function retainedDenies(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const v2 = await useBase(failures, 'genuine v2', getV2Base, context);
    const synth = await useBase(failures, 'synthetic skill', getSynthSkill, context);
    if (!v2 || !synth) return;
    await withScratch(context, 'r85', async (dir) => {
      const kit = makeKit(context, check, synth.root);
      const clean = (label) => cloneBase(dir, v2, label);
      await step('a replacement migration keeps Read(**/.env) and Read(**/.env.*) in the settings and in the ownership, in place, and appends only the three new rules', async () => {
        const root = clean('keep');
        const exp = cleanExpect(context, root);
        const allowBefore = readJson(projPath(root, T_SETTINGS)).permissions.allow;
        const s = startMigration(kit, check, root, 'run-c3-rd1');
        check(s.ok === true, 'stage succeeds', s.st && s.st.stdout.slice(0, 300));
        if (!s.ok) return;
        const draft = stagedSettings(root, 'run-c3-rd1');
        check(draft && eq(draft.permissions.deny, exp.denyAfter), 'the staged settings keep the whole previous list in order and append the three new Read rules', draft && draft.permissions.deny.length);
        const req = readJson(runFile(root, 'run-c3-rd1', 'managed-keys.json'));
        check(req && req[T_SETTINGS] && eq(req[T_SETTINGS]['permissions.deny'], exp.denyAfter) && eq(req[T_SETTINGS].heldBack, []), 'the managed-keys request retains the whole previous ownership plus the new rules; heldBack []', req && req[T_SETTINGS] && req[T_SETTINGS]['permissions.deny'].length);
        check(!req || !req[T_SETTINGS] || !hasOwn(req[T_SETTINGS], 'permissions.allow'), 'no permissions.allow is staged (the migration never replaces allow ownership)');
        const p = prepareApproving(kit, root, 'run-c3-rd1');
        check(p.ok === true, 'prepare succeeds', p.prep && p.prep.stdout.slice(0, 300));
        if (!p.ok) return;
        const c = kit.commit(root, 'run-c3-rd1', p.sha);
        check(c.code === 0 && c.json && c.json.committed === true, 'commit succeeds', c.stdout.slice(0, 300));
        const after = readJson(projPath(root, T_SETTINGS));
        check(after && eq(after.permissions.deny, exp.denyAfter) && after.permissions.deny.includes('Read(**/.env)') && after.permissions.deny.includes('Read(**/.env.*)'), 'the committed settings carry both retired strings at their old positions', after && after.permissions.deny.slice(0, 3));
        check(after && eq(after.permissions.allow, allowBefore), 'the allow list is untouched');
        const rec = readManifestFile(root).files[T_SETTINGS];
        check(rec && rec.ownership === 'keys' && eq(rec.managed['permissions.deny'], exp.denyAfter) && eq(rec.managed['permissions.allow'], exp.facts.settingsRec.managed['permissions.allow']) && eq(rec.managed.heldBack, []), 'the manifest keeps both retired strings owned, the allow ownership untouched, heldBack []', rec && Object.keys(rec.managed));
      });
      await step('an omission does not silently retire ownership: omitting the deleted old environment entries keeps their deny strings and ownership', async () => {
        const root = clean('omit');
        const exp = cleanExpect(context, root);
        editPolicy(context, root, (p) => { p.patterns = p.patterns.slice(2); });
        const s = startMigration(kit, check, root, 'run-c3-rd2', { decide: (r) => decisionsFile(r, { entries: [{ id: 'baseline:0', action: 'omit' }, { id: 'baseline:1', action: 'omit' }], coverage: coverAll(r) }) });
        check(s.ok === true, 'stage succeeds', s.st && s.st.stdout.slice(0, 300));
        if (!s.ok) return;
        const p = prepareApproving(kit, root, 'run-c3-rd2');
        check(p.ok === true, 'prepare succeeds with the approvals it asks for', p.prep && p.prep.stdout.slice(0, 300));
        if (!p.ok) return;
        const c = kit.commit(root, 'run-c3-rd2', p.sha);
        check(c.code === 0 && c.json && c.json.committed === true, 'commit succeeds', c.stdout.slice(0, 300));
        const rec = readManifestFile(root).files;
        check(eq(idKeys(rec[T_POLICY].omissions && rec[T_POLICY].omissions.patterns), idKeys([{ anchor: 'any', glob: '**/.env' }, { anchor: 'any', glob: '**/.env.*' }])), 'the policy record omits exactly the two old identities', rec[T_POLICY] && rec[T_POLICY].omissions);
        check(rec[T_SETTINGS].managed['permissions.deny'].includes('Read(**/.env)') && rec[T_SETTINGS].managed['permissions.deny'].includes('Read(**/.env.*)'), 'the settings ownership still lists both old strings');
        const settings = readJson(projPath(root, T_SETTINGS));
        check(settings.permissions.deny.includes('Read(**/.env)') && settings.permissions.deny.includes('Read(**/.env.*)') && eq(settings.permissions.deny, exp.denyAfter), 'and the settings bytes still carry them', settings.permissions.deny.length);
      });
      await step('dropDenyOwnership removes the selected metadata only: the settings strings stay; it needs the settings approval; an unknown selection is DENY_OWNERSHIP_SELECTION', async () => {
        const root = clean('drop');
        const exp = cleanExpect(context, root);
        const s = startMigration(kit, check, root, 'run-c3-rd3', { decide: (r) => decisionsFile(r, { coverage: coverAll(r), dropDenyOwnership: ['Read(**/.env)'] }) });
        check(s.ok === true, 'stage succeeds', s.st && s.st.stdout.slice(0, 300));
        if (s.ok) {
          const refused = kit.prepare(root, 'run-c3-rd3', { approve: [T_POLICY] });
          expectP(check, 'the drop without the settings approval', refused, [{ target: T_SETTINGS, code: 'APPLY_APPROVAL_REQUIRED', error: metaApprovalError(T_SETTINGS) }]);
          const p = kit.prepare(root, 'run-c3-rd3', { approve: [T_POLICY, T_SETTINGS] });
          check(p.code === 0 && p.json && p.json.ok === true, 'prepare succeeds with both approvals', p.stdout.slice(0, 300));
          const c = kit.commit(root, 'run-c3-rd3', p.json && p.json.planSha256);
          check(c.code === 0 && c.json && c.json.committed === true, 'commit succeeds', c.stdout.slice(0, 300));
          const rec = readManifestFile(root).files[T_SETTINGS];
          check(rec && !rec.managed['permissions.deny'].includes('Read(**/.env)') && rec.managed['permissions.deny'].includes('Read(**/.env.*)') && eq(rec.managed['permissions.deny'].length, exp.denyAfter.length - 1), 'the selected string left the ownership; the others stay', rec && rec.managed['permissions.deny'].length);
          const settings = readJson(projPath(root, T_SETTINGS));
          check(eq(settings.permissions.deny, exp.denyAfter), 'the settings still hold the string: dropping ownership deletes no rule', settings.permissions.deny.length);
          check(!hasOwn(readManifestFile(root).files[T_POLICY], 'omissions'), 'a drop creates no persistent omission by itself');
        }
        const bad = clean('drop-bad');
        kit.begin(bad, 'run-c3-rd4');
        const rep = kit.report(bad).json.report;
        putRequest(bad, 'run-c3-rd4', T_DECISIONS, decisionsFile(rep, { coverage: coverAll(rep), dropDenyOwnership: ['Read(nope)'] }));
        expectF(check, 'stage with an unknown selection', kit.stage(bad, 'run-c3-rd4'), { code: 'DENY_OWNERSHIP_SELECTION', exit: 3, error: 'DENY_OWNERSHIP_SELECTION: dropOwnership must name only recorded managed deny strings' });
      });
      await step('a metadata-only drop writes no settings draft, still needs the settings approval, and leaves the settings bytes alone', async () => {
        const root = clean('metaonly');
        const settingsBytes = readBytes(projPath(root, T_SETTINGS));
        const denyCountBefore = baseFacts(root).deny.length; // read before the commit: the manifest changes with it
        const s = startMigration(kit, check, root, 'run-c3-rd5', { decide: (r) => decisionsFile(r, { coverage: coverAll(r, 'omit'), dropDenyOwnership: ['Read(**/.env)'] }) });
        check(s.ok === true, 'stage succeeds', s.st && s.st.stdout.slice(0, 300));
        if (!s.ok) return;
        check(!exists(draftPath(root, 'run-c3-rd5', T_SETTINGS)) && !(s.st.json.staged || []).includes(`drafts/${T_SETTINGS}`), 'no settings draft is staged when no settings value changes', s.st.json.staged);
        const refused = kit.prepare(root, 'run-c3-rd5', { approve: [T_POLICY] });
        expectP(check, 'the metadata-only drop without the settings approval', refused, [{ target: T_SETTINGS, code: 'APPLY_APPROVAL_REQUIRED', error: metaApprovalError(T_SETTINGS) }]);
        const p = kit.prepare(root, 'run-c3-rd5', { approve: [T_POLICY, T_SETTINGS] });
        check(p.code === 0 && p.json && p.json.ok === true, 'prepare succeeds with both approvals', p.stdout.slice(0, 300));
        const plan = readPlan(root, 'run-c3-rd5');
        check(plan && !plan.ops.some((o) => o.target === T_SETTINGS) && plan.metadataOps.some((m) => m.kind === 'file' && m.target === T_SETTINGS), 'the plan has a settings metadata operation and no settings content operation', plan && plan.ops.map((o) => o.target));
        const c = kit.commit(root, 'run-c3-rd5', p.json && p.json.planSha256);
        check(c.code === 0 && c.json && c.json.committed === true, 'commit succeeds', c.stdout.slice(0, 300));
        check(sameBytes(readBytes(projPath(root, T_SETTINGS)), settingsBytes), 'the settings bytes are unchanged');
        const rec = readManifestFile(root).files[T_SETTINGS];
        check(rec && !rec.managed['permissions.deny'].includes('Read(**/.env)') && rec.managed['permissions.deny'].length === denyCountBefore - 1, 'only the ownership metadata lost the selected string', rec && rec.managed['permissions.deny'].length);
      });
      // C3-P3-5: denyOmissions is the complete requested settings deny-omission list. A prior entry missing from it is a requested removal, which C2 refuses
      // without the settings path approval; an equal list requests no omission change.
      await step('C3-P3-5 a migration that starts with deny omissions: removing an entry needs the settings approval (reason: approved omission records change) and is removed after approval; an equal list requests no omission change', async () => {
        const HT = { anchor: 'any', glob: '**/.htpasswd' };
        const CE = { anchor: 'any', glob: '**/*.cert' };
        const seed = (label) => {
          const root = clean(label);
          const m = readManifestFile(root);
          m.files[T_SETTINGS].omissions = { 'permissions.deny': [HT, CE] };
          putFile(manifestPath(root), jsonText(m));
          commitAll(context, root, 'settings deny omissions on record');
          return root;
        };
        // an equal list
        const eqRoot = seed('omit-equal');
        const es = startMigration(kit, check, eqRoot, 'run-c3-om1', { decide: (r) => decisionsFile(r, { coverage: coverAll(r), denyOmissions: [HT, CE] }) });
        check(es.ok === true, 'stage succeeds with an equal omission list', es.st && es.st.stdout.slice(0, 300));
        if (es.ok) {
          const ep = kit.prepare(eqRoot, 'run-c3-om1', { approve: [T_POLICY] });
          check(ep.code === 0 && ep.json && ep.json.ok === true, 'prepare needs no settings approval for an equal list', ep.stdout.slice(0, 300));
          const unrelated = kit.prepare(eqRoot, 'run-c3-om1', { approve: [T_POLICY, T_SETTINGS] });
          expectPEntry(check, 'an approval of the settings path is refused as unneeded', unrelated, { target: T_SETTINGS, code: 'APPLY_APPROVAL_UNRELATED', error: '--approve-user-content names files that do not need it; refusing broad approvals' });
          const eplan = readPlan(eqRoot, 'run-c3-om1');
          const eop = eplan && eplan.metadataOps.find((m) => m.kind === 'file' && m.target === T_SETTINGS);
          check(!eop || !eop.reasons.includes(R_OMIT), 'the settings metadata operation, if any, has no omission reason', eop && eop.reasons);
          const ec = kit.commit(eqRoot, 'run-c3-om1', ep.json && ep.json.planSha256);
          check(ec.code === 0 && ec.json && ec.json.committed === true, 'commit succeeds', ec.stdout.slice(0, 300));
          const rec = readManifestFile(eqRoot).files[T_SETTINGS];
          check(rec && rec.omissions && eq(idKeys(rec.omissions['permissions.deny']), idKeys([HT, CE])), 'the recorded deny omissions are unchanged', rec && rec.omissions);
        }
        // a removed entry
        const rmRoot = seed('omit-removed');
        const rs = startMigration(kit, check, rmRoot, 'run-c3-om2', { decide: (r) => decisionsFile(r, { coverage: coverAll(r), denyOmissions: [HT] }) });
        check(rs.ok === true, 'stage succeeds with an omission removed', rs.st && rs.st.stdout.slice(0, 300));
        if (rs.ok) {
          const refused = kit.prepare(rmRoot, 'run-c3-om2', { approve: [T_POLICY] });
          const entry = ((refused.json && refused.json.errors) || []).find((e) => e.target === T_SETTINGS);
          check(refused.code === 3 && refused.json && refused.json.code === 'APPLY_PLAN_REJECTED' && entry && entry.code === 'APPLY_APPROVAL_REQUIRED' && (entry.error === metaApprovalError(T_SETTINGS) || (entry.error.endsWith(approvalSuffix(T_SETTINGS)) && entry.error.includes(R_OMIT))), 'without the settings approval prepare refuses the settings path (APPLY_APPROVAL_REQUIRED)', { code: refused.code, entry });
          check(!exists(runFile(rmRoot, 'run-c3-om2', 'plan.json')), 'a refused prepare writes no plan');
          const approved = kit.prepare(rmRoot, 'run-c3-om2', { approve: [T_POLICY, T_SETTINGS] });
          check(approved.code === 0 && approved.json && approved.json.ok === true, 'prepare succeeds once the settings path is approved', approved.stdout.slice(0, 300));
          const rplan = readPlan(rmRoot, 'run-c3-om2');
          const rop = rplan && rplan.metadataOps.find((m) => m.kind === 'file' && m.target === T_SETTINGS);
          check(rop && rop.requiresApproval === true && rop.reasons.includes(R_OMIT) && eq(idKeys(rop.after.omissions && rop.after.omissions['permissions.deny']), idKeys([HT])), 'the settings metadata operation carries the omission reason and the shortened list', rop);
          const rc = kit.commit(rmRoot, 'run-c3-om2', approved.json && approved.json.planSha256);
          check(rc.code === 0 && rc.json && rc.json.committed === true, 'commit succeeds', rc.stdout.slice(0, 300));
          const rec = readManifestFile(rmRoot).files[T_SETTINGS];
          check(rec && rec.omissions && eq(idKeys(rec.omissions['permissions.deny']), idKeys([HT])), 'the removed entry is gone from the recorded omissions after approval', rec && rec.omissions);
          const deny = readJson(projPath(rmRoot, T_SETTINGS)).permissions.deny;
          check(deny.includes('Read(**/*.cert)') && !deny.includes('Read(**/.htpasswd)'), 'the rule whose omission was removed is now generated; the one still omitted is not', deny.slice(-4));
        }
      });
      await step('an absent retired string keeps its ownership and is not restored: nothing is removed because the renderer list lacks it', async () => {
        const root = clean('absent');
        const settings = readJson(projPath(root, T_SETTINGS));
        settings.permissions.deny = settings.permissions.deny.filter((r) => r !== 'Read(**/.env.*)');
        putFile(projPath(root, T_SETTINGS), jsonText(settings));
        commitAll(context, root, 'user removed a retired deny');
        const s = startMigration(kit, check, root, 'run-c3-rd6');
        check(s.ok === true, 'stage succeeds', s.st && s.st.stdout.slice(0, 300));
        if (!s.ok) return;
        const draft = stagedSettings(root, 'run-c3-rd6');
        check(draft && !draft.permissions.deny.includes('Read(**/.env.*)') && NEW_READS.every((r) => draft.permissions.deny.includes(r)), 'the draft does not restore the retired rule and still appends the new ones', draft && draft.permissions.deny.slice(-4));
        const req = readJson(runFile(root, 'run-c3-rd6', 'managed-keys.json'));
        check(req && req[T_SETTINGS]['permissions.deny'].includes('Read(**/.env.*)') && req[T_SETTINGS]['permissions.deny'].includes('Read(**/.env)'), 'the ownership request still lists both retired strings', req && req[T_SETTINGS]['permissions.deny'].length);
      });
    });
  });
}

// ============================================== R80/C3/snapshot ====
// Plan 3.7, 3.8 and 4.6: one prepared migration snapshot binds the staged outputs; the review recomputes its evidence; drift and refusals are exact.
const DOC_API = 'docs/api-conventions.md';
const DIFF_KEYS = ['files', 'metadataOps', 'metadataRequests', 'ok', 'planSha256', 'prepared', 'root', 'runId', 'vault'];
async function cleanPrepared(context) {
  return cached(context, 'mig-clean-v2b', async () => {
    const fails = [];
    const check = mkCheck(fails);
    const v2 = await getV2Base(context);
    const synth = await getSynthSkill(context);
    const dir = scratchDir(context, 'mig-clean');
    const root = cloneTree(v2.root, path.join(dir, 'root'));
    const kit = makeKit(context, check, synth.root);
    const id = 'run-c3-clean';
    const decisionsBefore = null;
    const s = startMigration(kit, check, root, id);
    const p = s.ok ? prepareApproving(kit, root, id) : { ok: false };
    return { dir, root, id, synth, s, p, fails, v2, decisionsBefore };
  });
}
const withBuildFailures = (failures, sc) => { for (const f of sc.fails) failures.push(`scenario build: ${f}`); };
const requestFilesOf = (root, id) => REQUEST_FILES.filter((n) => exists(runFile(root, id, n)));
const ws = (p) => fs.appendFileSync(p, '\n');

async function snapshot(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const v2 = await useBase(failures, 'genuine v2', getV2Base, context);
    const synth = await useBase(failures, 'synthetic skill', getSynthSkill, context);
    if (!v2 || !synth) return;
    const sc = await useBase(failures, 'prepared clean migration', cleanPrepared, context);
    if (!sc) return;
    withBuildFailures(failures, sc);
    const kit = makeKit(context, check, synth.root);
    const { id, root } = sc;
    check(sc.s.ok === true, 'the clean migration stages', sc.s.st && sc.s.st.stdout.slice(0, 300));
    check(sc.p.ok === true, 'the clean migration prepares with the compatible synthetic skill', sc.p.prep && sc.p.prep.stdout.slice(0, 400));
    if (!sc.s.ok || !sc.p.ok) return;
    const exp = cleanExpect(context, root);
    const plan = sc.p.plan;
    await withScratch(context, 'r80s', async (dir) => {
      let n = 0;
      const clone1 = (label) => cloneTree(root, path.join(dir, `${label}${++n}`));
      await step('stage: the response, the lexically sorted staged files, nothing written outside the run, and a second stage changes nothing', async () => {
        const j = sc.s.st.json;
        check(eq(Object.keys(j), ['ok', 'staged', 'reportSha256', 'next']), 'the response is { ok, staged, reportSha256, next }', Object.keys(j));
        check(j.reportSha256 === reportHashOf(sc.s.report) && j.next === 'run apply.mjs prepare, review apply.mjs diff, then approve the plan hash', 'reportSha256 identifies the report; next is the exact instruction', { sha: j.reportSha256, next: j.next });
        check(eq(j.staged, sorted(j.staged)), 'staged is sorted lexically', j.staged);
        for (const f of ['drafts/.ai/security-paths.json', 'drafts/.claude/settings.json', 'drafts/.ai/tools/security-policy.mjs', 'drafts/.ai/tools/git-safe.mjs', 'managed-keys.json', 'manifest-metadata.json', 'ownership.json']) check(j.staged.includes(f), `${f} is staged`, j.staged);
        check(!j.staged.includes('omissions.json'), 'no omission request is synthesized for a clean migration', j.staged);
        check(j.staged.every((f) => exists(runFile(root, id, ...f.split('/')))), 'every staged file exists under the run directory');
        const fresh = clone1('stage');
        fs.rmSync(runFile(fresh, id, 'plan.json'));
        for (const sub of ['drafts', ...REQUEST_FILES]) rmrf(runFile(fresh, id, sub));
        fs.mkdirSync(runFile(fresh, id, 'drafts'));
        const outside = () => JSON.stringify(walkTree(fresh, ['.git']).filter(([rel]) => !rel.startsWith('.ai/.run')));
        const before = outside();
        const again = kit.stage(fresh, id);
        check(again.code === 0 && again.json && again.json.ok === true && outside() === before, 'stage writes only inside the run directory', { code: again.code, out: again.stdout.slice(0, 200) });
        const third = kit.stage(fresh, id);
        check(third.code === 0 && third.json && eq(third.json.staged, []), 'a second stage reuses identical outputs and reports nothing created or changed', third.json && third.json.staged);
      });
      await step('stage refuses a different staged policy or runtime source (MIGRATION_DRAFT_CONFLICT, F, exit 3) without writing anything; unrelated request entries and an existing empty omission container are merged and kept', async () => {
        const root2 = cloneBase(dir, v2, 'conflict');
        const s = startMigration(kit, check, root2, 'run-c3-cf1');
        check(s.ok === true, 'the first stage succeeds', s.st && s.st.stdout.slice(0, 300));
        if (!s.ok) return;
        const conflictRe = /^MIGRATION_DRAFT_CONFLICT: staged migration output conflicts with \S+$/;
        for (const [label, rel, bytes, mark] of [['a different staged policy', T_POLICY, jsonText({ schema: 2, patterns: [], projectPatterns: [] }), '.ai/security-paths.json'], ['a different staged runtime source', T_HELPER, '// not the trusted helper\n', '.ai/tools/security-policy.mjs']]) {
          const original = readBytes(draftPath(root2, 'run-c3-cf1', rel));
          putDraft(root2, 'run-c3-cf1', rel, bytes);
          const before = snapshotTree(runDirOf(root2, 'run-c3-cf1'));
          const r = kit.stage(root2, 'run-c3-cf1');
          // PLAN-GAP: 3.12 gives the text "staged migration output conflicts with <path>" but not the spelling of <path> (run-relative or project-relative);
          // only that it names the conflicting target is asserted.
          check(r.code === 3 && r.stderr === '' && r.json && r.json.ok === false && r.json.code === 'MIGRATION_DRAFT_CONFLICT' && conflictRe.test(r.json.error) && r.json.error.includes(mark) && eq(sorted(Object.keys(r.json)), ['code', 'error', 'ok']), `${label}: MIGRATION_DRAFT_CONFLICT naming the target (F, exit 3)`, { code: r.code, out: r.stdout.slice(0, 300) });
          check(snapshotTree(runDirOf(root2, 'run-c3-cf1')) === before, `${label}: nothing was written before the conflict was found`);
          putDraft(root2, 'run-c3-cf1', rel, original);
        }
        const again = kit.stage(root2, 'run-c3-cf1');
        check(again.code === 0 && again.json && again.json.ok === true && eq(again.json.staged, []), 'with the original drafts back, identical staged outputs are reused', again.stdout.slice(0, 300));
        const root3 = cloneBase(dir, v2, 'merge');
        kit.begin(root3, 'run-c3-cf2');
        const report = kit.report(root3).json.report;
        putRequest(root3, 'run-c3-cf2', T_DECISIONS, decisionsFile(report, { coverage: coverAll(report) }));
        putRequest(root3, 'run-c3-cf2', 'ownership.json', { [DOC_API]: 'merged' });
        putRequest(root3, 'run-c3-cf2', 'transaction-inputs.json', [DOC_API]);
        putRequest(root3, 'run-c3-cf2', 'omissions.json', { [T_POLICY]: { patterns: [] } });
        const m = kit.stage(root3, 'run-c3-cf2');
        check(m.code === 0 && m.json && m.json.ok === true, 'stage succeeds next to pre-staged request files', m.stdout.slice(0, 300));
        const own = readJson(runFile(root3, 'run-c3-cf2', 'ownership.json'));
        check(own && own[DOC_API] === 'merged' && own[T_POLICY] === 'keys', 'the unrelated ownership entry is kept next to the migration entry', own);
        const inputs = readJson(runFile(root3, 'run-c3-cf2', 'transaction-inputs.json'));
        check(Array.isArray(inputs) && inputs.includes(DOC_API), 'the unrelated declared input is kept', inputs);
        const omissions = readJson(runFile(root3, 'run-c3-cf2', 'omissions.json'));
        check(omissions && eq(omissions[T_POLICY], { patterns: [] }), 'an existing empty omission container is preserved, not removed', omissions);
      });
      await step('stage, prepare and diff agree on the resolved policy, the Read denies, the snippet and the managed records', async () => {
        const policyDraft = stagedPolicy(root, id);
        check(eq(policyDraft, exp.resolved), 'the staged policy is the resolved schema-2 policy (v2 fields preserved, seventeen retained entries then the three new identities)', diffPath(policyDraft, exp.resolved));
        const settingsDraft = stagedSettings(root, id);
        check(settingsDraft && eq(settingsDraft.permissions.deny, exp.denyAfter), 'the staged settings append exactly the three new Read denies', settingsDraft && settingsDraft.permissions.deny.slice(-4));
        check(eq(readJson(runFile(root, id, 'manifest-metadata.json')), { codexSnippetSha256: exp.snippetSha }), 'manifest-metadata.json holds the hash of the exact rendered snippet', readJson(runFile(root, id, 'manifest-metadata.json')));
        check(plan.metadata.manifestMetadata && plan.metadata.manifestMetadata.codexSnippetSha256 === exp.snippetSha, 'prepare embeds the same snippet hash');
        check(eq(plan.metadata.managedKeys[T_POLICY], exp.managed), 'prepare embeds the complete managed list of the resolved policy', diffPath(plan.metadata.managedKeys[T_POLICY], exp.managed));
        check(plan.metadata.ownership && plan.metadata.ownership[T_POLICY] === 'keys', 'the ownership request moves the policy to keys');
        const policyOp = plan.metadataOps.find((m) => m.kind === 'file' && m.target === T_POLICY);
        check(policyOp && eq(policyOp.after, { ownership: 'keys', managed: exp.managed }), 'the policy metadata operation records exactly keys ownership and the managed list (no projectPatterns, no empty omissions)', policyOp && policyOp.after && Object.keys(policyOp.after));
        check(plan.manifestAfter && plan.manifestAfter.codexSnippetSha256 === exp.snippetSha, 'manifestAfter carries the snippet hash');
        const d = kit.diff(root, id);
        check(d.code === 0 && d.json && d.json.ok === true && d.json.prepared === true && d.json.planSha256 === sc.p.sha, 'diff reviews the prepared plan', { code: d.code, out: d.stdout.slice(0, 300) });
        const sec = d.json && d.json.security;
        check(sec && eq(Object.keys(sec), ['report', 'controls', 'deny', 'toolUnit']), 'the review security field holds report, controls, deny and toolUnit', sec && Object.keys(sec));
        if (!sec) return;
        check(eq(sec.report, sc.s.report), 'the review report is the report the decisions were made against', diffPath(sec.report, sc.s.report));
        const wantControls = expectedControls(exp.resolved);
        check(eq(sec.controls, wantControls), 'the review controls are the rendering of the resolved policy: the same Read denies, exclusions and snippet that were staged', diffPath(sec.controls, wantControls));
        const desired = wantControls.claude.permissionsDeny;
        check(eq(sec.deny.added, NEW_READS) && eq(sec.deny.alreadyPresent, desired.filter((r) => exp.facts.deny.includes(r))) && eq(sec.deny.alreadyCovered, []) && eq(sec.deny.heldBack, []) && eq(sec.deny.conflicts, []) && eq(sec.deny.ownershipDropped, []), 'the deny report: three added, every other desired rule alreadyPresent, nothing user-owned, held back or dropped', { added: sec.deny.added, present: sec.deny.alreadyPresent.length });
        check(sec.deny.retained.includes('Read(**/.env)') && sec.deny.retained.includes('Read(**/.env.*)'), 'the deny report lists the retired strings as retained');
        const synthReader = SKILL_REVIEWED(synth.root, 'assets/tools/git-safe.mjs');
        const synthHelper = SKILL_REVIEWED(synth.root, 'assets/tools/security-policy.mjs');
        const v2Reader = NH(readBytes(projPath(v2.root, T_READER)));
        const rows = [
          { source: 'assets/tools/git-safe.mjs', target: T_READER, role: 'entrypoint', policySchemas: [1, 2], reviewedSha256: synthReader, installedSha256: v2Reader, plannedSha256: synthReader },
          { source: 'assets/tools/security-policy.mjs', target: T_HELPER, role: 'helper', policySchemas: [1, 2], reviewedSha256: synthHelper, installedSha256: null, plannedSha256: synthHelper },
        ];
        check(eq(sec.toolUnit, rows) && sec.toolUnit.every((r) => eq(sorted(Object.keys(r)), sorted(['source', 'target', 'role', 'policySchemas', 'reviewedSha256', 'installedSha256', 'plannedSha256']))), 'the tool unit is two target-sorted rows of the exact ToolRow shape with NH hashes of the trusted source, the installed file and the planned draft', sec.toolUnit);
        check(eq(Object.keys(d.json).filter((k) => k !== 'security').sort(), DIFF_KEYS), 'the rest of the diff response keeps its C2 keys', Object.keys(d.json));
        check(eq(JSON.stringify(plan).includes('toolUnit') || JSON.stringify(plan).includes('reviewedSha256'), false), 'the plan stores no tool evidence');
      });
      await step('the migration plan has exactly the ordinary keys plus security (the hash of the raw decisions bytes); an ordinary plan has exactly the 15 C2 keys; prepare keeps its success keys and review text', async () => {
        check(eq(Object.keys(plan).sort(), sorted([...ORDINARY_PLAN_KEYS, 'security'])), 'the 15 ordinary keys plus security', Object.keys(plan).sort());
        check(plan.planSchema === 2 && eq(Object.keys(plan.security), ['decisionsSha256']) && plan.security.decisionsSha256 === sha(readBytes(runFile(root, id, T_DECISIONS))), 'security is exactly { decisionsSha256 } and hashes the raw decision file bytes', plan.security);
        check(eq(sorted(Object.keys(sc.p.prep.json)), PREPARE_KEYS) && sc.p.prep.json.review === reviewText(id), 'prepare keeps its existing success keys and its review instruction', Object.keys(sc.p.prep.json));
        const key = ['toolUnit', 'report', 'policy', 'controls', 'deny', 'skillInputs', 'securityDecisionsSha256'].filter((k) => hasOwn(plan, k));
        check(key.length === 0, 'there is no stored toolUnit, report, policy, controls, deny report, skill-input map or top-level securityDecisionsSha256', key);
        const ord = cloneBase(dir, v2, 'ord'); // not a clone of the prepared migration: that one still holds the lock of its own run
        const o = runSpec(kit, ord, 'run-c3-ord', { drafts: { [DOC_API]: '# api-conventions\n\nchanged\n' } });
        check(o.ok === true && eq(Object.keys(o.plan).sort(), ORDINARY_PLAN_KEYS), 'an ordinary prepared plan retains exactly the 15 keys of C2', o.plan && Object.keys(o.plan));
        const od = kit.diff(ord, 'run-c3-ord');
        check(od.code === 0 && od.json && !hasOwn(od.json, 'security') && eq(Object.keys(od.json).sort(), DIFF_KEYS), 'an ordinary diff has no security field and the C2 keys', od.json && Object.keys(od.json));
      });
      await step('the review reads and writes nothing it should not: repeated diffs agree, the tree and the lock stay put, and no Git runs; the control proves the shim intercepts a real Git call of a valid run', async () => {
        const c = clone1('norw');
        const diffShim = makeGitShim(context, dir); // its own records: the zero-Git observation never shares records with the control below
        const before = projectSnapshot(c);
        const a = kit.diff(c, id, { env: diffShim.env });
        const b = kit.diff(c, id, { env: diffShim.env });
        check(a.code === 0 && a.stdout === b.stdout && projectSnapshot(c) === before, 'the prepared diff is deterministic and writes nothing', { code: a.code, out: a.stdout.slice(0, 200) });
        check(diffShim.records().length === 0, 'the prepared migration diff invoked zero Git commands', diffShim.records());
        // C12-12 control: a valid initialized run whose lock and run ID match, in a fresh project, so only the failing Git can stop prepare. Without the shim the same
        // prepare succeeds; with it, prepare must reach Git (root discovery), fail with the fixed message, and leave actual shim records.
        const controlShim = makeGitShim(context, dir);
        const ctl = cloneBase(dir, await getPlainBase(context), 'ctl');
        const ctlId = 'run-c3-ctl2';
        check(kit.begin(ctl, ctlId) === true, 'control: lock acquire and init succeed, so the run is valid and its lock matches the run ID');
        const reference = kit.prepare(ctl, ctlId);
        check(reference.code === 0 && reference.json && reference.json.ok === true, 'control: without the shim the same prepare succeeds, so the shim alone decides the outcome', { code: reference.code, out: reference.stdout.slice(0, 200) });
        const control = kit.prepare(ctl, ctlId, { env: controlShim.env });
        const records = controlShim.records().map((l) => { try { return JSON.parse(l); } catch { return null; } });
        check(records.length >= 1 && records.every((r) => Array.isArray(r) && r.length >= 2), 'control: the shim recorded the Git calls prepare made', controlShim.records());
        // On Windows the preload records process.argv.slice(1), whose first element is the first Git argument resolved as a script path; only its last segment is the Git argument.
        check(records.length >= 1 && records[0] && eq([path.basename(String(records[0][0])), ...records[0].slice(1)], ['rev-parse', '--show-toplevel']), 'control: the first intercepted call is the root discovery (rev-parse --show-toplevel)', records[0]);
        check(control.code === 1 && control.stderr === '' && control.json && control.json.ok === false && control.json.error === 'not inside a git repository', 'control: the failing shim makes prepare stop with exactly "not inside a git repository" (exit 1)', { code: control.code, out: control.stdout.slice(0, 200), err: control.stderr.slice(0, 120) });
        check(diffShim.records().length === 0, 'the control did not add a record to the zero-Git diff observation', diffShim.records());
      });
      // ------------------------------------------------------------- drift ----
      const driftBoth = (label, mutate, rows, o = {}) => {
        const d = clone1('dd');
        mutate(d);
        const snapD = projectSnapshot(d);
        const rd = kit.diff(d, id);
        expectF(check, `${label} (diff)`, rd, { code: 'APPLY_DRIFT', exit: 4, error: MSG.DRIFT, extra: ['drift'] });
        check(eq(rd.json && rd.json.drift, rows), `${label} (diff): the exact drift array`, rd.json && rd.json.drift);
        check(projectSnapshot(d) === snapD, `${label} (diff): nothing changed`);
        const c = clone1('dc');
        mutate(c);
        const before = noWriteState(c, id);
        const rc = kit.commit(c, id, sc.p.sha);
        expectF(check, `${label} (commit)`, rc, { code: 'APPLY_DRIFT', exit: 4, error: MSG.DRIFT, extra: ['drift'] });
        check(eq(rc.json && rc.json.drift, rows), `${label} (commit): the exact drift array`, rc.json && rc.json.drift);
        checkNoWrite(check, `${label} (commit)`, c, id, before);
      };
      await step('decisions: changing or removing them after prepare is one trailing security-decisions row; adding them after an ordinary prepare is the same row', async () => {
        driftBoth('changed decisions', (r) => ws(runFile(r, id, T_DECISIONS)), [dr(T_DECISIONS, DRIFT_WHAT.DECISIONS)]);
        driftBoth('removed decisions', (r) => fs.rmSync(runFile(r, id, T_DECISIONS)), [dr(T_DECISIONS, DRIFT_WHAT.DECISIONS)]);
        const ord = cloneBase(dir, v2, 'ordd'); // a fresh v2 clone: the prepared migration's clone holds the lock of run-c3-clean
        const o = runSpec(kit, ord, 'run-c3-ord2', { drafts: { [DOC_API]: '# api-conventions\n\nchanged\n' } });
        check(o.ok === true && !hasOwn(o.plan, 'security'), 'an ordinary prepare binds no decisions file');
        if (!o.ok) return;
        const absentNow = (sub) => (r) => { sub(r); };
        for (const cmdName of ['diff', 'commit']) {
          const r = cloneTree(ord, path.join(dir, `add-${cmdName}`));
          putRequest(r, 'run-c3-ord2', T_DECISIONS, { schema: 1, reportSha256: H64('0'), entries: [], coverage: [], denyOmissions: [], dropDenyOwnership: [], overrideUserExceptions: false });
          const before = noWriteState(r, 'run-c3-ord2');
          const res = cmdName === 'diff' ? kit.diff(r, 'run-c3-ord2') : kit.commit(r, 'run-c3-ord2', o.sha);
          expectF(check, `adding decisions after an ordinary prepare (${cmdName})`, res, { code: 'APPLY_DRIFT', exit: 4, error: MSG.DRIFT, extra: ['drift'] });
          check(eq(res.json && res.json.drift, [dr(T_DECISIONS, DRIFT_WHAT.DECISIONS)]), `adding decisions (${cmdName}): the single row`, res.json && res.json.drift);
          if (cmdName === 'commit') checkNoWrite(check, 'adding decisions (commit)', r, 'run-c3-ord2', before);
        }
        void absentNow;
      });
      await step('every other bound input yields its C2 drift row: policy, settings, drafts, each request file and the manifest', async () => {
        driftBoth('the installed policy', (r) => ws(projPath(r, T_POLICY)), [dr(T_POLICY, DRIFT_WHAT.TARGET)]);
        driftBoth('the installed settings', (r) => ws(projPath(r, T_SETTINGS)), [dr(T_SETTINGS, DRIFT_WHAT.TARGET)]);
        driftBoth('the policy draft', (r) => ws(draftPath(r, id, T_POLICY)), [dr(T_POLICY, DRIFT_WHAT.SOURCE)]);
        driftBoth('the settings draft', (r) => ws(draftPath(r, id, T_SETTINGS)), [dr(T_SETTINGS, DRIFT_WHAT.SOURCE)]);
        driftBoth('the helper draft', (r) => ws(draftPath(r, id, T_HELPER)), [dr(T_HELPER, DRIFT_WHAT.SOURCE)]);
        driftBoth('the manifest', (r) => fs.appendFileSync(manifestPath(r), '\n'), [dr(T_MANIFEST, DRIFT_WHAT.MANIFEST)]);
        driftBoth('the installed reader', (r) => ws(projPath(r, T_READER)), [dr(T_READER, DRIFT_WHAT.TARGET)]);
        for (const name of requestFilesOf(root, id)) driftBoth(`the request file ${name}`, (r) => ws(runFile(r, id, name)), [dr(name, DRIFT_WHAT.REQUEST)]);
        check(requestFilesOf(root, id).length >= 3, 'the scenario stages at least ownership.json, managed-keys.json and manifest-metadata.json', requestFilesOf(root, id));
        driftBoth('decisions together with a request file', (r) => { ws(runFile(r, id, T_DECISIONS)); ws(runFile(r, id, 'managed-keys.json')); }, [dr('managed-keys.json', DRIFT_WHAT.REQUEST), dr(T_DECISIONS, DRIFT_WHAT.DECISIONS)]);
      });
      await step('an installed runtime target that the plan leaves unchanged is still bound: changing it is a transaction-input row', async () => {
        const u = cloneBase(dir, v2, 'unch');
        putFile(projPath(u, T_READER), SYNTH_READER);
        commitAll(context, u, 'the compatible reader is already installed');
        const s = startMigration(kit, check, u, 'run-c3-un1');
        check(s.ok === true, 'stage succeeds', s.st && s.st.stdout.slice(0, 300));
        if (!s.ok) return;
        check(!exists(draftPath(u, 'run-c3-un1', T_READER)), 'an identical installed reader is not staged again');
        const p = prepareApproving(kit, u, 'run-c3-un1');
        check(p.ok === true, 'prepare succeeds', p.prep && p.prep.stdout.slice(0, 300));
        if (!p.ok) return;
        check(p.plan.inputs.some((i) => i.target === T_READER && i.preRawSha === sha(readBytes(projPath(u, T_READER)))), 'the unchanged reader is bound by an inputs entry', p.plan.inputs.map((i) => i.target));
        const d = cloneTree(u, path.join(dir, 'unch-d'));
        fs.appendFileSync(projPath(d, T_READER), '// edited after prepare\n');
        const rd = kit.diff(d, 'run-c3-un1');
        expectF(check, 'a changed unchanged-runtime target (diff)', rd, { code: 'APPLY_DRIFT', exit: 4, error: MSG.DRIFT, extra: ['drift'] });
        check(eq(rd.json && rd.json.drift, [dr(T_READER, DRIFT_WHAT.INPUT)]), 'the drift row is a transaction input row', rd.json && rd.json.drift);
        const c = cloneTree(u, path.join(dir, 'unch-c'));
        fs.appendFileSync(projPath(c, T_READER), '// edited after prepare\n');
        const before = noWriteState(c, 'run-c3-un1');
        const rc = kit.commit(c, 'run-c3-un1', p.sha);
        expectF(check, 'a changed unchanged-runtime target (commit)', rc, { code: 'APPLY_DRIFT', exit: 4, error: MSG.DRIFT, extra: ['drift'] });
        checkNoWrite(check, 'unchanged-runtime drift (commit)', c, 'run-c3-un1', before);
      });
      // ------------------------------------------------ malformed security ----
      await step('malformed optional security data is APPLY_PLAN_INVALID (exit 1) in diff and commit, before any plan-named body is read', async () => {
        const valid = plan.security.decisionsSha256;
        const bad = [['an array', []], ['null', null], ['a string', 'x'], ['an empty object', {}], ['a short hash', { decisionsSha256: 'abc' }], ['an upper-case hash', { decisionsSha256: valid.toUpperCase() }], ['a number', { decisionsSha256: 5 }],
          ['an extra field', { decisionsSha256: valid, extra: 1 }], ['a plan-supplied decision path', { decisionsSha256: valid, path: '.ai/.run/x/security-decisions.json' }], ['only a path', { path: 'security-decisions.json' }]];
        for (const [label, value] of bad) {
          for (const cmdName of ['diff', 'commit']) {
            const r = clone1('mal');
            const pl = readPlan(r, id);
            pl.security = value;
            putFile(runFile(r, id, 'plan.json'), jsonText(pl));
            const newSha = planShaOf(r, id);
            const watch = [projPath(r, T_SETTINGS), projPath(r, T_READER), runFile(r, id, T_DECISIONS), draftPath(r, id, T_POLICY), draftPath(r, id, T_SETTINGS), draftPath(r, id, T_HELPER), draftPath(r, id, T_READER)];
            const guard = makeGuard(dir, watch, 'record');
            const before = noWriteState(r, id);
            const res = cmdName === 'diff' ? kit.diff(r, id, { preload: guard.file }) : kit.commit(r, id, newSha, { preload: guard.file });
            expectF(check, `${label} (${cmdName})`, res, { code: 'APPLY_PLAN_INVALID', exit: 1, error: MSG.PLAN_INVALID });
            check(guard.hits().length === 0, `${label} (${cmdName}): no plan-named body was read`, guard.hits().slice(0, 3));
            if (cmdName === 'commit') checkNoWrite(check, `${label} (commit)`, r, id, before);
          }
        }
        // control: the same rewrite through the same serializer without a change is accepted
        const r = clone1('malc');
        const pl = readPlan(r, id);
        putFile(runFile(r, id, 'plan.json'), jsonText(pl));
        const ok1 = kit.diff(r, id);
        check(ok1.code === 0 && ok1.json && ok1.json.ok === true, 'control: an unchanged rewrite of the plan is accepted by diff', ok1.stdout.slice(0, 200));
      });
      // ----------------------------------------- recomputed review evidence ----
      await step('the prepared review rebuilds its tool rows from the current catalog: a changed capability list shows in the review', async () => {
        const skill2 = deriveSkill(synth, dir, 'skill-caps', (s) => putFile(path.join(s, 'data', 'runtime-units.json'), jsonText({ schema: 1, units: [CATALOG_COMPAT.units[0], { ...CATALOG_COMPAT.units[1], policySchemas: [1, 2, 3] }] })));
        const k2 = kit.withSkill(skill2);
        const r = clone1('caps');
        const d = k2.diff(r, id);
        const row = d.json && d.json.security && d.json.security.toolUnit.find((x) => x.target === T_READER);
        check(d.code === 0 && row && eq(row.policySchemas, [1, 2, 3]), 'the review reports the current catalog capabilities, not anything stored in plan.json', row);
      });
      await step('a trusted-skill change that alters a staged projection is MIGRATION_OUTPUT_MISMATCH (F, exit 3) with the exact target and no partial review', async () => {
        const cases = [
          ['the shared helper source', 'assets/tools/security-policy.mjs', T_HELPER],
          ['the reader source', 'assets/tools/git-safe.mjs', T_READER],
        ];
        for (const [label, asset, target] of cases) {
          const skill2 = deriveSkill(synth, dir, `skill-mm-${path.basename(asset)}`, (s) => fs.appendFileSync(path.join(s, ...asset.split('/')), '// trusted skill change\n'));
          const k2 = kit.withSkill(skill2);
          const r = clone1('mm');
          const before = projectSnapshot(r);
          const d = k2.diff(r, id);
          expectF(check, `changed ${label}`, d, { code: 'MIGRATION_OUTPUT_MISMATCH', exit: 3, error: MSG.OUTPUT_MISMATCH(target), target });
          check(projectSnapshot(r) === before, `changed ${label}: nothing was written`);
        }
      });
      // ------------------------------------------------- unprepared diff ----
      await step('the unprepared migration diff uses the same evidence without a plan; invalid decisions and incompatible tools are pinned F / 3 refusals; no Git runs', async () => {
        const u = cloneBase(dir, v2, 'unprep');
        const s = startMigration(kit, check, u, 'run-c3-up1');
        check(s.ok === true, 'stage succeeds', s.st && s.st.stdout.slice(0, 300));
        if (!s.ok) return;
        const shim = makeGitShim(context, dir);
        const before = projectSnapshot(u);
        const d = kit.diff(u, 'run-c3-up1', { env: shim.env });
        check(d.code === 0 && d.json && d.json.ok === true && d.json.prepared === false && d.json.planSha256 === null && d.json.security && eq(Object.keys(d.json.security), ['report', 'controls', 'deny', 'toolUnit']), 'an unprepared diff of a staged migration carries the security evidence', { code: d.code, out: d.stdout.slice(0, 300) });
        check(d.json && d.json.security && eq(d.json.security.report, s.report) && eq(d.json.security.toolUnit.map((r) => r.target), [T_READER, T_HELPER]), 'the evidence is the one of the report and the staged tools', d.json && d.json.security && d.json.security.toolUnit.map((r) => r.target));
        check(projectSnapshot(u) === before && !exists(runFile(u, 'run-c3-up1', 'plan.json')) && !exists(runFile(u, 'run-c3-up1', 'journal.json')), 'it creates no plan, journal or directory');
        check(shim.records().length === 0, 'it invokes zero Git commands', shim.records());
        const controlRoot = cloneBase(dir, v2, 'up-control');
        kit.prepare(controlRoot, 'run-c3-upc', { env: shim.env });
        check(shim.records().length > 0, 'control: this shim does intercept the Git use of another command', shim.records().length);
        const badHash = cloneTree(u, path.join(dir, 'up-hash'));
        putRequest(badHash, 'run-c3-up1', T_DECISIONS, { ...s.decisions, reportSha256: H64('d') });
        expectF(check, 'unprepared diff with a changed report hash', kit.diff(badHash, 'run-c3-up1'), { code: 'MIGRATION_REPORT_CHANGED', exit: 3, error: MSG.REPORT_CHANGED, target: T_DECISIONS });
        const missing = cloneTree(u, path.join(dir, 'up-missing'));
        putRequest(missing, 'run-c3-up1', T_DECISIONS, { ...s.decisions, coverage: s.decisions.coverage.filter((c) => c.id !== 'coverage:7') });
        expectF(check, 'unprepared diff with a missing required decision', kit.diff(missing, 'run-c3-up1'), { code: 'MIGRATION_DECISION_REQUIRED', exit: 3, error: MSG.DECISION_REQUIRED('coverage:7'), target: T_DECISIONS });
        // incompatible tools: a scratch catalog whose reader declares schema 1 only (the production catalog became compatible at C4; no production assumption here)
        const real = cloneBase(dir, v2, 'up-real');
        const realKit = kit.withSkill(deriveSkill(synth, dir, 'skill-incompat-up', (s) => putFile(path.join(s, 'data', 'runtime-units.json'), jsonText(CATALOG_INITIAL))));
        const rs = startMigration(realKit, check, real, 'run-c3-up2');
        check(rs.ok === true, 'a scratch skill with an incompatible reader catalog stages a genuine v2 migration', rs.st && rs.st.stdout.slice(0, 300));
        if (rs.ok) expectF(check, 'unprepared diff with an incompatible reader catalog', realKit.diff(real, 'run-c3-up2'), { code: 'TOOL_UNIT_INCOMPATIBLE', exit: 3, error: MSG.TOOL_INCOMPATIBLE(T_READER), target: T_READER });
      });
      // I3-3 (docs/plans/2026-10-18-project-setup-v3-rc1-c3-decisions.md): migration reads respect the refusal set. A settings file or an installed runtime
      // target that the installed policy protects is never read and never staged; stage, prepare and the unprepared review refuse it by name.
      await step('I3-3 a protected settings file or runtime target is never read: stage fails MIGRATION_PROTECTED_INPUT (exit 3) with nothing staged; the unprepared review fails the same code with its target; prepare refuses it too', async () => {
        const text = (rel) => `migration input is protected by the security policy: ${rel}`;
        // control: without the protection the same stage reads the settings file (the read-recording preload sees it)
        const open = cloneBase(dir, v2, 'prot-control');
        kit.begin(open, 'run-c3-pc1');
        const openReport = kit.report(open).json;
        if (openReport && openReport.report) {
          putRequest(open, 'run-c3-pc1', T_DECISIONS, decisionsFile(openReport.report, { coverage: coverAll(openReport.report) }));
          const gc = makeGuard(dir, [projPath(open, T_SETTINGS)], 'record');
          const sc1 = kit.stage(open, 'run-c3-pc1', { preload: gc.file });
          check(sc1.code === 0 && gc.hits().length > 0, 'control: an unprotected settings file is read by stage (the guard sees the read)', { code: sc1.code, reads: gc.hits().length });
        } else check(false, 'control: the report succeeds');
        for (const [label, rel, rid] of [['the settings file', T_SETTINGS, 'run-c3-ps1'], ['an installed runtime target', T_READER, 'run-c3-pr1']]) {
          const root3 = cloneBase(dir, v2, `prot-${rid}`);
          editPolicy(context, root3, (p) => { p.projectPatterns = [...(p.projectPatterns || []), { anchor: 'root', glob: rel }]; });
          check(kit.begin(root3, rid), `${label}: the run starts`);
          const rep3 = kit.report(root3).json;
          if (!rep3 || !rep3.report) { check(false, `${label}: the report succeeds`); continue; }
          putRequest(root3, rid, T_DECISIONS, decisionsFile(rep3.report, { coverage: coverAll(rep3.report) }));
          const runBefore = snapshotTree(runDirOf(root3, rid));
          const g1 = makeGuard(dir, [projPath(root3, rel)], 'record');
          const st = kit.stage(root3, rid, { preload: g1.file });
          // PLAN-GAP: the decision gives the text without saying whether stage's own envelope carries the code prefix; both spellings are accepted there.
          check(st.code === 3 && st.stderr === '' && st.json && st.json.ok === false && st.json.code === 'MIGRATION_PROTECTED_INPUT' && (st.json.error === text(rel) || st.json.error === `MIGRATION_PROTECTED_INPUT: ${text(rel)}`) && eq(sorted(Object.keys(st.json)), ['code', 'error', 'ok']), `${label}: stage fails MIGRATION_PROTECTED_INPUT naming the path (F, exit 3)`, { code: st.code, out: st.stdout.slice(0, 300), err: st.stderr.slice(0, 120) });
          check(g1.hits().length === 0, `${label}: stage never read the protected path`, g1.hits().slice(0, 3));
          check(snapshotTree(runDirOf(root3, rid)) === runBefore, `${label}: nothing was staged or written in the run`);
          // The decision pins the review and prepare regressions for the settings file. For an installed runtime target nothing is staged here (stage refused
          // it), so the evaluation may legitimately fail earlier on the missing staged policy projection (section 3.12 puts projections before the tool phase,
          // where installed runtime targets are read); its stage regression above is what is asserted for it.
          if (rel !== T_SETTINGS) continue;
          const g2 = makeGuard(dir, [projPath(root3, rel)], 'record');
          const df = kit.diff(root3, rid, { preload: g2.file });
          expectF(check, `${label}: unprepared review`, df, { code: 'MIGRATION_PROTECTED_INPUT', exit: 3, error: text(rel), target: rel });
          check(g2.hits().length === 0, `${label}: the unprepared review never read the protected path`, g2.hits().slice(0, 3));
          const g3 = makeGuard(dir, [projPath(root3, rel)], 'record');
          const pr = kit.prepare(root3, rid, { approve: [T_POLICY], preload: g3.file });
          // PLAN-GAP: the decision pins prepare's evaluation only as "checks the path"; its P entry target and text are not pinned, so only the code is.
          check(pr.code === 3 && pr.stderr === '' && pr.json && pr.json.code === 'APPLY_PLAN_REJECTED' && Array.isArray(pr.json.errors) && pr.json.errors.some((e) => e.code === 'MIGRATION_PROTECTED_INPUT'), `${label}: prepare refuses with MIGRATION_PROTECTED_INPUT (P, exit 3)`, { code: pr.code, out: pr.stdout.slice(0, 300) });
          check(!exists(runFile(root3, rid, 'plan.json')) && g3.hits().length === 0, `${label}: prepare wrote no plan and never read the protected path`, g3.hits().slice(0, 3));
        }
      });
      await step('a decisions file that cannot be read maps exactly: prepare names security-decisions.json with the path-bearing message; diff is APPLY_DIFF_IO; commit refuses without writing', async () => {
        const rel = `.ai/.run/${id}/${T_DECISIONS}`;
        const u = cloneBase(dir, v2, 'io');
        const s = startMigration(kit, check, u, 'run-c3-io1');
        if (s.ok) {
          const g = makeGuard(dir, [runFile(u, 'run-c3-io1', T_DECISIONS)], 'fail');
          const p = kit.prepare(u, 'run-c3-io1', { approve: [T_POLICY], preload: g.file });
          expectP(check, 'prepare with an unreadable decisions file', p, [{ target: T_DECISIONS, code: 'APPLY_INPUT_IO', error: `cannot read transaction input: .ai/.run/run-c3-io1/${T_DECISIONS}` }]);
          const dd = kit.diff(u, 'run-c3-io1', { preload: makeGuard(dir, [runFile(u, 'run-c3-io1', T_DECISIONS)], 'fail').file });
          expectF(check, 'unprepared diff with an unreadable decisions file', dd, { code: 'APPLY_DIFF_IO', exit: 2, error: `cannot read draft review input: .ai/.run/run-c3-io1/${T_DECISIONS}` });
        }
        const r = clone1('io2');
        const gd = makeGuard(dir, [runFile(r, id, T_DECISIONS)], 'fail');
        const d = kit.diff(r, id, { preload: gd.file });
        expectF(check, 'prepared diff with an unreadable decisions file', d, { code: 'APPLY_DIFF_IO', exit: 2, error: `cannot read draft review input: ${rel}` });
        const c = clone1('io3');
        const before = noWriteState(c, id);
        const rc = kit.commit(c, id, sc.p.sha, { preload: makeGuard(dir, [runFile(c, id, T_DECISIONS)], 'fail').file });
        // PLAN-GAP: the commit mapping of an unreadable bound decisions file is not pinned (the C2 binding recheck reports drift for an unreadable
        // bound file, the transaction-input mapping reports APPLY_INPUT_IO); both are refusals that write nothing, and only that is asserted.
        check(rc.code !== 0 && !(rc.json && rc.json.committed === true), 'commit with an unreadable bound decisions file does not succeed', { code: rc.code, out: rc.stdout.slice(0, 300) });
        checkNoWrite(check, 'commit with an unreadable decisions file', c, id, before);
      });
    });
  });
}

// ============================================== R80/C3/tool-unit ====
// Plan 3.9 and 4.6: the runtime unit catalog, the pure compatibility check, reader-before-policy ordering, the workflow gate and the commit-time rebuild.
const trow = (o = {}) => ({ source: 'assets/tools/x.mjs', target: '.ai/tools/x.mjs', role: 'helper', policySchemas: [1, 2], reviewedSha256: H64('a'), installedSha256: null, plannedSha256: null, ...o });
const T_ERR = {
  INPUT: 'TOOL_UNIT_INPUT: invalid security tool unit',
};
// Rewrites plan.json of a copy of a prepared run and returns the approved hash of the rewritten bytes.
function forgePlan(root, id, mutate) {
  const plan = readPlan(root, id);
  mutate(plan, root);
  putFile(runFile(root, id, 'plan.json'), jsonText(plan));
  return planShaOf(root, id);
}
// A commit refusal that happens before any write, with an optional target field (PLAN-GAP: 3.12 pins the target of tool and catalog failures only).
function expectFMaybeTarget(check, label, r, { code, exit, error }) {
  check(r.code === exit && r.stderr === '' && r.json !== null && fmtOk(r), `${label}: exit ${exit}, empty stderr, two-space JSON`, { code: r.code, out: r.stdout.slice(0, 300), err: r.stderr.slice(0, 120) });
  const j = r.json || {};
  check(j.ok === false && j.code === code && j.error === error, `${label}: ${code}`, { code: j.code, error: j.error });
  check(Object.keys(j).every((k) => ['ok', 'code', 'error', 'target'].includes(k)), `${label}: only ok, code, error and an optional target`, Object.keys(j));
}
async function toolUnit(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mig = await needSafeScript(failures, context, 'migrate-security-paths.mjs');
    const kit = makeKit(context, check);
    // ---------------------------------------------------------- the catalog ----
    if (mig && needFns(failures, mig, ['readRuntimeUnits', 'checkSecurityToolUnit'])) {
      await step('data/runtime-units.json is the catalog of plan 3.9 and passes its own reader; later entries and unusual names are accepted (no basename or capability enumeration)', async () => {
        const file = readJson(path.join(context.skillRoot, 'data', 'runtime-units.json'));
        // The shipped catalog is extended by later components (C4 added the git-safe-core helper and made the reader [1, 2]); its exact production content is
        // asserted by R78/C4/reader-unit. Here it must pass its own reader and keep the two entries C3 defined, without pinning the reader's capabilities.
        const shipped = await runPure(check, 'the shipped catalog', mig.readRuntimeUnits, file);
        check(shipped && file && Array.isArray(file.units) && file.units.some((u) => u.target === T_HELPER && u.source === 'assets/tools/security-policy.mjs' && u.role === 'helper' && eq(u.policySchemas, [1, 2])) && file.units.some((u) => u.target === T_READER && u.source === 'assets/tools/git-safe.mjs' && u.role === 'entrypoint'), 'the shipped catalog passes its own reader and keeps the security-policy helper [1, 2] and the git-safe entrypoint', file);
        const r = await runPure(check, 'the initial catalog', mig.readRuntimeUnits, CATALOG_INITIAL);
        const text = JSON.stringify(r);
        check(r && typeof r === 'object' && [T_HELPER, T_READER, 'assets/tools/security-policy.mjs', 'assets/tools/git-safe.mjs', 'helper', 'entrypoint'].every((s) => text.includes(s)), 'the result carries every unit', text && text.slice(0, 200));
        const extended = { schema: 1, units: [...CATALOG_INITIAL.units, { source: 'assets/tools/extra.mjs', target: '.ai/tools/extra.mjs', role: 'helper', policySchemas: [2, 3] }, { source: 'assets/tools/odd name.mjs', target: '.ai/tools/odd name.mjs', role: 'entrypoint', policySchemas: [7] }] };
        const e = await attempt(() => mig.readRuntimeUnits(deepFreeze(clone(extended))));
        check(!e.threw && JSON.stringify(e.value).includes('.ai/tools/extra.mjs') && JSON.stringify(e.value).includes('odd name'), 'later components may add entries and supported schema numbers', e.threw ? errMsg(e.error) : null);
        const reordered = { schema: 1, units: [CATALOG_INITIAL.units[1], CATALOG_INITIAL.units[0]] };
        const o = await attempt(() => mig.readRuntimeUnits(deepFreeze(clone(reordered))));
        check(!o.threw, 'the order of the two required entries does not matter', o.threw ? errMsg(o.error) : null);
      });
      await step('a malformed catalog shape, or a missing or wrong required entry, is TOOL_CATALOG', async () => {
        const u = CATALOG_INITIAL.units;
        const bad = [
          ['null', null], ['an array', []], ['a string', 'x'], ['schema 2', { schema: 2, units: u }], ['a string schema', { schema: '1', units: u }], ['no units', { schema: 1 }], ['empty units', { schema: 1, units: [] }], ['units not an array', { schema: 1, units: {} }],
          ['a unit that is not an object', { schema: 1, units: [...u, null] }], ['a missing source', { schema: 1, units: [...u, { target: '.ai/tools/a.mjs', role: 'helper', policySchemas: [1] }] }], ['an empty source', { schema: 1, units: [...u, { source: '', target: '.ai/tools/a.mjs', role: 'helper', policySchemas: [1] }] }],
          ['an empty target', { schema: 1, units: [...u, { source: 'assets/tools/a.mjs', target: '', role: 'helper', policySchemas: [1] }] }], ['a non-string target', { schema: 1, units: [...u, { source: 'assets/tools/a.mjs', target: 5, role: 'helper', policySchemas: [1] }] }],
          ['an unknown role', { schema: 1, units: [...u, { source: 'assets/tools/a.mjs', target: '.ai/tools/a.mjs', role: 'other', policySchemas: [1] }] }], ['policySchemas not an array', { schema: 1, units: [...u, { source: 'assets/tools/a.mjs', target: '.ai/tools/a.mjs', role: 'helper', policySchemas: 1 }] }],
          ['a string policy schema', { schema: 1, units: [...u, { source: 'assets/tools/a.mjs', target: '.ai/tools/a.mjs', role: 'helper', policySchemas: ['1'] }] }], ['a fractional policy schema', { schema: 1, units: [...u, { source: 'assets/tools/a.mjs', target: '.ai/tools/a.mjs', role: 'helper', policySchemas: [1.5] }] }],
          ['a duplicate target', { schema: 1, units: [...u, { source: 'assets/tools/other.mjs', target: T_READER, role: 'entrypoint', policySchemas: [1] }] }],
          ['the helper entry missing', { schema: 1, units: [u[1]] }], ['the reader entry missing', { schema: 1, units: [u[0]] }], ['the helper with the wrong role', { schema: 1, units: [{ ...u[0], role: 'entrypoint' }, u[1]] }], ['the reader with the wrong role', { schema: 1, units: [u[0], { ...u[1], role: 'helper' }] }],
          ['the helper with another source', { schema: 1, units: [{ ...u[0], source: 'assets/tools/elsewhere.mjs' }, u[1]] }], ['the reader with another target', { schema: 1, units: [u[0], { ...u[1], target: '.ai/tools/other.mjs' }] }],
        ];
        for (const [label, value] of bad) await expectErr(check, label, () => mig.readRuntimeUnits(deepFreeze(clone(value))), 'TOOL_CATALOG', MSG.TOOL_CATALOG);
      });
      await step('checkSecurityToolUnit: compatible reviewed rows succeed with sorted targets and the pinned write order (security-policy helper, other helpers sorted, entrypoints sorted)', async () => {
        const A = H64('1');
        const rows = [
          trow({ source: 'assets/tools/z-helper.mjs', target: '.ai/tools/z-helper.mjs', reviewedSha256: A, plannedSha256: A }),
          trow({ source: 'assets/tools/security-policy.mjs', target: T_HELPER, reviewedSha256: A, installedSha256: A }),
          trow({ source: 'assets/tools/a-helper.mjs', target: '.ai/tools/a-helper.mjs', reviewedSha256: A, plannedSha256: A }),
          trow({ source: 'assets/tools/git-safe.mjs', target: T_READER, role: 'entrypoint', reviewedSha256: A, plannedSha256: A }),
          trow({ source: 'assets/tools/b-entry.mjs', target: '.ai/tools/b-entry.mjs', role: 'entrypoint', reviewedSha256: A, installedSha256: A }),
        ];
        const want = { targets: ['.ai/tools/a-helper.mjs', '.ai/tools/b-entry.mjs', T_READER, T_HELPER, '.ai/tools/z-helper.mjs'], writeOrder: [T_HELPER, '.ai/tools/a-helper.mjs', '.ai/tools/z-helper.mjs', '.ai/tools/b-entry.mjs', T_READER] };
        const out = await runPure(check, 'a compatible unit', (r) => mig.checkSecurityToolUnit(r, 2), rows);
        check(eq(out, want), 'targets sorted lexically; writeOrder: helper first, other helpers sorted, then entrypoints sorted', out);
        const noPolicyHelper = await attempt(() => mig.checkSecurityToolUnit(deepFreeze(clone(rows.filter((r) => r.target !== T_HELPER))), 2));
        check(!noPolicyHelper.threw && eq(noPolicyHelper.value.writeOrder, ['.ai/tools/a-helper.mjs', '.ai/tools/z-helper.mjs', '.ai/tools/b-entry.mjs', T_READER]), 'without the security-policy helper the other helpers lead in sorted order', noPolicyHelper.threw ? errMsg(noPolicyHelper.error) : noPolicyHelper.value);
      });
      await step('the check picks the planned hash over the installed one; a missing or different candidate is TOOL_UNIT_UNREVIEWED; a missing schema is TOOL_UNIT_INCOMPATIBLE', async () => {
        const A = H64('1'); const B = H64('2');
        const call = (rows, schema = 2) => () => mig.checkSecurityToolUnit(deepFreeze(clone(rows)), schema);
        const ok = [
          ['the planned hash equals the reviewed hash', trow({ reviewedSha256: A, plannedSha256: A })], ['only the installed hash equals the reviewed hash', trow({ reviewedSha256: A, installedSha256: A })],
          ['the installed hash differs but the planned hash matches', trow({ reviewedSha256: A, installedSha256: B, plannedSha256: A })],
        ];
        for (const [label, r] of ok) { const o = await attempt(call([r])); check(!o.threw, `accepted: ${label}`, o.threw ? errMsg(o.error) : null); }
        const target = '.ai/tools/x.mjs';
        for (const [label, r] of [['no candidate at all', trow({ reviewedSha256: A })], ['a planned hash that differs', trow({ reviewedSha256: A, plannedSha256: B })], ['the installed hash right but the planned hash wrong', trow({ reviewedSha256: A, installedSha256: A, plannedSha256: B })], ['an installed hash that differs', trow({ reviewedSha256: A, installedSha256: B })]]) {
          await expectErr(check, label, call([r]), 'TOOL_UNIT_UNREVIEWED', MSG.TOOL_UNREVIEWED(target));
        }
        await expectErr(check, 'a row whose capabilities lack the requested schema', call([trow({ policySchemas: [1], reviewedSha256: A, plannedSha256: A })]), 'TOOL_UNIT_INCOMPATIBLE', MSG.TOOL_INCOMPATIBLE(target));
        await expectErr(check, 'capability is checked before absence', call([trow({ policySchemas: [1] })]), 'TOOL_UNIT_INCOMPATIBLE', MSG.TOOL_INCOMPATIBLE(target));
        await expectErr(check, 'the requested schema is the policy schema argument', call([trow({ policySchemas: [2], reviewedSha256: A, plannedSha256: A })], 1), 'TOOL_UNIT_INCOMPATIBLE', MSG.TOOL_INCOMPATIBLE(target));
        const tb = trow({ source: 'assets/tools/b.mjs', target: '.ai/tools/b.mjs', policySchemas: [1] });
        const ta = trow({ source: 'assets/tools/a.mjs', target: '.ai/tools/a.mjs', reviewedSha256: A });
        await expectErr(check, 'rows are checked in target order whatever the input order: a is unreviewed before b is incompatible', call([tb, ta]), 'TOOL_UNIT_UNREVIEWED', MSG.TOOL_UNREVIEWED('.ai/tools/a.mjs'));
        await expectErr(check, 'an incompatible a is reported before an unreviewed b', call([trow({ source: 'assets/tools/b.mjs', target: '.ai/tools/b.mjs', reviewedSha256: A }), trow({ source: 'assets/tools/a.mjs', target: '.ai/tools/a.mjs', policySchemas: [1] })]), 'TOOL_UNIT_INCOMPATIBLE', MSG.TOOL_INCOMPATIBLE('.ai/tools/a.mjs'));
      });
      await step('malformed rows, duplicate targets, malformed hashes and a non-integer policy schema are TOOL_UNIT_INPUT', async () => {
        const A = H64('a'); // hex letters, so that A.toUpperCase() differs from A
        const good = trow({ reviewedSha256: A, plannedSha256: A });
        const bad = [
          ['rows not an array', 'x', 2], ['rows null', null, 2], ['a row that is not an object', [null], 2], ['a missing field', [(() => { const r = clone(good); delete r.role; return r; })()], 2], ['a missing hash field', [(() => { const r = clone(good); delete r.installedSha256; return r; })()], 2],
          ['a duplicate target', [good, clone(good)], 2], ['a malformed reviewed hash', [{ ...good, reviewedSha256: 'abc' }], 2], ['an upper-case planned hash', [{ ...good, plannedSha256: A.toUpperCase() }], 2], ['a numeric installed hash', [{ ...good, installedSha256: 5 }], 2],
          ['an unknown role', [{ ...good, role: 'other' }], 2], ['policySchemas not an array', [{ ...good, policySchemas: 2 }], 2], ['a fractional capability', [{ ...good, policySchemas: [1.5] }], 2], ['a fractional policy schema', [good], 2.5], ['a string policy schema', [good], '2'], ['a missing policy schema', [good], undefined],
          ['a source that is not a string', [{ ...good, source: 5 }], 2], ['an empty target', [{ ...good, target: '' }], 2],
        ];
        for (const [label, rows, schema] of bad) await expectErr(check, label, () => mig.checkSecurityToolUnit(deepFreeze(clone(rows)), schema), 'TOOL_UNIT_INPUT', T_ERR.INPUT);
      });
    }
    // ------------------------------------------- a genuine v2 with the real skill ----
    const v2 = await useBase(failures, 'genuine v2', getV2Base, context);
    const synth = await useBase(failures, 'synthetic skill', getSynthSkill, context);
    if (!v2 || !synth) return;
    const clean = await useBase(failures, 'prepared clean migration', cleanPrepared, context);
    if (clean) withBuildFailures(failures, clean);
    await withScratch(context, 'r80t', async (dir) => {
      let n = 0;
      const synthKit = makeKit(context, check, synth.root);
      await step('a genuine v2 stage succeeds with the missing security-policy helper; prepare then refuses at .ai/tools/git-safe.mjs with TOOL_UNIT_INCOMPATIBLE (P, exit 3), before approvals, without a plan (a scratch catalog whose reader declares [1] only)', async () => {
        const root = cloneBase(dir, v2, 'real');
        const incompatKit = kit.withSkill(deriveSkill(synth, dir, 'skill-incompat-t1', (s) => putFile(path.join(s, 'data', 'runtime-units.json'), jsonText(CATALOG_INITIAL))));
        const s = startMigration(incompatKit, check, root, 'run-c3-t1');
        check(s.ok === true, 'stage succeeds against the scratch incompatible catalog', s.st && s.st.stdout.slice(0, 300));
        if (!s.ok) return;
        check((s.st.json.staged || []).includes(`drafts/${T_HELPER}`), 'the absent security-policy helper is staged', s.st.json.staged);
        const helperAsset = readBytes(path.join(context.skillRoot, 'assets', 'tools', 'security-policy.mjs'));
        check(NH(readBytes(draftPath(root, 'run-c3-t1', T_HELPER)) || '') === NH(helperAsset || ''), 'the staged helper is the trusted skill source');
        const before = projectSnapshot(root);
        const lockBefore = readBytes(lockOwnerPath(root));
        const entry = { target: T_READER, code: 'TOOL_UNIT_INCOMPATIBLE', error: MSG.TOOL_INCOMPATIBLE(T_READER) };
        expectP(check, 'prepare without approvals', incompatKit.prepare(root, 'run-c3-t1'), [entry]);
        expectP(check, 'prepare with the policy approval', incompatKit.prepare(root, 'run-c3-t1', { approve: [T_POLICY] }), [entry]);
        check(!exists(runFile(root, 'run-c3-t1', 'plan.json')) && projectSnapshot(root) === before && sameBytes(readBytes(lockOwnerPath(root)), lockBefore), 'a refused prepare writes no plan and touches nothing');
      });
      await step('a synthetic compatible reader and the shared helper succeed; the catalog writes precede the policy and the manifest, the helper precedes the reader', async () => {
        if (!clean || !clean.p.ok) { check(false, 'the clean migration prepared'); return; }
        const plan = clean.p.plan;
        check(eq(plan.ops.map((o) => o.target), [T_HELPER, T_READER, T_SETTINGS, T_POLICY]), 'plan operations: helper, reader, the other content targets in target order, the policy last', plan.ops.map((o) => o.target));
        const r = cloneTree(clean.root, path.join(dir, `ok${++n}`));
        const c = synthKit.commit(r, clean.id, clean.p.sha);
        check(c.code === 0 && c.json && c.json.committed === true && eq(c.json.written, [{ target: T_HELPER, created: true }, { target: T_READER, created: false }, { target: T_SETTINGS, created: false }, { target: T_POLICY, created: false }, { target: T_MANIFEST, created: false }]), 'commit writes in plan order with the manifest last; only the helper is created', c.json && c.json.written);
        const j = readJournal(r, clean.id);
        check(j && eq(j.entries.map((e) => e.target), [T_HELPER, T_READER, T_SETTINGS, T_POLICY, T_MANIFEST]) && j.entries.every((e) => e.state === 'applied'), 'one journal with every entry applied, in that order', j && j.entries.map((e) => `${e.target}:${e.state}`));
        check(NH(readBytes(projPath(r, T_READER))) === SKILL_REVIEWED(synth.root, 'assets/tools/git-safe.mjs') && NH(readBytes(projPath(r, T_HELPER))) === SKILL_REVIEWED(synth.root, 'assets/tools/security-policy.mjs'), 'the installed reader and helper are the reviewed trusted sources');
        const rec = readManifestFile(r).files;
        check(rec[T_HELPER] && rec[T_HELPER].ownership === 'full' && rec[T_HELPER].sha256 === NH(readBytes(projPath(r, T_HELPER))) && rec[T_READER].ownership === 'full' && rec[T_READER].sha256 === NH(readBytes(projPath(r, T_READER))), 'the helper and the reader are recorded as full with the hash of their installed bytes');
      });
      await step('a new reader parses the old schema-1 policy and the migrated schema-2 policy without modifying either', async () => {
        const probe = path.join(dir, 'reader-probe');
        putFile(path.join(probe, '.ai', 'tools', 'git-safe.mjs'), SYNTH_READER);
        putFile(path.join(probe, '.ai', 'tools', 'security-policy.mjs'), readBytes(path.join(context.skillRoot, 'assets', 'tools', 'security-policy.mjs')));
        const oldPolicy = readBytes(path.join(context.skillRoot, 'data', 'secret-paths-v2.0.0.json'));
        putFile(path.join(probe, '.ai', 'security-paths.json'), oldPolicy);
        const r1 = execNode(context, { cwd: probe, script: path.join(probe, '.ai', 'tools', 'git-safe.mjs') });
        check(r1.code === 0 && r1.json && r1.json.ok === true && r1.json.sourceSchema === 1 && r1.json.patterns === 19, 'the reader parses the schema-1 policy', { code: r1.code, out: r1.stdout.slice(0, 200), err: r1.stderr.slice(0, 200) });
        check(sameBytes(readBytes(path.join(probe, '.ai', 'security-paths.json')), oldPolicy), 'the old policy is not modified');
        if (!clean || !clean.p.ok) return;
        const r = cloneTree(clean.root, path.join(dir, `ok${++n}`));
        const c = synthKit.commit(r, clean.id, clean.p.sha);
        check(c.code === 0, 'the migration commits', c.stdout.slice(0, 200));
        const newPolicy = readBytes(projPath(r, T_POLICY));
        const r2 = execNode(context, { cwd: r, script: projPath(r, T_READER) });
        check(r2.code === 0 && r2.json && r2.json.sourceSchema === 2 && r2.json.patterns === 20, 'the same reader parses the migrated schema-2 policy', { code: r2.code, out: r2.stdout.slice(0, 200), err: r2.stderr.slice(0, 200) });
        check(sameBytes(readBytes(projPath(r, T_POLICY)), newPolicy), 'the migrated policy is not modified by the reader');
      });
      await step('plans without a catalog runtime target keep the C2 operation order, a policy-only plan included; generic schema-2 drafts with no consumer stay valid', async () => {
        const plain = await useBase(failures, 'plain', getPlainBase, context);
        if (!plain) return;
        const root = cloneBase(dir, plain, 'noruntime');
        const policy1 = jsonText({ schema: 1, patterns: [{ glob: '**/k' }] });
        const p = runSpec(kit, root, 'run-c3-t2', { drafts: { [T_POLICY]: policy1, 'docs/a.md': '# a\n', '.ai/zz-note.md': '# n\n' } });
        check(p.ok === true && eq(p.plan.ops.map((o) => o.target), ['.ai/security-paths.json', '.ai/zz-note.md', 'docs/a.md']), 'with no runtime target the policy keeps its sorted place (C2 order)', p.plan && p.plan.ops.map((o) => o.target));
        const root2 = cloneBase(dir, plain, 'policyonly');
        const p2 = runSpec(kit, root2, 'run-c3-t3', { drafts: { [T_POLICY]: policy1 } });
        check(p2.ok === true && eq(p2.plan.ops.map((o) => o.target), [T_POLICY]), 'a policy-only plan is unchanged by C3 ordering', p2.plan && p2.plan.ops.map((o) => o.target));
        const root3 = cloneBase(dir, plain, 'schema2generic');
        const p3 = runSpec(kit, root3, 'run-c3-t4', { drafts: { [T_POLICY]: jsonText(pol2([{ anchor: 'any', glob: '**/k' }])), 'docs/a.md': '# a\n' } });
        check(p3.ok === true && !hasOwn(p3.plan, 'security'), 'a generic schema-2 policy draft with no catalog runtime installed or staged needs no decisions', p3.prep && p3.prep.stdout.slice(0, 300));
      });
      // -------------------------------------------------- the workflow gate ----
      const S2POLICY = jsonText(pol2([{ anchor: 'any', glob: '**/*.pem' }]));
      await step('a schema-2 policy change with installed tools and no decisions is MIGRATION_REQUIRED in prepare (P) and in the unprepared diff (F, target the policy); unchanged, schema-1, metadata-only and no-consumer controls do not trigger it', async () => {
        const root = cloneBase(dir, v2, 'gate');
        kit.begin(root, 'run-c3-g1');
        putDraft(root, 'run-c3-g1', T_POLICY, S2POLICY);
        const entry = { target: T_POLICY, code: 'MIGRATION_REQUIRED', error: MSG.MIGRATION_REQUIRED };
        expectF(check, 'unprepared diff', kit.diff(root, 'run-c3-g1'), { code: 'MIGRATION_REQUIRED', exit: 3, error: MSG.MIGRATION_REQUIRED, target: T_POLICY });
        expectP(check, 'prepare', kit.prepare(root, 'run-c3-g1'), [entry]);
        check(!exists(runFile(root, 'run-c3-g1', 'plan.json')), 'no plan was written');
        // controls
        const ctl = (label, spec, tweak) => {
          const r = cloneBase(dir, v2, `ctl-${label}`);
          const p = runSpec(kit, r, `run-c3-c-${label}`, spec);
          check(p.ok === true && !hasOwn(p.plan, 'security'), `control (${label}): prepare succeeds without decisions`, p.prep && p.prep.stdout.slice(0, 300));
          if (tweak && p.ok) tweak(p);
        };
        ctl('unchanged', { drafts: { [T_POLICY]: readBytes(projPath(v2.root, T_POLICY)), [DOC_API]: '# api-conventions\n\nchanged\n' } });
        ctl('schema1', { drafts: { [T_POLICY]: jsonText({ ...readJson(projPath(v2.root, T_POLICY)), codexGlobScanMaxDepth: 7 }) } });
        const f = baseFacts(v2.root);
        ctl('meta', { requests: { 'ownership.json': { [T_POLICY]: 'keys' }, 'managed-keys.json': { [T_POLICY]: f.policyManaged } }, o: { approve: [T_POLICY] } });
        const plain = await getPlainBase(context);
        const pr = cloneBase(dir, plain, 'ctl-plain');
        const pp = runSpec(kit, pr, 'run-c3-c-plain', { drafts: { [T_POLICY]: S2POLICY } });
        check(pp.ok === true && !hasOwn(pp.plan, 'security'), 'control (no consumer): a schema-2 draft without any catalog runtime is not gated', pp.prep && pp.prep.stdout.slice(0, 300));
        // the staged-runtime trigger: a runtime asset drafted into an otherwise bare project also counts as "staged"
        const bare = cloneBase(dir, plain, 'gate-staged');
        const sp = runSpec(kit, bare, 'run-c3-g2', { drafts: { [T_POLICY]: S2POLICY, [T_HELPER]: readBytes(path.join(context.skillRoot, 'assets', 'tools', 'security-policy.mjs')) } });
        check(sp.ok !== true && sp.prep && sp.prep.json && Array.isArray(sp.prep.json.errors) && sp.prep.json.errors.some((e) => e.target === T_POLICY && e.code === 'MIGRATION_REQUIRED'), 'a catalog runtime target that is staged (not installed) also triggers the workflow', sp.prep && sp.prep.stdout.slice(0, 300));
      });
      await step('a later schema-2 edit of a migrated project, with tools installed, goes through the migration workflow too', async () => {
        if (!clean || !clean.p.ok) { check(false, 'the clean migration prepared'); return; }
        const r = cloneTree(clean.root, path.join(dir, `ok${++n}`));
        check(synthKit.commit(r, clean.id, clean.p.sha).code === 0, 'the migration commits');
        check(synthKit.lock(r, ['release', '--run-id', clean.id]).code === 0, 'the run releases its lock');
        kit.begin(r, 'run-c3-g3');
        const policy = readJson(projPath(r, T_POLICY));
        policy.projectPatterns = [...policy.projectPatterns, { anchor: 'root', glob: 'env/**' }];
        putDraft(r, 'run-c3-g3', T_POLICY, jsonText(policy));
        expectP(check, 'a later projectPatterns edit without decisions', kit.prepare(r, 'run-c3-g3'), [{ target: T_POLICY, code: 'MIGRATION_REQUIRED', error: MSG.MIGRATION_REQUIRED }]);
      });
      await step('an edited installed reader keeps C2\'s exact approval refusal until its own path is approved', async () => {
        const root = cloneBase(dir, v2, 'edited');
        fs.appendFileSync(projPath(root, T_READER), '// local user edit\n');
        commitAll(context, root, 'user edited the reader');
        const s = startMigration(synthKit, check, root, 'run-c3-e1');
        check(s.ok === true, 'stage succeeds', s.st && s.st.stdout.slice(0, 300));
        if (!s.ok) return;
        const refused = synthKit.prepare(root, 'run-c3-e1', { approve: [T_POLICY] });
        expectPEntry(check, 'the edited reader without its approval', refused, { target: T_READER, code: 'APPLY_APPROVAL_REQUIRED', error: contentApprovalError(T_READER, [EDITED_FULL]) });
        const p = prepareApproving(synthKit, root, 'run-c3-e1', [T_POLICY, T_READER]);
        check(p.ok === true && p.approved.includes(T_READER), 'approving the reader path lets the migration prepare', p.prep && p.prep.stdout.slice(0, 300));
        // the shared helper too: a user file already sitting at its target is not the skill's, so replacing it keeps C2's approval text for such a file
        const userHelper = cloneBase(dir, v2, 'edited-helper');
        putFile(projPath(userHelper, T_HELPER), '// a helper the user wrote\n');
        commitAll(context, userHelper, 'a user file at the helper target');
        const hs = startMigration(synthKit, check, userHelper, 'run-c3-e2');
        check(hs.ok === true, 'stage succeeds with a user file at the helper target', hs.st && hs.st.stdout.slice(0, 300));
        if (hs.ok) {
          const hr = synthKit.prepare(userHelper, 'run-c3-e2', { approve: [T_POLICY] });
          expectPEntry(check, 'the user file at the helper target without its approval', hr, { target: T_HELPER, code: 'APPLY_APPROVAL_REQUIRED', error: contentApprovalError(T_HELPER, ['draft changes content outside managed blocks (pre-existing file the skill does not own)']) });
          const hp = prepareApproving(synthKit, userHelper, 'run-c3-e2', [T_POLICY, T_HELPER]);
          check(hp.ok === true && hp.approved.includes(T_HELPER), 'approving the helper path lets the migration prepare', hp.prep && hp.prep.stdout.slice(0, 300));
        }
      });
      // ------------------------------------------------ the commit rebuild ----
      if (!clean || !clean.p.ok) return;
      const pre = (label) => cloneTree(clean.root, path.join(dir, `${label}${++n}`));
      await step('commit rebuilds trusted capabilities: a catalog whose reader declares [1] refuses the same plan with TOOL_UNIT_INCOMPATIBLE (F, exit 3) and its target, before heartbeat, journal or write', async () => {
        const incompatKit = kit.withSkill(deriveSkill(synth, dir, `skill-incompat-x${++n}`, (s) => putFile(path.join(s, 'data', 'runtime-units.json'), jsonText(CATALOG_INITIAL))));
        const r = pre('xskill');
        const before = noWriteState(r, clean.id);
        const rc = incompatKit.commit(r, clean.id, clean.p.sha);
        expectF(check, 'commit by a skill with an incompatible reader catalog', rc, { code: 'TOOL_UNIT_INCOMPATIBLE', exit: 3, error: MSG.TOOL_INCOMPATIBLE(T_READER), target: T_READER });
        checkNoWrite(check, 'commit by a skill with an incompatible reader catalog', r, clean.id, before);
        // a forged hash-approved plan that keeps the old reader (no reader operation, draft or binding at all) cannot make it acceptable either: the
        // trusted capability list is rebuilt and takes precedence over the missing candidate role
        const f = pre('forged-old-reader');
        rmrf(draftPath(f, clean.id, T_READER));
        const forgedSha = forgePlan(f, clean.id, (plan) => {
          plan.ops = plan.ops.filter((o) => o.target !== T_READER);
          plan.sourceInventory = plan.sourceInventory.filter((s) => s.target !== T_READER);
          plan.inputs = plan.inputs.filter((i) => i.target !== T_READER);
        });
        const fb = noWriteState(f, clean.id);
        const fc = incompatKit.commit(f, clean.id, forgedSha);
        expectF(check, 'a forged plan that keeps the old reader', fc, { code: 'TOOL_UNIT_INCOMPATIBLE', exit: 3, error: MSG.TOOL_INCOMPATIBLE(T_READER), target: T_READER });
        checkNoWrite(check, 'a forged plan that keeps the old reader', f, clean.id, fb);
      });
      await step('a trusted catalog replaced by [1] after prepare gives the same failure before manifest verification', async () => {
        const skill2 = deriveSkill(synth, dir, `skill-one${++n}`, (s) => putFile(path.join(s, 'data', 'runtime-units.json'), jsonText(CATALOG_INITIAL)));
        const r = pre('cat1');
        const before = noWriteState(r, clean.id);
        const rc = kit.withSkill(skill2).commit(r, clean.id, clean.p.sha);
        expectF(check, 'catalog [1]', rc, { code: 'TOOL_UNIT_INCOMPATIBLE', exit: 3, error: MSG.TOOL_INCOMPATIBLE(T_READER), target: T_READER });
        checkNoWrite(check, 'catalog [1]', r, clean.id, before);
        // capability takes precedence over a hash failure of the same target
        const skill3 = deriveSkill(synth, dir, `skill-both${++n}`, (s) => { putFile(path.join(s, 'data', 'runtime-units.json'), jsonText(CATALOG_INITIAL)); fs.appendFileSync(path.join(s, 'assets', 'tools', 'git-safe.mjs'), '// changed too\n'); });
        const r3 = pre('cat1b');
        expectF(check, 'catalog [1] and a changed reader asset', kit.withSkill(skill3).commit(r3, clean.id, clean.p.sha), { code: 'TOOL_UNIT_INCOMPATIBLE', exit: 3, error: MSG.TOOL_INCOMPATIBLE(T_READER), target: T_READER });
      });
      await step('a compatible catalog with a newly changed trusted reader asset and the old bound candidate is TOOL_UNIT_UNREVIEWED (F, exit 3) with the exact target', async () => {
        const skill2 = deriveSkill(synth, dir, `skill-asset${++n}`, (s) => fs.appendFileSync(path.join(s, 'assets', 'tools', 'git-safe.mjs'), '// a newly reviewed reader\n'));
        const r = pre('asset');
        const before = noWriteState(r, clean.id);
        const rc = kit.withSkill(skill2).commit(r, clean.id, clean.p.sha);
        expectF(check, 'a changed reader asset', rc, { code: 'TOOL_UNIT_UNREVIEWED', exit: 3, error: MSG.TOOL_UNREVIEWED(T_READER), target: T_READER });
        checkNoWrite(check, 'a changed reader asset', r, clean.id, before);
      });
      await step('a malformed trusted catalog is TOOL_CATALOG with target data/runtime-units.json in prepare (P, exit 3) and in commit (F, exit 3)', async () => {
        const skill2 = deriveSkill(synth, dir, `skill-bad${++n}`, (s) => putFile(path.join(s, 'data', 'runtime-units.json'), jsonText({ schema: 1, units: [CATALOG_COMPAT.units[0]] })));
        const r = pre('badcat');
        const before = noWriteState(r, clean.id);
        const rc = kit.withSkill(skill2).commit(r, clean.id, clean.p.sha);
        expectF(check, 'a catalog without the reader entry (commit)', rc, { code: 'TOOL_CATALOG', exit: 3, error: MSG.TOOL_CATALOG, target: T_CATALOG });
        checkNoWrite(check, 'a malformed catalog (commit)', r, clean.id, before);
        const root = cloneBase(dir, v2, 'badcat-prep');
        const k2 = kit.withSkill(skill2);
        const s = startMigration(k2, check, root, 'run-c3-bc1');
        // PLAN-GAP: whether stage already reads the catalog is not pinned; prepare is, so it is asserted whether or not stage succeeded.
        if (s.ok) expectP(check, 'a malformed catalog (prepare)', k2.prepare(root, 'run-c3-bc1', { approve: [T_POLICY] }), [{ target: T_CATALOG, code: 'TOOL_CATALOG', error: MSG.TOOL_CATALOG }]);
        else check(s.st && s.st.json && s.st.json.code === 'TOOL_CATALOG', 'stage itself refuses a malformed catalog with TOOL_CATALOG', s.st && s.st.stdout.slice(0, 300));
      });
      await step('a forged hash-approved schema-2 plan without decisions fails MIGRATION_REQUIRED before the tool and manifest checks', async () => {
        const root = cloneBase(dir, v2, 'forge-req');
        const policy1 = jsonText({ ...readJson(projPath(root, T_POLICY)), codexGlobScanMaxDepth: 7 });
        const p = runSpec(kit, root, 'run-c3-f1', { drafts: { [T_POLICY]: policy1 } });
        check(p.ok === true, 'an ordinary schema-1 policy plan prepares', p.prep && p.prep.stdout.slice(0, 300));
        if (!p.ok) return;
        putDraft(root, 'run-c3-f1', T_POLICY, S2POLICY);
        const newSha = forgePlan(root, 'run-c3-f1', (plan) => { plan.ops.find((o) => o.target === T_POLICY).sourceSha256 = sha(Buffer.from(S2POLICY)); });
        const before = noWriteState(root, 'run-c3-f1');
        const rc = kit.commit(root, 'run-c3-f1', newSha);
        expectFMaybeTarget(check, 'forged schema-2 plan', rc, { code: 'MIGRATION_REQUIRED', exit: 3, error: MSG.MIGRATION_REQUIRED });
        checkNoWrite(check, 'forged schema-2 plan', root, 'run-c3-f1', before);
      });
      await step('a bound candidate role that is missing fails TOOL_UNIT_UNREVIEWED for that target without reading the unbound project path', async () => {
        const u = cloneBase(dir, v2, 'norole');
        putFile(projPath(u, T_READER), SYNTH_READER);
        commitAll(context, u, 'the compatible reader is already installed');
        const s = startMigration(synthKit, check, u, 'run-c3-r1');
        const p = s.ok ? prepareApproving(synthKit, u, 'run-c3-r1') : { ok: false };
        check(p.ok === true && Array.isArray(p.plan.metadata.transactionInputs) && p.plan.metadata.transactionInputs.includes(T_READER), 'the unchanged reader is a declared transaction input', p.plan && p.plan.metadata && p.plan.metadata.transactionInputs);
        if (!p.ok) return;
        const declared = readJson(runFile(u, 'run-c3-r1', 'transaction-inputs.json')).filter((x) => x !== T_READER);
        putRequest(u, 'run-c3-r1', 'transaction-inputs.json', declared);
        const newSha = forgePlan(u, 'run-c3-r1', (plan) => {
          plan.metadata.transactionInputs = declared;
          plan.metadata.transactionInputsSha256 = sha(readBytes(runFile(u, 'run-c3-r1', 'transaction-inputs.json')));
          plan.inputs = plan.inputs.filter((i) => i.target !== T_READER);
        });
        const guard = makeGuard(dir, [projPath(u, T_READER)], 'record');
        const before = noWriteState(u, 'run-c3-r1');
        const rc = synthKit.commit(u, 'run-c3-r1', newSha, { preload: guard.file });
        expectF(check, 'a missing bound reader role', rc, { code: 'TOOL_UNIT_UNREVIEWED', exit: 3, error: MSG.TOOL_UNREVIEWED(T_READER), target: T_READER });
        check(guard.hits().length === 0, 'the unbound reader was not read', guard.hits().slice(0, 3));
        checkNoWrite(check, 'a missing bound reader role', u, 'run-c3-r1', before);
      });
      // I3-2: a runtime target's planned candidate is its op's draft only when the op's action is create or modify. A forged, hash-approved plan that marks a
      // runtime op unchanged (commit writes only create and modify ops) is refused by the tool-unit check of that target with the plan's own failure.
      await step('I3-2 a forged hash-approved plan whose helper op, or reader op, is unchanged is refused at commit with TOOL_UNIT_UNREVIEWED (F, exit 3) and its target, before heartbeat, journal or write', async () => {
        const prior = readManifestFile(clean.v2.root).files;
        for (const [label, target] of [['a new helper (no installed bytes)', T_HELPER], ['a replaced reader (installed bytes are the old v2 reader)', T_READER]]) {
          const r = pre('i32');
          const forgedSha = forgePlan(r, clean.id, (plan) => {
            plan.ops.find((o) => o.target === target).action = 'unchanged';
            // the derived manifest of an unchanged op has no automatic record: the helper's is removed, the reader keeps its prior one
            if (target === T_HELPER) delete plan.manifestAfter.files[T_HELPER];
            else plan.manifestAfter.files[T_READER] = clone(prior[T_READER]);
          });
          const before = noWriteState(r, clean.id);
          const rc = synthKit.commit(r, clean.id, forgedSha);
          expectF(check, `${label}: unchanged op`, rc, { code: 'TOOL_UNIT_UNREVIEWED', exit: 3, error: MSG.TOOL_UNREVIEWED(target), target });
          checkNoWrite(check, `${label}: unchanged op`, r, clean.id, before);
          check(!exists(projPath(r, T_HELPER)) || target !== T_HELPER, `${label}: the helper was not installed without its operation`);
        }
      });
      // I3-4: section 3.12 orders the checks decisions, report and action consistency, staged projections, catalog and tools, approvals; a malformed catalog
      // never hides a decision error.
      await step('I3-4 invalid decisions together with a malformed catalog report the decision error, not TOOL_CATALOG, in stage, the unprepared review and prepare', async () => {
        const skillBad = deriveSkill(synth, dir, `skill-i34-${++n}`, (s) => putFile(path.join(s, 'data', 'runtime-units.json'), jsonText({ schema: 1, units: [CATALOG_COMPAT.units[0]] })));
        const badKit = kit.withSkill(skillBad);
        const variants = [
          ['a changed report hash', (d) => ({ ...d, reportSha256: H64('d') }), 'MIGRATION_REPORT_CHANGED', MSG.REPORT_CHANGED],
          ['a missing required decision', (d) => ({ ...d, coverage: d.coverage.filter((c) => c.id !== 'coverage:7') }), 'MIGRATION_DECISION_REQUIRED', MSG.DECISION_REQUIRED('coverage:7')],
        ];
        for (const [label, alter, code, message] of variants) {
          const root = cloneBase(dir, v2, `i34-${++n}`);
          const rid = `run-c3-i34-${n}`;
          kit.begin(root, rid);
          const rep = kit.report(root).json;
          if (!rep || !rep.report) { check(false, `${label}: the report succeeds`); continue; }
          putRequest(root, rid, T_DECISIONS, alter(decisionsFile(rep.report, { coverage: coverAll(rep.report) })));
          expectF(check, `${label}: stage`, badKit.stage(root, rid), { code, exit: 3, error: message });
          expectF(check, `${label}: unprepared review`, badKit.diff(root, rid), { code, exit: 3, error: message, target: T_DECISIONS });
          const pr = badKit.prepare(root, rid, { approve: [T_POLICY] });
          expectPEntry(check, `${label}: prepare`, pr, { target: T_DECISIONS, code, error: message });
          check(!((pr.json && pr.json.errors) || []).some((e) => e.code === 'TOOL_CATALOG'), `${label}: prepare does not report the catalog`, pr.json && pr.json.errors);
        }
      });
      // C3-P3-1: a filesystem failure during commit's runtime tool-unit check is APPLY_INPUT_IO / 2 with the project-relative path, like derivation I/O.
      await step('C3-P3-1 a read failure of a bound runtime target during commit is APPLY_INPUT_IO (F, exit 2) with its project-relative path, empty stderr, before heartbeat, journal or write', async () => {
        const u = cloneBase(dir, v2, 'io-unit');
        putFile(projPath(u, T_READER), SYNTH_READER);
        commitAll(context, u, 'the compatible reader is already installed');
        const s = startMigration(synthKit, check, u, 'run-c3-io1');
        const p = s.ok ? prepareApproving(synthKit, u, 'run-c3-io1') : { ok: false };
        check(p.ok === true, 'the migration with an unchanged installed reader prepares', p.prep && p.prep.stdout.slice(0, 300));
        if (!p.ok) return;
        // how many logical reads of the reader does a whole successful commit make? the last one is the tool-unit check's (derivation reads no target body)
        const counting = cloneTree(u, path.join(dir, `io-count${++n}`));
        const cl = makeReadLimit(dir, [projPath(counting, T_READER)], Infinity);
        const c0 = synthKit.commit(counting, 'run-c3-io1', p.sha, { preload: cl.file });
        check(c0.code === 0 && c0.json && c0.json.committed === true, 'the counting commit succeeds', c0.stdout.slice(0, 200));
        const total = cl.reads();
        // PLAN-GAP: if the check reuses the hash the binding recheck read (a single read in all), there is no filesystem read of its own to fail and the
        // clause has nothing to apply to; only the commit result is then asserted.
        if (total < 2) { check(total === 1, 'the reader is read at least by the binding recheck', total); return; }
        const failing = cloneTree(u, path.join(dir, `io-fail${++n}`));
        const fl = makeReadLimit(dir, [projPath(failing, T_READER)], total - 1);
        const before = noWriteState(failing, 'run-c3-io1');
        const rc = synthKit.commit(failing, 'run-c3-io1', p.sha, { preload: fl.file });
        expectF(check, 'the reader read fails after the binding recheck', rc, { code: 'APPLY_INPUT_IO', exit: 2, error: `cannot read transaction input: ${T_READER}` });
        checkNoWrite(check, 'the reader read fails after the binding recheck', failing, 'run-c3-io1', before);
      });
    });
  });
}

// ========================================= R80/C3/manifest-after ====
// Plan 3.10 and 4.6: commit derives the manifest from the bound inputs and refuses any plan whose manifestAfter or metadata operations disagree.
const getV3ExtBase = (context) => cached(context, 'v3ext', async () => {
  const v3 = await getV3Base(context);
  const dir = scratchDir(context, 'base-v3ext');
  const root = cloneTree(v3.root, path.join(dir, 'root'));
  const m = readManifestFile(root);
  m['x-top'] = { keep: [1, 2] };
  m.files['TODO.md'] = { ...m.files['TODO.md'], 'x-note': 'keep this extension' };
  putFile(manifestPath(root), jsonText(m));
  commitAll(context, root, 'manifest with extension fields');
  return { dir, root };
});
function agentsWithEdit(text) {
  const marker = '<!-- project-setup:end id=overview -->';
  return text.includes(marker) ? text.replace(marker, `Edited inside the block by the test.\n${marker}`) : null;
}
async function manifestAfter(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const ext = await useBase(failures, 'schema 3 with extension fields', getV3ExtBase, context);
    const v3 = await useBase(failures, 'schema 3', getV3Base, context);
    const synth = await useBase(failures, 'synthetic skill', getSynthSkill, context);
    const clean = await useBase(failures, 'prepared clean migration', cleanPrepared, context);
    if (clean) withBuildFailures(failures, clean);
    if (!ext || !v3 || !synth) return;
    const kit = makeKit(context, check, synth.root);
    await withScratch(context, 'r80m', async (dir) => {
      let n = 0;
      // ---- scenario S1: an ordinary content plan (a block, a full file and a living document) on a manifest with extension fields ----
      const s1root = cloneTree(ext.root, path.join(dir, 's1'));
      const agentsEdited = agentsWithEdit(readText(projPath(s1root, 'AGENTS.md')) || '');
      check(agentsEdited !== null, 'premise: the installed AGENTS.md has the overview block');
      const s1 = runSpec(kit, s1root, 'run-c3-ma1', { drafts: { 'AGENTS.md': agentsEdited || '', [DOC_API]: '# api-conventions\n\nchanged\n', '.ai/agents/reviewer.md': `${readText(projPath(s1root, '.ai/agents/reviewer.md'))}\nEdited by the test.\n` } });
      check(s1.ok === true, 'S1 prepares', s1.prep && s1.prep.stdout.slice(0, 400));
      // ---- scenario S2: a correct metadata-only plan (policy to keys) ----
      const s2root = cloneTree(v3.root, path.join(dir, 's2'));
      const f2 = baseFacts(s2root);
      const s2 = runSpec(kit, s2root, 'run-c3-ma2', { requests: { 'ownership.json': { [T_POLICY]: 'keys' }, 'managed-keys.json': { [T_POLICY]: f2.policyManaged } }, o: { approve: [T_POLICY] } });
      check(s2.ok === true, 'S2 prepares', s2.prep && s2.prep.stdout.slice(0, 400));
      const noop = cloneTree(v3.root, path.join(dir, 's4'));
      const s4 = runSpec(kit, noop, 'run-c3-ma4', { drafts: { [DOC_API]: readBytes(projPath(noop, DOC_API)) } });
      const mismatch = (label, root, id, sha0, mutate, o = {}) => {
        const r = cloneTree(root, path.join(dir, `m${++n}`));
        const newSha = forgePlan(r, id, (plan, rr) => mutate(plan, rr));
        const before = noWriteState(r, id);
        const rc = (o.kit || kit).commit(r, id, newSha);
        expectF(check, label, rc, { code: 'APPLY_MANIFEST_MISMATCH', exit: 4, error: MSG.MANIFEST_MISMATCH });
        checkNoWrite(check, label, r, id, before);
        void sha0;
      };
      if (s1.ok) {
        await step('S1 forgeries of manifestAfter: an unearned record, a deleted or changed unrelated record, a deleted extension, forged hashes, forged headers and a forged snippet hash', async () => {
          const id = 's1'; void id;
          const run = 'run-c3-ma1';
          const m1 = (label, mutate) => mismatch(label, s1root, run, s1.sha, mutate);
          m1('an unearned record', (p) => { p.manifestAfter.files['docs/ghost.md'] = { ownership: 'merged' }; p.manifestAfter.files = sortedFiles(p.manifestAfter.files); });
          m1('a deleted unrelated record', (p) => { delete p.manifestAfter.files['docs/database.md']; });
          m1('a changed unrelated record', (p) => { p.manifestAfter.files['docs/database.md'] = { ownership: 'full', sha256: H64('1') }; });
          m1('a deleted record extension', (p) => { delete p.manifestAfter.files['TODO.md']['x-note']; });
          m1('a changed record extension', (p) => { p.manifestAfter.files['TODO.md']['x-note'] = 'tampered'; });
          m1('a deleted header extension', (p) => { delete p.manifestAfter['x-top']; });
          m1('a changed header extension', (p) => { p.manifestAfter['x-top'] = { keep: [] }; });
          m1('a full-record hash without matching content', (p) => { p.manifestAfter.files['.ai/agents/reviewer.md'].sha256 = H64('2'); });
          m1('a block record without matching content', (p) => { p.manifestAfter.files['AGENTS.md'].blocks.overview = H64('3'); });
          m1('a forged record ownership', (p) => { p.manifestAfter.files[DOC_API] = { ownership: 'full', sha256: NH('# api-conventions\n\nchanged\n') }; });
          m1('a forged skill version in the header', (p) => { p.manifestAfter.skillVersion = '9.9.9'; });
          m1('a forged source commit in the header', (p) => { p.manifestAfter.sourceCommit = 'deadbee'; });
          m1('a forged mode in the header', (p) => { p.manifestAfter.mode = 'fresh'; });
          m1('forged agents in the header', (p) => { p.manifestAfter.agents = ['claude']; });
          m1('a forged codexSnippetSha256', (p) => { p.manifestAfter.codexSnippetSha256 = H64('4'); });
        });
        await step('an added ordinary content op without its automatic record is refused; with the correctly derived record it commits; key reordering alone is harmless', async () => {
          const run = 'run-c3-ma1';
          const forgeOp = (r, record) => forgePlan(r, run, (plan, rr) => {
            const target = 'docs/forged-extra.md';
            const draft = Buffer.from('# extra\n');
            putDraft(rr, run, target, draft);
            plan.ops = [...plan.ops, { target, origin: 'draft', source: `drafts/${target}`, sourceSha256: sha(draft), action: 'create', preRawSha: null, eol: '\n', linesBefore: null, linesAfter: 1, uncommittedUserChanges: false, userContentChange: false, userContentReasons: [] }].sort(byTarget);
            plan.sourceInventory = [...plan.sourceInventory, { target, origin: 'draft' }].sort(byTarget);
            plan.inputs = [...plan.inputs, { target, preRawSha: null }].sort(byTarget);
            if (record) { plan.manifestAfter.files[target] = { ownership: 'merged' }; plan.manifestAfter.files = sortedFiles(plan.manifestAfter.files); }
          });
          const bad = cloneTree(s1root, path.join(dir, `m${++n}`));
          const badSha = forgeOp(bad, false);
          const before = noWriteState(bad, run);
          expectF(check, 'an extra op without its record', kit.commit(bad, run, badSha), { code: 'APPLY_MANIFEST_MISMATCH', exit: 4, error: MSG.MANIFEST_MISMATCH });
          checkNoWrite(check, 'an extra op without its record', bad, run, before);
          const good = cloneTree(s1root, path.join(dir, `m${++n}`));
          const goodSha = forgeOp(good, true);
          const rc = kit.commit(good, run, goodSha);
          check(rc.code === 0 && rc.json && rc.json.committed === true, 'control: the same op with the correctly derived record commits', rc.stdout.slice(0, 300));
          check(readText(projPath(good, 'docs/forged-extra.md')) === '# extra\n', 'control: the extra op was written');
          const reordered = cloneTree(s1root, path.join(dir, `m${++n}`));
          const rSha = forgePlan(reordered, run, (plan) => {
            const rev = (o) => (Array.isArray(o) ? o.map(rev) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).reverse().map((k) => [k, rev(o[k])])) : o);
            plan.manifestAfter = rev(plan.manifestAfter);
          });
          const rr = kit.commit(reordered, run, rSha);
          check(rr.code === 0 && rr.json && rr.json.committed === true, 'control: reversing the object-key order of manifestAfter alone succeeds (canonical equality)', rr.stdout.slice(0, 300));
        });
        await step('the running skill\'s VERSION and the repository HEAD after prepare change nothing: the derived headers use the bound plan\'s version, head, mode and agents', async () => {
          const run = 'run-c3-ma1';
          const r = cloneTree(s1root, path.join(dir, `m${++n}`));
          const skill2 = deriveSkill(synth, dir, `skill-version${++n}`, (s) => putFile(path.join(s, 'VERSION'), '9.9.9-test\n'));
          gitCmd(context, r, ['commit', '--allow-empty', '-qm', 'HEAD moves after prepare']);
          const plan = readPlan(r, run);
          check(headShort(context, r) !== plan.head, 'premise: HEAD differs from the prepared head', { head: headShort(context, r), plan: plan.head });
          const rc = kit.withSkill(skill2).commit(r, run, s1.sha);
          check(rc.code === 0 && rc.json && rc.json.committed === true, 'commit succeeds with another running skill version and a moved HEAD', rc.stdout.slice(0, 300));
          const man = readManifestFile(r);
          check(man && man.skillVersion === plan.skillVersion && man.skillVersion !== '9.9.9-test' && man.sourceCommit === plan.head && man.mode === plan.mode && eq(man.agents, plan.agents), 'the written manifest carries the plan\'s skillVersion, head, mode and agents', man && headerOf(man));
          check(eq(readPlan(r, run).skillVersion, plan.skillVersion), 'plan.skillVersion was not rewritten');
        });
      }
      await step('S2: a correct metadata-only plan commits; a forged managed pattern list in manifestAfter is refused', async () => {
        if (!s2.ok) return;
        const run = 'run-c3-ma2';
        const okRoot = cloneTree(s2root, path.join(dir, `m${++n}`));
        const rc = kit.commit(okRoot, run, s2.sha);
        check(rc.code === 0 && rc.json && rc.json.committed === true && eq(rc.json.written, [{ target: T_MANIFEST, created: false }]), 'control: the correct metadata-only plan commits and writes only the manifest', rc.stdout.slice(0, 300));
        mismatch('a forged managed list (one pattern dropped)', s2root, run, s2.sha, (p) => { p.manifestAfter.files[T_POLICY].managed.patterns.pop(); });
        mismatch('a forged managed list (reordered)', s2root, run, s2.sha, (p) => { p.manifestAfter.files[T_POLICY].managed.patterns.reverse(); });
        mismatch('a forged managed entry metadata', s2root, run, s2.sha, (p) => { p.manifestAfter.files[T_POLICY].managed.patterns[0].note = 'forged'; });
        mismatch('a forged ownership', s2root, run, s2.sha, (p) => { p.manifestAfter.files[T_POLICY] = { ownership: 'full', sha256: H64('5') }; });
      });
      await step('a genuine no-op stays unchanged (manifestAfter null, nothing to commit)', async () => {
        check(s4.ok === true && s4.plan.manifestAfter === null, 'the no-op plan has manifestAfter null', s4.prep && s4.prep.stdout.slice(0, 300));
        if (!s4.ok) return;
        const rc = kit.commit(noop, 'run-c3-ma4', s4.sha);
        check(rc.code === 0 && rc.stderr === '' && eq(rc.json, NOOP_BODY) && rc.stdout === jsonText(NOOP_BODY), 'commit returns the exact zero-diff body', rc.stdout.slice(0, 200));
        check(!exists(runFile(noop, 'run-c3-ma4', 'journal.json')), 'no journal is created');
      });
      await step('an I2-10 forbidden target is refused (F, exit 3) before any manifest mismatch', async () => {
        if (!s1.ok) return;
        const run = 'run-c3-ma1';
        for (const [label, target, current, draftText, want] of [['.env', '.env', Buffer.from('SECRET_TOKEN=I3-MARKER-1\n'), 'X=1\n', { code: 'APPLY_SECRET_TARGET', error: MSG.SECRET_PREPARE }], ['src/forged.ts', 'src/forged.ts', Buffer.from('export const a = 1;\n'), 'export const b = 2;\n', { code: 'APPLY_WRITE_SCOPE', error: MSG.SCOPE('src/forged.ts') }]]) {
          const r = cloneTree(s1root, path.join(dir, `m${++n}`));
          putFile(projPath(r, target), current);
          const draft = Buffer.from(draftText);
          putDraft(r, run, target, draft);
          const newSha = forgePlan(r, run, (plan) => {
            plan.ops = [...plan.ops, { target, origin: 'draft', source: `drafts/${target}`, sourceSha256: sha(draft), action: 'modify', preRawSha: sha(current), eol: '\n', linesBefore: null, linesAfter: 1, uncommittedUserChanges: false, userContentChange: false, userContentReasons: [] }].sort(byTarget);
            plan.sourceInventory = [...plan.sourceInventory, { target, origin: 'draft' }].sort(byTarget);
            plan.inputs = [...plan.inputs, { target, preRawSha: sha(current) }].sort(byTarget);
          });
          const before = noWriteState(r, run);
          const rc = kit.commit(r, run, newSha);
          expectF(check, `forged op for ${label}`, rc, { code: want.code, exit: 3, error: want.error });
          checkNoWrite(check, `forged op for ${label}`, r, run, before);
          check(!rc.stdout.includes('I3-MARKER-1'), `forged op for ${label}: nothing of the target is printed`);
        }
      });
      // ---- scenario S3: the migration plan ----
      await step('S3: forged managed lists, snippet hashes, embedded request values and metadata operations of a migration plan are refused unless they match the bound request files', async () => {
        if (!clean || !clean.p.ok) { check(false, 'the clean migration prepared'); return; }
        const run = clean.id;
        const m3 = (label, mutate) => mismatch(label, clean.root, run, clean.p.sha, mutate);
        m3('a forged installed managed pattern list in manifestAfter', (p) => { p.manifestAfter.files[T_POLICY].managed.patterns.pop(); });
        m3('a forged managed entry (a note) in manifestAfter', (p) => { p.manifestAfter.files[T_POLICY].managed.patterns[0].note = 'forged'; });
        m3('a forged codexSnippetSha256', (p) => { p.manifestAfter.codexSnippetSha256 = H64('6'); });
        m3('a deleted snippet hash', (p) => { delete p.manifestAfter.codexSnippetSha256; });
        m3('a forged settings ownership list', (p) => { p.manifestAfter.files[T_SETTINGS].managed['permissions.deny'].pop(); });
        m3('a forged unrelated record', (p) => { delete p.manifestAfter.files['docs/database.md']; });
        m3('an unearned record', (p) => { p.manifestAfter.files['docs/ghost.md'] = { ownership: 'merged' }; p.manifestAfter.files = sortedFiles(p.manifestAfter.files); });
        m3('a forged helper record hash', (p) => { p.manifestAfter.files[T_HELPER].sha256 = H64('7'); });
        // the forged embedded request values and manifestAfter agree with each other; the bound request-file bytes do not
        m3('embedded managed request, manifestAfter and metadata operation forged together while the bound request file is unchanged', (p) => {
          const drop = (list) => list.slice(0, -1);
          p.metadata.managedKeys[T_POLICY].patterns = drop(p.metadata.managedKeys[T_POLICY].patterns);
          p.manifestAfter.files[T_POLICY].managed.patterns = drop(p.manifestAfter.files[T_POLICY].managed.patterns);
          const op = p.metadataOps.find((m) => m.kind === 'file' && m.target === T_POLICY);
          op.after.managed.patterns = drop(op.after.managed.patterns);
        });
        m3('the embedded snippet request and manifestAfter forged together', (p) => { p.metadata.manifestMetadata.codexSnippetSha256 = H64('8'); p.manifestAfter.codexSnippetSha256 = H64('8'); });
        m3('metadata operations altered to agree only with the forged manifest', (p) => {
          p.manifestAfter.files[T_POLICY].managed.patterns.pop();
          const op = p.metadataOps.find((m) => m.kind === 'file' && m.target === T_POLICY);
          op.after.managed.patterns.pop();
        });
        m3('a forged omission added to the record and the operation', (p) => {
          const omission = { patterns: [{ anchor: 'any', glob: '**/*.cert' }] };
          p.manifestAfter.files[T_POLICY].omissions = omission;
          p.metadataOps.find((m) => m.kind === 'file' && m.target === T_POLICY).after.omissions = omission;
        });
        const okRoot = cloneTree(clean.root, path.join(dir, `m${++n}`));
        const rc = kit.commit(okRoot, run, clean.p.sha);
        check(rc.code === 0 && rc.json && rc.json.committed === true, 'control: the genuine migration plan commits under manifest verification', rc.stdout.slice(0, 300));
        const man = readManifestFile(okRoot);
        const exp = cleanExpect(context, clean.root);
        check(man.codexSnippetSha256 === exp.snippetSha && eq(man.files[T_POLICY], { ownership: 'keys', managed: exp.managed }), 'the committed manifest records the snippet hash and exactly the managed list with keys ownership', man && man.files[T_POLICY] && Object.keys(man.files[T_POLICY]));
        check(eq(man.files[T_SETTINGS].managed['permissions.deny'], exp.denyAfter) && eq(man.files[T_SETTINGS].managed.heldBack, []) && eq(man.files[T_SETTINGS].managed['permissions.allow'], exp.facts.settingsRec.managed['permissions.allow']), 'the settings record owns the retained list plus the three new rules; allow ownership is untouched', man && man.files[T_SETTINGS]);
        const before = readManifestFile(clean.v2.root);
        check(Object.keys(before.files).filter((k) => ![T_POLICY, T_SETTINGS, T_HELPER, T_READER].includes(k)).every((k) => eq(man.files[k], before.files[k])), 'every unrelated record is preserved byte for byte');
      });
    });
  });
}

// ========================================= inspection helpers (R81, R82) ====
const ROW_MANAGED_PASS = { level: 'pass', check: 'policy-managed', detail: '.ai/security-paths.json: managed patterns match installed baseline' };
const ROW_MANAGED_FAIL = { level: 'fail', check: 'policy-managed', detail: '.ai/security-paths.json: managed patterns edited since install' };
const ROW_BASELINE_UNKNOWN = { level: 'info', check: 'policy-baseline', detail: '.ai/security-paths.json: installed baseline unknown' };
const ROW_BEHIND = { level: 'info', check: 'policy-version', detail: '.ai/security-paths.json: installed managed patterns are behind this skill' };
const ROW_SNIPPET_MISSING = { level: 'info', check: 'codex-snippet', detail: 'Codex deny-read snippet has not been recorded' };
const ROW_SNIPPET_STALE = { level: 'info', check: 'codex-snippet', detail: 'Codex deny-read snippet is stale; render and review it again' };
const rowProject = (entries) => ({ level: 'info', check: 'policy-project', detail: `.ai/security-paths.json: projectPatterns ${JSON.stringify(entries.map((e) => idKey(anchored(e))))}` });
const withSnippet = (input) => { const c = clone(input); c.manifest = { ...c.manifest, codexSnippetSha256: snippetHash(c.policy) }; return c; };
// The committed state of a clean migration (a clone of the prepared scenario, committed with the compatible synthetic skill).
async function commitClean(context, check, dir, label) {
  const clean = await cleanPrepared(context);
  if (!clean.p.ok) return null;
  const synth = await getSynthSkill(context);
  const root = cloneTree(clean.root, path.join(dir, label));
  const c = makeKit(context, check, synth.root).commit(root, clean.id, clean.p.sha);
  check(c.code === 0 && c.json && c.json.committed === true, `${label}: the clean migration commits`, c.stdout.slice(0, 300));
  return c.code === 0 ? { root, clean, synth } : null;
}
const detectOf = (kit, root, o = {}) => { const r = kit.detect(root, o); return r; };

// ================================================ R81/C3/recorded-patterns ====
// Plan 3.11 and 4.7: inspectSecurityState distinguishes drift from behind; detect reports it; a malformed policy is a deny-all detect, exit 0.
async function recordedPatterns(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mig = await needSafeScript(failures, context, 'migrate-security-paths.mjs');
    const fixture = loadMigrationFixture(check, context);
    const kit = makeKit(context, check);
    if (mig && fixture && needFns(failures, mig, ['inspectSecurityState'])) {
      const cases = byId(fixture);
      const inspect = (label, input) => runPure(check, label, mig.inspectSecurityState, input);
      const rowsAre = (label, got, want) => check(eq(got, want), `${label}: the exact rows, in order`, got);
      await step('a known unchanged v2 baseline is the managed pass row plus behind, and the snippet has not been recorded', async () => {
        const c = cases.get('known-unchanged');
        rowsAre('clean v2', await inspect('clean v2', c.input), [ROW_MANAGED_PASS, ROW_BEHIND, ROW_SNIPPET_MISSING]);
        rowsAre('shipped installation', await inspect('shipped', cases.get('current-shipped').input), [ROW_MANAGED_PASS, ROW_SNIPPET_MISSING]);
        const small = cases.get('hashes-agree');
        rowsAre('a mini v2 installation', await inspect('mini v2', small.input), [ROW_MANAGED_PASS, ROW_BEHIND, ROW_SNIPPET_MISSING]);
      });
      await step('changed managed metadata or order is a fail row and suppresses behind, even when desired identities are absent', async () => {
        const base = cases.get('recorded-schema2').input;
        const editedNote = clone(base);
        editedNote.policy.patterns[3].note = 'Edited after install.';
        rowsAre('a changed note', await inspect('changed note', editedNote), [ROW_MANAGED_FAIL, ROW_SNIPPET_MISSING]);
        const reordered = clone(base);
        reordered.policy.patterns = [reordered.policy.patterns[1], reordered.policy.patterns[0], ...reordered.policy.patterns.slice(2)];
        rowsAre('a changed order', await inspect('changed order', reordered), [ROW_MANAGED_FAIL, ROW_SNIPPET_MISSING]);
        const dropped = clone(base);
        dropped.policy.patterns = dropped.policy.patterns.slice(1);
        rowsAre('a dropped entry', await inspect('dropped entry', dropped), [ROW_MANAGED_FAIL, ROW_SNIPPET_MISSING]);
        const v2edit = clone(cases.get('known-unchanged').input);
        v2edit.policy.patterns[17].note = 'Edited after install.';
        rowsAre('an edit of a v2 baseline', await inspect('v2 edit', v2edit), [ROW_MANAGED_FAIL, ROW_SNIPPET_MISSING]);
      });
      await step('an unknown baseline emits only the baseline row plus the applicable project and snippet rows', async () => {
        const c = cases.get('unrecognized-hash');
        rowsAre('unknown', await inspect('unknown', c.input), [ROW_BASELINE_UNKNOWN, ROW_SNIPPET_MISSING]);
        const withProject = clone(c.input);
        withProject.policy.projectPatterns = [{ anchor: 'root', glob: 'env/**' }, { anchor: 'root', glob: 'ENV/**' }];
        rowsAre('unknown with project entries', await inspect('unknown project', withProject), [ROW_BASELINE_UNKNOWN, rowProject(withProject.policy.projectPatterns), ROW_SNIPPET_MISSING]);
        const noRecord = await inspect('missing record', cases.get('missing-record').input);
        check(noRecord && noRecord.every((r) => r.check !== 'policy-managed' && r.check !== 'policy-version'), 'a missing record emits neither policy-managed nor policy-version', noRecord);
        const stale = withSnippet(c.input);
        stale.manifest.codexSnippetSha256 = H64('9');
        rowsAre('unknown with a stale snippet', await inspect('unknown stale', stale), [ROW_BASELINE_UNKNOWN, ROW_SNIPPET_STALE]);
      });
      await step('project-only additions never become managed drift; the project row lists compact keys in order with duplicates', async () => {
        const base = clone(cases.get('recorded-schema2').input);
        base.policy.projectPatterns = [{ anchor: 'root', glob: 'env/**' }, { anchor: 'root', glob: 'cert/**', note: 'n' }, { anchor: 'root', glob: 'ENV/**' }];
        const got = await inspect('project additions', base);
        rowsAre('project additions', got, [ROW_MANAGED_PASS, ROW_BEHIND, rowProject(base.policy.projectPatterns), ROW_SNIPPET_MISSING]);
        check(got && got[2] && got[2].detail === '.ai/security-paths.json: projectPatterns ["[\\"root\\",\\"env/**\\"]","[\\"root\\",\\"cert/**\\"]","[\\"root\\",\\"env/**\\"]"]', 'the keys are the compact JSON of the entry keys: duplicates and order kept', got && got[2] && got[2].detail);
        const none = await inspect('an empty project list', { ...clone(cases.get('recorded-schema2').input) });
        check(none && !none.some((r) => r.check === 'policy-project'), 'an empty project list emits no project row');
      });
      await step('exact desired omissions prevent behind; an old replacement omission does not', async () => {
        const mini = cases.get('omitted-new-identity').input;
        const exactBoth = clone(mini);
        exactBoth.manifest.files[T_POLICY].omissions = { patterns: [{ anchor: 'any', glob: '**/*.cert' }, { anchor: 'any', glob: '**/.ENV*' }] };
        rowsAre('both new identities omitted exactly (case-folded)', await inspect('exact omissions', exactBoth), [ROW_MANAGED_PASS, ROW_SNIPPET_MISSING]);
        rowsAre('only cert omitted: **/.env* is still absent', await inspect('one omission', mini), [ROW_MANAGED_PASS, ROW_BEHIND, ROW_SNIPPET_MISSING]);
        const old = cases.get('old-env-omission').input;
        rowsAre('an old **/.env.* omission does not cover the replacement', await inspect('old omission', old), [ROW_MANAGED_PASS, ROW_BEHIND, ROW_SNIPPET_MISSING]);
        const wider = clone(mini);
        wider.manifest.files[T_POLICY].omissions = { patterns: [{ anchor: 'any', glob: '**/*.cert' }, { anchor: 'any', glob: '**/.env.*' }] };
        rowsAre('a broader or old omission is not an exact desired omission', await inspect('wider omission', wider), [ROW_MANAGED_PASS, ROW_BEHIND, ROW_SNIPPET_MISSING]);
      });
      await step('a clean migration and an approved kept edit, recorded as installed, are pass with no behind; desired ordering and metadata alone are not behind', async () => {
        const migrated = cleanMigrationPolicy(context);
        const input = clone(cases.get('known-unchanged').input);
        input.policy = migrated;
        input.manifest = { ...input.manifest, files: { [T_POLICY]: { ownership: 'keys', managed: { schema: 2, patterns: migrated.patterns } } } };
        rowsAre('after a clean migration (snippet not yet recorded)', await inspect('clean migration', input), [ROW_MANAGED_PASS, ROW_SNIPPET_MISSING]);
        rowsAre('after a clean migration with the recorded snippet', await inspect('clean migration recorded', withSnippet(input)), [ROW_MANAGED_PASS]);
        const edit = clone(cases.get('metadata-edit').input);
        const kept = cases.get('metadata-edit').expected;
        edit.policy = { ...kept.policy };
        edit.manifest = { ...edit.manifest, files: { [T_POLICY]: { ownership: 'keys', managed: kept.managed } } };
        rowsAre('a kept edit recorded as installed (the desired order and notes differ)', await inspect('kept edit', withSnippet(edit)), [ROW_MANAGED_PASS]);
      });
      await step('no policy and no record emit only the missing-snippet row; stale snippets (policy or depth changed) emit the stale row', async () => {
        const fresh = cases.get('fresh').input;
        rowsAre('no policy and no record', await inspect('fresh', fresh), [ROW_SNIPPET_MISSING]);
        const equal = withSnippet(cases.get('known-unchanged').input);
        rowsAre('an equal snippet hash emits no snippet row', await inspect('equal snippet', equal), [ROW_MANAGED_PASS, ROW_BEHIND]);
        const deeper = clone(equal);
        deeper.policy.codexGlobScanMaxDepth = 7;
        rowsAre('a changed depth makes the recorded hash stale', await inspect('depth', deeper), [ROW_MANAGED_PASS, ROW_BEHIND, ROW_SNIPPET_STALE]);
        const wrong = clone(equal);
        wrong.manifest.codexSnippetSha256 = H64('b');
        rowsAre('another hash is stale', await inspect('stale', wrong), [ROW_MANAGED_PASS, ROW_BEHIND, ROW_SNIPPET_STALE]);
      });
    }
    // ---------------------------------------------------------------- detect ----
    const v2 = await useBase(failures, 'genuine v2', getV2Base, context);
    const synth = await useBase(failures, 'synthetic skill', getSynthSkill, context);
    if (!v2) return;
    await withScratch(context, 'r81', async (dir) => {
      await step('detect reports ai.securityPolicy: a genuine v2 install, a fresh project, a missing record; an invalid manifest keeps its C2 summary and reports null', async () => {
        const root = cloneBase(dir, v2, 'v2');
        const d = detectOf(kit, root);
        check(d.code === 0 && d.json && eq(d.json.ai.securityPolicy, [ROW_MANAGED_PASS, ROW_BEHIND, ROW_SNIPPET_MISSING]), 'a genuine v2 install: managed pass, behind, snippet not recorded', d.json && d.json.ai && d.json.ai.securityPolicy);
        const plain = await getPlainBase(context);
        const pr = cloneBase(dir, plain, 'plain');
        const dp = detectOf(kit, pr);
        check(dp.code === 0 && dp.json && eq(dp.json.ai.securityPolicy, [ROW_SNIPPET_MISSING]), 'a project with no policy and no manifest: only the missing-snippet row', dp.json && dp.json.ai && dp.json.ai.securityPolicy);
        const norec = cloneBase(dir, v2, 'norecord');
        const m = readManifestFile(norec); delete m.files[T_POLICY];
        putFile(manifestPath(norec), jsonText(m));
        const dn = detectOf(kit, norec);
        check(dn.code === 0 && dn.json && eq(dn.json.ai.securityPolicy, [ROW_BASELINE_UNKNOWN, ROW_SNIPPET_MISSING]), 'a manifest without a policy record: unknown baseline and the snippet row', dn.json && dn.json.ai && dn.json.ai.securityPolicy);
        const bad = cloneBase(dir, v2, 'badmanifest');
        putFile(manifestPath(bad), '{ not json');
        const db = detectOf(kit, bad);
        check(db.code === 0 && db.json && db.json.ai.securityPolicy === null && db.json.mode === 'invalid' && eq(db.json.ai.manifest, { schema: null, skillVersion: null, mode: null, status: 'invalid', needsUpdate: false, errors: ['manifest is not valid JSON'] }), 'an invalid manifest: securityPolicy null, mode invalid, the C2 summary unchanged', db.json && db.json.ai);
        const badSchema = cloneBase(dir, v2, 'badschema');
        const bm = readManifestFile(badSchema); bm.files[T_POLICY] = { ownership: 'full', sha256: 'zz' };
        putFile(manifestPath(badSchema), jsonText(bm));
        const ds = detectOf(kit, badSchema);
        check(ds.code === 0 && ds.json && ds.json.ai.securityPolicy === null && ds.json.ai.manifest.status === 'invalid', 'a manifest with a malformed policy hash is invalid: its ownership data is not inspected', ds.json && ds.json.ai && ds.json.ai.securityPolicy);
      });
      await step('a malformed installed policy: detect exits 0 with the exact fail row; every candidate path is protected, so no candidate body is opened, package is null and content-risk files are empty', async () => {
        const root = cloneBase(dir, v2, 'malformed');
        putFile(projPath(root, T_POLICY), '{ not json');
        putFile(projPath(root, '.env.example'), 'PORT=\n');
        commitAll(context, root, 'a malformed installed policy');
        putFile(projPath(root, 'notes/x.txt'), 'untracked\n');
        putFile(projPath(root, '.ai/.run/run-9999/vault/files/x'), 'run\n');
        const watch = [projPath(root, 'CLAUDE.md'), projPath(root, 'AGENTS.md'), projPath(root, 'package.json'), projPath(root, 'docs/api-conventions.md')];
        const guard = makeGuard(dir, watch, 'record');
        const d = detectOf(kit, root, { preload: guard.file });
        check(d.code === 0 && d.json, 'detect exits 0 with JSON', { code: d.code, out: d.stdout.slice(0, 300), err: d.stderr.slice(0, 200) });
        const j = d.json || {};
        check(eq(j.ai && j.ai.securityPolicy, [{ level: 'fail', check: 'policy-schema', detail: '.ai/security-paths.json: POLICY_JSON: policy text must be valid JSON' }]), 'the only row is the exact policy-schema fail row with the C1 message', j.ai && j.ai.securityPolicy);
        check(guard.hits().length === 0, 'no instruction file, package.json or document body was opened', guard.hits().slice(0, 4));
        check(j.project && j.project.package === null && j.secrets && eq(j.secrets.contentRiskFiles, []), 'package is null and contentRiskFiles is empty', { pkg: j.project && j.project.package, risk: j.secrets && j.secrets.contentRiskFiles });
        // C10 plan 5.1 and 6.4 item 4: the template exception is exactly the root `.env.example`; every other tracked path, other template-like names included, stays reported.
        const tracked = gitCmd(context, root, ['ls-files']).stdout.split('\n').filter(Boolean).filter((p) => p !== '.env.example');
        check(j.secrets && eq(sorted(j.secrets.trackedSecretPaths), sorted(tracked)), 'the conservative matcher protects every tracked path except the root .env.example', j.secrets && j.secrets.trackedSecretPaths.slice(0, 5));
        check(j.secrets && j.secrets.presentSecretPaths.includes('notes/x.txt') && !j.secrets.presentSecretPaths.some((p) => p.startsWith('.ai/.run/')), 'untracked names are protected (names only) and the run-name exclusion stays', j.secrets && j.secrets.presentSecretPaths);
        check(j.instructionFiles && j.instructionFiles.length >= 2 && j.instructionFiles.every((f) => f.lines === null && f.bytes === null), 'instruction files are inventoried by name only', j.instructionFiles && j.instructionFiles.slice(0, 2));
        check(j.ai && j.ai.manifest && j.ai.manifest.status === 'needs update' && j.mode === 'update', 'the fixed manifest-control read and the mode still work', j.ai && j.ai.manifest);
        check(j.git && typeof j.git.head === 'string', 'git metadata is still reported', j.git);
        // control: with a valid policy the same bodies are opened
        const ok = cloneBase(dir, v2, 'valid');
        const g2 = makeGuard(dir, [projPath(ok, 'CLAUDE.md'), projPath(ok, 'AGENTS.md'), projPath(ok, 'package.json')], 'record');
        const dd = detectOf(kit, ok, { preload: g2.file });
        check(dd.code === 0 && g2.hits().length > 0 && dd.json && dd.json.project.package !== null, 'control: a valid policy lets detect read instruction and package bodies (the guard sees them)', g2.hits().length);
        const bad2 = cloneBase(dir, v2, 'malformed2');
        putFile(projPath(bad2, T_POLICY), jsonText({ schema: 3, patterns: [], projectPatterns: [] }));
        const d2 = detectOf(kit, bad2);
        check(d2.code === 0 && d2.json && eq(d2.json.ai.securityPolicy, [{ level: 'fail', check: 'policy-schema', detail: '.ai/security-paths.json: POLICY_SCHEMA: policy.schema must be 1 or 2' }]), 'another malformed policy: the row carries that C1 message', d2.json && d2.json.ai && d2.json.ai.securityPolicy);
      });
      if (synth) {
        await step('after a committed clean migration detect reports the managed pass and no behind and no snippet row; a later edit of the installed policy depth makes the snippet stale', async () => {
          const done = await commitClean(context, check, dir, 'committed');
          if (!done) return;
          const d = detectOf(kit, done.root);
          check(d.code === 0 && d.json && eq(d.json.ai.securityPolicy, [ROW_MANAGED_PASS]), 'immediately after a clean migration: managed pass, no behind, no snippet row', d.json && d.json.ai && d.json.ai.securityPolicy);
          const policy = readJson(projPath(done.root, T_POLICY));
          policy.codexGlobScanMaxDepth = 7;
          putFile(projPath(done.root, T_POLICY), jsonText(policy));
          commitAll(context, done.root, 'depth changed');
          const d2 = detectOf(kit, done.root);
          check(d2.code === 0 && d2.json && eq(d2.json.ai.securityPolicy, [ROW_MANAGED_PASS, ROW_SNIPPET_STALE]), 'a depth change: the recorded snippet is stale, the managed list is still current', d2.json && d2.json.ai && d2.json.ai.securityPolicy);
          const edited = readJson(projPath(done.root, T_POLICY));
          edited.patterns[0].note = 'edited by the user';
          putFile(projPath(done.root, T_POLICY), jsonText(edited));
          const d3 = detectOf(kit, done.root);
          check(d3.code === 0 && d3.json && d3.json.ai.securityPolicy[0] && eq(d3.json.ai.securityPolicy[0], ROW_MANAGED_FAIL) && !d3.json.ai.securityPolicy.some((r) => r.check === 'policy-version'), 'a managed edit after the migration is drift (fail) and suppresses behind', d3.json && d3.json.ai && d3.json.ai.securityPolicy);
        });
      }
    });
  });
}

// ===================================================== R82/C3/snippet ====
// Plan 3.11 and 4.7: the recorded snippet hash detects a stale rendering; a snippet-only metadata transaction writes the manifest only.
async function snippet(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mig = await needSafeScript(failures, context, 'migrate-security-paths.mjs');
    const fixture = loadMigrationFixture(check, context);
    const kit = makeKit(context, check);
    if (mig && fixture && needFns(failures, mig, ['inspectSecurityState'])) {
      await step('missing, correct and stale hashes give the exact rows', async () => {
        const c = byId(fixture).get('current-shipped');
        const missing = await runPure(check, 'missing', mig.inspectSecurityState, c.input);
        check(eq(missing, [ROW_MANAGED_PASS, ROW_SNIPPET_MISSING]), 'no recorded hash: the not-recorded row', missing);
        const right = await runPure(check, 'correct', mig.inspectSecurityState, withSnippet(c.input));
        check(eq(right, [ROW_MANAGED_PASS]), 'the hash of the exact rendering: no snippet row', right);
        const changed = clone(withSnippet(c.input));
        changed.policy.codexGlobScanMaxDepth = 9;
        const stale = await runPure(check, 'stale', mig.inspectSecurityState, changed);
        check(eq(stale, [ROW_MANAGED_PASS, ROW_SNIPPET_STALE]), 'a depth change makes the recorded hash stale', stale);
        const edited = clone(withSnippet(c.input));
        edited.policy.projectPatterns = [{ anchor: 'root', glob: 'env/**' }];
        const staleProject = await runPure(check, 'stale project', mig.inspectSecurityState, edited);
        check(staleProject && staleProject[staleProject.length - 1] && eq(staleProject[staleProject.length - 1], ROW_SNIPPET_STALE), 'a project entry that was not rendered when the hash was recorded makes it stale', staleProject);
      });
    }
    const v3 = await useBase(failures, 'schema 3', getV3Base, context);
    const v2 = await useBase(failures, 'genuine v2', getV2Base, context);
    const synth = await useBase(failures, 'synthetic skill', getSynthSkill, context);
    await withScratch(context, 'r82', async (dir) => {
      if (v3) {
        await step('a snippet-only metadata transaction writes only the manifest and rolls back to the exact prior manifest', async () => {
          const root = cloneBase(dir, v3, 'only');
          const before = readBytes(manifestPath(root));
          const tree = JSON.stringify(walkTree(root, ['.git']).filter(([rel]) => !rel.startsWith('.ai/.run') && !rel.startsWith('.ai/.setup.lock') && rel !== '.ai/manifest.json'));
          const hash = H64('a');
          const p = runSpec(kit, root, 'run-c3-sn1', { requests: { 'manifest-metadata.json': { codexSnippetSha256: hash } } });
          check(p.ok === true && p.prep.json.changed === 0 && p.prep.json.metadataChanged === 1 && p.prep.json.metadataOps[0].kind === 'manifest', 'prepare has one manifest metadata operation and no content operation', p.prep && p.prep.stdout.slice(0, 300));
          if (!p.ok) return;
          const c = kit.commit(root, 'run-c3-sn1', p.sha);
          check(c.code === 0 && c.json && eq(c.json.written, [{ target: T_MANIFEST, created: false }]), 'commit writes only the manifest', c.stdout.slice(0, 300));
          const after = readManifestFile(root);
          check(after.codexSnippetSha256 === hash, 'the snippet hash is recorded');
          const treeAfter = JSON.stringify(walkTree(root, ['.git']).filter(([rel]) => !rel.startsWith('.ai/.run') && !rel.startsWith('.ai/.setup.lock') && rel !== '.ai/manifest.json'));
          check(treeAfter === tree, 'no other project file changed');
          const j = readJournal(root, 'run-c3-sn1');
          check(j && eq(j.entries.map((e) => e.target), [T_MANIFEST]), 'the journal has the manifest entry only', j && j.entries.map((e) => e.target));
          const rb = kit.rollback(root, 'run-c3-sn1');
          check(rb.code === 0 && rb.json && rb.json.complete === true && eq(rb.json.restored, [T_MANIFEST]), 'rollback restores only the manifest', rb.stdout.slice(0, 300));
          check(sameBytes(readBytes(manifestPath(root)), before), 'the prior manifest bytes are back');
        });
      }
      if (v2 && synth) {
        await step('after a clean migration the recorded hash equals the hash of the CLI snippet; changing the policy depth makes detect report it stale', async () => {
          const done = await commitClean(context, check, dir, 'sn-committed');
          if (!done) return;
          const man = readManifestFile(done.root);
          const snip = kit.render(done.root, ['codex-snippet', '--project', done.root]);
          check(snip.code === 0 && man.codexSnippetSha256 === sha(Buffer.from(snip.stdout, 'utf8')), 'codexSnippetSha256 is the SHA-256 of the exact snippet the renderer prints for the installed policy', { recorded: man.codexSnippetSha256, printed: sha(Buffer.from(snip.stdout, 'utf8')) });
          const d = kit.detect(done.root);
          check(d.json && !d.json.ai.securityPolicy.some((r) => r.check === 'codex-snippet'), 'an equal hash emits no snippet row', d.json && d.json.ai.securityPolicy);
          const policy = readJson(projPath(done.root, T_POLICY));
          policy.codexGlobScanMaxDepth = 11;
          putFile(projPath(done.root, T_POLICY), jsonText(policy));
          const d2 = kit.detect(done.root);
          check(d2.json && d2.json.ai.securityPolicy.some((r) => eq(r, ROW_SNIPPET_STALE)), 'a policy depth change is a stale snippet', d2.json && d2.json.ai.securityPolicy);
        });
        await step('validate no longer emits the obsolete "differs from this skill version" warning for an installed policy that differs from the shipped file', async () => {
          const root = cloneBase(dir, v2, 'validate');
          editPolicy(context, root, (p) => { p.codexGlobScanMaxDepth = 7; });
          const v = kit.validate(root);
          const rows = (v.json && v.json.results) || [];
          check(v.code === 0 && v.json && v.json.ok === true, 'validate still succeeds on the edited installation', { code: v.code, fails: rows.filter((r) => r.level === 'fail') });
          check(!rows.some((r) => /differs from this skill version/.test(r.detail)), 'no result says the policy differs from this skill version', rows.filter((r) => /differs/.test(r.detail)));
          // C10 plan 4.5 and 6.4 item 3: the temporary prohibition is replaced by the integration. The depth-only edit leaves the recorded v2 baseline and the managed list unchanged, so validate appends the three
          // inspectSecurityState rows unchanged and in order (the record, not the installed bytes, identifies the baseline): managed pass, behind this skill, snippet not recorded. The older "differs" text stays gone.
          const state = rows.filter((r) => r.check === 'policy-managed' || r.check === 'policy-version' || r.check === 'policy-baseline' || r.check === 'policy-project' || r.check === 'codex-snippet');
          check(eq(state, [ROW_MANAGED_PASS, ROW_BEHIND, ROW_SNIPPET_MISSING]), 'validate appends the inspectSecurityState rows unchanged and in order: managed pass, behind, missing snippet', state);
        });
      }
    });
  });
}

// ================================================ Q4/C3/scan-labels ====
// Plan 3.11 and 4.7: protected findings stay scanned and redacted; labelScanFindings maps exactly; the CLI keeps vault and canary findings.
const SCAN_FILES = ['.env', 'env/private.json', 'docs/public.txt', '.ai/.run/run-0001/vault/backup/item', '.ai/.canary/item'];
const SCAN_MARKER = 'Q4-MARKER-SECRET-8c2f19';
async function scanLabels(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const scan = await needSafeScript(failures, context, 'secret-scan.mjs');
    const kit = makeKit(context, check);
    const shipped = expectedShippedDoc(context);
    const policy = { ...clone(shipped), projectPatterns: [{ anchor: 'root', glob: 'env/**' }] };
    const root = path.resolve(context.tmp, 'q4-root');
    const abs = (rel) => path.join(root, ...rel.split('/'));
    const finding = (rel, over = {}) => ({ File: abs(rel), StartLine: 3, EndLine: 3, RuleID: 'generic-api-key', Commit: 'abcdef0123456789', Match: SCAN_MARKER, Secret: SCAN_MARKER, Entropy: 4.2, Fingerprint: `${rel}:rule:3`, Description: SCAN_MARKER, ...over });
    if (scan && needFns(failures, scan, ['labelScanFindings'])) {
      const label = scan.labelScanFindings;
      await step('five findings keep their count and order; protected is true, true, false, true, false; only file, line, rule, commit and protected are returned', async () => {
        const findings = SCAN_FILES.map((rel, i) => (i % 2 === 0 ? finding(rel) : finding(rel, { File: rel })));
        const out = await runPure(check, 'five findings', (f) => label(f, root, deepFreeze(clone(policy))), findings);
        if (!out) return;
        check(out.length === 5 && eq(out.map((r) => r.file), SCAN_FILES), 'count 5 and the original order, root-relative POSIX files', out.map((r) => r.file));
        check(eq(out.map((r) => r.protected), [true, true, false, true, false]), 'protected: .env, env/private.json, the run vault are protected; docs/public.txt and .ai/.canary/item are not', out.map((r) => r.protected));
        check(out.every((r) => eq(sorted(Object.keys(r)), ['commit', 'file', 'line', 'protected', 'rule'])), 'only file, line, rule, commit and protected: no match, secret, entropy or other scanner field', Object.keys(out[0]));
        check(out.every((r) => r.line === 3 && r.rule === 'generic-api-key' && r.commit === 'abcdef01'), 'line, rule and the first eight characters of the commit', out[0]);
        check(!JSON.stringify(out).includes(SCAN_MARKER), 'no scanner secret reaches the result');
      });
      await step('line, rule and commit fall back as specified; File may be relative or absolute', async () => {
        const rows = [
          finding('a.txt', { StartLine: 0 }), finding('a.txt', { StartLine: -2 }), finding('a.txt', { StartLine: 1.5 }), finding('a.txt', { StartLine: '3' }), finding('a.txt', { StartLine: undefined }), finding('a.txt', { StartLine: 7 }),
          finding('a.txt', { RuleID: '' }), finding('a.txt', { RuleID: 5 }), finding('a.txt', { RuleID: undefined }), finding('a.txt', { RuleID: 'aws-key' }),
          finding('a.txt', { Commit: undefined }), finding('a.txt', { Commit: 12345 }), finding('a.txt', { Commit: 'abcd' }), finding('a.txt', { Commit: '0123456789abcdef' }),
        ];
        const out = await runPure(check, 'fallbacks', (f) => label(f, root, deepFreeze(clone(policy))), rows);
        if (!out) return;
        check(eq(out.slice(0, 6).map((r) => r.line), [null, null, null, null, null, 7]), 'a positive integer StartLine, otherwise null', out.slice(0, 6).map((r) => r.line));
        check(eq(out.slice(6, 10).map((r) => r.rule), ['unknown', 'unknown', 'unknown', 'aws-key']), 'a nonempty string RuleID, otherwise "unknown"', out.slice(6, 10).map((r) => r.rule));
        check(out[10].commit === null && out[11].commit === null && out[12].commit === 'abcd' && out[13].commit === '01234567', 'the first eight characters of a string Commit, otherwise null', out.slice(10).map((r) => r.commit));
        const noFile = await attempt(() => label([{ RuleID: 'x', StartLine: 1 }], root, clone(policy)));
        check(!noFile.threw && noFile.value[0].file === '', 'an absent File is an empty file name', noFile.threw ? errMsg(noFile.error) : noFile.value);
        const empty = await attempt(() => label([], root, clone(policy)));
        check(!empty.threw && eq(empty.value, []), 'no findings, no rows');
      });
      await step('a report that is not an array of objects is SCAN_REPORT_SHAPE; an invalid scanner root is SCAN_INPUT', async () => {
        const shape = 'SCAN_REPORT_SHAPE: scanner report must be an array of objects';
        for (const [labelText, value] of [['an object', {}], ['null', null], ['a string', 'x'], ['an array holding a number', [5]], ['an array holding null', [null]], ['an array holding a string', ['x']], ['an array holding an array', [[]]]]) {
          await expectErr(check, labelText, () => label(deepFreeze(clone(value)), root, clone(policy)), 'SCAN_REPORT_SHAPE', shape);
        }
        for (const bad of ['', null, undefined, 5, {}]) await expectErr(check, `root ${show(bad)}`, () => label([], bad, clone(policy)), 'SCAN_INPUT', 'SCAN_INPUT: scanner root must be a nonempty string');
      });
    }
    // ------------------------------------------------------------ the CLI ----
    const plain = await useBase(failures, 'plain', getPlainBase, context);
    if (!plain) return;
    await withScratch(context, 'q4', async (dir) => {
      const proj = cloneBase(dir, plain, 'proj');
      putFile(projPath(proj, T_POLICY), jsonText(policy));
      commitAll(context, proj, 'installed policy');
      const projAbs = (rel) => path.join(fs.realpathSync.native(proj), ...rel.split('/'));
      const report = SCAN_FILES.map((rel, i) => ({ File: i % 2 === 0 ? projAbs(rel) : rel, StartLine: i + 1, EndLine: i + 1, RuleID: `rule-${i}`, Commit: i === 0 ? undefined : `c${i}abcdef012345`, Match: SCAN_MARKER, Secret: SCAN_MARKER, Entropy: 3.5, Description: SCAN_MARKER }));
      kit.begin(proj, 'run-c3-q0');
      const run = (id, cfg, args = []) => {
        const stub = makeScanStub(dir, cfg);
        const r = kit.script('secret-scan', proj, ['--run-id', 'run-c3-q0', ...args], { preload: stub.file });
        return { r, stub };
      };
      await step('a successful scan keeps protected, vault and canary findings, labels them, stays redacted, adds no exclusion and prints the exact note', async () => {
        const { r, stub } = run('run-c3-q1', { mode: 'ok', report });
        check(r.code === 0 && r.stderr === '' && r.json && r.json.ok === true && r.json.status === 'scanned', 'the scan succeeds', { code: r.code, out: r.stdout.slice(0, 300), err: r.stderr.slice(0, 200) });
        const j = r.json || {};
        check(eq(sorted(Object.keys(j)), ['count', 'findings', 'note', 'ok', 'scope', 'status', 'tool']) && j.scope === 'worktree' && typeof j.tool === 'string' && j.tool.startsWith('gitleaks'), 'the response keys, scope worktree and a gitleaks tool string', Object.keys(j));
        check(j.count === 5 && j.findings.length === 5 && eq(j.findings.map((f) => f.file), SCAN_FILES), 'count 5: the vault and canary findings are no longer filtered', j.findings && j.findings.map((f) => f.file));
        check(eq(j.findings.map((f) => f.protected), [true, true, false, true, false]), 'protected true, true, false, true, false', j.findings && j.findings.map((f) => f.protected));
        check(eq(j.findings.map((f) => f.rule), ['rule-0', 'rule-1', 'rule-2', 'rule-3', 'rule-4']) && eq(j.findings.map((f) => f.line), [1, 2, 3, 4, 5]) && eq(j.findings.map((f) => f.commit), [null, 'c1abcdef', 'c2abcdef', 'c3abcdef', 'c4abcdef']), 'rule, line and commit are mapped from the scanner fields', j.findings);
        check(j.findings.every((f) => eq(sorted(Object.keys(f)), ['commit', 'file', 'line', 'protected', 'rule'])), 'no scanner field beyond the five is printed');
        check(j.note === MSG.SCAN_NOTE, 'the note is exact', j.note);
        check(!r.stdout.includes(SCAN_MARKER) && !r.stderr.includes(SCAN_MARKER), 'no scanner secret marker reaches stdout or stderr');
        const calls = stub.calls();
        const scanCall = calls.map((c) => c.argv).find((a) => Array.isArray(a) && (a.includes('dir') || a.includes('git')));
        check(scanCall && scanCall.includes('--redact') && scanCall.includes('dir'), 'the scanner runs on the worktree with --redact', scanCall);
        check(scanCall && !scanCall.some((a) => /exclude|ignore|config|baseline|allowlist/i.test(a)), 'no policy exclude, ignore or config argument was added: scanner input is not reduced', scanCall);
        check(scanCall && fs.realpathSync.native(scanCall[scanCall.length - 1]) === fs.realpathSync.native(proj), 'the scanned input is the whole repository root', scanCall && scanCall[scanCall.length - 1]);
      });
      await step('a missing scanner, a failed scan and a malformed report are not-scanned, never clean', async () => {
        const missing = run('run-c3-q2', { mode: 'missing' }).r;
        check(missing.code === 0 && missing.json && missing.json.ok === true && missing.json.status === 'not-scanned' && missing.json.reason === 'gitleaks not installed', 'a missing gitleaks is not-scanned', missing.stdout.slice(0, 200));
        const failed = run('run-c3-q3', { mode: 'fail' }).r;
        check(failed.code === 0 && failed.json && failed.json.status === 'not-scanned' && failed.json.reason === 'gitleaks failed (exit 2)', 'a failing scan is not-scanned with its exit code', failed.stdout.slice(0, 200));
        let i = 3;
        for (const [labelText, raw] of [['an object report', '{"not":"an array"}'], ['non-object elements', '[1,2]'], ['text that is not JSON', 'not json at all']]) {
          const r = run(`run-c3-q${++i}`, { mode: 'rawreport', raw }).r;
          check(r.code === 0 && r.json && r.json.ok === true && r.json.status === 'not-scanned' && r.json.reason === 'unreadable report', `${labelText}: the existing successful not-scanned response, reason unreadable report`, r.stdout.slice(0, 200));
          check(!r.stdout.includes('findings') && r.stderr === '', `${labelText}: no findings and empty stderr`);
        }
      });
    });
  });
}

// ================================================== V2/C3/recovery ====
// Plan 3.9, 4.7 and 7: a coupled migration commits through one C2 journal and rolls back through it; later edits are never overwritten.
async function recovery(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const v2 = await useBase(failures, 'genuine v2', getV2Base, context);
    const synth = await useBase(failures, 'synthetic skill', getSynthSkill, context);
    const clean = await useBase(failures, 'prepared clean migration', cleanPrepared, context);
    if (clean) withBuildFailures(failures, clean);
    if (!v2 || !synth || !clean || !clean.p.ok) { if (clean && !clean.p.ok) check(false, 'the clean migration prepared', clean.p.prep && clean.p.prep.stdout.slice(0, 300)); return; }
    const kit = makeKit(context, check, synth.root);
    const id = clean.id;
    const ORDER = [T_HELPER, T_READER, T_SETTINGS, T_POLICY, T_MANIFEST];
    const ORIGINAL = [T_READER, T_SETTINGS, T_POLICY, T_MANIFEST];
    await withScratch(context, 'v2rec', async (dir) => {
      let n = 0;
      const fresh = () => cloneTree(clean.root, path.join(dir, `s${++n}`));
      const origBytes = (rel) => readBytes(projPath(v2.root, rel));
      await step('one journal commits the coupled migration: helper, reader, settings, policy, then the manifest, with the staged results on disk', async () => {
        const r = fresh();
        const c = kit.commit(r, id, clean.p.sha);
        check(c.code === 0 && c.json && c.json.committed === true && eq(c.json.written.map((w) => w.target), ORDER), 'commit writes the five targets in the pinned order, the manifest last', c.json && c.json.written);
        const j = readJournal(r, id);
        check(j && j.committed === true && eq(j.entries.map((e) => [e.target, e.state]), ORDER.map((t) => [t, 'applied'])) && eq(j.metadataOps, clean.p.plan.metadataOps), 'a single journal holds every entry and the metadata operations', j && j.entries.map((e) => e.target));
        check(NH(readBytes(projPath(r, T_POLICY))) === NH(readBytes(draftPath(r, id, T_POLICY))) && NH(readBytes(projPath(r, T_SETTINGS))) === NH(readBytes(draftPath(r, id, T_SETTINGS))), 'the policy and the settings are the staged drafts');
        check(readText(manifestPath(r)) === JSON.stringify(clean.p.plan.manifestAfter, null, 2) + '\n', 'the manifest is exactly the approved manifestAfter');
        check(exists(projPath(r, T_HELPER)) && NH(readBytes(projPath(r, T_READER))) === SKILL_REVIEWED(synth.root, 'assets/tools/git-safe.mjs'), 'the helper exists and the reader is the reviewed synthetic reader');
        for (const t of ORIGINAL) check(sameBytes(readBytes(runFile(r, id, 'vault', 'backup', ...t.split('/'))), origBytes(t)), `${t}: the journal backup holds the exact original bytes`);
        check(!exists(runFile(r, id, 'vault', 'backup', ...T_HELPER.split('/'))), 'a newly created helper has no backup');
        const again = kit.prepare(r, id);
        check(again.code === 7 && again.json && /^prepare refused: run .* is committed/.test(again.json.error), 'a committed run cannot be prepared again (exit 7)', { code: again.code, out: again.stdout.slice(0, 200) });
      });
      await step('rollback restores the exact original policy, settings, reader and manifest bytes and removes the newly created helper', async () => {
        const r = fresh();
        check(kit.commit(r, id, clean.p.sha).code === 0, 'the migration commits');
        const rb = kit.rollback(r, id);
        check(rb.code === 0 && rb.json && rb.json.complete === true && eq(rb.json.restored, [T_MANIFEST, T_POLICY, T_SETTINGS, T_READER, T_HELPER]) && eq(rb.json.untouched, []), 'rollback completes through the same journal, last write first', rb.stdout.slice(0, 300));
        for (const t of ORIGINAL) check(sameBytes(readBytes(projPath(r, t)), origBytes(t)), `${t}: the exact original bytes are back`);
        check(!exists(projPath(r, T_HELPER)), 'the newly created helper is removed (its bytes still matched the run\'s expected written hash)');
        const st = kit.status(r, id);
        check(st.json && st.json.state === 'rolled-back' && exists(runFile(r, id, 'journal.json')), 'the run is rolled-back and keeps its journal as history');
      });
      await step('a later user edit stops the rollback of that file (exit 6): the edit and the backups are preserved, the other files are restored', async () => {
        const helperEdited = fresh();
        check(kit.commit(helperEdited, id, clean.p.sha).code === 0, 'the migration commits');
        fs.appendFileSync(projPath(helperEdited, T_HELPER), '// later user edit\n');
        const edit = readBytes(projPath(helperEdited, T_HELPER));
        const rb = kit.rollback(helperEdited, id);
        check(rb.code === 6 && rb.json && rb.json.ok === false && /^rollback incomplete:/.test(rb.json.error) && rb.json.skipped.some((x) => x.target === T_HELPER) && eq(rb.json.restored, [T_MANIFEST, T_POLICY, T_SETTINGS, T_READER]), 'a created helper that changed after the run is skipped; the rest is restored (exit 6)', { code: rb.code, out: rb.stdout.slice(0, 400) });
        check(sameBytes(readBytes(projPath(helperEdited, T_HELPER)), edit), 'the later edit is untouched');
        const st = kit.status(helperEdited, id);
        check(st.json && st.json.state === 'rollback-incomplete', 'the run is rollback-incomplete', st.json && st.json.state);
        const policyEdited = fresh();
        check(kit.commit(policyEdited, id, clean.p.sha).code === 0, 'a second migration commits');
        fs.appendFileSync(projPath(policyEdited, T_POLICY), '\n');
        const edited = readBytes(projPath(policyEdited, T_POLICY));
        const rb2 = kit.rollback(policyEdited, id);
        check(rb2.code === 6 && rb2.json && rb2.json.skipped.some((x) => x.target === T_POLICY), 'a later policy edit is skipped (exit 6)', { code: rb2.code, out: rb2.stdout.slice(0, 300) });
        check(sameBytes(readBytes(projPath(policyEdited, T_POLICY)), edited), 'the policy edit is untouched');
        check(sameBytes(readBytes(runFile(policyEdited, id, 'vault', 'backup', ...T_POLICY.split('/'))), origBytes(T_POLICY)), 'the policy backup is retained with the original bytes');
        const again = kit.prepare(policyEdited, id);
        check(again.code === 7, 'an unresolved run refuses another prepare (exit 7)', { code: again.code, out: again.stdout.slice(0, 200) });
      });
      await step('a normal C2 write failure after runtime writes: exit 5 and a recoverable journal; reuse is exit 7; rollback restores every byte', async () => {
        const r = fresh();
        const f = makeFault(dir, [{ dest: projPath(r, T_POLICY), nth: 1, action: 'throw' }]);
        const c = kit.commit(r, id, clean.p.sha, { preload: f.file });
        check(eq(f.fired().map((x) => x.action), ['throw']), 'the injected fault fired exactly once', f.fired());
        check(c.code === 5 && c.json && c.json.ok === false && /^apply failed mid-way:/.test(c.json.error) && eq(c.json.appliedSoFar, [T_HELPER, T_READER, T_SETTINGS]) && /rollback --run-id/.test(c.json.recovery), 'exit 5 listing the helper, the reader and the settings as applied', { code: c.code, out: c.stdout.slice(0, 300) });
        const j = readJournal(r, id);
        check(j && eq(j.entries.map((e) => [e.target, e.state]), [[T_HELPER, 'applied'], [T_READER, 'applied'], [T_SETTINGS, 'applied'], [T_POLICY, 'backed-up']]), 'the journal lists the three applied writes and the backed-up policy', j && j.entries.map((e) => `${e.target}:${e.state}`));
        check(sameBytes(readBytes(projPath(r, T_POLICY)), origBytes(T_POLICY)) && sameBytes(readBytes(manifestPath(r)), origBytes(T_MANIFEST)) && exists(projPath(r, T_HELPER)), 'the policy and the manifest are unchanged; the runtime writes landed');
        check(kit.status(r, id).json.state === 'partial', 'the run is partial');
        const rc = kit.commit(r, id, clean.p.sha);
        const rp = kit.prepare(r, id);
        check(rc.code === 7 && rc.json && /^commit refused: run .* is partial/.test(rc.json.error) && rp.code === 7 && rp.json && /^prepare refused: run .* is partial/.test(rp.json.error), 'commit and prepare of the partial run are refused with exit 7', { commit: rc.code, prepare: rp.code });
        const rb = kit.rollback(r, id);
        check(rb.code === 0 && rb.json && rb.json.complete === true && eq(rb.json.restored, [T_SETTINGS, T_READER, T_HELPER]) && eq(rb.json.untouched, [T_POLICY]), 'rollback restores the settings and the reader, removes the helper and finds the policy untouched', rb.stdout.slice(0, 300));
        for (const t of ORIGINAL) check(sameBytes(readBytes(projPath(r, t)), origBytes(t)), `${t}: the exact original bytes are back`);
        check(!exists(projPath(r, T_HELPER)), 'the helper is gone');
      });
      await step('a metadata-only run after a migration writes only the manifest and its rollback changes only the manifest', async () => {
        const done = await commitClean(context, check, dir, 'meta');
        if (!done) return;
        check(kit.lock(done.root, ['release', '--run-id', id]).code === 0, 'the migration run releases the lock');
        const tree = () => JSON.stringify(walkTree(done.root, ['.git']).filter(([rel]) => !rel.startsWith('.ai/.run') && !rel.startsWith('.ai/.setup.lock') && rel !== '.ai/manifest.json'));
        const before = tree();
        const manifestBefore = readBytes(manifestPath(done.root));
        const p = runSpec(kit, done.root, 'run-c3-mo1', { requests: { 'manifest-metadata.json': { codexSnippetSha256: H64('e') } } });
        check(p.ok === true && p.plan.ops.length === 0, 'a snippet-only run prepares with no content operation', p.prep && p.prep.stdout.slice(0, 300));
        if (!p.ok) return;
        const c = kit.commit(done.root, 'run-c3-mo1', p.sha);
        check(c.code === 0 && c.json && eq(c.json.written, [{ target: T_MANIFEST, created: false }]) && tree() === before, 'commit writes only the manifest', c.stdout.slice(0, 300));
        const rb = kit.rollback(done.root, 'run-c3-mo1');
        check(rb.code === 0 && rb.json && eq(rb.json.restored, [T_MANIFEST]) && sameBytes(readBytes(manifestPath(done.root)), manifestBefore) && tree() === before, 'rollback restores only the manifest', rb.stdout.slice(0, 300));
      });
    });
  });
}

// ================================================= V2/C3/module-contract ====
// Plan 2.4, 3.12, 4.1, 4.7 and 4.8: the exact exports, pure functions, error shapes, the registration, the runner seam, the existing-suite edits and
// the blocks alias protection.
async function moduleContract(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const render = await needSafeScript(failures, context, 'render-permissions.mjs');
    const merge = await needSafeScript(failures, context, 'merge-claude-settings.mjs');
    const mig = await needSafeScript(failures, context, 'migrate-security-paths.mjs');
    const scan = await needSafeScript(failures, context, 'secret-scan.mjs');
    const lib = await needScript(failures, context, 'lib.mjs');
    const kit = makeKit(context, check);

    await step('import safety and the exact export sets of the new and extended modules (a CLI module must not run on import)', async () => {
      await withScratch(context, 'imp', async (dir) => {
        checkImportSafe(check, 'scripts/render-permissions.mjs', context, dir, scriptUrl(context, 'render-permissions.mjs'), RENDER_EXPORTS);
        checkImportSafe(check, 'scripts/merge-claude-settings.mjs', context, dir, scriptUrl(context, 'merge-claude-settings.mjs'), MERGE_EXPORTS);
        checkImportSafe(check, 'scripts/migrate-security-paths.mjs', context, dir, scriptUrl(context, 'migrate-security-paths.mjs'), MIGRATE_EXPORTS);
        checkImportSafe(check, 'scripts/secret-scan.mjs', context, dir, scriptUrl(context, 'secret-scan.mjs'), SCAN_EXPORTS);
        checkImportSafe(check, 'scripts/lib.mjs (every C2 export kept, loadEffectivePolicy added)', context, dir, scriptUrl(context, 'lib.mjs'), [...LIB_OLD_EXPORTS, ...LIB_NEW_EXPORTS]);
        checkImportSafe(check, 'tests/c3.test.mjs', context, dir, import.meta.url, CASE_EXPORTS);
      });
    });
    if (render && merge && mig && scan && needFns(failures, render, ['renderSecurityControls']) && needFns(failures, merge, ['mergeManagedDenies']) && needFns(failures, mig, MIGRATE_EXPORTS) && needFns(failures, scan, ['labelScanFindings'])) {
      const fixture = loadMigrationFixture(check, context);
      await step('the pure functions are synchronous and touch no filesystem, process spawning, process stream, exit or environment; results are fresh, mutable data', async () => {
        const policy = pol2([{ anchor: 'any', glob: '**/.env*' }], [{ anchor: 'root', glob: 'env/**' }]);
        const clean = fixture && byId(fixture).get('known-unchanged');
        const calls = [
          () => render.renderSecurityControls(deepFreeze(clone(policy))),
          () => merge.mergeManagedDenies(deepFreeze(clone({ settings: { permissions: { deny: ['Read(x)'] } }, managed: {}, policy, omissions: {}, dropOwnership: [], overrideUserExceptions: false }))),
          () => mig.readRuntimeUnits(deepFreeze(clone(CATALOG_INITIAL))),
          () => mig.checkSecurityToolUnit(deepFreeze([trow({ reviewedSha256: H64('1'), plannedSha256: H64('1') })]), 2),
          () => scan.labelScanFindings(deepFreeze([{ File: 'a.txt', StartLine: 1, RuleID: 'r', Commit: 'abcdef0123' }]), path.resolve(context.tmp, 'q4-root'), deepFreeze(clone(policy))),
          ...(clean ? [
            () => mig.classifySecurityMigration(deepFreeze(clone(clean.input))),
            () => mig.resolveSecurityMigration(deepFreeze(clone(clean.input)), deepFreeze({ ...clone(clean.decisions), reportSha256: reportHashOf(mig.classifySecurityMigration(clone(clean.input))) })),
            () => mig.inspectSecurityState(deepFreeze(clone(clean.input))),
          ] : []),
          // the error paths too
          () => { try { render.renderSecurityControls(pol2([], [], { codexGlobScanMaxDepth: 0 })); } catch (e) { return e.code; } return null; },
          () => { try { merge.mergeManagedDenies({ settings: { permissions: { deny: 'x' } }, managed: {}, policy, omissions: {}, dropOwnership: [], overrideUserExceptions: false }); } catch (e) { return e.code; } return null; },
          () => { try { mig.readRuntimeUnits(null); } catch (e) { return e.code; } return null; },
          () => { try { mig.checkSecurityToolUnit('x', 2); } catch (e) { return e.code; } return null; },
          () => { try { scan.labelScanFindings({}, 'x', policy); } catch (e) { return e.code; } return null; },
        ];
        const rec = await withStreamGuard(async () => calls.map((c) => observeEffects(c)));
        check(rec.threw === null && Array.isArray(rec.value), 'the observed calls complete', rec.threw && errMsg(rec.threw));
        check(rec.out.length === 0 && rec.err.length === 0 && rec.exits.length === 0 && !rec.exitCodeChanged, 'no stdout, no stderr, no process.exit, no exit code', { out: rec.out.join('').slice(0, 100), err: rec.err.join('').slice(0, 100), exits: rec.exits });
        const results = rec.value || [];
        results.forEach((o, i) => {
          check(o.thrown === null, `call ${i}: does not throw`, o.thrown && errMsg(o.thrown));
          check(o.log.length === 0, `call ${i}: no filesystem, spawn or environment access`, o.log.slice(0, 5));
          check(!(o.value && typeof o.value === 'object' && typeof o.value.then === 'function'), `call ${i}: synchronous`);
          if (o.value && typeof o.value === 'object') check(!Object.isFrozen(o.value), `call ${i}: the returned data is mutable (never frozen)`);
        });
        const tail = results.slice(-5).map((o) => o.value);
        check(eq(tail, ['RENDER_DEPTH', 'DENY_SETTINGS', 'TOOL_CATALOG', 'TOOL_UNIT_INPUT', 'SCAN_REPORT_SHAPE']), 'the error paths report their codes', tail);
        check(Object.isFrozen(render.CLAUDE_COMMAND_DENY), 'CLAUDE_COMMAND_DENY is frozen');
      });
      await step('every pure error is an Error with an own string code and a message prefixed by it; none carries the offending data', async () => {
        const marker = 'ERRCONTRACT-MARKER-7d3a';
        const cases = [
          ['RENDER_DEPTH', () => render.renderSecurityControls(pol2([{ anchor: 'any', glob: `**/${marker}` }], [], { codexGlobScanMaxDepth: 0 }))],
          ['DENY_SETTINGS', () => merge.mergeManagedDenies({ settings: { permissions: { deny: [marker, 1] } }, managed: {}, policy: pol2([]), omissions: {}, dropOwnership: [], overrideUserExceptions: false })],
          ['DENY_OWNERSHIP_SELECTION', () => merge.mergeManagedDenies({ settings: { permissions: { deny: [] } }, managed: {}, policy: pol2([]), omissions: {}, dropOwnership: [marker], overrideUserExceptions: false })],
          ['MIGRATION_INPUT', () => mig.classifySecurityMigration({ marker })],
          ['TOOL_CATALOG', () => mig.readRuntimeUnits({ schema: marker })],
          ['TOOL_UNIT_INPUT', () => mig.checkSecurityToolUnit([{ marker }], 2)],
          ['TOOL_UNIT_INCOMPATIBLE', () => mig.checkSecurityToolUnit([trow({ policySchemas: [1] })], 2)],
          ['TOOL_UNIT_UNREVIEWED', () => mig.checkSecurityToolUnit([trow()], 2)],
          ['SCAN_INPUT', () => scan.labelScanFindings([], '', pol2([]))],
          ['SCAN_REPORT_SHAPE', () => scan.labelScanFindings([marker], 'x', pol2([]))],
        ];
        if (fixture) {
          const c = byId(fixture).get('known-unchanged');
          cases.push(['MIGRATION_DECISIONS', () => mig.resolveSecurityMigration(clone(c.input), { marker })]);
          cases.push(['MIGRATION_REPORT_CHANGED', () => mig.resolveSecurityMigration(clone(c.input), { ...clone(c.decisions), reportSha256: H64('a') })]);
          cases.push(['MIGRATION_DECISION_REQUIRED', () => mig.resolveSecurityMigration(clone(c.input), { ...clone(c.decisions), reportSha256: reportHashOf(mig.classifySecurityMigration(clone(c.input))), coverage: [] })]);
        }
        for (const [code, fn] of cases) {
          const e = await expectErr(check, `${code}`, fn, code);
          check(!e || !e.message.includes(marker), `${code}: the message never echoes the offending data`, e && e.message);
        }
      });
    }
    await step('C12-12 observer controls: already-imported named fs and child_process bindings are observed, and every builtin and binding is restored after a successful and after a throwing callback', async () => {
      await withScratch(context, 'obs', async (dir) => {
        const target = path.join(dir, 'observed.txt');
        fs.writeFileSync(target, 'x');
        const missingExecutable = path.join(dir, 'no-such-executable');
        check(observerRestored(), 'before the first window every builtin and named binding is the original');
        const okRun = observeEffects(() => {
          boundReadFileSync(target);
          boundStatSync(target);
          spawnSync(missingExecutable, [], { windowsHide: true });
          return 'done';
        });
        check(okRun.thrown === null && okRun.value === 'done', 'a successful callback returns its value and records no throw', okRun.thrown && errMsg(okRun.thrown));
        check(okRun.log.includes('fs.readFileSync') && okRun.log.includes('fs.statSync') && okRun.log.includes('child_process.spawnSync'), 'positive control: the named filesystem and child-process bindings imported before the window are observed', okRun.log);
        check(observerRestored(), 'after a successful callback every builtin and named binding is the original again');
        const logged = okRun.log.length;
        boundReadFileSync(target);
        spawnSync(missingExecutable, [], { windowsHide: true });
        check(okRun.log.length === logged, 'after the window nothing more is recorded (the wrappers are gone)');
        const badRun = observeEffects(() => {
          boundReadFileSync(target);
          throw new Error('c12-observer-throw');
        });
        check(badRun.thrown instanceof Error && badRun.thrown.message === 'c12-observer-throw' && badRun.log.includes('fs.readFileSync'), 'a throwing callback is reported as thrown and its earlier effects stay recorded', { thrown: badRun.thrown && badRun.thrown.message, log: badRun.log });
        check(observerRestored(), 'after a throwing callback every builtin and named binding is the original again');
        const quiet = observeEffects(() => 1 + 1);
        check(quiet.value === 2 && quiet.thrown === null && quiet.log.length === 0, 'negative control: a callback that touches nothing records nothing', quiet.log);
        check(observerRestored(), 'after the quiet window every builtin and named binding is the original');
      });
    });
    // -------------------------------------------------------------- registry ----
    await step('4.1 the C3 inventory, its registration and the unchanged C11a, C1 and C2 inventories', async () => {
      const rc = await needSibling(failures, 'rc1-cases.mjs');
      if (!rc) return;
      check(eq(sorted(Object.keys(rc)), RC1_CASES_EXPORTS), 'rc1-cases.mjs keeps its exports (registerRc1Cases is unchanged)', Object.keys(rc));
      const exp = rc.COMPONENT_ASSERTIONS && rc.COMPONENT_ASSERTIONS.C3;
      check(Array.isArray(exp) && eq(JSON.parse(JSON.stringify(exp)), EXPECTED_DESCRIPTORS), 'COMPONENT_ASSERTIONS.C3 is the eighteen descriptors of plan 4.1, written independently, in order', exp);
      check(deepFrozen(exp) && Array.isArray(exp), 'COMPONENT_ASSERTIONS.C3 and every descriptor are deep-frozen');
      const impls = rc.COMPONENT_IMPLEMENTATIONS && rc.COMPONENT_IMPLEMENTATIONS.C3;
      check(Array.isArray(impls) && Object.isFrozen(impls), 'COMPONENT_IMPLEMENTATIONS.C3 is a frozen array', impls && Object.isFrozen(impls));
      check(Array.isArray(impls) && impls.length === C3_IMPLEMENTATIONS.length && impls.every((x, i) => x === C3_IMPLEMENTATIONS[i]), 'it holds exactly the descriptor objects of C3_IMPLEMENTATIONS, in order (identity preserved)');
      check(Object.isFrozen(C3_IMPLEMENTATIONS) && eq(C3_IMPLEMENTATIONS.map((x) => x.id), EXPECTED_DESCRIPTORS.map((d) => d.id)) && C3_IMPLEMENTATIONS.every((x) => typeof x.run === 'function' && Object.isFrozen(x)), 'C3_IMPLEMENTATIONS is a frozen array of the eighteen IDs with callable run functions and frozen descriptors');
      for (const [name, want] of [['C11a', C11A_DESCRIPTORS], ['C1', C1_DESCRIPTORS], ['C2', C2_DESCRIPTORS]]) {
        check(eq(JSON.parse(JSON.stringify(rc.COMPONENT_ASSERTIONS[name])), want) && eq(rc.COMPONENT_IMPLEMENTATIONS[name].map((x) => x.id), want.map((d) => d.id)), `the ${name} inventory and implementations are unchanged`, rc.COMPONENT_ASSERTIONS && rc.COMPONENT_ASSERTIONS[name]);
      }
      const calls = [];
      const ret = rc.registerRc1Cases((...a) => calls.push(a), context);
      check(calls.length === 40 && eq(calls.map((c) => c[0]), [...rc.RC1_CASE_IDS]) && calls.every((c) => typeof c[2] === 'function') && ret === undefined && !calls.some((c) => c[0].includes('/C3/')), 'registerRc1Cases registers exactly the 40 ordered RC1_CASE_IDS with function callbacks, returns undefined and registers no /C3/ ID (plan C11b 4.4)', calls.length);
      {
        const executed = []; const seen = []; const scratch = () => { try { return fs.readdirSync(context.tmp).sort().join('|'); } catch { return ''; } }; const before = scratch();
        const again = rc.registerRc1Cases((...a) => seen.push(a), { repository: context.repository, getComponent: (name) => { executed.push(name); return Promise.resolve(null); } });
        check(executed.length === 0 && seen.length === 40 && again === undefined && scratch() === before, 'registration performs no execution and no fixture work: no component is requested and the scratch directory is unchanged', { executed, registered: seen.length });
      }
      check(rc.BASELINE_CASE_IDS.length === 60 && rc.RC1_CASE_IDS.length === 40 && !rc.REQUIRED_CASE_IDS.some((x) => x.includes('/C3/')), 'RC1_CASE_IDS and the baseline case IDs are untouched', { baseline: rc.BASELINE_CASE_IDS.length, rc1: rc.RC1_CASE_IDS.length });
    });
    await step('4.1/6 the runner seam with the C3 inventory: eighteen successful outcomes print the exact plan 6 records; a missing group, a failure and a forbidden skip fail as before', async () => {
      const rcm = await needSibling(failures, 'run-component-tests.mjs');
      if (!rcm) return;
      const results = path.join(context.tmp, 'component-results.json');
      const ran = [];
      const impl = (id, make) => ({ id, run: () => { ran.push(id); return make ? make() : { failures: [], skipped: null }; } });
      const exp = () => EXPECTED_DESCRIPTORS.map((d) => ({ ...d }));
      let captured = null;
      const seam = async (impls, writeEvidence = (report) => { captured = report; return results; }) => {
        ran.length = 0;
        const rec = await withStreamGuard(() => rcm.main(['--component', 'C3'], { context, registry: { expected: { C3: exp() }, implementations: { C3: impls } }, writeEvidence }));
        check(rec.threw === null && rec.out.length === 0 && rec.err.length === 0 && rec.exits.length === 0, 'main resolves and writes no process stream', rec.threw && errMsg(rec.threw));
        return rec.value;
      };
      const passing = EXPECTED_DESCRIPTORS.map((d) => impl(d.id));
      const ok = await seam(passing);
      const okLines = [...PLAN6_RECORDS, '18 PASS / 0 FAIL / 0 SKIP', `RESULTS  ${results}`];
      check(ok && ok.exitCode === 0 && ok.stderr === '' && ok.stdout === `${okLines.join('\n')}\n`, 'eighteen successful outcomes yield exactly the plan 6 records, totals and RESULTS line: exit 0, empty stderr, every line ending in LF', ok && ok.stdout);
      check(eq(ran, EXPECTED_DESCRIPTORS.map((d) => d.id)), 'each implementation ran once, in expected order', ran);
      check(captured && captured.component === 'C3' && captured.ok === true && eq(captured.errors, []) && eq(captured.summary, { passed: 18, failed: 0, skipped: 0 }) && Array.isArray(captured.results) && captured.results.length === 18
        && captured.results.every((r, i) => r.id === EXPECTED_DESCRIPTORS[i].id && r.name === EXPECTED_DESCRIPTORS[i].name && r.status === 'PASS' && eq(r.failures, [])), 'the report is { component C3, ok true, errors [], summary 18/0/0 } with eighteen PASS results matching the inventory', captured && { c: captured.component, ok: captured.ok, s: captured.summary });
      const missing = await seam(passing.slice(1));
      check(missing && missing.exitCode === 1 && missing.stderr === '' && missing.stdout === `COMPONENT  FAIL  missing-group  R44/C3/anchors\n0 PASS / 0 FAIL / 0 SKIP\nRESULTS  ${results}\n`, 'a missing first implementation yields missing-group and exit 1', missing && missing.stdout);
      check(ran.length === 0, 'a structural failure executes no implementation', ran);
      for (const index of [0, 9, 17]) {
        for (const [make, diag, label] of [[() => ({ failures: ['sentinel'], skipped: null }), 'sentinel', 'failures [sentinel]'], [() => ({ failures: [], skipped: 'sentinel' }), 'skip-forbidden: sentinel', 'skipped "sentinel"']]) {
          const impls = EXPECTED_DESCRIPTORS.map((d, i) => (i === index ? impl(d.id, make) : impl(d.id)));
          const v = await seam(impls);
          const lines = [...EXPECTED_DESCRIPTORS.flatMap((d, i) => (i === index ? [`FAIL  ${d.id}  ${d.name}`, `        - ${diag}`] : [`PASS  ${d.id}  ${d.name}`])), '17 PASS / 1 FAIL / 0 SKIP', `RESULTS  ${results}`];
          check(v && v.exitCode === 1 && v.stderr === '' && v.stdout === `${lines.join('\n')}\n`, `${label} at position ${index}: the FAIL record, the exact diagnostic, 17 PASS / 1 FAIL / 0 SKIP, exit 1`, v && v.stdout);
          check(ran.length === 18, `${label} at position ${index}: the remaining implementations still ran`, ran.length);
        }
      }
      const boom = await seam(passing, () => { throw new Error('disk full'); });
      check(boom && boom.exitCode === 1 && boom.stderr === '' && boom.stdout === 'COMPONENT  FAIL  evidence-write\n', 'a throwing evidence writer yields only COMPONENT  FAIL  evidence-write', boom);
    });
    await step('4.8 the existing-suite edits: R15 embeds C3, R09 and R17 expect Read(**/.env*), the C2 I2-10 control records its automatic manifest entry', async () => {
      const src = readText(path.join(context.skillRoot, 'tests', 'run-tests.mjs'));
      if (src === null) { check(false, 'tests/run-tests.mjs is readable'); return; }
      check(/test\('R15', 'ownership metadata is bound to the approved plan', async \(\) =>/.test(src), 'R15 keeps its ID and name and stays async');
      check((src.match(/runComponentAssertions\('C3'/g) || []).length === 1 && (src.match(/runComponentAssertions\('C2'/g) || []).length === 1 && src.includes("path.join(TMP, 'c3')"), 'R15 embeds exactly one runComponentAssertions(\'C3\', context) next to the C2 one');
      const r15 = src.slice(src.indexOf("test('R15'"), src.indexOf("test('R16'"));
      check(r15.indexOf("runComponentAssertions('C2'") < r15.indexOf("runComponentAssertions('C3'") && r15.slice(r15.indexOf("runComponentAssertions('C3'")).includes('.ok === true'), 'the C3 run follows the existing component coverage in R15 and R15 fails unless that report is ok');
      check(!/console\.log|process\.stdout\.write/.test(r15), 'R15 prints no C3 sub-record');
      const r09 = src.slice(src.indexOf("test('R09'"), src.indexOf("test('R10'"));
      const r17 = src.slice(src.indexOf("test('R17'"), src.indexOf('rc.3 review'));
      for (const [name, text] of [['R09', r09], ['R17', r17]]) {
        check(text.includes('Read(**/.env*)') && !text.includes('Read(**/.env.*)'), `${name} expects the replacement Read(**/.env*) and no longer the old managed rule`);
      }
      check(r17.includes('Read(![.]env.example)') && r17.includes("'Read(!docs/README.md)'") && r17.includes("'Read(!README.md)'") && r17.includes("runComponentAssertions('C1'"), 'R17 keeps its bracket-exception, disjoint and bare-name controls and its C1 embedding');
      check(src.includes("test('R10'") && src.includes("test('S01'") && src.includes("test('S02'") && src.includes("test('S03'"), 'R10, S01, S02 and S03 are still there');
      const c2src = readText(path.join(context.skillRoot, 'tests', 'c2.test.mjs')) || '';
      const step210 = c2src.slice(c2src.indexOf("await step('I2-10 commit refuses"), c2src.indexOf("await step('I2-10 commit refuses") + 4200);
      check(/ctlTarget[\s\S]{0,1600}ownership: 'merged'/.test(step210) && step210.includes('docs/i210-control.md'), 'the C2 I2-10 successful control sets the automatic { ownership: "merged" } record for docs/i210-control.md in manifestAfter');
    });
    // ------------------------------------------------------ blocks alias ----
    const plain = await useBase(failures, 'plain', getPlainBase, context);
    if (plain) {
      await withScratch(context, 'alias', async (dir) => {
        const root = cloneBase(dir, plain, 'proj');
        putFile(projPath(root, 'docs/alias.md'), '# alias spelling\n');
        putFile(projPath(root, 'docs/real.md'), '# real file\n');
        commitAll(context, root, 'docs');
        const aliasPath = projPath(root, 'docs/alias.md');
        const blocks = (args, o = {}) => kit.script('blocks', root, args, o);
        await step('blocks --file: a permitted spelling whose native realpath is protected is refused before its content is opened; a permitted realpath reads; the literal protected spelling keeps its legacy envelope', async () => {
          const guard = makeGuard(dir, [aliasPath], 'record');
          const stub = makeRealpathStub(dir, aliasPath, path.join(fs.realpathSync.native(root), '.env'));
          const r = blocks(['check', '--file', 'docs/alias.md'], { preload: [guard.file, stub.file] });
          expectF(check, 'a protected alias', r, { code: 'POLICY_INPUT_ALIAS', exit: 2, error: MSG.ALIAS });
          check(stub.hits().length >= 1, 'the exact-path realpath stub was consulted (interception demonstrated)', stub.hits());
          check(guard.hits().length === 0, 'the aliased file content was not opened', guard.hits().slice(0, 3));
          const guard2 = makeGuard(dir, [aliasPath], 'record');
          const stub2 = makeRealpathStub(dir, aliasPath, path.join(fs.realpathSync.native(root), 'docs', 'real.md'));
          const ok = blocks(['check', '--file', 'docs/alias.md'], { preload: [guard2.file, stub2.file] });
          check(ok.code === 0 && ok.json && ok.json.ok === true && ok.json.file === 'docs/alias.md' && ok.json.exists === true, 'control: a permitted realpath reads successfully', { code: ok.code, out: ok.stdout.slice(0, 200) });
          check(stub2.hits().length >= 1 && guard2.hits().length >= 1, 'control: the stub was consulted and the content was read', { stub: stub2.hits().length, reads: guard2.hits().length });
          const literal = blocks(['check', '--file', '.env']);
          check(literal.code === 1 && literal.stderr === '' && eq(literal.json, { ok: false, error: 'refusing to read a secret-pattern path: .env' }) && literal.stdout === jsonText(literal.json), 'a literal protected spelling keeps the exit-1 legacy envelope without a code field', { code: literal.code, out: literal.stdout.slice(0, 200) });
          const plainRead = blocks(['check', '--file', 'docs/real.md']);
          check(plainRead.code === 0 && plainRead.json && plainRead.json.ok === true, 'an ordinary permitted file reads without any stub', plainRead.stdout.slice(0, 200));
        });
        await step('blocks upsert of a missing permitted target stays supported; the alias refusal does not apply to a path that does not exist yet', async () => {
          kit.begin(root, 'run-c3-al1');
          putFile(path.join(dir, 'content.txt'), 'managed content\n');
          const r = blocks(['upsert', '--file', 'docs/new-doc.md', '--id', 'sec', '--content', path.join(dir, 'content.txt'), '--run-id', 'run-c3-al1']);
          check(r.code === 0 && r.json && r.json.ok === true && r.json.file === 'docs/new-doc.md' && r.json.block === 'sec' && exists(draftPath(root, 'run-c3-al1', 'docs/new-doc.md')), 'the draft is written for a target that does not exist yet', { code: r.code, out: r.stdout.slice(0, 300) });
        });
      });
    }
  });
}

// ============================================================ registration ====
// The array wired into COMPONENT_IMPLEMENTATIONS.C3 (plan 4.1): frozen, descriptors frozen, in the plan order.
export const C3_IMPLEMENTATIONS = Object.freeze([
  { id: 'R44/C3/anchors', run: (context) => anchors(context) },
  { id: 'R47/C3/project-controls', run: (context) => projectControls(context) },
  { id: 'R74/C3/rendering', run: (context) => rendering(context) },
  { id: 'R48/C3/project-moves', run: (context) => projectMoves(context) },
  { id: 'R78/C3/baseline', run: (context) => baseline(context) },
  { id: 'R78/C3/migration', run: (context) => migration(context) },
  { id: 'R78/C3/replacement-coverage', run: (context) => replacementCoverage(context) },
  { id: 'R52/C3/user-denies', run: (context) => userDenies(context) },
  { id: 'R85/C3/retained-denies', run: (context) => retainedDenies(context) },
  { id: 'R80/C3/snapshot', run: (context) => snapshot(context) },
  { id: 'R80/C3/tool-unit', run: (context) => toolUnit(context) },
  { id: 'R80/C3/manifest-after', run: (context) => manifestAfter(context) },
  { id: 'R81/C3/recorded-patterns', run: (context) => recordedPatterns(context) },
  { id: 'R82/C3/snippet', run: (context) => snippet(context) },
  { id: 'R97/C3/environment-controls', run: (context) => environmentControls(context) },
  { id: 'Q4/C3/scan-labels', run: (context) => scanLabels(context) },
  { id: 'V2/C3/recovery', run: (context) => recovery(context) },
  { id: 'V2/C3/module-contract', run: (context) => moduleContract(context) },
].map((d) => Object.freeze(d)));
