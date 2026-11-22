# project-setup 3.1.0

On a backend-standards (BS) project, `.ai/standards/03-project-architecture.md` (03) becomes the
documentation source of truth. Project-setup writes navigation pointers for the documents that
overlap 03 instead of a second full description. Backend-standards is unchanged.

Status: stage 2 (the live acceptance is recorded). The static gates below check the instructions,
a test-only checker and the release bytes. The dated live acceptance in Claude Code and Codex is
recorded under Verification, with its scope, what was not measured and the residuals; it supports
a narrower claim than full cross-host compatibility. Tagging and publication remain separate
authorized actions.

## Compatibility

- Setup modes are unchanged. A valid manifest selects update, invalid metadata selects invalid and
  existing configuration without reliable provenance uses conservative adoption. The mapping is a
  documentation policy layered over the detected mode.
- Activation needs a readable, permitted 03 and either a valid root `.backend-standards.json`
  stamp with `appliedBy: "backend-standards"`, or (with no stamp) the BS CLAUDE.md version
  sentence together with the import of the same 03. An owner may also select the layout with one
  exact sentence in root AGENTS.md, outside managed blocks, recorded only after approval.
- Malformed or conflicting signals hold activation, 03 alone asks for a disposition, and a project
  without an accepted signal keeps the 3.0.0 documentation behavior.
- Canonical agents, wrappers, instruction templates, scripts, the installer and the release
  builder are byte-identical to 3.0.0. Manifest schema 3 and the policy schemas are unchanged.
- No BS version is required; destinations resolve against the installed 03 headings.

## Consolidation

- Nine overlapping documents become pointers to named 03 sections: project tree, critical
  modules, error contract, configuration, glossary, API conventions, database, observability and
  vendor integrations. Code patterns, development rules, business rules, ADRs and TODO.md stay
  full documents.
- Before any original is replaced, setup inventories its substantive content and proposes a
  destination for every item. Source changes, pointers, routing text and ownership changes go
  through one reviewed apply transaction.
- Declined or unresolved consolidation keeps the originals and is reported as incomplete. A known
  invariant is never moved only into TODO.md to make a conversion look complete.
- 03 may be expanded through reviewed merged edits so configuration inventories, transaction
  details, error transformations, integration safeguards and critical-module invariants survive.

## Recovery when backend-standards ran after project-setup

- The BS existing-project procedure writes CLAUDE.md from its template and copies two Claude
  agents. What a given run actually did (overwrite, merge, unchanged or mixed) is observed and
  recorded per file before any repair is proposed.
- CLAUDE.md, the reviewer wrapper and the docs-sync wrapper each receive their own disposition
  (keep, take new, or merge through review). A kept BS agent or an unresolved custom wrapper is
  reported as an incomplete PS agent update, with the definition actually invoked.
- Keeping a deficient CLAUDE.md is a held result, not a successful root recovery.

## Rollback

- Roll back the reviewed project transaction as one unit:
  `node <SKILL_DIR>/scripts/apply.mjs rollback --run-id <id>`. It restores source consolidation,
  pointers, root instructions, wrapper recovery, ownership and manifest changes of that run, and
  skips intervening edits, reporting incomplete recovery.
- On a project where BS ran after project-setup, the rollback returns to the post-BS state
  captured before the 3.1.0 transaction. It does not undo the earlier BS changes.
- Roll back the installed skill with `install.mjs rollback` and explicit target directories, then
  confirm one active copy in a new session. Installer rollback restores the skill copy, not the
  consolidated project documentation.
- Do not rerun 3.0.0 on a consolidated project: its drafting rules may restore competing full
  documents. Roll back the project transaction first or perform a reviewed migration.

## Verification

- Static gates, run serially: `node tests/bs-doc-map.test.mjs` (the drafting contract and the
  test-only pointer checker), `node tests/release-3.1.test.mjs` (actual-byte amendment gate,
  unchanged assets, install and release build) and `node tests/c18.test.mjs` (the historical
  3.0.0 view), plus the complete strict gate `node tests/accept-rc1.mjs`.
- These prove the instructions and the checker, not agent behavior. Whether a Claude or Codex
  reviewer and docs-sync follow a pointer is a live measurement.
- Live acceptance: measured, see below. The procedure, scenarios and exact prompts are in
  `tests/live/BS-DOC-MAP-ACCEPTANCE.md`; the per-row results, dates and unverified scope are in
  `docs/plans/2026-11-22-project-setup-v3.1-live-acceptance-results.md` of the distribution
  repository (the results file).

### Measured live results (2026-11-14 to 2026-11-22)

Scope: one Windows 11 host, Node v24.14.1. Claude Code 2.1.325 for the 2026-11-14 runs, 2.1.328
for the declined adopt of 2026-11-21 and 2.1.330 for the later agent runs, the controls and the
2026-11-22 rows. Codex: codex-cli 0.163.0 on 2026-11-22, on two fixtures cloned from untouched
baseline commits of the Claude Code fixtures. Agent measurements used the exact section 5 prompts
in new sessions started at the fixture root; contaminated runs were kept and not counted.

