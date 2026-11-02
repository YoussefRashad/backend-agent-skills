# Security: secrets, scanning, and proving controls

## 1. Secret paths

`data/secret-paths.json` holds the shipped defaults. A project's effective policy is its installed
`.ai/security-paths.json`: the managed `patterns` plus the project's own `projectPatterns`, validated by the shared
helper `.ai/tools/security-policy.mjs`. Rendered controls and the git-safe reader use that installed effective
policy. Setup's own refusal set is wider: setup scripts refuse a path matched by the shipped defaults or by the
installed policy (the union of both). With no installed policy the shipped defaults alone apply; an invalid or
unreadable installed policy fails closed. To protect more in one project, add `projectPatterns` there. Never
hand-edit rendered output in a project.

Setup never replaces an installed policy by copying the shipped defaults over it. Only a fresh install, with no
installed policy, copies `data/secret-paths.json` (with `full` ownership). An installed policy gets a policy draft
only when detect reports mode `update` with a schema-2 manifest, when the security-state inspection reports managed
patterns behind this skill, an unknown installed baseline or managed patterns edited since install, or when the user
requests a policy change. Then run the migration report, record the user's explicit decisions and run the stage
(`references/migration-v2.md` section 4): new default coverage arrives as a reviewed change, the project's
`projectPatterns` are kept, and the staged policy is recorded with `keys` ownership. `apply.mjs` refuses a policy
draft that is invalid, lowers the schema, or drops an installed entry outside that workflow
(`APPLY_POLICY_REGRESSION`, exit 3); a content approval does not bypass it. To change the shipped defaults, edit the
skill's file; installed projects receive the change through that workflow.

Removing an installed `projectPatterns` entry is a manual edit outside setup. The apply gate refuses that removal
even in a reviewed migration with decisions, by design: setup never shrinks a project's own protections, so the
refusal is expected and is not a bug. To drop such an entry, edit `.ai/security-paths.json` directly and review that
change like any other project edit.

`.env.example` is in the list on purpose: real values end up in templates often enough that no agent reads any
`.env*` file.

The only environment-template exception is the reviewed project-setup `env-keys.mjs` and
`apply.mjs` flow for the root `.env.example`. Agents MUST NOT open that file directly.
Other `.env*` files remain denied. This exception does not authorize arbitrary scripts or
changes to user-level denies. Reports contain key names and value classifications, never values.

`env-keys.mjs keys --template auto` gives you what you need: key names, and per key one of `empty`,
`placeholder`, `non-placeholder`, `possible-real-secret`. It addresses only the root template, never an alternate
or nested name. A missing template, or a template that contains values, produces an exact manual step for the final
report (`references/report.md`); values are preserved and never printed, and nothing is reduced automatically.
Report `possible-real-secret` names under Security Concerns.

The separate `secret-scan.mjs` exception permits in-process inspection of protected content
through gitleaks. Findings remain in the vault; reports expose file:line:rule and protected-path
classifications, never values. The effective policy labels findings; it does not exclude
protected files from the scan.

## 2. Diffs, history and committed files

Read diffs, history and committed files only through `node .ai/tools/git-safe.mjs <command>` (before
installation: `node <SKILL_DIR>/assets/tools/git-safe.mjs`, which needs `.ai/security-paths.json`). The installed
reader belongs to one reviewed unit of seven files: `security-policy.mjs`, `git-safe-core.mjs`,
`guard-raw-git-core.mjs`, `review-diff.mjs`, `git-safe.mjs`, `guard-raw-git.mjs` and `hooks-selftest.mjs`. The
reader accepts these six object forms, the checkout-identity form and the review form:

```text
diff <A>..<B>|<A>...<B> [--stat|--name-status|--name-only] [-- <paths>]
log [-p] [--oneline] [-n<k>|--max-count=<k>] <rev>|<A>..<B>|<A>...<B> [-- <paths>]
show <commit> [--stat|--name-status] [-- <paths>]
cat <commit> -- <path>
ls <commit> [-- <paths>]
grep <commit> <pattern> [-- <paths>]
head
review-diff --base <ref> [--head <ref>] [--out <file>] [-- <paths>...]
```

