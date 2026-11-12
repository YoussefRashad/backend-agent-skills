# Frozen plan: project-setup 3.1.0 — 03 as the documentation source of truth

Frozen 2026-11-11 on feat/ps-bs-doc-map (base main fd7ae54) after three plan/critique rounds; pass 3
reported no BLOCKING gap. Class: normal. Approach fixed by the maintainer: on a backend-standards
project, `.ai/standards/03-project-architecture.md` is the architecture source of truth, project-setup
emits pointer docs, backend-standards is unchanged. Open questions are settled in §11 (advisor-delegated)
and the pass-3 non-blocking findings are applied in §12. This file is never edited; changes go through
the maintainer.

## Round-3 disposition of critique pass 2 (N1–N7)

| Gap | Disposition | Where | Reason |
|---|---|---|---|
| N1 | FIXED | §§4–5, 8–10 | Defines per-file PS update behavior whether BS overwrites or merges CLAUDE.md and either Claude wrapper. Requires live observation before recovery, reviewed dispositions, corresponding checker expectations, and preservation of BS overwrite work in the BS 4.0.0 TODO. |
| N2 | FIXED | §§4, 8 | Both routing texts distinguish documentation-writing agents from read-only agents. Read-only agents report gaps in their output and MUST NOT write. Mutation controls cover both texts. |
| N3 | FIXED | §§7–8 | Adds an actual-byte amendment-shape gate: insertions by default, exact named replacement exceptions, and no removed RFC 2119 obligations. Adds one narrowly bounded TODO deletion exception to retain the undisputed closeout requirement. |
| N4 | FIXED | §8 | Makes each exact fixture `safe.directory` grant a user-performed prerequisite. The helper and agents never grant it. Ownership failures are setup failures, not routing results. |
| N5 | FIXED | §8 | Specifies the baseline source, explicit installation destinations, user-performed install/verify/switch steps, and one active copy confirmed in a new session before every run. |
| N6 | FIXED | §§2, 5, 8 | Defines one exact owner-decision sentence in root AGENTS.md outside managed blocks, its matching rules, reviewed creation, and transaction binding. |
| N7 | FIXED | §§7–8 | Adds C10 raw-content checks and unchanged-source gate, C12 README/CHANGELOG pins, C13/C14 report pins, and both C17 current-version consumers. |

# Revised plan: project-setup 3.1.0 — 03 as the documentation source of truth

This is the complete round-3 implementation plan. This worker read repository files only; no files were edited, created or deleted, and no tests, installations or live probes were run.

HEAD was verified as `fd7ae5406ce16fca8444bb574be35704f319ba1d` on `feat/ps-bs-doc-map`. `git status --short` returned no changes, with warnings that the user-global ignore file was inaccessible. The supplied baseline is clean and equal to main.

The maintainer has fixed the approach, class and version:

- `.ai/standards/03-project-architecture.md` owns architecture facts on activated projects.
- Project-setup emits pointers for overlapping documentation.
- Backend-standards remains unchanged.
- Change class is **normal**.
- PS releases as **3.1.0**.

The remaining maintainer decisions in §10 remain open. Recommendations are not approvals.

## 1. Scope and boundaries

### In scope

- Detect the BS documentation layout separately from PS setup mode.
- Convert nine overlapping PS document families to self-sufficient pointers.
- Preserve substantive content through reviewed consolidation into 03.
- Handle BS → PS adoption and PS → BS existing-project adoption → PS update.
- Measure the state left by unchanged BS and define reviewed PS recovery for either overwrite or merge outcomes.
- Add conditional root routing without changing canonical templates.
- Preserve ownership, approvals, validation, source binding and rollback.
- Update current release claims, including root README.
- Preserve historical digests through exact, verified amendment reversals.
- Add standalone contract/release tests and runnable live acceptance.
- Resolve only the competing-document-homes TODO subitem after acceptance; retain the remaining BS integration work and limitations.

### Out of scope

- Every change under `backend-standards/`, including templates and agents.
- Changes to shipped PS canonical agents, wrappers or instruction templates.
- Production detection, validation, apply, installer, release-builder or test-runner changes.
- Implementing BS 4.0.0 integration or fixing existing reviewer residuals.
- Dependency upgrades or application changes outside disposable acceptance fixtures.
- Database migrations.
- Other skills, ADRs, frozen `docs/plans/**`, and existing `tests/REVIEW-*.md`.

Target-project instructions, wrappers and approved project extensions may be restored or merged through existing PS workflows. Their shipped source assets remain unchanged.

PS ships versioned payload and has digest-sensitive release tests; it is not an application runtime. [CLAUDE.md:5](CLAUDE.md:5)

New drafting rules MUST name an actor, use the intended RFC 2119 strength, and explain the failure prevented. Verification claims MUST state their actual scope. [.ai/context/code-patterns.md:25](.ai/context/code-patterns.md:25), [.ai/context/development-rules.md:64](.ai/context/development-rules.md:64)

## 2. Detection and activation

### Existing mode selection remains unchanged

The mapping is a documentation policy layered over the detected mode:

- A valid PS manifest selects `update`.
- Invalid metadata selects `invalid`.
- Existing configuration without reliable provenance uses conservative adoption.
- BS naming or markers do not establish PS v1 provenance.

These rules remain authoritative. [modes.md:6](project-setup/references/modes.md:6), [modes.md:71](project-setup/references/modes.md:71)

The no-source rules also remain authoritative: setup MUST NOT generate context documents merely to populate this mapping. [docs-generation.md:125](project-setup/references/docs-generation.md:125)

### The two BS procedures have different provenance

The new-service procedure writes:

```json
{
  "version": "<templates version>",
  "appliedBy": "backend-standards"
}
```

The existing-project procedure does not prescribe this stamp. It optionally recommends PS first, then delivers 03, known deviations, CLAUDE.md and two Claude agents. PS-first is therefore a primary migration path, not an unusual legacy case. [backend-standards/SKILL.md:367](backend-standards/SKILL.md:367), [backend-standards/SKILL.md:417](backend-standards/SKILL.md:417)

The BS CLAUDE template contains:

```text
@.ai/standards/03-project-architecture.md

Applied from the `backend-standards` skill, version `<version>`.
```

In the inspected repository, the import is at line 19 and the provenance sentence is at line 52. [BS CLAUDE.md:19](backend-standards/templates/docs/CLAUDE.md:19), [BS CLAUDE.md:52](backend-standards/templates/docs/CLAUDE.md:52)

### Activation rule — D1, subject to Q1

Recommended automatic activation requires a readable, permitted 03 and either:

1. A valid root stamp object with `appliedBy: "backend-standards"` and a valid semantic-version string; or
2. With no stamp, one unambiguous BS CLAUDE provenance sentence containing a concrete semantic version, together with the import of this same 03.

An explicitly approved owner decision recorded as specified below may independently select the layout.

> Setup MUST distinguish absent signals from denied, unsafe, malformed or unreadable signals, because a failed read does not establish absence.
>
> Setup MUST inspect provenance only within the existing permitted-read boundary. Layout signals grant no additional read, write or ownership permissions.
>
> Setup MUST NOT infer BS provenance from the architecture filename alone.

Do not require exactly BS 3.1.0. Resolve the installed document’s headings and coverage.

| Signals | Treatment |
|---|---|
| Readable 03 and valid stamp; other signals agree or are absent | Activate mapping. |
| Readable 03, absent stamp, valid BS CLAUDE sentence and matching import | Activate if Q1 accepts this signal; otherwise obtain owner disposition. |
| Readable 03 and the exact approved owner-decision sentence | Honor the decision unless current evidence conflicts. |
| Recognized BS provenance but 03 absent | Hold affected generation and report incomplete BS documentation. |
| 03 alone | Show ambiguity and request a concrete disposition. Do not generate competing full documents while pending. |
| Malformed stamp, conflicting `appliedBy`, contradictory versions, conflicting provenance sentences or inconsistent imports | Hold activation. Another signal cannot silently override the conflict. |
| No accepted signal | Existing PS documentation rules. |
| Owner confirms an unrelated 03 | Existing PS rules; no automatic conversion or ownership claim over 03. |
| Installed pointers but a signal disappears | Preserve pointers and report inconsistency. Never automatically expand them into full documents. |

