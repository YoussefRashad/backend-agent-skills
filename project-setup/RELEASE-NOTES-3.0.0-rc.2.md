# project-setup 3.0.0-rc.2

This is the review rules and project-rules integration release candidate, following the rc.1
security and permissions work.
Publication is a separate authorized action; automated acceptance does not authorize a tag,
upload or deployment.

## Changes

- Adversarial, Consumer, Boundary and Contract passes in the shared canonical reviewer.
- Reachable findings beyond the plan and checks for every sibling instance of a defective pattern.
- Unknown values, throwing-logger handling, monotonic deadlines and promise-rejection checks.
- Capture-once validation through bounded named-field projections, including reachable getter cases.
- Per-item fault isolation that preserves healthy siblings and restores shared state.
- Stack prerequisites only for work explicitly assigned by a cited frozen plan or amendment.
- Fallback tests using real downstream validators and outcomes with their defined contract meaning.
- Trusted class labels in logs without changing the project's policy for permitted log payloads.
- Computed-overflow handling and row validation that prevent invalid output and poisoned batches.
- Living documentation updates when an in-range frozen plan or spec records drift.
- External-review exclusion and scanning prerequisites and guidance for blocked review preambles.
- Generated contract-testing standards and test-run hygiene through reviewed merged updates.
- Optional docs-sync project rules with reviewed merged ownership and canonical-rule precedence.
- Backend-standards adoption preserving project rules, Claude imports and the version stamp.
- C13 prose-check fixes for command-prefixed prose and mixed Markdown fence delimiters.
- External-review exclusion and scanning prerequisites in installed root AGENTS.md instructions.
- C15 client-visible value and response-path checks, with repairs across permitted living docs.
- C15 Adversarial pass checks for hand-copied value sets without exhaustiveness guards.

## Compatibility and rollback

The project manifest schema is 3. C13, C14 and C15 add no policy or apply migration.
Upgrade the known v2 project together with its skill. V2 validation rejects manifest schema 3.
This is a compatibility signal, not a retrofitted pre-write guard in every old command.
Do not use v2 commands to repair a schema-3 project.

Existing projects receive the instructions through reviewed managed updates. User-modified
canonical files require explicit dispositions. Keeping an old canonical file leaves that
instruction update incomplete. Project-owned reviewer and docs-sync rules remain intact.
A missing docs-sync project file is created only when content is explicitly approved.
Existing extension files are preserved; routine updates do not regenerate them.

Roll back project state with the tooling used for the update before reverting the installed skill.
If later independent runs exist, roll them back newest first. Do not split this migration into
successive manifest commits.
Keep recovery material until the user confirms the update. Incomplete rollback preserves later
user edits and requires retaining the unresolved backups.

## Verification

The complete automated gate requires 100 case results: 99 PASS / 0 FAIL / 1 SKIP when R13d
cannot create a Windows file symlink, or 100 PASS / 0 FAIL / 0 SKIP when it can.
No rc.1 case may skip. R91 requires real junction coverage on Windows.
The rc.1 case names and accept-rc1.mjs are retained for rc.2.
C13, C14 and C15 contribute through R29 without adding numbered case records.
Actual automated results, environment and evidence paths are recorded by accept-rc1.mjs;
the required totals in this document are not a claim that an unrecorded run passed.
The release builder alone does not establish automated acceptance.
Static instruction checks and evaluation expectations do not prove agent behavior.

## Pending host measurements

TO VERIFY: R83; R44/R74 host enforcement; R51 Claude continuation and stderr handling;
A3 trusted-checkout live review; A5 host negative capability.
Synthetic doctor fixtures, direct Node hook tests and static instructions are not host proof.
These measurements remain pending and block final 3.0.0, not rc.2 implementation acceptance.

## Limitations

Path policy cannot detect secret content copied or hard-linked under an allowed name.
The raw-Git hook is an incomplete shell parser and depends on a trusted checkout.
Agent instructions and configuration checks do not create an operating-system sandbox.
Doctor results describe the measured configuration, processes and permitted historical log;
they do not establish the behavior of a future launch.
Blocked review-preamble loading is observed workflow evidence, not new host verification.
External-review prerequisites are installed in the root AGENTS.md managed block. No wrapper or
automated preflight enforces them, and canonical reviewer and docs-sync instructions still
prohibit external transmission. Missing trusted defaults or policy evidence prevents external
review under these instructions. If trusted shipped defaults cannot be located, for example
because project-setup is not installed on the machine, the external-review tool is not run.

C14 supplies the PS extension interface. BS 3.0.0 and toolchain-config integration remain open.
Nothing has been verified on a real BS scaffold; synthetic tests do not establish that result.

## Provenance and release artifacts

Historical v2 provenance is retained in the frozen design and architecture records.
The historical v2 archive is not rebuilt or replaced.
Historical rc.1 release notes and changelog text remain unchanged.
The local release builder records tag, commit, subtree identity and archive SHA256 only in
external publication notes. Those notes and the ZIP remain outside the source skill tree.
