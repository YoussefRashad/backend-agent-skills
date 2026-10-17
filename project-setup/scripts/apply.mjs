#!/usr/bin/env node
// The ONLY component that writes into the project tree.
//
// Run layout (.ai/.run/<run-id>/, self-gitignored, every segment a real directory inside the repo):
//   drafts/<repo-rel>          agent-authored content (docs, wrappers, instruction files)
//   vault/files/<repo-rel>     script-produced env templates only (.env.example/.sample/.template)
//   vault/backup/<repo-rel>    pre-apply copies; covered by the secret deny list
//   ownership.json             optional { "<repo-rel>": "full" | "blocks" | "keys" | "merged" }
//   managed-keys.json          optional { "<repo-rel>": <managed metadata> } (written by merge-claude-settings.mjs)
//   omissions.json             optional { "<repo-rel>": <approved omissions> }
//   manifest-metadata.json     optional { "codexSnippetSha256": "<sha256>" }
//   transaction-inputs.json    optional [ "<repo-rel>", ... ]  unchanged files the change depends on
//   plan.json                  produced by `prepare`; its SHA-256 is what the user approves
//   journal.json               produced by `commit` and `rollback`
//
// Commands:
//   init     --run-id <id>
//   diff     --project <root> --run-id <id>   read-only review; never invokes Git, never writes
//   prepare  --run-id <id> --mode <mode> [--agents claude,codex] [--approve-user-content <path,path>]
//   commit   --run-id <id> --approved-plan <planSha256 printed by prepare>
//   status   --run-id <id>
//   rollback --run-id <id>
//   cleanup  --run-id <id> [--confirm-manual-resolution]
//
// Exit codes: 1 usage/error · 2 lock/path safety · 3 plan rejected · 4 drift since prepare (nothing written)
//             5 partial apply (run rollback) · 6 rollback incomplete (backups kept)
//             7 run lifecycle: this run (or another run in the repo) already wrote files / is unresolved
//
// Run lifecycle (a run writes at most once; its journal is never reset):
//   fresh/prepared --commit--> committed | partial
//   committed|partial --rollback--> rolled-back | rollback-incomplete --(fix files, rollback again)--> rolled-back
//   prepare/commit are refused once a journal exists; a retry uses a NEW run id. prepare/commit in any run are also
//   refused while another run in the repo is partial or rollback-incomplete (its entries/backups would be orphaned).
//
// Content and metadata (plan docs/plans/2026-10-17-project-setup-v3-rc1-c2.md sections 4-6): one prepared plan holds
// the content operations (file writes) and the metadata operations (explicit ownership, managed-list, omission,
// snippet and schema changes), and one commit applies both under one journal with the manifest written last. A
// metadata change can need --approve-user-content for a file whose bytes do not change, and an unchanged content
// operation never hides metadata work. Every input the approval relies on (targets, sources, the five request
// files, declared consumers, the installed policy and the manifest) is bound by hash and rechecked before writing.
import fs from 'node:fs';
import path from 'node:path';
import {
  parseArgs, repoRoot, setFilesystemRoot, git, safeResolve, loadSecretSpec, isSecretPath, matchesAny,
  WRITE_ALLOWLIST, WRITE_DENYLIST, normalizeText, normalizedHash, rawFileHash, sha256, detectEol, readJsonFile,
  skillVersion, hostId, toPosix, ok, fail, validateRunId, secureDir, secureDirRel, ENV_TEMPLATE_RE, classifyEnvTemplate,
  writeInRepo, readInRepo, assertNotLink,
} from './lib.mjs';
import { blockHashes, outsideContent } from './blocks.mjs';
import { readManagedMetadata, readManifest, readOmissions } from './ownership.mjs';
import { parseSecurityPolicy, validateRepoPath } from '../assets/tools/security-policy.mjs';

const MANIFEST_REL = '.ai/manifest.json';
const POLICY_REL = '.ai/security-paths.json';
const SETTINGS_REL = '.claude/settings.json';
// The five run-local request files, in their binding order (plan 4.1), with their plan.metadata keys.
const REQUESTS = [
  ['ownership.json', 'ownership'], ['managed-keys.json', 'managedKeys'], ['omissions.json', 'omissions'],
  ['manifest-metadata.json', 'manifestMetadata'], ['transaction-inputs.json', 'transactionInputs'],
];
const HEX64 = /^[0-9a-f]{64}$/;
const DIFF_USAGE = 'usage: apply.mjs diff --project <root> --run-id <id>';
const DRIFT_ERROR = 'changes since prepare; nothing was written. Re-run prepare and get approval again.';
const DRIFT = {
  inventory: 'draft inventory changed since prepare',
  target: 'target changed since prepare',
  input: 'transaction input changed since prepare',
  source: 'draft changed after prepare (unreviewed content)',
  request: 'manifest metadata changed after prepare (unreviewed ownership)',
  manifest: 'manifest changed since prepare',
};
// Plan 4.5: the approval reasons of a metadata operation, in this order. GENERIC_REASON covers an explicit ownership
// change of any other recorded file, which needs a content write (the plan leaves that reason string open).
const R_POLICY = 'policy ownership or managed metadata changes';
const R_SETTINGS = 'settings ownership or managed metadata changes';
const R_OMIT = 'approved omission records change';
const GENERIC_REASON = 'recorded file ownership changes';
const SECRET_NOTE = 'secret-pattern path; content never hashed into reports';

/** Plan 5.2 "F": a direct failure with a code. The text is exactly the plan's; the code is never prepended to it. */
function failCode(code, error, exit, extra = {}) {
  process.stdout.write(JSON.stringify({ ok: false, code, error, ...extra }, null, 2) + '\n');
  process.exit(exit);
}

const rawArgs = process.argv.slice(2);
const args = parseArgs(rawArgs);
const cmd = args._[0];

/** diff takes exactly --project <root> and --run-id <id>, once each, with string values and a valid run id. */
function parseDiffArgs(argv) {
  if (argv[0] !== 'diff') return null;
  const o = {};
  for (let i = 1; i < argv.length; i += 2) {
    const key = { '--project': 'project', '--run-id': 'runId' }[argv[i]];
    const v = argv[i + 1];
    if (!key || key in o || typeof v !== 'string' || v === '' || v.startsWith('--')) return null;
    o[key] = v;
  }
  if (!o.project || !o.runId) return null;
  try { validateRunId(o.runId); } catch { return null; }
  return o;
}

let root;
let runId;
if (cmd === 'diff') {
  // Dispatched before repoRoot(): the review never invokes Git, not even to find the root. The explicit root is
  // established through the filesystem and every helper below anchors at it.
  const o = parseDiffArgs(rawArgs);
  if (!o) failCode('APPLY_DIFF_USAGE', DIFF_USAGE, 1);
  try { root = setFilesystemRoot(o.project); } catch { failCode('APPLY_ROOT', 'explicit project root is not a safe existing directory', 2); }
  runId = o.runId;
} else {
  root = repoRoot();
  if (!root) fail('not inside a git repository');
  try { runId = validateRunId(args['run-id']); } catch (e) { fail(e.message); }
}

const spec = loadSecretSpec();

// Every path inside the run is re-validated from the repository root at the moment it is used:
// any segment (".ai", ".run", the run dir, drafts, vault, backup, nested dirs) may have been replaced
// by a link or junction after init.
const RUN = ['.ai', '.run', runId];
const RUN_REL = RUN.join('/');
const runSub = (...segs) => secureDir(root, [...RUN, ...segs]);

// A link, a junction or an escaping path is an immediate exit 2 for every command, never an aggregate exit 3.
const isUnsafe = (e) => e instanceof Error && typeof e.unsafePath === 'string';
const relOf = (p) => (path.isAbsolute(p) ? toPosix(path.relative(root, p)) : toPosix(p));
const unsafeAt = (abs, message) => Object.assign(new Error(message), { unsafePath: toPosix(path.relative(root, abs)) });
function failUnsafe(e) {
  if (isUnsafe(e)) failCode('APPLY_PATH', `unsafe path: ${relOf(e.unsafePath)}`, 2);
  fail(e.message, 2);
}

