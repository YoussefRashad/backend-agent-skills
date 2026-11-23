// 3.2.0 amendment engine and the reconstruction of the 3.1.0 tree (test-only; never part of the installer payload).
//
// Plan: docs/plans/2026-11-22-project-setup-v3.2.0-plan.md, sections 4.2, 4.3, 4.4 and 4.7 (decision D-6). The 3.2.0 source is the 3.1.0 source
// (base commit d0cd48e40f8fea897a27b28d7c679e55f0203237) plus the amendment records (AM320) and exactly the new files (NEW_FILES320).
//
// STATE OF THIS FILE (tests lane, session 1, written before any implementation exists): this is the ENGINE only. AM320, the two order maps and
// the 3.1.0 pin table (BASE_SHA320) are deliberately EMPTY or PIN_PENDING. Session 2 (a fresh tests-lane session, after review of the
// implementation) generates the AM320 literals and the order maps from a line diff of the base commit against the reviewed 3.2.0 files, the pin
// table, tests/fixtures/v320-prechange.json and the pin tables of the two new specs. It changes no function in this file.
// While BASE_SHA320 is PIN_PENDING, read310 and to310Repo THROW with a message that starts "PIN_PENDING:" and never return bytes that were not
// verified against a pin: a view built now is never silently trusted.
//
// A record is { file, before, old, neu, after } exactly as in v31-amendments.mjs: before + old + after is the 3.1.0 slice and before + neu +
// after the 3.2.0 slice, all strings, LF only. Keys are relative to project-setup/; the three repository-root files are keyed "@root/<path>".
// Every function takes the record set (and orders and pins) as an OPTIONAL last argument that defaults to the real module constants, so the
// specs can prove the engine on synthetic records without a second implementation. The gate that judges pass or fail is the spec's own
// (tests/release-3.2.0.test.mjs); this module is never asked to decide pass or fail there.
// Importing this module reads no file and starts no process: only read310, buildView, to310Repo, overlay and verifyView read, and only when called.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const CURRENT_VERSION320 = '3.2.0';
export const BASE_COMMIT320 = 'd0cd48e40f8fea897a27b28d7c679e55f0203237';
/** The marker of a value that session 2 has not generated yet. A spec that meets it prints a FAIL line naming it. */
export const PIN_PENDING = 'PIN_PENDING';

/** id -> frozen { file, before, old, neu, after }. EMPTY in session 1 (plan 4.7 step 1). */
export const AM320 = Object.freeze({});
/** file key -> frozen array of ids in apply order; every record exactly once under its own file. EMPTY in session 1. */
export const FORWARD_ORDER320 = Object.freeze({});
/** The exact per-file reverse of FORWARD_ORDER320. */
export const REVERSAL_ORDER320 = Object.freeze(Object.fromEntries(Object.entries(FORWARD_ORDER320).map(([f, ids]) => [f, Object.freeze([...ids].reverse())])));
export const AMENDED_FILES320 = Object.freeze(Object.keys(FORWARD_ORDER320));
/** The closed list of files 3.2.0 adds (plan 4.2), relative to project-setup/. to310Repo removes exactly these. */
export const NEW_FILES320 = Object.freeze([
  'tests/helpers/v320-amendments.mjs',
  'tests/fixtures/v320-prechange.json',
  'tests/fixtures/v320-policy-3.1.0.json',
  'tests/fixtures/v320-compat-expected.json',
  'tests/release-3.2.0.test.mjs',
  'tests/v320.test.mjs',
  'tests/run-310-view.mjs',
  'RELEASE-NOTES-3.2.0.md',
]);
/** SHA-256 of each amended file at the 3.1.0 base (the verified reversal result). PIN_PENDING until session 2 writes the table. */
export const BASE_SHA320 = PIN_PENDING;
/** The three repository-root files (keys of the root records). */
export const ROOT_FILES320 = Object.freeze(['@root/README.md', '@root/TODO.md', '@root/.ai/context/project-tree.md']);
/** Repository-relative prefixes the view copies (plan 4.3). backend-standards/templates/ is read by tests/bs-doc-map.test.mjs. */
export const VIEW_COPY_SET = Object.freeze(['project-setup/', 'backend-standards/templates/', 'README.md', 'TODO.md', '.ai/context/project-tree.md']);

const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const has = (o, k) => o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k);
const REC_KEYS = Object.freeze(['after', 'before', 'file', 'neu', 'old']);

function occurrences(text, needle) {
  const out = [];
  if (needle === '') return out;
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) out.push(i);
  return out;
}
const known = (records, id) => has(records, id);
/** One record reversed: before + neu + after must stand exactly once. null otherwise. */
function reverseOne(text, r) {
  const key = r.before + r.neu + r.after;
  const at = occurrences(text, key);
  if (at.length !== 1) return null;
  return text.slice(0, at[0]) + r.before + r.old + r.after + text.slice(at[0] + key.length);
}
/** One record applied: before + old + after must stand exactly once. null otherwise. */
function applyOne(text, r) {
  const key = r.before + r.old + r.after;
  const at = occurrences(text, key);
  if (at.length !== 1) return null;
  return text.slice(0, at[0]) + r.before + r.neu + r.after + text.slice(at[0] + key.length);
}
const wellFormed = (r) => r !== null && typeof r === 'object' && REC_KEYS.every((k) => typeof r[k] === 'string');

