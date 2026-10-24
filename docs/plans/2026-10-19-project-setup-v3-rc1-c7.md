<!--
FROZEN 2026-10-19 on branch feat/project-setup-v3-rc1. Never edit this file; changes go through the
maintainer. Component plan C7 (lands eighth, after C11a, C1, C2, C3, C4, C5 and C6) under the
frozen architecture plan docs/plans/2026-10-15-project-setup-v3-rc1.md, which takes precedence, on
the landed C4 contract and the frozen C5 and C6 plans
(docs/plans/2026-10-19-project-setup-v3-rc1-c5.md and
docs/plans/2026-10-19-project-setup-v3-rc1-c6.md). Drafted by the plan lane (Codex, 2 revisions
applying the round-1 and round-2 dispositions); plan-critique (Claude) round 3 found no BLOCKING
gap. The addendum at the end records the maintainer's answers to section 9 and round 3's items.
-->

# C7. Allow classification and retirement

Status: revised for critique, round 2.

Baseline: `feat/project-setup-v3-rc1`, commit `4b744ec`, plus the frozen C5 and C6 plans.
Line references identify committed code, not concurrent working-tree changes.

## 1. Scope and dependencies

### 1.1 Authority

The controlling architecture is `docs/plans/2026-10-15-project-setup-v3-rc1.md`:

- Section 2, C7: shared allow classification and explicitly approved retirement.
- Section 4: R53 classifier, R54 refusal, R85 allow retirement and R86 allow reconciliation.
- Ownership notes: C3 retains deny ownership; C10 owns R53 validation reporting.
- Section 5, C7: severity, remedies, personal settings, absent entries and preservation.
- Section 6: one reviewed transaction, omissions, metadata-only operations and journal rollback.
- Freeze addendum: release acceptance remains C11b work.

Design dependencies are A4 and the rc.1 omission subset of B5/B6 in
`docs/design/project-setup-v3.md`, with Part A frozen at `54ad312`.

Q1 governs draft review without Git. Q2 governs exact omission identity; C7 allow identities
are exact strings, not policy globs. Q6 governs schema-3 compatibility and downgrade handling.
Q3/Q4, Q5, PQ1/PQ2 and N8 remain unchanged. C7 consumes their applicable existing controls.

Landing order remains:

```text
C11a -> C1 -> C2 -> C3 -> C4 -> C5 -> C6 -> C7 -> C8 -> C9 -> C10 -> C11b
```

### 1.2 In scope

- A pure allow classifier shared by discovery, merge and later validation reporting.
- Inventory of every installed managed allow, including absent entries and duplicates.
- Explicit selection of managed allows for retirement.
- Settings drafts, managed-list removal and persistent omission requests.
- Metadata-only reconciliation when a selected managed allow is already absent.
- Preservation of user allows, unselected managed allows, deny records and hooks.
- Exact diagnostics, staging envelopes, approvals and component assertions.
- Permission and transaction reference text.

The proposed behavior adds no managed allows.

Refusing every nonempty `--allow-file`, including `other` rules, follows the recommended option
in section 9, question 1. That point remains open for the maintainer.

### 1.3 Out of scope

| Work | Owner |
| --- | --- |
| Ownership schemas, generic approvals, bindings and journal formats | C2 |
| Deny migration, retained denies, policy projections and omissions | C3 |
| Git reader and complete runtime-unit enforcement | C4 |
| Review artifacts and reserved setup IDs | C5 |
| Hook identity, merge, readiness, exemption and self-test | C6 |
| Phase 0 instructions and reviewer/orchestrator documentation | C8 |
| Environment templates and scanner changes | C9 |
| Validation reporting, static scope and doctor | C10 |
| Complete numbered cases, release version, archives and release notes | C11b |
| Managing personal permission arrays | Outside C7 |
| A shell sandbox or exhaustive shell-language analysis | Outside C7 |

Under the recommended option in section 9, question 2, C7 changes no `validate.mjs` code.
C10 wires the exported inspection result into validation because it owns R53 reporting.
This ownership interpretation remains open for the maintainer.

C8 must replace `SKILL.md:121-123`'s
`--allow-file <confirmed.json>` instruction and its command-allowlisting guidance. Until then,
the old instruction can request an operation that C7 refuses. C8 must also document staging
order and the normal-merge refusal after retirement staging.

### 1.4 Consumed contracts

C11a supplies:

- Independent descriptor and implementation registrations.
- Import-safe tests and `{failures:string[],skipped:null}` assertion results.
- Genuine tagged-v2 installation helpers.
- G1-G14, H1-H6 and H7/H7a.
- Partial component records that never establish complete numbered-case coverage.

C1 supplies policy parsing, protected-path matching, structural path validation and Windows
alias handling. C7 does not use policy glob matching for permission-string identity.

C2 supplies:

- `readManifest`, `readManagedMetadata` and `readOmissions`.
- Exact permission-string ownership and omission identities.
- Settings request field patching.
- Explicit metadata operations and path approvals.
- Prepared input bindings, draft review, manifest derivation and journal recovery.
- I2-1 through I2-10.
- Record-level extension preservation; unknown fields inside managed metadata remain invalid.

C3 supplies:

- `mergeManagedDenies`, unchanged.
- Deny ownership, deny omissions and `heldBack`.
- Projection checks limited to C3-owned settings/request fields.
- Migration staging before C6/C7.
- I3-1 through I3-6.
- Installed bytes as the candidate for an unchanged runtime operation.

C4 supplies complete-unit checks at prepare, both diff boundaries and commit. Any runtime
create/modify requires reviewed candidates for the complete catalog. Unchanged members require
declared, bound input roles. Unrelated settings-only work does not force a runtime upgrade.

C5 facts consumed by C7:

- `review-diff` is the seventh public Git-helper command.
- Its internal helper is a runtime member; C5 produces four members before C6.
- `review`, case variants and trailing-dot/space aliases are reserved setup IDs.
- `validateRunId` checks reservation before ordinary syntax.
- Existing merge behavior for reserved IDs remains unchanged.
- C5 changes apply startup handling and production fixture catalogs.
- C7 does not use review artifacts as staging space or alter their lifecycle.
- Frozen C5 acceptance is `18 PASS / 0 FAIL / 0 SKIP`.

C6 facts consumed by C7:

- The runtime catalog has seven members.
- Normal merge conditionally appends the managed hook after permissions composition.
- Hooks-only staging bases its work on an existing settings draft when present.
- Hook metadata requests patch only `managed.hooks`.
- Hook identity is event, matcher and command; options are not identity.
- Readiness requires reviewed entrypoint and core bytes; a present draft takes precedence.
- Installed readiness declares both hook files in `transaction-inputs.json`.
- Changed settings use installed indentation and EOL; equal values retain base bytes.
- The canonical-append exemption covers only the exact final canonical hook append.
- The exemption does not cover accompanying permission or metadata removal.
- With no other content reason, exempt ops contain `userContentChange:false` and
  `userContentReasons:[]`.
- Other hook changes keep their existing approval reasons.
- Hooks-only envelopes and reports remain unchanged.
- Frozen C6 acceptance is `12 PASS / 0 FAIL / 0 SKIP`.

The combined sequence is:

```text
C3 stage -> C6 hooks-only -> C7 retirement staging -> prepare -> diff -> commit
```

## 2. Files touched and public interfaces

Paths are relative to `project-setup/`. Existing ranges refer to `4b744ec`; named regions
remain authoritative when C5/C6 shift the lines.

### 2.1 Existing files

| File and baseline lines | Planned change |
| --- | --- |
| `scripts/detect.mjs:8-15` | Import classifier and checked-input helpers. |
| Same, `81-115` | Classify shared allows after validated manifest discovery. |
| Same, `247-255` | Reuse checked shared-settings reads for override discovery. |
| Same, `339-381` | Append diagnostics and `claude.allows`. |
| `scripts/merge-claude-settings.mjs:2-29` | Contract, usage and imports. |
| Same, `98-100` | Pure retirement export and private staging helpers. |
| Same, `100-214` | Refusal, reporting, staging and normal-merge order guard. |
| `scripts/apply.mjs:298-348` | Conditional C6-exemption integration adjustment. |
| Same, `913-978` | Conditional combined hook/allow op-reason adjustment. |
| `references/claude.md:24-54` | Classification, remedies and personal settings. |
| `references/state-and-apply.md:17-26` | Exact allow omissions. |
| Same, `51-72` | Retirement sequencing and approval. |
| Same, `151-158` | Metadata-only retirement and no-op reruns. |
| `tests/rc1-cases.mjs:8-14,34-152` | C7 descriptors and implementation registration. |
| `tests/run-tests.mjs:908-956` | Aggregate C7 under R29. |
| `tests/c3.test.mjs:334` | Extend exact merge exports. |
| Same, `1803-1843` | Replace the two legacy allow-addition CLI steps. |

The apply edit is conditional. If landed C6 already checks permission differences after
excluding its exact canonical append, C7 makes no production change to apply. C7's tests still
pin the combined behavior. No C6-frozen output changes.

C6 also changes merge, apply, `references/claude.md`, registration, R29 and C3's export assertion.
C7 builds on those edits.

C5 also changes apply startup handling, registration and runtime fixture staging. Preserve them.

After C6 lands, update its exact merge-export assertion, if present, to the three-export set
below. Any exact normal-merge report key-set assertion in C3/C6 gains `allows` after `hooks`.
Do not change pure `DenyReport`, pure hook reports or hooks-only report key sets.

Under open question 2, `scripts/validate.mjs:1-161` receives no C7 edit. C10 is its integration
owner. `SKILL.md:121-123` is likewise a named C8 dependency, not a C7 edit.

### 2.2 New files

```text
scripts/classify-allows.mjs
tests/fixtures/allow-cases.json
tests/c7.test.mjs
```

The tests lane owns every test and fixture edit. The implementer may not edit them.

### 2.3 Runtime membership

`classify-allows.mjs` is distribution-only setup code. Installed Git and hook tools do not
import it. It is not installed under `.ai/tools/`.

No `data/runtime-units.json` change. C6's ordered catalog remains:

```text
security-policy.mjs
git-safe-core.mjs
guard-raw-git-core.mjs
review-diff.mjs
git-safe.mjs
guard-raw-git.mjs
hooks-selftest.mjs
```

A combined runtime migration must satisfy the complete-unit rule for all seven.
An allow-only retirement introduces no runtime update requirement.

