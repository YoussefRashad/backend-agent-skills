# project-setup 3.1.0

On a backend-standards (BS) project, `.ai/standards/03-project-architecture.md` (03) becomes the
documentation source of truth. Project-setup writes navigation pointers for the documents that
overlap 03 instead of a second full description. Backend-standards is unchanged.

Status: stage 1 (the implementation). The static gates below check the instructions, a test-only
checker and the release bytes. The live acceptance in Claude Code and Codex is pending evidence;
no host measurement is claimed in these notes.

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
- Live acceptance: pending evidence. The procedure, scenarios and exact prompts are in
  `tests/live/BS-DOC-MAP-ACCEPTANCE.md`. Until both hosts are measured for reviewer and docs-sync
  routing, no full compatibility claim is made, and the recorded 3.0.0 reviewer residuals remain
  open.

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

## Provenance and release artifacts

- The release builder reads the tagged VERSION and these notes from the reviewed tag. Resolved
  commit IDs, archive digests and installer payload hashes are recorded in the acceptance
  evidence and the external publication notes, never in this file.
- Tag creation, push and publication are separate authorized actions.