/** Reverses the named records in the given order. { text, failed }: text is null and failed names the first that does not verify. */
export function reverseSteps(text, ids, records = AM320) {
  let t = text;
  for (const id of ids) {
    if (!known(records, id) || !wellFormed(records[id])) return { text: null, failed: id };
    t = reverseOne(t, records[id]);
    if (t === null) return { text: null, failed: id };
  }
  return { text: t, failed: null };
}
/** Applies the named records in the given order; null when one does not stand exactly once. */
export function applySteps(text, ids, records = AM320) {
  let t = text;
  for (const id of ids) {
    if (!known(records, id) || !wellFormed(records[id])) return null;
    t = applyOne(t, records[id]);
    if (t === null) return null;
  }
  return t;
}
/** The 3.1.0 view of one amended file: every 3.2 record of that file reversed, last first. { text, failed }. */
export function reverseForFile(text, rel, records = AM320, forward = FORWARD_ORDER320) {
  if (!has(forward, rel)) return { text: null, failed: `no 3.2 amendment for ${rel}` };
  return reverseSteps(text, [...forward[rel]].reverse(), records);
}
export function applyForFile(text, rel, records = AM320, forward = FORWARD_ORDER320) {
  return has(forward, rel) ? applySteps(text, forward[rel], records) : null;
}

const REAL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/** Absolute path of a record key under a repository root ("@root/x" is repoRoot/x; every other key is repoRoot/project-setup/key). */
export const absOf320 = (rel, repoRoot = REAL_ROOT) => path.resolve(rel.startsWith('@root/') ? path.join(repoRoot, ...rel.slice(6).split('/')) : path.join(repoRoot, 'project-setup', ...rel.split('/')));

const pendingError = (what) => Object.assign(new Error(`PIN_PENDING: ${what}`), { code: 'PIN_PENDING' });
const pinOf = (pins, rel) => {
  if (pins === PIN_PENDING) throw pendingError('the 3.1.0 pin table (BASE_SHA320) is not written yet (session 2)');
  if (!has(pins, rel)) throw new Error(`no 3.1.0 pin for ${rel}`);
  return pins[rel];
};
const REAL_CFG = () => ({ records: AM320, forward: FORWARD_ORDER320, pins: BASE_SHA320, newFiles: NEW_FILES320 });

/**
 * fs.readFileSync for 3.1.0-era readers: an amended file of the real tree is returned as its verified 3.1.0 view (every 3.2 record reversed and the
 * result equal to the pinned SHA-256); any other path is read as is. Throws when a reversal does not verify, or with PIN_PENDING while the table is a stub.
 */
export function read310(absPath, { repoRoot = REAL_ROOT, cfg = REAL_CFG() } = {}) {
  const b = fs.readFileSync(absPath);
  const byAbs = new Map(Object.keys(cfg.forward).map((rel) => [absOf320(rel, repoRoot), rel]));
  const rel = byAbs.get(path.resolve(absPath));
  if (rel === undefined) return b;
  const r = reverseForFile(b.toString('utf8'), rel, cfg.records, cfg.forward);
  if (r.text === null) throw new Error(`3.2.0 amendment does not reverse for ${rel}: ${r.failed}`);
  if (sha256(Buffer.from(r.text, 'utf8')) !== pinOf(cfg.pins, rel)) throw new Error(`3.2.0 reversal of ${rel} is not the pinned 3.1.0 bytes`);
  return Buffer.from(r.text, 'utf8');
}

const isInside = (parent, child) => { const rel = path.relative(path.resolve(parent), path.resolve(child)); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };

/**
 * Builds the view: the working-tree bytes of the tracked files (git ls-files -z over VIEW_COPY_SET, cwd repoRoot) or, with includeUntracked,
 * of every file that is tracked or untracked and not ignored (-co --exclude-standard), copied into outDir. outDir must be empty (or absent) and
 * outside the repository. Copies nothing else: no .git, no node_modules, no ignored file. Throws { code: 'GIT_FAILED' } when Git fails (for
 * example a checkout the current user does not own), so a caller reports it as its own failure and never as a pass.
 * Returns { files, skippedMissing }: the repository-relative paths copied, and tracked paths that are deleted in the working tree.
 */
