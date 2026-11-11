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
  Launch location also matters. On Claude Code 2.1.310, Windows 11, the 2026-10-25 headless
  probes P1/P2 loaded root CLAUDE.md below the root but did not expand root AGENTS.md.
  A nested pair loaded when present; P2 also loaded root CLAUDE.md without a nested pair.
  Imports resolving outside the start directory did not load, including @../AGENTS.md.
  These are model self-reports; interactive TUI import behavior remains unverified.
- Neither guarantees the file is loaded for every task, so the root `local-instructions` block lists each path
  with an explicit "read before changing files under …" instruction.

Never move the critical rules into nested files only; the root keeps the short version.

Setup MUST render the root-start rule from the root Claude template, including on update when
application code is unchanged. This keeps the refusal instruction in the text observed to load
during a subdirectory launch. Setup MUST preserve the sibling @AGENTS.md imports and user text
outside managed blocks, so the update does not discard local rules.

An existing root CLAUDE.md MUST receive the updated managed claude block through the normal
reviewed draft and ownership workflow. A missing or user-removed instruction file MUST NOT be
silently recreated; resolve its disposition first. Kept old root instructions MUST be reported
as an incomplete update. The nested CLAUDE.md template and its ownership remain unchanged.
A relative import of the root AGENTS.md is not part of this change and MUST NOT be presented
as a replacement for starting Claude Code at the root.

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

The canonical agents (`.ai/agents/reviewer.md`, `.ai/agents/docs-sync.md`) are fully managed.
Render them from `assets/agents/`: replace `{{PROJECT_NAME}}` and remove references to docs
you did not generate. Project-specific rules MUST use the optional, project-owned extensions
".ai/agents/reviewer.project.md" and ".ai/agents/docs-sync.project.md" with merged ownership,
so canonical updates do not erase project requirements (see "Ownership hints").

Project maintainers and explicitly authorized setup or standards workflows MAY write these
extensions. Docs-sync MUST NOT write either extension. Project rules MAY add or tighten
requirements; they MUST NOT relax canonical restrictions. Setup MUST NOT copy an extension
from a default template or synthesize one without approved content.

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

## Documentation source of truth on backend-standards projects

On a project where backend-standards (BS) provenance is established, `.ai/standards/03-project-architecture.md` (03) owns the architectural facts. Project-setup writes navigation pointers for the overlapping documents instead of a second full description, because two detailed descriptions of one fact drift apart.

This mapping is a documentation policy layered over the detected mode. Mode selection in `references/modes.md` stays authoritative: a valid manifest selects `update`, invalid metadata selects `invalid`, existing configuration without reliable provenance uses conservative adoption, and BS naming or markers do not establish v1 provenance. The no-source rules above stay authoritative too: setup never generates context documents merely to populate this mapping.

### Detection and activation

BS writes provenance in two ways. Its new-service procedure writes a root `.backend-standards.json` stamp:

```json
{
  "version": "<templates version>",
  "appliedBy": "backend-standards"
}
```

Its existing-project procedure writes no stamp. It optionally recommends running project-setup first, then delivers 03, known deviations, CLAUDE.md and two Claude agents. The BS CLAUDE.md template carries the 03 import and a provenance sentence:

```text
@.ai/standards/03-project-architecture.md

Applied from the `backend-standards` skill, version `<version>`.
```

On these signals, automatic activation requires a readable, permitted 03 and either:

1. A valid root stamp object with `appliedBy: "backend-standards"` and a valid semantic-version string; or
2. With no stamp, one unambiguous BS CLAUDE provenance sentence containing a concrete semantic version, together with the import of this same 03.

The second signal is accepted (maintainer decision Q1, 2026-11-11), because the existing-project BS procedure writes no stamp and a stamp-only rule would prompt on a primary path. An explicitly approved owner decision, recorded as described below, may independently select the layout.

> Setup MUST distinguish absent signals from denied, unsafe, malformed or unreadable signals, because a failed read does not establish absence.
>
> Setup MUST inspect provenance only within the existing permitted-read boundary. Layout signals grant no additional read, write or ownership permissions.
>
> Setup MUST NOT infer BS provenance from the architecture filename alone.

Do not require exactly BS 3.1.0. Resolve the installed document's headings and coverage.

