# project-setup (v2) — skill source

**Release 2.0.0.** See `RELEASE-NOTES-2.0.0.md` for verification evidence, known limitations and backlog.
Secret-path controls are tool-level, not an OS security boundary: on Windows native a subprocess started by an agent
can still read secret files. Keep real secrets out of development working trees.

Single source for the shared Claude Code + Codex `project-setup` skill. Edit here, never in installed copies.

```
SKILL.md            entrypoint (workflow, rules, script index)
VERSION, CHANGELOG.md
references/         loaded on demand by the agent
assets/             agent definitions, wrappers, templates, project tools (git-safe)
data/               secret-paths.json (single source for every secret control)
scripts/            zero-dependency Node scripts (JSON output)
install/install.mjs installer (not copied into installs)
tests/run-tests.mjs regression + success-path suite (not copied into installs)
evals/              agent-level scenarios (not copied into installs)
```

Reviews run from a trusted checkout (see "Trusted-checkout reviews" below), and the review lane has a launcher
prerequisite that instructions alone cannot meet ("Review-lane launcher prerequisite"). A project installed by
v2 is updated with `references/migration-v2.md`: `scripts/check-agent-baselines.mjs` first verifies the shipped
v2.0.0 agent and wrapper snapshots under `data/v2.0.0/`, and every installed customization then gets an
explicit, reviewed disposition.

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
Host portability is TO VERIFY. Direct Node self-tests do not establish host launch,
matcher, input-envelope or exit-handling behavior.

The hook executes project code and therefore depends on the trusted-checkout boundary.

The hook contract, the conditional insertion, `--hooks-only` staging and the installed self-test are described in
`references/claude.md` ("Hooks").

Additional raw-Git hook gaps include options to the `env`, `exec`, `time` and `command`
prefixes, which are not interpreted, for example `env -i git log`. Git commands outside the
frozen blocked list can still print history or file content, including `annotate`,
`diff-index`, `diff-files`, `difftool`, `fast-export`, `bundle` and `notes`. Patch-producing
options other than `-p` and `--patch`, including `-U<n>`, `--unified` and `--patch-with-stat`,
are also gaps. The blocked list remains unchanged; it is a guardrail, not an allowlist.

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

The planned doctor audits these prerequisites without starting a model session or sandbox
probe. Until the doctor component lands, this paragraph describes its required scope, not an
available command. An unresolved prerequisite means the lane is not ready.

The canonical agents also say this in their own words: instructions are guidance, not a sandbox. See
`references/codex.md` ("Review-lane launcher prerequisite") for the Codex launcher wording.

## Test first (no installation, no real config touched)

```
node tests/run-tests.mjs            # exit 0 = all passed; failures and skips are listed
node tests/run-tests.mjs --keep     # keep fixtures + results.json for inspection
```

The suite runs in a temp directory with HOME/USERPROFILE and git config redirected there.

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
