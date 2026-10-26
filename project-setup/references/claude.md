# Claude Code specifics

Facts below were checked against the Claude Code docs when this reference was written. Behaviour is
version-dependent: record the version from `detect.mjs` in the report, and verify at runtime rather than trusting
this file.

Claude Code sessions MUST start at the target repository root. Starting in a subdirectory
can omit the root hook, deny rules and shared critical instructions. If started below the
root, stop and restart there before reading files or running Git or project tools; cd inside
the existing session does not repair its launch configuration.

You MUST commit the installed setup before starting worktree sessions, so each new worktree
can contain its own root instructions and settings. A worktree created before that commit
may lack its own CLAUDE.md and be refused under the outer checkout's loaded root rule.

## Instruction loading

- Claude reads `CLAUDE.md`. Since v2.1.277 it reads `AGENTS.md` directly **only** when no `CLAUDE.md`,
  `.claude/CLAUDE.md`, or `CLAUDE.local.md` exists in the working directory or above. A `CLAUDE.md` containing
  `@AGENTS.md` never causes a double load, whatever the "Project instructions" setting. Keep the import: it also
  covers sessions that cannot read `AGENTS.md` directly (older versions, plugin disabled, first session after an
  upgrade).
- Symlinking `CLAUDE.md` → `AGENTS.md` is not used: on Windows it needs admin/Developer Mode, and Git checks a
  committed symlink out as a plain text file unless `core.symlinks` is on.
- `@path` imports are expanded at launch (relative to the importing file, up to four hops). They organise but do
  not reduce context cost. Imports resolving outside the project trigger a one-time approval dialog.
  The relative-import description is not a guarantee that an import expands during a
  subdirectory launch. In the 2026-10-25 headless P2 probe, imports resolving outside the
  start directory did not load, including @../AGENTS.md. Interactive TUI behavior is
  unverified. Do not rely on a parent import to restore root critical rules below the root.
- Block-level HTML comments are stripped before `CLAUDE.md` content enters context, so managed-block markers
  cost nothing there. They remain visible when a file is opened directly.
- Nested `CLAUDE.md` files load on demand when Claude works with a file in that directory. Nested `AGENTS.md`
  files are ignored while a root `CLAUDE.md` exists (default mode), hence the pair rule.
  Launch location also matters. Probe P1 on 2026-10-25, Claude Code 2.1.310 on Windows 11,
  reported root CLAUDE.md and imported root AGENTS.md at a root start. At a src/wallet start
  it reported root CLAUDE.md and the nested pair, but not root AGENTS.md contents.
  P2 loaded root CLAUDE.md below the root even without a nested pair.
  These are model self-reports, not a host API.
- The "Project instructions" mode (`instructionFiles`) is honoured only in user or managed settings; the skill
  reports it (detect) and never sets it.

## Permissions semantics that shape the merge

- Evaluation order is deny → ask → allow; a deny from any settings layer wins over an allow anywhere.
- A `Read(...)` deny applies to Claude's file tools (best effort for Grep/Glob), `@file` mentions, file commands it
  recognises in Bash (`cat`, `head`, `tail`, `sed`, `tee`) and redirections. It does **not** apply to commands that
  read without naming the file (`grep -r . `) or to arbitrary subprocesses (a Node/Python script opening files).
  Only the OS sandbox enforces that.
- A `Read(...)` deny also blocks Edit/Write on the same path (v2.1.208+/v2.1.228+). The vault is denied, so only
  scripts write there; agents never need to.
- Patterns use gitignore syntax: a bare `Read(.env)` and `Read(**/.env)` are equivalent. On Windows, paths are
  normalised to POSIX form before matching.
