// Ownership metadata, approved omissions and manifest schema 3: the shared validators of the transaction engine.
//
// Plan: docs/plans/2026-10-17-project-setup-v3-rc1-c2.md sections 2.1, 3 and 5.1. Policy entries are validated by the
// shared policy module (assets/tools/security-policy.mjs, C1); nothing here re-implements its grammar or its identity.
//
// What this gets right that the v2 checks did not:
//   - Metadata is file-specific. v2 accepted any object of string arrays under "managed", so a policy record could carry
//     permission lists and a settings record could carry policy entries, and nobody noticed until a reader misbehaved.
//   - Policy metadata keeps complete entries (anchor, glob and every other field, in their original spelling and order),
//     never a list of globs: an omission or a later migration needs the record the user approved, not a projection.
//   - An omission is an exact C1 identity (anchor plus lowercase glob). A broader or replacement glob never matches it,
//     and a malformed later omission is an error, never an early "true".
//   - A schema-2 manifest is valid migration input, reported as needing an update instead of failing as "schema must
//     be 2" in reverse; an unknown schema still fails explicitly.
//
// Every function is synchronous, reads no file, process or environment, prints nothing, never exits and never mutates
// its input. Results are detached JSON copies. Importing the module does nothing but define it.
import { policyEntryKey, readSecurityPolicy, validateRepoPath } from '../assets/tools/security-policy.mjs';

const POLICY_TARGET = '.ai/security-paths.json';
const SETTINGS_TARGET = '.claude/settings.json';
const MANIFEST_TARGET = '.ai/manifest.json';
const HEX64 = /^[0-9a-f]{64}$/;
const SETTINGS_FIELDS = ['permissions.allow', 'permissions.deny', 'hooks', 'heldBack'];
const HOOK_FIELDS = ['event', 'matcher', 'command'];

// Plan 5.1: an Error with an own string code; the message starts with "<code>: " and never carries a file body.
function metadataError(code, detail) {
  const e = new Error(`${code}: ${detail}`);
  e.code = code;
  return e;
}
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const copy = (v) => JSON.parse(JSON.stringify(v));

function checkTarget(target) {
  if (target !== POLICY_TARGET && target !== SETTINGS_TARGET) throw metadataError('OWNERSHIP_TARGET', `unsupported target ${target}`);
}

// Unknown fields are reported in sorted order, before any declared field is looked at (plan 5.1).
function rejectUnknown(value, allowed, code, location) {
  const unknown = Object.keys(value).filter((k) => !allowed.includes(k)).sort();
  if (unknown.length) throw metadataError(code, `${location}.${unknown[0]}`);
}

// A C2-owned string array: a wrong container or a wrong element reports the array, never an index.
function checkStrings(value, code, location) {
  if (!Array.isArray(value) || !value.every((x) => typeof x === 'string')) throw metadataError(code, location);
}

/**
 * C1 validates the equivalent policy (projectPatterns: []), so its errors keep their own code and location such as
 * patterns[0]. Metadata stores every anchor explicitly: a schema-1 entry that omits one is reported by the schema-2
 * rule, C1's own POLICY_ANCHOR, rather than silently inferred into the record.
 */
function checkPolicyEntries(schema, patterns) {
  readSecurityPolicy({ schema, patterns, projectPatterns: [] });
  if (schema === 1 && patterns.some((e) => isObj(e) && !own(e, 'anchor'))) readSecurityPolicy({ schema: 2, patterns, projectPatterns: [] });
}

/** Validates a list of anchored entries through C1 and returns their identity keys; a repeated identity is an error. */
function entryKeys(list, location) {
  if (!Array.isArray(list)) throw metadataError('OMISSIONS_SHAPE', location);
  readSecurityPolicy({ schema: 2, patterns: list, projectPatterns: [] });
  const keys = [];
  list.forEach((entry, i) => {
    const key = policyEntryKey(entry);
    if (keys.includes(key)) throw metadataError('OMISSIONS_DUPLICATE', `${location}[${i}]`);
    keys.push(key);
  });
  return keys;
}

