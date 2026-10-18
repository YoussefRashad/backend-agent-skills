#!/usr/bin/env node
// Policy migration and synchronized controls: baseline recognition, explicit decisions, the runtime-unit gate and the
// recorded-state inspection.
//
// Plan: docs/plans/2026-10-18-project-setup-v3-rc1-c3.md sections 2.4, 3.4-3.9, 3.11 and 3.12 (and its freeze addendum).
//
// What this gets right that v2 did not:
//   - Ownership comes from the installed RECORD, never from current bytes. A policy that happens to equal the shipped v2
//     file but has no recognized record is "unknown": every entry needs a decision, nothing is silently adopted.
//   - A broader replacement (**/.env* for **/.env and **/.env.*) is a NEW decision. An old omission neither omits nor
//     approves it, and omitting the replacement keeps the old entries instead of silently dropping coverage.
//   - Moving a pattern to projectPatterns, omitting it, or restoring a deleted one is an explicit, hash-bound decision
//     against one exact report; a stale or contradictory decision file fails instead of half-applying.
//   - A schema-2 policy is never written next to a reader that cannot parse it: every catalog runtime unit must be
//     compatible AND carry exactly the reviewed bytes, checked again at commit from the trusted catalog.
//
// Exports are pure: synchronous, no file, process, stream or environment access, inputs never mutated, results fresh
// data. Importing the module only defines it; the report/stage CLI runs only when the file is the entry point.
//
// Usage: node migrate-security-paths.mjs report --project <root>
//        node migrate-security-paths.mjs stage --project <root> --run-id <id>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSecurityPolicy, policyEntryKey, readSecurityPolicy } from '../assets/tools/security-policy.mjs';
import { readManifest, readOmissions } from './ownership.mjs';
import { renderSecurityControls } from './render-permissions.mjs';
import { mergeManagedDenies } from './merge-claude-settings.mjs';
import { SKILL_DIR, detectEol, isSecretPath, normalizedHash, readInRepo, secureDir, setFilesystemRoot, sha256, validateRunId, writeInRepo } from './lib.mjs';

const POLICY_REL = '.ai/security-paths.json';
const SETTINGS_REL = '.claude/settings.json';
const MANIFEST_REL = '.ai/manifest.json';
const HELPER_REL = '.ai/tools/security-policy.mjs';
const HEX64 = /^[0-9a-f]{64}$/;
const INPUT_FIELDS = ['policy', 'manifest', 'baselinePolicy', 'baselineSha256', 'desiredPolicy', 'desiredSha256'];
const DECISION_FIELDS = ['schema', 'reportSha256', 'entries', 'coverage', 'denyOmissions', 'dropDenyOwnership', 'overrideUserExceptions'];
// Plan 3.4: the replacement coverage and the two old identities it replaces.
const ENV_NEW = policyEntryKey({ anchor: 'any', glob: '**/.env*' });
const ENV_OLD = [policyEntryKey({ anchor: 'any', glob: '**/.env' }), policyEntryKey({ anchor: 'any', glob: '**/.env.*' })];

const J = (v) => JSON.stringify(v, null, 2) + '\n';
const H = (text) => sha256(Buffer.from(text, 'utf8'));
const K = (entry) => policyEntryKey(entry);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
// Canonical JSON: object keys sorted, array order kept (plan 3.1).
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : isObj(v) ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));
const canonEq = (a, b) => canon(a) === canon(b);

// Plan 3.12: an Error with an own string code; the message is "<CODE>: <detail>" and never carries a file body.
const DETAIL = {
  MIGRATION_INPUT: () => 'migration input must contain the documented fields',
  MIGRATION_BASELINE_INVALID: () => 'shipped policy baseline is unavailable or invalid',
  MIGRATION_DECISIONS: () => 'invalid security migration decisions',
  MIGRATION_DECISION_REQUIRED: (id) => `explicit decision required for ${id}`,
  MIGRATION_REPORT_CHANGED: () => 'migration report changed; review decisions again',
  MIGRATION_DRAFT_CONFLICT: (p) => `staged migration output conflicts with ${p}`,
  MIGRATION_IO: (p) => `cannot read migration input: ${p}`,
  MIGRATION_WRITE: (p) => `cannot stage migration output: ${p}`,
  DENY_SETTINGS: () => 'settings permissions must contain string arrays',
  TOOL_CATALOG: () => 'invalid runtime unit catalog',
  TOOL_UNIT_INPUT: () => 'invalid security tool unit',
  TOOL_UNIT_INCOMPATIBLE: (t) => `compatible reviewed reader required: ${t}`,
  TOOL_UNIT_UNREVIEWED: (t) => `reviewed tool bytes required: ${t}`,
};
function migError(code, arg, extra = {}) {
  return Object.assign(new Error(`${code}: ${DETAIL[code](arg)}`), { code, ...extra });
}

