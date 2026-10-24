// git-safe review-diff: the sanctioned review interface. Installed as .ai/tools/review-diff.mjs beside git-safe-core.mjs,
// security-policy.mjs and the thin git-safe.mjs CLI: one reviewed catalog unit. It has no CLI of its own; git-safe-core's
// main imports it lazily for `review-diff` only, so the six object commands never depend on this file.
//
// Plan: docs/plans/2026-10-19-project-setup-v3-rc1-c5.md sections 2.2, 2.6 and 3, with the freeze addendum C5-P2-1..10.
//
// What this gets right that a plain `git diff <base>` does not:
//   - Committed-head mode (--head) reviews the merge-base to head object patch only. The trusted checkout's staged,
//     unstaged and untracked state never contributes, so reviewing from a dirty checkout cannot mix in local edits.
//   - Local-worktree mode uses plumbing `diff-index -p`, never porcelain `git diff`: porcelain refreshes the index (a
//     write to .git), plumbing keeps Git's normalization and skip-worktree semantics without touching it.
//   - Protected names are excluded before Git reads content: the exclusion list comes from the M tree and the index (or
//     the committed changed-path inventory), never from a worktree diff that would already have read the files.
//   - Untracked files are read in-process, only after every path component was checked with lstat (no link, junction or
//     non-directory ancestor), the realpath stayed inside the root and its realpath-relative name is not protected, and
//     the descriptor identifies the same regular file. A large text file is refused after at most 8000 bytes.
//   - Earlier review artifacts (.ai/.run/review and .ai/.run/.gitignore) are never review input, even force-tracked or
//     reported as untracked because the self-ignore file was removed.
//   - The complete result, header included, is bounded before anything is emitted or published; an artifact is created
//     exclusively, never replaces or follows an existing file, and a failed publication removes only its own file.
//
// Importing the module defines it and nothing else: no process, file read, output or environment change.
import fs from 'node:fs';
import path from 'node:path';
import { MAX_OUTPUT_BYTES, NARROWING_GUIDANCE, createGitSession, parseGitSafeArgs } from './git-safe-core.mjs';
import { matchesPolicyPath, validateRepoPath } from './security-policy.mjs';

export const REVIEW_FORM = 'review-diff --base <ref> [--head <ref>] [--out <file>] [-- <paths>...]';

// ---------------------------------------------------------------- errors ----
// Plan 3.13: an own string code and a message starting with "CODE: ". No path, ref, policy text, native exception or Git
// output is ever interpolated.
const DETAIL = {
  GIT_SAFE_INPUT: 'invalid Git helper input',
  GIT_SAFE_COMMAND: 'supported commands: diff, log, show, cat, ls, grep, review-diff',
  GIT_SAFE_ARGUMENT: `unsupported arguments; supported: ${REVIEW_FORM}`,
  GIT_SAFE_SECRET: 'requested path is protected by the security policy',
  GIT_SAFE_RECORD: 'invalid Git metadata; no result was emitted',
  GIT_SAFE_INTERNAL: 'internal failure; no result was emitted',
  GIT_SAFE_LIMIT: `output exceeds ${MAX_OUTPUT_BYTES} bytes. ${NARROWING_GUIDANCE.show} No partial result was emitted; this review is not complete.`,
  REVIEW_OUT: 'output must be a Windows-safe .diff file directly under .ai/.run/review/',
  REVIEW_PATH: 'unsafe review filesystem path; no result was emitted',
  REVIEW_TYPE: 'review input is not a regular file; no result was emitted',
  REVIEW_IO: 'review filesystem operation failed; no result was emitted',
  REVIEW_UNMERGED: 'selected paths contain unresolved index entries; no result was emitted',
  REVIEW_ARTIFACT_INPUT: 'review artifacts cannot be selected as review input',
  REVIEW_EXISTS: 'review artifact already exists; choose another output name',
  REVIEW_CLEANUP: 'artifact cleanup failed; discard the incomplete artifact',
  REVIEW_IGNORE: '.ai/.run/.gitignore must contain exactly "*\\n"; no artifact was written',
};
const OWN_ERRORS = new WeakSet();
function rvError(code) {
  const e = new Error(`${code}: ${DETAIL[code]}`);
  e.code = code;
  OWN_ERRORS.add(e);
  return e;
}
const fail = (code) => { throw rvError(code); };
// Errors the core and C1 raise with their own exact text (session, policy, executor). GIT_SAFE_LIMIT from the core has no
// guidance (it does not know the command), so it is replaced by the review line.
const PASS_THROUGH = /^(?:GIT_SAFE_[A-Z_]+|POLICY_[A-Z_]+)$/;
function diagnostic(e) {
  if (e instanceof Error && OWN_ERRORS.has(e)) return e.message;
  if (e instanceof Error && typeof e.code === 'string' && PASS_THROUGH.test(e.code) && typeof e.message === 'string' && e.message.startsWith(`${e.code}: `)) {
    return e.code === 'GIT_SAFE_LIMIT' ? `GIT_SAFE_LIMIT: ${DETAIL.GIT_SAFE_LIMIT}` : e.message;
  }
  return `GIT_SAFE_INTERNAL: ${DETAIL.GIT_SAFE_INTERNAL}`;
}

