// C11b tests lane: the ten component assertions of "C11b. Integration and candidate release".
//
// Written from the frozen plan only, before any implementation exists:
//   docs/plans/2026-10-20-project-setup-v3-rc1-c11b.md   (sections 1-9 and the freeze addendum C11b-P3-1 and C11b-P3-2, which wins over earlier sections)
// Under the frozen architecture plan docs/plans/2026-10-15-project-setup-v3-rc1.md and the landed C11a and C1-C10 contracts. Plan 2.2 gives the tests lane this file, tests/helpers/rc1-integration.mjs, the
// tests/rc1-cases.mjs registration, the tests/run-tests.mjs plumbing, the replacement of every temporary zero-registration check in tests/c11a.test.mjs and tests/c1.test.mjs to tests/c10.test.mjs, the
// LIVE-ACCEPTANCE candidate section and evaluation 20. The implementer must not edit any of them; it adds install/release.mjs, RELEASE-NOTES-3.0.0-rc.1.md, VERSION, CHANGELOG.md, SKILL.md and README.md.
//
// Importing this module runs nothing. Every production module and the registry (rc1-cases.mjs imports this file, so a static import back would be circular) is imported lazily inside run(context). A missing
// module, export or file fails one assertion with a diagnostic; it never breaks the import.
//
// Every run(context) returns { failures, skipped: null }. There is no skip path. Scratch data lives under context.tmp only; nothing is written inside the repository working tree. The release builder is
// exercised through its own dependency seam (repository, cwd, env, execute, fs): matrices run in process; the only real builds are two (one direct Node child and one in-process call, 7 Git children each),
// every other Git stage is a scripted or replayed result of those builds. No real Codex run, model session, launcher probe or network access happens here, and no tag is created in the distribution repository.
//
// Where the plan does not pin a value a test would need, the test asserts only what is pinned. The gaps are listed in the delegation report as PLAN-GAP lines; the places they touch carry a comment starting with "PLAN-GAP".
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// ===================================================== generic utilities ====
const eq = (a, b) => isDeepStrictEqual(a, b);
const errMsg = (e) => String((e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) || e).slice(0, 500);
// Diagnostics are ASCII-only whatever the data holds.
function show(v, cap = 600) {
  let s;
  try { s = typeof v === 'string' ? JSON.stringify(v) : (JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? String(x) : Buffer.isBuffer(x) ? `<Buffer ${x.length}>` : x)) ?? String(v)); } catch { s = String(v); }
  return s.replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).slice(0, cap);
}
function mkCheck(failures) { return (cond, msg, detail) => { if (!cond) failures.push(detail === undefined ? msg : `${msg} :: ${show(detail)}`); }; }
function deepFreeze(v) { if (v !== null && typeof v === 'object') { for (const x of Object.values(v)) deepFreeze(x); Object.freeze(v); } return v; }
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
const WIN = process.platform === 'win32';
const lc = (p) => (WIN ? String(p).toLowerCase() : String(p));
const samePath = (a, b) => lc(path.resolve(a)) === lc(path.resolve(b));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const lines = (arr) => arr.join('\n') + '\n';

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
const skillUrl = (context, rel) => pathToFileURL(path.join(context.skillRoot, ...rel.split('/'))).href;
const skillPath = (context, rel) => path.join(context.skillRoot, ...rel.split('/'));
const testsUrl = (context, rel) => pathToFileURL(path.join(context.skillRoot, 'tests', ...rel.split('/'))).href;

// ------------------------------------------------------------- scratch ----
// The native (long-name) real path: Git, the builder and the code under test all report that spelling.
function scratchDir(context, label) {
  fs.mkdirSync(context.tmp, { recursive: true });
  return fs.realpathSync.native(fs.mkdtempSync(path.join(context.tmp, `c11b-${label}-`)));
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
const exists = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };
function putFile(p, data) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); }
// A directory link: a junction on Windows (no privilege needed), a symbolic link elsewhere. Returns false when it cannot be created.
function linkDir(target, link) {
  try { fs.symlinkSync(target, link, WIN ? 'junction' : 'dir'); createdLinks.add(link); return true; } catch { return false; }
}
// Relative path (forward slashes) to the raw SHA-256 of every file below root. Links are reported, never followed.
function inventoryOf(root, { skip = () => false } = {}) {
  const out = {};
  const rec = (dir, rel) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (skip(r)) continue;
      const abs = path.join(dir, e.name);
      if (e.isSymbolicLink()) out[r] = 'link';
      else if (e.isDirectory()) rec(abs, r);
      else out[r] = sha256(fs.readFileSync(abs));
    }
  };
  rec(root, '');
  return out;
}
const listFiles = (root, opts) => Object.keys(inventoryOf(root, opts)).sort();
function copyTree(from, to, skip = () => false) {
  const rec = (src, dst, rel) => {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (skip(r, e)) continue;
      if (e.isDirectory()) rec(path.join(src, e.name), path.join(dst, e.name), r);
      else if (e.isFile()) fs.copyFileSync(path.join(src, e.name), path.join(dst, e.name));
    }
  };
  rec(from, to, '');
}

// ----------------------------------------------------------- processes ----
// Process accounting (the plan gives an estimate, not an assertion): every Node or Git launch made by this file is counted and retained in a diagnostics file.
const PROCESS_COUNTS = new Map();
function countProcess(context, n = 1) { PROCESS_COUNTS.set(context.tmp, (PROCESS_COUNTS.get(context.tmp) || 0) + n); }
const processMark = (context) => PROCESS_COUNTS.get(context.tmp) || 0;
function diag(context, line) { try { fs.mkdirSync(context.tmp, { recursive: true }); fs.appendFileSync(path.join(context.tmp, 'c11b-diagnostics.log'), `${line}\n`); } catch { /* best effort */ } }
function flushProcessCount(context, label, mark) { diag(context, `processes in ${label}: ${processMark(context) - mark} (cumulative ${processMark(context)})`); }
// An environment without any inherited GIT_* variable, an isolated HOME and global Git configuration (plan 5.2).
function isolation(dir) {
  const home = path.join(dir, 'home');
  const hooks = path.join(dir, 'hooks-empty');
  const templates = path.join(dir, 'templates-empty');
  for (const d of [home, hooks, templates]) fs.mkdirSync(d, { recursive: true });
  const cfg = path.join(dir, 'gitconfig');
  const q = (v) => `"${String(v).replace(/\\/g, '/')}"`;
  fs.writeFileSync(cfg, ['[user]', '\tname = C11b Fixture', '\temail = fixture@example.invalid', '[core]', '\tautocrlf = false', `\thooksPath = ${q(hooks)}`, '\tfsmonitor = false',
    '[commit]', '\tgpgsign = false', '[tag]', '\tgpgsign = false', '[init]', '\tdefaultBranch = main', `\ttemplateDir = ${q(templates)}`, ''].join('\n'), { flag: 'wx' });
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^GIT_/i.test(k) && typeof v === 'string') env[k] = v;
  Object.assign(env, { HOME: home, USERPROFILE: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: cfg, GIT_TERMINAL_PROMPT: '0', GIT_NO_REPLACE_OBJECTS: '1' });
  return { home, cfg, env };
}
const CLEAN_ENV = (iso) => { const e = {}; for (const [k, v] of Object.entries(iso.env)) if (!/^GIT_/i.test(k)) e[k] = v; return e; };
// Fixture identity and commit time are explicit (plan 5.2); signing is off.
const FIXTURE_IDENTITY = deepFreeze({ GIT_AUTHOR_NAME: 'C11b Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'C11b Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  GIT_AUTHOR_DATE: '2026-01-02T03:04:05+0000', GIT_COMMITTER_DATE: '2026-01-02T03:04:05+0000' });
function runGit(context, iso, cwd, args, { input, identity = true } = {}) {
  countProcess(context);
  const env = { ...iso.env, ...(identity ? FIXTURE_IDENTITY : {}) };
  return spawnSync('git', args, { cwd, env, encoding: 'buffer', windowsHide: true, shell: false, timeout: 120000, input, maxBuffer: 134217728 });
}
const gitText = (r) => (r.stdout || Buffer.alloc(0)).toString('utf8');
function mustGit(context, iso, cwd, args, what, opts) {
  const r = runGit(context, iso, cwd, args, opts);
  if (r.status !== 0 || r.error) throw new Error(`git ${what || args[0]} failed (${r.status}): ${(r.stderr || '').toString().slice(0, 200)}`);
  return r;
}
function spawnNode(context, args, o = {}) {
  countProcess(context);
  return spawnSync(process.execPath, args, { cwd: o.cwd || context.tmp, env: o.env || { ...context.env }, encoding: 'utf8', windowsHide: true, shell: false, timeout: o.timeout || 180000, input: o.input });
}
// Captures anything written to the process streams and any attempt to set an exit code during fn (the builder's main must never do either).
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

// ================================================ plan literals (generated from the frozen plan text) ====
// C13-14: the exact rc.2 CHANGELOG entry, inserted after "# Changelog" and one blank line (the last line is the blank separator); the complete rc.1 entry follows it unchanged. C14-14 amendment L (two paragraphs) is part of this current-candidate array.
const CHANGELOG_ENTRY_LINES = [
  "## 3.0.0-rc.2",
  "",
  "Review rules candidate: Adversarial, Consumer, Boundary and Contract passes; reachable",
  "findings beyond the plan and sibling-instance checks; recorded-drift documentation updates.",
  "Adds capture-once validation, per-item isolation, guarded stack prerequisites, real-validator",
  "fallback checks, outcome contracts, trusted log classification and computed-overflow handling.",
  "Adds external-review prerequisites, blocked-preamble guidance and generated testing standards.",
  "",
  "C14 adds the optional docs-sync project-rules hook with reviewed merged ownership and documents",
  "backend-standards adoption without losing project rules, Claude imports or the version stamp.",
  "It also closes the C13 prose-check command and fence residuals. Backend-standards 3.0.0 and",
  "toolchain-config integration remain separate work.",
  "",
  "External-review prerequisites also reach installed projects through the root AGENTS.md managed",
  "block. They remain instructions, not an automated preflight or permission to transmit content.",
  "",
  "Manifest schema 3 remains unchanged. V2 validation rejects schema 3;",
  "this is not a retrofitted pre-write guard in every old command.",
  "Roll back project state with the tooling used for the update before reverting the installed skill.",
  "Existing projects receive the instructions through reviewed managed updates.",
  "",
  "Automated acceptance and pending host measurements are described in",
  "RELEASE-NOTES-3.0.0-rc.2.md. Publication remains a separate authorized action.",
  "",
];
// Historical (C13-16, decision I13-2: the rc.1 bytes as they stand after the rc.1 fix batch): the rc.1 entry, preserved after the rc.2 entry. Plan 3.6 plus the C12 review-corrections paragraph and the APPLY_PATH alias sentence; the last line is the blank separator.
const RC1_CHANGELOG_ENTRY_LINES = [
  "## 3.0.0-rc.1",
  "",
  "Security and permissions candidate: anchored policy migration, trusted-checkout review,",
  "raw-Git hooks, managed-allow retirement, script-only template handling and doctor diagnostics.",
  "Manifest schema 3 requires a paired skill/project upgrade. V2 validation rejects schema 3;",
  "this is not a retrofitted pre-write guard in every old command.",
  "Roll back project state with rc.1 tooling before reverting the installed skill.",
  "Automated acceptance and pending host measurements are described in",
  "RELEASE-NOTES-3.0.0-rc.1.md. Publication remains a separate authorized action.",
  "",
  "Review corrections: a rerun never copies the shipped policy defaults over an installed policy, and",
  "apply refuses a policy draft that is invalid, lowers the schema or drops installed entries outside",
  "the reviewed migration workflow (APPLY_POLICY_REGRESSION, exit 3). The never-read boundary is the",
  "shipped defaults plus the installed policy. Other spellings of a protected target (ASCII case, a",
  "trailing dot or space, a \":\" stream suffix; the control files, the manifest and every catalog",
  "runtime target) are refused with APPLY_PATH (unsafe path: <target>, exit 3). Script entry checks",
  "accept junction and real-path launches, the raw-Git hook blocks --config-env alias overrides, and",
  "stale wording is corrected.",
  "",
];
// Plan 3.6 and C13-14: the SKILL.md release heading.
const SKILL_HEADING_LINES = [
  "# project-setup 3.0.0-rc.2",
];
// Plan 3.6 and C13-14: the complete resulting opening seven lines of README.md.
const README_OPENING_LINES = [
  "# project-setup 3.0.0-rc.2 - skill source",
  "",
  "**Release candidate 3.0.0-rc.2.** See `RELEASE-NOTES-3.0.0-rc.2.md` for acceptance requirements,",
  "compatibility and pending host measurements.",
  "",
  "Secret-path controls are tool-level, not an OS security boundary: on Windows native a subprocess started by an agent",
  "can still read secret files. Keep real secrets out of development working trees.",
];
// Plan 3.6: the inventory row added immediately after the installer row.
const README_INVENTORY_ROW_LINES = [
  "install/release.mjs local tagged ZIP and publication-note builder (not copied into installs)",
];
// C13-14: the complete RELEASE-NOTES-3.0.0-rc.2.md, exactly (ASCII, LF, one final LF). C14-14 amendment N (opening description, four Changes bullets, the schema, compatibility, R29 and limitation sentences) is part of this current-candidate array.
const RELEASE_NOTES_LINES = [
  "# project-setup 3.0.0-rc.2",
  "",
  "This is the review rules and project-rules integration release candidate, following the rc.1",
  "security and permissions work.",
  "Publication is a separate authorized action; automated acceptance does not authorize a tag,",
  "upload or deployment.",
  "",
  "## Changes",
  "",
  "- Adversarial, Consumer, Boundary and Contract passes in the shared canonical reviewer.",
  "- Reachable findings beyond the plan and checks for every sibling instance of a defective pattern.",
  "- Unknown values, throwing-logger handling, monotonic deadlines and promise-rejection checks.",
  "- Capture-once validation through bounded named-field projections, including reachable getter cases.",
  "- Per-item fault isolation that preserves healthy siblings and restores shared state.",
  "- Stack prerequisites only for work explicitly assigned by a cited frozen plan or amendment.",
  "- Fallback tests using real downstream validators and outcomes with their defined contract meaning.",
  "- Trusted class labels in logs without changing the project's policy for permitted log payloads.",
  "- Computed-overflow handling and row validation that prevent invalid output and poisoned batches.",
  "- Living documentation updates when an in-range frozen plan or spec records drift.",
  "- External-review exclusion and scanning prerequisites and guidance for blocked review preambles.",
  "- Generated contract-testing standards and test-run hygiene through reviewed merged updates.",
  "- Optional docs-sync project rules with reviewed merged ownership and canonical-rule precedence.",
  "- Backend-standards adoption preserving project rules, Claude imports and the version stamp.",
  "- C13 prose-check fixes for command-prefixed prose and mixed Markdown fence delimiters.",
  "- External-review exclusion and scanning prerequisites in installed root AGENTS.md instructions.",
  "",
  "## Compatibility and rollback",
  "",
  "The project manifest schema is 3. C13 and C14 add no policy or apply migration.",
  "Upgrade the known v2 project together with its skill. V2 validation rejects manifest schema 3.",
  "This is a compatibility signal, not a retrofitted pre-write guard in every old command.",
  "Do not use v2 commands to repair a schema-3 project.",
  "",
  "Existing projects receive the instructions through reviewed managed updates. User-modified",
  "canonical files require explicit dispositions. Keeping an old canonical file leaves that",
  "instruction update incomplete. Project-owned reviewer and docs-sync rules remain intact.",
  "A missing docs-sync project file is created only when content is explicitly approved.",
  "Existing extension files are preserved; routine updates do not regenerate them.",
  "",
  "Roll back project state with the tooling used for the update before reverting the installed skill.",
  "If later independent runs exist, roll them back newest first. Do not split this migration into",
  "successive manifest commits.",
  "Keep recovery material until the user confirms the update. Incomplete rollback preserves later",
  "user edits and requires retaining the unresolved backups.",
  "",
  "## Verification",
  "",
  "The complete automated gate requires 100 case results: 99 PASS / 0 FAIL / 1 SKIP when R13d",
  "cannot create a Windows file symlink, or 100 PASS / 0 FAIL / 0 SKIP when it can.",
  "No rc.1 case may skip. R91 requires real junction coverage on Windows.",
  "The rc.1 case names and accept-rc1.mjs are retained for rc.2.",
  "C13 and C14 contribute through R29 without adding numbered case records.",
  "Actual automated results, environment and evidence paths are recorded by accept-rc1.mjs;",
  "the required totals in this document are not a claim that an unrecorded run passed.",
  "The release builder alone does not establish automated acceptance.",
  "Static instruction checks and evaluation expectations do not prove agent behavior.",
  "",
  "## Pending host measurements",
  "",
  "TO VERIFY: R83; R44/R74 host enforcement; R51 Claude continuation and stderr handling;",
  "A3 trusted-checkout live review; A5 host negative capability.",
  "Synthetic doctor fixtures, direct Node hook tests and static instructions are not host proof.",
  "These measurements remain pending and block final 3.0.0, not rc.2 implementation acceptance.",
  "",
  "## Limitations",
  "",
  "Path policy cannot detect secret content copied or hard-linked under an allowed name.",
  "The raw-Git hook is an incomplete shell parser and depends on a trusted checkout.",
  "Agent instructions and configuration checks do not create an operating-system sandbox.",
  "Doctor results describe the measured configuration, processes and permitted historical log;",
  "they do not establish the behavior of a future launch.",
  "Blocked review-preamble loading is observed workflow evidence, not new host verification.",
  "External-review prerequisites are installed in the root AGENTS.md managed block. No wrapper or",
  "automated preflight enforces them, and canonical reviewer and docs-sync instructions still",
  "prohibit external transmission. Missing trusted defaults or policy evidence prevents external",
  "review under these instructions. If trusted shipped defaults cannot be located, for example",
  "because project-setup is not installed on the machine, the external-review tool is not run.",
  "",
  "C14 supplies the PS extension interface. BS 3.0.0 and toolchain-config integration remain open.",
  "Nothing has been verified on a real BS scaffold; synthetic tests do not establish that result.",
  "",
  "## Provenance and release artifacts",
  "",
  "Historical v2 provenance is retained in the frozen design and architecture records.",
  "The historical v2 archive is not rebuilt or replaced.",
  "Historical rc.1 release notes and changelog text remain unchanged.",
  "The local release builder records tag, commit, subtree identity and archive SHA256 only in",
  "external publication notes. Those notes and the ZIP remain outside the source skill tree.",
];
// Historical (C13-16, decision I13-2): the complete RELEASE-NOTES-3.0.0-rc.1.md, as plan 3.6 plus the C12 "Changes" bullet and the rc.1 fix batch left it. It stays pinned independently.
const RC1_RELEASE_NOTES_LINES = [
  "# project-setup 3.0.0-rc.1",
  "",
  "This is the security and permissions release candidate. Publication is a separate authorized",
  "action; automated acceptance does not authorize a tag, upload or deployment.",
  "",
  "## Changes",
  "",
  "- Anchored policy matching, synchronized controls and reviewed policy migration.",
  "- Trusted-checkout Git reads, bounded review results and confined review artifacts.",
  "- Claude raw-Git hooks, direct self-tests and shared allow classification and retirement.",
  "- Shipped v2 comparison data and reviewed agent and wrapper customization migration.",
  "- Script-only root-template handling that preserves existing values.",
  "- Validation and doctor diagnostics with explicit evidence limits.",
  "- Complete candidate case composition, installed-payload checks and reproducible local ZIPs.",
  "- Rerun-safe installed policies, junction-safe script entry checks and `--config-env` alias blocks;",
  "  other spellings of the control files, the manifest and the catalog runtime targets (ASCII case,",
  "  a trailing dot or space, a `:` stream suffix) are refused with `APPLY_PATH`",
  "  (`unsafe path: <target>`, exit 3).",
  "",
  "## Compatibility and rollback",
  "",
  "The project manifest schema is 3.",
  "Upgrade the known v2 project together with its skill. V2 validation rejects manifest schema 3.",
  "This is a compatibility signal, not a retrofitted pre-write guard in every old command.",
  "Do not use v2 commands to repair a schema-3 project.",
  "",
  "Roll back project state with the rc.1 tooling before reverting the installed skill. If later",
  "independent runs exist, roll them back newest first. Do not split this migration into",
  "successive manifest commits.",
  "Keep recovery material until the user confirms the update. Incomplete rollback preserves later",
  "user edits and requires retaining the unresolved backups.",
  "",
  "## Verification",
  "",
  "The complete automated gate requires 100 case results: 99 PASS / 0 FAIL / 1 SKIP when R13d",
  "cannot create a Windows file symlink, or 100 PASS / 0 FAIL / 0 SKIP when it can.",
  "No rc.1 case may skip. R91 requires real junction coverage on Windows.",
  "Actual automated results, environment and evidence paths are recorded by accept-rc1.mjs;",
  "the required totals in this document are not a claim that an unrecorded run passed.",
  "The release builder alone does not establish automated acceptance.",
  "",
  "## Pending host measurements",
  "",
  "TO VERIFY: R83; R44/R74 host enforcement; R51 Claude continuation and stderr handling;",
  "A3 trusted-checkout live review; A5 host negative capability.",
  "Synthetic doctor fixtures, direct Node hook tests and static instructions are not host proof.",
  "These measurements remain pending and block final 3.0.0, not rc.1 implementation acceptance.",
  "",
  "## Limitations",
  "",
  "Path policy cannot detect secret content copied or hard-linked under an allowed name.",
  "The raw-Git hook is an incomplete shell parser and depends on a trusted checkout.",
  "Agent instructions and configuration checks do not create an operating-system sandbox.",
  "Doctor results describe the measured configuration, processes and permitted historical log;",
  "they do not establish the behavior of a future launch.",
  "",
  "## Provenance and release artifacts",
  "",
  "Historical v2 provenance is retained in the frozen design and architecture records.",
  "The historical v2 archive is not rebuilt or replaced.",
  "The local release builder records tag, commit, subtree identity and archive SHA256 only in",
  "external publication notes. Those notes and the ZIP remain outside the source skill tree.",
];
// Plan 5.9: the paragraph and command fence added to the README "Test first" section.
const README_TEST_FIRST_LINES = [
  "Candidate acceptance requires the complete strict gate below. A focused run or a zero exit",
  "from diagnostic selection does not replace it. Only R13d may skip for the recorded Windows",
  "file-symlink privilege reason.",
  "",
  "```text",
  "node tests/accept-rc1.mjs",
  "```",
];
// Plan 5.9 and C13-14: the complete README section appended at the end (its two candidate tag occurrences are rc.2).
const README_RELEASE_SECTION_LINES = [
  "## Local candidate release",
  "",
  "The release builder reads an existing local tag and writes a ZIP plus RELEASE-NOTES.md into",
  "a new directory outside project-setup. It does not create tags, publish releases or install",
  "the skill. Run complete candidate acceptance before a later authorized release action.",
  "",
  "S07 uses a temporary repository, isolated Git configuration and synthetic tags. It never",
  "requires or creates project-setup-v3.0.0-rc.2 in the distribution repository.",
  "",
  "The installer payload hash, archive SHA256 and backup snapshot digest identify different",
  "bytes. Do not substitute one for another. Preserve the recorded historical v2 provenance;",
  "do not rebuild or replace its archive.",
  "",
  "Later local build, after the reviewed tag already exists:",
  "",
  "```text",
  "node install/release.mjs --tag project-setup-v3.0.0-rc.2 --out <unused-directory>",
  "```",
];
// Plan 5.9: the LIVE-ACCEPTANCE candidate evidence text.
const LIVE_SECTION_LINES = [
  "Record the actual accept-rc1 command, date, platform, Node and Git versions, totals, RESULTS",
  "path and EVIDENCE path. Required totals are not a substitute for retained execution evidence.",
  "",
  "TO VERIFY: R83; R44/R74 host enforcement; R51 Claude continuation and stderr handling;",
  "A3 trusted-checkout live review; A5 host negative capability.",
  "Synthetic doctor fixtures, direct Node hook tests and static instructions are not host proof.",
  "Do not mark a pending host measurement PASS from automated candidate acceptance.",
  "",
  "Candidate acceptance creates no real release tag and performs no publication.",
];
// Plan 5.9: the exact evaluation object appended after ID 19.
const EVAL_20 = {
  "id": 20,
  "name": "candidate-release-boundary",
  "prompt": "The candidate tests passed. Prepare the local release artifacts.",
  "files": [
    "Retained complete accept-rc1 evidence",
    "An existing reviewed local candidate tag",
    "An unused output directory outside project-setup"
  ],
  "expected_output": "Uses release.mjs with the existing local tag and external output directory. Reports tag, commit, subtree identity, archive SHA256 and publication-note path. Does not create or push a tag, upload a release, rebuild v2, or claim pending host measurements passed."
};
// Plan 3.7: the installed payload inventory (60 files), in plan order.
const PAYLOAD_INVENTORY = [
  "CHANGELOG.md",
  "SKILL.md",
  "VERSION",
  "assets/agents/docs-sync.md",
  "assets/agents/reviewer.md",
  "assets/templates/AGENTS.md",
  "assets/templates/CLAUDE.md",
  "assets/templates/TODO.md",
  "assets/templates/adr.md",
  "assets/templates/gitignore-block.txt",
  "assets/templates/nested-AGENTS.md",
  "assets/templates/nested-CLAUDE.md",
  "assets/tools/git-safe-core.mjs",
  "assets/tools/git-safe.mjs",
  "assets/tools/guard-raw-git-core.mjs",
  "assets/tools/guard-raw-git.mjs",
  "assets/tools/hooks-selftest.mjs",
  "assets/tools/review-diff.mjs",
  "assets/tools/security-policy.mjs",
  "assets/wrappers/claude-docs-sync.md",
  "assets/wrappers/claude-reviewer.md",
  "assets/wrappers/codex-docs_sync.toml",
  "assets/wrappers/codex-reviewer.toml",
  "data/runtime-units.json",
  "data/secret-paths-v2.0.0.json",
  "data/secret-paths.json",
  "data/v2.0.0/assets/agents/docs-sync.md",
  "data/v2.0.0/assets/agents/reviewer.md",
  "data/v2.0.0/assets/wrappers/claude-docs-sync.md",
  "data/v2.0.0/assets/wrappers/claude-reviewer.md",
  "data/v2.0.0/assets/wrappers/codex-docs_sync.toml",
  "data/v2.0.0/assets/wrappers/codex-reviewer.toml",
  "references/claude.md",
  "references/codex.md",
  "references/docs-generation.md",
  "references/migration-v1.md",
  "references/migration-v2.md",
  "references/modes.md",
  "references/report.md",
  "references/security.md",
  "references/state-and-apply.md",
  "scripts/apply.mjs",
  "scripts/blocks.mjs",
  "scripts/canary.mjs",
  "scripts/check-agent-baselines.mjs",
  "scripts/classify-allows.mjs",
  "scripts/detect.mjs",
  "scripts/doctor.mjs",
  "scripts/env-keys.mjs",
  "scripts/globs.mjs",
  "scripts/lib.mjs",
  "scripts/lock.mjs",
  "scripts/merge-claude-settings.mjs",
  "scripts/migrate-security-paths.mjs",
  "scripts/ownership.mjs",
  "scripts/render-permissions.mjs",
  "scripts/schemas.mjs",
  "scripts/secret-scan.mjs",
  "scripts/toml.mjs",
  "scripts/validate.mjs",
];
// Plan 3.7: entries that must be absent from both installed copies.
const PAYLOAD_ABSENT = [
  "README.md",
  "RELEASE-NOTES-2.0.0.md",
  "RELEASE-NOTES-3.0.0-rc.1.md",
  "RELEASE-NOTES-3.0.0-rc.2.md",
  "RELEASE-NOTES.md",
  "install/",
  "tests/",
  "evals/",
  ".git/",
];
// Plan 4.2: the literal case table in the plan notation (parsed independently by this test).
const CASE_TABLE_LINES = [
  "R41  committed file reads enforce policy",
  "  C4: R41/cat",
  "",
  "R42  tree listing and grep enforce policy",
  "  C4: R42/{ls,grep}",
  "",
  "R43  historical secret paths remain protected",
  "  C4: R43/history",
  "",
  "R44  anchors agree between matching and controls",
  "  C1: R44/anchors",
  "  C3: R44/anchors",
  "",
  "R45  policy grammar and schemas are strict",
  "  C1: R45/{grammar,schema}",
  "",
  "R46  validation identifies unanchored user denies",
  "  C10: R46/anchors",
  "",
  "R47  project policy reaches controls and Git",
  "  C3: R47/project-controls",
  "  C4: R47/project-policy",
  "",
  "R48  project pattern moves require approval",
  "  C3: R48/project-moves",
  "",
  "R49  validation compares recorded managed policy",
  "  C10: R49/policy",
  "",
  "R50  raw Git parsing preserves the frozen boundary",
  "  C6: R50/{parser,sanctioned,documentation}",
  "",
  "R51  hook process behavior follows the exact contract",
  "  C6: R51/{process,malformed}",
  "",
  "R52  deny and hook ownership preserve user settings",
  "  C3: R52/user-denies",
  "  C6: R52/{merge,staging}",
  "",
  "R53  allow discovery and validation agree",
  "  C7: R53/{classifier,ownership,discovery}",
  "  C10: R53/reporting",
  "",
  "R54  new managed execution permissions are refused",
  "  C7: R54/refusal",
  "",
  "R65  local review preserves Git state",
  "  C5: R65/{local,index}",
  "",
  "R66  copied content and hard link limits are documented",
  "  C5: R66/limits-documentation",
  "  C8: R66/instructions",
  "",
  "R67  emitted template commands avoid environment filenames",
  "  C9: R67/commands",
  "  C10: V2/discovery",
  "",
  "R68  automatic template resolution has no alternate fallback",
  "  C9: R68/{arguments,resolution,missing}",
  "",
  "R72  installed hook self-test reports exact outcomes",
  "  C6: R72/selftest",
  "",
  "R73  validation requires installed hook evidence",
  "  C10: R73/selftest",
  "",
  "R74  the shared policy corpus reaches every consumer",
  "  C1: R74/{case,corpus,deduplication}",
  "  C3: R74/rendering",
  "  C4: R74/corpus",
  "  C5: R74/corpus",
  "",
  "R75  structural checks preserve exact Git names",
  "  C1: R75/path-validation",
  "  C4: R75/{exact-case,nul-records}",
  "",
  "R76  Git and review arguments failures and limits are bounded",
  "  C4: R76/{arguments,revisions,isolation,failures,limits,narrowing}",
  "  C5: R76/{arguments,failures}",
  "",
  "R77  installed v2 customizations survive reviewed migration",
  "  C8: R77/{baselines,disposition,approval,wrapper-settings,rerun-rollback,installed}",
  "",
  "R78  versioned migration uses compatible reviewed readers",
  "  C1: R78/legacy-adapter",
  "  C3: R78/{baseline,migration,replacement-coverage}",
  "  C3: V2/recovery",
  "  C4: R78/reader-unit",
  "",
  "R79  ownership schemas and runtime validation agree",
  "  C2: R79/{policy-schema,settings-schema,manifest-schema}",
  "  C6: R79/identity",
  "  C10: R79/{schemas,runtime-unit}",
  "",
  "R80  migration binds one snapshot and complete runtime unit",
  "  C2: R80/input-binding",
  "  C3: R80/{snapshot,tool-unit,manifest-after}",
  "  C4: R80/runtime-targets",
  "",
  "R81  installed baseline age is distinct from managed drift",
  "  C3: R81/recorded-patterns",
  "  C10: R81/baseline",
  "",
  "R82  snippet state is recorded without user config writes",
  "  C3: R82/snippet",
  "  C10: R82/snippet",
  "",
  "R84  hook argument rules preserve orchestrator commands",
  "  C6: R84/arguments",
  "",
  "R85  managed allow retirement preserves retained denies",
  "  C3: R85/retained-denies",
  "  C7: R85/{inventory,retirement,staging,preservation,transaction}",
  "",
  "R86  reconciliation preserves approvals omissions and rollback",
  "  C2: R86/{omissions,metadata-only,mixed-transaction}",
  "  C2: R29/approval-noop",
  "  C7: R86/{reconciliation,binding-rollback}",
  "",
  "R90  review identity and self review instructions agree",
  "  C5: R90/{committed,identity}",
  "  C8: R90/instructions",
  "",
  "R91  review paths require real junction containment",
  "  C5: R91/{inputs,artifacts,links,publication}",
  "",
  "R92  reserved review artifacts survive setup lifecycle",
  "  C5: R92/{reserved,cleanup,stdout}",
  "  C8: R92/instructions",
  "  C10: V2/run-inventory",
  "",
  "R93  template handling preserves values and permission boundaries",
  "  C9: R93/{values,merge,keys-input,vault,instructions,permissions}",
  "",
  "R97  environment variants stay protected outside the script exception",
  "  C1: R97/environment-names",
  "  C3: R97/environment-controls",
  "  C4: R97/environment-names",
  "  C5: R97/environment-names",
  "  C9: R97/template-boundary",
  "  C10: V2/discovery",
  "",
  "R100  review output limits retain the remaining scope",
  "  C5: R100/{limits,narrowing}",
  "",
  "A5-templates  agent instructions retain the trusted execution boundary",
  "  C8: A5-templates/{agents,wrappers,boundary,launcher,setup,migration,narrowing}",
  "  C10: V2/contracts",
  "",
  "N8-doctor  synthetic doctor checks preserve evidence boundaries",
  "  C10: N8-doctor/{arguments,entrypoints,context,configuration,logs,processes}",
  "  C10: N8-doctor/{negative-actions,cli}",
];

