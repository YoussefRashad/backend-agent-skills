<!--
FROZEN 2026-10-18 on branch feat/project-setup-v3-rc1. Never edit this file; changes go through the
maintainer. Component plan C3 (lands fourth, after C11a, C1 and C2) under the frozen architecture
plan docs/plans/2026-10-15-project-setup-v3-rc1.md, which takes precedence. Drafted by the plan lane
(Codex, 3 revisions, applying maintainer decisions C3-PQ1 option 1, the manifestAfter assignment
from docs/plans/2026-10-18-project-setup-v3-rc1-c2-followup-decisions.md, B5 option (a) and the
round-1/round-2 dispositions); plan-critique (Claude) round 3 found no BLOCKING gap. The addendum at
the end records the maintainer's decisions on round 3's items.
-->

# C3. Policy migration and synchronized controls

Target: `docs/plans/2026-10-18-project-setup-v3-rc1-c3.md`

Reference: `feat/project-setup-v3-rc1`, commit `d9bd9d1`.

Status: final plan revision after critique round 2; ready for freeze.

Paths below are relative to `project-setup/`, unless prefixed with `docs/`.

This plan was prepared read-only. No files were changed, no tests or fixture generators were
run, and no network services were used. Acceptance results below are requirements, not results
claimed by this lane.

## 1. Scope and authority

C3 implements frozen architecture section 2, "C3. Policy migration and synchronized controls";
its section-4 C3 assertion rows and ownership notes; section-5 C3 edge cases; and the applicable
migration and rollback requirements in section 6. The architecture and its freeze addendum remain
unchanged.

Design inputs are `docs/design/project-setup-v3.md`, frozen part A at `54ad312`, specifically A1,
A6, A4 migration support, Q2, Q4, PQ1 and PQ2. C11a, C1 and C2 are landed dependencies. Their
plans, freeze addenda and subsequent decisions remain authoritative for their contracts.

Landing order is:

```text
C11a -> C1 -> C2 -> C3 -> C4 -> C5 -> C6 -> C7 -> C8 -> C9 -> C10 -> C11b
```

C3 owns:

- Recognizing installed policy baselines and classifying policy migration decisions.
- Explicit schema-2 migration, preserved project fields and approved project-pattern moves.
- Synchronized Claude denies, Git exclusion strings and Codex snippet rendering.
- Deny ownership, duplicate user rules, omissions and retained legacy denies.
- One prepared migration snapshot using C2's transaction and approval machinery.
- Runtime-unit compatibility checks and reader-before-policy transaction ordering.
- Installed managed-pattern records and the last rendered Codex snippet hash.
- `inspectSecurityState`, detect integration and removal of validate's obsolete byte comparison.
- Q4 scanner labels without filtering scanner inputs or findings.
- The narrow `blocks.mjs --file` realpath protection assigned by PQ2 and the C1 freeze follow-up.
- The manifest derivation check assigned by the C2 follow-up decision.

The additional `blocks.mjs` touch follows design PQ2 and the C1 plan's scope/follow-up notes.
The additional `rc1-cases.mjs` touch follows C11a's component registration contract.

Maintainer decision C3-PQ1 resolves the architecture's baseline wording:

- Missing means no manifest, or no policy record in an otherwise valid manifest.
- Unrecognized means a valid installed record that identifies no known shipped baseline.
- Malformed manifest data, including a full policy record with a missing or malformed hash,
  remains `MANIFEST_INVALID`. Prepare refuses; the user repairs or restores the manifest first.
  It does not enter unknown-baseline migration.

This interpretation changes no C2 manifest-reader contract.

The maintainer assigned C3 the second finding in
`docs/plans/2026-10-18-project-setup-v3-rc1-c2-followup-decisions.md`. C3 chooses option (a):
commit derives the expected manifest from bound inputs and refuses a mismatch. This reuses the
record-building logic needed by C3's managed patterns and snippet hash, without adding a second
manifest review format.

C2 decision I2-10 is landed at `d9bd9d1`, with its documentation at `7321bcc`. Its per-target
commit refusals remain unchanged and run before C3's added commit checks.

The maintainer's rendering decision is binding: render exactly the A1 forms using the stored
spelling of the first source entry. Do not add ASCII case companions, rule groups or lowercase
rewrites. Claude/Codex host case enforcement remains pending R44/R74 evidence.

Out of scope:

- C1's schema-1 adapter, grammar, matcher and overlap implementation.
- C4 Git command enforcement, `git-safe-core.mjs` and production schema-2 Git readers.
- C5 review artifacts, junction coverage and reserved-name containment.
- C6 hook merging and hook self-tests.
- C7 allow classification and retirement.
- C8 instruction text, agent migration and migration documentation.
- C9 template handling beyond existing C2 contracts.
- C10 validator integration, doctor and its R49/R81/R82 result rows.
- C11b complete numbered-case composition, release stamps, installed-payload acceptance and
  host verification.
- User configuration writes, broader manifest integrity, signatures and skill-file binding.

Ownership is exclusive: R78 adapter is C1; R52 hook merging is C6; R85 allow retirement is C7.
R47 combines C3 rendering with later C4 Git enforcement. C3 must not report those complete cases
as passed.

## 2. Files and interfaces

### 2.1 Existing production files

The following ranges were checked against `d9bd9d1`. They identify the existing code to change;
new code may extend those ranges.

| File | Existing ranges and change |
| --- | --- |
| `data/secret-paths.json` | 1-98: new defaults and corrected scanner comment. |
| `scripts/lib.mjs` | 9; 134-190: effective-policy loader and shared policy use. |
| `scripts/detect.mjs` | 9-20, 36-40, 84-127, 336-347: policy loading and state reporting. |
| `scripts/render-permissions.mjs` | 1-96: pure rendering export and import-safe CLI. |
| `scripts/merge-claude-settings.mjs` | 1-129: pure deny merge and CLI integration. |
| `scripts/apply.mjs` | 41-79, 479-724: migration evaluation and shared record derivation. |
| `scripts/apply.mjs` | 726-831: optional security binding validation and drift checks. |
| `scripts/apply.mjs` | 875-1057: review, prepare ordering and commit checks. |
| `scripts/secret-scan.mjs` | 13-45: effective-policy labels and finding retention. |
| `scripts/validate.mjs` | 149-152: remove obsolete shipped-byte warning. |
| `scripts/blocks.mjs` | 8-16, 116-131: effective policy and pre-read realpath check. |

No production changes are planned in `ownership.mjs`, `security-policy.mjs`, `globs.mjs`,
`schemas.mjs`, `git-safe.mjs`, the immutable v2 snapshots or the component runner.

### 2.2 Existing test files

The tests lane owns these edits before implementation:

| File | Existing ranges and change |
| --- | --- |
| `tests/rc1-cases.mjs` | 8-10, 34-95: import and register C3. |
| `tests/run-tests.mjs` | 269-281: R09 environment-rule expectations. |
| `tests/run-tests.mjs` | 400-424: embed the C3 component run in R15. |
| `tests/run-tests.mjs` | 448-487: R17 environment-rule expectations. |
| `tests/c2.test.mjs` | 2593-2600: make the successful I2-10 control's manifest consistent. |

C2's exact ordinary-plan-key assertions at 1996 and 2033 remain unchanged. C1's tests remain
unchanged. The implementer may not edit the tests lane's tests.

### 2.3 New files

```text
data/runtime-units.json
scripts/migrate-security-paths.mjs
tests/fixtures/rc1-migrations.json
tests/c3.test.mjs
```

The catalog is data so tests can replace one trusted file in a scratch skill copy. There is no
production environment-variable override or exported mutable catalog.

### 2.4 Public interfaces

All new pure exports are synchronous, import-safe and return detached JSON data. Importing their
modules performs no filesystem writes, CLI execution, process creation or stream output.
Arguments are not mutated. There is no exported CLI `main`.

`lib.mjs` adds:

```text
loadEffectivePolicy(root = null)
  -> {
       source: "skill" | "project",
       sourceSchema: 1 | 2,
       policy: object,
       effectivePatterns: array
     }
```

`root === null` loads the shipped defaults. A supplied root is an explicit filesystem root;
this function does not discover it using Git. Only an absent installed policy falls back to
the skill. A present malformed or unreadable policy does not fall back.

The returned policy and effective patterns are C1's validated result, including source
references. The source policy's other fields remain available.

`render-permissions.mjs` exports exactly:

```text
CLAUDE_COMMAND_DENY
renderSecurityControls(policy)
  -> {
       claude: {
         permissionsDeny: string[],
         readDeny: string[],
         commandDeny: string[]
       },
       gitPathspecExcludes: string[],
       codexSnippet: string
     }
```

`CLAUDE_COMMAND_DENY` is frozen. The function accepts a policy object and validates it through
C1; it does not load files.

`merge-claude-settings.mjs` exports exactly:

```text
mergeManagedDenies({
  settings,
  managed,
  policy,
  omissions,
  dropOwnership,
  overrideUserExceptions
})
  -> { settings, managed, omissions, report: DenyReport }
```

All six fields are required. `managed` and `omissions` are settings metadata containers accepted
by C2; use `{}` when absent. `dropOwnership` is a string array and
`overrideUserExceptions` is boolean.

`migrate-security-paths.mjs` exports exactly:

```text
readRuntimeUnits(value) -> RuntimeCatalog

classifySecurityMigration(input) -> MigrationReport

resolveSecurityMigration(input, decisions)
  -> {
       policy,
       managed: { schema: 2, patterns: array },
       omissions: { patterns: array },
       report: MigrationReport
     }

checkSecurityToolUnit(rows, policySchema)
  -> { targets: string[], writeOrder: string[] }

inspectSecurityState(input)
  -> Array<{ level: "pass" | "info" | "fail", check: string, detail: string }>
```

`input` is `MigrationInput` from section 3.4. The tool check accepts the rows specified in
section 3.9. Invalid arguments use section 3.12's errors.

`secret-scan.mjs` exports exactly:

```text
labelScanFindings(findings, root, policy)
  -> Array<{
       file: string,
       line: number | null,
       rule: string,
       commit: string | null,
       protected: boolean
     }>
```

Its import must not start a scan.

### 2.5 Contracts for later components

| Consumer | C3 dependency |
| --- | --- |
| C4 | Renderer forms, `readRuntimeUnits`, tool check and catalog update-unit membership. |
| C6 | `mergeManagedDenies` and preserved settings fields, deny records and held-back rules. |
| C7 | Same merge export; it must preserve C3 deny ownership while handling allows. |
| C8 | Migration CLI, report/decision format, approvals, snippet and rollback procedure. |
| C10 | `inspectSecurityState`, effective-policy loader and recorded manifest fields. |
| C11b | C3 assertions, fixtures, catalog assets and complete migration transaction. |