| Signals | Treatment |
|---|---|
| Readable 03 and valid stamp; other signals agree or are absent | Activate mapping. |
| Readable 03, absent stamp, valid BS CLAUDE sentence and matching import | Activate mapping; show the sentence and the import in Phase 0. |
| Readable 03 and the exact approved owner-decision sentence | Honor the decision unless current evidence conflicts. |
| Recognized BS provenance but 03 absent | Hold affected generation and report incomplete BS documentation. |
| 03 alone | Show ambiguity and request a concrete disposition. Do not generate competing full documents while pending. |
| Malformed stamp, conflicting `appliedBy`, contradictory versions, conflicting provenance sentences or inconsistent imports | Hold activation. Another signal cannot silently override the conflict. |
| No accepted signal | Existing PS documentation rules. |
| Owner confirms an unrelated 03 | Existing PS rules; no automatic conversion or ownership claim over 03. |
| Installed pointers but a signal disappears | Preserve pointers and report inconsistency. Never automatically expand them into full documents. |

### Durable owner decision

The fixed location is **root `AGENTS.md`, outside every managed block**. The exact affirmative sentence is:

```text
Documentation layout decision: use .ai/standards/03-project-architecture.md as the source of truth for project-setup mapped documentation.
```

> Setup MUST search for this exact standalone sentence in root AGENTS.md outside managed blocks, because a decision in an unspecified location cannot reliably guide later runs.
>
> Setup MUST propose and record this sentence only after explicit owner approval through the reviewed instruction-file workflow. Its absence, approximate wording, quotation inside an example, or presence in another file MUST NOT count as this decision.
>
> Setup MUST hold conflicting or duplicated decision records for explicit disposition rather than choosing one silently.
>
> Setup MUST show the signals, selected policy, detected mode and unresolved dispositions in Phase 0, because otherwise adoption can create duplicate factual owners.
>
> Setup MUST NOT repair or manufacture the BS stamp.

The sentence records an owner-selected layout; it does not prove that BS ran. A non-BS project may opt in through the same reviewed decision.

Preserving this sentence outside blocks follows the existing preservation requirement for user text (see "Root AGENTS.md" and the root-start rule above). Bind unchanged root AGENTS.md as an input when activation relies on it (see "Source binding" below).

### Document mapping

The existing PS document inventory above remains intact. Heading text, not section numbers, determines destinations; the numbers below describe the current BS template.

| PS document | Destination or disposition |
|---|---|
| `.ai/context/project-tree.md` | **Module layout** (§4); dangerous-module references also link to **Landmines** (§15). |
| `.ai/context/critical-modules.md` | **Module layout** (§4), **Authentication and authorization** (§6), **Database** (§7), including **Money (`01` §6)**, **Cache, locks and queues** (§8), **Outbound integrations** (§9), **Observability** (§10), including **Retention (`02` §3)**, and **Landmines** (§15). Preserve invariants, ownership boundaries, transactions, locking, idempotency and PII facts. |
| `.ai/context/code-patterns.md` | Generate in full. Preserve implementation examples and conventions; reference architectural facts in 03. |
| `.ai/context/error-contract.md` | **API surface** (§5), including error contracts and final response-writing paths. |
| `.ai/context/configuration.md` | **Configuration** (§3). Preserve variable name, requiredness, classification, consumer, description and source coverage. Never values. |
| `.ai/context/glossary.md` | **Domain glossary** (§14). |
| `.ai/context/development-rules.md` | Generate in full. Preserve testing, compatibility, scope and test-run hygiene requirements; reference tooling and local-development facts in 03. |
| `docs/api-conventions.md` | **API surface** (§5) and **Authentication and authorization** (§6), including evidenced rate-limit conventions. |
| `docs/database.md` | **Database** (§7), including **Schema changes** and **Money (`01` §6)**; **Module layout** (§4) for entity locations and naming conventions. |
| `docs/observability.md` | **Observability** (§10) and **Health, shutdown, deployment** (§11), retaining health-check coverage. |
| `docs/integrations/<vendor>.md` | **Outbound integrations** (§9), scoped to the vendor; **Observability** (§10) for shared logging/redaction behavior. |
| `docs/business-rules/<flow>.md` | Generate in full only with sufficient domain evidence. Reference shared contracts in 03. |
| `.ai/decisions/README.md` | Generate in full as the ADR index. |
| `.ai/decisions/<adr>.md` | Generate in full, retaining the evidence requirement. |
| `TODO.md` | Generate in full for uncertainty, conflicts and unverified controls. |
| Root `AGENTS.md` | Generate instructions with critical rules, navigation and conditional routing. |
| Root `CLAUDE.md` | Generate or merge instructions, preserving BS imports and version information and installing the PS import and managed block through review. |
| Directory-specific `AGENTS.md` / `CLAUDE.md` pairs | Preserve local instructions and paired files; reference 03 for shared facts. |

