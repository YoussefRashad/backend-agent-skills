// C16 tests lane: the eight component assertions of "C16. Root-start requirements and reliable review-helper use" (project-setup 3.0.0-rc.3, the only rc.3 component).
//
// Written from the frozen plan only, before any implementation exists:
//   docs/plans/2026-10-25-project-setup-v3-rc3-c16.md            (sections C16-1 to C16-22 and the freeze addendum C16-F1 to C16-F5)
//   docs/plans/2026-10-25-project-setup-v3-rc3-c16-decisions.md  (Q1-Q8, the probes P1-P4 and their exact measurement limits)
// On the landed contracts: C4 (git-safe), C5 (review-diff), C6 (the hook paragraphs), C8 (the stop-rule bullet), C12 to C15 and the apply, validate and baseline scripts, which C16 does not change. The exact amendment text (L16, D16, G16a-G16e,
// HS, W16r, W16d, RS, RC, RH, RR, DS_*, S1-S3, SH, DG1, DG2, SE, CL1-CL6, CX, RM1-RM4b, LC, V and the TODO and H8D85 chains) lives in tests/helpers/c16-amendments.mjs, copied from the plan by a generator script before any implementation existed and never
// read back from the files under test; a reversal removes exactly one verified amendment at its stated anchor and the result is compared with the pinned pre-C16 bytes (tests/fixtures/c16-prechange.json, 20 entries, plan C16-14).
//
// Importing this module runs nothing. Every production module and the registry module (rc1-cases.mjs imports this file, so a static import back would be circular) is imported lazily inside run(context). A missing file, module or export fails one
// assertion with a diagnostic; it never breaks the import.
//
// Every run(context) returns { failures, skipped: null }; there is no skip path. Scratch data lives under context.tmp only. Every project is a synthetic ASCII fixture; no user configuration, scanner, release build, package installation,
// backend-standards scaffold or external reviewer is touched. The child processes are git (spawnSync, shell-free, through the real git-safe executor seam or directly), the apply and lock scripts and one import probe; their count is retained in
// <context.tmp>/c16-diagnostics.log next to the elapsed time (target: at most 116 launches and 60 s, plan Q8, recorded, never an assertion). validate.mjs runs in process through its own main().
//
// How the instruction checks work. Instruction text cannot be executed, so each group states what the installed text MUST say and proves its own checks can fail: every frozen paragraph is a rule, every sentence of every paragraph is removed or
// weakened in memory and the rule must then fail, and named opposite guards are substituted. The same battery runs twice: on an independent model (the pinned pre-C16 bytes with the frozen amendments applied by the helper, so the checks stay meaningful
// before any implementation exists) and on the real installed text. Nothing here proves that an agent follows the instructions: that stays agent behavior (the evaluations) and host evidence. Helper behavior (git-safe) is tested against real Git.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { newProseIssues, proseLineIssues, proveFenceRules } from './helpers/prose-check.mjs';
import {
  AM16, C16_BLOCKS, FORWARD_ORDER16, REVERSAL_ORDER16, AMENDED_FILES16, UNAMENDED_PRECHANGE_FILES, H8D85, TODO_HASHES, TODO_RAW,
  amendmentOnce, applyForFile, applyOne, applySteps, applyTodoC16Pre, classifyHeadroomEntry, postHeadroomEntry, reverseForFile, reverseOne, reverseSteps, reverseTodoC16,
} from './helpers/c16-amendments.mjs';
import { C17_BLOCKS, REVERSAL_ORDER17, TODO_PRE_C17_HASH, applyForFile as applyC17File, reverseEvalsC17, reverseForFile as reverseC17File, reverseTodoC17 } from './helpers/c17-amendments.mjs';

// ===================================================== generic utilities ====
const eq = (a, b) => isDeepStrictEqual(a, b);
const errMsg = (e) => String((e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) || e).slice(0, 500);
// Diagnostics are ASCII-only whatever the data holds.
function show(v, cap = 700) {
  let s;
  try { s = typeof v === 'string' ? JSON.stringify(v) : (JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? String(x) : x)) ?? String(v)); } catch { s = String(v); }
  return s.replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).slice(0, cap);
}
function mkCheck(failures) { return (cond, msg, detail) => { if (!cond) failures.push(detail === undefined ? msg : `${msg} :: ${show(detail)}`); }; }
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const jsonText = (v) => JSON.stringify(v, null, 2) + '\n';
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
const clip = (s) => show(String(s).length > 90 ? `${String(s).slice(0, 90)}... (${String(s).length} chars)` : s);
const LF = (s) => String(s).replace(/\r\n/g, '\n');
const normText = (s) => { let t = Buffer.isBuffer(s) ? s.toString('utf8') : String(s); if (t.charCodeAt(0) === 0xfeff) t = t.slice(1); t = t.replace(/\r\n?/g, '\n'); if (!t.endsWith('\n')) t += '\n'; return t; };
// The normalized hash used by the apply manifest and by the pins: text without BOM, LF line ends, one final LF, SHA-256. Computed here, never taken from a production function.
const NH = (s) => sha(Buffer.from(normText(s), 'utf8'));
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const COUNT = (text, part) => (part === '' ? 0 : String(text).split(part).length - 1);
const BSL = String.fromCharCode(92); // one backslash, spelled without an escape so a literal pattern such as transfer<BSL>( is unambiguous in this file
const T = (lines) => `${lines.join('\n')}\n`;

const FAILURE_CAP = 60;
async function runAssertion(body) {
  const failures = [];
  const check = mkCheck(failures);
  const step = async (name, fn) => { try { await fn(); } catch (e) { failures.push(`${name}: threw: ${errMsg(e)}`); } };
  try { await body({ failures, check, step }); } catch (e) { failures.push(`threw: ${errMsg(e)}`); }
  if (failures.length > FAILURE_CAP) { const more = failures.length - FAILURE_CAP; failures.length = FAILURE_CAP; failures.push(`(${more} more failures not shown)`); }
  return { failures, skipped: null };
}
async function importOrFail(failures, url, label) {
  try { return await import(url); } catch (e) { failures.push(`cannot import ${label}: ${errMsg(e)}`); return null; }
}
const skillPath = (context, rel) => path.join(context.skillRoot, ...rel.split('/'));
const rootPath = (context, rel) => path.join(context.repository, ...rel.split('/'));
const readBytes = (p) => { try { return fs.readFileSync(p); } catch { return null; } };
const readText = (p) => { const b = readBytes(p); return b === null ? null : b.toString('utf8'); };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const exists = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };
// C17 (plan C17-12, C17-13 and F1): C16's historical checks read the PRE-C17 view of every file C17 changes. A file with exact C17 amendments is reversed through them (each verified once at its anchor; null when one does not verify, which C17's own
// preservation component reports by name); the root TODO.md is reversed through the exact blocker replacement and must then be the pre-C17 TODO (hash ebf6df3a...); git-safe-core.mjs has no exact amendment (PLAN-GAP: the plan freezes its behavior,
// not its hunks), so its pre-C17 view is the committed fixture entry whose raw SHA-256 is the plan's ad1c51db.... Every other file is its own pre-C17 view.
const C17_CORE_REL = 'assets/tools/git-safe-core.mjs';
function c17FixtureBytes(context, repoPath) {
  const doc = readJson(skillPath(context, 'tests/fixtures/c17-prechange.json'));
  const e = doc && Array.isArray(doc.entries) ? doc.entries.find((x) => x && x.path === repoPath) : undefined;
  return e && typeof e.base64 === 'string' ? Buffer.from(e.base64, 'base64') : null;
}
function pre17Bytes(context, rel) {
  if (rel === C17_CORE_REL) { const b = c17FixtureBytes(context, 'project-setup/' + rel); return b !== null && sha(b) === 'ad1c51db23444c022dcb4eca06d0b3fd52984cb1bf3230596a840f34203b5f85' ? b : null; }
  const b = readBytes(rel.startsWith('@root/') ? rootPath(context, rel.slice(6)) : skillPath(context, rel));
  if (b === null) return null;
  if (rel === '@root/TODO.md') { const r = reverseTodoC17(b.toString('utf8')); return r !== null && sha(Buffer.from(r, 'utf8')) === TODO_PRE_C17_HASH ? Buffer.from(r, 'utf8') : null; }
  if (!Object.prototype.hasOwnProperty.call(REVERSAL_ORDER17, rel)) return b;
  const r = reverseC17File(b.toString('utf8'), rel);
  return r.text === null ? null : Buffer.from(r.text, 'utf8');
}
const pre17Text = (context, rel) => { const b = pre17Bytes(context, rel); return b === null ? null : b.toString('utf8'); };
const sourceText = (context, rel) => { const t = pre17Text(context, rel); return t === null ? null : LF(t); };
function putFile(p, data) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); }
const rmrf = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* best effort */ } };
function scratchDir(context, label) {
  fs.mkdirSync(context.tmp, { recursive: true });
  return fs.realpathSync.native(fs.mkdtempSync(path.join(context.tmp, `c16-${label}-`)));
}
async function withScratch(context, label, fn) {
  const dir = scratchDir(context, label);
  try { return await fn(dir); } finally { rmrf(dir); }
}
function copyTree(src, dst) { fs.cpSync(src, dst, { recursive: true }); return dst; }

// ------------------------------------------------- diagnostics and process counting ----
function diag(context, line) { try { fs.mkdirSync(context.tmp, { recursive: true }); fs.appendFileSync(path.join(context.tmp, 'c16-diagnostics.log'), `${line}\n`); } catch { /* best effort */ } }
const PROCESS_COUNTS = new Map();
const STARTED = new Map();
function countProcess(context, n = 1) { PROCESS_COUNTS.set(context.tmp, (PROCESS_COUNTS.get(context.tmp) || 0) + n); }
const processMark = (context) => PROCESS_COUNTS.get(context.tmp) || 0;
function startClock(context) { try { fs.mkdirSync(context.tmp, { recursive: true }); } catch { /* reported by the first launch */ } if (!STARTED.has(context.tmp)) STARTED.set(context.tmp, Date.now()); }
function flushProcessCount(context, label, mark) {
  const elapsed = Math.round((Date.now() - (STARTED.get(context.tmp) || Date.now())) / 1000);
  diag(context, `processes in ${label}: ${processMark(context) - mark} (cumulative ${processMark(context)}, target 116 and 60 s per plan Q8; counting method: every launch of this file, including each Git child of the executor seam; elapsed ${elapsed} s since the first group)`);
}
// A shell-free Node launch: absolute node, absolute script, 60 s timeout. A spawn failure, signal or timeout is "dead" and fails the calling assertion.
function execNode(context, { cwd, script, args = [], env = null }) {
  countProcess(context);
  const r = spawnSync(process.execPath, [script, ...args], { cwd: cwd || context.tmp, env: env || context.env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 60000, maxBuffer: 16777216 });
  let dead = null;
  if (r.error) dead = `${r.error.code || 'error'}: ${String(r.error.message).slice(0, 120)}`;
  else if (r.signal) dead = `signal ${r.signal}`;
  const stdout = r.stdout || '';
  let json = null;
  try { json = JSON.parse(stdout); } catch { /* not JSON */ }
  return { code: r.status, stdout, stderr: r.stderr || '', json, dead };
}
function gitIn(context, cwd, args, { input, env } = {}) {
  countProcess(context);
  const r = spawnSync('git', args, { cwd, env: env || context.env, input, encoding: 'buffer', shell: false, windowsHide: true, timeout: 120000, maxBuffer: 1 << 28 });
  const out = r.stdout || Buffer.alloc(0);
  return { code: r.status, out, err: r.stderr || Buffer.alloc(0), stdout: out.toString('utf8').trim(), stderr: String(r.stderr || '').trim(), error: r.error || null };
}
function gitOk(context, cwd, args, o) { const r = gitIn(context, cwd, args, o); if (r.code !== 0) throw new Error(`git ${args.slice(0, 3).join(' ')} failed (${r.code}): ${r.stderr.slice(0, 200)}`); return r; }
function makeRepo(context, dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  const a = gitIn(context, dir, ['init', '-q']);
  for (const [rel, data] of Object.entries(files)) putFile(path.join(dir, ...rel.split('/')), data);
  gitIn(context, dir, ['add', '-A']);
  const c = gitIn(context, dir, ['commit', '-qm', 'init']);
  if (a.code !== 0 || c.code !== 0) throw new Error(`cannot create the fixture repository: ${a.stderr} ${c.stderr}`);
  for (const [rel, data] of Object.entries(files)) putFile(path.join(dir, ...rel.split('/')), data);
  return dir;
}

// ============================================================ frozen literals ====
// Copied verbatim from the frozen plan (C16-6 to C16-18, C16-F1 to C16-F5) by the generator script; the pins are the plan's own digests. Nothing below is ever read back from the files under test. Where this file adds a pin the plan does not give
// (marked PLAN-GAP), the value was computed from the inspected pre-change commit (a290389) or from the frozen amendments applied to it, and guards a file or object the plan says C16 leaves alone or the amended bytes it describes.
const FIXTURE_REL = 'tests/fixtures/c16-prechange.json';
const FIXTURE_SOURCE_COMMIT = 'a290389441ee4f6db751a749dff19dac5caca6ae';
const FIXTURE_RAW_SHA = '7853616ebbf2483e098bfaba530f962bce42401740cca603f94a153346a3cbdf';
const FIXTURE_FILE_BYTES = 299643;
// Plan C16-14: the 20 pre-C16 raw SHA-256 values in the plan's order. Skill files are relative to project-setup/; the three root files are marked.
const PRE_C16 = [
  ['assets/tools/git-safe-core.mjs', '49596e4814ef48880a6e08ea2741f667a29c2aa1a12ed098a9cb4b65dc9b3548'],
  ['assets/agents/reviewer.md', '4c6eb90964c0106b4a1daa518524096eca4b6a428feab1dcb1cab8d3b981d5be'],
  ['assets/agents/docs-sync.md', 'ee5e402b523b29e1c57896a0c9200f50725b268edd3f68fbfde98e022f23f5bd'],
  ['assets/templates/CLAUDE.md', 'cca922bb9a1baf2e78168c0efcdaca77341fd7d6d0a922ac6a0a8863ae78bcf9'],
  ['assets/templates/nested-CLAUDE.md', '336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49'],
  ['SKILL.md', '87997f43a3aca5474ce6b2e8f38bfb0084f2ff83c7bde840e15c95ce050bd250'],
  ['README.md', 'aeec055c944669eb72fb6e78b117178b5cd97f5e930234c8ad6df44968e36e21'],
  ['references/claude.md', '41c954c4b6b5dd0302581e98505c419c48c8e7c22dfe0377fd0bd54e6134cab0'],
  ['references/codex.md', '595a1b568df03d3ee7485b23d097d6950f97ebc6a57f5462f8224ecc5f58b170'],
  ['references/security.md', 'e996435abc079ca75a3b1e453ab1f79ead8ef40acf70ec435b356b3d9a043423'],
  ['references/docs-generation.md', '67ba729b2e9497290d01c940d490ad0e86803791f983f246ee0b47355f783308'],
  ['CHANGELOG.md', '3cc6747c2c702f3e6514dfc0a90245eac2fa62442809515ad14cbe0d0a0a4829'],
  ['RELEASE-NOTES-3.0.0-rc.2.md', '4cbf9b9c2573f149e20234985ac7c1867fd256b56e551af8b970ea81d6b89cb4'],
  ['@root/README.md', '769fae5edbdc03b0168f3e3b94f3f6ff602b4b7ebc459eb9e50a09c15e903413'],
  ['@root/.ai/context/project-tree.md', '93c6cd88d6be45e6ec8fef2048aa64ed03c8f31d1f3b92a1fac2da986edf391a'],
  ['@root/TODO.md', '28b4fd4f69618b4ca235f1ebdbaec69b12f308090afb4bccabb69b4d998d79ea'],
  ['assets/tools/hooks-selftest.mjs', '8aae599d95c8cab62ffb3da29354d3a00e3cf8d6c9cea1f7e144709a72dec802'],
  ['VERSION', 'da65b61809819f3046ce593b9883e3bf2144ff2ab7a031932f3f3e6c70b03944'],
  ['assets/wrappers/codex-reviewer.toml', '135028b89b86ed0f3dcfe46c07119012b8f3ff2b6903fb51a591b833792ea13b'],
  ['assets/wrappers/codex-docs_sync.toml', '7a1d6e004a0f5af60ecf77b7ff22141f08e59379b84ce31e9ced32c7dc87be93'],
];
const PRE_PIN = Object.fromEntries(PRE_C16);
const fixturePathOf = (rel) => (rel.startsWith('@root/') ? rel.slice(6) : `project-setup/${rel}`);
// Plan C16-6, C16-8, C16-9 and C16-14: the independently computed identities of the amended bytes.
const L16_IDENTITY = { lines: 24, bytes: 2067, maxWidth: 95, sha: '280402adbf3cf1efb2dd925a527ce5d02d3b1143e68dffd075331f15dadc5d8c' };
const ROOT_TEMPLATE_IDENTITY = { bytes: 2790, sha: '5bb1d5ed697e921dcc839d031e082f884ca9a97a1eafd8d4a003d2ddb1cbaa47' };
const ROUND2_ROOT_TEMPLATE_SHA = '5afb6de71efa3af41f1a672951ee5f88e50883960df2f6da1b275a36ec375471';
const CORE_IDENTITY = { bytes: 31839, sha: 'ad1c51db23444c022dcb4eca06d0b3fd52984cb1bf3230596a840f34203b5f85' };
const HOOKS_SELFTEST_NEW_SHA = '175fa8611582fe0c8eafd8032c5dbb3c6e981e8cf9f710653c87529b58f6ba66';
const CODEX_WRAPPER_NEW = { 'assets/wrappers/codex-reviewer.toml': 'fe21c05b09bcba96b631bb08e22e6be807cdc8e0c75a740acff1b70c683c695c', 'assets/wrappers/codex-docs_sync.toml': '1e6eef9ae6d75c0fef3c79b9879a0d69c4ad88d774889b81d09558cd61af6287' };
const EVAL_RAW_1_35_SHA = '8059a41c48a4ff78819ca5926ec81bba23f0c4fef29d0c710d77765f8c59ceab'; // raw LF bytes of original lines 1-35, including the LF after line 35 (plan C16-14)
const EVAL_PREFIX_33_SHA = 'ef2f32bda081d9597a6cfdd463b76a9c85f128974ab3d583f6e8be69464672d7'; // sha256 of JSON.stringify(evals.slice(0, 33)), no final LF (plan C16-14)
const C15_RECORDS = [
  ['docs/plans/2026-10-23-project-setup-v3-rc2-c15.md', '3a02b1762895f3ae8c526726896f5129d5c4f937cd67f3d3166b73369ab29726'],
  ['docs/plans/2026-10-23-project-setup-v3-rc2-c15-decisions.md', '20257ddb6802e47c3047b033711d8326bc03f723b8f2d79a42173b87360c65d6'],
  ['docs/plans/2026-10-23-project-setup-v3-rc2-c15-acceptance.md', 'befee1e7294b009f499ad69d481302bd506f69bd6e041ae0423c98d5fcb52e3d'],
];
const EMPTY_TREE = { 40: '4b825dc642cb6eb9a060e54bf8d69288fbee4904', 64: '6ef19b41225c5369f1c104d45d8d85efa9b057b53b14b4b9b939dd74decc5321' };
// Retained historical pins (plan C16-14 table of retained wrapper values; the v2 snapshots and the Claude wrappers).
const RETAINED_WRAPPER_NH = {
  'assets/wrappers/claude-docs-sync.md': '36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43',
  'assets/wrappers/claude-reviewer.md': '284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423',
  'assets/wrappers/codex-docs_sync.toml': '7a1d6e004a0f5af60ecf77b7ff22141f08e59379b84ce31e9ced32c7dc87be93',
  'assets/wrappers/codex-reviewer.toml': '135028b89b86ed0f3dcfe46c07119012b8f3ff2b6903fb51a591b833792ea13b',
};
const HISTORICAL_BASELINES = [
  ['data/v2.0.0/assets/agents/reviewer.md', '06dd68ac2019369f03e66fc3729a9522286487e643b319a1cd52695d2d35b12d'],
  ['data/v2.0.0/assets/agents/docs-sync.md', '217562b10ee8d43f47d085307172921f8789b7e8373056f9475e9642bf448571'],
  ['data/v2.0.0/assets/wrappers/claude-reviewer.md', '284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423'],
  ['data/v2.0.0/assets/wrappers/claude-docs-sync.md', '36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43'],
  ['data/v2.0.0/assets/wrappers/codex-reviewer.toml', '017b9c905f5cc033552ce981340ab04fd794bd8615f8745fe9c1f3048a52bddf'],
  ['data/v2.0.0/assets/wrappers/codex-docs_sync.toml', 'd860e92f20147e70ec61f7fbaaa79d18b385bd7bc8ac247f1f43d2d179f873f0'],
];
// The pre-C16 reviewer and docs-sync hashes the earlier tests carry as historical pins, reached by reversing C16 (and then C15's R15 and D15 for the C14 comparisons).
const C14_REVIEWER_NH = '658e6d6b9369eb61833a4f1a93f0f58557c3fc140d3d6c60913628a9d409ea8e';

