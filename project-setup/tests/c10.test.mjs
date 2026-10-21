// C10 tests lane: the twenty component assertions of "C10. Doctor and validation".
//
// Written from the frozen plan only, before any implementation exists:
//   docs/plans/2026-10-20-project-setup-v3-rc1-c10.md   (sections 1-9 and the freeze addendum C10-P3-1 to C10-P3-3, which wins over earlier sections; the closed maintainer decisions PQ1 = A (the ordered activation table of 4.8) and PQ2 = A+ (the missing-member severity of 4.9))
// Under the frozen architecture plan docs/plans/2026-10-15-project-setup-v3-rc1.md and the landed contracts it builds on: C11a (tests/rc1-cases.mjs, tests/run-component-tests.mjs), C1 (assets/tools/security-policy.mjs),
// C2 (scripts/ownership.mjs, scripts/schemas.mjs, scripts/lib.mjs), C3 (scripts/migrate-security-paths.mjs inspectSecurityState and readRuntimeUnits, scripts/render-permissions.mjs), C4-C6 (data/runtime-units.json, the seven
// runtime members, assets/tools/hooks-selftest.mjs), C7 (scripts/classify-allows.mjs), C8 and C9 (the landed SKILL.md, README, references and detect.mjs text the C10 text is edited against). Plan 2.2 and 6.4 give the tests lane this
// file, tests/fixtures/doctor-cases.json, the tests/rc1-cases.mjs registration, the R29 aggregation and the baseline S01 expectation in tests/run-tests.mjs, and the explicit edits of tests/c2.test.mjs, tests/c3.test.mjs,
// tests/c8.test.mjs and tests/c9.test.mjs; those edits live in those files. The implementer must not edit any of them.
//
// Importing this module runs nothing. Every production module and the registry module (rc1-cases.mjs imports this file, so a static import back would be circular) is imported lazily inside run(context). A missing module,
// export or fixture fails one assertion with a diagnostic; it never breaks the import.
//
// Every run(context) returns { failures, skipped: null }. There is no skip path. Scratch data lives under context.tmp only. Plan 6.5: argument, report, configuration, log, process, catalog and activation matrices run in
// process through the plan's seams; processes are spawned only for the doctor and validator CLI/import checks, the two real installed self-test runs, the three detect CLI runs and small Git fixture calls. No real Codex run,
// model session, host sandbox probe, live Desktop or process inventory and no user-level configuration read happens here: the doctor only ever sees the in-memory filesystem and executor defined below.
//
// Where the plan does not pin a value a test would need, the test asserts only what is pinned. The gaps are listed in the delegation report as PLAN-GAP lines; the places they touch carry a comment starting with "PLAN-GAP".
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp, { spawnSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
const J = jsonText; // the plan's J(value)
const WIN = process.platform === 'win32';
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
const clip = (s) => show(String(s).length > 90 ? `${String(s).slice(0, 90)}... (${String(s).length} chars)` : s);
const lc = (p) => (WIN ? String(p).toLowerCase() : String(p));
const normText = (s) => { let t = Buffer.isBuffer(s) ? s.toString('utf8') : String(s); if (t.charCodeAt(0) === 0xfeff) t = t.slice(1); t = t.replace(/\r\n?/g, '\n'); if (!t.endsWith('\n')) t += '\n'; return t; };
// The fixture hashes of manifests are computed here, never taken from a production function: normalized text (no BOM, LF, one final LF) hashed with SHA-256.
const NH = (s) => sha(Buffer.from(normText(s), 'utf8'));

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
const scriptUrl = (context, name) => pathToFileURL(path.join(context.skillRoot, 'scripts', name)).href;
const skillPath = (context, rel) => path.join(context.skillRoot, ...rel.split('/'));
// The first difference of two JSON-like values as a short path, for diagnostics of large reports.
function firstDiff(a, b, at = '') {
  if (eq(a, b)) return null;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return `${at || '(root)'}: got ${show(a, 160)} want ${show(b, 160)}`;
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  for (const k of keys) {
    if (!(k in a)) return `${at}.${k}: missing, want ${show(b[k], 160)}`;
    if (!(k in b)) return `${at}.${k}: unexpected ${show(a[k], 160)}`;
    const d = firstDiff(a[k], b[k], `${at}.${k}`);
    if (d) return d;
  }
  return `${at || '(root)'}: key order or prototype differs`;
}

// ------------------------------------------------------------- scratch ----
// The native (long-name) real path: Git, the setup scripts and the code under test all report that spelling.
function scratchDir(context, label) {
  fs.mkdirSync(context.tmp, { recursive: true });
  return fs.realpathSync.native(fs.mkdtempSync(path.join(context.tmp, `c10-${label}-`)));
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
// A directory link: a junction on Windows (no privilege needed), a symbolic link elsewhere. Returns false when it cannot be created.
function linkDir(target, link) {
  try { fs.symlinkSync(target, link, WIN ? 'junction' : 'dir'); createdLinks.add(link); return true; } catch { return false; }
}
function walkFiles(root) {
  const out = [];
  const rec = (dir, rel) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (!rel && e.name === '.git') continue;
      if (e.isSymbolicLink()) out.push(r);
      else if (e.isDirectory()) rec(path.join(dir, e.name), r);
      else out.push(r);
    }
  };
  rec(root, '');
  return out.sort();
}
// The retained diagnostics: a plain file in the kept scratch directory (process counts, link-creation notes).
function diag(context, line) { try { fs.mkdirSync(context.tmp, { recursive: true }); fs.appendFileSync(path.join(context.tmp, 'c10-diagnostics.log'), `${line}\n`); } catch { /* best effort */ } }
// Process accounting (plan 6.5 gives an estimate, not an assertion): every Node or Git launch made by this file is counted per assertion and retained in the diagnostics file.
const PROCESS_COUNTS = new Map();
function countProcess(context, n = 1) { PROCESS_COUNTS.set(context.tmp, (PROCESS_COUNTS.get(context.tmp) || 0) + n); }
const processMark = (context) => PROCESS_COUNTS.get(context.tmp) || 0;
function flushProcessCount(context, label, mark) { diag(context, `processes in ${label}: ${processMark(context) - mark} (cumulative ${processMark(context)})`); }
function spawnNode(context, args, o = {}) {
  countProcess(context);
  return spawnSync(process.execPath, args, { cwd: o.cwd || context.tmp, env: o.env || { ...context.env }, encoding: 'utf8', windowsHide: true, shell: false, timeout: 120000, input: o.input });
}
function gitIn(context, cwd, args) {
  countProcess(context);
  return spawnSync('git', args, { cwd, env: { ...context.env }, encoding: 'utf8', windowsHide: true, shell: false, timeout: 60000 });
}
function initRepo(context, root) {
  fs.mkdirSync(root, { recursive: true });
  const r = gitIn(context, root, ['init', '-q']);
  return r.status === 0;
}

// ============================================================ literals ====
// Written out independently of the implementation (plan 6.1: the descriptors; sections 3, 4 and 5.2: the grammar, codes, texts, rows and documentation).
const COMPONENT_INVENTORY = [
  ['N8-doctor/C10/arguments', 'doctor accepts only documented lane options'],
  ['N8-doctor/C10/entrypoints', 'doctor resolves native and Windows npm entrypoints'],
  ['N8-doctor/C10/context', 'doctor preserves the effective lane context'],
  ['N8-doctor/C10/configuration', 'doctor reports exact MCP readiness outcomes'],
  ['N8-doctor/C10/logs', 'doctor reports the newest permitted sandbox log'],
  ['N8-doctor/C10/processes', 'doctor reports Desktop and cua_node processes'],
  ['N8-doctor/C10/negative-actions', 'doctor performs no model probe or remediation action'],
  ['N8-doctor/C10/cli', 'doctor CLI streams and exits are exact'],
  ['R46/C10/anchors', 'validation warns only on unanchored user denies'],
  ['R49/C10/policy', 'validation compares managed policy with installed state'],
  ['R53/C10/reporting', 'validation preserves allow classifier rows and severity'],
  ['R73/C10/selftest', 'validation requires exact installed hook evidence'],
  ['R79/C10/schemas', 'validation uses shared schemas before consuming ownership'],
  ['R79/C10/runtime-unit', 'validation checks every catalog runtime target'],
  ['R81/C10/baseline', 'older installed policy is behind rather than edited'],
  ['R82/C10/snippet', 'validation reports stale snippet state without user config access'],
  ['V2/C10/schema2', 'schema 2 reports needs update without a schema failure'],
  ['V2/C10/discovery', 'discovery recognizes only the root environment template'],
  ['V2/C10/run-inventory', 'discovery excludes reserved review-artifact directories'],
  ['V2/C10/contracts', 'C10 exports documentation and evidence boundaries are exact'],
];
const EXPECTED_DESCRIPTORS = COMPONENT_INVENTORY.map(([id, name]) => ({ id, name }));

const FIXTURE_REL = 'tests/fixtures/doctor-cases.json';
const DOCTOR_EXPORTS = ['main', 'parseDoctorArgs'];
const VALIDATE_EXPORTS = ['main'];
const RUNTIME_MEMBERS = ['security-policy.mjs', 'git-safe-core.mjs', 'guard-raw-git-core.mjs', 'review-diff.mjs', 'git-safe.mjs', 'guard-raw-git.mjs', 'hooks-selftest.mjs'];
const RUNTIME_TARGETS = RUNTIME_MEMBERS.map((m) => `.ai/tools/${m}`);
const HOOK_MEMBERS = ['guard-raw-git-core.mjs', 'guard-raw-git.mjs', 'hooks-selftest.mjs'];
const RUNTIME_CATALOG_SHA = 'a1867f13ce2760cb1a676a48cdaac5a9fe4a868220dbaf7f528b169b64678ef6';

// Plan 3.2: the parser error messages (the code prefixes the message).
const ARG_MESSAGES = {
  DOCTOR_ARGV: 'DOCTOR_ARGV: arguments must be strings',
  DOCTOR_CONTROL: 'DOCTOR_CONTROL: control characters are not allowed',
  DOCTOR_VALUE: 'DOCTOR_VALUE: option requires a value',
  DOCTOR_DUPLICATE: 'DOCTOR_DUPLICATE: option may be supplied only once',
  DOCTOR_DISABLE: 'DOCTOR_DISABLE: only apps and plugins may be disabled',
  DOCTOR_OVERRIDE: 'DOCTOR_OVERRIDE: only a named MCP disable override is allowed',
  DOCTOR_PROFILE: 'DOCTOR_PROFILE: invalid profile identifier',
  DOCTOR_DIRECTORY: 'DOCTOR_DIRECTORY: invalid directory value',
  DOCTOR_OPTION: 'DOCTOR_OPTION: unsupported argument',
};
const OPTIONS_MESSAGE = 'DOCTOR_OPTIONS: invalid doctor dependencies';
const VALIDATE_OPTIONS_MESSAGE = 'VALIDATE_OPTIONS: invalid validation dependencies';
const OPTION_KEYS = ['disableApps', 'disablePlugins', 'servers', 'profile', 'directory', 'argv'];

// Plan 3.8: the exact check details and statuses.
const CHECK_DETAIL = {
  context: { pass: 'Effective lane options established', DOCTOR_CONFIGURATION: 'Effective lane directory and both apps/plugins disable flags are required' },
  entrypoint: { pass: 'Supported Codex entrypoint established', DOCTOR_ENTRYPOINT: 'Supported Codex entrypoint could not be established', 'not-run': 'Entrypoint check not run' },
  mcp: {
    pass: 'Every listed MCP server is disabled and covered', DOCTOR_CLI: 'Codex MCP configuration check failed', DOCTOR_OUTPUT: 'Codex MCP configuration output is invalid',
    DOCTOR_ENABLED: 'At least one listed MCP server is enabled', DOCTOR_CONFIGURATION: 'Disable coverage for every listed MCP server could not be established', 'not-run': 'MCP configuration check not run',
  },
  'sandbox-log': {
    pass: 'Newest sandbox log has no setup-refresh error', DOCTOR_LOG_ABSENT: 'No sandbox log is available', DOCTOR_LOG_UNREADABLE: 'Newest sandbox log could not be read',
    DOCTOR_LOG_ERROR: 'Newest sandbox log contains a setup-refresh error',
  },
  processes: {
    pass: 'No matching Codex Desktop or cua_node process observed', DOCTOR_PROCESS_RUNNING: 'Codex Desktop or cua_node processes are running; quit Codex Desktop and retry',
    DOCTOR_PROCESS_UNAVAILABLE: 'Windows process inventory could not be established', 'not-applicable': 'Windows process inventory is not applicable',
  },
};
const CHECK_STATUS = { pass: 'pass', 'not-run': 'not-run', 'not-applicable': 'not-applicable', DOCTOR_LOG_ABSENT: 'unknown', DOCTOR_LOG_UNREADABLE: 'unknown', DOCTOR_PROCESS_UNAVAILABLE: 'unknown' };
const CHECK_ORDER = ['context', 'entrypoint', 'mcp', 'sandbox-log', 'processes'];
// Plan 3.7: the exact inventory command (fixed text) and Plan 3.4: the exact options.
const INVENTORY_ARGV = [
  '-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
  '[Console]::OutputEncoding=[Text.Encoding]::UTF8;' + 'ConvertTo-Json -InputObject @(Get-CimInstance Win32_Process | ' + 'Select-Object ProcessId,Name,ExecutablePath) -Compress',
];
const MCP_OPTIONS = (cwd, env) => ({ cwd, env, shell: false, windowsHide: true, encoding: 'utf8', timeout: 10000, maxBuffer: 1048576 });
const INVENTORY_OPTIONS = (cwd, env) => ({ cwd, env, shell: false, windowsHide: true, encoding: 'utf8', timeout: 15000, maxBuffer: 1048576 });
const WIN_POWERSHELL = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';

// Plan 4: the validator literals.
const LOCAL = '.claude/settings.local.json is personal and is not managed by project-setup; permissions there do not protect the team.';
const REPO_ALLOW = (rule, owner) => `Shared ${owner} allow ${JSON.stringify(rule)} runs repository code without a prompt; move it to .claude/settings.local.json if you accept this risk on your own machine.`;
const BROAD_ALLOW = (rule, owner) => `Shared ${owner} allow ${JSON.stringify(rule)} permits arbitrary commands without a prompt; move it to .claude/settings.local.json if you accept this risk on your own machine.`;
const ANCHOR_WARN = (rule) => `User deny ${JSON.stringify(rule)} is relative to the session's working directory, so it may not protect what it names`;
const USAGE_BODY = { ok: false, code: 'VALIDATE_USAGE', error: 'usage: validate.mjs [--json]' };
const SELFTEST_OK = 'PASS  guard-raw-git/allowed\nPASS  guard-raw-git/blocked\nPASS  guard-raw-git/malformed\n3 PASS / 0 FAIL\n';
const HOOK_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs"';
const HOOK_IDENTITY = { event: 'PreToolUse', matcher: 'Bash|PowerShell', command: HOOK_COMMAND };
const HOOK_SETTINGS_BLOCK = { PreToolUse: [{ matcher: 'Bash|PowerShell', hooks: [{ type: 'command', command: HOOK_COMMAND }] }] };
const ROW = {
  hookPass: { level: 'pass', check: 'hooks-selftest', detail: 'Installed hook self-test passed; Claude hook loading is not verified' },
  hookUnavailable: { level: 'fail', check: 'hooks-selftest', detail: 'Installed hook self-test is unavailable' },
  hookUnsafe: { level: 'fail', check: 'hooks-selftest', detail: 'Installed hook self-test was not run because a runtime path is unsafe or protected' },
  hookFailed: { level: 'fail', check: 'hooks-selftest', detail: 'Installed hook self-test failed' },
  hookSchema2: { level: 'info', check: 'hooks-selftest', detail: 'Schema 2 needs update; installed hook self-test was not run' },
  hookInvalidInput: { level: 'info', check: 'hooks-selftest', detail: 'Invalid setup inputs prevented installed hook self-test' },
  hookNone: { level: 'info', check: 'hooks-selftest', detail: 'No installed raw-Git hook was identified; installed hook self-test was not run' },
  managedPass: { level: 'pass', check: 'policy-managed', detail: '.ai/security-paths.json: managed patterns match installed baseline' },
  managedFail: { level: 'fail', check: 'policy-managed', detail: '.ai/security-paths.json: managed patterns edited since install' },
  baselineUnknown: { level: 'info', check: 'policy-baseline', detail: '.ai/security-paths.json: installed baseline unknown' },
  behind: { level: 'info', check: 'policy-version', detail: '.ai/security-paths.json: installed managed patterns are behind this skill' },
  snippetMissing: { level: 'info', check: 'codex-snippet', detail: 'Codex deny-read snippet has not been recorded' },
  snippetStale: { level: 'info', check: 'codex-snippet', detail: 'Codex deny-read snippet is stale; render and review it again' },
  policyPass: { level: 'pass', check: 'policy-schema', detail: '.ai/security-paths.json' },
  settingsPass: { level: 'pass', check: 'json-schema', detail: '.claude/settings.json' },
  manifestPass: { level: 'pass', check: 'json-schema', detail: '.ai/manifest.json' },
  manifestV2: { level: 'info', check: 'manifest-version', detail: '.ai/manifest.json: schema 2 needs update to schema 3' },
  allowLocal: { level: 'info', check: 'allow-local', detail: LOCAL },
  catalogBad: { level: 'fail', check: 'runtime-catalog', detail: 'Runtime catalog is unavailable or invalid' },
  gitSafeMissing: { level: 'fail', check: 'security-tooling', detail: '.ai/tools/git-safe.mjs missing; shared agents depend on it' },
  policyMissing: { level: 'fail', check: 'security-tooling', detail: '.ai/security-paths.json missing; shared agents depend on it' },
};
const UNIT_PASS = (t) => ({ level: 'pass', check: 'runtime-unit', detail: `${t}: runtime member is present and readable` });
const UNIT_MISSING_RECORDED = (t) => ({ level: 'fail', check: 'runtime-unit', detail: `${t}: runtime member is missing; manifest records it as installed` });
const UNIT_MISSING_SCHEMA2 = (t) => ({ level: 'fail', check: 'runtime-unit', detail: `${t}: runtime member is missing; installed policy schema 2 requires it` });
const UNIT_INFO = (t) => ({ level: 'info', check: 'runtime-unit', detail: `${t}: runtime unit incomplete; needs update` });
const UNIT_UNSAFE = (t) => ({ level: 'fail', check: 'runtime-unit', detail: `${t}: runtime member is unsafe` });
const UNIT_PROTECTED = (t) => ({ level: 'fail', check: 'runtime-unit', detail: `${t}: runtime member is protected; not read` });
const UNIT_UNREADABLE = (t) => ({ level: 'fail', check: 'runtime-unit', detail: `${t}: runtime member could not be read` });
const DRIFT_MISSING = (t) => ({ level: 'warn', check: 'drift', detail: `${t}: in manifest but missing on disk` });
const VALIDATION = {
  path: (rel) => ({ level: 'fail', check: 'validation-path', detail: `${rel}: unsafe validation input` }),
  protectedRow: (rel) => ({ level: 'fail', check: 'validation-protected', detail: `${rel}: protected validation input was not read` }),
  io: (rel) => ({ level: 'fail', check: 'validation-io', detail: `${rel}: validation input could not be read` }),
};
const ALLOW_INPUT = {
  manifest: 'invalid .ai/manifest.json; allow ownership was not classified',
  invalid: 'invalid .claude/settings.json; shared allows were not classified',
  unsafe: 'unsafe .claude/settings.json; shared allows were not classified',
  protected: '.claude/settings.json is protected; shared allows were not classified',
  io: 'cannot read .claude/settings.json; shared allows were not classified',
};
const allowInput = (detail) => ({ level: 'fail', check: 'allow-input', detail });
const POLICY_IO = { level: 'fail', check: 'policy-schema', detail: '.ai/security-paths.json: POLICY_IO: cannot read security policy: .ai/security-paths.json' };
const POLICY_JSON = { level: 'fail', check: 'policy-schema', detail: '.ai/security-paths.json: POLICY_JSON: policy text must be valid JSON' };
const POLICY_SCHEMA99 = { level: 'fail', check: 'policy-schema', detail: '.ai/security-paths.json: POLICY_SCHEMA: policy.schema must be 1 or 2' };
// The two replacement discovery warnings of plan 5.1 (concatenated literals, never copied from production).
const WARN_TRACKED = 'secret-pattern files other than the root .env.example are TRACKED in git; ' + 'stop and escalate before generating docs';
const WARN_TEMPLATE = 'root environment template is present; inspect it only via ' + 'node <SKILL_DIR>/scripts/env-keys.mjs keys --template auto; ' + 'agents must not open it directly';
const OLD_WARN_TRACKED = 'secret-pattern files (not env templates) are TRACKED in git; stop and escalate before generating docs';
const OLD_WARN_TEMPLATE = 'env templates present; inspect them only via env-keys.mjs (names + value classification, never values)';
const RESERVED_LISTING = ['run-0001', 'review', 'REVIEW', 'Review', 'review.', 'review ', 'review. .', 'review...', 'review-1', 'abc'];
const RESERVED_EXPECTED = ['run-0001', 'review-1', 'abc'];

// ============================================================ fixtures ====
// The doctor corpus (plan 6.2): literal cases; expected diagnostics are never produced by production code.
function loadCorpus(failures, context) {
  const text = readText(skillPath(context, FIXTURE_REL));
  if (text === null) { failures.push(`${FIXTURE_REL} is readable`); return null; }
  let corpus;
  try { corpus = JSON.parse(text); } catch (e) { failures.push(`${FIXTURE_REL} is valid JSON: ${errMsg(e)}`); return null; }
  const keys = ['schema', 'argumentCases', 'configurationCases', 'logCases', 'processCases'];
  if (!eq(Object.keys(corpus), keys) || corpus.schema !== 1 || keys.slice(1).some((k) => !Array.isArray(corpus[k]))) { failures.push(`${FIXTURE_REL} has exactly the keys ${keys.join(', ')} with schema 1 and four case lists`); return null; }
  for (const k of keys.slice(1)) {
    const ids = corpus[k].map((c) => c && c.id);
    if (ids.some((id) => typeof id !== 'string' || id === '') || new Set(ids).size !== ids.length) { failures.push(`${FIXTURE_REL} ${k}: every case has a unique nonempty id`); return null; }
  }
  return corpus;
}
// A production module is imported into this process only after a child process has proven that importing it is safe: the committed validate.mjs runs its whole command line at import time (it prints, sets the exit code and
// scans the repository), and an unsafe import would corrupt the process that runs the tests. The probe result is cached per skill root and module, so it costs one process per module however many assertions need it.
const GATE = new Map();
function importGate(context, name) {
  const key = `${context.skillRoot}|${name}`;
  if (!GATE.has(key)) {
    const dir = scratchDir(context, 'gate');
    try { GATE.set(key, probeImport(context, dir, scriptUrl(context, name))); } finally { rmrf(dir); }
  }
  return GATE.get(key);
}
async function needScript(failures, context, name, exportsNeeded) {
  const gate = importGate(context, name);
  if (gate === null) { failures.push(`scripts/${name}: the import probe could not run`); return null; }
  const unsafe = gate.stdout.length || gate.stderr.length || gate.exits.length || gate.exitCode !== null || gate.spawns.length || gate.writes.length;
  if (unsafe) { failures.push(`scripts/${name} is not import-safe (plan 2.4), so it was not imported into the test process: ${show({ out: gate.stdout.join('').slice(0, 80), exits: gate.exits, exitCode: gate.exitCode, spawns: gate.spawns.length, writes: gate.writes.length }, 300)}`); return null; }
  if (gate.err !== null) { failures.push(`cannot import scripts/${name}: ${String(gate.err).slice(0, 300)}`); return null; }
  const m = await importOrFail(failures, scriptUrl(context, name), `scripts/${name}`);
  if (m && exportsNeeded.some((k) => typeof m[k] !== 'function')) { failures.push(`scripts/${name} exports ${exportsNeeded.join(' and ')}`); return null; }
  return m;
}
const needDoctor = (failures, context) => needScript(failures, context, 'doctor.mjs', ['main', 'parseDoctorArgs']);
const needValidate = (failures, context) => needScript(failures, context, 'validate.mjs', ['main']);

// ================================================== in-memory doctor world ====
// A virtual filesystem implementing exactly the four seam functions of plan 3.3 (native-realpath semantics for realpathSync), an executor that records every call, and the worlds the corpus names.
// Links resolve like links: lstat does not follow the final component, every other operation does. Path rules follow the synthetic platform, so POSIX cases run on a Windows host.
// This function is also embedded verbatim in the child batch of the negative-action assertion; it therefore uses only its own scope and `path`.
function makeVfs(platform, entries, rules) {
  const P = platform === 'win32' ? path.win32 : path.posix;
  const win = platform === 'win32';
  const fold = (s) => (win ? s.toLowerCase() : s);
  const roots = new Map();
  const log = [];
  const codeErr = (code, p) => Object.assign(new Error(`${code}: fixture filesystem, ${String(p)}`), { code, path: String(p) });
  const rootOf = (abs) => {
    const r = P.parse(abs).root;
    if (!roots.has(fold(r))) roots.set(fold(r), { canon: r, name: r, type: 'dir', children: new Map() });
    return roots.get(fold(r));
  };
  const split = (abs) => { const norm = P.resolve(abs); const r = P.parse(norm).root; return norm.slice(r.length).split(P.sep).filter((x) => x !== ''); };
  const mtimeOf = (v) => (v === 'NaN' ? NaN : v === 'Infinity' ? Infinity : v === undefined ? 1760000000000 : v);
  const attrsOf = (e) => {
    const content = e.pad !== undefined ? Buffer.from('x'.repeat(e.pad)) : Buffer.from(e.text === undefined ? '' : e.text, 'utf8');
    return { target: e.target, mode: e.mode, size: e.size === undefined ? content.length : e.size, mtimeMs: mtimeOf(e.mtimeMs), content };
  };
  const add = (e) => {
    const comps = split(e.path);
    let cur = rootOf(e.path);
    comps.forEach((name, i) => {
      const last = i === comps.length - 1;
      const prev = cur.children.get(fold(name));
      if (prev && !last) { cur = prev; return; }
      const keepName = prev ? prev.name : name;
      const node = { canon: P.join(cur.canon, keepName), name: keepName, type: last ? e.type : 'dir', children: prev && prev.type === 'dir' && (!last || e.type === 'dir') ? prev.children : new Map() };
      if (last) Object.assign(node, attrsOf(e));
      cur.children.set(fold(name), node);
      cur = node;
    });
  };
  const drop = (p) => {
    const comps = split(p);
    let cur = rootOf(p);
    for (let i = 0; i < comps.length; i++) {
      const child = cur.children.get(fold(comps[i]));
      if (!child) return;
      if (i === comps.length - 1) cur.children.delete(fold(comps[i])); else cur = child;
    }
  };
  function walk(p, followFinal, depth = 0) {
    if (depth > 16) throw codeErr('ELOOP', p);
    if (typeof p !== 'string' || !P.isAbsolute(p)) throw codeErr('EINVAL', p);
    const comps = split(p);
    let node = rootOf(p);
    for (let i = 0; i < comps.length; i++) {
      if (node.type !== 'dir') throw codeErr('ENOTDIR', p);
      let child = node.children.get(fold(comps[i]));
      if (!child) throw codeErr('ENOENT', p);
      if (child.type === 'link' && (i < comps.length - 1 || followFinal)) child = walk(P.resolve(P.dirname(child.canon), child.target), true, depth + 1);
      node = child;
    }
    return node;
  }
  const statsOf = (n) => ({
    isFile: () => n.type === 'file', isDirectory: () => n.type === 'dir', isSymbolicLink: () => n.type === 'link',
    mode: (n.type === 'file' ? 0o100000 : n.type === 'dir' ? 0o040000 : 0o120000) | (n.mode === undefined ? (n.type === 'file' ? 0o644 : 0o755) : n.mode),
    size: n.type === 'file' ? n.size : 0, mtimeMs: n.mtimeMs === undefined ? 1760000000000 : n.mtimeMs, mtime: new Date(n.mtimeMs === undefined ? 1760000000000 : n.mtimeMs),
  });
  const hit = (op, p) => {
    log.push({ op, path: String(p) });
    for (const r of rules || []) {
      if (r.op !== op) continue;
      let same = false;
      try { same = fold(P.resolve(String(p))) === fold(P.resolve(r.path)); } catch { same = false; }
      if (same) throw Object.assign(new Error(`${r.code}: injected ${op} failure`), { code: r.code, syscall: op, path: String(p) });
    }
  };
  const api = {
    lstatSync(p) { hit('lstatSync', p); return statsOf(walk(p, false)); },
    realpathSync(p) { hit('realpathSync', p); return walk(p, true).canon; },
    readdirSync(p, o) {
      hit('readdirSync', p);
      const n = walk(p, true);
      if (n.type !== 'dir') throw codeErr('ENOTDIR', p);
      const kids = [...n.children.values()];
      if (o && typeof o === 'object' && o.withFileTypes) return kids.map((c) => ({ name: c.name, parentPath: n.canon, path: n.canon, isFile: () => c.type === 'file', isDirectory: () => c.type === 'dir', isSymbolicLink: () => c.type === 'link' }));
      return kids.map((c) => c.name);
    },
    readFileSync(p, o) {
      hit('readFileSync', p);
      const n = walk(p, true);
      if (n.type === 'dir') throw codeErr('EISDIR', p);
      const enc = typeof o === 'string' ? o : o && typeof o === 'object' ? o.encoding : undefined;
      return enc ? n.content.toString(enc === 'utf-8' ? 'utf8' : enc) : Buffer.from(n.content);
    },
  };
  for (const e of entries) add(e);
  return { fs: api, log, add, drop, platform };
}

