// C17 tests lane: the eight component assertions of "C17. Reliable reviewer HEAD identity and actionable Git ownership failures"
// (project-setup 3.0.0-rc.4, the only rc.4 component).
//
// Written from the frozen plan only, before any implementation exists:
//   docs/plans/2026-10-27-project-setup-v3-rc4-c17.md            (sections C17-1 to C17-21 and the freeze addendum C17-F0 to C17-F15)
//   docs/plans/2026-10-27-project-setup-v3-rc4-c17-decisions.md  (Q1-Q6, the probes P-own and P1-P6 and the P6 site list)
// On the landed contracts: C4 (git-safe), C5 (review-diff), C8 and C9 (reviewer and docs-sync), C11b to C16 and the apply, validate and
// baseline scripts, which C17 does not change. The exact amendment text (R17, RD17, SH17, S17, SO17, RM*, SE*, CX*, CL*, LC17, V17, RR*, PT*
// and the TODO and evaluation transforms) lives in tests/helpers/c17-amendments.mjs, copied from the plan by a generator script before any
// implementation existed and never read back from the files under test; a reversal removes exactly one verified amendment at its stated anchor
// and the result is compared with the pinned pre-C17 bytes (tests/fixtures/c17-prechange.json, 13 entries, plan C17-12).
//
// Importing this module runs nothing. Every production module and the registry module (rc1-cases.mjs imports this file, so a static import
// back would be circular) is imported lazily inside run(context). A missing file, module or export fails one assertion with a diagnostic; it
// never breaks the import.
//
// Every run(context) returns { failures, skipped: null }; there is no skip path (C17-14). Scratch data lives under context.tmp only. Every
// project is a synthetic ASCII fixture; no user configuration, scanner, release build, package installation, backend-standards scaffold or
// external reviewer is touched. The child processes are git (spawnSync, shell-free, directly or through the real git-safe executor), the
// installed CLI, the apply and lock scripts and a few import and spawn probes; their count is retained in <context.tmp>/c17-diagnostics.log
// next to the elapsed time (target: at most 180 launches and 90 s, plan Q5, recorded, never an assertion). validate.mjs runs in process.
//
// How the instruction checks work. Instruction text cannot be executed, so each group states what the installed text MUST say and proves its
// own checks can fail: every frozen paragraph is a rule, every sentence of every paragraph is removed or weakened in memory and the rule must
// then fail, and named opposite guards are substituted. The same battery runs twice: on an independent model (the pinned pre-C17 bytes with
// the frozen amendments applied by the helper, so the checks stay meaningful before any implementation exists) and on the real installed text.
// Nothing here proves that an agent follows the instructions: that stays agent behavior (the evaluations) and host evidence. Helper behavior
// (git-safe) is tested against real Git.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { newProseIssues, proseLineIssues, proveFenceRules } from './helpers/prose-check.mjs';
import {
  AM17, C17_BLOCKS, C17_LITERALS, C17_DESCRIPTORS, C17_R29_BLOCK, CORE_FROZEN_LITERALS, EVAL_NEW_LINES, FORWARD_ORDER17, REVERSAL_ORDER17, AMENDED_FILES17, PRE_C17_FILES, TD17, TODO_PRE_C17_HASH,
  amendmentOnce, applyEvalsC17, applyForFile, applyOne, applySteps, applyTodoC17, reverseEvalsC17, reverseForFile, reverseOne, reverseSteps, reverseTodoC17,
} from './helpers/c17-amendments.mjs';
import {
  AM16, FORWARD_ORDER16, REVERSAL_ORDER16, H8D85, TODO_HASHES, TODO_RAW,
  reverseForFile as reverseC16File, reverseTodoC16, applyForFile as applyC16File,
} from './helpers/c16-amendments.mjs';

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
const sourceText = (context, rel) => { const t = readText(skillPath(context, rel)); return t === null ? null : LF(t); };
function putFile(p, data) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); }
const rmrf = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* best effort */ } };
function scratchDir(context, label) {
  fs.mkdirSync(context.tmp, { recursive: true });
  return fs.realpathSync.native(fs.mkdtempSync(path.join(context.tmp, `c17-${label}-`)));
}
async function withScratch(context, label, fn) {
  const dir = scratchDir(context, label);
  try { return await fn(dir); } finally { rmrf(dir); }
}
function copyTree(src, dst) { fs.cpSync(src, dst, { recursive: true }); return dst; }

// ------------------------------------------------- diagnostics and process counting ----
function diag(context, line) { try { fs.mkdirSync(context.tmp, { recursive: true }); fs.appendFileSync(path.join(context.tmp, 'c17-diagnostics.log'), `${line}\n`); } catch { /* best effort */ } }
const PROCESS_COUNTS = new Map();
const STARTED = new Map();
function countProcess(context, n = 1) { PROCESS_COUNTS.set(context.tmp, (PROCESS_COUNTS.get(context.tmp) || 0) + n); }
const processMark = (context) => PROCESS_COUNTS.get(context.tmp) || 0;
function startClock(context) { try { fs.mkdirSync(context.tmp, { recursive: true }); } catch { /* reported by the first launch */ } if (!STARTED.has(context.tmp)) STARTED.set(context.tmp, Date.now()); }
function flushProcessCount(context, label, mark) {
  const elapsed = Math.round((Date.now() - (STARTED.get(context.tmp) || Date.now())) / 1000);
  diag(context, `processes in ${label}: ${processMark(context) - mark} (cumulative ${processMark(context)}, target 180 launches and 90 s per plan Q5; counting method: every launch of this file, including each Git child of the executor seam; elapsed ${elapsed} s since the first group)`);
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

// ============================================================ frozen literals ====
// Copied verbatim from the frozen plan (C17-6 to C17-17, C17-F0 to C17-F15) by the generator script; the pins are the plan's own digests or
// were computed from the inspected pre-change commit (eac5b07). Nothing below is ever read back from the files under test. Where this file
// adds a pin the plan does not give (marked PLAN-GAP), the value was computed from the inspected pre-change commit or from the frozen
// amendments applied to it, and guards a file or object the plan says C17 leaves alone or the amended bytes it describes.
const FIXTURE_REL = 'tests/fixtures/c17-prechange.json';
const FIXTURE_SOURCE_COMMIT = 'eac5b0783d621eaa0e78ad0ba1802713e03c1944';
const FIXTURE_RAW_SHA = 'bf3436d54b9c046edea5ee2b339d0a25412beaf6cdc10a4e4ffc00f84e1efa65';
const FIXTURE_FILE_BYTES = 312580;
// Plan C17-12: the 13 pre-C17 raw SHA-256 values in the plan's order. Skill files are relative to project-setup/; the three root files are marked.
// The three plan-stated values (core, review-diff, reviewer) are the plan's own; the others were computed from eac5b07.
const PRE_C17 = [
  ['assets/tools/git-safe-core.mjs', 'ad1c51db23444c022dcb4eca06d0b3fd52984cb1bf3230596a840f34203b5f85'],
  ['assets/tools/review-diff.mjs', 'ae236ae32405497d5c9bb2340a5cebbe45d37b1c6d50367b478523cf7de06d83'],
  ['assets/agents/reviewer.md', 'd3d5661331d7bd2acf65cf699e853d680e3e866559d0deb65f807b81c67c6e46'],
  ['SKILL.md', '911cc865b91a921b5771e8050ab35e03326e921d8674aebbf99ac81fcb06cdbd'],
  ['README.md', 'f356008b89e2c0bd96e314f7d1c05c344bcff8715cfb18bbcd501e60ad43949c'],
  ['references/security.md', '28af6303436e9c3fce397afbb203265d64bee023b1695fd964d3611b5cd4fab2'],
  ['references/codex.md', '62ab18386d6143aa53c98e64361844f93fa799e67ec2b42af1c73381e9c4a1de'],
  ['references/claude.md', '97d0f72e550f27f12fce591c04d23915868d3d1e7c3549cb9fa87d374fa14eb6'],
  ['CHANGELOG.md', '73eacec1cceccf8112e781e882e3d0e867dd46b8ba6817f75b15cd7ddaecd498'],
  ['VERSION', 'a63841f1ebf4dd11cdc420501e74daed07ae0b9b3553273c566331c033a27efa'],
  ['@root/README.md', 'fb3278a2bee34554c83bb9a1303d82e06932daaf310584843affd44ca844a495'],
  ['@root/.ai/context/project-tree.md', 'a4b1cd89501615a1d2b69620e33783a4405994c60099140e71037748988260b9'],
  ['@root/TODO.md', 'ebf6df3a571820278b45f5fa7e3c01604b69812c10593fd80a9bfe951f064afa'],
];
const PRE_PIN = Object.fromEntries(PRE_C17);
const fixturePathOf = (rel) => (rel.startsWith('@root/') ? rel.slice(6) : `project-setup/${rel}`);
// The current file of a skill-relative (or "@root/...") path.
const currentPathOf = (context, rel) => (rel.startsWith('@root/') ? rootPath(context, rel.slice(6)) : skillPath(context, rel));
// Plan C17-12 and C17-15 (the pins this lane cannot move): the three C16 record identities, the rc source commits.
const C16_RECORD_SHA = { plan: 'c08622f9580f1c154fe03d069e802e864d80e6b0ec6dd8f4ce5e7947b5998129', decisions: 'befc8c52d8fe9a817f070fe17914a0158631455fe1dfe4d1b751a90da044d839', acceptance: 'adc7d97592f0001f3995744d51f9a90c8bb802c01ce602c96079832c3e833673' };
const C16_RECORD_FILES = {
  plan: 'docs/plans/2026-10-25-project-setup-v3-rc3-c16.md',
  decisions: 'docs/plans/2026-10-25-project-setup-v3-rc3-c16-decisions.md',
  acceptance: 'docs/plans/2026-10-25-project-setup-v3-rc3-c16-acceptance.md',
};
const UPGRADE_SOURCES = { rc1: '8b9b4772fdde9e869dd2c39c8943c307ddb41740', rc2: '76d3b2269dee6358feda351d285a617580f7cdf8', rc3: '7a509902a08bbee89a4657576369e6d7dcd1b091' };
const OWNERSHIP_PREFIX = 'fatal: detected dubious ownership in repository at ';
const OWNERSHIP_MESSAGE = 'GIT_SAFE_OWNERSHIP: Git refused dubious repository ownership; ask the user to add only the trusted checkout\'s absolute path to the effective global or system safe.directory. Example: git config --global --add safe.directory "<trusted-checkout-path>". No result was emitted.';
const FULL_ID_RE = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

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
// The independent model of an amended file: the pinned pre-C17 bytes with the frozen amendments applied by the helper. It exists whether or not the implementation does.
const modelOf = (fx, rel) => { const t = preText(fx, rel); return t === null ? null : applyForFile(t, rel); };
const recognizes = (text, name) => new RegExp(escRe(name), 'i').test(text);
// The model of an amended file with the amendments applied up to and including `id` (the state in which `id` is the last amendment, so its anchors are adjacent and its failure controls are meaningful).
function modelThrough(fx, rel, id) {
  const order = FORWARD_ORDER17[rel];
  const at = order === undefined ? -1 : order.indexOf(id);
  const pre = preText(fx, rel);
  return pre === null || at < 0 ? null : applySteps(pre, order.slice(0, at + 1));
}

// One amended file against its pre-change bytes: the byte convention, every amendment exactly once at its anchor (checked at its turn in the reversal, so an adjacent amendment is verified once the later one is reversed), and the reversal equal
// to the pinned pre-change bytes (raw SHA-256 of plan C17-12). Returns { text, reversed }.
function checkAmendedFile(check, context, fx, rel, { expectFinalLf = true } = {}) {
  const bytes = readBytes(currentPathOf(context, rel));
  if (expectFinalLf) check(byteConvention(bytes) === null, `${rel}: LF only, no BOM and exactly one final LF (C17-5)`, byteConvention(bytes));
  if (bytes === null) return null;
  const text = bytes.toString('utf8');
  let running = text;
  for (const id of REVERSAL_ORDER17[rel]) {
    const once = amendmentOnce(running, AM17[id]);
    check(once, `${rel}: amendment ${id} stands exactly once at its stated anchor`);
    if (!once) break;
    running = reverseOne(running, AM17[id]);
  }
  const r = reverseForFile(text, rel);
  check(r.text !== null, `${rel}: the C17 amendments reverse in order ${REVERSAL_ORDER17[rel].join(', ')}`, r.failed);
  const pre = fx.files[rel];
  check(pre !== undefined && sha(pre) === PRE_PIN[rel], `${rel}: the committed fixture holds the pre-C17 bytes (raw SHA-256 pinned by plan C17-12)`, pre && sha(pre));
  if (r.text !== null) {
    const got = Buffer.from(r.text, 'utf8');
    check(sha(got) === PRE_PIN[rel] && pre !== undefined && Buffer.compare(got, pre) === 0, `${rel}: reversing exactly ${REVERSAL_ORDER17[rel].join(', ')} gives the pre-C17 bytes (nothing else changed; raw SHA-256 pinned by plan C17-12)`, sha(got));
  }
  return { text, reversed: r.text };
}
// Failure controls for one amendment, built in memory from a model text that carries it exactly once (the real files are never modified): a missing, partial, duplicated, moved, altered, differently spaced or CRLF amendment, and
// the same amendment looked for in another file, is never verified and never reversed (C17-5: it fails before any historical hashing). `movedBefore` names a text of the model the amendment is moved in front of.
// A flex amendment (SE4_17, whose F9 wrapping is not frozen) is compared with whitespace collapsed, so the whitespace controls do not apply to it.
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
  if (a.flex !== true) rejected('duplicate: a second copy right after the first', base.replace(a.before + a.neu, (m) => m + a.neu));
  rejected('duplicate: a second copy at the end of the file', base + a.neu);
  rejected('moved: the text away from its anchor', movedBefore !== null && without.includes(movedBefore) ? without.replace(movedBefore, () => a.neu + movedBefore) : `${without}${a.neu}`);
  rejected('altered: one character changed', base.replace(a.neu, () => `${a.neu.slice(0, 3)}${a.neu[3] === 'z' ? 'y' : 'z'}${a.neu.slice(4)}`));
  if (a.flex !== true) {
    rejected('altered: a doubled space inside', base.replace(a.neu, () => a.neu.replace(' ', '  ')));
    rejected('spaced: an extra blank line before the amendment', base.replace(a.before + a.neu, () => `${a.before}\n${a.neu}`));
    rejected('spaced: an extra blank line after the amendment', base.replace(a.neu + a.after, () => `${a.neu}\n${a.after}`));
    if (a.neu.includes('\n\n')) rejected('spaced: a blank line inside the amendment doubled', base.replace(a.neu, () => a.neu.replace('\n\n', '\n\n\n')));
    if (a.before.endsWith('\n\n')) rejected('spaced: the blank line before the amendment removed', base.replace(a.before + a.neu, () => `${a.before.slice(0, -1)}${a.neu}`));
  }
  rejected('CRLF: the same text with CRLF line ends', base.replace(/\n/g, '\r\n'));
  rejected('another file: a different file never carries the amendment', otherFileText);
  const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(base, 'utf8')]);
  check(byteConvention(bom) === 'starts with a BOM' && byteConvention(Buffer.from(base.replace(/\n/g, '\r\n'))) === 'contains CR' && byteConvention(Buffer.from(`${base}\n`)) === 'does not end with exactly one LF', `${label}: the byte convention rejects a BOM, CR and a doubled final LF`);
}
const bolds = (text) => [...String(text).matchAll(/\*\*[^*\n]+\*\*/g)].map((m) => m[0]);

const C17_UNCHANGED_PINS = [
  ['scripts/apply.mjs', '5f2ea3801be0ecae370a453e8a822c336e404c7622bac276a9a873d069da6874'],
  ['scripts/blocks.mjs', 'fcb6606fbfae71b69033bf09c09d608ac65333234c9ae14d212b112daec20753'],
  ['scripts/canary.mjs', '24d38a195496ffc802f5de3d2aa83b7139c6af0480d953eee2f9bf4cac83e8fe'],
  ['scripts/check-agent-baselines.mjs', '905c0254d37026eac46aa16976db7726b8abb08349352941f781ce232dae9be8'],
  ['scripts/classify-allows.mjs', '87f25ca2ecd8fc107e56f296de25b45739e86ecb017d4349e4cf54f795e4612e'],
  ['scripts/detect.mjs', '485bacd5200319f03b41006fae447718639a74edba4306da63a3e8a9ca4af982'],
  ['scripts/doctor.mjs', '7d9ee5f39931f13a35a5a9a9bb42e1af6977469485f7debb44a95acb6b8d8d06'],
  ['scripts/env-keys.mjs', '81329bc2b4a47a0c0c3570f8c6232c2de0554fff513a02fced6faaadfb10382b'],
  ['scripts/globs.mjs', '4eb71ed206deb641e9032d691e4f3b431e76548fd46ffd6275f6e339fcc59892'],
  ['scripts/lib.mjs', '7a3f8d32cd1af31f20ff67888cd483165e8dbdfb77a28eb50df21e30bb4cb8fd'],
  ['scripts/lock.mjs', 'fee94a6bac74fa2650cf62fbbfd7569dab5790c391c470c4ff55ffbea068714b'],
  ['scripts/merge-claude-settings.mjs', 'c56888d586c26f64a40afaef095a5df1a7d82551f65aabf3318d433f1709b7fe'],
  ['scripts/migrate-security-paths.mjs', '0da9855b6351392bb89b2fe5d749f351279139384a1e50ff9cf1e6c9890ea3c1'],
  ['scripts/ownership.mjs', 'dd936e399d465115acf58644024c0b7b179a95a88c0874fd7ed4b7528d13c864'],
  ['scripts/render-permissions.mjs', 'a5c8a88dbdacc743954ed825665e626fefbc2550a025fc8ffb0321bc7a7480ab'],
  ['scripts/schemas.mjs', '48e4cdedf5a44f097f88da54820e81e1e432fcb53a2db887f864588a01f0ae22'],
  ['scripts/secret-scan.mjs', '4a77e284014cf8b9d2e7c46b6cc0bde7c5c1c1e7b8f0825807563f2d740869e8'],
  ['scripts/toml.mjs', '86b1139dd3e98fd151999298ae7940d7c418d11859a6179e3459a03721728391'],
  ['scripts/validate.mjs', '5b4de7189fdfebed53efa14e2e86524462becdab62b800448a435f0807bc6070'],
  ['install/install.mjs', '9e22d4192aed1c504053e9c499bdaf98450a7bd0a80e44b0aeb4b11b19d5b947'],
  ['install/release.mjs', '59411fee9168dd936e3e049f5e6242c93cb89c5207a574df181c259f961ba941'],
  ['data/runtime-units.json', 'a1867f13ce2760cb1a676a48cdaac5a9fe4a868220dbaf7f528b169b64678ef6'],
  ['data/secret-paths.json', '37711ab7b8e1781ce533c705971f93351f1331a44b16e11e846080eb8fed1a79'],
  ['data/secret-paths-v2.0.0.json', '38198a9d326843d69c52034158f7287f71e861fea06bc884ff49ad56a56fa8a6'],
  ['assets/tools/git-safe.mjs', '995bafa72582acad616982549e4c0aa581831bc25b132f83a533f7bad91bb154'],
  ['assets/tools/guard-raw-git-core.mjs', 'cee120da3205767a4b2e17515948be55185d047175c8f5d91d38eeaa4d9210c9'],
  ['assets/tools/guard-raw-git.mjs', '7b6b8e7e5d11850656f8395563c0f6d0788a234fbc01b9642b30ae231862276e'],
  ['assets/tools/hooks-selftest.mjs', '175fa8611582fe0c8eafd8032c5dbb3c6e981e8cf9f710653c87529b58f6ba66'],
  ['assets/tools/security-policy.mjs', '2ded982e54580fc993add5b4003bc892dd08e230ea3c7d98892fccdb6fc83dbb'],
  ['assets/agents/docs-sync.md', '605398911043231f4ec53358986988ccbe8d5648beb0e918ee955d8104fff814'],
  ['assets/wrappers/claude-docs-sync.md', '36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43'],
  ['assets/wrappers/claude-reviewer.md', '284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423'],
  ['assets/wrappers/codex-docs_sync.toml', '1e6eef9ae6d75c0fef3c79b9879a0d69c4ad88d774889b81d09558cd61af6287'],
  ['assets/wrappers/codex-reviewer.toml', 'fe21c05b09bcba96b631bb08e22e6be807cdc8e0c75a740acff1b70c683c695c'],
  ['assets/templates/AGENTS.md', '616a26a54d2e8f77b0d4df3e78055ca41f6e7638654ad70a0f4d28a0e4eb5a0e'],
  ['assets/templates/CLAUDE.md', '5bb1d5ed697e921dcc839d031e082f884ca9a97a1eafd8d4a003d2ddb1cbaa47'],
  ['assets/templates/TODO.md', 'ebb2588b4c6e2254b1410b91212bf8db88fc315c402114be6e2954a7e0c9a84d'],
  ['assets/templates/adr.md', '45b92605a73d8fdda6d6009698b92f60c87fbba7e3f62f6ee3278cc6483e4ffd'],
  ['assets/templates/gitignore-block.txt', '34c13766d597a8fe6fee66709a24216d4e8cd7c364cae551fef458a8a10dc3b2'],
  ['assets/templates/nested-AGENTS.md', '11cd44a06e9e50023e8ddcb5e8d476e2338b206c2973e6d4ef6f53997b1ed370'],
  ['assets/templates/nested-CLAUDE.md', '336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49'],
  ['references/docs-generation.md', 'cabdf9cd7df65ee9d7660abc4cf9b95eb0e3f9c1386ea069ec87d55322616503'],
  ['references/modes.md', '376435f0faaa768486607c5a6ee461f0795ea6b92cb0b5a0a4d615ae67917bd7'],
  ['references/state-and-apply.md', '2c99f9ac0dd9e98656308dec605c8e330dd5e2029f4ce19c773c8ca101eaa3b1'],
  ['references/migration-v2.md', 'b4ea4fc870d4c3a9aeea70b817511c62bce6924c6c71f222c2eff094fc8e29b1'],
  ['references/migration-v1.md', 'ddba0903b66989812113ccdd16357c7ac964cf282f94b03e9107112dbd7e4a68'],
  ['references/report.md', '8d7d3fa6e834895a29d6df64c8768c9e85e35e6a8a68fc30bd4ca7d545056b64'],
  ['RELEASE-NOTES-2.0.0.md', '27711d116ec2ee4ba012b9cdaec198703e154055341cba793472d2ee79886eba'],
  ['RELEASE-NOTES-3.0.0-rc.1.md', '5649a736b4b5992d77672bb0f80dcfbf54256b7ef08a01b608204c968395ee64'],
  ['RELEASE-NOTES-3.0.0-rc.2.md', '4cbf9b9c2573f149e20234985ac7c1867fd256b56e551af8b970ea81d6b89cb4'],
  ['RELEASE-NOTES-3.0.0-rc.3.md', '68b1921f91d7c821989d810e689894ec0cfaabe494fb61486fe8e2c56ad42fd4'],
  ['data/v2.0.0/assets/agents/docs-sync.md', '217562b10ee8d43f47d085307172921f8789b7e8373056f9475e9642bf448571'],
  ['data/v2.0.0/assets/agents/reviewer.md', '06dd68ac2019369f03e66fc3729a9522286487e643b319a1cd52695d2d35b12d'],
  ['data/v2.0.0/assets/wrappers/claude-docs-sync.md', '36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43'],
  ['data/v2.0.0/assets/wrappers/claude-reviewer.md', '284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423'],
  ['data/v2.0.0/assets/wrappers/codex-docs_sync.toml', 'd860e92f20147e70ec61f7fbaaa79d18b385bd7bc8ac247f1f43d2d179f873f0'],
  ['data/v2.0.0/assets/wrappers/codex-reviewer.toml', '017b9c905f5cc033552ce981340ab04fd794bd8615f8745fe9c1f3048a52bddf'],
  ['tests/accept-rc1.mjs', 'bb75d010152971f95dcdd5663794bc8d3ab0f8cacd99cc474636c6f0ce6155ea'],
  ['tests/run-component-tests.mjs', '864b037dcb03eeecca4ef52bc1802a4c4e98ab0ac17a56013c2d7e72a17491df'],
  ['tests/c6.test.mjs', 'e48253e9b15b79c4270c2914e53bf6586059ef2214e580646a1e76a2914ca429'],
  ['tests/c10.test.mjs', '9baa081075a77144e5983407f7395663458ffcc41c0a75a096b83f069f87e253'],
  ['tests/helpers/c15-amendments.mjs', '724688e375a33a1d7236b95acba2196dbab5a1f2c0846de128f8c1d490a13725'],
  ['tests/helpers/c16-amendments.mjs', 'dfe6ae600532ceb8bf9539a242330bec8d1682019ad0a67576621e69a12f8a33'],
  ['tests/helpers/prose-check.mjs', '465531aaf0b733045a4af1b51fc91737d7e08465ad93bcfb8b3e09b76ed8d1b0'],
  ['tests/fixtures/c13-rc1-agents.json', '8d39154626167e0e3b427e0688ab2e088052a42f8b2b074662eec84a609758e2'],
  ['tests/fixtures/c14-prechange.json', 'fc7e57ca8fb04b2f611057630ca9213798f49c18153ed13067b53a1711770175'],
  ['tests/fixtures/c15-prechange.json', '79e0c2ddb56dd45b314006a4aa6fb4db4bb817e0cb308194710ef11f755fe3ad'],
  ['tests/fixtures/c16-prechange.json', '7853616ebbf2483e098bfaba530f962bce42401740cca603f94a153346a3cbdf'],
  ['tests/fixtures/review-diff-cases.json', '195f82a13a3fc91de399c9a3ea8add6f451dd3ed8b0708d95a6821e0f344bf15'],
  ['tests/fixtures/guard-raw-git-cases.json', '9417db42250fe5dc02304bf2538652f36debfcfed2834f35fc1dd451aa26d7be'],
];

// ============================================ R76/C17/head ====
// Plan C17-6, C17-14 (head row) and C17-20: `git-safe head` is the argument-free checkout-identity form. It validates its arguments before any session, uses the existing version check, root discovery and installed-policy validation, resolves HEAD once
// through the existing commit resolver (the vector after the unchanged fixed prefix is exactly rev-parse --verify --quiet --end-of-options HEAD^{commit}), and returns the validated lowercase full commit ID plus one LF (41 bytes for SHA-1, 65 for SHA-256; CRLF Git output is
// rendered as LF; branch names, dirty state and abbreviated IDs are never returned). Detached HEAD succeeds; an unborn or otherwise non-resolving HEAD is GIT_SAFE_REVISION with empty stdout; successful Git output that is not exactly one supported full ID is
// GIT_SAFE_RECORD; spawn, signal, argument-bound, policy and repository errors keep their existing classifications. No tree inventory, content read, diff, artifact write or Git-state change happens. Behavior is tested at the seam (complete vectors, results and failure
// order) and against real Git (attached, detached, unborn, SHA-1 and SHA-256, dirty trees, subdirectory start, the installed CLI and the raw-Git hook). The argument grammar and the hand-built requests are also covered by C4; the expectations below are written independently.
const HD_NULL = process.platform === 'win32' ? 'NUL' : '/dev/null';
const HD_PREFIX_KV = ['core.fsmonitor=false', 'core.quotePath=true', 'submodule.recurse=false', 'log.showSignature=false', 'log.showNotes=false', 'log.follow=false', 'log.mailmap=false', 'log.diffMerges=off', 'diff.renames=false', 'diff.submodule=short',
  'diff.relative=false', 'diff.noprefix=false', 'diff.mnemonicPrefix=false', 'diff.context=3', 'diff.interHunkContext=0', 'diff.algorithm=myers', 'diff.indentHeuristic=false', 'diff.suppressBlankEmpty=false', `diff.orderFile=${HD_NULL}`, 'color.ui=false'];
const HD_PREFIX = ['--no-pager', ...HD_PREFIX_KV.flatMap((kv) => ['-c', kv])];
const HD_RESOLVE = ['rev-parse', '--verify', '--quiet', '--end-of-options', 'HEAD^{commit}'];
const HD_PARSE_JSON = '{"subcommand":"head","revisions":["HEAD"],"paths":[],"format":null,"patch":false,"maxCount":null,"pattern":null}';
const HD_CORE_EXPORTS = ['MAX_GIT_ARG_UNITS', 'MAX_OUTPUT_BYTES', 'NARROWING_GUIDANCE', 'SUPPORTED_FORMS', 'createGitSession', 'executeGitSafe', 'main', 'parseGitSafeArgs', 'sanitizeGitEnvironment'];
const HD_MSG = {
  INPUT: 'GIT_SAFE_INPUT: invalid Git helper input',
  COMMAND: 'GIT_SAFE_COMMAND: supported commands: diff, log, show, cat, ls, grep, head, review-diff',
  ARGUMENT: 'GIT_SAFE_ARGUMENT: unsupported arguments; supported: head',
  VERSION: 'GIT_SAFE_VERSION: Git 2.31 or later is required',
  REPOSITORY: 'GIT_SAFE_REPOSITORY: not inside a Git repository',
  POLICY_IO: 'GIT_SAFE_POLICY_IO: cannot read .ai/security-paths.json; refusing to run without a valid policy',
  REVISION: 'GIT_SAFE_REVISION: revision does not resolve to a commit',
  RECORD: 'GIT_SAFE_RECORD: invalid Git metadata; no result was emitted',
  GIT: 'GIT_SAFE_GIT: Git operation failed; no result was emitted',
  ARG_LIMIT: 'GIT_SAFE_ARG_LIMIT: Git arguments exceed the safe invocation bound; narrow with -- <paths> or a smaller commit range. No result was emitted.',
  INTERNAL: 'GIT_SAFE_INTERNAL: internal failure; no result was emitted',
  POLICY_JSON: 'POLICY_JSON: policy text must be valid JSON',
  OWNERSHIP: OWNERSHIP_MESSAGE,
};
const hdLine = (message) => `git-safe: ${message}\n`;
const hdBuf = (v) => (Buffer.isBuffer(v) ? v : Buffer.from(String(v), 'utf8'));
const hdOk = (stdout, status = 0, over = {}) => ({ status, signal: null, error: null, stdout: hdBuf(stdout), overflow: false, ...over });
const HD_ID1 = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const HD_ID256 = 'f0e1d2c3b4a5968778695a4b3c2d1e0f00112233445566778899aabbccddeeff';
const HD_POLICY = Buffer.from(JSON.stringify({ schema: 2, patterns: [{ anchor: 'any', glob: '**/.env*' }], projectPatterns: [] }), 'utf8');
const HD_ENV = {
  PATH: process.env.PATH || process.env.Path || '/usr/bin', HOME: '/seam/home', USERPROFILE: '/seam/home', GIT_CONFIG_GLOBAL: '/seam/global.gitconfig', GIT_CONFIG_SYSTEM: '/seam/system.gitconfig', GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: '*', GIT_PAGER: 'less', FOO_BAR: 'kept',
};
// A fake executor: the three session calls and the one resolution of HEAD, recorded exactly as the core made them; any other operation is an unexpected call (status 127) and is recorded.
function hdFake(context, world = {}) {
  const base = path.resolve(context.tmp, 'c17-head-seam');
  const root = path.join(base, 'repo');
  const start = path.join(base, 'start');
  const calls = [];
  const W = { version: 'git version 2.53.0.windows.2\r\n', root: `${root.replace(/\\/g, '/')}\n`, head: `${HD_ID1}\n`, handle: null, ...world };
  const execute = async (req) => {
    const op = Array.isArray(req.argv) ? req.argv.slice(HD_PREFIX.length) : [];
    const kind = op[0] === '--version' ? 'version' : op[0] === 'rev-parse' && op[1] === '--show-toplevel' ? 'root' : op[0] === 'rev-parse' && op[1] === '--verify' ? 'resolve' : 'unexpected';
    calls.push({ kind, op, argv: req.argv, cwd: req.cwd, env: { ...req.env }, limit: req.limit, keys: Object.keys(req) });
    if (typeof W.handle === 'function') { const r = await W.handle(kind, op); if (r !== undefined) return r !== null && typeof r === 'object' && Object.prototype.hasOwnProperty.call(r, '__raw') ? r.__raw : (Buffer.isBuffer(r) || typeof r === 'string' ? hdOk(r) : r); }
    if (kind === 'version') return hdOk(W.version);
    if (kind === 'root') return hdOk(W.root);
    if (kind === 'resolve') return hdOk(W.head);
    return { status: 127, signal: null, error: null, stdout: Buffer.alloc(0), overflow: false };
  };
  return { execute, calls, kinds: () => calls.map((c) => c.kind), root, start };
}
async function hdMain(core, context, argv, { world = {}, env = HD_ENV, policy = HD_POLICY, readFile = null } = {}) {
  const fake = hdFake(context, world);
  const reads = [];
  const rf = readFile || (async (p) => { reads.push(p); return policy; });
  const r = await core.main(argv, { cwd: fake.start, env, execute: fake.execute, readFile: rf });
  return { r, fake, reads };
}
function hdExpect(check, label, r, { exit, stdout = Buffer.alloc(0), stderr = '' }) {
  check(r !== null && typeof r === 'object' && eq(Object.keys(r).sort(), ['exitCode', 'stderr', 'stdout']), `${label}: the result holds exactly exitCode, stdout, stderr`, r && Object.keys(r));
  if (!r) return;
  check(r.exitCode === exit, `${label}: exit code ${exit}`, r.exitCode);
  check(Buffer.isBuffer(r.stdout) && Buffer.compare(r.stdout, hdBuf(stdout)) === 0, `${label}: stdout is exactly the expected bytes`, { got: r.stdout && r.stdout.length, want: hdBuf(stdout).length });
  check(typeof r.stderr === 'string' && r.stderr === stderr, `${label}: stderr is exactly ${show(stderr.slice(0, 120))}`, r.stderr);
}
const hdFail = (message) => ({ exit: 2, stdout: Buffer.alloc(0), stderr: hdLine(message) });
function hdGit(context, cwd, args, env = null) {
  const r = gitIn(context, cwd, args, env === null ? {} : { env });
  return r;
}
// A real repository under scratch: SHA-1 or SHA-256, with the installed policy file, optional commits.
function hdRepo(context, dir, { format = 'sha1', commits = 2, branch = 'main' } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const a = gitIn(context, dir, ['init', '-q', `--object-format=${format}`, '-b', branch]);
  if (a.code !== 0) throw new Error(`cannot create the ${format} fixture repository: ${a.stderr}`);
  putFile(path.join(dir, '.ai', 'security-paths.json'), HD_POLICY);
  const ids = [];
  for (let i = 0; i < commits; i++) {
    putFile(path.join(dir, 'src', 'wallet.txt'), `version ${i}\n`);
    gitOk(context, dir, ['add', 'src/wallet.txt']);
    gitOk(context, dir, ['commit', '-q', '-m', `commit ${i}`]);
    ids.push(gitOk(context, dir, ['rev-parse', 'HEAD']).stdout);
  }
  return { dir, ids };
}
// The Git children of the real executor (version, root, resolution) are counted after each real call by outcome, so the launch record includes them (plan C17-18).
const hdCountChildren = (context, r) => { countProcess(context, r.exitCode === 0 ? 3 : (r.stderr === hdLine(HD_MSG.REPOSITORY) || r.stderr === hdLine(OWNERSHIP_MESSAGE) ? 2 : 3)); return r; };
const hdTreeNames = (dir) => { try { return fs.readdirSync(dir).sort(); } catch { return null; } };
async function headGroup(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const coreRel = 'assets/tools/git-safe-core.mjs';
    const core = await importOrFail(failures, pathToFileURL(skillPath(context, coreRel)).href, coreRel);
    if (!core) return;
    await step('surface: the core still exports exactly its nine names (no new public export), keeps the six-entry narrowing map, lists head among its supported forms, carries the frozen literals of the plan (the head form, the new command list, the lazy-import wording, the ownership prefix and code, the resolution flags and the seam flag name) and parses ["head"] to exactly the plan object', async () => {
      check(eq(Object.keys(core).sort(), [...HD_CORE_EXPORTS].sort()), 'the core exports exactly the nine C4 names', Object.keys(core).sort());
      check(eq(Object.keys(core.NARROWING_GUIDANCE).sort(), ['cat', 'diff', 'grep', 'log', 'ls', 'show']) && !('head' in core.NARROWING_GUIDANCE) && Object.isFrozen(core.NARROWING_GUIDANCE), 'NARROWING_GUIDANCE keeps its six entries (validated HEAD output cannot require narrowing)', Object.keys(core.NARROWING_GUIDANCE));
      check(core.SUPPORTED_FORMS.head === 'head' && Object.keys(core.SUPPORTED_FORMS).length === 7 && Object.keys(core.SUPPORTED_FORMS).indexOf('head') === 6, 'SUPPORTED_FORMS gains exactly head, after grep', Object.keys(core.SUPPORTED_FORMS));
      const src = readText(skillPath(context, coreRel)) || '';
      for (const lit of CORE_FROZEN_LITERALS) check(src.includes(lit), `the core carries the frozen literal ${show(lit, 90)}`);
      check(!/The six object commands never import it/.test(src) && src.includes('The six object commands and head'), 'the lazy-import comment describes "The six object commands and head"');
      check(C17_LITERALS.HEAD_PARSE === HD_PARSE_JSON && C17_LITERALS.HEAD_RESOLVE_VECTOR === "['rev-parse', '--verify', '--quiet', '--end-of-options', 'HEAD^{commit}']", 'the plan literals of the parse object and the resolution vector are the ones this test uses');
      const a = core.parseGitSafeArgs(['head']);
      check(JSON.stringify(a) === HD_PARSE_JSON && eq(a, JSON.parse(HD_PARSE_JSON)), 'parseGitSafeArgs(["head"]) is exactly the plan object (key order included)', a);
      const reviewDiff = readText(skillPath(context, 'assets/tools/review-diff.mjs')) || '';
      check(reviewDiff.includes(C17_LITERALS.COMMAND_DETAIL_NEW) && !reviewDiff.includes(`'${C17_LITERALS.COMMAND_DETAIL_OLD}'`), 'review-diff.mjs carries the new command-list detail and no longer the old one');
    });
    await step('seam: a successful head makes exactly the version, root and resolution calls (the resolution vector is the plan vector after the unchanged prefix, run in the root with a sanitized environment and no limit), reads the installed policy once, and returns the validated full ID plus one LF (SHA-1 41 bytes, SHA-256 65 bytes, CRLF rendered as LF) with empty stderr; no inventory, content, merge-base or other call', async () => {
      for (const [label, head, want] of [['SHA-1', `${HD_ID1}\n`, `${HD_ID1}\n`], ['SHA-256', `${HD_ID256}\n`, `${HD_ID256}\n`], ['SHA-1 with CRLF', `${HD_ID1}\r\n`, `${HD_ID1}\n`], ['SHA-256 with CRLF', `${HD_ID256}\r\n`, `${HD_ID256}\n`]]) {
        const s = await hdMain(core, context, ['head'], { world: { head } });
        hdExpect(check, `head (${label})`, s.r, { exit: 0, stdout: want });
        check(s.r.stdout.length === (want.length) && (s.r.stdout.length === 41 || s.r.stdout.length === 65) && s.r.stdout.length < core.MAX_OUTPUT_BYTES, `head (${label}): ${s.r.stdout.length} bytes, strictly below the output bound`, s.r.stdout.length);
        check(eq(s.fake.kinds(), ['version', 'root', 'resolve']) && s.reads.length === 1 && /security-paths\.json$/.test(s.reads[0].replace(/\\/g, '/')) && s.reads[0].replace(/\\/g, '/').endsWith('/.ai/security-paths.json'), `head (${label}): exactly version, root and one resolution, one policy read`, { kinds: s.fake.kinds(), reads: s.reads });
        const [v, r, h] = s.fake.calls;
        check(v && eq(v.op, ['--version']) && r && eq(r.op, ['rev-parse', '--show-toplevel']) && h && eq(h.op, HD_RESOLVE), `head (${label}): the vectors are --version, rev-parse --show-toplevel and the plan resolution vector`, s.fake.calls.map((c) => c.op));
        check(s.fake.calls.every((c) => eq(c.argv.slice(0, HD_PREFIX.length), HD_PREFIX) && eq(c.keys.slice().sort(), ['argv', 'cwd', 'env', 'limit']) && c.limit === null), `head (${label}): every call carries the unchanged fixed prefix, exactly argv/cwd/env/limit and no limit`);
        check(v.cwd === path.resolve(s.fake.start) && r.cwd === path.resolve(s.fake.start) && h.cwd === path.resolve(s.fake.root), `head (${label}): version and root run in the starting directory, the resolution in the normalized root`, s.fake.calls.map((c) => c.cwd));
        check(s.fake.calls.every((c) => !Object.keys(c.env).some((k) => /^GIT_CONFIG_(COUNT|PARAMETERS|KEY_|VALUE_)/i.test(k)) && c.env.GIT_CONFIG_GLOBAL === '/seam/global.gitconfig' && c.env.GIT_CONFIG_NOSYSTEM === '1' && c.env.GIT_PAGER === 'cat' && c.env.FOO_BAR === 'kept'), `head (${label}): the environment is sanitized (injected configuration removed, the user's global and system sources kept)`);
      }
      const dirty = await hdMain(core, context, ['head'], { world: { head: `${HD_ID1}\n` } });
      check(Buffer.compare(dirty.r.stdout, Buffer.from(`${HD_ID1}\n`)) === 0, 'the output never carries a branch name, dirty state or an abbreviated ID: it is the resolved ID and one LF');
    });
    await step('seam: malformed successful Git output is GIT_SAFE_RECORD with empty stdout and is never read as an unequal identity; the failure stops after the one resolution', async () => {
      const bad = [['empty output', ''], ['no terminator', HD_ID1], ['uppercase hex', `${HD_ID1.toUpperCase()}\n`], ['mixed case', `${HD_ID1.slice(0, 20)}${HD_ID1.slice(20).toUpperCase()}\n`], ['39 digits', `${HD_ID1.slice(1)}\n`], ['41 digits', `${HD_ID1}0\n`], ['63 digits', `${HD_ID256.slice(1)}\n`],
        ['65 digits', `${HD_ID256}0\n`], ['an abbreviated 12-digit ID', `${HD_ID1.slice(0, 12)}\n`], ['a non-hex digit', `${HD_ID1.slice(0, 39)}g\n`], ['two lines', `${HD_ID1}\n${HD_ID1}\n`], ['trailing text line', `${HD_ID1}\nrefs/heads/main\n`], ['a leading space', ` ${HD_ID1}\n`], ['a trailing space', `${HD_ID1} \n`],
        ['a doubled CR', `${HD_ID1}\r\r\n`], ['a NUL', `${HD_ID1}\u0000\n`], ['a blank line only', '\n'], ['a ref name', 'refs/heads/main\n'], ['invalid UTF-8', Buffer.concat([Buffer.from(HD_ID1.slice(0, 38)), Buffer.from([0xff, 0xfe]), Buffer.from('\n')])], ['a 40-digit ID then CRLF CRLF', `${HD_ID1}\r\n\r\n`], ['a bare CR terminator', `${HD_ID1}\r`]];
      for (const [label, out] of bad) {
        const s = await hdMain(core, context, ['head'], { world: { head: out } });
        hdExpect(check, `malformed output: ${label}`, s.r, hdFail(HD_MSG.RECORD));
        check(eq(s.fake.kinds(), ['version', 'root', 'resolve']), `malformed output: ${label}: exactly the three calls`, s.fake.kinds());
      }
    });
    await step('seam: an unborn or non-resolving HEAD (the quiet verify exits 1; 128 and other statuses too) is GIT_SAFE_REVISION with empty stdout; spawn errors, signals, throws, rejections, invalid results and length errors keep their existing classifications; no further call follows', async () => {
      for (const [label, res] of [['status 1 and empty output (the unborn HEAD)', hdOk('', 1)], ['status 128', hdOk('', 128)], ['status 255', hdOk('', 255)], ['status 127', hdOk('', 127)], ['status 1 with output', hdOk('garbage\n', 1)], ['status 2', hdOk(`${HD_ID1}\n`, 2)]]) {
        const s = await hdMain(core, context, ['head'], { world: { handle: (k) => (k === 'resolve' ? { __raw: res } : undefined) } });
        hdExpect(check, `HEAD does not resolve: ${label}`, s.r, hdFail(HD_MSG.REVISION));
        check(eq(s.fake.kinds(), ['version', 'root', 'resolve']), `HEAD does not resolve: ${label}: the three calls only`, s.fake.kinds());
      }
      const empty = Buffer.alloc(0);
      const failing = [
        ['a signal', { status: null, signal: 'SIGTERM', error: null, stdout: empty, overflow: false }, HD_MSG.GIT], ['a spawn error', { status: null, signal: null, error: 'ENOENT', stdout: empty, overflow: false }, HD_MSG.GIT], ['E2BIG', { status: null, signal: null, error: 'E2BIG', stdout: empty, overflow: false }, HD_MSG.ARG_LIMIT],
        ['ENAMETOOLONG', { status: null, signal: null, error: 'ENAMETOOLONG', stdout: empty, overflow: false }, HD_MSG.ARG_LIMIT], ['stdout as a string', { status: 0, signal: null, error: null, stdout: HD_ID1, overflow: false }, HD_MSG.GIT], ['an overflow on an unbounded call', { status: null, signal: null, error: null, stdout: empty, overflow: true }, HD_MSG.GIT],
        ['a missing key', { status: 0, signal: null, error: null, stdout: hdBuf(`${HD_ID1}\n`) }, HD_MSG.GIT], ['an unknown key', { status: 0, signal: null, error: null, stdout: hdBuf(`${HD_ID1}\n`), overflow: false, stderr: 'x' }, HD_MSG.GIT], ['a status above 255', { status: 256, signal: null, error: null, stdout: empty, overflow: false }, HD_MSG.GIT],
      ];
      for (const [label, res, message] of failing) {
        const s = await hdMain(core, context, ['head'], { world: { handle: (k) => (k === 'resolve' ? { __raw: res } : undefined) } });
        hdExpect(check, `executor result at the resolution: ${label}`, s.r, hdFail(message));
      }
      for (const [label, fn, message] of [['a throw', () => { throw new Error('boom'); }, HD_MSG.GIT], ['a rejection', () => Promise.reject(new Error('boom')), HD_MSG.GIT]]) {
        const s = await hdMain(core, context, ['head'], { world: { handle: (k) => (k === 'resolve' ? fn() : undefined) } });
        hdExpect(check, `executor at the resolution: ${label}`, s.r, hdFail(message));
      }
    });
    await step('seam: the stages before the resolution keep their classifications and nothing later runs: Git below 2.31 (VERSION), a failing version call, a failing or malformed root (REPOSITORY), the recognized ownership refusal (OWNERSHIP), and every installed-policy failure (head requires a valid installed policy and is not a policy-bypass entry point)', async () => {
      for (const v of ['git version 2.30.9\n', 'git version 1.99.0\n', 'garbage\n', '', 'git version 2.31.0']) {
        const s = await hdMain(core, context, ['head'], { world: { version: v } });
        hdExpect(check, `version ${show(v)}`, s.r, hdFail(HD_MSG.VERSION));
        check(eq(s.fake.kinds(), ['version']) && s.reads.length === 0, `version ${show(v)}: nothing follows`, s.fake.kinds());
      }
      const sv = await hdMain(core, context, ['head'], { world: { version: 'git version 2.31.0\n' } });
      check(sv.r.exitCode === 0, 'Git 2.31.0 is accepted');
      for (const [label, world] of [['status 128', { handle: (k) => (k === 'root' ? { __raw: hdOk('', 128) } : undefined) }], ['status 1', { handle: (k) => (k === 'root' ? { __raw: hdOk('', 1) } : undefined) }], ['an empty root', { root: '' }], ['a relative root', { root: 'relative/dir\n' }], ['an embedded LF', { root: 'abc\ndef\n' }]]) {
        const s = await hdMain(core, context, ['head'], { world });
        hdExpect(check, `root: ${label}`, s.r, hdFail(HD_MSG.REPOSITORY));
        check(eq(s.fake.kinds(), ['version', 'root']) && s.reads.length === 0, `root: ${label}: no policy read and no resolution`, s.fake.kinds());
      }
      const own = await hdMain(core, context, ['head'], { world: { handle: (k) => (k === 'root' ? { __raw: hdOk('', 128, { dubiousOwnership: true }) } : undefined) } });
      hdExpect(check, 'the recognized ownership refusal at the root stage', own.r, hdFail(HD_MSG.OWNERSHIP));
      check(eq(own.fake.kinds(), ['version', 'root']) && own.reads.length === 0, 'the ownership refusal stops after the root call', own.fake.kinds());
      const policies = [
        ['an unreadable policy (rejection)', { readFile: async () => { throw new Error('EACCES'); } }, HD_MSG.POLICY_IO], ['a policy that is not a Buffer', { readFile: async () => 'text' }, HD_MSG.POLICY_IO], ['a missing policy file', { readFile: async () => { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; } }, HD_MSG.POLICY_IO],
        ['a policy that is invalid UTF-8', { readFile: async () => Buffer.from([0xff, 0xfe, 0x7b]) }, HD_MSG.POLICY_JSON],
      ];
      for (const [label, o, message] of policies) {
        const s = await hdMain(core, context, ['head'], o);
        hdExpect(check, `policy: ${label}`, s.r, hdFail(message));
        check(eq(s.fake.kinds(), ['version', 'root']), `policy: ${label}: HEAD is not resolved without a valid policy`, s.fake.kinds());
      }
      for (const [label, text] of [['not JSON', 'not json'], ['an empty file', ''], ['an unknown schema', '{"schema":9,"patterns":[]}'], ['a missing schema', '{"patterns":[]}'], ['an array', '[]']]) {
        const s = await hdMain(core, context, ['head'], { policy: Buffer.from(text, 'utf8') });
        check(s.r.exitCode === 2 && s.r.stdout.length === 0 && /^git-safe: POLICY_[A-Z_]+: /.test(s.r.stderr) && s.r.stderr.endsWith('\n') && !s.r.stderr.includes(text.slice(0, 6) || '\u0001'), `policy: ${label}: exit 2, empty stdout and one POLICY_ line`, s.r.stderr);
        check(eq(s.fake.kinds(), ['version', 'root']), `policy: ${label}: no resolution without a valid policy`, s.fake.kinds());
      }
    });
    await step('hand-built use: executeGitSafe over a session returns the ID plus LF for the exact head request, a forged session is GIT_SAFE_INPUT, and the resolution is made once per request', async () => {
      const fake = hdFake(context, {});
      const session = await core.createGitSession({ cwd: fake.start, env: HD_ENV, execute: fake.execute, readFile: async () => HD_POLICY });
      const before = fake.calls.length;
      const out = await core.executeGitSafe(core.parseGitSafeArgs(['head']), session);
      check(Buffer.isBuffer(out) && out.toString('utf8') === `${HD_ID1}\n` && fake.calls.length === before + 1 && eq(fake.calls[fake.calls.length - 1].op, HD_RESOLVE), 'the exact head request returns the ID plus LF through exactly one resolution call');
      for (const [label, sess] of [['an empty object', {}], ['a copy of a real session', { ...session }], ['null', null], ['a frozen look-alike', Object.freeze({ root: session.root, policy: session.policy, git: session.git })]]) {
        let e = null; try { await core.executeGitSafe(core.parseGitSafeArgs(['head']), sess); } catch (x) { e = x; }
        check(e !== null && e.code === 'GIT_SAFE_INPUT' && e.message === HD_MSG.INPUT, `head over ${label}: GIT_SAFE_INPUT`, e && e.message);
      }
    });
    await step('real Git: attached, detached and SHA-256 repositories return the full current commit ID plus one LF (41 or 65 bytes), an unborn HEAD is GIT_SAFE_REVISION with empty stdout, a dirty tree, a branch name and a subdirectory start change nothing, and the call performs no write (index, refs and worktree names are identical before and after)', async () => {
      const gv = gitIn(context, context.tmp, ['--version'], { env: { ...context.env, LC_ALL: 'C' } });
      check(gv.code === 0 && /^git version \d+\.\d+/.test(gv.stdout), `the Git version is recorded: ${gv.stdout}`, gv.stdout);
      diag(context, `R76/C17/head real-Git controls ran with ${gv.stdout}`);
      await withScratch(context, 'head', async (dir) => {
        const att = hdRepo(context, path.join(dir, 'attached'), { branch: 'feature-x' });
        const tip = att.ids[1];
        const run = async (repoDir, cwd = repoDir) => hdCountChildren(context, await core.main(['head'], { cwd, env: context.env }));
        const snap = (repoDir) => ({ head: gitIn(context, repoDir, ['rev-parse', 'HEAD']).stdout, refs: gitIn(context, repoDir, ['for-each-ref', '--format=%(refname) %(objectname)']).stdout, status: gitIn(context, repoDir, ['status', '--porcelain=v1', '-z', '--untracked-files=all']).stdout, index: sha(readBytes(path.join(repoDir, '.git', 'index')) || Buffer.alloc(0)), names: hdTreeNames(repoDir), gitNames: hdTreeNames(path.join(repoDir, '.git')) });
        putFile(path.join(att.dir, 'src', 'wallet.txt'), 'dirty change\n');
        putFile(path.join(att.dir, 'staged.txt'), 'staged\n'); gitOk(context, att.dir, ['add', 'staged.txt']);
        putFile(path.join(att.dir, 'untracked.txt'), 'untracked\n');
        const beforeAtt = snap(att.dir);
        const a = await run(att.dir);
        hdExpect(check, 'attached HEAD on a dirty tree', a, { exit: 0, stdout: `${tip}\n` });
        check(a.stdout.length === 41 && !a.stdout.includes('feature-x') && !a.stdout.includes('dirty'), 'the attached result is 41 bytes with no branch name and no dirty state');
        const sub = path.join(att.dir, 'src', 'deep');
        fs.mkdirSync(sub, { recursive: true });
        const fromSub = await run(att.dir, sub);
        hdExpect(check, 'a start in a subdirectory resolves the checkout root', fromSub, { exit: 0, stdout: `${tip}\n` });
        rmrf(sub);
        check(eq(snap(att.dir), beforeAtt), 'head wrote nothing: HEAD, refs, status, the index bytes, the worktree names and the .git names are identical before and after', { before: beforeAtt.names, after: snap(att.dir).names });
        gitOk(context, att.dir, ['checkout', '-q', '-f', '--detach', att.ids[0]]);
        const d = await run(att.dir);
        hdExpect(check, 'detached HEAD at the first commit (not the branch tip)', d, { exit: 0, stdout: `${att.ids[0]}\n` });
        check(att.ids[0] !== tip && d.stdout.toString('utf8').trim() === gitIn(context, att.dir, ['rev-parse', 'HEAD']).stdout, 'the detached result is the current commit, which differs from the branch tip');
        const sha256 = hdRepo(context, path.join(dir, 'sha256'), { format: 'sha256' });
        const s = await run(sha256.dir);
        hdExpect(check, 'a SHA-256 repository', s, { exit: 0, stdout: `${sha256.ids[1]}\n` });
        check(s.stdout.length === 65 && /^[0-9a-f]{64}\n$/.test(s.stdout.toString('utf8')), 'the SHA-256 result is 65 bytes: 64 lowercase hex digits and one LF');
        const unborn = hdRepo(context, path.join(dir, 'unborn'), { commits: 0 });
        const beforeUnborn = snap(unborn.dir);
        const u = await run(unborn.dir);
        hdExpect(check, 'an unborn HEAD', u, hdFail(HD_MSG.REVISION));
        check(eq(snap(unborn.dir), beforeUnborn), 'the unborn-HEAD attempt wrote nothing');
        const nonRepo = path.join(dir, 'plain');
        fs.mkdirSync(nonRepo, { recursive: true });
        const n = hdCountChildren(context, await core.main(['head'], { cwd: nonRepo, env: { ...context.env, GIT_CEILING_DIRECTORIES: dir } }));
        hdExpect(check, 'a directory that is no repository', n, hdFail(HD_MSG.REPOSITORY));
        // the installed CLI and the raw-Git hook
        const tools = path.join(att.dir, '.ai', 'tools');
        for (const f of ['security-policy.mjs', 'git-safe-core.mjs', 'git-safe.mjs']) putFile(path.join(tools, f), readBytes(skillPath(context, `assets/tools/${f}`)) || Buffer.alloc(0));
        gitOk(context, att.dir, ['checkout', '-q', 'feature-x']);
        const entry = path.join(tools, 'git-safe.mjs');
        const cli = execNode(context, { cwd: path.join(att.dir, 'src'), script: entry, args: ['head'] });
        check(cli.dead === null && cli.code === 0 && cli.stdout === `${tip}\n` && cli.stderr === '', 'the installed CLI started in a subdirectory prints the full commit ID plus LF (exit 0, empty stderr), with only the three-file reader present (head never imports review-diff)', { code: cli.code, out: cli.stdout.slice(0, 80), err: cli.stderr.slice(0, 120) });
        const raw = execNode(context, { cwd: att.dir, script: entry, args: ['rev-parse', '--verify', 'HEAD'] });
        check(raw.code === 2 && raw.stdout === '' && raw.stderr === hdLine(HD_MSG.COMMAND), 'git-safe rev-parse --verify HEAD stays unsupported: GIT_SAFE_COMMAND with the new command list', { code: raw.code, err: raw.stderr.slice(0, 160) });
        for (const extra of [['HEAD'], ['--'], ['--help'], ['--out', 'x.txt']]) {
          const bad = execNode(context, { cwd: att.dir, script: entry, args: ['head', ...extra] });
          check(bad.code === 2 && bad.stdout === '' && bad.stderr === hdLine(HD_MSG.ARGUMENT), `the installed CLI refuses head ${show(extra)} with the exact argument line`, { code: bad.code, err: bad.stderr.slice(0, 120) });
        }
        const guard = await importOrFail(failures, pathToFileURL(skillPath(context, 'assets/tools/guard-raw-git-core.mjs')).href, 'guard-raw-git-core.mjs');
        if (guard) {
          for (const tool of ['Bash', 'PowerShell']) {
            const g = guard.evaluateHookInput(JSON.stringify({ tool_name: tool, tool_input: { command: 'node .ai/tools/git-safe.mjs head' } }));
            check(g.exitCode === 0 && g.stdout === '' && g.stderr === '', `the raw-Git hook still permits node .ai/tools/git-safe.mjs head (${tool})`, g);
          }
        }
      });
    });
    flushProcessCount(context, 'R76/C17/head', mark);
  });
}

// ============================================ R76/C17/ownership ====
// Plan C17-7, C17-14 (ownership row), C17-20, F3, F4, F13 and F15: the production executor classifies Git's dubious-ownership refusal with one private, bounded stderr classifier (the exact ASCII prefix at stderr byte zero, compared incrementally across chunks, only
// match position and match/mismatch state retained, the rest of stderr drained and dropped) and reports it through the optional own boolean property dubiousOwnership, true only for status 128 with empty stdout, null signal, null error and overflow false (F4). Only the
// root-discovery stage acts on a positive flag (GIT_SAFE_OWNERSHIP, exit 2, the fixed text, no path or stderr); every other combination keeps GIT_SAFE_REPOSITORY, and C16's grep empty-tree probe ignores the flag. sanitizeGitEnvironment is byte-identical and
// still strips environment-injected safe.directory entries. The classifier is private, so it is exercised the way F13 prescribes: a child-process probe replaces child_process.spawn, calls module.syncBuiltinESMExports(), and only then imports the real core, which
// runs its real executor over synthetic stderr chunks (asserting that the instrumented spawn was called). Real Git (GIT_TEST_ASSUME_DIFFERENT_OWNER=1, LC_ALL=C, the recorded Git version) verifies the production executor against Git itself; that is not a measurement of the
// Codex Windows user. The seam-level validation of the flag is also covered by C4 and C5; the expectations here are written independently.
const OW_PREFIX = 'fatal: detected dubious ownership in repository at ';
const OW_LINE = hdLine(OWNERSHIP_MESSAGE);
const OW_REPO_LINE = hdLine(HD_MSG.REPOSITORY);
const OW_GIT_LINE = hdLine(HD_MSG.GIT);
const OW_PATH_MARKER = 'C:/secret-marker-path/never-in-a-result';
const OW_PAYLOAD_MARKER = 'PAYLOAD-MARKER-never-in-a-result';
const OW_B64 = (s) => Buffer.from(s, 'latin1').toString('base64');
const OW_PROBE_SOURCE = [
  "import childProcess from 'node:child_process';",
  "import fs from 'node:fs';",
  "import { syncBuiltinESMExports } from 'node:module';",
  "import { EventEmitter } from 'node:events';",
  "import { PassThrough } from 'node:stream';",
  "const [, , coreUrl, scenarioFile, startDir] = process.argv;",
  "const scenarios = JSON.parse(fs.readFileSync(scenarioFile, 'utf8'));",
  "let scenario = null; let spawned = []; let originalCalled = 0;",
  "const tick = () => new Promise((r) => setImmediate(r));",
  "const POLICY = Buffer.from(JSON.stringify({ schema: 2, patterns: [{ anchor: 'any', glob: '**/.env*' }], projectPatterns: [] }));",
  "const ID = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';",
  "childProcess.spawn = (command, argv, options) => {",
  "  spawned.push({ command, argv, cwd: options.cwd, shell: options.shell, windowsHide: options.windowsHide, stdio: options.stdio, env: options.env });",
  "  if (scenario.throwOnSpawn && spawned.length === 2) throw Object.assign(new Error('spawn exploded'), { code: 'EACCES' });",
  "  const child = new EventEmitter();",
  "  child.stdout = new PassThrough(); child.stderr = new PassThrough();",
  "  child.kill = () => { child.killed = true; return true; };",
  "  const op = argv.slice(41);",
  "  const kind = op[0] === '--version' ? 'version' : (op[0] === 'rev-parse' && op[1] === '--show-toplevel') ? 'root' : (op[0] === 'rev-parse' && op[1] === '--verify') ? 'resolve' : 'other';",
  "  (async () => {",
  "    await tick();",
  "    if (kind === 'version') { child.stdout.write('git version 2.53.0.windows.2\\r\\n'); child.stdout.end(); child.stderr.end(); await tick(); child.emit('close', 0, null); return; }",
  "    if (kind === 'resolve') { child.stdout.write(ID + '\\n'); child.stdout.end(); child.stderr.end(); await tick(); child.emit('close', 0, null); return; }",
  "    if (kind !== 'root') { child.stdout.end(); child.stderr.end(); await tick(); child.emit('close', 127, null); return; }",
  "    if (scenario.spawnError) { child.emit('error', Object.assign(new Error('x'), { code: scenario.spawnError })); return; }",
  "    for (const c of scenario.chunks || []) { child.stderr.write(Buffer.from(c, 'base64')); await tick(); }",
  "    if (scenario.suffix) { const chunk = Buffer.alloc(scenario.suffix.chunkBytes, 0x41); for (let i = 0; i < scenario.suffix.count; i++) { child.stderr.write(chunk); if (i % 8 === 7) await tick(); } await tick(); }",
  "    if (scenario.stdout) child.stdout.write(Buffer.from(scenario.stdout, 'base64'));",
  "    child.stdout.end(); child.stderr.end(); await tick(); await tick();",
  "    child.emit('close', scenario.signal ? null : scenario.status, scenario.signal || null);",
  "  })();",
  "  return child;",
  "};",
  "syncBuiltinESMExports();",
  "const core = await import(coreUrl);",
  "const results = [];",
  "for (const s of scenarios) {",
  "  scenario = s; spawned = [];",
  "  const env = Object.assign({ PATH: process.env.PATH || '', HOME: '/probe/home', GIT_CONFIG_GLOBAL: '/probe/global.gitconfig', GIT_CONFIG_NOSYSTEM: '1' }, s.env || {});",
  "  const r = await core.main(['head'], { cwd: startDir, env, readFile: async () => POLICY });",
  "  results.push({ id: s.id, spawnCount: spawned.length, exitCode: r.exitCode, stdoutHex: Buffer.from(r.stdout).toString('hex'), stderr: r.stderr, vectors: spawned.map((x) => x.argv.slice(41)), prefixes: spawned.map((x) => x.argv.slice(0, 41)), cwds: spawned.map((x) => x.cwd), shells: spawned.map((x) => x.shell), stdios: spawned.map((x) => x.stdio), commands: spawned.map((x) => x.command), envs: spawned.map((x) => x.env) });",
  "}",
  "process.stdout.write(JSON.stringify(results));",
].join('\n');
function owScenarios() {
  const L = OW_PREFIX.length;
  const out = [];
  const add = (id, over) => out.push({ id, status: 128, ...over });
  const tailText = `'${OW_PATH_MARKER}'\n${OW_PAYLOAD_MARKER}\n`;
  add('control-success', { status: 0, stdout: OW_B64('/probe/repo\n'), chunks: [] });
  add('exact-one-chunk', { chunks: [OW_B64(OW_PREFIX + tailText)] });
  add('prefix-only', { chunks: [OW_B64(OW_PREFIX)] });
  add('prefix-then-newline', { chunks: [OW_B64(`${OW_PREFIX}\n`)] });
  for (let k = 1; k < L; k++) add(`split-${k}`, { chunks: [OW_B64(OW_PREFIX.slice(0, k)), OW_B64(OW_PREFIX.slice(k) + tailText)] });
  for (let k = 1; k + 1 < L; k += 3) add(`split3-${k}`, { chunks: [OW_B64(OW_PREFIX.slice(0, k)), OW_B64(OW_PREFIX.slice(k, k + 1)), OW_B64(OW_PREFIX.slice(k + 1) + tailText)] });
  add('byte-by-byte', { chunks: [...(OW_PREFIX + tailText)].map((c) => OW_B64(c)) });
  add('empty-chunks-between', { chunks: [OW_B64(''), OW_B64(OW_PREFIX.slice(0, 7)), OW_B64(''), OW_B64(OW_PREFIX.slice(7) + tailText), OW_B64('')] });
  for (let i = 0; i < L; i++) {
    const flipped = OW_PREFIX.slice(0, i) + (OW_PREFIX[i] === '~' ? '^' : '~') + OW_PREFIX.slice(i + 1);
    add(`mismatch-${i}`, { chunks: [OW_B64(flipped + tailText)] });
    add(`mismatch-split-${i}`, { chunks: [OW_B64(flipped.slice(0, i + 1)), OW_B64(flipped.slice(i + 1) + tailText)] });
  }
  add('missing-final-space-then-quote', { chunks: [OW_B64(OW_PREFIX.slice(0, -1) + tailText)] });
  add('ends-before-the-prefix-completes', { chunks: [OW_B64(OW_PREFIX.slice(0, -1))] });
  add('ends-after-one-byte', { chunks: [OW_B64('f')] });
  add('empty-stderr', { chunks: [] });
  add('uppercase-first-letter', { chunks: [OW_B64(`F${OW_PREFIX.slice(1)}${tailText}`)] });
  add('double-space', { chunks: [OW_B64(OW_PREFIX.replace('detected dubious', 'detected  dubious') + tailText)] });
  add('localized-german', { chunks: [OW_B64(`schwerwiegend: versteckter Besitz im Repository bei ${tailText}`)] });
  add('warning-line-first', { chunks: [OW_B64(`warning: something happened\n${OW_PREFIX}${tailText}`)] });
  add('leading-newline', { chunks: [OW_B64(`\n${OW_PREFIX}${tailText}`)] });
  add('leading-space', { chunks: [OW_B64(` ${OW_PREFIX}${tailText}`)] });
  add('leading-nul', { chunks: [OW_B64(`\u0000${OW_PREFIX}${tailText}`)] });
  add('leading-bom', { chunks: [OW_B64(`\u00ef\u00bb\u00bf${OW_PREFIX}${tailText}`)] });
  add('prefix-after-one-mib', { suffix: { chunkBytes: 1048576, count: 1 }, chunks: [], after: OW_B64(OW_PREFIX + tailText) });
  for (const status of [0, 1, 2, 127, 129, 255]) add(`status-${status}`, { status, chunks: [OW_B64(OW_PREFIX + tailText)], ...(status === 0 ? { stdout: OW_B64('/probe/repo\n') } : {}) });
  add('status-128-with-stdout', { chunks: [OW_B64(OW_PREFIX + tailText)], stdout: OW_B64('/probe/repo\n') });
  add('status-128-with-one-byte-stdout', { chunks: [OW_B64(OW_PREFIX + tailText)], stdout: OW_B64('x') });
  add('signal-with-prefix', { signal: 'SIGKILL', chunks: [OW_B64(OW_PREFIX + tailText)] });
  add('spawn-error-event', { spawnError: 'ENOENT' });
  add('spawn-throws', { throwOnSpawn: true });
  add('long-suffix-64-mib', { chunks: [OW_B64(OW_PREFIX + tailText)], suffix: { chunkBytes: 1048576, count: 64 } });
  add('long-suffix-after-split-prefix', { chunks: [OW_B64(OW_PREFIX.slice(0, 20)), OW_B64(OW_PREFIX.slice(20))], suffix: { chunkBytes: 1048576, count: 16 } });
  add('environment', { chunks: [OW_B64(OW_PREFIX + tailText)], env: { LC_ALL: 'xx_YY', GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: '*', GIT_CONFIG_KEY_1: 'safe.directory', GIT_CONFIG_VALUE_1: '/probe/repo', git_config_parameters: "'safe.directory'='*'", GIT_CONFIG: '/x', GIT_DIR: '/y' } });
  add('no-locale-in-environment', { chunks: [OW_B64(OW_PREFIX + tailText)] });
  return out;
}
// "prefix-after-one-mib" is a stderr whose first MiB is filler and whose prefix comes later: filler chunk first, then the prefix (the probe writes `after` is not used; the filler is the first chunk).
function owNormalizeScenarios(list) {
  return list.map((s) => (s.id === 'prefix-after-one-mib' ? { id: s.id, status: 128, chunks: [OW_B64('A'.repeat(1048576)), s.after] } : s));
}
function owRunProbe(context, dir, coreUrl, scenarios) {
  const probe = path.join(dir, 'ownership-probe.mjs');
  const file = path.join(dir, 'ownership-scenarios.json');
  const start = path.join(dir, 'start');
  fs.mkdirSync(start, { recursive: true });
  putFile(probe, OW_PROBE_SOURCE);
  putFile(file, JSON.stringify(scenarios));
  countProcess(context);
  const r = spawnSync(process.execPath, [probe, coreUrl, file, start], { cwd: dir, env: { ...context.env, GIT_TERMINAL_PROMPT: '0' }, encoding: 'utf8', shell: false, windowsHide: true, timeout: 120000, maxBuffer: 1 << 28 });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout); } catch { parsed = null; }
  return { code: r.status, signal: r.signal, error: r.error ? String(r.error.message).slice(0, 120) : null, stderr: String(r.stderr || '').slice(0, 400), results: parsed, start };
}
// A fake executor for the stages after a root, to show that the flag acts nowhere else: a tree, a grep and its probe, in the order the core issues them.
function owGrepFake(context, { contentResult, probeResult, probeThrows = false, resolveResult = null }) {
  const base = path.resolve(context.tmp, 'c17-own-seam');
  const root = path.join(base, 'repo');
  const calls = [];
  let greps = 0;
  const treeOid = 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391';
  const execute = async (req) => {
    const op = req.argv.slice(HD_PREFIX.length);
    calls.push(op[0]);
    if (op[0] === '--version') return hdOk('git version 2.53.0.windows.2\r\n');
    if (op[0] === 'rev-parse' && op[1] === '--show-toplevel') return hdOk(`${root.replace(/\\/g, '/')}\n`);
    if (op[0] === 'rev-parse' && op[1] === '--verify') return resolveResult || hdOk(`${HD_ID1}\n`);
    if (op[0] === 'ls-tree') return hdOk(`100644 blob ${treeOid}\ta.txt\u0000`);
    if (op[0] === 'grep') { greps++; if (greps === 1) return contentResult; if (probeThrows) throw new Error('probe failed'); return probeResult; }
    return { status: 127, signal: null, error: null, stdout: Buffer.alloc(0), overflow: false };
  };
  return { execute, calls, start: path.join(base, 'start') };
}
async function ownershipGroup(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const coreRel = 'assets/tools/git-safe-core.mjs';
    const core = await importOrFail(failures, pathToFileURL(skillPath(context, coreRel)).href, coreRel);
    if (!core) return;
    const EMPTYB = Buffer.alloc(0);
    await step('F13 probe, classification: a child process replaces child_process.spawn, calls module.syncBuiltinESMExports() and then imports the real core, whose real executor runs over synthetic stderr chunks; the instrumented spawn is called (two calls per root failure, three for a success); only the exact English prefix at stderr byte zero with status 128 and empty stdout gives GIT_SAFE_OWNERSHIP (every split point, byte-by-byte delivery, a prefix equal to stderr), every mismatch position, near miss, leading byte or line, other status, nonempty stdout, signal and spawn failure keeps its existing result', async () => {
      await withScratch(context, 'probe', async (dir) => {
        const scenarios = owNormalizeScenarios(owScenarios());
        const pr = owRunProbe(context, dir, pathToFileURL(skillPath(context, coreRel)).href, scenarios);
        check(pr.code === 0 && pr.signal === null && pr.error === null && Array.isArray(pr.results), 'the probe ran to completion and printed its results', { code: pr.code, signal: pr.signal, error: pr.error, err: pr.stderr });
        if (!Array.isArray(pr.results)) return;
        check(pr.results.length === scenarios.length && eq(pr.results.map((x) => x.id), scenarios.map((x) => x.id)), 'the probe reports every scenario in order', { got: pr.results.length, want: scenarios.length });
        const by = new Map(pr.results.map((x) => [x.id, x]));
        const L = OW_PREFIX.length;
        const isOwn = (x) => x.exitCode === 2 && x.stdoutHex === '' && x.stderr === OW_LINE;
        const isRepo = (x) => x.exitCode === 2 && x.stdoutHex === '' && x.stderr === OW_REPO_LINE;
        const isGit = (x) => x.exitCode === 2 && x.stdoutHex === '' && x.stderr === OW_GIT_LINE;
        check(pr.results.every((x) => x.spawnCount >= 2 && x.commands.every((c) => c === 'git')), 'the instrumented spawn was called in every scenario (at least the version and the root call, always the command git)', pr.results.filter((x) => x.spawnCount < 2).map((x) => x.id));
        const ctl = by.get('control-success');
        check(ctl && ctl.exitCode === 0 && ctl.stdoutHex === Buffer.from(`${HD_ID1}\n`).toString('hex') && ctl.spawnCount === 3 && ctl.stderr === '', 'control: a successful root lookup continues to the one resolution and prints the ID (three spawn calls)', ctl);
        const positives = ['exact-one-chunk', 'prefix-only', 'prefix-then-newline', 'byte-by-byte', 'empty-chunks-between', 'long-suffix-64-mib', 'long-suffix-after-split-prefix', 'environment', 'no-locale-in-environment', ...Array.from({ length: L - 1 }, (_, i) => `split-${i + 1}`), ...pr.results.filter((x) => x.id.startsWith('split3-')).map((x) => x.id)];
        for (const id of positives) { const x = by.get(id); check(x !== undefined && isOwn(x) && x.spawnCount === 2, `${id}: GIT_SAFE_OWNERSHIP, exit 2, empty stdout, exactly the fixed line, and no retry (two spawn calls)`, x && { exit: x.exitCode, err: x.stderr.slice(0, 120), spawns: x.spawnCount }); }
        for (let i = 0; i < L; i++) for (const id of [`mismatch-${i}`, `mismatch-split-${i}`]) { const x = by.get(id); check(x !== undefined && isRepo(x) && x.spawnCount === 2, `${id}: a mismatch at prefix position ${i} keeps GIT_SAFE_REPOSITORY`, x && { exit: x.exitCode, err: x.stderr.slice(0, 120) }); }
        for (const id of ['missing-final-space-then-quote', 'ends-before-the-prefix-completes', 'ends-after-one-byte', 'empty-stderr', 'uppercase-first-letter', 'double-space', 'localized-german', 'warning-line-first', 'leading-newline', 'leading-space', 'leading-nul', 'leading-bom', 'prefix-after-one-mib', 'status-1', 'status-2', 'status-127', 'status-129', 'status-255', 'status-128-with-stdout', 'status-128-with-one-byte-stdout']) {
          const x = by.get(id);
          check(x !== undefined && isRepo(x) && x.spawnCount === 2, `${id}: keeps GIT_SAFE_REPOSITORY (never the ownership code)`, x && { exit: x.exitCode, err: x.stderr.slice(0, 120), spawns: x.spawnCount });
        }
        const s0 = by.get('status-0');
        check(s0 && s0.exitCode === 0 && s0.stdoutHex === Buffer.from(`${HD_ID1}\n`).toString('hex') && !s0.stderr.includes('GIT_SAFE_OWNERSHIP'), 'status 0 with the prefix on stderr is a normal success: the prefix alone never diagnoses ownership', s0 && { exit: s0.exitCode, err: s0.stderr.slice(0, 100) });
        for (const id of ['signal-with-prefix', 'spawn-error-event', 'spawn-throws']) { const x = by.get(id); check(x !== undefined && isGit(x), `${id}: the existing GIT_SAFE_GIT mapping (never ownership, never a retry)`, x && { exit: x.exitCode, err: x.stderr.slice(0, 120), spawns: x.spawnCount }); }
        // no disclosure: neither a marker path nor a payload marker (nor the Git text) is in any returned stream
        check(pr.results.every((x) => !x.stderr.includes('secret-marker') && !x.stderr.includes('PAYLOAD-MARKER') && !x.stderr.includes('fatal:') && !x.stderr.includes('detected dubious') && !x.stderr.includes('warning:')), 'no marker path, payload marker or Git text appears in any result', pr.results.filter((x) => /marker|fatal:|warning:/.test(x.stderr)).map((x) => x.id));
        check(pr.results.every((x) => x.stdoutHex === '' || x.id === 'control-success' || x.id === 'status-0'), 'every failing scenario emits empty stdout');
        // the executor does not change locale, argv, the fixed prefix or the sanitized environment
        for (const x of pr.results) {
          if (x.spawnCount < 2) continue;
          check(x.prefixes.every((p) => eq(p, HD_PREFIX)) && eq(x.vectors[0], ['--version']) && eq(x.vectors[1], ['rev-parse', '--show-toplevel']) && x.vectors.every((v) => !v.includes('--no-optional-locks') && !v.some((a) => /locale|LC_ALL|safe\.directory/.test(a))), `${x.id}: the fixed prefix and the version and root vectors are unchanged and no locale or safe.directory argument is added`, x.vectors);
          check(x.shells.every((s) => s === false) && x.stdios.every((s) => eq(s, ['ignore', 'pipe', 'pipe'])) && x.cwds[0] === x.cwds[1], `${x.id}: no shell, closed stdin, piped output`);
        }
        const env = by.get('environment');
        const lowerKeys = (e) => Object.keys(e).map((k) => k.toLowerCase());
        check(env && env.envs.every((e) => e.LC_ALL === 'xx_YY' && !lowerKeys(e).some((k) => /^git_config_(count|parameters|key_|value_)/.test(k)) && !lowerKeys(e).includes('git_config') && !lowerKeys(e).includes('git_dir') && e.GIT_CONFIG_GLOBAL === '/probe/global.gitconfig' && e.GIT_CONFIG_NOSYSTEM === '1' && e.GIT_TERMINAL_PROMPT === '0' && e.GIT_PAGER === 'cat'), 'the environment is the sanitized input: the given locale is kept untouched, every injected configuration entry is removed, the global source and NOSYSTEM stay', env && env.envs.map((e) => Object.keys(e).filter((k) => /GIT_CONFIG|LC_|git_config/i.test(k))));
        const noLoc = by.get('no-locale-in-environment');
        check(noLoc && noLoc.envs.every((e) => !('LC_ALL' in e) && !('LANG' in e) && !('LANGUAGE' in e)), 'no locale variable is added when none was given (the classifier does not change locale)', noLoc && noLoc.envs.map((e) => Object.keys(e).filter((k) => /^L/.test(k))));
      });
    });
    await step('the classifier is private and bounded in what it keeps: the core adds no export for it, its source names the prefix once, the executor result object carries the flag as a boolean only, and a production result is never inconsistent (the flag is set only when status 128, empty stdout, null signal and error and no overflow all hold)', async () => {
      check(eq(Object.keys(core).sort(), [...HD_CORE_EXPORTS].sort()), 'no export was added for the classifier', Object.keys(core).sort());
      const src = readText(skillPath(context, coreRel)) || '';
      check(COUNT(src, OW_PREFIX) === 1 && COUNT(src, 'dubiousOwnership') >= 3, 'the prefix literal appears once in the core and the flag name is used by the executor, the validator and the root stage', { prefix: COUNT(src, OW_PREFIX), flag: COUNT(src, 'dubiousOwnership') });
    });
    await step('seam: the optional flag as the root stage consumes it (the five-key result and a sixth false are no diagnosis; true with status 128, empty stdout, null signal, null error and overflow false is exactly GIT_SAFE_OWNERSHIP; every non-boolean, unknown-key or inconsistent positive result is GIT_SAFE_GIT) and the flag acts nowhere else: version, resolution and the grep empty-tree probe keep their mappings', async () => {
      const root = (res) => ({ handle: (k) => (k === 'root' ? { __raw: res } : undefined) });
      const cases = [
        ['five keys, status 128', hdOk('', 128), HD_MSG.REPOSITORY], ['sixth key false', hdOk('', 128, { dubiousOwnership: false }), HD_MSG.REPOSITORY], ['sixth key true', hdOk('', 128, { dubiousOwnership: true }), HD_MSG.OWNERSHIP],
        ['false with a nonempty stdout', hdOk('x', 128, { dubiousOwnership: false }), HD_MSG.REPOSITORY], ['true with status 1', hdOk('', 1, { dubiousOwnership: true }), HD_MSG.GIT], ['true with status 0', hdOk('', 0, { dubiousOwnership: true }), HD_MSG.GIT],
        ['true with status 255', hdOk('', 255, { dubiousOwnership: true }), HD_MSG.GIT], ['true with stdout', hdOk('x', 128, { dubiousOwnership: true }), HD_MSG.GIT], ['true with a signal', { status: null, signal: 'SIGKILL', error: null, stdout: EMPTYB, overflow: false, dubiousOwnership: true }, HD_MSG.GIT],
        ['true with an error', { status: null, signal: null, error: 'ENOENT', stdout: EMPTYB, overflow: false, dubiousOwnership: true }, HD_MSG.GIT], ['true with overflow', { status: null, signal: null, error: null, stdout: EMPTYB, overflow: true, dubiousOwnership: true }, HD_MSG.GIT],
        ['the string "true"', hdOk('', 128, { dubiousOwnership: 'true' }), HD_MSG.GIT], ['the number 1', hdOk('', 128, { dubiousOwnership: 1 }), HD_MSG.GIT], ['null', hdOk('', 128, { dubiousOwnership: null }), HD_MSG.GIT], ['an unknown key', hdOk('', 128, { dubiousOwnership: true, stderr: 'x' }), HD_MSG.GIT],
        ['a misspelled flag', hdOk('', 128, { dubiousownership: true }), HD_MSG.GIT],
      ];
      for (const [label, res, message] of cases) {
        const s = await hdMain(core, context, ['head'], { world: root(res) });
        hdExpect(check, `root result: ${label}`, s.r, hdFail(message));
        check(s.fake.calls.length === 2 && s.reads.length === 0 && !s.r.stderr.includes('x\n'), `root result: ${label}: two calls, no policy read, nothing disclosed`, s.fake.kinds());
      }
      const positive = hdOk('', 128, { dubiousOwnership: true });
      const v = await hdMain(core, context, ['head'], { world: { handle: (k) => (k === 'version' ? { __raw: positive } : undefined) } });
      hdExpect(check, 'a positive flag at the version stage', v.r, hdFail(HD_MSG.GIT));
      const rs = await hdMain(core, context, ['head'], { world: { handle: (k) => (k === 'resolve' ? { __raw: positive } : undefined) } });
      hdExpect(check, 'a positive flag at the resolution stage', rs.r, hdFail(HD_MSG.REVISION));
      // C16's grep empty-tree probe: the same trigger (status 128, empty stdout), the same classification table, whatever the flag says
      const PATTERN = 'GIT_SAFE_PATTERN: grep pattern is not a valid extended regular expression (ERE); no result was emitted';
      const run = async (o) => {
        const fake = owGrepFake(context, o);
        const r = await core.main(['grep', 'HEAD', 'transfer('], { cwd: fake.start, env: HD_ENV, execute: fake.execute, readFile: async () => HD_POLICY });
        return { r, fake };
      };
      for (const [label, o, want] of [
        ['content 128 and probe 128, both flagged', { contentResult: hdOk('', 128, { dubiousOwnership: true }), probeResult: hdOk('', 128, { dubiousOwnership: true }) }, PATTERN],
        ['content 128 and probe 128, neither flagged', { contentResult: hdOk('', 128), probeResult: hdOk('', 128) }, PATTERN],
        ['content flagged, probe not', { contentResult: hdOk('', 128, { dubiousOwnership: true }), probeResult: hdOk('', 128, { dubiousOwnership: false }) }, PATTERN],
        ['the probe flagged only', { contentResult: hdOk('', 128), probeResult: hdOk('', 128, { dubiousOwnership: true }) }, PATTERN],
        ['content flagged, probe status 1', { contentResult: hdOk('', 128, { dubiousOwnership: true }), probeResult: hdOk('', 1) }, HD_MSG.GIT],
        ['content flagged, probe status 0', { contentResult: hdOk('', 128, { dubiousOwnership: true }), probeResult: hdOk('', 0) }, HD_MSG.GIT],
        ['content flagged, probe stdout nonempty', { contentResult: hdOk('', 128, { dubiousOwnership: true }), probeResult: hdOk('x', 128) }, HD_MSG.GIT],
        ['content flagged, the probe throws', { contentResult: hdOk('', 128, { dubiousOwnership: true }), probeResult: null, probeThrows: true }, HD_MSG.GIT],
      ]) {
        const g = await run(o);
        hdExpect(check, `grep probe: ${label}`, g.r, hdFail(want));
        check(!g.r.stderr.includes('OWNERSHIP'), `grep probe: ${label}: never the ownership code`);
      }
    });
    await step('sanitizeGitEnvironment is unchanged: its source block (the removal and numbered-key tables, the fixed settings and the function) is byte-identical to the pre-C17 core, the exact removal list still strips injected safe.directory entries (the right path, another path, the wildcard, another key) in any letter case, and the user\'s global, system and NOSYSTEM sources stay', async () => {
      const fx = loadFixture(context);
      const pre = preText(fx, coreRel);
      const cur = readText(skillPath(context, coreRel)) || '';
      const envBlock = (t) => between(t, '// ----------------------------------------------------------- environment ----\n', '// ---------------------------------------------------------------- grammar ----\n');
      check(pre !== null && envBlock(pre) !== null && envBlock(pre).includes('export function sanitizeGitEnvironment(input)') && envBlock(cur) === envBlock(pre), 'the environment section of the core (tables and sanitizeGitEnvironment) is byte-identical to the pre-C17 core', { pre: pre && envBlock(pre) && envBlock(pre).length, cur: envBlock(cur) && envBlock(cur).length });
      const input = {
        PATH: '/p', HOME: '/h', GIT_CONFIG_GLOBAL: '/g.cfg', GIT_CONFIG_SYSTEM: '/s.cfg', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: '/repo', GIT_CONFIG_KEY_1: 'core.fsmonitor', GIT_CONFIG_VALUE_1: 'x',
        git_config_key_12: 'safe.directory', GIT_Config_Value_12: '*', GIT_CONFIG_PARAMETERS: "'safe.directory'='*'", git_config: '/c', GIT_CONFIG_KEY_X: 'kept', GIT_CONFIG_VALUE_: 'kept', GIT_CONFIG_KEYS_0: 'kept', LC_ALL: 'C', FOO: 'bar',
      };
      const out = core.sanitizeGitEnvironment(input);
      const keys = Object.keys(out).sort();
      check(!keys.some((k) => /^git_config_(count|parameters|key_[0-9]+|value_[0-9]+)$/i.test(k)) && !keys.some((k) => k.toLowerCase() === 'git_config'), 'every injected configuration name is stripped, case-insensitively', keys);
      check(out.GIT_CONFIG_GLOBAL === '/g.cfg' && out.GIT_CONFIG_SYSTEM === '/s.cfg' && out.GIT_CONFIG_NOSYSTEM === '1' && out.LC_ALL === 'C' && out.FOO === 'bar' && out.GIT_CONFIG_KEY_X === 'kept' && out.GIT_CONFIG_VALUE_ === 'kept' && out.GIT_CONFIG_KEYS_0 === 'kept', 'the global, system and NOSYSTEM sources, the locale and lookalike names are kept');
      check(out.GIT_PAGER === 'cat' && out.PAGER === 'cat' && out.GIT_TERMINAL_PROMPT === '0' && out.GIT_OPTIONAL_LOCKS === '0' && out.GIT_NO_REPLACE_OBJECTS === '1' && Object.isFrozen(out) === false && input.GIT_CONFIG_COUNT === '2', 'the five fixed settings apply and the input object is never mutated');
    });
    await step('real Git, the production executor (C17-F3: LC_ALL=C, GIT_TEST_ASSUME_DIFFERENT_OWNER=1, GIT_CONFIG_NOSYSTEM=1, a fixture-owned global config, the recorded Git version): no grant gives exactly GIT_SAFE_OWNERSHIP with no path or Git text; the wildcard grants; an exact path written with git config --file (the string git rev-parse --show-toplevel prints without the ownership variable) grants; a wrong path grants nothing; an exact entry beside the wildcard does not narrow it; environment-injected safe.directory entries (the right path, another path, the wildcard, another key) grant nothing although Git itself honors them; a non-repository keeps the generic error', async () => {
      const gv = gitIn(context, context.tmp, ['--version'], { env: { ...context.env, LC_ALL: 'C' } });
      check(gv.code === 0 && /^git version \d+\.\d+/.test(gv.stdout), `the Git version is recorded: ${gv.stdout}`, gv.stdout);
      diag(context, `R76/C17/ownership real-Git controls ran with ${gv.stdout} (LC_ALL=C, GIT_TEST_ASSUME_DIFFERENT_OWNER=1)`);
      await withScratch(context, 'own', async (dir) => {
        const one = hdRepo(context, path.join(dir, 'one'), { commits: 1 });
        const two = hdRepo(context, path.join(dir, 'two'), { commits: 1 });
        const cfg = (name, text = '') => { const p = path.join(dir, `${name}.gitconfig`); putFile(p, text); return p; };
        const empty = cfg('empty');
        const wildcard = cfg('wildcard', '[safe]\n\tdirectory = *\n');
        const topOf = (repo) => gitIn(context, repo, ['rev-parse', '--show-toplevel'], { env: { ...context.env, LC_ALL: 'C' } }).stdout;
        const top1 = topOf(one.dir);
        check(top1.length > 0 && !top1.includes('\\'), 'premise: git prints the checkout top level (forward slashes, never a temp path with a short name)', top1);
        const addTo = (file, p) => gitIn(context, dir, ['config', '--file', file, '--add', 'safe.directory', p], { env: { ...context.env, LC_ALL: 'C' } });
        const exact = cfg('exact'); const wrong = cfg('wrong'); const both = cfg('both', '[safe]\n\tdirectory = *\n');
        check(addTo(exact, top1).code === 0 && addTo(wrong, `${top1}-elsewhere`).code === 0 && addTo(both, top1).code === 0, 'premise: the fixture-owned entries are written with git config --file');
        const baseEnv = { ...context.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TEST_ASSUME_DIFFERENT_OWNER: '1', LC_ALL: 'C' };
        const head = async (repo, cfgFile, extra = {}, cwd = repo.dir) => hdCountChildren(context, await core.main(['head'], { cwd, env: { ...baseEnv, GIT_CONFIG_GLOBAL: cfgFile, ...extra } }));
        const noLeak = (label, r) => check(!r.stderr.includes(one.dir) && !r.stderr.includes(top1) && !r.stderr.includes(two.dir) && !/fatal:|dubious ownership in repository|safe\.directory'?\s*=/.test(r.stderr) && r.stdout.length === 0, `${label}: no repository path, no Git text and no stdout in the diagnostic`, r.stderr.slice(0, 200));
        const none = await head(one, empty);
        hdExpect(check, 'no grant', none, { exit: 2, stdout: EMPTYB, stderr: OW_LINE });
        noLeak('no grant', none);
        const wild = await head(one, wildcard);
        hdExpect(check, 'the wildcard grant', wild, { exit: 0, stdout: `${one.ids[0]}\n` });
        const ex = await head(one, exact);
        hdExpect(check, 'an exact-path grant (the string Git prints)', ex, { exit: 0, stdout: `${one.ids[0]}\n` });
        const wr = await head(one, wrong);
        hdExpect(check, 'a wrong-path grant', wr, { exit: 2, stdout: EMPTYB, stderr: OW_LINE });
        noLeak('a wrong-path grant', wr);
        const otherRepo = await head(two, exact);
        hdExpect(check, 'an exact grant for another checkout', otherRepo, { exit: 2, stdout: EMPTYB, stderr: OW_LINE });
        const beside = await head(two, both);
        hdExpect(check, 'an exact entry beside the wildcard does not narrow it: another checkout is still granted', beside, { exit: 0, stdout: `${two.ids[0]}\n` });
        const injected = [
          ['the right path', { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: top1 }], ['another path', { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: `${top1}-elsewhere` }],
          ['the wildcard', { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: '*' }], ['another key', { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.fsmonitor', GIT_CONFIG_VALUE_0: 'false' }],
          ['the right path as the second entry', { GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'core.fsmonitor', GIT_CONFIG_VALUE_0: 'false', GIT_CONFIG_KEY_1: 'safe.directory', GIT_CONFIG_VALUE_1: top1 }],
          ['GIT_CONFIG_PARAMETERS', { GIT_CONFIG_PARAMETERS: `'safe.directory'='${top1}'` }],
        ];
        for (const [label, extra] of injected) {
          if (label === 'the right path' || label === 'the wildcard') {
            const g = gitIn(context, one.dir, ['rev-parse', '--show-toplevel'], { env: { ...baseEnv, GIT_CONFIG_GLOBAL: empty, ...extra } });
            check(g.code === 0, `control: Git itself honors the injected entry (${label}), so stripping it matters`, { code: g.code, err: g.stderr.slice(0, 120) });
          }
          const r = await head(one, empty, extra);
          hdExpect(check, `injected configuration (${label})`, r, { exit: 2, stdout: EMPTYB, stderr: OW_LINE });
          noLeak(`injected configuration (${label})`, r);
        }
        const mixed = await head(one, exact, { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: `${top1}-elsewhere` });
        hdExpect(check, 'a file-configured exact grant beside an injected entry for another path', mixed, { exit: 0, stdout: `${one.ids[0]}\n` });
        const plain = path.join(dir, 'plain');
        fs.mkdirSync(plain, { recursive: true });
        const gen = hdCountChildren(context, await core.main(['head'], { cwd: plain, env: { ...baseEnv, GIT_CONFIG_GLOBAL: empty, GIT_CEILING_DIRECTORIES: dir } }));
        hdExpect(check, 'a directory that is no repository (the generic root error is unchanged)', gen, hdFail(HD_MSG.REPOSITORY));
        // the same through the installed CLI and for a content command: the code is a root-stage result for every consumer
        const tools = path.join(one.dir, '.ai', 'tools');
        for (const f of ['security-policy.mjs', 'git-safe-core.mjs', 'git-safe.mjs']) putFile(path.join(tools, f), readBytes(skillPath(context, `assets/tools/${f}`)) || Buffer.alloc(0));
        const cli = execNode(context, { cwd: one.dir, script: path.join(tools, 'git-safe.mjs'), args: ['ls', 'HEAD'], env: { ...baseEnv, GIT_CONFIG_GLOBAL: empty } });
        check(cli.dead === null && cli.code === 2 && cli.stdout === '' && cli.stderr === OW_LINE, 'the installed CLI prints exactly the fixed line for a content command too (exit 2, empty stdout)', { code: cli.code, err: cli.stderr.slice(0, 160) });
      });
    });
    flushProcessCount(context, 'R76/C17/ownership', mark);
  });
}

// ============================================ R90/C17/instructions ====
// Plan C17-8 (R17 and the security-reference amendments SE1-SE4 with the F9 sentence), C17-14 row "instructions", C17-20 and F12: the canonical
// reviewer resolves checkout HEAD through the argument-free helper form (never raw Git, so a parent brief saying "never raw git" needs no exception),
// compares full resolved IDs with the resolved review head from review-diff, and stops and reports when identity cannot be established, never omitting
// the comparison. Everything else in the reviewer is unchanged: the equal-head warning and its condition (section 5), the hard rules, the bounded
// correction (exactly GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN, two rounds) and the no-fallback text. docs-sync, all four wrappers and the root and nested
// templates stay byte for byte. The security reference documents the head form, the identity rule and the ownership diagnostic as frozen text.
// Instruction text cannot be executed: each rule below is a frozen paragraph or phrase, every sentence of it is removed and weakened in memory and the rule
// must then fail, named guards are replaced by their opposites, and the battery runs on an independent model (the pinned pre-C17 bytes plus the frozen
// amendments applied by the helper) and on the installed text. Nothing here proves that an agent follows the instructions.
const I17_REVIEWER_REL = 'assets/agents/reviewer.md';
const I17_DOCS_REL = 'assets/agents/docs-sync.md';
const I17_SECURITY_REL = 'references/security.md';
const I17_CODEX_WRAPPERS = ['assets/wrappers/codex-reviewer.toml', 'assets/wrappers/codex-docs_sync.toml'];
const I17_CLAUDE_WRAPPERS = ['assets/wrappers/claude-reviewer.md', 'assets/wrappers/claude-docs-sync.md'];
// Plan C17-4 (byte-identical files) and F8: raw SHA-256 values computed independently from `git show eac5b07:<path>` of each file.
const I17_UNCHANGED_PINS = [
  ['assets/agents/docs-sync.md', '605398911043231f4ec53358986988ccbe8d5648beb0e918ee955d8104fff814'],
  ['assets/wrappers/claude-docs-sync.md', '36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43'],
  ['assets/wrappers/claude-reviewer.md', '284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423'],
  ['assets/wrappers/codex-docs_sync.toml', '1e6eef9ae6d75c0fef3c79b9879a0d69c4ad88d774889b81d09558cd61af6287'],
  ['assets/wrappers/codex-reviewer.toml', 'fe21c05b09bcba96b631bb08e22e6be807cdc8e0c75a740acff1b70c683c695c'],
  ['assets/templates/AGENTS.md', '616a26a54d2e8f77b0d4df3e78055ca41f6e7638654ad70a0f4d28a0e4eb5a0e'],
  ['assets/templates/CLAUDE.md', '5bb1d5ed697e921dcc839d031e082f884ca9a97a1eafd8d4a003d2ddb1cbaa47'],
  ['assets/templates/nested-AGENTS.md', '11cd44a06e9e50023e8ddcb5e8d476e2338b206c2973e6d4ef6f53997b1ed370'],
  ['assets/templates/nested-CLAUDE.md', '336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49'],
  ['references/docs-generation.md', 'cabdf9cd7df65ee9d7660abc4cf9b95eb0e3f9c1386ea069ec87d55322616503'],
];
const I17_HEADING1 = '## 1. Establish scope before reading code';
const I17_HEADING4 = '## 4. Hard rules';
const I17_HEADING5 = '## 5. Output';
const I17_RR_HEADING = '### Correcting rejected git-safe arguments';
const I17_BOUNDED_HEADING = '### Bounded reads';
const I17_SEC2_HEADING = '## 2. Diffs, history and committed files';
const I17_STEP_START = '\n2. Resolve the checkout';
const I17_STEP_END = '\n3. If the requested refs are unavailable';
const I17_HARD_START = '- Read repository content only with the local file tools';
const I17_HARD_END = '- Do not retry a failed or denied read through another tool';
const I17_R17_SQ = squash(C17_BLOCKS.R17_NEW.join(' '));
// The five sentences of R17, each its own rule so that every one is proven to fail when removed or weakened.
const I17_STEP_PHRASES = [
  ['r17-s1', "Resolve the checkout's current HEAD with `node .ai/tools/git-safe.mjs head`."],
  ['r17-s2', 'This form takes no arguments and prints one full commit ID.'],
  ['r17-s3', 'You MUST compare that ID with the resolved review head from review-diff, not branch names or dirty state.'],
  ['r17-s4', 'If HEAD identity cannot be established, you MUST stop and report the failure; you MUST NOT omit the comparison or substitute raw Git.'],
  ['r17-s5', 'This prevents a completed review with an unevaluated instruction-trust warning.'],
];
const I17_STEP_RULES = [{ id: 'r17#1', where: 'sec1', text: I17_R17_SQ }, ...I17_STEP_PHRASES.map(([id, text]) => ({ id, where: 'sec1', text }))];
// Section 5 (plan C17-8: "Keep section 5's warning text and conditional unchanged"): the equal-head warning, and only for equality.
const I17_WARN_PHRASES = [
  ['warn-header', 'Begin the report with the identity header copied from review-diff: `# review-diff mode=<mode> base=<B> head=<H> merge-base=<M>`.'],
  ['warn-equal', 'When the resolved head equals the checkout\'s resolved HEAD, put "instructions loaded from the branch under review: trusted only if you authored it" on the following line.'],
  ['warn-otherwise', 'Otherwise omit that warning.'],
];
const I17_WARN_RULES = I17_WARN_PHRASES.map(([id, text]) => ({ id, where: 's5', text }));
const i17Hard = (text) => { const t = LF(text); const i = t.indexOf(I17_HARD_START); const j = t.indexOf(I17_HARD_END, i); return i >= 0 && j > i ? t.slice(i, j) : ''; };
// The text a later reader must find unchanged, derived from the verified pre-C17 reviewer (the fixture entry is pinned by raw SHA-256 d3d56613...):
// the stop-rule bullet, every paragraph of the bounded correction subsection (the two-code whitelist, the stop list, the no-fallback text), the bounded
// reads and the first paragraph of section 5. `docs` leaves the reviewer-only paragraphs out (docs-sync shares the bullet and the subsection).
function i17PreservedRules(pre, { docs = false } = {}) {
  const rules = [{ id: 'hard#1', where: 'hard', text: squash(i17Hard(pre)) }];
  paras((sectionOf(pre, I17_RR_HEADING) || '').split('\n')).forEach((text, i) => rules.push({ id: `rr#${i + 1}`, where: 'rr', text }));
  if (!docs) {
    paras((sectionOf(pre, I17_BOUNDED_HEADING) || '').split('\n')).forEach((text, i) => rules.push({ id: `bounded#${i + 1}`, where: 'bounded', text }));
    rules.push({ id: 's5#1', where: 's5', text: paras((sectionOf(pre, I17_HEADING5) || '').split('\n'))[0] });
  }
  return rules;
}
function i17Scopes(t) {
  return {
    sec1: squash(sectionOf(t, I17_HEADING1) || ''),
    hard: squash(i17Hard(t)),
    rr: squash(sectionOf(t, I17_RR_HEADING) || ''),
    bounded: squash(sectionOf(t, I17_BOUNDED_HEADING) || ''),
    s5: squash(sectionOf(t, I17_HEADING5) || ''),
  };
}
const i17Step2 = (t) => { const i = t.indexOf(I17_STEP_START); const j = t.indexOf(I17_STEP_END, i); return i >= 0 && j > i ? t.slice(i + 1, j) : null; };
// The failing rule IDs of a reviewer text (empty when every rule holds). `pre` is the verified pre-C17 reviewer the preserved rules come from.
function i17EvalReviewer(raw, pre) {
  const t = LF(raw);
  const rules = [...I17_STEP_RULES, ...I17_WARN_RULES, ...i17PreservedRules(pre)];
  const f = failedRules(rules, i17Scopes(t));
  if (!amendmentOnce(t, AM17.R17)) f.push('r17-anchor');
  const s2 = i17Step2(t);
  if (s2 === null) f.push('r17-step2');
  else {
    const cmds = [...s2.matchAll(/`([^`]*)`/g)].map((m) => m[1]);
    if (!eq(cmds, ['node .ai/tools/git-safe.mjs head'])) f.push('r17-cmd');
    if (/(^|[^\w./-])git\s+[a-z]/.test(s2.replace(/`node \.ai\/tools\/git-safe\.mjs head`/g, ''))) f.push('r17-raw-git');
  }
  if (/\bgit rev-parse\b|rev-parse --verify HEAD/.test(t)) f.push('raw-head-present');
  if (t.includes('GIT_SAFE_OWNERSHIP')) f.push('ownership-named');
  const hs = headingsOf(t); const hp = headingsOf(pre);
  if (!eq(hs, hp)) f.push('headings');
  return f;
}
// docs-sync: nothing of C17 enters it. It keeps the stop bullet and the bounded correction (the same text as the reviewer) and names no raw HEAD step.
function i17EvalDocs(raw, pre) {
  const t = LF(raw);
  const f = failedRules(i17PreservedRules(pre, { docs: true }), i17Scopes(t));
  if (/rev-parse/.test(t)) f.push('raw-head-present');
  if (t.includes('GIT_SAFE_OWNERSHIP')) f.push('ownership-named');
  return f;
}
// Opposites: a substituted guard must fail the rule that holds the sentence.
const I17_STEP_OPPOSITES = [
  ['r17#1', "Resolve the checkout's current HEAD with `node .ai/tools/git-safe.mjs head`.", "Resolve the checkout's current HEAD with `git rev-parse --verify HEAD`.", 'the helper form, never raw Git'],
  ['r17#1', 'This form takes no arguments and prints one full commit ID.', 'This form takes a revision argument and prints an abbreviated commit ID.', 'argument-free, full ID'],
  ['r17#1', 'You MUST compare that ID with the resolved review head from review-diff, not branch names or dirty state.', 'You MUST compare branch names with the resolved review head from review-diff.', 'IDs, not names or dirty state'],
  ['r17#1', 'If HEAD identity cannot be established, you MUST stop and report the failure', 'If HEAD identity cannot be established, you MAY continue the review', 'a failed identity stops'],
  ['r17#1', 'you MUST NOT omit the comparison or substitute raw Git', 'you MAY omit the comparison or substitute raw Git', 'no omission, no raw Git'],
  ['r17#1', 'This prevents a completed review with an unevaluated instruction-trust warning.', 'This permits a completed review with an unevaluated instruction-trust warning.', 'the failure it prevents'],
  ['r17-s4', 'you MUST stop and report the failure', 'you MAY treat the heads as unequal', 'unknown identity is never unequal'],
  ['warn-equal', "When the resolved head equals the checkout's resolved HEAD, put", "When the resolved head differs from the checkout's resolved HEAD, put", 'the warning only for equality'],
  ['warn-equal', 'trusted only if you authored it', 'trusted without condition', 'the warning words'],
  ['warn-otherwise', 'Otherwise omit that warning.', 'Otherwise include that warning.', 'unequal heads omit the warning'],
];
const I17_PRESERVED_OPPOSITES = [
  ['rr#1', 'you MUST correct your invocation to the printed grammar and documented ERE syntax', 'you MAY give up instead of correcting your invocation', 'the correction stays mandatory'],
  ['rr#2', 'A correction MUST NOT add --out, redirect output, create an artifact or widen paths', 'A correction MAY add --out, redirect output, create an artifact or widen paths', 'no --out, no artifact, no wider paths'],
  ['rr#3', 'You MUST use at most two correction rounds', 'You MAY use any number of correction rounds', 'two rounds at most'],
  ['rr#4', 'Only GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN qualify.', 'Only GIT_SAFE_ARGUMENT, GIT_SAFE_PATTERN and GIT_SAFE_OWNERSHIP qualify.', 'OWNERSHIP never joins the whitelist'],
  ['rr#4', 'GIT_SAFE_INTERNAL, any other error, a denied read or a sandbox error.', 'GIT_SAFE_INTERNAL, a denied read or a sandbox error.', 'the "any other error" clause covers GIT_SAFE_OWNERSHIP'],
  ['rr#4', 'You MUST stop on GIT_SAFE_SECRET', 'You MAY retry on GIT_SAFE_SECRET', 'the stop list'],
  ['rr#5', 'You MUST NOT retry through raw Git, another helper, another tool, a connector, changed permissions or a changed sandbox.', 'You MAY retry through raw Git when the helper fails.', 'no fallback'],
  ['hard#1', 'except for the bounded GIT_SAFE_ARGUMENT/GIT_SAFE_PATTERN correction defined below', 'except for any correction you choose', 'the exception stays bounded to the two codes'],
  ['hard#1', 'Never use an MCP server, connector, browser or remote service to read repository files or history', 'You may use an MCP server to read repository files or history', 'no connector reads'],
];
// The scenario rows of C17-14 and C17-20: [scenario, the exact words that settle it, where].
const I17_SCENARIOS = [
  ['equal resolved IDs (attached or detached HEAD, dirty or clean tree, different branch names) compare as equal', 'You MUST compare that ID with the resolved review head from review-diff, not branch names or dirty state.', 'reviewer'],
  ['equal IDs put the existing warning', 'When the resolved head equals the checkout\'s resolved HEAD, put "instructions loaded from the branch under review: trusted only if you authored it" on the following line.', 'reviewer'],
  ['unequal IDs omit the warning', 'Otherwise omit that warning.', 'reviewer'],
  ['a detached HEAD resolves like an attached one; an unborn or unresolvable HEAD stops', 'It accepts attached or detached HEAD and stops on an unborn or unresolvable HEAD.', 'security'],
  ['a parent brief saying never raw git: the only HEAD command is the helper form', "Resolve the checkout's current HEAD with `node .ai/tools/git-safe.mjs head`.", 'reviewer'],
  ['no raw Git may stand in for a failed helper', 'you MUST NOT omit the comparison or substitute raw Git', 'reviewer'],
  ['unknown identity is a reported failure, never "unequal" and never an omitted comparison', 'If HEAD identity cannot be established, you MUST stop and report the failure; you MUST NOT omit the comparison or substitute raw Git.', 'reviewer'],
  ['an unborn HEAD (GIT_SAFE_REVISION), a malformed identity (GIT_SAFE_RECORD), an older core (GIT_SAFE_COMMAND), a denied read and a sandbox error all stop', 'You MUST stop on GIT_SAFE_SECRET, POLICY_*, GIT_SAFE_POLICY_IO, GIT_SAFE_REVISION, GIT_SAFE_RECORD, GIT_SAFE_LIMIT, GIT_SAFE_ARG_LIMIT, GIT_SAFE_GIT, GIT_SAFE_INPUT, GIT_SAFE_COMMAND, GIT_SAFE_VERSION, GIT_SAFE_REPOSITORY, GIT_SAFE_INTERNAL, any other error, a denied read or a sandbox error.', 'both'],
  ['GIT_SAFE_OWNERSHIP falls under "any other error" and is not a correction case', 'GIT_SAFE_OWNERSHIP is not an argument or pattern rejection.', 'security'],
  ['the two-code whitelist is unchanged', 'Only GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN qualify.', 'both'],
  ['no raw Git, helper, tool, connector, permission or sandbox fallback', 'You MUST NOT retry through raw Git, another helper, another tool, a connector, changed permissions or a changed sandbox.', 'both'],
  ['a failed HEAD step never ends in a completed review with an unevaluated warning', 'This prevents a completed review with an unevaluated instruction-trust warning.', 'reviewer'],
];
// The security-reference frozen text: the one-line change, the grammar fence, the head paragraphs and the ownership paragraphs (F9 sentence spliced into the second).
const I17_SE1_NEW = squash(C17_BLOCKS.SE1_NEW.join(' '));
const I17_SE1_OLD = squash(C17_BLOCKS.SE1_OLD.join(' '));
const I17_SE3_PARAS = paras(C17_BLOCKS.SE3);
const I17_SE4_PARAS = paras(C17_BLOCKS.SE4_PLAN).map((p) => p.replace('GIT_SAFE_REPOSITORY result. Neither', () => `GIT_SAFE_REPOSITORY result. ${squash(C17_LITERALS.F9B.join(' '))} Neither`));
const I17_WHITELIST_SENTENCE = 'The canonical agents permit bounded correction only for GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN. This includes review-diff parse-time argument errors, but a correction MUST NOT add --out or widen paths. Every other failure or denial still stops the task.';
const I17_SE_RULES = [
  { id: 'se1', where: 'sec2', text: I17_SE1_NEW },
  ...I17_SE3_PARAS.map((text, i) => ({ id: `se3#${i + 1}`, where: 'sec2', text })),
  ...I17_SE4_PARAS.map((text, i) => ({ id: `se4#${i + 1}`, where: 'sec2', text })),
  { id: 'se-whitelist', where: 'sec2', text: I17_WHITELIST_SENTENCE },
];
const I17_GRAMMAR = [
  'diff <A>..<B>|<A>...<B> [--stat|--name-status|--name-only] [-- <paths>]',
  'log [-p] [--oneline] [-n<k>|--max-count=<k>] <rev>|<A>..<B>|<A>...<B> [-- <paths>]',
  'show <commit> [--stat|--name-status] [-- <paths>]',
  'cat <commit> -- <path>',
  'ls <commit> [-- <paths>]',
  'grep <commit> <pattern> [-- <paths>]',
  'head',
  'review-diff --base <ref> [--head <ref>] [--out <file>] [-- <paths>...]',
];
const I17_SE_OPPOSITES = [
  ['se1', 'reader accepts these six object forms, the checkout-identity form and the review form:', 'reader accepts exactly these six object forms and the review form:', 'the head form is in the grammar'],
  ['se3#1', 'head takes no arguments', 'head takes an optional revision', 'argument-free'],
  ['se3#1', 'It accepts attached or detached HEAD and stops on an unborn or unresolvable HEAD.', 'It accepts only attached HEAD and continues on an unborn HEAD.', 'detached accepted, unborn stops'],
  ['se3#1', 'performs no tree inventory or file-content read', 'reads file content', 'identity only'],
  ['se3#2', 'Reviewers MUST obtain checkout HEAD through node .ai/tools/git-safe.mjs head and compare full resolved IDs.', 'Reviewers MAY obtain checkout HEAD through raw Git and compare abbreviated IDs.', 'helper form and full IDs'],
  ['se3#2', 'they MUST stop without omitting the comparison or using raw Git', 'they MAY omit the comparison or use raw Git', 'a failed identity stops'],
  ['se4#1', 'produces GIT_SAFE_OWNERSHIP when Git exits 128 with empty stdout', 'produces GIT_SAFE_OWNERSHIP when Git exits 0 with any stdout', 'status 128 and empty stdout'],
  ['se4#1', 'never the path or diagnostic text, and emits no repository content', 'including the path and the diagnostic text', 'content-free'],
  ['se4#2', 'Localized diagnostics, preceding warnings and other root failures keep the existing GIT_SAFE_REPOSITORY result.', 'Localized diagnostics, preceding warnings and other root failures produce GIT_SAFE_OWNERSHIP.', 'only the exact prefix is recognized'],
  ['se4#2', 'Older Git releases word this refusal differently or do not perform the check; their failures also keep GIT_SAFE_REPOSITORY.', 'Older Git releases produce GIT_SAFE_OWNERSHIP.', 'F9: older Git keeps the generic result'],
  ['se4#2', 'Neither result permits fallback access or an automatic configuration change.', 'Either result permits fallback access or an automatic configuration change.', 'no fallback, no automatic change'],
  ['se4#3', 'GIT_SAFE_OWNERSHIP is not an argument or pattern rejection.', 'GIT_SAFE_OWNERSHIP is an argument or pattern rejection.', 'not a correction case'],
  ['se4#3', 'Agents MUST stop on it to preserve the trust boundary', 'Agents MAY retry it', 'a stop condition'],
  ['se4#3', 'the bounded correction whitelist remains exactly GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN', 'the bounded correction whitelist gains GIT_SAFE_OWNERSHIP', 'the whitelist is unchanged'],
  ['se-whitelist', 'Every other failure or denial still stops the task.', 'Every other failure or denial may be retried.', 'the existing whitelist bullet'],
];
function i17FenceOf(t) {
  const sec = sectionOf(t, I17_SEC2_HEADING);
  if (sec === null) return null;
  const m = /```text\n([\s\S]*?)\n```/.exec(sec);
  return m === null ? null : m[1].split('\n');
}
function i17EvalSecurity(raw) {
  const t = LF(raw);
  const f = failedRules(I17_SE_RULES, { sec2: squash(sectionOf(t, I17_SEC2_HEADING) || '') });
  if (squash(t).includes(I17_SE1_OLD)) f.push('se1-old');
  if (!eq(i17FenceOf(t), I17_GRAMMAR)) f.push('se-grammar');
  // The four amendments are chained (SE3 sits between SE2's fence and its following bullet), so they are verified at their turn in the reversal.
  const r = reverseForFile(t, I17_SECURITY_REL);
  if (r.text === null) f.push(`${r.failed}-anchor`);
  // The helper's flex amendment cannot see a second copy elsewhere in the file; the paragraphs of C17-8 item 4 must stand exactly once.
  const flat = squash(t);
  if (COUNT(flat, I17_SE4_PARAS[0]) !== 1 || COUNT(flat, I17_SE4_PARAS[2]) !== 1) f.push('se4-duplicate');
  return f;
}
// ---------------------------------------------------------------------------------------------------------------------------------------------------
async function instructions(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const fx = loadFixture(context);
    const stats = { mutants: 0, controls: 0 };
    const preRev = preText(fx, I17_REVIEWER_REL);
    const preSec = preText(fx, I17_SECURITY_REL);
    const modelRev = modelOf(fx, I17_REVIEWER_REL);
    const modelSec = modelOf(fx, I17_SECURITY_REL);
    if (preRev === null || preSec === null || modelRev === null || modelSec === null) { check(false, 'the pre-C17 reviewer and security reference are in the fixture and take every C17 amendment exactly once at its anchor', { preRev: preRev !== null, preSec: preSec !== null, modelRev: modelRev !== null, modelSec: modelSec !== null }); return; }
    const docsInstalled = readText(skillPath(context, I17_DOCS_REL));
    const battery = (label, raw, rules, evaluate) => {
      const tried = proveRulesFail(check, label, raw, rules, evaluate);
      stats.mutants += tried;
      check(tried >= sentenceCount(rules), `${label}: the in-memory variants cover every sentence of the frozen text (removal and weakening)`, { tried, sentences: sentenceCount(rules) });
    };
    const opposites = (label, raw, pairs, evaluate, rules) => { proveOpposites(check, label, raw, pairs, evaluate, rules); stats.mutants += pairs.length; };

    const reviewerRules = [...I17_STEP_RULES, ...I17_WARN_RULES, ...i17PreservedRules(preRev)];
    await step('the independent models (the pinned pre-C17 reviewer and security reference plus the frozen amendments applied by the helper) satisfy every rule; every sentence of the R17 step, of the equal-head warning paragraph, of the stop-rule bullet, of the bounded correction subsection and of the bounded reads, and every sentence of the head and ownership paragraphs of the security reference, is a rule that fails when it is removed or weakened; each guard is replaced by its opposite', async () => {
      check(i17EvalReviewer(modelRev, preRev).length === 0, 'the reviewer model satisfies every rule', i17EvalReviewer(modelRev, preRev));
      check(i17EvalSecurity(modelSec).length === 0, 'the security reference model satisfies every rule', i17EvalSecurity(modelSec));
      check(docsInstalled !== null && i17EvalDocs(docsInstalled, preRev).length === 0, 'docs-sync satisfies its preserved rules (the stop bullet and the bounded correction it shares with the reviewer, no raw HEAD step)', docsInstalled === null ? 'unreadable' : i17EvalDocs(docsInstalled, preRev));
      battery('reviewer (model)', modelRev, reviewerRules, (x) => i17EvalReviewer(x, preRev));
      opposites('reviewer (model)', modelRev, [...I17_STEP_OPPOSITES, ...I17_PRESERVED_OPPOSITES], (x) => i17EvalReviewer(x, preRev), reviewerRules);
      battery('security reference (model)', modelSec, I17_SE_RULES, i17EvalSecurity);
      opposites('security reference (model)', modelSec, I17_SE_OPPOSITES, i17EvalSecurity, I17_SE_RULES);
      if (docsInstalled !== null) {
        const docsRules = i17PreservedRules(preRev, { docs: true });
        battery('docs-sync (preserved text)', docsInstalled, docsRules, (x) => i17EvalDocs(x, preRev));
        opposites('docs-sync (preserved text)', docsInstalled, I17_PRESERVED_OPPOSITES.filter(([id]) => /^(rr|hard)#/.test(id)), (x) => i17EvalDocs(x, preRev), docsRules);
      }
      // The old step and the unchanged-order controls: the raw command, the old text, an extra raw command and a moved or duplicated step are all rejected.
      const t = LF(modelRev);
      const old = reverseOne(t, AM17.R17);
      check(old !== null && i17EvalReviewer(old, preRev).includes('raw-head-present') && i17EvalReviewer(old, preRev).includes('r17-s1'), 'control: the pre-C17 step (git rev-parse --verify HEAD) is rejected: the raw HEAD command is present and the helper form is missing');
      check(i17EvalReviewer(t.replace('`node .ai/tools/git-safe.mjs head`', () => '`node .ai/tools/git-safe.mjs head` or `git rev-parse --verify HEAD`'), preRev).includes('r17-cmd'), 'control: the helper form with a raw Git alternative is rejected (the only command in step 2 is the helper form)');
      check(i17EvalReviewer(t.replace('`node .ai/tools/git-safe.mjs head`', () => '`node .ai/tools/git-safe.mjs head HEAD`'), preRev).includes('r17-s1'), 'control: a head form with an argument is rejected');
      check(i17EvalReviewer(`${t}\nIf the helper fails, run git rev-parse HEAD instead.\n`, preRev).includes('raw-head-present'), 'control: a raw HEAD fallback anywhere in the reviewer is rejected');
      check(i17EvalReviewer(t.replace('This prevents', () => 'See GIT_SAFE_OWNERSHIP. This prevents'), preRev).includes('ownership-named'), 'control: the reviewer naming GIT_SAFE_OWNERSHIP (a whitelist or stop-list extension) is rejected');
      check(i17EvalReviewer(t.replace(T(C17_BLOCKS.R17_NEW), () => ''), preRev).includes('r17#1'), 'control: a reviewer without the step is rejected');
      check(i17EvalReviewer(t.replace(T(C17_BLOCKS.R17_NEW), () => `${T(C17_BLOCKS.R17_NEW)}${T(C17_BLOCKS.R17_NEW)}`), preRev).includes('r17-anchor'), 'control: a duplicated step is rejected');
      check(i17EvalSecurity(LF(modelSec).replace('\nhead\nreview-diff --base', () => '\nreview-diff --base')).includes('se-grammar'), 'control: a grammar fence without the head line is rejected');
      check(i17EvalSecurity(LF(modelSec).replace('\nhead\nreview-diff --base', () => '\nreview-diff --base <ref> [--head <ref>] [--out <file>] [-- <paths>...]\nhead\nreview-diff --base')).includes('se-grammar'), 'control: a grammar fence with a misplaced head line is rejected');
      check(i17EvalSecurity(LF(modelSec).replace('\nhead\nreview-diff --base', () => '\nhead [<rev>]\nreview-diff --base')).includes('se-grammar'), 'control: a head line that takes an argument is rejected');
    });

    const installed = {};
    await step('every C17 amendment of the reviewer and the security reference stands exactly once at its anchor in the installed files and the reversal in reverse order gives the pre-C17 bytes (raw SHA-256 pinned by plan C17-12: reviewer d3d56613...); both keep the C17-5 byte convention', async () => {
      installed.reviewer = checkAmendedFile(check, context, fx, I17_REVIEWER_REL);
      installed.security = checkAmendedFile(check, context, fx, I17_SECURITY_REL);
    });
    if (!installed.reviewer || !installed.security) { check(false, 'the installed reviewer and security reference are readable'); return; }
    const rev = LF(installed.reviewer.text);
    const sec = LF(installed.security.text);
    await step('the installed reviewer states R17: the helper form with no arguments, the comparison of full resolved IDs with the review head (not names or dirty state), the stop-and-report rule that never omits the comparison or substitutes raw Git, the failure it prevents; no raw HEAD command is named anywhere in it; section 5 keeps the equal-head warning and its condition; the hard rules, the bounded correction (exactly GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN, two rounds) and the no-fallback text are byte-identical to the pre-C17 sections', async () => {
      const failed = i17EvalReviewer(rev, preRev);
      for (const r of reviewerRules) check(!failed.includes(r.id), `reviewer: rule ${r.id} holds`, clip(r.text));
      check(failed.length === 0, 'reviewer: no rule or control fails', failed);
      const s2 = i17Step2(rev);
      check(s2 !== null && squash(s2) === I17_R17_SQ && `${s2}\n` === T(C17_BLOCKS.R17_NEW), 'reviewer: step 2 is exactly the frozen R17 text (no blank line, three-space continuation indent)', s2 && s2.slice(0, 80));
      check(COUNT(rev, '\n2. Resolve') === 1 && COUNT(rev, 'git rev-parse') === 0 && !rev.includes('rev-parse'), 'reviewer: one step 2 and no rev-parse anywhere');
      check(s2 !== null && [...s2.matchAll(/`([^`]*)`/g)].map((m) => m[1]).join('|') === 'node .ai/tools/git-safe.mjs head', 'reviewer: the only command in step 2 is node .ai/tools/git-safe.mjs head (a parent brief saying never raw git needs no exception)');
      for (const [heading, label] of [[I17_HEADING4, 'section 4 (the hard rules, the bounded reads and the bounded correction subsection)'], [I17_HEADING5, 'section 5 (the report, the equal-head warning and its condition)']]) {
        const a = sectionOf(rev, heading); const b = sectionOf(preRev, heading);
        check(a !== null && b !== null && a === b, `reviewer: ${label} is byte-identical to the pre-C17 section`, a === null ? 'missing' : sha(Buffer.from(a)));
      }
      const before = rev.slice(0, rev.indexOf(I17_STEP_START)); const beforePre = preRev.slice(0, preRev.indexOf(I17_STEP_START));
      const after = rev.slice(rev.indexOf(I17_STEP_END)); const afterPre = preRev.slice(preRev.indexOf(I17_STEP_END));
      check(before === beforePre && after === afterPre, 'reviewer: every byte before step 2 and from step 3 onward is the pre-C17 byte (only step 2 changed)');
      const sc = squash(rev);
      for (const [scenario, words, where] of I17_SCENARIOS) if (where === 'reviewer' || where === 'both') check(sc.includes(squash(words)), `C17-14/C17-20 row (reviewer): ${scenario}`, clip(words));
      const stopList = /You MUST stop on ([^.]*)\./.exec(sc);
      const stopped = stopList === null ? [] : stopList[1].split(/,| or /).map((x) => x.trim()).filter((x) => /^(GIT_SAFE_[A-Z_]+|POLICY_\*)$/.test(x));
      check(['GIT_SAFE_REVISION', 'GIT_SAFE_RECORD', 'GIT_SAFE_COMMAND', 'GIT_SAFE_REPOSITORY', 'GIT_SAFE_INPUT', 'GIT_SAFE_GIT'].every((c) => stopped.includes(c)) && !stopped.includes('GIT_SAFE_OWNERSHIP') && !stopped.includes('GIT_SAFE_ARGUMENT') && !stopped.includes('GIT_SAFE_PATTERN') && sc.includes('GIT_SAFE_INTERNAL, any other error, a denied read or a sandbox error.'), 'reviewer: the stop list names REVISION (an unborn HEAD), RECORD (a malformed identity) and COMMAND (an older core, F12), keeps "any other error" (which covers GIT_SAFE_OWNERSHIP) and does not name OWNERSHIP or either whitelisted code', stopped);
      const qualify = /Only (GIT_SAFE_[A-Z_]+)(?: and (GIT_SAFE_[A-Z_]+))? qualify/.exec(sc);
      check(qualify !== null && eq([qualify[1], qualify[2]].sort(), ['GIT_SAFE_ARGUMENT', 'GIT_SAFE_PATTERN']), 'reviewer: exactly two codes qualify for the bounded correction', qualify && qualify.slice(1));
      const nonAscii = (s) => [...s].filter((c) => c.charCodeAt(0) > 127).join('');
      check(nonAscii(rev) === nonAscii(preRev), 'reviewer: no non-ASCII character is added or removed');
      const issues = newProseIssues(rev, preRev);
      check(issues.length === 0, 'reviewer: every newly written line is ASCII and at most 100 columns', issues.slice(0, 6));
      const first = C17_BLOCKS.R17_NEW[1];
      check(rev.includes(first) && newProseIssues(rev.replace(first, () => 'q'.repeat(100)), preRev).filter((m) => /columns/.test(m)).length === 0 && newProseIssues(rev.replace(first, () => 'q'.repeat(101)), preRev).some((m) => /is 101 columns/.test(m)), 'reviewer: exactly 100 columns passes and 101 fails');
      proveFenceRules(check, 'reviewer R17 prose', { text: rev, baseline: preRev, paragraph: I17_R17_SQ });
    });
    await step('the installed security reference states the head form: the one-line grammar introduction, the head line immediately before review-diff in the grammar fence, the two head paragraphs directly after the fence, the ownership paragraphs after the global/system configuration paragraph (the F9 older-Git sentence compared with whitespace collapsed because its wrapping is not frozen), GIT_SAFE_OWNERSHIP as a stop condition outside the two-code correction whitelist, and the unchanged existing whitelist bullet', async () => {
      const failed = i17EvalSecurity(sec);
      for (const r of I17_SE_RULES) check(!failed.includes(r.id), `security reference: rule ${r.id} holds`, clip(r.text));
      check(failed.length === 0, 'security reference: no rule or control fails', failed);
      check(eq(i17FenceOf(sec), I17_GRAMMAR), 'the grammar fence lists the six object forms, head and review-diff in that order', i17FenceOf(sec));
      check(!sec.includes('exactly these six object forms and the review form'), 'the old "exactly these six" introduction is gone');
      const sc = squash(sec);
      for (const [scenario, words, where] of I17_SCENARIOS) if (where === 'security') check(sc.includes(squash(words)), `C17-14/C17-20 row (security reference): ${scenario}`, clip(words));
      check(amendmentOnce(sec, AM17.SE3_17) && sec.includes(`\`\`\`\n\n${T(C17_BLOCKS.SE3)}\n- Every other option or form is refused`), 'the head paragraphs stand directly after the grammar fence with one blank line on each side');
      const se4 = LF(sec).indexOf(I17_SE4_PARAS[0].slice(0, 40)); const dest = LF(sec).indexOf('### Review diffs (`review-diff`)');
      const cfg = LF(sec).indexOf('the execution and output settings used by these commands.');
      check(cfg >= 0 && se4 > cfg && dest > se4, 'the ownership paragraphs come after the global/system configuration paragraph and before the review-diff subsection');
      check(!/GIT_SAFE_OWNERSHIP[^.]*\b(qualif|corrected|retry)/i.test(sc.replace('GIT_SAFE_OWNERSHIP is not an argument or pattern rejection. Agents MUST stop on it to preserve the trust boundary; the bounded correction whitelist remains exactly GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN.', '')), 'no other sentence of the reference makes GIT_SAFE_OWNERSHIP a correction case');
      const nonAscii = (s) => [...s].filter((c) => c.charCodeAt(0) > 127).join('');
      check(nonAscii(sec) === nonAscii(preSec), 'security reference: no non-ASCII character is added or removed');
      const issues = newProseIssues(sec, preSec);
      check(issues.length === 0, 'security reference: every newly written line is ASCII and at most 100 columns', issues.slice(0, 6));
      const first = C17_BLOCKS.SE3[0];
      check(sec.includes(first) && newProseIssues(sec.replace(first, () => 'q'.repeat(100)), preSec).length === 0 && newProseIssues(sec.replace(first, () => 'q'.repeat(101)), preSec).some((m) => /is 101 columns/.test(m)), 'security reference: exactly 100 columns passes and 101 fails');
    });
    await step('negative controls on the installed text: every sentence of the R17 step, the warning paragraph, the preserved stop-rule bullet, correction subsection and bounded reads, and of the head and ownership paragraphs of the security reference is removed and weakened, and each guard replaced by its opposite', async () => {
      battery('reviewer', rev, reviewerRules, (x) => i17EvalReviewer(x, preRev));
      opposites('reviewer', rev, I17_STEP_OPPOSITES.concat(I17_PRESERVED_OPPOSITES), (x) => i17EvalReviewer(x, preRev), reviewerRules);
      battery('security reference', sec, I17_SE_RULES, i17EvalSecurity);
      opposites('security reference', sec, I17_SE_OPPOSITES, i17EvalSecurity, I17_SE_RULES);
    });
    await step('each amendment of the reviewer and the security reference is rejected when missing, partial, duplicated, moved, altered, spaced differently, written with CRLF or found in the wrong file (SE4_17, whose F9 wrapping is not frozen, is exempt from the whitespace controls only)', async () => {
      for (const [rel, ids, other] of [[I17_REVIEWER_REL, ['R17'], sec], [I17_SECURITY_REL, ['SE1_17', 'SE2_17', 'SE3_17', 'SE4_17'], rev]]) {
        for (const id of ids) {
          let a = AM17[id];
          // SE2_17 has an empty "before" anchor (the head line is wedged between two grammar lines), so the spacing controls cannot see a blank line
          // inserted above it; the controls use the true preceding grammar line as the anchor (same slice, same replacement).
          if (id === 'SE2_17') a = { ...a, before: 'ls <commit> [-- <paths>]\n', old: a.old, neu: a.neu };
          if (id === 'SE4_17') {
            // The helper's flex reversal does not detect a second copy of the paragraphs elsewhere in the file; that control is checked with the
            // stricter i17EvalSecurity (se4-duplicate) below, every other control runs unchanged.
            const sub = []; const subCheck = mkCheck(sub);
            amendmentControls(subCheck, `${rel} ${id}`, modelThrough(fx, rel, id) || '', a, { otherFileText: other });
            for (const msg of sub) if (!msg.includes('duplicate: a second copy at the end of the file')) check(false, msg);
            const dup = `${LF(modelThrough(fx, rel, id) || '')}\n${T(C17_BLOCKS.SE4_RENDERED)}`;
            check(i17EvalSecurity(dup).includes('se4-duplicate') && sub.some((m) => m.includes('duplicate: a second copy at the end of the file')), `${rel} ${id}: a second copy of the ownership paragraphs is rejected by the strict check (the helper's flex reversal alone does not see it)`);
          } else amendmentControls(check, `${rel} ${id}`, modelThrough(fx, rel, id) || '', a, { otherFileText: other });
          stats.controls += 12;
        }
      }
      // The flex amendment still rejects a changed word, a dropped sentence and a second copy (the controls above) and accepts a rewrapped but identical paragraph.
      const m = modelThrough(fx, I17_SECURITY_REL, 'SE4_17');
      const wrapped = C17_BLOCKS.SE4_RENDERED.slice(5, 10).join('\n');
      const rewrapped = m === null ? null : LF(m).replace(wrapped, () => squash(wrapped));
      check(rewrapped !== null && amendmentOnce(rewrapped, AM17.SE4_17) && reverseOne(rewrapped, AM17.SE4_17) !== null, 'SE4_17: a different wrapping of the same words is accepted (F9 wrapping is not frozen)');
      const dropF9 = m === null ? null : LF(m).replace(squash(C17_LITERALS.F9B.join(' ')).split(' ').slice(0, 4).join(' '), () => 'x');
      check(dropF9 !== null && !amendmentOnce(dropF9, AM17.SE4_17), 'SE4_17: a text that loses a word of the F9 older-Git sentence is rejected');
    });
    await step('docs-sync, all four wrappers, the root and nested templates and references/docs-generation.md are byte-identical to their pre-C17 raw SHA-256 pins (neither docs-sync nor any wrapper contains the raw HEAD step); the Codex wrapper exception stays exactly the bounded GIT_SAFE_ARGUMENT/GIT_SAFE_PATTERN correction; none of them names GIT_SAFE_OWNERSHIP or a rev-parse', async () => {
      for (const [rel, digest] of I17_UNCHANGED_PINS) {
        const b = readBytes(skillPath(context, rel));
        check(b !== null && sha(b) === digest, `${rel}: byte-identical to the pre-C17 bytes`, b && sha(b));
        if (b !== null) {
          check(sha(Buffer.concat([b, Buffer.from('x')])) !== digest && sha(Buffer.concat([Buffer.from([0x20]), b])) !== digest, `${rel}: control: one added byte is detected by the pin`);
          if (/^assets\/(agents|wrappers)\//.test(rel)) {
            const s = b.toString('utf8');
            check(!/rev-parse/.test(s) && !s.includes('GIT_SAFE_OWNERSHIP'), `${rel}: no raw HEAD step and no GIT_SAFE_OWNERSHIP`);
            check(/rev-parse/.test(`${s}\nResolve HEAD with git rev-parse --verify HEAD.\n`) && `${s}\nSee GIT_SAFE_OWNERSHIP.\n`.includes('GIT_SAFE_OWNERSHIP'), `${rel}: control: an added raw HEAD step or an OWNERSHIP mention would be recognized`);
          }
        }
      }
      if (docsInstalled !== null) {
        check(squash(i17Hard(docsInstalled)) === squash(i17Hard(preRev)), 'docs-sync: its stop-rule bullet is the same text as the reviewer\'s');
        check(eq(paras((sectionOf(docsInstalled, I17_RR_HEADING) || '').split('\n')), paras((sectionOf(preRev, I17_RR_HEADING) || '').split('\n'))), 'docs-sync: its bounded correction subsection is the same text as the reviewer\'s');
        for (const [rel, bad] of [[I17_DOCS_REL, docsInstalled.replace('You MUST', () => 'Resolve HEAD with git rev-parse --verify HEAD. You MUST')]]) check(i17EvalDocs(bad, preRev).includes('raw-head-present'), `${rel}: control: a raw HEAD step added to docs-sync is rejected`);
        check(i17EvalDocs(docsInstalled.replace('Only GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN qualify.', () => 'Only GIT_SAFE_ARGUMENT, GIT_SAFE_PATTERN and GIT_SAFE_OWNERSHIP qualify.'), preRev).length > 0, 'docs-sync: control: a whitelist extension is rejected');
      }
      const toml = await importOrFail(failures, pathToFileURL(skillPath(context, 'scripts/toml.mjs')).href, 'scripts/toml.mjs');
      for (const rel of I17_CODEX_WRAPPERS) {
        const text = readText(skillPath(context, rel)) || '';
        check(squash(text).includes('stop and report it, except for the bounded GIT_SAFE_ARGUMENT/GIT_SAFE_PATTERN correction in the canonical definition. Do not retry it through another tool, change the sandbox, request full access, or use a connector as a fallback.') && COUNT(text, 'GIT_SAFE_') === 2 && !/OWNERSHIP|REPOSITORY|REVISION|COMMAND|RECORD|head\b.*git-safe/.test(text), `${rel}: the exception stays the bounded ARGUMENT/PATTERN correction and names no other code`);
        if (toml) { let parsed = null; try { parsed = toml.parseToml(text); } catch (e) { parsed = { errors: [errMsg(e)] }; } check(parsed && Array.isArray(parsed.errors) && parsed.errors.length === 0, `${rel}: the wrapper is still valid TOML`, parsed && parsed.errors); }
      }
      for (const rel of I17_CLAUDE_WRAPPERS) { const s = readText(skillPath(context, rel)) || ''; check(!s.includes('GIT_SAFE_') && !/rev-parse/.test(s), `${rel}: names no git-safe code and no raw HEAD step`); }
      const sc = squash(docsInstalled || '');
      for (const [scenario, words, where] of I17_SCENARIOS) if (where === 'both') check(sc.includes(squash(words)), `C17-14/C17-20 row (docs-sync): ${scenario}`, clip(words));
    });
    diag(context, `R90/C17/instructions: ${stats.mutants} in-memory rule mutants and opposites and about ${stats.controls} amendment controls`);
    flushProcessCount(context, 'R90/C17/instructions', mark);
  });
}

// ============================================ A5-templates/C17/host-docs ====
// Plan C17-8 (O17, P17, S17), C17-9 (the dated rc.3 observations and the two stale-claim replacements), C17-14 row "host-docs" and the freeze addendum
// (F6, F7, F9, F14): the living documents separate what was measured on rc.3 (the HEAD-routing defect and the ownership failure, with exact versions
// and dates, Claude Code 2.1.310 headless and 2.1.311 TUI as separate scopes) from what C17 only intends to fix (no rc.4 host result exists yet), keep
// R83-e closed as PASS by instruction with its residual unchanged, keep the rc.2 tables as dated history, and document the Windows Codex sandbox
// prerequisite (an effective global or system safe.directory grant for the exact trusted checkout, never an agent-written or injected one).
// The documents are text: they establish what is recorded, not that a host behaves so. Every frozen paragraph is a rule, every sentence of it is removed
// and weakened in memory and the rule must then fail, named guards are replaced by their opposites, and the battery runs on the independent model (the
// pre-C17 fixture plus the helper's amendments) and on the installed files.
const H17_O17_HEADING = '## Git ownership in the Codex Windows sandbox';
const H17_HOST_HEADING = '## rc.3 host observations dated 2026-10-26/27';
const H17_RC2_CLAUDE_HEADING = '### Host behavior: measured scope and remaining checks';
const H17_RC2_CODEX_HEADING = '## Host measurements dated 2026-10-24/25';
const H17_O17_PARAS = paras(C17_BLOCKS.O17.slice(2));
const H17_HOST_PARAS = paras(C17_BLOCKS.HOST.slice(2));
const H17_P17_PARAS = paras(C17_BLOCKS.P17);
const H17_CL_NEW_SQ = squash(C17_BLOCKS.CL_NEW.join(' '));
const H17_CX_NEW_SQ = squash(C17_BLOCKS.CX_NEW.join(' '));
// The paragraphs that hold the two replaced claims continue with sentences that C17 leaves alone; the whole paragraph is the rule (plan C17-9: "Retain the
// preceding rc.2 tables as dated history. Preserve the profile, negative-capability, missing-Node, subprocess and platform limitations.").
const H17_CL_PARA = squash(`${C17_BLOCKS.CL_NEW.join(' ')} The nearest loaded rule at or above the original start directory governs the comparison, so a worktree nested under another checkout is judged against its own rule. A start above or outside the target root can load that rule only after an initial read. That comparison does not refuse such a start even after the target rule loads. Missing launch context alone does not establish a subdirectory start or verified controls. The hook executes project code and depends on the trusted-checkout boundary.`);
const H17_CX_PARA = squash(`${C17_BLOCKS.CX_NEW.join(' ')} The older 0.160.1 observations above remain historical observations of that configuration.`);
const H17_S17_CELL = C17_LITERALS.S17_NEW_CELL;
const H17_S17_OLD_CELL = 'bounded diff/log/show/cat/ls/grep and `review-diff` with secret excludes, no shell';
// The rc.2 table rows (plan C16-11, retained as dated history): ten in references/claude.md, thirteen in references/codex.md.
const H17_ROW_COUNTS = { 'references/claude.md': 10, 'references/codex.md': 13 };
const H17_RULE_SETS = {
  'SKILL.md': ['o17'],
  'README.md': ['o17', 'host'],
  'references/claude.md': ['host', 'cl', 'p17'],
  'references/codex.md': ['host', 'o17', 'cx'],
};
const H17_NEW_HEADINGS = {
  'SKILL.md': [H17_O17_HEADING],
  'README.md': [H17_O17_HEADING, H17_HOST_HEADING],
  'references/claude.md': [H17_HOST_HEADING],
  'references/codex.md': [H17_HOST_HEADING, H17_O17_HEADING],
};
// [heading before the new block, the new heading list in order, the heading after] for the contiguity check of each file.
const H17_NEIGHBORS = {
  'SKILL.md': ['## Non-negotiable rules', '## Scripts'],
  'README.md': ['## Claude raw-Git hook', '## Trusted-checkout reviews'],
  'references/claude.md': [H17_RC2_CLAUDE_HEADING, '## Subagent wrappers'],
  'references/codex.md': [H17_RC2_CODEX_HEADING, '## Load verification (Codex session)'],
};
function h17Rules(rel) {
  const sets = H17_RULE_SETS[rel];
  const rules = [];
  if (sets.includes('o17')) rules.push(...paraRules('o17', 'o17sec', H17_O17_PARAS));
  if (sets.includes('host')) rules.push(...paraRules('host', 'hostsec', H17_HOST_PARAS));
  if (sets.includes('cl')) rules.push({ id: 'cl#1', where: 'all', text: H17_CL_PARA });
  if (sets.includes('cx')) rules.push({ id: 'cx#1', where: 'all', text: H17_CX_PARA });
  if (sets.includes('p17')) rules.push(...paraRules('p17', 'all', H17_P17_PARAS));
  if (rel === 'SKILL.md') rules.push({ id: 's17', where: 'all', text: H17_S17_CELL });
  return rules;
}
function h17Scopes(t) {
  return { o17sec: squash(sectionOf(t, H17_O17_HEADING) || ''), hostsec: squash(sectionOf(t, H17_HOST_HEADING) || ''), all: squash(t) };
}
const h17Rows = (section) => LF(section || '').split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Item |'));
// A sentence of the rc.3 observations that claims an rc.4 host result (or a TUI pass) would turn an intended fix into a measurement.
function h17Overclaims(hostSection) {
  const out = [];
  for (const s of sentencesOf(hostSection)) {
    if (/\brc\.4\b/.test(s) && /\b(PASS|PASSED|passed|verified|confirmed|closed|released)\b/.test(s)) out.push(s);
    if (/\bTUI\b/.test(s) && /\b(PASS|PASSED|passed|verified|confirmed)\b/.test(s)) out.push(s);
  }
  return out;
}
// The failing rule IDs of one document (empty when everything holds). `pre` is the verified pre-C17 text of the same document.
function h17Eval(raw, rel, pre) {
  const t = LF(raw);
  const rules = h17Rules(rel);
  const f = failedRules(rules, h17Scopes(t));
  // every inserted section and paragraph stands exactly once (a duplicate is as wrong as a missing one)
  for (const r of rules) if (COUNT(squash(t), r.text) !== 1) f.push(`${r.id}-once`);
  const rv = reverseForFile(t, rel);
  if (rv.text === null) f.push(`${rv.failed}-anchor`);
  const hs = headingsOf(t);
  const hp = headingsOf(pre).map((h) => (h.startsWith('# ') ? h.replace('3.0.0-rc.3', '3.0.0-rc.4') : h)); // the level-1 title carries the version (SH17, RM1_17)
  const added = hs.filter((h) => !hp.includes(h));
  if (!eq(added, H17_NEW_HEADINGS[rel]) || !eq(hs.filter((h) => hp.includes(h)), hp)) f.push('headings');
  const [prev, next] = H17_NEIGHBORS[rel];
  const first = hs.indexOf(H17_NEW_HEADINGS[rel][0]);
  const last = hs.indexOf(H17_NEW_HEADINGS[rel][H17_NEW_HEADINGS[rel].length - 1]);
  if (first < 0 || last < 0 || hs[first - 1] !== prev || hs[last + 1] !== next || last - first !== H17_NEW_HEADINGS[rel].length - 1) f.push('order');
  if (rules.some((r) => r.where === 'hostsec')) {
    const sc = squash(t);
    if (sc.includes('measurement branch')) f.push('source-old');
    if (h17Overclaims(squash(sectionOf(t, H17_HOST_HEADING) || '')).length > 0) f.push('overclaim');
  }
  if (rel === 'references/claude.md') {
    if (squash(t).includes('remains TO VERIFY on rc.3')) f.push('cl-old');
    if (!squash(sectionOf(t, '## Subagent wrappers') || '').endsWith(squash(C17_BLOCKS.P17.join(' ')))) f.push('p17-placement');
  }
  if (rel === 'references/codex.md' && squash(t).includes('must be re-measured after rc.3')) f.push('cx-old');
  if (rel === 'SKILL.md') {
    if (LF(t).split('\n')[5] !== '# project-setup 3.0.0-rc.4') f.push('sh17');
    if (!LF(t).split('\n').includes(`| \`assets/tools/git-safe.mjs\` | ${H17_S17_CELL} |`) || LF(t).includes(H17_S17_OLD_CELL)) f.push('s17-row');
  }
  return f;
}
// Opposites: a substituted guard must fail the rule that holds the sentence. [rule id, sentence, its opposite, why]
const H17_O17_OPPOSITES = [
  ['o17#1', 'git-safe removes environment-injected Git configuration, including Codex\'s injected safe.directory entry.', 'git-safe preserves environment-injected Git configuration, including Codex\'s injected safe.directory entry.', 'injected configuration stays stripped'],
  ['o17#1', 'A checkout that Git considers differently owned therefore needs an effective global or system safe.directory grant.', 'A checkout that Git considers differently owned needs no grant.', 'a grant is needed'],
  ['o17#2', 'the user can add its exact absolute path', 'the agent can add its exact absolute path', 'the user grants, not the agent'],
  ['o17#3', 'git config --global --add safe.directory', 'git config --global --add safe.directory "*"', 'the exact-path command'],
  ['o17#4', 'When GIT_CONFIG_GLOBAL is set, --global writes that selected file; otherwise it writes the invoking user\'s global config.', 'When GIT_CONFIG_GLOBAL is set, --global ignores it.', 'GIT_CONFIG_GLOBAL selects the written file'],
  ['o17#4', 'GIT_CONFIG_GLOBAL requires Git 2.32 or later.', 'GIT_CONFIG_GLOBAL works on every Git release.', 'F9: the Git version caveat'],
  ['o17#4', 'Use the path exactly as git rev-parse --show-toplevel prints it when you run it yourself, with forward slashes.', 'Use any spelling of the path.', 'F9: the path spelling'],
  ['o17#4', 'The grant must be in configuration used by the sandbox\'s Git process.', 'The grant may be in any configuration.', 'effective configuration'],
  ['o17#5', 'You SHOULD grant only the exact trusted checkout, because safe.directory = * disables the ownership check for every repository.', 'You SHOULD grant safe.directory = * for every repository.', 'wildcard breadth'],
  ['o17#5', 'Adding an exact entry beside an existing * does not narrow the wildcard grant.', 'Adding an exact entry beside an existing * narrows the wildcard grant.', 'an exact entry does not narrow a wildcard'],
  ['o17#6', 'Setup and review agents MUST NOT write global or system Git configuration or preserve injected configuration to bypass this refusal.', 'Setup and review agents MAY write global or system Git configuration or preserve injected configuration to bypass this refusal.', 'no agent-written grant'],
  ['o17#6', 'They MUST stop and report GIT_SAFE_OWNERSHIP so a failed trust check cannot become an automatic access grant.', 'They MAY retry after GIT_SAFE_OWNERSHIP so a failed trust check becomes an automatic access grant.', 'a stop condition'],
  ['o17#6', 'After the user resolves the prerequisite, start a new review attempt.', 'After the user resolves the prerequisite, resume the same review attempt.', 'a new attempt'],
  ['o17#7', 'That code does not prove that the directory lacks a Git repository.', 'That code proves that the directory lacks a Git repository.', 'REPOSITORY is not proof of absence'],
  ['o17#7', 'See references/security.md for the diagnostic\'s deliberately narrow recognition rule.', 'See references/security.md for the diagnostic\'s deliberately broad recognition rule.', 'narrow recognition'],
];
const H17_HOST_OPPOSITES = [
  ['host#1', 'Claude Code was 2.1.310 for headless runs and 2.1.311 for TUI runs.', 'Claude Code was 2.1.311 for headless runs and 2.1.310 for TUI runs.', 'the two Claude versions'],
  ['host#1', 'The version change is a separate measurement scope.', 'The version change is the same measurement scope.', 'a separate scope'],
  ['host#1', 'These measurements used published rc.3', 'These measurements used published rc.4', 'rc.3, not rc.4'],
  ['host#2', 'R83-e closed as PASS by instruction.', 'R83-e closed as PASS by host enforcement.', 'R83-e by instruction'],
  ['host#2', 'the refusal is model compliance, not host enforcement', 'the refusal is host enforcement', 'the residual is unchanged'],
  ['host#2', 'Both Codex L10 reviews completed.', 'Both Codex L10 reviews were incomplete.', 'both L10 reviews completed'],
  ['host#2', 'the equal-head warning was present for change-1 and absent for change-2', 'the equal-head warning was absent for change-1 and present for change-2', 'the warning for the right range'],
  ['host#3', 'routed the raw HEAD command through git-safe, which did not support it', 'ran the raw HEAD command through raw Git', 'D1: routed through git-safe'],
  ['host#3', 'the failure was ambiguous routing, not a hook denial', 'the failure was a hook denial', 'D1: not a hook denial'],
  ['host#3', 'skipped the HEAD comparison and ended partial', 'completed the HEAD comparison and ended complete', 'D1: partial'],
  ['host#4', 'git-safe stripped the injected safe.directory configuration', 'git-safe preserved the injected safe.directory configuration', 'D2: stripped'],
  ['host#4', 'The first Codex review failed root discovery with GIT_SAFE_REPOSITORY.', 'The first Codex review failed root discovery with GIT_SAFE_OWNERSHIP.', 'D2: the measured code was REPOSITORY'],
  ['host#4', 'A global safe.directory = * is broader than the checkout-specific grant.', 'A global safe.directory = * is narrower than the checkout-specific grant.', 'the wildcard is broader'],
  ['host#5', 'These are intended fixes, not measured rc.4 host results.', 'These are measured rc.4 host results.', 'intended, not measured'],
  ['host#5', 'Final 3.0.0 remains gated on the rc.4 measurements.', 'Final 3.0.0 is released.', 'final 3.0.0 stays gated'],
  ['host#6', 'L16 and its residuals remain unchanged.', 'L16 and its residuals are removed.', 'L16 unchanged'],
  ['host#6', 'This did not reproduce in the TUI', 'This reproduced in the TUI', 'headless only'],
  ['host#7', 'Static tests do not establish these host observations.', 'Static tests establish these host observations.', 'the tests are not host evidence'],
];
const H17_OTHER_OPPOSITES = [
  ['cl#1', 'The rc.3 measurements closed R83-e as PASS by instruction, weaker than host enforcement.', 'The rc.3 measurements closed R83-e as PASS by host enforcement.', 'R83-e by instruction'],
  ['cl#1', 'The rc.4 reviewer measurements remain pending', 'The rc.4 reviewer measurements passed', 'rc.4 pending'],
  ['cl#1', 'That comparison does not refuse such a start even after the target rule loads.', 'That comparison refuses such a start after the target rule loads.', 'the residual is unchanged'],
  ['cx#1', 'Both L10 ranges completed in the rc.3 measurements recorded below.', 'Both L10 ranges remain to be measured on rc.3.', 'both L10 ranges completed'],
  ['cx#1', 'The rc.4 regression remains pending.', 'The rc.4 regression passed.', 'rc.4 pending'],
  ['cx#1', 'do not establish review completeness or host negative capability', 'establish review completeness and host negative capability', 'no negative-capability claim'],
  ['p17#1', 'you SHOULD include the supplied original session directory, the repository root and the current directory in the brief', 'you SHOULD omit the original session directory from the brief', 'P17: the brief carries the launch context'],
  ['p17#1', 'You MUST NOT invent missing launch context', 'You MAY invent missing launch context', 'P17: no invented context'],
  ['p17#1', 'the existing rule treats uncertainty as unknown, not proof of a refusal condition or active host controls', 'the existing rule treats uncertainty as proof of a refusal condition', 'P17: uncertainty is unknown'],
  ['s17', 'bounded diff/log/show/cat/ls/grep, checkout head identity and `review-diff` with secret excludes, no shell', 'bounded diff/log/show/cat/ls/grep and `review-diff` with secret excludes, no shell', 'S17: the helper inventory names head'],
];
const H17_ALL_OPPOSITES = [...H17_O17_OPPOSITES, ...H17_HOST_OPPOSITES, ...H17_OTHER_OPPOSITES];
// Runs the amendment controls and ignores only the controls that an empty anchor cannot express: with an empty "before" anchor a blank line above the block
// is not an anchor violation, with an empty "after" anchor neither is one below it, and with both empty (a one-line replacement) the line cannot be "moved"
// (the pinned bytes of checkAmendedFile catch every such change; the ignored control names are exactly these three).
function h17Controls(check, label, model, a, opts) {
  const sub = []; const subCheck = mkCheck(sub);
  amendmentControls(subCheck, label, model, a, opts);
  const ignorable = (msg) => (a.before === '' && msg.includes('spaced: an extra blank line before the amendment'))
    || (a.after === '' && msg.includes('spaced: an extra blank line after the amendment'))
    || (a.before === '' && a.after === '' && msg.includes('moved: the text away from its anchor'));
  for (const msg of sub) if (!ignorable(msg)) check(false, msg);
}
// ---------------------------------------------------------------------------------------------------------------------------------------------------
async function hostDocs(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const fx = loadFixture(context);
    const stats = { mutants: 0, controls: 0 };
    const RELS = Object.keys(H17_RULE_SETS);
    const pre = {}; const model = {};
    for (const rel of RELS) { pre[rel] = preText(fx, rel); model[rel] = modelOf(fx, rel); }
    if (RELS.some((rel) => pre[rel] === null || model[rel] === null)) { check(false, 'the pre-C17 SKILL.md, README.md, references/claude.md and references/codex.md are in the fixture and take every C17 amendment exactly once at its anchor', RELS.filter((rel) => pre[rel] === null || model[rel] === null)); return; }
    const battery = (label, raw, rules, evaluate) => {
      const tried = proveRulesFail(check, label, raw, rules, evaluate);
      stats.mutants += tried;
      check(tried >= sentenceCount(rules), `${label}: the in-memory variants cover every sentence of the frozen text (removal and weakening)`, { tried, sentences: sentenceCount(rules) });
    };
    const opposites = (label, raw, rel, evaluate) => {
      const ids = new Set(h17Rules(rel).map((r) => r.id));
      const pairs = H17_ALL_OPPOSITES.filter(([id]) => ids.has(id));
      proveOpposites(check, label, raw, pairs, evaluate, h17Rules(rel));
      stats.mutants += pairs.length;
    };

    await step('the independent models (the pinned pre-C17 SKILL.md, README.md, references/claude.md and references/codex.md plus the frozen amendments applied by the helper) satisfy every rule; every sentence of O17, of the rc.3 host observations, of the two replaced stale-claim paragraphs and of P17 is a rule that fails when it is removed or weakened; each guard is replaced by its opposite; placement, duplication, the stale text and over-claims are rejected', async () => {
      for (const rel of RELS) {
        const m = model[rel];
        check(h17Eval(m, rel, pre[rel]).length === 0, `${rel} model satisfies every rule`, h17Eval(m, rel, pre[rel]));
        battery(`${rel} (model)`, m, h17Rules(rel), (x) => h17Eval(x, rel, pre[rel]));
        opposites(`${rel} (model)`, m, rel, (x) => h17Eval(x, rel, pre[rel]));
        const t = LF(m);
        const blocks = [];
        if (H17_RULE_SETS[rel].includes('o17')) blocks.push(['O17', T(C17_BLOCKS.O17)]);
        if (H17_RULE_SETS[rel].includes('host')) blocks.push(['host notes', T(C17_BLOCKS.HOST)]);
        for (const [name, block] of blocks) {
          check(h17Eval(`${t}\n${block}`, rel, pre[rel]).some((id) => /once|headings|order/.test(id)), `${rel} control: a second copy of the ${name} section is rejected`);
          check(h17Eval(t.replace(`${block}\n`, () => ''), rel, pre[rel]).length > 0, `${rel} control: the missing ${name} section is rejected`);
        }
      }
      // the stale claims, an old Source line, an rc.4 over-claim and a TUI pass claim
      const cl = LF(model['references/claude.md']);
      check(h17Eval(reverseOne(cl, AM17.CL_REPL17) || '', 'references/claude.md', pre['references/claude.md']).includes('cl-old'), 'control: the stale "remains TO VERIFY on rc.3" claim is rejected in references/claude.md');
      const cx = LF(model['references/codex.md']);
      check(h17Eval(reverseOne(cx, AM17.CX_REPL17) || '', 'references/codex.md', pre['references/codex.md']).includes('cx-old'), 'control: the stale "must be re-measured after rc.3" claim is rejected in references/codex.md');
      const rd = LF(model['README.md']);
      check(h17Eval(rd.replace('(PR #6).', () => 'in the distribution\nrepository\'s measurement branch.'), 'README.md', pre['README.md']).includes('source-old'), 'control: the pre-F14 Source wording (the measurement branch) is rejected');
      check(h17Eval(rd.replace('Static tests do not establish these host observations.', () => 'The rc.4 reviewers passed. Static tests do not establish these host observations.'), 'README.md', pre['README.md']).includes('overclaim'), 'control: a sentence that claims an rc.4 host pass is rejected');
      check(h17Eval(rd.replace('Static tests do not establish these host observations.', () => 'The TUI run passed. Static tests do not establish these host observations.'), 'README.md', pre['README.md']).includes('overclaim'), 'control: a sentence that claims a TUI pass is rejected');
      check(h17Overclaims('These are intended fixes, not measured rc.4 host results. Final 3.0.0 remains gated on the rc.4 measurements.').length === 0, 'the two sentences that name rc.4 without a result are not over-claims');
      const sk = LF(model['SKILL.md']);
      check(h17Eval(sk.replace('# project-setup 3.0.0-rc.4', () => '# project-setup 3.0.0-rc.3'), 'SKILL.md', pre['SKILL.md']).includes('sh17'), 'control: the rc.3 SKILL.md heading is rejected');
      check(h17Eval(sk.replace(H17_S17_CELL, () => H17_S17_OLD_CELL), 'SKILL.md', pre['SKILL.md']).includes('s17-row'), 'control: the pre-C17 helper-table cell is rejected');
    });

    const installed = {};
    await step('every C17 amendment of SKILL.md, README.md, references/claude.md and references/codex.md stands exactly once at its anchor in the installed files and the reversal in reverse order gives the pre-C17 bytes (raw SHA-256 pinned by plan C17-12); the files keep the C17-5 byte convention', async () => {
      for (const rel of RELS) installed[rel] = checkAmendedFile(check, context, fx, rel);
    });
    if (RELS.some((rel) => !installed[rel])) { check(false, 'all four host documents are readable'); return; }
    const cur = Object.fromEntries(RELS.map((rel) => [rel, LF(installed[rel].text)]));
    await step('installed documents: O17 (the Windows Codex sandbox prerequisite: an effective global or system safe.directory grant for the exact trusted checkout, the exact git config --global --add safe.directory command, the GIT_CONFIG_GLOBAL selection, the F9 Git 2.32 and path-spelling sentences, the wildcard breadth and the exact-entry-beside-wildcard rule, the agent MUST NOT and the stop on GIT_SAFE_OWNERSHIP, a new attempt, and the unrecognized-diagnostic note) stands once in SKILL.md before "## Scripts", in the skill README directly before the host notes (which stand directly before "## Trusted-checkout reviews") and in references/codex.md directly after the host notes and before "## Load verification (Codex session)"; the helper-table cell and heading of SKILL.md are exact', async () => {
      for (const rel of RELS) {
        const failed = h17Eval(cur[rel], rel, pre[rel]);
        for (const r of h17Rules(rel)) check(!failed.includes(r.id) && !failed.includes(`${r.id}-once`), `${rel}: rule ${r.id} holds and stands once`, clip(r.text));
        check(failed.length === 0, `${rel}: no rule, placement or control fails`, failed);
      }
      for (const rel of ['SKILL.md', 'README.md', 'references/codex.md']) {
        check(COUNT(cur[rel], T(C17_BLOCKS.O17)) === 1, `${rel}: the O17 section is exactly the frozen text (F9 sentences included) once`);
      }
      check(C17_BLOCKS.O17.join('\n').includes('git config --global --add safe.directory \'C:/path/to/trusted-checkout\'') && cur['SKILL.md'].includes('```powershell\ngit config --global --add safe.directory \'C:/path/to/trusted-checkout\'\n```'), 'the exact-path command is the frozen PowerShell example');
      const sk = cur['SKILL.md'];
      check(sk.indexOf(H17_O17_HEADING) < sk.indexOf('\n## Scripts\n') && sk.slice(sk.indexOf(H17_O17_HEADING)).includes(`${T(C17_BLOCKS.O17)}\n## Scripts\n`), 'SKILL.md: O17 stands directly before "## Scripts" with one blank line between');
      check(sk.split('\n')[5] === '# project-setup 3.0.0-rc.4' && sk.split('\n').includes(`| \`assets/tools/git-safe.mjs\` | ${H17_S17_CELL} |`) && !sk.includes(H17_S17_OLD_CELL), 'SKILL.md: line 6 is the rc.4 heading and the helper-table cell is the frozen S17 text with its backticks (F7)');
      const rd = cur['README.md'];
      check(rd.includes(`${T(C17_BLOCKS.O17)}\n${T(C17_BLOCKS.HOST)}\n## Trusted-checkout reviews\n`), 'README.md: O17, then the host notes, then "## Trusted-checkout reviews", each separated by one blank line');
      const cxt = cur['references/codex.md'];
      check(cxt.includes(`${T(C17_BLOCKS.HOST)}\n${T(C17_BLOCKS.O17)}\n## Load verification (Codex session)\n`), 'references/codex.md: the host notes, then O17, then "## Load verification (Codex session)", each separated by one blank line');
      const cl = cur['references/claude.md'];
      check(cl.includes(`${T(C17_BLOCKS.HOST)}\n## Subagent wrappers\n`) && cl.includes(`${T(C17_BLOCKS.P17)}\n## Retiring v1\n`), 'references/claude.md: the host notes stand directly before "## Subagent wrappers" and P17 directly before "## Retiring v1"');
    });
    await step('the rc.3 host observations: dated 2026-10-26/27, with the measured scope (Windows 11 Pro 10.0.26100, Node v24.14.1, codex-cli 0.163.0, Claude Code 2.1.310 headless and 2.1.311 TUI as separate scopes), R83-e closed as PASS by instruction with its model-compliance residual, both Codex L10 reviews completed, the two measured defects (D1 raw HEAD routed through git-safe and skipped, D2 the generic repository error under a separate Windows user with the injected safe.directory stripped), the headless P3 h false launch refusal with L16 unchanged, the Source line of F14, the statement that C17 only intends fixes and that final 3.0.0 stays gated, and no rc.4 or TUI over-claim; identical in README.md, references/claude.md and references/codex.md', async () => {
      const texts = RELS.filter((rel) => H17_RULE_SETS[rel].includes('host')).map((rel) => [rel, LF(sectionOf(cur[rel], H17_HOST_HEADING) || '')]);
      check(texts.length === 3 && texts.every(([, s]) => s !== '' && squash(s) === squash(C17_BLOCKS.HOST.slice(2).join(' '))), 'the host observations are the same frozen text in all three documents', texts.map(([rel]) => rel));
      for (const [rel, s] of texts) {
        const q = squash(s);
        for (const w of ['Windows 11 Pro 10.0.26100', 'Node v24.14.1', 'codex-cli 0.163.0', 'Claude Code was 2.1.310 for headless runs and 2.1.311 for TUI runs', 'The version change is a separate measurement scope.', 'R83-e closed as PASS by instruction.', 'Both Codex L10 reviews completed.', 'GIT_SAFE_COMMAND', 'GIT_SAFE_REPOSITORY', 'separate Windows user', 'Source: docs/plans/2026-10-26-project-setup-v3-rc3-host-measurements.md (PR #6). Static tests do not establish these host observations.', 'These are intended fixes, not measured rc.4 host results.']) check(q.includes(w), `${rel}: ${clip(w)}`);
        check(h17Overclaims(q).length === 0, `${rel}: no sentence claims an rc.4 host result or a TUI pass`, h17Overclaims(q));
        check(!/measurement branch/.test(q) && LF(s).split('\n').includes('Source: docs/plans/2026-10-26-project-setup-v3-rc3-host-measurements.md (PR #6).') && LF(s).split('\n').includes('Static tests do not establish these host observations.'), `${rel}: the Source line names PR #6 on its own line, not the measurement branch (F14), and the following sentence is unchanged`);
      }
      const hostRows = (rel) => h17Rows(sectionOf(cur[rel], H17_HOST_HEADING));
      check(RELS.filter((rel) => H17_RULE_SETS[rel].includes('host')).every((rel) => hostRows(rel).length === 0), 'the rc.3 observations carry no table row (the rc.2 tables stay the dated history)');
    });
    await step('historical and current stay distinct: the rc.2 host tables and sections are retained (references/claude.md: ten rows, references/codex.md: thirteen rows, in order, unchanged), the only change inside them is the one replaced stale-claim paragraph (R83-e closed as PASS by instruction with every following residual sentence kept; both Codex L10 ranges completed with the rc.4 regression pending), the rc.2-dated headings stay before the rc.3 observations, the profile row stays BLOCKED, and no row turns into PASS; the general launcher prerequisite and every other README section are untouched', async () => {
      for (const [rel, heading, replaced] of [['references/claude.md', H17_RC2_CLAUDE_HEADING, [C17_BLOCKS.CL_OLD, C17_BLOCKS.CL_NEW]], ['references/codex.md', H17_RC2_CODEX_HEADING, [C17_BLOCKS.CX_OLD, C17_BLOCKS.CX_NEW]]]) {
        const a = sectionOf(cur[rel], heading); const b = sectionOf(pre[rel], heading);
        check(a !== null && b !== null && h17Rows(a).length === H17_ROW_COUNTS[rel] && eq(h17Rows(a), h17Rows(b)), `${rel}: the rc.2 table rows are the pre-C17 rows, ${H17_ROW_COUNTS[rel]} of them, in order`, a && h17Rows(a).length);
        const expected = b === null ? null : b.replace(T(replaced[0]), () => T(replaced[1]));
        check(a !== null && expected !== null && b.includes(T(replaced[0])) && a.replace(/\n+$/, '') === expected.replace(/\n+$/, ''), `${rel}: the rc.2 section differs from the pre-C17 section only by the one replaced stale-claim paragraph`);
        const hs = headingsOf(cur[rel]);
        check(hs.indexOf(heading) >= 0 && hs.indexOf(heading) < hs.indexOf(H17_HOST_HEADING), `${rel}: the rc.2 dated section comes before the rc.3 observations`);
      }
      const cxRows = h17Rows(sectionOf(cur['references/codex.md'], H17_RC2_CODEX_HEADING));
      for (const row of cxRows) if (/R44 profile|negative capability|Secret shell read|macOS/.test(row)) check(!/\| PASS\b/.test(row) && /BLOCKED|INCONCLUSIVE|TO VERIFY/.test(row), `references/codex.md: not upgraded to PASS: ${clip(row)}`);
      check(cxRows.some((r) => r.startsWith('| R44 profile row | BLOCKED:')), 'references/codex.md: the profile row stays BLOCKED');
      const clRows = h17Rows(sectionOf(cur['references/claude.md'], H17_RC2_CLAUDE_HEADING));
      check(clRows.some((r) => r.startsWith('| Subdirectory start / R83-e | FAIL:')) && clRows.some((r) => r.startsWith('| Node missing | FAIL OPEN:')), 'references/claude.md: the rc.2 R83-e FAIL and Node-missing rows are history, kept as measured');
      const rd = cur['README.md']; const rp = pre['README.md'];
      for (const h of headingsOf(rp).filter((x) => x.startsWith('## ') && x !== '## Local candidate release')) {
        const a = sectionOf(rd, h); const b = sectionOf(rp, h);
        check(a !== null && b !== null && a === b, `README.md: the section "${h}" is byte-identical to the pre-C17 section (the launcher prerequisite and every other section are not rewritten)`);
      }
      check(sectionOf(rd, '## Review-lane launcher prerequisite') === sectionOf(rp, '## Review-lane launcher prerequisite') && sectionOf(rp, '## Review-lane launcher prerequisite') !== null, 'README.md: the general launcher prerequisite is exactly the pre-C17 text (the measurement-specific isolation exception is not written into it)');
      const sw = (rel) => LF(sectionOf(cur[rel], '## Subagent wrappers') || '');
      const preSw = sectionOf(pre['references/claude.md'], '## Subagent wrappers');
      check(preSw !== null && sw('references/claude.md') === `${preSw}\n${T(C17_BLOCKS.P17)}`, 'references/claude.md: "## Subagent wrappers" is the pre-C17 section plus exactly the P17 paragraph');
    });
    await step('P17 (conditional on decision Q4, taken as recommended) is skill-side guidance only (F6): the brief carries the supplied original session directory, the repository root and the current directory, uncertainty stays unknown and is never invented, and nothing reaches an installed project: the root CLAUDE.md template (L16), the nested template, the root and nested AGENTS templates and all four wrappers are byte-identical to their pre-C17 pins and none carries the P17 wording', async () => {
      const pins = [['assets/templates/CLAUDE.md', '5bb1d5ed697e921dcc839d031e082f884ca9a97a1eafd8d4a003d2ddb1cbaa47'], ['assets/templates/nested-CLAUDE.md', '336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49'], ['assets/templates/AGENTS.md', '616a26a54d2e8f77b0d4df3e78055ca41f6e7638654ad70a0f4d28a0e4eb5a0e'], ['assets/templates/nested-AGENTS.md', '11cd44a06e9e50023e8ddcb5e8d476e2338b206c2973e6d4ef6f53997b1ed370'], ['assets/wrappers/claude-reviewer.md', '284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423'], ['assets/wrappers/claude-docs-sync.md', '36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43'], ['assets/wrappers/codex-reviewer.toml', 'fe21c05b09bcba96b631bb08e22e6be807cdc8e0c75a740acff1b70c683c695c'], ['assets/wrappers/codex-docs_sync.toml', '1e6eef9ae6d75c0fef3c79b9879a0d69c4ad88d774889b81d09558cd61af6287']];
      for (const [rel, digest] of pins) {
        const b = readBytes(skillPath(context, rel));
        check(b !== null && sha(b) === digest, `${rel}: byte-identical to the pre-C17 bytes (no root-template, wrapper or L16 amendment accompanies P17)`, b && sha(b));
        check(b !== null && !squash(b.toString('utf8')).includes('supplied original session'), `${rel}: does not carry the P17 wording`);
      }
      const p = squash(C17_BLOCKS.P17.join(' '));
      check(cur['references/claude.md'].includes(T(C17_BLOCKS.P17)) && COUNT(squash(cur['references/claude.md']), p) === 1, 'references/claude.md: the P17 paragraph stands once, exactly the frozen text');
      for (const rel of ['SKILL.md', 'README.md', 'references/codex.md']) check(!squash(cur[rel]).includes('supplied original session'), `${rel}: P17 is not copied into another document`);
    });
    await step('negative controls on the installed text: every sentence of O17, of the rc.3 host observations, of the two replaced paragraphs and of P17 is removed and weakened in each document that carries it, and each guard is replaced by its opposite', async () => {
      for (const rel of RELS) {
        battery(rel, cur[rel], h17Rules(rel), (x) => h17Eval(x, rel, pre[rel]));
        opposites(rel, cur[rel], rel, (x) => h17Eval(x, rel, pre[rel]));
      }
    });
    await step('each amendment of the four documents (SH17, S17, SO17, RM1_17, RM_HOST17, RM_O17, RM4a_17, RM4b_17, CX_REPL17, CX_O17, CX_HOST17, CL_REPL17, CL_HOST17, CL_P17) is rejected when missing, partial, duplicated, moved, altered, spaced differently, written with CRLF or found in the wrong file', async () => {
      for (const rel of RELS) {
        const others = RELS.filter((r) => r !== rel);
        for (const id of FORWARD_ORDER17[rel]) {
          h17Controls(check, `${rel} ${id}`, modelThrough(fx, rel, id) || '', AM17[id], { otherFileText: cur[others[0]] });
          stats.controls += 12;
        }
      }
    });
    await step('the new host-documentation prose is ASCII within 100 columns (SKILL.md, README.md, references/claude.md, references/codex.md; tables and fences keep their exemption), exactly 100 columns passes and 101 fails, and the fence rules themselves can fail', async () => {
      for (const rel of RELS) {
        const issues = newProseIssues(cur[rel], pre[rel]);
        check(issues.length === 0, `${rel}: every newly written line is ASCII and at most 100 columns`, issues.slice(0, 6));
      }
      const first = C17_BLOCKS.HOST[2];
      const rd = cur['README.md'];
      check(rd.includes(first) && newProseIssues(rd.replace(first, () => 'q'.repeat(100)), pre['README.md']).length === 0 && newProseIssues(rd.replace(first, () => 'q'.repeat(101)), pre['README.md']).some((m) => /is 101 columns/.test(m)), 'README.md: exactly 100 columns passes and 101 fails');
      const nonAscii = (s) => [...s].filter((c) => c.charCodeAt(0) > 127).join('');
      for (const rel of RELS) check(nonAscii(cur[rel]) === nonAscii(pre[rel]), `${rel}: no non-ASCII character is added or removed`);
      proveFenceRules(check, 'README O17 prose', { text: rd, baseline: pre['README.md'], paragraph: H17_O17_PARAS[3] });
      stats.controls += 1;
    });
    diag(context, `A5-templates/C17/host-docs: ${stats.mutants} in-memory rule mutants and opposites and about ${stats.controls} amendment controls`);
    flushProcessCount(context, 'A5-templates/C17/host-docs', mark);
  });
}

// ============================================ V2/C17/update ====
// Plan C17-14 (the "update" row), C17-15 and F12: installed rc.1, rc.2 and rc.3 projects take the rc.4 runtime unit and canonical reviewer through the normal reviewed managed
// transaction (real apply.mjs prepare, diff, commit and rollback; validate.mjs in process; no mock). The baselines are AUTHENTIC source bytes of the pinned commits (rc.1 source
// 8b9b4772, rc.2 release 76d3b226, rc.3 release 7a509902) from tests/fixtures/c17-upgrade-baselines.json (19 members each: the seven runtime files, both canonical agents, the four wrappers,
// the four root and nested instruction templates, the runtime catalog and VERSION), pinned entry by entry below and cross-checked at run time against the older pinned fixtures
// (c13-rc1-agents.json, c16-prechange.json, c17-prechange.json). Synthetic project names, placeholder values and manifest metadata are rendered by this test; no production script reads the fixture.
// The rc.4 expectation is rendered independently: the rc.3 bytes with the frozen R17 and RD17 amendments applied by the helper. PLAN-GAP: the plan freezes git-safe-core.mjs behavior, not its
// hunks, so the delivered core is compared with the current skill file (and shown to differ from every baseline core, to know `head` and to reject nothing else); every other member has an independent oracle.
// PLAN-GAP: rc.1 has no project-rule extensions (C14 introduced them in rc.2), so only the rc.2 and rc.3 projects carry them. The installed policy is a schema-2 file with a project addition; the update stages none, so its bytes must stay.
const U17_PINS = {
  rc1: {
    'assets/tools/security-policy.mjs': '2ded982e54580fc993add5b4003bc892dd08e230ea3c7d98892fccdb6fc83dbb',
    'assets/tools/git-safe-core.mjs': '49596e4814ef48880a6e08ea2741f667a29c2aa1a12ed098a9cb4b65dc9b3548',
    'assets/tools/guard-raw-git-core.mjs': 'cee120da3205767a4b2e17515948be55185d047175c8f5d91d38eeaa4d9210c9',
    'assets/tools/review-diff.mjs': 'ae236ae32405497d5c9bb2340a5cebbe45d37b1c6d50367b478523cf7de06d83',
    'assets/tools/git-safe.mjs': '995bafa72582acad616982549e4c0aa581831bc25b132f83a533f7bad91bb154',
    'assets/tools/guard-raw-git.mjs': '7b6b8e7e5d11850656f8395563c0f6d0788a234fbc01b9642b30ae231862276e',
    'assets/tools/hooks-selftest.mjs': '8aae599d95c8cab62ffb3da29354d3a00e3cf8d6c9cea1f7e144709a72dec802',
    'assets/agents/reviewer.md': '6a0bea8db90c18857cb8850f640848fee5bbb63cda34dbc9b641b5eaef3aa50b',
    'assets/agents/docs-sync.md': '54217f5ecc81c2e048b52ea8458d598a35129ec74dbf6aadea70462287fac458',
    'assets/wrappers/claude-reviewer.md': '284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423',
    'assets/wrappers/claude-docs-sync.md': '36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43',
    'assets/wrappers/codex-reviewer.toml': '135028b89b86ed0f3dcfe46c07119012b8f3ff2b6903fb51a591b833792ea13b',
    'assets/wrappers/codex-docs_sync.toml': '7a1d6e004a0f5af60ecf77b7ff22141f08e59379b84ce31e9ced32c7dc87be93',
    'assets/templates/AGENTS.md': '64ce67a7c5568488e64f7649ea95fa659f5b604c45f5048d94a1fd7413507210',
    'assets/templates/CLAUDE.md': '2762eadfda90518f841b455ed0e37676b17fcdd7be260bab039a663c8a0c7ab8',
    'assets/templates/nested-AGENTS.md': '11cd44a06e9e50023e8ddcb5e8d476e2338b206c2973e6d4ef6f53997b1ed370',
    'assets/templates/nested-CLAUDE.md': '336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49',
    'data/runtime-units.json': 'a1867f13ce2760cb1a676a48cdaac5a9fe4a868220dbaf7f528b169b64678ef6',
    'VERSION': '9fbdc29eeb419100bd00dd882ffd8fbcbfd9a5dffec659f62e91eb6ba0358077',
  },
  rc2: {
    'assets/tools/security-policy.mjs': '2ded982e54580fc993add5b4003bc892dd08e230ea3c7d98892fccdb6fc83dbb',
    'assets/tools/git-safe-core.mjs': '49596e4814ef48880a6e08ea2741f667a29c2aa1a12ed098a9cb4b65dc9b3548',
    'assets/tools/guard-raw-git-core.mjs': 'cee120da3205767a4b2e17515948be55185d047175c8f5d91d38eeaa4d9210c9',
    'assets/tools/review-diff.mjs': 'ae236ae32405497d5c9bb2340a5cebbe45d37b1c6d50367b478523cf7de06d83',
    'assets/tools/git-safe.mjs': '995bafa72582acad616982549e4c0aa581831bc25b132f83a533f7bad91bb154',
    'assets/tools/guard-raw-git.mjs': '7b6b8e7e5d11850656f8395563c0f6d0788a234fbc01b9642b30ae231862276e',
    'assets/tools/hooks-selftest.mjs': '8aae599d95c8cab62ffb3da29354d3a00e3cf8d6c9cea1f7e144709a72dec802',
    'assets/agents/reviewer.md': '4c6eb90964c0106b4a1daa518524096eca4b6a428feab1dcb1cab8d3b981d5be',
    'assets/agents/docs-sync.md': 'ee5e402b523b29e1c57896a0c9200f50725b268edd3f68fbfde98e022f23f5bd',
    'assets/wrappers/claude-reviewer.md': '284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423',
    'assets/wrappers/claude-docs-sync.md': '36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43',
    'assets/wrappers/codex-reviewer.toml': '135028b89b86ed0f3dcfe46c07119012b8f3ff2b6903fb51a591b833792ea13b',
    'assets/wrappers/codex-docs_sync.toml': '7a1d6e004a0f5af60ecf77b7ff22141f08e59379b84ce31e9ced32c7dc87be93',
    'assets/templates/AGENTS.md': '616a26a54d2e8f77b0d4df3e78055ca41f6e7638654ad70a0f4d28a0e4eb5a0e',
    'assets/templates/CLAUDE.md': 'cca922bb9a1baf2e78168c0efcdaca77341fd7d6d0a922ac6a0a8863ae78bcf9',
    'assets/templates/nested-AGENTS.md': '11cd44a06e9e50023e8ddcb5e8d476e2338b206c2973e6d4ef6f53997b1ed370',
    'assets/templates/nested-CLAUDE.md': '336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49',
    'data/runtime-units.json': 'a1867f13ce2760cb1a676a48cdaac5a9fe4a868220dbaf7f528b169b64678ef6',
    'VERSION': 'da65b61809819f3046ce593b9883e3bf2144ff2ab7a031932f3f3e6c70b03944',
  },
  rc3: {
    'assets/tools/security-policy.mjs': '2ded982e54580fc993add5b4003bc892dd08e230ea3c7d98892fccdb6fc83dbb',
    'assets/tools/git-safe-core.mjs': 'ad1c51db23444c022dcb4eca06d0b3fd52984cb1bf3230596a840f34203b5f85',
    'assets/tools/guard-raw-git-core.mjs': 'cee120da3205767a4b2e17515948be55185d047175c8f5d91d38eeaa4d9210c9',
    'assets/tools/review-diff.mjs': 'ae236ae32405497d5c9bb2340a5cebbe45d37b1c6d50367b478523cf7de06d83',
    'assets/tools/git-safe.mjs': '995bafa72582acad616982549e4c0aa581831bc25b132f83a533f7bad91bb154',
    'assets/tools/guard-raw-git.mjs': '7b6b8e7e5d11850656f8395563c0f6d0788a234fbc01b9642b30ae231862276e',
    'assets/tools/hooks-selftest.mjs': '175fa8611582fe0c8eafd8032c5dbb3c6e981e8cf9f710653c87529b58f6ba66',
    'assets/agents/reviewer.md': 'd3d5661331d7bd2acf65cf699e853d680e3e866559d0deb65f807b81c67c6e46',
    'assets/agents/docs-sync.md': '605398911043231f4ec53358986988ccbe8d5648beb0e918ee955d8104fff814',
    'assets/wrappers/claude-reviewer.md': '284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423',
    'assets/wrappers/claude-docs-sync.md': '36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43',
    'assets/wrappers/codex-reviewer.toml': 'fe21c05b09bcba96b631bb08e22e6be807cdc8e0c75a740acff1b70c683c695c',
    'assets/wrappers/codex-docs_sync.toml': '1e6eef9ae6d75c0fef3c79b9879a0d69c4ad88d774889b81d09558cd61af6287',
    'assets/templates/AGENTS.md': '616a26a54d2e8f77b0d4df3e78055ca41f6e7638654ad70a0f4d28a0e4eb5a0e',
    'assets/templates/CLAUDE.md': '5bb1d5ed697e921dcc839d031e082f884ca9a97a1eafd8d4a003d2ddb1cbaa47',
    'assets/templates/nested-AGENTS.md': '11cd44a06e9e50023e8ddcb5e8d476e2338b206c2973e6d4ef6f53997b1ed370',
    'assets/templates/nested-CLAUDE.md': '336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49',
    'data/runtime-units.json': 'a1867f13ce2760cb1a676a48cdaac5a9fe4a868220dbaf7f528b169b64678ef6',
    'VERSION': 'a63841f1ebf4dd11cdc420501e74daed07ae0b9b3553273c566331c033a27efa',
  },
};

const U17_BASELINES_REL = 'tests/fixtures/c17-upgrade-baselines.json';
const U17_FIXTURE_RAW_SHA = '0f9532eefd2514291aad44dae0c2200added3348089922eec7f8ebdf7db8b1b9';
const U17_FIXTURE_BYTES = 594453;
const U17_IDS = ['rc1', 'rc2', 'rc3'];
const U17_VERSIONS = { rc1: '3.0.0-rc.1', rc2: '3.0.0-rc.2', rc3: '3.0.0-rc.3' };
const U17_VERSION = '3.0.0-rc.4';
const U17_ENTRY_PATHS = [
  'project-setup/assets/tools/security-policy.mjs', 'project-setup/assets/tools/git-safe-core.mjs', 'project-setup/assets/tools/guard-raw-git-core.mjs', 'project-setup/assets/tools/review-diff.mjs',
  'project-setup/assets/tools/git-safe.mjs', 'project-setup/assets/tools/guard-raw-git.mjs', 'project-setup/assets/tools/hooks-selftest.mjs', 'project-setup/assets/agents/reviewer.md',
  'project-setup/assets/agents/docs-sync.md', 'project-setup/assets/wrappers/claude-reviewer.md', 'project-setup/assets/wrappers/claude-docs-sync.md', 'project-setup/assets/wrappers/codex-reviewer.toml',
  'project-setup/assets/wrappers/codex-docs_sync.toml', 'project-setup/assets/templates/AGENTS.md', 'project-setup/assets/templates/CLAUDE.md', 'project-setup/assets/templates/nested-AGENTS.md',
  'project-setup/assets/templates/nested-CLAUDE.md', 'project-setup/data/runtime-units.json', 'project-setup/VERSION',
];
const U17_PROJECT = 'c17-svc';
const U17_MANIFEST = '.ai/manifest.json';
const U17_POLICY = '.ai/security-paths.json';
const U17_DS = '.ai/agents/docs-sync.project.md';
const U17_RV = '.ai/agents/reviewer.project.md';
const U17_REVIEWER = '.ai/agents/reviewer.md';
const U17_CORE = '.ai/tools/git-safe-core.mjs';
const U17_RDIFF = '.ai/tools/review-diff.mjs';
const U17_CODEX_REVIEWER = '.codex/agents/reviewer.toml';
const U17_DOCSYNC = '.ai/agents/docs-sync.md';
const U17_RUNTIME = ['security-policy.mjs', 'git-safe-core.mjs', 'guard-raw-git-core.mjs', 'review-diff.mjs', 'git-safe.mjs', 'guard-raw-git.mjs', 'hooks-selftest.mjs'];
// kind: agent (the project name is substituted), verbatim, claude (blocks plus user text), agents (blocks, placeholders rendered, plus user text), nested (blocks, directory rendered, plus user text).
const U17_TARGETS = [
  { t: U17_REVIEWER, src: 'assets/agents/reviewer.md', kind: 'agent' },
  { t: U17_DOCSYNC, src: 'assets/agents/docs-sync.md', kind: 'agent' },
  { t: U17_CODEX_REVIEWER, src: 'assets/wrappers/codex-reviewer.toml', kind: 'verbatim' },
  { t: '.codex/agents/docs_sync.toml', src: 'assets/wrappers/codex-docs_sync.toml', kind: 'verbatim' },
  { t: '.claude/agents/reviewer.md', src: 'assets/wrappers/claude-reviewer.md', kind: 'verbatim' },
  { t: '.claude/agents/docs-sync.md', src: 'assets/wrappers/claude-docs-sync.md', kind: 'verbatim' },
  { t: 'src/payments/CLAUDE.md', src: 'assets/templates/nested-CLAUDE.md', kind: 'verbatim' },
  ...U17_RUNTIME.map((m) => ({ t: `.ai/tools/${m}`, src: `assets/tools/${m}`, kind: 'verbatim' })),
  { t: 'CLAUDE.md', src: 'assets/templates/CLAUDE.md', kind: 'claude' },
  { t: 'AGENTS.md', src: 'assets/templates/AGENTS.md', kind: 'agents' },
  { t: 'src/payments/AGENTS.md', src: 'assets/templates/nested-AGENTS.md', kind: 'nested' },
];
const U17_ALL = U17_TARGETS.map((x) => x.t);
// The managed targets whose delivered rc.4 text differs from each baseline, written out independently (never derived from the code under test).
const U17_CHANGED = {
  rc1: [U17_REVIEWER, U17_DOCSYNC, U17_CODEX_REVIEWER, '.codex/agents/docs_sync.toml', U17_CORE, U17_RDIFF, '.ai/tools/hooks-selftest.mjs', 'CLAUDE.md', 'AGENTS.md'],
  rc2: [U17_REVIEWER, U17_DOCSYNC, U17_CODEX_REVIEWER, '.codex/agents/docs_sync.toml', U17_CORE, U17_RDIFF, '.ai/tools/hooks-selftest.mjs', 'CLAUDE.md'],
  rc3: [U17_REVIEWER, U17_CORE, U17_RDIFF],
};
const U17_RUN_A = 'run-c17-a';
const U17_RUN_B = 'run-c17-b';
const U17_USER_TAIL = '\n## Local notes\n\n- Run the ledger checks before changing money code.\n';
const U17_DOCS_RULES = '# project documentation rules\n\n- Every new endpoint gets an entry in docs/api-conventions.md.\n';
const U17_REVIEW_RULES = '# project review rules\n\n- Check the ledger invariants first.\n';
const U17_POLICY_TEXT = `${JSON.stringify({ schema: 2, patterns: [{ anchor: 'any', glob: '**/.env*' }], projectPatterns: [{ anchor: 'root', glob: 'ledger-secrets/**' }] }, null, 2)}\n`;
const U17_APPROVAL_EDITED = 'fully managed file was edited by the user since install';
const U17_BASE_FILES = { 'package.json': '{"name":"c17-app"}\n', 'README.md': '# c17\n', '.gitignore': '.claude/settings.local.json\nCLAUDE.local.md\n', 'src/index.ts': 'export const ready = true;\n' };
const U17_OLD_COMMAND = 'git-safe: GIT_SAFE_COMMAND: supported commands: diff, log, show, cat, ls, grep, review-diff\n';
const u17Manifest = (files, over = {}) => jsonText({ schema: 3, skill: 'project-setup', skillVersion: '3.0.0-rc.2', mode: 'update', agents: [], sourceCommit: null, files, ...over });
const u17Project = (root, rel) => path.join(root, ...rel.split('/'));
const u17Draft = (root, id, rel) => path.join(root, '.ai', '.run', id, 'drafts', ...rel.split('/'));
const u17RunFile = (root, id, name) => path.join(root, '.ai', '.run', id, name);
const u17Rejection = (r, target) => (r.json && Array.isArray(r.json.errors) ? r.json.errors.find((e) => e.target === target) : undefined);
const u17ManifestOf = (root) => readJson(u17Project(root, U17_MANIFEST));
function u17Render(kind, text) {
  if (kind === 'agent') return text.split('{{PROJECT_NAME}}').join(U17_PROJECT);
  if (kind === 'claude') return `${text}${U17_USER_TAIL}`;
  const fill = (s, dir) => s.replace(/\{\{([A-Z_]+)\}\}/g, (m, name) => (name === 'PROJECT_NAME' ? U17_PROJECT : name === 'DIRECTORY' ? dir : `synthetic ${name}`));
  if (kind === 'agents') return `${fill(text, 'src/payments')}${U17_USER_TAIL}`;
  if (kind === 'nested') return `${fill(text, 'src/payments')}${U17_USER_TAIL}`;
  return text;
}
function u17MakeKit(context, check) {
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
    stage(root, id, drafts) { for (const [rel, text] of Object.entries(drafts)) putFile(u17Draft(root, id, rel), text); },
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
const U17_SHARED = new Map();
function u17SharedBase(context) {
  const have = U17_SHARED.get(context.tmp);
  if (have !== undefined && exists(have)) return have;
  fs.mkdirSync(context.tmp, { recursive: true });
  const dir = makeRepo(context, fs.mkdtempSync(path.join(context.tmp, 'c17-shared-base-')), { ...U17_BASE_FILES });
  U17_SHARED.set(context.tmp, dir);
  return dir;
}
const U17_FLIP = (hex) => `${hex.slice(0, -1)}${hex.endsWith('0') ? '1' : '0'}`;
// The structural and byte checks of the baselines fixture: an array of issue strings (empty when authentic). Used on the real fixture and, below, on deliberately damaged copies.
function u17FixtureIssues(doc, raw) {
  const issues = [];
  if (!Buffer.isBuffer(raw)) return ['the fixture file is unreadable'];
  if (sha(raw) !== U17_FIXTURE_RAW_SHA || raw.length !== U17_FIXTURE_BYTES) issues.push(`raw identity ${sha(raw).slice(0, 8)} / ${raw.length} bytes`);
  if (!doc || typeof doc !== 'object') return [...issues, 'not a JSON object'];
  if (raw.toString('utf8') !== `${JSON.stringify(doc, null, 2)}\n`) issues.push('not the canonical two-space JSON text with one final LF');
  if (!eq(Object.keys(doc), ['schema', 'baselines']) || doc.schema !== 1 || !Array.isArray(doc.baselines) || doc.baselines.length !== 3) return [...issues, 'frame: exactly schema 1 and three baselines'];
  doc.baselines.forEach((b, i) => {
    const id = U17_IDS[i];
    if (!b || !eq(Object.keys(b), ['id', 'skillVersion', 'sourceCommit', 'entries']) || b.id !== id) { issues.push(`${id}: baseline frame`); return; }
    if (b.sourceCommit !== UPGRADE_SOURCES[id]) issues.push(`${id}: source commit ${b.sourceCommit}`);
    if (b.skillVersion !== U17_VERSIONS[id]) issues.push(`${id}: skill version ${b.skillVersion}`);
    if (!Array.isArray(b.entries) || !eq(b.entries.map((e) => e && e.path), U17_ENTRY_PATHS)) { issues.push(`${id}: entry paths`); return; }
    for (const e of b.entries) {
      const pin = U17_PINS[id][e.path.slice('project-setup/'.length)];
      if (!eq(Object.keys(e), ['path', 'base64', 'sha256'])) { issues.push(`${id} ${e.path}: entry keys`); continue; }
      const bytes = Buffer.from(String(e.base64), 'base64');
      if (bytes.toString('base64') !== e.base64) issues.push(`${id} ${e.path}: base64 is not canonical`);
      if (sha(bytes) !== e.sha256 || e.sha256 !== pin) issues.push(`${id} ${e.path}: SHA-256 ${sha(bytes).slice(0, 8)} is not the pinned ${String(pin).slice(0, 8)}`);
    }
    const ver = b.entries.find((e) => e.path === 'project-setup/VERSION');
    if (ver && Buffer.from(ver.base64, 'base64').toString('utf8') !== `${U17_VERSIONS[id]}\n`) issues.push(`${id}: the VERSION entry is not the baseline version`);
  });
  return issues;
}
// The rendering check of one project against the independently expected end state; every difference is one issue string.
function u17DeliveryIssues(root, spec, blocks) {
  const issues = [];
  const rec = (t, text) => (spec.kinds[t] === 'full' ? { ownership: 'full', sha256: NH(text) } : { ownership: 'blocks', blocks: blocks.blockHashes(text).hashes });
  for (const t of U17_ALL) {
    const want = spec.text[t];
    if (readText(u17Project(root, t)) !== want) issues.push(`${t}: installed bytes differ from the expected text`);
  }
  const m = readJson(u17Project(root, U17_MANIFEST));
  if (!m || m.skillVersion !== spec.version) issues.push(`manifest skillVersion is ${m && m.skillVersion}`);
  if (m && m.files) for (const t of U17_ALL) { if (!eq(m.files[t], spec.records[t] || rec(t, spec.text[t]))) issues.push(`${t}: manifest record is not the expected one`); }
  else issues.push('manifest has no files');
  for (const [t, text] of Object.entries(spec.extensions || {})) {
    if (readText(u17Project(root, t)) !== text || !m || !eq(m.files && m.files[t], { ownership: 'merged' })) issues.push(`${t}: project extension changed`);
  }
  if (readText(u17Project(root, U17_POLICY)) !== U17_POLICY_TEXT) issues.push('the installed policy changed');
  return issues;
}

async function update(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const kit = u17MakeKit(context, check);
    const fx = loadFixture(context);
    const blocks = await importOrFail(failures, pathToFileURL(skillPath(context, 'scripts/blocks.mjs')).href, 'scripts/blocks.mjs');
    const validate = await importOrFail(failures, pathToFileURL(skillPath(context, 'scripts/validate.mjs')).href, 'scripts/validate.mjs');
    const rawBaselines = readBytes(skillPath(context, U17_BASELINES_REL));
    const doc = readJson(skillPath(context, U17_BASELINES_REL));
    if (!blocks || !validate || !doc || !Array.isArray(doc.baselines) || rawBaselines === null) { check(false, 'blocks.mjs, validate.mjs and the baselines fixture are available'); return; }
    const BL = {};
    for (const b of doc.baselines) { const files = {}; for (const e of b.entries) files[e.path.slice('project-setup/'.length)] = Buffer.from(e.base64, 'base64'); BL[b.id] = { files, version: b.skillVersion, commit: b.sourceCommit }; }
    const cur = (src) => readText(skillPath(context, src));
    const baseText = (id, src) => BL[id].files[src].toString('utf8');

    await step('the baselines fixture: schema 1 with exactly the three pinned source commits, 19 members each in the pinned order with canonical base64 and the SHA-256 of every member pinned independently (sha256sum of git show), the VERSION member equal to the baseline version; the fixture is canonical JSON and its raw bytes are pinned; damaged copies are detected', async () => {
      const issues = u17FixtureIssues(doc, rawBaselines);
      check(issues.length === 0, 'the baselines fixture is authentic and complete', issues.slice(0, 8));
      check(doc.baselines.map((b) => b.sourceCommit).join(',') === `${UPGRADE_SOURCES.rc1},${UPGRADE_SOURCES.rc2},${UPGRADE_SOURCES.rc3}` && doc.baselines.every((b) => b.entries.length === 19), 'the three source commits are the plan\'s (8b9b4772, 76d3b226, 7a509902) with 19 members each');
      const damage = (mutate) => { const d = JSON.parse(JSON.stringify(doc)); mutate(d); const r = Buffer.from(`${JSON.stringify(d, null, 2)}\n`, 'utf8'); return u17FixtureIssues(d, r); };
      check(damage((d) => { d.baselines[2].entries[1].sha256 = U17_FLIP(d.baselines[2].entries[1].sha256); }).length > 0, 'control: a wrong member hash is detected');
      check(damage((d) => { d.baselines[0].entries[0].base64 = Buffer.from('tampered').toString('base64'); }).length > 0, 'control: replaced member bytes are detected');
      check(damage((d) => { d.baselines[1].sourceCommit = d.baselines[2].sourceCommit; }).length > 0, 'control: a wrong source commit is detected');
      check(damage((d) => { d.baselines[2].entries.pop(); }).length > 0, 'control: a missing member is detected');
      check(damage((d) => { d.baselines[0].entries[3] = d.baselines[0].entries[2]; }).length > 0, 'control: a duplicated member path is detected');
      check(damage((d) => { d.baselines[0].skillVersion = '3.0.0-rc.9'; }).length > 0, 'control: a wrong baseline version is detected');
      check(u17FixtureIssues(doc, Buffer.concat([rawBaselines, Buffer.from('\n')])).length > 0 && u17FixtureIssues(doc, null).length > 0, 'control: changed or missing raw bytes are detected');
      // Cross-checks against the older pinned fixtures: the baselines are not self-certifying.
      const c16 = readJson(skillPath(context, 'tests/fixtures/c16-prechange.json'));
      const c13 = readJson(skillPath(context, 'tests/fixtures/c13-rc1-agents.json'));
      const pre16 = {}; if (c16 && Array.isArray(c16.entries)) for (const e of c16.entries) pre16[e.path] = Buffer.from(e.base64, 'base64');
      const agents1 = {}; if (c13 && Array.isArray(c13.entries)) for (const e of c13.entries) agents1[e.path] = Buffer.from(e.base64, 'base64');
      const same = (id, src, buf, label) => check(buf !== undefined && Buffer.compare(BL[id].files[src], buf) === 0, `${id} ${src} is byte-identical to ${label}`);
      for (const [src, key] of [['assets/tools/git-safe-core.mjs', 'assets/tools/git-safe-core.mjs'], ['assets/agents/reviewer.md', 'assets/agents/reviewer.md'], ['assets/agents/docs-sync.md', 'assets/agents/docs-sync.md'], ['assets/templates/CLAUDE.md', 'assets/templates/CLAUDE.md'], ['assets/templates/nested-CLAUDE.md', 'assets/templates/nested-CLAUDE.md'],
        ['assets/tools/hooks-selftest.mjs', 'assets/tools/hooks-selftest.mjs'], ['assets/wrappers/codex-reviewer.toml', 'assets/wrappers/codex-reviewer.toml'], ['assets/wrappers/codex-docs_sync.toml', 'assets/wrappers/codex-docs_sync.toml']]) {
        same('rc2', src, pre16[`project-setup/${key}`], 'the pre-C16 entry of tests/fixtures/c16-prechange.json');
      }
      same('rc1', 'assets/agents/reviewer.md', agents1['assets/agents/reviewer.md'], 'the rc.1 reviewer of tests/fixtures/c13-rc1-agents.json');
      same('rc1', 'assets/agents/docs-sync.md', agents1['assets/agents/docs-sync.md'], 'the rc.1 docs-sync of tests/fixtures/c13-rc1-agents.json');
      for (const [src, key] of [['assets/tools/git-safe-core.mjs', 'assets/tools/git-safe-core.mjs'], ['assets/tools/review-diff.mjs', 'assets/tools/review-diff.mjs'], ['assets/agents/reviewer.md', 'assets/agents/reviewer.md']]) {
        const pre = fx.files[key];
        check(pre !== undefined && Buffer.compare(BL.rc3.files[src], pre) === 0, `rc3 ${src} is byte-identical to the pre-C17 entry of tests/fixtures/c17-prechange.json`);
      }
      for (const src of ['assets/tools/security-policy.mjs', 'assets/tools/guard-raw-git-core.mjs', 'assets/tools/git-safe.mjs', 'assets/tools/guard-raw-git.mjs', 'assets/wrappers/claude-reviewer.md', 'assets/wrappers/claude-docs-sync.md', 'assets/templates/nested-CLAUDE.md', 'assets/templates/nested-AGENTS.md']) {
        if (BL.rc1.files[src] === undefined) continue;
        check(Buffer.compare(BL.rc1.files[src], BL.rc2.files[src]) === 0 && Buffer.compare(BL.rc2.files[src], BL.rc3.files[src]) === 0, `${src} is the same in all three baselines`);
      }
      check(sha(BL.rc1.files['assets/templates/CLAUDE.md']) === '2762eadfda90518f841b455ed0e37676b17fcdd7be260bab039a663c8a0c7ab8', 'the rc.1 root CLAUDE.md template is the authentic one pinned by C16 (2762eadf...)');
      const units = JSON.parse(BL.rc3.files['data/runtime-units.json'].toString('utf8'));
      check(units && Array.isArray(units.units) && eq(units.units.map((u) => path.posix.basename(u.source)), U17_RUNTIME), 'the baseline catalog lists the seven runtime members in the current order');
    });

    // ---- the independent expectation of the rc.4 end state --------------------------------------------------------------------
    const model = { reviewer: modelOf(fx, 'assets/agents/reviewer.md'), rdiff: modelOf(fx, 'assets/tools/review-diff.mjs') };
    if (model.reviewer === null || model.rdiff === null) { check(false, 'the pre-C17 reviewer and review-diff take the frozen R17 and RD17 amendments exactly once'); return; }
    const sourceMissing = U17_TARGETS.filter((x) => cur(x.src) === null).map((x) => x.src);
    if (sourceMissing.length) { check(false, 'the shipped assets are readable', sourceMissing); return; }
    const EXP = {}; // the expected rc.4 text of every managed target (core: PLAN-GAP, the current file)
    const CUR = {}; // what setup renders from the current assets
    for (const x of U17_TARGETS) {
      let expected = baseText('rc3', x.src); // everything C17 leaves alone equals the rc.3 bytes
      if (x.src === 'assets/agents/reviewer.md') expected = model.reviewer;
      else if (x.src === 'assets/tools/review-diff.mjs') expected = model.rdiff;
      else if (x.src === 'assets/tools/git-safe-core.mjs') expected = cur(x.src);
      EXP[x.t] = u17Render(x.kind, expected);
      CUR[x.t] = u17Render(x.kind, cur(x.src));
    }
    const KINDS = Object.fromEntries(U17_TARGETS.map((x) => [x.t, x.kind === 'claude' || x.kind === 'agents' || x.kind === 'nested' ? 'blocks' : 'full']));
    const rendered = (id) => Object.fromEntries(U17_TARGETS.map((x) => [x.t, u17Render(x.kind, baseText(id, x.src))]));
    const OLD = { rc1: rendered('rc1'), rc2: rendered('rc2'), rc3: rendered('rc3') };
    const versionFile = (readText(skillPath(context, 'VERSION')) || '');

    await step('the premises: the shipped assets render to exactly the independent expectation (rc.3 bytes plus the frozen R17 and RD17 amendments; the core is the current file and differs from every baseline core), the delivered targets differ from each baseline in exactly the written-out sets (rc.3: reviewer, core, review-diff; rc.2: plus docs-sync, both Codex wrappers, hooks-selftest and the claude block; rc.1: plus the AGENTS critical-rules block), and VERSION is exactly 3.0.0-rc.4', async () => {
      for (const t of U17_ALL) if (t !== U17_CORE) check(CUR[t] === EXP[t], `${t}: the shipped asset renders to exactly the independent expectation`);
      check(cur('assets/tools/git-safe-core.mjs') !== null && U17_IDS.every((id) => cur('assets/tools/git-safe-core.mjs') !== baseText(id, 'assets/tools/git-safe-core.mjs')), 'the shipped core differs from the rc.1, rc.2 and rc.3 cores');
      check(model.reviewer !== baseText('rc3', 'assets/agents/reviewer.md') && model.rdiff !== baseText('rc3', 'assets/tools/review-diff.mjs'), 'the expected reviewer and review-diff differ from rc.3');
      for (const id of U17_IDS) {
        const differs = U17_ALL.filter((t) => OLD[id][t] !== EXP[t]);
        check(eq(differs.slice().sort(), U17_CHANGED[id].slice().sort()), `${id}: exactly the written-out set of targets differs from rc.4`, differs);
      }
      check(versionFile === `${U17_VERSION}\n` && versionFile !== `${U17_VERSIONS.rc3}\n`, 'VERSION is exactly 3.0.0-rc.4 plus LF (and not the rc.3 version)', versionFile);
      check(EXP[U17_REVIEWER].includes('node .ai/tools/git-safe.mjs head') && !EXP[U17_REVIEWER].includes('git rev-parse --verify HEAD') && OLD.rc3[U17_REVIEWER].includes('git rev-parse --verify HEAD') && !OLD.rc3[U17_REVIEWER].includes('git-safe.mjs head'), 'the rc.4 reviewer routes HEAD through git-safe head and the rc.3 reviewer holds the raw HEAD step');
    });
    const headId = gitOk(context, u17SharedBase(context), ['rev-parse', 'HEAD']).stdout;
    check(FULL_ID_RE.test(headId), 'the shared fixture repository has a full commit ID', headId);

    const targetsOf = (id) => U17_CHANGED[id];
    await withScratch(context, 'c17-update', async (dir) => {
      const base = u17SharedBase(context);
      let counter = 0;
      // An installed project: the baseline bytes (rendered), the manifest records, optional user extensions, edits and omissions.
      const project = (id, { edits = {}, extensions = true, policy = true, over = {} } = {}) => {
        const root = copyTree(base, path.join(dir, `${id}-${(counter += 1)}`));
        const recs = {};
        for (const x of U17_TARGETS) {
          const text = (over[x.t] !== undefined ? over[x.t] : OLD[id][x.t]);
          recs[x.t] = KINDS[x.t] === 'full' ? { ownership: 'full', sha256: NH(OLD[id][x.t]) } : { ownership: 'blocks', blocks: blocks.blockHashes(OLD[id][x.t]).hashes };
          putFile(u17Project(root, x.t), edits[x.t] !== undefined ? edits[x.t] : text);
        }
        const ext = {};
        if (extensions && id !== 'rc1') { ext[U17_DS] = U17_DOCS_RULES; ext[U17_RV] = U17_REVIEW_RULES; for (const t of Object.keys(ext)) { putFile(u17Project(root, t), ext[t]); recs[t] = { ownership: 'merged' }; } }
        if (policy) putFile(u17Project(root, U17_POLICY), U17_POLICY_TEXT);
        putFile(u17Project(root, U17_MANIFEST), u17Manifest(recs, { skillVersion: BL[id].version }));
        return { root, extensions: ext };
      };
      const drafts = (omit = []) => { const d = {}; for (const t of U17_ALL) if (!omit.includes(t)) d[t] = CUR[t]; return d; };
      const specOf = (id, over = {}, exts = {}) => ({ version: U17_VERSION, kinds: KINDS, text: { ...EXP, ...over }, records: {}, extensions: exts });
      const validateRows = async (root) => {
        const r = await validate.main(['--json'], { root, files: ['package.json', 'README.md', ...U17_ALL, U17_MANIFEST] });
        return JSON.parse(r.stdout).results;
      };
      const head = (root) => { const r = execNode(context, { cwd: root, script: path.join(root, '.ai', 'tools', 'git-safe.mjs'), args: ['head'] }); if (r.dead) check(false, 'git-safe head: the process did not end normally', r.dead); return r; };
      const expectOldHead = (root, label) => { const r = head(root); check(r.code === 2 && r.stdout === '' && r.stderr === U17_OLD_COMMAND, `${label}: the installed pre-C17 core rejects head with the old command list and no output`, { code: r.code, out: r.stdout.slice(0, 60), err: r.stderr.slice(0, 160) }); };
      const expectNewHead = (root, label) => { const r = head(root); check(r.code === 0 && r.stdout === `${headId}\n` && r.stderr === '', `${label}: the installed rc.4 core prints the full checkout HEAD ID plus one LF`, { code: r.code, out: r.stdout.slice(0, 80), err: r.stderr.slice(0, 160) }); };

      // ================================= the main scenario, once per baseline (C17-15 steps 1-8) =================================
      const mainScenario = async (id) => {
        const label = id;
        const { root, extensions } = project(id);
        const CH = targetsOf(id);
        const spec = specOf(id, {}, extensions);
        check(u17DeliveryIssues(root, { ...spec, text: OLD[id], version: BL[id].version }, blocks).length === 0, `${label}: premise: the synthetic installed project is exactly the baseline (bytes and manifest records)`, u17DeliveryIssues(root, { ...spec, text: OLD[id], version: BL[id].version }, blocks).slice(0, 4));
        expectOldHead(root, label);
        const rowsBefore = await validateRows(root);
        if (!kit.begin(root, U17_RUN_A)) return null;
        kit.stage(root, U17_RUN_A, drafts());
        const p = kit.prepare(root, U17_RUN_A);
        const opTargets = p.json && Array.isArray(p.json.ops) ? p.json.ops.map((o) => o.target).sort() : null;
        check(p.code === 0 && p.json && p.json.ok === true && eq(opTargets, CH.slice().sort()) && p.json.ops.every((o) => o.action === 'modify' && o.userContentChange === false) && p.json.unchanged === U17_ALL.length - CH.length, `${label}: prepare with no approval plans one modification of exactly the written-out changed targets and keeps the others unchanged`, { code: p.code, ops: opTargets, unchanged: p.json && p.json.unchanged, out: p.stdout.slice(0, 300) });
        if (!(p.json && p.json.planSha256)) return null;
        const d = kit.diff(root, U17_RUN_A);
        const fileOf = (t) => d.json && d.json.files && d.json.files.find((x) => x.target === t);
        const added = (t, re) => fileOf(t) !== undefined && re.test(String(fileOf(t).diff));
        check(d.code === 0 && added(U17_REVIEWER, /^\+2\. Resolve the checkout's current HEAD with `node \.ai\/tools\/git-safe\.mjs head`\.$/m) && added(U17_REVIEWER, /^-.*git rev-parse --verify HEAD/m) && added(U17_CORE, /^\+.*head: 'head'/m) && added(U17_RDIFF, /^\+ {2}GIT_SAFE_COMMAND: 'supported commands: diff, log, show, cat, ls, grep, head, review-diff',$/m) && added(U17_RDIFF, /^- {2}GIT_SAFE_COMMAND: 'supported commands: diff, log, show, cat, ls, grep, review-diff',$/m), `${label}: the bound review shows the new reviewer step 2, the head form of the core and the one-line command-list change as added lines (and the raw HEAD step removed)`, d.json && d.json.files && d.json.files.map((x) => x.target));
        const c = kit.commit(root, U17_RUN_A, p.json.planSha256);
        const written = c.json && Array.isArray(c.json.written) ? c.json.written.map((w) => w.target) : null;
        check(c.code === 0 && c.json && c.json.committed === true && written !== null && eq(written.slice().sort(), [...CH, U17_MANIFEST].sort()) && written[written.length - 1] === U17_MANIFEST, `${label}: the plan-hash commit writes exactly the changed targets once, with the manifest written last`, c.json && c.json.written);
        const issues = u17DeliveryIssues(root, spec, blocks);
        check(issues.length === 0, `${label}: every installed byte and manifest record is the independently expected rc.4 state (current skill bytes, normalized hashes, version ${U17_VERSION}); user text outside the managed blocks, project extensions and the policy addition are kept`, issues.slice(0, 6));
        for (const x of U17_TARGETS.filter((y) => y.kind === 'verbatim')) check(Buffer.compare(readBytes(u17Project(root, x.t)), readBytes(skillPath(context, x.src))) === 0, `${label}: ${x.t} equals the current skill file byte for byte`);
        const rows = await validateRows(root);
        check(rows.filter((x) => x.check === 'drift').length === rowsBefore.filter((x) => x.check === 'drift').length && !rows.some((x) => x.check === 'drift' && x.level === 'fail'), `${label}: validate finds no new drift after the update`, rows.filter((x) => x.check === 'drift'));
        const dr = kit.launch('blocks drift', 'blocks', ['drift', '--file', 'CLAUDE.md'], root);
        check(dr.json && eq(dr.json.blocks.map((b) => b.state), ['unchanged']), `${label}: the claude block is unchanged against the new baseline`, dr.json);
        expectNewHead(root, label);
        check(kit.release(root, U17_RUN_A).code === 0 && kit.begin(root, U17_RUN_B), `${label}: the first run lock is released and a routine rerun begins`);
        kit.stage(root, U17_RUN_B, drafts());
        const manifestBefore = readBytes(u17Project(root, U17_MANIFEST));
        const p2 = kit.prepare(root, U17_RUN_B);
        check(p2.code === 0 && p2.json && p2.json.ok === true && p2.json.changed === 0 && p2.json.unchanged === U17_ALL.length && p2.json.metadataChanged === 0, `${label}: the rerun finds nothing to change`, { code: p2.code, out: p2.stdout.slice(0, 260) });
        const c2 = p2.json && p2.json.planSha256 ? kit.commit(root, U17_RUN_B, p2.json.planSha256) : null;
        check(c2 && c2.code === 0 && c2.json && c2.json.committed === false && /zero diff/.test(String(c2.json.reason)) && Buffer.compare(readBytes(u17Project(root, U17_MANIFEST)), manifestBefore) === 0, `${label}: the rerun commit is "nothing to change (zero diff)" and the manifest bytes are identical`, c2 && c2.json);
        return { root, spec };
      };
      let delivered = null;
      for (const id of U17_IDS) {
        await step(`${id} installation (authentic ${BL[id].version} source bytes${id === 'rc1' ? '' : ', merged project extensions'}, user text outside the managed blocks, a project policy addition): a normal managed update stages the complete current seven-file runtime unit with the current canonical reviewer and everything else this baseline needs, needs no approval for unedited files, commits once with the manifest last, validates, runs head through the installed CLI, and a rerun is a zero diff`, async () => {
          const r = await mainScenario(id);
          if (id === 'rc3') delivered = r;
        });
      }
      await step('negative controls of the delivery oracle on a copy of the delivered rc.3 project: a reverted reviewer, an altered core, a stale manifest hash, a stale version, lost user text, a changed extension, a changed policy and a changed Claude wrapper are each reported (the oracle can fail)', async () => {
        if (!delivered) { check(false, 'the rc.3 scenario produced a delivered project'); return; }
        const { root, spec } = delivered;
        check(u17DeliveryIssues(root, spec, blocks).length === 0, 'control baseline: the delivered project has no issue');
        const damaged = (name, mutate, want) => {
          const copy = copyTree(root, path.join(dir, `ctl-${(counter += 1)}`));
          mutate(copy);
          const issues = u17DeliveryIssues(copy, spec, blocks);
          check(issues.length > 0 && (want === undefined || issues.some((i) => i.startsWith(want))), `control: ${name} is reported`, issues.slice(0, 3));
        };
        damaged('a reviewer reverted to the rc.3 bytes (the old HEAD step kept)', (r) => putFile(u17Project(r, U17_REVIEWER), OLD.rc3[U17_REVIEWER]), U17_REVIEWER);
        damaged('a core with one appended byte', (r) => fs.appendFileSync(u17Project(r, U17_CORE), '\n'), U17_CORE);
        damaged('a review-diff left at the rc.3 bytes', (r) => putFile(u17Project(r, U17_RDIFF), OLD.rc3[U17_RDIFF]), U17_RDIFF);
        damaged('a manifest whose reviewer hash is stale', (r) => { const m = readJson(u17Project(r, U17_MANIFEST)); m.files[U17_REVIEWER].sha256 = NH(OLD.rc3[U17_REVIEWER]); putFile(u17Project(r, U17_MANIFEST), jsonText(m)); }, `${U17_REVIEWER}: manifest`);
        damaged('a manifest that still names the baseline version', (r) => { const m = readJson(u17Project(r, U17_MANIFEST)); m.skillVersion = BL.rc3.version; putFile(u17Project(r, U17_MANIFEST), jsonText(m)); }, 'manifest skillVersion');
        damaged('user text lost from CLAUDE.md', (r) => putFile(u17Project(r, 'CLAUDE.md'), CUR['CLAUDE.md'].replace(U17_USER_TAIL, '')), 'CLAUDE.md');
        damaged('a project extension rewritten', (r) => putFile(u17Project(r, U17_DS), `${U17_DOCS_RULES}extra\n`), U17_DS);
        damaged('the policy addition dropped', (r) => putFile(u17Project(r, U17_POLICY), '{"schema":2,"patterns":[],"projectPatterns":[]}\n'), 'the installed policy');
        damaged('a Claude wrapper customized', (r) => fs.appendFileSync(u17Project(r, '.claude/agents/reviewer.md'), 'x\n'), '.claude/agents/reviewer.md');
        const stale = { ...spec, version: BL.rc3.version };
        check(u17DeliveryIssues(root, stale, blocks).length > 0, 'control: an expectation carrying the baseline version fails against the delivered project');
      });

      // ================================= user edits need their own exact approvals (steps 3-4), and rollback (steps 9-10) =================================
      const editText = (t, id) => `${OLD[id][t]}${t.endsWith('.toml') ? '\n# project addition\n' : t.endsWith('.md') ? '\n- Project addition: also check the ledger invariants.\n' : '\n// project addition\n'}`;
      await step('rc.3 user edits: with an edited reviewer, an edited core and an edited review-diff (and a customized Codex wrapper kept out of the plan), no approval rejects exactly the three by name, approving one leaves two rejected, a wrong-path approval is refused as unrelated, the three exact approvals plan three user-content changes, a commit with another plan hash is refused with nothing written, the right plan hash commits, the customized wrapper keeps its bytes and record, and a clean rollback returns every edited byte and the manifest', async () => {
        const id = 'rc3';
        const E3 = [U17_REVIEWER, U17_CORE, U17_RDIFF];
        const edits = Object.fromEntries(E3.map((t) => [t, editText(t, id)]));
        const custom = `${OLD[id][U17_CODEX_REVIEWER]}\n# project wrapper note\n`;
        edits[U17_CODEX_REVIEWER] = custom;
        const { root, extensions } = project(id, { edits });
        const manifestBefore = readBytes(u17Project(root, U17_MANIFEST));
        if (!kit.begin(root, U17_RUN_A)) return;
        kit.stage(root, U17_RUN_A, drafts([U17_CODEX_REVIEWER]));
        const none = kit.prepare(root, U17_RUN_A);
        check(none.code === 3 && none.json && none.json.code === 'APPLY_PLAN_REJECTED' && E3.every((t) => u17Rejection(none, t) && u17Rejection(none, t).code === 'APPLY_APPROVAL_REQUIRED' && String(u17Rejection(none, t).error).startsWith(U17_APPROVAL_EDITED)) && none.json.errors.length === 3 && !exists(u17RunFile(root, U17_RUN_A, 'plan.json')), 'missing approval: exactly the three edited files are rejected by name and no plan is written', { code: none.code, errs: none.json && none.json.errors && none.json.errors.map((e) => [e.target, e.code]) });
        const one = kit.prepare(root, U17_RUN_A, [U17_REVIEWER]);
        const left = one.json && Array.isArray(one.json.errors) ? one.json.errors.map((e) => e.target).sort() : null;
        check(one.code === 3 && eq(left, E3.filter((t) => t !== U17_REVIEWER).sort()), 'approving the reviewer does not approve the core or review-diff', left);
        const wrong = kit.prepare(root, U17_RUN_A, [U17_DOCSYNC]);
        check(wrong.code === 3 && wrong.json && wrong.json.errors.some((x) => x.target === U17_DOCSYNC && /APPROVAL_UNRELATED/.test(String(x.code))) && E3.every((t) => u17Rejection(wrong, t) !== undefined), 'a wrong-path approval (an unmodified file) is refused as unrelated and approves none of the three', wrong.json && wrong.json.errors.map((e) => [e.target, e.code]));
        const p = kit.prepare(root, U17_RUN_A, E3);
        const opTargets = p.json && Array.isArray(p.json.ops) ? p.json.ops.map((o) => o.target).sort() : null;
        check(p.code === 0 && p.json && p.json.ok === true && eq(opTargets, E3.slice().sort()) && E3.every((t) => p.json.ops.find((o) => o.target === t && o.userContentChange === true)), 'the three exact approvals plan exactly the three replacements as user-content changes (the kept wrapper has no operation)', { code: p.code, ops: opTargets, out: p.stdout.slice(0, 260) });
        if (!(p.json && p.json.planSha256)) return;
        const bad = kit.commit(root, U17_RUN_A, U17_FLIP(p.json.planSha256));
        check(bad.code !== 0 && bad.json && bad.json.ok === false && E3.every((t) => readText(u17Project(root, t)) === edits[t]) && Buffer.compare(readBytes(u17Project(root, U17_MANIFEST)), manifestBefore) === 0, 'a commit that names another plan hash is refused and writes nothing', { code: bad.code, out: bad.stdout.slice(0, 240) });
        const c = kit.commit(root, U17_RUN_A, p.json.planSha256);
        check(c.code === 0 && c.json && c.json.committed === true, 'the exact plan hash commits', { code: c.code, out: c.stdout.slice(0, 240) });
        const over = { [U17_CODEX_REVIEWER]: custom };
        const spec = { ...specOf(id, over, extensions), records: { [U17_CODEX_REVIEWER]: { ownership: 'full', sha256: NH(OLD[id][U17_CODEX_REVIEWER]) } } };
        const issues = u17DeliveryIssues(root, spec, blocks);
        check(issues.length === 0, 'the three files hold the rc.4 text, the customized Codex wrapper keeps its bytes and its manifest record, the extensions and the policy are untouched', issues.slice(0, 5));
        const rb = kit.rollback(root, U17_RUN_A);
        check(rb.code === 0 && rb.json && rb.json.complete === true && E3.every((t) => readText(u17Project(root, t)) === edits[t]) && readText(u17Project(root, U17_CODEX_REVIEWER)) === custom && Buffer.compare(readBytes(u17Project(root, U17_MANIFEST)), manifestBefore) === 0, 'a clean rollback returns the edited bytes of the three files, leaves the customized wrapper and restores the manifest bytes', { code: rb.code, out: rb.stdout.slice(0, 200) });
      });
      for (const id of ['rc1', 'rc2']) {
        await step(`${id} user edits and recovery: an edited reviewer, an edited core and an edited Codex wrapper are rejected by name until each has its exact approval, the approved update commits, and after a later edit of the core a rollback is incomplete (exit 6), skips exactly that file, restores every other changed file to its edited or baseline bytes, keeps the unchanged outputs and the extensions, and retains the backup of the later edit`, async () => {
          const E3 = [U17_REVIEWER, U17_CORE, U17_CODEX_REVIEWER];
          const edits = Object.fromEntries(E3.map((t) => [t, editText(t, id)]));
          const { root, extensions } = project(id, { edits });
          const manifestBefore = readBytes(u17Project(root, U17_MANIFEST));
          const unchangedBefore = Object.fromEntries(U17_ALL.filter((t) => !U17_CHANGED[id].includes(t)).map((t) => [t, readBytes(u17Project(root, t))]));
          if (!kit.begin(root, U17_RUN_A)) return;
          kit.stage(root, U17_RUN_A, drafts());
          const none = kit.prepare(root, U17_RUN_A);
          check(none.code === 3 && none.json && none.json.code === 'APPLY_PLAN_REJECTED' && E3.every((t) => u17Rejection(none, t) && u17Rejection(none, t).code === 'APPLY_APPROVAL_REQUIRED' && String(u17Rejection(none, t).error).startsWith(U17_APPROVAL_EDITED)) && none.json.errors.length === 3 && !exists(u17RunFile(root, U17_RUN_A, 'plan.json')), `${id}: missing approval rejects exactly the three edited files by name and writes no plan`, { code: none.code, errs: none.json && none.json.errors && none.json.errors.map((e) => [e.target, e.code]) });
          const p = kit.prepare(root, U17_RUN_A, E3);
          check(p.code === 0 && p.json && p.json.ok === true && E3.every((t) => p.json.ops.find((o) => o.target === t && o.userContentChange === true)) && p.json.ops.length === U17_CHANGED[id].length, `${id}: the three exact approvals plan the replacements as user-content changes beside the unedited changed targets`, { code: p.code, out: p.stdout.slice(0, 260) });
          const c = p.json && p.json.planSha256 ? kit.commit(root, U17_RUN_A, p.json.planSha256) : null;
          const issues = c && c.code === 0 ? u17DeliveryIssues(root, specOf(id, {}, extensions), blocks) : ['the approved update did not commit'];
          check(issues.length === 0, `${id}: the approved update delivers the independently expected rc.4 state`, issues.slice(0, 5));
          fs.appendFileSync(u17Project(root, U17_CORE), '// later edit\n');
          const rb = kit.rollback(root, U17_RUN_A);
          const skipped = rb.json && Array.isArray(rb.json.skipped) ? rb.json.skipped.map((x) => x.target).sort() : null;
          check(rb.code === 6 && rb.json && rb.json.ok === false && eq(skipped, [U17_CORE]), `${id}: rollback is incomplete (exit 6) and skips exactly the later-edited core`, { code: rb.code, out: rb.stdout.slice(0, 400) });
          const restoredOk = U17_CHANGED[id].filter((t) => t !== U17_CORE).every((t) => readText(u17Project(root, t)) === (edits[t] !== undefined ? edits[t] : OLD[id][t]));
          check(readText(u17Project(root, U17_CORE)) === `${CUR[U17_CORE]}// later edit\n` && restoredOk && Buffer.compare(readBytes(u17Project(root, U17_MANIFEST)), manifestBefore) === 0 && Object.entries(unchangedBefore).every(([t, b]) => Buffer.compare(readBytes(u17Project(root, t)), b) === 0) && Object.entries(extensions).every(([t, text]) => readText(u17Project(root, t)) === text), `${id}: the later edit remains; every other changed file is back at its edited or baseline bytes; the manifest, the unchanged outputs and the extensions are untouched`);
          check(exists(path.join(root, '.ai', '.run', U17_RUN_A, 'vault', 'backup', '.ai', 'tools', 'git-safe-core.mjs')), `${id}: the backup of the later-edited core is retained for the user to resolve`);
        });
      }
      await step('rc.3 rollback conflict protection: after a normal update a later edit of the core makes the rollback incomplete (exit 6); it skips exactly that file, restores the reviewer and review-diff and the manifest, leaves every unchanged output and the extensions, and retains the backup', async () => {
        const id = 'rc3';
        const { root, extensions } = project(id);
        const manifestBefore = readBytes(u17Project(root, U17_MANIFEST));
        const unchangedBefore = Object.fromEntries(U17_ALL.filter((t) => !U17_CHANGED[id].includes(t)).map((t) => [t, readBytes(u17Project(root, t))]));
        if (!kit.begin(root, U17_RUN_A)) return;
        kit.stage(root, U17_RUN_A, drafts());
        const p = kit.prepare(root, U17_RUN_A);
        const c = p.json && p.json.planSha256 ? kit.commit(root, U17_RUN_A, p.json.planSha256) : null;
        check(c && c.code === 0, 'the update commits before the rollback', { code: p.code, out: p.stdout.slice(0, 200) });
        fs.appendFileSync(u17Project(root, U17_CORE), '// later edit\n');
        const rb = kit.rollback(root, U17_RUN_A);
        const skipped = rb.json && Array.isArray(rb.json.skipped) ? rb.json.skipped.map((x) => x.target).sort() : null;
        check(rb.code === 6 && rb.json && rb.json.ok === false && eq(skipped, [U17_CORE]), 'rollback is incomplete (exit 6) and skips exactly the later-edited core', { code: rb.code, out: rb.stdout.slice(0, 400) });
        check(readText(u17Project(root, U17_CORE)) === `${CUR[U17_CORE]}// later edit\n` && readText(u17Project(root, U17_REVIEWER)) === OLD.rc3[U17_REVIEWER] && readText(u17Project(root, U17_RDIFF)) === OLD.rc3[U17_RDIFF] && Buffer.compare(readBytes(u17Project(root, U17_MANIFEST)), manifestBefore) === 0 && Object.entries(unchangedBefore).every(([t, b]) => Buffer.compare(readBytes(u17Project(root, t)), b) === 0) && Object.entries(extensions).every(([t, text]) => readText(u17Project(root, t)) === text), 'the later edit remains; the reviewer and review-diff are back at the rc.3 bytes; the manifest, unchanged outputs and extensions are untouched');
        check(exists(path.join(root, '.ai', '.run', U17_RUN_A, 'vault', 'backup', '.ai', 'tools', 'git-safe-core.mjs')), 'the backup of the later-edited core is retained for the user to resolve');
      });

      // ================================= the runtime unit is staged whole (C17-15, F12) =================================
      await step('the unit is staged whole and a changed member cannot be declined: a plan that stages only the two changed runtime members, a plan that keeps the old core and a plan that keeps the old review-diff are each refused (exit nonzero, ok false) with nothing written and no plan file', async () => {
        const id = 'rc3';
        const { root } = project(id);
        const manifestBefore = readBytes(u17Project(root, U17_MANIFEST));
        const coreBefore = readBytes(u17Project(root, U17_CORE));
        if (!kit.begin(root, U17_RUN_A)) return;
        const refused = (label, p) => {
          check(p.code !== 0 && p.json && p.json.ok === false, `${label}: prepare refuses the incomplete or unreviewed runtime unit`, { code: p.code, out: p.stdout.slice(0, 300) });
          check(Buffer.compare(readBytes(u17Project(root, U17_MANIFEST)), manifestBefore) === 0 && Buffer.compare(readBytes(u17Project(root, U17_CORE)), coreBefore) === 0 && readText(u17Project(root, U17_RDIFF)) === OLD.rc3[U17_RDIFF] && !exists(u17RunFile(root, U17_RUN_A, 'plan.json')), `${label}: nothing was written and no plan exists`);
        };
        kit.stage(root, U17_RUN_A, { [U17_CORE]: CUR[U17_CORE], [U17_RDIFF]: CUR[U17_RDIFF] });
        refused('only the two changed members staged', kit.prepare(root, U17_RUN_A));
        const full = Object.fromEntries(U17_RUNTIME.map((m) => [`.ai/tools/${m}`, CUR[`.ai/tools/${m}`]]));
        kit.stage(root, U17_RUN_A, { ...full, [U17_CORE]: OLD.rc3[U17_CORE] });
        refused('the old core kept while review-diff is updated', kit.prepare(root, U17_RUN_A));
        kit.stage(root, U17_RUN_A, { ...full, [U17_RDIFF]: OLD.rc3[U17_RDIFF] });
        refused('the old review-diff kept while the core is updated', kit.prepare(root, U17_RUN_A));
      });
      let keptRoot = null;
      await step('keeping the old reviewer while installing head is an incomplete delivery (F12, asserted from installed bytes and manifest state only): with the complete unit staged and no reviewer draft, the rc.3 reviewer keeps its raw HEAD step and its manifest record, the unit is delivered, the installed core answers head, and the installed reviewer differs from the rc.4 text', async () => {
        const id = 'rc3';
        const { root } = project(id);
        if (!kit.begin(root, U17_RUN_A)) return;
        kit.stage(root, U17_RUN_A, Object.fromEntries(U17_RUNTIME.map((m) => [`.ai/tools/${m}`, CUR[`.ai/tools/${m}`]])));
        const p = kit.prepare(root, U17_RUN_A);
        const opTargets = p.json && Array.isArray(p.json.ops) ? p.json.ops.map((o) => o.target).sort() : null;
        check(p.code === 0 && p.json && p.json.ok === true && eq(opTargets, [U17_CORE, U17_RDIFF].sort()), 'the unit-only plan modifies exactly the core and review-diff', { code: p.code, ops: opTargets, out: p.stdout.slice(0, 220) });
        const c = p.json && p.json.planSha256 ? kit.commit(root, U17_RUN_A, p.json.planSha256) : null;
        check(c && c.code === 0 && c.json && c.json.committed === true, 'the unit-only update commits', c && c.stdout.slice(0, 200));
        const m = u17ManifestOf(root);
        check(readText(u17Project(root, U17_REVIEWER)) === OLD.rc3[U17_REVIEWER] && readText(u17Project(root, U17_REVIEWER)) !== EXP[U17_REVIEWER] && readText(u17Project(root, U17_REVIEWER)).includes('git rev-parse --verify HEAD') && !readText(u17Project(root, U17_REVIEWER)).includes('git-safe.mjs head'), 'the installed reviewer is still the rc.3 text with the raw HEAD step (D1 is not closed): it is not the rc.4 text');
        check(m && eq(m.files[U17_REVIEWER], { ownership: 'full', sha256: NH(OLD.rc3[U17_REVIEWER]) }) && eq(m.files[U17_CORE], { ownership: 'full', sha256: NH(EXP[U17_CORE]) }) && eq(m.files[U17_RDIFF], { ownership: 'full', sha256: NH(EXP[U17_RDIFF]) }) && m.skillVersion === U17_VERSION, 'the manifest still describes the old reviewer and records the new core and review-diff');
        expectNewHead(root, 'rc.3 reviewer with the rc.4 core');
        keptRoot = root;
      });
      await step('the opposite partial unit (F12): an rc.4 reviewer beside the pre-C17 core cannot resolve HEAD (the installed core answers GIT_SAFE_COMMAND with no output), which the rc.4 reviewer text turns into a stop; installed bytes and one real invocation', async () => {
        const id = 'rc3';
        const { root } = project(id, { over: { [U17_REVIEWER]: EXP[U17_REVIEWER] } });
        check(readText(u17Project(root, U17_REVIEWER)) === EXP[U17_REVIEWER] && readText(u17Project(root, U17_CORE)) === OLD.rc3[U17_CORE], 'premise: the project holds the rc.4 reviewer and the pre-C17 core');
        expectOldHead(root, 'rc.4 reviewer with the pre-C17 core');
        check(/you MUST stop and report the failure/.test(squash(EXP[U17_REVIEWER])) && /MUST NOT omit the comparison or substitute raw Git/.test(squash(EXP[U17_REVIEWER])), 'the rc.4 reviewer text stops and forbids omitting the comparison or substituting raw Git when identity cannot be established');
      });
    });
    flushProcessCount(context, 'V2/C17/update', mark);
  });
}

// ============================================ RC1/C17/release ====
// Plan C17-10, C17-14 (release row), C17-12, C17-13 and F7: rc.4 bookkeeping. VERSION is exactly 3.0.0-rc.4 plus LF; the changelog gains exactly the frozen rc.4 entry before the preserved rc.3-and-earlier suffix; RELEASE-NOTES-3.0.0-rc.4.md is exactly the frozen text; only
// current-candidate occurrences move to rc.4 in SKILL.md, the skill README, the root README and the project tree (the historical notes, the rc.3 observations and evaluation 36 keep rc.3); the earlier notes stay byte for byte; the installer, the release builder, the runtime
// catalog and the payload membership (60 files, seven runtime members) are unchanged; the real release builder, run on a synthetic repository with a synthetic rc.4 tag, produces the rc.4 archive and publication notes from the tagged blobs and refuses a tag whose notes are
// missing, whose VERSION is malformed or whose notes carry an object ID. Nothing here builds a real release, creates a real tag or touches an installed skill.
const RL_NOTES_REL = 'RELEASE-NOTES-3.0.0-rc.4.md';
const RL_SECTIONS = ['Changes', 'Compatibility and rollback', 'Verification', 'Pending host measurements', 'Limitations', 'Provenance and release artifacts'];
const RL_HEX_RE = /(?<![0-9a-f])(?:[0-9a-f]{64}|[0-9a-f]{40})(?![0-9a-f])/i;
const RL_LF_NOTES = C17_LITERALS.RELEASE_NOTES_TEXT;
const rlPins = () => new Map(C17_UNCHANGED_PINS);
async function release(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const fx = loadFixture(context);
    const text = (rel) => readText(skillPath(context, rel));
    await step('VERSION is exactly "3.0.0-rc.4" plus LF without a BOM (the pre-C17 entry is exactly "3.0.0-rc.3\\n" and reversing V17 gives it); no version.json stamp exists; the changelog is "# Changelog", the exact rc.4 entry, one blank line and the complete preserved rc.3, rc.2 and rc.1 entries and suffix (reversing LC17 gives the pre-C17 file byte for byte); the entry is ASCII within 100 columns and states its scope', async () => {
      const v = readBytes(skillPath(context, 'VERSION'));
      check(v !== null && v.toString('latin1') === '3.0.0-rc.4\n' && v[0] !== 0xef && v.length === 11, 'VERSION is exactly "3.0.0-rc.4\\n" (11 bytes, no BOM)', v && v.toString('latin1'));
      const pv = fx.files.VERSION;
      check(pv !== undefined && pv.toString('latin1') === '3.0.0-rc.3\n' && sha(pv) === PRE_PIN.VERSION && v !== null && reverseOne(v.toString('utf8'), AM17.V17) === '3.0.0-rc.3\n', 'the verified pre-C17 entry is "3.0.0-rc.3\\n" and reversing V17 gives it');
      check(!exists(skillPath(context, 'version.json')) && !exists(skillPath(context, 'install/version.json')) && !exists(skillPath(context, 'data/version.json')), 'no version.json stamp is introduced');
      const vr = checkAmendedFile(check, context, fx, 'VERSION');
      check(vr !== null && vr.text === '3.0.0-rc.4\n', 'the VERSION amendment reverses exactly (V17)');
      const c = checkAmendedFile(check, context, fx, 'CHANGELOG.md');
      if (c === null) return;
      const entry = T(C17_BLOCKS.CHANGELOG_ENTRY);
      check(c.text.startsWith(`# Changelog\n\n${entry}\n## 3.0.0-rc.3\n`) && COUNT(c.text, '\n## 3.0.0-rc.4\n') === 1 && COUNT(c.text, '\n## 3.0.0-rc.3\n') === 1 && COUNT(c.text, '\n## 3.0.0-rc.2\n') === 1 && COUNT(c.text, '\n## 3.0.0-rc.1\n') === 1, 'the rc.4 entry is first and stands once, directly before the preserved rc.3 entry, and each earlier candidate entry stands once', c.text.slice(0, 120));
      check(c.reversed !== null && sha(Buffer.from(c.reversed, 'utf8')) === PRE_PIN['CHANGELOG.md'] && c.reversed.startsWith('# Changelog\n\n## 3.0.0-rc.3\n'), 'reversing LC17 gives the pre-C17 changelog whose first entry is rc.3 (the entire rc.3-and-earlier suffix is preserved)');
      const s = squash(C17_BLOCKS.CHANGELOG_ENTRY.join(' '));
      for (const w of ['git-safe head resolves checkout HEAD without a raw-Git exception.', 'The reviewer still stops when identity cannot be established and evaluates the existing equal-head warning.', 'Git\'s recognized dubious-ownership refusal now returns GIT_SAFE_OWNERSHIP with a fixed remedy.', 'Environment-injected configuration remains stripped.', 'R83-e and A3/L10 passed on rc.3; final 3.0.0 requires the rc.4 host measurements.', 'Manifest schema 3, policy schemas, approval and rollback behavior remain unchanged.', 'Publication remains a separate authorized action.']) check(squash(c.text).includes(w), `the changelog states: ${clip(w)}`);
      check(C17_BLOCKS.CHANGELOG_ENTRY.every((l) => l.length <= 100 && !/[^\x00-\x7f]/.test(l)) && s.length > 0, 'the frozen entry lines are ASCII within 100 columns');
      const issues = newProseIssues(c.text, preText(fx, 'CHANGELOG.md') || '');
      check(issues.length === 0, 'every newly written line of the changelog is ASCII and at most 100 columns', issues.slice(0, 4));
      amendmentControls(check, 'CHANGELOG LC17', applyForFile(preText(fx, 'CHANGELOG.md'), 'CHANGELOG.md') || '', AM17.LC17, { otherFileText: text('SKILL.md') || '' });
    });
    await step('the rc.4 release notes are exactly the frozen text (ASCII, LF, one final LF, lines within 100 columns), carry no resolved identity, state the compatibility and rollback, the verification totals, the pending measurements and the limitations in the frozen order, and make no publication claim; the earlier notes (rc.3, rc.2, rc.1 and 2.0.0) are byte for byte what they were', async () => {
      const raw = readBytes(skillPath(context, RL_NOTES_REL));
      check(raw !== null && raw.toString('utf8') === RL_LF_NOTES && Buffer.compare(raw, Buffer.from(RL_LF_NOTES, 'utf8')) === 0, 'RELEASE-NOTES-3.0.0-rc.4.md equals the plan text byte for byte', raw && raw.toString('utf8').slice(0, 100));
      check(raw !== null && !/[^\x00-\x7f]/.test(raw.toString('latin1')) && !raw.includes(0x0d) && raw[0] !== 0xef && raw[raw.length - 1] === 0x0a && raw[raw.length - 2] !== 0x0a, 'the notes are ASCII, UTF-8 without BOM, LF only, with exactly one final LF');
      check(C17_BLOCKS.RELEASE_NOTES.every((l) => l.length <= 100), 'no frozen notes line exceeds 100 columns');
      check(!RL_HEX_RE.test(RL_LF_NOTES), 'the notes carry no standalone 40- or 64-hex ID (no resolved identity or digest in tree)');
      check(!/\b(published|released to|uploaded)\b/i.test(RL_LF_NOTES), 'the notes make no publication claim');
      check(eq(headingsOf(RL_LF_NOTES).map((h) => h.replace(/^## /, '')).slice(1), RL_SECTIONS) && headingsOf(RL_LF_NOTES)[0] === '# project-setup 3.0.0-rc.4', 'the notes have the frozen title and the six sections in order', headingsOf(RL_LF_NOTES));
      const ver = squash(sectionOf(RL_LF_NOTES, '## Verification') || '');
      check(ver.includes('Required totals are 100 PASS / 0 FAIL / 0 SKIP, or 99 PASS / 0 FAIL / 1 SKIP with only the recorded Windows R13d file-symlink privilege exception. No rc.1 case may skip. R91 must retain real Windows junction coverage.') && ver.includes('C17 contributes through R29 without adding numbered case records.'), 'the verification totals, the no-skip rule and the single R29 contribution are exact');
      const pend = squash(sectionOf(RL_LF_NOTES, '## Pending host measurements') || '');
      check(pend.includes('Claude Code 2.1.311 is a new measurement scope. Record actual versions again.') && pend.includes('These measurements block final 3.0.0, not rc.4 implementation acceptance.') && pend.includes('The granted case must resolve HEAD and complete the selected review.'), 'the pending measurements and their scope are exact');
      const lim = squash(sectionOf(RL_LF_NOTES, '## Limitations') || '');
      check(lim.includes('Ownership recognition requires the exact English fatal prefix at the start of stderr.') && lim.includes('An exact safe.directory entry does not narrow an existing wildcard entry.') && lim.includes('R83-e passed by instruction and both Codex L10 reviews'), 'the limitations name the exact-prefix recognition, the unchanged wildcard breadth and the rc.3 results');
      const pins = rlPins();
      for (const rel of ['RELEASE-NOTES-3.0.0-rc.3.md', 'RELEASE-NOTES-3.0.0-rc.2.md', 'RELEASE-NOTES-3.0.0-rc.1.md', 'RELEASE-NOTES-2.0.0.md']) { const b = readBytes(skillPath(context, rel)); check(b !== null && pins.has(rel) && sha(b) === pins.get(rel), `${rel} is byte for byte the preserved historical notes`, b && sha(b)); }
      check(sha(Buffer.from(RL_LF_NOTES, 'utf8')) !== pins.get('RELEASE-NOTES-3.0.0-rc.3.md'), 'the rc.4 notes are a new text, not a copy of the rc.3 notes');
    });
    await step('only current-candidate occurrences moved to rc.4: SKILL.md line 6 and its helper-table cell, the skill README opening block, the S07 sentence and the release command (both tag occurrences), the root README (the version, both note references and the tree line) and the project tree (both version tokens and the final-release sentence); the historical rc.3 observations, notes and evaluation 36 keep rc.3, and every amended file reverses exactly to its pre-C17 bytes', async () => {
      const skill = checkAmendedFile(check, context, fx, 'SKILL.md');
      const readme = checkAmendedFile(check, context, fx, 'README.md');
      const rootReadme = checkAmendedFile(check, context, fx, '@root/README.md');
      const tree = checkAmendedFile(check, context, fx, '@root/.ai/context/project-tree.md');
      if (skill === null || readme === null || rootReadme === null || tree === null) return;
      check(skill.text.split('\n')[5] === '# project-setup 3.0.0-rc.4' && COUNT(skill.text, '# project-setup 3.0.0-rc.3') === 0 && skill.text.includes(`| \`assets/tools/git-safe.mjs\` | ${C17_LITERALS.S17_NEW_CELL} |`), 'SKILL.md: line 6 is the rc.4 heading and the helper-table purpose cell is the frozen text with its backticks (F7)', skill.text.split('\n')[5]);
      check(readme.text.startsWith(`${T(C17_BLOCKS.RM_OPEN_NEW)}\nSecret-path controls are tool-level`) && COUNT(readme.text, 'node install/release.mjs --tag project-setup-v3.0.0-rc.4 --out <unused-directory>') === 1 && COUNT(readme.text, 'It never\nrequires or creates project-setup-v3.0.0-rc.4 in the distribution repository.') === 1 && COUNT(readme.text, 'project-setup-v3.0.0-rc.3') === 0, 'README: the opening block, the S07 sentence and the release command name rc.4 and no rc.3 tag remains');
      check(readme.text.split('\n')[0] === '# project-setup 3.0.0-rc.4 - skill source' && readme.text.includes('**Release candidate 3.0.0-rc.4.** See RELEASE-NOTES-3.0.0-rc.4.md for compatibility,') && readme.text.includes('acceptance requirements and the remaining reviewer HEAD and Git ownership host measurements.'), 'README: the heading and the release paragraph are the frozen rc.4 text');
      const rr = squash(rootReadme.text);
      check(rr.includes('`project-setup` (3.0.0-rc.4, a release candidate, shared by Claude Code and Codex) is **not**') && COUNT(rr, 'project-setup/RELEASE-NOTES-3.0.0-rc.4.md`') === 2 && rr.includes('(3.0.0-rc.4, own installer and tests)') && COUNT(rr, '3.0.0-rc.3') === 0 && !/after rc\.3/.test(rr), 'root README: the version, both note references and the tree line name rc.4 and no rc.3 current-candidate reference remains (PLAN-GAP: the tree line, which F7 does not list by line, moves with the others)');
      check(rr.includes(squash(T(C17_BLOCKS.ROOT_README_NEW))) && rr.includes('Final 3.0.0 requires the rc.4 reviewer HEAD and Git ownership measurements. R83-e and A3/L10 passed on rc.3; their recorded limitations remain in the rc.4 notes.') && !rr.includes('must pass re-measurement after rc.3'), 'root README: the two pending-host sentences are replaced by the frozen text');
      const tr = squash(tree.text);
      check(tr.includes('skill 3 \u2014 shared Claude Code + Codex agent scaffolding (3.0.0-rc.4)') && tr.includes('(`project-setup/VERSION` is `3.0.0-rc.4`)') && tr.includes(squash(T(C17_BLOCKS.ROOT_TREE_NEW))) && COUNT(tr, '3.0.0-rc.3') === 0 && COUNT(tr, 'RELEASE-NOTES-3.0.0-rc.4.md') === 1, 'project tree: both version tokens and the final-release paragraph are the frozen rc.4 text, with no rc.3 token left');
      check(C17_BLOCKS.RM_OPEN_NEW.length === 4 && C17_BLOCKS.RM_OPEN_NEW[0] === '# project-setup 3.0.0-rc.4 - skill source' && C17_BLOCKS.RM_OPEN_OLD.length === 4 && C17_BLOCKS.RM_OPEN_OLD[0] === '# project-setup 3.0.0-rc.3 - skill source', 'the replaced README block is the four-line C16 block, not three lines (F7)');
      // evaluation 36 retains rc.3 (the historical evaluation text)
      const evalsRaw = readText(skillPath(context, 'evals/evals.json'));
      let evals = null; try { evals = JSON.parse(evalsRaw).evals; } catch { evals = null; }
      check(evals !== null && evals.length === 39 && /rc3-measurement-and-update-boundaries/.test(evals[35].name) && /rc\.3/.test(evals[35].prompt), 'evaluation 36 keeps its rc.3 text', evals && evals[35] && evals[35].name);
      const docs = { 'SKILL.md': skill.text, 'README.md': readme.text, 'references/claude.md': text('references/claude.md') || '', 'references/codex.md': text('references/codex.md') || '' };
      check(Object.entries(docs).every(([rel, t]) => (rel === 'SKILL.md' ? COUNT(t, '3.0.0-rc.3') === 0 : true)), 'SKILL.md carries no rc.3 text');
    });
    await step('retained identities: the installer, the release builder, the runtime catalog (seven members in order, same targets) and the other production files C17 leaves alone are byte for byte their pre-C17 bytes; the payload inventory is still exactly the 60 members without notes, tests or helpers, the rc.4 notes are listed as absent from the payload, and the earlier tests carry the rc.4 current literals', async () => {
      const pins = rlPins();
      for (const rel of ['install/install.mjs', 'install/release.mjs', 'data/runtime-units.json']) { const b = readBytes(skillPath(context, rel)); check(b !== null && pins.has(rel) && sha(b) === pins.get(rel), `${rel} is byte for byte unchanged`, b && sha(b)); }
      const catalog = readJson(skillPath(context, 'data/runtime-units.json'));
      const members = ['security-policy.mjs', 'git-safe-core.mjs', 'guard-raw-git-core.mjs', 'review-diff.mjs', 'git-safe.mjs', 'guard-raw-git.mjs', 'hooks-selftest.mjs'];
      check(catalog && Array.isArray(catalog.units) && eq(catalog.units.map((u) => path.posix.basename(u.source)), members) && catalog.units.every((u) => u.target === `.ai/tools/${path.posix.basename(u.source)}`), 'the seven runtime members stay in order with their targets');
      const c11b = text('tests/c11b.test.mjs') || '';
      const inventory = between(c11b, 'const PAYLOAD_INVENTORY = [', '\n];');
      const entries = inventory === null ? [] : inventory.split('\n').filter((l) => /^\s*"/.test(l));
      check(entries.length === 60 && new Set(entries).size === 60 && !entries.some((e) => /RELEASE-NOTES|tests\/|evals\/|\.project\.md|prose-check|c1[3-7]/.test(e)) && c11b.includes('PAYLOAD_INVENTORY.length === 60'), 'the payload inventory is still exactly the 60 members (no notes, tests, helper, evaluation or extension)', entries.length);
      const absent = between(c11b, 'const PAYLOAD_ABSENT = [', '\n];') || '';
      for (const n of ['2.0.0', '3.0.0-rc.1', '3.0.0-rc.2', '3.0.0-rc.3', '3.0.0-rc.4']) check(absent.includes(`"RELEASE-NOTES-${n}.md"`), `PAYLOAD_ABSENT lists RELEASE-NOTES-${n}.md`);
      check(c11b.includes("const CANDIDATE_VERSION = '3.0.0-rc.4';") && !c11b.includes("const CANDIDATE_VERSION = '3.0.0-rc.3';") && c11b.includes("['3.0.0-rc.1', '3.0.0-rc.2', '3.0.0-rc.3', '3.0.0-rc.4', '3.0.0', '4.2.1-rc.12']"), 'C11b carries the rc.4 candidate version and keeps the earlier candidates in its valid-version matrix');
      const arr = (name) => { const b = between(c11b, `const ${name} = [`, '\n];'); if (b === null) return null; try { return JSON.parse(`[${b.trim().replace(/,\s*$/, '')}]`); } catch { return null; } };
      const notesCur = arr('RELEASE_NOTES_LINES'); const logCur = arr('CHANGELOG_ENTRY_LINES'); const notes3 = arr('RC3_RELEASE_NOTES_LINES'); const log3 = arr('RC3_CHANGELOG_ENTRY_LINES');
      check(notesCur !== null && eq(notesCur, [...C17_BLOCKS.RELEASE_NOTES]), 'C11b holds the exact rc.4 notes as its current release-note array', notesCur && notesCur.length);
      check(logCur !== null && eq(logCur, [...C17_BLOCKS.CHANGELOG_ENTRY, '']), 'C11b holds the exact rc.4 changelog entry plus its separating blank line as its current array', logCur && logCur.length);
      check(notes3 !== null && notes3.join('\n').startsWith('# project-setup 3.0.0-rc.3\n') && log3 !== null && log3[0] === '## 3.0.0-rc.3', 'C11b keeps the rc.3 notes and changelog arrays under their historical names (RC3_*)');
      const c12 = text('tests/c12.test.mjs') || '';
      check(c12.includes("'3.0.0-rc.4\\n'") && !c12.includes("=== '3.0.0-rc.3\\n'"), 'C12 asserts the current VERSION rc.4');
      check(exists(skillPath(context, 'tests/c17.test.mjs')) && exists(skillPath(context, 'tests/helpers/c17-amendments.mjs')) && exists(skillPath(context, 'tests/fixtures/c17-prechange.json')) && exists(skillPath(context, 'tests/fixtures/c17-upgrade-baselines.json')), 'the new test-only files exist under tests/ (outside the payload)');
    });
    await step('synthetic rc.4 release behavior with the real builder (install/release.mjs, run in process on a synthetic repository with a synthetic tag): the tagged VERSION and notes blobs give the release version, the archive is the tagged project-setup tree, the publication notes carry the identity header and the unchanged tagged notes; a missing notes blob, a VERSION without its LF, an unknown tag and notes that carry an object ID are each refused with one code line and no output directory', async () => {
      const rel = await importOrFail(failures, pathToFileURL(skillPath(context, 'install/release.mjs')).href, 'install/release.mjs');
      if (!rel) return;
      await withScratch(context, 'release', async (dir) => {
        const repo = path.join(dir, 'repo');
        const env = { ...context.env, GIT_AUTHOR_DATE: '2026-10-27T12:00:00Z', GIT_COMMITTER_DATE: '2026-10-27T12:00:00Z', GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
        fs.mkdirSync(repo, { recursive: true });
        gitOk(context, repo, ['init', '-q'], { env });
        const notesBytes = Buffer.from(RL_LF_NOTES, 'utf8');
        const versionBytes = readBytes(skillPath(context, 'VERSION'));
        const commit = (label, files) => {
          for (const [relp, data] of Object.entries(files)) { if (data === null) rmrf(path.join(repo, ...relp.split('/'))); else putFile(path.join(repo, ...relp.split('/')), data); }
          gitOk(context, repo, ['add', '-A'], { env }); gitOk(context, repo, ['commit', '-q', '-m', label], { env });
          return gitOk(context, repo, ['rev-parse', 'HEAD'], { env }).stdout;
        };
        const tag = (name, id) => gitOk(context, repo, ['tag', name, id], { env });
        const good = commit('good', { 'project-setup/VERSION': versionBytes, [`project-setup/${RL_NOTES_REL}`]: notesBytes, 'project-setup/SKILL.md': '# synthetic skill\n' });
        tag('project-setup-v3.0.0-rc.4', good);
        const noNotes = commit('no notes', { [`project-setup/${RL_NOTES_REL}`]: null });
        tag('c17-no-notes', noNotes);
        const noLf = commit('no LF', { 'project-setup/VERSION': Buffer.from('3.0.0-rc.4'), [`project-setup/${RL_NOTES_REL}`]: notesBytes });
        tag('c17-no-lf', noLf);
        const hexNotes = commit('hex id in notes', { 'project-setup/VERSION': versionBytes, [`project-setup/${RL_NOTES_REL}`]: Buffer.from(`${RL_LF_NOTES}\nSee ${'ab'.repeat(20)} for details.\n`, 'utf8') });
        tag('c17-hex-notes', hexNotes);
        const repoReal = fs.realpathSync.native(repo);
        // The builder runs up to seven Git children (top level, commit, tree, type, version, notes, archive); a refused build stops earlier, so each call is counted by the stage it can reach.
        const build = async (tagName, outName, children = 7) => { countProcess(context, children); return rel.main(['--tag', tagName, '--out', path.join(dir, outName)], { repository: repoReal, cwd: repoReal, env }); };
        const ok = await build('project-setup-v3.0.0-rc.4', 'out-good');
        check(ok.exitCode === 0 && ok.stderr === '' && ok.stdout.startsWith('RELEASE  OK  3.0.0-rc.4\nTAG  project-setup-v3.0.0-rc.4\n'), 'the synthetic rc.4 tag builds: RELEASE  OK  3.0.0-rc.4', { code: ok.exitCode, out: ok.stdout.slice(0, 160), err: ok.stderr.slice(0, 160) });
        const zip = path.join(dir, 'out-good', 'project-setup-3.0.0-rc.4.zip'); const pub = path.join(dir, 'out-good', 'RELEASE-NOTES.md');
        const zipBytes = readBytes(zip); const pubBytes = readBytes(pub);
        check(zipBytes !== null && zipBytes.length > 4 && zipBytes[0] === 0x50 && zipBytes[1] === 0x4b && ok.stdout.includes(`SHA256  ${sha(zipBytes)}`) && ok.stdout.includes(`COMMIT  ${good}`), 'the archive is named for the release version and the printed identities are the tagged commit and the archive digest', ok.stdout.slice(0, 400));
        const tree = gitIn(context, repo, ['rev-parse', `${good}:project-setup`], { env }).stdout;
        check(pubBytes !== null && pubBytes.toString('utf8').startsWith(`# project-setup 3.0.0-rc.4 publication notes\n\nTag: project-setup-v3.0.0-rc.4\nCommit: ${good}\nProject-setup tree: ${tree}\nArchive: project-setup-3.0.0-rc.4.zip\nArchive SHA256: ${sha(zipBytes || Buffer.alloc(0))}\n\n`) && pubBytes.subarray(pubBytes.length - notesBytes.length).equals(notesBytes), 'the publication notes are the identity header followed by the unchanged tagged rc.4 notes bytes', pubBytes && pubBytes.toString('utf8').slice(0, 200));
        check(ok.stdout.endsWith('PUBLICATION  pending\n'), 'the builder reports publication as pending (it never publishes)');
        for (const [label, name, want] of [['a tag whose rc.4 notes blob is missing', 'c17-no-notes', 'RELEASE_NOTES'], ['a VERSION without its LF', 'c17-no-lf', 'RELEASE_VERSION'], ['notes that carry a 40-hex object ID', 'c17-hex-notes', 'RELEASE_NOTES'], ['an unknown tag', 'project-setup-v9.9.9', 'RELEASE_TAG']]) {
          const out = `out-${name}`;
          const r = await build(name, out, { 'c17-no-notes': 6, 'c17-no-lf': 5, 'c17-hex-notes': 6 }[name] || 2);
          check(r.exitCode === 2 && r.stdout === '' && r.stderr.startsWith(`${want}: `) && r.stderr.endsWith('\n') && r.stderr.split('\n').length === 2 && !exists(path.join(dir, out)), `${label}: exit 2, one ${want} line, empty stdout and no output directory`, { code: r.exitCode, err: r.stderr.slice(0, 160), out: r.stdout.slice(0, 80) });
        }
        const again = await build('project-setup-v3.0.0-rc.4', 'out-good');
        check(again.exitCode === 2 && again.stderr.startsWith('RELEASE_OUT_EXISTS: ') && readBytes(zip) !== null && sha(readBytes(zip)) === sha(zipBytes), 'an existing output directory is refused and the first build is untouched');
        const tags = gitIn(context, repo, ['tag', '--list'], { env }).stdout.split('\n').filter(Boolean).sort();
        check(eq(tags, ['c17-hex-notes', 'c17-no-lf', 'c17-no-notes', 'project-setup-v3.0.0-rc.4']), 'the builder created and moved no tag', tags);
      });
    });
    flushProcessCount(context, 'RC1/C17/release', mark);
  });
}

// ============================================ V2/C17/preservation ====
// Plan C17-5, C17-11, C17-12, C17-13, C17-14 (preservation row), C17-18, F1, F7 and F8: every exact C17 amendment is verified once at its stated anchor and reversed, and the reversal must give the pinned pre-C17 bytes (so nothing else changed); a missing, duplicated,
// moved, altered or differently spaced amendment, and the same amendment looked for in another file, fails before any historical hashing. The core has no exact amendment (PLAN-GAP: the plan freezes its behavior, not its hunks): its pre-C17 view is the committed fixture entry
// with the plan's raw SHA-256, and the regions the plan says stay unchanged are compared with it instead. The root TODO.md chain is: actual TODO -> exact C17 blocker reversal -> the pre-C17 TODO hash -> the existing C16 reversal -> H8D85 -> the C14 T chain (the last two
// are checked by C14 and C16 on this view). The C16 records, the six v2 snapshots, the baseline checker and every file C17-4 lists as byte-identical keep their raw SHA-256 values from the inspected commit.
const PV_TODO_NEEDS = '## Needs manual review\n';
function pvNormalizeTodo(text) {
  const r17 = reverseTodoC17(text);
  if (r17 === null) return { ok: false, why: 'the exact C17 blocker replacement does not stand once at its anchor' };
  if (sha(Buffer.from(r17, 'utf8')) !== TODO_PRE_C17_HASH) return { ok: false, why: 'the C17-reversed TODO is not the pre-C17 TODO (ebf6df3a...)' };
  const c16 = reverseTodoC16(r17);
  if (c16.text === null) return { ok: false, why: `C16 reversal: ${c16.failed}`, state: c16.state };
  if (sha(Buffer.from(c16.text, 'utf8')) !== TODO_HASHES.head) return { ok: false, why: 'the C16-reversed TODO is not the inspected C16 HEAD bytes (28b4fd4f...)', state: c16.state };
  const h = reverseOne(c16.text, H8D85);
  if (h === null) return { ok: false, why: 'H8D85 does not stand exactly once between its anchors', state: c16.state };
  if (sha(Buffer.from(h, 'utf8')) !== TODO_HASHES.pre8d85ec6) return { ok: false, why: 'the H8D85-reversed TODO is not the 8d85ec6^ bytes (6676d1c9...)', state: c16.state };
  return { ok: true, state: c16.state, preC17: r17, head: c16.text, text: h };
}
// Failure controls for a token replacement (an amendment whose anchors are empty or only a neighbor line): it is rejected when missing, doubled, altered, restored to the old text beside the new one, or written with CRLF.
function pvTokenControls(check, label, model, a) {
  const base = LF(model);
  check(amendmentOnce(base, a) && reverseOne(base, a) !== null, `${label}: control baseline: the model carries the replacement exactly once`);
  const without = reverseOne(base, a);
  if (without === null) return;
  const rejected = (name, text) => check(!amendmentOnce(text, a) && reverseOne(text, a) === null, `${label}: ${name} is rejected before any historical comparison`);
  rejected('missing: the old text', without);
  rejected('duplicate: the new text twice', base.replace(a.neu, () => a.neu + a.neu));
  rejected('duplicate: the new text again at the end of the file', base + a.neu);
  rejected('altered: one character changed', base.replace(a.neu, () => `${a.neu.slice(0, 2)}${a.neu[2] === 'z' ? 'y' : 'z'}${a.neu.slice(3)}`));
  rejected('altered: the version token left at rc.3 beside it', base.replace(a.neu, () => a.neu.replace('rc.4', 'rc.3')));
  rejected('CRLF: the same text with CRLF line ends', base.replace(/\n/g, '\r\n'));
}
const PV_CORE_PRE_REL = 'assets/tools/git-safe-core.mjs';
async function preservation(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const fx = loadFixture(context);
    const text = (rel) => readText(skillPath(context, rel));
    await step('the pre-C17 fixture (tests/fixtures/c17-prechange.json) is test-only comparison data: its raw SHA-256 and byte count are pinned, it is exactly JSON.stringify(value, null, 2) plus one LF with the key order schema, sourceCommit, entries (the inspected commit eac5b07), it holds the thirteen plan files in the plan order with canonical base64 whose SHA-256 equals both the entry digest and the plan\'s pin, every skill path carries the project-setup/ prefix and the three root paths do not, no production script reads it, and the three plan-stated hashes (core, review-diff, reviewer) are those of the inspected bytes', async () => {
      const raw = readBytes(skillPath(context, FIXTURE_REL));
      check(raw !== null && sha(raw) === FIXTURE_RAW_SHA && raw.length === FIXTURE_FILE_BYTES, 'the fixture file hashes to the pinned raw SHA-256 and byte count', raw && { sha: sha(raw), len: raw.length });
      const doc = readJson(skillPath(context, FIXTURE_REL));
      check(doc !== null && raw !== null && raw.toString('utf8') === jsonText(doc) && !raw.includes(0x0d), 'the file is exactly JSON.stringify(value, null, 2) plus one LF (no CR)');
      check(doc !== null && eq(Object.keys(doc), ['schema', 'sourceCommit', 'entries']) && doc.schema === 1 && doc.sourceCommit === FIXTURE_SOURCE_COMMIT, 'the fixture has exactly schema 1 and the inspected commit in key order', doc && Object.keys(doc));
      const entries = doc && Array.isArray(doc.entries) ? doc.entries : [];
      check(entries.length === 13 && eq(entries.map((e) => e.path), PRE_C17.map(([rel]) => fixturePathOf(rel))) && entries.every((e) => eq(Object.keys(e), ['path', 'base64', 'sha256'])), 'the entries are the thirteen plan files in the plan order, each with path, base64 and sha256 in that order', entries.map((e) => e.path));
      check(entries.filter((e) => e.path.startsWith('project-setup/')).length === 10 && entries.filter((e) => !e.path.startsWith('project-setup/')).map((e) => e.path).join('|') === 'README.md|.ai/context/project-tree.md|TODO.md', 'ten paths carry the project-setup/ prefix and the three root paths do not');
      for (const e of entries) {
        const b = Buffer.from(e.base64, 'base64');
        const rel = e.path.startsWith('project-setup/') ? e.path.slice('project-setup/'.length) : `@root/${e.path}`;
        check(b.toString('base64') === e.base64 && sha(b) === e.sha256 && e.sha256 === PRE_PIN[rel], `${e.path}: canonical base64 whose SHA-256 equals the entry digest and the plan's pin`, sha(b));
        check(byteConvention(b) === null, `${e.path}: the pre-change bytes keep LF, no BOM and one final LF (not normalized)`, byteConvention(b));
      }
      check(PRE_PIN[PV_CORE_PRE_REL] === 'ad1c51db23444c022dcb4eca06d0b3fd52984cb1bf3230596a840f34203b5f85' && PRE_PIN['assets/tools/review-diff.mjs'] === 'ae236ae32405497d5c9bb2340a5cebbe45d37b1c6d50367b478523cf7de06d83' && PRE_PIN['assets/agents/reviewer.md'] === C17_LITERALS.SOURCE_REVIEWER_PRE_C17 && PRE_PIN['@root/TODO.md'] === TODO_PRE_C17_HASH, 'the plan-stated pre-C17 hashes (core, review-diff, source reviewer, TODO) are the pins used here');
      const scripts = ['apply', 'check-agent-baselines', 'validate', 'doctor', 'detect', 'blocks', 'lib', 'ownership'].map((n) => readText(skillPath(context, `scripts/${n}.mjs`)) || '');
      check(scripts.every((t) => !t.includes('c17-prechange') && !t.includes('c17-upgrade-baselines')), 'no production script reads a C17 fixture');
      check(eq(PRE_C17.map(([rel]) => rel), PRE_C17_FILES.map((p) => (p.startsWith('project-setup/') ? p.slice('project-setup/'.length) : `@root/${p}`))), 'the helper and this test list the same thirteen files in the same order');
    });
    await step('every file C17 amends reverses exactly to its pinned pre-C17 bytes: the eleven files with exact amendments (the byte convention, each amendment once at its anchor checked at its turn, the reversal in reverse order equal to the plan\'s raw SHA-256) and the core, whose pre-C17 view is the fixture entry; the three runtime identities that move (core, review-diff, reviewer) differ from their pre-C17 hashes', async () => {
      for (const rel of AMENDED_FILES17) {
        const r = checkAmendedFile(check, context, fx, rel);
        check(r !== null && r.reversed !== null && r.text !== r.reversed, `${rel}: the amendments are installed (the current text differs from its pre-C17 view)`);
      }
      const coreFx = fx.files[PV_CORE_PRE_REL];
      check(coreFx !== undefined && sha(coreFx) === PRE_PIN[PV_CORE_PRE_REL], 'git-safe-core.mjs: the fixture entry is the pre-C17 core (raw SHA-256 ad1c51db... of plan C17-12)');
      const coreNow = readBytes(skillPath(context, PV_CORE_PRE_REL));
      check(coreNow !== null && sha(coreNow) !== PRE_PIN[PV_CORE_PRE_REL] && byteConvention(coreNow) === null, 'git-safe-core.mjs: C17 changed the core (its raw SHA-256 moved from ad1c51db...) and it keeps the C17-5 byte convention', coreNow && sha(coreNow));
      const rd = readBytes(skillPath(context, 'assets/tools/review-diff.mjs'));
      check(rd !== null && sha(rd) !== PRE_PIN['assets/tools/review-diff.mjs'] && reverseOne(rd.toString('utf8'), AM17.RD17) === (fx.files['assets/tools/review-diff.mjs'] || Buffer.alloc(0)).toString('utf8'), 'review-diff.mjs moved only through its one exact amendment (the command-list diagnostic): reversing RD17 gives the pre-C17 bytes');
      const rv = readBytes(skillPath(context, 'assets/agents/reviewer.md'));
      check(rv !== null && sha(rv) !== PRE_PIN['assets/agents/reviewer.md'], 'the source reviewer identity moved from d3d56613...', rv && sha(rv));
      check(AMENDED_FILES17.length === 11 && eq([...AMENDED_FILES17].sort(), PRE_C17.map(([rel]) => rel).filter((rel) => rel !== PV_CORE_PRE_REL && rel !== '@root/TODO.md').sort()), 'the eleven amended files plus the core and the TODO are the thirteen fixture files', AMENDED_FILES17);
    });
    await step('the regions of the core that the plan says stay unchanged are byte-identical to the pre-C17 core (the fixed prefix, the output bound, the argument bound and the object-ID and empty-tree constants, and the C16 grep empty-tree probe block with its -E vector), so only the head form, the ownership classification and their messages changed', async () => {
      const pre = preText(fx, PV_CORE_PRE_REL) || '';
      const cur = text(PV_CORE_PRE_REL) || '';
      const region = (t, a, b) => between(t, a, b);
      const prefixFn = (t) => { const i = t.indexOf('function prefixFor(nullDevice) {'); const j = i < 0 ? -1 : t.indexOf('\n}\n', i); return i < 0 || j < 0 ? null : t.slice(i, j + 3); };
      check(prefixFn(pre) !== null && prefixFn(cur) === prefixFn(pre), 'the fixed prefix function (the twenty -c settings and --no-pager) is unchanged');
      for (const line of ['export const MAX_OUTPUT_BYTES = 1048576;', 'export const MAX_GIT_ARG_UNITS = 24000;', 'const OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;', "const OID_LINE = /^([0-9a-f]{40}|[0-9a-f]{64})\\r?\\n$/;"]) check(pre.includes(line) && cur.includes(line), `the core still carries ${show(line, 80)}`);
      for (const id of ['G16c', 'G16d', 'G16e']) check(COUNT(pre, AM16[id].neu) === 1 && COUNT(cur, AM16[id].neu) === 1, `the C16 hunk ${id} (the empty-tree probe, its classification and the -E vector) stands once in the pre-C17 and in the current core, verbatim`);
      check(region(pre, '// ----------------------------------------------------------- environment ----\n', '// ---------------------------------------------------------------- grammar ----\n') === region(cur, '// ----------------------------------------------------------- environment ----\n', '// ---------------------------------------------------------------- grammar ----\n'), 'the environment section (removal tables and sanitizeGitEnvironment) is unchanged');
      const exportsOf = (t) => [...t.matchAll(/^export (?:async )?(?:function|const|class) ([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
      check(eq(exportsOf(cur), exportsOf(pre)), 'the core exports exactly its previous names in the same order', exportsOf(cur));
      const rdPre = preText(fx, 'assets/tools/review-diff.mjs') || ''; const rdCur = text('assets/tools/review-diff.mjs') || '';
      check(rdPre.includes('# review-diff mode=') === rdCur.includes('# review-diff mode=') && rdCur.split('\n').length === rdPre.split('\n').length && LF(rdCur).split('\n').filter((l, i) => l !== LF(rdPre).split('\n')[i]).length === 1, 'review-diff.mjs differs from the pre-C17 file in exactly one line (the identity header, framing, artifact rules and byte bound are untouched)');
    });
    await step('the root TODO.md chain: the actual TODO reverses through the exact C17 blocker replacement to the pre-C17 TODO (hash ebf6df3a...), then through the existing C16 reversal (the inspected HEAD hash), H8D85 (the 8d85ec6^ hash) and C14\'s T; the C16 timeout-headroom entry stays byte for byte in its accepted state, the new blocker follows the Nest 12 subsection and precedes "## Needs manual review" with exactly one blank line on each side, and the chain rejects a missing, duplicated, moved, altered or differently spaced blocker and a changed neighboring entry', async () => {
      const raw = readBytes(rootPath(context, 'TODO.md'));
      check(byteConvention(raw) === null, 'TODO.md keeps LF, no BOM and one final LF', byteConvention(raw));
      const todo = raw === null ? null : raw.toString('utf8');
      if (todo === null) { check(false, 'the repository-root TODO.md is readable'); return; }
      const n = pvNormalizeTodo(todo);
      check(n.ok, 'the actual TODO.md reverses through C17, the pre-C17 hash, C16, the HEAD hash, H8D85 and the 8d85ec6^ hash', n.why);
      check(n.ok && (n.state === 'pre' || n.state === 'post'), 'the headroom entry is in one accepted C16 state', n.state);
      const preTodo = preText(fx, '@root/TODO.md') || '';
      check(sha(Buffer.from(preTodo, 'utf8')) === TODO_PRE_C17_HASH && applyTodoC17(preTodo) === todo, 'the pre-C17 fixture TODO with the frozen blocker applied is exactly the actual TODO (the independent model)', sha(Buffer.from(todo, 'utf8')));
      const entryOf = (t) => { const i = t.indexOf('- **`project-setup` acceptance timeout headroom needs a C16 measurement.**'); if (i < 0) return null; const rest = t.slice(i); const j = rest.indexOf('\n- '); const k = rest.indexOf('\n\n'); const ends = [j, k].filter((x) => x >= 0); return ends.length ? rest.slice(0, Math.min(...ends) + 1) : null; };
      check(entryOf(todo) !== null && entryOf(todo) === entryOf(preTodo) && COUNT(todo, '- **`project-setup` acceptance timeout headroom needs a C16 measurement.**') === 1, 'the C16 timeout-headroom entry is byte-identical to the pre-C17 entry (C16 values stay tied to C16\'s designated evidence lines)');
      const block = T(C17_BLOCKS.TODO_NEW);
      check(todo.includes(`Nest 11. See \`backend-standards/SKILL.md\` \u00a7 "Nest 12".\n\n${block}\n## Needs manual review\n`) && COUNT(todo, '### project-setup final 3.0.0 requires rc.4 host re-measurement') === 1 && COUNT(todo, 'requires rc.3 host re-measurement') === 0, 'the new blocker stands once between the Nest 12 subsection and "## Needs manual review", separated by exactly one blank line each, and the rc.3 gate is gone');
      const t = squash(block);
      for (const w of ['The 2026-10-26/27 rc.3 measurements closed R83-e as PASS by instruction and both Codex L10 reviews completed.', 'Root settings still did not load for subdirectory starts.', 'C17 addresses the Claude reviewer HEAD-routing defect and the Codex elevated-sandbox Git ownership failure.', 'Claude Code 2.1.311 is a new measurement scope. Final 3.0.0 remains blocked until these measurements pass.']) check(t.includes(w), `the blocker states: ${clip(w)}`);
      check(C17_BLOCKS.TODO_NEW.every((l) => l.length <= 100 && !/[^\x00-\x7f]/.test(l)), 'the blocker lines are ASCII within 100 columns');
      // negative controls on in-memory copies (the real file is never written)
      const rej = (label, mutated) => check(!pvNormalizeTodo(mutated).ok, `control: ${label} is rejected by the chain`, pvNormalizeTodo(mutated).why);
      rej('the pre-C17 TODO (no C17 blocker)', preTodo);
      rej('a duplicated blocker', todo.replace(block, () => block + block));
      rej('a blocker moved after "## Needs manual review"', todo.replace(`${block}\n${PV_TODO_NEEDS}`, () => `${PV_TODO_NEEDS}${block}\n`));
      rej('an altered blocker (one character)', todo.replace(block, () => `${block.slice(0, 5)}Z${block.slice(6)}`));
      rej('a blocker without its trailing blank line', todo.replace(`${block}\n${PV_TODO_NEEDS}`, () => `${block}${PV_TODO_NEEDS}`));
      rej('a blocker with an extra blank line after it', todo.replace(`${block}\n${PV_TODO_NEEDS}`, () => `${block}\n\n${PV_TODO_NEEDS}`));
      rej('the CRLF form', todo.replace(/\n/g, '\r\n'));
      rej('a changed neighboring entry (the Nest 12 text)', todo.replace('Raise with the owner.', 'Raise with the owners.'));
      rej('a changed C16 headroom entry (one digit)', todo.replace(/(timeout headroom needs a C16 measurement\.\*\*[\s\S]*?took )(\d)/, (m, a, d) => `${a}${d === '9' ? '8' : '9'}`));
      rej('the old rc.3 blocker restored beside the new one', todo.replace(block, () => `${block}${T(['### project-setup final 3.0.0 requires rc.3 host re-measurement', ''])}`));
      const model = applyTodoC17(preTodo);
      if (model !== null) amendmentControls(check, 'TODO blocker TD17', model, TD17, { movedBefore: PV_TODO_NEEDS, otherFileText: text('SKILL.md') || '' });
    });
    await step('the exact amendments that no other component exercises fail in every mode: RD17 (the review-diff command list), the root README replacements RR1 to RR5, the project-tree replacements PT1 to PT3 and V17 are each rejected when missing, doubled, altered, restored beside the old text or written with CRLF, and the anchored ones also when moved or spaced differently', async () => {
      const preRd = preText(fx, 'assets/tools/review-diff.mjs'); const preRoot = preText(fx, '@root/README.md'); const preTree = preText(fx, '@root/.ai/context/project-tree.md'); const preVer = preText(fx, 'VERSION');
      if (preRd === null || preRoot === null || preTree === null || preVer === null) { check(false, 'the fixture entries are readable'); return; }
      amendmentControls(check, 'review-diff RD17', modelThrough(fx, 'assets/tools/review-diff.mjs', 'RD17') || '', AM17.RD17, { otherFileText: preRoot });
      for (const id of ['RR1', 'RR2', 'RR4', 'RR5']) pvTokenControls(check, `root README ${id}`, modelThrough(fx, '@root/README.md', id) || '', AM17[id]);
      amendmentControls(check, 'root README RR3', modelThrough(fx, '@root/README.md', 'RR3') || '', AM17.RR3, { movedBefore: 'Start a new Claude Code session and check they appear:', otherFileText: preTree });
      for (const id of ['PT1', 'PT2']) pvTokenControls(check, `project tree ${id}`, modelThrough(fx, '@root/.ai/context/project-tree.md', id) || '', AM17[id]);
      amendmentControls(check, 'project tree PT3', modelThrough(fx, '@root/.ai/context/project-tree.md', 'PT3') || '', AM17.PT3, { movedBefore: '## `backend-standards/`', otherFileText: preRoot });
      pvTokenControls(check, 'VERSION V17', applyForFile(preVer, 'VERSION') || '', AM17.V17);
      // a reversal names the first amendment that does not verify and never partially applies
      const r = reverseForFile(LF(applyForFile(preTree, '@root/.ai/context/project-tree.md') || '').replace(AM17.PT2.neu, () => ''), '@root/.ai/context/project-tree.md');
      check(r.text === null && r.failed === 'PT2', 'a reversal stops at, and names, the first amendment that does not verify (PT2 here, after PT3 reversed)', r.failed);
      check(reverseForFile('anything', 'assets/agents/docs-sync.md').text === null && reverseForFile('anything', 'README.md').text === null, 'a file with no C17 amendment, or a text without the anchors, is refused');
    });
    await step('retained identities: the three C16 record files are unedited (plan c08622f9..., decisions befc8c52..., acceptance adc7d975...), the six v2 snapshots and the baseline checker keep their pins and the checker still verifies them, and every file C17 lists as byte-identical (production scripts, the installer and the release builder, the runtime catalog, the guard and policy modules, docs-sync, all four wrappers and every root and nested instruction template, docs-generation.md, the earlier notes, the runner files, c6, c10, the earlier amendment helpers and prechange fixtures, the review-diff and guard case files) is byte for byte its pre-C17 bytes', async () => {
      for (const key of Object.keys(C16_RECORD_FILES)) { const b = readBytes(rootPath(context, C16_RECORD_FILES[key])); check(b !== null && sha(b) === C16_RECORD_SHA[key], `${C16_RECORD_FILES[key]} is unedited (a frozen record)`, b && sha(b)); }
      check(C17_LITERALS.C16_RECORD_SHA.plan === C16_RECORD_SHA.plan && C17_LITERALS.C16_RECORD_SHA.decisions === C16_RECORD_SHA.decisions && C17_LITERALS.C16_RECORD_SHA.acceptance === C16_RECORD_SHA.acceptance, 'the C16 record identities are the plan\'s (C17-12)');
      const seen = new Set();
      for (const [rel, digest] of C17_UNCHANGED_PINS) {
        seen.add(rel);
        const b = readBytes(skillPath(context, rel));
        check(b !== null && sha(b) === digest, `${rel} is byte for byte its pre-C17 bytes`, b && sha(b));
      }
      check(C17_UNCHANGED_PINS.length >= 70 && seen.size === C17_UNCHANGED_PINS.length, 'the pin table covers the production scripts, assets, data, installers, notes and runner files without duplicates', C17_UNCHANGED_PINS.length);
      for (const must of ['assets/agents/docs-sync.md', 'assets/wrappers/claude-reviewer.md', 'assets/wrappers/claude-docs-sync.md', 'assets/wrappers/codex-reviewer.toml', 'assets/wrappers/codex-docs_sync.toml', 'assets/templates/AGENTS.md', 'assets/templates/CLAUDE.md', 'assets/templates/nested-AGENTS.md', 'assets/templates/nested-CLAUDE.md', 'references/docs-generation.md', 'data/runtime-units.json', 'install/install.mjs', 'install/release.mjs', 'scripts/check-agent-baselines.mjs', 'scripts/apply.mjs', 'scripts/validate.mjs', 'tests/accept-rc1.mjs', 'tests/run-component-tests.mjs', 'tests/c6.test.mjs', 'tests/c10.test.mjs', 'tests/fixtures/review-diff-cases.json', 'tests/fixtures/guard-raw-git-cases.json', 'tests/helpers/c15-amendments.mjs', 'tests/helpers/c16-amendments.mjs', 'tests/fixtures/c14-prechange.json', 'tests/fixtures/c15-prechange.json', 'tests/fixtures/c16-prechange.json', 'assets/tools/git-safe.mjs', 'assets/tools/guard-raw-git-core.mjs', 'assets/tools/guard-raw-git.mjs', 'assets/tools/hooks-selftest.mjs', 'assets/tools/security-policy.mjs']) check(seen.has(must), `the pin table includes ${must}`);
      const baselines = await importOrFail(failures, pathToFileURL(skillPath(context, 'scripts/check-agent-baselines.mjs')).href, 'scripts/check-agent-baselines.mjs');
      if (baselines) check(Array.isArray(baselines.AGENT_BASELINES) && baselines.AGENT_BASELINES.length === 6, 'the baseline checker still pins exactly the six historical v2 snapshots', baselines.AGENT_BASELINES && baselines.AGENT_BASELINES.length);
      const v = execNode(context, { cwd: context.tmp, script: skillPath(context, 'scripts/check-agent-baselines.mjs'), args: [] });
      check(v.dead === null && v.code === 0 && v.json && v.json.ok === true && v.json.baseline === 'v2.0.0' && Array.isArray(v.json.files) && v.json.files.length === 6, 'the six original v2.0.0 snapshots verify (the v2 comparison uses them, never the current assets)', v.json || v.stdout.slice(0, 160));
    });
    await step('the earlier tests carry the C17 views and keep their historical pins: c11b, c13, c14, c15 and c16 import the shared helper and verify then reverse the exact C17 amendments before every historical comparison, and the historical digests they pinned (the pre-C16 core, the retained review-diff and reviewer pins, the evaluation prefix digests) are present with their original values', async () => {
      for (const rel of ['tests/c11b.test.mjs', 'tests/c13.test.mjs', 'tests/c14.test.mjs', 'tests/c15.test.mjs', 'tests/c16.test.mjs']) {
        const src = text(rel) || '';
        check(src.includes("from './helpers/c17-amendments.mjs'") && /reverse/.test(src), `${rel} imports the shared C17 helper and reverses before comparing`);
      }
      const hist = {
        'tests/c13.test.mjs': ['49596e4814ef48880a6e08ea2741f667a29c2aa1a12ed098a9cb4b65dc9b3548', 'ae236ae32405497d5c9bb2340a5cebbe45d37b1c6d50367b478523cf7de06d83', '98047599c326944dea419c3d5a5ea9ae6b94691bbdca464ea28a021783964a6e'],
        'tests/c14.test.mjs': ['49596e4814ef48880a6e08ea2741f667a29c2aa1a12ed098a9cb4b65dc9b3548', 'ae236ae32405497d5c9bb2340a5cebbe45d37b1c6d50367b478523cf7de06d83', '98047599c326944dea419c3d5a5ea9ae6b94691bbdca464ea28a021783964a6e'],
        'tests/c15.test.mjs': ['658e6d6b9369eb61833a4f1a93f0f58557c3fc140d3d6c60913628a9d409ea8e', '1f7a9ddae2c71d1de3a61ee64541fc8924e739f1fad134d25610bfd2b9394f7a', 'ef2f32bda081d9597a6cfdd463b76a9c85f128974ab3d583f6e8be69464672d7', '8059a41c48a4ff78819ca5926ec81bba23f0c4fef29d0c710d77765f8c59ceab'],
        'tests/c16.test.mjs': ['49596e4814ef48880a6e08ea2741f667a29c2aa1a12ed098a9cb4b65dc9b3548', '4c6eb90964c0106b4a1daa518524096eca4b6a428feab1dcb1cab8d3b981d5be', 'ad1c51db23444c022dcb4eca06d0b3fd52984cb1bf3230596a840f34203b5f85', '8059a41c48a4ff78819ca5926ec81bba23f0c4fef29d0c710d77765f8c59ceab', 'ef2f32bda081d9597a6cfdd463b76a9c85f128974ab3d583f6e8be69464672d7'],
      };
      for (const [rel, digests] of Object.entries(hist)) { const src = text(rel) || ''; for (const d of digests) check(src.includes(d), `${rel} still carries the historical digest ${d.slice(0, 8)}...`); }
      const c16 = text('tests/c16.test.mjs') || '';
      check(c16.includes('rows.slice(33)') && !c16.includes('rows.slice(-2)') && c16.includes("head: 'head'"), 'C16 checks the fixture rows with slice(33) and the supported forms with the head key (C17-F1 items 1 and 2)');
      const c15 = text('tests/c15.test.mjs') || ''; const c13 = text('tests/c13.test.mjs') || ''; const c14 = text('tests/c14.test.mjs') || '';
      const decl = (src) => { const i = src.indexOf('const AMENDED_LITERALS = ['); const j = src.indexOf('\n];\n', i); return i < 0 || j < 0 ? null : src.slice(i, j + 3); };
      check(decl(c13) !== null && decl(c14) !== null && c15.includes('const F_AMENDED_C13 = [') && c15.includes('const F_AMENDED_C14 = ['), 'the AMENDED_LITERALS declarations exist in C13 and C14 and C15 carries byte copies of them (F_AMENDED_C13, F_AMENDED_C14; F2)');
      check(c13.includes("\"const CANDIDATE_VERSION = '3.0.0-rc.4';\"") && c13.includes("'file.evals.length === 39'") && c13.includes("'C16', 'C17'") && c13.includes("'3.0.0-rc.4\\\\n'"), 'C13\'s AMENDED_LITERALS list the rc.4 literals (the candidate version, the 39-evaluation total, the rc.4 VERSION literal and the C17 registry tail)');
      check(c14.includes("'file.evals.length === 39'") && c14.includes("'Array.from({ length: 39 }'") && c14.includes("'C16', 'C17'") && c14.includes(', C17 appends 37-39'), 'C14\'s AMENDED_LITERALS list the rc.4 literals (the 39-evaluation total, the generated IDs, the C17 registry tail and the history note)');
    });
    flushProcessCount(context, 'V2/C17/preservation', mark);
  });
}

// ============================================ V2/C17/contracts ====
// Plan C17-14 (contracts row), C17-16, C17-17, C17-18, F5, F7 and F11: the eight ordered descriptors written independently of the implementations, their binding to the functions that run them, the registry tail after C16, the single R29 aggregation with its exact block and
// no output, 40 complete cases and 100 required IDs (no C17 case), registration without execution, the 39 evaluations (1-36 preserved by the raw frame and three digests, 37-39 and the F5 amendment exact), the stop-list coverage of every code the current core and review-diff
// can emit (F11), the pure amendment helper, import safety, and the ASCII/LF/no-skip conventions of this module and its data files. The evaluation objects are expectations, not evidence that an agent followed them.
const CT_REGISTRY_BEFORE = ['C11a', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11b', 'C12', 'C13', 'C14', 'C15', 'C16'];
const CT_EVAL_PREFIX_36_SHA = '4148477e45a82305663defdb5545a9640ccfd5f89c31861f4171e8fb3026c7b2'; // sha256 of JSON.stringify(evals.slice(0, 36)), no final LF (computed independently from the pre-C17 file; plan C17-16)
const CT_EVAL_RAW_1_38_SHA = 'f43ca4c9bae80cbbf7959e9e3ed6a82f130e1feb04889e5cd2240744087a2b31'; // raw LF bytes of lines 1-38 including the LF after line 38 (everything before evaluation 36's line)
const CT_EVAL_PRE_RAW_SHA = 'a13aba6625bbcf249013ac90bfa672d6b856b38f6475a338de949f37dd1a9b42'; // the pre-C17 file
const CT_EVAL_RAW_1_35_SHA = '8059a41c48a4ff78819ca5926ec81bba23f0c4fef29d0c710d77765f8c59ceab';
const CT_EVAL_PREFIX_33_SHA = 'ef2f32bda081d9597a6cfdd463b76a9c85f128974ab3d583f6e8be69464672d7';
const CT_EVAL_PREFIX_31_SHA = '1f7a9ddae2c71d1de3a61ee64541fc8924e739f1fad134d25610bfd2b9394f7a';
const CT_EVAL_1_20_SHA = '98047599c326944dea419c3d5a5ea9ae6b94691bbdca464ea28a021783964a6e';
const CT_EVAL_1_10_SHA = '0b3c3712aac615a7a09ada4ac848b959af2c664c1cb196559b6901cb47b702c6';
const CT_EVAL_FIELDS = ['id', 'name', 'prompt', 'files', 'expected_output'];
const CT_HELPER_EXPORTS = ['AM17', 'AMENDED_FILES17', 'C17_BLOCKS', 'C17_DESCRIPTORS', 'C17_LITERALS', 'C17_R29_BLOCK', 'CORE_FROZEN_LITERALS', 'EVAL_NEW_LINES', 'FORWARD_ORDER17', 'HEADING_AMENDMENT17', 'PRE_C17_FILES', 'REVERSAL_ORDER17', 'TD17', 'TODO_PRE_C17_HASH',
  'amendmentOnce', 'applyEvalsC17', 'applyForFile', 'applyOne', 'applySteps', 'applyTodoC17', 'reverseEvalsC17', 'reverseForFile', 'reverseOne', 'reverseSteps', 'reverseTodoC17'];
const CT_LAUNCH_ENTRY_POINTS = ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'];
const CT_IMPORT_PROBE = String.raw`import cp from 'node:child_process';
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
const CT_SILENT_LAUNCH_MODULE = [
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
const CT_SILENT_ORDER = ['spawnSync', 'execFileSync', 'spawn', 'exec', 'execSync', 'execFile', 'fork'];
function ctRunImportProbe(context, dir, moduleUrl) {
  const probe = path.join(dir, 'import-probe.mjs');
  fs.writeFileSync(probe, CT_IMPORT_PROBE);
  const r = execNode(context, { cwd: dir, script: probe, args: [moduleUrl] });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout.trim().split('\n').pop()); } catch { /* reported by the evaluator */ }
  return { r, parsed, files: fs.readdirSync(dir).sort().join('|') };
}
function ctImportProbeIssues({ r, parsed, files }, { names, written }) {
  if (r.dead || r.code !== 0 || parsed === null) return ['probe-run'];
  const issues = [];
  if (parsed.error !== null) issues.push('import-error');
  if (!eq(parsed.wrapped, CT_LAUNCH_ENTRY_POINTS)) issues.push('instrumentation');
  if (!eq(parsed.names, names)) issues.push('exports');
  if (parsed.printed !== '' || r.stderr !== '') issues.push('output');
  if (files !== written) issues.push('writes');
  if (!eq(parsed.launches, [])) issues.push('launches');
  return issues;
}
// The literal descriptor-to-runner binding (plan C17-14): every id with the name of the function it runs, written out by hand and compared with RUNNERS by name.
const CT_EXPECTED_RUNNER_BINDINGS = [
  ['R76/C17/head', 'headGroup'],
  ['R76/C17/ownership', 'ownershipGroup'],
  ['R90/C17/instructions', 'instructions'],
  ['A5-templates/C17/host-docs', 'hostDocs'],
  ['V2/C17/update', 'update'],
  ['RC1/C17/release', 'release'],
  ['V2/C17/preservation', 'preservation'],
  ['V2/C17/contracts', 'contracts'],
];
function ctRunnerBindingIssues(table, expected) {
  const issues = [];
  const ids = Object.keys(table).sort();
  if (!eq(ids, expected.map(([id]) => id).sort())) issues.push(`ids ${show(ids)}`);
  for (const [id, name] of expected) {
    const actual = typeof table[id] === 'function' ? table[id].name : null;
    if (actual !== name) issues.push(`${id} runs ${show(actual)}, expected ${name}`);
  }
  return issues;
}
// Source text without comments and without the contents of string and template literals (so a word inside a quoted block cannot look like code).
function ctCodeOnly(src) {
  let out = ''; let i = 0; const n = src.length;
  while (i < n) {
    const c = src[i]; const d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') { const q = c; out += q; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; } out += q; i++; continue; }
    out += c; i++;
  }
  return out;
}
// F11: every code the current core and review-diff can emit is in the two-code correction whitelist, named in the stop list, or covered by "any other error"; GIT_SAFE_OWNERSHIP is not whitelisted. Returns the violations of one canonical agent text.
function ctStopCoverage(agentText, emitterText) {
  const s = squash(agentText);
  const codes = [...new Set(emitterText.match(/\b(?:GIT_SAFE_[A-Z_]+|REVIEW_[A-Z_]+|POLICY_[A-Z_]+)\b/g) || [])].sort();
  const issues = [];
  const qualify = /Only (GIT_SAFE_[A-Z_]+)(?: and (GIT_SAFE_[A-Z_]+))? qualify/.exec(s);
  const whitelist = qualify === null ? [] : [qualify[1], qualify[2]].filter(Boolean).sort();
  if (!eq(whitelist, ['GIT_SAFE_ARGUMENT', 'GIT_SAFE_PATTERN'])) issues.push(`the whitelist is ${show(whitelist)}`);
  const stopList = /You MUST stop on ([^.]*)\./.exec(s);
  const named = stopList === null ? [] : stopList[1].split(/,| or /).map((x) => x.trim()).filter((x) => /^(?:GIT_SAFE_[A-Z_]+|POLICY_\*)$/.test(x));
  const anyOther = /any other error/.test(s);
  if (!anyOther) issues.push('the stop list has no "any other error" clause');
  if (whitelist.includes('GIT_SAFE_OWNERSHIP')) issues.push('GIT_SAFE_OWNERSHIP is whitelisted');
  if (!codes.includes('GIT_SAFE_OWNERSHIP')) issues.push('the emitters do not carry GIT_SAFE_OWNERSHIP (premise)');
  for (const c of codes) {
    const covered = whitelist.includes(c) || named.includes(c) || (c.startsWith('POLICY_') && named.includes('POLICY_*')) || anyOther;
    if (!covered) issues.push(`${c} is neither whitelisted, named nor covered`);
  }
  return issues;
}
async function contracts(context) {
  startClock(context);
  const mark = processMark(context);
  return runAssertion(async ({ failures, check, step }) => {
    const text = (rel) => readText(skillPath(context, rel));
    const rc = await importOrFail(failures, pathToFileURL(skillPath(context, 'tests/rc1-cases.mjs')).href, 'tests/rc1-cases.mjs');
    const integration = await importOrFail(failures, pathToFileURL(skillPath(context, 'tests/helpers/rc1-integration.mjs')).href, 'tests/helpers/rc1-integration.mjs');
    await step('registration: COMPONENT_ASSERTIONS.C17 is the eight descriptors of plan C17-14 in order (identical to the plan JSON, deep-frozen), COMPONENT_IMPLEMENTATIONS.C17 holds exactly the C17_IMPLEMENTATIONS objects, both registries end ...C15, C16, C17, rc1-cases.mjs carries the import, the property and the implementation line directly after the C16 ones, and the descriptors take only the context', async () => {
      if (!rc) return;
      const exp = rc.COMPONENT_ASSERTIONS && rc.COMPONENT_ASSERTIONS.C17;
      check(Array.isArray(exp) && eq(JSON.parse(JSON.stringify(exp)), EXPECTED_DESCRIPTORS) && eq(JSON.parse(JSON.stringify(exp)), JSON.parse(JSON.stringify(C17_DESCRIPTORS))) && Object.isFrozen(exp) && exp.every((d) => Object.isFrozen(d)), 'COMPONENT_ASSERTIONS.C17 is the frozen eight-descriptor list of the plan, in order', exp && exp.map((d) => d.id));
      check(eq(EXPECTED_DESCRIPTORS.map((d) => d.id), ['R76/C17/head', 'R76/C17/ownership', 'R90/C17/instructions', 'A5-templates/C17/host-docs', 'V2/C17/update', 'RC1/C17/release', 'V2/C17/preservation', 'V2/C17/contracts']), 'the eight ids and their order are the plan\'s');
      const impls = rc.COMPONENT_IMPLEMENTATIONS && rc.COMPONENT_IMPLEMENTATIONS.C17;
      check(Array.isArray(impls) && Object.isFrozen(impls) && impls.length === C17_IMPLEMENTATIONS.length && impls.every((x, i) => x === C17_IMPLEMENTATIONS[i]), 'COMPONENT_IMPLEMENTATIONS.C17 holds exactly the C17_IMPLEMENTATIONS objects in order (identity preserved)', impls && impls.length);
      check(Object.isFrozen(C17_IMPLEMENTATIONS) && eq(C17_IMPLEMENTATIONS.map((x) => x.id), EXPECTED_DESCRIPTORS.map((d) => d.id)) && C17_IMPLEMENTATIONS.length === 8 && C17_IMPLEMENTATIONS.every((x) => typeof x.run === 'function' && Object.isFrozen(x) && x.run.length <= 1), 'C17_IMPLEMENTATIONS is a frozen array of the eight ids with callable, frozen descriptors that take only the context');
      const keysA = Object.keys(rc.COMPONENT_ASSERTIONS || {}); const keysI = Object.keys(rc.COMPONENT_IMPLEMENTATIONS || {});
      check(eq(keysA, [...CT_REGISTRY_BEFORE, 'C17']) && eq(keysI, [...CT_REGISTRY_BEFORE, 'C17']), 'both registries list every earlier component unchanged and C17 as the appended tail', { keysA, keysI });
      check(eq(Object.keys(rc).sort(), ['BASELINE_CASE_IDS', 'COMPONENT_ASSERTIONS', 'COMPONENT_IMPLEMENTATIONS', 'RC1_CASE_IDS', 'REQUIRED_CASE_IDS', 'registerRc1Cases', 'runComponentAssertions', 'selectSuiteCases']), 'rc1-cases.mjs keeps exactly its eight exports', Object.keys(rc).sort());
      check(eq(rc.COMPONENT_ASSERTIONS.C16.map((d) => d.id), ['A5-templates/C16/launch', 'R42/C16/grep', 'R41/C16/cat', 'A5-templates/C16/recovery', 'A5-templates/C16/host-docs', 'V2/C16/update', 'RC1/C16/release', 'V2/C16/contracts']), 'the eight C16 descriptor ids are unchanged');
      const src = text('tests/rc1-cases.mjs') || '';
      const block = ['  // C17 plan (docs/plans/2026-10-27-project-setup-v3-rc4-c17.md) section C17-14, in its exact order. These are sub-assertions: no complete numbered case is composed from them and the 40-case table is unchanged.', '  C17: [', ...C17_DESCRIPTORS.map((d) => `    { id: '${d.id}', name: '${d.name}' },`), '  ],'].join('\n');
      check(COUNT(src, "import { C16_IMPLEMENTATIONS } from './c16.test.mjs';\nimport { C17_IMPLEMENTATIONS } from './c17.test.mjs';\n") === 1, 'the C17 import line stands once, immediately after the C16 import with no blank line');
      check(COUNT(src, `    { id: 'V2/C16/contracts', name: 'C16 registration evaluations and historical preservation are exact' },\n  ],\n${block}\n});`) === 1, 'the exact comment line and C17 property stand once, directly after the C16 property and before the closing of the registry');
      check(COUNT(src, '  C16: Object.freeze([...C16_IMPLEMENTATIONS]),\n  C17: Object.freeze([...C17_IMPLEMENTATIONS]),\n});') === 1, 'the C17 implementation line stands once, immediately after the C16 line');
    });
    await step('registerRc1Cases still registers exactly the 40 ordered complete cases with function callbacks, adds no C17 case, executes nothing and writes nothing; the inventories keep 40 cases and 100 required IDs (no C17 sub-assertion among them) and CASE_REQUIREMENTS names no C17 component', async () => {
      if (!rc) return;
      const calls = [];
      const ret = rc.registerRc1Cases((...a) => calls.push(a), context);
      check(calls.length === 40 && eq(calls.map((c) => c[0]), [...rc.RC1_CASE_IDS]) && calls.every((c) => typeof c[2] === 'function') && ret === undefined && !calls.some((c) => c[0].includes('/C17/')), 'exactly the 40 ordered RC1_CASE_IDS with function callbacks, undefined result and no /C17/ ID', calls.length);
      check(rc.RC1_CASE_IDS.length === 40 && rc.BASELINE_CASE_IDS.length === 60 && rc.REQUIRED_CASE_IDS.length === 100 && new Set(rc.REQUIRED_CASE_IDS).size === 100 && !rc.REQUIRED_CASE_IDS.some((id) => id.includes('/C17/')), 'the inventories stay 40 complete cases, 60 baseline cases and 100 required IDs, none a C17 sub-assertion');
      const executed = []; const seen = [];
      const scratch = () => { try { return fs.readdirSync(context.tmp).sort().join('|'); } catch { return ''; } };
      const before = scratch();
      const again = rc.registerRc1Cases((...a) => seen.push(a), { repository: context.repository, getComponent: (name) => { executed.push(name); return Promise.resolve(null); } });
      check(executed.length === 0 && seen.length === 40 && again === undefined && scratch() === before, 'registration requests no component and leaves the scratch directory unchanged', { executed, registered: seen.length });
      if (integration) {
        const comps = new Set(Object.values(integration.CASE_REQUIREMENTS).flatMap((list) => list.map((r) => r.component)));
        const ids = Object.values(integration.CASE_REQUIREMENTS).flatMap((list) => list.flatMap((r) => r.ids));
        check(!comps.has('C17') && !ids.some((id) => id.includes('/C17/')) && integration.RC1_CASE_DESCRIPTORS.length === 40, 'CASE_REQUIREMENTS names no C17 component or assertion and keeps its 40 descriptors (C17 contributes through R29)');
      }
    });
    await step('plan C17-17: run-tests.mjs aggregates C17 once inside R29, immediately after the C16 check and before the closing of R29, with the plan\'s exact block (context literal included) and no output; every earlier call site keeps its context literal and the complete cases are still registered once', async () => {
      const runner = readText(path.join(context.skillRoot, 'tests', 'run-tests.mjs'));
      check(runner !== null, 'tests/run-tests.mjs is readable');
      if (runner === null) return;
      const r29 = runner.indexOf("test('R29'"); const at16 = runner.indexOf("runComponentAssertions('C16'"); const at17 = runner.indexOf("runComponentAssertions('C17'"); const r30 = runner.indexOf("test('R30'", at16);
      check(r29 >= 0 && at16 > r29 && at17 > at16 && r30 > at17 && COUNT(runner, "runComponentAssertions('C17'") === 1, 'exactly one runComponentAssertions(\'C17\', ...) call site, in R29, after the C16 call and before test(\'R30\')', { r29, at16, at17, r30 });
      const block = ['  // C17 contributes once through R29 without adding complete case records.', ...C17_R29_BLOCK.map((l) => `  ${l}`)];
      const line16 = /^ {2}check\(rep16\.ok === true, 'C16 component assertions pass'.*$/m.exec(runner);
      const tail = line16 === null ? '' : runner.slice(line16.index + line16[0].length);
      check(line16 !== null && tail.startsWith(`\n${block.join('\n')}\n});\n\ntest('R30'`), 'the comment line and the plan\'s exact block follow the C16 check line immediately (no blank line before or after) and are followed by the closing "});" of R29');
      check(COUNT(runner, "tmp: path.join(TMP, 'c17')") === 1 && COUNT(runner, 'const rep17 = await runComponentAssertions(\'C17\', c17context);') === 1 && COUNT(runner, "check(rep17.ok === true, 'C17 component assertions pass', {") === 1, 'the context literal and the check are exactly the plan\'s, once');
      const seg = at17 >= 0 && r30 > at17 ? runner.slice(runner.indexOf('\n', runner.indexOf("'C16 component assertions pass'")), r30) : '';
      check(seg !== '' && !/console\.log|stdout\.write|\bPASS {2}/.test(seg.slice(seg.indexOf('C17 contributes'))), 'the C17 segment contains no console.log, stdout.write or "PASS  " text, comments included');
      for (const [c, d] of [['C1', 'c1'], ['C2', 'c2'], ['C3', 'c3'], ['C4', 'c4'], ['C5', 'c5'], ['C6', 'c6'], ['C7', 'c7'], ['C8', 'c8'], ['C9', 'c9'], ['C10', 'c10'], ['C11a', 'c11a'], ['C11b', 'c11b'], ['C12', 'c12'], ['C13', 'c13'], ['C14', 'c14'], ['C15', 'c15'], ['C16', 'c16']]) {
        check(COUNT(runner, `runComponentAssertions('${c}'`) === 1 && runner.includes(`{ repository: path.resolve(SKILL, '..'), skillRoot: SKILL, tmp: path.join(TMP, '${d}'), env: { ...ENV } }`), `${c}: one call site and its baseline context literal are kept`);
      }
      check(COUNT(runner, 'registerRc1Cases(test, { getComponent });') === 1, 'the complete cases are still registered once');
    });
    await step('plan C17-16, F5 and F7: evals/evals.json holds exactly 39 ordered unique evaluations; the original lines 1-38 keep the raw digest f43ca4c9..., the JSON serialization of evaluations 1-36 keeps the new digest 4148477e... (and 1-33 ef2f32bd..., 1-31 1f7a9dda..., 1-20 98047599..., 1-10 0b3c3712...); line 39 (evaluation 36) differs from the pre-C17 line only by its delimiter comma, lines 40-42 are exactly the three plan objects (four-space indent, F5 applied to evaluation 38) and the frame and final LF are kept; reversing the additions gives the pre-C17 file', async () => {
      const raw = readText(skillPath(context, 'evals/evals.json'));
      const file = readJson(skillPath(context, 'evals/evals.json'));
      check(file !== null && file.skill_name === 'project-setup' && Array.isArray(file.evals) && raw !== null, 'evals/evals.json is readable and keeps skill_name project-setup');
      if (!file || !Array.isArray(file.evals) || raw === null) return;
      const ids = file.evals.map((e) => e && e.id);
      check(file.evals.length === 39 && eq(ids, Array.from({ length: 39 }, (_, i) => i + 1)) && new Set(ids).size === 39, 'exactly ids 1 through 39 in order without duplicates (C17 appends 37-39; an earlier or a larger count is wrong)', ids);
      const lines = raw.split('\n');
      check(lines.length === 45 && lines[44] === '' && lines[0] === '{' && lines[2] === '  "evals": [' && lines[42] === '  ]' && lines[43] === '}', 'the file keeps its frame: 42 content lines plus the final LF, the closing "  ]" and "}" immediately after evaluation 39', lines.length);
      check(sha(Buffer.from(lines.slice(0, 38).join('\n') + '\n', 'utf8')) === CT_EVAL_RAW_1_38_SHA, 'original lines 1-38 are byte-identical to the pre-C17 file, including the LF after line 38 (digest f43ca4c9...)');
      check(sha(Buffer.from(lines.slice(0, 35).join('\n') + '\n', 'utf8')) === CT_EVAL_RAW_1_35_SHA, 'original lines 1-35 keep the C16 raw digest 8059a41c...');
      check(sha(Buffer.from(JSON.stringify(file.evals.slice(0, 36)), 'utf8')) === CT_EVAL_PREFIX_36_SHA, 'the JSON serialization of evaluations 1-36 is unchanged (the new digest 4148477e..., no final LF)');
      check(sha(Buffer.from(JSON.stringify(file.evals.slice(0, 33)), 'utf8')) === CT_EVAL_PREFIX_33_SHA && sha(Buffer.from(JSON.stringify(file.evals.slice(0, 31)), 'utf8')) === CT_EVAL_PREFIX_31_SHA && sha(Buffer.from(JSON.stringify(file.evals.slice(0, 20)))) === CT_EVAL_1_20_SHA && sha(Buffer.from(JSON.stringify(file.evals.slice(0, 10)))) === CT_EVAL_1_10_SHA, 'the earlier prefix digests keep their values (1-33, 1-31, 1-20, 1-10)');
      check(lines[38].startsWith('    { "id": 36, ') && lines[38].endsWith('},') && JSON.parse(lines[38].replace(/,$/, '')).id === 36, 'line 39 is evaluation 36 with only its delimiter comma added');
      check(eq(lines.slice(39, 42), [...EVAL_NEW_LINES]) && EVAL_NEW_LINES[0].endsWith('},') && EVAL_NEW_LINES[1].endsWith('},') && EVAL_NEW_LINES[2].endsWith('}') && EVAL_NEW_LINES.every((l) => l.startsWith('    { "id": ')), 'lines 40 to 42 are exactly the three plan lines with the separator commas, the four-space indent and no trailing comma on the last');
      const rev = reverseEvalsC17(raw);
      check(rev !== null && sha(Buffer.from(rev, 'utf8')) === CT_EVAL_PRE_RAW_SHA && JSON.parse(rev).evals.length === 36, 'reversing the three additions and the delimiter comma gives the pre-C17 file byte for byte (a13aba66...)', rev && sha(Buffer.from(rev, 'utf8')));
      check(applyEvalsC17(rev || '') === raw, 'applying the additions to the pre-C17 file gives the actual file (the forward and reverse directions agree)');
      check(reverseEvalsC17(raw.replace('\n  ]\n}\n', '\n\n  ]\n}\n')) === null && reverseEvalsC17(raw.replace(/\n$/, '')) === null && reverseEvalsC17(rev || '') === null && reverseEvalsC17(raw.replace('"id": 37,', '"id": 38,')) === null, 'negative controls: a blank line before the closing array, a missing final LF, a file without the additions and an altered new line are each refused');
      EVAL_NEW_LINES.forEach((l, i) => {
        const want = JSON.parse(l.replace(/^ {4}/, '').replace(/,$/, '')); const got = file.evals[36 + i];
        check(eq(got, want) && eq(Object.keys(got || {}), CT_EVAL_FIELDS), `evaluation ${37 + i} equals the plan object exactly, with its keys in plan order (an expectation, not observed agent behavior)`, got && got.name);
      });
      check(eq(file.evals.slice(36).map((e) => e && e.name), ['reviewer-head-through-git-safe', 'codex-git-ownership-stop', 'rc4-delivery-and-measurement-boundary']), 'the names of 37-39 are the plan names in order');
      const planOriginal = JSON.parse(C17_BLOCKS.EVALS[1].replace(/,$/, ''));
      const e38 = file.evals[37] || {};
      check(Array.isArray(e38.files) && e38.files.length === 9 && e38.files[0] === 'Current canonical reviewer and docs-sync stop rules' && e38.files[1] === 'Skill reference section Git ownership in the Codex Windows sandbox' && eq(e38.files.filter((_, i) => i !== 1), planOriginal.files) && e38.prompt === planOriginal.prompt && e38.expected_output === planOriginal.expected_output, 'F5: evaluation 38 gains the skill-reference input as its second files element and is otherwise the plan object (PLAN-GAP: read as an insertion after the first element, so the fixed-diagnostic input stays)');
      const has = (o, re) => [...(o.files || []), o.expected_output || '', o.prompt || ''].some((s) => re.test(s));
      const e37 = file.evals[36] || {}; const e39 = file.evals[38] || {};
      for (const [name, o, re] of [
        ['37: the helper form runs without arguments and compares full IDs', e37, /Runs node \.ai\/tools\/git-safe\.mjs head without arguments and compares full resolved IDs\./],
        ['37: no raw rev-parse and no raw Git', e37, /Does not route raw rev-parse through the helper or run raw Git\./],
        ['37: the warning only for equal IDs, regardless of dirty state or detached HEAD', e37, /emits the exact instruction-trust warning only for equal IDs, regardless of dirty state or detached HEAD\./],
        ['37: a failure stops and is reported as incomplete work', e37, /Stops and reports incomplete work when HEAD identity cannot be established; never silently omits the comparison or treats unknown identity as unequal\./],
        ['37: the bounded correction rule and every no-fallback restriction stay', e37, /Preserves the bounded ARGUMENT\/PATTERN correction rule and every no-fallback restriction\./],
        ['38: stop without raw Git, another helper, a connector, sandbox changes or configuration edits', e38, /Stops the current task and reports the fixed diagnostic without raw Git, another helper, a connector, sandbox changes or automatic configuration edits\./],
        ['38: the exact trusted grant, GIT_CONFIG_GLOBAL and the wildcard breadth', e38, /git config --global --add safe\.directory with a user-supplied absolute trusted path, explains GIT_CONFIG_GLOBAL selection, and states that a wildcard trusts every repository and is not narrowed by adding an exact entry\./],
        ['38: an injected entry is never accepted and OWNERSHIP is not whitelisted', e38, /Does not accept an injected entry even when its path matches\. Does not add OWNERSHIP or REPOSITORY to the correction whitelist/],
        ['39: the compatible unit is staged whole and a kept old required change is incomplete delivery', e39, /stages the complete compatible runtime unit, preserves user customizations and records incomplete delivery if a required change is kept old\./],
        ['39: R83-e closed by instruction, both rc.3 L10 reviews complete, nothing transferred to rc.4', e39, /Records R83-e as closed PASS by instruction with its unchanged residual and both rc\.3 Codex L10 reviews as complete\. Does not transfer those results to rc\.4 or conflate Claude versions\./],
        ['39: final 3.0.0 is gated on rc.4 measurements', e39, /Gates final 3\.0\.0 on completed rc\.4 reviews with correct HEAD warnings and content-free ownership failure plus success after the exact fixture grant\./],
      ]) check(has(o, re), `evaluation ${name}`);
    });
    await step('F11 and C17-20: every code the current core and review-diff can emit is in the two-code correction whitelist, named in the reviewer or docs-sync stop list, or covered by its "any other error" clause, and GIT_SAFE_OWNERSHIP is not whitelisted (neither as a correction nor as a retry); the check fails for a whitelisted ownership code and for a stop list without its catch-all clause', async () => {
      const core = text('assets/tools/git-safe-core.mjs') || ''; const rd = text('assets/tools/review-diff.mjs') || '';
      for (const rel of ['assets/agents/reviewer.md', 'assets/agents/docs-sync.md']) {
        const agent = text(rel) || '';
        const issues = ctStopCoverage(agent, `${core}\n${rd}`);
        check(issues.length === 0, `${rel}: every emitted code is whitelisted, named or covered, and GIT_SAFE_OWNERSHIP is not whitelisted`, issues);
        const sq = squash(agent);
        const whitelist2 = 'Only GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN qualify.';
        check(sq.includes(whitelist2) && ctStopCoverage(sq.replace(whitelist2, 'Only GIT_SAFE_ARGUMENT and GIT_SAFE_OWNERSHIP qualify.'), `${core}\n${rd}`).some((i) => i.includes('whitelist')) && ctStopCoverage(sq.replace(whitelist2, 'Only GIT_SAFE_ARGUMENT, GIT_SAFE_PATTERN and GIT_SAFE_OWNERSHIP qualify.'), `${core}\n${rd}`).some((i) => i.includes('whitelist')), `${rel}: control: a whitelist that holds the ownership code is reported`);
        const catchAll = 'any other error';
        check(sq.includes(catchAll) && ctStopCoverage(sq, `${core}\n${rd}\nGIT_SAFE_NEWCODE`).length === 0 && ctStopCoverage(sq.replace(catchAll, 'any listed error'), `${core}\n${rd}`).some((i) => i.includes('catch-all') || i.includes('any other error')) && ctStopCoverage(sq.replace(catchAll, 'any listed error'), `${core}\n${rd}\nGIT_SAFE_NEWCODE`).some((i) => i.includes('GIT_SAFE_NEWCODE')), `${rel}: control: without the catch-all clause an invented code is reported as uncovered, and with it the same code is covered`);
      }
      const pre = fx17Pre(context);
      const preIssues = pre.core === null ? null : ctStopCoverage(text('assets/agents/reviewer.md') || '', pre.core);
      check(preIssues !== null && eq(preIssues, ['the emitters do not carry GIT_SAFE_OWNERSHIP (premise)']), 'control: the pre-C17 core does not carry the ownership code (the check is about the new code)', preIssues);
    });
    await step('the amendment helper is pure and exact: it exports exactly the listed names, imports nothing, uses no file access, process, console, clock or randomness outside strings and comments, and is ASCII (non-ASCII text is written as escapes); every amendment has exactly the five fields (SE4_17 also flex), is frozen, ends with one LF where it has text, has no implicit leading blank line and names an amended file; the forward and reverse orders cover the eleven amended files in plan order; the descriptor list and the R29 block are the plan\'s', async () => {
      const helperPath = skillPath(context, 'tests/helpers/c17-amendments.mjs');
      const src = readText(helperPath) || '';
      check(src !== '' && !/^\s*import\s/m.test(src) && !/\bimport\(/.test(src) && !/\brequire\(/.test(src), 'the helper imports nothing (it cannot import a component module)');
      check(!/node:|child_process|readFileSync|writeFileSync|readdirSync|existsSync|spawn|process\.|console\.|stdout|stderr|Date\.now|Math\.random/.test(ctCodeOnly(src)), 'outside strings and comments the helper uses no file access, process launch, process object, console, clock or randomness');
      const H = await importOrFail(failures, pathToFileURL(helperPath).href, 'tests/helpers/c17-amendments.mjs');
      if (!H) return;
      check(eq(Object.keys(H).sort(), [...CT_HELPER_EXPORTS].sort()), 'the helper exports exactly the listed names', Object.keys(H).sort());
      check(H.AM17 === AM17 && H.amendmentOnce === amendmentOnce && H.reverseOne === reverseOne && Object.isFrozen(H.AM17) && Object.isFrozen(H.C17_BLOCKS) && Object.isFrozen(H.FORWARD_ORDER17) && Object.isFrozen(H.REVERSAL_ORDER17) && Object.isFrozen(H.C17_LITERALS), 'C17 uses the very objects and functions the module exports and the exported tables are frozen');
      const FIVE = ['file', 'before', 'old', 'neu', 'after'];
      const files = new Set([...Object.keys(H.FORWARD_ORDER17), '@root/TODO.md']);
      for (const [id, a] of Object.entries(H.AM17)) {
        const keys = Object.keys(a);
        check((eq(keys, FIVE) || (id === 'SE4_17' && eq(keys, [...FIVE, 'flex']))) && Object.isFrozen(a) && files.has(a.file) && typeof a.neu === 'string' && a.neu !== '' && !a.neu.startsWith('\n') && (a.neu.endsWith('\n') || id === 'S17'), `${id}: exactly its fields, frozen, names an amended file, ends with one LF (S17 replaces a table-cell phrase inside a line) and has no implicit leading blank line`, keys);
      }
      check(eq(Object.keys(H.TD17), FIVE) && Object.isFrozen(H.TD17) && H.TD17.file === '@root/TODO.md' && H.TD17.neu.endsWith('\n') && H.TD17.old.endsWith('\n\n'), 'TD17 has exactly the five fields, is frozen and replaces a whole block with its trailing blank line');
      const covered = Object.values(H.FORWARD_ORDER17).flat();
      check(eq([...covered].sort(), Object.keys(H.AM17).sort()) && new Set(covered).size === covered.length, 'every amendment is in exactly one forward order', covered.length);
      check(Object.entries(H.FORWARD_ORDER17).every(([f, ids]) => eq([...ids].reverse(), [...H.REVERSAL_ORDER17[f]]) && ids.every((id) => H.AM17[id].file === f) && Object.isFrozen(ids)) && H.AMENDED_FILES17.length === 11, 'the reverse order of each file is its forward order reversed and every amendment names its own file');
      check(eq(JSON.parse(JSON.stringify(H.C17_DESCRIPTORS)), EXPECTED_DESCRIPTORS) && H.C17_R29_BLOCK.length === 14 && H.C17_R29_BLOCK[0] === 'const c17context = {' && H.C17_R29_BLOCK[13] === '});', 'the descriptor list is the plan\'s and the R29 block is its 14 lines');
      check(typeof H.reverseOne === 'function' && H.reverseOne('x', { file: 'x', before: '', old: '', neu: 'x\n', after: '' }) === null && H.applyOne('x', { file: 'x', before: '', old: 'zz', neu: 'y', after: '' }) === null, 'a synthetic amendment shows the failure modes: a text without the amended slice is refused in both directions (never a substring deletion)');
    });
    await step('this module is import safe (the probe): importing it prints nothing, writes nothing, starts no process (observed by instrumenting every child-process entry point before the import) and exports exactly C17_IMPLEMENTATIONS; the descriptor-to-runner binding is the literal table; no run function has a skip path; the module, the helper and the three data files are ASCII with LF line ends and a final LF', async () => {
      const clean = { r: { dead: null, code: 0, stderr: '' }, parsed: { names: ['X'], printed: '', launches: [], wrapped: [...CT_LAUNCH_ENTRY_POINTS], error: null }, files: 'import-probe.mjs' };
      const flip = (patch) => ctImportProbeIssues({ r: { ...clean.r, ...(patch.r || {}) }, parsed: patch.parsed === null ? null : { ...clean.parsed, ...(patch.parsed || {}) }, files: patch.files === undefined ? clean.files : patch.files }, { names: ['X'], written: 'import-probe.mjs' });
      const flipped = [flip({}), flip({ parsed: { launches: ['execSync'] } }), flip({ parsed: { printed: 'x' } }), flip({ r: { stderr: 'e' } }), flip({ files: 'import-probe.mjs|x' }), flip({ parsed: { names: ['X', 'Y'] } }), flip({ parsed: { wrapped: ['spawn'] } }), flip({ parsed: { error: 'boom' } }), flip({ r: { code: 1 } }), flip({ parsed: null }), flip({ r: { dead: 'timeout' } })];
      check(eq(flipped, [[], ['launches'], ['output'], ['output'], ['writes'], ['exports'], ['instrumentation'], ['import-error'], ['probe-run'], ['probe-run'], ['probe-run']]), 'the import-safety evaluator reports each unsafe signal on its own and nothing for a clean report', flipped);
      await withScratch(context, 'contracts', async (dir) => {
        const run = ctRunImportProbe(context, dir, import.meta.url);
        const issues = ctImportProbeIssues(run, { names: ['C17_IMPLEMENTATIONS'], written: 'import-probe.mjs' });
        check(!issues.some((i) => ['probe-run', 'import-error', 'exports', 'output'].includes(i)), 'the import prints nothing and the export set is exactly C17_IMPLEMENTATIONS', { issues, out: run.r.stdout.slice(0, 200), err: run.r.stderr.slice(0, 200) });
        check(!issues.includes('writes') && !issues.includes('instrumentation') && !issues.includes('launches') && run.parsed !== null && eq(run.parsed.launches, []) && eq(run.parsed.wrapped, CT_LAUNCH_ENTRY_POINTS), 'the import wrote nothing and started no process (all seven entry points instrumented first)', run.parsed && run.parsed.launches);
      });
      await withScratch(context, 'launch-control', async (dir) => {
        const modulePath = path.join(dir, 'silent-launch.mjs');
        fs.writeFileSync(modulePath, CT_SILENT_LAUNCH_MODULE);
        const run = ctRunImportProbe(context, dir, pathToFileURL(modulePath).href);
        const issues = ctImportProbeIssues({ ...run, files: 'import-probe.mjs|silent-launch.mjs' }, { names: ['SILENT_LAUNCHES'], written: 'import-probe.mjs|silent-launch.mjs' });
        check(eq(issues, ['launches']) && run.parsed !== null && eq(run.parsed.launches, CT_SILENT_ORDER), 'negative control: a module that starts a process silently through all seven entry points is detected only by the recorded launches', { issues, launches: run.parsed && run.parsed.launches });
      });
      for (const rel of ['tests/c17.test.mjs', 'tests/helpers/c17-amendments.mjs', 'tests/fixtures/c17-prechange.json', 'tests/fixtures/c17-upgrade-baselines.json', 'tests/fixtures/git-safe-cases.json', 'evals/evals.json']) {
        const b = readBytes(skillPath(context, rel));
        check(b !== null && !b.includes(0x0d) && ![...b.toString('utf8')].some((c) => c.charCodeAt(0) > 127) && b[b.length - 1] === 0x0a && b[b.length - 2] !== 0x0a && b[0] !== 0xef, `${rel} is ASCII, LF only, without a BOM and with exactly one final LF`);
      }
      const me = readText(skillPath(context, 'tests/c17.test.mjs')) || '';
      check(!/^(?:(?:const|let|var)\s+[\w$]+\s*=\s*)?(?:await\s+)?(?:fs\.\w+|spawnSync|execNode|gitIn|putFile|makeRepo|copyTree|rmrf)\(/m.test(me), 'no top-level statement of this module writes a file or starts a process');
      const SK = 'skip' + 'ped';
      check(!new RegExp(`${SK}\\s*:(?!\\s*null\\b)`).test(me) && new RegExp(`return \\{ failures, ${SK}: null \\};`).test(me) && !/\.skip\(|test\.skip|process\.exit/.test(me), 'no run function has a skip path: the only skip value this module returns is null (C17-14: an unavailable prerequisite is a failure with evidence)');
      const RUNNERS_REF = { 'R76/C17/head': headGroup, 'R76/C17/ownership': ownershipGroup, 'R90/C17/instructions': instructions, 'A5-templates/C17/host-docs': hostDocs, 'V2/C17/update': update, 'RC1/C17/release': release, 'V2/C17/preservation': preservation, 'V2/C17/contracts': contracts };
      check(eq(ctRunnerBindingIssues(RUNNERS_REF, CT_EXPECTED_RUNNER_BINDINGS), []) && eq(ctRunnerBindingIssues(RUNNERS, CT_EXPECTED_RUNNER_BINDINGS), []), 'every descriptor id is bound to the function the literal table names', ctRunnerBindingIssues(RUNNERS, CT_EXPECTED_RUNNER_BINDINGS));
      const [idA, idB] = Object.keys(RUNNERS);
      const swapped = { ...RUNNERS, [idA]: RUNNERS[idB], [idB]: RUNNERS[idA] };
      const { [idA]: dropped, ...withoutA } = RUNNERS;
      check(ctRunnerBindingIssues(swapped, CT_EXPECTED_RUNNER_BINDINGS).length === 2 && typeof dropped === 'function' && ctRunnerBindingIssues(withoutA, CT_EXPECTED_RUNNER_BINDINGS).length === 2 && ctRunnerBindingIssues({ ...RUNNERS, extra: RUNNERS[idA] }, CT_EXPECTED_RUNNER_BINDINGS).length === 1, 'negative controls: a swapped, a missing and an extra binding are each reported');
    });
    flushProcessCount(context, 'V2/C17/contracts', mark);
  });
}
// The pre-C17 core and review-diff texts, for the F11 control.
function fx17Pre(context) {
  const fx = loadFixture(context);
  return { core: preText(fx, 'assets/tools/git-safe-core.mjs'), reviewDiff: preText(fx, 'assets/tools/review-diff.mjs') };
}

// ===================================================== registration ====
// The eight descriptors of plan C17-14 in the plan's exact order, written out here and never derived from the implementations; rc1-cases.mjs registers the matching literal descriptors independently.
const EXPECTED_DESCRIPTORS = [
  { id: 'R76/C17/head', name: 'checkout HEAD identity is strict bounded and read only' },
  { id: 'R76/C17/ownership', name: 'ownership diagnostics preserve configuration isolation and stop semantics' },
  { id: 'R90/C17/instructions', name: 'reviewer HEAD routing preserves conditional warnings and failure stops' },
  { id: 'A5-templates/C17/host-docs', name: 'living host notes distinguish measured defects from pending rc.4 results' },
  { id: 'V2/C17/update', name: 'rc.1 rc.2 and rc.3 updates deliver the compatible unit with recovery' },
  { id: 'RC1/C17/release', name: 'rc.4 bookkeeping preserves historical candidates and payload membership' },
  { id: 'V2/C17/preservation', name: 'exact amendments preserve C16 and earlier historical boundaries' },
  { id: 'V2/C17/contracts', name: 'C17 registration evaluations and import safety are exact' },
];
const RUNNERS = {
  'R76/C17/head': headGroup,
  'R76/C17/ownership': ownershipGroup,
  'R90/C17/instructions': instructions,
  'A5-templates/C17/host-docs': hostDocs,
  'V2/C17/update': update,
  'RC1/C17/release': release,
  'V2/C17/preservation': preservation,
  'V2/C17/contracts': contracts,
};
export const C17_IMPLEMENTATIONS = Object.freeze(EXPECTED_DESCRIPTORS.map((d) => Object.freeze({ id: d.id, run: (context) => RUNNERS[d.id](context) })));
