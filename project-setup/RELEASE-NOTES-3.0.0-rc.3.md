# project-setup 3.0.0-rc.3

Release candidate containing C16: root-start instructions and git-safe review usability.
Final 3.0.0 remains blocked on the post-release R83-e and A3/L10 measurements below.

## Changes

- Root Claude instructions require a repository-root session start.
- A positively established subdirectory start must stop and request a root restart.
- The nested Claude template and its sibling import remain unchanged.
- git-safe grep uses extended regular expressions instead of basic regular expressions.
- A status-128 grep content failure with empty stdout triggers an empty-tree pattern probe.
- cat retains one path per call and prints that requirement on argument rejection.
- Reviewer and docs-sync may correct ARGUMENT and PATTERN rejections within a bounded budget.
- Both Codex wrappers recognize only that canonical bounded-correction exception.
- Corrections never add --out or widen paths; other failures retain stop and no-fallback rules.
- Living references record the dated Windows host measurements and remaining unknowns.
- The hooks-selftest entry-guard comment marks 8.3 short-name behavior untested.

## Compatibility and rollback

The project manifest schema remains 3. C16 adds no policy or apply migration.

Upgrade the known v2 project together with its skill. V2 validation rejects manifest schema 3.
This is a compatibility signal, not a retrofitted pre-write guard in every old command.
Do not use v2 commands to repair a schema-3 project.

Roll back project state with the tooling used for the update before reverting the installed
skill. If later independent runs exist, roll them back newest first. Do not split this
migration into successive manifest commits.

Existing rc.1 and rc.2 projects receive reviewed managed drafts for the changed instructions,
both Codex wrappers and the complete seven-file runtime unit. User edits keep their normal
approval protection. Keeping old instructions means an incomplete update.
Both Claude wrappers remain unchanged.

grep patterns must be checked for ERE meaning before reuse. a|b now alternates; a\|b matches
a literal vertical bar. Empty patterns and leading-dash patterns retain their accepted forms.
A valid BRE can be invalid ERE. \d is not a digit class; use [0-9].
GIT_SAFE_PATTERN permits only the canonical agents' bounded same-helper correction.
GIT_SAFE_GIT retains its unchanged operational-failure message and is never retry authority.

## Verification

Run node tests/accept-rc1.mjs for complete candidate acceptance.
The rc.1 case names and accept-rc1.mjs are retained for rc.3.
C16 contributes through R29 without adding numbered case records.

Required totals are 100 PASS / 0 FAIL / 0 SKIP, or 99 PASS / 0 FAIL / 1 SKIP with only the
recorded Windows R13d file-symlink privilege exception. No rc.1 case may skip.
R91 must retain real Windows junction coverage.

The acceptance record identifies executed commands, tested bytes, results and evidence.
Static instruction tests and evaluation objects do not prove agent behavior.

## Pending host measurements

After release, re-measure R83-e on the existing fixture. A subdirectory-started Claude
session must refuse by instruction and request a root restart before any tool or file read.
Root-started cases, including a later cd within the project, must still pass without a
false launch refusal. Repeat the root and subdirectory cases in the interactive TUI with
the maintainer; pre-freeze headless probes do not establish TUI behavior.
Include multi-turn TUI cases that change directory before reading or spawning the reviewer.

Re-run both Codex L10 reviews. Both must complete without an incomplete verdict.
The change-1 lost update in WalletLedger.transfer must be a HIGH or CRITICAL finding with
a concrete concurrent-debit scenario. The control range must have no money-integrity finding.
The root-started Claude L08 reviews must not falsely refuse because of the launch rule.
Record completeness for both Claude ranges; rc.2 change-2 was self-declared partial.

These measurements block final 3.0.0, not rc.3 implementation acceptance.

## Limitations

The launch refusal is weaker than host enforcement. Probes P1/P2 were model self-reports.
The 2026-10-24/25 Windows measurements used Claude Code 2.1.310 and codex-cli 0.163.0.
The separate instruction-loading probes and corrected grep diagnosis are dated 2026-10-25.
A start above or outside the target root may load its instructions only after an initial read.
The nearest-at-or-above comparison does not refuse that start even after the rule loads.
Missing launch context alone neither establishes a refusal condition nor verifies controls.
Commit installed setup before worktree sessions so new worktrees have their own instructions.

Claude root-started hook behavior passed on that host; subdirectory starts lacked controls.
Missing Node failed open. Claude subprocess reads were not protected by tool deny rules.
Codex profile enforcement remained blocked; its negative-capability measurement was
inconclusive. macOS, Linux and WSL2 remain unverified for these measurements.

P4 verified empty-tree behavior on Git 2.53.0.windows.2 in SHA-1 and SHA-256 repositories.
The Git 2.31 floor and macOS/Linux regex engines remain unverified.
Malformed grep.*, color.grep, color.grep.<slot>, color.ui or submodule.recurse configuration
can fail before command-line options take effect. Such a failure can also fail on the empty
tree and be classified GIT_SAFE_PATTERN; the bounded corrections still stop without content
or fallback access.
Existing path-policy, trusted-checkout and agent-read confinement limitations remain.
No backend-standards scaffold integration is established by this component.

## Provenance and release artifacts

The local release builder uses an existing reviewed tag and an unused external directory.
It does not create tags, install the skill or publish a release.

The tagged subtree ID, archive SHA256, installer payload hash and backup snapshot digest
identify different bytes. Publication notes record the resolved release identities.
Historical release notes and frozen plans remain unchanged.