### Durable owner decision — D2

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

Preserving this sentence outside blocks follows the existing preservation requirement for user text. Bind unchanged root AGENTS.md as an input when activation relies on it. [docs-generation.md:38](project-setup/references/docs-generation.md:38), [state-and-apply.md:78](project-setup/references/state-and-apply.md:78)

If Q1 retains stamp-only automatic activation, documentation and live expectations MUST explicitly require owner disposition for unstamped BS existing-project installations.

## 3. Complete document mapping

The existing PS document inventory remains intact. [docs-generation.md:94](project-setup/references/docs-generation.md:94), [docs-generation.md:131](project-setup/references/docs-generation.md:131), [docs-generation.md:138](project-setup/references/docs-generation.md:138)

Section numbers below describe the current BS template; heading text determines destinations.

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

The actual subordinate headings are `Schema changes`, `Money (`01` §6)` and `Retention (`02` §3)`. [03 template:152](backend-standards/templates/docs/03-project-architecture.md:152), [03 template:162](backend-standards/templates/docs/03-project-architecture.md:162), [03 template:219](backend-standards/templates/docs/03-project-architecture.md:219)

### Mapping rule — M1

> For an activated mapping, setup MUST generate each applicable mapped PS document as a pointer and consolidate its evidenced architectural facts into the mapped sections of 03, because separate detailed descriptions drift.
>
> Setup MUST preserve the information requirements of the original PS document. A shorter BS table MUST NOT justify losing configuration inventories, transaction details, error transformations, integration safeguards or critical-module invariants.

03 may require reviewed expansion. Its Configuration and Outbound integrations sections start with comparatively compact structures. Changes are to the target project’s 03, never the BS template. [03 template:55](backend-standards/templates/docs/03-project-architecture.md:55), [03 template:190](backend-standards/templates/docs/03-project-architecture.md:190)

**Instruction-summary exception:** root and local instruction files retain concise critical-rule summaries, stack identification, DB-change policy and executable commands required for their instruction role. These summaries MUST agree with 03 and reference it for architectural detail.

This preserves PS’s “root keeps the short version” rule and BS’s command-consistency requirement. [docs-generation.md:36](project-setup/references/docs-generation.md:36), [BS CLAUDE.md:46](backend-standards/templates/docs/CLAUDE.md:46)

### Heading rule — M2

> Setup MUST resolve headings after removing an optional leading section number and normalizing whitespace. It MUST preserve meaningful text, including parenthetical cross-references, because removing arbitrary parentheses can collapse distinct destinations.
>
> Setup MUST resolve subordinate headings within their named parent section. Missing, renamed or ambiguous destinations require explicit disposition; setup MUST NOT choose a similar heading silently or generate a duplicate full document.
>
> Pointers MUST reproduce actual resolved heading names.

Use file links with named headings rather than generated fragment identifiers. Renumbering remains usable; changed cross-references or meaning require review.

## 4. Pointer format, ownership and agent routing

### Exact pointer skeleton

Add this skeleton to `references/docs-generation.md`; add no shipped template file.

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
- Exempt valid pointers from the generic “skip near-empty documents” instruction.
- Keep the pointer marker distinct from managed-block markers.

| Pointer directory | Relative path to 03 |
|---|---|
| `.ai/context/` | `../standards/03-project-architecture.md` |
| `docs/` | `../.ai/standards/03-project-architecture.md` |
| `docs/integrations/` | `../../.ai/standards/03-project-architecture.md` |

Each pointer MUST supply complete routing when opened alone. Correct routing MUST NOT depend on root text, imports or subagent inheritance. Actual agent compliance remains a live measurement.

The split reporting duty matches both reviewer wrappers: Claude has no Edit/Write tools and forbids shell workarounds; Codex explicitly forbids file changes. [claude-reviewer.md:4](project-setup/assets/wrappers/claude-reviewer.md:4), [claude-reviewer.md:13](project-setup/assets/wrappers/claude-reviewer.md:13), [codex-reviewer.toml:15](project-setup/assets/wrappers/codex-reviewer.toml:15)

### Ownership rule — O1

> Setup MUST request `merged` ownership for pointers and a created or changed 03, because these are living project documents.
>
> Setup MUST NOT claim ownership of 03 merely by reading or linking it.
>
> Setup MUST preserve user additions to pointers until their disposition is approved; the pointer marker grants no deletion permission.
>
> Setup MUST review ownership transitions alongside content changes.

Living PS docs without blocks already infer `merged`. `.ai/standards/` is outside that inference, so a newly created 03 requires an explicit request to avoid `full`. [apply.mjs:631](project-setup/scripts/apply.mjs:631)

### Conditional root reinforcement

For activated projects, add this paragraph to the generated root `critical-rules` block:

> Readers and agents MUST follow documentation pointers to their named source sections before relying on or updating the topic. For BS-mapped documentation, `.ai/standards/03-project-architecture.md` owns the facts; pointer files contain navigation only. All agents, including reviewer and docs-sync, MUST follow that routing. Documentation-writing agents MUST update the affected source sections instead of expanding a pointer, because separate descriptions drift. If a destination is missing or unclear, documentation-writing agents MUST record the gap in root `TODO.md` within their authorized scope and resolve the destination before changing the affected documented facts. Read-only agents MUST report the gap in their output and MUST NOT create, modify or delete files. Other readers MUST report the gap to the documentation owner. These duties preserve each actor’s write boundary.

Add to generated navigation:

> Some entries below are documentation pointers; follow their source links and named headings.

Keep `assets/templates/AGENTS.md` unchanged. Non-activated output receives neither addition.

Preserve the existing money/auth critical rule and its `.ai/context/critical-modules.md` reference, including locking, atomicity and idempotency requirements. That document becomes a self-sufficient pointer. [AGENTS.md template:22](project-setup/assets/templates/AGENTS.md:22)

### Canonical agents and extensions remain unchanged

Canonical docs-sync maps changes to PS document paths and reads the entire target document before editing. The pointer supplies the onward destination; this specifies the intended workflow without proving host compliance. [docs-sync.md:21](project-setup/assets/agents/docs-sync.md:21), [docs-sync.md:64](project-setup/assets/agents/docs-sync.md:64)

Reviewer also references documents becoming pointers, so both agents require live routing measurements. [reviewer.md:73](project-setup/assets/agents/reviewer.md:73), [reviewer.md:253](project-setup/assets/agents/reviewer.md:253)

### Extension and recovery rule — O2

> Setup MUST NOT synthesize or append a docs-sync extension solely to enable pointer routing. Existing project customizations MUST retain explicit dispositions and exact-text preservation, because mapping cannot bypass project-rule approval.
>
> If BS has changed an installed PS wrapper, setup MUST apply the existing user-modified-file rule separately to that wrapper: keep theirs, take new, or merge through review.
>
> Setup MUST inventory rules and frontmatter before replacement. Approved project rules MUST use the existing project-extension destinations, preserving existing extension bytes. Approval cannot relax a canonical restriction.
>
> Setup MUST report a retained standalone BS agent or unresolved custom wrapper as an incomplete PS agent update and identify the definition actually invoked.

These are applications of existing adoption and update rules. They do not authorize new wrapper-generation behavior. [modes.md:56](project-setup/references/modes.md:56), [modes.md:83](project-setup/references/modes.md:83)

## 5. Migration, reporting and failure handling

### Consolidation rule — C1

> Before converting an existing document, setup MUST inventory its substantive content and propose a destination for every item: an evidenced section of 03, an uncovered full document, or an explicitly unresolved TODO item.
>
> Setup MUST obtain dispositions for contradictions and removals. It MUST NOT move a known invariant solely into TODO to make conversion appear complete.
>
> Setup MUST stage approved source changes, pointer replacements, routing instructions and ownership changes in one reviewed apply transaction. It MUST NOT replace an original while necessary consolidation remains unapproved.

