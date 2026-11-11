// Exact 3.1.0 amendment literals and the verified reversal to the 3.0.0 bytes (test-only; never part of the installer payload).
//
// Plan: docs/plans/2026-11-11-project-setup-v3.1-bs-doc-map.md, section 7 (section 12 amends it; stage 1, P2). The 3.1.0 source is the
// 3.0.0 source (commit fd7ae54) plus the records below: insertions by default, and only these exact named replacements:
//   SK31_*  SKILL.md heading line (allowlisted line 6)          VR31_*  VERSION
//   RM31_*  PS README title, opening release sentence (P1 a), acceptance sentence (P1 b) and the two release tag lines
//   MD31_*  the stale modes.md scaffold observation (line 74), replaced by the scoped observation of plan section 6
//   RR31_*  root README current version, install, notes, rollback and layout claims
//   PT31_*  root project-tree current version claims
// Every other record has an empty old (an insertion). No old holds MUST, SHOULD or MAY. Stage 1 carries no TODO.md record; the
// competing-document-homes closeout is stage 2. tests/release-3.1.test.mjs judges all of this with its own engine and pins; this
// module is never asked to decide pass or fail there.
//
// A record is { file, before, old, neu, after } exactly as in c17/c18-amendments.mjs: before + old + after is the 3.0.0 slice and
// before + neu + after the 3.1.0 slice. Root files are keyed "@root/<path>"; every other key is relative to project-setup/.
// The literals were generated once from a line diff of the base commit against the reviewed 3.1.0 files, then checked: forward
// application of every record to the baseline gives the actual file, and the reverse chain gives the baseline back.
// Importing it reads no file and starts no process; only read30 and to30Tree read, and only when called.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const CURRENT_VERSION31 = '3.1.0';

