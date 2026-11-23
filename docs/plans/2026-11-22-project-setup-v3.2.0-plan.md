# project-setup 3.2.0: implementation plan (DRAFT 2, revised after critique round 1)

| Field | Value |
|---|---|
| Status | DRAFT 2, not frozen. Revises the draft `docs/plans/2026-11-22-project-setup-v3.1.1-plan.md` |
| Path when saved | `docs/plans/2026-11-22-project-setup-v3.2.0-plan.md` (the 3.1.1 draft file is not committed) |
| Version | 3.2.0 (decision D-1; the task text said "3.1.1 for fixes", see 1.2) |
| Base | project-setup 3.1.0, commit `d0cd48e40f8fea897a27b28d7c679e55f0203237` |
| Branch | `feat/ps-3.1.1` (existing; a rename is the orchestrator's choice, the plan does not depend on it) |
| Inputs | draft plan; critique round 1 (F1-F25); advisor 1 (Q1-Q11, X1-X5); orchestrator dispositions D-1..D-14 (binding, maintainer absent) |
| Frozen documents | `docs/plans/**` (other than adding this file and later records), `RELEASE-NOTES-3.1.0.md` and older notes are not edited |

Evidence rule: every statement about current behaviour cites `file:line` as read by the plan lane on 2026-11-22 (paths relative to `project-setup/` unless they start with `@root/` or another top-level directory). Anything not read is marked UNVERIFIED. The plan lane has no shell: no test was run for this document. The only run results quoted are the orchestrator's probe (4.6).

## 0. Evidence corrections that shape the design

1. `claude-block-content` is emitted only by the test-only live helper (`tests/live/bs-doc-map.mjs:712`), which compares the installed `claude` block with the whole template block (`:711-712`). `validate.mjs` has no template-content check; its block checks are marker errors and manifest drift (`scripts/validate.mjs:383-408`). Known issue 1 of `RELEASE-NOTES-3.1.0.md:140-141` ("validate reports") is imprecise; the 3.2.0 notes state the correction.
2. `detect.mjs` never sees an installer backup: `scanSkillCopies` matches only a directory named exactly `project-setup` holding `SKILL.md` (`scripts/detect.mjs:288`). The backup is `.project-setup.bak-<version>-<ms>` (`install/install.mjs:314`), the renamed old skill directory. The fix is "report it", not "ignore it".
3. The canonical docs-sync may edit inside managed blocks when a code change makes the block wrong (`assets/agents/docs-sync.md:66-67`, as verified by the critique; not re-read here).
4. Historical specs read the real shipped policy directly: `tests/c3.test.mjs:1242-1245` asserts the 20-entry document; `tests/run-tests.mjs:116,311,471,1048,1094,1264` copy the real file into fixtures. A byte-reversal reader cannot satisfy them; this decides the gate design (section 4).
5. Three callers besides the migration CLI build the six-field migration input: `scripts/detect.mjs:179-182`, `scripts/validate.mjs:125-133` (used at `:474-476`) and `scripts/apply.mjs:902-907` (used at `:929-931`). `resolveSecurityMigration` binds decisions to the report hash (`scripts/migrate-security-paths.mjs:184`). Any baseline recognition must therefore give the same answer in all four places. D-2 achieves this by deriving the prior baseline inside `migrate-security-paths.mjs` from inputs every caller already passes.
6. The shipped defaults protect in setup immediately: `detect.mjs:22,32` (`isSecretPath(rel, spec) || isSecretPath(rel, projectPolicy)`, `spec` from `scripts/lib.mjs:134-136`), `validate.mjs:244`, `apply.mjs:138`. A new shipped pattern needs no user decision to take effect in setup's own reads (A4, D-3).
7. The acceptance procedure already ships a Lock order text: `tests/live/BS-DOC-MAP-ACCEPTANCE.md:387-405` (the seven-line unit at `:398-404`), and the helper checks the marker (`tests/live/bs-doc-map.mjs:1277`). The draft's claim that the procedure does not ship that text was wrong (C1 item 4, section 9 Q9).
8. project-setup files are not all ASCII today (`assets/templates/AGENTS.md:7,14`). The ASCII rule applies to all new and changed text; existing bytes stay.

## 1. Purpose and numbering decision

### 1.1 Purpose

Close findings 1 to 10 of the 3.1.0 live acceptance record (`docs/plans/2026-11-22-project-setup-v3.1-live-acceptance-results.md:83-99`), the two 3.0.x reviewer residuals (`@root/TODO.md:25-32`), and the stale documentation and procedure items. 3.2.0 is the first release after 3.0.0 that changes runtime files: 3.1.0 changed none (`RELEASE-NOTES-3.1.0.md:24-25`).

### 1.2 Numbering decision: 3.2.0 (D-1, advisor X1)

- The repository rule is "Minor = additive" and "Patch = wording" (`@root/.ai/context/development-rules.md`, bump table). 3.2.0 adds two shipped deny patterns that become a decision for every installed project, new MUST rules in the canonical reviewer and in `references/docs-generation.md`, a new detect output field (`installerBackups`), a new recognised policy baseline value (`v3.0.0`), and a new Phase 0 stop for projects with tracked files under root `env/` or `cert/`.
- It is not a major: no project must change code, manifest schema 3 and policy schemas 1 and 2 are unchanged, no CLI flag is added or removed.
- Deviation from the task text: the task and `RELEASE-NOTES-3.1.0.md:140-150` route these fixes to "3.1.x". The 3.2.0 notes state that the items promised for 3.1.x ship in 3.2.0 and why.
- Names: `RELEASE-NOTES-3.2.0.md`, tag `project-setup-v3.2.0`, `tests/helpers/v320-amendments.mjs`, `tests/fixtures/v320-prechange.json`, `tests/release-3.2.0.test.mjs`, `tests/v320.test.mjs`. The runner keeps the name `tests/run-310-view.mjs` because it builds the 3.1.0 view.

## 2. Scope

Record ids in brackets (for example `[DG320_1]`) are the amendment records of section 4. Unless marked "replacement", every change is an insertion. All new text is ASCII.

### A1. Partial-layer variants: the CLAUDE.md Subagents line and the AGENTS.md `agents` block

**Current.**
- The template has one Subagents line (`assets/templates/CLAUDE.md:31`).
- When the docs-sync replacement is declined, setup keeps the BS agent and reports the incomplete layer (`references/modes.md:63-65`, `references/docs-generation.md:369-371`). The line still says "both load their canonical definition".
- The AGENTS.md `agents` block makes the same claim: "Both tools run the same definitions through thin wrappers" (`assets/templates/AGENTS.md:77`).
- `--expect-partial` exists (`tests/live/bs-doc-map.mjs:1906,1959`) but does not relax the block comparison (results file `:40`).
- `references/modes.md:94` expects "the required source-template content".

**Intended.**

1. `assets/templates/CLAUDE.md` line 31 is not changed. The template line stays the full-layer line.
2. `references/docs-generation.md`, new subsection "Subagents line variants" after line 48 `[DG320_1]`. Closed set of four lines (the first is the template line byte for byte):

   ```text
   - Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; both load their canonical definition from `.ai/agents/`.
   - Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; only `reviewer` loads its canonical definition from `.ai/agents/`. `docs-sync` is a retained project agent (incomplete project-setup agent update).
   - Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; only `docs-sync` loads its canonical definition from `.ai/agents/`. `reviewer` is a retained project agent (incomplete project-setup agent update).
   - Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; both are retained project agents and neither loads a canonical definition from `.ai/agents/` (incomplete project-setup agent update).
   ```

   Closed set of three sentences for the AGENTS.md `agents` block (D-9). Setup writes none in a full layer and exactly one in a partial layer, as its own line directly after the template sentence "Do not create an ad-hoc agent for the same job." (`assets/templates/AGENTS.md:79`) and BEFORE the two template paragraphs `[AT320_2]` and `[AT320_1]` that follow it (fixed order, R2-10: line 79 sentence, then the layer sentence when present, then `[AT320_2]`, then `[AT320_1]`; `checkAgentsLayerSentence` and zero diff on rerun depend on it). The sentences name no file path in backticks, so `reference-exists` (`scripts/validate.mjs:373-381`) gets no new target:

   ```text
   Exception in Claude Code: `docs-sync` is a retained project agent and does not load its canonical definition (incomplete project-setup agent update).
   Exception in Claude Code: `reviewer` is a retained project agent and does not load its canonical definition (incomplete project-setup agent update).
   Exception in Claude Code: `reviewer` and `docs-sync` are retained project agents and do not load their canonical definitions (incomplete project-setup agent update).
   ```

   The layer concerns Claude wrappers only: backend-standards ships two Claude agents and no Codex wrapper (`references/modes.md:56-57`).

   Selection rule (exact wording to ship, same record):

   ```text
   Setup MUST choose the Subagents line and the agents-block sentence from the per-agent
   dispositions of the same run, so a managed block never states an agent layer that was
   not installed. An agent counts as canonical only when its Claude wrapper at
   .claude/agents/<name>.md is the shipped wrapper, or an approved merge that still loads
   .ai/agents/<name>.md first, and .ai/agents/<name>.md is the rendered canonical
   definition. Otherwise it is retained.
   Setup MUST use one of the four lines byte for byte and, in a partial layer, exactly the
   one matching sentence; it MUST NOT write any other wording. The rest of both blocks is
   the template text unchanged.
   On a later run, setup MUST recompute both. When a retained agent has been replaced, the
   blocks are redrafted through the normal managed-block update; when nothing changed, the
   run produces zero diff.
   ```

3. `references/modes.md`, one paragraph inserted after line 103 `[MD320_3]`:

   ```text
   The "required source-template content" in the table above is the template claude block
   with the Subagents line selected under "Subagents line variants" in
   references/docs-generation.md. In a partial agent layer the full-layer line is not the
   expected content.
   ```

4. `tests/live/bs-doc-map.mjs` (test-only helper, tests lane):
   - `checkClaudeRecovery` (`:699`) gains an optional `agentLayer` argument: `full` (default), `docs-sync-retained`, `reviewer-retained`, `both-retained`. The expected block is the template block with the Subagents line replaced by the matching variant. Exactly four blocks are accepted in total.
   - New exported `agentLayerOf(evidenceAgents, installedTexts)`: an agent is canonical when its disposition is `take-new`, or `merge` and the installed text matches the canonical reference test already used at `:691-693` (`referencesCanonical`). It is retained for `keep`, or `merge` without that reference. Dispositions are the per-agent values `checkAgentRecovery` already takes (`:727`). The exact shape of `evidence.agents` is UNVERIFIED (`:1390-1397` read only as an export list); the tests lane reads it first and reports a mismatch instead of guessing.
   - New exported `checkAgentsLayerSentence({ agentsText, agentLayer })`: finding `agents-layer-sentence` when the `agents` block lacks the matching sentence in a partial layer, carries any of the three in a full layer, carries more than one, or carries a near miss.
   - `verify` derives `agentLayer` from the evidence file. Without `--expect-partial` a derived layer other than `full` remains a finding of the existing completeness check (`:1836`).
5. `validate.mjs` is not changed (Q4).

**Why no drift.** Setup drafts the block and `blocks.mjs upsert` writes it (`SKILL.md:268-270`). Drift compares the installed block hash with the recorded hash, not with the template (`scripts/validate.mjs:398-405`). A variant causes no drift and a rerun gives zero diff. When the layer is completed later, the recomputed block differs, the block state is `unchanged`, and the normal update redrafts it (`references/modes.md:124-127`).

**Files.** `references/docs-generation.md`, `references/modes.md` (implement lane). `tests/live/bs-doc-map.mjs`, `tests/bs-doc-map.test.mjs`, `tests/v320.test.mjs` (tests lane). `tests/live/BS-DOC-MAP-ACCEPTANCE.md` row `:177` names the expected variant and sentence (implement lane, C1 commit).

**Acceptance criteria.**
- AC-A1-1 (`tests/v320.test.mjs`): the four lines extracted from `references/docs-generation.md` are distinct, ASCII and one line each. The first equals the template's Subagents line, found by content (the line number moves with B2).
- AC-A1-2 (`tests/bs-doc-map.test.mjs`): `checkClaudeRecovery` returns no `claude-block-content` for each of the four (layer, line) pairs and returns it for each of the twelve mismatched pairs.
- AC-A1-3: a fifth wording (one changed character) is `claude-block-content` under every layer.
- AC-A1-4: the existing mutants at `tests/bs-doc-map.test.mjs:962-963` keep failing with a partial line present.
- AC-A1-5: `checkAgentsLayerSentence` passes the four correct cases and reports the finding for: a missing sentence in each partial layer, a sentence in the full layer, two sentences, one changed character.
- AC-A1-6: `agentLayerOf` gives `full` for take-new/take-new, `docs-sync-retained` for take-new/keep, and treats `merge` by the canonical-reference test in both directions.
- AC-A1-7: `references/modes.md` holds the `[MD320_3]` paragraph once and line 94 is unchanged.

**Edge cases.** A retained agent whose file was later deleted is a `removed-by-user` case, not a variant. A custom wrapper merged through review that still loads the canonical file counts as canonical.

### A2. Managed-block rule for every agent, including a retained one

**Current.** The retained BS docs-sync edited the PS-managed AGENTS.md `overview` block; validate then warns `AGENTS.md: managed block overview edited by user` (results file `:40,71-72`; `scripts/validate.mjs:404`). The only managed-block rule is in the canonical docs-sync, which a retained agent never reads. The update behaviour for an edited block exists (`references/modes.md:128-129`); prepare rejects such a draft without `--approve-user-content` (`references/state-and-apply.md:60`).

**Destination: the AGENTS.md template `agents` block.** Root AGENTS.md is the one text every agent on both hosts is told to follow. Whether a Claude subagent receives root instructions is host behaviour, measured in D4.

**Intended.**

1. `assets/templates/AGENTS.md`, inserted after line 79, inside the `agents` block, after `[AT320_2]` (B2) `[AT320_1]` (template order: line 79, `[AT320_2]`, `[AT320_1]`; a rendered partial-layer sentence of A1 sits between line 79 and `[AT320_2]`):

   ```text

   Text between `<!-- project-setup:begin ... -->` and `<!-- project-setup:end ... -->`
   markers in AGENTS.md, CLAUDE.md and .gitignore is managed by project-setup. Every
   agent, including a retained project agent that does not load a canonical definition,
   MUST NOT add, remove or move these markers, and MUST change text inside a block only
   when a code change makes that text wrong. It MUST then name the file and the block
   id in its output, because the next project-setup update shows that edit for a keep,
   take-new or merge decision and can otherwise replace it.
   ```

   The marker text is inside backticks mid-line; `MARKER` needs a line start and `id=` (`scripts/blocks.mjs:24`), so the parser does not read it as a marker.
2. `references/modes.md`, inserted after line 132 `[MD320_2]`:

   ```text
   An edit made by an agent inside a managed block is an `edited-by-user` block like any
   other: validate warns `drift`, and the next update MUST show the installed text next to
   the new content and offer keep theirs, take new, or merge. Setup MUST NOT rewrite the
   block without that disposition. Keep theirs leaves the block and its recorded hash
   unchanged, so the warning stays and the report MUST list the block as kept with drift.
   ```

3. `references/docs-generation.md`, inserted after line 371 `[DG320_4]`:

   ```text
   A retained agent is bound only by root AGENTS.md text. Setup therefore installs the
   managed-block rule of the agents block before it reports the retained agent, and the
   report MUST name the managed blocks that agent is able to edit.
   ```

4. Clarifying sentences next to statements that now mislead (D-10). The statements stay; each gets one inserted sentence:
   - after `references/docs-generation.md:355` `[DG320_5]`: `"Unchanged" means the mapping adds no template text. The template itself changed in 3.2.0 (the agents block).`
   - after `:361` (first sentence of that paragraph, record anchored on the full paragraph) `[DG320_6]`: `"Unchanged" means the mapping adds no agent text. The canonical reviewer changed in 3.2.0 for the money-severity rule.`

**Acceptance criteria.**
- AC-A2-1 (`tests/v320.test.mjs`): the template `agents` block contains the paragraph byte for byte; the template parses with the real `blocks.mjs` rules into six blocks with no marker error; the template is at most 150 lines (limit at `scripts/validate.mjs:352`).
- AC-A2-2 (real `apply.mjs` and `validate.mjs`, synthetic project): install a blocks-owned AGENTS.md, edit inside `overview`, run `validate.mjs --json`: exactly one `warn`/`drift` row naming `overview`. Draft a new `overview`: `prepare` exits 3 with `APPLY_APPROVAL_REQUIRED` naming exactly `AGENTS.md`. With `--approve-user-content AGENTS.md`, prepare and commit succeed and validate has no drift row.
- AC-A2-3: with no draft for the block (keep theirs), the commit of an otherwise unchanged run leaves AGENTS.md and its manifest block hash byte-identical.
- AC-A2-4 (mutant, D-14): the paragraph with a real marker line inside it (`<!-- project-setup:begin id=x -->` at a line start) makes the parser report a marker error; the shipped paragraph does not.

**Edge cases.** A retained agent that removes a marker is the existing marker-error stop (`references/modes.md:131`).

### A3, A7, A8. One applicability rule for every mode

**Current.**
- "setup MUST generate each applicable mapped PS document as a pointer" (`references/docs-generation.md:257`); "applicable" is undefined.
- Competing rules: `:4`, `:162`, `:320`, `:399`, and `:357` (critical-modules "becomes a self-sufficient pointer", unconditional).
- Configuration: the mapping row requires the inventory columns (`:242`) and `:259` forbids losing them; nothing says the table is proposed in adopt.
- Compiler strictness: no rule; `tsconfig.json` is only a Phase 0 read (`SKILL.md:214-217`).
- Phase 0 reads are closed: "Read only: the manifest ..., lockfile name, `tsconfig.json`, `docker-compose.yml` (structure only), `src/` tree listing, framework entrypoint" (`SKILL.md:214-215`), after instruction files, README and existing indexes (`SKILL.md:211-213`).
- Symptoms: results file `:87-88,94-95`. Which path produced which output is UNVERIFIED.

**Intended: one insertion after `references/docs-generation.md:259` `[DG320_2]`.** Lines 257 and 259 are unchanged. Exact text:

```text
#### Applicability (one rule for every mode)

A mapped PS document is applicable when at least one of these holds:

1. Code evidence: the source named for that document in the tables above yields at
   least one fact from permitted reads.
2. Source-section evidence: at least one of its mapped 03 sections resolves and its
   body states at least one fact for the topic. A blank body, template placeholders
   in angle brackets, or a table with no filled row is not a fact.
3. An existing document at the PS path, whoever wrote it. Existing-content
   consolidation below applies before it becomes a pointer.

Phase 0 applicability is provisional. Setup MUST derive it only from what Phase 0 may
read: the manifest, the lockfile name, tsconfig.json, docker-compose structure, the
src/ tree listing, the framework entrypoint, detect output, existing documents and the
resolved 03 sections. Setup MUST show the provisional list in Phase 0 with the evidence
kind for each entry (tree listing, source section, existing document) or "not
applicable: no evidence", and MUST label it provisional. This rule adds no Phase 0 read.

Phase 1 confirms applicability with the evidence reads it already performs. Setup MUST
draft exactly the confirmed set. If the confirmed set differs from the list approved in
Phase 0, setup MUST stop and ask again, because a report that says "skipped" beside an
installed pointer cannot be reviewed.

Setup MUST apply this rule identically in every mode. The mode decides ownership and
the approval workflow; it never decides which documents exist.

For a document that is not applicable, setup MUST NOT write a pointer, MUST NOT add
content to 03 for that topic, and MUST remove the navigation row and any reference to
that path from the text it drafts, so validate does not fail on a missing target.
For an applicable document whose mapped section is blank while code evidence exists,
setup completes the section through the reviewed consolidation and identifies
unknowns explicitly. An installed pointer whose evidence later disappears is
preserved and reported; it is never deleted or expanded automatically, and no age
limit applies.

`docs/integrations/<vendor>.md` is decided per vendor. `docs/business-rules/<flow>.md`,
code patterns, development rules, ADRs and TODO.md keep their own rules above.

When the configuration document is applicable, setup MUST propose, through the reviewed
consolidation of the target project's 03, a Configuration table with one row per
variable name evidenced by config or validation code or by
`env-keys.mjs keys --template auto`, with: variable, required (yes, no, conditional
with the condition, or unknown), classification (secret or non-secret), used by,
description and source. Setup MUST make this proposal in adopt and in update alike. A
requiredness that the code does not establish is written `unknown` and listed in
TODO.md; it is never guessed. Values never appear. If the owner declines the proposal,
the configuration conversion is incomplete: setup keeps any original, writes no claim of
completion and reports it.

When `tsconfig.json` exists and the mapping is active, setup MUST propose, through the
same reviewed consolidation, a statement of the compiler strictness as written (`strict`
and each individual strict flag that is set, or "strict not set") under **CI/CD and
tooling**, taken from `tsconfig.json` only, in every mode. It is a stated value, never
an inference from code style. If the owner declines, setup reports the omission and
does not write it.
```

A per-document evidence table follows in the same record, one row per pointer document of `:238-248`. Its "code evidence" cell repeats the existing source columns (`:98-103`, `:140-149`); its "source sections" cell repeats the destinations of `:238-248`. No new destination is introduced. The strictness destination is the heading at `backend-standards/templates/docs/03-project-architecture.md:242` ("12. CI/CD and tooling", ASCII; Q5).

**A7 explained and fixed.** `:357` makes critical-modules a pointer unconditionally, while the generic no-evidence rule let Phase 0 report it as skipped. Under the rule above, a 03 with filled Authentication or Database sections makes it applicable by source-section evidence; the pointer in the declined fixture was correct and the Phase 0 line was wrong.
- Insert after `:357` `[DG320_3]`: `This applies when critical-modules is applicable under "Applicability" above. When it is not, remove the reference from the critical rule's last sentence and the navigation row, keep the rule itself, and record the absence in TODO.md.`
- The live helper already supports a critical rule without the reference: `referenceRequired` (`tests/live/bs-doc-map.mjs:824,848-853`), documented at `tests/live/BS-DOC-MAP-ACCEPTANCE.md:275-281`. No helper change is needed for A7.
- `SKILL.md`, one sentence after line 235 `[SK320_2]`: `The assessment lists every mapped document as provisionally applicable (with its evidence kind) or not applicable, as defined in references/docs-generation.md ("Applicability"); Phase 1 confirms the list.`

**The pinned sentence at `:416`** ("This release adds neither atomic stamp binding nor a production-script change", pinned by `tests/bs-doc-map.test.mjs:190`). Decision: keep it and insert after it `[DG320_7]`: `That sentence describes 3.1.0. 3.2.0 changes two production scripts for other reasons (policy baseline recognition and installer-backup reporting) and still adds no atomic stamp binding.` The pin keeps matching because the sentence stays.

**How it is tested without an LLM.**
- Instruction-contract checks (`tests/bs-doc-map.test.mjs`, new group): each sentence above is present once, inside the mapping section, in order. The mode sentence says "every mode" (the test does not pin a mode count; detect has seven modes, `scripts/detect.mjs:386-402`). Lines 257, 162 and 416 are still present.
- Test-only checkers (exported from `tests/live/bs-doc-map.mjs`, used by `verify` and the spec):
  - `checkApplicability({ approved, confirmed, pointers, navigationRefs })`: findings `pointer-not-approved`, `approved-pointer-missing`, `dangling-navigation`, `confirmed-differs-from-approved`.
  - `checkConfigurationInventory({ architectureText, names, declined })`: findings `config-row-missing:<name>`, `config-cell-empty:<name>:<column>`, `config-value-shaped`; with `declined: true`, the only finding is `config-completion-claimed` when the text claims completion.
  - `checkStrictness({ architectureText, tsconfigText, declined })`: `strictness-missing`, `strictness-mismatch`.
- Stays live: whether an agent applies the rule identically in adopt and update (D5).

**Files.** `references/docs-generation.md`, `SKILL.md` (implement). `tests/live/bs-doc-map.mjs`, `tests/bs-doc-map.test.mjs` (tests). `tests/live/BS-DOC-MAP-ACCEPTANCE.md` evidence-file fields for the three checkers, in the section 4 paragraph after `:208-210` (implement, C1 commit). No edit touches the section 7 matrix pinned by `MATRIX_SHA` (`tests/bs-doc-map.test.mjs:4153`).

**Acceptance criteria.** AC-A3-1: the contract checks above. AC-A3-2: each checker's positive case has no finding and each named finding is produced by its negative case, including the boundary (one variable missing; one empty cell; a table with a header and no row). AC-A3-3: the mutation controls of 5.2 item 4.

**Edge cases.** 03 unreadable or protected: existing stop (`:398`). Heading renamed: existing hold (`:393`). `tsconfig.json` extends another file: state what the root file says and name the extended file; do not resolve the chain. A variable named only in the template: source "template only", required `unknown`.

### A4. SENSITIVE: `env/**` and `cert/**` in the shipped secret-path policy

**Current.**
- BS names them: "MUST NOT read or print the contents of `env/**`, `cert/**`, `*.pem`, `*.p12`" (`backend-standards/references/00-ai-agent-instructions.md:110`). The "5.3" numbering in the results file is UNVERIFIED as a section number.
- The shipped policy has 20 schema-1 entries, none for a root `env/` or `cert/` directory (`data/secret-paths.json:5-87`).
- Schema 1 infers the anchor: a glob starting with `**/` is `any`, anything else `root` (`assets/tools/security-policy.mjs:137-139`). Identity is `[anchor, lowercased glob]` (`:151`).
- Baseline selection (`scripts/migrate-security-paths.mjs:87-95`): `keys` -> `recorded`; `full` + v2 hash -> `v2.0.0`; `full` + desired hash -> `shipped`; no policy and no record -> `fresh`; else `unknown`.
- Consequence: every project fresh-installed by 3.0.0 or 3.1.0 holds a `full` record with the hash of today's file (`SKILL.md:275-277`). When the shipped file changes, they become `unknown`: `s.list` is null, so every installed entry is a `managed-edit` without baseline (`:120`, choices `keep`/`project`/`omit` at `:145`) and, because `baseKeys` is empty (`:122`), every desired identity is a coverage row (`:126-141`). That is 20 `managed-edit` rows plus 22 coverage rows: 42 decisions.
- `apply.mjs` refuses a draft that drops an installed entry outside a reviewed migration (`scripts/apply.mjs:895-899`; `references/migration-v2.md:232-237`).

**Intended (D-2: no snapshot file, no new input field, no caller change).**

1. `data/secret-paths.json`: two entries inserted directly after the `**/credentials/**` entry (after line 61) `[SP320_1]`:

   ```json
       {
         "glob": "env/**",
         "kind": "dir",
         "note": "Root env/ directory. Root-anchored: config code under src/ is not matched."
       },
       {
         "glob": "cert/**",
         "kind": "dir",
         "note": "Root cert/ directory."
       },
   ```

   Root-anchored on purpose: `**/env/**` would deny `src/config/env/*.ts`, which setup reads for variable names (`SKILL.md:47-48`). Nothing else changes; the result has 22 entries.
2. `scripts/migrate-security-paths.mjs` (the only script A4 changes):
   - New module constant beside `ENV_NEW` (`:39-40`):

     ```js
     // 3.2.0: the default policy shipped by 3.0.0 and 3.1.0 is the current default minus exactly these identities.
     const PRIOR_SHIPPED = Object.freeze({
       name: 'v3.0.0',
       sha256: '37711ab7b8e1781ce533c705971f93351f1331a44b16e11e846080eb8fed1a79',
       added: Object.freeze([policyEntryKey({ anchor: 'root', glob: 'env/**' }), policyEntryKey({ anchor: 'root', glob: 'cert/**' })]),
     });
     ```

   - In `readInput` (`:79-103`): after `desired` is read, `priorList` is `desired` without the entries whose identity is in `PRIOR_SHIPPED.added`, order preserved, and only when `desired` contains both identities; otherwise `priorList` is null (the derivation is skipped).
   - Selection order: `keys` -> `recorded`; `full` + v2 hash -> `v2.0.0`; `full` + desired hash -> `shipped` (desired wins a tie, like "v2 wins a tie" at `:76`); `full` + `PRIOR_SHIPPED.sha256` and `priorList` not null -> `v3.0.0` with `list = priorList`, `baselineSha256 = PRIOR_SHIPPED.sha256`; no policy and no record -> `fresh`; else `unknown` (unchanged).
   - `INPUT_FIELDS` (`:36`) stays six. `shippedInput` (`:332-340`) is unchanged.
   - The file header (`:7-15`) and the JSDoc of `readInput` (`:73-78`) gain the new baseline in the same change.
   - The value `v3.0.0` means exactly: "a `full` ownership record whose hash is the default policy shipped by 3.0.0 and 3.1.0". No other meaning.
3. `references/migration-v2.md`:
   - after line 190 (the report shape) `[MV320_1]`: `baseline is one of recorded, v2.0.0, shipped, v3.0.0, fresh or unknown. v3.0.0 means a full ownership record whose hash is the default policy shipped by project-setup 3.0.0 and 3.1.0; its managed list is the current default without the entries added in 3.2.0 (env/** and cert/**, both root-anchored).`
   - after line 223 `[MV320_2]`: three sentences: a 3.0.0 or 3.1.0 fresh install is offered exactly the two new coverage rows; `include` is the recommended choice and `omit` is recorded as an explicit omission; an omission does not remove setup's own refusal to read those paths (item 6 below).
4. `references/security.md`, one paragraph inserted after line 22 `[SE320_1]`: the two root directories, why they are root-anchored, and that setup scripts refuse them from the moment 3.2.0 is installed, whatever the project's coverage decision, because the setup refusal set is the union described in the first paragraph (`references/security.md:8-10`).
5. `SKILL.md:42-43` (rule 2 prose list) and `assets/templates/AGENTS.md:14` are illustrative lists and are not changed.
6. No change to `scripts/detect.mjs` for A4, and none to `scripts/validate.mjs` or `scripts/apply.mjs`.

**Frozen-plan note (critique F12).** This amends the closed baseline set defined by the frozen C3 plan (`docs/plans/2026-10-18-project-setup-v3-rc1-c3.md`, named at `scripts/migrate-security-paths.mjs:5`; the plan file itself was not read, UNVERIFIED). The frozen file is not edited. Approval is recorded as this plan's maintainer-absent decision (section 9, D-2) and is listed for the maintainer in the PR body.

**Protection is immediate (D-3).** Once 3.2.0 is the running skill, detect, validate and apply treat root `env/**` and `cert/**` as protected through the shipped defaults (section 0 item 6).
- A project with a tracked file under root `env/` or `cert/` gets it in `trackedSecretPaths` (`scripts/detect.mjs:206`) and the "stop and escalate" warning (`:409`); `SKILL.md:198` makes that a Phase 0 stop. This happens before any coverage decision, and `omit` does not clear it.
- Decision: this is the intended strengthening.
- The notes carry a numbered upgrade note with the way out: move non-secret files out of root `env/` and `cert/`, or escalate to the owner; setup does not continue past the stop.
- `apply.mjs` likewise refuses to read or write root `env/` and `cert/` paths (advisor X5-2).

**What an installed project sees on its next update.**

| Installed state | Report | Decisions |
|---|---|---|
| Fresh install by 3.0.0/3.1.0 (`full`, old shipped hash), file untouched | baseline `v3.0.0`, 20 `unchanged`, coverage for `env/**` and `cert/**` | two: `include` or `omit` each |
| Same record, user added the two globs to `patterns` by hand (known issue 4 advice, `RELEASE-NOTES-3.1.0.md:147-148`) | baseline `v3.0.0` (the record decides, not current bytes), 20 `unchanged`, two `project-addition` rows, two coverage rows with `alreadyEffective: true`; validate shows `policy-managed` fail (edited since install, `:288-289`) | four; valid combinations below |
| Same record, user added them to `projectPatterns` | 20 `unchanged`, two coverage rows with `alreadyEffective: true` | two; `include` leaves the identity in both collections (Q6) |
| Migrated project (`keys`) | baseline `recorded`, coverage for the two | two |
| Migrated project (`keys`) that already holds `env/**` or `cert/**` in `projectPatterns` from its v2 migration (the reference service, `docs/design/project-setup-v3.md:270,289`; R2-8) | baseline `recorded`, two coverage rows with `alreadyEffective: true` | two |
| Fresh install by 3.2.0 | baseline `shipped`, no coverage | none |
| v2.0.0 project | baseline `v2.0.0`, existing rows plus the two | existing plus two |
| `full` record with any other hash | baseline `unknown`: 20 `managed-edit` plus 22 coverage rows (unchanged behaviour) | 42 |

Valid decision combinations for the hand-edited `patterns` row, per identity (derived from `scripts/migrate-security-paths.mjs:196-211`; the tests lane proves each against the real function):

| Addition row | Coverage row | Result |
|---|---|---|
| `keep` | `include` | valid; one managed entry (recommended) |
| `project` | `include` | valid; identity in `patterns` and `projectPatterns` |
| `project` | `omit` | valid; managed omission recorded, project entry protects |
| `omit` | `omit` | valid; both dropped, omission recorded |
| `keep` | `omit` | `MIGRATION_DECISIONS` (kept and omitted in one run, `:211`) |
| `omit` | `include` | `MIGRATION_DECISIONS` (same line) |

After the stage the policy is schema 2 with `keys` ownership, as for every staged migration (`SKILL.md:283-284`).

**Rendering (critique F14).** `renderSecurityControls` gives Claude the leading slash for a root anchor (`scripts/render-permissions.mjs:98`): `Read(/env/**)` and `Read(/cert/**)`. The Git exclusions are `:(exclude,glob,icase)env/**` and `:(exclude,glob,icase)cert/**` (`:102`). The Codex snippet carries the JSON strings `"env/**"` and `"cert/**"` (`:103`; the surrounding snippet text was not read, UNVERIFIED). These are the first shipped root-anchored defaults. Host effectiveness is not claimed until D6 is recorded: `references/claude.md` ("The root-anchor parity row was not run") and `docs/design/project-setup-v3.md:252` (Codex workspace-root semantics TO VERIFY).

**Detect on a failed derivation (critique F13).** The derivation cannot fail on its own. The only failure is a malformed shipped policy, which already throws a coded error turned into the existing `policy-schema` fail row (`scripts/detect.mjs:183-186`). That row is kept unchanged, including its text that names the project file (a pre-existing imprecision, out of scope).

**Acceptance criteria (`tests/v320.test.mjs` unless stated).**
- AC-A4-1: `tests/fixtures/v320-policy-3.1.0.json` (test-only copy of the 3.1.0 policy, not shipped) has raw SHA-256 `37711ab7...` and `PRIOR_SHIPPED.sha256` is by definition the `normalizedHash` (real `scripts/lib.mjs`) of that fixture; the record the manifest stores is `normalizedHash(text)` (`scripts/apply.mjs:626`; `normalizeText` strips a BOM, turns CRLF into LF and adds a final LF only if missing, `scripts/lib.mjs:209-214`). The test asserts only `normalizedHash(fixture) === PRIOR_SHIPPED.sha256`, never a raw digest, so a CRLF checkout of the fixture cannot fail it (R2-9).
- AC-A4-2 (`tests/release-3.2.0.test.mjs`): the new `data/secret-paths.json` passes the real `readSecurityPolicy` with `sourceSchema` 1; its identity set is the 3.1.0 set plus exactly `["root","env/**"]` and `["root","cert/**"]`; the 20 old entries are deep-equal and in the same relative order.
- AC-A4-3 (drift guard, D-2 b): the prior list derived from the shipped file is deep-equal, in order, to the validated patterns of the fixture copy. A later release that edits an old entry fails here until `PRIOR_SHIPPED` is updated or removed.
- AC-A4-4 (real functions, literal inputs): for each row of the state table, `classifySecurityMigration` returns the stated baseline, classifications and `requiredDecisions` counts (42 for the `unknown` row); `inspectSecurityState` returns `pass` then `behind` for the first row and no `unknown` row.
- AC-A4-5: for each row of the combination table, `resolveSecurityMigration` returns a policy that passes the real `readSecurityPolicy`, or throws `MIGRATION_DECISIONS`, as stated. With `include` for both on the first row, all 20 identities and all `projectPatterns` are kept and no omission is recorded. With `omit` for both, exactly two omissions are recorded and a second report has no coverage row for them.
- AC-A4-6 (selection order): a `full` record with the desired hash gives `shipped` even when a test mutates `PRIOR_SHIPPED.sha256` to equal it (scratch copy of the script; mutant "prior matched before desired" fails). A `full` record with the v2 hash gives `v2.0.0`. With a desired policy lacking either added identity (the 3.1.0 file as desired), a `full` record with the prior hash equals the desired hash and gives `shipped`, and any other hash gives `unknown`: the derivation is inert.
- AC-A4-7 (same baseline everywhere; real CLIs on one synthetic project installed with the 3.1.0 policy and a `full` record): `migrate-security-paths.mjs report` shows baseline `v3.0.0` and a `reportSha256`. After a stage with `include` for both, `apply.mjs prepare`, both `apply.mjs diff` reviews and `commit` succeed (no `MIGRATION_REPORT_CHANGED`). Before the stage, `validate.mjs --json` and `detect.mjs` both show `policy-managed` pass plus `policy-version` behind and no `policy-baseline` row.
- AC-A4-8 (rendering): after that commit, `render-permissions.mjs json` contains exactly `Read(/env/**)` and `Read(/cert/**)` among the read denies, `:(exclude,glob,icase)env/**` and `:(exclude,glob,icase)cert/**` among the pathspec excludes, and the Codex snippet contains `"env/**"` and `"cert/**"`. `isSecretPath('env/x')` is true and `isSecretPath('src/env/x')` is false with the real helper.
- AC-A4-9 (D-3): on a synthetic 3.1.0-installed project with a tracked `env/x`, before any decision, the real 3.2.0 `detect.mjs` lists `env/x` in `secrets.trackedSecretPaths` and emits the "stop and escalate" warning. After a stage with `omit` for both and commit, it still does.
- AC-A4-10: a draft that removes `env/**` after it was included is refused with `APPLY_POLICY_REGRESSION`.
- AC-A4-11 (Q6): a schema-2 policy with the same identity in `patterns` and `projectPatterns` passes the real `readSecurityPolicy` and yields one effective pattern with two sources (`assets/tools/security-policy.mjs:171-183`).

**Edge cases and failure modes.**
- A project whose root `env/` holds only non-secret files: the user chooses `omit` for the project policy, but setup's own refusal remains (D-3). The notes say so.
- Windows case: identity is lowercased (`assets/tools/security-policy.mjs:151`); `ENV/x` is matched (assert in AC-A4-8).
- A project record hash equal to neither constant: `unknown`, unchanged.

**Rollback.** Project side: the staged migration is one reviewed apply transaction; `apply.mjs rollback --run-id <id>` restores policy, settings and manifest. Skill side: `install.mjs rollback` (after moving the backup back, A5). Code side: revert commit 6 alone; the derivation is self-contained.

### A5. Installer backups discovered as a second skill (report; relocation deferred, D-11)

**Current.** Section 0 item 2. The backup, its `.meta.json` and the `.rolledback-<stamp>` directory are created inside the skills directory (`install/install.mjs:314,319,227`). Rollback finds backups only there (`:157-159,205`) and verifies the recorded full-directory digest before restoring (`:114-122,212`). The digest covers the directory content only (`:89-106`), not its location, so moving a backup out and back is safe. Claude Code 2.1.325 to 2.1.330 listed the backup as a skill (results file `:91-92`); Codex discovery is unverified (`tests/live/BS-DOC-MAP-ACCEPTANCE.md:103`).

**Decision (D-11): detect reports; relocation is deferred.** Reasons: a manual move is safe; relocation changes install and rollback paths and output; the installer's historical regression net would then only run in the view; the maintainer already moves backups by hand. Conditions adopted: AC-A5-7, the numbered upgrade step in the notes, D8 in the measurement phase, and a TODO entry (C3).

**Intended.**

1. `scripts/detect.mjs`: new function `scanInstallerLeftovers(base)`.
   - It scans top-level entries only of each skills base already scanned at `:347-351` (`claudeHome/skills`, `<root>/.claude/skills`, `~/.agents/skills`, `codexHome/skills`, `<root>/.agents/skills`), not the plugins base (`:352`).
   - It reports real directories (links are skipped) whose name matches `^\.project-setup\.(bak|rolledback)-` and which contain `SKILL.md`.
   - Output: a new top-level array `installerBackups` of `{ tool, scope, path, kind }` (`kind` is `bak` or `rolledback`), sorted by path, deduplicated by canonical path per tool as at `:359-362`.
   - One warning per tool that has any:

     ```text
     <tool>: <n> project-setup installer backup(s) with SKILL.md are inside the skills directory (<paths joined by "; ">); the host can list each as another project-setup skill. Move them out of the skills directory, move them back before install.mjs rollback, and confirm one active copy in a new session
     ```

   - They are not added to `installs` or `installConflicts`: their host identity and disabled state cannot be known from the filesystem.
2. `SKILL.md` Phase 0 step 1, inserted after line 200 `[SK320_3]`: `Act on an installerBackups warning before continuing: a backup inside the skills directory can be an active second copy.`
3. `references/claude.md`, section "Retiring v1", one bullet appended to the "Facts learned live" list `[CM320_1]`: the observation (Claude Code 2.1.325 to 2.1.330 listed `.project-setup.bak-*` as a skill), the move-out and move-back procedure including the `.meta.json` sibling, and that Codex discovery is unverified. The anchor is the list's last bullet ("writes it (write denylist)."); its line number is UNVERIFIED (content seen without line numbers).
4. `@root/TODO.md`: entry for the relocation candidate (C3).

**Acceptance criteria (`tests/v320.test.mjs`; real `detect.mjs`, isolated `HOME`/`USERPROFILE`, `CLAUDE_CONFIG_DIR`, `CODEX_HOME`).**
- AC-A5-1: with no leftover, `installerBackups` is `[]` and no such warning exists.
- AC-A5-2: one `.project-setup.bak-3.0.0-1` with `SKILL.md` under the Claude skills dir gives one entry (`tool` claude, `kind` bak) and exactly one warning for claude, none for codex.
- AC-A5-3: a `.project-setup.bak-*` directory without `SKILL.md`, a `.project-setup.bak-x.meta.json` file, a `.project-setup.tmp-*` directory, a symlinked backup, and a backup one level deeper produce no entry.
- AC-A5-4: a `.project-setup.rolledback-*` with `SKILL.md` is reported with `kind` rolledback.
- AC-A5-5: `installs` and `installConflicts` are deep-equal with and without the leftovers.
- AC-A5-6 (real `install.mjs`, isolated dirs): install 1, install 2 (creates a backup); move the backup directory and its `.meta.json` out; `rollback` exits 6 ("no backup to restore", `install/install.mjs:207`); move both back; `rollback` exits 0 and `verify` reports the restored version.
- AC-A5-7 (D-11 condition 1): install a 3.1.0 source (a scratch copy reversed with `to310Repo`), then the candidate from the real tree, both with the real `install.mjs`; the real `detect.mjs` then reports exactly the backup that install created (`kind` bak, version token `3.1.0` in the name) for each target.

**Edge cases.** Unreadable skills dir: no entries, no throw (as `scanSkillCopies`, `scripts/detect.mjs:280`). `CODEX_HOME` equal to `~/.agents`: one entry.

### A6. BS stamp inconsistency (record only)

BS 3.1.0 wrote `.backend-standards.json` on the ps-first fixture and not on bs-existing (results file `:34,93`). `references/docs-generation.md:175` states that the existing-project procedure writes no stamp. No code change; one `@root/TODO.md` entry (C3 `[TD320_3]`). AC-A6-1: the entry text is present once (root-file records of the release gate).

### A7 and A8

Covered by A3 (`[DG320_2]`, `[DG320_3]`, `[SK320_2]`). A8 is the "not applicable" paragraph of the same rule.

### B1. SENSITIVE: canonical reviewer, a critical money rule keeps its severity

**Current.**
- `assets/agents/reviewer.md:93-95`: a failure that needs "a future caller" is not a finding (Open questions, or a suggestion with severity INFO). `:103-104`: "a caller that does not exist is not" reachable. `:306`: information you cannot see is an open question, not a finding. `:370`: the verdict blocks on "any confirmed CRITICAL/HIGH bug or vulnerability".
- Project rules may tighten but never relax "sections 1 or 4" (`:311-313`); section 2 is not protected.
- Codex rated the seeded lost update INFO in two of two rc.4 runs and again on 2026-11-22 (`docs/plans/2026-11-02-project-setup-v3-rc4-host-measurements.md:146-152`; results file `:62`).
- The template critical rule has no MUST keyword (`assets/templates/AGENTS.md:22-23`).

**Intended.** Two insertions; no existing line changes.

`[RV320_1]`, inserted after line 95 (blank line before and after):

```text
Money and state integrity are the exception. Code in the reviewed change that breaks a
critical rule in AGENTS.md, whatever its wording, or a MUST-level rule in the documents
it names or in the project review rules, for a money, balance, payment, points or limit
flow is a finding whatever its current reachability: for example a read-modify-write
without a lock or atomic statement, or a retry without proven idempotency. You MUST rate
it HIGH or CRITICAL. A missing caller, route or funding path MUST NOT lower that severity
or move it to Open questions, because such code is one wiring change away from moving
money and the change that wires it is rarely reviewed against this code's locking.
State the missing reachability in the Scenario (the interleaving once the code is
called) and in Confidence. Classify it **likely risk** while nothing calls it and
**confirmed bug** when something does. For these flows this paragraph overrides the
reachability rule above, the "caller that does not exist" sentence below, the
open-question rule of section 4 as far as it concerns reachability, and the verdict
rule of section 5 as stated there. A project rule MUST NOT relax this paragraph; on
conflict follow this paragraph and report the conflict.
```

`[RV320_2]`, appended after line 370 (the last line of the file):

```text
   A money or state-integrity finding rated HIGH or CRITICAL under the exception in
   section 2 makes the verdict **block**, including when it is classified likely risk.
```

Lines 311-313 are not replaced (D-8). Advisor Q8's separate sentence after line 314 is not added: the protection is inside the paragraph.

**Pins of the current bytes.** `assets/agents/reviewer.md` `696f86bc...` is pinned at `tests/release-3.1.test.mjs:102`; `assets/templates/CLAUDE.md` `5bb1d5ed...` at `:104`; `assets/templates/AGENTS.md` `616a26a5...` at `:103`; the wrappers at `:117-120` (unchanged in 3.2.0). The further pin locations the draft listed in c13 to c17 and `tests/fixtures/c17-upgrade-baselines.json` are UNVERIFIED (not re-read). None is edited: they are historical pins, satisfied in the 3.1.0 view (section 4). The 3.2.0 bytes get new pins in `tests/release-3.2.0.test.mjs`. `scripts/check-agent-baselines.mjs` pins only the v2.0.0 snapshots and is unchanged.

**Updating a project that holds the 3.1.0 reviewer.** `.ai/agents/reviewer.md` is fully managed with a recorded hash (`references/state-and-apply.md:7`). Per `references/modes.md:124-130`: unchanged file and changed template -> regenerate; user-modified -> keep, take new or merge; kept -> incomplete update in the report (`SKILL.md:432-433`). No new mechanism.

**Acceptance criteria.**
- AC-B1-1 (`tests/release-3.2.0.test.mjs`): both paragraphs are present once at their anchors (the first inside section 2, before the "Plan coverage" paragraph; the second after the Verdict line); the file is otherwise the 3.1.0 bytes; every 3.1.0 line holding MUST/SHOULD/MAY is still present.
- AC-B1-2 (`tests/v320.test.mjs`): the rendered reviewer contains no `{{`.
- AC-B1-3 (real `apply.mjs`, synthetic schema-3 project with the rendered 3.1.0 reviewer and its manifest hash): draft the 3.2.0 reviewer; `prepare` exits 0 without `--approve-user-content`; `commit` succeeds; the manifest hash for `.ai/agents/reviewer.md` is the normalized hash of the new bytes and `skillVersion` is `3.2.0`; `validate.mjs` has no drift row; `.ai/agents/reviewer.project.md` bytes are unchanged.
- AC-B1-4: same project with one user-added line in the installed reviewer: `prepare` exits 3, `APPLY_APPROVAL_REQUIRED` names exactly `.ai/agents/reviewer.md`; with the approval it commits.
- AC-B1-5: no reviewer draft (declined): commit of the rest leaves the reviewer bytes and its manifest record unchanged; a second identical run produces zero diff, manifest included.
- AC-B1-6: isolated install of 3.2.0 into both targets: the installed `assets/agents/reviewer.md` equals the source bytes; `verify` reports `current`.
- AC-B1-7 (mutants, 5.2 item 7): each of these fails a named assertion: the paragraph placed in section 4; "MUST rate it HIGH or CRITICAL" weakened; the "A project rule MUST NOT relax this paragraph" sentence removed; `[RV320_2]` removed (advisor Q7); "whatever its wording" removed.
- Live: D1.

### B2. SENSITIVE: L16 launch rule, false refusal after the parent changed directory

**Current.**
- The launch rule exists only in the root Claude template (`assets/templates/CLAUDE.md:6-29`). The reviewer wrapper has no launch text (not re-read; as cited by the draft).
- Recorded cause: "The parent's brief said the session was currently in `sub`. The reviewer made no tool call and stopped, reading `sub` as the session start" (rc.4 record `:128-130`). A parent that states the original start recovers it (`:131-135,175-177`).
- What a subagent's own environment context shows is not measured.
- `references/claude.md` ("Subagent wrappers") tells the parent it SHOULD pass the three directories; that text is skill-side and not installed in projects.

**Intended (two sides, both in installed, managed text; D-7).**

`[CT320_1]`, `assets/templates/CLAUDE.md`, a new bullet inserted after line 26 (inside the `claude` block):

```text
- For a delegated agent this bullet replaces the directory comparison above. A delegated
  agent's context or brief MAY show the directory its parent was in rather
  than the session's original start directory. As a delegated agent you MUST treat the
  original start directory as unknown unless the brief states it. You MUST NOT refuse on
  your own working directory alone, and when the brief does not state the original start
  directory you MUST state in your output that it was not given. This prevents a false
  launch refusal after the parent changed directory inside a root-started session. If
  the brief states an original start directory strictly below the selected rule's
  directory, the refusal above applies unchanged. The parent session stays bound by
  this rule.
```

`[AT320_2]`, `assets/templates/AGENTS.md`, inserted after line 79 and before `[AT320_1]`:

```text

When you delegate to `reviewer` or `docs-sync`, state in every brief the session's
original start directory, the repository root and the current directory. Do not invent
a start directory you were not given; say that it is unknown instead.
```

The text asserts no host behaviour ("MAY show"); the subagent-environment probe is part of D2. The wrapper is not changed: its bytes equal the v2.0.0 snapshot (`tests/release-3.1.test.mjs:118` and `:127` carry the same digest), and "a wrapper whose shipped replacement equals its installed v2 baseline gets no draft" (`SKILL.md:333-334`).

**Security note.** This narrows when a subagent refuses. The parent, which holds the real launch context, is still required to stop (`assets/templates/CLAUDE.md:19-22`), and a stated below-root start still refuses. Residual: a parent that wrongly continues after a real subdirectory start no longer gets a second refusal from the subagent on working directory alone. The new duty to state "not given" makes that case visible in the output.

**Acceptance criteria.**
- AC-B2-1 (`tests/release-3.2.0.test.mjs`): both insertions are present once at their anchors; every 3.1.0 line of the `claude` block is still present byte for byte; the block has one begin and one end marker; the template is at most 200 lines (`scripts/validate.mjs:365`).
- AC-B2-2 (`tests/bs-doc-map.test.mjs`): `checkClaudeRecovery` with the 3.2.0 template accepts a block rendered from it and rejects the 3.1.0 block.
- AC-B2-3 (real `apply.mjs`): a project with the 3.1.0 `claude` block and recorded block hash takes the new block with no user-content approval; user text outside the block and the `@AGENTS.md` import are byte-identical afterwards (`references/docs-generation.md:38-41`).
- AC-B2-4 (mutants, 5.2 item 8).
- Live: D2 with its negative control.

**Edge cases.** Nested worktree roots: the "nearest rule" bullet (`assets/templates/CLAUDE.md:16-18`) is unchanged. Codex has no launch rule; the AGENTS.md sentence is harmless there.

### C1. Acceptance procedure (`tests/live/BS-DOC-MAP-ACCEPTANCE.md`), implement lane

**Current.** Section 1 tells the maintainer to disable, not move, a backup (`:84-86,95-96`) and then records the opposite deviation (`:96-103`). Section 2 has the ACL note (`:136-141`); section 3 places fixtures under `D:\ps-live` without referring to it (`:145-152`). Section 6 ships the Lock order unit (`:387-405`).

**Intended (records `[AC320_*]`; replacements where marked).**

1. Section 1 step 1 (`:84-86`, replacement): move every `.project-setup.bak-*` directory together with its `.meta.json`, and every `.project-setup.rolledback-*` directory, out of both skills directories into `D:\ps-live\preserved\installer-backups\<target>\`; record each original path; run `detect.mjs` and require an empty `installerBackups`.
2. `:95-103` (replacement of the first two sentences; the dated deviation sentence and "Whether Codex discovers an installer backup as a skill is unverified" stay): before any `install.mjs rollback`, move the newest backup directory and its `.meta.json` back to the recorded path, unmodified (rollback verifies the recorded digest), run rollback, then `verify`.
3. Section 2 (insertion after `:141`): `Create fixtures only under a directory that already carries the CodexSandboxUsers read-and-execute entry, and check it before the first Codex run.` Section 3 (insertion after `:145`): a one-line reference to it.
3b. Introduction (insertion after `:21-22`, R2-15): one sentence saying that `tests/release-3.1.test.mjs` and `tests/c18.test.mjs`, named there as static gates, run from 3.2.0 on only in the reconstructed 3.1.0 view (`tests/run-310-view.mjs`), not directly in the working tree.
4. Reviewer prerequisite (insertion after `:422`). The existing unit at `:398-404` is the shipped text and is not replaced:

   ```text
   The wording of the Lock order rule used in the 2026-11-14 and 2026-11-22 measurements was
   not recorded, so a new reviewer measurement with the unit above is not directly comparable
   with those results; record that in the results row.
   ```

5. Scenario row `:177` (replacement of the last sentence): names the expected Subagents variant and agents-block sentence for the declined case (A1).
6. Evidence-file fields for the A3 checkers (insertion after `:210`).
7. Two known gaps, as insertions in section 5: headless auto-mode PS rows are recorded as deviations (results file `:26-27`); the user-level `code-review` skill is visible to an `--isolated` Codex run (results file `:62`) and must be recorded or removed for D1.

No edit touches the section 7 matrix (`MATRIX_SHA`, `tests/bs-doc-map.test.mjs:4153`, checked at `:4191,4219`).

**Pins in the living spec that these edits touch (tests lane, D-14).**
- `P01` requirement text at `tests/bs-doc-map.test.mjs:4074` ("... without moving the installer backup") and its mutant at `:4234`: both replaced with the new step 1 sentence. The old instruction becomes a negative control (putting it back fails `P01`).
- A further occurrence of "pending stage-2" at `:4227` (long line, content UNVERIFIED): the tests lane reads it and updates or keeps it according to what it asserts.

**Acceptance.** AC-C1-1: `tests/bs-doc-map.test.mjs` pins the new step 1 sentence and rejects the old one. AC-C1-2: the `accProblems` rule (`tests/release-3.1.test.mjs:1213-1219,1357`) still holds for the 3.2.0 doc: only the two `$env:USERPROFILE` skill directories for user paths. `D:\ps-live\...` paths are already present in the doc (`:39,49`) and are not user-profile paths. AC-C1-3: the matrix digest is unchanged.

### C2. Acceptance introduction and the `INTRO` pin

**Current.** `tests/live/BS-DOC-MAP-ACCEPTANCE.md:7-11` still says "Status: pending stage-2 acceptance sign-off". `INTRO` is defined at `tests/bs-doc-map.test.mjs:4131`, checked at `:4186`, used in a synthetic document at `:4200`, with mutants at `:4311`.

**Intended.** Replace the paragraph in the doc (implement lane, `[AC320_1]`) and `INTRO` in the spec (tests lane, `[BT320_1]`) with:

```text
Status: stage 2 signed off. The section 7 matrix holds the dated results of 2026-11-14
to 2026-11-22; the per-row record is
`docs/plans/2026-11-22-project-setup-v3.1-live-acceptance-results.md`. This procedure
still records the scoped 2026-11-14 Claude Code isolation probe, the 2026-11-15
init-event confirmation and the 2026-11-15 project-control probe below. Rows that were
not measured are listed in `RELEASE-NOTES-3.1.0.md`; the 3.2.0 re-measurements are
listed in `RELEASE-NOTES-3.2.0.md`.
```

The mutant at `:4311` is kept with the new text. New mutant: the old "pending stage-2" paragraph put back fails `intro`.

Because the tests lane runs first, the living spec is red against the 3.1.0 doc on `intro` and `P01` until commit 8 lands. This is expected and listed in the tests-lane report.

**Acceptance.** AC-C2-1: in-tree `node tests/bs-doc-map.test.mjs` passes at the PR head. AC-C2-2: with the doc edited and the pin not (or the reverse), it fails on `intro`.

### C3. Root `TODO.md`, `references/modes.md` observation, release bookkeeping

`@root/TODO.md` is Prettier-checked (not under `project-setup/`); `npm run check` must stay green. It is not a normative file: the keyword rule of the gate does not apply to it (D-4), and its non-insertion records are pinned by id as approved replacements.

| Lines today | Change | Record |
|---|---|---|
| 25-32 reviewer residuals | Not replaced. Insert after line 32, inside the item: `Status 2026-11-22: project-setup 3.2.0 ships both fixes as text only (the money-severity rule of the canonical reviewer and the delegated-agent launch bullet); neither is measured. This item stays until measurements D1 and D2 of docs/plans/2026-11-22-project-setup-v3.2.0-plan.md are recorded.` | `[TD320_1]` insertion |
| 71, last sentence "Not exercised: the agents themselves, Codex, or PS then BS." | Replace with: `The 3.1.0 live acceptance (2026-11-14 to 2026-11-22) exercised the agents on both hosts and PS then BS (merge branch only). Not exercised: the BS overwrite branch and Codex PS rows.` | `[TD320_2]` replacement |
| 55-70 BS 4.0.0 integration | Keep (still open: `references/docs-generation.md:429`, `RELEASE-NOTES-3.1.0.md:128-130`) | none |
| 72-80 acceptance timeout | Keep; D10 adds a data point | none |
| new, "Needs manual review" | `backend-standards stamp behaviour differs between two existing-project runs. BS 3.1.0 wrote .backend-standards.json on the PS-first fixture and not on the BS existing-project fixture (2026-11-14). The existing-project procedure is documented as writing no stamp. Decide which is intended and make the skill do it every time; project-setup accepts both signals.` | `[TD320_3]` insertion |
| new, "Needs manual review" | `project-setup installer backups live inside the skills directory. 3.2.0 makes detect report them and documents the manual move. Moving the backup location out of host discovery is a candidate for the next minor and needs the recorded skill-discovery probe (D8 of the 3.2.0 plan) first.` | `[TD320_4]` insertion |
| new, "Needs manual review" | `project-setup 3.1.0 rows not measured`, with the list of `RELEASE-NOTES-3.1.0.md:108-116` | `[TD320_5]` insertion |

Resolved items are deleted, not ticked. None can be deleted at stage 1: every fix is unmeasured. The post-measurement sign-off deletes the residual item (lines 25-32 plus the status sentence) through one closeout record, the TD31_1 pattern (`tests/helpers/v31-amendments.mjs:10`); that record may carry a keyword because TODO is not normative (D-4).

`references/modes.md`, inserted after line 76 `[MD320_1]`: `The 3.1.0 live acceptance (2026-11-14 to 2026-11-22) later exercised the agents on both hosts and PS followed by BS (merge branch only); see RELEASE-NOTES-3.1.0.md.` Lines 74-76 are a dated statement about one run and stay.

Release bookkeeping:
- `VERSION`: `3.2.0` plus LF `[VR320_1]` (replacement). `SKILL.md:6` heading `[SK320_1]` (replacement).
- `CHANGELOG.md`: new `## 3.2.0` entry first `[CL320_1]`.
- New `RELEASE-NOTES-3.2.0.md`. Contents:
  - compatibility;
  - per-item changes;
  - the correction of 3.1.0 known issue 1;
  - "Upgrading" as numbered steps: (1) install, (2) move the installer backup and its `.meta.json` out of the skills directory and note the path, (3) start a new session and confirm one active copy, (4) if the project tracks files under root `env/` or `cert/`, setup stops in Phase 0: move non-secret files out or escalate, (5) on update, decide the two coverage rows;
  - what an existing project is offered;
  - verification commands (5.4), stating that the historical gates run only through the view runner and that CI does not run them;
  - "Not measured" (everything in section 8 until recorded, with the root-anchor claim scoped to static rendering until D6);
  - known limitations.
  - Contract: no 40- or 64-hex id (`install/release.mjs:55`; so the `37711ab7...` digest is not quoted), LF, no BOM, no personal path.
- `README.md` (project-setup), `@root/README.md`, `@root/.ai/context/project-tree.md`: the current-version claims 3.1.0 -> 3.2.0 and the verification command list. The exact lines are those amended by RM31_*, RR31_* and PT31_* (`tests/helpers/v31-amendments.mjs:6-9`); these three files were not re-read line by line (UNVERIFIED anchors). The implement lane lists each changed line in its report.
- `RELEASE-NOTES-3.1.0.md` is historical and is not edited.

**Acceptance.** AC-C3-1: the release gate proves `@root/TODO.md` is the 3.1.0 bytes plus exactly these five records, and that lines 25-32 are byte-identical. AC-C3-2: `npm run check` passes (orchestrator).

## 3. Out of scope

- Installer backup relocation and any change to `install/install.mjs` or `install/release.mjs` (D-11).
- Any change to `scripts/validate.mjs`, `scripts/apply.mjs`, `scripts/blocks.mjs`, `scripts/lib.mjs`, `scripts/render-permissions.mjs`, `assets/tools/*`, the wrappers, the canonical docs-sync, `scripts/check-agent-baselines.mjs`, `data/v2.0.0/*`, `data/secret-paths-v2.0.0.json`, `evals/evals.json`. A change that turns out to need one of these is a deviation: stop and report.
- A shipped policy snapshot file or a new migration input field (rejected by D-2).
- Manifest or policy schema changes.
- backend-standards and toolchain-config files (A6 is a TODO entry only; no version stamp is touched, and the version-stamp guard does not cover project-setup, `@root/.ai/context/project-tree.md`).
- A new `validate.mjs` check for the Subagents line (Q4).
- Editing any historical test, helper, fixture or runner under `project-setup/tests/` other than the three living files named in 4.2.
- Editing any file under `docs/plans/` other than adding this plan and later result records.
- Running live measurements (orchestrator, section 8).

## 4. Amendment-gate design

### 4.1 Constraint

Historical specs execute the real scripts and read the real data (section 0 item 4), and the historical test files and both runners are byte-pinned as unedited (`tests/release-3.1.test.mjs:163-216`, runners at `:1400-1405`). A reversal reader cannot make them pass in a tree whose scripts and data changed. Decision Q1 (a): historical gates run unedited in a verified 3.1.0 view.

### 4.2 Principle and files

No historical test, helper, fixture or runner is edited. The 3.2.0 tree is proven to be "the pinned 3.1.0 tree plus exactly the recorded amendments and exactly the listed new files". The 3.1.0 tree is reconstructed into a scratch directory by verified reversal, and every historical gate runs there from its own copy; each spec derives its roots from `import.meta.url` (`tests/release-3.1.test.mjs:79-80`, `tests/helpers/v31-amendments.mjs:320`, `tests/helpers/c18-amendments.mjs:197`, `tests/accept-rc1.mjs:20-21`).

`NEW_FILES320` (closed list, exactly these, all under `project-setup/`):

| Path | Role | Installed? |
|---|---|---|
| `tests/helpers/v320-amendments.mjs` | records, engine, view builder (importing it reads no file and starts no process) | no |
| `tests/fixtures/v320-prechange.json` | pins of the 3.1.0 bytes | no |
| `tests/fixtures/v320-policy-3.1.0.json` | byte copy of the 3.1.0 `data/secret-paths.json` (D-2 b) | no |
| `tests/fixtures/v320-compat-expected.json` | pinned expected-failure labels of the two compat runs | no |
| `tests/release-3.2.0.test.mjs` | the 3.2.0 release gate (standalone) | no |
| `tests/v320.test.mjs` | behaviour and contract spec (standalone) | no |
| `tests/run-310-view.mjs` | builds the view and runs named historical gates in it | no |
| `RELEASE-NOTES-3.2.0.md` | notes | no (in the release zip only) |

The installed file set gains nothing: `INCLUDE` is `SKILL.md`, `VERSION`, `CHANGELOG.md`, `references`, `assets`, `data`, `scripts` (`install/install.mjs:29`), and no file is added under those.

Amended files (closed list):
- Skill: `SKILL.md`, `VERSION`, `README.md`, `CHANGELOG.md`, `references/docs-generation.md`, `references/modes.md`, `references/migration-v2.md`, `references/security.md`, `references/claude.md`, `assets/agents/reviewer.md`, `assets/templates/CLAUDE.md`, `assets/templates/AGENTS.md`, `data/secret-paths.json`, `scripts/detect.mjs`, `scripts/migrate-security-paths.mjs`.
- Living test files: `tests/bs-doc-map.test.mjs`, `tests/live/bs-doc-map.mjs`, `tests/live/BS-DOC-MAP-ACCEPTANCE.md`.
- Root: `@root/README.md`, `@root/TODO.md`, `@root/.ai/context/project-tree.md`.

### 4.3 `tests/helpers/v320-amendments.mjs`

- `CURRENT_VERSION320 = '3.2.0'`.
- `AM320`: frozen map id -> frozen `{ file, before, old, neu, after }`, all strings, LF only: the record shape and exactly-once semantics of `AM31` (`tests/helpers/v31-amendments.mjs:15-18,275-287`). `before + old + after` is the 3.1.0 slice; `before + neu + after` the 3.2.0 slice. Keys are relative to `project-setup/`; root files are `@root/<path>`.
- `FORWARD_ORDER320`, `REVERSAL_ORDER320` (exact per-file reverse), `AMENDED_FILES320`, `NEW_FILES320`.
- `reverseSteps(text, ids)`, `applySteps(text, ids)`, `reverseForFile(text, rel)`, `applyForFile(text, rel)`: the contracts of the 3.1 helper (`:290-318`).
- `read310(absPath) -> Buffer`: the verified 3.1.0 bytes of an amended real-tree file (reversal, then SHA-256 compared with an in-module pin); other paths as is; throws when a reversal does not verify.
- `VIEW_COPY_SET`: frozen list of repository-relative prefixes: `project-setup/`, `backend-standards/templates/`, `README.md`, `TODO.md`, `.ai/context/project-tree.md`. `backend-standards/templates/` is needed because `tests/bs-doc-map.test.mjs:67-72` reads its docs and agents.
- `buildView({ repoRoot, outDir, includeUntracked = false })`:
  - Lists files with `git ls-files -z -- <copy set>` (tracked files only) run with `cwd: repoRoot`; with `includeUntracked` it uses `git ls-files -z -co --exclude-standard` (orchestrator runs before a commit exists).
  - Copies the working-tree bytes of exactly those files into `outDir`, which must be empty and outside the repository. The runner (`run-310-view.mjs --out`) additionally requires it outside the temp directory (Codex sandbox reason). The specs (`release-3.2.0.test.mjs` section G, AC-A5-7) use an OS temp scratch directory they create and remove themselves, like `tests/release-3.1.test.mjs:1517` (R2-3); P-2 includes one run from a directory under the temp directory.
  - Copies nothing else: no `.git`, no `node_modules`, no ignored file.
- `to310Repo(viewDir)`: reverses every amended file (each record verified at its anchor), removes exactly `NEW_FILES320`, and throws unless every amended file hashes to its 3.1.0 pin. An unrecorded edit elsewhere is left in place so the later comparison shows it (the rule of `to30Tree`, `:343-356`).
- `overlay(viewDir, repoRoot, relPaths)`: after `to310Repo`, replaces only the named skill files with their real-tree 3.2.0 bytes (compat run).

Record granularity: documents, agents, templates and data use insertion records. Replacements are the closed list `SK320_1`, `VR320_1`, the `RM320_*`/`RR320_*`/`PT320_*` version lines, `TD320_2`, `AC320_1` and the C1 replacements, `BT320_1` and the `P01` pin, and code hunks with a nonempty `old`. Fallback for a script whose hunks are not unique: one whole-file record (`before` and `after` empty, `old` and `neu` the full texts); same engine, same pin semantics.

### 4.4 `tests/fixtures/v320-prechange.json` (no file text, no personal path, no secret)

```text
{ "schema": 1,
  "baseCommit": "d0cd48e40f8fea897a27b28d7c679e55f0203237",
  "files": { "<key>": { "sha256": "...", "bytes": n } },
  "replacements": { "<id>": { "file": "<key>", "oldSha256": "...", "neuSha256": "..." } } }
```

`files` holds every 3.1.0 file under `project-setup/` (tests included) and the three root files. `replacements` has one entry per `AM320` record with a nonempty `old`, and no other.

### 4.5 `tests/release-3.2.0.test.mjs` (own engine; modelled on `tests/release-3.1.test.mjs:7-25`)

Independent pins inside the spec, generated from git blobs of the base commit and never read from the helper or fixture:
- the SHA-256 of the 3.1.0 bytes of every file under `project-setup/` and the three root files;
- the SHA-256 of the 3.2.0 bytes of every amended skill, root and living-test file and of the new non-test files (`RELEASE-NOTES-3.2.0.md`). `tests/release-3.2.0.test.mjs` itself, the helper, the runner and the three fixtures are test infrastructure: pinned by set membership only (as `tests/release-3.1.test.mjs:1395-1398` does), never by their own bytes, which would be circular (R2-5);
- per record: id, file, and SHA-256 of `before`, `old`, `neu`, `after`.

For files unchanged since 3.0.0 the 3.1.0 pin equals the `BASE_FILES` value at `tests/release-3.1.test.mjs:90-161` (cross-checked by the generator, not imported). The 3.1.0 bytes of the six 3.1.0 test files, the living tests and `RELEASE-NOTES-3.1.0.md` get their first byte pin here: the existing gate checks their set and tokens only (critique F25; `tests/release-3.1.test.mjs:1395-1411` read only at `:1400,1405,1409`).

Sections:
- A. Layer well formed; actual bytes of every amended file = pinned 3.1.0 bytes + exactly the records; round trip both ways; helper and fixture compared against the spec's pins.
- B. Mutation controls on synthetic data, each checked for the intended failure kind (5.2 item 1).
- C. Obligations.
  - Scope of the keyword rule (D-4): normative files only, that is `SKILL.md`, `references/*`, `assets/agents/*`, `assets/templates/*`, `data/*`.
  - In those, every 3.1.0 line with an uppercase MUST/SHOULD/MAY is still present (16-hex line digests pinned in the spec, the `NORMATIVE_LINES` technique at `tests/release-3.1.test.mjs:381,1284-1286`), and no record's `old` holds such a word.
  - `@root/TODO.md` is exempt through a pinned exception: its non-insertion records are listed by id (`TD320_2` at stage 1) and pinned like the other approved replacements. Lines 25-32 are asserted byte-identical at stage 1.
  - New text carries no listed weakening phrase. Policy: AC-A4-2.
- D. `VERSION`, headings and current public claims say 3.2.0; historical claims stay; notes contract for `RELEASE-NOTES-3.2.0.md` (no 40- or 64-hex id, LF, no BOM, no personal path, an "Upgrading" section with the numbered backup step and the tracked `env/`/`cert/` note, a "Not measured" section).
- E. Every other file equals its pinned 3.1.0 bytes; the `project-setup/` file set is the 3.1.0 set plus exactly `NEW_FILES320`. This includes all historical tests, helpers, fixtures and both runners.
- F. Isolated install into both targets reports 3.2.0; `verify` current; the installed file set equals the 3.1.0 installed set (nothing added, nothing removed); the builder builds `project-setup-3.2.0.zip` from a synthetic tagged repository (tag `project-setup-v3.2.0`, the technique at `tests/release-3.1.test.mjs:1484-1503`); the zip contains `RELEASE-NOTES-3.2.0.md`; the install does not.
- G. (Needs Git ownership of the checkout: `git ls-files` with `cwd: repoRoot` fails for a sandbox user that does not own it; the tests lane runs this spec only where ownership holds, and a Git failure in G is a FAIL with its own label, never a skip; R2-4.) View identity: `buildView` (tracked files) into a scratch directory, `to310Repo`, then every file under `project-setup/` and the three root files equals the pinned 3.1.0 manifest: no extra, no missing, no changed. Then, inside the view and serially, `node tests/release-3.1.test.mjs` and `node tests/c18.test.mjs` must exit 0 with `0 FAIL` in the totals line. (`bs-doc-map` and the strict gate are run by the runner because of their duration.)

### 4.6 `tests/run-310-view.mjs`, registration, probes

`node tests/run-310-view.mjs --out <empty dir outside the repository and outside the temp directory> [--include-untracked] [--overlay <rel,rel>] [--label <name>] [--run release-3.1,c18,bs-doc-map,accept-rc1]`:
- builds the view (`buildView`, `to310Repo`, optional `overlay`), verifies the manifest (overlaid files are skipped: the real-tree gate already proves their 3.2.0 bytes, so the fixture holds no 3.2.0 hashes; R2-7);
- runs each named gate from the view serially and prints each gate's own totals line and exit code;
- writes nothing outside `--out` and never deletes it.

Not registered: `tests/run-tests.mjs` and `tests/accept-rc1.mjs` are byte-pinned and stay untouched; `accept-rc1.mjs` runs exactly one child, `run-tests.mjs` (`tests/accept-rc1.mjs:7,22,190`). The new specs are standalone, as in 3.1.0 (`tests/release-3.1.test.mjs:2-4`).

The tests/ file-set pin of 3.1.0 ("baseline plus exactly six", draft cite `tests/release-3.1.test.mjs:1395-1398`, UNVERIFIED at those exact lines) is not edited. It holds in the view because `to310Repo` removes exactly the new test files and reverses the three living ones. In the real tree the set is pinned by section E of the new gate.

What stays byte-pinned and by whom:

| Bytes | Pinned by |
|---|---|
| 3.0.0 baseline, AM31 identity, six-new-files set | `tests/release-3.1.test.mjs`, unchanged, run in the view |
| rc.4 view | `tests/c18.test.mjs` and `tests/helpers/c18-amendments.mjs`, unchanged, run in the view |
| c13 to c17 pin tables, v2.0.0 snapshots | unchanged, run in the view through `accept-rc1` |
| 3.1.0 bytes of every file, AM320 identity, 3.2.0 bytes, new-file set | `tests/release-3.2.0.test.mjs`, run in the real tree |

Consequence accepted (Q1): in the 3.2.0 working tree, `node tests/release-3.1.test.mjs`, `node tests/c18.test.mjs` and `node tests/accept-rc1.mjs` run directly are expected to fail. README, notes and CHANGELOG name the view runner. CI runs only `format:check` and `check-versions` (`@root/.github/workflows/ci.yml:41-47`), on Node 22 (`:36`), and no project-setup test. The gates are therefore enforced only by the orchestrator, and the PR body says so.

**Compat runs (Q2 a, D-12).** The pinned lists live in `tests/fixtures/v320-compat-expected.json`: `{ "schema": 1, "runs": { "scripts": [<label>...], "scripts+data": [<label>...] } }`.
- Run 1, label `scripts`: `--overlay scripts/detect.mjs,scripts/migrate-security-paths.mjs --run accept-rc1`. Data stays 3.1.0, so the prior-baseline derivation is skipped (AC-A4-6) and `installerBackups` is the only new output.
- Run 2, label `scripts+data`: the same plus `data/secret-paths.json`.
- `accept-rc1` passes only on 100/0/0 or 99/0/1 (`tests/accept-rc1.mjs:24,145`), so an overlay run always exits 1.
  - The runner does not use that exit code or the FAIL ids.
  - It reads the retained results file named by the `RESULTS` line (`tests/accept-rc1.mjs:218`), takes the full set of `results[].failures` strings (`:92-99`), and compares that set by exact label with the pinned list of the run.
  - Any unlisted failure string is a backward-compatibility defect. Any listed string that did not occur is also reported (a stale list).
- Prerequisite of both runs (R2-6): `tests/run-tests.mjs:616` runs detect with the real environment, so a real `.project-setup.bak-*` in a skills directory would add a warning once the 3.2.0 detect is overlaid. Before each compat run the orchestrator checks that the 3.2.0 detect shows an empty `installerBackups`, and both compat runs happen before D7.
- Rule for run 1: every listed label must be a digest pin that names an overlaid file. A failing behaviour assertion is a defect and is never added to the list, with one stop-and-report exception: a failure caused only by the additive `installerBackups` output (for example an exact-key assertion on detect output) is reported to the orchestrator, who decides by a recorded decision (like run 2).
- Rule for run 2: every listed label must be either such a digest pin or an assertion about the content of the shipped `data/secret-paths.json` itself (for example the 20-entry construction check at `tests/c3.test.mjs:1242-1245`). A failure whose label does not name the shipped policy file or an overlaid script is a defect. If the tests lane finds such a failure, it stops and reports; the orchestrator decides (section 9, Dissent 2).
- The exact form of the failure strings is UNVERIFIED (`tests/run-tests.mjs` was read only at the six cited lines); the tests lane confirms they carry the assertion label before relying on label matching.

**Probes (protocol: a plan rule depends on runtime behaviour).**
- P-1, done by the orchestrator before this revision: from a plain copy of the 3.1.0 working tree at `D:\ps-live\probe310` (no `.git`, outside the repository and outside the temp directory), one process each, serially: `release-3.1.test.mjs` 351 PASS / 0 FAIL / 0 SKIP; `c18.test.mjs` 59/0/0; `bs-doc-map.test.mjs` 2198/0/4. Node v24.14.1. Conclusion: the historical gates do not need the repository's Git state.
- P-2, run by the orchestrator on 2026-11-23 before freezing: the same three gates from `D:\ps-live\probe-p2`, built with `git archive d0cd48e` over the explicit copy set of 4.3 (156 files, no `.git`), serially, Node v24.14.1: `release-3.1.test.mjs` 351 PASS / 0 FAIL / 0 SKIP; `c18.test.mjs` 59/0/0; `bs-doc-map.test.mjs`: 2198 PASS / 0 FAIL / 4 SKIP. A run from a directory under the temp directory is repeated by the tests lane (R2-3). Expected: the same totals. If a gate fails for a missing path, add that path to `VIEW_COPY_SET` and record it in the plan before freezing. `accept-rc1` in the view is proven by the first full view run (5.4); a missing path found there is handled the same way and reported.
- Runtime coverage: Node v24.14.1 is probed. CI uses Node 22 but runs none of these gates, so other Node versions are not covered.

### 4.7 How the second tests-lane pass produces records and pins (D-6)

1. First tests-lane session (before implementation, from the frozen plan only): writes the engine of `v320-amendments.mjs` with `AM320` empty and order maps empty; `run-310-view.mjs`; both new specs; the fixture copy of the 3.1.0 policy (bytes taken from the base commit); the living-test and live-helper edits. Pins are stubs marked `PIN_PENDING`; a spec with a pending pin prints a FAIL line naming it and never passes silently.
2. Implementation (implement and sensitive lanes) lands the shipped files.
3. Second, fresh tests-lane session (after review of the implementation):
   - A scratch script outside the repository reads the git blobs of the base commit (`git rev-parse`, `git ls-tree`, `git show`: plumbing on the skill's own repository, not history of a protected project) and the working-tree bytes.
   - It emits the `AM320` literals from a line diff, the order maps, `v320-prechange.json`, and the pin tables of `release-3.2.0.test.mjs`.
   - It checks: forward application of every record to the base bytes gives the actual file, and the reverse chain gives the base back.
   - It does NOT run the strict gate (R2-1). The orchestrator runs both compat runs alone and serially, and hands the two retained results files (paths) to session 2. Session 2 reads them, classifies every label against the rules of 4.6 and writes `v320-compat-expected.json`.
4. This second pass is a planned, documented exception to "tests before implementation", because pins need final bytes (decision D-6, maintainer absent; listed in the PR body). The second session edits only: `tests/helpers/v320-amendments.mjs` (literals), `tests/fixtures/v320-prechange.json`, `tests/fixtures/v320-compat-expected.json`, and the pin tables of the two new specs. It changes no assertion logic; a logic change needs a new brief.

## 5. Test plan

### 5.1 Which spec proves what

| Spec | Runs in | Proves |
|---|---|---|
| `tests/release-3.2.0.test.mjs` | real tree | sections A to G of 4.5; AC-A4-2, AC-B1-1, AC-B1-6, AC-B2-1, AC-A6-1, AC-C3-1 |
| `tests/v320.test.mjs` | real tree | AC-A1-1, AC-A2-1 to 4, AC-A4-1 and 3 to 11, AC-A5-1 to 7, AC-B1-2 to 5 and 7, AC-B2-3 and 4 |
| `tests/bs-doc-map.test.mjs` (living) | real tree | AC-A1-2 to 7, AC-A3-1 to 3, AC-B2-2, AC-C1-1 and 3, AC-C2-1 and 2 |
| `run-310-view.mjs --run release-3.1,c18,bs-doc-map` | view | 3.2.0 reverses exactly to 3.1.0 as judged by the unedited 3.1.0 gates (expected totals: P-1) |
| `run-310-view.mjs --run accept-rc1` | view | the complete strict gate on the reconstructed 3.1.0 tree |
| compat runs 1 and 2 (4.6) | view + overlay | the two changed scripts, then scripts plus data, keep every historical behaviour except the pinned labels |

Tests-lane obligations:
- For every rule "X is rejected when Y": cover Y absent, Y present but inconsistent, and the boundary (AC-A1-2/3/5, AC-A3-2, AC-A4-5/6, AC-A5-3).
- Fallback writes are tested against the real validator (`readSecurityPolicy`, real `apply.mjs`), never a mock.
- Every promise in a JSDoc or comment of the changed code (the `readInput` JSDoc, the `PRIOR_SHIPPED` comment, the `scanInstallerLeftovers` doc) gets a test.
- Enumeration for A4: all baseline values (`recorded`, `v2.0.0`, `shipped`, `v3.0.0`, `fresh`, `unknown`) are exercised, not only the new one.
- Superseded cases listed in the report: the `P01` and `INTRO` pins of `tests/bs-doc-map.test.mjs`.
- Lint: this repository has no lint for project-setup (Prettier ignores it, `@root/.prettierignore:4`); the tests lane states that instead of a lint result.
- Close with "K of N mutants caught" against a scratch reference implementation outside the repository.

### 5.2 Mutation controls (minimum set)

1. Gate: a record with one changed character; a record applied twice; an extra unrecorded line in an amended file; an unrecorded edit in an unamended file; a stray extra file; a missing new file; a normative record whose `old` holds MUST; a TODO replacement not in the pinned exception list.
2. View: `to310Repo` on a copy with an altered amendment throws; an unrecorded edit survives and shows as changed; a stray `RELEASE-NOTES-3.2.1.md` stays visible; an ignored file in the working tree does not enter the view.
3. A1: fifth wording accepted; partial line accepted without `--expect-partial`; mismatched layer accepted; agents-block sentence missing in a partial layer accepted; `merge` without the canonical reference counted as canonical.
4. A3: checker accepts a pointer Phase 0 marked not applicable; accepts an inventory with a missing variable; accepts a value-shaped cell; accepts a missing strictness statement; treats a declined proposal with a completion claim as clean.
5. A4: prior baseline matched before desired; prior matched before v2.0.0; derivation used when desired lacks one added identity; a third identity added to `PRIOR_SHIPPED.added`; `omit` not recorded; an old entry dropped; anchor changed to `any`.
6. A5: backup added to `installConflicts`; meta file reported; link followed; nested backup reported; warning emitted with no leftovers.
7. B1: the five mutants of AC-B1-7.
8. B2: the bullet placed outside the managed block; the sentence "the refusal above applies unchanged" removed; "MUST state in your output" removed; the AGENTS.md sentence limited to "after changing directory".
9. A2: a real marker line inside the new paragraph (D-14).
10. C2: intro edited without the pin; pin edited without the doc; the old paragraph put back.
11. Compat: an unlisted failure string accepted; a listed label that names no overlaid file accepted in run 1.

### 5.3 What stays a live measurement

Agent behaviour for A1 (which line setup writes), A2 (whether a retained agent obeys root AGENTS.md), A3/A7/A8 (adopt and update produce the same set), A4 on a host (the deny is effective; root-anchor semantics), A5 (the host skill list), B1 (severity on Codex), B2 (no false refusal; what a subagent sees). See section 8.

### 5.4 Gates the orchestrator runs (serially, alone, never in parallel with a lane)

```text
node project-setup/tests/release-3.2.0.test.mjs
node project-setup/tests/v320.test.mjs
node project-setup/tests/bs-doc-map.test.mjs
node project-setup/tests/run-310-view.mjs --out <dir1> --run release-3.1,c18,bs-doc-map
node project-setup/tests/run-310-view.mjs --out <dir2> --run accept-rc1
node project-setup/tests/run-310-view.mjs --out <dir3> --label scripts --overlay scripts/detect.mjs,scripts/migrate-security-paths.mjs --run accept-rc1
node project-setup/tests/run-310-view.mjs --out <dir4> --label scripts+data --overlay scripts/detect.mjs,scripts/migrate-security-paths.mjs,data/secret-paths.json --run accept-rc1
npm run check
```

Before a commit exists, the orchestrator adds `--include-untracked`. A red run on a loaded machine is re-run alone before it counts.

## 6. Commit structure and lane ownership

### 6.1 Lane ownership (D-6)

| Files | Written by | Never touched by |
|---|---|---|
| `tests/release-3.2.0.test.mjs`, `tests/v320.test.mjs`, `tests/run-310-view.mjs`, engine of `tests/helpers/v320-amendments.mjs`, `tests/fixtures/v320-policy-3.1.0.json`, `tests/bs-doc-map.test.mjs`, `tests/live/bs-doc-map.mjs` | tests lane, session 1 | implement, sensitive |
| `AM320` literals and order maps, `tests/fixtures/v320-prechange.json`, `tests/fixtures/v320-compat-expected.json`, pin tables of the two new specs | tests lane, session 2 (fresh) | implement, sensitive |
| `references/docs-generation.md`, `references/modes.md`, `references/claude.md`, `SKILL.md`, `scripts/detect.mjs`, `tests/live/BS-DOC-MAP-ACCEPTANCE.md` (a procedure document, not a test), `VERSION`, `README.md`, `CHANGELOG.md`, `RELEASE-NOTES-3.2.0.md`, `@root/README.md`, `@root/TODO.md`, `@root/.ai/context/project-tree.md` | implement lane | tests |
| `assets/agents/reviewer.md`, `assets/templates/CLAUDE.md`, `assets/templates/AGENTS.md`, `data/secret-paths.json`, `scripts/migrate-security-paths.mjs`, `references/migration-v2.md`, `references/security.md` | sensitive lane | tests, implement |
| Reviews | review lane for commits 2, 3, 4, 7, 8, 9, 10 (commits 2 and 10: the compat expected list and the pins get an independent look; R2-14); review-sensitive for commits 5 and 6 (effort xhigh, large task) | none |
| Gates (5.4), diffs for reviewers, git | orchestrator | workers |

Implement and sensitive lanes never edit tests; a needed test change is a deviation: stop and report. Workers run only the specs they touch; no worker runs the view runner with `accept-rc1`.

### 6.2 Commits

Feature branch only; the orchestrator commits; PR only; never push to main, merge or force-push. The release gate pins final bytes, so intermediate commits are not individually green; the gates of 5.4 are required at the PR head. Commits exist for review.

| # | Label | Content | Lane |
|---|---|---|---|
| 1 | `docs(plans): freeze the 3.2.0 plan` | this file | orchestrator |
| 2 | `test(project-setup): 3.2.0 specs, amendment engine, living tests (red)` | session 1 files of 6.1 | tests |
| 3 | `docs(project-setup): applicability rule, configuration and strictness proposals (A3, A7, A8)` | `[DG320_2]`, `[DG320_3]`, `[DG320_7]`, `[SK320_2]` | implement |
| 4 | `docs(project-setup): partial-layer variants and retained-agent rule (A1, A2 references)` | `[DG320_1]`, `[DG320_4]`, `[DG320_5]`, `[DG320_6]`, `[MD320_2]`, `[MD320_3]` | implement |
| 5 | `SENSITIVE: for line-by-line review. feat(project-setup): reviewer money severity, delegated launch rule, agents block (B1, B2, A2)` | `assets/agents/reviewer.md`, `assets/templates/CLAUDE.md`, `assets/templates/AGENTS.md` (`[AT320_1]`, `[AT320_2]`) | sensitive |
| 6 | `SENSITIVE: for line-by-line review. feat(project-setup): env/** and cert/** in the shipped secret-path policy (A4)` | `data/secret-paths.json`, `scripts/migrate-security-paths.mjs`, `references/migration-v2.md`, `references/security.md`. Nothing else | sensitive |
| 7 | `feat(project-setup): detect reports installer backups (A5)` | `scripts/detect.mjs`, `[SK320_3]`, `[CM320_1]` | implement |
| 8 | `docs(project-setup): acceptance procedure and introduction (C1, C2, A1 row, A3 evidence fields)` | `tests/live/BS-DOC-MAP-ACCEPTANCE.md` | implement |
| 9 | `docs: TODO, modes observation, version 3.2.0, notes, changelog (C3, A6)` | `[MD320_1]`, root and skill bookkeeping, `RELEASE-NOTES-3.2.0.md` | implement |
| 10 | `test(project-setup): final amendment records and pins (green)` | session 2 files of 6.1 | tests |

Commits 5 and 6: the maintainer is absent, so "stop before git for a line-by-line review" cannot happen. They are kept separate, labelled as above, and the PR body lists them (with the D-2 amendment of the frozen C3 baseline set and the D-6 exception) for the maintainer's line-by-line review before merge. The orchestrator does not merge.

## 7. Sensitive-lane items

| Item | Why sensitive | Lanes | Review checklist |
|---|---|---|---|
| A4 (commit 6) | changes the secret-path policy every project receives and the code that decides policy ownership | sensitive + review-sensitive | strengthening only; no installed entry can be dropped; `unknown` is no longer reached for an unedited 3.0.0/3.1.0 install; desired wins a tie; the derivation is skipped unless both identities are present; the hash constant equals the normalized hash of the 3.1.0 file; no caller changed; root anchor intended; immediate protection and the Phase 0 stop are stated in the notes |
| B2 (commit 5) | narrows when a subagent refuses under the launch rule that guards the raw-Git hook and deny rules | sensitive + review-sensitive | parent rule unchanged; a stated below-root start still refuses; the "not given" statement is required; no existing line altered; no host behaviour asserted |
| B1 (commit 5) | canonical reviewer text; raises severity; adds a non-relaxable paragraph | sensitive + review-sensitive | insertion only; lines 311-313 untouched; override list complete (`:93-95`, `:103-104`, `:306`, `:370`); no weakening of sections 1 or 4 |
| A2 template text (commit 5) | installed instruction text in the same template | sensitive + review-sensitive | marker text cannot parse as a marker; block count unchanged |
| A5 detect change (commit 7) | read-only inventory of user-level directories; reads names and the existence of `SKILL.md` only | implement + review | no file content read; links skipped; `installs` unchanged |

Constraints for every lane: never read `.env*` files, secrets, or the run vault; this repository has no `.ai/security-paths.json` (glob at the repository root found none). Write source and docs only with Edit/Write or a Node script, keeping encoding and EOLs. Scratch copies list only what is needed and never the whole worktree. The review briefs add a contract pass and an adversarial pass unless the repository's reviewer definition already has both (the orchestrator checks `.ai/agents/reviewer.md`; this repository has none at that path, UNVERIFIED beyond the glob for `security-paths.json`).

## 8. Live measurements (D), run by the orchestrator after the PR head is green

Common prerequisites:
- The 3.2.0 candidate is the only active copy on each host: installer backups moved out per C1, and `detect.mjs` shows an empty `installerBackups`.
- New sessions start at the fixture root, never `--continue`.
- Fixtures: `D:/ps-live/bs-docmap-3.1.0-*` and clones of their untouched baseline commits; Codex fixtures under `D:/ContactRepos/codex-fixtures`, which carries the `CodexSandboxUsers` read-and-execute entry (results file `:60`).
- Exact `safe.directory` grants where obtainable.
- Helper: `project-setup/tests/live/bs-doc-map.mjs`.
- Recorded per row: versions of Claude Code, codex-cli and Node.
- Codex runs go through the codex-delegate relay, isolated.
- Contaminated runs are kept and not counted.

| # | Measurement | Extra prerequisites | Criterion it can establish |
|---|---|---|---|
| D1 | Codex reviewer on the seeded unreachable lost update (`seed --case reviewer`), 2 samples, with the 3.2.0 reviewer installed in the project | Lock order unit of the acceptance doc `:398-404` in the fixture's 03; user-level `code-review` skill removed or its presence recorded | Both samples rate the defect HIGH or CRITICAL, with a scenario and a block verdict. Closes the severity residual (`@root/TODO.md:25-32`). Not directly comparable with 2026-11-14/22: the earlier wording was not recorded |
| D2 | L16: Claude reviewer launched after the parent changes into a subdirectory (TUI P3 h and the headless variant), plus the subagent-environment probe | Project updated to the 3.2.0 `claude` and `agents` blocks; isolated config without a global CLAUDE.md. Probe: a subagent that only reports the working directory in its environment context and the CLAUDE.md paths it loaded; one process per case (root start; root start then `cd sub`; start in `sub`) | No refusal by parent or reviewer after `cd sub`; the reviewer completes and states whether the start directory was given. Negative control: a session really started in `sub` is refused by the parent. The probe records what directory the subagent sees, per Claude Code version. Closes the L16 residual |
| D3 | Declined docs-sync replacement, then completion | bs-existing-derived fixture | After the declined adopt: `verify --expect-partial` has 0 findings; CLAUDE.md holds the docs-sync-retained line and AGENTS.md the matching sentence. After a later run that takes the canonical docs-sync: `verify` (no flag) has 0 findings, the full line, no sentence |
| D4 | Retained BS docs-sync with the 3.2.0 `agents` block rule, `seed --case docs-sync` | D3 fixture before completion | The `overview` block is unchanged, or the agent's output names the file and block id. Then a PS update shows the edit and offers keep, take new, merge |
| D5 | Adopt versus update parity on one fixture source | Two fixtures from the same source: PS 3.0.0 then BS then 3.2.0 update; BS then 3.2.0 adopt | Same provisional list in Phase 0, same confirmed set and same applied tree; `checkApplicability`, `checkConfigurationInventory` and `checkStrictness` have 0 findings on both |
| D6 | Policy offer and effect for `env/**` and `cert/**`, including root-anchor behaviour on both hosts | One project fresh-installed by 3.1.0, one migrated (`keys`); one with a tracked `env/x` for the stop | Update shows exactly two coverage rows. After `include`: in a new root-started Claude session a Read of a canary name under root `env/` is refused, also after `cd` into a subdirectory; `src/env/x` and `sub/env/x` stay readable (root anchor). On Codex the installed snippet lists both and the same three paths behave the same way. The tracked-file project stops in Phase 0. Until recorded, the notes claim rendering only |
| D7 | Detect with a real installer backup present | A real backup in each skills directory (created by installing 3.1.0 then the candidate) | `detect.mjs` warns for each tool; after moving out, no warning and the host lists one `project-setup`; after moving back, `install.mjs rollback` succeeds |
| D8 | Skill-discovery shapes for backup directories | Scratch directories in each skills directory: `SKILL.md` at top, no `SKILL.md`, `SKILL.md` nested one level, dot-prefixed and not | Which shapes each host lists. Decides the relocation layout for the next minor; closes nothing in 3.2.0 |
| D9 | 3.1.0 rows never measured (`RELEASE-NOTES-3.1.0.md:108-116`) | As in the 3.1.0 procedure | Each row only widens the claim; each is recorded as measured or "not measured" with the reason |
| D10 | Strict-gate duration (`accept-rc1` in the view) and the recording rules | Idle host | A data point for the timeout item (`@root/TODO.md:72-80`; limit 1,800,000 ms at `tests/accept-rc1.mjs:191`) |

D9 rows:
- (a) Codex P4 context check.
- (b) Read-only missing-destination case, Claude Code and Codex.
- (c) Documentation-writing missing-destination case, Claude Code and Codex.
- (d) Codex PS rows: blank section, renamed heading, deleted pointer, local-instruction conflict, unchanged rerun.
- (e) A second Codex reviewer sample (covered by D1 sample 2 when both are counted).
- (f) The overwrite branch of the PS-first recovery.
- (g) Interactive default-mode PS rows, only if they can be driven headless with `--permission-mode default`; otherwise the result is recorded as "not measurable by me".

Recording rules (D10):
- Results go to a new file `docs/plans/2026-11-22-project-setup-v3.2.0-live-results.md` (or the date of the last run): ASCII, LF, hand-formatted. `docs/plans/` is Prettier-ignored (`@root/.prettierignore:8`), like `docs/plans/2026-11-22-project-setup-v3.1-live-acceptance-results.md`.
- Every row carries: date, host and versions, launch directory, selected skill copy, invoked definition (observed or inferred), range, result, unverified scope.
- Never write an unobserved result: a row that was not run says "not run" with the reason; an inferred item says "inferred".
- No secret, no canary content, no personal path beyond the fixture roots already recorded.

Stage 2 (after D1 and D2): a separate sign-off change records the dated results, restates the notes sentences as measured, and deletes the residual item from `@root/TODO.md` through one closeout record. It is not part of the implement lanes of this plan.

## 9. Decisions (formerly open questions)

The maintainer was absent. "Advisor" is advisor 1 (2026-11-22); "orchestrator" is the dispositions file of the same date. All are listed in the PR body for the maintainer.

| # | Question | Decision | Decided by | Dissent |
|---|---|---|---|---|
| Q1 | Historical gates in a reconstructed 3.1.0 view | (a) view, built from tracked files over an explicit copy set | advisor; orchestrator D-12 | see Reconciliation 1 |
| Q2 | Compat run with a pinned expected-failure list | (a), matched by label from the retained results file; two labelled runs | advisor; orchestrator D-12 | Dissent 2 |
| Q3 | Installer backup location | (a) defer relocation, with the four conditions of D-11 | advisor X2; orchestrator D-11 | critique wanted D8 before the decision; D8 stays in the measurement phase |
| Q4 | A `validate.mjs` check for the Subagents line | (a) none | advisor; D-13 | none |
| Q5 | Destination of compiler strictness | (a) 03 "CI/CD and tooling", as a proposal through consolidation | advisor; D-13, D-10 | none |
| Q6 | Same pattern in `projectPatterns` and managed | (a) allow both; proven by AC-A4-11 | advisor; D-13 | none |
| Q7 | Verdict for an uncalled critical money violation | (a) block | advisor; D-8 | none |
| Q8 | May a project rule relax the new paragraph | no; the protection is inside the paragraph, lines 311-313 untouched | orchestrator D-8 (modifies advisor Q8 b, adopts the critique's form) | none |
| Q9 | Lock order text for the fixture | (a) the text ships in the acceptance doc; the doc states that the earlier wording was not recorded | advisor; D-13 | Dissent 3 |
| Q10 | Tolerance | No rule in this plan rejects "future" or "stale" data, so no tolerance is defaulted. The one time-like rule (a pointer whose evidence disappears is preserved and reported) has no age threshold | advisor; D-13 | none |
| Q11 | Version number | 3.2.0 | advisor X1; D-1 | critique accepted 3.1.1 with stronger notes; overruled |
| D-2 | A4 mechanism | derive the prior baseline inside `migrate-security-paths.mjs`; no snapshot, no seventh field, no caller change; amends the closed baseline set of the frozen C3 plan | orchestrator (replaces advisor X5-1's two-caller fix and the draft's snapshot) | Dissent 1 |
| D-3 | Tracked root `env/` or `cert/` files | intended strengthening; `omit` does not clear it; numbered upgrade note | orchestrator | none |
| D-4 | Keyword rule and TODO | normative files only; TODO exempt by pinned exception; insertion now, closeout later | orchestrator | none |
| D-5 | Phase 0 applicability | provisional, Phase 0 reads only; Phase 1 confirms. "This rule adds no Phase 0 read" is checkable because Phase 0 already reads the 03 sections for the mapping assessment (`references/docs-generation.md:183`, `SKILL.md:231-235`; R2-13) | orchestrator | none |
| D-6 | Lane ownership and the second tests pass | as section 6.1 and 4.7 | orchestrator | none |
| D-7 | B2 wording | conditional, with the "not given" statement; parent states directories in every delegation; probe in D2 | orchestrator; advisor X3 | Dissent 4 |
| D-9 | AGENTS.md agents-block claim | closed set of three sentences | orchestrator | none |
| D-10 | `:416` pinned sentence | keep it; add the 3.2.0 note beside it | orchestrator (plan lane chose "keep") | none |

**Reconciliation 1 (view file list).** D-12 names `git ls-files -co --exclude-standard`; advisor Q1 and the revision brief say tracked files only. The plan uses tracked files as the default and the gate at the PR head (4.3, 4.5 G), and offers `--include-untracked` (the D-12 command) only for orchestrator runs before a commit exists. An untracked non-ignored stray file would otherwise enter the view and then fail the "no extra" comparison, which is the intended signal before commit and noise after it.

**Dissent 1 (D-2, kept as decided).** Evidence and limits:
- (a) The prior list is trusted from a hash constant and a subtraction; nothing at run time proves that the derived list hashes to `PRIOR_SHIPPED.sha256`, because only entries are subtracted, not bytes (`scripts/migrate-security-paths.mjs:82-94` compares record hashes, never list contents). The guard is test-only (AC-A4-3).
- (b) The mechanism handles exactly one prior baseline; a second policy change needs a list of priors and a new decision.
- (c) Closed by critique 2 (R2-9): the manifest records `normalizedHash` (`scripts/apply.mjs:626`, `scripts/lib.mjs:209-214`); the constant is that normalized hash by definition and equals the raw digest `37711ab7...` exactly when the file is LF, BOM-free and ends in LF. AC-A4-1 asserts the normalized hash.

None of these is a reason to override; the alternative (four callers changed) is larger and touches `apply.mjs`.

**Dissent 2 (compat run 2).** Advisor Q2 requires every expected failure to be a digest pin naming an overlaid file. With `data/secret-paths.json` overlaid (D-12's second run), `tests/c3.test.mjs:1242-1245` fails on a content assertion (20 entries), not a digest pin, and fixtures built from the real file (`tests/run-tests.mjs:116,311,471,1048,1094,1264`) may shift other expectations (count UNVERIFIED). The plan keeps both decisions by giving run 2 a wider, still closed rule (4.6) and a stop-and-report when a failure does not name the shipped policy file. If run 2 produces many such failures, its value is low and the orchestrator may drop it by a recorded decision; run 1 stays mandatory.

**Dissent 3 (Q9).** The decision assumed the acceptance doc ships no Lock order text. It does: `tests/live/BS-DOC-MAP-ACCEPTANCE.md:387-405`, with the helper marker at `tests/live/bs-doc-map.mjs:1277`. Adding the draft's different wording would create two competing texts in one procedure. The plan therefore keeps the decision's intent (the text ships; the non-comparability statement is added) and does not add a second text (C1 item 4). If the orchestrator wants the draft's wording instead, it is a replacement of `:400-403` and needs a decision.

**Dissent 4 (D-7 wording).** "MAY show" uses an RFC 2119 keyword for a possibility, not a permission; this repository treats keywords as load-bearing (`@root/.ai/context/code-patterns.md`, section 2). "can show" would be more exact. The decided wording is kept; the gate's keyword rule is unaffected because the line is new text.

## 10. Risks

1. **Probe P-2 fails** (a historical gate needs a path outside the explicit copy set). Mitigation: run before freezing; add the path to `VIEW_COPY_SET`; P-1 already passed from a whole-tree copy.
2. **Hunk records for scripts are brittle** (a `before + old + after` key occurring twice). Mitigation: whole-file record fallback (4.3).
3. **`PRIOR_SHIPPED` drift or hash mismatch** (Dissent 1). Mitigation: AC-A4-1 and AC-A4-3; sensitive review checklist.
4. **A4 stops existing projects in Phase 0** (tracked root `env/` or `cert/` files). Mitigation: numbered upgrade note with the way out; AC-A4-9; D6.
5. **Root-anchored rendering is not effective on a host** (first shipped root-anchored defaults; `docs/design/project-setup-v3.md:252`). Mitigation: claim scoped to rendering until D6; AC-A4-8 pins the strings.
6. **B2 weakens a second line of defence.** Mitigation: sensitive lanes; the "not given" statement; D2 negative control.
7. **B1 over-reporting** of intentional stubs in money code. Mitigation: classification "likely risk" and the Confidence line; the rule is limited to critical rules and MUST-level rules of money flows.
8. **Template growth.** `assets/templates/AGENTS.md` goes from 80 to about 92 lines and `assets/templates/CLAUDE.md` from 37 to 46; limits are 150 and 200 lines (`scripts/validate.mjs:352,365`). A project already near 150 lines gets an `agents-size` warning; the notes say so.
9. **Direct in-tree runs of old gates fail and confuse contributors**, and CI enforces none of the gates. Mitigation: README, CHANGELOG and notes name the view runner; the PR body states who ran what; the new release gate runs two old gates in the view itself.
10. **Duration.** Three strict-gate runs (view, compat 1, compat 2) add roughly 60 to 75 minutes of serial time; recorded runs took 1189 to 1540 s each against the 1800 s limit (`@root/TODO.md:72-80`). Mitigation: run alone; a red run on a loaded machine is re-run alone before it counts.
11. **Windows path length in the view.** Mitigation: `--out` is a short path outside the repository and outside the temp directory (the Codex sandbox also denies a cwd under the temp directory).
12. **The living spec is large** (`tests/bs-doc-map.test.mjs`, pins around `:4074-4311`), read here only at the cited lines; the content of `:4227` is unknown. Mitigation: the tests lane lists every superseded case and every pin it touched.
13. **Compat failure strings may not carry labels** (4.6, UNVERIFIED). Mitigation: the tests lane checks first; if they do not, it stops and reports before pinning anything.
14. **Unverified facts carried by this plan:**
    - pin locations in c13 to c17 and `c17-upgrade-baselines.json`;
    - the exact lines of the 3.1.0 tests/ set pin;
    - `references/report.md`;
    - line numbers inside `references/claude.md`;
    - the anchors in `README.md`, `@root/README.md` and `@root/.ai/context/project-tree.md`;
    - the wrapper contents;
    - the `evidence.agents` shape;
    - the Codex snippet layout;
    - the frozen C3 plan text;
    - `normalizedHash`;
    - the BS "5.3" numbering.

    Each is marked where it is used and assigned to a lane to confirm.

## 11. Advisor and critique dispositions

| Item | Disposition | Where | Reason |
|---|---|---|---|
| F1 migration-input callers out of scope | MODIFIED | 2 A4 items 2 and 6, AC-A4-7; 9 D-2 | D-2: derive inside `migrate-security-paths.mjs`, so no caller changes; the "same baseline everywhere" AC is adopted |
| F2 patterns take effect in setup immediately | ACCEPTED | 0 item 6; 2 A4 "Protection is immediate", AC-A4-9; C3 notes | D-3: intended strengthening, stated with the way out |
| F3 overlay not inert; tie order | ACCEPTED | 2 A4 item 2, AC-A4-6; 4.6 | desired wins a tie; derivation skipped on 3.1.0 data |
| F4 gate rejects its own TODO record | ACCEPTED | 2 C3; 4.5 C | D-4: keyword rule scoped to normative files; TODO insertion now, closeout later |
| F5 Phase 0 applicability vs permitted reads | ACCEPTED | 2 A3 rule text, `[SK320_2]` | D-5: provisional in Phase 0, confirmed in Phase 1, no new read |
| F6 lane ownership | ACCEPTED | 4.7; 6.1; 6.2 | D-6: named lanes per file; second tests pass; acceptance-doc edits in commit 8 |
| F7 B2 states unverified host behaviour | ACCEPTED | 2 B2; 8 D2 | D-7: conditional wording; probe moved into D2 |
| F8 expected-failure comparison level | ACCEPTED | 4.6 | full failure-string set from the retained results file, by label |
| F9 "payload set unchanged" | MODIFIED | 4.2; 4.5 F; C3 notes contract | with D-2 no file is added to the install; notes in the zip only; no 64-hex in notes |
| F10 missing row for the interim advice | ACCEPTED | 2 A4 state and combination tables, AC-A4-5 | rows and valid combinations specified |
| F11 `unknown` case count | ACCEPTED | 2 A4 Current and state table, AC-A4-4 | 20 managed-edit plus 22 coverage |
| F12 consumers of the changed contract | MODIFIED | 2 A4 items 2 and 3, frozen-plan note | no input field now; header, JSDoc and migration-v2 updated; C3 amendment recorded |
| F13 detect on a missing snapshot | MODIFIED | 2 A4 "Detect on a failed derivation" | no snapshot exists; existing `policy-schema` row kept |
| F14 root-anchor rendering and probe | ACCEPTED | 2 A4 Rendering, AC-A4-8; 8 D6 | exact strings asserted; host effect gated on D6, claim scoped |
| F15 AGENTS.md agents block makes the same claim | ACCEPTED | 2 A1 item 2, AC-A1-5 | D-9: closed set of three sentences |
| F16 A1 coherence additions | ACCEPTED | 2 A1 items 3 and 4, AC-A1-6/7 | modes.md pointer; `agentLayerOf` mapping |
| F17 A3 wording | ACCEPTED | 2 A3 rule text | "every mode"; proposals through consolidation with a declined path |
| F18 statements left standing | ACCEPTED | 2 A2 item 4; 2 A3 (`:416`, `:357`) | clarifying insertions; `:416` kept with a note; `referenceRequired` cited |
| F19 "MUST-level rule" may not match | ACCEPTED | 2 B1 `[RV320_1]` | D-8 wording and full override list |
| F20 pins missed in the living spec | ACCEPTED | 2 C1 pins list; 2 C2 | all listed; matrix untouched; `:4227` flagged UNVERIFIED |
| F21 "covered only by CI" false | ACCEPTED | 4.6 | CI runs no project-setup test; stated as not covered |
| F22 view copy set | ACCEPTED | 4.3; 4.6 P-2 | explicit copy set, tracked files, probe before freeze |
| F23 Q3 rests on D8 | MODIFIED | 2 A5; 8 D8; 9 Q3 | D-11: deferral recorded as an explicit decision with conditions; D8 stays in measurements |
| F24 marker text safe; add mutant | ACCEPTED | 2 A2 AC-A2-4; 5.2 item 9 | D-14 |
| F25 first pin of 3.1.0 test bytes | ACCEPTED | 4.5 pins | generated from git blobs of the resolved base commit |
| Critique Q2 | ACCEPTED | 4.6 | with F3 and F8 |
| Critique Q3 | MODIFIED | 9 Q3 | decided now (defer) with conditions |
| Critique Q6 | ACCEPTED | AC-A4-11 | decide (a) now |
| Critique Q8 | ACCEPTED | 2 B1 | protection inside the paragraph |
| Critique Q11 | REJECTED | 1.2 | D-1: 3.2.0; the critique's notes requirements are kept |
| Advisor Q1 | ACCEPTED | 4.3; 9 Reconciliation 1 | tracked files; D-12 command kept as an option |
| Advisor Q2 | MODIFIED | 4.6; 9 Dissent 2 | run 1 as stated; run 2 (D-12) needs a wider closed rule |
| Advisor Q3 | ACCEPTED | 2 A5 | defer with conditions |
| Advisor Q4 | ACCEPTED | 2 A1 item 5 | no validate check |
| Advisor Q5 | ACCEPTED | 2 A3 | "CI/CD and tooling" (`backend-standards/templates/docs/03-project-architecture.md:242`) |
| Advisor Q6 | ACCEPTED | AC-A4-11 | proven against the real validator |
| Advisor Q7 | ACCEPTED | 2 B1 `[RV320_2]`, AC-B1-7 | block; mutant on removal; D1 expects a block verdict |
| Advisor Q8 | MODIFIED | 2 B1 | D-8: inside the new paragraph instead of a sentence after line 314 |
| Advisor Q9 | MODIFIED | 2 C1 item 4; 9 Dissent 3 | the text already ships; only the non-comparability statement is added |
| Advisor Q10 | ACCEPTED | 2 A3 rule text; 9 Q10 | no age threshold |
| Advisor Q11 | ACCEPTED | 1.2 | 3.2.0 |
| X1 version 3.2.0 and renames | ACCEPTED | header; 1.2; 4.2 | D-1 |
| X2 defer relocation, three conditions | ACCEPTED | 2 A5 AC-A5-7; C3 notes; 8 D8 | plus the TODO entry (D-11) |
| X3 B2 edits | ACCEPTED | 2 B2 | "MAY show", "not given" statement, every delegation |
| X4 view approach; CI caveat | ACCEPTED | 4.6; 10 item 9 | PR body states that only the orchestrator enforces the gates |
| X5-1 two callers missed | MODIFIED | 2 A4; 9 D-2 | superseded by the derivation; its ACs kept as AC-A4-7 |
| X5-2 apply refuses root `env/` and `cert/` | ACCEPTED | 2 A4 "Protection is immediate"; C3 notes | stated as intended |
| X5-4 list matched by label | ACCEPTED | 4.6 | by exact label |
| X5-5 one project rule neutralises B1 | ACCEPTED | 2 B1 | closed by the non-relaxable sentence |
### 11.1 Critique round 2 (R2-1..R2-15), applied by the orchestrator on 2026-11-23 before the freeze

Verdict of round 2: READY TO FREEZE after fixes; no design round needed.

| Item | Disposition | Where | Reason |
|---|---|---|---|
| R2-1 worker told to run the strict gate | ACCEPTED | 4.7 step 3 | the orchestrator runs both compat runs and hands the retained results files to session 2 |
| R2-2 probe P-2 unrecorded | ACCEPTED | 4.6 P-2 | run on 2026-11-23, totals recorded there (release-3.1 351/0/0, c18 59/0/0, bs-doc-map in the P-2 entry) |
| R2-3 scratch location | ACCEPTED | 4.3 `buildView` | outside-temp rule only for the runner `--out`; specs use their own temp scratch |
| R2-4 Git ownership in gate G | ACCEPTED | 4.5 G | Git failure is its own FAIL label; run only where ownership holds |
| R2-5 spec cannot pin itself | ACCEPTED | 4.5 pins | test infrastructure pinned by set membership only |
| R2-6 compat runs depend on the real home | ACCEPTED | 4.6 prerequisite and run 1 rule | empty `installerBackups` first; compat before D7; additive-output failure is stop-and-report |
| R2-7 overlaid-file pin has no source | ACCEPTED | 4.6 runner | check dropped: the real-tree gate proves the 3.2.0 bytes |
| R2-8 missing A4 state | ACCEPTED | 2 A4 state table | row added; the tests lane adds it to AC-A4-4 |
| R2-9 constant is the normalized hash | ACCEPTED | AC-A4-1; Dissent 1 (c) | `apply.mjs:626`, `lib.mjs:209-214` |
| R2-10 insertion order after line 79 | ACCEPTED | 2 A1 item 2; 2 A2 item 1 | line 79, layer sentence, `[AT320_2]`, `[AT320_1]` |
| R2-11 `[CT320_1]` vs the compare duty | ACCEPTED | 2 B2 | first sentence added; Dissent 4 stays listed for the maintainer |
| R2-12 B1 no contradiction | NO CHANGE | 2 B1 | confirmed by the critique |
| R2-13 Phase 0 reads of 03 | ACCEPTED | 9 D-5 | `docs-generation.md:183`, `SKILL.md:231-235` |
| R2-14 commits 2 and 10 unreviewed | ACCEPTED | 6.1 Reviews | review lane covers both |
| R2-15 acceptance doc intro names the old gates | ACCEPTED | 2 C1 item 3b | one inserted sentence |

The plan is frozen by the commit that adds this file; it is never edited afterwards (changes go through the maintainer).