Apply this equally to adoption and update. PS provenance does not make existing knowledge disposable. [modes.md:22](project-setup/references/modes.md:22), [modes.md:42](project-setup/references/modes.md:42)

### PS-first recovery: measure BS before proposing repairs

BS instructs the agent to write CLAUDE.md from its template and copy two Claude agents. Its existing-project procedure invokes those operations. The repository records the overwrite problem as unfinished BS 4.0.0 work. The actual outcome of a particular agent run—overwrite, merge, unchanged or mixed—must be observed. [backend-standards/SKILL.md:217](backend-standards/SKILL.md:217), [backend-standards/SKILL.md:278](backend-standards/SKILL.md:278), [backend-standards/SKILL.md:447](backend-standards/SKILL.md:447), [TODO.md:64](TODO.md:64)

The helper MUST NOT pre-restore PS files, intercept BS writes, or simulate a desired outcome.

| File | If BS overwrites | If BS merges or preserves | PS 3.1 completion/checker expectation |
|---|---|---|---|
| Root `CLAUDE.md` | Inventory lost PS import/block and preserved/new BS content. Propose a reviewed merge restoring `@AGENTS.md` and the complete current managed `claude` block, including the root-start rule. Preserve BS imports, version sentence, commands and approved user content. | Inspect the resulting import, block, BS lines and user text. Preserve correct content; review missing or changed parts. Do not assume a merge preserved every rule. | Exactly one effective sibling import and one valid managed `claude` block with the required source-template content; BS imports/version information retained; approved user content preserved; no duplicate/conflicting instructions. |
| `.claude/agents/reviewer.md` | Treat it as a user-modified fully owned file when its manifest record says `full`. Offer keep/take-new/merge and inventory BS rules/frontmatter. | Compare actual bytes against the manifest and shipped wrapper. Apply the same disposition rule whenever modified. | Take-new or approved canonical restoration: exact shipped wrapper plus approved project-extension preservation. Keep or unresolved custom merge: exact retained/approved bytes, actual invoked definition recorded, incomplete PS agent layer. |
| `.claude/agents/docs-sync.md` | Same per-file user-modified workflow; preserve approved documentation rules through the existing extension mechanism. | Same comparison and separate disposition; reviewer’s choice does not decide docs-sync’s choice. | Same distinction between canonical completion and retained/custom incomplete installation. |
| `.ai/agents/*`, Codex wrappers, root AGENTS.md, settings, runtime and manifest | Inspect the explicit permitted inventory for collateral changes; no blanket assumption that BS touched or preserved them. | Same. | Unaffected bytes remain unchanged. Any observed change receives its existing ownership/disposition workflow; no unexplained collateral modification is accepted. |

Existing PS instructions already require the root-start rule and reviewed installation of the managed `claude` block, while retained old instructions remain an incomplete update. [docs-generation.md:38](project-setup/references/docs-generation.md:38)

Missing blocks are not silently recreated. Marker errors stop for repair; removed blocks or files require disposition. Keeping deficient CLAUDE.md is a held/incomplete result, not successful root recovery. [modes.md:79](project-setup/references/modes.md:79)

Before candidate PS, record:

- Per-file before/after hashes and overwrite/merge/unchanged classification, with evidence.
- Whether `@AGENTS.md`, the `claude` block, root-start rule and BS imports/version sentence exist.
- Actual `validate.mjs` results and `blocks.mjs drift` results.
- Actual installed agent definitions and manifest ownership.

If BS removed `@AGENTS.md` while sibling AGENTS.md exists, expect `claude-import` failure. Full-file differences produce `userModified: true` in block drift and validator drift warnings; removed managed blocks appear as `removed-by-user`. A merge may produce different results; record actual diagnostics rather than forcing overwrite expectations. [validate.mjs:364](project-setup/scripts/validate.mjs:364), [validate.mjs:390](project-setup/scripts/validate.mjs:390), [blocks.mjs:160](project-setup/scripts/blocks.mjs:160)

### Edge cases and failure modes

| Case | Required treatment |
|---|---|
| PS full documents precede BS’s 03 | Inventory and reconcile during PS update; do not require a new-service stamp. |
| BS overwrites or merges PS instructions/wrappers | Measure first, then apply the per-file recovery table. Retain the BS overwrite TODO. |
| Missing or malformed managed markers | Apply existing removed-content or marker-error rules; no silent repair. |
| Blank mapped section | Complete from permitted implementation evidence; identify unknowns explicitly. |
| Owner declines necessary completion | Retain originals, hold dependent conversions, report incomplete consolidation. |
| Existing document contradicts 03 | Show both locations and verify permitted code; obtain disposition. |
| Detail exceeds BS tables | Propose reviewed expansion under the matching section; apply Q7. |
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

BS itself requires implementation-backed completion and explicit statements when capabilities do not exist. [backend-standards/SKILL.md:294](backend-standards/SKILL.md:294)

### Source-binding rule — C2

> A pointer transaction MUST declare existing 03 in `transaction-inputs.json` when it is not drafted, because approval must bind the source used to resolve headings and content.
>
> Setup MUST also bind unchanged root CLAUDE.md when activation relies on its provenance, and unchanged root AGENTS.md when activation relies on the exact owner decision. Drafted targets already receive target-hash binding.

Existing prepare/commit rechecks inputs, targets, drafts and request metadata before writing. [state-and-apply.md:78](project-setup/references/state-and-apply.md:78)

Do not declare `.backend-standards.json`: it is outside the existing scope accepted for transaction inputs. Reconfirm its disposition immediately before prepare.

**Accepted limitation:** the stamp can change between that check and commit. This release adds neither atomic stamp binding nor a production-script change. [apply.mjs:542](project-setup/scripts/apply.mjs:542)

Supplied P6 evidence confirms the existing mechanism for 03: prepare succeeded; source mutation caused exit 4 / `APPLY_DRIFT` with no pointer write; restoration, reprepare and commit succeeded. This is not evidence of automatic drafting.

### Validation boundary

`reference-exists` examines instruction files and `.ai/agents/*.md`; it does not validate ordinary pointer destinations or headings. [validate.mjs:372](project-setup/scripts/validate.mjs:372)

Therefore:

- Preserve applicable navigation references to emitted pointers.
- Deleting a referenced pointer must still fail `reference-exists`.
- The test-only checker validates pointer paths, containment, headings and format.
- Drafting instructions MUST require destination inspection.
- The checker does not become shipped enforcement.
- Validator success alone does not prove mapping correctness or restored root-start semantics.

### Final report

Insert a conditional section inside the existing report fence, between “Decisions taken with the user” and “Validation”:

```markdown
### Documentation source mapping
- Layout: <BS-mapped / ordinary PS / pending>.
- Provenance: <signals and approved disposition>.
- Conversion: <complete / partial / held / not applicable>.
| PS path | Source headings | Outcome | Content disposition or remaining action |
- BS outcome by file: <overwrite / merge / unchanged / other, evidence>.
- CLAUDE.md recovery and per-wrapper dispositions.
- Agent definitions retained or replaced; incomplete instruction/agent updates.
- Pointer/source checks performed and their limits.
- Host routing measurements: <host, agent, version, result / not verified>.
- Source-size, BS re-sync and stamp-binding limitations.
```

Report ambiguity, held conversions, declined replacements, incomplete consolidation, missing pointers and unverified hosts. Preserve the exact existing validation/doctor block immediately before Capability report. [report.md:11](project-setup/references/report.md:11), [c10.test.mjs:2370](project-setup/tests/c10.test.mjs:2370)

### BS re-sync and source-size limitations

BS’s copy/re-sync procedure can erase consolidated 03 content. It can also replace PS instructions/wrappers again. PS 3.1 does not prevent either behavior. Release notes and remaining BS 4.0.0 TODO work MUST require reviewed preservation/merge on BS reapplication. [backend-standards/SKILL.md:190](backend-standards/SKILL.md:190), [TODO.md:61](TODO.md:61)

Record 03 UTF-8 bytes and line count before and after consolidation. Keep P5 as a live preload measurement; no safe host ceiling is established here. Never truncate facts to meet an assumed limit. Q7 retains the size/appendix decision.

## 6. Exact files touched

