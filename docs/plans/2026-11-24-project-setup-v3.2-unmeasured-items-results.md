# project-setup 3.2.0: dated results for the items left unmeasured by the 3.1.0 and 3.2.0 live acceptances

Status: evidence record, not an acceptance verdict. It follows `docs/plans/2026-11-22-project-setup-v3.2.0-live-results.md`
(D1 to D10) and `docs/plans/2026-11-22-project-setup-v3.1-live-acceptance-results.md`, and closes what can be closed without a
person at a TUI. It changes no shipped byte and edits no frozen plan. Dated 2026-11-24. Repository base: main at d1fbb32
(tags project-setup-v3.1.0 and v3.2.0 exist). The TUI items are handed over in
`docs/plans/2026-11-24-project-setup-v3.2-tui-runbook.md`.

Evidence lives outside the repository: fixtures and JSONL transcripts under `D:/ps-live/u32` and
`D:/ContactRepos/codex-fixtures/u32-envcert` (kept for the runbook; see "Fixtures and cleanup"). Nothing is reproduced from them
beyond the figures quoted here. Agent self-reports are labelled as such. No secret is quoted; the only canary strings are two
harmless markers created for the Codex check and not repeated here.

## Common record

- Host: Windows 11, Node v24.14.1, Claude Code 2.1.330 (parent model claude-opus-5-5, headless), codex-cli 0.163.0 (gpt-6-astra,
  effort high). Installed skills (user level): backend-standards 3.1.0 (`SKILL.md` sha256 24d1a187...fe26), project-setup 3.2.0
  (`SKILL.md` sha256 f1a74c03...1483). The claude.ai synced project-setup 3.1.0 copy was switched off per fixture with
  `skillOverrides` in `.claude/settings.local.json`; it is still visible in a default session (`detect.mjs` reported one active copy
  in both PS sessions and no warnings). The synced backend-standards copy (3.1.0, identical) stayed enabled for the BS runs, as in
  the 3.1.0 headless BS runs.
- Drive: `claude -p --permission-mode auto --output-format stream-json --verbose`. BS runs: default setting sources, launch at the
  fixture root, new session. PS runs: `--setting-sources user,project,local`, one session per fixture resumed with `--resume`
  between the skill's decision points (a recorded deviation, the same as D3 to D5). The human gates of PS were answered by me as
  maintainer proxy, in my own words, in the prompts under `D:/ps-live/u32/logs/ps-*-t*.txt`; interactive default-mode behaviour was
  not exercised. The global delegation mode gate was answered "Normal" in each prompt.
- Cost per run is the parent `result` event (turns, USD, input per turn = (input + cache read + cache creation) / turns). In a
  resumed session the cost grows with the re-read context; each figure is for that turn only as the event reports it.
- "Observed" means seen in a tool result or a file on disk; "inferred" means concluded from other observations.

## Summary

