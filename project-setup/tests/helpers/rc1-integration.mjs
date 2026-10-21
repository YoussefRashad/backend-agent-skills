// C11b integration helper (tests lane): the literal complete-case table, the component memo and the pure composition
// of a complete rc.1 case from component reports.
//
// Plan: docs/plans/2026-10-20-project-setup-v3-rc1-c11b.md sections 2.4, 4.1 and 4.2, with the freeze addendum
// C11b-P3-1 (the memo factory trusts its inputs; it does not validate them).
//
// Importing this module performs no filesystem read or write, starts no process and prints nothing. It never imports
// rc1-cases.mjs, which imports it: composeCaseOutcome receives the expected component descriptors as an argument and
// createComponentMemo receives the uncached runner as `run`. Exports, exactly:
//   RC1_CASE_DESCRIPTORS, CASE_REQUIREMENTS, createComponentMemo, composeCaseOutcome
import path from 'node:path';

const deepFreeze = (v) => { if (v && typeof v === 'object') { for (const x of Object.values(v)) deepFreeze(x); Object.freeze(v); } return v; };

// ------------------------------------------------------------ tables ----
// Plan 4.2, written out as literal arrays (never prefix searches). RC1_CASE_DESCRIPTORS holds the 40 complete cases in
// registration order with their exact PASS-record names. CASE_REQUIREMENTS lists, per case, the required components in
// first-appearance order and the literal assertion IDs each one must supply.
export const RC1_CASE_DESCRIPTORS = deepFreeze([
  { id: 'R41', name: 'committed file reads enforce policy' },
  { id: 'R42', name: 'tree listing and grep enforce policy' },
  { id: 'R43', name: 'historical secret paths remain protected' },
  { id: 'R44', name: 'anchors agree between matching and controls' },
  { id: 'R45', name: 'policy grammar and schemas are strict' },
  { id: 'R46', name: 'validation identifies unanchored user denies' },
  { id: 'R47', name: 'project policy reaches controls and Git' },
  { id: 'R48', name: 'project pattern moves require approval' },
  { id: 'R49', name: 'validation compares recorded managed policy' },
  { id: 'R50', name: 'raw Git parsing preserves the frozen boundary' },
  { id: 'R51', name: 'hook process behavior follows the exact contract' },
  { id: 'R52', name: 'deny and hook ownership preserve user settings' },
  { id: 'R53', name: 'allow discovery and validation agree' },
  { id: 'R54', name: 'new managed execution permissions are refused' },
  { id: 'R65', name: 'local review preserves Git state' },
  { id: 'R66', name: 'copied content and hard link limits are documented' },
  { id: 'R67', name: 'emitted template commands avoid environment filenames' },
  { id: 'R68', name: 'automatic template resolution has no alternate fallback' },
  { id: 'R72', name: 'installed hook self-test reports exact outcomes' },
  { id: 'R73', name: 'validation requires installed hook evidence' },
  { id: 'R74', name: 'the shared policy corpus reaches every consumer' },
  { id: 'R75', name: 'structural checks preserve exact Git names' },
  { id: 'R76', name: 'Git and review arguments failures and limits are bounded' },
  { id: 'R77', name: 'installed v2 customizations survive reviewed migration' },
  { id: 'R78', name: 'versioned migration uses compatible reviewed readers' },
  { id: 'R79', name: 'ownership schemas and runtime validation agree' },
  { id: 'R80', name: 'migration binds one snapshot and complete runtime unit' },
  { id: 'R81', name: 'installed baseline age is distinct from managed drift' },
  { id: 'R82', name: 'snippet state is recorded without user config writes' },
  { id: 'R84', name: 'hook argument rules preserve orchestrator commands' },
  { id: 'R85', name: 'managed allow retirement preserves retained denies' },
  { id: 'R86', name: 'reconciliation preserves approvals omissions and rollback' },
  { id: 'R90', name: 'review identity and self review instructions agree' },
  { id: 'R91', name: 'review paths require real junction containment' },
  { id: 'R92', name: 'reserved review artifacts survive setup lifecycle' },
  { id: 'R93', name: 'template handling preserves values and permission boundaries' },
  { id: 'R97', name: 'environment variants stay protected outside the script exception' },
  { id: 'R100', name: 'review output limits retain the remaining scope' },
  { id: 'A5-templates', name: 'agent instructions retain the trusted execution boundary' },
  { id: 'N8-doctor', name: 'synthetic doctor checks preserve evidence boundaries' },
]);