All paths are repository-relative. No additional repository files are proposed.

| File | Planned change |
|---|---|
| `project-setup/SKILL.md` | Set heading to 3.1.0; add Phase 0 mapping assessment and Phase 1 mapping requirement. Preserve existing security, approval, rendering and extension rules. |
| `project-setup/references/docs-generation.md` | Add D1–C2, mapping, exact owner-decision location, skeleton/path table, actor-specific gap duties, conditional root text, summary exception, consolidation, ownership and binding. |
| `project-setup/references/modes.md` | Add mapping for adopt/update and per-file PS-first recovery. Preserve current BS adoption rules. Replace only the stale scaffold observation. |
| `project-setup/references/report.md` | Insert conditional mapping report without disturbing validation/doctor ordering. |
| `project-setup/VERSION` | Exactly `3.1.0` plus one LF. |
| `project-setup/CHANGELOG.md` | Prepend 3.1.0 entry with changes, safeguards, measured scope and limitations; preserve history. |
| `project-setup/RELEASE-NOTES-3.1.0.md` | New notes covering compatibility, consolidation, recovery, rollback, verification, limitations and artifact provenance. |
| `project-setup/README.md` | Update current version/release command; explain mapping; list all three standalone gates and strict acceptance. |
| `README.md` | Update current version/install/layout claims and current notes/rollback links; retain historical references. |
| `project-setup/tests/helpers/v31-amendments.mjs` | Exact amendment/reversal layer, shape allowlist, historical/current separation and verified baseline reconstruction. |
| `project-setup/tests/fixtures/v31-prechange.json` | Capture affected baseline paths, hashes and exact permitted bytes at `fd7ae54`; no unrelated or secret material. |
| `project-setup/tests/helpers/c18-amendments.mjs` | Compose verified 3.1 reversal before existing historical views; extend dispatch without altering historical literals. |
| `project-setup/tests/c11b.test.mjs` | Explicit 3.1 current-install expectations; retain historical views, digests and `RC3_*` arrays. |
| `project-setup/tests/c17.test.mjs` | Explicit 3.1 current-update expectations at both consumers; accurate historical-view assertions. |
| `project-setup/tests/c18.test.mjs` | Test verified historical 3.0 view, enumeration and synthetic historical release. |
| `project-setup/tests/bs-doc-map.test.mjs` | Standalone contract, source-derived pointer/checker, recovery-outcome, mutation and transaction-path tests. |
| `project-setup/tests/release-3.1.test.mjs` | Actual-byte preservation, amendment-shape/integrity, unchanged-asset, install and synthetic 3.1 release tests. |
| `project-setup/tests/live/bs-doc-map.mjs` | Test-only initializer, explicit-inventory snapshots/checks and committed-change seed helper. No simulated drafting or user-level setup. |
| `project-setup/tests/live/BS-DOC-MAP-ACCEPTANCE.md` | User prerequisites, source/install switching, scenarios, exact prompts/ranges, checker expectations and dated evidence matrix. |
| `.ai/context/project-tree.md` | Current PS version, conditional mapping and acceptance entrypoints; retain historical observations. |
| `TODO.md` | Remove only the competing-homes subitem after acceptance. Preserve BS overwrite/integration work and reviewer residuals; add 03 preservation and unresolved size follow-ups as applicable. |

### Insertion constraints

Insert the mapping section after the existing ``## `TODO.md` (template `assets/templates/TODO.md`)`` content and immediately before `## Ownership hints`. Preserve the existing inventory and security/tooling paragraphs.

Do not append a heading after `### Environment template`: C9 requires it to remain the final heading. [docs-generation.md:153](project-setup/references/docs-generation.md:153), [c9.test.mjs:2157](project-setup/tests/c9.test.mjs:2157)

Add this Phase 1 sentence as an insertion:

> Before drafting overlapping documentation, setup MUST apply the source-of-truth mapping in `references/docs-generation.md`, including activation dispositions, existing-content consolidation and source binding, so generation cannot introduce a second factual owner.

Replace the stale modes observation with:

> A real Nest CLI 11 scaffold was exercised with BS followed by PS adopt on 2026-11-11. Prepare held CLAUDE.md and both standalone Claude agents for approval. That run did not exercise the agents, Codex, or PS followed by BS, and did not verify the 3.1 pointer workflow.

This remains a scoped historical observation. New live results belong in acceptance evidence and current release reporting. [TODO.md:67](TODO.md:67), [modes.md:74](project-setup/references/modes.md:74)

Root README changes cover current introduction, release guidance, update instructions, rollback links and layout tree. [README.md:48](README.md:48), [README.md:88](README.md:88), [README.md:218](README.md:218)

## 7. Versioning, digest preservation and release mechanics

PS uses `VERSION`; do not invent `templates/version.json`. The root stamp guard covers BS and toolchain-config. [.ai/context/project-tree.md:27](.ai/context/project-tree.md:27)

### Historical views

Do not repin historical hashes.

1. Capture the approved baseline.
2. Check each amendment’s allowed shape and exact identity.
3. Verify each amendment appears exactly once at its anchor.
4. Reverse only approved amendments.
5. Verify reconstructed bytes against the captured baseline.
6. Apply existing historical reversals.
7. Run unchanged historical assertions.
8. Independently check actual 3.1 bytes and behavior.

Never replace whole current files with fixture contents before verifying the approved delta.

Keep `AM18`, `AMENDED_FILES18`, `RR18_*`, historical version literals and `FINAL_VERSION18` historical. Add a separately named 3.1 current-version constant.

Current consumers requiring that new constant are:

- C11b installed-version assertion at line 2220.
- C17 `specOf` at line 2154.
- C17 manifest-version assertion at line 2379.

[c11b.test.mjs:2220](project-setup/tests/c11b.test.mjs:2220), [c17.test.mjs:2154](project-setup/tests/c17.test.mjs:2154), [c17.test.mjs:2379](project-setup/tests/c17.test.mjs:2379)

Extend `readRc4` dispatch to the union of existing and approved 3.1 paths. Reverse 3.1 first, then C18 where applicable. Unrelated files remain raw. Preserve the historical `AMENDED_FILES18` set. [c18-amendments.mjs:137](project-setup/tests/helpers/c18-amendments.mjs:137), [c18-amendments.mjs:194](project-setup/tests/helpers/c18-amendments.mjs:194)

### Actual-byte preservation gate — N3

Historical reconstruction alone cannot prove current obligations survived: C13, C14 and C17 use `readRc4`. [c13.test.mjs:77](project-setup/tests/c13.test.mjs:77), [c14.test.mjs:74](project-setup/tests/c14.test.mjs:74), [c17.test.mjs:90](project-setup/tests/c17.test.mjs:90)

`release-3.1.test.mjs` MUST independently inspect actual files and every 3.1 content-amendment record:

- Default: `old === ''`; the change is an insertion.
- Nonempty `old` is allowed only for an exact named record with fixed path, anchors and old/new text.
- No nonempty `old` may contain the words `MUST`, `SHOULD` or `MAY`, including their negative forms.
- No wildcard IDs, path-wide exceptions or unrestricted replacement records.
- Baseline hashes and expected identities remain independent of current amendment data.
- Actual inherited adoption, root-start, approval, security and ownership obligations remain present without contradictory new exceptions.

The narrow non-insertion allowlist is:

| Allowed record family | Permitted replacement |
|---|---|
| Version/heading records | Exact current version tokens, release tag/path tokens and heading strings in VERSION, SKILL, PS README and root project-tree. |
| Root README current claims | Exact current version, installation, notes, rollback and layout claims identified in §6. Historical claims remain. |
| Modes scaffold observation | Only the stale non-normative sentence at current line 74, replaced by the scoped observation in §6. |
| TODO closeout | Only the exact competing-document-homes subitem currently at lines 72–75, deleted after acceptance. |

The final exception is necessary to preserve the undisputed TODO closeout scope. Its exact baseline text contains no RFC 2119 obligation; it does not permit deleting the adjacent overwrite work. [TODO.md:64](TODO.md:64), [TODO.md:72](TODO.md:72)