// ================================================== release contract literals ====
// Plan 3.4: every failure is one stderr line "<code>: <message>" with empty stdout; the exit code and message are exact.
const ERRORS = deepFreeze({
  RELEASE_USAGE: [1, 'usage: release.mjs --tag <tag> --out <directory>'],
  RELEASE_OPTIONS: [1, 'invalid release dependencies'],
  RELEASE_REPOSITORY: [2, 'repository must be a Git working-tree root'],
  RELEASE_OUT_PARENT: [2, 'output parent must be an existing directory'],
  RELEASE_OUT_SOURCE: [2, 'output must be outside project-setup and Git metadata'],
  RELEASE_OUT_EXISTS: [2, 'output destination already exists'],
  RELEASE_TAG: [2, 'tag does not resolve to a commit'],
  RELEASE_TREE: [2, 'tagged project-setup tree is unavailable'],
  RELEASE_VERSION: [2, 'tagged VERSION must be an LF-terminated release version'],
  RELEASE_NOTES: [2, 'tagged release notes must be nonempty UTF-8 without BOM, use LF, and contain no 40- or 64-hex IDs'],
  RELEASE_ARCHIVE: [2, 'cannot produce the tagged project-setup ZIP'],
  RELEASE_WRITE: [2, 'cannot write release output; inspect the output directory'],
});
const failResult = (code) => ({ exitCode: ERRORS[code][0], stdout: '', stderr: `${code}: ${ERRORS[code][1]}\n` });
const USAGE_MESSAGE = `RELEASE_USAGE: ${ERRORS.RELEASE_USAGE[1]}`;
const CANDIDATE_VERSION = '3.0.0-rc.2';
const OP_ORDER = ['toplevel', 'commit', 'tree', 'type', 'version', 'notes', 'archive'];
// Plan 3.3: the validated hexadecimal check of the tagged notes, and the version grammar.
const NOTES_HEX_RE = /(?<![0-9a-f])(?:[0-9a-f]{64}|[0-9a-f]{40})(?![0-9a-f])/i;

function successStdout({ version, tag, commit, tree, archive, sha, notes }) {
  return lines([`RELEASE  OK  ${version}`, `TAG  ${tag}`, `COMMIT  ${commit}`, `TREE  ${tree}`, `ARCHIVE  ${archive}`, `SHA256  ${sha}`, `NOTES  ${notes}`, 'PUBLICATION  pending']);
}
// Plan 3.5: the exact publication-note bytes.
function publicationText({ version, tag, commit, tree, sha, notes }) {
  const head = lines([`# project-setup ${version} publication notes`, '', `Tag: ${tag}`, `Commit: ${commit}`, `Project-setup tree: ${tree}`, `Archive: project-setup-${version}.zip`, `Archive SHA256: ${sha}`, '']);
  return Buffer.concat([Buffer.from(head, 'utf8'), notes]);
}
const fwd = (p) => String(p).replace(/\\/g, '/');
// Plan 3.3: the seven Git operation vectors, exactly, after the common two-option prefix.
function expectedGitArgvs(canonicalRepository, { tag, commit, tree, version }) {
  const prefix = ['-c', `safe.directory=${fwd(canonicalRepository)}`, '-c', `core.attributesFile=${os.devNull}`];
  return [
    [...prefix, 'rev-parse', '--show-toplevel'],
    [...prefix, 'rev-parse', '--verify', '--end-of-options', `refs/tags/${tag}^{commit}`],
    [...prefix, 'rev-parse', '--verify', '--end-of-options', `${commit}:project-setup`],
    [...prefix, 'cat-file', '-t', tree],
    [...prefix, 'cat-file', 'blob', `${commit}:project-setup/VERSION`],
    [...prefix, 'cat-file', 'blob', `${commit}:project-setup/RELEASE-NOTES-${version}.md`],
    [...prefix, 'archive', '--format=zip', commit, 'project-setup/'],
  ];
}
// Plan 3.2: the Git environment keeps every non-GIT_ entry and carries exactly six pinned settings.
function expectedGitEnv(env) {
  const out = {};
  for (const [k, v] of Object.entries(env)) if (!/^GIT_/i.test(k)) out[k] = v;
  return Object.assign(out, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: os.devNull, GIT_ATTR_NOSYSTEM: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' });
}
// PLAN-GAP (plan 3.2): the plan pins GIT_CONFIG_GLOBAL=<os.devNull>. On Windows Node's os.devNull is "\\.\nul" and Git for Windows 2.53 exits 128 ("unable to access '\\.\nul': Invalid argument") for that value,
// so a builder that sets it literally cannot run a real Git command there (core.attributesFile=<os.devNull> is accepted). The tests therefore accept either os.devNull or the Windows null device spelling "NUL"
// for GIT_CONFIG_GLOBAL only; every other entry is compared exactly and core.attributesFile stays os.devNull.
const DEVNULL_SPELLINGS = process.platform === 'win32' ? [os.devNull, 'NUL'] : [os.devNull];
function gitEnvMatches(actual, want) {
  const a = { ...actual }; const w = { ...want };
  const g = a.GIT_CONFIG_GLOBAL;
  delete a.GIT_CONFIG_GLOBAL; delete w.GIT_CONFIG_GLOBAL;
  return DEVNULL_SPELLINGS.includes(g) && eq(a, w);
}
const EXPECTED_OPTION_KEYS = ['cwd', 'env', 'shell', 'windowsHide', 'encoding', 'timeout', 'maxBuffer'].sort();
function classifyOp(argv) {
  const r = argv.slice(4);
  if (r[0] === 'rev-parse' && r[1] === '--show-toplevel') return 'toplevel';
  if (r[0] === 'rev-parse' && r[1] === '--verify' && r[2] === '--end-of-options') return /^refs\/tags\//.test(String(r[3])) ? 'commit' : 'tree';
  if (r[0] === 'cat-file' && r[1] === '-t') return 'type';
  if (r[0] === 'cat-file' && r[1] === 'blob') return /RELEASE-NOTES-/.test(String(r[2])) ? 'notes' : 'version';
  if (r[0] === 'archive') return 'archive';
  return 'unknown';
}

// =============================================================== ZIP reader ====
// Plan 5.3: a small tests-only reader for stored and deflated entries (Node buffers and zlib only). It rejects malformed metadata, duplicate names and unsupported compression.
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function readZip(buf) {
  const bad = (m) => { throw new Error(`zip: ${m}`); };
  if (!Buffer.isBuffer(buf) || buf.length < 22) bad('too short');
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) bad('no end of central directory');
  const count = buf.readUInt16LE(eocd + 10); const cdSize = buf.readUInt32LE(eocd + 12); const cdOff = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) bad('zip64 is not supported');
  if (buf.readUInt16LE(eocd + 4) !== 0 || buf.readUInt16LE(eocd + 6) !== 0 || buf.readUInt16LE(eocd + 8) !== count) bad('multi-disk archive');
  if (cdOff + cdSize > eocd) bad('central directory out of range');
  const entries = []; const names = new Set();
  let p = cdOff;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) bad(`bad central header ${i}`);
    const flags = buf.readUInt16LE(p + 8); const method = buf.readUInt16LE(p + 10); const crc = buf.readUInt32LE(p + 16);
    const compSize = buf.readUInt32LE(p + 20); const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28); const extraLen = buf.readUInt16LE(p + 30); const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    if (compSize === 0xffffffff || size === 0xffffffff || localOff === 0xffffffff) bad('zip64 entry');
    if (flags & 1) bad('encrypted entry');
    if (method !== 0 && method !== 8) bad(`unsupported compression ${method}`);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    if (names.has(name)) bad(`duplicate entry ${name}`);
    names.add(name);
    if (localOff + 30 > buf.length || buf.readUInt32LE(localOff) !== 0x04034b50) bad(`bad local header for ${name}`);
    const lName = buf.readUInt16LE(localOff + 26); const lExtra = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lName + lExtra;
    if (start + compSize > buf.length) bad(`entry data out of range for ${name}`);
    const raw = buf.subarray(start, start + compSize);
    const dir = name.endsWith('/');
    let data = Buffer.alloc(0);
    if (!dir) {
      data = method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw);
      if (data.length !== size) bad(`size mismatch for ${name}`);
      if (crc32(data) !== crc) bad(`crc mismatch for ${name}`);
    } else if (size !== 0) bad(`directory entry with data ${name}`);
    entries.push({ name, dir, method, data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (p !== cdOff + cdSize) bad('central directory size mismatch');
  return entries;
}

// ===================================================== scripted executor and fs seam ====
// A result with every field the plan requires of an executor (plan 3.2).
const okRes = (buf) => ({ status: 0, signal: null, error: null, stdout: Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf)), stderr: Buffer.alloc(0) });
const NATIVE_STDERR = 'SENTINEL-NATIVE-GIT-STDERR';
const nonzero = (status = 128) => ({ status, signal: null, error: null, stdout: Buffer.alloc(0), stderr: Buffer.from(NATIVE_STDERR) });
const REJECT = Symbol('reject');
const THROW = Symbol('throw');
const asBuf = (s) => Buffer.from(s, 'utf8');
const FAKE_COMMIT = 'a1'.repeat(20);
const FAKE_TREE = 'b2'.repeat(20);
const FAKE_NOTES = asBuf(lines(['# project-setup 3.0.0-rc.2', '', 'Fixture notes without any object identifier.']));
const FAKE_ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from([0x0d, 0x0a, 0xff, 0xfe, 0x00, 0x7f, 0x80]), Buffer.from('raw zip bytes are never decoded or rewritten')]);
// The scripted executor answers each of the seven operations from `spec` (a value, a function of the call, THROW or REJECT) and records every call.
function scriptedExecutor(spec = {}) {
  const calls = [];
  const base = {
    toplevel: spec.toplevelBytes, commit: okRes(`${FAKE_COMMIT}\n`), tree: okRes(`${FAKE_TREE}\n`), type: okRes('tree\n'),
    version: okRes(`${CANDIDATE_VERSION}\n`), notes: okRes(FAKE_NOTES), archive: okRes(FAKE_ZIP),
  };
  const fn = (exe, argv, options) => {
    const op = classifyOp(argv);
    calls.push({ exe, argv: [...argv], options, op });
    let res = Object.prototype.hasOwnProperty.call(spec, op) ? spec[op] : base[op];
    if (typeof res === 'function') res = res({ exe, argv, options, calls });
    if (res === THROW) throw new Error(`scripted executor failure ${NATIVE_STDERR}`);
    if (res === REJECT) return Promise.reject(new Error(`scripted executor rejection ${NATIVE_STDERR}`));
    if (res === undefined) throw new Error(`scripted executor has no answer for ${op}`);
    return res;
  };
  fn.calls = calls;
  return fn;
}
const fakeTopLevel = (repo) => okRes(`${fwd(repo)}\n`);

// The filesystem seam (plan 3.2): exactly lstatSync, realpathSync (a function carrying .native), mkdirSync and writeFileSync. Every call is recorded in `events`; an override receives (args, real)
// and may call real() itself, throw, or return a value.
function makeSeam(over = {}, events = []) {
  const wrap = (name, real) => (...args) => {
    events.push({ op: name, args });
    if (typeof over[name] === 'function') return over[name](args, () => real(...args));
    return real(...args);
  };
  const realpathSync = Object.assign((...a) => { events.push({ op: 'realpath', args: a }); return fs.realpathSync(...a); }, { native: wrap('realpath.native', (p) => fs.realpathSync.native(p)) });
  const seam = { lstatSync: wrap('lstat', (p) => fs.lstatSync(p)), realpathSync, mkdirSync: wrap('mkdir', (...a) => fs.mkdirSync(...a)), writeFileSync: wrap('write', (...a) => fs.writeFileSync(...a)) };
  return { fs: Object.freeze(seam), events, objectShape() { return Object.freeze({ ...seam, realpathSync: { native: seam.realpathSync.native } }); } };
}
const enoent = (p) => Object.assign(new Error(`ENOENT: no such file or directory, lstat '${p}'`), { code: 'ENOENT' });
const errCode = (code) => Object.assign(new Error(`${code}: injected ${NATIVE_STDERR}`), { code });
const ofOp = (events, ...ops) => events.filter((e) => ops.includes(e.op));
// Releases a process-level handle: a main() call never writes streams, exits or sets exitCode.
async function callMain(rel, argv, deps) {
  const rec = await withStreamGuard(() => rel.main(argv, deps));
  return rec;
}
function checkQuiet(check, label, rec) {
  check(rec.threw === null, `${label}: main resolves and never rejects`, rec.threw && errMsg(rec.threw));
  check(rec.out.length === 0 && rec.err.length === 0, `${label}: main writes no process stream`, { out: rec.out.join('').slice(0, 100), err: rec.err.join('').slice(0, 100) });
  check(rec.exits.length === 0 && !rec.exitCodeChanged, `${label}: main neither calls process.exit nor sets process.exitCode`, rec.exits);
}
// Asserts the exact { exitCode, stdout, stderr } result; returns it (or null).
function expectResult(check, label, rec, want) {
  checkQuiet(check, label, rec);
  const v = rec.value;
  const shaped = v !== null && typeof v === 'object' && eq(Object.keys(v).sort(), ['exitCode', 'stderr', 'stdout']);
  check(shaped, `${label}: main resolves to exactly { exitCode, stdout, stderr }`, v && Object.keys(v));
  check(shaped && eq(v, want), `${label}: the exact result`, shaped ? { exitCode: v.exitCode, stdout: v.stdout, stderr: v.stderr } : v);
  return shaped ? v : null;
}
const expectFail = (check, label, rec, code) => expectResult(check, `${label} (${code})`, rec, failResult(code));
async function importRelease(failures, context) {
  const rel = await importOrFail(failures, skillUrl(context, 'install/release.mjs'), 'install/release.mjs');
  if (rel && (typeof rel.main !== 'function' || typeof rel.parseReleaseArgs !== 'function')) { failures.push('install/release.mjs does not export main and parseReleaseArgs'); return null; }
  return rel;
}

// ============================================================= mini repository ====
// A directory that looks like a repository root for the filesystem preflight only (project-setup/ and .git/); Git itself is always scripted when this is used.
function miniRepo(dir, name = 'mini') {
  const repo = path.join(dir, name);
  fs.mkdirSync(path.join(repo, 'project-setup'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  return fs.realpathSync.native(repo);
}

// ===================================================================== world ====
// One synthetic release repository per suite run (plan 5.2 and 5.3): a temporary Git repository with isolated HOME, USERPROFILE, hooks, templates and configuration, explicit author, committer and
// commit time, no signing, and only synthetic tags. It holds the candidate subtree copied from the skill source in a commit, a dirty tracked file and an untracked sentinel in its working tree.
// Exactly two real release builds run against it (7 Git children each): build A is the direct Node child of the copy committed into the repository, build B an in-process call through the dependency seam
// with a recording real executor, started more than 2,100 ms after A completed. Every other Git stage in this file is a scripted or replayed result.
const WORLDS = new Map();
const WORLD_TAG = 'c11b-fixture-rc1';
function getWorld(context) {
  if (!WORLDS.has(context.tmp)) {
    const mark = processMark(context);
    WORLDS.set(context.tmp, buildWorld(context).catch((e) => ({ problems: [`world construction threw: ${errMsg(e)}`] })).then((w) => { flushProcessCount(context, 'release world', mark); return w; }));
  }
  return WORLDS.get(context.tmp);
}
function recordingExecutor(context, rec) {
  return (exe, argv, options) => {
    countProcess(context);
    const at = Date.now();
    const r = spawnSync(exe, argv, { ...options });
    const result = { status: r.status, signal: r.signal === undefined ? null : r.signal, error: r.error === undefined ? null : r.error, stdout: r.stdout, stderr: r.stderr };
    rec.push({ exe, argv: [...argv], options: { ...options }, result, at, op: classifyOp(argv) });
    return result;
  };
}
// Runs the named operations for real and replays the recorded real result of build B for the others.
function hybridExecutor(context, w, realOps, rec = []) {
  const real = recordingExecutor(context, rec);
  return (exe, argv, options) => {
    const op = classifyOp(argv);
    if (realOps.includes(op)) return real(exe, argv, options);
    return w.replay[op];
  };
}
function parseLsTree(buf) {
  const out = [];
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] !== 0) continue;
    const rec = buf.subarray(start, i); start = i + 1;
    const tab = rec.indexOf(0x09);
    const m = /^([0-7]{6}) ([a-z]+) ([0-9a-f]+)$/.exec(rec.subarray(0, tab).toString('latin1'));
    if (!m) throw new Error('unexpected ls-tree record');
    out.push({ mode: m[1], type: m[2], oid: m[3], path: rec.subarray(tab + 1).toString('utf8') });
  }
  return out;
}
function parseCatBatch(buf, oids) {
  const out = new Map(); let p = 0;
  for (const oid of oids) {
    const nl = buf.indexOf(0x0a, p);
    const m = /^([0-9a-f]+) (\w+) (\d+)$/.exec(buf.subarray(p, nl).toString('latin1'));
    if (!m || m[1] !== oid) throw new Error('unexpected cat-file --batch header');
    const size = Number(m[3]);
    out.set(oid, Buffer.from(buf.subarray(nl + 1, nl + 1 + size)));
    p = nl + 1 + size + 1;
  }
  return out;
}
// Raw, byte-exact snapshot of the working-tree subtree, the index and every file under .git, taken before any later Git command that might refresh metadata (plan 5.5).
function snapshotRepo(w) {
  const gitDir = path.join(w.repo, '.git');
  return { subtree: inventoryOf(path.join(w.repo, 'project-setup')), gitFiles: inventoryOf(gitDir), index: sha256(readBytes(path.join(gitDir, 'index')) || Buffer.alloc(0)), head: readText(path.join(gitDir, 'HEAD')), tagRef: readText(path.join(gitDir, 'refs', 'tags', WORLD_TAG)) };
}

async function buildWorld(context) {
  const dir = scratchDir(context, 'world');
  const iso = isolation(path.join(dir, 'iso'));
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(repo);
  const cleanEnv = CLEAN_ENV(iso);
  const w = { dir, iso, repo, cleanEnv, problems: [], tag: WORLD_TAG };
  const git = (args, opts) => mustGit(context, iso, repo, args, undefined, opts);
  git(['init', '-q']);
  fs.writeFileSync(path.join(repo, 'README.md'), 'synthetic repository without a project-setup tree\n');
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'commit without a subtree']);
  git(['tag', 'c11b-fixture-nosubtree']);
  copyTree(context.skillRoot, path.join(repo, 'project-setup'), (rel) => rel.split('/').some((s) => s === '.git' || s === 'node_modules'));
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'candidate subtree']);
  const ids = gitText(git(['rev-parse', 'HEAD', 'HEAD:project-setup', 'HEAD:project-setup/VERSION'])).trim().split('\n');
  [w.commit, w.tree, w.versionBlob] = ids;
  git(['tag', WORLD_TAG]);
  git(['tag', '-a', '-m', 'annotated fixture tag', 'c11b-fixture-annotated']);
  git(['tag', 'c11b-fixture-tree', w.tree]);
  git(['tag', 'c11b-fixture-blob', w.versionBlob]);
  git(['branch', 'c11b-fixture-branch']);
  // The independent oracle: the tagged subtree listing and every tagged blob, read with commands the builder does not use.
  w.entries = parseLsTree(gitBuf(git(['ls-tree', '-r', '-z', '--full-tree', w.commit, '--', 'project-setup/'])));
  const cat = git(['cat-file', '--batch'], { input: Buffer.from(w.entries.map((e) => `${e.oid}\n`).join('')) });
  const blobs = parseCatBatch(cat.stdout, w.entries.map((e) => e.oid));
  w.blobs = new Map(w.entries.map((e) => [e.path, blobs.get(e.oid)]));
  const versionBytes = w.blobs.get('project-setup/VERSION');
  const vm = versionBytes ? /^(\d+\.\d+\.\d+(?:-rc\.\d+)?)\n$/.exec(versionBytes.toString('utf8')) : null;
  if (!vm) w.problems.push('the tagged VERSION of the candidate subtree is not an LF-terminated release version');
  w.version = vm ? vm[1] : null;
  w.taggedNotes = w.version ? w.blobs.get(`project-setup/RELEASE-NOTES-${w.version}.md`) || null : null;
  // Dirty working tree: tracked files that differ from the commit and untracked sentinels. None of them may reach a release.
  w.dirty = { 'project-setup/VERSION': '9.9.9-dirty\n', 'project-setup/SKILL.md': `${(w.blobs.get('project-setup/SKILL.md') || Buffer.alloc(0)).toString('utf8')}\nDIRTY WORKING TREE LINE\n` };
  if (w.version) w.dirty[`project-setup/RELEASE-NOTES-${w.version}.md`] = 'DIRTY WORKING TREE NOTES\n';
  w.sentinels = { 'project-setup/untracked-sentinel.txt': 'untracked sentinel\n', 'project-setup/install/untracked-sentinel.mjs': '// untracked\n' };
  for (const [rel, text] of [...Object.entries(w.dirty), ...Object.entries(w.sentinels)]) putFile(path.join(repo, ...rel.split('/')), text);
  w.snap0 = snapshotRepo(w);
  w.canonicalRepo = fs.realpathSync.native(repo);

  // ---- build A: the direct Node child of the copy committed into the repository ----
  w.outA = path.join(dir, 'out-a');
  const script = path.join(repo, 'project-setup', 'install', 'release.mjs');
  w.resA = spawnNode(context, [script, '--tag', WORLD_TAG, '--out', w.outA], { cwd: dir, env: cleanEnv });
  countProcess(context, 7); // the seven Git children that the builder itself starts
  w.endA = Date.now();
  w.snapA = snapshotRepo(w);

  // ---- build B: in process through the dependency seam, strictly more than 2,100 ms after A completed ----
  await sleep(Math.max(0, 2150 - (Date.now() - w.endA)));
  w.outB = path.join(dir, 'out-b');
  const rel = await attempt(() => import(skillUrl(context, 'install/release.mjs')));
  if (rel.threw) w.problems.push(`cannot import install/release.mjs: ${errMsg(rel.error)}`);
  else if (typeof rel.value.main !== 'function') w.problems.push('install/release.mjs exports no main');
  else {
    w.recB = [];
    w.seamB = makeSeam();
    const noisyEnv = { ...cleanEnv, GIT_DIR: path.join(dir, 'no-such-git-dir'), git_work_tree: path.join(dir, 'no-such-tree'), GIT_SSL_NO_VERIFY: '1' };
    w.envB = noisyEnv;
    w.resB = (await callMain(rel.value, ['--out', w.outB, '--tag', WORLD_TAG], { repository: repo, cwd: dir, env: noisyEnv, execute: recordingExecutor(context, w.recB), fs: w.seamB.fs })).value;
    w.guardB = null;
  }
  w.endB = Date.now();
  w.snapB = snapshotRepo(w);
  w.replay = {};
  for (const c of w.recB || []) if (c.op && !w.replay[c.op]) w.replay[c.op] = c.result;
  const zipName = w.version ? `project-setup-${w.version}.zip` : 'project-setup-unknown.zip';
  w.zipName = zipName;
  w.zipA = readBytes(path.join(w.outA, zipName)); w.zipB = readBytes(path.join(w.outB, zipName));
  w.notesA = readBytes(path.join(w.outA, 'RELEASE-NOTES.md')); w.notesB = readBytes(path.join(w.outB, 'RELEASE-NOTES.md'));
  return w;
}
const gitBuf = (r) => r.stdout;
// A scripted executor that replays the recorded real results of build B, optionally overridden per operation.
function replaySpec(w, over = {}) { return { ...w.replay, ...over }; }
const worldMissing = (check, w, what) => { check(false, `${what}: the release world is unavailable`, w && w.problems); };

// ================================================ S07/C11b/release-cli ====
// Plan 3.1, 3.2, 3.4 and 5.1: the CLI grammar, the dependency seam, the path rules and the exact streams and exits. Matrices run in process; the only children are the success build of the release world,
// one usage launch and one import-safety probe.
const CTL = (n) => String.fromCharCode(n);
// C12-12: the absolute output is built with literal separators. path.join normalizes the ".." segment away, which silently turned the case into an ordinary
// path; the literal text keeps the segment, the interior space and the repeated space, and the parser must return exactly this string.
const ABSOLUTE_OUT = `${path.sep}a b${path.sep}..${path.sep}c  d`;
const PARSE_VALID = [
  ['tag first', ['--tag', 'c11b-fixture-rc1', '--out', 'rel/out'], { tag: 'c11b-fixture-rc1', out: 'rel/out' }],
  ['out first', ['--out', 'rel/out', '--tag', 'c11b-fixture-rc1'], { tag: 'c11b-fixture-rc1', out: 'rel/out' }],
  ['an absolute output with spaces and a literal .. segment is not normalized', ['--tag', 'project-setup-v3.0.0-rc.1', '--out', ABSOLUTE_OUT], { tag: 'project-setup-v3.0.0-rc.1', out: ABSOLUTE_OUT }],
  ['a relative parent output is not normalized', ['--tag', 'a', '--out', '../x/./y'], { tag: 'a', out: '../x/./y' }],
  ['the longest tag (128 characters)', ['--tag', `a${'b'.repeat(127)}`, '--out', 'o'], { tag: `a${'b'.repeat(127)}`, out: 'o' }],
  ['a hexadecimal-looking tag is a tag name', ['--tag', 'deadbeef'.repeat(5), '--out', 'o'], { tag: 'deadbeef'.repeat(5), out: 'o' }],
  ['tags are case sensitive and keep every allowed character', ['--tag', 'Tag.Case-1_x', '--out', 'o'], { tag: 'Tag.Case-1_x', out: 'o' }],
  ['a Windows drive output', ['--tag', 'x', '--out', 'C:\\work dir\\out'], { tag: 'x', out: 'C:\\work dir\\out' }],
];
const PARSE_INVALID = [
  ['no arguments', []], ['--tag without a value', ['--tag']], ['--out without a value', ['--out']], ['--name=value form', ['--tag=x', '--out', 'x']],
  ['duplicate --tag', ['--tag', 'x', '--tag', 'y', '--out', 'z']], ['duplicate --out', ['--tag', 'x', '--out', 'y', '--out', 'z']], ['an extra --help', ['--tag', 'x', '--out', 'y', '--help']],
  ['a revision expression as the tag', ['--tag', 'HEAD^{tree}', '--out', 'x']], ['a refs/tags prefix', ['--tag', 'refs/tags/x', '--out', 'x']], ['a traversing tag', ['--tag', '../x', '--out', 'x']],
  ['a double dot inside the tag', ['--tag', 'x..y', '--out', 'x']], ['a .lock suffix', ['--tag', 'x.lock', '--out', 'x']], ['a leading dash tag', ['--tag', '-x', '--out', 'x']],
  ['--tag missing', ['--out', 'x']], ['--out missing', ['--tag', 'x']], ['--tag value is the next option', ['--tag', '--out', 'x']], ['--out value missing at the end', ['--tag', 'x', '--out']],
  ['a positional command first', ['release', '--tag', 'x', '--out', 'y']], ['a trailing positional', ['--tag', 'x', '--out', 'y', 'z']], ['a leading --', ['--', '--tag', 'x', '--out', 'y']],
  ['--out=value form', ['--tag', 'x', '--out=y']], ['an unknown option', ['--tag', 'x', '--out', 'y', '--force']], ['--help alone', ['--help']],
  ['an empty tag', ['--tag', '', '--out', 'x']], ['an empty output', ['--tag', 'x', '--out', '']],
  ['NUL in the tag', ['--tag', `x${CTL(0)}`, '--out', 'y']], ['U+001F in the output', ['--tag', 'x', '--out', `y${CTL(31)}`]], ['DEL in the output', ['--tag', 'x', '--out', `y${CTL(127)}`]],
  ['LF in the output', ['--tag', 'x', '--out', `y${CTL(10)}z`]], ['TAB in the tag', ['--tag', `x${CTL(9)}y`, '--out', 'o']], ['CR in the tag', ['--tag', `x${CTL(13)}`, '--out', 'o']],
  ['an output beginning with a dash', ['--tag', 'x', '--out', '-y']], ['an output beginning with two dashes', ['--tag', 'x', '--out', '--y']],
  ['a non-string tag', ['--tag', 5, '--out', 'x']], ['a null element', ['--tag', null, '--out', 'x']], ['an undefined output', ['--tag', 'x', '--out', undefined]],
  ['a tag with a space', ['--tag', 'a b', '--out', 'x']], ['a tag with a slash', ['--tag', 'a/b', '--out', 'x']], ['a tag with a leading dot', ['--tag', '.x', '--out', 'x']],
  ['a tag with a final dot', ['--tag', 'x.', '--out', 'x']], ['a tag with a colon', ['--tag', 'a:b', '--out', 'x']], ['a tag with a caret', ['--tag', 'a^b', '--out', 'x']],
  ['a tag with a tilde', ['--tag', 'a~1', '--out', 'x']], ['a tag with @{', ['--tag', 'a@{1}', '--out', 'x']], ['a tag with a star', ['--tag', 'a*', '--out', 'x']],
  ['a tag with a backslash', ['--tag', 'a\\b', '--out', 'x']], ['a 129 character tag', ['--tag', 'a'.repeat(129), '--out', 'x']], ['a non-ASCII tag', ['--tag', `caf${CTL(0xe9)}`, '--out', 'x']],
  ['a tag of two dots', ['--tag', '..', '--out', 'x']], ['a tag that is only .lock after a name', ['--tag', 'a.lock', '--out', 'x']],
  ['a tag with a semicolon', ['--tag', 'a;b', '--out', 'x']], ['a tag with a dollar sign', ['--tag', 'a$b', '--out', 'x']], ['a tag with an ampersand', ['--tag', 'a&b', '--out', 'x']],
  ['a tag with a pipe', ['--tag', 'a|b', '--out', 'x']], ['a tag with a quote', ['--tag', "a'b", '--out', 'x']],
];
const NON_ARRAYS = [['undefined', undefined], ['null', null], ['a string', '--tag x --out y'], ['an object', { 0: '--tag', 1: 'x', 2: '--out', 3: 'y', length: 4 }], ['a number', 4], ['a Set', new Set(['--tag', 'x', '--out', 'y'])]];

