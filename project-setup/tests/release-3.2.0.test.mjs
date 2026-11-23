#!/usr/bin/env node
// project-setup 3.2.0 release gate. Standalone: `node tests/release-3.2.0.test.mjs` prints PASS and FAIL lines, a totals line "N PASS / N FAIL / N SKIP", and exits 0 only when
// every assertion passes. Not registered in tests/run-tests.mjs or tests/accept-rc1.mjs (both stay byte-pinned), like tests/release-3.1.test.mjs.
// Plan: docs/plans/2026-11-22-project-setup-v3.2.0-plan.md, section 4.5 (sections A to G below), 5.2 (mutation controls) and the acceptance criteria named on each check.
// Written by the tests lane BEFORE the implementation (plan 4.7 step 1). Every pin that needs final bytes is a stub marked PIN_PENDING: a check that needs one prints a FAIL line
// naming it and never passes silently. The second tests-lane session (4.7 step 3) replaces exactly the stubs in the "independent pins" block and nothing else.
//
// What it proves, and only this:
//  A. The amendment layer (tests/helpers/v320-amendments.mjs and tests/fixtures/v320-prechange.json) is well formed, and the actual bytes of every amended file are the independently
//     pinned 3.1.0 bytes plus exactly the recorded amendments (insertions, and the closed list of replacements, each identity pinned HERE), and the pinned 3.2.0 bytes. The gate
//     engine below is THIS FILE's own: it never asks the helper to decide pass or fail, every identity is pinned here (not read from the helper or the fixture), and the helper
//     and the fixture are compared against these pins, never the reverse.
//  B. The gate and the view are proven by mutation controls on synthetic data, each checked for the intended failure kind (plan 5.2 items 1, 2, 11), without any pin.
//  C. Actual obligations: every 3.1.0 normative line survives (D-4 scope), the root TODO holds exactly its five records, the reviewer and template insertions stand once at their
//     anchors, the shipped policy data is strengthening only (AC-A4-2).
//  D. VERSION, headings and the current public claims say 3.2.0, historical claims stay, and RELEASE-NOTES-3.2.0.md keeps its contract.
//  E. Every other file equals its pinned 3.1.0 bytes and the project-setup file set is the 3.1.0 set plus exactly the eight new files (historical tests and both runners included).
//  F. An isolated install into both targets reports 3.2.0 and adds and removes nothing; the builder builds the zip from a synthetic tagged repository, notes inside the zip only.
//  G. The view identity: buildView (tracked files) then to310Repo gives exactly the pinned 3.1.0 tree, and the unedited release-3.1 and c18 gates pass inside it.
// What it does not prove: agent behaviour, host behaviour (plan section 8), or the duration of the strict gate. Lint: there is none for project-setup (root .prettierignore), so
// no lint result is claimed.
//
// Environment: V320_SCRATCH (a directory outside the OS temp directory, for example D:/ps-live/v320) is where scratch is created; unset means the OS temp directory.
// V320_INCLUDE_UNTRACKED=1 makes section G build the view from tracked and untracked non-ignored files (before a commit exists; the orchestrator sets it, the runner has the same flag).
// Section G runs git with cwd at the repository root: a Git failure there (for example a checkout the user does not own) is a FAIL with its own label, never a skip (plan R2-4).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseBlocks } from '../scripts/blocks.mjs';
import { normalizedHash } from '../scripts/lib.mjs';
import { readSecurityPolicy } from '../assets/tools/security-policy.mjs';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(SKILL, '..');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const absOf = (rel) => (rel.startsWith('@root/') ? path.join(REPO, ...rel.slice(6).split('/')) : path.join(SKILL, ...rel.split('/')));

// ------------------------------------------------------------------------------------------------------------- independent pins ----
// STUBS. Session 2 (plan 4.7 step 3) generates every value below from the git blobs of the base commit and the final working tree with a scratch script outside the repository;
// nothing here is ever read from the helper or the fixture. Until then a check that needs one of them FAILs with the label PIN_PENDING.
const PENDING = 'PIN_PENDING';
const BASE_COMMIT = 'd0cd48e40f8fea897a27b28d7c679e55f0203237';
const BASE_FILES = PENDING; // { "<key>": "<sha256 of the 3.1.0 bytes>" } for EVERY file under project-setup/ (tests included, keys relative to it) and the three "@root/..." files
const NOW_FILES = PENDING; // { "<key>": "<sha256 of the 3.2.0 bytes>" } for every amended skill, root and living-test file and for RELEASE-NOTES-3.2.0.md
const RECORD_PINS = PENDING; // { "<id>": { file, before, old, neu, after } }: file as is, the other four the sha256 of that string (the complete identity of every AM320 record)
const REPLACEMENT_IDS = PENDING; // [ "<id>", ... ] the closed list of non-insertion records (SK320_1, VR320_1, the RM320_/RR320_/PT320_ version lines, TD320_2, AC320_1, C1, BT320_1, P01)
const NORMATIVE_LINES = PENDING; // { "<file>": [ "<16-hex sha256 prefix of the whitespace-squashed line>" ] } the 3.1.0 lines holding MUST, SHOULD or MAY in the normative files
// Pinned now (they need only 3.1.0 bytes that 3.2.0 does not touch):
const TODO_RESIDUAL_SHA = '92977bcb031f0c72d0b871bfcb93a708c4a803c1711de78e104033c7e7c82ee4'; // @root/TODO.md lines 25-32 of the 3.1.0 file, joined with LF plus one final LF (AC-C3-1)
const PRIOR_POLICY_SHA = '37711ab7b8e1781ce533c705971f93351f1331a44b16e11e846080eb8fed1a79'; // normalizedHash of the 3.1.0 data/secret-paths.json (plan A4, PRIOR_SHIPPED.sha256)
const SHA310 = { reviewer: '696f86bc03f8506075e868465a2b34d76b6384a2809ed1e4ea949cc50f6a305c', agents: '616a26a54d2e8f77b0d4df3e78055ca41f6e7638654ad70a0f4d28a0e4eb5a0e', claude: '5bb1d5ed697e921dcc839d031e082f884ca9a97a1eafd8d4a003d2ddb1cbaa47' }; // unchanged since 3.0.0 (tests/release-3.1.test.mjs:102-104)
// ----------------------------------------------------------------------------------------------------------------- end of pins ----

const AMEND_SKILL = ['SKILL.md', 'VERSION', 'README.md', 'CHANGELOG.md', 'references/docs-generation.md', 'references/modes.md', 'references/migration-v2.md', 'references/security.md', 'references/claude.md', 'assets/agents/reviewer.md', 'assets/templates/CLAUDE.md', 'assets/templates/AGENTS.md', 'data/secret-paths.json', 'scripts/detect.mjs', 'scripts/migrate-security-paths.mjs'];
const AMEND_LIVE = ['tests/bs-doc-map.test.mjs', 'tests/live/bs-doc-map.mjs', 'tests/live/BS-DOC-MAP-ACCEPTANCE.md'];
const AMEND_ROOT = ['@root/README.md', '@root/TODO.md', '@root/.ai/context/project-tree.md'];
const AMENDABLE = [...AMEND_SKILL, ...AMEND_LIVE, ...AMEND_ROOT];
const NOTES320 = 'RELEASE-NOTES-3.2.0.md';
const NEW_FILES = ['tests/helpers/v320-amendments.mjs', 'tests/fixtures/v320-prechange.json', 'tests/fixtures/v320-policy-3.1.0.json', 'tests/fixtures/v320-compat-expected.json', 'tests/release-3.2.0.test.mjs', 'tests/v320.test.mjs', 'tests/run-310-view.mjs', NOTES320];
const TODO_RECORDS = ['TD320_1', 'TD320_2', 'TD320_3', 'TD320_4', 'TD320_5'];
const TODO_EXCEPTIONS = ['TD320_2']; // the one non-insertion record of @root/TODO.md at stage 1 (plan 4.5 C)
const INCLUDE = ['SKILL.md', 'VERSION', 'CHANGELOG.md', 'references', 'assets', 'data', 'scripts']; // install/install.mjs:29
const NORMATIVE_SCOPE = (rel) => rel === 'SKILL.md' || /^(?:references|assets\/agents|assets\/templates|data)\//.test(rel); // plan 4.5 C (D-4)

// ------------------------------------------------------------------------------------------------------------------------ harness ----
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: ok === true, detail }); };
const skip = (name, reason) => { results.push({ name, skip: true, detail: reason }); };
const attempt = (fn) => { try { return fn(); } catch (e) { return { threw: String(e && e.message ? e.message : e).split('\n')[0] }; } };
const failedAttempt = (v) => v !== null && typeof v === 'object' && !Buffer.isBuffer(v) && Object.prototype.hasOwnProperty.call(v, 'threw');
const has = (o, k) => o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k);
const lf = (s) => String(s).replace(/\r\n?/g, '\n');
const squash = (s) => lf(s).replace(/\s+/g, ' ').trim();
const lineDigest = (l) => sha(squash(l)).slice(0, 16);
const count = (hay, needle) => (needle === '' ? 0 : hay.split(needle).length - 1);
const KEYWORD = /\b(?:MUST|SHOULD|MAY)\b/; // uppercase RFC 2119 words; MUST NOT and SHOULD NOT contain one
const msgs = (ps) => ps.map((p) => p.msg).slice(0, 8);
const loadModule = async (rel) => { try { return { mod: await import(pathToFileURL(path.join(SKILL, ...rel.split('/'))).href) }; } catch (e) { return { err: String(e && e.message ? e.message : e).split('\n')[0] }; } };
const NOT_YET = (what, err) => `not implemented yet: ${what}${err ? ` (${err})` : ''}`;
/** A check that needs stub pins: FAIL naming PIN_PENDING while any is a stub; else fn() returns boolean or [boolean, detail]. */
const needPins = (name, pins, fn) => {
  const missing = Object.entries(pins).filter(([, v]) => v === PENDING).map(([k]) => k);
  if (missing.length > 0) { check(name, false, `${PENDING}: ${missing.join(', ')} not written yet (session 2)`); return; }
  const r = fn();
  if (Array.isArray(r)) check(name, r[0], r[1]); else check(name, r);
};
const SCRATCH_ROOT = process.env.V320_SCRATCH ? path.resolve(process.env.V320_SCRATCH) : os.tmpdir();
fs.mkdirSync(SCRATCH_ROOT, { recursive: true });
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(SCRATCH_ROOT, 'ps-r320-')));
let seq = 0;
const scratchDir = (name) => { const d = path.join(scratch, `${name}-${++seq}`); fs.mkdirSync(d, { recursive: true }); return d; };

// ---------------------------------------------------------------------------------------------------------------- the gate engine ----
// Records are { file, before, old, neu, after }: before + old + after is the 3.1.0 slice and before + neu + after the 3.2.0 slice (exactly once, at a line boundary).
const ID_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const REC_KEYS = ['after', 'before', 'file', 'neu', 'old'];
function occurrences(text, needle) { const out = []; if (needle === '') return out; for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) out.push(i); return out; }
function reverseRec(text, r) { const key = r.before + r.neu + r.after; const at = occurrences(text, key); if (at.length !== 1) return null; return text.slice(0, at[0]) + r.before + r.old + r.after + text.slice(at[0] + key.length); }
function applyRec(text, r) { const key = r.before + r.old + r.after; const at = occurrences(text, key); if (at.length !== 1) return null; return text.slice(0, at[0]) + r.before + r.neu + r.after + text.slice(at[0] + key.length); }
// A heuristic, not a proof: phrases that would grant a new exception to an inherited approval, root-start, security or ownership rule (the list of tests/release-3.1.test.mjs:535-542).
const WEAKENERS = Object.freeze([
  [/\bapproval (?:is|are) (?:not (?:required|needed)|optional)\b/i, 'approval made optional'],
  [/\bno approval (?:is )?(?:needed|required)\b/i, 'approval made unnecessary'],
  [/\b(?:need not|does not need to|do not need to|no need to) (?:obtain|ask for|request|get) (?:\w+ ){0,2}approval\b/i, 'approval made unnecessary'],
  [/\b(?:MAY|may|can|is allowed to|are allowed to) (?:skip|bypass|waive|ignore|override)\b[^.\n]{0,60}\b(?:approval|security|secret|root[- ]start|ownership|manifest|drift|user[- ]content|review)/, 'a permission to skip an inherited rule'],
  [/\boverrides? (?:the )?(?:security|root[- ]start|approval|ownership)\b/i, 'an override of an inherited rule'],
  [/\bexempt(?:ed)? from (?:the )?(?:approval|security|root[- ]start|ownership|drift)\b/i, 'an exemption from an inherited rule'],
]);
function recordProblems(id, r, cfg, add) {
  if (!ID_RE.test(id)) add('shape', null, id, `${id}: the id is not a plain identifier (no wildcard or pattern ids)`);
  if (r === null || typeof r !== 'object' || Array.isArray(r)) { add('shape', null, id, `${id}: the record is not an object`); return; }
  const file = typeof r.file === 'string' ? r.file : null;
  if (JSON.stringify(Object.keys(r).sort()) !== JSON.stringify(REC_KEYS)) add('shape', file, id, `${id}: the record keys are not exactly ${REC_KEYS.join(', ')}`);
  if (REC_KEYS.some((k) => typeof r[k] !== 'string')) { add('shape', file, id, `${id}: a record field is not a string`); return; }
  if (/[*?[\]{}\\]|\.\./.test(r.file) || r.file === '') add('shape', file, id, `${id}: the file key is empty or holds a wildcard, backslash or parent segment`);
  if (!cfg.amendable.has(r.file)) add('shape', file, id, `${id}: ${r.file} is not in the closed amendable set`);
  if ([r.before, r.old, r.neu, r.after].some((s) => s.includes('\r'))) add('shape', file, id, `${id}: a field holds a CR (LF only)`);
  if (r.old === r.neu) add('shape', file, id, `${id}: no-op record (old equals neu)`);
  if (r.neu === '') add('shape', file, id, `${id}: neu is empty: a deletion, which 3.2.0 does not have (the sign-off closeout is a later stage)`);
  else if (!r.neu.endsWith('\n')) add('shape', file, id, `${id}: neu is not line aligned (no final LF)`);
  if (r.old === '') {
    if (r.before === '' && r.after === '') add('shape', file, id, `${id}: the insertion has no anchor`);
  } else {
    if (!r.old.endsWith('\n')) add('shape', file, id, `${id}: old is not whole lines (no final LF)`);
    if (!cfg.replacementIds.has(id)) add('approved', file, id, `${id}: a replacement that is not on the closed list (a new, renamed or re-identified replacement)`);
    if (cfg.isNormative(r.file) && KEYWORD.test(r.old)) add('keyword', file, id, `${id}: old holds an RFC 2119 keyword (MUST, SHOULD or MAY) in a normative file, so it would remove an obligation`);
    if (r.file === '@root/TODO.md' && !cfg.todoExceptions.has(id)) add('todo', file, id, `${id}: a replacement in @root/TODO.md that is not in the pinned exception list`);
  }
  const pin = has(cfg.recordPins, id) ? cfg.recordPins[id] : undefined;
  if (pin === undefined) add('identity', file, id, `${id}: the record has no pinned identity (a new or renamed record)`);
  else for (const k of REC_KEYS) { const got = k === 'file' ? r.file : sha(r[k]); if (got !== pin[k]) add('identity', file, id, `${id}: ${k} differs from the pinned identity`); }
}
/** cfg: { actual:{key:text}, records, forward:{key:[ids]}, amendable:Set, pins:{key:sha}, recordPins, replacementIds:Set, todoExceptions:Set, isNormative:fn, normative?:{file:[digest]} }. */
function gate(cfg) {
  const problems = [];
  const add = (kind, file, id, msg) => problems.push({ kind, file, id, msg });
  const baseline = {};
  const owner = new Map();
  for (const [file, list] of Object.entries(cfg.forward)) {
    if (!cfg.amendable.has(file)) add('order', file, null, `${file}: ordered, but not in the closed amendable set`);
    for (const id of list) {
      if (owner.has(id)) add('order', file, id, `${id}: listed more than once in the forward order`);
      owner.set(id, file);
      if (!has(cfg.records, id)) add('order', file, id, `${id}: ordered but has no record`);
      else if (cfg.records[id] && cfg.records[id].file !== file) add('order', file, id, `${id}: ordered under ${file} but its record names ${cfg.records[id].file}`);
    }
  }
  for (const id of Object.keys(cfg.records)) if (!owner.has(id)) add('order', cfg.records[id] && cfg.records[id].file, id, `${id}: the record is not listed in any forward order`);
  for (const file of cfg.amendable) {
    const actual = cfg.actual[file];
    const list = (cfg.forward[file] ?? []).filter((id) => has(cfg.records, id));
    if (typeof actual !== 'string') { add('chain', file, null, `${file}: the actual text is unavailable`); baseline[file] = null; continue; }
    let t = actual; let ok = true;
    for (const id of [...list].reverse()) {
      const r = cfg.records[id];
      if (r === null || typeof r !== 'object' || REC_KEYS.some((k) => typeof r[k] !== 'string')) { ok = false; break; }
      const at = occurrences(t, r.before + r.neu + r.after);
      if (at.length !== 1) { add('chain', file, id, `${file}: ${id} does not stand exactly once at its anchor (found ${at.length})`); ok = false; break; }
      const pos = at[0] + r.before.length;
      if (pos !== 0 && t[pos - 1] !== '\n') add('shape', file, id, `${id}: the amendment does not start at a line boundary`);
      t = reverseRec(t, r);
    }
    baseline[file] = ok ? t : null;
    if (!ok) continue;
    if (sha(t) !== cfg.pins[file]) add('pin', file, null, `${file}: the reversed text is not the pinned 3.1.0 bytes (sha256 ${sha(t).slice(0, 12)}...)`);
    let f = t;
    for (const id of list) f = f === null ? null : applyRec(f, cfg.records[id]);
    if (f !== actual) add('roundtrip', file, null, `${file}: applying the records to the 3.1.0 bytes does not give the actual file`);
  }
  for (const [id, r] of Object.entries(cfg.records)) recordProblems(id, r, cfg, add);
  for (const id of Object.keys(cfg.recordPins)) if (!has(cfg.records, id)) add('identity', cfg.recordPins[id].file, id, `${id}: a pinned record has no record (removed or renamed)`);
  for (const id of cfg.replacementIds) if (!has(cfg.records, id)) add('approved', null, id, `${id}: a closed-list replacement has no record`);
  for (const [id, r] of Object.entries(cfg.records)) {
    if (!r || typeof r.neu !== 'string') continue;
    for (const [rx, what] of WEAKENERS) if (rx.test(r.neu)) add('weaken', r.file, id, `${id}: new text carries ${what}`);
  }
  for (const [file, digests] of Object.entries(cfg.normative ?? {})) {
    if (typeof cfg.actual[file] !== 'string') continue;
    const have = new Set(lf(cfg.actual[file]).split('\n').map(lineDigest));
    const missing = digests.filter((d) => !have.has(d)).length;
    if (missing > 0) add('obligation', file, null, `${file}: ${missing} 3.1.0 normative line(s) are missing from the actual file`);
  }
  return { problems, baseline };
}
/** The file-set comparison of section E: now and base are Maps key -> sha256; newFiles and amended are key lists. */
function treeProblems(now, base, newFiles, amended) {
  const allowed = new Set([...base.keys(), ...newFiles]);
  const amend = new Set(amended);
  return {
    extra: [...now.keys()].filter((k) => !allowed.has(k)).sort(),
    missing: [...allowed].filter((k) => !now.has(k)).sort(),
    changed: [...base.keys()].filter((k) => !amend.has(k) && now.has(k) && now.get(k) !== base.get(k)).sort(),
  };
}