// ============================================================ text engine ====
// Frozen paragraphs are compared after whitespace normalization where the plan lets placement and wrapping follow the file; amendments are compared byte for byte. A rule is a paragraph or phrase that MUST appear, with the part of the file it MUST appear in.
const paras = (lines) => {
  const out = []; let cur = [];
  for (const l of lines) { if (l.trim() === '') { if (cur.length) out.push(squash(cur.join(' '))); cur = []; } else cur.push(l); }
  if (cur.length) out.push(squash(cur.join(' ')));
  return out;
};
// The bullets of a bullet list: a line starting with "- " opens one, indented lines continue it.
function bulletsOf(lines) {
  const out = []; let cur = null;
  for (const l of lines) {
    if (l.startsWith('- ')) { if (cur !== null) out.push(squash(cur.join(' '))); cur = [l]; } else if (cur !== null && l.startsWith('  ')) cur.push(l); else if (l.trim() === '') { if (cur !== null) out.push(squash(cur.join(' '))); cur = null; }
  }
  if (cur !== null) out.push(squash(cur.join(' ')));
  return out;
}
// A sentence ends at ". ", "! " or "? " (a closing quote or parenthesis may follow the mark) before an uppercase letter, a bold marker, a quote, a backtick, a parenthesis or an angle bracket.
const SENTENCE_SPLIT = /(?<=[.!?]["')]?) +(?=[A-Z*"`(<])/;
const sentencesOf = (paragraph) => squash(paragraph).split(SENTENCE_SPLIT);
// Replaces the first occurrence of a sentence (a phrase), wherever the file wrapped it, by `replacement`; null when it is not there. With `within` (the rule's paragraph) the occurrence inside that paragraph is the one replaced.
function swapSentence(text, sentence, replacement, within = null) {
  const flex = (s) => new RegExp(s.split(' ').map(escRe).join('\\s+'));
  if (within !== null) {
    const m = flex(within).exec(text);
    if (m === null || !flex(sentence).test(m[0])) return null;
    return text.slice(0, m.index) + m[0].replace(flex(sentence), () => replacement) + text.slice(m.index + m[0].length);
  }
  const re = flex(sentence);
  return re.test(text) ? text.replace(re, () => replacement) : null;
}
const swapIn = (raw, rules, id, from, to) => { const r = rules.find((x) => x.id === id); return swapSentence(raw, from, to, r ? r.text : null); };
// The ways a sentence can be broken in memory: removed, or weakened (a MUST relaxed, a negation or a guard dropped).
function weakened(sentence) {
  for (const [re, to] of [[/\bMUST NOT\b/, 'MAY'], [/\bMUST\b/, 'SHOULD'], [/\bnever\b/, 'sometimes'], [/\bDo not\b/, 'Do'], [/\bnot\b/, 'also'], [/\bonly\b/, 'also'], [/\bno\b/, 'some'], [/\bcannot\b/, 'can'], [/\bis allowed\b/, 'is refused']]) {
    if (re.test(sentence)) return sentence.replace(re, to);
  }
  return null;
}
// Rule engine: rules = [{ id, where, text }]; `scopes` maps `where` to the squashed text of that part of the file. Returns the ids that fail.
function failedRules(rules, scopes) {
  const failed = [];
  for (const r of rules) {
    const scope = scopes[r.where];
    if (typeof scope !== 'string' || !scope.includes(r.text)) failed.push(r.id);
  }
  return failed;
}
const paraRules = (prefix, where, paragraphs) => paragraphs.map((text, i) => ({ id: `${prefix}#${i + 1}`, where, text }));
// Proves the rules can fail: every sentence of every rule is removed and weakened in the raw text, and the evaluation of that text must then fail exactly the rule of that sentence (never pass it).
function proveRulesFail(check, label, raw, rules, evaluate) {
  let tried = 0;
  for (const r of rules) {
    if (evaluate(raw).includes(r.id)) continue; // a rule that already fails is reported by its own assertion; its mutants would prove nothing
    for (const s of sentencesOf(r.text)) {
      const removed = swapSentence(raw, s, '', r.text);
      const w = weakened(s);
      const weak = w === null ? null : swapSentence(raw, s, w, r.text);
      if (removed === null) { check(false, `${label}: cannot locate a sentence of ${r.id} to remove it in memory`, clip(s)); continue; }
      tried++;
      check(evaluate(removed).includes(r.id), `${label}: removing a sentence of ${r.id} makes it fail`, clip(s));
      if (weak !== null) { tried++; check(evaluate(weak).includes(r.id), `${label}: weakening a sentence of ${r.id} makes it fail`, clip(s)); }
    }
  }
  return tried;
}
// Pairs of a sentence and its opposite: the substituted text must fail the rule that holds the sentence.
function proveOpposites(check, label, raw, pairs, evaluate, rules) {
  for (const [id, from, to, why] of pairs) {
    const swapped = swapIn(raw, rules, id, from, to);
    const tag = why ? `${id}, ${why}` : id;
    if (swapped === null) { check(false, `${label}: cannot locate the sentence whose opposite is tried (${tag})`, clip(from)); continue; }
    check(evaluate(swapped).includes(id), `${label}: substituting the opposite for a guard of ${tag} makes it fail`, clip(to));
  }
}
const sentenceCount = (rules) => rules.reduce((n, r) => n + sentencesOf(r.text).length, 0);
// The part of a markdown text between a heading line and the next heading of the same or higher level (null when absent).
function sectionOf(text, heading) {
  const ls = LF(text).split('\n');
  const at = ls.findIndex((l) => l === heading);
  if (at < 0) return null;
  const level = /^#+/.exec(heading)[0].length;
  let end = ls.length;
  for (let i = at + 1; i < ls.length; i++) { const m = /^(#+) /.exec(ls[i]); if (m && m[1].length <= level) { end = i; break; } }
  return ls.slice(at + 1, end).join('\n');
}
const between = (text, a, b) => { if (text === null) return null; const i = text.indexOf(a); if (i < 0) return null; const j = text.indexOf(b, i + a.length); return j < 0 ? null : text.slice(i + a.length, j); };
const headingsOf = (t) => LF(t).split('\n').filter((l) => /^#{1,6} /.test(l));
// The byte convention of C16-5 for an edited source file: LF only, no BOM, exactly one final LF.
function byteConvention(bytes) {
  if (bytes === null) return 'unreadable';
  if (bytes.includes(0x0d)) return 'contains CR';
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'starts with a BOM';
  if (bytes[bytes.length - 1] !== 0x0a || bytes[bytes.length - 2] === 0x0a) return 'does not end with exactly one LF';
  return null;
}
// The pre-change files, decoded from the committed fixture (raw bytes, base64); keyed by the skill-relative path (root files by "@root/...").
function loadFixture(context) {
  const doc = readJson(skillPath(context, FIXTURE_REL));
  const out = { doc, files: {} };
  if (doc && Array.isArray(doc.entries)) {
    for (const e of doc.entries) {
      if (!e || typeof e.path !== 'string' || typeof e.base64 !== 'string') continue;
      const rel = e.path.startsWith('project-setup/') ? e.path.slice('project-setup/'.length) : `@root/${e.path}`;
      out.files[rel] = Buffer.from(e.base64, 'base64');
    }
  }
  return out;
}
const preText = (fx, rel) => (fx.files[rel] === undefined ? null : fx.files[rel].toString('utf8'));
// The independent model of an amended file: the pinned pre-C16 bytes with the frozen amendments applied by the helper. It exists whether or not the implementation does.
const modelOf = (fx, rel) => { const t = preText(fx, rel); return t === null ? null : applyForFile(t, rel); };
const recognizes = (text, name) => new RegExp(escRe(name), 'i').test(text);
// The model of an amended file with the amendments applied up to and including `id` (the state in which `id` is the last amendment, so its anchors are adjacent and its failure controls are meaningful).
function modelThrough(fx, rel, id) {
  const order = FORWARD_ORDER16[rel];
  const at = order === undefined ? -1 : order.indexOf(id);
  const pre = preText(fx, rel);
  return pre === null || at < 0 ? null : applySteps(pre, order.slice(0, at + 1));
}

// One amended file against its pre-change bytes: the byte convention, every amendment exactly once at its anchor (checked at its turn in the reversal, so an adjacent amendment is verified once the later one is reversed), and the reversal equal
// to the pinned pre-change bytes (raw SHA-256 of plan C16-14). Returns { text, reversed }.
function checkAmendedFile(check, context, fx, rel, { expectFinalLf = true } = {}) {
  const bytes = pre17Bytes(context, rel);
  if (expectFinalLf) check(byteConvention(bytes) === null, `${rel}: LF only, no BOM and exactly one final LF (C16-5)`, byteConvention(bytes));
  if (bytes === null) return null;
  const text = bytes.toString('utf8');
  let running = text;
  for (const id of REVERSAL_ORDER16[rel]) {
    const once = amendmentOnce(running, AM16[id]);
    check(once, `${rel}: amendment ${id} stands exactly once at its stated anchor`);
    if (!once) break;
    running = reverseOne(running, AM16[id]);
  }
  const r = reverseForFile(text, rel);
  check(r.text !== null, `${rel}: the C16 amendments reverse in order ${REVERSAL_ORDER16[rel].join(', ')}`, r.failed);
  const pre = fx.files[rel];
  check(pre !== undefined && sha(pre) === PRE_PIN[rel], `${rel}: the committed fixture holds the pre-C16 bytes (raw SHA-256 pinned by plan C16-14)`, pre && sha(pre));
  if (r.text !== null) {
    const got = Buffer.from(r.text, 'utf8');
    check(sha(got) === PRE_PIN[rel] && pre !== undefined && Buffer.compare(got, pre) === 0, `${rel}: reversing exactly ${REVERSAL_ORDER16[rel].join(', ')} gives the pre-C16 bytes (nothing else changed; raw SHA-256 pinned by plan C16-14)`, sha(got));
  }
  return { text, reversed: r.text };
}
// Failure controls for one amendment, built in memory from a model text that carries it exactly once (the real files are never modified): a missing, partial, duplicated, moved, altered, differently spaced or CRLF amendment, and
// the same amendment looked for in another file, is never verified and never reversed (C16-5: it fails before any historical hashing). `movedBefore` names a text of the model the amendment is moved in front of.
function amendmentControls(check, label, model, a, { movedBefore = null, otherFileText = '' } = {}) {
  const base = LF(model);
  check(amendmentOnce(base, a) && reverseOne(base, a) !== null, `${label}: control baseline: the model carries the amendment exactly once at its anchor`);
  const without = reverseOne(base, a);
  if (without === null) return;
  const rejected = (name, text) => check(!amendmentOnce(text, a) && reverseOne(text, a) === null, `${label}: ${name} is rejected before any historical comparison`);
  rejected('missing: the text without the amendment', without);
  const lines = a.neu.split('\n');
  const lastIdx = lines.map((l, i) => [l, i]).filter(([l]) => l !== '').map(([, i]) => i).pop();
  const partial = [...lines.slice(0, lastIdx), ...lines.slice(lastIdx + 1)].join('\n');
  rejected('partial: the last line of the amendment dropped', base.replace(a.neu, () => partial));
  rejected('duplicate: a second copy right after the first', base.replace(a.before + a.neu, (m) => m + a.neu));
  rejected('duplicate: a second copy at the end of the file', base + a.neu);
  rejected('moved: the text away from its anchor', movedBefore !== null && without.includes(movedBefore) ? without.replace(movedBefore, () => a.neu + movedBefore) : `${without}${a.neu}`);
  rejected('altered: one character changed', base.replace(a.neu, () => `${a.neu.slice(0, 3)}${a.neu[3] === 'z' ? 'y' : 'z'}${a.neu.slice(4)}`));
  rejected('altered: a doubled space inside', base.replace(a.neu, () => a.neu.replace(' ', '  ')));
  rejected('spaced: an extra blank line before the amendment', base.replace(a.before + a.neu, () => `${a.before}\n${a.neu}`));
  rejected('spaced: an extra blank line after the amendment', base.replace(a.neu + a.after, () => `${a.neu}\n${a.after}`));
  if (a.neu.includes('\n\n')) rejected('spaced: a blank line inside the amendment doubled', base.replace(a.neu, () => a.neu.replace('\n\n', '\n\n\n')));
  if (a.before.endsWith('\n\n')) rejected('spaced: the blank line before the amendment removed', base.replace(a.before + a.neu, () => `${a.before.slice(0, -1)}${a.neu}`));
  rejected('CRLF: the same text with CRLF line ends', base.replace(/\n/g, '\r\n'));
  rejected('another file: a different file never carries the amendment', otherFileText);
  const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(base, 'utf8')]);
  check(byteConvention(bom) === 'starts with a BOM' && byteConvention(Buffer.from(base.replace(/\n/g, '\r\n'))) === 'contains CR' && byteConvention(Buffer.from(`${base}\n`)) === 'does not end with exactly one LF', `${label}: the byte convention rejects a BOM, CR and a doubled final LF`);
}
const bolds = (text) => [...String(text).matchAll(/\*\*[^*\n]+\*\*/g)].map((m) => m[0]);

// ============================================ A5-templates/C16/launch ====
// Plan C16-6, C16-7, C16-11, C16-16 item 1 and C16-21 (amendments L16, D16, S1, DG1, DG2, RM2, CL1): the root Claude template gains the root-start requirement (L16, 24 lines, 2067 bytes) directly after "## Claude Code" and its blank line and
// reads the deny bullet differently (D16); the nested template stays exactly "@AGENTS.md" plus LF; SKILL.md gains the setup launch rule (S1); docs-generation states how setup renders the root-start rule (DG2); README and references/claude.md state the
// launch requirement, the worktree commit requirement and the lazy-loading residual for a start above or outside the root. The instruction can only refuse when the comparison POSITIVELY establishes a start strictly below the nearest loaded rule's directory
// (nearest at or above the original start directory), never from missing launch context, never from a cd, never from nested settings alone. Instruction tests establish text, not obedience: the host measurements stay pending (C16-20).
const ROOT_REL = 'assets/templates/CLAUDE.md';
const NESTED_REL = 'assets/templates/nested-CLAUDE.md';
const SKILL_REL = 'SKILL.md';
const DOCGEN_REL = 'references/docs-generation.md';
const CLAUDE_REF_REL = 'references/claude.md';
const README_REL = 'README.md';
const L16_LINES = C16_BLOCKS.L16;
const L16_BULLETS = bulletsOf(L16_LINES);
const L16_PHRASES = [
  ['l16-start-root', "You MUST start Claude Code at this repository's root."],
  ['l16-root-definition', 'For this rule, the root is the directory containing this CLAUDE.md; setup installs it next to .claude/settings.json.'],
  ['l16-inactive-controls', 'Starting below that root can leave the raw-Git hook and permissions.deny inactive and omit the root AGENTS.md import, exposing protected files and unfiltered Git history.'],
  ['l16-compare-first', "Before reading files or running any Git command or project tool, you MUST compare the session's original working directory in its environment context with the directory of the loaded CLAUDE.md carrying this rule."],
  ['l16-supplied-context-only', 'Use only supplied context and loaded instruction locations; do not run raw Git or read files to discover the root.'],
  ['l16-components', 'Compare directory components, case-insensitively on Windows, not a string prefix.'],
  ['l16-cd-not-start', 'The current directory after a cd is not the original start directory.'],
  ['l16-nearest', 'If several loaded CLAUDE.md files carry this rule, you MUST use the nearest one at or above the original start directory.'],
  ['l16-nearest-why', "This prevents an outer checkout's rule from rejecting a session started at a nested worktree's own root, including .claude/worktrees/<name>."],
  ['l16-refuse', "If that comparison positively establishes that the session started strictly below the selected rule's directory, you MUST say that the root hook, deny rules and shared rules may be absent, ask the user to restart Claude Code from that root, and stop before any file read, Git command or project tool."],
  ['l16-cd-not-fix', 'Changing directory is not a fix.'],
  ['l16-no-infer', 'You MUST NOT infer a subdirectory start from missing or ambiguous launch context alone, or refuse a root-started session on that basis; uncertainty does not establish the condition above.'],
  ['l16-no-proof', 'You MUST NOT claim that uncertainty proves the controls are active.'],
  ['l16-no-false-refusal-why', 'This prevents false launch refusals without treating unknown host state as verified.'],
  ['l16-sibling', 'A sibling worktree uses its own rule and root.'],
  ['l16-cd-later', 'A root-started session may later change directory within that same repository.'],
  ['l16-nested-settings', 'A nested .claude/settings.json alone is not a root marker for this comparison and MUST NOT be used to bypass an established refusal.'],
];
const L16_RULES = [
  ...L16_BULLETS.map((text, i) => ({ id: `l16#${i + 1}`, where: 'claude', text })),
  ...L16_PHRASES.map(([id, text]) => ({ id, where: 'claude', text })),
];
const CLAUDE_BEGIN = '<!-- project-setup:begin id=claude -->';
const CLAUDE_END = '<!-- project-setup:end id=claude -->';
const claudeBlockOf = (text) => between(LF(text), CLAUDE_BEGIN, CLAUDE_END);
const SHARED_BULLET_LINE = '- Shared rules live in AGENTS.md (imported above). Put only Claude-specific notes here.';
const SUBAGENT_BULLET_LINE = '- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; both load their canonical definition from `.ai/agents/`.';
const PREAMBLE_BULLET = ['- If a built-in review preamble is blocked by the managed raw-Git hook, apply its method', '  through `node .ai/tools/git-safe.mjs`. You MUST NOT allow-list raw `git diff`, including', '  `--name-only`, or disable the hook to load it.'];
// The structure of the rendered root template: L16 stands once, directly after "## Claude Code" and its blank line and directly before the shared-rules bullet (no blank line between), the deny bullet is the new two-line text, the old one is gone.
function evalL16(raw) {
  const t = LF(raw);
  const block = claudeBlockOf(t);
  const f = failedRules(L16_RULES, { claude: squash(block === null ? '' : block) });
  if (!t.includes(`## Claude Code\n\n${T(L16_LINES)}${SHARED_BULLET_LINE}\n`)) f.push('l16-placement');
  if (COUNT(t, "You MUST start Claude Code at this repository's root.") !== 1) f.push('l16-once');
  if (!squash(block === null ? '' : block).includes(squash(C16_BLOCKS.DENY_NEW.join(' '))) || t.includes(C16_BLOCKS.DENY_OLD[0])) f.push('l16-deny-bullet');
  if (!t.includes(`${SUBAGENT_BULLET_LINE}\n${T(C16_BLOCKS.DENY_NEW)}${T(PREAMBLE_BULLET)}${CLAUDE_END}\n`)) f.push('l16-existing-bullets');
  return f;
}
const L16_OPPOSITES = [
  ['l16#1', 'You MUST start Claude Code at this repository', 'You MAY start Claude Code at this repository', 'the root start is mandatory'],
  ['l16#1', 'the root is the directory containing this CLAUDE.md', 'the root is the directory containing .git', 'the rule root is the CLAUDE.md directory'],
  ['l16#2', 'you MUST compare the session\'s original working directory', 'you MAY compare the session\'s current working directory', 'the original start directory is compared'],
  ['l16#2', 'Before reading files or running any Git command or project tool', 'After reading files and running Git commands', 'the comparison comes first'],
  ['l16#2', 'do not run raw Git or read files to discover the root', 'run raw Git or read files to discover the root', 'no discovery read or Git command'],
  ['l16#2', 'case-insensitively on Windows', 'case-sensitively on Windows', 'Windows spelling is case-insensitive'],
  ['l16#2', 'not a string prefix', 'as a string prefix', 'components, not a prefix'],
  ['l16#2', 'The current directory after a cd is not the original start directory.', 'The current directory after a cd is the start directory.', 'cd does not move the start'],
  ['l16#3', 'you MUST use the nearest one at or above the original start directory', 'you MUST use the outermost one at or above the original start directory', 'nearest, not outermost'],
  ['l16#3', 'at or above the original start directory', 'below the original start directory', 'at or above'],
  ['l16#4', 'positively establishes that the session started strictly below', 'suggests that the session may have started below', 'positive evidence of a strictly-below start'],
  ['l16#4', 'strictly below the selected rule\'s directory', 'anywhere other than the selected rule\'s directory', 'strictly below'],
  ['l16#4', 'ask the user to restart Claude Code from that root', 'tell the user to change directory and continue', 'a restart is requested'],
  ['l16#4', 'stop before any file read, Git command or project tool', 'continue with file reads and Git commands', 'the refusal stops before any tool'],
  ['l16#4', 'Changing directory is not a fix.', 'Changing directory is a fix.', 'cd is no repair'],
  ['l16#5', 'You MUST NOT infer a subdirectory start from missing or ambiguous launch context alone', 'You MAY infer a subdirectory start from missing or ambiguous launch context', 'no refusal from missing context'],
  ['l16#5', 'You MUST NOT claim that uncertainty proves the controls are active.', 'You MAY claim that uncertainty proves the controls are active.', 'uncertainty never proves active controls'],
  ['l16#5', 'This prevents false launch refusals without treating unknown host state as verified.', 'This allows false launch refusals while treating unknown host state as verified.', 'the failure prevented'],
  ['l16#6', 'A sibling worktree uses its own rule and root.', 'A sibling worktree uses the rule and root of the checkout it was created from.', 'a sibling worktree has its own root'],
  ['l16#6', 'A root-started session may later change directory within that same repository.', 'A root-started session MUST restart after changing directory.', 'root then cd stays valid'],
  ['l16#6', 'alone is not a root marker for this comparison and MUST NOT be used to bypass an established refusal', 'alone is a root marker for this comparison and MAY be used to bypass an established refusal', 'nested settings are no marker and no bypass'],
];
// The scenario rows of plan C16-16 item 1 and C16-21: [scenario, the exact words of the installed rule that settle it].
const L16_SCENARIO_ROWS = [
  ['a root start is not refused: refusal needs a positively established strictly-below start', 'or refuse a root-started session on that basis'],
  ['a root start followed by a cd inside the repository stays valid', 'A root-started session may later change directory within that same repository.'],
  ['a subdirectory start: say the controls may be absent, request a root restart, stop before any read, Git command or tool', 'ask the user to restart Claude Code from that root, and stop before any file read, Git command or project tool'],
  ['an unknown start directory: no automatic refusal and no claim of verified controls', 'You MUST NOT infer a subdirectory start from missing or ambiguous launch context alone'],
  ['nested settings alone: no root marker and no bypass of an established refusal', 'A nested .claude/settings.json alone is not a root marker for this comparison and MUST NOT be used to bypass an established refusal.'],
  ['a sibling worktree is judged against its own rule and root', 'A sibling worktree uses its own rule and root.'],
  ['a worktree rooted under .claude/worktrees/<name> uses the nearest loaded rule, never the outer checkout rule', 'including .claude/worktrees/<name>'],
  ['Windows directory spelling is compared case-insensitively by component', 'Compare directory components, case-insensitively on Windows, not a string prefix.'],
  ['a cd after the start does not move the original start directory', 'The current directory after a cd is not the original start directory.'],
  ['root shared rules are not assumed loaded below the root', 'omit the root AGENTS.md import'],
  ['no discovery read or Git command is authorized before an established refusal', 'do not run raw Git or read files to discover the root'],
  ['a start above or outside the root is outside the strictly-below condition', 'strictly below the selected rule\'s directory'],
];
// SKILL.md S1: the setup launch paragraph; its own rules.
const S1_PARA = squash(C16_BLOCKS.S1_PARAGRAPH.join(' '));
const S1_PHRASES = [
  ['s1-start-root', 'For Claude Code, you MUST start the session at the target repository root before setup.'],
  ['s1-compare', 'Compare the original working directory in the supplied environment context with the target root.'],
  ['s1-ask-and-stop', 'If that context positively establishes a start below the root, you MUST ask for a root restart and stop before file reads, Git commands or project tools.'],
  ['s1-discovery', 'As soon as a below-root start is positively established, including by discovery, you MUST stop before any further read or write and ask for a root restart.'],
  ['s1-cd-no-fix', 'Changing directory inside the session does not load the missing root settings.'],
  ['s1-why', "This prevents setup from running without the repository's hook, deny rules or shared critical instructions."],
  ['s1-missing-context', 'Missing launch context alone does not establish a subdirectory start or verify host controls.'],
];
const S1_RULES = [{ id: 's1#1', where: 's1', text: S1_PARA }, ...S1_PHRASES.map(([id, text]) => ({ id, where: 's1', text }))];
const s1Scope = (text) => { const b = between(LF(text), 'Read this file fully, then read references only when the step says so.', '## Non-negotiable rules'); return { s1: squash(b === null ? '' : b) }; };
function evalS1(raw) {
  const f = failedRules(S1_RULES, s1Scope(raw));
  const t = LF(raw);
  if (!t.includes(`Read this file fully, then read references only when the step says so.\n\n${T(C16_BLOCKS.S1_PARAGRAPH)}\n## Non-negotiable rules\n`)) f.push('s1-placement');
  if (COUNT(t, 'For Claude Code, you MUST start the session at the target repository root before setup.') !== 1) f.push('s1-once');
  return f;
}
const S1_OPPOSITES = [
  ['s1#1', 'you MUST start the session at the target repository root before setup', 'you MAY start the session anywhere before setup', 'the root start is mandatory'],
  ['s1#1', 'Compare the original working directory in the supplied environment context', 'Compare the current working directory in the supplied environment context', 'the original directory is compared'],
  ['s1#1', 'positively establishes a start below the root', 'suggests a start below the root', 'positive evidence is required'],
  ['s1#1', 'you MUST ask for a root restart and stop before file reads, Git commands or project tools', 'you MAY continue with file reads and Git commands', 'ask and stop'],
  ['s1#1', 'including by discovery, you MUST stop before any further read or write', 'including by discovery, you MAY finish the current read or write', 'discovery stops everything'],
  ['s1#1', 'does not load the missing root settings', 'loads the missing root settings', 'cd repairs nothing'],
  ['s1#1', 'Missing launch context alone does not establish a subdirectory start or verify host controls.', 'Missing launch context alone establishes a subdirectory start.', 'missing context is no evidence either way'],
];
// docs-generation DG2: how setup renders and delivers the root-start rule (plan C16-7); DG1: the dated launch-location measurement.
const DG2_PARAS = paras(C16_BLOCKS.DG2);
const DG2_PHRASES = [
  ['dg2-render', 'Setup MUST render the root-start rule from the root Claude template, including on update when application code is unchanged.'],
  ['dg2-why', 'This keeps the refusal instruction in the text observed to load during a subdirectory launch.'],
  ['dg2-preserve', 'Setup MUST preserve the sibling @AGENTS.md imports and user text outside managed blocks, so the update does not discard local rules.'],
  ['dg2-existing-root', 'An existing root CLAUDE.md MUST receive the updated managed claude block through the normal reviewed draft and ownership workflow.'],
  ['dg2-no-silent-recreate', 'A missing or user-removed instruction file MUST NOT be silently recreated; resolve its disposition first.'],
  ['dg2-incomplete', 'Kept old root instructions MUST be reported as an incomplete update.'],
  ['dg2-nested-unchanged', 'The nested CLAUDE.md template and its ownership remain unchanged.'],
  ['dg2-no-import-substitute', 'A relative import of the root AGENTS.md is not part of this change and MUST NOT be presented as a replacement for starting Claude Code at the root.'],
];
const DG2_RULES = [...paraRules('dg2', 'docgen', DG2_PARAS), ...DG2_PHRASES.map(([id, text]) => ({ id, where: 'docgen', text }))];
const evalDg2 = (raw) => {
  const f = failedRules(DG2_RULES, { docgen: squash(raw) });
  if (!LF(raw).includes(`Never move the critical rules into nested files only; the root keeps the short version.\n${T(C16_BLOCKS.DG2)}\n## Project-local security tooling (fully managed, always installed)\n`)) f.push('dg2-placement');
  return f;
};
// The launch and worktree paragraphs shared by the project README and references/claude.md (plan C16-11).
const LAUNCH_PARAS = paras(C16_BLOCKS.RM_LAUNCH);
const LAUNCH_PHRASES = [
  'Claude Code sessions MUST start at the target repository root.',
  'Starting in a subdirectory can omit the root hook, deny rules and shared critical instructions.',
  'If started below the root, stop and restart there before reading files or running Git or project tools; cd inside the existing session does not repair its launch configuration.',
  'You MUST commit the installed setup before starting worktree sessions, so each new worktree can contain its own root instructions and settings.',
  'A worktree created before that commit may lack its own CLAUDE.md and be refused under the outer checkout\'s loaded root rule.',
];

async function launch(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const fx = loadFixture(context);
    const preRoot = preText(fx, ROOT_REL); const preNested = fx.files[NESTED_REL];
    const modelRoot = preRoot === null ? null : applyForFile(preRoot, ROOT_REL);
    if (preRoot === null || modelRoot === null) { check(false, 'the pre-change root template is in the fixture and takes L16 and D16 exactly once at their anchors'); return; }
    await step('plan C16-6 identities: L16 is 24 lines, 2067 bytes, widest line 95, SHA-256 280402ad...; the complete rendered root template (pinned pre-C16 template plus L16 and D16, applied independently) is 2790 bytes, SHA-256 5bb1d5ed... (the round-2 hash 5afb6de7... is not the template); the frozen block is the plan block exactly and both blocks are ASCII', async () => {
      const l16 = T(L16_LINES);
      check(L16_LINES.length === L16_IDENTITY.lines && Buffer.byteLength(l16) === L16_IDENTITY.bytes && Math.max(...L16_LINES.map((l) => l.length)) === L16_IDENTITY.maxWidth && sha(Buffer.from(l16)) === L16_IDENTITY.sha, 'L16 alone has the plan\'s lines, bytes, widest line and SHA-256', { lines: L16_LINES.length, bytes: Buffer.byteLength(l16), sha: sha(Buffer.from(l16)) });
      check(Buffer.byteLength(modelRoot) === ROOT_TEMPLATE_IDENTITY.bytes && sha(Buffer.from(modelRoot)) === ROOT_TEMPLATE_IDENTITY.sha && modelRoot === T(C16_BLOCKS.ROOT_TEMPLATE), 'the independent model of the rendered root template has the plan\'s bytes and SHA-256 and equals the plan\'s rendered text', { bytes: Buffer.byteLength(modelRoot), sha: sha(Buffer.from(modelRoot)) });
      check(ROOT_TEMPLATE_IDENTITY.sha !== ROUND2_ROOT_TEMPLATE_SHA && !/[^\x00-\x7f]/.test(modelRoot) && L16_LINES.every((l) => l.length <= 100), 'the round-2 hash is a different (superseded) template and the rendered text is ASCII within 100 columns');
      check(L16_BULLETS.length === 6, 'L16 is six bullets', L16_BULLETS.length);
    });
    await step('the independent model (the pinned pre-C16 template plus L16 and D16 applied by the helper) satisfies every L16 rule and every sentence of L16 is a rule that fails when it is removed or weakened, each guard is replaced by its opposite, and the structure is rejected when L16 is moved, duplicated, split from the shared bullet or the deny bullet is restored', async () => {
      check(evalL16(modelRoot).length === 0, 'the model satisfies every L16 rule', evalL16(modelRoot));
      const tried = proveRulesFail(check, 'root template L16 (model)', modelRoot, L16_RULES, evalL16);
      check(tried >= sentenceCount(L16_RULES), 'the in-memory variants cover every sentence of the frozen block (removal and weakening)', tried);
      proveOpposites(check, 'root template L16 (model)', modelRoot, L16_OPPOSITES, evalL16, L16_RULES);
      const swap = (from, to) => swapSentence(LF(modelRoot), from, to) || LF(modelRoot);
      for (const [name, variant, id] of [
        ['L16 moved after the shared-rules bullet', LF(modelRoot).replace(`${T(L16_LINES)}`, '').replace(`${SHARED_BULLET_LINE}\n`, `${SHARED_BULLET_LINE}\n${T(L16_LINES)}`), 'l16-placement'],
        ['a blank line between L16 and the shared-rules bullet', LF(modelRoot).replace(`${T(L16_LINES)}${SHARED_BULLET_LINE}`, `${T(L16_LINES)}\n${SHARED_BULLET_LINE}`), 'l16-placement'],
        ['a second copy of the first bullet', `${LF(modelRoot)}${T(L16_LINES.slice(0, 4))}`, 'l16-once'],
        ['the old deny bullet restored', LF(modelRoot).replace(T(C16_BLOCKS.DENY_NEW), T(C16_BLOCKS.DENY_OLD)), 'l16-deny-bullet'],
        ['the preamble bullet changed', swap('You MUST NOT allow-list raw `git diff`', 'You MAY allow-list raw `git diff`'), 'l16-existing-bullets'],
        ['the subagent bullet removed', LF(modelRoot).replace(`${SUBAGENT_BULLET_LINE}\n`, ''), 'l16-existing-bullets'],
      ]) check(variant !== LF(modelRoot) && evalL16(variant).includes(id), `L16 control: ${name} is rejected (${id})`, evalL16(variant));
    });
    let amended = null;
    await step('amendments L16 and D16 stand exactly once at their anchors in the installed root template, reversing D16 and then L16 gives the pre-C16 template byte for byte (raw SHA-256 cca922bb...), the installed template equals the rendered plan text (2790 bytes, 5bb1d5ed...), and the file keeps the C16-5 byte convention', async () => {
      amended = checkAmendedFile(check, context, fx, ROOT_REL);
      if (amended === null) return;
      const bytes = readBytes(skillPath(context, ROOT_REL));
      check(bytes !== null && bytes.length === ROOT_TEMPLATE_IDENTITY.bytes && sha(bytes) === ROOT_TEMPLATE_IDENTITY.sha && amended.text === T(C16_BLOCKS.ROOT_TEMPLATE), 'the installed root template is exactly the rendered plan text', { bytes: bytes && bytes.length, sha: bytes && sha(bytes) });
      check(COUNT(amended.text, '@AGENTS.md') === 1 && amended.text.startsWith('@AGENTS.md\n\n<!-- project-setup:begin id=claude -->\n## Claude Code\n\n') && amended.text.endsWith(`${CLAUDE_END}\n`), 'the root template still imports only its sibling AGENTS.md (no root AGENTS import is added) and keeps both managed markers');
    });
    if (amended === null) { check(false, `${ROOT_REL} is readable`); return; }
    const source = LF(amended.text);
    await step('the installed root template states every L16 requirement: the root start MUST, the original start compared first with directory components (case-insensitive on Windows), the nearest loaded rule at or above the start, the strictly-below refusal needing positive evidence (root hook, deny rules and shared rules may be absent; restart requested; stop before any read, Git command or project tool), no refusal from missing or ambiguous context, no proof from uncertainty, a sibling worktree uses its own root, a root start may cd later, nested settings are no marker; the structure and the unchanged bullets hold', async () => {
      const failed = evalL16(source);
      for (const r of L16_RULES) check(!failed.includes(r.id), `root template rule ${r.id} holds`, clip(r.text));
      for (const id of ['l16-placement', 'l16-once', 'l16-deny-bullet', 'l16-existing-bullets']) check(!failed.includes(id), `root template structure ${id} holds`);
      const s = squash(claudeBlockOf(source) || '');
      for (const [row, words] of L16_SCENARIO_ROWS) check(s.includes(squash(words)), `C16-16/C16-21 row: ${row}`, clip(words));
      check(!/\b(Bash|PowerShell|hook event|settings\.json) (is|are) (loaded|active) (below|in a subdirectory)/i.test(s) && !/uncertainty (proves|establishes)\b/.test(s.replace('uncertainty does not establish', '').replace('uncertainty proves the controls are active', '')), 'no sentence claims that controls are active or loaded below the root');
      check(s.includes('Shared rules live in AGENTS.md (imported above). Put only Claude-specific notes here.') && s.includes(squash(SUBAGENT_BULLET_LINE)) && s.includes(squash(PREAMBLE_BULLET.join(' '))), 'the shared-rules bullet, the subagent bullet and the built-in-review-preamble bullet are retained byte for byte');
    });
    await step('the nested template is exactly "@AGENTS.md" plus LF (raw SHA-256 336cc4fb..., unchanged): no nested root import, no nested managed block and no launch rule is added', async () => {
      const b = readBytes(skillPath(context, NESTED_REL));
      check(b !== null && b.toString('latin1') === '@AGENTS.md\n' && sha(b) === PRE_PIN[NESTED_REL] && preNested !== undefined && Buffer.compare(b, preNested) === 0, 'assets/templates/nested-CLAUDE.md is exactly the fixture bytes "@AGENTS.md\\n"', b && b.toString('latin1'));
      check(b !== null && !b.toString('utf8').includes('project-setup:begin') && !b.toString('utf8').includes('../AGENTS.md') && !/MUST start Claude Code/.test(b.toString('utf8')), 'the nested template has no managed block, no parent import and no launch rule');
    });
    await step('the setup launch rule (SKILL.md S1) stands once between the opening sentence and "## Non-negotiable rules" and is a rule per sentence: start at the target root, compare the original directory, ask for a restart and stop when a below-root start is positively established, stop at once when discovery establishes it, a cd does not load the missing settings, missing context alone establishes nothing', async () => {
      const model = modelOf(fx, SKILL_REL);
      if (model === null) { check(false, 'the pre-change SKILL.md takes S1 exactly once at its anchor (and the other C16 SKILL amendments)'); return; }
      check(evalS1(model).length === 0, 'the independent SKILL model satisfies every S1 rule', evalS1(model));
      const tried = proveRulesFail(check, 'SKILL S1 (model)', model, S1_RULES, evalS1);
      check(tried >= sentenceCount(S1_RULES), 'the in-memory variants cover every sentence of the frozen paragraph', tried);
      proveOpposites(check, 'SKILL S1 (model)', model, S1_OPPOSITES, evalS1, S1_RULES);
      const skill = sourceText(context, SKILL_REL);
      if (skill === null) { check(false, 'SKILL.md is readable'); return; }
      const failed = evalS1(skill);
      for (const r of S1_RULES) check(!failed.includes(r.id), `SKILL.md rule ${r.id} holds`, clip(r.text));
      for (const id of ['s1-placement', 's1-once']) check(!failed.includes(id), `SKILL.md structure ${id} holds`);
      const tried2 = proveRulesFail(check, 'SKILL S1', skill, S1_RULES, evalS1);
      check(tried2 >= sentenceCount(S1_RULES), 'the installed text is mutated sentence by sentence as well', tried2);
      proveOpposites(check, 'SKILL S1', skill, S1_OPPOSITES, evalS1, S1_RULES);
      check(squash(skill.split('\n').slice(0, 8).join(' ')).includes('name: project-setup') && !/^\s*launch rule/im.test(skill), 'the skill front matter is untouched');
    });
    await step('docs-generation DG2: setup renders the root-start rule from the root Claude template (also on update with unchanged application code), preserves the sibling imports and user text, delivers the managed block through the reviewed draft and ownership workflow, never silently recreates a missing or removed file, reports kept old root instructions as incomplete, leaves the nested template and its ownership unchanged and never presents a parent import as a replacement; the block stands exactly once after the "critical rules" sentence', async () => {
      const model = modelOf(fx, DOCGEN_REL);
      if (model === null) { check(false, 'the pre-change docs-generation takes DG1 and DG2 exactly once at their anchors'); return; }
      check(evalDg2(model).length === 0, 'the independent model satisfies every DG2 rule', evalDg2(model));
      const tried = proveRulesFail(check, 'docs-generation DG2 (model)', model, DG2_RULES, evalDg2);
      check(tried >= sentenceCount(DG2_RULES), 'the in-memory variants cover every sentence of the frozen block', tried);
      const doc = sourceText(context, DOCGEN_REL);
      if (doc === null) { check(false, `${DOCGEN_REL} is readable`); return; }
      const failed = evalDg2(doc);
      for (const r of DG2_RULES) check(!failed.includes(r.id), `docs-generation rule ${r.id} holds`, clip(r.text));
      check(!failed.includes('dg2-placement'), 'DG2 stands directly after the critical-rules sentence and before the security-tooling heading');
      check(amendmentOnce(doc, AM16.DG1) && amendmentOnce(doc, AM16.DG2), 'DG1 and DG2 each stand exactly once at their anchors');
      const dg1 = squash(C16_BLOCKS.DG1_APPEND.join(' '));
      check(squash(doc).includes(dg1) && dg1.includes('Claude Code 2.1.310, Windows 11, the 2026-10-25 headless probes P1/P2') && dg1.includes('These are model self-reports; interactive TUI import behavior remains unverified.'), 'the launch-location measurement is dated, scoped to the headless probes and a model self-report (no TUI claim)');
      proveRulesFail(check, 'docs-generation DG2', doc, DG2_RULES, evalDg2);
    });
    await step('README and references/claude.md carry the launch requirement and the worktree requirement exactly (RM2, CL1): sessions MUST start at the root, below the root the session stops and restarts before reading files or running Git or project tools, a cd does not repair the launch, and installed setup MUST be committed before worktree sessions because an earlier worktree may lack its own CLAUDE.md and be refused under the outer rule', async () => {
      for (const [rel, doc] of [[README_REL, sourceText(context, README_REL)], [CLAUDE_REF_REL, sourceText(context, CLAUDE_REF_REL)]]) {
        if (doc === null) { check(false, `${rel} is readable`); continue; }
        const s = squash(doc);
        for (const p of LAUNCH_PARAS) check(s.includes(p), `${rel}: the launch/worktree paragraph is exact`, clip(p));
        for (const phrase of LAUNCH_PHRASES) check(s.includes(phrase), `${rel}: states "${clip(phrase)}"`);
        for (const sentence of LAUNCH_PHRASES) {
          const removed = swapSentence(doc, sentence, '');
          check(removed !== null && !squash(removed).includes(sentence), `${rel}: control: removing the sentence is detected`, clip(sentence));
        }
      }
      const readme = sourceText(context, README_REL) || '';
      const sq = squash(readme);
      check(sq.indexOf(LAUNCH_PARAS[0]) >= 0 && sq.indexOf(LAUNCH_PARAS[0]) < sq.indexOf('## Claude raw-Git hook') && sq.indexOf(LAUNCH_PARAS[1]) === sq.indexOf(LAUNCH_PARAS[0]) + LAUNCH_PARAS[0].length + 1 && sq.indexOf('## Claude raw-Git hook') === sq.indexOf(LAUNCH_PARAS[1]) + LAUNCH_PARAS[1].length + 1, 'README: the two launch paragraphs come immediately before "## Claude raw-Git hook"');
      const ref = sourceText(context, CLAUDE_REF_REL) || '';
      const sr = squash(ref);
      check(sr.indexOf(LAUNCH_PARAS[0]) >= 0 && sr.indexOf(LAUNCH_PARAS[0]) < sr.indexOf('## Instruction loading') && sr.indexOf('## Instruction loading') === sr.indexOf(LAUNCH_PARAS[1]) + LAUNCH_PARAS[1].length + 1, 'references/claude.md: the two launch paragraphs come right before "## Instruction loading"');
      const rootReadme = pre17Text(context, '@root/README.md') || '';
      check(squash(rootReadme).includes(squash(C16_BLOCKS.ROOT_README_PARA.join(' '))), 'the repository README tells a user of project-setup to start Claude Code at the target repository root');
    });
    await step('residuals stay explicit and separate from measurements: a start above or outside the target root can load the rule only after an initial read and L16 does not refuse such a start even after the rule loads; a nested .claude directory is a documented ambiguity (settings alone are no exemption); missing launch context neither establishes a refusal nor verifies controls; P1/P2 are model self-reports and the headless import observation is no TUI claim', async () => {
      const ref = squash(sourceText(context, CLAUDE_REF_REL) || '');
      for (const w of [
        'A start above or outside the target root can load that rule only after an initial read.',
        'That comparison does not refuse such a start even after the target rule loads.',
        'Missing launch context alone does not establish a subdirectory start or verified controls.',
        'The nearest loaded rule at or above the original start directory governs the comparison, so a worktree nested under another checkout is judged against its own rule.',
        'C16\'s released subdirectory refusal remains TO VERIFY on rc.3. It is an instruction mitigation, weaker than host enforcement.',
        'These are model self-reports, not a host API.',
        'Interactive TUI behavior is unverified.',
      ]) check(ref.includes(w), `references/claude.md states: ${clip(w)}`);
      const notes = squash(readText(skillPath(context, 'RELEASE-NOTES-3.0.0-rc.3.md')) || '');
      for (const w of [
        'A start above or outside the target root may load its instructions only after an initial read.',
        'The nearest-at-or-above comparison does not refuse that start even after the rule loads.',
        'Missing launch context alone neither establishes a refusal condition nor verifies controls.',
        'The launch refusal is weaker than host enforcement. Probes P1/P2 were model self-reports.',
        'Commit installed setup before worktree sessions so new worktrees have their own instructions.',
      ]) check(notes.includes(w), `the rc.3 notes state: ${clip(w)}`);
    });
    await step('the new prose is ASCII within 100 columns (every line of L16, the setup paragraph and every other new line), including prose in text and unlabeled fences; exactly 100 columns passes and 101 fails', async () => {
      const issues = newProseIssues(source, preRoot);
      check(issues.length === 0, 'every newly written line of the root template is ASCII and at most 100 columns (the preserved text excepted)', issues.slice(0, 6));
      const skill = sourceText(context, SKILL_REL); const skillPre = preText(fx, SKILL_REL);
      if (skill !== null && skillPre !== null) {
        const sIssues = newProseIssues(skill, skillPre);
        check(sIssues.length === 0, 'every newly written SKILL.md line is ASCII and at most 100 columns', sIssues.slice(0, 6));
      }
      const first = L16_LINES[0];
      const withLine = (n) => source.replace(first, () => 'q'.repeat(n));
      check(source.includes(first) && newProseIssues(withLine(100), preRoot).length === 0, 'the first L16 line at exactly 100 columns passes');
      check(source.includes(first) && newProseIssues(withLine(101), preRoot).some((i) => /is 101 columns/.test(i)), 'the same line at 101 columns fails');
      check(source.includes(first) && newProseIssues(source.replace(first, () => `${first.slice(0, 40)} ${String.fromCharCode(0x2014)} dash`), preRoot).some((i) => /not ASCII/.test(i)), 'a non-ASCII character in L16 fails');
      proveFenceRules(check, 'root template L16 prose', { text: source, baseline: preRoot, paragraph: squash(L16_BULLETS[0]) });
    });
    await step('negative controls on the installed text and the amendment: every sentence of L16 is removed and weakened and each guard is replaced by its opposite (rules that already fail are reported by their own assertion above), and L16 and D16 are rejected when missing, partial, duplicated, moved, altered, spaced differently, written with CRLF or found in the wrong file', async () => {
      const tried = proveRulesFail(check, 'root template L16', source, L16_RULES, evalL16);
      check(tried >= sentenceCount(L16_RULES), 'the in-memory variants cover every sentence of the frozen block (removal and weakening)', tried);
      proveOpposites(check, 'root template L16', source, L16_OPPOSITES, evalL16, L16_RULES);
      const otherFile = sourceText(context, SKILL_REL) || '';
      amendmentControls(check, 'root template L16', modelThrough(fx, ROOT_REL, 'L16') || '', AM16.L16, { movedBefore: SUBAGENT_BULLET_LINE, otherFileText: otherFile });
      amendmentControls(check, 'root template D16', modelThrough(fx, ROOT_REL, 'D16') || '', AM16.D16, { movedBefore: SUBAGENT_BULLET_LINE, otherFileText: otherFile });
    });
    flushProcessCount(context, 'A5-templates/C16/launch', mark);
  });
}


// ============================================ git-safe harness (R42/C16/grep and R41/C16/cat) ====
// Real Git behind the executor seam of the core: every call the core makes is recorded exactly as made, a call can be answered with an injected result (the seam row), and everything else runs the real git shell-free. Nothing here is taken from
// the code under test: the vectors, the prefix, the empty-tree ids and the error strings are restated from the plan.
const CORE_REL = 'assets/tools/git-safe-core.mjs';
const MAX_BYTES = 1048576;
const NULL_DEVICE = process.platform === 'win32' ? 'NUL' : '/dev/null';
const FIXED_PREFIX = [
  '--no-pager',
  '-c', 'core.fsmonitor=false', '-c', 'core.quotePath=true', '-c', 'submodule.recurse=false', '-c', 'log.showSignature=false', '-c', 'log.showNotes=false',
  '-c', 'log.follow=false', '-c', 'log.mailmap=false', '-c', 'log.diffMerges=off', '-c', 'diff.renames=false', '-c', 'diff.submodule=short',
  '-c', 'diff.relative=false', '-c', 'diff.noprefix=false', '-c', 'diff.mnemonicPrefix=false', '-c', 'diff.context=3', '-c', 'diff.interHunkContext=0',
  '-c', 'diff.algorithm=myers', '-c', 'diff.indentHeuristic=false', '-c', 'diff.suppressBlankEmpty=false', '-c', `diff.orderFile=${NULL_DEVICE}`, '-c', 'color.ui=false',
];
const E = {
  PATTERN: 'GIT_SAFE_PATTERN: grep pattern is not a valid extended regular expression (ERE); no result was emitted',
  GIT: 'GIT_SAFE_GIT: Git operation failed; no result was emitted',
  ARG_CAT: 'GIT_SAFE_ARGUMENT: unsupported arguments; supported: cat <commit> -- <path>; one path per call',
  ARG_GREP: 'GIT_SAFE_ARGUMENT: unsupported arguments; supported: grep <commit> <pattern> [-- <paths>]; pattern uses extended regular expressions (ERE)',
  SECRET: 'GIT_SAFE_SECRET: requested path is protected by the security policy',
  INPUT: 'GIT_SAFE_INPUT: invalid Git helper input',
  REVISION: 'GIT_SAFE_REVISION: revision does not resolve to a commit',
  POLICY_IO: 'GIT_SAFE_POLICY_IO: cannot read .ai/security-paths.json; refusing to run without a valid policy',
  ARG_LIMIT: 'GIT_SAFE_ARG_LIMIT: Git arguments exceed the safe invocation bound; narrow with -- <paths> or a smaller commit range. No result was emitted.',
  LIMIT_GREP: 'GIT_SAFE_LIMIT: output exceeds 1048576 bytes. Narrow with -- <paths> or a more selective pattern. No partial result was emitted; this review is not complete.',
  LIMIT_CAT: 'GIT_SAFE_LIMIT: output exceeds 1048576 bytes. Use grep with a more selective pattern or select a smaller file. No partial result was emitted; this review is not complete.',
};
const ARG_OTHER = { diff: 'diff <A>..<B>|<A>...<B> [--stat|--name-status|--name-only] [-- <paths>]', ls: 'ls <commit> [-- <paths>]', show: 'show <commit> [--stat|--name-status] [-- <paths>]' };
const GREP_COMMON = ['grep', '--no-textconv', '--no-color', '--full-name', '--no-column', '--no-heading', '--no-break'];
const V_GREP_E = (pattern, c, L, X) => [...GREP_COMMON, '-E', '-I', '-n', '-z', '-e', pattern, c, '--', ...L, ...X];
const V_PROBE = (pattern, tree) => [...GREP_COMMON, '-E', '-I', '-n', '-z', '-e', pattern, tree, '--'];
const LIT = (p) => `:(literal)${p}`;
const EXC = (p) => `:(exclude,literal)${p}`;
const isProbeOp = (op) => op[0] === 'grep' && op[op.length - 1] === '--' && op.length >= 3 && Object.values(EMPTY_TREE).includes(op[op.length - 2]);
const isContentGrep = (op) => op[0] === 'grep' && !isProbeOp(op);
const stderrLine = (message) => `git-safe: ${message}\n`;
const BIN0 = Buffer.alloc(0);

// The fixture tree: ASCII text plus one binary file and the protected .env that repeats every search word (it must never appear in a result).
const WALLET = ['export function validateTransfer(a) {', "  if (a < 0) throw new RangeError('negative');", '}', 'export function transfer(from, to) {', '  return wallet.ledger.record(from, to);', '}', ''].join('\n');
const FIXTURE_FILES = {
  'src/wallet.ledger.ts': WALLET,
  'src/other.ts': 'validateTransfer is only named here\n',
  'notes/version.txt': 'rc.1\nrc.2 line\nrc.d\n',
  'rx.txt': 'a|b literal\nonly-b\n',
  'neg.txt': '-needle here\n',
  'dd.txt': 'a -- b\n',
  'multi.txt': 'alpha\nbeta\n',
  'safe.txt': 'needle\n',
  'bin.dat': Buffer.from('validateTransfer\0\x01\n'),
  'empty.txt': '',
  '.env': 'validateTransfer transfer( RangeError wallet.ledger MARKER-PROTECTED\n',
};
const PROTECTED = new Set(['.env']);
const asBuf = (v) => (Buffer.isBuffer(v) ? v : Buffer.from(String(v), 'utf8'));
const byUtf8 = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
// The expected grep result computed independently from the fixture content: JS regular expression, unprotected text files only, in UTF-8 path order, framed <commit>:<path> NUL <line> NUL <text> LF.
function expectedGrep(files, commit, re, selectors = []) {
  const names = Object.keys(files).filter((n) => !PROTECTED.has(n) && !n.endsWith('.dat') && (selectors.length === 0 || selectors.some((s) => n === s || n.startsWith(`${s}/`)))).sort(byUtf8);
  const parts = [];
  for (const n of names) {
    const lines = asBuf(files[n]).toString('utf8').split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    lines.forEach((l, i) => { if (re.test(l)) parts.push(`${commit}:${n}\0${i + 1}\0${l}\n`); });
  }
  return Buffer.from(parts.join(''), 'utf8');
}
// A repository holding the fixture tree in the given object format (one commit).
function buildRepo(context, dir, format, extra = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const init = gitIn(context, dir, format === 64 ? ['init', '-q', '--object-format=sha256'] : ['init', '-q']);
  if (init.code !== 0) throw new Error(`git init failed: ${init.stderr}`);
  const files = { ...FIXTURE_FILES, ...extra };
  for (const [rel, data] of Object.entries(files)) putFile(path.join(dir, ...rel.split('/')), asBuf(data));
  gitOk(context, dir, ['add', '-A']);
  gitOk(context, dir, ['commit', '-qm', 'c16 fixture']);
  const id = gitOk(context, dir, ['rev-parse', 'HEAD']).stdout;
  return { root: dir, commit: id, files };
}
const REPO_CACHE = new Map();
function getRepo(context, format) {
  const key = `${context.tmp}:${format}`;
  if (!REPO_CACHE.has(key)) {
    const dir = scratchDir(context, `repo${format}`);
    // Exactly 1 MiB of framed output for one line (plan C16-16: exact 1 MiB succeeds, one byte over fails): the frame is <oid>:<path> NUL 1 NUL <text> LF.
    const frameOverhead = (id, p) => id.length + 1 + p.length + 1 + 2 + 1;
    const placeholder = 'x'.repeat(40);
    const lenFor = (p, total) => total - frameOverhead(format === 64 ? 'x'.repeat(64) : placeholder, p);
    const extra = { 'big/exact.txt': `${'a'.repeat(lenFor('big/exact.txt', MAX_BYTES))}\n`, 'big/over.txt': `${'b'.repeat(lenFor('big/over.txt', MAX_BYTES + 1))}\n` };
    REPO_CACHE.set(key, buildRepo(context, dir, format, extra));
  }
  return REPO_CACHE.get(key);
}
let CFG_SEQ = 0;
function isoEnv(context, extraConfig = '', extraEnv = {}) {
  const base = readText(context.env.GIT_CONFIG_GLOBAL) || '[user]\n\tname = Fixture\n\temail = fixture@example.invalid\n';
  const file = path.join(context.tmp, `c16-cfg-${++CFG_SEQ}.gitconfig`);
  fs.mkdirSync(context.tmp, { recursive: true });
  fs.writeFileSync(file, `${base}\n${extraConfig}\n`);
  return { ...context.env, GIT_CONFIG_GLOBAL: file, GIT_CONFIG_NOSYSTEM: '1', ...extraEnv };
}
// The executor of the seam: records, optionally answers, otherwise runs the real git exactly as the production executor does (no shell, stdin closed, bounded output, stderr dropped).
const res = (status, stdout = BIN0) => ({ status, signal: null, error: null, stdout: asBuf(stdout), overflow: false });
const R_SIGNAL = { status: null, signal: 'SIGKILL', error: null, stdout: Buffer.from('MARKER-LEAK-signal\n'), overflow: false };
const R_SPAWN = { status: null, signal: null, error: 'ENOENT MARKER-LEAK-spawn', stdout: BIN0, overflow: false };
const R_E2BIG = { status: null, signal: null, error: 'E2BIG', stdout: BIN0, overflow: false };
const R_OVERFLOW = { status: null, signal: null, error: null, stdout: BIN0, overflow: true };
function runReal(context, req) {
  countProcess(context);
  const r = spawnSync('git', req.argv, { cwd: req.cwd, env: req.env, encoding: 'buffer', shell: false, windowsHide: true, maxBuffer: 1 << 29, timeout: 120000 });
  if (r.error) return { status: null, signal: null, error: String(r.error.code || r.error.message || 'error'), stdout: BIN0, overflow: false };
  if (r.signal) return { status: null, signal: String(r.signal), error: null, stdout: BIN0, overflow: false };
  if (req.limit !== null && r.stdout.length > req.limit) return { status: null, signal: null, error: null, stdout: r.stdout.subarray(0, req.limit), overflow: true };
  return { status: r.status, signal: null, error: null, stdout: r.stdout, overflow: false };
}
function makeExec(context, on = () => undefined) {
  const log = [];
  const execute = async (req) => {
    const op = req.argv.slice(FIXED_PREFIX.length);
    const rec = { argv: req.argv.slice(), op, cwd: req.cwd, env: { ...req.env }, limit: req.limit, keys: Object.keys(req).sort(), prefixOk: eq(req.argv.slice(0, FIXED_PREFIX.length), FIXED_PREFIX), probe: isProbeOp(op), content: isContentGrep(op), index: log.length };
    log.push(rec);
    const injected = await on(rec, log);
    if (injected !== undefined) return injected;
    return runReal(context, req);
  };
  return { execute, log, probes: () => log.filter((r) => r.probe), contents: () => log.filter((r) => r.content), ops: () => log.slice(2).map((r) => r.op) };
}
async function loadCore(failures, context) {
  const core = await importOrFail(failures, pathToFileURL(skillPath(context, CORE_REL)).href, CORE_REL);
  if (!core) return null;
  const missing = ['main', 'parseGitSafeArgs', 'executeGitSafe', 'createGitSession', 'sanitizeGitEnvironment', 'SUPPORTED_FORMS', 'MAX_OUTPUT_BYTES', 'MAX_GIT_ARG_UNITS'].filter((n) => !(n in core));
  if (missing.length) { failures.push(`${CORE_REL} lacks exports: ${missing.join(', ')}`); return null; }
  return core;
}
const POLICY_TEXT = jsonText({ schema: 2, patterns: [{ anchor: 'any', glob: '**/.env*' }], projectPatterns: [] });
// main through the seam. Returns { r, ex, reads }.
async function runMain(core, context, repo, argv, { exec = null, env = null, policy = POLICY_TEXT, readFile = null } = {}) {
  const ex = exec || makeExec(context);
  const reads = [];
  const rf = readFile || (async (p) => { reads.push(p); return Buffer.from(policy); });
  const r = await core.main(argv, { cwd: repo.root, env: env || context.env, execute: ex.execute, readFile: rf });
  return { r, ex, reads };
}
function expectMain(check, label, r, { exit, stdout = BIN0, stderr = '' }) {
  check(r !== null && typeof r === 'object' && eq(Object.keys(r).sort(), ['exitCode', 'stderr', 'stdout']), `${label}: the result holds exactly exitCode, stdout, stderr`, r && Object.keys(r));
  if (!r) return;
  check(r.exitCode === exit, `${label}: exit code ${exit}`, r.exitCode);
  check(Buffer.isBuffer(r.stdout) && Buffer.compare(r.stdout, asBuf(stdout)) === 0, `${label}: stdout is exactly the expected bytes`, { got: r.stdout && r.stdout.length, want: asBuf(stdout).length, head: Buffer.isBuffer(r.stdout) ? r.stdout.subarray(0, 120).toString('utf8') : r.stdout });
  check(typeof r.stderr === 'string' && r.stderr === stderr, `${label}: stderr is exactly ${show(stderr.slice(0, 160))}`, r.stderr);
}
const failMain = (message) => ({ exit: 2, stdout: BIN0, stderr: stderrLine(message) });
// No byte of the pattern, the revision, a path, an exception text, Git output or a diagnostic marker may be in an error.
const noLeak = (check, label, r, words) => { for (const w of words) check(!String(r.stderr).includes(w) && !Buffer.from(r.stdout).includes(Buffer.from(w)), `${label}: the output holds no ${show(w)}`); };
// Calls the core made: the exact fixed prefix, exactly argv, cwd, env and limit.
function checkCalls(check, label, ex, repo, env) {
  const want = Object.entries(env).filter(([k]) => !/^(GIT_CONFIG|GIT_CONFIG_PARAMETERS|GIT_CONFIG_COUNT|GIT_EXTERNAL_DIFF|GIT_DIFF_OPTS|GIT_PAGER|GIT_DIR|GIT_WORK_TREE|GIT_COMMON_DIR|GIT_INDEX_FILE|GIT_OBJECT_DIRECTORY|GIT_ALTERNATE_OBJECT_DIRECTORIES|GIT_NAMESPACE|GIT_PREFIX|GIT_ATTR_SOURCE|GIT_REPLACE_REF_BASE|GIT_NO_REPLACE_OBJECTS|GIT_TERMINAL_PROMPT|GIT_OPTIONAL_LOCKS|GIT_LITERAL_PATHSPECS|GIT_GLOB_PATHSPECS|GIT_NOGLOB_PATHSPECS|GIT_ICASE_PATHSPECS|PAGER)$/i.test(k) && !/^GIT_CONFIG_(KEY|VALUE)_[0-9]+$/i.test(k));
  ex.log.forEach((c, i) => {
    check(c.prefixOk, `${label}: call ${i} carries the exact fixed prefix (no grep-specific configuration pairs)`, c.argv.slice(0, 6));
    check(eq(c.keys, ['argv', 'cwd', 'env', 'limit']), `${label}: call ${i} receives exactly argv, cwd, env, limit`, c.keys);
    for (const [k, v] of want) check(c.env[k] === v, `${label}: call ${i} keeps the preserved environment variable ${k}`);
    check(c.env.GIT_PAGER === 'cat' && c.env.GIT_TERMINAL_PROMPT === '0' && c.env.GIT_OPTIONAL_LOCKS === '0' && c.env.GIT_NO_REPLACE_OBJECTS === '1', `${label}: call ${i} has the five fixed environment values`);
    if (i >= 2) check(path.resolve(c.cwd) === path.resolve(repo.root), `${label}: call ${i} runs in the repository root`, c.cwd);
    check(c.limit === (c.content || c.probe ? MAX_BYTES : null) || (c.op[0] === 'merge-base' && c.limit !== undefined), `${label}: call ${i} has its limit by kind (content and probe 1048576, others none)`, c.limit);
  });
}

// ============================================ R42/C16/grep ====
// Plan C16-8, C16-16 item 2, C16-21: grep is an extended regular expression (-E, the plan's only vector change), a content-free probe against the empty tree of the resolved object format classifies an invalid expression after a status-128 content call
// with empty stdout (GIT_SAFE_PATTERN), every other outcome of that probe stays GIT_SAFE_GIT, no probe happens for any other failure, the fixed prefix and the byte bounds are unchanged, and no repository byte, pattern or marker ever enters an error.
const WALLET_RE = /validateTransfer|transfer\(|RangeError|wallet.ledger/;
const ERE_PROBE_PATTERNS = ['transfer(', 'a{2', '*x', '['];
async function grepGroup(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    if (!core) return;
    let repo; let repo256;
    try { repo = getRepo(context, 40); repo256 = getRepo(context, 64); } catch (e) { failures.push(`cannot build the real Git fixtures (SHA-1 and SHA-256): ${errMsg(e)}`); return; }
    const C = repo.commit; const C2 = repo256.commit;
    check(/^[0-9a-f]{40}$/.test(C) && /^[0-9a-f]{64}$/.test(C2), 'the two fixture repositories resolve to a 40 and a 64 character commit id', { sha1: C.length, sha256: C2.length });
    const grepOut = async (rp, pattern, selectors = [], o = {}) => { const run = await runMain(core, context, rp, ['grep', rp.commit, pattern, ...(selectors.length ? ['--', ...selectors] : [])], o); return run; };
    await step('real Git, ERE semantics: validateTransfer|transfer(escaped)|RangeError|wallet.ledger succeeds on the safe fixture content with exactly the independently computed framed bytes and never returns the protected .env; validateTransfer|transfer finds both names; no probe happens for a successful search', async () => {
      const p1 = `validateTransfer|transfer${BSL}(|RangeError|wallet.ledger`;
      const a = await grepOut(repo, p1);
      expectMain(check, 'the measured four-name search', a.r, { exit: 0, stdout: expectedGrep(repo.files, C, WALLET_RE) });
      check(a.ex.probes().length === 0 && a.ex.contents().length === 1 && eq(a.ex.contents()[0].op, V_GREP_E(p1, C, [], [EXC('.env')])), 'one content call with the pinned -E vector and the protected exclusion, and no probe', a.ex.ops().map((o) => o.slice(0, 12)));
      check(!a.r.stdout.includes(Buffer.from('MARKER-PROTECTED')), 'no protected byte appears in the result');
      const b = await grepOut(repo, 'validateTransfer|transfer');
      expectMain(check, 'validateTransfer|transfer', b.r, { exit: 0, stdout: expectedGrep(repo.files, C, /validateTransfer|transfer/) });
      check(b.r.stdout.includes(Buffer.from('validateTransfer(a)')) && b.r.stdout.includes(Buffer.from('function transfer(from')), 'both names are found (basic regular expressions returned an empty success for this alternation)');
      checkCalls(check, 'four-name search', a.ex, repo, context.env);
    });
    await step('real Git: the BRE-to-ERE meaning change is visible: a|b alternates (both lines of rx.txt) and a-backslash-bar-b matches only the literal bar; transfer( is invalid ERE (PATTERN, exit 2) and the corrected transfer-backslash-( succeeds', async () => {
      const alt = await grepOut(repo, 'a|b', ['rx.txt']);
      expectMain(check, 'a|b', alt.r, { exit: 0, stdout: expectedGrep(repo.files, C, /a|b/, ['rx.txt']) });
      check(alt.r.stdout.includes(Buffer.from('only-b')), 'a|b alternation also matches the second line');
      const lit = await grepOut(repo, `a${BSL}|b`, ['rx.txt']);
      expectMain(check, 'a-backslash-bar-b', lit.r, { exit: 0, stdout: Buffer.from(`${C}:rx.txt\0` + '1\0' + 'a|b literal\n') });
      const bad = await grepOut(repo, 'transfer(', ['src/wallet.ledger.ts']);
      expectMain(check, 'transfer( on visible content', bad.r, failMain(E.PATTERN));
      check(bad.ex.contents().length === 1 && bad.ex.probes().length === 1 && eq(bad.ex.probes()[0].op, V_PROBE('transfer(', EMPTY_TREE[40])) && bad.ex.probes()[0].index === bad.ex.contents()[0].index + 1, 'one content call, then exactly one probe against the SHA-1 empty tree', bad.ex.ops().map((o) => o.slice(0, 12)));
      const fixed = await grepOut(repo, `transfer${BSL}(`, ['src/wallet.ledger.ts']);
      expectMain(check, 'the corrected transfer-backslash-(', fixed.r, { exit: 0, stdout: Buffer.from(`${C}:src/wallet.ledger.ts\0` + `4\0` + 'export function transfer(from, to) {\n') });
      check(fixed.ex.probes().length === 0, 'the corrected search needs no probe');
      for (const p of ERE_PROBE_PATTERNS.slice(1)) { const r = await grepOut(repo, p, ['multi.txt']); expectMain(check, `invalid ERE ${show(p)}`, r.r, failMain(E.PATTERN)); check(r.ex.probes().length === 1, `${show(p)}: one probe`); }
    });
    await step('real Git: rc-backslash-dot-backslash-d is not a digit class (it does not find the fixture digit) while rc-backslash-dot-[0-9] finds rc.1 and rc.2; the empty pattern, a leading-dash pattern, the pattern --, a newline-containing pattern and a NUL pattern keep their specified argument behavior', async () => {
      const digit = await grepOut(repo, `rc${BSL}.[0-9]`, ['notes/version.txt']);
      expectMain(check, 'rc.[0-9]', digit.r, { exit: 0, stdout: Buffer.from(`${C}:notes/version.txt\0` + '1\0' + 'rc.1\n' + `${C}:notes/version.txt\0` + '2\0' + 'rc.2 line\n') });
      const d = await grepOut(repo, `rc${BSL}.${BSL}d`, ['notes/version.txt']);
      check(d.r.exitCode === 0 && Buffer.compare(d.r.stdout, digit.r.stdout) !== 0 && !d.r.stdout.includes(Buffer.from('rc.1')), 'rc-backslash-dot-backslash-d does not stand in for the digit class: its result differs and holds no digit line', d.r.stdout.toString('utf8'));
      const noBig = ['src', 'notes', 'rx.txt', 'neg.txt', 'dd.txt', 'multi.txt', 'safe.txt', 'empty.txt', 'bin.dat', '.env'];
      const all = await grepOut(repo, '', noBig);
      expectMain(check, 'empty pattern', all.r, { exit: 0, stdout: expectedGrep(repo.files, C, /^/, noBig) });
      const neg = await grepOut(repo, '-needle', ['neg.txt']);
      expectMain(check, '-needle', neg.r, { exit: 0, stdout: Buffer.from(`${C}:neg.txt\0` + '1\0' + '-needle here\n') });
      const dd = await grepOut(repo, '--', ['dd.txt']);
      expectMain(check, 'the pattern --', dd.r, { exit: 0, stdout: Buffer.from(`${C}:dd.txt\0` + '1\0' + 'a -- b\n') });
      const nl = await grepOut(repo, 'alpha\nbeta', ['multi.txt']);
      check(nl.ex.contents().length === 1 && nl.ex.contents()[0].op[nl.ex.contents()[0].op.indexOf('-e') + 1] === 'alpha\nbeta', 'a newline-containing pattern reaches Git verbatim after -e (PLAN-GAP: the plan names it without pinning Git semantics; the result below is the real Git result on this host)');
      check(nl.r.exitCode === 0 || nl.r.exitCode === 2, 'a newline pattern is accepted by the parser (the result is a Git result, not an argument error)', nl.r.stderr);
      const nul = await runMain(core, context, repo, ['grep', C, 'a\u0000b']);
      expectMain(check, 'NUL pattern', nul.r, failMain(E.ARG_GREP));
      check(nul.ex.log.length === 0 && nul.reads.length === 0, 'a NUL pattern is rejected by the parser before any session, executor call or policy read', { calls: nul.ex.log.length, reads: nul.reads.length });
      const direct = await core.createGitSession({ cwd: repo.root, env: context.env, execute: makeExec(context).execute, readFile: async () => Buffer.from(POLICY_TEXT) });
      let thrown = null;
      try { await core.executeGitSafe({ subcommand: 'grep', revisions: [C], paths: [], format: null, patch: false, maxCount: null, pattern: 'a\u0000b' }, direct); } catch (e) { thrown = e; }
      check(thrown !== null && thrown.code === 'GIT_SAFE_INPUT' && thrown.message === E.INPUT, 'a hand-built request with a NUL pattern remains GIT_SAFE_INPUT', thrown && thrown.message);
    });
    await step('selection boundaries: a missing selector beside an existing one does not fail; no match and an all-protected or empty selection are empty successes without a probe (an invalid expression on a protected-only selection makes no compilation claim); an invalid expression on a visible selection is exit 2 with empty stdout and the exact PATTERN line', async () => {
      const miss = await grepOut(repo, 'RangeError', ['missing.txt', 'src/wallet.ledger.ts']);
      expectMain(check, 'missing selector beside an existing one', miss.r, { exit: 0, stdout: Buffer.from(`${C}:src/wallet.ledger.ts\0` + '2\0' + "  if (a < 0) throw new RangeError('negative');\n") });
      const none = await grepOut(repo, 'zzz-no-match');
      expectMain(check, 'no match', none.r, { exit: 0, stdout: BIN0 });
      check(none.ex.probes().length === 0, 'a no-match result makes no probe');
      const prot = await grepOut(repo, '[', ['.env']);
      expectMain(check, 'all-protected selection with an invalid expression', prot.r, { exit: 0, stdout: BIN0 });
      check(prot.ex.contents().length === 0 && prot.ex.probes().length === 0, 'no content call and no probe for an all-protected selection');
      const absent = await grepOut(repo, '[', ['no-such-path']);
      expectMain(check, 'a selector that selects nothing with an invalid expression', absent.r, { exit: 0, stdout: BIN0 });
      check(absent.ex.contents().length === 0 && absent.ex.probes().length === 0, 'no content call and no probe when nothing is selected');
      const bin = await grepOut(repo, 'validateTransfer', ['bin.dat']);
      expectMain(check, 'a binary file is omitted (-I)', bin.r, { exit: 0, stdout: BIN0 });
      const bad = await grepOut(repo, '[', ['safe.txt']);
      expectMain(check, 'invalid ERE on a visible selection', bad.r, failMain(E.PATTERN));
    });
    await step('the empty tree is chosen by the resolved commit length: the SHA-1 repository probes 4b825dc6... and the SHA-256 repository 6ef19b41...; the probe vector is exactly the plan command after the fixed prefix with the 1048576 limit, in the repository root, with the sanitized environment of the content call; the other format\'s empty tree answers 128 for every pattern, which is why the selection is mandatory (real Git, one process per case)', async () => {
      for (const [rp, tree, other] of [[repo, EMPTY_TREE[40], EMPTY_TREE[64]], [repo256, EMPTY_TREE[64], EMPTY_TREE[40]]]) {
        const label = rp === repo ? 'SHA-1' : 'SHA-256';
        const r = await grepOut(rp, 'transfer(', ['src/wallet.ledger.ts']);
        expectMain(check, `${label} transfer(`, r.r, failMain(E.PATTERN));
        const probe = r.ex.probes();
        check(probe.length === 1 && eq(probe[0].op, V_PROBE('transfer(', tree)) && probe[0].limit === MAX_BYTES && !probe[0].op.includes(other), `${label}: the probe is the plan command over ${tree.slice(0, 8)}...`, probe.map((p) => p.op.slice(-4)));
        check(probe.length === 1 && probe[0].prefixOk && path.resolve(probe[0].cwd) === path.resolve(rp.root) && eq(probe[0].env, r.ex.contents()[0].env), `${label}: the probe uses the fixed prefix, the repository root and the content call's sanitized environment`);
        check(!probe[0].op.includes('--cached') && !probe[0].op.includes('--no-index') && probe[0].op.indexOf('--') === probe[0].op.length - 1, `${label}: the probe has no selectors, exclusions or index use`);
        const ok = await grepOut(rp, `transfer${BSL}(`, ['src/wallet.ledger.ts']);
        expectMain(check, `${label} corrected pattern`, ok.r, { exit: 0, stdout: Buffer.from(`${rp.commit}:src/wallet.ledger.ts\0` + '4\0' + 'export function transfer(from, to) {\n') });
        for (const p of ['transfer(', 'a{2', 'transfer', 'x|y']) {
          const w = gitIn(context, rp.root, [...FIXED_PREFIX, ...V_PROBE(p, other)]);
          check(w.code === 128 && w.out.length === 0, `${label}: the other format's empty tree exits 128 with empty stdout for ${show(p)}`, w.code);
          const m = gitIn(context, rp.root, [...FIXED_PREFIX, ...V_PROBE(p, tree)]);
          check(m.out.length === 0 && m.code === (p === 'transfer(' || p === 'a{2' ? 128 : 1), `${label}: the matching empty tree exits ${p === 'transfer(' || p === 'a{2' ? 128 : 1} for ${show(p)}`, m.code);
        }
      }
    });
    const mainFor = (argv, rp = repo, o = {}) => runMain(core, context, rp, argv, o);
    const VALID = ['grep', C, 'transfer', '--', 'src/wallet.ledger.ts'];
    await step('the complete probe outcome table (seam: the content call answers status 128 with empty stdout, the probe answers as listed): only probe status 128 with empty stdout and no signal, error or overflow is GIT_SAFE_PATTERN; status 1, status 0 (empty or with stdout), any nonempty stdout (also with status 128), any other status, a signal, a spawn error, an argument-limit error, overflow, oversized stdout, an invalid result, a throw and a rejection all stay the unchanged GIT_SAFE_GIT; exactly one probe each; no marker, pattern or revision in the error', async () => {
      const throwing = Symbol('throw');
      const rows = [
        ['128 empty', res(128), E.PATTERN], ['1 empty', res(1), E.GIT], ['0 empty', res(0), E.GIT], ['0 with stdout', res(0, 'MARKER-LEAK-out\n'), E.GIT],
        ['128 with stdout', res(128, 'MARKER-LEAK-out\n'), E.GIT], ['1 with stdout', res(1, 'MARKER-LEAK-out\n'), E.GIT], ['2', res(2), E.GIT], ['127', res(127), E.GIT], ['255', res(255), E.GIT],
        ['a signal', R_SIGNAL, E.GIT], ['a spawn error', R_SPAWN, E.GIT], ['E2BIG', R_E2BIG, E.GIT], ['overflow', R_OVERFLOW, E.GIT],
        ['oversized stdout', res(128, Buffer.alloc(MAX_BYTES + 1, 0x61)), E.GIT], ['an invalid result (missing keys)', { status: 128 }, E.GIT], ['an invalid result (status not an integer)', { ...res(128), status: '128' }, E.GIT],
        ['an invalid result (stdout not a Buffer)', { ...res(128), stdout: 'x' }, E.GIT], ['the executor throws', throwing, E.GIT],
      ];
      for (const [label, answer, want] of rows) {
        const ex = makeExec(context, (rec) => {
          if (rec.content) return res(128);
          if (rec.probe) { if (answer === throwing) throw new Error('MARKER-LEAK-throw'); return answer; }
          return undefined;
        });
        const run = await mainFor(VALID, repo, { exec: ex });
        expectMain(check, `probe ${label}`, run.r, failMain(want));
        check(ex.contents().length === 1 && ex.probes().length === 1 && eq(ex.probes()[0].op, V_PROBE('transfer', EMPTY_TREE[40])), `probe ${label}: exactly one content call and one probe`, ex.log.map((l) => l.op[0]));
        noLeak(check, `probe ${label}`, run.r, ['MARKER-LEAK', 'transfer', 'src/wallet', C]);
      }
      const reject = makeExec(context, (rec) => { if (rec.content) return res(128); if (rec.probe) return Promise.reject(new Error('MARKER-LEAK-reject')); return undefined; });
      const rr = await mainFor(VALID, repo, { exec: reject });
      expectMain(check, 'probe: a rejected promise', rr.r, failMain(E.GIT));
      noLeak(check, 'probe: a rejected promise', rr.r, ['MARKER-LEAK']);
      const tail = makeExec(context, (rec) => { if (rec.content) return res(128); if (rec.probe) return res(128); return undefined; });
      const t64 = await mainFor(['grep', C2, 'transfer', '--', 'src/wallet.ledger.ts'], repo256, { exec: tail });
      expectMain(check, 'a 64 character resolved id with probe 128/empty', t64.r, failMain(E.PATTERN));
      check(tail.probes().length === 1 && eq(tail.probes()[0].op, V_PROBE('transfer', EMPTY_TREE[64])), 'the SHA-256 id selects the SHA-256 empty tree in the seam too', tail.probes().map((p) => p.op.slice(-3)));
      const real = makeExec(context, (rec) => (rec.content ? res(128) : undefined));
      const realProbe = await mainFor(VALID, repo, { exec: real });
      expectMain(check, 'a valid pattern with an injected content-stage 128 and the real empty-tree status 1', realProbe.r, failMain(E.GIT));
      const realBad = makeExec(context, (rec) => (rec.content ? res(128) : undefined));
      const realBadRun = await mainFor(['grep', C, 'a{2', '--', 'multi.txt'], repo, { exec: realBad });
      expectMain(check, 'an invalid pattern with an injected content-stage 128 and the real probe 128', realBadRun.r, failMain(E.PATTERN));
    });
    await step('no probe after any other failure: a successful call, status 1 (no match), status 2, nonempty status 128, a signal, a spawn failure, overflow, a content-stage throw or invalid result, an argument-limit failure, and every policy, revision, version, repository and inventory failure; the original failure keeps its own code', async () => {
      const cases = [
        ['status 2', (rec) => (rec.content ? res(2, 'MARKER-LEAK-out\n') : undefined), E.GIT],
        ['nonempty status 128', (rec) => (rec.content ? res(128, 'MARKER-LEAK-out\n') : undefined), E.GIT],
        ['status 1 with stdout', (rec) => (rec.content ? res(1, 'MARKER-LEAK-out\n') : undefined), E.GIT],
        ['a signal', (rec) => (rec.content ? R_SIGNAL : undefined), E.GIT],
        ['a spawn failure', (rec) => (rec.content ? R_SPAWN : undefined), E.GIT],
        ['an argument-limit error from the executor', (rec) => (rec.content ? R_E2BIG : undefined), E.ARG_LIMIT],
        ['overflow', (rec) => (rec.content ? R_OVERFLOW : undefined), E.LIMIT_GREP],
        ['a content-stage throw', (rec) => { if (rec.content) throw new Error('MARKER-LEAK-throw'); return undefined; }, E.GIT],
        ['a content-stage invalid result', (rec) => (rec.content ? { status: 128 } : undefined), E.GIT],
        ['an inventory failure', (rec) => (rec.op[0] === 'ls-tree' ? res(128) : undefined), E.GIT],
      ];
      for (const [label, on, want] of cases) {
        const ex = makeExec(context, on);
        const run = await mainFor(VALID, repo, { exec: ex });
        expectMain(check, label, run.r, failMain(want));
        check(ex.probes().length === 0, `${label}: no probe`, ex.probes().length);
        noLeak(check, label, run.r, ['MARKER-LEAK']);
      }
      const ok = makeExec(context);
      const okRun = await mainFor(VALID, repo, { exec: ok });
      expectMain(check, 'a successful search', okRun.r, { exit: 0, stdout: Buffer.from(`${C}:src/wallet.ledger.ts\0` + '4\0' + 'export function transfer(from, to) {\n') });
      check(ok.probes().length === 0, 'a successful search makes no probe');
      const missingRev = makeExec(context);
      const rv = await mainFor(['grep', 'no-such-revision', '[', '--', 'safe.txt'], repo, { exec: missingRev });
      expectMain(check, 'an unknown revision with an invalid expression', rv.r, failMain(E.REVISION));
      check(missingRev.probes().length === 0 && missingRev.contents().length === 0, 'a revision failure makes no content call and no probe');
      const noPolicy = makeExec(context);
      const np = await mainFor(VALID, repo, { exec: noPolicy, readFile: async () => { throw new Error('MARKER-LEAK-io'); } });
      expectMain(check, 'an unreadable policy', np.r, failMain(E.POLICY_IO));
      check(noPolicy.probes().length === 0 && noPolicy.contents().length === 0, 'a policy failure makes no content call and no probe');
      const badVersion = makeExec(context, (rec) => (rec.op[0] === '--version' ? res(0, 'git version 2.30.0\n') : undefined));
      const bv = await mainFor(VALID, repo, { exec: badVersion });
      expectMain(check, 'an unsupported Git version', bv.r, failMain('GIT_SAFE_VERSION: Git 2.31 or later is required'));
      check(badVersion.probes().length === 0, 'a version failure makes no probe');
      const long = 'x'.repeat(13000);
      const lim = makeExec(context);
      const lr = await mainFor(['grep', C, long, '--', 'safe.txt'], repo, { exec: lim });
      expectMain(check, 'an argument beyond the invocation bound', lr.r, failMain(E.ARG_LIMIT));
      check(lim.contents().length === 0 && lim.probes().length === 0, 'the argument bound fails before any content call and makes no probe (the content vector bound is unchanged: -E has the unit count of -G)');
      const unitsOf = (argv) => argv.reduce((sum, a) => sum + 2 * a.length + 3, 0);
      const V_G = ['grep', '--no-textconv', '--no-color', '--full-name', '--no-column', '--no-heading', '--no-break', '-G', '-I', '-n', '-z', '-e', 'p', C, '--'];
      check(unitsOf(V_GREP_E('p', C, [], [])) === unitsOf(V_G), 'the content vector spends zero extra argument units for -E and the fixed prefix adds none', unitsOf(V_GREP_E('p', C, [], [])) - unitsOf(V_G));
    });
    await step('every other subcommand keeps the unchanged GIT_SAFE_GIT text at its content stage, never PATTERN and never a probe, and a missing cat path is GIT_SAFE_GIT (real Git)', async () => {
      for (const argv of [['diff', `${C}..${C}`], ['log', C], ['show', C], ['cat', C, '--', 'safe.txt']]) {
        const ex = makeExec(context, (rec) => (rec.content || rec.op[0] === 'diff' || rec.op[0] === 'log' || rec.op[0] === 'show' || rec.op[0] === 'cat-file' ? res(128) : undefined));
        const run = await mainFor(argv, repo, { exec: ex });
        check(run.r.exitCode === 2 && run.r.stderr === stderrLine(E.GIT) && run.r.stdout.length === 0, `${argv[0]}: an injected failure is the exact unchanged GIT_SAFE_GIT`, run.r.stderr);
        check(ex.probes().length === 0, `${argv[0]}: no probe`);
      }
      const ls = makeExec(context, (rec) => (rec.op[0] === 'ls-tree' ? res(128) : undefined));
      const lr = await mainFor(['ls', C], repo, { exec: ls });
      expectMain(check, 'ls inventory failure', lr.r, failMain(E.GIT));
      const missing = await mainFor(['cat', C, '--', 'no-such-file.txt']);
      expectMain(check, 'cat of a missing path', missing.r, failMain(E.GIT));
    });
    await step('valid conflicting settings do not change ERE or the output framing (grep.patternType basic and fixed, grep.extendedRegexp false, grep.column, grep.lineNumber false), and the fixed prefix is the whole configuration (no grep-specific pair on either call)', async () => {
      for (const cfg of ['[grep]\n\tpatternType = basic\n\tcolumn = true\n\tlineNumber = false\n', '[grep]\n\tpatternType = fixed\n\textendedRegexp = false\n\tlineNumber = false\n', '[grep]\n\textendedRegexp = false\n\tpatternType = extended\n']) {
        const env = isoEnv(context, cfg);
        const a = await grepOut(repo, 'a|b', ['rx.txt'], { env });
        expectMain(check, `a|b under ${show(cfg).slice(0, 40)}`, a.r, { exit: 0, stdout: expectedGrep(repo.files, C, /a|b/, ['rx.txt']) });
        const b = await grepOut(repo, 'transfer(', ['src/wallet.ledger.ts'], { env });
        expectMain(check, `transfer( under ${show(cfg).slice(0, 40)}`, b.r, failMain(E.PATTERN));
        checkCalls(check, 'conflicting settings', b.ex, repo, env);
        check(b.ex.log.every((c) => !c.argv.slice(0, FIXED_PREFIX.length).some((x) => /^grep\./.test(x))), 'no grep.* pair in the fixed prefix');
      }
    });
    await step('malformed configuration is a documented residual (C16-R1): with grep.threads=bogus in the isolated global configuration even a valid pattern on visible content makes both the content call and the empty-tree call exit 128 with empty stdout, so the result is exit 2, empty stdout and exactly the PATTERN diagnostic; this is a known misclassification, not proof that the pattern is invalid, and repeating the call repeats the stop (no content, no fallback)', async () => {
      const env = isoEnv(context, '[grep]\n\tthreads = bogus\n');
      for (let i = 0; i < 2; i++) {
        const run = await grepOut(repo, 'transfer', ['src/wallet.ledger.ts'], { env });
        expectMain(check, `valid pattern under grep.threads=bogus (attempt ${i + 1}, the known misclassification residual)`, run.r, failMain(E.PATTERN));
        check(run.ex.contents().length === 1 && run.ex.probes().length === 1, 'one content call and one probe, no further call', run.ex.ops().map((o) => o.slice(0, 3)));
      }
      const direct = gitIn(context, repo.root, ['-c', 'submodule.recurse=false', ...V_PROBE('transfer', EMPTY_TREE[40])], { env });
      check(direct.code === 128 && direct.out.length === 0, 'real Git itself fails the valid pattern on the empty tree under the malformed configuration (the plan\'s premise)', direct.code);
    });
    await step('bounds are unchanged through the production executor: exactly 1048576 bytes of framed output succeeds with the whole result, one byte over fails as GIT_SAFE_LIMIT with the narrowing guidance and no partial output; a one-megabyte result is returned without a probe', async () => {
      const exact = await core.main(['grep', C, 'a', '--', 'big/exact.txt'], { cwd: repo.root, env: context.env, readFile: async () => Buffer.from(POLICY_TEXT) });
      check(exact.exitCode === 0 && exact.stdout.length === MAX_BYTES && exact.stderr === '' && exact.stdout.subarray(0, 60).toString('utf8').startsWith(`${C}:big/exact.txt`), 'exactly 1 MiB of framed output succeeds whole', { exit: exact.exitCode, len: exact.stdout.length, err: exact.stderr.slice(0, 120) });
      const over = await core.main(['grep', C, 'b', '--', 'big/over.txt'], { cwd: repo.root, env: context.env, readFile: async () => Buffer.from(POLICY_TEXT) });
      expectMain(check, 'one byte over', over, failMain(E.LIMIT_GREP));
      const e2 = await core.main(['grep', C2, 'a', '--', 'big/exact.txt'], { cwd: repo256.root, env: context.env, readFile: async () => Buffer.from(POLICY_TEXT) });
      check(e2.exitCode === 0 && e2.stdout.length === MAX_BYTES, 'the SHA-256 repository returns its exact 1 MiB result too (the frame is 24 bytes longer, the file shorter)', { exit: e2.exitCode, len: e2.stdout.length });
    });
    await step('diagnostics never carry repository bytes: with marker bytes in the pattern, the revision-like spelling and Git output, the PATTERN and GIT errors hold only their frozen text (also through main and its stderr line)', async () => {
      const marker = 'MARKER-LEAK-pattern(';
      const ex = makeExec(context, (rec) => (rec.content ? res(128, '') : rec.probe ? res(128, '') : undefined));
      const run = await mainFor(['grep', C, marker, '--', 'safe.txt'], repo, { exec: ex });
      expectMain(check, 'marker pattern', run.r, failMain(E.PATTERN));
      noLeak(check, 'marker pattern', run.r, ['MARKER-LEAK', 'safe.txt']);
      const session = await core.createGitSession({ cwd: repo.root, env: context.env, execute: makeExec(context, (rec) => (rec.content || rec.probe ? res(128) : undefined)).execute, readFile: async () => Buffer.from(POLICY_TEXT) });
      let err = null;
      try { await core.executeGitSafe(core.parseGitSafeArgs(['grep', C, marker, '--', 'safe.txt']), session); } catch (e) { err = e; }
      check(err !== null && err.code === 'GIT_SAFE_PATTERN' && err.message === E.PATTERN && !err.message.includes('MARKER'), 'the thrown error has the own code GIT_SAFE_PATTERN and exactly the frozen message', err && err.message);
    });
    await step('the supported grammar strings and the argument diagnostics: SUPPORTED_FORMS is exactly the six frozen strings, cat and grep alone append their guidance, every other command keeps its exact text, and the exports and fixed numbers are unchanged', async () => {
      check(eq({ ...core.SUPPORTED_FORMS }, { diff: ARG_OTHER.diff, log: 'log [-p] [--oneline] [-n<k>|--max-count=<k>] <rev>|<A>..<B>|<A>...<B> [-- <paths>]', show: ARG_OTHER.show, cat: 'cat <commit> -- <path>', ls: ARG_OTHER.ls, grep: 'grep <commit> <pattern> [-- <paths>]', head: 'head' }) && Object.isFrozen(core.SUPPORTED_FORMS), 'SUPPORTED_FORMS is byte-for-byte the frozen object: the six C16 strings unchanged plus exactly one further key, head (C17-F1)');
      check(core.MAX_OUTPUT_BYTES === MAX_BYTES && core.MAX_GIT_ARG_UNITS === 24000, 'the 1048576 output bound and the 24000 argument bound are unchanged');
      for (const [argv, want] of [[['cat', 'c', '--'], E.ARG_CAT], [['grep', 'c'], E.ARG_GREP], [['diff', 'a..b', '--cached'], `GIT_SAFE_ARGUMENT: unsupported arguments; supported: ${ARG_OTHER.diff}`], [['ls', 'c', '--'], `GIT_SAFE_ARGUMENT: unsupported arguments; supported: ${ARG_OTHER.ls}`], [['show', 'c', '--format=short'], `GIT_SAFE_ARGUMENT: unsupported arguments; supported: ${ARG_OTHER.show}`]]) {
        let e = null; try { core.parseGitSafeArgs(argv); } catch (x) { e = x; }
        check(e !== null && e.code === 'GIT_SAFE_ARGUMENT' && e.message === want, `${argv[0]}: the exact argument diagnostic`, e && e.message);
      }
    });
    flushProcessCount(context, 'R42/C16/grep', mark);
  });
}