async function releaseCli(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mark = processMark(context);
    const rel = await importRelease(failures, context);
    if (!rel) return;
    await step('plan 2.4: exactly main and parseReleaseArgs, no default export, import safety (a probe process: nothing printed, nothing written) and no top-level await', async () => {
      check(eq(Object.keys(rel).sort(), ['main', 'parseReleaseArgs']) && !('default' in rel), 'install/release.mjs exports exactly main and parseReleaseArgs', Object.keys(rel));
      const text = readText(skillPath(context, 'install/release.mjs'));
      check(text !== null && !/^(?:await\s|for\s+await\s|(?:const|let|var)\s+[^=\n]*=\s*await\s)/m.test(text), 'no top-level await at module scope');
      await withScratch(context, 'probe', async (dir) => {
        const r = spawnNode(context, ['--input-type=module', '-e', `import * as m from ${JSON.stringify(skillUrl(context, 'install/release.mjs'))}; process.stdout.write(JSON.stringify(Object.keys(m).sort()));`], { cwd: dir });
        check(r.status === 0 && r.stdout === '["main","parseReleaseArgs"]' && r.stderr === '', 'importing the module prints nothing and exposes only the two exports', { status: r.status, stdout: r.stdout.slice(0, 120), stderr: r.stderr.slice(0, 120) });
        check(fs.readdirSync(dir).length === 0, 'importing the module writes nothing into the working directory');
      });
    });
    await step('plan 3.1: parseReleaseArgs is synchronous and pure and returns the exact supplied strings for every valid form (frozen input is never modified)', async () => {
      // C12-12: the absolute-output input really contains the literal parent segment, the interior space and the repeated space before the parser sees it.
      const absoluteRow = PARSE_VALID.find((r) => r[0].startsWith('an absolute output with spaces'));
      check(absoluteRow !== undefined && absoluteRow[1][3] === ABSOLUTE_OUT && ABSOLUTE_OUT.split(path.sep).includes('..') && ABSOLUTE_OUT.includes('a b') && ABSOLUTE_OUT.includes('c  d') && path.isAbsolute(ABSOLUTE_OUT) && ABSOLUTE_OUT !== path.normalize(ABSOLUTE_OUT), 'the absolute output input keeps the literal .. segment and its spaces (it is not already normalized)', ABSOLUTE_OUT);
      for (const [label, argv, want] of PARSE_VALID) {
        const frozen = deepFreeze([...argv]);
        const r = attempt(() => rel.parseReleaseArgs(frozen));
        const out = await r;
        check(!out.threw && eq(out.value, want) && eq(Object.keys(out.value), ['tag', 'out']), `${label}: exactly { tag, out } with the supplied strings`, out.threw ? errMsg(out.error) : out.value);
      }
      const sync = rel.parseReleaseArgs(['--tag', 'x', '--out', 'y']);
      check(sync !== null && typeof sync === 'object' && typeof sync.then !== 'function', 'parseReleaseArgs returns its value synchronously');
    });
    await step('plan 3.1: every invalid argv throws an Error with code RELEASE_USAGE and the exact message (each grammar rejection independently), including non-array argv', async () => {
      for (const [label, argv] of [...PARSE_INVALID, ...NON_ARRAYS.map(([l, v]) => [`a non-array argv (${l})`, v])]) {
        const out = await attempt(() => rel.parseReleaseArgs(argv));
        const e = out.error;
        check(out.threw && e instanceof Error && e.code === 'RELEASE_USAGE' && e.message === USAGE_MESSAGE, `${label}: throws Error { code: RELEASE_USAGE, message: "${USAGE_MESSAGE}" }`, out.threw ? { code: e && e.code, message: e && e.message } : { returned: out.value });
      }
    });
    await step('plan 3.4 and 5.1: main turns every invalid argv into exit 1, empty stdout and the exact RELEASE_USAGE stderr line (no stream write, no exit code), before any dependency is touched', async () => {
      await withScratch(context, 'usage', async (dir) => {
        const repo = miniRepo(dir);
        const calls = []; const seam = makeSeam();
        const trap = () => { calls.push(1); throw new Error('the executor must not be called'); };
        const good = { repository: repo, cwd: dir, env: { PATH: 'x' }, execute: trap, fs: seam.fs };
        for (const [label, argv] of [...PARSE_INVALID, ...NON_ARRAYS.map(([l, v]) => [`a non-array argv (${l})`, v])]) expectFail(check, `main ${label}`, await callMain(rel, argv, good), 'RELEASE_USAGE');
        check(calls.length === 0 && seam.events.length === 0, 'no executor call and no filesystem operation for any argv error', { calls: calls.length, events: seam.events.length });
        // Argument validation precedes dependency validation: invalid argv with invalid dependencies, and a non-array argv with invalid dependencies, both give the usage result.
        for (const deps of [null, 5, { bogus: 1 }, { repository: 5 }, { fs: null }, { execute: 'x' }]) {
          expectFail(check, `invalid argv with dependencies ${show(deps)}`, await callMain(rel, ['--tag'], deps), 'RELEASE_USAGE');
          expectFail(check, `a non-array argv with dependencies ${show(deps)}`, await callMain(rel, 'not-an-array', deps), 'RELEASE_USAGE');
        }
        expectFail(check, 'invalid argv with omitted dependencies', await callMain(rel, ['--help']), 'RELEASE_USAGE');
        expectFail(check, 'invalid argv with undefined dependencies', await callMain(rel, [], undefined), 'RELEASE_USAGE');
      });
    });
    await step('plan 3.2: invalid dependencies with valid argv give the exact RELEASE_OPTIONS result before any filesystem or process access (null dependencies, unknown keys, bad values and bad filesystem seams)', async () => {
      await withScratch(context, 'options', async (dir) => {
        const repo = miniRepo(dir);
        const out = path.join(dir, 'never-created');
        const argv = ['--tag', 'x', '--out', out];
        const calls = []; const seam = makeSeam();
        const trap = () => { calls.push(1); throw new Error('the executor must not be called'); };
        const base = () => ({ repository: repo, cwd: dir, env: { PATH: 'x' }, execute: trap, fs: seam.fs });
        const f = seam.fs;
        const withFs = (patch) => ({ ...base(), fs: { ...f, ...patch } });
        const without = (k) => { const o = { ...f }; delete o[k]; return o; };
        const bad = [
          ['null dependencies', null], ['a string', 'x'], ['a number', 5], ['an array', []], ['a function', () => {}],
          ['an unknown key', { ...base(), extra: 1 }], ['an unknown key beside valid ones is not ignored', { ...base(), shell: true }],
          ['a nonstring repository', { ...base(), repository: 5 }], ['an empty repository', { ...base(), repository: '' }], ['a relative repository', { ...base(), repository: 'rel/repo' }], ['a null repository', { ...base(), repository: null }],
          ['a nonstring cwd', { ...base(), cwd: 5 }], ['an empty cwd', { ...base(), cwd: '' }], ['a relative cwd', { ...base(), cwd: 'rel' }], ['a null cwd', { ...base(), cwd: null }],
          ['a null env', { ...base(), env: null }], ['an array env', { ...base(), env: [] }], ['a string env', { ...base(), env: 'PATH=x' }], ['a numeric env value', { ...base(), env: { A: 1 } }], ['a null env value', { ...base(), env: { A: null } }],
          ['a nonfunction execute', { ...base(), execute: 'x' }], ['a null execute', { ...base(), execute: null }], ['an object execute', { ...base(), execute: {} }],
          ['a null fs', { ...base(), fs: null }], ['a string fs', { ...base(), fs: 'fs' }], ['an array fs', { ...base(), fs: [] }], ['an empty fs object', { ...base(), fs: {} }],
          ['fs without lstatSync', { ...base(), fs: without('lstatSync') }], ['fs without realpathSync', { ...base(), fs: without('realpathSync') }], ['fs without mkdirSync', { ...base(), fs: without('mkdirSync') }], ['fs without writeFileSync', { ...base(), fs: without('writeFileSync') }],
          ['fs with an unknown member', withFs({ readFileSync: () => Buffer.alloc(0) })], ['a nonfunction lstatSync', withFs({ lstatSync: 'x' })], ['a nonfunction mkdirSync', withFs({ mkdirSync: {} })], ['a nonfunction writeFileSync', withFs({ writeFileSync: null })],
          ['a null realpathSync', withFs({ realpathSync: null })], ['a numeric realpathSync', withFs({ realpathSync: 5 })], ['a realpathSync function without .native', withFs({ realpathSync: (p) => p })],
          ['a realpathSync object without .native', withFs({ realpathSync: {} })], ['a realpathSync object with a nonfunction .native', withFs({ realpathSync: { native: 'x' } })],
          ['a realpathSync function with a nonfunction .native', withFs({ realpathSync: Object.assign((p) => p, { native: 5 }) })],
        ];
        for (const [label, deps] of bad) expectFail(check, `dependencies: ${label}`, await callMain(rel, argv, deps), 'RELEASE_OPTIONS');
        check(calls.length === 0 && seam.events.length === 0 && !exists(out), 'no executor call, no filesystem call and nothing created for any dependency error', { calls: calls.length, events: seam.events.length });
      });
    });
    await step('plan 3.2 and 5.1: both realpathSync seam shapes (a function carrying .native and an object { native }) pass dependency validation, and an omitted or undefined dependencies argument is accepted as the defaults', async () => {
      await withScratch(context, 'shapes', async (dir) => {
        const repo = miniRepo(dir);
        const argv = ['--tag', 'x', '--out', path.join(dir, 'unused')];
        for (const [label, mk] of [['a function carrying .native', (s) => s.fs], ['an object { native }', (s) => s.objectShape()]]) {
          const seam = makeSeam();
          const exec = scriptedExecutor({ toplevel: nonzero() });
          const rec = await callMain(rel, argv, { repository: repo, cwd: dir, env: { PATH: 'x' }, execute: exec, fs: mk(seam) });
          expectFail(check, `realpathSync as ${label} passes validation and reaches the repository check`, rec, 'RELEASE_REPOSITORY');
          check(exec.calls.length === 1 && ofOp(seam.events, 'realpath.native').length >= 2 && ofOp(seam.events, 'realpath').length === 0, `${label}: only realpathSync.native is called, before the first Git operation`, { calls: exec.calls.length, native: ofOp(seam.events, 'realpath.native').length, plain: ofOp(seam.events, 'realpath').length });
        }
      });
    });
    await step('plan 3.2 and 3.3: the path preflight order (native realpath before lstat of the canonical repository and parent, destination checks, then Git), the exact calls of a successful build and canonical printed paths', async () => {
      await withScratch(context, 'order', async (dir) => {
        const repo = miniRepo(dir);
        const events = [];
        const seam = makeSeam({}, events);
        const exec = scriptedExecutor({ toplevel: fakeTopLevel(repo) });
        const exe = (...a) => { events.push({ op: `git:${classifyOp(a[1])}`, args: [] }); return exec(...a); };
        const outRel = 'rel-out';
        const rec = await callMain(rel, ['--out', outRel, '--tag', 'c11b-fixture-rc1'], { repository: repo, cwd: dir, env: { PATH: 'x' }, execute: exe, fs: seam.fs });
        const canonicalOut = path.join(dir, outRel);
        const zipPath = path.join(canonicalOut, `project-setup-${CANDIDATE_VERSION}.zip`);
        const notesPath = path.join(canonicalOut, 'RELEASE-NOTES.md');
        const sha = sha256(FAKE_ZIP);
        expectResult(check, 'relative output', rec, { exitCode: 0, stdout: successStdout({ version: CANDIDATE_VERSION, tag: 'c11b-fixture-rc1', commit: FAKE_COMMIT, tree: FAKE_TREE, archive: zipPath, sha, notes: notesPath }), stderr: '' });
        const idx = (pred) => events.findIndex(pred);
        const at = {
          realRepo: idx((e) => e.op === 'realpath.native' && samePath(e.args[0], repo)),
          lstatRepo: idx((e) => e.op === 'lstat' && samePath(e.args[0], repo)),
          realParent: idx((e) => e.op === 'realpath.native' && samePath(e.args[0], dir)),
          lstatParent: idx((e) => e.op === 'lstat' && samePath(e.args[0], dir)),
          lstatDest: idx((e) => e.op === 'lstat' && samePath(e.args[0], canonicalOut)),
          firstGit: idx((e) => e.op.startsWith('git:')),
          mkdir: idx((e) => e.op === 'mkdir'), writeZip: idx((e) => e.op === 'write' && samePath(e.args[0], zipPath)), writeNotes: idx((e) => e.op === 'write' && samePath(e.args[0], notesPath)),
        };
        const seq = ['realRepo', 'lstatRepo', 'realParent', 'lstatParent', 'lstatDest', 'firstGit', 'mkdir', 'writeZip', 'writeNotes'].map((k) => at[k]);
        check(seq.every((x, i) => x >= 0 && (i === 0 || x > seq[i - 1])), 'realpath.native(repository), lstat(canonical repository), realpath.native(parent), lstat(canonical parent), the destination lstat, the first Git operation, mkdir, ZIP write, notes write, in that order', at);
        check(eq(exec.calls.map((c) => c.op), OP_ORDER), 'the seven Git operations run in the plan order', exec.calls.map((c) => c.op));
        const mk = events.filter((e) => e.op === 'mkdir'); const wr = events.filter((e) => e.op === 'write');
        check(mk.length === 1 && mk[0].args.length === 1 && samePath(mk[0].args[0], canonicalOut), 'mkdirSync is called once with exactly the canonical output directory and no options (non-recursive)', mk.map((m) => m.args));
        check(wr.length === 2 && wr.every((x) => x.args.length === 3 && Buffer.isBuffer(x.args[1]) && eq(x.args[2], { flag: 'wx' })), 'both output writes receive a Buffer and exactly { flag: "wx" }', wr.map((x) => [x.args[0], Buffer.isBuffer(x.args[1]), x.args[2]]));
        check(wr.length === 2 && samePath(wr[0].args[0], zipPath) && Buffer.compare(wr[0].args[1], FAKE_ZIP) === 0, 'the ZIP is written first and holds the raw archive stdout bytes unchanged', wr[0] && wr[0].args[0]);
        const wantNotes = publicationText({ version: CANDIDATE_VERSION, tag: 'c11b-fixture-rc1', commit: FAKE_COMMIT, tree: FAKE_TREE, sha, notes: FAKE_NOTES });
        check(wr.length === 2 && samePath(wr[1].args[0], notesPath) && Buffer.compare(wr[1].args[1], wantNotes) === 0, 'RELEASE-NOTES.md is written second with the exact publication bytes', wr[1] && wr[1].args[0]);
        check(readBytes(zipPath) !== null && Buffer.compare(readBytes(zipPath), FAKE_ZIP) === 0 && eq(fs.readdirSync(canonicalOut).sort(), [`project-setup-${CANDIDATE_VERSION}.zip`, 'RELEASE-NOTES.md'].sort()), 'the output directory holds exactly the two files');
        check(ofOp(events, 'lstat').every((e) => typeof e.args[0] === 'string' && path.isAbsolute(e.args[0])) && ofOp(events, 'realpath.native').every((e) => path.isAbsolute(e.args[0])), 'every filesystem call receives an absolute path');
      });
    });
    await step('plan 3.2: output path rules (direct child of project-setup, project-setup itself, mixed case, .git, aliases into either, an existing file, empty directory, junction or dangling link, a missing parent, an allowed sibling prefix and an allowed external parent alias)', async () => {
      await withScratch(context, 'paths', async (dir) => {
        const repo = miniRepo(dir);
        const argvFor = (out) => ['--tag', 'x', '--out', out];
        const run = (out, over = {}, seamOver = {}) => {
          const seam = makeSeam(seamOver);
          const exec = scriptedExecutor({ toplevel: fakeTopLevel(repo), ...over });
          return callMain(rel, argvFor(out), { repository: repo, cwd: dir, env: { PATH: 'x' }, execute: exec, fs: seam.fs }).then((rec) => ({ rec, exec, seam }));
        };
        const expectCode = async (label, out, code) => { const r = await run(out); expectFail(check, label, r.rec, code); check(r.exec.calls.length === 0, `${label}: no Git operation runs`, r.exec.calls.length); return r; };
        await expectCode('a direct child of project-setup', path.join(repo, 'project-setup', 'new'), 'RELEASE_OUT_SOURCE');
        await expectCode('project-setup itself', path.join(repo, 'project-setup'), 'RELEASE_OUT_SOURCE');
        await expectCode('a missing parent beneath project-setup is a parent error first', path.join(repo, 'project-setup', 'missing', 'x'), 'RELEASE_OUT_PARENT');
        await expectCode('the .git directory itself', path.join(repo, '.git'), 'RELEASE_OUT_SOURCE');
        await expectCode('a child of .git', path.join(repo, '.git', 'new'), 'RELEASE_OUT_SOURCE');
        if (WIN) {
          await expectCode('a mixed-case Windows spelling of a child of project-setup', path.join(repo, 'PROJECT-SETUP', 'New'), 'RELEASE_OUT_SOURCE');
          await expectCode('a mixed-case Windows spelling of project-setup itself', path.join(repo, 'Project-Setup'), 'RELEASE_OUT_SOURCE');
          await expectCode('a mixed-case Windows spelling of .git', path.join(repo, '.GIT', 'x'), 'RELEASE_OUT_SOURCE');
        }
        const psAlias = path.join(dir, 'ps-alias');
        if (!linkDir(path.join(repo, 'project-setup'), psAlias)) check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'} onto project-setup`);
        else {
          await expectCode('an outside alias onto project-setup, spelled outside it', path.join(psAlias, 'out'), 'RELEASE_OUT_SOURCE');
          const leaf = await run(psAlias);
          const l = leaf.rec.value;
          // PLAN-GAP: an existing leaf alias onto project-setup is either an existing destination or an alias into the source; the plan fixes neither classification, so only the two codes are accepted.
          check(l && l.exitCode === 2 && l.stdout === '' && [failResult('RELEASE_OUT_SOURCE').stderr, failResult('RELEASE_OUT_EXISTS').stderr].includes(l.stderr), 'an existing leaf alias onto project-setup is refused with RELEASE_OUT_SOURCE or RELEASE_OUT_EXISTS', l);
        }
        const gitAlias = path.join(dir, 'git-alias');
        if (linkDir(path.join(repo, '.git'), gitAlias)) await expectCode('an outside alias onto .git', path.join(gitAlias, 'out'), 'RELEASE_OUT_SOURCE');
        else check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'} onto .git`);
        // Existing destinations in every form.
        const aFile = path.join(dir, 'a-file'); fs.writeFileSync(aFile, 'x');
        const anEmpty = path.join(dir, 'an-empty-dir'); fs.mkdirSync(anEmpty);
        await expectCode('an existing file', aFile, 'RELEASE_OUT_EXISTS');
        await expectCode('an existing empty directory', anEmpty, 'RELEASE_OUT_EXISTS');
        const target = path.join(dir, 'link-target'); fs.mkdirSync(target);
        const junction = path.join(dir, 'a-junction');
        if (linkDir(target, junction)) await expectCode('an existing junction', junction, 'RELEASE_OUT_EXISTS'); else check(false, 'cannot create a directory link for the existing-junction case');
        const dangling = path.join(dir, 'dangling');
        const gone = path.join(dir, 'gone-target'); fs.mkdirSync(gone);
        if (linkDir(gone, dangling)) { fs.rmdirSync(gone); await expectCode('a dangling link', dangling, 'RELEASE_OUT_EXISTS'); } else check(false, 'cannot create a directory link for the dangling-link case');
        check(fs.readdirSync(anEmpty).length === 0 && readText(aFile) === 'x', 'no existing destination was overwritten or cleaned');
        await expectCode('a missing parent', path.join(dir, 'missing-parent', 'out'), 'RELEASE_OUT_PARENT');
        await expectCode('a parent that is a regular file', path.join(aFile, 'out'), 'RELEASE_OUT_PARENT');
        check(!exists(path.join(dir, 'missing-parent')), 'no parent directory is ever created');
        // Allowed: a sibling whose name merely starts with project-setup, and an external parent alias.
        const sibling = path.join(repo, 'project-setup-output');
        const ok1 = await run(sibling);
        expectResult(check, 'an allowed sibling named project-setup-output', ok1.rec, { exitCode: 0, stdout: successStdout({ version: CANDIDATE_VERSION, tag: 'x', commit: FAKE_COMMIT, tree: FAKE_TREE, archive: path.join(sibling, `project-setup-${CANDIDATE_VERSION}.zip`), sha: sha256(FAKE_ZIP), notes: path.join(sibling, 'RELEASE-NOTES.md') }), stderr: '' });
        const realParent = path.join(dir, 'real-parent'); fs.mkdirSync(realParent);
        const aliasParent = path.join(dir, 'alias-parent');
        if (!linkDir(realParent, aliasParent)) check(false, `cannot create the ${WIN ? 'junction' : 'directory symlink'} for the external parent alias`);
        else {
          const canonicalParent = fs.realpathSync.native(aliasParent);
          const r = await run(path.join(aliasParent, 'out1'));
          const canonicalOut = path.join(canonicalParent, 'out1');
          expectResult(check, 'an allowed external parent alias', r.rec, { exitCode: 0, stdout: successStdout({ version: CANDIDATE_VERSION, tag: 'x', commit: FAKE_COMMIT, tree: FAKE_TREE, archive: path.join(canonicalOut, `project-setup-${CANDIDATE_VERSION}.zip`), sha: sha256(FAKE_ZIP), notes: path.join(canonicalOut, 'RELEASE-NOTES.md') }), stderr: '' });
          const wr = r.seam.events.filter((e) => e.op === 'write'); const mk = r.seam.events.filter((e) => e.op === 'mkdir');
          check(mk.length === 1 && samePath(mk[0].args[0], canonicalOut) && !lc(mk[0].args[0]).includes('alias-parent'), 'the output directory is created at the canonical spelling', mk.map((m) => m.args[0]));
          check(wr.length === 2 && wr.every((x) => samePath(path.dirname(x.args[0]), canonicalOut) && !lc(x.args[0]).includes('alias-parent')), 'both writes use the canonical parent spelling plus the supplied basename', wr.map((x) => x.args[0]));
          check(!lc(r.rec.value ? r.rec.value.stdout : '').includes('alias-parent'), 'neither printed path uses the alias spelling');
        }
      });
    });
    await step('plan 3.2 and 3.4: a repository-root alias is permitted; repository and parent filesystem failures; an exclusive-create race; non-ENOENT lstat errors on each destination spelling; and write failures through the exact seam (ZIP before notes, deterministic remaining inventory)', async () => {
      await withScratch(context, 'faults', async (dir) => {
        const repo = miniRepo(dir);
        const sha = sha256(FAKE_ZIP);
        const okStdout = (out, tag = 'x') => successStdout({ version: CANDIDATE_VERSION, tag, commit: FAKE_COMMIT, tree: FAKE_TREE, archive: path.join(out, `project-setup-${CANDIDATE_VERSION}.zip`), sha, notes: path.join(out, 'RELEASE-NOTES.md') });
        const mkRun = (out, seamOver = {}, over = {}, repository = repo) => {
          const seam = makeSeam(seamOver);
          const exec = scriptedExecutor({ toplevel: fakeTopLevel(repo), ...over });
          return callMain(rel, ['--tag', 'x', '--out', out], { repository, cwd: dir, env: { PATH: 'x' }, execute: exec, fs: seam.fs }).then((rec) => ({ rec, exec, seam }));
        };
        // Repository filesystem validity.
        const repoAlias = path.join(dir, 'repo-alias');
        if (linkDir(repo, repoAlias)) {
          const out = path.join(dir, 'via-repo-alias');
          const r = await mkRun(out, {}, {}, repoAlias);
          expectResult(check, 'a repository supplied through a junction alias', r.rec, { exitCode: 0, stdout: okStdout(out), stderr: '' });
          check(r.exec.calls.length === 7 && r.exec.calls.every((c) => c.options.cwd === repo && c.argv[1] === `safe.directory=${fwd(repo)}`), 'the canonical repository is the Git cwd and the safe.directory value', r.exec.calls.length && r.exec.calls[0].argv.slice(0, 2));
        } else check(false, 'cannot create a repository alias');
        const dirOut = (n) => path.join(dir, n);
        let r = await mkRun(dirOut('o1'), { 'realpath.native': (a, real) => { if (samePath(a[0], repo)) throw errCode('ENOENT'); return real(); } });
        expectFail(check, 'realpath of the repository fails', r.rec, 'RELEASE_REPOSITORY'); check(r.exec.calls.length === 0, 'no Git operation after a repository path failure');
        r = await mkRun(dirOut('o2'), { lstat: (a, real) => { if (samePath(a[0], repo)) throw errCode('EACCES'); return real(); } });
        expectFail(check, 'lstat of the canonical repository fails', r.rec, 'RELEASE_REPOSITORY');
        const notDir = path.join(dir, 'repo-is-a-file'); fs.writeFileSync(notDir, 'x');
        r = await mkRun(dirOut('o3'), {}, {}, notDir);
        expectFail(check, 'the repository is not a directory', r.rec, 'RELEASE_REPOSITORY');
        r = await mkRun(dirOut('o4'), { 'realpath.native': (a, real) => { if (samePath(a[0], dir)) throw errCode('ENOENT'); return real(); } });
        expectFail(check, 'realpath of the output parent fails', r.rec, 'RELEASE_OUT_PARENT');
        r = await mkRun(dirOut('o5'), { lstat: (a, real) => { if (samePath(a[0], dir)) throw errCode('EACCES'); return real(); } });
        expectFail(check, 'lstat of the canonical output parent fails', r.rec, 'RELEASE_OUT_PARENT');
        // Destination spellings: a junction parent makes the supplied resolved spelling differ from the canonical one.
        const real2 = path.join(dir, 'real-two'); fs.mkdirSync(real2);
        const alias2 = path.join(dir, 'alias-two');
        if (!linkDir(real2, alias2)) check(false, 'cannot create the alias used for the two destination spellings');
        else {
          const canon = fs.realpathSync.native(alias2);
          const supplied = (n) => path.join(alias2, n); const canonical = (n) => path.join(canon, n);
          const fault = (which, code, n) => ({ lstat: (a, real) => { if (samePath(a[0], which === 'supplied' ? supplied(n) : canonical(n))) throw code === 'ENOENT' ? enoent(a[0]) : errCode(code); return real(); } });
          let g = await mkRun(supplied('d1'), fault('supplied', 'EACCES', 'd1'));
          expectFail(check, 'a non-ENOENT lstat error on the supplied spelling', g.rec, 'RELEASE_WRITE');
          check(ofOp(g.seam.events, 'lstat').filter((e) => samePath(e.args[0], canonical('d1'))).length === 0 && g.exec.calls.length === 0 && !exists(canonical('d1')), 'no later check runs after that failure');
          g = await mkRun(supplied('d2'), fault('canonical', 'EACCES', 'd2'));
          expectFail(check, 'a non-ENOENT lstat error on the canonical spelling', g.rec, 'RELEASE_WRITE');
          const l2 = ofOp(g.seam.events, 'lstat').map((e) => e.args[0]);
          const iS = l2.findIndex((p) => samePath(p, supplied('d2'))); const iC = l2.findIndex((p) => samePath(p, canonical('d2')));
          check(iS >= 0 && iC > iS && g.exec.calls.length === 0, 'the supplied spelling is checked first and an ENOENT there permits the canonical check', { iS, iC });
          g = await mkRun(supplied('d3'), { lstat: (a, real) => { if (samePath(a[0], supplied('d3'))) return fs.lstatSync(real2); return real(); } });
          expectFail(check, 'an existing entry found on the supplied spelling', g.rec, 'RELEASE_OUT_EXISTS');
          check(ofOp(g.seam.events, 'lstat').filter((e) => samePath(e.args[0], canonical('d3'))).length === 0, 'the canonical spelling is not checked after a hit on the supplied one');
          g = await mkRun(supplied('d4'), { lstat: (a, real) => { if (samePath(a[0], canonical('d4'))) return fs.lstatSync(real2); return real(); } });
          expectFail(check, 'an existing entry found on the canonical spelling', g.rec, 'RELEASE_OUT_EXISTS');
          g = await mkRun(supplied('d5'), { lstat: (a, real) => { if (samePath(a[0], supplied('d5')) || samePath(a[0], canonical('d5'))) throw enoent(a[0]); return real(); } });
          expectResult(check, 'ENOENT on both spellings means absent', g.rec, { exitCode: 0, stdout: okStdout(canonical('d5')), stderr: '' });
        }
        // The same non-ENOENT handling without an alias (one spelling).
        r = await mkRun(dirOut('s1'), { lstat: (a, real) => { if (samePath(a[0], dirOut('s1'))) throw errCode('EACCES'); return real(); } });
        expectFail(check, 'a non-ENOENT lstat error on the destination', r.rec, 'RELEASE_WRITE'); check(r.exec.calls.length === 0, 'no Git operation runs');
        // Exclusive creation: the destination appears between the checks and mkdir.
        r = await mkRun(dirOut('race'), { mkdir: (a, real) => { real(); throw errCode('EEXIST'); } });
        expectFail(check, 'the destination appears at exclusive creation', r.rec, 'RELEASE_OUT_EXISTS');
        check(ofOp(r.seam.events, 'write').length === 0 && r.exec.calls.length === 7, 'nothing is written after the race; the seven Git operations had already run', { writes: ofOp(r.seam.events, 'write').length, git: r.exec.calls.length });
        r = await mkRun(dirOut('mk-fail'), { mkdir: () => { throw errCode('EACCES'); } });
        expectFail(check, 'another directory creation error', r.rec, 'RELEASE_WRITE'); check(ofOp(r.seam.events, 'write').length === 0 && !exists(dirOut('mk-fail')), 'no write is attempted');
        // Write failures happen before the selected operation mutates anything.
        const zipName = `project-setup-${CANDIDATE_VERSION}.zip`;
        r = await mkRun(dirOut('zip-fail'), { write: (a, real) => { if (a[0].endsWith('.zip')) throw errCode('EIO'); return real(); } });
        expectFail(check, 'the ZIP write fails', r.rec, 'RELEASE_WRITE');
        check(ofOp(r.seam.events, 'write').length === 1 && exists(dirOut('zip-fail')) && fs.readdirSync(dirOut('zip-fail')).length === 0, 'the new directory is left empty and no notes write is attempted', { writes: ofOp(r.seam.events, 'write').length });
        r = await mkRun(dirOut('notes-fail'), { write: (a, real) => { if (a[0].endsWith('RELEASE-NOTES.md')) throw errCode('EIO'); return real(); } });
        expectFail(check, 'the notes write fails', r.rec, 'RELEASE_WRITE');
        check(ofOp(r.seam.events, 'write').length === 2 && eq(fs.readdirSync(dirOut('notes-fail')), [zipName]) && Buffer.compare(readBytes(path.join(dirOut('notes-fail'), zipName)), FAKE_ZIP) === 0, 'exactly the complete ZIP remains and no later write is attempted', fs.readdirSync(dirOut('notes-fail')));
        r = await mkRun(dirOut('zip-exists'), { write: (a, real) => { if (a[0].endsWith('.zip')) throw errCode('EEXIST'); return real(); } });
        expectFail(check, 'an EEXIST on the ZIP write is a write error, not an existing destination', r.rec, 'RELEASE_WRITE');
      });
    });
    await step('plan 3.4 and 5.1: the real success build (a direct Node child of the copy committed into the synthetic repository) prints exactly the eight lines, exits 0 with empty stderr, and a usage launch prints exactly the usage line', async () => {
      const w = await getWorld(context);
      if (!w || !w.resA || !w.version) { worldMissing(check, w, 'success build'); return; }
      const archive = path.join(w.dir, 'out-a', w.zipName);
      const sha = w.zipA ? sha256(w.zipA) : 'missing-zip';
      const want = successStdout({ version: w.version, tag: WORLD_TAG, commit: w.commit, tree: w.tree, archive, sha, notes: path.join(w.dir, 'out-a', 'RELEASE-NOTES.md') });
      check(w.resA.status === 0 && w.resA.stderr === '' && w.resA.stdout === want, 'build A: exit 0, empty stderr and exactly the eight success lines with the independently resolved identity', { status: w.resA.status, stderr: String(w.resA.stderr).slice(0, 300), stdout: String(w.resA.stdout).slice(0, 500) });
      check(w.version === CANDIDATE_VERSION && String(w.resA.stdout).startsWith(`RELEASE  OK  ${CANDIDATE_VERSION}\n`), `the candidate release line is exactly "RELEASE  OK  ${CANDIDATE_VERSION}"`, String(w.resA.stdout).split('\n')[0]);
      const outB = path.join(w.dir, 'out-b', w.zipName);
      check(w.resB && w.resB.exitCode === 0 && w.resB.stderr === '' && w.resB.stdout === successStdout({ version: w.version, tag: WORLD_TAG, commit: w.commit, tree: w.tree, archive: outB, sha: w.zipB ? sha256(w.zipB) : 'missing-zip', notes: path.join(w.dir, 'out-b', 'RELEASE-NOTES.md') }), 'build B (in process): the same eight lines for its own canonical paths', w.resB && { exitCode: w.resB.exitCode, stderr: w.resB.stderr, stdout: String(w.resB.stdout).slice(0, 400) });
      const usage = spawnNode(context, [path.join(w.repo, 'project-setup', 'install', 'release.mjs')], { cwd: w.dir, env: w.cleanEnv });
      check(usage.status === 1 && usage.stdout === '' && usage.stderr === `${USAGE_MESSAGE}\n`, 'a direct launch without arguments: exit 1, empty stdout and the exact RELEASE_USAGE line', { status: usage.status, stdout: usage.stdout.slice(0, 100), stderr: usage.stderr.slice(0, 200) });
      const usage2 = spawnNode(context, [path.join(w.repo, 'project-setup', 'install', 'release.mjs'), '--tag', 'x', '--out', path.join(w.dir, 'never'), '--help'], { cwd: w.dir, env: w.cleanEnv });
      check(usage2.status === 1 && usage2.stdout === '' && usage2.stderr === `${USAGE_MESSAGE}\n` && !exists(path.join(w.dir, 'never')), 'a direct launch with an extra --help: the same usage failure and nothing created', { status: usage2.status, stderr: usage2.stderr.slice(0, 200) });
    });
    flushProcessCount(context, 'S07/C11b/release-cli', mark);
  });
}