// --------------------------------------------------------------- helpers ----
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
function denseStrings(a) {
  if (!Array.isArray(a)) return false;
  for (let i = 0; i < a.length; i++) if (!own(a, i) || typeof a[i] !== 'string') return false;
  return true;
}
const validPath = (p) => { try { validateRepoPath(p); return true; } catch { return false; } };
const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const utf8 = (buf) => { try { return UTF8.decode(buf); } catch { return null; } };
const byUtf8 = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
const OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const OID_LINE = /^([0-9a-f]{40}|[0-9a-f]{64})\r?\n$/;
const IS_WINDOWS = process.platform === 'win32';

// ---------------------------------------------------------------- grammar ----
// Plan 3.10: exact prefix, one Windows-safe filename of 6-128 ASCII characters, no device name before the first dot.
const OUT_PREFIX = '.ai/.run/review/';
const OUT_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*\.diff$/;
const DEVICE = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/;
function validOut(v) {
  if (!v.startsWith(OUT_PREFIX)) return false;
  const name = v.slice(OUT_PREFIX.length);
  if (name.length < 6 || name.length > 128 || !OUT_NAME.test(name)) return false;
  const stem = name.slice(0, -'.diff'.length);
  return !stem.includes('..') && !stem.endsWith('.') && !DEVICE.test(stem.split('.')[0].toUpperCase());
}
// C4's single-revision grammar, reused through its own parser: ranges, object forms and leading dashes fail there.
function validRef(v) {
  try { parseGitSafeArgs(['ls', v]); return true; } catch { return false; }
}
const OPTIONS = ['--base', '--head', '--out'];

/**
 * Plan 2.6 and 3.1: { base, head, out, paths }. Options once each, detached values, any order before `--`; a value is
 * the next token unless it is absent or exactly `--`. Tokens are processed left to right and the first failure wins; a
 * missing base is checked last. Paths after `--` are literal, C1-valid and deduplicated in first-occurrence order.
 */
export function parseReviewArgs(argv) {
  if (!denseStrings(argv)) fail('GIT_SAFE_INPUT');
  if (argv[0] !== 'review-diff') fail('GIT_SAFE_COMMAND');
  const result = { base: null, head: null, out: null, paths: [] };
  const seen = new Set();
  let i = 1;
  for (; i < argv.length && argv[i] !== '--'; i++) {
    const option = argv[i];
    if (!OPTIONS.includes(option) || seen.has(option)) fail('GIT_SAFE_ARGUMENT');
    seen.add(option);
    if (i + 1 >= argv.length || argv[i + 1] === '--') fail('GIT_SAFE_ARGUMENT');
    const value = argv[++i];
    if (option === '--out') {
      if (!validOut(value)) fail('REVIEW_OUT');
      result.out = value;
    } else {
      if (!validRef(value)) fail('GIT_SAFE_ARGUMENT');
      result[option.slice(2)] = value;
    }
  }
  if (i < argv.length) {
    const rest = argv.slice(i + 1);
    if (rest.length === 0) fail('GIT_SAFE_ARGUMENT');
    const paths = new Set();
    for (const p of rest) { if (!validPath(p)) fail('GIT_SAFE_ARGUMENT'); paths.add(p); }
    result.paths = [...paths];
  }
  if (result.base === null) fail('GIT_SAFE_ARGUMENT');
  return result;
}

