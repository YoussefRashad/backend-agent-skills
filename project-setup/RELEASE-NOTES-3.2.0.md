# project-setup 3.2.0

Release 3.2.0 closes findings 1 to 10 of the 3.1.0 live acceptance record
(`docs/plans/2026-11-22-project-setup-v3.1-live-acceptance-results.md` of the distribution
repository), the two 3.0.x reviewer residuals and the stale documentation and procedure items.
It is the first release after 3.0.0 that changes runtime files.

RELEASE-NOTES-3.1.0.md routed these fixes to "3.1.x". They ship in 3.2.0 instead, because two of
them are additive changes that every installed project sees: two new shipped deny patterns become
a coverage decision on update, and the canonical reviewer and the mapping reference gain new MUST
rules. Nothing here requires a project to change code.

None of the 3.2.0 changes has been measured on a host yet. Everything below that describes agent
or host behaviour is the intended behaviour; see "Not measured".

## Compatibility

- Manifest schema 3 and security-policy schemas 1 and 2 are unchanged. No CLI flag is added or
  removed.
- The installed file set is unchanged: the same files under SKILL.md, VERSION, CHANGELOG.md,
  references, assets, data and scripts. These notes ship in the release archive only.
- The installer and the release builder are unchanged. Of the scripts, only `scripts/detect.mjs`
  (installer-backup reporting) and `scripts/migrate-security-paths.mjs` (policy baseline
  recognition) change.
- A project installed by 3.0.0 or 3.1.0 updates in place through the normal reviewed workflow.
- Root `AGENTS.md` grows by about twelve lines. A project already near the 150-line limit gets the
  existing `agents-size` warning.

## Changes

### Shipped secret-path policy (A4)

`data/secret-paths.json` gains two root-anchored directory entries, `env/**` and `cert/**`, which
backend-standards names among the paths an agent must not read. They are root-anchored on purpose:
`**/env/**` would also deny configuration code such as `src/config/env/`, which setup reads for
variable names. The 20 earlier entries are unchanged and keep their order.

Setup's own reads refuse the two root directories as soon as 3.2.0 is the running skill, whatever
the project's coverage decision, because the refusal set is the shipped defaults plus the project
policy. `apply.mjs` likewise refuses to read or write them.

`migrate-security-paths.mjs` recognises one more policy baseline, `v3.0.0`: a `full` ownership
record whose hash is the default policy shipped by 3.0.0 and 3.1.0. Its managed list is the current
default without the two new entries. Without this, every project fresh-installed by 3.0.0 or 3.1.0
would fall to baseline `unknown` and face 42 decisions; with it, such a project is offered exactly
the two new coverage rows. The four callers that build the migration input are unchanged.

### Canonical reviewer (B1)

A change that breaks a critical rule in AGENTS.md, or a MUST-level rule in the documents it names
or in the project review rules, in a money, balance, payment, points or limit flow is a finding
whatever its current reachability. It is rated HIGH or CRITICAL, classified likely risk while
nothing calls it, and makes the verdict block. A project rule cannot relax this paragraph.

### Delegated launch rule (B2)

The root CLAUDE.md template gains a bullet for delegated agents: a delegated agent treats the
original start directory as unknown unless the brief states it, does not refuse on its own working
directory alone, and states in its output when the start directory was not given. A stated start
directory below the rule's directory is still refused, and the parent stays bound by the launch
rule. The root AGENTS.md template asks the parent to state the original start directory, the
repository root and the current directory in every delegation brief.

### Managed blocks and retained agents (A1, A2)

- The root AGENTS.md `agents` block now tells every agent, including a retained project agent that
  does not load a canonical definition, not to add, remove or move managed-block markers, to edit
  inside a block only when a code change makes its text wrong, and then to name the file and block.
- `references/docs-generation.md` defines four Subagents lines for the CLAUDE.md `claude` block and
  three exception sentences for the AGENTS.md `agents` block. Setup selects them from the per-agent
  dispositions of the same run, so a partial agent layer is stated instead of claimed complete.
- `references/modes.md` states that an agent's edit inside a managed block is an ordinary
  `edited-by-user` block on the next update: keep theirs, take new or merge.

### One applicability rule for every mode (A3, A7, A8)