> For an activated mapping, setup MUST generate each applicable mapped PS document as a pointer and consolidate its evidenced architectural facts into the mapped sections of 03, because separate detailed descriptions drift.
>
> Setup MUST preserve the information requirements of the original PS document. A shorter BS table MUST NOT justify losing configuration inventories, transaction details, error transformations, integration safeguards or critical-module invariants.

03 may require reviewed expansion. Its Configuration and Outbound integrations sections start with comparatively compact structures. Changes are to the target project's 03, never the BS template.

**Instruction-summary exception:** root and local instruction files retain concise critical-rule summaries, stack identification, DB-change policy and executable commands required for their instruction role. These summaries MUST agree with 03 and reference it for architectural detail.

This keeps the rule above that the root keeps the short version, and the BS requirement that its CLAUDE.md commands stay consistent.

> Setup MUST resolve headings after removing an optional leading section number and normalizing whitespace. It MUST preserve meaningful text, including parenthetical cross-references, because removing arbitrary parentheses can collapse distinct destinations.
>
> Setup MUST resolve subordinate headings within their named parent section. Missing, renamed or ambiguous destinations require explicit disposition; setup MUST NOT choose a similar heading silently or generate a duplicate full document.
>
> Pointers MUST reproduce actual resolved heading names.

Use file links with named headings rather than generated fragment identifiers. Renumbering remains usable; changed cross-references or meaning require review.

Each section bullet is one line: `- <Heading>` for a top-level section, or `- <Parent> > <Subheading>` for a subordinate heading, for example `- Database > Schema changes`. A subordinate heading is never listed without its parent, and every mapped section of the PS document is listed.

### Pointer format

Use this skeleton; no shipped template file carries it.

```markdown
# {{TITLE}}

<!-- project-setup:documentation-pointer v=1 -->

Source of truth: [Project architecture]({{RELATIVE_PATH_TO_03}}).

Sections:
{{SECTION_BULLETS}}

Scope: {{TOPIC_OR_VENDOR}}.

Readers and agents MUST follow the source link and read the named sections
before relying on or updating this topic, because this file contains
navigation only.

Readers and agents making documentation updates MUST change the source
sections instead of adding factual content here, because duplicate
descriptions drift. Preserve this pointer unless its destination changes.

If the source or a named section is missing or unclear, documentation-writing
agents MUST record the gap in the repository-root TODO.md within their
authorized scope. Read-only agents MUST report the gap in their output and
MUST NOT create, modify or delete files. Other readers MUST report the gap
to the documentation owner. These duties preserve each actor's write
boundary.

Documentation-writing agents MUST resolve the destination before changing
the affected documented facts, because an unresolved destination cannot
establish the factual source of truth.
```

Expansion rules:

- Replace every placeholder.
- Emit one section bullet per resolved heading or parent/subheading pair.
- Use the relative paths below.
- Include no copied factual summaries, tables, timestamps or hashes.
- Identify the vendor in `Scope`; generate vendor pointers only with evidence.
- Exempt valid pointers from the generic "skip near-empty documents" instruction.
- Keep the pointer marker distinct from managed-block markers.

| Pointer directory | Relative path to 03 |
|---|---|
| `.ai/context/` | `../standards/03-project-architecture.md` |
| `docs/` | `../.ai/standards/03-project-architecture.md` |
| `docs/integrations/` | `../../.ai/standards/03-project-architecture.md` |

Each pointer MUST supply complete routing when opened alone. Correct routing MUST NOT depend on root text, imports or subagent inheritance. Actual agent compliance remains a live measurement.

The split reporting duty matches both reviewer wrappers: the Claude reviewer has no Edit/Write tools and forbids shell workarounds, and the Codex reviewer forbids file changes.

### Ownership

> Setup MUST request `merged` ownership for pointers and a created or changed 03, because these are living project documents.
>
> Setup MUST NOT claim ownership of 03 merely by reading or linking it.
>
> Setup MUST preserve user additions to pointers until their disposition is approved; the pointer marker grants no deletion permission.
>
> Setup MUST review ownership transitions alongside content changes.