All other documentation changes are insertions. New files are independently validated additions.

Mutation controls MUST reject:

- A non-allowlisted replacement.
- An allowlisted ID moved to another path or enlarged to cover another paragraph.
- Removal or weakening of a current obligation, including C14 BS adoption obligations.
- An amendment whose `old` contains a normative keyword.
- Missing, duplicated, moved or modified additions.
- Unrelated changes outside approved amendments.
- Deletion of the BS overwrite TODO alongside the allowed closeout.

The retained C14 adoption clauses are explicitly tested on actual 3.1 modes bytes, not solely reconstructed history. [c14.test.mjs:1703](project-setup/tests/c14.test.mjs:1703)

### Pin and direct-check inventory

| Existing check | Required treatment |
|---|---|
| C11b `skillWithOldHeading`, `readmeTopRest`, `readmeSections` | Reverse approved 3.1 amendments before historical comparison; preserve hashes. `c11b.test.mjs:2851`. |
| C12 README section and CHANGELOG suffix pins | Compose 3.1 reversal before existing views; preserve all values and C12 source. [c12.test.mjs:2136](project-setup/tests/c12.test.mjs:2136) |
| C13 docs-generation squash, modes, SKILL/README checks | Compose reversals; keep C13 source unchanged. `c13.test.mjs:990`, `:1004`. |
| C13 report pin | Route report through verified 3.1 reversal, preserving its hash. [c13.test.mjs:993](project-setup/tests/c13.test.mjs:993) |
| C14 pre-C14 SKILL/docs-generation/modes pins | Preserve values/source through composed views. `c14.test.mjs:976`. |
| C14 report pin | Same verified report reversal; preserve source/hash. [c14.test.mjs:962](project-setup/tests/c14.test.mjs:962) |
| C16 `PRE_C16` and `MODEL_SHA` | Reverse approved 3.1 changes before earlier views; preserve fixtures/model identities. `c16.test.mjs:165`, `:2033`. |
| C17 `C17_UNCHANGED_PINS` | Preserve historical docs-generation, modes and report hashes; other pinned assets/scripts/runners remain actually unchanged. `c17.test.mjs:412`. |
| C17 `I17_UNCHANGED_PINS` | Preserve independent docs-generation assertion. `c17.test.mjs:1051`. |
| C17 prechange/reversal assertions | Compose 3.1 before existing SKILL, README, CHANGELOG, VERSION and root-file comparisons. |
| C17 retained-identity loop | Account explicitly for every amended reference; `readBytes` delegates to `readRc4`. `c17.test.mjs:90`, `:2731`. |
| C8 forbidden doc-generation wording | Actual new text remains compatible; C8 source unchanged. `c8.test.mjs:1086`, `:1141`. |
| C9 configuration row/final heading | Preserve actual row and final Environment heading placement; C9 unchanged. `c9.test.mjs:2157`. |
| C10 raw-content assertions | Preserve operative SKILL/README/report text and exact validation/doctor → Capability ordering. C10 reads raw bytes and remains unchanged. [c10.test.mjs:100](project-setup/tests/c10.test.mjs:100), [c10.test.mjs:2328](project-setup/tests/c10.test.mjs:2328) |
| C17 pin of C10 source | Preserve exact C10 identity. [c17.test.mjs:431](project-setup/tests/c17.test.mjs:431) |
| C12 operative prose/security checks | Preserve security text/policy row; C12 unchanged. `c12.test.mjs:1995`, `:2055`. |
| C16 parses C11b `RC3_*` arrays | Keep arrays byte-identical. `c16.test.mjs:2147`. |
| C16/C17 inspect earlier test source | Preserve checked imports, reversal calls, literals and historical hashes in C11b and C13–C16. `c16.test.mjs:2304`, `c17.test.mjs:2744`. |
| C18 VERSION/changelog reads | Read explicitly verified historical 3.0 view; retain 3.0 expected values. `c18.test.mjs:65`, `:94`. |
| C18 `RC4_SHA`, tree hash, 69-file count | Preserve identities. Exclude only the exact additional 3.1 notes path after validating it. `c18.test.mjs:26`, `:68`. |
| C18 synthetic builder | Copy to disposable repository, reverse approved 3.1 changes, remove only verified 3.1 notes, then build historical 3.0 tree. `c18.test.mjs:113`. |
| C11b historical builder helper | Compose 3.1→3.0 before 3.0→rc.4; never convert the source checkout. `c18-amendments.mjs:208`. |
| Root README C18 amendments | Reverse exact 3.1 changes before `RR18_*`; preserve existing public-edition historical exceptions. `c18-amendments.mjs:94`, `c18.test.mjs:53`. |

Reverified raw hashes:

```text
references/docs-generation.md
cabdf9cd7df65ee9d7660abc4cf9b95eb0e3f9c1386ea069ec87d55322616503

references/modes.md
376435f0faaa768486607c5a6ee461f0795ea6b92cb0b5a0a4d615ae67917bd7

references/report.md
8d7d3fa6e834895a29d6df64c8768c9e85e35e6a8a68fc30bd4ca7d545056b64
```

Record old/new hashes, normalization conventions, amendment IDs and reasons. Keep raw, LF-normalized and whitespace-squashed conventions distinct.

Canonical assets, historical release notes, security baselines, existing historical fixtures and runner pins remain unchanged.

### Installer and release builder

No implementation changes are needed. Installed payload already includes the amended references and version files. [install.mjs:29](project-setup/install/install.mjs:29)

The builder reads tagged VERSION and matching notes. Preserve its encoding/LF and unresolved-provenance contract; resolved artifact IDs belong in acceptance evidence, not source notes. [release.mjs:339](project-setup/install/release.mjs:339)

After separately authorized creation of the real release tag:

```powershell
node project-setup/install/release.mjs --tag project-setup-v3.1.0 --out <release-output-dir>
```

The output directory must be unused. Tag creation, push and publication remain separate release actions.

## 8. Runnable acceptance criteria

The new test files/helper interface are implementation deliverables; they do not exist yet.

### Automated gates

Run serially:

```powershell
node project-setup/tests/bs-doc-map.test.mjs
node project-setup/tests/release-3.1.test.mjs
node project-setup/tests/c18.test.mjs
node project-setup/scripts/check-agent-baselines.mjs
node project-setup/tests/accept-rc1.mjs
npm run check
```

The new specs follow C18’s standalone convention: assertion output, totals, and nonzero exit on failure. Do not register them in existing runners. List all three standalone gates in PS README. [c18.test.mjs:2](project-setup/tests/c18.test.mjs:2)

Strict acceptance already runs the suite with `--keep`; do not immediately repeat it. The direct diagnostic command remains:

```powershell
node project-setup/tests/run-tests.mjs
```

Require **C8, C9, C10, C12, C13, C14, C15 and C16 to pass without source edits**. Preserve isolated-run and observed-overlap rules. [accept-rc1.mjs:7](project-setup/tests/accept-rc1.mjs:7), [docs-generation.md:112](project-setup/references/docs-generation.md:112)

### Standalone mapping spec