/** Plan 2.6: the Windows-safe UTC timestamp name. Only a valid Date with UTC year 0-9999; nothing is created or retried. */
export function defaultReviewArtifactPath(date = new Date()) {
  let time;
  try { time = Date.prototype.getTime.call(date); } catch { fail('GIT_SAFE_INPUT'); }
  if (!Number.isFinite(time)) fail('GIT_SAFE_INPUT');
  const year = new Date(time).getUTCFullYear();
  if (year < 0 || year > 9999) fail('GIT_SAFE_INPUT');
  return `${OUT_PREFIX}${new Date(time).toISOString().replace(/[-:.]/g, '')}.diff`;
}

// ------------------------------------------------------------ dependencies ----
const DEP_KEYS = ['cwd', 'env', 'execute', 'readFile', 'fs'];
const FS_METHODS = ['lstatSync', 'realpathSync', 'mkdirSync', 'openSync', 'fstatSync', 'readFileSync', 'writeSync', 'fsyncSync', 'closeSync', 'unlinkSync'];
const FS_KEYS = [...FS_METHODS].sort().join('\u0000');
function defaultFs() {
  return {
    lstatSync: fs.lstatSync, realpathSync: fs.realpathSync.native, mkdirSync: fs.mkdirSync, openSync: fs.openSync, fstatSync: fs.fstatSync,
    readFileSync: fs.readFileSync, writeSync: fs.writeSync, fsyncSync: fs.fsyncSync, closeSync: fs.closeSync, unlinkSync: fs.unlinkSync,
  };
}
// Plan 2.6: every key and method is checked before any dependency is called; the core checks cwd, env, execute, readFile.
// The bounded first read of C5-P2-9 needs readSync, which is not one of the ten pinned methods: the default uses Node's;
// a supplied seam may expose one (it is looked up, never required), and without it the whole body is read through
// readFileSync on the checked descriptor and the size checks still apply.
function readDependencies(dependencies) {
  if (!isPlain(dependencies) || !Object.keys(dependencies).every((k) => DEP_KEYS.includes(k))) fail('GIT_SAFE_INPUT');
  const session = {};
  for (const k of ['cwd', 'env', 'execute', 'readFile']) if (own(dependencies, k)) session[k] = dependencies[k];
  if (!own(dependencies, 'fs')) return { session, fsx: defaultFs(), readSync: fs.readSync };
  const f = dependencies.fs;
  if (!isPlain(f) || Object.keys(f).sort().join('\u0000') !== FS_KEYS || !FS_METHODS.every((m) => typeof f[m] === 'function')) fail('GIT_SAFE_INPUT');
  const fsx = {};
  for (const m of FS_METHODS) fsx[m] = f[m];
  const readSync = typeof f.readSync === 'function' ? f.readSync : null;
  return { session, fsx, readSync };
}

// ---------------------------------------------------------------- records ----
// Names-only framing (C4 3.5): strict UTF-8, NUL-terminated, empty records ignored, nothing trimmed, every name C1-valid.
function nulRecords(buf) {
  if (!Buffer.isBuffer(buf)) fail('GIT_SAFE_RECORD');
  if (buf.length === 0) return [];
  const text = utf8(buf);
  if (text === null || !text.endsWith('\u0000')) fail('GIT_SAFE_RECORD');
  return text.slice(0, -1).split('\u0000').filter((r) => r !== '');
}
function parseNames(buf) {
  const names = nulRecords(buf);
  if (!names.every(validPath)) fail('GIT_SAFE_RECORD');
  return names;
}
// Plan 3.7: Git reports an embedded untracked repository as `dir/`; exactly one terminal slash marks it.
function parseUntracked(buf) {
  return nulRecords(buf).map((r) => {
    const marker = r.endsWith('/');
    const name = marker ? r.slice(0, -1) : r;
    if (!validPath(name)) fail('GIT_SAFE_RECORD');
    return { name, marker };
  });
}
// Plan 3.6: <mode> SP <oid> SP <stage> TAB <path> NUL; C4's four file modes, lowercase IDs, stages 0-3, no duplicates.
const INDEX_HEADER = /^(100644|100755|120000|160000) ([0-9a-f]{40}|[0-9a-f]{64}) ([0-3])$/;
function parseIndex(buf) {
  const seen = new Set();
  return nulRecords(buf).map((rec) => {
    const tab = rec.indexOf('\t');
    const m = tab < 0 ? null : INDEX_HEADER.exec(rec.slice(0, tab));
    const p = rec.slice(tab + 1);
    if (!m || !validPath(p)) fail('GIT_SAFE_RECORD');
    const key = `${m[3]}\u0000${p}`;
    if (seen.has(key)) fail('GIT_SAFE_RECORD');
    seen.add(key);
    return { path: p, stage: Number(m[3]) };
  });
}

