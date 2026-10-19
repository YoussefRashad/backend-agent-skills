# C5 review decisions

Decisions taken during the C5 implementation review. The frozen plan
`docs/plans/2026-10-19-project-setup-v3-rc1-c5.md` is not edited; where an item below and the plan
differ, the item wins.

## Review round 1 (Codex, 2026-10-19): I5-1 and I5-2

The review found no BLOCKING issue and two NON-BLOCKING findings, both about the injectable
filesystem seam of section 2.6, which no CLI or environment variable exposes. The maintainer
accepted the first as recorded behaviour and took the second as a fix.

- I5-1 (C5-R1). The section 2.6 filesystem seam keeps exactly the ten listed methods; `readSync`
  is not added to it. The C5-P2-9 bounded first read (`min(size, 8000)` bytes, then the binary
  decision, then the size limit) is guaranteed on the default Node filesystem, which always
  provides `readSync`. A supplied seam may additionally provide `readSync`, which is then used for
  the bounded read. A supplied seam without it falls back to the whole-body read under the same
  size limits, so an untracked file above 1,048,576 bytes is refused with `GIT_SAFE_LIMIT` even
  when it is binary. This is an accepted test-seam limitation, not a production behaviour: no code
  change, and no test change.
- I5-2 (C5-R2). Section 2.6 states "Malformed filesystem return values give `REVIEW_IO`". The
  identity fields of every `lstatSync` and `fstatSync` result used for the section 3.7
  same-file check are validated before comparison: `dev` and `ino` must each be a non-negative
  integer-valued number (`Number.isInteger`, not `isSafeInteger`: Windows file IDs can exceed
  2^53) or a non-negative bigint, otherwise the result is malformed and gives `REVIEW_IO`
  before any body read. Tests add seam cases with `dev` or `ino` missing (and one with a
  non-numeric value) on the untracked path, asserting `REVIEW_IO`, empty stdout and no body read.

## Review round 2 (Codex, 2026-10-19): I5-3

The review found no BLOCKING issue and confirmed I5-2. One NON-BLOCKING finding remains, accepted by
the maintainer as a residual.

- I5-3 (C5-R3). The publication-side identity comparisons (`checkIgnore` before the self-ignore
  file is trusted, and `removeOwn` before an artifact is unlinked on cleanup, sections 3.10 and
  3.11) do not validate `dev` and `ino` as I5-2 does for the section 3.7 check. Only a supplied
  filesystem seam returning results without identity fields can make two such results compare
  equal; the default Node filesystem always provides them, and no CLI or environment variable
  exposes the seam. Accepted test-seam residual: no code change, and no test change.