const M_NEW_ISO = '2025-10-09T08:55:20.000Z';
const M_NEW = 1760000120000;
const CLEAN_LOG_TEXT = 'setup refresh started\nsetup refresh finished\n';
const NPM_DIR = 'C:\\Users\\Fixture\\AppData\\Roaming\\npm';
const POSIX_LOG = '/home/fixture/.codex/.sandbox/sandbox.20261020.log';
const WIN_LOG = 'C:\\Users\\Fixture\\.codex\\.sandbox\\sandbox.20261020.log';
const WORLD_DEFS = {
  posix: () => ({
    platform: 'linux', cwd: '/work/repo', home: '/home/fixture', node: '/usr/local/bin/node',
    env: { PATH: '/opt/bin:/usr/local/bin:/usr/bin', HOME: '/home/fixture', ENV_SENTINEL_VALUE: 'C10_ENV_MARKER_POSIX' },
    vfs: [
      { path: '/work/repo', type: 'dir' }, { path: '/opt/bin', type: 'dir' }, { path: '/usr/bin', type: 'dir' },
      { path: '/usr/local/bin/codex', type: 'file', mode: 0o755 }, { path: '/usr/local/bin/node', type: 'file', mode: 0o755 },
      { path: POSIX_LOG, type: 'file', mtimeMs: M_NEW, text: CLEAN_LOG_TEXT },
    ],
  }),
  win: () => ({
    platform: 'win32', cwd: 'D:\\Work\\Repo', home: 'C:\\Users\\Fixture', node: 'C:\\Program Files\\nodejs\\node.exe',
    env: { Path: 'C:\\Tools\\bin;C:\\Windows\\System32', SystemRoot: 'C:\\Windows', ENV_SENTINEL_VALUE: 'C10_ENV_MARKER_WIN' },
    vfs: [
      { path: 'D:\\Work\\Repo', type: 'dir' }, { path: 'D:\\Work\\Other', type: 'dir' }, { path: 'C:\\Tools\\bin', type: 'dir' }, { path: 'C:\\Windows\\System32', type: 'dir' },
      { path: 'C:\\Tools\\bin\\codex.exe', type: 'file' }, { path: WIN_POWERSHELL, type: 'file' }, { path: 'C:\\Program Files\\nodejs\\node.exe', type: 'file' },
      { path: WIN_LOG, type: 'file', mtimeMs: M_NEW, text: CLEAN_LOG_TEXT },
    ],
  }),
  winnpm: () => {
    const w = WORLD_DEFS.win();
    w.env = { Path: `${NPM_DIR};C:\\Windows\\System32`, SystemRoot: 'C:\\Windows', ENV_SENTINEL_VALUE: 'C10_ENV_MARKER_WIN' };
    w.vfs = w.vfs.filter((e) => e.path !== 'C:\\Tools\\bin\\codex.exe');
    w.vfs.push({ path: `${NPM_DIR}\\codex.cmd`, type: 'file' }, { path: `${NPM_DIR}\\node_modules\\@openai\\codex\\bin\\codex.js`, type: 'file' });
    return w;
  },
};
// A world for one corpus case: the named base world, the case's own env/cwd, then drops and additions (an addition replaces the same path).
function buildWorld(c) {
  const base = WORLD_DEFS[c.world]();
  const env = c.env !== undefined ? clone(c.env) : base.env;
  if (c.env !== undefined) env.ENV_SENTINEL_VALUE = 'C10_ENV_MARKER_CASE';
  const w = { platform: base.platform, cwd: c.cwd || base.cwd, home: base.home, node: base.node, env: Object.freeze(env) };
  w.vfs = makeVfs(base.platform, base.vfs, c.fail || []);
  for (const p of c.drop || []) w.vfs.drop(p);
  for (const e of c.add || []) w.vfs.add(e);
  w.context = Object.freeze({ platform: w.platform, cwd: w.cwd, home: w.home, env: w.env, node: w.node });
  return w;
}
// The recording executor of plan 3.3: every call is kept; the result comes from the case's literal spec. A call that is neither the MCP command nor the inventory is answered with a failure and counted as foreign.
function specValue(spec) {
  if (spec && 'throw' in spec) return { kind: 'throw', marker: spec.throw };
  if (spec && 'reject' in spec) return { kind: 'reject', marker: spec.reject };
  if (spec && 'literal' in spec) return { kind: 'value', value: spec.literal === null ? null : clone(spec.literal) };
  return { kind: 'value', value: { status: 0, signal: null, stdout: spec.stdout, stderr: spec.stderr === undefined ? '' : spec.stderr } };
}
const isMcpArgv = (argv) => Array.isArray(argv) && argv.length >= 3 && argv.slice(-3).join('\u0000') === ['mcp', 'list', '--json'].join('\u0000');
function makeExecutor(c, flavor) {
  const calls = [];
  const mcp = specValue(c.mcp === undefined ? { stdout: '[]' } : c.mcp);
  const inventory = specValue(c.inventory === undefined ? { stdout: '[]' } : c.inventory);
  const impl = (executable, argv, options) => {
    calls.push({ executable, argv: Array.isArray(argv) ? [...argv] : argv, options });
    const r = isMcpArgv(argv) ? mcp : (typeof executable === 'string' && /powershell\.exe$/i.test(executable) ? inventory : { kind: 'value', value: { status: 1, signal: null, stdout: '', stderr: '' } });
    if (r.kind === 'throw') throw new Error(r.marker);
    if (r.kind === 'reject') return Promise.reject(new Error(r.marker));
    return r.value === null ? null : clone(r.value);
  };
  const execute = flavor === 'async' ? async (...a) => impl(...a) : impl;
  return { execute, calls };
}
// Streams, exit codes and process.exit during one in-process call (plan 3.1: main itself writes nothing and sets nothing).
async function withStreamCapture(fn) {
  const ow = process.stdout.write;
  const ew = process.stderr.write;
  const oe = process.exit;
  const before = process.exitCode;
  const out = [];
  const err = [];
  const exits = [];
  process.stdout.write = function (x) { out.push(String(x)); return true; };
  process.stderr.write = function (x) { err.push(String(x)); return true; };
  process.exit = function (x) { exits.push(x === undefined ? null : x); throw new Error('C10_EXIT'); };
  try {
    const r = await attempt(fn);
    const exitCode = process.exitCode === before || process.exitCode === undefined ? null : process.exitCode;
    return { ...r, out, err, exits, exitCode };
  } finally {
    process.stdout.write = ow; process.stderr.write = ew; process.exit = oe; process.exitCode = before;
  }
}

// Builds the plan-3.8 report for a corpus case from the compact expectation (the details come from the literal tables above).
function expectedDoctorReport(c) {
  const e = c.expect;
  const tok = { context: e.outcome.context, entrypoint: e.outcome.entrypoint, mcp: e.outcome.mcp, 'sandbox-log': e.outcome.log, processes: e.outcome.processes };
  const checks = CHECK_ORDER.map((name) => {
    const t = tok[name];
    const quiet = t === 'pass' || t === 'not-run' || t === 'not-applicable';
    return { check: name, status: CHECK_STATUS[t] || 'fail', code: quiet ? null : t, detail: CHECK_DETAIL[name][t] };
  });
  const ready = checks.every((k) => k.status === 'pass' || k.status === 'not-applicable');
  return {
    ok: ready, ready, scope: 'configuration-and-diagnostics', context: { directory: e.directory, profile: e.profile }, checks,
    servers: e.servers, sandboxLog: e.sandboxLog, processes: e.processes, runtimeEvidence: { connectorTools: 'not-verified', sandbox: 'not-verified' },
  };
}
// Log and process cases name only the check they vary; the rest of the report is the base world's passing reference.
function logOrProcessCase(c, kind) {
  const worldDir = c.world === 'posix' ? '/work/repo' : 'D:\\Work\\Repo';
  const args = ['--disable', 'apps', '--disable', 'plugins'];
  const exe = c.world === 'posix' ? '/usr/local/bin/codex' : c.world === 'winnpm' ? 'C:\\Program Files\\nodejs\\node.exe' : 'C:\\Tools\\bin\\codex.exe';
  const defaultLog = { file: 'sandbox.20261020.log', mtime: M_NEW_ISO, firstError: null };
  const e = c.expect;
  const outcome = { context: 'pass', entrypoint: 'pass', mcp: 'pass', log: kind === 'log' ? e.outcome : 'pass', processes: kind === 'process' ? e.outcome : (c.world === 'posix' ? 'not-applicable' : 'pass') };
  return {
    ...c, argv: args, mcp: { stdout: '[]' },
    expect: {
      directory: worldDir, profile: null, outcome, servers: [], sandboxLog: kind === 'log' ? e.sandboxLog : defaultLog, processes: kind === 'process' ? e.processes : [],
      codex: { executable: exe, argv: [...(c.world === 'winnpm' ? [`${NPM_DIR}\\node_modules\\@openai\\codex\\bin\\codex.js`] : []), ...args, 'mcp', 'list', '--json'] },
      inventory: kind === 'process' ? e.inventory : c.world !== 'posix', reads: e.reads, noReadOf: e.noReadOf,
    },
  };
}
const LEAK_MARKERS = ['fixture marker', 'fixture diagnostic', 'C10_ENV_MARKER', 'CRED_MARKER_', 'CMDLINE_MARKER', 'AUTH_MARKER', 'SECRET_MARKER', 'OLD_BODY_MARKER', 'DEFAULT_HOME_MARKER', 'SECOND_MARKER', 'LOSER', 'WRONG'];
const lowerPath = (p) => String(p).toLowerCase();

// One corpus case through main, in one executor flavor: the complete result, the complete executions and the complete filesystem reads.
async function runDoctorCase(check, doctor, c, flavor, kind) {
  const spec = kind === 'config' ? c : logOrProcessCase(c, kind);
  const label = `${kind} case ${c.id} (${flavor})`;
  const w = buildWorld(spec);
  const ex = makeExecutor(spec, flavor);
  const argvIn = deepFreeze(clone(spec.argv));
  const envBefore = clone(w.env);
  const cap = await withStreamCapture(() => doctor.main(argvIn, { context: w.context, fs: w.vfs.fs, execute: ex.execute }));
  if (cap.threw) { check(false, `${label}: main resolves`, errMsg(cap.error)); return null; }
  const r = cap.value;
  const want = expectedDoctorReport(spec);
  const wantExit = want.ready ? 0 : 1;
  check(r !== null && typeof r === 'object' && eq(Object.keys(r), ['exitCode', 'stdout', 'stderr']), `${label}: the result has exactly exitCode, stdout and stderr`, r && Object.keys(r));
  if (r === null || typeof r !== 'object') return null;
  check(r.exitCode === wantExit, `${label}: exit ${wantExit}`, r.exitCode);
  check(r.stderr === '', `${label}: stderr is empty`, clip(r.stderr));
  check(r.stdout === J(want), `${label}: the complete report is exact`, (() => {
    try {
      const got = JSON.parse(r.stdout);
      const brief = Array.isArray(got.checks) ? got.checks.map((k) => `${k.check}:${k.status}:${k.code}`).join(' ') : '';
      return `${firstDiff(got, want)} | checks ${brief}`;
    } catch { return clip(r.stdout); }
  })());
  check(cap.out.length === 0 && cap.err.length === 0 && cap.exits.length === 0 && cap.exitCode === null, `${label}: main writes no stream, never exits and never sets process.exitCode`, { out: cap.out.length, err: cap.err.length, exits: cap.exits, exitCode: cap.exitCode });
  check(LEAK_MARKERS.every((m) => !String(r.stdout).includes(m) && !String(r.stderr).includes(m)), `${label}: no native error, CLI stream, configuration value, process command line or log body leaks`, LEAK_MARKERS.filter((m) => String(r.stdout).includes(m)));
  check(eq(w.env, envBefore), `${label}: the environment object is unchanged`);
  // executions
  const mcpCalls = ex.calls.filter((x) => isMcpArgv(x.argv));
  const invCalls = ex.calls.filter((x) => !isMcpArgv(x.argv) && typeof x.executable === 'string' && /powershell\.exe$/i.test(x.executable));
  check(mcpCalls.length + invCalls.length === ex.calls.length, `${label}: every execution is the MCP command or the inventory`, ex.calls.map((x) => [x.executable, x.argv]));
  if (spec.expect.codex) {
    const m = mcpCalls[0];
    check(mcpCalls.length === 1, `${label}: exactly one MCP command`, mcpCalls.length);
    if (m) {
      check(m.executable === spec.expect.codex.executable, `${label}: the executable is the native-realpath resolved installation`, m.executable);
      check(eq(m.argv, spec.expect.codex.argv), `${label}: the argv is the normalized options plus mcp list --json (the npm entrypoint first for a shim)`, m.argv);
      check(eq(m.options, MCP_OPTIONS(w.cwd, w.env)), `${label}: the options are exact (original cwd and environment, no shell, 10000 ms, 1 MiB)`, m.options);
    }
  } else check(mcpCalls.length === 0, `${label}: no Codex command is executed`, mcpCalls.map((x) => x.argv));
  if (spec.expect.inventory) {
    check(invCalls.length === 1, `${label}: exactly one inventory command`, invCalls.length);
    if (invCalls[0]) {
      check(invCalls[0].executable === WIN_POWERSHELL, `${label}: the inventory executable is the absolute SystemRoot PowerShell`, invCalls[0].executable);
      check(eq(invCalls[0].argv, INVENTORY_ARGV), `${label}: the inventory argv is the fixed UTF-8 command`, invCalls[0].argv);
      check(eq(invCalls[0].options, INVENTORY_OPTIONS(w.cwd, w.env)), `${label}: the inventory options are exact (15000 ms)`, invCalls[0].options);
    }
  } else check(invCalls.length === 0, `${label}: no inventory command is executed`, invCalls.length);
  // filesystem
  const ops = w.vfs.log;
  const reads = ops.filter((x) => x.op === 'readFileSync').map((x) => x.path);
  check(reads.every((p) => /[\\/]\.sandbox[\\/]sandbox\.[^\\/]+\.log$/i.test(p)), `${label}: the only file body read is a sandbox log (never a shim, an entrypoint or an executable)`, reads);
  check(!ops.some((x) => /auth\.json$/i.test(x.path) || /\.sandbox-secrets/i.test(x.path)), `${label}: authentication and sandbox-secret paths are never touched`, ops.filter((x) => /auth\.json$|\.sandbox-secrets/i.test(x.path)));
  if (Array.isArray(spec.expect.reads)) check(eq(reads.map(lowerPath).sort(), spec.expect.reads.map(lowerPath).sort()), `${label}: exactly the selected log is read`, reads);
  for (const p of spec.expect.noReadOf || []) check(!reads.map(lowerPath).includes(lowerPath(p)) && !ops.some((x) => x.op === 'readFileSync' && lowerPath(x.path) === lowerPath(p)), `${label}: ${p} is never read`);
  return { result: r, calls: ex.calls, ops };
}

// ============================================== N8-doctor/C10/arguments ====
// Plan 3.2: the exact grammar, parser output, error codes and messages, precedence; the corpus cases plus JavaScript-only argument shapes; and the proof that a failed parse returns exit 2 before anything else happens.
async function argumentsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const doctor = await needDoctor(failures, context);
    const corpus = loadCorpus(failures, context);
    if (!doctor || !corpus) return;
    await step('every corpus argument case: accepted vectors parse to the exact options (key order, canonical aliases, order kept); every rejection carries its own code and exact message; the input is never mutated', async () => {
      for (const c of corpus.argumentCases) {
        const label = `argument case ${c.id}`;
        const input = Array.isArray(c.argv) ? deepFreeze(clone(c.argv)) : c.argv;
        const r = await attempt(() => doctor.parseDoctorArgs(input));
        if (c.expect.ok) {
          check(!r.threw, `${label}: accepted`, r.threw ? errMsg(r.error) : undefined);
          if (!r.threw) {
            check(eq(r.value, c.expect.options), `${label}: the parsed options are exact`, firstDiff(r.value, c.expect.options));
            check(eq(Object.keys(r.value), OPTION_KEYS), `${label}: the key order is disableApps, disablePlugins, servers, profile, directory, argv`, Object.keys(r.value));
          }
        } else {
          const e = r.error;
          check(r.threw && e instanceof Error && hasOwn(e, 'code') && e.code === c.expect.code && e.message === ARG_MESSAGES[c.expect.code], `${label}: ${c.expect.code} with the exact message`, r.threw ? { code: e && e.code, message: e && e.message } : { returned: r.value });
        }
        if (Array.isArray(c.argv)) check(JSON.stringify(input) === JSON.stringify(c.argv), `${label}: the input array is unchanged`);
      }
    });
    await step('JavaScript-only argument shapes: a missing argument, undefined, a sparse array, a symbol, a String object, an array-like and a typed array are DOCTOR_ARGV', async () => {
      const shapes = [
        ['no argument', () => doctor.parseDoctorArgs()], ['undefined', () => doctor.parseDoctorArgs(undefined)], ['an undefined element', () => doctor.parseDoctorArgs([undefined])],
        ['a sparse array', () => doctor.parseDoctorArgs(new Array(1))], ['a symbol element', () => doctor.parseDoctorArgs([Symbol('x')])], ['a String object element', () => doctor.parseDoctorArgs([new String('--disable')])],
        ['an array-like object', () => doctor.parseDoctorArgs({ length: 1, 0: 'x' })], ['a typed array', () => doctor.parseDoctorArgs(new Uint8Array(1))], ['a bigint element', () => doctor.parseDoctorArgs([1n])],
      ];
      for (const [label, fn] of shapes) {
        const r = await attempt(fn);
        check(r.threw && r.error instanceof Error && hasOwn(r.error, 'code') && r.error.code === 'DOCTOR_ARGV' && r.error.message === ARG_MESSAGES.DOCTOR_ARGV, `${label}: DOCTOR_ARGV with the exact message`, r.threw ? { code: r.error && r.error.code, message: r.error && r.error.message } : r.value);
      }
    });
    await step('plan 3.1 and 3.3: a syntactically invalid invocation is exit 2 with the exact envelope, empty stderr, and neither the default context, the filesystem nor the executor is used', async () => {
      const w = buildWorld({ world: 'posix' });
      const counts = { fs: 0, exec: 0 };
      const trapFs = {};
      for (const n of ['lstatSync', 'realpathSync', 'readdirSync', 'readFileSync']) trapFs[n] = () => { counts.fs++; throw new Error('trap'); };
      const trapExec = () => { counts.exec++; throw new Error('trap'); };
      const failing = corpus.argumentCases.filter((c) => !c.expect.ok);
      check(failing.length >= 100, 'the corpus has at least one hundred rejection cases', failing.length);
      for (const c of failing) {
        const want = { exitCode: 2, stdout: J({ ok: false, code: c.expect.code, error: ARG_MESSAGES[c.expect.code] }), stderr: '' };
        const input = Array.isArray(c.argv) ? deepFreeze(clone(c.argv)) : c.argv;
        const a = await withStreamCapture(() => doctor.main(input, { context: w.context, fs: trapFs, execute: trapExec }));
        check(!a.threw && eq(a.value, want), `main with seams, ${c.id}: ${c.expect.code} is exit 2 with the exact envelope`, a.threw ? errMsg(a.error) : a.value);
        const b = await withStreamCapture(() => doctor.main(input));
        check(!b.threw && eq(b.value, want), `main without dependencies, ${c.id}: the same envelope (parsing precedes every default)`, b.threw ? errMsg(b.error) : b.value);
        check(a.out.length === 0 && b.out.length === 0 && a.err.length === 0 && b.err.length === 0 && a.exitCode === null && b.exitCode === null, `main ${c.id}: no stream written and no exit code set`);
      }
      check(counts.fs === 0 && counts.exec === 0, 'a failed parse touches neither the filesystem seam nor the executor', counts);
    });
    await step('plan 3.2: an empty argv is syntactically valid but cannot establish lane readiness (exit 1, never exit 2)', async () => {
      const c = corpus.configurationCases.find((x) => x.id === 'posix-context-no-flags');
      check(Boolean(c), 'the corpus has posix-context-no-flags');
      if (c) {
        const out = await runDoctorCase(check, doctor, c, 'sync', 'config');
        check(out !== null && out.result.exitCode === 1, 'empty argv: exit 1, a complete report', out && out.result.exitCode);
      }
    });
  });
}

// ============================================================ corpus groups ====
// Every configuration case belongs to exactly one assertion (entrypoints, context or configuration); the partition is checked so no case is silently unrun.
function configGroupOf(id) {
  if (/^(posix-entrypoint|win-ready|win-env|win-path|win-exe|win-linked|win-native|win-entrypoint|winnpm)-/.test(id)) return 'entrypoints';
  if (/^(posix-context|win-context)-|^posix-ready-(profile|directory|all-options)/.test(id)) return 'context';
  return 'configuration';
}
async function runConfigGroup(check, doctor, corpus, group) {
  const cases = corpus.configurationCases.filter((c) => configGroupOf(c.id) === group);
  check(cases.length >= 10, `the ${group} group has corpus cases`, cases.length);
  for (const c of cases) for (const flavor of ['sync', 'async']) await runDoctorCase(check, doctor, c, flavor, 'config');
}

// ========================================== N8-doctor/C10/entrypoints ====
// Plan 3.4: PATH walk (empty and relative entries ignored, native or Windows npm shim candidates in order), no silent switching, native-realpath resolution through linked parents, the shim body never read, the exact invocation.
async function entrypointsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const doctor = await needDoctor(failures, context);
    const corpus = loadCorpus(failures, context);
    if (!doctor || !corpus) return;
    await step('native Windows, POSIX and npm-shim entrypoints: complete executable, argv and options in both executor flavors; unsupported shims fail without any execution and without switching installations; the shim body is never read', async () => {
      await runConfigGroup(check, doctor, corpus, 'entrypoints');
    });
    await step('the three required install layouts execute exactly: native (executable, options), Windows npm (absolute node, entrypoint first, then the same options array) and the shim body read recorder stays empty', async () => {
      const find = (id) => corpus.configurationCases.find((c) => c.id === id);
      const posix = find('posix-ready-profile-and-relative-directory');
      const npm = find('winnpm-ready-with-all-lane-options');
      check(Boolean(posix) && Boolean(npm), 'the corpus has the posix and npm full-option cases');
      if (!posix || !npm) return;
      const p = await runDoctorCase(check, doctor, posix, 'sync', 'config');
      const n = await runDoctorCase(check, doctor, npm, 'sync', 'config');
      if (p) check(eq(p.calls.map((x) => x.executable), ['/usr/local/bin/codex']), 'POSIX executes the resolved codex file directly, once', p.calls.map((x) => x.executable));
      if (n) {
        const m = n.calls.find((x) => isMcpArgv(x.argv));
        check(Boolean(m) && m.executable === 'C:\\Program Files\\nodejs\\node.exe', 'the npm shim executes the supplied absolute node, never cmd.exe, a shell or the shim', m && m.executable);
        check(Boolean(m) && eq(m.argv, [`${NPM_DIR}\\node_modules\\@openai\\codex\\bin\\codex.js`, '-p', 'review', '-c', 'mcp_servers.node_repl.enabled=false', '--disable', 'apps', '-C', 'D:\\Work Repo', '--disable', 'plugins', 'mcp', 'list', '--json']), 'the npm argv is the entrypoint followed by the normalized options (accepted order, canonical aliases) and mcp list --json', m && m.argv);
        check(n.ops.every((x) => !/codex\.cmd$/i.test(x.path) || x.op !== 'readFileSync'), 'the shim body is never read');
      }
    });
  });
}

// ============================================= N8-doctor/C10/context ====
// Plan 3.3 and 3.4: the dependency seam shapes, the effective directory (resolved against cwd, never rewritten to a realpath), the exact profile, the required disable flags, and the independent diagnostics that still run after a context failure.
async function contextGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const doctor = await needDoctor(failures, context);
    const corpus = loadCorpus(failures, context);
    if (!doctor || !corpus) return;
    await step('effective directory, profile, flags and environment cases (both executor flavors)', async () => {
      await runConfigGroup(check, doctor, corpus, 'context');
    });
    await step('plan 3.3: invalid dependency shapes throw DOCTOR_OPTIONS with the exact message; nothing is executed or read', async () => {
      const w = buildWorld({ world: 'posix' });
      const wn = buildWorld({ world: 'win' });
      const counts = { fs: 0, exec: 0 };
      const trapFs = {};
      for (const n of ['lstatSync', 'realpathSync', 'readdirSync', 'readFileSync']) trapFs[n] = () => { counts.fs++; throw new Error('trap'); };
      const trapExec = () => { counts.exec++; throw new Error('trap'); };
      const ctx = { ...w.context };
      const wctx = { ...wn.context };
      const cases = [
        ['context with an extra key', { context: { ...ctx, extra: 1 } }], ['context without cwd', { context: { platform: ctx.platform, home: ctx.home, env: ctx.env, node: ctx.node } }],
        ['context without platform', { context: { cwd: ctx.cwd, home: ctx.home, env: ctx.env, node: ctx.node } }], ['context without env', { context: { platform: ctx.platform, cwd: ctx.cwd, home: ctx.home, node: ctx.node } }],
        ['context without home', { context: { platform: ctx.platform, cwd: ctx.cwd, env: ctx.env, node: ctx.node } }], ['context without node', { context: { platform: ctx.platform, cwd: ctx.cwd, home: ctx.home, env: ctx.env } }],
        ['relative cwd', { context: { ...ctx, cwd: 'work/repo' } }], ['relative home', { context: { ...ctx, home: 'home/fixture' } }], ['relative node', { context: { ...ctx, node: 'node' } }],
        ['a Windows path under a POSIX platform', { context: { ...ctx, cwd: 'C:\\Work\\Repo' } }], ['a drive-relative cwd under win32', { context: { ...wctx, cwd: 'C:repo' } }],
        ['a relative cwd under win32', { context: { ...wctx, cwd: 'Work\\Repo' } }], ['a relative node under win32', { context: { ...wctx, node: 'node.exe' } }],
        ['a non-string platform', { context: { ...ctx, platform: 5 } }], ['a null context', { context: null }], ['an array context', { context: [] }], ['a string context', { context: 'x' }],
        ['an array environment', { context: { ...ctx, env: [] } }], ['a null environment', { context: { ...ctx, env: null } }], ['a numeric environment value', { context: { ...ctx, env: { PATH: 5 } } }],
        ['an undefined environment value', { context: { ...ctx, env: { PATH: undefined } } }], ['a null environment value', { context: { ...ctx, env: { PATH: null } } }],
        ['a filesystem seam without lstatSync', { context: ctx, fs: { realpathSync: trapFs.realpathSync, readdirSync: trapFs.readdirSync, readFileSync: trapFs.readFileSync } }],
        ['a filesystem seam without realpathSync', { context: ctx, fs: { lstatSync: trapFs.lstatSync, readdirSync: trapFs.readdirSync, readFileSync: trapFs.readFileSync } }],
        ['a filesystem seam without readdirSync', { context: ctx, fs: { lstatSync: trapFs.lstatSync, realpathSync: trapFs.realpathSync, readFileSync: trapFs.readFileSync } }],
        ['a filesystem seam without readFileSync', { context: ctx, fs: { lstatSync: trapFs.lstatSync, realpathSync: trapFs.realpathSync, readdirSync: trapFs.readdirSync } }],
        ['a filesystem seam member that is not a function', { context: ctx, fs: { ...trapFs, readFileSync: 'x' } }], ['a null filesystem seam', { context: ctx, fs: null }], ['a string filesystem seam', { context: ctx, fs: 'x' }],
        ['an executor that is not a function', { context: ctx, fs: trapFs, execute: 'x' }], ['a null executor', { context: ctx, fs: trapFs, execute: null }],
        ['an unknown dependency key', { context: ctx, fs: trapFs, execute: trapExec, shell: true }], ['an unknown dependency key alone', { shell: true }],
      ];
      for (const [label, deps] of cases) {
        const full = deps && typeof deps === 'object' && !Array.isArray(deps) ? { fs: trapFs, execute: trapExec, ...deps } : deps;
        // the case's own keys win; a key set to undefined above stays undefined only inside nested objects, never at the top level
        const r = await withStreamCapture(() => doctor.main(['--disable', 'apps', '--disable', 'plugins'], full));
        const e = r.error;
        check(r.threw && e instanceof Error && hasOwn(e, 'code') && e.code === 'DOCTOR_OPTIONS' && e.message === OPTIONS_MESSAGE, `${label}: DOCTOR_OPTIONS with the exact message`, r.threw ? { code: e && e.code, message: e && e.message } : { returned: r.value });
        check(r.out.length === 0 && r.err.length === 0 && r.exitCode === null, `${label}: no stream, no exit code`);
      }
      check(counts.fs === 0 && counts.exec === 0, 'an invalid dependency shape reads nothing and executes nothing', counts);
    });
    await step('plan 3.3: valid dependency shapes are accepted: frozen objects, an executor returning a promise, a synchronous executor, and a context whose environment is a null-prototype object', async () => {
      const w = buildWorld({ world: 'posix' });
      const ex = makeExecutor({ mcp: { stdout: '[]' } }, 'sync');
      const env = Object.assign(Object.create(null), { PATH: '/usr/local/bin' });
      const r = await attempt(() => doctor.main(['--disable', 'apps', '--disable', 'plugins'], { context: Object.freeze({ ...w.context, env: Object.freeze(env) }), fs: Object.freeze({ ...w.vfs.fs }), execute: ex.execute }));
      check(!r.threw && r.value && r.value.exitCode === 0, 'a frozen valid context, seam and a null-prototype environment run to a ready report', r.threw ? errMsg(r.error) : r.value && r.value.stdout.slice(0, 200));
    });
  });
}

// ========================================== N8-doctor/C10/configuration ====
async function configurationGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const doctor = await needDoctor(failures, context);
    const corpus = loadCorpus(failures, context);
    if (!doctor || !corpus) return;
    await step('plan 3.5 and 3.8: ready, enabled, uncovered, process-failure, invalid-output and credential-like cases: complete reports and exits in both executor flavors', async () => {
      await runConfigGroup(check, doctor, corpus, 'configuration');
    });
  });
}