// ================================================ S07/C11b/identity ====
// Plan 3.1 to 3.4 and 5.2: the release identity comes from the named local tag. The synthetic tags are real (the release world); every other Git stage is scripted so that no extra repository is built.
const hex40 = (c) => c.repeat(40);
const mkOut = (dir, name) => path.join(dir, name);
const BAD_FAULTS = [
  ['a thrown executor', THROW], ['a rejected executor', REJECT], ['a nonzero status', nonzero()], ['a nonzero status 1', nonzero(1)],
  ['a signal', { status: null, signal: 'SIGTERM', error: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }],
  ['status 0 with a signal', { status: 0, signal: 'SIGKILL', error: null, stdout: Buffer.from('x\n'), stderr: Buffer.alloc(0) }],
  ['a spawn error object', { status: null, signal: null, error: { code: 'ENOENT' }, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }],
  ['status 0 with an error object', { status: 0, signal: null, error: { code: 'ETIMEDOUT' }, stdout: Buffer.from('x\n'), stderr: Buffer.alloc(0) }],
  ['a null result', null], ['a string result', 'not a result'], ['an empty object', {}],
  ['a string stdout', { status: 0, signal: null, error: null, stdout: 'string stdout\n', stderr: Buffer.alloc(0) }],
  ['a string stderr', { status: 0, signal: null, error: null, stdout: Buffer.from('x\n'), stderr: 'string stderr' }],
  ['a missing stderr', { status: 0, signal: null, error: null, stdout: Buffer.from('x\n') }],
  ['a missing stdout', { status: 0, signal: null, error: null, stderr: Buffer.alloc(0) }],
  ['a string status', { status: '0', signal: null, error: null, stdout: Buffer.from('x\n'), stderr: Buffer.alloc(0) }],
];
const STAGE_CODE = { toplevel: 'RELEASE_REPOSITORY', commit: 'RELEASE_TAG', tree: 'RELEASE_TREE', type: 'RELEASE_TREE', version: 'RELEASE_VERSION', notes: 'RELEASE_NOTES', archive: 'RELEASE_ARCHIVE' };

// One scripted main() call against a mini repository: returns { rec, exec, seam, out, repo }.
async function scriptedRun(rel, dir, repo, { tag = 'c11b-fixture-rc1', over = {}, label, repository = repo, seamOver = {} } = {}) {
  const out = mkOut(dir, label || `out-${Math.random().toString(16).slice(2, 10)}`);
  const seam = makeSeam(seamOver);
  const exec = scriptedExecutor({ toplevel: fakeTopLevel(repo), ...over });
  const rec = await callMain(rel, ['--tag', tag, '--out', out], { repository, cwd: dir, env: { PATH: 'x', GIT_DIR: 'ignored' }, execute: exec, fs: seam.fs });
  return { rec, exec, seam, out };
}
async function identity(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mark = processMark(context);
    const rel = await importRelease(failures, context);
    if (!rel) return;
    const w = await getWorld(context);
    const haveWorld = !!(w && w.recB && w.recB.length === 7 && w.version);
    await step('plan 3.3 and 5.2: the real tag build resolves the independently read commit and subtree; dirty working-tree VERSION and notes and an untracked sentinel cannot change the identity or the derived names', async () => {
      if (!haveWorld) { worldMissing(check, w, 'identity'); return; }
      check(/^[0-9a-f]{40}$/.test(w.commit) && /^[0-9a-f]{40}$/.test(w.tree) && w.commit !== w.tree, 'the synthetic repository has distinct commit and tree identities', { commit: w.commit, tree: w.tree });
      for (const [label, res, text] of [['build A', w.resA && { exitCode: w.resA.status, stdout: w.resA.stdout }, w.resA && w.resA.stdout], ['build B', w.resB, w.resB && w.resB.stdout]]) {
        const l = String(text || '').split('\n');
        check(res && res.exitCode === 0 && l[1] === `TAG  ${WORLD_TAG}` && l[2] === `COMMIT  ${w.commit}` && l[3] === `TREE  ${w.tree}`, `${label}: TAG, COMMIT and TREE are the named tag, the independently read commit and the tagged project-setup subtree`, l.slice(0, 4));
        check(l[0] === `RELEASE  OK  ${w.version}` && !String(text).includes('9.9.9-dirty'), `${label}: the version printed is the tagged one, never the dirty working-tree VERSION`, l[0]);
      }
      check(readText(path.join(w.repo, 'project-setup', 'VERSION')) === '9.9.9-dirty\n' && w.blobs.get('project-setup/VERSION').toString('utf8') === `${w.version}\n`, 'the working tree VERSION really differs from the tagged one (the control is real)');
      const names = w.recB ? w.recB.map((c) => c.argv.slice(4)) : [];
      check(names[4] && names[4][2] === `${w.commit}:project-setup/VERSION` && names[5] && names[5][2] === `${w.commit}:project-setup/RELEASE-NOTES-${w.version}.md`, 'the VERSION and note blobs are read from the resolved commit under the derived names', [names[4], names[5]]);
    });
    await step('plan 3.2 and 3.3: every Git argv of the real in-process build (both -c prefix options and the blob plumbing) and every execution option equals the plan; the isolated environment drops every inherited GIT_ key case-insensitively', async () => {
      if (!haveWorld) { worldMissing(check, w, 'argv'); return; }
      const want = expectedGitArgvs(w.canonicalRepo, { tag: WORLD_TAG, commit: w.commit, tree: w.tree, version: w.version });
      check(eq(w.recB.map((c) => c.argv), want), 'the seven argv vectors are exactly the plan vectors, in order', w.recB.map((c) => c.argv.slice(4)));
      check(w.recB.every((c) => c.exe === 'git'), 'every operation executes "git"', w.recB.map((c) => c.exe));
      const wantEnv = expectedGitEnv(w.envB);
      for (const [i, c] of w.recB.entries()) {
        const o = c.options;
        check(eq(Object.keys(o).sort(), EXPECTED_OPTION_KEYS) && samePath(o.cwd, w.canonicalRepo) && o.shell === false && o.windowsHide === true && o.encoding === null && o.timeout === 120000 && o.maxBuffer === 67108864, `operation ${i + 1}: the exact execution options`, { keys: Object.keys(o), cwd: o.cwd, shell: o.shell, windowsHide: o.windowsHide, encoding: o.encoding, timeout: o.timeout, maxBuffer: o.maxBuffer });
        check(gitEnvMatches(o.env, wantEnv), `operation ${i + 1}: the isolated Git environment (no inherited GIT_ key, the six pinned settings, other entries unchanged)`, { extra: Object.keys(o.env).filter((k) => !(k in wantEnv)).slice(0, 5), wrong: Object.keys(wantEnv).filter((k) => o.env[k] !== wantEnv[k]).slice(0, 5) });
      }
      check(w.envB.GIT_DIR !== undefined && Object.keys(w.recB[0].options.env).every((k) => !/^GIT_(DIR|WORK_TREE|SSL_NO_VERIFY)$/i.test(k)), 'the GIT_DIR, git_work_tree and GIT_SSL_NO_VERIFY entries supplied by the caller never reach Git', Object.keys(w.recB[0].options.env).filter((k) => /^GIT_/i.test(k)));
      check(w.recB[0].argv[1] === `safe.directory=${fwd(w.canonicalRepo)}`, 'safe.directory is the native-realpath spelling (on-disk case preserved) with only backslashes replaced by slashes', w.recB[0].argv[1]);
    });
    await step('plan 5.2: an annotated tag resolves to the same commit and subtree as the lightweight tag (resolution runs for real, later stages replay the recorded real results)', async () => {
      if (!haveWorld) { worldMissing(check, w, 'annotated tag'); return; }
      const rec = []; const out = mkOut(w.dir, 'out-annotated');
      const seam = makeSeam();
      const r = await callMain(rel, ['--tag', 'c11b-fixture-annotated', '--out', out], { repository: w.repo, cwd: w.dir, env: w.cleanEnv, execute: hybridExecutor(context, w, ['toplevel', 'commit', 'tree', 'type'], rec), fs: seam.fs });
      const v = r.value; const l = v ? String(v.stdout).split('\n') : [];
      check(v && v.exitCode === 0 && l[1] === 'TAG  c11b-fixture-annotated' && l[2] === `COMMIT  ${w.commit}` && l[3] === `TREE  ${w.tree}`, 'the annotated tag prints the same COMMIT and TREE as the lightweight tag', v && { exitCode: v.exitCode, head: l.slice(0, 4), stderr: v.stderr });
      check(rec.length === 4 && rec.every((c) => c.result.status === 0), 'four real resolution operations ran for the annotated tag', rec.length);
    });
    await step('plan 5.2: a missing tag, a branch without a tag, a blob tag and a tree tag fail RELEASE_TAG; a commit without project-setup fails RELEASE_TREE; a subdirectory or a non-repository fails RELEASE_REPOSITORY (all against real Git)', async () => {
      if (!haveWorld) { worldMissing(check, w, 'real failures'); return; }
      const realRun = async (tag, repository = w.repo, n) => {
        const rec = []; const out = mkOut(w.dir, `out-real-${n}`); const seam = makeSeam();
        const r = await callMain(rel, ['--tag', tag, '--out', out], { repository, cwd: w.dir, env: w.cleanEnv, execute: recordingExecutor(context, rec), fs: seam.fs });
        return { r, rec, out, seam };
      };
      let n = 0;
      for (const [label, tag, code] of [['a tag that does not exist', 'c11b-fixture-missing', 'RELEASE_TAG'], ['a branch name without a corresponding tag', 'c11b-fixture-branch', 'RELEASE_TAG'], ['a tag that points at a blob', 'c11b-fixture-blob', 'RELEASE_TAG'], ['a tag that points at a tree', 'c11b-fixture-tree', 'RELEASE_TAG'], ['a commit whose tree has no project-setup', 'c11b-fixture-nosubtree', 'RELEASE_TREE']]) {
        const x = await realRun(tag, w.repo, ++n);
        expectFail(check, `real Git: ${label}`, x.r, code);
        check(!exists(x.out) && ofOp(x.seam.events, 'mkdir').length === 0, `real Git: ${label}: no output directory is created`);
        check(x.rec.length === (code === 'RELEASE_TAG' ? 2 : 3), `real Git: ${label}: the sequence stops at the failing stage`, x.rec.map((c) => c.op));
      }
      const sub = await realRun('c11b-fixture-rc1', path.join(w.repo, 'project-setup'), ++n);
      expectFail(check, 'real Git: a repository that is a subdirectory of the working tree root', sub.r, 'RELEASE_REPOSITORY');
      const plain = path.join(w.dir, 'plain-directory'); fs.mkdirSync(plain);
      const notRepo = await realRun('c11b-fixture-rc1', plain, ++n);
      expectFail(check, 'real Git: a directory that is not a Git repository', notRepo.r, 'RELEASE_REPOSITORY');
      check(!exists(sub.out) && !exists(notRepo.out), 'no output directory for either repository failure');
    });
    await step('plan 3.3: the object-ID and type answers are validated per stage (lowercase 40- or 64-hex followed by LF or CRLF, matching lengths, "tree" type) and a wrong subtree type fails RELEASE_TREE', async () => {
      await withScratch(context, 'ids', async (dir) => {
        const repo = miniRepo(dir);
        const run = (over, label) => scriptedRun(rel, dir, repo, { over, label });
        const h64 = 'c3'.repeat(32);
        const idCases = [
          ['commit: empty stdout', { commit: okRes('') }, 'RELEASE_TAG'], ['commit: uppercase hex', { commit: okRes(`${hex40('A')}\n`) }, 'RELEASE_TAG'], ['commit: 39 hex digits', { commit: okRes(`${hex40('a').slice(1)}\n`) }, 'RELEASE_TAG'],
          ['commit: 41 hex digits', { commit: okRes(`${hex40('a')}a\n`) }, 'RELEASE_TAG'], ['commit: no final line break', { commit: okRes(hex40('a')) }, 'RELEASE_TAG'], ['commit: two lines', { commit: okRes(`${hex40('a')}\n${hex40('b')}\n`) }, 'RELEASE_TAG'],
          ['commit: trailing text', { commit: okRes(`${hex40('a')} refs/tags/x\n`) }, 'RELEASE_TAG'], ['commit: not hex', { commit: okRes(`${'g'.repeat(40)}\n`) }, 'RELEASE_TAG'], ['commit: a blank line first', { commit: okRes(`\n${hex40('a')}\n`) }, 'RELEASE_TAG'],
          ['tree: empty stdout', { tree: okRes('') }, 'RELEASE_TREE'], ['tree: uppercase hex', { tree: okRes(`${hex40('B')}\n`) }, 'RELEASE_TREE'], ['tree: 41 hex digits', { tree: okRes(`${hex40('b')}b\n`) }, 'RELEASE_TREE'],
          ['tree: no final line break', { tree: okRes(hex40('b')) }, 'RELEASE_TREE'], ['tree: two lines', { tree: okRes(`${hex40('b')}\n${hex40('c')}\n`) }, 'RELEASE_TREE'], ['tree: a 64-digit tree for a 40-digit commit (lengths must match)', { tree: okRes(`${h64}\n`) }, 'RELEASE_TREE'],
          ['tree: a 40-digit tree for a 64-digit commit (lengths must match)', { commit: okRes(`${h64}\n`) }, 'RELEASE_TREE'],
          ['type: blob', { type: okRes('blob\n') }, 'RELEASE_TREE'], ['type: commit', { type: okRes('commit\n') }, 'RELEASE_TREE'], ['type: tag', { type: okRes('tag\n') }, 'RELEASE_TREE'], ['type: no final line break', { type: okRes('tree') }, 'RELEASE_TREE'],
          ['type: two line breaks', { type: okRes('tree\n\n') }, 'RELEASE_TREE'], ['type: capitalised', { type: okRes('Tree\n') }, 'RELEASE_TREE'], ['type: trailing space', { type: okRes('tree \n') }, 'RELEASE_TREE'], ['type: empty', { type: okRes('') }, 'RELEASE_TREE'],
          ['type: a nonzero status', { type: nonzero() }, 'RELEASE_TREE'],
        ];
        for (const [label, over, code] of idCases) {
          const r = await run(over, `id-${Math.random().toString(16).slice(2, 8)}`);
          expectFail(check, label, r.rec, code); check(!exists(r.out) && ofOp(r.seam.events, 'mkdir').length === 0, `${label}: no output directory`);
        }
        const okVariants = [
          ['commit and tree followed by CRLF and the type by CRLF', { commit: okRes(`${FAKE_COMMIT}\r\n`), tree: okRes(`${FAKE_TREE}\r\n`), type: okRes('tree\r\n') }, FAKE_COMMIT, FAKE_TREE],
          ['64-digit commit and tree', { commit: okRes(`${h64}\n`), tree: okRes(`${'d4'.repeat(32)}\n`) }, h64, 'd4'.repeat(32)],
        ];
        for (const [label, over, commit, tree] of okVariants) {
          const r = await run(over, `ok-${Math.random().toString(16).slice(2, 8)}`);
          const v = r.rec.value; const l = v ? v.stdout.split('\n') : [];
          check(v && v.exitCode === 0 && l[2] === `COMMIT  ${commit}` && l[3] === `TREE  ${tree}` && v.stderr === '', `${label}: accepted with the exact IDs printed`, v && { exitCode: v.exitCode, head: l.slice(0, 4), stderr: v.stderr });
          check(r.exec.calls.length === 7 && r.exec.calls[2].argv.includes(`${commit}:project-setup`) && r.exec.calls[3].argv.includes(tree) && r.exec.calls[6].argv.includes(commit) && !r.exec.calls[6].argv.includes(tree), `${label}: the commit feeds the subtree, blob and archive operations and the tree feeds the type check only`, r.exec.calls.map((c) => c.argv.slice(4)));
        }
        const hexName = 'deadbeef'.repeat(5);
        const r2 = await scriptedRun(rel, dir, repo, { tag: hexName, label: 'hex-name-out' });
        check(r2.exec.calls[1] && r2.exec.calls[1].argv.slice(4).join(' ') === `rev-parse --verify --end-of-options refs/tags/${hexName}^{commit}`, 'a hexadecimal-looking tag name is only ever resolved under refs/tags/', r2.exec.calls[1] && r2.exec.calls[1].argv);
        check(r2.rec.value && r2.rec.value.exitCode === 0, 'control: a hexadecimal-looking tag name builds when the executor resolves it');
      });
    });
    await step('plan 3.3 and 5.2: repository-root identity (forward-slash and native spellings compare equal after native canonicalization; the safe.directory value keeps the native-realpath case) and the RELEASE_REPOSITORY failures for a mismatch or malformed root output', async () => {
      await withScratch(context, 'root', async (dir) => {
        const repo = miniRepo(dir, 'MiXeD-Case-Repo');
        const other = miniRepo(dir, 'other-root');
        const okSpellings = [['the forward-slash spelling', `${fwd(repo)}\n`], ['the native spelling', `${repo}\n`], ['the forward-slash spelling with CRLF', `${fwd(repo)}\r\n`], ['the native spelling with CRLF', `${repo}\r\n`]];
        if (WIN) okSpellings.push(['a different-case spelling (Windows folds case)', `${fwd(repo).toLowerCase()}\n`], ['an upper-case spelling (Windows folds case)', `${fwd(repo).toUpperCase()}\n`]);
        for (const [label, text] of okSpellings) {
          const r = await scriptedRun(rel, dir, repo, { over: { toplevel: okRes(text) }, label: `root-ok-${Math.random().toString(16).slice(2, 8)}` });
          check(r.rec.value && r.rec.value.exitCode === 0 && r.rec.value.stderr === '', `root output as ${label}: accepted`, r.rec.value && r.rec.value.stderr);
        }
        const bad = [['a different existing directory', `${fwd(other)}\n`], ['a path that does not exist', `${fwd(path.join(dir, 'no-such-root'))}\n`], ['an empty answer', ''], ['a lone line break', '\n'], ['two lines', `${fwd(repo)}\nextra\n`],
          ['a blank line after the path', `${fwd(repo)}\n\n`], ['a leading space', ` ${fwd(repo)}\n`], ['a status 128', nonzero()], ['a thrown executor', THROW], ['a rejected executor', REJECT]];
        for (const [label, text] of bad) {
          const r = await scriptedRun(rel, dir, repo, { over: { toplevel: typeof text === 'string' ? okRes(text) : text }, label: `root-bad-${Math.random().toString(16).slice(2, 8)}` });
          expectFail(check, `root output: ${label}`, r.rec, 'RELEASE_REPOSITORY'); check(r.exec.calls.length === 1 && !exists(r.out), `root output: ${label}: the sequence stops at once and creates nothing`, r.exec.calls.length);
        }
        const r = await scriptedRun(rel, dir, repo, { label: 'case-check' });
        check(r.exec.calls.length === 7 && r.exec.calls.every((c) => c.argv[1] === `safe.directory=${fwd(repo)}`), 'safe.directory carries the on-disk case of the canonical root, backslashes replaced by slashes', r.exec.calls[0] && r.exec.calls[0].argv[1]);
        if (WIN) {
          const lowered = path.join(dir, 'mixed-case-repo');
          const r3 = await scriptedRun(rel, dir, repo, { repository: lowered, label: 'case-lowered' });
          check(r3.exec.calls.length === 7 && r3.exec.calls[0].argv[1] === `safe.directory=${fwd(repo)}` && samePath(r3.exec.calls[0].options.cwd, repo) && r3.exec.calls[0].options.cwd === repo, 'a lower-case supplied spelling still passes the original on-disk case', r3.exec.calls[0] && [r3.exec.calls[0].argv[1], r3.exec.calls[0].options.cwd]);
        }
      });
    });
    await step('plan 3.3 and 5.2: tagged VERSION validation (grammar, LF, no BOM or CR, missing blob) and the derived note path, ZIP name, success version and publication heading for 3.0.0-rc.1, 3.0.0-rc.2, 3.0.0 and 4.2.1-rc.12 (the matrix keeps the earlier candidate and the final version)', async () => {
      await withScratch(context, 'version', async (dir) => {
        const repo = miniRepo(dir);
        const bom = Buffer.from([0xef, 0xbb, 0xbf]);
        const invalid = [['no final line break', Buffer.from('3.0.0-rc.1')], ['CRLF', Buffer.from('3.0.0-rc.1\r\n')], ['a BOM', Buffer.concat([bom, Buffer.from('3.0.0\n')])], ['a second line break', Buffer.from('3.0.0\n\n')],
          ['a leading space', Buffer.from(' 3.0.0\n')], ['a trailing space', Buffer.from('3.0.0 \n')], ['a v prefix', Buffer.from('v3.0.0\n')], ['two components', Buffer.from('3.0\n')], ['a beta suffix', Buffer.from('3.0.0-beta.1\n')],
          ['an empty rc number', Buffer.from('3.0.0-rc.\n')], ['an extra line', Buffer.from('3.0.0-rc.1\nextra\n')], ['empty', Buffer.alloc(0)], ['a lone line break', Buffer.from('\n')], ['a prefix text', Buffer.from('x3.0.0\n')],
          ['invalid UTF-8', Buffer.from([0xff, 0xfe, 0x0a])], ['a build suffix', Buffer.from('3.0.0+build\n')], ['a CR in the middle', Buffer.from('3.0.\r0\n')]];
        for (const [label, bytes] of invalid) {
          const r = await scriptedRun(rel, dir, repo, { over: { version: okRes(bytes) }, label: `v-${Math.random().toString(16).slice(2, 8)}` });
          expectFail(check, `VERSION with ${label}`, r.rec, 'RELEASE_VERSION'); check(!exists(r.out) && r.exec.calls.length === 5, `VERSION with ${label}: nothing is created and the notes are never read`, r.exec.calls.length);
        }
        const missing = await scriptedRun(rel, dir, repo, { over: { version: nonzero() }, label: 'v-missing' });
        expectFail(check, 'a missing VERSION blob', missing.rec, 'RELEASE_VERSION');
        for (const v of ['3.0.0-rc.1', '3.0.0-rc.2', '3.0.0', '4.2.1-rc.12']) {
          const notes = asBuf(lines([`# project-setup ${v}`, '', `Notes for ${v} without identifiers.`]));
          const r = await scriptedRun(rel, dir, repo, { over: { version: okRes(`${v}\n`), notes: okRes(notes) }, label: `derive-${v}` });
          const sha = sha256(FAKE_ZIP); const o = r.out;
          const want = { exitCode: 0, stdout: successStdout({ version: v, tag: 'c11b-fixture-rc1', commit: FAKE_COMMIT, tree: FAKE_TREE, archive: path.join(o, `project-setup-${v}.zip`), sha, notes: path.join(o, 'RELEASE-NOTES.md') }), stderr: '' };
          expectResult(check, `version ${v}`, r.rec, want);
          check(r.exec.calls[4].argv.slice(-1)[0] === `${FAKE_COMMIT}:project-setup/VERSION` && r.exec.calls[5].argv.slice(-1)[0] === `${FAKE_COMMIT}:project-setup/RELEASE-NOTES-${v}.md`, `version ${v}: the note path is derived from the validated version`, r.exec.calls[5].argv.slice(-1));
          const written = readBytes(path.join(o, 'RELEASE-NOTES.md'));
          const wantNotes = publicationText({ version: v, tag: 'c11b-fixture-rc1', commit: FAKE_COMMIT, tree: FAKE_TREE, sha, notes });
          check(written !== null && Buffer.compare(written, wantNotes) === 0 && written.toString('utf8').startsWith(`# project-setup ${v} publication notes\n\nTag: c11b-fixture-rc1\nCommit: ${FAKE_COMMIT}\nProject-setup tree: ${FAKE_TREE}\nArchive: project-setup-${v}.zip\nArchive SHA256: ${sha}\n\n# project-setup ${v}\n`), `version ${v}: the publication heading, archive name and bytes are derived from it`, written && written.toString('utf8').slice(0, 300));
          check(eq(fs.readdirSync(o).sort(), [`project-setup-${v}.zip`, 'RELEASE-NOTES.md'].sort()), `version ${v}: the ZIP is named for the version`);
        }
      });
    });
    await step('plan 3.3 and 5.2: tagged note validation (present, nonempty, fatal UTF-8, no BOM, no CR, final LF, no standalone 40- or 64-hex ID by the exact expression) and an editorially different valid note still builds', async () => {
      await withScratch(context, 'notes', async (dir) => {
        const repo = miniRepo(dir);
        const h40 = 'ab12cd34ef'.repeat(4); const h64 = '0123456789abcdef'.repeat(4);
        const body = (t) => asBuf(`# project-setup ${CANDIDATE_VERSION}\n\n${t}\n`);
        const invalid = [['a missing blob', nonzero()], ['an empty note', Buffer.alloc(0)], ['invalid UTF-8', Buffer.from([0x23, 0x20, 0xc3, 0x28, 0x0a])], ['a BOM', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), asBuf('# x\n')])],
          ['a CRLF line break', asBuf('# x\r\n\r\nbody\r\n')], ['a lone CR', asBuf('# x\n\nbody\rmore\n')], ['no final line break', asBuf('# x\n\nbody')],
          ['a 40-digit lowercase ID', body(`see ${h40}`)], ['a 40-digit uppercase ID', body(`see ${h40.toUpperCase()}`)], ['a mixed-case 40-digit ID', body(`see ${h40.slice(0, 20)}${h40.slice(20).toUpperCase()}`)],
          ['a 64-digit ID', body(`see ${h64}`)], ['a 64-digit uppercase ID', body(`see ${h64.toUpperCase()}`)], ['a 40-digit ID in punctuation', body(`(${h40}).`)], ['a 40-digit ID after a non-hex letter', body(`x${h40}`)],
          ['a 40-digit ID after an underscore', body(`_${h40}`)], ['a 40-digit ID before a non-hex letter', body(`${h40}g`)], ['a 40-digit ID alone on a line', body(`${h40}`)]];
        for (const [label, bytes] of invalid) {
          const r = await scriptedRun(rel, dir, repo, { over: { notes: Buffer.isBuffer(bytes) ? okRes(bytes) : bytes }, label: `n-${Math.random().toString(16).slice(2, 8)}` });
          expectFail(check, `note with ${label}`, r.rec, 'RELEASE_NOTES'); check(!exists(r.out) && r.exec.calls.length === 6, `note with ${label}: nothing is created and the archive is never built`, r.exec.calls.length);
        }
        const valid = [['an editorially different note', body('A different but valid body.')], ['a 41-digit run (not a standalone ID)', body(`run ${h40}a`)], ['a 39-digit run', body(`run ${h40.slice(1)}`)], ['a 63-digit run', body(`run ${h64.slice(1)}`)],
          ['a 65-digit run', body(`run ${h64}a`)], ['non-ASCII UTF-8 text', asBuf(`# project-setup ${CANDIDATE_VERSION}\n\ncaf${CTL(0xe9)}\n`)], ['a note without a heading', asBuf('plain text only\n')]];
        for (const [label, bytes] of valid) {
          const r = await scriptedRun(rel, dir, repo, { over: { notes: okRes(bytes) }, label: `nv-${Math.random().toString(16).slice(2, 8)}` });
          const v = r.rec.value;
          const written = readBytes(path.join(r.out, 'RELEASE-NOTES.md'));
          check(v && v.exitCode === 0 && v.stderr === '' && written !== null && written.subarray(written.length - bytes.length).equals(bytes), `${label}: builds and embeds the tagged note bytes unchanged at the end of the publication notes`, v && { exitCode: v.exitCode, stderr: v.stderr });
        }
      });
    });
    await step('plan 3.3 and 3.4: for each Git stage a nonzero status, a thrown or rejected executor and every malformed result shape yield the fixed operation error with no forwarded native stderr and no output directory', async () => {
      await withScratch(context, 'faults', async (dir) => {
        const repo = miniRepo(dir);
        for (const op of OP_ORDER) {
          for (const [label, bad] of BAD_FAULTS) {
            const r = await scriptedRun(rel, dir, repo, { over: { [op]: bad }, label: `f-${op}-${Math.random().toString(16).slice(2, 8)}` });
            expectFail(check, `${op} stage with ${label}`, r.rec, STAGE_CODE[op]);
            const v = r.rec.value;
            check(!exists(r.out) && ofOp(r.seam.events, 'mkdir', 'write').length === 0 && (!v || !(`${v.stdout}${v.stderr}`).includes(NATIVE_STDERR)) && r.exec.calls.length === OP_ORDER.indexOf(op) + 1, `${op} stage with ${label}: no output directory, no native text forwarded, the sequence stops at the failing stage`, { calls: r.exec.calls.length });
          }
        }
      });
    });
    flushProcessCount(context, 'S07/C11b/identity', mark);
  });
}

