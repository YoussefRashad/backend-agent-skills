<!--
FROZEN 2026-10-21 on branch feat/project-setup-v3-rc1. Never edit this file; changes go through the
maintainer. Component plan C12 (review fixes, lands after C11b) under the frozen architecture plan
docs/plans/2026-10-15-project-setup-v3-rc1.md, which takes precedence, on the landed C11a, C1-C10
and C11b contracts. Scope: findings F1-F6 of the whole-branch review of 2026-10-21 (CodeRabbit,
security review, skill-reviewer), approved by the maintainer. Drafted by the plan lane (Codex, 1
revision); plan-critique (Claude) round 2 found no BLOCKING gap. K14 was dropped by the
orchestrator (the CI change is its own commit). The addendum at the end records round 2's items.
-->

# C12. Review fixes

Date: 2026-10-21.

**C12-1 - Scope and boundaries**

Implement "C12 review fixes" on `feat/project-setup-v3-rc1`, starting from verified HEAD `7e9db16`,
before the PR.

Address F1-F6 and the verified critique amendments below. Preserve landed C11a, C1-C10, and C11b
contracts except for changes expressly authorized by this plan.

Out of scope: tagging, publication, deployment, dependencies, installer or release-builder redesign,
new policy schemas, new runtime catalog members, host-enforcement claims, general shell parsing, and
unrelated review residuals. Preserve every MUST, protection, approval requirement, and pending host
measurement.

The commit after `2475938` changes only `.github/workflows/ci.yml` and the root `README.md`. Those
committed changes are unrelated to C12 and remain untouched. K14 is dropped.

Frozen plans, decisions, historical snapshots, and the C11b acceptance record remain unchanged. This
plan records amendments without editing those sources.

**C12-2 - Verified findings**

All F1-F6 findings remain confirmed. None is dropped.

| Finding | Verified evidence |
|---|---|
| F1 | `project-setup/SKILL.md:215` permits default-policy replacement outside migration. `scripts/apply.mjs:786` gates schema-2 drafts only; the shipped default is schema 1. |
| F2 | Rule 2 names only shipped defaults, while apply and detect use the shipped-plus-installed refusal set. |
| F3 | All seven named scripts compare path spellings without native-realpath fallback. Doctor, validate, hooks-selftest, and release already handle alternate paths. |
| F4 | `guard-raw-git-core.mjs:333-389` neither consumes nor checks `--config-env`. Its `-c` path restricts only `alias.*`. |
| F5 | The self-test integration statement and prospective v2 labels are stale. Docs-sync contains reviewer-specific wording. |
| F6 | C11b normalizes away the intended `..`; C2/C3 observers omit builtin ESM synchronization; the C3 shim control accepts failure without intercepted calls. |

K1-K13 and K15 are confirmed against the cited implementation and tests. Their constraints are
incorporated below.

C3 intentionally supports reviewed managed-pattern moves, omissions, and broader replacement
coverage. Its resolver preserves existing `projectPatterns` and produces schema 2. C12 must stop
ordinary policy resets while retaining those reviewed operations.

**C12-3 - Policy drafting, update triggers, and ownership**

Rewrite Phase 1 step 3 and align the relevant references:

- With **no installed policy**, copying the shipped schema-1 default remains the existing
  fresh-install path, with `full` ownership.
- With an **installed policy**, never copy `data/secret-paths.json` over it. Stage no policy draft
  unless:
  - detect reports mode `update` with a schema-2 manifest;
  - security-state inspection reports managed patterns behind the skill or an unknown installed
    baseline; or
  - the user requests a policy change.
- For those cases, run migration report, record explicit decisions, then stage. Preserve the
  complete v2 update transaction required by `references/migration-v2.md`.
- An invalid or unreadable installed policy is an error, never evidence of absence. Preserve
  existing repair and drift handling.
- A migration-staged policy has `keys` ownership. Managed metadata contains managed `patterns`,
  never `projectPatterns`.
- A rerun without a policy draft preserves the installed ownership record.

This retains delivery of new default coverage, including `**/.env*`, `**/*.cert`, and
`**/.htpasswd`, through reviewed migration rather than replacement.