// ------------------------------------------------------------- the input ----
/**
 * Validates a MigrationInput (plan 3.4) and selects the baseline. The manifest passes C2's reader before any record is
 * used; both policies and the shipped documents pass C1. Ownership comes only from the record: keys -> recorded (its
 * complete managed list), a full record hashing to v2 -> v2.0.0 (v2 wins a tie), to the current defaults -> shipped,
 * nothing at all -> fresh, anything else -> unknown.
 */
function readInput(input) {
  if (!isObj(input) || Object.keys(input).length !== INPUT_FIELDS.length || !INPUT_FIELDS.every((f) => own(input, f))) throw migError('MIGRATION_INPUT');
  if (![input.baselineSha256, input.desiredSha256].every((h) => typeof h === 'string' && HEX64.test(h))) throw migError('MIGRATION_INPUT');
  const baseList = readSecurityPolicy(input.baselinePolicy).policy.patterns;
  const desired = readSecurityPolicy(input.desiredPolicy).policy.patterns;
  const manifest = input.manifest === null ? null : readManifest(input.manifest).manifest;
  const cur = input.policy === null ? null : readSecurityPolicy(input.policy);
  const rec = manifest && own(manifest.files, POLICY_REL) ? manifest.files[POLICY_REL] : null;
  let baseline = 'unknown'; let list = null; let baselineSha256 = null;
  if (rec && rec.ownership === 'keys') {
    baseline = 'recorded';
    list = readSecurityPolicy({ schema: rec.managed.schema, patterns: rec.managed.patterns, projectPatterns: [] }).policy.patterns;
  } else if (rec && rec.ownership === 'full' && rec.sha256 === input.baselineSha256) {
    baseline = 'v2.0.0'; list = baseList; baselineSha256 = input.baselineSha256;
  } else if (rec && rec.ownership === 'full' && rec.sha256 === input.desiredSha256) {
    baseline = 'shipped'; list = desired; baselineSha256 = input.desiredSha256;
  } else if (!cur && !rec) baseline = 'fresh';
  const omissions = rec && rec.ownership === 'keys' && rec.omissions && Array.isArray(rec.omissions.patterns) ? rec.omissions.patterns : [];
  const settings = manifest && own(manifest.files, SETTINGS_REL) ? manifest.files[SETTINGS_REL] : null;
  return {
    input, cur, manifest, rec, baseline, list, baselineSha256, desired, omissions, omittedKeys: new Set(omissions.map(K)),
    current: cur ? cur.policy.patterns : [],
    retainedManagedDenies: settings && settings.ownership === 'keys' && Array.isArray(settings.managed['permissions.deny']) ? settings.managed['permissions.deny'] : [],
  };
}

const row = (id, classification, before, current) => ({ id, classification, before: before ? copy(before) : null, current: current ? copy(current) : null });

