#!/usr/bin/env node
// The only code path that opens the environment template. It returns key NAMES and value CLASSIFICATIONS, never
// values. Agents use this instead of reading environment files.
//
// Plan: docs/plans/2026-10-19-project-setup-v3-rc1-c9.md (template resolution and command hygiene).
//
// What this gets right that v2 did not:
//   - Automatic selection addresses one fixed path, the repository-root template. It never searches directories,
//     never opens an alternate name and never falls back to one. A missing template is a manual step for the user;
//     the script creates no template and no substitute.
//   - Existing values are preserved and never printed. Any value (a placeholder included) is reported once as a
//     manual reduction step; nothing is rewritten to names-only automatically.
//   - The key list is checked under its canonical path against the shipped AND the installed refusal set before it
//     is opened, and only that canonical path is read.
//   - merge stages the result in the run vault for apply's names-and-classifications review. It builds from the
//     project template every time and never writes the project template itself.
//
// Usage:
//   node env-keys.mjs keys --template auto
//   node env-keys.mjs merge --template auto --keys <keys.json> --run-id <id>
//     keys.json: [{ "name": "DB_HOST", "required": true, "secret": false, "description": "...", "group": "Database" }]
//
// Exports are pure: parseEnvArgs and mergeTemplateText touch no file, process, stream or environment and never
// mutate their inputs. main(argv, options) returns { exitCode, stdout, stderr } and never writes a process stream or
// exits; only the direct CLI entrypoint at the end does that. Importing the module only defines it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSecurityPolicy } from '../assets/tools/security-policy.mjs';
import {
  assertNotSecretInput, atomicWrite, classifyEnvTemplate, loadSecretSpec, repoRoot, safeResolve, secureDir, setFilesystemRoot,
  validateRunId,
} from './lib.mjs';
import { parseBlocks, upsertBlock } from './blocks.mjs';

// The permitted template, repository-root relative. It is the only template this script ever addresses.
const TEMPLATE = '.env.example';
const BLOCK_ID = 'env-example';
const POLICY_DIR = '.ai';
const POLICY_FILE = 'security-paths.json';

// Plan 3.3 and 3.4: the two manual steps, copied into the final setup report by the agent.
const MISSING_STEP = 'Template missing: .env.example. Manually create the root .env.example with key names and empty assignments only, then rerun project-setup.';
const VALUES_STEP = 'Template contains values: .env.example. Existing values were preserved and were not printed. Manually reduce the template to key names with empty assignments.';

// Plan 3.8: code -> [exit code, error text]. Errors never carry a file body, a rejected argument or a native message.
const ERRORS = Object.freeze({
  ENV_USAGE: [1, 'usage: env-keys.mjs keys --template auto; env-keys.mjs merge --template auto --keys <file> --run-id <id>'],
  ENV_TEMPLATE_INPUT: [1, 'only automatic template selection is supported; use --template auto'],
  ENV_RUN_ID: [1, 'invalid run id'],
  ENV_OPTIONS: [1, 'invalid env-keys options'],
  ENV_ROOT: [2, 'cannot establish a safe project root'],
  ENV_TEMPLATE_PATH: [2, 'template path is unsafe or is not a regular file'],
  ENV_TEMPLATE_IO: [2, 'cannot read the permitted template'],
  ENV_KEYS_PATH: [2, 'keys input path is unsafe or cannot be resolved'],
  ENV_KEYS_PROTECTED: [3, 'keys input is protected by the security policy'],
  ENV_KEYS_IO: [2, 'cannot read keys input'],
  ENV_KEYS_JSON: [3, 'keys input is not valid JSON; content not shown'],
  ENV_KEYS_SCHEMA: [3, 'keys input must be an array of valid key descriptions'],
  ENV_POLICY: [3, 'security policy is invalid or unsupported'],
  ENV_POLICY_IO: [2, 'cannot safely read security policy'],
  ENV_RUN_MISSING: [2, 'run not initialised; run apply.mjs init first'],
  ENV_VAULT_PATH: [2, 'template staging path is unsafe'],
  ENV_VAULT_IO: [2, 'cannot stage the permitted template'],
  ENV_MARKERS: [3, 'template has invalid managed block markers'],
  ENV_INTERNAL: [2, 'template operation failed; content not shown'],
});

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
// An Error with an own string code and the message "<code>: <error text>" (plan 3.8).
const envError = (code) => Object.assign(new Error(`${code}: ${ERRORS[code][1]}`), { code });