// Decision I2-6: a filesystem failure while enumerating the run or stat-ing a target or source (not an unsafe path)
// is reported like an unreadable body, with a project-relative path: diff F exit 2, prepare P exit 3, commit F exit 2.
const FS_READS = new Set(['scandir', 'lstat', 'stat', 'open', 'read', 'realpath']);
const fsFailurePath = (e) => {
  if (!(e instanceof Error) || isUnsafe(e) || e.code === 'ENOENT') return null;
  if (typeof e.ioPath === 'string') return e.ioPath;
  return FS_READS.has(e.syscall) && typeof e.path === 'string' ? relOf(e.path) : null;
};
/** Runs a filesystem step and labels any non-ENOENT failure (other than an unsafe path) with the project-relative path. */
function ioTagged(rel, fn) {
  try { return fn(); } catch (e) {
    if (e instanceof Error && !isUnsafe(e) && e.code !== 'ENOENT' && typeof e.ioPath !== 'string') e.ioPath = rel;
    throw e;
  }
}
function failIo(rel) {
  if (cmd === 'diff') failCode('APPLY_DIFF_IO', `cannot read draft review input: ${rel}`, 2);
  if (cmd === 'prepare') failCode('APPLY_PLAN_REJECTED', 'plan rejected', 3, { errors: [{ target: rel, code: 'APPLY_INPUT_IO', error: `cannot read transaction input: ${rel}` }] });
  failCode('APPLY_INPUT_IO', `cannot read transaction input: ${rel}`, 2);
}
/** Handler-level mapping for diff, prepare and commit: unsafe paths stay APPLY_PATH; read failures use failIo. */
function failFs(e) {
  if (!isUnsafe(e) && fsFailurePath(e) !== null && ['diff', 'prepare', 'commit'].includes(cmd)) failIo(fsFailurePath(e));
  failUnsafe(e);
}
const isFsFailure = (e) => isUnsafe(e) || fsFailurePath(e) !== null;

let runDir;
try {
  if (cmd === 'init') {
    runDir = secureDir(root, RUN, { create: true });
    for (const sub of [['drafts'], ['vault'], ['vault', 'files'], ['vault', 'backup']]) secureDir(root, [...RUN, ...sub], { create: true });
    // Self-ignoring: the run dir can never be committed, even before .gitignore is updated.
    writeInRepo(root, '.ai/.run/.gitignore', '*\n');
  } else {
    runDir = secureDir(root, RUN);
    if (!runDir && cmd === 'diff') failCode('APPLY_RUN_MISSING', `run ${runId} does not exist; run init first`, 2);
    if (!runDir) fail(`run ${runId} does not exist; run init first`);
  }
} catch (e) { failFs(e); }

const planPath = path.join(runDir, 'plan.json');
const journalPath = path.join(runDir, 'journal.json');
const PLAN_REL = `${RUN_REL}/plan.json`;
const JOURNAL_REL = `${RUN_REL}/journal.json`;
const backupRel = (target) => `${RUN_REL}/vault/backup/${target}`;

/** State of a run from its journal (null = no journal yet). */
function runState(journal) {
  if (!journal) return 'fresh';
  if (journal.rollback) {
    if (journal.rollback.inProgress) return 'rollback-in-progress'; // interrupted or failed mid-way: unresolved
    return journal.rollback.complete ? 'rolled-back' : 'rollback-incomplete';
  }
  if (journal.committed) return 'committed';
  return (journal.entries || []).some((e) => e.state === 'applied' || e.state === 'backed-up') ? 'partial' : 'aborted-before-write';
}
function loadJournalOf(id) {
  try { return JSON.parse(readInRepo(root, `.ai/.run/${id}/journal.json`).toString('utf8')); } catch (e) {
    if (e.code === 'ENOENT' || /directory missing/.test(e.message)) return null;
    fail(`cannot read journal of run ${id}: ${e.message}`, 2);
  }
}
/** Refuse to (re)write when this run already has a journal, or any run in the repo is unresolved. */
function assertWritableLifecycle(action) {
  const own = loadJournalOf(runId);
  const ownState = runState(own);
  if (own) {
    const next = {
      committed: 'This run already wrote its changes. To change more, start a NEW run id; to undo, run rollback.',
      partial: 'This run was partially applied. Run `apply.mjs rollback` first; then retry with a NEW run id.',
      'rollback-in-progress': 'A rollback was interrupted or failed mid-way. Run rollback again (it resumes), or resolve with the user and cleanup --confirm-manual-resolution; then retry with a NEW run id.',
      'rollback-incomplete': 'Rollback left files unresolved. Resolve them with the user and run rollback again (or cleanup --confirm-manual-resolution); then retry with a NEW run id.',
      'rolled-back': 'This run was rolled back. Retry with a NEW run id (its journal and backups are kept as history).',
      'aborted-before-write': 'This run has a journal from an aborted commit. Retry with a NEW run id.',
    }[ownState];
    fail(`${action} refused: run ${runId} is ${ownState}; its journal is never reset`, 7, { state: ownState, next });
  }
  let others = [];
  try { const d = secureDir(root, ['.ai', '.run']); others = d ? fs.readdirSync(d, { withFileTypes: true }).filter((x) => x.isDirectory() && x.name !== runId).map((x) => x.name) : []; } catch (e) { failFs(e); }
  const unresolved = others
    .map((id) => { let j = null; try { validateRunId(id); j = loadJournalOf(id); } catch { return null; } return { runId: id, state: runState(j) }; })
    .filter((r) => r && (r.state === 'partial' || r.state === 'rollback-incomplete' || r.state === 'rollback-in-progress'));
  if (unresolved.length) {
    fail(`${action} refused: another run left the repository unresolved`, 7, { unresolved, next: 'Run `apply.mjs rollback --run-id <that run>` (repeat after resolving skipped files) or, with the user, `cleanup --confirm-manual-resolution`.' });
  }
}

const saveRunJson = (rel, obj) => writeInRepo(root, rel, JSON.stringify(obj, null, 2) + '\n', { createDirs: false });
const OWNERSHIP_VALUES = new Set(['full', 'blocks', 'keys', 'merged']);
const CONTROL_FILES = new Set([POLICY_REL, SETTINGS_REL]);
const lineCount = (text) => (text == null ? 0 : normalizeText(text).split('\n').length - 1);
const withEol = (buf, eol) => {
  const n = normalizeText(buf.toString('utf8'));
  return Buffer.from(eol === '\r\n' ? n.replace(/\n/g, '\r\n') : n, 'utf8');
};
const byTarget = (a, b) => (a.target < b.target ? -1 : a.target > b.target ? 1 : 0);
const isPlainObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// JSON equality ignoring object key order (plan 4.5: records are compared as JSON values); array order counts.
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : isPlainObj(v) ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));
const canonEq = (a, b) => canon(a) === canon(b);

// ------------------------------------------------------------------- lock ----
// Checking and refreshing are separate: a rejected or no-op commit checks the lock without writing its heartbeat.
function checkLock() {
  let lockDir;
  try { lockDir = secureDir(root, ['.ai', '.setup.lock']); } catch (e) { failUnsafe(e); }
  const owner = (() => { try { return readJsonFile(path.join(lockDir, 'owner.json')); } catch { return null; } })();
  if (!lockDir || !owner || owner.runId !== runId) fail('lock is not held by this run; run lock.mjs acquire first', 2, { owner });
  return owner;
}
function heartbeat(owner) {
  owner.heartbeatAt = new Date().toISOString();
  writeInRepo(root, '.ai/.setup.lock/owner.json', JSON.stringify(owner, null, 2) + '\n', { createDirs: false });
}

function dirtyPaths() {
  const r = git(['status', '--porcelain=v1', '-z'], root);
  return new Set(r.stdout.split('\0').filter(Boolean).map((l) => l.slice(3)));
}

/** Ensure the target's parent directories are real directories inside the repo, creating them if needed. */
function ensureParent(rel) {
  const dir = path.posix.dirname(rel);
  if (dir !== '.') secureDirRel(root, dir, { create: true });
}

// ---------------------------------------------------------------- user-content rules
const trimTrailingBlank = (lines) => { const out = [...lines]; while (out.length && out[out.length - 1] === '') out.pop(); return out; };

/** null if the draft only adds new managed blocks to the current text; otherwise the reason. */
function onlyAddsBlocks(curText, draftText) {
  const cur = outsideContent(curText);
  const nxt = outsideContent(draftText);
  if (cur.errors.length) return `current file has broken markers: ${cur.errors.join('; ')}`;
  if (nxt.errors.length) return `draft has broken markers: ${nxt.errors.join('; ')}`;
  if (cur.ids.some((id) => !nxt.ids.includes(id))) return 'draft removes a managed block';
  if (!sameJson(nxt.ids.filter((id) => cur.ids.includes(id)), cur.ids)) return 'draft reorders managed blocks';
  const added = new Set(nxt.ids.filter((id) => !cur.ids.includes(id)));
  const kept = [];
  for (const line of normalizeText(nxt.outside).split('\n')) {
    const m = line.match(/^<<project-setup block (.+)>>$/);
    if (m && added.has(m[1])) { if (kept.length && kept[kept.length - 1] === '') kept.pop(); continue; }
    kept.push(line);
  }
  const before = trimTrailingBlank(normalizeText(cur.outside).split('\n'));
  return sameJson(trimTrailingBlank(kept), before) ? null : 'draft changes content outside managed blocks';
}