The coordinated release version/stamp remains C11b work.

### 2.4 Pure exports

`classify-allows.mjs` exports exactly:

```typescript
classifyAllow(
  rule: string,
  ownership: "managed" | "user"
): {
  rule: string;
  ownership: "managed" | "user";
  classification: "repo-code" | "broad" | "other";
  level: "warn" | "fail" | "none";
  detail: string | null;
};

inspectAllows(input: {
  settings: object;
  managed: object;
  omissions: object;
}): {
  rules: ReturnType<typeof classifyAllow>[];
  managed: Array<{
    rule: string;
    present: boolean;
    classification: "repo-code" | "broad" | "other";
    level: "warn" | "fail" | "none";
  }>;
  omitted: string[];
  results: Array<{
    level: "warn" | "fail" | "info";
    check: "allow-repo-code" | "allow-broad" | "allow-local";
    detail: string;
  }>;
};
```

`merge-claude-settings.mjs` exports exactly:

```typescript
mergeManagedDenies;
mergeManagedHooks;

retireManagedAllows(input: {
  settings: object;
  managed: object;
  omissions: object;
  retire: string[];
}): {
  settings: object;
  managed: object;
  omissions: object;
  report: {
    listed: ReturnType<typeof inspectAllows>["managed"];
    retired: string[];
    alreadyAbsent: string[];
    alreadyOmitted: string[];
    retained: string[];
  };
};
```

All are synchronous and input-preserving. Returns are detached, mutable JSON.
Importing defines exports only: no project reads, writes, output, CLI dispatch or child process.

There is no classifier CLI or additional public helper.

| Consumer | Contract |
| --- | --- |
| C8 | `claude.allows`, selection CLI, sequencing and approvals |
| C10 | `inspectAllows`, ordering, severities and exact messages |
| C11b | `C7_IMPLEMENTATIONS`, descriptors, fixture and source inventory |

## 3. Behavior

### 3.1 Validation, precedence and ownership

`classifyAllow` requires a string and one of the exact ownership strings. Invalid arguments
throw an Error with own code `ALLOW_INPUT` and message:

```text
ALLOW_INPUT: invalid allow classification input
```

For the object APIs, a plain object means a non-null, non-array object whose prototype is
`Object.prototype` or null.

`inspectAllows` requires exactly `settings`, `managed`, `omissions`.
`retireManagedAllows` requires exactly those keys plus `retire`.

Validation precedence is:

| Order | Condition | Error |
| --- | --- | --- |
| 1 | Outer input not plain; missing/unknown key; `retire` not an array | `ALLOW_INPUT` |
| 2 | Settings root not an object; bad permissions object or allow array | `ALLOW_SETTINGS` |
| 3 | Invalid managed metadata | C2 `readManagedMetadata` error |
| 4 | Invalid omission metadata | C2 `readOmissions` error |
| 5 | Non-string, duplicate or ineligible retirement selection | `ALLOW_SELECTION` |

Order 2 requires:

- Settings is a non-null, non-array object.
- Present `permissions` is a non-null, non-array object.
- Present `permissions.allow` is an array of strings.

Its exact error is:

```text
code: ALLOW_SETTINGS
message: ALLOW_SETTINGS: settings permissions.allow must be a string array
```

At orders 3 and 4 call the existing readers with target `.claude/settings.json`.
Do not preempt their shape errors with `ALLOW_INPUT`. Examples:

```text
OWNERSHIP_SHAPE: managed
OWNERSHIP_SHAPE: managed.permissions.allow
OWNERSHIP_FIELD: managed.extra
OMISSIONS_SHAPE: omissions
OMISSIONS_SHAPE: omissions.permissions.allow
OMISSIONS_DUPLICATE: omissions.permissions.allow[1]
```

Selection error:

```text
code: ALLOW_SELECTION
message: ALLOW_SELECTION: retire must contain unique recorded managed allows or allow omissions
```

C2 errors propagate with their original own `code` and full prefixed message.

Unknown managed fields are invalid. Record-level extensions, outside `managed` and `omissions`,
survive commit through C2.

No validation normalizes or repairs unrelated settings fields. Deny entries, hook options and
user configuration are not reclassified.

Ownership and omission identity use exact string equality. No trimming, case folding, wildcard
expansion or inference from familiar tool paths.

A shared rule is managed only when its exact string occurs in validated installed
`managed["permissions.allow"]`. A non-keys settings record supplies `{}` for managed metadata
and omissions.

Validate the complete installed manifest before consuming ownership. An invalid manifest is
never treated as absent.

An identity appearing in both managed allows and omissions is treated as managed. Inspection
reports both records; retirement removes its managed identity and preserves its existing
omission. There is no `ALLOW_STATE` error.

### 3.2 Classification algorithm

This is a lexical risk indicator, not shell execution analysis.

Recognized shell tool names are exactly `Bash` and `PowerShell`. Unrecognized permission syntax
is `other`.

1. Exact `*`, bare `Bash` and bare `PowerShell` are broad.
2. For `Bash(...)` or `PowerShell(...)`, inspect the enclosed command text.
3. Trim surrounding ASCII whitespace for matching only.
4. Convert a final legacy `:*` suffix to ` *` for matching only.
5. Tokenize on ASCII whitespace outside balanced single or double quotes.
6. Inside single quotes, double quotes are literal; inside double quotes, single quotes are
   literal. Do not expand escapes, variables or substitutions.
7. Remove one enclosing quote pair from each token. Preserve interior literal quotes.
8. If quotes are unbalanced, classify as `other`.
9. An executable token containing only one or more `*` characters is broad, regardless of
   following tokens. Thus `Bash(:*)`, `Bash(*)`, `Bash(**)` and `Bash(* git)` are broad.
10. Before taking a basename, test the dequoted executable token for a relative path containing
    `/` or `\`. Such a token is repository code.
11. Otherwise take its slash/backslash basename, lowercase it and remove one suffix among
    `.exe`, `.cmd`, `.bat`.
12. Apply the executable rules below. Everything else is `other`.

For step 10, tokens beginning with `/`, `\`, or an ASCII drive prefix are not relative.
A drive prefix is exactly one ASCII letter of either case followed by `:`, matching
`^[A-Za-z]:`.

`./x`, `../x`, `scripts/x`, `.\x` and `scripts\x` are relative.
A leading `~` or a `$VAR/` spelling is also treated as relative when the token contains a
separator: `~/bin/check` and `$TOOLS/check` are repository code. No expansion is attempted.

Repository-code executable rules:

- `yarn`, `pnpm`, `npx` or `make`, with or without arguments.
- `npm`, `node`, `pwsh` or `powershell` with arguments, except one single version/help flag.
- Exactly `npm*`, `node*`, `yarn*`, `pnpm*`, `npx*` or `make*`.
- `bash` or `sh` with arguments.

The excluded single flags, compared case-insensitively, are:

```text
-v --version -version -h --help -help -?
```

An excluded flag plus any additional argument is repository code.

`bash -c *` and `pwsh -Command *` are repository code, not broad: their executable token is
not an all-command wildcard.

Original rule strings are always returned and stored unchanged.

| Classification | Managed | User |
| --- | --- | --- |
| `repo-code` | `warn` | `warn` |
| `broad` | `fail` | `warn` |
| `other` | `none` | `none` |

Existing-rule severity is separate from new-proposal refusal.

### 3.3 Exact diagnostic strings

The notation below defines exact strings. `Q(rule)` is `JSON.stringify(rule)`.
`OWNER` is exactly `managed` or `user`. Concatenated fragments contain the displayed spaces.

```javascript
REPO(rule, OWNER) =
  "Shared " + OWNER + " allow " + Q(rule) +
  " runs repository code without a prompt; move it to " +
  ".claude/settings.local.json if you accept this risk on your own machine.";

BROAD(rule, OWNER) =
  "Shared " + OWNER + " allow " + Q(rule) +
  " permits arbitrary commands without a prompt; move it to " +
  ".claude/settings.local.json if you accept this risk on your own machine.";

LOCAL =
  ".claude/settings.local.json is personal and is not managed by project-setup; " +
  "permissions there do not protect the team.";