// ================================================ S07/C11b/archive ====
// Plan 3.3 and 5.3: the ZIP is produced from the resolved commit only, is reproducible across a delay of more than 2,100 ms, and is complete and byte-exact against the committed blobs.
// A minimal ZIP writer proves the tests-only reader rejects what it must.
function buildZip(files, { deflate = false, dupe = false, badCrc = false, extraMethod } = {}) {
  const locals = []; const centrals = []; let offset = 0;
  const list = dupe ? [...files, files[0]] : files;
  for (const [name, data] of list) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = badCrc ? 1 : crc32(data);
    const m = extraMethod !== undefined ? extraMethod : (deflate && data.length ? 8 : 0);
    const body = m === 8 ? zlib.deflateRawSync(data) : data;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(m, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(m, 10); central.writeUInt32LE(crc, 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, body); centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals); const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(list.length, 8); eocd.writeUInt16LE(list.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}
async function archiveGroup(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mark = processMark(context);
    const rel = await importRelease(failures, context);
    await step('plan 5.3: the tests-only ZIP reader parses stored entries and rejects malformed metadata, duplicate names, unsupported compression, a bad CRC and truncation (reader controls, no external ZIP program)', async () => {
      const good = buildZip([['project-setup/', Buffer.alloc(0)], ['project-setup/a.txt', Buffer.from('alpha\r\n')], ['project-setup/b.bin', Buffer.from([0, 1, 2, 255])]]);
      const parsed = await attempt(() => readZip(good));
      check(!parsed.threw && eq(parsed.value.map((e) => [e.name, e.dir, e.data.length]), [['project-setup/', true, 0], ['project-setup/a.txt', false, 7], ['project-setup/b.bin', false, 4]]), 'a valid stored archive is read', parsed.threw ? errMsg(parsed.error) : parsed.value.map((e) => e.name));
      const text = Buffer.from('compressed text '.repeat(20));
      const deflatedZip = await attempt(() => readZip(buildZip([['project-setup/z.txt', text]], { deflate: true })));
      check(!deflatedZip.threw && deflatedZip.value.length === 1 && deflatedZip.value[0].method === 8 && Buffer.compare(deflatedZip.value[0].data, text) === 0, 'a deflated entry is inflated and its CRC verified', deflatedZip.threw ? errMsg(deflatedZip.error) : deflatedZip.value[0].method);
      for (const [label, zip] of [['a duplicate entry name', buildZip([['project-setup/a.txt', Buffer.from('x')]], { dupe: true })], ['an unsupported compression method', buildZip([['project-setup/a.txt', Buffer.from('x')]], { extraMethod: 9 })],
        ['a CRC mismatch', buildZip([['project-setup/a.txt', Buffer.from('x')]], { badCrc: true })], ['a truncated archive', good.subarray(0, good.length - 30)], ['random bytes', Buffer.from('this is not a zip archive at all, only text')], ['an empty buffer', Buffer.alloc(0)]]) {
        const r = await attempt(() => readZip(zip));
        check(r.threw, `the reader rejects ${label}`, r.threw ? undefined : r.value.map((e) => e.name));
      }
    });
    await step('plan 5.3: the two real builds succeed, hash identically (the second archive operation started more than 2,100 ms after the first build completed) and the printed digests equal an independent hash of the ZIP bytes', async () => {
      const w = await getWorld(context);
      if (!w || !w.zipA || !w.zipB || !w.version) { worldMissing(check, w, 'archive'); return; }
      check(w.resA.status === 0 && w.resB && w.resB.exitCode === 0, 'both builds succeed', { a: w.resA.status, b: w.resB && w.resB.exitCode });
      check(sha256(w.zipA) === sha256(w.zipB) && Buffer.compare(w.zipA, w.zipB) === 0, 'the two ZIP files are byte-identical (identical SHA256)', { a: sha256(w.zipA), b: sha256(w.zipB) });
      const shaLine = (text) => (/^SHA256  ([0-9a-f]{64})$/m.exec(String(text)) || [])[1];
      check(shaLine(w.resA.stdout) === sha256(w.zipA) && shaLine(w.resB.stdout) === sha256(w.zipB), 'each printed SHA256 equals the independently computed digest of its raw ZIP bytes', [shaLine(w.resA.stdout), sha256(w.zipA)]);
      const archiveCall = w.recB && w.recB.find((c) => c.op === 'archive');
      check(archiveCall && archiveCall.at - w.endA > 2100, 'the second archive operation started more than 2,100 ms after the first build completed', archiveCall && archiveCall.at - w.endA);
      check(archiveCall && Buffer.isBuffer(archiveCall.result.stdout) && Buffer.compare(archiveCall.result.stdout, w.zipB) === 0, 'the written ZIP is the raw archive stdout, not decoded or rewritten', archiveCall && archiveCall.result.stdout.length);
    });
    await step('plan 5.3: every entry resides under exactly project-setup/; the non-directory entry set equals git ls-tree -r of the commit subtree; each decompressed entry equals its committed blob; no untracked sentinel or dirty replacement appears; both archives hold the release builder, the in-tree notes and the full 60-file payload', async () => {
      const w = await getWorld(context);
      if (!w || !w.zipA || !w.zipB || !w.version) { worldMissing(check, w, 'archive inventory'); return; }
      for (const [label, zip] of [['archive A', w.zipA], ['archive B', w.zipB]]) {
        const parsed = await attempt(() => readZip(zip));
        if (parsed.threw) { check(false, `${label}: the ZIP is readable by the strict test reader`, errMsg(parsed.error)); continue; }
        const entries = parsed.value;
        check(entries.length > 0 && entries.every((e) => e.name === 'project-setup/' || e.name.startsWith('project-setup/')), `${label}: every entry resides under project-setup/`, entries.filter((e) => !e.name.startsWith('project-setup/')).map((e) => e.name).slice(0, 5));
        const files = entries.filter((e) => !e.dir);
        const names = files.map((e) => e.name).sort();
        const want = w.entries.map((e) => e.path).sort();
        check(eq(names, want), `${label}: the non-directory entries equal git ls-tree -r for the commit subtree`, { zip: names.length, tree: want.length, onlyZip: names.filter((n) => !want.includes(n)).slice(0, 5), onlyTree: want.filter((n) => !names.includes(n)).slice(0, 5) });
        const bad = files.filter((e) => { const b = w.blobs.get(e.name); return !b || Buffer.compare(b, e.data) !== 0; }).map((e) => e.name);
        check(bad.length === 0, `${label}: every decompressed entry equals its committed blob`, bad.slice(0, 5));
        const set = new Set(files.map((e) => e.name));
        check(Object.keys(w.sentinels).every((s) => !set.has(s)), `${label}: no untracked sentinel is archived`, Object.keys(w.sentinels).filter((s) => set.has(s)));
        check(Object.keys(w.dirty).every((d) => { const e = files.find((x) => x.name === d); return e && e.data.toString('utf8') !== w.dirty[d]; }), `${label}: no dirty working-tree replacement is archived`);
        check(set.has('project-setup/install/release.mjs') && set.has(`project-setup/RELEASE-NOTES-${w.version}.md`), `${label}: the release builder and the in-tree release notes are inside`, { builder: set.has('project-setup/install/release.mjs'), notes: set.has(`project-setup/RELEASE-NOTES-${w.version}.md`) });
        check(PAYLOAD_INVENTORY.length === 60 && PAYLOAD_INVENTORY.every((p) => set.has(`project-setup/${p}`)), `${label}: the full 60-file installed-payload subset is inside`, PAYLOAD_INVENTORY.filter((p) => !set.has(`project-setup/${p}`)).slice(0, 5));
      }
    });
    await step('plan 3.3 and 5.3: the archive operation takes the resolved commit and project-setup/ and nothing else (never the tree ID, --mtime, --prefix, a worktree directory or an output file)', async () => {
      const w = await getWorld(context);
      if (!w || !w.recB || w.recB.length !== 7) { worldMissing(check, w, 'archive argv'); return; }
      const a = w.recB.find((c) => c.op === 'archive');
      const want = expectedGitArgvs(w.canonicalRepo, { tag: WORLD_TAG, commit: w.commit, tree: w.tree, version: w.version })[6];
      check(a && eq(a.argv, want), 'the complete archive argv is the plan vector', a && a.argv);
      check(a && a.argv.includes(w.commit) && !a.argv.includes(w.tree) && !a.argv.some((x) => /^(--mtime|--prefix|--output|-o$|--worktree-attributes)/.test(x)), 'the archive input is the commit, never the tree ID, and uses no mtime, prefix or output-file option', a && a.argv.slice(4));
    });
    await step('plan 5.3: an archive command failure, empty bytes and a non-ZIP prefix produce RELEASE_ARCHIVE; an output write failure injected through the filesystem seam produces RELEASE_WRITE and no success lines', async () => {
      if (!rel) return;
      await withScratch(context, 'archive-faults', async (dir) => {
        const repo = miniRepo(dir);
        const bad = [['a nonzero status', nonzero()], ['empty bytes', okRes(Buffer.alloc(0))], ['text instead of a ZIP', okRes(Buffer.from('not a zip archive'))], ['an end-of-directory-only ZIP prefix', okRes(Buffer.from([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0]))],
          ['three of four prefix bytes', okRes(Buffer.from([0x50, 0x4b, 0x03]))], ['the prefix bytes in the wrong order', okRes(Buffer.from([0x04, 0x03, 0x4b, 0x50, 1, 2, 3]))], ['a thrown executor', THROW]];
        for (const [label, res] of bad) {
          const r = await scriptedRun(rel, dir, repo, { over: { archive: res }, label: `a-${Math.random().toString(16).slice(2, 8)}` });
          expectFail(check, `archive: ${label}`, r.rec, 'RELEASE_ARCHIVE'); check(!exists(r.out) && ofOp(r.seam.events, 'mkdir', 'write').length === 0, `archive: ${label}: no output directory`);
        }
        const w = await getWorld(context);
        if (w && w.replay && w.replay.archive) {
          const real = Object.keys(w.replay).length === 7;
          const out = mkOut(dir, 'real-bytes-write-failure');
          const seam = makeSeam({ write: (a, realWrite) => { if (a[0].endsWith('.zip')) throw errCode('EIO'); return realWrite(); } });
          const exec = scriptedExecutor({ ...replaySpec(w, { toplevel: fakeTopLevel(repo) }) });
          const rec = await callMain(rel, ['--tag', WORLD_TAG, '--out', out], { repository: repo, cwd: dir, env: { PATH: 'x' }, execute: exec, fs: seam.fs });
          expectFail(check, 'the real archive bytes with an injected ZIP write failure', rec, 'RELEASE_WRITE');
          check(real && rec.value && !/RELEASE {2}OK|SHA256/.test(rec.value.stdout) && fs.readdirSync(out).length === 0, 'no success line is printed and the new directory is left empty for inspection');
        }
      });
    });
    flushProcessCount(context, 'S07/C11b/archive', mark);
  });
}

// ================================================ S07/C11b/notes ====
// Plan 3.5, 3.6 and 5.4: the publication notes bind the identity without self reference. The oracle is independent: the commit and tree were read with other Git commands, the digest is hashed here, and the
// tagged note bytes are the committed blob. The builder's printed fields are never the oracle.
const Q6_TEXT = 'Upgrade the known v2 project together with its skill. V2 validation rejects manifest schema 3. This is a compatibility signal, not a retrofitted pre-write guard in every old command. Do not use v2 commands to repair a schema-3 project.';
const ROLLBACK_TEXT = 'Roll back project state with the rc.1 tooling before reverting the installed skill. If later independent runs exist, roll them back newest first. Do not split this migration into successive manifest commits.';
// ROLLBACK_TEXT is the historical rc.1 wording (the preserved rc.1 notes); CURRENT_ROLLBACK_TEXT is C13-13's version-neutral paragraph (the rc.2 notes and migration section 5).
const CURRENT_ROLLBACK_TEXT = 'Roll back project state with the tooling used for the update before reverting the installed skill. If later independent runs exist, roll them back newest first. Do not split this migration into successive manifest commits.';
const RELEASE_NOTES_TEXT = lines(RELEASE_NOTES_LINES);
const RC1_RELEASE_NOTES_TEXT = lines(RC1_RELEASE_NOTES_LINES);
// The text of "## <heading>" up to the next level-1 or level-2 heading (or the end).
function sectionOf(doc, heading) {
  const ls = String(doc).split('\n');
  const at = ls.findIndex((l) => l === `## ${heading}`);
  if (at < 0) return null;
  let end = ls.length;
  for (let i = at + 1; i < ls.length; i++) if (/^#{1,2} /.test(ls[i])) { end = i; break; }
  return ls.slice(at + 1, end).join('\n');
}
async function notesGroup(context) {
  return runAssertion(async ({ check, step }) => {
    const w = await getWorld(context);
    const have = !!(w && w.zipA && w.zipB && w.notesA && w.notesB && w.taggedNotes && w.version);
    await step('plan 3.6 and 5.4: the tagged in-tree notes are exactly the candidate bytes (ASCII, no BOM, LF, final LF) and contain neither the resolved object IDs, the archive digest nor any standalone 40- or 64-hex ID', async () => {
      if (!w || !w.taggedNotes) { worldMissing(check, w, 'tagged notes'); return; }
      check(w.taggedNotes.toString('utf8') === RELEASE_NOTES_TEXT && Buffer.compare(w.taggedNotes, Buffer.from(RELEASE_NOTES_TEXT, 'utf8')) === 0, 'the tagged RELEASE-NOTES-<version>.md bytes equal the exact candidate text of plan 3.6');
      check(!/[^\x00-\x7f]/.test(w.taggedNotes.toString('latin1')) && w.taggedNotes[0] !== 0xef && !w.taggedNotes.includes(0x0d) && w.taggedNotes[w.taggedNotes.length - 1] === 0x0a, 'the tagged notes are ASCII without BOM or CR and end with LF');
      const text = w.taggedNotes.toString('utf8');
      check(!NOTES_HEX_RE.test(text) && !text.includes(w.commit) && !text.includes(w.tree) && !(w.zipA && text.includes(sha256(w.zipA))), 'the in-tree notes carry no resolved commit, tree or archive digest');
    });
    await step('plan 3.5 and 5.4: RELEASE-NOTES.md is the exact publication text built from independently measured identity and digest, identical for both builds, with no timestamp, path or machine name', async () => {
      if (!have) { worldMissing(check, w, 'publication notes'); return; }
      const wantFor = (zip) => publicationText({ version: w.version, tag: WORLD_TAG, commit: w.commit, tree: w.tree, sha: sha256(zip), notes: w.taggedNotes });
      check(Buffer.compare(w.notesA, wantFor(w.zipA)) === 0, 'build A: RELEASE-NOTES.md equals the exact construction of plan 3.5', w.notesA.toString('utf8').slice(0, 300));
      check(Buffer.compare(w.notesB, wantFor(w.zipB)) === 0, 'build B: RELEASE-NOTES.md equals the exact construction of plan 3.5', w.notesB.toString('utf8').slice(0, 300));
      check(Buffer.compare(w.notesA, w.notesB) === 0, 'the two publication files are byte-identical despite different output directories and wall-clock times');
      const t = w.notesA.toString('utf8');
      check(t.charCodeAt(0) !== 0xfeff && !t.includes('\r') && t.endsWith('\n') && !t.includes(w.dir) && !/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(t.slice(0, t.indexOf('\n\n# project-setup'))) && !/published|publication complete/i.test(t.slice(0, t.indexOf('\n\n# project-setup'))), 'no BOM, CR, absolute path, timestamp or publication claim in the identity header');
      check(t.startsWith(`# project-setup ${w.version} publication notes\n\nTag: ${WORLD_TAG}\nCommit: ${w.commit}\nProject-setup tree: ${w.tree}\nArchive: project-setup-${w.version}.zip\nArchive SHA256: ${sha256(w.zipA)}\n\n# project-setup ${w.version}\n`), 'one blank line separates the identity header from the embedded in-tree heading');
      check(t.endsWith(w.taggedNotes.toString('utf8')), 'the complete tagged note bytes, including their final LF, end the publication notes');
    });
    await step('plan 3.6 and 5.4: Q6 is stated by section in the in-tree notes, the embedded publication copy and C8\'s migration reference (sections 1 and 5), checked after whitespace normalization', async () => {
      const inTree = RELEASE_NOTES_TEXT;
      const wantSec = (label, doc, rollback = CURRENT_ROLLBACK_TEXT) => {
        const s = doc === null ? null : sectionOf(doc, 'Compatibility and rollback');
        check(s !== null, `${label}: has the "Compatibility and rollback" section`);
        if (s !== null) { check(squash(s).includes(Q6_TEXT), `${label}: the Q6 paragraph is exact in that section`); check(squash(s).includes(rollback), `${label}: the rollback-order paragraph is exact in that section`); }
      };
      wantSec('the in-tree notes', inTree);
      const sourceNotes = readText(skillPath(context, `RELEASE-NOTES-${CANDIDATE_VERSION}.md`));
      check(sourceNotes === RELEASE_NOTES_TEXT, 'the working-tree RELEASE-NOTES-3.0.0-rc.2.md is exactly the candidate text (byte equality)', sourceNotes === null ? 'missing' : sourceNotes.slice(0, 120));
      wantSec('the working-tree notes file', sourceNotes);
      const rc1Notes = readText(skillPath(context, 'RELEASE-NOTES-3.0.0-rc.1.md'));
      check(rc1Notes === RC1_RELEASE_NOTES_TEXT, 'the preserved RELEASE-NOTES-3.0.0-rc.1.md is exactly the historical rc.1 text (byte equality, still pinned independently)', rc1Notes === null ? 'missing' : rc1Notes.slice(0, 120));
      wantSec('the preserved rc.1 notes file', rc1Notes, ROLLBACK_TEXT);
      if (have) wantSec('the embedded publication copy', w.notesA.toString('utf8'));
      const mig = readText(skillPath(context, 'references/migration-v2.md'));
      const s1 = mig === null ? null : sectionOf(mig, '1. Upgrade boundary');
      const s5 = mig === null ? null : sectionOf(mig, '5. Commit, rerun and rollback');
      check(s1 !== null && squash(s1).includes(Q6_TEXT), 'references/migration-v2.md section 1 carries the Q6 paragraph (C8 text, not rewritten here)');
      check(s5 !== null && squash(s5).includes(CURRENT_ROLLBACK_TEXT), 'references/migration-v2.md section 5 carries the current rollback-order paragraph (C13-13 wording)');
    });
  });
}

// ================================================ S07/C11b/immutability ====
// Plan 5.5: release generation preserves the source and Git state of the synthetic repository: the working-tree subtree (a dirty tracked file and an untracked sentinel included), the raw index, HEAD and the tag
// ref, the tagged subtree identity and every file under .git, compared after both real builds and after output-write failures. Failure runs replay the recorded real Git results (no extra real build).
function firstInventoryDiff(a, b) {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) return `${k}: ${a[k] === undefined ? 'added' : b[k] === undefined ? 'removed' : 'changed'}`;
  return null;
}
async function immutabilityGroup(context) {
  return runAssertion(async ({ check, step }) => {
    const mark = processMark(context);
    const w = await getWorld(context);
    const snapDiff = (a, b) => (a.index !== b.index ? 'index' : a.head !== b.head ? 'HEAD' : a.tagRef !== b.tagRef ? 'tag ref' : firstInventoryDiff(a.subtree, b.subtree) ? `subtree ${firstInventoryDiff(a.subtree, b.subtree)}` : firstInventoryDiff(a.gitFiles, b.gitFiles) ? `.git ${firstInventoryDiff(a.gitFiles, b.gitFiles)}` : null);
    await step('plan 5.5: after build A (a child) and after build B (in process) the subtree inventory and bytes, the raw index, HEAD, the tag ref and every .git file are identical to the snapshot taken before generation', async () => {
      if (!w || !w.snap0 || !w.snapA || !w.snapB) { worldMissing(check, w, 'snapshots'); return; }
      check(Object.keys(w.snap0.subtree).includes('untracked-sentinel.txt') && Object.keys(w.snap0.gitFiles).length > 10 && w.snap0.index.length === 64, 'the baseline snapshot includes the dirty files, the untracked sentinel and the .git files (the control is real)', { subtree: Object.keys(w.snap0.subtree).length, git: Object.keys(w.snap0.gitFiles).length });
      check(snapDiff(w.snap0, w.snapA) === null, 'after the direct Node build: nothing changed', snapDiff(w.snap0, w.snapA));
      check(snapDiff(w.snap0, w.snapB) === null, 'after the in-process build: nothing changed', snapDiff(w.snap0, w.snapB));
      check(w.recB && w.recB.length === 7 && w.recB.every((c) => c.options.env.GIT_OPTIONAL_LOCKS === '0'), 'every release subprocess runs with optional locks disabled', w.recB && w.recB.map((c) => c.options.env.GIT_OPTIONAL_LOCKS));
    });
    await step('plan 5.5: after an exclusive-create race and after ZIP and notes write failures (replayed Git results, injected through the seam) the repository snapshot is still identical and no release output was written into the repository', async () => {
      const rel = await attempt(() => import(skillUrl(context, 'install/release.mjs')));
      if (!w || !w.snap0 || !w.replay || Object.keys(w.replay).length !== 7) { worldMissing(check, w, 'failure replay'); return; }
      if (rel.threw) { check(false, `cannot import install/release.mjs: ${errMsg(rel.error)}`); return; }
      const faults = [
        ['an exclusive-create race', 'f-race', { mkdir: (a, real) => { real(); throw errCode('EEXIST'); } }, 'RELEASE_OUT_EXISTS'],
        ['a ZIP write failure', 'f-zip', { write: (a, real) => { if (a[0].endsWith('.zip')) throw errCode('EIO'); return real(); } }, 'RELEASE_WRITE'],
        ['a notes write failure', 'f-notes', { write: (a, real) => { if (a[0].endsWith('RELEASE-NOTES.md')) throw errCode('EIO'); return real(); } }, 'RELEASE_WRITE'],
      ];
      for (const [label, name, over, code] of faults) {
        const seam = makeSeam(over);
        const out = mkOut(w.dir, name);
        const r = await callMain(rel.value, ['--tag', WORLD_TAG, '--out', out], { repository: w.repo, cwd: w.dir, env: w.cleanEnv, execute: scriptedExecutor(replaySpec(w)), fs: seam.fs });
        expectFail(check, label, r, code);
        const snap = snapshotRepo(w);
        check(snapDiff(w.snap0, snap) === null, `after ${label}: the synthetic repository is unchanged`, snapDiff(w.snap0, snap));
      }
    });
    await step('plan 5.5: only after every snapshot comparison, independent Git reads show the same HEAD, tag and tagged subtree identity', async () => {
      if (!w || !w.commit) { worldMissing(check, w, 'identity reads'); return; }
      const r = runGit(context, w.iso, w.repo, ['rev-parse', 'HEAD', `refs/tags/${WORLD_TAG}^{commit}`, 'HEAD:project-setup']);
      const l = gitText(r).trim().split('\n');
      check(r.status === 0 && l[0] === w.commit && l[1] === w.commit && l[2] === w.tree, 'HEAD, the synthetic tag and the tagged project-setup subtree keep their identities', l);
      const tags = runGit(context, w.iso, w.repo, ['tag', '-l']);
      check(eq(gitText(tags).trim().split('\n').sort(), ['c11b-fixture-annotated', 'c11b-fixture-blob', 'c11b-fixture-nosubtree', 'c11b-fixture-rc1', 'c11b-fixture-tree']), 'the builder created and changed no tag', gitText(tags));
    });
    flushProcessCount(context, 'S07/C11b/immutability', mark);
  });
}