// ------------------------------------------------------------ renderer ----
// Plan 3.8: Git's quoting with core.quotePath=true, applied to the complete a/<path> and b/<path> labels.
const ESCAPES = { 0x07: '\\a', 0x08: '\\b', 0x09: '\\t', 0x0a: '\\n', 0x0b: '\\v', 0x0c: '\\f', 0x0d: '\\r', 0x22: '\\"', 0x5c: '\\\\' };
function quoteLabel(label) {
  let out = '';
  let quoted = false;
  for (const b of Buffer.from(label, 'utf8')) {
    if (own(ESCAPES, b)) { out += ESCAPES[b]; quoted = true; } else if (b < 0x20 || b > 0x7e) { out += `\\${b.toString(8).padStart(3, '0')}`; quoted = true; } else out += String.fromCharCode(b);
  }
  return quoted ? `"${out}"` : out;
}
const BINARY_PROBE = 8000;
const hasNul = (buf) => buf.subarray(0, BINARY_PROBE).includes(0);
/** One untracked new-file patch: raw bytes, no index line, a binary line for a NUL in the first 8000 bytes. */
function renderNewFile(name, data, binary, executable) {
  const a = quoteLabel(`a/${name}`);
  const b = quoteLabel(`b/${name}`);
  const parts = [Buffer.from(`diff --git ${a} ${b}\nnew file mode ${executable ? '100755' : '100644'}\n`)];
  if (binary) { parts.push(Buffer.from(`Binary files /dev/null and ${b} differ\n`)); return Buffer.concat(parts); }
  if (data.length === 0) return Buffer.concat(parts);
  const lines = [];
  let start = 0;
  for (let nl = data.indexOf(0x0a, start); nl >= 0; nl = data.indexOf(0x0a, start)) { lines.push(data.subarray(start, nl)); start = nl + 1; }
  const terminated = start === data.length;
  if (!terminated) lines.push(data.subarray(start));
  // C5-P2-4: TAB before the LF of the +++ line if and only if the emitted label contains a space.
  parts.push(Buffer.from(`--- /dev/null\n+++ ${b}${b.includes(' ') ? '\t' : ''}\n@@ -0,0 +1${lines.length === 1 ? '' : `,${lines.length}`} @@\n`));
  for (const line of lines) parts.push(Buffer.from('+'), line, Buffer.from('\n'));
  if (!terminated) parts.push(Buffer.from('\\ No newline at end of file\n'));
  return Buffer.concat(parts);
}

