#!/usr/bin/env node
// Merge managed permission entries and the managed raw-Git hook into .claude/settings.json. Writes a DRAFT only.
//
// Rules (see references/claude.md; plans docs/plans/2026-10-18-project-setup-v3-rc1-c3.md section 3.6 and
// docs/plans/2026-10-19-project-setup-v3-rc1-c6.md sections 2.5, 3.7-3.10):
//   - Only permissions.deny, permissions.allow and the managed PreToolUse hook are touched; every other key is left
//     byte-for-byte equivalent.
//   - User entries are never removed or reordered.
//   - Missing managed entries are APPENDED at the end of their array. Gitignore-style "!" negations carve
//     exceptions out of rules listed BEFORE them, so appending keeps user negations from weakening managed rules.
//   - A managed rule that already sits before a user negation is reported as a conflict, not "fixed".
//   - An identical pre-existing user deny stays USER-owned: reported in alreadyCovered, never claimed as managed.
//   - Ownership is never inferred from absence: a previously managed deny the renderer no longer lists keeps its bytes
//     and its ownership, and an absent retired rule is never restored. Dropping ownership removes metadata, not rules.
//   - Allow entries are only added when explicitly confirmed (--allow-file), never inferred from package.json.
//   - The raw-Git hook is added only when the reviewed guard (entrypoint and core) is staged or installed: a hook that
//     points at a missing or unreviewed file would either fail every Bash call or run code nobody reviewed. An
//     identical user hook stays user-owned (never adopted); duplicates are left alone; nothing is replaced or removed.
//
// Usage: node merge-claude-settings.mjs --run-id <id> [--allow-file <json array of rules>] [--override-user-exceptions]
//        node merge-claude-settings.mjs --run-id <id> --hooks-only
// --hooks-only (C6 plan 3.9) runs after C3's migration stage: it applies only the hook merge to the STAGED settings
// draft and patches only the hook metadata field, so C3's deny projection, ownership, omissions and decisions survive.
// Importing this module only defines mergeManagedDenies and mergeManagedHooks; the CLI runs only when the file is the
// entry point.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseArgs, repoRoot, detectEol, ok, fail, validateRunId, secureDir, writeInRepo, readInRepo, assertNotSecretInput, loadEffectivePolicy,
  loadSecretSpec, isSecretPath, normalizedHash, toPosix, SKILL_DIR,
} from './lib.mjs';
import { globsMayOverlap } from './globs.mjs';
import { renderSecurityControls } from './render-permissions.mjs';
import { hookIdentity, readManagedMetadata, readManifest, readOmissions } from './ownership.mjs';
import { policyEntryKey, readSecurityPolicy } from '../assets/tools/security-policy.mjs';

// Decision I6-3: the guard core is loaded so that its absence or a load failure is catchable. Guard readiness then fails
// with HOOK_STAGE_SOURCE, and a merge with no hook work never needs the core.
let RAW_GIT_HOOK = null;
try { ({ RAW_GIT_HOOK } = await import('../assets/tools/guard-raw-git-core.mjs')); } catch { RAW_GIT_HOOK = null; }
const coreLoaded = () => isObj(RAW_GIT_HOOK);

