#!/usr/bin/env node
// Builds the reconstructed 3.1.0 view of this working tree and runs the historical gates inside it (plan 4.6, decisions D-12 and Q1).
//
//   node tests/run-310-view.mjs --out <empty dir outside the repository and outside the temp directory>
//        [--include-untracked] [--overlay <rel,rel>] [--label <name>] [--run release-3.1,c18,bs-doc-map,accept-rc1]
//
// What it does, in order: builds the view (tracked files over the explicit copy set; with --include-untracked also untracked, non-ignored files, for
// runs before a commit exists), reverses every recorded 3.2.0 amendment (to310Repo), overlays the named skill files from the real tree (the compat
// runs), verifies the whole view against the pinned 3.1.0 manifest (tests/fixtures/v320-prechange.json; overlaid files are skipped because the real-tree
// release gate already proves their 3.2.0 bytes), then (accept-rc1 only) bootstraps what the strict gate reads besides the skill files, then runs each
// named gate from the view, serially, and prints each gate's own totals line and exit code. THE RUNNER ITSELF writes only under --out, apart from one
// short-lived private directory under the operating system's temp directory (os.tmpdir(): run310-git-*) that holds the git configuration of the accept-rc1
// bootstrap and is removed when the bootstrap ends; it never deletes --out and never writes to the repository it runs in.
// THE HISTORICAL GATES IT STARTS ARE NOT CONFINED TO --out: each writes its own fixtures and evidence
// under the operating system's temp directory (os.tmpdir(): ps-tests-*, ps-accept-rc1-*, ps-r31-*, ps-c18-* and ps-bsmap-* directories), which the
// runner neither redirects nor removes; clean those up yourself. The historical gates run UNEDITED from their own copy in the view; each derives its
// roots from import.meta.url.
//
// Paths: --out is checked as spelled (a Windows component that ends with a dot or a space, a device name, a stream or an extended-length prefix is refused
// before anything is written) and then ONE canonical path (the nearest existing ancestor resolved through links and short names, plus the checked tail) is
// used for every file-system call, every child cwd and every git call: the check and the use can never name different directories.
//
// Environment: every inherited GIT_* variable (GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, GIT_OBJECT_DIRECTORY, GIT_COMMON_DIR, GIT_NAMESPACE, GIT_CONFIG_*
// and the rest; a runner started from a git hook inherits several) is removed from the environment of the view construction, of every git call of the
// bootstrap and of every gate child. The gates build their own isolated GIT_CONFIG_* environment. Every git call of the bootstrap runs with a runner-owned
// configuration instead of the user's: GIT_CONFIG_NOSYSTEM=1, GIT_ATTR_NOSYSTEM=1, GIT_CONFIG_GLOBAL naming a small file the runner writes (identity,
// no line-ending conversion, an empty hooks directory, local file transport), HOME, USERPROFILE and XDG_CONFIG_HOME naming an empty directory, and
// every call bound to its repository (--git-dir, plus --work-tree for the view) with --no-replace-objects. The view construction (git ls-files in the
// repository: a read of the tracked file list) keeps the user's own git configuration, only the GIT_* variables are removed there; a wrong list shows as a manifest difference.
//
// The accept-rc1 bootstrap (bootstrapStrictGate; a recorded deviation from plan 4.3 / 5.4, found by the first full view run): the strict gate needs two
// things a bare view lacks, so a run that names accept-rc1 first adds, inside --out only, (1) docs/plans/ exactly as the base commit holds it (the
// 3.1.0 frozen records, read with git archive from the commit, never from the working tree, and then checked file by file, path and git blob id,
// against git ls-tree of that commit: an archive attribute such as export-ignore or export-subst cannot change what is written; a replacement ref
// cannot change it either, and a file name that is not valid UTF-8 is refused) and (2) a git
// repository holding the local tags of the repository this runner runs in (the genuine-v2 fixtures verify project-setup-v2.0.0, which must resolve to
// a commit) with one commit of the view (the snapshot checks read HEAD). The base must be a commit, not another kind of object.
// It runs after the manifest check, so docs/plans/ and .git never count as view extras, and before any gate. A failure is a runner failure
// ("RUN-310-VIEW  BOOTSTRAP FAIL"), exit 1, and no gate runs. The repository this runner runs in is only read (git archive, git ls-tree, git fetch).
//
// Compat runs: tests/accept-rc1.mjs passes only on 100/0/0 or 99/0/1, so a run with an overlay always exits 1. The runner then ignores that exit code
// and the FAIL ids, reads the retained results file named by the RESULTS line, takes the full set of results[].failures strings and compares that set,
// by exact string, with the pinned list of the run in tests/fixtures/v320-compat-expected.json ({ schema: 1, runs: { "<label>": [<string>...] } }).
// Any unlisted failure string is a backward-compatibility defect; any listed string that did not occur is reported as a stale list.
// Nothing here edits a historical test, helper, fixture or runner. Importing this module runs nothing: the CLI starts only when the file is the entry point.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildView, to310Repo, overlay, verifyView, PIN_PENDING, BASE_COMMIT320, realOfNearest, windowsSpellingProblem } from './helpers/v320-amendments.mjs';

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
// A relative path leaves its base only through a parent SEGMENT: ".." alone or ".." followed by a separator. A name that merely starts with two dots
// ("..view", "..a") is an ordinary child, and a sibling whose name starts with the base name ("repo-view" next to "repo") has a relative path that
// starts with a parent segment, so it is outside. Both directions matter: a prefix test on the text accepts "<repo>/..view" as outside and writes the
// view into the repository.
const leavesBase = (rel) => rel === '..' || rel.startsWith('../') || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
const within = (parent, child) => { const rel = path.relative(fold(parent), fold(child)); return rel === '' || !leavesBase(rel); };
/**
 * Checks an --out directory and returns { path, problems }. problems is [] when the directory is absent or empty, outside the repository and outside the temp
 * directory; path is then THE canonical directory every later file-system call, child cwd and git call must use (never the spelling the user typed), else null.
 * A Windows spelling that the file-system calls and a child process read differently ("<repo>." is "<repo>" to a child's cwd and a missing sibling to
 * realpath) is refused first, for --out and for the repository and temp paths it is compared with, before the file system is looked at (platform: injectable).
 */