```

Embedded newlines and quotes in a rule are JSON-escaped. They do not create diagnostic lines.

`other` has `detail:null` and emits no classification row.

Results contain one row per risky shared occurrence, preserving order and duplicates:

- Repository code: `check:"allow-repo-code"`.
- Broad: `check:"allow-broad"`.
- Last, exactly `{level:"info",check:"allow-local",detail:LOCAL}`.

The personal-settings row exists even if the file is absent. C7 neither classifies its
permissions nor prints their contents.

### 3.4 Inspection and inventory

`inspectAllows` returns:

- `rules`: every shared allow occurrence, in settings order.
- `managed`: every installed managed metadata occurrence, in metadata order.
- `present`: exact membership in the shared allow array.
- Inventory classification and severity computed as managed, even when absent.
- `omitted`: exact installed allow omissions, or `[]`.
- `results`: active shared-rule findings followed by LOCAL.

Absent metadata entries generate no execution warning. A personal copy does not make a shared
entry present. Inspection neither restores missing rules nor infers omissions.

When the manifest is absent, use `managed:{}`, `omissions:{}`.
When shared settings are absent, use `settings:{}` for discovery.
When both are absent, inspection returns empty arrays and the LOCAL result.

### 3.5 Discovery and command output

All new JSON uses two spaces, one final LF and empty stderr.

Discovery appends `allows` last in `claude`, after `userInstructionFilesMode`.
Its key order is therefore the existing inventory keys, then `userInstructionFilesMode`,
then `allows`.

Append allow warn/fail details to top-level `warnings`, after existing warnings, preserving
result order. Include an `allow-input` failure there too. Do not append LOCAL to `warnings`.

Discovery remains an inventory command. It exits 0 even when an allow row has level fail.

For invalid allow inputs, `claude.allows` is exactly:

```javascript
{
  rules: null,
  managed: null,
  omitted: null,
  results: [
    {level:"fail",check:"allow-input",detail:ERROR},
    {level:"info",check:"allow-local",detail:LOCAL}
  ]
}
```

| Condition | Exact `ERROR` |
| --- | --- |
| Invalid manifest | `invalid .ai/manifest.json; allow ownership was not classified` |
| Invalid settings JSON | `invalid .claude/settings.json; shared allows were not classified` |
| Unsafe settings path | `unsafe .claude/settings.json; shared allows were not classified` |
| Protected settings | `.claude/settings.json is protected; shared allows were not classified` |
| Other settings read failure | `cannot read .claude/settings.json; shared allows were not classified` |
| Pure validation failure | Complete prefixed pure error message |

Invalid-manifest precedence wins. Otherwise check unsafe path, protection, read, parse and
shape in that order.

C3's malformed-policy behavior makes all paths protected. With a valid/absent manifest,
discovery therefore emits the protected-settings row and does not read settings, even if
the settings file would otherwise be absent.

Protected or unsafe shared settings are also skipped by `claudeOffOverrides`. This is an
intentional discovery behavior change: the override scan must not reopen a file classification
refused. Existing local/user override precedence otherwise remains unchanged.

| Command | C7 output | Exit |
| --- | --- | --- |
| Detect | `claude.allows`, appended warning details | 0 |
| Normal merge | `report.allows` | 0 on successful staging |
| Retirement merge | Section 3.8 envelope | 0 on successful staging |
| C6 hooks-only | No C7 additions | Frozen C6 behavior |
| Apply prepare/diff/commit | Existing transaction output, no warning banner | Existing exits |
| Validate after C10 | Inspection result rows | 1 with fail rows; otherwise 0 |

Messages are JSON values, not additional text outside the JSON document.
C10 must not duplicate LOCAL or emit a pass row for `other`.

### 3.6 Normal merge and managed-input refusal

Under open question 1's recommended behavior:

- No `--allow-file`: no proposal and no allow-ownership rewrite.
- Valid `[]`: the same behavior; do not request `permissions.allow:[]`.
- Nonempty array: refuse before writing any draft or request.
- Broad entries win over repository-code entries, which win over other entries.
- Name the first input occurrence in the winning category.
- Existing shared allows are reported, not rejected as new input.

| Code | Exact error |
| --- | --- |
| `ALLOW_BROAD` | `refusing managed broad allow Q(rule); move it to .claude/settings.local.json if you accept this risk on your own machine` |
| `ALLOW_REPO_CODE` | `refusing managed repository-code allow Q(rule); move it to .claude/settings.local.json if you accept this risk on your own machine` |
| `ALLOW_NEW` | `nonempty --allow-file is not supported in v3: Q(rule)` |

These use the C7 error envelope in section 3.9, exit 3. The `ALLOW_NEW` wording applies equally
when the supplied `other` rule is already managed.

For this legacy option, resolve a relative argument from process cwd. Retain existing
protected-input and link checks before reading.

Canonicalize both the existing input file and project root with `fs.realpathSync.native`
before containment testing. Compute `path.relative(canonicalRoot, canonicalFile)`.
A path is outside when that relative result is `..`, begins with `..` plus the platform
separator, or is absolute.

For a new refusal:

- Inside target: the relative path from those canonical forms, with `\` replaced by `/`.
- Outside target: the canonical absolute file path, with `\` replaced by `/`.

Do not use `path.resolve` alone to choose the reported spelling. Windows 8.3 and long-name
spellings must produce the same containment result and target. Tests compute expected targets
with `fs.realpathSync.native` on both paths and the same containment definition.

Do not impose retirement mode's inside-project restriction on this legacy input.
Canonicalization does not authorize links or junctions that the existing safety checks reject.

Existing legacy parse/type failures remain:

```text
Invalid JSON:
exit 3
{ok:false,error:"--allow-file is not valid JSON (content not shown)"}

Wrong array/element type:
exit 1
{ok:false,error:"--allow-file must contain a JSON array of rule strings"}
```

Normal merge's legacy fields become:

```javascript
report.added.allow = [];
report.alreadyPresent = denyReport.alreadyPresent;
```

No allow rule is added to either field.

After deny merging and C6 hook composition, set:

```javascript
report.allows = inspectAllows({
  settings: out,
  managed: installedKeysRecord?.managed ?? {},
  omissions: installedKeysRecord?.omissions ?? {}
});
```

Ignore staged ownership and omission requests for this report. Place `allows` last, after
C6's `hooks`.

Normal report keys, in order:

```text
added alreadyPresent conflicts ineffective malformedHooks info heldBack
alreadyCovered retainedManagedDenies ownershipDropped hooks allows
```

The existing manifest validation and `mergeManagedDenies` validation precede inspection.
Consequently a non-string allow array gives legacy `DENY_SETTINGS`, before any write:

```text
exit 3
{ok:false,error:"DENY_SETTINGS: settings permissions must contain string arrays"}
```

Invalid installed manifest retains:

```text
exit 3
{ok:false,error:"MANIFEST_INVALID: invalid manifest"}
```

Valid outputs of those checks cannot cause an allow-input error during inspection. If a coded
pure inspection error nevertheless propagates, use the same legacy
`{ok:false,error:e.message}` envelope, exit 3, before any write. Do not add a second manifest
validator or a fatal overlap state.

Normal merge order guard:

- After existing root/run/policy checks, safely read a present `omissions.json`.
- Validate its request structure and typed omissions.
- If its settings omission object owns `permissions.allow`, even `[]`, refuse normal merge.
- Perform this guard before allow-file parsing, deny/hook merging or any staging write.
- A deny-only omission request does not trigger it.
- Hooks-only is unaffected.

Exact refusal:

```javascript
{
  ok: false,
  code: "ALLOW_STAGE_ORDER",
  error:
    "normal merge cannot follow allow retirement staging; start a new run and " +
    "stage denies and hooks before retiring allows",
  target: ".ai/.run/<id>/omissions.json"
}
```

Exit 3. Invalid JSON/metadata or unsafe reads in this guard use section 3.9.
It prevents normal merge from restoring installed allow bytes while retaining pending
retirement metadata.

### 3.7 Pure retirement

Selections must be unique exact strings naming installed managed allows or installed allow
omissions. Validate against installed ownership, never staged ownership.

For each selected managed identity:

1. Remove all identical shared allow occurrences.
2. Remove all identical managed allow occurrences.
3. Append one omission if absent.
4. Report once in `retired` if present, otherwise `alreadyAbsent`.

Use first-occurrence installed managed order for report identities and newly appended omissions.
Selection order does not reorder the result.

Managed ownership takes precedence over an overlapping omission. Retirement converges by
removing managed ownership and preserving the existing omission.

For selected omission-only identities:

- Report once in `alreadyOmitted`, in installed omission order.
- Preserve a currently present rule. It may have been re-added by the user after retirement.

`listed` is installed managed metadata inspected against the supplied settings base before
retirement. `retained` is the resulting managed allow array, including unselected duplicates.

Preserve all unselected/user strings, relative order, existing omission order and unrelated
settings/metadata fields. Keep an existing empty allow array. Do not create an absent allow key
for metadata-only work.

No deny string, deny ownership, deny omission, `heldBack` or hook field is changed.

### 3.8 Retirement staging

New mode:

```text
node <SKILL_DIR>/scripts/merge-claude-settings.mjs --run-id <id> --retire-allow-file <path>
```

Accept only these two options, once each. Reject positional arguments, missing values, unknown
options and combinations with normal/hook-only options.

Resolve a relative selection argument from process cwd. Before containment testing,
canonicalize both the existing selection file and project root with `fs.realpathSync.native`.
Use the containment definition and canonical project-relative POSIX spelling in section 3.6.

Require the selection to be:

- Inside the canonical project root.
- Outside every `.ai/.run/<run>/drafts/` subtree.
- Outside every `.ai/.run/<run>/vault/` subtree, including `vault/files/`.
- Safe under containment, link/junction and protected-path checks.

Check exclusions against the canonical project-relative path. Canonicalization does not bypass
link/junction checks on the supplied path chain.

Recommended location:

```text
.ai/.run/<id>/retire-allows.json
```

The selection file is data, not a draft, vault input or approval.

Before writes:

1. Validate arguments and run ID; preserve C5 reserved-ID behavior.
2. Establish safe root and existing run.
3. Load the shipped-plus-installed refusal set.
4. Read/validate installed manifest, then installed settings, then any settings draft.
5. Read/validate ownership, managed-key and omission requests.
6. Read/parse the selection file.
7. Run pure retirement using installed allow metadata and omissions.
8. Check valid staged allow fields for conflicts with the computed result.
9. Check all output paths, then write changed staging files in the order below.

Every input's path/protection check precedes its body read. Check logical targets and actual
run-local read paths, including native realpath spelling.

Use a settings draft when present, otherwise installed settings. If both are absent, use:

```json
{"$schema":"https://json.schemastore.org/claude-code-settings.json"}
```

Installed manifest ownership is the authority for eligible identities.
A staged managed request cannot authorize retirement of a user rule.

For each staged allow metadata/omission field:

- Absent field: never a conflict.
- Present field equal to its installed value: accepted.
- Present field equal to this invocation's resulting value: accepted.
- Any third value: `ALLOW_STAGE_CONFLICT`.

Compare array values and order exactly. An absent installed field is distinct from `[]`.

Validate selection eligibility before these value-conflict checks. Thus a structurally valid
forged managed request plus an ineligible selection fails `ALLOW_SELECTION`, not conflict.

A conflicting ownership request, such as `"full"`, is `ALLOW_STAGE_METADATA` during request
validation, before selection validation.

Changing a pending retirement result in the same run conflicts. Start a new run to amend it;
do not erase or overwrite the prior pending request. Reordering a selection that produces the
same result is not an amendment.

Patch only:

```text
ownership.json[".claude/settings.json"]
managed-keys.json[".claude/settings.json"]["permissions.allow"]
omissions.json[".claude/settings.json"]["permissions.allow"]
```

Ownership is `"keys"`. Preserve all other fields and targets, including C3/C6 requests,
transaction inputs and decisions.

Create these requests only for real retirement metadata changes. `[]` or an already-omitted
selection creates no empty request files.

Settings serialization follows C6:

- Equal values retain base bytes and do not rewrite the draft.
- Changed values use installed indentation and EOL, or two spaces/LF without installed style.
- Changed output has no BOM and exactly one final newline.
- Preserve values and object/array order; rewritten JSON whitespace/escape spelling may change.

Changed requests use two-space JSON and LF. Equal request values retain original bytes.

Write changed files in this exact order, skipping unchanged files:

```text
1. drafts/.claude/settings.json
2. ownership.json
3. managed-keys.json
4. omissions.json
```

All are beneath the selected run. Each uses existing safe atomic file writing. A failure stops
the sequence immediately; do not attempt later writes or undo completed run-local writes.

Success envelope, in order:

```typescript
{
  ok: true;
  changed: boolean;
  metadataChanged: boolean;
  needsDecision: false;
  draft: string | null;
  report: {
    allows: ReturnType<typeof inspectAllows>;
    retirement: ReturnType<typeof retireManagedAllows>["report"];
  };
}
```

`report.allows` uses resulting settings and resulting installed-derived metadata/omissions.
`report.retirement.listed` retains the pre-retirement inventory against the selected base.

`changed` means this invocation wrote settings draft bytes.
`metadataChanged` means this invocation changed a request file.
`draft` names the existing resulting draft, including an unchanged preexisting draft.

`needsDecision:false` means selection is complete. It grants no project-write approval.

A same-run repeat of `[A]` reads the already-retired settings draft but the original installed
ownership: A is now listed absent, `retired:[]`, `alreadyAbsent:[A]`. Section 4 pins its complete
envelope.

### 3.9 Errors and streams

New C7 CLI failures use this key order:

```typescript
{ok:false,code:string,error:string,target:string|null}
```

Two-space JSON, final LF, stdout only, empty stderr.

| Code | Exit | Exact error |
| --- | --- | --- |
| `ALLOW_STAGE_USAGE` | 1 | `usage: merge-claude-settings.mjs --run-id <id> --retire-allow-file <path>` |
| `ALLOW_STAGE_JSON` | 3 | `invalid allow staging JSON: <path>` |
| `ALLOW_STAGE_METADATA` | 3 | `invalid allow staging metadata: <path>` |
| `ALLOW_STAGE_MANIFEST` | 3 | `invalid allow staging manifest: .ai/manifest.json` |
| `ALLOW_STAGE_CONFLICT` | 3 | `conflicting allow staging request: <path>` |
| `ALLOW_STAGE_PATH` | 2 | `unsafe allow staging path: <path>` |
| `ALLOW_STAGE_PROTECTED` | 3 | `allow staging input is protected: <path>` |
| `ALLOW_STAGE_IO` | 2 | `cannot read allow staging input: <path>` |
| `ALLOW_STAGE_WRITE` | 2 | `cannot write allow staging output: <path>` |

Usage has `target:null`. Otherwise target is the path named in the error, with these exceptions:

```text
Selection outside project:
code ALLOW_STAGE_PATH, exit 2, target null
error "allow selection file must be inside the project"

