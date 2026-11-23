#!/usr/bin/env node
// Builds the reconstructed 3.1.0 view of this working tree and runs the historical gates inside it (plan 4.6, decisions D-12 and Q1).
//
//   node tests/run-310-view.mjs --out <empty dir outside the repository and outside the temp directory>
//        [--include-untracked] [--overlay <rel,rel>] [--label <name>] [--run release-3.1,c18,bs-doc-map,accept-rc1]
//
// What it does, in order: builds the view (tracked files over the explicit copy set; with --include-untracked also untracked, non-ignored files, for
// runs before a commit exists), reverses every recorded 3.2.0 amendment (to310Repo), overlays the named skill files from the real tree (the compat
// runs), verifies the whole view against the pinned 3.1.0 manifest (tests/fixtures/v320-prechange.json; overlaid files are skipped because the real-tree
// release gate already proves their 3.2.0 bytes), then runs each named gate from the view, serially, and prints each gate's own totals line and exit
// code. It writes nothing outside --out and never deletes it. The historical gates run UNEDITED from their own copy in the view; each derives its roots
// from import.meta.url.
//
// Compat runs: tests/accept-rc1.mjs passes only on 100/0/0 or 99/0/1, so a run with an overlay always exits 1. The runner then ignores that exit code
// and the FAIL ids, reads the retained results file named by the RESULTS line, takes the full set of results[].failures strings and compares that set,
// by exact string, with the pinned list of the run in tests/fixtures/v320-compat-expected.json ({ schema: 1, runs: { "<label>": [<string>...] } }).
// Any unlisted failure string is a backward-compatibility defect; any listed string that did not occur is reported as a stale list.
// Nothing here edits a historical test, helper, fixture or runner. Importing this module runs nothing: the CLI starts only when the file is the entry point.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildView, to310Repo, overlay, verifyView, PIN_PENDING } from './helpers/v320-amendments.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..');
const REPO = path.resolve(SKILL, '..');

/** gate name -> the file under project-setup/tests/ that is run from the view. */
export const GATES = Object.freeze({ 'release-3.1': 'release-3.1.test.mjs', c18: 'c18.test.mjs', 'bs-doc-map': 'bs-doc-map.test.mjs', 'accept-rc1': 'accept-rc1.mjs' });
export const DEFAULT_RUN = Object.freeze(['release-3.1', 'c18', 'bs-doc-map']);
const FLAGS = Object.freeze(['--out', '--include-untracked', '--overlay', '--label', '--run']);
const TOTALS = /^(\d+) PASS \/ (\d+) FAIL \/ (\d+) SKIP$/;
const USAGE = 'usage: run-310-view.mjs --out <dir> [--include-untracked] [--overlay <rel,rel>] [--label <name>] [--run release-3.1,c18,bs-doc-map,accept-rc1]';

/** Strict argument parser: { ok: true, out, includeUntracked, overlay, label, run } or { ok: false, error }. A flag twice, an unknown flag or a missing value is an error. */
export function parseCliArgs(argv) {
  const o = { includeUntracked: false, overlay: [], label: null, run: [...DEFAULT_RUN], out: null };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!FLAGS.includes(a)) return { ok: false, error: `unknown argument ${a}` };
    if (seen.has(a)) return { ok: false, error: `${a} given twice` };
    seen.add(a);
    if (a === '--include-untracked') { o.includeUntracked = true; continue; }
    const v = argv[i + 1];
    if (typeof v !== 'string' || v === '' || v.startsWith('--')) return { ok: false, error: `${a} needs a value` };
    i += 1;
    if (a === '--out') o.out = v;
    else if (a === '--label') o.label = v;
    else if (a === '--overlay') { o.overlay = v.split(',').filter(Boolean); if (o.overlay.length === 0) return { ok: false, error: '--overlay names no file' }; }
    else if (a === '--run') {
      const names = v.split(',').filter(Boolean);
      const bad = names.filter((n) => !Object.prototype.hasOwnProperty.call(GATES, n));
      if (names.length === 0 || bad.length > 0) return { ok: false, error: `unknown gate ${bad.join(',') || '(none)'}` };
      if (new Set(names).size !== names.length) return { ok: false, error: '--run names a gate twice' };
      o.run = names;
    }
  }
  if (o.out === null) return { ok: false, error: '--out is required' };
  if (o.label !== null && o.overlay.length === 0) return { ok: false, error: '--label belongs to an overlay run (it names the pinned list)' };
  if (o.label !== null && !o.run.includes('accept-rc1')) return { ok: false, error: '--label is read only by an accept-rc1 run' };
  return { ok: true, ...o };
}