export function buildView({ repoRoot, outDir, includeUntracked = false }) {
  if (typeof repoRoot !== 'string' || typeof outDir !== 'string') throw new Error('buildView needs repoRoot and outDir');
  if (isInside(repoRoot, outDir)) throw new Error('the view directory must be outside the repository');
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length > 0) throw new Error('the view directory must be empty');
  const args = includeUntracked ? ['ls-files', '-z', '-co', '--exclude-standard', '--', ...VIEW_COPY_SET] : ['ls-files', '-z', '--', ...VIEW_COPY_SET];
  const r = spawnSync('git', args, { cwd: repoRoot, encoding: 'buffer', shell: false, windowsHide: true, maxBuffer: 1 << 26 });
  if (r.error || r.status !== 0) throw Object.assign(new Error(`GIT_FAILED: git ls-files exited ${r.error ? r.error.code : r.status}: ${String(r.stderr ?? '').trim().slice(0, 200)}`), { code: 'GIT_FAILED' });
  const names = [...new Set(r.stdout.toString('utf8').split('\0').filter(Boolean).map((p) => p.replace(/\\/g, '/')))].sort();
  fs.mkdirSync(outDir, { recursive: true });
  const files = []; const skippedMissing = [];
  for (const rel of names) {
    const from = path.join(repoRoot, ...rel.split('/'));
    const to = path.join(outDir, ...rel.split('/'));
    let st = null;
    try { st = fs.lstatSync(from); } catch { st = null; }
    if (st === null) { skippedMissing.push(rel); continue; }
    if (!st.isFile()) continue; // a link or a submodule is never followed into the view
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    files.push(rel);
  }
  return { files, skippedMissing };
}

/**
 * After buildView: reverses every amended file of the view (each record verified at its anchor), removes exactly the new files and throws unless every
 * amended file hashes to its 3.1.0 pin (PIN_PENDING while the table is a stub). An unrecorded edit elsewhere is left in place, so the later comparison
 * with the pinned 3.1.0 manifest shows it (the rule of to30Tree in v31-amendments.mjs).
 */
export function to310Repo(viewDir, cfg = REAL_CFG()) {
  const keys = Object.keys(cfg.forward);
  if (cfg.pins === PIN_PENDING) throw pendingError('the 3.1.0 pin table (BASE_SHA320) is not written yet (session 2)'); // refused before anything is written
  for (const rel of keys) {
    const p = absOf320(rel, viewDir);
    const r = reverseForFile(fs.readFileSync(p, 'utf8'), rel, cfg.records, cfg.forward);
    if (r.text === null) throw new Error(`3.2.0 amendment does not reverse for ${rel}: ${r.failed}`);
    if (sha256(Buffer.from(r.text, 'utf8')) !== pinOf(cfg.pins, rel)) throw new Error(`3.2.0 reversal of ${rel} is not the pinned 3.1.0 bytes`);
    fs.writeFileSync(p, r.text, 'utf8');
  }
  for (const rel of cfg.newFiles) fs.rmSync(path.join(viewDir, 'project-setup', ...rel.split('/')), { force: true });
}

/** After to310Repo: replaces only the named skill files (relative to project-setup/, never a test) with their real-tree 3.2.0 bytes (the compat run). */
export function overlay(viewDir, repoRoot, relPaths) {
  for (const rel of relPaths) {
    if (typeof rel !== 'string' || rel === '' || rel.startsWith('@root/') || /(^|\/)\.\.(\/|$)|\\|^\//.test(rel)) throw new Error(`overlay: not a project-setup-relative path: ${String(rel)}`);
    if (rel.startsWith('tests/')) throw new Error(`overlay: a test file is never overlaid: ${rel}`);
    const from = path.join(repoRoot, 'project-setup', ...rel.split('/'));
    const to = path.join(viewDir, 'project-setup', ...rel.split('/'));
    if (!fs.existsSync(to)) throw new Error(`overlay: ${rel} is not in the view`);
    fs.copyFileSync(from, to);
  }
}

/** The manifest of a view: Map key -> { sha256, bytes } over every file under project-setup/ (keys relative to it) and the three root files ("@root/<path>"). */
export function viewManifest(viewDir) {
  const out = new Map();
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, r); else if (e.isFile()) { const b = fs.readFileSync(p); out.set(r, { sha256: sha256(b), bytes: b.length }); }
    }
  })(path.join(viewDir, 'project-setup'), '');
  for (const k of ROOT_FILES320) {
    try { const b = fs.readFileSync(absOf320(k, viewDir)); out.set(k, { sha256: sha256(b), bytes: b.length }); } catch { /* absent: the comparison reports it as missing */ }
  }
  return out;
}

/**
 * Compares a view with the pinned 3.1.0 manifest (prechange.files: key -> { sha256, bytes }). Keys listed in skip (overlaid files) are not compared.
 * { extra, missing, changed } with sorted key lists; all three empty means the view IS the 3.1.0 tree.
 */
export function verifyView(viewDir, prechange, { skip = [] } = {}) {
  if (prechange === null || typeof prechange !== 'object' || prechange.files === null || typeof prechange.files !== 'object') throw pendingError('the pinned 3.1.0 manifest (tests/fixtures/v320-prechange.json) is not written yet (session 2)');
  const skipSet = new Set(skip);
  const got = viewManifest(viewDir);
  const want = new Map(Object.entries(prechange.files));
  const extra = [...got.keys()].filter((k) => !want.has(k) && !skipSet.has(k)).sort();
  const missing = [...want.keys()].filter((k) => !got.has(k) && !skipSet.has(k)).sort();
  const changed = [...want.keys()].filter((k) => got.has(k) && !skipSet.has(k) && (got.get(k).sha256 !== want.get(k).sha256 || got.get(k).bytes !== want.get(k).bytes)).sort();
  return { extra, missing, changed };
}
