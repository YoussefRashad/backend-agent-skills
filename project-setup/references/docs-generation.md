# Generating documentation

All content is derived from code you actually read. Docs are navigation maps, not copies of the codebase:
document conventions and where to look, not every file or method. Skip any file that would be near-empty.

## Root AGENTS.md (template: `assets/templates/AGENTS.md`)

Budget: <=150 lines, well under 32 KiB (Codex stops loading project docs past its byte budget; Claude
recommends <200 lines per file). Contains only what every task needs: overview, critical rules, verified
commands, navigation table, directory-specific index, shared agents. Write paths in backticks, never `@path`
(Codex treats `@` as text; Claude would eagerly expand it through the CLAUDE.md import).

- `{{STACK_WITH_VERSIONS}}`: from the manifest/lockfile only.
- `{{DB_CHANGE_POLICY}}`: what the project actually does (ORM migrations, manual reviewed DDL, mixed). Detect from
  migration folders, scripts, docs, and DDL files. Do not impose "no schema change without a migration" on a
  project that applies DDL manually; describe its policy and its review step instead.
- `{{VERIFIED_COMMANDS}}`: real scripts with one-line purpose. Mark destructive or production-affecting ones
  (`migration:run`, deploy scripts) with "ask before running".

## Directory-specific instructions (pairs)

Use only where there is evidence of local rules (money flows, auth, PII, generated code):
`src/payments/AGENTS.md` + `src/payments/CLAUDE.md` (`@AGENTS.md`). Always create both:

- Codex loads `AGENTS.md` files from the project root down to the directory it was started in.
- Claude, while a root `CLAUDE.md` exists, ignores nested `AGENTS.md` by default but loads a nested `CLAUDE.md`
  when it works on a file in that directory.
- Neither guarantees the file is loaded for every task, so the root `local-instructions` block lists each path
  with an explicit "read before changing files under …" instruction.

Never move the critical rules into nested files only; the root keeps the short version.

## Project-local security tooling (fully managed, always installed)

| File | Source |
|---|---|
| `.ai/security-paths.json` | Not a plain copy. Only a fresh install (no installed policy) creates it from the skill's `data/secret-paths.json`, with `full` ownership. Afterwards it is the project's effective policy: the managed `patterns` plus, from schema 2, the project's own `projectPatterns`. It legitimately differs from the shipped file and is never replaced by it; ownership comes from the installed record (`keys` after a reviewed migration), never from comparing bytes. Its managed patterns change only through the report, decisions and stage of `references/migration-v2.md` |
| `.ai/tools/security-policy.mjs` | Copy of `assets/tools/security-policy.mjs`: the shared policy helper |
| `.ai/tools/git-safe-core.mjs` | Copy of `assets/tools/git-safe-core.mjs`: the bounded reader core |
| `.ai/tools/guard-raw-git-core.mjs` | Copy of `assets/tools/guard-raw-git-core.mjs`: the raw-Git hook core |
| `.ai/tools/review-diff.mjs` | Copy of `assets/tools/review-diff.mjs`: the review helper |
| `.ai/tools/git-safe.mjs` | Copy of `assets/tools/git-safe.mjs`: read-only diff/log/show/cat/ls/grep and review-diff with secret excludes, no shell |
| `.ai/tools/guard-raw-git.mjs` | Copy of `assets/tools/guard-raw-git.mjs`: the Claude raw-Git hook entrypoint |
| `.ai/tools/hooks-selftest.mjs` | Copy of `assets/tools/hooks-selftest.mjs`: the installed hook self-test |

Each `.ai/tools/` member comes from the corresponding `assets/tools/` file of the same skill copy. A complete
update stages all seven:

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

The shared agents and AGENTS.md depend on the policy and the reader. They are what lets an agent in the project
follow the secret rules without knowing where the skill is installed.

The canonical agents (`.ai/agents/reviewer.md`, `.ai/agents/docs-sync.md`) are fully managed and rendered from
`assets/agents/`: replace `{{PROJECT_NAME}}` and remove references to docs you did not generate. Project-specific
review rules do not go into the canonical reviewer; they live in the optional, project-owned
".ai/agents/reviewer.project.md" (see "Ownership hints").

## `.ai/context/`

| File | Content | Source |
|---|---|---|
| `project-tree.md` | Module map, dependencies, flagged dangerous modules | `src/` walk; each module's controller + service only |
| `critical-modules.md` | Money/balance/payment/points/auth/PII modules: invariants, locking, idempotency, review notes | Entities, services, guards; user's sensitive-area answers |
| `code-patterns.md` | How controllers/services/repositories/DTOs/guards are written here | 2–3 real examples of each |
| `error-contract.md` | Error shapes, exception filters, status mapping | Filters, pipes, handlers. If inconsistent: describe, propose one in `TODO.md` |
| `configuration.md` | Variable / required / secret/non-secret / used by / description / source | Config/validation code via local file tools + `env-keys.mjs keys --template auto`; never values |
| `glossary.md` | Domain terms, enum values, abbreviations | Entity/enum/service names |
| `development-rules.md` | Scope discipline, backward compatibility, reuse of patterns, contract coverage and test-run hygiene | Code style + linter config + project-setup testing and hygiene requirements below |