export function resolveOutDir(out, { repoRoot = REPO, tmp = os.tmpdir(), platform = process.platform } = {}) {
  const p = [];
  for (const [what, v] of [['the view directory', out], ['the repository path', repoRoot], ['the temp path', tmp]]) {
    const s = windowsSpellingProblem(v, platform);
    if (s !== null) p.push(`${what} is refused before anything is written: ${s}`);
  }
  if (p.length > 0) return { path: null, problems: p };
  const abs = realOfNearest(out);
  if (within(realOfNearest(repoRoot), abs)) p.push('the view directory is inside the repository');
  if (within(realOfNearest(tmp), abs)) p.push('the view directory is inside the temp directory (the Codex sandbox cannot use it)');
  try { if (fs.readdirSync(abs).length > 0) p.push('the view directory is not empty'); } catch (e) { if (!e || e.code !== 'ENOENT') p.push('the view directory cannot be read'); }
  return { path: p.length === 0 ? abs : null, problems: p };
}
/** The problems of an --out directory (see resolveOutDir): [] when it is acceptable. */
export const outDirProblems = (out, opts = {}) => resolveOutDir(out, opts).problems;

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

// The only failure strings a compat run may pin are the digest assertions of the overlaid skill files. In the retained results file such a string is
//   "<Cnn> component assertions pass :: <JSON>"      (tests/accept-rc1.mjs reports a component's failed ids this way)
// whose JSON is { "errors": [], "failed": [ { "id": "<suite>/<Cnn>/<name>", "failures": [ "<file> is unchanged" | "<file> is byte for byte its pre-C17 bytes",
// each optionally followed by ' :: "<64 hex>"' ] } ] } and <file> is an overlaid file under scripts/ (or data/secret-paths.json when that is overlaid).
// A filename inside a behaviour failure ("scripts/detect.mjs fails to report installer backups") is NOT a digest assertion and is never a valid pin.
const COMPONENT_ENTRY = /^(C\d{1,2}) component assertions pass :: ([\s\S]+)$/;
const DIGEST_FAILURE = /^(\S+) is (?:unchanged|byte for byte its pre-C17 bytes)(?: :: "[0-9a-f]{64}")?$/;
const COMPONENT_ID = /^[A-Z][A-Z0-9]*\/(C\d{1,2})\/[A-Za-z0-9_.-]+$/;
const sameKeys = (o, keys) => o !== null && typeof o === 'object' && !Array.isArray(o) && JSON.stringify(Object.keys(o).sort()) === JSON.stringify([...keys].sort());
/** Why one pinned string is not a valid digest-assertion pin for these overlaid files, or null. A string whose JSON does not parse (the results file cuts long strings) is never valid. */
export function pinProblem(entry, overlaid) {
  const m = typeof entry === 'string' ? COMPONENT_ENTRY.exec(entry) : null;
  if (m === null) return 'not a "<Cnn> component assertions pass :: <JSON>" entry';
  let o;
  try { o = JSON.parse(m[2]); } catch { return 'its JSON does not parse (a cut string is never a valid pin)'; }
  if (JSON.stringify(o) !== m[2]) return 'its JSON is not in the compact form the results file writes';
  if (!sameKeys(o, ['errors', 'failed']) || !Array.isArray(o.errors) || o.errors.length !== 0) return 'errors is not exactly the empty list';
  if (!Array.isArray(o.failed) || o.failed.length === 0) return 'failed is not a non-empty list';
  for (const f of o.failed) {
    if (!sameKeys(f, ['id', 'failures']) || typeof f.id !== 'string') return 'a failed entry is not exactly { id, failures }';
    const id = COMPONENT_ID.exec(f.id);
    if (id === null || id[1] !== m[1]) return `the id ${JSON.stringify(String(f.id).slice(0, 80))} is not <suite>/${m[1]}/<name>`;
    if (!Array.isArray(f.failures) || f.failures.length === 0) return 'failures is not a non-empty list';
    for (const s of f.failures) {
      const d = typeof s === 'string' ? DIGEST_FAILURE.exec(s) : null;
      if (d === null) return `a failure is not a digest assertion (${JSON.stringify(String(s).slice(0, 80))})`;
      if (!overlaid.includes(d[1]) || !(d[1].startsWith('scripts/') || d[1] === 'data/secret-paths.json')) return `${d[1]} is not an overlaid skill file`;
    }
  }
  return null;
}
/**
 * The pinned list of one run is well formed when it is a list of unique strings that each pass pinProblem (plan 4.6: a digest assertion of an
 * overlaid file, nothing else). Returns the entries that break the rule. A failing behaviour assertion is never a valid entry, whatever it names.
 */
