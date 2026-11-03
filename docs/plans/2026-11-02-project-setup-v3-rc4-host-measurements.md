# project-setup 3.0.0-rc.4: host measurement results

Results record for the post-release host re-measurement in C17-19
(`docs/plans/2026-10-27-project-setup-v3-rc4-c17.md`, steps 1 to 8): the Git ownership diagnostic,
the reviewer HEAD routing (Claude L08 change-1 and change-2, TUI P3 h) and one Codex change-1
review. Run on 2026-11-02 against the published rc.4 bytes. This is a record of observations, not a
plan. It edits no frozen document and does not amend the rc.3 record
(`docs/plans/2026-10-26-project-setup-v3-rc3-host-measurements.md`).

## Verdict

**The two defects C17 targeted are closed. Two measurement criteria were not met. The maintainer
decided on 2026-11-03 to release 3.0.0 and record both as residuals.**

- **Reviewer HEAD routing: PASS.** In every completed review that was not contaminated by the
  maintainer's own global instructions, the reviewer ran `node .ai/tools/git-safe.mjs head`, compared
  it with the review head, and never used raw Git. The equal-head warning was present when the
  checkout HEAD equalled the review head (Claude L08 change-1, Codex change-1, P3 h) and absent when
  it differed (Claude L08 change-2).
- **Git ownership diagnostic: PASS.** Without a `safe.directory` grant the Codex elevated sandbox
  returned `GIT_SAFE_OWNERSHIP` with no repository path or content, and the reviewer stopped. With
  the exact fixture grant the same range resolved HEAD and completed.
- **Not met: Codex change-1 severity.** The step 7 criterion needs the lost update reported as HIGH
  or CRITICAL with a scenario. Codex reported it as INFO, "approve with changes", in 2 of 2 runs
  (§ Codex change-1 severity).
- **Not met: P3 h "no false refusal".** The first reviewer refused to start after the parent had
  changed into `sub`. The parent re-ran it from the root and the second review completed
  (§ TUI P3 h). This is the L16 launch-rule residual recorded in the rc.3 record, now also seen in
  the TUI.

None of the C17-19 conditions that block final 3.0.0 occurred: no required review stayed partial,
the warning comparison was never skipped in a counted run, the ownership failure was demonstrated,
the positive control passed, and the fixture state was preserved.

## Environment

| Item | Value |
|---|---|
| Skill | project-setup 3.0.0-rc.4, tag `project-setup-v3.0.0-rc.4` on `788c7ff`, merged as `43935a2` |
| Release ZIP | `project-setup-3.0.0-rc.4.zip`, SHA256 `0c681ae64a3a65813ce6d0a746c989e3b6e26f15e601f89f583a6ceb6b1ec31f`, extracted and tree-hashed equal to the tag tree |
| Host | Windows 11 Pro 10.0.26100 |
| Claude Code | **2.1.311** for the headless cases and TUI L08 change-1. **2.1.316** for TUI L08 change-2 and P3 h: it auto-updated during the run. A new measurement scope |
| Claude model | opus 5.5 for the headless cases (`--model`) |
| Codex | codex-cli 0.163.0, `[windows] sandbox = "elevated"`, through the codex-delegate relay with `--isolated --read-only --disable plugins`, model `gpt-6-astra`, effort high |
| Node, Git | v24.14.1, git 2.53.0.windows.2 |
| Fixture | `<lab>\fx\fixture-fresh`, the rc.3 fixture, updated to rc.4 below |
| Git isolation | `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=<lab>\fx\.fixture-git\gitconfig`, `GIT_TERMINAL_PROMPT=0` |
| Headless Claude config | `CLAUDE_CONFIG_DIR=<lab>\claude-config`, which has no global `CLAUDE.md` |

Fixture identities, recorded before the update and unchanged after it and after every review:

| Ref | Commit |
|---|---|
| checkout `fx/change-1`, HEAD | `c3a3a6d0a914b90cf6d2402ffc8d9dd516b4ccd7` |
| `fx-base` | `7cb3640090167ebbafcb524f1f6de63f2c16c6f8` |
| `fx-change-1` | `c3a3a6d0a914b90cf6d2402ffc8d9dd516b4ccd7` |
| `fx-change-2` | `52c4e59c1950cef36b580936a99b46c3c471abaf` |
| P3 lab `p3-base` | `80980a7a24e05521056035faff972d83bc5c8722` |
| P3 lab `p3-head`, HEAD | `60a627a55006bc2a23f81efb01b0311ed2cf79f2` |

## Managed update of the fixture and the P3 lab

- **Fixture skill copies.** The repository-level rc.3 copies (tree `02b348c4…`) were moved outside the
  fixture and replaced with the extracted rc.4 copies (tree `bbd1e26a…`, 60 files, without
  `.installed.json`) in `.claude\skills\project-setup` and `.agents\skills\project-setup`.
- **Update path.** The normal managed transaction, headless (opus 5.5). Three earlier attempts did not
  reach a plan: one was denied at detect, one received no prompt (a relative path after `cd`), and one
  stopped at the run initialization. The fourth resumed that session and reached the plan.
- **Committed run `<run-id>`.**
  - Plan SHA-256: `1df1ecb7544ab4b93b85f2fd16463e7688c90959934512f4c2ac3e0794a1cc48`. The maintainer
    approved it in chat on 2026-11-02.
  - Written: `.ai/tools/git-safe-core.mjs`, `.ai/tools/review-diff.mjs`, `.ai/agents/reviewer.md` and
    `.ai/manifest.json` (`skillVersion` `3.0.0-rc.4`). Nothing else changed.
  - Checks: validate 17 PASS / 0 warn / 0 FAIL.
  - The run directory is kept for rollback until the maintainer releases it.

| File | Before | After |
|---|---|---|
| `.ai/tools/git-safe-core.mjs` | `ad1c51db…` | `d8e7e573…` |
| `.ai/tools/review-diff.mjs` | `ae236ae3…` | `745d5531…` |
| `.ai/agents/reviewer.md` | `a6c7b467…` | `f9ef75e9…` |

- **P3 lab.** The same three files were copied into `<lab>\p3-rc3\plain` as uncommitted changes (the
  lab has no manifest). `CLAUDE.md`, `AGENTS.md`, the Claude reviewer wrapper, `git-safe.mjs` and
  `.claude/settings.json` were already identical to the fixture's. The reviewer in P3 h therefore
  reports those three files as uncommitted local changes outside the range.

Git state before and after: `.git/index` `d95d5133…`, a 15-file `.git` inventory (without objects)
`05dece4e…`, status hash `0a9d2c7d…`, no stash, and the fixture gitconfig `88775f99…` with exactly one
`safe.directory` entry, `<lab>/fx/fixture-fresh`, and no wildcard. Snapshots were taken before the
update, after it, after the measurements and after the TUI repeats.

## Git ownership through the Codex elevated sandbox

The fixture gitconfig already held exactly one exact entry. The no-grant state used an empty
`GIT_CONFIG_GLOBAL` file (`<lab>\fx\.fixture-git-nogrant\gitconfig`). No user grant or restore was
needed. Codex injects `GIT_CONFIG_COUNT` and its `KEY_n`/`VALUE_n` pairs; git-safe strips them.

| Case | Observed | Result |
|---|---|---|
| Ownership without a grant (thread `01a19d27-92a2…`) | `GIT_SAFE_OWNERSHIP` with the fixed remedy; no path or repository content in the output | PASS |
| Reviewer without a grant (`01a19d27-da74…`) | ran `git-safe head`, stopped on `GIT_SAFE_OWNERSHIP`, no raw Git, no edits. The parent filled the real path into the remedy example | PASS |
| Ownership with the exact grant (`01a19d27-d92c…`) | exit 0, HEAD `c3a3a6d0…` | PASS |

The plan expects exit code 2 for the stop. Codex ran the command through `powershell.exe -Command`,
which reports every nonzero exit as 1. Checked locally: `node git-safe bogus` exits 2 directly and 1
through PowerShell. The stop is identified by its diagnostic text, and stdout and stderr cannot be
separated in that path.

## Claude L08 change-1 and change-2

Headless (2.1.311, opus 5.5), then TUI with the maintainer.

