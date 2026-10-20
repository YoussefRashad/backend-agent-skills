# Migrating v2 project setup

Read this when detect reports mode `update` with a schema-2 manifest (a project installed by project-setup v2),
before any installed agent or wrapper is replaced, and whenever installed customizations must be preserved. It
extends `SKILL.md`'s workflow; it does not replace any of its gates.

## 1. Upgrade boundary

Upgrade the known v2 project together with its skill. V2 validation rejects manifest schema 3.
This is a compatibility signal, not a retrofitted pre-write guard in every old command.
Do not use v2 commands to repair a schema-3 project.

The update is one reviewed transaction: policy, settings, the seven runtime members, agents, wrappers, ownership,
omissions, the snippet record and the manifest are prepared, approved and committed together, and the manifest is
written last as schema 3. A valid schema-2 manifest is accepted as update input. Invalid metadata (detect mode
`invalid`) is repaired through the documented procedure first; it is never permission to invent ownership.

Runtime migration uses the files of the same verified skill copy: the six snapshots under `data/v2.0.0/assets/`,
`data/secret-paths-v2.0.0.json` for the policy, and the current `assets/`. It never needs the distribution
repository, the v2 tag, an archive or Git history.

## 2. Verify shipped comparison data

Compare installed agents and wrappers with the v2.0.0 snapshots shipped in this skill's
data directory. Runtime migration MUST NOT require the distribution repository, its tag,
or its Git history. Missing, unreadable or altered comparison data stops migration; never
reconstruct a baseline from memory, current templates, installed files or agent-written drafts.

Only when detect reports mode `update` with a schema-2 manifest, run
`node <SKILL_DIR>/scripts/check-agent-baselines.mjs` before reading installed agents or
wrappers for comparison, from the same `<SKILL_DIR>` whose `data/v2.0.0/` files you will
compare. Continue only on exit 0; otherwise stop and report the checker error without
inventing or substituting a baseline. Fresh, adopt, migrate-v1 and all other runs do not
run this checker.

```text
node <SKILL_DIR>/scripts/check-agent-baselines.mjs
```

The checker takes no arguments. It compares the raw bytes of the six snapshots with SHA256 pins embedded in the
checker (no EOL, BOM or whitespace normalization), refuses a symlink or junction anywhere below the skill root, a
non-directory component and a nonregular snapshot, and stops at the first failure in table order. It reads only
the six snapshot bodies: no project file, policy, manifest, Git metadata or installer metadata. It spawns nothing
and writes nothing. Its result is two-space JSON on stdout with an empty stderr:

| Result | Exit | stdout `code` |
|---|---|---|
| All six snapshots verified: `{ "ok": true, "baseline": "v2.0.0", "files": [...] }` | 0 | (none) |
| A snapshot, a path component or the skill root is missing or unreadable | 2 | `AGENT_BASELINE_IO` |
| A snapshot is altered, linked or nonregular, or the skill root is not a directory | 3 | `AGENT_BASELINE_INVALID` |
| Any command-line argument | 1 | `AGENT_BASELINE_USAGE` |

A failure body is `{ "ok": false, "code", "error", "target" }`; `target` is the affected skill-relative table path
(or `.` for the skill root), never a native absolute path. Report the `error` string as it is.

The checker verifies comparison data. It does not establish that installed instructions are trusted or determine
the setup mode itself. Installer metadata (`.installed.json`) is not a baseline authority: the installer's
local-edit refusal and `install.mjs verify` from a trusted source checkout are complementary pre-upgrade checks,
not migration inputs. The checker code, its pins and the shipped data share one trust domain; an attacker able to
replace all three defeats their agreement.

## 3. Inventory and disposition

The installed v2 reviewer was rendered and only its hash was recorded. Customizations cannot
be separated mechanically. Every added, changed or removed line relative to the shipped
snapshot must receive a disposition, including changes inside template sections and appended
sections. Nothing is silently dropped.

v2 rendering replaced `{{PROJECT_NAME}}` and removed references to documentation that was not
generated. Record both kinds of rendering difference. Confirming a removed documentation
reference requires evidence that the referenced path is absent; apply the same removal to
the v3 draft.

Compare in this order (snapshot suffix under `data/v2.0.0/assets/`, then the installed file):