export function pinnedListProblems(list, overlaid) {
  if (!Array.isArray(list)) return ['the pinned list is not an array'];
  const bad = [];
  const seen = new Set();
  for (const e of list) {
    if (typeof e !== 'string' || e === '' || seen.has(e)) { bad.push(String(e)); continue; }
    seen.add(e);
    if (pinProblem(e, overlaid) !== null) bad.push(e);
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

// ------------------------------------------------------------------------------------------------------------- the accept-rc1 bootstrap ----
const TAR_BLOCK = 512;
const PLANS_ROOT = 'docs/plans';
// A file name is compared and written as text, so it must be text: invalid UTF-8 is refused (a lossy decode turns every bad byte into U+FFFD, two different
// names can then agree, and a file with another name than the commit's is written). ignoreBOM keeps a leading U+FEFF instead of dropping it.
const STRICT_UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const strictUtf8 = (b, what) => {
  try { return STRICT_UTF8.decode(b); } catch { throw new Error(`${what} is not valid UTF-8 (a file name must round-trip byte for byte)`); }
};
const tarText = (b, what = 'a tar entry name') => { const nul = b.indexOf(0); return strictUtf8(nul === -1 ? b : b.subarray(0, nul), what); };
const tarNumber = (b) => {
  if (b[0] & 0x80) throw new Error('the tar stream holds a base-256 number (git archive writes none for these files)');
  const s = b.toString('ascii').replace(/\0[\s\S]*$/, '').trim();
  if (s === '') return 0;
  if (!/^[0-7]+$/.test(s)) throw new Error('a tar header holds a number that is not octal');
  return parseInt(s, 8);
};
function paxRecords(body) {
  const out = {};
  for (let pos = 0; pos < body.length;) {
    const sp = body.indexOf(0x20, pos);
    const len = sp === -1 ? NaN : Number(body.subarray(pos, sp).toString('ascii'));
    if (!Number.isInteger(len) || len < 5 || pos + len > body.length) throw new Error('a tar pax header is malformed');
    const rec = strictUtf8(body.subarray(sp + 1, pos + len), 'a tar pax record').replace(/\n$/, '');
    const eq = rec.indexOf('=');
    if (eq < 1) throw new Error('a tar pax record has no key');
    out[rec.slice(0, eq)] = rec.slice(eq + 1);
    pos += len;
  }
  return out;
}

/**
 * Reads the ustar/pax stream that `git archive --format=tar` writes into [{ path, type: 'file' | 'dir', data }] (data is a Buffer for a file, null for a
 * directory). Every header checksum is verified; a truncated stream, a stream without its end marker, a base-256 number, and every entry that is not a
 * regular file or a directory (a link, a device) are errors. The path of an entry is the pax "path" record, else the ustar prefix and name. Pure: no file is read.
 */
export function parseTar(buf) {
  if (!Buffer.isBuffer(buf)) throw new Error('parseTar needs a Buffer');
  const entries = [];
  let off = 0; let pax = null; let ended = false;
  while (off + TAR_BLOCK <= buf.length) {
    const h = buf.subarray(off, off + TAR_BLOCK);
    if (h.every((x) => x === 0)) { ended = true; break; }
    const want = tarNumber(h.subarray(148, 156));
    let sum = 0;
    for (let i = 0; i < TAR_BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i];
    if (sum !== want) throw new Error('a tar header checksum does not match');
    const size = tarNumber(h.subarray(124, 136));
    const type = h[156] === 0 ? '0' : String.fromCharCode(h[156]);
    const bodyAt = off + TAR_BLOCK;
    if (bodyAt + size > buf.length) throw new Error('the tar stream is truncated');
    const body = buf.subarray(bodyAt, bodyAt + size);
    off = bodyAt + Math.ceil(size / TAR_BLOCK) * TAR_BLOCK;
    if (type === 'g') continue;
    if (type === 'x') { pax = paxRecords(body); continue; }
    let name = tarText(h.subarray(0, 100));
    const prefix = h.subarray(257, 262).toString('ascii') === 'ustar' ? tarText(h.subarray(345, 500), 'a tar entry name prefix') : '';
    if (prefix !== '') name = `${prefix}/${name}`;
    if (pax !== null && typeof pax.path === 'string') name = pax.path;
    pax = null;
    if (type === '5') entries.push({ path: name.replace(/\/+$/, ''), type: 'dir', data: null });
    else if (type === '0') entries.push({ path: name, type: 'file', data: Buffer.from(body) });
    else throw new Error(`a tar entry of type ${JSON.stringify(type)} is not accepted (${name.slice(0, 120)})`);
  }
  if (!ended) throw new Error('the tar stream has no end marker');
  return entries;
}

/** Why an archive entry path may not be written under the view, or null: it must be docs, docs/plans or below docs/plans, relative, made of plain segments. */
export function planPathProblem(p) {
  if (typeof p !== 'string' || p === '') return 'an empty entry path';
  const shown = JSON.stringify(p.slice(0, 120));
  if (/[\0\\:*?"<>|]/.test(p)) return `an entry path with a character a Windows path reads specially (${shown})`;
  if (p.startsWith('/')) return `an absolute entry path (${shown})`;
  const segs = p.split('/');
  if (segs.some((s) => s === '' || s === '.' || s === '..')) return `an entry path with an empty, "." or ".." segment (${shown})`;
  if (segs.some((s) => /[. ]$/.test(s) || /^(?:con|prn|aux|nul|com\d|lpt\d)(?:\.|$)/i.test(s))) return `an entry path Windows would read as another name (${shown})`;
  if (p !== 'docs' && p !== PLANS_ROOT && !p.startsWith(`${PLANS_ROOT}/`)) return `an entry path outside docs/plans (${shown})`;
  return null;
}

/** Validates every entry, then writes them under out (never over an existing file); returns the number of files written. Nothing is written when any entry is refused. */
export function writePlans(entries, out) {
  const files = entries.filter((e) => e.type === 'file');
  if (files.length === 0) throw new Error('the base commit holds no file under docs/plans');
  const seen = new Set();
  for (const e of entries) {
    const bad = planPathProblem(e.path);
    if (bad !== null) throw new Error(bad);
    const key = e.path.toLowerCase();
    if (seen.has(key)) throw new Error(`the archive names ${e.path} twice (or twice up to letter case)`);
    seen.add(key);
    if (!within(out, path.join(out, ...e.path.split('/')))) throw new Error(`an entry path leaves the view directory (${e.path})`);
  }
  for (const e of entries) {
    const target = path.join(out, ...e.path.split('/'));
    if (e.type === 'dir') { fs.mkdirSync(target, { recursive: true }); continue; }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, e.data, { flag: 'wx' });
  }
  return files.length;
}

/**
 * The environment without any GIT_* variable (the name is matched without regard to letter case, as Windows does): the caller's, minus every variable that
 * could point git at another repository, index, work tree, object store or configuration (a runner started from a git hook inherits GIT_DIR, GIT_WORK_TREE and
 * GIT_INDEX_FILE, and git add -A would then stage into that repository), plus GIT_CONFIG_COUNT, GIT_CONFIG_PARAMETERS and the config-file locations, which
 * inject or relocate configuration. Nothing the gates need is lost: each builds its own isolated GIT_CONFIG_* environment. Non-string values are dropped.
 */
export function envWithoutGit(base = process.env) {
  const env = {};
  for (const [k, v] of Object.entries(base)) if (typeof v === 'string' && !/^GIT_/i.test(k)) env[k] = v;
  return env;
}
/** Sets env[name], first removing every key that is the same name up to letter case (Windows environment names are case-insensitive: two spellings leave the choice to the platform). */
const setEnv = (env, name, value) => { for (const k of Object.keys(env)) if (k.toUpperCase() === name.toUpperCase()) delete env[k]; env[name] = value; };
const GIT_TMP_PREFIX = 'run310-git-';
/** The text of the runner-owned git configuration: exactly what the bootstrap needs and nothing of the user's (identity, no line-ending conversion, an empty hooks directory, local file transport). */
export function runnerGitConfig(hooksDir) {
  const quoted = (v) => `"${String(v).replace(/\\/g, '/').replace(/"/g, '\\"')}"`;
  return ['[user]', '\tname = run-310-view', '\temail = run-310-view@example.invalid', '[core]', '\tautocrlf = false', `\thooksPath = ${quoted(hooksDir)}`, '[protocol "file"]', '\tallow = always', ''].join('\n');
}
/**
 * The git isolation of ONE bootstrap, created in a fresh mkdtemp directory under scratchRoot (the operating system's temp directory): the runner-owned
 * configuration file, an empty hooks directory and an empty home directory, and the environment every git call of the bootstrap receives. env is the caller's
 * without any GIT_* variable (envWithoutGit) plus GIT_CONFIG_NOSYSTEM=1 and GIT_ATTR_NOSYSTEM=1 (no system configuration or attributes file),
 * GIT_CONFIG_GLOBAL naming the runner's file (so the home and XDG configuration files are not read either), GIT_TERMINAL_PROMPT=0, and HOME, USERPROFILE and
 * XDG_CONFIG_HOME naming the empty directory. Dropping GIT_CONFIG_GLOBAL alone would NOT isolate anything: git then reads ~/.gitconfig and the system file.
 * cleanup() removes the directory (only a directory it created, by its prefix) and returns whether it is gone.
 */
export function createGitIsolation({ scratchRoot = os.tmpdir(), base = process.env } = {}) {
  const dir = fs.mkdtempSync(path.join(scratchRoot, GIT_TMP_PREFIX));
  const cleanup = () => { try { if (path.basename(dir).startsWith(GIT_TMP_PREFIX)) fs.rmSync(dir, { recursive: true, force: true }); return !fs.existsSync(dir); } catch { return false; } };
  try {
    const home = path.join(dir, 'home'); const hooks = path.join(dir, 'hooks'); const config = path.join(dir, 'gitconfig');
    fs.mkdirSync(home); fs.mkdirSync(hooks); fs.writeFileSync(config, runnerGitConfig(hooks), { flag: 'wx' });
    const env = envWithoutGit(base);
    for (const [k, v] of Object.entries({ GIT_CONFIG_NOSYSTEM: '1', GIT_ATTR_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: config, GIT_TERMINAL_PROMPT: '0', HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: home })) setEnv(env, k, v);
    return { dir, config, home, hooks, env, cleanup };
  } catch (e) { cleanup(); throw e; }
}
/** Runs fn with every GIT_* variable removed from process.env and puts them back afterwards (the helper's buildView runs git with the inherited environment and takes no env option). */
function withoutGitVars(fn) {
  const saved = {};
  for (const k of Object.keys(process.env)) if (/^GIT_/i.test(k)) { saved[k] = process.env[k]; delete process.env[k]; }
  try { return fn(); } finally { for (const [k, v] of Object.entries(saved)) process.env[k] = v; }
}
/**
 * Config pinned on every bootstrap git call, so that nothing in the user's global or system configuration changes the bytes or runs code: no line-ending
 * conversion, no hooks, no signing, no global ignore or attributes file, no background maintenance, and no file-system monitor (core.fsmonitor can name an
 * arbitrary command that git runs on every index operation, git add -A included; core.hooksPath does not stop it) and no untracked cache.
 */
export const gitPins = (gitDir) => {
  const dead = (name) => `${gitDir.replace(/\\/g, '/')}/${name}`;
  return ['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false', '-c', `core.hooksPath=${dead('bootstrap-no-hooks')}`, '-c', `core.excludesFile=${dead('bootstrap-no-excludes')}`, '-c', `core.attributesFile=${dead('bootstrap-no-attributes')}`,
    '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false',
    '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', '-c', 'init.defaultBranch=main', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false'];
};
const gitCaller = (git, env) => (cwd, args, buffer = false) => git('git', args, { cwd, env, encoding: buffer ? 'buffer' : 'utf8', shell: false, windowsHide: true, timeout: 600000, maxBuffer: 1 << 28 });
const firstLine = (s) => String(s ?? '').trim().split(/\r?\n/)[0].slice(0, 300);
const gitProblem = (what, r) => (r.error || r.status !== 0 ? `${what} failed (${r.error ? (r.error.code ?? r.error.message) : `exit ${r.status}`})${firstLine(r.stderr) ? `: ${firstLine(r.stderr)}` : ''}` : null);

/** The tags the strict gate verifies in the repository it runs in (tests/helpers/v2-baseline.mjs: V2_IDENTITY.tag; it checks the tag's commit and tree). */
export const REQUIRED_TAGS = Object.freeze(['project-setup-v2.0.0']);
const TAG_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Parses the output of `git ls-tree -r -z --full-tree` ("<mode> SP <type> SP <oid> TAB <path>", every record NUL-terminated) into [{ mode, type, oid, path }]; throws on a malformed record. */
export function parseLsTree(buf) {
  const text = Buffer.isBuffer(buf) ? strictUtf8(buf, 'a path in the git ls-tree output') : String(buf);
  if (text === '') return [];
  if (!text.endsWith('\0')) throw new Error('the git ls-tree output is not NUL-terminated');
  return text.slice(0, -1).split('\0').map((rec) => {
    const m = /^(\d{6}) (blob|tree|commit) ([0-9a-f]{40}|[0-9a-f]{64})\t([\s\S]+)$/.exec(rec);
    if (m === null) throw new Error('a git ls-tree record is malformed');
    return { mode: m[1], type: m[2], oid: m[3], path: m[4] };
  });
}
/** The git object id of a blob (git hash-object --no-filters semantics: the bytes as they are): SHA-1 for a 40-hex id, SHA-256 for a 64-hex id. */
export const gitBlobId = (data, idLength = 40) => createHash(idLength === 64 ? 'sha256' : 'sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
/**
 * Compares the files of docs/plans in a commit (records: parseLsTree output) with the files in hand (files: Map of repository-relative path -> Buffer).
 * Returns the differences, [] when it is the same set of paths and every file has the same git blob id: a file the archive left out (export-ignore),
 * a file it added, and a file whose bytes it changed (export-subst, a line-ending or other conversion) each make the result non-empty.
 */
export function plansDifferences(records, files) {
  const p = [];
  if (records.length === 0) p.push('the commit lists no file under docs/plans');
  for (const r of records) if (r.type !== 'blob' || (r.mode !== '100644' && r.mode !== '100755')) p.push(`${r.path} is not a regular file in the commit (${r.type} ${r.mode})`);
  const want = new Map(records.map((r) => [r.path, r]));
  for (const k of want.keys()) if (!files.has(k)) p.push(`${k} is missing`);
  for (const k of files.keys()) if (!want.has(k)) p.push(`${k} is extra`);
  for (const [k, r] of want) { const d = files.get(k); if (d !== undefined && gitBlobId(d, r.oid.length) !== r.oid) p.push(`${k} has other bytes`); }
  return p;
}
const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ').slice(0, 300);

/**
 * Adds to a built, verified view what only the strict gate (tests/accept-rc1.mjs) reads besides the skill files, and nothing outside outDir:
 *  1. docs/plans/ exactly as baseCommit holds it (git archive of that commit, unpacked here; never the working tree, which also holds the 3.2.0 plan). The
 *     archive is not trusted: before anything is written, every file it holds is compared (path and git blob id) with git ls-tree of the commit, so an
 *     archive attribute (export-ignore, export-subst) that drops, adds or rewrites a file fails the bootstrap and nothing is written. Every read of the
 *     commit is made with --no-replace-objects (a refs/replace entry for the base would otherwise make archive and ls-tree agree on ANOTHER commit's plans)
 *     and every file name is decoded as strict UTF-8 (a lossy decode would let two different names agree),
 *  2. a git repository (git init) holding every tag of repoRoot (git fetch from it; at least one project-setup-v* tag is required and every name in
 *     requiredTags must resolve to a commit) and ONE commit of the whole view (git add -A), made with a fixed identity, --no-gpg-sign, --no-verify and
 *     every hook, line-ending, ignore, attribute and file-system-monitor setting pinned off.
 * Paths: outDir and repoRoot are refused as spelled when a Windows component ends with a dot or a space (and for the other spellings of windowsSpellingProblem;
 * platform is injectable), then ONE canonical path of each (realOfNearest) is used for every file-system call, every cwd and every --git-dir / --work-tree.
 * Configuration: no git call reads the user's configuration (createGitIsolation: a runner-owned configuration file, an empty home, no system file; the user's
 * safe.directory list is therefore not consulted either: a source repository owned by another account fails closed with git's own message); the calls that
 * read repoRoot name its git directory (--git-dir), and every call that touches the view names its git directory and work tree, so a configured core.worktree
 * or a stray repository above the view cannot take the place of either. The isolation directory lives under scratchRoot (default: the OS temp directory) and is
 * removed before this returns (result.isolationCleaned says whether it is gone).
 * baseCommit must be a full 40-hex id of a COMMIT (a tree or tag object id is refused). repoRoot is only read. git is the spawnSync-compatible function every
 * git call goes through (a spec records the calls). Never throws: { ok: true, plans, tags, commit, isolationCleaned } or { ok: false, error, isolationCleaned }
 * (one line). A failure before the git init leaves no .git.
 */
export function bootstrapStrictGate(outDir, repoRoot, opts = {}) {
  const holder = { iso: null };
  let result; let cleaned = null;
  try { result = bootstrapInner(outDir, repoRoot, opts, holder); } catch (e) { result = { ok: false, error: firstLine(e && e.message ? e.message : e) || 'the bootstrap threw' }; } finally { if (holder.iso !== null) cleaned = holder.iso.cleanup(); }
  return cleaned === null ? result : { ...result, isolationCleaned: cleaned };
}
function bootstrapInner(outDir, repoRoot, { baseCommit = BASE_COMMIT320, requiredTags = REQUIRED_TAGS, git = spawnSync, scratchRoot = os.tmpdir(), platform = process.platform }, holder) {
  if (typeof outDir !== 'string' || outDir === '' || typeof repoRoot !== 'string' || repoRoot === '') return { ok: false, error: 'the bootstrap needs the view directory and the repository root' };
  if (!/^[0-9a-f]{40}$/.test(String(baseCommit))) return { ok: false, error: 'the base commit is not a full 40-hex commit id' };
  if (!Array.isArray(requiredTags) || requiredTags.some((t) => typeof t !== 'string' || !TAG_NAME.test(t))) return { ok: false, error: 'a required tag name is not a plain tag name' };
  for (const [what, p] of [['the view directory', outDir], ['the repository root', repoRoot]]) { const s = windowsSpellingProblem(p, platform); if (s !== null) return { ok: false, error: oneLine(`${what} is refused before anything is written: ${s}`) }; }
  const out = realOfNearest(outDir); // the ONE spelling of each directory used from here on: the file system, every cwd and every --git-dir / --work-tree
  const src = realOfNearest(repoRoot);
  if (!fs.statSync(out).isDirectory()) return { ok: false, error: 'the view directory is not a directory' };
  if (within(src, out)) return { ok: false, error: 'the view directory is inside the repository' };
  if (fold(fs.realpathSync.native(out)) !== fold(out)) return { ok: false, error: 'the view directory is not its own canonical path (a link or an alias)' };
  if (fs.existsSync(path.join(out, '.git')) || fs.existsSync(path.join(out, 'docs'))) return { ok: false, error: 'the view already holds .git or docs/ (the bootstrap only runs on a fresh view)' };
  holder.iso = createGitIsolation({ scratchRoot });
  const gitCall = gitCaller(git, holder.iso.env);
  const gitDir = path.join(out, '.git');
  const pins = gitPins(gitDir);
  const fromSrc = ['--no-replace-objects', `--git-dir=${path.join(src, '.git')}`]; // reads of repoRoot: its own git directory, never the original or a replacement object
  const inView = ['--no-replace-objects', `--git-dir=${gitDir}`, `--work-tree=${out}`]; // every call that touches the view: its git directory and its work tree
  // An object that exists but is not a commit (a tree that holds docs/plans archives fine) is refused; a missing object falls through to the archive, which names the failure.
  const kind = gitCall(src, [...pins, ...fromSrc, 'cat-file', '-t', baseCommit]);
  if (!kind.error && kind.status === 0 && String(kind.stdout).trim() !== 'commit') return { ok: false, error: oneLine(`the base ${baseCommit.slice(0, 12)} is a ${String(kind.stdout).trim()} object, not a commit`) };
  const archive = gitCall(src, [...pins, ...fromSrc, 'archive', '--format=tar', baseCommit, PLANS_ROOT], true);
  const aProblem = gitProblem(`git archive of docs/plans at ${baseCommit.slice(0, 12)}`, archive);
  if (aProblem !== null) return { ok: false, error: aProblem };
  const tree = gitCall(src, [...pins, ...fromSrc, 'ls-tree', '-r', '-z', '--full-tree', baseCommit, PLANS_ROOT], true);
  const lProblem = gitProblem(`git ls-tree of docs/plans at ${baseCommit.slice(0, 12)}`, tree);
  if (lProblem !== null) return { ok: false, error: lProblem };
  const records = parseLsTree(tree.stdout); // both parsers decode names as strict UTF-8 and throw before anything is written
  const entries = parseTar(archive.stdout);
  const archived = entries.filter((e) => e.type === 'file');
  const inHand = new Map(archived.map((e) => [e.path, e.data])); // a path the archive names twice is refused by writePlans below, before anything is written
  const early = plansDifferences(records, inHand);
  if (early.length > 0) return { ok: false, error: oneLine(`docs/plans from the archive is not the base commit's (${early.length} difference(s)): ${early.slice(0, 3).join('; ')}`) };
  const plans = writePlans(entries, out); // writes exactly the buffers verified above, each created exclusively
  const steps = [['git init', [...pins, '--no-replace-objects', 'init', '-q', '--template=', out]], ['git fetch of the tags', [...pins, ...inView, 'fetch', '-q', src, 'refs/tags/*:refs/tags/*']]]; // init names its target directory
  for (const [what, args] of steps) {
    const r = gitCall(out, args);
    const p = gitProblem(what, r);
    if (p !== null) return { ok: false, error: p };
    if (what === 'git init' && !fs.statSync(gitDir).isDirectory()) return { ok: false, error: 'git init did not create .git in the view directory' };
  }
  const tagList = gitCall(out, [...pins, ...inView, 'tag', '-l', 'project-setup-v*']);
  const tProblem = gitProblem('git tag -l', tagList);
  if (tProblem !== null) return { ok: false, error: tProblem };
  const tags = String(tagList.stdout).split('\n').map((l) => l.trim()).filter(Boolean);
  if (tags.length === 0) return { ok: false, error: 'the repository holds no project-setup-v* tag (the strict gate verifies the project-setup-v2.0.0 tag): fetch the tags into it first' };
  for (const name of requiredTags) {
    const ref = gitCall(out, [...pins, ...inView, 'rev-parse', '--verify', '--quiet', `refs/tags/${name}^{commit}`]);
    if (ref.error || ref.status !== 0 || !/^[0-9a-f]{40}$/.test(String(ref.stdout).trim())) return { ok: false, error: oneLine(`the repository lacks the tag ${name} as a commit (the strict gate verifies it; found: ${tags.slice(0, 5).join(', ')}): fetch the tags into it first`) };
  }
  const add = gitCall(out, [...pins, ...inView, 'add', '-A']);
  const addProblem = gitProblem('git add -A', add);
  if (addProblem !== null) return { ok: false, error: addProblem };
  const commit = gitCall(out, [...pins, ...inView, 'commit', '-q', '--no-verify', '--no-gpg-sign', '-m', 'the reconstructed 3.1.0 view']); // the identity is in the runner-owned configuration
  const cProblem = gitProblem('git commit', commit);
  if (cProblem !== null) return { ok: false, error: cProblem };
  const head = gitCall(out, [...pins, ...inView, 'rev-parse', '--verify', 'HEAD^{commit}']);
  const hProblem = gitProblem('git rev-parse HEAD', head);
  if (hProblem !== null) return { ok: false, error: hProblem };
  return { ok: true, plans, tags: tags.length, commit: String(head.stdout).trim() };
}

/** The CLI. Returns { code, lines }. Every line goes through log as it is produced, so a long gate shows progress; a spec passes its own log. */
export function runView(argv, { repoRoot = REPO, spawn = spawnSync, log = () => {}, bootstrap = bootstrapStrictGate, tmp = os.tmpdir(), platform = process.platform } = {}) {
  const lines = [];
  const say = (s) => { lines.push(s); log(s); };
  const stop = (code, ...ls) => { for (const l of ls) say(l); return { code, lines }; };
  const a = parseCliArgs(argv);
  if (!a.ok) return stop(2, `RUN-310-VIEW  USAGE  ${a.error}`, USAGE);
  const resolved = resolveOutDir(a.out, { repoRoot, tmp, platform });
  if (resolved.problems.length > 0) return stop(2, ...resolved.problems.map((p) => `RUN-310-VIEW  REFUSED  ${p}`));
  const out = resolved.path; // the one validated canonical spelling: every later file-system call, child cwd and git call uses it, never a.out as typed
  try {
    const built = withoutGitVars(() => buildView({ repoRoot, outDir: out, includeUntracked: a.includeUntracked, platform })); // git ls-files must read the real repository and index, whatever GIT_* the caller exported
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
  if (a.run.includes('accept-rc1')) { // after the manifest check (docs/plans/ and .git are not part of the 3.1.0 manifest), before any gate; git runs for real, never through the injected spawn
    let b;
    try { b = bootstrap(out, repoRoot); } catch (e) { b = { ok: false, error: String(e && e.message ? e.message : e) }; }
    if (b === null || typeof b !== 'object' || b.ok !== true) return stop(1, `RUN-310-VIEW  BOOTSTRAP FAIL  ${String(b && b.error ? b.error : 'no result').split('\n')[0]}`);
    say(`BOOTSTRAP  OK  docs/plans (${b.plans} files of the base commit) and a git repository with ${b.tags} project-setup-v* tag(s) and one commit of the view`);
  }
  let code = 0;
  for (const gate of a.run) {
    const file = path.join(out, 'project-setup', 'tests', GATES[gate]);
    const r = spawn(process.execPath, [file], { cwd: out, env: envWithoutGit(), encoding: 'utf8', shell: false, windowsHide: true, timeout: gate === 'accept-rc1' ? 2400000 : 1800000, maxBuffer: 1 << 27 });
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
        say(`COMPAT  ${a.label}  ${c.ok ? 'OK' : 'FAIL'}  ${actual.length} failure string(s); unlisted ${c.unlisted.length}; stale ${c.stale.length}; pins that are not a digest assertion of an overlaid file ${c.badPins.length}`);
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
