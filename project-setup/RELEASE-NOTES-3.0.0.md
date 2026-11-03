# project-setup 3.0.0

Final release of project-setup 3.0. The skill source is the rc.4 content: only the version
number and the release headings change. C17's reviewer HEAD identity and Git ownership
diagnostics were measured on the published rc.4; the results are below.

## Changes

- The skill ships exactly the rc.4 runtime unit, canonical agents, wrappers and references.
- git-safe head prints the checkout's resolved HEAD commit ID; the reviewer uses it.
- Recognized dubious repository ownership returns GIT_SAFE_OWNERSHIP with a fixed remedy.
- Environment-injected Git configuration remains stripped.
- VERSION, the SKILL.md heading and the README release text name 3.0.0.

## Compatibility and rollback

The project manifest schema remains 3. This release adds no policy or apply migration.

Upgrade the known v2 project together with its skill. V2 validation rejects manifest schema 3.
This is a compatibility signal, not a retrofitted pre-write guard in every old command.
Do not use v2 commands to repair a schema-3 project.

Roll back project state with the tooling used for the update before reverting the installed
skill. If later independent runs exist, roll them back newest first. Do not split this
migration into successive manifest commits.

Existing rc.1, rc.2, rc.3 and rc.4 projects receive reviewed managed drafts through normal
update. Stage the complete seven-file runtime unit and current canonical reviewer together.
User edits retain their approval protection. Keeping an old required member is an
incomplete update. All four wrappers and the canonical docs-sync remain unchanged from rc.3.

An rc.4 project needs no runtime change: the runtime unit and reviewer are byte-identical.
The head form is additive. Raw rev-parse remains unsupported by git-safe.
GIT_SAFE_OWNERSHIP is a stop condition, not permission to retry or edit Git configuration.
The bounded correction whitelist remains GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN only.

## Verification

Run node tests/accept-rc1.mjs for complete release acceptance.
The rc.1 case names and accept-rc1.mjs are retained for 3.0.0.

Required totals are 100 PASS / 0 FAIL / 0 SKIP, or 99 PASS / 0 FAIL / 1 SKIP with only the
recorded Windows R13d file-symlink privilege exception. No rc.1 case may skip.
R91 must retain real Windows junction coverage.

The dated results record is docs/plans/2026-11-02-project-setup-v3-rc4-host-measurements.md.
Run node tests/c18.test.mjs for the 3.0.0 assertions: the amendment layer over rc.4, the pinned
release notes and the release builder on this tree. It is standalone, not a registered component.
Static instruction tests and evaluation objects do not prove agent behavior.

## Host measurements on rc.4

Measured on 2026-11-02 with Windows 11, codex-cli 0.163.0, Claude Code 2.1.311 and 2.1.316
(it auto-updated during the run) and Node v24.14.1. The fixture checkout, refs, index, Git
files and isolated Git configuration were identical before and after every case.

- Git ownership through the Codex elevated sandbox: without a grant the diagnostic was
  GIT_SAFE_OWNERSHIP with no repository content and the reviewer stopped; with the exact
  fixture safe.directory entry, HEAD resolved and the review completed.
- Claude L08 change-1 and change-2: complete in headless and TUI, git-safe head used, no
  raw-Git substitution, the equal-head warning present for change-1 and absent for change-2.
- Claude TUI P3 h: the review completed through git-safe head with the correct warning.
- Codex change-1: complete, git-safe head used, warning present, no MCP calls or edits.

Two measurement criteria were not met. They are limitations of this release, not fixed in it:

- Codex rated the seeded lost update INFO and approved with changes in two of two runs,
  reasoning that no funding path reaches it. The Claude reviewers rated it HIGH or CRITICAL.
  The reviewer text does not require a MUST-rule money violation to keep its severity
  regardless of reachability.
- In TUI P3 h, the first reviewer refused to start after the parent changed into a
  subdirectory, reading that directory as the session start. The parent re-ran it from the
  root and the second review completed. This is the known L16 launch-rule residual.

A global user instruction that tells a parent never to ask a reviewer to run git-safe makes
the parent omit that step. Two TUI runs under such a global configuration produced partial
reviews and were repeated with an isolated Claude configuration directory.

## Limitations

The 2026-10-26/27 rc.3 measurements used Claude Code 2.1.310 headless and 2.1.311 TUI.
R83-e passed by instruction and both Codex L10 reviews completed.

Root settings still do not load for a subdirectory start. L16 remains instruction-only.
Its above-root, outside-root and uncertain-launch-context residuals remain unchanged.
Missing Node failed open. Tool deny rules did not protect Claude subprocess reads.
The Codex profile row remains blocked; negative-capability evidence remains limited.
macOS, Linux and WSL2 remain unverified for these measurements.

Ownership recognition requires the exact English fatal prefix at the start of stderr.
Localized or prefixed diagnostics can retain GIT_SAFE_REPOSITORY. No failure grants access.
An exact safe.directory entry does not narrow an existing wildcard entry.
A Codex shell command reports every nonzero exit as 1 on Windows, so the ownership stop is
identified by its diagnostic text, not its exit code.

C16's malformed-configuration pattern-classification residual, Git 2.31 probe-floor
limitation and unverified regex platforms remain unchanged.
Existing trusted-checkout, path-policy and agent-read confinement limitations remain.
No backend-standards scaffold integration is established by this release.

## Provenance and release artifacts

The local release builder uses an existing reviewed tag and an unused external directory.
It does not create tags, install the skill or publish a release.

The tagged subtree ID, archive SHA256, installer payload hash and backup snapshot digest
identify different bytes. Publication notes record the resolved release identities.
Historical release notes and frozen plans remain unchanged.