// ================================================== N8-doctor/C10/logs ====
async function logsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const doctor = await needDoctor(failures, context);
    const corpus = loadCorpus(failures, context);
    if (!doctor || !corpus) return;
    await step('plan 3.6: newest log by mtime (descending ordinal tie break), exact absent/unreadable/error outcomes, exact ISO mtime, bounded first error line, no fallback, no authentication or sandbox-secret access', async () => {
      check(corpus.logCases.length >= 40, 'the corpus has the log cases', corpus.logCases.length);
      for (const c of corpus.logCases) for (const flavor of ['sync', 'async']) await runDoctorCase(check, doctor, c, flavor, 'log');
    });
  });
}

// ============================================== N8-doctor/C10/processes ====
async function processesGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const doctor = await needDoctor(failures, context);
    const corpus = loadCorpus(failures, context);
    if (!doctor || !corpus) return;
    await step('plan 3.7: the exact inventory invocation, the desktop and cua-node classification, null-path handling, sorting, malformed inventories, process failures, SystemRoot lookup and the non-Windows not-applicable result', async () => {
      check(corpus.processCases.length >= 50, 'the corpus has the process cases', corpus.processCases.length);
      for (const c of corpus.processCases) for (const flavor of ['sync', 'async']) await runDoctorCase(check, doctor, c, flavor, 'process');
    });
  });
}

// ====================================== N8-doctor/C10/negative-actions ====
// Plan 6.2: the recorder permits only the exact MCP and inventory operations; no write, deviating subprocess, process termination, authentication read, sandbox-secret read, model command or probe. The in-process part checks every
// call; the child part proves that, with every seam supplied, the doctor never reaches the real filesystem or the real process API (a bypass of the seam would be invisible to the in-memory recorder).
const NEG_CONFIG = ['posix-ready-one-covered-disabled', 'win-ready-native-codex-exe', 'winnpm-ready-standard-shim', 'posix-enabled-server', 'posix-cli-timeout', 'posix-output-banner', 'posix-context-no-flags', 'posix-entrypoint-missing-from-path'];
const NEG_LOG = ['first-of-two-setup-refresh-errors-only', 'auth-and-sandbox-secret-sentinels-are-never-read', 'newest-unreadable-with-readable-older-log-no-fallback'];
const NEG_PROC = ['desktop-package-executable-without-a-visible-window', 'relevant-null-path-codex-name-makes-inventory-unavailable', 'cua-node-runtime-executable'];
const DRIVER_SOURCE = [
  "import fs from 'node:fs';",
  "import path from 'node:path';",
  "import cp from 'node:child_process';",
  "import { syncBuiltinESMExports } from 'node:module';",
  '__MAKE_VFS__',
  'const spec = JSON.parse(fs.readFileSync(process.argv[2], \'utf8\'));',
  'const records = [];',
  'let active = false;',
  "const R = ['readFileSync', 'openSync', 'readdirSync', 'opendirSync', 'statSync', 'lstatSync', 'readlinkSync', 'realpathSync', 'existsSync', 'accessSync', 'createReadStream'];",
  "const W = ['writeFileSync', 'appendFileSync', 'mkdirSync', 'mkdtempSync', 'rmSync', 'rmdirSync', 'unlinkSync', 'renameSync', 'copyFileSync', 'cpSync', 'symlinkSync', 'linkSync', 'truncateSync', 'chmodSync', 'utimesSync', 'createWriteStream'];",
  'const wrap = (obj, name, kind) => { const orig = obj[name]; if (typeof orig !== "function") return; const w = function () { if (active) records.push({ kind, op: name, path: String(arguments[0]) }); return orig.apply(this, arguments); }; for (const k of Object.keys(orig)) w[k] = orig[k]; obj[name] = w; };',
  "for (const n of R) { wrap(fs, n, 'read'); wrap(fs.promises, n, 'read'); }",
  "for (const n of W) { wrap(fs, n, 'write'); wrap(fs.promises, n, 'write'); }",
  "wrap(fs.realpathSync, 'native', 'read');",
  "for (const n of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) { const o = cp[n]; cp[n] = function () { if (active) records.push({ kind: 'spawn', op: n, path: String(arguments[0]) }); return o.apply(this, arguments); }; }",
  'const ok = process.kill; process.kill = function () { if (active) records.push({ kind: "kill", op: "process.kill", path: "" }); return ok.apply(this, arguments); };',
  'syncBuiltinESMExports();',
  'const m = await import(spec.url);',
  'const out = [];',
  'for (const c of spec.cases) {',
  '  const v = makeVfs(c.platform, c.vfs, []);',
  '  const execute = (exe, argv) => ({ status: 0, signal: null, stdout: c.stdout[argv.length > 3 && argv[argv.length - 1] === "--json" ? "mcp" : "inv"], stderr: "" });',
  '  active = true; let r = null; let err = null;',
  '  try { r = await m.main(c.argv, { context: { platform: c.platform, cwd: c.cwd, home: c.home, env: c.env, node: c.node }, fs: v.fs, execute }); } catch (e) { err = String(e && e.message ? e.message : e); }',
  '  active = false;',
  '  out.push({ id: c.id, exitCode: r && r.exitCode, err });',
  '}',
  'active = true; let help = null; try { help = await m.main(["--help"]); } catch (e) { help = { threw: String(e && e.message ? e.message : e) }; } active = false;',
  'process.stdout.write(JSON.stringify({ records, out, help }) + "\\n");',
].join('\n') + '\n';
async function negativeActionsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const doctor = await needDoctor(failures, context);
    const corpus = loadCorpus(failures, context);
    if (!doctor || !corpus) return;
    const mark = processMark(context);
    const pick = (list, ids) => ids.map((id) => ({ id, c: list.find((x) => x.id === id) }));
    await step('every execution is the exact MCP command or the exact inventory; no write, kill, login, exec, proxy, probe, version or retry command; no authentication or sandbox-secret path is touched', async () => {
      const runs = [...pick(corpus.configurationCases, NEG_CONFIG).map((x) => ({ ...x, kind: 'config' })), ...pick(corpus.logCases, NEG_LOG).map((x) => ({ ...x, kind: 'log' })), ...pick(corpus.processCases, NEG_PROC).map((x) => ({ ...x, kind: 'process' }))];
      for (const { id, c, kind } of runs) {
        check(Boolean(c), `the corpus has ${id}`);
        if (!c) continue;
        const out = await runDoctorCase(check, doctor, c, 'sync', kind);
        if (!out) continue;
        const bad = out.calls.filter((x) => !(isMcpArgv(x.argv) && /(^|[\\/])(codex(\.exe)?|node(\.exe)?)$/i.test(x.executable)) && !(eq(x.argv, INVENTORY_ARGV) && x.executable === WIN_POWERSHELL));
        check(bad.length === 0, `${id}: every call is the MCP command or the exact inventory`, bad.map((x) => [x.executable, x.argv]));
        const words = out.calls.flatMap((x) => x.argv.map(String)).join(' ');
        check(!/\b(kill|taskkill|Stop-Process|exec|login|proxy|resume|debug|sandbox|--version|--ignore-user-config|--sandbox|--full-auto)\b/.test(words.replace(/mcp_servers\.[A-Za-z0-9_.-]+/g, '')), `${id}: no remediation, model or probe word in any argument`, words.slice(0, 200));
        check(out.calls.length <= 2, `${id}: at most the MCP command and one inventory, never a retry`, out.calls.length);
      }
    });
    await step('a timeout is reported, never remediated: the doctor makes no second call and issues no kill command (the executor owns terminating its own child)', async () => {
      const c = corpus.configurationCases.find((x) => x.id === 'posix-cli-timeout');
      if (!c) { check(false, 'the corpus has posix-cli-timeout'); return; }
      const out = await runDoctorCase(check, doctor, c, 'sync', 'config');
      check(out !== null && out.calls.length === 1, 'exactly one call after a timeout', out && out.calls.length);
    });
    await step('child process: with every seam supplied (and with no dependency on a parse failure) the doctor never reaches the real filesystem, a real subprocess or process.kill', async () => {
      await withScratch(context, 'neg', async (dir) => {
        const ids = ['win-ready-native-codex-exe', 'winnpm-ready-standard-shim', 'posix-ready-one-covered-disabled', 'posix-cli-timeout'];
        const cases = ids.map((id) => {
          const c = corpus.configurationCases.find((x) => x.id === id);
          if (!c) return null;
          const w = buildWorld(c);
          const base = WORLD_DEFS[c.world]();
          const entries = [...base.vfs.filter((e) => !(c.drop || []).includes(e.path)), ...(c.add || [])];
          return { id, platform: w.platform, cwd: w.cwd, home: w.home, node: w.node, env: { ...w.env }, vfs: entries, argv: c.argv, stdout: { mcp: c.mcp && c.mcp.stdout !== undefined ? c.mcp.stdout : '[]', inv: '[]' } };
        });
        if (cases.some((x) => x === null)) { check(false, 'the corpus has the negative-action cases'); return; }
        const driver = path.join(dir, 'driver.mjs');
        putFile(driver, DRIVER_SOURCE.replace('__MAKE_VFS__', () => makeVfs.toString()));
        const specFile = path.join(dir, 'spec.json');
        putFile(specFile, JSON.stringify({ url: scriptUrl(context, 'doctor.mjs'), cases }));
        const r = spawnNode(context, [driver, specFile], { cwd: dir });
        let rep = null;
        try { rep = JSON.parse(String(r.stdout).trim().split('\n').pop()); } catch { /* reported below */ }
        check(r.status === 0 && rep !== null, 'the batch driver ran', { status: r.status, stderr: String(r.stderr).slice(0, 300), stdout: String(r.stdout).slice(0, 200) });
        if (!rep) return;
        check(rep.records.length === 0, 'no real filesystem read or write, no real subprocess and no process.kill during any seam-supplied run or the parse failure', rep.records.slice(0, 6));
        check(rep.out.length === cases.length && rep.out.every((x) => x.err === null && typeof x.exitCode === 'number'), 'every seam-supplied run completed with an exit code', rep.out);
        check(rep.help && rep.help.exitCode === 2, 'the dependency-free parse failure returned exit 2', rep.help);
      });
    });
    flushProcessCount(context, 'N8-doctor/C10/negative-actions', mark);
  });
}

// =================================================== N8-doctor/C10/cli ====
// Plan 2.4, 3.1 and 6.2: exits 0, 1 and 2 with exact streams in process; the direct-entry block through a junctioned skill directory and the other parse-failure launches. No CLI case resolves a real codex, reads a real
// CODEX_HOME or runs a live inventory: every exit-0 and exit-1 outcome is proven in process.
async function cliGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const doctor = await needDoctor(failures, context);
    const corpus = loadCorpus(failures, context);
    if (!doctor || !corpus) return;
    const mark = processMark(context);
    await step('in process: exit 0 for a ready report and exit 1 for a not-ready one, each J(report) with empty stderr; exit 2 is J({ok:false,code,error}) with empty stderr; main writes nothing and sets nothing', async () => {
      const ready = corpus.configurationCases.find((x) => x.id === 'posix-ready-one-covered-disabled');
      const notReady = corpus.configurationCases.find((x) => x.id === 'posix-enabled-server');
      check(Boolean(ready) && Boolean(notReady), 'the corpus has a ready and a not-ready case');
      if (ready) { const o = await runDoctorCase(check, doctor, ready, 'sync', 'config'); check(o !== null && o.result.exitCode === 0 && o.result.stderr === '', 'ready: exit 0, empty stderr', o && o.result.exitCode); }
      if (notReady) { const o = await runDoctorCase(check, doctor, notReady, 'sync', 'config'); check(o !== null && o.result.exitCode === 1 && o.result.stderr === '', 'not ready: exit 1, empty stderr', o && o.result.exitCode); }
      const byCode = new Map();
      for (const c of corpus.argumentCases) if (!c.expect.ok && !byCode.has(c.expect.code)) byCode.set(c.expect.code, c);
      check(eq([...byCode.keys()].sort(), Object.keys(ARG_MESSAGES).sort()), 'the corpus exercises every parser error code', [...byCode.keys()]);
      for (const [code, c] of byCode) {
        const r = await withStreamCapture(() => doctor.main(Array.isArray(c.argv) ? clone(c.argv) : c.argv));
        const want = { exitCode: 2, stdout: J({ ok: false, code, error: ARG_MESSAGES[code] }), stderr: '' };
        check(!r.threw && eq(r.value, want), `${code}: the exact exit-2 result`, r.threw ? errMsg(r.error) : r.value);
        check(eq(Object.keys(JSON.parse(r.value.stdout)), ['ok', 'code', 'error']), `${code}: the envelope key order is ok, code, error`);
      }
    });
    await step('plan 2.4: the junctioned launch of ["--help"] is exit 2, empty stderr and exactly J({ok:false,code:"DOCTOR_OPTION",error:"DOCTOR_OPTION: unsupported argument"}); the same parse failures through a direct launch are the same exact envelopes', async () => {
      await withScratch(context, 'cli', async (dir) => {
        const link = path.join(dir, 'skill-link');
        if (!linkDir(context.skillRoot, link)) { check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'} for the alternate-path launch`); return; }
        const want = J({ ok: false, code: 'DOCTOR_OPTION', error: 'DOCTOR_OPTION: unsupported argument' });
        const a = spawnNode(context, [path.join(link, 'scripts', 'doctor.mjs'), '--help'], { cwd: dir });
        check(a.status === 2 && a.stderr === '' && a.stdout === want, 'junctioned ["--help"]: exit 2, empty stderr, the exact stdout (an empty stdout fails: the direct-entry fallback must run main)', { status: a.status, stdout: clip(a.stdout), stderr: clip(a.stderr) });
        const b = spawnNode(context, [skillPath(context, 'scripts/doctor.mjs'), '--profile=x'], { cwd: dir });
        check(b.status === 2 && b.stderr === '' && b.stdout === want, 'direct launch ["--profile=x"]: exit 2 with the DOCTOR_OPTION envelope', { status: b.status, stdout: clip(b.stdout), stderr: clip(b.stderr) });
        const c = spawnNode(context, [skillPath(context, 'scripts/doctor.mjs'), '-p', 'bad name'], { cwd: dir });
        check(c.status === 2 && c.stderr === '' && c.stdout === J({ ok: false, code: 'DOCTOR_PROFILE', error: 'DOCTOR_PROFILE: invalid profile identifier' }), 'direct launch with a space in the profile: the DOCTOR_PROFILE envelope', { status: c.status, stdout: clip(c.stdout), stderr: clip(c.stderr) });
      });
    });
    await step('plan 2.4: importing scripts/doctor.mjs causes no read, write, output, process launch or exit code and the export set is exactly main and parseDoctorArgs', async () => {
      importProbe(check, 'doctor.mjs', context, 'doctor.mjs', DOCTOR_EXPORTS);
    });
    flushProcessCount(context, 'N8-doctor/C10/cli', mark);
  });
}

// ------------------------------------------------------- import safety ----
// Same criteria as C1-C9: no spawn, no filesystem write, no filesystem read other than the module's own file, no output, no exit, no exit code, no environment change. The probe is a test-owned temporary file.
// The ESM loader reads the module files it links (.mjs and package.json lookups) through the patched fs, so those reads are not counted: a read of any other file (a project file, a policy, a configuration file) is.
const PROBE_SOURCE = [
  "import cp from 'node:child_process';",
  "import fs from 'node:fs';",
  "import { syncBuiltinESMExports } from 'node:module';",
  "const log = { spawns: [], writes: [], reads: [], stdout: [], stderr: [], exits: [], err: null, names: [], exitCode: null, env: 0, hasDefault: false };",
  "for (const k of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) { const o = cp[k]; cp[k] = function () { log.spawns.push(k); return o.apply(this, arguments); }; }",
  "const W = ['writeFileSync', 'appendFileSync', 'mkdirSync', 'mkdtempSync', 'rmSync', 'rmdirSync', 'unlinkSync', 'renameSync', 'copyFileSync', 'cpSync', 'symlinkSync', 'linkSync', 'truncateSync', 'createWriteStream', 'writeFile', 'appendFile', 'mkdir', 'mkdtemp', 'rm', 'rmdir', 'unlink', 'rename', 'copyFile', 'cp', 'symlink'];",
  "for (const k of W) { if (typeof fs[k] === 'function') { const o = fs[k]; fs[k] = function () { log.writes.push(k); return o.apply(this, arguments); }; } }",
  "for (const k of W) { if (typeof fs.promises[k] === 'function') { const o = fs.promises[k]; fs.promises[k] = function () { log.writes.push('promises.' + k); return o.apply(this, arguments); }; } }",
  "const R = ['readFileSync', 'openSync', 'readdirSync', 'opendirSync', 'statSync', 'lstatSync', 'readlinkSync', 'realpathSync', 'existsSync', 'accessSync', 'createReadStream', 'readFile', 'open', 'readdir', 'opendir', 'stat', 'lstat', 'readlink', 'realpath', 'access'];",
  "const target = process.argv[2];",
  "const self = new URL(target).pathname.replace(/^\\/([A-Za-z]:)/, '$1').toLowerCase();",
  "const note = (k, p) => { let s = ''; try { s = typeof p === 'string' ? p : Buffer.isBuffer(p) ? p.toString() : String(p); } catch { s = '?'; } const n = s.replace(/\\\\/g, '/').toLowerCase(); if (n.endsWith(self) || self.endsWith(n)) return; if (/\\.(mjs|cjs|js)$|(^|\\/)package\\.json$/.test(n)) return; log.reads.push(k + ':' + s); };",
  "for (const k of R) { if (typeof fs[k] === 'function') { const o = fs[k]; const w = function (p) { note(k, p); return o.apply(this, arguments); }; if (k === 'realpathSync') w.native = o.native; fs[k] = w; } }",
  "for (const k of R) { if (typeof fs.promises[k] === 'function') { const o = fs.promises[k]; fs.promises[k] = function (p) { note('promises.' + k, p); return o.apply(this, arguments); }; } }",
  "const ow = process.stdout.write, ew = process.stderr.write;",
  "process.stdout.write = function (c) { log.stdout.push(String(c)); return true; };",
  "process.stderr.write = function (c) { log.stderr.push(String(c)); return true; };",
  "process.exit = function (c) { log.exits.push(c === undefined ? null : c); };",
  "syncBuiltinESMExports();",
  "const envBefore = JSON.stringify(Object.entries(process.env).sort());",
  "const before = process.exitCode;",
  "try { const m = await import(target); log.names = Object.keys(m).sort(); log.hasDefault = 'default' in m; } catch (e) { log.err = String(e && e.message ? e.message : e); }",
  "log.exitCode = process.exitCode === before || process.exitCode === undefined ? null : process.exitCode;",
  "log.env = JSON.stringify(Object.entries(process.env).sort()) === envBefore ? 0 : 1;",
  "process.stdout.write = ow; process.stderr.write = ew;",
  "process.stdout.write(JSON.stringify(log) + '\\n');",
].join('\n') + '\n';
let probeSeq = 0;
// One child process imports the module under wrappers and reports every observable effect; null when the probe itself could not run.
function probeImport(context, dir, url) {
  const file = path.join(dir, `probe-${++probeSeq}.mjs`);
  fs.writeFileSync(file, PROBE_SOURCE);
  const r = spawnNode(context, [file, url], { cwd: dir });
  try { return JSON.parse(String(r.stdout).trim().split('\n').pop()); } catch { return null; }
}
function importProbe(check, label, context, name, expectNames) {
  const log = importGate(context, name);
  check(log !== null, `${label}: the import probe ran`);
  if (!log) return null;
  check(log.err === null, `${label}: imports cleanly (no top-level await cycle, no missing dependency)`, log.err);
  check(log.spawns.length === 0, `${label}: import launches no process`, log.spawns);
  check(log.writes.length === 0, `${label}: import writes nothing`, log.writes);
  check(log.reads.length === 0, `${label}: import reads nothing from the filesystem (no project, repository or configuration read at import time)`, log.reads.slice(0, 5));
  check(log.stdout.length === 0 && log.stderr.length === 0, `${label}: import prints nothing`, { out: log.stdout.join('').slice(0, 200), err: log.stderr.join('').slice(0, 200) });
  check(log.exits.length === 0 && log.exitCode === null, `${label}: import neither exits nor sets an exit code`, { exits: log.exits, exitCode: log.exitCode });
  check(log.env === 0, `${label}: import does not change the environment`);
  check(log.hasDefault === false, `${label}: there is no default export`);
  if (expectNames) check(eq(log.names, sorted(expectNames)), `${label}: the export set is exactly ${expectNames.join(', ')}`, log.names);
  return log;
}

// ============================================ validation harness ====
// In-process filesystem recorder and fault injector (plan 4.1 and 6.3: "an in-process filesystem recorder with synchronized built-in exports"). Wrappers exist only between start() and stop(); each record is the
// operation with its absolute path. Rules make an operation on an exact path (or a prefix) throw an Error with the given code. Nothing else about the production code is patched.
const FS_READS = ['readFileSync', 'openSync', 'readdirSync', 'opendirSync', 'statSync', 'lstatSync', 'readlinkSync', 'realpathSync', 'existsSync', 'accessSync', 'createReadStream'];
const FS_WRITES = ['writeFileSync', 'appendFileSync', 'mkdirSync', 'mkdtempSync', 'rmSync', 'rmdirSync', 'unlinkSync', 'renameSync', 'copyFileSync', 'cpSync', 'symlinkSync', 'linkSync', 'truncateSync', 'chmodSync', 'utimesSync', 'createWriteStream'];
function fsRecorder(rules = []) {
  const records = [];
  const undo = [];
  const toPath = (p) => { try { if (typeof p === 'string') return p; if (Buffer.isBuffer(p)) return p.toString(); if (p instanceof URL) return fileURLToPath(p); } catch { /* not a path */ } return null; };
  const abs = (p) => { const s = toPath(p); if (s === null) return null; try { return path.resolve(s); } catch { return s; } };
  const hits = (rule, op, p) => {
    if (!(rule.ops || [op]).includes(op)) return false;
    const a = abs(p);
    if (a === null) return false;
    const f = lc(a);
    return (rule.paths || []).some((x) => lc(path.resolve(x)) === f) || (rule.prefixes || []).some((x) => { const q = lc(path.resolve(x)); return f === q || f.startsWith(q + path.sep); });
  };
  const wrap = (obj, name, kind) => {
    const orig = obj[name];
    if (typeof orig !== 'function') return;
    const w = function (...args) {
      records.push({ kind, op: name, path: abs(args[0]) });
      for (const r of rules) {
        if (hits(r, name, args[0])) throw Object.assign(new Error(`${r.code || 'EIO'}: injected ${name} failure`), { code: r.code || 'EIO', syscall: name, path: String(args[0]) });
      }
      return orig.apply(this, args);
    };
    for (const k of Object.keys(orig)) w[k] = orig[k];
    obj[name] = w;
    undo.push(() => { obj[name] = orig; });
  };
  return {
    records,
    start() {
      for (const n of FS_READS) { wrap(fs, n, 'read'); wrap(fs.promises, n, 'read'); }
      for (const n of FS_WRITES) { wrap(fs, n, 'write'); wrap(fs.promises, n, 'write'); }
      const nativeOrig = fs.realpathSync.native;
      if (typeof nativeOrig === 'function') {
        const w = function (...args) { records.push({ kind: 'read', op: 'realpathSync.native', path: abs(args[0]) }); return nativeOrig.apply(this, args); };
        fs.realpathSync.native = w;
        undo.push(() => { fs.realpathSync.native = nativeOrig; });
      }
      for (const n of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
        const orig = cp[n];
        if (typeof orig !== 'function') continue;
        cp[n] = function (...a) { records.push({ kind: 'spawn', op: n, path: String(a[0]) }); return orig.apply(this, a); };
        undo.push(() => { cp[n] = orig; });
      }
      syncBuiltinESMExports();
      return this;
    },
    stop() { while (undo.length) undo.pop()(); syncBuiltinESMExports(); },
  };
}
const bodyReads = (records, file) => records.filter((r) => r.kind === 'read' && ['readFileSync', 'openSync', 'createReadStream'].includes(r.op) && r.path !== null && lc(r.path) === lc(path.resolve(file)));
const anyAccess = (records, file) => records.filter((r) => r.path !== null && lc(r.path) === lc(path.resolve(file)));
const underAny = (p, roots) => p !== null && roots.some((r) => { const a = lc(path.resolve(r)); const f = lc(p); return f === a || f.startsWith(a + path.sep); });

// ---------------------------------------------------------- fixtures ----
const GITIGNORE = '.claude/settings.local.json\nCLAUDE.local.md\n';
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
const explicitAnchors = (patterns) => patterns.map((e) => ({ anchor: inferredAnchor(e.glob), ...e }));
const identityOf = (e) => JSON.stringify([e.anchor === undefined ? inferredAnchor(e.glob) : e.anchor, e.glob.toLowerCase()]);
const manifestOf = (files, over = {}) => ({ schema: 3, skill: 'project-setup', skillVersion: '3.0.0-rc.1', mode: 'fresh', agents: [], sourceCommit: null, files, ...over });
const manifest2Of = (files, over = {}) => ({ schema: 2, skill: 'project-setup', skillVersion: '2.0.0', agents: [], files, ...over });
const fullRec = (text) => ({ ownership: 'full', sha256: NH(text) });
const keysRec = (managed, omissions) => (omissions === undefined ? { ownership: 'keys', managed } : { ownership: 'keys', managed, omissions });
// The Codex snippet hash a project records: the SHA-256 of the exact snippet the landed C3 renderer produces for the installed policy.
let renderModule = null;
async function snippetHashOf(context, policy) {
  if (renderModule === null) renderModule = await import(scriptUrl(context, 'render-permissions.mjs'));
  return sha(Buffer.from(renderModule.renderSecurityControls(policy).codexSnippet, 'utf8'));
}
const toolFiles = (context, members = RUNTIME_MEMBERS) => Object.fromEntries(members.map((m) => [`.ai/tools/${m}`, shipped(context).tools[m]]));
// A fresh schema-1 installation: the shipped policy recorded as its own managed baseline, the seven runtime members recorded as fully managed, the canonical hook in settings and in the settings record, the matching snippet hash.
async function freshFiles(context, o = {}) {
  const s = shipped(context);
  const policy = o.policy || s.policy;
  const policyText = o.policyText !== undefined ? o.policyText : jsonText(policy);
  const members = o.members || RUNTIME_MEMBERS;
  const tools = toolFiles(context, members);
  const settings = o.settings !== undefined ? o.settings : { permissions: { deny: ['Read(**/.env*)'] }, hooks: HOOK_SETTINGS_BLOCK };
  const settingsText = typeof settings === 'string' ? settings : jsonText(settings);
  const managedList = o.managedList || explicitAnchors((o.recordedPolicy || s.policy).patterns);
  const recSchema = o.recordedSchema || (o.recordedPolicy || s.policy).schema;
  const records = {
    '.ai/security-paths.json': o.policyRecord || keysRec({ schema: recSchema, patterns: managedList }, o.policyOmissions),
    '.claude/settings.json': o.settingsRecord || keysRec({ 'permissions.deny': ['Read(**/.env*)'], hooks: [HOOK_IDENTITY] }),
    ...Object.fromEntries(members.filter((m) => !(o.unrecorded || []).includes(m)).map((m) => [`.ai/tools/${m}`, fullRec(tools[`.ai/tools/${m}`])])),
    ...(o.extraRecords || {}),
  };
  const hash = o.snippetHash !== undefined ? o.snippetHash : await snippetHashOf(context, policy);
  const man = o.manifest || manifestOf(records, hash === null ? {} : { codexSnippetSha256: hash });
  const files = { '.gitignore': GITIGNORE, '.claude/settings.json': settingsText, '.ai/security-paths.json': policyText, '.ai/manifest.json': typeof man === 'string' ? man : jsonText(man), ...tools, ...(o.extra || {}) };
  for (const k of o.omit || []) delete files[k];
  return files;
}
function mkProject(dir, label, files) {
  const root = path.join(dir, label);
  fs.mkdirSync(root, { recursive: true });
  for (const [rel, data] of Object.entries(files)) if (data !== null && data !== undefined) putFile(path.join(root, ...rel.split('/')), data);
  return fs.realpathSync.native(root);
}
const validateFiles = (root) => walkFiles(root).filter((p) => !p.startsWith('.ai/.run/') && !p.startsWith('.ai/.canary/') && !p.includes('node_modules/'));
const SELFTEST_RESULT = () => ({ status: 0, signal: null, stdout: SELFTEST_OK, stderr: '' });
// The recording executor of plan 4.1 (the doctor signature): `behavior` is a result, a function or a marker string.
function validateExecutor(behavior) {
  const calls = [];
  const execute = (executable, argv, options) => {
    calls.push({ executable, argv: Array.isArray(argv) ? [...argv] : argv, options });
    const b = typeof behavior === 'function' ? behavior({ executable, argv, options }) : behavior;
    if (b === undefined) return SELFTEST_RESULT();
    if (b && b.$throw) throw new Error(b.$throw);
    if (b && b.$reject) return Promise.reject(new Error(b.$reject));
    if (b && b.$async) return Promise.resolve(b.$async);
    return b;
  };
  return { execute, calls };
}
// One in-process validation: the report, the streams, the executions and (optionally) the recorded filesystem activity.
async function runValidate(validate, root, o = {}) {
  const ex = o.execute === 'default' ? null : validateExecutor(o.execute);
  const files = o.files || validateFiles(root);
  const deps = { root, files };
  if (ex) deps.execute = ex.execute;
  const rec = o.record || o.inject ? fsRecorder(o.inject || []) : null;
  if (rec) rec.start();
  let cap;
  try { cap = await withStreamCapture(() => validate.main(o.argv || [], deps)); } finally { if (rec) rec.stop(); }
  let report = null;
  if (!cap.threw && cap.value && typeof cap.value.stdout === 'string') { try { report = JSON.parse(cap.value.stdout); } catch { report = null; } }
  return { cap, result: cap.threw ? null : cap.value, report, calls: ex ? ex.calls : [], records: rec ? rec.records : [] };
}
const levelCount = (rows, level) => rows.filter((r) => r.level === level).length;
const rowsOf = (report, ...checks) => (report ? report.results.filter((r) => checks.includes(r.check)) : []);
const POLICY_STATE_CHECKS = ['policy-managed', 'policy-version', 'policy-baseline', 'policy-project', 'codex-snippet'];
// The generic invariants of every validation report (plan 4.3): the envelope, the key order, the summary arithmetic, info rows outside the totals, exit 1 exactly when a fail row exists, empty stderr, the evidence block.
function expectReport(check, label, run, want = {}) {
  const r = run.result;
  check(r !== null, `${label}: main resolves`, run.cap.threw ? errMsg(run.cap.error) : undefined);
  if (r === null) return false;
  check(eq(Object.keys(r), ['exitCode', 'stdout', 'stderr']), `${label}: the result has exactly exitCode, stdout and stderr`, Object.keys(r));
  check(r.stderr === '', `${label}: stderr is empty`, clip(r.stderr));
  check(run.cap.out.length === 0 && run.cap.err.length === 0 && run.cap.exits.length === 0 && run.cap.exitCode === null, `${label}: main writes no stream, never exits, never sets process.exitCode`);
  const rep = run.report;
  check(rep !== null, `${label}: stdout is the JSON report`, clip(r.stdout));
  if (rep === null) return false;
  check(r.stdout === J(rep), `${label}: stdout is J(report)`);
  check(eq(Object.keys(rep), ['ok', 'summary', 'results', 'runtimeEvidence']), `${label}: the key order is ok, summary, results, runtimeEvidence`, Object.keys(rep));
  const sum = { pass: levelCount(rep.results, 'pass'), warn: levelCount(rep.results, 'warn'), fail: levelCount(rep.results, 'fail') };
  check(eq(rep.summary, sum) && eq(Object.keys(rep.summary), ['pass', 'warn', 'fail']), `${label}: the summary counts pass, warn and fail rows only (info rows are outside every total)`, { summary: rep.summary, counted: sum });
  check(rep.ok === (sum.fail === 0) && r.exitCode === (sum.fail ? 1 : 0), `${label}: ok is no-fail and the exit code is 1 exactly when a fail row exists`, { ok: rep.ok, exit: r.exitCode, fails: sum.fail });
  check(eq(Object.keys(rep.runtimeEvidence || {}), ['hookSelfTest', 'claudeHookLoading']) && rep.runtimeEvidence.claudeHookLoading === 'not-verified', `${label}: runtimeEvidence has hookSelfTest and claudeHookLoading, and Claude hook loading is never verified`, rep.runtimeEvidence);
  check(rep.results.every((x) => eq(Object.keys(x), ['level', 'check', 'detail']) && ['pass', 'warn', 'fail', 'info'].includes(x.level)), `${label}: every row is {level, check, detail}`);
  if (want.exit !== undefined) check(r.exitCode === want.exit, `${label}: exit ${want.exit}`, { exit: r.exitCode, fails: rep.results.filter((x) => x.level === 'fail') });
  if (want.evidence !== undefined) check(rep.runtimeEvidence.hookSelfTest === want.evidence, `${label}: hookSelfTest evidence is ${want.evidence}`, rep.runtimeEvidence);
  if (want.launches !== undefined) check(run.calls.length === want.launches, `${label}: ${want.launches} installed self-test launch(es)`, run.calls.length);
  return true;
}
// The rows of the given checks, compared exactly, in order.
function expectRows(check, label, run, checks, want) {
  if (!run.report) return;
  const got = rowsOf(run.report, ...checks);
  check(eq(got, want), `${label}: the ${checks.join('/')} rows are exact`, { got, want: want.slice(0, 12) });
}
const hookRow = (run) => rowsOf(run.report, 'hooks-selftest');
// The exact executor call of plan 4.8.
function expectSelfTestCall(check, label, run, root) {
  const c = run.calls[0];
  if (!c) { check(false, `${label}: the installed self-test was launched`); return; }
  check(c.executable === process.execPath, `${label}: the executable is the absolute node (process.execPath)`, c.executable);
  check(eq(c.argv, [path.join(root, '.ai', 'tools', 'hooks-selftest.mjs')]), `${label}: argv is exactly the installed hooks-selftest path`, c.argv);
  check(eq(c.options, { cwd: root, env: process.env, shell: false, windowsHide: true, encoding: 'utf8', timeout: 20000, maxBuffer: 65536 }), `${label}: the options are exact (project cwd, process.env, no shell, 20000 ms, 64 KiB)`, c.options && { ...c.options, env: '(env)' });
}

