# C15 decisions

Decisions taken at and after the freeze of C15. The frozen plan
`docs/plans/2026-10-23-project-setup-v3-rc2-c15.md` is not edited; where an item below and the plan
differ, the item wins.

## Freeze (2026-10-24): Q1, Q2

- Q1 (maintainer decision before the freeze). Recorded verbatim in the wording of C15-20:

  ```text
  Q1: DECIDED on 2026-10-24: a missing guard is reported only in the reviewer's existing
  vocabulary, as a suggestion with severity INFO that on its own never makes the verdict block.
  No new marker or Recommendation label is added. A currently misread fallback keeps its normal
  classification, severity and verdict effect.
  ```

- Q2 (maintainer decision before the freeze): yes. A six-descriptor C15 component, a pure amendment
  helper, a two-agent fixture, and a target of 50 harness-counted launches and 30 seconds.
- Freeze-time wording (plan-critique round 3, gap G16, NON-BLOCKING): the C15-10 and C15-17
  sentences that pointed at round files not kept in the repository were reworded at the freeze to
  name the C15-13 JSON lines and the inspected HEAD line numbers directly. No rule, literal, pin,
  digest or count changed.
- Pre-freeze probes P1-P4 (C15-17), run by the orchestrator read-only on Node v24.14.1 against
  HEAD `86621ff2628b75528907ab34fab56a2e874d2e1f`, all passed:
  - P1: the evaluation prefix digest is
    `1f7a9ddae2c71d1de3a61ee64541fc8924e739f1fad134d25610bfd2b9394f7a`. The fixture digest
    `79e0c2dd...e3ad` was recomputed by the planning and critique lanes; the orchestrator
    repeats it after the fixture exists.
  - P2: `eol: lf` for all eight paths (the four amended files, `evals/evals.json` and the three new
    test paths).
  - P3: the HEAD blob equals the working tree for the four amended files.
  - P4: HEAD `evals/evals.json` with the three C15-13 lines spliced in parses to 33 evaluations
    with ids 1-33, the prefix digest is unchanged, and evaluation 31 is unchanged apart from the
    separator comma.