// ------------------------------------------------------------ arguments ----
// Plan 3.1: which options each command accepts, and the result field each one fills.
const ACCEPTED = { keys: ['--template'], merge: ['--template', '--keys', '--run-id'] };
const FIELD = { '--template': 'template', '--keys': 'keysFile', '--run-id': 'runId' };

/**
 * Parses env-keys arguments (argv excludes Node and the script path). Returns fresh
 * { command, template: "auto", keysFile, runId } or throws the exact error of plan 3.1/3.8. Pure.
 *
 * Order: the C5 reservation of the first exact run-id value (whenever argv is an array of strings), then the command,
 * then any token that names the legacy file option (refused as an alternate template input), then the options left
 * to right (spelling, applicability and duplication before the value), then the required merge options, then the
 * ordinary run-id grammar.
 */
export function parseEnvArgs(argv) {
  let strings = Array.isArray(argv);
  if (strings) for (let i = 0; i < argv.length; i++) if (typeof argv[i] !== 'string') strings = false;
  if (strings) {
    const at = argv.indexOf('--run-id');
    if (at >= 0 && at + 1 < argv.length && !argv[at + 1].startsWith('--')) {
      try { validateRunId(argv[at + 1]); } catch (e) { if (e && e.code === 'RUN_ID_RESERVED') throw e; }
    }
  }
  if (!strings || argv.length === 0 || (argv[0] !== 'keys' && argv[0] !== 'merge')) throw envError('ENV_USAGE');
  const command = argv[0];
  const rest = argv.slice(1);
  if (rest.some((t) => t.startsWith('--file'))) throw envError('ENV_TEMPLATE_INPUT');
  const values = { template: 'auto', keysFile: null, runId: null };
  const seen = new Set();
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith('--')) throw envError('ENV_TEMPLATE_INPUT');
    if (!hasOwn(FIELD, token) || !ACCEPTED[command].includes(token) || seen.has(token)) throw envError('ENV_USAGE');
    seen.add(token);
    const value = rest[i + 1];
    if (value === undefined || value === '' || value.startsWith('--')) throw envError('ENV_USAGE');
    if (token === '--template' && value !== 'auto') throw envError('ENV_TEMPLATE_INPUT');
    values[FIELD[token]] = value;
    i++;
  }
  if (command === 'merge') {
    if (!seen.has('--keys') || !seen.has('--run-id')) throw envError('ENV_USAGE');
    try { validateRunId(values.runId); } catch (e) { if (e && e.code === 'RUN_ID_RESERVED') throw e; throw envError('ENV_RUN_ID'); }
  }
  return { command, template: 'auto', keysFile: values.keysFile, runId: values.runId };
}

// ------------------------------------------------------------ the merge ----
const KEY_FIELDS = new Set(['name', 'required', 'secret', 'description', 'group']);
const KEY_NAME = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const BAD_TEXT = /[\r\n\u0000]/;

// Plan 3.5: the key list is an array of plain objects with exactly the documented fields. A malformed row rejects
// the whole list; nothing is silently discarded. Returns normalized copies (defaults applied).
function readKeyList(value) {
  const schema = () => envError('ENV_KEYS_SCHEMA');
  if (!Array.isArray(value)) throw schema();
  const rows = [];
  for (let i = 0; i < value.length; i++) {
    const row = value[i];
    if (!isPlainObject(row)) throw schema();
    if (Object.keys(row).some((k) => !KEY_FIELDS.has(k))) throw schema();
    if (!hasOwn(row, 'name') || typeof row.name !== 'string' || !KEY_NAME.test(row.name)) throw schema();
    for (const k of ['required', 'secret']) if (hasOwn(row, k) && typeof row[k] !== 'boolean') throw schema();
    for (const k of ['description', 'group']) if (hasOwn(row, k) && (typeof row[k] !== 'string' || BAD_TEXT.test(row[k]))) throw schema();
    rows.push({
      name: row.name,
      required: row.required === true,
      secret: row.secret === true,
      description: hasOwn(row, 'description') ? row.description : '',
      group: hasOwn(row, 'group') && row.group !== '' ? row.group : 'Other',
    });
  }
  return rows;
}