| Group | Required coverage and evidence boundary |
|---|---|
| Drafting contract | Actual D1–C2 clauses and every mapping row; deleted/weakened obligations fail. Proves instructions, not compliance. |
| Detection | Both provenance paths, no signal, 03 alone, missing source, malformed/conflicting signals, unreadable source, recorded decision and disappearing signal. Freeze Q1 expectations first. |
| Durable decision | Exact sentence outside root managed blocks; reject quoted/nested/wrong-file/duplicate/conflicting records; preserve through rerun; bind unchanged AGENTS.md. |
| Source-derived skeleton | Extract skeleton and relative-path table from actual drafting reference; no independent duplicate generator template. |
| Paths | All three depths; reject wrong depth, escaping paths, links and forbidden reads. |
| Headings | Real BS headings, both parenthetical headings and Schema changes; accept renumbering/whitespace; reject missing/renamed/ambiguous destinations. |
| Format | Routing obligations, resolved placeholders, navigation-only content and no managed blocks; mutate each property. |
| Read-only duty | In both skeleton and root paragraph, delete/weaken output reporting or `MUST NOT` write, or restore the unconditional TODO-write obligation: each mutation fails. |
| Coverage/blanks | Preservation and explicit-unknown requirements. Fixture assertions do not prove agents discovered every fact. |
| Existing content | Independently enumerated fact inventory against constructed consolidation drafts; omissions/conflicts fail. Semantic quality remains live review. |
| BS outcome/recovery | Construct overwrite, merge and mixed per-file states; check observed-state classification and each keep/take-new/merge expectation. These are checker controls, not BS live evidence. |
| Ownership | Merged pointers/03, no ownership claim for read-only source, reviewed full→merged transitions and user approvals. Existing mechanism on new paths. |
| Drift | Unchanged declared 03 mutation and drafted-source drift; exit 4/no pointer write. Include unchanged instruction-source binding. |
| Rollback | Restore source/originals/routing/ownership; preserve later edits and report incomplete recovery. |
| Validation | Deleted referenced pointer fails validator; bad heading in existing pointer demonstrates validator limitation and fails checker. |
| Root/local instructions | Preserve money/auth rule, summary exception, paired files and unrelated text; conditional routing only when activated. |
| Extensions | No invented routing extension; preserve approved extension bytes; declined replacement remains incomplete. |
| No-op | Identical outputs preserve document and manifest bytes. |
| Generic project | Ordinary full-document generation and unchanged canonical assets. |
| Reporting | Pending/partial/held outcomes have explicit slots; incomplete recovery/consolidation cannot report complete. |

Share pointer inspection logic between the standalone spec and live helper. Independently prove negative controls detect wrong paths, real-heading mismatches and missing clauses.

### Standalone release spec

Check actual 3.1 bytes:

- VERSION, headings and current public claims agree.
- Amendment shape and exact allowlist satisfy §7.
- Every amendment reverses exactly; unrelated changes fail.
- Actual inherited obligations survive, including C14 adoption rules.
- Historical reconstruction retains original checks and digest values.
- Canonical agents/wrappers/templates, scripts, installer and builder remain unchanged.
- Isolated installation into both destinations verifies 3.1.0.
- A synthetic tagged repository builds actual 3.1 payload and matching notes.
- Historical notes, security baselines and runner files remain unchanged.
- Only the exact validated new notes path is excluded from historical enumeration.
- Helpers cannot hide arbitrary changes through baseline substitution.

### Evaluation catalog disposition

Retain the prior G16 rejection: do not append an eval to `evals/evals.json`.

The existing BS adoption eval remains unchanged. C8, C9 and C12 assert exactly 39 entries; changing that catalog would expand test-source scope without measuring host behavior. [evals.json:31](project-setup/evals/evals.json:31), [c8.test.mjs:1248](project-setup/tests/c8.test.mjs:1248), [c9.test.mjs:2246](project-setup/tests/c9.test.mjs:2246), [c12.test.mjs:2324](project-setup/tests/c12.test.mjs:2324)

The live acceptance document supplies named cases, exact prompts/ranges, expected outcomes and dated results. Static coverage remains distinct from executed behavioral evidence.

### User prerequisite A: install and switch one active version

Installation is a separate user-level action. Neither the live helper nor the PS/BS agents perform it. PS already separates installation from project setup and requires confirmation of active copies from the running tool’s skill list. [SKILL.md:70](project-setup/SKILL.md:70), [SKILL.md:198](project-setup/SKILL.md:198)

Use these recorded sources:

- **3.0.0:** a user-prepared clean copy of the `fd7ae54` tree at `D:\ps-live\sources\fd7ae54\project-setup`, or a verified 3.0.0 release artifact with its actual path/digest recorded.
- **3.1 candidate:** the reviewed implementation tree at `<repo>/project-setup`, with candidate commit and payload identity recorded.

Use explicit target directories. For this user’s default installation:

```powershell
$psClaudeSkills = "$env:USERPROFILE\.claude\skills"
$psCodexSkills = "$env:USERPROFILE\.agents\skills"
$psBaseline = 'D:\ps-live\sources\fd7ae54\project-setup'
$psCandidate = '<repo>/project-setup'
```

These flags designate **parent skill directories**; the installer creates their `project-setup` child. [install.mjs:37](project-setup/install/install.mjs:37)

For each version, the user performs dry-run, installation and verification:

```powershell
node "$psBaseline\install\install.mjs" --targets claude,codex --claude-dir "$psClaudeSkills" --codex-dir "$psCodexSkills" --dry-run
node "$psBaseline\install\install.mjs" --targets claude,codex --claude-dir "$psClaudeSkills" --codex-dir "$psCodexSkills"
node "$psBaseline\install\install.mjs" verify --targets claude,codex --claude-dir "$psClaudeSkills" --codex-dir "$psCodexSkills"
```

After completing the required 3.0.0 fixtures, switch using the candidate source:

```powershell
node "$psCandidate\install\install.mjs" --targets claude,codex --claude-dir "$psClaudeSkills" --codex-dir "$psCodexSkills" --dry-run
node "$psCandidate\install\install.mjs" --targets claude,codex --claude-dir "$psClaudeSkills" --codex-dir "$psCodexSkills"
node "$psCandidate\install\install.mjs" verify --targets claude,codex --claude-dir "$psClaudeSkills" --codex-dir "$psCodexSkills"
```

Stop on installer refusal; do not automatically force replacement, retire another copy, or edit user configuration. The installer’s supported flags and refusal behavior remain unchanged. [install.mjs:5](project-setup/install/install.mjs:5)

Before **every** PS run:

1. The user resolves duplicate plain, synced or plugin-provided copies.
2. Start a new host session at the fixture root.
3. Confirm exactly one active PS copy, its selected path and version in the host skill list.
4. Record that evidence and installer verification.

`CLAUDE_CONFIG_DIR` does not isolate account-synced skills; `--continue` can retain the old list. A filesystem scan alone is insufficient. [claude.md:303](project-setup/references/claude.md:303), [claude.md:311](project-setup/references/claude.md:311)

If different target directories are used, record their explicit absolute paths and confirm the host actually discovers them. No assumed environment isolation substitutes for the one-active-copy check.

### User prerequisite B: exact Codex Git ownership grant

For every fixture under `D:\ps-live`, the user verifies the trusted Git root and adds its exact forward-slash path to global configuration effective for the sandbox Git process, or arranges an exact system entry.

Example, performed by the user:

```powershell
git config --global --add safe.directory 'D:/ps-live/bs-docmap-3.1.0-ps-first/service'
```

Repeat with each distinct fixture root. Never use `*`, a parent-directory wildcard or an injected-configuration bypass. An exact entry beside an existing wildcard does not narrow that wildcard.

The helper and agents MUST NOT write global/system Git configuration or supply their own trust grant. On `GIT_SAFE_OWNERSHIP`, stop the attempt and record a setup failure. After user resolution, begin a new attempt. An ambiguous `GIT_SAFE_REPOSITORY` also requires diagnosis; it is not evidence that routing failed. [SKILL.md:90](project-setup/SKILL.md:90)

After PS installs the bounded reader, the Codex prerequisite check is:

```powershell
node .ai/tools/git-safe.mjs head
```

Run from the fixture root. Record an ungranted attempt only where no effective grant already exists; do not remove user trust configuration to manufacture a failure. Then record the new attempt following the user’s exact grant. The historical rc.3 failure and subsequent exact-grant success are documented observations, not proof of the current host. [claude.md:274](project-setup/references/claude.md:274)

### Live workspace and helper contract

Use unused directories outside the repository and `%TEMP%`:

```powershell
node project-setup/tests/live/bs-doc-map.mjs init --scenario ps-first --out D:\ps-live\bs-docmap-3.1.0-ps-first
```

`init` MUST refuse existing destinations and linked aliases and resolve containment before creation.

For `ps-first` and `bs-existing`, create a real scaffold with:

```text
npx --yes @nestjs/cli@11 new service --package-manager npm --skip-git
```

Record actual CLI, Node and installed framework versions. Supplied P1 observed CLI 11.0.24, Node v24.14.1 and `@nestjs/common` 11.2.9, with no prompts or `.gitignore`. Each acceptance run records its own resolutions.

