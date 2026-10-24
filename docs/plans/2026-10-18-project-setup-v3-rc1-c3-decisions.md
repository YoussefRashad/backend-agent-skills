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

## Review round 1 (Codex, 2026-10-18): I3-2 to I3-5

The C3 review (review lane, effort xhigh) reported two BLOCKING findings, C3-R1 and C3-R2, and
one NON-BLOCKING, C3-R3. It allowed all seven implementer judgment calls. The maintainer decided
as follows.

### I3-2. An unchanged runtime op is not a planned candidate (C3-R1)

`commitToolUnit` and the prepared review take a runtime target's planned candidate from any plan
op, including `action: "unchanged"`, while commit writes only `create` and `modify` ops. A forged,
hash-approved plan that marks a new helper `unchanged` (and drops its manifest record) therefore
passes the tool-unit check and installs the policy and reader without the helper.

Decision: in every tool-unit check (prepare, both reviews, commit), a runtime target's planned
candidate is the op's draft only when the op's action is `create` or `modify`. For an
`unchanged` op, or no op, the candidate is the installed bytes, as for a target the plan does
not write. The existing tool-unit codes, texts and envelopes apply (plan 3.9 and 3.12). The tests
lane adds a regression: a hash-approved forged plan whose helper op is `unchanged` (manifest
record removed so derivation passes) is refused at commit with the plan's tool-unit failure for
that target, F envelope, exit 3, and nothing is written or journaled.

### I3-3. Migration reads respect the refusal set (C3-R2)

`stage` reads `.claude/settings.json` and each installed runtime target without checking the
installed policy, and copies the full settings object into `drafts/.claude/settings.json`; the
unprepared evaluation in `apply.mjs` passes `readable: () => true`. A project that protects one of
these paths (for example a settings file with sensitive `env` values) would get it read and
copied into the run area, where the root-anchored rule does not cover the copy.

Decision: before reading `.claude/settings.json` or any installed runtime target, `stage` and the
migration evaluation in `apply.mjs` (prepare and the unprepared review) check the path against
the shipped plus installed refusal set, the same set prepare uses. A protected path is never
read or staged; the command fails with a new code `MIGRATION_PROTECTED_INPUT`, exit 3, text
`migration input is protected by the security policy: <path>` (`<path>` project-relative), F
envelope with `target` in `apply.mjs`, and the migrate CLI's own error envelope in `stage`.
Nothing is written. The `readable: () => true` allowance is replaced by this check. The tests lane
adds regressions for a protected settings file through `stage` and through the unprepared review,
each proving with the read-recording preload that the file is never read.

### I3-4. Catalog checks follow decision and projection checks (C3-R3)

Section 3.12 orders the checks: decisions, report/action consistency, staged projections,
catalog/tool compatibility, then approvals. The implementation loads the catalog first, so a
malformed catalog hides a decision error. Decision: load and check the catalog only after the
decision validation and the non-runtime projection checks. The tests lane adds one competing-errors
case (invalid decisions plus malformed catalog reports the decision error).

### I3-5. Coverage added and declined

The tests lane also adds: C3-P3-1 (a filesystem failure during commit's runtime tool-unit check
gives `APPLY_INPUT_IO` / 2 with the project-relative path) and C3-P3-5 (a migration starting with
non-empty deny omissions: an entry removed from `denyOmissions` needs the settings path approval,
`APPLY_APPROVAL_REQUIRED` with reason `approved omission records change`, and is removed after
approval; an equal list requests no omission change).

Declined as narrow subcases of covered categories: conflicting settings denies and preservation
of unrelated pre-staged settings fields in stage, renderer or snippet changes in the
changed-source mismatch tests, first-projection precedence, and a newly cataloged unbound target
in the prepared diff.

## Review round 2 (Codex, 2026-10-18): I3-6

The re-review confirmed C3-R1, C3-R2 and C3-R3 fixed and allowed the four judgment calls of the
round. It reported one NON-BLOCKING finding, C3-R4: I3-3 says "F envelope with `target` in
`apply.mjs`", while prepare reports `MIGRATION_PROTECTED_INPUT` as an entry of
`APPLY_PLAN_REJECTED.errors`.

### I3-6. Prepare reports MIGRATION_PROTECTED_INPUT in its P envelope (C3-R4)

The I3-3 wording was imprecise. Every prepare refusal since C2 uses the P envelope
(`APPLY_PLAN_REJECTED` with an `errors` entry), and so does `MIGRATION_REQUIRED`; the F envelope
belongs to diff and commit. Decision: in prepare, `MIGRATION_PROTECTED_INPUT` is a P entry with
`target` and the I3-3 text, exit 3; the F envelope with `target` applies to the unprepared and
prepared reviews. The implementation and the tests already do this; no code or test change.