C4 must update the trusted catalog when its reader and helper assets become available. C3 does
not label the current v2 Git reader schema-2 compatible.

C8 and C10 must account for the workflow gate: after migration, a schema-2 policy content edit
in a project with catalog tools also goes through `migrate-security-paths.mjs` and
`security-decisions.json`. This includes adding a later `projectPatterns` entry. Metadata-only
runs and unchanged policy content do not trigger that gate.

## 3. Behaviour

### 3.1 Conventions and preserved C2 contracts

Use these definitions throughout:

```text
J(value) = JSON.stringify(value, null, 2) + "\n"
H(bytes) = lowercase SHA256 of the exact bytes
NH(text) = existing lib.normalizedHash(text)
K(entry) = C1 policyEntryKey(entry)
```

Canonical JSON equality ignores object-property order and preserves array order and values.
Identity uses explicit anchor and C1's normalized glob. Metadata equality retains spelling,
notes, kinds, extension fields and array order.

C3 uses these C2 interfaces without changing their input schemas:

```text
readManagedMetadata(target, value)
readOmissions(target, value)
isPolicyOmitted(entry, omittedEntries)
readManifest(value)
```

`hookIdentity` remains C2's hook identity contract; C3 neither generates nor reconciles hooks.

The five C2 request files and embedded metadata keys remain:

| Run file | `plan.metadata` value |
| --- | --- |
| `ownership.json` | `ownership` |
| `managed-keys.json` | `managedKeys` |
| `omissions.json` | `omissions` |
| `manifest-metadata.json` | `manifestMetadata` |
| `transaction-inputs.json` | `transactionInputs` |

Each has its existing `<key>Sha256` raw-byte binding; absent files have null value and hash.
The manifest metadata request contains only the existing optional `codexSnippetSha256`.

Content operations remain `create`, `modify` or `unchanged`, with origins `draft` or `vault`.
Sources remain exactly `drafts/<target>` or `vault/files/<target>`. Metadata operations remain
`kind: "file"` or `kind: "manifest"`.

C3 relies on these C2 rules:

- Policy managed metadata is `{schema, patterns}` with complete explicitly anchored entries.
- Policy omissions are `{patterns}` with exact identities.
- Settings metadata uses `permissions.deny`, `permissions.allow`, `hooks` and `heldBack`.
- Settings deny omissions contain anchored policy entries, not permission strings.
- Settings metadata requests patch present fields; policy metadata requests replace the complete
  managed container.
- Ownership/schema changes, non-append changes and omissions require path approval.
- An unchanged unrecorded control file cannot be adopted without approval.
- Initial omissions require approval even when the target is newly written.
- Unrelated `--approve-user-content` paths are refused.
- Content and metadata operations use one manifest, journal, commit and rollback.
- Manifest schema 3 preserves unrelated fields and records. Valid schema 2 remains input.
- Bindings cover all content targets, file-metadata targets, declared inputs and the installed
  policy. The installed manifest has its dedicated raw hash.
- `loadPlan` validates paths, operation roles and the exact input-role union before hashing
  plan-named paths.
- I2-10 re-applies `refusePlanOps(plan, 'prepare')` before `bindingDrift`.
- Genuine no-op, lifecycle, recovery, backup and later-edit protections remain C2's.

An ordinary plan still has exactly these 15 top-level keys:

```text
agents
head
host
inputs
manifestAfter
manifestPreRawSha
metadata
metadataOps
mode
ops
planSchema
preparedAt
runId
skillVersion
sourceInventory
```

`planSchema` remains 2. Only a run containing `security-decisions.json` adds `security`.

C3 adds manifest verification to the C2 commit contract under the maintainer's assignment.
C3 also orders runtime-containing prepare plans as specified in section 3.9. Neither change
alters C2 request schemas or approval rules.

### 3.2 Shipped defaults

Keep `data/secret-paths.json` as schema 1 at this landing. C1's adapter remains its sole adapter.

Replace its first two entries with:

```json
{
  "glob": "**/.env*",
  "kind": "env",
  "note": "Includes .env.example. Agents never read any .env* file; scripts/env-keys.mjs extracts key NAMES only."
}
```

Insert `{"glob":"**/*.cert","kind":"cert"}` immediately after `**/*.cer`.

Insert `{"glob":"**/.htpasswd","kind":"credential"}` immediately after `**/.npmrc`.

Preserve every other entry and field. The resulting 20-entry order has new coverage at indices
0, 7 and 18. Replace only the top-level `$comment` with:

```text
Secret-path defaults. Rendered controls use the effective project policy. Secret scanning includes protected paths and labels findings; it does not exclude them.
```

Do not change `data/secret-paths-v2.0.0.json`. Its raw bytes remain C11a's verified snapshot.

Recognize both that v2 snapshot and the current shipped default document by their normalized
hashes. A fresh installation of the current schema-1 defaults is a known shipped baseline.

### 3.3 Rendering

Call C1 once to obtain the effective entries and their source references. For each effective
identity, render the stored glob spelling of its first source entry: managed entries precede
project entries. Do not render C1's lowercase matching projection.

| Anchor | Claude | Git | Codex workspace-root key |
| --- | --- | --- | --- |
| `any` | `Read(<glob>)` | `:(exclude,glob,icase)<glob>` | JSON-quoted `<glob>` |
| `root` | `Read(/<glob>)` | `:(exclude,glob,icase)<glob>` | JSON-quoted `<glob>` |

The output order is effective-entry order. There is one Read deny, exclusion and key per
effective identity. Do not add case companions.

`commandDeny` is a detached copy of this unchanged ordered list:

```text
Bash(rm -rf *)
Bash(git reset --hard*)
Bash(git clean *)
Bash(git push --force*)
Bash(git push -f*)
Bash(git checkout -- *)
Bash(git restore *)
Bash(curl * | bash*)
Bash(curl * | sh*)
Bash(wget * | bash*)
Bash(npm publish*)
Bash(terraform apply*)
Bash(terraform destroy*)
Bash(kubectl delete *)
Bash(helm uninstall *)
PowerShell(Remove-Item * -Recurse*)
PowerShell(git reset --hard*)
PowerShell(git clean *)
PowerShell(git push --force*)
PowerShell(git push -f*)
PowerShell(npm publish*)
PowerShell(Invoke-Expression *)
PowerShell(iex *)
```

`permissionsDeny` is `readDeny` followed by `commandDeny`.

Preserve the existing Codex snippet's comments, ordering, profiles and guidance at
`render-permissions.mjs:34-80`. Change only:

- The opening `project-setup v2` label to `project-setup v3`.
- Both description strings from `project-setup v2` to `project-setup v3`.
- The generated workspace-root keys to the effective anchored entries above.
- Both depth values to the validated effective policy value.

The Windows unelevated refusal warning, user-config paths, legacy-settings warning, snapshot
warning and reviewer read-only instructions remain byte-identical. Keep the static denies for
`~/.ssh`, `~/.aws` and `~/.gnupg` in both profiles.

Missing `codexGlobScanMaxDepth` means 6. If present, it must be an integer from 1 through 100;
otherwise throw `RENDER_DEPTH`. The snippet uses LF and exactly one final LF. Both profiles
have the same generated keys.

The CLI accepts:

```text
node scripts/render-permissions.mjs [json|codex-snippet|pathspec] [--project <root>]
```

No subcommand means `json`. Duplicate, unknown or incomplete arguments are `RENDER_USAGE`.

`json` prints `J({ok:true,source,...controls})`, with source
`data/secret-paths.json` for shipped defaults or `.ai/security-paths.json` for an installed
policy. `codex-snippet` prints the exact snippet. `pathspec` prints one exclusion per line with
a final LF, or an empty string for zero exclusions. Success exits 0 with empty stderr.

A present malformed policy fails with C1's code and message, F / 3. It never renders defaults
instead.

### 3.4 Baselines and classification

`MigrationInput` has exactly these fields:

```text
{
  policy: object | null,
  manifest: object | null,
  baselinePolicy: object,
  baselineSha256: string,
  desiredPolicy: object,
  desiredSha256: string
}
```

`baselinePolicy` is the shipped v2 document and `baselineSha256` is its `NH` from the original
document bytes. `desiredPolicy` and `desiredSha256` are the current shipped equivalents.
Validate both policies through C1. Their hashes are lowercase 64-hex strings.

Filesystem callers read the two fixed shipped files and compute the hashes. They do not accept
baseline paths or hashes from the run. Missing or invalid shipped baseline data is
`MIGRATION_BASELINE_INVALID`. The pure API validates its supplied data; it does not open files.

Validate the installed manifest through C2 before using any record. Derive settings managed
metadata and both omission namespaces from that manifest; there are no redundant caller inputs.

Baseline selection is:

1. A valid policy record with `ownership: "keys"` is `recorded`, regardless of whether current
   policy is schema 1 or 2. Its complete managed list is the baseline.
2. A valid full policy record whose hash equals `baselineSha256` is `v2.0.0`.
3. A valid full policy record whose hash equals `desiredSha256` is `shipped`.
4. No current policy and no policy record is `fresh`.
5. Everything else is `unknown`.

If both shipped hashes happen to agree, `v2.0.0` wins. A missing policy with a known record
still has that known baseline and represents deletions.

Current bytes never establish installed ownership. A current file exactly matching v2 with
no recognized record remains unknown.

For known baselines, match each current managed entry to the first unused baseline occurrence
with the same `K(entry)`. Classify:

- Equal complete adapted entries: `unchanged`.
- Same identity with changed spelling, metadata or other fields: `managed-edit`.
- No matching baseline occurrence: `project-addition`.
- Unmatched baseline occurrence: `deletion`.

Changing a glob or anchor identity is deletion plus addition. Preserve duplicate occurrences
for classification. Existing `projectPatterns` are already project-owned and are not classified
as managed entries.

For unknown baselines, every current `patterns` entry is `managed-edit`, with no `before`
value. No current entry is silently accepted.

`MigrationReport` has exactly:

```text
{
  baseline: "v2.0.0" | "shipped" | "recorded" | "unknown" | "fresh",
  baselineSha256: string | null,
  sourceSchema: 1 | 2 | null,
  entries: [{
    id: string,
    classification: "unchanged" | "managed-edit" | "project-addition" | "deletion",
    before: object | null,
    current: object | null
  }],
  coverage: [{
    id: string,
    entry: object,
    replaces: object[],
    previousOmissions: object[],
    alreadyEffective: boolean
  }],
  retainedManagedDenies: string[],
  requiredDecisions: [{ id: string, choices: string[] }]
}
```