Selection inside a setup drafts or vault subtree:
code ALLOW_STAGE_PATH, exit 2, target <canonical project-relative selection path>
error "allow selection file must be outside setup draft and vault directories"
```

Other staging paths are project-relative POSIX. Section 3.6 defines the legacy allow-file
outside-project target separately.

Invalid manifest JSON/schema/metadata maps to `ALLOW_STAGE_MANIFEST`.
Invalid JSON in settings, draft, selection or requests maps to `ALLOW_STAGE_JSON`.
Invalid request shape, typed metadata or ownership maps to `ALLOW_STAGE_METADATA`.

Pure allow failures retain their code and complete prefixed message, exit 3:

- Selection failure: target is selection file.
- Wrong selection container (`ALLOW_INPUT`): target is selection file.
- Settings failure: target is selected settings base.

No native parser message or file body is included.

Existing root, initialization, run-ID and policy-reader errors retain their contracts.
The normal-order guard and proposal refusals use their exact section-3.6 contracts.

Argument errors precede reads. Request schema errors precede selection checks. Selection
eligibility precedes staged value conflicts. All input failures precede writes.

A write failure may leave run-local staging partial in section-3.8 order; installed settings
and manifest remain unchanged. Rerun staging before prepare.

### 3.10 Approvals and transactions

Use existing C2 formats and one approval path:

```text
--approve-user-content .claude/settings.json
```

For present-rule retirement:

```javascript
userContentChange: true
userContentReasons: [
  "draft removes or reorders existing permissions.allow entries"
]
```

File metadata reasons, in order:

```javascript
[
  "settings ownership or managed metadata changes",
  "approved omission records change"
]
```

Without approval, prepare exits 3 with:

```javascript
{
  ok: false,
  code: "APPLY_PLAN_REJECTED",
  error: "plan rejected",
  errors: [{
    target: ".claude/settings.json",
    code: "APPLY_APPROVAL_REQUIRED",
    error:
      "draft removes or reorders existing permissions.allow entries; " +
      "settings ownership or managed metadata changes; " +
      "approved omission records change. Show the diff; re-run prepare with " +
      "--approve-user-content .claude/settings.json only after the user approves it"
  }]
}
```

Already-absent retirement has no settings content operation unless another component staged one.
Its metadata-only rejection uses the same P envelope with this exact sole entry:

```javascript
{
  target: ".claude/settings.json",
  code: "APPLY_APPROVAL_REQUIRED",
  error: "metadata changes require --approve-user-content .claude/settings.json"
}
```

An unsuccessful prepare changes no installed bytes.

No-op work needs no settings approval. An unrelated approval gives the existing
`APPLY_APPROVAL_UNRELATED` entry:

```text
--approve-user-content names files that do not need it; refusing broad approvals
```

Approved commit writes settings and manifest in one journal, manifest last.
Metadata-only commit writes only the manifest.
Schema-2 conversion adds C2's manifest metadata operation.

C6 integration:

- Apply its exact canonical-append exemption only after its existing readiness checks.
- Continue evaluating permissions after excluding only that exempt hook difference.
- Canonical append plus allow removal has the allow-removal reason above.
- Canonical append alone remains `false` and `[]`.
- Noncanonical hook changes retain C6's existing hooks reason.
- Already-absent retirement still requires metadata approval despite an exempt hook append,
  with the literal metadata-only P entry above.

No new apply classifier gate, plan format or approval mechanism.

### 3.11 Reference text

Add the following paragraphs to `references/claude.md`:

> Shared allow rules can run repository code without another prompt. Project-setup classifies
> package runners, interpreters and local executable paths as repository-code execution. These
> rules produce warnings whether managed or user-owned. Broad shell allows fail classification
> when managed and warn when user-owned. Other rules produce no classification finding; that is
> not a safety certification.
>
> If a developer accepts a warned permission on their own machine, move it to
> `.claude/settings.local.json`. That file is personal and is not managed by project-setup.
> Its permissions do not protect the team. The classifier is a lexical warning mechanism, not
> a sandbox.
>
> Project-setup MUST NOT add managed allows through the v3 merge workflow. Existing managed
> allows MUST remain unchanged unless selected for retirement and approved through apply.

The last paragraph follows open question 1's recommended option.

Add to `references/state-and-apply.md`:

> Allow omissions identify exact permission strings. They are separate from managed ownership.
> Retiring an allow removes only its selected managed identity and records its omission in the
> same reviewed transaction. An already-absent allow uses an explicit metadata operation and
> still requires approval for `.claude/settings.json`. Unselected and user-owned rules remain.
>
> Stage policy and deny changes first, hooks second, and allow retirement last. Use
> `merge-claude-settings.mjs --run-id <id> --retire-allow-file <path>` with a selection file inside
> the project and outside setup draft and vault directories. Normal merge refuses a pending
> allow-omission request. Start a new run to amend a pending retirement selection.
>
> Staging is not approval. Review both content and metadata with apply diff, prepare with the
> required path approvals, and approve the resulting plan hash. Metadata-only retirement leaves
> settings bytes unchanged. Rollback restores ownership and omissions through the same journal,
> subject to protection for later edits. An already-omitted identity is not restored on rerun.

Preserve C2's existing draft-review and zero-diff paragraphs verbatim.

Reference assertions are exact whitespace-normalized substring checks. For each quoted
paragraph above, remove the leading `> ` from its lines, collapse each whitespace run to one
ASCII space and trim. Apply the same whitespace normalization to the named reference file.
The normalized paragraph, including inline Markdown punctuation, must occur as a substring.
Do not use keyword-only assertions.

## 4. Tests and registration

### 4.1 Descriptors

Register these independently in `COMPONENT_ASSERTIONS.C7` and
`COMPONENT_IMPLEMENTATIONS.C7`, in order:

| ID | Name |
| --- | --- |
| `R53/C7/classifier` | `shared allows receive exact classes and severities` |
| `R53/C7/ownership` | `validated exact ownership controls classification` |
| `R53/C7/discovery` | `discovery reports shared rules and personal settings guidance` |
| `R54/C7/refusal` | `merge refuses new managed execution permissions` |
| `R85/C7/inventory` | `every installed managed allow is listed` |
| `R85/C7/retirement` | `retirement removes only selected managed identities` |
| `R85/C7/staging` | `allow staging preserves deny and hook projections` |
| `R85/C7/preservation` | `unselected rules and unchanged bytes survive` |
| `R85/C7/transaction` | `approved retirement commits content and omissions together` |
| `R86/C7/reconciliation` | `absent allows reconcile through metadata operations` |
| `R86/C7/binding-rollback` | `retirement bindings and rollback preserve reviewed state` |
| `V2/C7/contracts` | `C7 exports errors and component contracts are exact` |

`tests/c7.test.mjs` exports exactly `C7_IMPLEMENTATIONS`.
Assertions return `{failures:[],skipped:null}` on success.
Missing modules, exports or fixtures fail; imports run no tests or writes.

Do not register complete R53/R54/R85/R86 numbered cases.

### 4.2 Classifier corpus

`tests/fixtures/allow-cases.json`:

```typescript
{
  schema: 1;
  cases: Array<{
    id: string;
    rule: string;
    classification: "repo-code" | "broad" | "other";
  }>;
}
```

Use the following explicit IDs. Run each in process with both ownership values, asserting the
complete return object using section 3's literal severity/message formulas.

| ID | Rule | Class |
| --- | --- | --- |
| A01 | `*` | broad |
| A02 | `Bash` | broad |
| A03 | `PowerShell` | broad |
| A04 | `Bash(*)` | broad |
| A05 | `PowerShell(*)` | broad |
| A06 | `Bash( ** )` | broad |
| A07 | `Bash(:*)` | broad |
| A08 | `Bash(* git)` | broad |
| A09 | `Bash(npm run *)` | repo-code |
| A10 | `Bash(npm test*)` | repo-code |
| A11 | `Bash(npm start*)` | repo-code |
| A12 | `Bash(npm:*)` | repo-code |
| A13 | `Bash(npm*)` | repo-code |
| A14 | `Bash(npm install)` | repo-code |
| A15 | `Bash(npm i)` | repo-code |
| A16 | `Bash(npm t)` | repo-code |
| A17 | `Bash(npm x)` | repo-code |
| A18 | `Bash(npm run-script check)` | repo-code |
| A19 | `Bash(npm restart)` | repo-code |
| A20 | `Bash(npm stop)` | repo-code |
| A21 | `Bash(npm rebuild)` | repo-code |
| A22 | `Bash(npm pack)` | repo-code |
| A23 | `Bash(npm publish)` | repo-code |
| A24 | `Bash(npm --prefix . run test)` | repo-code |
| A25 | `Bash(yarn *)` | repo-code |
| A26 | `Bash(pnpm *)` | repo-code |
| A27 | `Bash(npx eslint *)` | repo-code |
| A28 | `Bash(node .ai/tools/*)` | repo-code |
| A29 | `Bash(node .ai/tools/git-safe.mjs *)` | repo-code |
| A30 | `Bash(node:*)` | repo-code |
| A31 | `Bash(node --test)` | repo-code |
| A32 | `Bash(node -e "require('./task')")` | repo-code |
| A33 | `Bash("./scripts/check.sh" *)` | repo-code |
| A34 | `PowerShell(.\scripts\check.ps1 *)` | repo-code |
| A35 | `Bash(../scripts/check *)` | repo-code |
| A36 | `Bash(scripts/check.sh)` | repo-code |
| A37 | `Bash(node_modules/.bin/jest *)` | repo-code |
| A38 | `PowerShell(scripts\check.cmd)` | repo-code |
| A39 | `Bash(make *)` | repo-code |
| A40 | `Bash(make)` | repo-code |
| A41 | `Bash(bash scripts/check.sh)` | repo-code |
| A42 | `Bash(sh scripts/check.sh)` | repo-code |
| A43 | `Bash(bash -c *)` | repo-code |
| A44 | `Bash(pwsh -File *)` | repo-code |
| A45 | `Bash(pwsh x.ps1)` | repo-code |
| A46 | `PowerShell(powershell x.ps1)` | repo-code |
| A47 | `PowerShell(pwsh -Command *)` | repo-code |
| A48 | `Bash(NPM.CMD run test)` | repo-code |
| A49 | `Bash("/usr/bin/node" "scripts/check.mjs")` | repo-code |
| A50 | `Bash(git status)` | other |
| A51 | `Bash(git status:*)` | other |
| A52 | `Bash(gh pr view *)` | other |
| A53 | `Bash(node --version)` | other |
| A54 | `Bash(npm --version)` | other |
| A55 | `Bash(pwsh -Version)` | other |
| A56 | `Read(**)` | other |
| A57 | `Write` | other |
| A58 | `Bash()` | other |
| A59 | `bash(*)` | other |
| A60 | `Bash("unterminated)` | other |
| A61 | `Bash("./scripts/it's-ok.sh" *)` | repo-code |
| A62 | `Bash('scripts/"quoted".cmd' *)` | repo-code |
| A63 | `PowerShell(C:\tools\check.cmd)` | other |
| A64 | `Bash(pwsh --help)` | other |
| A65 | `Bash(*:*)` | broad |
| A66 | `Bash(node)` | other |
| A67 | `Bash(npm)` | other |
| A68 | `Bash(bash)` | other |
| A69 | `Bash(eslint *)` | other |
| A70 | `Bash(git commit *)` | other |
| A71 | `Bash(ts-node *)` | other |
| A72 | `Bash(~/bin/check)` | repo-code |
| A73 | `Bash($TOOLS/check)` | repo-code |
| A74 | `PowerShell(c:\tools\check.cmd)` | other |

JSON escapes backslashes and quotes. Add in-process validation/precedence, duplicate occurrence,
detachment and diagnostic-escaping cases. None launches a process.

### 4.3 Canonical data and synthetic manifest

Notation is test specification, not production calls:

```javascript
A = "Bash(npm test)";
B = "Bash(node .ai/tools/git-safe.mjs *)";
C = "Bash(git status)";
U = "Bash(npm run lint)";
D = "Read(**/.env.*)";
G = "Bash(*)";
J(v) = JSON.stringify(v, null, 2) + "\n";
```

Exact S and M:

```javascript
S = {
  permissions: {
    allow: [U,A,C,B],
    deny: [D],
    ask: ["Bash(git push *)"]
  },
  env: {FIXTURE_FLAG:"public-fixture-value"}
};