function classify(s) {
  const entries = [];
  if (s.list) {
    // First UNUSED baseline occurrence with the same identity: duplicates are classified one by one (plan 3.4).
    const used = s.list.map(() => false);
    s.current.forEach((e, i) => {
      const k = K(e);
      const j = s.list.findIndex((b, x) => !used[x] && K(b) === k);
      if (j === -1) { entries.push(row(`current:${i}`, 'project-addition', null, e)); return; }
      used[j] = true;
      entries.push(row(`current:${i}`, canonEq(s.list[j], e) ? 'unchanged' : 'managed-edit', s.list[j], e));
    });
    s.list.forEach((b, j) => { if (!used[j]) entries.push(row(`baseline:${j}`, 'deletion', b, null)); });
  } else s.current.forEach((e, i) => entries.push(row(`current:${i}`, 'managed-edit', null, e)));

  const baseKeys = new Set(s.list ? s.list.map(K) : []);
  const effective = new Set(s.cur ? s.cur.effectivePatterns.map((e) => JSON.stringify([e.anchor, e.glob])) : []);
  const seen = new Set();
  const coverage = [];
  s.desired.forEach((d, i) => {
    const k = K(d);
    if (seen.has(k)) return;
    seen.add(k);
    if (baseKeys.has(k) || s.omittedKeys.has(k)) return;
    const replaces = [];
    let previousOmissions = [];
    if (k === ENV_NEW) {
      for (const old of ENV_OLD) {
        const hit = [...(s.list || []), ...s.omissions, ...s.current].find((e) => K(e) === old);
        if (hit) replaces.push(copy(hit));
      }
      previousOmissions = s.omissions.filter((e) => ENV_OLD.includes(K(e))).map(copy);
    }
    coverage.push({ id: `coverage:${i}`, entry: copy(d), replaces, previousOmissions, alreadyEffective: effective.has(k) });
  });

  const requiredDecisions = [];
  for (const e of entries) {
    if (e.classification === 'managed-edit') requiredDecisions.push({ id: e.id, choices: e.before ? ['keep', 'replace', 'project', 'omit'] : ['keep', 'project', 'omit'] });
    else if (e.classification === 'project-addition') requiredDecisions.push({ id: e.id, choices: ['project', 'keep', 'omit'] });
    else if (e.classification === 'deletion' && !s.omittedKeys.has(K(e.before))) requiredDecisions.push({ id: e.id, choices: ['restore', 'omit'] });
  }
  for (const c of coverage) requiredDecisions.push({ id: c.id, choices: ['include', 'omit'] });
  return {
    baseline: s.baseline, baselineSha256: s.baselineSha256, sourceSchema: s.cur ? s.cur.sourceSchema : null,
    entries, coverage, retainedManagedDenies: copy(s.retainedManagedDenies), requiredDecisions,
  };
}

/** Plan 3.4: the MigrationReport of one input. */
export function classifySecurityMigration(input) {
  return classify(readInput(input));
}

// ------------------------------------------------------------ decisions ----
function readDecisions(d) {
  const bad = () => migError('MIGRATION_DECISIONS');
  if (!isObj(d) || Object.keys(d).length !== DECISION_FIELDS.length || !DECISION_FIELDS.every((f) => own(d, f))) throw bad();
  if (d.schema !== 1 || typeof d.reportSha256 !== 'string' || !HEX64.test(d.reportSha256) || typeof d.overrideUserExceptions !== 'boolean') throw bad();
  for (const list of [d.entries, d.coverage]) {
    if (!Array.isArray(list) || !list.every((r) => isObj(r) && Object.keys(r).length === 2 && typeof r.id === 'string' && typeof r.action === 'string')) throw bad();
  }
  if (!Array.isArray(d.dropDenyOwnership) || !d.dropDenyOwnership.every((x) => typeof x === 'string') || !Array.isArray(d.denyOmissions)) throw bad();
  try { readOmissions(SETTINGS_REL, { 'permissions.deny': d.denyOmissions }); } catch (e) { if (!e.code) throw e; throw bad(); }
  return d;
}

/**
 * Plan 3.5: applies explicit decisions to the report of the same input. Managed order is retained current order, then
 * restored baseline order, then newly included desired order; project moves append in current order; omissions keep the
 * recorded ones first, unique by identity. Including the new environment coverage retires UNCHANGED old environment
 * entries only. A result that keeps a managed identity and also omits it in this run is contradictory.
 */
