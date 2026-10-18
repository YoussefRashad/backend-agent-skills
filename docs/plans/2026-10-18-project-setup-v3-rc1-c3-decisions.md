# C3 decisions (maintainer, 2026-10-18)

These records amend docs/plans/2026-10-18-project-setup-v3-rc1-c3.md without editing it; where a
record and the frozen plan differ, the record wins.

## I3-1. C2's lib.mjs export check changes with the C3 implementation

Gap (tests lane PLAN-GAP 1): `V2/C2/module-contract` in `tests/c2.test.mjs` pins the exact export
set of `scripts/lib.mjs`. Plan section 2.4 adds `loadEffectivePolicy` to `lib.mjs`, while section
2.2 names the I2-10 control as C2's only planned test edit. The C2 check therefore fails as soon as
C3 is implemented. Editing it now would fail C2 before C3 exists, and the implement lane may not
edit tests.

Decision: after the implement lane finishes, the tests lane makes one edit to
`tests/c2.test.mjs`: it adds `loadEffectivePolicy` to `LIB_NEW_EXPORTS` (about line 266). That
edit lands in the same commit as the C3 implementation, so every commit keeps C2 green. The C2
check stays exact; accepting either export set was rejected because it weakens the check.