export const CASE_REQUIREMENTS = deepFreeze({
  R41: [
    { component: 'C4', ids: ['R41/C4/cat'] },
  ],
  R42: [
    { component: 'C4', ids: ['R42/C4/ls', 'R42/C4/grep'] },
  ],
  R43: [
    { component: 'C4', ids: ['R43/C4/history'] },
  ],
  R44: [
    { component: 'C1', ids: ['R44/C1/anchors'] },
    { component: 'C3', ids: ['R44/C3/anchors'] },
  ],
  R45: [
    { component: 'C1', ids: ['R45/C1/grammar', 'R45/C1/schema'] },
  ],
  R46: [
    { component: 'C10', ids: ['R46/C10/anchors'] },
  ],
  R47: [
    { component: 'C3', ids: ['R47/C3/project-controls'] },
    { component: 'C4', ids: ['R47/C4/project-policy'] },
  ],
  R48: [
    { component: 'C3', ids: ['R48/C3/project-moves'] },
  ],
  R49: [
    { component: 'C10', ids: ['R49/C10/policy'] },
  ],
  R50: [
    { component: 'C6', ids: ['R50/C6/parser', 'R50/C6/sanctioned', 'R50/C6/documentation'] },
  ],
  R51: [
    { component: 'C6', ids: ['R51/C6/process', 'R51/C6/malformed'] },
  ],
  R52: [
    { component: 'C3', ids: ['R52/C3/user-denies'] },
    { component: 'C6', ids: ['R52/C6/merge', 'R52/C6/staging'] },
  ],
  R53: [
    { component: 'C7', ids: ['R53/C7/classifier', 'R53/C7/ownership', 'R53/C7/discovery'] },
    { component: 'C10', ids: ['R53/C10/reporting'] },
  ],
  R54: [
    { component: 'C7', ids: ['R54/C7/refusal'] },
  ],
  R65: [
    { component: 'C5', ids: ['R65/C5/local', 'R65/C5/index'] },
  ],
  R66: [
    { component: 'C5', ids: ['R66/C5/limits-documentation'] },
    { component: 'C8', ids: ['R66/C8/instructions'] },
  ],
  R67: [
    { component: 'C9', ids: ['R67/C9/commands'] },
    { component: 'C10', ids: ['V2/C10/discovery'] },
  ],
  R68: [
    { component: 'C9', ids: ['R68/C9/arguments', 'R68/C9/resolution', 'R68/C9/missing'] },
  ],
  R72: [
    { component: 'C6', ids: ['R72/C6/selftest'] },
  ],
  R73: [
    { component: 'C10', ids: ['R73/C10/selftest'] },
  ],
  R74: [
    { component: 'C1', ids: ['R74/C1/case', 'R74/C1/corpus', 'R74/C1/deduplication'] },
    { component: 'C3', ids: ['R74/C3/rendering'] },
    { component: 'C4', ids: ['R74/C4/corpus'] },
    { component: 'C5', ids: ['R74/C5/corpus'] },
  ],
  R75: [
    { component: 'C1', ids: ['R75/C1/path-validation'] },
    { component: 'C4', ids: ['R75/C4/exact-case', 'R75/C4/nul-records'] },
  ],
  R76: [
    { component: 'C4', ids: ['R76/C4/arguments', 'R76/C4/revisions', 'R76/C4/isolation', 'R76/C4/failures', 'R76/C4/limits', 'R76/C4/narrowing'] },
    { component: 'C5', ids: ['R76/C5/arguments', 'R76/C5/failures'] },
  ],
  R77: [
    { component: 'C8', ids: ['R77/C8/baselines', 'R77/C8/disposition', 'R77/C8/approval', 'R77/C8/wrapper-settings', 'R77/C8/rerun-rollback', 'R77/C8/installed'] },
  ],
  R78: [
    { component: 'C1', ids: ['R78/C1/legacy-adapter'] },
    { component: 'C3', ids: ['R78/C3/baseline', 'R78/C3/migration', 'R78/C3/replacement-coverage', 'V2/C3/recovery'] },
    { component: 'C4', ids: ['R78/C4/reader-unit'] },
  ],
  R79: [
    { component: 'C2', ids: ['R79/C2/policy-schema', 'R79/C2/settings-schema', 'R79/C2/manifest-schema'] },
    { component: 'C6', ids: ['R79/C6/identity'] },
    { component: 'C10', ids: ['R79/C10/schemas', 'R79/C10/runtime-unit'] },
  ],
  R80: [
    { component: 'C2', ids: ['R80/C2/input-binding'] },
    { component: 'C3', ids: ['R80/C3/snapshot', 'R80/C3/tool-unit', 'R80/C3/manifest-after'] },
    { component: 'C4', ids: ['R80/C4/runtime-targets'] },
  ],
  R81: [
    { component: 'C3', ids: ['R81/C3/recorded-patterns'] },
    { component: 'C10', ids: ['R81/C10/baseline'] },
  ],
  R82: [
    { component: 'C3', ids: ['R82/C3/snippet'] },
    { component: 'C10', ids: ['R82/C10/snippet'] },
  ],
  R84: [
    { component: 'C6', ids: ['R84/C6/arguments'] },
  ],
  R85: [
    { component: 'C3', ids: ['R85/C3/retained-denies'] },
    { component: 'C7', ids: ['R85/C7/inventory', 'R85/C7/retirement', 'R85/C7/staging', 'R85/C7/preservation', 'R85/C7/transaction'] },
  ],
  R86: [
    { component: 'C2', ids: ['R86/C2/omissions', 'R86/C2/metadata-only', 'R86/C2/mixed-transaction', 'R29/C2/approval-noop'] },
    { component: 'C7', ids: ['R86/C7/reconciliation', 'R86/C7/binding-rollback'] },
  ],
  R90: [
    { component: 'C5', ids: ['R90/C5/committed', 'R90/C5/identity'] },
    { component: 'C8', ids: ['R90/C8/instructions'] },
  ],
  R91: [
    { component: 'C5', ids: ['R91/C5/inputs', 'R91/C5/artifacts', 'R91/C5/links', 'R91/C5/publication'] },
  ],
  R92: [
    { component: 'C5', ids: ['R92/C5/reserved', 'R92/C5/cleanup', 'R92/C5/stdout'] },
    { component: 'C8', ids: ['R92/C8/instructions'] },
    { component: 'C10', ids: ['V2/C10/run-inventory'] },
  ],
  R93: [
    { component: 'C9', ids: ['R93/C9/values', 'R93/C9/merge', 'R93/C9/keys-input', 'R93/C9/vault', 'R93/C9/instructions', 'R93/C9/permissions'] },
  ],
  R97: [
    { component: 'C1', ids: ['R97/C1/environment-names'] },
    { component: 'C3', ids: ['R97/C3/environment-controls'] },
    { component: 'C4', ids: ['R97/C4/environment-names'] },
    { component: 'C5', ids: ['R97/C5/environment-names'] },
    { component: 'C9', ids: ['R97/C9/template-boundary'] },
    { component: 'C10', ids: ['V2/C10/discovery'] },
  ],
  R100: [
    { component: 'C5', ids: ['R100/C5/limits', 'R100/C5/narrowing'] },
  ],
  'A5-templates': [
    { component: 'C8', ids: ['A5-templates/C8/agents', 'A5-templates/C8/wrappers', 'A5-templates/C8/boundary', 'A5-templates/C8/launcher', 'A5-templates/C8/setup', 'A5-templates/C8/migration', 'A5-templates/C8/narrowing'] },
    { component: 'C10', ids: ['V2/C10/contracts'] },
  ],
  'N8-doctor': [
    { component: 'C10', ids: ['N8-doctor/C10/arguments', 'N8-doctor/C10/entrypoints', 'N8-doctor/C10/context', 'N8-doctor/C10/configuration', 'N8-doctor/C10/logs', 'N8-doctor/C10/processes', 'N8-doctor/C10/negative-actions', 'N8-doctor/C10/cli'] },
  ],
});