/** null if the settings draft keeps every user key/value and only appends to permissions.allow/deny. */
function settingsPreserved(curText, draftText) {
  let cur; let nxt;
  try { cur = JSON.parse(curText.replace(/^\uFEFF/, '')); } catch { return 'current .claude/settings.json is not valid JSON'; }
  try { nxt = JSON.parse(draftText.replace(/^\uFEFF/, '')); } catch { return 'draft .claude/settings.json is not valid JSON'; }
  if (!isPlainObj(cur) || !isPlainObj(nxt)) return 'settings root must be an object';
  for (const k of new Set([...Object.keys(cur), ...Object.keys(nxt)])) {
    if (k === 'permissions') continue;
    if (k === '$schema' && !('$schema' in cur)) continue; // the merge may add $schema to a file that had none
    if (!sameJson(cur[k], nxt[k])) return `draft changes user settings key "${k}"`;
  }
  // A present-but-malformed value is still the user's content: replacing or "repairing" it needs approval.
  if ('permissions' in cur && !isPlainObj(cur.permissions)) {
    return sameJson(cur.permissions, nxt.permissions) ? null : 'draft replaces a malformed user permissions value';
  }
  if ('permissions' in nxt && !isPlainObj(nxt.permissions)) return 'draft permissions value is not an object';
  const cp = isPlainObj(cur.permissions) ? cur.permissions : {};
  const np = isPlainObj(nxt.permissions) ? nxt.permissions : {};
  for (const k of new Set([...Object.keys(cp), ...Object.keys(np)])) {
    if (k === 'allow' || k === 'deny') {
      if (k in cp && !Array.isArray(cp[k])) {
        if (!sameJson(cp[k], np[k])) return `draft replaces a malformed user permissions.${k} value`;
        continue;
      }
      if (k in np && !Array.isArray(np[k])) return `draft permissions.${k} is not an array`;
      const a = cp[k] ?? []; const b = np[k] ?? [];
      if (!sameJson(b.slice(0, a.length), a)) return `draft removes or reorders existing permissions.${k} entries`;
    } else if (!sameJson(cp[k], np[k])) return `draft changes permissions.${k}`;
  }
  return null;
}

/**
 * User content protection. Anything the skill does not own may only GAIN new managed blocks; every other change to it
 * (including replacing a pre-existing file) needs the user's explicit --approve-user-content.
 */
function contentReasons(rel, curBuf, draftBuf, entry) {
  const reasons = [];
  const curText = curBuf.toString('utf8'); // in-process only; never printed (secret paths included)
  const draft = draftBuf.toString('utf8');
  if (rel === SETTINGS_REL) {
    const why = settingsPreserved(curText, draft);
    if (why) reasons.push(why);
  } else if (entry?.ownership === 'full') {
    if (normalizedHash(curText) !== entry.sha256) reasons.push('fully managed file was edited by the user since install');
  } else if (entry?.ownership === 'merged' && !outsideContent(curText).ids.length) {
    // Living doc the skill created or already merged: reviewed through the plan diff.
  } else {
    const why = onlyAddsBlocks(curText, draft);
    if (why) reasons.push(entry ? why : `${why} (pre-existing file the skill does not own)`);
  }
  return reasons;
}

// -------------------------------------------------------- inventory and reads ----
/** Every source in the run, sorted by target. A link anywhere below drafts/ or vault/files/ is refused (exit 2). */
function inventory() {
  const sources = [];
  for (const [origin, segs] of [['draft', ['drafts']], ['vault', ['vault', 'files']]]) {
    const dir = ioTagged([...RUN, ...segs].join('/'), () => runSub(...segs));
    if (!dir) continue;
    const stack = [[dir, []]];
    while (stack.length) {
      const [d, rel] = stack.pop();
      for (const name of ioTagged(toPosix(path.relative(root, d)), () => fs.readdirSync(d))) {
        const full = path.join(d, name);
        const st = ioTagged(toPosix(path.relative(root, full)), () => fs.lstatSync(full));
        if (st.isSymbolicLink()) throw unsafeAt(full, 'link inside run directory rejected');
        if (st.isDirectory()) stack.push([full, [...rel, name]]);
        else sources.push({ target: [...rel, name].join('/'), origin, source: [...segs, ...rel, name].join('/') });
      }
    }
  }
  return sources.sort((a, b) => byTarget(a, b) || (a.origin < b.origin ? -1 : a.origin > b.origin ? 1 : 0));
}

const isEnoent = (e) => e && (e.code === 'ENOENT' || /directory missing/.test(e.message));

/** Raw bytes of a run file, or null when absent. Unsafe paths throw; any other read failure is { io }. */
function readRunFile(name) {
  try { return { buf: readInRepo(root, `${RUN_REL}/${name}`) }; } catch (e) {
    if (isUnsafe(e)) throw e;
    if (isEnoent(e)) return { buf: null };
    return { io: `${RUN_REL}/${name}` };
  }
}

/** Raw hash of a project file (null when absent). Unsafe paths throw; any other read failure is { io }. */
function projectHash(rel) {
  const { abs } = ioTagged(rel, () => safeResolve(root, rel));
  try { return { sha: rawFileHash(abs) }; } catch { return { io: rel }; }
}

const runFileSha = (name) => { const r = readRunFile(name); return r.io ? undefined : r.buf === null ? null : sha256(r.buf); };

/** The prior manifest, validated by the shared reader; { error } when it is not valid (never its body). */
function loadPriorManifest() {
  const r = (() => { try { return { buf: readInRepo(root, MANIFEST_REL) }; } catch (e) { if (isUnsafe(e)) throw e; return isEnoent(e) ? { buf: null } : { io: MANIFEST_REL }; } })();
  if (r.io) return { io: r.io };
  if (r.buf === null) return { manifest: null, sha: null };
  let value;
  try { value = JSON.parse(r.buf.toString('utf8').replace(/^\uFEFF/, '')); } catch {
    return { error: { code: 'MANIFEST_INVALID', error: 'MANIFEST_INVALID: invalid manifest' } };
  }
  try { return { manifest: readManifest(value).manifest, sha: sha256(r.buf) }; } catch (e) {
    if (!Array.isArray(e.issues)) throw e;
    return { error: { code: e.code, error: e.message } };
  }
}

/**
 * The refusal set (plan 6.2, D2): the shipped spec plus the installed project policy when present, both through C1.
 * The drafted policy is not part of it. A malformed installed policy fails closed with C1's own code and message.
 */
function loadRefusalSet() {
  const { abs } = safeResolve(root, POLICY_REL);
  let buf = null;
  try { buf = fs.readFileSync(abs); } catch (e) { if (e.code !== 'ENOENT') return { io: POLICY_REL }; }
  const policies = [spec];
  if (buf !== null) {
    try { policies.push(parseSecurityPolicy(buf.toString('utf8')).policy); } catch (e) {
      if (!(e instanceof Error) || typeof e.code !== 'string' || !e.code.startsWith('POLICY_')) throw e;
      return { error: { code: e.code, error: e.message } };
    }
  }
  return { isSecret: (rel) => policies.some((p) => isSecretPath(rel, p)), sha: buf === null ? null : sha256(buf) };
}

/**
 * The per-target checks that need no body (plan 6.2, decision I2-2), shared by prepare, the unprepared review and the
 * prepared review, in one order: path safety (throws, exit 2), the drafted manifest, the common refusal set, write
 * denial and scope, vault eligibility, the target type. Returns { code, error } for a refusal, else { abs, exists }.
 */
function checkSource(s, isSecret, mode) {
  const t = s.target;
  try { validateRepoPath(t); } catch { throw Object.assign(new Error('unsafe target'), { unsafePath: `${RUN_REL}/${s.source}` }); }
  const { abs } = ioTagged(t, () => safeResolve(root, t));
  if (t === MANIFEST_REL) return { code: 'APPLY_MANIFEST_DRAFT', error: 'the manifest is written by commit, not drafted' };
  if (s.origin === 'draft' && isSecret(t)) {
    return { code: 'APPLY_SECRET_TARGET', error: mode === 'diff' ? `refusing textual diff of secret target: ${t}` : 'agent drafts may not target secret-pattern paths' };
  }
  if (matchesAny(t, WRITE_DENYLIST)) return { code: 'APPLY_WRITE_DENIED', error: `write denied by policy: ${t}` };
  if (!matchesAny(t, WRITE_ALLOWLIST)) return { code: 'APPLY_WRITE_SCOPE', error: `write outside documentation scope: ${t}` };
  // The vault exists for env templates produced by env-keys.mjs. Nothing else may come from it.
  if (s.origin === 'vault' && !ENV_TEMPLATE_RE.test(t)) return { code: 'APPLY_VAULT_TARGET', error: 'vault files may only target .env.example/.env.sample/.env.template' };
  let st = null;
  try { st = fs.lstatSync(abs); } catch (e) { if (e.code !== 'ENOENT') throw Object.assign(e, { ioPath: t }); }
  if (st && !st.isFile()) return { code: 'APPLY_TARGET_TYPE', error: 'target is not a regular file' };
  return { abs, exists: st !== null };
}

/**
 * Plan 4.1 rules for a declared transaction input (structurally valid already): never under the run area or the lock,
 * never in the refusal set, never write-denied, always inside the write scope. Shared by prepare and plan loading.
 */