Report values are pinned:

- `baselineSha256` is the v2 input hash for `v2.0.0`, desired hash for `shipped`, otherwise null.
- `sourceSchema` is the current policy's source schema, or null when absent.
- Entries appear in current order, then unmatched baseline order.
- Current rows use `current:<index>`; deletions use `baseline:<index>`.
- `before` is the matched complete adapted baseline entry, otherwise null.
- `current` is the complete adapted current entry, otherwise null.
- `retainedManagedDenies` is the installed settings record's entire managed deny array,
  preserving order and duplicates. It is `[]` without that record or field.

Coverage contains first-occurrence desired identities absent from the selected baseline, except
identities exactly omitted by policy omissions. Unknown and fresh baselines have no baseline
identities for this calculation. Coverage follows desired order and uses `coverage:<index>`
where the index is in the desired list.

`alreadyEffective` means that identity is present in the current effective policy, including
project entries. It is not approval to install managed coverage.

For the new `**/.env*` identity, `replaces` contains the old `**/.env` and `**/.env.*` entries,
in that order, when found in baseline entries, policy omissions or current managed entries.
Use the first entry in that source precedence for each identity. Other coverage rows have
`replaces: []`.

`previousOmissions` contains policy omissions matching those replaced identities, in stored
omission order. Settings deny omissions do not populate it. These rules apply equally to
recorded and unknown baselines.

Required decisions follow report entry order, then coverage order:

| Row | Choices, in order |
| --- | --- |
| Unchanged | No decision. |
| Known managed edit | `keep`, `replace`, `project`, `omit` |
| Unknown managed edit | `keep`, `project`, `omit` |
| Project addition | `project`, `keep`, `omit` |
| Deletion | `restore`, `omit` |
| Coverage | `include`, `omit` |

A deletion already exactly omitted needs no new decision. A clean v2 migration requires
`coverage:0`, `coverage:7` and `coverage:18`.

### 3.5 Decisions and resolution

`MigrationDecisions` has exactly:

```text
{
  schema: 1,
  reportSha256: string,
  entries: [{ id: string, action: string }],
  coverage: [{ id: string, action: string }],
  denyOmissions: object[],
  dropDenyOwnership: string[],
  overrideUserExceptions: boolean
}
```

`reportSha256` is `H(J(report))`. It identifies the report being decided, not the raw decision
file. `denyOmissions` is the complete requested settings deny-omission list.

Reject unknown fields, duplicate IDs, unknown IDs, actions outside the reported choices,
decisions for rows needing none, and contradictory decisions. Reject missing required choices
with `MIGRATION_DECISION_REQUIRED`, naming the first required ID in report order.

A mismatching report hash is `MIGRATION_REPORT_CHANGED`. Invalid shape or contradictory choices
are `MIGRATION_DECISIONS`.

Resolve actions as follows:

| Action | Result |
| --- | --- |
| `keep` | Keep the complete current entry as managed. |
| `replace` | Restore the complete matched baseline entry. |
| `project` | Append the complete current entry to `projectPatterns`; remove it from managed. |
| `omit` on entry | Remove it from managed and record its exact identity as a policy omission. |
| `restore` | Restore the complete deleted baseline entry. |
| `include` | Include the desired coverage entry as managed. |
| `omit` on coverage | Record that desired identity as a policy omission. |

Moving a baseline-owned entry to `projectPatterns` records its baseline identity as omitted
from managed policy. Moving an addition or unknown entry does not claim an old managed
identity. Existing `projectPatterns` and their order are preserved.

An included coverage identity already retained as managed does not duplicate that entry or
replace its metadata. An existing project entry with that identity stays project-owned;
included managed coverage is a separate source.

Reject a result that both retains a managed identity and explicitly omits it. In particular,
entry `omit X` plus coverage `include X` is contradictory. Moving an addition or unknown entry
to project ownership while including managed coverage for X is allowed. Moving a known
baseline entry to project ownership cannot simultaneously restore that managed identity.

Resolved managed order is retained current order, then restored baseline order, then newly
included desired order. Project moves append in current order. Omissions preserve first
occurrence order by identity and satisfy C2's uniqueness rules.

Including the new environment coverage retires unchanged old environment entries. An explicit
decision to keep, replace or restore an old entry preserves it.

Omitting `**/.env*` does not retire `**/.env` or `**/.env.*`. Keep those old entries unless they
are separately omitted. An old omission neither omits the replacement nor approves including it.

The result is policy schema 2 with explicit anchors. Preserve all other top-level fields,
existing project entries and retained entry fields. Do not rewrite the source file while
classifying or adapting.

### 3.6 Deny ownership and settings merge

The merge takes the resolved effective policy and renders desired denies once. Settings and
managed metadata are separate inputs.

The merge must:

- Preserve every existing deny string and its order.
- Append missing, approved desired denies.
- Keep identical pre-existing user denies user-owned.
- Report identical user rules in `alreadyCovered`, including `Read(/env/**)` and
  `Read(/cert/**)`.
- Preserve previous managed deny strings and ownership even when no longer rendered.
- Preserve ownership of retired rules associated with policy or deny omissions.
- Never infer removal from absence in the renderer's desired list.
- Never restore an absent retired rule merely because its ownership remains recorded.

`dropOwnership` may name only recorded managed deny strings. It removes their metadata, not
settings bytes. It does not create a persistent omission by itself. A selected rule is not
re-added or re-adopted during that merge. Unknown selections are
`DENY_OWNERSHIP_SELECTION`.

Use `globsMayOverlap` from `scripts/globs.mjs` for user exceptions. It retains C1's conservative
permission-expression handling. Unsupported bracket expressions such as
`Read(![.]env.example)` count as overlapping rather than failing policy grammar validation.

For a missing desired rule, inspect same-tool user negations. An overlapping exception holds
the rule back unless `overrideUserExceptions` is true. Keep the legacy conflict object:

```text
{
  rule,
  overridesUserExceptions: string[],
  effect: "appending this rule cancels the user exception(s); decision required"
}
```

For an existing desired Read/Edit rule before later user negations, retain the legacy report:

```text
{
  rule,
  carvedBy: string[],
  effect: "user negations after this rule may exempt paths from it; review with the user"
}
```

`carvedBy` retains the existing later-negation reporting behaviour. Reporting it does not
rewrite or reorder those rules.

`DenyReport` has exactly:

```text
{
  added: string[],
  alreadyPresent: string[],
  alreadyCovered: string[],
  retained: string[],
  ownershipDropped: string[],
  heldBack: string[],
  conflicts: object[]
}
```

Desired-rule arrays follow renderer order. `alreadyPresent` includes existing desired rules;
`alreadyCovered` is its user-owned subset. `retained` is the remaining previous managed list,
in previous order. `ownershipDropped` follows previous managed order, without repeated report
strings. Existing duplicate settings strings are untouched.

New ownership consists of retained prior ownership plus newly appended rules, without adding
duplicate ownership strings. `managed.heldBack` becomes the current `heldBack` array, including
`[]`. Preserve unrelated managed allow and hook fields.

Settings deny omissions suppress corresponding newly generated Read denies. They do not delete
existing strings or ownership. Preserve settings allow omissions.

The CLI retains its existing allow-file and legacy diagnostic behaviour. It calls the pure
deny merge in-process; it no longer spawns the renderer.

Its report maps:

- `added` to legacy `{deny: DenyReport.added, allow: existingAllowAdditions}`.
- `alreadyPresent` to deny results followed by legacy allow results.
- `conflicts` and `heldBack` directly.
- `alreadyCovered` directly.
- `retainedManagedDenies` from `retained`.
- `ownershipDropped` directly.
- Existing `ineffective`, `malformedHooks` and `info` diagnostics unchanged.

With no `--allow-file`, omit `permissions.allow` from the managed-keys request. Do not replace
existing or already staged allow ownership with `[]`.

If settings values do not change, preserve the original settings bytes and do not create a
settings draft. Ownership-only drops and omission changes still produce C2 metadata requests
and require settings approval.

### 3.7 Migration CLI and staging

Accept exactly:

```text
node scripts/migrate-security-paths.mjs report --project <root>
node scripts/migrate-security-paths.mjs stage --project <root> --run-id <id>
```

Unknown, duplicate, incomplete or extra arguments, including an invalid run ID, are
`MIGRATION_USAGE` / 1. Both operations use an explicit validated filesystem root and invoke
no Git.

`report` reads fixed installed control files and shipped baseline data, then prints:

```text
J({ ok: true, report, reportSha256: H(J(report)) })
```

It creates no directories, lock, drafts, plan or journal.

`stage` reads the fixed run file:

```text
.ai/.run/<id>/security-decisions.json
```

It requires an initialized safe run. It validates all decisions and staging conflicts before
writing any staged output.

Stage produces:

- The resolved policy draft.
- A settings draft only when values change.
- Every missing or differing catalog runtime asset as a draft from the trusted skill source.
- C2 ownership and managed-key requests for policy and settings.
- Policy and settings omission requests when needed.
- `manifest-metadata.json` with the exact rendered snippet hash.
- `transaction-inputs.json` declaring consulted unchanged settings and runtime targets.

Merge unrelated existing request entries. Preserve unrelated staged settings fields. A
different staged policy, runtime source or conflicting deny projection is
`MIGRATION_DRAFT_CONFLICT`. Identical staged outputs are reused.

Do not synthesize an empty omissions property when both prior metadata and requested omissions
are absent/empty. Preserve an existing empty omission container rather than silently removing it.

Return:

```text
{
  ok: true,
  staged: string[],
  reportSha256: H(J(report)),
  next: "run apply.mjs prepare, review apply.mjs diff, then approve the plan hash"
}
```

`staged` contains only run-relative files actually created or changed by this invocation,
sorted lexically. Success exits 0.

Stage does not approve content or run the compatibility gate. On a genuine v2 installation at
this landing it stages successfully, including the absent security-policy helper. Prepare then
refuses the still schema-1-only Git reader as specified below.

Stage precedes C6/C7 staging. Those components may extend settings and their own request fields
while preserving the C3 deny projection.

### 3.8 One snapshot, bindings and review

Prepare reads the current policy, valid manifest, settings, decisions, requests and catalog
runtime candidates. It computes one resolved policy snapshot, one control rendering and one
deny merge. All expected C3 staged projections must match that snapshot.

Bind the following through C2's existing inputs, request hashes and source hashes:

- Installed policy and manifest.
- Installed settings, including unchanged settings.
- Every catalog runtime target, including unchanged or absent targets.
- Policy, settings and runtime drafts.
- Ownership, managed entries, omissions and snippet metadata requests.
- Declared transaction-input bytes.

C3 adds only this optional plan field:

```text
security: {
  decisionsSha256: H(rawSecurityDecisionsFileBytes)
}
```

There is no stored `toolUnit`, report, policy, control rendering, deny report, skill-input map,
second decision-file hash or top-level `securityDecisionsSha256`.

When the decisions file is absent, omit `security` entirely. Commit and prepared diff still
check that the fixed decisions file remains absent.

Before any C3 binding read, `loadPlan` checks that a present `security` is an object containing
exactly one lowercase 64-hex `decisionsSha256`. It accepts no plan-supplied decision path.
Malformed optional security data is `APPLY_PLAN_INVALID` / 1. Existing C2 role checks still
validate every `inputs`, `ops`, request and metadata target before hashing it.

Extend binding drift with one final row after C2's existing categories:

```text
{
  target: "security-decisions.json",
  what: "security decisions changed since prepare"
}
```

Add it when the raw bytes or presence differ from the optional binding. C2 drift rows and their
order remain unchanged. Skill files are trusted inputs, not transaction-bound inputs.

Prepared migration diff first performs C2 refusals and the complete binding recheck. It then
recomputes migration evidence from bound project/run inputs and the currently trusted skill
data and assets. It validates that the resulting C3 projections still match the staged policy,
settings deny projection, metadata and snippet hash.

The additional review field is exactly:

```text
security: {
  report: MigrationReport,
  controls: renderedControls,
  deny: DenyReport,
  toolUnit: ToolRow[]
}
```

`toolUnit` is rebuilt from the current catalog and source assets; it is never copied from
`plan.json`. Rows are target-sorted and use section 3.9's exact shape.

If a changed trusted skill makes the recomputed expected policy, settings, metadata, runtime
source projection or snippet differ from the staged projection, diff fails F / 3:

```text
code: MIGRATION_OUTPUT_MISMATCH
error: MIGRATION_OUTPUT_MISMATCH: staged migration output does not match decisions: <target>
target: <target>
```

Choose the first differing projection in this order: policy, settings, C2 request files in
their fixed order, then runtime targets sorted. A newly required runtime target lacking an
approved input/source role is a mismatch for that target; do not read it as an unbound project
input. Catalog shape and capability failures retain their own errors.

Prepared review writes nothing. The approved hash remains the hash of the original plan bytes.

Unprepared migration diff uses the same evaluation and evidence shape without path approvals.
It does not create a plan, heartbeat, journal or directory and invokes no Git, including during
root setup, policy loading and runtime evaluation. Incomplete decisions or incompatible tools
produce their normal F / 3 refusal; this is not a partial preview mode. I/O maps as in 3.12.

Ordinary diff output has no `security` field. Prepare's existing success keys and review
instruction remain unchanged; migration evidence is available through `apply.mjs diff`.

Commit uses the approved staged outputs. It does not resolve migration decisions, merge denies
or render controls again. Its runtime check re-establishes executable compatibility, and its
manifest check verifies bookkeeping derived from the approved operations.

### 3.9 Runtime unit and commit order

The trusted `data/runtime-units.json` initially contains:

```json
{
  "schema": 1,
  "units": [
    {
      "source": "assets/tools/security-policy.mjs",
      "target": ".ai/tools/security-policy.mjs",
      "role": "helper",
      "policySchemas": [1, 2]
    },
    {
      "source": "assets/tools/git-safe.mjs",
      "target": ".ai/tools/git-safe.mjs",
      "role": "entrypoint",
      "policySchemas": [1]
    }
  ]
}
```

`readRuntimeUnits` performs a shape check:

- Root object, schema 1 and nonempty `units` array.
- Each row has string `source` and `target`, role `helper` or `entrypoint`, and an array of
  integer `policySchemas`.
- Sources and targets are nonempty; targets are unique.
- The two initial source/target pairs must be present with the roles shown above.

Do not add a basename regular expression or enumerate permitted capability arrays. This is a
trusted skill file. Later components may add entries and supported schema numbers. Malformed
shape or missing/wrong required roles is `TOOL_CATALOG`.

Every catalog entry is required for a migration. The absent installed security-policy helper
must be supplied by a draft. No target is optional merely because it was absent in v2.

A `ToolRow` is exactly:

```text
{
  source: string,
  target: string,
  role: "helper" | "entrypoint",
  policySchemas: number[],
  reviewedSha256: string,
  installedSha256: string | null,
  plannedSha256: string | null
}
```

`reviewedSha256` is `NH` of the trusted skill source bytes. Installed and planned hashes use
`NH` of the corresponding actual candidate bytes. Planned means a content operation supplies
the target; null means no such candidate.

`checkSecurityToolUnit` validates row shape, unique targets, hash shape and integer
`policySchema` first. Malformed input is `TOOL_UNIT_INPUT`. Filesystem callers construct rows
from the catalog, never from plan-supplied rows.

Check rows in target order. For each row:

1. If `policySchemas` lacks the requested schema, fail `TOOL_UNIT_INCOMPATIBLE`.
2. Select planned hash if present, otherwise installed hash.
3. If absent or different from `reviewedSha256`, fail `TOOL_UNIT_UNREVIEWED`.

Success returns sorted `targets` and `writeOrder`: the security-policy helper first, other
helpers sorted, then entrypoints sorted. Targets absent from a particular content plan simply
have no content write.

At the C3 landing, a real v2 migration's first compatibility failure is:

```text
TOOL_UNIT_INCOMPATIBLE: compatible reviewed reader required: .ai/tools/git-safe.mjs
```

C4 supplies actual schema-2 compatibility later. Tests use a scratch skill with a synthetic
compatible reader and an explicitly replaced catalog.

For a plan containing any catalog runtime content target, prepare orders operations:

1. Runtime helpers and entrypoints in the order above.
2. Remaining non-policy content targets in target order.
3. The policy target, if present.

The manifest is written last by C2. Plans with no runtime content target keep C2's operation
order, including plans that touch policy alone. This is the complete C3 prepare-order change.

An edited helper still needs C2 content approval. Declining replacement means withholding the
helper's `--approve-user-content` path. Prepare refuses with `APPLY_APPROVAL_REQUIRED`, using
C2's existing content-reason text. There is no additional tool-decision field.

A non-migration plan requires `security-decisions.json` when both are true:

- A `create` or `modify` policy draft parses as a JSON object with numeric `schema: 2`.
- At least one catalog runtime target is installed or staged.

This applies to both schema-1-to-2 migration and later schema-2 edits. It does not trigger for
unchanged policy content, schema-1 drafts, metadata-only operations, or a generic policy draft
with no catalog runtime installed or staged.

Prepare refuses that missing workflow with `MIGRATION_REQUIRED`, targeted at the policy.
Commit repeats the trigger after bindings, so an otherwise consistent forged plan cannot
bypass it. Existing C2 generic schema-2 draft cases without runtime consumers remain valid.

Commit's order is pinned:

1. Existing lock, lifecycle and approved-plan-hash checks.
2. `loadPlan`, path safety and I2-10 `refusePlanOps(plan, 'prepare')`.
3. Complete binding recheck, including decisions presence.
4. Schema-2 workflow trigger; fail `MIGRATION_REQUIRED` if applicable.
5. For a migration, rebuild and check the runtime unit.
6. Derive and verify the manifest as in 3.10.
7. Existing genuine-no-op return, heartbeat, journal and writes.

At step 5, read the current trusted catalog and source assets. Rebuild capabilities and reviewed
hashes from them, and candidate hashes from bound installed/draft files. Never trust a hash or
capability claimed by `plan.json`.

Every required runtime target must already have the C2 role and binding prepare would produce.
A missing bound candidate role fails `TOOL_UNIT_UNREVIEWED` for that target without reading an
unbound project path. A catalog capability failure takes precedence over that target's
missing/hash failure.

Commit tool failures use F / 3, empty stderr and a `target` field:

```text
{
  ok: false,
  code: "TOOL_UNIT_INCOMPATIBLE",
  error: "TOOL_UNIT_INCOMPATIBLE: compatible reviewed reader required: <target>",
  target: "<target>"
}
```

`TOOL_UNIT_UNREVIEWED` uses:

```text
TOOL_UNIT_UNREVIEWED: reviewed tool bytes required: <target>
```

A catalog failure uses `target: "data/runtime-units.json"` and
`TOOL_CATALOG: invalid runtime unit catalog`. These failures occur before heartbeat, journal
or any write. Filesystem failures keep the I/O mapping in 3.12.

### 3.10 Manifest verification

Extract C2's record-building and manifest construction into one internal derivation routine
used by prepare and commit. It is not a new public export or test seam.

At commit, after the workflow and tool checks:

- Read the bound prior manifest.
- Read the five fixed C2 request files and verify their raw bindings.
- Parse and validate those request bytes with C2's existing readers.
- Require canonical equality between those parsed values and embedded `plan.metadata` values,
  including null for absence.
- Derive automatic records, requested records, metadata operations and the final manifest.
- Compare derived metadata operations and `manifestAfter` canonically with the plan.

Embedded request values cannot substitute for the bound run-file bytes. A forger cannot repair
a forged `manifestAfter` merely by changing embedded metadata.

Derivation uses:

- `plan.skillVersion`, not the running skill's current version.
- `plan.head` as `sourceCommit`, without invoking Git.
- `plan.mode` and `plan.agents`.
- The bound prior manifest's records and extension fields.
- `op.action`, rather than reclassifying the current target.
- Non-secret draft bodies when C2 needs them for normalized hashes or block inference.
- C2's `requireRefusalSet()` for secret classification: shipped defaults plus the bound installed
  policy, never the drafted policy.

The derivation routine does not read target bodies. It does not read secret or vault bodies.
For those records it uses C2's fixed merged record and note:

```text
secret-pattern path; content never hashed into reports
```

C2's earlier binding reads remain separate. The no-target-body-read rule above is an
implementation requirement, not a new instrumentation-based test.

Preserve C2's automatic-record rules, extension fields, sorted file map, metadata-op reasons,
header rules and null `manifestAfter` for a genuine no-op. Automatic records do not become
metadata operations.

A genuine mismatch, invalid embedded request equivalence or semantic rejection during
derivation fails F / 4:

```json
{
  "ok": false,
  "code": "APPLY_MANIFEST_MISMATCH",
  "error": "prepared manifest does not match reviewed operations; run prepare again"
}
```