// ---------------------------------------------------------- filesystem ----
// Every filesystem call goes through `io`: a native failure (or a malformed return value, checked by the caller) is a
// REVIEW_* error; native text never escapes.
function io(fn, map = {}) {
  try { return fn(); } catch (e) {
    if (e instanceof Error && OWN_ERRORS.has(e)) throw e;
    const code = e && typeof e.code === 'string' && own(map, e.code) ? map[e.code] : 'REVIEW_IO';
    throw rvError(code);
  }
}
function statOf(value) {
  const ok = value !== null && typeof value === 'object' && ['isFile', 'isDirectory', 'isSymbolicLink'].every((m) => typeof value[m] === 'function');
  if (!ok) fail('REVIEW_IO');
  return {
    file: io(() => value.isFile() === true), dir: io(() => value.isDirectory() === true), link: io(() => value.isSymbolicLink() === true),
    dev: value.dev, ino: value.ino, mode: value.mode, size: value.size,
  };
}
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;
// I5-2: an identity compared by the plan 3.7 same-file check is a non-negative integer-valued number (not only a safe
// integer: Windows file IDs can exceed 2^53) or a non-negative bigint; anything else is a malformed return value.
const validId = (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 0) || (typeof v === 'bigint' && v >= 0n);
function identified(st) {
  if (!validId(st.dev) || !validId(st.ino)) fail('REVIEW_IO');
  return st;
}
function absolutePath(value) {
  if (typeof value !== 'string' || value === '' || !path.isAbsolute(value)) fail('REVIEW_IO');
  return path.resolve(value);
}
// Containment: a relative result exactly `..`, starting with `..` and a separator, or absolute is outside; `..work` is in.
function insideName(rootReal, real) {
  const rel = path.relative(rootReal, real);
  if (rel === '' || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}
const READ_FLAGS = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
const IGNORE_BYTES = Buffer.from('*\n', 'utf8');
const ARTIFACT_POLICY = Object.freeze({
  schema: 2,
  patterns: Object.freeze([
    Object.freeze({ anchor: 'root', glob: '.ai/.run/review' }),
    Object.freeze({ anchor: 'root', glob: '.ai/.run/review/**' }),
    Object.freeze({ anchor: 'root', glob: '.ai/.run/.gitignore' }),
  ]),
  projectPatterns: Object.freeze([]),
});
const FIXED_EXCLUSIONS = ['.ai/.run/review', '.ai/.run/.gitignore'];
const IGNORE_REL = '.ai/.run/.gitignore';

/** The filesystem side of one run: the checked untracked reads and the confined, exclusive publication. */
function makeDisk(fsx, readSync, root, isProtected) {
  let rootReal = null;
  const realRoot = () => {
    if (rootReal === null) rootReal = absolutePath(io(() => fsx.realpathSync(root)));
    return rootReal;
  };
  const lstat = (p) => statOf(io(() => fsx.lstatSync(p)));
  const lstatOrNull = (p) => {
    try { return statOf(fsx.lstatSync(p)); } catch (e) {
      if (e instanceof Error && OWN_ERRORS.has(e)) throw e;
      if (e && e.code === 'ENOENT') return null;
      throw rvError('REVIEW_IO');
    }
  };
  // The realpath of an existing entry, which must stay inside the canonical root; returns its POSIX relative name.
  const resolvedName = (p) => {
    const name = insideName(realRoot(), absolutePath(io(() => fsx.realpathSync(p))));
    if (name === null || !validPath(name)) fail('REVIEW_PATH');
    return name;
  };
  const protectedName = (name) => { if (isProtected(name)) fail('GIT_SAFE_SECRET'); };
  const close = (fd) => io(() => fsx.closeSync(fd));
  const closeQuietly = (fd) => { try { fsx.closeSync(fd); } catch { /* the original failure is reported */ } };
  const openFd = (fn, map) => {
    const fd = io(fn, map);
    if (!Number.isInteger(fd) || fd < 0) fail('REVIEW_IO');
    return fd;
  };
  const fstat = (fd) => {
    const st = statOf(io(() => fsx.fstatSync(fd)));
    if (!Number.isSafeInteger(st.size) || st.size < 0) fail('REVIEW_IO');
    return st;
  };

  /** Plan 3.7 and C5-P2-9: check, then read one untracked file through its descriptor. Returns { data, binary, executable }. */
  function readUntracked(name) {
    if (IS_WINDOWS && name.split('/').some((c) => c.includes(':'))) fail('REVIEW_PATH');
    const base = realRoot();
    const parts = name.split('/');
    let current = base;
    for (let i = 0; i < parts.length - 1; i++) {
      current = path.join(current, parts[i]);
      const st = lstat(current);
      if (st.link || !st.dir) fail('REVIEW_PATH');
    }
    const leaf = path.join(current, parts[parts.length - 1]);
    const before = lstat(leaf);
    if (before.link) fail('REVIEW_PATH');
    if (!before.file) fail('REVIEW_TYPE');
    protectedName(resolvedName(leaf));
    const fd = openFd(() => fsx.openSync(leaf, READ_FLAGS), { ELOOP: 'REVIEW_PATH' });
    let result;
    try {
      const st = fstat(fd);
      if (!st.file) fail('REVIEW_TYPE');
      if (!sameFile(identified(st), identified(before))) fail('REVIEW_PATH');
      result = readBody(fd, st.size);
      result.executable = !IS_WINDOWS && Number.isInteger(st.mode) && (st.mode & 0o111) !== 0;
    } catch (e) { closeQuietly(fd); throw e; }
    close(fd);
    return result;
  }
  function readBody(fd, size) {
    let first = null;
    if (readSync !== null) {
      const want = Math.min(size, BINARY_PROBE);
      const chunk = Buffer.alloc(want);
      let got = 0;
      while (got < want) {
        const n = io(() => readSync(fd, chunk, got, want - got, got));
        if (!Number.isInteger(n) || n < 0 || n > want - got) fail('REVIEW_IO');
        if (n === 0) break;
        got += n;
      }
      first = chunk.subarray(0, got);
      if (hasNul(first)) return { data: first, binary: true };
      if (size > MAX_OUTPUT_BYTES) fail('GIT_SAFE_LIMIT');
    } else if (size > MAX_OUTPUT_BYTES) {
      fail('GIT_SAFE_LIMIT');
    }
    const data = io(() => fsx.readFileSync(fd));
    if (!Buffer.isBuffer(data)) fail('REVIEW_IO');
    if (first !== null && !data.subarray(0, first.length).equals(first)) fail('REVIEW_IO'); // changed between the reads
    if (data.length > MAX_OUTPUT_BYTES) fail('GIT_SAFE_LIMIT');
    return { data, binary: hasNul(data) };
  }

  // ---- publication (plan 3.10 and 3.11) ----
  // One directory component below the canonical root: a real directory inside the repository, created non-recursively
  // when missing and allowed; a racing creator's result is revalidated like an existing one.
  function directory(parent, component, create) {
    const p = path.join(parent, component);
    let st = lstatOrNull(p);
    if (st === null) {
      if (!create) fail('REVIEW_PATH');
      try { fsx.mkdirSync(p); } catch (e) { if (!(e && e.code === 'EEXIST')) throw rvError('REVIEW_IO'); }
      st = lstat(p);
    }
    if (st.link || !st.dir) fail('REVIEW_PATH');
    resolvedName(p);
    return p;
  }
  const chain = (components, create) => components.reduce((parent, c) => directory(parent, c, create), realRoot());
  // Revalidates the parents and the leaf identity, then removes only the file this run created. Any doubt is REVIEW_CLEANUP.
  function removeOwn(components, file, identity) {
    try {
      if (identity === null) fail('REVIEW_CLEANUP');
      chain(components, false);
      const st = lstatOrNull(file);
      if (st === null) return;
      if (st.link || !st.file || !sameFile(st, identity)) fail('REVIEW_CLEANUP');
      fsx.unlinkSync(file);
    } catch { throw rvError('REVIEW_CLEANUP'); }
  }
  // Writes, syncs and closes a descriptor this run created exclusively; on failure the descriptor is closed and the
  // incomplete file removed, and the original failure (or REVIEW_CLEANUP) is thrown.
  function complete(fd, components, file, bytes) {
    let identity = null;
    let open = true;
    try {
      identity = fstat(fd);
      if (!identity.file) fail('REVIEW_PATH');
      for (let done = 0; done < bytes.length;) {
        const n = io(() => fsx.writeSync(fd, bytes, done, bytes.length - done));
        if (!Number.isInteger(n) || n <= 0 || n > bytes.length - done) fail('REVIEW_IO');
        done += n;
      }
      io(() => fsx.fsyncSync(fd));
      open = false;
      close(fd);
    } catch (e) {
      if (open) closeQuietly(fd);
      removeOwn(components, file, identity);
      throw e;
    }
  }
  function checkIgnore(file) {
    const st = lstat(file);
    if (st.link || !st.file) fail('REVIEW_PATH');
    protectedName(resolvedName(file));
    const fd = openFd(() => fsx.openSync(file, READ_FLAGS), { ELOOP: 'REVIEW_PATH' });
    let same;
    try {
      const fst = fstat(fd);
      if (!fst.file || !sameFile(fst, st)) fail('REVIEW_PATH');
      if (fst.size !== IGNORE_BYTES.length) same = false;
      else {
        const data = io(() => fsx.readFileSync(fd));
        if (!Buffer.isBuffer(data)) fail('REVIEW_IO');
        same = data.equals(IGNORE_BYTES);
      }
    } catch (e) { closeQuietly(fd); throw e; }
    close(fd);
    if (!same) fail('REVIEW_IGNORE');
  }
  /** Establishes .ai, .ai/.run, the self-ignore file and .ai/.run/review, then creates the artifact exclusively. */
  function publish(out, bytes) {
    const run = chain(['.ai', '.run'], true);
    const ignore = path.join(run, '.gitignore');
    if (lstatOrNull(ignore) !== null) checkIgnore(ignore);
    else {
      protectedName(`${resolvedName(run)}/.gitignore`);
      let fd = null;
      try { fd = fsx.openSync(ignore, 'wx', 0o644); } catch (e) { if (!(e && e.code === 'EEXIST')) throw rvError('REVIEW_IO'); }
      if (fd === null) checkIgnore(ignore); // another creator won; its bytes must be exact
      else {
        if (!Number.isInteger(fd) || fd < 0) fail('REVIEW_IO');
        complete(fd, ['.ai', '.run'], ignore, IGNORE_BYTES);
      }
    }
    chain(['.ai', '.run', 'review'], true);
    const review = chain(['.ai', '.run', 'review'], false); // revalidate the whole chain before the artifact is opened
    const file = path.join(review, out.slice(OUT_PREFIX.length));
    const existing = lstatOrNull(file);
    if (existing !== null) fail(existing.file && !existing.link ? 'REVIEW_EXISTS' : 'REVIEW_PATH');
    protectedName(`${resolvedName(review)}/${path.basename(file)}`);
    const fd = openFd(() => fsx.openSync(file, 'wx', 0o600), { EEXIST: 'REVIEW_EXISTS', ELOOP: 'REVIEW_PATH' });
    complete(fd, ['.ai', '.run', 'review'], file, bytes);
  }
  return { readUntracked, publish };
}

// ------------------------------------------------------------------ run ----
const D = ['--no-ext-diff', '--no-textconv', '--no-renames', '--no-color', '--submodule=short', '--ignore-submodules=none', '--src-prefix=a/', '--dst-prefix=b/'];
const INVENTORY = ['--no-ext-diff', '--no-textconv', '--no-renames', '--no-color', '--ignore-submodules=none', '--name-only', '-z'];

async function review(request, deps) {
  const session = await createGitSession(deps.session);
  const policy = session.policy;
  const isProtected = (p) => matchesPolicyPath(p, policy);
  const isArtifact = (p) => matchesPolicyPath(p, ARTIFACT_POLICY);
  // Plan 3.2 steps 4-6: protected selectors, artifact-input selectors, then the output and self-ignore paths.
  if (request.paths.some(isProtected)) fail('GIT_SAFE_SECRET');
  if (request.paths.some(isArtifact)) fail('REVIEW_ARTIFACT_INPUT');
  if (request.out !== null && (isProtected(request.out) || isProtected(IGNORE_REL))) fail('GIT_SAFE_SECRET');

  // Steps 7-8: resolution (once per distinct spelling), then the merge-base.
  const ids = new Map();
  const resolve = async (spelling) => { if (!ids.has(spelling)) ids.set(spelling, await session.resolveCommit(spelling)); return ids.get(spelling); };
  const committed = request.head !== null;
  const B = await resolve(request.base);
  const H = await resolve(committed ? request.head : 'HEAD');
  const mb = await session.git(['merge-base', B, H]);
  const m = OID_LINE.exec(utf8(mb.stdout) || '');
  if (!m) fail('GIT_SAFE_RECORD');
  const M = m[1];
  if (!OID.test(M)) fail('GIT_SAFE_RECORD');

  const L = request.paths.map((p) => `:(literal)${p}`);
  const selected = (n) => request.paths.length === 0 || request.paths.some((s) => n === s || n.startsWith(`${s}/`));
  // C5-P2-1 and C5-P2-2: one exclusion list sorted once; the content call runs only for a visible selected name.
  const classify = (names) => {
    const sel = [...new Set(names)].filter(selected);
    const hidden = sel.filter((n) => isProtected(n) || isArtifact(n));
    const excluded = [...new Set([...hidden, ...FIXED_EXCLUSIONS])].sort(byUtf8);
    return { visible: sel.length > hidden.length, E: excluded.map((p) => `:(exclude,literal)${p}`) };
  };
  const content = async (argv) => {
    try { return (await session.git(argv, { limit: MAX_OUTPUT_BYTES })).stdout; } catch (e) {
      if (e instanceof Error && e.code === 'GIT_SAFE_LIMIT') fail('GIT_SAFE_LIMIT');
      throw e;
    }
  };

  const pieces = [];
  let mode;
  if (committed) {
    mode = 'committed-head';
    const names = parseNames((await session.git(['diff', ...INVENTORY, M, H, '--', ...L])).stdout);
    const { visible, E } = classify(names);
    if (visible) pieces.push(await content(['diff', ...D, '--patch', M, H, '--', ...L, ...E]));
  } else {
    mode = 'local-worktree';
    // C5-P2-3: the three inventories, each parsed as it arrives; then filtering, unresolved entries, diff-index and the
    // untracked candidates one at a time in UTF-8 byte order. The first failure ends the run.
    const tree = await session.listTree(M);
    const index = parseIndex((await session.git(['ls-files', '--cached', '--stage', '-z', '--', ...L])).stdout);
    const untracked = parseUntracked((await session.git(['ls-files', '--others', '--exclude-standard', '-z', '--', ...L])).stdout);
    const { visible, E } = classify([...tree.map((e) => e.path), ...index.map((r) => r.path)]);
    if (index.some((r) => r.stage !== 0 && selected(r.path) && !isProtected(r.path) && !isArtifact(r.path))) fail('REVIEW_UNMERGED');
    if (visible) pieces.push(await content(['diff-index', ...D, '-p', M, '--', ...L, ...E]));
    const candidates = untracked.filter((u) => selected(u.name) && !isProtected(u.name) && !isArtifact(u.name)).sort((a, b) => byUtf8(a.name, b.name));
    if (candidates.length > 0) {
      const disk = makeDisk(deps.fsx, deps.readSync, session.root, isProtected);
      for (const c of candidates) {
        if (c.marker) fail('REVIEW_TYPE'); // an embedded repository is never opened or walked
        const { data, binary, executable } = disk.readUntracked(c.name);
        pieces.push(renderNewFile(c.name, data, binary, executable));
      }
    }
  }

  // Steps 11-12: the complete result, header included, then its byte bound.
  const result = Buffer.concat([Buffer.from(`# review-diff mode=${mode} base=${B} head=${H} merge-base=${M}\n\n`), ...pieces]);
  if (result.length > MAX_OUTPUT_BYTES) fail('GIT_SAFE_LIMIT');
  if (request.out === null) return result;
  makeDisk(deps.fsx, deps.readSync, session.root, isProtected).publish(request.out, result);
  return Buffer.from(`${request.out}\n`);
}

/**
 * Plan 2.6 and 3.13: { exitCode, stdout, stderr }. Arguments first, then dependencies, then the review. A handled failure
 * is exit 2 with empty stdout and one diagnostic line; nothing is written to a stream and no exit state is set here.
 */
export async function reviewMain(argv, dependencies = {}) {
  try {
    const request = parseReviewArgs(argv);
    const deps = readDependencies(dependencies);
    return { exitCode: 0, stdout: await review(request, deps), stderr: '' };
  } catch (e) {
    return { exitCode: 2, stdout: Buffer.alloc(0), stderr: `git-safe: ${diagnostic(e)}\n` };
  }
}