// ----------------------------------------------------------------------------------------- notes, claims and acceptance engines ----
function sectionOf(text, rx) {
  const ls = lf(text).split('\n');
  const i = ls.findIndex((l) => rx.test(l));
  if (i < 0) return null;
  const level = /^#+/.exec(ls[i])[0].length;
  let j = i + 1;
  while (j < ls.length && !(/^#+ /.test(ls[j]) && /^#+/.exec(ls[j])[0].length <= level)) j++;
  return ls.slice(i, j).join('\n');
}
/** The notes contract (plan 4.5 D and C3): returns the list of problems of a RELEASE-NOTES-3.2.0.md buffer. */
function notesProblems(buf, version = '3.2.0') {
  const p = [];
  if (!Buffer.isBuffer(buf)) return ['the notes are unreadable'];
  const t = buf.toString('utf8');
  if (buf.length === 0) return ['the notes are empty'];
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) p.push('BOM');
  if (buf.includes(0x0d)) p.push('CR (LF only)');
  if (/[^\x00-\x7f]/.test(buf.toString('latin1'))) p.push('non-ASCII');
  if (!t.endsWith('\n') || t.endsWith('\n\n')) p.push('not exactly one final LF');
  if (/(?<![0-9A-Fa-f])(?:[0-9A-Fa-f]{40}|[0-9A-Fa-f]{64})(?![0-9A-Fa-f])/.test(t)) p.push('a standalone 40- or 64-hex ID (install/release.mjs:55)');
  if (/[A-Za-z]:\\Users\\|\\Users\\|\/home\/|\/Users\//.test(t)) p.push('a personal path');
  if (!t.startsWith(`# project-setup ${version}\n`)) p.push(`the title is not "# project-setup ${version}"`);
  const h = t.split('\n').filter((l) => /^#{2,3} /.test(l));
  if (!h.some((l) => /compatib/i.test(l))) p.push('no heading covers compatibility');
  if (!h.some((l) => /verif/i.test(l))) p.push('no heading covers the verification commands');
  if (!h.some((l) => /limitation/i.test(l))) p.push('no heading covers the known limitations');
  const up = sectionOf(t, /^## Upgrading\b/);
  if (up === null) p.push('no "## Upgrading" section');
  else {
    const steps = up.split('\n').filter((l) => /^\d+\. \S/.test(l));
    if (steps.length < 5 || steps.some((l, i) => !l.startsWith(`${i + 1}. `))) p.push('Upgrading does not hold the numbered steps 1 to 5 in order');
    if (!steps.some((l) => /backup/i.test(l) && /\.meta\.json/.test(l) && /skills director/i.test(l))) p.push('no numbered step moves the installer backup and its .meta.json out of the skills directory');
    if (!steps.some((l) => /\benv\//.test(l) && /\bcert\//.test(l) && /Phase 0/.test(l))) p.push('no numbered step states the tracked root env/ and cert/ files and the Phase 0 stop');
    if (!steps.some((l) => /coverage/i.test(l))) p.push('no numbered step covers the two coverage decisions on update');
  }
  const ver = h.find((l) => /verif/i.test(l));
  const verSec = ver === undefined ? null : sectionOf(t, new RegExp(`^${ver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  if (verSec !== null) {
    if (!verSec.includes('run-310-view.mjs')) p.push('the verification section does not name the view runner tests/run-310-view.mjs');
    if (!/\bCI\b/.test(verSec) || !/(?:does not|do not|not) run|runs? no\b|only .*format/i.test(verSec)) p.push('the verification section does not say that CI does not run the historical gates');
  }
  const nm = sectionOf(t, /^#{2,3} Not measured\b/);
  if (nm === null) p.push('no "Not measured" section');
  else {
    if (!nm.split('\n').slice(1).some((l) => /^(?:- |\d+\. )\S/.test(l))) p.push('the "Not measured" section holds no list');
    if (!/root[- ]anchor/i.test(nm) || !/render/i.test(nm)) p.push('the "Not measured" section does not scope the root-anchor claim to static rendering');
  }
  if (!/known issue/i.test(t) || !/3\.1\.0/.test(t)) p.push('the correction of the 3.1.0 known issue is not stated');
  return p;
}
const ACC_DIRS = ['$env:USERPROFILE\\.claude\\skills', '$env:USERPROFILE\\.agents\\skills'];
/** The acceptance-document rule (AC-C1-2; tests/release-3.1.test.mjs:1213-1243): the only user paths are the two $env:USERPROFILE skill directories. */
function accProblems(text) {
  if (typeof text !== 'string') return ['the acceptance document is not text'];
  const p = [];
  if (/[A-Za-z]:\\Users\\|\/home\/|\/Users\//.test(text)) p.push('it names a personal path');
  for (const tok of ['%USERPROFILE%', '$HOME', '$env:HOME', '%HOMEPATH%', '$env:LOCALAPPDATA', '$env:APPDATA', '~/', '~\\']) if (text.includes(tok)) p.push('it uses another home-relative spelling (' + tok + ')');
  const used = [...new Set(text.match(/\$env:USERPROFILE(?:\\[A-Za-z0-9_.-]+)*/g) ?? [])];
  for (const u of used) if (!ACC_DIRS.some((d) => u === d || u.startsWith(d + '\\'))) p.push('it names a user path other than the two skill directories (' + u + ')');
  for (const d of ACC_DIRS) if (!used.some((u) => u === d || u.startsWith(d + '\\'))) p.push('it does not name ' + d);
  if (!text.includes('bs-doc-map.mjs')) p.push('it does not name the live helper bs-doc-map.mjs');
  return p;
}
const MODES_OBSERVATION = 'A real Nest CLI 11 scaffold was exercised with BS followed by PS adopt on 2026-11-11. Prepare held CLAUDE.md and both standalone Claude agents for approval. That run did not exercise the agents, Codex, or PS followed by BS, and did not verify the 3.1 pointer workflow.';
const MD320_1 = 'The 3.1.0 live acceptance (2026-11-14 to 2026-11-22) later exercised the agents on both hosts and PS followed by BS (merge branch only); see RELEASE-NOTES-3.1.0.md.';
/** t: { VERSION, SKILL, PSREADME, CHANGELOG, ROOTREADME, TREE, MODES } as text. The current public claims of 3.2.0; returns [{ area, msg }]. */
function claimsProblems(t) {
  const p = [];
  const bad = (area, msg) => p.push({ area, msg });
  if (t.VERSION !== '3.2.0\n') bad('VERSION', 'VERSION is not exactly "3.2.0" plus one LF');
  const sk = lf(t.SKILL ?? '');
  const skHeads = sk.split('\n').filter((l) => /^# /.test(l));
  if (skHeads[0] !== '# project-setup 3.2.0' || skHeads.includes('# project-setup 3.1.0')) bad('SKILL', 'the SKILL.md title heading is not "# project-setup 3.2.0"');
  const rd = lf(t.PSREADME ?? '');
  const open = rd.split('\n## ')[0];
  if (rd.split('\n')[0] !== '# project-setup 3.2.0 - skill source') bad('PSREADME', 'the PS README title is not "# project-setup 3.2.0 - skill source"');
  if (!open.includes(NOTES320) || open.includes('RELEASE-NOTES-3.1.0.md')) bad('PSREADME', 'the opening release sentence does not cite RELEASE-NOTES-3.2.0.md in place of the 3.1.0 notes');
  for (const g of ['release-3.2.0.test.mjs', 'v320.test.mjs', 'run-310-view.mjs', 'bs-doc-map.test.mjs']) if (!rd.includes(g)) bad('PSREADME', `the README does not name ${g}`);
  const tagLines = rd.split('\n').filter((l) => /project-setup-v3\.\d+\.\d+/.test(l));
  if (tagLines.length === 0 || tagLines.some((l) => !l.includes('project-setup-v3.2.0') || /project-setup-v3\.1\.0/.test(l))) bad('PSREADME', 'the local release section does not carry the 3.2.0 tag token alone');
  const cl = lf(t.CHANGELOG ?? '');
  if (!cl.startsWith('# Changelog\n\n## 3.2.0\n') || cl.split('\n## 3.2.0\n').length !== 2) bad('CHANGELOG', 'the changelog does not start with one "## 3.2.0" entry');
  if (!(cl.indexOf('\n## 3.2.0\n') < cl.indexOf('\n## 3.1.0\n') && cl.indexOf('\n## 3.1.0\n') > 0)) bad('CHANGELOG', 'the 3.1.0 entry is not kept after the 3.2.0 entry');
  const rr = lf(t.ROOTREADME ?? '');
  for (const [rx, what] of [[/\(3\.1\.0, shared by Claude Code and Codex\)/, 'the introduction version'], [/installs `project-setup` 3\.1\.0/, 'the install sentence'], [/\(3\.1\.0, own installer and tests\)/, 'the layout tree line']]) if (rx.test(rr)) bad('ROOTREADME', `a stale current 3.1.0 claim remains: ${what}`);
  if (rr.split('\n').filter((l) => /\b3\.2\.0\b/.test(l)).length < 3) bad('ROOTREADME', 'fewer than three current 3.2.0 claims (introduction, install, layout)');
  if (!rr.includes(NOTES320)) bad('ROOTREADME', 'the root README does not cite RELEASE-NOTES-3.2.0.md');
  if (!/project-setup\/\s+general-purpose.*\(3\.2\.0\b/.test(rr)) bad('ROOTREADME', 'the layout tree line does not say 3.2.0');
  const tr = lf(t.TREE ?? '');
  if (!/project-setup\/\s+skill 3 .*\(3\.2\.0\)/.test(tr) || !tr.includes('`project-setup/VERSION` is `3.2.0`')) bad('TREE', 'the project tree does not say 3.2.0 for the skill line and VERSION');
  if (/project-setup\/\s+skill 3 .*\(3\.1\.0\)/.test(tr) || tr.includes('`project-setup/VERSION` is `3.1.0`')) bad('TREE', 'a stale current 3.1.0 claim remains in the project tree');
  const md = squash(lf(t.MODES ?? ''));
  if (md.split(MODES_OBSERVATION).length !== 2) bad('MODES', 'the dated 3.1.0 scaffold observation (lines 74-76) is not present exactly once');
  if (md.split(MD320_1).length !== 2) bad('MODES', 'the [MD320_1] observation is not present exactly once');
  else if (md.indexOf(MD320_1) < md.indexOf(MODES_OBSERVATION)) bad('MODES', 'the [MD320_1] observation is not after the dated statement it follows');
  return p;
}

// ============================================================================================ A. the amendment layer on the actual bytes ====
const LH = await loadModule('tests/helpers/v320-amendments.mjs');
const LR = await loadModule('tests/run-310-view.mjs');
const H = LH.mod ?? null;
const RUN = LR.mod ?? null;
const FIXTURE_PATH = path.join(SKILL, 'tests', 'fixtures', 'v320-prechange.json');
const FIX_RAW = attempt(() => fs.readFileSync(FIXTURE_PATH, 'utf8'));
const FIX = failedAttempt(FIX_RAW) ? FIX_RAW : attempt(() => JSON.parse(FIX_RAW));
const FIX_OK = !failedAttempt(FIX) && FIX !== null && typeof FIX === 'object';
const ACTUAL = Object.fromEntries(AMENDABLE.map((k) => [k, attempt(() => fs.readFileSync(absOf(k), 'utf8'))]));
const actualText = (k) => (typeof ACTUAL[k] === 'string' ? ACTUAL[k] : '');
const PINS_READY = ![BASE_FILES, NOW_FILES, RECORD_PINS, REPLACEMENT_IDS, NORMATIVE_LINES].includes(PENDING);

check('the helper tests/helpers/v320-amendments.mjs exists and imports', H !== null, NOT_YET('tests/helpers/v320-amendments.mjs', LH.err));
const NAMES = ['AM320', 'FORWARD_ORDER320', 'REVERSAL_ORDER320', 'AMENDED_FILES320', 'NEW_FILES320', 'CURRENT_VERSION320', 'VIEW_COPY_SET', 'reverseSteps', 'applySteps', 'reverseForFile', 'applyForFile', 'read310', 'buildView', 'to310Repo', 'overlay'];
check('the helper exports AM320, the three orders, NEW_FILES320, CURRENT_VERSION320, VIEW_COPY_SET and the eight functions', H !== null && NAMES.every((n) => n in H) && ['reverseSteps', 'applySteps', 'reverseForFile', 'applyForFile', 'read310', 'buildView', 'to310Repo', 'overlay'].every((n) => typeof H[n] === 'function'), H === null ? NOT_YET('helper') : NAMES.filter((n) => !(n in H)));
check('CURRENT_VERSION320 is exactly "3.2.0"', H !== null && H.CURRENT_VERSION320 === '3.2.0', H === null ? NOT_YET('helper') : H.CURRENT_VERSION320);
check('NEW_FILES320 is exactly this spec\'s closed list of eight paths (plan 4.2), and the helper\'s base commit is the pinned one', H !== null && JSON.stringify([...H.NEW_FILES320].sort()) === JSON.stringify([...NEW_FILES].sort()) && H.BASE_COMMIT320 === BASE_COMMIT, H === null ? NOT_YET('helper') : { files: H.NEW_FILES320, base: H.BASE_COMMIT320 });
const shapeFrozen = H !== null && has(H, 'AM320') && Object.isFrozen(H.AM320) && Object.values(H.AM320).every((r) => Object.isFrozen(r) && JSON.stringify(Object.keys(r).sort()) === JSON.stringify(REC_KEYS) && REC_KEYS.every((k) => typeof r[k] === 'string'));
const hasRecords = H !== null && has(H, 'AM320') && Object.keys(H.AM320).length > 0;
check('AM320 holds the records of the final amendments (it is empty until session 2 writes them) and every record is frozen with exactly the keys file, before, old, neu, after as strings', shapeFrozen && hasRecords, H === null ? NOT_YET('AM320') : hasRecords ? undefined : `${PENDING}: AM320 is empty (session 2 writes the literals)`);
const orderOk = (() => {
  if (H === null || !has(H, 'FORWARD_ORDER320') || !has(H, 'REVERSAL_ORDER320') || !has(H, 'AMENDED_FILES320') || !hasRecords) return false;
  const f = H.FORWARD_ORDER320; const r = H.REVERSAL_ORDER320;
  if (!Object.isFrozen(f) || !Object.isFrozen(r) || !Object.values(f).every((a) => Array.isArray(a) && Object.isFrozen(a))) return false;
  if (JSON.stringify(H.AMENDED_FILES320) !== JSON.stringify(Object.keys(f)) || JSON.stringify(Object.keys(r)) !== JSON.stringify(Object.keys(f))) return false;
  if (!Object.keys(f).every((k) => JSON.stringify([...f[k]].reverse()) === JSON.stringify(r[k]))) return false;
  const listed = Object.values(f).flat();
  return new Set(listed).size === listed.length && listed.length === Object.keys(H.AM320).length && Object.keys(f).every((k) => f[k].every((id) => has(H.AM320, id) && H.AM320[id].file === k));
})();
check('FORWARD_ORDER320 lists every record exactly once under its own file, REVERSAL_ORDER320 is its exact reverse and AMENDED_FILES320 its key list', orderOk, H === null ? NOT_YET('orders') : hasRecords ? undefined : `${PENDING}: the orders are empty (session 2)`);
check('every amended file is inside the closed amendable set of 21 files (15 skill, 3 living test, 3 root)', H !== null && hasRecords && H.AMENDED_FILES320.every((k) => AMENDABLE.includes(k)) && AMENDABLE.length === 21, H === null ? NOT_YET('AMENDED_FILES320') : hasRecords ? H.AMENDED_FILES320 : `${PENDING}: no amended file is listed yet`);

check('the fixture tests/fixtures/v320-prechange.json exists and parses', FIX_OK, NOT_YET('tests/fixtures/v320-prechange.json', failedAttempt(FIX) ? FIX.threw : undefined));
check('the fixture has exactly the keys schema, baseCommit, files, replacements, with schema 1 and the pinned base commit', FIX_OK && JSON.stringify(Object.keys(FIX).sort()) === JSON.stringify(['baseCommit', 'files', 'replacements', 'schema']) && FIX.schema === 1 && FIX.baseCommit === BASE_COMMIT, FIX_OK ? { keys: Object.keys(FIX), schema: FIX.schema, base: FIX.baseCommit } : NOT_YET('fixture'));
needPins('the fixture files table is exactly this spec\'s 3.1.0 pins: every file under project-setup/ and the three root files, each { sha256, bytes } with the pinned sha256', { BASE_FILES }, () => [FIX_OK && typeof FIX.files === 'object' && FIX.files !== null && JSON.stringify(Object.keys(FIX.files).sort()) === JSON.stringify(Object.keys(BASE_FILES).sort()) && Object.keys(BASE_FILES).every((k) => JSON.stringify(Object.keys(FIX.files[k]).sort()) === '["bytes","sha256"]' && FIX.files[k].sha256 === BASE_FILES[k]), FIX_OK ? Object.keys(FIX.files ?? {}).length : NOT_YET('fixture')]);
const fixReps = FIX_OK && typeof FIX.replacements === 'object' && FIX.replacements !== null ? FIX.replacements : null;
check('the fixture replacements are one entry per AM320 record with a nonempty old, { file, oldSha256, neuSha256 } with the digests of that record\'s old and neu, and no other entry', fixReps !== null && shapeFrozen && hasRecords && (() => { const reps = Object.entries(H.AM320).filter(([, r]) => r.old !== ''); return reps.length === Object.keys(fixReps).length && reps.every(([id, r]) => has(fixReps, id) && JSON.stringify(Object.keys(fixReps[id]).sort()) === '["file","neuSha256","oldSha256"]' && fixReps[id].file === r.file && fixReps[id].oldSha256 === sha(r.old) && fixReps[id].neuSha256 === sha(r.neu)); })(), fixReps === null || !hasRecords ? NOT_YET('fixture and helper') : undefined);
check('the fixture holds no personal path, no secret-shaped string and no file text', typeof FIX_RAW === 'string' && !/[A-Za-z]:\\\\Users|\/home\/|\/Users\/|ghp_[A-Za-z0-9]{20}|AKIA[0-9A-Z]{12}|BEGIN [A-Z ]*PRIVATE KEY/.test(FIX_RAW) && FIX_OK && !JSON.stringify(Object.values(FIX.files ?? {}).map((v) => Object.keys(v))).includes('text'), typeof FIX_RAW === 'string' ? undefined : NOT_YET('fixture'));
needPins('the pins are well formed: the pinned records are frozen plain-identifier entries with file in the amendable set and four 64-hex digests, the TODO exception is inside the replacement list, and every replacement id has a pinned record', { RECORD_PINS, REPLACEMENT_IDS }, () => [Object.keys(RECORD_PINS).every((id) => ID_RE.test(id) && AMENDABLE.includes(RECORD_PINS[id].file) && ['before', 'old', 'neu', 'after'].every((k) => /^[0-9a-f]{64}$/.test(RECORD_PINS[id][k]))) && REPLACEMENT_IDS.every((id) => has(RECORD_PINS, id) && RECORD_PINS[id].old !== sha('')) && TODO_EXCEPTIONS.every((id) => REPLACEMENT_IDS.includes(id)), undefined]);

const realReady = PINS_READY && shapeFrozen && orderOk && AMENDABLE.every((k) => typeof ACTUAL[k] === 'string');
const REAL = realReady ? gate({ actual: ACTUAL, records: H.AM320, forward: H.FORWARD_ORDER320, amendable: new Set(AMENDABLE), pins: Object.fromEntries(AMENDABLE.map((k) => [k, BASE_FILES[k]])), recordPins: RECORD_PINS, replacementIds: new Set(REPLACEMENT_IDS), todoExceptions: new Set(TODO_EXCEPTIONS), isNormative: NORMATIVE_SCOPE, normative: NORMATIVE_LINES }) : null;
check('the gate can run on the actual bytes (every pin, the helper records and orders written, all 21 amendable files readable)', REAL !== null, !PINS_READY ? `${PENDING}: ${[['BASE_FILES', BASE_FILES], ['NOW_FILES', NOW_FILES], ['RECORD_PINS', RECORD_PINS], ['REPLACEMENT_IDS', REPLACEMENT_IDS], ['NORMATIVE_LINES', NORMATIVE_LINES]].filter(([, v]) => v === PENDING).map(([n]) => n).join(', ')} not written yet (session 2)` : NOT_YET('the amendment layer'));
if (REAL !== null) {
  for (const k of AMENDABLE) {
    const mine = REAL.problems.filter((q) => q.file === k && q.kind !== 'obligation');
    check(`${k}: the actual bytes are the pinned 3.1.0 bytes plus exactly the recorded amendments (reversal, pin, round trip, shapes, identities, closed replacement list)`, mine.length === 0, msgs(mine));
    check(`${k}: the actual bytes equal the pinned 3.2.0 bytes`, NOW_FILES[k] !== undefined && sha(Buffer.from(actualText(k), 'utf8')) === NOW_FILES[k], NOW_FILES[k] === undefined ? 'no 3.2.0 pin' : sha(Buffer.from(actualText(k), 'utf8')));
    check(`${k}: LF only, no BOM, exactly one final LF`, typeof ACTUAL[k] === 'string' && !ACTUAL[k].includes('\r') && ACTUAL[k].charCodeAt(0) !== 0xfeff && ACTUAL[k].endsWith('\n') && !ACTUAL[k].endsWith('\n\n'), undefined);
  }
  check('the amendment records and orders are consistent (no unlisted, duplicated or misfiled record, no pattern id, no unpinned record, no pin without a record)', REAL.problems.filter((q) => q.kind === 'order' || q.kind === 'identity' || (q.file === null && q.kind !== 'obligation')).length === 0, msgs(REAL.problems.filter((q) => q.kind === 'order' || q.kind === 'identity' || q.file === null)));
  check('every non-insertion record is on the closed list, whole lines, with no RFC 2119 word in old inside a normative file, and every @root/TODO.md replacement is in the pinned exception list', REAL.problems.filter((q) => ['approved', 'keyword', 'todo'].includes(q.kind)).length === 0, msgs(REAL.problems.filter((q) => ['approved', 'keyword', 'todo'].includes(q.kind))));
  check('no amendment text carries a listed weakening phrase (approval, root-start, security, ownership exceptions)', REAL.problems.filter((q) => q.kind === 'weaken').length === 0, msgs(REAL.problems.filter((q) => q.kind === 'weaken')));
  for (const k of H.AMENDED_FILES320) {
    const back = attempt(() => H.reverseForFile(ACTUAL[k], k));
    check(`${k}: the helper's reverseForFile gives this spec's reversal (the pinned 3.1.0 bytes) and applyForFile gives the actual file back`, !failedAttempt(back) && back.text === REAL.baseline[k] && attempt(() => H.applyForFile(REAL.baseline[k], k)) === ACTUAL[k], failedAttempt(back) ? back : back.failed);
    check(`${k}: control: reversing the 3.1.0 bytes again is refused by the helper`, attempt(() => H.reverseForFile(REAL.baseline[k], k)).text === null);
    check(`${k}: read310 of the real file is the pinned 3.1.0 bytes`, (() => { const b = attempt(() => H.read310(absOf(k))); return Buffer.isBuffer(b) && sha(b) === BASE_FILES[k]; })());
    const ids = H.FORWARD_ORDER320[k]; const last = H.AM320[ids[ids.length - 1]]; const keyLast = last.before + last.neu + last.after;
    const mutate = (text) => gate({ actual: { ...ACTUAL, [k]: text }, records: H.AM320, forward: H.FORWARD_ORDER320, amendable: new Set(AMENDABLE), pins: Object.fromEntries(AMENDABLE.map((x) => [x, BASE_FILES[x]])), recordPins: RECORD_PINS, replacementIds: new Set(REPLACEMENT_IDS), todoExceptions: new Set(TODO_EXCEPTIONS), isNormative: NORMATIVE_SCOPE }).problems.some((q) => q.file === k && ['chain', 'pin', 'roundtrip'].includes(q.kind));
    const muts = [['missing', ACTUAL[k].replace(keyLast, () => last.before + last.old + last.after)], ['duplicated', ACTUAL[k].replace(keyLast, () => `${last.before}${last.neu}${last.neu}${last.after}`)], ['altered', last.neu.length > 1 ? ACTUAL[k].replace(keyLast, () => `${last.before}${last.neu.slice(0, -2)}#\n${last.after}`) : null], ['appended', `${ACTUAL[k]}Unrecorded line.\n`]].filter(([, m]) => m !== null && m !== ACTUAL[k]);
    check(`${k}: gate control on the real bytes: a missing, a duplicated, an altered and an appended unrecorded last amendment are each rejected`, muts.length >= 3 && muts.every(([, m]) => mutate(m)), Object.fromEntries(muts.map(([n, m]) => [n, mutate(m)])));
  }
}

// ======================================================================================================= B. mutation controls (plan 5.2) ====
const synthText = (ls) => `${ls.join('\n')}\n`;
const SYN_BASE = {
  'SKILL.md': synthText(['# project-setup 3.1.0', '', 'Intro line.', '', '- The agent MUST confirm before writing.', '- The agent SHOULD NOT log secrets.', '', 'Tail paragraph.']),
  'references/a.md': synthText(['# Ref A', '', 'Rule one: the agent MUST stop.', 'Anchor line A.', 'Anchor line B.', '', 'End.']),
  'README.md': synthText(['# readme 3.1.0', 'Version 3.1.0 here.', 'Done.']),
  '@root/TODO.md': synthText(['# TODO', '', '- Item one.', '  Status text.', '', '- Item two.', 'Last.']),
};
const R = (file, before, old, neu, after) => ({ file, before, old, neu, after });
const SYN_RECORDS = () => ({
  SK1: R('SKILL.md', '', '# project-setup 3.1.0\n', '# project-setup 3.2.0\n', ''),
  SK2: R('SKILL.md', 'Intro line.\n', '', 'Inserted paragraph.\n', '\n- The agent MUST confirm before writing.\n'),
  RA1: R('references/a.md', 'Anchor line A.\n', '', 'New rule: the agent MUST NOT skip.\n', 'Anchor line B.\n'),
  RM1: R('README.md', '', 'Version 3.1.0 here.\n', 'Version 3.2.0 here.\n', ''),
  TD1: R('@root/TODO.md', '  Status text.\n', '', '  Status 2026-11-22: shipped as text only.\n', '\n- Item two.\n'),
  TD2: R('@root/TODO.md', '', 'Last.\n', 'Last, updated.\n', ''),
});
const SYN_FORWARD = () => ({ 'SKILL.md': ['SK1', 'SK2'], 'references/a.md': ['RA1'], 'README.md': ['RM1'], '@root/TODO.md': ['TD1', 'TD2'] });
const SYN_FILES = Object.keys(SYN_BASE);
const recordPinsOf = (records) => Object.fromEntries(Object.entries(records).map(([id, r]) => [id, { file: r.file, before: sha(r.before), old: sha(r.old), neu: sha(r.neu), after: sha(r.after) }]));
const SYN_REPL = ['SK1', 'RM1', 'TD2'];
const SYN_NORM = Object.fromEntries(['SKILL.md', 'references/a.md'].map((f) => [f, SYN_BASE[f].split('\n').filter((l) => KEYWORD.test(l)).map(lineDigest)]));
const applyAll = (base, records, forward) => { const out = { ...base }; for (const [f, ids] of Object.entries(forward)) for (const id of ids) out[f] = applyRec(out[f], records[id]); return out; };
const GOOD = { records: SYN_RECORDS(), forward: SYN_FORWARD() };
GOOD.actual = applyAll(SYN_BASE, GOOD.records, GOOD.forward);
GOOD.recordPins = recordPinsOf(GOOD.records);
/** One synthetic gate run: over = { records, forward, actual, recordPins, replacementIds, todoExceptions, normative, amendable }. */
const runSyn = (over = {}) => gate({
  actual: over.actual ?? GOOD.actual, records: over.records ?? GOOD.records, forward: over.forward ?? GOOD.forward,
  amendable: over.amendable ?? new Set(SYN_FILES), pins: Object.fromEntries(SYN_FILES.map((f) => [f, sha(SYN_BASE[f])])),
  recordPins: over.recordPins ?? GOOD.recordPins, replacementIds: over.replacementIds ?? new Set(SYN_REPL), todoExceptions: over.todoExceptions ?? new Set(['TD2']),
  isNormative: (f) => f === 'SKILL.md' || f.startsWith('references/'), normative: over.normative ?? SYN_NORM,
}).problems;
const found = (ps, kind, rx) => ps.some((q) => q.kind === kind && rx.test(q.msg));
const kinds = (ps) => [...new Set(ps.map((q) => q.kind))].sort().join(',');
const control = (name, ps, kind, rx) => check(`gate control: ${name}`, found(ps, kind, rx), ps.map((q) => `${q.kind}: ${q.msg}`).slice(0, 5));
/** A consistent mutation: the records are changed and the actual files follow, so only the identity pins (or the lists) can object. */
const consistent = (records, forward, replacementIds = SYN_REPL) => ({ records, forward, actual: applyAll(SYN_BASE, records, forward), replacementIds: new Set(replacementIds) });
{
  const base = runSyn();
  check('gate control (sanity): the unmutated synthetic world has no problem', base.length === 0, base.map((q) => `${q.kind}: ${q.msg}`));
  { const recs = SYN_RECORDS(); recs.SK2 = { ...recs.SK2, neu: 'Inserted paragraph!\n' }; control('one changed character in a record (the actual file unchanged) does not stand at its anchor', runSyn({ records: recs, recordPins: recordPinsOf(recs) }), 'chain', /does not stand exactly once/); }
  { const act = { ...GOOD.actual, 'SKILL.md': GOOD.actual['SKILL.md'].replace('Inserted paragraph.', 'Inserted paragrapx.') }; control('one changed character in the actual file is rejected', runSyn({ actual: act }), 'chain', /SK2 does not stand exactly once/); }
  { const act = { ...GOOD.actual, 'SKILL.md': GOOD.actual['SKILL.md'].replace('Inserted paragraph.\n', 'Inserted paragraph.\nInserted paragraph.\n') }; control('a record applied twice is rejected', runSyn({ actual: act }), 'chain', /does not stand exactly once/); }
  { const act = { ...GOOD.actual, 'references/a.md': `${GOOD.actual['references/a.md']}An unrecorded extra line.\n` }; const ps = runSyn({ actual: act }); control('an extra unrecorded line in an amended file fails the pin', ps, 'pin', /not the pinned 3\.1\.0 bytes/); check('gate control: ... and the round trip', found(ps, 'roundtrip', /does not give the actual file/) || found(ps, 'pin', /pinned/)); }
  { const act = { ...GOOD.actual, 'README.md': GOOD.actual['README.md'].replace('Done.', 'Done!') }; control('an unrecorded edit away from the anchors in an amended file fails the pin', runSyn({ actual: act }), 'pin', /not the pinned 3\.1\.0 bytes/); }
  { const recs = SYN_RECORDS(); recs.RA2 = R('references/a.md', '', 'Rule one: the agent MUST stop.\n', 'Rule one: the agent stops.\n', ''); const fwd = SYN_FORWARD(); fwd['references/a.md'] = ['RA1', 'RA2']; const c = consistent(recs, fwd, [...SYN_REPL, 'RA2']); const ps = runSyn({ ...c, recordPins: recordPinsOf(recs) }); control('a normative record whose old holds MUST is rejected (D-4), though pinned and on the closed list', ps, 'keyword', /RFC 2119 keyword/); check('gate control: ... and the missing normative line is reported as an obligation', found(ps, 'obligation', /normative line/), msgs(ps)); }
  { const recs = SYN_RECORDS(); recs.SK3 = R('SKILL.md', '', 'Tail paragraph.\n', 'Tail paragraph, reworded.\n', ''); const fwd = SYN_FORWARD(); fwd['SKILL.md'] = ['SK1', 'SK2', 'SK3']; const c = consistent(recs, fwd, [...SYN_REPL, 'SK3']); const ps = runSyn({ ...c, recordPins: recordPinsOf(recs) }); check('gate control: a keyword-free, pinned, closed-list replacement in a normative file is accepted (the D-4 rule is about old holding MUST, not about replacing)', ps.length === 0, ps.map((q) => `${q.kind}: ${q.msg}`)); }
  { const recs = SYN_RECORDS(); recs.TD3 = R('@root/TODO.md', '', '# TODO\n', '# TODO list\n', ''); const fwd = SYN_FORWARD(); fwd['@root/TODO.md'] = ['TD1', 'TD2', 'TD3']; const c = consistent(recs, fwd, [...SYN_REPL, 'TD3']); control('a @root/TODO.md replacement that is not in the pinned exception list is rejected', runSyn({ ...c, recordPins: recordPinsOf(recs) }), 'todo', /not in the pinned exception list/); }
  { const recs = SYN_RECORDS(); recs.SK3 = R('SKILL.md', '', 'Tail paragraph.\n', 'Tail paragraph, reworded.\n', ''); const fwd = SYN_FORWARD(); fwd['SKILL.md'] = ['SK1', 'SK2', 'SK3']; const c = consistent(recs, fwd, SYN_REPL); control('a replacement that is not on the closed list is rejected even though it is pinned', runSyn({ ...c, recordPins: recordPinsOf(recs) }), 'approved', /not on the closed list/); }
  { const recs = SYN_RECORDS(); recs.SK2 = { ...recs.SK2, neu: 'Inserted paragraph, edited.\n' }; const c = consistent(recs, GOOD.forward); const ps = runSyn({ ...c }); check('gate control: a CONSISTENT change of a record\'s new text (record and actual file together) is rejected by the identity pin alone, with no chain, pin or round-trip problem', found(ps, 'identity', /neu differs from the pinned identity/) && !ps.some((q) => ['chain', 'pin', 'roundtrip'].includes(q.kind)), ps.map((q) => `${q.kind}: ${q.msg}`)); }
  { const recs = SYN_RECORDS(); recs.SK2 = { ...recs.SK2, before: 'Intro line.\n\n', after: '- The agent MUST confirm before writing.\n' }; const c = consistent(recs, GOOD.forward); const ps = runSyn({ ...c }); check('gate control: a CONSISTENT re-anchoring (the same insertion, different anchors, still standing once) is rejected by the identity pin alone', found(ps, 'identity', /(?:before|after) differs/) && !ps.some((q) => ['chain', 'pin', 'roundtrip'].includes(q.kind)), ps.map((q) => `${q.kind}: ${q.msg}`)); }
  { const recs = SYN_RECORDS(); recs.RA1 = { ...recs.RA1, old: '' }; const fwdRename = { 'SKILL.md': ['SK1', 'SK2'], 'references/a.md': ['RA1X'], 'README.md': ['RM1'], '@root/TODO.md': ['TD1', 'TD2'] }; const r2 = { ...recs }; delete r2.RA1; r2.RA1X = recs.RA1; const c = consistent(r2, fwdRename); const ps = runSyn({ ...c }); check('gate control: a CONSISTENT rename of a record id is rejected: the new id has no pinned identity and the pinned id has no record', found(ps, 'identity', /RA1X: the record has no pinned identity/) && found(ps, 'identity', /RA1: a pinned record has no record/), ps.map((q) => `${q.kind}: ${q.msg}`)); }
  { const recs = SYN_RECORDS(); recs.SK3 = R('SKILL.md', 'Tail paragraph', '', '', ''); const recs2 = SYN_RECORDS(); recs2.SK3 = R('SKILL.md', '', 'Intro line.\n', 'Intro line.\n', ''); control('a no-op record (old equals neu) is rejected', runSyn({ records: { ...GOOD.records, SK3: recs2.SK3 }, forward: { ...GOOD.forward, 'SKILL.md': ['SK1', 'SK2', 'SK3'] } }), 'shape', /no-op record/); }
  { const recs = { ...GOOD.records, SK3: R('SKILL.md', 'Tail paragraph.\n', '', '', '') }; control('an empty record (a deletion or nothing) is rejected: 3.2.0 has no deletion record', runSyn({ records: recs, forward: { ...GOOD.forward, 'SKILL.md': ['SK1', 'SK2', 'SK3'] } }), 'shape', /neu is empty/); }
  { const recs = { ...GOOD.records, SK3: R('SKILL.md', '', '', 'No anchor line.\n', '') }; control('an insertion without an anchor is rejected', runSyn({ records: recs, forward: { ...GOOD.forward, 'SKILL.md': ['SK1', 'SK2', 'SK3'] } }), 'shape', /no anchor/); }
  { const recs = { ...GOOD.records, SK3: R('SKILL.md', 'Tail paragraph.\n', '', 'Line without a final LF', '') }; control('a neu that is not line aligned is rejected', runSyn({ records: recs, forward: { ...GOOD.forward, 'SKILL.md': ['SK1', 'SK2', 'SK3'] } }), 'shape', /not line aligned/); }
  { const recs = { ...GOOD.records, SK3: R('SKILL.md', 'Tail paragraph.\r\n', '', 'x\n', '') }; control('a CR in a record field is rejected', runSyn({ records: recs, forward: { ...GOOD.forward, 'SKILL.md': ['SK1', 'SK2', 'SK3'] } }), 'shape', /CR/); }
  { const recs = { ...GOOD.records, X1: R('scripts/other.mjs', '', 'a\n', 'b\n', '') }; control('a record on a file outside the closed amendable set is rejected', runSyn({ records: recs, forward: { ...GOOD.forward, 'scripts/other.mjs': ['X1'] } }), 'shape', /not in the closed amendable set/); }
  { const recs = { ...GOOD.records, 'SK*': R('SKILL.md', 'Tail paragraph.\n', '', 'Star id.\n', '') }; control('a wildcard id is rejected', runSyn({ records: recs, forward: { ...GOOD.forward, 'SKILL.md': ['SK1', 'SK2', 'SK*'] } }), 'shape', /not a plain identifier/); }
  { const f = { ...GOOD.forward, 'SKILL.md': ['SK1'] }; control('a record that no forward order lists is rejected', runSyn({ forward: f }), 'order', /not listed in any forward order/); }
  { const f = { ...GOOD.forward, 'SKILL.md': ['SK1', 'SK2', 'SK2'] }; control('a record listed twice in the forward order is rejected', runSyn({ forward: f }), 'order', /more than once/); }
  { const f = { ...GOOD.forward, 'README.md': ['RM1', 'SK1'], 'SKILL.md': ['SK2'] }; control('a record ordered under another file than its own is rejected', runSyn({ forward: f }), 'order', /ordered under/); }
  { const recs = SYN_RECORDS(); recs.SK2 = { ...recs.SK2, neu: 'Approval is optional when the user is busy.\n' }; const c = consistent(recs, GOOD.forward); control('a weakening phrase in new text is rejected', runSyn({ ...c, recordPins: recordPinsOf(recs) }), 'weaken', /approval made optional/); }
  { const recs = SYN_RECORDS(); recs.SK2 = { ...recs.SK2, neu: 'Setup MUST NOT skip approval.\n' }; const c = consistent(recs, GOOD.forward); check('gate control: a strengthening sentence (MUST NOT skip approval) is not read as a weakening', runSyn({ ...c, recordPins: recordPinsOf(recs) }).filter((q) => q.kind === 'weaken').length === 0); }
  { const ps = gate({ actual: GOOD.actual, records: GOOD.records, forward: GOOD.forward, amendable: new Set(SYN_FILES), pins: { ...Object.fromEntries(SYN_FILES.map((f) => [f, sha(SYN_BASE[f])])), 'README.md': sha('another') }, recordPins: GOOD.recordPins, replacementIds: new Set(SYN_REPL), todoExceptions: new Set(['TD2']), isNormative: () => false }).problems; control('a wrong 3.1.0 pin for a file is rejected', ps, 'pin', /README\.md: the reversed text is not the pinned/); }
  { const ps = runSyn({ normative: { 'SKILL.md': [...SYN_NORM['SKILL.md'], lineDigest('- A baseline line that is gone MUST be reported.')] } }); control('a 3.1.0 normative line that is gone from the actual file is rejected', ps, 'obligation', /1 3\.1\.0 normative line/); }
  { const ps = runSyn({ actual: { ...GOOD.actual, 'README.md': undefined } }); control('an unreadable amended file is a chain problem, not a pass', ps, 'chain', /actual text is unavailable/); }
  { const ps = runSyn({ replacementIds: new Set([...SYN_REPL, 'GHOST']) }); control('a closed-list replacement id with no record is rejected', ps, 'approved', /GHOST: a closed-list replacement has no record/); }
}
// The tree comparison of section E (plan 5.2 item 1: an unrecorded edit in an unamended file, a stray extra file, a missing new file).
{
  const base = new Map([['SKILL.md', 'a'], ['scripts/lib.mjs', 'b'], ['tests/c3.test.mjs', 'c'], ['RELEASE-NOTES-3.1.0.md', 'd']]);
  const newFiles = ['tests/v320.test.mjs', NOTES320];
  const good = new Map([...base, ['SKILL.md', 'a2'], ['tests/v320.test.mjs', 'e'], [NOTES320, 'f']]);
  const tp = (now) => treeProblems(now, base, newFiles, ['SKILL.md']);
  check('tree control (sanity): 3.1.0 plus the new files, with the amended file free to differ, has no problem', JSON.stringify(tp(good)) === JSON.stringify({ extra: [], missing: [], changed: [] }), tp(good));
  check('tree control: an unrecorded edit in an unamended file is reported as changed', JSON.stringify(tp(new Map([...good, ['scripts/lib.mjs', 'b2']])).changed) === '["scripts/lib.mjs"]');
  check('tree control: an unrecorded edit in an unamended historical test is reported as changed', JSON.stringify(tp(new Map([...good, ['tests/c3.test.mjs', 'c2']])).changed) === '["tests/c3.test.mjs"]');
  check('tree control: a stray RELEASE-NOTES-3.2.1.md is reported as extra (only the exact new paths are allowed)', JSON.stringify(tp(new Map([...good, ['RELEASE-NOTES-3.2.1.md', 'x']])).extra) === '["RELEASE-NOTES-3.2.1.md"]');
  check('tree control: a stray extra file is reported as extra', JSON.stringify(tp(new Map([...good, ['scripts/new.mjs', 'x']])).extra) === '["scripts/new.mjs"]');
  { const m = new Map(good); m.delete('tests/v320.test.mjs'); check('tree control: a missing new file is reported as missing', JSON.stringify(tp(m).missing) === '["tests/v320.test.mjs"]'); }
  { const m = new Map(good); m.delete('RELEASE-NOTES-3.1.0.md'); check('tree control: a deleted 3.1.0 file is reported as missing', JSON.stringify(tp(m).missing) === '["RELEASE-NOTES-3.1.0.md"]'); }
}
// The view (plan 5.2 item 2), on synthetic trees through the helper's real functions.
const gitEnv = (tmp) => {
  const gitconfig = path.join(tmp, 'gitconfig');
  fs.writeFileSync(gitconfig, '[user]\n\tname = Fixture\n\temail = fixture@example.invalid\n[core]\n\tautocrlf = false\n[commit]\n\tgpgsign = false\n');
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^GIT_/i.test(k) && typeof v === 'string') env[k] = v;
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: gitconfig, GIT_TERMINAL_PROMPT: '0' });
  return env;
};
const runIn = (env, cmd, args, cwd) => spawnSync(cmd, args, { cwd, env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 180000, maxBuffer: 1 << 26 });
const put = (root, rel, data) => { const p = path.join(root, ...rel.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); };
{
  if (H === null) check('view controls need the helper', false, NOT_YET('tests/helpers/v320-amendments.mjs', LH.err));
  else {
    const cfg = { records: GOOD.records, forward: GOOD.forward, pins: Object.fromEntries(SYN_FILES.map((f) => [f, sha(SYN_BASE[f])])), newFiles: ['tests/helpers/new.mjs'] };
    const files320 = { ...GOOD.actual, 'scripts/lib.mjs': 'export const a = 1;\n', 'tests/helpers/new.mjs': 'export const n = 1;\n' };
    const baseMap = new Map([...SYN_FILES.map((f) => [f, sha(SYN_BASE[f])]), ['scripts/lib.mjs', sha('export const a = 1;\n')]]);
    const mkView = (label, mutate = (f) => f) => { const d = scratchDir(label); const files = mutate({ ...files320 }); for (const [rel, text] of Object.entries(files)) put(d, rel.startsWith('@root/') ? rel.slice(6) : `project-setup/${rel}`, text); return d; };
    const compare = (d) => { const got = new Map(); const walk = (dir, rel) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const r = rel === '' ? e.name : `${rel}/${e.name}`; if (e.isDirectory()) walk(path.join(dir, e.name), r); else got.set(r, sha(fs.readFileSync(path.join(dir, e.name)))); } }; walk(path.join(d, 'project-setup'), ''); try { got.set('@root/TODO.md', sha(fs.readFileSync(path.join(d, 'TODO.md')))); } catch { /* absent */ } const want = new Map([...baseMap].map(([k, v]) => [k, v])); return { extra: [...got.keys()].filter((k) => !want.has(k)).sort(), missing: [...want.keys()].filter((k) => !got.has(k)).sort(), changed: [...want.keys()].filter((k) => got.has(k) && got.get(k) !== want.get(k)).sort() }; };
    { const d = mkView('view-good'); const r = attempt(() => H.to310Repo(d, cfg)); check('view control: to310Repo on a copy of the synthetic 3.2.0 tree reverses every amended file to the pinned 3.1.0 bytes and removes exactly the new file', !failedAttempt(r) && JSON.stringify(compare(d)) === JSON.stringify({ extra: [], missing: [], changed: [] }), failedAttempt(r) ? r : compare(d)); }
    { const d = mkView('view-alt', (f) => ({ ...f, 'README.md': f['README.md'].replace('Version 3.2.0 here.', 'Version 3.2.1 here.') })); check('view control: to310Repo on a copy with an altered amendment throws', failedAttempt(attempt(() => H.to310Repo(d, cfg))), 'did not throw'); }
    { const d = mkView('view-ext', (f) => ({ ...f, 'references/a.md': `${f['references/a.md']}An unrecorded extra line.\n` })); check('view control: an unrecorded line in an amended file makes to310Repo throw (the reversal is not the pinned 3.1.0 bytes)', failedAttempt(attempt(() => H.to310Repo(d, cfg))), 'did not throw'); }
    { const d = mkView('view-unrec', (f) => ({ ...f, 'scripts/lib.mjs': 'export const a = 2;\n' })); const r = attempt(() => H.to310Repo(d, cfg)); check('view control: an unrecorded edit in an unamended file survives to310Repo and shows as changed', !failedAttempt(r) && JSON.stringify(compare(d).changed) === '["scripts/lib.mjs"]', failedAttempt(r) ? r : compare(d)); }
    { const d = mkView('view-stray', (f) => ({ ...f, 'RELEASE-NOTES-3.2.1.md': 'x\n' })); const r = attempt(() => H.to310Repo(d, cfg)); check('view control: a stray RELEASE-NOTES-3.2.1.md survives to310Repo and shows as extra', !failedAttempt(r) && JSON.stringify(compare(d).extra) === '["RELEASE-NOTES-3.2.1.md"]', failedAttempt(r) ? r : compare(d)); }
    { const d = mkView('view-pend'); const before = fs.readFileSync(path.join(d, 'project-setup', 'README.md'), 'utf8'); const r = attempt(() => H.to310Repo(d, { ...cfg, pins: PENDING })); check('view control: with the pin table a stub to310Repo throws PIN_PENDING and writes nothing', failedAttempt(r) && /PIN_PENDING/.test(r.threw) && fs.readFileSync(path.join(d, 'project-setup', 'README.md'), 'utf8') === before, r); }
    { const d = mkView('view-miss', (f) => { const g = { ...f }; delete g['references/a.md']; return g; }); check('view control: a missing amended file makes to310Repo throw (never a silent skip)', failedAttempt(attempt(() => H.to310Repo(d, cfg))), 'did not throw'); }
    // buildView: tracked files only, an ignored file never enters, an untracked one only with includeUntracked, a Git failure is its own error.
    const tmp = scratchDir('gv'); const env = gitEnv(tmp);
    const repo = path.join(tmp, 'repo'); fs.mkdirSync(repo);
    const g = (...a) => runIn(env, 'git', a, repo);
    g('init', '-q');
    put(repo, 'project-setup/SKILL.md', '# s\n'); put(repo, 'project-setup/ignored.log', 'ignored\n'); put(repo, '.gitignore', 'project-setup/*.log\n'); put(repo, 'README.md', '# r\n'); put(repo, 'unrelated/x.txt', 'x\n'); put(repo, 'backend-standards/templates/t.md', 't\n');
    g('add', '-A'); const committed = g('commit', '-qm', 'fixture').status === 0;
    put(repo, 'project-setup/untracked.md', 'u\n');
    const viewOf = (opts, label) => { const out = path.join(tmp, label); const r = attempt(() => H.buildView({ repoRoot: repo, outDir: out, ...opts })); return failedAttempt(r) ? r : r.files; };
    const tracked = committed ? viewOf({}, 'out-tracked') : { threw: 'the synthetic repository could not be committed' };
    check('view control: buildView lists the tracked files of the copy set and copies nothing else (no unrelated directory, no .git)', !failedAttempt(tracked) && tracked.includes('project-setup/SKILL.md') && tracked.includes('README.md') && tracked.includes('backend-standards/templates/t.md') && !tracked.some((f) => f.startsWith('unrelated/') || f.startsWith('.git')) && !fs.existsSync(path.join(tmp, 'out-tracked', '.git')), tracked);
    check('view control: an ignored file in the working tree does not enter the view, with or without includeUntracked', !failedAttempt(tracked) && !tracked.includes('project-setup/ignored.log') && (() => { const v = viewOf({ includeUntracked: true }, 'out-untracked'); return !failedAttempt(v) && !v.includes('project-setup/ignored.log'); })(), tracked);
    check('view control: an untracked, not ignored file is absent from the tracked view and present with includeUntracked', !failedAttempt(tracked) && !tracked.includes('project-setup/untracked.md') && (() => { const v = viewOf({ includeUntracked: true }, 'out-untracked2'); return !failedAttempt(v) && v.includes('project-setup/untracked.md'); })(), tracked);
    check('view control: a non-repository directory is a GIT_FAILED error (reported as its own failure, never an empty view)', (() => { const plain = scratchDir('plain'); const r = attempt(() => { try { return H.buildView({ repoRoot: plain, outDir: path.join(tmp, 'out-plain') }); } catch (e) { return { threw: `${e.code}:${e.message}` }; } }); return failedAttempt(r) && /^GIT_FAILED:/.test(r.threw); })());
    check('view control: an outDir inside the repository, and a non-empty outDir, are refused', (() => { const a = attempt(() => H.buildView({ repoRoot: repo, outDir: path.join(repo, 'view') })); const full = scratchDir('full'); fs.writeFileSync(path.join(full, 'x'), 'x'); const b = attempt(() => H.buildView({ repoRoot: repo, outDir: full })); return failedAttempt(a) && failedAttempt(b); })());
    check('view control: overlay replaces only the named project-setup file, refuses a test file, a root key, a parent path and a file that is not in the view', (() => { const d = mkView('view-ov'); const realRoot = scratchDir('ovroot'); put(realRoot, 'project-setup/README.md', 'overlaid\n'); put(realRoot, 'project-setup/tests/x.mjs', 'x\n'); H.overlay(d, realRoot, ['README.md']); const ok = fs.readFileSync(path.join(d, 'project-setup', 'README.md'), 'utf8') === 'overlaid\n'; const refused = ['tests/x.mjs', '@root/TODO.md', '../x', 'nope.md'].every((p) => failedAttempt(attempt(() => H.overlay(d, realRoot, [p])))); return ok && refused; })());
  }
}
// The runner (plan 5.2 item 11 and 4.6): the compat comparison is exact by string; run 1 admits only digest pins that name an overlaid file; run 2 also the shipped-policy assertions.
{
  if (RUN === null) check('runner controls need tests/run-310-view.mjs', false, NOT_YET('tests/run-310-view.mjs', LR.err));
  else {
    const O1 = ['scripts/detect.mjs', 'scripts/migrate-security-paths.mjs']; const O2 = [...O1, 'data/secret-paths.json'];
    const pinned1 = ['c3: scripts/detect.mjs digest pin', 'c14: scripts/migrate-security-paths.mjs digest pin'];
    const same = RUN.compareCompat({ actual: [...pinned1].reverse(), pinned: pinned1, overlaid: O1 });
    check('compat control (sanity): the same set in another order is ok', same.ok === true && same.unlisted.length === 0 && same.stale.length === 0, same);
    const unl = RUN.compareCompat({ actual: [...pinned1, 'c3: a behaviour assertion about detect output'], pinned: pinned1, overlaid: O1 });
    check('compat control: an unlisted failure string is NOT accepted and is reported as unlisted', unl.ok === false && unl.unlisted.length === 1 && /behaviour assertion/.test(unl.unlisted[0]), unl);
    const stale = RUN.compareCompat({ actual: [pinned1[0]], pinned: pinned1, overlaid: O1 });
    check('compat control: a listed string that did not occur is reported as stale (a stale list is a failure)', stale.ok === false && stale.stale.length === 1 && stale.stale[0] === pinned1[1], stale);
    const near = RUN.compareCompat({ actual: [`${pinned1[0]} `], pinned: pinned1, overlaid: O1 });
    check('compat control: matching is by exact string (a trailing space is a different label)', near.ok === false && near.unlisted.length === 1, near);
    const naming = RUN.compareCompat({ actual: ['c9: the keys check of validate.mjs'], pinned: ['c9: the keys check of validate.mjs'], overlaid: O1 });
    check('compat control: a listed label that names no overlaid file is rejected in run 1 (badPins)', naming.ok === false && naming.badPins.length === 1, naming);
    const policy1 = RUN.compareCompat({ actual: ['c3: 20-entry construction of secret-paths.json'], pinned: ['c3: 20-entry construction of secret-paths.json'], overlaid: O1 });
    const policy2 = RUN.compareCompat({ actual: ['c3: 20-entry construction of secret-paths.json'], pinned: ['c3: 20-entry construction of secret-paths.json'], overlaid: O2 });
    check('compat control: an assertion about the shipped policy file is a valid pin in run 2 only (the data is overlaid there), never in run 1', policy1.ok === false && policy1.badPins.length === 1 && policy2.ok === true, { run1: policy1, run2: policy2 });
    check('compat control: a duplicate or empty pinned string is a bad pin', RUN.compareCompat({ actual: [pinned1[0]], pinned: [pinned1[0], pinned1[0]], overlaid: O1 }).badPins.length === 1 && RUN.pinnedListProblems(['', pinned1[0]], O1).length === 1);
    check('compat control: failureStringsOf takes the full set of results[].failures strings of a retained results file, unique and sorted, and refuses a malformed file', (() => { const ok = RUN.failureStringsOf(JSON.stringify({ results: [{ id: 'a', failures: ['y', 'x'] }, { id: 'b', failures: ['x'] }, { id: 'c', failures: [] }] })); const bad = [JSON.stringify({}), JSON.stringify({ results: [{ id: 'a' }] }), JSON.stringify({ results: [{ id: 'a', failures: [1] }] }), '{'].every((t) => failedAttempt(attempt(() => RUN.failureStringsOf(t)))); return JSON.stringify(ok) === '["x","y"]' && bad; })());
    check('runner control: totalsOf reads the last totals line, resultsFileOf the RESULTS line; both are null when absent', (() => { const t = RUN.totalsOf('x\n10 PASS / 2 FAIL / 1 SKIP\nnoise\n11 PASS / 0 FAIL / 0 SKIP\n'); const r = RUN.resultsFileOf('a\nRESULTS  D:/x/y.json\nb\n'); return t !== null && t.passed === 11 && t.failed === 0 && t.skipped === 0 && r === 'D:/x/y.json' && RUN.totalsOf('nothing') === null && RUN.resultsFileOf('nothing') === null; })());
    check('runner control: parseCliArgs refuses an unknown flag, a repeated flag, a missing value, a label without an overlay, a label without accept-rc1 and an unknown gate; it accepts the documented forms', (() => { const P = RUN.parseCliArgs; const refused = [['--out'], ['--out', 'a', '--out', 'b'], ['--x'], ['--out', 'a', '--label', 'l'], ['--out', 'a', '--overlay', 'scripts/detect.mjs', '--label', 'l'], ['--out', 'a', '--run', 'nope'], ['--out', 'a', '--run', 'c18,c18'], []].every((a) => P(a).ok === false); const good = P(['--out', 'a', '--overlay', 'scripts/detect.mjs', '--label', 'scripts', '--run', 'accept-rc1']); const dflt = P(['--out', 'a']); return refused && good.ok === true && good.label === 'scripts' && dflt.ok === true && JSON.stringify(dflt.run) === JSON.stringify(['release-3.1', 'c18', 'bs-doc-map']); })());
    check('runner control: outDirProblems refuses a directory inside the repository, inside the temp directory, and a non-empty one', (() => { const inRepo = RUN.outDirProblems(path.join(REPO, 'view-x')); const inTmp = RUN.outDirProblems(path.join(os.tmpdir(), 'view-x')); const full = scratchDir('fullout'); fs.writeFileSync(path.join(full, 'f'), 'x'); const nonEmpty = RUN.outDirProblems(full, { repoRoot: REPO, tmp: path.join(scratch, 'elsewhere') }); const fine = RUN.outDirProblems(path.join(scratch, 'fresh-view'), { repoRoot: REPO, tmp: path.join(scratch, 'elsewhere') }); return inRepo.some((m) => /inside the repository/.test(m)) && inTmp.some((m) => /temp directory/.test(m)) && nonEmpty.some((m) => /not empty/.test(m)) && fine.length === 0; })());
    check('runner control: the gates the runner can start are exactly release-3.1, c18, bs-doc-map and accept-rc1, run from tests/', JSON.stringify(Object.keys(RUN.GATES).sort()) === '["accept-rc1","bs-doc-map","c18","release-3.1"]' && Object.values(RUN.GATES).every((f) => /^[a-z0-9.-]+\.mjs$/.test(f)));
  }
}
// Notes, claims and acceptance engines: a valid synthetic document passes and each defect is rejected.
const NOTES_GOOD = Buffer.from([
  '# project-setup 3.2.0', '', '## Compatibility', '', 'Projects installed by 3.1.0 update in place.', '', '## What changed', '', '- Item A.', '', '## Upgrading', '',
  '1. Install 3.2.0 with install.mjs.', '2. Move the installer backup directory and its .meta.json out of the skills directory and note the path.', '3. Start a new session and confirm one active copy.',
  '4. If the project tracks files under root env/ or cert/, setup stops in Phase 0: move non-secret files out or escalate.', '5. On update, decide the two coverage rows.', '',
  '## Correction of a 3.1.0 known issue', '', 'The first known issue of 3.1.0 is corrected.', '', '## Verification', '', 'The historical gates run only through node tests/run-310-view.mjs. CI does not run them.', '',
  '## Not measured', '', '- The root-anchor claim is scoped to static rendering until D6 is recorded.', '', '## Known limitations', '', '- None.', '',
].join('\n'), 'utf8');
{
  const n = (name, text, rx) => { const q = notesProblems(Buffer.from(text, 'utf8')); check(`notes control: ${name}`, q.some((m) => rx.test(m)), q); };
  const G = NOTES_GOOD.toString('utf8');
  check('notes control: the valid synthetic notes have no problem', notesProblems(NOTES_GOOD).length === 0, notesProblems(NOTES_GOOD));
  n('a standalone 64-hex id is rejected', G.replace('- Item A.', `- Item A ${'a'.repeat(64)}.`), /hex/);
  n('a standalone 40-hex id is rejected', G.replace('- Item A.', `- Item A ${'b'.repeat(40)}.`), /hex/);
  n('a personal path is rejected', G.replace('- Item A.', '- Item A C:\\Users\\someone\\x.'), /personal path/);
  n('a POSIX personal path is rejected', G.replace('- Item A.', '- Item A /home/someone/x.'), /personal path/);
  n('a CR is rejected', G.replace('## What changed', '## What changed\r'), /CR/);
  n('a non-ASCII character is rejected', G.replace('- Item A.', '- Item \u00e9.'), /non-ASCII/);
  n('a wrong title is rejected', G.replace('# project-setup 3.2.0', '# project-setup 3.1.0'), /title/);
  n('two final LFs are rejected', `${G}\n`, /final LF/);
  n('a missing Upgrading section is rejected', G.replace('## Upgrading', '## Upgrade notes'), /Upgrading/);
  n('Upgrading without five numbered steps is rejected', G.replace('5. On update, decide the two coverage rows.\n', ''), /numbered steps 1 to 5/);
  n('numbered steps out of order are rejected', G.replace('2. Move', '3. Move'), /numbered steps 1 to 5/);
  n('the backup step without the .meta.json is rejected', G.replace('and its .meta.json ', ''), /installer backup/);
  n('the backup step that does not name the skills directory is rejected', G.replace('out of the skills directory', 'somewhere'), /installer backup/);
  n('the tracked env/ and cert/ step without the Phase 0 stop is rejected', G.replace('setup stops in Phase 0', 'setup warns'), /Phase 0 stop/);
  n('the tracked step naming only env/ is rejected', G.replace('under root env/ or cert/', 'under root env/'), /Phase 0 stop/);
  n('no coverage step is rejected', G.replace('decide the two coverage rows', 'decide the rows'), /coverage/);
  n('a missing Not measured section is rejected', G.replace('## Not measured', '## Unmeasured'), /Not measured/);
  n('an empty Not measured list is rejected', G.replace('- The root-anchor claim is scoped to static rendering until D6 is recorded.', 'Nothing.'), /holds no list/);
  n('a Not measured section without the root-anchor scope is rejected', G.replace('root-anchor claim is scoped to static rendering', 'claim is open'), /root-anchor/);
  n('a verification section that does not name the view runner is rejected', G.replace('node tests/run-310-view.mjs', 'the runner'), /view runner/);
  n('a verification section that does not say CI does not run the gates is rejected', G.replace(' CI does not run them.', ''), /CI/);
  n('no compatibility heading is rejected', G.replace('## Compatibility', '## Overview'), /compatibility/);
  n('no limitations heading is rejected', G.replace('## Known limitations', '## Misc'), /limitations/);
  n('no statement about the 3.1.0 known issue is rejected', G.replace('## Correction of a 3.1.0 known issue', '## Corrections').replace('The first known issue of 3.1.0 is corrected.', 'Done.'), /known issue/);
  check('notes control: a BOM is rejected', notesProblems(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), NOTES_GOOD])).some((m) => /BOM/.test(m)));
  check('notes control: an empty or unreadable buffer is rejected', notesProblems(Buffer.alloc(0)).length > 0 && notesProblems(null).length > 0);
}
{
  const ACC_GOOD = 'Install the candidate; the explicit directories are `$env:USERPROFILE\\.claude\\skills` and `$env:USERPROFILE\\.agents\\skills`.\n\nUse tests/live/bs-doc-map.mjs to initialize a workspace. Preserved files go to D:\\ps-live\\preserved\\x.\n';
  check('acceptance control: the valid synthetic document has no problem (a D:\\ps-live path is not a user-profile path)', accProblems(ACC_GOOD).length === 0, accProblems(ACC_GOOD));
  const actl = (name, text, rx) => { const q = accProblems(text); check(`acceptance control: ${name}`, q.some((m) => rx.test(m)), q); };
  actl('a third install directory is rejected', `${ACC_GOOD}Also install into $env:USERPROFILE\\.codex\\skills\n`, /other than the two skill directories/);
  actl('a bare $env:USERPROFILE is rejected', `${ACC_GOOD}Work in $env:USERPROFILE\n`, /other than the two skill directories/);
  actl('a sibling that only shares the prefix is rejected', `${ACC_GOOD}Do not use $env:USERPROFILE\\.claude\\skills-old\n`, /other than the two skill directories/);
  actl('%USERPROFILE% is rejected', `${ACC_GOOD}See %USERPROFILE%\\.claude\\skills\n`, /home-relative spelling/);
  actl('$HOME is rejected', `${ACC_GOOD}See $HOME/.claude/skills\n`, /home-relative spelling/);
  actl('a tilde path is rejected', `${ACC_GOOD}See ~/.claude/skills\n`, /home-relative spelling/);
  actl('a drive-letter personal path is rejected', `${ACC_GOOD}See C:\\Users\\someone\\skills\n`, /personal path/);
  actl('a POSIX personal path is rejected', `${ACC_GOOD}See /home/someone/skills\n`, /personal path/);
  actl('a document naming only the claude directory is rejected', ACC_GOOD.replace(' and `$env:USERPROFILE\\.agents\\skills`', ''), /does not name \$env:USERPROFILE\\\.agents/);
  actl('a document naming only the agents directory is rejected', ACC_GOOD.replace('`$env:USERPROFILE\\.claude\\skills` and ', ''), /does not name \$env:USERPROFILE\\\.claude/);
  actl('a document that does not name the live helper is rejected', ACC_GOOD.replace('bs-doc-map.mjs', 'the helper'), /live helper/);
  check('acceptance control: a path inside one of the two directories is accepted', accProblems(`${ACC_GOOD}The copy lands in $env:USERPROFILE\\.claude\\skills\\project-setup\n`).length === 0);
}
const GOOD_CLAIMS = () => ({
  VERSION: '3.2.0\n',
  SKILL: '---\nname: x\n---\n\n# project-setup 3.2.0\n\n## Workflow\n',
  PSREADME: '# project-setup 3.2.0 - skill source\n\n**Release 3.2.0.** See RELEASE-NOTES-3.2.0.md for compatibility.\n\n## Test first\n\nnode tests/release-3.2.0.test.mjs, node tests/v320.test.mjs, node tests/bs-doc-map.test.mjs and node tests/run-310-view.mjs for the historical gates.\n\n## Local candidate release\n\nrequires or creates project-setup-v3.2.0 in the distribution repository.\n\nnode install/release.mjs --tag project-setup-v3.2.0 --out <unused-directory>\n',
  CHANGELOG: '# Changelog\n\n## 3.2.0\n\nFixes.\n\n## 3.1.0\n\nMapping.\n',
  ROOTREADME: '`project-setup` (3.2.0, shared by Claude Code and Codex) is **not**\nThis installs `project-setup` 3.2.0 for both tools.\n`project-setup/RELEASE-NOTES-3.2.0.md` section "Rollback".\n|-- project-setup/   general-purpose - shared Claude Code + Codex setup (3.2.0, own installer and tests)\nHistorical: project-setup/RELEASE-NOTES-3.1.0.md.\n',
  TREE: '|-- project-setup/   skill 3 - shared Claude Code + Codex agent scaffolding (3.2.0)\n(`project-setup/VERSION` is `3.2.0`) with its own layout\n',
  MODES: `before\n${MODES_OBSERVATION}\nafter\n${MD320_1}\n`,
});
{
  const ok = claimsProblems(GOOD_CLAIMS());
  check('claims control: the valid synthetic public claims have no problem', ok.length === 0, ok.map((q) => q.msg));
  const cctl = (name, mutate, area, rx) => { const t = GOOD_CLAIMS(); mutate(t); const p = claimsProblems(t); check(`claims control: ${name}`, p.some((q) => q.area === area && rx.test(q.msg)), p.map((q) => `${q.area}: ${q.msg}`).slice(0, 4)); };
  cctl('VERSION 3.1.0 is rejected', (t) => { t.VERSION = '3.1.0\n'; }, 'VERSION', /VERSION/);
  cctl('VERSION without the final LF is rejected', (t) => { t.VERSION = '3.2.0'; }, 'VERSION', /VERSION/);
  cctl('a SKILL title still at 3.1.0 is rejected', (t) => { t.SKILL = t.SKILL.replace('# project-setup 3.2.0', '# project-setup 3.1.0'); }, 'SKILL', /title/);
  cctl('a README title at 3.1.0 is rejected', (t) => { t.PSREADME = t.PSREADME.replace('# project-setup 3.2.0', '# project-setup 3.1.0'); }, 'PSREADME', /title/);
  cctl('a README opening that still cites the 3.1.0 notes is rejected', (t) => { t.PSREADME = t.PSREADME.replace('RELEASE-NOTES-3.2.0.md', 'RELEASE-NOTES-3.1.0.md'); }, 'PSREADME', /opening release sentence/);
  for (const g of ['release-3.2.0.test.mjs', 'v320.test.mjs', 'run-310-view.mjs', 'bs-doc-map.test.mjs']) cctl(`a README that does not name ${g} is rejected`, (t) => { t.PSREADME = t.PSREADME.replace(g, 'x'); }, 'PSREADME', new RegExp(g.replace(/\./g, '\\.')));
  cctl('a local release section still on the 3.1.0 tag is rejected', (t) => { t.PSREADME = t.PSREADME.replace(/project-setup-v3\.2\.0/g, 'project-setup-v3.1.0'); }, 'PSREADME', /3\.2\.0 tag token/);
  cctl('a changelog without the 3.2.0 entry first is rejected', (t) => { t.CHANGELOG = t.CHANGELOG.replace('## 3.2.0', '## 3.1.9'); }, 'CHANGELOG', /3\.2\.0/);
  cctl('a changelog that lost the 3.1.0 entry is rejected', (t) => { t.CHANGELOG = '# Changelog\n\n## 3.2.0\n\nFixes.\n'; }, 'CHANGELOG', /3\.1\.0 entry/);
  cctl('a root README that keeps the stale introduction claim is rejected', (t) => { t.ROOTREADME += '`project-setup` (3.1.0, shared by Claude Code and Codex) is **not**\n'; }, 'ROOTREADME', /stale current 3\.1\.0 claim/);
  cctl('a root README that keeps the stale install claim is rejected', (t) => { t.ROOTREADME += 'This installs `project-setup` 3.1.0 for both tools.\n'; }, 'ROOTREADME', /stale current 3\.1\.0 claim/);
  cctl('a root README that keeps the stale layout line is rejected', (t) => { t.ROOTREADME += '|-- project-setup/   general-purpose (3.1.0, own installer and tests)\n'; }, 'ROOTREADME', /stale current 3\.1\.0 claim/);
  cctl('a root README that does not cite the 3.2.0 notes is rejected', (t) => { t.ROOTREADME = t.ROOTREADME.replace('RELEASE-NOTES-3.2.0.md', 'RELEASE-NOTES-3.1.0.md'); }, 'ROOTREADME', /RELEASE-NOTES-3\.2\.0/);
  cctl('a project tree still at 3.1.0 is rejected', (t) => { t.TREE = t.TREE.replace(/3\.2\.0/g, '3.1.0'); }, 'TREE', /3\.2\.0|stale/);
  cctl('a modes file that lost the dated 3.1.0 observation is rejected', (t) => { t.MODES = t.MODES.replace(MODES_OBSERVATION, 'gone'); }, 'MODES', /dated 3\.1\.0/);
  cctl('a modes file without the [MD320_1] observation is rejected', (t) => { t.MODES = t.MODES.replace(MD320_1, ''); }, 'MODES', /MD320_1/);
  cctl('a duplicated [MD320_1] observation is rejected', (t) => { t.MODES += `${MD320_1}\n`; }, 'MODES', /MD320_1/);
  cctl('the [MD320_1] observation placed before the dated statement is rejected', (t) => { t.MODES = `${MD320_1}\n${MODES_OBSERVATION}\n`; }, 'MODES', /not after/);
}

