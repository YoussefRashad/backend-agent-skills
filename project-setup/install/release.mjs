#!/usr/bin/env node
// Local release builder for project-setup: reads an EXISTING local tag and writes, into a new
// directory outside project-setup/, the tagged project-setup ZIP plus RELEASE-NOTES.md (the
// publication notes). It never creates or moves a tag, changes the index, checks anything out,
// installs the skill, starts a model or publishes anything. Not copied into installs.
//
// Usage:
//   node install/release.mjs --tag <local-tag-name> --out <new-directory>
//
// Release authority is the tagged commit, never the working tree: VERSION and
// RELEASE-NOTES-<version>.md are read as blobs of the resolved commit, and the archive is built
// from that commit by `git archive`. Every Git child runs with an isolated environment (no
// inherited GIT_* variable, no system or global configuration, no replace objects, no optional
// locks, no prompts). Four identities stay distinct: the Git tree ID of the tagged project-setup
// subtree, the archive SHA256 over the raw ZIP bytes, the installer's normalized treeSha256 and
// the backup snapshot digest. The in-tree release notes never carry a resolved ID or digest;
// only the external publication notes do.
//
// Exit codes: 0 ok, 1 usage or invalid dependencies, 2 any refused or failed release step.
// Every failure prints exactly one stderr line "<code>: <message>" and nothing on stdout; no
// native error text, Git stderr or file content is ever forwarded.
//
// Exports: parseReleaseArgs(argv) (synchronous, pure) and main(argv, dependencies) (resolves to
// { exitCode, stdout, stderr }; never writes process streams or sets the exit code). Only direct
// execution of this file writes the returned streams and sets process.exitCode.
import nodeFs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const WIN = process.platform === 'win32';

const MESSAGES = Object.freeze({
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

const LF = '\n';
const TAG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const OID_RE = /^([0-9a-f]{64}|[0-9a-f]{40})\r?\n$/;
const VERSION_RE = /^\d+\.\d+\.\d+(-rc\.\d+)?\n$/;
const NOTES_HEX_RE = /(?<![0-9a-f])(?:[0-9a-f]{64}|[0-9a-f]{40})(?![0-9a-f])/i;
const DEPENDENCY_KEYS = Object.freeze(['repository', 'cwd', 'env', 'execute', 'fs']);
const FS_KEYS = Object.freeze(['lstatSync', 'mkdirSync', 'realpathSync', 'writeFileSync']);

// A failure carrying one of the fixed codes above. Never shown with its stack or native text.
class ReleaseFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const fail = (code) => {
  throw new ReleaseFailure(code);
};
const result = (code) => ({ exitCode: MESSAGES[code][0], stdout: '', stderr: `${code}: ${MESSAGES[code][1]}${LF}` });

// ---------------------------------------------------------------- arguments ----

function usageError() {
  const error = new Error(`RELEASE_USAGE: ${MESSAGES.RELEASE_USAGE[1]}`);
  error.code = 'RELEASE_USAGE';
  return error;
}

// True when a string contains U+0000-U+001F or U+007F.
function hasControl(value) {
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return true;
  }
  return false;
}

// Tags are names under refs/tags/ only: no revision expression, object ID expression, slash,
// space, shell metacharacter, "..", final "." or ".lock" suffix. Case-sensitive.
function validTag(tag) {
  return TAG_RE.test(tag) && !tag.includes('..') && !tag.endsWith('.') && !tag.endsWith('.lock');
}

// The only accepted form is --tag <tag> --out <directory>, the two pairs in either order, each
// exactly once. The returned strings are the supplied ones, not normalized.
export function parseReleaseArgs(argv) {
  if (!Array.isArray(argv) || argv.length !== 4) throw usageError();
  const values = {};
  for (let i = 0; i < 4; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    for (const item of [flag, value]) {
      if (typeof item !== 'string' || item === '' || hasControl(item)) throw usageError();
    }
    if (flag !== '--tag' && flag !== '--out') throw usageError();
    const key = flag.slice(2);
    if (Object.prototype.hasOwnProperty.call(values, key)) throw usageError();
    if (value.startsWith('-')) throw usageError();
    values[key] = value;
  }
  if (!validTag(values.tag)) throw usageError();
  return { tag: values.tag, out: values.out };
}

// ------------------------------------------------------------- dependencies ----

const isPlainObject = (value) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};
const isAbsolutePath = (value) => typeof value === 'string' && value !== '' && path.isAbsolute(value);