| Snapshot | Installed file |
|---|---|
| `agents/reviewer.md` | `.ai/agents/reviewer.md` |
| `agents/docs-sync.md` | `.ai/agents/docs-sync.md` |
| `wrappers/claude-reviewer.md` | `.claude/agents/reviewer.md` |
| `wrappers/claude-docs-sync.md` | `.claude/agents/docs-sync.md` |
| `wrappers/codex-reviewer.toml` | `.codex/agents/reviewer.toml` |
| `wrappers/codex-docs_sync.toml` | `.codex/agents/docs_sync.toml` |

Input boundaries:

| Input | Validation and failure behavior |
|---|---|
| Shipped comparison data | Run the section 2 preflight; missing, unreadable or altered data stops comparison |
| Installed manifest and policy | The existing setup readers validate schemas and metadata; do not infer a replacement record |
| Installed agents | Read only through permitted local tools in the trusted checkout; a failed or denied read stops |
| Missing installed agent | List the absence explicitly; recreate it only as an explicit reviewed decision |
| Installed Codex wrapper | Parse with `scripts/toml.mjs` `parseToml`; errors or unsupported syntax require an explicit decision, not lossy rewriting |
| Existing project rules | Preserve exact bytes; a missing file is allowed; an unreadable one stops |
| Disposition notes and drafts | Treat as untrusted proposals; verify them against the installed inputs and the approved choices before prepare |
| Prepared transaction | The apply bindings and commit checks govern it; an edit after prepare requires a new prepare and approval |

Agent file tools do not provide an atomic no-follow filesystem read. The checker has bounded path checks for its
own six snapshots; reading the installed agents remains a residual limitation.

Compare the raw snapshot first, then the snapshot with only `{{PROJECT_NAME}}` rendered; the rows that represent
confirmed rendering stay explicit in the first pass. Every added, changed or removed line gets a row, including
substitutions, deleted references, blank lines and repeated lines. A removed line never disappears merely because
its meaning seems obvious. The table columns are exactly:

```text
ID | Source | Baseline text | Installed text | Proposed destination | Decision
```

Assign `A001`, `A002`, and so on in the six-file order above, then in baseline line order within each file.
Appended sections follow that file's last baseline line. Source-file order means this table order, not
filesystem enumeration order.

Decisions are:

```text
pending
move-approved
rendering-confirmed
replace-approved
keep-file
```

- `pending`: no decision yet. A pending row blocks replacement of its file.
- `move-approved`: the user approved moving the exact installed text to the destination (section 4).
- `rendering-confirmed`: the difference is v2 rendering. For a removed doc reference this needs evidence that the
  referenced path is absent (for example `absent:docs/api-conventions.md`), and the v3 draft applies the same
  rendering. A changed rule is never classified as a rendering substitution merely because it is near one.
- `replace-approved`: the user approved dropping the installed text in favour of the shipped replacement.
- `keep-file`: the installed file is kept as it is; no replacement draft is staged for it.

Every non-template line is either moved with approval or listed for an explicit decision. A hash mismatch detects
that a difference exists; it cannot separate customizations mechanically. A rule that conflicts with an existing
project rule, or with the canonical reviewer's sections 1 or 4, stays pending until the user decides it.

Report the comparison with exactly one of these lines (they are agent report lines, not command output):

```text
Agent migration: comparison complete; explicit decisions remain.
Agent migration: all dispositions approved; review the prepared transaction.
Agent migration: stopped; required comparison input is unavailable or unverified.
Agent migration: incomplete update; kept installed file: <target>.
```

For `keep-file`, substitute the installed relative path for `<target>`. Report an incomplete update rather than
claiming that all canonical instructions were upgraded.

## 4. Draft and approve

The documented sequence:

```text
trusted discovery
-> v2 comparison preflight when applicable
-> lock and apply init
-> policy report and explicit decisions when applicable
-> migration stage, or normal merge when needed
-> hooks-only staging
-> agent/wrapper drafts and project ownership request
-> approved allow-retirement staging
-> apply diff (unprepared preview)
-> prepare --approve-user-content <exact paths>
-> apply diff (bound review)
-> plan-hash approval
-> commit
-> validate
-> render/review Codex snippet
-> report and retain recovery material
```

### Policy migration

```text
node <SKILL_DIR>/scripts/migrate-security-paths.mjs report --project .
node <SKILL_DIR>/scripts/migrate-security-paths.mjs stage --project . --run-id <id>
```

The report prints `{ ok: true, report, reportSha256 }`, where `report` has exactly:

```javascript
{
  baseline,
  baselineSha256,
  sourceSchema,
  entries: [{ id, classification, before, current }],
  coverage: [{ id, entry, replaces, previousOmissions, alreadyEffective }],
  retainedManagedDenies,
  requiredDecisions: [{ id, choices }]
}
```

Write the user's decisions to `.ai/.run/<id>/security-decisions.json`, with exactly:

```javascript
{
  schema: 1,
  reportSha256,
  entries: [{ id, action }],
  coverage: [{ id, action }],
  denyOmissions: [],
  dropDenyOwnership: [],
  overrideUserExceptions: false
}
```

The last three fields contain the user's actual reviewed choices; the empty arrays and `false` shown are the clean
values, not defaults that override existing decisions. `reportSha256` is the SHA256 of the report serialized as
two-space JSON plus a final LF. The stage command recomputes and validates it. A stale report is not approval for
a new report: report again and decide again.

Choices, in the order the report offers them:

| Report row | Choices |
|---|---|
| Known managed edit | `keep`, `replace`, `project`, `omit` |
| Unknown managed edit | `keep`, `project`, `omit` |
| Project addition | `project`, `keep`, `omit` |
| Deletion | `restore`, `omit` |
| Coverage | `include`, `omit` |

Unchanged rows need no entry decision. Replacement coverage requires its own choice even if an older identity was
omitted. Retained legacy denies and identical user-owned denies are preserved. Ownership comes from the installed
record, never from current bytes, and a missing policy baseline is never replaced by a guess.

Metadata-only runs and unchanged policy content do not trigger the policy migration workflow
gate. A later content edit to a schema-2 policy does trigger it and must use report, decisions
and stage again.

The stage supplies the policy, the settings projection and all seven runtime drafts under `.ai/tools/`
(`security-policy.mjs`, `git-safe-core.mjs`, `guard-raw-git-core.mjs`, `review-diff.mjs`, `git-safe.mjs`,
`guard-raw-git.mjs`, `hooks-selftest.mjs`), each from the corresponding `assets/tools/` member of the same skill
copy. Do not overwrite its settings draft with a normal merge afterward.

Stage all seven runtime members as one reviewed compatible unit. Declining replacement of an
edited member prevents the coupled policy update. Do not install the new policy with old or
unreviewed readers.

### Hooks and allows

After the migration stage and before allow retirement, stage the raw-Git hook:

```text
node <SKILL_DIR>/scripts/merge-claude-settings.mjs --run-id <id> --hooks-only
```

The canonical hook identity is event `PreToolUse`, matcher `Bash|PowerShell` and command
`node "$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs"`. Hooks-only staging preserves the staged denies,
their ownership, held-back rules, omissions and migration decisions; insertion stays conditional on the reviewed
guard, and user options, ordering and identity rules are kept (`references/claude.md`, "Hooks").

Propose no new managed allows. Every nonempty `--allow-file <confirmed.json>` is refused,
including rules classified as `other` and rules already recorded as managed. Use the
retirement procedure only for exact installed managed entries the user approved retiring:
write them as a JSON string array, for example to `.ai/.run/<id>/retire-allows.json`, then run
`node <SKILL_DIR>/scripts/merge-claude-settings.mjs --run-id <id> --retire-allow-file <path>`. Stage denies and
hooks before retiring allows; staging is not approval.

### Agents, project rules and wrappers

Draft the agents after the comparison and every disposition, before the final preview and prepare. Render
`assets/agents/*.md` (replace `{{PROJECT_NAME}}`, remove references to docs you did not generate) and carry
every approved disposition into the drafts. A file with a `pending` row gets no replacement draft; a `keep-file`
row means no draft for that file and an incomplete-update report.

Move approved reviewer-specific text to ".ai/agents/reviewer.project.md". Preserve existing
project-file bytes and append only the exact approved text. Do not deduplicate, rewrite or
resolve conflicting rules silently. Present a collision for an explicit decision.

If no reviewer customization is approved for movement, do not create the project file. Routine later updates omit
its draft unless the user requested a project-rule change.

Request its ownership by merging this entry into `.ai/.run/<id>/ownership.json`:

```json
{
  ".ai/agents/reviewer.project.md": "merged"
}
```

Preserve the entries the migration or merge scripts already wrote, and serialize the merged request as two-space
JSON with a final LF. Without this request a newly created project file would be inferred as `full`. Existing
unowned project-file content still requires its applicable approval; `merged` does not grant permission to
silently replace pre-existing text.