// ===================================================================================================== C. actual obligations ====
const claims = { VERSION: actualText('VERSION'), SKILL: actualText('SKILL.md'), PSREADME: actualText('README.md'), CHANGELOG: actualText('CHANGELOG.md'), ROOTREADME: actualText('@root/README.md'), TREE: actualText('@root/.ai/context/project-tree.md'), MODES: actualText('references/modes.md') };
needPins('every 3.1.0 normative line (a line holding MUST, SHOULD or MAY) of SKILL.md, references/*, assets/agents/*, assets/templates/* and data/* is still present (16-hex line digests pinned in this spec, D-4)', { NORMATIVE_LINES }, () => {
  const lost = Object.entries(NORMATIVE_LINES).map(([k, digests]) => { const have = new Set(lf(actualText(k)).split('\n').map(lineDigest)); return [k, digests.filter((d) => !have.has(d)).length]; }).filter(([, n]) => n > 0);
  return [Object.keys(NORMATIVE_LINES).every(NORMATIVE_SCOPE) && lost.length === 0, lost];
});
// The root TODO (AC-C3-1, AC-A6-1): the 3.1.0 bytes plus exactly five records; lines 25 to 32 byte-identical; the texts of the plan present once.
{
  const todo = lf(actualText('@root/TODO.md'));
  const lines = todo.split('\n');
  check('AC-C3-1: @root/TODO.md lines 25 to 32 (the reviewer-residuals item) are byte-identical to the 3.1.0 lines (the pinned digest)', lines.length >= 33 && sha(`${lines.slice(24, 32).join('\n')}\n`) === TODO_RESIDUAL_SHA, lines.length >= 33 ? sha(`${lines.slice(24, 32).join('\n')}\n`) : 'the file is too short');
  check('AC-C3-1: the helper holds exactly the five @root/TODO.md records TD320_1 to TD320_5 and TD320_2 is the only replacement among them', H !== null && hasRecords && JSON.stringify(Object.entries(H.AM320).filter(([, r]) => r.file === '@root/TODO.md').map(([id]) => id).sort()) === JSON.stringify(TODO_RECORDS) && JSON.stringify(Object.entries(H.AM320).filter(([, r]) => r.file === '@root/TODO.md' && r.old !== '').map(([id]) => id)) === JSON.stringify(TODO_EXCEPTIONS), H === null ? NOT_YET('helper') : hasRecords ? Object.entries(H.AM320).filter(([, r]) => r.file === '@root/TODO.md').map(([id]) => id) : `${PENDING}: AM320 is empty`);
  const S = squash(todo);
  const T = {
    TD320_1: 'Status 2026-11-22: project-setup 3.2.0 ships both fixes as text only (the money-severity rule of the canonical reviewer and the delegated-agent launch bullet); neither is measured. This item stays until measurements D1 and D2 of docs/plans/2026-11-22-project-setup-v3.2.0-plan.md are recorded.',
    TD320_2: 'The 3.1.0 live acceptance (2026-11-14 to 2026-11-22) exercised the agents on both hosts and PS then BS (merge branch only). Not exercised: the BS overwrite branch and Codex PS rows.',
    TD320_3: 'backend-standards stamp behaviour differs between two existing-project runs. BS 3.1.0 wrote .backend-standards.json on the PS-first fixture and not on the BS existing-project fixture (2026-11-14). The existing-project procedure is documented as writing no stamp. Decide which is intended and make the skill do it every time; project-setup accepts both signals.',
    TD320_4: 'project-setup installer backups live inside the skills directory. 3.2.0 makes detect report them and documents the manual move. Moving the backup location out of host discovery is a candidate for the next minor and needs the recorded skill-discovery probe (D8 of the 3.2.0 plan) first.',
  };
  for (const [id, text] of Object.entries(T)) check(`AC-C3-1: the ${id} text of plan C3 is present exactly once in @root/TODO.md${id === 'TD320_3' ? ' (AC-A6-1: the stamp-behaviour entry)' : ''}`, S.split(text).length === 2, S.split(text).length - 1);
  check('AC-C3-1: the TD320_2 replacement removed the 3.1.0 sentence "Not exercised: the agents themselves, Codex, or PS then BS."', !S.includes('Not exercised: the agents themselves, Codex, or PS then BS.'));
  check('AC-C3-1: the TD320_5 entry lists the 3.1.0 rows that were not measured (the entry names "3.1.0 rows not measured")', /project-setup 3\.1\.0 rows not measured/.test(S) && S.split('project-setup 3.1.0 rows not measured').length === 2, undefined);
  check('AC-C3-1: the TD320_1 status sentence sits inside the reviewer-residuals item (directly after line 32, before the next item)', (() => { const a = lines.findIndex((l) => l.startsWith('- **`project-setup` 3.0.0 reviewer residuals.**')); const next = lines.findIndex((l, i) => i > a && /^- \*\*/.test(l)); const at = lines.findIndex((l) => l.includes('Status 2026-11-22')); return a === 24 && at > 31 && next > at; })(), undefined);
}
// The reviewer and the templates: insertion points and the line caps (AC-B1-1, AC-B2-1; behaviour is tests/v320.test.mjs).
{
  const RV320_1 = ['Money and state integrity are the exception. Code in the reviewed change that breaks a', 'critical rule in AGENTS.md, whatever its wording, or a MUST-level rule in the documents', 'it names or in the project review rules, for a money, balance, payment, points or limit', 'flow is a finding whatever its current reachability: for example a read-modify-write', 'without a lock or atomic statement, or a retry without proven idempotency. You MUST rate', 'it HIGH or CRITICAL. A missing caller, route or funding path MUST NOT lower that severity', 'or move it to Open questions, because such code is one wiring change away from moving', 'money and the change that wires it is rarely reviewed against this code\'s locking.', 'State the missing reachability in the Scenario (the interleaving once the code is', 'called) and in Confidence. Classify it **likely risk** while nothing calls it and', '**confirmed bug** when something does. For these flows this paragraph overrides the', 'reachability rule above, the "caller that does not exist" sentence below, the', 'open-question rule of section 4 as far as it concerns reachability, and the verdict', 'rule of section 5 as stated there. A project rule MUST NOT relax this paragraph; on', 'conflict follow this paragraph and report the conflict.'].join('\n');
  const RV320_2 = ['   A money or state-integrity finding rated HIGH or CRITICAL under the exception in', '   section 2 makes the verdict **block**, including when it is classified likely risk.'].join('\n');
  const AT320_1 = ['Text between `<!-- project-setup:begin ... -->` and `<!-- project-setup:end ... -->`', 'markers in AGENTS.md, CLAUDE.md and .gitignore is managed by project-setup. Every', 'agent, including a retained project agent that does not load a canonical definition,', 'MUST NOT add, remove or move these markers, and MUST change text inside a block only', 'when a code change makes that text wrong. It MUST then name the file and the block', 'id in its output, because the next project-setup update shows that edit for a keep,', 'take-new or merge decision and can otherwise replace it.'].join('\n');
  const AT320_2 = ['When you delegate to `reviewer` or `docs-sync`, state in every brief the session\'s', 'original start directory, the repository root and the current directory. Do not invent', 'a start directory you were not given; say that it is unknown instead.'].join('\n');
  const CT320_1 = ['- For a delegated agent this bullet replaces the directory comparison above. A delegated', '  agent\'s context or brief MAY show the directory its parent was in rather', '  than the session\'s original start directory. As a delegated agent you MUST treat the', '  original start directory as unknown unless the brief states it. You MUST NOT refuse on', '  your own working directory alone, and when the brief does not state the original start', '  directory you MUST state in your output that it was not given. This prevents a false', '  launch refusal after the parent changed directory inside a root-started session. If', '  the brief states an original start directory strictly below the selected rule\'s', '  directory, the refusal above applies unchanged. The parent session stays bound by', '  this rule.'].join('\n');
  const rev = lf(actualText('assets/agents/reviewer.md')); const cl = lf(actualText('assets/templates/CLAUDE.md')); const ag = lf(actualText('assets/templates/AGENTS.md'));
  const rv310 = rev.replace(`${RV320_1}\n\n`, '').replace(`${RV320_2}\n`, ''); const cl310 = cl.replace(`${CT320_1}\n`, ''); const ag310 = ag.replace(`\n${AT320_2}\n\n${AT320_1}\n`, '');
  check('AC-B1-1: [RV320_1] is present once inside section 2, before the "Plan coverage" paragraph, and [RV320_2] once, directly after the Verdict line at the end of the file', count(rev, RV320_1) === 1 && rev.indexOf(RV320_1) > rev.indexOf('## 2. What counts as a finding') && rev.indexOf(RV320_1) < rev.indexOf('Plan coverage is not a correctness boundary.') && count(rev, RV320_2) === 1 && rev.indexOf(RV320_2) > rev.indexOf('4. Verdict: **block**') && rev.endsWith(`${RV320_2}\n`), { rv1: count(rev, RV320_1), rv2: count(rev, RV320_2) });
  check('AC-B1-1: without the two paragraphs the reviewer is the 3.1.0 bytes (digest 696f86bc...), so nothing else changed', sha(rv310) === SHA310.reviewer, sha(rv310));
  check('AC-B1-1: every 3.1.0 reviewer line holding MUST, SHOULD or MAY is still present', rv310.split('\n').filter((l) => KEYWORD.test(l)).every((l) => rev.includes(l)));
  check('AC-B2-1: [CT320_1] is present once inside the claude block (after the line "This prevents false launch refusals..."), and [AT320_2] and [AT320_1] once in the agents block', (() => { const pc = parseBlocks(cl); const pa = parseBlocks(ag); const cb = pc.blocks.find((b) => b.id === 'claude'); const ab = pa.blocks.find((b) => b.id === 'agents'); return cb !== undefined && ab !== undefined && count(lf(cb.inner), CT320_1) === 1 && lf(cb.inner).includes(`  This prevents false launch refusals without treating unknown host state as verified.\n${CT320_1}\n`) && count(lf(ab.inner), AT320_2) === 1 && count(lf(ab.inner), AT320_1) === 1 && lf(ab.inner).indexOf(AT320_2) < lf(ab.inner).indexOf(AT320_1); })(), undefined);
  check('AC-B2-1: every 3.1.0 line of the claude template is still present byte for byte (the 3.1.0 bytes, digest 5bb1d5ed..., without the one bullet), with one begin and one end marker', sha(cl310) === SHA310.claude && count(cl, '<!-- project-setup:begin id=claude') === 1 && count(cl, '<!-- project-setup:end id=claude') === 1, sha(cl310));
  check('AC-B2-1 (A2): without the two paragraphs the AGENTS.md template is the 3.1.0 bytes (digest 616a26a5...), parses to six blocks with no marker error, and is at most 150 lines', sha(ag310) === SHA310.agents && parseBlocks(ag).errors.length === 0 && parseBlocks(ag).blocks.length === 6 && ag.replace(/\n$/, '').split('\n').length <= 150, { sha: sha(ag310), blocks: parseBlocks(ag).blocks.length, lines: ag.replace(/\n$/, '').split('\n').length });
  check('AC-B2-1: the CLAUDE.md template is at most 200 lines (scripts/validate.mjs:365)', cl.replace(/\n$/, '').split('\n').length <= 200, cl.replace(/\n$/, '').split('\n').length);
}
// The shipped policy data (AC-A4-2): strengthening only, by the real readSecurityPolicy.
{
  const dataText = actualText('data/secret-paths.json');
  const prior = attempt(() => JSON.parse(fs.readFileSync(path.join(SKILL, 'tests', 'fixtures', 'v320-policy-3.1.0.json'), 'utf8')));
  const priorBytes = attempt(() => fs.readFileSync(path.join(SKILL, 'tests', 'fixtures', 'v320-policy-3.1.0.json')));
  const data = attempt(() => JSON.parse(dataText));
  const idOf = (e) => JSON.stringify([e.anchor ?? (String(e.glob).startsWith('**/') ? 'any' : 'root'), String(e.glob).toLowerCase()]);
  const NEW_IDS = [JSON.stringify(['root', 'env/**']), JSON.stringify(['root', 'cert/**'])];
  const rp = failedAttempt(data) ? data : attempt(() => readSecurityPolicy(data));
  check('AC-A4-2: the 3.1.0 policy fixture is the pinned prior file (its normalized hash is the PRIOR_SHIPPED digest)', !failedAttempt(priorBytes) && normalizedHash(priorBytes) === PRIOR_POLICY_SHA, failedAttempt(priorBytes) ? priorBytes : normalizedHash(priorBytes));
  check('AC-A4-2: the shipped data/secret-paths.json passes the real readSecurityPolicy with sourceSchema 1 (a schema-1 file, so the installer-side derivation stays valid)', !failedAttempt(rp) && rp.sourceSchema === 1, failedAttempt(rp) ? rp : rp.sourceSchema);
  check('AC-A4-2: its identity set is the 3.1.0 set plus exactly ["root","env/**"] and ["root","cert/**"], each once', !failedAttempt(data) && !failedAttempt(prior) && (() => { const have = data.patterns.map(idOf); const old = prior.patterns.map(idOf); return have.length === old.length + 2 && new Set(have).size === have.length && NEW_IDS.every((x) => have.includes(x)) && JSON.stringify(have.filter((x) => !NEW_IDS.includes(x))) === JSON.stringify(old); })(), failedAttempt(data) ? data : data.patterns.length);
  check('AC-A4-2: the 20 old entries are deep-equal to the 3.1.0 entries and in the same relative order (nothing weakened, dropped, re-anchored or reworded)', !failedAttempt(data) && !failedAttempt(prior) && JSON.stringify(data.patterns.filter((e) => !NEW_IDS.includes(idOf(e)))) === JSON.stringify(prior.patterns), undefined);
  check('AC-A4-2: the two new entries are root-anchored directory entries (no "**/" prefix, so config code under src/ is not matched)', !failedAttempt(data) && data.patterns.filter((e) => NEW_IDS.includes(idOf(e))).length === 2 && data.patterns.filter((e) => NEW_IDS.includes(idOf(e))).every((e) => e.kind === 'dir' && !String(e.glob).startsWith('**/') && e.anchor === undefined), failedAttempt(data) ? data : undefined);
}
// The installer-side contract reached from the release gate: the A4 and A5 behaviour itself is tests/v320.test.mjs; here only the facts the release depends on.
{
  const migrate = actualText('scripts/migrate-security-paths.mjs');
  check('AC-A4-6 (static): PRIOR_SHIPPED in scripts/migrate-security-paths.mjs is named v3.0.0, carries the pinned digest, and adds exactly the two identities (a third identity would be an unreviewed protection change)', migrate.includes('PRIOR_SHIPPED') && migrate.includes(PRIOR_POLICY_SHA) && /v3\.0\.0/.test(migrate) && count(migrate, 'PRIOR_SHIPPED') >= 2, migrate.includes('PRIOR_SHIPPED') ? undefined : NOT_YET('PRIOR_SHIPPED in scripts/migrate-security-paths.mjs'));
  const detect = actualText('scripts/detect.mjs');
  check('AC-A5 (static): scripts/detect.mjs defines scanInstallerLeftovers and emits installerBackups; the file reads names and the existence of SKILL.md only (no readFileSync of a directory entry)', /scanInstallerLeftovers/.test(detect) && /installerBackups/.test(detect), /scanInstallerLeftovers/.test(detect) ? undefined : NOT_YET('scanInstallerLeftovers in scripts/detect.mjs'));
  check('AC-A5 (static): the 3.2.0 detect keeps the installs and installConflicts output (both names still present)', /installConflicts/.test(detect) && /\binstalls\b/.test(detect));
}

