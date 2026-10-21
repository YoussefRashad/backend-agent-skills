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