I/O failures during derivation instead use C2 I2-6's F / 2:

```text
{
  ok: false,
  code: "APPLY_INPUT_IO",
  error: "cannot read transaction input: <project-relative-path>"
}
```

For example, a failed request read names
`.ai/.run/<id>/managed-keys.json`; a draft read names
`.ai/.run/<id>/drafts/<target>`. Do not report its absolute path or tell the user an I/O failure
was a manifest mismatch. Unsafe paths retain `APPLY_PATH` / 2.

All these refusals have empty stderr and occur before heartbeat, journal or writes.
Earlier validation, refusal and binding failures retain their earlier errors.

### 3.11 Recorded state, detect, validate, blocks and scanner

Record the installed approved managed policy as:

```text
files[".ai/security-paths.json"] = {
  ...preservedRecordExtensions,
  ownership: "keys",
  managed: { schema: 2, patterns: <complete resolved managed list> },
  ...applicableOmissions
}
```

Never place `projectPatterns` in managed metadata. Record the snippet as the existing manifest
field `codexSnippetSha256: H(exactSnippetBytes)`.

`inspectSecurityState` uses the same baseline selection as migration. Compare complete current
adapted managed entries with the installed list for drift, including order and metadata.

An installed list is behind only when some desired identity is absent from both that installed
list and its exact policy omissions. Desired ordering and metadata changes do not alone mean
behind. Suppress behind when managed drift is present.

Unknown baseline emits only the baseline row, plus applicable project and snippet rows. It
emits neither `policy-managed` nor `policy-version`.

Rows appear in this order: managed/baseline, behind, project, snippet.

| Level/check | Exact detail |
| --- | --- |
| pass / policy-managed | `.ai/security-paths.json: managed patterns match installed baseline` |
| fail / policy-managed | `.ai/security-paths.json: managed patterns edited since install` |
| info / policy-baseline | `.ai/security-paths.json: installed baseline unknown` |
| info / policy-version | `.ai/security-paths.json: installed managed patterns are behind this skill` |
| info / policy-project | `.ai/security-paths.json: projectPatterns <keys-json>` |
| info / codex-snippet | `Codex deny-read snippet has not been recorded` |
| info / codex-snippet | `Codex deny-read snippet is stale; render and review it again` |

`<keys-json>` is compact `JSON.stringify(projectPatterns.map(K))`, preserving order and
duplicates. Emit that row only for a nonempty project list. An equal snippet hash emits no
snippet row. With no policy and no record, emit only the missing-snippet row.

A clean committed v2 migration must immediately report managed pass and no behind row. An
explicitly kept metadata edit recorded by the migration is also current, not permanently behind.

Detect adds `ai.securityPolicy` containing these rows. Invalid manifests keep C2's existing
manifest summary and `mode: "invalid"` handling; do not inspect their untrusted ownership data.

For a malformed installed policy, detect exits 0 and sets:

```text
ai.securityPolicy = [{
  level: "fail",
  check: "policy-schema",
  detail: ".ai/security-paths.json: <C1 error message>"
}]
```

In that branch, the repository-content matcher returns protected for every candidate path.
`safeRead` returns null without opening candidate bodies; skip direct package-content reads
and set `project.package` to null. Continue names-only inventory, existence checks, Git
metadata and C2's fixed manifest-control read. `contentRiskFiles` is empty because no usable
policy exists. Existing secret-name projections use the conservative matcher and their
existing template/run-name exclusions. Do not load shipped defaults as a substitute matcher.

This preserves detect's exit-0 and manifest-reporting contract without guessing which content
is safe after a policy parse failure.

C3 changes validate only by removing its obsolete "differs from this skill version" warning.
It does not add `inspectSecurityState` rows to validate. C10 owns R49 and R81/R82 validator
integration. A malformed policy alone does not gain a new C3 validator exit; existing checks
still determine validate's result.

For `blocks.mjs --file`:

1. Keep `safeResolve` first.
2. Check the original relative spelling with the effective policy.
3. For an existing regular file, obtain `fs.realpathSync.native`, make it repository-relative,
   and check that spelling before reading content.
4. Refuse a protected alias with F / 2, code `POLICY_INPUT_ALIAS`, and text from 3.12.

The existing original-spelling refusal remains exit 1 without a `code` field:

```text
refusing to read a secret-pattern path: <rel>
```

Missing permitted files remain usable by upsert. Existing `safeResolve` junction/link refusal
behaviour is unchanged; C3 adds no mandatory junction test or new junction process contract.
C5 owns that containment coverage.

Under Q4, keep gitleaks scanning protected paths and keep `--redact`. Do not add policy excludes
or reduce scanner input scope. Remove the finding filter for `.ai/.run/` and `.ai/.canary/`.

`labelScanFindings` preserves count and order. Map each finding to:

- `file`: existing root-relative POSIX conversion of `File`, with absent File treated as empty.
- `line`: positive integer `StartLine`, otherwise null.
- `rule`: nonempty string `RuleID`, otherwise `"unknown"`.
- `commit`: first eight characters of a string `Commit`, otherwise null.
- `protected`: C1 matching against the effective policy.

Do not include match, secret, entropy or arbitrary scanner fields.

Non-array reports or non-object elements throw `SCAN_REPORT_SHAPE`. The CLI maps malformed
report data to its existing successful `not-scanned` response with reason `unreadable report`.
Missing or failed gitleaks remains `not-scanned`, never `clean`.

The successful scan note is exactly:

```text
Matches are redacted and not shown. Protected paths, run vaults and canary files are included. Report file:line:rule to the user; never open the files.
```

### 3.12 Errors and process envelopes

Pure C3 errors are `Error` instances with an own string `code` and message
`<CODE>: <detail>`. They contain no file bodies. CLI-only usage and apply errors use the exact
unprefixed text indicated below.

F means pretty JSON plus LF:

```text
{ ok: false, code, error, ...specifiedExtraFields }
```

P means prepare's existing envelope:

```text
{
  ok: false,
  code: "APPLY_PLAN_REJECTED",
  error: "plan rejected",
  errors: [{ target, code, error }]
}
```

All handled C3 failures print to stdout with empty stderr.

| Code | Exact detail or CLI text |
| --- | --- |
| `MIGRATION_INPUT` | `migration input must contain the documented fields` |
| `MIGRATION_BASELINE_INVALID` | `shipped policy baseline is unavailable or invalid` |
| `MIGRATION_DECISIONS` | `invalid security migration decisions` |
| `MIGRATION_DECISION_REQUIRED` | `explicit decision required for <id>` |
| `MIGRATION_REPORT_CHANGED` | `migration report changed; review decisions again` |
| `MIGRATION_DRAFT_CONFLICT` | `staged migration output conflicts with <path>` |
| `MIGRATION_OUTPUT_MISMATCH` | `staged migration output does not match decisions: <target>` |
| `MIGRATION_REQUIRED` | `schema-2 policy changes with installed tools require security-decisions.json` |
| `RENDER_DEPTH` | `codexGlobScanMaxDepth must be an integer from 1 through 100` |
| `DENY_SETTINGS` | `settings permissions must contain string arrays` |
| `DENY_OWNERSHIP_SELECTION` | `dropOwnership must name only recorded managed deny strings` |
| `TOOL_CATALOG` | `invalid runtime unit catalog` |
| `TOOL_UNIT_INPUT` | `invalid security tool unit` |
| `TOOL_UNIT_INCOMPATIBLE` | `compatible reviewed reader required: <target>` |
| `TOOL_UNIT_UNREVIEWED` | `reviewed tool bytes required: <target>` |
| `POLICY_IO` | `cannot read security policy: <source>` |
| `MIGRATION_IO` | `cannot read migration input: <path>` |
| `MIGRATION_WRITE` | `cannot stage migration output: <path>` |
| `SCAN_INPUT` | `scanner root must be a nonempty string` |
| `SCAN_REPORT_SHAPE` | `scanner report must be an array of objects` |

CLI-only text:

```text
MIGRATION_USAGE:
usage: migrate-security-paths.mjs report --project <root> OR stage --project <root> --run-id <id>

RENDER_USAGE:
usage: render-permissions.mjs json|codex-snippet|pathspec [--project <root>]

POLICY_INPUT_ALIAS:
refusing to read a secret-pattern path through an alias

APPLY_MANIFEST_MISMATCH:
prepared manifest does not match reviewed operations; run prepare again
```

`MIGRATION_REQUIRED` is an apply refusal and uses its table detail without a code prefix.
`POLICY_INPUT_ALIAS` and `APPLY_MANIFEST_MISMATCH` likewise use their unprefixed CLI text.
Other pure errors retain their prefix when mapped to F or P.

Mappings:

| Context | Envelope / exit |
| --- | --- |
| Migration/render usage | F / 1 |
| Report/stage semantic error | F / 3 |
| Render C1 validation or depth error | F / 3 |
| Loader `POLICY_IO` | F / 2 |
| Report/stage input I/O | F / 2, `MIGRATION_IO` |
| Stage output I/O | F / 2, `MIGRATION_WRITE` |
| Prepare semantic rejection | P / 3 |
| Unprepared/prepared diff semantic rejection | F / 3 |
| Diff I/O | F / 2, `APPLY_DIFF_IO` |
| Commit workflow/tool rejection | F / 3 |
| Commit derivation mismatch/rejection | F / 4, `APPLY_MANIFEST_MISMATCH` |
| Commit derivation I/O | F / 2, `APPLY_INPUT_IO` |
| Malformed plan | F / 1, `APPLY_PLAN_INVALID` |
| Binding drift | F / 4, `APPLY_DRIFT` |
| Alias refusal | F / 2, `POLICY_INPUT_ALIAS` |

C2 texts remain exact:

```text
APPLY_PLAN_INVALID:
invalid prepared plan; run prepare again

APPLY_PLAN_SCHEMA:
unsupported prepared plan; run prepare again

APPLY_DRIFT:
changes since prepare; nothing was written. Re-run prepare and get approval again.

APPLY_DIFF_IO:
cannot read draft review input: <project-relative-path>

APPLY_INPUT_IO:
cannot read transaction input: <project-relative-path>

APPLY_APPROVAL_REQUIRED, metadata only:
metadata changes require --approve-user-content <target>

APPLY_APPROVAL_UNRELATED:
--approve-user-content names files that do not need it; refusing broad approvals
```

Content approval text remains C2's ordered content/metadata reasons followed by:

```text
. Show the diff; re-run prepare with --approve-user-content <target> only after the user approves it
```

The metadata reasons remain:

```text
policy ownership or managed metadata changes
settings ownership or managed metadata changes
approved omission records change
recorded file ownership changes
```

