# project-setup 3.1.0: dated live acceptance results (Claude Code)

Status: evidence record for the maintainer's stage-2 sign-off. It is **not** an acceptance verdict and it
does not edit the section 7 matrix of `project-setup/tests/live/BS-DOC-MAP-ACCEPTANCE.md`. That matrix is pinned
by `bs-doc-map.test.mjs` (stage 1: "pending evidence") and changes only together with the release notes and the
test at sign-off. The acceptance doc's introduction already says dated live-run records are kept outside the
matrix; this file is that record.

Evidence lives outside the repository in the fixtures under `D:\ps-live` (observations, JSONL transcripts, evidence
files, verify outputs). Nothing here is reproduced from them beyond the figures quoted below.

## Common record (applies to every row unless a row says otherwise)

- **Host:** Windows 11 (maintainer-described), Node v24.14.1, Claude Code 2.1.325 for the 2026-11-14 runs, 2.1.328 for the
  declined adopt of 2026-11-21, and 2.1.330 for the later agent runs, controls and 2026-11-22 rows, Codex not exercised.
- **Skill copy:** the user-installed project-setup 3.1.0 candidate was the only active copy in every PS session,
  with the synced anthropic-skills copies and the `.project-setup.bak-*` backups switched off in `/skills` or by
  `skillOverrides` in the fixture's `.claude/settings.local.json`. The installer backup being discovered as a skill is
  a recorded finding (below).
- **Launch directory:** the fixture root (`service`) for every counted run, in a new session, never `--continue`.
- **Agent measurements:** `claude -p --setting-sources project,local --permission-mode auto --output-format
  stream-json --verbose` with the exact section 5 prompt. Runs made with the default setting sources (global
  delegation protocol loaded, parent re-doing the work) are classed contaminated and invalid; they are kept, not counted.
- **Permission mode:** the PS rows of 2026-11-14 (ps-first, bs-existing, bs-new, and the declined adopt of
  2026-11-21) were interactive; bs-existing's adopt ran in auto mode (PS noted it expects default). The five
  PS-only rows of 2026-11-22 are a **recorded deviation**: headless `claude -p --permission-mode auto`, default setting
  sources, gates answered by the orchestrator on the maintainer's instruction of 2026-11-21.

## Matrix (Claude Code column only; the Codex column is not measured)

