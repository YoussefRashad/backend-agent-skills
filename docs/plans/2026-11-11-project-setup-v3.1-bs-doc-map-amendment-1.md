# Amendment 1: advisory live verification (project-setup 3.1.0 BS doc-map)

Amends the frozen plan `docs/plans/2026-11-11-project-setup-v3.1-bs-doc-map.md`, which stays
unedited. **Maintainer decision, 2026-11-11** (in chat, after four review passes): make the live
helper's `verify` advisory. Where this amendment and the frozen plan conflict, this amendment wins.

## Why

Four review passes on the test-only live helper (`project-setup/tests/live/bs-doc-map.mjs`) each
closed the reported fail-open paths and found new ones (R1–R8, N1–N5, then N6–N13). The cause is the
same in every pass: `verify` tries to decide "complete" mechanically from Markdown heuristics and
reviewed evidence, and every unmodelled shape becomes a false "complete". A false "complete" is the
worst failure for the tool the maintainer uses to judge live acceptance. Making `verify` advisory
removes that class of failure instead of patching instances.

## What changes in §8 "Live workspace and helper contract"

1. `verify` is an **advisory evidence collector**. It MUST NOT report `passed`, `complete`,
   "compatible" or any wording that reads as an acceptance result, because a heuristic checker
   cannot prove the plan's semantic requirements.
2. It has exactly three outcomes:

   | Outcome                 | Meaning                                                                     | Exit |
   | ----------------------- | --------------------------------------------------------------------------- | ---- |
   | `not-evaluable`         | A required input is missing or invalid, or a read-boundary check refused it | 3    |
   | `findings`              | One or more automated findings                                              | 1    |
   | `no-automated-findings` | None found; the output MUST say "maintainer review required"                | 0    |

   `--expect-partial` keeps its meaning; its output says "expected partial outcome — maintainer
   review required", never complete PS compatibility.

3. The acceptance decision belongs to the maintainer, through the checklist in
   `project-setup/tests/live/BS-DOC-MAP-ACCEPTANCE.md`. The frozen §8 list under "The checker
   verifies" becomes the maintainer's review checklist; the helper assists with those items and
   records its evidence, but cannot close any of them by itself.
4. The frozen §8 sentence "Default verification requires complete conversion/recovery" is replaced
   by: the default expectation for the maintainer's review is complete conversion and recovery; the
   helper reports findings against that expectation.

## What does not change

- The safety rules of §8 apply to **every** read the helper makes, advisory or not: never read
  `.env*`, secrets or policy-denied paths; reject links and junctions; explicit inventories only.
  An advisory tool that reads outside the boundary is still unsafe. This covers the CLI's own
  `--baseline` / `--evidence` input files (review finding N6) and the full ancestor chain and
  canonical root of `--project` (N7). These remain BLOCKING-grade.
- `init`, `snapshot` and `seed` contracts are unchanged.
- The shipped skill (SKILL.md, references, canonical agents, wrappers, templates, scripts,
  installer, builder) is unchanged by this amendment.
- Stage 1 / stage 2 (§12 P2) are unchanged.

## Disposition of the pass-4 findings under this amendment

| ID  | Disposition |
| --- | ----------- |
| N6  | Fix: validate both input paths (protected names, policy, ancestor links) before reading. |
| N7  | Fix: validate the project's full ancestor chain and canonical root before any read. |
| N8  | Fix as a finding: observed activation signals that disagree with `evidence.layout`, or that `classifyLayout` holds, are a finding. |
| N9  | Fix as a finding: unresolved blanks in any referenced 03 section are findings. |
| N10 | Fix: a closing fence requires the CommonMark closing syntax; a file with an unclosed fence is not evaluable. |
| N11 | Fix as a finding where the scanner already applies: preservation and consolidation checks use visible text. Any remaining raw-text check is listed as a known limitation. |
| N12 | Known limitation: an approved heading rename produces a finding the maintainer resolves in review; the output and the acceptance document say so. |
| N13 | Fix as a finding: validate the manifest with the production `checkManifest`. `validate.mjs --json` results stay a maintainer-recorded item (frozen §8 already requires recording them). |

Known limitations the helper prints in its output footer and the acceptance document lists: the
Markdown scanner models a subset of CommonMark (unsupported shapes are not evaluable); approved
heading renames produce findings; the helper cannot judge factual accuracy against code.

## Acceptance for this amendment

- `node project-setup/tests/bs-doc-map.test.mjs` asserts that no input, evidence or project state
  makes `verify` print `passed`, `complete` or "compatible", and that every outcome line is one of
  the three outcomes with its exit code.
- The R1–R8 and N1–N13 probes stay as regression cases: each now yields `findings` or
  `not-evaluable`, never a pass.
- `BS-DOC-MAP-ACCEPTANCE.md` states that `verify` is advisory, lists the known limitations and makes
  the maintainer checklist the acceptance decision.
- The other gates of frozen §8 are unchanged.