// ============================================ R41/C16/cat ====
// Plan C16-8 and C16-16 item 3: cat stays exactly one path per call; a second path, duplicates and a safe-plus-protected pair fail as GIT_SAFE_ARGUMENT before any session, executor call or policy read (cardinality before deduplication and before the
// secret check); one protected path is still GIT_SAFE_SECRET; one safe path returns its raw bytes under the unchanged 1 MiB bound; a missing path is the unchanged GIT_SAFE_GIT and the instructions say to confirm uncertain paths with ls first.
const CAT_GUIDANCE_RULE = 'cat accepts exactly one path per call. You MUST confirm an uncertain path with ls before cat, because cat of a missing path returns GIT_SAFE_GIT and stops';
async function catGroup(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const core = await loadCore(failures, context);
    if (!core) return;
    let repo;
    try { repo = getRepo(context, 40); } catch (e) { failures.push(`cannot build the real Git fixture: ${errMsg(e)}`); return; }
    const C = repo.commit;
    await step('the fixture rows A32 and A33 (two safe paths; a safe and a protected path) are refused cat rows in the plan\'s order after A31, and cat is refused for every path count other than one with the exact guidance text before any session, executor call or policy read, through main and through the parser', async () => {
      const f = readJson(skillPath(context, 'tests/fixtures/git-safe-cases.json'));
      const rows = f && Array.isArray(f.arguments) ? f.arguments : [];
      check(eq([rows[31], rows[32]], [{ id: 'A32', argv: ['cat', 'c4-head', '--', 'safe.txt', 'src/a.txt'], command: 'cat', accepted: false }, { id: 'A33', argv: ['cat', 'c4-head', '--', 'safe.txt', '.env'], command: 'cat', accepted: false }]) && rows[30].id === 'A31' && eq(rows.slice(33), C17_BLOCKS.GITSAFE_ROWS.map((l) => JSON.parse(l))) && rows.length === 39, 'git-safe-cases.json holds A32 and A33 exactly as the plan appended them after A01-A31, followed by exactly the six C17 rows A34-A39 (C17-F1: slice(33), not slice(-2))', rows.map((r) => r.id).slice(-8));
      const cases = [
        ['two safe paths (A32)', ['cat', C, '--', 'safe.txt', 'src/wallet.ledger.ts']],
        ['a safe and a protected path (A33)', ['cat', C, '--', 'safe.txt', '.env']],
        ['a protected and a safe path', ['cat', C, '--', '.env', 'safe.txt']],
        ['the same path twice', ['cat', C, '--', 'safe.txt', 'safe.txt']],
        ['two protected paths', ['cat', C, '--', '.env', '.env']],
        ['three paths', ['cat', C, '--', 'a', 'b', 'c']],
        ['no path', ['cat', C, '--']],
        ['no separator', ['cat', C, 'safe.txt']],
      ];
      for (const [label, argv] of cases) {
        const run = await runMain(core, context, repo, argv);
        expectMain(check, label, run.r, failMain(E.ARG_CAT));
        check(run.ex.log.length === 0 && run.reads.length === 0, `${label}: no session, no executor call and no policy read`, { calls: run.ex.log.length, reads: run.reads.length });
        let e = null; try { core.parseGitSafeArgs(argv); } catch (x) { e = x; }
        check(e !== null && e.code === 'GIT_SAFE_ARGUMENT' && e.message === E.ARG_CAT, `${label}: the parser throws the exact cat argument diagnostic`, e && e.message);
      }
      const session = await core.createGitSession({ cwd: repo.root, env: context.env, execute: makeExec(context).execute, readFile: async () => Buffer.from(POLICY_TEXT) });
      let thrown = null;
      try { await core.executeGitSafe({ subcommand: 'cat', revisions: [C], paths: ['safe.txt', 'src/other.ts'], format: null, patch: false, maxCount: null, pattern: null }, session); } catch (x) { thrown = x; }
      check(thrown !== null && thrown.code === 'GIT_SAFE_INPUT' && thrown.message === E.INPUT, 'a hand-built request with two paths remains GIT_SAFE_INPUT', thrown && thrown.message);
    });
    await step('one protected path is GIT_SAFE_SECRET before any revision resolution or cat-file call; one safe path returns its raw committed bytes (a binary blob with NUL included) under the unchanged bound; a missing path is the unchanged GIT_SAFE_GIT (real Git)', async () => {
      const prot = await runMain(core, context, repo, ['cat', C, '--', '.env']);
      expectMain(check, 'one protected path', prot.r, failMain(E.SECRET));
      check(prot.ex.log.length === 2 && prot.reads.length === 1, 'only the version and root calls ran and the policy was read once', { calls: prot.ex.log.length });
      const safe = await runMain(core, context, repo, ['cat', C, '--', 'safe.txt']);
      expectMain(check, 'one safe path', safe.r, { exit: 0, stdout: 'needle\n' });
      check(eq(safe.ex.ops().slice(-1)[0], ['cat-file', 'blob', `${C}:safe.txt`]) && safe.ex.contents().length === 0 && safe.ex.log.slice(-1)[0].limit === MAX_BYTES, 'the cat-file vector over the resolved id with the output limit');
      const bin = await runMain(core, context, repo, ['cat', C, '--', 'bin.dat']);
      expectMain(check, 'a binary blob', bin.r, { exit: 0, stdout: FIXTURE_FILES['bin.dat'] });
      const empty = await runMain(core, context, repo, ['cat', C, '--', 'empty.txt']);
      expectMain(check, 'an empty blob', empty.r, { exit: 0, stdout: BIN0 });
      const missing = await runMain(core, context, repo, ['cat', C, '--', 'no-such-file.txt']);
      expectMain(check, 'a missing path', missing.r, failMain(E.GIT));
      const dir = await runMain(core, context, repo, ['cat', C, '--', 'src']);
      expectMain(check, 'a directory', dir.r, failMain(E.GIT));
      check(missing.ex.probes().length === 0, 'a missing path never probes (probe is a grep diagnostic only)');
    });
    await step('the exact bound for one file: a blob of exactly 1048576 bytes is returned whole through the production executor and a blob one byte larger is GIT_SAFE_LIMIT with the cat narrowing guidance and no partial output', async () => {
      const dir = scratchDir(context, 'cat-big');
      const big = buildRepo(context, dir, 40, { 'big-ok.bin': Buffer.alloc(MAX_BYTES, 0x61), 'big-over.bin': Buffer.alloc(MAX_BYTES + 1, 0x62) });
      const ok = await core.main(['cat', big.commit, '--', 'big-ok.bin'], { cwd: big.root, env: context.env, readFile: async () => Buffer.from(POLICY_TEXT) });
      check(ok.exitCode === 0 && ok.stdout.length === MAX_BYTES && ok.stderr === '', 'exactly 1 MiB succeeds', { exit: ok.exitCode, len: ok.stdout.length });
      const over = await core.main(['cat', big.commit, '--', 'big-over.bin'], { cwd: big.root, env: context.env, readFile: async () => Buffer.from(POLICY_TEXT) });
      expectMain(check, 'one byte over', over, failMain(E.LIMIT_CAT));
      rmrf(dir);
    });
    await step('the instructions say so: the reviewer and docs-sync guidance and the security reference state that cat takes one path per call and that an uncertain path is confirmed with ls first because a missing path stops the task as GIT_SAFE_GIT', async () => {
      for (const rel of ['assets/agents/reviewer.md', 'assets/agents/docs-sync.md', 'references/security.md']) {
        const s = squash(sourceText(context, rel) || '');
        check(s.includes(CAT_GUIDANCE_RULE) || (rel === 'references/security.md' && s.includes('cat accepts one path per call and refuses a protected path. You MUST confirm an uncertain path with ls before cat; a missing path returns GIT_SAFE_GIT and stops the task.')), `${rel}: states the one-path rule and the ls-first rule`, clip(CAT_GUIDANCE_RULE));
      }
    });
    flushProcessCount(context, 'R41/C16/cat', mark);
  });
}