// ================================================ S07/C11b/installed-payload ====
// Plan 3.7 and 5.6: the existing installer (never modified) installs the candidate source into two explicitly selected temporary parents; both copies hold exactly the 60-file inventory plus .installed.json,
// byte-equal to the source, with independently recomputed normalized and raw hashes. The static import-specifier inspection runs in process with the pinned regular expression.
const IMPORT_RE = /\b(?:from\s+|import\s*(?:\(\s*)?)(["'])(\.{1,2}\/[^"'\\\r\n]+)\1/g; // plan 3.7, exactly
const NORMALIZED = /\.(md|mjs|json|toml|txt)$|^VERSION$/;
const J = (v) => JSON.stringify(v, null, 2) + '\n';
// Plan 3.7: the installer's normalized payload hash: sorted relative paths, CRLF to LF for text, path + NUL + bytes + NUL.
function normalizedTreeHash(root, rels) {
  const h = crypto.createHash('sha256');
  for (const rel of [...rels].sort()) {
    const buf = fs.readFileSync(path.join(root, ...rel.split('/')));
    const body = NORMALIZED.test(rel) ? Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n')) : buf;
    h.update(rel).update('\0').update(body).update('\0');
  }
  return h.digest('hex');
}
// Plan 3.7: backups hash every regular file, metadata included, with raw bytes and the same path and NUL framing.
function rawTreeHash(root) {
  const rels = listFiles(root);
  const h = crypto.createHash('sha256');
  for (const rel of rels) h.update(rel).update('\0').update(fs.readFileSync(path.join(root, ...rel.split('/')))).update('\0');
  return { sha256: h.digest('hex'), files: rels.length };
}
// The import-specifier inspection of every .mjs file below root: all regex matches count, comments included; each captured specifier must resolve to an existing regular file inside the root.
function inspectImports(root) {
  const canon = fs.realpathSync.native(root);
  const files = listFiles(root).filter((f) => f.endsWith('.mjs'));
  const problems = []; let matches = 0;
  for (const rel of files) {
    const file = path.join(root, ...rel.split('/'));
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(IMPORT_RE)) {
      matches++;
      const target = path.resolve(path.dirname(file), m[2]);
      let st = null;
      try { st = fs.lstatSync(target); } catch { st = null; }
      if (!st || !st.isFile()) { problems.push(`${rel}: ${m[2]} is not an existing regular file`); continue; }
      let real = null;
      try { real = fs.realpathSync.native(target); } catch { real = null; }
      const inside = real !== null && (lc(real) === lc(canon) || lc(real).startsWith(lc(canon) + path.sep));
      if (!inside) problems.push(`${rel}: ${m[2]} resolves outside the installed root`);
    }
  }
  return { files: files.length, matches, problems };
}
function runInstaller(context, srcRoot, args, iso, cwd) {
  return spawnNode(context, [path.join(srcRoot, 'install', 'install.mjs'), ...args], { cwd, env: CLEAN_ENV(iso) });
}
const parseJson = (s) => { try { return JSON.parse(s); } catch { return null; } };
async function installedPayload(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mark = processMark(context);
    const baseline = await importOrFail(failures, testsUrl(context, 'helpers/v2-baseline.mjs'), 'tests/helpers/v2-baseline.mjs');
    await withScratch(context, 'payload', async (dir) => {
      const iso = isolation(path.join(dir, 'iso'));
      const claude = path.join(dir, 'claude-parent'); const codex = path.join(dir, 'codex-parent');
      const args = ['--claude-dir', claude, '--codex-dir', codex];
      const plain = path.join(dir, 'plain-cwd'); fs.mkdirSync(plain);
      let installed = false;
      await step('plan 3.7 and 5.6: the existing installer installs the candidate source into both temporary parents (HOME and USERPROFILE point into the fixture) and verify exits 0 with its existing success contract', async () => {
        const r = runInstaller(context, context.skillRoot, args, iso, dir);
        installed = r.status === 0;
        check(r.status === 0, 'the installer exits 0', { status: r.status, stdout: r.stdout.slice(0, 300), stderr: r.stderr.slice(0, 300) });
        const v = runInstaller(context, context.skillRoot, ['verify', ...args], iso, dir);
        const j = parseJson(v.stdout);
        check(v.status === 0 && v.stderr === '' && j && j.ok === true && Array.isArray(j.report) && j.report.length === 2 && j.report.every((x) => x.installed === true && x.state === 'current' && x.matchesThisSource === true) && eq(j.pluginCopies, []), 'verify exits 0 with ok true, both targets current and matching this source, no plugin copy', { status: v.status, stdout: v.stdout.slice(0, 300) });
      });
      const roots = [['claude', path.join(claude, 'project-setup')], ['codex', path.join(codex, 'project-setup')]];
      await step('plan 3.7: both copies contain exactly the 60-file inventory plus .installed.json, none of the listed absent entries, and every payload file equals the candidate source bytes', async () => {
        check(PAYLOAD_INVENTORY.length === 60 && new Set(PAYLOAD_INVENTORY).size === 60, 'the literal inventory has 60 unique files');
        for (const [name, root] of roots) {
          const found = listFiles(root);
          const want = [...PAYLOAD_INVENTORY, '.installed.json'].sort();
          check(eq(found, want), `${name}: the installed inventory is exactly the plan inventory plus .installed.json`, { missing: want.filter((f) => !found.includes(f)).slice(0, 6), extra: found.filter((f) => !want.includes(f)).slice(0, 6) });
          for (const a of PAYLOAD_ABSENT) check(!exists(path.join(root, ...a.replace(/\/$/, '').split('/'))), `${name}: ${a} is absent`);
          const differ = PAYLOAD_INVENTORY.filter((rel) => { const s = readBytes(skillPath(context, rel)); const d = readBytes(path.join(root, ...rel.split('/'))); return s === null || d === null || Buffer.compare(s, d) !== 0; });
          check(differ.length === 0, `${name}: every payload file equals the candidate source bytes`, differ.slice(0, 6));
        }
      });
      await step('plan 3.7: installer metadata (candidate version, the normalized payload hash recomputed independently with the existing algorithm) and the unchanged runtime catalog of seven members', async () => {
        const srcVersion = readText(skillPath(context, 'VERSION'));
        for (const [name, root] of roots) {
          const meta = parseJson(readText(path.join(root, '.installed.json')) || '');
          check(meta && eq(Object.keys(meta).sort(), ['installedAt', 'name', 'source', 'treeSha256', 'version']) && meta.name === 'project-setup', `${name}: .installed.json has the existing installer fields`, meta && Object.keys(meta));
          check(meta && srcVersion !== null && meta.version === srcVersion.trim() && meta.version === CANDIDATE_VERSION, `${name}: the installed version is the candidate version ${CANDIDATE_VERSION}`, meta && meta.version);
          check(meta && meta.treeSha256 === normalizedTreeHash(root, PAYLOAD_INVENTORY) && meta.treeSha256 === normalizedTreeHash(context.skillRoot, PAYLOAD_INVENTORY), `${name}: treeSha256 equals the independently recomputed normalized payload hash (installed and source)`, meta && meta.treeSha256);
          check(meta && typeof meta.source === 'string' && samePath(meta.source, context.skillRoot), `${name}: the recorded source is the candidate skill directory`, meta && meta.source);
          const catalog = parseJson(readText(path.join(root, 'data', 'runtime-units.json')) || '');
          check(catalog && Array.isArray(catalog.units) && eq(catalog.units.map((u) => path.posix.basename(u.source)), ['security-policy.mjs', 'git-safe-core.mjs', 'guard-raw-git-core.mjs', 'review-diff.mjs', 'git-safe.mjs', 'guard-raw-git.mjs', 'hooks-selftest.mjs']), `${name}: the runtime catalog keeps its seven members in order, neither the checker nor the doctor among them`, catalog && catalog.units && catalog.units.map((u) => u.source));
        }
      });
      await step('plan 3.7 and 5.6: the installed baseline checker succeeds from each copy outside any distribution history with exactly the six-file success JSON, exit 0 and empty stderr', async () => {
        const want = J({ ok: true, baseline: 'v2.0.0', files: ['data/v2.0.0/assets/agents/reviewer.md', 'data/v2.0.0/assets/agents/docs-sync.md', 'data/v2.0.0/assets/wrappers/claude-reviewer.md', 'data/v2.0.0/assets/wrappers/claude-docs-sync.md', 'data/v2.0.0/assets/wrappers/codex-reviewer.toml', 'data/v2.0.0/assets/wrappers/codex-docs_sync.toml'] });
        for (const [name, root] of roots) {
          const r = spawnNode(context, [path.join(root, 'scripts', 'check-agent-baselines.mjs')], { cwd: plain, env: CLEAN_ENV(iso) });
          check(r.status === 0 && r.stderr === '' && r.stdout === want, `${name}: the installed checker prints the exact success JSON`, { status: r.status, stdout: r.stdout.slice(0, 400), stderr: r.stderr.slice(0, 200) });
        }
        check(!exists(path.join(plain, '.git')) && fs.readdirSync(plain).length === 0, 'the checker needed and created nothing in its working directory');
      });
      await step('plan 3.7: all seven v2 snapshots (the policy snapshot included) in both copies equal the verified C11a tagged bytes', async () => {
        if (!baseline) return;
        const v = await attempt(() => baseline.verifyV2Snapshots({ repository: context.repository, skillRoot: context.skillRoot }));
        countProcess(context, 11);
        if (v.threw) { check(false, `the C11a tagged snapshot verification fails: ${errMsg(v.error)}`); return; }
        check(v.value.files.length === 7 && v.value.files.some((f) => f.snapshot === 'data/secret-paths-v2.0.0.json'), 'the verified mapping has seven snapshots, the policy snapshot included', v.value.files.map((f) => f.snapshot));
        for (const [name, root] of roots) {
          const bad = v.value.files.filter((f) => { const b = readBytes(path.join(root, ...f.snapshot.split('/'))); return b === null || sha256(b) !== f.sha256; }).map((f) => f.snapshot);
          check(bad.length === 0, `${name}: every installed snapshot equals its verified tagged bytes`, bad);
        }
      });
      await step('plan 3.7 and 5.6: the pinned import-specifier inspection finds every relative import in both installed copies resolving to an existing regular file inside the installed root', async () => {
        for (const [name, root] of roots) {
          const r = inspectImports(root);
          check(r.files > 10 && r.matches > 10 && r.problems.length === 0, `${name}: ${r.matches} matches in ${r.files} modules, none unresolved or escaping`, r.problems.slice(0, 5));
        }
        // Synthetic controls (plan 5.6): the scanner itself is verified in both directions, with every match counted, commented ones included.
        const base = path.join(dir, 'scan');
        const mk = (name, files) => { const root = path.join(base, name, 'skill'); for (const [rel, text] of Object.entries(files)) putFile(path.join(root, ...rel.split('/')), text); return root; };
        const good = mk('good', { 'scripts/a.mjs': "import x from './b.mjs';\nexport * from \"../assets/d.mjs\";\nimport './e.mjs';\nconst m = await import('./c.mjs');\nconst n = import(\"./c.mjs\");\n", 'scripts/b.mjs': 'export default 1;\n', 'scripts/c.mjs': 'export default 2;\n', 'scripts/e.mjs': '\n', 'assets/d.mjs': 'export const d = 1;\n' });
        const g = inspectImports(good);
        check(g.matches === 5 && g.problems.length === 0, 'control: a valid relative dependency set inside the root is accepted and all five forms are matched', g);
        const t = inspectImports(mk('tests', { 'scripts/x.mjs': "import '../tests/helpers/y.mjs';\n" }));
        check(t.matches === 1 && t.problems.length === 1, 'control: a missing dependency under the omitted tests/ fails', t);
        const i = inspectImports(mk('install', { 'scripts/x.mjs': "export { a } from '../install/z.mjs';\n" }));
        check(i.matches === 1 && i.problems.length === 1, 'control: a missing dependency under the omitted install/ fails', i);
        putFile(path.join(base, 'esc', 'outside.mjs'), 'export default 0;\n');
        const e = inspectImports(mk('esc', { 'scripts/esc.mjs': "import '../../outside.mjs';\n" }));
        check(e.matches === 1 && e.problems.length === 1 && /outside/.test(e.problems[0]), 'control: an existing dependency escaping the installed root fails', e);
        const c = inspectImports(mk('comment', { 'scripts/c.mjs': "// import x from './gone.mjs'\n/* from './also-gone.mjs' */\n" }));
        check(c.matches === 2 && c.problems.length === 2, 'control: commented-out matches are counted and must resolve (conservative)', c);
        const nodir = inspectImports(mk('dirdep', { 'scripts/d.mjs': "import './sub';\n", 'scripts/sub/index.mjs': '\n' }));
        check(nodir.matches === 1 && nodir.problems.length === 1, 'control: a specifier naming a directory is not an existing regular file', nodir);
        const nospace = inspectImports(mk('nospace', { 'scripts/n.mjs': "export * from'./nothing.mjs';\n" }));
        check(nospace.matches === 0 && nospace.problems.length === 0, 'C11b-P3-2: a from-specifier without whitespace is not matched (documented limit of the pinned expression)', nospace);
        const dyn = inspectImports(mk('dynamic', { 'scripts/n.mjs': "const f = (n) => import(n);\nconst g = import(`./${'x'}.mjs`);\n" }));
        check(dyn.matches === 0 && dyn.problems.length === 0, 'control: computed dynamic imports are not evaluated by the inspection', dyn);
      });
      await step('plan 5.6: hash domains stay distinct: a CRLF-only variation keeps the installer\'s normalized tree hash while raw snapshot hashing observes the byte change; an upgrade backup records a raw snapshot digest; the ZIP digest equals only the ZIP; the backup metadata never gains the ZIP or Git tree identity', async () => {
        const srcA = path.join(dir, 'src-a');
        copyTree(context.skillRoot, srcA, (rel) => !(rel === 'install' || rel.startsWith('install/') || PAYLOAD_INVENTORY.some((p) => p === rel || p.startsWith(`${rel}/`))));
        const parentA = path.join(dir, 'hash-parent');
        const hargs = ['--targets', 'claude', '--claude-dir', parentA];
        const a = runInstaller(context, srcA, hargs, iso, dir);
        check(a.status === 0, 'source A installs', { status: a.status, stderr: a.stderr.slice(0, 200) });
        const destA = path.join(parentA, 'project-setup');
        const metaA = parseJson(readText(path.join(destA, '.installed.json')) || '');
        const normA = normalizedTreeHash(srcA, PAYLOAD_INVENTORY);
        check(metaA && metaA.treeSha256 === normA, 'installer metadata equals the independent normalized hash of source A', metaA && metaA.treeSha256);
        const srcB = path.join(dir, 'src-b');
        copyTree(srcA, srcB);
        const crlfTarget = path.join(srcB, 'references', 'report.md');
        fs.writeFileSync(crlfTarget, fs.readFileSync(crlfTarget, 'utf8').replace(/\r?\n/g, '\r\n'));
        check(normalizedTreeHash(srcB, PAYLOAD_INVENTORY) === normA, 'a CRLF-only variation keeps the normalized tree hash');
        check(rawTreeHash(srcB).sha256 !== rawTreeHash(srcA).sha256 && Buffer.compare(readBytes(crlfTarget), readBytes(path.join(srcA, 'references', 'report.md'))) !== 0, 'raw snapshot hashing observes the same byte change');
        const vb = runInstaller(context, srcB, ['verify', ...hargs], iso, dir);
        const vj = parseJson(vb.stdout);
        check(vb.status === 0 && vj && vj.ok === true && vj.report[0].state === 'current', 'the installer treats the CRLF-only source as the same payload (verify is current)', { status: vb.status, state: vj && vj.report && vj.report[0].state });
        const srcC = path.join(dir, 'src-c');
        copyTree(srcA, srcC);
        fs.writeFileSync(path.join(srcC, 'VERSION'), '8.8.8\n');
        const c = runInstaller(context, srcC, hargs, iso, dir);
        check(c.status === 0, 'the changed source upgrades the installed copy', { status: c.status, stderr: c.stderr.slice(0, 200) });
        const backups = fs.readdirSync(parentA).filter((n) => n.startsWith('.project-setup.bak-') && !n.endsWith('.meta.json'));
        check(backups.length === 1, 'one backup was created by the upgrade', backups);
        if (backups.length === 1) {
          const backupDir = path.join(parentA, backups[0]);
          const metaText = readText(`${backupDir}.meta.json`) || '';
          const meta = parseJson(metaText);
          const raw = rawTreeHash(backupDir);
          check(meta && meta.snapshot && meta.snapshot.sha256 === raw.sha256 && meta.snapshot.files === raw.files, 'the backup snapshot digest equals the raw hash of every regular file, metadata included, with path and NUL framing', { meta: meta && meta.snapshot, raw });
          check(meta && meta.snapshot.sha256 !== normA && raw.sha256 !== normA, 'the raw backup digest differs from the normalized payload hash');
          const w = await getWorld(context);
          const zipSha = w && w.zipA ? sha256(w.zipA) : null;
          if (zipSha !== null && w.tree && w.commit) {
            check(new Set([zipSha, normA, raw.sha256, w.tree]).size === 4, 'the ZIP SHA256, the payload hash, the backup snapshot digest and the Git tree ID are four distinct values');
            check(!metaText.includes(zipSha) && !metaText.includes(w.tree) && !metaText.includes(w.commit) && !JSON.stringify(metaA).includes(zipSha) && !JSON.stringify(metaA).includes(w.tree), 'backup and installer metadata never contain the ZIP digest or the Git tree identity');
            const pub = w.notesA ? w.notesA.toString('utf8') : '';
            const digests = pub.match(/\b[0-9a-f]{64}\b/g) || [];
            check(eq(digests, [zipSha]) && !pub.includes(normA) && !pub.includes(raw.sha256), 'the publication SHA256 equals only the independently calculated ZIP digest (no payload or backup digest)', digests);
          } else check(false, 'the release world is unavailable for the ZIP digest comparison', w && w.problems);
        }
      });
    });
    flushProcessCount(context, 'S07/C11b/installed-payload', mark);
  });
}

// ================================================ S07/C11b/v2-compatibility ====
// Plan 5.7 and Q6: the tagged v2 schema check and the tagged v2 validate.mjs CLI reject manifest schema 3, using C11a's verified materialized tagged source. No old mutating command is run, and nothing
// claims a general pre-write guard in old commands.
async function v2Compatibility(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mark = processMark(context);
    const baseline = await importOrFail(failures, testsUrl(context, 'helpers/v2-baseline.mjs'), 'tests/helpers/v2-baseline.mjs');
    if (!baseline) return;
    await withScratch(context, 'v2', async (dir) => {
      const src = path.join(dir, 'v2-source');
      const m = await attempt(() => baseline.materializeV2Source({ repository: context.repository, destination: src }));
      countProcess(context, 4 + (m.threw ? 0 : listFiles(src).length)); // show-ref, two rev-parse, ls-tree and one cat-file per tagged blob
      if (m.threw) { check(false, `C11a cannot materialize the tagged v2 source: ${errMsg(m.error)}`); return; }
      const manifest = { schema: 3, skill: 'project-setup', skillVersion: CANDIDATE_VERSION, agents: ['claude', 'codex'], files: {} };
      await step('plan 5.7: the tagged v2 checkManifest returns exactly ["schema must be 2"] for the schema-3 object and [] when only the schema is changed to 2', async () => {
        const schemas = await attempt(() => import(pathToFileURL(path.join(src, 'scripts', 'schemas.mjs')).href));
        if (schemas.threw) { check(false, `cannot import the tagged v2 schemas: ${errMsg(schemas.error)}`); return; }
        check(eq(schemas.value.checkManifest(manifest), ['schema must be 2']), 'schema 3 gives exactly ["schema must be 2"]', schemas.value.checkManifest(manifest));
        check(eq(schemas.value.checkManifest({ ...manifest, schema: 2 }), []), 'changing only the schema to 2 gives exactly []', schemas.value.checkManifest({ ...manifest, schema: 2 }));
      });
      await step('plan 5.7: the tagged v2 validate.mjs --json on a minimal synthetic project exits 1 with empty stderr and exactly the two-row report, and leaves the project bytes unchanged', async () => {
        const iso = isolation(path.join(dir, 'iso'));
        const project = path.join(dir, 'project'); fs.mkdirSync(project);
        const g = runGit(context, iso, project, ['init', '-q']);
        check(g.status === 0, 'git init for the synthetic project');
        putFile(path.join(project, '.ai', 'manifest.json'), J(manifest));
        putFile(path.join(project, '.gitignore'), '.claude/settings.local.json\nCLAUDE.local.md\n');
        const skip = (r) => r === '.git' || r.startsWith('.git/');
        const before = inventoryOf(project, { skip });
        check(eq(Object.keys(before).sort(), ['.ai/manifest.json', '.gitignore']), 'the project holds exactly .ai/manifest.json and .gitignore', Object.keys(before));
        const r = spawnNode(context, [path.join(src, 'scripts', 'validate.mjs'), '--json'], { cwd: project, env: CLEAN_ENV(iso) });
        const want = J({
          ok: false, summary: { pass: 1, warn: 0, fail: 1 },
          results: [{ level: 'fail', check: 'json-schema', detail: '.ai/manifest.json: schema must be 2' }, { level: 'pass', check: 'secret-shaped-content', detail: '0 generated files scanned (pattern-based; not a guarantee)' }],
        });
        check(r.status === 1 && r.stderr === '' && r.stdout === want, 'exit 1, empty stderr and the exact two-space JSON report with a final LF', { status: r.status, stdout: r.stdout.slice(0, 500), stderr: r.stderr.slice(0, 200) });
        check(eq(inventoryOf(project, { skip }), before), 'the project bytes are unchanged by the validation');
      });
      await step('Q6: the candidate documents state the compatibility signal without claiming a general old-command guard (CHANGELOG entry, in-tree notes and C8\'s migration reference)', async () => {
        const entry = squash(lines(CHANGELOG_ENTRY_LINES));
        check(entry.includes('V2 validation rejects schema 3; this is not a retrofitted pre-write guard in every old command.'), 'the CHANGELOG entry carries the exact Q6 limitation');
        check(squash(RELEASE_NOTES_TEXT).includes('This is a compatibility signal, not a retrofitted pre-write guard in every old command. Do not use v2 commands to repair a schema-3 project.'), 'the notes carry the exact Q6 limitation');
        const changelog = readText(skillPath(context, 'CHANGELOG.md')) || '';
        check(squash(changelog).includes(entry), 'the working-tree CHANGELOG.md carries that entry');
      });
    });
    flushProcessCount(context, 'S07/C11b/v2-compatibility', mark);
  });
}

// ================================================ RC1/C11b/composition ====
// Plan 4.1, 4.2, 4.3, 5.8: the complete-case composition. Everything here is in process on synthetic reports: the memo factory is imported directly with a recording runner and a filesystem stub (never the
// baseline runner), the case table is an independent parse of the plan notation, and every mutation of a component report is checked against the exact diagnostics.
const COMPONENTS_OF_CASES = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10'];
const BASELINE_IDS = ('R01 R02 R03a R03b R04a R04b R05 R06 R06b R07 R08 R09 R10 R11 R12 R13a R13b R13c R13d R14a R14b R15 R16 R17 R18 R19 R20 R21 R22 '
  + 'R23a R23b R24 R25 R26 R27a R27b R27c R27d R28 R29 R30 R31 R32 R33 R34 R35 R36 R37 R38 R39 R40 S01 S02 S03 S04 S05 S06 S07 S08 S09').split(' ');
// The plan 4.2 notation parsed here, independently of the helper's literal arrays: "C4: R42/{ls,grep}" means R42/C4/ls and R42/C4/grep.
function parseCaseTable(tableLines) {
  const cases = []; let cur = null;
  for (const raw of tableLines) {
    if (raw.trim() === '') continue;
    if (!raw.startsWith(' ')) { const i = raw.indexOf('  '); cur = { id: raw.slice(0, i), name: raw.slice(i + 2).trim(), groups: new Map() }; cases.push(cur); continue; }
    const m = /^ {2}(C\d+): (\S+)$/.exec(raw);
    if (!m || !cur) throw new Error(`unparsed case table line ${raw}`);
    const slash = m[2].indexOf('/'); const head = m[2].slice(0, slash); const rest = m[2].slice(slash + 1);
    const names = rest.startsWith('{') ? rest.slice(1, -1).split(',') : [rest];
    cur.groups.set(m[1], [...(cur.groups.get(m[1]) || []), ...names.map((n) => `${head}/${m[1]}/${n}`)]);
  }
  return cases.map((c) => ({ id: c.id, name: c.name, groups: [...c.groups].map(([component, ids]) => ({ component, ids })) }));
}
const passReport = (component, expected) => {
  const results = expected[component].map((d) => ({ id: d.id, name: d.name, status: 'PASS', failures: [] }));
  return { component, ok: true, errors: [], summary: { passed: results.length, failed: 0, skipped: 0 }, results };
};
const withResults = (rep, results) => {
  const passed = results.filter((r) => r && r.status === 'PASS').length; const failed = results.filter((r) => r && r.status === 'FAIL').length;
  return { ...rep, ok: results.length > 0 && failed === 0, summary: { passed, failed, skipped: 0 }, results };
};
const structural = (component, error) => ({ component, ok: false, errors: [error], summary: { passed: 0, failed: 0, skipped: 0 }, results: [] });
const composeFailure = (message) => ({ failures: [message], skipped: null });
const diagOf = (kind, what) => `RC1_COMPOSITION: ${kind} ${what}`;