- A deny entry starting with `!` is a gitignore negation that carves exceptions out of the `path`/`./path` rules
  listed **before** it in the same settings source. Consequences for the merge:
  - managed entries are appended after user entries, so user negations cannot carve them;
  - managed entries never include negations (a managed `!` would weaken the user's earlier rules);
  - a managed rule already sitting before a user negation is reported as a conflict for the user to resolve;
  - appending is not neutral either: a managed rule placed **after** a user negation that it covers (e.g.
    `Read(**/.env.*)` after `Read(!.env.example)`) cancels that exception. Such rules are held back from the draft
    and reported (`needsDecision`); they are added only with `--override-user-exceptions` after the user decides.
    Overlap is computed soundly over literals, `*`, `?` and `**` (a rule is appended only if no path can match both);
    character classes, braces, escapes, `~/` and `//` are not modelled and always defer. This is the merge contract;
    how a live Claude session evaluates the rules is not tested here.
- `.claudeignore` has no effect. Its entries must exist as `Read` denies.
- `Bash(...)`/`PowerShell(...)` rules match command text after splitting compound commands and stripping a few
  wrappers. `/bin/rm`, `sh -c '…'`, `git -C . push` are not matched. The command denies are noise reduction; never
  describe them as a boundary. On Windows the PowerShell tool needs its own rules (rendered alongside Bash).
- Project `permissions.allow` and `additionalDirectories` apply only after the user accepts workspace trust;
  `deny`/`ask` apply immediately.
- On Windows, `.claude/settings.local.json` may live in the starting directory rather than the repo root.

### Shared allows (classification and retirement)

Shared allow rules can run repository code without another prompt. Project-setup classifies
package runners, interpreters and local executable paths as repository-code execution. These
rules produce warnings whether managed or user-owned. Broad shell allows fail classification
when managed and warn when user-owned. Other rules produce no classification finding; that is
not a safety certification.

If a developer accepts a warned permission on their own machine, move it to
`.claude/settings.local.json`. That file is personal and is not managed by project-setup.
Its permissions do not protect the team. The classifier is a lexical warning mechanism, not
a sandbox.

Project-setup MUST NOT add managed allows through the v3 merge workflow. Existing managed
allows MUST remain unchanged unless selected for retirement and approved through apply.

`detect.mjs` reports the classification as `claude.allows` (every shared rule, every installed managed allow including
absent and repeated ones, the exact allow omissions, and the result rows) and appends each warn and fail detail to
`warnings`. The normal merge reports the same inspection of its resulting settings as `report.allows` and refuses every
nonempty `--allow-file` (`ALLOW_BROAD`, `ALLOW_REPO_CODE` or `ALLOW_NEW`, exit 3) before writing anything; an empty
array is accepted and requests nothing. Retirement staging is described in `state-and-apply.md`.

## Sandbox

The OS-level sandbox (filesystem/network limits for Bash/PowerShell commands and their children) is what turns a
read deny into a subprocess-proof control. It is not available on native Windows at the time of writing, and it is
off by default elsewhere; file tools, MCP servers, and hooks are outside it. The capability report states the
sandbox status as observed (enabled / not enabled / unavailable), never assumed.

Measured live (Claude Code 2.1.295, Windows 11 native, no sandbox), with the managed denies in place:

| Layer | Result |
|---|---|
| Read tool on `.env*`, `*.pem` | denied by permission settings |
| `cat <file>` via Bash | denied by permission settings |
| File created after the session started (`late/.env`) | denied (Read and `cat`) |
| A Node script started from Bash reading the same files | **readable** (4 of 4) |

So on native Windows the denies stop Claude's tools and commands that name the file; they are not a barrier against
a script that reads files itself. Real protection there means no real secrets in development working trees, or
running under WSL2 with the sandbox enabled.

## Permission mode during setup

Run setup with `--permission-mode default`. In auto mode an automatic classifier approves commands without showing
them, so the human gates around writes are not exercised (observed live: "Allowed by auto mode classifier").

## Hooks

The skill manages exactly one hook: the raw-Git guard (plan `docs/plans/2026-10-19-project-setup-v3-rc1-c6.md`). It
is a guardrail, not a sandbox: it stops an agent from reading history with raw `git diff`, `git log`, `git show` and
the other raw-history commands, so those reads go through `node .ai/tools/git-safe.mjs`, which omits or refuses secret
paths. The deny rules remain the last line of defense. Any other hook stays the user's; the skill never writes one.

The managed entry, appended last to `hooks.PreToolUse` of `.claude/settings.json`:

```json
{
  "matcher": "Bash|PowerShell",
  "hooks": [
    {
      "type": "command",
      "command": "node \"$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs\""
    }
  ]
}
```

Ownership metadata records its identity (event `PreToolUse`, matcher `Bash|PowerShell` and that exact command), never
the entry shape; options such as `timeout` are not part of the identity.

### What the hook decides

The hook reads one JSON document from stdin and inspects the string `tool_input.command` when `tool_name` is exactly
`Bash` or `PowerShell`. It prints no JSON permission response; the result is the exit code and fixed stderr text:

| Exit | stdout | stderr | Intended host result |
| --- | --- | --- | --- |
| 0 | empty | empty | permit |
| 2 | empty | blocked message | deny |
| 1 | empty | malformed message | continue with warning |

- Blocked message: `guard-raw-git: raw Git command blocked; use node .ai/tools/git-safe.mjs`
- Malformed message: `guard-raw-git: could not parse command; allowed without checking`

Blocked: `diff`, `show`, `log`, `blame`, `cat-file`, `grep`, `archive`, `format-patch`, `whatchanged`, every `stash`
form, `reflog`, `diff-tree`, `range-diff`, an inline `-c alias.*` override, a `--config-env alias.*` override (either
form: `--config-env=alias.<name>=<variable>` or `--config-env alias.<name>=<variable>`; the variable is never read),
and a standalone `-p` or `--patch` argument (not a value such as `git commit -m "-p"`). Every command position is
checked: separators, groups and substitutions, so a raw Git command after a git-safe call still blocks. Quoted
arguments, comments, heredoc bodies and PowerShell here-strings are not commands, so an ordinary commit message that
mentions `git diff` is permitted.
Malformed input (invalid JSON, an unparseable command, unexpected arguments, a missing core) is deliberately fail-open
but loud: exit 1 with the malformed message, never a silent allow. Known gaps are listed in the skill README.

Built-in review skills whose preamble runs raw `git diff`, `git log` or `git show` can fail to
load under the managed raw-Git hook; affected `/security-review` versions have shown this behavior.
This is observed workflow evidence, not host-verified behavior. Apply the skill's review method
through `node .ai/tools/git-safe.mjs` instead, without executing the blocked preamble. You MUST NOT
allow-list raw `git diff`, including `--name-only`, or disable the hook to load the skill. Keep
host behavior TO VERIFY; this guidance does not establish that a particular host loads the hook.

For that built-in-preamble observation, TO VERIFY refers to preamble portability.
The separately measured raw-Git hook results below do not verify every built-in skill.

### When the hook is added

Insertion is conditional: the merge ensures the entry only when the reviewed guard (`guard-raw-git.mjs` and its core
`guard-raw-git-core.mjs`) is staged in the run or, with no staged copy, installed, and equal to the skill's own source.
Otherwise the merge reports `guard-raw-git.mjs not staged or installed` and leaves settings alone, because a hook that
points at a missing or unreviewed file would either fail every command or run code nobody reviewed. An unreviewed
staged copy never falls back to an installed one. A malformed `hooks` or `hooks.PreToolUse` container is reported and
left alone. An identical hook the user already has stays user-owned (reported as already covered, never adopted), and
duplicates are neither removed nor fatal. Nothing replaces or removes a hook automatically: a change or removal is a
reviewed draft and needs `--approve-user-content .claude/settings.json`.

During a security-paths migration, run `node <SKILL_DIR>/scripts/merge-claude-settings.mjs --run-id <id> --hooks-only`
after `migrate-security-paths.mjs stage` and before `apply.mjs prepare`. Hooks-only layering applies only the hook merge
to the STAGED settings draft and patches only the hook metadata field, so the staged deny rules, deny ownership, held
back rules, omissions and migration decisions are preserved byte for byte. When readiness comes from the installed
guard, both installed files are declared as transaction inputs. The exact canonical append with a reviewed guard needs
no settings approval at prepare; any other hooks change keeps the normal approval.

### Installed self-test

`node .ai/tools/hooks-selftest.mjs` runs the installed hook as a child process on three fixed inputs. Success prints
exactly this, exit 0, empty stderr:

```text
PASS  guard-raw-git/allowed
PASS  guard-raw-git/blocked
PASS  guard-raw-git/malformed
3 PASS / 0 FAIL
```

A failed case prints `FAIL` on its line and the real totals, exit 1. `validate.mjs` (C10) runs it during validation;
`doctor.mjs` does not run it. Validation must reject a missing self-test, a launch failure, a timeout, a nonzero exit,
nonempty stderr, empty stdout, or any stdout other than the exact transcript above, even when the process exits 0.
The self-test proves direct hook behavior only: not that settings reference the hook, and not that Claude runs it.

### Host behavior: measured scope and remaining checks

Measurements dated 2026-10-24/25 used the published rc.2 bytes on Windows 11 Pro 10.0.26100,
Claude Code 2.1.310 and Node v24.14.1, without a Claude OS sandbox. Direct Node tests are
separate evidence and do not establish any host result.

| Item | Observation |
|---|---|
| Exit 0 | PASS: git status ran without a guard message or permission prompt. |
| Exit 2 | PASS: raw git log was blocked with the fixed explanation. |
| Exit 1 / R51 | PASS: execution continued; the warning reached the user's transcript, not the model. |
| PowerShell input | PASS: the tool name was PowerShell and the command reached the hook. |
| Bash\|PowerShell matcher | PASS for both measured tools. |
| CLAUDE_PROJECT_DIR / R83-f | PASS: expansion and quoting inside Git Bash double quotes worked with backslash separators, spaces and non-ASCII paths. |
| Root start, then cd | PASS: the hook and deny rules remained active within the project. |
| Subdirectory start / R83-e | FAIL: no hook events; raw git log ran and the protected-path Read was not denied. |
| Node missing | FAIL OPEN: hook exit 127 did not block Git; the model saw no warning. |
| macOS / Linux | TO VERIFY; no portability claim follows from the Windows measurements. |

Claude runs these Windows hooks through Git Bash. The hook ran before the host's own command
parser in the measured malformed-command case.

Secret-path measurements passed for the file tool and recognized shell reads, including case,
depth and late-file variants. A subprocess read all six canaries. The root-anchor parity row
was not run. These results do not establish an OS security boundary.

A5 passed for the measured Claude reviewer wrapper: the parent echo MCP control succeeded,
and the subagent received an unavailable-tool error. This does not establish other hosts'
tool inventories.

Probes P1/P2 on 2026-10-25 reported that root CLAUDE.md loads below the root but its root
AGENTS.md import did not expand. A nested pair loaded when present; P2 also loaded root
CLAUDE.md without one. P2's headless parent import @../AGENTS.md did not load.
These are strong self-report observations, not proof. Interactive import behavior is
unverified. The launch rule is present only in the root Claude template.

C16's released subdirectory refusal remains TO VERIFY on rc.3. It is an instruction
mitigation, weaker than host enforcement. Root-started regressions must also be re-measured.
The nearest loaded rule at or above the original start directory governs the comparison,
so a worktree nested under another checkout is judged against its own rule.
A start above or outside the target root can load that rule only after an initial read.
That comparison does not refuse such a start even after the target rule loads.
Missing launch context alone does not establish a subdirectory start or verified controls.
The hook executes project code and depends on the trusted-checkout boundary.

## Subagent wrappers

`assets/wrappers/claude-*.md`. No `model:` line (inherit the session model; pinning a model is an environment
choice, not a project rule). The reviewer has no Edit/Write tools. If the canonical file is missing, the wrapper
stops instead of improvising.

## Retiring v1

v1 can reach a Claude session three ways. Two active copies are ambiguous, so Phase 0 stops until only one is active.

| Where v1 comes from | How it shows up | How to retire it (observed on Claude Code 2.1.295) |
|---|---|---|
| Skill enabled on claude.ai, synced into Claude Code | `anthropic-skills:project-setup`, source "claude.ai sync", under `<config>/skills/synced/<id>/` | `/plugin` → Installed → select it → Space until it reads `off`. Saved as `"skillOverrides": { "anthropic-skills:project-setup": "off" }` in `.claude/settings.local.json`. Only this skill is affected; `pr-review` and `audit` stay. Or disable it on claude.ai for the whole account |
| Plain user copy | `~/.claude/skills/project-setup` (no `.installed.json`) | The installer refuses to replace it unless `--replace-unversioned` (backed up, restorable) |
| Organization plugin bundling several skills | `<plugin>:project-setup`, plugin type in `/plugin` → Installed | A public issue reported `skillOverrides` not applying to plugin skills (2.1.226); verify on your version. Otherwise ask the plugin owner to ship this version or drop v1. Do not use a `Skill(...)` deny rule: it can match this version too |

Facts learned live:
- `CLAUDE_CONFIG_DIR` does NOT isolate account-level skills synced from claude.ai: they appear in the isolated config
  after login, typically from the first restart. Isolation tests must check the skill list again after a restart.
- A session continued with `--continue` keeps the skill list it started with. Confirm active copies in a NEW session.
- The `/plugin` skill toggle writes `.claude/settings.local.json` in the project; it is user-owned and the skill never
  writes it (write denylist).

Install this version next to v1 only after v1 is retired: start a new session, confirm one `project-setup`, run
Phase 0 on a test repo. Rollback: undo the override (or re-enable) and `install.mjs rollback`.

## Load verification (Claude session)

Perform these checks from a root-started session.

- `/context` (or `/memory`): `CLAUDE.md` listed and `AGENTS.md` included via the import.
- `/agents`: `reviewer` and `docs-sync` present; ask the reviewer to state its first rule from `.ai/agents/reviewer.md`.
- `/permissions`: managed denies present, no unexpected allow rules.