// ============================================ A5-templates/C16/recovery ====
// Plan C16-9, C16-16 item 4 and C16-21 (amendments RS/DS_STOP, RC, RH, RR, DS_GF, DS_SCOPE, W16r, W16d): both canonical agents keep sentences 1 and 3 of the stop-rule bullet byte for byte and sentence 2 gains exactly the bounded exception; a new subsection after
// "### Bounded reads" defines the correction (exactly GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN qualify, two rounds at most per rejected logical invocation, cat splitting never resets the budget, same helper and subcommand, no --out, no wider paths, no raw Git or
// other fallback, unread scope disclosed); the reviewer and docs-sync gain the cat/grep guidance (ERE, one path per call); the two Codex wrappers change only their stop clause to point at the canonical exception; both Claude wrappers stay byte-identical.
const REVIEWER_REL = 'assets/agents/reviewer.md';
const DOCS_REL = 'assets/agents/docs-sync.md';
const CODEX_WRAPPERS = ['assets/wrappers/codex-reviewer.toml', 'assets/wrappers/codex-docs_sync.toml'];
const CLAUDE_WRAPPERS = ['assets/wrappers/claude-reviewer.md', 'assets/wrappers/claude-docs-sync.md'];
const STOP_BULLET_SQ = squash(C16_BLOCKS.STOP_NEW.join(' '));
const STOP_PHRASES = [
  ['stop-s1', 'Read repository content only with the local file tools and `git-safe.mjs`.'],
  ['stop-s2', 'If a read or command fails or is denied, stop and report it, except for the bounded GIT_SAFE_ARGUMENT/GIT_SAFE_PATTERN correction defined below, which applies only when git-safe rejected the invocation and emitted no repository content.'],
  ['stop-s3', 'Never use an MCP server, connector, browser or remote service to read repository files or history, and never send repository content to one.'],
];
const STOP_RULES = [{ id: 'stop#1', where: 'bullet', text: STOP_BULLET_SQ }, ...STOP_PHRASES.map(([id, text]) => ({ id, where: 'bullet', text }))];
const RR_HEADING = '### Correcting rejected git-safe arguments';
const RR_PARAS = paras(C16_BLOCKS.RR_SUB.slice(2));
const RR_PHRASES = [
  ['rr-trigger', 'When git-safe itself returns GIT_SAFE_ARGUMENT or GIT_SAFE_PATTERN without repository content, you MUST correct your invocation to the printed grammar and documented ERE syntax and retry through the same git-safe helper and subcommand.'],
  ['rr-preserve', 'Preserve the intended revision, paths and read scope.'],
  ['rr-why-continue', 'This prevents your own rejected invocation from ending the task before the intended content is examined.'],
  ['rr-unclear', 'If the intended correction is unclear, you MUST stop and report it rather than guess a different scope.'],
  ['rr-review-diff', "This includes review-diff's parse-time GIT_SAFE_ARGUMENT errors."],
  ['rr-no-out', 'A correction MUST NOT add --out, redirect output, create an artifact or widen paths; correcting usage grants no new write permission or read scope.'],
  ['rr-budget', 'You MUST use at most two correction rounds for one rejected logical invocation.'],
  ['rr-cat-split', 'For a multi-path cat, one corrected round consists of one cat call per original path.'],
  ['rr-split-no-reset', 'Splitting paths does not reset the budget.'],
  ['rr-stop-other', 'You MUST stop immediately on any non-whitelisted failure, and MUST stop and report incomplete work if the correction budget is exhausted.'],
  ['rr-loop-why', 'This prevents retry loops and partial completion from being reported as a complete review.'],
  ['rr-whitelist', 'Only GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN qualify.'],
  ['rr-stop-list', 'You MUST stop on GIT_SAFE_SECRET, POLICY_*, GIT_SAFE_POLICY_IO, GIT_SAFE_REVISION, GIT_SAFE_RECORD, GIT_SAFE_LIMIT, GIT_SAFE_ARG_LIMIT, GIT_SAFE_GIT, GIT_SAFE_INPUT, GIT_SAFE_COMMAND, GIT_SAFE_VERSION, GIT_SAFE_REPOSITORY, GIT_SAFE_INTERNAL, any other error, a denied read or a sandbox error.'],
  ['rr-git-no-authority', 'GIT_SAFE_GIT never authorizes a syntax correction, even if you suspect an invalid pattern.'],
  ['rr-stop-why', 'This preserves the stop rule when content access or its protection cannot be established.'],
  ['rr-no-fallback', 'You MUST NOT retry through raw Git, another helper, another tool, a connector, changed permissions or a changed sandbox.'],
  ['rr-not-fallback-read', 'A corrected invocation is not a fallback read and grants no new access.'],
  ['rr-unread', 'You MUST report any scope left unread; a successful subset is not completion.'],
];
const RR_RULES = [...paraRules('rr', 'sec', RR_PARAS), ...RR_PHRASES.map(([id, text]) => ({ id, where: 'sec', text }))];
const hardScope = (text) => { const t = LF(text); const i = t.indexOf('- Read repository content only with the local file tools'); const j = t.indexOf('- Do not retry a failed or denied read through another tool', i); return i >= 0 && j > i ? t.slice(i, j) : ''; };
function evalRecovery(raw, rel) {
  const t = LF(raw);
  const f = failedRules(STOP_RULES, { bullet: squash(hardScope(t)) });
  const sec = sectionOf(t, RR_HEADING);
  f.push(...failedRules(RR_RULES, { sec: squash(sec === null ? '' : sec) }));
  const hs = headingsOf(t);
  const at = hs.indexOf(RR_HEADING);
  const prev = at < 0 ? null : hs[at - 1];
  const next = at < 0 ? null : hs[at + 1];
  const wantPrev = rel === DOCS_REL ? '### Git-safe file reads' : '### Bounded reads';
  const wantNext = rel === DOCS_REL ? '## Output' : '## 5. Output';
  if (COUNT(t, `\n${RR_HEADING}\n`) !== 1 || prev !== wantPrev || next !== wantNext) f.push('rr-placement');
  return f;
}
const RR_OPPOSITES = [
  ['rr#1', 'you MUST correct your invocation to the printed grammar and documented ERE syntax', 'you MAY give up instead of correcting your invocation', 'the correction is mandatory'],
  ['rr#1', 'retry through the same git-safe helper and subcommand', 'retry through raw Git', 'same helper and subcommand'],
  ['rr#1', 'Preserve the intended revision, paths and read scope.', 'Choose a different revision, paths and read scope.', 'scope preserved'],
  ['rr#1', 'you MUST stop and report it rather than guess a different scope', 'you MAY guess a different scope', 'an unclear correction stops'],
  ['rr#2', 'A correction MUST NOT add --out, redirect output, create an artifact or widen paths', 'A correction MAY add --out, redirect output, create an artifact or widen paths', 'no --out, no artifact, no wider paths'],
  ['rr#2', "This includes review-diff's parse-time GIT_SAFE_ARGUMENT errors.", "This excludes review-diff's parse-time GIT_SAFE_ARGUMENT errors.", 'review-diff parse errors qualify'],
  ['rr#3', 'You MUST use at most two correction rounds', 'You MAY use any number of correction rounds', 'two rounds at most'],
  ['rr#3', 'Splitting paths does not reset the budget.', 'Splitting paths resets the budget.', 'splitting never resets the budget'],
  ['rr#3', 'You MUST stop immediately on any non-whitelisted failure', 'You MAY continue after a non-whitelisted failure', 'other failures stop'],
  ['rr#3', 'MUST stop and report incomplete work if the correction budget is exhausted', 'MAY report a complete review if the correction budget is exhausted', 'exhaustion stops with incomplete work'],
  ['rr#4', 'Only GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN qualify.', 'Only GIT_SAFE_ARGUMENT, GIT_SAFE_PATTERN and GIT_SAFE_GIT qualify.', 'exactly two codes'],
  ['rr#4', 'You MUST stop on GIT_SAFE_SECRET', 'You MAY retry on GIT_SAFE_SECRET', 'secret stops'],
  ['rr#4', 'GIT_SAFE_GIT never authorizes a syntax correction, even if you suspect an invalid pattern.', 'GIT_SAFE_GIT authorizes a syntax correction when you suspect an invalid pattern.', 'GIT never authorizes a correction'],
  ['rr#5', 'You MUST NOT retry through raw Git, another helper, another tool, a connector, changed permissions or a changed sandbox.', 'You MAY retry through raw Git when the helper fails.', 'no fallback'],
  ['rr#5', 'A corrected invocation is not a fallback read and grants no new access.', 'A corrected invocation is a fallback read and grants new access.', 'no new access'],
  ['rr#5', 'You MUST report any scope left unread; a successful subset is not completion.', 'A successful subset is completion.', 'unread scope disclosed'],
  ['stop#1', 'except for the bounded GIT_SAFE_ARGUMENT/GIT_SAFE_PATTERN correction defined below', 'except for any correction you choose', 'the exception is bounded to the two codes'],
  ['stop#1', 'which applies only when git-safe rejected the invocation and emitted no repository content', 'which applies after any failure', 'only a git-safe rejection without content'],
];
// The scenario rows of C16-16 item 4 and C16-21: [scenario, the exact words that settle it].
const RR_SCENARIO_ROWS = [
  ['two correction rounds at most per rejected logical invocation', 'You MUST use at most two correction rounds for one rejected logical invocation.'],
  ['cat splitting keeps the original path set and does not reset the budget', 'one corrected round consists of one cat call per original path. Splitting paths does not reset the budget.'],
  ['a denial in the first split call stops before the next (denied read stops; every non-whitelisted failure stops immediately)', 'You MUST stop immediately on any non-whitelisted failure'],
  ['a denied read or a sandbox error is a stop, not a correction case', 'a denied read or a sandbox error'],
  ['parse-time review-diff ARGUMENT qualifies through the same helper and subcommand', "This includes review-diff's parse-time GIT_SAFE_ARGUMENT errors."],
  ['a correction never adds --out, redirects output, creates artifacts or widens paths', 'A correction MUST NOT add --out, redirect output, create an artifact or widen paths'],
  ['no raw Git, alternate tool, sandbox change or connector fallback', 'You MUST NOT retry through raw Git, another helper, another tool, a connector, changed permissions or a changed sandbox.'],
  ['unread scope is disclosed', 'You MUST report any scope left unread; a successful subset is not completion.'],
];
// The cat/grep guidance paragraphs (reviewer RC block, docs-sync DS_GF subsection).
const REV_GUIDE_PARAS = paras(C16_BLOCKS.REV_CAT_BLOCK.map((l) => l.trim()));
const DOCS_GUIDE_PARAS = paras(C16_BLOCKS.DS_GF.slice(2));
const GUIDE_FACTS = [
  'cat accepts exactly one path per call.',
  'You MUST confirm an uncertain path with ls before cat, because cat of a missing path returns GIT_SAFE_GIT and stops',
  'grep uses extended regular expressions (ERE): a|b alternates, and ' + BSL + '( or [(] matches a literal opening parenthesis.',
  'To match a literal |, use ' + BSL + '|.',
  'An empty pattern matches every line; a leading - remains pattern text.',
  BSL + 'd is not a digit class; use [0-9].',
  BSL + 's, ' + BSL + 'w and ' + BSL + 'b are GNU extensions, not portable ERE.',
  'Prefer [[:space:]] for whitespace and [[:alnum:]_] for word characters',
  'The GNU extensions worked on Git 2.53 on Windows; macOS/Linux regex engines remain unverified.',
  BSL + '( and ' + BSL + '| are POSIX-defined ERE escapes.',
  'A bracket expression such as [(] is another way to match a literal metacharacter.',
  'Unmatched grouping or repetition syntax, such as transfer( or a{2, and a leading * can make a pattern invalid.',
  'You MUST choose the intended ERE and quote shell arguments when needed, so shell parsing or BRE assumptions do not silently change the search.',
];
const HIST_NEW_SQ = squash(C16_BLOCKS.HIST_NEW.join(' '));
const SCOPE_NEW_SQ = squash(C16_BLOCKS.SCOPE_NEW.join(' '));
function evalGuidance(raw, rel) {
  const s = squash(LF(raw));
  const f = [];
  const paraList = rel === DOCS_REL ? DOCS_GUIDE_PARAS : REV_GUIDE_PARAS;
  paraList.forEach((p, i) => { if (!s.includes(p)) f.push(`guide#${i + 1}`); });
  GUIDE_FACTS.forEach((w, i) => { if (!s.includes(w)) f.push(`guide-fact#${i + 1}`); });
  if (rel === REVIEWER_REL) { if (!s.includes(HIST_NEW_SQ)) f.push('hist-new'); if (s.includes('needs no shell quoting (same command in Bash and PowerShell)')) f.push('hist-old'); } else {
    if (!s.includes(SCOPE_NEW_SQ)) f.push('scope-new');
    if (s.includes('no shell quoting)')) f.push('scope-old');
  }
  return f;
}
async function recovery(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const fx = loadFixture(context);
    const agents = {};
    for (const rel of [REVIEWER_REL, DOCS_REL]) {
      const model = modelOf(fx, rel);
      if (model === null) { check(false, `the pre-change ${rel} is in the fixture and takes every C16 amendment exactly once at its anchor`); return; }
      agents[rel] = { model, pre: preText(fx, rel) };
    }
    await step('the independent models (the pinned pre-C16 agents plus the frozen amendments applied by the helper) satisfy every rule; every sentence of the correction subsection and of the stop-rule bullet is a rule that fails when it is removed or weakened, each guard is replaced by its opposite, and the placement is rejected when the subsection moves or duplicates', async () => {
      for (const rel of [REVIEWER_REL, DOCS_REL]) {
        const m = agents[rel].model;
        check(evalRecovery(m, rel).length === 0, `${rel} model satisfies every recovery rule`, evalRecovery(m, rel));
        const tried = proveRulesFail(check, `${rel} recovery (model)`, m, [...STOP_RULES, ...RR_RULES], (x) => evalRecovery(x, rel));
        check(tried >= sentenceCount([...STOP_RULES, ...RR_RULES]), `${rel}: the in-memory variants cover every sentence of the frozen text (removal and weakening)`, tried);
        proveOpposites(check, `${rel} recovery (model)`, m, RR_OPPOSITES, (x) => evalRecovery(x, rel), [...STOP_RULES, ...RR_RULES]);
        check(evalGuidance(m, rel).length === 0, `${rel} model satisfies every cat/grep guidance rule`, evalGuidance(m, rel));
        const sub = T(C16_BLOCKS.RR_SUB);
        const t = LF(m);
        check(evalRecovery(`${t}${sub}`, rel).includes('rr-placement'), `${rel} control: a second copy of the subsection is rejected`);
        check(evalRecovery(t.replace(`${sub}\n`, '').replace('\n## ', `\n${sub}\n## `), rel).includes('rr-placement') || rel === DOCS_REL, `${rel} control: the subsection moved before the first later heading is rejected`);
        check(evalRecovery(t.replace(sub, ''), rel).includes('rr-placement') && evalRecovery(t.replace(sub, ''), rel).includes('rr#1'), `${rel} control: the missing subsection is rejected`);
      }
    });
    const installed = {};
    await step('every C16 amendment of both agents stands exactly once at its anchor in the installed files and the reversal in reverse order gives the pre-C16 bytes (raw SHA-256 pinned by plan C16-14: reviewer 4c6eb909..., docs-sync ee5e402b...); the files keep the C16-5 byte convention; the retained U+2026 ellipsis of docs-sync Scope item 2 is the only non-ASCII byte added or kept', async () => {
      for (const rel of [REVIEWER_REL, DOCS_REL]) installed[rel] = checkAmendedFile(check, context, fx, rel);
      const ds = installed[DOCS_REL];
      if (ds) {
        const nonAscii = [...ds.text].filter((c) => c.charCodeAt(0) > 127);
        const preNonAscii = [...agents[DOCS_REL].pre].filter((c) => c.charCodeAt(0) > 127);
        check(eq(nonAscii.slice().sort(), preNonAscii.slice().sort()) && nonAscii.some((c) => c.charCodeAt(0) === 0x2026), 'the installed docs-sync holds exactly the pre-C16 non-ASCII bytes (the retained U+2026 ellipsis of Scope item 2 is replaced by the same character; no other non-ASCII byte is added or kept)', nonAscii.length);
      }
      const rv = installed[REVIEWER_REL];
      if (rv) check(![...rv.text].some((c) => c.charCodeAt(0) > 127) || [...agents[REVIEWER_REL].pre].some((c) => c.charCodeAt(0) > 127), 'the installed reviewer adds no non-ASCII byte');
    });
    if (!installed[REVIEWER_REL] || !installed[DOCS_REL]) { check(false, 'both canonical agents are readable'); return; }
    for (const rel of [REVIEWER_REL, DOCS_REL]) {
      const source = LF(installed[rel].text);
      const pre = agents[rel].pre;
      await step(`${rel}: the installed text states the bounded correction: sentences 1 and 3 of the stop-rule bullet stay (including the existing wrapping of sentence 3) and sentence 2 gains exactly the exception; exactly GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN qualify, two rounds at most, cat splitting never resets the budget, the same helper and subcommand, no --out and no wider paths, no raw Git or other fallback, unread scope disclosed; every non-whitelisted code, a denied read and a sandbox error stop`, async () => {
        const failed = evalRecovery(source, rel);
        for (const r of [...STOP_RULES, ...RR_RULES]) check(!failed.includes(r.id), `${rel}: rule ${r.id} holds`, clip(r.text));
        check(!failed.includes('rr-placement'), `${rel}: the subsection stands once ${rel === DOCS_REL ? 'between "### Git-safe file reads" and "## Output"' : 'between "### Bounded reads" and "## 5. Output"'}`);
        const s = squash(sectionOf(source, RR_HEADING) || '');
        for (const [row, words] of RR_SCENARIO_ROWS) check(s.includes(squash(words)) || squash(source).includes(squash(words)), `C16-16/C16-21 row: ${row}`, clip(words));
        const oldBullet = hardScope(pre);
        const newBullet = hardScope(source);
        const oldLines = oldBullet.trimEnd().split('\n'); const newLines = newBullet.trimEnd().split('\n');
        check(newLines[0] === oldLines[0] && eq(newLines.slice(-2), oldLines.slice(-2)), `${rel}: the first line (sentence 1) and the last two lines (the wrapped end of sentence 3) of the bullet are byte-identical to the pre-C16 bullet`, newLines.slice(0, 2));
        check(squash(oldBullet).startsWith('- Read repository content only with the local file tools and `git-safe.mjs`. If a read or command fails or is denied, stop and report it. Never use an MCP server') && squash(newBullet) === STOP_BULLET_SQ, `${rel}: the bullet is exactly the plan's installed form and the pre-C16 bullet differed only in sentence 2`);
        const codes = (t) => [...new Set(t.match(/GIT_SAFE_[A-Z_]+/g) || [])].sort();
        const qualify = /Only (GIT_SAFE_[A-Z_]+)(?: and (GIT_SAFE_[A-Z_]+))? qualify/.exec(s);
        check(qualify !== null && eq([qualify[1], qualify[2]].sort(), ['GIT_SAFE_ARGUMENT', 'GIT_SAFE_PATTERN']), `${rel}: exactly two codes qualify`, qualify && qualify.slice(1));
        const stopList = /You MUST stop on ([^.]*)\./.exec(s);
        const stopped = stopList === null ? [] : stopList[1].split(/,| or /).map((x) => x.trim()).filter((x) => /^(GIT_SAFE_[A-Z_]+|POLICY_\*)$/.test(x));
        const coreModel = applyForFile(preText(fx, 'assets/tools/git-safe-core.mjs'), 'assets/tools/git-safe-core.mjs');
        const reviewDiff = pre17Text(context, 'assets/tools/review-diff.mjs') || '';
        const everyCode = codes(`${coreModel}\n${reviewDiff}`);
        const shouldStop = everyCode.filter((c) => c !== 'GIT_SAFE_ARGUMENT' && c !== 'GIT_SAFE_PATTERN');
        check(shouldStop.length >= 11 && shouldStop.every((c) => stopped.includes(c)), `${rel}: every other GIT_SAFE_* code that the core and review-diff can emit is on the stop list`, shouldStop.filter((c) => !stopped.includes(c)));
        check(stopped.includes('POLICY_*') && !stopped.includes('GIT_SAFE_ARGUMENT') && !stopped.includes('GIT_SAFE_PATTERN') && new Set(stopped).size === stopped.length, `${rel}: the stop list holds POLICY_*, no duplicate and neither whitelisted code`, stopped);
        const adjacent = squash(LF(source).slice(LF(source).indexOf('- Do not retry a failed or denied read through another tool')));
        check(adjacent.startsWith('- Do not retry a failed or denied read through another tool, change the sandbox, request full access, or use a connector as a fallback.') && (rel === REVIEWER_REL ? adjacent.includes('Instructions are guidance, not a sandbox; the review lane also requires the launcher isolation described in the setup documentation.') : true), `${rel}: the adjacent no-fallback bullet is retained (the reviewer's launcher qualification included)`);
        check(!/\bdenied\b[^.]*\bretry\b[^.]*\bmay\b/i.test(s), `${rel}: no sentence lets a denied read be retried`);
      });
      await step(`${rel}: the cat/grep guidance states ERE (a|b alternates, backslash-paren and [(] match a literal parenthesis, a literal bar needs backslash-bar), the empty and leading-dash patterns, that backslash-d is not a digit class (use [0-9]) and that the GNU escapes are not portable ERE with the portable replacements, the literal-search metacharacters, invalid unmatched syntax, quoting, one cat path per call with an ls-first rule, and that no match is an empty success and not proof of exhaustive review; the history sentence no longer claims that no shell quoting is needed`, async () => {
        const failed = evalGuidance(source, rel);
        check(failed.length === 0, `${rel}: every guidance paragraph and fact holds`, failed);
        const paraList = rel === DOCS_REL ? DOCS_GUIDE_PARAS : REV_GUIDE_PARAS;
        const rules = paraList.map((text, i) => ({ id: `guide#${i + 1}`, where: 'all', text }));
        const tried = proveRulesFail(check, `${rel} guidance`, source, rules, (x) => evalGuidance(x, rel));
        check(tried >= sentenceCount(rules), `${rel}: every guidance sentence is removed and weakened in memory`, tried);
        check(squash(source).includes(rel === DOCS_REL ? 'No match is an empty success, not proof that every affected document was checked.' : 'No match is an empty success, not proof that all consumers were searched.'), `${rel}: no match is an empty success and not exhaustive proof`);
      });
      await step(`${rel}: nothing else changed: the headings are the pre-C16 headings plus the new level-3 headings (${rel === DOCS_REL ? '"### Git-safe file reads" and "### Correcting rejected git-safe arguments"' : '"### Correcting rejected git-safe arguments"'}), "### Project rules" still directly precedes "### Bounded reads", no existing bounded-read paragraph changed, no file reference was added, the transmission and checkout bans stay, and the new prose is ASCII within 100 columns`, async () => {
        const hs = headingsOf(source); const hp = headingsOf(pre);
        const added = hs.filter((h) => !hp.includes(h));
        check(eq(added, rel === DOCS_REL ? ['### Git-safe file reads', RR_HEADING] : [RR_HEADING]) && hp.every((h) => hs.includes(h)), `${rel}: the only added headings are the new subsections`, added);
        const i = hs.indexOf('### Project rules');
        check(i >= 0 && hs[i + 1] === '### Bounded reads', `${rel}: "### Project rules" still directly precedes "### Bounded reads"`);
        const bounded = (t) => squash(between(LF(t), '### Bounded reads\n', rel === DOCS_REL ? '\n### ' : '\n### ') || '');
        check(bounded(source) !== '' && bounded(source).startsWith('Every git-safe command limits its complete stdout result to 1,048,576 bytes.') && (bounded(pre) === '' || bounded(pre).startsWith(bounded(source).slice(0, 80))), `${rel}: the bounded-read paragraphs are not edited`);
        const refs = (t) => [...LF(t).matchAll(/`((?:\.ai|docs|\.claude|\.codex)\/[\w./-]+\.(?:md|json|toml|mjs))`/g)].map((m) => m[1]).sort();
        check(refs(source).every((r) => refs(pre).includes(r)), `${rel}: no new file reference (the replaced history sentence drops one backticked policy reference)`, refs(source));
        const s = squash(source);
        check(s.includes('Never use an MCP server, connector, browser or remote service to read repository files or history, and never send repository content to one.') && s.includes('Never run `git checkout`, `git switch`, `gh pr checkout` or `git worktree add`.'), `${rel}: the transmission ban and the checkout ban stay`);
        const issues = newProseIssues(source, pre).filter((m) => { const n = Number(/^line (\d+)/.exec(m)[1]); return !(/not ASCII/.test(m) && LF(source).split('\n')[n - 1] === '   `node .ai/tools/git-safe.mjs diff|log|show ' + String.fromCharCode(0x2026) + '`'); });
        check(issues.length === 0, `${rel}: every newly written line is ASCII and at most 100 columns (the exact retained ellipsis line and, per C16-F3, the retained 102-column first line of docs-sync item 2 excepted)`, issues.slice(0, 6));
        const first = C16_BLOCKS.RR_SUB[2];
        check(source.includes(first) && newProseIssues(source.replace(first, () => 'q'.repeat(100)), pre).filter((m) => /columns/.test(m)).length === 0 && newProseIssues(source.replace(first, () => 'q'.repeat(101)), pre).some((m) => /is 101 columns/.test(m)), `${rel}: exactly 100 columns passes and 101 fails`);
        proveFenceRules(check, `${rel} recovery prose`, { text: source, baseline: `${pre}\n   \`node .ai/tools/git-safe.mjs diff|log|show ${String.fromCharCode(0x2026)}\`\n`, paragraph: RR_PARAS[0] });
      });
      await step(`${rel}: negative controls on the installed text: every sentence of the stop-rule bullet and of the subsection is removed and weakened and each guard replaced by its opposite (rules that already fail are reported above), and each amendment of the file is rejected when missing, partial, duplicated, moved, altered, spaced differently, written with CRLF or found in the wrong file`, async () => {
        const tried = proveRulesFail(check, `${rel} recovery`, source, [...STOP_RULES, ...RR_RULES], (x) => evalRecovery(x, rel));
        check(tried >= sentenceCount([...STOP_RULES, ...RR_RULES]), `${rel}: the variants cover every sentence`, tried);
        proveOpposites(check, `${rel} recovery`, source, RR_OPPOSITES, (x) => evalRecovery(x, rel), [...STOP_RULES, ...RR_RULES]);
        const other = LF(installed[rel === DOCS_REL ? REVIEWER_REL : DOCS_REL].text);
        for (const id of FORWARD_ORDER16[rel]) amendmentControls(check, `${rel} ${id}`, modelThrough(fx, rel, id) || '', AM16[id], { otherFileText: id === 'RS' || id === 'DS_STOP' ? other.replace(C16_BLOCKS.STOP_NEW.join('\n'), '') : other });
      });
    }
    await step('the Codex wrappers change only their stop clause: each equals its pre-C16 bytes with exactly W16r or W16d applied (reviewer fe21c05b..., docs-sync 1e6eef9a...), reversing gives the retained pins (135028b8..., 7a1d6e00...), the new clause refers to the canonical bounded correction without duplicating or expanding its budget, every byte outside the clause (including the following no-fallback sentence and its wrapping) is preserved, and the TOML still parses', async () => {
      const toml = await importOrFail(failures, pathToFileURL(skillPath(context, 'scripts/toml.mjs')).href, 'scripts/toml.mjs');
      for (const rel of CODEX_WRAPPERS) {
        const id = rel.endsWith('reviewer.toml') ? 'W16r' : 'W16d';
        const bytes = readBytes(skillPath(context, rel));
        check(bytes !== null && sha(bytes) === CODEX_WRAPPER_NEW[rel], `${rel}: the installed bytes are the independently derived amended wrapper`, bytes && sha(bytes));
        const text = bytes === null ? '' : bytes.toString('utf8');
        check(amendmentOnce(text, AM16[id]), `${rel}: ${id} stands exactly once at its anchor`);
        const r = reverseOne(text, AM16[id]);
        check(r !== null && sha(Buffer.from(r)) === PRE_PIN[rel] && Buffer.compare(Buffer.from(r), fx.files[rel]) === 0 && NH(r) === RETAINED_WRAPPER_NH[rel], `${rel}: reversing ${id} gives the pre-C16 bytes and the retained pin`, r && sha(Buffer.from(r)));
        const model = applyOne(fx.files[rel].toString('utf8'), AM16[id]);
        check(model === text, `${rel}: the installed wrapper equals the pre-C16 text plus only ${id}`);
        const s = squash(text);
        check(s.includes('stop and report it, except for the bounded GIT_SAFE_ARGUMENT/GIT_SAFE_PATTERN correction in the canonical definition. Do not retry it through another tool, change the sandbox, request full access, or use a connector as a fallback.'), `${rel}: the clause refers to the canonical correction and the no-fallback sentence follows unchanged`);
        check(COUNT(text, 'GIT_SAFE_') === 2 && !/two correction|at most|--out|GIT_SAFE_GIT|GIT_SAFE_SECRET|POLICY_|rounds/.test(text), `${rel}: the wrapper names only the two whitelisted codes (once) and neither duplicates nor expands the canonical budget`);
        if (toml) { let parsed = null; try { parsed = toml.parseToml(text); } catch (e) { parsed = { errors: [errMsg(e)] }; } check(parsed && Array.isArray(parsed.errors) && parsed.errors.length === 0 && parsed.data && typeof parsed.data.developer_instructions === 'string' && parsed.data.developer_instructions.includes('GIT_SAFE_ARGUMENT/GIT_SAFE_PATTERN'), `${rel}: the wrapper is valid TOML whose developer instructions carry the clause`, parsed && parsed.errors); }
        amendmentControls(check, `${rel} ${id}`, model || '', AM16[id], { otherFileText: rel === CODEX_WRAPPERS[0] ? readText(skillPath(context, CODEX_WRAPPERS[1])) || '' : readText(skillPath(context, CODEX_WRAPPERS[0])) || '' });
      }
      check(AM16.W16r.neu.split('\n').length - AM16.W16r.old.split('\n').length === 2 && AM16.W16d.neu.split('\n').length - AM16.W16d.old.split('\n').length === 2, 'the frozen amendments add two lines to each Codex clause and nothing else');
    });
    await step('both Claude wrappers are byte-identical to their pins and carry no correction rule (their denied-read and missing-canonical stops stay); the four wrapper identities and the six v2 snapshot pins are unchanged', async () => {
      for (const rel of CLAUDE_WRAPPERS) { const b = readBytes(skillPath(context, rel)); check(b !== null && NH(b) === RETAINED_WRAPPER_NH[rel] && !b.toString('utf8').includes('GIT_SAFE_'), `${rel}: byte-identical (normalized pin) and without a git-safe code`, b && NH(b)); }
      for (const [rel, digest] of HISTORICAL_BASELINES) { const b = readBytes(skillPath(context, rel)); check(b !== null && sha(b) === digest, `${rel}: the shipped v2 snapshot still hashes to its pin`); }
      const names = (rel) => (readText(skillPath(context, rel)) || '').split('\n').filter((l) => /^(name|description) ?[:=]/.test(l));
      check(names('assets/wrappers/codex-reviewer.toml').some((l) => l.startsWith('name = "reviewer"')) && names('assets/wrappers/codex-docs_sync.toml').some((l) => l.startsWith('name = "docs_sync"')), 'the wrapper names are unchanged');
      const script = readBytes(skillPath(context, 'scripts/check-agent-baselines.mjs'));
      check(script !== null && NH(script) === '905c0254d37026eac46aa16976db7726b8abb08349352941f781ce232dae9be8', 'the baseline checker is unchanged (its pins are historical v2 snapshots)');
    });
    flushProcessCount(context, 'A5-templates/C16/recovery', mark);
  });
}

