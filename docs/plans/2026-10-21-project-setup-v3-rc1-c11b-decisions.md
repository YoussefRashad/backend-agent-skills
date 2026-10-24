# C11b decisions

Decisions taken during the C11b tests and implementation. The frozen plan
`docs/plans/2026-10-20-project-setup-v3-rc1-c11b.md` is not edited; where an item below and the
plan differ, the item wins.

## Tests lane (2026-10-21): I11b-1 and I11b-2

- I11b-1 (maintainer decision, plan section 3.2). The plan sets `GIT_CONFIG_GLOBAL=<os.devNull>`
  in the release builder's isolated Git environment. On Windows, Node's `os.devNull` is
  `\\.\nul`, and Git for Windows rejects that value for `GIT_CONFIG_GLOBAL` with exit 128 ("unable
  to access"), so a literal builder could not run Git on the team's hosts. The builder sets
  `GIT_CONFIG_GLOBAL=NUL` on win32 and `os.devNull` elsewhere. The intent is unchanged: no global
  configuration is read. Every other environment entry stays exactly as pinned, and
  `core.attributesFile=<os.devNull>` is unchanged because Git accepts it. The C11b tests accept
  either value for this one variable.
- I11b-2 (test scope, recorded). Beyond section 5.9, the documentation check pins SHA-256 values
  (CRLF-normalized, post-C10 bytes) for the historical CHANGELOG suffix, SKILL.md with its heading
  restored, the retained README sections and top overview, `install/install.mjs` and
  `RELEASE-NOTES-2.0.0.md`. Any other edit to those files fails the check; a deliberate later edit
  must update the pin in the same change.

## Review round 1 (Codex, 2026-10-21): I11b-3

The review found no BLOCKING issue and no finding in the release implementation, and allowed all
eight implementer judgment calls. Its two NON-BLOCKING findings concern the committed integration
test code.

- I11b-3 (C11b-R1, C11b-R2, residuals, maintainer decision). Section 4.1 asks the composer to
  report the first diagnostic in component and check order. In `tests/helpers/rc1-integration.mjs`
  a missing assertion is reported before a reordering of the retained results, and in
  `tests/rc1-cases.mjs` a later component's execution or evidence-write rejection is reported
  before an earlier component's failed or malformed report, because composition runs after every
  provider resolves. Both only change which diagnostic names a case that already fails; neither
  can turn a failing case into a PASS. The tests are frozen and stay unchanged; a later change may
  reorder the checks and add the combined cases.

Implementer judgment calls 1 to 8 were allowed as implemented: Git's top-level output must be an
absolute path before canonicalization; output containment is checked against `project-setup` and
`.git` under both repository spellings; the destination-absence check runs on both spellings even
when they coincide; an undefined dependency value counts as omitted while `null` and other invalid
values give `RELEASE_OPTIONS`; the dependencies argument and `env` must be plain or null-prototype
objects and `fs` must hold exactly the four members; an unexpected internal exception maps to
`RELEASE_WRITE`; the CLI runs only when the process entry resolves to the file itself; and VERSION
and the notes are decoded as fatal UTF-8 with an explicit BOM rejection.

Coverage gaps recorded as residuals (no test change): the combined diagnostic cases above; Git
top-level output without a line terminator, a successful Git result with nonempty stderr, and
extra executor-result fields; registration checks that do not intercept all filesystem and process
activity; write-failure immutability runs that replay recorded Git results instead of repeating
real Git operations; and the exact C11b CLI record block, which the writable acceptance run
verifies.
