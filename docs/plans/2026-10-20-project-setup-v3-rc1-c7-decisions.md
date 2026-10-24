# C7 review decisions

Decisions taken during the C7 implementation review. The frozen plan
`docs/plans/2026-10-19-project-setup-v3-rc1-c7.md` is not edited; where an item below and the plan
differ, the item wins.

## Review round 1 (Codex, 2026-10-20): I7-1 to I7-3

The review found no BLOCKING issue and two NON-BLOCKING findings, allowed seven of the eight
implementer judgment calls and listed four coverage gaps. The maintainer recorded both findings
without a code change and recorded the coverage gaps as residuals.

- I7-1 (C7-R1, recorded behaviour). The `--retire-allow-file` selection path is walked below its
  shallowest ancestor whose native real path is the project root, and every link or junction below
  that ancestor is refused as `ALLOW_STAGE_PATH`. A link or junction outside the project that
  points directly at the project root therefore becomes that ancestor and is accepted. This is the
  same spelling as a project opened through a junctioned or 8.3 path, which must keep working, and
  the two cannot be told apart from the path. The read itself still passes native canonical
  containment, the drafts and vault exclusion and the shipped-plus-installed refusal set on both
  the canonical and the supplied spelling, so no protected or outside file is read. No code change
  and no test change.
- I7-2 (C7-R2, recorded behaviour, inherited). Discovery (`detect.mjs`) and the normal merge read
  the installed `.ai/manifest.json` without a name-protection check and without refusing a linked
  manifest leaf. These reads are unchanged from 35c8d9e and are not a C7 regression. The manifest
  is a fixed control input, exempt from name protection, as in C3's detect and in the frozen C10
  plan; link and containment checks on it belong to C10's validation. No code change in C7.
- I7-3 (coverage gaps, residuals). The frozen C7 tests do not cover: an outside junction that lands
  directly on the project root (I7-1); protected, linked and ordinary I/O failures on the normal
  order guard's `omissions.json` (its JSON, container and duplicate-identity failures are covered);
  an explicit single shared-settings body read in successful discovery; and the exact section 3.9
  outcome for retirement combined with `--hooks-only` and for a missing `--run-id`, where two usage
  cases accept a weaker outcome. The tests are frozen and stay unchanged; C11b acceptance may add
  these cases.

Implementer judgment calls a, b and d to h were allowed as implemented: the `ALLOW_INPUT` message
texts `ALLOW_INPUT: invalid allow inspection input` and `ALLOW_INPUT: invalid allow retirement
input`; a missing selection file read as `ALLOW_STAGE_IO` (exit 2) and a selection resolving to the
project root as `ALLOW_STAGE_PATH` with target `.`; both spellings of the selection checked for
protection; request validation in staging and in the order guard; an emptied allow array kept as
`[]`; detect's read failure reported after the protection check; and a C2 reader error from
`retireManagedAllows` mapped to `ALLOW_STAGE_MANIFEST`. Call c is I7-1.