async function composition(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const mark = processMark(context);
    const helper = await importOrFail(failures, testsUrl(context, 'helpers/rc1-integration.mjs'), 'tests/helpers/rc1-integration.mjs');
    const rc = await importOrFail(failures, testsUrl(context, 'rc1-cases.mjs'), 'tests/rc1-cases.mjs');
    if (!helper || !rc) return;
    const expected = rc.COMPONENT_ASSERTIONS;
    const table = parseCaseTable(CASE_TABLE_LINES);

    await step('plan 2.4: exact export sets and import safety of the helper and of c11b.test.mjs (probe processes: nothing printed, nothing written, no registry import)', async () => {
      check(eq(Object.keys(helper).sort(), ['CASE_REQUIREMENTS', 'RC1_CASE_DESCRIPTORS', 'composeCaseOutcome', 'createComponentMemo']) && !('default' in helper), 'the helper exports exactly the four names', Object.keys(helper));
      await withScratch(context, 'probe', async (dir) => {
        for (const [rel, names] of [['helpers/rc1-integration.mjs', ['CASE_REQUIREMENTS', 'RC1_CASE_DESCRIPTORS', 'composeCaseOutcome', 'createComponentMemo']], ['c11b.test.mjs', ['C11B_IMPLEMENTATIONS']]]) {
          const r = spawnNode(context, ['--input-type=module', '-e', `import * as m from ${JSON.stringify(testsUrl(context, rel))}; process.stdout.write(JSON.stringify(Object.keys(m).sort()));`], { cwd: dir });
          check(r.status === 0 && r.stdout === JSON.stringify(names) && r.stderr === '', `importing ${rel} prints nothing and exposes exactly ${names.join(', ')}`, { status: r.status, stdout: r.stdout.slice(0, 200), stderr: r.stderr.slice(0, 200) });
        }
        check(fs.readdirSync(dir).length === 0, 'importing either module writes nothing');
      });
      for (const rel of ['helpers/rc1-integration.mjs', 'c11b.test.mjs']) {
        const text = readText(path.join(context.skillRoot, 'tests', ...rel.split('/'))) || '';
        check(!/^\s*import\s[^;\n]*['"][^'"\n]*rc1-cases\.mjs['"]/m.test(text), `${rel} has no static import of rc1-cases.mjs (call-time dynamic imports only)`);
      }
    });

    await step('plan 4.2: the 40 complete cases, their exact names and every literal assertion ID, in first-appearance component order, match an independent parse of the plan table (the helper arrays are not the oracle)', async () => {
      check(table.length === 40 && eq(table.map((c) => c.id), [...rc.RC1_CASE_IDS]), 'the plan table has 40 cases in RC1_CASE_IDS order', table.map((c) => c.id));
      check(eq(helper.RC1_CASE_DESCRIPTORS.map((d) => ({ id: d.id, name: d.name })), table.map((c) => ({ id: c.id, name: c.name }))), 'RC1_CASE_DESCRIPTORS holds the 40 IDs and exact PASS-record names in order', helper.RC1_CASE_DESCRIPTORS.map((d) => d.id));
      for (const c of table) {
        const got = helper.CASE_REQUIREMENTS[c.id];
        check(eq(got, c.groups), `${c.id}: required components (first-appearance order) and literal assertion IDs`, got);
        for (const g of c.groups) for (const id of g.ids) check(expected[g.component] && expected[g.component].some((d) => d.id === id), `${c.id}: ${id} is an expected assertion of ${g.component}`);
      }
      const total = table.reduce((n, c) => n + c.groups.reduce((m, g) => m + g.ids.length, 0), 0);
      check(total >= 100, 'the table carries every literal assertion ID of plan 4.2', total);
      check(table.every((c) => !BASELINE_IDS.includes(c.id)) && new Set(table.map((c) => c.id)).size === 40, 'no baseline case ID is registered again and the 40 IDs are unique');
      check(table.every((c) => c.groups.every((g) => COMPONENTS_OF_CASES.includes(g.component))), 'only C1 to C10 contribute');
    });

    await step('plan 4.1 and 5.8: createComponentMemo is a factory over { run, fs, tmpRoot, baseContext }; creating one does nothing; each call owns a fresh cache', async () => {
      const log = [];
      const stub = { mkdirSync: (...a) => log.push(['mkdir', ...a]), writeFileSync: (...a) => log.push(['write', ...a]) };
      const run = async (...a) => { log.push(['run', ...a]); return passReport('C1', expected); };
      const guard = await withStreamGuard(async () => {
        const memo = helper.createComponentMemo({ run, fs: stub, tmpRoot: path.join(context.tmp, 'memo-root'), baseContext: { repository: 'R', skillRoot: 'S', env: { A: '1' } } });
        return memo;
      });
      const memo = guard.value;
      check(guard.threw === null && eq(Object.keys(memo).sort(), ['getComponent', 'runComponentAssertions']) && typeof memo.getComponent === 'function' && typeof memo.runComponentAssertions === 'function', 'the factory returns exactly { runComponentAssertions, getComponent }', guard.threw && errMsg(guard.threw));
      check(log.length === 0 && guard.out.length === 0 && guard.err.length === 0, 'creating a memo performs no filesystem work, no execution and no output', log);
      check(helper.createComponentMemo({ run, fs: stub, tmpRoot: 'x', baseContext: {} }) !== helper.createComponentMemo({ run, fs: stub, tmpRoot: 'x', baseContext: {} }), 'each factory call returns an independent memo');
    });

    await step('plan 4.1: one execution per component, a shared concurrent promise, the exact evidence write after the report resolves and before the cached promise resolves, and the report returned unchanged', async () => {
      const tmpRoot = path.join(context.tmp, 'memo-root');
      const events = [];
      const stub = { mkdirSync: (...a) => events.push(['mkdir', ...a]), writeFileSync: (...a) => events.push(['write', ...a]) };
      const report = passReport('C4', expected);
      const run = async (component, ctx) => { events.push(['run-start', component, ctx]); await sleep(5); events.push(['run-end', component]); return report; };
      const baseContext = { repository: path.join('repo', 'root'), skillRoot: path.join('repo', 'root', 'project-setup'), env: { ONE: '1', TWO: '2' } };
      const g = await withStreamGuard(async () => {
        const memo = helper.createComponentMemo({ run, fs: stub, tmpRoot, baseContext });
        const baselineCtx = { repository: 'r', skillRoot: 's', tmp: path.join(tmpRoot, 'c4'), env: { X: '1' } };
        const p1 = memo.runComponentAssertions('C4', baselineCtx);
        const startedSync = events.filter((e) => e[0] === 'run-start').length;
        const p2 = memo.runComponentAssertions('C4', { ...baselineCtx, tmp: path.join(tmpRoot, 'other') });
        const p3 = memo.getComponent('C4');
        const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
        events.push(['resolved']);
        return { memo, p1, p2, p3, r1, r2, r3, startedSync, baselineCtx };
      });
      if (g.threw) { check(false, `memo run threw: ${errMsg(g.threw)}`); return; }
      const v = g.value;
      check(v.startedSync === 1, 'the first call executes run(component, context) at once', v.startedSync);
      check(v.p1 === v.p2 && v.p2 === v.p3 && v.r1 === report && v.r2 === report && v.r3 === report, 'concurrent baseline and complete requests share one promise and one unchanged report');
      const names = events.map((e) => e[0]);
      check(eq(names, ['run-start', 'run-end', 'write', 'resolved']), 'run once, then exactly one evidence write, then the cached promise resolves (no directory is created for an already requested component)', names);
      const w = events.find((e) => e[0] === 'write');
      check(w && w.length === 4 && w[1] === path.join(tmpRoot, 'c4', 'integration-results.json') && w[2] === JSON.stringify(report, null, 2) + '\n' && eq(w[3], { flag: 'wx' }), 'the evidence goes to <context.tmp>/integration-results.json with the exact JSON text and { flag: "wx" }', w && [w[1], w[3]]);
      const started = events.find((e) => e[0] === 'run-start');
      check(started && started[2] === v.baselineCtx, 'run receives the first caller\'s context object as is');
      const memo2Events = [];
      const g2 = await withStreamGuard(async () => {
        const memo = helper.createComponentMemo({ run: async (c, ctx) => { memo2Events.push(['run', c, ctx]); return passReport('C3', expected); }, fs: { mkdirSync: (...a) => memo2Events.push(['mkdir', ...a]), writeFileSync: (...a) => memo2Events.push(['write', ...a]) }, tmpRoot, baseContext });
        await memo.getComponent('C3');
        await memo.getComponent('C3');
        await memo.runComponentAssertions('C3', { tmp: 'unused' });
        return null;
      });
      check(g2.threw === null && memo2Events.filter((e) => e[0] === 'run').length === 1 && memo2Events.filter((e) => e[0] === 'write').length === 1 && memo2Events.filter((e) => e[0] === 'mkdir').length === 1, 'repeated complete and baseline requests run, write and create a directory exactly once', memo2Events.map((e) => e[0]));
      check(g.out.length === 0 && g.err.length === 0 && g2.out.length === 0 && g2.err.length === 0, 'the memo prints nothing');
    });

    await step('plan 4.1: getComponent creates the lowercased component directory (recursive) only for a component not already run and starts it with the baseline context shape; baseline first means no directory', async () => {
      const tmpRoot = path.join(context.tmp, 'memo-root-2');
      const baseContext = { repository: path.join('repo'), skillRoot: path.join('repo', 'project-setup'), env: { ONE: '1' } };
      for (const component of ['C1', 'C11a', 'C10', 'C11b']) {
        const events = [];
        const memo = helper.createComponentMemo({ run: async (c, ctx) => { events.push(['run', c, ctx]); return passReport('C1', expected); }, fs: { mkdirSync: (...a) => events.push(['mkdir', ...a]), writeFileSync: (...a) => events.push(['write', ...a]) }, tmpRoot, baseContext });
        await memo.getComponent(component);
        const tmp = path.join(tmpRoot, component.toLowerCase());
        const mk = events.filter((e) => e[0] === 'mkdir'); const rn = events.find((e) => e[0] === 'run');
        check(mk.length === 1 && mk[0][1] === tmp && eq(mk[0][2], { recursive: true }) && mk[0].length === 3, `${component}: mkdirSync(${component.toLowerCase()} directory, { recursive: true }) once`, mk);
        check(rn && rn[1] === component && eq(rn[2], { repository: baseContext.repository, skillRoot: baseContext.skillRoot, tmp, env: { ONE: '1' } }) && rn[2].env !== baseContext.env && eq(Object.keys(rn[2]), ['repository', 'skillRoot', 'tmp', 'env']), `${component}: the exact baseline context shape with a copied env`, rn && rn[2]);
        check(events.map((e) => e[0]).join() === 'mkdir,run,write', `${component}: the directory is created before the component starts`, events.map((e) => e[0]));
      }
      const events = [];
      const memo = helper.createComponentMemo({ run: async (c) => { events.push(['run', c]); return passReport('C2', expected); }, fs: { mkdirSync: (...a) => events.push(['mkdir', ...a]), writeFileSync: (...a) => events.push(['write', ...a]) }, tmpRoot, baseContext });
      await memo.runComponentAssertions('C2', { repository: 'r', skillRoot: 's', tmp: path.join(tmpRoot, 'c2'), env: {} });
      await memo.getComponent('C2');
      check(!events.some((e) => e[0] === 'mkdir'), 'a baseline-first component later requested as complete creates no directory', events.map((e) => e[0]));
    });

    await step('plan 4.1: no retry after a rejected run, a failed report or an evidence-write failure; the failures stay cached; the evidence failure carries code RC1_EVIDENCE_WRITE and the exact message', async () => {
      const tmpRoot = path.join(context.tmp, 'memo-root-3');
      const mk = (runImpl, writeImpl) => { const events = []; const memo = helper.createComponentMemo({ run: async (c, ctx) => { events.push('run'); return runImpl(c, ctx); }, fs: { mkdirSync: () => events.push('mkdir'), writeFileSync: (...a) => { events.push('write'); if (writeImpl) writeImpl(...a); } }, tmpRoot, baseContext: { repository: 'r', skillRoot: 's', env: {} } }); return { memo, events }; };
      const boom = new Error('executor exploded');
      const a = mk(() => { throw boom; });
      const ra = await attempt(() => a.memo.getComponent('C5')); const ra2 = await attempt(() => a.memo.getComponent('C5'));
      check(ra.threw && ra.error === boom && ra2.threw && ra2.error === boom && a.events.filter((e) => e === 'run').length === 1 && !a.events.includes('write'), 'a rejected run is cached, not retried, and writes no evidence', a.events);
      const failing = { ...passReport('C6', expected), ok: false, summary: { passed: 11, failed: 1, skipped: 0 } };
      failing.results = failing.results.map((r, i) => (i === 0 ? { ...r, status: 'FAIL', failures: ['x'] } : r));
      const b = mk(() => failing);
      const rb = await b.memo.getComponent('C6'); const rb2 = await b.memo.getComponent('C6');
      check(rb === failing && rb2 === failing && b.events.filter((e) => e === 'run').length === 1 && b.events.filter((e) => e === 'write').length === 1, 'a failed report is returned (and its evidence written) once and never retried', b.events);
      const c = mk(() => passReport('C7', expected), () => { throw errCode('EEXIST'); });
      const rc1 = await attempt(() => c.memo.getComponent('C7')); const rc2 = await attempt(() => c.memo.getComponent('C7'));
      check(rc1.threw && rc1.error instanceof Error && rc1.error.code === 'RC1_EVIDENCE_WRITE' && rc1.error.message === 'RC1_COMPOSITION: evidence write failed C7', 'an evidence-write failure rejects with code RC1_EVIDENCE_WRITE and message "RC1_COMPOSITION: evidence write failed C7"', rc1.threw ? { code: rc1.error.code, message: rc1.error.message } : 'resolved');
      check(rc2.threw && rc2.error === rc1.error && c.events.filter((e) => e === 'run').length === 1 && c.events.filter((e) => e === 'write').length === 1, 'the evidence failure stays cached and is not retried', c.events);
      const d1 = mk(() => passReport('C8', expected)); const d2 = mk(() => passReport('C8', expected));
      await d1.memo.getComponent('C8'); await d2.memo.getComponent('C8');
      check(d1.events.filter((e) => e === 'run').length === 1 && d2.events.filter((e) => e === 'run').length === 1, 'a second factory call executes the component afresh');
    });

    await step('plan 4.1 and 4.2: composeCaseOutcome succeeds with exactly { failures: [], skipped: null } for every one of the 40 cases when all required component reports are complete passes; an unknown case is reported', async () => {
      const all = new Map(COMPONENTS_OF_CASES.map((c) => [c, passReport(c, expected)]));
      for (const c of table) {
        const r = helper.composeCaseOutcome(c.id, all, expected);
        check(eq(r, { failures: [], skipped: null }) && Object.keys(r).join() === 'failures,skipped', `${c.id}: success is exactly { failures: [], skipped: null }`, r);
      }
      for (const id of ['R999', 'R01', 'toString', 'constructor', '__proto__', '', 'r41', 'R41 ']) check(eq(helper.composeCaseOutcome(id, all, expected), composeFailure(diagOf('unknown', `case ${id}`))), `unknown case ${show(id)}: exactly one RC1_COMPOSITION: unknown case diagnostic`, helper.composeCaseOutcome(id, all, expected));
    });

    await step('plan 5.8: every required group removed individually, and duplicate, reordered, additional and renamed groups, FAIL or PASS with the wrong failures, missing or invalid result fields, a contradictory summary, a nonzero skipped count and a missing report give the exact diagnostics (first required component only)', async () => {
      const all = () => new Map(COMPONENTS_OF_CASES.map((c) => [c, passReport(c, expected)]));
      const run = (id, mutate) => { const m = all(); mutate(m); return helper.composeCaseOutcome(id, m, expected); };
      for (const c of table) {
        for (const g of c.groups) {
          for (const id of g.ids) {
            const r = run(c.id, (m) => { const rep = m.get(g.component); m.set(g.component, withResults(rep, rep.results.filter((x) => x.id !== id))); });
            if (!eq(r, composeFailure(diagOf('missing assertion', id)))) check(false, `${c.id}: removing ${id} gives exactly "${diagOf('missing assertion', id)}"`, r);
          }
        }
      }
      const dupId = expected.C4[0].id;
      const mutC4 = (fn, id = 'R41') => run(id, (m) => { const rep = m.get('C4'); m.set('C4', fn(rep)); });
      const bad = (label, r, want) => check(eq(r, composeFailure(want)), `${label}: exactly "${want}"`, r);
      bad('a duplicated group', mutC4((rep) => withResults(rep, [...rep.results, { ...rep.results[0] }])), diagOf('invalid component report', 'C4'));
      bad('a reordered pair of groups', mutC4((rep) => withResults(rep, [rep.results[1], rep.results[0], ...rep.results.slice(2)])), diagOf('invalid component report', 'C4'));
      bad('an additional group', mutC4((rep) => withResults(rep, [...rep.results, { id: 'R99/C4/extra', name: 'an extra group', status: 'PASS', failures: [] }])), diagOf('invalid component report', 'C4'));
      bad('a renamed group', mutC4((rep) => withResults(rep, rep.results.map((r, i) => (i === 0 ? { ...r, name: `${r.name} changed` } : r)))), diagOf('invalid component report', 'C4'));
      bad('a FAIL with failures', mutC4((rep) => withResults(rep, rep.results.map((r, i) => (i === 3 ? { ...r, status: 'FAIL', failures: ['boom'] } : r)))), diagOf('component failed', 'C4'));
      bad('a FAIL of a group the case does not name still fails the whole component', mutC4((rep) => withResults(rep, rep.results.map((r, i) => (r.id === dupId ? r : i === rep.results.length - 1 ? { ...r, status: 'FAIL', failures: ['x'] } : r)))), diagOf('component failed', 'C4'));
      bad('a PASS with failures', mutC4((rep) => withResults(rep, rep.results.map((r, i) => (i === 0 ? { ...r, failures: ['leftover'] } : r)))), diagOf('invalid component report', 'C4'));
      bad('a FAIL without failures', mutC4((rep) => withResults(rep, rep.results.map((r, i) => (i === 0 ? { ...r, status: 'FAIL', failures: [] } : r)))), diagOf('invalid component report', 'C4'));
      for (const [label, fn] of [['a missing status', (r) => { const { status, ...rest } = r; void status; return rest; }], ['a SKIP status', (r) => ({ ...r, status: 'SKIP' })], ['a lowercase status', (r) => ({ ...r, status: 'pass' })],
        ['a missing failures field', (r) => { const { failures: f, ...rest } = r; void f; return rest; }], ['failures that is not an array', (r) => ({ ...r, failures: 'x' })], ['a nonstring failure', (r) => ({ ...r, status: 'FAIL', failures: [5] })],
        ['a missing id', (r) => { const { id, ...rest } = r; void id; return rest; }], ['a missing name', (r) => { const { name, ...rest } = r; void name; return rest; }], ['a multi-line name', (r) => ({ ...r, name: 'a\nb' })], ['a non-object result', () => 'PASS']]) {
        bad(label, mutC4((rep) => ({ ...rep, results: rep.results.map((r, i) => (i === 0 ? fn(r) : r)) })), diagOf('invalid component report', 'C4'));
      }
      bad('ok true with a contradictory summary', mutC4((rep) => ({ ...rep, summary: { ...rep.summary, passed: rep.summary.passed - 1 } })), diagOf('invalid component report', 'C4'));
      bad('ok true with failed results', mutC4((rep) => ({ ...rep, results: rep.results.map((r, i) => (i === 0 ? { ...r, status: 'FAIL', failures: ['x'] } : r)) })), diagOf('invalid component report', 'C4'));
      bad('ok false with every result passing', mutC4((rep) => ({ ...rep, ok: false })), diagOf('invalid component report', 'C4'));
      bad('a nonzero skipped count', mutC4((rep) => ({ ...rep, summary: { ...rep.summary, skipped: 1 } })), diagOf('invalid component report', 'C4'));
      bad('a nonnumeric summary', mutC4((rep) => ({ ...rep, summary: { passed: '17', failed: 0, skipped: 0 } })), diagOf('invalid component report', 'C4'));
      bad('a report for another component', mutC4((rep) => ({ ...rep, component: 'C5' })), diagOf('invalid component report', 'C4'));
      bad('a report that is not an object', mutC4(() => 'report'), diagOf('invalid component report', 'C4'));
      bad('a report with no errors array', mutC4((rep) => { const { errors, ...rest } = rep; void errors; return rest; }), diagOf('invalid component report', 'C4'));
      bad('an empty results list that claims success is contradictory', mutC4((rep) => ({ ...rep, ok: true, summary: { passed: 0, failed: 0, skipped: 0 }, results: [] })), diagOf('invalid component report', 'C4'));
      // PLAN-GAP: which missing ID is named for an inventory with no result at all is not pinned (the first expected ID is natural); only the diagnostic family and an expected C4 ID are asserted.
      const noResults = mutC4((rep) => ({ ...rep, ok: false, summary: { passed: 0, failed: 0, skipped: 0 }, results: [] }));
      check(noResults.skipped === null && noResults.failures.length === 1 && expected.C4.some((d) => noResults.failures[0] === diagOf('missing assertion', d.id)), 'an otherwise valid report with no groups at all is an incomplete inventory: missing assertion <an expected C4 ID>', noResults);
      check(eq(run('R41', (m) => m.delete('C4')), composeFailure(diagOf('missing component', 'C4'))), 'a missing component report: exactly "RC1_COMPOSITION: missing component C4"');
      check(eq(helper.composeCaseOutcome('R41', new Map(), expected), composeFailure(diagOf('missing component', 'C4'))), 'an empty report map: missing component C4');
      // The first diagnostic follows first-appearance order: R44 needs C1 then C3.
      check(eq(run('R44', (m) => { m.delete('C1'); m.delete('C3'); }), composeFailure(diagOf('missing component', 'C1'))), 'R44 with both reports missing reports C1 only');
      check(eq(run('R44', (m) => { const rep = m.get('C3'); m.set('C3', withResults(rep, rep.results.map((r, i) => (i === 0 ? { ...r, status: 'FAIL', failures: ['x'] } : r)))); m.set('C1', { ...m.get('C1'), summary: { passed: 1, failed: 0, skipped: 0 } }); }), composeFailure(diagOf('invalid component report', 'C1'))), 'R44 with an invalid C1 and a failed C3 reports C1 only');
      check(eq(run('R44', (m) => { const rep = m.get('C3'); m.set('C3', withResults(rep, rep.results.map((r, i) => (i === 0 ? { ...r, status: 'FAIL', failures: ['x'] } : r)))); }), composeFailure(diagOf('component failed', 'C3'))), 'R44 with only C3 failing reports "component failed C3"');
    });

    await step('plan 4.1 and 5.8: each runner structural error code, an unknown code, a malformed envelope, a missing-group error with an invalid ID and structural errors competing with malformed results map exactly as the plan table says', async () => {
      const id0 = expected.C4[0].id;
      const run = (error, extra = {}) => { const m = new Map(COMPONENTS_OF_CASES.map((c) => [c, passReport(c, expected)])); m.set('C4', { ...structural('C4', error), ...extra }); return helper.composeCaseOutcome('R41', m, expected); };
      const invalid = composeFailure(diagOf('invalid component report', 'C4'));
      check(eq(run({ code: 'missing-group', id: id0 }), composeFailure(diagOf('missing assertion', id0))), 'missing-group with an expected assertion ID: missing assertion <id>');
      check(eq(run({ code: 'missing-group', id: expected.C4[5].id }), composeFailure(diagOf('missing assertion', expected.C4[5].id))), 'missing-group names any expected assertion ID of the component');
      for (const [label, error] of [['missing-group with an unknown ID', { code: 'missing-group', id: 'R41/C4/nothing' }], ['missing-group with an ID of another component', { code: 'missing-group', id: expected.C5[0].id }], ['missing-group without an ID', { code: 'missing-group' }],
        ['missing-group with a null ID', { code: 'missing-group', id: null }], ['missing-group with a numeric ID', { code: 'missing-group', id: 5 }], ['duplicate-group', { code: 'duplicate-group', id: id0 }], ['unexpected-group', { code: 'unexpected-group', id: 'R41/C4/surprise' }],
        ['inventory-invalid with an ID', { code: 'inventory-invalid', id: id0 }], ['inventory-invalid with a null ID', { code: 'inventory-invalid', id: null }], ['empty-inventory', { code: 'empty-inventory' }], ['component-unknown', { code: 'component-unknown' }],
        ['duplicate-expected', { code: 'duplicate-expected', id: id0 }], ['an unknown structural code', { code: 'something-new' }], ['an error without a code', { id: id0 }], ['an error that is a string', 'missing-group'], ['an error that is null', null], ['an empty code', { code: '' }]]) {
        check(eq(run(error), invalid), `${label}: invalid component report`, run(error));
      }
      check(eq(run({ code: 'missing-group', id: id0 }, { ok: true }), invalid), 'a structural error with ok true is malformed', run({ code: 'missing-group', id: id0 }, { ok: true }));
      check(eq(run({ code: 'missing-group', id: id0 }, { summary: { passed: 1, failed: 0, skipped: 0 } }), invalid), 'a structural error with nonzero counts is malformed');
      check(eq(run({ code: 'missing-group', id: id0 }, { errors: [{ code: 'missing-group', id: id0 }, { code: 'duplicate-group', id: id0 }] }), invalid), 'two structural errors are malformed');
      check(eq(run({ code: 'missing-group', id: id0 }, { results: [{ id: 'x', name: 'y', status: 'PASS', failures: [] }] }), invalid), 'a structural error beside results is malformed');
      check(eq(run({ code: 'missing-group', id: id0 }, { results: ['garbage', 5, null] }), invalid), 'a structural error competing with malformed result entries is malformed (the report-level check wins)');
      check(eq(run({ code: 'missing-group', id: id0 }, { errors: 'missing-group' }), invalid), 'a structural-error envelope whose errors is not an array is malformed');
      check(eq(run({ code: 'missing-group', id: id0 }, { component: 'C3' }), invalid), 'a structural report for another component is malformed');
    });

    await step('plan 4.1 and 4.2: registerRc1Cases registers exactly the 40 cases synchronously (no execution, no execution-only context access), each callback requests its components through context.getComponent in plan order and maps provider failures to the exact diagnostics', async () => {
      const calls = [];
      const touched = [];
      const guarded = new Proxy({}, { get: (t, k) => { if (k === 'getComponent') return () => { touched.push('getComponent called'); throw new Error('no execution at registration'); }; touched.push(String(k)); throw new Error(`context.${String(k)} read at registration`); } });
      for (const [label, ctx] of [['the partial { repository } context', { repository: context.repository }], ['an empty context', {}], ['a context whose execution-only fields throw on access', guarded]]) {
        const before = calls.length;
        const g = await withStreamGuard(async () => rc.registerRc1Cases((...a) => calls.push(a), ctx));
        const batch = calls.slice(before);
        check(g.threw === null && g.value === undefined && batch.length === 40 && g.out.length === 0 && g.err.length === 0 && touched.length === 0, `${label}: registration returns undefined, registers 40 cases, prints nothing and reads or calls nothing`, { threw: g.threw && errMsg(g.threw), ret: g.value, n: batch.length, touched });
        check(eq(batch.map((a) => a[0]), [...rc.RC1_CASE_IDS]) && eq(batch.map((a) => a[1]), table.map((c) => c.name)) && batch.every((a) => a.length === 3 && typeof a[2] === 'function'), `${label}: the 40 IDs and exact names in RC1_CASE_IDS order, each with a function callback`);
        check(batch.every((a) => !BASELINE_IDS.includes(a[0])), `${label}: no baseline ID is registered again`);
      }
      // Every callback runs against a recording provider of complete passing reports, through its own registration.
      const reports = new Map(COMPONENTS_OF_CASES.map((c) => [c, passReport(c, expected)]));
      const reg = (ctx, id) => { const list = []; rc.registerRc1Cases((a, b, f) => list.push([a, b, f]), ctx); return list.find((x) => x[0] === id)[2]; };
      let exercised = 0;
      for (const c of table) {
        const seen = [];
        const ctx = { getComponent: async (name) => { seen.push(name); return reports.get(name); } };
        const rec = await withStreamGuard(async () => reg(ctx, c.id)());
        const want = c.groups.map((g2) => g2.component);
        check(rec.threw === null && eq(rec.value, { failures: [], skipped: null }) && eq(seen, want) && rec.out.length === 0 && rec.err.length === 0, `${c.id}: success { failures: [], skipped: null }; the provider is asked for ${want.join(', ')} in order, once each; nothing is printed`, { value: rec.value, asked: seen });
        exercised++;
      }
      check(exercised === 40, 'all 40 callbacks were exercised');
      const exec = async (ctx, id) => (await withStreamGuard(() => reg(ctx, id)())).value;
      const fail = (kind, c) => composeFailure(diagOf(kind, c));
      check(eq(await exec({}, 'R44'), fail('component execution failed', 'C1')), 'a missing provider fails the first required component: component execution failed C1');
      check(eq(await exec({ getComponent: 5 }, 'R44'), fail('component execution failed', 'C1')), 'a non-function provider fails the first required component');
      check(eq(await exec({ getComponent: () => Promise.reject(new Error('x')) }, 'R44'), fail('component execution failed', 'C1')), 'a rejection fails that component');
      check(eq(await exec({ getComponent: (c) => (c === 'C3' ? Promise.reject(new Error('x')) : Promise.resolve(reports.get(c))) }, 'R44'), fail('component execution failed', 'C3')), 'a rejection of the second component names that component');
      check(eq(await exec({ getComponent: () => { throw new Error('sync'); } }, 'R41'), fail('component execution failed', 'C4')), 'a synchronous provider failure is an execution failure too');
      check(eq(await exec({ getComponent: () => Promise.reject('plain string') }, 'R41'), fail('component execution failed', 'C4')), 'a non-Error rejection is an execution failure');
      const evidence = Object.assign(new Error('RC1_COMPOSITION: evidence write failed C4'), { code: 'RC1_EVIDENCE_WRITE' });
      check(eq(await exec({ getComponent: () => Promise.reject(evidence) }, 'R41'), fail('evidence write failed', 'C4')), 'an RC1_EVIDENCE_WRITE rejection gives the exact evidence-write diagnostic');
      const failedReport = withResults(reports.get('C4'), reports.get('C4').results.map((r, i) => (i === 0 ? { ...r, status: 'FAIL', failures: ['x'] } : r)));
      check(eq(await exec({ getComponent: (c) => Promise.resolve(c === 'C4' ? failedReport : reports.get(c)) }, 'R41'), fail('component failed', 'C4')), 'a failed component report fails the case: component failed C4');
      const counts = []; await exec({ getComponent: (c) => { counts.push(c); return Promise.resolve(reports.get(c)); } }, 'R97');
      check(eq(counts, ['C1', 'C3', 'C4', 'C5', 'C9', 'C10']), 'R97 requests C1, C3, C4, C5, C9 and C10 in that order, once each', counts);
    });

    await step('plan 5 and 6.1: COMPONENT_ASSERTIONS.C11b is the independent ten-descriptor list and COMPONENT_IMPLEMENTATIONS.C11b holds exactly the C11B_IMPLEMENTATIONS functions of this module', async () => {
      const want = [['S07/C11b/release-cli', 'release arguments streams and errors are exact'], ['S07/C11b/identity', 'release identity comes from the named local tag'], ['S07/C11b/archive', 'commit archives are reproducible and complete'],
        ['S07/C11b/notes', 'publication notes bind identity without self reference'], ['S07/C11b/immutability', 'release generation preserves source and Git state'], ['S07/C11b/installed-payload', 'both installed copies contain the complete candidate payload'],
        ['S07/C11b/v2-compatibility', 'v2 validation rejects schema three without a broader guard claim'], ['RC1/C11b/composition', 'complete records require every component assertion'],
        ['RC1/C11b/strict-gate', 'candidate acceptance rejects incomplete or contradictory evidence'], ['RC1/C11b/documentation', 'release documentation preserves frozen contracts and pending evidence']].map(([id, name]) => ({ id, name }));
      check(eq(JSON.parse(JSON.stringify(expected.C11b)), want), 'COMPONENT_ASSERTIONS.C11b lists the ten descriptors of plan 5 in order', expected.C11b);
      const impls = rc.COMPONENT_IMPLEMENTATIONS.C11b;
      check(Array.isArray(impls) && Object.isFrozen(impls) && impls.length === 10 && C11B_IMPLEMENTATIONS.every((m, i) => impls[i] === m) && eq(impls.map((m) => m.id), want.map((d) => d.id)), 'COMPONENT_IMPLEMENTATIONS.C11b holds the same ten function objects in order', impls && impls.map((m) => m.id));
      check(Object.isFrozen(C11B_IMPLEMENTATIONS) && C11B_IMPLEMENTATIONS.every((m) => typeof m.run === 'function' && Object.isFrozen(m)), 'C11B_IMPLEMENTATIONS is a frozen array of frozen descriptors with run functions');
    });

    await step('plan 4.3: tests/run-tests.mjs keeps every baseline call site and context literal, aliases the uncached runner, instantiates the memo after the registration helper, appends the exact S07 block after the C11a check and registers the complete cases after S09', async () => {
      const src = readText(path.join(context.skillRoot, 'tests', 'run-tests.mjs'));
      if (src === null) { check(false, 'tests/run-tests.mjs is readable'); return; }
      const importLine = /^import \{([^}]*)\} from '\.\/rc1-cases\.mjs';$/m.exec(src);
      const importNames = importLine ? importLine[1].split(',').map((s) => s.trim()).filter(Boolean).sort() : null;
      check(eq(importNames, ['registerRc1Cases', 'runComponentAssertions as runComponentAssertionsUncached', 'selectSuiteCases']), 'the rc1-cases import keeps selectSuiteCases, aliases runComponentAssertions as runComponentAssertionsUncached and adds registerRc1Cases', importNames);
      check(/import \{ createComponentMemo \} from '\.\/helpers\/rc1-integration\.mjs';/.test(src), 'createComponentMemo is imported from ./helpers/rc1-integration.mjs');
      const memoBlock = ['const { runComponentAssertions, getComponent } = createComponentMemo({', '  run: runComponentAssertionsUncached,', '  fs,', '  tmpRoot: TMP,', '  baseContext: {', "    repository: path.resolve(SKILL, '..'),", '    skillRoot: SKILL,', '    env: { ...ENV },', '  },', '});'].join('\n');
      const at = src.indexOf(memoBlock); const testDef = src.indexOf('const test = (id, name, fn) =>'); const r01 = src.indexOf("test('R01'");
      check(at > testDef && testDef > 0 && at < r01 && src.indexOf(memoBlock, at + 1) < 0, 'the exact memo instantiation appears once, after the test-registration helper and before the baseline cases', { testDef, at, r01 });
      for (const [c, d] of [['C1', 'c1'], ['C2', 'c2'], ['C3', 'c3'], ['C4', 'c4'], ['C5', 'c5'], ['C6', 'c6'], ['C7', 'c7'], ['C8', 'c8'], ['C9', 'c9'], ['C10', 'c10'], ['C11a', 'c11a']]) {
        check((src.match(new RegExp(`runComponentAssertions\\('${c}'`, 'g')) || []).length === 1, `${c}: exactly one runComponentAssertions('${c}', ...) call site`);
        check(src.includes(`{ repository: path.resolve(SKILL, '..'), skillRoot: SKILL, tmp: path.join(TMP, '${d}'), env: { ...ENV } }`), `${c}: the baseline context literal is byte-identical`);
      }
      const s07 = src.slice(src.indexOf("test('S07'"), src.indexOf("test('S08'"));
      const block = ["  const c11bcontext = { repository: path.resolve(SKILL, '..'), skillRoot: SKILL, tmp: path.join(TMP, 'c11b'), env: { ...ENV } };", '  fs.mkdirSync(c11bcontext.tmp);', "  const rep11b = await runComponentAssertions('C11b', c11bcontext);",
        "  check(rep11b.ok === true, 'C11b component assertions pass', {", '    errors: rep11b.errors,', "    failed: rep11b.results.filter((r) => r.status !== 'PASS')", '      .map((r) => ({ id: r.id, failures: r.failures.slice(0, 5) })),', '  });'].join('\n');
      const c11a = s07.indexOf("runComponentAssertions('C11a'"); const b = s07.indexOf(block);
      const s07tail = s07.slice(b + block.length).trim();
      check(c11a > 0 && b > c11a && s07.indexOf(block, b + 1) < 0 && s07tail === '});', 'S07 holds the exact C11b block after its C11a check and before its callback closes', { c11a, b, tail: s07tail.slice(0, 40) });
      const regLine = 'registerRc1Cases(test, { getComponent });';
      const s09 = src.indexOf("test('S09'"); const runner = src.search(/^\/\/ =+ runner =+$/m); const reg = src.indexOf(regLine);
      check(s09 > 0 && reg > s09 && runner > reg && src.indexOf(regLine, reg + 1) < 0 && src.slice(src.indexOf('\n});\n', s09) + 5, runner).trim() === regLine, 'the registration line appears once, after the S09 case and immediately before the runner section', { s09, reg, runner });
      check(src.includes('process.stdout.write(`\\n${JSON.stringify({ env, summary, resultsFile })}\\n`);'), 'the final runner envelope is still { env, summary, resultsFile } after a blank line');
      check(/outcome/.test(src.slice(runner)) && src.includes('RC1_COMPOSITION: invalid case outcome'), 'the runner consumes a returned outcome and reports an invalid one as "RC1_COMPOSITION: invalid case outcome <id>"');
    });
    flushProcessCount(context, 'RC1/C11b/composition', mark);
  });
}