head takes no arguments and prints the checkout's resolved HEAD commit ID plus one LF.
It accepts attached or detached HEAD and stops on an unborn or unresolvable HEAD.
It uses the same repository and installed-policy checks as the content commands, but
performs no tree inventory or file-content read.

Reviewers MUST obtain checkout HEAD through node .ai/tools/git-safe.mjs head and compare
full resolved IDs. If identity cannot be established, they MUST stop without omitting
the comparison or using raw Git. This prevents silent omission of the equal-head warning.

- Every other option or form is refused: worktree and index diffs (`diff <rev>`, `--cached`; the local working
  state is reviewed only through `review-diff` below), formatting and
  traversal options (`--format`, `--reverse`, `--all`, `--follow`), detached values (`-n 5`), object and reflog
  forms (`HEAD:.env`, `:.env`, `^REV`, `@{1}`). Counts are attached: `-n5` or `--max-count=5`.
- Every revision resolves to a **commit** ID before any content command, so blob and tree IDs are refused and a
  ref that moves mid-command changes nothing.
- Protected paths are omitted from diff, log, show, ls and grep, including historical paths.
  cat accepts one path per call and refuses a protected path. You MUST confirm an uncertain
  path with ls before cat; a missing path returns GIT_SAFE_GIT and stops the task.
