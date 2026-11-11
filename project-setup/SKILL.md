---
name: project-setup
description: Set up, migrate, or update shared AI-agent scaffolding for a backend repository so Claude Code and Codex work from the same rules - AGENTS.md as the shared source of truth, CLAUDE.md importing it, shared reviewer and docs-sync agents with thin per-tool wrappers, secret-path protection for both tools, and project docs generated from the actual code. Use this whenever the user wants to set up, install, initialize, re-run, upgrade, or migrate project setup, AGENTS.md, CLAUDE.md, agent docs, or reviewer/docs-sync agents in a repo, including repos already configured by the older Claude-only project-setup (v1), repos with hand-written CLAUDE.md or AGENTS.md, and new or empty repos. Treats the codebase as sensitive (fintech-grade), never reads secrets, enforces plan-and-confirm gates, and changes documentation and agent configuration only.
---

# project-setup 3.1.0

One skill, one source, two tools. Produces a repository layout that Claude Code and Codex both follow:

```
AGENTS.md                      shared rules (canonical, <=150 lines, managed blocks)
CLAUDE.md                      @AGENTS.md + Claude-only notes
<dir>/AGENTS.md + CLAUDE.md    optional local rules next to sensitive code (always as a pair)
.ai/manifest.json              install state: version, ownership, hashes (written last, by apply.mjs)
.ai/agents/{reviewer,docs-sync}.md   canonical agent definitions
.ai/context/*.md  .ai/decisions/     navigation maps and evidenced decisions
docs/*.md                      conventions, database, integrations, observability
.claude/settings.json          managed Read/command denies merged into user settings
.claude/agents/*.md            Claude wrappers -> .ai/agents/*
.codex/agents/*.toml           Codex wrappers  -> .ai/agents/*
TODO.md                        everything uncertain, unverified, or out of scope
```

Read this file fully, then read references only when the step says so.

For Claude Code, you MUST start the session at the target repository root before setup.
Compare the original working directory in the supplied environment context with the target
root. If that context positively establishes a start below the root, you MUST ask for a
root restart and stop before file reads, Git commands or project tools.
As soon as a below-root start is positively established, including by discovery, you MUST
stop before any further read or write and ask for a root restart.
Changing directory inside the session does not load the missing root settings. This prevents
setup from running without the repository's hook, deny rules or shared critical instructions.
Missing launch context alone does not establish a subdirectory start or verify host controls.

## Non-negotiable rules

1. **Documentation and agent configuration only.** Never change application code, tests, dependencies,
   migrations, schema, infrastructure, or CI/CD. Findings go to `TODO.md`. `scripts/apply.mjs` enforces a write
   allowlist; do not write project files any other way.
2. **Never read secrets.** No tool, command, or script you write may open a path matched by
   `data/secret-paths.json` (`.env`, `.env.*` including `.env.example`, keys, certs, `secrets/`, `credentials/`,
   `.npmrc`, the run vault) or by the installed `.ai/security-paths.json` (its managed `patterns` and the project's
   `projectPatterns`). The boundary is the union of both: a path the shipped defaults do not name may still be
   protected by the installed policy. With no installed policy, the shipped defaults alone are the fallback; an
   invalid or unreadable installed policy fails closed (it is an error, never a reason to read).
   Env variable **names** come from config/validation code or from `scripts/env-keys.mjs` (names and value
   classifications only). Read diffs and history only through
   `.ai/tools/git-safe.mjs` (or `assets/tools/git-safe.mjs` before it is installed), never raw `git diff/log -p/show`.
   Before any reader and policy exist, Phase 0 uses names-only discovery. If a value surfaces anyway:
   do not repeat it, do not store it, report file and variable name only.
   Files listed under `contentRisk` (compose files, config modules, k8s/helm) may be read for structure; never
   reproduce values from them.

   The only environment-template exception is the reviewed project-setup `env-keys.mjs` and
   `apply.mjs` flow for the root `.env.example`. Agents MUST NOT open that file directly.
   Other `.env*` files remain denied. This exception does not authorize arbitrary scripts or
   changes to user-level denies. Reports contain key names and value classifications, never values.
3. **Nothing is overwritten silently.** All content goes to drafts first, is reviewed as a diff, and is applied by
   `apply.mjs commit`, which re-verifies every file and writes the manifest last. The skill owns only managed
   blocks (Markdown and `#`-comment files), managed keys (`.claude/settings.json`), and files it created in full.
   Everything else belongs to the user and is merged, never replaced.
