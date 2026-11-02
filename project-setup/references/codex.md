# Codex specifics

Checked against the Codex docs when this reference was written; several features are marked beta upstream.
Record the Codex version from `detect.mjs` and verify at runtime.

## Instructions

- Codex reads `AGENTS.md` files along the path from the project root to the directory where it was started,
  closer files later (more specific). `AGENTS.override.md` exists upstream; the skill never creates one.
- Project docs are loaded up to a byte budget (32 KiB by default, configurable by the user). Content past it is not
  seen. `validate.mjs` fails above 32 KiB and warns above 150 lines.
- No import syntax. `@path` is plain text; reference files in backticks and tell the agent when to read them.

## Skills

Agent Skills format (`SKILL.md` + `name`/`description`). Codex scans `.agents/skills` from the working
directory up to the repository root, plus user and admin locations. The installer's default user target is
`~/.agents/skills`; confirm discovery in a new Codex session and pass `--codex-dir` if your build uses another
location. Never let two copies with the same name be discoverable. An existing copy without install metadata
(v1 or hand-installed) is left alone unless the user passes `--replace-unversioned`.

## Custom agents (`.codex/agents/*.toml`)

- Required: `name`, `description`, `developer_instructions`. Other config keys are allowed and act as a config
  layer for that agent.
- Codex spawns custom agents only when explicitly asked ("spawn the reviewer agent to review <range>").
- A custom agent whose `name` matches a built-in (`default`, `worker`, `explorer`) replaces it; do not reuse those.
- Wrapper names: `reviewer`, `docs_sync` (underscore; files `reviewer.toml`, `docs_sync.toml`). Claude's name stays
  `docs-sync`; the canonical definition is the same file.
- **Never put `sandbox_mode` in a wrapper.** Any loaded `sandbox_mode` makes Codex use legacy sandbox settings
  instead of permission profiles, which silently drops deny-read rules for that agent.
- Each wrapper loads its canonical definition first (`.ai/agents/reviewer.md` or `.ai/agents/docs-sync.md`). If
  that file is missing or unreadable, the agent stops and says so; it never falls back to the wrapper description,
  memory, another wrapper or an agent definition obtained through a connector. The wrapper's
  `developer_instructions` also carry the local-read, no-connector and no-fallback rules, so they apply even
  before the canonical file has been read.

Replacing an installed wrapper is a reviewed draft (`references/migration-v2.md` for a v2 project).

Preserve user-added top-level settings and tables, including `default_permissions`. Compare
both the installed v2 baseline difference and the installed wrapper against the shipped
replacement. Do not silently drop a setting because it is outside `developer_instructions`.

A wrapper whose installed hash matches its manifest record can still contain settings added
through an earlier reviewed transaction. Compare the installed wrapper's top-level keys and
tables with the shipped template; preserve every key or table the template does not define,
or list it for an explicit decision.

Keep values and TOML structure: added top-level keys go immediately before the `developer_instructions = """`
line, and added tables after the template's last line. A key both versions define with different values,
syntax `scripts/toml.mjs` reports as an error or unsupported, or a user-added `sandbox_mode` needs an explicit
decision; never erase it silently, and do not claim the full-file guard settles its meaning.

### Read-only reviewer (optional, after verification)

Subagents inherit the parent session's permissions. To make the reviewer OS-enforced read-only, the user adds the
`project-setup-readonly` profile from the snippet to their user config, verifies it with a canary run, and only
then adds `default_permissions = "project-setup-readonly"` to `.codex/agents/reviewer.toml` (new draft → prepare →
commit). Until then the reviewer is read-only by instruction only; the report says so.

## Permission profiles (secret protection)

`node scripts/render-permissions.mjs codex-snippet` prints a profile extending `:workspace` with deny rules for
every secret pattern, plus an optional read-only variant. The skill never writes it; the user pastes it into the
user config after review.

Rules the report must reflect:

- Profiles do not compose with legacy settings. If `sandbox_mode` or `[sandbox_workspace_write]` appears in any
  loaded config, or `--sandbox` is passed, the profile is inactive. `detect.mjs` flags a user config that has both.
- Deny-read globs are expanded into a snapshot before the sandbox starts (Linux, WSL, native Windows), bounded by
  `glob_scan_max_depth`. Files created after the session starts may not be covered: the canary protocol includes a
  late-file case.
- Native Windows: enforcement depends on the sandbox backend in use. The legacy `unelevated` fallback cannot
  enforce every split read/write carve-out and refuses unsupported policies; WSL uses the Linux sandbox. Report
  the backend Codex shows, and the canary result.
- Profiles cover local sandboxed commands. MCP servers, connectors, web search, and browser tools have their own
  controls and are outside this protection.
- There are public reports of deny globs not being enforced in specific versions/configurations. Treat the
  profile as unverified until `canary.mjs probe`, run through Codex's own shell tool, reports `DENIED`.
- **Measured live, Codex 0.160.1, Windows 11 native:** with the non-admin ("unelevated") sandbox and no profile, a
  shell read and a Node subprocess both read every canary file. With this profile active, Codex **refused to start**:
  "windows unelevated restricted-token sandbox cannot enforce deny-read restrictions directly; refusing to run
  unsandboxed". That is fail-closed, but it means: do not add the profile to the user config of anyone on the
  unelevated sandbox, or Codex will not open. The admin-installed Windows sandbox and WSL2 are untested here.