const fold = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
const realOfNearest = (p) => {
  let cur = path.resolve(p); const tail = [];
  for (;;) {
    try { return path.join(fs.realpathSync.native(cur), ...tail.reverse()); } catch { /* climb */ }
    const up = path.dirname(cur);
    if (up === cur) return path.resolve(p);
    tail.push(path.basename(cur)); cur = up;
  }
};
const within = (parent, child) => { const rel = path.relative(fold(parent), fold(child)); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };
/** The problems of an --out directory: [] when it is absent or empty, outside the repository and outside the temp directory. */
export function outDirProblems(out, { repoRoot = REPO, tmp = os.tmpdir() } = {}) {
  const p = [];
  const abs = realOfNearest(out);
  if (within(realOfNearest(repoRoot), abs)) p.push('the view directory is inside the repository');
  if (within(realOfNearest(tmp), abs)) p.push('the view directory is inside the temp directory (the Codex sandbox cannot use it)');
  try { if (fs.readdirSync(abs).length > 0) p.push('the view directory is not empty'); } catch (e) { if (!e || e.code !== 'ENOENT') p.push('the view directory cannot be read'); }
  return p;
}

/** The last "<n> PASS / <n> FAIL / <n> SKIP" line of a gate's stdout as { passed, failed, skipped, line }, or null. */
export function totalsOf(stdout) {
  const lines = String(stdout).split('\n').map((l) => l.replace(/\r$/, ''));
  for (let i = lines.length - 1; i >= 0; i--) { const m = TOTALS.exec(lines[i]); if (m) return { passed: Number(m[1]), failed: Number(m[2]), skipped: Number(m[3]), line: lines[i] }; }
  return null;
}

/** The RESULTS file path an accept-rc1 stdout names, or null. */
export function resultsFileOf(stdout) {
  const m = /^RESULTS {2}(.+)$/m.exec(String(stdout).replace(/\r/g, ''));
  return m ? m[1].trim() : null;
}

/** The full set of results[].failures strings of a retained results file (JSON text), sorted and unique; throws on a malformed file. */
export function failureStringsOf(resultsText) {
  const o = JSON.parse(resultsText);
  if (o === null || typeof o !== 'object' || !Array.isArray(o.results)) throw new Error('the results file has no results array');
  const out = new Set();
  for (const r of o.results) {
    if (r === null || typeof r !== 'object' || !Array.isArray(r.failures) || r.failures.some((f) => typeof f !== 'string')) throw new Error('a result has no failures array of strings');
    for (const f of r.failures) out.add(f);
  }
  return [...out].sort();
}

const namesFile = (label, files) => files.some((f) => label.includes(f) || label.includes(path.posix.basename(f)));
/**
 * The pinned list of one run is well formed when it is a list of non-empty unique strings and, by the rule of plan 4.6, every entry names an
 * overlaid file (run 1: scripts) or, for the run that also overlays data/secret-paths.json, names that shipped policy file or an overlaid script.
 * Returns the entries that break the rule. A failing behaviour assertion is never a valid entry.
 */
export function pinnedListProblems(list, overlaid) {
  if (!Array.isArray(list)) return ['the pinned list is not an array'];
  const bad = [];
  const seen = new Set();
  for (const e of list) {
    if (typeof e !== 'string' || e === '' || seen.has(e)) { bad.push(String(e)); continue; }
    seen.add(e);
    const policy = overlaid.includes('data/secret-paths.json') && /secret-paths|20[- ]entr/i.test(e);
    if (!namesFile(e, overlaid) && !policy) bad.push(e);
  }
  return bad;
}

/** Compares the failure strings a run produced with its pinned list: { unlisted, stale, badPins, ok }. Exact string equality, nothing fuzzy. */
export function compareCompat({ actual, pinned, overlaid }) {
  const want = new Set(pinned);
  const got = new Set(actual);
  const unlisted = [...got].filter((f) => !want.has(f)).sort();
  const stale = [...want].filter((f) => !got.has(f)).sort();
  const badPins = pinnedListProblems(pinned, overlaid);
  return { unlisted, stale, badPins, ok: unlisted.length === 0 && stale.length === 0 && badPins.length === 0 };
}

function readJsonFile(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }

/** The CLI. Returns { code, lines }. Every line goes through log as it is produced, so a long gate shows progress; a spec passes its own log. */
export function runView(argv, { repoRoot = REPO, spawn = spawnSync, log = () => {} } = {}) {
  const lines = [];
  const say = (s) => { lines.push(s); log(s); };
  const stop = (code, ...ls) => { for (const l of ls) say(l); return { code, lines }; };
  const a = parseCliArgs(argv);
  if (!a.ok) return stop(2, `RUN-310-VIEW  USAGE  ${a.error}`, USAGE);
  const problems = outDirProblems(a.out, { repoRoot });
  if (problems.length > 0) return stop(2, ...problems.map((p) => `RUN-310-VIEW  REFUSED  ${p}`));
  const out = path.resolve(a.out);
  try {
    const built = buildView({ repoRoot, outDir: out, includeUntracked: a.includeUntracked });
    say(`VIEW  ${built.files.length} files copied (${a.includeUntracked ? 'tracked and untracked' : 'tracked'})${built.skippedMissing.length ? `; ${built.skippedMissing.length} tracked path(s) missing in the working tree` : ''}`);
    to310Repo(out);
    if (a.overlay.length > 0) { overlay(out, repoRoot, a.overlay); say(`OVERLAY  ${a.overlay.join(', ')}`); }
  } catch (e) {
    const pending = e && (e.code === 'PIN_PENDING' || /^PIN_PENDING/.test(String(e.message)));
    return stop(1, `RUN-310-VIEW  ${pending ? 'PIN_PENDING' : 'FAIL'}  ${String(e && e.message ? e.message : e).split('\n')[0]}`);
  }
  const prechange = readJsonFile(path.join(repoRoot, 'project-setup', 'tests', 'fixtures', 'v320-prechange.json'));
  if (prechange === null) return stop(1, `RUN-310-VIEW  ${PIN_PENDING}  tests/fixtures/v320-prechange.json is missing or unreadable`);
  let diff;
  try { diff = verifyView(out, prechange, { skip: a.overlay }); } catch (e) { return stop(1, `RUN-310-VIEW  FAIL  ${String(e.message).split('\n')[0]}`); }
  if (diff.extra.length + diff.missing.length + diff.changed.length > 0) {
    return stop(1, `MANIFEST  FAIL  the view is not the pinned 3.1.0 tree (extra ${diff.extra.length}, missing ${diff.missing.length}, changed ${diff.changed.length})`, ...[...diff.extra.map((k) => `        - extra ${k}`), ...diff.missing.map((k) => `        - missing ${k}`), ...diff.changed.map((k) => `        - changed ${k}`)].slice(0, 20));
  }
  say(`MANIFEST  OK  the view equals the pinned 3.1.0 manifest${a.overlay.length ? ` (overlaid files skipped: ${a.overlay.length})` : ''}`);
  let code = 0;
  for (const gate of a.run) {
    const file = path.join(out, 'project-setup', 'tests', GATES[gate]);
    const r = spawn(process.execPath, [file], { cwd: out, env: process.env, encoding: 'utf8', shell: false, windowsHide: true, timeout: gate === 'accept-rc1' ? 2400000 : 1800000, maxBuffer: 1 << 27 });
    const t = totalsOf(r.stdout ?? '');
    say(`GATE  ${gate}  exit ${r.status === null ? `none (${r.error ? r.error.code : r.signal})` : r.status}${t ? `  ${t.line}` : '  (no totals line)'}`);
    if (gate === 'accept-rc1') {
      const results = resultsFileOf(r.stdout ?? '');
      const verdict = /^ACCEPT-RC1 {2}(.+)$/m.exec(String(r.stdout ?? ''));
      if (verdict) say(`  ${verdict[0]}`);
      if (a.overlay.length > 0) {
        const pinned = (readJsonFile(path.join(repoRoot, 'project-setup', 'tests', 'fixtures', 'v320-compat-expected.json')) ?? {}).runs;
        const list = pinned && a.label !== null && Object.prototype.hasOwnProperty.call(pinned, a.label) ? pinned[a.label] : null;
        if (list === null) { say(`COMPAT  ${a.label ?? '(no label)'}  FAIL  no pinned list (tests/fixtures/v320-compat-expected.json is missing or has no run of that label)`); code = 1; continue; }
        let actual;
        try { actual = failureStringsOf(fs.readFileSync(results, 'utf8')); } catch (e) { say(`COMPAT  ${a.label}  FAIL  the retained results file cannot be read (${String(e.message).split('\n')[0]})`); code = 1; continue; }
        const c = compareCompat({ actual, pinned: list, overlaid: a.overlay });
        say(`COMPAT  ${a.label}  ${c.ok ? 'OK' : 'FAIL'}  ${actual.length} failure string(s); unlisted ${c.unlisted.length}; stale ${c.stale.length}; pins that name no overlaid file ${c.badPins.length}`);
        for (const [k, v] of [['unlisted', c.unlisted], ['stale', c.stale], ['bad pin', c.badPins]]) for (const s of v.slice(0, 10)) say(`        - ${k}: ${s.slice(0, 300)}`);
        if (!c.ok) code = 1;
        continue; // the child exit code (always 1 with an overlay) and its FAIL ids are not used
      }
    }
    if (r.status !== 0 || (t !== null && t.failed > 0)) code = 1;
  }
  return { code, lines };
}

const norm = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
if (process.argv[1] && norm(process.argv[1]) === norm(fileURLToPath(import.meta.url))) {
  const r = runView(process.argv.slice(2), { log: (s) => process.stdout.write(`${s}\n`) });
  process.exitCode = r.code;
}
