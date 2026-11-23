// 3.2.0 amendment engine and the reconstruction of the 3.1.0 tree (test-only; never part of the installer payload).
//
// Plan: docs/plans/2026-11-22-project-setup-v3.2.0-plan.md, sections 4.2, 4.3, 4.4 and 4.7 (decision D-6). The 3.2.0 source is the 3.1.0 source
// (base commit d0cd48e40f8fea897a27b28d7c679e55f0203237) plus the amendment records (AM320) and exactly the new files (NEW_FILES320).
//
// STATE OF THIS FILE (tests lane): the engine was written in session 1, before any implementation existed. Session 2 (plan 4.7 step 3) generated
// the AM320 literals, the forward order map and the 3.1.0 pin table (BASE_SHA320) from a line diff of the base commit against the reviewed 3.2.0
// files, and changed no function in this file. A stub BASE_SHA320 (the string PIN_PENDING) still makes read310 and to310Repo THROW with a message
// that starts "PIN_PENDING:" and never return bytes that were not verified against a pin: a view is never silently trusted.
//
// A record is { file, before, old, neu, after } exactly as in v31-amendments.mjs: before + old + after is the 3.1.0 slice and before + neu +
// after the 3.2.0 slice, all strings, LF only. Keys are relative to project-setup/; the three repository-root files are keyed "@root/<path>".
// Every function takes the record set (and orders and pins) as an OPTIONAL last argument that defaults to the real module constants, so the
// specs can prove the engine on synthetic records without a second implementation. The gate that judges pass or fail is the spec's own
// (tests/release-3.2.0.test.mjs); this module is never asked to decide pass or fail there.
// Importing this module reads no file and starts no process: only read310, buildView, to310Repo, overlay and verifyView read, and only when called.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const CURRENT_VERSION320 = '3.2.0';
export const BASE_COMMIT320 = 'd0cd48e40f8fea897a27b28d7c679e55f0203237';
/** The marker of a value that session 2 has not generated yet. A spec that meets it prints a FAIL line naming it. */
export const PIN_PENDING = 'PIN_PENDING';