## Project config

The skill does not create or edit `.codex/config.toml`. If one exists, list its relevance in the Phase 0 summary
(e.g. it sets `sandbox_mode`, which would disable profiles) and leave changes to the user.

### Review-lane launcher prerequisite

The external launcher MUST disable apps and plugins with `--disable apps --disable plugins`
and disable every config-defined MCP server with
`-c mcp_servers.<name>.enabled=false` in the worker's effective directory, configuration and
profile. Do not name plugin-provided servers as config overrides.

Before launch, run `codex mcp list --json` with the same effective lane options. Refuse launch
if a listed server is enabled, the command fails, its output is invalid, or the effective
configuration cannot be established. Report identifiers and disable coverage only.

Do not read authentication files to perform this check. Preserve the user's profile and
settings; do not use an ignore-user-config shortcut, request full access or weaken sandbox
controls to make the lane start.

Configuration coverage and zero observed connector calls do not prove host tool absence.
Record host negative-capability evidence separately from configuration checks.

The doctor is available as scripts/doctor.mjs. It audits these prerequisites without
starting a model session or sandbox probe. See references/security.md, Doctor diagnostics,
for its command and result scope. An unresolved prerequisite means the lane is not ready.

The skill neither runs nor writes a launcher, and never changes user-level Codex configuration to satisfy this.

## Live operation notes (Codex 0.160.1, Windows)

- Subagents are enabled by default in current releases (`agents.enabled` defaults to true). The project custom agent
  `reviewer` ran from `.codex/agents/reviewer.toml` when asked: "Spawn the reviewer custom agent to review the range
  <a>..<b>." Judge success by the thread name in `/agent` (`/root/reviewer`): in one run Codex created an ad-hoc
  agent (`/root/review_range`) and still reported "the reviewer custom agent completed".
- User-level skills are visible to Codex even with a custom `CODEX_HOME`, including nested
  `~/.agents/skills/synced/<id>/` folders. Disable copies with `[[skills.config]]` entries (`path = '<…>/SKILL.md'`,
  `enabled = false`) in a profile and start Codex with `-p <profile>`. During acceptance tests disable every unrelated
  user skill; otherwise a session can load them (observed: a user-level code-review skill was read).
- A long `CODEX_HOME` path breaks the background server ("path must be shorter than SUN_LEN"); sessions still work.
  Use `--no-daemon`. Do not copy `CODEX_HOME` to a short path: it duplicates credentials, and a copied folder outside
  the user profile inherits non-private permissions, which Codex rejects.

## Host measurements dated 2026-10-24/25

The rc.2 measurements used codex-cli 0.163.0 on Windows 11 Pro 10.0.26100 with the elevated
Windows sandbox. The default CODEX_HOME was used with the approved isolated lane setup;
an isolated home's elevated sandbox could not complete startup.

| Item | Observation |
|---|---|
| Root critical rules | PASS: the requested first critical-rules bullet matched. |
| A3 artifact and stdout | PASS: review bytes matched; status and stash were unchanged. |
| A3 dirty trusted checkout | PASS: committed-head output excluded local changes. |
| A3 local-worktree mode | PASS: intended local changes appeared, protected files were absent, and index bytes were unchanged. |
| Equal-head warning | PASS: present for equal resolved head and absent for the other range. |
| L10 review completeness | FAIL: both Codex reviews were incomplete; change-1's lost update was not a finding. |
| Secret shell read, no profile | INCONCLUSIVE: failure cause was not captured. |
| Secret subprocess, no profile | FAIL: all six canaries were readable, including late-file coverage. |
| R44 profile row | BLOCKED: isolated elevated-sandbox startup hung after UAC approval; deny-read enforcement remains unverified. |
| A5 positive control | PASS: the approved parent echo tool returned its control response. |
| A5 negative capability | INCONCLUSIVE: no forced host-refusal result was obtained. |
| MCP configuration override | PASS: list output reflected enabled=false with the override; this is configuration evidence only. |
| macOS / Linux / WSL2 | TO VERIFY for these measurements. |

The 2026-10-25 L10 re-probe corrected the original diagnosis: an absent selector is filtered
silently. The failure came from BRE parsing of an unbalanced \(, and a|b could return an
empty success because BRE treats the vertical bar literally. C16 changes grep to ERE.

Both L10 ranges completed in the rc.3 measurements recorded below. The rc.4 regression
remains pending. Configuration checks, static instruction tests and model statements do
not establish review completeness or host negative capability.
The older 0.160.1 observations above remain historical observations of that configuration.

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

## Load verification (Codex session)

- Start Codex at the repo root; ask it to quote the first bullet of the `critical-rules` block. It must match.
- Ask it to spawn `reviewer` on a tiny range and state where its definition came from (`.ai/agents/reviewer.md`).
- Run the canary protocol from `references/security.md` through Codex's shell tool.
- Confirm only one `project-setup` skill is discoverable.
