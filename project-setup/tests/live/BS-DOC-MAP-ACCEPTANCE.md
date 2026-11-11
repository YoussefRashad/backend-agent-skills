# project-setup 3.1.0 live acceptance: backend-standards documentation mapping

Plan: `docs/plans/2026-11-11-project-setup-v3.1-bs-doc-map.md` (section 8; section 12 wins on
conflict). Status: **pending evidence**. Nothing below has been run for 3.1.0 yet; stage 2 of the
plan records the dated results and the TODO closeout after this acceptance.

This document is the maintainer's procedure. The test-only helper
`tests/live/bs-doc-map.mjs` creates workspaces, records snapshots, seeds committed changes and
checks the state a run left. It never installs, switches or restores a skill copy, never writes
global or system Git configuration, never grants a `safe.directory`, never reads `.env*` files,
secrets or policy-denied paths, and never repairs what backend-standards (BS) wrote. Copying
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

Before **every** PS run:

1. Resolve duplicate plain, synced or plugin-provided copies.
2. Start a new host session at the fixture root (never `--continue`).
3. Confirm exactly one active PS copy, its selected path and its version in the host's skill list.
4. Record that evidence and the installer verification.

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

## 5. Exact prompts

Instantiate with actual paths, installed versions and printed ranges:

- **PS 3.0.0 baseline:** "Run the installed project-setup 3.0.0 on this fixture through its normal approval workflow. Generate evidence-backed project documentation."
- **BS existing-project:** "Apply the installed, unchanged backend-standards skill using its 'Applying this to an EXISTING project' procedure. Treat this as an existing service and follow its normal review requirements."
- **Candidate update:** "Run the installed project-setup 3.1.0 candidate in detected update mode. Assess documentation mapping, show per-file drift and recovery dispositions, and consolidate approved facts through the normal reviewed transaction."
- **Candidate adoption:** "Run the installed project-setup 3.1.0 candidate in detected adopt mode. Assess the BS documentation layout and show provenance and replacement dispositions before applying."
- **Docs-sync:** "Run `<actual agent name>` for `<printed range>`. Update affected documentation under the installed project instructions. Report files changed and unresolved gaps."
- **Reviewer:** "Run `<actual agent name>` on `<printed range>`. Follow installed project instructions and report findings with severity and file:line. Do not modify files."

Do not instruct BS to preserve or overwrite specific PS files to force an observation.

## 6. Committed changes for the agent measurements

```powershell
node project-setup/tests/live/bs-doc-map.mjs seed --project D:\ps-live\bs-docmap-3.1.0-ps-first\service --case docs-sync
node project-setup/tests/live/bs-doc-map.mjs seed --project <separate fixture>\service --case reviewer
```

The docs-sync seed lands an error-contract and configuration-consumer change without updating 03.
The reviewer seed commits a money/locking defect whose detailed lock-order rule exists only in
03. The helper prints the base and head IDs and the agent range. Use an independent fixture for
every host and agent case; never measure the second host against documentation the first one
corrected.

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

## 8. Rollback

Roll back a project transaction with `node <SKILL_DIR>/scripts/apply.mjs rollback --run-id <id>`;
on PS-first it returns to the post-BS state. Roll back the installed skill (user-performed):

```powershell
node "$psCandidate\install\install.mjs" rollback --targets claude,codex --claude-dir "$psClaudeSkills" --codex-dir "$psCodexSkills"
```

Then restore the preserved original of step 0 if the newest backup is not it, verify, and confirm
one active copy in a new session. Do not rerun PS 3.0.0 on a consolidated project.