function declaredInputRefusal(p, isSecret) {
  const lower = p.toLowerCase();
  if (['.ai/.run', '.ai/.setup.lock'].some((d) => lower === d || lower.startsWith(`${d}/`)) || isSecret(p)) return { code: 'APPLY_PATH', error: `unsafe path: ${p}` };
  if (matchesAny(p, WRITE_DENYLIST)) return { code: 'APPLY_WRITE_DENIED', error: `write denied by policy: ${p}` };
  if (!matchesAny(p, WRITE_ALLOWLIST)) return { code: 'APPLY_WRITE_SCOPE', error: `write outside documentation scope: ${p}` };
  return null;
}

// Plan 4.1: the request containers. Values inside them are validated per target by the shared readers.
const REQUEST_SHAPES = {
  'ownership.json': isPlainObj,
  'managed-keys.json': isPlainObj,
  'omissions.json': isPlainObj,
  'manifest-metadata.json': (v) => isPlainObj(v) && Object.keys(v).every((k) => k === 'codexSnippetSha256')
    && (!hasOwn(v, 'codexSnippetSha256') || (typeof v.codexSnippetSha256 === 'string' && HEX64.test(v.codexSnippetSha256))),
  'transaction-inputs.json': (v) => Array.isArray(v) && v.every((x) => typeof x === 'string'),
};

const ownershipReason = (target) => (target === POLICY_REL ? R_POLICY : target === SETTINGS_REL ? R_SETTINGS : GENERIC_REASON);
const SPECIFIC_FIELDS = ['ownership', 'sha256', 'blocks', 'managed', 'omissions'];
/** The unrelated extension fields of a record: an ownership transition replaces everything else. */
const extensions = (rec) => Object.fromEntries(Object.entries(rec || {}).filter(([k]) => !SPECIFIC_FIELDS.includes(k)));
const appendOnly = (before, after) => {
  const a = before || []; const b = after || [];
  return b.length >= a.length && a.every((x, i) => canonEq(x, b[i]));
};

/**
 * Validates and evaluates one run: inventory, refusal set, requests, per-target checks, then (only when no request is
 * malformed) the target and source bodies, the content operations and the metadata operations. Shared by prepare and
 * by the unprepared review, so both refuse the same things. Returns { entries } when anything is rejected, one entry
 * per affected target (first error wins: structural and request errors precede approval errors).
 *   mode "prepare": approvals are evaluated and declared inputs are hashed.
 *   mode "diff":    nothing is approved; the secret refusal has its review wording.
 */