/**
 * Adds the requested names that the template lacks, as empty assignments in the managed env-example block. Returns
 * fresh { text, added }. Pure: no filesystem, process or environment access, inputs never mutated.
 *
 * Validation order (plan 3.6): text type (the shared classifier's ENV_TEMPLATE_TEXT), key-list schema
 * (ENV_KEYS_SCHEMA), block markers (ENV_MARKERS, even when nothing would be added), then the missing names. Existing
 * assignments keep their values, inside and outside the block; a secret name gets NAME= like every other, never a
 * generated value. With nothing to add, the original text is returned exactly. Otherwise the existing block helper
 * writes the block, with its EOL handling and its normalization of the staged copy (BOM, mixed endings, lone CR).
 */
export function mergeTemplateText(text, wanted) {
  const entries = classifyEnvTemplate(text);
  const rows = readKeyList(wanted);
  const parsed = parseBlocks(text);
  if (parsed.errors.length) throw envError('ENV_MARKERS');
  const have = new Set(entries.map((e) => e.name));
  const missing = [];
  for (const row of rows) {
    if (have.has(row.name)) continue; // present in the template, or an earlier request for the same name won
    have.add(row.name);
    missing.push(row);
  }
  if (missing.length === 0) return { text, added: [] };
  const groups = new Map();
  for (const row of missing) {
    if (!groups.has(row.group)) groups.set(row.group, []);
    groups.get(row.group).push(row);
  }
  const body = [];
  for (const [group, list] of groups) {
    body.push(`# --- ${group} ---`);
    for (const row of list) {
      const tags = `(${row.required ? 'required' : 'optional'}, ${row.secret ? 'secret' : 'non-secret'})`;
      body.push(row.description === '' ? `# ${tags}` : `# ${row.description} ${tags}`);
      body.push(`${row.name}=`);
    }
  }
  // Append to an existing managed block instead of replacing it: what earlier runs added, values included, survives.
  const prior = parsed.blocks.find((b) => b.id === BLOCK_ID);
  const kept = prior ? prior.inner.replace(/\n+$/, '') : '';
  const inner = kept === '' ? body.join('\n') : `${kept}\n${body.join('\n')}`;
  return { text: upsertBlock(text, BLOCK_ID, inner, 'hash'), added: missing.map((row) => row.name) };
}

// ------------------------------------------------------------- main() ----
const result = (exitCode, value) => ({ exitCode, stdout: JSON.stringify(value, null, 2) + '\n', stderr: '' });
const failure = (code) => result(ERRORS[code][0], { ok: false, code, error: ERRORS[code][1] });
// A thrown error as a result: C5's reserved-id envelope is preserved exactly; a known code drops its message prefix.
function fromError(e) {
  if (e instanceof Error && e.code === 'RUN_ID_RESERVED') return result(1, { ok: false, error: e.message });
  if (e instanceof Error && typeof e.code === 'string' && hasOwn(ERRORS, e.code)) return failure(e.code);
  return failure('ENV_INTERNAL');
}

// Plan 3.2: only cwd and projectRoot; a supplied value (null included) must be a string, cwd nonempty and projectRoot
// absolute. An omitted key takes its default. Null for anything malformed.
function readOptions(options) {
  if (!isPlainObject(options)) return null;
  if (Object.keys(options).some((k) => k !== 'cwd' && k !== 'projectRoot')) return null;
  const cwd = options.cwd === undefined ? null : options.cwd;
  const projectRoot = options.projectRoot === undefined ? null : options.projectRoot;
  if (options.cwd !== undefined && (typeof cwd !== 'string' || cwd === '')) return null;
  if (options.projectRoot !== undefined && (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot))) return null;
  return { cwd: cwd === null ? process.cwd() : cwd, projectRoot };
}

