# C8 review decisions

Decisions taken during the C8 implementation review. The frozen plan
`docs/plans/2026-10-19-project-setup-v3-rc1-c8.md` is not edited; where an item below and the plan
differ, the item wins.

## Review round 1 (Codex, 2026-10-20): I8-1 and I8-2

The review found no BLOCKING issue and one NON-BLOCKING finding, allowed all seven implementer
judgment calls and listed coverage gaps. Both items were taken overnight by the orchestrator under
the maintainer's delegation for low-risk recorded behaviour, and are open to the maintainer's
review.

- I8-1 (C8-R1, recorded behaviour). `verifyAgentBaselines` and `main` reject a `skillRoot` option
  defined as an accessor (getter) with `AGENT_BASELINE_INPUT`, although section 3.7 only requires
  the prototype, the single own key and an absolute nonempty string without NUL. The stricter rule
  stays: a getter can return a different value on each read, so validating one read and using
  another would separate the checked root from the read root. Ordinary CLI and object-literal
  callers are unaffected. No code change and no test change.
- I8-2 (coverage gaps, residuals). The frozen C8 tests do not record filesystem calls during
  invalid API-option cases (validation-before-I/O ordering is shown by the code, not proven by a
  recorder); do not inject a native-realpath or root-stat failure for an unreadable root; have no
  positive case for an accessor option (I8-1); do not assert that no empty `reviewer.project.md`
  is created when no customization is approved; and skip the file-symlink leaf when the host lacks
  symlink privilege (junction coverage stays mandatory). Agent stopping, collision decisions,
  `keep-file` and host connector absence remain evaluation and live obligations, as the plan
  states. The tests are frozen and stay unchanged; C11b acceptance may add these cases.

Implementer judgment calls a to g were allowed as implemented: README keeps the section 3.5
launcher wording while `references/codex.md` carries the C8-P4-4 paragraphs; the checker opens the
leaf and requires an fstat dev and inode match with the lstat result before reading; a regular file
in a directory position is INVALID, a dependencies object other than `{}` fails as INPUT (exit 3)
and an unexpected exception is rethrown; `### C8 review guidance` sits after the `.gitignore`
paragraph in `references/security.md`; names-only discovery is in SKILL.md Phase 0, hooks-only
staging is documented for migration runs and the hard-link paragraph also appears in the security
guidance; `references/modes.md` gains an `invalid` row; and docs-sync keeps the pinned stdout
sentence followed by "Docs-sync follows the same rule."