// ================================================== R46/C10/anchors ====
// Plan 4.6: only shared permissions.deny strings are inspected; a user-owned Read(...) or Edit(...) whose body does not begin with **/, /, // or ~/ warns, exceptions (!) and other tools do not; a rule is managed only by exact
// membership in a validated keys-owned settings record; an invalid manifest emits no deny-anchor row.
const DENY_MIX = [
  'Read(**/secrets/**)', 'Read(/abs/key)', 'Read(//abs2/key)', 'Read(~/ssh/key)', 'Edit(**/x)', 'Edit(/y)', 'Edit(//z)', 'Edit(~/w)',
  'Read(env/**)', 'Edit(cert/*)', 'Read(!env/keep)', 'Edit(!cert/keep)', 'Bash(rm -rf env/**)', 'Write(env/**)', 'WebFetch(domain:env)', 'Read', 'Edit',
  'Read(env/**)', 'Read(./rel)', 'Edit(src/**)',
];
const DENY_WARNS = ['Read(env/**)', 'Edit(cert/*)', 'Read(env/**)', 'Read(./rel)', 'Edit(src/**)'];
const anchorRows = (rules) => rules.map((r) => ({ level: 'warn', check: 'deny-anchor', detail: ANCHOR_WARN(r) }));
async function anchorsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const validate = await needValidate(failures, context);
    if (!validate) return;
    await withScratch(context, 'r46', async (dir) => {
      const settingsOf = (deny) => jsonText({ permissions: { deny } });
      const withManifest = (rec, extra = {}) => ({ '.claude/settings.json': settingsOf(DENY_MIX), '.ai/manifest.json': jsonText(manifestOf({ '.claude/settings.json': rec }, extra)) });
      await step('the four anchored forms, exceptions, unrelated tools and bare tool names stay silent; unanchored user Read and Edit rules warn with the exact text, in settings order, duplicates kept', async () => {
        const root = mkProject(dir, 'a', { '.gitignore': GITIGNORE, '.claude/settings.json': settingsOf(DENY_MIX) });
        const run = await runValidate(validate, root, {});
        if (!expectReport(check, 'mixed deny list', run, { exit: 0, evidence: 'not-run', launches: 0 })) return;
        expectRows(check, 'mixed deny list', run, ['deny-anchor'], anchorRows(DENY_WARNS));
      });
      await step('the warning embeds the rule through JSON.stringify: a quote or a newline inside a rule cannot forge a second line', async () => {
        const rule = 'Read(a"b\nc/**)';
        const root = mkProject(dir, 'quote', { '.gitignore': GITIGNORE, '.claude/settings.json': settingsOf([rule]) });
        const run = await runValidate(validate, root, {});
        if (!expectReport(check, 'escaped rule', run, { exit: 0 })) return;
        expectRows(check, 'escaped rule', run, ['deny-anchor'], anchorRows([rule]));
        check(rowsOf(run.report, 'deny-anchor').every((r) => !r.detail.includes('\n')), 'the detail is one line');
      });
      await step('exact membership in the validated keys-owned managed list makes every occurrence silent; near matches, other ownership modes and a missing record leave the rule user-owned', async () => {
        const exact = mkProject(dir, 'exact', withManifest(keysRec({ 'permissions.deny': ['Read(env/**)', 'Read(./rel)'] })));
        const a = await runValidate(validate, exact, {});
        if (expectReport(check, 'managed exact', a, { exit: 0 })) expectRows(check, 'managed exact', a, ['deny-anchor'], anchorRows(['Edit(cert/*)', 'Edit(src/**)']));
        const near = mkProject(dir, 'near', withManifest(keysRec({ 'permissions.deny': ['Read(env/** )', 'read(env/**)', ' Read(env/**)', 'Read(Env/**)', 'Read(env/*)', 'Read(./rel/)'] })));
        const b = await runValidate(validate, near, {});
        if (expectReport(check, 'managed near matches', b, { exit: 0 })) expectRows(check, 'managed near matches', b, ['deny-anchor'], anchorRows(DENY_WARNS));
        const merged = mkProject(dir, 'merged', withManifest({ ownership: 'merged' }));
        const c = await runValidate(validate, merged, {});
        if (expectReport(check, 'non-keys ownership', c, { exit: 0 })) expectRows(check, 'non-keys ownership', c, ['deny-anchor'], anchorRows(DENY_WARNS));
        const full = mkProject(dir, 'fullrec', withManifest(fullRec('{}\n')));
        const d = await runValidate(validate, full, {});
        if (expectReport(check, 'full ownership', d, { exit: 0 })) expectRows(check, 'full ownership', d, ['deny-anchor'], anchorRows(DENY_WARNS));
        const noRecord = mkProject(dir, 'norecord', { '.gitignore': GITIGNORE, '.claude/settings.json': settingsOf(DENY_MIX), '.ai/manifest.json': jsonText(manifestOf({})) });
        const e = await runValidate(validate, noRecord, {});
        if (expectReport(check, 'manifest without a settings record', e, { exit: 0 })) expectRows(check, 'manifest without a settings record', e, ['deny-anchor'], anchorRows(DENY_WARNS));
        const schema2 = mkProject(dir, 'sch2', { '.gitignore': GITIGNORE, '.claude/settings.json': settingsOf(DENY_MIX), '.ai/manifest.json': jsonText(manifest2Of({ '.claude/settings.json': keysRec({ 'permissions.deny': ['Read(env/**)'] }) })) });
        const f = await runValidate(validate, schema2, {});
        if (expectReport(check, 'schema 2 keys record', f, { exit: 0 })) expectRows(check, 'schema 2 keys record', f, ['deny-anchor'], anchorRows(['Edit(cert/*)', 'Read(./rel)', 'Edit(src/**)']));
      });
      await step('an invalid manifest emits no deny-anchor row at all (its ownership is never consumed); the failure and exit 1 are the manifest failure', async () => {
        const root = mkProject(dir, 'badm', withManifest(keysRec({ 'permissions.deny': ['Read(env/**)'] }), { skill: 'other' }));
        const run = await runValidate(validate, root, {});
        if (!expectReport(check, 'invalid manifest', run, { exit: 1 })) return;
        check(rowsOf(run.report, 'deny-anchor').length === 0, 'zero deny-anchor rows', rowsOf(run.report, 'deny-anchor'));
        check(run.report.results.some((r) => r.level === 'fail' && r.check === 'json-schema' && r.detail === '.ai/manifest.json: skill must be "project-setup"'), 'the manifest failure is reported');
      });
      await step('no settings, no deny list and an empty deny list produce no deny-anchor row', async () => {
        for (const [label, files] of [['no settings', { '.gitignore': GITIGNORE }], ['no permissions', { '.gitignore': GITIGNORE, '.claude/settings.json': '{}\n' }], ['an empty deny list', { '.gitignore': GITIGNORE, '.claude/settings.json': settingsOf([]) }], ['allow only', { '.gitignore': GITIGNORE, '.claude/settings.json': jsonText({ permissions: { allow: ['Read(env/**)'] } }) }]]) {
          const run = await runValidate(validate, mkProject(dir, `none-${label.replace(/\W+/g, '')}`, files), {});
          if (expectReport(check, label, run, { exit: 0 })) check(rowsOf(run.report, 'deny-anchor').length === 0, `${label}: zero deny-anchor rows`, rowsOf(run.report, 'deny-anchor'));
        }
      });
      await step('row placement: policy-state rows, then deny-anchor rows, then allow rows, then the self-test row', async () => {
        const files = await freshFiles(context, { settings: { permissions: { deny: ['Read(**/.env*)', 'Read(env/**)'] }, hooks: HOOK_SETTINGS_BLOCK } });
        const run = await runValidate(validate, mkProject(dir, 'order', files), {});
        if (!expectReport(check, 'placement', run, { exit: 0, evidence: 'passed', launches: 1 })) return;
        const idx = (c) => run.report.results.findIndex((r) => r.check === c);
        const last = (c) => run.report.results.map((r) => r.check).lastIndexOf(c);
        check(idx('deny-anchor') >= 0 && last('policy-managed') < idx('deny-anchor') && last('deny-anchor') < idx('allow-local') && idx('allow-local') < idx('hooks-selftest'), 'policy-managed < deny-anchor < allow-local < hooks-selftest', run.report.results.map((r) => r.check));
        expectRows(check, 'placement', run, ['deny-anchor'], anchorRows(['Read(env/**)']));
      });
    });
  });
}

// ==================================================== R49/C10/policy ====
// Plan 4.5: inspectSecurityState is called with the parsed installed policy, the validated manifest, the shipped v2 baseline and the shipped current policy (normalized hashes); its rows are appended unchanged; the installed bytes are never
// compared with the current shipped file.
const projectRowOf = (patterns) => ({ level: 'info', check: 'policy-project', detail: `.ai/security-paths.json: projectPatterns ${JSON.stringify(patterns.map(identityOf))}` });
async function policyGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const validate = await needValidate(failures, context);
    if (!validate) return;
    const s = shipped(context);
    await withScratch(context, 'r49', async (dir) => {
      let n = 0;
      const scenario = async (label, o, want) => {
        const files = await freshFiles(context, o);
        const run = await runValidate(validate, mkProject(dir, `s${++n}`, files), {});
        if (!expectReport(check, label, run, { exit: want.exit, evidence: 'passed', launches: 1 })) return run;
        expectRows(check, label, run, POLICY_STATE_CHECKS, want.rows);
        check(rowsOf(run.report, 'policy-schema').length === 1 && eq(rowsOf(run.report, 'policy-schema')[0], ROW.policyPass), `${label}: exactly one policy-schema pass row`, rowsOf(run.report, 'policy-schema'));
        return run;
      };
      const edited = (fn) => { const p = clone(s.policy); fn(p); return p; };
      await step('an unchanged recorded managed list: one managed pass, no behind, no snippet row (the recorded hash matches); the policy-schema pass row is present', async () => {
        await scenario('unchanged', {}, { exit: 0, rows: [ROW.managedPass] });
        await scenario('depth-only edit with the matching snippet (bytes differ from the shipped file, the managed list does not)', { policy: edited((p) => { p.codexGlobScanMaxDepth = 9; }) }, { exit: 0, rows: [ROW.managedPass] });
        await scenario('single-line formatting of the same policy', { policyText: JSON.stringify(s.policy) }, { exit: 0, rows: [ROW.managedPass] });
        await scenario('CRLF line endings', { policyText: jsonText(s.policy).split('\n').join('\r\n') }, { exit: 0, rows: [ROW.managedPass] });
      });
      await step('a managed entry changed, a note changed, an entry deleted or the order changed: managed fail and exit 1, never a behind row', async () => {
        await scenario('altered glob', { policy: edited((p) => { p.patterns[0].glob = '**/.envx*'; }) }, { exit: 1, rows: [ROW.managedFail] });
        await scenario('altered entry metadata (note)', { policy: edited((p) => { p.patterns[0].note = 'changed note'; }) }, { exit: 1, rows: [ROW.managedFail] });
        await scenario('altered entry metadata (kind)', { policy: edited((p) => { p.patterns[1].kind = 'other-kind'; }) }, { exit: 1, rows: [ROW.managedFail] });
        await scenario('deleted entry', { policy: edited((p) => { p.patterns.pop(); }) }, { exit: 1, rows: [ROW.managedFail] });
        await scenario('reordered entries', { policy: edited((p) => { [p.patterns[1], p.patterns[2]] = [p.patterns[2], p.patterns[1]]; }) }, { exit: 1, rows: [ROW.managedFail] });
        await scenario('an extra managed entry', { policy: edited((p) => { p.patterns.push({ glob: '**/extra.secret', kind: 'x' }); }) }, { exit: 1, rows: [ROW.managedFail] });
      });
      await step('valid project additions (schema 2): managed pass and one project info row with the identity keys of the project patterns in their order; never managed drift', async () => {
        const managed = explicitAnchors(s.policy.patterns);
        const one = [{ anchor: 'root', glob: 'docs/private/**' }];
        const two = [{ anchor: 'root', glob: 'Docs/Private/**' }, { anchor: 'any', glob: '**/Backup*' }];
        for (const [label, projectPatterns] of [['one project pattern', one], ['two project patterns, mixed case, order kept', two]]) {
          const policy = { schema: 2, patterns: managed, projectPatterns, codexGlobScanMaxDepth: 6 };
          await scenario(label, { policy, recordedPolicy: { schema: 2, patterns: s.policy.patterns }, recordedSchema: 2, managedList: managed }, { exit: 0, rows: [ROW.managedPass, projectRowOf(projectPatterns)] });
        }
        const policy = { schema: 2, patterns: managed, projectPatterns: [], codexGlobScanMaxDepth: 6 };
        await scenario('a schema-2 policy with no project patterns', { policy, recordedSchema: 2, managedList: managed }, { exit: 0, rows: [ROW.managedPass] });
      });
      await step('absent or invalid inputs: no manifest and no policy-state success row is manufactured', async () => {
        const root = mkProject(dir, 'nomanifest', await freshFiles(context, { omit: ['.ai/manifest.json'], members: [], settings: { permissions: { deny: ['Read(**/.env*)'] } } }));
        const run = await runValidate(validate, root, {});
        if (expectReport(check, 'no manifest', run, { exit: 0 })) {
          expectRows(check, 'no manifest (an unknown baseline, never an invented verdict)', run, POLICY_STATE_CHECKS, [ROW.baselineUnknown, ROW.snippetMissing]);
        }
      });
      await step('missing or invalid shipped inspection data is the one policy-baseline failure and no policy-state row (a scratch skill copy with a damaged data/secret-paths-v2.0.0.json)', async () => {
        for (const [label, edit] of [['invalid JSON', (root) => fs.writeFileSync(path.join(root, 'data', 'secret-paths-v2.0.0.json'), '{ not json')], ['a missing file', (root) => fs.rmSync(path.join(root, 'data', 'secret-paths-v2.0.0.json'))]]) {
          const skill = await makeSkillCopy(context, dir, `skill-baseline-${++n}`);
          edit(skill);
          const mod = await importOrFail(failures, pathToFileURL(path.join(skill, 'scripts', 'validate.mjs')).href, `the scratch skill copy (${label})`);
          if (!mod) continue;
          const run = await runValidate(mod, mkProject(dir, `s${++n}`, await freshFiles(context)), {});
          if (!expectReport(check, `shipped data ${label}`, run, { exit: 1 })) continue;
          expectRows(check, `shipped data ${label}`, run, POLICY_STATE_CHECKS, [{ level: 'fail', check: 'policy-baseline', detail: 'Shipped policy inspection data is unavailable or invalid' }]);
        }
      });
    });
  });
}

// ==================================================== R81/C10/baseline ====
async function baselineGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const validate = await needValidate(failures, context);
    if (!validate) return;
    const s = shipped(context);
    const v2Patterns = s.v2.patterns;
    await withScratch(context, 'r81', async (dir) => {
      let n = 0;
      const scenario = async (label, o, want) => {
        const files = await freshFiles(context, o);
        const run = await runValidate(validate, mkProject(dir, `b${++n}`, files), {});
        if (!expectReport(check, label, run, { exit: want.exit })) return run;
        expectRows(check, label, run, POLICY_STATE_CHECKS, want.rows);
        return run;
      };
      const v2Hash = await snippetHashOf(context, s.v2);
      const desired = s.policy.patterns;
      const have = new Set(v2Patterns.map(identityOf));
      const missing = desired.filter((e) => !have.has(identityOf(e)));
      check(missing.length >= 2, 'the shipped current policy has desired identities the v2 baseline lacks (the fixture premise)', missing.map((e) => e.glob));
      const omitEntries = (list) => list.map((e) => ({ anchor: 'any', ...e }));
      await step('an older unchanged list (recorded as a v2 full hash, or as an explicit managed record) is managed pass then behind, never edited', async () => {
        await scenario('v2 full-hash record', { policyText: s.v2Text, policy: s.v2, policyRecord: fullRec(s.v2Text), snippetHash: v2Hash }, { exit: 0, rows: [ROW.managedPass, ROW.behind] });
        await scenario('explicit managed record of the v2 list', { policyText: s.v2Text, policy: s.v2, recordedPolicy: s.v2, snippetHash: v2Hash }, { exit: 0, rows: [ROW.managedPass, ROW.behind] });
        await scenario('the current shipped policy recorded by its full hash is not behind', { policyRecord: fullRec(s.text), policyText: s.text, snippetHash: await snippetHashOf(context, s.policy) }, { exit: 0, rows: [ROW.managedPass] });
      });
      await step('an edited list is a managed fail and exit 1 without a behind row', async () => {
        const e = clone(s.v2); e.patterns[0].glob = '**/.envedited';
        await scenario('edited v2 list', { policyText: jsonText(e), policy: e, recordedPolicy: s.v2, snippetHash: await snippetHashOf(context, e) }, { exit: 1, rows: [ROW.managedFail] });
      });
      await step('an exact omission of every missing desired identity suppresses behind; one identity not omitted keeps it', async () => {
        await scenario('all missing identities omitted exactly', { policyText: s.v2Text, policy: s.v2, recordedPolicy: s.v2, policyOmissions: { patterns: omitEntries(missing) }, snippetHash: v2Hash }, { exit: 0, rows: [ROW.managedPass] });
        await scenario('one missing identity not omitted', { policyText: s.v2Text, policy: s.v2, recordedPolicy: s.v2, policyOmissions: { patterns: omitEntries(missing.slice(1)) }, snippetHash: v2Hash }, { exit: 0, rows: [ROW.managedPass, ROW.behind] });
        await scenario('an omission with another glob spelling does not cover the identity', { policyText: s.v2Text, policy: s.v2, recordedPolicy: s.v2, policyOmissions: { patterns: [{ anchor: 'any', glob: '**/.env.*' }] }, snippetHash: v2Hash }, { exit: 0, rows: [ROW.managedPass, ROW.behind] });
      });
      await step('an unknown installed baseline (no policy record, or a full record that matches neither shipped file) produces an info row only, never an invented edited or behind verdict', async () => {
        const noRecord = await freshFiles(context, { snippetHash: null, policyText: s.v2Text, policy: s.v2 });
        const man = JSON.parse(noRecord['.ai/manifest.json']);
        delete man.files['.ai/security-paths.json'];
        noRecord['.ai/manifest.json'] = jsonText(man);
        const a = await runValidate(validate, mkProject(dir, 'unk1', noRecord), {});
        if (expectReport(check, 'no policy record', a, { exit: 0 })) expectRows(check, 'no policy record', a, POLICY_STATE_CHECKS, [ROW.baselineUnknown, ROW.snippetMissing]);
        const strange = await freshFiles(context, { policyRecord: fullRec('{"strange":true}\n'), snippetHash: await snippetHashOf(context, s.policy) });
        const b = await runValidate(validate, mkProject(dir, 'unk2', strange), {});
        if (expectReport(check, 'foreign full hash', b, { exit: 0 })) expectRows(check, 'foreign full hash', b, POLICY_STATE_CHECKS, [ROW.baselineUnknown]);
      });
    });
  });
}

// ==================================================== R82/C10/snippet ====
async function snippetGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const validate = await needValidate(failures, context);
    if (!validate) return;
    const s = shipped(context);
    await withScratch(context, 'r82', async (dir) => {
      let n = 0;
      const scenario = async (label, o, want, runOpts = {}) => {
        const run = await runValidate(validate, mkProject(dir, `n${++n}`, await freshFiles(context, o)), runOpts);
        if (expectReport(check, label, run, { exit: 0 })) expectRows(check, label, run, POLICY_STATE_CHECKS, want);
        return run;
      };
      await step('a missing record is the missing info; a matching hash is silent; a hash of another rendering is the stale info', async () => {
        await scenario('missing record', { snippetHash: null }, [ROW.managedPass, ROW.snippetMissing]);
        await scenario('matching hash', {}, [ROW.managedPass]);
        await scenario('stale hash', { snippetHash: 'a'.repeat(64) }, [ROW.managedPass, ROW.snippetStale]);
      });
      await step('a project-pattern change changes the expected hash: the recorded hash of the old pattern is stale, the recomputed one matches (the two renderings differ)', async () => {
        const managed = explicitAnchors(s.policy.patterns);
        const polA = { schema: 2, patterns: managed, projectPatterns: [{ anchor: 'root', glob: 'docs/a/**' }], codexGlobScanMaxDepth: 6 };
        const polB = { schema: 2, patterns: managed, projectPatterns: [{ anchor: 'root', glob: 'docs/b/**' }], codexGlobScanMaxDepth: 6 };
        const hA = await snippetHashOf(context, polA);
        const hB = await snippetHashOf(context, polB);
        check(hA !== hB && /^[0-9a-f]{64}$/.test(hA) && /^[0-9a-f]{64}$/.test(hB), 'the two project policies render to different snippets (independent fixture premise)', [hA, hB]);
        const base = { recordedSchema: 2, managedList: managed };
        await scenario('policy A, hash A', { ...base, policy: polA, snippetHash: hA }, [ROW.managedPass, projectRowOf(polA.projectPatterns)]);
        await scenario('policy B, hash A: stale', { ...base, policy: polB, snippetHash: hA }, [ROW.managedPass, projectRowOf(polB.projectPatterns), ROW.snippetStale]);
        await scenario('policy B, hash B: current', { ...base, policy: polB, snippetHash: hB }, [ROW.managedPass, projectRowOf(polB.projectPatterns)]);
      });
      await step('a depth change alone changes the hash (stale until the new rendering is recorded)', async () => {
        const deeper = clone(s.policy); deeper.codexGlobScanMaxDepth = 11;
        await scenario('depth 11 with the depth 6 hash', { policy: deeper, snippetHash: await snippetHashOf(context, s.policy) }, [ROW.managedPass, ROW.snippetStale]);
        await scenario('depth 11 with the depth 11 hash', { policy: deeper }, [ROW.managedPass]);
      });
      await step('no user configuration is read or written and nothing claims runtime verification: every filesystem operation stays inside the project and the skill; no write happens at all; personal settings and home files are untouched', async () => {
        const home = path.join(dir, 'home-sentinel');
        putFile(path.join(home, '.codex', 'config.toml'), 'default_permissions = "x"\n');
        putFile(path.join(home, '.claude', 'settings.json'), '{}\n');
        const files = await freshFiles(context, { snippetHash: null, extra: { '.claude/settings.local.json': '{"permissions":{"allow":["Bash"]}}\n' } });
        const root = mkProject(dir, 'norec', files);
        const run = await runValidate(validate, root, { record: true, files: validateFiles(root).filter((p) => p !== '.claude/settings.local.json') });
        if (!expectReport(check, 'no user config', run, { exit: 0 })) return;
        const roots = [root, context.skillRoot, home];
        const ancestorOf = (p) => { const a = lc(path.resolve(p)); const r = lc(root); return r.startsWith(a + path.sep); };
        const outside = run.records.filter((r) => r.kind !== 'spawn' && r.path !== null && !underAny(r.path, [root, context.skillRoot]) && !(ancestorOf(r.path) && /^(lstatSync|statSync|realpathSync|realpathSync.native|existsSync|accessSync)$/.test(r.op)));
        check(outside.length === 0, 'every filesystem operation is inside the project or the skill directory (no home, Claude or Codex user configuration path)', outside.slice(0, 5));
        check(run.records.filter((r) => r.kind === 'write').length === 0, 'validate writes nothing', run.records.filter((r) => r.kind === 'write').slice(0, 3));
        check(run.records.filter((r) => r.kind === 'spawn').length === 0, 'with the root and files seams validate launches no process (no hidden Git discovery)', run.records.filter((r) => r.kind === 'spawn').slice(0, 3));
        check(anyAccess(run.records, path.join(root, '.claude', 'settings.local.json')).filter((r) => ['readFileSync', 'openSync', 'createReadStream'].includes(r.op)).length === 0, 'personal settings are never opened');
        check(roots.length === 3 && run.records.length > 0, 'control: the recorder saw the run', run.records.length);
        expectRows(check, 'no user config', run, ['codex-snippet'], [ROW.snippetMissing]);
        check(run.report.results.every((r) => !/verified at runtime|runtime-verified|negative capability|loading verified/i.test(r.detail) || /not verified/.test(r.detail)), 'no row claims runtime verification (the hook row says Claude hook loading is not verified)');
        check(rowsOf(run.report, 'codex-snippet').every((r) => r.level === 'info'), 'the snippet rows are informational');
      });
    });
  });
}

// ================================================== R53/C10/reporting ====
// Plan 4.7: inspectAllows (C7) results are appended unchanged; ownership comes only from an entirely valid manifest's keys-owned settings record; unavailable classification is fail/allow-input then LOCAL, with the exact
// precedence; LOCAL exactly once; personal settings are never read or classified; managed broad allows fail in schema 2 as well.
const allowRowsOf = (list) => list.flatMap(([rule, owner, kind]) => (kind === 'repo'
  ? [{ level: 'warn', check: 'allow-repo-code', detail: REPO_ALLOW(rule, owner) }]
  : [{ level: owner === 'managed' ? 'fail' : 'warn', check: 'allow-broad', detail: BROAD_ALLOW(rule, owner) }]));