/** id -> frozen { file, before, old, neu, after }: the 3.2.0 amendments of the 3.1.0 source (generated in session 2 from the base commit and the reviewed 3.2.0 files). */
export const AM320 = Object.freeze({
  // SKILL.md
  SK320_1: Object.freeze({
    file: "SKILL.md",
    before: "",
    old: "# project-setup 3.1.0\n",
    neu: "# project-setup 3.2.0\n",
    after: "",
  }),
  SK320_3: Object.freeze({
    file: "SKILL.md",
    before: "",
    old: "",
    neu: "   Act on an installerBackups warning before continuing: a backup inside the skills directory can be an active second copy.\n",
    after: "2. Only when detect reports mode `update` with a schema-2 manifest, run\n",
  }),
  SK320_2: Object.freeze({
    file: "SKILL.md",
    before: "",
    old: "",
    neu: "   The assessment lists every mapped document as provisionally applicable (with its evidence kind) or not applicable, as defined in references/docs-generation.md (\"Applicability\"); Phase 1 confirms the list.\n",
    after: "7. Permission decisions. Read `claude.allows.rules`, `managed`, `omitted` and `results`. The managed inventory comes\n",
  }),

  // VERSION
  VR320_1: Object.freeze({
    file: "VERSION",
    before: "",
    old: "3.1.0\n",
    neu: "3.2.0\n",
    after: "",
  }),

  // README.md
  RM320_1: Object.freeze({
    file: "README.md",
    before: "",
    old: "# project-setup 3.1.0 - skill source\n",
    neu: "# project-setup 3.2.0 - skill source\n",
    after: "",
  }),
  RM320_2: Object.freeze({
    file: "README.md",
    before: "",
    old: "**Release 3.1.0.** See RELEASE-NOTES-3.1.0.md for compatibility, the backend-standards\ndocumentation mapping, acceptance requirements, the measured live results and the remaining limitations.\n",
    neu: "**Release 3.2.0.** See RELEASE-NOTES-3.2.0.md for compatibility, the fixes to the 3.1.0 live\nacceptance findings, the upgrade steps, what is not measured and the remaining limitations.\n",
    after: "",
  }),
  RM320_3: Object.freeze({
    file: "README.md",
    before: "",
    old: "",
    neu: "The paragraphs above describe 3.1.0. In 3.2.0 the canonical reviewer and the root AGENTS.md and\nCLAUDE.md templates changed, the mapping gained one applicability rule for every mode and\npartial-agent-layer variants, and none of these changes is measured yet; see RELEASE-NOTES-3.2.0.md.\n\n",
    after: "## Test first (no installation, no real config touched)\n",
  }),
  RM320_4: Object.freeze({
    file: "README.md",
    before: "",
    old: "gates node tests/bs-doc-map.test.mjs, node tests/release-3.1.test.mjs and node tests/c18.test.mjs\n(the 3.1.0 mapping contract, the 3.1.0 release assertions and the historical 3.0.0 assertions;\n",
    neu: "gates node tests/release-3.2.0.test.mjs, node tests/v320.test.mjs and node tests/bs-doc-map.test.mjs\n(the 3.2.0 release gate, the 3.2.0 behaviour and contract spec, and the living mapping contract;\n",
    after: "",
  }),
  RM320_5: Object.freeze({
    file: "README.md",
    before: "",
    old: "",
    neu: "From 3.2.0 the historical gates (tests/run-tests.mjs, tests/accept-rc1.mjs,\ntests/release-3.1.test.mjs and tests/c18.test.mjs) read the 3.1.0 scripts and data. They run only\nin the reconstructed 3.1.0 view built by node tests/run-310-view.mjs; run directly in the 3.2.0\nworking tree they are expected to fail. `--out` is an empty directory outside the repository and\noutside the temp directory. CI runs none of these gates.\n\n",
    after: "```text\nnode tests/accept-rc1.mjs\n",
  }),
  RM320_6: Object.freeze({
    file: "README.md",
    before: "",
    old: "node tests/accept-rc1.mjs\n",
    neu: "node tests/run-310-view.mjs --out <empty-dir-1> --run release-3.1,c18,bs-doc-map\nnode tests/run-310-view.mjs --out <empty-dir-2> --run accept-rc1\n",
    after: "",
  }),
  RM320_7: Object.freeze({
    file: "README.md",
    before: "",
    old: "requires or creates project-setup-v3.1.0 in the distribution repository.\n",
    neu: "requires or creates project-setup-v3.2.0 in the distribution repository.\n",
    after: "",
  }),
  RM320_8: Object.freeze({
    file: "README.md",
    before: "",
    old: "node install/release.mjs --tag project-setup-v3.1.0 --out <unused-directory>\n",
    neu: "node install/release.mjs --tag project-setup-v3.2.0 --out <unused-directory>\n",
    after: "",
  }),

  // CHANGELOG.md
  CL320_1: Object.freeze({
    file: "CHANGELOG.md",
    before: "# Changelog\n\n",
    old: "",
    neu: "## 3.2.0\n\nFixes for findings 1 to 10 of the 3.1.0 live acceptance and the two 3.0.x reviewer residuals.\nThe items promised for 3.1.x in RELEASE-NOTES-3.1.0.md ship here, as a minor release, because\ntwo shipped deny patterns, new MUST rules and a new detect output field are additive changes.\n\n- Shipped secret-path policy: root-anchored `env/**` and `cert/**`. Setup's own reads refuse them\n  as soon as 3.2.0 is installed; a project that tracks files there stops in Phase 0. A project\n  fresh-installed by 3.0.0 or 3.1.0 is recognised as baseline `v3.0.0` and is offered exactly the\n  two new coverage rows instead of a full re-review.\n- Canonical reviewer: a broken critical or MUST-level rule in a money or state-integrity flow is\n  rated HIGH or CRITICAL whatever its current reachability, and makes the verdict block.\n- Root CLAUDE.md template: a delegated agent no longer refuses on its own working directory alone;\n  root AGENTS.md template: the parent states the start directory in every delegation, and every\n  agent keeps managed-block markers intact.\n- Documentation mapping: one applicability rule for every mode, with configuration and compiler\n  strictness proposals; four Subagents line variants and three agents-block sentences for a\n  partial agent layer.\n- `detect.mjs` reports installer backups inside the skills directories (`installerBackups`) with\n  one warning per tool; the installer itself is unchanged.\n\nVerification: tests/release-3.2.0.test.mjs, tests/v320.test.mjs and tests/bs-doc-map.test.mjs\nrun in the working tree; the historical gates run only in the reconstructed 3.1.0 view through\ntests/run-310-view.mjs. CI runs none of them. None of the 3.2.0 changes is measured on a host yet.\n\nSee RELEASE-NOTES-3.2.0.md.\n\n",
    after: "",
  }),

  // references/docs-generation.md
  DG320_1: Object.freeze({
    file: "references/docs-generation.md",
    before: "",
    old: "",
    neu: "### Subagents line variants\n\nThe `claude` block of root CLAUDE.md carries exactly one of these four Subagents lines. The first\nis the template line; the other three describe a partial agent layer:\n\n```text\n- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; both load their canonical definition from `.ai/agents/`.\n- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; only `reviewer` loads its canonical definition from `.ai/agents/`. `docs-sync` is a retained project agent (incomplete project-setup agent update).\n- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; only `docs-sync` loads its canonical definition from `.ai/agents/`. `reviewer` is a retained project agent (incomplete project-setup agent update).\n- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; both are retained project agents and neither loads a canonical definition from `.ai/agents/` (incomplete project-setup agent update).\n```\n\nThe `agents` block of root AGENTS.md carries none of these three sentences in a full layer and\nexactly one in a partial layer, as its own line directly after the template sentence \"Do not\ncreate an ad-hoc agent for the same job.\" and before the two template paragraphs that follow it:\n\n```text\nException in Claude Code: `docs-sync` is a retained project agent and does not load its canonical definition (incomplete project-setup agent update).\nException in Claude Code: `reviewer` is a retained project agent and does not load its canonical definition (incomplete project-setup agent update).\nException in Claude Code: `reviewer` and `docs-sync` are retained project agents and do not load their canonical definitions (incomplete project-setup agent update).\n```\n\nThe layer concerns Claude wrappers only: backend-standards ships two Claude agents and no Codex\nwrapper (`references/modes.md`).\n\nSetup MUST choose the Subagents line and the agents-block sentence from the per-agent\ndispositions of the same run, so a managed block never states an agent layer that was\nnot installed. An agent counts as canonical only when its Claude wrapper at\n.claude/agents/<name>.md is the shipped wrapper, or an approved merge that still loads\n.ai/agents/<name>.md first, and .ai/agents/<name>.md is the rendered canonical\ndefinition. Otherwise it is retained.\nSetup MUST use one of the four lines byte for byte and, in a partial layer, exactly the\none matching sentence; it MUST NOT write any other wording. The rest of both blocks is\nthe template text unchanged.\nOn a later run, setup MUST recompute both. When a retained agent has been replaced, the\nblocks are redrafted through the normal managed-block update; when nothing changed, the\nrun produces zero diff.\n\n",
    after: "## Project-local security tooling (fully managed, always installed)\n",
  }),
  DG320_2: Object.freeze({
    file: "references/docs-generation.md",
    before: "",
    old: "",
    neu: "#### Applicability (one rule for every mode)\n\nA mapped PS document is applicable when at least one of these holds:\n\n1. Code evidence: the source named for that document in the tables above yields at\n   least one fact from permitted reads.\n2. Source-section evidence: at least one of its mapped 03 sections resolves and its\n   body states at least one fact for the topic. A blank body, template placeholders\n   in angle brackets, or a table with no filled row is not a fact.\n3. An existing document at the PS path, whoever wrote it. Existing-content\n   consolidation below applies before it becomes a pointer.\n\nPhase 0 applicability is provisional. Setup MUST derive it only from what Phase 0 may\nread: the manifest, the lockfile name, tsconfig.json, docker-compose structure, the\nsrc/ tree listing, the framework entrypoint, detect output, existing documents and the\nresolved 03 sections. Setup MUST show the provisional list in Phase 0 with the evidence\nkind for each entry (tree listing, source section, existing document) or \"not\napplicable: no evidence\", and MUST label it provisional. This rule adds no Phase 0 read.\n\nPhase 1 confirms applicability with the evidence reads it already performs. Setup MUST\ndraft exactly the confirmed set. If the confirmed set differs from the list approved in\nPhase 0, setup MUST stop and ask again, because a report that says \"skipped\" beside an\ninstalled pointer cannot be reviewed.\n\nSetup MUST apply this rule identically in every mode. The mode decides ownership and\nthe approval workflow; it never decides which documents exist.\n\nFor a document that is not applicable, setup MUST NOT write a pointer, MUST NOT add\ncontent to 03 for that topic, and MUST remove the navigation row and any reference to\nthat path from the text it drafts, so validate does not fail on a missing target.\nFor an applicable document whose mapped section is blank while code evidence exists,\nsetup completes the section through the reviewed consolidation and identifies\nunknowns explicitly. An installed pointer whose evidence later disappears is\npreserved and reported; it is never deleted or expanded automatically, and no age\nlimit applies.\n\n`docs/integrations/<vendor>.md` is decided per vendor. `docs/business-rules/<flow>.md`,\ncode patterns, development rules, ADRs and TODO.md keep their own rules above.\n\nWhen the configuration document is applicable, setup MUST propose, through the reviewed\nconsolidation of the target project's 03, a Configuration table with one row per\nvariable name evidenced by config or validation code or by\n`env-keys.mjs keys --template auto`, with: variable, required (yes, no, conditional\nwith the condition, or unknown), classification (secret or non-secret), used by,\ndescription and source. Setup MUST make this proposal in adopt and in update alike. A\nrequiredness that the code does not establish is written `unknown` and listed in\nTODO.md; it is never guessed. Values never appear. If the owner declines the proposal,\nthe configuration conversion is incomplete: setup keeps any original, writes no claim of\ncompletion and reports it.\n\nWhen `tsconfig.json` exists and the mapping is active, setup MUST propose, through the\nsame reviewed consolidation, a statement of the compiler strictness as written (`strict`\nand each individual strict flag that is set, or \"strict not set\") under **CI/CD and\ntooling**, taken from `tsconfig.json` only, in every mode. It is a stated value, never\nan inference from code style. If the owner declines, setup reports the omission and\ndoes not write it.\n\nWhen `tsconfig.json` extends another file, setup MUST state what the root `tsconfig.json`\nsays and name the extended file, and MUST NOT resolve the chain, because the statement is\ntaken from `tsconfig.json` only.\n\nWhile the repository has no tracked source files (detect `project.sourceFileCount` is 0), setup MUST NOT write a pointer or add content to 03 on source-section evidence alone, and MUST leave an existing document at the PS path unchanged, because a pointer drafted before any code exists cannot be confirmed by the Phase 1 evidence reads; this keeps the empty-repository rule above and the empty-repo mode in `references/modes.md`.\n\nEvidence per pointer document. The code evidence repeats the source columns of the inventory\ntables above; the source sections repeat the destinations of the mapping table.\n\n| PS document | Code evidence | Source sections (03) |\n|---|---|---|\n| `.ai/context/project-tree.md` | `src/` walk; each module's controller and service | Module layout; Landmines |\n| `.ai/context/critical-modules.md` | Entities, services, guards; the user's sensitive-area answers | Module layout; Authentication and authorization; Database, including Money; Cache, locks and queues; Outbound integrations; Observability, including Retention; Landmines |\n| `.ai/context/error-contract.md` | Filters, pipes, handlers | API surface |\n| `.ai/context/configuration.md` | Config and validation code through local file tools, and `env-keys.mjs keys --template auto`; never values | Configuration |\n| `.ai/context/glossary.md` | Entity, enum and service names | Domain glossary |\n| `docs/api-conventions.md` | Versioning, response envelope, pagination, filter and sort, auth headers, rate limits, error format | API surface; Authentication and authorization |\n| `docs/database.md` | ORM, entities and key relationships, the DB change policy as practiced, transaction patterns and isolation levels | Database, including Schema changes and Money; Module layout |\n| `docs/observability.md` | Logger, correlation IDs, metrics, health checks, redaction | Observability; Health, shutdown, deployment |\n| `docs/integrations/<vendor>.md` | The vendor's client code: auth approach, endpoints used, timeouts, retry policy, idempotency, circuit breaking and fallback, logging and redaction, quirks from code comments | Outbound integrations, scoped to the vendor; Observability |\n\n",
    after: "03 may require reviewed expansion. Its Configuration and Outbound integrations sections start with comparatively compact structures. Changes are to the target project's 03, never the BS template.\n",
  }),
  DG320_5: Object.freeze({
    file: "references/docs-generation.md",
    before: "Keep `assets/templates/AGENTS.md` unchanged. Non-activated output receives neither addition.\n",
    old: "",
    neu: "\"Unchanged\" means the mapping adds no template text. The template itself changed in 3.2.0 (the agents block).\n",
    after: "",
  }),
  DG320_3: Object.freeze({
    file: "references/docs-generation.md",
    before: "Preserve the existing money/auth critical rule and its `.ai/context/critical-modules.md` reference, including locking, atomicity and idempotency requirements. That document becomes a self-sufficient pointer.\n",
    old: "",
    neu: "This applies when critical-modules is applicable under \"Applicability\" above. When it is not, remove the reference from the critical rule's last sentence and the navigation row, keep the rule itself, and record the absence in TODO.md.\n",
    after: "",
  }),
  DG320_6: Object.freeze({
    file: "references/docs-generation.md",
    before: "The canonical agents stay unchanged. Docs-sync maps changes to PS document paths and reads the entire target document before editing; the pointer supplies the onward destination. The reviewer also reads documents that become pointers. This specifies the intended workflow without proving host compliance.\n",
    old: "",
    neu: "\"Unchanged\" means the mapping adds no agent text. The canonical reviewer changed in 3.2.0 for the money-severity rule.\n",
    after: "",
  }),
  DG320_4: Object.freeze({
    file: "references/docs-generation.md",
    before: "",
    old: "",
    neu: "A retained agent is bound only by root AGENTS.md text. Setup therefore installs the\nmanaged-block rule of the agents block before it reports the retained agent, and the\nreport MUST name the managed blocks that agent is able to edit.\n\n",
    after: "### Existing-content consolidation\n",
  }),
  DG320_7: Object.freeze({
    file: "references/docs-generation.md",
    before: "**Accepted limitation:** the stamp can change between that check and commit. This release adds neither atomic stamp binding nor a production-script change.\n",
    old: "",
    neu: "That sentence describes 3.1.0. 3.2.0 changes two production scripts for other reasons (policy baseline recognition and installer-backup reporting) and still adds no atomic stamp binding.\n",
    after: "",
  }),

  // references/modes.md
  MD320_1: Object.freeze({
    file: "references/modes.md",
    before: "agents, Codex, or PS followed by BS, and did not verify the 3.1 pointer workflow.\n",
    old: "",
    neu: "The 3.1.0 live acceptance (2026-11-14 to 2026-11-22) later exercised the agents on both hosts\nand PS followed by BS (merge branch only); see RELEASE-NOTES-3.1.0.md.\n",
    after: "",
  }),
  MD320_3: Object.freeze({
    file: "references/modes.md",
    before: "",
    old: "",
    neu: "The \"required source-template content\" in the table above is the template claude block\nwith the Subagents line selected under \"Subagents line variants\" in\nreferences/docs-generation.md. In a partial agent layer the full-layer line is not the\nexpected content.\n\n",
    after: "Before candidate PS, record:\n",
  }),
  MD320_2: Object.freeze({
    file: "references/modes.md",
    before: "",
    old: "",
    neu: "An edit made by an agent inside a managed block is an `edited-by-user` block like any\nother: validate warns `drift`, and the next update MUST show the installed text next to\nthe new content and offer keep theirs, take new, or merge. Setup MUST NOT rewrite the\nblock without that disposition. Keep theirs leaves the block and its recorded hash\nunchanged, so the warning stays and the report MUST list the block as kept with drift.\n\n",
    after: "From a schema-2 manifest, also follow `references/migration-v2.md`: verify the shipped v2.0.0 comparison data with\n",
  }),

  // references/migration-v2.md
  MV320_1: Object.freeze({
    file: "references/migration-v2.md",
    before: "",
    old: "",
    neu: "`baseline` is one of `recorded`, `v2.0.0`, `shipped`, `v3.0.0`, `fresh` or `unknown`. `v3.0.0` means a `full`\nownership record whose hash is the default policy shipped by project-setup 3.0.0 and 3.1.0; its managed list is the\ncurrent default without the entries added in 3.2.0 (`env/**` and `cert/**`, both root-anchored).\n\n",
    after: "Write the user's decisions to `.ai/.run/<id>/security-decisions.json`, with exactly:\n",
  }),
  MV320_2: Object.freeze({
    file: "references/migration-v2.md",
    before: "",
    old: "",
    neu: "A project fresh-installed by project-setup 3.0.0 or 3.1.0 whose policy record carries the hash of that default\n(baseline `v3.0.0`) is offered exactly the two new coverage rows, root `env/**` and root `cert/**`. `include` is the\nrecommended choice for each, and `omit` is recorded as an explicit omission that a later report honours. An omission\ndoes not remove setup's own refusal to read those paths, because setup scripts refuse a path matched by the shipped\ndefaults or by the installed policy (`references/security.md` section 1).\n\n",
    after: "Metadata-only runs and unchanged policy content do not trigger the policy migration workflow\n",
  }),

  // references/security.md
  SE320_1: Object.freeze({
    file: "references/security.md",
    before: "",
    old: "",
    neu: "Since 3.2.0 the shipped defaults also cover the root `env/` and `cert/` directories (`env/**` and `cert/**`). Both\nare root-anchored on purpose: `**/env/**` would also match configuration code such as `src/config/env/*.ts`, which\nsetup reads for variable names. Setup scripts refuse paths under root `env/` and `cert/` from the moment 3.2.0 is\ninstalled, whatever the project decides for the two coverage rows, because setup's refusal set is the union of the\nshipped defaults and the installed policy (first paragraph above). An `omit` decision declines the managed coverage\nonly: an identity the project already holds in `projectPatterns` keeps protecting, and the controls derived from it\nremain.\n\n",
    after: "Removing an installed `projectPatterns` entry is a manual edit outside setup. The apply gate refuses that removal\n",
  }),

  // references/claude.md
  CM320_1: Object.freeze({
    file: "references/claude.md",
    before: "  writes it (write denylist).\n",
    old: "",
    neu: "- Claude Code 2.1.325 to 2.1.330 listed an installer backup (`.project-setup.bak-*`, inside the skills\n  directory) as another `project-setup` skill. `detect.mjs` reports such backups in `installerBackups`\n  with one warning per tool. Move each backup directory together with its `.meta.json` sibling out of\n  the skills directory and record the original path; before `install.mjs rollback`, move both back\n  unmodified (rollback verifies the recorded digest). Confirm one active copy in a new session.\n  Whether Codex discovers an installer backup as a skill is unverified.\n",
    after: "",
  }),

  // assets/agents/reviewer.md
  RV320_1: Object.freeze({
    file: "assets/agents/reviewer.md",
    before: "",
    old: "",
    neu: "Money and state integrity are the exception. Code in the reviewed change that breaks a\ncritical rule in AGENTS.md, whatever its wording, or a MUST-level rule in the documents\nit names or in the project review rules, for a money, balance, payment, points or limit\nflow is a finding whatever its current reachability: for example a read-modify-write\nwithout a lock or atomic statement, or a retry without proven idempotency. You MUST rate\nit HIGH or CRITICAL. A missing caller, route or funding path MUST NOT lower that severity\nor move it to Open questions, because such code is one wiring change away from moving\nmoney and the change that wires it is rarely reviewed against this code's locking.\nState the missing reachability in the Scenario (the interleaving once the code is\ncalled) and in Confidence. Classify it **likely risk** while nothing calls it and\n**confirmed bug** when something does. For these flows this paragraph overrides the\nreachability rule above, the \"caller that does not exist\" sentence below, the\nopen-question rule of section 4 as far as it concerns reachability, and the verdict\nrule of section 5 as stated there. A project rule MUST NOT relax this paragraph; on\nconflict follow this paragraph and report the conflict.\n\n",
    after: "Plan coverage is not a correctness boundary. Report a reachable defect even when it is outside\n",
  }),
  RV320_2: Object.freeze({
    file: "assets/agents/reviewer.md",
    before: "4. Verdict: **block** (any confirmed CRITICAL/HIGH bug or vulnerability), **approve with changes**, or **approve**.\n",
    old: "",
    neu: "   A money or state-integrity finding rated HIGH or CRITICAL under the exception in\n   section 2 makes the verdict **block**, including when it is classified likely risk.\n",
    after: "",
  }),

  // assets/templates/CLAUDE.md
  CT320_1: Object.freeze({
    file: "assets/templates/CLAUDE.md",
    before: "",
    old: "",
    neu: "- For a delegated agent this bullet replaces the directory comparison above. A delegated\n  agent's context or brief MAY show the directory its parent was in rather\n  than the session's original start directory. As a delegated agent you MUST treat the\n  original start directory as unknown unless the brief states it. You MUST NOT refuse on\n  your own working directory alone, and when the brief does not state the original start\n  directory you MUST state in your output that it was not given. This prevents a false\n  launch refusal after the parent changed directory inside a root-started session. If\n  the brief states an original start directory strictly below the selected rule's\n  directory, the refusal above applies unchanged. The parent session stays bound by\n  this rule.\n",
    after: "- A sibling worktree uses its own rule and root. A root-started session may later change\n",
  }),

  // assets/templates/AGENTS.md
  AT320_2: Object.freeze({
    file: "assets/templates/AGENTS.md",
    before: "",
    old: "",
    neu: "\nWhen you delegate to `reviewer` or `docs-sync`, state in every brief the session's\noriginal start directory, the repository root and the current directory. Do not invent\na start directory you were not given; say that it is unknown instead.\n",
    after: "<!-- project-setup:end id=agents -->\n",
  }),
  AT320_1: Object.freeze({
    file: "assets/templates/AGENTS.md",
    before: "",
    old: "",
    neu: "\nText between `<!-- project-setup:begin ... -->` and `<!-- project-setup:end ... -->`\nmarkers in AGENTS.md, CLAUDE.md and .gitignore is managed by project-setup. Every\nagent, including a retained project agent that does not load a canonical definition,\nMUST NOT add, remove or move these markers, and MUST change text inside a block only\nwhen a code change makes that text wrong. It MUST then name the file and the block\nid in its output, because the next project-setup update shows that edit for a keep,\ntake-new or merge decision and can otherwise replace it.\n",
    after: "<!-- project-setup:end id=agents -->\n",
  }),

  // data/secret-paths.json
  SP320_1: Object.freeze({
    file: "data/secret-paths.json",
    before: "",
    old: "",
    neu: "    {\n      \"glob\": \"env/**\",\n      \"kind\": \"dir\",\n      \"note\": \"Root env/ directory. Root-anchored: config code under src/ is not matched.\"\n    },\n    {\n      \"glob\": \"cert/**\",\n      \"kind\": \"dir\",\n      \"note\": \"Root cert/ directory.\"\n    },\n",
    after: "    {\n      \"glob\": \"**/.aws/**\",\n",
  }),

  // scripts/detect.mjs
  DT320_1: Object.freeze({
    file: "scripts/detect.mjs",
    before: "",
    old: "",
    neu: "/**\n * 3.2.0 (plan A5): installer leftovers that a host can list as a second project-setup skill. Scans the top-level\n * entries of one skills base only (no recursion) and returns the real directories (links are skipped, not followed)\n * whose name matches ^\\.project-setup\\.(bak|rolledback)- and which contain SKILL.md, each as { dir, kind }.\n * Reads entry names and the existence of SKILL.md only, never file content. An unreadable base gives no entry.\n */\nconst LEFTOVER_NAME = /^\\.project-setup\\.(bak|rolledback)-/;\nfunction scanInstallerLeftovers(base) {\n  let entries = [];\n  try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch { return []; }\n  const found = [];\n  for (const e of entries) {\n    if (e.isSymbolicLink() || !e.isDirectory()) continue;\n    const m = LEFTOVER_NAME.exec(e.name);\n    if (!m) continue;\n    const dir = path.join(base, e.name);\n    if (fs.existsSync(path.join(dir, 'SKILL.md'))) found.push({ dir, kind: m[1] });\n  }\n  return found;\n}\n\n",
    after: "function readJsonQuiet(p) { try { return readJsonFile(p); } catch { return null; } }\n",
  }),
  DT320_2: Object.freeze({
    file: "scripts/detect.mjs",
    before: "",
    old: "",
    neu: "/**\n * 3.2.0 (plan A5): installer backups inside the skills bases that findSkillInstalls scans (not the plugins base).\n * Kept apart from installs and installConflicts: their host identity and disabled state cannot be known from the\n * filesystem. Sorted by path, deduplicated by canonical path per tool.\n */\nfunction findInstallerBackups() {\n  const bases = [\n    { tool: 'claude', scope: 'user', base: path.join(claudeHome, 'skills') },\n    { tool: 'claude', scope: 'repo', base: path.join(root, '.claude', 'skills') },\n    { tool: 'codex', scope: 'user', base: path.join(home, '.agents', 'skills') },\n    { tool: 'codex', scope: 'user-legacy', base: path.join(codexHome, 'skills') },\n    { tool: 'codex', scope: 'repo', base: path.join(root, '.agents', 'skills') },\n  ];\n  const out = [];\n  const seen = new Set();\n  for (const b of bases) {\n    for (const { dir, kind } of scanInstallerLeftovers(b.base)) {\n      const key = `${b.tool}|${canonicalPath(dir)}`;\n      if (seen.has(key)) continue; // same directory reached twice (e.g. CODEX_HOME == ~/.agents) is one entry\n      seen.add(key);\n      out.push({ tool: b.tool, scope: b.scope, path: toPosix(dir), kind });\n    }\n  }\n  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));\n}\n\n",
    after: "// ---- mode classification (evidence-based) --------------------------------------\n",
  }),
  DT320_3: Object.freeze({
    file: "scripts/detect.mjs",
    before: "",
    old: "",
    neu: "const installerBackups = findInstallerBackups();\nfor (const tool of ['claude', 'codex']) {\n  const mine = installerBackups.filter((b) => b.tool === tool).map((b) => b.path);\n  if (mine.length > 0) warnings.push(`${tool}: ${mine.length} project-setup installer backup(s) with SKILL.md are inside the skills directory (${mine.join('; ')}); the host can list each as another project-setup skill. Move them out of the skills directory, move them back before install.mjs rollback, and confirm one active copy in a new session`);\n}\n",
    after: "// C7 plan 3.5: the allow warn and fail details last, in result order; the personal-settings info row is never a warning.\n",
  }),
  DT320_4: Object.freeze({
    file: "scripts/detect.mjs",
    before: "",
    old: "",
    neu: "  installerBackups,\n",
    after: "  invalidOverrides,\n",
  }),

  // scripts/migrate-security-paths.mjs
  MS320_1: Object.freeze({
    file: "scripts/migrate-security-paths.mjs",
    before: "",
    old: "",
    neu: "//   - 3.2.0 adds one recognized baseline, v3.0.0 (plan docs/plans/2026-11-22-project-setup-v3.2.0-plan.md A4): a full\n//     record whose hash is the default policy shipped by 3.0.0 and 3.1.0 (PRIOR_SHIPPED.sha256). Its list is the\n//     current default minus exactly the identities 3.2.0 added (PRIOR_SHIPPED.added: root env/** and cert/**), so\n//     such a fresh install is offered only the new coverage instead of an unknown baseline. No input field and no\n//     caller changes; the derivation is skipped unless the desired policy holds every added identity.\n",
    after: "//   - A broader replacement (**/.env* for **/.env and **/.env.*) is a NEW decision. An old omission neither omits nor\n",
  }),
  MS320_2: Object.freeze({
    file: "scripts/migrate-security-paths.mjs",
    before: "const ENV_OLD = [policyEntryKey({ anchor: 'any', glob: '**/.env' }), policyEntryKey({ anchor: 'any', glob: '**/.env.*' })];\n",
    old: "",
    neu: "// 3.2.0: the default policy shipped by 3.0.0 and 3.1.0 is the current default minus exactly these identities.\nconst PRIOR_SHIPPED = Object.freeze({\n  name: 'v3.0.0',\n  sha256: '37711ab7b8e1781ce533c705971f93351f1331a44b16e11e846080eb8fed1a79',\n  added: Object.freeze([policyEntryKey({ anchor: 'root', glob: 'env/**' }), policyEntryKey({ anchor: 'root', glob: 'cert/**' })]),\n});\n",
    after: "",
  }),
  MS320_3: Object.freeze({
    file: "scripts/migrate-security-paths.mjs",
    before: "",
    old: " * complete managed list), a full record hashing to v2 -> v2.0.0 (v2 wins a tie), to the current defaults -> shipped,\n * nothing at all -> fresh, anything else -> unknown.\n",
    neu: " * complete managed list), a full record hashing to v2 -> v2.0.0 (v2 wins a tie), to the current defaults -> shipped\n * (the current defaults win a tie with the prior default), to PRIOR_SHIPPED.sha256 -> v3.0.0, nothing at all -> fresh,\n * anything else -> unknown.\n * v3.0.0 means exactly: a full record whose hash is the default policy shipped by 3.0.0 and 3.1.0. Its list is derived\n * from the desired policy, not read from a file: the desired entries without the PRIOR_SHIPPED.added identities, in\n * desired order. The derivation runs only when the desired policy holds every added identity; otherwise there is no\n * prior list and such a record stays unknown (a desired policy without the additions is not the 3.2.0 default).\n",
    after: "",
  }),
  MS320_4: Object.freeze({
    file: "scripts/migrate-security-paths.mjs",
    before: "  const desired = readSecurityPolicy(input.desiredPolicy).policy.patterns;\n",
    old: "",
    neu: "  const desiredKeys = new Set(desired.map(K));\n  const priorList = PRIOR_SHIPPED.added.every((k) => desiredKeys.has(k)) ? desired.filter((e) => !PRIOR_SHIPPED.added.includes(K(e))) : null;\n",
    after: "",
  }),
  MS320_5: Object.freeze({
    file: "scripts/migrate-security-paths.mjs",
    before: "",
    old: "",
    neu: "  } else if (rec && rec.ownership === 'full' && rec.sha256 === PRIOR_SHIPPED.sha256 && priorList !== null) {\n    baseline = PRIOR_SHIPPED.name; list = priorList; baselineSha256 = PRIOR_SHIPPED.sha256;\n",
    after: "  } else if (!cur && !rec) baseline = 'fresh';\n",
  }),

  // tests/bs-doc-map.test.mjs
  BT320_3: Object.freeze({
    file: "tests/bs-doc-map.test.mjs",
    before: "",
    old: "",
    neu: "// ============================================================== GROUPS: 3.2.0 A1, A3 and B2 (the live helper and the instruction contract) ====\n// Plan docs/plans/2026-11-22-project-setup-v3.2.0-plan.md: A1 (AC-A1-2 to 7), A3 (AC-A3-1 to 3), B2 (AC-B2-2). The helper checkers are test-only (tests/live/bs-doc-map.mjs) and are exercised on\n// literal inputs; the instruction-contract checks read the SHIPPED references and are red until the implement lane ships the text (expected, plan C2, \"tests lane runs first\").\n// The closed sets below are an independent copy of the plan's text: a typo in the helper or in a reference shows up as a difference, not as agreement with itself.\nconst A1_LAYERS = ['full', 'docs-sync-retained', 'reviewer-retained', 'both-retained'];\nconst A1_LINES = {\n  full: '- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; both load their canonical definition from `.ai/agents/`.',\n  'docs-sync-retained': '- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; only `reviewer` loads its canonical definition from `.ai/agents/`. `docs-sync` is a retained project agent (incomplete project-setup agent update).',\n  'reviewer-retained': '- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; only `docs-sync` loads its canonical definition from `.ai/agents/`. `reviewer` is a retained project agent (incomplete project-setup agent update).',\n  'both-retained': '- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; both are retained project agents and neither loads a canonical definition from `.ai/agents/` (incomplete project-setup agent update).',\n};\nconst A1_SENTENCES = {\n  'docs-sync-retained': 'Exception in Claude Code: `docs-sync` is a retained project agent and does not load its canonical definition (incomplete project-setup agent update).',\n  'reviewer-retained': 'Exception in Claude Code: `reviewer` is a retained project agent and does not load its canonical definition (incomplete project-setup agent update).',\n  'both-retained': 'Exception in Claude Code: `reviewer` and `docs-sync` are retained project agents and do not load their canonical definitions (incomplete project-setup agent update).',\n};\nconst PARTIAL_LAYERS = A1_LAYERS.filter((l) => l !== 'full');\n// [AT320_1] and [AT320_2] (plan A2 item 1 and B2): the two paragraphs that follow the layer sentence in the 3.2.0 agents block. [AT320_1] says \"retained project agent\" in its own words.\nconst AT320_1 = ['Text between `<!-- project-setup:begin ... -->` and `<!-- project-setup:end ... -->`', 'markers in AGENTS.md, CLAUDE.md and .gitignore is managed by project-setup. Every', 'agent, including a retained project agent that does not load a canonical definition,', 'MUST NOT add, remove or move these markers, and MUST change text inside a block only', 'when a code change makes that text wrong. It MUST then name the file and the block', 'id in its output, because the next project-setup update shows that edit for a keep,', 'take-new or merge decision and can otherwise replace it.'].join('\\n');\nconst AT320_2 = ['When you delegate to `reviewer` or `docs-sync`, state in every brief the session\\'s', 'original start directory, the repository root and the current directory. Do not invent', 'a start directory you were not given; say that it is unknown instead.'].join('\\n');\nconst LAYER_ANCHOR = 'Do not create an ad-hoc agent for the same job.'; // assets/templates/AGENTS.md:79, the sentence every layer sentence follows\nconst claudeForLayer = (layer, base = MERGED_CLAUDE) => base.replace(A1_LINES.full, A1_LINES[layer]);\nconst agentsWithSentence = (text, sentence) => text.replace(LAYER_ANCHOR, `${LAYER_ANCHOR}\\n${sentence}`);\n// The 3.2.0 shape of the agents block: line 79, the layer sentence when there is one, then [AT320_2], then [AT320_1] (fixed order, plan A1 item 2 and R2-10). The shipped template already carries\n// the two paragraphs after line 79, so they are added only when the template lacks them (a second copy would give a block that no setup writes).\nconst withParagraphs = (text) => (text.includes(AT320_1) && text.includes(AT320_2) ? text : text.replace(LAYER_ANCHOR, `${LAYER_ANCHOR}\\n\\n${AT320_2}\\n\\n${AT320_1}`));\nconst agents320 = (layer) => { const base = withParagraphs(renderAgents(false)); return layer === 'full' ? base : base.replace(LAYER_ANCHOR, `${LAYER_ANCHOR}\\n${A1_SENTENCES[layer]}`); };\nconst rcLayer = (text, layer) => H.checkClaudeRecovery({ text, templateText: PS_CLAUDE_TEMPLATE, bsImports: BS_IMPORTS, bsVersionSentence: BS_SENTENCE, userLines: [USER_LINE], ...(layer === undefined ? {} : { agentLayer: layer }) });\nconst lfT = (s) => String(s).replace(/\\r\\n?/g, '\\n');\nconst squashT = (s) => lfT(s).replace(/\\s+/g, ' ').trim();\nconst codeOf = (fn) => { try { fn(); return null; } catch (e) { return e.code ?? String(e.message); } };\n{\n  const G = grp('3.2.0 A1: partial agent layers');\n  G('preconditions: the template Subagents line is the full-layer line (found by content, once) and the merged fixture carries it once', PS_CLAUDE_TEMPLATE.split('\\n').filter((l) => l === A1_LINES.full).length === 1 && MERGED_CLAUDE.split(A1_LINES.full).length === 2);\n  G('the four lines are distinct, ASCII and one line each (the closed set of plan A1 item 2)', new Set(Object.values(A1_LINES)).size === 4 && Object.values(A1_LINES).every((l) => /^[\\x20-\\x7e]+$/.test(l) && l.startsWith('- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; ')) && new Set(Object.values(A1_SENTENCES)).size === 3 && Object.values(A1_SENTENCES).every((l) => /^[\\x20-\\x7e]+$/.test(l)));\n  G('the helper constants equal this spec\\'s independent copy of the plan text (four layers in order, four lines, three sentences)', JSON.stringify(H.AGENT_LAYERS) === JSON.stringify(A1_LAYERS) && JSON.stringify(H.SUBAGENTS_LINES) === JSON.stringify(A1_LINES) && JSON.stringify(H.AGENTS_LAYER_SENTENCES) === JSON.stringify(A1_SENTENCES), { layers: H.AGENT_LAYERS });\n  G('the layer sentences name no file path in backticks (reference-exists gets no new target) and each begins \"Exception in Claude Code:\"', Object.values(A1_SENTENCES).every((s) => s.startsWith('Exception in Claude Code: ') && [...s.matchAll(/`([^`]+)`/g)].every((m) => !/[/.]/.test(m[1]))));\n  // AC-A1-2: the 4 x 4 matrix. A block is accepted under exactly the layer whose line it carries, so exactly four blocks are accepted in total.\n  for (const layer of A1_LAYERS) for (const line of A1_LAYERS) {\n    const f = rcLayer(claudeForLayer(line), layer);\n    G(`AC-A1-2: under the ${layer} layer a block with the ${line} Subagents line ${layer === line ? 'has no findings' : 'is claude-block-content and nothing else'}`, layer === line ? f.length === 0 : f.length === 1 && has(f, 'claude-block-content'), f);\n  }\n  G('AC-A1-2: the layer defaults to full (no argument): the full block passes and a partial line is claude-block-content', rcLayer(MERGED_CLAUDE, undefined).length === 0 && PARTIAL_LAYERS.every((l) => has(rcLayer(claudeForLayer(l), undefined), 'claude-block-content')));\n  // AC-A1-3: a fifth wording (one character changed) is rejected under every layer.\n  const ONE_CHAR = [['the final period is a comma', (s) => s.replace(/\\.$/, ',')], ['\"canonical\" has a capital I for the l', (s) => s.replace('canonical', 'canonicaI')], ['\"Subagents\" ends in the digit 5', (s) => s.replace('Subagents', 'Subagent5')]];\n  for (const line of A1_LAYERS) for (const [what, fn] of ONE_CHAR) {\n    const mutated = fn(A1_LINES[line]);\n    G(`AC-A1-3: a fifth wording (the ${line} line, ${what}) is claude-block-content under every layer`, mutated !== A1_LINES[line] && A1_LAYERS.every((layer) => has(rcLayer(MERGED_CLAUDE.replace(A1_LINES.full, mutated), layer), 'claude-block-content')));\n  }\n  // AC-A1-4: the block mutants of the root-start rule and of a weakened rule keep failing when a partial line is present (the partial line does not relax the rest of the block).\n  const BLOCK_MUTANTS = [['the root-start rule removed from the block', (t) => t.replace(\"You MUST start Claude Code at this repository's root.\", 'Start anywhere.')], ['a rule of the block weakened', (t) => t.replace('You MUST NOT infer a subdirectory start', 'You may infer a subdirectory start')]];\n  for (const layer of A1_LAYERS) {\n    G(`AC-A1-4: control: the unmutated ${layer} block has no findings`, rcLayer(claudeForLayer(layer), layer).length === 0);\n    for (const [what, fn] of BLOCK_MUTANTS) { const m = fn(claudeForLayer(layer)); G(`AC-A1-4: with the ${layer} line present, ${what} is claude-block-content`, m !== claudeForLayer(layer) && has(rcLayer(m, layer), 'claude-block-content')); }\n  }\n  G('AC-A1-4: the root-start rule duplicated outside the block is still duplicate-instructions under a partial layer', PARTIAL_LAYERS.every((l) => has(rcLayer(`${claudeForLayer(l)}\\nYou MUST start Claude Code at this repository's root.\\n`, l), 'duplicate-instructions')));\n  // Y inconsistent / boundary: an unknown layer compares nothing; a missing block is a block-count finding; a template without the Subagents line cannot be matched.\n  for (const bad of ['bogus', 'FULL', 'full ', '', null, 0]) G(`an unknown layer ${JSON.stringify(bad)} is the finding agent-layer and no block comparison is reported`, (() => { const f = rcLayer(MERGED_CLAUDE, bad); return has(f, 'agent-layer') && !has(f, 'claude-block-content'); })());\n  G('a missing claude block is claude-block-count under a partial layer (never a content finding)', PARTIAL_LAYERS.every((l) => { const f = rcLayer(MERGED_CLAUDE.replace(/<!-- project-setup:begin id=claude -->[\\s\\S]*<!-- project-setup:end id=claude -->\\n?/, ''), l); return has(f, 'claude-block-count') && !has(f, 'claude-block-content'); }));\n  G('a template with no Subagents line cannot yield a partial block: the partial layers are claude-block-content, the full layer is judged on the template as it is', PARTIAL_LAYERS.every((l) => has(H.checkClaudeRecovery({ text: claudeForLayer(l), templateText: PS_CLAUDE_TEMPLATE.replace(`${A1_LINES.full}\\n`, ''), bsImports: BS_IMPORTS, bsVersionSentence: BS_SENTENCE, userLines: [USER_LINE], agentLayer: l }), 'claude-block-content')));\n  // AC-A1-6: agentLayerOf.\n  const ag = (r, d) => ({ reviewer: { disposition: r }, 'docs-sync': { disposition: d } });\n  const TX = (rt, dt) => ({ reviewer: rt, 'docs-sync': dt });\n  const CANON_R = `${WRAPPER.reviewer}\\n## Project rules\\nkeep\\n`;\n  const CANON_D = `${WRAPPER['docs-sync']}\\n## Project rules\\nkeep\\n`;\n  G('AC-A1-6: take-new and take-new is full', H.agentLayerOf(ag('take-new', 'take-new'), TX(WRAPPER.reviewer, WRAPPER['docs-sync'])) === 'full');\n  G('AC-A1-6: take-new and keep is docs-sync-retained; keep and take-new is reviewer-retained; keep and keep is both-retained', H.agentLayerOf(ag('take-new', 'keep'), TX(WRAPPER.reviewer, BS_AGENT['docs-sync'])) === 'docs-sync-retained' && H.agentLayerOf(ag('keep', 'take-new'), TX(BS_AGENT.reviewer, WRAPPER['docs-sync'])) === 'reviewer-retained' && H.agentLayerOf(ag('keep', 'keep'), TX(BS_AGENT.reviewer, BS_AGENT['docs-sync'])) === 'both-retained');\n  G('AC-A1-6: merge is canonical only when the installed text still references .ai/agents/<name>.md (reviewer, with docs-sync take-new)', H.agentLayerOf(ag('merge', 'take-new'), TX(CANON_R, WRAPPER['docs-sync'])) === 'full' && H.agentLayerOf(ag('merge', 'take-new'), TX(BS_AGENT.reviewer, WRAPPER['docs-sync'])) === 'reviewer-retained');\n  G('AC-A1-6: merge is canonical only when the installed text still references .ai/agents/<name>.md (docs-sync, with reviewer take-new)', H.agentLayerOf(ag('take-new', 'merge'), TX(WRAPPER.reviewer, CANON_D)) === 'full' && H.agentLayerOf(ag('take-new', 'merge'), TX(WRAPPER.reviewer, BS_AGENT['docs-sync'])) === 'docs-sync-retained');\n  G('AC-A1-6: both merged: both references give full, neither gives both-retained, one gives the other agent as retained', H.agentLayerOf(ag('merge', 'merge'), TX(CANON_R, CANON_D)) === 'full' && H.agentLayerOf(ag('merge', 'merge'), TX(BS_AGENT.reviewer, BS_AGENT['docs-sync'])) === 'both-retained' && H.agentLayerOf(ag('merge', 'merge'), TX(CANON_R, BS_AGENT['docs-sync'])) === 'docs-sync-retained' && H.agentLayerOf(ag('merge', 'merge'), TX(BS_AGENT.reviewer, CANON_D)) === 'reviewer-retained');\n  G('AC-A1-6: a merge whose text references only the OTHER agent\\'s definition, an absent text, or no texts at all is retained', H.agentLayerOf(ag('merge', 'take-new'), TX('see .ai/agents/docs-sync.md', WRAPPER['docs-sync'])) === 'reviewer-retained' && H.agentLayerOf(ag('merge', 'take-new'), TX(null, WRAPPER['docs-sync'])) === 'reviewer-retained' && H.agentLayerOf(ag('merge', 'take-new'), undefined) === 'reviewer-retained' && H.agentLayerOf(ag('merge', 'take-new'), {}) === 'reviewer-retained');\n  G('AC-A1-6: the disposition decides for take-new and keep, never the installed text (a kept agent whose text names the canonical file is still retained)', H.agentLayerOf(ag('keep', 'take-new'), TX(WRAPPER.reviewer, WRAPPER['docs-sync'])) === 'reviewer-retained' && H.agentLayerOf(ag('take-new', 'take-new'), TX(BS_AGENT.reviewer, BS_AGENT['docs-sync'])) === 'full');\n  G('AC-A1-6: an unknown or missing disposition, or a missing agent, is the coded error AGENT_LAYER (a layer is never guessed)', [ag('maybe', 'take-new'), ag('take-new', undefined), ag('', 'keep'), { reviewer: { disposition: 'take-new' } }, {}, null].every((e) => codeOf(() => H.agentLayerOf(e, TX(WRAPPER.reviewer, WRAPPER['docs-sync']))) === 'AGENT_LAYER'));\n  // AC-A1-5: checkAgentsLayerSentence, on the template agents block as it is and on its 3.2.0 shape (the A2 paragraph says \"retained project agent\" and must not count).\n  const SC = (text, layer) => H.checkAgentsLayerSentence({ agentsText: text, agentLayer: layer });\n  const BASE_AGENTS = renderAgents(false);\n  G('AC-A1-5: precondition: the layer anchor is on one line of the template agents block', BASE_AGENTS.split(LAYER_ANCHOR).length === 2);\n  G('AC-A1-5: the four correct cases pass (no sentence in the full layer, the matching sentence in each partial layer)', SC(BASE_AGENTS, 'full').length === 0 && PARTIAL_LAYERS.every((l) => SC(agentsWithSentence(BASE_AGENTS, A1_SENTENCES[l]), l).length === 0));\n  G('AC-A1-5: the four correct cases pass in the 3.2.0 shape (sentence, then [AT320_2], then [AT320_1]); the A2 paragraph is not a layer sentence', A1_LAYERS.every((l) => SC(agents320(l), l).length === 0), A1_LAYERS.map((l) => SC(agents320(l), l)));\n  G('AC-A1-5: a missing sentence is the finding in each partial layer (the template block, and the 3.2.0 block without it)', PARTIAL_LAYERS.every((l) => SC(BASE_AGENTS, l).some((f) => f.code === 'agents-layer-sentence') && SC(agents320('full'), l).some((f) => f.code === 'agents-layer-sentence')));\n  G('AC-A1-5: a sentence in the full layer is the finding (each of the three)', PARTIAL_LAYERS.every((l) => SC(agentsWithSentence(BASE_AGENTS, A1_SENTENCES[l]), 'full').some((f) => f.code === 'agents-layer-sentence')));\n  for (const layer of PARTIAL_LAYERS) for (const other of PARTIAL_LAYERS.filter((x) => x !== layer)) G(`AC-A1-5: under ${layer} the ${other} sentence is the finding`, SC(agentsWithSentence(BASE_AGENTS, A1_SENTENCES[other]), layer).some((f) => f.code === 'agents-layer-sentence'));\n  G('AC-A1-5: two sentences are the finding (the right one twice; the right one and another layer\\'s)', PARTIAL_LAYERS.every((l) => { const s = A1_SENTENCES[l]; const o = A1_SENTENCES[PARTIAL_LAYERS.find((x) => x !== l)]; return SC(agentsWithSentence(BASE_AGENTS, `${s}\\n${s}`), l).length > 0 && SC(agentsWithSentence(BASE_AGENTS, `${s}\\n${o}`), l).length > 0; }));\n  for (const layer of PARTIAL_LAYERS) for (const [what, fn] of [['the final period is a comma', (s) => s.replace(/\\.$/, ',')], ['the first word has an l for the i', (s) => s.replace('Exception', 'Exceptlon')], ['\"canonical\" has a capital I for the l', (s) => s.replace('canonical', 'canonicaI')]]) {\n    const near = fn(A1_SENTENCES[layer]);\n    G(`AC-A1-5: under ${layer} a sentence with one changed character (${what}) is the finding, and so is it in the full layer`, near !== A1_SENTENCES[layer] && SC(agentsWithSentence(BASE_AGENTS, near), layer).length > 0 && SC(agentsWithSentence(BASE_AGENTS, near), 'full').length > 0);\n  }\n  G('AC-A1-5: a sentence outside the agents block, inside an HTML comment, or wrapped over two lines does not count as the sentence', PARTIAL_LAYERS.every((l) => { const s = A1_SENTENCES[l]; const half = s.indexOf(' and '); return SC(`${BASE_AGENTS}\\n${s}\\n`, l).length > 0 && SC(agentsWithSentence(BASE_AGENTS, `<!-- ${s} -->`), l).length > 0 && SC(agentsWithSentence(BASE_AGENTS, `${s.slice(0, half)}\\n${s.slice(half + 1)}`), l).length > 0; }));\n  G('AC-A1-5: a broken agents block (a missing end marker) and an unknown layer are findings, never a pass', SC(BASE_AGENTS.replace('<!-- project-setup:end id=agents -->', ''), 'full').length > 0 && SC(BASE_AGENTS, 'bogus').length > 0 && SC(BASE_AGENTS, undefined).length > 0);\n  // R3 (plan A1 item 2, 11.1 R2-10): position. The sentence is the line directly after the template sentence and before both template paragraphs. The right sentence exactly once in a wrong place\n  // is reported by its position alone: the sentence checks above are satisfied, so only a position finding can fail these cases.\n  const END_AGENTS = '<!-- project-setup:end id=agents -->';\n  const reEsc = (s) => s.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');\n  const count = (hay, needle) => hay.split(needle).length - 1;\n  const posF = (text, l) => SC(text, l).filter((x) => x.code === 'agents-layer-sentence' && x.detail.startsWith('position:'));\n  const onlyPos = (text, l) => { const all = SC(text, l); return all.length > 0 && all.length === posF(text, l).length; };\n  const WRONG = [\n    ['before the template sentence (on the line before it)', (l) => agents320('full').replace(new RegExp(`^(.*${reEsc(LAYER_ANCHOR)})$`, 'm'), `${A1_SENTENCES[l]}\\n$1`), ['before the template sentence'], []],\n    ['after both template paragraphs (last line of the block)', (l) => agents320('full').replace(END_AGENTS, `${A1_SENTENCES[l]}\\n${END_AGENTS}`), ['after the delegation paragraph', 'after the managed-block marker paragraph'], ['before the template sentence']],\n    ['between the two template paragraphs', (l) => agents320('full').replace(`${AT320_2}\\n\\n${AT320_1}`, `${AT320_2}\\n\\n${A1_SENTENCES[l]}\\n\\n${AT320_1}`), ['after the delegation paragraph'], ['after the managed-block marker paragraph', 'before the template sentence']],\n    ['between the two template paragraphs with no blank line above it', (l) => agents320('full').replace(`${AT320_2}\\n\\n${AT320_1}`, `${AT320_2}\\n${A1_SENTENCES[l]}\\n\\n${AT320_1}`), ['after the delegation paragraph'], ['after the managed-block marker paragraph']],\n    ['separated from the template sentence by a blank line', (l) => agents320('full').replace(LAYER_ANCHOR, `${LAYER_ANCHOR}\\n\\n${A1_SENTENCES[l]}`), ['line(s) after the line of the template sentence'], ['before the template sentence']],\n    ['directly after the delegation paragraph with the template sentence moved below the paragraphs', (l) => agents320('full').replace(LAYER_ANCHOR, 'Agents are named in the lists above.').replace(END_AGENTS, `${LAYER_ANCHOR}\\n${A1_SENTENCES[l]}\\n${END_AGENTS}`), ['after the delegation paragraph', 'after the managed-block marker paragraph'], []],\n  ];\n  G('R3: precondition: the base block holds the template sentence once, then [AT320_2] once, then [AT320_1] once (no paragraph is doubled)', (() => { const b = agents320('full'); return count(b, LAYER_ANCHOR) === 1 && count(b, AT320_2) === 1 && count(b, AT320_1) === 1 && b.indexOf(LAYER_ANCHOR) < b.indexOf(AT320_2) && b.indexOf(AT320_2) < b.indexOf(AT320_1); })(), { anchor: count(agents320('full'), LAYER_ANCHOR), at2: count(agents320('full'), AT320_2), at1: count(agents320('full'), AT320_1) });\n  G('R3: control: the sentence in its place (directly after the template sentence, before both paragraphs) has no finding in each partial layer', PARTIAL_LAYERS.every((l) => SC(agents320(l), l).length === 0));\n  for (const [label, build, must, mustNot] of WRONG) {\n    G(`R3: the right sentence ${label} is a position finding and nothing else, in each partial layer`, PARTIAL_LAYERS.every((l) => { const t = build(l); const d = posF(t, l).map((x) => x.detail).join('\\n'); return t !== agents320('full') && t.includes(A1_SENTENCES[l]) && onlyPos(t, l) && must.every((m) => d.includes(m)) && mustNot.every((m) => !d.includes(m)); }), PARTIAL_LAYERS.map((l) => SC(build(l), l)));\n  }\n  G('R3: a block without the template sentence cannot place the layer sentence: a position finding in each partial layer (the sentence itself is right)', PARTIAL_LAYERS.every((l) => { const t = agents320(l).replace(LAYER_ANCHOR, 'Create agents freely.'); return t !== agents320(l) && onlyPos(t, l) && posF(t, l)[0].detail.includes(LAYER_ANCHOR); }), PARTIAL_LAYERS.map((l) => SC(agents320(l).replace(LAYER_ANCHOR, 'Create agents freely.'), l)));\n  G('R3: the full layer has no position rule (no sentence, no position finding, with or without the template sentence)', SC(agents320('full'), 'full').length === 0 && SC(agents320('full').replace(LAYER_ANCHOR, 'Create agents freely.'), 'full').length === 0);\n  G('R3: the helper anchor equals this spec\\'s independent copy of the template sentence', H.AGENTS_LAYER_ANCHOR === LAYER_ANCHOR);\n  {\n    // Review pass 2: the order of the two template paragraphs ([AT320_2] then [AT320_1]) is enforced in every layer; a reversed pair is a position finding.\n    const swapAt = (t) => t.replace(AT320_2, () => '\\u0001SWAP\\u0001').replace(AT320_1, () => AT320_2).replace('\\u0001SWAP\\u0001', () => AT320_1);\n    G('R3: the two template paragraphs in reversed order are a position finding naming the order, in every layer (full included)', ['full', ...PARTIAL_LAYERS].every((l) => { const t = swapAt(agents320(l)); const d = SC(t, l).filter((x) => x.detail.startsWith('position:')).map((x) => x.detail).join('\\n'); return t !== agents320(l) && d.includes('managed-block marker paragraph is before the delegation paragraph'); }), ['full', ...PARTIAL_LAYERS].map((l) => SC(swapAt(agents320(l)), l)));\n    G('R3: the two template paragraphs in their order (control) have no order finding in every layer', ['full', ...PARTIAL_LAYERS].every((l) => !SC(agents320(l), l).some((x) => x.detail.includes('before the delegation paragraph'))));\n  }\n  // AC-A1-7: references/modes.md.\n  const MD320_3 = 'The \"required source-template content\" in the table above is the template claude block with the Subagents line selected under \"Subagents line variants\" in references/docs-generation.md. In a partial agent layer the full-layer line is not the expected content.';\n  const MODES = lfT(TXT.modes);\n  const ROW_94_SHA = '57edf86500b3f528962ad30b9399369f270c68ec7768f6f82a06abd986639ad1'; // the 3.1.0 table row of modes.md line 94, byte for byte (LF); it moves by the [MD320_1] insertion, so it is pinned by content\n  G('AC-A1-7: references/modes.md holds the [MD320_3] paragraph exactly once', squashT(MODES).split(squashT(MD320_3)).length === 2);\n  G('AC-A1-7: the paragraph follows the \"successful root recovery.\" paragraph and precedes \"Before candidate PS, record:\"', (() => { const s = squashT(MODES); const i = s.indexOf(squashT(MD320_3)); return i > s.indexOf('not successful root recovery.') && s.indexOf('not successful root recovery.') > 0 && i < s.indexOf('Before candidate PS, record:'); })());\n  G('AC-A1-7: the 3.1.0 table row (line 94, \"required source-template content\") is unchanged: exactly one line of modes.md has its digest', MODES.split('\\n').filter((l) => sha(l) === ROW_94_SHA).length === 1 && MODES.split('\\n').filter((l) => l.includes('required source-template content')).length === 2);\n}\n\n{\n  const G = grp('3.2.0 A3: applicability, configuration and strictness');\n  // ---- the instruction contract (AC-A3-1): the plan's exact texts, placed in the mapping section, in order, once. ----\n  const AP320 = [\n    '#### Applicability (one rule for every mode)', '',\n    'A mapped PS document is applicable when at least one of these holds:', '',\n    '1. Code evidence: the source named for that document in the tables above yields at', '   least one fact from permitted reads.',\n    '2. Source-section evidence: at least one of its mapped 03 sections resolves and its', '   body states at least one fact for the topic. A blank body, template placeholders', '   in angle brackets, or a table with no filled row is not a fact.',\n    '3. An existing document at the PS path, whoever wrote it. Existing-content', '   consolidation below applies before it becomes a pointer.', '',\n    'Phase 0 applicability is provisional. Setup MUST derive it only from what Phase 0 may', 'read: the manifest, the lockfile name, tsconfig.json, docker-compose structure, the', 'src/ tree listing, the framework entrypoint, detect output, existing documents and the', 'resolved 03 sections. Setup MUST show the provisional list in Phase 0 with the evidence', 'kind for each entry (tree listing, source section, existing document) or \"not', 'applicable: no evidence\", and MUST label it provisional. This rule adds no Phase 0 read.', '',\n    'Phase 1 confirms applicability with the evidence reads it already performs. Setup MUST', 'draft exactly the confirmed set. If the confirmed set differs from the list approved in', 'Phase 0, setup MUST stop and ask again, because a report that says \"skipped\" beside an', 'installed pointer cannot be reviewed.', '',\n    'Setup MUST apply this rule identically in every mode. The mode decides ownership and', 'the approval workflow; it never decides which documents exist.', '',\n    'For a document that is not applicable, setup MUST NOT write a pointer, MUST NOT add', 'content to 03 for that topic, and MUST remove the navigation row and any reference to', 'that path from the text it drafts, so validate does not fail on a missing target.', 'For an applicable document whose mapped section is blank while code evidence exists,', 'setup completes the section through the reviewed consolidation and identifies', 'unknowns explicitly. An installed pointer whose evidence later disappears is', 'preserved and reported; it is never deleted or expanded automatically, and no age', 'limit applies.', '',\n    '`docs/integrations/<vendor>.md` is decided per vendor. `docs/business-rules/<flow>.md`,', 'code patterns, development rules, ADRs and TODO.md keep their own rules above.', '',\n    'When the configuration document is applicable, setup MUST propose, through the reviewed', 'consolidation of the target project\\'s 03, a Configuration table with one row per', 'variable name evidenced by config or validation code or by', '`env-keys.mjs keys --template auto`, with: variable, required (yes, no, conditional', 'with the condition, or unknown), classification (secret or non-secret), used by,', 'description and source. Setup MUST make this proposal in adopt and in update alike. A', 'requiredness that the code does not establish is written `unknown` and listed in', 'TODO.md; it is never guessed. Values never appear. If the owner declines the proposal,', 'the configuration conversion is incomplete: setup keeps any original, writes no claim of', 'completion and reports it.', '',\n    'When `tsconfig.json` exists and the mapping is active, setup MUST propose, through the', 'same reviewed consolidation, a statement of the compiler strictness as written (`strict`', 'and each individual strict flag that is set, or \"strict not set\") under **CI/CD and', 'tooling**, taken from `tsconfig.json` only, in every mode. It is a stated value, never', 'an inference from code style. If the owner declines, setup reports the omission and', 'does not write it.',\n  ].join('\\n');\n  const DG320_3 = 'This applies when critical-modules is applicable under \"Applicability\" above. When it is not, remove the reference from the critical rule\\'s last sentence and the navigation row, keep the rule itself, and record the absence in TODO.md.';\n  const DG320_7 = 'That sentence describes 3.1.0. 3.2.0 changes two production scripts for other reasons (policy baseline recognition and installer-backup reporting) and still adds no atomic stamp binding.';\n  const SK320_2 = 'The assessment lists every mapped document as provisionally applicable (with its evidence kind) or not applicable, as defined in references/docs-generation.md (\"Applicability\"); Phase 1 confirms the list.';\n  // The sentences of 3.1.0 that stay (plan A3: \"Lines 257 and 259 are unchanged\", the :162 policy sentence, the :357 and :416 sentences).\n  const KEEP = [['line-257-kept', 'For an activated mapping, setup MUST generate each applicable mapped PS document as a pointer and consolidate its evidenced architectural facts into the mapped sections of 03, because separate detailed descriptions drift.'], ['line-259-kept', 'Setup MUST preserve the information requirements of the original PS document. A shorter BS table MUST NOT justify losing configuration inventories, transaction details, error transformations, integration safeguards or critical-module invariants.'], ['line-162-kept', 'This mapping is a documentation policy layered over the detected mode.'], ['line-357-kept', 'That document becomes a self-sufficient pointer.'], ['line-416-kept', 'This release adds neither atomic stamp binding nor a production-script change.']];\n  const flat = (doc) => squashT(lfT(doc).split('\\n').map((l) => l.replace(/^\\s*(?:>\\s?)+/, '')).join('\\n'));\n  /** The ids of the contract checks a docs-generation.md text does not meet ([] = all met). */\n  const apProblems = (doc) => {\n    const d = lfT(doc); const bad = []; const f = flat(d);\n    const n = f.split(squashT(AP320)).length - 1;\n    if (n !== 1) bad.push(n === 0 ? 'applicability-missing' : 'applicability-duplicated');\n    const sec = d.search(/^### Document mapping\\s*$/m); const end = d.search(/^### Pointer format\\s*$/m); const at = d.indexOf('#### Applicability (one rule for every mode)');\n    if (!(sec >= 0 && end > sec && at > sec && at < end)) bad.push('applicability-outside-mapping-section');\n    const i259 = d.indexOf('Setup MUST preserve the information requirements of the original PS document.');\n    if (!(i259 >= 0 && at > i259)) bad.push('applicability-order');\n    if (at >= 0 && end > at && /\\b(?:\\d+|two|three|four|five|six|seven|eight|nine|ten)\\s+modes\\b/i.test(d.slice(at, end))) bad.push('applicability-mode-count');\n    for (const [id, text] of KEEP) if (!f.includes(squashT(text))) bad.push(id);\n    const sec3 = d.search(/^## Documentation source of truth on backend-standards projects\\s*$/m); const sec4 = d.search(/^## Ownership hints\\s*$/m);\n    const i3 = d.indexOf(DG320_3); const i7 = d.indexOf(DG320_7);\n    // [DG320_3] sits after the :357 sentence, inside \"Conditional root routing\" (not in the mapping section, where the applicability rule is).\n    const secR = d.search(/^### Conditional root routing\\s*$/m); const secC = d.search(/^### Canonical agents and extensions\\s*$/m);\n    if (flat(d).split(squashT(DG320_3)).length !== 2 || !(secR >= 0 && secC > secR && i3 > secR && i3 < secC && i3 > d.indexOf(KEEP[3][1]) && i3 > sec3 && i3 < sec4)) bad.push('dg320-3');\n    if (flat(d).split(squashT(DG320_7)).length !== 2 || !(i7 > d.indexOf('This release adds neither atomic stamp binding') && i7 < sec4)) bad.push('dg320-7');\n    return bad;\n  };\n  // A reference document made of the plan's texts and the 3.1.0 sentences around them, independent of what the real file holds now.\n  const SYN = [\n    '# Generating documentation', '', '## Root AGENTS.md (template)', '', 'Reference text.', '',\n    '## Documentation source of truth on backend-standards projects', '', 'Intro.', '', KEEP[2][1], '',\n    '### Document mapping', '', `> ${KEEP[0][1]}`, '>', `> ${KEEP[1][1]}`, '', AP320, '', '### Pointer format', '', 'Reference text.', '',\n    '### Conditional root routing', '', `Preserve the existing money/auth critical rule. ${KEEP[3][1]}`, '', DG320_3, '', '### Canonical agents and extensions', '', 'Reference text.', '',\n    '### Source binding', '', `**Accepted limitation:** the stamp can change between that check and commit. ${KEEP[4][1]}`, '', DG320_7, '',\n    '## Ownership hints', '', 'Reference text.', '',\n  ].join('\\n');\n  const syn = (fn) => { const m = fn(SYN); return m === SYN ? null : m; };\n  const ids = (d) => (d === null ? null : apProblems(d));\n  G('AC-A3-1: the reference document built from the plan texts meets every contract check', JSON.stringify(apProblems(SYN)) === '[]', apProblems(SYN));\n  const real = apProblems(TXT.docs);\n  for (const id of ['applicability-missing', 'applicability-duplicated', 'applicability-outside-mapping-section', 'applicability-order', 'applicability-mode-count', ...KEEP.map(([k]) => k), 'dg320-3', 'dg320-7']) G(`AC-A3-1: references/docs-generation.md: ${id} is met`, !real.includes(id), real);\n  G('AC-A3-1: SKILL.md holds the [SK320_2] sentence exactly once', flat(TXT.skill).split(squashT(SK320_2)).length === 2);\n  G('AC-A3-1: the rule says \"every mode\" and pins no mode count (detect has seven modes; the text does not say how many)', AP320.includes('identically in every mode') && !/\\b(?:\\d+|two|three|four|five|six|seven|eight|nine|ten)\\s+modes\\b/i.test(AP320));\n  // The contract mutants (5.2 item 4 for the document side): each fails its own check on the reference document.\n  for (const [label, id, fn] of [\n    ['the rule removed', 'applicability-missing', (d) => d.replace(AP320, '')],\n    ['the rule written twice', 'applicability-duplicated', (d) => d.replace(AP320, `${AP320}\\n\\n${AP320}`)],\n    ['the rule placed in the Root AGENTS.md section, before the mapping section', 'applicability-outside-mapping-section', (d) => d.replace(`${AP320}\\n`, '').replace('Reference text.', `Reference text.\\n\\n${AP320}`)],\n    ['the rule placed after the Pointer format heading', 'applicability-outside-mapping-section', (d) => d.replace(`${AP320}\\n`, '').replace('### Pointer format\\n', `### Pointer format\\n\\n${AP320}\\n`)],\n    ['the rule placed before the line 259 paragraph', 'applicability-order', (d) => d.replace(`${AP320}\\n`, '').replace(`> ${KEEP[0][1]}`, `${AP320}\\n\\n> ${KEEP[0][1]}`)],\n    ['\"every mode\" weakened to \"adopt mode\"', 'applicability-missing', (d) => d.replace('identically in every mode', 'identically in adopt mode')],\n    ['\"MUST draft exactly the confirmed set\" weakened to SHOULD', 'applicability-missing', (d) => d.replace('Setup MUST\\ndraft exactly', 'Setup SHOULD\\ndraft exactly')],\n    ['\"MUST stop and ask again\" weakened to \"may note it\"', 'applicability-missing', (d) => d.replace('setup MUST stop and ask again', 'setup may note it')],\n    ['a mode count added to the rule', 'applicability-mode-count', (d) => d.replace('### Pointer format', 'Setup runs in seven modes.\\n\\n### Pointer format')],\n    ['the line 257 sentence removed', 'line-257-kept', (d) => d.replace(KEEP[0][1], '')],\n    ['the line 259 sentence removed', 'line-259-kept', (d) => d.replace(KEEP[1][1], '')],\n    ['the line 162 sentence removed', 'line-162-kept', (d) => d.replace(KEEP[2][1], '')],\n    ['the line 357 sentence removed', 'line-357-kept', (d) => d.replace(KEEP[3][1], '')],\n    ['the :416 sentence removed (the pin of tests/bs-doc-map.test.mjs clause C2.limitation)', 'line-416-kept', (d) => d.replace(KEEP[4][1], '')],\n    ['the [DG320_3] sentence removed', 'dg320-3', (d) => d.replace(DG320_3, '')],\n    ['the [DG320_3] sentence moved into the mapping section', 'dg320-3', (d) => d.replace(`${DG320_3}\\n`, '').replace('### Pointer format', `${DG320_3}\\n\\n### Pointer format`)],\n    ['the [DG320_7] sentence removed', 'dg320-7', (d) => d.replace(DG320_7, '')],\n    ['the [DG320_7] sentence placed before the :416 sentence', 'dg320-7', (d) => d.replace(`${DG320_7}\\n`, '').replace('**Accepted limitation:**', `${DG320_7}\\n\\n**Accepted limitation:**`)],\n  ]) G(`AC-A3-1 mutant: ${label} fails ${id}`, (() => { const m = syn(fn); return m !== null && apProblems(m).includes(id); })(), (() => { const m = syn(fn); return m === null ? 'the mutation did not apply' : apProblems(m); })());\n  G('AC-A3-1 mutant: the [SK320_2] sentence written twice, or removed, is not \"exactly once\"', flat(`${TXT.skill}\\n${SK320_2}\\n${SK320_2}\\n`).split(squashT(SK320_2)).length !== 2 && flat('SKILL text without the sentence').split(squashT(SK320_2)).length !== 2);\n\n  // ---- the fix round of review 1 (R1, R5, R6): three texts outside the contiguous Applicability block pinned above. ----\n  // R1 (an advisor decision, a recorded deviation from the plan's exact text): the empty-repository paragraph. R5: the extended-tsconfig sentence. R6: the integrations evidence row.\n  const FX_R1 = 'While the repository has no tracked source files (detect `project.sourceFileCount` is 0), setup MUST NOT write a pointer or add content to 03 on source-section evidence alone, and MUST leave an existing document at the PS path unchanged, because a pointer drafted before any code exists cannot be confirmed by the Phase 1 evidence reads; this keeps the empty-repository rule above and the empty-repo mode in `references/modes.md`.';\n  const FX_R5 = 'When `tsconfig.json` extends another file, setup MUST state what the root `tsconfig.json` says and name the extended file, and MUST NOT resolve the chain, because the statement is taken from `tsconfig.json` only.';\n  const FX_ROW_PREFIX = '| `docs/integrations/<vendor>.md` | The vendor\\'s client code:';\n  const FX_ROW = \"| `docs/integrations/<vendor>.md` | The vendor's client code: auth approach, endpoints used, timeouts, retry policy, idempotency, circuit breaking and fallback, logging and redaction, quirks from code comments | Outbound integrations, scoped to the vendor; Observability |\";\n  const FX_ROW_TOKENS = ['circuit breaking', 'fallback', 'logging and redaction', 'quirks from code comments'];\n  const STRICT_END = 'If the owner declines, setup reports the omission and does not write it.'; // the last sentence of the strictness paragraph, the last text of the contiguous block\n  /** The ids of the fix-round checks a docs-generation.md text does not meet ([] = all met). */\n  const fxProblems = (doc) => {\n    const d = lfT(doc); const f = flat(d); const bad = [];\n    const n1 = f.split(squashT(FX_R1)).length - 1;\n    if (n1 !== 1) bad.push(n1 === 0 ? 'r1-missing' : 'r1-duplicated');\n    const n5 = f.split(squashT(FX_R5)).length - 1;\n    if (n5 !== 1) bad.push(n5 === 0 ? 'r5-missing' : 'r5-duplicated');\n    // Positions are judged on the squashed text of the document: the contiguous block (AP320) ends at the strictness paragraph, R5 and R1 follow it, and \"### Pointer format\" follows them. A paragraph\n    // inside the block breaks the block's contiguity, so \"outside the contiguous Applicability block\" is the same check as \"the block is whole and the paragraph starts after its end\".\n    const endAp = f.indexOf(squashT(AP320)) + squashT(AP320).length; const i1 = f.indexOf(squashT(FX_R1)); const i5 = f.indexOf(squashT(FX_R5)); const iEnd = f.indexOf('### Pointer format');\n    if (n1 === 1 && !(f.indexOf(squashT(AP320)) >= 0 && i1 >= endAp && f.indexOf(squashT(STRICT_END)) >= 0 && i1 > f.indexOf(squashT(STRICT_END)) && iEnd > i1)) bad.push('r1-position');\n    if (n5 === 1 && !(f.indexOf(squashT(AP320)) >= 0 && i5 >= endAp && iEnd > i5)) bad.push('r5-position');\n    const rows = d.split('\\n').filter((l) => l.startsWith(FX_ROW_PREFIX));\n    if (rows.length !== 1) bad.push(rows.length === 0 ? 'r6-row-missing' : 'r6-row-duplicated');\n    else for (const t of FX_ROW_TOKENS) if (!rows[0].includes(t)) bad.push(`r6-row-lacks:${t}`);\n    return bad;\n  };\n  const SYN_FX = SYN.replace(`${AP320}\\n\\n### Pointer format`, `${AP320}\\n\\n${FX_R5}\\n\\n${FX_R1}\\n\\n| PS document | Code evidence | Source sections (03) |\\n|---|---|---|\\n${FX_ROW}\\n\\n### Pointer format`);\n  const synFx = (fn) => { const m = fn(SYN_FX); return m === SYN_FX ? null : m; };\n  G('R1/R5/R6: preconditions: the synthetic reference document carries the three texts and still meets every applicability contract check', SYN_FX !== SYN && JSON.stringify(apProblems(SYN_FX)) === '[]' && JSON.stringify(fxProblems(SYN_FX)) === '[]', { ap: apProblems(SYN_FX), fx: fxProblems(SYN_FX) });\n  const realFx = fxProblems(TXT.docs);\n  for (const id of ['r1-missing', 'r1-duplicated', 'r1-position', 'r5-missing', 'r5-duplicated', 'r5-position', 'r6-row-missing', 'r6-row-duplicated', ...FX_ROW_TOKENS.map((t) => `r6-row-lacks:${t}`)]) G(`R1/R5/R6: references/docs-generation.md: ${id} is met`, !realFx.includes(id), realFx);\n  G('R1: references/docs-generation.md holds the \"While the repository has no tracked source files\" paragraph exactly once, after the strictness paragraph and before \"### Pointer format\", outside the contiguous Applicability block', flat(lfT(TXT.docs)).split(squashT(FX_R1)).length === 2 && !realFx.some((x) => x.startsWith('r1-')), realFx);\n  G('R1: the paragraph names the repository state (detect project.sourceFileCount is 0), forbids a pointer and a 03 addition on source-section evidence alone, and leaves an existing document unchanged', ['project.sourceFileCount', 'is 0', 'MUST NOT write a pointer or add content to 03 on source-section evidence alone', 'MUST leave an existing document at the PS path unchanged'].every((t) => FX_R1.includes(t)) && flat(lfT(TXT.docs)).includes(squashT(FX_R1)));\n  G('R5: references/docs-generation.md holds the tsconfig-extends sentence exactly once, after the contiguous Applicability block and before \"### Pointer format\"', flat(lfT(TXT.docs)).split(squashT(FX_R5)).length === 2 && !realFx.some((x) => x.startsWith('r5-')), realFx);\n  G('R6: the integrations evidence row names circuit breaking and fallback, logging and redaction, and quirks from code comments (one row, whole text)', lfT(TXT.docs).split('\\n').filter((l) => l === FX_ROW).length === 1 && !realFx.some((x) => x.startsWith('r6-')), realFx);\n  // Mutants: each fails its own id on the synthetic document (a check that never fails is not a check).\n  for (const [label, id, fn] of [\n    ['the R1 paragraph removed', 'r1-missing', (d) => d.replace(`${FX_R1}\\n\\n`, '')],\n    ['the R1 paragraph written twice', 'r1-duplicated', (d) => d.replace(FX_R1, `${FX_R1}\\n\\n${FX_R1}`)],\n    ['the R1 paragraph placed before the strictness paragraph (inside the contiguous block)', 'r1-position', (d) => d.replace(`${FX_R1}\\n\\n`, '').replace('When `tsconfig.json` exists and the mapping is active', `${FX_R1}\\n\\nWhen \\`tsconfig.json\\` exists and the mapping is active`)],\n    ['the R1 paragraph placed after the \"### Pointer format\" heading', 'r1-position', (d) => d.replace(`${FX_R1}\\n\\n`, '').replace('### Pointer format\\n', `### Pointer format\\n\\n${FX_R1}\\n`)],\n    ['the R1 paragraph placed before the Applicability block', 'r1-position', (d) => d.replace(`${FX_R1}\\n\\n`, '').replace('#### Applicability (one rule for every mode)', `${FX_R1}\\n\\n#### Applicability (one rule for every mode)`)],\n    ['\"MUST NOT write a pointer\" weakened to \"SHOULD NOT\"', 'r1-missing', (d) => d.replace('setup MUST NOT write a pointer or add content to 03 on source-section', 'setup SHOULD NOT write a pointer or add content to 03 on source-section')],\n    ['\"MUST leave an existing document\" weakened to \"MAY leave\"', 'r1-missing', (d) => d.replace('MUST leave an existing document at the PS path unchanged', 'MAY leave an existing document at the PS path unchanged')],\n    ['\"is 0\" changed to \"is 1\"', 'r1-missing', (d) => d.replace('project.sourceFileCount` is 0', 'project.sourceFileCount` is 1')],\n    ['the R5 sentence removed', 'r5-missing', (d) => d.replace(`${FX_R5}\\n\\n`, '')],\n    ['the R5 sentence written twice', 'r5-duplicated', (d) => d.replace(FX_R5, `${FX_R5}\\n\\n${FX_R5}`)],\n    ['\"MUST NOT resolve the chain\" weakened to \"MAY resolve the chain\"', 'r5-missing', (d) => d.replace('MUST NOT resolve the chain', 'MAY resolve the chain')],\n    ['the R5 sentence placed after the \"### Pointer format\" heading', 'r5-position', (d) => d.replace(`${FX_R5}\\n\\n`, '').replace('### Pointer format\\n', `### Pointer format\\n\\n${FX_R5}\\n`)],\n    ['the R5 sentence placed before the Applicability block', 'r5-position', (d) => d.replace(`${FX_R5}\\n\\n`, '').replace('#### Applicability (one rule for every mode)', `${FX_R5}\\n\\n#### Applicability (one rule for every mode)`)],\n    ['the integrations row removed', 'r6-row-missing', (d) => d.replace(`${FX_ROW}\\n`, '')],\n    ['the integrations row written twice', 'r6-row-duplicated', (d) => d.replace(`${FX_ROW}\\n`, `${FX_ROW}\\n${FX_ROW}\\n`)],\n    ['\"circuit breaking and fallback\" dropped from the row', 'r6-row-lacks:circuit breaking', (d) => d.replace('circuit breaking and fallback, ', '')],\n    ['\"fallback\" dropped from the row (\"circuit breaking\" kept)', 'r6-row-lacks:fallback', (d) => d.replace('circuit breaking and fallback', 'circuit breaking')],\n    ['\"logging and redaction\" dropped from the row', 'r6-row-lacks:logging and redaction', (d) => d.replace('logging and redaction, ', '')],\n    ['\"quirks from code comments\" dropped from the row', 'r6-row-lacks:quirks from code comments', (d) => d.replace(', quirks from code comments', '')],\n  ]) G(`R1/R5/R6 mutant: ${label} fails ${id}`, (() => { const m = synFx(fn); return m !== null && fxProblems(m).includes(id); })(), (() => { const m = synFx(fn); return m === null ? 'the mutation did not apply' : fxProblems(m); })());\n\n  // ---- the checkers (AC-A3-2): a positive case, then each named finding by its negative case, including the boundary. ----\n  const ARCH = (cfg, ci = '- `strict`: true') => `# Architecture\\n\\n## 1. Overview\\n\\nText.\\n\\n## 3. Configuration\\n\\n${cfg}\\n\\n---\\n\\n## 4. Module layout\\n\\nText.\\n\\n## 12. CI/CD and tooling\\n\\n${ci}\\n`;\n  const HEAD = '| Variable | Required | Classification | Used by | Description | Source |';\n  const SEP = '| --- | --- | --- | --- | --- | --- |';\n  const ROW = (v, req = 'yes', cls = 'non-secret', used = 'typeorm module', desc = 'database host', src = '`src/config/db.ts`') => `| ${v} | ${req} | ${cls} | ${used} | ${desc} | ${src} |`;\n  const TABLE = (...rows) => [HEAD, SEP, ...rows].join('\\n');\n  const GOOD = TABLE(ROW('`DB_HOST`'), ROW('`JWT_SECRET`', 'yes', 'secret', 'auth module', 'token signing key', '`src/config/auth.ts`'));\n  const CI = (arch, names, declined = false) => H.checkConfigurationInventory({ architectureText: arch, names, declined });\n  const cc = (f) => f.map((x) => x.code);\n  G('AC-A3-2 configuration: the positive case (a complete table, one row per variable) has no finding', CI(ARCH(GOOD), ['DB_HOST', 'JWT_SECRET']).length === 0, CI(ARCH(GOOD), ['DB_HOST', 'JWT_SECRET']));\n  G('AC-A3-2 configuration: no variables evidenced and a table with no row is clean (nothing to list)', CI(ARCH(TABLE()), []).length === 0);\n  G('AC-A3-2 configuration: one variable missing is config-row-missing:<name> and nothing else', JSON.stringify(cc(CI(ARCH(GOOD), ['DB_HOST', 'JWT_SECRET', 'REDIS_URL']))) === JSON.stringify(['config-row-missing:REDIS_URL']), cc(CI(ARCH(GOOD), ['DB_HOST', 'JWT_SECRET', 'REDIS_URL'])));\n  G('AC-A3-2 configuration: a table with a header and no row is config-row-missing for every variable (the boundary)', JSON.stringify(cc(CI(ARCH(TABLE()), ['DB_HOST', 'JWT_SECRET']))) === JSON.stringify(['config-row-missing:DB_HOST', 'config-row-missing:JWT_SECRET']));\n  G('AC-A3-2 configuration: no table at all (the compact BS bullets only), and no Configuration heading, are config-row-missing', cc(CI(ARCH('- Mechanism: `ConfigService`'), ['DB_HOST'])).includes('config-row-missing:DB_HOST') && cc(CI('# Architecture\\n\\n## 4. Module layout\\n\\nText.\\n', ['DB_HOST'])).includes('config-row-missing:DB_HOST'));\n  for (const [col, row] of [['variable', ROW('``')], ['required', ROW('`DB_HOST`', '')], ['classification', ROW('`DB_HOST`', 'yes', '  ')], ['used by', ROW('`DB_HOST`', 'yes', 'non-secret', '')], ['description', ROW('`DB_HOST`', 'yes', 'non-secret', 'x', '')], ['source', ROW('`DB_HOST`', 'yes', 'non-secret', 'x', 'y', '')]]) {\n    const f = CI(ARCH(TABLE(row)), ['DB_HOST']);\n    G(`AC-A3-2 configuration: an empty (or whitespace only) ${col} cell is ${col === 'variable' ? 'config-row-missing' : `config-cell-empty:DB_HOST:${col}`}`, col === 'variable' ? cc(f).includes('config-row-missing:DB_HOST') : JSON.stringify(cc(f)) === JSON.stringify([`config-cell-empty:DB_HOST:${col}`]), cc(f));\n  }\n  G('AC-A3-2 configuration: \"unknown\" in the required column is a value the rule asks for, not an empty cell', CI(ARCH(TABLE(ROW('`DB_HOST`', 'unknown'))), ['DB_HOST']).length === 0);\n  G('AC-A3-2 configuration: a table that lacks a column header is config-cell-empty for that column', cc(CI(ARCH([HEAD.replace(' | Source |', ' |'), '| --- | --- | --- | --- | --- |', '| `DB_HOST` | yes | non-secret | typeorm module | database host |'].join('\\n')), ['DB_HOST'])).includes('config-cell-empty:DB_HOST:source'));\n  for (const [label, desc] of [['an assignment NAME=value', 'default is DB_HOST=localhost'], ['a credential in a URL', 'postgres://admin:hunter22@db.internal/app'], ['a long token', `bearer ${'a1B2'.repeat(10)}`], ['a well-known secret prefix', ['sk', 'test', 'a'.repeat(24)].join('_')], ['an Authorization header', 'Bearer abcdefgh12345678']]) {\n    G(`AC-A3-2 configuration: a description holding ${label} is config-value-shaped`, cc(CI(ARCH(TABLE(ROW('`DB_HOST`', 'yes', 'non-secret', 'x', desc))), ['DB_HOST'])).includes('config-value-shaped'));\n  }\n  G('AC-A3-2 configuration: prose that names a variable without a value is not value-shaped (control)', CI(ARCH(TABLE(ROW('`DB_HOST`', 'yes', 'non-secret', 'typeorm module', 'host of the primary database; falls back to NODE_ENV defaults', '`src/config/db.ts`'))), ['DB_HOST']).length === 0);\n  G('AC-A3-2 configuration: a declined proposal with no completion claim has no finding, whatever the table holds', CI(ARCH('- Mechanism: `ConfigService`'), ['DB_HOST'], true).length === 0 && CI(ARCH(TABLE(ROW('`DB_HOST`', 'yes', 'non-secret', 'x', 'DB_HOST=localhost'))), ['DB_HOST', 'OTHER'], true).length === 0);\n  for (const claim of ['The configuration conversion is complete.', 'Configuration inventory completed.', 'Consolidation done for configuration.']) G(`AC-A3-2 configuration: a declined proposal with the completion claim \"${claim}\" is config-completion-claimed and nothing else`, JSON.stringify(cc(CI(ARCH(`${claim}\\n\\n${GOOD}`), ['DB_HOST'], true))) === JSON.stringify(['config-completion-claimed']));\n  for (const ok of ['The configuration conversion is not complete.', 'The configuration conversion is incomplete.', 'The configuration inventory was never completed.']) G(`AC-A3-2 configuration: a declined proposal that says \"${ok}\" is clean (a negated claim is no claim)`, CI(ARCH(ok), ['DB_HOST'], true).length === 0);\n  G('AC-A3-2 configuration: a completion claim is not a finding when the proposal was not declined', !cc(CI(ARCH(`The configuration conversion is complete.\\n\\n${GOOD}`), ['DB_HOST'])).includes('config-completion-claimed'));\n\n  const TS = (o, extra = '') => `{ // comment\\n  ${extra}\"compilerOptions\": ${JSON.stringify(o)},\\n}\\n`;\n  const ST = (arch, ts, declined = false) => H.checkStrictness({ architectureText: arch, tsconfigText: ts, declined });\n  const STRICT_TS = TS({ strict: true, noImplicitAny: false, target: 'ES2023' });\n  G('AC-A3-2 strictness: the positive case (strict and a set flag stated as written; a commented tsconfig with a trailing comma parses) has no finding', ST(ARCH(GOOD, '- `strict`: true\\n- `noImplicitAny`: false'), STRICT_TS).length === 0, ST(ARCH(GOOD, '- `strict`: true\\n- `noImplicitAny`: false'), STRICT_TS));\n  G('AC-A3-2 strictness: \"strict not set\" is the clean statement of a tsconfig that sets no strict option', ST(ARCH(GOOD, 'Compiler strictness: strict not set.'), TS({ target: 'ES2023' })).length === 0);\n  G('AC-A3-2 strictness: no statement (no strict mention, or no CI/CD and tooling heading) is strictness-missing', cc(ST(ARCH(GOOD, '| Lint | CI | yes |'), STRICT_TS)).join() === 'strictness-missing' && cc(ST('# Architecture\\n\\n## 4. Module layout\\n\\nText.\\n', STRICT_TS)).join() === 'strictness-missing');\n  for (const [label, ci, ts] of [['strict stated false while the file says true', '- `strict`: false\\n- `noImplicitAny`: false', STRICT_TS], ['a set flag left out of the statement', '- `strict`: true', STRICT_TS], ['a flag stated with the wrong value', '- `strict`: true\\n- `noImplicitAny`: true', STRICT_TS], ['\"strict not set\" while the file sets strict options', 'strict not set', STRICT_TS], ['strict stated true while the file sets none', '- `strict`: true', TS({ target: 'ES2023' })], ['a flag stated that the file does not set', '- `strict`: true\\n- `noImplicitAny`: false\\n- `strictNullChecks`: true', STRICT_TS], ['a statement missing the extended file', '- `strict`: true', TS({ strict: true }, '\"extends\": \"./tsconfig.base.json\",\\n  ')]]) {\n    G(`AC-A3-2 strictness: ${label} is strictness-mismatch`, cc(ST(ARCH(GOOD, ci), ts)).includes('strictness-mismatch'), ST(ARCH(GOOD, ci), ts));\n  }\n  G('AC-A3-2 strictness: naming the extended file (and stating the root file as written) is clean; the chain is not resolved', ST(ARCH(GOOD, '- `strict`: true (this file extends ./tsconfig.base.json; not resolved)'), TS({ strict: true }, '\"extends\": \"./tsconfig.base.json\",\\n  ')).length === 0);\n  G('AC-A3-2 strictness: a declined proposal judges nothing (no finding whatever the section or the file says)', ST(ARCH(GOOD, 'nothing'), STRICT_TS, true).length === 0 && ST('', 'not json', true).length === 0);\n  // R4: a tsconfig.json that does not parse is unavailable evidence, never \"no options\". The unsupported statement \"strict not set\" (and any other statement) is reported as strictness-mismatch.\n  const BAD_TS = [['a truncated file', '{\"compilerOptions\":'], ['an unterminated string', '{\"compilerOptions\": {\"strict'], ['a missing closing brace', '{\"compilerOptions\": {\"strict\": true}'], ['an empty file', ''], ['whitespace only', ' \\n'], ['text that is not JSON', 'not json'], ['a literal null', 'null'], ['an array', '[]'], ['a number', '5'], ['compilerOptions that is a number', '{\"compilerOptions\": 5}'], ['compilerOptions that is null', '{\"compilerOptions\": null}'], ['compilerOptions that is an array', '{\"compilerOptions\": []}']];\n  for (const [label, ts] of BAD_TS) {\n    const claims = [['\"strict not set\"', 'Compiler strictness: strict not set.'], ['strict true', '- `strict`: true'], ['strict false', '- `strict`: false']];\n    G(`R4: tsconfig.json as ${label} is strictness-mismatch (unavailable evidence), whatever the statement says`, claims.every(([, ci]) => { const f = ST(ARCH(GOOD, ci), ts); return f.length === 1 && f[0].code === 'strictness-mismatch' && f[0].detail.includes('cannot be checked'); }), claims.map(([, ci]) => ST(ARCH(GOOD, ci), ts)));\n  }\n  G('R4: a tsconfig.json that does not parse is reported even when 03 states nothing (the evidence problem comes first; the missing statement is judged once the file parses)', cc(ST(ARCH(GOOD, '| Lint | CI | yes |'), '{\"compilerOptions\":')).join() === 'strictness-mismatch');\n  G('R4: parseTsconfig returns null for each of the malformed texts that is not JSON after comment and comma removal, and keeps returning the object for a commented tsconfig with trailing commas', ['{\"compilerOptions\":', '', 'not json', '{\"compilerOptions\": {\"strict'].every((t) => H.parseTsconfig(t) === null) && JSON.stringify(H.parseTsconfig('{ // c\\n \"compilerOptions\": { /* x */ \"strict\": true, },\\n}\\n')) === JSON.stringify({ compilerOptions: { strict: true } }));\n  G('R4: controls: the tolerant parser still accepts a commented tsconfig with trailing commas and no options (\"strict not set\" is clean), an empty object, and an empty compilerOptions', ST(ARCH(GOOD, 'strict not set.'), '{ // c\\n \"compilerOptions\": { /* x */ \"target\": \"ES2023\", },\\n}\\n').length === 0 && ST(ARCH(GOOD, 'strict not set.'), '{}').length === 0 && ST(ARCH(GOOD, 'strict not set.'), '{\"compilerOptions\": {}}').length === 0 && ST(ARCH(GOOD, '- `strict`: true'), '{ /* c */ \"compilerOptions\": { \"strict\": true, // c\\n }, }').length === 0);\n  G('R4: a declined proposal still judges nothing when the file does not parse', BAD_TS.every(([, ts]) => ST(ARCH(GOOD, 'nothing'), ts, true).length === 0));\n\n  const AP = (o) => H.checkApplicability({ approved: ['docs/database.md', '.ai/context/glossary.md'], confirmed: ['docs/database.md', '.ai/context/glossary.md'], pointers: ['docs/database.md', '.ai/context/glossary.md'], navigationRefs: ['docs/database.md'], ...o });\n  G('AC-A3-2 applicability: the positive case (installed pointers are the approved set, Phase 1 confirmed it, navigation references only installed documents) has no finding, in any order', AP({}).length === 0 && AP({ confirmed: ['.ai/context/glossary.md', 'docs/database.md'], pointers: ['.ai/context/glossary.md', 'docs/database.md'] }).length === 0 && AP({ approved: [], confirmed: [], pointers: [], navigationRefs: [] }).length === 0);\n  G('AC-A3-2 applicability: an installed pointer Phase 0 did not approve (marked \"not applicable\") is pointer-not-approved and only that', JSON.stringify(cc(AP({ pointers: ['docs/database.md', '.ai/context/glossary.md', '.ai/context/error-contract.md'] }))) === JSON.stringify(['pointer-not-approved']));\n  G('AC-A3-2 applicability: an approved document with no installed pointer is approved-pointer-missing and only that', JSON.stringify(cc(AP({ pointers: ['docs/database.md'] }))) === JSON.stringify(['approved-pointer-missing']));\n  G('AC-A3-2 applicability: a navigation reference to a mapped document that is not installed is dangling-navigation and only that', JSON.stringify(cc(AP({ navigationRefs: ['docs/database.md', '.ai/context/error-contract.md'] }))) === JSON.stringify(['dangling-navigation']));\n  G('AC-A3-2 applicability: Phase 1 confirming another set than Phase 0 approved is confirmed-differs-from-approved (one more, one fewer, one swapped)', ['x', 'drop', 'swap'].every((k) => { const c = k === 'x' ? ['docs/database.md', '.ai/context/glossary.md', 'docs/api-conventions.md'] : k === 'drop' ? ['docs/database.md'] : ['docs/database.md', 'docs/api-conventions.md']; return cc(AP({ confirmed: c })).includes('confirmed-differs-from-approved'); }));\n  // The mutation controls of 5.2 item 4 for the checkers, restated as accept/reject pairs (a checker that accepts the wrong input is the mutant).\n  G('AC-A3-3 mutants: the checker rejects a pointer Phase 0 marked not applicable, an inventory missing a variable, a value-shaped cell, a missing strictness statement, and a declined proposal that claims completion', cc(AP({ pointers: ['docs/database.md', '.ai/context/glossary.md', 'docs/x.md'] })).includes('pointer-not-approved') && cc(CI(ARCH(GOOD), ['DB_HOST', 'MISSING'])).includes('config-row-missing:MISSING') && cc(CI(ARCH(TABLE(ROW('`DB_HOST`', 'yes', 'non-secret', 'x', 'PORT=3000'))), ['DB_HOST'])).includes('config-value-shaped') && cc(ST(ARCH(GOOD, 'nothing stated'), STRICT_TS)).includes('strictness-missing') && cc(CI(ARCH('Configuration is complete.'), ['DB_HOST'], true)).includes('config-completion-claimed'));\n}\n\n{\n  const G = grp('3.2.0 B2: the claude block with the delegated-agent bullet');\n  // [CT320_1] (plan B2): a new bullet in the claude block, after the \"MUST NOT infer a subdirectory start\" bullet. The 3.1.0 block is the 3.2.0 block without it (AC-B2-1 pins every 3.1.0 line).\n  const CT320_1 = ['- For a delegated agent this bullet replaces the directory comparison above. A delegated', '  agent\\'s context or brief MAY show the directory its parent was in rather', '  than the session\\'s original start directory. As a delegated agent you MUST treat the', '  original start directory as unknown unless the brief states it. You MUST NOT refuse on', '  your own working directory alone, and when the brief does not state the original start', '  directory you MUST state in your output that it was not given. This prevents a false', '  launch refusal after the parent changed directory inside a root-started session. If', '  the brief states an original start directory strictly below the selected rule\\'s', '  directory, the refusal above applies unchanged. The parent session stays bound by', '  this rule.'].join('\\n');\n  const BLOCK_310_SHA = 'e2d6abed3fdb5c29c17f4d13e26fc1b9de5e121af6a1e71c85942ba079f6bdca'; // the inner text of the 3.1.0 claude block (33 lines, LF), from the 3.1.0 template\n  const innerOf = (t) => parseBlocks(t).blocks.find((b) => b.id === 'claude').inner;\n  const T320 = lfT(PS_CLAUDE_TEMPLATE);\n  const has320 = T320.split(CT320_1).length === 2;\n  const T310 = has320 ? T320.replace(`${CT320_1}\\n`, '') : null;\n  G('AC-B2-2: the template holds the [CT320_1] bullet once, inside the claude block', has320 && innerOf(T320).includes(CT320_1), has320 ? undefined : 'the template does not hold the 3.2.0 bullet yet');\n  G('AC-B2-2: the template without that bullet is the 3.1.0 block, byte for byte (digest of its inner text)', T310 !== null && sha(innerOf(T310)) === BLOCK_310_SHA, T310 === null ? 'the bullet is not in the template, so the 3.1.0 block cannot be derived' : sha(innerOf(T310)));\n  const rcWith = (tplText, text, layer) => H.checkClaudeRecovery({ text, templateText: tplText, bsImports: BS_IMPORTS, bsVersionSentence: BS_SENTENCE, userLines: [USER_LINE], ...(layer === undefined ? {} : { agentLayer: layer }) });\n  G('AC-B2-2: with the 3.2.0 template, a CLAUDE.md rendered from it is accepted (every layer, with that layer\\'s Subagents line)', A1_LAYERS.every((l) => rcWith(PS_CLAUDE_TEMPLATE, claudeForLayer(l, MERGED_CLAUDE), l).length === 0));\n  G('AC-B2-2: with the 3.2.0 template, the 3.1.0 block is claude-block-content (every layer)', T310 !== null && A1_LAYERS.every((l) => { const old = `${T310}\\n${USER_LINE}\\n\\n${BS_CLAUDE()}`.replace(A1_LINES.full, A1_LINES[l]); return has(rcWith(PS_CLAUDE_TEMPLATE, old, l), 'claude-block-content'); }), T310 === null ? 'the 3.2.0 template is not shipped yet, so there is no 3.1.0 block to reject' : undefined);\n  G('AC-B2-2: the bullet in the wrong place (after the block\\'s end marker) or reworded by one character is claude-block-content', T310 !== null && has(rcWith(PS_CLAUDE_TEMPLATE, `${MERGED_CLAUDE.replace(`${CT320_1}\\n`, '')}\\n${CT320_1}\\n`), 'claude-block-content') && has(rcWith(PS_CLAUDE_TEMPLATE, MERGED_CLAUDE.replace('the refusal above applies unchanged', 'the refusal above applies unchanged.')), 'claude-block-content'), T310 === null ? 'the 3.2.0 template is not shipped yet' : undefined);\n}\n\n",
    after: "// ============================================================== GROUP: extensions ====\n",
  }),
  BT320_4: Object.freeze({
    file: "tests/bs-doc-map.test.mjs",
    before: "",
    old: "    const root = mkVerify('v-keep', { files: { '.claude/agents/docs-sync.md': BS_AGENT['docs-sync'] } }); const base = H.takeSnapshot(root);\n",
    neu: "    // 3.2.0 (A1): a declined docs-sync replacement is the docs-sync-retained layer, so the fixture's CLAUDE.md carries that layer's Subagents line and its AGENTS.md the matching sentence\n    // (before 3.2.0 this fixture kept the full-layer line, which the helper now reports as claude-block-content under the layer the dispositions derive).\n    const root = mkVerify('v-keep', { files: { '.claude/agents/docs-sync.md': BS_AGENT['docs-sync'], 'CLAUDE.md': claudeForLayer('docs-sync-retained'), 'AGENTS.md': agentsWithSentence(renderAgents(true), A1_SENTENCES['docs-sync-retained']) } }); const base = H.takeSnapshot(root);\n",
    after: "",
  }),
  BT320_5: Object.freeze({
    file: "tests/bs-doc-map.test.mjs",
    before: "",
    old: "",
    neu: "// ============================================================== GROUP: 3.2.0 A1 and A3 through verify ====\n// The layer is derived from the evidence dispositions and the installed wrappers (A1 item 4), the three A3 checkers run when the evidence supplies their input and not otherwise.\n{\n  const G = grp('3.2.0 A1/A3 through verify');\n  const keepD = { disposition: 'keep', retainedBytes: BS_AGENT['docs-sync'], incomplete: true, invokedDefinition: '.claude/agents/docs-sync.md' };\n  const keepR = { disposition: 'keep', retainedBytes: BS_AGENT.reviewer, incomplete: true, invokedDefinition: '.claude/agents/reviewer.md' };\n  const CANON_D = `${WRAPPER['docs-sync']}\\n## Project rules\\nkeep\\n`;\n  const mergeD = { disposition: 'merge', approvedBytes: CANON_D, incomplete: true, invokedDefinition: '.claude/agents/docs-sync.md' };\n  const evA = (r, d, o = {}) => EVID({ conversion: 'partial', agents: { reviewer: r, 'docs-sync': d }, ...o });\n  const files = (layer, extra = {}) => ({ 'CLAUDE.md': claudeForLayer(layer), 'AGENTS.md': layer === 'full' ? renderAgents(true) : agentsWithSentence(renderAgents(true), A1_SENTENCES[layer]), ...extra });\n  const run = (f, evidence, expectPartial = true) => { const root = mkVerify('a1v', { files: f }); return verify(root, { baseline: H.takeSnapshot(root), evidence, expectPartial }); };\n  const claudeCheck = /CLAUDE\\.md: import, managed block/; const sentenceCheck = /the agents block states the installed agent layer/;\n  const TAKE = { disposition: 'take-new' };\n  const R_FILE = { '.claude/agents/reviewer.md': BS_AGENT.reviewer }; const D_FILE = { '.claude/agents/docs-sync.md': BS_AGENT['docs-sync'] };\n  // The three partial layers, each as a clean expected-partial outcome.\n  for (const [layer, r, d, extra] of [['docs-sync-retained', TAKE, keepD, D_FILE], ['reviewer-retained', keepR, TAKE, R_FILE], ['both-retained', keepR, keepD, { ...R_FILE, ...D_FILE }]]) {\n    const ok = run(files(layer, extra), evA(r, d));\n    G(`A1 verify: ${layer} (the kept agent's Subagents line and the matching AGENTS.md sentence) is a clean expected-partial outcome`, clean(ok) && ok.findings.length === 0, diag(ok));\n    const noFlag = run(files(layer, extra), evA(r, d), false);\n    G(`A1 verify: ${layer} without --expect-partial stays a finding of the completeness check, and the block and sentence checks themselves have no finding`, noFlag.outcome === 'findings' && !findingNames(noFlag).some((n) => claudeCheck.test(n) || sentenceCheck.test(n)), findingNames(noFlag));\n    const full = run({ ...files('full', extra) }, evA(r, d));\n    G(`A1 verify: ${layer} with the full-layer line in CLAUDE.md is a finding of the CLAUDE.md check (a mismatched layer is not accepted)`, full.outcome === 'findings' && findingNames(full).some((n) => claudeCheck.test(n)), findingNames(full));\n    const noSentence = run({ ...files(layer, extra), 'AGENTS.md': renderAgents(true) }, evA(r, d));\n    G(`A1 verify: ${layer} without the AGENTS.md sentence is a finding of the layer-sentence check`, noSentence.outcome === 'findings' && findingNames(noSentence).some((n) => sentenceCheck.test(n)), findingNames(noSentence));\n  }\n  G('A1 verify: take-new for both is the full layer: a partial Subagents line or a layer sentence is a finding', (() => { const a = run(files('docs-sync-retained'), EVID()); const b = run({ 'AGENTS.md': agentsWithSentence(renderAgents(true), A1_SENTENCES['docs-sync-retained']) }, EVID()); return findingNames(a).some((n) => claudeCheck.test(n)) && findingNames(b).some((n) => sentenceCheck.test(n)); })());\n  // merge: canonical only with the canonical reference, in both directions.\n  { const withRef = run(files('full', { '.claude/agents/docs-sync.md': CANON_D }), evA(TAKE, mergeD));\n    G('A1 verify: a docs-sync merge that still loads .ai/agents/docs-sync.md is canonical: the full-layer line is accepted', clean(withRef) && withRef.findings.length === 0, diag(withRef));\n    const partialOnRef = run(files('docs-sync-retained', { '.claude/agents/docs-sync.md': CANON_D }), evA(TAKE, mergeD));\n    G('A1 verify: ... and a partial line for it is a finding (the layer is not retained)', findingNames(partialOnRef).some((n) => claudeCheck.test(n)), findingNames(partialOnRef));\n    const noRefText = `${BS_AGENT['docs-sync']}\\n## Project rules\\nkeep\\n`;\n    const noRef = run(files('docs-sync-retained', { '.claude/agents/docs-sync.md': noRefText }), evA(TAKE, { ...mergeD, approvedBytes: noRefText }));\n    G('A1 verify: a docs-sync merge without the canonical reference is retained: the partial line and sentence are accepted', clean(noRef) && noRef.findings.length === 0, diag(noRef));\n    const noRefFull = run(files('full', { '.claude/agents/docs-sync.md': noRefText }), evA(TAKE, { ...mergeD, approvedBytes: noRefText }));\n    G('A1 verify: ... and the full-layer line for it is a finding (the same merge counted as canonical is the mutant)', findingNames(noRefFull).some((n) => claudeCheck.test(n)), findingNames(noRefFull)); }\n\n  // ---- A3 through verify: the three optional evidence keys. ----\n  const trimNav = (text, keep) => lfT(text).split('\\n').filter((l) => { const m = /^\\|[^|]*\\| `([^`]+)` \\|$/.exec(l); return !(m !== null && H.mappingRefsFor(m[1]) !== null && !keep.includes(m[1])); }).join('\\n');\n  const NAV_OK = trimNav(renderAgents(true), VERIFY_POINTERS);\n  const AP_EV = { approved: [...VERIFY_POINTERS], confirmed: [...VERIFY_POINTERS] };\n  G('A3 verify: the precondition holds: trimming the navigation rows to the installed pointers removes at least one mapped row and keeps the two installed ones', NAV_OK !== renderAgents(true) && VERIFY_POINTERS.every((p) => NAV_OK.includes(`\\`${p}\\``)));\n  { const a = run({ 'AGENTS.md': NAV_OK }, EVID({ applicability: AP_EV }), false);\n    G('A3 verify: applicability evidence equal to the installed pointers, with no dangling navigation row, is clean', clean(a) && a.findings.length === 0, diag(a));\n    const dangling = run({}, EVID({ applicability: AP_EV }), false);\n    G('A3 verify: the default navigation (rows for mapped documents that are not installed) is a finding of the applicability check', findingNames(dangling).some((n) => /^applicability:/.test(n)), findingNames(dangling));\n    const notApproved = run({ 'AGENTS.md': NAV_OK }, EVID({ applicability: { approved: [VERIFY_POINTERS[0]], confirmed: [VERIFY_POINTERS[0]] } }), false);\n    G('A3 verify: an installed pointer that Phase 0 did not approve is a finding', findingNames(notApproved).some((n) => /^applicability:/.test(n)), findingNames(notApproved));\n    const differs = run({ 'AGENTS.md': NAV_OK }, EVID({ applicability: { approved: [...VERIFY_POINTERS], confirmed: [VERIFY_POINTERS[0]] } }), false);\n    G('A3 verify: Phase 1 confirming a different set than Phase 0 approved is a finding', findingNames(differs).some((n) => /^applicability:/.test(n)), findingNames(differs));\n    const none = run({}, EVID(), false);\n    G('A3 verify: without the key the applicability check does not run (a 3.1.0 evidence file is still valid)', !findingNames(none).some((n) => /^applicability:/.test(n)) && !none.checked.some((c) => /^applicability:/.test(c.name))); }\n  { const GOOD_TABLE = ['| Variable | Required | Classification | Used by | Description | Source |', '| --- | --- | --- | --- | --- | --- |', '| `DB_HOST` | yes | non-secret | typeorm module | database host | `src/config/db.ts` |'].join('\\n');\n    const with03 = (table) => FILLED03.replace(/(## 3\\. Configuration\\n)/, `$1\\n${table}\\n`);\n    const ok = run({ [H.BS_03_REL]: with03(GOOD_TABLE) }, EVID({ configuration: { names: ['DB_HOST'] } }), false);\n    G('A3 verify: configuration evidence with a complete row in the 03 Configuration table is clean', clean(ok) && ok.findings.length === 0, diag(ok));\n    const missing = run({ [H.BS_03_REL]: with03(GOOD_TABLE) }, EVID({ configuration: { names: ['DB_HOST', 'REDIS_URL'] } }), false);\n    G('A3 verify: a variable of the evidence with no row is a finding of the configuration check', findingNames(missing).some((n) => /^configuration:/.test(n)), findingNames(missing));\n    const declined = run({}, EVID({ configuration: { names: ['DB_HOST'], declined: true } }), false);\n    G('A3 verify: a declined proposal with no completion claim is clean', !findingNames(declined).some((n) => /^configuration:/.test(n)), findingNames(declined)); }\n  { const ts = '{\\n  \"compilerOptions\": { \"strict\": true }\\n}\\n';\n    const with03 = (line) => FILLED03.replace('## 12. CI/CD and tooling\\n', `## 12. CI/CD and tooling\\n\\n${line}\\n`);\n    const ok = run({ 'tsconfig.json': ts, [H.BS_03_REL]: with03('- `strict`: true') }, EVID({ strictness: {} }), false);\n    G('A3 verify: strictness evidence with 03 stating strict as the tsconfig.json says is clean', clean(ok) && ok.findings.length === 0, diag(ok));\n    const wrong = run({ 'tsconfig.json': ts, [H.BS_03_REL]: with03('- `strict`: false') }, EVID({ strictness: {} }), false);\n    G('A3 verify: 03 stating strict false against a tsconfig.json that sets it true is a finding of the strictness check', findingNames(wrong).some((n) => /^strictness:/.test(n)), findingNames(wrong));\n    const none = run({ [H.BS_03_REL]: with03('- `strict`: false') }, EVID({ strictness: {} }), false);\n    G('A3 verify: with no tsconfig.json there is nothing to state: the strictness check does not run', !findingNames(none).some((n) => /^strictness:/.test(n)), findingNames(none)); }\n  for (const [label, e] of [['applicability that is not an object', EVID({ applicability: 'x' })], ['applicability without confirmed', EVID({ applicability: { approved: [] } })], ['applicability with a path that escapes', EVID({ applicability: { approved: ['../x.md'], confirmed: [] } })], ['applicability with an extra key', EVID({ applicability: { approved: [], confirmed: [], extra: 1 } })], ['configuration without names', EVID({ configuration: {} })], ['configuration with declined as text', EVID({ configuration: { names: [], declined: 'yes' } })], ['strictness that is not an object', EVID({ strictness: true })], ['strictness with an extra key', EVID({ strictness: { declined: false, extra: 1 } })]]) {\n    const r = verify(mkVerify('a3-bad'), { evidence: e }); G(`A3 verify: ${label} is not evaluable`, r.outcome === 'not-evaluable', r.outcome);\n  }\n}\n\n",
    after: "// ============================================================== GROUP: ownership of an unchanged 03 (R5) ====\n",
  }),
  BT320_2: Object.freeze({
    file: "tests/bs-doc-map.test.mjs",
    before: "",
    old: "    ['P01', ['1'], \"Include .project-setup.bak-* installer backups when checking for duplicate PS copies; disable a discoverable backup through the host's skill selection without moving the installer backup.\"],\n",
    neu: "    // 3.2.0 (plan C1 item 1, AC-C1-1): the step 1 instruction is the move, not the disable. The code spans are part of the pin: norm() drops a backslash that precedes a backtick,\n    // so the path is a code span whose last character is a backslash in the document and in this text alike (the old sentence is kept below as OLD_P01, a negative control).\n    ['P01', ['1'], 'Move every `.project-setup.bak-*` directory together with its `.meta.json`, and every `.project-setup.rolledback-*` directory, out of both skills directories into `D:\\\\ps-live\\\\preserved\\\\installer-backups\\\\<target>\\\\`; record each original path; run `detect.mjs` and require an empty `installerBackups`.'],\n",
    after: "",
  }),
  BT320_6: Object.freeze({
    file: "tests/bs-doc-map.test.mjs",
    before: "    ['X10', ['6'], 'Review the resulting bytes and range before measurement.'],\n",
    old: "",
    neu: "    // 3.2.0 (plan C1 items 3 and 4): the two sentences the plan quotes literally. Rows Y are the tests lane's pins of those quotations; they are met by the 3.2.0 document and not by the 3.1.0 one.\n    ['Y01', ['2'], 'Create fixtures only under a directory that already carries the CodexSandboxUsers read-and-execute entry, and check it before the first Codex run.'],\n    ['Y02', ['6'], 'The wording of the Lock order rule used in the 2026-11-14 and 2026-11-22 measurements was not recorded, so a new reviewer measurement with the unit above is not directly comparable with those results; record that in the results row.'],\n",
    after: "",
  }),
  BT320_7: Object.freeze({
    file: "tests/bs-doc-map.test.mjs",
    before: "",
    old: "",
    neu: "  // The 3.1.0 step 1 instruction (disable, not move): superseded by P01, kept only as a negative control (plan C1, D-14: putting it back fails P01).\n  const OLD_P01 = \"Include .project-setup.bak-* installer backups when checking for duplicate PS copies; disable a discoverable backup through the host's skill selection without moving the installer backup.\";\n",
    after: "  const P_DOCS = 'Run `<actual agent name>` for `<printed range>`. Update affected documentation under the installed project instructions. Report files changed and unresolved gaps.';\n",
  }),
  BT320_1: Object.freeze({
    file: "tests/bs-doc-map.test.mjs",
    before: "",
    old: "  const INTRO = 'Status: pending stage-2 acceptance sign-off. Dated live-run records are retained outside this matrix. This procedure records the scoped 2026-11-14 Claude Code isolation probe, the 2026-11-15 init-event confirmation and the 2026-11-15 project-control probe below; it does not enter acceptance results or close checklist items. Stage 2 records the dated matrix results and TODO closeout.';\n",
    neu: "  // 3.2.0 (plan C2, [BT320_1]): the introduction as the plan gives it (line breaks of the plan's block are whitespace, which norm() collapses).\n  const INTRO = 'Status: stage 2 signed off. The section 7 matrix holds the dated results of 2026-11-14 to 2026-11-22; the per-row record is `docs/plans/2026-11-22-project-setup-v3.1-live-acceptance-results.md`. This procedure still records the scoped 2026-11-14 Claude Code isolation probe, the 2026-11-15 init-event confirmation and the 2026-11-15 project-control probe below. Rows that were not measured are listed in `RELEASE-NOTES-3.1.0.md`; the 3.2.0 re-measurements are listed in `RELEASE-NOTES-3.2.0.md`.';\n  // The 3.1.0 introduction, superseded by INTRO: kept only as the negative control \"the old pending stage-2 paragraph put back fails intro\" (plan C2).\n  const OLD_INTRO = 'Status: pending stage-2 acceptance sign-off. Dated live-run records are retained outside this matrix. This procedure records the scoped 2026-11-14 Claude Code isolation probe, the 2026-11-15 init-event confirmation and the 2026-11-15 project-control probe below; it does not enter acceptance results or close checklist items. Stage 2 records the dated matrix results and TODO closeout.';\n",
    after: "",
  }),
  BT320_8: Object.freeze({
    file: "tests/bs-doc-map.test.mjs",
    before: "",
    old: "  const procProblems = (doc) => {\n",
    neu: "  const procProblems = (doc, intro = INTRO) => {\n",
    after: "",
  }),
  BT320_9: Object.freeze({
    file: "tests/bs-doc-map.test.mjs",
    before: "",
    old: "    if (!at('intro').includes(norm(INTRO))) bad.push('intro');\n",
    neu: "    if (!at('intro').includes(norm(intro))) bad.push('intro');\n",
    after: "",
  }),
  BT320_10: Object.freeze({
    file: "tests/bs-doc-map.test.mjs",
    before: "",
    old: "    const by = { 1: [], 3: [], 4: [], 5: [], 6: [], 7: [] };\n",
    neu: "    const by = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };\n",
    after: "",
  }),
  BT320_11: Object.freeze({
    file: "tests/bs-doc-map.test.mjs",
    before: "",
    old: "      '## 2. Prerequisite B: exact Codex Git ownership grant', '', 'Reference text.', '',\n",
    neu: "      '## 2. Prerequisite B: exact Codex Git ownership grant', '', 'Reference text.', '', ...by[2].flatMap((t) => [t, '']),\n",
    after: "",
  }),
  BT320_12: Object.freeze({
    file: "tests/bs-doc-map.test.mjs",
    before: "",
    old: "  for (const [id, keys, text] of REQS) G(`${id} (${keys.map((k) => `\u00a7${k}`).join('/')}${id.startsWith('X') ? ', beyond the plan\\'s controls table' : ''}): the acceptance document says \"${text.slice(0, 70)}${text.length > 70 ? '...' : ''}\"`, Array.isArray(real) && !real.includes(id), real);\n  for (const [id, label] of [['prompt-docs-sync', 'the exact docs-sync agent prompt (section 5)'], ['prompt-reviewer', 'the exact reviewer agent prompt (section 5)'], ['claude-command', 'the complete Claude agent command with all four flags (section 5): claude -p --setting-sources project,local --permission-mode auto --output-format stream-json --verbose \"<exact \u00a75 prompt>\"'], ['identity-name', 'the repository-local user.name command (section 6)'], ['identity-email', 'the repository-local user.email command (section 6)'], ['identity-status', 'the status command git status --porcelain -uall (section 6)'], ['identity-order', 'the identity commands before the status command, in that order (section 6)'], ['invariant-fence', 'the single markdown fence of section 6 holds the exact seven-line Lock order unit, byte for byte (the shared constant)'], ['O3-paragraph', 'the full dated project-control probe paragraph of 2026-11-15'], ['O3-denial', 'the probe paragraph records the refused read under the project Read deny rule'], ['O3-blocked', 'the probe paragraph records the raw Git command blocked by the project hook'], ['O3-no-disclosure', 'the probe paragraph records that the canary content did not appear in the transcript'], ['O3-cleanup', 'the probe paragraph records the canary removal and the clean fixture'], ['intro', 'the revised introduction (pending stage-2 acceptance sign-off, the three dated probes, no results entered)'], ['intro-stale-statement', 'the stale blanket statement \"Nothing below has been run\" is gone'], ['limit-1', 'section 4 carries the navigation-token sentence of the pointer limitation'], ['limit-2', 'section 4 carries the distinctive-token guidance'], ['limit-3', 'section 4 carries the stale-historical-mention sentence'], ['baseline-trust', 'section 4 keeps the baseline-trust limitation'], ['matrix', 'section 7 keeps every matrix row and cell unchanged (digest of the 17 table lines)']]) G(`${id}: ${label}`, Array.isArray(real) && !real.includes(id), real);\n",
    neu: "  for (const [id, keys, text] of REQS) G(`${id} (${keys.map((k) => `\u00a7${k}`).join('/')}${id.startsWith('X') ? ', beyond the plan\\'s controls table' : id.startsWith('Y') ? ', the 3.2.0 plan C1' : ''}): the acceptance document says \"${text.slice(0, 70)}${text.length > 70 ? '...' : ''}\"`, Array.isArray(real) && !real.includes(id), real);\n  for (const [id, label] of [['prompt-docs-sync', 'the exact docs-sync agent prompt (section 5)'], ['prompt-reviewer', 'the exact reviewer agent prompt (section 5)'], ['claude-command', 'the complete Claude agent command with all four flags (section 5): claude -p --setting-sources project,local --permission-mode auto --output-format stream-json --verbose \"<exact \u00a75 prompt>\"'], ['identity-name', 'the repository-local user.name command (section 6)'], ['identity-email', 'the repository-local user.email command (section 6)'], ['identity-status', 'the status command git status --porcelain -uall (section 6)'], ['identity-order', 'the identity commands before the status command, in that order (section 6)'], ['invariant-fence', 'the single markdown fence of section 6 holds the exact seven-line Lock order unit, byte for byte (the shared constant)'], ['O3-paragraph', 'the full dated project-control probe paragraph of 2026-11-15'], ['O3-denial', 'the probe paragraph records the refused read under the project Read deny rule'], ['O3-blocked', 'the probe paragraph records the raw Git command blocked by the project hook'], ['O3-no-disclosure', 'the probe paragraph records that the canary content did not appear in the transcript'], ['O3-cleanup', 'the probe paragraph records the canary removal and the clean fixture'], ['intro', 'the 3.2.0 introduction (stage 2 signed off, the pointer to the per-row results file, the three dated probes still recorded, the 3.1.0 and 3.2.0 release-notes pointers)'], ['intro-stale-statement', 'the stale blanket statement \"Nothing below has been run\" is gone'], ['limit-1', 'section 4 carries the navigation-token sentence of the pointer limitation'], ['limit-2', 'section 4 carries the distinctive-token guidance'], ['limit-3', 'section 4 carries the stale-historical-mention sentence'], ['baseline-trust', 'section 4 keeps the baseline-trust limitation'], ['matrix', 'section 7 keeps every matrix row and cell unchanged (digest of the 17 table lines)']]) G(`${id}: ${label}`, Array.isArray(real) && !real.includes(id), real);\n",
    after: "",
  }),
  BT320_13: Object.freeze({
    file: "tests/bs-doc-map.test.mjs",
    before: "",
    old: "  G('mutant: reflowing the whitespace of a prose pin, adding a blockquote marker, backticks or curly quotes keeps it met (the pins are tolerant of formatting only)', (() => { const t = REQS.find(([id]) => id === 'P01')[2]; const d = change(REF, t, `> Include \\`.project-setup.bak-*\\` installer\\n> backups when checking for duplicate PS copies;   disable a discoverable backup through the host\u2019s skill\\n> selection without moving the installer backup.`); return !failsWith(d, 'P01'); })());\n",
    neu: "  // The pin is tolerant of formatting only (3.2.0: P01 is now the step 1 move instruction; the reflow is derived from the pin so it cannot drift from it).\n  G('mutant: reflowing the whitespace of a prose pin, adding a blockquote marker or a line break keeps it met (the pins are tolerant of formatting only)', (() => { const t = REQS.find(([id]) => id === 'P01')[2]; const reflowed = `> ${t.split(' ').map((w, i) => w + (i % 6 === 5 ? '\\n> ' : i % 4 === 3 ? '   ' : ' ')).join('').trim()}`; const d = change(REF, t, reflowed); return d !== null && reflowed !== t && !failsWith(d, 'P01'); })());\n  // AC-C1-1 (plan C1, D-14): the new step 1 sentence is pinned and the old one is rejected. Each part of the new sentence is its own mutant: the move, the rolledback directories, the destination, the record and the detect requirement.\n  G('P01 negative control: the old step 1 instruction (disable a discoverable backup, \"without moving the installer backup\") put back in place of the new one fails P01', failsWith(change(REF, REQS.find(([id]) => id === 'P01')[2], OLD_P01), 'P01'));\n  for (const [label, from, to] of [\n    ['\"Move\" changed to \"Copy\"', 'Move every `.project-setup.bak-*`', 'Copy every `.project-setup.bak-*`'],\n    ['the .meta.json requirement dropped', ' together with its `.meta.json`', ''],\n    ['the rolledback directories dropped', ', and every `.project-setup.rolledback-*` directory,', ''],\n    ['\"both skills directories\" narrowed to one', 'out of both skills directories', 'out of the Claude skills directory'],\n    ['the destination changed', 'D:\\\\ps-live\\\\preserved\\\\installer-backups\\\\<target>\\\\', 'D:\\\\ps-live\\\\backups\\\\'],\n    ['the record of the original path dropped', '; record each original path', ''],\n    ['the detect requirement weakened from \"require an empty\" to \"look at\"', 'require an empty `installerBackups`', 'look at `installerBackups`'],\n    ['the detect.mjs run dropped', '; run `detect.mjs` and require an empty `installerBackups`', ''],\n  ]) G(`mutant: the step 1 sentence with ${label} fails P01`, failsWith(change(REF, from, to), 'P01'));\n",
    after: "",
  }),
  BT320_14: Object.freeze({
    file: "tests/bs-doc-map.test.mjs",
    before: "",
    old: "",
    neu: "  // AC-C2-2 (plan C2): the document and the pin move together. The old paragraph put back fails intro; so does either one edited without the other.\n  G('mutant: the old \"pending stage-2 acceptance sign-off\" introduction put back in place of the 3.2.0 one fails intro (and the 3.1.0 text is not the 3.2.0 text)', OLD_INTRO !== INTRO && !OLD_INTRO.includes('stage 2 signed off') && failsWith(change(REF, INTRO, OLD_INTRO), 'intro'));\n  G('AC-C2-2: the document edited and the pin not fails intro (the 3.2.0 document checked against the 3.1.0 pin)', (() => { const p = attempt(() => procProblems(REF, OLD_INTRO)); return Array.isArray(p) && p.includes('intro'); })());\n  G('AC-C2-2: the pin edited and the document not fails intro (the 3.1.0 document checked against the 3.2.0 pin)', (() => { const d = change(REF, INTRO, OLD_INTRO); const p = d === null ? null : attempt(() => procProblems(d, INTRO)); return Array.isArray(p) && p.includes('intro'); })());\n  G('AC-C2-2: the document and the pin both edited (the 3.1.0 document against the 3.1.0 pin) is met, so the failure above is the disagreement and not the text itself', (() => { const d = change(REF, INTRO, OLD_INTRO); const p = d === null ? null : attempt(() => procProblems(d, OLD_INTRO)); return Array.isArray(p) && !p.includes('intro'); })());\n  G('mutant: one clause of the 3.2.0 introduction dropped fails intro (the results-file pointer, the release-notes pointers, the dated probes)', ['`docs/plans/2026-11-22-project-setup-v3.1-live-acceptance-results.md`', '`RELEASE-NOTES-3.1.0.md`', '`RELEASE-NOTES-3.2.0.md`', 'the 2026-11-15 project-control probe'].every((part) => failsWith(change(REF, INTRO, INTRO.replace(part, '')), 'intro')));\n",
    after: "  G('mutant: a matrix cell changed fails the matrix pin; a deleted row fails it; a row added fails it', failsWith(change(REF, MATRIX_ROWS[2], MATRIX_ROWS[2].replace('| not measured (Codex fixtures are clones) |', '| recorded |')), 'matrix') && failsWith(remove(REF, `${MATRIX_ROWS[5]}\\n`), 'matrix') && failsWith(change(REF, MATRIX_ROWS[16], `${MATRIX_ROWS[16]}\\n| P9 extra | not measured | not measured |`), 'matrix'));\n",
  }),

  // tests/live/bs-doc-map.mjs
  LH320_1: Object.freeze({
    file: "tests/live/bs-doc-map.mjs",
    before: "",
    old: "/** Findings for a root CLAUDE.md after PS recovery (plan section 5 table, first row): one import, one valid current claude block, BS lines and user text kept. */\nexport function checkClaudeRecovery({ text, templateText, bsImports = [], bsVersionSentence = null, userLines = [] }) {\n",
    neu: "// ------------------------------------------------- 3.2.0 (A1): partial agent layers ----\n// The closed set of four Subagents lines of references/docs-generation.md (\"Subagents line variants\") and the closed set of three AGENTS.md agents-block sentences.\n// A layer is full when both Claude agents load their canonical definition from .ai/agents/, and otherwise names the agent that is a RETAINED project agent. The first line\n// is the template line byte for byte. Nothing else is accepted: a fifth wording, a line of another layer or a near miss is a finding.\nexport const AGENT_LAYERS = Object.freeze(['full', 'docs-sync-retained', 'reviewer-retained', 'both-retained']);\nexport const SUBAGENTS_LINES = Object.freeze({\n  full: '- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; both load their canonical definition from `.ai/agents/`.',\n  'docs-sync-retained': '- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; only `reviewer` loads its canonical definition from `.ai/agents/`. `docs-sync` is a retained project agent (incomplete project-setup agent update).',\n  'reviewer-retained': '- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; only `docs-sync` loads its canonical definition from `.ai/agents/`. `reviewer` is a retained project agent (incomplete project-setup agent update).',\n  'both-retained': '- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; both are retained project agents and neither loads a canonical definition from `.ai/agents/` (incomplete project-setup agent update).',\n});\nexport const AGENTS_LAYER_SENTENCES = Object.freeze({\n  'docs-sync-retained': 'Exception in Claude Code: `docs-sync` is a retained project agent and does not load its canonical definition (incomplete project-setup agent update).',\n  'reviewer-retained': 'Exception in Claude Code: `reviewer` is a retained project agent and does not load its canonical definition (incomplete project-setup agent update).',\n  'both-retained': 'Exception in Claude Code: `reviewer` and `docs-sync` are retained project agents and do not load their canonical definitions (incomplete project-setup agent update).',\n});\nconst SUBAGENTS_PREFIX = '- Subagents:';\n/** The template claude block with its Subagents line replaced by the line of the layer (the full layer keeps the template line as it is). null when the layer is unknown or a partial layer has no line to replace. */\nfunction expectedClaudeInner(templateInner, agentLayer) {\n  if (!AGENT_LAYERS.includes(agentLayer)) return null;\n  if (agentLayer === 'full') return normalizeEol(templateInner);\n  const ls = normalizeEol(templateInner).split('\\n');\n  const at = ls.findIndex((l) => l.startsWith(SUBAGENTS_PREFIX));\n  if (at === -1) return null;\n  ls[at] = SUBAGENTS_LINES[agentLayer];\n  return ls.join('\\n');\n}\n/** True when the Levenshtein distance of a and b is at most k (a banded comparison: it gives up as soon as the row minimum exceeds k). */\nfunction editDistanceWithin(a, b, k) {\n  if (Math.abs(a.length - b.length) > k) return false;\n  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);\n  for (let i = 1; i <= a.length; i += 1) {\n    const cur = [i];\n    let min = i;\n    for (let j = 1; j <= b.length; j += 1) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < min) min = cur[j]; }\n    if (min > k) return false;\n    prev = cur;\n  }\n  return prev[b.length] <= k;\n}\n/**\n * The agent layer one run installed, from the per-agent dispositions of the evidence (agents: { reviewer: { disposition }, docs-sync: { disposition } }, the values checkAgentRecovery\n * takes) and the installed Claude wrapper texts (installedTexts: { reviewer: text|null, docs-sync: text|null }, the content of .claude/agents/<name>.md). An agent is canonical when\n * its disposition is take-new, or merge and the installed text references .ai/agents/<name>.md (the test classifyBsOutcome applies); it is retained for keep, and for merge without\n * that reference. The layer names the retained agent(s). Throws a coded error on a disposition it does not know: a layer is never guessed.\n */\nexport function agentLayerOf(evidenceAgents, installedTexts) {\n  const canonical = (name) => {\n    const a = ownOf(evidenceAgents ?? {}, name);\n    const d = a !== undefined && a !== null ? ownOf(a, 'disposition') : undefined;\n    if (d === 'take-new') return true;\n    if (d === 'keep') return false;\n    if (d === 'merge') { const t = ownOf(installedTexts ?? {}, name); return typeof t === 'string' && new RegExp(`\\\\.ai/agents/${esc(name)}\\\\.md`).test(t); }\n    throw Object.assign(new Error(`the disposition of ${name} is not take-new, keep or merge: ${String(d)}`), { code: 'AGENT_LAYER' });\n  };\n  const reviewer = canonical('reviewer');\n  const docsSync = canonical('docs-sync');\n  if (reviewer && docsSync) return 'full';\n  if (reviewer) return 'docs-sync-retained';\n  if (docsSync) return 'reviewer-retained';\n  return 'both-retained';\n}\n// Plan A1 item 2 and 11.1 R2-10: the order of the agents block is fixed. The template sentence below, then the layer sentence (a partial layer only) as its own line directly after it,\n// then the two template paragraphs, the delegation paragraph [AT320_2] and the managed-block marker paragraph [AT320_1].\nexport const AGENTS_LAYER_ANCHOR = 'Do not create an ad-hoc agent for the same job.';\nconst AGENTS_DELEGATE_PREFIX = 'When you delegate to `reviewer` or `docs-sync`';\nconst AGENTS_MARKER_PREFIX = 'Text between `<!-- project-setup:begin';\n/**\n * Findings (code agents-layer-sentence) for the AGENTS.md agents block against the layer: a partial layer needs exactly the one matching sentence, a full layer carries none of the\n * three, no other wording is accepted (a near miss is a finding) and a sentence the reader cannot see (inside an HTML comment) does not count. Position is judged for a partial layer\n * whose one sentence is present: it MUST be the line directly after the template sentence AGENTS_LAYER_ANCHOR and before the delegation paragraph and the marker paragraph (details\n * start with \"position:\"). A sentence before the anchor, after both paragraphs, between them or separated from the anchor by a line is a finding; so is a block without the anchor.\n */\nexport function checkAgentsLayerSentence({ agentsText, agentLayer }) {\n  const f = [];\n  const add = (detail) => f.push({ code: 'agents-layer-sentence', detail });\n  if (!AGENT_LAYERS.includes(agentLayer)) { add(`unknown agent layer ${String(agentLayer)}`); return f; }\n  const p = parseBlocks(agentsText);\n  const blk = p.errors.length === 0 ? p.blocks.filter((b) => b.id === 'agents') : [];\n  if (blk.length !== 1) { add(`expected exactly one managed agents block, found ${blk.length}${p.errors.length > 0 ? ` (${p.errors[0]})` : ''}`); return f; }\n  const sentences = Object.values(AGENTS_LAYER_SENTENCES);\n  // A candidate is a line that starts like a layer sentence, or is within a few characters of one (a changed character in the prefix is a near miss, not an absent line). The managed-block\n  // rule paragraph of the same block (A2) says \"retained project agent\" in its own words and is none of these: matching on that phrase would count it.\n  const isCandidate = (l) => /^\\s*Exception in Claude Code\\b/i.test(l) || sentences.some((s) => editDistanceWithin(l.trim(), s, 6));\n  const raw = normalizeEol(blk[0].inner).split('\\n').filter(isCandidate).map((l) => l.trim());\n  const seen = normalizeEol(visibleText(blk[0].inner)).split('\\n').filter(isCandidate).map((l) => l.trim());\n  const exactly = (list, s) => list.filter((l) => l === s).length;\n  // Order of the two template paragraphs (plan A1 item 2: [AT320_2] then [AT320_1]) holds in every layer.\n  {\n    const ls = normalizeEol(blk[0].inner).split('\\n');\n    const dI = ls.findIndex((l) => l.startsWith(AGENTS_DELEGATE_PREFIX));\n    const mI = ls.findIndex((l) => l.startsWith(AGENTS_MARKER_PREFIX));\n    if (dI !== -1 && mI !== -1 && mI < dI) add('position: the managed-block marker paragraph is before the delegation paragraph; the delegation paragraph comes first, then the marker paragraph');\n  }\n  if (agentLayer === 'full') {\n    if (raw.length > 0) add(`a full layer carries no layer sentence, found ${raw.length}`);\n    return f;\n  }\n  const want = AGENTS_LAYER_SENTENCES[agentLayer];\n  if (exactly(seen, want) === 0) add(`the ${agentLayer} layer needs this sentence in the agents block: ${want}`);\n  if (raw.length > 1) add(`a partial layer carries exactly one sentence, found ${raw.length}`);\n  for (const l of raw) if (l !== want) add(sentences.includes(l) ? `a sentence of another layer: ${l.slice(0, 80)}` : `a near miss, not one of the three sentences: ${l.slice(0, 80)}`);\n  // Position (R3): judged on the lines of the block as written, and only when the sentence is there exactly once (a missing or repeated sentence is already a finding above).\n  const lines = normalizeEol(blk[0].inner).split('\\n');\n  const at = lines.flatMap((l, i) => (l.trim() === want ? [i] : []));\n  if (at.length === 1) {\n    const anchors = lines.flatMap((l, i) => (l.includes(AGENTS_LAYER_ANCHOR) ? [i] : []));\n    if (anchors.length !== 1) add(`position: the template sentence \"${AGENTS_LAYER_ANCHOR}\" is expected exactly once in the agents block, found ${anchors.length}, so the place of the layer sentence cannot be established`);\n    else {\n      const s = at[0]; const a = anchors[0];\n      if (s < a) add('position: the layer sentence is before the template sentence; it goes directly after \"Do not create an ad-hoc agent for the same job.\"');\n      else if (s !== a + 1) add(`position: the layer sentence is ${s - a - 1} line(s) after the line of the template sentence; it is the line directly after it`);\n      for (const [name, prefix] of [['delegation', AGENTS_DELEGATE_PREFIX], ['managed-block marker', AGENTS_MARKER_PREFIX]]) {\n        const p = lines.findIndex((l) => l.startsWith(prefix));\n        if (p !== -1 && s > p) add(`position: the layer sentence is after the ${name} paragraph; it goes before both template paragraphs`);\n      }\n    }\n  }\n  return f;\n}\n\n/**\n * Findings for a root CLAUDE.md after PS recovery (plan section 5 table, first row): one import, one valid current claude block, BS lines and user text kept.\n * 3.2.0 (A1): agentLayer (full by default, docs-sync-retained, reviewer-retained or both-retained) selects the expected block: the template block with its Subagents line replaced by the\n * matching variant. Exactly four blocks are accepted in total; an unknown layer is a finding of its own and compares nothing.\n */\nexport function checkClaudeRecovery({ text, templateText, bsImports = [], bsVersionSentence = null, userLines = [], agentLayer = 'full' }) {\n",
    after: "",
  }),
  LH320_2: Object.freeze({
    file: "tests/live/bs-doc-map.mjs",
    before: "",
    old: "    if (want === undefined || normalizeEol(blocks[0].inner) !== normalizeEol(want.inner)) add('claude-block-content', 'the managed claude block is not the current source-template content (root-start rule included)');\n",
    neu: "    const expected = want === undefined ? null : expectedClaudeInner(want.inner, agentLayer);\n    if (!AGENT_LAYERS.includes(agentLayer)) add('agent-layer', `unknown agent layer ${String(agentLayer)}`);\n    else if (expected === null || normalizeEol(blocks[0].inner) !== expected) add('claude-block-content', `the managed claude block is not the current source-template content with the Subagents line of the ${agentLayer} layer (root-start rule included)`);\n",
    after: "",
  }),
  LH320_3: Object.freeze({
    file: "tests/live/bs-doc-map.mjs",
    before: "",
    old: "",
    neu: "// ------------------------------------------------- 3.2.0 (A3, A7, A8): applicability, configuration, strictness ----\n// Test-only checkers for the applicability rule of references/docs-generation.md (\"Applicability (one rule for every mode)\"). They judge what a run LEFT, from independently supplied\n// lists and the project's files; whether an agent applies the rule identically in adopt and update stays a live measurement. Each returns [{ code, detail }].\nconst samePathSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));\n/**\n * approved: the documents the owner approved as applicable in Phase 0 (paths); confirmed: the set Phase 1 confirmed; pointers: the pointer documents installed; navigationRefs: the\n * mapped-document paths the navigation block references. Findings: pointer-not-approved (an installed pointer Phase 0 did not list as applicable, for example one marked \"not\n * applicable\"), approved-pointer-missing (an approved document with no installed pointer), dangling-navigation (a navigation reference to a mapped path that is not installed, so\n * reference-exists would fail on it) and confirmed-differs-from-approved (Phase 1 confirmed another set than Phase 0 approved, which setup MUST have stopped on and asked again).\n */\nexport function checkApplicability({ approved, confirmed, pointers, navigationRefs }) {\n  const f = [];\n  const list = (v) => (Array.isArray(v) ? v : []);\n  const a = list(approved); const c = list(confirmed); const p = list(pointers); const n = list(navigationRefs);\n  if (!samePathSet(a, c)) f.push({ code: 'confirmed-differs-from-approved', detail: `approved ${JSON.stringify([...a].sort())}, confirmed ${JSON.stringify([...c].sort())}` });\n  for (const x of p) if (!a.includes(x)) f.push({ code: 'pointer-not-approved', detail: x });\n  for (const x of a) if (!p.includes(x)) f.push({ code: 'approved-pointer-missing', detail: x });\n  for (const x of n) if (!p.includes(x)) f.push({ code: 'dangling-navigation', detail: x });\n  return f;\n}\nconst CONFIG_COLUMNS = Object.freeze(['variable', 'required', 'classification', 'used by', 'description', 'source']);\nconst tableRows = (text) => normalizeEol(text).split('\\n').filter((l) => /^\\s*\\|.*\\|\\s*$/.test(l)).map((l) => l.trim().replace(/^\\||\\|$/g, '').split(/(?<!\\\\)\\|/).map((c) => c.trim()));\nconst isSeparatorRow = (cells) => cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));\n// A cell that looks like a VALUE and not a description: an assignment NAME=value, a credential in a URL, a long token or a well-known secret prefix.\nconst VALUE_SHAPED = [/(?:^|[\\s`(])[A-Z][A-Z0-9_]{2,}\\s*=\\s*\\S+/, /:\\/\\/[^\\s/:@]+:[^\\s/@]+@/, /\\b[A-Za-z0-9+/_-]{32,}={0,2}(?![A-Za-z0-9+/_-])/, /\\b(?:sk|pk|ghp|gho|xox[bap])[-_][A-Za-z0-9_-]{10,}/, /\\bBearer\\s+[A-Za-z0-9._~+/-]{8,}/i];\n// A claim that the configuration conversion is complete, after the negated forms (\"not complete\", \"incomplete\") are removed.\nconst COMPLETION_CLAIM = [/\\b(?:configuration|conversion|consolidation|inventory)\\b[^.\\n]{0,60}\\b(?:complete|completed|done|finished)\\b/i, /\\b(?:complete|completed|done|finished)\\b[^.\\n]{0,40}\\b(?:configuration|conversion|consolidation|inventory)\\b/i];\nconst stripNegatedCompletion = (t) => t.replace(/\\b(?:not|never|no longer|n't)\\s+(?:\\w+\\s+){0,2}(?:complete|completed|done|finished)\\b/gi, ' ').replace(/\\bincomplete\\b/gi, ' ');\n/**\n * architectureText: the target project's 03; names: the variable names the code evidences; declined: the owner declined the proposal. Not declined: the Configuration section\n * needs a table with the columns variable, required, classification, used by, description and source, one row per name. Findings config-row-missing:<name> (also for a header with no\n * row), config-cell-empty:<name>:<column> (also for a column the header lacks) and config-value-shaped (a cell holding a value: values never appear). Declined: the only finding is\n * config-completion-claimed, when the Configuration section claims the conversion is complete.\n */\nexport function checkConfigurationInventory({ architectureText, names, declined = false }) {\n  const f = [];\n  const doc = parseHeadingDoc(architectureText);\n  const r = resolveHeading(doc, parseBulletRef('Configuration'));\n  const section = r.status === 'ok' ? sectionText(doc, r.heading) : '';\n  if (declined === true) {\n    if (COMPLETION_CLAIM.some((re) => re.test(stripNegatedCompletion(section)))) f.push({ code: 'config-completion-claimed', detail: 'the Configuration section claims a completed conversion although the owner declined the proposal' });\n    return f;\n  }\n  const rows = tableRows(section);\n  const headerAt = rows.findIndex((cells) => !isSeparatorRow(cells));\n  const header = headerAt === -1 ? [] : rows[headerAt].map((c) => c.toLowerCase());\n  const body = headerAt === -1 ? [] : rows.slice(headerAt + 1).filter((cells) => !isSeparatorRow(cells));\n  const col = (name) => header.indexOf(name);\n  const byName = new Map();\n  for (const cells of body) { const v = (cells[Math.max(col('variable'), 0)] ?? '').replace(/`/g, '').trim(); if (v !== '' && !byName.has(v)) byName.set(v, cells); }\n  for (const n of Array.isArray(names) ? names : []) {\n    const cells = byName.get(n);\n    if (cells === undefined) { f.push({ code: `config-row-missing:${n}`, detail: 'no row of the Configuration table names this variable' }); continue; }\n    for (const c of CONFIG_COLUMNS) { const i = col(c); if (i === -1 || (cells[i] ?? '').replace(/`/g, '').trim() === '') f.push({ code: `config-cell-empty:${n}:${c}`, detail: 'the cell is empty or the table has no such column' }); }\n  }\n  for (const [n, cells] of byName) cells.forEach((cell, i) => { if (i !== col('variable') && VALUE_SHAPED.some((re) => re.test(cell))) f.push({ code: 'config-value-shaped', detail: `${n}: ${CONFIG_COLUMNS[i] ?? `column ${i}`}` }); });\n  return f;\n}\n/** tsconfig text as JSON: comments and trailing commas removed outside strings. null when it still does not parse. */\nexport function parseTsconfig(text) {\n  let out = ''; let i = 0; const t = String(text).replace(/^\\uFEFF/, '');\n  while (i < t.length) {\n    const c = t[i];\n    if (c === '\"') { let j = i + 1; while (j < t.length && t[j] !== '\"') j += t[j] === '\\\\' ? 2 : 1; out += t.slice(i, j + 1); i = j + 1; }\n    else if (c === '/' && t[i + 1] === '/') { while (i < t.length && t[i] !== '\\n') i += 1; }\n    else if (c === '/' && t[i + 1] === '*') { const j = t.indexOf('*/', i + 2); i = j === -1 ? t.length : j + 2; }\n    else { out += c; i += 1; }\n  }\n  try { return JSON.parse(out.replace(/,(\\s*[}\\]])/g, '$1')); } catch { return null; }\n}\nexport const STRICT_FLAGS = Object.freeze(['strictNullChecks', 'strictFunctionTypes', 'strictBindCallApply', 'strictPropertyInitialization', 'noImplicitAny', 'noImplicitThis', 'useUnknownInCatchVariables', 'alwaysStrict']);\n/**\n * architectureText: the target project's 03; tsconfigText: the root tsconfig.json as written; declined: the owner declined the proposal (nothing is judged: setup reports the\n * omission and writes nothing). Not declined: the \"CI/CD and tooling\" section states the compiler strictness as written: strict and each individual strict flag that is set\n * (shapes \"strict: true\", \"strict = true\", \"strict is true\"), or \"strict not set\", and names the extended file when tsconfig.json extends one. Findings strictness-missing (no\n * statement) and strictness-mismatch (a value, a flag or the \"not set\" claim differs from the file, or the extended file is not named, or the file does not parse: unavailable evidence,\n * reported before any statement is judged).\n */\nexport function checkStrictness({ architectureText, tsconfigText, declined = false }) {\n  if (declined === true) return [];\n  const f = [];\n  const doc = parseHeadingDoc(architectureText);\n  const r = resolveHeading(doc, parseBulletRef('CI/CD and tooling'));\n  const section = r.status === 'ok' ? sectionText(doc, r.heading) : '';\n  const ts = parseTsconfig(tsconfigText);\n  // A tsconfig.json that does not parse (a truncated file, a literal that is not an object) is unavailable evidence: no statement can be judged against it, and reading it as \"no\n  // options\" would accept an unsupported \"strict not set\" (R4). A compilerOptions that is present and not an object is the same: it is not \"no options\".\n  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);\n  if (!isObj(ts) || (ts.compilerOptions !== undefined && !isObj(ts.compilerOptions))) {\n    f.push({ code: 'strictness-mismatch', detail: 'tsconfig.json does not parse as a tsconfig (not a JSON object, or compilerOptions is not an object): the strictness statement cannot be checked against it' });\n    return f;\n  }\n  const co = isObj(ts.compilerOptions) ? ts.compilerOptions : {};\n  const mentions = (name) => new RegExp(`\\\\b${name}\\\\b`, 'i');\n  const stated = normalizeEol(section).split('\\n').filter((l) => mentions('strict').test(l) || STRICT_FLAGS.some((x) => mentions(x).test(l))).join('\\n');\n  if (stated === '') { f.push({ code: 'strictness-missing', detail: 'the CI/CD and tooling section states no compiler strictness' }); return f; }\n  const mismatch = (detail) => f.push({ code: 'strictness-mismatch', detail });\n  const valueOf = (name) => { const m = new RegExp(`\\\\b${name}\\\\b[\\`*]*\\\\s*(?::|=|is|set to|=>)?\\\\s*[\\`*]*\\\\s*(true|false)\\\\b`, 'i').exec(stated); return m === null ? undefined : m[1].toLowerCase() === 'true'; };\n  const set = ['strict', ...STRICT_FLAGS].filter((n) => typeof co[n] === 'boolean');\n  if (set.length === 0) { if (!/\\bstrict\\b[`*]*\\s+not\\s+set\\b/i.test(stated)) mismatch('tsconfig.json sets no strict option, so the statement must say \"strict not set\"'); }\n  else {\n    for (const n of set) { const v = valueOf(n); if (v === undefined) mismatch(`${n} is set in tsconfig.json (${co[n]}) and is not stated`); else if (v !== co[n]) mismatch(`${n} is ${co[n]} in tsconfig.json, the statement says ${v}`); }\n    if (/\\bstrict\\b[`*]*\\s+not\\s+set\\b/i.test(stated)) mismatch('the statement says \"strict not set\" although tsconfig.json sets strict options');\n  }\n  for (const n of ['strict', ...STRICT_FLAGS]) if (typeof co[n] !== 'boolean' && valueOf(n) !== undefined) mismatch(`${n} is stated but tsconfig.json does not set it`);\n  if (ts !== null && typeof ts.extends === 'string' && !normalizeEol(section).includes(ts.extends)) mismatch(`tsconfig.json extends ${ts.extends}; the statement must name the extended file`);\n  return f;\n}\n\n",
    after: "// ------------------------------------------------------------------- snapshots ----\n",
  }),
  LH320_4: Object.freeze({
    file: "tests/live/bs-doc-map.mjs",
    before: "",
    old: "export const SNAPSHOT_FILES = Object.freeze(['AGENTS.md', 'CLAUDE.md', 'TODO.md', STAMP_REL, '.toolchain-config.json', '.ai/manifest.json', '.ai/security-paths.json', '.claude/settings.json']);\n",
    neu: "export const SNAPSHOT_FILES =Object.freeze(['AGENTS.md', 'CLAUDE.md', 'TODO.md', STAMP_REL, '.toolchain-config.json', '.ai/manifest.json', '.ai/security-paths.json', '.claude/settings.json']);\n",
    after: "",
  }),
  LH320_5: Object.freeze({
    file: "tests/live/bs-doc-map.mjs",
    before: "",
    old: "export const EVIDENCE_KEYS = Object.freeze(['schema', 'layout', 'conversion', 'pointers', 'fullDocuments', 'inventory', 'dispositions', 'claude', 'agents', 'extensions', 'expectPartial', 'explained', 'nested', 'unrelatedAgentsLines']);\n",
    neu: "// 3.2.0 (A3): applicability, configuration and strictness are OPTIONAL evidence: absent, the checker it stands for does not run (evidence files of earlier procedures stay valid).\nexport const EVIDENCE_KEYS = Object.freeze(['schema', 'layout', 'conversion', 'pointers', 'fullDocuments', 'inventory', 'dispositions', 'claude', 'agents', 'extensions', 'expectPartial', 'explained', 'nested', 'unrelatedAgentsLines', 'applicability', 'configuration', 'strictness']);\n",
    after: "",
  }),
  LH320_6: Object.freeze({
    file: "tests/live/bs-doc-map.mjs",
    before: "",
    old: "",
    neu: "  if (hasOwn(evidence, 'applicability')) {\n    const a = evidence.applicability;\n    if (!isRecord(a) || !isPathList(a.approved) || !isPathList(a.confirmed) || Object.keys(a).some((k) => !['approved', 'confirmed'].includes(k))) p.push('evidence.applicability must be { approved: [rel], confirmed: [rel] } (the Phase 0 list and the Phase 1 set of applicable mapped documents)');\n  }\n  if (hasOwn(evidence, 'configuration')) {\n    const c = evidence.configuration;\n    if (!isRecord(c) || !isLineList(c.names) || (hasOwn(c, 'declined') && typeof c.declined !== 'boolean') || Object.keys(c).some((k) => !['names', 'declined'].includes(k))) p.push('evidence.configuration must be { names: [variable name], declined?: boolean }');\n  }\n  if (hasOwn(evidence, 'strictness')) {\n    const s = evidence.strictness;\n    if (!isRecord(s) || (hasOwn(s, 'declined') && typeof s.declined !== 'boolean') || Object.keys(s).some((k) => k !== 'declined')) p.push('evidence.strictness must be { declined?: boolean }');\n  }\n",
    after: "  if (hasOwn(evidence, 'expectPartial') && evidence.expectPartial !== (expectPartial === true)) p.push('evidence.expectPartial contradicts the expectation the verification was started with');\n",
  }),
  LH320_7: Object.freeze({
    file: "tests/live/bs-doc-map.mjs",
    before: "",
    old: "    const f = checkClaudeRecovery({ text: read('CLAUDE.md') ?? '', templateText: fs.readFileSync(path.join(SKILL_ROOT, 'assets', 'templates', 'CLAUDE.md'), 'utf8'), bsImports: ownOf(c, 'bsImports'), bsVersionSentence: ownOf(c, 'bsVersionSentence'), userLines: ownOf(c, 'userLines') });\n",
    neu: "    // 3.2.0 (A1): the layer the run installed comes from the per-agent dispositions and the installed wrappers, never from the evidence alone (a merge counts only with the canonical reference).\n    const agentLayer = agentLayerOf(evidence.agents, Object.fromEntries(AGENT_NAMES.map((n) => [n, read(`.claude/agents/${n}.md`)])));\n    const f = checkClaudeRecovery({ text: read('CLAUDE.md') ?? '', templateText: fs.readFileSync(path.join(SKILL_ROOT, 'assets', 'templates', 'CLAUDE.md'), 'utf8'), bsImports: ownOf(c, 'bsImports'), bsVersionSentence: ownOf(c, 'bsVersionSentence'), userLines: ownOf(c, 'userLines'), agentLayer });\n",
    after: "",
  }),
  LH320_8: Object.freeze({
    file: "tests/live/bs-doc-map.mjs",
    before: "    check(f.length === 0, 'CLAUDE.md: import, managed block with the root-start rule, BS lines and user content', f);\n",
    old: "",
    neu: "    if (agentsText !== null) { const g = checkAgentsLayerSentence({ agentsText, agentLayer }); check(g.length === 0, 'AGENTS.md: the agents block states the installed agent layer (exactly one matching sentence in a partial layer, none in a full layer)', g); }\n  }\n  // 3.2.0 (A3, A7, A8): the three optional checkers of the applicability rule, each run only when the evidence supplies its input.\n  if (hasOwn(evidence, 'applicability')) {\n    const navBlock = agentsText === null ? undefined : parseBlocks(agentsText).blocks.find((b) => b.id === 'navigation');\n    const refs = navBlock === undefined ? [] : [...new Set([...visibleText(navBlock.inner).matchAll(/`([^`\\n]+\\.md)`/g)].map((m) => m[1]).filter((r) => mappingRefsFor(r) !== null))];\n    const f = checkApplicability({ approved: evidence.applicability.approved, confirmed: evidence.applicability.confirmed, pointers: pointerRels, navigationRefs: refs });\n    check(f.length === 0, 'applicability: the installed pointers are exactly the approved set, Phase 1 confirmed that set and no navigation reference dangles', f);\n  }\n  if (hasOwn(evidence, 'configuration')) {\n    const f = checkConfigurationInventory({ architectureText: read(BS_03_REL) ?? '', names: evidence.configuration.names, declined: evidence.configuration.declined === true });\n    check(f.length === 0, 'configuration: the Configuration table of 03 has a filled row for every evidenced variable and no value (declined: no claim of a finished conversion)', f);\n  }\n  if (hasOwn(evidence, 'strictness')) {\n    const tsText = read('tsconfig.json'); // an absent tsconfig.json has nothing to state; an unreadable one is not evaluable (need records it)\n    if (tsText !== null) { const f = checkStrictness({ architectureText: read(BS_03_REL) ?? '', tsconfigText: tsText, declined: evidence.strictness.declined === true }); check(f.length === 0, 'strictness: 03 states the compiler strictness of tsconfig.json as written', f); }\n",
    after: "",
  }),

  // tests/live/BS-DOC-MAP-ACCEPTANCE.md
  AC320_1: Object.freeze({
    file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md",
    before: "",
    old: "Status: pending stage-2 acceptance sign-off. Dated live-run records are retained outside this\nmatrix. This procedure records the scoped 2026-11-14 Claude Code isolation probe, the 2026-11-15\ninit-event confirmation and the 2026-11-15 project-control probe below; it does not enter\nacceptance results or close checklist items. Stage 2 records the dated matrix results and TODO\ncloseout.\n",
    neu: "Status: stage 2 signed off. The section 7 matrix holds the dated results of 2026-11-14\nto 2026-11-22; the per-row record is\n`docs/plans/2026-11-22-project-setup-v3.1-live-acceptance-results.md`. This procedure\nstill records the scoped 2026-11-14 Claude Code isolation probe, the 2026-11-15\ninit-event confirmation and the 2026-11-15 project-control probe below. Rows that were\nnot measured are listed in `RELEASE-NOTES-3.1.0.md`; the 3.2.0 re-measurements are\nlisted in `RELEASE-NOTES-3.2.0.md`.\n",
    after: "",
  }),
  AC320_2: Object.freeze({
    file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md",
    before: "check instructions and a checker. They do not substitute for any row of the matrix below.\n",
    old: "",
    neu: "From 3.2.0 on, `tests/release-3.1.test.mjs` and `tests/c18.test.mjs` run only in the\nreconstructed 3.1.0 view (`tests/run-310-view.mjs`), not directly in the working tree.\n",
    after: "",
  }),
  AC320_3: Object.freeze({
    file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md",
    before: "",
    old: "1. Resolve duplicate plain, synced or plugin-provided copies. Include `.project-setup.bak-*`\n   installer backups when checking for duplicate PS copies; disable a discoverable backup through\n   the host's skill selection without moving the installer backup.\n",
    neu: "1. Move every `.project-setup.bak-*` directory together with its `.meta.json`, and every\n   `.project-setup.rolledback-*` directory, out of both skills directories into\n   `D:\\ps-live\\preserved\\installer-backups\\<target>\\`; record each original path; run\n   `detect.mjs` and require an empty `installerBackups`.\n",
    after: "",
  }),
  AC320_4: Object.freeze({
    file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md",
    before: "",
    old: "Moving an installer backup out of the skill directory breaks installer rollback, which restores\nfrom it; disable it in the host instead. The recorded interactive workaround disabled the backup\nwithout moving it. After the recorded Claude Code measurements, the two `.project-setup.bak-3.0.0-*`\n",
    neu: "Before any `install.mjs rollback`, move the newest backup directory and its `.meta.json` back\nto the recorded path, unmodified (rollback verifies the recorded digest), run rollback, then\n`verify`. After the recorded Claude Code measurements, the two `.project-setup.bak-3.0.0-*`\n",
    after: "",
  }),
  AC320_5: Object.freeze({
    file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md",
    before: "`docs/plans/2026-11-22-project-setup-v3.1-live-acceptance-results.md`).\n",
    old: "",
    neu: "Create fixtures only under a directory that already carries the CodexSandboxUsers\nread-and-execute entry, and check it before the first Codex run.\n",
    after: "",
  }),
  AC320_6: Object.freeze({
    file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md",
    before: "",
    old: "",
    neu: "For a Codex row, the parent directory also needs the ACL entry of section 2.\n\n",
    after: "`init` refuses existing destinations and linked aliases. For `ps-first` and `bs-existing`, scaffold\n",
  }),
  AC320_7: Object.freeze({
    file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md",
    before: "",
    old: "| Declined BS agent replacement | Separate BS-existing fixture; decline the docs-sync replacement; preserve its bytes, identify the invoked definition and report the incomplete PS agent layer. Verify with `--expect-partial`. |\n",
    neu: "| Declined BS agent replacement | Separate BS-existing fixture; decline the docs-sync replacement; preserve its bytes, identify the invoked definition and report the incomplete PS agent layer. Verify with `--expect-partial`; expect the docs-sync-retained Subagents line in CLAUDE.md and the matching `docs-sync` exception sentence in the AGENTS.md `agents` block (`references/docs-generation.md`, \"Subagents line variants\"). |\n",
    after: "",
  }),
  AC320_8: Object.freeze({
    file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md",
    before: "",
    old: "",
    neu: "From 3.2.0 the evidence may also carry the inputs of the three applicability checkers, each run\nonly when present: `applicability` as `{ \"approved\": [rel], \"confirmed\": [rel] }` (the Phase 0\nlist and the Phase 1 set of applicable mapped documents), `configuration` as\n`{ \"names\": [variable name], \"declined\": boolean }` (`declined` optional), and `strictness` as\n`{ \"declined\": boolean }` (`declined` optional; checked only when `tsconfig.json` exists).\n\n",
    after: "`verify` is advisory evidence collection, not an acceptance verdict. The acceptance decision is the\n",
  }),
  AC320_9: Object.freeze({
    file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md",
    before: "",
    old: "",
    neu: "Known gaps recorded by the 2026-11-14 to 2026-11-22 runs:\n\n- PS rows that were driven headless in auto permission mode are recorded as deviations from the\n  interactive `--permission-mode default` rule of section 1; they do not exercise PS's human\n  approval gates.\n- The user-level `code-review` skill was visible to an `--isolated` Codex run. For a Codex\n  reviewer measurement, remove it before the run or record its presence in the results row.\n\n",
    after: "## 6. Committed changes for the agent measurements\n",
  }),
  AC320_10: Object.freeze({
    file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md",
    before: "reviewer seed refuses with `REFUSED baseline` and names this section.\n\n",
    old: "",
    neu: "The wording of the Lock order rule used in the 2026-11-14 and 2026-11-22 measurements was\nnot recorded, so a new reviewer measurement with the unit above is not directly comparable\nwith those results; record that in the results row.\n\n",
    after: "",
  }),

  // @root/README.md
  RR320_1: Object.freeze({
    file: "@root/README.md",
    before: "",
    old: "`project-setup` (3.1.0, shared by Claude Code and Codex) is **not**\n",
    neu: "`project-setup` (3.2.0, shared by Claude Code and Codex) is **not**\n",
    after: "",
  }),
  RR320_2: Object.freeze({
    file: "@root/README.md",
    before: "",
    old: "See `project-setup/README.md` and `project-setup/RELEASE-NOTES-3.1.0.md` (compatibility,\nthe backend-standards documentation mapping and limitations). A project installed\n",
    neu: "See `project-setup/README.md` and `project-setup/RELEASE-NOTES-3.2.0.md` (compatibility,\nthe fixes to the 3.1.0 live acceptance findings, upgrade steps and limitations).\n`project-setup/RELEASE-NOTES-3.1.0.md` is the 3.1.0 history (the backend-standards\ndocumentation mapping and its live acceptance). A project installed\n",
    after: "",
  }),
  RR320_3: Object.freeze({
    file: "@root/README.md",
    before: "",
    old: "This installs `project-setup` 3.1.0 for both tools; update each project installed\n",
    neu: "This installs `project-setup` 3.2.0 for both tools; update each project installed\n",
    after: "",
  }),
  RR320_4: Object.freeze({
    file: "@root/README.md",
    before: "",
    old: "",
    neu: "The 3.2.0 changes are not yet measured on a host; before installing, read the \"Upgrading\" steps of\n`project-setup/RELEASE-NOTES-3.2.0.md` (installer backups, tracked root `env/` or `cert/` files).\n",
    after: "V2 validation rejects the schema-3 manifest of a migrated project, so roll the\n",
  }),
  RR320_5: Object.freeze({
    file: "@root/README.md",
    before: "",
    old: "\u251c\u2500\u2500 project-setup/               general-purpose \u2014 shared Claude Code + Codex setup (3.1.0, own installer and tests)\n",
    neu: "\u251c\u2500\u2500 project-setup/               general-purpose \u2014 shared Claude Code + Codex setup (3.2.0, own installer and tests)\n",
    after: "",
  }),

  // @root/TODO.md
  TD320_1: Object.freeze({
    file: "@root/TODO.md",
    before: "",
    old: "",
    neu: "  Status 2026-11-22: project-setup 3.2.0 ships both fixes as text only (the money-severity rule\n  of the canonical reviewer and the delegated-agent launch bullet); neither is measured. This\n  item stays until measurements D1 and D2 of docs/plans/2026-11-22-project-setup-v3.2.0-plan.md\n  are recorded.\n",
    after: "- **Dependency pins are 1\u20132 majors behind.** `eslint` 9\u219210, `@eslint/js` 9\u219210,\n",
  }),
  TD320_2: Object.freeze({
    file: "@root/TODO.md",
    before: "",
    old: "    backend-standards 3.1.0. Not exercised: the agents themselves, Codex, or PS then BS.\n",
    neu: "    backend-standards 3.1.0. The 3.1.0 live acceptance (2026-11-14 to 2026-11-22) exercised the\n    agents on both hosts and PS then BS (merge branch only). Not exercised: the BS overwrite\n    branch and Codex PS rows.\n",
    after: "",
  }),
  TD320_3: Object.freeze({
    file: "@root/TODO.md",
    before: "  Evidence: docs/plans/2026-10-25-project-setup-v3-rc3-c16-acceptance.md.\n",
    old: "",
    neu: "- backend-standards stamp behaviour differs between two existing-project runs. BS 3.1.0 wrote\n  .backend-standards.json on the PS-first fixture and not on the BS existing-project fixture\n  (2026-11-14). The existing-project procedure is documented as writing no stamp. Decide which is\n  intended and make the skill do it every time; project-setup accepts both signals.\n",
    after: "",
  }),
  TD320_4: Object.freeze({
    file: "@root/TODO.md",
    before: "  intended and make the skill do it every time; project-setup accepts both signals.\n",
    old: "",
    neu: "- project-setup installer backups live inside the skills directory. 3.2.0 makes detect report\n  them and documents the manual move. Moving the backup location out of host discovery is a\n  candidate for the next minor and needs the recorded skill-discovery probe (D8 of the 3.2.0\n  plan) first.\n",
    after: "",
  }),
  TD320_5: Object.freeze({
    file: "@root/TODO.md",
    before: "  plan) first.\n",
    old: "",
    neu: "- project-setup 3.1.0 rows not measured (`project-setup/RELEASE-NOTES-3.1.0.md`, \"Not\n  measured\"): the Codex P4 context check; the read-only and the documentation-writing\n  missing-destination cases, on either host; Codex PS rows; interactive default-mode PS rows for\n  the blank section, renamed heading, deleted pointer, local-instruction conflict and unchanged\n  rerun cases; a second Codex reviewer sample; the P8 Codex ownership grant (not obtainable as\n  specified while a wildcard `safe.directory` entry exists); the overwrite branch of the PS-first\n  recovery.\n",
    after: "",
  }),
  TD320_6: Object.freeze({
    file: "@root/TODO.md",
    before: "",
    old: "",
    neu: "- project-setup `apply.mjs prepare` accepts a draft that replaces an edited managed block without\n  `--approve-user-content` (the normal `--approved-plan` approval at commit still applies):\n  `onlyAddsBlocks` in `apply.mjs` compares only the text outside blocks,\n  so the 3.2.0 block-edit protection is instruction-level only. A machine check needs a planned\n  `apply.mjs` change and a deliberate update of the c16 case that pins today's behaviour.\n",
    after: "\n## Missing information\n",
  }),

  // @root/.ai/context/project-tree.md
  PT320_1: Object.freeze({
    file: "@root/.ai/context/project-tree.md",
    before: "",
    old: "\u251c\u2500\u2500 project-setup/              skill 3 \u2014 shared Claude Code + Codex agent scaffolding (3.1.0)\n",
    neu: "\u251c\u2500\u2500 project-setup/              skill 3 \u2014 shared Claude Code + Codex agent scaffolding (3.2.0)\n",
    after: "",
  }),
  PT320_2: Object.freeze({
    file: "@root/.ai/context/project-tree.md",
    before: "",
    old: "(`project-setup/VERSION` is `3.1.0`) with its own layout: `SKILL.md`,\n",
    neu: "(`project-setup/VERSION` is `3.2.0`) with its own layout: `SKILL.md`,\n",
    after: "",
  }),
  PT320_3: Object.freeze({
    file: "@root/.ai/context/project-tree.md",
    before: "",
    old: "",
    neu: "From 3.2.0 the standalone gates are `tests/release-3.2.0.test.mjs`, `tests/v320.test.mjs` and\n`tests/bs-doc-map.test.mjs`. The historical gates (`tests/release-3.1.test.mjs`,\n`tests/c18.test.mjs` and the strict gate `tests/accept-rc1.mjs`) run only in the reconstructed\n3.1.0 view built by `tests/run-310-view.mjs`; CI runs none of them. The 3.2.0 changes are not yet\nmeasured on a host, see project-setup/RELEASE-NOTES-3.2.0.md.\n\n",
    after: "## `backend-standards/`\n",
  }),
});
/** file key -> frozen array of ids in apply order; every record exactly once under its own file. */
export const FORWARD_ORDER320 = Object.freeze({
  "SKILL.md": Object.freeze(['SK320_1', 'SK320_3', 'SK320_2']),
  "VERSION": Object.freeze(['VR320_1']),
  "README.md": Object.freeze(['RM320_1', 'RM320_2', 'RM320_3', 'RM320_4', 'RM320_5', 'RM320_6', 'RM320_7', 'RM320_8']),
  "CHANGELOG.md": Object.freeze(['CL320_1']),
  "references/docs-generation.md": Object.freeze(['DG320_1', 'DG320_2', 'DG320_5', 'DG320_3', 'DG320_6', 'DG320_4', 'DG320_7']),
  "references/modes.md": Object.freeze(['MD320_1', 'MD320_3', 'MD320_2']),
  "references/migration-v2.md": Object.freeze(['MV320_1', 'MV320_2']),
  "references/security.md": Object.freeze(['SE320_1']),
  "references/claude.md": Object.freeze(['CM320_1']),
  "assets/agents/reviewer.md": Object.freeze(['RV320_1', 'RV320_2']),
  "assets/templates/CLAUDE.md": Object.freeze(['CT320_1']),
  "assets/templates/AGENTS.md": Object.freeze(['AT320_2', 'AT320_1']),
  "data/secret-paths.json": Object.freeze(['SP320_1']),
  "scripts/detect.mjs": Object.freeze(['DT320_1', 'DT320_2', 'DT320_3', 'DT320_4']),
  "scripts/migrate-security-paths.mjs": Object.freeze(['MS320_1', 'MS320_2', 'MS320_3', 'MS320_4', 'MS320_5']),
  "tests/bs-doc-map.test.mjs": Object.freeze(['BT320_3', 'BT320_4', 'BT320_5', 'BT320_2', 'BT320_6', 'BT320_7', 'BT320_1', 'BT320_8', 'BT320_9', 'BT320_10', 'BT320_11', 'BT320_12', 'BT320_13', 'BT320_14']),
  "tests/live/bs-doc-map.mjs": Object.freeze(['LH320_1', 'LH320_2', 'LH320_3', 'LH320_4', 'LH320_5', 'LH320_6', 'LH320_7', 'LH320_8']),
  "tests/live/BS-DOC-MAP-ACCEPTANCE.md": Object.freeze(['AC320_1', 'AC320_2', 'AC320_3', 'AC320_4', 'AC320_5', 'AC320_6', 'AC320_7', 'AC320_8', 'AC320_9', 'AC320_10']),
  "@root/README.md": Object.freeze(['RR320_1', 'RR320_2', 'RR320_3', 'RR320_4', 'RR320_5']),
  "@root/TODO.md": Object.freeze(['TD320_1', 'TD320_2', 'TD320_3', 'TD320_4', 'TD320_5', 'TD320_6']),
  "@root/.ai/context/project-tree.md": Object.freeze(['PT320_1', 'PT320_2', 'PT320_3']),
});
/** The exact per-file reverse of FORWARD_ORDER320. */
export const REVERSAL_ORDER320 = Object.freeze(Object.fromEntries(Object.entries(FORWARD_ORDER320).map(([f, ids]) => [f, Object.freeze([...ids].reverse())])));
export const AMENDED_FILES320 = Object.freeze(Object.keys(FORWARD_ORDER320));
/** The closed list of files 3.2.0 adds (plan 4.2), relative to project-setup/. to310Repo removes exactly these. */
export const NEW_FILES320 = Object.freeze([
  'tests/helpers/v320-amendments.mjs',
  'tests/fixtures/v320-prechange.json',
  'tests/fixtures/v320-policy-3.1.0.json',
  'tests/fixtures/v320-compat-expected.json',
  'tests/release-3.2.0.test.mjs',
  'tests/v320.test.mjs',
  'tests/run-310-view.mjs',
  'RELEASE-NOTES-3.2.0.md',
]);
/** SHA-256 of each amended file at the 3.1.0 base (the verified reversal result), from the git blobs of the base commit. */
export const BASE_SHA320 = Object.freeze({
  "SKILL.md": 'de85403e048c67bb5e0d77688c768f50e32afa3dbdaf869c73f61ddde0787ca3',
  "VERSION": 'b2f44d3b6e29f8b1b73ea4735f006affc4d198e1fd9c7d50e736159b1ef636c6',
  "README.md": '49890168844cffba3378b27c3b31aa1fafeec48dcf5b66c91e2919452749752c',
  "CHANGELOG.md": 'a5150ae5ef08aea14be765fc3a0be3fb3f627d1bac9b4ce7106bb8b06d6412ef',
  "references/docs-generation.md": '7cb8c9c599c3a80524e4565696069397e28ca688e1b134b2aa7047f938c882e7',
  "references/modes.md": 'c8448d36495794bc684ee974e101788b4d0ba63371809116feed7ed7bd7d55c2',
  "references/migration-v2.md": 'b4ea4fc870d4c3a9aeea70b817511c62bce6924c6c71f222c2eff094fc8e29b1',
  "references/security.md": '60bcb592aa29d67d52416f66ee159a944d445089a97a4d12d9f054424a537db8',
  "references/claude.md": 'e4ffc479e77ae295049e8de3a933611facf28162e28205179fa55a5dc74b5913',
  "assets/agents/reviewer.md": '696f86bc03f8506075e868465a2b34d76b6384a2809ed1e4ea949cc50f6a305c',
  "assets/templates/CLAUDE.md": '5bb1d5ed697e921dcc839d031e082f884ca9a97a1eafd8d4a003d2ddb1cbaa47',
  "assets/templates/AGENTS.md": '616a26a54d2e8f77b0d4df3e78055ca41f6e7638654ad70a0f4d28a0e4eb5a0e',
  "data/secret-paths.json": '37711ab7b8e1781ce533c705971f93351f1331a44b16e11e846080eb8fed1a79',
  "scripts/detect.mjs": '485bacd5200319f03b41006fae447718639a74edba4306da63a3e8a9ca4af982',
  "scripts/migrate-security-paths.mjs": '0da9855b6351392bb89b2fe5d749f351279139384a1e50ff9cf1e6c9890ea3c1',
  "tests/bs-doc-map.test.mjs": '44c1ca1590d9ab873afbe9887ff89815e5083149a84d70c51bc447629695a45e',
  "tests/live/bs-doc-map.mjs": '25641120a49a0aafdbd849557c4677ff8fe6cac17d267480faa2f54b94ba3449',
  "tests/live/BS-DOC-MAP-ACCEPTANCE.md": 'c0d910f6fa59fc7b61e2a1d93c5d922d5fb817c746275d1cdd4c1c95605cf061',
  "@root/README.md": '69b4c489c6d851851afee71e77198cbe621eee6abc37d4df2ee0bcb76eb2835b',
  "@root/TODO.md": '3ef06eba9a96d9d7c79f631f69b37e4e56032d4df4b96a2f0af0663f0f8fecc5',
  "@root/.ai/context/project-tree.md": '49487d54341d81a6ccc67752ece9139621836c353f7ace74437f1b9007129f26',
});
/** The three repository-root files (keys of the root records). */
export const ROOT_FILES320 = Object.freeze(['@root/README.md', '@root/TODO.md', '@root/.ai/context/project-tree.md']);
/** Repository-relative prefixes the view copies (plan 4.3). backend-standards/templates/ is read by tests/bs-doc-map.test.mjs. */
export const VIEW_COPY_SET = Object.freeze(['project-setup/', 'backend-standards/templates/', 'README.md', 'TODO.md', '.ai/context/project-tree.md']);