function valueSummary(entries) {
  const containsValues = entries.some((e) => e.valueState !== 'empty');
  return {
    secrets: entries.filter((e) => e.valueState === 'possible-real-secret').map((e) => e.name),
    containsValues,
    manualSteps: containsValues ? [VALUES_STEP] : [],
  };
}

const readText = (abs) => { try { return fs.readFileSync(abs, 'utf8'); } catch { return null; } };

// Plan 3.5 steps 3-4: the shipped refusal set, plus the installed policy when it exists. The installed path is
// inspected before it is opened: a linked or non-directory .ai, or a linked or non-regular leaf, is refused unread.
// Only an absent installed policy falls back to the shipped set alone; a malformed one is never ignored.
function loadRefusalSets(root) {
  let shipped;
  try { shipped = loadSecretSpec(); } catch { return { code: 'ENV_POLICY_IO' }; }
  const aiDir = path.join(root, POLICY_DIR);
  let dirStat = null;
  try { dirStat = fs.lstatSync(aiDir); } catch (e) { if (!e || e.code !== 'ENOENT') return { code: 'ENV_POLICY_IO' }; }
  if (dirStat === null) return { sets: [shipped] };
  if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) return { code: 'ENV_POLICY_IO' };
  const file = path.join(aiDir, POLICY_FILE);
  let fileStat = null;
  try { fileStat = fs.lstatSync(file); } catch (e) { if (!e || e.code !== 'ENOENT') return { code: 'ENV_POLICY_IO' }; }
  if (fileStat === null) return { sets: [shipped] };
  if (fileStat.isSymbolicLink() || !fileStat.isFile()) return { code: 'ENV_POLICY_IO' };
  const text = readText(file);
  if (text === null) return { code: 'ENV_POLICY_IO' };
  let installed;
  try { installed = parseSecurityPolicy(text).policy; } catch { return { code: 'ENV_POLICY' }; }
  return { sets: [shipped, installed] };
}

// Plan 3.5 steps 1-6: resolve the key list against cwd, establish its canonical path, check the supplied spelling and
// the canonical destination against every refusal set (the shared helper checks both), refuse a canonical leaf that
// is not a regular file. Returns { real }: the checked canonical path, the only path that is then read.
function resolveKeyList(cwd, keysFile, sets) {
  const spelled = path.resolve(cwd, keysFile);
  let real;
  try { real = fs.realpathSync.native(spelled); } catch { return { code: 'ENV_KEYS_PATH' }; }
  for (const set of sets) {
    let checked;
    try { checked = assertNotSecretInput(spelled, set); } catch (e) {
      if (e instanceof Error && typeof e.code === 'string' && e.code.startsWith('POLICY_')) return { code: 'ENV_POLICY' };
      const refused = e instanceof Error && e.message.startsWith('refusing to read a secret-pattern file');
      return { code: refused ? 'ENV_KEYS_PROTECTED' : 'ENV_KEYS_PATH' };
    }
    if (checked !== real) return { code: 'ENV_KEYS_PATH' }; // the destination changed between checks
  }
  let st;
  try { st = fs.lstatSync(real); } catch { return { code: 'ENV_KEYS_PATH' }; }
  if (!st.isFile()) return { code: 'ENV_KEYS_PATH' };
  return { real };
}