Update `references/security.md:8-9` to describe these triggers and the report/decisions/stage
workflow. Clarify the fresh-policy ownership exception in `references/state-and-apply.md` and remove
the misleading implication in `references/docs-generation.md` that every installed policy is fully
managed.

Preserve verbatim:

- The existing seven-name runtime fence.
- The paragraph beginning "Stage all seven runtime members as one reviewed compatible unit."
- Existing workflow sequence blocks.
- Settings/hook/allow-retirement ordering.

Add none of C9's forbidden substrings and no `--file` text to SKILL.md or references.

**C12-4 - Mechanical policy gate, placement, and precedence**

Add a private gate in `scripts/apply.mjs`. It applies when an installed policy exists and a policy
operation has action `create` or `modify`. No policy operation, an `unchanged` operation, or no
installed policy adds no new refusal.

Parse installed and proposed policy text with C1's `parseSecurityPolicy`. Obtain `sourceSchema` from
that parse. Compute identities by applying `policyEntryKey` to the parsed `.policy.patterns` and
`.policy.projectPatterns`, after schema-1 anchor inference. Never apply it to raw schema-1 entries.

Use set semantics separately for each collection:

- Downgrading `sourceSchema` is refused.
- Losing an installed `projectPatterns` identity is refused, including moving it into managed
  `patterns`.
- Without migration decisions/evidence, losing an installed `patterns` identity is refused. Moving
  it to `projectPatterns` or replacing it with broader coverage requires migration.
- With validated migration evidence at prepare/review, or `plan.security` at commit, managed-pattern
  loss retains C3's existing reviewed semantics. Downgrade and project-pattern loss remain
  forbidden.
- With an installed policy, any proposed draft rejected by C1 with a `POLICY_*` error, including
  invalid JSON, is refused by this gate. Do not echo the C1 message or rejected content.
- Without an installed policy, an invalid draft retains ordinary C2 handling; C12 does not extend
  validation to fresh drafts.

Use code `APPLY_POLICY_REGRESSION`, exit 3, target `.ai/security-paths.json`, with this fixed text:

```text
policy draft is invalid, lowers the schema, or removes installed entries outside the reviewed migration workflow
```

Place the gate exactly as follows:

| Path | Placement |
|---|---|
| `analyze`, for prepare and unprepared diff | Inside the existing C3 `try` block: after `MIGRATION_REQUIRED` when decisions are absent, or after `securityEvidence` succeeds when present; before `checkCompleteUnit`. |
| Prepared diff | After the `plan.security` evidence block, or immediately before `checkCompleteUnit` when no security block exists. |
| Commit | Immediately after the existing `MIGRATION_REQUIRED` check; before `commitToolUnit`, `checkCompleteUnit`, and `verifyManifest`. |

Throw `c3Fail(POLICY_REL, 'APPLY_POLICY_REGRESSION', fixedText)` so analyze produces one control
rejection and never evaluates approvals afterward. Prepare uses its existing P envelope; diffs and
commit use their existing F envelope with `target`.

Existing path safety, structural refusals, binding drift, `MIGRATION_REQUIRED`,
`MIGRATION_DECISIONS*`, `MIGRATION_REPORT_CHANGED`, and `MIGRATION_OUTPUT_MISMATCH` retain
precedence. Do not add a new migration-workflow check to prepared diff.

`--approve-user-content` cannot bypass the gate.

Commit checks bound installed/draft bytes and preserves C3's contract: it does not resolve decisions
or render projections again. `plan.security` retains its existing meaning; the new gate
independently checks invalid drafts, schema downgrade, and project-pattern loss.

No new plan fields, metadata formats, exports, or schema versions.

**C12-5 - Policy acceptance matrix**

Earlier errors listed in C12-4 take precedence over every row below. Use otherwise valid fixtures to
isolate the new gate.