const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const has = (o, k) => o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k);
const REC_KEYS = Object.freeze(['after', 'before', 'file', 'neu', 'old']);

function occurrences(text, needle) {
  const out = [];
  if (needle === '') return out;
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) out.push(i);
  return out;
}
const known = (records, id) => has(records, id);
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
const wellFormed = (r) => r !== null && typeof r === 'object' && REC_KEYS.every((k) => typeof r[k] === 'string');

/** Reverses the named records in the given order. { text, failed }: text is null and failed names the first that does not verify. */
export function reverseSteps(text, ids, records = AM320) {
  let t = text;
  for (const id of ids) {
    if (!known(records, id) || !wellFormed(records[id])) return { text: null, failed: id };
    t = reverseOne(t, records[id]);
    if (t === null) return { text: null, failed: id };
  }
  return { text: t, failed: null };
}
/** Applies the named records in the given order; null when one does not stand exactly once. */
export function applySteps(text, ids, records = AM320) {
  let t = text;
  for (const id of ids) {
    if (!known(records, id) || !wellFormed(records[id])) return null;
    t = applyOne(t, records[id]);
    if (t === null) return null;
  }
  return t;
}
/** The 3.1.0 view of one amended file: every 3.2 record of that file reversed, last first. { text, failed }. */
export function reverseForFile(text, rel, records = AM320, forward = FORWARD_ORDER320) {
  if (!has(forward, rel)) return { text: null, failed: `no 3.2 amendment for ${rel}` };
  return reverseSteps(text, [...forward[rel]].reverse(), records);
}
export function applyForFile(text, rel, records = AM320, forward = FORWARD_ORDER320) {
  return has(forward, rel) ? applySteps(text, forward[rel], records) : null;
}