M = {
  "permissions.allow": [A,C,B],
  "permissions.deny": [D],
  heldBack: []
};
```

Exact synthetic manifest F, serialized with J:

```javascript
F = {
  schema: 3,
  skill: "project-setup",
  skillVersion: "2.0.0",
  mode: "update",
  agents: ["claude","codex"],
  sourceCommit: null,
  files: {
    ".claude/settings.json": {
      ownership: "keys",
      managed: M
    }
  }
};
```

No omission field, integrity field or other field is implied.

Define expected-value constructors in tests independently of production:

```javascript
RM(r) = {
  rule:r, ownership:"managed", classification:"repo-code",
  level:"warn", detail:REPO(r,"managed")
};
RU(r) = {
  rule:r, ownership:"user", classification:"repo-code",
  level:"warn", detail:REPO(r,"user")
};
OM(r) = {
  rule:r, ownership:"managed", classification:"other",
  level:"none", detail:null
};
OU(r) = {
  rule:r, ownership:"user", classification:"other",
  level:"none", detail:null
};
I(r,p,c,l) = {rule:r,present:p,classification:c,level:l};
WR(d) = {level:"warn",check:"allow-repo-code",detail:d};
LI = {level:"info",check:"allow-local",detail:LOCAL};
```

REPO, BROAD and LOCAL are the exact section-3.3 strings. These constructors abbreviate literal
expected objects; they must not call production exports.

Name the complete expected inspection of S/M with omissions `{}` as P0:

```javascript
P0 = {
  rules: [RU(U),RM(A),OM(C),RM(B)],
  managed: [
    I(A,true,"repo-code","warn"),
    I(C,true,"other","none"),
    I(B,true,"repo-code","warn")
  ],
  omitted: [],
  results: [
    WR(REPO(U,"user")),
    WR(REPO(A,"managed")),
    WR(REPO(B,"managed")),
    LI
  ]
};
```

### 4.4 Discovery fixtures and ownership

D1 uses F/M and S with allow array `[U,A,C,G]`: B is absent and G is user-owned.

Exact `claude.allows`:

```javascript
{
  rules: [
    RU(U),
    RM(A),
    OM(C),
    {
      rule:G,ownership:"user",classification:"broad",
      level:"warn",detail:BROAD(G,"user")
    }
  ],
  managed: [
    I(A,true,"repo-code","warn"),
    I(C,true,"other","none"),
    I(B,false,"repo-code","warn")
  ],
  omitted: [],
  results: [
    WR(REPO(U,"user")),
    WR(REPO(A,"managed")),
    {level:"warn",check:"allow-broad",detail:BROAD(G,"user")},
    LI
  ]
}
```

Exact allow contribution to `warnings`:

```javascript
[REPO(U,"user"),REPO(A,"managed"),BROAD(G,"user")]
```

D2 uses settings `{permissions:{allow:[G]}}` and F with its managed value replaced by
`{"permissions.allow":[G]}`.

```javascript
{
  rules: [{
    rule:G,ownership:"managed",classification:"broad",
    level:"fail",detail:BROAD(G,"managed")
  }],
  managed: [I(G,true,"broad","fail")],
  omitted: [],
  results: [
    {level:"fail",check:"allow-broad",detail:BROAD(G,"managed")},
    LI
  ]
}
```

Warnings are `[BROAD(G,"managed")]`. Detect still exits 0.

D3 uses S and no manifest. Name this expected object D3Report:

```javascript
D3Report = {
  rules: [RU(U),RU(A),OU(C),RU(B)],
  managed: [],
  omitted: [],
  results: [
    WR(REPO(U,"user")),
    WR(REPO(A,"user")),
    WR(REPO(B,"user")),
    LI
  ]
};
```

Warnings are `[REPO(U,"user"),REPO(A,"user"),REPO(B,"user")]`.

D4 uses F/M and no settings file:

```javascript
{
  rules: [],
  managed: [
    I(A,false,"repo-code","warn"),
    I(C,false,"other","none"),
    I(B,false,"repo-code","warn")
  ],
  omitted: [],
  results: [LI]
}
```

Allow warnings are `[]`.

For these four process fixtures, commit all fixture files before detect, use isolated homes,
no setup lock, no env templates, no tracked secret-shaped files and no skill-install conflicts.
Then the complete top-level warnings array equals the array above. All exit 0, empty stderr.

Additional ownership cases under `R53/C7/ownership`:

1. Settings allow `[A]`, managed allow `["Bash(NPM test)"]`:
   rules `[RU(A)]`; inventory contains the uppercase rule with `present:false`,
   classification repo-code, level warn; results `[WR(REPO(A,"user")),LI]`.
   Omitted is `[]`.
2. S plus F with only `schema` changed to 2: `claude.allows` equals P0 exactly.
   Existing manifest discovery reports `needs update`.
3. S plus F with its settings record replaced by `{ownership:"merged"}`:
   `claude.allows` equals D3Report exactly.
4. Malformed manifest bytes `"{\n"`: exact section-3.5 failure report. In the clean fixture,
   warnings are exactly:

```javascript
[
  "invalid .ai/manifest.json; repair or restore it before setup",
  "invalid .ai/manifest.json; allow ownership was not classified"
]
```

5. Settings `{permissions:{deny:[G,A]}}`, managed
   `{"permissions.deny":[G,A]}`, omissions `{}`:
   `{rules:[],managed:[],omitted:[],results:[LI]}`.
   No allow warning, failure or deny reclassification.
6. S plus F with its settings record extended by
   `omissions:{"permissions.allow":[A]}`. Exact `claude.allows`:

```javascript
{
  rules: [RU(U),RM(A),OM(C),RM(B)],
  managed: [
    I(A,true,"repo-code","warn"),
    I(C,true,"other","none"),
    I(B,true,"repo-code","warn")
  ],
  omitted: [A],
  results: [
    WR(REPO(U,"user")),
    WR(REPO(A,"managed")),
    WR(REPO(B,"managed")),
    LI
  ]
}
```

Discovery failure tests cover invalid settings JSON, malformed policy, protected settings,
unsafe shared-settings junction and read failure. Assert the exact section-3.5 failure report,
its appended warning and zero reads of refused shared settings, including override discovery.

Local settings may contain fixture permissions; none appear in the allow report. Existing
`skillOverrides` discovery continues independently.

### 4.5 Inventory and pure retirement

`R85/C7/inventory` starts from a genuine C11a v2 installation with managed allows `[A,C,B]`.
Only after installation, make controlled changes:

```javascript
settings.permissions.allow = [U,A,C,A];
managed["permissions.allow"] = [A,C,B,A];
```

Read the inventory through detect's `claude.allows.managed`.
Its exact value is:

```javascript
[
  I(A,true,"repo-code","warn"),
  I(C,true,"other","none"),
  I(B,false,"repo-code","warn"),
  I(A,true,"repo-code","warn")
]
```

Assert detect's `claude.allows.rules` is `[RU(U),RM(A),OM(C),RM(A)]`.
Assert its `claude.allows.results` is:

```javascript
[
  WR(REPO(U,"user")),
  WR(REPO(A,"managed")),
  WR(REPO(A,"managed")),
  LI
]
```

Then stage selection `[]`. Assert the staging response's `report.retirement` is exactly:

```javascript
{
  listed: [
    I(A,true,"repo-code","warn"),
    I(C,true,"other","none"),
    I(B,false,"repo-code","warn"),
    I(A,true,"repo-code","warn")
  ],
  retired: [],
  alreadyAbsent: [],
  alreadyOmitted: [],
  retained: [A,C,B,A]
}
```

Canonical pure cases use S/M and omissions `{}`:

| Selection | Settings allow | Managed allow | Allow omissions |
| --- | --- | --- | --- |
| `[]` | `[U,A,C,B]` | `[A,C,B]` | absent |
| `[A]` | `[U,C,B]` | `[C,B]` | `[A]` |
| `[B,A]` | `[U,C]` | `[C]` | `[A,B]` |
| `[C]` | `[U,A,B]` | `[A,B]` | `[C]` |
| `[U]` | `ALLOW_SELECTION` | unchanged | unchanged |

For `[A]`, exact report:

```javascript
{
  listed: [
    I(A,true,"repo-code","warn"),
    I(C,true,"other","none"),
    I(B,true,"repo-code","warn")
  ],
  retired: [A],
  alreadyAbsent: [],
  alreadyOmitted: [],
  retained: [C,B]
}
```

Also assert:

- A absent initially: `retired:[]`, `alreadyAbsent:[A]`.
- After committed retirement, select A: `alreadyOmitted:[A]`, no changes.
- Re-add A after committed retirement: preserve it as user-owned.
- Duplicate managed/settings A: remove all selected A occurrences; one report identity/omission.
- `[A,A]`, `[7]`, `[U]` and case-changed unrecorded selection: `ALLOW_SELECTION`.
- `retire:{}`: `ALLOW_INPUT`, even with malformed settings.
- Non-object settings: `ALLOW_SETTINGS`.
- Non-object managed/omissions: respective C2 shape error.
- Unknown `managed.extra`: `OWNERSHIP_FIELD: managed.extra`.
- Existing managed/omitted overlap A: retire A, retain the one existing omission.
- Absent allow key plus recorded A: metadata-only; do not create the allow key.
- Existing empty arrays and C2-permitted fields survive.
- Denies, deny omissions and `heldBack` are unchanged.

For record-level extension preservation, start S/F with F's settings record extended by
`fixtureNote:"keep"`. Run the approved `[A]` transaction. The complete resulting settings
record is exactly:

```javascript
{
  fixtureNote: "keep",
  ownership: "keys",
  managed: {
    "permissions.allow": [C,B],
    "permissions.deny": [D],
    heldBack: []
  },
  omissions: {
    "permissions.allow": [A]
  }
}
```

This is a commit assertion, not permission for unknown fields inside managed metadata.

### 4.6 Refusal and normal report cases

`R54/C7/refusal` asserts exact section-3.6 envelopes, exit 3, empty stderr and unchanged
draft/request state:

```text
["Bash(*)"]                    -> ALLOW_BROAD
["Bash(node .ai/tools/*)"]      -> ALLOW_REPO_CODE
["Bash(git status)"]           -> ALLOW_NEW, open question 1
["Bash(node x.mjs)","Bash(*)"]  -> ALLOW_BROAD
```

Repeat the `other` case with C already installed as managed. It receives the same
`ALLOW_NEW` message, which does not incorrectly call the rule new.

Test an inside-project file and an outside-project safe file. Compute expected targets using
`fs.realpathSync.native` on both file and project root, then section 3.6's containment rule.
Assert canonical relative POSIX and canonical absolute POSIX targets respectively.
Resolve a relative input from a subdirectory cwd. Do not accept either short or long spelling:
the canonical spelling is the sole expected value.

An empty allow file and no allow file both succeed without requesting a new allow field.
An already staged allow field survives either invocation.

Normal report fixture:

- Installed S/F.
- Seed a structurally valid staged managed allow field `[U]`, with no staged allow omission.
- Run normal merge.
- `report.allows` equals P0 exactly:

```javascript
{
  rules: [RU(U),RM(A),OM(C),RM(B)],
  managed: [
    I(A,true,"repo-code","warn"),
    I(C,true,"other","none"),
    I(B,true,"repo-code","warn")
  ],
  omitted: [],
  results: [
    WR(REPO(U,"user")),
    WR(REPO(A,"managed")),
    WR(REPO(B,"managed")),
    LI
  ]
}
```

The report uses resulting settings `out`; staged ownership does not affect classification.
Assert `allows` is last after `hooks`, `added.allow:[]`, and `alreadyPresent` contains deny
results only.

Malformed allow arrays preserve legacy `DENY_SETTINGS` envelope/exit.

Normal-order guard test:

1. Stage `[A]`.
2. Snapshot all run files.
3. Run normal merge with no allow file.
4. Expect exact `ALLOW_STAGE_ORDER` envelope, exit 3.
5. Assert all run and project bytes unchanged.
6. Repeat with an explicit empty staged allow-omission request; same refusal.
7. Deny-only omission request does not refuse.

### 4.7 Staging bytes, repeats and forged input

Use S/F from section 4.3. Run ID is `run-c7-0001`; selection path is:

```text
.ai/.run/run-c7-0001/retire-allows.json
```

First stage `[A]`.

Let S1 be S with allow `[U,C,B]`.
Let M1 be M with managed allow `[C,B]`.
Let O1 be `{"permissions.allow":[A]}`.

Expected draft bytes: `J(S1)`.

Expected request bytes:

```javascript
J({".claude/settings.json":"keys"})