function validFs(candidate) {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
  const keys = Object.keys(candidate).sort();
  if (keys.length !== FS_KEYS.length || keys.some((key, i) => key !== FS_KEYS[i])) return false;
  if (typeof candidate.lstatSync !== 'function') return false;
  if (typeof candidate.mkdirSync !== 'function') return false;
  if (typeof candidate.writeFileSync !== 'function') return false;
  const realpath = candidate.realpathSync;
  if (realpath === null || (typeof realpath !== 'function' && typeof realpath !== 'object')) return false;
  return typeof realpath.native === 'function';
}

// The default filesystem, adapted to the same four-member surface the seam exposes.
function defaultFs() {
  return {
    lstatSync: (target) => nodeFs.lstatSync(target),
    realpathSync: { native: (target) => nodeFs.realpathSync.native(target) },
    mkdirSync: (target) => nodeFs.mkdirSync(target),
    writeFileSync: (target, data, options) => nodeFs.writeFileSync(target, data, options),
  };
}

function defaultExecute(command, argv, options) {
  const r = spawnSync(command, argv, options);
  return {
    status: r.status === undefined ? null : r.status,
    signal: r.signal === undefined ? null : r.signal,
    error: r.error === undefined ? null : r.error,
    stdout: r.stdout,
    stderr: r.stderr,
  };
}

function defaultEnv() {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) if (typeof value === 'string') env[key] = value;
  return env;
}

// Returns the complete dependency set, or null when any supplied dependency is invalid. A key
// whose value is undefined counts as omitted.
function resolveDependencies(dependencies) {
  if (!isPlainObject(dependencies)) return null;
  for (const key of Object.keys(dependencies)) if (!DEPENDENCY_KEYS.includes(key)) return null;
  const given = (key) => dependencies[key] !== undefined;
  if (given('repository') && !isAbsolutePath(dependencies.repository)) return null;
  if (given('cwd') && !isAbsolutePath(dependencies.cwd)) return null;
  if (given('env')) {
    if (!isPlainObject(dependencies.env)) return null;
    for (const value of Object.values(dependencies.env)) if (typeof value !== 'string') return null;
  }
  if (given('execute') && typeof dependencies.execute !== 'function') return null;
  if (given('fs') && !validFs(dependencies.fs)) return null;
  return {
    repository: given('repository') ? dependencies.repository : path.resolve(path.dirname(SELF), '..', '..'),
    cwd: given('cwd') ? dependencies.cwd : process.cwd(),
    env: given('env') ? dependencies.env : defaultEnv(),
    execute: given('execute') ? dependencies.execute : defaultExecute,
    fs: given('fs') ? dependencies.fs : defaultFs(),
  };
}

// -------------------------------------------------------------------- paths ----

const fold = (value) => (WIN ? value.toLowerCase() : value);
const toForwardSlashes = (value) => value.split(path.sep).join('/').split('\\').join('/');

// Path-component containment (never a string prefix): an outside sibling such as
// project-setup-output is not inside project-setup. Case-insensitive on Windows.
function within(root, candidate) {
  const relative = path.relative(fold(path.resolve(root)), fold(path.resolve(candidate)));
  if (relative === '') return true;
  if (path.isAbsolute(relative)) return false;
  return relative !== '..' && !relative.startsWith(`..${path.sep}`);
}

function canonicalDirectory(fs, target, code) {
  let canonical;
  try {
    canonical = fs.realpathSync.native(target);
  } catch {
    fail(code);
  }
  if (!isAbsolutePath(canonical)) fail(code);
  let stat;
  try {
    stat = fs.lstatSync(canonical);
  } catch {
    fail(code);
  }
  if (!stat || typeof stat.isDirectory !== 'function' || !stat.isDirectory()) fail(code);
  return canonical;
}

// The destination must not exist in any form. A successful lstat is an existing destination
// (file, empty directory, symlink, dangling symlink or junction); ENOENT means absent; any other
// error is a write error. No later check runs after a failure.
function assertAbsent(fs, target) {
  let found = false;
  try {
    fs.lstatSync(target);
    found = true;
  } catch (error) {
    if (!error || error.code !== 'ENOENT') fail('RELEASE_WRITE');
  }
  if (found) fail('RELEASE_OUT_EXISTS');
}

// ---------------------------------------------------------------------- Git ----