const REAL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/** Absolute path of a record key under a repository root ("@root/x" is repoRoot/x; every other key is repoRoot/project-setup/key). */
export const absOf320 = (rel, repoRoot = REAL_ROOT) => path.resolve(rel.startsWith('@root/') ? path.join(repoRoot, ...rel.slice(6).split('/')) : path.join(repoRoot, 'project-setup', ...rel.split('/')));

const pendingError = (what) => Object.assign(new Error(`PIN_PENDING: ${what}`), { code: 'PIN_PENDING' });
const pinOf = (pins, rel) => {
  if (pins === PIN_PENDING) throw pendingError('the 3.1.0 pin table (BASE_SHA320) is not written yet (session 2)');
  if (!has(pins, rel)) throw new Error(`no 3.1.0 pin for ${rel}`);
  return pins[rel];
};
const REAL_CFG = () => ({ records: AM320, forward: FORWARD_ORDER320, pins: BASE_SHA320, newFiles: NEW_FILES320 });

/**
 * fs.readFileSync for 3.1.0-era readers: an amended file of the real tree is returned as its verified 3.1.0 view (every 3.2 record reversed and the
 * result equal to the pinned SHA-256); any other path is read as is. Throws when a reversal does not verify, or with PIN_PENDING while the table is a stub.
 */