function analyze(mode, approvals = new Set()) {
  const entries = new Map();
  let stop = false;
  const reject = (target, code, error, extra = {}) => { if (!entries.has(target)) entries.set(target, { target, code, error, ...extra }); };
  const rejectRequest = (...a) => { stop = true; reject(...a); };
  const ioReject = (target, ioPath) => reject(target, 'APPLY_INPUT_IO', `cannot read transaction input: ${ioPath}`, { ioPath });
  const done = () => ({ entries: [...entries.values()].sort(byTarget) });

  const sources = inventory();
  const priorState = loadPriorManifest();
  if (priorState.io) { ioReject(MANIFEST_REL, priorState.io); return done(); }
  if (priorState.error) { reject(MANIFEST_REL, priorState.error.code, priorState.error.error, { control: true }); return done(); }
  const priorFiles = priorState.manifest ? priorState.manifest.files : {};
  const refusal = loadRefusalSet();
  if (refusal.io) { ioReject(POLICY_REL, refusal.io); return done(); }
  if (refusal.error) { reject(POLICY_REL, refusal.error.code, refusal.error.error, { control: true }); return done(); }
  const { isSecret } = refusal;

  // Request files: presence and raw bytes are bound; a parse error never echoes the bytes or the parser.
  const requests = {};
  for (const [name] of REQUESTS) {
    const r = readRunFile(name);
    requests[name] = { sha: null, data: null };
    if (r.io) { stop = true; ioReject(name, r.io); continue; }
    if (r.buf === null) continue;
    let data;
    try { data = JSON.parse(r.buf.toString('utf8').replace(/^\uFEFF/, '')); } catch { rejectRequest(name, 'APPLY_INPUT_JSON', `invalid JSON: ${name}`); continue; }
    if (!REQUEST_SHAPES[name](data)) { rejectRequest(name, 'APPLY_INPUT_SHAPE', `invalid run metadata shape: ${name}`); continue; }
    requests[name] = { sha: sha256(r.buf), data };
  }

  // Sources: every check that needs no body, before any body is read.
  const count = new Map();
  for (const s of sources) count.set(s.target, (count.get(s.target) || 0) + 1);
  for (const s of sources) {
    const t = s.target;
    if (count.get(t) > 1) { reject(t, 'APPLY_DUPLICATE_TARGET', 'target appears in both drafts and vault'); continue; }
    const c = checkSource(s, isSecret, mode);
    if (c.code) { reject(t, c.code, c.error); continue; }
    s.abs = c.abs;
    s.exists = c.exists;
  }

  // Metadata requests per target. Every drafted target counts as known, including rejected ones, so one rejection
  // never cascades into misleading errors; a declared input never makes a target known.
  const known = new Set([...sources.map((s) => s.target), ...Object.keys(priorFiles)]);
  const req = new Map();
  for (const [name, field] of [['ownership.json', 'own'], ['managed-keys.json', 'managed'], ['omissions.json', 'omissions']]) {
    const data = requests[name].data;
    if (!data) continue;
    for (const [t, v] of Object.entries(data)) {
      try { validateRepoPath(t); } catch { rejectRequest(name, 'APPLY_PATH', `unsafe path: ${t}`); continue; }
      if (!known.has(t)) { rejectRequest(t, 'APPLY_METADATA_UNKNOWN', `metadata target is not in this plan or manifest: ${t}`); continue; }
      if (!req.has(t)) req.set(t, {});
      req.get(t)[field] = v;
    }
  }
  for (const [t, q] of [...req].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (entries.has(t)) continue;
    if (hasOwn(q, 'own') && (!OWNERSHIP_VALUES.has(q.own) || (q.own === 'keys' && !CONTROL_FILES.has(t)))) {
      rejectRequest(t, 'APPLY_OWNERSHIP_VALUE', `${t}: invalid ownership "${q.own}"`);
      continue;
    }
    try {
      if (hasOwn(q, 'managed')) q.managed = readManagedMetadata(t, q.managed);
      if (hasOwn(q, 'omissions')) q.omissions = readOmissions(t, q.omissions);
    } catch (e) {
      if (!(e instanceof Error) || typeof e.code !== 'string') throw e;
      rejectRequest(t, e.code, e.message);
    }
  }

  // Declared inputs: unique, structurally valid paths in the documentation/configuration scope; never a secret or
  // run-internal path. Their hashes are computed here, never taken from the caller.
  const declared = [];
  const inputs = requests['transaction-inputs.json'].data;
  if (inputs) {
    const seen = new Set();
    for (const p of inputs) {
      const IN = 'transaction-inputs.json';
      try { validateRepoPath(p); } catch { rejectRequest(IN, 'APPLY_PATH', `unsafe path: ${p}`); continue; }
      if (seen.has(p)) { rejectRequest(IN, 'APPLY_INPUT_SHAPE', `invalid run metadata shape: ${IN}`); continue; }
      seen.add(p);
      const refused = declaredInputRefusal(p, isSecret);
      if (refused) { rejectRequest(p, refused.code, refused.error); continue; }
      if (p !== MANIFEST_REL) declared.push(p); // the manifest is bound by its own precondition
    }
  }
  // Malformed requests stop here: no project body is read for a run whose approval inputs are not even well formed.
  if (stop) return done();

  // Bodies and content operations.
  const dirty = mode === 'prepare' ? dirtyPaths() : new Set();
  const ops = [];
  for (const s of sources) {
    const t = s.target;
    if (entries.has(t) || !s.abs) continue;
    let cur = null;
    if (s.exists) { try { cur = fs.readFileSync(s.abs); } catch { ioReject(t, t); continue; } }
    let draft;
    try { draft = readInRepo(root, `${RUN_REL}/${s.source}`); } catch (e) { if (isUnsafe(e)) throw e; ioReject(t, `${RUN_REL}/${s.source}`); continue; }
    const secret = isSecret(t);
    const action = cur === null ? 'create' : normalizeText(cur) === normalizeText(draft) ? 'unchanged' : 'modify';
    const reasons = action === 'modify' ? contentReasons(t, cur, draft, priorFiles[t]) : [];
    ops.push({
      target: t,
      origin: s.origin,
      source: s.source,
      sourceSha256: sha256(draft),
      action,
      preRawSha: cur === null ? null : sha256(cur),
      eol: cur !== null ? detectEol(cur.toString('utf8')) : '\n',
      linesBefore: cur !== null && !secret ? lineCount(cur.toString('utf8')) : null,
      linesAfter: s.origin === 'vault' ? null : lineCount(draft.toString('utf8')),
      uncommittedUserChanges: dirty.has(t),
      userContentChange: reasons.length > 0,
      userContentReasons: reasons,
      cur, draft, secret, // in-process only; stripped before the plan is written
    });
  }

  // Manifest records (plan 4.1, 4.2, 4.4). Automatic records of content writes are bookkeeping, never metadata
  // operations; an explicit change of a recorded record, an omission, or explicit keys ownership of an unchanged
  // unrecorded control file is one file operation per target. Nothing is inferred from current file bytes.
  const opOf = new Map(ops.map((o) => [o.target, o]));
  const files = { ...priorFiles };
  const fileOps = [];
  const metaReasons = new Map();
  const autoRecord = (t, ownership, outBuf, base, secret) => {
    const ext = extensions(base);
    if (secret) return { ownership: 'merged', note: SECRET_NOTE, ...ext };
    const text = outBuf.toString('utf8');
    if (ownership === 'full') return { ownership, sha256: normalizedHash(text), ...ext };
    if (ownership === 'blocks') return { ownership, blocks: blockHashes(text).hashes, ...ext };
    if (ownership === 'keys') return { ...base, ownership };
    return { ownership: 'merged', ...ext };
  };
  // v2 inference, used only for a written target with no explicit and no prior ownership.
  const infer = (t, outBuf, action) => {
    const hasBlocks = Object.keys(blockHashes(outBuf.toString('utf8')).hashes).length > 0;
    const living = /^(docs\/|\.ai\/context\/|\.ai\/decisions\/)/.test(t) || t === 'TODO.md' || t === 'README.md';
    if (living && !hasBlocks) return 'merged';
    return hasBlocks ? 'blocks' : action === 'create' ? 'full' : 'merged';
  };
  const targets = [...new Set([...ops.map((o) => o.target), ...req.keys()])].sort();
  for (const t of targets) {
    if (entries.has(t)) continue;
    const op = opOf.get(t);
    const write = Boolean(op) && op.action !== 'unchanged';
    const q = req.get(t) || {};
    const hasOwnership = hasOwn(q, 'own'); const hasM = hasOwn(q, 'managed'); const hasO = hasOwn(q, 'omissions');
    const prior = hasOwn(priorFiles, t) ? priorFiles[t] : null;
    const outBuf = write ? withEol(op.draft, op.eol) : null;
    const autoOwn = prior ? prior.ownership : write ? infer(t, outBuf, op.action) : null;
    const auto = write ? autoRecord(t, autoOwn, outBuf, prior || {}, op.secret) : prior;
    if (!hasOwnership && !hasM && !hasO) { if (auto) files[t] = auto; continue; }

    const resulting = hasOwnership ? q.own : autoOwn;
    if ((hasM || hasO) && resulting !== 'keys') { reject(t, 'APPLY_METADATA_OWNERSHIP', `managed or omission metadata requires keys ownership: ${t}`); continue; }
    // Without a content write, the only supported ownership change is an approved move of a control file into keys.
    // Generic re-baselining of an unchanged file, and leaving keys without a write, are not supported.
    if (hasOwnership && !write && q.own !== (prior ? prior.ownership : null) && q.own !== 'keys') {
      reject(t, 'APPLY_METADATA_TARGET', `metadata-only adoption is not supported for ${t}`);
      continue;
    }
    let after;
    if (resulting === 'keys') {
      const kept = prior && prior.ownership === 'keys' ? prior : null;
      let managed;
      // A settings request patches its present fields; a policy request is a complete container and replaces it.
      if (hasM) managed = t === SETTINGS_REL ? { ...(kept ? kept.managed : {}), ...q.managed } : q.managed;
      else if (kept) managed = kept.managed;
      else if (t === SETTINGS_REL) managed = {};
      else { reject(t, 'APPLY_METADATA_REQUIRED', `policy keys ownership requires complete managed metadata: ${t}`); continue; }
      let omissions = kept && hasOwn(kept, 'omissions') ? kept.omissions : undefined;
      if (hasO && Object.keys(q.omissions).length) omissions = { ...(omissions || {}), ...q.omissions };
      after = { ...extensions(prior), ownership: 'keys', managed, ...(omissions !== undefined ? { omissions } : {}) };
    } else {
      after = write ? autoRecord(t, resulting, outBuf, prior || {}, op.secret) : prior;
    }
    files[t] = after;

    let reasons = null;
    if (prior) {
      if (!canonEq(after, auto)) {
        reasons = [];
        let changed = after.ownership !== prior.ownership;
        if (!changed && after.ownership === 'keys') {
          changed = t === SETTINGS_REL
            ? ['permissions.allow', 'permissions.deny', 'hooks'].some((f) => !appendOnly(prior.managed[f], after.managed[f]))
            : prior.managed.schema !== after.managed.schema || !appendOnly(prior.managed.patterns, after.managed.patterns);
        }
        if (changed) reasons.push(ownershipReason(t));
        if (!canonEq(prior.omissions, after.omissions)) reasons.push(R_OMIT);
      }
    } else if (!write) {
      reasons = [ownershipReason(t), ...(after.omissions !== undefined ? [R_OMIT] : [])];
    } else if (after.omissions !== undefined) {
      reasons = [R_OMIT]; // C2-P3-1: an omission always needs approval, also as initial metadata of a written target
    }
    if (reasons) {
      fileOps.push({ kind: 'file', target: t, before: prior, after, requiresApproval: reasons.length > 0, reasons });
      if (reasons.length) metaReasons.set(t, reasons);
    }
  }

  // Approvals (plan 4.5): one path approval covers content and metadata reasons; anything else is refused by name.
  if (mode === 'prepare') {
    const need = new Map();
    for (const o of ops) if (o.userContentChange && !entries.has(o.target)) need.set(o.target, { content: o.userContentReasons, meta: [] });
    for (const [t, reasons] of metaReasons) if (!entries.has(t)) need.set(t, { content: need.get(t)?.content || [], meta: reasons });
    const rejectedBefore = new Set(entries.keys());
    for (const a of approvals) if (!need.has(a) && !rejectedBefore.has(a)) reject(a, 'APPLY_APPROVAL_UNRELATED', '--approve-user-content names files that do not need it; refusing broad approvals');
    for (const [t, { content, meta }] of need) {
      if (approvals.has(t)) continue;
      const error = content.length
        ? `${[...content, ...meta].join('; ')}. Show the diff; re-run prepare with --approve-user-content ${t} only after the user approves it`
        : `metadata changes require --approve-user-content ${t}`;
      reject(t, 'APPLY_APPROVAL_REQUIRED', error);
    }
  }
  if (entries.size) return done();

  // Bound inputs: every content target, every file metadata target, declared inputs and the installed policy.
  const bound = new Map();
  if (mode === 'prepare') {
    for (const o of ops) bound.set(o.target, o.preRawSha);
    if (!bound.has(POLICY_REL)) bound.set(POLICY_REL, refusal.sha);
    for (const t of [...fileOps.map((m) => m.target), ...declared]) {
      if (bound.has(t)) continue;
      const h = projectHash(t);
      if (h.io) ioReject(t, h.io); else bound.set(t, h.sha);
    }
    if (entries.size) return done();
  }
  return { entries: [], ops, fileOps, files, prior: priorState.manifest, priorSha: priorState.sha, requests, sources, bound, isSecret };
}

// ------------------------------------------------------------- plan reading ----
const isHexOrNull = (v) => v === null || (typeof v === 'string' && HEX64.test(v));
const isStrArr = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isRepoPath = (v) => { try { validateRepoPath(v); return true; } catch { return false; } };
const validOp = (o) => isPlainObj(o) && isRepoPath(o.target) && (o.origin === 'draft' || o.origin === 'vault')
  && o.source === `${o.origin === 'vault' ? 'vault/files' : 'drafts'}/${o.target}` && typeof o.sourceSha256 === 'string' && HEX64.test(o.sourceSha256)
  && ['create', 'modify', 'unchanged'].includes(o.action) && isHexOrNull(o.preRawSha) && (o.eol === '\n' || o.eol === '\r\n');
const validMetaOp = (m) => isPlainObj(m) && (m.kind === 'file' ? isRepoPath(m.target) : m.kind === 'manifest' && m.target === MANIFEST_REL)
  && (m.before === null || isPlainObj(m.before)) && isPlainObj(m.after) && typeof m.requiresApproval === 'boolean' && isStrArr(m.reasons);