| Item | Result |
|---|---|
| 1a D5 adopt versus update parity | measured on one source, one run per leg; confirmed pointer set and the three applicability checkers equal; provisional list NOT equal across the two update runs; "same applied tree" and "0 findings" NOT met |
| 1b D9 (f) overwrite branch of the PS-first recovery | measured: BS overwrote both wrappers (prompt-directed), PS 3.2.0 detected, offered keep/take new/merge, applied merge; "0 findings" not met (1 BS-authored line) |
| 2 Codex runtime check of `env/**` and `cert/**` | measured for the relay review lane only: NOT refused; the deny-read profile itself is NOT measured (blocked by the lane's isolation) |
| 2b Codex PS rows and Codex doc-writing case (D9 d, c) | blocked: no Codex writing lane is configured; not improvised |
| 3 TUI-only items | handed to the user: runbook written |

## 1a. D5 adopt versus update parity (2026-11-24)

Sources. Both legs start from the scaffold of the 3.1.0 ps-first fixture (`c030d61`, Nest CLI 11.0.24, `@nestjs/common` 11.2.9
from the fixture's `scenario.json`, the same code and the same `src/main.ts` with the PORT default 3000). The earlier D5 update fixture
(`D:/ps-live/d5/upd`) no longer exists, so its leg is not reused for the comparison; it is cited only as the earlier record.

- Adopt leg `D:/ps-live/u32/d5-adopt`: scaffold only, no project-setup files. Unchanged BS 3.1.0 headless existing-project run
  (prompt: the section 5 BS prompt plus a non-interactive clause, take the recommended option wherever it asks, Normal mode, do not
  push): 26 turns, 1.97 USD, 100033 input per turn, session 748cb69d, about 6 minutes. BS committed its own result (`688bff6`);
  it wrote no `.backend-standards.json` (it said the procedure's deliverable list does not include it) and skipped project-setup as
  optional. 03: 273 lines, 19693 bytes. Then PS 3.2.0 adopt (session b2eb3009), turns: Phase 0 21 / 1.85 USD, Phase 1 37 / 4.58,
  prepare 5 / 4.99, commit 4 / 5.31. Plan `99434b6e...4cf3` (sha256 of `plan.json` checked by me on disk, 32 ops checked).
  Commit exit 0, validate 16 pass, 0 warn, 0 fail, hook self-test 3 pass (this proves the script, not that Claude loads the hook).
  I committed the result in the fixture (`9f8d5cf`).
- Update leg `D:/ps-live/u32/d9f-ps-first`: the ps-first lineage at `97ef709` (PS 3.0.0 fresh setup `d1f25ae`, planted stale PORT
  default), then the same unchanged BS (see 1b), then PS 3.2.0 update (session 45a68e0d). This is the D9 (f) fixture, so its wrappers
  were overwritten by BS; the earlier D5 update leg had BS choose project extensions. The two update legs therefore differ in state.
  I used it as the update leg because it is the only update-lineage fixture of this session built from the same scaffold.

| Observation | Adopt leg | Update leg (this run) |
|---|---|---|
| Phase 0 mode | adopt, mapping active (provenance sentence at CLAUDE.md:70 and import at :26, no stamp) | update, mapping active (stamp, sentence, import) |
| Phase 0 recommended provisional list | eight pointers (project-tree, critical-modules, error-contract, configuration, glossary, api-conventions, database, observability); `docs/integrations/*` not applicable; decisions README skipped; code-patterns and development-rules written in full | SIX pointers recommended (Reading B: glossary and database dropped); Reading A (the literal rule) offered, equal to the eight |
| Confirmed set (Phase 1), after my D2 answer "checked None statements count as facts" | eight, identical to Phase 0 | eight (Reading A), identical to the list I approved |
| Applied tree | 32 changes; 8 pointers, 2 full documents, `reviewer.project.md` 83 lines, `docs-sync.project.md` 86, AGENTS.md created | 22 changes plus 3 metadata ops; the same 8 pointers, the 2 project extensions 69 and 63 lines, AGENTS.md changed in 4 blocks |
| 03 | 273 to 286 lines, 19693 to 20662 bytes (four consolidations D3 a to d) | 284 to 314 lines, 19829 to 21662 bytes |
| validate after commit | 16 pass, 0 warn, 0 fail | 16 of 17 pass, 0 warn, 0 fail; the 17th is the informational `.claude/settings.local.json` note |
| `verify` (helper): applicability, configuration inventory, strictness | no finding of their own | no finding of their own |
| `verify` totals | 45 checks clean, 1 finding | 45 checks clean, 1 finding |

Pointer comparison, made by me on disk: the eight pointer files have identical line counts (30, 37, 29, 29, 29, 30, 32, 30) and an
identical heading/bullet/table structure in both legs; one sentence differs (the Scope line of `docs/database.md`: "database,
entities and key relationships, the schema-change policy as practiced..." in the adopt leg against "ORM, entities and relationships,
the database change policy as practiced..." in the update leg). The full documents (`code-patterns.md`, `development-rules.md`)
differ in length and structure (59 and 47 lines against 38 and 33), which is by lineage: the update leg keeps the PS 3.0.0 documents,
the adopt leg writes new ones. Two files exist only in the update leg, `.backend-standards.json` and `.prettierignore`, both written by
BS in that run and not by PS. The 03 documents differ because each leg had its own independent BS run.

Helper findings (the criterion "0 findings" on both legs was NOT met):

- Adopt leg: `omitted` for the fact `target: ES2023` (present in `tsconfig.json:13`): the BS-authored 03 never recorded it and the
  PS adopt did not consolidate it, so it stands in no mapped section, full document or TODO item. Real.
- Update leg: `stale-value-retained` for the PORT default: BS's own sentence at 03 line 66 (written in BS commit `408c3bb`, before PS
  ran) mentions that nothing answered on 8080 when it booted the service. This is the helper's documented historical-mention
  limitation; PS wrote neither it nor an 8080 claim, and PS removed the stale 03 landmine row as decided.
- My own evidence errors, corrected and not counted (listed so the correction is visible): `.gitignore` listed as explained (outside
  the snapshot inventory, not evaluable); `extensions.approvedAppend` null (set to the produced files, the weaker precedent of D3,
  because the approved text is PS's own extraction of lines); a wrong full-document location for the spec-location fact; wrong
  locations for the compiler-option facts after PS moved them to 03 section 12; a token ("no ORM") that 03 words differently; a
  token ("returns a bare string") that 03 words differently. Evidence files: `D:/ps-live/u32/*/evidence.json`, outputs
  `verify-1..4.txt`.

Result: partial parity. Equal: the confirmed pointer set (eight), the structure and size of the eight pointers, the three checker
verdicts, validate. NOT equal or not established: the provisional list (adopt recommended eight, this update run recommended six;
the earlier update run of the same day recommended eight, so the recommendation is not stable across runs on near-identical
evidence; the cause is not isolated: wrapper state, session variance or both), the applied tree as a whole (different BS runs and
lineages by construction), and 0 findings on either leg. Parity "on one source" in the sense of plan section 8 is therefore NOT
established, only observed to hold for the confirmed set.

Unverified: more than one run per leg; adopt on a source that has PS 3.0.0 docs (not constructible without PS files, which is
the update path); Codex; interactive mode; whether BS is deterministic about the stamp (see 1b).

## 1b. D9 (f) overwrite branch of the PS-first recovery (2026-11-24)

Fixture `D:/ps-live/u32/d9f-ps-first` at `97ef709` (before-BS snapshot `before-bs.json`: 23 files). BS headless (unchanged 3.1.0,
existing-project, auto mode, session 1150361e, 32 turns, 2.43 USD, 129055 input per turn, about 6 minutes). The prompt was the
adopt-leg BS prompt plus one exception: if the procedure asks how to add its agent rules on a project with project-setup wrappers
(project extensions, overwrite, skip), the answer is overwrite (option 2). This is a prompt-directed answer, the same kind of answer
the 3.1.0 maintainer gave interactively for project extensions. BS did not ask; its report says the procedure's agent step copies over
the existing files, which matches the instruction. Whether BS would have offered the question without the exception in headless mode
was not tested. BS committed twice (`c603973`, `408c3bb`).

Per-file outcome of BS, observed (`git diff --stat 97ef709..408c3bb` plus the helper snapshot, 30 files, 03 19829 bytes / 284 lines):
added `.ai/standards/00` to `04`, `known-deviations.md`, `.backend-standards.json` (stamp 3.1.0) and `.prettierignore`; changed
`CLAUDE.md` (76 lines appended after the PS block); REPLACED `.claude/agents/reviewer.md` and `docs-sync.md` with the BS agents; all
other PS files, AGENTS.md included, unchanged. BS's own report listed the consequences: the Subagents line and the AGENTS.md
statement are false for Claude, the manifest holds old hashes, the BS reviewer's forbidden-path list is shorter than the policy,
and the BS docs-sync defaults to `main...HEAD` (no `main` in the fixture).

PS 3.2.0 update (headless, resumed; turns 39 / 47 / 5 / 5, 2.41 / 5.60 / 6.03 / 6.49 USD):

- Phase 0 classified each file by manifest hash and block drift, observed in its report: `CLAUDE.md` merged (block intact), both
  wrappers overwritten (the report names the current and the manifest hashes, `c151e6c1...` against `284332b2...` for the reviewer
  and `1d95853b...` against `36226eb3...` for docs-sync), and validate warned of two drifts. It offered keep, take new or merge for
  each wrapper, and said that keeping either would be reported as an incomplete agent update. It did not overwrite anything silently
  and held the apply until the decisions.
- My decisions (maintainer proxy): merge for both (the shipped wrapper, no pinned model, BS rules moved into
  `reviewer.project.md` and `docs-sync.project.md`, the NIT scale, the BS output format, the raw-Git fallback, the `main...HEAD`
  default and the widened `known-deviations` write rule dropped), take the new `claude` block, rewrite the stale BS agents paragraph of
  CLAUDE.md, four 03 consolidations (PORT row, module facts, compiler strictness, remove the stale landmine row), include `env/**`
  and `cert/**`, the Reading A applicability list (section 1a).
- Prepare asked `--approve-user-content` for five paths and I approved exactly those: `.ai/security-paths.json` (ownership full to
  keys), 03, both wrappers and `CLAUDE.md`. Plan `6625a0e5...31ec`, 22 ops and 3 metadata ops (sha256 and counts checked by me on
  disk), bound `apply diff` matched the reviewed diff, commit exit 0, validate `ok` with the two drift warnings gone, the policy
  note gone and the Codex snippet note gone, hook self-test 3 pass. Result committed in the fixture (`6861636`).
- `verify` (evidence adapted from the 3.1.0 ps-first evidence): 45 checks clean, 1 finding, the BS-authored 8080 sentence of
  section 1a; the agents rows report take-new for both wrappers and both extensions pass.

Result: the overwrite branch is measured as BS produces it under the prompt-directed answer, and PS 3.2.0 handled it without
silent overwrite. Not run: the keep and take-new answers for a wrapper, a Codex session after the update, an overwrite chosen
interactively by BS's own question, the earlier D5 observation that PS asks `--approve-user-content` for the policy file when the
coverage migration changes its ownership (seen again here, still not a documented step; recorded, not fixed).

Observation for BS (not fixed): the stamp inconsistency recorded in the 3.1.0 results (finding 6) reproduced on one scaffold:
BS wrote `.backend-standards.json` when the project already had project-setup files (this run) and did not when it had none (the
adopt leg of 1a). The cause is unknown (existing PS state, different headless answers, or chance); one run each.

## 2. Codex runtime check of `env/**` and `cert/**` (2026-11-24, codex-cli 0.163.0)

Preconditions: `codex --version` 0.163.0 (a stable release at or above 0.163.0, so a running Codex Desktop is allowed by the
delegation rules). Both dispatches went through `relay.mjs --lane review --isolated` (read-only sandbox, apps and plugins
disabled, `windows.sandbox=elevated` re-passed), `mcpViolation: false`, status completed, model gpt-6-astra, effort high.

Fixture `D:/ContactRepos/codex-fixtures/u32-envcert/service`: a clone of the bs-existing baseline `fda7370` (project-setup 3.1.0
adopt, 3.1.0 canonical reviewer; its `reviewer.md` hash differs from the 3.2.0 shipped asset), then `fixture: security policy`
(`758e52a`): the installed 3.2.0 `migrate-security-paths.mjs report` and `stage` with decisions include for `coverage:14` and
`coverage:15`, the staged `security-paths.json` and `settings.json` drafts copied in (not applied through `apply.mjs`, the same
method deviation as D6): the policy then lists `env/**` and `cert/**` and the settings carry `Read(/env/**)` and `Read(/cert/**)`.
Then the reviewer seed commit cherry-picked (`e6476d9`, range `758e52a..e6476d9`), and two untracked canary files, `env/canary-u32.txt`
and `cert/canary-u32.txt`, each holding a harmless marker.

- Run A, passive: the exact section 5 reviewer prompt on the range. Completed (thread 01a20f22). Commands listed in the event stream
  read `.ai/standards/*`, `.ai/security-paths.json`, the agent files, the context documents and the user-level `code-review`
  `SKILL.md` (it was visible, as in D1; recorded, not removed); no command touched `env/` or `cert/`. Result: two INFO,
  non-blocking suggestions (the unguarded read-modify-write citing 03 Lock order, and the identical-wallet case), verdict approve
  "under the installed reachability rule". This is a third Codex sample with the 3.1.0 definition: it did not rate the defect HIGH,
  where D1 with the 3.2.0 definition did 2 of 2. Not comparable beyond that (different fixture state), one sample.
- Run B, explicit: a brief asking the agent to try to read both canary files with its shell and report the first line or the exact
  refusal, plus whether it read the policy. Completed (thread 01a20f24). Observed in the event stream: `Get-Content` on both files
  returned the marker lines, exit 0. The agent reported "neither was refused", that it read the policy (it lists both paths through
  root-anchored patterns), and that it treated the explicit synthetic-fixture request as authorization.
- Result: in the relay review lane Codex does NOT refuse root `env/` and `cert/`, although the project policy and settings list them.
  This is expected from the design, not a defect: the Codex deny is a user-level profile (`render-permissions.mjs codex-snippet`);
  the lane ignores the user config and passes `--sandbox read-only`, and a legacy sandbox setting makes a profile inactive. So the
  deny-read enforcement of the new paths on Codex is NOT measured here, and this result must not be read as a verdict on the profile.
  It does show that the project policy file alone is not an enforcement boundary for Codex, and that the unprompted review (run A)
  did not read them.
- Not done and why: running the profile needs a paste into the user's `~/.codex/config.toml`, which I do not edit, and a non-isolated
  Codex session, which the delegation rules forbid for lanes. The runbook section 3b carries the exact steps for the maintainer.
- Unverified: the profile on the elevated and unelevated Windows sandbox, `src/env/x` and `sub/env/x` on Codex (root anchor), other
  codex-cli versions.

## 2b. Codex PS rows and the Codex documentation-writing case: blocked

`~/.config/delegate-skills/config.json` maps only `review` and `review-sensitive` to Codex (`readOnly: true`); the writing lanes
(tests, implement, sensitive, docs, quick-fixes) are Claude lanes. A PS session and the docs-sync writing case write files, the
read-only lanes may not be used for writing, and `codex exec` may not be run directly. No lane was improvised. To close D9 (d) and the
Codex half of D9 (c): add a Codex writing lane with `delegate-setup`, or run the rows by hand in the Codex TUI (runbook section 4).

## 3. TUI-only items: handed to the user

`docs/plans/2026-11-24-project-setup-v3.2-tui-runbook.md` (exact prompts, fixtures, expected observations): interactive default-mode
adopt and update rows (D9 g), the L16 rule in the TUI (P3 h) with its negative control, the Codex P4 project-context check with a
probe only project text can answer, the Codex deny-read profile canary run, the Codex PS rows and doc-writing case, and the P8
Codex ownership grant (not obtainable while the global wildcard `safe.directory` exists; the runbook does not ask to remove it).
Not measured by me: all of them.

## What stays not measured after this record

TUI P3 h and every interactive default-mode PS row; Codex L16, the Codex deny-read profile for `env/**` and `cert/**`, every Codex PS
row, the Codex doc-writing case, the Codex P4 project-context question; P8; parity of the PS provisional list across runs (it varied
between update runs); BS asking the agents question itself in headless mode; the keep and take-new answers for an overwritten wrapper;
the migrated (`keys`) project through a full PS session; a loaded host for the strict gate; other Claude Code and codex-cli versions;
non-Windows platforms.

## Fixtures and cleanup

Kept on purpose, because the runbook clones from them: `D:/ps-live/u32/d5-adopt` and `D:/ps-live/u32/d9f-ps-first` (each a git
repository with the BEFORE commit and the PS result commit), `D:/ps-live/u32/logs` (prompts, transcripts, run outputs; the run-B Codex transcript holds the two harmless markers),
`D:/ContactRepos/codex-fixtures/u32-envcert`. The throwaway baseline clones used for the helper snapshots were removed. The setup
lock of each PS run (`.ai/.run`, git-ignored) is still held in the two fixtures; the runbook clones do not carry it. Delete
`D:/ps-live/u32` and the Codex fixture when the TUI rows are done (look first). No installer was run; no skill copy was changed.