export function read310(absPath, { repoRoot = REAL_ROOT, cfg = REAL_CFG() } = {}) {
  const b = fs.readFileSync(absPath);
  const byAbs = new Map(Object.keys(cfg.forward).map((rel) => [absOf320(rel, repoRoot), rel]));
  const rel = byAbs.get(path.resolve(absPath));
  if (rel === undefined) return b;
  const r = reverseForFile(b.toString('utf8'), rel, cfg.records, cfg.forward);
  if (r.text === null) throw new Error(`3.2.0 amendment does not reverse for ${rel}: ${r.failed}`);
  if (sha256(Buffer.from(r.text, 'utf8')) !== pinOf(cfg.pins, rel)) throw new Error(`3.2.0 reversal of ${rel} is not the pinned 3.1.0 bytes`);
  return Buffer.from(r.text, 'utf8');
}

const isInside = (parent, child) => { const rel = path.relative(path.resolve(parent), path.resolve(child)); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };

/**
 * Builds the view: the working-tree bytes of the tracked files (git ls-files -z over VIEW_COPY_SET, cwd repoRoot) or, with includeUntracked,
 * of every file that is tracked or untracked and not ignored (-co --exclude-standard), copied into outDir. outDir must be empty (or absent) and
 * outside the repository. Copies nothing else: no .git, no node_modules, no ignored file. Throws { code: 'GIT_FAILED' } when Git fails (for
 * example a checkout the current user does not own), so a caller reports it as its own failure and never as a pass.
 * Returns { files, skippedMissing }: the repository-relative paths copied, and tracked paths that are deleted in the working tree.
 */