4. **Evidence or nothing.** Never invent architecture, business rules, ADR rationale, security controls, or
   behaviour. Label inferences *inferred*. Dependency presence is not evidence of a decision. Gaps go to `TODO.md`.
5. **Generated is not verified.** The report distinguishes *generated*, *statically validated*, and *verified at
   runtime in <tool>*. A security control is claimed only for the paths, tools, and version actually tested.
   A model refusing to read a file is not proof the file is protected.
6. **Read incrementally.** Listings and targeted reads; never bulk-load the codebase.
7. **No retry recommendation without verified idempotency**, in any generated doc.
8. **Project scope only.** Never write user-level or managed config (`~/.claude/settings.json`,
   `~/.codex/config.toml`, `requirements.toml`, managed settings). Produce reviewed snippets for the user instead.
   Installing the skill itself (`install/install.mjs`) is the only user-level write, and it is a separate,
   explicit step.
9. **No git state changes.** Never commit, push, stash, reset, restore, checkout, or clean.
10. **Trusted checkout, local reads, no fallback.** Run setup and reviews from a trusted checkout: an untrusted
    checkout controls agent definitions, instructions, settings, hooks, the security policy and executable helpers.
    Read repository content only with the local file tools and git-safe; never through an MCP server, connector,
    browser or remote service, and never send repository content to one. A failed or denied read stops the step:
    do not retry it through another tool, change the sandbox or request full access. Review another person's
    branch from the trusted base checkout through resolved commit objects; never check it out, switch to it, fetch
    it or create a worktree for it (`references/security.md`, "C8 review guidance"). The user supplies or fetches
    the refs.

    Canonical reviewer and docs-sync instructions permit only their bounded correction of
    git-safe GIT_SAFE_ARGUMENT and GIT_SAFE_PATTERN rejections that emit no repository content.
    This includes review-diff's parse-time GIT_SAFE_ARGUMENT errors. A correction MUST NOT add
    --out or widen the intended paths. You MUST NOT extend that exception to a failed or
    denied read or another error code; that would bypass the trusted-read boundary.

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

## Scripts

All scripts are zero-dependency Node (>=18) and print JSON. Run them from the repository root as
`node "<SKILL_DIR>/scripts/<name>.mjs" ...`, where `<SKILL_DIR>` is the directory containing this file.

| Script | Purpose |
|---|---|
| `detect.mjs` | Read-only inventory: mode + evidence, instruction files, tool configs, secret paths (names only), installs, tool versions, shared allows (`claude.allows`) |
| `check-agent-baselines.mjs` | Read-only check of the six shipped v2.0.0 agent and wrapper snapshots under `data/v2.0.0/` against embedded SHA256 pins (no arguments; exit 0 only when all six verify). Run before comparing installed v2 agents or wrappers |
| `migrate-security-paths.mjs` | `report`/`stage`: the v2 policy migration with explicit, hash-bound decisions; stage writes the policy, settings and runtime drafts |
| `env-keys.mjs` | `keys`/`merge` with `--template auto`; names and value classifications only |
| `render-permissions.mjs` | Renders Claude denies, the Codex snippet (`codex-snippet`, raw TOML on stdout) and git pathspec excludes from the effective policy |
| `merge-claude-settings.mjs` | Order-preserving merge of managed entries into `.claude/settings.json` (draft + report); `--hooks-only` stages only the raw-Git hook; `--retire-allow-file <path>` stages an approved allow retirement |
| `blocks.mjs` | `check`/`hashes`/`drift`/`upsert` managed blocks (upsert writes drafts only) |
| `lock.mjs` | One run per checkout; breaking a lock is a user decision |
| `apply.mjs` | `init`/`diff`/`prepare`/`commit`/`status`/`rollback`/`cleanup`: the only writer; `diff` reviews drafts in-process without Git |
| `validate.mjs` | Static setup checks and installed hook self-test; exit 1 on any failure |
| `doctor.mjs` | Audit lane configuration and local diagnostics without a model session or sandbox probe |
| `canary.mjs` | Runtime measurement of secret-read protection per tool layer (no canaries = INCONCLUSIVE, exit 3) |
| `secret-scan.mjs` | Optional local gitleaks scan, redacted; findings as file:line:rule only |
| `assets/tools/git-safe.mjs` | Installed into projects with six companion runtime files: bounded diff/log/show/cat/ls/grep, checkout head identity and `review-diff` with secret excludes, no shell |