// ============================================ A5-templates/C16/host-docs ====
// Plan C16-11, C16-16 item 5 and C16-21 (amendments RM1, RM3, CL1-CL6, CX, SE and the root README and project-tree wording): the living documents separate measured passes, measured failures and unverified behavior, with exact versions and dates. Measured on 2026-10-24/25
// (Windows 11, Claude Code 2.1.310, codex-cli 0.163.0) are root-start hook behavior, the subdirectory FAIL, the Node-missing fail-open and the Codex rows; P1/P2 (instruction loading) are separate model self-reports; P3 is headless evidence (TUI deferred); P4 names both object formats
// and leaves Git 2.31 unverified. Nothing here upgrades a profile or negative-capability unknown to PASS, claims a TUI result, or leaves a stale broad "all unmeasured" claim. Documents are text: they establish what is recorded, not that a host behaves so.
const CL_ROWS = [
  '| Exit 0 | PASS: git status ran without a guard message or permission prompt. |',
  '| Exit 2 | PASS: raw git log was blocked with the fixed explanation. |',
  '| Exit 1 / R51 | PASS: execution continued; the warning reached the user\'s transcript, not the model. |',
  '| PowerShell input | PASS: the tool name was PowerShell and the command reached the hook. |',
  '| Bash' + BSL + '|PowerShell matcher | PASS for both measured tools. |',
  '| CLAUDE_PROJECT_DIR / R83-f | PASS: expansion and quoting inside Git Bash double quotes worked with backslash separators, spaces and non-ASCII paths. |',
  '| Root start, then cd | PASS: the hook and deny rules remained active within the project. |',
  '| Subdirectory start / R83-e | FAIL: no hook events; raw git log ran and the protected-path Read was not denied. |',
  '| Node missing | FAIL OPEN: hook exit 127 did not block Git; the model saw no warning. |',
  '| macOS / Linux | TO VERIFY; no portability claim follows from the Windows measurements. |',
];
const CX_ROWS = [
  '| Root critical rules | PASS: the requested first critical-rules bullet matched. |',
  '| A3 artifact and stdout | PASS: review bytes matched; status and stash were unchanged. |',
  '| A3 dirty trusted checkout | PASS: committed-head output excluded local changes. |',
  '| A3 local-worktree mode | PASS: intended local changes appeared, protected files were absent, and index bytes were unchanged. |',
  '| Equal-head warning | PASS: present for equal resolved head and absent for the other range. |',
  '| L10 review completeness | FAIL: both Codex reviews were incomplete; change-1\'s lost update was not a finding. |',
  '| Secret shell read, no profile | INCONCLUSIVE: failure cause was not captured. |',
  '| Secret subprocess, no profile | FAIL: all six canaries were readable, including late-file coverage. |',
  '| R44 profile row | BLOCKED: isolated elevated-sandbox startup hung after UAC approval; deny-read enforcement remains unverified. |',
  '| A5 positive control | PASS: the approved parent echo tool returned its control response. |',
  '| A5 negative capability | INCONCLUSIVE: no forced host-refusal result was obtained. |',
  '| MCP configuration override | PASS: list output reflected enabled=false with the override; this is configuration evidence only. |',
  '| macOS / Linux / WSL2 | TO VERIFY for these measurements. |',
];
const rowsPresent = (check, label, doc, rows) => {
  const lines = LF(doc).split('\n');
  for (const row of rows) {
    check(lines.includes(row), `${label}: the table row is exact: ${clip(row)}`);
    const without = lines.filter((l) => l !== row).join('\n');
    check(!without.split('\n').includes(row), `${label}: control: removing the row is detected`, clip(row));
  }
};
async function hostDocs(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const fx = loadFixture(context);
    const doc = (rel) => sourceText(context, rel);
    await step('amendments RM1, RM2, RM3, RM4a, RM4b (README), CL1-CL6 (references/claude.md), CX (references/codex.md), SE (references/security.md) and DG1 each stand exactly once at their anchors and reversing them gives the pre-C16 bytes (README aeec055c..., claude.md 41c954c4..., codex.md 595a1b56..., security.md e996435a...); the files keep the C16-5 byte convention', async () => {
      for (const rel of ['README.md', 'references/claude.md', 'references/codex.md', 'references/security.md']) checkAmendedFile(check, context, fx, rel);
    });
    await step('README host paragraph (RM3, plan C16-11): one paragraph, exactly the frozen ten lines, directly before the unchanged trusted-checkout sentence, with the 2026-10-24/25 Windows 11 and Claude Code 2.1.310 scope, root-started sessions applying the hook, matcher and deny rules (also after a cd within the project), spaces and non-ASCII paths working, exit 0, 2 and 1 behavior with the exit-1 warning visible to the user and not the model, the src/wallet start that did not load the hook or deny rules, Node missing failing open with no model warning, macOS and Linux TO VERIFY, and the Node self-tests not establishing host loading', async () => {
      const readme = doc('README.md');
      if (readme === null) { check(false, 'README.md is readable'); return; }
      const lines = readme.split('\n');
      const at = lines.findIndex((l) => l.startsWith('The installed candidate is node'));
      check(at >= 0 && eq(lines.slice(at, at + C16_BLOCKS.RM_HOOK.length), C16_BLOCKS.RM_HOOK) && lines[at - 1] === '' && lines[at + C16_BLOCKS.RM_HOOK.length] === '' && lines[at + C16_BLOCKS.RM_HOOK.length + 1] === 'The hook executes project code and therefore depends on the trusted-checkout boundary.', 'the paragraph is the ten frozen lines with no blank line inside, one blank line on each side and the trusted-checkout sentence next', at);
      check(C16_BLOCKS.RM_HOOK.length === 10 && COUNT(readme, 'The installed candidate is node') === 1 && !readme.includes('Host portability is TO VERIFY. Direct Node self-tests'), 'there is one such paragraph and the old TO VERIFY paragraph is gone');
      const s = squash(readme);
      for (const w of ['Measured on 2026-10-24/25 on Windows 11 with Claude Code 2.1.310:', 'root-started sessions applied the hook, its Bash|PowerShell matcher and deny rules, including after changing directory within the project.', 'Project paths with spaces and non-ASCII characters worked.', 'Exit 0 permitted, exit 2 blocked with its explanation, and exit 1 continued with a warning visible to the user, not the model.', 'A session started in src/wallet did not load the root hook or deny rules.', 'With Node missing, the hook failed open and the model saw no warning.', 'macOS and Linux remain TO VERIFY.', 'Direct Node self-tests do not establish host loading or enforcement.', 'See references/claude.md for the itemized measurements and the separate 2026-10-25 instruction-loading probes.']) {
        check(s.includes(w), `README: ${clip(w)}`);
        const removed = swapSentence(readme, w, '');
        check(removed !== null && !squash(removed).includes(w), 'control: removing the sentence is detected', clip(w));
      }
      const paragraphsOf = (t) => LF(t).split(/\n\n+/);
      const cur = paragraphsOf(readme); const pre = paragraphsOf(preText(fx, 'README.md') || '');
      const ci = cur.findIndex((p) => p.startsWith('The installed candidate is node')); const pi = pre.findIndex((p) => p.startsWith('The installed candidate is node'));
      const upTo = (arr) => { const k = arr.findIndex((p) => p.startsWith('## Local candidate release')); return k < 0 ? arr.length : k; };
      check(ci >= 0 && pi >= 0 && ci - pi === 2 && cur.length - pre.length === 2 && eq(cur.slice(ci + 1, upTo(cur)), pre.slice(pi + 1, upTo(pre))), 'the replacement is one paragraph: the two launch paragraphs before the hook section are the only additions and every following paragraph index and text up to the release section is unchanged', { ci, pi, cur: cur.length, pre: pre.length });
    });
    await step('references/claude.md: the dated measurement block (CL5) is exactly the frozen subsection with its ten result rows in order, the scope sentence (published rc.2 bytes, Windows 11 Pro 10.0.26100, Claude Code 2.1.310, Node v24.14.1, no Claude OS sandbox; direct Node tests are separate evidence), the parser and secret-path and A5 paragraphs, and the P1/P2 paragraph kept separate from the table; the old "Host behavior: TO VERIFY" subsection and its stale broad claim are gone', async () => {
      const ref = doc('references/claude.md');
      if (ref === null) { check(false, 'references/claude.md is readable'); return; }
      const sec = sectionOf(ref, '### Host behavior: measured scope and remaining checks');
      check(sec !== null && `### Host behavior: measured scope and remaining checks\n${sec}`.trimEnd() === T(C16_BLOCKS.CL_HOST_NEW).trimEnd(), 'the subsection is exactly the frozen text', sec && sec.slice(0, 80));
      rowsPresent(check, 'references/claude.md', ref, CL_ROWS);
      const tableRows = LF(ref).split('\n').filter((l) => /^\| (Exit [012] |Exit 1 |PowerShell input|Bash\\\||CLAUDE_PROJECT_DIR|Root start|Subdirectory|Node missing|macOS)/.test(l));
      check(eq(tableRows, CL_ROWS) && LF(ref).includes('| Item | Observation |\n|---|---|\n'), 'the table holds exactly the ten rows in order under its header', tableRows.length);
      const s = squash(ref);
      for (const w of [
        'Measurements dated 2026-10-24/25 used the published rc.2 bytes on Windows 11 Pro 10.0.26100, Claude Code 2.1.310 and Node v24.14.1, without a Claude OS sandbox.',
        'Direct Node tests are separate evidence and do not establish any host result.',
        'Claude runs these Windows hooks through Git Bash. The hook ran before the host\'s own command parser in the measured malformed-command case.',
        'A subprocess read all six canaries. The root-anchor parity row was not run. These results do not establish an OS security boundary.',
        'A5 passed for the measured Claude reviewer wrapper: the parent echo MCP control succeeded, and the subagent received an unavailable-tool error. This does not establish other hosts\' tool inventories.',
        'Probes P1/P2 on 2026-10-25 reported that root CLAUDE.md loads below the root but its root AGENTS.md import did not expand.',
        'P2\'s headless parent import @../AGENTS.md did not load.',
        'These are strong self-report observations, not proof. Interactive import behavior is unverified. The launch rule is present only in the root Claude template.',
        'The hook executes project code and depends on the trusted-checkout boundary.',
      ]) check(s.includes(w), `references/claude.md: ${clip(w)}`);
      check(!s.includes('### Host behavior: TO VERIFY') && !s.includes('Direct Node tests establish none of these; each is TO VERIFY on a real Claude Code host') && !/all (Windows )?hook behavior (remains|is) (unmeasured|TO VERIFY)/i.test(s), 'no stale broad claim that every hook behavior is unmeasured or TO VERIFY remains');
      const p12 = s.indexOf('Probes P1/P2 on 2026-10-25'); const tbl = s.indexOf('| Item | Observation |');
      check(p12 > tbl && !squash(sec || '').slice(0, squash(sec || '').indexOf('Claude runs these Windows hooks')).includes('P1'), 'the P1/P2 paragraph follows the measurement table and the table block does not mention P1/P2 (separate evidence)');
      check(!/TUI[^.]*\b(PASS|verified|measured)\b/.test(s.replace(/TUI[^.]*(unverified|TO VERIFY|deferred|not establish|no TUI)[^.]*/g, '')), 'no sentence turns the headless observations into a TUI result');
    });
    await step('references/claude.md instruction-loading additions: the launch and worktree paragraphs come first, the nested-loading bullet and the reason for instruction pairs are kept, the dated P1/P2 observation is appended with its self-report limit, the relative-import description is qualified (imports resolving outside the start directory did not load, including @../AGENTS.md; interactive behavior unverified; do not rely on a parent import), the built-in-preamble paragraph is kept and its TO VERIFY is scoped to preamble portability, and the load-verification list starts with the root-started session instruction', async () => {
      const ref = doc('references/claude.md');
      if (ref === null) return;
      const s = squash(ref);
      for (const w of [
        'Nested `CLAUDE.md` files load on demand when Claude works with a file in that directory. Nested `AGENTS.md` files are ignored while a root `CLAUDE.md` exists (default mode), hence the pair rule.',
        'Launch location also matters. Probe P1 on 2026-10-25, Claude Code 2.1.310 on Windows 11, reported root CLAUDE.md and imported root AGENTS.md at a root start.',
        'At a src/wallet start it reported root CLAUDE.md and the nested pair, but not root AGENTS.md contents.',
        'P2 loaded root CLAUDE.md below the root even without a nested pair.',
        'The relative-import description is not a guarantee that an import expands during a subdirectory launch.',
        'In the 2026-10-25 headless P2 probe, imports resolving outside the start directory did not load, including @../AGENTS.md.',
        'Interactive TUI behavior is unverified. Do not rely on a parent import to restore root critical rules below the root.',
        'For that built-in-preamble observation, TO VERIFY refers to preamble portability. The separately measured raw-Git hook results below do not verify every built-in skill.',
        'Perform these checks from a root-started session.',
        'This is observed workflow evidence, not host-verified behavior.',
      ]) check(s.includes(w), `references/claude.md: ${clip(w)}`);
      check(amendmentOnce(LF(ref), AM16.CL2) && amendmentOnce(LF(ref), AM16.CL3) && amendmentOnce(LF(ref), AM16.CL4) && amendmentOnce(LF(ref), AM16.CL6), 'CL2, CL3, CL4 and CL6 stand once at their anchors (CL4 as its own paragraph: PLAN-GAP, the plan says only "immediately after it, add")');
    });
    await step('references/codex.md: the dated measurement section (CX) is exactly the frozen text with its thirteen rows in order; the profile row stays BLOCKED, the negative capability and the secret shell read stay INCONCLUSIVE and none is upgraded to PASS; the corrected L10 diagnosis (an absent selector is filtered; BRE parsing of an unbalanced backslash-paren; a|b an empty success under BRE) and the rc.3 re-measurement requirement are stated; the older 0.160.1 observations stay historical', async () => {
      const cx = doc('references/codex.md');
      if (cx === null) { check(false, 'references/codex.md is readable'); return; }
      const sec = sectionOf(cx, '## Host measurements dated 2026-10-24/25');
      check(sec !== null && `## Host measurements dated 2026-10-24/25\n${sec}`.trimEnd() === T(C16_BLOCKS.CX_NEW).trimEnd(), 'the section is exactly the frozen text');
      rowsPresent(check, 'references/codex.md', cx, CX_ROWS);
      for (const row of CX_ROWS) if (/R44 profile|negative capability|Secret shell read|macOS/.test(row)) check(!/\| PASS\b/.test(row) && /BLOCKED|INCONCLUSIVE|TO VERIFY/.test(row), `references/codex.md: not upgraded to PASS: ${clip(row)}`);
      const s = squash(cx);
      for (const w of [
        'The rc.2 measurements used codex-cli 0.163.0 on Windows 11 Pro 10.0.26100 with the elevated Windows sandbox.',
        'an absent selector is filtered silently. The failure came from BRE parsing of an unbalanced \\(, and a|b could return an empty success because BRE treats the vertical bar literally. C16 changes grep to ERE.',
        'Both L10 ranges must be re-measured after rc.3.',
        'Configuration checks, static instruction tests and model statements do not establish review completeness or host negative capability.',
        'The older 0.160.1 observations above remain historical observations of that configuration.',
      ]) check(s.includes(w), `references/codex.md: ${clip(w)}`);
      check(LF(cx).indexOf('## Host measurements dated 2026-10-24/25') < LF(cx).indexOf('## Load verification (Codex session)') && amendmentOnce(LF(cx), AM16.CX), 'the section comes directly before "## Load verification (Codex session)"');
    });
    await step('references/security.md (SE, plan C16-10): grep is ERE (a|b alternates, a literal parenthesis or bar needs the escape, an empty pattern matches every line, a leading dash is pattern text, a NUL pattern is rejected as GIT_SAFE_ARGUMENT before any Git operation), the digit-class and GNU-extension notes, the literal-search escapes, the BRE-to-ERE compatibility warning (existing expressions MUST be checked; a valid BRE can be invalid ERE), the probe contract (status 128 with empty stdout, the empty tree of the resolved object format, PATTERN only for probe 128/empty, GIT otherwise), the bounded correction for the two codes only (review-diff parse errors included, never --out or wider paths), and the malformed-configuration residual; the shell-free explanation and error-redaction rules stay', async () => {
      const sec = doc('references/security.md');
      if (sec === null) { check(false, 'references/security.md is readable'); return; }
      const s = squash(sec);
      for (const p of paras([...C16_BLOCKS.SE_NEW])) void p;
      for (const w of [
        'cat accepts one path per call and refuses a protected path. You MUST confirm an uncertain path with ls before cat; a missing path returns GIT_SAFE_GIT and stops the task.',
        'grep uses extended regular expressions (ERE): a|b alternates, \\( matches a literal opening parenthesis, and \\| matches a literal vertical bar. No match is an empty success.',
        'A pattern containing NUL is rejected as GIT_SAFE_ARGUMENT before any Git operation.',
        '\\d is not a digit class; use [0-9].',
        'This changes the BRE behavior in rc.1 and rc.2. Existing expressions MUST be checked for their intended ERE meaning before reuse, because a valid expression can match different text.',
        'For example, a|b now alternates, while a\\|b now matches a literal vertical bar. An expression valid as BRE can also be invalid as ERE.',
        'After a status-128 grep content call with empty stdout, git-safe probes the same ERE against the empty tree for the resolved commit\'s object format. Probe status 128 with empty stdout produces GIT_SAFE_PATTERN; every other probe outcome produces unchanged GIT_SAFE_GIT. No repository content or Git diagnostic is emitted on either error.',
        'The canonical agents permit bounded correction only for GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN. This includes review-diff parse-time argument errors, but a correction MUST NOT add --out or widen paths. Every other failure or denial still stops the task.',
        'Malformed configuration can fail before command-line options take effect.',
        'a valid pattern may be classified GIT_SAFE_PATTERN; the bounded correction budget still ends in a stop, never fallback access.',
        'Git runs without a shell, so `**` globs are never expanded by Bash or mangled by PowerShell. Errors name the failure only, never a path, revision, pattern or Git output.',
      ]) { check(s.includes(w), `references/security.md: ${clip(w)}`); const removed = swapSentence(sec, w, ''); check(removed !== null && !squash(removed).includes(w), 'control: removing the sentence is detected', clip(w)); }
      check(!s.includes('A grep pattern is a basic regular expression') && !s.includes('including names that existed only in history'), 'the old BRE sentence is gone');
    });
    await step('P1/P2, P3 and P4 evidence stay separate and exact: the frozen decisions file records the rendered root hash 5bb1d5ed... for the eight P3 headless cases (the round-2 text and the final template, case (e) permission failure then --allowedTools Bash, case (h) with the parent-supplied start explanation as a caveat), names the published rc.2 agents and runtime unit and the permission flags, leaves the interactive TUI cases to the post-release re-measurement, and names SHA-1 and SHA-256 for P4 with the Git 2.31 floor unprobed; the rc.3 notes carry the P4 limits, the pending R83-e and A3/L10 re-measurement and the instruction-only mitigation', async () => {
      const decisions = squash(readText(rootPath(context, 'docs/plans/2026-10-25-project-setup-v3-rc3-c16-decisions.md')) || '');
      for (const w of [
        'final template 5bb1d5ed...', 'rc.2 runtime unit and canonical agents, not the C16 candidates',
        '`--allowedTools \'Bash(node .ai/tools/git-safe.mjs:*)\'` did not match a compound command', 'with `--allowedTools Bash` it passed', '`--allowedTools Bash PowerShell`',
        'the parent told the subagent that the session started at the root, so the subagent\'s own reading of its environment was not isolated',
        'The interactive TUI cases move to the post-release re-measurement (C16-20).',
        'Git 2.53.0.windows.2, SHA-1 and SHA-256 repos', 'Git 2.31 (the supported floor) and other Claude Code versions and platforms are unprobed.',
        'P1, P2 and P3 rest on model self-report and transcripts, one sample per case, not on a host API.',
      ]) check(decisions.includes(w), `decisions file: ${clip(w)}`);
      const notes = squash(readText(skillPath(context, 'RELEASE-NOTES-3.0.0-rc.3.md')) || '');
      for (const w of [
        'P4 verified empty-tree behavior on Git 2.53.0.windows.2 in SHA-1 and SHA-256 repositories. The Git 2.31 floor and macOS/Linux regex engines remain unverified.',
        'R83-e and A3/L10 require re-measurement',
        'These measurements block final 3.0.0, not rc.3 implementation acceptance.',
        'Repeat the root and subdirectory cases in the interactive TUI with the maintainer; pre-freeze headless probes do not establish TUI behavior.',
        'Codex profile enforcement remained blocked; its negative-capability measurement was inconclusive.',
        'Missing Node failed open.',
      ]) check(notes.includes(w) || notes.includes(w.replace('R83-e and A3/L10 require re-measurement', 'R83-e and A3/L10 measurements')), `rc.3 notes: ${clip(w)}`);
      check(!/\bmeasured\b[^.]*\bTUI\b[^.]*\bPASS\b/.test(notes), 'the rc.3 notes make no TUI PASS claim');
    });
    await step('the repository README and project-tree wording (plan C16-11, PLAN-GAP: the plan freezes the new sentences and the rc.3 references but not the full splice): no rc.2 version or note reference remains as the current candidate, the three frozen sentences stand once, the v2 compatibility and rollback instructions stay, and the pre-change files hash to their pins in the fixture', async () => {
      const rootReadme = pre17Text(context, '@root/README.md');
      const tree = pre17Text(context, '@root/.ai/context/project-tree.md');
      if (rootReadme === null || tree === null) { check(false, 'the repository README and project-tree are readable'); return; }
      for (const [rel, pin] of [['@root/README.md', PRE_PIN['@root/README.md']], ['@root/.ai/context/project-tree.md', PRE_PIN['@root/.ai/context/project-tree.md']]]) check(fx.files[rel] !== undefined && sha(fx.files[rel]) === pin, `${rel}: the fixture holds the pre-C16 bytes (pinned by plan C16-14)`);
      const r = squash(rootReadme); const t = squash(tree);
      const sec = String.fromCharCode(0xa7);
      check(!/3\.0\.0-rc\.2/.test(rootReadme) && /project-setup` \(3\.0\.0-rc\.3, a release candidate/.test(rootReadme) && r.includes('project-setup/RELEASE-NOTES-3.0.0-rc.3.md` (compatibility,') && r.includes('(3.0.0-rc.3, own installer and tests)') && r.includes('project-setup/RELEASE-NOTES-3.0.0-rc.3.md` ' + sec + ' "Compatibility and rollback")'), 'the repository README names rc.3 for the version, the notes and the tree line and no rc.2 reference remains');
      check(r.includes(squash(C16_BLOCKS.ROOT_README_REPL.join(' '))) && COUNT(r, 'R83-e and A3/L10 must pass re-measurement after rc.3 before final 3.0.0.') === 1 && !r.includes('Host measurements are still pending and block final 3.0.0.'), 'the update paragraph says that R83-e and A3/L10 must pass re-measurement after rc.3 and that other dated results are in the rc.3 notes');
      check(COUNT(LF(rootReadme), `\n${T(C16_BLOCKS.ROOT_README_PARA)}\nStart a new Claude Code session and check they appear:\n`) === 1 && COUNT(rootReadme, 'Start a new Claude Code session and check they appear:') === 1, 'the launch paragraph stands once with one blank line on each side directly before the preserved user-level installation sentence');
      check(r.includes('V2 validation rejects the schema-3 manifest of a migrated project, so roll the project back with the tooling used for the update before reverting the installed skill') && r.includes('project-setup/RELEASE-NOTES-2.0.0.md` is the 2.0.0 history.'), 'the adjacent v2 compatibility and rollback instructions are preserved');
      check(!/3\.0\.0-rc\.2/.test(tree) && t.includes('agent scaffolding (3.0.0-rc.3)') && t.includes('(`project-setup/VERSION` is `3.0.0-rc.3`)') && t.includes(squash(C16_BLOCKS.ROOT_TREE_SENT.join(' '))) && !t.includes('blocked on host measurements that are still pending'), 'project-tree names rc.3 and carries the frozen blocker sentence');
    });
    await step('the new host-documentation prose is ASCII within 100 columns (README, references/claude.md, references/codex.md, references/security.md; tables and fences keep their exemption), exactly 100 columns passes and 101 fails', async () => {
      for (const rel of ['README.md', 'references/claude.md', 'references/codex.md', 'references/security.md']) {
        const cur = doc(rel); const pre = preText(fx, rel);
        if (cur === null || pre === null) continue;
        const issues = newProseIssues(cur, pre);
        check(issues.length === 0, `${rel}: every newly written line is ASCII and at most 100 columns`, issues.slice(0, 6));
      }
      const sec = doc('references/security.md'); const pre = preText(fx, 'references/security.md');
      if (sec !== null && pre !== null) {
        const first = C16_BLOCKS.SE_NEW[0];
        check(sec.includes(first) && newProseIssues(sec.replace(first, () => 'q'.repeat(100)), pre).length === 0 && newProseIssues(sec.replace(first, () => 'q'.repeat(101)), pre).some((m) => /is 101 columns/.test(m)), 'security.md: exactly 100 columns passes and 101 fails');
      }
    });
    flushProcessCount(context, 'A5-templates/C16/host-docs', mark);
  });
}

// ============================================ shared apply scaffolding ====
// The real apply and lock scripts on synthetic repositories (shell-free child processes). prepare, diff and init need no lock; commit and rollback do.
const PROJECT_NAME = 'c16-svc';
const I_REVIEWER = '.ai/agents/reviewer.md';
const I_DOCSYNC = '.ai/agents/docs-sync.md';
const I_CLAUDE = 'CLAUDE.md';
const I_MANIFEST = '.ai/manifest.json';
const I_CODEX_REVIEWER = '.codex/agents/reviewer.toml';
const I_CODEX_DOCS = '.codex/agents/docs_sync.toml';
const I_CLAUDE_REVIEWER = '.claude/agents/reviewer.md';
const I_CLAUDE_DOCS = '.claude/agents/docs-sync.md';
const I_NESTED = 'src/payments/CLAUDE.md';
const DS = '.ai/agents/docs-sync.project.md';
const RV = '.ai/agents/reviewer.project.md';
const RUNTIME_MEMBERS = ['security-policy.mjs', 'git-safe-core.mjs', 'guard-raw-git-core.mjs', 'review-diff.mjs', 'git-safe.mjs', 'guard-raw-git.mjs', 'hooks-selftest.mjs'];
// C17 (plan C17-12/C17-13, F1): the delivery to an installed rc.1 or rc.2 project is staged from the CURRENT (rc.4) skill, so review-diff.mjs, which C17 changes through one exact amendment, joins the changed runtime members.
const CHANGED_RUNTIME = ['git-safe-core.mjs', 'review-diff.mjs', 'hooks-selftest.mjs'];
const C17_REVIEW_DIFF_REL = 'assets/tools/review-diff.mjs';
const C17_REVIEW_DIFF_PRE_SHA = 'ae236ae32405497d5c9bb2340a5cebbe45d37b1c6d50367b478523cf7de06d83';
const RUNTIME_TARGETS = RUNTIME_MEMBERS.map((m) => `.ai/tools/${m}`);
const PROJECT_GITIGNORE = '.claude/settings.local.json\nCLAUDE.local.md\n';
const BASE_FILES = { 'package.json': '{"name":"c16-app"}\n', 'README.md': '# c16\n', '.gitignore': PROJECT_GITIGNORE, 'src/index.ts': 'export const ready = true;\n' };
const RUN_A = 'run-c16-a';
const RUN_B = 'run-c16-b';
const manifestOf = (files, over = {}) => jsonText({ schema: 3, skill: 'project-setup', skillVersion: '3.0.0-rc.2', mode: 'update', agents: [], sourceCommit: null, files, ...over });
const renderAgent = (text) => text.split('{{PROJECT_NAME}}').join(PROJECT_NAME);
const draftOf = (root, id, rel) => path.join(root, '.ai', '.run', id, 'drafts', ...rel.split('/'));
const projectOf = (root, rel) => path.join(root, ...rel.split('/'));
const runFileOf = (root, id, name) => path.join(root, '.ai', '.run', id, name);
function makeKit(context, check) {
  const scripts = (name) => path.join(context.skillRoot, 'scripts', `${name}.mjs`);
  const launch = (label, name, args, cwd) => {
    const r = execNode(context, { cwd, script: scripts(name), args });
    if (r.dead) check(false, `${label}: the process did not end normally`, r.dead);
    return r;
  };
  const apply = (root, args) => launch(`apply ${args[0]}`, 'apply', args, root);
  const lock = (root, args) => launch(`lock ${args[0]}`, 'lock', args, root);
  return {
    apply, lock, launch,
    begin(root, id) {
      const a = lock(root, ['acquire', '--run-id', id]);
      const b = apply(root, ['init', '--run-id', id]);
      check(a.code === 0 && b.code === 0, `begin ${id}: lock acquire and init succeed`, { a: a.stdout.slice(0, 200), b: b.stdout.slice(0, 200) });
      return a.code === 0 && b.code === 0;
    },
    stage(root, id, drafts) { for (const [rel, text] of Object.entries(drafts)) putFile(draftOf(root, id, rel), text); },
    prepare(root, id, approve = []) {
      const args = ['prepare', '--run-id', id, '--mode', 'update'];
      if (approve.length) args.push('--approve-user-content', approve.join(','));
      return apply(root, args);
    },
    diff: (root, id) => apply(root, ['diff', '--project', root, '--run-id', id]),
    commit: (root, id, planSha) => apply(root, ['commit', '--run-id', id, '--approved-plan', planSha]),
    rollback: (root, id) => apply(root, ['rollback', '--run-id', id]),
    release: (root, id) => lock(root, ['release', '--run-id', id]),
  };
}
const rejectionOf = (r, target) => (r.json && Array.isArray(r.json.errors) ? r.json.errors.find((e) => e.target === target) : undefined);
const readManifestOf = (root) => readJson(projectOf(root, I_MANIFEST));
const SHARED_BASES = new Map();
function sharedBase(context) {
  const have = SHARED_BASES.get(context.tmp);
  if (have !== undefined && exists(have)) return have;
  fs.mkdirSync(context.tmp, { recursive: true });
  const dir = makeRepo(context, fs.mkdtempSync(path.join(context.tmp, 'c16-shared-base-')), { ...BASE_FILES });
  SHARED_BASES.set(context.tmp, dir);
  return dir;
}