/** Hook identity (plan 3.2): exactly event, matcher and command. Options such as timeout are not identity fields. */
export function hookIdentity(value) {
  const bad = () => metadataError('HOOK_IDENTITY', 'event, matcher and command are required');
  if (!isObj(value)) throw bad();
  const keys = Object.keys(value);
  if (keys.length !== HOOK_FIELDS.length || !HOOK_FIELDS.every((k) => own(value, k))) throw bad();
  const { event, matcher, command } = value;
  if (typeof event !== 'string' || event === '' || typeof matcher !== 'string' || typeof command !== 'string' || command === '') throw bad();
  return JSON.stringify([event, matcher, command]);
}

/**
 * Managed metadata of one file (plan 3.1, 3.2). The policy record is a complete { schema, patterns } container; the
 * settings record holds exact permission strings within their named arrays, hook identities, and v2's heldBack list.
 * Order and duplicate strings are kept; nothing is case-folded, sorted or rewritten.
 */
export function readManagedMetadata(target, value) {
  checkTarget(target);
  if (!isObj(value)) throw metadataError('OWNERSHIP_SHAPE', 'managed');
  if (target === POLICY_TARGET) {
    rejectUnknown(value, ['schema', 'patterns'], 'OWNERSHIP_FIELD', 'managed');
    // Both fields are required: a policy request replaces the container and is never merged into validity.
    for (const f of ['schema', 'patterns']) if (!own(value, f)) throw metadataError('OWNERSHIP_FIELD', `managed.${f}`);
    checkPolicyEntries(value.schema, value.patterns);
    return copy(value);
  }
  rejectUnknown(value, SETTINGS_FIELDS, 'OWNERSHIP_FIELD', 'managed');
  for (const f of ['permissions.allow', 'permissions.deny']) if (own(value, f)) checkStrings(value[f], 'OWNERSHIP_SHAPE', `managed.${f}`);
  if (own(value, 'hooks')) {
    if (!Array.isArray(value.hooks)) throw metadataError('OWNERSHIP_SHAPE', 'managed.hooks');
    const seen = new Set();
    value.hooks.forEach((h, i) => {
      const id = hookIdentity(h);
      if (seen.has(id)) throw metadataError('HOOK_DUPLICATE', `hooks[${i}]`);
      seen.add(id);
    });
  }
  if (own(value, 'heldBack')) checkStrings(value.heldBack, 'OWNERSHIP_SHAPE', 'managed.heldBack');
  return copy(value);
}

/**
 * Approved omissions of one file (plan 3.4), stored beside the managed record, never inside it. Policy and deny
 * omissions are anchored policy entries; allow omissions are exact permission strings. Empty objects and arrays are
 * valid; unknown fields, wrong types and repeated identities are not.
 */
export function readOmissions(target, value) {
  checkTarget(target);
  if (!isObj(value)) throw metadataError('OMISSIONS_SHAPE', 'omissions');
  if (target === POLICY_TARGET) {
    rejectUnknown(value, ['patterns'], 'OMISSIONS_SHAPE', 'omissions');
    if (own(value, 'patterns')) entryKeys(value.patterns, 'omissions.patterns');
    return copy(value);
  }
  rejectUnknown(value, ['permissions.allow', 'permissions.deny'], 'OMISSIONS_SHAPE', 'omissions');
  if (own(value, 'permissions.allow')) {
    const allow = value['permissions.allow'];
    checkStrings(allow, 'OMISSIONS_SHAPE', 'omissions.permissions.allow');
    allow.forEach((s, i) => { if (allow.indexOf(s) !== i) throw metadataError('OMISSIONS_DUPLICATE', `omissions.permissions.allow[${i}]`); });
  }
  if (own(value, 'permissions.deny')) entryKeys(value['permissions.deny'], 'omissions.permissions.deny');
  return copy(value);
}