export function resolveSecurityMigration(input, decisions) {
  const s = readInput(input);
  const report = classify(s);
  const d = readDecisions(decisions);
  if (d.reportSha256 !== H(J(report))) throw migError('MIGRATION_REPORT_CHANGED');
  const need = new Map(report.requiredDecisions.map((r) => [r.id, r.choices]));
  const chosen = new Map();
  for (const [list, ids] of [[d.entries, new Set(report.entries.map((e) => e.id))], [d.coverage, new Set(report.coverage.map((c) => c.id))]]) {
    for (const r of list) {
      if (chosen.has(r.id) || !ids.has(r.id) || !need.has(r.id) || !need.get(r.id).includes(r.action)) throw migError('MIGRATION_DECISIONS');
      chosen.set(r.id, r.action);
    }
  }
  for (const r of report.requiredDecisions) if (!chosen.has(r.id)) throw migError('MIGRATION_DECISION_REQUIRED', r.id);

  const retained = []; const restored = []; const project = []; const omitted = [];
  for (const e of report.entries) {
    const a = chosen.get(e.id);
    if (e.classification === 'unchanged') retained.push({ entry: e.current, retirable: true });
    else if (e.classification === 'deletion') { if (a === 'restore') restored.push(e.before); else if (a === 'omit') omitted.push(e.before); }
    else if (a === 'keep') retained.push({ entry: e.current });
    else if (a === 'replace') retained.push({ entry: e.before });
    else if (a === 'project') { project.push(e.current); if (e.before) omitted.push(e.before); } // only a baseline-owned entry claims its identity
    else omitted.push(e.before || e.current);
  }
  const included = [];
  for (const c of report.coverage) (chosen.get(c.id) === 'include' ? included : omitted).push(c.entry);
  const envIncluded = included.some((e) => K(e) === ENV_NEW);
  const managed = [...retained.filter((r) => !(envIncluded && r.retirable && ENV_OLD.includes(K(r.entry)))).map((r) => r.entry), ...restored];
  const managedKeys = new Set(managed.map(K));
  for (const e of included) if (!managedKeys.has(K(e))) { managed.push(e); managedKeys.add(K(e)); }
  if (omitted.some((e) => managedKeys.has(K(e)))) throw migError('MIGRATION_DECISIONS');
  const omissions = [];
  const seen = new Set();
  for (const e of [...s.omissions, ...omitted]) { const k = K(e); if (!seen.has(k)) { seen.add(k); omissions.push(e); } }

  // Every other top-level field and every existing project entry is preserved; the result is schema 2, anchors explicit.
  const base = input.policy !== null ? input.policy : Object.fromEntries(Object.entries(input.desiredPolicy).filter(([k]) => !['patterns', 'projectPatterns'].includes(k)));
  const policy = copy({ ...base, schema: 2, patterns: managed, projectPatterns: [...(s.cur ? s.cur.policy.projectPatterns : []), ...project] });
  readSecurityPolicy(policy);
  return { policy, managed: { schema: 2, patterns: copy(managed) }, omissions: { patterns: copy(omissions) }, report };
}

// --------------------------------------------------------- runtime units ----
/** Plan 3.9: shape of the trusted catalog plus the two initial units; later entries and schemas are accepted. */
export function readRuntimeUnits(value) {
  const bad = () => migError('TOOL_CATALOG');
  if (!isObj(value) || value.schema !== 1 || !Array.isArray(value.units) || !value.units.length) throw bad();
  const units = value.units.map((u) => {
    if (!isObj(u) || typeof u.source !== 'string' || u.source === '' || typeof u.target !== 'string' || u.target === '') throw bad();
    if (!['helper', 'entrypoint'].includes(u.role) || !Array.isArray(u.policySchemas) || !u.policySchemas.every(Number.isInteger)) throw bad();
    return { source: u.source, target: u.target, role: u.role, policySchemas: [...u.policySchemas] };
  });
  if (new Set(units.map((u) => u.target)).size !== units.length) throw bad();
  for (const [source, target, role] of [['assets/tools/security-policy.mjs', HELPER_REL, 'helper'], ['assets/tools/git-safe.mjs', '.ai/tools/git-safe.mjs', 'entrypoint']]) {
    if (!units.some((u) => u.source === source && u.target === target && u.role === role)) throw bad();
  }
  return { schema: 1, units };
}