const ALLOW_CHECKS = ['allow-repo-code', 'allow-broad', 'allow-local', 'allow-input'];
function allowProject({ allow, managed, omit, record, schema = 3, settingsText, noSettings = false, extra = {} }) {
  const files = { '.gitignore': GITIGNORE, ...extra };
  if (!noSettings) files['.claude/settings.json'] = settingsText !== undefined ? settingsText : jsonText({ permissions: { allow: allow || [] } });
  const rec = record !== undefined ? record : (managed !== undefined || omit !== undefined ? keysRec(managed === undefined ? {} : { 'permissions.allow': managed }, omit === undefined ? undefined : { 'permissions.allow': omit }) : undefined);
  if (rec !== null && rec !== undefined) files['.ai/manifest.json'] = jsonText((schema === 2 ? manifest2Of : manifestOf)({ '.claude/settings.json': rec }));
  return files;
}
async function reportingGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const validate = await needValidate(failures, context);
    if (!validate) return;
    const s = shipped(context);
    const c7 = await importOrFail(failures, scriptUrl(context, 'classify-allows.mjs'), 'scripts/classify-allows.mjs');
    await withScratch(context, 'r53', async (dir) => {
      let n = 0;
      const go = async (label, files, want, runOpts = {}) => {
        const run = await runValidate(validate, mkProject(dir, `a${++n}`, files), runOpts);
        if (!expectReport(check, label, run, { exit: want.exit })) return run;
        expectRows(check, label, run, ALLOW_CHECKS, want.rows);
        check(rowsOf(run.report, 'allow-local').length === 1, `${label}: the personal-settings info row appears exactly once`, rowsOf(run.report, 'allow-local').length);
        check(!run.report.results.some((r) => r.check === 'allow-other' || (/other/.test(r.check) && r.level === 'pass')), `${label}: no pass row for rules classified other`);
        const local = run.report.results.findIndex((r) => r.check === 'allow-local');
        const lastAllow = run.report.results.map((r) => r.check).findLastIndex((c) => ALLOW_CHECKS.includes(c));
        check(local === lastAllow, `${label}: the personal-settings row is last among the allow rows`, run.report.results.map((r) => r.check));
        return run;
      };
      const L = [ROW.allowLocal];
      await step('repository-code allows warn for both owners; managed broad fails and user broad warns; other rules are silent; duplicates keep their order; one LOCAL row last', async () => {
        await go('managed repo-code', allowProject({ allow: ['Bash(npm test)'], managed: ['Bash(npm test)'] }), { exit: 0, rows: [...allowRowsOf([['Bash(npm test)', 'managed', 'repo']]), ...L] });
        await go('user repo-code', allowProject({ allow: ['Bash(npm test)'] }), { exit: 0, rows: [...allowRowsOf([['Bash(npm test)', 'user', 'repo']]), ...L] });
        await go('managed broad', allowProject({ allow: ['Bash'], managed: ['Bash'] }), { exit: 1, rows: [...allowRowsOf([['Bash', 'managed', 'broad']]), ...L] });
        await go('user broad', allowProject({ allow: ['PowerShell'] }), { exit: 0, rows: [...allowRowsOf([['PowerShell', 'user', 'broad']]), ...L] });
        await go('other rules only', allowProject({ allow: ['Bash(git status)', 'Read(docs/**)', 'WebFetch(domain:example.com)'] }), { exit: 0, rows: L });
        await go('duplicates', allowProject({ allow: ['Bash(npm test)', 'Bash(npm test)'], managed: ['Bash(npm test)'] }), { exit: 0, rows: [...allowRowsOf([['Bash(npm test)', 'managed', 'repo'], ['Bash(npm test)', 'managed', 'repo']]), ...L] });
        await go('mixed rules in settings order', allowProject({ allow: ['Bash(git status)', 'Bash(npm test)', 'Bash', 'PowerShell(npm run lint)', '*'], managed: ['Bash'] }), {
          exit: 1, rows: [...allowRowsOf([['Bash(npm test)', 'user', 'repo'], ['Bash', 'managed', 'broad'], ['PowerShell(npm run lint)', 'user', 'repo'], ['*', 'user', 'broad']]), ...L],
        });
      });
      await step('managed identities that are no longer present give no active warning; an omission does not make a present rule managed; an identity both managed and omitted is managed', async () => {
        await go('managed identity absent from settings', allowProject({ allow: [], managed: ['Bash(npm test)', 'Bash'] }), { exit: 0, rows: L });
        await go('managed broad identity absent while another rule is present', allowProject({ allow: ['Bash(git status)'], managed: ['Bash'] }), { exit: 0, rows: L });
        await go('omitted present rule stays user-owned', allowProject({ allow: ['Bash(npm test)'], managed: [], omit: ['Bash(npm test)'] }), { exit: 0, rows: [...allowRowsOf([['Bash(npm test)', 'user', 'repo']]), ...L] });
        await go('managed and omitted is managed', allowProject({ allow: ['Bash'], managed: ['Bash'], omit: ['Bash'] }), { exit: 1, rows: [...allowRowsOf([['Bash', 'managed', 'broad']]), ...L] });
      });
      await step('missing settings and other ownership modes: LOCAL only; non-keys ownership classifies everything as user-owned (a broad user allow warns, exit 0)', async () => {
        await go('missing settings with a valid manifest', allowProject({ noSettings: true, managed: ['Bash'] }), { exit: 0, rows: L });
        await go('missing settings and no manifest', allowProject({ noSettings: true }), { exit: 0, rows: L });
        await go('merged ownership', allowProject({ allow: ['Bash'], record: { ownership: 'merged' } }), { exit: 0, rows: [...allowRowsOf([['Bash', 'user', 'broad']]), ...L] });
        await go('full ownership', allowProject({ allow: ['Bash'], record: fullRec('{}\n') }), { exit: 0, rows: [...allowRowsOf([['Bash', 'user', 'broad']]), ...L] });
      });
      await step('schema 2: a managed broad allow fails validation (a needs-update info row is not an exemption); a user repo-code allow warns; the schema-2 info row is present', async () => {
        const a = await go('schema 2 managed broad', allowProject({ allow: ['Bash'], managed: ['Bash'], schema: 2 }), { exit: 1, rows: [...allowRowsOf([['Bash', 'managed', 'broad']]), ...L] });
        check(a.report && rowsOf(a.report, 'manifest-version').length === 1, 'the schema-2 needs-update info row is present');
        await go('schema 2 user repo-code', allowProject({ allow: ['Bash(npm test)'], managed: [], schema: 2 }), { exit: 0, rows: [...allowRowsOf([['Bash(npm test)', 'user', 'repo']]), ...L] });
      });
      await step('the appended rows are the C7 classifier rows unchanged: an oracle check against inspectAllows for the same inputs', async () => {
        if (!c7 || typeof c7.inspectAllows !== 'function') { check(false, 'scripts/classify-allows.mjs exports inspectAllows'); return; }
        const allow = ['Bash(git status)', 'Bash(npm test)', 'Bash', './run.sh', 'PowerShell(npm run lint)', 'Bash(npm test)'];
        const oracle = c7.inspectAllows({ settings: { permissions: { allow } }, managed: { 'permissions.allow': ['Bash'] }, omissions: {} }).results;
        const run = await runValidate(validate, mkProject(dir, 'oracle', allowProject({ allow, managed: ['Bash'] })), {});
        if (expectReport(check, 'oracle', run, { exit: 1 })) expectRows(check, 'oracle', run, ALLOW_CHECKS, oracle);
      });
      await step('unavailable classification: invalid manifest, unsafe, protected, unreadable and invalid-JSON settings, and a C7 pure validation failure: fail/allow-input with the exact detail, then LOCAL; the fixed-control row of the settings is separate', async () => {
        const bad = await go('invalid manifest', allowProject({ allow: ['Bash'], record: null, extra: { '.ai/manifest.json': jsonText(manifestOf({}, { skill: 'other' })) } }), { exit: 1, rows: [allowInput(ALLOW_INPUT.manifest), ...L] });
        void bad;
        const js = await go('invalid JSON settings', allowProject({ settingsText: '{ not json' }), { exit: 1, rows: [allowInput(ALLOW_INPUT.invalid), ...L] });
        check(js.report && rowsOf(js.report, 'json-syntax').length === 1 && rowsOf(js.report, 'json-syntax')[0].detail.startsWith('.claude/settings.json: '), 'the settings JSON failure is the existing json-syntax row');
        const pure = await go('C7 pure failure', allowProject({ settingsText: jsonText({ permissions: { allow: 'Bash' } }) }), { exit: 1, rows: [allowInput('ALLOW_SETTINGS: settings permissions.allow must be a string array'), ...L] });
        check(pure.report && pure.report.results.some((r) => r.level === 'fail' && r.check === 'json-schema' && r.detail === '.claude/settings.json: permissions.allow must be an array of strings'), 'the shared settings schema failure is reported as well');
        const prot = await go('protected settings', allowProject({ allow: ['Bash'], extra: { '.ai/security-paths.json': jsonText({ ...s.policy, patterns: [...s.policy.patterns, { glob: '.claude/settings.json', kind: 'x' }] }) } }), { exit: 1, rows: [allowInput(ALLOW_INPUT.protected), ...L] });
        check(prot.report && eq(rowsOf(prot.report, 'validation-protected'), [VALIDATION.protectedRow('.claude/settings.json')]), 'the fixed-control protection row is emitted for the settings');
        const io = await go('unreadable settings', allowProject({ allow: ['Bash'] }), { exit: 1, rows: [allowInput(ALLOW_INPUT.io), ...L] }, { inject: [{ ops: ['readFileSync', 'openSync'], paths: [path.join(path.join(dir, `a${n + 1}`), '.claude', 'settings.json')], code: 'EACCES' }] });
        void io;
      });
      await step('unsafe settings (a junctioned .claude): validation-path and allow-input unsafe; precedence: invalid manifest first, then unsafe, then protected, then read failure, then invalid JSON', async () => {
        const mkLinked = (label, over = {}) => {
          const root = mkProject(dir, label, { '.gitignore': GITIGNORE, ...over });
          const ext = path.join(dir, `${label}-ext`);
          putFile(path.join(ext, 'settings.json'), jsonText({ permissions: { allow: ['Bash'] } }));
          return { root, ok: linkDir(ext, path.join(root, '.claude')) };
        };
        const a = mkLinked('lnk1');
        if (!a.ok) { check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'}`); return; }
        const run = await runValidate(validate, a.root, { files: ['.gitignore'] });
        if (expectReport(check, 'unsafe settings', run, { exit: 1 })) {
          expectRows(check, 'unsafe settings', run, ALLOW_CHECKS, [allowInput(ALLOW_INPUT.unsafe), ...L]);
          check(eq(rowsOf(run.report, 'validation-path'), [VALIDATION.path('.claude/settings.json')]), 'one validation-path row for the settings', rowsOf(run.report, 'validation-path'));
          check(rowsOf(run.report, 'validation-protected', 'validation-io').length === 0, 'no protection or read-failure row for an unsafe path');
          check(rowsOf(run.report, 'deny-anchor').length === 0, 'an unsafe settings file yields no deny-anchor row');
        }
        const b = mkLinked('lnk2', { '.ai/manifest.json': jsonText(manifestOf({}, { skill: 'other' })) });
        const runB = await runValidate(validate, b.root, { files: ['.gitignore', '.ai/manifest.json'] });
        if (expectReport(check, 'invalid manifest beats unsafe settings', runB, { exit: 1 })) {
          expectRows(check, 'invalid manifest beats unsafe settings', runB, ALLOW_CHECKS, [allowInput(ALLOW_INPUT.manifest), ...L]);
          check(eq(rowsOf(runB.report, 'validation-path'), [VALIDATION.path('.claude/settings.json')]), 'the settings still gets its own fixed-control row');
        }
        const c = mkLinked('lnk3', { '.ai/security-paths.json': jsonText({ ...s.policy, patterns: [...s.policy.patterns, { glob: '.claude/settings.json', kind: 'x' }] }) });
        const runC = await runValidate(validate, c.root, { files: ['.gitignore', '.ai/security-paths.json'] });
        if (expectReport(check, 'unsafe beats protected', runC, { exit: 1 })) {
          expectRows(check, 'unsafe beats protected', runC, ALLOW_CHECKS, [allowInput(ALLOW_INPUT.unsafe), ...L]);
          check(rowsOf(runC.report, 'validation-protected').length === 0 && eq(rowsOf(runC.report, 'validation-path'), [VALIDATION.path('.claude/settings.json')]), 'only the unsafe row for the settings');
        }
      });
      await step('plan 4.5 / C10-P3-2: after an installed-policy failure with a valid or absent manifest the allow rows are allow-input protected then LOCAL whether or not the settings exist, and the settings are not read; the validation-protected row only when the settings are present', async () => {
        const policyBad = { '.ai/security-paths.json': jsonText({ schema: 99, patterns: [] }) };
        const manifestOk = { '.ai/manifest.json': jsonText(manifestOf({})) };
        for (const [label, extra, settingsPresent] of [['valid manifest, no settings', manifestOk, false], ['valid manifest, settings present', manifestOk, true], ['absent manifest, no settings', {}, false], ['absent manifest, settings present', {}, true]]) {
          const files = allowProject({ noSettings: !settingsPresent, allow: ['Bash'], extra: { ...policyBad, ...extra } });
          const root = mkProject(dir, `pf${++n}`, files);
          const run = await runValidate(validate, root, { record: true });
          if (!expectReport(check, label, run, { exit: 1 })) continue;
          expectRows(check, label, run, ALLOW_CHECKS, [allowInput(ALLOW_INPUT.protected), ...L]);
          expectRows(check, label, run, ['validation-protected'], settingsPresent ? [VALIDATION.protectedRow('.claude/settings.json')] : []);
          check(bodyReads(run.records, path.join(root, '.claude', 'settings.json')).length === 0, `${label}: the settings body is never read`);
          check(eq(rowsOf(run.report, 'policy-schema'), [POLICY_SCHEMA99]), `${label}: exactly one policy-schema failure`, rowsOf(run.report, 'policy-schema'));
        }
      });
      await step('personal settings are never read or classified', async () => {
        const root = mkProject(dir, 'personal', allowProject({ allow: [], extra: { '.claude/settings.local.json': jsonText({ permissions: { allow: ['Bash', 'Bash(npm test)'] } }) } }));
        const run = await runValidate(validate, root, { record: true, files: ['.gitignore', '.claude/settings.json'] });
        if (!expectReport(check, 'personal settings', run, { exit: 0 })) return;
        expectRows(check, 'personal settings', run, ALLOW_CHECKS, L);
        check(anyAccess(run.records, path.join(root, '.claude', 'settings.local.json')).filter((r) => ['readFileSync', 'openSync', 'createReadStream'].includes(r.op)).length === 0, 'settings.local.json is never opened');
        check(bodyReads(run.records, path.join(root, '.claude', 'settings.json')).length >= 1, 'control: the shared settings were read');
      });
    });
  });
}

// ================================================== R73/C10/selftest ====
// Plan 4.8 (closed PQ1 = A): the ordered activation table, the exact executor call, the exact transcript, the exact rows and evidence states, the three-member preconditions with their precedence, and two real installed runs.
const BAD_RESULTS = [
  ['a thrown error', { $throw: 'fixture marker' }], ['a rejected promise', { $reject: 'fixture marker' }],
  ['a spawn failure', { status: null, signal: null, error: { code: 'ENOENT' }, stdout: '', stderr: '' }], ['a timeout', { status: null, signal: 'SIGTERM', error: { code: 'ETIMEDOUT' }, stdout: '', stderr: '' }],
  ['a capture overflow', { status: null, signal: 'SIGTERM', error: { code: 'ENOBUFS' }, stdout: '', stderr: '' }], ['a signal', { status: null, signal: 'SIGKILL', stdout: SELFTEST_OK, stderr: '' }],
  ['status 0 with a signal', { status: 0, signal: 'SIGTERM', stdout: SELFTEST_OK, stderr: '' }], ['a nonzero status with the exact stdout', { status: 1, signal: null, stdout: SELFTEST_OK, stderr: '' }],
  ['a silent exit 0', { status: 0, signal: null, stdout: '', stderr: '' }], ['CRLF line endings', { status: 0, signal: null, stdout: SELFTEST_OK.replace(/\n/g, '\r\n'), stderr: '' }],
  ['an extra trailing line', { status: 0, signal: null, stdout: `${SELFTEST_OK}extra\n`, stderr: '' }], ['a missing final LF', { status: 0, signal: null, stdout: SELFTEST_OK.slice(0, -1), stderr: '' }],
  ['a truncated transcript', { status: 0, signal: null, stdout: `${SELFTEST_OK.split('\n').slice(0, 2).join('\n')}\n`, stderr: '' }],
  ['wrong totals', { status: 0, signal: null, stdout: SELFTEST_OK.replace('3 PASS / 0 FAIL', '3 PASS / 1 FAIL'), stderr: '' }],
  ['reordered lines', { status: 0, signal: null, stdout: 'PASS  guard-raw-git/blocked\nPASS  guard-raw-git/allowed\nPASS  guard-raw-git/malformed\n3 PASS / 0 FAIL\n', stderr: '' }],
  ['a failing case line', { status: 1, signal: null, stdout: 'PASS  guard-raw-git/allowed\nFAIL  guard-raw-git/blocked\nPASS  guard-raw-git/malformed\n2 PASS / 1 FAIL\n', stderr: '' }],
  ['nonempty stderr', { status: 0, signal: null, stdout: SELFTEST_OK, stderr: 'fixture diagnostic\n' }], ['a null result', null], ['a string status', { status: '0', signal: null, stdout: SELFTEST_OK, stderr: '' }],
  ['a missing stderr', { status: 0, signal: null, stdout: SELFTEST_OK }], ['a Buffer stdout', { status: 0, signal: null, stdout: Buffer.from(SELFTEST_OK), stderr: '' }],
  ['an error object beside a successful transcript', { status: 0, signal: null, error: new Error('fixture marker'), stdout: SELFTEST_OK, stderr: '' }],
];
const GOOD_RESULTS = [
  ['the exact transcript', { status: 0, signal: null, stdout: SELFTEST_OK, stderr: '' }], ['an explicit null error', { status: 0, signal: null, error: null, stdout: SELFTEST_OK, stderr: '' }],
  ['extra spawnSync keys (pid, output) are ignored', { status: 0, signal: null, stdout: SELFTEST_OK, stderr: '', pid: 42, output: [null, SELFTEST_OK, ''] }], ['a promise of the exact transcript', { $async: { status: 0, signal: null, stdout: SELFTEST_OK, stderr: '' } }],
];
async function hookFiles(context, o = {}) {
  const s = shipped(context);
  const members = o.assets || [];
  const files = { '.gitignore': GITIGNORE, ...toolFiles(context, members) };
  const extraPattern = (g) => jsonText({ ...s.policy, patterns: [...s.policy.patterns, { glob: g, kind: 'x' }] });
  const policy = o.policy === undefined ? 'shipped' : o.policy;
  if (policy === 'shipped') files['.ai/security-paths.json'] = s.text;
  else if (policy === 'malformed') files['.ai/security-paths.json'] = '{ not json';
  else if (typeof policy === 'string' && policy.startsWith('protect:')) files['.ai/security-paths.json'] = extraPattern(policy.slice(8));
  if (o.settings !== undefined) files['.claude/settings.json'] = typeof o.settings === 'string' ? o.settings : jsonText(o.settings);
  if (o.manifest !== undefined) files['.ai/manifest.json'] = typeof o.manifest === 'string' ? o.manifest : jsonText(o.manifest);
  if (o.agents) files['.ai/agents/reviewer.md'] = '# reviewer\n';
  return files;
}
const SETTINGS_HOOK = { hooks: HOOK_SETTINGS_BLOCK };
const REC = (context, members) => Object.fromEntries(members.map((m) => [`.ai/tools/${m}`, fullRec(shipped(context).tools[m])]));
async function selftestGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const validate = await needValidate(failures, context);
    if (!validate) return;
    const mark = processMark(context);
    const s = shipped(context);
    await withScratch(context, 'r73', async (dir) => {
      let n = 0;
      const go = async (label, files, want, runOpts = {}) => {
        const root = mkProject(dir, `h${++n}`, files);
        const run = await runValidate(validate, root, runOpts);
        if (!expectReport(check, label, run, { exit: want.exit, evidence: want.evidence, launches: want.launches })) return { run, root };
        check(eq(hookRow(run), [want.row]), `${label}: the exact hook row`, hookRow(run));
        return { run, root };
      };
      const NR = 'not-run';
      await step('exact success: the exact executor call, the pass row, passed evidence, exit 0; the accepted result shapes (explicit null error, extra keys, a promise)', async () => {
        const files = await freshFiles(context);
        for (const [label, result] of GOOD_RESULTS) {
          const { run, root } = await go(`success, ${label}`, files, { row: ROW.hookPass, evidence: 'passed', exit: 0, launches: 1 }, { execute: result });
          expectSelfTestCall(check, `success, ${label}`, run, root);
        }
        const settingsOnly = await go('success with settings that never name the command to run (no command from settings is executed)', await freshFiles(context, { settings: { hooks: { PreToolUse: [{ matcher: 'Bash|PowerShell', hooks: [{ type: 'command', command: HOOK_COMMAND, timeout: 5 }, { type: 'command', command: 'node -e "process.exit(9)"' }] }] } } }), { row: ROW.hookPass, evidence: 'passed', exit: 0, launches: 1 });
        check(settingsOnly.run.calls.every((c) => !JSON.stringify(c.argv).includes('process.exit(9)')), 'no command obtained from settings is executed');
      });
      await step('launch, process and transcript failures: the failed row, failed evidence, exit 1, one launch, and no child output or native error in the report', async () => {
        const files = await freshFiles(context);
        for (const [label, result] of BAD_RESULTS) {
          const { run } = await go(`failure, ${label}`, files, { row: ROW.hookFailed, evidence: 'failed', exit: 1, launches: 1 }, { execute: result });
          check(run.result && !String(run.result.stdout).includes('fixture marker') && !String(run.result.stdout).includes('fixture diagnostic') && !String(run.result.stdout).includes('guard-raw-git/'), `failure, ${label}: no child stream or native error is reported`);
        }
      });
      await step('the six independent activation signals each require a self-test; with no hook asset it is unavailable (not-run, no launch, exit 1)', async () => {
        const rec = (extra) => manifestOf({ ...extra });
        const cases = [
          ['only guard-raw-git-core.mjs exists', await hookFiles(context, { assets: ['guard-raw-git-core.mjs'] })],
          ['only guard-raw-git.mjs exists', await hookFiles(context, { assets: ['guard-raw-git.mjs'] })],
          ['only hooks-selftest.mjs exists', await hookFiles(context, { assets: ['hooks-selftest.mjs'] })],
          ['a valid manifest records a hook asset that does not exist', await hookFiles(context, { manifest: rec(REC(context, ['guard-raw-git.mjs'])) })],
          ['settings contain the canonical nested command identity', await hookFiles(context, { settings: SETTINGS_HOOK })],
          ['valid keys-owned settings metadata contains the canonical identity', await hookFiles(context, { settings: { permissions: {} }, manifest: rec({ '.claude/settings.json': keysRec({ hooks: [HOOK_IDENTITY] }) }) })],
        ];
        for (const [label, files] of cases) {
          const { run } = await go(label, files, { row: ROW.hookUnavailable, evidence: NR, exit: 1, launches: 0 });
          if (label.startsWith('a valid manifest records')) {
            const t = '.ai/tools/guard-raw-git.mjs';
            expectRows(check, label, run, ['drift'], [DRIFT_MISSING(t)]);
            check(rowsOf(run.report, 'runtime-unit').some((r) => eq(r, UNIT_MISSING_RECORDED(t))), `${label}: the recorded-member runtime fail from the catalog check is present`);
            const ix = (pred) => run.report.results.findIndex(pred);
            check(ix((r) => r.check === 'drift') < ix((r) => r.check === 'runtime-unit'), `${label}: the drift warn precedes the runtime-unit rows`);
          }
        }
      });
      await step('the ordered table: valid schema 2 never launches; an invalid or unavailable manifest never launches (even beside assets); an activation signal wins over unavailable settings; usable inputs without a signal are the no-installation info', async () => {
        const three = ['guard-raw-git-core.mjs', 'guard-raw-git.mjs', 'hooks-selftest.mjs'];
        const m2 = manifest2Of({});
        await go('valid schema 2, no assets', await hookFiles(context, { manifest: m2 }), { row: ROW.hookSchema2, evidence: NR, exit: 0, launches: 0 });
        await go('valid schema 2, all three assets present', await hookFiles(context, { manifest: m2, assets: three }), { row: ROW.hookSchema2, evidence: NR, exit: 0, launches: 0 });
        await go('valid schema 2 with the canonical settings hook', await hookFiles(context, { manifest: m2, settings: SETTINGS_HOOK, assets: three }), { row: ROW.hookSchema2, evidence: NR, exit: 0, launches: 0 });
        const badM = manifestOf({}, { skill: 'other' });
        await go('invalid manifest, assets present', await hookFiles(context, { manifest: badM, assets: three }), { row: ROW.hookInvalidInput, evidence: NR, exit: 1, launches: 0 });
        await go('invalid manifest, no assets', await hookFiles(context, { manifest: badM }), { row: ROW.hookInvalidInput, evidence: NR, exit: 1, launches: 0 });
        await go('manifest that is not JSON, assets present', await hookFiles(context, { manifest: '{ nope', assets: three }), { row: ROW.hookInvalidInput, evidence: NR, exit: 1, launches: 0 });
        await go('invalid settings JSON, no signal', await hookFiles(context, { settings: '{ not json' }), { row: ROW.hookInvalidInput, evidence: NR, exit: 1, launches: 0 });
        await go('settings root is an array, no signal', await hookFiles(context, { settings: '[]\n' }), { row: ROW.hookInvalidInput, evidence: NR, exit: 1, launches: 0 });
        await go('settings root is a string, no signal', await hookFiles(context, { settings: '"x"\n' }), { row: ROW.hookInvalidInput, evidence: NR, exit: 1, launches: 0 });
        await go('protected settings, no signal', await hookFiles(context, { policy: 'protect:.claude/settings.json', settings: {} }), { row: ROW.hookInvalidInput, evidence: NR, exit: 1, launches: 0 });
        await go('malformed policy, no signal', await hookFiles(context, { policy: 'malformed' }), { row: ROW.hookInvalidInput, evidence: NR, exit: 1, launches: 0 });
        await go('no signal and usable inputs (settings present)', await hookFiles(context, { settings: { permissions: { deny: ['Read(**/.env*)'] } } }), { row: ROW.hookNone, evidence: NR, exit: 0, launches: 0 });
        await go('no signal and usable inputs (settings absent)', await hookFiles(context, {}), { row: ROW.hookNone, evidence: NR, exit: 0, launches: 0 });
        await go('a nested non-command type with the same identity is no signal', await hookFiles(context, { settings: { hooks: { PreToolUse: [{ matcher: 'Bash|PowerShell', hooks: [{ type: 'prompt', command: HOOK_COMMAND }] }] } } }), { row: ROW.hookNone, evidence: NR, exit: 0, launches: 0 });
        await go('the same command under another matcher is no signal', await hookFiles(context, { settings: { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: HOOK_COMMAND }] }] } } }), { row: ROW.hookNone, evidence: NR, exit: 0, launches: 0 });
        await go('the same identity under another event is no signal', await hookFiles(context, { settings: { hooks: { PostToolUse: [{ matcher: 'Bash|PowerShell', hooks: [{ type: 'command', command: HOOK_COMMAND }] }] } } }), { row: ROW.hookNone, evidence: NR, exit: 0, launches: 0 });
        await go('a different command string is no signal', await hookFiles(context, { settings: { hooks: { PreToolUse: [{ matcher: 'Bash|PowerShell', hooks: [{ type: 'command', command: 'node .ai/tools/guard-raw-git.mjs' }] }] } } }), { row: ROW.hookNone, evidence: NR, exit: 0, launches: 0 });
        await go('invalid settings JSON beside present hook assets: the signal wins, the self-test runs and passes, the settings failure still fails validation', await hookFiles(context, { settings: '{ not json', assets: three }), { row: ROW.hookPass, evidence: 'passed', exit: 1, launches: 1 });
      });
      await step('hook structure is checked before property access: malformed hooks shapes never throw and are no signal', async () => {
        const shapes = [
          ['PreToolUse is a string', { hooks: { PreToolUse: 'x' } }], ['PreToolUse is an object', { hooks: { PreToolUse: {} } }], ['a null group', { hooks: { PreToolUse: [null] } }],
          ['hooks is a string in the group', { hooks: { PreToolUse: [{ matcher: 'Bash|PowerShell', hooks: 'x' }] } }], ['null and number hook entries', { hooks: { PreToolUse: [{ matcher: 'Bash|PowerShell', hooks: [null, 5, { type: 'command' }] }] } }],
          ['hooks is null', { hooks: null }], ['hooks is an array', { hooks: [] }], ['a numeric matcher', { hooks: { PreToolUse: [{ matcher: 5, hooks: [{ type: 'command', command: HOOK_COMMAND }] }] } }],
        ];
        for (const [label, settings] of shapes) {
          const { run } = await go(`malformed hooks, ${label}`, await hookFiles(context, { settings }), { row: ROW.hookNone, evidence: NR, exit: 0, launches: 0 });
          check(run.result !== null, `${label}: main resolved`);
        }
      });
      await step('an unrelated permissions schema error does not make the hook identity unavailable when the settings body is a parsed object; the options of a hook are not identity', async () => {
        const three = ['guard-raw-git-core.mjs', 'guard-raw-git.mjs', 'hooks-selftest.mjs'];
        const { run } = await go('permissions error beside a canonical hook', await hookFiles(context, { settings: { permissions: { deny: 'x' }, hooks: HOOK_SETTINGS_BLOCK }, assets: three }), { row: ROW.hookPass, evidence: 'passed', exit: 1, launches: 1 });
        check(run.report && run.report.results.some((r) => r.level === 'fail' && r.check === 'json-schema' && r.detail === '.claude/settings.json: permissions.deny must be an array of strings'), 'the permissions failure is reported');
      });
      await step('the closed table rows for preconditions: a signal with a malformed policy is the unsafe-or-protected failure (without and with the literal schema-3 manifest, whose json-schema pass remains and which gets no protection row); the manifest-less and policy-less cases', async () => {
        const three = ['guard-raw-git-core.mjs', 'guard-raw-git.mjs', 'hooks-selftest.mjs'];
        const lit = { schema: 3, skill: 'project-setup', skillVersion: '3.0.0-rc.1', mode: 'fresh', agents: [], sourceCommit: null, files: {} };
        const noBody = await go('signal and malformed policy, no manifest', await hookFiles(context, { policy: 'malformed', assets: three }), { row: ROW.hookUnsafe, evidence: NR, exit: 1, launches: 0 }, { record: true });
        check(three.every((m) => bodyReads(noBody.run.records, path.join(noBody.root, '.ai', 'tools', m)).length === 0) && noBody.run.records.filter((r) => r.kind === 'spawn').length === 0, 'with unknown protection no runtime-target body is read and no process is launched', noBody.run.records.filter((r) => /tools/.test(String(r.path))).slice(0, 4));
        const withManifest = await go('signal and malformed policy, with the valid literal manifest', await hookFiles(context, { policy: 'malformed', assets: three, manifest: lit }), { row: ROW.hookUnsafe, evidence: NR, exit: 1, launches: 0 });
        check(withManifest.run.report && eq(rowsOf(withManifest.run.report, 'json-schema'), [ROW.manifestPass]) && rowsOf(withManifest.run.report, 'validation-protected').length === 0, 'the manifest keeps its json-schema pass and gets no validation-protected row', rowsOf(withManifest.run.report, 'json-schema'));
        await go('absent policy, seven assets, no .ai/agents: the shipped-default protection is known, the self-test runs', await hookFiles(context, { policy: 'absent', assets: RUNTIME_MEMBERS }), { row: ROW.hookPass, evidence: 'passed', exit: 0, launches: 1 });
        const agents = await go('absent policy, seven assets, .ai/agents present: the exit 1 comes from the missing-policy security-tooling row, not from an unsafe hook result', await hookFiles(context, { policy: 'absent', assets: RUNTIME_MEMBERS, agents: true }), { row: ROW.hookPass, evidence: 'passed', exit: 1, launches: 1 });
        check(agents.run.report && rowsOf(agents.run.report, 'security-tooling').some((r) => eq(r, ROW.policyMissing)) && rowsOf(agents.run.report, 'policy-managed', 'policy-version', 'policy-baseline', 'policy-project', 'codex-snippet').length === 0, 'the policy-missing security-tooling fail is present and no policy-state row exists');
        await go('three valid hook assets, exact success', await hookFiles(context, { assets: three }), { row: ROW.hookPass, evidence: 'passed', exit: 0, launches: 1 });
        await go('three valid hook assets, silent guard', await hookFiles(context, { assets: three }), { row: ROW.hookFailed, evidence: 'failed', exit: 1, launches: 1 }, { execute: { status: 0, signal: null, stdout: '', stderr: '' } });
      });
      await step('unsafe, protected and unreadable hook members prevent launch: protection state is known only for a usable policy; unsafe or protected wins over missing or unreadable', async () => {
        const three = ['guard-raw-git-core.mjs', 'guard-raw-git.mjs', 'hooks-selftest.mjs'];
        await go('a protected hook member', await hookFiles(context, { assets: three, policy: 'protect:.ai/tools/guard-raw-git.mjs' }), { row: ROW.hookUnsafe, evidence: NR, exit: 1, launches: 0 });
        await go('a protected member beside a missing member: protected wins', await hookFiles(context, { assets: ['guard-raw-git-core.mjs', 'guard-raw-git.mjs'], policy: 'protect:.ai/tools/guard-raw-git.mjs' }), { row: ROW.hookUnsafe, evidence: NR, exit: 1, launches: 0 });
        // PLAN-GAP: a settings identity cannot be a signal under a malformed policy (deny-all protects the settings body, which is then never read), so the signal here is a valid manifest recording a hook asset
        // (the manifest is a fixed control that stays readable). The outcome of "settings identity plus malformed policy" is not pinned and is not asserted.
        await go('malformed policy, a valid manifest recording a missing hook asset: unavailable policy wins over the missing member', await hookFiles(context, { policy: 'malformed', manifest: manifestOf(REC(context, ['guard-raw-git.mjs'])) }), { row: ROW.hookUnsafe, evidence: NR, exit: 1, launches: 0 });
        const dirCase = await hookFiles(context, { assets: ['guard-raw-git-core.mjs', 'hooks-selftest.mjs'] });
        dirCase['.ai/tools/guard-raw-git.mjs/placeholder.txt'] = 'a directory in place of the hook\n';
        await go('a directory in place of a hook member', dirCase, { row: ROW.hookUnsafe, evidence: NR, exit: 1, launches: 0 });
        const root = mkProject(dir, `h${++n}`, await hookFiles(context, {}));
        const ext = path.join(dir, `h${n}-ext`);
        for (const m of three) putFile(path.join(ext, m), s.tools[m]);
        if (!linkDir(ext, path.join(root, '.ai', 'tools'))) check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'}`);
        else {
          const run = await runValidate(validate, root, { files: ['.gitignore', '.ai/security-paths.json'] });
          if (expectReport(check, 'a junctioned .ai/tools', run, { exit: 1, evidence: NR, launches: 0 })) check(eq(hookRow(run), [ROW.hookUnsafe]), 'a junctioned .ai/tools: the unsafe row (a linked path is never launched)', hookRow(run));
        }
        const unreadable = await hookFiles(context, { assets: three });
        const rootU = mkProject(dir, `h${++n}`, unreadable);
        const runU = await runValidate(validate, rootU, { inject: [{ ops: ['readFileSync', 'openSync'], paths: [path.join(rootU, '.ai', 'tools', 'guard-raw-git-core.mjs')], code: 'EACCES' }] });
        if (expectReport(check, 'an unreadable hook member', runU, { exit: 1, evidence: NR, launches: 0 })) check(eq(hookRow(runU), [ROW.hookUnavailable]), 'an unreadable hook member: the unavailable row', hookRow(runU));
      });
      await step('an unavailable manifest (a directory in its place, or a read failure) is an invalid-input info row; the fixed-control failure row is its own', async () => {
        const three = ['guard-raw-git-core.mjs', 'guard-raw-git.mjs', 'hooks-selftest.mjs'];
        const dirManifest = await hookFiles(context, { assets: three });
        dirManifest['.ai/manifest.json/inner.txt'] = 'x\n';
        const a = await go('manifest path is a directory', dirManifest, { row: ROW.hookInvalidInput, evidence: NR, exit: 1, launches: 0 });
        check(a.run.report && eq(rowsOf(a.run.report, 'validation-path'), [VALIDATION.path('.ai/manifest.json')]), 'the manifest gets one validation-path row', a.run.report && rowsOf(a.run.report, 'validation-path'));
        const files = await hookFiles(context, { assets: three, manifest: manifestOf({}) });
        const rootR = mkProject(dir, `h${++n}`, files);
        const runR = await runValidate(validate, rootR, { inject: [{ ops: ['readFileSync', 'openSync'], paths: [path.join(rootR, '.ai', 'manifest.json')], code: 'EACCES' }] });
        if (expectReport(check, 'manifest read failure', runR, { exit: 1, evidence: NR, launches: 0 })) {
          check(eq(hookRow(runR), [ROW.hookInvalidInput]), 'manifest read failure: the invalid-input row', hookRow(runR));
          check(eq(rowsOf(runR.report, 'validation-io'), [VALIDATION.io('.ai/manifest.json')]), 'manifest read failure: one validation-io row', rowsOf(runR.report, 'validation-io'));
        }
      });
      await step('two real installed runs through the default executor: the trusted hook files pass with three hook children; the same fixture with a silent exit-0 guard fails validation', async () => {
        const files = await freshFiles(context);
        const rootOk = mkProject(dir, 'real-ok', files);
        const ok = await runValidate(validate, rootOk, { execute: 'default' });
        if (expectReport(check, 'real success', ok, { exit: 0, evidence: 'passed' })) check(eq(hookRow(ok), [ROW.hookPass]), 'real success: the pass row', hookRow(ok));
        countProcess(context, 4);
        const silent = { ...files, '.ai/tools/guard-raw-git.mjs': '// silent hook: exits 0 and permits every input\nprocess.exit(0);\n' };
        const man = JSON.parse(silent['.ai/manifest.json']);
        man.files['.ai/tools/guard-raw-git.mjs'] = fullRec(silent['.ai/tools/guard-raw-git.mjs']);
        silent['.ai/manifest.json'] = jsonText(man);
        const rootBad = mkProject(dir, 'real-silent', silent);
        const bad = await runValidate(validate, rootBad, { execute: 'default' });
        if (expectReport(check, 'real silent hook', bad, { exit: 1, evidence: 'failed' })) check(eq(hookRow(bad), [ROW.hookFailed]), 'real silent hook: the failed row', hookRow(bad));
        countProcess(context, 4);
      });
    });
    flushProcessCount(context, 'R73/C10/selftest', mark);
  });
}

