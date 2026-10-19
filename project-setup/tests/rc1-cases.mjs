// rc.1 case inventory, component assertion registry, suite selection and component execution.
//
// Plan: docs/plans/2026-10-15-project-setup-v3-rc1-c11a.md sections 2.5, 3.1 and 3.3, with decisions G8, G9 and G11.
// Component assertions are sub-assertions (for example V2/C11a/tag-identity). They never produce a complete
// numbered case record; complete rc.1 cases are composed by C11b through registerRc1Cases.
//
// Importing this module performs no filesystem write, starts no process and runs no test. The test modules it
// imports are import-safe as well and load this module lazily, so there is no eager read across the cycle.
import { C11A_IMPLEMENTATIONS } from './c11a.test.mjs';
import { C1_IMPLEMENTATIONS } from './c1.test.mjs';
import { C2_IMPLEMENTATIONS } from './c2.test.mjs';
import { C3_IMPLEMENTATIONS } from './c3.test.mjs';
import { C4_IMPLEMENTATIONS } from './c4.test.mjs';
import { C5_IMPLEMENTATIONS } from './c5.test.mjs';
import { C6_IMPLEMENTATIONS } from './c6.test.mjs';
import { C7_IMPLEMENTATIONS } from './c7.test.mjs';

const deepFreeze = (v) => { if (v && typeof v === 'object') { for (const x of Object.values(v)) deepFreeze(x); Object.freeze(v); } return v; };
const ids = (s) => s.trim().split(/\s+/);

// ------------------------------------------------------------ inventory ----
// Plan 3.3, in its frozen order. G8: RC1 is the 38 numbered IDs then A5-templates and N8-doctor.
export const BASELINE_CASE_IDS = Object.freeze(ids(`
  R01 R02 R03a R03b R04a R04b R05 R06 R06b R07 R08 R09 R10 R11 R12
  R13a R13b R13c R13d R14a R14b R15 R16 R17 R18 R19 R20 R21 R22
  R23a R23b R24 R25 R26 R27a R27b R27c R27d R28 R29 R30 R31 R32
  R33 R34 R35 R36 R37 R38 R39 R40
  S01 S02 S03 S04 S05 S06 S07 S08 S09
`));
export const RC1_CASE_IDS = Object.freeze([...ids(`
  R41 R42 R43 R44 R45 R46 R47 R48 R49 R50 R51 R52 R53 R54
  R65 R66 R67 R68 R72 R73 R74 R75 R76 R77 R78 R79 R80 R81 R82
  R84 R85 R86 R90 R91 R92 R93 R97 R100
`), 'A5-templates', 'N8-doctor']);
export const REQUIRED_CASE_IDS = Object.freeze([...BASELINE_CASE_IDS, ...RC1_CASE_IDS]);