function validPlan(p) {
  if (typeof p.runId !== 'string' || typeof p.mode !== 'string' || !isStrArr(p.agents) || typeof p.skillVersion !== 'string') return false;
  if (!(p.head === null || typeof p.head === 'string') || !isHexOrNull(p.manifestPreRawSha)) return false;
  if (!isPlainObj(p.metadata) || !REQUESTS.every(([, k]) => hasOwn(p.metadata, k) && isHexOrNull(p.metadata[`${k}Sha256`]))) return false;
  if (!Array.isArray(p.ops) || !p.ops.every(validOp) || !Array.isArray(p.metadataOps) || !p.metadataOps.every(validMetaOp)) return false;
  if (!Array.isArray(p.inputs) || !p.inputs.every((i) => isPlainObj(i) && isRepoPath(i.target) && isHexOrNull(i.preRawSha))) return false;
  if (!Array.isArray(p.sourceInventory) || !p.sourceInventory.every((s) => isPlainObj(s) && isRepoPath(s.target) && (s.origin === 'draft' || s.origin === 'vault'))) return false;
  // Work and the manifest to write go together: a plan with work always carries the exact manifest (plan 4.3).
  const work = p.ops.some((o) => o.action !== 'unchanged') || p.metadataOps.length > 0;
  if (work !== (p.manifestAfter !== null)) return false;
  if (p.manifestAfter !== null) { try { if (readManifest(p.manifestAfter).sourceSchema !== 3) return false; } catch { return false; } }
  return true;
}
/** Plan 4.6 step 4: a pre-C2 plan is APPLY_PLAN_SCHEMA, a malformed one APPLY_PLAN_INVALID (exit 1); another run's is exit 4. */
function loadPlan(buf) {
  let plan;
  try { plan = JSON.parse(buf.toString('utf8')); } catch { failCode('APPLY_PLAN_INVALID', 'invalid prepared plan; run prepare again', 1); }
  if (!isPlainObj(plan)) failCode('APPLY_PLAN_INVALID', 'invalid prepared plan; run prepare again', 1);
  if (plan.planSchema !== 2) failCode('APPLY_PLAN_SCHEMA', 'unsupported prepared plan; run prepare again', 1);
  if (!validPlan(plan) || !validBindings(plan)) failCode('APPLY_PLAN_INVALID', 'invalid prepared plan; run prepare again', 1);
  if (plan.runId !== runId) fail('plan belongs to another run', 4);
  return plan;
}

// The refusal set for plan checks, loaded once per process. An unreadable installed policy is an input failure; a
// malformed one fails closed with C1's own code, as in the unprepared review.
let refusalCache = null;
function requireRefusalSet() {
  if (refusalCache) return refusalCache;
  const r = loadRefusalSet();
  if (r.io) failIo(r.io);
  if (r.error) failCode(r.error.code, r.error.error, 3, { target: POLICY_REL });
  refusalCache = r;
  return r;
}

/**
 * Decisions I2-4, I2-5, I2-8 and I2-9: plan.json is run-local, and diff (unlike commit) knows no approved hash, so the
 * bindings it names are checked before any of them is hashed. Every embedded request value passes the reader prepare
 * used on it; inputs are unique; a content op is bound with its own preRawSha; a file metadata op targets a content op
 * or a control file; and the input targets are exactly what prepare binds: content and file-metadata targets, the
 * installed policy, and the declared inputs other than the manifest. Reads nothing but the policy.
 */
function validBindings(plan) {
  const { isSecret } = requireRefusalSet();
  const md = plan.metadata;
  for (const [name, k] of REQUESTS) {
    const v = md[k];
    if ((md[`${k}Sha256`] === null) !== (v === null)) return false;
    if (v !== null && !REQUEST_SHAPES[name](v)) return false;
  }
  try {
    for (const [t, v] of Object.entries(md.ownership || {})) {
      if (!isRepoPath(t) || !OWNERSHIP_VALUES.has(v) || (v === 'keys' && !CONTROL_FILES.has(t))) return false;
    }
    for (const [t, v] of Object.entries(md.managedKeys || {})) { if (!isRepoPath(t)) return false; readManagedMetadata(t, v); }
    for (const [t, v] of Object.entries(md.omissions || {})) { if (!isRepoPath(t)) return false; readOmissions(t, v); }
  } catch (e) {
    if (e instanceof Error && typeof e.code === 'string') return false;
    throw e;
  }
  const declared = md.transactionInputs || [];
  if (new Set(declared).size !== declared.length || !declared.every((p) => isRepoPath(p) && !declaredInputRefusal(p, isSecret))) return false;

  const bound = new Map();
  for (const i of plan.inputs) { if (bound.has(i.target)) return false; bound.set(i.target, i.preRawSha); }
  const fileTargets = plan.metadataOps.filter((m) => m.kind === 'file').map((m) => m.target);
  for (const o of plan.ops) if (!bound.has(o.target) || bound.get(o.target) !== o.preRawSha) return false;
  const opTargets = new Set(plan.ops.map((o) => o.target));
  if (!fileTargets.every((t) => opTargets.has(t) || CONTROL_FILES.has(t))) return false;
  const expected = new Set([...opTargets, ...fileTargets, POLICY_REL, ...declared.filter((p) => p !== MANIFEST_REL)]);
  return bound.size === expected.size && [...expected].every((t) => bound.has(t));
}

/**
 * Rechecks every binding of a prepared plan (plan 5.3) and returns the drift rows, in category order: the source
 * inventory, targets and inputs by target, source bodies by target, request files in file order, the manifest. A link
 * or junction throws instead (exit 2 before any drift report). Shared by diff and commit.
 */
function bindingDrift(plan) {
  const rows = [];
  const key = (s) => `${s.origin}\0${s.target}`;
  const now = inventory();
  const present = new Set(now.map(key));
  if (!sameJson(now.map(key).sort(), plan.sourceInventory.map(key).sort())) rows.push({ target: RUN_REL, what: DRIFT.inventory });
  const targetRole = new Set([...plan.ops.map((o) => o.target), ...plan.metadataOps.filter((m) => m.kind === 'file').map((m) => m.target)]);
  for (const input of [...plan.inputs].sort(byTarget)) {
    const h = projectHash(input.target);
    if (h.io || h.sha !== input.preRawSha) rows.push({ target: input.target, what: targetRole.has(input.target) ? DRIFT.target : DRIFT.input });
  }
  for (const op of [...plan.ops].sort(byTarget)) {
    if (!present.has(key(op))) continue; // a removed source is reported once, by the inventory row
    const r = readRunFile(op.source);
    if (r.io || r.buf === null || sha256(r.buf) !== op.sourceSha256) rows.push({ target: op.target, what: DRIFT.source });
  }
  for (const [name, k] of REQUESTS) if (runFileSha(name) !== plan.metadata[`${k}Sha256`]) rows.push({ target: name, what: DRIFT.request });
  const m = projectHash(MANIFEST_REL);
  if (m.io || m.sha !== plan.manifestPreRawSha) rows.push({ target: MANIFEST_REL, what: DRIFT.manifest });
  return rows;
}

// ------------------------------------------------------------------ review ----
const TEXT = new TextDecoder('utf-8', { fatal: true });
const isText = (buf) => { if (buf.includes(0)) return false; try { TEXT.decode(buf); return true; } catch { return false; } };

/** Plan 6.5: one deterministic full-file replacement hunk over normalized text, labels JSON-quoted. */
function textDiff(target, oldBuf, newBuf) {
  const lines = (b) => normalizeText(b).split('\n').slice(0, -1);
  const o = oldBuf === null ? [] : lines(oldBuf);
  const n = lines(newBuf);
  const head = oldBuf === null ? '--- /dev/null' : `--- ${JSON.stringify(`a/${target}`)}`;
  return [head, `+++ ${JSON.stringify(`b/${target}`)}`, `@@ -${oldBuf === null ? 0 : 1},${o.length} +1,${n.length} @@`, ...o.map((l) => `-${l}`), ...n.map((l) => `+${l}`)].join('\n') + '\n';
}

/** File and vault reports. Vault files are shown only as key names and value classifications, never as text. */
function renderReview(ops) {
  const files = [];
  const vault = [];
  for (const o of [...ops].sort(byTarget)) {
    if (o.origin === 'vault') {
      vault.push({ target: o.target, action: o.action, classification: 'env-template', before: o.cur === null ? [] : classifyEnvTemplate(o.cur.toString('utf8')), after: classifyEnvTemplate(o.draft.toString('utf8')) });
      continue;
    }
    if (!isText(o.draft) || (o.cur !== null && !isText(o.cur))) failCode('APPLY_DIFF_TEXT', `cannot render non-text draft: ${o.target}`, 3);
    files.push({ target: o.target, action: o.action, diff: o.action === 'unchanged' ? null : textDiff(o.target, o.cur, o.draft) });
  }
  return { files, vault };
}

/**
 * Decisions I2-2 and I2-10: every plan op passes the per-target checks of an unprepared source, in target order, before
 * any target or draft body is read; the first refusal fails (exit 3, an unsafe path exit 2). Shared by diff and commit.
 */
function refusePlanOps(plan, mode) {
  const { isSecret } = requireRefusalSet();
  const seen = new Set();
  for (const o of [...plan.ops].sort(byTarget)) {
    if (seen.has(o.target)) failCode('APPLY_DUPLICATE_TARGET', 'target appears in both drafts and vault', 3);
    seen.add(o.target);
    const c = checkSource(o, isSecret, mode);
    if (c.code) failCode(c.code, c.error, 3);
  }
}

/**
 * Prepared review: the plan it read, its bindings rechecked, the bytes it binds rendered. The plan is run-local and diff
 * knows no approved hash, so its ops are refused exactly like unprepared sources (decision I2-2) before any target or
 * draft body is read, the binding hashes included: a rewritten plan.json can never turn diff into a reader of `.env`.
 */