// ==================================================== R79/C10/schemas ====
// Plan 4.4: checkManifest, checkClaudeSettings and checkSecurityPolicy (the shared validators) before any ownership is consumed; exact failure rows; manifest-derived paths and protected content are never traversed.
const SECRET_SHAPED = (n) => ({ level: 'pass', check: 'secret-shaped-content', detail: `${n} generated files scanned (pattern-based; not a guarantee)` });
const manifestFail = (detail) => ({ level: 'fail', check: 'json-schema', detail: `.ai/manifest.json: ${detail}` });
const policyExtra = (s, ...globs) => jsonText({ ...s.policy, patterns: [...s.policy.patterns, ...globs.map((g) => ({ glob: g, kind: 'x' }))] });
async function schemasGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const validate = await needValidate(failures, context);
    if (!validate) return;
    const s = shipped(context);
    await withScratch(context, 'r79s', async (dir) => {
      let n = 0;
      await step('plan 6.3: a schema-3 fixture (current shipped policy, matching recorded managed entries and snippet hash, composite hook identity, seven runtime members) has exactly the literal complete row list, the summary of that list and exit 0', async () => {
        const files = await freshFiles(context);
        const root = mkProject(dir, 'ok3', files);
        const run = await runValidate(validate, root, {});
        if (!expectReport(check, 'schema 3', run, { exit: 0, evidence: 'passed', launches: 1 })) return;
        const want = [ROW.settingsPass, ROW.manifestPass, ROW.policyPass, SECRET_SHAPED(9), ...RUNTIME_TARGETS.map(UNIT_PASS), ROW.managedPass, ROW.allowLocal, ROW.hookPass];
        check(eq(run.report.results, want), 'the complete results are exactly the literal list (no stale, behind, needs-update, other or manifest-version row)', firstDiff(run.report.results, want));
        check(eq(run.report.summary, { pass: 13, warn: 0, fail: 0 }), 'the summary is computed from the literal list (13 pass, info excluded)', run.report.summary);
        check(eq(run.report.runtimeEvidence, { hookSelfTest: 'passed', claudeHookLoading: 'not-verified' }), 'the evidence block', run.report.runtimeEvidence);
        expectSelfTestCall(check, 'schema 3', run, root);
      });
      await step('wrong-file ownership metadata, bad hook identities, invalid keys and unsupported values are the exact shared reader failures; the manifest gets no pass row and no needs-update row', async () => {
        const cases = [
          ['a policy record with settings fields', manifestOf({ '.ai/security-paths.json': keysRec({ 'permissions.deny': ['Read(x)'] }) }), 'files[".ai/security-paths.json"].managed: OWNERSHIP_FIELD: managed.permissions.deny'],
          ['a settings record with policy fields', manifestOf({ '.claude/settings.json': keysRec({ patterns: [] }) }), 'files[".claude/settings.json"].managed: OWNERSHIP_FIELD: managed.patterns'],
          ['a hook identity without a matcher', manifestOf({ '.claude/settings.json': keysRec({ hooks: [{ event: 'PreToolUse', command: 'x' }] }) }), 'files[".claude/settings.json"].managed: HOOK_IDENTITY: event, matcher and command are required'],
          ['a hook identity with an option key (options are not identity)', manifestOf({ '.claude/settings.json': keysRec({ hooks: [{ ...HOOK_IDENTITY, timeout: 5 }] }) }), 'files[".claude/settings.json"].managed: HOOK_IDENTITY: event, matcher and command are required'],
          ['a duplicate hook identity', manifestOf({ '.claude/settings.json': keysRec({ hooks: [HOOK_IDENTITY, { ...HOOK_IDENTITY }] }) }), 'files[".claude/settings.json"].managed: HOOK_DUPLICATE: hooks[1]'],
          ['an invalid manifest file key', manifestOf({ '../x': { ownership: 'merged' } }), 'files["../x"]: POLICY_PATH_CANONICAL: path must use canonical POSIX components'],
          ['an unsupported schema', { ...manifestOf({}), schema: 4 }, 'schema must be 2 or 3'],
          ['a wrong skill', manifestOf({}, { skill: 'other' }), 'skill must be "project-setup"'],
          ['a manifest root that is an array', [], 'root must be an object'],
        ];
        for (const [label, value, issue] of cases) {
          const run = await runValidate(validate, mkProject(dir, `m${++n}`, { '.gitignore': GITIGNORE, '.ai/manifest.json': jsonText(value) }), {});
          if (!expectReport(check, label, run, { exit: 1 })) continue;
          expectRows(check, label, run, ['json-schema', 'json-syntax'], [manifestFail(issue)]);
          check(rowsOf(run.report, 'manifest-version').length === 0 && !run.report.results.some((r) => eq(r, ROW.manifestPass)), `${label}: no manifest pass and no needs-update row`);
        }
        const leak = await runValidate(validate, mkProject(dir, `m${++n}`, { '.gitignore': GITIGNORE, '.ai/manifest.json': '{"leak-marker-9c1": ' }), {});
        if (expectReport(check, 'manifest that is not JSON', leak, { exit: 1 })) {
          expectRows(check, 'manifest that is not JSON', leak, ['json-schema', 'json-syntax'], [{ level: 'fail', check: 'json-syntax', detail: '.ai/manifest.json: manifest is not valid JSON' }]);
          check(!leak.result.stdout.includes('leak-marker-9c1') && !/in JSON at position|Unexpected|Expected/.test(leak.result.stdout), 'no source text and no native parser message');
        }
      });
      await step('valid policy metadata and composite hook identities are accepted; a policy record with the shipped schema and the keys-owned settings record pass the shared reader', async () => {
        const run = await runValidate(validate, mkProject(dir, 'okmeta', await freshFiles(context)), {});
        if (expectReport(check, 'valid metadata', run, { exit: 0 })) check(eq(rowsOf(run.report, 'json-schema'), [ROW.settingsPass, ROW.manifestPass]), 'both JSON files pass', rowsOf(run.report, 'json-schema'));
      });
      await step('malformed, unsupported and unreadable installed policies: exactly one policy-schema failure with the shared message, no policy-state row, no runtime-unit row, exit 1', async () => {
        const cases = [
          ['malformed JSON', { '.ai/security-paths.json': '{ not json' }, POLICY_JSON],
          ['unsupported schema', { '.ai/security-paths.json': jsonText({ schema: 3, patterns: [] }) }, { level: 'fail', check: 'policy-schema', detail: '.ai/security-paths.json: POLICY_SCHEMA: policy.schema must be 1 or 2' }],
          ['a policy that is not an object', { '.ai/security-paths.json': '[]\n' }, { level: 'fail', check: 'policy-schema', detail: '.ai/security-paths.json: POLICY_ROOT: policy must be a JSON object' }],
          ['a directory in place of the policy', { '.ai/security-paths.json/inner.txt': 'x\n' }, POLICY_IO],
        ];
        for (const [label, extra, row] of cases) {
          const run = await runValidate(validate, mkProject(dir, `p${++n}`, { '.gitignore': GITIGNORE, ...extra }), {});
          if (!expectReport(check, label, run, { exit: 1 })) continue;
          check(eq(rowsOf(run.report, 'policy-schema'), [row]), `${label}: the exact single policy-schema failure`, rowsOf(run.report, 'policy-schema'));
          check(rowsOf(run.report, ...POLICY_STATE_CHECKS, 'runtime-unit', 'runtime-catalog').length === 0, `${label}: no policy-state row and no runtime row`, rowsOf(run.report, ...POLICY_STATE_CHECKS, 'runtime-unit'));
        }
        const rootR = mkProject(dir, `p${++n}`, { '.gitignore': GITIGNORE, '.ai/security-paths.json': s.text });
        const readFail = await runValidate(validate, rootR, { inject: [{ ops: ['readFileSync', 'openSync'], paths: [path.join(rootR, '.ai', 'security-paths.json')], code: 'EACCES' }] });
        if (expectReport(check, 'unreadable policy', readFail, { exit: 1 })) check(eq(rowsOf(readFail.report, 'policy-schema'), [POLICY_IO]), 'an unreadable policy: the exact POLICY_IO row', rowsOf(readFail.report, 'policy-schema'));
        const rootL = mkProject(dir, `p${++n}`, { '.gitignore': GITIGNORE });
        const ext = path.join(dir, `p${n}-ext`);
        putFile(path.join(ext, 'security-paths.json'), s.text);
        if (!linkDir(ext, path.join(rootL, '.ai'))) check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'}`);
        else {
          const linked = await runValidate(validate, rootL, { files: ['.gitignore'] });
          if (expectReport(check, 'linked policy', linked, { exit: 1 })) check(eq(rowsOf(linked.report, 'policy-schema'), [POLICY_IO]), 'a policy reached through a junction: the POLICY_IO row (never followed)', rowsOf(linked.report, 'policy-schema'));
        }
      });
      await step('an absent policy: no policy-schema row and no policy-state row; with .ai/agents the existing missing-policy failure alone', async () => {
        const a = await runValidate(validate, mkProject(dir, `abs${++n}`, { '.gitignore': GITIGNORE, '.ai/manifest.json': jsonText(manifestOf({})) }), {});
        if (expectReport(check, 'absent policy', a, { exit: 0 })) check(rowsOf(a.report, 'policy-schema', ...POLICY_STATE_CHECKS).length === 0, 'no policy-schema and no policy-state row', rowsOf(a.report, 'policy-schema', ...POLICY_STATE_CHECKS));
        const b = await runValidate(validate, mkProject(dir, `abs${++n}`, { '.gitignore': GITIGNORE, '.ai/agents/reviewer.md': '# r\n' }), {});
        if (expectReport(check, 'absent policy with agents', b, { exit: 1 })) {
          check(eq(rowsOf(b.report, 'security-tooling'), [ROW.policyMissing, ROW.gitSafeMissing]), 'the two existing security-tooling failures', rowsOf(b.report, 'security-tooling'));
          check(rowsOf(b.report, 'policy-schema', ...POLICY_STATE_CHECKS).length === 0, 'no policy-schema and no policy-state row');
        }
      });
      await step('read recorders: a file named only by an invalid manifest is never read and yields no drift or content row; protected content is never read; a malformed policy denies every candidate body but the fixed manifest is still read', async () => {
        const probe = 'password: abcdefgh12345678\n';
        const rootA = mkProject(dir, `rec${++n}`, { '.gitignore': GITIGNORE, 'docs/zz-probe.txt': probe, '.ai/manifest.json': jsonText(manifestOf({ 'docs/zz-probe.txt': { ownership: 'merged' }, 'docs/zz-absent.txt': { ownership: 'merged' } }, { skillVersion: 5 })) });
        const a = await runValidate(validate, rootA, { record: true });
        if (expectReport(check, 'invalid manifest paths', a, { exit: 1 })) {
          check(bodyReads(a.records, path.join(rootA, 'docs', 'zz-probe.txt')).length === 0, 'a file named only by the invalid manifest is never read', bodyReads(a.records, path.join(rootA, 'docs', 'zz-probe.txt')).slice(0, 2));
          check(rowsOf(a.report, 'drift').length === 0 && !rowsOf(a.report, 'secret-shaped-content').some((r) => /zz-probe/.test(r.detail)), 'no drift or content finding comes from manifest-derived paths');
        }
        const broken = '<!-- project-setup:begin id=x -->\ntext\n';
        const filesP = { '.gitignore': GITIGNORE, '.ai/security-paths.json': policyExtra(s, 'docs/private/**'), 'docs/private/note.md': broken, 'docs/public/note.md': broken };
        const rootP = mkProject(dir, `rec${++n}`, filesP);
        const p = await runValidate(validate, rootP, { record: true });
        if (expectReport(check, 'protected content', p, { exit: 1 })) {
          check(bodyReads(p.records, path.join(rootP, 'docs', 'private', 'note.md')).length === 0, 'a protected body is never opened', bodyReads(p.records, path.join(rootP, 'docs', 'private', 'note.md')).slice(0, 2));
          const markers = rowsOf(p.report, 'markers').map((r) => r.detail);
          check(markers.length === 1 && markers[0].startsWith('docs/public/note.md: '), 'control: the unprotected twin yields the marker failure; the protected one yields no content-derived row', markers);
        }
        const rootD = mkProject(dir, `rec${++n}`, { '.gitignore': GITIGNORE, '.ai/security-paths.json': '{ not json', '.ai/manifest.json': jsonText(manifestOf({})), 'AGENTS.md': '# a\n', 'docs/note.md': broken });
        const d = await runValidate(validate, rootD, { record: true });
        if (expectReport(check, 'deny-all after a policy failure', d, { exit: 1 })) {
          for (const rel of ['AGENTS.md', 'docs/note.md', '.gitignore']) check(bodyReads(d.records, path.join(rootD, ...rel.split('/'))).length === 0, `${rel}: no candidate body is read after a policy failure`, bodyReads(d.records, path.join(rootD, ...rel.split('/'))).slice(0, 2));
          check(rowsOf(d.report, 'markers').length === 0, 'no content-derived marker row');
          check(bodyReads(d.records, path.join(rootD, '.ai', 'manifest.json')).length >= 1 && eq(rowsOf(d.report, 'json-schema'), [ROW.manifestPass]), 'the fixed manifest control is still read and validated', rowsOf(d.report, 'json-schema'));
          check(rowsOf(d.report, 'validation-protected').length === 0, 'the manifest never gets a validation-protected row');
        }
      });
      await step('the installed policy and the manifest are fixed controls exempt from name protection: a policy that names itself or the manifest is still read and validated', async () => {
        const files = { '.gitignore': GITIGNORE, '.ai/security-paths.json': policyExtra(s, '.ai/security-paths.json', '.ai/manifest.json'), '.ai/manifest.json': jsonText(manifestOf({})) };
        const run = await runValidate(validate, mkProject(dir, `fix${++n}`, files), {});
        if (!expectReport(check, 'fixed controls', run, { exit: 0 })) return;
        check(eq(rowsOf(run.report, 'json-schema', 'policy-schema'), [ROW.manifestPass, ROW.policyPass]), 'the manifest and the policy are validated', rowsOf(run.report, 'json-schema', 'policy-schema'));
        check(rowsOf(run.report, 'validation-protected').length === 0, 'no validation-protected row for either fixed control');
      });
    });
  });
}

