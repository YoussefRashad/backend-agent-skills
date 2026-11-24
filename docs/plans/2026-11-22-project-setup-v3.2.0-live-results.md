# project-setup 3.2.0: dated live measurement results (D1 to D10)

Status: evidence record for the stage-2 sign-off of release 3.2.0. Frozen plan:
`docs/plans/2026-11-22-project-setup-v3.2.0-plan.md`, section 8. It is not an acceptance verdict by
the maintainer; the maintainer's review of this record and of the sign-off change is the decision.
Dated 2026-11-24 (the plan's file date 2026-11-22 is the date the plan was written).

Evidence lives outside the repository, in fixtures and scratch directories under `D:/ps-live` and
`D:/ContactRepos/codex-fixtures` (JSONL transcripts, evidence files, verify outputs). Nothing here is
reproduced from them beyond the figures quoted below. Transcripts were summarised by the orchestrator;
agent self-reports are labelled as such. No secret or canary content is quoted.

## Common record (applies to every row unless a row says otherwise)

- Host: Windows 11, Node v24.14.1, Claude Code 2.1.330, codex-cli 0.163.0. Parent model for the Claude
  rows: claude-opus-5-5. Codex model for the reviewer rows: gpt-6-astra, effort high.
- Skill copy: the user-level project-setup 3.2.0 candidate (installed from branch head 26763b8; see the
  installer incident below). The synced claude.ai copy (3.1.0) was switched off per project with
  `skillOverrides` in the fixture's `.claude/settings.local.json` for every PS row; it is still visible
  in a default session and `detect.mjs` warns about it (the maintainer replaces it at release).
- Launch directory: the fixture root unless a row says otherwise; new sessions. The multi-turn PS rows
  (D3, D4, D5) resume the same session id with `--resume` between the skill's decision points.
- Drive: headless `claude -p --permission-mode auto --output-format stream-json --verbose`.
  Agent rows use `--setting-sources project,local`; PS rows use `user,project,local` because the skill is
  user-level. The global delegation-protocol mode gate was answered in the prompt ("Normal"). The human
  gates of the PS flow were answered by the orchestrator as maintainer proxy: this is a recorded
  deviation, the same one the 3.1.0 headless rows made. Interactive default-mode behaviour was not
  exercised (see D9 g).
- Codex rows: through the codex-delegate relay, review lane, isolated (`--ignore-user-config`, apps and
  plugins disabled), read-only sandbox, no MCP connectors. Fixtures live under
  `D:/ContactRepos/codex-fixtures`, which carries the CodexSandboxUsers entry. An "Access is denied" or
  git failure inside the sandbox is a setup failure, not a measurement; such runs are listed and not counted.
- Cost per Claude run is the parent result event (it includes subagents): turns, USD, input per turn
  = (input + cache read + cache creation tokens) / turns. Codex result files carry none of these.
- "Observed" means seen in a tool result or a file on disk; "inferred" means concluded from other
  observations. An invoked agent definition is inferred when only the parent's Agent call and the file
  hashes show it.

## Summary

| Row | Subject | Result |
|---|---|---|
| D1 | Codex reviewer, seeded unreachable lost update, 2 samples | met 2/2 |
| D2 | L16 launch rule (headless, probe, controls) | met headless, with a recorded deviation from the prerequisites (the agents block was not updated, files orchestrator-copied); the TUI, where the defect was first seen, is unmeasured |
| D3 | Declined docs-sync replacement, then completion | partly met: criteria on the lines met, "0 findings" not met (2 then 1) |
| D4 | Retained BS docs-sync, block rule, then PS update | met |
| D5 | Adopt versus update parity | update leg only; parity NOT established; the 0-findings clause was not met on the update leg (1 inventory finding, stale PORT value in a PS-reworded 03 sentence) |
| D6 | env/** and cert/** offer and effect | Claude deny effect met; the offer was seen through the migration script only, not in a PS update session; Codex runtime and the migrated project not run |
| D7 | Detect with real installer backups | partly met: detect warnings, the move out and back, and rollback passed; "the host lists one project-setup" was not established (Claude also listed the synced claude.ai copy, no Codex listing after the move was recorded) |
| D8 | Backup directory discovery shapes | measured for both hosts |
| D9 | 3.1.0 rows never measured | (a) inconclusive; (b) met on both hosts; (c) met on Claude; (d) not run; (f) not run; (g) not measurable by me |
| D10 | Strict-gate duration | 1271 s, 529 s headroom |

## D1 Codex reviewer on the seeded unreachable lost update

- Fixtures: `D:/ContactRepos/codex-fixtures/d1-reviewer-1` and `-2` (clones of the bs-existing baseline
  fda7370, branch `fixture`); the Lock order unit of the acceptance document is in 03. Launch directory:
  the fixture root. Relay review lane.
- Installed definition: the 3.2.0 canonical `.ai/agents/reviewer.md`, copied from the candidate's assets
  and committed in the fixture (observed in git; this is an orchestrator copy, not a PS update). Invoked
  definition: INFERRED (the relay prompt named the reviewer and the run read that file; the relay event
  stream was not independently checked for the read).
- Sample 1 (range ending at the seed commit): status completed. HIGH BLOCKING on the wallet transfer
  with a scenario and evidence citing the Lock order rule, a second HIGH on money arithmetic, verdict block.
  Fixture unmodified.
- Sample 2 (range 824ee0e..da38c82): status completed. Three HIGH BLOCKING (lost update with scenario, failed
  credit, money arithmetic), verdict block, stating it blocks even without a current caller. Fixture clean.
- Result: criterion met in 2 of 2 (HIGH with scenario and block verdict). Not comparable with the earlier
  2026-11-14 and 2026-11-22 runs, whose Lock order wording was not recorded.
- Unverified: other Codex versions and models, the Claude reviewer on this seed, a definition installed
  through a real PS update, interactive Codex, and whether Codex saw the user-level code-review skill
  (the plan asks for its presence to be recorded; it was not observed, the runs were isolated by flags that
  are meant to hide user configuration). Sample 1 did not have its range hashes recorded.

## D2 L16: reviewer launched after the parent changes into a subdirectory

- Fixture: `D:/ps-live/d2-l16/service` (bs-existing df0299b plus one commit with the 3.2.0 `claude` block and
  the 3.2.0 canonical reviewer, copied by the orchestrator; the AGENTS.md agents block was not updated).
  Range fda7370..df0299b. Control fixture `D:/ps-live/d2-l16-pre/service` (unchanged 3.1.0 text).
  Agent runs, setting sources project,local, auto permission mode.

| Case | Setup | Observed | Turns / USD / input per turn |
|---|---|---|---|
| c1 | root start, no cd | parent passed the original start directory in the brief; reviewer completed, CRITICAL and HIGH, verdict block | 2 / 0.953 / 67903 |
| c2 | root start, then `cd src` | parent's brief stated the original start directory and that `cd src` is not a subdirectory start; reviewer completed, verdict block | 3 / 0.859 / 70212 |
| c3 | negative control: process started in `src` | parent refused before reading any file and asked for a restart from the root | 1 / 0.088 / 41614 |
| p1 | probe: after `cd src`, a general-purpose subagent reports its environment | primary working directory = the cd'd `src`; the root appears only under additional working directories | 3 / 0.780 / 69183 |
| c4 | stress: `cd src`, brief withheld the start directory | reviewer wrote that the brief did not state the start directory, did not refuse, completed, verdict block | 3 / 0.766 / 70027 |
| c5 | control: same as c4 on the unchanged 3.1.0 text | reviewer REFUSED on its own cwd (L16 reproduced), parent surfaced the refusal | 3 / 0.536 / 68951 |

- Result: no refusal by parent or reviewer after `cd`; the reviewer completes and states whether the start
  directory was given; the negative control is refused by the parent; c5 reproduces the false refusal on
  the old text in the same setup. The probe records, for Claude Code 2.1.330, that a subagent sees the cd'd
  directory as primary.
- Deviations from the plan prerequisites, all recorded: the fixture's AGENTS.md agents block was NOT updated to
  the 3.2.0 text and the 3.2.0 `claude` block and reviewer were copied by the orchestrator, not applied by a PS
  update; the project had no global CLAUDE.md only by construction (setting sources project,local), not verified
  separately; the probe ran one of the three planned cases (after `cd src`) and did not report the loaded CLAUDE.md
  paths; in c1 and c2 the parent stated the original start directory in the brief, and whether it did so unprompted
  or because of the 3.2.0 `claude` block alone was not separated.
- Not measured: TUI P3 h (I cannot drive the interactive TUI; the L16 defect was first seen there, so the fix is
  measured headless only), other Claude Code versions and models,
  a non-auto permission mode, a PS-updated real project, Codex L16, a brief that states a start directory
  strictly below the rule directory (the refusal-unchanged branch).

## D3 and D4 declined docs-sync replacement, retained docs-sync, completion

- Fixture: `D:/ps-live/d3/service`, clone of bs-existing at d107c5d, branch `d3-adopt`. Launch directory the
  fixture root. Skill copy 3.2.0 (synced copy off). The first adopt turn stopped by itself because both
  copies were active (observed: the duplicate-copy stop works); the counted run is the next session.
- D3 part 1, adopt (run ps-20261124-a2e8, plan 1eeb0cee...): reviewer wrapper taken, docs-sync replacement
  DECLINED (file kept byte for byte, bound as an unchanged input); 27 ops; validate 16 pass, 0 warn, 0 fail.
  CLAUDE.md carries the docs-sync-retained Subagents line and AGENTS.md the matching exception sentence
  (observed in the produced files). Turn cost: 22 turns 1.80 USD (stopped), 41 / 4.98, 6 / 5.39, 6 / 5.89.
  `verify --expect-partial`: 35 checks clean, 2 findings: (1) the prettier-style inventory fact omitted
  (a consequence of code-patterns.md being skipped as starter-only plus my evidence still holding a style
  fact), (2) the docs-sync keep result needs the invoked definition, not yet observed at that point.
  Criterion "0 findings": NOT met as run.
- D4, retained BS docs-sync seeded with `seed --case docs-sync` (range 2c2927b..2eb19f3, invoked
  definition inferred from the parent's Agent call and the file hash): it edited four files, including one
  managed block (AGENTS.md block `overview`), and its report named the file and the block id and said the
  next project-setup update would show the edit. Criterion met. Parent run 4 turns, 1.33 USD.
- D3 part 2 and D4 part 2, PS update after committing that result: validate warned once (the overview drift),
  and PS offered keep, take new and merge for the edited block (criterion met). Decisions: overview take
  new, docs-sync take new (rules R4, R6 to R9, R11 moved to `docs-sync.project.md`), 5 ops (plan 4f1894f0...),
  validate 16 pass, 0 warn, 0 fail afterwards. Result files: the full Subagents line, the exception sentence
  absent. `verify` without the flag: 37 checks clean, 1 finding (prettier-style). Criterion "0 findings":
  NOT met; "full line, no sentence": met.
- Observations, not fixed: CLAUDE.md still says docs-sync keeps `known-deviations.md` true after rule R10 was
  dropped; a docs-sync.project.md bullet is stale after the same drop; a new session's loading of the
  installed hook was not canary-tested; I adapted the evidence inventory from the 3.1.0 evidence file.
- Unverified: Codex, interactive default mode, a maintainer-independent inventory, other seeds.

## D5 adopt versus update parity (update leg only)

- Fixture: `D:/ps-live/d5/upd`, the ps-first lineage of the 3.1.0 acceptance at aab0993 (PS 3.0.0 fresh setup,
  planted PORT contradiction, BS 3.1.0 existing-project with project extensions; wrappers unchanged). Run
  ps-20261124-atk9, plan 0d1ad663..., 18 ops (plan file hash and op list checked on disk).
- Phase 0 provisional list: eight pointers (two replaced, six new), integrations and decisions not applicable,
  code-patterns and development-rules stay full. Phase 1 confirmed the same set. Prepare stopped to ask
  `--approve-user-content` for `.ai/security-paths.json` as well as 03 and `known-deviations.md` (the policy
  ownership changes from full to keys through the coverage migration); approved.
- Commit exit 0, validate 16 pass, 0 warn, 0 fail, hook self-test passed (that proves the script, not that
  Claude loads the hook). 03 grew from 291 to 307 lines. Costs: 33 turns 2.14 USD, 28 / 4.25, 3 / 4.52, 6 / 4.98.
- `verify`: 42 checks clean, 1 finding: stale-value-retained for the PORT default, because the 03 preamble,
  reworded by PS beyond the approved text, still quotes the stale 8080 (the helper's documented limitation,
  and also a PS-authored sentence outside the decisions). The first verify run showed three more findings
  that were my evidence choices (a generic token, one wrong location for a moved fact, no explained paths
  for approved changes); they were corrected in the evidence, not in the project.
- The criterion also asks for 0 checker findings on both legs; the update leg has one, so the row could not have
  been met as written even with an adopt leg. The "applies identically in every mode" claim of A3, A7 and A8 has
  no live evidence beyond this update leg and the separate D3 adopt.
- NOT established: parity. The adopt leg was not run on this source. D3's adopt used the bs-existing source,
  a different lineage whose applicable set differs by construction. A BS-only fixture from the ps-first
  scaffold needs a BS existing-project run, not done.
- Unverified: parity on one source, Codex, interactive mode.

## D6 env/** and cert/** offer and effect

- Method deviation: no PS session; the installed 3.2.0 scripts were run directly on clones of the untouched
  bs-existing baseline (a fresh 3.0.0/3.1.0-style install: baseline v3.0.0, 20 entries).
- Offer: `migrate-security-paths.mjs report` returned baseline `v3.0.0`, 20 entries kept without decisions and
  exactly two coverage rows (root `env/**`, root `cert/**`). A decision file with `include` for both staged
  without error. The staged drafts were copied into the fixture, not applied through `apply.mjs`.
- Effect on Claude (one process per case, project,local sources, auto mode, root start): a Read of `env/`,
  a Read of `cert/`, and a Read after `cd src` of the root `env/` were all DENIED by the permission settings;
  a Read of `src/env/x` and of `sub/env/x` were allowed; the unpatched control allowed the root read. The
  canary string appeared in the transcripts of the allowed cases only. 2 to 3 turns, 0.37 to 0.40 USD each.
- Tracked file: `detect.mjs` on a clone with a committed `env/x` and `src/env/y` warned that secret-pattern
  files are tracked and to stop, naming `env/x` only. This is detect's stop condition; a full PS session
  was not run.
- Codex: `render-permissions.mjs codex-snippet` lists `env/**` and `cert/**` as deny and the pathspec
  excludes carry both. Codex RUNTIME behaviour: NOT RUN (the deny-read profile needs the user config; the
  relay run is config-free). The migrated (`keys`) project: NOT RUN.
- Unverified: Codex enforcement, the PS wording of the offer in a live session, other Claude Code versions.

## D7 detect with real installer backups

- A real installer backup per tool was created (observed: an accidental install, see the incident), detect
  warned per tool, and the Claude session showed the backup directory in its own skill list.
- Moved out (not deleted): detect showed an empty `installerBackups` and no backup warning; a new session
  listed one user-level project-setup (plus the synced claude.ai copy, a separate source).
- Moved back unmodified: detect listed both backups and warned per tool; `install.mjs rollback` exit 0 on both
  targets; the reinstall exit 0 and `install.mjs verify` exit 0. All leftovers were then moved out; both targets
  end at 3.2.0.
- Not covered: backups left inside the skills directory during rollback on other platforms, Windows only.

## D8 backup directory discovery shapes

Scratch directories created and removed in each host skills directory (removal verified).

| Shape | Claude Code 2.1.330 | codex-cli 0.163.0 |
|---|---|---|
| SKILL.md at the top of a directory | listed | listed |
| dot-prefixed, SKILL.md at the top (the real backup shape) | listed | not listed |
| SKILL.md nested one level | not listed | listed |
| no SKILL.md | not listed | not listed |
| dot-prefixed, no SKILL.md | not listed | not listed |

Claude Code lists by directory name; Codex by frontmatter name. Codex's answer is its own listing
(self-report). A dot-prefixed backup is already hidden from Codex but visible to Claude; a dot-prefixed
backup with SKILL.md nested one level is inferred, not measured, to be hidden from both.
Unverified: other versions, Windows only, project-level skill directories, plugin skills, symlinks.

## D9 rows of the 3.1.0 acceptance that were never measured

- (a) Codex P4 context check: INCONCLUSIVE. Both self-report probes quoted the first words of the user-level
  `~/.codex/AGENTS.md` and attributed them to the project path; the project AGENTS.md text was never quoted.
  A probe answerable only from project text was not run.
- (b) Read-only missing destination. Fixtures: the D3 final state with the heading "Money" removed from 03
  and the Lock order unit added; three pointers still name it. Claude (range 06ad397..7c4145d, reviewer via the
  parent's Agent call, definition inferred): verdict block, four HIGH, reported the three pointers to the removed
  heading, `git status` empty. 3 turns, 0.99 USD, 74334 input per turn. Codex (relay review lane; range
  4cd58bd..d2c3ad5): verdict block, three HIGH, noted the missing heading pointer as a documentation gap, no file
  modified. Two earlier Codex attempts failed on `GIT_SAFE_GIT` inside the sandbox (hard-linked git objects
  without the sandbox ACL) and are setup failures, not counted; the fixture was rebuilt with `--no-hardlinks`.
  Met on both hosts.
- (c) Documentation-writing missing destination. Fixture: D3 final state with "## 3. Configuration" renamed and
  a hand-made seed commit adding a config consumer (range c86d7ee..9bd0bb6; the helper's docs-sync seed refuses
  because its files exist). Claude docs-sync (definition inferred) changed four files including one managed
  block, named it by file and id, did NOT write the new configuration fact into 03, and recorded the unresolved
  destination and the new name in TODO.md. All four changed files were inspected afterwards: the new
  configuration name occurs only in TODO.md, not in 03, AGENTS.md or CLAUDE.md. 4 turns, 1.01 USD, 74448 input per turn. Met on Claude. Codex: NOT RUN
  (no Codex writing lane is configured on this machine; the read-only lanes may not be used for writing).
- (d) Codex PS rows (blank section, renamed heading, deleted pointer, local-instruction conflict, unchanged
  rerun): NOT RUN, same reason: a PS session writes files and there is no Codex writing lane.
- (e) Second Codex reviewer sample: covered by D1 sample 2.
- (f) Overwrite branch of the PS-first recovery: NOT RUN. It needs a BS run that chooses overwrite; the 3.1.0
  acceptance BS run chose project extensions, and a hand-made imitation would not measure the branch BS produces.
  The PS-side handling of a synthetic overwritten-wrapper input was not run either.
- (g) Interactive default-mode PS rows: NOT MEASURABLE BY ME. A probe with `--permission-mode default` in print
  mode blocked the first Write and offered no approval channel (2 turns, 0.13 USD); a PS run writes from its
  first apply step. Needs the maintainer in the TUI.

## D10 strict-gate duration

`node project-setup/tests/run-310-view.mjs --out <dir> --run accept-rc1` from head 26763b8 on the same host
(idle apart from the waiting orchestration session): `ACCEPT-RC1 PASS full`, 99 PASS, 0 FAIL, 1 SKIP.
Wall time 1271 s including view build and bootstrap, against the limit of 1,800,000 ms: 529 s (29.4 percent)
headroom. Earlier data points in TODO.md: 1435 s, 1540 s and 1318 s. The 1500 s revisit rule is not triggered.
Unverified: a loaded host, other machines.

## Incident: accidental install

During the implementation stage, `node install/install.mjs --help` performed a REAL install of the 3.2.0
candidate (from head 26763b8) into the user-level skill directories of both tools, because the installer has
no `--help` and treats an unknown flag as a plain run. It replaced 3.1.0 and created
`.project-setup.bak-3.1.0-<timestamp>` backups inside the skills directories (one was then listed as a skill by
this session). The backups were moved out, used for D7 (rollback and reinstall), and all leftovers now sit outside
the skills directories; both targets end at 3.2.0 and `install.mjs verify` exits 0. Nothing outside those two
skills directories changed. Lesson: never pass an unknown flag to `install.mjs`; the installer ignoring unknown
flags is a hazard worth its own fix (not part of 3.2.0).

## What stays not measured after this record

TUI P3 h; Codex L16; Codex runtime enforcement of env/** and cert/**; the migrated (`keys`) policy project;
adopt versus update parity on one source; Codex PS rows and the Codex doc-writing row; the overwrite branch
of the PS-first recovery; interactive default-mode PS rows; the Codex P4 project-context question; the
refusal-unchanged branch of the L16 rule; a loaded-host strict-gate duration.