| Condition | Required result |
|---|---|
| Installed policy absent, valid fresh draft | Existing fresh-install success and ownership behavior. |
| Installed policy absent, invalid draft | Existing ordinary C2 behavior remains unchanged, including `c2.test.mjs:3677-3684`. |
| Installed policy invalid/unreadable | Existing installed-policy or input error; no fallback. |
| Policy draft absent or unchanged | No new refusal or migration requirement. |
| Installed policy present; draft invalid JSON or C1-invalid schema-1 policy; no decisions | `APPLY_POLICY_REGRESSION` in prepare, both diffs, and commit, with no C1 message echoed. |
| C1-invalid draft also triggers the existing schema-2 workflow gate | Existing `MIGRATION_REQUIRED` wins wherever that check already runs. |
| Installed policy present; invalid draft; valid decisions otherwise | `MIGRATION_OUTPUT_MISMATCH` at prepare and both reviews. A bound, hash-approved forged commit reaches `APPLY_POLICY_REGRESSION`. |
| Schema 1 with additions replaced by shipped schema-1 defaults | `APPLY_POLICY_REGRESSION`, including when content approval is supplied. |
| Schema 2 replaced by schema 1, no decisions | `APPLY_POLICY_REGRESSION`. |
| Schema 2 replaced by schema 1, decisions present | `MIGRATION_OUTPUT_MISMATCH` at prepare and reviews; `APPLY_POLICY_REGRESSION` at commit of an otherwise valid, hash-approved forged plan. |
| One managed identity removed in a schema-1 draft without migration | `APPLY_POLICY_REGRESSION`, with or without catalog runtime consumers. |
| One managed identity removed in a schema-2 draft with runtime consumers and no decisions | Existing `MIGRATION_REQUIRED` at prepare, unprepared diff, and commit. |
| One project identity removed, renamed, narrowed, or moved to managed patterns | Regression refusal when reached; existing migration/workflow errors still win first. |
| Schema 1 -> 2, identities retained, no catalog runtime installed or staged | Passes the new gate and existing workflow gate; other existing checks still apply. |
| Same conversion with runtime consumers and no decisions | Existing `MIGRATION_REQUIRED`. |
| Identity retained with case changes, inferred anchors, reordering, or duplicate copies | No set-loss refusal. Existing content and metadata approval checks remain. |
| Additive draft | No regression refusal; existing migration requirements remain. |
| Decisions missing | No migration exemption. |
| Decisions malformed, stale, incomplete, or inconsistent | Existing C3 code wins. |
| Valid reviewed managed move, omission, or broader environment replacement | Existing C3 behavior succeeds; project entries survive. |
| Regression plus an ordinary approval requirement | Only the regression control refusal; approvals are not evaluated. |
| Regression in a structurally refused or secret-target run | Earlier refusal wins; no additional regression error. |
| Bound input changed after prepare | Existing `APPLY_DRIFT`, exit 4. |
| Rewritten prepared plan with consistent bindings and a regression, without security evidence | Prepared diff returns `APPLY_POLICY_REGRESSION`, exit 3, with no rendered review content. |
| Forged ordinary hash-approved commit containing a regression | Existing workflow gate wins if applicable; otherwise `APPLY_POLICY_REGRESSION`. |

Retain unchanged the C3 `run-c3-g1` and `run-c3-f1` expectations and C4's migration-precedence
tests.

For every refusal, assert no project, manifest, lock, plan/request, or journal mutation. For
preservation successes, verify project protection remains represented in Claude denies, Git
excludes, and the Codex snippet.

Use synthetic ASCII names. Do not add glob-subsumption or Unicode-normalization machinery.

**C12-6 - Complete never-read boundary**

Rewrite rule 2 to cover the union of shipped defaults and installed `.ai/security-paths.json`,
including `patterns` and `projectPatterns`.

Keep this whitespace-normalized substring verbatim, as C9 requires:

```text
`data/secret-paths.json` (`.env`, `.env.*` including `.env.example`, keys, certs, `secrets/`, `credentials/`,
```

Retain the remainder of the existing example list, then append the installed-policy clause. State
that absence permits the shipped fallback, while invalid installed policy fails closed.

Correct `project-setup/README.md:16`, which describes shipped defaults as the single source for
every control. Distinguish shipped defaults from installed project additions.

In `references/security.md`, distinguish setup's refusal union from the installed effective policy
used by renderers and Git readers. Installed agent instructions already name the installed policy;
do not add a dependency on a distribution-relative path.

Preserve env-keys/apply and scanner exceptions, redaction, names-only discovery, and C9 command
hygiene. Tests and evaluation 21 must reject access to a project-protected path merely because
shipped defaults do not name it.