// ------------------------------------------------------------- registry ----
// Expected descriptors are written out here, never derived from the implementations (plan 2.5).
// C1-C10 add their own component keys to both maps.
export const COMPONENT_ASSERTIONS = deepFreeze({
  C11a: [
    { id: 'V2/C11a/tag-identity', name: 'trusted v2 tag identity' },
    { id: 'V2/C11a/snapshot-inventory', name: 'exhaustive v2 snapshot mapping' },
    { id: 'V2/C11a/snapshot-bytes', name: 'raw tagged snapshot byte parity' },
    { id: 'V2/C11a/installed-fixture', name: 'tagged v2 installation and provenance' },
    { id: 'V2/C11a/fixture-failures', name: 'v2 fixture failures are fatal' },
    { id: 'V2/C11a/live-v2', name: 'live v2 fixture and existing kinds' },
    { id: 'V2/C11a/component-records', name: 'strict component result contract' },
    { id: 'V2/C11a/strict-gate', name: 'strict rc1 acceptance contract' },
  ],
  // C1 plan (docs/plans/2026-10-16-project-setup-v3-rc1-c1.md) section 4.1, in its exact order.
  C1: [
    { id: 'R45/C1/grammar', name: 'policy grammar and PQ1 rejection' },
    { id: 'R45/C1/schema', name: 'strict policy schemas and errors' },
    { id: 'R44/C1/anchors', name: 'root and any-depth matching' },
    { id: 'R74/C1/case', name: 'platform-independent case matching' },
    { id: 'R74/C1/corpus', name: 'shared policy matching corpus' },
    { id: 'R74/C1/deduplication', name: 'effective entries preserve source metadata' },
    { id: 'R75/C1/path-validation', name: 'structural checks preserve exact path names' },
    { id: 'R78/C1/legacy-adapter', name: 'validated non-writing schema-1 adapter' },
    { id: 'R97/C1/environment-names', name: 'environment-name variant matching' },
    { id: 'V2/C1/source-helpers', name: 'source helpers use shared policy semantics' },
    { id: 'V2/C1/exception-overlap', name: 'user exception overlap stays conservative' },
    { id: 'V2/C1/module-contract', name: 'standalone module and component contracts' },
  ],
  // C2 plan (docs/plans/2026-10-17-project-setup-v3-rc1-c2.md) section 7.1, in its exact order.
  C2: [
    { id: 'R79/C2/policy-schema', name: 'complete policy ownership metadata' },
    { id: 'R79/C2/settings-schema', name: 'permission and hook ownership schemas' },
    { id: 'R79/C2/manifest-schema', name: 'manifest schema 3 and legacy input' },
    { id: 'R86/C2/omissions', name: 'exact persistent omission identities' },
    { id: 'R86/C2/metadata-only', name: 'approved metadata without content writes' },
    { id: 'R86/C2/mixed-transaction', name: 'one content and metadata transaction' },
    { id: 'R80/C2/input-binding', name: 'all approved inputs remain bound' },
    { id: 'R02/C2/diff-output', name: 'deterministic read-only draft review' },
    { id: 'R02/C2/no-git', name: 'draft review invokes no Git' },
    { id: 'R02/C2/diff-safety', name: 'secret and unsafe targets are refused' },
    { id: 'R15/C2/metadata-binding', name: 'metadata presence and bytes are approved' },
    { id: 'R29/C2/approval-noop', name: 'unchanged-file approvals and genuine no-op' },
    { id: 'V2/C2/recovery', name: 'metadata transaction recovery preserves later edits' },
    { id: 'V2/C2/module-contract', name: 'shared exports and component registration' },
  ],
  // C3 plan (docs/plans/2026-10-18-project-setup-v3-rc1-c3.md) section 4.1, in its exact order.
  C3: [
    { id: 'R44/C3/anchors', name: 'anchored control rendering' },
    { id: 'R47/C3/project-controls', name: 'project patterns reach every rendered control' },
    { id: 'R74/C3/rendering', name: 'shared corpus and stored rendering spelling' },
    { id: 'R48/C3/project-moves', name: 'approved project pattern moves' },
    { id: 'R78/C3/baseline', name: 'installed records establish baseline identity' },
    { id: 'R78/C3/migration', name: 'versioned migration preserves project fields' },
    { id: 'R78/C3/replacement-coverage', name: 'replacement coverage needs its own decision' },
    { id: 'R52/C3/user-denies', name: 'identical user denies stay user owned' },
    { id: 'R85/C3/retained-denies', name: 'retired deny bytes and ownership survive' },
    { id: 'R80/C3/snapshot', name: 'one approved snapshot binds migration outputs' },
    { id: 'R80/C3/tool-unit', name: 'policy migration requires compatible reviewed tools' },
    { id: 'R80/C3/manifest-after', name: 'commit verifies the derived manifest' },
    { id: 'R81/C3/recorded-patterns', name: 'recorded patterns distinguish drift and behind' },
    { id: 'R82/C3/snippet', name: 'recorded snippet hash detects stale rendering' },
    { id: 'R97/C3/environment-controls', name: 'environment variants receive rendered coverage' },
    { id: 'Q4/C3/scan-labels', name: 'protected findings remain scanned and redacted' },
    { id: 'V2/C3/recovery', name: 'coupled migration rolls back through one journal' },
    { id: 'V2/C3/module-contract', name: 'C3 exports errors and component contracts' },
  ],
  // C4 plan (docs/plans/2026-10-18-project-setup-v3-rc1-c4.md) section 4.1, in its exact order.
  C4: [
    { id: 'R41/C4/cat', name: 'commit blob reads and secret refusals' },
    { id: 'R42/C4/ls', name: 'literal tree listings omit protected paths' },
    { id: 'R42/C4/grep', name: 'tree grep filters secrets and distinguishes no match' },
    { id: 'R43/C4/history', name: 'historical secret paths remain protected' },
    { id: 'R47/C4/project-policy', name: 'project additions reach Git commands' },
    { id: 'R74/C4/corpus', name: 'shared policy corpus reaches Git consumers' },
    { id: 'R75/C4/exact-case', name: 'Git lookup preserves exact path case' },
    { id: 'R75/C4/nul-records', name: 'NUL records preserve unusual path names' },
    { id: 'R76/C4/arguments', name: 'explicit command grammars and literal selectors' },
    { id: 'R76/C4/revisions', name: 'content commands receive resolved commits' },
    { id: 'R76/C4/isolation', name: 'Git configuration and executable filters are isolated' },
    { id: 'R76/C4/failures', name: 'policy and Git failures emit no content' },
    { id: 'R76/C4/limits', name: 'whole results obey the exact byte limit' },
    { id: 'R76/C4/narrowing', name: 'limit diagnostics preserve incomplete review scope' },
    { id: 'R97/C4/environment-names', name: 'environment name variants stay protected' },
    { id: 'R80/C4/runtime-targets', name: 'every plan requires a complete reviewed runtime unit' },
    { id: 'R78/C4/reader-unit', name: 'reviewed reader opens schema two migration' },
  ],
  // C5 plan (docs/plans/2026-10-19-project-setup-v3-rc1-c5.md) section 4.1, in its exact order.
  C5: [
    { id: 'R65/C5/local', name: 'local review includes safe working changes' },
    { id: 'R65/C5/index', name: 'local review leaves the index and Git state unchanged' },
    { id: 'R66/C5/limits-documentation', name: 'copied secret content limitation is documented' },
    { id: 'R90/C5/committed', name: 'committed review excludes trusted checkout changes' },
    { id: 'R90/C5/identity', name: 'review headers record resolved comparison identity' },
    { id: 'R91/C5/inputs', name: 'disk inputs are checked before content reads' },
    { id: 'R91/C5/artifacts', name: 'artifact paths and names are confined' },
    { id: 'R91/C5/links', name: 'links junctions and escapes are refused' },
    { id: 'R91/C5/publication', name: 'exclusive publication preserves existing files' },
    { id: 'R92/C5/reserved', name: 'setup lifecycle rejects reserved review aliases' },
    { id: 'R92/C5/cleanup', name: 'setup cleanup preserves review artifacts' },
    { id: 'R92/C5/stdout', name: 'stdout review creates no artifacts' },
    { id: 'R74/C5/corpus', name: 'shared policy corpus reaches both review modes' },
    { id: 'R76/C5/arguments', name: 'review grammar and Git vectors are pinned' },
    { id: 'R76/C5/failures', name: 'review failures emit no partial content' },
    { id: 'R97/C5/environment-names', name: 'environment name variants stay excluded' },
    { id: 'R100/C5/limits', name: 'complete review results obey the byte limit' },
    { id: 'R100/C5/narrowing', name: 'literal narrowing covers safe review subsets' },
  ],
  // C6 plan (docs/plans/2026-10-19-project-setup-v3-rc1-c6.md) section 4.1, in its exact order.
  C6: [
    { id: 'R50/C6/parser', name: 'raw Git parser handles frozen command forms' },
    { id: 'R50/C6/sanctioned', name: 'seven sanctioned commands preserve later raw Git checks' },
    { id: 'R50/C6/documentation', name: 'hook limitations and host verification remain explicit' },
    { id: 'R51/C6/process', name: 'hook stdin streams and alternate paths are exact' },
    { id: 'R51/C6/malformed', name: 'malformed input follows the frozen fail-open contract' },
    { id: 'R52/C6/merge', name: 'conditional hook merge preserves users and reruns' },
    { id: 'R52/C6/staging', name: 'hooks-only staging preserves migration projections' },
    { id: 'R79/C6/identity', name: 'hook identity preserves event matcher options and order' },
    { id: 'V2/C6/transaction', name: 'hook settings and ownership share existing approval rules' },
    { id: 'R72/C6/selftest', name: 'installed hook self-test reports exact outcomes' },
    { id: 'V2/C6/runtime-unit', name: 'hook assets extend the reviewed runtime unit' },
    { id: 'R84/C6/arguments', name: 'stash patch and alias rules preserve orchestrator commands' },
  ],
  // C7 plan (docs/plans/2026-10-19-project-setup-v3-rc1-c7.md) section 4.1, in its exact order.
  C7: [
    { id: 'R53/C7/classifier', name: 'shared allows receive exact classes and severities' },
    { id: 'R53/C7/ownership', name: 'validated exact ownership controls classification' },
    { id: 'R53/C7/discovery', name: 'discovery reports shared rules and personal settings guidance' },
    { id: 'R54/C7/refusal', name: 'merge refuses new managed execution permissions' },
    { id: 'R85/C7/inventory', name: 'every installed managed allow is listed' },
    { id: 'R85/C7/retirement', name: 'retirement removes only selected managed identities' },
    { id: 'R85/C7/staging', name: 'allow staging preserves deny and hook projections' },
    { id: 'R85/C7/preservation', name: 'unselected rules and unchanged bytes survive' },
    { id: 'R85/C7/transaction', name: 'approved retirement commits content and omissions together' },
    { id: 'R86/C7/reconciliation', name: 'absent allows reconcile through metadata operations' },
    { id: 'R86/C7/binding-rollback', name: 'retirement bindings and rollback preserve reviewed state' },
    { id: 'V2/C7/contracts', name: 'C7 exports errors and component contracts are exact' },
  ],
});
// The tests-lane descriptors themselves (same objects, same run functions), in a frozen list of our own.
export const COMPONENT_IMPLEMENTATIONS = Object.freeze({
  C11a: Object.freeze([...C11A_IMPLEMENTATIONS]),
  C1: Object.freeze([...C1_IMPLEMENTATIONS]),
  C2: Object.freeze([...C2_IMPLEMENTATIONS]),
  C3: Object.freeze([...C3_IMPLEMENTATIONS]),
  C4: Object.freeze([...C4_IMPLEMENTATIONS]),
  C5: Object.freeze([...C5_IMPLEMENTATIONS]),
  C6: Object.freeze([...C6_IMPLEMENTATIONS]),
  C7: Object.freeze([...C7_IMPLEMENTATIONS]),
});