## Workflow

Use a run id like `ps-<yyyymmdd>-<4 random chars>` for the whole run. A retry after a journaled run uses a new
run ID.

`review` is reserved for review artifacts, including case variants and aliases with
trailing dots or spaces. Never use it as a setup run ID or clean it as a setup run.
Review artifacts and their self-ignore entry must survive setup cleanup.

The complete sequence is below. "When applicable" means an update from a schema-2 manifest (the v2 comparison
preflight) or a run that triggers the policy migration gate (`references/migration-v2.md`, section 4):

```text
trusted discovery
-> v2 comparison preflight when applicable
-> lock and apply init
-> policy report and explicit decisions when applicable
-> migration stage, or normal merge when needed
-> hooks-only staging
-> agent/wrapper drafts and project ownership request
-> approved allow-retirement staging
-> apply diff (unprepared preview)
-> prepare --approve-user-content <exact paths>
-> apply diff (bound review)
-> plan-hash approval
-> commit
-> validate
-> render/review Codex snippet
-> report and retain recovery material
```

The review and transaction commands (an update shown; other runs pass their confirmed `--mode`):

```text
node <SKILL_DIR>/scripts/apply.mjs diff --project . --run-id <id>
node <SKILL_DIR>/scripts/apply.mjs prepare --run-id <id> --mode update --agents claude,codex
node <SKILL_DIR>/scripts/apply.mjs commit --run-id <id> --approved-plan <hash>
node <SKILL_DIR>/scripts/validate.mjs
node <SKILL_DIR>/scripts/render-permissions.mjs codex-snippet --project .
```

Add the required exact approval list to prepare (`--approve-user-content <exact paths>`). Omit it only when no
target requires it. Never supply broad or unrelated paths to make prepare pass.

A prepare without approvals exits 3 and lists the exact `APPLY_APPROVAL_REQUIRED` targets;
show those diffs, then re-run prepare with exactly those paths.

Review the bound diff after prepare and approve that plan hash. The earlier preview is not approval of later
draft changes. Apply diff invokes no Git, and protected content receives no textual diff. Policy, settings,
runtime, agents, ownership, omissions, snippet record and manifest share one transaction.

### Phase 0 — Discover (read-only), then STOP

1. `node scripts/detect.mjs`. Act on every warning before going further; tracked secret files or a held lock stop the run.
   Its install list is a filesystem scan; confirm which `project-setup` copies are active from the running tool's own
   skill list, and stop if more than one is active.
2. Only when detect reports mode `update` with a schema-2 manifest, run
   `node <SKILL_DIR>/scripts/check-agent-baselines.mjs` before reading installed agents or
   wrappers for comparison, from the same `<SKILL_DIR>` whose `data/v2.0.0/` files you will
   compare. Continue only on exit 0; otherwise stop and report the checker error without
   inventing or substituting a baseline. Fresh, adopt, migrate-v1 and all other runs do not
   run this checker.

   The checker verifies comparison data. It does not establish that installed instructions are trusted or
   determine the setup mode itself. On failure, also report
   `Agent migration: stopped; required comparison input is unavailable or unverified.`
3. Read every existing instruction file in full (`AGENTS.md`, `CLAUDE.md`, nested ones, `.claude/agents/*`,
   `.codex/agents/*`), `README.md`, and existing `docs/`/`.ai/` indexes. Existing decisions outrank your inferences.
   Read them only with the local file tools; a failed or denied read stops the step.
4. Read only: the manifest (`package.json` or equivalent), lockfile name, `tsconfig.json`, `docker-compose.yml`
   (structure only), `src/` tree listing, framework entrypoint (`main.ts`, `app.module.ts` or equivalent).
   Versions: required range from the manifest, installed version from the lockfile; `tsconfig.json` describes
   compiler settings, not the TypeScript version.
5. Before installed readers are available, use names-only discovery:

   ```text
   git --no-optional-locks status --short
   git ls-files
   ```

   Do not use raw diff or history content as a Phase 0 exception. Once the installed policy and readers exist,
   history goes through `node .ai/tools/git-safe.mjs` only.