const TOOL_FIELDS = ['source', 'target', 'role', 'policySchemas', 'reviewedSha256', 'installedSha256', 'plannedSha256'];
const hexOrNull = (v) => v === null || (typeof v === 'string' && HEX64.test(v));

/**
 * Plan 3.9: rows in target order; per row the capability first (TOOL_UNIT_INCOMPATIBLE), then the planned candidate or
 * else the installed one must carry exactly the reviewed bytes (TOOL_UNIT_UNREVIEWED). Errors carry the row target.
 * Write order: the security-policy helper, other helpers sorted, then entrypoints sorted.
 */
export function checkSecurityToolUnit(rows, policySchema) {
  const bad = () => migError('TOOL_UNIT_INPUT');
  if (!Number.isInteger(policySchema) || !Array.isArray(rows)) throw bad();
  for (const r of rows) {
    if (!isObj(r) || !TOOL_FIELDS.every((f) => own(r, f)) || typeof r.source !== 'string' || typeof r.target !== 'string' || r.target === '') throw bad();
    if (!['helper', 'entrypoint'].includes(r.role) || !Array.isArray(r.policySchemas) || !r.policySchemas.every(Number.isInteger)) throw bad();
    if (typeof r.reviewedSha256 !== 'string' || !HEX64.test(r.reviewedSha256) || !hexOrNull(r.installedSha256) || !hexOrNull(r.plannedSha256)) throw bad();
  }
  const targets = rows.map((r) => r.target).sort();
  if (new Set(targets).size !== targets.length) throw bad();
  const byTarget = [...rows].sort((a, b) => (a.target < b.target ? -1 : a.target > b.target ? 1 : 0));
  for (const r of byTarget) {
    if (!r.policySchemas.includes(policySchema)) throw migError('TOOL_UNIT_INCOMPATIBLE', r.target, { target: r.target });
    const candidate = r.plannedSha256 !== null ? r.plannedSha256 : r.installedSha256;
    if (candidate === null || candidate !== r.reviewedSha256) throw migError('TOOL_UNIT_UNREVIEWED', r.target, { target: r.target });
  }
  const pick = (role) => byTarget.filter((r) => r.role === role && r.target !== HELPER_REL).map((r) => r.target);
  return { targets, writeOrder: [...(byTarget.some((r) => r.target === HELPER_REL) ? [HELPER_REL] : []), ...pick('helper'), ...pick('entrypoint')] };
}

// ------------------------------------------------------------ inspection ----
const ROW = {
  pass: { level: 'pass', check: 'policy-managed', detail: '.ai/security-paths.json: managed patterns match installed baseline' },
  fail: { level: 'fail', check: 'policy-managed', detail: '.ai/security-paths.json: managed patterns edited since install' },
  unknown: { level: 'info', check: 'policy-baseline', detail: '.ai/security-paths.json: installed baseline unknown' },
  behind: { level: 'info', check: 'policy-version', detail: '.ai/security-paths.json: installed managed patterns are behind this skill' },
  missing: { level: 'info', check: 'codex-snippet', detail: 'Codex deny-read snippet has not been recorded' },
  stale: { level: 'info', check: 'codex-snippet', detail: 'Codex deny-read snippet is stale; render and review it again' },
};

/**
 * Plan 3.11: managed drift (complete entries, order and metadata) against the installed list of the same baseline
 * selection; behind only when no drift and some desired identity is absent from both that list and its exact omissions;
 * unknown emits only the baseline row; then the project row and the snippet row.
 */
export function inspectSecurityState(input) {
  const s = readInput(input);
  const rows = [];
  if (s.baseline === 'unknown') rows.push(ROW.unknown);
  else if (s.list) {
    const drift = s.current.length !== s.list.length || s.current.some((e, i) => !canonEq(e, s.list[i]));
    rows.push(drift ? ROW.fail : ROW.pass);
    const have = new Set([...s.list.map(K), ...s.omittedKeys]);
    if (!drift && s.desired.some((e) => !have.has(K(e)))) rows.push(ROW.behind);
  }
  if (s.cur && s.cur.policy.projectPatterns.length) {
    rows.push({ level: 'info', check: 'policy-project', detail: `.ai/security-paths.json: projectPatterns ${JSON.stringify(s.cur.policy.projectPatterns.map(K))}` });
  }
  const recorded = s.manifest && own(s.manifest, 'codexSnippetSha256') ? s.manifest.codexSnippetSha256 : null;
  if (recorded === null) rows.push(ROW.missing);
  else if (recorded !== H(renderSecurityControls(input.policy !== null ? input.policy : input.desiredPolicy).codexSnippet)) rows.push(ROW.stale);
  return copy(rows);
}

