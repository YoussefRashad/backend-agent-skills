#!/usr/bin/env node
// Merge managed permission entries into .claude/settings.json. Writes a DRAFT only.
//
// Rules (see references/claude.md; plan docs/plans/2026-10-18-project-setup-v3-rc1-c3.md section 3.6):
//   - Only permissions.deny and permissions.allow are touched; every other key is left byte-for-byte equivalent.
//   - User entries are never removed or reordered.
//   - Missing managed entries are APPENDED at the end of their array. Gitignore-style "!" negations carve
//     exceptions out of rules listed BEFORE them, so appending keeps user negations from weakening managed rules.
//   - A managed rule that already sits before a user negation is reported as a conflict, not "fixed".
//   - An identical pre-existing user deny stays USER-owned: reported in alreadyCovered, never claimed as managed.
//   - Ownership is never inferred from absence: a previously managed deny the renderer no longer lists keeps its bytes
//     and its ownership, and an absent retired rule is never restored. Dropping ownership removes metadata, not rules.
//   - Allow entries are only added when explicitly confirmed (--allow-file), never inferred from package.json.
//
// Usage: node merge-claude-settings.mjs --run-id <id> [--allow-file <json array of rules>] [--override-user-exceptions]
// Importing this module only defines mergeManagedDenies; the CLI runs only when the file is the entry point.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseArgs, repoRoot, detectEol, ok, fail, validateRunId, secureDir, writeInRepo, readInRepo, assertNotSecretInput, loadEffectivePolicy,
} from './lib.mjs';
import { globsMayOverlap } from './globs.mjs';
import { renderSecurityControls } from './render-permissions.mjs';
import { readManifest, readOmissions } from './ownership.mjs';
import { policyEntryKey, readSecurityPolicy } from '../assets/tools/security-policy.mjs';

const SETTINGS_REL = '.claude/settings.json';
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

// ---------------------------------------------------------------- CLI ----
function cli() {
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
  try { policy = loadEffectivePolicy(root).policy; } catch (e) { if (!e.code) throw e; fail(e.message, e.code === 'POLICY_IO' ? 2 : 3); }
  const allowFile = args['allow-file'] && args['allow-file'] !== true;
  let managedAllow = [];
  if (allowFile) {
    let p; try { p = assertNotSecretInput(args['allow-file']); } catch (e) { fail(e.message, 2); }
    try { managedAllow = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { fail('--allow-file is not valid JSON (content not shown)', 3); }
  }
  if (!Array.isArray(managedAllow) || managedAllow.some((x) => typeof x !== 'string')) fail('--allow-file must contain a JSON array of rule strings');
  const broadAllow = managedAllow.filter((r) => /^(Bash|PowerShell)(\(\*\))?$/.test(r) || /^(Bash|PowerShell)\([^ )]*\*\)$/.test(r));
  if (broadAllow.length) fail('refusing broad allow rules; allow specific commands only', 3, { broadAllow });

  const target = path.join(root, '.claude', 'settings.json');
  let original = null; let settings;
  if (fs.existsSync(target)) {
    original = fs.readFileSync(target, 'utf8');
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
  const out = merged.settings;
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
  const report = {
    added: { deny: dr.added, allow: allowAdded }, alreadyPresent: [...dr.alreadyPresent, ...allowPresent], conflicts: dr.conflicts,
    ineffective: [], malformedHooks: [], info: [], heldBack: dr.heldBack, alreadyCovered: dr.alreadyCovered,
    retainedManagedDenies: dr.retained, ownershipDropped: dr.ownershipDropped,
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
    const indentMatch = original?.match(/\n([ \t]+)"/);
    let text = JSON.stringify(out, null, indentMatch ? indentMatch[1] : 2) + '\n';
    if (original && detectEol(original) === '\r\n') text = text.replace(/\n/g, '\r\n');
    try { writeInRepo(root, `.ai/.run/${runId}/drafts/.claude/settings.json`, text); } catch (e) { fail(e.message, 2); }
  }
  // Request files are merged, never replaced: other targets and other staged fields of this target survive.
  const writeMerged = (file, value) => {
    const rel = `.ai/.run/${runId}/${file}`;
    let cur = {};
    try { cur = JSON.parse(readInRepo(root, rel).toString('utf8')); } catch (e) { if (e.code !== 'ENOENT') fail(`${file}: ${e.message}`, 2); }
    cur[SETTINGS_REL] = typeof value === 'function' ? value(cur[SETTINGS_REL]) : value;
    try { writeInRepo(root, rel, JSON.stringify(cur, null, 2) + '\n', { createDirs: false }); } catch (e) { fail(e.message, 2); }
  };
  writeMerged('ownership.json', 'keys');
  // Without --allow-file no permissions.allow is requested, so existing or already staged allow ownership is kept.
  writeMerged('managed-keys.json', (prev) => ({
    ...(isObj(prev) ? prev : {}), 'permissions.deny': merged.managed['permissions.deny'], heldBack: merged.managed.heldBack,
    ...(allowFile ? { 'permissions.allow': managedAllow } : {}),
  }));

  const needsDecision = report.conflicts.length > 0;
  ok({
    changed, needsDecision,
    draft: changed ? '.ai/.run/' + runId + '/drafts/.claude/settings.json' : null,
    report,
    next: needsDecision ? 'Show conflicts to the user. Held-back rules are NOT in the draft. Re-run with --override-user-exceptions only if the user chooses to cancel their exceptions.' : undefined,
  });
}

const norm = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
if (Boolean(process.argv[1]) && norm(process.argv[1]) === norm(fileURLToPath(import.meta.url))) cli();