6. Classify the mode with `references/modes.md`. If `migrate-v1`, also read `references/migration-v1.md`. A valid
   schema-2 manifest needs update: also read `references/migration-v2.md`. Invalid metadata (mode `invalid`)
   requires repair through the documented procedure first; it is not permission to invent ownership.

   Phase 0 mapping assessment: on a project that may be a backend-standards (BS) project, show the documentation
   mapping signals (stamp, provenance sentence and import, recorded owner decision), the selected policy, the
   detected mode and every unresolved disposition, then stop for approval. The signals and dispositions are defined
   in `references/docs-generation.md` ("Documentation source of truth on backend-standards projects"); the mapping
   never changes the detected mode.
7. Permission decisions. Read `claude.allows.rules`, `managed`, `omitted` and `results`. The managed inventory comes
   from installed ownership records; omitted entries remain explicit decisions. Diagnostics
   identify risk and remedy, not permission to remove a rule. Inventory is not approval.

   Invalid inventory is reported, not treated as an empty eligible selection. Personal settings
   (`.claude/settings.local.json`) receive information only; never direct edits to them.

   Propose no new managed allows. Every nonempty `--allow-file <confirmed.json>` is refused,
   including rules classified as `other` and rules already recorded as managed. Use the
   retirement procedure only for exact installed managed entries the user approved retiring.
8. Present this summary and **stop until the user explicitly approves**:

```
## Mode: <mode>  (evidence: …)
## Project
- Name · framework (version) · language (version) · ORM · DB · cache/queue · auth
- DB change policy as practiced: <ORM migrations | manual DDL | mixed> (evidence)
## Existing AI configuration
- files found, ownership guess, conflicts in meaning (not mere differences)
- v2 agent comparison (update from schema 2): checker result, then every disposition row still pending
## Tools & environment
- Claude Code <version|not found> · Codex <version|not found> · OS/shell
- Codex user config: legacy sandbox vs profiles (from detect) · Claude instruction-files mode
## Security findings (names only)
## Assumptions / Unknowns
## Plan
- files to create / merge / leave untouched, in order; installed managed allows proposed for retirement (exact entries, with the risk each carries)
```

### Phase 1 — Draft (after approval)

1. `lock.mjs acquire --run-id <id> --agent <claude|codex>`, then `apply.mjs init --run-id <id>`.
2. Generate content into `.ai/.run/<id>/drafts/<repo-path>` following `references/docs-generation.md` and the
   templates in `assets/templates/`. For Markdown and `.gitignore`, write managed sections with
   `blocks.mjs upsert` so user content outside the markers is preserved.

   Before drafting overlapping documentation, setup MUST apply the source-of-truth mapping in
   `references/docs-generation.md`, including activation dispositions, existing-content consolidation and source
   binding, so generation cannot introduce a second factual owner.
3. Security policy and tooling. With no installed policy (`.ai/security-paths.json` absent), copy
   `data/secret-paths.json` → `.ai/security-paths.json` as a draft: this is the fresh-install path, with `full`
   ownership. With an installed policy, never copy `data/secret-paths.json` over it. Stage no policy draft unless
   detect reports mode `update` with a schema-2 manifest, the security-state inspection reports managed patterns
   behind this skill, an unknown installed baseline or managed patterns edited since install, or the user requests a
   policy change. Then run the report, record the user's explicit decisions in
   `.ai/.run/<id>/security-decisions.json` and run the stage, exactly as `references/migration-v2.md` section 4
   describes (a deleted managed entry offers `restore` or `omit`; an addition offers `project`, `keep` or
   `omit`); the stage supplies the policy, the settings projection and the runtime drafts. A migration-staged policy
   has `keys` ownership, and its managed metadata holds the managed `patterns`, never `projectPatterns`. A rerun
   without a policy draft preserves the installed ownership record. An invalid or unreadable installed policy is an
   error, never evidence of absence: report it and never fall back to the shipped copy. `apply.mjs` refuses (exit 3,
   `APPLY_POLICY_REGRESSION`) an installed-policy draft that is invalid, lowers the schema, or drops an installed
   entry outside that workflow; `--approve-user-content` does not bypass it. A complete update stages all
   seven files under `.ai/tools/`, each from the corresponding `assets/tools/` member in the same skill copy (the
   agents and AGENTS.md depend on them):

   ```text
   security-policy.mjs
   git-safe-core.mjs
   guard-raw-git-core.mjs
   review-diff.mjs
   git-safe.mjs
   guard-raw-git.mjs
   hooks-selftest.mjs
   ```

   Stage all seven runtime members as one reviewed compatible unit. Declining replacement of an
   edited member prevents the coupled policy update. Do not install the new policy with old or
   unreviewed readers.