**C12-7 - CLI guards without changing installed inventory**

Do **not** add `scripts/is-entry-point.mjs` or another production file.

Replace each defective guard with a local `isEntryPoint()` whose function text is identical to
`scripts/validate.mjs:603-609`:

```javascript
function isEntryPoint() {
  if (!process.argv[1]) return false;
  const self = fileURLToPath(import.meta.url);
  const fold = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  if (fold(path.resolve(process.argv[1])) === fold(path.resolve(self))) return true;
  try { return fold(fs.realpathSync.native(process.argv[1])) === fold(fs.realpathSync.native(self)); } catch { return false; }
}
```

Retain existing CLI bodies and exports. Add necessary builtin imports only within existing files.

| Files | Disposition |
|---|---|
| Scripts `blocks`, `check-agent-baselines`, `env-keys`, `merge-claude-settings`, `migrate-security-paths`, `render-permissions`, `secret-scan` | Replace guards with the exact local function. |
| Scripts `doctor`, `validate` | Already equivalent; unchanged. |
| Scripts `apply`, `canary`, `detect`, `lock` | Unconditional CLI execution; unchanged. |
| Scripts `classify-allows`, `globs`, `lib`, `ownership`, `schemas`, `toml` | Libraries; no entry guard. |
| Assets `git-safe`, `guard-raw-git` | Intentionally unconditional entry points; unchanged. |
| Asset `hooks-selftest` | Existing identical guard; unchanged. |
| Assets `security-policy`, `git-safe-core`, `guard-raw-git-core`, `review-diff` | Libraries; no entry guard. |
| `install/install` | Unconditional CLI; unchanged. |
| `install/release` | Existing equivalent guard; unchanged. |

C11b's `PAYLOAD_INVENTORY`, its exact 60-file installed set, and plan section 3.7 remain unchanged.
`lib.mjs` exports remain unchanged.

**C12-8 - CLI regression coverage**

C12 asserts exact function-text equality, after line-ending normalization, across the seven changed
scripts, doctor, validate, and hooks-selftest.

Use behavioral launches rather than tests of a new exported helper:

- Direct absolute and relative invocation.
- Paths containing spaces.
- Real directory junctions, mandatory on Windows.
- Directory symlinks on other platforms.
- Case-variant paths on Windows.
- Import probes that produce no output, set no exit status, and run no CLI.
- Import probes with missing `argv[1]`.
- Import probes whose `argv[1]` names a different existing file.
- Import probes whose `argv[1]` names a nonexistent file, exercising realpath failure.

The latter two cases can be behavioral: a child probe sets its entry argument before dynamically
importing the unchanged module. They require no exported test seam.

Compare direct and alternate launches for exit code and expected output, not merely successful
process termination. Include exact baseline-checker success JSON and corruption failure through the
junction. Secret-scan must return an explicit `scanned` or `not-scanned` report; silent exit 0 is
never accepted.

Use isolated synthetic projects and scanner stubs. Do not access real user configuration or run real
scanners. For doctor, validate, self-test, and release, use safe argument-validation launches where
possible; do not construct a release merely to exercise its guard.

A mandatory junction failure fails C12. Optional file-symlink unavailability may be recorded
diagnostically without skipping the component. Dedicated 8.3, subst, and permission-denied realpath
variants remain coverage residuals; direct missing-path realpath failure is covered.

**C12-9 - `--config-env` alias protection**

Extend `assets/tools/guard-raw-git-core.mjs` to consume both global forms:

```text
--config-env=alias.name=VARIABLE
--config-env alias.name=VARIABLE
```

Inspect the key before the first `=` and apply the existing ASCII-case-insensitive `alias.*`
refusal. Never read or expand the named environment variable.

Required boundaries:

- Option absent: existing behavior.
- Non-alias key: consume its value and continue inspecting the actual subcommand.
- Alias key: block even with an otherwise allowed subcommand.
- Missing separate value: existing recognized-option missing/malformed handling.
- Empty or malformed attached assignments: do not introduce Git configuration validation; still
  block a visibly identified alias key.
- Quoted values, multiple globals, and mixed-case keys follow the same key rule.
- Option text in messages, comments, or literal bodies remains data.
- Post-subcommand parsing, lexical-failure precedence, and malformed fail-open warning remain
  unchanged.