Living PS docs without blocks already infer `merged`. `.ai/standards/` is outside that inference, so a newly created or changed 03 needs an explicit entry in the ownership request to avoid `full`.

### Conditional root routing

For activated projects, add this paragraph to the generated root `critical-rules` block:

> Readers and agents MUST follow documentation pointers to their named source sections before relying on or updating the topic. For BS-mapped documentation, `.ai/standards/03-project-architecture.md` owns the facts; pointer files contain navigation only. All agents, including reviewer and docs-sync, MUST follow that routing. Documentation-writing agents MUST update the affected source sections instead of expanding a pointer, because separate descriptions drift. If a destination is missing or unclear, documentation-writing agents MUST record the gap in root `TODO.md` within their authorized scope and resolve the destination before changing the affected documented facts. Read-only agents MUST report the gap in their output and MUST NOT create, modify or delete files. Other readers MUST report the gap to the documentation owner. These duties preserve each actor's write boundary.

Add this sentence to the generated navigation:

> Some entries below are documentation pointers; follow their source links and named headings.

Keep `assets/templates/AGENTS.md` unchanged. Non-activated output receives neither addition.

Preserve the existing money/auth critical rule and its `.ai/context/critical-modules.md` reference, including locking, atomicity and idempotency requirements. That document becomes a self-sufficient pointer.

### Canonical agents and extensions

The canonical agents stay unchanged. Docs-sync maps changes to PS document paths and reads the entire target document before editing; the pointer supplies the onward destination. The reviewer also reads documents that become pointers. This specifies the intended workflow without proving host compliance.

> Setup MUST NOT synthesize or append a docs-sync extension solely to enable pointer routing. Existing project customizations MUST retain explicit dispositions and exact-text preservation, because mapping cannot bypass project-rule approval.
>
> If BS has changed an installed PS wrapper, setup MUST apply the existing user-modified-file rule separately to that wrapper: keep theirs, take new, or merge through review.
>
> Setup MUST inventory rules and frontmatter before replacement. Approved project rules MUST use the existing project-extension destinations, preserving existing extension bytes. Approval cannot relax a canonical restriction.
>
> Setup MUST report a retained standalone BS agent or unresolved custom wrapper as an incomplete PS agent update and identify the definition actually invoked.

These apply the existing adoption and update rules in `references/modes.md`; they add no new wrapper-generation behavior. A declined replacement of the standalone BS docs-sync still permits the mapping (maintainer decision Q8): keep the retained agent, report the incomplete PS agent installation and make no canonical-compatibility claim.

### Existing-content consolidation

> Before converting an existing document, setup MUST inventory its substantive content and propose a destination for every item: an evidenced section of 03, an uncovered full document, or an explicitly unresolved TODO item.
>
> Setup MUST obtain dispositions for contradictions and removals. It MUST NOT move a known invariant solely into TODO to make conversion appear complete.
>
> Setup MUST stage approved source changes, pointer replacements, routing instructions and ownership changes in one reviewed apply transaction. It MUST NOT replace an original while necessary consolidation remains unapproved.

Apply this equally to adoption and update. PS provenance does not make existing knowledge disposable. When consolidation is declined or a destination stays unresolved, keep the originals and report incomplete conversion (maintainer decision Q3). A project where BS ran after project-setup follows the per-file recovery in `references/modes.md` before any conversion.

| Case | Required treatment |
|---|---|
| PS full documents precede BS's 03 | Inventory and reconcile during PS update; do not require a new-service stamp. |
| BS overwrites or merges PS instructions/wrappers | Measure first, then apply the per-file recovery table. Retain the BS overwrite TODO. |
| Missing or malformed managed markers | Apply existing removed-content or marker-error rules; no silent repair. |
| Blank mapped section | Complete from permitted implementation evidence; identify unknowns explicitly. |
| Owner declines necessary completion | Retain originals, hold dependent conversions, report incomplete consolidation. |
| Existing document contradicts 03 | Show both locations and verify permitted code; obtain disposition. |
| Detail exceeds BS tables | Propose reviewed expansion under the matching section; apply Q7 (see "Size" below). |
| Heading renumbered | Match normalized heading text under its parent. |
| Heading renamed, removed, duplicated or cross-reference changed | Hold until a replacement/addition is approved. |
| Facts added to a pointer | Preserve and inventory them; propose consolidation. |
| User deleted a pointer | Do not silently recreate it; resolve disposition. Docs-sync reports missing navigation. |
| Local instructions exist | Preserve both members of each pair and local constraints. |
| Local instruction conflicts with routing | Resolve before installing contradictory root text. |
| 03 protected, unsafe or unreadable | Stop the affected step; no bypass or duplicate-document fallback. |
| No evidenced vendor/business flow | Do not invent documents. |
| All source/output unchanged | Zero diff, including manifest bytes. |
| Required source changes after prepare | Existing drift binding refuses commit; reprepare according to run lifecycle. |
| Partial apply or intervening rollback edits | Preserve recovery material and follow journal handling. |