// ================================================================================================= D. version, claims, notes ====
{
  const p = claimsProblems(claims);
  check('D: VERSION, headings and every current public claim say 3.2.0; the 3.1.0 entry and observation stay (historical claims are not rewritten)', p.length === 0, p.map((q) => `${q.area}: ${q.msg}`).slice(0, 8));
  const notes = attempt(() => fs.readFileSync(path.join(SKILL, NOTES320)));
  const np = failedAttempt(notes) ? [`${NOTES320} is missing`] : notesProblems(notes);
  check(`D: ${NOTES320} keeps the notes contract (title, no 40- or 64-hex id, LF, no BOM, ASCII, no personal path, Upgrading with the numbered backup step and the tracked env/ and cert/ note, verification commands, Not measured, limitations)`, np.length === 0, failedAttempt(notes) ? NOT_YET(NOTES320) : np);
  check('D: RELEASE-NOTES-3.1.0.md (historical) is not edited: it is the pinned 3.1.0 bytes', (() => { if (BASE_FILES === PENDING) return false; const b = attempt(() => fs.readFileSync(path.join(SKILL, 'RELEASE-NOTES-3.1.0.md'))); return Buffer.isBuffer(b) && sha(b) === BASE_FILES['RELEASE-NOTES-3.1.0.md']; })(), BASE_FILES === PENDING ? `${PENDING}: BASE_FILES not written yet (session 2)` : undefined);
  check('AC-C1-2: the live acceptance document passes the user-path rule (only the two $env:USERPROFILE skill directories; D:\\ps-live paths are not user-profile paths)', accProblems(actualText('tests/live/BS-DOC-MAP-ACCEPTANCE.md')).length === 0, accProblems(actualText('tests/live/BS-DOC-MAP-ACCEPTANCE.md')));
  check('D: no version.json stamp exists (project-setup uses VERSION)', !fs.existsSync(path.join(SKILL, 'version.json')) && !fs.existsSync(path.join(SKILL, 'install', 'version.json')));
}