4. Settings. When no policy migration supplies the settings draft, run the normal merge
   `merge-claude-settings.mjs --run-id <id>` (run it before prepare: it writes `ownership.json`/`managed-keys.json`,
   which prepare embeds in the plan the user approves). In a policy migration the stage supplies the
   policy/settings projection; do not overwrite it with a normal merge afterward. Stage the hook after the
   migration stage and before allow retirement:

   ```text
   node <SKILL_DIR>/scripts/merge-claude-settings.mjs --run-id <id> --hooks-only
   ```

   The canonical hook identity is event `PreToolUse`, matcher `Bash|PowerShell` and command
   `node "$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs"`. Insertion stays conditional on the reviewed guard;
   user options, ordering and identity rules are preserved (`references/claude.md`, "Hooks").

   Propose no new managed allows. Every nonempty `--allow-file <confirmed.json>` is refused,
   including rules classified as `other` and rules already recorded as managed. Use the
   retirement procedure only for exact installed managed entries the user approved retiring.

   If the merge returns `needsDecision: true`, a managed deny may cancel a user exception (`Read(!…)`); those rules are
   held back from the draft. Overlap is decided soundly: a rule is appended only if no path can match both it and
   the exception (wildcards included); anything the check cannot model is deferred. Show the conflict; re-run with `--override-user-exceptions` only if the user chooses it.
5. Agents. Before replacing installed agents or wrappers, follow `references/migration-v2.md`.
   Replace `{{PROJECT_NAME}}` and remove references to docs you did not generate. Preserve
   both rendering rules when comparing v2 files and drafting their replacements.

   Draft agents after the comparison and every disposition, before the final preview and prepare: render
   `assets/agents/*.md` into `.ai/agents/`, and copy wrappers from `assets/wrappers/` to `.claude/agents/` and
   `.codex/agents/` (Codex file names: `reviewer.toml`, `docs_sync.toml`), preserving user-added Codex settings.
   A wrapper whose shipped replacement equals its installed v2 baseline gets no draft, so installed additions
   survive. Approved reviewer-specific text moves to ".ai/agents/reviewer.project.md" with a merged ownership
   request (`references/docs-generation.md`, "Ownership hints"). Keep existing agent names other skills rely on
   (e.g. `.claude/agents/reviewer.md`); check before renaming anything.
   Approved docs-sync-specific text MUST move to ".ai/agents/docs-sync.project.md" with a
   merged ownership request, so replacing the canonical agent preserves project requirements.
   Follow the same approved-text and existing-byte preservation rules as for reviewer.project.md.
   Do not create either project file without approved content.
6. Allow retirement, only for exact installed managed entries the user approved retiring. Stage denies and hooks
   before retiring allows. Normal merge refuses a pending allow-omission request. Start a new run to amend a
   pending retirement selection. Staging is not approval.

   The selection is a JSON string array inside the project and outside setup draft and vault subtrees; the
   suggested path is `.ai/.run/<id>/retire-allows.json`:

   ```text
   node <SKILL_DIR>/scripts/merge-claude-settings.mjs --run-id <id> --retire-allow-file <path>
   ```

   Eligibility comes from installed managed ownership or omissions, not agent-written requests. An already absent
   managed allow can still require metadata approval.
7. Environment template. Perform template inspection and staging after the agent/wrapper drafts and before
   `apply diff (unprepared preview)`.

   Derive configuration names from config and validation code using local file tools. Do not
   emit shell searches containing environment-access expressions. Inspect the permitted template
   with `env-keys.mjs keys --template auto`; stage missing names with
   `env-keys.mjs merge --template auto --keys <file> --run-id <id>`.

   ```text
   node <SKILL_DIR>/scripts/env-keys.mjs keys --template auto
   node <SKILL_DIR>/scripts/env-keys.mjs merge --template auto --keys <file> --run-id <id>
   ```

   The key list is a JSON array of `{ name, required, secret, description, group }` objects in a file outside
   every protected path. The commands address only the root template and print key names and value
   classifications, never values; merge stages new names as empty assignments in the run vault, where apply
   reviews them.

   If the template is missing, copy the script's manual step into the final report and continue
   without template staging. If it contains values, preserve them and copy the script's manual
   cleanup step into the final report. Never perform an automatic names-only conversion.