// ------------------------------------------------------------ selection ----
// G11: every SUITE_* error carries the token in err.code and starts its message with it.
function suiteError(code, detail) {
  const e = new Error(`${code}: ${detail}`);
  e.code = code;
  return e;
}
const singleLine = (s) => typeof s === 'string' && s !== '' && !/[\r\n\u2028\u2029]/.test(s);

/**
 * Pure selection over { id, name, fn } cases, in registration order. `only` keeps the diagnostic substring match
 * against "<id> <name>"; `onlyId` matches the ID exactly. Returns the original case objects.
 */
export function selectSuiteCases(cases, options) {
  const o = options === undefined ? {} : options;
  if (o === null || typeof o !== 'object' || Array.isArray(o)) throw suiteError('SUITE_USAGE', 'options must be an object');
  const only = o.only === undefined ? null : o.only;
  const onlyId = o.onlyId === undefined ? null : o.onlyId;
  for (const [k, v] of [['only', only], ['onlyId', onlyId]]) {
    if (v !== null && (typeof v !== 'string' || v === '')) throw suiteError('SUITE_USAGE', `${k} must be a nonempty string`);
  }
  if (only !== null && onlyId !== null) throw suiteError('SUITE_USAGE', 'only and onlyId are mutually exclusive');
  if (!Array.isArray(cases)) throw suiteError('SUITE_CASE_INVALID', 'cases must be an array');
  cases.forEach((c, i) => {
    if (!c || typeof c !== 'object' || !singleLine(c.id) || !singleLine(c.name) || typeof c.fn !== 'function') {
      throw suiteError('SUITE_CASE_INVALID', `case ${i}`);
    }
  });
  const seen = new Set();
  for (const c of cases) {
    if (seen.has(c.id)) throw suiteError('SUITE_DUPLICATE_ID', c.id);
    seen.add(c.id);
  }
  const selected = cases.filter((c) => (onlyId !== null ? c.id === onlyId : only !== null ? `${c.id} ${c.name}`.includes(only) : true));
  if (!selected.length) throw suiteError('SUITE_EMPTY_SELECTION', onlyId !== null ? `no case has id ${onlyId}` : 'no case selected');
  return selected;
}