Arrange a fixture Git repository and safe ignore setup before commits where BS’s new-service initialization is not used.

For `bs-new`, create only an unused parent and scenario metadata. The unchanged BS agent performs its new-service scaffold step and creates `service`; do not pre-create a second scaffold.

Snapshots/checks MUST:

- Use explicit permitted inventories.
- Never read `.env*`, secrets or policy-denied paths.
- Reject unsafe links/junction traversal.
- Avoid serializing secret contents or indiscriminate staging.
- Avoid all user-level installation/configuration actions.
- Never repair BS outcomes to make a scenario pass.

### Required installation scenarios

| Scenario | Procedure and expected outcome |
|---|---|
| Primary: PS 3.0.0 → BS existing-project → PS 3.1 update | Scaffold; install/confirm 3.0.0; run PS to create substantive full docs; establish independent fact inventory and pre-BS snapshot; run unchanged BS explicitly via existing-project procedure; record its actual per-file outcome and unstamped state; switch/confirm candidate; run PS update with reviewed recovery and consolidation. Exercise a contradictory fact. |
| BS existing-project → PS adopt | Scaffold; run unchanged BS existing-project procedure; record unstamped provenance; install/confirm candidate and adopt. Automatic activation depends on Q1; otherwise use explicit owner disposition. |
| BS new-service → PS adopt | Empty parent; unchanged BS performs its complete new-service procedure, including scaffold and stamp; candidate PS adopts. |
| Declined BS agent replacement | Separate BS-existing fixture; decline docs-sync replacement; preserve its bytes, identify invoked definition and report incomplete PS agent layer. |

For PS-first, snapshot both before and after BS:

```powershell
node project-setup/tests/live/bs-doc-map.mjs snapshot --project D:\ps-live\bs-docmap-3.1.0-ps-first\service --out D:\ps-live\bs-docmap-3.1.0-ps-first\before-bs.json

node project-setup/tests/live/bs-doc-map.mjs snapshot --project D:\ps-live\bs-docmap-3.1.0-ps-first\service --out D:\ps-live\bs-docmap-3.1.0-ps-first\before-ps31.json
```

Between BS and candidate recovery, record `validate.mjs --json` and:

```powershell
node <SKILL_DIR>/scripts/blocks.mjs drift --file CLAUDE.md
node <SKILL_DIR>/scripts/blocks.mjs drift --file .claude/agents/reviewer.md
node <SKILL_DIR>/scripts/blocks.mjs drift --file .claude/agents/docs-sync.md
```

`<SKILL_DIR>` is the explicitly recorded installed version used for that measurement. The CLI supports these read-only drift operations. [blocks.mjs:10](project-setup/scripts/blocks.mjs:10)

After ordinary PS approval and apply:

```powershell
node project-setup/tests/live/bs-doc-map.mjs verify --project D:\ps-live\bs-docmap-3.1.0-ps-first\service --baseline D:\ps-live\bs-docmap-3.1.0-ps-first\before-ps31.json
```

The helper’s scenario evidence records the reviewed per-file dispositions and expected completion status. Default verification requires complete conversion/recovery. An explicit partial-case expectation may verify a declined-replacement scenario, but its output MUST say **expected partial outcome**, never complete PS compatibility.

The checker verifies:

- Pointers, paths, headings, ownership, routing and expected full documents.
- Independent content inventory and approved conflict dispositions.
- CLAUDE.md import, managed block/root-start text, BS imports/version and user content.
- Separate reviewer/docs-sync keep/take-new/merge results.
- Canonical wrapper identity where replacement was approved.
- Exact retained bytes and incomplete status where replacement was declined.
- Approved extension preservation, applicable validator results and unexplained collateral changes.

For an observed merge, verify preservation and any necessary reviewed correction. For an observed overwrite, verify restoration through the reviewed transaction. A single live result proves only its observed branch; constructed fixtures cover the checker’s other branch.

Copying templates does not count as running BS or PS.

### Exact live prompts

The acceptance document instantiates these with actual paths, installed versions and printed ranges:

- **PS 3.0.0 baseline:** “Run the installed project-setup 3.0.0 on this fixture through its normal approval workflow. Generate evidence-backed project documentation.”
- **BS existing-project:** “Apply the installed, unchanged backend-standards skill using its ‘Applying this to an EXISTING project’ procedure. Treat this as an existing service and follow its normal review requirements.”
- **Candidate update:** “Run the installed project-setup 3.1.0 candidate in detected update mode. Assess documentation mapping, show per-file drift and recovery dispositions, and consolidate approved facts through the normal reviewed transaction.”
- **Candidate adoption:** “Run the installed project-setup 3.1.0 candidate in detected adopt mode. Assess the BS documentation layout and show provenance and replacement dispositions before applying.”
- **Docs-sync:** “Run `<actual agent name>` for `<printed range>`. Update affected documentation under the installed project instructions. Report files changed and unresolved gaps.”
- **Reviewer:** “Run `<actual agent name>` on `<printed range>`. Follow installed project instructions and report findings with severity and file:line. Do not modify files.”

Do not instruct BS to preserve or overwrite specific PS files solely to force the desired observation.

### Committed changes for agent measurements

Add fixture-only seed support:

```powershell
node project-setup/tests/live/bs-doc-map.mjs seed --project D:\ps-live\bs-docmap-3.1.0-ps-first\service --case docs-sync
```

The helper MUST:

- Require recognized disposable fixtures and contained target paths.
- Establish a committed post-setup baseline.
- Modify only named application fixture files.
- Preserve installed instructions, agents and policy.
- Commit with fixture-local identity and an explicit permitted staging list.
- Print exact base/head IDs and the agent range.
- Use installed bounded readers for history/diff inspection where required.
- Refuse ambiguous or unrelated dirty state.

The docs-sync seed creates a landed error-contract and configuration-consumer change without pre-updating 03. Canonical docs-sync requires an explicit range. [docs-sync.md:14](project-setup/assets/agents/docs-sync.md:14)

A separate `--case reviewer` fixture commits a concrete money/locking defect. Baseline 03 contains a project-specific lock-order/transaction invariant whose detailed rule exists only there; generic root safeguards remain intact. Record whether the reviewer follows the pointer, cites 03 and explains the defect.

Use independent fixtures for each host/agent case. Do not measure the second host against documentation already corrected by the first.

### Agent/human acceptance matrix

Require dated evidence for:

- Claude canonical docs-sync and Codex canonical `docs_sync`: explicit range, factual edits in 03, navigation-only pointers.
- Claude and Codex reviewer: seeded money defect, source access, 03 citation, finding and severity.
- Read-only missing-destination case: output reports the gap and no file changes occur.
- Documentation-writing missing-destination case: authorized TODO entry and no unsupported factual update.
- Retained BS Claude docs-sync: exact definition, observed routing and incomplete PS status.
- Blank section, renamed heading, deleted pointer and local-instruction conflict.
- Unchanged rerun with zero document/manifest diff.
- Preservation of factual accuracy and invariants against permitted code.
- Unchanged agent, wrapper and approved-extension bytes during docs-sync.

Routing success does not close existing reviewer severity or launch residuals. Preserve those TODO entries. [TODO.md:25](TODO.md:25)

### Probe and claim ledger

| Probe | Existing evidence | Remaining acceptance |
|---|---|---|
| P1 Nest CLI | Supplied version/scaffold observation. | Record each actual run’s versions/outcome. |
| P2 BS stamp/path | Source confirms different procedures and PS-first option. | Record procedure selected and actual stamp/provenance state. |
| P3 Claude context | Not run here. | Root-start reviewer/docs-sync; record reported loaded instructions/imports, labeling self-report. |
| P4 Codex context | Not run here. | Outside-`%TEMP%` fixture, codex-cli 0.163.0 or later; actual version, routing and permitted 03 access. |
| P5 Claude preload size | Not run here. | Consolidated bytes/lines and `/memory` or `/context` observations where available; no universal ceiling claim. |
| P6 declared source | Supplied prepare/drift/commit evidence. | Automated regression on pointer paths. |
| P7 PS-first state after BS | Not run; overwrite is documented unfinished integration work. | Observe each file before recovery; record validate/drift diagnostics and whichever overwrite/merge/mixed outcome occurs. |
| P8 Codex ownership | Historical exact-grant success recorded. | Current ungranted attempt where applicable, user grant and new successful attempt; ownership failure remains setup failure. |