// ==================================================== R79/C10/runtime-unit ====
// Plan 4.9 (closed PQ2 = A+): the catalog (readRuntimeUnits) drives one row per target in catalog order; missing members are recorded-fail, then source-schema-2 fail, then needs-update info; unsafe, protected and unreadable fail
// independently of policy age; an invalid catalog is one fail row; no row after a policy failure.
const SCHEMA2_LITERAL = {
  schema: 2,
  patterns: [
    { glob: '**/.env*', anchor: 'any', kind: 'env', note: 'Includes .env.example. Agents never read any .env* file; ' + 'scripts/env-keys.mjs extracts key NAMES only.' },
    { glob: '**/*.pem', anchor: 'any', kind: 'key' }, { glob: '**/*.key', anchor: 'any', kind: 'key' }, { glob: '**/*.p12', anchor: 'any', kind: 'key' }, { glob: '**/*.pfx', anchor: 'any', kind: 'key' },
    { glob: '**/*.crt', anchor: 'any', kind: 'cert' }, { glob: '**/*.cer', anchor: 'any', kind: 'cert' }, { glob: '**/*.cert', anchor: 'any', kind: 'cert' },
    { glob: '**/*.jks', anchor: 'any', kind: 'key' }, { glob: '**/*.keystore', anchor: 'any', kind: 'key' }, { glob: '**/id_rsa*', anchor: 'any', kind: 'key' }, { glob: '**/id_ed25519*', anchor: 'any', kind: 'key' },
    { glob: '**/secrets/**', anchor: 'any', kind: 'dir' }, { glob: '**/credentials/**', anchor: 'any', kind: 'dir' }, { glob: '**/.aws/**', anchor: 'any', kind: 'dir' },
    { glob: '**/.ssh/**', anchor: 'any', kind: 'dir' }, { glob: '**/.gnupg/**', anchor: 'any', kind: 'dir' },
    { glob: '**/.npmrc', anchor: 'any', kind: 'token', note: 'Often holds registry auth tokens.' }, { glob: '**/.htpasswd', anchor: 'any', kind: 'credential' },
    { glob: '**/.ai/.run/*/vault/**', anchor: 'any', kind: 'staging', note: 'Script-only area: backups and merged .env.example may contain real values. ' + 'Agents never read it.' },
  ],
  projectPatterns: [],
  codexGlobScanMaxDepth: 6,
};
const dummyOf = (m) => `// stand-in for ${m}: never executed, never compared with shipped bytes\n`;
function unitFiles(context, o = {}) {
  const s = shipped(context);
  const files = { '.gitignore': GITIGNORE };
  const policy = o.policy === undefined ? 'schema1' : o.policy;
  if (policy === 'schema1') files['.ai/security-paths.json'] = s.text;
  else if (policy === 'schema2') files['.ai/security-paths.json'] = jsonText(SCHEMA2_LITERAL);
  else if (typeof policy === 'string' && policy.startsWith('protect:')) files['.ai/security-paths.json'] = policyExtra(s, policy.slice(8));
  for (const m of o.present || []) files[`.ai/tools/${m}`] = HOOK_MEMBERS.includes(m) ? s.tools[m] : dummyOf(m);
  if (o.recorded) files['.ai/manifest.json'] = jsonText(manifestOf(Object.fromEntries(o.recorded.map((m) => [`.ai/tools/${m}`, fullRec((o.present || []).includes(m) ? (HOOK_MEMBERS.includes(m) ? s.tools[m] : dummyOf(m)) : dummyOf(m))]))));
  if (o.agents) files['.ai/agents/reviewer.md'] = '# reviewer\n';
  return files;
}
const unitRows = (report) => rowsOf(report, 'runtime-unit');
async function makeSkillCopy(context, dir, label) {
  const root = path.join(dir, label);
  fs.mkdirSync(root, { recursive: true });
  for (const sub of ['scripts', 'assets']) fs.cpSync(path.join(context.skillRoot, sub), path.join(root, sub), { recursive: true });
  fs.mkdirSync(path.join(root, 'data'));
  for (const f of fs.readdirSync(path.join(context.skillRoot, 'data'))) { const p = path.join(context.skillRoot, 'data', f); if (fs.statSync(p).isFile()) fs.copyFileSync(p, path.join(root, 'data', f)); }
  fs.copyFileSync(path.join(context.skillRoot, 'VERSION'), path.join(root, 'VERSION'));
  return fs.realpathSync.native(root);
}
async function runtimeUnitGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const validate = await needValidate(failures, context);
    if (!validate) return;
    const s = shipped(context);
    const catalog = readJson(skillPath(context, 'data/runtime-units.json'));
    check(catalog && eq(catalog.units.map((u) => u.target), RUNTIME_TARGETS), 'the shipped catalog lists the seven targets in catalog order (the premise of every row below)', catalog && catalog.units.map((u) => u.target));
    check(sha(readBytes(skillPath(context, 'data/runtime-units.json')) || Buffer.alloc(0)) === RUNTIME_CATALOG_SHA, 'the runtime catalog bytes are unchanged by C10');
    await withScratch(context, 'r79u', async (dir) => {
      let n = 0;
      const go = async (label, files, want, runOpts = {}, mod = validate) => {
        const root = mkProject(dir, `u${++n}`, files);
        const run = await runValidate(mod, root, runOpts);
        if (!expectReport(check, label, run, { exit: want.exit, evidence: want.evidence, launches: want.launches })) return { run, root };
        if (want.units) {
          check(eq(unitRows(run.report), want.units), `${label}: the runtime-unit rows are exact and in catalog order, one per target`, firstDiff(unitRows(run.report), want.units));
          if (want.units.length === RUNTIME_TARGETS.length) check(eq(unitRows(run.report).map((r) => r.detail.split(':')[0]), RUNTIME_TARGETS), `${label}: one row for each catalog target in catalog order`);
        }
        if (want.hook) check(eq(hookRow(run), [want.hook]), `${label}: the hook row`, hookRow(run));
        return { run, root };
      };
      const allPass = RUNTIME_TARGETS.map(UNIT_PASS);
      await step('every catalog target (review-diff included) is checked by presence only: bytes need not equal the shipped bytes, no target is executed except through the self-test, the rows are in catalog order', async () => {
        const { run } = await go('all seven present', unitFiles(context, { present: RUNTIME_MEMBERS }), { exit: 0, evidence: 'passed', launches: 1, units: allPass, hook: ROW.hookPass });
        check(run && run.calls.length === 1, 'no catalog target is executed (only the installed self-test launches)', run && run.calls.length);
        await go('none present, shipped schema-1 policy', unitFiles(context, {}), { exit: 0, evidence: 'not-run', launches: 0, units: RUNTIME_TARGETS.map(UNIT_INFO), hook: ROW.hookNone });
        await go('some present, shipped schema-1 policy', unitFiles(context, { present: ['security-policy.mjs', 'git-safe-core.mjs'] }), { exit: 0, units: [UNIT_PASS(RUNTIME_TARGETS[0]), UNIT_PASS(RUNTIME_TARGETS[1]), ...RUNTIME_TARGETS.slice(2).map(UNIT_INFO)] });
        // The unchanged R10/R30 stub fixture of plan 4.9: the shipped schema-1 policy, a stub git-safe and a legacy hook that is not the raw-Git hook: one runtime pass, six update infos, the no-installation info, exit 0.
        const legacy = { '.gitignore': GITIGNORE, '.ai/agents/reviewer.md': '# reviewer\n', '.ai/security-paths.json': s.text, '.ai/tools/git-safe.mjs': '// x\n', '.claude/settings.json': jsonText({ permissions: { deny: ['Read(**/.env)'] }, hooks: { PostToolUse: [{ matcher: 'Write', command: 'x' }] } }) };
        const stub = await go('the R10/R30 unchanged stub fixture (legacy hook)', legacy, { exit: 0, evidence: 'not-run', launches: 0, hook: ROW.hookNone, units: RUNTIME_TARGETS.map((t) => (t.endsWith('/git-safe.mjs') ? UNIT_PASS(t) : UNIT_INFO(t))) });
        check(stub.run.report && levelCount(unitRows(stub.run.report), 'pass') === 1 && levelCount(unitRows(stub.run.report), 'info') === 6, 'one runtime pass and six update infos', unitRows(stub.run.report).map((r) => r.level));
      });
      await step('missing members under installed policy source schema 2 fail; under source schema 1 or an absent policy they are needs-update info (a schema-1 policy adapted in memory stays info)', async () => {
        const a = await go('schema-2 policy, no runtime member (the plan literal)', unitFiles(context, { policy: 'schema2' }), { exit: 1, evidence: 'not-run', launches: 0, units: RUNTIME_TARGETS.map(UNIT_MISSING_SCHEMA2), hook: ROW.hookNone });
        if (a.run.report) {
          check(levelCount(a.run.report.results, 'fail') === 7, 'exactly seven fail rows in the complete report', levelCount(a.run.report.results, 'fail'));
          const want = [ROW.policyPass, SECRET_SHAPED(0), ...RUNTIME_TARGETS.map(UNIT_MISSING_SCHEMA2), ROW.baselineUnknown, ROW.snippetMissing, ROW.allowLocal, ROW.hookNone];
          check(eq(a.run.report.results, want) && eq(a.run.report.summary, { pass: 2, warn: 0, fail: 7 }), 'the complete row list and its literal summary are exact', firstDiff(a.run.report.results, want));
        }
        const missing = 'review-diff.mjs';
        await go('schema-2 policy, one member missing', unitFiles(context, { policy: 'schema2', present: RUNTIME_MEMBERS.filter((m) => m !== missing) }), {
          exit: 1, evidence: 'passed', launches: 1, hook: ROW.hookPass, units: RUNTIME_TARGETS.map((t) => (t.endsWith(missing) ? UNIT_MISSING_SCHEMA2(t) : UNIT_PASS(t))),
        });
        await go('absent policy, no runtime member', unitFiles(context, { policy: 'absent', agents: false, present: [] }), { exit: 0, evidence: 'not-run' });
      });
      await step('a member recorded as installed in a valid manifest and missing fails whatever the policy schema (recorded wins over the schema-2 message); the existing drift warn precedes the runtime-unit fail', async () => {
        const target = '.ai/tools/review-diff.mjs';
        const present = RUNTIME_MEMBERS.filter((m) => m !== 'review-diff.mjs');
        for (const policy of ['schema1', 'schema2']) {
          const { run } = await go(`${policy} policy, recorded member missing`, unitFiles(context, { policy, present, recorded: ['review-diff.mjs'] }), {
            exit: 1, evidence: 'passed', launches: 1, hook: ROW.hookPass, units: RUNTIME_TARGETS.map((t) => (t === target ? UNIT_MISSING_RECORDED(t) : UNIT_PASS(t))),
          });
          if (run.report) {
            expectRows(check, `${policy} recorded`, run, ['drift'], [DRIFT_MISSING(target)]);
            const ix = (c) => run.report.results.findIndex((r) => r.check === c);
            check(ix('drift') < ix('runtime-unit'), `${policy} recorded: the drift warn precedes the runtime-unit rows`);
            check(levelCount(run.report.results, 'fail') === 1, `${policy} recorded: exactly one fail`);
          }
        }
        const first = await go('absent policy, the manifest records security-policy.mjs (the catalog is active through the record)', { '.gitignore': GITIGNORE, '.ai/manifest.json': jsonText(manifestOf({ '.ai/tools/security-policy.mjs': fullRec(dummyOf('security-policy.mjs')) })) }, {
          exit: 1, units: [UNIT_MISSING_RECORDED(RUNTIME_TARGETS[0]), ...RUNTIME_TARGETS.slice(1).map(UNIT_INFO)],
        });
        void first;
        const files = await freshFiles(context, { omit: ['.ai/tools/review-diff.mjs'] });
        const { run } = await go('plan 6.3: a fresh schema-1 installation with review-diff.mjs deleted and its record preserved', files, { exit: 1, evidence: 'passed', launches: 1, hook: ROW.hookPass });
        if (run.report) {
          const want = [DRIFT_MISSING(target), UNIT_PASS(RUNTIME_TARGETS[0]), UNIT_PASS(RUNTIME_TARGETS[1]), UNIT_PASS(RUNTIME_TARGETS[2]), UNIT_MISSING_RECORDED(target), UNIT_PASS(RUNTIME_TARGETS[4]), UNIT_PASS(RUNTIME_TARGETS[5]), UNIT_PASS(RUNTIME_TARGETS[6])];
          check(eq(rowsOf(run.report, 'drift', 'runtime-unit'), want), 'the drift and runtime-unit rows are exactly the literal list of the plan', firstDiff(rowsOf(run.report, 'drift', 'runtime-unit'), want));
          check(levelCount(run.report.results, 'fail') === 1, 'exactly one fail in the complete report');
        }
      });
      await step('a missing git-safe keeps its fixed security-tooling failure beside its catalog row (info under schema 1); the failure precedes the catalog rows', async () => {
        const { run } = await go('.ai/agents and a schema-1 policy, no tools', unitFiles(context, { agents: true }), { exit: 1, units: RUNTIME_TARGETS.map(UNIT_INFO) });
        if (run.report) {
          check(eq(rowsOf(run.report, 'security-tooling'), [ROW.gitSafeMissing]), 'the retained security-tooling failure', rowsOf(run.report, 'security-tooling'));
          check(run.report.results.findIndex((r) => r.check === 'security-tooling') < run.report.results.findIndex((r) => r.check === 'runtime-unit'), 'security-tooling precedes the runtime-unit rows');
        }
      });
      await step('protected, unsafe and unreadable members fail independently of policy age; per-target precedence is unsafe, protected, missing, unreadable, pass', async () => {
        const base = RUNTIME_MEMBERS;
        await go('a protected member', unitFiles(context, { present: base, policy: 'protect:.ai/tools/git-safe-core.mjs' }), { exit: 1, units: RUNTIME_TARGETS.map((t) => (t.endsWith('git-safe-core.mjs') ? UNIT_PROTECTED(t) : UNIT_PASS(t))), hook: ROW.hookPass, evidence: 'passed', launches: 1 });
        await go('a protected member that is also missing is protected', unitFiles(context, { present: base.filter((m) => m !== 'review-diff.mjs'), policy: 'protect:.ai/tools/review-diff.mjs' }), { exit: 1, units: RUNTIME_TARGETS.map((t) => (t.endsWith('review-diff.mjs') ? UNIT_PROTECTED(t) : UNIT_PASS(t))) });
        const dirCase = unitFiles(context, { present: base.filter((m) => m !== 'git-safe.mjs') });
        dirCase['.ai/tools/git-safe.mjs/placeholder.txt'] = 'a directory in place of a member\n';
        await go('a directory in place of a member is unsafe', dirCase, { exit: 1, units: RUNTIME_TARGETS.map((t) => (t.endsWith('/git-safe.mjs') ? UNIT_UNSAFE(t) : UNIT_PASS(t))) });
        const rootU = mkProject(dir, `u${++n}`, unitFiles(context, { present: [] }));
        const ext = path.join(dir, `u${n}-ext`);
        for (const m of base) putFile(path.join(ext, m), HOOK_MEMBERS.includes(m) ? s.tools[m] : dummyOf(m));
        if (!linkDir(ext, path.join(rootU, '.ai', 'tools'))) check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'}`);
        else {
          const linked = await runValidate(validate, rootU, { files: ['.gitignore', '.ai/security-paths.json'] });
          if (expectReport(check, 'a junctioned .ai/tools', linked, { exit: 1 })) check(eq(unitRows(linked.report), RUNTIME_TARGETS.map(UNIT_UNSAFE)), 'a junctioned .ai/tools: every member is unsafe, none is read through the link', unitRows(linked.report));
        }
        const rootR = mkProject(dir, `u${++n}`, unitFiles(context, { present: base }));
        const unreadable = await runValidate(validate, rootR, { inject: [{ ops: ['readFileSync', 'openSync'], paths: [path.join(rootR, '.ai', 'tools', 'security-policy.mjs')], code: 'EACCES' }] });
        if (expectReport(check, 'an unreadable member', unreadable, { exit: 1 })) check(eq(unitRows(unreadable.report), RUNTIME_TARGETS.map((t) => (t.endsWith('/security-policy.mjs') ? UNIT_UNREADABLE(t) : UNIT_PASS(t)))), 'an unreadable member: the could-not-be-read row, the others pass', unitRows(unreadable.report));
      });
      await step('the catalog activation rules: .ai/agents, an installed policy, .ai/tools or a manifest record each activate the rows; with none of them there is no runtime row; a policy failure emits none', async () => {
        const noneRun = await runValidate(validate, mkProject(dir, `u${++n}`, { '.gitignore': GITIGNORE, '.ai/manifest.json': jsonText(manifestOf({ 'docs/other.md': { ownership: 'merged' } })), 'docs/other.md': '# o\n' }), {});
        if (expectReport(check, 'inactive catalog', noneRun, { exit: 0 })) check(unitRows(noneRun.report).length === 0 && rowsOf(noneRun.report, 'runtime-catalog').length === 0, 'no runtime-target row when no activation condition holds', unitRows(noneRun.report));
        const rootT = mkProject(dir, `u${++n}`, { '.gitignore': GITIGNORE });
        fs.mkdirSync(path.join(rootT, '.ai', 'tools'), { recursive: true });
        const t = await runValidate(validate, rootT, { files: ['.gitignore'] });
        if (expectReport(check, 'an existing .ai/tools directory', t, { exit: 0 })) check(eq(unitRows(t.report), RUNTIME_TARGETS.map(UNIT_INFO)), 'an existing .ai/tools directory activates the catalog (absent policy: needs-update info)', unitRows(t.report));
        const rootA = mkProject(dir, `u${++n}`, { '.gitignore': GITIGNORE });
        fs.mkdirSync(path.join(rootA, '.ai', 'agents'), { recursive: true });
        const a = await runValidate(validate, rootA, { files: ['.gitignore'] });
        if (expectReport(check, 'an existing .ai/agents directory', a, { exit: 1 })) check(eq(unitRows(a.report), RUNTIME_TARGETS.map(UNIT_INFO)), 'an existing .ai/agents directory activates the catalog', unitRows(a.report));
        const failed = await go('a policy failure', { '.gitignore': GITIGNORE, '.ai/security-paths.json': jsonText({ schema: 99, patterns: [] }), '.ai/manifest.json': jsonText(manifestOf({})) }, { exit: 1, evidence: 'not-run', launches: 0, hook: ROW.hookInvalidInput });
        check(failed.run.report && unitRows(failed.run.report).length === 0 && rowsOf(failed.run.report, 'runtime-catalog').length === 0, 'no runtime-unit and no runtime-catalog row after an installed-policy failure');
        // Plan 6.3 literal policy-failure case (with C10-P3-2): the literal manifest passes, the exact policy-schema failure, no runtime row, the two allow rows, the invalid-input hook info. PLAN-GAP: the hygiene
        // rows of a .gitignore that deny-all protects are not pinned, so rows with the check name "gitignore" are left out of the comparison.
        if (failed.run.report) {
          const rows = failed.run.report.results.filter((r) => r.check !== 'gitignore');
          const want = [ROW.manifestPass, POLICY_SCHEMA99, SECRET_SHAPED(0), allowInput(ALLOW_INPUT.protected), ROW.allowLocal, ROW.hookInvalidInput];
          check(eq(rows, want), 'the complete policy-failure report (the plan literal) is exact', firstDiff(rows, want));
          check(failed.run.report.runtimeEvidence.hookSelfTest === 'not-run' && rowsOf(failed.run.report, 'validation-protected').length === 0, 'hookSelfTest not-run and no validation-protected row for the manifest');
        }
      });
      await step('an invalid runtime catalog (missing file, invalid JSON, wrong schema, a required unit removed) is the one runtime-catalog failure row and no target row; the hook activation stays independent', async () => {
        const variants = [
          ['invalid JSON', (root) => fs.writeFileSync(path.join(root, 'data', 'runtime-units.json'), '{ not json')],
          ['a missing file', (root) => fs.rmSync(path.join(root, 'data', 'runtime-units.json'))],
          ['an unsupported schema', (root) => fs.writeFileSync(path.join(root, 'data', 'runtime-units.json'), jsonText({ schema: 2, units: catalog.units }))],
          ['the git-safe unit removed', (root) => fs.writeFileSync(path.join(root, 'data', 'runtime-units.json'), jsonText({ schema: 1, units: catalog.units.filter((u) => u.role !== 'entrypoint' || !u.target.endsWith('/git-safe.mjs')) }))],
        ];
        for (const [label, edit] of variants) {
          const root = await makeSkillCopy(context, dir, `skill${++n}`);
          edit(root);
          const mod = await importOrFail(failures, pathToFileURL(path.join(root, 'scripts', 'validate.mjs')).href, `the scratch skill copy (${label})`);
          if (!mod) continue;
          const { run } = await go(`catalog ${label}`, unitFiles(context, { present: RUNTIME_MEMBERS }), { exit: 1, evidence: 'passed', launches: 1, hook: ROW.hookPass }, {}, mod);
          if (run.report) {
            check(eq(rowsOf(run.report, 'runtime-catalog', 'runtime-unit'), [ROW.catalogBad]), `catalog ${label}: exactly the one runtime-catalog failure and no target row`, rowsOf(run.report, 'runtime-catalog', 'runtime-unit'));
          }
        }
      });
    });
  });
}

// ===================================================== V2/C10/schema2 ====
// Plan 4.4: a valid schema-2 manifest passes, is followed immediately by the needs-update info row (outside every total), keeps the policy and allow rows applicable and is not a failure by itself; a malformed schema 2 gets none.
async function schema2Group(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const validate = await needValidate(failures, context);
    if (!validate) return;
    const s = shipped(context);
    await withScratch(context, 'v2s2', async (dir) => {
      await step('a valid schema-2 manifest: pass then the needs-update info directly after it; the complete literal row list, summary and exit 0; policy and runtime rows applicable; the hook row is the schema-2 info', async () => {
        const files = { '.gitignore': GITIGNORE, '.ai/security-paths.json': s.text, '.ai/manifest.json': jsonText(manifest2Of({})) };
        const run = await runValidate(validate, mkProject(dir, 'a', files), {});
        if (!expectReport(check, 'schema 2', run, { exit: 0, evidence: 'not-run', launches: 0 })) return;
        const want = [ROW.manifestPass, ROW.manifestV2, ROW.policyPass, SECRET_SHAPED(0), ...RUNTIME_TARGETS.map(UNIT_INFO), ROW.baselineUnknown, ROW.snippetMissing, ROW.allowLocal, ROW.hookSchema2];
        check(eq(run.report.results, want), 'the complete results are exactly the literal list', firstDiff(run.report.results, want));
        check(eq(run.report.summary, { pass: 3, warn: 0, fail: 0 }), 'the summary counts the three pass rows; the info rows are outside every total', run.report.summary);
        const i = run.report.results.findIndex((r) => eq(r, ROW.manifestPass));
        check(i >= 0 && eq(run.report.results[i + 1], ROW.manifestV2), 'the info row is immediately after the manifest pass');
      });
      await step('schema 2 keeps C3 policy inspection and C7 allow warnings applicable: a user allow warns, a managed broad allow fails, needing an update alone is not a failure', async () => {
        const files = { '.gitignore': GITIGNORE, '.claude/settings.json': jsonText({ permissions: { allow: ['Bash(npm test)'] } }), '.ai/security-paths.json': s.text, '.ai/manifest.json': jsonText(manifest2Of({})) };
        const run = await runValidate(validate, mkProject(dir, 'b', files), {});
        if (!expectReport(check, 'schema 2 with an allow', run, { exit: 0 })) return;
        const want = [ROW.settingsPass, ROW.manifestPass, ROW.manifestV2, ROW.policyPass, SECRET_SHAPED(0), ...RUNTIME_TARGETS.map(UNIT_INFO), ROW.baselineUnknown, ROW.snippetMissing, { level: 'warn', check: 'allow-repo-code', detail: REPO_ALLOW('Bash(npm test)', 'user') }, ROW.allowLocal, ROW.hookSchema2];
        check(eq(run.report.results, want), 'the complete results are exactly the literal list', firstDiff(run.report.results, want));
        check(eq(run.report.summary, { pass: 4, warn: 1, fail: 0 }), 'the literal summary', run.report.summary);
      });
      await step('a malformed schema-2 manifest never gets the needs-update row, the manifest pass or any ownership inspection; exit 1', async () => {
        for (const [label, value, issue] of [['a numeric skillVersion', manifest2Of({}, { skillVersion: 9 }), 'skillVersion must be a string'], ['a numeric mode', manifest2Of({}, { mode: 5 }), 'mode must be a string'], ['a bad record', manifest2Of({ 'docs/x.md': { ownership: 'bogus' } }), 'files["docs/x.md"].ownership is invalid: bogus']]) {
          const files = { '.gitignore': GITIGNORE, '.ai/security-paths.json': s.text, '.ai/manifest.json': jsonText(value) };
          const run = await runValidate(validate, mkProject(dir, `m${label.length}`, files), {});
          if (!expectReport(check, label, run, { exit: 1 })) continue;
          expectRows(check, label, run, ['json-schema', 'manifest-version'], [manifestFail(issue)]);
          check(eq(rowsOf(run.report, 'policy-schema'), [ROW.policyPass]) && rowsOf(run.report, ...POLICY_STATE_CHECKS).length === 0, `${label}: the policy still validates, its state is not inspected against an untrusted manifest`, rowsOf(run.report, 'policy-schema', ...POLICY_STATE_CHECKS));
          check(eq(hookRow(run), [ROW.hookInvalidInput]), `${label}: the invalid-input hook info`, hookRow(run));
        }
      });
      await step('a schema-3 manifest never has the needs-update row; a schema-2 manifest read through the same path keeps the pass row exactly once', async () => {
        const run = await runValidate(validate, mkProject(dir, 'c', await freshFiles(context)), {});
        if (expectReport(check, 'schema 3', run, { exit: 0 })) check(rowsOf(run.report, 'manifest-version').length === 0, 'no manifest-version row for schema 3');
      });
    });
  });
}

// ================================================ detect CLI helpers ====
// Node -r preloads (plan 5.1 and 5.3, following the C3 makeGuard and C5 preload patterns): a read watcher that logs every body read or listing of watched paths, and a readdir stub for the run-id alias matrix. Nothing patches a
// production function; a preload in the test's temporary directory is the only seam, and built-in ESM exports are synchronized after the wrappers are installed.
const WATCH_SOURCE = [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  "const { syncBuiltinESMExports } = require('module');",
  "const cfg = JSON.parse(process.env.C10_WATCH || '{}');",
  "const WIN = process.platform === 'win32';",
  "const fold = (s) => (WIN ? s.toLowerCase() : s);",
  "const realOf = (p) => { try { return fs.realpathSync.native(path.resolve(p)); } catch (e) { return path.resolve(p); } };",
  "const files = new Set((cfg.files || []).flatMap((f) => [fold(path.resolve(f)), fold(realOf(f))]));",
  "const dirs = (cfg.dirs || []).flatMap((f) => [fold(path.resolve(f)), fold(realOf(f))]);",
  "const append = fs.appendFileSync;",
  "let busy = false;",
  "const hit = (op, p) => { if (busy || typeof p !== 'string') return; busy = true; try { const a = fold(path.resolve(p)); const r = fold(realOf(p)); const under = (x) => dirs.some((d) => x === d || x.startsWith(d + path.sep)); if (files.has(a) || files.has(r) || under(a) || under(r)) append(cfg.log, JSON.stringify({ op, path: p }) + '\\n'); } catch (e) { /* ignore */ } finally { busy = false; } };",
  "for (const n of ['readFileSync', 'openSync', 'createReadStream', 'readdirSync', 'opendirSync']) { const o = fs[n]; if (typeof o === 'function') fs[n] = function (p) { hit(n, p); return o.apply(this, arguments); }; }",
  "for (const n of ['readFile', 'open', 'readdir', 'opendir']) { const o = fs.promises[n]; if (typeof o === 'function') fs.promises[n] = function (p) { hit('promises.' + n, p); return o.apply(this, arguments); }; }",
  'syncBuiltinESMExports();',
].join('\n') + '\n';
const STUB_SOURCE = [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  "const { syncBuiltinESMExports } = require('module');",
  "const WIN = process.platform === 'win32';",
  "const fold = (s) => (WIN ? s.toLowerCase() : s);",
  "const canon = (p) => { let r; try { r = fs.realpathSync.native(p); } catch (e) { r = path.resolve(p); } return fold(path.resolve(r)); };",
  "const target = canon(process.env.C10_RUN_DIR);",
  "const listing = JSON.parse(process.env.C10_RUN_LISTING);",
  "const orig = fs.readdirSync;",
  "fs.readdirSync = function (p) { try { if (typeof p === 'string' && canon(p) === target) return listing.slice(); } catch (e) { /* fall through to the real function */ } return orig.apply(this, arguments); };",
  'syncBuiltinESMExports();',
].join('\n') + '\n';
function runDetect(context, root, { watch = null, stub = null } = {}) {
  const dir = path.dirname(root);
  const args = [];
  const env = { ...context.env };
  const log = path.join(dir, `watch-${path.basename(root)}.jsonl`);
  if (watch) {
    const pre = path.join(dir, `watch-${path.basename(root)}.cjs`);
    fs.writeFileSync(pre, WATCH_SOURCE);
    fs.writeFileSync(log, '');
    env.C10_WATCH = JSON.stringify({ log, files: watch.files || [], dirs: watch.dirs || [] });
    args.push('-r', pre);
  }
  if (stub) {
    const pre = path.join(dir, `stub-${path.basename(root)}.cjs`);
    fs.writeFileSync(pre, STUB_SOURCE);
    env.C10_RUN_DIR = stub.runDir;
    env.C10_RUN_LISTING = JSON.stringify(stub.listing);
    args.push('-r', pre);
  }
  args.push(path.join(context.skillRoot, 'scripts', 'detect.mjs'));
  const r = spawnNode(context, args, { cwd: root, env });
  let json = null; try { json = JSON.parse(r.stdout); } catch { json = null; }
  const hits = watch ? String(readText(log) || '').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '', json, hits };
}

// =============================================== V2/C10/discovery ====
// Plan 5.1: detect names only, and exactly the root `.env.example` is the template; the other four names stay protected tracked paths in Git inventory order; the two replacement warnings keep their positions; no body is read.
async function discoveryGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mark = processMark(context);
    await step('five template-like names: envTemplates is exactly the root template, the other four are tracked protected paths in Git order, the two exact warnings replace the old ones, no body is opened, C7 output is unaffected', async () => {
      await withScratch(context, 'disc', async (dir) => {
        const root = path.join(dir, 'repo');
        if (!initRepo(context, root)) { check(false, 'git init succeeded'); return; }
        const names = ['.env.example', '.env.sample', '.env.template', 'nested/.env.example', 'nested/.env.sample'];
        names.forEach((n, i) => putFile(path.join(root, ...n.split('/')), `C10_TEMPLATE_BODY_MARKER_${i}=value-${i}\n`));
        putFile(path.join(root, 'src', 'a.ts'), 'export {}\n');
        gitIn(context, root, ['add', '-A']);
        const realRoot = fs.realpathSync.native(root);
        const r = runDetect(context, realRoot, { watch: { files: names.map((n) => path.join(realRoot, ...n.split('/'))) } });
        check(r.code === 0 && r.json && r.json.ok === true, 'detect exits 0 with JSON', { code: r.code, out: r.stdout.slice(0, 200), err: r.stderr.slice(0, 200) });
        const j = r.json || {};
        check(eq(j.secrets && j.secrets.envTemplates, ['.env.example']), 'envTemplates is exactly the root .env.example', j.secrets && j.secrets.envTemplates);
        check(eq(j.secrets && j.secrets.trackedSecretPaths, ['.env.sample', '.env.template', 'nested/.env.example', 'nested/.env.sample']), 'the other four are tracked protected paths in Git inventory order', j.secrets && j.secrets.trackedSecretPaths);
        const w = Array.isArray(j.warnings) ? j.warnings : [];
        check(w.includes(WARN_TRACKED) && w.includes(WARN_TEMPLATE), 'both exact replacement warnings are present', w);
        check(!w.includes(OLD_WARN_TRACKED) && !w.includes(OLD_WARN_TEMPLATE) && !w.some((x) => /^env templates present/.test(x)), 'the two old warnings are gone', w);
        check(w.indexOf(WARN_TRACKED) >= 0 && w.indexOf(WARN_TRACKED) < w.indexOf(WARN_TEMPLATE), 'the tracked-secret warning keeps its position before the template warning', w);
        check(!w.some((x) => x.includes('.env') && x !== WARN_TRACKED), 'the invocation-bearing template warning contains no environment filename', w.filter((x) => x.includes('.env')));
        check(r.hits.length === 0 && !r.stdout.includes('C10_TEMPLATE_BODY_MARKER'), 'no template body is read or printed (the read watcher saw nothing)', r.hits.slice(0, 3));
        check(j.claude && Object.keys(j.claude).pop() === 'allows' && j.claude.allows && j.claude.allows.results.some((x) => eq(x, ROW.allowLocal)), 'C7 output is unaffected: claude.allows keeps its final position and the personal-settings row', j.claude && Object.keys(j.claude));
      });
    });
    await step('a root template alone is a template and not a tracked secret; the warning text for it is the exact invocation-bearing one', async () => {
      await withScratch(context, 'disc2', async (dir) => {
        const root = path.join(dir, 'repo');
        if (!initRepo(context, root)) { check(false, 'git init succeeded'); return; }
        putFile(path.join(root, '.env.example'), 'C10_TEMPLATE_BODY_MARKER_ROOT=1\n');
        putFile(path.join(root, 'src', 'a.ts'), 'export {}\n');
        gitIn(context, root, ['add', '-A']);
        const realRoot = fs.realpathSync.native(root);
        const r = runDetect(context, realRoot, { watch: { files: [path.join(realRoot, '.env.example')] } });
        const j = r.json || {};
        check(r.code === 0 && eq(j.secrets && j.secrets.envTemplates, ['.env.example']) && eq(j.secrets && j.secrets.trackedSecretPaths, []), 'only the root template: envTemplates [root template], no tracked secret path', j.secrets);
        check((j.warnings || []).includes(WARN_TEMPLATE) && !(j.warnings || []).includes(WARN_TRACKED), 'the template warning without the tracked-secret warning', j.warnings);
        check(r.hits.length === 0, 'the template body is not read', r.hits.slice(0, 3));
      });
    });
    flushProcessCount(context, 'V2/C10/discovery', mark);
  });
}

// ============================================ V2/C10/run-inventory ====
// Plan 5.3 and C10-P3-1: discovery excludes the reserved review-artifact directory and every alias (any case, trailing dots and spaces) through validateRunId's RUN_ID_RESERVED, preserves every other name and the listing order,
// and never reads the contents of an excluded directory. The alias matrix runs through a readdir stub matched by canonical (native realpath, case-folded) path; a real fixture holds run-0001 and review.
async function runInventoryGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mark = processMark(context);
    await step('a real fixture with run-0001 and review reports exactly ["run-0001"] and never reads, lists or opens anything inside review', async () => {
      await withScratch(context, 'runs', async (dir) => {
        const root = path.join(dir, 'repo');
        if (!initRepo(context, root)) { check(false, 'git init succeeded'); return; }
        putFile(path.join(root, '.ai', '.run', 'run-0001', 'plan.json'), '{}\n');
        putFile(path.join(root, '.ai', '.run', 'review', 'sentinel.txt'), 'C10_REVIEW_SENTINEL_MARKER\n');
        putFile(path.join(root, 'src', 'a.ts'), 'export {}\n');
        const realRoot = fs.realpathSync.native(root);
        const reviewDir = path.join(realRoot, '.ai', '.run', 'review');
        const r = runDetect(context, realRoot, { watch: { dirs: [reviewDir] } });
        check(r.code === 0 && r.json && eq(r.json.ai && r.json.ai.runs, ['run-0001']), 'ai.runs is exactly ["run-0001"]', r.json && r.json.ai && r.json.ai.runs);
        check(r.hits.length === 0 && !r.stdout.includes('C10_REVIEW_SENTINEL_MARKER'), 'nothing inside review is read, opened or listed', r.hits.slice(0, 3));
      });
    });
    await step('the ordered alias listing run-0001, review, REVIEW, Review, review., "review ", "review. .", review..., review-1, abc reports exactly ["run-0001","review-1","abc"] (ordinary invalid names are kept, order preserved)', async () => {
      await withScratch(context, 'alias', async (dir) => {
        const root = path.join(dir, 'repo');
        if (!initRepo(context, root)) { check(false, 'git init succeeded'); return; }
        fs.mkdirSync(path.join(root, '.ai', '.run'), { recursive: true });
        putFile(path.join(root, 'src', 'a.ts'), 'export {}\n');
        const realRoot = fs.realpathSync.native(root);
        const r = runDetect(context, realRoot, { stub: { runDir: path.join(realRoot, '.ai', '.run'), listing: RESERVED_LISTING } });
        check(r.code === 0 && r.json && eq(r.json.ai && r.json.ai.runs, RESERVED_EXPECTED), 'ai.runs is exactly the reserved-filtered listing', r.json && r.json.ai && r.json.ai.runs);
        check(r.json && r.json.ai && r.json.ai.runs.length === 3, 'control: the stub supplied the ten-name listing (three names survive)');
      });
    });
    flushProcessCount(context, 'V2/C10/run-inventory', mark);
  });
}