// =========================================================================================== E. everything else is unchanged ====
function copyTree(src, to, { skipTests }) {
  (function rec(s, d, rel) {
    fs.mkdirSync(d, { recursive: true });
    for (const e of fs.readdirSync(s, { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.name === '.git' || e.name === 'node_modules' || (skipTests && rel === '' && e.name === 'tests')) continue;
      if (e.isDirectory()) rec(path.join(s, e.name), path.join(d, e.name), r);
      else if (e.isFile()) fs.copyFileSync(path.join(s, e.name), path.join(d, e.name));
    }
  })(src, to, '');
}
function enumerate(dir, { skipTests = false } = {}) {
  const out = new Map();
  (function rec(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (skipTests && rel === '' && e.name === 'tests') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p, r); else out.set(r, sha(fs.readFileSync(p)));
    }
  })(dir, '');
  return out;
}
const SK_NOW = attempt(() => enumerate(SKILL));
{
  const now = failedAttempt(SK_NOW) ? null : SK_NOW;
  needPins('E: the project-setup file set (tests included) is the 3.1.0 set plus exactly the eight new files of plan 4.2, and every unamended file is its pinned 3.1.0 bytes (historical tests, helpers, fixtures, both runners and all unchanged skill files)', { BASE_FILES }, () => {
    const base = new Map(Object.entries(BASE_FILES).filter(([k]) => !k.startsWith('@root/')));
    const tp = now === null ? null : treeProblems(now, base, NEW_FILES, AMENDABLE.filter((k) => !k.startsWith('@root/')));
    return [tp !== null && tp.extra.length === 0 && tp.missing.length === 0 && tp.changed.length === 0, tp === null ? SK_NOW : tp];
  });
  needPins('E: the three root files that are not amended by name stay pinned and the root files amended are covered by section A (the 3.1.0 pin table holds exactly the three root keys)', { BASE_FILES }, () => [JSON.stringify(Object.keys(BASE_FILES).filter((k) => k.startsWith('@root/')).sort()) === JSON.stringify([...AMEND_ROOT].sort()), Object.keys(BASE_FILES).filter((k) => k.startsWith('@root/'))]);
  needPins(`E: ${NOTES320} is the pinned 3.2.0 bytes and no other new non-test file is byte-pinned (the helper, the three fixtures, the runner and the two specs are test infrastructure, pinned by set membership only: their own bytes would be circular)`, { NOW_FILES }, () => [now !== null && now.get(NOTES320) === NOW_FILES[NOTES320] && !Object.keys(NOW_FILES).some((k) => NEW_FILES.filter((f) => f !== NOTES320).includes(k)), undefined]);
  check('E: all eight new files of plan 4.2 exist', now !== null && NEW_FILES.every((f) => now.has(f)), now === null ? SK_NOW : NEW_FILES.filter((f) => !now.has(f)));
  needPins('E: nothing was added to the installed payload: every file the tree holds under SKILL.md, VERSION, CHANGELOG.md, references/, assets/, data/ and scripts/ is a 3.1.0 file (the notes and the tests are outside INCLUDE)', { BASE_FILES }, () => { const added = now === null ? null : [...now.keys()].filter((k) => INCLUDE.some((i) => k === i || k.startsWith(`${i}/`)) && !has(BASE_FILES, k)); return [added !== null && added.length === 0, added === null ? SK_NOW : added]; });
}

