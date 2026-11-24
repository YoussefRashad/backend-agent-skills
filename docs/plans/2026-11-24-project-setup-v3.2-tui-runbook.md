# project-setup 3.2.0: TUI and Codex runbook for the rows only a person can run

Status: procedure for the maintainer, written 2026-11-24. It adds no result. Results of the headless rows
that could be closed are in `docs/plans/2026-11-24-project-setup-v3.2-unmeasured-items-results.md`. Record
anything you observe in a new dated file; do not edit a frozen plan or the 3.2.0 release notes.

Why a person: a headless `claude -p --permission-mode default` run has no approval channel (it blocks the first
Write, measured 2026-11-24), the L16 defect was first seen in the TUI, and no Codex writing lane is configured
on this machine (`~/.config/delegate-skills/config.json` maps only `review` and `review-sensitive` to Codex).
Each row takes a few minutes of your time once the fixture exists.

## 0. Setup (once, about 5 minutes)

1. Skills: exactly one active project-setup, the user copy 3.2.0. Run `node
   ~/.claude/skills/project-setup/scripts/detect.mjs` from a fixture root and read `installerBackups` (must be
   empty) and the duplicate-copy warning. The claude.ai synced 3.1.0 copy stays visible; switch it off per
   fixture with the `.claude/settings.local.json` the fixtures below already carry (`skillOverrides`
   `anthropic-skills:project-setup` = `off`). Start every session NEW at the fixture root, never `--continue`.
2. Fixtures (kept by the 2026-11-24 session under `D:\ps-live\u32`, each a git clone, nothing pushed):
   - `D:\ps-live\u32\d5-adopt\service`: scaffold plus backend-standards 3.1.0 existing-project (commit `688bff6`, the state
     BEFORE project-setup). The branch tip `9f8d5cf` is the same project after the 2026-11-24 headless 3.2.0 adopt.
   - `D:\ps-live\u32\d9f-ps-first\service`: project-setup 3.0.0 setup, planted PORT contradiction, then backend-standards 3.1.0
     with both wrappers overwritten (commit `408c3bb`, the state BEFORE the 3.2.0 update). The branch tip `6861636` is the
     project after the headless 3.2.0 update.
   Make a throwaway copy per row so a failed row costs nothing, checked out at the BEFORE commit:

   ```powershell
   git clone --no-hardlinks -n D:\ps-live\u32\d5-adopt\service D:\ps-live\tui\row-a
   Set-Location D:\ps-live\tui\row-a
   git config core.autocrlf false; git config user.name "bs-doc-map fixture"; git config user.email fixture@example.invalid
   git checkout -q 688bff6
   Copy-Item D:\ps-live\u32\d5-adopt\service\.claude\settings.local.json .claude\settings.local.json
   ```

   For row B use `d9f-ps-first` and `408c3bb`. Check the result against the headless results in the results file, which also
   records the per-file outcome of the backend-standards overwrite.

   Copy `.claude\settings.local.json` from the source fixture (it is untracked, so a clone does not carry it).
3. Global instructions: your global delegation protocol asks for a mode first. Answer "Normal" and record that you did.

## 1. Interactive default-mode PS rows (D9 g, 3.1.0 acceptance section 1 item 4)

Why: every PS row so far ran in auto mode; the human approval gates were answered by an orchestrator. This is
the only run where the Allow/Deny prompts are real.

Row A (adopt), fixture clone of `d5-adopt`:

```powershell
claude.cmd --permission-mode default
```

Prompt: `Run the installed project-setup 3.2.0 in detected adopt mode. Assess the backend-standards documentation layout and show provenance and replacement dispositions before applying.`

Expected observations (write each down):

- Phase 0 stops with one active copy (a duplicate-copy stop here means the synced copy is still on: fix the override and restart).
- Every script write or `apply.mjs` step shows a permission prompt; the status line never says "Allowed by auto mode classifier".
- PS asks the human decisions itself (pointer set, `--approve-user-content` items) and prints a plan hash before any commit; nothing is written to project files before you approve the hash.
- After commit: `node <SKILL_DIR>/scripts/validate.mjs --json` shows 0 fail; `git status` shows only the planned files.
- The applicable pointer set it proposes. The headless adopt of 2026-11-24 is in the results file; compare, do not copy.

Row B (update), fixture clone of `d9f-ps-first`, prompt: `Run the installed project-setup 3.2.0 in detected update mode. Assess documentation mapping, show per-file drift and recovery dispositions, and consolidate approved facts through the normal reviewed transaction.`
Extra expectation: PS names that backend-standards replaced both Claude wrappers (manifest hashes no longer match) and offers
recovery choices instead of overwriting silently.

Record per row: Claude Code version (`claude --version`), permission mode, count of permission prompts, every global prompt and answer,
plan hash, validate result.

## 2. L16 launch rule in the TUI (P3 h)

Run after row A or B has been committed in its clone (the clone then carries the 3.2.0 `claude` block). Pick a harmless range:
for row B use the two commits of any small docs change you add; you can reuse any `<base>..<head>` the clone has.

```powershell
Set-Location D:\ps-live\tui\row-a
claude.cmd --permission-mode default
```

Turn 1: `Change directory to src.` Require a successful directory-change event.
Turn 2: `Spawn the reviewer agent to review the range <base>..<head>.`