8. Read `references/claude.md` and `references/codex.md` for tool-specific details before drafting wrappers,
   settings, or snippets.

### Phase 2 — Review gate, then STOP

1. Preview the drafts with `apply.mjs diff --project . --run-id <id>`, together with the settings merge report
   (conflicts, held-back rules, ineffective rules, legacy hooks), the migration decisions and the env-keys report
   (names and value classifications only, plus its manual steps for the final report). Before prepare this is an
   unapproved preview. Never display vault files.
2. `apply.mjs prepare --run-id <id> --mode <mode> --agents claude,codex`. It rejects (exit 3) any draft that
   changes user content: anything outside managed blocks, a user-edited fully managed file, any pre-existing file the
   skill does not own (only adding new blocks is free), or a `.claude/settings.json` draft that is not append-only.
   Show those diffs; only if the user explicitly approves them, re-run prepare with
   `--approve-user-content <path>[,<path>]` for exactly the listed files.
3. Run `apply.mjs diff` again for the bound review: it names the `planSha256` printed by prepare and refuses changed
   inputs. Resolve every conflict with the user. **Stop until the user approves that plan hash.** Do not edit
   drafts after this point; any change means a new prepare and a new approval.

### Phase 3 — Apply and validate

1. `apply.mjs commit --run-id <id> --approved-plan <planSha256>`. It re-checks the plan hash, every draft's
   hash, `ownership.json`/`managed-keys.json`, every target, and the manifest. Exit 2: a run directory was
   replaced by a link/junction; nothing was written. Exit 4: something changed since approval; nothing was
   written; prepare and ask again (same run id is fine: no journal exists yet). Exit 5: partial apply; run
   `apply.mjs rollback`. Exit 7: the run already wrote (committed, partial, or rolled back) or another run is
   unresolved. A run writes at most once and its journal is never reset: finish recovery first, then retry with a
   NEW run id. Rollback exit 6: some files were changed after
   the run wrote them; they and their backups were left alone. Tell the user; never clean up without
   `--confirm-manual-resolution` from them.
2. `validate.mjs`. Fix failures through a new draft/prepare/commit cycle, or record them in `TODO.md`.

   Validation uses the installed policy baseline and shared ownership schemas. Schema 2 reports
   needs update. The installed hook self-test proves direct script behavior only; it does not
   establish hook loading in the current Claude session. See references/claude.md for dated
   host measurements and the root-start requirement.

   Run validation in a trusted checkout because the installed hook self-test executes project code.

   After migration, a schema-2 policy content change in a project with catalog tools, including a projectPatterns
   addition, still goes through migrate-security-paths.mjs and security-decisions.json. Validation reports project
   patterns and stale snippets; it does not bypass that reviewed migration workflow.

3. `render-permissions.mjs codex-snippet --project .` prints the Codex snippet as raw TOML on stdout. Present it
   for review; never write user-level configuration. A recorded snippet hash is not evidence that the user
   installed it.

### Phase 4 — Runtime verification (per tool, honestly scoped)

Follow `references/security.md`: load verification and the canary protocol for the tool you are running in.
You cannot verify the other tool from this session; list the exact steps for the user and mark it *not verified*.

Run doctor.mjs only with the worker's effective lane options. Its configuration and diagnostic results do not
verify connector-tool absence or sandbox enforcement.

### Phase 5 — Report and release

Report with `references/report.md`, then `lock.mjs release`. Keep `.ai/.run/<id>` until the user confirms the
result (rollback needs it), then `apply.mjs cleanup`. When an installed agent was kept, report the incomplete
update (`references/migration-v2.md`, section 3) instead of claiming that every canonical instruction was upgraded.

## Reference index

| File | Read when |
|---|---|
| `references/modes.md` | Phase 0, always |
| `references/migration-v1.md` | mode is `migrate-v1`, or v1 artifacts exist |
| `references/migration-v2.md` | update from v2, agent/wrapper replacement, or preserved customizations |
| `references/docs-generation.md` | Phase 1, generating any doc |
| `references/claude.md` | drafting `.claude/*`, CLAUDE.md, retiring v1 |
| `references/codex.md` | drafting `.codex/*`, AGENTS.md sizing, Codex snippet, review-lane launcher |
| `references/security.md` | secret handling, scanning, canaries, capability report, trusted reviews |
| `references/state-and-apply.md` | lock, drafts, manifest, ownership, recovery, concurrency |
| `references/report.md` | Phase 5 |