export const AM31 = Object.freeze({
  // SKILL.md
  SK31_1: Object.freeze({
    file: "SKILL.md",
    before: "",
    old: "# project-setup 3.0.0\n",
    neu: "# project-setup 3.1.0\n",
    after: "",
  }),
  SK31_2: Object.freeze({
    file: "SKILL.md",
    before: "",
    old: "",
    neu: "\n   Phase 0 mapping assessment: on a project that may be a backend-standards (BS) project, show the documentation\n   mapping signals (stamp, provenance sentence and import, recorded owner decision), the selected policy, the\n   detected mode and every unresolved disposition, then stop for approval. The signals and dispositions are defined\n   in `references/docs-generation.md` (\"Documentation source of truth on backend-standards projects\"); the mapping\n   never changes the detected mode.\n",
    after: "7. Permission decisions. Read `claude.allows.rules`, `managed`, `omitted` and `results`. The managed inventory comes\n",
  }),
  SK31_3: Object.freeze({
    file: "SKILL.md",
    before: "",
    old: "",
    neu: "\n   Before drafting overlapping documentation, setup MUST apply the source-of-truth mapping in\n   `references/docs-generation.md`, including activation dispositions, existing-content consolidation and source\n   binding, so generation cannot introduce a second factual owner.\n",
    after: "3. Security policy and tooling. With no installed policy (`.ai/security-paths.json` absent), copy\n",
  }),

  // VERSION
  VR31_1: Object.freeze({
    file: "VERSION",
    before: "",
    old: "3.0.0\n",
    neu: "3.1.0\n",
    after: "",
  }),

  // README.md
  RM31_1: Object.freeze({
    file: "README.md",
    before: "",
    old: "# project-setup 3.0.0 - skill source\n",
    neu: "# project-setup 3.1.0 - skill source\n",
    after: "",
  }),
  RM31_2: Object.freeze({
    file: "README.md",
    before: "",
    old: "**Release 3.0.0.** See RELEASE-NOTES-3.0.0.md for compatibility, acceptance requirements,\nthe rc.4 host measurement results and the remaining limitations.\n",
    neu: "**Release 3.1.0.** See RELEASE-NOTES-3.1.0.md for compatibility, the backend-standards\ndocumentation mapping, acceptance requirements, pending live evidence and the remaining limitations.\n",
    after: "",
  }),
  RM31_3: Object.freeze({
    file: "README.md",
    before: "",
    old: "",
    neu: "## Backend-standards documentation mapping (3.1.0)\n\nOn a project with backend-standards provenance (a valid `.backend-standards.json` stamp, or the BS\nCLAUDE.md version sentence with its matching 03 import, or the exact owner decision in root\nAGENTS.md), `.ai/standards/03-project-architecture.md` owns the architecture facts. Setup turns the\noverlapping project-setup documents into self-sufficient pointers to named 03 sections and\nconsolidates their facts into 03 through one reviewed transaction. The rules are in\n`references/docs-generation.md` (\"Documentation source of truth on backend-standards projects\");\nrecovery after BS ran on a project-setup project is in `references/modes.md`.\n\nBackend-standards and the shipped canonical agents, wrappers and templates are unchanged. The\nstatic gates check the instructions and a test-only checker; whether a Claude or Codex agent\nfollows a pointer is measured live with `tests/live/BS-DOC-MAP-ACCEPTANCE.md` and the helper\n`tests/live/bs-doc-map.mjs`. That live acceptance is pending evidence for 3.1.0.\n\n",
    after: "## Test first (no installation, no real config touched)\n",
  }),
  RM31_4: Object.freeze({
    file: "README.md",
    before: "",
    old: "Release acceptance requires the complete strict gate below and, separately, node tests/c18.test.mjs\n(the standalone 3.0.0 final-release assertions; neither run-tests.mjs nor accept-rc1.mjs runs it).\n",
    neu: "Release acceptance requires the complete strict gate below and, separately, the three standalone\ngates node tests/bs-doc-map.test.mjs, node tests/release-3.1.test.mjs and node tests/c18.test.mjs\n(the 3.1.0 mapping contract, the 3.1.0 release assertions and the historical 3.0.0 assertions;\nneither run-tests.mjs nor accept-rc1.mjs runs them). Run them serially.\n",
    after: "",
  }),
  RM31_5: Object.freeze({
    file: "README.md",
    before: "",
    old: "requires or creates project-setup-v3.0.0 in the distribution repository.\n",
    neu: "requires or creates project-setup-v3.1.0 in the distribution repository.\n",
    after: "",
  }),
  RM31_6: Object.freeze({
    file: "README.md",
    before: "",
    old: "node install/release.mjs --tag project-setup-v3.0.0 --out <unused-directory>\n",
    neu: "node install/release.mjs --tag project-setup-v3.1.0 --out <unused-directory>\n",
    after: "",
  }),

  // CHANGELOG.md
  CL31_1: Object.freeze({
    file: "CHANGELOG.md",
    before: "",
    old: "",
    neu: "## 3.1.0\n\nOn a backend-standards project, `.ai/standards/03-project-architecture.md` (03) becomes the\ndocumentation source of truth. Project-setup detects the layout separately from the setup mode\n(a valid stamp, or the BS CLAUDE.md version sentence with its matching 03 import, or an exact\nowner decision recorded in root AGENTS.md) and turns nine overlapping documents into\nself-sufficient pointers to named 03 sections. Backend-standards itself is unchanged.\n\nSafeguards: substantive content is inventoried and consolidated into 03 through one reviewed\ntransaction before any original is replaced; declined consolidation keeps the originals and is\nreported incomplete. Malformed or conflicting signals hold activation. Pointers and changed 03\nrequest merged ownership, and an undrafted 03 and the instruction files activation relies on are\ndeclared as transaction inputs. A project where BS ran after project-setup is measured first and\nthen recovered per file (CLAUDE.md, reviewer wrapper, docs-sync wrapper). Read-only agents report\na missing destination in their output and write nothing.\n\nCanonical agents, wrappers, templates, scripts, installer and release builder are unchanged.\nStatic checks: tests/bs-doc-map.test.mjs and tests/release-3.1.test.mjs. Live acceptance in both\nhosts is pending evidence (tests/live/BS-DOC-MAP-ACCEPTANCE.md).\n\nLimitations: a later BS re-sync can overwrite consolidated 03 content and PS instructions or\nwrappers; the stamp is reconfirmed before prepare but not bound atomically; no safe 03 size\nceiling is established.\n\nSee RELEASE-NOTES-3.1.0.md.\n\n",
    after: "## 3.0.0\n",
  }),

  // references/docs-generation.md
  DG31_1: Object.freeze({
    file: "references/docs-generation.md",
    before: "",
    old: "",
    neu: "## Documentation source of truth on backend-standards projects\n\nOn a project where backend-standards (BS) provenance is established, `.ai/standards/03-project-architecture.md` (03) owns the architectural facts. Project-setup writes navigation pointers for the overlapping documents instead of a second full description, because two detailed descriptions of one fact drift apart.\n\nThis mapping is a documentation policy layered over the detected mode. Mode selection in `references/modes.md` stays authoritative: a valid manifest selects `update`, invalid metadata selects `invalid`, existing configuration without reliable provenance uses conservative adoption, and BS naming or markers do not establish v1 provenance. The no-source rules above stay authoritative too: setup never generates context documents merely to populate this mapping.\n\n### Detection and activation\n\nBS writes provenance in two ways. Its new-service procedure writes a root `.backend-standards.json` stamp:\n\n```json\n{\n  \"version\": \"<templates version>\",\n  \"appliedBy\": \"backend-standards\"\n}\n```\n\nIts existing-project procedure writes no stamp. It optionally recommends running project-setup first, then delivers 03, known deviations, CLAUDE.md and two Claude agents. The BS CLAUDE.md template carries the 03 import and a provenance sentence:\n\n```text\n@.ai/standards/03-project-architecture.md\n\nApplied from the `backend-standards` skill, version `<version>`.\n```\n\nOn these signals, automatic activation requires a readable, permitted 03 and either:\n\n1. A valid root stamp object with `appliedBy: \"backend-standards\"` and a valid semantic-version string; or\n2. With no stamp, one unambiguous BS CLAUDE provenance sentence containing a concrete semantic version, together with the import of this same 03.\n\nThe second signal is accepted (maintainer decision Q1, 2026-11-11), because the existing-project BS procedure writes no stamp and a stamp-only rule would prompt on a primary path. An explicitly approved owner decision, recorded as described below, may independently select the layout.\n\n> Setup MUST distinguish absent signals from denied, unsafe, malformed or unreadable signals, because a failed read does not establish absence.\n>\n> Setup MUST inspect provenance only within the existing permitted-read boundary. Layout signals grant no additional read, write or ownership permissions.\n>\n> Setup MUST NOT infer BS provenance from the architecture filename alone.\n\nDo not require exactly BS 3.1.0. Resolve the installed document's headings and coverage.\n\n| Signals | Treatment |\n|---|---|\n| Readable 03 and valid stamp; other signals agree or are absent | Activate mapping. |\n| Readable 03, absent stamp, valid BS CLAUDE sentence and matching import | Activate mapping; show the sentence and the import in Phase 0. |\n| Readable 03 and the exact approved owner-decision sentence | Honor the decision unless current evidence conflicts. |\n| Recognized BS provenance but 03 absent | Hold affected generation and report incomplete BS documentation. |\n| 03 alone | Show ambiguity and request a concrete disposition. Do not generate competing full documents while pending. |\n| Malformed stamp, conflicting `appliedBy`, contradictory versions, conflicting provenance sentences or inconsistent imports | Hold activation. Another signal cannot silently override the conflict. |\n| No accepted signal | Existing PS documentation rules. |\n| Owner confirms an unrelated 03 | Existing PS rules; no automatic conversion or ownership claim over 03. |\n| Installed pointers but a signal disappears | Preserve pointers and report inconsistency. Never automatically expand them into full documents. |\n\n### Durable owner decision\n\nThe fixed location is **root `AGENTS.md`, outside every managed block**. The exact affirmative sentence is:\n\n```text\nDocumentation layout decision: use .ai/standards/03-project-architecture.md as the source of truth for project-setup mapped documentation.\n```\n\n> Setup MUST search for this exact standalone sentence in root AGENTS.md outside managed blocks, because a decision in an unspecified location cannot reliably guide later runs.\n>\n> Setup MUST propose and record this sentence only after explicit owner approval through the reviewed instruction-file workflow. Its absence, approximate wording, quotation inside an example, or presence in another file MUST NOT count as this decision.\n>\n> Setup MUST hold conflicting or duplicated decision records for explicit disposition rather than choosing one silently.\n>\n> Setup MUST show the signals, selected policy, detected mode and unresolved dispositions in Phase 0, because otherwise adoption can create duplicate factual owners.\n>\n> Setup MUST NOT repair or manufacture the BS stamp.\n\nThe sentence records an owner-selected layout; it does not prove that BS ran. A non-BS project may opt in through the same reviewed decision.\n\nPreserving this sentence outside blocks follows the existing preservation requirement for user text (see \"Root AGENTS.md\" and the root-start rule above). Bind unchanged root AGENTS.md as an input when activation relies on it (see \"Source binding\" below).\n\n### Document mapping\n\nThe existing PS document inventory above remains intact. Heading text, not section numbers, determines destinations; the numbers below describe the current BS template.\n\n| PS document | Destination or disposition |\n|---|---|\n| `.ai/context/project-tree.md` | **Module layout** (§4); dangerous-module references also link to **Landmines** (§15). |\n| `.ai/context/critical-modules.md` | **Module layout** (§4), **Authentication and authorization** (§6), **Database** (§7), including **Money (`01` §6)**, **Cache, locks and queues** (§8), **Outbound integrations** (§9), **Observability** (§10), including **Retention (`02` §3)**, and **Landmines** (§15). Preserve invariants, ownership boundaries, transactions, locking, idempotency and PII facts. |\n| `.ai/context/code-patterns.md` | Generate in full. Preserve implementation examples and conventions; reference architectural facts in 03. |\n| `.ai/context/error-contract.md` | **API surface** (§5), including error contracts and final response-writing paths. |\n| `.ai/context/configuration.md` | **Configuration** (§3). Preserve variable name, requiredness, classification, consumer, description and source coverage. Never values. |\n| `.ai/context/glossary.md` | **Domain glossary** (§14). |\n| `.ai/context/development-rules.md` | Generate in full. Preserve testing, compatibility, scope and test-run hygiene requirements; reference tooling and local-development facts in 03. |\n| `docs/api-conventions.md` | **API surface** (§5) and **Authentication and authorization** (§6), including evidenced rate-limit conventions. |\n| `docs/database.md` | **Database** (§7), including **Schema changes** and **Money (`01` §6)**; **Module layout** (§4) for entity locations and naming conventions. |\n| `docs/observability.md` | **Observability** (§10) and **Health, shutdown, deployment** (§11), retaining health-check coverage. |\n| `docs/integrations/<vendor>.md` | **Outbound integrations** (§9), scoped to the vendor; **Observability** (§10) for shared logging/redaction behavior. |\n| `docs/business-rules/<flow>.md` | Generate in full only with sufficient domain evidence. Reference shared contracts in 03. |\n| `.ai/decisions/README.md` | Generate in full as the ADR index. |\n| `.ai/decisions/<adr>.md` | Generate in full, retaining the evidence requirement. |\n| `TODO.md` | Generate in full for uncertainty, conflicts and unverified controls. |\n| Root `AGENTS.md` | Generate instructions with critical rules, navigation and conditional routing. |\n| Root `CLAUDE.md` | Generate or merge instructions, preserving BS imports and version information and installing the PS import and managed block through review. |\n| Directory-specific `AGENTS.md` / `CLAUDE.md` pairs | Preserve local instructions and paired files; reference 03 for shared facts. |\n\n> For an activated mapping, setup MUST generate each applicable mapped PS document as a pointer and consolidate its evidenced architectural facts into the mapped sections of 03, because separate detailed descriptions drift.\n>\n> Setup MUST preserve the information requirements of the original PS document. A shorter BS table MUST NOT justify losing configuration inventories, transaction details, error transformations, integration safeguards or critical-module invariants.\n\n03 may require reviewed expansion. Its Configuration and Outbound integrations sections start with comparatively compact structures. Changes are to the target project's 03, never the BS template.\n\n**Instruction-summary exception:** root and local instruction files retain concise critical-rule summaries, stack identification, DB-change policy and executable commands required for their instruction role. These summaries MUST agree with 03 and reference it for architectural detail.\n\nThis keeps the rule above that the root keeps the short version, and the BS requirement that its CLAUDE.md commands stay consistent.\n\n> Setup MUST resolve headings after removing an optional leading section number and normalizing whitespace. It MUST preserve meaningful text, including parenthetical cross-references, because removing arbitrary parentheses can collapse distinct destinations.\n>\n> Setup MUST resolve subordinate headings within their named parent section. Missing, renamed or ambiguous destinations require explicit disposition; setup MUST NOT choose a similar heading silently or generate a duplicate full document.\n>\n> Pointers MUST reproduce actual resolved heading names.\n\nUse file links with named headings rather than generated fragment identifiers. Renumbering remains usable; changed cross-references or meaning require review.\n\nEach section bullet is one line: `- <Heading>` for a top-level section, or `- <Parent> > <Subheading>` for a subordinate heading, for example `- Database > Schema changes`. A subordinate heading is never listed without its parent, and every mapped section of the PS document is listed.\n\n### Pointer format\n\nUse this skeleton; no shipped template file carries it.\n\n```markdown\n# {{TITLE}}\n\n<!-- project-setup:documentation-pointer v=1 -->\n\nSource of truth: [Project architecture]({{RELATIVE_PATH_TO_03}}).\n\nSections:\n{{SECTION_BULLETS}}\n\nScope: {{TOPIC_OR_VENDOR}}.\n\nReaders and agents MUST follow the source link and read the named sections\nbefore relying on or updating this topic, because this file contains\nnavigation only.\n\nReaders and agents making documentation updates MUST change the source\nsections instead of adding factual content here, because duplicate\ndescriptions drift. Preserve this pointer unless its destination changes.\n\nIf the source or a named section is missing or unclear, documentation-writing\nagents MUST record the gap in the repository-root TODO.md within their\nauthorized scope. Read-only agents MUST report the gap in their output and\nMUST NOT create, modify or delete files. Other readers MUST report the gap\nto the documentation owner. These duties preserve each actor's write\nboundary.\n\nDocumentation-writing agents MUST resolve the destination before changing\nthe affected documented facts, because an unresolved destination cannot\nestablish the factual source of truth.\n```\n\nExpansion rules:\n\n- Replace every placeholder.\n- Emit one section bullet per resolved heading or parent/subheading pair.\n- Use the relative paths below.\n- Include no copied factual summaries, tables, timestamps or hashes.\n- Identify the vendor in `Scope`; generate vendor pointers only with evidence.\n- Exempt valid pointers from the generic \"skip near-empty documents\" instruction.\n- Keep the pointer marker distinct from managed-block markers.\n\n| Pointer directory | Relative path to 03 |\n|---|---|\n| `.ai/context/` | `../standards/03-project-architecture.md` |\n| `docs/` | `../.ai/standards/03-project-architecture.md` |\n| `docs/integrations/` | `../../.ai/standards/03-project-architecture.md` |\n\nEach pointer MUST supply complete routing when opened alone. Correct routing MUST NOT depend on root text, imports or subagent inheritance. Actual agent compliance remains a live measurement.\n\nThe split reporting duty matches both reviewer wrappers: the Claude reviewer has no Edit/Write tools and forbids shell workarounds, and the Codex reviewer forbids file changes.\n\n### Ownership\n\n> Setup MUST request `merged` ownership for pointers and a created or changed 03, because these are living project documents.\n>\n> Setup MUST NOT claim ownership of 03 merely by reading or linking it.\n>\n> Setup MUST preserve user additions to pointers until their disposition is approved; the pointer marker grants no deletion permission.\n>\n> Setup MUST review ownership transitions alongside content changes.\n\nLiving PS docs without blocks already infer `merged`. `.ai/standards/` is outside that inference, so a newly created or changed 03 needs an explicit entry in the ownership request to avoid `full`.\n\n### Conditional root routing\n\nFor activated projects, add this paragraph to the generated root `critical-rules` block:\n\n> Readers and agents MUST follow documentation pointers to their named source sections before relying on or updating the topic. For BS-mapped documentation, `.ai/standards/03-project-architecture.md` owns the facts; pointer files contain navigation only. All agents, including reviewer and docs-sync, MUST follow that routing. Documentation-writing agents MUST update the affected source sections instead of expanding a pointer, because separate descriptions drift. If a destination is missing or unclear, documentation-writing agents MUST record the gap in root `TODO.md` within their authorized scope and resolve the destination before changing the affected documented facts. Read-only agents MUST report the gap in their output and MUST NOT create, modify or delete files. Other readers MUST report the gap to the documentation owner. These duties preserve each actor's write boundary.\n\nAdd this sentence to the generated navigation:\n\n> Some entries below are documentation pointers; follow their source links and named headings.\n\nKeep `assets/templates/AGENTS.md` unchanged. Non-activated output receives neither addition.\n\nPreserve the existing money/auth critical rule and its `.ai/context/critical-modules.md` reference, including locking, atomicity and idempotency requirements. That document becomes a self-sufficient pointer.\n\n### Canonical agents and extensions\n\nThe canonical agents stay unchanged. Docs-sync maps changes to PS document paths and reads the entire target document before editing; the pointer supplies the onward destination. The reviewer also reads documents that become pointers. This specifies the intended workflow without proving host compliance.\n\n> Setup MUST NOT synthesize or append a docs-sync extension solely to enable pointer routing. Existing project customizations MUST retain explicit dispositions and exact-text preservation, because mapping cannot bypass project-rule approval.\n>\n> If BS has changed an installed PS wrapper, setup MUST apply the existing user-modified-file rule separately to that wrapper: keep theirs, take new, or merge through review.\n>\n> Setup MUST inventory rules and frontmatter before replacement. Approved project rules MUST use the existing project-extension destinations, preserving existing extension bytes. Approval cannot relax a canonical restriction.\n>\n> Setup MUST report a retained standalone BS agent or unresolved custom wrapper as an incomplete PS agent update and identify the definition actually invoked.\n\nThese apply the existing adoption and update rules in `references/modes.md`; they add no new wrapper-generation behavior. A declined replacement of the standalone BS docs-sync still permits the mapping (maintainer decision Q8): keep the retained agent, report the incomplete PS agent installation and make no canonical-compatibility claim.\n\n### Existing-content consolidation\n\n> Before converting an existing document, setup MUST inventory its substantive content and propose a destination for every item: an evidenced section of 03, an uncovered full document, or an explicitly unresolved TODO item.\n>\n> Setup MUST obtain dispositions for contradictions and removals. It MUST NOT move a known invariant solely into TODO to make conversion appear complete.\n>\n> Setup MUST stage approved source changes, pointer replacements, routing instructions and ownership changes in one reviewed apply transaction. It MUST NOT replace an original while necessary consolidation remains unapproved.\n\nApply this equally to adoption and update. PS provenance does not make existing knowledge disposable. When consolidation is declined or a destination stays unresolved, keep the originals and report incomplete conversion (maintainer decision Q3). A project where BS ran after project-setup follows the per-file recovery in `references/modes.md` before any conversion.\n\n| Case | Required treatment |\n|---|---|\n| PS full documents precede BS's 03 | Inventory and reconcile during PS update; do not require a new-service stamp. |\n| BS overwrites or merges PS instructions/wrappers | Measure first, then apply the per-file recovery table. Retain the BS overwrite TODO. |\n| Missing or malformed managed markers | Apply existing removed-content or marker-error rules; no silent repair. |\n| Blank mapped section | Complete from permitted implementation evidence; identify unknowns explicitly. |\n| Owner declines necessary completion | Retain originals, hold dependent conversions, report incomplete consolidation. |\n| Existing document contradicts 03 | Show both locations and verify permitted code; obtain disposition. |\n| Detail exceeds BS tables | Propose reviewed expansion under the matching section; apply Q7 (see \"Size\" below). |\n| Heading renumbered | Match normalized heading text under its parent. |\n| Heading renamed, removed, duplicated or cross-reference changed | Hold until a replacement/addition is approved. |\n| Facts added to a pointer | Preserve and inventory them; propose consolidation. |\n| User deleted a pointer | Do not silently recreate it; resolve disposition. Docs-sync reports missing navigation. |\n| Local instructions exist | Preserve both members of each pair and local constraints. |\n| Local instruction conflicts with routing | Resolve before installing contradictory root text. |\n| 03 protected, unsafe or unreadable | Stop the affected step; no bypass or duplicate-document fallback. |\n| No evidenced vendor/business flow | Do not invent documents. |\n| All source/output unchanged | Zero diff, including manifest bytes. |\n| Required source changes after prepare | Existing drift binding refuses commit; reprepare according to run lifecycle. |\n| Partial apply or intervening rollback edits | Preserve recovery material and follow journal handling. |\n\n**Size.** Decision Q7 (2026-11-11): record the UTF-8 bytes and line count of 03 before and after consolidation, use a review threshold rather than an assumed host ceiling, keep concise complete facts in 03 and make no automatic split. Never truncate facts to meet an assumed limit; an appendix needs its own reviewed ownership and navigation contract first.\n\n### Source binding\n\n> A pointer transaction MUST declare existing 03 in `transaction-inputs.json` when it is not drafted, because approval must bind the source used to resolve headings and content.\n>\n> Setup MUST also bind unchanged root CLAUDE.md when activation relies on its provenance, and unchanged root AGENTS.md when activation relies on the exact owner decision. Drafted targets already receive target-hash binding.\n\nThe existing prepare and commit recheck inputs, targets, drafts and request metadata before writing (`references/state-and-apply.md`).\n\nDo not declare `.backend-standards.json`: it is outside the existing scope accepted for transaction inputs. Reconfirm its disposition immediately before prepare.\n\n**Accepted limitation:** the stamp can change between that check and commit. This release adds neither atomic stamp binding nor a production-script change.\n\n### Validation boundary\n\n`reference-exists` examines instruction files and `.ai/agents/*.md`; it does not validate ordinary pointer destinations or headings. Therefore:\n\n- Preserve applicable navigation references to emitted pointers.\n- Deleting a referenced pointer must still fail `reference-exists`.\n- The project-setup test-only checker validates pointer paths, containment, headings and format.\n- Drafting instructions MUST require destination inspection.\n- The checker does not become shipped enforcement.\n- Validator success alone does not prove mapping correctness or restored root-start semantics.\n\nA later BS copy or re-sync can erase consolidated 03 content and can replace PS instructions or wrappers again; project-setup does not prevent either. Accepting a BS re-sync requires reviewed preservation or merge of that content, and the durable fix remains BS 4.0.0 work.\n\n",
    after: "## Ownership hints\n",
  }),

  // references/modes.md
  MD31_1: Object.freeze({
    file: "references/modes.md",
    before: "",
    old: "This behavior has not been verified on a real backend-standards scaffold.\n",
    neu: "A real Nest CLI 11 scaffold was exercised with BS followed by PS adopt on 2026-11-11. Prepare\nheld CLAUDE.md and both standalone Claude agents for approval. That run did not exercise the\nagents, Codex, or PS followed by BS, and did not verify the 3.1 pointer workflow.\n",
    after: "",
  }),
  MD31_2: Object.freeze({
    file: "references/modes.md",
    before: "",
    old: "",
    neu: "**backend-standards documentation mapping (adopt and update).** The mode decides the workflow;\nthe documentation layout is a separate policy. In adopt and in update, assess the BS layout\nsignals and apply the source-of-truth mapping in `references/docs-generation.md` (\"Documentation\nsource of truth on backend-standards projects\"), including its existing-content consolidation,\nbefore drafting any overlapping document. PS provenance does not exempt an update from that\nconsolidation; BS markers still grant project-setup no ownership.\n\n**PS-first recovery: measure BS before proposing repairs.** BS instructs the agent to write\nCLAUDE.md from its template and copy two Claude agents. Its existing-project procedure invokes\nthose operations. The repository records the overwrite problem as unfinished BS 4.0.0 work.\nThe actual outcome of a particular agent run—overwrite, merge, unchanged or mixed—must be\nobserved. Live measurement uses the test-only helper `tests/live/bs-doc-map.mjs`.\nThe helper MUST NOT pre-restore PS files, intercept BS writes, or simulate a desired outcome.\n\n| File | If BS overwrites | If BS merges or preserves | PS 3.1 completion/checker expectation |\n|---|---|---|---|\n| Root `CLAUDE.md` | Inventory lost PS import/block and preserved/new BS content. Propose a reviewed merge restoring `@AGENTS.md` and the complete current managed `claude` block, including the root-start rule. Preserve BS imports, version sentence, commands and approved user content. | Inspect the resulting import, block, BS lines and user text. Preserve correct content; review missing or changed parts. Do not assume a merge preserved every rule. | Exactly one effective sibling import and one valid managed `claude` block with the required source-template content; BS imports/version information retained; approved user content preserved; no duplicate/conflicting instructions. |\n| `.claude/agents/reviewer.md` | Treat it as a user-modified fully owned file when its manifest record says `full`. Offer keep/take-new/merge and inventory BS rules/frontmatter. | Compare actual bytes against the manifest and shipped wrapper. Apply the same disposition rule whenever modified. | Take-new or approved canonical restoration: exact shipped wrapper plus approved project-extension preservation. Keep or unresolved custom merge: exact retained/approved bytes, actual invoked definition recorded, incomplete PS agent layer. |\n| `.claude/agents/docs-sync.md` | Same per-file user-modified workflow; preserve approved documentation rules through the existing extension mechanism. | Same comparison and separate disposition; reviewer's choice does not decide docs-sync's choice. | Same distinction between canonical completion and retained/custom incomplete installation. |\n| `.ai/agents/*`, Codex wrappers, root `AGENTS.md`, settings, runtime and manifest | Inspect the explicit permitted inventory for collateral changes; no blanket assumption that BS touched or preserved them. | Same. | Unaffected bytes remain unchanged. Any observed change receives its existing ownership/disposition workflow; no unexplained collateral modification is accepted. |\n\nThe root-start rule and the reviewed installation of the managed `claude` block come from\n`references/docs-generation.md`; retained old instructions remain an incomplete update.\nMissing blocks are not silently recreated. Marker errors stop for repair; removed blocks or\nfiles require disposition. Keeping deficient CLAUDE.md is a held/incomplete result, not\nsuccessful root recovery.\n\nBefore candidate PS, record:\n\n- Per-file before/after hashes and overwrite/merge/unchanged classification, with evidence.\n- Whether `@AGENTS.md`, the `claude` block, root-start rule and BS imports/version sentence exist.\n- Actual `validate.mjs` results and `blocks.mjs drift` results.\n- Actual installed agent definitions and manifest ownership.\n\nIf BS removed `@AGENTS.md` while sibling AGENTS.md exists, expect `claude-import` failure.\nFull-file differences produce `userModified: true` in block drift and validator drift warnings;\nremoved managed blocks appear as `removed-by-user`. A merge may produce different results;\nrecord actual diagnostics rather than forcing overwrite expectations.\n\nRetain the BS overwrite TODO (BS 4.0.0 work); do not close it here. Rolling back the candidate\nPS transaction returns to the post-BS state captured before it; it does not undo BS's earlier\nchanges.\n\n",
    after: "**add-claude.** Leave `AGENTS.md` content intact; add managed blocks only where sections are missing. Create\n",
  }),

  // references/report.md
  RP31_1: Object.freeze({
    file: "references/report.md",
    before: "",
    old: "",
    neu: "### Documentation source mapping\n- Layout: <BS-mapped / ordinary PS / pending>.\n- Provenance: <signals and approved disposition>.\n- Conversion: <complete / partial / held / not applicable>.\n| PS path | Source headings | Outcome | Content disposition or remaining action |\n- BS outcome by file: <overwrite / merge / unchanged / other, evidence>.\n- CLAUDE.md recovery and per-wrapper dispositions.\n- Agent definitions retained or replaced; incomplete instruction/agent updates.\n- Pointer/source checks performed and their limits.\n- Host routing measurements: <host, agent, version, result / not verified>.\n- Source-size, BS re-sync and stamp-binding limitations.\n\n",
    after: "### Validation (validate.mjs)\n",
  }),
  RP31_2: Object.freeze({
    file: "references/report.md",
    before: "",
    old: "",
    neu: "The Documentation source mapping section is conditional: include it only when the run assessed the\nbackend-standards mapping of `references/docs-generation.md`. Report ambiguity, held conversions,\ndeclined replacements, incomplete consolidation, missing pointers and unverified hosts there. A\npartial, held or pending outcome is never reported as complete.\n\n",
    after: "Never write \"secure\", \"protected\", or \"no secrets\" without the scope: which tool, which layer, which version,\n",
  }),

  // @root/README.md
  RR31_1: Object.freeze({
    file: "@root/README.md",
    before: "",
    old: "`project-setup` (3.0.0, shared by Claude Code and Codex) is **not**\n",
    neu: "`project-setup` (3.1.0, shared by Claude Code and Codex) is **not**\n",
    after: "",
  }),
  RR31_2: Object.freeze({
    file: "@root/README.md",
    before: "",
    old: "See `project-setup/README.md` and `project-setup/RELEASE-NOTES-3.0.0.md` (compatibility,\nlimitations and the rc.4 host measurement results). A project installed\n",
    neu: "See `project-setup/README.md` and `project-setup/RELEASE-NOTES-3.1.0.md` (compatibility,\nthe backend-standards documentation mapping and limitations). A project installed\n",
    after: "",
  }),
  RR31_3: Object.freeze({
    file: "@root/README.md",
    before: "",
    old: "",
    neu: "`project-setup/RELEASE-NOTES-3.0.0.md` is the 3.0.0 history, with the rc.4 host measurement results.\n",
    after: "\nWhen using project-setup on a target repository, start Claude Code at that repository's root.\n",
  }),
  RR31_4: Object.freeze({
    file: "@root/README.md",
    before: "",
    old: "This installs `project-setup` 3.0.0 for both tools; update each project installed\n",
    neu: "This installs `project-setup` 3.1.0 for both tools; update each project installed\n",
    after: "",
  }),
  RR31_5: Object.freeze({
    file: "@root/README.md",
    before: "",
    old: "The rc.4 host measurement results and limitations are in the 3.0.0 release notes.\n",
    neu: "The 3.1.0 live acceptance is pending evidence; its scope and limitations are in the 3.1.0 release notes.\n",
    after: "",
  }),
  RR31_6: Object.freeze({
    file: "@root/README.md",
    before: "",
    old: "`project-setup/RELEASE-NOTES-3.0.0.md` § \"Compatibility and rollback\").\n",
    neu: "`project-setup/RELEASE-NOTES-3.1.0.md` § \"Rollback\").\n",
    after: "",
  }),
  RR31_7: Object.freeze({
    file: "@root/README.md",
    before: "",
    old: "├── project-setup/               general-purpose — shared Claude Code + Codex setup (3.0.0, own installer and tests)\n",
    neu: "├── project-setup/               general-purpose — shared Claude Code + Codex setup (3.1.0, own installer and tests)\n",
    after: "",
  }),

  // @root/.ai/context/project-tree.md
  PT31_1: Object.freeze({
    file: "@root/.ai/context/project-tree.md",
    before: "",
    old: "├── project-setup/              skill 3 — shared Claude Code + Codex agent scaffolding (3.0.0)\n",
    neu: "├── project-setup/              skill 3 — shared Claude Code + Codex agent scaffolding (3.1.0)\n",
    after: "",
  }),
  PT31_2: Object.freeze({
    file: "@root/.ai/context/project-tree.md",
    before: "",
    old: "(`project-setup/VERSION` is `3.0.0`) with its own layout: `SKILL.md`,\n",
    neu: "(`project-setup/VERSION` is `3.1.0`) with its own layout: `SKILL.md`,\n",
    after: "",
  }),
  PT31_3: Object.freeze({
    file: "@root/.ai/context/project-tree.md",
    before: "",
    old: "",
    neu: "Since 3.1.0, on a project with backend-standards provenance, `project-setup` treats\n`.ai/standards/03-project-architecture.md` as the documentation source of truth and emits pointer\ndocuments (`project-setup/references/docs-generation.md`). Its standalone gates are\n`tests/bs-doc-map.test.mjs`, `tests/release-3.1.test.mjs` and `tests/c18.test.mjs`; the live\nacceptance (`tests/live/BS-DOC-MAP-ACCEPTANCE.md`, helper `tests/live/bs-doc-map.mjs`) is pending\nevidence, see project-setup/RELEASE-NOTES-3.1.0.md.\n\n",
    after: "## `backend-standards/`\n",
  }),
});