// ============================================ V2/C16/update ====
// Plan C16-4, C16-9, C16-13, C16-15, C16-16 item 6 and C16-22: an installed rc.1 or rc.2 project takes the C16 instructions through the normal reviewed managed transaction (real prepare, diff, commit, rollback, validate): the root CLAUDE.md claude block (user text outside
// the blocks kept), both canonical agents, both Codex wrappers and the complete seven-file runtime unit (core and hooks-selftest changed, five members byte-identical) are delivered; the nested Claude template, its import and ownership and both Claude wrappers are unchanged; project extensions
// keep their bytes and merged records; every edited canonical, runtime or wrapper file needs its own exact path approval; a kept or removed required file is an explicitly incomplete update (never silently restored); a changed prepared input is refused as drift; a no-op rerun is a zero diff;
// rollback restores unchanged outputs and a later edit keeps exit 6 with its backup. The baselines are the pinned pre-C16 bytes (rc.2: tests/fixtures/c16-prechange.json; rc.1: the pinned rc.1 agents of tests/fixtures/c13-rc1-agents.json and the authentic rc.1 root template, the literal RC1_ROOT_TEMPLATE_B64 below (the bytes of project-setup/assets/templates/CLAUDE.md at the pinned rc.1 source commit 8b9b4772, hash-checked against RC1_ROOT_TEMPLATE_SHA before use);
// PLAN-GAP: no fixture pins the rc.1 wrappers or runtime unit, so the rc.1 manifest takes the pre-C16 bytes for those) and the expectation is rendered independently (the pre-C16 bytes plus the frozen amendments).
const RC1_ROOT_TEMPLATE_SHA = '2762eadfda90518f841b455ed0e37676b17fcdd7be260bab039a663c8a0c7ab8';
const RC1_ROOT_TEMPLATE_B64 = 'QEFHRU5UUy5tZAoKPCEtLSBwcm9qZWN0LXNldHVwOmJlZ2luIGlkPWNsYXVkZSAtLT4KIyMgQ2xhdWRlIENvZGUKCi0gU2hhcmVkIHJ1bGVzIGxpdmUgaW4gQUdFTlRTLm1kIChpbXBvcnRlZCBhYm92ZSkuIFB1dCBvbmx5IENsYXVkZS1zcGVjaWZpYyBub3RlcyBoZXJlLgotIFN1YmFnZW50czogYHJldmlld2VyYCwgYGRvY3Mtc3luY2AgaW4gYC5jbGF1ZGUvYWdlbnRzL2A7IGJvdGggbG9hZCB0aGVpciBjYW5vbmljYWwgZGVmaW5pdGlvbiBmcm9tIGAuYWkvYWdlbnRzL2AuCi0gU2VjcmV0IHBhdGhzIGFyZSBlbmZvcmNlZCBieSBgcGVybWlzc2lvbnMuZGVueWAgaW4gYC5jbGF1ZGUvc2V0dGluZ3MuanNvbmA7IHRyZWF0IGEgZGVuaWFsIGFzIGZpbmFsLgo8IS0tIHByb2plY3Qtc2V0dXA6ZW5kIGlkPWNsYXVkZSAtLT4K';
const USER_TAIL = '\n## Local notes\n\n- Run the ledger checks before changing money code.\n';
const DOCS_RULES_TEXT = '# project documentation rules\n\n- Every new endpoint gets an entry in docs/api-conventions.md.\n';
const REVIEW_RULES_TEXT = '# project review rules\n\n- Check the ledger invariants first.\n';
const APPROVAL_EDITED = 'fully managed file was edited by the user since install';
async function update(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const kit = makeKit(context, check);
    const fx = loadFixture(context);
    const blocks = await importOrFail(failures, pathToFileURL(skillPath(context, 'scripts/blocks.mjs')).href, 'scripts/blocks.mjs');
    const validate = await importOrFail(failures, pathToFileURL(skillPath(context, 'scripts/validate.mjs')).href, 'scripts/validate.mjs');
    const rc1doc = readJson(skillPath(context, 'tests/fixtures/c13-rc1-agents.json'));
    const rc1 = {};
    if (rc1doc && Array.isArray(rc1doc.entries)) for (const e of rc1doc.entries) rc1[e.path] = Buffer.from(e.base64, 'base64').toString('utf8');
    if (!blocks || !validate || rc1['assets/agents/reviewer.md'] === undefined) { check(false, 'blocks.mjs, validate.mjs and the pinned rc.1 agents are available'); return; }
    // The independent expectation: pre-C16 bytes plus the frozen amendments. The installed source is only compared with it.
    const modelOf16 = (rel) => modelOf(fx, rel);
    const oldOf = (rel) => preText(fx, rel);
    const expected = {}; const old = {};
    for (const rel of ['assets/agents/reviewer.md', 'assets/agents/docs-sync.md', 'assets/templates/CLAUDE.md', 'assets/wrappers/codex-reviewer.toml', 'assets/wrappers/codex-docs_sync.toml', 'assets/tools/git-safe-core.mjs', 'assets/tools/hooks-selftest.mjs']) {
      expected[rel] = modelOf16(rel); old[rel] = oldOf(rel);
      if (expected[rel] === null || old[rel] === null) { check(false, `${rel}: the pre-change bytes take the frozen amendments exactly once`); return; }
    }
    // C17 (F1, item 4): the C16 model above is the rc.3 text (historical premise). What the update delivers is the current rc.4 skill: the reviewer is the rc.3 model plus the exact C17 amendment R17, review-diff.mjs is its pre-C17 bytes (the C17 fixture entry,
    // hash-checked; C16 left the file alone, so these are also its pre-C16 bytes) plus the exact C17 amendment RD17, and git-safe-core.mjs has no independent rc.4 expectation (PLAN-GAP: the plan freezes its behavior, not its hunks), so its delivered text is the shipped asset itself.
    const delivered = { ...expected };
    const pre17Review = c17FixtureBytes(context, `project-setup/${C17_REVIEW_DIFF_REL}`);
    if (pre17Review === null || sha(pre17Review) !== C17_REVIEW_DIFF_PRE_SHA) { check(false, 'the C17 fixture holds the pre-C17 review-diff.mjs (raw SHA-256 ae236ae3... of plan C17-12)'); return; }
    old[C17_REVIEW_DIFF_REL] = pre17Review.toString('utf8');
    expected[C17_REVIEW_DIFF_REL] = old[C17_REVIEW_DIFF_REL];
    delivered[C17_REVIEW_DIFF_REL] = applyC17File(old[C17_REVIEW_DIFF_REL], C17_REVIEW_DIFF_REL);
    delivered['assets/agents/reviewer.md'] = applyC17File(expected['assets/agents/reviewer.md'], 'assets/agents/reviewer.md');
    if (delivered[C17_REVIEW_DIFF_REL] === null || delivered['assets/agents/reviewer.md'] === null) { check(false, 'the rc.3 models take the exact C17 amendments RD17 and R17 once at their anchors'); return; }
    const currentCore = readText(skillPath(context, 'assets/tools/git-safe-core.mjs'));
    if (currentCore === null) { check(false, 'the shipped git-safe-core.mjs is readable'); return; }
    delivered['assets/tools/git-safe-core.mjs'] = currentCore;
    const current = (rel) => readText(skillPath(context, rel));
    const same = (rel) => current(rel);
    const sourceMissing = ['assets/agents/reviewer.md', 'assets/agents/docs-sync.md', 'assets/templates/CLAUDE.md', 'assets/wrappers/codex-reviewer.toml', 'assets/wrappers/codex-docs_sync.toml', 'assets/wrappers/claude-reviewer.md', 'assets/wrappers/claude-docs-sync.md', 'assets/templates/nested-CLAUDE.md', ...RUNTIME_MEMBERS.map((m) => `assets/tools/${m}`)].filter((r) => current(r) === null);
    if (sourceMissing.length) { check(false, 'the shipped assets are readable', sourceMissing); return; }
    const unchangedRuntime = RUNTIME_MEMBERS.filter((m) => !CHANGED_RUNTIME.includes(m));
    // Installed (old) and delivered (what setup renders from the current assets) text per target.
    const oldClaude = old['assets/templates/CLAUDE.md'] + USER_TAIL;
    const newClaude = current('assets/templates/CLAUDE.md') + USER_TAIL;
    const expClaude = expected['assets/templates/CLAUDE.md'] + USER_TAIL;
    // The authentic rc.1 root template: hash-checked before any use (a wrong literal stops the descriptor).
    const rc1Template = Buffer.from(RC1_ROOT_TEMPLATE_B64, 'base64');
    if (sha(rc1Template) !== RC1_ROOT_TEMPLATE_SHA) { check(false, 'the pinned rc.1 root template literal hashes to the rc.1 source commit digest', sha(rc1Template)); return; }
    const rc1Claude = rc1Template.toString('utf8') + USER_TAIL;
    const oldBlocks = blocks.blockHashes(oldClaude).hashes; const newBlocks = blocks.blockHashes(newClaude).hashes; const expBlocks = blocks.blockHashes(expClaude).hashes;
    const TARGETS = {
      [I_REVIEWER]: { old: renderAgent(old['assets/agents/reviewer.md']), cur: renderAgent(current('assets/agents/reviewer.md')), exp: renderAgent(delivered['assets/agents/reviewer.md']) },
      [I_DOCSYNC]: { old: renderAgent(old['assets/agents/docs-sync.md']), cur: renderAgent(current('assets/agents/docs-sync.md')), exp: renderAgent(expected['assets/agents/docs-sync.md']) },
      [I_CODEX_REVIEWER]: { old: old['assets/wrappers/codex-reviewer.toml'], cur: current('assets/wrappers/codex-reviewer.toml'), exp: expected['assets/wrappers/codex-reviewer.toml'] },
      [I_CODEX_DOCS]: { old: old['assets/wrappers/codex-docs_sync.toml'], cur: current('assets/wrappers/codex-docs_sync.toml'), exp: expected['assets/wrappers/codex-docs_sync.toml'] },
      [I_CLAUDE_REVIEWER]: { old: same('assets/wrappers/claude-reviewer.md'), cur: same('assets/wrappers/claude-reviewer.md'), exp: same('assets/wrappers/claude-reviewer.md') },
      [I_CLAUDE_DOCS]: { old: same('assets/wrappers/claude-docs-sync.md'), cur: same('assets/wrappers/claude-docs-sync.md'), exp: same('assets/wrappers/claude-docs-sync.md') },
      [I_NESTED]: { old: '@AGENTS.md\n', cur: current('assets/templates/nested-CLAUDE.md'), exp: '@AGENTS.md\n' },
    };
    for (const m of RUNTIME_MEMBERS) {
      const rel = `assets/tools/${m}`;
      TARGETS[`.ai/tools/${m}`] = CHANGED_RUNTIME.includes(m) ? { old: old[rel], cur: current(rel), exp: delivered[rel] } : { old: current(rel), cur: current(rel), exp: current(rel) };
    }
    const FULL = Object.keys(TARGETS);
    const CHANGED = [I_REVIEWER, I_DOCSYNC, I_CODEX_REVIEWER, I_CODEX_DOCS, ...CHANGED_RUNTIME.map((m) => `.ai/tools/${m}`)];
    const UNCHANGED = FULL.filter((t) => !CHANGED.includes(t));
    await step('the premises: every delivered text equals the independent expectation (pre-C16 bytes plus the frozen amendments); exactly the two agents, the two Codex wrappers, the root claude block and two runtime members differ from the pre-C16 text and the nested template, both Claude wrappers and five runtime members do not; the claude block hash alone moves in CLAUDE.md; an installed rc.2 manifest already carries ... the prechange VERSION and the current VERSION differs', async () => {
      for (const t of FULL) check(TARGETS[t].cur === TARGETS[t].exp, `${t}: the shipped asset renders to exactly the independent expectation`);
      check(newClaude === expClaude && newClaude !== oldClaude, 'the shipped root template (with the same user text) equals the independent expectation and differs from the pre-C16 template');
      check(eq(CHANGED.slice().sort(), FULL.filter((t) => TARGETS[t].old !== TARGETS[t].cur).sort()), 'exactly the seven managed files (the six C16 files plus review-diff.mjs, which C17 changes) differ between the pre-C16 and current texts', FULL.filter((t) => TARGETS[t].old !== TARGETS[t].cur));
      check(UNCHANGED.length === 7 && UNCHANGED.includes(I_NESTED) && UNCHANGED.includes(I_CLAUDE_REVIEWER) && UNCHANGED.includes(I_CLAUDE_DOCS) && unchangedRuntime.length === 4, 'the nested Claude template, both Claude wrappers and four runtime members are unchanged (seven unchanged targets)', UNCHANGED.length);
      // C17 (F1, item 4): the independent rc.3 model is compared only with the pre-C17 view of the shipped files, never with the current rc.4 bytes.
      check(pre17Text(context, 'assets/agents/reviewer.md') === expected['assets/agents/reviewer.md'] && pre17Text(context, 'assets/tools/git-safe-core.mjs') === expected['assets/tools/git-safe-core.mjs'] && pre17Text(context, C17_REVIEW_DIFF_REL) === expected[C17_REVIEW_DIFF_REL], 'the independent rc.3 model equals the pre-C17 view of the reviewer, the core and review-diff.mjs (the historical premise, separate from the delivered rc.4 bytes)');
      check(TARGETS[I_REVIEWER].cur !== renderAgent(expected['assets/agents/reviewer.md']) && current('assets/tools/git-safe-core.mjs') !== expected['assets/tools/git-safe-core.mjs'] && current(C17_REVIEW_DIFF_REL) !== expected[C17_REVIEW_DIFF_REL], 'the shipped reviewer, core and review-diff.mjs are not the rc.3 model: the update stages the current rc.4 bytes');
      check(eq(Object.keys(oldBlocks), ['claude']) && newBlocks.claude !== oldBlocks.claude && newBlocks.claude === expBlocks.claude, 'the root template has one managed block, claude, whose hash moves', { old: oldBlocks, new: newBlocks });
      const pv = fx.files.VERSION === undefined ? null : fx.files.VERSION.toString('utf8');
      const cv = readText(skillPath(context, 'VERSION'));
      check(pv === '3.0.0-rc.2\n' && cv !== null && cv !== pv, 'the prechange VERSION is 3.0.0-rc.2 (the rc.2 manifest skillVersion) and the current VERSION differs', { pv, cv });
      check(Buffer.compare(Buffer.from(TARGETS[I_NESTED].cur), Buffer.from('@AGENTS.md\n')) === 0, 'the nested Claude template is exactly "@AGENTS.md" plus LF');
    });
    const versionFile = (readText(skillPath(context, 'VERSION')) || '').trim();
    await withScratch(context, 'update', async (dir) => {
      const base = sharedBase(context);
      const recordOf = (t, text) => (t === I_CLAUDE ? { ownership: 'blocks', blocks: blocks.blockHashes(text).hashes } : { ownership: 'full', sha256: NH(text) });
      // An installed project: the installed (old) bytes, the manifest records, optional user extensions.
      const project = (name, { version = '3.0.0-rc.2', agents = null, edits = {}, omit = [], ds = null, rv = null, claude = oldClaude } = {}) => {
        const root = copyTree(base, path.join(dir, name));
        const files = {}; const recs = {};
        for (const t of FULL) {
          if (omit.includes(t)) continue;
          let text = TARGETS[t].old;
          if (agents && t === I_REVIEWER) text = renderAgent(agents.reviewer);
          if (agents && t === I_DOCSYNC) text = renderAgent(agents.docsync);
          recs[t] = recordOf(t, text);
          files[t] = edits[t] !== undefined ? edits[t] : text;
        }
        if (!omit.includes(I_CLAUDE)) { files[I_CLAUDE] = edits[I_CLAUDE] !== undefined ? edits[I_CLAUDE] : claude; recs[I_CLAUDE] = recordOf(I_CLAUDE, claude); }
        if (ds !== null) { files[DS] = ds; recs[DS] = { ownership: 'merged' }; }
        if (rv !== null) { files[RV] = rv; recs[RV] = { ownership: 'merged' }; }
        for (const [rel, data] of Object.entries(files)) putFile(projectOf(root, rel), data);
        putFile(projectOf(root, I_MANIFEST), manifestOf(recs, { skillVersion: version }));
        return root;
      };
      const drafts = (over = {}) => {
        const d = {};
        for (const t of FULL) d[t] = TARGETS[t].cur;
        d[I_CLAUDE] = newClaude;
        return { ...d, ...over };
      };
      const names = [...FULL, I_CLAUDE];
      const validateRows = async (root) => {
        const r = await validate.main(['--json'], { root, files: ['package.json', 'README.md', ...names, I_MANIFEST] });
        return JSON.parse(r.stdout).results;
      };
      const expectDelivered = (root, label) => {
        for (const t of FULL) check(readText(projectOf(root, t)) === TARGETS[t].exp, `${label}: ${t} holds the independently rendered expectation`);
        check(readText(projectOf(root, I_CLAUDE)) === expClaude && readText(projectOf(root, I_CLAUDE)).endsWith(USER_TAIL), `${label}: CLAUDE.md holds the new managed block and the user text outside the blocks is kept`);
      };
      const scenario = async (label, project0, extraChecks = null) => {
        const root = project0;
        const rowsBefore = await validateRows(root);
        if (!kit.begin(root, RUN_A)) return;
        kit.stage(root, RUN_A, drafts());
        const p = kit.prepare(root, RUN_A);
        const opTargets = p.json && Array.isArray(p.json.ops) ? p.json.ops.map((o) => o.target).sort() : null;
        check(p.code === 0 && p.json && p.json.ok === true && eq(opTargets, [...CHANGED, I_CLAUDE].sort()) && p.json.ops.every((o) => o.action === 'modify' && o.userContentChange === false) && p.json.unchanged === UNCHANGED.length, `${label}: prepare with no approval plans one modification of exactly the seven changed managed targets (two agents, two Codex wrappers, the claude block of CLAUDE.md, the two runtime members) and keeps eight unchanged`, { code: p.code, ops: opTargets, unchanged: p.json && p.json.unchanged, out: p.stdout.slice(0, 260) });
        if (!(p.json && p.json.planSha256)) return;
        const d = kit.diff(root, RUN_A);
        const fileOf = (t) => d.json && d.json.files && d.json.files.find((x) => x.target === t);
        const shows = (t, needle) => fileOf(t) !== undefined && String(fileOf(t).diff).includes(needle);
        check(d.code === 0 && shows(I_REVIEWER, '+### Correcting rejected git-safe arguments') && shows(I_DOCSYNC, '+### Git-safe file reads') && shows(I_CLAUDE, "+- You MUST start Claude Code at this repository's root.") && shows(I_CODEX_REVIEWER, '+  except for the bounded GIT_SAFE_ARGUMENT/GIT_SAFE_PATTERN correction in the canonical') && shows(I_CODEX_DOCS, '+  except for the bounded GIT_SAFE_ARGUMENT/GIT_SAFE_PATTERN correction in the canonical') && shows('.ai/tools/git-safe-core.mjs', '+function argError(cmd) {') && fileOf('.ai/tools/hooks-selftest.mjs') !== undefined, `${label}: the bound review shows the new instruction, the correction subsections, both wrapper clauses and both runtime changes as added lines`, d.json && d.json.files && d.json.files.map((x) => x.target));
        const c = kit.commit(root, RUN_A, p.json.planSha256);
        check(c.code === 0 && c.json && c.json.committed === true && eq(c.json.written.map((w) => w.target).sort(), [...CHANGED, I_CLAUDE, I_MANIFEST].sort()), `${label}: the plan-hash commit writes exactly the seven changed targets and the manifest`, c.json && c.json.written);
        expectDelivered(root, label);
        const m = readManifestOf(root);
        check(m && m.skillVersion === versionFile && FULL.every((t) => m.files[t] && m.files[t].ownership === 'full' && m.files[t].sha256 === NH(TARGETS[t].exp)) && eq(m.files[I_CLAUDE], { ownership: 'blocks', blocks: expBlocks }), `${label}: the manifest records the new normalized hashes (full) and the new claude block hash (blocks) and the current skill version`, m && m.files && Object.keys(m.files));
        check(m && eq(m.files[I_NESTED], { ownership: 'full', sha256: NH('@AGENTS.md\n') }) && readText(projectOf(root, I_NESTED)) === '@AGENTS.md\n' && readText(projectOf(root, I_CLAUDE_REVIEWER)) === TARGETS[I_CLAUDE_REVIEWER].exp && readText(projectOf(root, I_CLAUDE_DOCS)) === TARGETS[I_CLAUDE_DOCS].exp, `${label}: the nested Claude file, its import and ownership and both Claude wrappers are byte-identical`);
        const rows = await validateRows(root);
        check(!rows.some((x) => x.check === 'drift') && rows.filter((x) => x.check === 'drift').length === rowsBefore.filter((x) => x.check === 'drift').length, `${label}: validate finds no drift after the update`, rows.filter((x) => x.check === 'drift'));
        const dr = kit.launch('blocks drift', 'blocks', ['drift', '--file', I_CLAUDE], root);
        check(dr.json && eq(dr.json.blocks.map((b) => b.state), ['unchanged']), `${label}: the claude block is unchanged against the new baseline`, dr.json);
        check(kit.release(root, RUN_A).code === 0 && kit.begin(root, RUN_B), `${label}: the first run lock is released and a routine rerun begins`);
        kit.stage(root, RUN_B, drafts());
        const manifestBefore = readBytes(projectOf(root, I_MANIFEST));
        const p2 = kit.prepare(root, RUN_B);
        check(p2.code === 0 && p2.json && p2.json.ok === true && p2.json.changed === 0 && p2.json.unchanged === FULL.length + 1 && p2.json.metadataChanged === 0, `${label}: the rerun finds nothing to change`, { code: p2.code, out: p2.stdout.slice(0, 260) });
        const c2 = p2.json && p2.json.planSha256 ? kit.commit(root, RUN_B, p2.json.planSha256) : null;
        check(c2 && c2.code === 0 && c2.json && c2.json.committed === false && /zero diff/.test(String(c2.json.reason)) && Buffer.compare(readBytes(projectOf(root, I_MANIFEST)), manifestBefore) === 0, `${label}: the rerun commit is "nothing to change (zero diff)" and the manifest bytes are identical`, c2 && c2.json);
        if (extraChecks) await extraChecks(root);
      };
      await step('rc.2 installation with merged project extensions and user text outside the claude block: every managed target takes the C16 text through one reviewed transaction (all seven runtime members staged together, five unchanged), both extensions keep their bytes and merged records, no approval is needed for unchanged files, a rerun is a zero diff including the manifest', async () => {
        await scenario('rc.2', project('rc2', { ds: DOCS_RULES_TEXT, rv: REVIEW_RULES_TEXT }), async (root) => {
          const m = readManifestOf(root);
          check(readText(projectOf(root, DS)) === DOCS_RULES_TEXT && readText(projectOf(root, RV)) === REVIEW_RULES_TEXT && eq(m.files[DS], { ownership: 'merged' }) && eq(m.files[RV], { ownership: 'merged' }), 'both optional project extensions keep their bytes and their merged records');
        });
      });
      await step('rc.1 installation (manifest skillVersion 3.0.0-rc.1, the pinned rc.1 agents and the authentic rc.1 root CLAUDE.md template): the same update with the same exact result and the same approvals; the rc.1 hashes, including the claude block hash of the rc.1 root template, come from the installed manifest', async () => {
        const root = project('rc1', { version: '3.0.0-rc.1', claude: rc1Claude, agents: { reviewer: rc1['assets/agents/reviewer.md'], docsync: rc1['assets/agents/docs-sync.md'] } });
        const rc1Blocks = blocks.blockHashes(rc1Claude).hashes;
        const m0 = readManifestOf(root);
        check(sha(Buffer.from(readText(projectOf(root, I_CLAUDE)).slice(0, -USER_TAIL.length), 'utf8')) === RC1_ROOT_TEMPLATE_SHA && readText(projectOf(root, I_CLAUDE)).endsWith(USER_TAIL), 'the installed rc.1 root CLAUDE.md is the authentic rc.1 template (SHA-256 2762eadf...) plus the user text');
        check(m0 && m0.skillVersion === '3.0.0-rc.1' && eq(m0.files[I_CLAUDE], { ownership: 'blocks', blocks: rc1Blocks }) && eq(Object.keys(rc1Blocks), ['claude']) && rc1Blocks.claude !== oldBlocks.claude && rc1Blocks.claude !== newBlocks.claude, 'the rc.1 manifest records the claude block hash of the rc.1 template, which differs from both the pre-C16 rc.2 and the C16 block hashes', { rc1: rc1Blocks, rec: m0 && m0.files[I_CLAUDE] });
        check(rc1Claude !== oldClaude && !rc1Claude.includes('built-in review preamble') && oldClaude.includes('built-in review preamble'), 'the rc.1 root template genuinely differs from the pre-C16 rc.2 template (it lacks the rc.2 built-in-review bullet)');
        await scenario('rc.1', root);
      });
      await step('the unit is staged whole: a plan that stages only the two changed runtime members is refused (the complete reviewed runtime unit is required) and writes nothing; the five unchanged members cannot be left out', async () => {
        const root = project('partial');
        if (!kit.begin(root, RUN_A)) return;
        const part = { [`.ai/tools/git-safe-core.mjs`]: TARGETS['.ai/tools/git-safe-core.mjs'].cur, [`.ai/tools/hooks-selftest.mjs`]: TARGETS['.ai/tools/hooks-selftest.mjs'].cur };
        kit.stage(root, RUN_A, part);
        const before = readBytes(projectOf(root, I_MANIFEST));
        const p = kit.prepare(root, RUN_A);
        check(p.code !== 0 && p.json && p.json.ok === false, 'prepare refuses the incomplete runtime unit', { code: p.code, out: p.stdout.slice(0, 300) });
        check(Buffer.compare(readBytes(projectOf(root, I_MANIFEST)), before) === 0 && readText(projectOf(root, '.ai/tools/git-safe-core.mjs')) === TARGETS['.ai/tools/git-safe-core.mjs'].old && !exists(runFileOf(root, RUN_A, 'plan.json')), 'nothing was written and no plan exists');
      });
      await step('edited managed files are never replaced silently and each needs its own exact path approval: with an edited reviewer, an edited core and an edited Codex reviewer wrapper, no approval rejects all three by name, approving one leaves the other two rejected, a wrong-path approval (an unmodified file) is refused as unrelated, approving all three plans three user-content changes that commit; rollback returns the edited bytes', async () => {
        const edit = (t) => `${TARGETS[t].old}${t.endsWith('.toml') ? '\n# project addition\n' : '\n// project addition\n'}`;
        const editedReviewer = `${TARGETS[I_REVIEWER].old}\n- Project addition: also check the ledger invariants.\n`;
        const edits = { [I_REVIEWER]: editedReviewer, '.ai/tools/git-safe-core.mjs': edit('.ai/tools/git-safe-core.mjs'), [I_CODEX_REVIEWER]: edit(I_CODEX_REVIEWER) };
        const root = project('edited', { edits, ds: DOCS_RULES_TEXT });
        const manifestBefore = readBytes(projectOf(root, I_MANIFEST));
        if (!kit.begin(root, RUN_A)) return;
        kit.stage(root, RUN_A, drafts());
        const E3 = Object.keys(edits);
        const none = kit.prepare(root, RUN_A);
        check(none.code === 3 && none.json && none.json.code === 'APPLY_PLAN_REJECTED' && E3.every((t) => rejectionOf(none, t) && rejectionOf(none, t).code === 'APPLY_APPROVAL_REQUIRED' && String(rejectionOf(none, t).error).startsWith(APPROVAL_EDITED)) && none.json.errors.length === 3 && !exists(runFileOf(root, RUN_A, 'plan.json')), 'missing approval: exactly the three edited files are rejected by name and no plan is written', { code: none.code, errs: none.json && none.json.errors && none.json.errors.map((e) => [e.target, e.code]) });
        const one = kit.prepare(root, RUN_A, [I_REVIEWER]);
        const left = one.json && Array.isArray(one.json.errors) ? one.json.errors.map((e) => e.target).sort() : null;
        check(one.code === 3 && eq(left, E3.filter((t) => t !== I_REVIEWER).sort()), 'approving the reviewer does not approve the core or the wrapper', left);
        const wrong = kit.prepare(root, RUN_A, [I_DOCSYNC]);
        check(wrong.code === 3 && wrong.json && wrong.json.errors.some((x) => x.target === I_DOCSYNC && x.code === 'APPROVAL_UNRELATED' || x.code === 'APPLY_APPROVAL_UNRELATED') && E3.every((t) => rejectionOf(wrong, t) !== undefined), 'a wrong-path approval (an unmodified file) is refused as unrelated and approves none of the three', wrong.json && wrong.json.errors.map((e) => [e.target, e.code]));
        const p = kit.prepare(root, RUN_A, E3);
        check(p.code === 0 && p.json && p.json.ok === true && E3.every((t) => p.json.ops.find((o) => o.target === t && o.userContentChange === true)), 'the three exact approvals plan the three replacements as user-content changes', { code: p.code, out: p.stdout.slice(0, 260) });
        const c = p.json && p.json.planSha256 ? kit.commit(root, RUN_A, p.json.planSha256) : null;
        check(c && c.code === 0 && E3.every((t) => readText(projectOf(root, t)) === TARGETS[t].exp) && readText(projectOf(root, DS)) === DOCS_RULES_TEXT, 'the three files hold the canonical C16 text and the extension is byte-identical');
        const rb = kit.rollback(root, RUN_A);
        check(rb.code === 0 && rb.json && rb.json.complete === true && E3.every((t) => readText(projectOf(root, t)) === edits[t]) && Buffer.compare(readBytes(projectOf(root, I_MANIFEST)), manifestBefore) === 0, 'rollback returns the edited bytes of the three files and the manifest bytes', { code: rb.code, out: rb.stdout.slice(0, 200) });
      });
      await step('the root CLAUDE.md keeps user text outside the managed block: a user-edited claude block is reported edited-by-user by the existing block drift check and the update replaces the managed block while the user text outside it stays (PLAN-GAP: on the reference the existing block mechanism needs no path approval for an edited block whose outside text is unchanged); a draft that also changes text outside the managed blocks is rejected for the exact path approval and takes it', async () => {
        const editedClaude = oldClaude.replace('- Shared rules live in AGENTS.md (imported above). Put only Claude-specific notes here.', '- Shared rules live in AGENTS.md (imported above). Put only Claude-specific notes here.\n- Project addition: the ledger is sacred.');
        const root = project('claude-edited', { edits: { [I_CLAUDE]: editedClaude } });
        const dr = kit.launch('blocks drift', 'blocks', ['drift', '--file', I_CLAUDE], root);
        check(dr.json && eq(dr.json.blocks.map((b) => [b.id, b.state]), [['claude', 'edited-by-user']]), 'the user-edited claude block is reported edited-by-user (the update never decides silently)', dr.json);
        if (!kit.begin(root, RUN_A)) return;
        kit.stage(root, RUN_A, { [I_CLAUDE]: newClaude });
        const p = kit.prepare(root, RUN_A);
        const c = p.json && p.json.planSha256 ? kit.commit(root, RUN_A, p.json.planSha256) : null;
        check(p.code === 0 && c && c.code === 0 && readText(projectOf(root, I_CLAUDE)) === expClaude && readText(projectOf(root, I_CLAUDE)).endsWith(USER_TAIL), 'the managed block takes the new text and the user text outside the block is kept byte for byte', { code: p.code, out: p.stdout.slice(0, 220) });
        const root2 = project('claude-outside');
        if (!kit.begin(root2, RUN_A)) return;
        kit.stage(root2, RUN_A, { [I_CLAUDE]: `${newClaude}\n- A new local rule.\n` });
        const none = kit.prepare(root2, RUN_A);
        check(none.code === 3 && rejectionOf(none, I_CLAUDE) !== undefined && rejectionOf(none, I_CLAUDE).code === 'APPLY_APPROVAL_REQUIRED' && /outside managed blocks/.test(String(rejectionOf(none, I_CLAUDE).error)), 'a draft that changes text outside the managed blocks is rejected by name until the exact path is approved', { code: none.code, errs: none.json && none.json.errors && none.json.errors.map((e) => [e.target, e.code]) });
        const ok = kit.prepare(root2, RUN_A, [I_CLAUDE]);
        check(ok.code === 0 && ok.json && ok.json.ok === true && ok.json.ops.find((o) => o.target === I_CLAUDE && o.userContentChange === true), 'with the exact path approval the plan flags the root file as a user-content change', { code: ok.code, out: ok.stdout.slice(0, 200) });
      });
      await step('a kept old required file is an explicitly incomplete update: when the user keeps everything, the old CLAUDE.md, both Codex wrappers, both agents and the runtime unit stay byte-identical with unchanged manifest records, they differ from the current text and lack the C16 instruction; taking only the agents leaves CLAUDE.md, the wrappers and the runtime unit old', async () => {
        const keep = project('kept');
        if (!kit.begin(keep, RUN_A)) return;
        kit.stage(keep, RUN_A, { 'docs/database.md': '# database\n' });
        const p = kit.prepare(keep, RUN_A);
        check(p.code === 0 && p.json && p.json.ops.length === 1 && p.json.ops[0].target === 'docs/database.md', 'the plan carries no operation for any kept file', { code: p.code, out: p.stdout.slice(0, 260) });
        const c = p.json && p.json.planSha256 ? kit.commit(keep, RUN_A, p.json.planSha256) : null;
        check(c && c.code === 0, 'the unrelated update commits');
        for (const t of CHANGED) check(readText(projectOf(keep, t)) === TARGETS[t].old && readText(projectOf(keep, t)) !== TARGETS[t].exp, `${t}: kept at its pre-C16 bytes, which are not the current text (incomplete)`);
        check(readText(projectOf(keep, I_CLAUDE)) === oldClaude && !readText(projectOf(keep, I_CLAUDE)).includes('MUST start Claude Code'), 'CLAUDE.md is kept without the root-start rule (incomplete)');
        const m = readManifestOf(keep);
        check(m && CHANGED.every((t) => m.files[t].sha256 === NH(TARGETS[t].old)) && eq(m.files[I_CLAUDE].blocks, oldBlocks), 'the manifest records still describe the old definitions');
        const half = project('half');
        if (!kit.begin(half, RUN_A)) return;
        kit.stage(half, RUN_A, { [I_REVIEWER]: TARGETS[I_REVIEWER].cur, [I_DOCSYNC]: TARGETS[I_DOCSYNC].cur });
        const p2 = kit.prepare(half, RUN_A);
        const c2 = p2.json && p2.json.planSha256 ? kit.commit(half, RUN_A, p2.json.planSha256) : null;
        check(p2.code === 0 && c2 && c2.code === 0 && readText(projectOf(half, I_REVIEWER)) === TARGETS[I_REVIEWER].exp && readText(projectOf(half, I_CODEX_REVIEWER)) === TARGETS[I_CODEX_REVIEWER].old && readText(projectOf(half, I_CLAUDE)) === oldClaude && readText(projectOf(half, '.ai/tools/git-safe-core.mjs')) === TARGETS['.ai/tools/git-safe-core.mjs'].old, 'taking only the agents leaves the Codex wrapper, CLAUDE.md and the runtime core old (the update is incomplete)', { code: p2.code, out: p2.stdout.slice(0, 220) });
      });
      await step('a removed required root instruction is not silently recreated: with CLAUDE.md deleted a run that drafts nothing for it commits without recreating it, the manifest entry stays and validation reports it missing on disk; a user-removed claude block is reported removed-by-user and never silently restored by a drift check', async () => {
        const removed = project('removed', { omit: [I_CLAUDE] });
        const rec = recordOf(I_CLAUDE, oldClaude);
        const man = readManifestOf(removed); man.files[I_CLAUDE] = rec; putFile(projectOf(removed, I_MANIFEST), jsonText(man));
        if (!kit.begin(removed, RUN_A)) return;
        kit.stage(removed, RUN_A, { 'docs/database.md': '# database\n' });
        const p = kit.prepare(removed, RUN_A);
        const c = p.json && p.json.planSha256 ? kit.commit(removed, RUN_A, p.json.planSha256) : null;
        check(c && c.code === 0 && !exists(projectOf(removed, I_CLAUDE)) && readManifestOf(removed).files[I_CLAUDE] !== undefined, 'CLAUDE.md is not recreated and its manifest entry is kept', { code: p.code, out: p.stdout.slice(0, 220) });
        const rows = await validate.main(['--json'], { root: removed, files: ['package.json', 'docs/database.md', I_MANIFEST] });
        const drift = JSON.parse(rows.stdout).results.filter((x) => x.check === 'drift' && x.level === 'warn').map((x) => x.detail);
        check(drift.includes(`${I_CLAUDE}: in manifest but missing on disk`), 'validate reports the missing root instruction file as drift', drift);
        const noBlock = project('no-block', { edits: { [I_CLAUDE]: `${USER_TAIL.trimStart()}` } });
        const dr = kit.launch('blocks drift', 'blocks', ['drift', '--file', I_CLAUDE], noBlock);
        check(dr.json && eq(dr.json.blocks.map((b) => [b.id, b.state]), [['claude', 'removed-by-user']]), 'a removed claude block is reported removed-by-user', dr.json);
        check(squash(sourceText(context, 'references/modes.md') || '').includes('`removed-by-user`: do not re-add; ask.'), 'the existing update-mode rule "do not re-add; ask" stays');
      });
      await step('a changed prepared input is refused: after prepare, one staged draft (the core) is altered and the plan-hash commit exits 4 as drift with nothing written; and rollback after a successful update restores every unchanged-output file and the manifest, while a later edit keeps exit 6, leaves that edit and retains its backup', async () => {
        const root = project('drift');
        if (!kit.begin(root, RUN_A)) return;
        kit.stage(root, RUN_A, drafts());
        const p = kit.prepare(root, RUN_A);
        if (!(p.json && p.json.planSha256)) { check(false, 'the update prepares', p.stdout.slice(0, 200)); return; }
        const manifestBefore = readBytes(projectOf(root, I_MANIFEST));
        fs.appendFileSync(draftOf(root, RUN_A, '.ai/tools/git-safe-core.mjs'), '// changed after review\n');
        const c = kit.commit(root, RUN_A, p.json.planSha256);
        check(c.code === 4 && c.json && c.json.ok === false && c.json.code === 'APPLY_DRIFT' && Buffer.compare(readBytes(projectOf(root, I_MANIFEST)), manifestBefore) === 0 && readText(projectOf(root, '.ai/tools/git-safe-core.mjs')) === TARGETS['.ai/tools/git-safe-core.mjs'].old, 'the changed input is refused as APPLY_DRIFT (exit 4) and nothing is written', { code: c.code, out: c.stdout.slice(0, 260) });
        const root2 = project('rollback', { ds: DOCS_RULES_TEXT });
        const man0 = readBytes(projectOf(root2, I_MANIFEST));
        const unchangedBefore = Object.fromEntries(UNCHANGED.map((t) => [t, readBytes(projectOf(root2, t))]));
        if (!kit.begin(root2, RUN_A)) return;
        kit.stage(root2, RUN_A, drafts());
        const p2 = kit.prepare(root2, RUN_A);
        const c2 = p2.json && p2.json.planSha256 ? kit.commit(root2, RUN_A, p2.json.planSha256) : null;
        check(c2 && c2.code === 0, 'the update commits before the rollback', { code: p2.code, out: p2.stdout.slice(0, 200) });
        fs.appendFileSync(projectOf(root2, '.ai/tools/git-safe-core.mjs'), '// later edit\n');
        const rb = kit.rollback(root2, RUN_A);
        const skipped = rb.json && Array.isArray(rb.json.skipped) ? rb.json.skipped.map((x) => x.target).sort() : null;
        check(rb.code === 6 && rb.json && rb.json.ok === false && eq(skipped, ['.ai/tools/git-safe-core.mjs']), 'rollback is incomplete (exit 6) and skips exactly the later-edited core', { code: rb.code, out: rb.stdout.slice(0, 400) });
        check(readText(projectOf(root2, '.ai/tools/git-safe-core.mjs')) === `${TARGETS['.ai/tools/git-safe-core.mjs'].exp}// later edit\n` && CHANGED.filter((t) => t !== '.ai/tools/git-safe-core.mjs').every((t) => readText(projectOf(root2, t)) === TARGETS[t].old) && readText(projectOf(root2, I_CLAUDE)) === oldClaude && Buffer.compare(readBytes(projectOf(root2, I_MANIFEST)), man0) === 0 && UNCHANGED.every((t) => Buffer.compare(readBytes(projectOf(root2, t)), unchangedBefore[t]) === 0) && readText(projectOf(root2, DS)) === DOCS_RULES_TEXT, 'the later edit remains; every other changed file, CLAUDE.md and the manifest are restored; unchanged outputs and the extension are untouched');
        check(exists(path.join(root2, '.ai', '.run', RUN_A, 'vault', 'backup', '.ai', 'tools', 'git-safe-core.mjs')), 'the backup of the edited core is retained for the user to resolve');
      });
    });
    flushProcessCount(context, 'V2/C16/update', mark);
  });
}

