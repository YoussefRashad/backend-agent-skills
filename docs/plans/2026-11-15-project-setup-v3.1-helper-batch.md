# project-setup 3.1.0 — live-helper batch fix (frozen plan)

> Frozen 2026-11-15. Class: normal (test-only). Branch `feat/ps-bs-doc-map` (PR #3), base e2bde75.
> Lanes: plan (Codex, 3 rounds), plan-critique (Claude, 2 passes: round 1 three BLOCKING gaps, pass 2
> one BLOCKING maintainer decision, resolved below). This document is never edited; changes go
> through the maintainer. Evidence cited as `.review/hb-evidence/...` is a git-ignored local copy of
> the dated live-acceptance records (D:\ps-live fixtures); it is not committed.
> Links were made relative to this file at freeze; the plan text below is otherwise the plan lane's
> round-3 output verbatim, followed by the freeze addenda, which take precedence where they differ.

## Freeze addenda (take precedence over the plan text)

### A1. Maintainer decision on the seed hook override (critique pass 2, H1)

On 2026-11-15 the maintainer approved B5's narrow hook decision: `runSeed` disables Git commit hooks
for its own two commits only (post-setup baseline and application case), with a command-local
`-c core.hooksPath=<empty directory>`. This supersedes the round-2 out-of-scope line "hook bypasses"
for those two commit sites only. Every other hook exclusion in the plan stands.

### A2. Non-blocking critique items adopted (pass 2, H2-H7)

- **H2 — threat argument scope.** The override protects the seeded bytes against commit hooks only.
  The plan text and the §6 sentence must not claim that seed prevents fixture code from running:
  repository-local configuration can still run commands during seed's existing `git status` and
  `git add` (for example `core.fsmonitor`, clean/smudge filters), which `isolatedGitEnv` does not
  isolate and this batch does not change.
- **H3 — empty-directory lifecycle.** Create the directory with `fs.mkdtempSync` under the OS temp
  directory after preflight succeeds; pass it to Git with forward slashes; remove it in `finally` with
  a non-recursive `fs.rmdirSync`. A removal failure must not change the seed result or the exact
  three-line `BASE`/`HEAD`/`RANGE` stdout contract; it is reported on stderr only. Add a test with an
  injected removal failure.
- **H4 — configuration assertions.** "Unchanged configuration" tests assert the bytes of the
  fixture's own `fixture-gitconfig` and the repository-local `core.hooksPath` value. Tests never read
  the user's real global or system Git configuration.
- **H5 — portable hook fixtures.** Hook test files are written with LF line endings and `#!/bin/sh`,
  and `chmod 0o755`. The positive control's failure message names the hook-execution precondition.
- **H6 — static-scan wording.** The forbidden-helper-action scan rejects the word `rollback` in
  non-comment helper code, strings and trailing comments; the cleanup and commit-failure paths must
  not use it.
- **H7 — `.remember/` regression.** The fixture places a file under `.remember/`, because
  `git status --porcelain -uall` does not list an empty directory.

### A3. Orchestrator probe record used by the plan

All on 2026-11-15, Windows host, Claude Code 2.1.325 (from the init events): the clean agent runs used
`--setting-sources project,local --permission-mode auto --output-format stream-json --verbose`; in
that mode the project Read deny refused a canary under `secrets/` and the project raw-Git hook blocked
`git log`; in the bs-new fixture `core.hooksPath` is `.husky/_` with lint-staged running
`eslint --fix` and `prettier --write` (static inspection, no seed run).

---

| Gap | Disposition | Where | Reason |
|---|---|---|---|
| G1 | **FIXED** | B3 | Preserve the measured seven-line subsection under plain `### Lock order`. Synthetic-fixture explanation belongs only in acceptance §6; 03 receives neither that explanation nor the seeded filename. |
| G2 | **FIXED** | B1 | Require the reference when baseline visible critical-rules text contained it, or the baseline document was present, as well as for current presence or evidence declarations. |
| G3 | **FIXED** | B4, procedure controls | Record the confirmed agent command, including `--permission-mode auto --output-format stream-json --verbose`; distinguish PS rows using PS’s default-mode guidance. |
| N1 | **FIXED** | B1 | Consult document state for the optional-reference decision only when the current visible critical-rules link is missing. Test denied document plus retained link without adding a new unavailable read. |
| N2 | **FIXED** | B2 | Add `baseManifestState()` inside the accessor boundary; use existing `curManifestState()` to distinguish absent/invalid manifests from absent ownership records. |
| N3 | **FIXED** | B2 | Use a closed, case-sensitive class set. Test case variants and preserve encoded detail output with a constant finding name. |
| N4 | **FIXED** | B3 | Document the existing automatic post-setup baseline commit and test both committed-first and reviewed-uncommitted prerequisites. |
| N5 | **FIXED** | B3 | Pin the acceptance document’s invariant block byte-for-byte to one test constant; use that constant in both positive seed paths. |
| N6 | **FIXED** | B5 | Require pre-seed status inspection and disclosure of host-output exclusion. Keep unrelated-dirty-state refusal; add a `.remember/` regression. |
| N7 | **FIXED** | B5 | Require and record BS creating `service` directly under the initialized workspace; other child names remain refused. |
| N8 | **FIXED** | B5 | Pass explicit disjoint `roots` to the `runInit` regression so it works with the default temporary scratch directory. |
| N9 | **FIXED** | B5 | Supply exact repository-local identity commands; inherited identity is insufficient. |
| N10 | **FIXED** | B4, B6 | Name `.project-setup.bak-*` in §1’s duplicate-copy checklist and disable it through the host, without moving the installer backup. Detection and installer changes remain excluded. |
| N11 | **FIXED** | Evidence boundary, B4 | Version `2.1.325` is confirmed by the orchestrator from probe-run init events, not inferred from the undated version file. |
| N12 | **FIXED** | B4 | Require disclosure of global-instruction prompts and answers during interactive PS rows. |
| N13 | **FIXED** | Procedure-contract controls | Specify the exact sentences, commands, prompts and block that tests must pin, including negative controls for their removal. |
| N14 | **FIXED** | B5 hook decision | Reconsider the earlier blanket rejection narrowly: disable Git hooks only for `runSeed`’s own baseline and case commits. Add behavioral tests for hook isolation, exact bytes and unchanged configuration. The supplied hook inspection is static evidence, not a completed seed probe. |
| N15 | **FIXED** | B4 | Record the dated isolated-mode Read-deny and raw-Git-hook probe, limited to one host/version and those project controls. |
| N16 | **FIXED** | Evidence boundary, gates | Cite the serial-suite rule at `docs-generation.md:112` and the corrected token at `bs-existing/evidence.json:50`. |

# Revised plan: PS 3.1.0 helper batch fix — round 3

Class: **normal**. PR #3, stage 1. Test-only changes.

## Status and evidence boundary

This plan is ready for the orchestrator’s freeze review. Implementation, gates, original-artifact auditing and stage-2 acceptance remain separate execution obligations.

Read-only inspection in this session confirmed branch `feat/ps-bs-doc-map` at `e2bde75a5ff6b9e25ab4c4f050c0551ff8953069`. `git status --short` reported no changes, with warnings about the inaccessible user-global ignore file. No files were edited, created or deleted. No tests, seeds or live probes were run in this lane.

Repository guidance was read from `CLAUDE.md` and all six `.ai/context/*.md` documents. This repository ships skill payloads rather than an application runtime; scope discipline and dated, bounded verification claims remain applicable. [CLAUDE.md:11](../../CLAUDE.md:11), [development-rules.md:36](../../.ai/context/development-rules.md:36), [development-rules.md:64](../../.ai/context/development-rules.md:64)

The evidence review covers all four copied observation records, the supplied reports and metadata, the 03 excerpt, advisor/maintainer decisions and version record. These are dated records, not fresh executions of the fixtures.

The copied evidence JSON contains corrections: the existing-project token is `returns a bare string`, its infrastructure paths are explained, and the new-project evidence explains the ADR and index. These are not the original inputs to `verify-1`. [existing evidence:50](../../.review/hb-evidence/bs-existing/evidence.json:50), [existing evidence:129](../../.review/hb-evidence/bs-existing/evidence.json:129), [new evidence:141](../../.review/hb-evidence/bs-new/evidence.json:141)

Raw agent JSONL, original snapshots and fixture source trees are absent from the copied bundle. The following additional evidence comes from the orchestrator’s **2026-11-15 task record**, supplied with this revision:

| Record | Supplied result | Evidence qualification |
|---|---|---|
| O1: agent init events | `docs-sync-2-clean.jsonl` and `reviewer-2-clean.jsonl` report `permissionMode: "auto"` and `claude_code_version: "2.1.325"`; runner flags were `--setting-sources project,local --permission-mode auto --output-format stream-json --verbose`. | Confirmed by orchestrator inspection, not independently re-audited here. |
| O2: isolation-probe version | Probe-run init events confirm Claude Code `2.1.325`. | Confirmed, not inferred from `claude-version.txt`. |
| O3: project controls under isolation | In `bs-new`, isolated print mode with auto permission denied Read of `secrets/canary.txt` under `Read(**/secrets/**)`; the project `guard-raw-git.mjs` blocked raw `git log -1 --oneline`; canary content was absent from the transcript. Canary removed; fixture clean. | Dated live probe on one host/version, limited to the named project deny and hook. |
| O4: seed hook exposure | Repository-local `core.hooksPath` is `.husky/_`; `.husky/pre-commit` runs `npx lint-staged`; package configuration applies `eslint --fix` and `prettier --write` to `*.{ts,js}`, and `prettier --write` to `*.{json,md}`. | Static fixture inspection only; no seed was run. |

These supplied records have no copied file-and-line artifact in this lane. Do not invent a transcript citation or describe them as a fresh local audit. Source-code claims below were rechecked against the cited files.

## Scope and boundaries

Implement B1–B5 in the helper, existing regression test and live procedure. Include B6’s procedure clarifications and pointer-token limitation wording.

Preserve the advisory contract: `verify` returns only `not-evaluable`, `findings`, or `no-automated-findings`; acceptance remains the maintainer’s decision. Preserve the read boundaries for all inputs and project reads. [amendment:18](../../docs/plans/2026-11-11-project-setup-v3.1-bs-doc-map-amendment-1.md:18), [amendment:42](../../docs/plans/2026-11-11-project-setup-v3.1-bs-doc-map-amendment-1.md:42)

Out of scope:

- Shipped PS `SKILL.md`, `references/`, `scripts/`, `assets/`, `install/` and `data/`.
- Backend-standards, toolchain-config and dependency changes.
- Release notes, CHANGELOG, VERSION, TODO closeout and release actions.
- Adopt-inconsistency rules and `env/**` / `cert/**` policy changes.
- Filling the §7 results matrix or claiming stage-2 acceptance.
- Both frozen plan documents.
- General Markdown-parser changes, production enforcement and automatic collateral approval.
- General hook bypasses, changes to hook configuration, PS approval bypasses and seed transaction recovery.
- Changes to copied evidence, historical observations or fixtures to manufacture acceptance outcomes.

The sole hook exception is B5’s command-local override for **`runSeed`’s two existing fixture commit sites**. It does not apply to PS, BS, manual commits, `runInit`, agent measurements or project hooks generally.

### Files touched

| File | Planned edits |
|---|---|
| [project-setup/tests/live/bs-doc-map.mjs](../../project-setup/tests/live/bs-doc-map.mjs) | B1 baseline-aware conditional reference check; B2 classified collateral details and baseline manifest-state accessor; B3 actionable refusal; B5 narrow legacy recognition and seed-commit hook isolation; B6 limitation wording. |
| [project-setup/tests/bs-doc-map.test.mjs](../../project-setup/tests/bs-doc-map.test.mjs) | Behavioral regressions, exact invariant constant, hook-isolation tests and procedure-contract controls. |
| [project-setup/tests/live/BS-DOC-MAP-ACCEPTANCE.md](../../project-setup/tests/live/BS-DOC-MAP-ACCEPTANCE.md) | Evidence preparation, reviewer prerequisite, exact agent launch, probe qualifications, fixture identity/status preparation, hook disclosure and measurement clarifications. |

No additional test file is needed. Preserve the release test’s exact test-file inventory. [release:470](../../project-setup/tests/release-3.1.test.mjs:470), [release:1274](../../project-setup/tests/release-3.1.test.mjs:1274)

## B1 — Preserve the money rule and every applicable existing reference

### Evidence and decision

The PS-first record says the link had been absent since the PS 3.0.0 baseline because the document was not generated, while PS 3.1 retained the substantive money bullet. That is the narrow false positive this change addresses. [PS observations:81](../../.review/hb-evidence/ps-first/observations.md:81)

The helper currently compares complete template bullets and independently requires the reference. Both checks need conditional applicability. The shipped specification also requires preserving an **existing** reference; current absence alone cannot authorize removing it. [helper:834](../../project-setup/tests/live/bs-doc-map.mjs:834), [generation:357](../../project-setup/references/docs-generation.md:357)

Keep this substantive rule mandatory:

> Money, balance, payment, and points flows: no read-modify-write without a lock or atomic statement; no retry without proven idempotency.

Only its exact trailing `See .ai/context/critical-modules.md.` sentence may be optional. [template:22](../../project-setup/assets/templates/AGENTS.md:22)

The specification permits skipping near-empty documents and retains root critical rules. Its instruction to remove references to ungenerated documents occurs specifically in canonical-agent rendering; it is not a general root-rendering rule. This batch implements the recorded narrow interpretation without changing shipped specifications. [generation:3](../../project-setup/references/docs-generation.md:3), [generation:36](../../project-setup/references/docs-generation.md:36), [generation:422](../../project-setup/references/docs-generation.md:422)

### Implementation

1. Pass an explicit reference requirement from `runVerification` to `checkRootInstructions`; preserve a conservative required-by-default behavior for direct callers.
2. Determine whether the current **visible critical-rules block** contains the reference, using the existing block parser and visible-text treatment.
3. If that reference is present, do not ask for `critical-modules.md` state solely for this applicability decision. Preserve all independently required document, inventory and pointer checks.
4. If the reference is missing, require it when **any** of these holds:
   - The baseline AGENTS.md visible critical-rules block contained the reference.
   - `baseState('.ai/context/critical-modules.md')` is `present`.
   - The current permitted document state is present.
   - The document appears in `evidence.pointers` or `evidence.fullDocuments`.
5. Obtain baseline AGENTS.md through `baseRec`, including its captured text; do not directly index the snapshot after the accessor boundary. A present record lacking required text, an unavailable baseline or unsupported text shape cannot establish that the baseline lacked a reference.
6. Consult document states lazily, only on the missing-current-link branch. If a known positive trigger already establishes the requirement, avoid unnecessary reads merely to rediscover that requirement.
7. Waive the reference only when baseline visible text establishes no existing link, baseline and current document absence are confirmed, and neither evidence declaration names it.
8. A denied, unsafe, unreadable or unavailable state needed to establish that exception remains `not-evaluable`, never “absent.”
9. Only in that confirmed optional case, remove the **exact trailing reference sentence** from the template money-bullet comparison and omit the separate reference requirement. Preserve every substantive word and every other critical-rule check.

Baseline snapshots retain AGENTS.md text. Existing accessors distinguish absence from unavailable state and collect unavailable reasons; reuse those boundaries. [helper:860](../../project-setup/tests/live/bs-doc-map.mjs:860), [helper:1583](../../project-setup/tests/live/bs-doc-map.mjs:1583), [helper:1603](../../project-setup/tests/live/bs-doc-map.mjs:1603), [helper:1675](../../project-setup/tests/live/bs-doc-map.mjs:1675)

An explained deletion cannot suppress this root-rule requirement: `evidence.explained` remains a collateral assertion only. [helper:1712](../../project-setup/tests/live/bs-doc-map.mjs:1712)

### Acceptance

Under `node project-setup/tests/bs-doc-map.test.mjs`, prove:

| Case | Required result |
|---|---|
| Both snapshots confirm no document; baseline has no visible reference; no declaration; current complete money rule lacks link | No root-rule finding, in ordinary and mapped layouts. |
| Baseline visible critical-rules text had the link; current link removed; document absent | `critical-modules-reference`. |
| Document existed in baseline, is deleted now and deletion is explained; link removed | `critical-modules-reference` remains. |
| Current full document or pointer exists; link missing | `critical-modules-reference`. |
| Either declaration names document; link missing | `critical-modules-reference`; absent declared document retains its independent presence finding. |
| Document denied, link present, no independent check requires it | Verification remains evaluable; no new document read is introduced by B1. |
| Link missing and denied/unreadable/unsafe document state is needed to establish the exception | `not-evaluable`, with no forbidden read. |
| Baseline document state or required baseline AGENTS text unavailable | `not-evaluable` when needed for the exception; never infer absence. |
| Baseline link exists only in an HTML comment; both documents confirmed absent | Comment does not create a visible-reference preservation requirement. |
| Current link exists only in an HTML comment and any requirement trigger holds | `critical-modules-reference`. |
| Money, locking, atomicity or idempotency wording removed or weakened by omission | `critical-rule-lost`, including the optional-document case. |
| Required money rule hidden in a comment, or another critical rule removed | Existing rule-preservation finding remains. |

Retain existing root and hidden-text controls. [tests:984](../../project-setup/tests/bs-doc-map.test.mjs:984), [tests:2248](../../project-setup/tests/bs-doc-map.test.mjs:2248)

The existing substring comparison does not detect every possible weakening sentence appended after an intact rule. General semantic validation remains outside this batch.

## B2 — Keep collateral exemptions manual and explain each finding’s class

### Evidence and decision

The existing-project unexplained list contains thirteen infrastructure paths; the new-project list contains two decision paths. Preserve exact reviewed-path explanations rather than automatically exempting either group. [existing verify:4](../../.review/hb-evidence/bs-existing/verify-1.txt:4), [new verify:2](../../.review/hb-evidence/bs-new/verify-1.txt:2)

Use this closed set of class values:

| Class value | Classification |
|---|---|
| `canonical-agent` | Exact `.ai/agents/docs-sync.md` and `.ai/agents/reviewer.md`. |
| `security-policy` | Exact `.ai/security-paths.json`. |
| `tool` | Paths below the explicit `.ai/tools/` directory boundary. |
| `claude-project-settings` | Exact `.claude/settings.json`. |
| `codex-agent-definition` | Agent-definition paths below `.codex/agents/`. |
| `decision-document` | Documents/indexes below `.ai/decisions/`. |
| `project-extension` | Recognized project-extension paths; canonical paths take precedence. |
| `other-inventory` | Remaining permitted inventory paths, including unknown agent files and case variants. |

Actual paths to cover:

- `.ai/agents/docs-sync.md`, `.ai/agents/reviewer.md`.
- `.ai/security-paths.json`.
- `.ai/tools/git-safe-core.mjs`, `.ai/tools/git-safe.mjs`, `.ai/tools/guard-raw-git-core.mjs`, `.ai/tools/guard-raw-git.mjs`, `.ai/tools/hooks-selftest.mjs`, `.ai/tools/review-diff.mjs`, `.ai/tools/security-policy.mjs`.
- `.claude/settings.json`.
- `.codex/agents/docs_sync.toml`, `.codex/agents/reviewer.toml`.
- `.ai/decisions/0001-forbid-non-whitelisted-off.md`, `.ai/decisions/README.md`.

**Automatic infrastructure and ADR exemptions remain rejected.** The same run can write a file and its ownership record; that cannot approve its own collateral changes. Directory membership cannot establish ADR rationale or authorize an unrelated tool or agent definition. [existing observations:67](../../.review/hb-evidence/bs-existing/observations.md:67), [frozen plan:337](../../docs/plans/2026-11-11-project-setup-v3.1-bs-doc-map.md:337), [generation:133](../../project-setup/references/docs-generation.md:133)

Corrected evidence removed the collateral findings while leaving the existing-project `not-strict` omission visible. This supports better diagnostics and preparation without changing approval semantics. [existing observations:55](../../.review/hb-evidence/bs-existing/observations.md:55), [new observations:49](../../.review/hb-evidence/bs-new/observations.md:49)

### Implementation

Preserve the evidence schema, exemption algorithm and finding name:

> no unexplained collateral modification in the permitted inventory

For each unexplained changed path, include encoded detail data containing:

- Path.
- Change kind: creation, modification or deletion.
- One class value from the closed set.
- Baseline/current manifest state and ownership information.
- Guidance to review the exact change and add only approved exact paths to `evidence.explained`.

Use case-sensitive canonical matching. `.ai/agents/Reviewer.md` is `other-inventory`; a filename prefix must not impersonate a canonical agent or extension. Class values are fixed literals, never constructed from path text.

Add `baseManifestState()` **before** `==== END path-state accessors ====`, and use existing `curManifestState()` for the current side. `ownerOf` alone cannot distinguish an absent or unusable manifest from a valid manifest with no ownership entry. Report those states separately; do not invent an owner. Preserve existing manifest validation and unavailable-state behavior. [helper:1363](../../project-setup/tests/live/bs-doc-map.mjs:1363), [helper:1595](../../project-setup/tests/live/bs-doc-map.mjs:1595), [helper:1612](../../project-setup/tests/live/bs-doc-map.mjs:1612)

Use `baseState`, `snapState`, hash and ownership accessors. Preserve the source assertion forbidding direct snapshot or manifest access after the boundary. Add no inventory directories; inspect no transaction payload or `.ai/.run/`. [tests:2662](../../project-setup/tests/bs-doc-map.test.mjs:2662)

Keep variable text in details, which already pass through `JSON.stringify` and `encodeLine`. This preserves existing report-line protection; the change is not a newly discovered report-injection fix. [helper:1724](../../project-setup/tests/live/bs-doc-map.mjs:1724), [helper:1780](../../project-setup/tests/live/bs-doc-map.mjs:1780)

Add a §4 checklist:

1. Review exact before/after changes across all classes.
2. Establish approval and ADR rationale independently.
3. Add only exact approved paths to `evidence.explained`.
4. Retain independent wrapper, pointer, extension and ownership checks.
5. Treat omitted explanation as unresolved evidence, not proof of a PS defect.

An explanation is a maintainer assertion, not helper validation of file contents.

### Acceptance

Prove:

- Every actual path above gets its intended class.
- An unexplained creation in each class remains reported. For the extension class, use an undeclared extension; extensions already declared in evidence retain their existing preservation check and exemption.
- Adding one exact explanation removes only that path’s collateral detail; a neighboring path remains.
- Creation, modification and deletion remain findings without explanation, including manifest-owned paths.
- Adding or changing ownership cannot suppress collateral.
- Unrelated tools, unapproved Codex definitions and unsupported ADRs remain findings.
- Canonical paths, extension names and directory boundaries cannot be confused by prefixes.
- `.ai/agents/Reviewer.md` and unknown agent files use `other-inventory`.
- Every emitted class belongs to the closed set.
- Absent manifest, valid manifest without a record, and recorded ownership remain distinguishable in details; invalid/unavailable states preserve existing validation behavior.
- Unavailable paths on either side remain `not-evaluable`, including explained paths.
- Control characters cannot forge report or outcome lines.
- Unchanged files produce no collateral finding.

Retain current collateral and unavailable-path controls. [tests:2688](../../project-setup/tests/bs-doc-map.test.mjs:2688), [tests:2719](../../project-setup/tests/bs-doc-map.test.mjs:2719)

## B3 — Document the exact maintainer-owned reviewer prerequisite

### Exact text and placement

Preserve the measured subsection unchanged:

```markdown
### Lock order

Any operation that changes two wallet balances MUST run in one database transaction, lock both
wallet rows (`SELECT ... FOR UPDATE`) in ascending wallet-id order before reading either balance,
and write both balances inside that transaction. A balance read outside the lock and written back
loses a concurrent update; locking in caller order deadlocks two opposite transfers.

```

The seven-line unit includes its trailing blank line. Install it under `## 8. Cache, locks and queues`, after the existing production-state description and before §9. Keep the surrounding production-state prose unchanged. [03 excerpt:3](../../.review/hb-evidence/bs-existing/03-lines-160-175.md:3), [03 excerpt:7](../../.review/hb-evidence/bs-existing/03-lines-160-175.md:7)

Do not retitle it, insert a fixture-scope paragraph into 03, or name the seed target there. This preserves the reviewer input measured by `reviewer-2-clean` and the frozen plan’s project-specific invariant. [existing observations:93](../../.review/hb-evidence/bs-existing/observations.md:93), [frozen plan:867](../../docs/plans/2026-11-11-project-setup-v3.1-bs-doc-map.md:867)

The rule covers one transaction, both locks before either read, ascending wallet-ID lock order and both writes inside the transaction. Its stated failures are lost updates and opposite-transfer deadlocks. Add no unrecorded retry or recovery semantics.

### §6 prerequisite text

Insert a maintainer prerequisite before seed commands, containing the exact fenced block above and this operative guidance:

> This is a synthetic, fixture-only acceptance setup; that explanation belongs here, not in the measured project's 03.
>
> The maintainer adds the exact Lock order subsection to 03 §8 and reviews the prerequisite diff before seeding.
>
> The preferred path is to commit the reviewed invariant with the fixture identity before running seed.
>
> Seed also accepts a reviewed, uncommitted 03 edit: it commits permitted post-setup changes as the baseline before committing the application change.
>
> In both paths, verify that the returned base commit contains the exact invariant and that the printed range contains only the seeded application change.
>
> Within the measured fixture, keep the detailed invariant only in 03; do not copy it into root instructions, agent definitions, wrappers, project extensions or a launch brief.
>
> Do not add a fixture-only heading, a synthetic-scope paragraph or the seeded filename to 03.
>
> Use the exact §5 reviewer prompt, substituting only the actual agent name and printed range.
>
> The helper checks only the readable 03 Lock order marker; the maintainer verifies the exact text and returned baseline commit.
>
> The helper never writes documentation.

The automatic baseline path is existing behavior: permitted dirty `.ai/` changes are committed before `base` is captured. The recorded reviewer setup used that path. [helper:1263](../../project-setup/tests/live/bs-doc-map.mjs:1263), [helper:1327](../../project-setup/tests/live/bs-doc-map.mjs:1327), [helper:1331](../../project-setup/tests/live/bs-doc-map.mjs:1331), [existing observations:80](../../.review/hb-evidence/bs-existing/observations.md:80)

Change only the `baseline` refusal detail to:

> The baseline 03 must already record the project lock-order invariant ("Lock order"). See BS-DOC-MAP-ACCEPTANCE.md §6: the maintainer adds and reviews the exact invariant, normally committing it before seeding; seed can commit a reviewed uncommitted 03 edit into its post-setup baseline. The helper never writes documentation.

Preserve the refusal code and marker. Apart from B5’s commit-hook isolation, preserve seed ordering and application bytes.

### Acceptance

Define one test constant containing the exact seven-line unit, including line breaks and final blank line.

- Extract the dedicated invariant fence from acceptance §6 and compare its content byte-for-byte with that constant.
- Use the same constant for successful seed prerequisites; do not maintain an independent abbreviated fixture rule.
- Prove that dropping `ascending wallet-id order`, changing the heading, naming the target, or adding a scope paragraph inside the fence fails the document control.
- Test the committed-first path: returned `base` is the prior commit and contains the exact subsection.
- Test the uncommitted path: returned `base` is the post-setup baseline commit and contains the exact subsection; the subsequent range excludes the documentation change.
- Missing 03 or marker still refuses with code `baseline`.
- Refusal text names §6, the maintainer’s responsibility, both baseline paths and the helper’s documentation boundary.
- Prerequisite refusals leave HEAD, index, worktree and document bytes unchanged.
- Reviewer range changes only `src/bs-doc-map-fixture/wallet-transfer.ts`.
- Seed does not rewrite 03, instructions, wrappers, extensions or policy.
- Repeated seed refuses the occupied target.

Replace the abbreviated `Lock order: wallet before ledger.` success setup. [tests:1472](../../project-setup/tests/bs-doc-map.test.mjs:1472)

The historical reviewer range remains evidence of the existing plain-heading text. No new reviewer measurement is claimed by changing procedure documentation.

## B4 — Separate agent measurements from PS skill-run sessions

### Dated evidence and its limits

Record Claude Code **`2.1.325`**, confirmed from init events by O1/O2. The copied version file independently records `2.1.325 (Claude Code)` but is not the basis for dating the probe. Fixture metadata records Node `v24.14.1`. [version:1](../../.review/hb-evidence/claude-version.txt:1), [scenario:7](../../.review/hb-evidence/bs-new/scenario.json:7)

Retain the original isolation probe date: **2026-11-14, approximately 02:45**, Claude Code print mode:

- Default-source control reported the global delegation-protocol heading present.
- `--setting-sources project,local` comparison reported that heading absent and project AGENTS/CLAUDE instructions present.
- Init listed project `docs-sync` and `reviewer` agents, without PS or BS skills.
- No new login was needed.
- Context-presence answers were session self-report; agent/skill listing came from init evidence. [advisor:34](../../.review/hb-evidence/advisor-decision-2026-11-14.md:34)

The orchestrator’s **2026-11-15 inspection** confirms the exact clean-run permission mode and version; do not change the original measurement date to the inspection date.

Retain Windows 11 as the maintainer-supplied host description, not as an OS-version probe independently established by this copied bundle.

### Exact agent launch

For Claude agent rows, launch a new session at the fixture root:

```text
claude -p --setting-sources project,local --permission-mode auto --output-format stream-json --verbose "<exact §5 prompt>"
```

This is the mode actually used for `docs-sync-2-clean` and `reviewer-2-clean`, not a proposed substitute.

Keep the existing prompts exactly:

> Run `<actual agent name>` for `<printed range>`. Update affected documentation under the installed project instructions. Report files changed and unresolved gaps.

> Run `<actual agent name>` on `<printed range>`. Follow installed project instructions and report findings with severity and file:line. Do not modify files.

Substitute only the actual agent name and printed range. Retain JSONL output outside the measured project’s tracked content. [acceptance:208](../../project-setup/tests/live/BS-DOC-MAP-ACCEPTANCE.md:208)

### PS rows and installed-copy preparation

PS rows remain interactive and follow the installed PS reference’s permission guidance: **`--permission-mode default`**. Auto-mode agent measurements do not exercise PS’s human approval gates. [PS Claude reference:115](../../project-setup/references/CLAUDE.md:115)

Before every PS row:

1. Resolve duplicate plain, synced and plugin copies.
2. Explicitly include `.project-setup.bak-*` installer backups in the duplicate checklist.
3. Disable a discoverable backup through the host’s skill selection; do not move it and break installer rollback.
4. Start a new fixture-root session, never `--continue`.
5. Confirm exactly one active PS copy, selected path and version in that session.
6. Record installer verification, permission mode and any global-instruction prompts and answers.

The recorded interactive workaround disabled the backup without moving it. Interactive toggles did not establish print-mode selection in the declined attempt, which stopped with three loaded PS copies and performed no declined-replacement measurement. Codex backup discovery remains unverified. [PS observations:34](../../.review/hb-evidence/ps-first/observations.md:34), [declined observations:14](../../.review/hb-evidence/declined/observations.md:14)

Interactive PS sessions can still load global instructions; one recorded session answered the global mode gate. Disclose those prompts rather than describing PS rows as isolated. [existing observations:32](../../.review/hb-evidence/bs-existing/observations.md:32)

### Transcript provenance

Add requirements to §§5–7, cross-referenced from §1:

- Verify launch directory and baseline before every measurement.
- Retain JSONL and inspect the parent’s `Agent` brief and edits before counting routing evidence.
- A relay of the installed project’s operative AGENTS routing sentence is valid when attributed to that source.
- A parent brief supplying discovered facts, the detailed invariant’s destination or expected findings contaminates the measurement.
- Separate subagent output from parent edits and checks.
- Missing JSONL or ambiguous provenance makes cleanliness inconclusive.
- Preserve contaminated attempts as invalid; rerun from an independent fixture or untouched baseline.
- Never measure the second host against documentation corrected by the first.
- Record exact factual destinations, including TODO, rather than saying “facts only in 03” without checking.
- Codex isolation remains unmeasured; provide no assumed equivalent flag or parity claim.

The supplied records classify the first attempts as contaminated and later attempts as clean. This lane does not independently re-audit those transcripts. [advisor:15](../../.review/hb-evidence/advisor-decision-2026-11-14.md:15), [PS observations:122](../../.review/hb-evidence/ps-first/observations.md:122), [existing observations:91](../../.review/hb-evidence/bs-existing/observations.md:91)

### Project-control probe

Record O3 in the procedure as:

> On 2026-11-15, the orchestrator probed the bs-new fixture on this host with Claude Code 2.1.325 in isolated print mode using auto permission mode. Read of secrets/canary.txt was refused by the project Read(**/secrets/**) deny rule, and raw git log -1 --oneline was blocked by the project guard-raw-git.mjs PreToolUse hook. The canary content did not appear in the transcript; the canary was removed and the fixture was clean afterward.
>
> This probe covers one host, one version, one project-level Read deny and the raw-Git hook; it does not establish user-level deny loading, subprocess confinement or general isolation.

Do not repeat the canary read in this lane or inspect any secret.

The shipped reference already distinguishes tool denies and raw-Git guardrails from subprocess-proof sandboxing. This probe does not supersede those limits. [PS Claude reference:95](../../project-setup/references/CLAUDE.md:95), [PS Claude reference:120](../../project-setup/references/CLAUDE.md:120)

### Introduction and matrix

Replace the stale blanket statement with:

> Status: pending stage-2 acceptance sign-off. Dated live-run records are retained outside this matrix. This procedure records the scoped 2026-11-14 Claude Code isolation probe, the 2026-11-15 init-event confirmation and the 2026-11-15 project-control probe below; it does not enter acceptance results or close checklist items. Stage 2 records the dated matrix results and TODO closeout.

Keep every matrix row and cell unchanged. [acceptance:3](../../project-setup/tests/live/BS-DOC-MAP-ACCEPTANCE.md:3), [acceptance:226](../../project-setup/tests/live/BS-DOC-MAP-ACCEPTANCE.md:226)

Before stage-2 sign-off, the orchestrator audits original clean and contaminated JSONL. Static prose tests cannot prove live context loading or routing.

## B5 — Recognize the narrow legacy fixture and make its seed reproducible

### Fixture identity

Initialization deliberately leaves `bs-new` unscaffolded with explicit `project: null`; seed currently requires the metadata project value to equal the requested basename. [helper:1242](../../project-setup/tests/live/bs-doc-map.mjs:1242), [helper:1308](../../project-setup/tests/live/bs-doc-map.mjs:1308), [new scenario:2](../../.review/hb-evidence/bs-new/scenario.json:2)

Leave initialization unchanged. Accept the existing matching-name condition or this exact additional shape:

- `schema === 1`.
- `tool === 'bs-doc-map'`.
- `scenario === 'bs-new'`.
- An explicitly present `project` property equal to `null`.
- Requested project basename exactly `service`.

Do not accept missing fields, other null scenarios, arbitrary children or alternate parent metadata. Do not rewrite `scenario.json`.

Retain canonical non-linked path, own Git root, fixture-local identity, policy, target containment, unoccupied targets, parseable status, conflict and unrelated-dirty-state guards. [helper:1310](../../project-setup/tests/live/bs-doc-map.mjs:1310)

### Procedure prerequisites

In §3 require and record that BS creates **`service` directly under the initialized workspace**. The new-service setup prompt is not one of §5’s exact agent prompts; record the actual BS setup prompt and destination. Another child name is correctly refused.

In §6, after BS creates the repository and before committing or seeding, give these exact commands, run at the verified fixture root:

```powershell
git config --local user.name "bs-doc-map fixture"
git config --local user.email fixture@example.invalid
git status --porcelain -uall
```

Environment-only or global identity is insufficient because seed checks repository-local `user.email`. The helper must not write identity to adopt an arbitrary repository. [helper:1161](../../project-setup/tests/live/bs-doc-map.mjs:1161), [helper:1313](../../project-setup/tests/live/bs-doc-map.mjs:1313), [declined observations:6](../../.review/hb-evidence/declined/observations.md:6)

Record all host-generated output and how it is excluded from the measurement. Leaving `.remember/` untracked is not enough: it remains unrelated dirty state. A separately reviewed fixture-local exclusion or fresh fixture may resolve that preparation issue; the helper must neither ignore it automatically nor delete it. Record the actual exclusion and repeat status inspection. Do not hide application changes or treat a mere staging omission as a clean worktree. [new observations:40](../../.review/hb-evidence/bs-new/observations.md:40), [helper:1325](../../project-setup/tests/live/bs-doc-map.mjs:1325)

### Narrow hook decision

**Adopt a command-local hook override for `runSeed`’s own baseline and case commits.**

The current Git environment removes inherited `GIT_*` variables and isolates system/global configuration, but retains repository-local `core.hooksPath`. Its two seed commits therefore remain exposed to project hooks. [helper:1190](../../project-setup/tests/live/bs-doc-map.mjs:1190), [helper:1336](../../project-setup/tests/live/bs-doc-map.mjs:1336), [helper:1341](../../project-setup/tests/live/bs-doc-map.mjs:1341)

O4 establishes that the actual `bs-new` fixture has rewriting lint-staged hooks. It does **not** establish a completed seed’s exit code or observed byte rewrite.

Implementation:

1. Keep all existing preflight refusals before the first write or commit.
2. After preflight succeeds, obtain a fresh, helper-owned empty hooks directory outside the project’s tracked content.
3. Pass `-c core.hooksPath=<absolute empty directory>` directly in the argument array for only:
   - `fixture: post-setup baseline`.
   - `fixture: <case> change`.
4. Do not set `HUSKY=0`, mutate `process.env`, write Git configuration, alter hook files or apply the override to other Git operations.
5. Clean up only the helper-created empty directory in `finally`; do not recursively remove an unchecked path.
6. Preserve seed contents, explicit staging, base/head/range semantics, result shape and CLI output.
7. Preserve existing commit-error behavior and evidence; do not add transactional recovery.

**Threat argument:** seed constructs a controlled acceptance defect with exact bytes. It is not a hook measurement. Allowing arbitrary repository hooks to rewrite that defect changes the measurement and may execute unrelated fixture code. The override is limited to the helper’s already-authorized commits, after all identity, policy, target and dirty-state guards. It changes no persistent protection and grants no permission to read denied paths. Git commit hooks are distinct from Claude’s PreToolUse raw-Git guard, which remains active and unchanged.

The round-2 rejection of a general automatic bypass remains valid. Its application to these two seed-owned commit sites is replaced by this narrower decision.

### Exact hook note for §6

> Manual fixture commits can run project hooks. In the recorded bs-new setup, the first post-BS commit ran lint-staged with eslint --fix and prettier --write; a later fixture commit used HUSKY=0, so its hooks did not run. Record whether hooks ran, failed, changed files or were skipped; skipped hooks are not passing checks.
>
> Seed disables Git commit hooks only for its own post-setup baseline and application-case commits, using a command-local core.hooksPath override to an empty directory, so those commits preserve the reviewed prerequisite and seeded bytes.
>
> The override changes no Git configuration, hook file, permission rule or parent-process environment; it does not apply to PS, BS, manual commits or agent measurements.
>
> Review the resulting bytes and range before measurement. On commit failure, preserve the output and inspect HEAD, index and worktree before retrying; do not assume the attempt left the fixture untouched.
>
> Add the reviewer prerequisite as a narrow prose edit; avoid a whole-document formatting pass that changes unrelated 03 content.

The historical hook observations remain unchanged. [new observations:12](../../.review/hb-evidence/bs-new/observations.md:12), [new observations:55](../../.review/hb-evidence/bs-new/observations.md:55)

### Acceptance: identity and guards

Under the mapping test:

- Call `runInit` for `bs-new` with explicit `roots` whose `repo` and `temp` exclusions are disjoint from the test destination. This is test injection only; production defaults stay unchanged.
- Supply a scaffold dependency that fails if called; assert it is not called and no `service` directory is created.
- Preserve tests that actual production-default excluded roots are refused.
- Simulate BS creating `service` with local fixture identity and policy.
- Both seed cases succeed with their prerequisites and return ranges containing only their named application files.
- Null metadata with another scenario, wrong schema/tool, missing project field or different child name refuses untouched.
- Missing metadata, absent Git repository, nested non-root directory, missing/wrong local identity and environment-only identity refuse.
- Linked project/targets, malformed policy, denied targets, unrelated dirty files, conflicts and occupied targets still refuse.
- Explicit untracked `.remember/` content produces `dirty`; no host-output exemption is added.
- Existing matching-name fixtures still work.
- Recognition and prerequisite refusals never rewrite metadata or documentation.

Explicit roots are necessary because `planInit` excludes the OS temporary directory by default, while the mapping tests use it when `BS_DOC_MAP_SCRATCH` is unset. [helper:1165](../../project-setup/tests/live/bs-doc-map.mjs:1165), [helper:1187](../../project-setup/tests/live/bs-doc-map.mjs:1187), [tests:1297](../../project-setup/tests/bs-doc-map.test.mjs:1297)

### Acceptance: seed hooks

Use disposable local hook fixtures without installing dependencies:

- Set a repository-local hooks path resembling `.husky/_`; provide a controlled hook that records execution and rewrites staged content.
- Provide a second controlled hook that records execution and exits nonzero.
- Positive controls using ordinary fixture commits must prove these hooks actually run, rewrite or refuse as configured.
- With the same configurations, both `runSeed` cases succeed without executing those hooks.
- Exercise both the clean-baseline path and automatic post-setup baseline commit.
- Assert committed seed blobs and working-tree bytes exactly match the expected seed bytes.
- Assert the returned base contains the exact reviewed invariant in the uncommitted-prerequisite path.
- Assert range paths, identity and clean resulting worktree.
- Assert repository-local `core.hooksPath`, hook bytes, global/system configuration and parent-process environment remain unchanged.
- An ordinary commit after seed must still execute the configured hook.
- Existing preflight refusal cases remain mutation-free and create no persistent hook override.
- Verify cleanup of helper-owned empty hook directories and preservation of diagnostic state for an independent commit failure.

Retain the existing seed CLI contract: three success lines, `BASE`, `HEAD`, `RANGE`; no additional success output is needed for hook disclosure. [tests:1476](../../project-setup/tests/bs-doc-map.test.mjs:1476)

## B6 — Complete observation dispositions

“In” identifies work in this three-file batch. “Out: shipped, 3.1.x/stage 2” preserves the prior deferred disposition without assigning a new release deadline.

### Helper and procedure candidates

| Candidate | Disposition |
|---|---|
| Optional critical-modules link missing since baseline | **In: B1**, with baseline preservation and lazy state checks. [PS:81](../../.review/hb-evidence/ps-first/observations.md:81) |
| Adopt infrastructure omitted from `explained` | **In: B2 diagnostics/checklist. Automatic exemption rejected.** [existing:55](../../.review/hb-evidence/bs-existing/observations.md:55) |
| Generated ADR/index omitted from `explained` | **In: B2 classification and rationale review. Automatic exemption rejected.** [new:49](../../.review/hb-evidence/bs-new/observations.md:49) |
| Generic `envelope` token matches pointer Scope | **In: limitation/token guidance. Out: detection change.** [existing:57](../../.review/hb-evidence/bs-existing/observations.md:57) |
| Historical stale value in explanatory 03 prose | **In: contextual-review guidance. Out: weakening detection or deleting facts just to clear findings.** [PS:66](../../.review/hb-evidence/ps-first/observations.md:66) |
| PS-first capture timing | **In: retain pre-BS and post-BS/pre-candidate evidence. Out: results entry.** The record contains contemporaneous measurements. [PS:22](../../.review/hb-evidence/ps-first/observations.md:22) |
| Actual BS stamp differs across fixtures | **In: record actual signals and deviations. Out: activation/BS policy changes.** [PS:12](../../.review/hb-evidence/ps-first/observations.md:12), [existing:8](../../.review/hb-evidence/bs-existing/observations.md:8) |
| Wrong-fixture BS rerun | **In: launch-root/baseline verification and invalid-attempt retention. Out: restoration automation.** [PS:94](../../.review/hb-evidence/ps-first/observations.md:94) |
| Undocumented reviewer invariant | **In: B3**, exact text, maintainer responsibility, both baseline paths and actionable refusal. [existing:69](../../.review/hb-evidence/bs-existing/observations.md:69) |
| Fixture invariant resembles a production claim | **In: §6-only synthetic-fixture explanation.** Preserve measured plain-heading 03 text. [existing:99](../../.review/hb-evidence/bs-existing/observations.md:99) |
| Broad Prettier reflow of 03 | **In: narrow-edit guidance. Out: formatter/configuration change.** [existing:75](../../.review/hb-evidence/bs-existing/observations.md:75) |
| Legacy `bs-new` null project | **In: B5 narrow recognition.** [new scenario:2](../../.review/hb-evidence/bs-new/scenario.json:2) |
| BS-created repository identity | **In: exact local commands. Out: helper-written identity.** [helper:1313](../../project-setup/tests/live/bs-doc-map.mjs:1313) |
| Global protocol supplies routing answers/facts and edits | **In: B4 isolation, transcript audit and PS prompt disclosure. Out: global configuration edits.** [PS:115](../../.review/hb-evidence/ps-first/observations.md:115) |
| Parent relay of installed AGENTS routing | **In: explicit valid-relay distinction with source attribution.** [PS:125](../../.review/hb-evidence/ps-first/observations.md:125) |
| Interactive toggles do not establish print-mode selection | **In: session-specific confirmation and named backup checklist. Out: relocation/installation automation.** [declined:14](../../.review/hb-evidence/declined/observations.md:14) |
| Modified headless BS prompts and duplicate identical copies | **In: distinguish setup from exact-prompt measurements. Out: retrospective certification.** [new:3](../../.review/hb-evidence/bs-new/observations.md:3), [declined:20](../../.review/hb-evidence/declined/observations.md:20) |
| Auto permission mode during PS adoption | **In: disclose actual mode; future PS rows follow default-mode guidance. Out: retrospective acceptance or permission machinery.** [existing:53](../../.review/hb-evidence/bs-existing/observations.md:53) |
| Agent permission mode and probe version missing | **In: B4 O1/O2 confirmation, exact command and text controls.** |
| HUSKY/lint-staged seed exposure | **In: B5 seed-only commit override and behavioral tests. Out: general bypass/hook redesign.** Historical manual-commit disclosures remain. [helper:1336](../../project-setup/tests/live/bs-doc-map.mjs:1336) |
| `.remember/` causes checks or seed preparation to fail | **In: record failed commands, status and exclusion method. Out: toolchain-ignore changes, deletion or false pass claims.** [new:40](../../.review/hb-evidence/bs-new/observations.md:40) |
| Docker unavailable and held dependency findings | **Out: setup/environment disposition, stage 2.** Record unavailable checks and unresolved findings accurately. [new:9](../../.review/hb-evidence/bs-new/observations.md:9) |
| Git LF/CRLF warning | **Out: environment observation; no demonstrated helper defect.** No system Git change or extra normalization. [new:14](../../.review/hb-evidence/bs-new/observations.md:14) |
| “Nothing below has been run” | **In: B4 replacement; matrix remains untouched.** [acceptance:3](../../project-setup/tests/live/BS-DOC-MAP-ACCEPTANCE.md:3) |
| Initial “facts only in 03” overstatement | **In: check TODO and record exact destinations. Out: historical rewrites/placement changes.** [advisor:8](../../.review/hb-evidence/advisor-decision-2026-11-14.md:8) |
| Clean docs-sync keeps unwired 423 mapping only in TODO | **Out: maintainer acceptance judgment, stage 2.** Do not change seeds or declare acceptance to settle it. [PS:136](../../.review/hb-evidence/ps-first/observations.md:136) |
| Project controls under isolated mode | **In: dated O3 probe and narrow scope. Out: generalized isolation/security claim.** |

### Shipped findings retained outside this batch

| Finding | Disposition |
|---|---|
| Installer backup discovered as another skill | **In:** acceptance §1 names the backup and host-disable workaround. **Out:** installer/detection changes and release-note action. [PS:34](../../.review/hb-evidence/ps-first/observations.md:34), [advisor:22](../../.review/hb-evidence/advisor-decision-2026-11-14.md:22) |
| Duplicate detection misses backups | **Out: shipped, 3.1.x/stage 2.** Cause is exact directory-name matching, not a general dot-directory filter. [declined:29](../../.review/hb-evidence/declined/observations.md:29) |
| BS creates branch despite “No git” | **Out: shipped, 3.1.x/stage 2.** [PS:16](../../.review/hb-evidence/ps-first/observations.md:16) |
| BS existing-project stamp inconsistency | **Out: shipped, 3.1.x/stage 2.** Record actual signals in this procedure. [existing:13](../../.review/hb-evidence/bs-existing/observations.md:13) |
| Project-tree route mapping gap | **Out: shipped, 3.1.x/stage 2.** [PS:56](../../.review/hb-evidence/ps-first/observations.md:56) |
| Ownership guidance omits BS known-deviations changes | **Out: shipped, 3.1.x/stage 2.** Keep manual collateral assertions. [PS:58](../../.review/hb-evidence/ps-first/observations.md:58) |
| BS rerun edits merged-owned 03 | **Out: shipped, 3.1.x/stage 2.** Preserve drift evidence; no restoration automation. [PS:94](../../.review/hb-evidence/ps-first/observations.md:94) |
| Missing BS database subheadings | **Out: shipped, 3.1.x/stage 2.** Preserve reviewed heading disposition. [existing:17](../../.review/hb-evidence/bs-existing/observations.md:17) |
| Evidence-less pointer generation differs in adopt/update | **Out: shipped, 3.1.x/stage 2**, as explicitly deferred. [advisor:50](../../.review/hb-evidence/advisor-decision-2026-11-14.md:50) |
| Missing variable table and lost strictness fact | **Out: shipped, 3.1.x/stage 2.** Preserve the `omitted` finding. [existing:59](../../.review/hb-evidence/bs-existing/observations.md:59) |
| Invented PORT default `3110` caught before approval | **Out: shipped, 3.1.x/stage 2.** Retain factual-review evidence. [new:24](../../.review/hb-evidence/bs-new/observations.md:24) |
| BS 5xx message documentation disagrees with code | **Out: shipped, 3.1.x/stage 2.** Preserve correction and TODO. [new:35](../../.review/hb-evidence/bs-new/observations.md:35) |
| Default secret policy lacks `env/**` / `cert/**`; skill-policy read refused | **Out: shipped, 3.1.x/stage 2.** Preserve deferred policy decision and permission boundaries. [new:27](../../.review/hb-evidence/bs-new/observations.md:27), [advisor:57](../../.review/hb-evidence/advisor-decision-2026-11-14.md:57) |
| Secret scan flags starter placeholder and ignored plan hash | **Out: shipped, 3.1.x/stage 2.** No scanner changes or transaction-payload inspection. [existing:48](../../.review/hb-evidence/bs-existing/observations.md:48) |
| Reviewer severity and host-launch residuals | **Out: shipped, 3.1.x/stage 2.** Claude behavior does not establish Codex parity or close its residuals. [existing:93](../../.review/hb-evidence/bs-existing/observations.md:93), [acceptance:249](../../project-setup/tests/live/BS-DOC-MAP-ACCEPTANCE.md:249) |

Successful preservation, activation and approval observations remain supporting evidence and require no additional helper change.

### Pointer and stale-token limitation

Extend helper output and acceptance §4 with:

> Token matching may also report a fact copied into a pointer when a generic token occurs only in navigation text such as Scope or a heading. Choose distinctive factual tokens and review the matched context. A visible historical mention of a stale conflict value in 03 can likewise trigger stale-value-retained; the helper cannot distinguish historical explanation from an operative claim.

Keep detection semantics unchanged: pointer matching searches complete pointer text; stale-value detection searches visible 03 text. [helper:780](../../project-setup/tests/live/bs-doc-map.mjs:780), [helper:793](../../project-setup/tests/live/bs-doc-map.mjs:793)

Add paired controls:

- Navigation-token collision remains advisory and its limitation is documented.
- Actual factual duplication remains detected.
- A distinctive factual token present only in 03 does not trigger `copied-into-pointer`.
- Visible stale historical text remains reported, with contextual-review guidance.

### Capture timing

Clarify §4:

> Preserve pre-BS and post-BS/pre-candidate snapshots, per-file outcomes, installed-version diagnostics and deviations before candidate recovery.
>
> Post-recovery state cannot establish an earlier BS outcome; without contemporaneous evidence, that earlier outcome remains unmeasured.
>
> Record actual BS stamp and provenance signals and deviations; do not force an unstamped result.

Accept contemporaneous pre-recovery evidence; reject post-recovery-only evidence as proof of earlier behavior. Do not reconstruct or repair an outcome for measurement. [acceptance:138](../../project-setup/tests/live/BS-DOC-MAP-ACCEPTANCE.md:138), [frozen plan:343](../../docs/plans/2026-11-11-project-setup-v3.1-bs-doc-map.md:343)

## Procedure-contract controls

Extend the existing mapping test using its exact-sentence control pattern. For prose, normalize whitespace only; preserve wording and punctuation. For commands and the invariant, assert exact text with the specified line-ending treatment. [tests:3127](../../project-setup/tests/bs-doc-map.test.mjs:3127)

The following exact sentences must appear in the stated acceptance sections:

| Section | Exact sentence to pin |
|---|---|
| §1 | `Include .project-setup.bak-* installer backups when checking for duplicate PS copies; disable a discoverable backup through the host's skill selection without moving the installer backup.` |
| §1 | `Confirm exactly one active PS copy, its selected path and its version in the same new session that will run PS; interactive skill toggles do not establish print-mode selection.` |
| §1/§5 | `PS rows stay interactive and follow project-setup/references/CLAUDE.md, Permission mode during setup: use --permission-mode default.` |
| §1/§7 | `Record the actual permission mode and every global-instruction prompt and answer during a PS row.` |
| §3 | `For bs-new, require and record that BS creates service directly under the initialized workspace; another child name is refused by seed.` |
| §4 | `Review exact before/after changes and add only independently approved exact paths to evidence.explained; location and manifest ownership do not establish approval.` |
| §4 | `Preserve pre-BS and post-BS/pre-candidate snapshots, per-file outcomes, installed-version diagnostics and deviations before candidate recovery.` |
| §4 | `Post-recovery state cannot establish an earlier BS outcome; without contemporaneous evidence, that earlier outcome remains unmeasured.` |
| §4 | `Record actual BS stamp and provenance signals and deviations; do not force an unstamped result.` |
| §5 | `Launch each Claude agent measurement in a fresh session at the fixture root, never with --continue.` |
| §5 | `Substitute only the actual agent name and printed range in the two agent prompts.` |
| §5 | `The clean docs-sync and reviewer measurements actually used --permission-mode auto; these agent rows do not exercise PS's human approval gates.` |
| §5 | `The 2026-11-14 isolation probe's Claude Code version, 2.1.325, was confirmed from probe-run init events by the orchestrator on 2026-11-15.` |
| §5 | `Context-presence answers are session self-report; agent and skill listings and permission mode come from init events.` |
| §5 | `Codex isolation remains unmeasured; no equivalent flag or host parity is assumed.` |
| §5/§7 | `Retain JSONL and inspect the parent's Agent brief and any parent edits before counting routing evidence.` |
| §5/§7 | `A relay of the installed project's operative AGENTS routing sentence is valid routing evidence when attributed to that source.` |
| §5/§7 | `A parent brief supplying discovered application facts, the detailed invariant's destination or expected findings contaminates the measurement.` |
| §5/§7 | `Report subagent output separately from parent edits and checks; a combined final tree is not silently the subagent result.` |
| §5/§7 | `Missing JSONL or ambiguous provenance makes cleanliness inconclusive; rerun from an independent fixture or untouched baseline.` |
| §5/§6 | `Verify the launch directory and baseline before each run; never measure a second host against documentation corrected by the first.` |
| §5 | `This probe covers one host, one version, one project-level Read deny and the raw-Git hook; it does not establish user-level deny loading, subprocess confinement or general isolation.` |
| §6 | `This is a synthetic, fixture-only acceptance setup; that explanation belongs here, not in the measured project's 03.` |
| §6 | `The maintainer adds the exact Lock order subsection to 03 §8 and reviews the prerequisite diff before seeding.` |
| §6 | `The preferred path is to commit the reviewed invariant with the fixture identity before running seed.` |
| §6 | `Seed also accepts a reviewed, uncommitted 03 edit: it commits permitted post-setup changes as the baseline before committing the application change.` |
| §6 | `In both paths, verify that the returned base commit contains the exact invariant and that the printed range contains only the seeded application change.` |
| §6 | `Do not add a fixture-only heading, a synthetic-scope paragraph or the seeded filename to 03.` |
| §6 | `The helper checks only the readable 03 Lock order marker; the maintainer verifies the exact text and returned baseline commit.` |
| §6 | `The helper never writes documentation.` |
| §6 | `Before seeding, run git status --porcelain -uall and record how host-generated output such as .remember/ is excluded; leaving it untracked or merely unstaged does not satisfy seed's dirty-state guard.` |
| §6 | `Seed disables Git commit hooks only for its own post-setup baseline and application-case commits, using a command-local core.hooksPath override to an empty directory, so those commits preserve the reviewed prerequisite and seeded bytes.` |
| §6 | `The override changes no Git configuration, hook file, permission rule or parent-process environment; it does not apply to PS, BS, manual commits or agent measurements.` |
| §6 | `Record whether hooks ran, failed, changed files or were skipped; skipped hooks are not passing checks.` |
| §6 | `On commit failure, preserve the output and inspect HEAD, index and worktree before retrying; do not assume the attempt left the fixture untouched.` |
| §6 | `Add the reviewer prerequisite as a narrow prose edit; avoid a whole-document formatting pass that changes unrelated 03 content.` |
| §7 | `Record exact factual destinations, including TODO, and disclose host-generated output and failed or unavailable checks.` |

Also pin:

- Both existing exact agent prompts.
- The complete Claude agent command, including all four flags.
- Both repository-local identity commands and the status command.
- The exact invariant fence via the shared constant.
- The full dated O3 probe paragraph, including denial, blocked command, absence of canary disclosure and cleanup.
- The revised introduction.
- The pointer/stale-token limitation text.
- Existing baseline-trust wording in §4.
- The complete existing matrix rows and cells, unchanged.

Use individually named assertions. Exercise the prose-contract checker on in-memory copies with each pinned requirement removed; each removal must fail its corresponding assertion. Exercise command controls with the permission/source/output flags removed or changed, and the invariant control with substantive text altered.

These controls prove that the procedure retains its obligations. They do not prove a live host followed them.

## Digest pins and assertion impact

No digest repinning or amendment-layer edit is planned. Preserve the round-2 finding that the three current full-file hashes were not literal pins in the inspected tests, scripts, installer or plans.

| Existing check | Required treatment |
|---|---|
| Release `NEW_TESTS`, inventory and historical hashes | Keep the exact file set and historical `BASE_TESTS` pins. [release:470](../../project-setup/tests/release-3.1.test.mjs:470), [release:1274](../../project-setup/tests/release-3.1.test.mjs:1274) |
| Acceptance `accProblems` | Preserve helper name and both approved installation directories; introduce no prohibited personal path. [release:1115](../../project-setup/tests/release-3.1.test.mjs:1115) |
| Release payload/install/synthetic release | No shipped payload or release-test edits. [release:1240](../../project-setup/tests/release-3.1.test.mjs:1240), [release:1335](../../project-setup/tests/release-3.1.test.mjs:1335) |
| `v31-amendments.mjs` | Preserve amended-path records, reversal checks and hashes. [amendments:228](../../project-setup/tests/helpers/v31-amendments.mjs:228), [amendments:322](../../project-setup/tests/helpers/v31-amendments.mjs:322) |
| C18 historical tree/copy | Preserve historical identity; `tests/` remains excluded. [c18:79](../../project-setup/tests/c18.test.mjs:79), [c18:127](../../project-setup/tests/c18.test.mjs:127) |
| Shipped-agent baselines | Six historical asset pins remain unchanged. [baseline checker:34](../../project-setup/scripts/check-agent-baselines.mjs:34) |
| Frozen-spec assertions, including `R.money-rule` | Preserve specification assertions; change helper applicability coverage only. [tests:176](../../project-setup/tests/bs-doc-map.test.mjs:176) |
| Duplicate skeleton / forbidden helper actions | No copied pointer skeleton, installation action, trust grant or restoration logic. [tests:393](../../project-setup/tests/bs-doc-map.test.mjs:393), [tests:966](../../project-setup/tests/bs-doc-map.test.mjs:966) |
| Root, seed and collateral controls | Extend B1/B2/B3/B5 while retaining existing negative coverage. [tests:984](../../project-setup/tests/bs-doc-map.test.mjs:984), [tests:1394](../../project-setup/tests/bs-doc-map.test.mjs:1394), [tests:2688](../../project-setup/tests/bs-doc-map.test.mjs:2688) |
| Path-state source assertions | Add the baseline manifest accessor inside the boundary; preserve the no-direct-access assertion. [tests:2662](../../project-setup/tests/bs-doc-map.test.mjs:2662) |
| Baseline consistency/purity | Leave validation invariants and call-site controls unchanged. [tests:3006](../../project-setup/tests/bs-doc-map.test.mjs:3006), [tests:3133](../../project-setup/tests/bs-doc-map.test.mjs:3133) |
| Known limitations | Preserve baseline-trust wording and §4 placement; extend token guidance. [tests:2252](../../project-setup/tests/bs-doc-map.test.mjs:2252), [tests:3126](../../project-setup/tests/bs-doc-map.test.mjs:3126) |
| Advisory result, escaping and footer sweep | Preserve result keys, outcome codes and grammar; use existing result-recording wrappers for new verification cases. [tests:1520](../../project-setup/tests/bs-doc-map.test.mjs:1520), [tests:3198](../../project-setup/tests/bs-doc-map.test.mjs:3198) |
| Seed CLI | Preserve `BASE`, `HEAD`, `RANGE`, success shape and refusal exit behavior. [tests:1476](../../project-setup/tests/bs-doc-map.test.mjs:1476) |

`project-setup/` remains excluded from Prettier. Do not format it as a side effect or change the exclusion. [.prettierignore:2](../../.prettierignore:2)

## Execution and gates

Implementation order:

1. Orchestrator freezes this three-file plan through the delegation protocol.
2. Add focused behavioral regressions and procedure-contract controls in the existing mapping test.
3. Implement B1/B2, B3 refusal wording and B5 recognition/hook isolation.
4. Update acceptance §§1, 3–7 and B6 limitation wording without changing matrix cells.
5. Review the diff against this plan, immutable specifications, read boundaries and narrow hook scope.
6. Orchestrator runs gates serially, stopping on failure:

```powershell
$env:BS_DOC_MAP_SCRATCH = 'D:/ps-live/gate'

node project-setup/tests/bs-doc-map.test.mjs
node project-setup/tests/release-3.1.test.mjs
node project-setup/tests/c18.test.mjs
node project-setup/scripts/check-agent-baselines.mjs
npm run check
```

Prepare the existing absolute scratch directory first. Record its prior environment setting and restore that setting after the gate run. The mapping test supports `BS_DOC_MAP_SCRATCH`; the `runInit` regression must also work with default scratch through explicit test roots. [tests:1297](../../project-setup/tests/bs-doc-map.test.mjs:1297)

Every negative case must assert the intended finding/refusal, not merely a nonzero result. Record unsupported link-test skips. The negative/boundary testing requirement is at `docs-generation.md:109`; the one-full-suite-at-a-time requirement is at `:112`. Do not dismiss isolated failures as concurrent load without evidence of overlap. [generation:109](../../project-setup/references/docs-generation.md:109), [generation:112](../../project-setup/references/docs-generation.md:112)

After gates:

- Replay B1/B2 against preserved original states and inputs where available and permitted.
- Do not combine corrected evidence with an old report and claim exact historical replay.
- Preserve dated artifacts; label new outputs with helper revision, input identity and date.
- Verify the seed-hook behavior in an independent toolchain-configured fixture before counting a new live seed measurement; record commit exit status, exact committed bytes and scoped hook override.
- Audit original B4 transcripts before counting routing rows.
- Where originals are unavailable, report that limit and use fresh independent fixtures.
- Do not populate the stage-2 matrix in this batch.

## Edge cases, failure modes and rollback

| Failure mode | Required treatment |
|---|---|
| Current absence hides baseline document/link deletion | B1 checks baseline visible reference and baseline document presence independently of collateral explanations. |
| Optional-link check adds unnecessary denied reads | Inspect document state only on the missing-current-link branch; preserve independent checks. |
| Absence confused with unavailable state | Use state-aware accessors; required unavailable evidence yields `not-evaluable`. |
| Money wording weakened with optional link | Strip only the exact reference suffix; preserve every substantive word. |
| Baseline reference hidden or text unavailable | Use visible text; missing required captured text cannot prove absence. |
| Manifest approves its own collateral | Classification grants no exemption; explanations remain exact reviewed paths. |
| Ownership absence misreported | Separate manifest state from ownership record via accessors. |
| Path text impersonates a class or report line | Closed class literals, case-sensitive matching and encoded details. |
| Marker mistaken for semantic validation | Maintainer verifies exact invariant and returned base; tests pin the procedure block. |
| Reviewer input differs between hosts | Preserve measured plain-heading subsection and seed bytes; keep fixture explanation outside 03. |
| Uncommitted prerequisite omitted from coverage | Test automatic baseline folding and committed-first paths. |
| Legacy recognition broadens | Exact null shape plus all existing downstream guards. |
| Wrong child name, inherited identity or `.remember/` blocks seed | Explicit preparation instructions and unchanged refusals. |
| Hooks rewrite or reject seed | Command-local override for only seed-owned commits; positive hook controls and byte assertions. |
| Hook override persists or weakens unrelated protections | No config/environment mutation; post-seed ordinary commit still runs hooks; PreToolUse guard unchanged. |
| Commit fails after writing/staging | Preserve output and inspect HEAD/index/worktree; no transactional-recovery claim. |
| Contaminated brief counted as routing | Original-transcript audit, source attribution and invalid-attempt retention. |
| Auto agent mode confused with PS approval workflow | Exact separate commands and modes; disclose PS prompts and actual mode. |
| Scoped probe promoted into security guarantee | Record one-host/version/tool/hook scope; no subprocess-confinement claim. |
| Post-recovery evidence used for earlier BS behavior | Require contemporaneous artifacts or mark earlier behavior unmeasured. |
| Skipped/unavailable check described as passing | Record actual status and remaining scope. |
| Static tests or recorded conclusions promoted into acceptance | Maintainer retains stage-2 judgment; matrix remains unchanged. |

There is no database or shipped-project migration. Rollback is a reviewed revert of the helper-batch commit touching only the three listed files. Retain evidence and disposable fixtures for diagnosis. Do not roll back PS installations or target-project transactions merely to undo these test/procedure changes.

All G1–G3 and N1–N16 are resolved at plan level. Automatic collateral exemptions remain rejected. General hook bypasses remain excluded; the two seed-owned commit overrides are explicitly included with bounded behavior and tests. Implementation, gates, original-artifact audits and stage-2 acceptance are not claimed complete.