export const FORWARD_ORDER31 = Object.freeze({
  "SKILL.md": Object.freeze(["SK31_1", "SK31_2", "SK31_3"]),
  "VERSION": Object.freeze(["VR31_1"]),
  "README.md": Object.freeze(["RM31_1", "RM31_2", "RM31_3", "RM31_4", "RM31_5", "RM31_6"]),
  "CHANGELOG.md": Object.freeze(["CL31_1"]),
  "references/docs-generation.md": Object.freeze(["DG31_1"]),
  "references/modes.md": Object.freeze(["MD31_1", "MD31_2"]),
  "references/report.md": Object.freeze(["RP31_1", "RP31_2"]),
  "@root/README.md": Object.freeze(["RR31_1", "RR31_2", "RR31_3", "RR31_4", "RR31_5", "RR31_6", "RR31_7"]),
  "@root/.ai/context/project-tree.md": Object.freeze(["PT31_1", "PT31_2", "PT31_3"]),
});
export const REVERSAL_ORDER31 = Object.freeze(Object.fromEntries(Object.entries(FORWARD_ORDER31).map(([f, ids]) => [f, Object.freeze([...ids].reverse())])));
export const AMENDED_FILES31 = Object.freeze(Object.keys(FORWARD_ORDER31));

// SHA-256 of each amendable file at the base commit (the verified 3.0.0 bytes); read30 refuses any reconstruction that differs.
const BASE_SHA31 = Object.freeze({
  "SKILL.md": "6f62732e018228e2ebe518aca9d17d075893d2b39399c79a607de818b40a3f15",
  "VERSION": "2985be8b28d3ade858e8d8fb4bc22f565b1bf6020dff982dce141f7721b9999c",
  "README.md": "b7fbc19e9b1ac149c872a74caae2b813b957daa8f5c59f0c4acdfba382f2cc0c",
  "CHANGELOG.md": "f5a0b5bc6c9667d8a0d6f38a7d019da59c1b8d0f8add1773eb415a4f8f1242d2",
  "references/docs-generation.md": "cabdf9cd7df65ee9d7660abc4cf9b95eb0e3f9c1386ea069ec87d55322616503",
  "references/modes.md": "376435f0faaa768486607c5a6ee461f0795ea6b92cb0b5a0a4d615ae67917bd7",
  "references/report.md": "8d7d3fa6e834895a29d6df64c8768c9e85e35e6a8a68fc30bd4ca7d545056b64",
  "@root/README.md": "d5e700cd14549b63be51eaddc0dba2dd868fd3b82197296a7d3a2ab222d06cd5",
  "@root/.ai/context/project-tree.md": "ad472b829f1eb7be07e6f6b76051912b952f5b08931fa3df40a9db4a16a79760",
  "@root/TODO.md": "e18aad7b0db37b6864417fd46572a77f90ff2be419949087ddc33a130d0751a2",
});