C2 source refusals remain `APPLY_DUPLICATE_TARGET`, `APPLY_PATH`, `APPLY_MANIFEST_DRAFT`,
`APPLY_SECRET_TARGET`, `APPLY_WRITE_DENIED`, `APPLY_WRITE_SCOPE`, `APPLY_VAULT_TARGET` and
`APPLY_TARGET_TYPE`, with the existing C2/I2-10 texts and exit mappings. C3 does not replace
their errors with migration errors.

Request failures remain `APPLY_INPUT_JSON`, `APPLY_INPUT_SHAPE`,
`APPLY_METADATA_OWNERSHIP`, `APPLY_METADATA_TARGET` and `APPLY_METADATA_REQUIRED` as defined by
C2. Shared `OWNERSHIP_*`, `OMISSIONS_*`, `HOOK_IDENTITY` and C1 `POLICY_*` errors retain their
code and prefixed message.

In particular:

```text
MANIFEST_INVALID: invalid manifest
MANIFEST_SCHEMA: schema must be 2 or 3
POLICY_JSON: policy text must be valid JSON
POLICY_SCHEMA: policy.schema must be 1 or 2
```

Report/stage invalid manifest JSON maps to `MANIFEST_INVALID` F / 3, without native parser text.
A structurally invalid manifest uses the same code/message. An unsupported manifest schema uses
`MANIFEST_SCHEMA` F / 3.

Prepare's malformed-hash case is exactly:

```json
{
  "ok": false,
  "code": "APPLY_PLAN_REJECTED",
  "error": "plan rejected",
  "errors": [
    {
      "target": ".ai/manifest.json",
      "code": "MANIFEST_INVALID",
      "error": "MANIFEST_INVALID: invalid manifest"
    }
  ]
}
```

It exits 3, writes no plan and performs no migration.

Prepare targets are pinned:

- Manifest errors: `.ai/manifest.json`.
- Policy errors and missing workflow: `.ai/security-paths.json`.
- Decision errors: `security-decisions.json`.
- Projection errors: affected project target or bare C2 request filename.
- Tool errors: affected `.ai/tools/...` target.
- Catalog errors: `data/runtime-units.json`.

A decisions read failure uses prepare target `security-decisions.json`, while its I/O message
names `.ai/.run/<id>/security-decisions.json`.

Diff migration semantic refusals include the same `target`. Report/stage do not add a target
field unless a specified response requires one. Commit tool failures include target as in 3.9;
manifest mismatch and input I/O do not add one.

Prepare preserves C2 safety and structural checks first. It then validates manifest, policy
and ownership, decisions, report/action consistency, staged projections, catalog/tool
compatibility and finally approvals. A C3 semantic failure stops before approval evaluation.

No changed exit-5 partial-write, exit-6 incomplete-rollback or exit-7 lifecycle contract is
introduced.

## 4. Tests

### 4.1 Component registration

Create import-safe `tests/c3.test.mjs`, exporting a frozen `C3_IMPLEMENTATIONS` list using C11a's
existing descriptor/run contract. Each run returns `{failures, skipped:null}` and does not
print records itself.

Register these exact descriptors, in this order, in both component maps:

| ID | Name |
| --- | --- |
| `R44/C3/anchors` | `anchored control rendering` |
| `R47/C3/project-controls` | `project patterns reach every rendered control` |
| `R74/C3/rendering` | `shared corpus and stored rendering spelling` |
| `R48/C3/project-moves` | `approved project pattern moves` |
| `R78/C3/baseline` | `installed records establish baseline identity` |
| `R78/C3/migration` | `versioned migration preserves project fields` |
| `R78/C3/replacement-coverage` | `replacement coverage needs its own decision` |
| `R52/C3/user-denies` | `identical user denies stay user owned` |
| `R85/C3/retained-denies` | `retired deny bytes and ownership survive` |
| `R80/C3/snapshot` | `one approved snapshot binds migration outputs` |
| `R80/C3/tool-unit` | `policy migration requires compatible reviewed tools` |
| `R80/C3/manifest-after` | `commit verifies the derived manifest` |
| `R81/C3/recorded-patterns` | `recorded patterns distinguish drift and behind` |
| `R82/C3/snippet` | `recorded snippet hash detects stale rendering` |
| `R97/C3/environment-controls` | `environment variants receive rendered coverage` |
| `Q4/C3/scan-labels` | `protected findings remain scanned and redacted` |
| `V2/C3/recovery` | `coupled migration rolls back through one journal` |
| `V2/C3/module-contract` | `C3 exports errors and component contracts` |

Do not add complete numbered-case records or change `RC1_CASE_IDS`. These are partial C3
assertions; C11b composes complete numbered cases.

### 4.2 Fixtures and seams

Use C11a's `createV2InstalledFixture` and genuine tagged v2 scripts for installed fixtures.
Do not hand-author a substitute v2 installation. Controlled fixture edits occur only after
that installation and retain provenance.

`tests/fixtures/rc1-migrations.json` has:

```text
{
  schema: 1,
  cases: [{
    id: string,
    input: MigrationInput,
    decisions: MigrationDecisions | null,
    expected: {
      report: MigrationReport | null,
      policy: object | null,
      managed: object | null,
      omissions: object | null,
      error: { code: string, message: string } | null
    }
  }]
}
```

Store complete literal expected objects. Do not compute expected migration results by calling
the implementation. Hash expectations may use `H`/`NH` over independently constructed expected
bytes.

Required case IDs:

```text
known-unchanged
current-shipped
missing-record
unrecognized-hash
malformed-hash
recorded-schema1
metadata-edit
changed-glob
project-move
deleted-base
old-env-omission
replacement-omitted
unknown-current-matches-v2
preserved-fields
duplicate-entries
contradictory-decisions
```

`old-env-omission` uses a valid schema-1 keys policy record. Its managed list excludes
`**/.env.*`; its policy omissions contain that entry. Every managed entry and omission carries
an explicit anchor, including schema-1 metadata, as required by C2. The current schema-1 policy
also excludes the omitted entry.

For successful coupled migrations before C4, copy the skill into scratch storage, replace
`data/runtime-units.json`, and supply a synthetic Git-reader asset declaring `[1,2]`. It must
actually import the shared helper and parse both policy schemas. No production test override
is added.

Tests may use:

- Existing C11a isolated Git configuration and fixture helpers.
- Explicit roots and absolute `process.execPath`.
- A recording/failing Git shim placed first on PATH, with a successful interception control.
- Node preloads that patch documented `node:fs` methods or `spawnSync`, followed by
  `syncBuiltinESMExports`, for public-boundary I/O and scanner tests.
- An exact-path `realpathSync.native` replacement for a permitted alias that resolves to a
  protected name, paired with a control demonstrating interception.

Do not patch an internal manifest-derivation call boundary. Do not add derivation-specific
read-recording tests or a derivation-only EACCES test. The no-target-body-read requirement is
checked during implementation review; manifest outcome tests cover the security result.

### 4.3 Rendering assertions

`R44/C3/anchors`:

- `{anchor:"root",glob:"Env/**"}` renders `Read(/Env/**)`,
  `:(exclude,glob,icase)Env/**` and `"Env/**" = "deny"` in both profiles.
- `{anchor:"any",glob:"**/*.pem"}` renders the exact corresponding A1 forms.
- Assert no leading slash is added to Git or Codex keys.
- Assert command-deny values and ordering exactly match 3.3.
- Empty patterns produce no Read denies or Git lines; command denies remain.

`R47/C3/project-controls`:

- A schema-2 policy with managed `**/.env*` and project root `env/**` and `cert/**` produces all
  three identities in all renderers.
- Existing identical project/managed identities yield one rendered rule with first-source
  spelling.
- CLI `--project` loads the installed file, not defaults.
- Malformed installed policy produces C1 F / 3 with no partial rendering.

`R74/C3/rendering`:

- Run the C1 shared policy corpus through C3 rendering.
- Assert identity count, anchor form and first-source spelling for mixed-case duplicates.
- Assert no case companions or extra rule groups.
- Assert schema-1 rendering adapts without writing.
- Compare the complete snippet against the preserved template with only permitted substitutions.
- Invalid depth gives `RENDER_DEPTH`; unknown arguments give exact `RENDER_USAGE`.

`R97/C3/environment-controls`:

- Desired policy has one `**/.env*`, no old environment entries, and the two added identities.
- Assert exact Read/Git/Codex forms for `.env*`, `*.cert` and `.htpasswd`.
- Pair `.env`, `.env.local`, `.envrc`, `.environment` and nested/mixed-case names with C1's
  matching results. This asserts rendered coverage, not host enforcement.

### 4.4 Migration assertions

`R78/C3/baseline`:

- Genuine v2 full-record hash gives `baseline:"v2.0.0"`.
- Current shipped full-record hash gives `baseline:"shipped"`, no unknown warning and no
  unnecessary all-entry decisions.
- Missing record with current policy gives unknown; every current row is managed-edit with
  `before:null`.
- A valid unrecognized 64-hex record gives the same unknown treatment.
- Current bytes equal to shipped v2 do not change either unknown result.
- A full record with missing or malformed hash gives the exact `MANIFEST_INVALID` prepare
  envelope in 3.12, exit 3, no plan.
- Invalid JSON and unsupported manifest schema use their pinned report/stage and prepare errors.
- Valid keys metadata is recorded for both current policy schemas.

`R78/C3/migration`:

- Clean v2 yields unchanged current rows and coverage IDs 0, 7 and 18.
- A changed note is one managed edit; `keep` preserves it, `replace` restores baseline fields.
- Changed glob yields one addition and one deletion, not an edit.
- A deleted baseline entry requires restore/omit unless already exactly omitted.
- Preserve top-level extensions, `contentRisk`, depth, entry extensions and project entries.
- Preserve duplicate entry occurrences in the report and apply first-unused matching.
- Resolve to schema 2 with explicit anchors.
- Invalid report hashes, missing decisions and contradictions produce exact errors from 3.12.

`R48/C3/project-moves`:

- Added root `env/**` remains a reported addition until an explicit decision.
- `project` moves its complete entry to the end of `projectPatterns`.
- Prepare without policy approval refuses with `APPLY_APPROVAL_REQUIRED`.
- With the required path approval, managed metadata excludes that entry and effective rendering
  still includes it.
- `keep` records it as managed only through the applicable C2 approval.
- Existing project entries remain in order and are not adopted.

`R78/C3/replacement-coverage`:

- The anchored schema-1 keys omission fixture reports the old omission under new environment
  coverage and still requires `coverage:0`.
