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
  `feat/project-setup-v3-rc2` is recreated from that head. The historical `RC1_*` constants of C13-16
  hold the rc.1 bytes as they stand after that batch. Line citations in the frozen plan refer to
  `8b9b477`; where the batch shifts a cited line, the cited text, not the line number, is the
  anchor.