// ------------------------------------------------------------------- CLI ----
const USAGE = 'usage: migrate-security-paths.mjs report --project <root> OR stage --project <root> --run-id <id>';
const NEXT = 'run apply.mjs prepare, review apply.mjs diff, then approve the plan hash';
const strip = (buf) => buf.toString('utf8').replace(/^\uFEFF/, '');

function failF(code, error, exit) {
  process.stdout.write(J({ ok: false, code, error }));
  process.exit(exit);
}
function failErr(e) {
  if (!(e instanceof Error) || typeof e.code !== 'string') throw e;
  failF(e.code, e.message, ['MIGRATION_IO', 'MIGRATION_WRITE', 'POLICY_IO'].includes(e.code) ? 2 : 3);
}

/** Exactly report --project <root>, or stage --project <root> --run-id <id> (each once, nonempty, a valid run id). */
function parseCli(argv) {
  const keys = { report: ['--project'], stage: ['--project', '--run-id'] }[argv[0]];
  if (!keys) return null;
  const o = {};
  for (let i = 1; i < argv.length; i += 2) {
    const v = argv[i + 1];
    if (!keys.includes(argv[i]) || own(o, argv[i]) || typeof v !== 'string' || v === '' || v.startsWith('--')) return null;
    o[argv[i]] = v;
  }
  if (!keys.every((k) => own(o, k))) return null;
  if (o['--run-id'] !== undefined) { try { validateRunId(o['--run-id']); } catch { return null; } }
  return { cmd: argv[0], project: o['--project'], runId: o['--run-id'] };
}

const readSkill = (rel) => { try { return fs.readFileSync(path.join(SKILL_DIR, ...rel.split('/'))); } catch { return null; } };
function shippedInput() {
  const b = readSkill('data/secret-paths-v2.0.0.json');
  const d = readSkill('data/secret-paths.json');
  try {
    const baselinePolicy = JSON.parse(strip(b)); const desiredPolicy = JSON.parse(strip(d));
    readSecurityPolicy(baselinePolicy); readSecurityPolicy(desiredPolicy);
    return { baselinePolicy, baselineSha256: normalizedHash(b), desiredPolicy, desiredSha256: normalizedHash(d) };
  } catch { throw migError('MIGRATION_BASELINE_INVALID'); }
}

/** A fixed project file through the validated root (links refused); absent is null, anything else MIGRATION_IO. */
function readProject(root, rel) {
  try { return readInRepo(root, rel); } catch (e) {
    if (e && (e.code === 'ENOENT' || /directory missing/.test(e.message))) return null;
    throw migError('MIGRATION_IO', rel);
  }
}

function readState(root) {
  const policyBuf = readProject(root, POLICY_REL);
  let policy = null;
  if (policyBuf !== null) { parseSecurityPolicy(policyBuf.toString('utf8')); policy = JSON.parse(strip(policyBuf)); }
  const manifestBuf = readProject(root, MANIFEST_REL);
  let manifest = null;
  if (manifestBuf !== null) {
    try { manifest = JSON.parse(strip(manifestBuf)); } catch { throw Object.assign(new Error('MANIFEST_INVALID: invalid manifest'), { code: 'MANIFEST_INVALID' }); }
  }
  return { policy, manifest, ...shippedInput() };
}