// ================================================================================================ F. install and release build ====
const isoEnv = (tmp) => {
  const home = path.join(tmp, 'home'); fs.mkdirSync(home, { recursive: true });
  const hooks = path.join(tmp, 'hooks-empty'); fs.mkdirSync(hooks, { recursive: true });
  const gitconfig = path.join(tmp, 'gitconfig');
  fs.writeFileSync(gitconfig, `[user]\n\tname = Fixture\n\temail = fixture@example.invalid\n[core]\n\tautocrlf = false\n\thooksPath = ${hooks.replace(/\\/g, '/')}\n[commit]\n\tgpgsign = false\n[tag]\n\tgpgsign = false\n`);
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^(GIT_|CLAUDE|CODEX_HOME$)/i.test(k) && typeof v === 'string') env[k] = v;
  Object.assign(env, { HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: path.join(tmp, 'claude-config'), CODEX_HOME: path.join(tmp, 'codex-home'), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: gitconfig, GIT_TERMINAL_PROMPT: '0' });
  return { env, home };
};
const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
{
  const tmp = scratchDir('install');
  const { env, home } = isoEnv(tmp);
  const inst = path.join(SKILL, 'install', 'install.mjs');
  const cd = path.join(tmp, 'claude-skills'); const xd = path.join(tmp, 'codex-skills');
  const r = attempt(() => runIn(env, process.execPath, [inst, '--targets', 'claude,codex', '--claude-dir', cd, '--codex-dir', xd], tmp));
  const out = failedAttempt(r) ? null : json(r.stdout);
  check('F: isolated install into both destinations exits 0 and reports 3.2.0 for the source and for each target', out !== null && r.status === 0 && out.ok === true && out.sourceVersion === '3.2.0' && Array.isArray(out.results) && out.results.length === 2 && out.results.every((x) => x.action === 'install' && x.to === '3.2.0'), failedAttempt(r) ? r : { status: r.status, out: String(r.stdout).slice(0, 300), err: String(r.stderr).slice(0, 200) });
  const v = attempt(() => runIn(env, process.execPath, [inst, 'verify', '--targets', 'claude,codex', '--claude-dir', cd, '--codex-dir', xd], tmp));
  const vo = failedAttempt(v) ? null : json(v.stdout);
  check('F (AC-B1-6): verify reports both installed copies current at 3.2.0 and matching this source', vo !== null && v.status === 0 && vo.ok === true && vo.sourceVersion === '3.2.0' && vo.report.length === 2 && vo.report.every((x) => x.installed === true && x.state === 'current' && x.version === '3.2.0' && x.matchesThisSource === true), failedAttempt(v) ? v : { status: v.status, out: String(v.stdout).slice(0, 300) });
  const treeNow = failedAttempt(SK_NOW) ? null : SK_NOW;
  for (const [name, dir] of [['claude', cd], ['codex', xd]]) {
    const p = path.join(dir, 'project-setup');
    const installed = attempt(() => { const m = enumerate(p); m.delete('.installed.json'); return m; });
    const wantTree = treeNow === null ? null : new Set([...treeNow.keys()].filter((k) => INCLUDE.some((i) => k === i || k.startsWith(`${i}/`))));
    check(`F: ${name} destination: the installed file set is exactly the INCLUDE part of the real tree (SKILL.md, VERSION, CHANGELOG.md, references, assets, data, scripts), with no tests, README, notes or fixtures`, !failedAttempt(installed) && wantTree !== null && JSON.stringify([...installed.keys()].sort()) === JSON.stringify([...wantTree].sort()), failedAttempt(installed) ? installed : { extra: [...installed.keys()].filter((k) => !wantTree.has(k)), missing: [...wantTree].filter((k) => !installed.has(k)) });
    needPins(`F: ${name} destination: the installed file set equals the 3.1.0 installed set (nothing added, nothing removed): every 3.1.0 file of the INCLUDE entries, and no other`, { BASE_FILES }, () => { const want = Object.keys(BASE_FILES).filter((k) => !k.startsWith('@root/') && INCLUDE.some((i) => k === i || k.startsWith(`${i}/`))).sort(); return [!failedAttempt(installed) && JSON.stringify([...installed.keys()].sort()) === JSON.stringify(want), failedAttempt(installed) ? installed : { extra: [...installed.keys()].filter((k) => !want.includes(k)), missing: want.filter((k) => !installed.has(k)) }]; });
    check(`F: ${name} destination: the installed bytes of every file equal the real tree's bytes, and VERSION is "3.2.0" plus LF`, !failedAttempt(installed) && treeNow !== null && [...installed].every(([k, h]) => treeNow.get(k) === h) && attempt(() => fs.readFileSync(path.join(p, 'VERSION'), 'utf8')) === '3.2.0\n', undefined);
    const meta = attempt(() => JSON.parse(fs.readFileSync(path.join(p, '.installed.json'), 'utf8')));
    check(`F: ${name} destination: the install record names project-setup 3.2.0`, !failedAttempt(meta) && meta.name === 'project-setup' && meta.version === '3.2.0', meta);
  }
  check('F: the isolated install wrote nothing to the redirected user home', attempt(() => fs.readdirSync(home).length) === 0);
}
function zipEntries(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('no end-of-central-directory record');
  const n = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('bad central directory entry');
    const method = buf.readUInt16LE(off + 10); const csize = buf.readUInt32LE(off + 20); const nlen = buf.readUInt16LE(off + 28); const xlen = buf.readUInt16LE(off + 30); const clen = buf.readUInt16LE(off + 32); const lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nlen);
    const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const data = buf.subarray(start, start + csize);
    out.set(name, method === 0 ? Buffer.from(data) : method === 8 ? zlib.inflateRawSync(data) : null);
    off += 46 + nlen + xlen + clen;
  }
  return out;
}
{
  const tmp = scratchDir('release');
  const { env } = isoEnv(tmp);
  const run = (cmd, args, cwd) => runIn(env, cmd, args, cwd);
  const must = (r, what) => { if (r.status !== 0) throw new Error(`${what}: exit ${r.status}`); return r; };
  const rb = attempt(() => {
    const repo = path.join(tmp, 'repo'); fs.mkdirSync(repo);
    must(run('git', ['init', '-q'], repo), 'git init');
    const dst = path.join(repo, 'project-setup');
    copyTree(SKILL, dst, { skipTests: true });
    must(run('git', ['add', '-A'], repo), 'git add');
    must(run('git', ['commit', '-q', '-m', 'release tree'], repo), 'git commit');
    must(run('git', ['tag', 'project-setup-v3.2.0'], repo), 'git tag');
    const out = path.join(tmp, 'out');
    const r = run(process.execPath, [path.join(dst, 'install', 'release.mjs'), '--tag', 'project-setup-v3.2.0', '--out', out], tmp);
    const zipPath = path.join(out, 'project-setup-3.2.0.zip');
    const pub = path.join(out, 'RELEASE-NOTES.md');
    const tagged = run('git', ['show', `project-setup-v3.2.0:project-setup/${NOTES320}`], repo);
    return { status: r.status, stdout: r.stdout, stderr: r.stderr, zip: fs.existsSync(zipPath) ? fs.readFileSync(zipPath) : null, listing: fs.existsSync(out) ? fs.readdirSync(out).sort() : [], published: fs.existsSync(pub) ? fs.readFileSync(pub, 'utf8') : '', tagged: tagged.status === 0 ? tagged.stdout : null };
  });
  const okRun = !failedAttempt(rb);
  check('F: the builder, run on the real 3.2.0 tree in a synthetic repository (tag project-setup-v3.2.0), exits 0 with no stderr and prints "RELEASE  OK  3.2.0" and the tag', okRun && rb.status === 0 && rb.stderr === '' && rb.stdout.startsWith('RELEASE  OK  3.2.0\nTAG  project-setup-v3.2.0\n'), okRun ? { status: rb.status, out: rb.stdout.slice(0, 200), err: rb.stderr.slice(0, 200) } : rb);
  check('F: the output holds exactly project-setup-3.2.0.zip and RELEASE-NOTES.md', okRun && JSON.stringify(rb.listing) === JSON.stringify(['RELEASE-NOTES.md', 'project-setup-3.2.0.zip']), okRun ? rb.listing : rb);
  const notesNow = attempt(() => fs.readFileSync(path.join(SKILL, NOTES320), 'utf8'));
  check('F: the publication notes are the identity header followed by the unchanged tagged 3.2.0 notes, which are the actual notes file', okRun && rb.published.startsWith('# project-setup 3.2.0 publication notes\n') && typeof rb.tagged === 'string' && rb.published.endsWith(rb.tagged) && rb.tagged === notesNow, okRun ? rb.published.slice(0, 120) : rb);
  const z = okRun && Buffer.isBuffer(rb.zip) ? attempt(() => zipEntries(rb.zip)) : null;
  const fileNames = z === null || failedAttempt(z) ? null : [...z.keys()].filter((n) => !n.endsWith('/')).sort();
  const wantNames = [...enumerate(SKILL, { skipTests: true }).keys()].map((r) => `project-setup/${r}`).sort();
  check('F: the archive holds exactly the actual project-setup payload (every non-test file, RELEASE-NOTES-3.2.0.md included, nothing else)', fileNames !== null && JSON.stringify(fileNames) === JSON.stringify(wantNames), fileNames === null ? (z === null ? NOT_YET('a built archive') : z) : { extra: fileNames.filter((n) => !wantNames.includes(n)), missing: wantNames.filter((n) => !fileNames.includes(n)) });
  check('F: the archive contains RELEASE-NOTES-3.2.0.md and the installed payload does not (the notes are release material, outside INCLUDE)', fileNames !== null && fileNames.includes(`project-setup/${NOTES320}`) && !INCLUDE.includes(NOTES320), fileNames === null ? NOT_YET('a built archive') : undefined);
  const bytesIn = (name) => (z !== null && !failedAttempt(z) && z.has(name) ? z.get(name) : null);
  const diff = ['SKILL.md', 'VERSION', 'CHANGELOG.md', 'references/docs-generation.md', 'references/modes.md', 'assets/agents/reviewer.md', 'data/secret-paths.json', NOTES320].filter((rel) => { const b = bytesIn(`project-setup/${rel}`); return b === null || !b.equals(fs.readFileSync(path.join(SKILL, ...rel.split('/')))); });
  check('F: the archived amended files and the notes are the actual 3.2.0 bytes, and the archived VERSION is "3.2.0" plus LF', fileNames !== null && diff.length === 0 && bytesIn('project-setup/VERSION') !== null && bytesIn('project-setup/VERSION').toString('utf8') === '3.2.0\n', fileNames === null ? NOT_YET('a built archive') : diff);
}