- Including replacement adds `**/.env*` and keeps the old omission record.
- Omitting replacement preserves unomitted old environment entries.
- Separately omitting an old entry removes only that exact identity.
- Exact omission of a desired new identity suppresses that coverage row.
- Root/any and case-normalized omission identities follow C2, not broad overlap.
- Unknown baselines still show applicable old replacements and omissions.
- Entry omit X plus coverage include X is `MIGRATION_DECISIONS`.
- Addition-to-project plus include X preserves both sources and renders one effective rule.

### 4.5 Deny assertions

`R52/C3/user-denies`:

- Pre-existing user `Read(/env/**)` and `Read(/cert/**)` remain in the same positions.
- They appear in `alreadyPresent` and `alreadyCovered`, not new managed ownership.
- Existing duplicates remain byte-equivalent when no settings values change.
- Missing desired rules append and become managed.
- `Read(![.]env.example)` holds back `Read(**/.env*)`; explicit override appends it.
- Provably disjoint exceptions hold back nothing.
- Pin both legacy conflict object shapes and CLI report mapping.
- No allow-file means no `permissions.allow` managed request.
- Existing managed allow/hooks fields survive unchanged.
- `managed.heldBack` is refreshed to the exact current result.

`R85/C3/retained-denies`:

- Genuine v2 managed `Read(**/.env)` and `Read(**/.env.*)` survive replacement migration with
  bytes and ownership.
- An omission does not silently retire their ownership.
- Absent retired strings retain metadata without automatic restoration.
- Explicit `dropDenyOwnership` removes selected metadata only.
- A metadata-only drop requires settings approval and writes no settings draft.
- Unknown drop selection gives `DENY_OWNERSHIP_SELECTION`.
- Nothing is removed merely because the desired renderer list lacks it.

These assertions also cover C3's R78 deny-ownership portion. They do not test C7 allow retirement.

### 4.6 Snapshot, tool-unit and manifest assertions

`R80/C3/snapshot`:

- Stage, prepare and diff agree on the resolved policy, Read denies, snippet and managed records.
- Migration plan has exactly the ordinary keys plus `security`.
- `security` has exactly `decisionsSha256`, hashing raw decision bytes.
- Ordinary plan retains exactly C2's 15 keys.
- Adding decisions after ordinary prepare is drift.
- Changing or removing migration decisions is drift.
- Changing policy, settings, unchanged runtime, drafts, each request or manifest yields the
  corresponding C2/C3 drift row, F / 4, no write or journal.
- Malformed optional security shapes fail `APPLY_PLAN_INVALID` before plan-named reads.
- Prepared review tool rows are recomputed from catalog and assets.
- A trusted-skill change that alters expected staged projections gives
  `MIGRATION_OUTPUT_MISMATCH`, F / 3, exact target and no partial review.
- No skill-input binding rows or tests are added.
- Prepared and unprepared migration diff invoke zero Git commands after the shim control.
- Unprepared invalid decisions and incompatible tools give their pinned F / 3 errors.
- Public-boundary input I/O uses exact path-bearing diff/prepare/commit mappings.

`R80/C3/tool-unit`:

- Genuine v2 stage succeeds and includes the missing security-policy helper.
- Genuine v2 prepare fails at `.ai/tools/git-safe.mjs` with
  `TOOL_UNIT_INCOMPATIBLE`, P / 3.
- Synthetic compatible reader plus shared helper succeeds.
- Capability is checked before absence/hash for each target; targets are checked lexically.
- Missing compatible candidate and wrong reviewed hash give `TOOL_UNIT_UNREVIEWED`.
- Malformed rows give `TOOL_UNIT_INPUT`; malformed catalog or missing required role gives
  `TOOL_CATALOG`.
- A new reader parses old policy without modifying it.
- Withholding approval for an edited helper gives C2's exact helper approval refusal.
- Catalog runtime writes precede policy and manifest; helper precedes reader.
- No-runtime plans retain C2 order, including policy-only plans.
- Later schema-2 edits with tools and no decisions give `MIGRATION_REQUIRED`.
- Unchanged, metadata-only and no-consumer controls do not trigger it.
- A forged, hash-approved schema-2 plan without decisions fails `MIGRATION_REQUIRED` before
  tool or manifest checks.
- A forged, hash-approved migration with consistent bindings cannot make the old reader
  acceptable by claiming its hash: commit rebuilds trusted capabilities and fails
  `TOOL_UNIT_INCOMPATIBLE`, F / 3, with its target.
- Replacing the trusted compatible catalog with `[1]` after prepare produces that same commit
  failure before manifest verification.
- A compatible catalog with a newly changed trusted reader asset and an old bound candidate
  produces `TOOL_UNIT_UNREVIEWED`, F / 3, exact target.
- All pre-write failures preserve lock bytes and create no journal.

`R80/C3/manifest-after`:

Start with a valid prepared plan, rewrite it, and approve the rewritten plan's actual hash.
Keep the plan structurally valid and all ordinary bindings consistent.

Each of these must give `APPLY_MANIFEST_MISMATCH`, F / 4, exact text, no heartbeat, journal or
project write:

- Forge the installed managed pattern list in `manifestAfter`.
- Forge `codexSnippetSha256`.
- Delete or change an unrelated preserved record or extension.
- Add an unearned record.
- Change a full-record hash or block record without matching content.
- Forge embedded managed/omission/manifest request values and `manifestAfter` while leaving the
  bound request-file bytes unchanged.
- Alter metadata operations to agree only with the forged manifest.
- Add an otherwise consistent ordinary content op without deriving its automatic record.

Controls:

- Canonical object-key reordering alone succeeds.
- An ordinary consistent content op with the correctly derived record succeeds.
- A correct metadata-only plan succeeds.
- A genuine no-op remains unchanged.
- Changing the running skill's VERSION after prepare does not rewrite `plan.skillVersion`;
  derived headers still use the bound plan's version, head, mode and agents.
- An I2-10 forbidden target is refused before manifest mismatch.

Do not add phase-specific derivation EACCES or internal read-boundary tests. The I/O mapping
and no-target-body-read implementation requirements remain explicit in 3.10.

### 4.7 Inspection, scanner, alias and recovery assertions

`R81/C3/recorded-patterns`:

- Known unchanged baseline yields the exact managed pass row.
- Older v2 list yields pass plus behind.
- Changed managed metadata or order yields fail and no behind.
- Unknown yields only baseline plus applicable project/snippet rows.
- Current shipped installation is known.
- After clean migration commit, inspection yields managed pass and no behind.
- An approved kept edit, recorded as installed, also yields pass and no behind.
- Project-only additions do not become managed drift.
- Exact desired omissions prevent behind; old replacement omissions do not.
- Malformed detect policy gives the exact fail row, exit 0 and deny-all candidate matcher.
- Read guards prove instruction/package candidate bodies are not opened in that branch.
- C2's malformed-manifest detect summary and mode remain unchanged.

`R82/C3/snippet`:

- Missing hash gives the exact not-recorded row.
- Correct hash gives no snippet row.
- Policy/depth change gives the exact stale row.
- A snippet-only metadata transaction writes only the manifest and rolls back.
- Validate no longer emits the obsolete shipped-byte warning.
- Do not assert C10's future validator rows.

`Q4/C3/scan-labels`:

Use a scanner stub and synthetic findings for:

```text
.env
env/private.json
docs/public.txt
.ai/.run/run-0001/vault/backup/item
.ai/.canary/item
```

With shipped defaults plus root `env/**`, expect five findings in the original order with
protected values:

```text
true, true, false, true, false
```

Assert exact mapped fields, count 5, scanner `--redact`, absence of policy excludes and exact
scan note. Include secret-marker fields in stub findings and assert no marker appears in
stdout/stderr. Missing scanner, failed scanner and malformed report remain `not-scanned`.

`V2/C3/module-contract` also covers blocks alias protection:

- A regular permitted spelling whose stubbed native realpath is protected fails
  `POLICY_INPUT_ALIAS`, F / 2, before opening content.
- A permitted realpath control reads successfully.
- Literal protected spelling retains its exit-1 legacy envelope.
- Missing permitted upsert target remains supported.
- Junction containment stays in C5; no new C3 mandatory junction case.

`V2/C3/recovery`:

- Commit a synthetic compatible migration through one C2 journal.
- Assert helper/reader, settings/policy and manifest results and write order.
- Rollback restores exact original policy, settings, tools and manifest bytes.
- Newly created helper removal obeys C2's expected-written-hash guard.
- Metadata-only rollback changes only manifest.
- Inject a normal C2 write failure after a runtime write: exit 5 and recoverable journal.
- Later user edit causes incomplete rollback, exit 6, and preserves that edit and backups.
- Unresolved/written-run reuse retains exit 7.
- Do not introduce a second migration writer or rollback path.

### 4.8 Existing-suite edits and invariants

R09 replaces expected managed `Read(**/.env.*)` with `Read(**/.env*)`; exception text and holdback
behaviour remain unchanged.

R17 makes the same environment replacement, including its disjoint bare-name control. Its
bracket-exception conservative behaviour remains required. C1 embedding remains unchanged.

R15 runs `runComponentAssertions('C3', context)` after its existing component coverage. It fails
unless that report is successful. Do not print C3 sub-records inside R15 or inflate baseline
case counts.

C2's I2-10 successful control at 2596-2600 must, after adding `docs/i210-control.md`, also set:

```json
{
  "ownership": "merged"
}
```

as that target's `manifestAfter.files` record, sort the file map, rewrite the plan and recompute
the approved hash. No metadata operation is added for this automatic record. The secret and
out-of-scope I2-10 cases stay unchanged and still fail before binding or manifest checks.

This is the only planned C2 test adjustment. It reflects the maintainer-assigned new commit
manifest check, not a weakening of I2-10.

R10, S01, S02 and S03 retain their existing success/failure expectations. Fresh schema-1 setup
remains supported; S02 remains a genuine no-op; CRLF comparison remains normalized.

Required totals remain:

```text
baseline: 59 PASS / 0 FAIL / 1 SKIP
C11a:     8 PASS / 0 FAIL / 0 SKIP
C1:       12 PASS / 0 FAIL / 0 SKIP
C2:       14 PASS / 0 FAIL / 0 SKIP
C3:       18 PASS / 0 FAIL / 0 SKIP
```

The sole baseline skip on this Windows host is R13d. No new C3 skip is allowed.

## 5. Edge cases and failure modes

