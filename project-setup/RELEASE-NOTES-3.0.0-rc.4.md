# project-setup 3.0.0-rc.4

Release candidate containing C17: reviewer HEAD identity and Git ownership diagnostics.
Final 3.0.0 remains gated on the post-release measurements below.

## Changes

- git-safe head prints the checkout's resolved HEAD commit ID.
- The reviewer uses that helper and stops when identity cannot be established.
- The equal-head warning and review-diff header remain unchanged.
- Recognized dubious repository ownership returns GIT_SAFE_OWNERSHIP with a fixed remedy.
- Environment-injected Git configuration remains stripped.
- Living references explain the effective global or system safe.directory prerequisite.
- Dated host notes distinguish Claude headless 2.1.310 from TUI 2.1.311.

## Compatibility and rollback

The project manifest schema remains 3. C17 adds no policy or apply migration.

Upgrade the known v2 project together with its skill. V2 validation rejects manifest schema 3.
This is a compatibility signal, not a retrofitted pre-write guard in every old command.
Do not use v2 commands to repair a schema-3 project.

Roll back project state with the tooling used for the update before reverting the installed
skill. If later independent runs exist, roll them back newest first. Do not split this
migration into successive manifest commits.

Existing rc.1, rc.2 and rc.3 projects receive reviewed managed drafts through normal update.
Stage the complete seven-file runtime unit and current canonical reviewer together.
User edits retain their approval protection. Keeping an old required member is an
incomplete update. All four wrappers and the canonical docs-sync remain unchanged from rc.3.

The head form is additive. Raw rev-parse remains unsupported by git-safe.
GIT_SAFE_OWNERSHIP is a stop condition, not permission to retry or edit Git configuration.
The bounded correction whitelist remains GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN only.
The rc.3 ERE compatibility guidance still applies to projects upgrading from rc.1 or rc.2.

## Verification

Run node tests/accept-rc1.mjs for complete candidate acceptance.
The rc.1 case names and accept-rc1.mjs are retained for rc.4.
C17 contributes through R29 without adding numbered case records.

Required totals are 100 PASS / 0 FAIL / 0 SKIP, or 99 PASS / 0 FAIL / 1 SKIP with only the
recorded Windows R13d file-symlink privilege exception. No rc.1 case may skip.
R91 must retain real Windows junction coverage.

The acceptance record identifies executed commands, tested bytes, results and evidence.
Static instruction tests and evaluation objects do not prove agent behavior.

## Pending host measurements

After release, run Claude TUI P3 h as a root-started, multi-turn cd-then-review case.
Run Claude L08 change-1 and change-2. Require completed reviews and correct equal-head
warnings, with no raw-Git substitution or omitted HEAD comparison.

Run one Codex change-1 review under the existing approved isolated elevated-sandbox setup.
Require a completed review, the lost-update finding and the equal-head warning.

Measure ownership failure and success through the actual Codex sandbox, without and with
an exact fixture safe.directory entry in its isolated global config. The failure must
emit GIT_SAFE_OWNERSHIP without repository content. The granted case must resolve HEAD
and complete the selected review.

Claude Code 2.1.311 is a new measurement scope. Record actual versions again.
These measurements block final 3.0.0, not rc.4 implementation acceptance.

## Limitations

The rc.3 measurements on 2026-10-26/27 used Windows 11, codex-cli 0.163.0, Claude Code
2.1.310 headless and 2.1.311 TUI. R83-e passed by instruction and both Codex L10 reviews
completed. Two Claude reviews remained partial because HEAD identity was skipped.

Root settings still did not load for a subdirectory start. L16 remains instruction-only.
Its above-root, outside-root and uncertain-launch-context residuals remain unchanged.
Missing Node failed open. Tool deny rules did not protect Claude subprocess reads.
The Codex profile row remains blocked; negative-capability evidence remains limited.
macOS, Linux and WSL2 remain unverified for these measurements.

Ownership recognition requires the exact English fatal prefix at the start of stderr.
Localized or prefixed diagnostics can retain GIT_SAFE_REPOSITORY. No failure grants access.
An exact safe.directory entry does not narrow an existing wildcard entry.

C16's malformed-configuration pattern-classification residual, Git 2.31 probe-floor
limitation and unverified regex platforms remain unchanged.
Existing trusted-checkout, path-policy and agent-read confinement limitations remain.
No backend-standards scaffold integration is established by this component.

## Provenance and release artifacts

The local release builder uses an existing reviewed tag and an unused external directory.
It does not create tags, install the skill or publish a release.

The tagged subtree ID, archive SHA256, installer payload hash and backup snapshot digest
identify different bytes. Publication notes record the resolved release identities.
Historical release notes and frozen plans remain unchanged.