- Canonical docs-sync, both hosts: the facts went to 03 (and to TODO.md; on Codex also to
  known-deviations.md), the pointers were left untouched, and the agent, wrapper and extension
  bytes were unchanged. On Codex the invoked definition is inferred, not observed.
- Reviewer on the seeded money defect, both hosts: both cited the 03 Lock order rule and modified
  no file. Claude Code rated the defect HIGH; the Codex reviewer rated it INFO with a block
  verdict because nothing calls the function (one sample).
- Retained BS docs-sync (Claude Code, 2026-11-21): PS reported the incomplete agent update and the
  retained agent routed the facts to 03; the invoked definition is inferred.
- PS rows (Claude Code): the PS-first state after BS (merge branch only; the other 22 PS files
  unchanged), the BS procedure and stamp states, a blank section, a renamed heading, a deleted
  pointer and a local-instruction conflict (each held for a disposition, then resolved after
  approval) and an unchanged rerun with zero diff, manifest included. The five 2026-11-22 rows ran
  headless in auto permission mode, a recorded deviation from the interactive procedure.
- Controls (Claude Code, 2026-11-21): hook self-test 3 PASS / 0 FAIL; a raw Git command was
  blocked by the project hook and a read under the secrets path was refused by the project Read
  deny rule.
- Context loading (Claude Code): the init events show the project agents loaded and no PS or BS
  skill; no self-report was collected. 03 sizes were recorded; no preload ceiling is claimed.

### Not measured

- The Codex P4 context check.
- The read-only and the documentation-writing missing-destination cases, on either host.
- Codex PS rows: Codex ran only docs-sync and the reviewer.
- Interactive default-mode PS rows for the blank section, renamed heading, deleted pointer,
  local-instruction conflict and unchanged rerun cases.
- A second Codex reviewer sample.
- The P8 Codex ownership grant: not obtainable as specified, because a wildcard `safe.directory`
  entry already existed in the global Git configuration.
- The overwrite branch of the PS-first recovery: only the merge branch was observed.

### Claim

Reviewer and docs-sync routing to 03 was measured on both hosts. The Codex reviewer still rates
the unreachable seeded money defect INFO with a block verdict: the 3.0.0 reviewer severity
residual, which stays open in TODO.md. There is therefore no full cross-host compatibility claim;
3.1.0 claims the documentation mapping and pointer routing only as measured above, on the stated
versions.

## Limitations

- A later BS copy or re-sync can overwrite consolidated 03 content and can replace project-setup
  instructions or wrappers again. Project-setup 3.1.0 does not prevent either; accepting a re-sync
  requires reviewed preservation or merge, and the durable fix remains BS 4.0.0 work.
- The BS stamp is reconfirmed immediately before prepare but is not bound atomically; it can
  change between that check and commit.
- The validator does not check pointer destinations or headings; only the test-only checker does.
- No safe 03 size ceiling is established. Sizes are recorded before and after consolidation and a
  review threshold applies; facts are never truncated to meet an assumed limit.
- Static checks cannot prove that an agent discovered every fact of a project.

### Known issues (from the live acceptance)

1. A kept BS docs-sync makes the CLAUDE.md Subagents line false (no partial-layer variant;
   validate reports `claude-block-content`). Fix in 3.1.x.
2. A kept BS docs-sync is not bound by the managed-block rule and can edit the PS-managed AGENTS.md
   `overview` block, which a later PS update may rewrite. Fix in 3.1.x.
3. Update and adopt differ for evidence-less topics and the per-variable requiredness table of 03
   Configuration, and adopt omitted tsconfig strictness: no 3.1.0 adopt on a real many-variable
   service before 3.1.1.
4. The shipped secret-path policy lacks `env/**` and `cert/**`, which BS 00 section 5.3 names;
   add them to `.ai/security-paths.json` by hand until 3.1.x.
5. Claude Code discovers the installer backup, a sibling in the skills directory, as a second and
   older project-setup skill. detect.mjs fix in 3.1.x; the backup location is a candidate change.
6. The same BS 3.1.0 wrote its stamp on the PS-first fixture but not on the BS existing-project
   fixture. Recorded for backend-standards.
7. Open, recorded only: Phase 0 of the declined adopt listed critical-modules as skipped for lack
   of evidence, yet the applied tree has a critical-modules pointer.
8. Open: the reviewer severity residual (confirmed again on Codex on 2026-11-22) and the launch
   rule residual of the 3.0.0 host measurements stay in TODO.md.

## Provenance and release artifacts

- The release builder reads the tagged VERSION and these notes from the reviewed tag. Resolved
  commit IDs, archive digests and installer payload hashes are recorded in the acceptance
  evidence and the external publication notes, never in this file.
- Tag creation, push and publication are separate authorized actions.
