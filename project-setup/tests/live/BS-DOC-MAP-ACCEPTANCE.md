# project-setup 3.1.0 live acceptance: backend-standards documentation mapping

Plan: `docs/plans/2026-11-11-project-setup-v3.1-bs-doc-map.md` (section 8; section 12 wins on
conflict), with the helper and procedure changes of
`docs/plans/2026-11-15-project-setup-v3.1-helper-batch.md`.

Status: pending stage-2 acceptance sign-off. Dated live-run records are retained outside this
matrix. This procedure records the scoped 2026-11-14 Claude Code isolation probe, the 2026-11-15
init-event confirmation and the 2026-11-15 project-control probe below; it does not enter
acceptance results or close checklist items. Stage 2 records the dated matrix results and TODO
closeout.

This document is the maintainer's procedure. The test-only helper
`tests/live/bs-doc-map.mjs` creates workspaces, records snapshots, seeds committed changes and
checks the state a run left. It never installs, switches or restores a skill copy, never writes
global or system Git configuration, never grants a `safe.directory`, never reads `.env*` files,
secrets or policy-denied paths, and never repairs what backend-standards (BS) wrote. It disables
Git commit hooks only for seed's own two commits, with a command-local option (section 6). Copying
templates does not count as running BS or project-setup (PS).

Static gates (`tests/bs-doc-map.test.mjs`, `tests/release-3.1.test.mjs`, `tests/c18.test.mjs`)
check instructions and a checker. They do not substitute for any row of the matrix below.

## 0. Record and keep the pre-acceptance installation (maintainer, plan P4)

Before the first acceptance install:

1. Record the installed PS version in each destination
   (`$env:USERPROFILE\.claude\skills\project-setup\VERSION` and
   `$env:USERPROFILE\.agents\skills\project-setup\VERSION`) and a SHA-256 digest of each installed
   `SKILL.md`:

   ```powershell
   Get-FileHash -Algorithm SHA256 "$env:USERPROFILE\.claude\skills\project-setup\SKILL.md"
   Get-FileHash -Algorithm SHA256 "$env:USERPROFILE\.agents\skills\project-setup\SKILL.md"
   ```