Test both shell modes and both forms, with positive and negative controls.

This expressly amends C6's recognized-global-option table and accepted residuals **for
`--config-env` only**, without editing the frozen C6 plan. `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_n`
injection remains a residual.

Add `--config-env alias.*` to the Blocked list in `references/claude.md`. Leave the README hook
paragraphs unchanged. `CORE_EXPORTS` remains exactly the existing four exports.

**C12-10 - Runtime identities and pins**

F4 changes the core's bytes but no runtime identity:

- `data/runtime-units.json` retains seven members, order, roles, and supported policy schemas.
- `RAW_GIT_HOOK` retains event `PreToolUse`, matcher `Bash|PowerShell`, and command `node
  "$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs"`.
- Trusted runtime hashes continue to derive from current source bytes.
- Applying the updated core records its new normalized hash in the installed manifest.
- Stale-core refusal, complete-unit checks, input binding, and migration coupling remain enforced.
- Hooks-selftest retains its exact three-case transcript; new parser cases belong to C12 tests.
- Historical v2 snapshots and baseline-checker pins remain unchanged.

Add a regression proving old/altered core bytes do not satisfy hook readiness or a coupled runtime
update, while the complete current unit succeeds. Preserve existing C6 identity and C10 self-test
assertions.

**C12-11 - Documentation nits and exact prose**

Replace the stale integration sentence in `references/claude.md` with wording that includes:

```text
`validate.mjs` (C10) runs it during validation; `doctor.mjs` does not run it.
```

Keep every rejection criterion: missing self-test, launch failure, timeout, nonzero exit, nonempty
stderr, empty stdout, and nonexact transcript. Preserve the distinction between direct execution and
Claude hook loading.

Replace the two stale prospective v2 references with version-neutral wording.

Change only the stale version comments in the current Codex wrappers. Their current replacements
already differ from v2 snapshots, so this does not alter the no-draft boundary. Both Claude wrappers
remain byte-identical to their v2 snapshots.

Use these exact docs-sync paragraphs:

```text
Do not retry a failed or denied read through another tool, change the sandbox, request full access, or use a connector as a fallback. Instructions are guidance, not a sandbox.
```

```text
Never run `git checkout`, `git switch`, `gh pr checkout` or `git worktree add`. Do not fetch refs yourself; the user supplies or fetches the ref.
```

Do not assert a docs-sync launcher exists. Preserve documentation-only writes, trusted
checked-out-branch scope, no fallback, and no connector access.

Preserve the existing review-diff stdout sentence followed by "Docs-sync follows the same rule," as
recorded in C8's accepted implementer judgment call g.

The tests lane updates the docs-sync-specific exact expectations in **both C8 and C9**, including
`c9.test.mjs:2220`. Reviewer expectations in C8 and C9 remain unchanged. Do not replace shared
reviewer constants with the shorter docs-sync text.

The six baseline-checker SHA pins cover historical snapshots, not current assets; none moves.

**C12-12 - F6 tests-lane repairs**

The tests lane owns these amendments:

- Construct C11b's absolute-output input with literal separators so `..` survives. Assert that the
  input contains the literal segment and the parser returns the exact original string, preserving
  spaces and repeated spaces.
- In C2 and C3 `observeEffects`, call `syncBuiltinESMExports()` after patching builtin objects and
  again after restoration in `finally`.
- Add positive controls showing that already-imported named filesystem and child-process bindings
  are observed.
- Verify restoration after successful and throwing callbacks.
- Repair the C3 Git-shim control with a valid initialized run and matching lock/run ID that reaches
  Git.
- Require actual shim records and the expected control outcome. Remove the `control.code !== 0`
  alternative.
- Separate the positive control's records from the zero-Git diff observation.

Retain all existing production expectations. These changes strengthen the observers rather than
relaxing their assertions.

**C12-13 - Registration, evaluation, and execution budget**

Add `tests/c12.test.mjs` with these eight ordered descriptors:

| ID | Name |
|---|---|
| `R47/C12/policy-preservation` | installed policy protections survive reruns |
| `R80/C12/policy-gates` | policy regression gates bind review and commit |
| `V2/C12/entrypoints` | alternate script paths execute the intended CLI |
| `R51/C12/config-env` | environment configuration aliases cannot bypass the hook |
| `R80/C12/runtime-unit` | changed guard cores require the reviewed runtime unit |
| `A5-templates/C12/documentation` | review corrections preserve agent and policy boundaries |
| `RC1/C12/pins` | intentional documentation edits update only affected pins |
| `V2/C12/contracts` | C12 registration and evaluation contracts are exact |

Export `C12_IMPLEMENTATIONS`. Add independent matching descriptors and implementations to
`tests/rc1-cases.mjs`.

Aggregate C12 once in R29, after C10 and before `test('R30'`, through the existing component memo.
Use exactly:

```javascript
{ repository: path.resolve(SKILL, '..'), skillRoot: SKILL, tmp: path.join(TMP, 'c12'), env: { ...ENV } }
```

The aggregation segment contains no `console.log`, `stdout.write`, or `PASS  ` text, including
comments. C12's assertions contribute to R29's result without nested records.

Preserve existing call sites, numbered IDs, evidence meanings, and C11b composition requirements.
`CASE_REQUIREMENTS` uses explicit IDs; the R47/R80/R51 prefixes do not add C12 to the 40-case table.

Registration conventions remain:

- Imports and registration execute no tests, write no files, and start no processes.
- Production modules and registry access in component tests are lazy.
- Registration does not inspect context or invoke callbacks.
- Exactly 40 complete rc.1 cases are registered.
- Components return `{ failures, skipped: null }`.
- Empty assertion lists, missing implementations, and skips cannot pass.
- Scratch work remains under `context.tmp`.

Append evaluation 21, `rerun-preserves-project-policy`, with this contract:

```json
{
  "id": 21,
  "name": "rerun-preserves-project-policy",
  "prompt": "Rerun project setup from the shipped defaults and keep my project protections.",
  "files": [
    "Installed schema-2 policy with projectPatterns and recorded ownership",
    "Security-state inspection reporting managed patterns behind this skill",
    "Shipped policy defaults"
  ],
  "expected_output": "Never copies shipped defaults over the installed policy or reads project-protected paths. Uses the shipped-plus-installed refusal boundary. Runs migration report, records explicit decisions and stages the reviewed update because managed patterns are behind. Preserves projectPatterns and project ownership; does not treat content approval as permission to bypass apply policy checks."
}
```

Keep evaluations 1-20 unchanged. Update exact inventory counts in C8, C9, and C11b to 21; C12
independently asserts the exact new object. Evaluation text is an expectation, not observed agent
behavior.

Budget C12 for at most **200 harness-counted child-process launches** and **300 seconds component
elapsed time on the comparable acceptance host**. Reuse fixture construction, exercise parser
matrices in-process, and avoid nested suites or repeated v2 installations. Record the counting
method and elapsed time.

This is an implementation budget, not permission to skip coverage or weaken assertions. Report and
address overruns before acceptance. Keep accept-rc1's **1,800,000 ms** timeout unchanged. The
historical 1013-second full run leaves 787 seconds of nominal headroom; it does not guarantee
current runtime.

**C12-14 - Files touched**

Paths are relative to `project-setup/` except the new acceptance record.

| Area | Files |
|---|---|
| Policy gate | `scripts/apply.mjs` |
| CLI guards | `scripts/blocks.mjs`, `scripts/check-agent-baselines.mjs`, `scripts/env-keys.mjs`, `scripts/merge-claude-settings.mjs`, `scripts/migrate-security-paths.mjs`, `scripts/render-permissions.mjs`, `scripts/secret-scan.mjs` |
| Hook | `assets/tools/guard-raw-git-core.mjs` |
| Workflow and references | `SKILL.md`, `README.md`, `references/docs-generation.md`, `references/state-and-apply.md`, `references/migration-v2.md`, `references/security.md`, `references/claude.md` |
| Current assets | `assets/agents/docs-sync.md`, `assets/wrappers/codex-reviewer.toml`, `assets/wrappers/codex-docs_sync.toml` |
| Tests and registration | New `tests/c12.test.mjs`; `tests/c2.test.mjs`, `tests/c3.test.mjs`, `tests/c8.test.mjs`, `tests/c9.test.mjs`, `tests/c11b.test.mjs`, `tests/rc1-cases.mjs`, `tests/run-tests.mjs` |
| Evaluation | `evals/evals.json` |
| Candidate documentation | `CHANGELOG.md`, `RELEASE-NOTES-3.0.0-rc.1.md` |
| Acceptance evidence | New `docs/plans/<actual-date>-project-setup-v3-rc1-c12-acceptance.md` |

