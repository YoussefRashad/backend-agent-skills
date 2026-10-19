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