`references/docs-generation.md` defines when a mapped document is applicable (code evidence,
source-section evidence or an existing document), makes the Phase 0 list provisional and derived
only from Phase 0 reads, and requires Phase 1 to draft exactly the confirmed set. The rule applies
identically in every mode. A document that is not applicable gets no pointer, no 03 content and no
navigation row. When the configuration document is applicable, setup proposes a per-variable
Configuration table in 03 in adopt and update alike; when `tsconfig.json` exists, it proposes the
compiler strictness as written under CI/CD and tooling. The critical-modules pointer follows the
same rule. While the repository has no tracked source files, source-section evidence alone writes
no pointer and no 03 content and leaves an existing document unchanged, so the empty-repository
rule keeps precedence.

### Installer backups (A5)

`detect.mjs` reports `.project-setup.bak-*` and `.project-setup.rolledback-*` directories that hold
a SKILL.md at the top level of each scanned skills directory, in a new `installerBackups` array,
with one warning per tool. It reads entry names and the existence of SKILL.md only and skips links.
They are not added to `installs` or `installConflicts`. Moving the backup location out of host
discovery is deferred.

### Procedure and records

The live acceptance procedure moves installer backups out of the skills directories instead of
disabling them, names the expected partial-layer lines, documents the evidence fields of the three
applicability checkers and records the Codex sandbox ACL prerequisite. Root TODO.md records the
backend-standards stamp inconsistency, the backup relocation candidate and the 3.1.0 rows that were
not measured.

## Correction of a 3.1.0 known issue

Known issue 1 of RELEASE-NOTES-3.1.0.md says that validate reports `claude-block-content` for a
kept docs-sync. That is imprecise: `claude-block-content` is emitted only by the test-only live
helper `tests/live/bs-doc-map.mjs`, which compares the installed block with the template block.
`validate.mjs` has no template-content check; its block checks are marker errors and manifest
drift. 3.2.0 does not change `validate.mjs`.

## Upgrading

1. Install 3.2.0 with `node install/install.mjs` into each target and run `install.mjs verify`.
2. Move the installer backup directory (`.project-setup.bak-*`) and its `.meta.json` out of the skills directory, and note the original path; move both back unmodified before any `install.mjs rollback`, because rollback verifies the recorded digest.
3. Start a new session, confirm one active project-setup copy in the tool's own skill list, and confirm that `detect.mjs` reports an empty `installerBackups`.
4. If the project tracks files under root env/ or cert/, setup stops in Phase 0 (tracked secret paths): move non-secret files out of those directories, or escalate to the owner; setup does not continue past the stop, and an omit decision does not clear it.
5. On update, decide the two coverage rows for `env/**` and `cert/**`: include is recommended; omit is recorded as an explicit omission and does not remove setup's own refusal to read those paths.

## What an existing project is offered

| Installed state | Policy report on update | Decisions |
|---|---|---|
| Fresh install by 3.0.0 or 3.1.0, policy untouched | baseline `v3.0.0`, 20 unchanged, two coverage rows | two |
| Same, with the two globs added by hand to `patterns` | baseline `v3.0.0`, two project-addition rows, two coverage rows already effective | four |
| Same, with the two globs in `projectPatterns` | baseline `v3.0.0`, two coverage rows already effective | two |
| Migrated project (`keys` record) | baseline `recorded`, two coverage rows | two |
| Fresh install by 3.2.0 | baseline `shipped`, no coverage row | none |
| Project installed by v2.0.0 | baseline `v2.0.0`, the existing rows plus the two | existing plus two |
| `full` record with any other hash | baseline `unknown` (unchanged behaviour) | 42 |

The canonical reviewer, the `claude` block and the `agents` block follow the existing update
rules: an unchanged installed copy is regenerated, a user-modified one gets keep, take new or merge,
and a kept one is reported as an incomplete update.

## Verification

Run serially, from `project-setup/`:

```text
node tests/release-3.2.0.test.mjs
node tests/v320.test.mjs
node tests/bs-doc-map.test.mjs
node tests/run-310-view.mjs --out <empty-dir-1> --run release-3.1,c18,bs-doc-map
node tests/run-310-view.mjs --out <empty-dir-2> --run accept-rc1
node tests/run-310-view.mjs --out <empty-dir-3> --label scripts --overlay scripts/detect.mjs,scripts/migrate-security-paths.mjs --run accept-rc1
node tests/run-310-view.mjs --out <empty-dir-4> --label scripts+data --overlay scripts/detect.mjs,scripts/migrate-security-paths.mjs,data/secret-paths.json --run accept-rc1
```