| Case | Date | Result | Unverified scope |
|---|---|---|---|
| P1 Nest CLI scaffold versions | 2026-11-14 | bs-new: BS pinned the Nest CLI to 11; `@nestjs/common` 11.2.10 (headless BS run, 51 turns). PS reports of 2026-11-22 on the ps-first fixture: NestJS 11.2.9 on Express 5.2.1, TypeScript 5.9.3, Jest 30.5.2. | The scaffold CLI version of the ps-first, bs-existing and declined fixtures is not recorded in their observations. |
| P2 BS procedure and stamp state | 2026-11-14, 2026-11-21 | ps-first: BS asked mode, agents, stamp and git, took the recommended answers, wrote `.backend-standards.json` 3.1.0. bs-existing: existing-project procedure, **no stamp**, provenance by the CLAUDE.md version sentence (line 68) plus the 03 import (line 20). bs-new: new-service procedure, stamp 3.1.0. Declined fixture: BS 3.1.0 existing-project applied. | The same BS 3.1.0 wrote the stamp on ps-first and not on bs-existing (recorded inconsistency). Stamp state of the declined fixture is not recorded here. |
| P7 PS-first state after BS | 2026-11-14 | Per file vs the pre-BS snapshot: added `.ai/agents/*.project.md`, `.ai/standards/00-04`, `known-deviations.md`, `.backend-standards.json`; CLAUDE.md changed (2790 to 5605 bytes, BS text after the PS managed block); the other 22 PS files unchanged, including both wrappers, AGENTS.md and the manifest. PS 3.0.0 `validate --json` 16 pass / 0 fail; CLAUDE.md block drift unchanged. | Only the **merge (append)** branch was observed, with BS option "project extensions". The overwrite branch was not observed. |
| Canonical docs-sync | 2026-11-14 | `docs-sync-2-clean`, session 8a9b1809, range fc9493b..7f67271, 3 parent turns, 1.00 USD, parent 0 edits. Subagent edited 03 (sections 3, 4, 5, 12 and 15) and TODO.md; pointers untouched; 03 301 to 311 lines, 21554 to 22901 bytes. | The invoked definition (`.claude/agents/docs-sync.md` loading `.ai/agents/docs-sync.md` and the project extension) is read from the transcript. `docs-sync-1` is contaminated (parent brief pre-stated routing; parent made 4 further edits) and invalid. |
| Reviewer: seeded money defect | 2026-11-14 | `reviewer-2-clean` on bs-existing, range fda7370..df0299b, session 843bbd2a, 0.88 USD, parent 0 edits: HIGH lost update at `wallet-transfer.ts:2-5`, citing 03 section 8 Lock order first; no files modified. | The 03 Lock order rule was added by the maintainer for the fixture. The reviewer kept HIGH while noting nothing calls the function; the 3.0.0 Codex INFO residual stays open until Codex is re-measured. `reviewer-1` is contaminated and invalid. |
| Read-only missing destination | not run | none | Not measured on any fixture. |
| Documentation-writing missing destination | not run | none | Not measured on any fixture. |
| Retained BS docs-sync (declined row) | 2026-11-21 | PS adopt on a bs-existing-derived fixture: reviewer replaced, docs-sync replacement declined; official line "Agent migration: incomplete update; kept installed file: .claude/agents/docs-sync.md". `verify --expect-partial`: 30 checks without finding, 1 finding (`claude-block-content`, the Subagents line). Clean docs-sync run, session fec968b2, 0.63 USD, parent 0 edits: subagent ran on opus (the retained agent's `model: opus`), edited 03 (22745 to 24738 bytes, 291 to 307 lines), AGENTS.md, CLAUDE.md and TODO.md; pointers unchanged. | The invoked definition is **inferred** (only docs-sync in the init agent list; no canonical one exists). The docs-sync edit changed the PS-managed `overview` block of AGENTS.md; PS `validate` then reports `drift` as a warning (see findings). |
| Blank section | 2026-11-22 | r2 (clone of ps-first at dfce553, 03 section 7 body blanked): PS held the section, offered restore / restore plus explicit unknown / leave, and after option B committed plan 9cad9f5a: 17 lines restored byte-for-byte from the git blob plus a 3-line unknown note; validate 16/0/0. | Auto-mode deviation. Options A and C not run. |
| Renamed heading | 2026-11-22 | r3 (heading Database renamed Persistence): PS held until a replacement was approved, did not revert the rename, found `docs-sync.project.md` still routing to the old heading, and after approval changed line 31 only (plan 0639303f); validate 16/0/0. | Auto-mode deviation. Hold and report-only options not run. |
| Deleted pointer | 2026-11-22 | r4 (`configuration.md` deleted): PS did not recreate it silently; validate showed 2 failures and 1 warning; after approval it restored the file with the same git blob as before the deletion (plan f425dc33); validate 16/0/0. | Auto-mode deviation. "Accept the deletion" and "leave" options not run. |
| Local-instruction conflict | 2026-11-22 | r5 (`src/AGENTS.md` told readers to ignore 03): PS found the contradiction and a dangling reference (validate 1 failure) and required a resolution before touching root text; after approval it rewrote line 3, listed `src/` in the root `local-instructions` block and recorded `src/AGENTS.md` as `merged` (plan 50215c32); validate 17/0/0. | Auto-mode deviation. The "keep as is plus TODO" and "maintainer edits" options not run. |
| Unchanged rerun | 2026-11-22 | r1 (clone, no mutation): PS proposed four consolidations; all declined; no lock, no run directory; git status clean and all 30 tracked md/json files byte-equal to HEAD, manifest included. | The four proposals came from clone artifacts (an `origin` remote, one branch), so zero diff holds only because they were declined. An un-cloned fixture was not rerun. |
| Factual accuracy against code | 2026-11-14, 2026-11-21 | ps-first: the maintainer judged the docs-sync facts against `src/` and found the toClientError 423 mapping recorded in TODO.md rather than in 03 (defensible, noted). | Declined-row and r2-r5 facts were not independently checked against code beyond the PS transcripts. |
| Agent, wrapper and extension bytes unchanged during docs-sync | 2026-11-14, 2026-11-21 | ps-first: sha256 of agents, wrappers, extensions and the Codex toml equal to the pre-run record. Declined: 6 of 8 hashes equal; AGENTS.md and CLAUDE.md differ only by the docs-sync edits. | Hash comparison, not a behavioural test. |
| P3/P4 context loading | 2026-11-14, 2026-11-21 | Init events show the project agents loaded and no PS or BS skill with `--setting-sources project,local`; the routing sentence relayed by the parent is the installed AGENTS.md text. | No `/memory` or `/context` self-report was collected. P4 (Codex) not run. |
| P5 03 preload size | 2026-11-14 to 2026-11-22 | Sizes recorded: ps-first 301/21554 to 311/22901; bs-existing 273/21001; bs-new 332/28300 to 31230 bytes; declined 291/22745 to 307/24738; r2 294/21683 to 314/23064 (lines/bytes). | Sizes only; no preload measurement and no ceiling claim. |
| P8 Codex ownership grant | not run | none | Needs the maintainer's grant first. |

## Controls on the declined fixture (2026-11-21, Claude Code 2.1.330)

- Installed hook self-test: 3 PASS / 0 FAIL. `validate.mjs` (installed 3.1.0): 15 pass, 1 warn, 0 fail; the warn is
  `AGENTS.md: managed block overview edited by user`.
- Fresh headless session (auto, project and local sources, 0.19 USD): raw `git log -1 --oneline` blocked by the
  project `guard-raw-git` hook; a read of the non-existent `secrets/canary.txt` refused by the project Read deny rule.
  Both result strings are in the JSONL. No canary file was created.
- Scope: one host, one version, project-level rules only, the same limits as the 2026-11-15 bs-new probe.
  `doctor.mjs` audits Codex lane configuration and was not run.

## Findings carried to 3.1.x and the 3.1.0 known issues

Decided by the maintainer unless marked open.

1. **Declined row, `claude-block-content`:** the CLAUDE.md template has no partial-layer variant of the Subagents line,
   so a kept docs-sync makes the shipped sentence false (decided 2026-11-21: 3.1.x plus known issue).
2. **Kept BS docs-sync edits a PS-managed block:** the retained agent is not bound by the rule that docs-sync must not
   touch managed blocks; a later PS update may rewrite the AGENTS.md `overview` block (decided 2026-11-21: 3.1.x plus known issue).
3. **Adopt inconsistency:** update and adopt differ for evidence-less topics and for the per-variable requiredness table in 03
   section 3; bs-existing's 03 also omits tsconfig strictness (`not-strict`). No 3.1.0 adopt on a real many-variable service before 3.1.1.
4. **Secret-path policy:** the shipped policy lacks `env/**` and `cert/**`, which BS 00 section 5.3 names. Interim: a manual edit of
   `.ai/security-paths.json`.
5. **detect.mjs and installer backups:** the installer's backup is a sibling in the skills directory and Claude Code
   discovers it as a second, older project-setup skill. Decided: detect.mjs fix in 3.1.x plus a known issue; the backup location is a candidate change.
6. **BS stamp inconsistency:** the same BS 3.1.0 wrote the stamp on ps-first and not on bs-existing (record for BS).
7. **Open, recorded only:** Phase 0 of the declined adopt listed critical-modules as skipped for lack of evidence, yet the applied tree
   has a critical-modules pointer (five pointers).
8. **Open:** the reviewer severity residual and the launch rule residual of the 3.0.0 host measurements stay in TODO.md.

## Not done

Codex rows and the P8 grant; the Read-only and Documentation-writing missing-destination cases; the section 7 matrix edit,
the release-notes known-issues entry and the README wording, all of which belong to the maintainer's sign-off.