// ============================================================================================================== G. view identity ====
{
  const label = 'G: the view (tracked files of the copy set, then to310Repo) is exactly the pinned 3.1.0 tree, and the unedited release-3.1 and c18 gates pass inside it';
  if (H === null) check(label, false, NOT_YET('tests/helpers/v320-amendments.mjs', LH.err));
  else {
    const outDir = path.join(scratchDir('view'), 'v');
    const includeUntracked = process.env.V320_INCLUDE_UNTRACKED === '1';
    const built = attempt(() => { try { return H.buildView({ repoRoot: REPO, outDir, includeUntracked }); } catch (e) { return { threw: `${e.code === 'GIT_FAILED' ? 'GIT_FAILED (git ls-files failed: is the checkout owned by this user?)' : 'buildView'}: ${e.message}` }; } });
    check('G: buildView lists the copy set with git (cwd = the repository root); a Git failure is its own FAIL and never a skip', !failedAttempt(built) && built.files.length > 0, failedAttempt(built) ? built : built.files.length);
    if (failedAttempt(built)) check(label, false, `no view was built: ${built.threw}`);
    else {
      const rev = attempt(() => H.to310Repo(outDir));
      if (failedAttempt(rev)) check(label, false, /PIN_PENDING/.test(rev.threw) ? `${PENDING}: ${rev.threw}` : rev.threw);
      else needPins(label, { BASE_FILES }, () => {
        const got = H.viewManifest(outDir); const want = new Map(Object.entries(BASE_FILES));
        const extra = [...got.keys()].filter((k) => !want.has(k)).sort(); const missing = [...want.keys()].filter((k) => !got.has(k)).sort(); const changed = [...want.keys()].filter((k) => got.has(k) && got.get(k).sha256 !== want.get(k)).sort();
        const idOk = extra.length === 0 && missing.length === 0 && changed.length === 0;
        const gateRuns = idOk ? ['release-3.1.test.mjs', 'c18.test.mjs'].map((f) => { const r = spawnSync(process.execPath, [path.join('tests', f)], { cwd: path.join(outDir, 'project-setup'), env: isoEnv(scratchDir('g-env')).env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 580000, maxBuffer: 1 << 26 }); const t = RUN === null ? null : RUN.totalsOf(r.stdout); return { f, code: r.status, totals: t === null ? null : t.line, ok: r.status === 0 && t !== null && t.failed === 0 }; }) : [];
        return [idOk && gateRuns.length === 2 && gateRuns.every((g) => g.ok), { extra, missing, changed, gates: gateRuns }];
      });
    }
  }
}

// ------------------------------------------------------------------------------------------------------------------------- report ----
try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* the scratch directory was created by this run */ }
let failed = 0; let skipped = 0;
for (const r of results) {
  if (r.skip === true) { skipped += 1; console.log(`SKIP  ${r.name} (${r.detail})`); continue; }
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
  if (!r.ok && r.detail !== undefined) console.log(`        - ${(typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail)).slice(0, 600)}`);
}
console.log(`${results.length - failed - skipped} PASS / ${failed} FAIL / ${skipped} SKIP`);
process.exitCode = failed === 0 ? 0 : 1;