Record host/tool/version/date, original launch directory, selected skill copy, actual agent definition, source size, range, result and unverified scope.

No correctness rule depends on P3–P5 succeeding. Each pointer carries its own routing. Missing measurements limit compatibility claims; static assertions cannot substitute for them.

## 9. Rollback

There is no database migration.

Retain target-project journals and backups until acceptance. Roll back the reviewed PS transaction as one unit, including source consolidation, pointers, root instructions, approved wrapper recovery, extension/ownership changes and manifest changes:

```text
node <SKILL_DIR>/scripts/apply.mjs rollback --run-id <id>
```

Rollback restores only that run’s writes and skips intervening edits, reporting incomplete recovery. Follow the lifecycle rules; a run with a journal cannot simply be reprepared. [state-and-apply.md:139](project-setup/references/state-and-apply.md:139)

For PS-first, rolling back candidate PS returns to the **post-BS** state captured before that transaction. It does not undo BS’s earlier changes. Restoring the pre-BS state requires separately reviewed project history/backups.

Installed-skill rollback is a user-performed action using explicit target directories:

```powershell
node "$psCandidate\install\install.mjs" rollback --targets claude,codex --claude-dir "$psClaudeSkills" --codex-dir "$psCodexSkills"
```

Verify the restored source/version and confirm one active copy in a new session. Installer rollback restores the skill copy, not consolidated project documentation. [install.mjs:12](project-setup/install/install.mjs:12)

Do not automatically rerun PS 3.0.0 after consolidation; its drafting rules may restore competing full documents. Restore the project transaction first or perform a reviewed migration.

Later BS overwrites remain outside PS’s transaction guarantee. Preserve project history/backups and review restoration before accepting re-sync.

## 10. Maintainer decisions required before freeze

These remain open; recommendations do not constitute approval.

| ID | Question | Recommended answer |
|---|---|---|
| Q1 | Accept the second automatic provenance signal, or require owner disposition for unstamped BS existing-project installations? | Accept the concrete BS CLAUDE version sentence plus matching 03 import when the stamp is absent. Hold malformed/conflicting signals. Use the exact root AGENTS.md decision for owner-selected layouts. |
| Q2 | May PS expand target-project 03 to preserve richer information requirements? | Yes, through reviewed merged edits; BS payloads remain unchanged. |
| Q3 | Retain originals when consolidation is declined or destinations remain unresolved? | Yes. Hold dependent conversions and report incomplete work; never discard facts or silently create another full copy. |
| Q4 | Must reviewer and docs-sync routing be demonstrated in both hosts before claiming full compatibility? | Yes. Missing/failed lanes require narrower claims and retained reviewer residuals. |
| Q5 | Preserve historical digest values through exact amendments? | Yes. Enforce verified reconstruction plus actual-byte insertion/replacement controls and independent 3.1 tests. |
| Q6 | How should 3.1 describe later BS re-sync overwriting consolidated 03 or PS instructions/wrappers? | Explicit compatibility limitation requiring reviewed preservation/merge. Retain durable prevention in BS 4.0.0 work. Record live behavior without modifying BS or testing around it. |
| Q7 | What size budget should 03 have, and may overflow use a non-pointer appendix? | Measure realistic size/P5 first. Use a review threshold, not an invented safe host ceiling. Prefer concise complete facts in 03 for 3.1; no automatic split. Any appendix requires a frozen ownership/navigation contract before implementation. |
| Q8 | Allow mapping when replacement of standalone BS docs-sync is declined? | Yes, through reviewed mapping, while preserving the retained agent and reporting incomplete PS agent installation. Measure it separately; do not claim canonical PS compatibility. |

After these dispositions are recorded, freeze the implementation plan and exact amendments. Acceptance must preserve the distinction between instruction checks, checker controls, existing transaction mechanisms and measured host behavior.

## 11. Maintainer decisions (advisor-delegated, 2026-11-11)

The maintainer was unavailable overnight and delegated the open decisions to an advisor (a Claude
Fable 5.2 subagent at medium effort) acting for the orchestrator. These dispositions are the
**advisor's**, not the maintainer's own; the maintainer may overturn any of them before the PR
merges, and any change goes through the maintainer, not through an edit of this frozen plan.

| ID  | Disposition | Reason |
| --- | ----------- | ------ |
| Q1  | Accept the recommended second signal (BS `CLAUDE.md` version sentence plus a matching 03 import). | The existing-project BS procedure writes no stamp, so a stamp-only rule would prompt on a primary path. Conflicting or malformed signals hold, 03 alone never activates, and Phase 0 shows the signals before any write. |
| Q2  | Yes, PS may expand the target 03, through reviewed merged edits only. | Losing PS's richer facts would make the pointers a regression; edits stay under the existing user-content approval and BS payloads are unchanged. |
| Q3  | Yes, keep the originals and report incomplete conversion when consolidation is declined. | Never discarding facts is the cheap protection; a silent second full copy is the duplication this change removes. |
| Q4  | Yes, both-host reviewer/docs-sync routing before a full claim, else a narrower claim. | A verification claim states its scope; the recorded Codex reviewer residual shows the hosts diverge. |
| Q5  | Yes, exact amendment reversal, an actual-byte gate, and independent 3.1 tests. | The digest pins are the 3.0.0 release evidence; the gate keeps old tests passing unmodified. |
| Q6  | Yes, state BS re-sync overwrite as a compatibility limitation; the durable fix stays BS 4.0.0 work. | BS is out of scope by the maintainer's choice; record the live behaviour, do not test around it. |
| Q7  | Accept: measure first, use a review threshold, keep concise facts in 03, no automatic split. | An invented ceiling is an unverified claim; an appendix needs its own ownership contract. |
| Q8  | Yes, allow the mapping when the BS docs-sync replacement is declined; report the incomplete PS agent install and measure it separately. | The doc mapping does not depend on which docs-sync agent is installed; no canonical-compatibility claim for that scenario. |

## 12. Freeze amendments (critique pass 3, non-blocking P1–P4)

These amend the plan above. Where they conflict with an earlier section, this section wins.

- **P1 — README replacements.** The amendment set gains two exact named replacement records for
  `project-setup/README.md`: (a) the opening "Release 3.0.0" sentence that cites
  `RELEASE-NOTES-3.0.0.md` and the rc.4 host measurements is replaced by a 3.1.0 sentence citing
  `RELEASE-NOTES-3.1.0.md`; (b) the acceptance sentence that names only `node tests/c18.test.mjs` is
  replaced by one naming the three gates (`bs-doc-map.test.mjs`, `release-3.1.test.mjs`,
  `c18.test.mjs`). Both records keep the existing check that no RFC 2119 keyword is removed.
- **P2 — two stages.** Stage 1 (the implementation commit) carries no TODO closeout, and the 3.1.0
  release notes state the live acceptance as **pending evidence**. Stage 2 (a follow-up commit after
  the maintainer's live acceptance) adds the TODO closeout and the measured results. Each stage has
  its own exact amendment set and its own gate run; `release-3.1.test.mjs` asserts stage 1 now and
  is extended in stage 2.
- **P3 — no personal paths.** Every user path is `$env:USERPROFILE\.claude\skills` or
  `$env:USERPROFILE\.agents\skills` (the installer defaults), in this plan and in the committed
  acceptance document. Already applied to the text above.
- **P4 — restore the installed copy.** Before the first acceptance install, the maintainer records
  the installed PS version and a SHA-256 digest of each installed `SKILL.md`, and keeps a separate
  copy of the pre-acceptance install outside the installer's backup slot (installer rollback
  restores only the newest backup). After acceptance the maintainer verifies the final installed
  version, candidate or restored original. These are maintainer-performed steps; the helper never
  installs, switches or restores a skill copy.