// ============================================ RC1/C16/release ====
// Plan C16-4, C16-11, C16-13, C16-14 and C16-F1/C16-F2: the release bookkeeping. VERSION is exactly 3.0.0-rc.3 plus LF; the SKILL heading, the README heading and its two local-release tags are rc.3; the CHANGELOG gains exactly the rc.3 entry before the preserved rc.2 and rc.1
// entries; RELEASE-NOTES-3.0.0-rc.3.md is exactly the frozen text; the rc.2 notes stay byte for byte; the root TODO.md takes the three C16 amendments in either accepted headroom state and, after the named reversal H8D85, still reaches the inspected HEAD and the 8d85ec6^ bytes (the a290389 baseline of
// RC1/C14/release was red: 7 PASS / 1 FAIL because 8d85ec6 edited the headroom entry after the C15 acceptance run; H8D85 repairs that exact historical comparison and nothing is suppressed); the core and hooks-selftest runtime members changed and the five others, both Claude wrappers, the nested template, the
// release builder, the installer, the catalog, the v2 snapshots and every earlier record did not; the payload keeps its 60 members; nothing here claims publication, a tag, a real scaffold or host enforcement.
const UNCHANGED_PINS = [
  ['assets/tools/security-policy.mjs', '2ded982e54580fc993add5b4003bc892dd08e230ea3c7d98892fccdb6fc83dbb'],
  ['assets/tools/guard-raw-git-core.mjs', 'cee120da3205767a4b2e17515948be55185d047175c8f5d91d38eeaa4d9210c9'],
  ['assets/tools/review-diff.mjs', 'ae236ae32405497d5c9bb2340a5cebbe45d37b1c6d50367b478523cf7de06d83'],
  ['assets/tools/git-safe.mjs', '995bafa72582acad616982549e4c0aa581831bc25b132f83a533f7bad91bb154'],
  ['assets/tools/guard-raw-git.mjs', '7b6b8e7e5d11850656f8395563c0f6d0788a234fbc01b9642b30ae231862276e'],
  ['assets/templates/nested-CLAUDE.md', '336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49'],
  ['assets/templates/AGENTS.md', '616a26a54d2e8f77b0d4df3e78055ca41f6e7638654ad70a0f4d28a0e4eb5a0e'],
  ['assets/templates/nested-AGENTS.md', '11cd44a06e9e50023e8ddcb5e8d476e2338b206c2973e6d4ef6f53997b1ed370'],
  ['assets/wrappers/claude-reviewer.md', '284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423'],
  ['assets/wrappers/claude-docs-sync.md', '36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43'],
  ['data/runtime-units.json', 'a1867f13ce2760cb1a676a48cdaac5a9fe4a868220dbaf7f528b169b64678ef6'],
  ['data/secret-paths.json', '37711ab7b8e1781ce533c705971f93351f1331a44b16e11e846080eb8fed1a79'],
  ['scripts/apply.mjs', '5f2ea3801be0ecae370a453e8a822c336e404c7622bac276a9a873d069da6874'],
  ['scripts/validate.mjs', '5b4de7189fdfebed53efa14e2e86524462becdab62b800448a435f0807bc6070'],
  ['scripts/doctor.mjs', '7d9ee5f39931f13a35a5a9a9bb42e1af6977469485f7debb44a95acb6b8d8d06'],
  ['scripts/schemas.mjs', '48e4cdedf5a44f097f88da54820e81e1e432fcb53a2db887f864588a01f0ae22'],
  ['scripts/detect.mjs', '485bacd5200319f03b41006fae447718639a74edba4306da63a3e8a9ca4af982'],
  ['scripts/ownership.mjs', 'dd936e399d465115acf58644024c0b7b179a95a88c0874fd7ed4b7528d13c864'],
  ['scripts/blocks.mjs', 'fcb6606fbfae71b69033bf09c09d608ac65333234c9ae14d212b112daec20753'],
  ['scripts/lib.mjs', '7a3f8d32cd1af31f20ff67888cd483165e8dbdfb77a28eb50df21e30bb4cb8fd'],
  ['scripts/check-agent-baselines.mjs', '905c0254d37026eac46aa16976db7726b8abb08349352941f781ce232dae9be8'],
  ['install/install.mjs', '9e22d4192aed1c504053e9c499bdaf98450a7bd0a80e44b0aeb4b11b19d5b947'],
  ['install/release.mjs', '59411fee9168dd936e3e049f5e6242c93cb89c5207a574df181c259f961ba941'],
  ['tests/accept-rc1.mjs', 'bb75d010152971f95dcdd5663794bc8d3ab0f8cacd99cc474636c6f0ce6155ea'],
  ['tests/run-component-tests.mjs', '864b037dcb03eeecca4ef52bc1802a4c4e98ab0ac17a56013c2d7e72a17491df'],
  ['tests/live/LIVE-ACCEPTANCE.md', '6ec4caa7a501e7baab887427f736e36a0e46de881376e546903890757baefa67'],
  ['tests/helpers/c15-amendments.mjs', '724688e375a33a1d7236b95acba2196dbab5a1f2c0846de128f8c1d490a13725'],
  ['tests/helpers/prose-check.mjs', '465531aaf0b733045a4af1b51fc91737d7e08465ad93bcfb8b3e09b76ed8d1b0'],
  ['tests/fixtures/c13-rc1-agents.json', '8d39154626167e0e3b427e0688ab2e088052a42f8b2b074662eec84a609758e2'],
  ['tests/fixtures/c14-prechange.json', 'fc7e57ca8fb04b2f611057630ca9213798f49c18153ed13067b53a1711770175'],
  ['tests/fixtures/c15-prechange.json', '79e0c2ddb56dd45b314006a4aa6fb4db4bb817e0cb308194710ef11f755fe3ad'],
];
// The independently computed identity of every amended file (the pinned pre-C16 bytes plus the frozen amendments, computed by the tests lane before any implementation existed; PLAN-GAP: the plan pins only core, template, hooks-selftest and the wrappers).
const MODEL_SHA = {
  'assets/agents/reviewer.md': 'd3d56613', 'assets/agents/docs-sync.md': '60539891', 'SKILL.md': '911cc865', 'README.md': 'f356008b', 'references/claude.md': '97d0f72e', 'references/codex.md': '62ab1838',
  'references/security.md': '28af6303', 'references/docs-generation.md': 'cabdf9cd', 'CHANGELOG.md': '73eacec1',
};
const SECTIONS = ['Changes', 'Compatibility and rollback', 'Verification', 'Pending host measurements', 'Limitations', 'Provenance and release artifacts'];
const NOTES_HEX_RE = /(?<![0-9a-f])(?:[0-9a-f]{64}|[0-9a-f]{40})(?![0-9a-f])/i;
const ACCEPTANCE_REL = 'docs/plans/2026-10-25-project-setup-v3-rc3-c16-acceptance.md';
// Plan C16-13: the TODO measurement values are bound to the designated measurement lines of the acceptance record, never to loose substrings: the run date (the first line of the fenced block under "## The run"), the one accept-rc1 command line of that block (its elapsed seconds) and the one
// "Full acceptance took" sentence under "## Acceptance headroom" (elapsed, remaining = 1800 - elapsed and percent = ((1800 - elapsed) / 1800 * 100).toFixed(1)). Returns { ok, problems, derived }; each problem starts with a stable tag.
function acceptanceEvidence(record, values) {
  const problems = []; const derived = {};
  const lines = LF(record).split('\n');
  const sectionOf = (h) => { const i = lines.findIndex((l) => l === h); if (i < 0) return null; let j = i + 1; while (j < lines.length && !/^## /.test(lines[j])) j++; return lines.slice(i + 1, j); };
  const run = sectionOf('## The run'); const head = sectionOf('## Acceptance headroom');
  if (run === null) problems.push('run-section: the "## The run" section is missing');
  if (head === null) problems.push('headroom-section: the "## Acceptance headroom" section is missing');
  let block = null;
  if (run !== null) {
    const a = run.indexOf('```text'); const b = a < 0 ? -1 : run.indexOf('```', a + 1);
    if (a < 0 || b < 0) problems.push('run-block: the fenced text block under "## The run" is missing'); else block = run.slice(a + 1, b);
  }
  let runSeconds = null;
  if (block !== null) {
    const dm = /^Date: (\d{4}-\d{2}-\d{2}), \d{2}:\d{2}:\d{2} to \d{2}:\d{2}:\d{2} host clock$/.exec(block[0] || '');
    if (dm === null || block.filter((l) => l.startsWith('Date:')).length !== 1) problems.push('run-date: the first line of the run block is not the one run-date line'); else derived.date = dm[1];
    const cmds = block.filter((l) => l.includes('accept-rc1.mjs'));
    const cm = cmds.length === 1 ? /^\s*node project-setup\/tests\/accept-rc1\.mjs\s+exit 0\s+ACCEPT-RC1 PASS full\s+(\d+) s\s*$/.exec(cmds[0]) : null;
    if (cm === null) problems.push(`accept-line: the run block does not hold exactly one accept-rc1 command line (found ${cmds.length})`); else runSeconds = Number(cm[1]);
  }
  const SENT = /^Full acceptance took (\d+) s against the unchanged 1,800,000 ms timeout: (\d+) s or (\d+\.\d)% headroom\.$/;
  const sentLines = lines.filter((l) => l.includes('Full acceptance took'));
  const inSection = head === null ? [] : head.filter((l) => l.includes('Full acceptance took'));
  const sm = sentLines.length === 1 && inSection.length === 1 ? SENT.exec(sentLines[0]) : null;
  if (sm === null) problems.push(`sentence: the record does not hold exactly one well-formed headroom sentence, under "## Acceptance headroom" (found ${sentLines.length}, ${inSection.length} in the section)`);
  else {
    const elapsed = Number(sm[1]); const remaining = Number(sm[2]);
    if (runSeconds !== null && elapsed !== runSeconds) problems.push(`sentence-vs-run: the sentence says ${elapsed} s but the accept-rc1 line says ${runSeconds} s`);
    if (remaining !== 1800 - elapsed || sm[3] !== ((1800 - elapsed) / 1800 * 100).toFixed(1)) problems.push('sentence-arithmetic: the remaining seconds or the percentage do not follow from the elapsed seconds');
    derived.elapsedSeconds = elapsed; derived.remainingSeconds = remaining; derived.headroomPercent = sm[3];
  }
  for (const k of ['date', 'elapsedSeconds', 'remainingSeconds', 'headroomPercent']) {
    if (derived[k] === undefined || values[k] !== derived[k]) problems.push(`todo-${k}: the TODO value ${JSON.stringify(values[k])} is not the recorded measurement ${JSON.stringify(derived[k])}`);
  }
  return { ok: problems.length === 0, problems, derived };
}
// The root TODO.md through the whole normalization sequence of addendum C16-F1: C16's three amendments reversed (hash 28b4fd4f...), then H8D85 (hash 6676d1c9...). Returns { ok, state, text, why }.
function normalizeTodo(text) {
  const r = reverseTodoC16(text);
  if (r.text === null) return { ok: false, state: r.state, why: r.failed };
  if (sha(Buffer.from(r.text, 'utf8')) !== TODO_HASHES.head) return { ok: false, state: r.state, why: 'the C16-reversed TODO is not the inspected HEAD' };
  const h = reverseOne(r.text, H8D85);
  if (h === null) return { ok: false, state: r.state, why: 'H8D85 does not stand once between its anchors' };
  if (sha(Buffer.from(h, 'utf8')) !== TODO_HASHES.pre8d85ec6) return { ok: false, state: r.state, why: 'the H8D85-reversed TODO is not the 8d85ec6^ bytes' };
  return { ok: true, state: r.state, text: h, values: r.values };
}
const NEEDS_TODO_HEADING = '## Needs manual review';
async function release(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const fx = loadFixture(context);
    const text = (rel) => sourceText(context, rel);
    await step('plan C16-13 and C16-F2: VERSION is exactly "3.0.0-rc.3" plus LF without a BOM (the prechange VERSION entry is exactly "3.0.0-rc.2\\n"); no version.json stamp exists; the SKILL heading, the README heading and release paragraph are rc.3', async () => {
      const v = pre17Bytes(context, 'VERSION');
      check(v !== null && v.toString('latin1') === '3.0.0-rc.3\n' && v[0] !== 0xef, 'VERSION is exactly "3.0.0-rc.3\\n" without a BOM', v && v.toString('latin1'));
      const pv = fx.files.VERSION;
      check(pv !== undefined && pv.toString('latin1') === '3.0.0-rc.2\n' && sha(pv) === PRE_PIN.VERSION && v !== null && reverseOne(v.toString('utf8'), AM16.V) === '3.0.0-rc.2\n', 'the verified prechange entry is "3.0.0-rc.2\\n" and reversing V gives it');
      check(!exists(skillPath(context, 'version.json')) && !exists(skillPath(context, 'install/version.json')) && !exists(skillPath(context, 'data/version.json')), 'no version.json stamp is introduced');
      const skill = text('SKILL.md');
      check(skill !== null && skill.split('\n')[5] === '# project-setup 3.0.0-rc.3' && COUNT(skill, '3.0.0-rc.2') === 0, 'line 6 of SKILL.md is the rc.3 heading and no rc.2 text remains in it', skill && skill.split('\n')[5]);
      const readme = text('README.md');
      check(readme !== null && readme.startsWith(`${T(C16_BLOCKS.RM_OPEN)}\n`) && !/3\.0\.0-rc\.2/.test(readme.split('\n').slice(0, 6).join('\n')), 'the README opening is exactly the frozen rc.3 heading and release paragraph');
      check(readme !== null && COUNT(readme, 'node install/release.mjs --tag project-setup-v3.0.0-rc.3 --out <unused-directory>') === 1 && COUNT(readme, 'It never\nrequires or creates project-setup-v3.0.0-rc.3 in the distribution repository.') === 1 && COUNT(readme, 'project-setup-v3.0.0-rc.2') === 0, 'both local-release tag occurrences name project-setup-v3.0.0-rc.3 (and no rc.2 tag remains)');
    });
    await step('plan C16-13: the CHANGELOG gains exactly the frozen rc.3 entry directly after "# Changelog" and one blank line, followed by one blank line and the complete preserved rc.2 entry; reversing LC gives the pre-C16 file (raw SHA-256 3cc6747c...), so the rc.2 and rc.1 entries and the historical suffix are byte for byte; the entry is ASCII within 100 columns; the amended file equals its independently computed model', async () => {
      const r = checkAmendedFile(check, context, fx, 'CHANGELOG.md');
      if (r === null) return;
      check(r.text.startsWith(`# Changelog\n\n${T(C16_BLOCKS.CHANGELOG_ENTRY)}\n## 3.0.0-rc.2\n`) && COUNT(r.text, '\n## 3.0.0-rc.3\n') === 1 && COUNT(r.text, '\n## 3.0.0-rc.2\n') === 1 && COUNT(r.text, '\n## 3.0.0-rc.1\n') === 1, 'the rc.3 entry is first, once, directly before the rc.2 entry, which stays once with the rc.1 entry', r.text.slice(0, 120));
      const entry = squash(C16_BLOCKS.CHANGELOG_ENTRY.join(' '));
      for (const w of ['C16 addresses the R83-e subdirectory-launch failure and the A3/L10 incomplete-review failure.', 'This is an instruction mitigation, not host enforcement; nested Claude templates remain unchanged.', 'git-safe grep now uses extended regular expressions and a content-free pattern probe after a status-128 content failure with empty stdout.', 'only; other failed or denied reads still stop.', 'Manifest schema 3, policy schemas, ownership, approval and rollback behavior are unchanged.', 'R83-e and A3/L10 require re-measurement after this candidate is released.', 'Publication remains a separate authorized action.']) check(entry.includes(w) && squash(r.text).includes(w), `the entry states: ${clip(w)}`);
      check(C16_BLOCKS.CHANGELOG_ENTRY.every((l) => l.length <= 100 && !/[^\x00-\x7f]/.test(l)), 'the frozen entry lines are ASCII within 100 columns');
      const issues = newProseIssues(r.text, preText(fx, 'CHANGELOG.md') || '');
      check(issues.length === 0, 'every newly written line of the changelog is ASCII and at most 100 columns', issues.slice(0, 4));
      const m = sha(Buffer.from(r.text, 'utf8'));
      check(m.startsWith(MODEL_SHA['CHANGELOG.md']), 'the changelog equals the independently computed model (pre-C16 bytes plus LC)', m.slice(0, 8));
      amendmentControls(check, 'CHANGELOG LC', applyForFile(preText(fx, 'CHANGELOG.md'), 'CHANGELOG.md') || '', AM16.LC, { otherFileText: text('SKILL.md') || '' });
    });
    await step('plan C16-13: RELEASE-NOTES-3.0.0-rc.3.md is exactly the frozen text (ASCII, LF, one final LF, lines within 100 columns outside nothing exempt), has the six sections in order, no object identifier, states the compatibility signal, the required totals (100 PASS or 99 PASS with 1 SKIP, no rc.1 skip, R91 junction coverage), the pending post-release measurements with the TUI cases and the limitations, and claims no publication, tag, real scaffold or enforcement; the rc.2 notes stay byte for byte (raw SHA-256 4cbf9b9c...)', async () => {
      const bytes = readBytes(skillPath(context, 'RELEASE-NOTES-3.0.0-rc.3.md'));
      check(bytes !== null && byteConvention(bytes) === null, 'the rc.3 notes keep LF, no BOM and one final LF', byteConvention(bytes));
      const notes = bytes === null ? '' : bytes.toString('utf8');
      check(notes === T(C16_BLOCKS.RELEASE_NOTES), 'the rc.3 notes are exactly the frozen text', { bytes: notes.length });
      check(C16_BLOCKS.RELEASE_NOTES.every((l) => l.length <= 100 && !/[^\x00-\x7f]/.test(l)), 'the frozen notes are ASCII within 100 columns');
      const secs = LF(notes).split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
      check(eq(secs, SECTIONS) && notes.startsWith('# project-setup 3.0.0-rc.3\n\nRelease candidate containing C16: root-start instructions and git-safe review usability.\n'), 'the title, the opening sentence and the six sections stand in order', secs);
      check(!NOTES_HEX_RE.test(notes), 'the notes carry no object identifier (no tag, tree, archive or commit hash)');
      const s = squash(notes);
      for (const w of [
        'The project manifest schema remains 3. C16 adds no policy or apply migration.',
        'Upgrade the known v2 project together with its skill. V2 validation rejects manifest schema 3. This is a compatibility signal, not a retrofitted pre-write guard in every old command. Do not use v2 commands to repair a schema-3 project.',
        'Required totals are 100 PASS / 0 FAIL / 0 SKIP, or 99 PASS / 0 FAIL / 1 SKIP with only the recorded Windows R13d file-symlink privilege exception. No rc.1 case may skip. R91 must retain real Windows junction coverage.',
        'C16 contributes through R29 without adding numbered case records.',
        'These measurements block final 3.0.0, not rc.3 implementation acceptance.',
        'grep patterns must be checked for ERE meaning before reuse. a|b now alternates; a\\|b matches a literal vertical bar.',
        'GIT_SAFE_PATTERN permits only the canonical agents\' bounded same-helper correction. GIT_SAFE_GIT retains its unchanged operational-failure message and is never retry authority.',
        'Both Claude wrappers remain unchanged.',
        'Static instruction tests and evaluation objects do not prove agent behavior.',
        'It does not create tags, install the skill or publish a release.',
      ]) check(s.includes(w), `the rc.3 notes state: ${clip(w)}`);
      check(!/\b(has been|was|is now) published\b|\bpublished as\b|\btag (was|has been) created\b|real backend-standards scaffold (was|has been|passed)|\bhost enforcement (is|was) (verified|established)\b/i.test(s), 'the notes claim no publication, tag, real scaffold or host enforcement');
      const rc2 = readBytes(skillPath(context, 'RELEASE-NOTES-3.0.0-rc.2.md'));
      check(rc2 !== null && sha(rc2) === PRE_PIN['RELEASE-NOTES-3.0.0-rc.2.md'] && fx.files['RELEASE-NOTES-3.0.0-rc.2.md'] !== undefined && Buffer.compare(rc2, fx.files['RELEASE-NOTES-3.0.0-rc.2.md']) === 0, 'the rc.2 release notes are byte for byte unchanged (raw SHA-256 pinned by plan C16-14)', rc2 && sha(rc2));
      const rc1 = readBytes(skillPath(context, 'RELEASE-NOTES-3.0.0-rc.1.md'));
      check(rc1 !== null && fs.existsSync(skillPath(context, 'RELEASE-NOTES-2.0.0.md')), 'the rc.1 and 2.0.0 notes are still present');
      const c11b = text('tests/c11b.test.mjs') || '';
      const arr = (name) => { const b = between(c11b, `const ${name} = [`, '\n];'); if (b === null) return null; try { return JSON.parse(`[${b.trim().replace(/,\s*$/, '')}]`); } catch { return null; } };
      const cn = arr('RC3_RELEASE_NOTES_LINES');
      check(cn !== null && eq(cn, C16_BLOCKS.RELEASE_NOTES), 'the earlier test c11b holds the exact rc.3 notes as its preserved RC3_ release-note array (C17 moves the current arrays to rc.4)', cn && cn.length);
      const cc = arr('RC3_CHANGELOG_ENTRY_LINES');
      check(cc !== null && eq(cc.slice(0, C16_BLOCKS.CHANGELOG_ENTRY.length), C16_BLOCKS.CHANGELOG_ENTRY), 'the earlier test c11b holds the exact rc.3 changelog entry as its preserved RC3_ array', cc && cc.length);
    });
    await step('plan C16-8, C16-13 and C16-14: the five SKILL.md, README, claude.md, codex.md, security.md and docs-generation amendments and the runtime changes: every amended file reverses exactly to its pinned pre-C16 bytes and equals its independently computed model; core is 31839 bytes (SHA-256 ad1c51db...), hooks-selftest changes only its entry-guard comment (175fa861...) and keeps every code line; the exports of the core and the hook self-test behavior stay', async () => {
      for (const rel of ['SKILL.md', 'references/docs-generation.md', 'references/security.md', 'references/claude.md', 'references/codex.md', 'README.md']) {
        const r = checkAmendedFile(check, context, fx, rel);
        if (r !== null && MODEL_SHA[rel]) check(sha(Buffer.from(r.text, 'utf8')).startsWith(MODEL_SHA[rel]), `${rel}: equals the independently computed model`, sha(Buffer.from(r.text, 'utf8')).slice(0, 8));
      }
      for (const rel of ['assets/agents/reviewer.md', 'assets/agents/docs-sync.md']) { const b = pre17Bytes(context, rel); check(b !== null && sha(b).startsWith(MODEL_SHA[rel]), `${rel}: equals the independently computed model`, b && sha(b).slice(0, 8)); }
      const core = checkAmendedFile(check, context, fx, 'assets/tools/git-safe-core.mjs');
      const coreBytes = pre17Bytes(context, 'assets/tools/git-safe-core.mjs');
      check(coreBytes !== null && coreBytes.length === CORE_IDENTITY.bytes && sha(coreBytes) === CORE_IDENTITY.sha, 'the core is exactly the five frozen hunks applied to the inspected bytes (31839 bytes, SHA-256 ad1c51db... of plan C16-8)', coreBytes && { len: coreBytes.length, sha: sha(coreBytes) });
      const hs = checkAmendedFile(check, context, fx, 'assets/tools/hooks-selftest.mjs');
      const hsBytes = readBytes(skillPath(context, 'assets/tools/hooks-selftest.mjs'));
      check(hsBytes !== null && sha(hsBytes) === HOOKS_SELFTEST_NEW_SHA, 'hooks-selftest is exactly the comment replacement (SHA-256 175fa861... of plan C16-14)', hsBytes && sha(hsBytes));
      if (hs !== null && hs.reversed !== null) {
        const code = (t) => LF(t).split('\n').filter((l) => !l.trimStart().startsWith('//'));
        check(eq(code(hs.text), code(hs.reversed)), 'every non-comment line of hooks-selftest is unchanged (no behavior change; no 8.3 execution claim added)');
        check(!/8\.3 short name still runs the CLI/.test(hs.text) && hs.text.includes('(tested) or, through realpath, an 8.3 short name (untested) still runs the CLI'), 'the entry-guard comment marks 8.3 short-name behavior untested');
      }
      const coreModel = core && core.reversed;
      const exportsOf = (t) => [...t.matchAll(/^export (?:async )?(?:function|const|class) ([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
      if (core && coreModel) check(eq(exportsOf(core.text), exportsOf(coreModel)), 'the core exports exactly its previous names (EMPTY_TREE and argError stay private)', exportsOf(core.text));
      check(AM16.G16a.neu.includes('GIT_SAFE_PATTERN') && !AM16.G16e.neu.includes("'-G'") && AM16.G16e.neu.includes("'-E'"), 'the frozen hunks carry the new code and the -E vector');
    });
    await step('plan C16-14 retained identities: the seven runtime members keep their catalog order and targets, the five unchanged members and every file the plan leaves alone keep their pins (production scripts, installer, release builder, catalog, nested and shared templates, both Claude wrappers, the baseline checker, the live acceptance record, the earlier fixtures, runner files and helpers), the six v2 snapshots are unchanged, and the payload inventory is still exactly the 60 members without notes, tests or helpers', async () => {
      for (const [rel, digest] of UNCHANGED_PINS) { const b = pre17Bytes(context, rel); check(b !== null && sha(b) === digest, `${rel} is unchanged`, b && sha(b)); }
      for (const [rel, digest] of HISTORICAL_BASELINES) { const b = readBytes(skillPath(context, rel)); check(b !== null && sha(b) === digest, `${rel}: the shipped v2 snapshot still hashes to its pin`); }
      const catalog = readJson(skillPath(context, 'data/runtime-units.json'));
      check(catalog && Array.isArray(catalog.units) && eq(catalog.units.map((u) => path.posix.basename(u.source)), RUNTIME_MEMBERS) && catalog.units.every((u) => u.target === `.ai/tools/${path.posix.basename(u.source)}`), 'the seven runtime members stay in order with their targets');
      const changed = ['assets/tools/git-safe-core.mjs', 'assets/tools/hooks-selftest.mjs'].filter((rel) => sha(pre17Bytes(context, rel) || Buffer.alloc(0)) !== PRE_PIN[rel]);
      check(eq(changed, ['assets/tools/git-safe-core.mjs', 'assets/tools/hooks-selftest.mjs']) && RUNTIME_MEMBERS.filter((m) => !['git-safe-core.mjs', 'hooks-selftest.mjs'].includes(m)).every((m) => UNCHANGED_PINS.some(([rel, d]) => rel === `assets/tools/${m}` && sha(pre17Bytes(context, rel) || Buffer.alloc(0)) === d)), 'exactly two runtime member contents changed (core and hooks-selftest) and the five others keep their pins');
      const c11b = text('tests/c11b.test.mjs') || '';
      const inventory = between(c11b, 'const PAYLOAD_INVENTORY = [', '\n];');
      const entries = inventory === null ? [] : inventory.split('\n').filter((l) => /^\s*"/.test(l));
      check(entries.length === 60 && new Set(entries).size === 60 && !entries.some((e) => /RELEASE-NOTES|tests\/|evals\/|\.project\.md|prose-check|c1[3-6]/.test(e)) && c11b.includes('PAYLOAD_INVENTORY.length === 60'), 'the payload inventory is still exactly the 60 members (no notes, tests, helper, evaluation or extension)', entries.length);
      check(between(c11b, 'const PAYLOAD_ABSENT = [', '\n];') !== null && between(c11b, 'const PAYLOAD_ABSENT = [', '\n];').includes('RELEASE-NOTES-3.0.0-rc.3.md'), 'the rc.3 notes are listed as absent from the payload');
      check(exists(skillPath(context, 'tests/helpers/c16-amendments.mjs')) && exists(skillPath(context, 'tests/fixtures/c16-prechange.json')) && exists(skillPath(context, 'tests/c16.test.mjs')), 'the new test-only files exist under tests/ (outside the payload)');
    });
    await step('plan C16-F1 and C16-14: the root TODO.md. Only the byte convention reads the actual bytes; every other check reads the normalized text: C16\'s three amendments reversed (the resolved hooks-selftest entry re-inserted after the complete headroom entry and before "## Missing information", then the headroom entry replaced back, then the blocker removed) must give the inspected HEAD (28b4fd4f...), and H8D85 reversed must give the 8d85ec6^ bytes (6676d1c9...); the current TODO has the blocker after the Nest 12 subsection and before "## Needs manual review", the headroom entry in one accepted state, and no resolved entry', async () => {
      const raw = readBytes(rootPath(context, 'TODO.md'));
      check(byteConvention(raw) === null, 'TODO.md keeps LF, no BOM and one final LF', byteConvention(raw));
      // C17-11: the actual TODO is first reversed through the exact C17 blocker replacement and must then be the pre-C17 TODO (ebf6df3a...); the C16, H8D85 and T chain below starts from that view.
      const preTodo = pre17Bytes(context, '@root/TODO.md');
      check(raw === null || preTodo !== null, 'the actual TODO.md reverses through the exact C17 blocker replacement to the pre-C17 TODO (ebf6df3a...)');
      const todo = preTodo === null ? null : preTodo.toString('utf8');
      if (todo === null) { check(false, 'the repository-root TODO.md is readable'); return; }
      const n = normalizeTodo(todo);
      check(n.ok, 'the actual TODO.md reverses through C16, the HEAD hash, H8D85 and the 8d85ec6^ hash', n.why);
      check(n.ok && (n.state === 'pre' || n.state === 'post'), 'the headroom entry is in one accepted state', n.state);
      if (n.state === 'post') {
        const acc = readText(rootPath(context, ACCEPTANCE_REL));
        const ev = acc === null ? null : acceptanceEvidence(acc, n.values);
        check(ev !== null && ev.ok, 'the post-acceptance values equal the run date, the accept-rc1 line and the one headroom sentence of the retained acceptance record', ev === null ? 'record unreadable' : { problems: ev.problems, values: n.values });
        if (acc !== null && ev !== null && ev.ok) {
          // Negative controls on in-memory copies of the record (the record is never written).
          const v = n.values;
          const tag = (r, t) => !r.ok && r.problems.some((p) => p.startsWith(t + ':'));
          const SENTENCE = `Full acceptance took ${v.elapsedSeconds} s against the unchanged 1,800,000 ms timeout: ${v.remainingSeconds} s or ${v.headroomPercent}% headroom.`;
          const RUNLINE = acc.split('\n').find((l) => l.includes('accept-rc1.mjs'));
          check(acc.split(SENTENCE).length === 2 && RUNLINE !== undefined, 'the control inputs are located exactly once in the record');
          const changed = acc.replace(SENTENCE, 'Full acceptance took 1200 s against the unchanged 1,800,000 ms timeout: 600 s or 33.3% headroom.');
          check(changed.includes(String(v.elapsedSeconds)) && changed.includes(v.headroomPercent) && tag(acceptanceEvidence(changed, v), 'todo-elapsedSeconds') && tag(acceptanceEvidence(changed, v), 'sentence-vs-run'), 'control: a changed headroom sentence is refused although the old numbers still occur elsewhere in the record');
          check(tag(acceptanceEvidence(acc + '\n' + SENTENCE.replace(String(v.elapsedSeconds), '1200') + '\n', v), 'sentence'), 'control: a second, conflicting headroom sentence is refused');
          check(tag(acceptanceEvidence(acc.replace(SENTENCE, SENTENCE + '\n' + SENTENCE), v), 'sentence'), 'control: a duplicated identical headroom sentence is refused (exactly one)');
          check(tag(acceptanceEvidence(acc.replace(RUNLINE, RUNLINE.replace(' ' + v.elapsedSeconds + ' s', ' ' + (v.elapsedSeconds + 1) + ' s')), v), 'sentence-vs-run'), 'control: a sentence that disagrees with the accept-rc1 line is refused');
          check(tag(acceptanceEvidence(acc.replace(RUNLINE, RUNLINE + '\n' + RUNLINE), v), 'accept-line') && tag(acceptanceEvidence(acc.replace(RUNLINE, ''), v), 'accept-line'), 'control: two accept-rc1 lines or none in the run block are refused');
          check(tag(acceptanceEvidence(acc.replace('Date: ' + v.date + ',', 'Date: 2026-10-24,'), v), 'todo-date') && tag(acceptanceEvidence(acc, { ...v, date: '2026-10-24' }), 'todo-date'), 'control: a run date that differs from the TODO date is refused in both directions');
          check(tag(acceptanceEvidence(acc.replace(SENTENCE + '\n', ''), v), 'sentence'), 'control: a missing headroom sentence is refused');
          check(tag(acceptanceEvidence(acc.replace(SENTENCE + '\n', '') + '\n## Elsewhere\n\n' + SENTENCE + '\n', v), 'sentence'), 'control: a headroom sentence outside the "## Acceptance headroom" section is refused');
          check(tag(acceptanceEvidence(acc.replace(': ' + v.remainingSeconds + ' s or', ': ' + (v.remainingSeconds + 1) + ' s or'), { ...v, remainingSeconds: v.remainingSeconds + 1 }), 'sentence-arithmetic'), 'control: a sentence whose remaining seconds break the arithmetic is refused even when the TODO repeats it');
          check(tag(acceptanceEvidence(acc, { ...v, headroomPercent: '99.9' }), 'todo-headroomPercent') && tag(acceptanceEvidence(acc, { ...v, remainingSeconds: v.remainingSeconds + 1 }), 'todo-remainingSeconds') && tag(acceptanceEvidence(acc, { ...v, elapsedSeconds: v.elapsedSeconds + 1 }), 'todo-elapsedSeconds'), 'control: each altered TODO value is refused against the record');
        }
      }
      const t = LF(todo);
      check(COUNT(t, T(C16_BLOCKS.TODO_BLOCKER)) === 1 && t.indexOf('### project-setup final 3.0.0 requires rc.3 host re-measurement') > t.indexOf('### Nest 12 is not supported') && t.indexOf('### project-setup final 3.0.0 requires rc.3 host re-measurement') < t.indexOf(NEEDS_TODO_HEADING) && t.includes(`\n\n${T(C16_BLOCKS.TODO_BLOCKER)}\n${NEEDS_TODO_HEADING}\n`), 'the blocking item stands once after the complete Nest 12 subsection with one blank line before and after it, before "## Needs manual review"');
      check(!t.includes('hooks-selftest.mjs` still says an 8.3 short-name launch runs the') && !t.includes('acceptance has about 30% timeout headroom') && t.includes('- **`project-setup` acceptance timeout headroom needs a C16 measurement.**'), 'the resolved comment entry and the superseded headroom entry are gone and the new headroom entry stands');
      const bulletHeads = (x) => LF(x).split('\n').filter((l) => /^(- \*\*|### |## )/.test(l)).map((l) => l.slice(0, 60));
      const pre = bulletHeads(preText(fx, '@root/TODO.md') || '');
      const cur = bulletHeads(todo);
      const removed = pre.filter((h) => !cur.includes(h));
      const added = cur.filter((h) => !pre.includes(h));
      check(removed.length === 2 && removed.some((h) => h.includes('acceptance has about 30%')) && removed.some((h) => h.includes('hooks-selftest.mjs')) && added.length === 2 && added.some((h) => h.includes('final 3.0.0 requires rc.3')) && added.some((h) => h.includes('acceptance timeout headroom needs')), 'only the headroom entry, the resolved entry and the new blocker changed among the entry and heading lines; every unrelated entry is preserved', { removed, added });
      check(t.includes('Maintainer\n  decision (2026-10-24): keep the timeout and the coverage unchanged; revisit only') || squash(t).includes('Maintainer decision (2026-10-24): keep the timeout and the coverage unchanged; revisit only if a full run exceeds 1500 s.'), 'the maintainer decision and the revisit threshold survive in the headroom entry');
      check(squash(t).includes('mostly the I12-2/I12-4 alias coverage.'), 'the alias-coverage cause survives');
      check(C16_BLOCKS.HEADROOM_OLD.join('\n') === H8D85.neu.slice(0, -1) && C16_BLOCKS.HEADROOM_PRE.every((l) => l.length <= 100 && !/[^\x00-\x7f]/.test(l)) && C16_BLOCKS.TODO_BLOCKER.every((l) => l.length <= 100 && !/[^\x00-\x7f]/.test(l)), 'the current headroom entry replaced by C16 is exactly H8D85\'s after text, and the new TODO lines are ASCII within 100 columns');
      const issues = proseLineIssues(t, [squash(C16_BLOCKS.TODO_BLOCKER.slice(2).join(' '))]);
      check(issues.length === 0, 'the blocker prose passes the shared limits', issues.slice(0, 4));
    });
    await step('both accepted TODO states pass the same sequence on the frozen HEAD bytes (the fixture entry): the pre-acceptance form and a post-acceptance form with valid values, each reversing through C16, the HEAD hash, H8D85 and the 8d85ec6^ hash; the helper accepts exactly those two complete entries and rejects altered arithmetic, date, evidence path, neighboring text, spelling, a mixed estimate and measurement, a duplicated entry, a restored resolved entry, a moved or altered or duplicated or missing H8D85 and a moved blocker', async () => {
      const head = preText(fx, '@root/TODO.md');
      check(head !== null && sha(Buffer.from(head)) === TODO_HASHES.head, 'the fixture holds the inspected HEAD TODO (28b4fd4f...)');
      if (head === null) return;
      const pre = applyTodoC16Pre(head);
      check(pre !== null && normalizeTodo(pre).ok && normalizeTodo(pre).state === 'pre', 'the pre-acceptance state passes the sequence', pre && normalizeTodo(pre).why);
      if (pre === null) return;
      const vals = { elapsedSeconds: 1301, date: '2026-10-26', remainingSeconds: 499, headroomPercent: ((1800 - 1301) / 1800 * 100).toFixed(1) };
      const postEntry = postHeadroomEntry(vals);
      const post = pre.replace(TODO_RAW.headroomPre, () => postEntry);
      const np = normalizeTodo(post);
      check(np.ok && np.state === 'post' && eq(np.values, vals) && vals.headroomPercent === '27.7', 'the post-acceptance state passes the same sequence', np.why);
      check(postEntry.includes('C16 acceptance took 1301 s on 2026-10-26, leaving 499 s or\n  27.7% headroom. A slower or loaded host can still time out.\n') && postEntry.endsWith('  Evidence: docs/plans/2026-10-25-project-setup-v3-rc3-c16-acceptance.md.\n') && !postEntry.includes('${') && !postEntry.includes('planning expects'), 'the post form uses the two parameterized lines and the evidence line and nothing of the estimate');
      const bad = (label, t) => check(!normalizeTodo(t).ok, `rejected: ${label}`, normalizeTodo(t).why);
      const mk = (over) => pre.replace(TODO_RAW.headroomPre, () => postHeadroomEntry({ ...vals, ...over }));
      bad('remaining seconds do not add up', mk({ remainingSeconds: 500 }));
      bad('elapsed seconds above the timeout', mk({ elapsedSeconds: 1801, remainingSeconds: -1, headroomPercent: '-0.1' }));
      bad('percentage with two decimals', mk({ headroomPercent: '27.72' }));
      bad('percentage altered', mk({ headroomPercent: '27.8' }));
      bad('an impossible date', mk({ date: '2026-02-30' }));
      bad('a date in another form', mk({ date: '26-10-2026' }));
      bad('a non-canonical integer', mk({ elapsedSeconds: '01301' }));
      bad('the evidence path altered', post.replace('c16-acceptance.md.', 'c16-acceptance2.md.'));
      bad('the maintainer decision altered', post.replace('revisit only\n  if a full run exceeds 1500 s.', 'revisit only\n  if a full run exceeds 1600 s.'));
      bad('the alias-coverage cause altered', post.replace('mostly the I12-2/I12-4 alias coverage.', 'mostly the I12-2 alias coverage.'));
      bad('a mixed state: the estimate and the evidence line', pre.replace(`${C16_BLOCKS.HEADROOM_PRE[C16_BLOCKS.HEADROOM_PRE.length - 1]}\n`, `${C16_BLOCKS.HEADROOM_PRE[C16_BLOCKS.HEADROOM_PRE.length - 1].replace('Record the C16 elapsed time and computed headroom after acceptance.', 'Evidence: docs/plans/2026-10-25-project-setup-v3-rc3-c16-acceptance.md.')}\n`));
      bad('a mixed state: the measurement and the record request', post.replace('  Evidence: docs/plans/2026-10-25-project-setup-v3-rc3-c16-acceptance.md.\n', `${C16_BLOCKS.HEADROOM_PRE[C16_BLOCKS.HEADROOM_PRE.length - 1]}\n`));
      bad('the headroom entry duplicated', pre.replace(TODO_RAW.headroomPre, () => TODO_RAW.headroomPre + TODO_RAW.headroomPre));
      bad('the resolved entry restored', pre.replace(TODO_RAW.headroomPre, () => TODO_RAW.headroomPre + TODO_RAW.resolved));
      bad('an unrelated line added', pre.replace('\n## Missing information\n', '\n- unrelated line\n\n## Missing information\n'));
      bad('the blocker moved after the manual-review section', pre.replace(`${TODO_RAW.blocker}\n`, '').replace('\n## Missing information\n', `\n${TODO_RAW.blocker}\n## Missing information\n`));
      bad('the blocker duplicated', pre.replace(TODO_RAW.blocker, () => TODO_RAW.blocker + TODO_RAW.blocker));
      bad('the blocker missing', pre.replace(`${TODO_RAW.blocker}\n`, ''));
      bad('a TODO with CRLF line ends', pre.replace(/\n/g, '\r\n'));
      // H8D85 itself: exactly one verified reversal between its two anchors, each failure mode rejected.
      const r16 = reverseTodoC16(pre);
      check(r16.text !== null && reverseOne(r16.text, H8D85) !== null, 'H8D85 control baseline: the C16-reversed TODO holds the current headroom text once between its anchors');
      const withH = r16.text;
      const hOnce = reverseOne(withH, H8D85);
      check(hOnce !== null && sha(Buffer.from(hOnce)) === TODO_HASHES.pre8d85ec6 && applyOne(hOnce, H8D85) === withH, 'H8D85 reverses once and applies back exactly');
      check(!/[^\x00-\x7f]/.test(H8D85.neu) && /15.20% timeout headroom/.test(H8D85.old), 'the historical amendment text keeps the 15-20% headroom wording (the en dash is reconstructed in memory from its escape)');
      check(H8D85.old.split('\n').filter((x) => /[^\x00-\x7f]/.test(x)).length === 1 && !H8D85.old.includes('-20%'), 'exactly one reconstructed non-ASCII line lives in the historical amendment and the current TODO text has none');
      for (const [label, t] of [
        ['missing: the current headroom text absent', withH.replace(H8D85.neu, '')],
        ['duplicated', withH.replace(H8D85.neu, () => H8D85.neu + H8D85.neu)],
        ['altered: one word changed', withH.replace('about 30% timeout headroom', 'about 31% timeout headroom')],
        ['misplaced: moved before the anchor', withH.replace(H8D85.before + H8D85.neu, () => H8D85.neu + H8D85.before)],
        ['spaced: an extra blank line before it', withH.replace(H8D85.before + H8D85.neu, () => `${H8D85.before}\n${H8D85.neu}`)],
        ['CRLF', withH.replace(/\n/g, '\r\n')],
      ]) check(reverseOne(t, H8D85) === null, `H8D85 rejects: ${label}`);
    });
    await step('the frozen earlier records and fixtures are byte for byte unchanged and no historical digest was refreshed: the C15 plan, decisions and acceptance record keep their raw hashes; the older prechange fixtures and the shared helpers keep their pins; the nested Claude template and both Claude wrappers are not in any C16 amendment', async () => {
      for (const [rel, digest] of C15_RECORDS) { const b = readBytes(rootPath(context, rel)); check(b !== null && sha(b) === digest, `${rel} is unedited (a frozen record)`, b && sha(b)); }
      check(!AMENDED_FILES16.includes('assets/templates/nested-CLAUDE.md') && !AMENDED_FILES16.some((f) => f.includes('claude-')) && UNAMENDED_PRECHANGE_FILES.every((f) => !AMENDED_FILES16.includes(f)), 'neither the nested Claude template, a Claude wrapper nor the rc.2 notes carry a C16 amendment');
      for (const f of ['docs/plans/2026-10-25-project-setup-v3-rc3-c16.md', 'docs/plans/2026-10-25-project-setup-v3-rc3-c16-decisions.md']) check(exists(rootPath(context, f)), `${f} exists (a frozen record the tests only read)`);
      for (const rel of ['tests/c13.test.mjs', 'tests/c14.test.mjs', 'tests/c15.test.mjs']) { const src = text(rel) || ''; check(src.includes('c16-amendments.mjs') && src.includes('reverseForFile'), `${rel} reverses C16 through the shared helper before its historical comparisons`); }
      const D15 = await importOrFail(failures, pathToFileURL(skillPath(context, 'tests/helpers/c15-amendments.mjs')).href, 'tests/helpers/c15-amendments.mjs');
      if (D15) {
        const ds = text('assets/agents/docs-sync.md') || ''; const rv = text('assets/agents/reviewer.md') || '';
        check(D15.amendmentOnce(ds, D15.AM15.D15) && D15.amendmentOnce(rv, D15.AM15.R15), 'C15\'s D15 and R15 blocks remain byte-identical in the current agents at their anchors (pass attribution, vocabulary, scope and severity rules unchanged)');
      }
    });
    flushProcessCount(context, 'RC1/C16/release', mark);
  });
}

// ============================================ V2/C16/contracts ====
// Plan C16-4, C16-14, C16-15, C16-16, C16-17 and C16-18: the eight ordered descriptors, the independent registry entries (C16 appended after C15 in both registries), exactly 40 complete cases and 100 required results (no C16 case), registration without execution, the single R29
// aggregation with its literal context, the 36 evaluations (34-36 exact, 33 changed only by its delimiter comma, 1-33 unchanged by digest), the 20-entry prechange fixture, the pure amendment helper shared by C13-C16, the frozen C15 records, and import safety. The evaluation objects
// are expectations, not evidence that an agent followed them.
const COMPONENT_INVENTORY = [
  ['A5-templates/C16/launch', 'root Claude instructions refuse established subdirectory starts without false root refusals'],
  ['R42/C16/grep', 'ERE searches and pattern probes preserve filtering framing and failure boundaries'],
  ['R41/C16/cat', 'cat cardinality errors remain pre-read and actionable'],
  ['A5-templates/C16/recovery', 'argument and pattern correction is bounded and cannot bypass failed reads'],
  ['A5-templates/C16/host-docs', 'living host claims distinguish measured failed and unverified behavior'],
  ['V2/C16/update', 'rc.1 and rc.2 managed updates preserve approvals and recovery'],
  ['RC1/C16/release', 'rc.3 release text preserves prior candidates and payload membership'],
  ['V2/C16/contracts', 'C16 registration evaluations and historical preservation are exact'],
];
const EXPECTED_DESCRIPTORS = COMPONENT_INVENTORY.map(([id, name]) => ({ id, name }));
const REGISTRY_ORDER_BEFORE = ['C11a', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11b', 'C12', 'C13', 'C14', 'C15'];
const C16_CONTEXT_LITERAL = "{ repository: path.resolve(SKILL, '..'), skillRoot: SKILL, tmp: path.join(TMP, 'c16'), env: { ...ENV } }";
const HELPER_EXPORTS = ['AM16', 'AMENDED_FILES16', 'ACCEPTANCE_TIMEOUT_SECONDS', 'C16_BLOCKS', 'FORWARD_ORDER16', 'H8D85', 'HEADING_AMENDMENT16', 'REVERSAL_ORDER16', 'TODO_EVIDENCE_LINE', 'TODO_HASHES', 'TODO_POST_LINES_TEMPLATE', 'TODO_RAW', 'UNAMENDED_PRECHANGE_FILES', 'amendmentOnce', 'applyForFile', 'applyOne', 'applySteps', 'applyTodoC16Pre', 'classifyHeadroomEntry', 'postHeadroomEntry', 'reverseForFile', 'reverseOne', 'reverseSteps', 'reverseTodoC16'];
const EVAL_FIELDS = ['id', 'name', 'prompt', 'files', 'expected_output'];
const LAUNCH_ENTRY_POINTS = ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'];
const IMPORT_PROBE = String.raw`import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
const url = process.argv[2];
const entryPoints = ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'];
const launches = [];
const original = {};
for (const name of entryPoints) { original[name] = cp[name]; cp[name] = function () { launches.push(name); throw new Error('the import probe refuses to start a process: ' + name); }; }
syncBuiltinESMExports();
const live = await import('node:child_process');
const wrapped = entryPoints.filter((name) => cp[name] !== original[name] && live[name] === cp[name]);
const out = []; const ow = process.stdout.write;
process.stdout.write = function (c) { out.push(String(c)); return true; };
let mod = null; let error = null;
try { mod = await import(url); } catch (e) { error = String((e && e.message) || e); }
process.stdout.write = ow;
process.stdout.write(JSON.stringify({ names: mod === null ? null : Object.keys(mod).sort(), printed: out.join(''), launches, wrapped, error }) + '\n');
`;
const SILENT_LAUNCH_MODULE = [
  "import { spawnSync as namedSpawnSync, execFileSync as namedExecFileSync } from 'node:child_process';",
  "import cp from 'node:child_process';",
  "import { createRequire } from 'node:module';",
  'const req = createRequire(import.meta.url);',
  'const attempt = (fn) => { try { fn(); } catch { /* the failure is swallowed: nothing is printed or written */ } };',
  "attempt(() => namedSpawnSync(process.execPath, ['-e', '']));",
  "attempt(() => namedExecFileSync(process.execPath, ['-e', '']));",
  "attempt(() => cp.spawn(process.execPath, ['-e', '']));",
  "attempt(() => cp.exec('exit 0'));",
  "attempt(() => req('node:child_process').execSync('exit 0'));",
  "attempt(() => req('child_process').execFile(process.execPath, ['-e', '']));",
  "attempt(() => cp.fork('x.js'));",
  'export const SILENT_LAUNCHES = true;',
  '',
].join('\n');
const SILENT_LAUNCH_ORDER = ['spawnSync', 'execFileSync', 'spawn', 'exec', 'execSync', 'execFile', 'fork'];
function runImportProbe(context, dir, moduleUrl) {
  const probe = path.join(dir, 'import-probe.mjs');
  fs.writeFileSync(probe, IMPORT_PROBE);
  const r = execNode(context, { cwd: dir, script: probe, args: [moduleUrl] });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout.trim().split('\n').pop()); } catch { /* reported by the evaluator */ }
  return { r, parsed, files: fs.readdirSync(dir).sort().join('|') };
}
function importProbeIssues({ r, parsed, files }, { names, written }) {
  if (r.dead || r.code !== 0 || parsed === null) return ['probe-run'];
  const issues = [];
  if (parsed.error !== null) issues.push('import-error');
  if (!eq(parsed.wrapped, LAUNCH_ENTRY_POINTS)) issues.push('instrumentation');
  if (!eq(parsed.names, names)) issues.push('exports');
  if (parsed.printed !== '' || r.stderr !== '') issues.push('output');
  if (files !== written) issues.push('writes');
  if (!eq(parsed.launches, [])) issues.push('launches');
  return issues;
}
// The literal descriptor-to-runner binding the module must have (plan C16-16): every id with the name of the function it runs, written out by hand and compared with RUNNERS by name.
const EXPECTED_RUNNER_BINDINGS = [
  ['A5-templates/C16/launch', 'launch'],
  ['R42/C16/grep', 'grepGroup'],
  ['R41/C16/cat', 'catGroup'],
  ['A5-templates/C16/recovery', 'recovery'],
  ['A5-templates/C16/host-docs', 'hostDocs'],
  ['V2/C16/update', 'update'],
  ['RC1/C16/release', 'release'],
  ['V2/C16/contracts', 'contracts'],
];
function runnerBindingIssues(table, expected) {
  const issues = [];
  const ids = Object.keys(table).sort();
  if (!eq(ids, expected.map(([id]) => id).sort())) issues.push(`ids ${show(ids)}`);
  for (const [id, name] of expected) {
    const actual = typeof table[id] === 'function' ? table[id].name : null;
    if (actual !== name) issues.push(`${id} runs ${show(actual)}, expected ${name}`);
  }
  return issues;
}
const F_IMPORT_LINE = "import { C16_IMPLEMENTATIONS } from './c16.test.mjs';";
const F_ASSERTIONS_BLOCK = [
  "  // C16 plan (docs/plans/2026-10-25-project-setup-v3-rc3-c16.md) section C16-16, in its exact order. These are sub-assertions: no complete numbered case is composed from them and the 40-case table is unchanged.",
  "  C16: [",
  "    { id: 'A5-templates/C16/launch', name: 'root Claude instructions refuse established subdirectory starts without false root refusals' },",
  "    { id: 'R42/C16/grep', name: 'ERE searches and pattern probes preserve filtering framing and failure boundaries' },",
  "    { id: 'R41/C16/cat', name: 'cat cardinality errors remain pre-read and actionable' },",
  "    { id: 'A5-templates/C16/recovery', name: 'argument and pattern correction is bounded and cannot bypass failed reads' },",
  "    { id: 'A5-templates/C16/host-docs', name: 'living host claims distinguish measured failed and unverified behavior' },",
  "    { id: 'V2/C16/update', name: 'rc.1 and rc.2 managed updates preserve approvals and recovery' },",
  "    { id: 'RC1/C16/release', name: 'rc.3 release text preserves prior candidates and payload membership' },",
  "    { id: 'V2/C16/contracts', name: 'C16 registration evaluations and historical preservation are exact' },",
  "  ],",
];
const F_IMPL_ANCHOR = "  C15: Object.freeze([...C15_IMPLEMENTATIONS]),";
const F_IMPL_LINE = "  C16: Object.freeze([...C16_IMPLEMENTATIONS]),";
const F_R29_BLOCK = [
  "  // C16 contributes once through R29 without adding complete case records.",
  "  const c16context = { repository: path.resolve(SKILL, '..'), skillRoot: SKILL, tmp: path.join(TMP, 'c16'), env: { ...ENV } };",
  "  fs.mkdirSync(c16context.tmp, { recursive: true });",
  "  const rep16 = await runComponentAssertions('C16', c16context);",
  "  check(rep16.ok === true, 'C16 component assertions pass', { errors: rep16.errors, failed: rep16.results.filter((x) => x.status !== 'PASS').map((x) => ({ id: x.id, failures: x.failures.slice(0, 5) })) });",
];
async function contracts(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const text = (rel) => sourceText(context, rel);
    const rc = await importOrFail(failures, pathToFileURL(path.join(context.skillRoot, 'tests', 'rc1-cases.mjs')).href, 'tests/rc1-cases.mjs');
    const integration = await importOrFail(failures, pathToFileURL(path.join(context.skillRoot, 'tests', 'helpers', 'rc1-integration.mjs')).href, 'tests/helpers/rc1-integration.mjs');
    await step('plan C16-16 and C16-18: COMPONENT_ASSERTIONS.C16 is the eight ordered descriptors written independently, COMPONENT_IMPLEMENTATIONS.C16 holds exactly the C16_IMPLEMENTATIONS objects, C16 follows C15 as the appended tail of both registries (the earlier components unchanged) and rc1-cases.mjs keeps its eight exports with the exact C16 import, registry block and implementation line', async () => {
      if (!rc) return;
      const exp = rc.COMPONENT_ASSERTIONS && rc.COMPONENT_ASSERTIONS.C16;
      check(Array.isArray(exp) && eq(JSON.parse(JSON.stringify(exp)), EXPECTED_DESCRIPTORS) && Object.isFrozen(exp) && exp.every((d) => Object.isFrozen(d)), 'COMPONENT_ASSERTIONS.C16 is the frozen eight-descriptor list of plan C16-16, in order', exp && exp.map((d) => d.id));
      const impls = rc.COMPONENT_IMPLEMENTATIONS && rc.COMPONENT_IMPLEMENTATIONS.C16;
      check(Array.isArray(impls) && Object.isFrozen(impls) && impls.length === C16_IMPLEMENTATIONS.length && impls.every((x, i) => x === C16_IMPLEMENTATIONS[i]), 'COMPONENT_IMPLEMENTATIONS.C16 holds exactly the C16_IMPLEMENTATIONS objects in order (identity preserved)', impls && impls.length);
      check(Object.isFrozen(C16_IMPLEMENTATIONS) && eq(C16_IMPLEMENTATIONS.map((x) => x.id), EXPECTED_DESCRIPTORS.map((d) => d.id)) && C16_IMPLEMENTATIONS.length === 8 && C16_IMPLEMENTATIONS.every((x) => typeof x.run === 'function' && Object.isFrozen(x)), 'C16_IMPLEMENTATIONS is a frozen array of the eight IDs with callable run functions and frozen descriptors');
      const keysA = Object.keys(rc.COMPONENT_ASSERTIONS || {}); const keysI = Object.keys(rc.COMPONENT_IMPLEMENTATIONS || {});
      check(eq(keysA, [...REGISTRY_ORDER_BEFORE, 'C16', 'C17']) && eq(keysI, [...REGISTRY_ORDER_BEFORE, 'C16', 'C17']), 'both registries list the earlier components unchanged (C15 included), then C16 and C17 as the appended tail', { keysA, keysI });
      check(eq(Object.keys(rc).sort(), ['BASELINE_CASE_IDS', 'COMPONENT_ASSERTIONS', 'COMPONENT_IMPLEMENTATIONS', 'RC1_CASE_IDS', 'REQUIRED_CASE_IDS', 'registerRc1Cases', 'runComponentAssertions', 'selectSuiteCases']), 'rc1-cases.mjs keeps exactly its eight exports', Object.keys(rc).sort());
      check(eq(rc.COMPONENT_ASSERTIONS.C15.map((d) => d.id), ['A5-templates/C15/docs-sync', 'A5-templates/C15/reviewer', 'A5-templates/C15/preservation', 'V2/C15/update', 'RC1/C15/release', 'V2/C15/contracts']), 'the six C15 descriptor IDs are unchanged');
      const src = text('tests/rc1-cases.mjs') || '';
      check(COUNT(src, `import { C15_IMPLEMENTATIONS } from './c15.test.mjs';\n${F_IMPORT_LINE}\n`) === 1, 'the C16 import line stands once, immediately after the C15 import with no blank line');
      check(COUNT(src, `    { id: 'V2/C15/contracts', name: 'C15 registration evaluations and result contracts are exact' },\n  ],\n${F_ASSERTIONS_BLOCK.join('\n')}\n  // C17 plan (docs/plans/2026-10-27-project-setup-v3-rc4-c17.md) section C17-14`) === 1, 'the exact comment line and C16 property stand once, directly after the C15 property and before the closing of the registry');
      check(COUNT(src, `${F_IMPL_ANCHOR}\n${F_IMPL_LINE}\n`) === 1, 'the C16 implementation line stands once, immediately after the C15 line');
    });
    await step('plan C16-18: registerRc1Cases still registers exactly the 40 ordered complete cases, adds no C16 case, executes nothing and writes nothing; the inventories keep 40 cases and 100 required results; CASE_REQUIREMENTS names no C16 component', async () => {
      if (!rc) return;
      const calls = [];
      const ret = rc.registerRc1Cases((...a) => calls.push(a), {});
      check(calls.length === 40 && eq(calls.map((c) => c[0]), [...rc.RC1_CASE_IDS]) && calls.every((c) => typeof c[2] === 'function') && ret === undefined && !calls.some((c) => c[0].includes('/C16/')), 'exactly the 40 ordered RC1_CASE_IDS with function callbacks, undefined result and no /C16/ ID', calls.length);
      check(rc.RC1_CASE_IDS.length === 40 && rc.REQUIRED_CASE_IDS.length === 100 && new Set(rc.REQUIRED_CASE_IDS).size === 100 && !rc.REQUIRED_CASE_IDS.some((id) => id.includes('/C16/')), 'the inventories stay 40 complete cases and 100 required IDs, none a C16 sub-assertion');
      const executed = []; const seen = [];
      const scratch = () => { try { return fs.readdirSync(context.tmp).sort().join('|'); } catch { return ''; } };
      const before = scratch();
      const again = rc.registerRc1Cases((...a) => seen.push(a), { repository: context.repository, getComponent: (name) => { executed.push(name); return Promise.resolve(null); } });
      check(executed.length === 0 && seen.length === 40 && again === undefined && scratch() === before, 'registration requests no component and leaves the scratch directory unchanged', { executed, registered: seen.length });
      if (integration) {
        const comps = new Set(Object.values(integration.CASE_REQUIREMENTS).flatMap((list) => list.map((r) => r.component)));
        const ids = Object.values(integration.CASE_REQUIREMENTS).flatMap((list) => list.flatMap((r) => r.ids));
        check(!comps.has('C16') && !ids.some((id) => id.includes('/C16/')) && integration.RC1_CASE_DESCRIPTORS.length === 40, 'CASE_REQUIREMENTS names no C16 component or assertion and keeps its 40 descriptors (C16 contributes through R29)');
      }
    });
    await step('plan C16-18: run-tests.mjs aggregates C16 once inside R29, immediately after the C15 check and before the closing of R29, with the plan\'s exact block and context literal and no output; every other call site keeps its context literal; the complete cases are still registered once', async () => {
      const runner = readText(path.join(context.skillRoot, 'tests', 'run-tests.mjs'));
      check(runner !== null, 'tests/run-tests.mjs is readable');
      if (runner === null) return;
      const r29 = runner.indexOf("test('R29'"); const at15 = runner.indexOf("runComponentAssertions('C15'"); const at16 = runner.indexOf("runComponentAssertions('C16'"); const r30 = runner.indexOf("test('R30'", at15);
      check(r29 >= 0 && at15 > r29 && at16 > at15 && r30 > at16 && COUNT(runner, "runComponentAssertions('C16'") === 1, 'exactly one runComponentAssertions(\'C16\', ...) call site, in R29, after the C15 call and before test(\'R30\')', { r29, at15, at16, r30 });
      check(COUNT(runner, C16_CONTEXT_LITERAL) === 1, 'the context literal is exactly the plan\'s, once');
      const line15 = /^ {2}check\(rep15\.ok === true, 'C15 component assertions pass'.*$/m.exec(runner);
      const tail = line15 === null ? '' : runner.slice(line15.index + line15[0].length);
      check(line15 !== null && tail.startsWith(`\n${F_R29_BLOCK.join('\n')}\n  // C17 contributes once through R29`), 'the plan\'s exact block follows the C15 check line immediately (no blank line before or after it) and is followed by the closing "});" of R29');
      const seg = at16 >= 0 && r30 > at16 ? runner.slice(runner.indexOf('\n', runner.indexOf("'C15 component assertions pass'")), r30) : '';
      check(seg !== '' && !/console\.log|stdout\.write|\bPASS {2}/.test(seg.slice(seg.indexOf('C16 contributes'))), 'the C16 segment contains no console.log, stdout.write or "PASS  " text, comments included');
      for (const [c, d] of [['C1', 'c1'], ['C2', 'c2'], ['C3', 'c3'], ['C4', 'c4'], ['C5', 'c5'], ['C6', 'c6'], ['C7', 'c7'], ['C8', 'c8'], ['C9', 'c9'], ['C10', 'c10'], ['C11a', 'c11a'], ['C11b', 'c11b'], ['C12', 'c12'], ['C13', 'c13'], ['C14', 'c14'], ['C15', 'c15']]) {
        check(COUNT(runner, `runComponentAssertions('${c}'`) === 1 && runner.includes(`{ repository: path.resolve(SKILL, '..'), skillRoot: SKILL, tmp: path.join(TMP, '${d}'), env: { ...ENV } }`), `${c}: one call site and its baseline context literal are kept`);
      }
      check(COUNT(runner, 'registerRc1Cases(test, { getComponent });') === 1, 'the complete cases are still registered once');
    });
    await step('plan C16-14, C16-15 and C16-17: evals/evals.json holds exactly 36 ordered unique evaluations; original lines 1-35 keep the raw digest 8059a41c..., the JSON serialization of evaluations 1-33 keeps ef2f32bd... and 1-31 keeps 1f7a9dda...; line 36 (evaluation 33) differs from the pre-C16 line only by its delimiter comma and lines 37-39 are exactly the three plan objects with their keys in plan order (one per line, no blank line), the closing array and object and the final LF keep their form', async () => {
      // C17-F1: the C16 claims about the evaluation file are checked on the exact C17-reversed view (evaluations 37-39 and the delimiter comma of evaluation 36 removed); the current inventory is asserted by C17 and the earlier components.
      const rawNow = readText(skillPath(context, 'evals/evals.json'));
      const raw = rawNow === null ? null : reverseEvalsC17(rawNow);
      check(rawNow !== null && raw !== null, 'evals/evals.json is readable and its C17 additions (37-39 and the delimiter comma of 36) reverse exactly');
      let file = null;
      try { file = raw === null ? null : JSON.parse(raw); } catch { file = null; }
      check(file !== null && file.skill_name === 'project-setup' && Array.isArray(file.evals) && raw !== null, 'the C17-reversed evals/evals.json is JSON and keeps skill_name project-setup');
      if (!file || !Array.isArray(file.evals) || raw === null) return;
      const ids = file.evals.map((e) => e && e.id);
      check(file.evals.length === 36 && eq(ids, Array.from({ length: 36 }, (_, i) => i + 1)) && new Set(ids).size === 36, 'exactly ids 1 through 36 in order without duplicates (C16 appends 34-36; an earlier or a larger count is wrong)', ids);
      check(sha(Buffer.from(raw.split('\n').slice(0, 35).join('\n') + '\n', 'utf8')) === EVAL_RAW_1_35_SHA, 'original lines 1-35 are byte-identical to the pre-C16 file including the LF after line 35 (digest 8059a41c...)');
      check(file.evals.length >= 33 && sha(Buffer.from(JSON.stringify(file.evals.slice(0, 33)), 'utf8')) === EVAL_PREFIX_33_SHA, 'the JSON serialization of evaluations 1-33 is unchanged (digest ef2f32bd...)');
      check(file.evals.length >= 31 && sha(Buffer.from(JSON.stringify(file.evals.slice(0, 31)), 'utf8')) === '1f7a9ddae2c71d1de3a61ee64541fc8924e739f1fad134d25610bfd2b9394f7a', 'evaluations 1-31 keep the C15 digest 1f7a9dda...');
      const lines = raw.split('\n');
      check(lines.length === 42 && lines[41] === '' && lines[0] === '{' && lines[2] === '  "evals": [' && lines[39] === '  ]' && lines[40] === '}', 'the file keeps its frame: 39 content lines plus the final LF, the closing "  ]" and "}" immediately after evaluation 36', lines.length);
      check(lines[35] === C16_BLOCKS.EVAL33_LINE[0] && lines[35].endsWith('},') && lines[35].slice(0, -1) === lines[35].replace(/,$/, '') && JSON.parse(lines[35].replace(/,$/, '')).id === 33, 'line 36 is evaluation 33 exactly as the plan line, differing from the pre-C16 line only by the delimiter comma');
      check(eq(lines.slice(36, 39), C16_BLOCKS.EVAL_NEW_LINES) && C16_BLOCKS.EVAL_NEW_LINES[0].endsWith('},') && C16_BLOCKS.EVAL_NEW_LINES[1].endsWith('},') && C16_BLOCKS.EVAL_NEW_LINES[2].endsWith('}') && C16_BLOCKS.EVAL_NEW_LINES.every((l) => l.startsWith('    { "id": ')), 'lines 37 to 39 are exactly the three plan lines with the separator commas and no trailing comma on the last');
      C16_BLOCKS.EVAL_NEW_LINES.forEach((l, i) => {
        const want = JSON.parse(l.replace(/,$/, '')); const got = file.evals[33 + i];
        check(eq(got, want) && eq(Object.keys(got || {}), EVAL_FIELDS), `evaluation ${34 + i} equals the plan object exactly, with its keys in plan order (an expectation, not observed agent behavior)`, got && got.name);
      });
      check(eq(file.evals.slice(33).map((e) => e && e.name), ['claude-root-start-required', 'git-safe-argument-correction-boundary', 'rc3-measurement-and-update-boundaries']), 'the names of 34-36 are the plan names in order');
      const e34 = file.evals[33] || {}; const e35 = file.evals[34] || {}; const e36 = file.evals[35] || {};
      for (const [name, o, re] of [
        ['34: the nearest loaded rule at or above the start, case-insensitive on Windows', e34, /selecting the nearest such rule at or above the start directory/],
        ['34: refuse only on a positively established strictly-below start', e34, /Refuses only when the comparison positively establishes a start strictly below that root/],
        ['34: no false refusal for a root start, root then cd, the reviewer subagent or a nested-worktree root', e34, /Does not falsely refuse a root start, root-start then cd, reviewer subagent or nested-worktree root/],
        ['34: missing context neither establishes the refusal nor proves controls', e34, /Missing context alone neither establishes the refusal condition nor proves active controls/],
        ['34: the above-or-outside-root residual and the instruction-only wording', e34, /does not refuse such a start even after the target rule loads[\s\S]*instruction-only/],
        ['35: at most two correction rounds and no reset by splitting', e35, /at most two correction rounds; splitting cat paths does not reset the budget/],
        ['35: GIT_SAFE_GIT and a missing cat path stop', e35, /including GIT_SAFE_GIT and a missing cat path/],
        ['35: no raw Git, other tool, connector, permission or sandbox change', e35, /Never retries through raw Git, another tool, a connector, changed permissions or a changed sandbox/],
        ['35: an empty success is not proof of exhaustive review', e35, /Does not interpret empty success as proof/],
        ['36: kept old instructions or wrappers are an incomplete update', e36, /Reports kept old required instructions or wrappers as an incomplete update/],
        ['36: a P3 PASS is not transferred to changed L16 bytes', e36, /does not transfer a P3 PASS to changed L16 bytes without rerunning all eight cases/],
        ['36: both Codex reviews must complete and the lost update must be a finding after release', e36, /Requires both Codex reviews to complete and the defective range's lost update to be a finding after rc\.3 release/],
        ['36: worktree setup must be committed first', e36, /Requires committed installed setup before worktree sessions/],
        ['36: Codex profile, negative capability, Node fail-open, Git 2.31 and platforms stay unverified', e36, /Keeps Codex profile enforcement blocked[\s\S]*Git 2\.31 probe floor and unmeasured platforms unverified/],
      ]) check([...(o.files || []), o.expected_output || '', o.prompt || ''].some((s) => re.test(s)), `evaluation ${name}`);
    });
    await step('plan C16-14: the 20-entry prechange fixture is test-only comparison data: raw SHA-256 7853616e..., 299643 bytes, exactly JSON.stringify(value, null, 2) plus one LF, key order schema/sourceCommit/entries (no skillVersion), the inspected commit, the twenty files in the plan\'s order with canonical unwrapped base64 whose raw SHA-256 equals the entry digest and the plan\'s pin, every non-root path prefixed project-setup/, no production script reads it, and every amended file reverses to its entry', async () => {
      const raw = readBytes(skillPath(context, FIXTURE_REL));
      check(raw !== null && sha(raw) === FIXTURE_RAW_SHA && raw.length === FIXTURE_FILE_BYTES, 'the fixture file hashes to the plan\'s raw SHA-256 and has 299643 bytes', raw && { sha: sha(raw), len: raw.length });
      const doc = readJson(skillPath(context, FIXTURE_REL));
      check(doc !== null && raw !== null && raw.toString('utf8') === jsonText(doc) && !raw.includes(0x0d), 'the file is exactly JSON.stringify(value, null, 2) plus one LF (no CR)');
      check(doc !== null && eq(Object.keys(doc), ['schema', 'sourceCommit', 'entries']) && doc.schema === 1 && doc.sourceCommit === FIXTURE_SOURCE_COMMIT, 'the fixture has exactly schema 1 and the inspected commit in key order (no skillVersion)', doc && Object.keys(doc));
      const entries = doc && Array.isArray(doc.entries) ? doc.entries : [];
      check(entries.length === 20 && eq(entries.map((e) => e.path), PRE_C16.map(([rel]) => fixturePathOf(rel))) && entries.every((e) => eq(Object.keys(e), ['path', 'base64', 'sha256'])), 'the entries are the twenty plan files in the plan\'s order, each with path, base64 and sha256 in that order', entries.map((e) => e.path));
      check(entries.filter((e) => e.path.startsWith('project-setup/')).length === 17 && entries.filter((e) => !e.path.startsWith('project-setup/')).map((e) => e.path).join('|') === 'README.md|.ai/context/project-tree.md|TODO.md', 'seventeen paths carry the project-setup/ prefix and the three root paths do not');
      for (const [rel, digest] of PRE_C16) {
        const e = entries.find((x) => x.path === fixturePathOf(rel));
        const bytes = e ? Buffer.from(String(e.base64), 'base64') : null;
        check(bytes !== null && bytes.toString('base64') === e.base64 && !/\s/.test(e.base64) && sha(bytes) === e.sha256 && e.sha256 === digest, `${rel}: canonical unwrapped base64 decodes to bytes whose raw SHA-256 is the entry digest and the plan's pin`, bytes && sha(bytes));
        check(bytes !== null && byteConvention(bytes) === null, `${rel}: the pre-change bytes keep LF, no BOM and one final LF (not normalized)`);
      }
      const scripts = ['apply', 'check-agent-baselines', 'validate', 'doctor', 'detect', 'blocks', 'lib', 'ownership'].map((n) => readText(skillPath(context, `scripts/${n}.mjs`)) || '');
      check(scripts.every((t) => !t.includes('c16-prechange')), 'no production script reads the C16 fixture');
      for (const rel of AMENDED_FILES16) { const b = pre17Bytes(context, rel); const r = b === null ? { text: null, failed: 'unreadable' } : reverseForFile(b.toString('utf8'), rel); check(r.text !== null && Buffer.compare(Buffer.from(r.text), Buffer.from(entries.find((x) => x.path === fixturePathOf(rel)) ? Buffer.from(entries.find((x) => x.path === fixturePathOf(rel)).base64, 'base64') : '')) === 0, `${rel}: reversing every C16 amendment gives the fixture entry`, r.failed); }
    });
    await step('the amendment helper is pure and exact: it exports exactly the listed names, every amendment has exactly the five fields, is frozen, ends with one LF and has no implicit leading blank line, names an amended file and is ASCII (the retained ellipsis and the historical en dash are written as escapes), the forward and reverse orders cover the fifteen amended files with the amendments of each file in plan order, a synthetic amendment shows each failure mode (missing, duplicated, altered, moved, differently spaced, CRLF) and never a substring deletion, a reversal names the first amendment that does not verify, and the failure controls hold on the real files in memory', async () => {
      const helperUrl = pathToFileURL(skillPath(context, 'tests/helpers/c16-amendments.mjs')).href;
      const H = await importOrFail(failures, helperUrl, 'tests/helpers/c16-amendments.mjs');
      if (!H) return;
      check(eq(Object.keys(H).sort(), [...HELPER_EXPORTS].sort()), 'the helper exports exactly the expected names', Object.keys(H).sort());
      const src = readText(skillPath(context, 'tests/helpers/c16-amendments.mjs')) || '';
      check(!/^\s*import\s/m.test(src) && !/require\(|child_process|process\.stdout|console\./.test(src) && !/[^\x00-\x7f]/.test(src), 'the helper imports nothing, starts no process, prints nothing and is ASCII');
      const ids = Object.keys(AM16);
      check(ids.length === 39 && eq(ids.slice(0, 2), ['L16', 'D16']) && FORWARD_ORDER16 && eq(Object.values(FORWARD_ORDER16).flat().sort(), ids.slice().sort()), 'the table holds the amendments in plan order and the forward orders cover each exactly once', ids.length);
      for (const [id, a] of Object.entries(AM16)) {
        check(eq(Object.keys(a), ['file', 'before', 'old', 'neu', 'after']) && Object.isFrozen(a) && a.neu.endsWith('\n') && (a.neu === '\n' || !a.neu.startsWith('\n') || id === 'S2' || id === 'DG2') && a.old !== a.neu && (a.old === '' || a.old.endsWith('\n')), `amendment ${id}: exactly the five fields file, before, old, neu, after; frozen; the block ends with one LF and has no implicit leading blank line`, Object.keys(a));
        check(AMENDED_FILES16.includes(a.file) && (id === 'DS_SCOPE' ? !/[^\x00-\x7f]/.test(a.neu.replace(/\u2026/g, '')) && !/[^\x00-\x7f]/.test(a.old.replace(/\u2026/g, '')) : !/[^\x00-\x7f]/.test(a.neu) && !/[^\x00-\x7f]/.test(a.old)), `amendment ${id}: names one of the fifteen amended files and its text is ASCII (only the retained ellipsis of DS_SCOPE is exempt)`);
      }
      check(eq(Object.keys(REVERSAL_ORDER16), Object.keys(FORWARD_ORDER16)) && Object.entries(FORWARD_ORDER16).every(([f, order]) => eq([...REVERSAL_ORDER16[f]].reverse(), [...order])) && AMENDED_FILES16.length === 15 && eq(AM16.RC.after, AM16.RH.old), 'the reversal orders are the reverse of the forward orders; RC and RH meet at the replaced history text');
      const a = { before: 'A\n\n', old: '', neu: 'N text\n', after: '\nB\n' };
      const ok = 'A\n\nN text\n\nB\n';
      check(H.reverseOne(ok, a) === 'A\n\n\nB\n' && H.amendmentOnce(ok, a) && H.applyOne('A\n\n\nB\n', a) === ok, 'a text with the amendment once at its anchor reverses and applies back');
      check(H.reverseOne('A\n\n\nB\n', a) === null && H.reverseOne('A\n\nN text\nN text\n\nB\n', a) === null && H.reverseOne(`${ok}N text\n`, a) === null && H.reverseOne('A\n\nN texts\n\nB\n', a) === null && H.reverseOne('N text\nA\n\n\nB\n', a) === null && H.reverseOne('A\n\nN text\n\n\nB\n', a) === null && H.reverseOne(ok.replace(/\n/g, '\r\n'), a) === null, 'missing, duplicated, altered, moved, differently spaced and CRLF text are all refused');
      const two = H.reverseSteps('X\nA\n\nN text\n\nB\n', ['L16']);
      check(two.text === null && two.failed === 'L16' && H.reverseSteps('x', ['no-such-id']).failed === 'no-such-id' && H.reverseForFile('anything', 'README-not-amended.md').text === null && H.applySteps('anything', ['L16']) === null, 'reverseSteps names the first amendment that does not verify; unknown ids, unknown files and a text without the anchor are refused');
      check(H.reverseForFile('x', 'SKILL.md').failed === 'S3' && H.reverseForFile(preText(loadFixture(context), 'SKILL.md') || '', 'SKILL.md').text === null, 'a SKILL.md without the C16 amendments is refused at the first reversal (S3)');
      const fx = loadFixture(context);
      const skillModel = modelOf(fx, 'SKILL.md');
      if (skillModel) {
        const full = H.reverseForFile(skillModel, 'SKILL.md'); const body = H.reverseForFile(skillModel, 'SKILL.md', { keepHeading: true });
        check(full.text === preText(fx, 'SKILL.md') && body.text !== null && body.text.split('\n')[5] === '# project-setup 3.0.0-rc.3' && body.text.replace('# project-setup 3.0.0-rc.3', '# project-setup 3.0.0-rc.2') === full.text, 'keepHeading reverses only the body edits and leaves the rc.3 heading for the heading normalization of C11b');
      }
      for (const [rel, pair] of [['README.md', ['RM4a', 'RM4b']], ['assets/agents/reviewer.md', ['RC', 'RH']], ['assets/agents/docs-sync.md', ['DS_RR', 'DS_GF']]]) {
        const model = modelOf(fx, rel);
        if (model === null) { check(false, `${rel}: the model exists`); continue; }
        const first = H.reverseOne(model, AM16[pair[1]]); const swapped = H.reverseOne(model, AM16[pair[0]]);
        check(first !== null && (rel ==='README.md' || swapped === null), `${rel}: an adjacent amendment is verified only after the later one is reversed (the reversal order matters)`, { later: first !== null, earlier: swapped !== null });
      }
      const todoHead = preText(fx, '@root/TODO.md');
      check(todoHead !== null && H.applyTodoC16Pre(todoHead) !== null && H.reverseTodoC16(H.applyTodoC16Pre(todoHead) || '').text === todoHead, 'the TODO forward and reverse directions agree on the inspected HEAD');
    });
    await step('this module is import safe (the probe): importing it prints nothing, writes nothing, starts no process (observed by instrumenting every child-process entry point before the import) and exports exactly C16_IMPLEMENTATIONS; the descriptor-to-runner binding is the literal table; the module and the helper are ASCII with LF line ends', async () => {
      const clean = { r: { dead: null, code: 0, stderr: '' }, parsed: { names: ['X'], printed: '', launches: [], wrapped: [...LAUNCH_ENTRY_POINTS], error: null }, files: 'import-probe.mjs' };
      const flip = (patch) => importProbeIssues({ r: { ...clean.r, ...(patch.r || {}) }, parsed: patch.parsed === null ? null : { ...clean.parsed, ...(patch.parsed || {}) }, files: patch.files === undefined ? clean.files : patch.files }, { names: ['X'], written: 'import-probe.mjs' });
      const flipped = [flip({}), flip({ parsed: { launches: ['execSync'] } }), flip({ parsed: { printed: 'x' } }), flip({ r: { stderr: 'e' } }), flip({ files: 'import-probe.mjs|x' }), flip({ parsed: { names: ['X', 'Y'] } }), flip({ parsed: { wrapped: ['spawn'] } }), flip({ parsed: { error: 'boom' } }), flip({ r: { code: 1 } }), flip({ parsed: null }), flip({ r: { dead: 'timeout' } })];
      check(eq(flipped, [[], ['launches'], ['output'], ['output'], ['writes'], ['exports'], ['instrumentation'], ['import-error'], ['probe-run'], ['probe-run'], ['probe-run']]), 'the import-safety evaluator reports each unsafe signal on its own and nothing for a clean report', flipped);
      await withScratch(context, 'contracts', async (dir) => {
        const run = runImportProbe(context, dir, import.meta.url);
        const issues = importProbeIssues(run, { names: ['C16_IMPLEMENTATIONS'], written: 'import-probe.mjs' });
        check(!issues.some((i) => ['probe-run', 'import-error', 'exports', 'output'].includes(i)), 'the import prints nothing and the export set is exactly C16_IMPLEMENTATIONS', { issues, out: run.r.stdout.slice(0, 200), err: run.r.stderr.slice(0, 200) });
        check(!issues.includes('writes') && !issues.includes('instrumentation') && !issues.includes('launches') && run.parsed !== null && eq(run.parsed.launches, []) && eq(run.parsed.wrapped, LAUNCH_ENTRY_POINTS), 'the import wrote nothing and started no process (all seven entry points instrumented first)', run.parsed && run.parsed.launches);
      });
      await withScratch(context, 'launch-control', async (dir) => {
        const modulePath = path.join(dir, 'silent-launch.mjs');
        fs.writeFileSync(modulePath, SILENT_LAUNCH_MODULE);
        const run = runImportProbe(context, dir, pathToFileURL(modulePath).href);
        const issues = importProbeIssues({ ...run, files: 'import-probe.mjs|silent-launch.mjs' }, { names: ['SILENT_LAUNCHES'], written: 'import-probe.mjs|silent-launch.mjs' });
        check(eq(issues, ['launches']) && run.parsed !== null && eq(run.parsed.launches, SILENT_LAUNCH_ORDER), 'negative control: a module that starts a process silently through all seven entry points is detected only by the recorded launches', { issues, launches: run.parsed && run.parsed.launches });
      });
      const sources = [['tests/c16.test.mjs', readBytes(skillPath(context, 'tests/c16.test.mjs'))], ['tests/helpers/c16-amendments.mjs', readBytes(skillPath(context, 'tests/helpers/c16-amendments.mjs'))]];
      for (const [rel, b] of sources) check(b !== null && !b.includes(0x0d) && ![...b.toString('utf8')].some((c) => c.charCodeAt(0) > 127) && b[b.length - 1] === 0x0a && b[0] !== 0xef, `${rel} is ASCII, LF only, without a BOM and with a final LF`);
      const me = readText(skillPath(context, 'tests/c16.test.mjs')) || '';
      check(!/^(?:(?:const|let|var)\s+[\w$]+\s*=\s*)?(?:await\s+)?(?:fs\.\w+|spawnSync|execNode|gitIn|putFile|makeRepo|copyTree|rmrf)\(/m.test(me), 'no top-level statement of this module writes a file or starts a process');
      const RUNNERS_REF = { 'A5-templates/C16/launch': launch, 'R42/C16/grep': grepGroup, 'R41/C16/cat': catGroup, 'A5-templates/C16/recovery': recovery, 'A5-templates/C16/host-docs': hostDocs, 'V2/C16/update': update, 'RC1/C16/release': release, 'V2/C16/contracts': contracts };
      check(eq(runnerBindingIssues(RUNNERS_REF, EXPECTED_RUNNER_BINDINGS), []) && eq(runnerBindingIssues(RUNNERS, EXPECTED_RUNNER_BINDINGS), []), 'every descriptor id is bound to the function the literal table names', runnerBindingIssues(RUNNERS, EXPECTED_RUNNER_BINDINGS));
      const [idA, idB] = Object.keys(RUNNERS);
      const swapped = { ...RUNNERS, [idA]: RUNNERS[idB], [idB]: RUNNERS[idA] };
      const { [idA]: dropped, ...withoutA } = RUNNERS;
      check(runnerBindingIssues(swapped, EXPECTED_RUNNER_BINDINGS).length === 2 && typeof dropped === 'function' && runnerBindingIssues(withoutA, EXPECTED_RUNNER_BINDINGS).length === 2 && runnerBindingIssues({ ...RUNNERS, extra: RUNNERS[idA] }, EXPECTED_RUNNER_BINDINGS).length === 1, 'negative controls: a swapped, a missing and an extra binding are each reported');
      check(C16_IMPLEMENTATIONS.every((d) => d.run.length <= 1), 'each implementation takes only the context');
    });
    flushProcessCount(context, 'V2/C16/contracts', mark);
  });
}

const RUNNERS = {
  'A5-templates/C16/launch': launch,
  'R42/C16/grep': grepGroup,
  'R41/C16/cat': catGroup,
  'A5-templates/C16/recovery': recovery,
  'A5-templates/C16/host-docs': hostDocs,
  'V2/C16/update': update,
  'RC1/C16/release': release,
  'V2/C16/contracts': contracts,
};
export const C16_IMPLEMENTATIONS = Object.freeze(EXPECTED_DESCRIPTORS.map((d) => Object.freeze({ id: d.id, run: (context) => RUNNERS[d.id](context) })));