Then run the format and version-stamp check from the repository root (the parent of
`project-setup/`):

```text
npm run check
```

The two labelled runs are the backward-compatibility runs: they run the 3.1.0 strict gate in the
view with the changed scripts, and then also the changed policy data, overlaid. `accept-rc1`
exits 1 in an overlay run by design; the runner compares the set of failure strings with the
pinned list of that label in `tests/fixtures/v320-compat-expected.json`, and an unlisted or a
listed but absent failure is a defect. Before each labelled run, confirm that `detect.mjs`
reports an empty `installerBackups`.

The first three run in the working tree. The historical gates (`tests/run-tests.mjs`,
`tests/accept-rc1.mjs`, `tests/release-3.1.test.mjs` and `tests/c18.test.mjs`) read the 3.1.0
scripts and data and are byte-pinned, so they run only through the view runner
`tests/run-310-view.mjs`, which reconstructs the 3.1.0 tree outside the repository; run directly
in the 3.2.0 working tree they are expected to fail. `--out` is an empty directory outside the
repository and outside the temp directory. For the `accept-rc1` gate only, the runner first adds
what the strict gate reads besides the skill files: the 3.1.0 `docs/plans/` records (taken from
the base commit) and a git repository holding the local `project-setup-v*` tags of the repository
it runs in plus one commit of the view. A repository without those tags cannot run that gate. CI does not run any of these gates: it runs only the
format check and the version-stamp guard, so the gates are enforced by whoever prepares the
release.

## Not measured

Nothing in this release has been measured on a host. In particular:

- The Codex reviewer rating the seeded unreachable money defect HIGH or CRITICAL with a block
  verdict under the new reviewer paragraph (the severity residual stays open in TODO.md).
- No false launch refusal by a Claude reviewer after the parent changed into a subdirectory, and
  what directory a subagent sees (the L16 residual stays open in TODO.md).
- Setup writing the partial-layer Subagents line and sentence after a declined docs-sync
  replacement, and a retained docs-sync obeying the managed-block rule of root AGENTS.md.
- Adopt and update producing the same applicable set, Configuration table and strictness statement.
- The `env/**` and `cert/**` denies on a host: the root-anchor claim is limited to static rendering
  (`Read(/env/**)` and `Read(/cert/**)` for Claude, the root-anchored Git pathspec excludes and the
  Codex snippet strings) until a host measurement covers root-anchor behaviour on both hosts.
- The host skill list with an installer backup present, and which backup directory shapes each
  host discovers.
- The 3.1.0 rows that were never measured (listed in RELEASE-NOTES-3.1.0.md, "Not measured").
- The duration of the strict gate (`accept-rc1` in the view) on an idle host, the data point for
  the acceptance timeout item in TODO.md (plan D10).

## Known limitations

- Moving the installer backup is manual; the backup still lands inside the skills directory, and
  whether Codex discovers it as a skill is unverified.
- The `v3.0.0` baseline is derived from a hash constant and the two added entries; a later change
  to an old shipped entry needs a new decision about prior baselines.
- The delegated-agent bullet narrows when a subagent refuses: a parent that wrongly continues after
  a real subdirectory start no longer gets a second refusal on working directory alone, though the
  subagent must state that the start directory was not given.
- The reviewer paragraph can report an intentional, uncalled stub in money code as likely risk.
- A later BS copy or re-sync can still overwrite consolidated 03 content and project-setup
  instructions or wrappers; the durable fix remains backend-standards 4.0.0 work.
- The backend-standards stamp behaviour differs between two existing-project runs; project-setup
  accepts both signals, and the decision belongs to backend-standards.
- Block-edit protection (A2) is instruction-level only. `apply.mjs prepare` does not require
  `--approve-user-content` to accept a draft that replaces an edited managed block (the normal
  `--approved-plan` approval at commit still applies): `validate.mjs` reports the edit as `edited-by-user` drift, and
  keeping it depends on setup following the keep, take new or merge rule. The plan's criterion that
  `prepare` exits 3 for such a replacement is not met; see TODO.md.