| Frozen C3 edge or required failure | Concrete coverage |
| --- | --- |
| Known versus missing/unrecognized baseline | `R78/C3/baseline` |
| Malformed baseline record requires repair | Same, exact prepare `MANIFEST_INVALID` |
| Current bytes do not establish ownership | Same, `unknown-current-matches-v2` |
| Current shipped defaults are known | Same, `current-shipped` |
| Schema-1 keys record is a recorded baseline | Same, `recorded-schema1` |
| Changed glob is deletion plus addition | `R78/C3/migration` |
| Preserved extensions and duplicate occurrences | Same |
| Project moves require explicit decisions/approval | `R48/C3/project-moves` |
| Old omission does not decide new coverage | `R78/C3/replacement-coverage` |
| Omitting replacement preserves old coverage | Same, `replacement-omitted` |
| Contradictory decisions | Same, exact `MIGRATION_DECISIONS` |
| Old reader with new policy fails | `R80/C3/tool-unit` |
| New reader adapts old policy without writing | Same |
| Missing shared helper joins update unit | Same |
| Declined edited helper blocks migration | Same, C2 approval refusal |
| Forged reviewed hash cannot bypass capabilities | Same, commit trusted-catalog check |
| Post-migration schema-2 edits use decisions | Same, workflow trigger |
| Identical user denies remain user-owned | `R52/C3/user-denies` |
| Conservative user exception overlap | Same |
| Retired managed deny bytes/ownership survive | `R85/C3/retained-denies` |
| Ownership drop leaves settings bytes intact | Same |
| Older baseline is behind; managed edits are drift | `R81/C3/recorded-patterns` |
| Clean migration does not remain behind | Same |
| Unknown has no managed/behind assertion | Same |
| Stale snippet | `R82/C3/snippet` |
| Protected scan findings retained and redacted | `Q4/C3/scan-labels` |
| Changed prepared inputs | `R80/C3/snapshot` |
| Changed trusted rendering source | Same, output mismatch |
| Forged manifest or embedded request | `R80/C3/manifest-after` |
| Failure before write leaves no journal/heartbeat | Snapshot/tool/manifest assertions |
| Partial write and later user edits | `V2/C3/recovery` |
| Filesystem alias before blocks read | `V2/C3/module-contract` |

A genuine v2 migration cannot pass the production tool gate at this intermediate landing.
That is an explicit dependency on C4, not a skipped C3 test or permission to mislabel the reader.

## 6. Runnable acceptance

Run from the repository root in the authorized writable tests lane:

```powershell
node project-setup/tests/run-component-tests.mjs --component C3
node project-setup/tests/run-component-tests.mjs --component C11a
node project-setup/tests/run-component-tests.mjs --component C1
node project-setup/tests/run-component-tests.mjs --component C2
node project-setup/tests/run-tests.mjs
```

The C3 command exits 0, has empty stderr and emits these exact assertion lines:

```text
PASS  R44/C3/anchors  anchored control rendering
PASS  R47/C3/project-controls  project patterns reach every rendered control
PASS  R74/C3/rendering  shared corpus and stored rendering spelling
PASS  R48/C3/project-moves  approved project pattern moves
PASS  R78/C3/baseline  installed records establish baseline identity
PASS  R78/C3/migration  versioned migration preserves project fields
PASS  R78/C3/replacement-coverage  replacement coverage needs its own decision
PASS  R52/C3/user-denies  identical user denies stay user owned
PASS  R85/C3/retained-denies  retired deny bytes and ownership survive
PASS  R80/C3/snapshot  one approved snapshot binds migration outputs
PASS  R80/C3/tool-unit  policy migration requires compatible reviewed tools
PASS  R80/C3/manifest-after  commit verifies the derived manifest
PASS  R81/C3/recorded-patterns  recorded patterns distinguish drift and behind
PASS  R82/C3/snippet  recorded snippet hash detects stale rendering
PASS  R97/C3/environment-controls  environment variants receive rendered coverage
PASS  Q4/C3/scan-labels  protected findings remain scanned and redacted
PASS  V2/C3/recovery  coupled migration rolls back through one journal
PASS  V2/C3/module-contract  C3 exports errors and component contracts
18 PASS / 0 FAIL / 0 SKIP
RESULTS  <absolute evidence path>
```

Only the absolute evidence path varies. The report must contain all 18 expected descriptors,
no duplicate/missing results and no skips.

The other component commands retain their existing assertion lines and end with:

```text
8 PASS / 0 FAIL / 0 SKIP
RESULTS  <absolute evidence path>
```

```text
12 PASS / 0 FAIL / 0 SKIP
RESULTS  <absolute evidence path>
```

```text
14 PASS / 0 FAIL / 0 SKIP
RESULTS  <absolute evidence path>
```

The baseline command exits 0 and retains its existing final envelope format, with:

```text
59 PASS / 0 FAIL / 1 SKIP
```

Its only skip is R13d. R15's internal C3 run emits no extra numbered or component PASS records.

C3 acceptance does not claim `accept-rc1`, full R47/R74/R78/R80/R97 parity, installed release
acceptance or host permission enforcement. Those remain composed gates.

## 7. Rollback

C3 uses C2's existing transaction journal and rollback:

```text
node <SKILL_DIR>/scripts/apply.mjs rollback --run-id <id>
```

For a coupled migration, restore policy, settings, runtime assets and manifest through that
single journal. Remove newly created files only when their current bytes still match the
run's expected written bytes. Metadata-only rollback restores the prior manifest without
rewriting unchanged settings.

Keep backups until confirmation. A partial write requires recovery before another setup run.
Exit 6 means rollback is incomplete; preserve later user edits and retain unresolved backups.
Exit 7 remains the lifecycle barrier.

If a later component fails:

1. Roll back affected project runs in reverse order using the compatible rc.1 tooling.
2. Resolve incomplete rollback before starting another setup operation.
3. Revert dependent component changes before reverting C3 interfaces they use.
4. Revert C3 production, data and tests together, including its I2-10 successful-control
   adjustment.
5. Keep landed C2 I2-10 production refusal checks.

C4, C6, C7, C8, C10 and C11b depend on the interfaces in section 2.5. Their changes cannot remain
active against removed C3 contracts.

A project already migrated to policy schema 2 must retain compatible readers and rc.1 tooling
until its journal restores the old policy, tools and manifest together. Do not put the v2 reader
back first. Do not run old setup commands against a schema-3 manifest.

If the journal is unavailable, restore the coherent pre-migration set from retained backups
under a separate reviewed recovery operation. Do not reconstruct old ownership from current
policy bytes.

## 8. Accepted residual risks

- Claude/Codex case and workspace-root enforcement need host evidence. Static A1 rendering
  preserves stored spelling and does not claim runtime parity.
- Unicode normalization/full case folding and exotic filesystem aliases remain outside the
  team's ASCII secret-name threat model, as decided in PQ2.
- The blocks realpath check covers practical aliases visible through native realpath; it is not
  a general filesystem race or alias-proofing layer. C5 owns broader containment.
- The installed skill and runtime catalog are trusted. C3 does not bind every skill file.
  Prepared review detects changed projections; commit independently rechecks runtime capability
  and source hashes.
- Another process can still modify files between checks and writes. Existing C2 locking,
  source rechecks and recovery remain the proportional protection.
- Path policy does not identify secret content copied into an otherwise permitted filename.
  Scanner findings and content-redaction rules remain necessary.
- Q4 intentionally retains findings under run vaults and canary directories. Repeated scans may
  report backup or canary material; the output is redacted metadata, not evidence of a new leak.
- Missing or failed gitleaks remains `not-scanned`; it is not a clean scan.
- Dropping ownership deliberately leaves settings strings intact. It is not a rule-deletion
  operation and does not promise future reconciliation without a separate omission.
- Production schema-2 migration waits for C4's compatible Git reader. Synthetic reader fixtures
  verify C3's transaction contract without claiming C4 enforcement.
- C10 validation and C11b integration/release evidence remain pending components.

## 9. Plan questions

None. The maintainer's round-1 and round-2 dispositions resolve the remaining choices.

## Round-2 disposition

| Gap | Disposition |
| --- | --- |
| R2-B1 | FIXED, 3.10 and 4.2/4.6: remove internal-boundary and derivation-EACCES tests. |
| R2-N1 | FIXED, 3.8/3.9: drop stored tool evidence; rebuild trusted rows at commit; pin F / 3. |
| R2-N2 | FIXED, 3.9: trigger, tool-unit check, then manifest derivation. |
| R2-N3 | FIXED, 3.10: use `requireRefusalSet()` with shipped and bound installed policy. |
| R2-N4 | FIXED, 3.11/4.7: unknown emits no managed or behind row. |
| R2-N5 | FIXED, 3.11/4.7: malformed-policy detect uses a deny-all candidate matcher, exit 0. |
| R2-N6 | FIXED, 3.8/4.6: recomputed review evidence and exact output-mismatch refusal. |
| R2-N7 | FIXED, 3.10/3.12: derivation I/O uses `APPLY_INPUT_IO` / 2 and relative path. |
| R2-N8 | FIXED, 3.9: catalog validation is shape, required presence and role checks. |
| R2-N9 | FIXED, 2.5/3.9: later schema-2 edits use the migration CLI and decisions file. |
| R2-N10 | FIXED, 3.9/4.6: reader/policy ordering changes only runtime-containing plans. |

The round-2 B6 note is also fixed in 4.2: schema-1 keys fixture entries have explicit anchors.

## Addendum at freeze: plan-critique round 3, C3-P3-1 to C3-P3-5 (NON-BLOCKING)

Added by the orchestrator when freezing, with the maintainer's approval (2026-10-18). Each item
pins a value the sections above left open. Where an item and an earlier section differ, the item
wins.

- C3-P3-1. A filesystem failure during commit's runtime tool-unit check uses `APPLY_INPUT_IO` / 2
  with the project-relative path, like derivation I/O and decision I2-6; add the row to the
  section-3.12 mapping table.
- C3-P3-2. When detect reads an invalid manifest, `ai.securityPolicy` is `null`.
- C3-P3-3. The unprepared diff of an ordinary run applies the same workflow trigger as prepare:
  `MIGRATION_REQUIRED`, F envelope, exit 3, with `target` `.ai/security-paths.json`.
- C3-P3-4. The I2-10 control step in `tests/c2.test.mjs` is at approximately lines 2593-2600 at
  d9bd9d1; both references above mean that step.
- C3-P3-5. `denyOmissions` is the complete requested settings deny-omission list. An entry of the
  prior deny-omission list that is missing from it is a requested removal, which C2 refuses
  without the settings path approval (`APPLY_APPROVAL_REQUIRED`, reason
  `approved omission records change`); a list equal to the prior list requests no omission
  change.