function occurrences(text, needle) {
  const out = [];
  if (needle === '') return out;
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) out.push(i);
  return out;
}
const known = (id) => Object.prototype.hasOwnProperty.call(AM31, id);
/** One record reversed: before + neu + after must stand exactly once. null otherwise. */
function reverseOne(text, r) {
  const key = r.before + r.neu + r.after;
  const at = occurrences(text, key);
  if (at.length !== 1) return null;
  return text.slice(0, at[0]) + r.before + r.old + r.after + text.slice(at[0] + key.length);
}
/** One record applied: before + old + after must stand exactly once. null otherwise. */
function applyOne(text, r) {
  const key = r.before + r.old + r.after;
  const at = occurrences(text, key);
  if (at.length !== 1) return null;
  return text.slice(0, at[0]) + r.before + r.neu + r.after + text.slice(at[0] + key.length);
}

/** Reverses the named records in the given order. { text, failed }: text is null and failed names the first that does not verify. */
export function reverseSteps(text, ids) {
  let t = text;
  for (const id of ids) {
    if (!known(id)) return { text: null, failed: id };
    t = reverseOne(t, AM31[id]);
    if (t === null) return { text: null, failed: id };
  }
  return { text: t, failed: null };
}
/** Applies the named records in the given order; null when one does not stand exactly once. */
export function applySteps(text, ids) {
  let t = text;
  for (const id of ids) {
    if (!known(id)) return null;
    t = applyOne(t, AM31[id]);
    if (t === null) return null;
  }
  return t;
}
/** The 3.0.0 view of one amended file: every 3.1 record of that file reversed, last first. { text, failed }. */
export function reverseForFile(text, rel) {
  const ids = REVERSAL_ORDER31[rel];
  if (ids === undefined) return { text: null, failed: `no 3.1 amendment for ${rel}` };
  return reverseSteps(text, ids);
}
export function applyForFile(text, rel) {
  const ids = FORWARD_ORDER31[rel];
  return ids === undefined ? null : applySteps(text, ids);
}

