# C4 review decisions

Decisions taken during the C4 implementation review. The frozen plan
`docs/plans/2026-10-18-project-setup-v3-rc1-c4.md` is not edited; where an item below and the plan
differ, the item wins. Each item enforces a clause the frozen plan already states; none adds
behaviour.

## Review round 1 (Codex, 2026-10-19): I4-1 to I4-4

The review found no BLOCKING issue and three NON-BLOCKING findings, plus one coverage gap. All four
are taken, because each closes a gap between the plan's own clause and the code or its tests at low
cost.

- I4-1 (C4-R1). Executor results with `overflow: true` are validated like any other result:
  section 2.5's rule "normal completion has non-null status and null signal and error" applies
  independently of overflow, and only the all-null overflow case it already permits passes. An
  inconsistent combination (for example `status: 0` with `signal: "SIGTERM"` and
  `overflow: true`) gives `GIT_SAFE_GIT`, not `GIT_SAFE_LIMIT`. Tests add inconsistent-result
  cases with `overflow: true`.
- I4-2 (C4-R2). The section 4.13 runtime-target cases at the prepared review and commit use a read
  guard that watches the paths of the clone those operations run against, and assert its recorded
  reads independently of the prepare guard ("missing candidate role checked before reading its
  path"; "protected runtime target refused before content read").
- I4-3 (C4-R3). The C4-P3-4 alternate-path launch records a junction or symlink creation failure
  as an assertion failure; the step never passes without running the launch.
- I4-4 (coverage). A normalized-equal runtime target (BOM, CRLF or lone-CR difference only, per
  C4-P3-5) succeeds through both review boundaries (unprepared and prepared diff), not only
  through prepare and commit.