// --------------------------------------------------- component execution ----
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => isObj(o) && Object.prototype.hasOwnProperty.call(o, k);
const zero = () => ({ passed: 0, failed: 0, skipped: 0 });

// Plan 3.1: the first structural error in category order, or null. G9: inventory-invalid always carries id.
function structuralIssue(component, registry) {
  const expectedMap = isObj(registry) ? registry.expected : undefined;
  if (!own(expectedMap, component) || expectedMap[component] === undefined) return { code: 'component-unknown' };
  const expected = expectedMap[component];
  const implMap = isObj(registry) ? registry.implementations : undefined;
  const impls = own(implMap, component) && implMap[component] !== undefined ? implMap[component] : [];
  if (!Array.isArray(expected) || !Array.isArray(impls)) return { code: 'inventory-invalid', id: null };
  // Within a category the first issue is the one with the earliest expected position; an issue with no expected
  // position (a malformed implementation ID, or an ID nobody expects) follows, in implementation order.
  const position = (id) => expected.findIndex((d) => isObj(d) && d.id === id);
  const invalid = [];
  expected.forEach((d, i) => {
    if (!isObj(d) || !singleLine(d.id)) invalid.push({ pos: i, id: null });
    else if (!singleLine(d.name)) invalid.push({ pos: i, id: d.id });
  });
  impls.forEach((m, i) => {
    if (!isObj(m) || !singleLine(m.id)) invalid.push({ pos: Infinity, at: i, id: null });
    else if (typeof m.run !== 'function') { const p = position(m.id); invalid.push({ pos: p < 0 ? Infinity : p, at: i, id: m.id }); }
  });
  if (invalid.length) {
    invalid.sort((a, b) => a.pos - b.pos || (a.at ?? -1) - (b.at ?? -1));
    return { code: 'inventory-invalid', id: invalid[0].id };
  }
  if (!expected.length) return { code: 'empty-inventory' };
  const expIds = expected.map((d) => d.id);
  const dupExp = expIds.find((id) => expIds.filter((x) => x === id).length > 1);
  if (dupExp !== undefined) return { code: 'duplicate-expected', id: dupExp };
  const implIds = impls.map((m) => m.id);
  const count = (id) => implIds.filter((x) => x === id).length;
  const dupImpl = expIds.find((id) => count(id) > 1) ?? implIds.find((id) => count(id) > 1);
  if (dupImpl !== undefined) return { code: 'duplicate-group', id: dupImpl };
  const extra = implIds.find((id) => !expIds.includes(id));
  if (extra !== undefined) return { code: 'unexpected-group', id: extra };
  const missing = expIds.find((id) => !implIds.includes(id));
  if (missing !== undefined) return { code: 'missing-group', id: missing };
  return null;
}