function preparedReview(planBuf) {
  const plan = loadPlan(planBuf);
  inventory(); // run-chain and link safety first (exit 2)
  refusePlanOps(plan, 'diff');
  const drift = bindingDrift(plan);
  if (drift.length) failCode('APPLY_DRIFT', DRIFT_ERROR, 4, { drift });
  const ops = plan.ops.map((o) => {
    const { abs } = safeResolve(root, o.target);
    let cur = null;
    try { cur = o.preRawSha === null ? null : fs.readFileSync(abs); } catch { failCode('APPLY_DIFF_IO', `cannot read draft review input: ${o.target}`, 2); }
    const r = readRunFile(o.source);
    if (r.io || r.buf === null) failCode('APPLY_DIFF_IO', `cannot read draft review input: ${RUN_REL}/${o.source}`, 2);
    return { ...o, cur, draft: r.buf };
  });
  return { prepared: true, planSha256: sha256(planBuf), ...renderReview(ops), metadataOps: plan.metadataOps, metadataRequests: null };
}

/** Unprepared review: the same checks as prepare, without approvals; the first refusal, in target order, is reported. */
function unpreparedReview() {
  const a = analyze('diff');
  if (a.entries.length) {
    const io = a.entries.find((e) => e.ioPath);
    if (io) failCode('APPLY_DIFF_IO', `cannot read draft review input: ${io.ioPath}`, 2);
    const e = a.entries[0];
    failCode(e.code, e.error, 3, e.control ? { target: e.target } : {});
  }
  const data = (name) => a.requests[name].data;
  return {
    prepared: false, planSha256: null, ...renderReview(a.ops), metadataOps: null,
    metadataRequests: { ownership: data('ownership.json'), managedKeys: data('managed-keys.json'), omissions: data('omissions.json'), manifestMetadata: data('manifest-metadata.json'), transactionInputs: data('transaction-inputs.json') },
  };
}

// ------------------------------------------------------------------ init ----
if (cmd === 'init') {
  ok({ runDir: toPosix(path.relative(root, runDir)), drafts: toPosix(path.relative(root, path.join(runDir, 'drafts'))) });
}

// ------------------------------------------------------------------ diff ----
// Read-only: no lock read or heartbeat, no directory creation, no plan, no journal, no Git. The response is buffered
// until every check has passed, so a later refusal never follows an earlier safe diff.
else if (cmd === 'diff') {
  let review;
  try {
    const p = readRunFile('plan.json');
    if (p.io) failCode('APPLY_DIFF_IO', `cannot read draft review input: ${p.io}`, 2);
    review = p.buf !== null ? preparedReview(p.buf) : unpreparedReview();
  } catch (e) { if (!isFsFailure(e)) throw e; failFs(e); }
  const { prepared, planSha256, files, vault, metadataOps, metadataRequests } = review;
  ok({ root: toPosix(root), runId, prepared, planSha256, files, vault, metadataOps, metadataRequests });
}

// --------------------------------------------------------------- prepare ----
else if (cmd === 'prepare') {
  assertWritableLifecycle('prepare');
  const mode = args.mode && args.mode !== true ? String(args.mode) : fail('--mode is required');
  const agents = String(args.agents || 'claude,codex').split(',').map((s) => s.trim()).filter(Boolean);
  const approved = new Set(String(args['approve-user-content'] && args['approve-user-content'] !== true ? args['approve-user-content'] : '')
    .split(',').map((s) => s.trim().replace(/\\/g, '/')).filter(Boolean));
  let a;
  try { a = analyze('prepare', approved); } catch (e) { if (!isFsFailure(e)) throw e; failFs(e); }
  if (a.entries.length) {
    failCode('APPLY_PLAN_REJECTED', 'plan rejected', 3, { errors: a.entries.map(({ target, code, error }) => ({ target, code, error })) });
  }

  // The manifest to write (plan 3.5, 4.4): prior data with the explicit and automatic records, under the plan's
  // headers. Written only when there is real work; a genuine no-op leaves every manifest byte (mode, sourceCommit) alone.
  const head = git(['rev-parse', '--short', 'HEAD'], root).stdout || null;
  const snippet = a.requests['manifest-metadata.json'].data?.codexSnippetSha256;
  const manifestChange = Boolean(a.prior) && (a.prior.schema === 2 || (snippet !== undefined && snippet !== a.prior.codexSnippetSha256));
  const metadataOps = [...a.fileOps];
  const writes = a.ops.filter((o) => o.action !== 'unchanged');
  let manifestAfter = null;
  if (writes.length || metadataOps.length || manifestChange) {
    const known = ['schema', 'skill', 'skillVersion', 'mode', 'agents', 'sourceCommit', 'files'];
    const extra = Object.fromEntries(Object.entries(a.prior || {}).filter(([k]) => !known.includes(k)));
    const files = Object.fromEntries(Object.keys(a.files).sort().map((k) => [k, a.files[k]]));
    manifestAfter = {
      schema: 3, skill: 'project-setup', skillVersion: skillVersion(), mode, agents, sourceCommit: head,
      ...extra, ...(snippet !== undefined ? { codexSnippetSha256: snippet } : {}), files,
    };
    const headerOf = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'files'));
    // One manifest operation only for a schema-2 conversion or a changed snippet hash of an existing manifest (D4,
    // C2-P3-6); a header refresh caused by other work is not one.
    if (manifestChange) metadataOps.push({ kind: 'manifest', target: MANIFEST_REL, before: headerOf(a.prior), after: headerOf(manifestAfter), requiresApproval: false, reasons: [] });
  }
  const metadata = {};
  for (const [name, k] of REQUESTS) { metadata[`${k}Sha256`] = a.requests[name].sha; metadata[k] = a.requests[name].data; }
  const plan = {
    planSchema: 2, runId, mode, agents, skillVersion: skillVersion(), host: hostId(),
    preparedAt: new Date().toISOString(),
    head,
    manifestPreRawSha: a.priorSha,
    metadata,
    ops: a.ops.map(({ cur, draft, secret, ...op }) => op),
    metadataOps,
    inputs: [...a.bound].filter(([t]) => t !== MANIFEST_REL).map(([target, preRawSha]) => ({ target, preRawSha })).sort(byTarget),
    sourceInventory: a.sources.map(({ target, origin }) => ({ target, origin })),
    manifestAfter,
  };
  try { saveRunJson(PLAN_REL, plan); } catch (e) { failUnsafe(e); }
  ok({
    plan: PLAN_REL,
    planSha256: sha256(readInRepo(root, PLAN_REL)),
    changed: writes.length,
    unchanged: a.ops.length - writes.length,
    ops: writes.map(({ target, action, origin, linesBefore, linesAfter, uncommittedUserChanges, userContentChange, userContentReasons }) => ({ target, action, origin, linesBefore, linesAfter, uncommittedUserChanges, userContentChange, userContentReasons })),
    ownershipOverrides: a.requests['ownership.json'].data,
    metadataChanged: metadataOps.length,
    metadataOps,
    review: `Review with: node <SKILL_DIR>/scripts/apply.mjs diff --project . --run-id ${runId}. Vault files are shown only as key names and value classifications. The user approves this planSha256; pass it to commit --approved-plan.`,
  });
}