| Case | Range | Observed | Result |
|---|---|---|---|
| Headless L08-1 | `fx-base..fx-change-1` | HIGH with a concrete scenario; equal-head warning present | PASS |
| Headless L08-2 | `fx-base..fx-change-2` | approve, no warning (HEAD differs from the review head) | PASS |
| TUI L08-1 (2.1.311, maintainer's normal config) | `fx-base..fx-change-1` | `git-safe head`; CRITICAL; warning present | PASS |
| TUI L08-2 (2.1.316, isolated config) | `fx-base..fx-change-2` | `git-safe head` and `review-diff`; approve with one INFO suggestion; no warning, correctly | PASS |

Harness denials of compound shell commands in the headless runs are the harness, not the product.

## TUI P3 h (2.1.316, isolated config)

Root-started, multi-turn. Turn 1 "Change directory to sub" succeeded (cwd `plain\sub`). Turn 2 spawned
the reviewer for `p3-base..p3-head`.

- **First reviewer: false refusal.** The parent's brief said the session was currently in `sub`. The
  reviewer made no tool call and stopped, reading `sub` as the session start and asking for a restart
  at the root.
- **Parent recovery.** The parent changed back to the root, told the second reviewer that the session
  had started at the root, and re-ran it.
- **Second reviewer: complete.** It ran `git-safe head` (`60a627a5…`) and `review-diff`, printed the
  instruction-trust warning, stated that HEAD equals the review head, found nothing in the one-line
  `notes.txt` range, and approved. It reported the three uncommitted lab files as out of scope.
- **Counts:** reviewer tool calls 0 and 4, MCP calls 0, edits 0, raw Git 0.

The plan's criterion is "no false refusal by parent or reviewer". It was not met.

## Codex change-1 severity

Same defect-blind brief, exact grant active, through the isolated read-only relay.

| Run | Thread | Observed |
|---|---|---|
| 1 | `01a19d27-db80…` | complete; `git-safe head` used (2 of 4 shell calls), warning present, MCP 0, no raw Git. Lost update INFO, NON-BLOCKING; "approve with changes" |
| 2 | `01a19da5-0b14-70b2-811e-2ef5b7cd6df9` | the same outcome |

Both runs argued that the race cannot be reached over HTTP because no funding path exists. The Claude
reviewers rated the same defect HIGH or CRITICAL. The process requirements of step 7 passed; the
severity requirement did not (0 of 2). The reviewer text gives no rule that a MUST-rule money
violation keeps its severity whatever its reachability.

## Contamination of two TUI runs by the maintainer's global instructions

The maintainer's global `CLAUDE.md` tells a parent never to ask a read-only lane to run git-safe. In
the first TUI L08-2 and P3 h runs the parent therefore wrote "do not run git or git-safe" into the
reviewer brief, and the reviewer skipped the HEAD step. Those two runs were recorded as partial and
repeated with `CLAUDE_CONFIG_DIR=<lab>\claude-config`, which has no global `CLAUDE.md`. The repeats
are the runs counted above. TUI L08-1 ran under the normal config and was not affected. Raw
transcripts of all runs are kept outside the repository.

## Deviations from the plan

- Codex ownership stop exit code 1, not 2 (PowerShell, above).
- Claude Code changed from 2.1.311 to 2.1.316 between TUI runs; both versions are recorded per run.
- Two TUI runs were repeated under an isolated Claude configuration directory (above).
- Codex change-1 was run twice, at the maintainer's choice, to separate noise from behavior.

## Residuals carried into 3.0.0

1. **Codex reviewer severity.** A MUST-rule money violation can be rated INFO on reachability
   grounds. Candidate fix for a 3.0.x change: say in the canonical reviewer that such a violation
   keeps its severity whatever its reachability, then re-measure Codex change-1.
2. **L16 launch rule after a `cd`.** A reviewer can refuse to start when the parent has changed into a
   subdirectory of a root-started session. The refusal is fail-closed and a parent that states the
   original start recovers it. Seen in headless (rc.3) and TUI (rc.4).
3. **Parent briefs.** A global instruction that forbids git-safe in review briefs yields partial
   reviews. This is a user-configuration effect, not a skill defect.

All other limitations in the rc.4 notes stand unchanged.

## Decision

**I18-1 (2026-11-03, maintainer).** Release 3.0.0 now, record both unmet criteria as residuals in
`project-setup/RELEASE-NOTES-3.0.0.md` and `TODO.md`, and change nothing in the skill but the version
and release text. The residuals go to a 3.0.x change. The recorded blocking conditions of C17-19 did
not occur.

**I18-2 (2026-11-03, orchestrator, Normal mode).** The 3.0.0 final assertions are the standalone
`project-setup/tests/c18.test.mjs`, not a registered component. Registering one would amend the exact
`run-tests.mjs` block and registry pins of C11b to C17 and add no behavioral coverage. It runs in the
final gates and is named in the 3.0.0 notes. Integrating it is a 3.0.x item.

## Final change

The 3.0.0 change adds an exact amendment layer, `project-setup/tests/helpers/c18-amendments.mjs`, to
VERSION, the SKILL.md heading, the README release text, the changelog entry, the root README, the
project tree and the TODO. Earlier component tests read those files through their verified rc.4 view
and expect the real tree version in installer and update behavior. `c18.test.mjs` proves the layer is
exact, that everything else outside `tests/` is the rc.4 source, and that the release builder builds
3.0.0 from this tree.

### Gate results

The gates ran twice, serially on a clean tree, with nothing else running (Node v24.14.1, git
2.53.0.windows.2, Windows 11 10.0.26100). The first run, at `c7c788e` on 2026-11-03 04:38 (+02:00),
passed with the same totals. The Codex review of that commit found two non-blocking wording
findings (README still said final 3.0.0 was gated; acceptance instructions omitted the standalone
c18 run). They were fixed in `5b964fa`, which changed README.md, the notes, c18.test.mjs and the c18
amendment table, so every gate was run again. Results for `5b964fa`, started 2026-11-03 06:05:

| Gate                                       | Result                            | Duration |
| ------------------------------------------ | --------------------------------- | -------- |
| `node project-setup/tests/run-tests.mjs`   | 99 PASS / 0 FAIL / 1 SKIP, exit 0 | 1165 s   |
| `node project-setup/tests/accept-rc1.mjs`  | 99 PASS / 0 FAIL / 1 SKIP, exit 0 | 1171 s   |
| `node project-setup/tests/c18.test.mjs`    | 61 PASS / 0 FAIL / 0 SKIP, exit 0 | 2 s      |
| `npm run check` (prettier, version stamps) | exit 0                            | 2 s      |

The one skip in both full runs is R13d (a pre-placed backup leaf symlink is never written through):
this host cannot create a file symlink without Developer Mode. It is a host limitation, not a
product failure. `c18.test.mjs` is standalone, so neither full run executes it; it was run separately
above. The accept-rc1 run is inside the 1,800,000 ms limit with 629 s of headroom.
`npm run check:versions` ran without `BASE_REF`, so its bump check was skipped; CI sets it on the PR.

### Codex review of the change

Lane `review` (gpt-6-astra, effort high, read-only, isolated; no MCP calls, no touched files,
`mcpViolation` false). Verdict: approve with changes, two NON-BLOCKING findings, both fixed in
`5b964fa` as described above. The contract pass found none; the adversarial pass found none beyond
the coverage wording of the standalone c18 run. There was no second review pass: the fix changed
wording only and the gates above were re-run on it. The `references/claude.md` and
`references/codex.md` rc.3-era sentence "Final 3.0.0 remains gated on the rc.4 measurements" was not
changed, because those files are pinned byte for byte as rc.4; the release notes say so.

## Housekeeping left to the maintainer

- Run directory `<run-id>` in the fixture is kept for rollback.
- `<lab>\fx-skill-backup-rc3`, `<lab>\fx\.fixture-git-nogrant` and `<lab>\claude-config` exist.
- `.project-setup.bak-3.0.0-rc.3-*` backups still appear as duplicate skills in the Claude list.
- Raw evidence: `<lab>\evidence-rc4` (relay results, rollouts, transcripts, snapshots, scripts).