- grep uses extended regular expressions (ERE): a|b alternates, \( matches a literal opening
  parenthesis, and \| matches a literal vertical bar. No match is an empty success.
  An empty pattern matches every line; a leading - is pattern text because Git receives -e.
  A pattern containing NUL is rejected as GIT_SAFE_ARGUMENT before any Git operation.
- \d is not a digit class; use [0-9]. \s, \w and \b are GNU extensions, not portable ERE.
  Prefer [[:space:]] and [[:alnum:]_] for whitespace and word characters, and spell out
  intended boundaries. Those GNU extensions worked on Git 2.53 on Windows; macOS/Linux
  regex engines remain unverified. \( and \| are POSIX-defined ERE escapes.
- For a literal search, backslash-escape . [ ] ( ) { } * + ? ^ $ | \ or use an appropriate
  bracket expression such as [(]. Unmatched grouping or repetition syntax, such as
  transfer( or a{2, and a leading * can make a pattern invalid.
- This changes the BRE behavior in rc.1 and rc.2. Existing expressions MUST be checked for
  their intended ERE meaning before reuse, because a valid expression can match different text.
  For example, a|b now alternates, while a\|b now matches a literal vertical bar.
  An expression valid as BRE can also be invalid as ERE.
- After a status-128 grep content call with empty stdout, git-safe probes the same ERE
  against the empty tree for the resolved commit's object format. Probe status 128 with empty
  stdout produces GIT_SAFE_PATTERN; every other probe outcome produces unchanged GIT_SAFE_GIT.
  No repository content or Git diagnostic is emitted on either error.
- The canonical agents permit bounded correction only for GIT_SAFE_ARGUMENT and
  GIT_SAFE_PATTERN. This includes review-diff parse-time argument errors, but a correction
  MUST NOT add --out or widen paths. Every other failure or denial still stops the task.
- Malformed configuration can fail before command-line options take effect. Relevant classes
  include grep.*, color.grep, color.grep.<slot>, color.ui and submodule.recurse.
  If that also fails on the empty tree, a valid pattern may be classified GIT_SAFE_PATTERN;
  the bounded correction budget still ends in a stop, never fallback access.
- Git runs without a shell, so `**` globs are never expanded by Bash or mangled by PowerShell. Errors name the
  failure only, never a path, revision, pattern or Git output.

Every git-safe command limits its complete stdout result to 1,048,576 bytes. Exactly that
many bytes is allowed. Larger results are refused without partial output. Narrow paths with
-- <paths>; for log, use attached -n<k> or a smaller commit range. For an oversized cat result,
use grep with a more selective pattern or select a smaller file. A refused result is not a
completed review. After narrowing, record the reviewed subset and the scope still unreviewed.

Log counts limit content output, not the names-only policy inventory. That inventory runs
once over the full resolved expression. A single-revision log may walk the full reachable
history; use a smaller commit range to reduce that work.

Paths are literal and repository-root-relative. Secret checks are case-insensitive through
the shared policy; Git object lookup preserves exact case. The installed policy is required.
The reader supports policy schemas 1 and 2 and refuses unknown schemas.

Git 2.31 or later is required. The reader preserves the user's global and system configuration
sources, including safe.directory, while removing environment-injected keys and overriding
the execution and output settings used by these commands.

During repository-root discovery, an English Git diagnostic beginning exactly with
"fatal: detected dubious ownership in repository at " produces GIT_SAFE_OWNERSHIP when
Git exits 128 with empty stdout. The helper retains only the classification, never the
path or diagnostic text, and emits no repository content.

Localized diagnostics, preceding warnings and other root failures keep the existing
GIT_SAFE_REPOSITORY result. Older Git releases word this refusal differently or do not
perform the check; their failures also keep GIT_SAFE_REPOSITORY. Neither result permits
fallback access or an automatic configuration change. See references/codex.md for the
effective global or system safe.directory prerequisite and the exact-path command.

GIT_SAFE_OWNERSHIP is not an argument or pattern rejection. Agents MUST stop on it to
preserve the trust boundary; the bounded correction whitelist remains exactly
GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN.

### Review diffs (`review-diff`)

The sanctioned review interface is:

```text
node .ai/tools/git-safe.mjs review-diff --base <ref> [--head <ref>] [--out <file>] [-- <paths>...]
```

With --head, review-diff compares the resolved merge-base to the resolved head commit.
The trusted checkout's staged, unstaged and untracked changes are excluded. Without --head,
it compares the merge-base of base and current HEAD with the local working state, including
staged, unstaged and non-ignored untracked changes.

Tracked local changes use Git's diff-index plumbing, preserving Git's normalization and
skip-worktree behavior without refreshing the index. Configured clean/process filters may
run for selected safe tracked files. Such filters are trusted configuration and may have
their own side effects, including Git LFS object-cache writes.

Untracked files are checked before reading and rendered in-process as new files. Their bytes
are raw: CRLF is preserved, unlike tracked content normalized by Git. An untracked file whose
first 8,000 bytes contain a NUL byte is shown as one binary line, whatever its size, and the
rest of it is not read. An untracked text file larger than 1,048,576 bytes is refused after
at most its first 8,000 bytes are read. Only that NUL check decides binary for untracked files;
their .gitattributes (binary, -diff, diff=) are not consulted. A selected embedded repository is
refused as a nonregular input. A path removed from the index but still present as untracked
content appears twice: a tracked deletion followed by an untracked new-file patch.

The result header records the mode, resolved base, resolved head and merge-base IDs.
Selectors are literal repository-relative paths. A protected selector is refused; protected
descendants of a selected directory are omitted.

Stdout is the default. Reviewers use stdout or an artifact supplied by the orchestrator.
They do not use --out. The orchestrator may create a new artifact directly under
.ai/.run/review/ and pass its path to the reviewer. Output paths are repository-root-relative,
even when invoked from a subdirectory. Artifact creation is exclusive. The default name is
a Windows-safe UTC timestamp, for example 20261019T123456789Z.diff.

The setup run ID review and its case or trailing-dot/space aliases are reserved. Older setup
runs with those names require manual resolution. A reserved setup-lock owner can be removed
with lock.mjs break --confirm-unknown-owner after the existing human recovery decision.
That operation removes the lock, not the review directory.

Review output, including its header, is limited to 1,048,576 bytes. An oversized result is
refused whole. Narrow with -- <paths>, then record both the reviewed subset and the scope
still unreviewed. A narrowed result does not establish that the full change was reviewed.

Path rules cannot detect secret content copied to an unrelated allowed path. They are not
a content scanner and cannot guarantee that a review diff is secret-free.

`.gitignore` does not protect files that are already tracked; tracked secret files are a stop condition (detect
warns), not something to work around.

### C8 review guidance

This subsection is the orchestrator's side of the trusted-review contract; the canonical reviewer and docs-sync
definitions carry the agent's side. The supported review grammar is exactly:

```text
review-diff --base <ref> [--head <ref>] [--out <file>] [-- <paths>...]
```

Start every review from a trusted checkout. Review another person's branch through its resolved commit
objects (`--head`) from the trusted base checkout; never check it out, create a worktree for it or start an
agent session there. The reviewer copies the helper's identity header
`# review-diff mode=<mode> base=<B> head=<H> merge-base=<M>` and adds the self-review warning only when the
resolved head equals the checkout's resolved HEAD, whatever the mode or dirty state.

Reviewers consume review-diff stdout or an artifact the orchestrator supplies; they never use `--out`,
redirect stdout to a file or create review artifacts.

The orchestrator may create an artifact with review-diff's `--out` option. The destination
must be a direct child of `.ai/.run/review/`. Use the helper's artifact publication checks;
do not replace them with shell redirection.

`defaultReviewArtifactPath(now)` in `review-diff.mjs` is a naming helper, not a writer or a retry loop. For
`new Date('2026-10-19T12:34:56.789Z')` it returns exactly `.ai/.run/review/20261019T123456789Z.diff`. The
CLI still defaults to stdout. Calling the naming helper does not create directories, reserve a filename or
overwrite a collision; artifact creation stays exclusive, and a collision is an error, not a retry.

`review` is reserved for review artifacts, including case variants and aliases with
trailing dots or spaces. Never use it as a setup run ID or clean it as a setup run.
Review artifacts and their self-ignore entry must survive setup cleanup.

A refused result, an empty or partial artifact, or a narrowed subset is not a completed full review. After
narrowing, the report records the reviewed subset and the scope still unreviewed.

Hard links fall under the same copied-content limit as copies: protected content can appear
under an allowed name. The path policy does not detect that relationship.

Before any tool sends a diff or files to an external service, including a hosted reviewer or a
review CLI, establish the exclusion set from the trusted checkout. It is the union of the skill's
shipped default patterns and the effective installed policy: patterns plus projectPatterns.
Installed managed patterns behind the shipped defaults do not reduce this exclusion set.

The tool MUST exclude every matching path from all content it sends, including generated context.
Match both sides of a rename and paths present only in the reviewed history. Scan the remaining
content for secret-shaped strings before transmission. A scan must not print or transmit a matched
value. A match must be resolved without exposing it before the content can be sent.

If the installed policy is absent, invalid or unreadable, or the exclusions or scan cannot be
established for the actual outgoing content, the tool MUST NOT run on that range. An invalid or
unreadable policy is not an absent policy. Do not silently fall back to shipped defaults.

A policy edited in the reviewed range is untrusted review input, not authority to remove trusted
exclusions. Establish the coverage from the trusted checkout and account for unresolved policy
changes before transmission; if coverage cannot be established, do not run the tool.

git-safe excludes protected paths for local reading. A CLI that builds its own diff from Git does
not inherit those exclusions. If it cannot exclude a protected path in the range, do not run it
on that range. A names-only precheck is not proof that its later payload is safe.

If the trusted policy changes after the check, that check is invalid. Before transmission,
you MUST re-establish the exclusions and rescan the actual outgoing payload against the new
trusted policy. A previous scan is not evidence for changed policy or changed outgoing content.

These are prerequisites, not permission to send repository content. Canonical reviewer and
docs-sync instructions still prohibit external transmission. C14 also installs these prerequisites
in the root AGENTS.md critical-rules block, so project sessions receive them without reading this
reference. No wrapper or automated preflight is added; instruction checks do not prove enforcement.

## 3. Secret scan (optional, bounded)

`secret-scan.mjs --run-id <id> [--scope worktree|history]`. Local only, redacted, findings as file:line:rule.
Absent or failing gitleaks means **not scanned**, never "clean". Pattern scanners miss things; the report says
"no findings by gitleaks <version> in <scope>", not "no secrets".

## 4. Canary protocol (runtime proof)

Canaries are dummy tokens in files that match the secret patterns, under `.ai/.canary/<run>/` (self-ignored).
Tokens are never printed by the scripts; only hashes are stored.

Run it in the tool you are verifying, **in a separate lab folder**, not in the project itself: the project's
`AGENTS.md` correctly forbids any attempt to read secret paths, so an agent there refuses before the permission layer
is ever exercised (observed live; that result is INCONCLUSIVE, not PASS). Lab setup: an empty git repo containing only
a copy of the project's `.claude/settings.json` (and, for Codex, the profile under test), then
`node <SKILL_DIR>/scripts/canary.mjs setup --run-id <id>` from inside it. Steps:

1. `canary.mjs setup --run-id <id>`. For Codex, start a **new** Codex session after this step, because deny globs
   are snapshotted at session start.
2. **File tool layer** (Claude only): use the Read tool on each canary path.
3. **Shell command layer**: in the agent's shell tool, `cat <path>` (Bash) / `Get-Content <path>` (PowerShell).
4. **Subprocess layer**: in the agent's shell tool, `node <SKILL_DIR>/scripts/canary.mjs probe --run-id <id>`.
   It inherits whatever sandbox that shell has and reports `DENIED` / `READABLE` per file.
5. **Late file**: `canary.mjs setup --run-id <id> --late` during the session, then repeat steps 3–4.
6. For steps 2–3, pass the tool output to `canary.mjs verify --run-id <id> --observed "<output>"`.
7. `canary.mjs cleanup --run-id <id>`.

Interpretation:

| Observation | Result |
|---|---|
| Tool/sandbox returned a denial (permission rule, sandbox error) and verify finds no token | **pass** for that layer |
| verify finds a token, or probe says `READABLE` | **fail** for that layer |
| The model declined to run the read, or the command never executed | **inconclusive**, never pass |
| Layer not applicable (e.g. no file tool in Codex) | **n/a** |

Expected on native Windows without an OS sandbox: Claude passes the file-tool and recognised-command layers and
fails the subprocess layer. That is a true statement about the setup and belongs in the report, together with the
mitigation that matters most: no real secrets in development working trees (non-production credentials locally,
production secrets in a secrets manager).

## 5. Capability report

One table per tool, filled from observations only:

| Control | Claude Code <ver> | Codex <ver> |
|---|---|---|
| Instructions loaded (AGENTS.md via import / native) | verified / not verified | verified / not verified |
| Shared agents load canonical definitions | … | … |
| Command isolation (OS sandbox) | enabled / not enabled / unavailable (+backend) | profile active / legacy sandbox / none (+backend) |
| Secret read: file tool | pass / fail / inconclusive / n/a | n/a |
| Secret read: shell command | … | … |
| Secret read: subprocess | … | … |
| Secret read: file created mid-session | … | … |
| Secret scan | gitleaks <ver>, scope, findings count / not scanned | (same run) |

Any cell that is not *pass* or *verified* also goes to `TODO.md` → Unverified Controls, with the exact steps to
verify it.

Keep static validation, direct installed-hook results, doctor diagnostics and live host evidence
separate. Neither a passing self-test nor a ready doctor verifies Claude hook loading, connector-tool
absence or sandbox enforcement.

## 6. Doctor diagnostics

The doctor runs only codex mcp list --json with validated lane options, reads the newest permitted
sandbox log and inventories Windows processes. It never starts a model session or sandbox probe,
reads authentication or sandbox-secret files, kills processes or changes sandbox mode.

```text
node <SKILL_DIR>/scripts/doctor.mjs --disable apps --disable plugins -c mcp_servers.node_repl.enabled=false -p review -C <project-root>
```

Supply only configuration-defined server names. The external launcher owns enumeration and must use
the same directory, profile, configuration and disable options for the worker. An enabled server,
failed command, invalid output or unresolved prerequisite means not ready.

Exit 0 means the supplied configuration and available diagnostics passed these checks. It does not
establish host negative capability. An absent or unreadable log and an unavailable Windows process
inventory remain unknown and produce exit 1.

A clean log means no recognized setup-refresh error was found in the newest readable log. It is
historical diagnostic evidence, not a successful sandbox measurement.

The report includes the selected log's modification time. An error in that log remains a failure
until newer evidence is available. Resolve the underlying problem before retrying; the doctor does
not delete logs or run a probe to create new evidence.
