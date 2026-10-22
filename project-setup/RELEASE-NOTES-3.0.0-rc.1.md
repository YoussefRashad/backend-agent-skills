# project-setup 3.0.0-rc.1

This is the security and permissions release candidate. Publication is a separate authorized
action; automated acceptance does not authorize a tag, upload or deployment.

## Changes

- Anchored policy matching, synchronized controls and reviewed policy migration.
- Trusted-checkout Git reads, bounded review results and confined review artifacts.
- Claude raw-Git hooks, direct self-tests and shared allow classification and retirement.
- Shipped v2 comparison data and reviewed agent and wrapper customization migration.
- Script-only root-template handling that preserves existing values.
- Validation and doctor diagnostics with explicit evidence limits.
- Complete candidate case composition, installed-payload checks and reproducible local ZIPs.
- Rerun-safe installed policies, junction-safe script entry checks and `--config-env` alias blocks.

## Compatibility and rollback

The project manifest schema is 3.
Upgrade the known v2 project together with its skill. V2 validation rejects manifest schema 3.
This is a compatibility signal, not a retrofitted pre-write guard in every old command.
Do not use v2 commands to repair a schema-3 project.

Roll back project state with the rc.1 tooling before reverting the installed skill. If later
independent runs exist, roll them back newest first. Do not split this migration into
successive manifest commits.
Keep recovery material until the user confirms the update. Incomplete rollback preserves later
user edits and requires retaining the unresolved backups.

## Verification

The complete automated gate requires 100 case results: 99 PASS / 0 FAIL / 1 SKIP when R13d
cannot create a Windows file symlink, or 100 PASS / 0 FAIL / 0 SKIP when it can.
No rc.1 case may skip. R91 requires real junction coverage on Windows.
Actual automated results, environment and evidence paths are recorded by accept-rc1.mjs;
the required totals in this document are not a claim that an unrecorded run passed.
The release builder alone does not establish automated acceptance.

## Pending host measurements

TO VERIFY: R83; R44/R74 host enforcement; R51 Claude continuation and stderr handling;
A3 trusted-checkout live review; A5 host negative capability.
Synthetic doctor fixtures, direct Node hook tests and static instructions are not host proof.
These measurements remain pending and block final 3.0.0, not rc.1 implementation acceptance.

## Limitations

Path policy cannot detect secret content copied or hard-linked under an allowed name.
The raw-Git hook is an incomplete shell parser and depends on a trusted checkout.
Agent instructions and configuration checks do not create an operating-system sandbox.
Doctor results describe the measured configuration, processes and permitted historical log;
they do not establish the behavior of a future launch.

## Provenance and release artifacts

Historical v2 provenance is retained in the frozen design and architecture records.
The historical v2 archive is not rebuilt or replaced.
The local release builder records tag, commit, subtree identity and archive SHA256 only in
external publication notes. Those notes and the ZIP remain outside the source skill tree.