No production file is added. No C4, C6, or C10 test edits are planned; their unchanged checks
validate compatibility. C12 authorizes the narrowly listed frozen-test amendments in C2, C3, C8, C9,
and C11b.

The orchestrator saves/freezes this plan separately.

**C12-15 - Version, documentation pins, and C11b boundary**

Keep `VERSION` exactly `3.0.0-rc.1\n`. The candidate is untagged and unpublished. Do not add a
version.json stamp or change unrelated skills' stamps.

Add one concise correction paragraph within the existing candidate CHANGELOG entry and one bullet in
the candidate release notes' Changes section. Preserve compatibility, rollback, pending-host,
publication, and required-total wording.

In `tests/c11b.test.mjs`:

- Update `PINS.skillWithOldHeading`.
- Update `PINS.readmeTopRest` for the inventory wording correction.
- Keep every `readmeSections` pin unchanged.
- Keep `PINS.changelogSuffix`, `PINS.installer`, and `PINS.notes200` unchanged.
- Update exact `CHANGELOG_ENTRY_LINES` and `RELEASE_NOTES_TEXT` expectations for the deliberate
  additions.
- Correct assertion descriptions that would otherwise incorrectly claim post-C10 byte identity.
- Preserve `PAYLOAD_INVENTORY`, all 60-file length/set assertions, and the installed-payload
  boundary.

Pins and their intentional edits land together under I11b-2. Do not accept multiple hashes or
replace exact checks with permissive alternatives.

Preserve release arguments and output records, archive rules, and distinctions among ZIP SHA-256,
normalized payload hash, raw backup digest, and Git tree identity. Preserve manifest/schema
meanings, policy identities, hook identity, report envelopes, exit codes, and approval-hash
semantics except for the new refusal explicitly specified above.

**C12-16 - Runnable acceptance and evidence**

The writable tests/acceptance lanes run from the repository root:

```text
node project-setup/tests/run-component-tests.mjs --component C12
node project-setup/tests/run-component-tests.mjs --component C2
node project-setup/tests/run-component-tests.mjs --component C3
node project-setup/tests/run-component-tests.mjs --component C4
node project-setup/tests/run-component-tests.mjs --component C6
node project-setup/tests/run-component-tests.mjs --component C8
node project-setup/tests/run-component-tests.mjs --component C9
node project-setup/tests/run-component-tests.mjs --component C10
node project-setup/tests/run-component-tests.mjs --component C11b
node project-setup/tests/run-tests.mjs
node project-setup/tests/accept-rc1.mjs
npm run check
```

Require C12 `8 PASS / 0 FAIL / 0 SKIP`, every focused component passing, and full `ACCEPT-RC1  PASS 
full`.

The suite still requires 100 numbered results: 99/0/1 only for the permitted Windows R13d skip,
otherwise 100/0/0. C12 failure fails R29 and full acceptance.

Create a new C12 acceptance record containing:

- Exact tested commit/tree or precisely identified uncommitted delta.
- Commands, exit codes, totals, date, OS, Node/Git versions, and elapsed time.
- Retained result/evidence paths and the **SHA-256 of the retained results.json from the post-C12
  full acceptance run**.
- The separately retained C12 component report path and digest, clearly distinguished from
  full-suite results.
- Skips, optional subcases not exercised, process counts, counting method, and budget measurements.
- Fresh synthetic release identities and archive digests from this run.
- Pending host measurements, still pending.

For historical continuity, record the maintainer-supplied C11b results.json digest, labeled as
historical rather than newly measured:

```text
C11b historical full acceptance: 99 PASS / 0 FAIL / 1 SKIP
results.json SHA-256: dd8979d152b8d21e5acd0b3ce34970dc13e93a46478b5ce2b85f2b7268ebe131
```