Do not correct a refusal before recording it; copy the exact parent brief (does it state the original start directory and the current one?).
PASS: neither the parent nor the reviewer refuses on the launch rule, the review completes with a verdict block, and the reviewer states
whether the original start directory was given. FAIL: any "started in a subdirectory" refusal. Control (expected refusal): quit, start a
new session with `Set-Location D:\ps-live\tui\row-a\src` and send turn 2 only; the parent must refuse before reading files.
Version of the earlier headless result for comparison: Claude Code 2.1.330, `docs/plans/2026-11-22-project-setup-v3.2.0-live-results.md` D2.

## 3. Codex P4 project-context check (inconclusive on 2026-11-24)

Why inconclusive: both probes quoted the first words of the user-level `~/.codex/AGENTS.md`. Use a question only the project text can answer.
Fixture: a clone placed under `D:\ContactRepos\codex-fixtures\tui\` (that directory carries the CodexSandboxUsers entry; check it first).

```powershell
git clone --no-hardlinks -n D:\ps-live\u32\d9f-ps-first\service D:\ContactRepos\codex-fixtures\tui\p4
Set-Location D:\ContactRepos\codex-fixtures\tui\p4
git checkout -q 6861636
codex --version
codex
```

(`6861636` is the project after the 3.2.0 update, so it has an `AGENTS.md` with a `Critical rules` block.) First, outside Codex, copy the exact
first bullet under the heading `Critical rules` of that `AGENTS.md`. Then prompt Codex, without letting it open files first: `Without running any command, quote the first bullet under the heading "Critical rules" in the AGENTS.md of this project, and say which file you got it from.`
PASS: the quote equals the project's bullet and the attribution names the project file. FAIL or inconclusive: it quotes `~/.codex/AGENTS.md` text or refuses to answer.
Record the codex-cli version and whether the user-level file's first words differ from the project bullet (they must, or the probe cannot discriminate).

## 3b. Codex runtime enforcement of the env/** and cert/** denies

The relay review lane cannot measure this: it is isolated (`--ignore-user-config`) and passes `--sandbox read-only`, and a
deny-read profile lives in the user config and is inactive under any legacy `--sandbox` setting. The 2026-11-24 relay run read
both canaries (see the results file). To measure the real thing, in a normal Codex session with the profile active:

1. Review `node ~/.claude/skills/project-setup/scripts/render-permissions.mjs codex-snippet`, paste the profile into `%USERPROFILE%\.codex\config.toml`
   yourself (the skill never does), and remove `sandbox_mode` / `[sandbox_workspace_write]` if present. Heed the fail-closed note in
   `project-setup/references/codex.md` (on the unelevated Windows sandbox Codex refuses to start with the profile; the 2026-11-24 host uses the elevated sandbox).
2. Fixture kept for this: `D:\ContactRepos\codex-fixtures\u32-envcert\service` (policy includes both paths; untracked canaries `env/canary-u32.txt`,
   `cert/canary-u32.txt`, harmless marker strings). Also create `src/env/x` and `sub/env/x` with a marker each (root anchor check).
3. `codex` at that root, prompt: `Try to read env/canary-u32.txt, cert/canary-u32.txt, src/env/x and sub/env/x with your shell tool; for each, report the first line or the exact refusal.`
4. Expected: the first two denied (and the marker absent from the transcript), the last two readable. Also run once from a subdirectory with `cd src`. Record `codex --version`,
   the sandbox backend Codex shows, and that you removed the profile afterwards if you do not want it permanently.

## 4. Codex PS rows and Codex documentation-writing case (needs a Codex session that may write)

Two ways, both yours: add a Codex writing lane with `delegate-setup` (then an orchestrator can run them through the relay), or run them by hand in the Codex TUI.
By hand, fixture clones of `D:\ps-live\rows\r1-unchanged`, `r2-blank`, `r3-renamed`, `r4-deleted-pointer`, `r5-local-conflict` (each a clone of the ps-first lineage with
the mutation committed; place them under `D:\ContactRepos\codex-fixtures\tui\`). In each, start `codex` at the root and give the section 5 update prompt plus "stop at each approval gate".
Expected (the Claude results of 2026-11-22 are the comparison): r1 proposes only clone-artifact consolidations and nothing is written when declined; r2 holds the blank section and
offers restore, restore plus unknown, or leave; r3 holds until a replacement for the renamed heading is approved and reports the stale route in `docs-sync.project.md`;
r4 does not recreate the deleted pointer silently; r5 finds the contradicting `src/AGENTS.md` and requires a resolution first. After each: `validate.mjs --json` 0 fail.
Doc-writing case: Codex docs_sync after a heading rename plus a seeded config consumer: expected a TODO entry, no new fact written into a document that lacks the destination.

## 5. P8 Codex ownership grant

Not obtainable as specified while the global git config holds a wildcard `safe.directory`: check with `git config --global --get-all safe.directory`. An exact entry next
to the wildcard does not narrow it, and removing the wildcard changes a trust setting for every repository you use, so this runbook does not ask you to. Leave the row as
"not obtainable" unless you decide otherwise; if you do remove it, restore it afterwards and record both states.

## 6. Cleanup

`D:\ps-live\tui` and `D:\ContactRepos\codex-fixtures\tui` are yours to delete (look first; `cmd /c rmdir` any junction before `Remove-Item`).
`D:\ps-live\u32` holds the evidence of the 2026-11-24 headless runs; delete it when you no longer need it.
