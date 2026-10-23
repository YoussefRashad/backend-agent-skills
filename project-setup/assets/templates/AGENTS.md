# {{PROJECT_NAME}}

<!-- project-setup:begin id=overview -->
{{ONE_LINE_PURPOSE}}

Stack (from manifests, not guessed): {{STACK_WITH_VERSIONS}}
Package manager: {{PACKAGE_MANAGER}} · Runtime: {{RUNTIME_VERSION}}
<!-- project-setup:end id=overview -->

<!-- project-setup:begin id=critical-rules -->
## Critical rules (apply to every task, every agent)

- Never read, print, copy, or summarize files matching `.ai/security-paths.json`
  (`.env*`, keys, certificates, `secrets/`, `credentials/`, …) directly or through arbitrary scripts.
  The only environment-template exception is the reviewed project-setup `env-keys.mjs` and
  `apply.mjs` flow for the root `.env.example`. Agents MUST NOT open that file directly.
  Other `.env*` files remain denied. This exception does not authorize arbitrary scripts or
  changes to user-level denies. Reports contain key names and value classifications, never values.
  Read diffs and history only via `node .ai/tools/git-safe.mjs diff|log|show …`.
  Env variable names come from config/validation code or the project-setup `env-keys` script, never from env files.
- Never log or return personal data or secrets. Redact before logging.
- Money, balance, payment, and points flows: no read-modify-write without a lock or atomic statement;
  no retry without proven idempotency. See `.ai/context/critical-modules.md`.
- Every endpoint validates input and enforces authorization explicitly.
- Database changes follow the project's own policy: {{DB_CHANGE_POLICY}}.
- Do not change unrelated code. Prefer existing patterns and services over new abstractions.
- For authorized external review, follow project-setup's security reference to prevent disclosure.
  MUST use trusted shipped defaults union .ai/security-paths.json patterns plus projectPatterns.
  MUST establish exclusions and coverage from the trusted checkout. MUST NOT run if policy is
  absent, invalid or unreadable, or trusted defaults cannot be located (for example, when
  project-setup is not installed), or payload exclusions or scanning cannot be proven.
  MUST exclude matching paths from actual outgoing content: context, both rename sides and history.
  MUST scan for secret-shaped strings; never print or send matches. Resolve matches before sending.
  An in-range policy edit MUST NOT shrink coverage. On trusted policy or payload change, MUST
  re-establish exclusions and rescan. git-safe and names-only checks do not prove payload coverage.
  MUST NOT use partial coverage. These prerequisites grant no permission to transmit content.
  Canonical reviewer and docs-sync still prohibit transmission.
<!-- project-setup:end id=critical-rules -->

<!-- project-setup:begin id=commands -->
## Commands

{{VERIFIED_COMMANDS}}
<!-- project-setup:end id=commands -->

<!-- project-setup:begin id=navigation -->
## Where to look (read on demand, not all at once)

| Need | Read |
|---|---|
| Module map, dangerous modules | `.ai/context/project-tree.md` |
| Conventions to copy | `.ai/context/code-patterns.md` |
| Error shapes / status codes | `.ai/context/error-contract.md` |
| Money / auth / PII modules | `.ai/context/critical-modules.md` |
| Configuration (names only) | `.ai/context/configuration.md` |
| Terms | `.ai/context/glossary.md` |
| API conventions | `docs/api-conventions.md` |
| Database conventions | `docs/database.md` |
| Decisions and their evidence | `.ai/decisions/README.md` |
| Open questions and known gaps | `TODO.md` |
<!-- project-setup:end id=navigation -->

<!-- project-setup:begin id=local-instructions -->
## Directory-specific instructions

Before changing files under these paths, read the listed file first (tools do not all load them automatically):

{{NESTED_INSTRUCTION_INDEX}}
<!-- project-setup:end id=local-instructions -->

<!-- project-setup:begin id=agents -->
## Shared agents

- `reviewer`: evidence-based review. Definition: `.ai/agents/reviewer.md`.
- `docs-sync`: update docs after merged changes. Definition: `.ai/agents/docs-sync.md`.

Both tools run the same definitions through thin wrappers (`.claude/agents/`, `.codex/agents/`).
When a review or doc sync is requested, use these named agents (`reviewer`; `docs-sync` in Claude, `docs_sync` in
Codex). Do not create an ad-hoc agent for the same job.
<!-- project-setup:end id=agents -->
