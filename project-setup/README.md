# project-setup 3.0.0 - skill source

**Release 3.0.0.** See RELEASE-NOTES-3.0.0.md for compatibility, acceptance requirements,
the rc.4 host measurement results and the remaining limitations.

Secret-path controls are tool-level, not an OS security boundary: on Windows native a subprocess started by an agent
can still read secret files. Keep real secrets out of development working trees.

Single source for the shared Claude Code + Codex `project-setup` skill. Edit here, never in installed copies.

```
SKILL.md            entrypoint (workflow, rules, script index)
VERSION, CHANGELOG.md
references/         loaded on demand by the agent
assets/             agent definitions, wrappers, templates, project tools (git-safe)
data/               secret-paths.json (shipped default secret paths; an installed project policy adds its own)
scripts/            zero-dependency Node scripts (JSON output)
install/install.mjs installer (not copied into installs)
install/release.mjs local tagged ZIP and publication-note builder (not copied into installs)
tests/run-tests.mjs regression + success-path suite (not copied into installs)
evals/              agent-level scenarios (not copied into installs)
```

Reviews run from a trusted checkout (see "Trusted-checkout reviews" below), and the review lane has a launcher
prerequisite that instructions alone cannot meet ("Review-lane launcher prerequisite"). A project installed by
v2 is updated with `references/migration-v2.md`: `scripts/check-agent-baselines.mjs` first verifies the shipped
v2.0.0 agent and wrapper snapshots under `data/v2.0.0/`, and every installed customization then gets an
explicit, reviewed disposition.

Claude Code sessions MUST start at the target repository root. Starting in a subdirectory
can omit the root hook, deny rules and shared critical instructions. If started below the
root, stop and restart there before reading files or running Git or project tools; cd inside
the existing session does not repair its launch configuration.

You MUST commit the installed setup before starting worktree sessions, so each new worktree
can contain its own root instructions and settings. A worktree created before that commit
may lack its own CLAUDE.md and be refused under the outer checkout's loaded root rule.

## Claude raw-Git hook

The Claude raw-Git hook is a guardrail, not a sandbox. It blocks the documented raw-history
commands and standalone patch arguments while permitting ordinary orchestrator commands and
the seven git-safe commands. A separate raw-Git command after git-safe is still checked.
Setup draft review uses apply.mjs diff; git diff --no-index has no exemption.

Known gaps include sh -c, aliases, scripts that spawn Git and node -e. PowerShell gaps include
indirect or computed invocation, dynamically constructed command names, script blocks and
encoded commands. Backtick handling does not make this a complete shell parser.

Bash case statements are not parsed: a command containing one is reported as unparseable and
allowed with the malformed-input warning.

The installed candidate is node "$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs".
Measured on 2026-10-24/25 on Windows 11 with Claude Code 2.1.310: root-started sessions
applied the hook, its Bash|PowerShell matcher and deny rules, including after changing
directory within the project. Project paths with spaces and non-ASCII characters worked.
Exit 0 permitted, exit 2 blocked with its explanation, and exit 1 continued with a warning
visible to the user, not the model.
A session started in src/wallet did not load the root hook or deny rules. With Node missing,
the hook failed open and the model saw no warning. macOS and Linux remain TO VERIFY.
Direct Node self-tests do not establish host loading or enforcement. See references/claude.md
for the itemized measurements and the separate 2026-10-25 instruction-loading probes.

The hook executes project code and therefore depends on the trusted-checkout boundary.

The hook contract, the conditional insertion, `--hooks-only` staging and the installed self-test are described in
`references/claude.md` ("Hooks").

Additional raw-Git hook gaps include options to the `env`, `exec`, `time` and `command`
prefixes, which are not interpreted, for example `env -i git log`. Git commands outside the
frozen blocked list can still print history or file content, including `annotate`,
`diff-index`, `diff-files`, `difftool`, `fast-export`, `bundle` and `notes`. Patch-producing
options other than `-p` and `--patch`, including `-U<n>`, `--unified` and `--patch-with-stat`,
are also gaps. The blocked list remains unchanged; it is a guardrail, not an allowlist.