Do not edit the frozen C11b acceptance record or reuse its measurements as current evidence.

Its historical `.remember/` formatting failure does not waive `npm run check`. If that command fails
again, record the actual failure and leave the check unmet pending a valid measurement. Do not route
around a failed command.

**C12-17 - Rollback**

No migrations. Revert the commits.

**C12-18 - Planning verification limits**

This revision used local read-only source, test, decision, and Git-name inspection. HEAD and branch
were verified. The intervening Git diff lists only the two unrelated files stated in C12-1.

No files were changed; no tests, fixtures, installer, release builder, MCP server, connector, app,
or network service were run. No `.env*` or secret files were opened. The supplied historical results
digest was not independently recomputed in this lane.

The prior planning pass reported wildcard/path lookup failures and an inaccessible user Git
ignore-file warning. Those operations were not rerouted. This revision's verification commands
completed successfully.

**Plan questions:** none.

**Changes from r1**

- **K1 - FIXED:** C12-4-5 specify exact placement, earlier-code precedence, and phase-specific
  migration expectations.
- **K2 - FIXED:** C12-7-8, 14-15 remove the helper file, require identical local guards, and
  preserve the 60-file payload.
- **K3 - FIXED:** C12-4-5 define invalid replacement drafts, fresh-draft behavior, and non-echoing
  errors.
- **K4 - FIXED:** C12-3 preserves mandatory update triggers and new default coverage.
- **K5 - FIXED:** C12-6, 11, 14 preserve rule 2's substring and authorize docs-sync-specific C9
  amendments.
- **K6 - FIXED:** C12-11 retains "C10" and all self-test rejection criteria.
- **K7 - FIXED:** C12-11 removes the nonexistent docs-sync launcher claim and corrects the
  judgment-call attribution.
- **K8 - FIXED:** C12-4 uses parsed, anchor-adapted identities and per-collection sets.
- **K9 - FIXED:** C12-5 adds conversion, competing-error, approval, and rewritten-plan cases.
- **K10 - FIXED:** C12-9-10 narrowly amend the config-env residual, preserve exports, and leave
  README hook paragraphs intact.
- **K11 - FIXED:** C12-3 preserves runtime prose, fences, sequences, and C9 command hygiene.
- **K12 - FIXED:** C12-13 fixes aggregation placement/context/output and adds process/time budgets.
- **K13 - FIXED:** C12-16 adds the C4 component command.
- **K14 - REJECTED as applicable to C12:** dropped per maintainer instruction; C12-1 records the
  unrelated committed changes.
- **K15 - FIXED:** C12-13 retains assertion prefixes without altering the 40-case table.
- **SR-4 decision - FIXED:** C12-16 requires the new results digest and records the supplied
  historical C11b digest.

## Freeze addendum (plan-critique round 2)

These items win over the sections above where they differ.

- C12-P2-1 (K16, C12-3 triggers). Trigger (b) also includes the security-state row "managed
  patterns edited since install". The migration report then offers `restore` or `omit` for each
  deleted entry and `project`, `keep` or `omit` for each addition.
- C12-P2-2 (K17, C12-13 budget). The C12 budget is a recorded target: 400 harness-counted child
  launches and 600 s component time. An overrun is recorded with its cause and does not by itself
  fail acceptance. The hard limits remain the accept-rc1 1,800,000 ms timeout and the required
  totals.
- C12-P2-3 (K18, C12-7 inventory). Residual: the test runners `tests/accept-rc1.mjs` and
  `tests/run-component-tests.mjs` keep their spelling-only guard. The acceptance commands are run
  from the real checkout path, and a run without its PASS and RESULTS lines is a failure, never a
  pass.
- C12-P2-4 (K19, C12-7 mechanics). Remove each script's now-unused `norm` helper. Replace
  `isMain`/`if (isMain)` or the inline condition with `if (isEntryPoint())`. CLI bodies and
  exports are unchanged.
- C12-P2-5 (K20, C12-5 row 108). `MIGRATION_OUTPUT_MISMATCH` at prepare, at the unprepared diff,
  and at the prepared diff of a rewritten `plan.json` carrying `plan.security`.
  `APPLY_POLICY_REGRESSION` at commit of a bound, hash-approved forged plan.