export function buildView({ repoRoot, outDir, includeUntracked = false }) {
  if (typeof repoRoot !== 'string' || typeof outDir !== 'string') throw new Error('buildView needs repoRoot and outDir');
  if (isInside(repoRoot, outDir)) throw new Error('the view directory must be outside the repository');
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length > 0) throw new Error('the view directory must be empty');
  const args = includeUntracked ? ['ls-files', '-z', '-co', '--exclude-standard', '--', ...VIEW_COPY_SET] : ['ls-files', '-z', '--', ...VIEW_COPY_SET];
  const r = spawnSync('git', args, { cwd: repoRoot, encoding: 'buffer', shell: false, windowsHide: true, maxBuffer: 1 << 26 });
  if (r.error || r.status !== 0) throw Object.assign(new Error(`GIT_FAILED: git ls-files exited ${r.error ? r.error.code : r.status}: ${String(r.stderr ?? '').trim().slice(0, 200)}`), { code: 'GIT_FAILED' });
  const names = [...new Set(r.stdout.toString('utf8').split('\0').filter(Boolean).map((p) => p.replace(/\\/g, '/')))].sort();
  fs.mkdirSync(outDir, { recursive: true });
  const files = []; const skippedMissing = [];
  for (const rel of names) {
    const from = path.join(repoRoot, ...rel.split('/'));
    const to = path.join(outDir, ...rel.split('/'));
    let st = null;
    try { st = fs.lstatSync(from); } catch { st = null; }
    if (st === null) { skippedMissing.push(rel); continue; }
    if (!st.isFile()) continue; // a link or a submodule is never followed into the view
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    files.push(rel);
  }
  return { files, skippedMissing };
}