## Git ownership in the Codex Windows sandbox

The elevated Windows sandbox can run Git as a separate Windows user. git-safe removes
environment-injected Git configuration, including Codex's injected safe.directory entry.
A checkout that Git considers differently owned therefore needs an effective global or
system safe.directory grant.

For a checkout you trust, the user can add its exact absolute path:

```powershell
git config --global --add safe.directory 'C:/path/to/trusted-checkout'
```

Replace the example with the trusted checkout's path. When GIT_CONFIG_GLOBAL is set,
--global writes that selected file; otherwise it writes the invoking user's global config.
GIT_CONFIG_GLOBAL requires Git 2.32 or later. Use the path exactly as git rev-parse
--show-toplevel prints it when you run it yourself, with forward slashes.
The grant must be in configuration used by the sandbox's Git process. An administrator
can instead supply a system entry.

You SHOULD grant only the exact trusted checkout, because safe.directory = * disables
the ownership check for every repository. Adding an exact entry beside an existing *
does not narrow the wildcard grant.

Setup and review agents MUST NOT write global or system Git configuration or preserve
injected configuration to bypass this refusal. They MUST stop and report
GIT_SAFE_OWNERSHIP so a failed trust check cannot become an automatic access grant.
After the user resolves the prerequisite, start a new review attempt.

An unrecognized ownership diagnostic can still appear as GIT_SAFE_REPOSITORY. That code
does not prove that the directory lacks a Git repository. See references/security.md
for the diagnostic's deliberately narrow recognition rule.

## rc.3 host observations dated 2026-10-26/27

These measurements used published rc.3 on Windows 11 Pro 10.0.26100, Node v24.14.1 and
codex-cli 0.163.0 with the elevated Windows sandbox. Claude Code was 2.1.310 for headless
runs and 2.1.311 for TUI runs. The version change is a separate measurement scope.

R83-e closed as PASS by instruction. Root host settings still did not load for a
subdirectory start; the refusal is model compliance, not host enforcement. Both Codex
L10 reviews completed. Change-1 reported the lost update, and the equal-head warning
was present for change-1 and absent for change-2.

Two of five Claude reviewer runs routed the raw HEAD command through git-safe, which
did not support it. L08 change-2 headless and TUI P3 h returned GIT_SAFE_COMMAND, skipped
the HEAD comparison and ended partial. The raw-Git hook permitted the original command;
the failure was ambiguous routing, not a hook denial.

The first Codex review failed root discovery with GIT_SAFE_REPOSITORY. The sandbox used
a separate Windows user, and git-safe stripped the injected safe.directory configuration.
An exact fixture entry in the isolated global config allowed both later reviews.
A global safe.directory = * is broader than the checkout-specific grant.

C17 adds git-safe head and an actionable ownership diagnostic. These are intended fixes,
not measured rc.4 host results. Final 3.0.0 remains gated on the rc.4 measurements.

Headless P3 h also produced a false launch refusal until the parent supplied its original
root-start context. This did not reproduce in the TUI, where the brief supplied that
context. L16 and its residuals remain unchanged.