J({".claude/settings.json":{
  "permissions.allow":[C,B]
}})

J({".claude/settings.json":{
  "permissions.allow":[A]
}})
```

Expected resulting inspection, named P1:

```javascript
P1 = {
  rules: [RU(U),OM(C),RM(B)],
  managed: [
    I(C,true,"other","none"),
    I(B,true,"repo-code","warn")
  ],
  omitted: [A],
  results: [WR(REPO(U,"user")),WR(REPO(B,"managed")),LI]
};
```

Exact first envelope:

```javascript
{
  ok:true,
  changed:true,
  metadataChanged:true,
  needsDecision:false,
  draft:".ai/.run/run-c7-0001/drafts/.claude/settings.json",
  report:{
    allows:P1,
    retirement:{
      listed:[
        I(A,true,"repo-code","warn"),
        I(C,true,"other","none"),
        I(B,true,"repo-code","warn")
      ],
      retired:[A],
      alreadyAbsent:[],
      alreadyOmitted:[],
      retained:[C,B]
    }
  }
}
```

Exact same-run repeat envelope:

```javascript
{
  ok:true,
  changed:false,
  metadataChanged:false,
  needsDecision:false,
  draft:".ai/.run/run-c7-0001/drafts/.claude/settings.json",
  report:{
    allows:P1,
    retirement:{
      listed:[
        I(A,false,"repo-code","warn"),
        I(C,true,"other","none"),
        I(B,true,"repo-code","warn")
      ],
      retired:[],
      alreadyAbsent:[A],
      alreadyOmitted:[],
      retained:[C,B]
    }
  }
}
```

All draft/request bytes remain unchanged on repeat.

For `[]` with no draft/requests: `changed:false`, `metadataChanged:false`, `draft:null`;
inspection is P0, listed is the original inventory, action arrays empty, retained `[A,C,B]`.
No staging file is created.

For initially absent A, use S1 as installed settings but F/M unchanged:

- No settings draft.
- Same three request bytes above.
- `changed:false`, `metadataChanged:true`, `draft:null`.
- `report.allows:P1`.
- Retirement report is the repeat report above.

For a pending `[A]`, change the selection to `[B]`. Expect:

```javascript
{
  ok:false,
  code:"ALLOW_STAGE_CONFLICT",
  error:
    "conflicting allow staging request: " +
    ".ai/.run/run-c7-0001/managed-keys.json",
  target:".ai/.run/run-c7-0001/managed-keys.json"
}
```

Exit 3, no writes. Managed request conflict precedes omission request conflict.

Forged-selection fixture:

```javascript
stagedManaged = {
  ".claude/settings.json":{"permissions.allow":[U,A,C,B]}
};
selection = [U];
```

Installed S/F remain canonical. Exact result:

```javascript
{
  ok:false,
  code:"ALLOW_SELECTION",
  error:
    "ALLOW_SELECTION: retire must contain unique recorded managed allows or allow omissions",
  target:".ai/.run/run-c7-0001/retire-allows.json"
}
```

Exit 3, empty stderr, no writes. Eligibility wins over staged-value conflict.

A conflicting ownership request `"full"` instead produces `ALLOW_STAGE_METADATA`, exit 3,
with error and target naming `.ai/.run/run-c7-0001/ownership.json`.

Byte variations:

- Installed BOM, tabs, CRLF, no final newline with no selection: retain all bytes.
- Selected retirement: tabs, CRLF, no BOM, exactly one final CRLF.
- Request values already equal but formatted differently: retain request bytes.
- Existing draft with unrelated user fields: preserve those fields and order.

### 4.8 Transaction fixtures and literal metadata operation

Use this prepare argv for standalone retirement:

```text
prepare --run-id <id> --mode update --agents claude,codex
```

Approved variant appends:

```text
--approve-user-content .claude/settings.json
```

For S/F and `[A]`, the complete `metadataOps` array is:

```javascript
[{
  kind:"file",
  target:".claude/settings.json",
  before:{
    ownership:"keys",
    managed:{
      "permissions.allow":[A,C,B],
      "permissions.deny":[D],
      heldBack:[]
    }
  },
  after:{
    ownership:"keys",
    managed:{
      "permissions.allow":[C,B],
      "permissions.deny":[D],
      heldBack:[]
    },
    omissions:{"permissions.allow":[A]}
  },
  requiresApproval:true,
  reasons:[
    "settings ownership or managed metadata changes",
    "approved omission records change"
  ]
}]
```

The standalone absent-A case has this same metadata array and no settings content operation.

For genuine-v2 coverage:

1. Build one fixture through C11a with `managedAllows:[A,C,B]`.
2. Retain provenance and original settings/manifest bytes.
3. Apply controlled user settings changes only after installation.
4. Clone reusable states under `context.tmp`.
5. A schema-2 retirement has the settings file op plus C2's schema-conversion manifest op.

Define V3-base by a prior successful apply run on a clone of the genuine v2 installation:

- Initialize an empty run.
- Prepare with `--mode update --agents claude,codex`, no path approval.
- Commit its schema-only conversion using the returned plan hash.
- Release its lock.
- Verify settings bytes unchanged and manifest schema 3.

Tests claiming exactly one file metadata op use V3-base, not the initial schema-2 manifest.

For genuine-v2 expected settings bytes, let T be the installed settings text after controlled
fixture edits, P its parsed object, and K the selected identities. Expected changed bytes are:

```text
JSON.stringify(P with permissions.allow filtered by exact membership in K,
               null,
               installed indentation or 2)