// ====================================================== documents ====
// Plan 5.2: whitespace-normalized paragraphs within the named sections, except the explicit exact-line and exact-block checks.
function loadDoc(check, context, rel) {
  const raw = readText(skillPath(context, rel));
  if (raw === null) { check(false, `${rel} is readable`); return null; }
  return raw.replace(/\r\n?/g, '\n');
}
function headingList(doc) {
  const lines = doc.split('\n');
  const out = [];
  let fence = null;
  lines.forEach((l, i) => {
    const f = /^\s*(`{3,}|~{3,})/.exec(l);
    if (f) { if (fence === null) fence = f[1][0]; else if (f[1][0] === fence) fence = null; return; }
    if (fence !== null) return;
    const m = /^(#{1,6})\s+\S/.exec(l);
    if (m) out.push({ line: l.replace(/\s+$/, ''), level: m[1].length, at: i });
  });
  return out;
}
function sectionOf(doc, match) {
  const hs = headingList(doc);
  const i = hs.findIndex((h) => (typeof match === 'string' ? h.line === match : match.test(h.line)));
  if (i < 0) return null;
  const lines = doc.split('\n');
  let end = lines.length;
  for (let j = i + 1; j < hs.length; j++) if (hs[j].level <= hs[i].level) { end = hs[j].at; break; }
  return lines.slice(hs[i].at + 1, end).join('\n');
}
const has = (text, p) => text !== null && text !== undefined && squash(text).includes(squash(p));
const blocksOf = (text) => text.split(/\n[ \t]*\n/).map((b) => b.trim()).filter(Boolean);
const DOC_TEXT = {
  validateRow: '| `validate.mjs` | Static setup checks and installed hook self-test; exit 1 on any failure |',
  doctorRow: '| `doctor.mjs` | Audit lane configuration and local diagnostics without a model session or sandbox probe |',
  phase3a: 'Validation uses the installed policy baseline and shared ownership schemas. Schema 2 reports needs update. The installed hook self-test proves direct script behavior only; Claude hook loading remains not verified.',
  phase3b: 'Run validation in a trusted checkout because the installed hook self-test executes project code.',
  phase3c: 'After migration, a schema-2 policy content change in a project with catalog tools, including a projectPatterns addition, still goes through migrate-security-paths.mjs and security-decisions.json. Validation reports project patterns and stale snippets; it does not bypass that reviewed migration workflow.',
  phase4: 'Run doctor.mjs only with the worker\'s effective lane options. Its configuration and diagnostic results do not verify connector-tool absence or sandbox enforcement.',
  doctorAvailable: 'The doctor is available as scripts/doctor.mjs. It audits these prerequisites without starting a model session or sandbox probe. See references/security.md, Doctor diagnostics, for its command and result scope. An unresolved prerequisite means the lane is not ready.',
  futureDoctor: 'The planned doctor audits these prerequisites without starting a model session or sandbox probe. Until the doctor component lands, this paragraph describes its required scope, not an available command.',
  sec6a: 'The doctor runs only codex mcp list --json with validated lane options, reads the newest permitted sandbox log and inventories Windows processes. It never starts a model session or sandbox probe, reads authentication or sandbox-secret files, kills processes or changes sandbox mode.',
  sec6b: 'Supply only configuration-defined server names. The external launcher owns enumeration and must use the same directory, profile, configuration and disable options for the worker. An enabled server, failed command, invalid output or unresolved prerequisite means not ready.',
  sec6c: 'Exit 0 means the supplied configuration and available diagnostics passed these checks. It does not establish host negative capability. An absent or unreadable log and an unavailable Windows process inventory remain unknown and produce exit 1.',
  sec6d: 'A clean log means no recognized setup-refresh error was found in the newest readable log. It is historical diagnostic evidence, not a successful sandbox measurement.',
  sec6e: 'The report includes the selected log\'s modification time. An error in that log remains a failure until newer evidence is available. Resolve the underlying problem before retrying; the doctor does not delete logs or run a probe to create new evidence.',
  sec5: 'Keep static validation, direct installed-hook results, doctor diagnostics and live host evidence separate. Neither a passing self-test nor a ready doctor verifies Claude hook loading, connector-tool absence or sandbox enforcement.',
};
const DOCTOR_COMMAND = 'node <SKILL_DIR>/scripts/doctor.mjs --disable apps --disable plugins ' + '-c mcp_servers.node_repl.enabled=false -p review -C <project-root>';
const REPORT_BLOCK = [
  '### Validation (validate.mjs)', 'pass N / warn N / fail N; list every warn/fail and needs-update info.', 'Static setup results: <summary>.', 'Installed hook self-test: <passed / failed / not-run>.',
  'Claude hook loading: <verified with scoped evidence / not verified>.', '', '### Doctor diagnostics', 'Configuration and diagnostics: <ready / not ready / not run>.',
  'Connector-tool absence and sandbox enforcement: <separate host evidence / not verified>.', '', '',
].join('\n');
function documentationChecks(check, context) {
  const skill = loadDoc(check, context, 'SKILL.md');
  const readme = loadDoc(check, context, 'README.md');
  const codex = loadDoc(check, context, 'references/codex.md');
  const security = loadDoc(check, context, 'references/security.md');
  const report = loadDoc(check, context, 'references/report.md');
  if (skill !== null) {
    const scripts = sectionOf(skill, '## Scripts');
    check(scripts !== null && scripts.split('\n').map((l) => l.replace(/\s+$/, '')).includes(DOC_TEXT.validateRow), 'SKILL.md Scripts table: the exact validate.mjs row', DOC_TEXT.validateRow);
    // PLAN-GAP: the plan pins the doctor row's text but not its position in the table; any position passes.
    check(scripts !== null && scripts.split('\n').map((l) => l.replace(/\s+$/, '')).includes(DOC_TEXT.doctorRow), 'SKILL.md Scripts table: the exact doctor.mjs row', DOC_TEXT.doctorRow);
    check(scripts !== null && !scripts.includes('Static checks: JSON shape, TOML syntax, sizes, imports, references, markers, drift, secret-shaped content (exit 1 on any failure)'), 'SKILL.md Scripts table: the old validator row is replaced');
    const p3 = sectionOf(skill, /^### Phase 3\b/);
    check(p3 !== null, 'SKILL.md has the Phase 3 section');
    if (p3 !== null) {
      const flat = squash(p3);
      const at = (t) => flat.indexOf(squash(t));
      const step = flat.indexOf('`validate.mjs`');
      check(step >= 0 && at(DOC_TEXT.phase3a) > step && at(DOC_TEXT.phase3b) > at(DOC_TEXT.phase3a) && at(DOC_TEXT.phase3c) > at(DOC_TEXT.phase3b), 'SKILL.md Phase 3: after the validation step, the validation paragraph, then the trusted-checkout paragraph, then the migration-gate paragraph (PLAN-GAP: the exact position among the following steps is not pinned)', [step, at(DOC_TEXT.phase3a), at(DOC_TEXT.phase3b), at(DOC_TEXT.phase3c)]);
    }
    const p4 = sectionOf(skill, /^### Phase 4\b/);
    check(p4 !== null && has(p4, DOC_TEXT.phase4), 'SKILL.md Phase 4: the doctor-scope paragraph');
  }
  if (readme !== null) {
    const sec = sectionOf(readme, '## Review-lane launcher prerequisite');
    check(sec !== null && has(sec, DOC_TEXT.doctorAvailable) && !has(sec, DOC_TEXT.futureDoctor), 'README "## Review-lane launcher prerequisite": the available-doctor paragraph replaces the future-doctor paragraph');
  }
  if (codex !== null) {
    const sec = sectionOf(codex, '### Review-lane launcher prerequisite');
    check(sec !== null && has(sec, DOC_TEXT.doctorAvailable) && !has(sec, DOC_TEXT.futureDoctor), 'references/codex.md "### Review-lane launcher prerequisite": the available-doctor paragraph replaces the future-doctor paragraph');
  }
  if (security !== null) {
    const s5 = sectionOf(security, '## 5. Capability report');
    check(s5 !== null && has(s5, DOC_TEXT.sec5), 'references/security.md section 5: the evidence-separation sentence');
    const heads = headingList(security).map((h) => h.line);
    check(heads.indexOf('## 6. Doctor diagnostics') > heads.indexOf('## 5. Capability report') && heads.indexOf('## 5. Capability report') >= 0, 'references/security.md has "## 6. Doctor diagnostics" after section 5', heads.slice(-4));
    const s6 = sectionOf(security, '## 6. Doctor diagnostics');
    check(s6 !== null, 'references/security.md section 6 exists');
    if (s6 !== null) {
      const blocks = blocksOf(s6);
      const idx = (t) => blocks.findIndex((b) => squash(b).includes(squash(t)));
      const fenceAt = blocks.findIndex((b) => /^```/.test(b));
      const fence = fenceAt >= 0 ? blocks[fenceAt].split('\n') : [];
      check(fence.length === 3 && fence[0] === '```text' && fence[2] === '```' && fence[1] === DOCTOR_COMMAND, 'section 6: a text fenced block with exactly one line, the exact command bytes', fence);
      const order = [DOC_TEXT.sec6a, null, DOC_TEXT.sec6b, DOC_TEXT.sec6c, DOC_TEXT.sec6d, DOC_TEXT.sec6e].map((t) => (t === null ? fenceAt : idx(t)));
      check(order.every((x) => x >= 0) && order.every((x, i) => i === 0 || x > order[i - 1]), 'section 6: the paragraphs and the command fence come in the pinned order', order);
    }
  }
  if (report !== null) {
    const open = report.indexOf('\n```\n');
    const close = open >= 0 ? report.indexOf('\n```\n', open + 5) : -1;
    const fenced = open >= 0 && close > open ? report.slice(open + 5, close + 1) : '';
    check(fenced.includes(`${REPORT_BLOCK}### Capability report`), 'references/report.md: the exact validation and doctor block sits immediately before "### Capability report" inside the existing report fence');
    check(!report.includes(`pass N ${String.fromCharCode(0xb7)} warn N ${String.fromCharCode(0xb7)} fail N`), 'references/report.md: the old validation subsection is replaced');
  }
}

// ================================================ V2/C10/contracts ====
async function contractsGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mark = processMark(context);
    const validate = await needValidate(failures, context);
    const doctor = await needDoctor(failures, context);
    await step('plan 2.4: exact export sets and no default export (in process), import safety of validate.mjs (a probe process), and no top-level await in either module', async () => {
      if (validate) check(eq(Object.keys(validate).sort(), VALIDATE_EXPORTS) && !('default' in validate), 'scripts/validate.mjs exports exactly main', Object.keys(validate));
      if (doctor) check(eq(Object.keys(doctor).sort(), DOCTOR_EXPORTS) && !('default' in doctor), 'scripts/doctor.mjs exports exactly main and parseDoctorArgs', Object.keys(doctor));
      importProbe(check, 'validate.mjs', context, 'validate.mjs', VALIDATE_EXPORTS);
      for (const rel of ['scripts/validate.mjs', 'scripts/doctor.mjs']) {
        const text = readText(skillPath(context, rel));
        check(text !== null && !/^(?:await\s|for\s+await\s|(?:const|let|var)\s+[^=\n]*=\s*await\s)/m.test(text), `${rel}: no top-level await at module scope`);
      }
    });
    await step('plan 4.2: the RULES regex of validate.mjs stays byte-identical (C9 non-command occurrence control); doctor.mjs is not part of the policy-reader runtime unit or the catalog', async () => {
      const text = readText(skillPath(context, 'scripts/validate.mjs'));
      const line = "['assigned-secret', /\\b(password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\\b\\s*[:=]\\s*[\"']?(?!<|\\$\\{|process\\.env|REDACTED|changeme|your)[^\\s\"'`]{8,}/i],";
      check(text !== null && text.includes(line), 'the assigned-secret RULES line is byte-identical', clip(line));
      check(!exists(skillPath(context, 'assets/tools/doctor.mjs')), 'doctor.mjs is not copied into assets/tools');
      const catalog = readText(skillPath(context, 'data/runtime-units.json'));
      check(catalog !== null && !catalog.includes('doctor'), 'the runtime catalog does not mention the doctor');
    });
    await step('plan 4.1: the CLI grammar in process: [] and ["--json"] give identical J(report); every other argv is exit 2, empty stderr and the exact usage envelope', async () => {
      if (!validate) return;
      await withScratch(context, 'cli', async (dir) => {
        const root = mkProject(dir, 'p', { '.gitignore': GITIGNORE });
        const a = await runValidate(validate, root, { argv: [] });
        const b = await runValidate(validate, root, { argv: ['--json'] });
        check(a.result !== null && b.result !== null && a.result.stdout === b.result.stdout && a.result.exitCode === b.result.exitCode, 'identical output for [] and ["--json"]', [a.result && clip(a.result.stdout), b.result && clip(b.result.stdout)]);
        const want = { exitCode: 2, stdout: J(USAGE_BODY), stderr: '' };
        for (const argv of [['--help'], ['--JSON'], ['--json', '--json'], ['x'], ['--json', 'x'], ['--json=1'], ['-j'], ['']]) {
          const r = await runValidate(validate, root, { argv });
          check(r.result !== null && eq(r.result, want), `argv ${show(argv)}: exit 2 with the exact usage envelope`, r.result ? { ...r.result, stdout: clip(r.result.stdout) } : errMsg(r.cap.error));
          check(r.cap.out.length === 0 && r.cap.err.length === 0, `argv ${show(argv)}: nothing written`);
        }
      });
    });
    await step('plan 4.1: ValidationDependencies permit exactly root, files and execute; invalid values, unknown keys and files without root reject with VALIDATE_OPTIONS and the exact message; a root that is a junction is refused the same way (no report, no stream, no executor call)', async () => {
      if (!validate) return;
      await withScratch(context, 'deps', async (dir) => {
        const root = mkProject(dir, 'p', { '.gitignore': GITIGNORE, 'a.txt': 'x\n' });
        const calls = [];
        const trap = () => { calls.push(1); throw new Error('trap'); };
        const bad = [
          ['an unknown key', { root, files: ['.gitignore'], extra: 1 }], ['files without root', { files: ['.gitignore'], execute: trap }], ['a non-string root', { root: 5, files: ['.gitignore'] }],
          ['a relative root', { root: 'relative/dir', files: ['.gitignore'] }], ['a root that does not exist', { root: path.join(dir, 'missing'), files: ['.gitignore'] }], ['a root that is a file', { root: path.join(root, 'a.txt'), files: ['a.txt'] }],
          ['files that is not an array', { root, files: '.gitignore' }], ['duplicate files', { root, files: ['.gitignore', '.gitignore'] }], ['a traversing file', { root, files: ['../x'] }], ['an absolute file', { root, files: ['/abs/x'] }],
          ['a non-string file', { root, files: [5] }], ['an empty file name', { root, files: [''] }], ['a dot-segment file', { root, files: ['./a.txt'] }], ['an executor that is not a function', { root, files: ['.gitignore'], execute: 'x' }],
        ];
        for (const [label, deps] of bad) {
          const r = await withStreamCapture(() => validate.main([], deps));
          const e = r.error;
          check(r.threw && e instanceof Error && hasOwn(e, 'code') && e.code === 'VALIDATE_OPTIONS' && e.message === VALIDATE_OPTIONS_MESSAGE, `${label}: VALIDATE_OPTIONS with the exact message`, r.threw ? { code: e && e.code, message: e && e.message } : { returned: clip(r.value && r.value.stdout) });
          check(r.out.length === 0 && r.err.length === 0 && r.exitCode === null, `${label}: no stream output, no exit code`);
        }
        const real = mkProject(dir, 'jr', { '.gitignore': GITIGNORE });
        const link = path.join(dir, 'jr-link');
        if (!linkDir(real, link)) check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'}`);
        else {
          const rec = fsRecorder().start();
          let r;
          try { r = await withStreamCapture(() => validate.main([], { root: link, files: ['.gitignore'], execute: trap })); } finally { rec.stop(); }
          check(rec.records.filter((x) => x.kind === 'spawn').length === 0 && bodyReads(rec.records, path.join(real, '.gitignore')).length === 0 && bodyReads(rec.records, path.join(link, '.gitignore')).length === 0, 'after the refusal no child process is launched and no project body is read', rec.records.filter((x) => x.kind === 'spawn' || /gitignore/.test(String(x.path))).slice(0, 4));
          const e = r.error;
          check(r.threw && e instanceof Error && e.code === 'VALIDATE_OPTIONS' && e.message === VALIDATE_OPTIONS_MESSAGE && !/APPLY_ROOT/.test(String(e.message)), 'a junctioned root rejects with VALIDATE_OPTIONS (the helper APPLY_ROOT error is not exposed)', r.threw ? { code: e && e.code, message: e && e.message } : 'resolved');
          check(r.out.length === 0 && r.err.length === 0 && r.exitCode === null && calls.length === 0, 'a junctioned root: no report, no stream output, no executor call', { out: r.out.length, calls: calls.length });
        }
      });
    });
    await step('plan 6.3 direct-entry: sequential in-process calls on two roots and then the first again each describe their own root (the module-global anchor is re-established), with the root seam and with repoRoot discovery from the working directory; no root means exit 1 with the not-a-repository envelope', async () => {
      if (!validate) return;
      await withScratch(context, 'seq', async (dir) => {
        const fixtureA = { '.gitignore': GITIGNORE, '.claude/settings.json': jsonText({ permissions: { allow: ['Bash(npm test)'] } }) };
        const fixtureB = { '.gitignore': '' };
        const rootA = mkProject(dir, 'a', fixtureA);
        const rootB = mkProject(dir, 'b', fixtureB);
        const wantA = [ROW.settingsPass, SECRET_SHAPED(0), { level: 'warn', check: 'allow-repo-code', detail: REPO_ALLOW('Bash(npm test)', 'user') }, ROW.allowLocal, ROW.hookNone];
        const wantB = [SECRET_SHAPED(0), ROW.allowLocal, ROW.hookNone, { level: 'warn', check: 'gitignore', detail: '.claude/settings.local.json not ignored' }, { level: 'warn', check: 'gitignore', detail: 'CLAUDE.local.md not ignored' }];
        for (const [label, root, want] of [['first root', rootA, wantA], ['second root', rootB, wantB], ['first root again', rootA, wantA]]) {
          const run = await runValidate(validate, root, {});
          if (expectReport(check, `seam: ${label}`, run, { exit: 0, launches: 0 })) check(eq(run.report.results, want), `seam: ${label} describes its own root`, firstDiff(run.report.results, want));
        }
        const gitA = path.join(dir, 'ga');
        const gitB = path.join(dir, 'gb');
        const okInit = initRepo(context, gitA) && initRepo(context, gitB);
        check(okInit, 'git init for the two discovery roots');
        if (okInit) {
          for (const [rel, text] of Object.entries(fixtureA)) putFile(path.join(gitA, ...rel.split('/')), text);
          for (const [rel, text] of Object.entries(fixtureB)) putFile(path.join(gitB, ...rel.split('/')), text);
          const here = process.cwd();
          const prevCeil = process.env.GIT_CEILING_DIRECTORIES;
          process.env.GIT_CEILING_DIRECTORIES = dir;
          try {
            for (const [label, root, want] of [['first repository', gitA, wantA], ['second repository', gitB, wantB], ['first repository again', gitA, wantA]]) {
              process.chdir(root);
              const cap = await withStreamCapture(() => validate.main([]));
              countProcess(context, 2);
              const rep = cap.threw ? null : (() => { try { return JSON.parse(cap.value.stdout); } catch { return null; } })();
              check(rep !== null && eq(rep.results, want), `discovery: ${label} describes the repository found from the working directory`, rep ? firstDiff(rep.results, want) : errMsg(cap.error));
            }
            const outside = path.join(dir, 'plain');
            fs.mkdirSync(outside);
            process.chdir(outside);
            const none = await withStreamCapture(() => validate.main([]));
            countProcess(context, 1);
            check(!none.threw && eq(none.value, { exitCode: 1, stdout: J({ ok: false, error: 'not inside a git repository' }), stderr: '' }), 'outside a repository: exit 1 with the exact not-a-repository envelope and empty stderr', none.threw ? errMsg(none.error) : none.value);
          } finally {
            process.chdir(here);
            if (prevCeil === undefined) delete process.env.GIT_CEILING_DIRECTORIES; else process.env.GIT_CEILING_DIRECTORIES = prevCeil;
          }
        }
      });
    });
    await step('plan 6.3 direct-entry through a junctioned skill directory: the complete report, empty stderr and exit 0 (an empty stdout fails); the ordinary launch, the --json launch and a usage failure give the exact outputs', async () => {
      await withScratch(context, 'entry', async (dir) => {
        const root = path.join(dir, 'proj');
        if (!initRepo(context, root)) { check(false, 'git init succeeded'); return; }
        putFile(path.join(root, '.gitignore'), GITIGNORE);
        const link = path.join(dir, 'skill-link');
        if (!linkDir(context.skillRoot, link)) { check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'} for the alternate-path launch`); return; }
        const want = J({
          ok: true, summary: { pass: 1, warn: 0, fail: 0 },
          results: [SECRET_SHAPED(0), ROW.allowLocal, ROW.hookNone],
          runtimeEvidence: { hookSelfTest: 'not-run', claudeHookLoading: 'not-verified' },
        });
        const a = spawnNode(context, [path.join(link, 'scripts', 'validate.mjs')], { cwd: root });
        check(a.status === 0 && a.stderr === '' && a.stdout === want, 'junctioned launch: exit 0, empty stderr and the complete exact report', { status: a.status, stdout: clip(a.stdout), stderr: clip(a.stderr) });
        const b = spawnNode(context, [skillPath(context, 'scripts/validate.mjs')], { cwd: root });
        check(b.status === 0 && b.stderr === '' && b.stdout === want, 'ordinary launch: identical output', { status: b.status, stdout: clip(b.stdout), stderr: clip(b.stderr) });
        const c = spawnNode(context, [skillPath(context, 'scripts/validate.mjs'), '--json'], { cwd: root });
        check(c.status === 0 && c.stderr === '' && c.stdout === want, '--json launch: identical output', { status: c.status, stdout: clip(c.stdout), stderr: clip(c.stderr) });
        const d = spawnNode(context, [skillPath(context, 'scripts/validate.mjs'), '--bogus'], { cwd: root });
        check(d.status === 2 && d.stderr === '' && d.stdout === J(USAGE_BODY), 'a usage failure: exit 2, empty stderr, the exact envelope', { status: d.status, stdout: clip(d.stdout), stderr: clip(d.stderr) });
        const git = gitIn(context, root, ['status', '--porcelain']);
        check(git.status === 0 && !/\.ai/.test(git.stdout), 'validate wrote nothing into the project');
      });
    });
    await step('plan 4.2: existing filename exclusions apply to a supplied inventory (.ai/.run, .ai/.canary and node_modules are never read)', async () => {
      if (!validate) return;
      await withScratch(context, 'excl', async (dir) => {
        const broken = '<!-- project-setup:begin id=x -->\ntext\n';
        const root = mkProject(dir, 'p', { '.gitignore': GITIGNORE, '.ai/.run/.gitignore': '*\n', '.ai/.run/run-0001/drafts/a.md': broken, '.ai/.canary/c.md': broken, 'node_modules/pkg/README.md': broken });
        const run = await runValidate(validate, root, { record: true, files: ['.gitignore', '.ai/.run/run-0001/drafts/a.md', '.ai/.canary/c.md', 'node_modules/pkg/README.md'] });
        if (expectReport(check, 'excluded inventory', run, { exit: 0 })) {
          check(rowsOf(run.report, 'markers').length === 0, 'no marker row from excluded names', rowsOf(run.report, 'markers'));
          check(['.ai/.run/run-0001/drafts/a.md', '.ai/.canary/c.md', 'node_modules/pkg/README.md'].every((rel) => bodyReads(run.records, path.join(root, ...rel.split('/'))).length === 0), 'no excluded body is read');
        }
        check(run.records.filter((r) => r.kind === 'write').length === 0, 'validate writes nothing');
      });
    });
    await step('plan 5.2: every exact documentation sentence, row, fence and block named by the plan (SKILL.md, README.md, references/codex.md, references/security.md, references/report.md)', async () => {
      documentationChecks(check, context);
    });
    await step('plan 6.1 and 2.2: the registry holds the twenty descriptors independently, the implementations match them, no complete numbered case is added, and run-tests aggregates C10 once after C9 without printing', async () => {
      const rc = await importOrFail(failures, pathToFileURL(path.join(context.skillRoot, 'tests', 'rc1-cases.mjs')).href, 'tests/rc1-cases.mjs');
      if (!rc) return;
      const exp = rc.COMPONENT_ASSERTIONS && rc.COMPONENT_ASSERTIONS.C10;
      check(Array.isArray(exp) && eq(exp, EXPECTED_DESCRIPTORS), 'COMPONENT_ASSERTIONS.C10 is the twenty descriptors of plan 6.1 in order', exp && exp.map((d) => d.id));
      const impls = rc.COMPONENT_IMPLEMENTATIONS && rc.COMPONENT_IMPLEMENTATIONS.C10;
      check(Array.isArray(impls) && Object.isFrozen(impls) && impls.length === C10_IMPLEMENTATIONS.length && impls.every((x, i) => x === C10_IMPLEMENTATIONS[i]), 'COMPONENT_IMPLEMENTATIONS.C10 holds exactly the C10_IMPLEMENTATIONS objects', impls && impls.length);
      check(Object.isFrozen(C10_IMPLEMENTATIONS) && eq(C10_IMPLEMENTATIONS.map((x) => x.id), EXPECTED_DESCRIPTORS.map((d) => d.id)) && C10_IMPLEMENTATIONS.every((x) => typeof x.run === 'function' && Object.isFrozen(x)), 'C10_IMPLEMENTATIONS is a frozen array of the twenty IDs with callable run functions');
      const calls = [];
      const ret = rc.registerRc1Cases((...a) => calls.push(a), {});
      check(calls.length === 0 && (ret === undefined || (ret && typeof ret.then === 'function')), 'registerRc1Cases still registers no complete numbered case', calls.length);
      check(!rc.REQUIRED_CASE_IDS.some((x) => x.includes('/C10/')), 'no complete-case inventory names a C10 sub-assertion');
      const runner = readText(path.join(context.skillRoot, 'tests', 'run-tests.mjs'));
      const at9 = runner === null ? -1 : runner.indexOf("runComponentAssertions('C9'");
      const at10 = runner === null ? -1 : runner.indexOf("runComponentAssertions('C10'");
      const r30 = runner === null ? -1 : runner.indexOf("test('R30'", at9);
      check(at9 >= 0 && at10 > at9 && r30 > at10 && runner.indexOf("runComponentAssertions('C10'", at10 + 1) < 0, 'run-tests.mjs runs the C10 component assertions once, after the C9 aggregation, inside R29', { at9, at10, r30 });
      const seg = at10 >= 0 && r30 > at10 ? runner.slice(at10, r30) : '';
      check(seg !== '' && !/console\.log|stdout\.write|\bPASS {2}\b/.test(seg), 'the C10 aggregation prints no nested record');
    });
    flushProcessCount(context, 'V2/C10/contracts', mark);
  });
}

// ============================================== registration ====
// The component entry (plan 6.1): the frozen implementation list in the registry's order. rc1-cases.mjs registers the matching literal descriptors independently.
const RUNNERS = {
  'N8-doctor/C10/arguments': argumentsGroup,
  'N8-doctor/C10/entrypoints': entrypointsGroup,
  'N8-doctor/C10/context': contextGroup,
  'N8-doctor/C10/configuration': configurationGroup,
  'N8-doctor/C10/logs': logsGroup,
  'N8-doctor/C10/processes': processesGroup,
  'N8-doctor/C10/negative-actions': negativeActionsGroup,
  'N8-doctor/C10/cli': cliGroup,
  'R46/C10/anchors': anchorsGroup,
  'R49/C10/policy': policyGroup,
  'R53/C10/reporting': reportingGroup,
  'R73/C10/selftest': selftestGroup,
  'R79/C10/schemas': schemasGroup,
  'R79/C10/runtime-unit': runtimeUnitGroup,
  'R81/C10/baseline': baselineGroup,
  'R82/C10/snippet': snippetGroup,
  'V2/C10/schema2': schema2Group,
  'V2/C10/discovery': discoveryGroup,
  'V2/C10/run-inventory': runInventoryGroup,
  'V2/C10/contracts': contractsGroup,
};
export const C10_IMPLEMENTATIONS = Object.freeze(EXPECTED_DESCRIPTORS.map((d) => Object.freeze({ id: d.id, run: (context) => RUNNERS[d.id](context) })));
