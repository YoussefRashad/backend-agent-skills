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

## Review round 1 (2026-10-22): I12-2, I12-3

- I12-2 (maintainer decision, review finding C12-R1, BLOCKING). The policy gate, the C3 workflow
  gate and the control-file handling select targets by exact string, so on a case-insensitive
  filesystem a draft target spelled `.ai/SECURITY-PATHS.JSON` writes the installed policy while
  bypassing all three. `apply.mjs` refuses, with the existing code `APPLY_PATH` and its existing
  text `unsafe path: <target>` and exit, any draft target or declared input whose ASCII case fold
  equals a protected canonical target but whose spelling differs. The protected targets are the
  control files (`.ai/security-paths.json`, `.claude/settings.json`) and every runtime-unit target
  in the shipped catalog. The refusal runs before approvals in prepare and in loading a prepared
  plan for both diffs and commit, so no approval and no forged plan reaches the later gates with
  an alias. It applies on every platform: on a case-sensitive filesystem such a name is a distinct
  file nobody needs. No new code, exit, plan field or export. The tests lane adds the coverage
  before the fix.
- I12-3 (maintainer decision, review finding C12-R2, NON-BLOCKING). C12-4 says commit checks bound
  installed and draft bytes. Before `checkPolicyRegression` evaluates the installed policy at commit
  and in the prepared diff, the bytes it reads (or their absence) are compared with the bound
  precondition of that operation; a mismatch is the existing `APPLY_DRIFT`, exit 4. The window is a
  concurrent replacement between the drift check and the gate, so it is verified by reading the
  source; no deterministic race test is required.
- I12-2a (maintainer decision, 2026-10-22, from the I12-2 tests lane). The protected targets of
  I12-2 also include the manifest `.ai/manifest.json`: a case alias of it is refused with
  `APPLY_PATH`, while the canonical spelling keeps `APPLY_MANIFEST_DRAFT`. Orchestrator readings of
  I12-2, recorded so the implement lane and review use the same ones: the refusal is the returned
  per-target refusal (exit 3, `unsafe path: <target>` with the target as written), not the thrown
  link/escape refusal (exit 2); it runs before the write-scope check, so it is the same on every
  platform; the fold is ASCII only (A-Z to a-z), so a name that folds to a protected target only
  under Unicode case rules keeps its existing outcome; an alias inside a forged plan's
  `metadata.transactionInputs` keeps the existing `APPLY_PLAN_INVALID` (exit 1).
- I12-2b (orchestrator decision taken overnight under delegation, 2026-10-22, a direct consequence
  of I12-2; approved by the maintainer at 10:51). Two frozen C4 rows in `tests/c4.test.mjs`
  (step "a bad or missing runtime candidate is TOOL_UNIT_UNREVIEWED", the two case-alias scenarios using
  `.ai/tools/GIT-SAFE.mjs`) expected `TOOL_UNIT_UNREVIEWED` naming the canonical entrypoint. Under
  I12-2 that spelling is a case alias of a catalog target and is refused earlier with `APPLY_PATH`.
  Both rows cannot hold. The tests lane changes exactly those two rows to expect the `APPLY_PATH`
  refusal named by the alias, in prepare and the three later phases; their intent, that an alias
  never stands in for the canonical member, is kept and now enforced earlier. No other C4 row moves.
  Precedent for amending an earlier component's test for a later decision: I3-1, I4-1.

## Review round 2 (2026-10-22): I12-4

- I12-4 (orchestrator decision taken overnight under delegation, review findings C12-R3 BLOCKING
  and C12-R4 NON-BLOCKING; it applies the maintainer's I12-2 intent, refuse other spellings of a
  protected target, to the remaining Windows spellings; approved by the maintainer at 10:51).
  - C12-R3: on Win32 a trailing ASCII dot or space, and an NTFS stream suffix after the first `:`,
    address the same file (`.ai/security-paths.json.` writes the installed policy). The I12-2 check
    compares a protected target with a name after these per-component forms, the same PQ2 forms
    C1 already uses (`assets/tools/security-policy.mjs`, `alternatives`): the ASCII case fold, the
    component's prefix before its first `:`, and both with trailing ASCII dots and spaces removed.
    A name with any form equal to a protected target whose spelling differs from it is refused with
    the I12-2 `APPLY_PATH` refusal, at the same boundaries and in the same order. The fold stays
    ASCII only (I12-2a). 8.3 short names are not modelled (no evidence of a reachable bypass;
    residual).
  - C12-R4: the protected runtime targets come from the catalog's validated target list alone,
    never from reading the runtime sources, so a missing source file cannot empty the list. If the
    catalog itself cannot be read, the check fails closed for names under `.ai/tools/`: any name
    whose forms fall under `.ai/tools/` and whose spelling is not its own canonical form is refused.
  - The tests lane adds coverage (trailing dot, trailing space, both, a stream suffix, these on
    every protected target class, a forged plan whose source inventory keeps the canonical name
    while the operation uses the alias, and a declarations-only plan with a runtime alias while a
    runtime source is unreadable) before the implement lane changes the code.