// ---------------------------------------------------------------- commit ----
// Plan 4.6 order: lock check (read-only), lifecycle, approved plan hash, plan format, path safety, the per-target
// refusals (I2-10), bindings, genuine no-op, heartbeat, then one journal for content (in plan order) and the manifest
// (last).
else if (cmd === 'commit') {
  const owner = checkLock();
  assertWritableLifecycle('commit'); // before any other check: a used run never commits again
  if (!fs.existsSync(planPath)) fail('no plan.json; run prepare first');
  const approvedSha = args['approved-plan'] && args['approved-plan'] !== true ? String(args['approved-plan']) : fail('--approved-plan <planSha256 from prepare> is required');
  let planBuf;
  try { planBuf = readInRepo(root, PLAN_REL); } catch (e) { failFs(e); }
  if (sha256(planBuf) !== approvedSha) fail('plan.json differs from the approved plan; re-run prepare and get approval again', 4);
  let plan;
  try { plan = loadPlan(planBuf); } catch (e) { if (!isFsFailure(e)) throw e; failFs(e); }

  // Every run directory must still be a real directory inside the repo, and every target path safe, before anything
  // is compared or written. (Each individual read/write re-validates again at the moment it happens.) An approved hash
  // does not make a forged op safe (decision I2-10): every op is refused like prepare would, before any body is read.
  let drift;
  try {
    for (const sub of [['drafts'], ['vault'], ['vault', 'backup']]) {
      if (!runSub(...sub)) throw Object.assign(new Error('run directory missing'), { unsafePath: [...RUN, ...sub].join('/') });
    }
    for (const op of plan.ops) ioTagged(op.target, () => safeResolve(root, op.target));
    refusePlanOps(plan, 'prepare');
    drift = bindingDrift(plan);
  } catch (e) { if (!isFsFailure(e)) throw e; failFs(e); }
  if (drift.length) failCode('APPLY_DRIFT', DRIFT_ERROR, 4, { drift });

  const ops = plan.ops.filter((o) => o.action !== 'unchanged');
  if (!ops.length && !plan.metadataOps.length) { ok({ committed: false, reason: 'nothing to change (zero diff)' }); process.exit(0); }
  heartbeat(owner);

  const journal = { runId, planSha256: approvedSha, startedAt: new Date().toISOString(), committed: false, entries: [], metadataOps: plan.metadataOps };
  if (loadJournalOf(runId)) fail('journal appeared during commit; refusing to reset it', 7);
  // Nothing has been written to the project yet: a journal that cannot be created leaves the run fresh.
  try { saveRunJson(JOURNAL_REL, journal); } catch (e) { fail(`cannot create the journal; nothing was written: ${e.message}`, 2); }
  const apply = (target, outBuf) => {
    const { abs } = safeResolve(root, target);
    ensureParent(target);
    assertNotLink(abs);
    const existed = fs.existsSync(abs);
    const entry = { target, existed, preRawSha: rawFileHash(abs), expectedWriteSha: sha256(outBuf), state: 'planned' };
    if (existed) {
      // Backup path validated from the repo root at the moment of writing (vault/backup may be a junction).
      writeInRepo(root, backupRel(target), readInRepo(root, target));
    }
    entry.state = 'backed-up';
    journal.entries.push(entry);
    saveRunJson(JOURNAL_REL, journal);
    writeInRepo(root, target, outBuf);
    entry.writtenRawSha = rawFileHash(abs);
    entry.state = 'applied';
    saveRunJson(JOURNAL_REL, journal);
  };
  try {
    // Content in the order stored in the approved plan (C3 owns reader-first ordering), never sorted again here.
    for (const op of ops) {
      const src = readInRepo(root, `${RUN_REL}/${op.source}`);
      if (sha256(src) !== op.sourceSha256) throw new Error(`draft for ${op.target} changed during commit`);
      apply(op.target, withEol(src, op.eol));
    }
    // The manifest last, exactly as approved: commit never reconstructs records from current target bytes. A
    // metadata-only run writes (and backs up) only this file.
    apply(MANIFEST_REL, Buffer.from(JSON.stringify(plan.manifestAfter, null, 2) + '\n'));
    journal.committed = true;
    journal.committedAt = new Date().toISOString();
    saveRunJson(JOURNAL_REL, journal);
    ok({ committed: true, written: journal.entries.map((e) => ({ target: e.target, created: !e.existed })), next: 'run validate.mjs, then report; keep the run dir until the user confirms (rollback needs it)' });
  } catch (e) {
    try { saveRunJson(JOURNAL_REL, journal); } catch { /* journal dir itself unsafe; report below */ }
    fail(`apply failed mid-way: ${e.message}`, 5, { appliedSoFar: journal.entries.filter((x) => x.state === 'applied').map((x) => x.target), recovery: `node apply.mjs rollback --run-id ${runId}` });
  }
}

// -------------------------------------------------------------- rollback ----
else if (cmd === 'rollback') {
  heartbeat(checkLock());
  if (!fs.existsSync(journalPath)) fail('no journal; nothing was applied by this run');
  const journal = JSON.parse(readInRepo(root, JOURNAL_REL).toString('utf8'));
  const prior = journal.rollback;
  // 1) Durably mark recovery as in progress BEFORE the first mutation. If anything later fails, crashes, or cannot
  //    be recorded, the run stays unresolved (state rollback-in-progress) instead of looking committed.
  journal.committed = false;
  journal.rollback = { at: new Date().toISOString(), inProgress: true, complete: false, attempt: (prior?.attempt ?? 0) + 1, restored: [], untouched: [], skipped: [] };
  try { saveRunJson(JOURNAL_REL, journal); } catch (e) { fail(`cannot record rollback start; nothing was changed: ${e.message}`, 6); }
  const rb = journal.rollback;
  const checkpoint = () => saveRunJson(JOURNAL_REL, journal);
  for (const e of [...journal.entries].reverse()) {
    if (e.state === 'rolled-back' || e.state === 'planned') continue;
    try {
      const { abs } = safeResolve(root, e.target);
      const cur = rawFileHash(abs);
      // Which version is on disk decides what to do. Only our own write is ever undone.
      const ours = e.state === 'applied' ? cur === e.writtenRawSha : cur === e.expectedWriteSha;
      if (!ours) {
        if (cur === e.preRawSha) { e.state = 'rolled-back'; rb.untouched.push(e.target); checkpoint(); continue; }
        rb.skipped.push({ target: e.target, reason: 'file changed after this run wrote it (or before the write landed); left untouched, backup kept' });
        continue;
      }
      if (e.existed) {
        let buf;
        try { buf = readInRepo(root, backupRel(e.target)); } catch (err) { rb.skipped.push({ target: e.target, reason: `backup unavailable or unsafe: ${err.message}` }); continue; }
        // The backup must be byte-identical to what was on disk before this run wrote the file.
        if (!e.preRawSha || sha256(buf) !== e.preRawSha) {
          rb.skipped.push({ target: e.target, reason: 'backup does not match the pre-run hash recorded in the journal (altered, truncated, or wrong file); target and backup left untouched' });
          continue;
        }
        writeInRepo(root, e.target, buf);
      } else {
        fs.rmSync(abs);
        for (let d = path.dirname(abs); d.startsWith(root) && d !== root; d = path.dirname(d)) {
          try { fs.rmdirSync(d); } catch { break; }
        }
      }
      e.state = 'rolled-back';
      rb.restored.push(e.target);
    } catch (err) {
      // Per-file I/O failure (rename/write/delete): record it, keep the backup, continue with the others.
      rb.skipped.push({ target: e.target, reason: `I/O error during restore: ${err.code || ''} ${err.message}`.trim() });
      continue;
    }
    // Checkpoint after every restored file. If progress cannot be recorded, stop: the journal still says
    // "in progress", which keeps the run unresolved and makes a later rollback resume safely (hash checks).
    try { checkpoint(); } catch (err) {
      fail(`rollback stopped: cannot record progress (${err.message}); run rollback again`, 6, { restoredSoFar: rb.restored, state: 'rollback-in-progress' });
    }
  }
  rb.inProgress = false;
  rb.complete = rb.skipped.length === 0;
  rb.finishedAt = new Date().toISOString();
  try { saveRunJson(JOURNAL_REL, journal); } catch (err) {
    fail(`rollback finished its file operations but could not record the result (${err.message}); the run stays rollback-in-progress; run rollback again`, 6, { restored: rb.restored, skipped: rb.skipped });
  }
  if (!rb.complete) fail('rollback incomplete: some files could not be restored; they and their backups were left as-is', 6, { restored: rb.restored, untouched: rb.untouched, skipped: rb.skipped });
  ok({ complete: true, restored: rb.restored, untouched: rb.untouched });
}

// ---------------------------------------------------------------- status ----
else if (cmd === 'status') {
  const plan = fs.existsSync(planPath) ? JSON.parse(readInRepo(root, PLAN_REL).toString('utf8')) : null;
  const journal = fs.existsSync(journalPath) ? JSON.parse(readInRepo(root, JOURNAL_REL).toString('utf8')) : null;
  ok({
    runId,
    state: runState(journal),
    prepared: Boolean(plan),
    planSha256: plan ? sha256(readInRepo(root, PLAN_REL)) : null,
    committed: journal?.committed ?? false,
    rolledBack: Boolean(journal?.rollback),
    rollbackComplete: journal?.rollback ? journal.rollback.complete : null,
    rollbackSkipped: journal?.rollback?.skipped ?? [],
    partial: journal ? !journal.committed && !journal.rollback && journal.entries.some((e) => e.state === 'applied' || e.state === 'backed-up') : false,
    entries: journal?.entries.map(({ target, state, existed }) => ({ target, state, existed })) ?? [],
  });
}

// --------------------------------------------------------------- cleanup ----
else if (cmd === 'cleanup') {
  // Backups are the only recovery copy. Delete them only for a run whose outcome is verified (committed and kept,
  // or fully rolled back), or when the user explicitly confirms a manual resolution.
  let journal = null;
  if (fs.existsSync(journalPath)) {
    try { journal = JSON.parse(readInRepo(root, JOURNAL_REL).toString('utf8')); } catch (e) {
      if (!args['confirm-manual-resolution']) fail(`journal unreadable (${e.message}); refusing to delete backups without --confirm-manual-resolution`, 6);
    }
  }
  const state = journal ? runState(journal) : (fs.existsSync(journalPath) ? 'unreadable' : 'fresh');
  const safe = ['fresh', 'committed', 'rolled-back', 'aborted-before-write'].includes(state);
  if (!safe && !args['confirm-manual-resolution']) {
    fail(`run is ${state}; backups are still needed. Run rollback (again), or resolve with the user and re-run cleanup with --confirm-manual-resolution`, 6, { state, skipped: journal?.rollback?.skipped ?? [] });
  }
  fs.rmSync(runDir, { recursive: true, force: true });
  ok({ removed: toPosix(path.relative(root, runDir)), state });
}

else fail('usage: apply.mjs init|diff|prepare|commit|status|rollback|cleanup --run-id <id>');