function outcomeFailures(outcome) {
  if (!isObj(outcome) || !Array.isArray(outcome.failures) || outcome.failures.some((f) => typeof f !== 'string')
    || !('skipped' in outcome) || (outcome.skipped !== null && typeof outcome.skipped !== 'string')) return ['invalid-outcome'];
  const failures = [...outcome.failures];
  if (outcome.skipped !== null) failures.push(`skip-forbidden: ${outcome.skipped}`); // a skip is never a pass
  return failures;
}

/** Validates the registry for one component, then runs each implementation once in expected order. */
export async function runComponentAssertions(component, context, { registry } = {}) {
  const reg = registry === undefined ? { expected: COMPONENT_ASSERTIONS, implementations: COMPONENT_IMPLEMENTATIONS } : registry;
  const issue = structuralIssue(component, reg);
  if (issue) return { component, ok: false, errors: [issue], summary: zero(), results: [] };
  const impls = reg.implementations[component];
  const results = [];
  for (const d of reg.expected[component]) {
    const impl = impls.find((m) => m.id === d.id);
    let failures;
    try { failures = outcomeFailures(await impl.run(context)); } catch (e) {
      failures = [`threw: ${e instanceof Error ? e.message : String(e)}`];
    }
    results.push({ id: d.id, name: d.name, status: failures.length ? 'FAIL' : 'PASS', failures });
  }
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.length - passed;
  return { component, ok: results.length > 0 && failed === 0, errors: [], summary: { passed, failed, skipped: 0 }, results };
}

/**
 * Registers complete rc.1 cases with the baseline runner: register(id, name, fn).
 * At C11a landing there are none; C11b composes them from the component assertions.
 */
export function registerRc1Cases(register, context) {
  void register;
  void context;
}