/**
 * true when the candidate policy entry has exactly the identity of an omitted one. The candidate is validated first,
 * then the whole omission list, so a malformed later omission fails even after a match. No alias, Unicode or
 * coverage reasoning: a broader replacement glob is a new decision (C3), never an inherited omission.
 */
export function isPolicyOmitted(entry, omittedEntries) {
  const key = policyEntryKey(entry);
  return entryKeys(omittedEntries, 'omissions.patterns').includes(key);
}

// ---------------------------------------------------------------- manifest ----
function recordIssues(file, record) {
  const at = `files["${file}"]`;
  try { validateRepoPath(file); } catch (e) { return [`${at}: ${e.message}`]; }
  if (file === MANIFEST_TARGET) return [`${at} must not record the manifest itself`];
  if (!isObj(record)) return [`${at} must be an object`];
  const out = [];
  switch (record.ownership) {
    case 'full': if (typeof record.sha256 !== 'string' || !HEX64.test(record.sha256)) out.push(`${at}.sha256 must be a sha256 hex`); break;
    case 'blocks': if (!isObj(record.blocks) || !Object.values(record.blocks).every((h) => typeof h === 'string' && HEX64.test(h))) out.push(`${at}.blocks must map ids to sha256 hex`); break;
    case 'keys': try { readManagedMetadata(file, record.managed); } catch (e) { if (!e.code) throw e; out.push(`${at}.managed: ${e.message}`); } break;
    case 'merged': break;
    default: out.push(`${at}.ownership is invalid: ${record.ownership}`);
  }
  if (own(record, 'omissions')) {
    if (record.ownership !== 'keys') out.push(`${at}.omissions: omissions require keys ownership`);
    else { try { readOmissions(file, record.omissions); } catch (e) { if (!e.code) throw e; out.push(`${at}.omissions: ${e.message}`); } }
  }
  return out;
}

/**
 * Validates a schema-2 or schema-3 manifest (plan 3.5, 3.6) and returns a detached copy. Performs no migration: a
 * schema-2 manifest comes back as it is, with needsUpdate true; prepare writes schema 3 when it has real work to do.
 */
export function readManifest(value) {
  const invalid = (issues) => Object.assign(metadataError('MANIFEST_INVALID', 'invalid manifest'), { issues });
  if (!isObj(value)) throw invalid(['root must be an object']);
  if (value.schema !== 2 && value.schema !== 3) throw Object.assign(metadataError('MANIFEST_SCHEMA', 'schema must be 2 or 3'), { issues: ['schema must be 2 or 3'] });
  const legacy = value.schema === 2;
  const issues = [];
  if (value.skill !== 'project-setup') issues.push('skill must be "project-setup"');
  if (typeof value.skillVersion !== 'string') issues.push('skillVersion must be a string');
  // Legacy manifests may lack mode and sourceCommit; when present they have the schema-3 types.
  if ((!legacy || own(value, 'mode')) && typeof value.mode !== 'string') issues.push('mode must be a string');
  if (!Array.isArray(value.agents) || !value.agents.every((a) => typeof a === 'string')) issues.push('agents must be an array of strings');
  if ((!legacy || own(value, 'sourceCommit')) && value.sourceCommit !== null && typeof value.sourceCommit !== 'string') issues.push('sourceCommit must be a string or null');
  if (!isObj(value.files)) issues.push('files must be an object');
  else for (const file of Object.keys(value.files).sort()) issues.push(...recordIssues(file, value.files[file]));
  if (own(value, 'codexSnippetSha256') && (typeof value.codexSnippetSha256 !== 'string' || !HEX64.test(value.codexSnippetSha256))) issues.push('codexSnippetSha256 must be a sha256 hex');
  if (issues.length) throw invalid(issues);
  return { sourceSchema: value.schema, needsUpdate: legacy, manifest: copy(value) };
}