/** The legacy settings serialization of the merge script: its indent, its EOL, one final newline. */
function settingsText(original, value) {
  const m = original === null ? null : original.match(/\n([ \t]+)"/);
  const text = JSON.stringify(value, null, m ? m[1] : 2) + '\n';
  return original !== null && detectEol(original) === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
}

/**
 * Plan 3.7 stage: validates every decision and every staging conflict first, then writes the resolved policy draft, a
 * settings draft only when values change, every missing or differing catalog runtime asset, and the C2 requests (merged
 * with unrelated entries). Returns the run-relative files it created or changed.
 */
function stage(root, runId) {
  const RUN = `.ai/.run/${runId}`;
  let runDir = null;
  try { runDir = secureDir(root, ['.ai', '.run', runId]); } catch { runDir = null; }
  if (!runDir) throw migError('MIGRATION_IO', RUN);
  const decBuf = readProject(root, `${RUN}/security-decisions.json`);
  if (decBuf === null) throw migError('MIGRATION_IO', `${RUN}/security-decisions.json`);
  let decisions;
  try { decisions = JSON.parse(strip(decBuf)); } catch { throw migError('MIGRATION_DECISIONS'); }
  const input = readState(root);
  const report = classifySecurityMigration(input);
  const resolved = resolveSecurityMigration(input, decisions);
  const manifest = input.manifest === null ? null : readManifest(input.manifest).manifest;
  // Decision I3-3: settings and installed runtime targets are checked against the shipped plus installed refusal set
  // (the set prepare uses) BEFORE they are read; a protected path is never read, staged or copied into the run area.
  const guard = (rel) => {
    if (isSecretPath(rel, input.desiredPolicy) || (input.policy !== null && isSecretPath(rel, input.policy))) {
      throw Object.assign(new Error(`migration input is protected by the security policy: ${rel}`), { code: 'MIGRATION_PROTECTED_INPUT' });
    }
  };

  guard(SETTINGS_REL);
  const settingsBuf = readProject(root, SETTINGS_REL);
  const original = settingsBuf === null ? null : settingsBuf.toString('utf8');
  let settings = { $schema: 'https://json.schemastore.org/claude-code-settings.json' };
  if (original !== null) { try { settings = JSON.parse(original.replace(/^\uFEFF/, '')); } catch { throw migError('DENY_SETTINGS'); } }
  const srec = manifest && manifest.files[SETTINGS_REL] && manifest.files[SETTINGS_REL].ownership === 'keys' ? manifest.files[SETTINGS_REL] : null;
  const priorDenyOmissions = (srec && srec.omissions && srec.omissions['permissions.deny']) || [];
  const merged = mergeManagedDenies({
    settings, managed: srec ? srec.managed : {}, policy: resolved.policy,
    omissions: { ...((srec && srec.omissions) || {}), 'permissions.deny': decisions.denyOmissions },
    dropOwnership: decisions.dropDenyOwnership, overrideUserExceptions: decisions.overrideUserExceptions,
  });
  const settingsChanged = original === null || JSON.stringify(merged.settings) !== JSON.stringify(settings);
  const snippetSha = H(renderSecurityControls(resolved.policy).codexSnippet);

  // Everything this stage would write, checked against what is already staged before anything is written.
  const writes = [];
  const draftRel = (t) => `drafts/${t}`;
  const staged = (rel) => readProject(root, `${RUN}/${rel}`);
  const conflict = (target) => migError('MIGRATION_DRAFT_CONFLICT', target);
  const declared = [];
  const sameJson = (buf, value) => { try { return canonEq(JSON.parse(strip(buf)), value); } catch { return false; } };

  const policyNow = staged(draftRel(POLICY_REL));
  if (policyNow === null) writes.push([draftRel(POLICY_REL), J(resolved.policy)]);
  else if (!sameJson(policyNow, resolved.policy)) throw conflict(POLICY_REL);

  const denyOf = (v) => (v && v.permissions && Array.isArray(v.permissions.deny) ? v.permissions.deny : []);
  const settingsNow = staged(draftRel(SETTINGS_REL));
  if (settingsNow !== null) {
    let v = null; try { v = JSON.parse(strip(settingsNow)); } catch { v = null; }
    if (!v || !canonEq(denyOf(v), denyOf(merged.settings))) throw conflict(SETTINGS_REL);
  } else if (settingsChanged) writes.push([draftRel(SETTINGS_REL), settingsText(original, merged.settings)]);
  else declared.push(SETTINGS_REL);

  // Decision I3-4: the catalog is read only after the decisions and the non-runtime projections are checked.
  let units;
  try { units = readRuntimeUnits(JSON.parse(strip(readSkill('data/runtime-units.json')))).units; } catch { throw migError('TOOL_CATALOG'); }
  units = units.map((u) => { const src = readSkill(u.source); if (src === null) throw migError('TOOL_CATALOG'); guard(u.target); return { ...u, src, installed: readProject(root, u.target) }; });
  for (const u of [...units].sort((a, b) => (a.target < b.target ? -1 : 1))) {
    const now = staged(draftRel(u.target));
    if (now !== null) { if (Buffer.compare(now, u.src) !== 0) throw conflict(u.target); continue; }
    if (u.installed !== null && normalizedHash(u.installed) === normalizedHash(u.src)) declared.push(u.target);
    else writes.push([draftRel(u.target), u.src]);
  }

  // Requests: unrelated entries and unrelated fields of a C3 target survive; C3's own entries are (re)set.
  const request = (name, update) => {
    const buf = staged(name);
    let cur;
    try { cur = buf === null ? null : JSON.parse(strip(buf)); } catch { throw conflict(name); }
    const next = update(cur);
    if (next !== undefined && (buf === null || buf.toString('utf8') !== J(next))) writes.push([name, J(next)]);
  };
  const objOf = (v) => (isObj(v) ? v : {});
  request('ownership.json', (cur) => ({ ...objOf(cur), [POLICY_REL]: 'keys', [SETTINGS_REL]: 'keys' }));
  request('managed-keys.json', (cur) => ({
    ...objOf(cur), [POLICY_REL]: resolved.managed,
    [SETTINGS_REL]: { ...objOf(objOf(cur)[SETTINGS_REL]), 'permissions.deny': merged.managed['permissions.deny'], heldBack: merged.managed.heldBack },
  }));
  const prec = manifest && manifest.files[POLICY_REL];
  const needPolicyOm = resolved.omissions.patterns.length > 0 || Boolean(prec && prec.ownership === 'keys' && own(prec, 'omissions'));
  const needDenyOm = !canonEq(decisions.denyOmissions, priorDenyOmissions);
  if (needPolicyOm || needDenyOm) {
    request('omissions.json', (cur) => ({
      ...objOf(cur),
      ...(needPolicyOm ? { [POLICY_REL]: { ...objOf(objOf(cur)[POLICY_REL]), patterns: resolved.omissions.patterns } } : {}),
      ...(needDenyOm ? { [SETTINGS_REL]: { ...objOf(objOf(cur)[SETTINGS_REL]), 'permissions.deny': decisions.denyOmissions } } : {}),
    }));
  }
  request('manifest-metadata.json', () => ({ codexSnippetSha256: snippetSha }));
  if (declared.length) {
    request('transaction-inputs.json', (cur) => {
      const list = Array.isArray(cur) ? [...cur] : [];
      for (const t of declared) if (!list.includes(t)) list.push(t);
      return list;
    });
  }

  for (const [rel, data] of writes) {
    try { writeInRepo(root, `${RUN}/${rel}`, data); } catch { throw migError('MIGRATION_WRITE', `${RUN}/${rel}`); }
  }
  return { staged: writes.map(([rel]) => rel).sort(), reportSha256: H(J(report)) };
}

function cli() {
  const o = parseCli(process.argv.slice(2));
  if (!o) failF('MIGRATION_USAGE', USAGE, 1);
  let root;
  try { root = setFilesystemRoot(o.project); } catch { failF('MIGRATION_IO', `MIGRATION_IO: ${DETAIL.MIGRATION_IO('.')}`, 2); }
  try {
    if (o.cmd === 'report') {
      const report = classifySecurityMigration(readState(root));
      process.stdout.write(J({ ok: true, report, reportSha256: H(J(report)) }));
    } else {
      const r = stage(root, o.runId);
      process.stdout.write(J({ ok: true, staged: r.staged, reportSha256: r.reportSha256, next: NEXT }));
    }
  } catch (e) { failErr(e); }
}

const norm = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
if (Boolean(process.argv[1]) && norm(process.argv[1]) === norm(fileURLToPath(import.meta.url))) cli();