Source: docs/plans/2026-10-26-project-setup-v3-rc3-host-measurements.md (PR #6).
Static tests do not establish these host observations.

## Trusted-checkout reviews

Review other people's branches with the reviewer from your base branch, or on GitHub. Never
open an agent session on someone else's branch.

An untrusted checkout controls agent definitions, instructions, settings, hooks, the security
policy and executable helpers. Starting an agent there has already given that branch control
of the session. Project-setup cannot detect or prevent that mistake.

The reviewer keeps the trusted base checkout and reads the other branch through resolved commit objects
(`review-diff --base <ref> --head <ref>`, then `git-safe.mjs cat`, `ls` and `grep` at the resolved head). It
never checks out, switches to, fetches or creates a worktree for the reviewed branch.

An excluded file can still be executable, including `.envrc`. Exclusion from agent reads is
not a safety review; a human must review such code before executing or trusting it.

Path rules cannot detect secret content copied to an unrelated allowed path. They are not
a content scanner and cannot guarantee that a review diff is secret-free.

Hard links fall under the same copied-content limit as copies: protected content can appear
under an allowed name. The path policy does not detect that relationship.

## Review-lane launcher prerequisite

The external review-lane launcher must disable apps and plugins with
`--disable apps --disable plugins`. Disable each configuration-defined MCP server with
`-c mcp_servers.<name>.enabled=false`. Do not name plugin-provided servers in these overrides;
disabling plugins removes them, and naming them can make Codex fail to load its configuration.

Run `codex mcp list --json` with the same flags, effective directory, configuration and
profile as the worker. Refuse to launch unless every listed server has `enabled: false`.
If discovery or this check fails, the lane is not ready.

Do not read authentication files to perform this check. Preserve the user's profile and
settings; do not use an ignore-user-config shortcut, request full access or weaken sandbox
controls to make the lane start.

Configuration coverage and zero observed connector calls do not prove host tool absence.
Record host negative-capability evidence separately from configuration checks.

The doctor is available as scripts/doctor.mjs. It audits these prerequisites without
starting a model session or sandbox probe. See references/security.md, Doctor diagnostics,
for its command and result scope. An unresolved prerequisite means the lane is not ready.

The canonical agents also say this in their own words: instructions are guidance, not a sandbox. See
`references/codex.md` ("Review-lane launcher prerequisite") for the Codex launcher wording.

## Test first (no installation, no real config touched)

```
node tests/run-tests.mjs            # exit 0 = all passed; failures and skips are listed
node tests/run-tests.mjs --keep     # keep fixtures + results.json for inspection
```

The suite runs in a temp directory with HOME/USERPROFILE and git config redirected there.

Candidate acceptance requires the complete strict gate below. A focused run or a zero exit
from diagnostic selection does not replace it. Only R13d may skip for the recorded Windows
file-symlink privilege reason.

```text
node tests/accept-rc1.mjs
```

## Install (only when you decide to)

```
node install/install.mjs --dry-run          # shows what would change; changes nothing
node install/install.mjs                    # blocked (exit 3, nothing changed) if any target has a local edit
                                            # or an existing copy without install metadata (v1)
node install/install.mjs --replace-unversioned   # back up and replace existing v1 copies explicitly
node install/install.mjs verify             # exit 0 only if every target matches this source
node install/install.mjs rollback           # restore each target's newest backup, only after ALL are verified
                                            # (recorded snapshot digest, or install tree hash + inventory + no links)
```

Exit codes: 0 ok · 2 plugin copy needs handling · 3 blocked · 4 switch failed and reverted · 5 verify mismatch ·
6 nothing to roll back.

The installer treats any unexpected top-level entry in an installed copy as a local modification (blocked).
Backup metadata is written next to each backup (`<backup>.meta.json`) and includes a full-directory snapshot digest
taken when the copy is moved aside. A backup without any recorded digest (hand-made or pre-rc.9 unversioned) is
refused unless `--accept-unverified-backup` is passed after a manual inspection. `PROJECT_SETUP_TEST_FAILPOINT=<target>:<phase>`
(phases: `before-backup`, `metadata`, `install`) injects a failure for tests only; leave it unset.

`tests/fixtures/toml-corpus.json` was generated with Python 3.12 `tomllib`; the suite checks the validator agrees
case by case (date/time values are deliberately reported as unsupported and fail validation).

## Local candidate release

The release builder reads an existing local tag and writes a ZIP plus RELEASE-NOTES.md into
a new directory outside project-setup. It does not create tags, publish releases or install
the skill. Run complete candidate acceptance before a later authorized release action.

S07 uses a temporary repository, isolated Git configuration and synthetic tags. It never
requires or creates project-setup-v3.0.0 in the distribution repository.

The installer payload hash, archive SHA256 and backup snapshot digest identify different
bytes. Do not substitute one for another. Preserve the recorded historical v2 provenance;
do not rebuild or replace its archive.

Later local build, after the reviewed tag already exists:

```text
node install/release.mjs --tag project-setup-v3.0.0 --out <unused-directory>
```
