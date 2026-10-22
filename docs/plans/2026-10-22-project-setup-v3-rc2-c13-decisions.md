# C13 decisions

Decisions taken at and after the freeze of C13. The frozen plan
`docs/plans/2026-10-22-project-setup-v3-rc2-c13.md` is not edited; where an item below and the plan
differ, the item wins.

## Freeze (2026-10-22): I13-1, I13-2

- I13-1 (maintainer decision at the freeze, plan-critique round 4 gaps NB1 and NB2, both
  NON-BLOCKING). The frozen stack-prerequisite paragraph of C13-8 does not define "frozen" in the
  installed wording, and leaves the specificity of the assignment to the reviewer's judgment. In
  that paragraph's text block, directly after the sentence ending "explicitly assigns that work to
  the later component.", the installed reviewer wording gains these two sentences, exactly:

  ```text
  A record counts as frozen only when the project's own records mark it frozen (for example a
  frozen plan in the project's plans directory); a draft, a TODO entry or an unmarked note is not
  one, and the finding stays a normal finding. The quoted sentence MUST name the specific missing
  work and the component that owns it; an assignment of a category of work ("C14 handles
  validation") is non-assigning.
  ```

  The tests lane asserts both sentences in the rendered reviewer, and adds to evaluation 22's
  controls one unmarked record (a draft or a TODO entry at the merge-base) and one category-level
  assignment, each of which leaves a normal finding with its normal severity and verdict effect.
  No other C13 text, count or identifier changes beyond what those two controls require.
- I13-2 (maintainer decision, 2026-10-22: the rc.1 fix batch lands first). The rc.1 fix batch from
  the final pre-PR review of 3.0.0-rc.1 (CHANGELOG and release-notes mention of the APPLY_PATH
  alias refusal, the README sharing checklist, the accept-rc1 timeout headroom record, and four
  wording fixes) is committed on `feat/project-setup-v3-rc1` before the C13 tests lane starts, and
  `feat/project-setup-v3-rc2` is recreated from that head. The historical `RC1_*` constants of
  C13-16 hold the rc.1 bytes as they stand after that batch. Line citations in the frozen plan refer
  to `8b9b477`; where the batch shifts a cited line, the cited text, not the line number, is the
  anchor.

## Tests lane (2026-10-22): I13-3

- I13-3 (orchestrator readings of plan gaps the tests lane reported, recorded so the implement lane
  and review use the same ones; no maintainer decision is involved). (1) The two I13-1 controls are
  two `files` entries in evaluation 22 after the existing assigning-record controls, with one
  matching sentence in its `expected_output` after the existing exemption sentence. (2) `@throws`
  is written as code (`` `@throws` ``) in the installed reviewer, as C13-8's source note says; a
  bare tag is refused. (3) The working-scope paragraph of C13-6 is asserted by presence in the
  reviewer only, since the plan names no section. (4) The in-range HIGH control is asserted
  through the frozen sentences "A record added or modified in that range cannot authorize the
  label." and the "normal finding" sentence, with the unchanged verdict rule. (5) Placement: the
  `references/claude.md` paragraph anywhere in that file; the external-review block in section 2
  of `references/security.md` with its limits paragraph directly after it; the development-rules
  requirements directly after the context table of `references/docs-generation.md`. (6)
  `evals/evals.json` is a tests-lane file, as in C12. (7) Removed-by-user, conflict and
  empty-repository development-rules cases are agent-instruction behaviour and are tested as
  instruction text; creation, merged edit, zero diff and the approval gate run through the real
  apply workflow.

## Review (2026-10-22): I13-4

- I13-4 (orchestrator decision under the maintainer's rule that protection is sized to the real
  threat; review findings C13-R2 and C13-R3, both NON-BLOCKING, round 2). After the C13-R1 fix,
  the prose checks in `tests/c13.test.mjs` still exempt a line inside a `text` or unlabeled fence
  when it starts with a command name (`git`, `node`, `npm`, `npx`, `gh`), even when it is English
  prose (C13-R2), and the fence parser tracks only backtick fences, so a `~~~` fence that contains
  a backtick fence line can leave later prose classed as code (C13-R3). Neither affects shipped
  text: every C13 addition meets the ASCII and 100-column limits, which the review confirmed. Both
  are recorded as residuals of the test helper, not fixed in C13; the next change to
  `tests/c13.test.mjs` narrows the command exemption to command examples and tracks fence type and
  length, with negative controls for both.
