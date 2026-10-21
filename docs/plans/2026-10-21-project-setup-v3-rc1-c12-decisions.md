# C12 decisions

Decisions taken during the C12 tests and implementation. The frozen plan
`docs/plans/2026-10-21-project-setup-v3-rc1-c12.md` is not edited; where an item below and the
plan differ, the item wins.

## Tests lane (2026-10-21): I12-1

- I12-1 (orchestrator decision, plan section C12-15). Four exact expectations in
  `tests/c11b.test.mjs` depend on bytes the implement lane writes: `PINS.skillWithOldHeading`,
  `PINS.readmeTopRest`, `CHANGELOG_ENTRY_LINES` and `RELEASE_NOTES_TEXT`. The plan does not fix
  that text verbatim, so their values cannot be known before implementation. The tests lane leaves
  them unchanged in its first pass; after implementation it updates exactly those four to the
  implemented bytes in a second pass, which the orchestrator reviews before the C12 commit, so the
  pins and their edits still land together as I11b-2 requires. No other pin, `PAYLOAD_INVENTORY`
  or 60-file assertion moves. Precedent: I3-1 and I4-1.