**Size.** Decision Q7 (2026-11-11): record the UTF-8 bytes and line count of 03 before and after consolidation, use a review threshold rather than an assumed host ceiling, keep concise complete facts in 03 and make no automatic split. Never truncate facts to meet an assumed limit; an appendix needs its own reviewed ownership and navigation contract first.

### Source binding

> A pointer transaction MUST declare existing 03 in `transaction-inputs.json` when it is not drafted, because approval must bind the source used to resolve headings and content.
>
> Setup MUST also bind unchanged root CLAUDE.md when activation relies on its provenance, and unchanged root AGENTS.md when activation relies on the exact owner decision. Drafted targets already receive target-hash binding.

The existing prepare and commit recheck inputs, targets, drafts and request metadata before writing (`references/state-and-apply.md`).

Do not declare `.backend-standards.json`: it is outside the existing scope accepted for transaction inputs. Reconfirm its disposition immediately before prepare.

**Accepted limitation:** the stamp can change between that check and commit. This release adds neither atomic stamp binding nor a production-script change.

### Validation boundary

`reference-exists` examines instruction files and `.ai/agents/*.md`; it does not validate ordinary pointer destinations or headings. Therefore:

- Preserve applicable navigation references to emitted pointers.
- Deleting a referenced pointer must still fail `reference-exists`.
- The project-setup test-only checker validates pointer paths, containment, headings and format.
- Drafting instructions MUST require destination inspection.
- The checker does not become shipped enforcement.
- Validator success alone does not prove mapping correctness or restored root-start semantics.

A later BS copy or re-sync can erase consolidated 03 content and can replace PS instructions or wrappers again; project-setup does not prevent either. Accepting a BS re-sync requires reviewed preservation or merge of that content, and the durable fix remains BS 4.0.0 work.

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
updates omit its draft unless the user asked for a project-rule change.

Approved docs-sync-specific text MUST move to ".ai/agents/docs-sync.project.md", so replacing
the canonical agent does not discard project requirements. Setup MUST preserve existing
project-file bytes and append only the exact approved text. It MUST NOT deduplicate, rewrite
or resolve conflicting rules silently; a collision requires an explicit decision.
A customization that relaxes a canonical docs-sync rule MUST NOT move;
its disposition stays pending.

If an existing file lacks a final newline, setup MUST add one EOL before the approved append,
so the last existing line and the first appended line cannot join. The appended text MUST use
the file's EOL; apply's withEol preserves CRLF. No other separator or blank line is added.

Setup MUST request merged ownership for a created or changed docs-sync project file, so later
updates do not treat project guidance as a fully managed agent. Merge the following entry into
the existing ownership.json request, preserving all other entries. Serialize the request as
two-space JSON with a final LF.

```json
{
  ".ai/agents/docs-sync.project.md": "merged"
}
```

Without this request, a newly created project file would be inferred as full. Merged ownership
does not authorize replacing existing text or bypassing the applicable user-content approval.

If no docs-sync customization is approved, setup MUST NOT create the file. Routine updates
MUST omit its draft unless the user requested a project-rule change, so setup cannot regenerate
or erase project-owned rules.

### Environment template

Derive configuration names from config and validation code using local file tools. Do not
emit shell searches containing environment-access expressions. Inspect the permitted template
with `env-keys.mjs keys --template auto`; stage missing names with
`env-keys.mjs merge --template auto --keys <file> --run-id <id>`.

If the template is missing, copy the script's manual step into the final report and continue
without template staging. If it contains values, preserve them and copy the script's manual
cleanup step into the final report. Never perform an automatic names-only conversion.