/**
 * After buildView: reverses every amended file of the view (each record verified at its anchor), removes exactly the new files and throws unless every
 * amended file hashes to its 3.1.0 pin (PIN_PENDING while the table is a stub). An unrecorded edit elsewhere is left in place, so the later comparison
 * with the pinned 3.1.0 manifest shows it (the rule of to30Tree in v31-amendments.mjs).
 */
export function to310Repo(viewDir, cfg = REAL_CFG()) {
  const keys = Object.keys(cfg.forward);
  if (cfg.pins === PIN_PENDING) throw pendingError('the 3.1.0 pin table (BASE_SHA320) is not written yet (session 2)'); // refused before anything is written
  for (const rel of keys) {
    const p = absOf320(rel, viewDir);
    const r = reverseForFile(fs.readFileSync(p, 'utf8'), rel, cfg.records, cfg.forward);
    if (r.text === null) throw new Error(`3.2.0 amendment does not reverse for ${rel}: ${r.failed}`);
    if (sha256(Buffer.from(r.text, 'utf8')) !== pinOf(cfg.pins, rel)) throw new Error(`3.2.0 reversal of ${rel} is not the pinned 3.1.0 bytes`);
    fs.writeFileSync(p, r.text, 'utf8');
  }
  for (const rel of cfg.newFiles) fs.rmSync(path.join(viewDir, 'project-setup', ...rel.split('/')), { force: true });
}