function run(argv, options) {
  let args;
  try { args = parseEnvArgs(argv); } catch (e) { return fromError(e); }
  const opts = readOptions(options);
  if (opts === null) return failure('ENV_OPTIONS');

  // The root: an explicit filesystem root (no Git), or the repository root discovered from cwd.
  let root;
  if (opts.projectRoot !== null) {
    try { root = setFilesystemRoot(opts.projectRoot); } catch { return failure('ENV_ROOT'); }
  } else {
    try { root = repoRoot(opts.cwd); } catch { root = null; }
    if (!root) return failure('ENV_ROOT');
  }

  // The fixed template path and its leaf, checked before any body is read. Absent means missing; a link, a junction,
  // a directory or any other non-regular leaf is unsafe.
  let abs;
  try { abs = safeResolve(root, TEMPLATE).abs; } catch (e) { return failure(e && e.unsafePath !== undefined ? 'ENV_TEMPLATE_PATH' : 'ENV_TEMPLATE_IO'); }
  let st = null;
  try { st = fs.lstatSync(abs); } catch (e) { if (!e || e.code !== 'ENOENT') return failure('ENV_TEMPLATE_IO'); }
  if (st !== null && (st.isSymbolicLink() || !st.isFile())) return failure('ENV_TEMPLATE_PATH');
  if (st === null) {
    // Plan 3.3: success with the manual step. No alternate is read, nothing is created, the key list is not opened.
    if (args.command === 'keys') return result(0, { ok: true, file: TEMPLATE, exists: false, keys: [], possibleRealSecrets: [], containsValues: false, manualSteps: [MISSING_STEP] });
    return result(0, { ok: true, file: TEMPLATE, exists: false, changed: false, added: [], existingPossibleRealSecrets: [], containsValues: false, manualSteps: [MISSING_STEP] });
  }

  if (args.command === 'keys') {
    const text = readText(abs);
    if (text === null) return failure('ENV_TEMPLATE_IO');
    const entries = classifyEnvTemplate(text);
    const s = valueSummary(entries);
    return result(0, { ok: true, file: TEMPLATE, exists: true, keys: entries, possibleRealSecrets: s.secrets, containsValues: s.containsValues, manualSteps: s.manualSteps });
  }

  // merge (plan 3.8): policy -> key-list path and refusal -> template body -> key-list body, JSON and schema ->
  // markers and merge -> the no-additions result -> run and vault checks -> the staging write.
  const policies = loadRefusalSets(root);
  if (policies.code) return failure(policies.code);
  const keys = resolveKeyList(opts.cwd, args.keysFile, policies.sets);
  if (keys.code) return failure(keys.code);
  const text = readText(abs);
  if (text === null) return failure('ENV_TEMPLATE_IO');
  let raw;
  try { raw = fs.readFileSync(keys.real, 'utf8'); } catch { return failure('ENV_KEYS_IO'); }
  let wanted;
  try { wanted = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw); } catch { return failure('ENV_KEYS_JSON'); }
  let merged;
  try { merged = mergeTemplateText(text, wanted); } catch (e) { return fromError(e); }
  const s = valueSummary(classifyEnvTemplate(text));
  const report = { ok: true, file: TEMPLATE, exists: true, changed: merged.added.length > 0, added: merged.added, existingPossibleRealSecrets: s.secrets, containsValues: s.containsValues, manualSteps: s.manualSteps };
  // Nothing to add: no run or vault validation, no write; an existing staged copy is neither replaced nor removed.
  if (merged.added.length === 0) return result(0, report);

  // Additions need an initialized run. Every segment from the root must be a real directory inside it.
  let dir;
  try { dir = secureDir(root, [POLICY_DIR, '.run', args.runId, 'vault', 'files']); } catch (e) {
    return failure(e && e.unsafePath !== undefined ? 'ENV_VAULT_PATH' : 'ENV_VAULT_IO');
  }
  if (!dir) return failure('ENV_RUN_MISSING');
  const out = path.join(dir, TEMPLATE);
  let outStat = null;
  try { outStat = fs.lstatSync(out); } catch (e) { if (!e || e.code !== 'ENOENT') return failure('ENV_VAULT_IO'); }
  if (outStat !== null && (outStat.isSymbolicLink() || !outStat.isFile())) return failure('ENV_VAULT_PATH');
  // Exclusive temp file + rename: a rename replaces the path and never writes through a link.
  try { atomicWrite(out, merged.text); } catch { return failure('ENV_VAULT_IO'); }
  return result(0, report);
}

/**
 * The env-keys command as a function: argv without Node and the script path, options { cwd, projectRoot }.
 * Returns { exitCode, stdout, stderr }; stdout is two-space JSON with one final LF and stderr is always empty.
 */
export function main(argv, options = {}) {
  try { return run(argv, options); } catch { return failure('ENV_INTERNAL'); }
}

// ------------------------------------------------------------------ CLI ----
const norm = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
if (Boolean(process.argv[1]) && norm(process.argv[1]) === norm(fileURLToPath(import.meta.url))) {
  const r = main(process.argv.slice(2));
  process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  process.exitCode = r.exitCode;
}