+ one final newline,
then convert LF to installed EOL; no BOM.
```

All other P fields and their insertion order remain identical. For absent-only selection,
expected settings bytes are T exactly.

Present retirement tests:

- Unapproved prepare: exact section-3.10 P envelope.
- Approved prepare: exact allow-removal op fields and metadata reasons.
- Unprepared and prepared diff show settings removal and requests/metadata respectively.
- Commit writes settings before manifest.
- User allows and unselected ownership survive.
- New-run omitted selection produces no work.
- Genuine no-op commit is exactly:

```javascript
{ok:true,committed:false,reason:"nothing to change (zero diff)"}
```

Absent retirement tests:

- Missing approval gives the exact metadata-only P entry in section 3.10.
- Approved commit backs up/writes only manifest.
- Settings raw bytes remain identical.
- New-run normal merge does not restore the omitted allow.

Mixed R86 case:

- Start V3-base with B absent and A present.
- Select `[A,B]`.
- Report `retired:[A]`, `alreadyAbsent:[B]`, `retained:[C]`.
- New omissions `[A,B]`.
- One settings content change and one settings metadata op in the same transaction.
- One settings approval covers both; journal writes settings then manifest.
- Settings before/after differ only by removal of A.

### 4.9 Layered C3/C6 fixture

Use the genuine v2 installation with `[A,C,B]`.

C3 decisions are the `known-unchanged` fixture's literal decisions:

```javascript
{
  schema:1,
  reportSha256:H(J(report)),
  entries:[],
  coverage:[
    {id:"coverage:0",action:"include"},
    {id:"coverage:7",action:"include"},
    {id:"coverage:18",action:"include"}
  ],
  denyOmissions:[],
  dropDenyOwnership:[],
  overrideUserExceptions:false
}
```

The hash is an identity token; do not derive expected choices from implementation output.

Run C3 stage. It stages the resolved policy and these reviewed runtime candidates from trusted
sources:

```text
.ai/tools/security-policy.mjs
.ai/tools/git-safe-core.mjs
.ai/tools/guard-raw-git-core.mjs
.ai/tools/review-diff.mjs
.ai/tools/git-safe.mjs
.ai/tools/guard-raw-git.mjs
.ai/tools/hooks-selftest.mjs
```

An already-current candidate uses C3's declared installed-input behavior. Any installed edited
runtime file would need its own existing C2 approval; this fixture introduces none.

Capture C3's deny array, deny ownership, `heldBack`, deny omissions, decisions and request fields.
Run C6 hooks-only, then C7 `[A]`.

Prepare exactly with:

```text
prepare --run-id <id> --mode update --agents claude,codex
--approve-user-content .ai/security-paths.json,.claude/settings.json
```

The policy approval is C3's full-to-keys migration requirement. The settings approval is C7's
retirement requirement. C6 adds no approval.

Assert C3 projections remain valid and all captured non-allow fields survive. Commit installs
the seven-member unit, C6 E/H and the selected retirement in one transaction.

For isolated C6 interaction tests, use S/F plus reviewed drafts of all seven runtime members,
full ownership requests for new members, then C6 hooks-only and C7 staging:

- Hook only: settings `userContentChange:false`, reasons `[]`, no settings approval.
- Hook plus present A: true and the exact allow-removal reason; settings approval required.
- Hook plus absent A: content remains exempt; missing approval produces the exact metadata-only
  P entry from section 3.10, exit 3. No hooks content reason appears.
- A noncanonical hook mutation retains C6's existing hooks reason.

Do not duplicate C3's forged-`manifestAfter` tests or C4's unreviewed-runtime refusal matrix.
Their existing suites remain the regression coverage for those owned controls.

### 4.10 Bindings, rollback, safety and cost

`R86/C7/binding-rollback`:

- Settings changed after prepare: exit 4, `APPLY_DRIFT`, existing drift text and
  `target changed since prepare`.
- Omission request changed after prepare: exit 4, `APPLY_DRIFT`, existing drift text and
  `manifest metadata changed after prepare (unreviewed ownership)`.
- No journal or project writes on refusal.
- Content rollback restores exact original settings and manifest bytes.
- Metadata-only rollback restores manifest only.
- A later settings edit survives rollback; exit 6, backups retained.

Use existing C2 envelopes; do not wrap apply failures in C7 envelopes.

`V2/C7/contracts` covers every new error category, export set, import safety and the exact
reference assertions specified in section 3.11.

For filesystem safety use directory junctions on Windows:

- Junction at shared `.claude/` before reading settings.
- Junction in the selection-file parent chain.
- Protected settings and protected selection input with read-recording guards.

Junction creation failure fails the required case. Leaf-file symlinks are optional additional
subcases; unavailable symlink privilege creates no new component skip.

Use a Node `-r` preload intercepting default `node:fs` methods for exact-path read/write failures
and read recording. Do not patch production private functions. Match only fixture paths.

Selection-path cases:

- An outside-project file: section-3.9 outside-project envelope, exit 2, no body read.
- `.ai/.run/run-c7-0001/drafts/selection.json`: `ALLOW_STAGE_PATH`, exit 2, canonical
  project-relative target and error
  `allow selection file must be outside setup draft and vault directories`.
- `.ai/.run/run-c7-0001/vault/files/selection.json`: the same code, exit and error, with that
  canonical project-relative target.
- A valid inside-project selection reached through an 8.3/long-name spelling difference uses
  native canonical containment. Expected path strings are computed with
  `fs.realpathSync.native` on both file and project root.

The draft/vault cases assert refusal before the selection body is read.
Marker bodies never appear in output.

For partial-write failures, use a fresh S/F run with selection `[A]` and none of the four output
files present. Inject a persistent `EACCES` at the atomic rename to each final destination in
turn. Assert the complete `ALLOW_STAGE_WRITE` envelope, exit 2, empty stderr and no success
envelope. The error and target name the failing project-relative output path.

Expected final output files after each injected failure:

| Failing destination | Files that exist afterward |
| --- | --- |
| Settings draft | None of the four output files |
| `ownership.json` | Settings draft only |
| `managed-keys.json` | Settings draft and ownership request |
| `omissions.json` | Settings draft, ownership request and managed request |

Every existing output in this table has the exact section-4.7 bytes. The failed destination
and every later destination remain absent. Installed settings and manifest remain unchanged
in all four cases. The preexisting selection/init files remain unchanged. These assertions
concern final output paths, not transient atomic-write filenames.

Estimated C7 cost remains 45-65 direct Node commands and approximately 100-160 total processes
including genuine-v2 construction and Git children, roughly 1-3 minutes on this Windows host.
These are estimates, not assertions. R29 aggregation adds the entire C7 run to baseline runtime.

### 4.11 Earlier-suite edits and invariants

Tests-lane edits to C3 are explicit:

1. `c3.test.mjs:334`: merge exports become:

```javascript
["mergeManagedDenies","mergeManagedHooks","retireManagedAllows"]
```

2. `c3.test.mjs:1803-1828`, "the CLI report maps the pure result":

- Remove the nonempty allow-file setup and option.
- Expect `report.added.allow:[]`.
- Expect `report.alreadyPresent:["Read(**/.npmrc)"]`.
- Expect draft allow `["Bash(other)"]`.
- Assert no `permissions.allow` field is introduced in the managed request.
- Preserve all existing deny, conflict, malformed-hook, ineffective and info assertions.
- Remove the obsolete allow-ownership PLAN-GAP comment.
- Allow/report key sets gain `allows` last after C6's `hooks`.

3. `c3.test.mjs:1830-1843`, staged allow preservation:

- Test no allow file and `[]` independently; neither introduces `permissions.allow`.
- Seed `managed-keys.json` directly with a valid staged allow field.
- Run normal merge without an allow file and with `[]`; both preserve the seeded field.
- Seed no allow-omission request, so the order guard does not apply.
- Move all nonempty allow-file refusal expectations to `R54/C7/refusal`.

C6's frozen statement that those C3 CLI steps remain unchanged applies before C7.
The edits above are C7's explicit amendment.

Other changes:

- R29 aggregates C7 after existing checks/C6 aggregation, with no nested PASS records.
- C6 exact merge-export assertions gain the retirement export.
- C3/C6 normal-report key-set assertions gain `allows`.
- Pure deny reports, pure hook reports and hooks-only reports are unchanged.
- C1, C2, C4 and C5 require no expectation changes.
- C11a's nonempty allow-file tests execute tagged v2 code, so remain unchanged.
- Baseline R35 protected/outside allow-input checks retain their existing behavior.
- C5 reserved-ID merge behavior remains unchanged.
- C5/C6's seven-member `freshSetup` staging remains.
- No other committed C1-C6 expectation break is identified; C6 test behavior is checked against
  its frozen plan because its test file is absent at `4b744ec`.

Required totals:

| Suite | Result |
| --- | --- |
| Baseline | 59 PASS / 0 FAIL / 1 SKIP |
| C11a | 8 PASS / 0 FAIL / 0 SKIP |
| C1 | 12 PASS / 0 FAIL / 0 SKIP |
| C2 | 14 PASS / 0 FAIL / 0 SKIP |
| C3 | 18 PASS / 0 FAIL / 0 SKIP |
| C4 | 17 PASS / 0 FAIL / 0 SKIP |
| C5 | 18 PASS / 0 FAIL / 0 SKIP |
| C6 | 12 PASS / 0 FAIL / 0 SKIP |
| C7 | 12 PASS / 0 FAIL / 0 SKIP |

R13d remains the baseline Windows skip. Preserve the baseline final envelope.

## 5. Edge cases and failure modes

| Requirement or edge | Concrete coverage |
| --- | --- |
| Managed/user repo-code and broad severity | A01-A74, D1-D3 |
| Every warning includes rule and remedy | Full return values for every risky corpus row |
| Personal settings information only | D1-D4 and local-permission sentinel |
| All managed entries, including absent/duplicate/safe | Genuine inventory via detect and staging |
| Exact ownership, schema 2, non-keys and malformed manifest | Section 4.4 ownership cases |
| Unselected rules and bytes survive | Canonical `[]`, `[A]`, style cases |
| No approval means no installed changes | Present and absent P-envelope cases |
| Already-absent metadata reconciliation | V3-base absent-A transaction |
| Mixed content and absent reconciliation | `[A, absent B]` transaction |
| Denies never reclassified or deleted | Deny-only G/A case and layered migration |
| Hook exemption does not hide permission removal | Seven-member C6 interaction fixture |
| Staged ownership is not authority | Forged U selection, exact `ALLOW_SELECTION` |
| Overlapping managed/omitted identity | Managed precedence and convergent retirement |
| Record-level extensions survive | F plus `fixtureNote`, exact committed record |
| Same-run repeat and amendment | Exact repeat envelope and conflict fixture |
| Normal merge after retirement | Exact `ALLOW_STAGE_ORDER` case |
| Protected/malformed policy and unsafe paths | Discovery and junction/read-guard cases |
| Canonical Windows path spelling | Native file/root canonicalization assertions |
| Selection outside project or inside drafts/vault | Path-error cases before reads |
| Request/write failures | Exact envelopes and four ordered partial-write states |
| Reference text remains complete | Per-paragraph normalized substring assertions |
| Changed prepared inputs and later user edits | Binding and rollback cases |

## 6. Runnable acceptance

After C5/C6 land:

```text
node project-setup/tests/run-component-tests.mjs --component C7
```

Expected stdout:

```text
PASS  R53/C7/classifier  shared allows receive exact classes and severities
PASS  R53/C7/ownership  validated exact ownership controls classification
PASS  R53/C7/discovery  discovery reports shared rules and personal settings guidance
PASS  R54/C7/refusal  merge refuses new managed execution permissions
PASS  R85/C7/inventory  every installed managed allow is listed
PASS  R85/C7/retirement  retirement removes only selected managed identities
PASS  R85/C7/staging  allow staging preserves deny and hook projections
PASS  R85/C7/preservation  unselected rules and unchanged bytes survive
PASS  R85/C7/transaction  approved retirement commits content and omissions together
PASS  R86/C7/reconciliation  absent allows reconcile through metadata operations
PASS  R86/C7/binding-rollback  retirement bindings and rollback preserve reviewed state
PASS  V2/C7/contracts  C7 exports errors and component contracts are exact
12 PASS / 0 FAIL / 0 SKIP
RESULTS  <absolute evidence path>
```

Exit 0; empty stderr. The final path is the generated absolute `component-results.json` path.

Regression commands:

```text
node project-setup/tests/run-component-tests.mjs --component C11a
node project-setup/tests/run-component-tests.mjs --component C1
node project-setup/tests/run-component-tests.mjs --component C2
node project-setup/tests/run-component-tests.mjs --component C3
node project-setup/tests/run-component-tests.mjs --component C4
node project-setup/tests/run-component-tests.mjs --component C5
node project-setup/tests/run-component-tests.mjs --component C6
node project-setup/tests/run-tests.mjs
```

Each component retains its registered PASS lines, section-4.11 total and RESULTS line.

Baseline final total:

```text
59 PASS / 0 FAIL / 1 SKIP
```

Its existing final envelope remains:

```javascript
{env,summary:{passed:59,failed:0,skipped:1},resultsFile}
```

C7 acceptance requires no release tag, network service or live Claude session.
C10 owns validation-report acceptance; C11b owns complete numbered-case composition.

## 7. Rollback

Revert later C8/C10/C11b consumers before removing C7's exports and CLI. Revert C7 production,
reference and test-registration changes together. Preserve C5/C6 behavior and the runtime catalog.

For an updated project, use rc.1 tooling before reverting the installed skill:

```text
node <SKILL_DIR>/scripts/apply.mjs rollback --run-id <id>
```

- Content retirement restores original settings and manifest bytes.
- Metadata-only reconciliation restores manifest without touching settings.
- Newly created files are removed only if their bytes still match this run.
- Later user edits survive; incomplete rollback exits 6 and retains backups.
- Roll back later independent runs newest first.
- Retry journaled work with a new run ID.
- Exit 2/4 before a journal permits re-prepare; exit 5 requires recovery; exit 7 prevents
  reuse of journaled runs or bypassing unresolved recovery.

Do not restore retired allows merely because C7 code is reverted. Without the retirement
journal, restoration is a new reviewed permission decision. Do not hand-edit metadata to imply
restoration.

Q6 remains: v2 validation rejects schema 3. Reverting the installed skill alone does not
downgrade project state.

## 8. Accepted residual risks

- Lexical classification misses shell wrappers, aliases, substitutions, environment assignments
  and unusual executable spellings. Exhaustive shell interpretation exceeds A4's warning scope.

- Tools that load repository configuration or hooks can remain `other`, including direct
  eslint/prettier/jest commands, tsx, ts-node and `git commit` invoking Husky. Extending every
  ecosystem's execution semantics would turn a small classifier into an unreliable inventory.

- Explicit absolute local executable paths can remain `other` unless their basename matches a
  recognized interpreter. Determining repository membership would require filesystem/context
  analysis absent from the pure classifier.

- Conservative interpreter and relative-path rules may warn about code outside the repository,
  including `~/` and variable-prefixed paths. They intentionally avoid expansion and script or
  package reads.

- `bash -c *` and `pwsh -Command *` are repo-code, not broad. The class describes the recognized
  execution mechanism; it is not a complete ranking of every command's power.

- `other` is not a safety certification.

- Exact-string ownership cannot distinguish independently authored identical occurrences.
  C2 owns rule strings, so retirement removes all occurrences of a selected managed identity.

- Rewritten JSON follows C6 serialization. Values/order survive, but lexical whitespace and
  escape spelling may change. Unchanged and metadata-only settings preserve raw bytes.

- Installed metadata is structurally validated, not authenticated. Reviewed diffs and C2
  approval remain necessary.

- Multiple run-local staging writes are not atomic together. A failed write can leave the
  specified prefix of completed writes; installed state remains untouched and staging must be
  rerun.

- Generic apply remains a reviewed transaction engine. C7's merge refusal does not make arbitrary
  agent-authored drafts a sandbox.

- Shared-filesystem changes can occur between checks. Existing bindings, checks and recovery
  narrow the window; separate worktrees provide stronger isolation.

- C7 does not prove live Claude permission or hook enforcement. N8/C6 host-verification limits
  remain explicit.

## 9. Plan questions

1. **Open for maintainer: refuse every nonempty managed allow input?**

   A4 explicitly requires refusal of broad and repository-code managed proposals. The architecture
   also says "Propose no new managed allows."

   Recommended: keep `ALLOW_NEW` for every remaining nonempty `--allow-file`, including `other`
   and already-recorded entries. Its message is
   `nonempty --allow-file is not supported in v3: Q(rule)`, avoiding a false claim that every
   supplied entry is new.

   The body and tests proceed with this recommended option. Choosing otherwise requires changing
   section 3.6, the relevant R54 cases and C8's legacy-option guidance before freeze.

2. **Open for maintainer: keep validation wiring entirely with C10?**

   The C7 architecture file list names `validate.mjs`; section-4 ownership assigns R53 reporting
   to C10.

   Recommended: C7 changes no `validate.mjs` lines. It exports `inspectAllows`, pins its rows,
   severities and messages, and tests discovery/merge consumers. C10 imports it and owns the
   validation result/exit integration.

   The body proceeds with this recommended ownership split. No C7 validation-integration PASS
   is claimed.

## Addendum at freeze: maintainer decisions and plan-critique round 3, C7-P3-1 to C7-P3-3 (NON-BLOCKING)

Added by the orchestrator when freezing, with the maintainer's approval (2026-10-19). Where an item
and an earlier section differ, the item wins.

Recorded decisions on section 9, maintainer, 2026-10-19:

- C7-PQ1: option A, the recommended option. `ALLOW_NEW` refuses every remaining nonempty
  `--allow-file`, including `other` and already-recorded entries, with the message in section 9.
  Section 3.6 and the R54 cases stand as written.
- C7-PQ2: option A, the recommended option. C7 changes no `validate.mjs` lines; it exports
  `inspectAllows`, and C10 owns the validation result and exit integration. No C7
  validation-integration PASS is claimed.

Round 3 items:

- C7-P3-1. Injected rename failure. The partial-write cases inject a persistent, non-retried
  error (`code: 'EIO'`) at the final rename, so `atomicWrite`'s EACCES/EPERM/EBUSY retry loop
  never runs; the `ALLOW_STAGE_WRITE` mapping is independent of the error code.
- C7-P3-2. Short and long path spellings. The 8.3/long-name selection case passes the selection
  file using the raw `process.env.TEMP`-based spelling of the project path. The expected response
  is exactly the first `[A]` success envelope of section 4.7. If the host has no distinct short
  spelling, the same case runs with identical spellings; it must pass and is not a skip.
- C7-P3-3. Outside-file expected target. The outside file of the refusal tests lives under
  `context.tmp`, outside the project. Its expected target is
  `fs.realpathSync.native(file).replace(/\\/g, '/')`, computed after the file is created.