const SETTINGS_REL = '.claude/settings.json';
const MANIFEST_REL = '.ai/manifest.json';
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const copy = (v) => JSON.parse(JSON.stringify(v));
const isStrings = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const err = (code, detail) => Object.assign(new Error(`${code}: ${detail}`), { code });
const isNegation = (r) => /^(Read|Edit)\(!/.test(r);
const ruleTool = (r) => (r.match(/^(\w+)\(/) || [])[1];
const ruleBody = (r) => r.replace(/^\w+\(!?/, '').replace(/\)$/, '');

/**
 * Plan 2.4 / 3.6: the pure deny merge. Renders the policy's desired denies once (minus Read denies of exactly omitted
 * identities), appends the missing ones unless a may-overlap user exception holds them back, and returns the merged
 * settings, the new managed metadata, the omissions and the DenyReport. Synchronous; reads nothing; never mutates input.
 */
export function mergeManagedDenies(input) {
  const { settings, managed, policy, omissions, dropOwnership, overrideUserExceptions } = input;
  if (!isObj(settings) || (own(settings, 'permissions') && !isObj(settings.permissions))) throw err('DENY_SETTINGS', 'settings permissions must contain string arrays');
  const perms = settings.permissions || {};
  for (const k of ['deny', 'allow']) if (own(perms, k) && !isStrings(perms[k])) throw err('DENY_SETTINGS', 'settings permissions must contain string arrays');
  const prevManaged = isObj(managed) && isStrings(managed['permissions.deny']) ? managed['permissions.deny'] : [];
  const drop = isStrings(dropOwnership) ? dropOwnership : [];
  if (drop.some((r) => !prevManaged.includes(r))) throw err('DENY_OWNERSHIP_SELECTION', 'dropOwnership must name only recorded managed deny strings');

  // Settings deny omissions suppress the Read denies of exactly omitted identities (C2 identity, not overlap).
  const omittedKeys = new Set(isObj(omissions) && Array.isArray(omissions['permissions.deny']) ? omissions['permissions.deny'].map((e) => policyEntryKey(e)) : []);
  const { policy: p, effectivePatterns } = readSecurityPolicy(policy);
  const suppressed = new Set(effectivePatterns.filter((e) => omittedKeys.has(JSON.stringify([e.anchor, e.glob]))).map((e) => {
    const s = e.sources[0];
    return `Read(${e.anchor === 'root' ? '/' : ''}${p[s.collection][s.index].glob})`;
  }));
  const desired = renderSecurityControls(policy).claude.permissionsDeny.filter((r) => !suppressed.has(r) && !drop.includes(r));

  const deny = [...(perms.deny || [])];
  const userNegations = deny.filter(isNegation);
  const report = { added: [], alreadyPresent: [], alreadyCovered: [], retained: [], ownershipDropped: [], heldBack: [], conflicts: [] };
  for (const rule of desired) {
    const idx = deny.indexOf(rule);
    if (idx === -1) {
      // Appending after a user negation silently cancels that exception for every path the rule covers.
      const cancels = /^(Read|Edit)\(/.test(rule)
        // Sound overlap test: deferred unless the two patterns are provably disjoint (wildcards included).
        ? userNegations.filter((n) => ruleTool(n) === ruleTool(rule) && globsMayOverlap(ruleBody(rule), ruleBody(n)))
        : [];
      if (cancels.length) {
        report.conflicts.push({ rule, overridesUserExceptions: cancels, effect: 'appending this rule cancels the user exception(s); decision required' });
        if (!overrideUserExceptions) { report.heldBack.push(rule); continue; }
      }
      deny.push(rule); report.added.push(rule); continue;
    }
    report.alreadyPresent.push(rule);
    if (!prevManaged.includes(rule)) report.alreadyCovered.push(rule);
    const laterNegations = deny.slice(idx + 1).filter(isNegation);
    if (laterNegations.length && /^(Read|Edit)\(/.test(rule)) {
      report.conflicts.push({ rule, carvedBy: laterNegations, effect: 'user negations after this rule may exempt paths from it; review with the user' });
    }
  }
  report.retained = prevManaged.filter((r) => !drop.includes(r));
  report.ownershipDropped = [...new Set(prevManaged.filter((r) => drop.includes(r)))];
  const ownership = [...report.retained, ...report.added.filter((r, i, a) => !report.retained.includes(r) && a.indexOf(r) === i)];

  const out = copy(settings);
  if (report.added.length) out.permissions = { ...(out.permissions || {}), deny };
  return {
    settings: out,
    managed: { ...(isObj(managed) ? copy(managed) : {}), 'permissions.deny': ownership, heldBack: [...report.heldBack] },
    omissions: isObj(omissions) ? copy(omissions) : {},
    report,
  };
}

// ------------------------------------------------------------ hook merge ----
// Computed on use: the core is needed only once the hook is actually merged (I6-3).
const hookId = () => hookIdentity(RAW_GIT_HOOK);
const SKIP_READY = 'guard-raw-git.mjs not staged or installed';
const SKIP_CONTAINER = 'hooks or PreToolUse has an unsupported container; managed hook not added';
/** The identity metadata stores (plan 3.7 H), as a fresh object in event, matcher, command order. */
const hookMeta = () => ({ event: RAW_GIT_HOOK.event, matcher: RAW_GIT_HOOK.matcher, command: RAW_GIT_HOOK.command });
/** The canonical settings entry (plan 3.7 E): what is appended to hooks.PreToolUse, never what metadata records. */
const hookEntry = () => ({ matcher: RAW_GIT_HOOK.matcher, hooks: [{ type: 'command', command: RAW_GIT_HOOK.command }] });
/** An occurrence: the exact matcher on the entry and the exact command in a nested hook of type "command". */
const isOccurrence = (entry) => isObj(entry) && entry.matcher === RAW_GIT_HOOK.matcher && Array.isArray(entry.hooks)
  && entry.hooks.some((h) => isObj(h) && h.type === 'command' && h.command === RAW_GIT_HOOK.command);

/**
 * C6 plan 2.5 / 3.7: the pure hook merge. Inserts or recognizes the canonical PreToolUse hook only; there is no replace
 * or remove. Validation order: input shape (HOOK_INPUT), managed metadata through C2's reader (its errors unchanged),
 * readiness, the hooks containers, then the occurrences. Unready or unsupported containers are successful skips that
 * preserve everything. Synchronous, pure and input-preserving; the result is detached, mutable JSON.
 *   { settings, managed, guardReady } -> { settings, managed, report: { added, alreadyPresent, alreadyCovered, skipped } }
 */
export function mergeManagedHooks(input) {
  const bad = () => err('HOOK_INPUT', 'invalid hook merge input');
  if (!isObj(input)) throw bad();
  const keys = Object.keys(input).sort();
  if (keys.length !== 3 || keys[0] !== 'guardReady' || keys[1] !== 'managed' || keys[2] !== 'settings') throw bad();
  const { settings, managed, guardReady } = input;
  if (!isObj(settings) || !isObj(managed) || typeof guardReady !== 'boolean') throw bad();
  readManagedMetadata(SETTINGS_REL, managed);

  const out = copy(settings);
  const outManaged = copy(managed);
  const report = { added: [], alreadyPresent: [], alreadyCovered: [], skipped: null };
  const result = () => ({ settings: out, managed: outManaged, report });
  if (!guardReady) { report.skipped = SKIP_READY; return result(); }
  if ((own(out, 'hooks') && !isObj(out.hooks)) || (isObj(out.hooks) && own(out.hooks, 'PreToolUse') && !Array.isArray(out.hooks.PreToolUse))) {
    report.skipped = SKIP_CONTAINER;
    return result();
  }
  const owned = Array.isArray(outManaged.hooks) && outManaged.hooks.some((h) => hookIdentity(h) === hookId());
  const present = isObj(out.hooks) && Array.isArray(out.hooks.PreToolUse) && out.hooks.PreToolUse.some(isOccurrence);
  if (present) {
    // Never adopted: an identical user hook stays the user's, and duplicates are neither removed nor fatal.
    (owned ? report.alreadyPresent : report.alreadyCovered).push(hookMeta());
    return result();
  }
  // New keys go last: PreToolUse in hooks, hooks in settings (after any permissions key), hooks in the metadata.
  if (!own(out, 'hooks')) out.hooks = { PreToolUse: [hookEntry()] };
  else if (!own(out.hooks, 'PreToolUse')) out.hooks.PreToolUse = [hookEntry()];
  else out.hooks.PreToolUse.push(hookEntry());
  if (!owned) outManaged.hooks = [...(outManaged.hooks || []), hookMeta()];
  report.added.push(hookMeta());
  return result();
}

// ------------------------------------------------------- C6 staging inputs ----
// C6 plan 3.10: the staging failure envelope { ok:false, code, error, target }, stdout only, empty stderr.
const J = (v) => JSON.stringify(v, null, 2) + '\n';
function stageFail(code, error, target, exit) {
  process.stdout.write(J({ ok: false, code, error, target }));
  process.exit(exit);
}
const STAGE = {
  usage: () => stageFail('HOOK_STAGE_USAGE', 'usage: merge-claude-settings.mjs --run-id <id> --hooks-only', null, 1),
  json: (p) => stageFail('HOOK_STAGE_JSON', `invalid hook staging JSON: ${p}`, p, 3),
  metadata: (p) => stageFail('HOOK_STAGE_METADATA', `invalid hook staging metadata: ${p}`, p, 3),
  manifest: () => stageFail('HOOK_STAGE_MANIFEST', `invalid hook staging manifest: ${MANIFEST_REL}`, MANIFEST_REL, 3),
  path: (p) => stageFail('HOOK_STAGE_PATH', `unsafe hook staging path: ${p}`, p, 2),
  protected: (p) => stageFail('HOOK_STAGE_PROTECTED', `hook staging input is protected: ${p}`, p, 3),
  io: (p) => stageFail('HOOK_STAGE_IO', `cannot read hook staging input: ${p}`, p, 2),
  source: (p) => stageFail('HOOK_STAGE_SOURCE', `trusted hook source is unavailable: ${p}`, p, 3),
  write: (p) => stageFail('HOOK_STAGE_WRITE', `cannot write hook staging output: ${p}`, p, 2),
};
// The guard entrypoint and its core (C6-P2-4: both must meet the candidate rule), with their trusted skill sources.
const GUARD_UNIT = [['.ai/tools/guard-raw-git.mjs', 'assets/tools/guard-raw-git.mjs'], ['.ai/tools/guard-raw-git-core.mjs', 'assets/tools/guard-raw-git-core.mjs']];
const parseObject = (buf) => { try { const v = JSON.parse(buf.toString('utf8').replace(/^\uFEFF/, '')); return isObj(v) ? v : undefined; } catch { return undefined; } };

/**
 * Reads of the run and the project for the C6 staging paths. Every read is preceded by the shipped-plus-installed
 * refusal set check (the logical project target and the actual path), and goes through the validated directory chain
 * (a link or junction anywhere is refused, never followed). Absent is null.
 */
function stagingReader(root, policy) {
  const policies = [loadSecretSpec(), ...(policy.source === 'project' ? [policy.policy] : [])];
  const isSecret = (rel) => policies.some((p) => isSecretPath(rel, p));
  const relOf = (p) => (path.isAbsolute(p) ? toPosix(path.relative(root, p)) : toPosix(p));
  return (rel, logical = rel) => {
    if (isSecret(logical)) STAGE.protected(logical);
    if (isSecret(rel)) STAGE.protected(rel);
    try { return readInRepo(root, rel); } catch (e) {
      if (e && typeof e.unsafePath === 'string') STAGE.path(relOf(e.unsafePath));
      if (e && (e.code === 'ENOENT' || /directory missing/.test(e.message))) return null;
      return STAGE.io(rel);
    }
  };
}

/**
 * C6 plan 3.8: the hook may be ensured only when each guard file's candidate equals its trusted source under the
 * normalized hash: the run's draft when one exists (an unreviewed draft never falls back to the installed file), else
 * the installed file. Returns { ready, installed }: the targets whose readiness came from installed bytes.
 */
function guardReadiness(read, runRel) {
  const installed = [];
  for (const [target, source] of GUARD_UNIT) {
    let trusted;
    try { trusted = fs.readFileSync(path.join(SKILL_DIR, ...source.split('/'))); } catch { STAGE.source(source); }
    if (target === GUARD_UNIT[1][0] && !coreLoaded()) STAGE.source(source);
    const draft = read(`${runRel}/drafts/${target}`, target);
    const candidate = draft !== null ? draft : read(target);
    if (candidate === null || normalizedHash(candidate) !== normalizedHash(trusted)) return { ready: false, installed: [] };
    if (draft === null) installed.push(target);
  }
  return { ready: true, installed };
}

/** A run request file: null when absent; invalid JSON is HOOK_STAGE_JSON, a wrong container HOOK_STAGE_METADATA. */
function readRequest(read, rel, shape) {
  const buf = read(rel);
  if (buf === null) return null;
  let v;
  try { v = JSON.parse(buf.toString('utf8').replace(/^\uFEFF/, '')); } catch { STAGE.json(rel); }
  if (!shape(v)) STAGE.metadata(rel);
  return v;
}

/** C6-P2-1: the installed guard files the readiness relied on, appended to the declared transaction inputs. */
function inputsWrite(read, runRel, installed) {
  if (!installed.length) return null;
  const rel = `${runRel}/transaction-inputs.json`;
  const cur = readRequest(read, rel, isStrings);
  const list = cur || [];
  const next = [...list, ...installed.filter((t) => !list.includes(t))];
  return cur === null || next.length !== list.length ? [rel, J(next)] : null;
}

/** The legacy settings serialization: the original project file's indentation and EOL, no BOM, one final newline. */
function settingsText(original, value) {
  const indentMatch = original === null ? null : original.match(/\n([ \t]+)"/);
  const text = JSON.stringify(value, null, indentMatch ? indentMatch[1] : 2) + '\n';
  return original !== null && detectEol(original) === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
}

function performWrites(root, writes) {
  for (const [rel, text, createDirs] of writes) {
    try { writeInRepo(root, rel, text, { createDirs: Boolean(createDirs) }); } catch (e) {
      if (e && typeof e.unsafePath === 'string') STAGE.path(path.isAbsolute(e.unsafePath) ? toPosix(path.relative(root, e.unsafePath)) : e.unsafePath);
      STAGE.write(rel);
    }
  }
}

// ---------------------------------------------------------------- CLI ----
/** C6 plan 3.9: hooks-only staging. Every input is read and validated before the first write. */
function hooksOnlyCli(argv) {
  let runArg;
  let flags = 0;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--hooks-only') { if (flags++) STAGE.usage(); continue; }
    if (a === '--run-id') {
      const v = argv[i + 1];
      if (runArg !== undefined || v === undefined || v.startsWith('--')) STAGE.usage();
      runArg = v; i++; continue;
    }
    STAGE.usage();
  }
  if (runArg === undefined) STAGE.usage();
  let runId;
  try { runId = validateRunId(runArg); } catch (e) { fail(e.message); }
  const root = repoRoot();
  if (!root) fail('not inside a git repository');
  let runDir;
  try { runDir = secureDir(root, ['.ai', '.run', runId]); } catch (e) { fail(e.message, 2); }
  if (!runDir) fail('run not initialised; run apply.mjs init first');
  let policy;
  try { policy = loadEffectivePolicy(root); } catch (e) { if (!e.code) throw e; fail(e.message, e.code === 'POLICY_IO' ? 2 : 3); }
  const read = stagingReader(root, policy);
  const RUN = `.ai/.run/${runId}`;
  const draftRel = `${RUN}/drafts/${SETTINGS_REL}`;
  const ownRel = `${RUN}/ownership.json`;
  const keysRel = `${RUN}/managed-keys.json`;

  // 1. Installed settings and manifest.
  const installedBuf = read(SETTINGS_REL);
  const original = installedBuf === null ? null : installedBuf.toString('utf8');
  const installed = installedBuf === null ? null : parseObject(installedBuf);
  if (installed === undefined) STAGE.json(SETTINGS_REL);
  let record = null;
  const manifestBuf = read(MANIFEST_REL);
  if (manifestBuf !== null) {
    let value;
    try { value = JSON.parse(manifestBuf.toString('utf8').replace(/^\uFEFF/, '')); } catch { STAGE.manifest(); }
    try { record = readManifest(value).manifest.files[SETTINGS_REL] || null; } catch { STAGE.manifest(); }
  }
  // 2. The staged settings draft is the base when present.
  const draftBuf = read(draftRel, SETTINGS_REL);
  const staged = draftBuf === null ? null : parseObject(draftBuf);
  if (staged === undefined) STAGE.json(draftRel);
  const base = staged || installed || { $schema: 'https://json.schemastore.org/claude-code-settings.json' };
  // 3. The two request files hooks-only may patch.
  const ownership = readRequest(read, ownRel, isObj);
  const managedKeys = readRequest(read, keysRel, isObj);
  const stagedRecord = managedKeys && own(managedKeys, SETTINGS_REL) ? managedKeys[SETTINGS_REL] : undefined;
  if (stagedRecord !== undefined) { try { readManagedMetadata(SETTINGS_REL, stagedRecord); } catch (e) { if (!e.code) throw e; STAGE.metadata(keysRel); } }
  // 4. The trusted source and the selected guard candidates.
  const readiness = guardReadiness(read, RUN);
  const inputs = readiness.ready ? inputsWrite(read, RUN, readiness.installed) : null;

  // C2 field patching: the installed settings metadata with the staged request's fields over it.
  const effective = { ...(record && record.ownership === 'keys' ? record.managed : {}), ...(isObj(stagedRecord) ? stagedRecord : {}) };
  let merged;
  try { merged = mergeManagedHooks({ settings: base, managed: effective, guardReady: readiness.ready }); } catch (e) { if (!e.code) throw e; STAGE.metadata(keysRel); }

  const writes = [];
  const changed = JSON.stringify(merged.settings) !== JSON.stringify(base);
  if (changed) writes.push([draftRel, settingsText(original, merged.settings), true]);
  if (own(merged.managed, 'hooks')) {
    const owners = ownership || {};
    if (own(owners, SETTINGS_REL) && owners[SETTINGS_REL] !== 'keys') STAGE.metadata(ownRel);
    if (!own(owners, SETTINGS_REL)) writes.push([ownRel, J({ ...owners, [SETTINGS_REL]: 'keys' })]);
    const recs = managedKeys || {};
    const rec = isObj(recs[SETTINGS_REL]) ? recs[SETTINGS_REL] : {};
    const nextRec = { ...rec, hooks: merged.managed.hooks };
    if (!own(recs, SETTINGS_REL) || JSON.stringify(rec) !== JSON.stringify(nextRec)) writes.push([keysRel, J({ ...recs, [SETTINGS_REL]: nextRec })]);
  }
  if (inputs) writes.push(inputs);
  performWrites(root, writes);
  process.stdout.write(J({
    ok: true, changed, metadataChanged: writes.some(([rel]) => rel !== draftRel), needsDecision: false,
    draft: changed || draftBuf !== null ? draftRel : null, report: { hooks: merged.report },
  }));
}

function cli() {
  if (process.argv.slice(2).includes('--hooks-only')) { hooksOnlyCli(process.argv.slice(2)); return; }
  const args = parseArgs(process.argv.slice(2));
  let runId;
  try { runId = validateRunId(args['run-id']); } catch (e) { fail(e.message); }
  const root = repoRoot();
  if (!root) fail('not inside a git repository');
  let runDir;
  try { runDir = secureDir(root, ['.ai', '.run', runId]); } catch (e) { fail(e.message, 2); }
  if (!runDir) fail('run not initialised; run apply.mjs init first');
  const overrideExceptions = Boolean(args['override-user-exceptions']);

  let policy;
  let policyState;
  try { policyState = loadEffectivePolicy(root); policy = policyState.policy; } catch (e) { if (!e.code) throw e; fail(e.message, e.code === 'POLICY_IO' ? 2 : 3); }
  const allowFile = args['allow-file'] && args['allow-file'] !== true;
  let managedAllow = [];
  if (allowFile) {
    let p; try { p = assertNotSecretInput(args['allow-file']); } catch (e) { fail(e.message, 2); }
    try { managedAllow = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { fail('--allow-file is not valid JSON (content not shown)', 3); }
  }
  if (!Array.isArray(managedAllow) || managedAllow.some((x) => typeof x !== 'string')) fail('--allow-file must contain a JSON array of rule strings');
  const broadAllow = managedAllow.filter((r) => /^(Bash|PowerShell)(\(\*\))?$/.test(r) || /^(Bash|PowerShell)\([^ )]*\*\)$/.test(r));
  if (broadAllow.length) fail('refusing broad allow rules; allow specific commands only', 3, { broadAllow });

  // Decision I6-1: the installed settings and the run request files are read through the same guarded reader as
  // hooks-only staging (containment, no link or junction followed, the shipped-plus-installed refusal set on the logical
  // target and the actual path), before any content is read and before any write.
  const RUN = `.ai/.run/${runId}`;
  const read = stagingReader(root, policyState);
  const installedBuf = read(SETTINGS_REL);
  let original = null; let settings;
  if (installedBuf !== null) {
    original = installedBuf.toString('utf8');
    try { settings = JSON.parse(original.replace(/^\uFEFF/, '')); } catch (e) { fail(`.claude/settings.json is not valid JSON; refusing to merge (${e.message})`, 3); }
  } else {
    settings = { $schema: 'https://json.schemastore.org/claude-code-settings.json' };
  }

  // The installed settings record (C2): previous deny ownership and deny omissions. An invalid manifest is never used.
  let record = null;
  const mpath = path.join(root, '.ai', 'manifest.json');
  if (fs.existsSync(mpath)) {
    try { record = readManifest(JSON.parse(fs.readFileSync(mpath, 'utf8').replace(/^\uFEFF/, ''))).manifest.files[SETTINGS_REL] || null; } catch { fail('MANIFEST_INVALID: invalid manifest', 3); }
  }
  const keys = record && record.ownership === 'keys' ? record : null;
  let merged;
  try {
    merged = mergeManagedDenies({
      settings, managed: keys ? keys.managed : {}, policy, omissions: keys && keys.omissions ? readOmissions(SETTINGS_REL, keys.omissions) : {},
      dropOwnership: [], overrideUserExceptions: overrideExceptions,
    });
  } catch (e) { if (!e.code) throw e; fail(e.message, 3); }
  let out = merged.settings;
  const dr = merged.report;

  const allowAdded = []; const allowPresent = [];
  if (managedAllow.length) {
    out.permissions = { ...(out.permissions || {}) };
    const allow = [...(out.permissions.allow || [])];
    for (const rule of managedAllow) {
      if (allow.includes(rule)) { allowPresent.push(rule); continue; }
      allow.push(rule); allowAdded.push(rule);
    }
    out.permissions.allow = allow;
  }

  // C6 plan 3.9: after permission composition, ensure the managed hook when the reviewed guard is staged or installed.
  // The new C6 inputs (request files, guard candidates, transaction inputs) use the C6 staging envelopes; nothing is
  // written yet.
  const requests = { 'ownership.json': read(`${RUN}/ownership.json`), 'managed-keys.json': read(`${RUN}/managed-keys.json`) };
  const readiness = guardReadiness(read, RUN);
  const inputs = readiness.ready ? inputsWrite(read, RUN, readiness.installed) : null;
  let hooks;
  try { hooks = mergeManagedHooks({ settings: out, managed: keys ? keys.managed : {}, guardReady: readiness.ready }); } catch (e) { if (!e.code) throw e; fail(e.message, 3); }
  out = hooks.settings;

  const report = {
    added: { deny: dr.added, allow: allowAdded }, alreadyPresent: [...dr.alreadyPresent, ...allowPresent], conflicts: dr.conflicts,
    ineffective: [], malformedHooks: [], info: [], heldBack: dr.heldBack, alreadyCovered: dr.alreadyCovered,
    retainedManagedDenies: dr.retained, ownershipDropped: dr.ownershipDropped, hooks: hooks.report,
  };
  const denyNow = (out.permissions && out.permissions.deny) || [];
  const allowNow = (out.permissions && out.permissions.allow) || [];
  // Known-ineffective v1 entries: SQL is not a shell command; these patterns never match a real invocation.
  for (const rule of denyNow) {
    if (/^Bash\((DROP|TRUNCATE|DELETE|ALTER)\b/i.test(rule)) report.ineffective.push({ rule, why: 'SQL text is not a shell command; protect databases with least-privilege DB users' });
  }
  const negations = denyNow.filter(isNegation);
  if (negations.length) report.info.push({ userNegations: negations });
  const overlapping = allowNow.filter((a) => /^(Read|Edit)\(/.test(a));
  if (overlapping.length) report.info.push({ fileAllowRules: overlapping, note: 'deny is evaluated before allow, so managed Read denies still win' });
  // v1 emitted {"matcher": ..., "command": ...}; the current schema nests {"hooks":[{"type":"command","command":...}]}.
  for (const [event, entries] of Object.entries(out.hooks || {})) {
    (Array.isArray(entries) ? entries : []).forEach((h, i) => {
      if (h && typeof h === 'object' && 'command' in h && !('hooks' in h)) report.malformedHooks.push({ event, index: i, matcher: h.matcher ?? null, note: 'legacy shape; Claude Code does not run it. Ask the user: remove or convert.' });
    });
  }

  // Plan 3.6: unchanged settings VALUES keep the original bytes and create no draft.
  const changed = original === null || JSON.stringify(out) !== JSON.stringify(settings);
  if (changed) {
    try { writeInRepo(root, `.ai/.run/${runId}/drafts/.claude/settings.json`, settingsText(original, out)); } catch (e) { fail(e.message, 2); }
  }
  // Request files are merged, never replaced: other targets and other staged fields of this target survive.
  const writeMerged = (file, value) => {
    const rel = `.ai/.run/${runId}/${file}`;
    let cur = {};
    if (requests[file] !== null) { try { cur = JSON.parse(requests[file].toString('utf8')); } catch (e) { fail(`${file}: ${e.message}`, 2); } }
    cur[SETTINGS_REL] = typeof value === 'function' ? value(cur[SETTINGS_REL]) : value;
    try { writeInRepo(root, rel, JSON.stringify(cur, null, 2) + '\n', { createDirs: false }); } catch (e) { fail(e.message, 2); }
  };
  writeMerged('ownership.json', 'keys');
  // Without --allow-file no permissions.allow is requested, so existing or already staged allow ownership is kept. The
  // hook metadata field is patched only when the hook merge returns one (C6 plan 3.9).
  writeMerged('managed-keys.json', (prev) => ({
    ...(isObj(prev) ? prev : {}), 'permissions.deny': merged.managed['permissions.deny'], heldBack: merged.managed.heldBack,
    ...(allowFile ? { 'permissions.allow': managedAllow } : {}),
    ...(own(hooks.managed, 'hooks') ? { hooks: hooks.managed.hooks } : {}),
  }));
  if (inputs) performWrites(root, [inputs]);

  const needsDecision = report.conflicts.length > 0;
  // Decision I6-4 (C6-P2-1 in both modes): metadataChanged reports whether this run changed transaction-inputs.json.
  ok({
    changed, metadataChanged: inputs !== null, needsDecision,
    draft: changed ? '.ai/.run/' + runId + '/drafts/.claude/settings.json' : null,
    report,
    next: needsDecision ? 'Show conflicts to the user. Held-back rules are NOT in the draft. Re-run with --override-user-exceptions only if the user chooses to cancel their exceptions.' : undefined,
  });
}

const norm = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
if (Boolean(process.argv[1]) && norm(process.argv[1]) === norm(fileURLToPath(import.meta.url))) cli();