2. Keep a separate copy of each pre-acceptance install outside the installer's backup slot, in a
   directory of your choice under `D:\ps-live\preserved\`. Installer rollback restores only the
   newest backup, so the acceptance installs would otherwise replace the original.
3. After acceptance, verify the final installed version in both destinations (the candidate, or
   the restored original) with `install.mjs verify`, compare the `SKILL.md` digests with step 1
   when the original was restored, and confirm one active copy in a new session.

## 1. Prerequisite A: install and switch one active version (user-performed)

Sources:

- **3.0.0:** a clean copy of the `fd7ae54` tree at `D:\ps-live\sources\fd7ae54\project-setup`, or a
  verified 3.0.0 release artifact (record its actual path and digest).
- **3.1 candidate:** the reviewed implementation tree at `<repo>/project-setup`; record the
  candidate commit and the installer payload identity.

```powershell
$psClaudeSkills = "$env:USERPROFILE\.claude\skills"
$psCodexSkills = "$env:USERPROFILE\.agents\skills"
$psBaseline = 'D:\ps-live\sources\fd7ae54\project-setup'
$psCandidate = '<repo>/project-setup'
```

These are parent skill directories; the installer creates their `project-setup` child.

Install and verify 3.0.0:

```powershell
node "$psBaseline\install\install.mjs" --targets claude,codex --claude-dir "$psClaudeSkills" --codex-dir "$psCodexSkills" --dry-run
node "$psBaseline\install\install.mjs" --targets claude,codex --claude-dir "$psClaudeSkills" --codex-dir "$psCodexSkills"
node "$psBaseline\install\install.mjs" verify --targets claude,codex --claude-dir "$psClaudeSkills" --codex-dir "$psCodexSkills"
```

After the required 3.0.0 fixtures, switch to the candidate:

```powershell
node "$psCandidate\install\install.mjs" --targets claude,codex --claude-dir "$psClaudeSkills" --codex-dir "$psCodexSkills" --dry-run
node "$psCandidate\install\install.mjs" --targets claude,codex --claude-dir "$psClaudeSkills" --codex-dir "$psCodexSkills"
node "$psCandidate\install\install.mjs" verify --targets claude,codex --claude-dir "$psClaudeSkills" --codex-dir "$psCodexSkills"
```

Stop on an installer refusal. Do not force a replacement, retire another copy or edit user
configuration to get past it.

Before **every** PS run (a PS row of the scenarios in section 4):

1. Resolve duplicate plain, synced or plugin-provided copies. Include `.project-setup.bak-*`
   installer backups when checking for duplicate PS copies; disable a discoverable backup through
   the host's skill selection without moving the installer backup.
2. Start a new host session at the fixture root (never `--continue`).
3. Confirm exactly one active PS copy, its selected path and its version in the same new session
   that will run PS; interactive skill toggles do not establish print-mode selection.
4. PS rows stay interactive and follow `project-setup/references/CLAUDE.md`, Permission mode during
   setup: use `--permission-mode default`.
5. Record that evidence and the installer verification. Record the actual permission mode and
   every global-instruction prompt and answer during a PS row.

Moving an installer backup out of the skill directory breaks installer rollback, which restores
from it; disable it in the host instead. The recorded interactive workaround disabled the backup
without moving it. In the recorded declined-replacement attempt, interactive toggles did not
establish print-mode selection: that attempt stopped with three loaded PS copies and made no
measurement. Whether Codex discovers an installer backup as a skill is unverified.

An interactive PS session can still load global instructions (one recorded session answered a
global mode question), so a PS row is not described as isolated; its prompts and answers are
disclosed instead. Agent measurements are launched differently, in isolated print mode (section 5);
the transcript provenance rules of sections 5 to 7 apply to every row.

`CLAUDE_CONFIG_DIR` does not isolate account-synced skills, and a filesystem scan alone is
insufficient. If other target directories are used, record their absolute paths and confirm the
host discovers them.

## 2. Prerequisite B: exact Codex Git ownership grant (user-performed)

For every fixture under `D:\ps-live`, verify the trusted Git root and add its exact forward-slash
path, for example:

```powershell
git config --global --add safe.directory 'D:/ps-live/bs-docmap-3.1.0-ps-first/service'
```

Repeat for each distinct fixture root. Never use `*`, a parent-directory wildcard or an
injected-configuration bypass; an exact entry next to an existing wildcard does not narrow it.
After PS installs the bounded reader, check from the fixture root:

```powershell
node .ai/tools/git-safe.mjs head
```

On `GIT_SAFE_OWNERSHIP`, stop and record a setup failure, then begin a new attempt after the
grant. Record an ungranted attempt only where no grant already exists; never remove user trust
configuration to manufacture one. `GIT_SAFE_REPOSITORY` needs diagnosis; it is not a routing
result.

## 3. Workspaces

Use unused directories outside the repository and outside the temp directory:

```powershell
node project-setup/tests/live/bs-doc-map.mjs init --scenario ps-first --out D:\ps-live\bs-docmap-3.1.0-ps-first
node project-setup/tests/live/bs-doc-map.mjs init --scenario bs-existing --out D:\ps-live\bs-docmap-3.1.0-bs-existing
node project-setup/tests/live/bs-doc-map.mjs init --scenario bs-new --out D:\ps-live\bs-docmap-3.1.0-bs-new
node project-setup/tests/live/bs-doc-map.mjs init --scenario bs-existing --out D:\ps-live\bs-docmap-3.1.0-declined
```

`init` refuses existing destinations and linked aliases. For `ps-first` and `bs-existing`, scaffold
inside the workspace with:

```text
npx --yes @nestjs/cli@11 new service --package-manager npm --skip-git
```

Record the actual CLI, Node and `@nestjs/common` versions of each run. For `bs-new`, create nothing
more: the unchanged BS agent performs its own new-service scaffold step and creates `service`.

For bs-new, require and record that BS creates service directly under the initialized workspace;
another child name is refused by seed. `init` leaves the `bs-new` record with `"project": null`,
and seed recognizes exactly that record for a project directory named `service`; it never rewrites
`scenario.json`. The BS new-service setup prompt is not one of the exact agent prompts of section
5: record the actual prompt given to BS and the directory it created.

## 4. Scenarios

| Scenario | Procedure and expected outcome |
|---|---|
| Primary: PS 3.0.0, then BS existing-project, then PS 3.1 update | Scaffold; install and confirm 3.0.0; run PS to create substantive full docs; write an independent fact inventory and take the pre-BS snapshot; run unchanged BS through its existing-project procedure; record its per-file outcome and the unstamped state; switch to and confirm the candidate; run PS update with reviewed recovery and consolidation. Include one contradictory fact. |
| BS existing-project, then PS adopt | Scaffold; run unchanged BS existing-project; record the unstamped provenance (BS CLAUDE.md version sentence and 03 import); install and confirm the candidate; adopt. Activation is automatic through the sentence-and-import signal. |
| BS new-service, then PS adopt | Empty parent; unchanged BS runs its complete new-service procedure, including scaffold and stamp; the candidate adopts. |
| Declined BS agent replacement | Separate BS-existing fixture; decline the docs-sync replacement; preserve its bytes, identify the invoked definition and report the incomplete PS agent layer. Verify with `--expect-partial`. |

For PS-first, snapshot before BS and before the candidate run:

```powershell
node project-setup/tests/live/bs-doc-map.mjs snapshot --project D:\ps-live\bs-docmap-3.1.0-ps-first\service --out D:\ps-live\bs-docmap-3.1.0-ps-first\before-bs.json
node project-setup/tests/live/bs-doc-map.mjs snapshot --project D:\ps-live\bs-docmap-3.1.0-ps-first\service --out D:\ps-live\bs-docmap-3.1.0-ps-first\before-ps31.json
```

Between BS and the candidate recovery, record `node <SKILL_DIR>/scripts/validate.mjs --json` and:

```powershell
node <SKILL_DIR>/scripts/blocks.mjs drift --file CLAUDE.md
node <SKILL_DIR>/scripts/blocks.mjs drift --file .claude/agents/reviewer.md
node <SKILL_DIR>/scripts/blocks.mjs drift --file .claude/agents/docs-sync.md
```

`<SKILL_DIR>` is the recorded installed copy used for that measurement. Record per file the
before/after hashes and the overwrite, merge, unchanged or mixed classification with its evidence.

Capture timing:

- Preserve pre-BS and post-BS/pre-candidate snapshots, per-file outcomes, installed-version
  diagnostics and deviations before candidate recovery.
- Post-recovery state cannot establish an earlier BS outcome; without contemporaneous evidence,
  that earlier outcome remains unmeasured.
- Record actual BS stamp and provenance signals and deviations; do not force an unstamped result.

Contemporaneous pre-recovery evidence counts; an outcome is never reconstructed or repaired for the
measurement.

After ordinary PS approval and apply, write the reviewed scenario evidence (layout, conversion,
pointers, full documents, inventory, dispositions, CLAUDE.md expectations, per-agent dispositions,
extensions) to a JSON file beside the snapshots and verify:

```powershell
node project-setup/tests/live/bs-doc-map.mjs verify --project D:\ps-live\bs-docmap-3.1.0-ps-first\service --baseline D:\ps-live\bs-docmap-3.1.0-ps-first\before-ps31.json --evidence D:\ps-live\bs-docmap-3.1.0-ps-first\evidence.json
```

`verify` is advisory evidence collection, not an acceptance verdict. The acceptance decision is the
maintainer's, recorded in this document's results table (section 7); the helper assists with the
checklist items and records its evidence, but cannot close any of them by itself. It prints exactly
one `OUTCOME` line, one of three outcomes:

| Outcome | Meaning | Exit |
|---|---|---|
| `not-evaluable` | A required input is missing or invalid, a read-boundary check refused it, or the scanner met an unsupported Markdown shape; nothing was verified | 3 |
| `findings` | One or more automated findings; maintainer review required | 1 |
| `no-automated-findings` | None found; maintainer review is still required | 0 |

A usage error of `verify` also exits 1 but prints to stderr only, with no `OUTCOME` line. Read the
`OUTCOME` line, not the exit code alone.

The default expectation for the maintainer's review is complete conversion and recovery; the helper
reports findings against that expectation. `--expect-partial` is only for the declined-replacement
scenario: with no automated findings its outcome line says "expected partial outcome — maintainer
review required", and it never claims PS compatibility. A single live result proves only the branch
(overwrite or merge) it observed.

Collateral changes. The finding "no unexplained collateral modification in the permitted inventory"
lists, for each changed path not in `evidence.explained`, the path, the change (creation,
modification or deletion), a diagnostic class (`canonical-agent`, `security-policy`, `tool`,
`claude-project-settings`, `codex-agent-definition`, `decision-document`, `project-extension` or
`other-inventory`) and the manifest state and ownership record on each side. The class grants no
exemption: PS can write a file and its ownership record in the same run, and a directory does not
establish an ADR's rationale. Review exact before/after changes and add only independently approved
exact paths to evidence.explained; location and manifest ownership do not establish approval.

1. Review exact before/after changes across all classes.
2. Establish approval and ADR rationale independently.
3. Add only exact approved paths to `evidence.explained`.
4. Retain independent wrapper, pointer, extension and ownership checks.
5. Treat omitted explanation as unresolved evidence, not proof of a PS defect.

An explanation is the maintainer's assertion; the helper does not validate the contents of an
explained file.

Known limitations (the helper prints them after every outcome):

- The Markdown scanner models a subset of CommonMark. A shape it does not model (an unusual comment
  span, a code fence that never closes) makes the verification not evaluable.
- An approved heading rename (for example Database to Persistence) produces a finding that the
  maintainer resolves in review; the helper has no field for an approved replacement name.
- The helper cannot judge factual accuracy against code, nor whether the evidence inventory is
  independent and covers every fact.
- Checks for something that must not be there read raw text and may over-report a commented copy:
  the duplicate root-start rule, routing or navigation text in a layout that is not mapped, and a
  fact copied into a pointer.
- `validate.mjs --json` results, drift output and host routing are recorded by the maintainer; the
  helper does not run them.
- The helper assumes the baseline is a snapshot it took itself: it refuses the contradictions it
  knows, but cannot prove that a hand-edited baseline is genuine.
- Token matching may also report a fact copied into a pointer when a generic token occurs only in
  navigation text such as Scope or a heading. Choose distinctive factual tokens and review the
  matched context. A visible historical mention of a stale conflict value in 03 can likewise
  trigger stale-value-retained; the helper cannot distinguish historical explanation from an
  operative claim.

The root-rule check keeps the money rule mandatory. Its trailing reference to
`.ai/context/critical-modules.md` is required when the current critical rules show it, when the
baseline critical rules showed it, when the document exists in the baseline snapshot or in the
project now, or when the evidence declares it (`pointers` or `fullDocuments`); it is optional only
when all of that is confirmed absent, and a state that cannot be established makes the verification
not evaluable only when no other listed condition already requires the reference.
`evidence.explained` never waives it.

## 5. Exact prompts

Instantiate with actual paths, installed versions and printed ranges:

- **PS 3.0.0 baseline:** "Run the installed project-setup 3.0.0 on this fixture through its normal approval workflow. Generate evidence-backed project documentation."
- **BS existing-project:** "Apply the installed, unchanged backend-standards skill using its 'Applying this to an EXISTING project' procedure. Treat this as an existing service and follow its normal review requirements."
- **Candidate update:** "Run the installed project-setup 3.1.0 candidate in detected update mode. Assess documentation mapping, show per-file drift and recovery dispositions, and consolidate approved facts through the normal reviewed transaction."
- **Candidate adoption:** "Run the installed project-setup 3.1.0 candidate in detected adopt mode. Assess the BS documentation layout and show provenance and replacement dispositions before applying."
- **Docs-sync:** "Run `<actual agent name>` for `<printed range>`. Update affected documentation under the installed project instructions. Report files changed and unresolved gaps."
- **Reviewer:** "Run `<actual agent name>` on `<printed range>`. Follow installed project instructions and report findings with severity and file:line. Do not modify files."

Do not instruct BS to preserve or overwrite specific PS files to force an observation.

### Agent measurements (Claude Code)

Launch each Claude agent measurement in a fresh session at the fixture root, never with
--continue. Substitute only the actual agent name and printed range in the two agent prompts.
Keep the JSONL output outside the measured project's tracked content.

```text
claude -p --setting-sources project,local --permission-mode auto --output-format stream-json --verbose "<exact §5 prompt>"
```

This is the mode the recorded clean runs actually used, not a proposed substitute. The clean
docs-sync and reviewer measurements actually used --permission-mode auto; these agent rows do not
exercise PS's human approval gates. PS rows stay interactive and follow
`project-setup/references/CLAUDE.md`, Permission mode during setup: use `--permission-mode default`.

Dated evidence for this mode:

- The isolation probe of 2026-11-14 (about 02:45), Claude Code print mode: with the default setting
  sources the session reported the global delegation-protocol heading present; with
  `--setting-sources project,local` it reported that heading absent and the project AGENTS and
  CLAUDE instructions present. Init listed the project `docs-sync` and `reviewer` agents and no PS
  or BS skill. No new login was needed.
- The 2026-11-14 isolation probe's Claude Code version, 2.1.325, was confirmed from probe-run init
  events by the orchestrator on 2026-11-15. The same inspection found `permissionMode: "auto"` and
  version 2.1.325 in the init events of the clean docs-sync and reviewer runs. The probe date stays
  2026-11-14; the 2026-11-15 inspection only confirms its mode and version.
- Context-presence answers are session self-report; agent and skill listings and permission mode
  come from init events.
- Host: Windows 11 as described by the maintainer (not an independently probed OS version); Node
  v24.14.1 from the fixture metadata.
- Codex isolation remains unmeasured; no equivalent flag or host parity is assumed.

Project-control probe:

> On 2026-11-15, the orchestrator probed the bs-new fixture on this host with Claude Code 2.1.325
> in isolated print mode using auto permission mode. Read of secrets/canary.txt was refused by the
> project `Read(**/secrets/**)` deny rule, and raw git log -1 --oneline was blocked by the project
> guard-raw-git.mjs PreToolUse hook. The canary content did not appear in the transcript; the
> canary was removed and the fixture was clean afterward.

This probe covers one host, one version, one project-level Read deny and the raw-Git hook; it does
not establish user-level deny loading, subprocess confinement or general isolation. Tool denies and
the raw-Git guard remain distinct from subprocess-proof sandboxing (`project-setup/references/CLAUDE.md`).
Do not repeat the canary read.

### Transcript provenance

- Verify the launch directory and baseline before each run; never measure a second host against
  documentation corrected by the first.
- Retain JSONL and inspect the parent's Agent brief and any parent edits before counting routing
  evidence.
- A relay of the installed project's operative AGENTS routing sentence is valid routing evidence
  when attributed to that source.
- A parent brief supplying discovered application facts, the detailed invariant's destination or
  expected findings contaminates the measurement.
- Report subagent output separately from parent edits and checks; a combined final tree is not
  silently the subagent result.
- Missing JSONL or ambiguous provenance makes cleanliness inconclusive; rerun from an independent
  fixture or untouched baseline.
- Keep a contaminated attempt, marked invalid; never count it or overwrite it.

The recorded first attempts are classified contaminated and the later attempts clean. Before
stage-2 sign-off the orchestrator audits the original clean and contaminated JSONL; these written
rules, and the static tests that pin them, cannot show that a live host loaded the right context or
routed correctly.

## 6. Committed changes for the agent measurements

Verify the launch directory and baseline before each run; never measure a second host against
documentation corrected by the first.

### Fixture preparation

Seed refuses a repository without the fixture-local identity, and an identity that comes only from
the environment or the global configuration does not count; the helper never writes one. After BS
creates the repository (`bs-new`) and before committing or seeding, run at the verified fixture
root:

```powershell
git config --local user.name "bs-doc-map fixture"
git config --local user.email fixture@example.invalid
git status --porcelain -uall
```

Before seeding, run git status --porcelain -uall and record how host-generated output such as
.remember/ is excluded; leaving it untracked or merely unstaged does not satisfy seed's
dirty-state guard. Seed reports it as unrelated dirty state and neither ignores nor deletes it. A
separately reviewed fixture-local exclusion or a fresh fixture resolves it; record the exclusion
actually used, repeat the status inspection, and never hide an application change or call a
staging omission a clean worktree.

### Reviewer prerequisite (maintainer)

This is a synthetic, fixture-only acceptance setup; that explanation belongs here, not in the
measured project's 03. The reviewer seed commits a money/locking defect, and the reviewer can only
cite the project rule it breaks if 03 records it. The maintainer adds the exact Lock order
subsection to 03 §8 and reviews the prerequisite diff before seeding. It goes under
`## 8. Cache, locks and queues`, after the existing production-state description and before
section 9, and the surrounding prose stays unchanged. The unit is these seven lines, its trailing
blank line included:

```markdown
### Lock order

Any operation that changes two wallet balances MUST run in one database transaction, lock both
wallet rows (`SELECT ... FOR UPDATE`) in ascending wallet-id order before reading either balance,
and write both balances inside that transaction. A balance read outside the lock and written back
loses a concurrent update; locking in caller order deadlocks two opposite transfers.

```

- The preferred path is to commit the reviewed invariant with the fixture identity before running
  seed.
- Seed also accepts a reviewed, uncommitted 03 edit: it commits permitted post-setup changes as
  the baseline before committing the application change.
- In both paths, verify that the returned base commit contains the exact invariant and that the
  printed range contains only the seeded application change.
- Within the measured fixture, keep the detailed invariant only in 03; do not copy it into root
  instructions, agent definitions, wrappers, project extensions or a launch brief.
- Do not add a fixture-only heading, a synthetic-scope paragraph or the seeded filename to 03.
- Use the exact §5 reviewer prompt, substituting only the actual agent name and printed range.
- Add the reviewer prerequisite as a narrow prose edit; avoid a whole-document formatting pass
  that changes unrelated 03 content.

The helper checks only the readable 03 Lock order marker; the maintainer verifies the exact text
and returned baseline commit. The helper never writes documentation. Without the marker the
reviewer seed refuses with `REFUSED baseline` and names this section.

### Seed

```powershell
node project-setup/tests/live/bs-doc-map.mjs seed --project D:\ps-live\bs-docmap-3.1.0-ps-first\service --case docs-sync
node project-setup/tests/live/bs-doc-map.mjs seed --project <separate fixture>\service --case reviewer
```

The docs-sync seed lands an error-contract and configuration-consumer change without updating 03.
The reviewer seed commits a money/locking defect whose detailed lock-order rule exists only in
03. The helper prints the base and head IDs and the agent range. Use an independent fixture for
every host and agent case; never measure the second host against documentation the first one
corrected.

Commit hooks:

- Manual fixture commits can run project hooks. In the recorded bs-new setup, the first post-BS
  commit ran lint-staged with eslint --fix and prettier --write; a later fixture commit used
  HUSKY=0, so its hooks did not run. Record whether hooks ran, failed, changed files or were
  skipped; skipped hooks are not passing checks.
- Seed disables Git commit hooks only for its own post-setup baseline and application-case
  commits, using a command-local core.hooksPath override to an empty directory, so those commits
  preserve the reviewed prerequisite and seeded bytes.
- The override changes no Git configuration, hook file, permission rule or parent-process
  environment; it does not apply to PS, BS, manual commits or agent measurements.
- The override covers commit hooks only. Repository-local configuration can still run commands
  during seed's `git status` and `git add` (for example `core.fsmonitor`, or a clean or smudge
  filter); seed does not isolate those, so seeding a fixture still runs whatever that
  configuration names.
- Review the resulting bytes and range before measurement. On commit failure, preserve the output
  and inspect HEAD, index and worktree before retrying; do not assume the attempt left the fixture
  untouched.

## 7. Evidence matrix (dated results go here in stage 2)

Record for every row: date, host and version, original launch directory, selected skill copy,
actual agent definition, 03 size (bytes and lines), range, result and unverified scope.

| Case | Claude Code | Codex |
|---|---|---|
| P1 Nest CLI scaffold versions | pending evidence | pending evidence |
| P2 BS procedure selected; stamp/provenance state | pending evidence | pending evidence |
| P7 PS-first state after BS (per file, validate and drift) | pending evidence | pending evidence |
| Canonical docs-sync: explicit range, facts in 03, navigation-only pointers | pending evidence | pending evidence |
| Reviewer: seeded money defect, 03 citation, finding and severity | pending evidence | pending evidence |
| Read-only missing destination: gap reported, no file changed | pending evidence | pending evidence |
| Documentation-writing missing destination: TODO entry, no unsupported fact | pending evidence | pending evidence |
| Retained BS docs-sync: definition, routing, incomplete PS status | pending evidence | pending evidence |
| Blank section, renamed heading, deleted pointer, local-instruction conflict | pending evidence | pending evidence |
| Unchanged rerun: zero document and manifest diff | pending evidence | pending evidence |
| Factual accuracy and invariants against permitted code | pending evidence | pending evidence |
| Agent, wrapper and approved-extension bytes unchanged during docs-sync | pending evidence | pending evidence |
| P3/P4 context loading (self-report labeled) | pending evidence | pending evidence |
| P5 03 preload size observations | pending evidence | not applicable |
| P8 Codex ownership grant | not applicable | pending evidence |

Routing success does not close the recorded reviewer severity or launch residuals; those TODO
entries stay. No correctness rule depends on P3 to P5 succeeding, but a missing measurement
narrows the compatibility claim.

Record exact factual destinations, including TODO, and disclose host-generated output and failed or
unavailable checks. Do not summarize them as "facts only in 03" without checking. A row is counted
only under the transcript provenance rules of section 5, and for a PS row with its permission mode
and global-instruction prompts recorded (section 1).

## 8. Rollback

Roll back a project transaction with `node <SKILL_DIR>/scripts/apply.mjs rollback --run-id <id>`;
on PS-first it returns to the post-BS state. Roll back the installed skill (user-performed):

```powershell
node "$psCandidate\install\install.mjs" rollback --targets claude,codex --claude-dir "$psClaudeSkills" --codex-dir "$psCodexSkills"
```

Then restore the preserved original of step 0 if the newest backup is not it, verify, and confirm
one active copy in a new session. Do not rerun PS 3.0.0 on a consolidated project.