const REAL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const absOf = (rel) => path.resolve(rel.startsWith('@root/') ? path.join(REAL_ROOT, ...rel.slice(6).split('/')) : path.join(REAL_ROOT, 'project-setup', ...rel.split('/')));
const REL_BY_ABS = new Map(AMENDED_FILES31.map((rel) => [absOf(rel), rel]));
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/** The amended-file key of an absolute path of the real tree, or undefined. */
export const amendedKeyOf31 = (p) => REL_BY_ABS.get(path.resolve(p));

/**
 * fs.readFileSync for the 3.0.0-era tests: an amended file of the real tree is returned as its verified 3.0.0 view (every 3.1 record
 * reversed, and the result equal to the pinned base-commit SHA-256); every other path is read as is. Throws when a reversal does not
 * verify, so an unrecorded edit can never be hidden behind the baseline.
 */
export function read30(p) {
  const b = fs.readFileSync(p);
  const rel = REL_BY_ABS.get(path.resolve(p));
  if (rel === undefined) return b;
  const r = reverseForFile(b.toString('utf8'), rel);
  if (r.text === null) throw new Error(`3.1.0 amendment does not reverse for ${rel}: ${r.failed}`);
  if (sha256(r.text) !== BASE_SHA31[rel]) throw new Error(`3.1.0 reversal of ${rel} is not the pinned 3.0.0 baseline`);
  return Buffer.from(r.text, 'utf8');
}

/**
 * After a copy of the real project-setup tree, makes the copy the 3.0.0 tree: the amended project-setup files are reversed (each record
 * verified at its anchor) and only RELEASE-NOTES-3.1.0.md is removed. Throws on an amended file that does not reverse. An unrecorded
 * edit elsewhere in a file is left in place, so a later comparison with the pinned 3.0.0 tree still shows it.
 */
export function to30Tree(skillDir) {
  for (const rel of AMENDED_FILES31.filter((r) => !r.startsWith('@root/'))) {
    const p = path.join(skillDir, ...rel.split('/'));
    const r = reverseForFile(fs.readFileSync(p, 'utf8'), rel);
    if (r.text === null) throw new Error(`3.1.0 amendment does not reverse for ${rel}: ${r.failed}`);
    fs.writeFileSync(p, r.text, 'utf8');
  }
  fs.rmSync(path.join(skillDir, 'RELEASE-NOTES-3.1.0.md'), { force: true });
}