// ------------------------------------------------------------- memo ----
const failure = (message) => ({ failures: [message], skipped: null });

/**
 * Plan 4.1: one execution per component for the lifetime of the factory. `run` is the uncached
 * runComponentAssertions (or a recording stand-in), `fs` provides mkdirSync and writeFileSync, `tmpRoot` is the suite
 * temporary directory and `baseContext` is { repository, skillRoot, env } for complete-only requests.
 * The inputs are trusted test infrastructure and are not validated (C11b-P3-1). Creating a memo does no work.
 */
export function createComponentMemo({ run, fs, tmpRoot, baseContext }) {
  const cache = new Map();

  // The first call executes run(component, context) and keeps the promise; later calls, concurrent or not, share it,
  // including a rejection or a failed report. Nothing is retried.
  function runComponentAssertions(component, context) {
    if (cache.has(component)) return cache.get(component);
    const promise = (async () => {
      const report = await run(component, context);
      try {
        // Exclusive, exactly once, after the report resolves and before the cached promise resolves.
        fs.writeFileSync(path.join(context.tmp, 'integration-results.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
      } catch {
        const err = new Error(`RC1_COMPOSITION: evidence write failed ${component}`);
        err.code = 'RC1_EVIDENCE_WRITE';
        throw err;
      }
      return report;
    })();
    cache.set(component, promise);
    return promise;
  }

  // The complete-case provider: an already requested component is returned as is, otherwise its lowercased directory
  // is created (only now) and the shared promise is started with the baseline context shape.
  function getComponent(component) {
    if (cache.has(component)) return cache.get(component);
    const tmp = path.join(tmpRoot, component.toLowerCase());
    fs.mkdirSync(tmp, { recursive: true });
    return runComponentAssertions(component, {
      repository: baseContext.repository,
      skillRoot: baseContext.skillRoot,
      tmp,
      env: { ...baseContext.env },
    });
  }

  return { runComponentAssertions, getComponent };
}

// ------------------------------------------------------- composition ----
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isCount = (n) => Number.isInteger(n) && n >= 0;
const isLine = (s) => typeof s === 'string' && s !== '' && !/[\r\n]/.test(s);

// A structural-error report is { ok:false, one well-shaped error, zero counts, no results } (the component runner's
// contract). A well-shaped error has a code string and, when present, an id that is a string or null.
function validErrorEnvelope(report) {
  if (report.ok !== false || report.errors.length !== 1 || report.results.length !== 0) return false;
  const s = report.summary;
  if (s.passed !== 0 || s.failed !== 0 || s.skipped !== 0) return false;
  const e = report.errors[0];
  if (!isObj(e) || !isLine(e.code)) return false;
  return !('id' in e) || e.id === null || typeof e.id === 'string';
}

function validShape(report, component) {
  if (!isObj(report) || report.component !== component || typeof report.ok !== 'boolean') return false;
  if (!Array.isArray(report.errors) || !Array.isArray(report.results)) return false;
  const s = report.summary;
  return isObj(s) && isCount(s.passed) && isCount(s.failed) && isCount(s.skipped);
}

function validResult(r) {
  if (!isObj(r) || !isLine(r.id) || !isLine(r.name) || !Array.isArray(r.failures) || r.failures.some((f) => typeof f !== 'string')) return false;
  if (r.status === 'PASS') return r.failures.length === 0;
  if (r.status === 'FAIL') return r.failures.length > 0;
  return false;
}

// The first diagnostic for one required component, or null when the whole report is a clean pass (plan 4.1).
function checkComponent(component, ids, report, expected) {
  const diag = (kind, id) => `RC1_COMPOSITION: ${kind} ${id === undefined ? component : id}`;
  if (report === undefined || report === null) return diag('missing component');
  if (!validShape(report, component)) return diag('invalid component report');
  const descriptors = isObj(expected) && Array.isArray(expected[component]) ? expected[component] : null;
  if (descriptors === null) return diag('invalid component report');
  const expectedIds = descriptors.map((d) => d.id);

  // Report-level structural errors take precedence over every result-level check.
  if (report.errors.length > 0) {
    if (!validErrorEnvelope(report)) return diag('invalid component report');
    const e = report.errors[0];
    if (e.code === 'missing-group' && typeof e.id === 'string' && expectedIds.includes(e.id)) return diag('missing assertion', e.id);
    return diag('invalid component report');
  }

  // Result-level checks, only for a report without structural errors.
  const results = report.results;
  const passed = results.filter((r) => isObj(r) && r.status === 'PASS').length;
  const failed = results.filter((r) => isObj(r) && r.status === 'FAIL').length;
  const arithmetic = report.summary.passed === passed && report.summary.failed === failed && report.summary.skipped === 0
    && passed + failed === results.length && report.ok === (results.length > 0 && failed === 0);
  if (!results.every(validResult) || !arithmetic) return diag('invalid component report');
  const seen = new Set();
  for (const r of results) {
    if (seen.has(r.id) || !expectedIds.includes(r.id)) return diag('invalid component report'); // duplicate or unexpected
    seen.add(r.id);
  }
  for (const r of results) {
    if (r.name !== descriptors[expectedIds.indexOf(r.id)].name) return diag('invalid component report'); // changed name
  }
  const missing = expectedIds.find((id) => !seen.has(id));
  if (missing !== undefined) return diag('missing assertion', missing);
  if (!results.every((r, i) => r.id === expectedIds[i])) return diag('invalid component report'); // reordered
  const absent = ids.find((id) => !seen.has(id)); // a required literal ID the inventory does not carry
  if (absent !== undefined) return diag('missing assertion', absent);
  if (failed > 0) return diag('component failed');
  return null;
}

/**
 * Plan 4.1: pure. `reports` is a Map from component name to report and `expectedAssertions` the complete
 * expected-descriptor map supplied by the caller (the registry passes COMPONENT_ASSERTIONS at call time). Returns
 * { failures: [], skipped: null } for a clean pass and otherwise exactly one RC1_COMPOSITION diagnostic.
 */
export function composeCaseOutcome(id, reports, expectedAssertions) {
  const required = Object.prototype.hasOwnProperty.call(CASE_REQUIREMENTS, id) ? CASE_REQUIREMENTS[id] : null;
  if (required === null) return failure(`RC1_COMPOSITION: unknown case ${id}`);
  const map = reports instanceof Map ? reports : new Map();
  for (const { component, ids } of required) {
    const message = checkComponent(component, ids, map.get(component), expectedAssertions);
    if (message !== null) return failure(message);
  }
  return { failures: [], skipped: null };
}