function gitEnvironment(env) {
  const out = {};
  for (const [key, value] of Object.entries(env)) if (!/^GIT_/i.test(key)) out[key] = value;
  // Git for Windows rejects Node's os.devNull spelling ("\\.\nul") for GIT_CONFIG_GLOBAL, so the
  // Windows null device is named NUL there (decision I11b-1). The intent is unchanged: no global
  // configuration is read.
  out.GIT_CONFIG_NOSYSTEM = '1';
  out.GIT_CONFIG_GLOBAL = WIN ? 'NUL' : os.devNull;
  out.GIT_ATTR_NOSYSTEM = '1';
  out.GIT_NO_REPLACE_OBJECTS = '1';
  out.GIT_OPTIONAL_LOCKS = '0';
  out.GIT_TERMINAL_PROMPT = '0';
  return out;
}

const okResult = (r) =>
  r !== null &&
  typeof r === 'object' &&
  r.status === 0 &&
  r.signal === null &&
  r.error === null &&
  Buffer.isBuffer(r.stdout) &&
  Buffer.isBuffer(r.stderr);

const decodeUtf8 = (bytes) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
const hasBom = (bytes) => bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;

function parseObjectId(bytes) {
  const match = OID_RE.exec(bytes.toString('latin1'));
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------- main ----

async function build(args, deps) {
  const { fs, execute } = deps;

  // 1. Repository, output parent, containment, then destination existence.
  const canonicalRepository = canonicalDirectory(fs, deps.repository, 'RELEASE_REPOSITORY');
  const suppliedOut = path.resolve(deps.cwd, args.out);
  const canonicalParent = canonicalDirectory(fs, path.dirname(suppliedOut), 'RELEASE_OUT_PARENT');
  const canonicalOut = path.join(canonicalParent, path.basename(suppliedOut));
  const protectedRoots = [];
  for (const repository of [canonicalRepository, path.resolve(deps.repository)]) {
    protectedRoots.push(path.join(repository, 'project-setup'), path.join(repository, '.git'));
  }
  for (const candidate of [suppliedOut, canonicalOut]) {
    if (protectedRoots.some((root) => within(root, candidate))) fail('RELEASE_OUT_SOURCE');
  }
  assertAbsent(fs, suppliedOut);
  assertAbsent(fs, canonicalOut);

  // 2-7. Git operations, in order, each mapped to its fixed error.
  const prefix = ['-c', `safe.directory=${toForwardSlashes(canonicalRepository)}`, '-c', `core.attributesFile=${os.devNull}`];
  const gitEnv = gitEnvironment(deps.env);
  const git = async (operation, code) => {
    let r;
    try {
      r = await execute('git', [...prefix, ...operation], {
        cwd: canonicalRepository,
        env: { ...gitEnv },
        shell: false,
        windowsHide: true,
        encoding: null,
        timeout: 120000,
        maxBuffer: 67108864,
      });
    } catch {
      fail(code);
    }
    if (!okResult(r)) fail(code);
    return r.stdout;
  };

  // 2. Repository-root identity: Git's top level and the supplied repository are the same
  // directory after native canonicalization (case-folded on Windows).
  const top = await git(['rev-parse', '--show-toplevel'], 'RELEASE_REPOSITORY');
  let topPath;
  try {
    topPath = decodeUtf8(top);
  } catch {
    fail('RELEASE_REPOSITORY');
  }
  if (topPath.endsWith(`\r${LF}`)) topPath = topPath.slice(0, -2);
  else if (topPath.endsWith(LF)) topPath = topPath.slice(0, -1);
  else fail('RELEASE_REPOSITORY');
  if (topPath === '' || topPath.includes(LF) || topPath.includes('\r') || !path.isAbsolute(topPath)) fail('RELEASE_REPOSITORY');
  let canonicalTop;
  try {
    canonicalTop = fs.realpathSync.native(topPath);
  } catch {
    fail('RELEASE_REPOSITORY');
  }
  if (typeof canonicalTop !== 'string' || fold(path.resolve(canonicalTop)) !== fold(path.resolve(canonicalRepository))) fail('RELEASE_REPOSITORY');

  // 3. The tag, always under refs/tags/, peeled to a commit.
  const commit = parseObjectId(await git(['rev-parse', '--verify', '--end-of-options', `refs/tags/${args.tag}^{commit}`], 'RELEASE_TAG'));
  if (commit === null) fail('RELEASE_TAG');

  // 4. The tagged project-setup subtree, type-checked.
  const tree = parseObjectId(await git(['rev-parse', '--verify', '--end-of-options', `${commit}:project-setup`], 'RELEASE_TREE'));
  if (tree === null || tree.length !== commit.length) fail('RELEASE_TREE');
  const type = (await git(['cat-file', '-t', tree], 'RELEASE_TREE')).toString('latin1');
  if (type !== `tree${LF}` && type !== `tree\r${LF}`) fail('RELEASE_TREE');

  // 5. The tagged VERSION, then the tagged release notes it names.
  const versionBytes = await git(['cat-file', 'blob', `${commit}:project-setup/VERSION`], 'RELEASE_VERSION');
  let versionText;
  try {
    versionText = decodeUtf8(versionBytes);
  } catch {
    fail('RELEASE_VERSION');
  }
  if (hasBom(versionBytes) || !VERSION_RE.test(versionText)) fail('RELEASE_VERSION');
  const version = versionText.slice(0, -1);
  const notes = await git(['cat-file', 'blob', `${commit}:project-setup/RELEASE-NOTES-${version}.md`], 'RELEASE_NOTES');
  let notesText;
  try {
    notesText = decodeUtf8(notes);
  } catch {
    fail('RELEASE_NOTES');
  }
  if (notes.length === 0 || hasBom(notes) || notes.includes(0x0d) || notes[notes.length - 1] !== 0x0a || NOTES_HEX_RE.test(notesText)) {
    fail('RELEASE_NOTES');
  }

  // 6-7. The archive, entirely from the resolved commit, hashed over its raw bytes.
  const zip = await git(['archive', '--format=zip', commit, 'project-setup/'], 'RELEASE_ARCHIVE');
  if (zip.length < 4 || zip[0] !== 0x50 || zip[1] !== 0x4b || zip[2] !== 0x03 || zip[3] !== 0x04) fail('RELEASE_ARCHIVE');
  const sha256 = createHash('sha256').update(zip).digest('hex');

  // 8. Publication notes: identity header, one blank line, then the complete tagged note bytes.
  const zipName = `project-setup-${version}.zip`;
  const header = [
    `# project-setup ${version} publication notes`,
    '',
    `Tag: ${args.tag}`,
    `Commit: ${commit}`,
    `Project-setup tree: ${tree}`,
    `Archive: ${zipName}`,
    `Archive SHA256: ${sha256}`,
    '',
    '',
  ].join(LF);
  const publication = Buffer.concat([Buffer.from(header, 'utf8'), notes]);

  // 9-10. Exclusive, non-recursive output creation; the ZIP first, then the notes. A failure
  // after creation leaves the directory and any partial output for inspection.
  try {
    fs.mkdirSync(canonicalOut);
  } catch (error) {
    fail(error && error.code === 'EEXIST' ? 'RELEASE_OUT_EXISTS' : 'RELEASE_WRITE');
  }
  const archivePath = path.join(canonicalOut, zipName);
  const notesPath = path.join(canonicalOut, 'RELEASE-NOTES.md');
  try {
    fs.writeFileSync(archivePath, zip, { flag: 'wx' });
  } catch {
    fail('RELEASE_WRITE');
  }
  try {
    fs.writeFileSync(notesPath, publication, { flag: 'wx' });
  } catch {
    fail('RELEASE_WRITE');
  }

  // 11. Success.
  const stdout = [
    `RELEASE  OK  ${version}`,
    `TAG  ${args.tag}`,
    `COMMIT  ${commit}`,
    `TREE  ${tree}`,
    `ARCHIVE  ${archivePath}`,
    `SHA256  ${sha256}`,
    `NOTES  ${notesPath}`,
    'PUBLICATION  pending',
  ].join(LF);
  return { exitCode: 0, stdout: `${stdout}${LF}`, stderr: '' };
}

export async function main(argv, dependencies = {}) {
  let args;
  try {
    args = parseReleaseArgs(argv);
  } catch {
    return result('RELEASE_USAGE');
  }
  const deps = resolveDependencies(dependencies);
  if (deps === null) return result('RELEASE_OPTIONS');
  try {
    return await build(args, deps);
  } catch (error) {
    // Every step throws only a ReleaseFailure; anything else is reported as a write error rather
    // than leaking native text.
    return result(error instanceof ReleaseFailure ? error.code : 'RELEASE_WRITE');
  }
}

// ------------------------------------------------------------ direct execution ----

function invokedDirectly() {
  const entry = process.argv[1];
  if (typeof entry !== 'string' || entry === '') return false;
  if (fold(path.resolve(entry)) === fold(SELF)) return true;
  try {
    return fold(nodeFs.realpathSync.native(entry)) === fold(nodeFs.realpathSync.native(SELF));
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main(process.argv.slice(2)).then((r) => {
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    process.exitCode = r.exitCode;
  });
}