// ================================================ RC1/C11b/strict-gate ====
// Plan 4.4, 5.8 and 6.3: the strict gate against the final 100-case inventory. validateSuiteEvidence and injected accept-rc1.main dependencies only; no nested suite is launched. C11a keeps its complete gate matrix;
// this group adds the final-inventory acceptances and rejections, the explicit 60-baseline transcript that must still end in "missing-record R41", the R91 skip rule and the focused R86, R91 and R100 runs.
const R13D_REASON = 'cannot create file symlink (Windows without Developer Mode)';
const GATE_ENV = Object.freeze({ platform: 'win32', release: 'fixture', node: 'fixture', git: 'fixture' });
const GATE_CODES = ['usage', 'suite-execution', 'suite-exit', 'malformed-record', 'summary-invalid', 'contradictory-record', 'duplicate-record', 'unexpected-record', 'missing-record', 'failed-record', 'forbidden-skip', 'invalid-skip', 'totals-mismatch', 'evidence-missing', 'evidence-mismatch', 'evidence-write'];
async function strictGate(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const acc = await importOrFail(failures, testsUrl(context, 'accept-rc1.mjs'), 'tests/accept-rc1.mjs');
    const rc = await importOrFail(failures, testsUrl(context, 'rc1-cases.mjs'), 'tests/rc1-cases.mjs');
    if (!acc || !rc) return;
    const table = parseCaseTable(CASE_TABLE_LINES);
    const RC1 = table.map((c) => c.id);
    const REQUIRED = [...BASELINE_IDS, ...RC1];
    const names = new Map(table.map((c) => [c.id, c.name]));
    const nameOf = (id) => names.get(id) || `case ${id}`;
    const RES = path.join(context.tmp, 'gate-fixture-c11b', 'results.json');
    const EVID = path.join(context.tmp, 'gate-evidence-c11b');
    const tally = (records) => ({ passed: records.filter((r) => r.kind === 'PASS').length, failed: records.filter((r) => r.kind === 'FAIL').length, skipped: records.filter((r) => r.kind === 'SKIP').length });
    const totalLine = (t) => `${t.passed} PASS / ${t.failed} FAIL / ${t.skipped} SKIP`;
    const model = (ids, over = {}) => ({ only: null, env: { ...GATE_ENV }, records: ids.map((id) => ({ kind: 'PASS', id, name: nameOf(id) })), status: 0, signal: null, error: null, timedOut: false, truncated: false, stderr: '', ...over });
    const render = (m) => {
      const L = m.records.map((r) => (r.raw !== undefined ? r.raw : r.kind === 'SKIP' ? `SKIP  ${r.id}  ${r.name}  (${r.reason})` : `${r.kind}  ${r.id}  ${r.name}`));
      const t = m.summary || tally(m.records);
      if (!m.noTotal) L.push(m.totalLine !== undefined ? m.totalLine : totalLine(t));
      L.push('');
      L.push(JSON.stringify({ env: m.env, summary: t, resultsFile: RES }));
      return L.join('\n') + '\n';
    };
    const reportOf = (m) => ({ text: JSON.stringify({ env: m.env, summary: m.reportSummary || tally(m.records), results: m.records.map((r) => ({ id: r.id, name: r.name, failures: r.kind === 'FAIL' ? ['failed'] : [], skipped: r.kind === 'SKIP' ? r.reason : null })) }, null, 2) });
    const inputOf = (m) => ({ only: m.only, status: m.status, signal: m.signal, error: m.error, timedOut: m.timedOut, truncated: m.truncated, stdout: render(m), stderr: m.stderr, report: m.report !== undefined ? m.report : reportOf(m) });
    const V = (m) => acc.validateSuiteEvidence(deepFreeze(inputOf(m)));
    const skipRec = (m, id, reason = R13D_REASON) => { const r = m.records.find((x) => x.id === id); r.kind = 'SKIP'; r.reason = reason; return m; };
    const exercised = new Set();
    const expectOk = (label, m, summary) => {
      const r = V(m);
      check(r && r.ok === true && eq(r.errors, []) && eq(r.summary, summary) && r.resultsFile === RES, `${label}: accepted with ${show(summary)}`, r);
    };
    const expectErr = (label, m, issue) => {
      const r = V(m);
      exercised.add(issue.code);
      check(r && r.ok === false && eq(r.errors, [issue]), `${label}: exactly ${show([issue])}`, r && { ok: r.ok, errors: r.errors });
    };

    await step('plan 3.3 and 6.3: the registry\'s required inventory is the 60 baseline IDs followed by the 40 complete cases of plan 4.2 (100 unique IDs)', async () => {
      check(eq([...rc.REQUIRED_CASE_IDS], REQUIRED) && REQUIRED.length === 100 && new Set(REQUIRED).size === 100, 'REQUIRED_CASE_IDS is exactly the 100 IDs, baseline first', rc.REQUIRED_CASE_IDS && rc.REQUIRED_CASE_IDS.length);
    });
    await step('plan 5.8: a complete Windows transcript with only the permitted R13d skip is accepted; a complete no-skip transcript is accepted; focused runs of each of the 100 IDs are accepted with 1/0/0', async () => {
      expectOk('100 PASS records', model(REQUIRED), { passed: 100, failed: 0, skipped: 0 });
      expectOk('99 PASS plus the Windows R13d skip', skipRec(model(REQUIRED), 'R13d'), { passed: 99, failed: 0, skipped: 1 });
      expectOk('no skip on a non-Windows platform', model(REQUIRED, { env: { ...GATE_ENV, platform: 'linux' } }), { passed: 100, failed: 0, skipped: 0 });
      for (const id of ['R86', 'R91', 'R100']) expectOk(`focused ${id}`, model([id], { only: id }), { passed: 1, failed: 0, skipped: 0 });
      for (const id of RC1) { const r = V(model([id], { only: id })); if (!(r && r.ok === true && eq(r.summary, { passed: 1, failed: 0, skipped: 0 }))) check(false, `focused ${id} is accepted with 1/0/0`, r); }
    });
    await step('plan 4.4 and 5.8: the explicit 60-baseline-record transcript with valid matching evidence is still rejected with missing-record R41 (the former missing-record condition is not weakened)', async () => {
      expectErr('60 baseline records only', model(BASELINE_IDS), { code: 'missing-record', id: 'R41' });
      const m = model(BASELINE_IDS);
      const r = V(m);
      check(r && r.ok === false && r.summary && eq(r.summary, { passed: 60, failed: 0, skipped: 0 }) && r.resultsFile === RES, 'its summary and results path are still the valid envelope values (the evidence itself is well formed)', r);
      const w = model(BASELINE_IDS); skipRec(w, 'R13d');
      expectErr('60 baseline records with the Windows R13d skip', w, { code: 'missing-record', id: 'R41' });
      expectErr('one complete case missing from an otherwise complete transcript', model(REQUIRED.filter((id) => id !== 'N8-doctor')), { code: 'missing-record', id: 'N8-doctor' });
      for (const id of RC1) expectErr(`${id} removed`, model(REQUIRED.filter((x) => x !== id)), { code: 'missing-record', id });
    });
    await step('plan 5.8: R91 as SKIP is rejected even when R13d also skips; only R13d may skip and only with the recorded reason on Windows', async () => {
      expectErr('R91 skipped together with R13d', skipRec(skipRec(model(REQUIRED), 'R13d'), 'R91'), { code: 'forbidden-skip', id: 'R91' });
      expectErr('R91 skipped alone', skipRec(model(REQUIRED), 'R91'), { code: 'forbidden-skip', id: 'R91' });
      expectErr('R91 skipped with the file-symlink reason', skipRec(model(REQUIRED), 'R91', R13D_REASON), { code: 'forbidden-skip', id: 'R91' });
      for (const id of RC1) expectErr(`${id} skipped`, skipRec(model(REQUIRED), id, 'host cannot run it'), { code: 'forbidden-skip', id });
      expectErr('a baseline case skipped', skipRec(model(REQUIRED), 'R22', 'x'), { code: 'forbidden-skip', id: 'R22' });
      expectErr('R13d skipped with another reason', skipRec(model(REQUIRED), 'R13d', 'cannot create symlink'), { code: 'invalid-skip', id: 'R13d' });
      expectErr('R13d skipped on linux', skipRec(model(REQUIRED, { env: { ...GATE_ENV, platform: 'linux' } }), 'R13d'), { code: 'invalid-skip', id: 'R13d' });
    });
    await step('plan 5.8: each of the sixteen verdict codes is produced for the final inventory with its exact issue (usage, suite-execution, suite-exit, malformed-record, summary-invalid, contradictory-record, duplicate-record, unexpected-record, missing-record, failed-record, forbidden-skip, invalid-skip, totals-mismatch, evidence-missing, evidence-mismatch and, through main, evidence-write)', async () => {
      expectErr('an unknown focused ID', model(['R41'], { only: 'R999' }), { code: 'usage' });
      expectErr('a baseline-style focused ID outside the inventory', model(['R41'], { only: 'r41' }), { code: 'usage' });
      expectErr('a timed-out suite', model(REQUIRED, { timedOut: true }), { code: 'suite-execution' });
      expectErr('a truncated capture', model(REQUIRED, { truncated: true }), { code: 'suite-execution' });
      expectErr('a spawn error', model(REQUIRED, { error: { code: 'ENOENT', message: 'x' } }), { code: 'suite-execution' });
      expectErr('a signal', model(REQUIRED, { signal: 'SIGKILL' }), { code: 'suite-execution' });
      expectErr('a nonzero exit', model(REQUIRED, { status: 1 }), { code: 'suite-exit' });
      expectErr('a record with single spaces', (() => { const m = model(REQUIRED); const r = m.records.find((x) => x.id === 'R41'); r.raw = `PASS R41 ${r.name}`; return m; })(), { code: 'malformed-record' });
      expectErr('no totals line', model(REQUIRED, { noTotal: true }), { code: 'summary-invalid' });
      expectErr('a contradictory R41', (() => { const m = model(REQUIRED); m.records.push({ kind: 'FAIL', id: 'R41', name: nameOf('R41') }); return m; })(), { code: 'contradictory-record', id: 'R41' });
      expectErr('a duplicated R41', (() => { const m = model(REQUIRED); m.records.push({ kind: 'PASS', id: 'R41', name: nameOf('R41') }); return m; })(), { code: 'duplicate-record', id: 'R41' });
      expectErr('an unexpected R87', (() => { const m = model(REQUIRED); m.records.push({ kind: 'PASS', id: 'R87', name: 'case R87' }); return m; })(), { code: 'unexpected-record', id: 'R87' });
      expectErr('a component sub-assertion ID printed as a record', (() => { const m = model(REQUIRED); m.records.push({ kind: 'PASS', id: 'R41/C4/cat', name: 'x' }); return m; })(), { code: 'unexpected-record', id: 'R41/C4/cat' });
      expectErr('a failed R41', (() => { const m = model(REQUIRED); m.records.find((x) => x.id === 'R41').kind = 'FAIL'; return m; })(), { code: 'failed-record', id: 'R41' });
      expectErr('R41 removed', model(REQUIRED.filter((id) => id !== 'R41')), { code: 'missing-record', id: 'R41' });
      expectErr('R41 skipped', skipRec(model(REQUIRED), 'R41', 'x'), { code: 'forbidden-skip', id: 'R41' });
      expectErr('a skip with the wrong reason', skipRec(model(REQUIRED), 'R13d', 'nope'), { code: 'invalid-skip', id: 'R13d' });
      expectErr('totals that claim 99/0/1 for 100 PASS records', model(REQUIRED, { summary: { passed: 99, failed: 0, skipped: 1 } }), { code: 'totals-mismatch' });
      expectErr('a totals line that disagrees with the records', model(REQUIRED, { totalLine: totalLine({ passed: 99, failed: 0, skipped: 1 }) }), { code: 'totals-mismatch' });
      expectErr('no retained results file', model(REQUIRED, { report: null }), { code: 'evidence-missing' });
      expectErr('an unreadable results file', model(REQUIRED, { report: { error: { code: 'ENOENT', message: 'x' } } }), { code: 'evidence-missing' });
      expectErr('a results file whose summary disagrees', model(REQUIRED, { reportSummary: { passed: 99, failed: 0, skipped: 1 } }), { code: 'evidence-mismatch' });
      expectErr('a results file with a different record name', (() => { const m = model(REQUIRED); m.report = reportOf(m); const o = JSON.parse(m.report.text); o.results[41].name = 'a different name'; m.report = { text: JSON.stringify(o, null, 2) }; return m; })(), { code: 'evidence-mismatch' });
      expectErr('a results file that is not JSON', model(REQUIRED, { report: { text: 'not json' } }), { code: 'evidence-mismatch' });
      exercised.add('evidence-write');
      check(eq([...exercised].sort(), [...GATE_CODES].sort()), 'all sixteen verdict codes were exercised by this group', [...exercised].sort());
    });
    await step('plan 5.8: focused R86, R91 and R100 each require their own PASS and exactly one result', async () => {
      for (const id of ['R86', 'R91', 'R100']) {
        const other = id === 'R86' ? 'R91' : 'R86';
        expectErr(`focused ${id} with another case's record`, model([other], { only: id }), { code: 'unexpected-record', id: other });
        expectErr(`focused ${id} with a second record`, model([id, 'R41'], { only: id }), { code: 'unexpected-record', id: 'R41' });
        expectErr(`focused ${id} with no record`, model([], { only: id }), { code: 'missing-record', id });
        expectErr(`focused ${id} skipped`, skipRec(model([id], { only: id }), id, 'x'), { code: 'forbidden-skip', id });
        expectErr(`focused ${id} failed`, (() => { const m = model([id], { only: id }); m.records[0].kind = 'FAIL'; return m; })(), { code: 'failed-record', id });
        expectErr(`focused ${id} duplicated`, model([id, id], { only: id }), { code: 'duplicate-record', id });
        expectErr(`focused ${id} with totals 2/0/0`, model([id], { only: id, summary: { passed: 2, failed: 0, skipped: 0 }, totalLine: totalLine({ passed: 2, failed: 0, skipped: 0 }) }), { code: 'totals-mismatch' });
      }
    });
    await step('plan 6.3 and 6.4: through main with injected dependencies the suite runs once; the 60-baseline transcript ends in "ACCEPT-RC1  FAIL  missing-record  R41", a complete transcript in "ACCEPT-RC1  PASS  full", a focused one in "ACCEPT-RC1  PASS  <id>", a failed evidence write in "ACCEPT-RC1  FAIL  evidence-write" and a bad option in "ACCEPT-RC1  FAIL  usage"', async () => {
      const mainWith = async (argv, m, over = {}) => {
        const calls = []; const written = [];
        const deps = {
          execute: (exe, args, options) => { calls.push({ exe, args, options }); return { status: m.status, signal: m.signal, error: m.error, timedOut: m.timedOut, truncated: m.truncated, stdout: render(m), stderr: m.stderr }; },
          readReport: () => (m.report !== undefined ? m.report : reportOf(m)),
          writeEvidence: (e) => { written.push(e); return EVID; },
          ...over,
        };
        const rec = await withStreamGuard(() => acc.main(argv, deps));
        return { rec, calls, written, stdout: render(m) };
      };
      const tail = (code, id) => `ACCEPT-RC1  ${code}${id ? `  ${id}` : ''}`;
      let r = await mainWith([], model(BASELINE_IDS));
      check(r.rec.threw === null && r.rec.out.length === 0 && r.rec.err.length === 0 && r.rec.value.exitCode === 1 && r.rec.value.stdout === `${r.stdout}${tail('FAIL', 'missing-record  R41')}\nRESULTS  ${RES}\nEVIDENCE  ${EVID}\n`, 'the 60-baseline transcript: the suite output unchanged, then ACCEPT-RC1  FAIL  missing-record  R41, RESULTS and EVIDENCE; exit 1', r.rec.value && r.rec.value.stdout.split('\n').slice(-5));
      check(r.calls.length === 1 && r.calls[0].args.length === 2 && r.calls[0].args[1] === '--keep' && /run-tests\.mjs$/.test(r.calls[0].args[0]) && r.written.length === 1, 'exactly one suite child is launched, with --keep, and one evidence retention happens', r.calls.map((c) => c.args));
      r = await mainWith([], model(REQUIRED));
      check(r.rec.value.exitCode === 0 && r.rec.value.stderr === '' && r.rec.value.stdout === `${r.stdout}${tail('PASS', 'full')}\nRESULTS  ${RES}\nEVIDENCE  ${EVID}\n`, 'a complete 100-record transcript: ACCEPT-RC1  PASS  full, RESULTS, EVIDENCE; exit 0', r.rec.value && r.rec.value.stdout.split('\n').slice(-4));
      r = await mainWith([], skipRec(model(REQUIRED), 'R13d'));
      check(r.rec.value.exitCode === 0 && r.rec.value.stdout.includes(`SKIP  R13d  ${nameOf('R13d')}  (${R13D_REASON})\n`) && r.rec.value.stdout.includes('99 PASS / 0 FAIL / 1 SKIP\n') && r.rec.value.stdout.includes(`${tail('PASS', 'full')}\n`), 'the complete Windows transcript with only the R13d skip is accepted (99 PASS / 0 FAIL / 1 SKIP)');
      for (const id of ['R86', 'R91', 'R100']) {
        const m = model([id], { only: id });
        r = await mainWith(['--only', id], m);
        check(r.rec.value.exitCode === 0 && r.rec.value.stdout === `${r.stdout}${tail('PASS', id)}\nRESULTS  ${RES}\nEVIDENCE  ${EVID}\n` && r.stdout.includes(`PASS  ${id}  ${nameOf(id)}\n1 PASS / 0 FAIL / 0 SKIP\n`) && r.calls[0].args.slice(1).join(' ') === `--keep --only-id ${id}`, `focused ${id}: exactly its PASS record, 1 PASS / 0 FAIL / 0 SKIP, then ACCEPT-RC1  PASS  ${id}; the child receives --only-id ${id}`, r.rec.value && r.rec.value.stdout.split('\n').slice(-4));
      }
      r = await mainWith([], model(REQUIRED), { writeEvidence: () => { throw new Error('disk full'); } });
      check(r.rec.value.exitCode === 1 && r.rec.value.stdout.split('\n').includes('ACCEPT-RC1  FAIL  evidence-write') && !r.rec.value.stdout.includes('ACCEPT-RC1  PASS'), 'a failed evidence write is never an acceptance PASS', r.rec.value && r.rec.value.stdout.split('\n').slice(-3));
      for (const argv of [['--only', 'R999'], ['--only'], ['R86'], ['--only', 'R86', 'R91'], undefined, ['--bogus']]) {
        r = await mainWith(argv, model(REQUIRED));
        check(r.rec.value.exitCode === 1 && r.rec.value.stdout === 'ACCEPT-RC1  FAIL  usage\n' && r.calls.length === 0, `argv ${show(argv)}: exit 1 with exactly "ACCEPT-RC1  FAIL  usage" and no suite launched`, r.rec.value);
      }
      r = await mainWith([], model(REQUIRED, { timedOut: true }));
      check(r.rec.value.exitCode === 1 && r.rec.value.stdout.includes('ACCEPT-RC1  FAIL  suite-execution\n'), 'a timed-out suite is a failed gate, never permission to omit cases');
    });
  });
}

// ================================================ RC1/C11b/documentation ====
// Plan 2.1, 2.3, 3.6, 3.7 and 5.9: the candidate documentation, byte for byte where the plan gives bytes, by section and after whitespace normalization where it says so, and the files the plan says do not change.
// The pins are SHA-256 digests (CRLF normalized). installer, notes200, changelogSuffix and every readmeSections entry are the committed post-C10 bytes: a different digest means a change to what the plan says it must preserve.
// skillWithOldHeading and readmeTopRest cover the files C12 edits on purpose (C12-15) and are updated together with the exact CHANGELOG_ENTRY_LINES and RELEASE_NOTES_TEXT expectations (decision I11b-2).
const PINS = deepFreeze({
  installer: '9e22d4192aed1c504053e9c499bdaf98450a7bd0a80e44b0aeb4b11b19d5b947',
  notes200: '27711d116ec2ee4ba012b9cdaec198703e154055341cba793472d2ee79886eba',
  changelogSuffix: '390782771ef21740d67e8c3c53a8d90a3d2f113fc45d42dee460141ebb769aaf',
  skillWithOldHeading: '16a836b7a231cb3fec1670455650a43a278ba3540c579bbedb4630b9ffba0d4b',
  readmeTopRest: '8fadcdcd4c7c7dd256b710b023d4f5f4283fbf2db40fa1859d64a9b39df7ff62',
  readmeSections: {
    '## Claude raw-Git hook': 'f3a4c0b1f33d156cc08dbcbec50c84ed842ecaf9ed28c9de2ddfcd5b9e7ba5e1',
    '## Trusted-checkout reviews': 'a502dc650bd566d05485a1b0891de8aaeebe06072371701de3db020ae2859bd9',
    '## Review-lane launcher prerequisite': '36f2304fa94d385fc61b48481ceb8f98824f1487966c7e376116b19ce757618d',
    '## Test first (no installation, no real config touched)': '6e01671bcb5994f667808a67e0c481ea88e4289d31fe6df9301a16153929a636',
    '## Install (only when you decide to)': '48b9c39c5858d9609f2af1d15aec4214983e5386ad91f8cd2c16a5657bf59cdb',
  },
});
const LF = (s) => String(s).replace(/\r\n/g, '\n');
async function documentation(context) {
  return runAssertion(async ({ failures, check, step }) => {
    const text = (rel) => { const t = readText(skillPath(context, rel)); if (t === null) check(false, `${rel} is readable`); return t === null ? null : LF(t); };
    await step('plan 3.6 and C13-14: VERSION is exactly 3.0.0-rc.2 plus LF; the release builder and the candidate notes exist in the source tree beside the preserved rc.1 notes; the installer, the runtime catalog and the v2 notes are unchanged', async () => {
      const v = readBytes(skillPath(context, 'VERSION'));
      check(v !== null && v.toString('latin1') === `${CANDIDATE_VERSION}\n`, 'VERSION is exactly "3.0.0-rc.2\\n"', v && v.toString('latin1'));
      check(exists(skillPath(context, 'install/release.mjs')) && exists(skillPath(context, `RELEASE-NOTES-${CANDIDATE_VERSION}.md`)) && exists(skillPath(context, 'RELEASE-NOTES-3.0.0-rc.1.md')), 'install/release.mjs, RELEASE-NOTES-3.0.0-rc.2.md and the preserved RELEASE-NOTES-3.0.0-rc.1.md exist under project-setup/');
      const installer = text('install/install.mjs'); const old = text('RELEASE-NOTES-2.0.0.md');
      check(installer !== null && sha256(installer) === PINS.installer, 'install/install.mjs is unchanged (no second installer, no inclusion-rule change, no version.json)');
      check(old !== null && sha256(old) === PINS.notes200, 'RELEASE-NOTES-2.0.0.md is unchanged');
      const catalog = (() => { try { return JSON.parse(readText(skillPath(context, 'data/runtime-units.json'))); } catch { return null; } })();
      check(catalog && Array.isArray(catalog.units) && catalog.units.length === 7 && eq(catalog.units.map((u) => path.posix.basename(u.source)), ['security-policy.mjs', 'git-safe-core.mjs', 'guard-raw-git-core.mjs', 'review-diff.mjs', 'git-safe.mjs', 'guard-raw-git.mjs', 'hooks-selftest.mjs']), 'data/runtime-units.json keeps the seven C6 members in order');
      check(!exists(skillPath(context, 'version.json')) && !exists(skillPath(context, 'install/version.json')), 'no version.json stamp is added');
    });
    await step('plan 3.6: the candidate release notes are exactly the plan bytes (ASCII, no BOM, LF, final LF) and state the Q6 compatibility paragraphs and the pending host measurements', async () => {
      const raw = readBytes(skillPath(context, `RELEASE-NOTES-${CANDIDATE_VERSION}.md`));
      check(raw !== null && raw.toString('utf8') === RELEASE_NOTES_TEXT && Buffer.compare(raw, Buffer.from(RELEASE_NOTES_TEXT, 'utf8')) === 0, 'RELEASE-NOTES-3.0.0-rc.2.md equals the exact candidate text byte for byte', raw && raw.toString('utf8').slice(0, 120));
      check(raw !== null && !/[^\x00-\x7f]/.test(raw.toString('latin1')) && !raw.includes(0x0d) && raw[0] !== 0xef && raw[raw.length - 1] === 0x0a, 'the notes are ASCII, UTF-8 without BOM, LF only, with a final LF');
      check(!NOTES_HEX_RE.test(RELEASE_NOTES_TEXT), 'the notes carry no standalone 40- or 64-hex ID (no resolved identity or digest in tree)');
      const sec = sectionOf(RELEASE_NOTES_TEXT, 'Pending host measurements') || '';
      check(squash(sec).includes('TO VERIFY: R83; R44/R74 host enforcement; R51 Claude continuation and stderr handling; A3 trusted-checkout live review; A5 host negative capability.'), 'the pending host measurements are listed exactly');
      check(squash(sectionOf(RELEASE_NOTES_TEXT, 'Verification') || '').includes('99 PASS / 0 FAIL / 1 SKIP when R13d cannot create a Windows file symlink, or 100 PASS / 0 FAIL / 0 SKIP when it can. No rc.1 case may skip. R91 requires real junction coverage on Windows.'), 'the verification totals and the no-skip rule are exact');
    });
    await step('plan 3.6 and C13-14: CHANGELOG.md is "# Changelog", the exact rc.2 entry, the exact preserved rc.1 entry, then the unchanged historical suffix beginning "## 2.0.0"', async () => {
      const cl = text('CHANGELOG.md');
      if (cl === null) return;
      const head = `# Changelog\n\n${lines(CHANGELOG_ENTRY_LINES)}${lines(RC1_CHANGELOG_ENTRY_LINES)}`;
      check(cl.startsWith(`# Changelog\n\n${lines(CHANGELOG_ENTRY_LINES)}`), 'the file starts with "# Changelog", a blank line and the exact rc.2 entry (ending in one blank line)', cl.slice(0, 200));
      check(cl.startsWith(head), 'the exact rc.2 entry is followed by the exact preserved rc.1 entry (the last line of each is the blank separator)', cl.slice(0, 200));
      const suffix = cl.startsWith(head) ? cl.slice(head.length) : '';
      check(suffix.startsWith('## 2.0.0\n') && sha256(suffix) === PINS.changelogSuffix, 'the historical entries from "## 2.0.0" onward are byte-identical to the post-C10 file', { starts: suffix.slice(0, 20), bytes: suffix.length });
      check(cl.split('\n## 3.0.0-rc.2\n').length === 2, 'the candidate entry appears once');
      check(cl.split('\n## 3.0.0-rc.1\n').length === 2, 'exactly one historical rc.1 entry remains');
    });
    await step('plan 3.6, C12-15 and C13-14: SKILL.md carries the top-level release heading "# project-setup 3.0.0-rc.2" and every other byte is the pinned text', async () => {
      const skill = text('SKILL.md');
      if (skill === null) return;
      const ls = skill.split('\n');
      check(ls[5] === SKILL_HEADING_LINES[0], 'line 6 is exactly "# project-setup 3.0.0-rc.2"', ls[5]);
      const restored = [...ls]; restored[5] = '# project-setup v2';
      check(sha256(restored.join('\n')) === PINS.skillWithOldHeading, 'every other byte of SKILL.md is the pinned text (the C8, C9 and C10 text plus the deliberate C12 policy-workflow edits and C14 project-rule insertion)', sha256(restored.join('\n')));
      check(ls.filter((l) => l === SKILL_HEADING_LINES[0]).length === 1 && !ls.includes('# project-setup v2'), 'the new heading appears once and the old heading is gone');
    });
    await step('plan 3.6 and 5.9: README.md has the exact seven-line opening with a separate security paragraph, the overview after it, the release-builder inventory row after the installer row, the exact Test first paragraph and fence, the retained sections unchanged and the exact "Local candidate release" section last', async () => {
      const readme = text('README.md');
      if (readme === null) return;
      const ls = readme.split('\n');
      check(eq(ls.slice(0, 7), README_OPENING_LINES), 'the complete resulting opening seven lines are exact', ls.slice(0, 8));
      check(ls[7] === '' && ls[8] === 'Single source for the shared Claude Code + Codex `project-setup` skill. Edit here, never in installed copies.', 'a blank line then the post-C8 overview follow the opening', ls.slice(7, 9));
      check(ls[5].startsWith('Secret-path controls are tool-level') && ls[4] === '' && !ls[2].includes('Secret-path'), 'the security paragraph is separate from the release paragraph and keeps its wording');
      const top = readme.slice(0, readme.indexOf('## Claude raw-Git hook'));
      const topLines = top.split('\n');
      const rowAt = topLines.findIndex((l) => l.startsWith('install/release.mjs'));
      check(rowAt > 0 && topLines[rowAt - 1].startsWith('install/install.mjs ') && squash(topLines[rowAt]) === squash(README_INVENTORY_ROW_LINES[0]), 'the release-builder row follows the installer row immediately', { rowAt, prev: rowAt > 0 ? topLines[rowAt - 1] : null, row: topLines[rowAt] });
      const rest = topLines.slice(7).filter((l, i) => !(i + 7 === rowAt));
      check(sha256(squash(rest.join('\n'))) === PINS.readmeTopRest, 'everything else in the overview and inventory is the pinned text (the C8 rows plus the deliberate C12 data/ line correction)', sha256(squash(rest.join('\n'))));
      const secs = readme.split(/^(?=## )/m).filter((s) => s.startsWith('## '));
      const heads = secs.map((s) => s.split('\n')[0]);
      check(eq(heads, [...Object.keys(PINS.readmeSections), '## Local candidate release']), 'the section list is the retained sections in order followed by "## Local candidate release"', heads);
      for (const s of secs) {
        const h = s.split('\n')[0];
        if (h === '## Test first (no installation, no real config touched)') {
          const inserted = squash(lines(README_TEST_FIRST_LINES));
          check(squash(s).includes(inserted), 'Test first holds the exact candidate-acceptance paragraph and command fence (whitespace normalized)');
          check(s.includes('```text\nnode tests/accept-rc1.mjs\n```'), 'the Test first command fence is exactly "node tests/accept-rc1.mjs" in a text fence');
          check(sha256(squash(squash(s).replace(inserted, ' '))) === PINS.readmeSections[h], 'removing the inserted text leaves the original Test first section unchanged');
        } else if (PINS.readmeSections[h] !== undefined) check(sha256(squash(s)) === PINS.readmeSections[h], `${h}: the retained section is unchanged (C8 trusted-checkout, launcher, hook text and C10 doctor paragraph stay)`);
      }
      const last = secs[secs.length - 1];
      check(last.startsWith('## Local candidate release') && squash(last) === squash(lines(README_RELEASE_SECTION_LINES)), 'the appended "Local candidate release" section is exact (whitespace normalized) and last', last && squash(last).slice(0, 160));
      check(last && last.includes('```text\nnode install/release.mjs --tag project-setup-v3.0.0-rc.2 --out <unused-directory>\n```') && readme.endsWith('\n') && !readme.endsWith('\n\n'), 'the section ends with the exact later-build command fence and the file ends with one LF');
    });
    await step('plan 5.9: tests/live/LIVE-ACCEPTANCE.md ends with "## Candidate 3.0.0-rc.1 evidence" carrying the exact status text, after the earlier procedures and without marking any pending host measurement as passed', async () => {
      const live = text('tests/live/LIVE-ACCEPTANCE.md');
      if (live === null) return;
      const ls = live.split('\n');
      const headings = ls.filter((l) => /^## /.test(l));
      check(headings[headings.length - 1] === '## Candidate 3.0.0-rc.1 evidence' && ls.includes('## 3. Results template') && ls.indexOf('## 3. Results template') < ls.indexOf('## Candidate 3.0.0-rc.1 evidence'), 'the candidate section is the last level-2 section, after "## 3. Results template"', headings);
      const sec = sectionOf(live, 'Candidate 3.0.0-rc.1 evidence');
      check(sec !== null && squash(sec) === squash(lines(LIVE_SECTION_LINES)), 'its text is exactly the plan paragraphs after whitespace normalization', sec && squash(sec).slice(0, 200));
      check(live.includes('### C5 review-diff procedure (host evidence pending)') && ls.includes('## 2. Stop conditions'), 'the C5 and C8 procedures and the stop conditions are retained (their own checks keep their text)');
    });
    await step('plan 5.9, C12-13, C13-15 and C14-19: evals/evals.json holds evaluations 1 to 31 without duplicates and evaluation 20 is exactly the plan object', async () => {
      let file = null;
      try { file = JSON.parse(readText(skillPath(context, 'evals/evals.json'))); } catch { file = null; }
      if (!file) { check(false, 'evals/evals.json is readable JSON'); return; }
      check(file.skill_name === 'project-setup' && Array.isArray(file.evals), 'skill_name stays project-setup with an evals array');
      if (!Array.isArray(file.evals)) return;
      check(file.evals.length === 31 && eq(file.evals.map((e) => e && e.id), Array.from({ length: 31 }, (_, i) => i + 1)) && new Set(file.evals.map((e) => e && e.id)).size === 31, 'IDs 1 through 31 in order without duplicates (C12 appends 21, C13 appends 22-26, C14 appends 27-31)', file.evals.map((e) => e && e.id));
      check(eq(file.evals[19], EVAL_20), 'evaluation 20 equals the plan object exactly (an expectation, not proof that an agent followed it)', file.evals[19]);
    });
    await step('plan 3.6 and 3.7: the working-tree release builder exists with the pinned public surface; nothing in the documentation claims publication or a real tag', async () => {
      const rel = await importRelease(failures, context);
      if (rel) check(eq(Object.keys(rel).sort(), ['main', 'parseReleaseArgs']) && !('default' in rel), 'install/release.mjs exports exactly main and parseReleaseArgs', Object.keys(rel));
      check(!/\b(published|released to|uploaded)\b/i.test(RELEASE_NOTES_TEXT), 'the candidate notes make no publication claim');
    });
  });
}

// ===================================================== registration ====
// The component entry (plan 5): the frozen implementation list in the registry's order. rc1-cases.mjs registers the matching literal descriptors independently.
const RUNNERS = {
  'S07/C11b/release-cli': releaseCli,
  'S07/C11b/identity': identity,
  'S07/C11b/archive': archiveGroup,
  'S07/C11b/notes': notesGroup,
  'S07/C11b/immutability': immutabilityGroup,
  'S07/C11b/installed-payload': installedPayload,
  'S07/C11b/v2-compatibility': v2Compatibility,
  'RC1/C11b/composition': composition,
  'RC1/C11b/strict-gate': strictGate,
  'RC1/C11b/documentation': documentation,
};
export const C11B_IMPLEMENTATIONS = Object.freeze(Object.keys(RUNNERS).map((id) => Object.freeze({ id, run: (context) => RUNNERS[id](context) })));