Docs-sync customizations are listed and preserved in the reviewed replacement, or otherwise explicitly decided.
There is no docs-sync project file.

Preserve user-added top-level settings and tables, including `default_permissions`. Compare
both the installed v2 baseline difference and the installed wrapper against the shipped
replacement. Do not silently drop a setting because it is outside `developer_instructions`.

A wrapper whose installed hash matches its manifest record can still contain settings added
through an earlier reviewed transaction. Compare the installed wrapper's top-level keys and
tables with the shipped template; preserve every key or table the template does not define,
or list it for an explicit decision.

Preserve values and TOML structure: place preserved top-level keys immediately before the single
`developer_instructions = """` line of the shipped wrapper, and preserved tables after its final line. A
conflicting key defined by both versions, syntax `parseToml` reports as an error or unsupported, or a user-added
`sandbox_mode` needs an explicit decision. Do not erase it silently or claim the full-file guard settles its
meaning.

Claude wrappers receive no draft when their shipped replacement equals the v2 baseline, so an installed
`model: opus` addition survives without an unnecessary replacement.

### Review, approve and commit

```text
node <SKILL_DIR>/scripts/apply.mjs diff --project . --run-id <id>
node <SKILL_DIR>/scripts/apply.mjs prepare --run-id <id> --mode update --agents claude,codex
node <SKILL_DIR>/scripts/apply.mjs commit --run-id <id> --approved-plan <hash>
node <SKILL_DIR>/scripts/validate.mjs
node <SKILL_DIR>/scripts/render-permissions.mjs codex-snippet --project .
```

The first diff is an unprepared preview. Add the required exact approval list to prepare
(`--approve-user-content <exact paths>`); omit it only when no target requires it, and never supply broad or
unrelated paths to make prepare pass. Typical targets are an edited fully managed agent or wrapper, an existing
project file the skill does not own and, in a policy migration, the policy and settings when prepare lists them.

A prepare without approvals exits 3 and lists the exact `APPLY_APPROVAL_REQUIRED` targets;
show those diffs, then re-run prepare with exactly those paths.

Review the bound diff after prepare and approve that plan hash. The earlier preview is not approval of later draft
changes. Apply diff invokes no Git, and protected content receives no textual diff. Policy, settings, runtime,
agents, ownership, omissions, snippet record and manifest share one transaction.

The snippet command prints the Codex deny-read snippet as raw TOML on stdout. Present it for review; never write
user-level configuration. A recorded snippet hash is not evidence that the user installed it. Until the snippet is
recorded, or after the policy changes, the security-state inspection (reported by detect) shows one of these
informational rows:

```javascript
{
  level: "info",
  check: "codex-snippet",
  detail: "Codex deny-read snippet has not been recorded"
}
```

```javascript
{
  level: "info",
  check: "codex-snippet",
  detail: "Codex deny-read snippet is stale; render and review it again"
}
```

## 5. Commit, rerun and rollback

Roll back project state with the rc.1 tooling before reverting the installed skill. If later
independent runs exist, roll them back newest first. Do not split this migration into
successive manifest commits.

Keep recovery material until the user confirms the update. Exit 2 or 4 before a journal
permits correction and re-prepare. Exit 5 requires recovery, exit 6 means rollback is
incomplete and backups must be retained, and exit 7 forbids bypassing an unresolved or
already-written run. A retry after a journaled run uses a new run ID.

```text
node <SKILL_DIR>/scripts/apply.mjs rollback --run-id <id>
```

Rollback runs while that run's lock is held; to roll back an earlier run, release the later run's lock and
acquire the earlier run's again. Rollback restores policy, settings, runtime members, agents, wrappers, project
rules and the manifest through the same journal. An existing project file returns to its exact pre-run bytes; a
newly created one is removed only if its bytes still match the run. A file edited after the run wrote it is left
untouched with its backup kept, and rollback exits 6: preserve those bytes and the recovery backups, and never
force the old manifest over later state.

A routine rerun after an approved update stages the same canonical and Codex drafts and no project-file draft; it
needs no approval and commits nothing (`nothing to change (zero diff)`).

If the journal is unavailable, make a new reviewed recovery transaction from verified current state and retained
backups. Do not concatenate customization files blindly, hand-edit manifest hashes or use v2 commands to repair a
schema-3 project.
