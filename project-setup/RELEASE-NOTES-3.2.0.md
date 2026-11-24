# project-setup 3.2.0

Release 3.2.0 closes findings 1 to 10 of the 3.1.0 live acceptance record
(`docs/plans/2026-11-22-project-setup-v3.1-live-acceptance-results.md` of the distribution
repository), the two 3.0.x reviewer residuals and the stale documentation and procedure items.
It is the first release after 3.0.0 that changes runtime files.

RELEASE-NOTES-3.1.0.md routed these fixes to "3.1.x". They ship in 3.2.0 instead, because two of
them are additive changes that every installed project sees: two new shipped deny patterns become
a coverage decision on update, and the canonical reviewer and the mapping reference gain new MUST
rules. Nothing here requires a project to change code.

The live measurements D1 to D10 of the release plan were run on 2026-11-24, headless, on one Windows
host (Claude Code 2.1.330, codex-cli 0.163.0). Each row, with its date, versions, range, observed or
inferred invoked definition and unverified scope, is in
`docs/plans/2026-11-22-project-setup-v3.2.0-live-results.md` of the distribution repository. See
"Measured" and "Not measured" below; behaviour that is not listed under "Measured" is intended
behaviour, not observed behaviour.

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
```

Then run the format and version-stamp check from the repository root (the parent of
`project-setup/`):

```text
npm run check
```

The labelled run is the backward-compatibility run: it runs the 3.1.0 strict gate in the
view with the two changed scripts overlaid. `accept-rc1` exits 1 in an overlay run by design;
the runner compares the set of failure strings with the pinned list of that label in
`tests/fixtures/v320-compat-expected.json`, and an unlisted or a listed but absent failure is a
defect. Before the labelled run, confirm that `detect.mjs` reports an empty `installerBackups`.
A second run that also overlays `data/secret-paths.json` is not part of the release gate: the
3.1.0 gate hard-codes the 20-entry policy (entry count, coverage decision ids 0, 7 and 18,
anchor `any` for every omission), so it fails in four components for that reason alone, and
pinning those failures would hide later ones. The 3.2.0 policy data is covered by
`tests/v320.test.mjs` (the A4 criteria) instead.

The first three run in the working tree. The historical gates (`tests/run-tests.mjs`,
`tests/accept-rc1.mjs`, `tests/release-3.1.test.mjs` and `tests/c18.test.mjs`) read the 3.1.0
scripts and data and are byte-pinned, so they run only through the view runner
`tests/run-310-view.mjs`, which reconstructs the 3.1.0 tree outside the repository; run directly
in the 3.2.0 working tree they are expected to fail. `--out` is an empty directory outside the
repository and outside the temp directory. The runner itself writes only under `--out`, apart from one
private directory under the operating system's temp directory that holds the bootstrap's git
configuration and is removed when the bootstrap ends, and it only reads the repository it runs in;
the bootstrap ignores the user's git configuration, so a global `safe.directory` entry is not used;
the gates it starts are not confined to `--out`: they write their
own fixtures and evidence (`ps-tests-*`, `ps-accept-rc1-*`, `ps-r31-*`, `ps-c18-*` and `ps-bsmap-*`
directories) under the operating system's temp directory, which the runner neither redirects nor
removes. For the `accept-rc1` gate only, the runner first adds
what the strict gate reads besides the skill files: the 3.1.0 `docs/plans/` records (taken from
the base commit) and a git repository holding the local `project-setup-v*` tags of the repository
it runs in plus one commit of the view. A repository whose `project-setup-v2.0.0` tag is missing, or does not name a commit, cannot run
that gate; the runner stops before any gate with a bootstrap failure that names the tag. CI does
not run any of these gates: it runs only the format check and the version-stamp guard, so the gates are enforced by whoever prepares the
release.

## Measured

All rows come from one Windows host and one version pair (one to six runs per row; the counts and cases
are in the results record), driven headless with the maintainer's human gates answered by the
orchestrator (a recorded deviation); each is a widening of the claim, not a guarantee.

- Reviewer money severity: two Codex samples on the seeded unreachable lost update both rated it HIGH
  with a scenario and a block verdict under the 3.2.0 reviewer text, installed by copy and invoked by
  name (the invocation is inferred) (D1). The earlier 3.0.x runs are
  not directly comparable because their seed wording was not recorded.
- Delegated launch rule (headless only; the project's agents block was not the 3.2.0 text in that
  fixture): after the parent changed into a subdirectory the Claude reviewer completed
  and stated whether the original start directory was given; a session really started in a
  subdirectory was refused by the parent; the unchanged 3.1.0 text reproduced the false refusal in the
  same setup; a subagent sees the changed directory as its primary directory (D2).
- Partial-layer lines after a declined docs-sync replacement were written as specified, and a retained
  docs-sync named the managed block it edited (the invoked definition is inferred from the parent's
  agent call and file hashes); a later update offered keep, take new or merge and the full line
  replaced the exception (D3, D4). The helper still reported one to two findings in those
  runs (an inventory fact whose document PS had skipped, and an unobserved invocation), so a clean
  helper run is not claimed.
- Update from a recorded PS 3.0.0 then backend-standards 3.1.0 project: the same eight-pointer set in
  Phase 0 and Phase 1, validate 16 pass, 0 fail (D5, update leg only). The helper reported one finding
  there: PS reworded a sentence in 03 beyond the approved text and the sentence still quotes the stale
  PORT value.
- env/** and cert/**: the policy migration report on a 3.1.0-style policy offered exactly two coverage
  rows (run through the script, not inside a PS update session); after include a Claude Read of a root env/ path and of a root cert/ path was denied, the root env/
  also after a cd into a subdirectory,
  while src/env/x and sub/env/x stayed readable; a tracked root env/x file is the detect stop (D6).
- Installer backups: detect warned per tool with a real backup present and stayed silent after the
  move (the synced claude.ai copy stayed visible as a second source); install.mjs rollback worked on
  both targets; Claude Code lists a dot-prefixed backup that has a SKILL.md, Codex does not (its own
  listing, a self-report), and a nested SKILL.md is listed by Codex only (D7, D8).
- Missing destination: a read-only reviewer left every file unchanged on both hosts, Claude reporting the
  three dangling pointers and Codex noting one missing heading as a documentation gap, and a Claude
  docs-sync recorded an unresolved destination in TODO.md instead of writing the fact elsewhere; the
  invoked definitions are inferred (D9 b, c).
- The strict gate took 1271 s in the reconstructed view, 99 pass, 0 fail, 1 skip (D10).

## Not measured

- The interactive TUI: the L16 launch rule in the TUI (P3 h, the surface where the defect was first
  seen, so the fix is measured headless only) and every interactive default-mode row.
- Codex: the L16 rule, runtime enforcement of the env/** and cert/** denies, every Codex PS row, the
  Codex documentation-writing missing-destination case and the project-context question of the P4
  check (inconclusive: the self-report quoted the user-level instructions). The root-anchor claim for
  Codex is limited to static rendering (the root-anchored Git pathspec excludes and the Codex snippet
  strings); for Claude it is measured only for root-started sessions, with and without a later cd.
- Adopt and update producing the same applicable set from one source: only the update leg ran, so
  the claim that the applicability, inventory and strictness rules hold identically in every mode has
  no live evidence beyond that leg and a separate adopt on another source.
- The policy migration for a project already migrated to keys ownership, and a full PS session on a
  project with a tracked root env/ file.
- The overwrite branch of the PS-first recovery.
- A loaded host for the strict gate, and other Claude Code or codex-cli versions for every row.
- The 3.1.0 rows that were never measured and are still open (RELEASE-NOTES-3.1.0.md, "Not
  measured"): the Codex PS rows and the interactive default-mode rows listed above, and the P8 Codex
  ownership grant.

## Known limitations

- Moving the installer backup is manual; the backup still lands inside the skills directory, and
  Codex 0.163.0 did not list a dot-prefixed backup with a top-level SKILL.md in its own listing (a
  self-report); other versions and platforms, and a Codex listing after the move, are unverified.
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
- The view runner (`tests/run-310-view.mjs`, test tooling only) has four residuals that the last
  Codex review rated non-blocking: a direct caller of `bootstrapStrictGate` through a junction to a
  literal trailing-dot Windows directory is not re-validated after resolution (the command line is
  protected by the check in `buildView`); `buildView` lists tracked and untracked files with the
  user's git configuration, so a global exclude can change the copied set for files outside the
  pinned manifest (for example an untracked file under `backend-standards/templates/` with
  `--include-untracked`); a failure to remove the bootstrap's temporary configuration directory is
  not reported; and the bootstrap's source reads still honour the source repository's own local
  configuration and its includes.