/** After to310Repo: replaces only the named skill files (relative to project-setup/, never a test) with their real-tree 3.2.0 bytes (the compat run). */
export function overlay(viewDir, repoRoot, relPaths) {
  for (const rel of relPaths) {
    if (typeof rel !== 'string' || rel === '' || rel.startsWith('@root/') || /(^|\/)\.\.(\/|$)|\\|^\//.test(rel)) throw new Error(`overlay: not a project-setup-relative path: ${String(rel)}`);
    if (rel.startsWith('tests/')) throw new Error(`overlay: a test file is never overlaid: ${rel}`);
    const from = path.join(repoRoot, 'project-setup', ...rel.split('/'));
    const to = path.join(viewDir, 'project-setup', ...rel.split('/'));
    if (!fs.existsSync(to)) throw new Error(`overlay: ${rel} is not in the view`);
    fs.copyFileSync(from, to);
  }
}

/** The manifest of a view: Map key -> { sha256, bytes } over every file under project-setup/ (keys relative to it) and the three root files ("@root/<path>"). */
export function viewManifest(viewDir) {
  const out = new Map();
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, r); else if (e.isFile()) { const b = fs.readFileSync(p); out.set(r, { sha256: sha256(b), bytes: b.length }); }
    }
  })(path.join(viewDir, 'project-setup'), '');
  for (const k of ROOT_FILES320) {
    try { const b = fs.readFileSync(absOf320(k, viewDir)); out.set(k, { sha256: sha256(b), bytes: b.length }); } catch { /* absent: the comparison reports it as missing */ }
  }
  return out;
}

/**
 * Compares a view with the pinned 3.1.0 manifest (prechange.files: key -> { sha256, bytes }). Keys listed in skip (overlaid files) are not compared.
 * { extra, missing, changed } with sorted key lists; all three empty means the view IS the 3.1.0 tree.
 */
export function verifyView(viewDir, prechange, { skip = [] } = {}) {
  if (prechange === null || typeof prechange !== 'object' || prechange.files === null || typeof prechange.files !== 'object') throw pendingError('the pinned 3.1.0 manifest (tests/fixtures/v320-prechange.json) is not written yet (session 2)');
  const skipSet = new Set(skip);
  const got = viewManifest(viewDir);
  const want = new Map(Object.entries(prechange.files));
  const extra = [...got.keys()].filter((k) => !want.has(k) && !skipSet.has(k)).sort();
  const missing = [...want.keys()].filter((k) => !got.has(k) && !skipSet.has(k)).sort();
  const changed = [...want.keys()].filter((k) => got.has(k) && !skipSet.has(k) && (got.get(k).sha256 !== want.get(k).sha256 || got.get(k).bytes !== want.get(k).bytes)).sort();
  return { extra, missing, changed };
}