The testing and hygiene requirements below are skill-template inputs to development-rules.md,
including during update mode when application code and configuration have not changed.

For each rule "X is invalid, unknown or rejected when Y", tests MUST cover Y absent, Y present
but inconsistent, and the boundary. Every documented promise MUST have a test that proves it.

Agents MUST run only the specs they touch; only one full-suite or acceptance run MUST run at a time.
Timing-sensitive specs can fail under concurrent test load.

A red run is loaded only when another test or acceptance run was observably running at the same
time; focused specs count. Record the red run and the overlap evidence, then rerun it alone.
The isolated rerun is the counting result. A red isolated rerun is a failure. Without observed
overlap, do not dismiss a failure as load. Use the same rule in the acceptance record.

Treat development-rules.md as merged living documentation. On update, draft a reviewed merged
edit adding only missing testing and hygiene requirements, even if code and configuration are
unchanged. Keep equivalent existing wording and stricter project requirements. Show conflicts
for an explicit decision; do not silently weaken project text.

Do not re-add a file removed by the user; ask. If code exists and the file was never generated,
propose its creation through the normal reviewed workflow. If absence cannot be distinguished
from user removal, ask before proposing restoration. An empty repository gets no context document
until code exists. If the requirements are already satisfied and nothing else changed, produce
zero diff.

## `.ai/decisions/` (ADRs, template `assets/templates/adr.md`)

Write an ADR only with evidence of an intentional choice: an existing design doc, an explicit code comment, a
commit/PR rationale, or a repeated constraint the code enforces. The `Evidence` line is mandatory. Without
evidence: describe the technology in context docs and add the missing rationale to `TODO.md`. Maintain
`.ai/decisions/README.md` as an index.

## `docs/`

- `api-conventions.md`: versioning, response envelope, pagination/filter/sort, auth headers, rate limits, error
  format. Mermaid `sequenceDiagram` only for a genuinely complex flow (e.g. OTP, payment confirmation).
- `database.md`: ORM, entities and key relationships, the DB change policy as practiced, transaction patterns and
  isolation levels in money/state flows. For PostgreSQL flag (document, never execute) blocking DDL, table
  rewrites, `NOT NULL` without default/backfill, non-`CONCURRENTLY` index builds, rename/drop without a
  compatibility window.
- `observability.md`: what exists (logger, correlation IDs, metrics, health checks, redaction). Gaps → `TODO.md`.
- `integrations/<vendor>.md`: purpose, auth approach (no credentials), endpoints used, timeouts, retry policy,
  **idempotency (never document a retry as safe without confirming it)**, circuit breaking/fallback, logging and
  redaction, quirks from code comments.
- `business-rules/<flow>.md`: only when the domain is clear from code; behaviour that looks like a bug is a
  `TODO.md` item, never a rule.

## `TODO.md` (template `assets/templates/TODO.md`)

Sections: Needs Manual Review · Missing Information · Security Concerns · Inconsistencies · Unverified Controls ·
Cleanup. Every item: file:line where possible, what to confirm, never a secret value.

## Ownership hints

Living docs (`docs/**`, `.ai/context/**`, `.ai/decisions/**`, `TODO.md`) default to `merged`: people and
docs-sync edit them, and they are not drift-tracked. Write an `ownership.json` in the run dir only to override.

Move approved reviewer-specific text to ".ai/agents/reviewer.project.md". Preserve existing
project-file bytes and append only the exact approved text. Do not deduplicate, rewrite or
resolve conflicting rules silently. Present a collision for an explicit decision.

Request its ownership by merging this entry into `.ai/.run/<id>/ownership.json`, preserving the entries the
migration or merge scripts already wrote, and serialize the merged request as two-space JSON with a final LF:

```json
{
  ".ai/agents/reviewer.project.md": "merged"
}
```

Without this request a newly created project file would be inferred as `full`. `merged` does not grant
permission to replace pre-existing text: existing unowned project-file content still needs its applicable
approval. If no reviewer customization is approved for movement, do not create the file, and routine later
updates omit its draft unless the user asked for a project-rule change. Docs-sync has no project file; its
customizations are preserved in the reviewed replacement or explicitly decided.

### Environment template

Derive configuration names from config and validation code using local file tools. Do not
emit shell searches containing environment-access expressions. Inspect the permitted template
with `env-keys.mjs keys --template auto`; stage missing names with
`env-keys.mjs merge --template auto --keys <file> --run-id <id>`.

If the template is missing, copy the script's manual step into the final report and continue
without template staging. If it contains values, preserve them and copy the script's manual
cleanup step into the final report. Never perform an automatic names-only conversion.
