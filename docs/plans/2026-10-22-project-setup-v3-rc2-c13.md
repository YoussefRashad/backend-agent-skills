<!--
FROZEN 2026-10-22 on branch feat/project-setup-v3-rc2. Never edit this file; changes go through the
maintainer. Component plan C13 (review rules), the first component of project-setup 3.0.0-rc.2, on
the landed rc.1 contracts (C11a, C1-C12). Scope: the maintainer-approved review rules from the
reference-service handoffs 1 and 2a (B1-B6), with the maintainer's answers Q1-Q10. Drafted by the
plan lane (Codex, 4 revisions on one thread); plan-critique (Claude) round 4 found no BLOCKING gap.
Its two non-blocking wording gaps are closed by I13-1 in
docs/plans/2026-10-22-project-setup-v3-rc2-c13-decisions.md, which wins where it differs.
-->

# C13. Review rules

Date: 2026-10-22.
Branch: `feat/project-setup-v3-rc2`.
Starting HEAD: `8b9b4772fdde9e869dd2c39c8943c307ddb41740`.

This plan incorporates the maintainer's round-3 decisions and additions B1-B6.
It also incorporates round-4 correction G1 and restorations R1-R6.
It supersedes earlier C13 drafts. Frozen C12 plans, decisions and acceptance evidence remain
unchanged.

This planning lane performed read-only inspection. It did not modify files, run tests, install
anything, build release artifacts or use network services.

**C13-1 - Scope and boundaries**

Implement the first component of project-setup 3.0.0-rc.2:

- Strengthen the canonical reviewer with contract, adversarial, consumer and boundary passes.
- Report reachable defects beyond the plan and check every instance of a defective pattern.
- Add the approved capture, per-item isolation, staged-task, fallback, classification and overflow
  rules.
- Make docs-sync reconcile recorded drift with living documentation.
- Document prerequisites for external review and blocked built-in review preambles.
- Generate testing standards and test-run hygiene in development rules.
- Deliver these instructions through existing reviewed setup/update workflows.
- Make only the necessary current-candidate version, documentation and test-pin changes.

Out of scope:

- User-level files, including anything under `~/.claude/` or `~/.codex/`.
- Policy schemas, hooks, git-safe, runtime behavior, apply semantics or approval semantics.
- A hosted-review wrapper, review CLI wrapper or automated preflight.
- Backend-standards templates.
- A docs-sync project-rules extension.
- C14 implementation or planning.
- Dependencies, installers, release-builder changes, tags, publication or deployment.
- Historical snapshots, frozen plans, decision records and historical acceptance evidence.
- Unrelated documentation cleanup or version changes.

The external-review rule remains reference-only. It is not installed as a general project
instruction and is not mechanically enforced. Record this limitation in the plan and rc.2 notes.
Reconsider it with C14's ownership decision; do not implement C14 here.

**C13-2 - Files touched**

Paths are relative to `project-setup/` unless explicitly marked otherwise.

| Area | Files and permitted changes |
|---|---|
| Canonical agents | `assets/agents/reviewer.md`, `assets/agents/docs-sync.md` |
| References | `references/security.md`, `references/claude.md`, `references/docs-generation.md` |
| Current rollback instruction | First paragraph only of section 5 in `references/migration-v2.md` |
| Claude template | One bullet inside the existing managed block of `assets/templates/CLAUDE.md` |
| Candidate identity | `VERSION`; heading only in `SKILL.md` |
| Candidate documentation | Current opening and release section in `README.md`; prepend `CHANGELOG.md`; new `RELEASE-NOTES-3.0.0-rc.2.md` |
| New tests | `tests/c13.test.mjs`, `tests/fixtures/c13-rc1-agents.json` |
| Existing test amendments | `tests/c8.test.mjs`, `tests/c9.test.mjs`, `tests/c11b.test.mjs`, `tests/c12.test.mjs` |
| Registration | `tests/rc1-cases.mjs`, `tests/run-tests.mjs` |
| Evaluations | Append exact objects 22-26 to `evals/evals.json` |
| Distribution documentation | Root `README.md` and root `.ai/context/project-tree.md`: current versions, current release-note links and current rollback wording only |
| Acceptance evidence | New root `docs/plans/<actual-date>-project-setup-v3-rc2-c13-acceptance.md` |

The orchestrator saves this plan and its decisions separately.

Leave these unchanged:

- `assets/templates/AGENTS.md`, all wrappers and nested-instruction templates.
- `references/modes.md`, `references/state-and-apply.md` and all other references.
- Every production script, runtime asset, installer and release builder.
- `data/v2.0.0/`, its six baseline-checker digests and historical provenance.
- `data/runtime-units.json` and its seven-member contract.
- `tests/accept-rc1.mjs`, `tests/run-component-tests.mjs`, integration helpers and live procedures.
- Existing ownership-collision TODO text.
- `RELEASE-NOTES-3.0.0-rc.1.md` and the complete historical changelog suffix.
- All earlier frozen plans and decisions.

**C13-3 - Authoring constraints**

Use the existing voice of each file. MUST and MUST NOT express mandatory requirements;
SHOULD is reserved for recommendations with legitimate exceptions. Each new rule states the
failure it prevents.

New prose MUST be ASCII, with lines at most 100 columns. Tables and code retain the plan's
formatting exception. Prose frozen inside a text fence is still prose: newly written instruction
and release-note lines must satisfy the 100-column limit. Preserve existing byte-pinned text
where this plan expressly requires it unchanged.

In reviewer.md:

- Add no headings and do not renumber dimensions.
- Use bold inline labels inside existing sections and dimensions.
- Preserve the existing finding classifications, severity/confidence distinction, finding format,
  identity header, four Output items, read-only boundary and bounded-read rules.
- Preserve the current project-rules and no-fallback paragraphs.
- Add no new backticked or linked `.ai/` or `docs/` file reference requiring a generated file.
- Keep optional project paths quoted as the existing instructions require.
- Do not repeat the existing `docs/api-conventions.md` reference elsewhere.

Existing checks remain constraints, not pins to relax:

| Check | Constraint |
|---|---|
| `tests/c8.test.mjs:814` | Docs-sync Rules contain neither launcher-isolation nor review-lane claims. |
| `tests/c8.test.mjs:841` | Rendered agent references must belong to `FRESH_PATHS`. |
| `tests/c8.test.mjs:1744` | Removing the absent API conventions doc leaves no further reference to it. |
| `tests/c9.test.mjs:2088` | Preserve the complete `FORBIDDEN` list; reviewer.md must not contain `by any tool, command, or script`. |
| `tests/c12.test.mjs:2104` | Docs-sync contains no launcher or review-lane claim anywhere. |
| `scripts/validate.mjs:366` | An unquoted `@token` in CLAUDE.md can be interpreted as an import. |
| `scripts/validate.mjs:372` | Generated instruction references must resolve to existing files. |

Keep the C9 environment-filename scanner unchanged. New invocation spans, command fences and
lines beginning `Run `, `Retry ` or `Review with:` must contain no environment filename
expression. Add no `--file` text to SKILL.md or references.

The full C9 forbidden list remains unchanged, including the entries concerning AGENTS.md,
SKILL.md, state-and-apply.md, security.md and apply.mjs. Check every added reviewer sentence,
including B1-B6, against the reviewer-specific ban.

Use code formatting for `@throws` in reviewer prose. Do not put bare `@throws` into CLAUDE.md.

The following blocks freeze the added wording. Placement and line wrapping may follow the
surrounding file; wording changes require an explicit plan amendment.

**C13-4 - Findings beyond the plan and sibling defects**

Add to reviewer section 2:

```text
Plan coverage is not a correctness boundary. Report a reachable defect even when it is outside
the supplied task plan or spec, and label it "beyond plan". Passing the plan's tests is no reason
to drop it. If no plan or spec was supplied, report the defect normally without that label.

Fix the class, not the instance: when a defect comes from a pattern, inspect sibling code using
the same pattern and report each reachable instance, with its own location and scenario.
Malformed input to code that reads external files or exports is reachable; a caller that does
not exist is not. Keep the existing requirement to establish reachability in the code as it is now.
```

Do not turn hypothetical future callers or configurations into findings. Searches for sibling
instances remain subject to the trusted-head, bounded-read and no-secret rules.

**C13-5 - Adversarial pass**

Extend dimension 2 with these paragraphs:

```text
**Adversarial pass**: for every parser, transform, guard and exported function in the diff, name
inputs that break it: missing, partial, mismatched or inconsistent with a sibling source,
malformed, reversed or out of order, out of range, or outside the expected pattern. These inputs
MUST be rejected or marked unknown, never silently repaired, clamped or defaulted. A default
that changes the meaning of missing data is a finding.

**zero is not unknown**: an unreadable count, flag or state MUST NOT be reported as 0, false or ok.
Every computed share, sum, count, duration or date that is non-finite or outside its destination
column type becomes unknown; it MUST NOT become 0, be printed as a valid result, or be written
as that invalid value. Trace the calculation through reports, sends and writes so overflow
cannot produce an Infinity percentage or make a required write fail after an external action.

**a throwing logger is an input**: logging in timer callbacks, .finally, void promises and shutdown
paths MUST NOT skip bookkeeping, including lock release, an in-flight latch or a heartbeat notice.
In any loop over items, each item's work, including logging, MUST run in its own guard so one
item's fault cannot escape into the loop, discard healthy siblings or leave shared state stuck.
Restore busy flags, in-flight state, latches and counters in a finally, or before any side effect.
Check rendering getters and batch fallback paths as well as the primary operation. Isolation
must retain a truthful failure outcome; it is not permission to report a failed item as successful.

**read once, validate the capture**: when a field can change between reads through a getter,
proxy, or shared or mutable state across an await or callback, copy it into a local once and
validate and use only that capture. Include identity and scheduling fields, nested objects,
inherited getters and a nested figure used more than once in one render. Capture a bounded
projection of named fields, never a generic deep walk. Check every path, not only the path
cited by the first finding. Plain parsed JSON has no getters: the existing reachability rule
decides whether a double read is a finding; do not flag every double read.

Deadlines MUST use a monotonic clock captured at entry, be checked before each unit of work,
and arm timers for the remaining budget only. Preparation work consumes the same budget;
wall-clock adjustments or late timer setup must not extend the deadline.

A class or kind label in a log line MUST come from trusted classification: an instanceof
allowlist mapped to code-owned constants, with a fixed fallback. It MUST NOT come from a field
of an untrusted or thrown object. Reading error.name does not establish a class and can disclose
data or inject a log line. This rule concerns classification labels only; it does not change
what the project's own logging policy permits as payload, including an owner's decision to log
request data in full.
```

Interpret the overflow rule at the actual consumer boundary. An invalid computed value must not
be written. An explicit unknown representation may be written only if the destination contract
accepts it; do not silently convert unknown into zero or another valid-looking value.

The capture rule does not authorize traversing arbitrary object graphs. A throwing capture is
itself an input to the error and per-item isolation paths.

**C13-6 - Consumer pass, Boundary pass and reporting**

Add these inline passes under dimension 2:

```text
**Consumer pass**: when the diff changes when a value becomes unknown, invalid or rejected,
list every consumer: callers, transforms, error messages and documented throws, reports,
printed summaries and docs. Check that each still tells the truth. A summary MUST distinguish
"evaluated, zero" from "not evaluable"; widening a condition must not leave an error message
naming only one of its causes.

**Boundary pass**: for every value passed to or received from another module or component,
read the other side's code and check that producer and consumer agree on its meaning: unit,
range, "newest only" versus "any in the window", "zero" versus "unknown", and "rejected" versus
"skipped". A fallback row, event or handoff MUST satisfy the receiving component's real validator;
require a test using that validator, not a mock. A new or reused enum value or outcome MUST
have exactly the meaning assigned by the frozen plan, so a delivery failure cannot disappear
inside an outcome reserved for another condition.

When no frozen plan defines an outcome, use the actual documented and implemented contract.
Do not invent a plan meaning or treat the missing plan as permission to repurpose an outcome.

If a receiving validator is unavailable, disclose that unreviewed boundary. Do not claim that
a fallback passes it. Apply the staged-task rule only when its explicit ownership guard holds.
```

Add the following working-scope paragraph to the existing scope guidance:

```text
The passes are working obligations, not new report sections. Find consumers and sibling patterns
with bounded git-safe grep searches at the resolved review head, then read the relevant code.
In review-diff --base mode, also search local working changes for uncommitted consumers through
permitted local reads and the safe review output; resolved-head searches alone are insufficient.
Do not load the whole repository. Turn failures into findings with a concrete Scenario in the
existing format. Report any incomplete pass and its unreviewed scope under Output item 1;
a narrowed search does not establish that every consumer was checked.
```

**C13-7 - Database and detached-promise rules**

Extend dimension 5:

```text
**one bad row poisons the batch**: multi-row writes MUST validate every row against the actual
column types before buffering, or fall back to per-row writes on a data-class error. Check integer
ranges, numeric precision, NUL bytes in text or jsonb, and dates. Trace user-supplied text to the
write. Computed non-finite or out-of-column-range values become unknown and MUST NOT be written
as valid values. One rejected row must not discard healthy siblings or let a control take effect
without its required audit row.
```

Extend dimension 8 only:

```text
Every fire-and-forget promise on a path that can throw is a finding when its rejection has no
handler: void p, p.finally without catch, or then without a rejection handler. Trace the returned
promise as well as the original one. In a runtime where an unhandled rejection terminates the
process, this takes down the service. Do not assume that a particular project has a process-level
handler; establish its actual behavior from code and runner evidence.
```

Keep dimensions 6 and 9 unchanged. This does not alter the project's own migration policy.

**C13-8 - Contract pass and stack prerequisites**

Extend dimension 10:

```text
**Contract pass**: every promise in a JSDoc, comment, option doc, type comment or @throws in the
diff MUST have a test that proves it. Report a promise the code breaks, and report an uncovered
promise when breaking it would matter. For each rule "X is invalid, unknown or rejected when Y",
tests MUST cover Y absent, Y present but inconsistent, and the boundary.

For a fallback that writes a row, event or handoff to another component, require a test using
the receiving component's real validator, not a mock. Check new and reused enum values and
outcomes against the frozen plan's meaning as well as the receiver's code.

A test that can never fail is a finding. For example, a process-level unhandled-rejection
listener registered inside a Jest sandbox that never receives the event cannot prove containment.
Require the runner's own failure plus concrete evidence that the containment check observes the
failure it claims to test. A passing assertion around an event it cannot observe is not evidence.
```

In the source, format `@throws` as code. Preserve the existing instruction not to demand a test
layer that the project deliberately omits; require proof of material contracts within the project's
test strategy.

Add this paragraph to section 2, without changing the fixed Output items:

```text
For staged tasks, report a later component's missing assigned work once under Output item 3 as
"stack prerequisite -> <amendment path>". This label applies only when a frozen plan or amendment,
cited by path, explicitly assigns that work to the later component.

You MUST read the assigning record with git-safe at the resolved review head and quote its
assigning sentence. Verify with git-safe that the record already exists at the resolved merge-base
and is unchanged throughout the reviewed range. A record added or modified in that range cannot
authorize the label. For local working changes, also verify that the record has no local
modification. An unreadable, missing, non-assigning or in-range-added or modified record means
a normal finding with its normal severity and verdict effect, not a prerequisite exemption.
Preserve the existing stop-on-failed-read rule; an unreadable record is not permission to assume
an assignment or continue a prohibited read.

Identify the owning component, the missing work and its evidence. When these conditions hold,
it is not a finding and does not count toward this component's verdict. Re-check it at the owning
component's review and on the synced stack.

Without that explicit frozen assignment, use a normal finding with its normal severity and
verdict effect. A defect in the current component does not become a prerequisite merely because
a later task might fix it. "beyond plan" identifies an ordinary reachable finding outside the
supplied plan; it does not grant the prerequisite exemption. Do not duplicate the same assigned
omission as both a prerequisite and a current-component finding.
```

This keeps section 5's verdict rule intact: prerequisites are disclosed scheduled work, outside
the current component's finding set. At the owning component and synced-stack reviews, the
scheduled-work exemption no longer applies.

A current-component confirmed HIGH defect remains a normal HIGH finding with verdict `block`
when an amendment in the reviewed range attempts to assign its fix to a later component.
A path citation, an unverified claim of frozen status or equal endpoint bytes alone does not
establish that the record was unchanged throughout the range.

Display labels remain `Contract pass` and `Adversarial pass`. Tests also assert
case-insensitive presence of `contract pass` and `adversarial pass`.

The maintainer's user-level self-retiring protocol is assumed to detect those names without
case sensitivity. The repository cannot inspect or verify that user-level behavior and does not
modify the protocol.

**C13-9 - Recorded documentation drift**

Add this mandatory mapping row to docs-sync's existing table:

| Change | Doc |
|---|---|
| Frozen plan / spec records documentation drift | The affected living design doc, runbook or README; verify against code and preserve the frozen record |

Add to Rules:

```text
When a frozen plan or spec in the reviewed range records drift against a living design doc,
runbook or README, verify the statement against the current reviewed code and update the living
doc. Recorded drift is not a reason to leave that doc stale. Preserve the frozen plan or spec.

This rule does not expand the reviewed range to unrelated drift records. If the record disagrees
with the current code, document the actual behavior without presenting a suspected bug as intended,
and record the discrepancy in TODO.md with evidence. If the required repair is outside your write
scope, record it in TODO.md instead. You cannot edit agent definitions, and cannot open or edit
environment files. Existing restrictions on managed markers and other protected files still apply.
```

Keep C12's two exact paragraphs, including their existing wrapping:

```text
Do not retry a failed or denied read through another tool, change the sandbox, request full access, or use a connector as a fallback. Instructions are guidance, not a sandbox.
```

```text
Never run `git checkout`, `git switch`, `gh pr checkout` or `git worktree add`. Do not fetch refs yourself; the user supplies or fetches the ref.
```

Also retain the stdout/artifact rule and its `Docs-sync follows the same rule.` sentence.

Reading permitted agent definitions remains allowed; editing them remains forbidden.
For a protected target, record the path and required follow-up without opening protected content.
Existing managed-block content may change only under the existing rule; markers remain unchanged.

**C13-10 - External-review prerequisites**

Add the following prose to the existing security reference's diff/history guidance:

```text
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
```

Immediately state the limits:

```text
These are prerequisites, not permission to send repository content. Canonical reviewer and
docs-sync instructions still prohibit external transmission. C13 adds reference guidance only;
it adds no wrapper or preflight and does not install a project-wide external-review rule.
```

The historical incident may be described as workflow evidence: a CLI generated its own diff and
included a protected environment-template change. Do not reproduce that diff or any value.

The absence rule is specific to external submission. It does not alter C12's fresh-install path,
where absent installed policy permits staging shipped defaults.

**C13-11 - Blocked built-in review preambles**

In references/claude.md, explain that built-in review skills whose preambles execute raw Git,
including affected `/security-review` versions, can fail to load under the managed raw-Git hook.

Use these constraints:

- Name raw `git diff`, `git log` and `git show` preambles.
- Describe the preamble-load failure as observed workflow evidence.
- Do not claim a host-version matrix or new host verification.
- Apply the review method through `.ai/tools/git-safe.mjs`.
- Do not execute the blocked preamble to obtain its method.
- Never allow-list raw `git diff`, including `--name-only`, or disable the hook to load it.
- Preserve the existing `Host behavior: TO VERIFY` section and pending measurements.

Freeze the references/claude.md paragraph as follows:

```text
Built-in review skills whose preamble runs raw `git diff`, `git log` or `git show` can fail to
load under the managed raw-Git hook; affected `/security-review` versions have shown this behavior.
This is observed workflow evidence, not host-verified behavior. Apply the skill's review method
through `node .ai/tools/git-safe.mjs` instead, without executing the blocked preamble. You MUST NOT
allow-list raw `git diff`, including `--name-only`, or disable the hook to load the skill. Keep
host behavior TO VERIFY; this guidance does not establish that a particular host loads the hook.
```

The hook is the mechanism. The existing command-deny array is not a raw-Git deny list
(`scripts/render-permissions.mjs:22`); deny rules remain a last line of defense.

Add exactly this bullet inside the existing managed Claude block:

```text
- If a built-in review preamble is blocked by the managed raw-Git hook, apply its method
  through `node .ai/tools/git-safe.mjs`. You MUST NOT allow-list raw `git diff`, including
  `--name-only`, or disable the hook to load it.
```

No AGENTS.md or wrapper change accompanies it.

**C13-12 - Generated development rules and update delivery**

Change the development-rules row in references/docs-generation.md to:

| File | Content | Source |
|---|---|---|
| `development-rules.md` | Scope discipline, backward compatibility, reuse of patterns, contract coverage and test-run hygiene | Code style + linter config + project-setup testing and hygiene requirements below |

Add these generation requirements immediately after the context table:

```text
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
```

Add the update behavior explicitly:

```text
Treat development-rules.md as merged living documentation. On update, draft a reviewed merged
edit adding only missing testing and hygiene requirements, even if code and configuration are
unchanged. Keep equivalent existing wording and stricter project requirements. Show conflicts
for an explicit decision; do not silently weaken project text.

Do not re-add a file removed by the user; ask. If code exists and the file was never generated,
propose its creation through the normal reviewed workflow. If absence cannot be distinguished
from user removal, ask before proposing restoration. An empty repository gets no context document
until code exists. If the requirements are already satisfied and nothing else changed, produce
zero diff.
```

This uses the existing template-change trigger in references/modes.md:51; it does not change
drift categories, ownership or apply behavior.

No new development-rules template is necessary. The row and generation instructions are the
template input. Do not add that path to the canonical agents or `FRESH_PATHS`.

**C13-13 - Installed projects and rollback wording**

Delivery is an ordinary reviewed managed update.

For rc.1/schema-3 installations:

1. Render the current canonical assets and the Claude managed block.
2. Compare installed content and ownership through existing drift handling.
3. Show user-modified canonical content beside the proposed content.
4. Require explicit keep, take-new or merge decisions where the existing workflow requires them.
5. Review content and metadata, prepare with required exact-path approvals, review the bound diff,
   approve the plan hash and commit.
6. Report a kept old canonical file as an incomplete instruction update.
7. Preserve optional reviewer.project.md byte-for-byte unless a separate explicit customization
   disposition authorizes its existing migration mechanism.

C13 itself adds no reviewer.project.md content. It never overwrites project rules with new
canonical rules.

For v2/schema-2 installations:

- Run the existing baseline checker from the same skill before comparing installed agents.
- Keep all six historical snapshots and checker digests unchanged.
- Render the new canonical assets using the existing v3 rendering path.
- Give every customization an explicit disposition, including deletions and conflicting rules.
- Keep policy migration, the complete runtime unit and agent migration in the existing reviewed
  transaction.
- Do not use v2 tooling to repair a schema-3 project.

An unchanged canonical file can receive the reviewed new template. A user-modified file cannot
be silently replaced. An unreadable comparison input stops comparison. Removed files retain
existing ask-before-restoration behavior.

Replace only the first paragraph of migration-v2.md section 5 with:

```text
Roll back project state with the tooling used for the update before reverting the installed skill.
If later independent runs exist, roll them back newest first. Do not split this migration into
successive manifest commits.
```

The Q6 paragraph in section 1, recovery instructions, exit meanings and every other paragraph
remain unchanged.

**C13-14 - Frozen candidate text**

Set `VERSION` to exactly `3.0.0-rc.2\n`, without BOM or a version.json stamp.

Set the SKILL heading to exactly:

```text
# project-setup 3.0.0-rc.2
```

Freeze this new changelog entry, followed by one blank line and the complete existing rc.1 entry:

```text
## 3.0.0-rc.2

Review rules candidate: Adversarial, Consumer, Boundary and Contract passes; reachable
findings beyond the plan and sibling-instance checks; recorded-drift documentation updates.
Adds capture-once validation, per-item isolation, guarded stack prerequisites, real-validator
fallback checks, outcome contracts, trusted log classification and computed-overflow handling.
Adds external-review prerequisites, blocked-preamble guidance and generated testing standards.

Manifest schema 3 remains unchanged. V2 validation rejects schema 3;
this is not a retrofitted pre-write guard in every old command.
Roll back project state with the tooling used for the update before reverting the installed skill.
Existing projects receive the instructions through reviewed managed updates.

Automated acceptance and pending host measurements are described in
RELEASE-NOTES-3.0.0-rc.2.md. Publication remains a separate authorized action.
```

Freeze RELEASE-NOTES-3.0.0-rc.2.md exactly as follows, ASCII, LF only, with one final LF:

```text
# project-setup 3.0.0-rc.2

This is the review rules release candidate, following the rc.1 security and permissions work.
Publication is a separate authorized action; automated acceptance does not authorize a tag,
upload or deployment.

## Changes

- Adversarial, Consumer, Boundary and Contract passes in the shared canonical reviewer.
- Reachable findings beyond the plan and checks for every sibling instance of a defective pattern.
- Unknown values, throwing-logger handling, monotonic deadlines and promise-rejection checks.
- Capture-once validation through bounded named-field projections, including reachable getter cases.
- Per-item fault isolation that preserves healthy siblings and restores shared state.
- Stack prerequisites only for work explicitly assigned by a cited frozen plan or amendment.
- Fallback tests using real downstream validators and outcomes with their defined contract meaning.
- Trusted class labels in logs without changing the project's policy for permitted log payloads.
- Computed-overflow handling and row validation that prevent invalid output and poisoned batches.
- Living documentation updates when an in-range frozen plan or spec records drift.
- External-review exclusion and scanning prerequisites and guidance for blocked review preambles.
- Generated contract-testing standards and test-run hygiene through reviewed merged updates.

## Compatibility and rollback

The project manifest schema is 3. C13 adds no policy or apply migration.
Upgrade the known v2 project together with its skill. V2 validation rejects manifest schema 3.
This is a compatibility signal, not a retrofitted pre-write guard in every old command.
Do not use v2 commands to repair a schema-3 project.

Existing projects receive the instructions through reviewed managed updates. User-modified
canonical files require explicit dispositions. Keeping an old canonical file leaves that
instruction update incomplete. Project-owned reviewer rules remain intact.

Roll back project state with the tooling used for the update before reverting the installed skill.
If later independent runs exist, roll them back newest first. Do not split this migration into
successive manifest commits.
Keep recovery material until the user confirms the update. Incomplete rollback preserves later
user edits and requires retaining the unresolved backups.

## Verification

The complete automated gate requires 100 case results: 99 PASS / 0 FAIL / 1 SKIP when R13d
cannot create a Windows file symlink, or 100 PASS / 0 FAIL / 0 SKIP when it can.
No rc.1 case may skip. R91 requires real junction coverage on Windows.
The rc.1 case names and accept-rc1.mjs are retained for rc.2.
C13 contributes through R29 without adding numbered case records.
Actual automated results, environment and evidence paths are recorded by accept-rc1.mjs;
the required totals in this document are not a claim that an unrecorded run passed.
The release builder alone does not establish automated acceptance.
Static instruction checks and evaluation expectations do not prove agent behavior.

## Pending host measurements

TO VERIFY: R83; R44/R74 host enforcement; R51 Claude continuation and stderr handling;
A3 trusted-checkout live review; A5 host negative capability.
Synthetic doctor fixtures, direct Node hook tests and static instructions are not host proof.
These measurements remain pending and block final 3.0.0, not rc.2 implementation acceptance.

## Limitations

Path policy cannot detect secret content copied or hard-linked under an allowed name.
The raw-Git hook is an incomplete shell parser and depends on a trusted checkout.
Agent instructions and configuration checks do not create an operating-system sandbox.
Doctor results describe the measured configuration, processes and permitted historical log;
they do not establish the behavior of a future launch.
Blocked review-preamble loading is observed workflow evidence, not new host verification.
External-review prerequisites are reference-only: C13 adds no wrapper, preflight or installed
project-wide external-review instruction. Reconsider that known gap with C14; C13 does not
implement C14. Canonical reviewer and docs-sync instructions still prohibit external transmission.

## Provenance and release artifacts

Historical v2 provenance is retained in the frozen design and architecture records.
The historical v2 archive is not rebuilt or replaced.
Historical rc.1 release notes and changelog text remain unchanged.
The local release builder records tag, commit, subtree identity and archive SHA256 only in
external publication notes. Those notes and the ZIP remain outside the source skill tree.
```

The six section names are unchanged:

1. Changes
2. Compatibility and rollback
3. Verification
4. Pending host measurements
5. Limitations
6. Provenance and release artifacts

The seven README opening lines become exactly:

```text
# project-setup 3.0.0-rc.2 - skill source

**Release candidate 3.0.0-rc.2.** See `RELEASE-NOTES-3.0.0-rc.2.md` for acceptance requirements,
compatibility and pending host measurements.

Secret-path controls are tool-level, not an OS security boundary: on Windows native a subprocess started by an agent
can still read secret files. Keep real secrets out of development working trees.
```

Keep the existing Local candidate release section byte-for-byte except for its two occurrences
of `project-setup-v3.0.0-rc.1`, which become `project-setup-v3.0.0-rc.2`.

The resulting command fence is exactly:

````text
```text
node install/release.mjs --tag project-setup-v3.0.0-rc.2 --out <unused-directory>
```
````

`FAKE_NOTES` is known now:

```javascript
const FAKE_NOTES = asBuf(lines([
  '# project-setup 3.0.0-rc.2',
  '',
  'Fixture notes without any object identifier.',
]));
```

`SKILL_HEADING_LINES`, `README_OPENING_LINES`, `README_RELEASE_SECTION_LINES`,
`CHANGELOG_ENTRY_LINES`, `RELEASE_NOTES_TEXT` and `FAKE_NOTES` are all determined by this plan.
There is no implementation-dependent second-pass constant.

The shortened Changes bullet is the only round-4 change to the frozen release text.
The changelog remains unchanged from round 3. The preserved README security line and C12
paragraphs retain their existing bytes; they are not new prose subject to rewrapping.

**C13-15 - Exact evaluations**

Append these exact five objects. Keep evaluations 1-21 unchanged, including evaluation 21 and
its existing C12 assertion. The inventory becomes exactly 26 ordered, unique IDs.

B1-B6 extend evaluation 22; they do not add evaluation IDs.

```json
{
  "id": 22,
  "name": "review-beyond-plan-contracts",
  "prompt": "Review this staged component from the trusted checkout. The plan's tests pass. Apply the canonical review passes and report only evidence-backed results.",
  "files": [
    "Frozen current-component plan and passing tests",
    "External-input parser accepting a partial row and a sibling parser with the same flaw",
    "Changed option and documented-throws promises with missing or ineffective tests",
    "Consumers printing zero for unknown and an error message naming only one widened cause",
    "Deadline preparation, throwing logger, multi-row write and detached-promise paths",
    "Reachable getters and proxies changing identity, scheduling and nested render fields between reads",
    "Plain parsed JSON control with repeated stable field reads",
    "Per-item rendering, dry-run logging and batch fallback failures with shared busy state",
    "Fallback handoff rejected by the real downstream validator and a reused skipped outcome",
    "Log class label taken from a thrown object's name",
    "Non-finite percentage and destination integer overflow",
    "Frozen later-component amendment assigning one missing implementation to that component",
    "Assigning record present at the merge-base and unchanged throughout the reviewed range",
    "Unreadable, missing, non-assigning, in-range-modified and locally modified assigning-record controls",
    "Amendment added inside the reviewed range assigning the fix of a current-component confirmed HIGH defect to a later component",
    "Unassigned omission and current-component defect controls",
    "Local-worktree review with uncommitted consumers absent from the resolved review head",
    "Missing outcome-plan and unavailable downstream-validator variants",
    "Nonexistent-caller, absent-plan and incomplete-consumer-search variants"
  ],
  "expected_output": "Applies Adversarial pass, Contract pass, Consumer pass and Boundary pass. Reports reachable beyond-plan defects and every sibling instance with concrete scenarios; does not invent a caller or use beyond plan when no plan was supplied. Distinguishes unknown from evaluated zero, traces every consumer and checks real receiver code. Requires monotonic entry deadlines, contained logging faults, safe row handling and rejection handlers. Requires bounded named-field captures for reachable changing reads, including nested and inherited getters, without flagging stable parsed JSON or deep-walking arbitrary objects. Checks every path. Requires per-item guards and shared-state restoration so healthy siblings survive. Requires a fallback test with the real downstream validator and the frozen meaning of outcomes. Requires trusted code-owned log class labels with a fixed fallback without changing permitted log payload policy. Makes non-finite and out-of-column-range computations unknown, never zero or invalid writes. Reads the assigning record through git-safe at the resolved head, quotes the assigning sentence and verifies that the record existed at the merge-base and stayed unchanged throughout the range, with no local modification in local-worktree mode. Reports qualifying later work once under Output item 3 as stack prerequisite -> the cited amendment path; it is not a finding and does not count toward this component's verdict, and it requires later-component and synced-stack rechecks. An unreadable, missing, non-assigning or in-range-added or modified record does not grant the exemption; preserves stop-on-failed-read behavior. An amendment added inside the reviewed range assigning the fix of a current-component confirmed HIGH defect leaves a normal HIGH finding and verdict block. Unassigned omissions and current-component defects retain normal finding treatment. Searches uncommitted consumers too in local-worktree mode. With no frozen outcome definition, uses the actual documented and implemented contract; with an unavailable receiver validator, discloses the unreviewed boundary and does not claim validation. Reports ineffective tests, including a Jest sandbox listener that never receives the event, and requires runner failure evidence. Records incomplete passes under unreviewed scope and keeps the existing finding format and Output sections."
}
```

```json
{
  "id": 23,
  "name": "recorded-drift-living-doc",
  "prompt": "Synchronize documentation for this reviewed range, including the drift recorded in its frozen plan.",
  "files": [
    "In-range frozen plan recording stale design-doc, runbook and README statements",
    "Current code establishing the actual behavior",
    "Variant where the frozen drift statement disagrees with current code",
    "Variants requiring an agent-definition edit, an environment-file edit or a managed-marker change",
    "Variant whose drift record is outside the reviewed range"
  ],
  "expected_output": "Updates the affected living documentation after checking current code and preserves the frozen record. Recorded drift is not a reason to leave a living doc stale. When the record disagrees with code, documents actual behavior without presenting a suspected bug as intended and records the discrepancy in TODO.md. Does not expand scope because of an out-of-range record. Cannot edit agent definitions, and cannot open or edit environment files; records repairs outside write scope in TODO.md without reading protected content. Preserves managed markers, the exact C12 no-fallback and checkout paragraphs, trusted checked-out-branch scope and documentation-only writes."
}
```

```json
{
  "id": 24,
  "name": "external-review-protected-range",
  "prompt": "Assess whether this external review tool may run on the requested range before it sends any content.",
  "files": [
    "Skill shipped default patterns and a trusted checkout's effective installed patterns and projectPatterns",
    "Installed managed patterns behind the shipped defaults",
    "Review CLI that builds its own Git diff and generated context",
    "Protected rename source, protected rename destination and deleted historical path variants",
    "Secret-shaped string in otherwise allowed outgoing content",
    "Absent, invalid and unreadable installed-policy variants",
    "Policy edited in the range to remove a trusted exclusion",
    "Trusted policy changed since checking",
    "Unresolved policy-coverage and unsupported-exclusion variants"
  ],
  "expected_output": "Uses the union of shipped defaults and the trusted installed policy, including projectPatterns, so older installed managed patterns cannot drop new shipped coverage. Establishes exclusions for both rename sides, historical paths and all generated context, then scans remaining outgoing content without exposing values. Refuses the tool on that range when policy is absent, invalid or unreadable, when coverage or scanning cannot be established, or when exclusions are unsupported. Does not trust a reviewed policy edit to shrink exclusions or treat a names-only check or git-safe local filtering as proof of the CLI payload. A trusted-policy change after checking invalidates the check; re-establishes exclusions and rescans the actual outgoing payload before transmission. A secret-shaped match prevents transmission until safely resolved. States that the guidance is reference-only, adds no wrapper or preflight, and does not override the canonical agents' external-transmission ban."
}
```

```json
{
  "id": 25,
  "name": "blocked-review-preamble",
  "prompt": "The built-in security-review preamble is blocked. Continue its review method without weakening the managed Git boundary.",
  "files": [
    "Built-in review preamble invoking raw git diff, git log or git show",
    "Trusted installed git-safe runtime and managed raw-Git hook",
    "Generated CLAUDE.md managed Claude block"
  ],
  "expected_output": "Applies the review method through git-safe without executing the blocked preamble, allow-listing raw git diff even with --name-only, or disabling the hook. Uses the term managed raw-Git hook. Describes the load failure as observed workflow evidence and leaves host behavior TO VERIFY. Preserves AGENTS.md, wrappers and user-level files."
}
```

```json
{
  "id": 26,
  "name": "review-rules-managed-update",
  "prompt": "Update v2 and rc.1 installations to the review rules candidate, preserve project customizations, and record test results accurately.",
  "files": [
    "V2 schema-2 and rc.1 schema-3 installation variants",
    "Unchanged and user-modified canonical agents, with existing reviewer.project.md",
    "Development rules with missing, equivalent, conflicting or stricter testing requirements",
    "No-code, never-generated, removed-by-user and ambiguous-missing development-rules variants",
    "Timing-sensitive red run with observed concurrent focused tests or acceptance",
    "Isolated passing and isolated failing reruns"
  ],
  "expected_output": "Uses the existing v2 baseline check and complete reviewed migration when applicable, without changing historical snapshots. Delivers canonical and Claude-template changes through managed drafts, explicit customization dispositions, required path approvals, bound diff and plan-hash approval. Leaves project-owned reviewer rules intact and reports kept old canonical files as incomplete updates. Treats the new testing and hygiene requirements as skill-template inputs even without code changes, adds only missing items through a reviewed merge, preserves equivalent or stricter text and asks about conflicts. Does not restore a removed file without asking; proposes a never-generated file only when code exists and asks when absence is ambiguous. Generates no context doc for an empty repo and preserves zero diff when requirements are already satisfied. Requires agents to run only touched specs and requires only one full-suite or acceptance run at a time. Records a red run and observable overlap, including focused tests, then counts the isolated rerun; an isolated red is a failure. Uses the same rule in acceptance evidence and does not invent load without observed overlap."
}
```

These are evaluation expectations, not evidence that an agent already followed the instructions.

**C13-16 - Exact pin and current-literal amendments**

Keep exact checks exact. Do not accept multiple candidate values or weaken byte checks.

In C11b:

| Item | Amendment |
|---|---|
| `CANDIDATE_VERSION` | Change to `3.0.0-rc.2`. |
| `SKILL_HEADING_LINES` | Use C13-14's exact heading. |
| `README_OPENING_LINES` | Use C13-14's exact seven lines. |
| `README_RELEASE_SECTION_LINES` | Change exactly the two current candidate tag occurrences. |
| `FAKE_NOTES` | Use the exact current fixture heading in C13-14. |
| `CHANGELOG_ENTRY_LINES` | Hold the exact new entry. Retain the old exact array separately as `RC1_CHANGELOG_ENTRY_LINES`. |
| `RELEASE_NOTES_LINES` / `RELEASE_NOTES_TEXT` | Hold the exact rc.2 notes. Retain old exact text separately as `RC1_RELEASE_NOTES_LINES` / `RC1_RELEASE_NOTES_TEXT`. |
| `ROLLBACK_TEXT` | Preserve as the historical rc.1 constant. Add `CURRENT_ROLLBACK_TEXT` with C13-13's normalized paragraph. |
| `Q6_TEXT` | Unchanged. Applies to current notes, embedded publication notes and migration section 1; also retain historical coverage. |
| `PAYLOAD_ABSENT` | Add `RELEASE-NOTES-3.0.0-rc.2.md`; retain the older exclusions. |
| Valid version matrix | Add rc.2 while retaining rc.1, final 3.0.0 and 4.2.1-rc.12. |
| Evaluation inventories | Move 21 to 26, with matching descriptions and uniqueness checks. |

Apply the release-note checks as follows:

- Current source notes, synthetic tagged notes and embedded publication notes use rc.2 exact text.
- Their Compatibility and rollback section contains unchanged Q6 and `CURRENT_ROLLBACK_TEXT`.
- Migration section 1 still contains Q6; section 5 contains `CURRENT_ROLLBACK_TEXT`.
- Preserved rc.1 notes contain the old exact text, old `ROLLBACK_TEXT`, old Q6 and all six sections.
- Current and historical notes retain their exact respective pending-host wording.
- Current verification retains `No rc.1 case may skip.` and the exact totals/junction requirement.
- The Q6 limitation check at c11b:1895 continues to apply to current notes.
- The old rc.1 notes remain independently pinned, rather than ceasing to be checked.

Change changelog composition from current-entry-plus-v2-suffix to:

```text
# Changelog

<exact rc.2 entry>

<exact preserved rc.1 entry>

<unchanged suffix beginning ## 2.0.0>
```

The current-candidate literal audit found these additional current assertions and labels:

| Source location before C13 | Required treatment |
|---|---|
| `tests/c11b.test.mjs:1388` | Describe the expanded valid-version matrix, including rc.2. |
| `tests/c11b.test.mjs:1606` | Source-notes label becomes rc.2. |
| `tests/c11b.test.mjs:2400` | Current VERSION step description becomes rc.2. |
| `tests/c11b.test.mjs:2402` | VERSION assertion label becomes rc.2. |
| `tests/c11b.test.mjs:2403` | Current source-notes existence label becomes rc.2. |
| `tests/c11b.test.mjs:2413` | Exact current-notes assertion label becomes rc.2. |
| `tests/c11b.test.mjs:2427` | Candidate-entry split becomes rc.2; separately require exactly one historical rc.1 entry. |
| `tests/c11b.test.mjs:2429` | Current SKILL heading step description becomes rc.2. |
| `tests/c11b.test.mjs:2433` | Current SKILL heading assertion label becomes rc.2. |
| `tests/c11b.test.mjs:2465` | Inline later-build command fence uses `project-setup-v3.0.0-rc.2`. |
| `tests/c12.test.mjs:2170` | Current VERSION step description names C13's rc.2 amendment. |
| `tests/c12.test.mjs:2172` | Current VERSION assertion and label become exactly rc.2 plus LF. |

Do not mechanically replace every rc.1 occurrence:

- Keep c11b:916's parser input and expected tag unchanged.
- Keep malformed parser bytes at c11b:1392 and :1394 unchanged.
- Keep `WORLD_TAG` and other `c11b-fixture-rc1` synthetic-tag uses unchanged.
- Keep the valid rc.1 version case.
- Keep live acceptance section text and assertions at c11b:2467 onward unchanged.
- Keep historical comments identifying C11b/C12 work; annotate current amendments where needed.
- Keep c12:226's schema-3 rc.1 manifest fixture unchanged.
- Keep C12's historical `CHANGELOG_ORIGINAL`, `NOTES_CHANGES_ORIGINAL`, `NOTES_PRESERVED`,
  rc.1 entry extraction and rc.1 note-file reads unchanged.
- Keep C12's eight-bullet historical notes check directed at the rc.1 file.
- Keep old release-note filename exclusions.

Pins that do not move:

- `PINS.installer`, `PINS.notes200`, `PINS.changelogSuffix`.
- `PINS.skillWithOldHeading`: restoring the old heading still produces the same body.
- `PINS.readmeTopRest`: the opening is excluded from that pin's covered content.
- Every `PINS.readmeSections` digest.
- All six baseline-checker digests.
- Existing wrapper pins and runtime catalog identities.
- Evaluation-prefix pins and exact objects 1-21.

`PAYLOAD_INVENTORY` remains exactly 60 files. The new notes are excluded by the existing installer
allowlist. Current asset contents change; payload membership does not.

C8 changes only its evaluation count and `TEXT.rollback1`.
C9 changes only its evaluation count.
C12 changes only current VERSION checks/descriptions, the registry tail to include C13, evaluation
inventory counts/descriptions, and explanatory comments needed for those amendments.

Round-4 wording changes are absorbed into C13's independent expectations and the exact current
release-note constant. They require no additional historical pin movement.

**C13-17 - C13 test groups and assertions**

Add eight ordered descriptors:

| ID | Name |
|---|---|
| `A5-templates/C13/reviewer` | review passes cover reachable defects beyond the plan |
| `A5-templates/C13/docs-sync` | recorded drift requires living documentation updates |
| `A5-templates/C13/external-review` | external review requires exclusion and content scanning |
| `A5-templates/C13/claude` | blocked review preambles retain the managed Git boundary |
| `A5-templates/C13/development-rules` | generated rules require contract coverage and serial full suites |
| `V2/C13/update` | managed updates deliver rules without replacing project customizations |
| `RC1/C13/release` | rc2 bookkeeping preserves historical and payload identities |
| `V2/C13/contracts` | C13 registration and evaluation contracts are exact |

Freeze independent test-owned expectations from C13-4 through C13-14. Do not generate expected
wording by copying the source under test.

For prose checks, normalize whitespace consistently with existing tests. Release bytes retain
the stricter byte rules in C13-14. Negative controls operate on in-memory text; they do not edit
production files.

Reviewer assertions:

- Source and rendered reviewer contain all four named passes.
- Case-insensitive detection finds both protocol pass names.
- All three named adversarial classes and the database class survive rendering.
- `beyond plan` and `Fix the class, not the instance` survive rendering.
- Reachability and the absent-plan exception remain explicit.
- Every adversarial input category is present.
- Consumer enumeration includes messages, documented throws, reports, summaries and docs.
- Deadline entry, monotonic clock, per-unit checks and remaining-budget timers are all required.
- Detached promises are covered in dimension 8 only.
- Contract coverage includes absent, inconsistent-present and boundary cases.
- The scoped Jest example requires runner failure and concrete evidence.
- Capture wording includes bounded named fields, nested/inherited getters, every path, no generic
  deep walk and the stable parsed-JSON control.
- Per-item isolation includes logging, shared-state restoration and healthy siblings.
- Stack prerequisites include the exact label, explicit frozen ownership, once-only reporting,
  current-component guard, later/synced rechecks and unchanged Output structure.
- Fallback checks require the real validator and a test using it.
- Enum/outcome meanings are checked against the frozen contract.
- Log classification includes trusted allowlist, code-owned constants, fixed fallback, prohibition
  on untrusted fields and the explicit payload-policy limitation.
- Overflow includes all five computed categories, non-finite and column-range failures, unknown,
  no zero substitution and no invalid write.
- Removing each mandatory clause causes its assertion to fail.
- In-memory variants that remove a guard or substitute its opposite are rejected.
- Existing headings, dimensions, Output items, FRESH_PATHS and forbidden-phrase checks still pass.

Additional round-4 reviewer assertions:

- The assigning record must be read with git-safe at the resolved head.
- The assigning sentence must be quoted.
- The record must exist at the resolved merge-base and remain unchanged throughout the range.
- Local modifications also prevent the prerequisite exemption.
- Unreadable, missing, non-assigning, in-range-added and in-range-modified records retain normal
  finding treatment; failed reads retain the existing stop rule.
- The effect uses the reviewer's vocabulary: not a finding, excluded from this component's verdict.
- A current-component confirmed HIGH defect with an amendment added in-range remains HIGH and
  produces `block`; it is not moved into the prerequisite list.
- Removing the read, quotation, merge-base or unchanged-range requirement independently fails
  its text assertion.
- Local-worktree consumer searches include uncommitted consumers.
- Both missing-contract and unavailable-validator clauses reside inside the rendered Boundary
  pass, not only in plan commentary.
- The unavailable-validator clause cannot be satisfied by a claim that a mock proves validation.

Docs-sync assertions:

- Mapping row and recorded-drift rule are mandatory.
- Current code remains authoritative; contradicted records produce TODO follow-up.
- Out-of-range records do not expand the rule.
- Agent editing, environment opening/editing and marker changes remain forbidden.
- The exact C12 paragraphs and stdout sentence remain.
- No prohibited launcher or review-lane wording appears.

External-review assertions:

- Require the shipped-plus-installed union, including projectPatterns.
- Require both rename names, historical/deleted paths and generated context coverage.
- Require the remaining-content scan without value exposure.
- Require refusal for absent, invalid and unreadable installed policy.
- Require refusal for unsupported exclusion, unknown coverage and incomplete scan.
- A policy edited in range cannot shrink trusted exclusions.
- An installed policy behind shipped defaults cannot omit shipped coverage.
- Negative controls remove shipped coverage, projectPatterns, either rename side, the absent-policy
  refusal, the invalid-policy refusal or the edited-policy guard; each must fail.
- No test claims to prove an external CLI's actual payload or to supply a preflight implementation.
- A trusted-policy change after checking invalidates that check.
- Exclusions must be re-established and the actual payload rescanned before transmission.
- Independent negative controls omit invalidation, re-establishment or rescanning; each must fail.

Claude assertions:

- Exact template bullet is inside the existing managed block.
- No new managed markers, AGENTS change or wrapper change.
- Reference wording uses the hook mechanism, prohibits names-only allow-listing and preserves
  observed-versus-host-verified distinction.
- The full frozen reference paragraph in C13-11 is required, not merely a set of keywords.

Development-rules assertions:

- The row identifies project-setup requirements as a template input.
- An update without application changes still proposes missing requirements.
- Equivalent/stricter text is preserved; conflicts require a decision.
- Removed files are not silently recreated; ambiguous absence requires a question.
- Never-generated files are proposed only when code exists.
- Empty repositories get no context docs.
- Already-satisfied requirements produce zero diff.
- Loaded includes observable focused-test and acceptance overlap.
- The red run is retained, the isolated result counts, and isolated red fails.
- Missing overlap evidence does not excuse failure.
- Both hygiene obligations retain MUST: touched specs and a single full-suite or acceptance run.
- Removing either MUST or omitting acceptance runs from serialization fails its assertion.

Release assertions cover the exact text, pin partition and current-literal inventory in C13-16.

Also assert ASCII and the 100-column limit for new prose, including release-note prose.
Exclude tables, actual code and expressly preserved pre-existing pinned text from that check.
Do not use a blanket text-fence exemption for newly written prose.

These tests establish instruction and workflow contracts. They do not simulate a backend and
claim to prove that a future reviewer catches every corresponding bug.

**C13-18 - Update fixtures, registration and counts**

Add a test-only rc.1 agent fixture with:

- `schema: 1`
- `skillVersion: "3.0.0-rc.1"`
- `sourceCommit: "8b9b4772fdde9e869dd2c39c8943c307ddb41740"`
- Ordered entries for `assets/agents/reviewer.md` and `assets/agents/docs-sync.md`.
- Each entry contains its path, base64-encoded original bytes and raw SHA-256.

Pin the decoded fixture bytes to these inspected pre-C13 values:

| File | Raw SHA-256 |
|---|---|
| reviewer.md | `6a0bea8db90c18857cb8850f640848fee5bbb63cda34dbc9b641b5eaef3aa50b` |
| docs-sync.md | `54217f5ecc81c2e048b52ea8458d598a35129ec74dbf6aadea70462287fac458` |

This is comparison data for C13 tests, not a new runtime baseline authority.

Exercise unchanged and edited rc.1 canonical files through the existing reviewed apply workflow.
Verify required user-content approval, bound-input drift refusal, approved update, rollback,
project-rule preservation and no-op rerun. Keep tests within `context.tmp`.

Reuse existing C8 v2 migration coverage: its `v3Agent` rendering uses the current assets.
Do not change v2 snapshots to make the comparison pass or duplicate the entire v2 installation
suite inside C13.

Development-rule generation remains an agent instruction workflow. Test its required instructions
and review/apply behavior; do not invent a production generator to make it executable.

Export only `C13_IMPLEMENTATIONS`. Register independently written matching descriptors in
rc1-cases.mjs. Append C13 after C12 in both registries.

Aggregate C13 exactly once inside R29, after C12 and before R30, using:

```javascript
{ repository: path.resolve(SKILL, '..'), skillRoot: SKILL, tmp: path.join(TMP, 'c13'), env: { ...ENV } }
```

Use the existing component memo and check the complete C13 report. The aggregation segment
contains no `console.log`, `stdout.write` or `PASS  ` text, including comments.

Preserve these counts and meanings:

| Inventory | Result |
|---|---|
| C13 descriptors | 8 |
| Complete rc.1-named cases | 40 |
| Required full-suite results | 100 |
| Evaluations | 26 |
| Installed payload members | 60 |
| Runtime unit members | 7 |

`CASE_REQUIREMENTS`, numbered IDs and complete-case composition remain unchanged.
C13 contributes through R29, not through new numbered records.

Imports and registration execute no tests, launch no processes and write no files. Production
imports are lazy. Missing implementations, empty assertions and skips cannot pass. Component
results retain `{ failures, skipped: null }`.

Target at most 100 harness-counted child launches and 120 seconds for C13 on the comparable
acceptance host. Record method, elapsed time and any overrun cause. This target does not permit
skipped coverage or changed acceptance timeouts.

**C13-19 - Boundary pass against frozen C12**

Read both the frozen C12 plan and its decisions file. Decisions override the original C12 plan
where they differ. The following boundary remains explicit:

| C12 value or contract | C13 treatment |
|---|---|
| Shipped-plus-installed never-read boundary | External-review prerequisites use the same union, including projectPatterns. |
| Effective installed policy | Still means installed patterns plus projectPatterns; C13 does not redefine rendered controls. |
| Absent installed policy | Fresh setup retains its existing path; external submission separately refuses without established installed-policy coverage. |
| Invalid/unreadable policy | Remains an error, never inferred absence. C12 plan:68 is the relevant source. |
| Behind/unknown/edited managed policy triggers | Remain reviewed migration triggers; no default replacement. |
| `full` versus `keys` ownership | Unchanged. No policy draft is added by C13. |
| Protected path aliases | All I12-2, I12-2a, I12-2b and I12-4 behavior remains unchanged. |
| Bound policy bytes or absence | I12-3's `APPLY_DRIFT`, exit 4, remains unchanged. |
| Missing runtime source/catalog handling | I12-4's validated target list and fail-closed alias behavior remain unchanged. |
| Seven runtime members and hook identity | Unchanged bytes, membership, ordering and identity. |
| Hash meanings | Raw backup/fixture hash, normalized payload hash, ZIP SHA-256 and Git tree remain distinct. |
| Docs-sync no-fallback and checkout paragraphs | Preserved exactly; drift handling grants no broader write or read authority. |
| Self-test versus doctor | Validation runs the self-test; doctor does not. All failure criteria and host limits remain. |
| Current VERSION | C13 expressly advances current rc.1 to rc.2; historic rc.1 references keep their historical meaning. |
| Current rollback wording | Version-neutral wording preserves project-first, newest-first rollback with update-compatible tooling. |
| Historical rollback wording | Old notes, changelog, plans and their assertions remain unchanged. |
| I12-1 exact expectations | C13 freezes its new literals in advance; no unknown second-pass value remains. |
| C11b section and suffix pins | Unchanged covered content; the new entry is separated from historical rc.1 and v2 suffix checks. |
| C12 evaluation 21 | Unchanged exact object; appended evaluations do not redefine it. |
| 40 cases / 100 results | Unchanged. C13 aggregates under R29. |
| Pending host measurements | Remain pending; no instruction test becomes host proof. |
| Acceptance timeout | Remains 1,800,000 ms. |
| Historical C12 execution budget/evidence | Not rewritten or reused as C13 results. |
| Frozen plan authority | New stack-prerequisite labels require an explicit frozen assignment and do not rewrite history. |

No C12 apply refusal, exit code, report envelope, approval, metadata field, alias handling or
runtime identity changes.

The round-4 boundary recheck adds these explicit confirmations:

- External-review invalidation on a trusted-policy change does not replace or weaken I12-3's
  bound-policy checks. It is an instruction prerequisite for a different operation.
- The stack assignment is verified at resolved head and merge-base through git-safe. It grants no
  authority to read protected paths, bypass a refused read or trust an amendment in the diff.
- Local-worktree searches retain the existing review mode and permitted local-read boundary.
  They do not substitute local files for another person's committed-head review.
- Mandatory test serialization changes instructions, not runner formats, counts or timeout.
- The shortened release bullet changes no compatibility, rollback or host-evidence meaning.
- The Boundary pass's absent-contract and unavailable-validator clauses keep unknown evidence
  unknown; they introduce no fallback implementation or acceptance exception.

**C13-20 - Edge cases and failure modes**

Acceptance must cover or explicitly preserve these distinctions:

- No supplied plan: normal reachable findings, without `beyond plan`.
- Passing plan tests: still inspect adversarial inputs and documented contracts.
- Missing row versus partial row versus inconsistent sibling source.
- Evaluated zero versus unreadable or non-evaluable count/state.
- Impossible dates, reversed bounds and out-of-pattern names.
- Captured getter values versus changed, missing or throwing second reads.
- Nested and inherited getters versus stable plain parsed JSON.
- Bounded named projections versus arbitrary deep traversal.
- Logger or renderer failure before cleanup and inside fallback loops.
- One failed item versus healthy siblings and stuck shared state.
- Entry-time deadline versus wall-clock or preparation-excluding deadlines.
- Original promise rejection versus rejection of the promise returned by finally/then.
- Invalid row versus whole-batch failure; actual column range versus JavaScript numeric range.
- Non-finite computed output versus explicit contract-compatible unknown.
- Fallback accepted by a mock versus rejected by the real downstream validator.
- Reused outcome hiding failure from health consumers.
- Trusted class label versus untrusted thrown-object fields.
- Assigned later work versus unassigned omissions and current-component defects.
- Real runner failure versus a sandbox listener that cannot observe it.
- Complete consumer enumeration versus narrowed or refused reads.
- Recorded drift versus verified current behavior, including forbidden repairs.
- Trusted policy versus a policy edited in the review range.
- Old installed defaults versus newer shipped protections.
- Protected rename source, destination and historical deletion.
- Allowed filename containing secret-shaped content.
- Unchanged, modified, removed, absent and unreadable installed instruction files.
- Missing, equivalent, conflicting and stricter development rules.
- Observed concurrent focused tests versus an unsupported assertion of machine load.
- Recorded loaded failure versus the counting isolated rerun.
- Read and quoted frozen assignment versus an unverified path citation.
- Assignment present at merge-base versus one added, modified or modified-and-reverted in-range.
- A local modification to an otherwise eligible assigning record.
- A current HIGH defect reassigned by its own diff versus genuinely preassigned later work.
- Resolved-head consumers versus uncommitted consumers in local-worktree mode.
- Policy unchanged since checking versus a trusted-policy change invalidating the check.
- A missing outcome definition versus permission to invent one.
- An unavailable real validator versus a claim of proven fallback acceptance.
- One serialized full-suite or acceptance run versus overlapping full-suite and acceptance runs.

A failed or incomplete check is not silently converted into success, zero, absence, a skipped
component or a weaker pin.

**C13-21 - Runnable acceptance and evidence**

The writable tests/acceptance lane runs these commands from the repository root, serially:

```text
node project-setup/tests/run-component-tests.mjs --component C13
node project-setup/tests/run-component-tests.mjs --component C8
node project-setup/tests/run-component-tests.mjs --component C9
node project-setup/tests/run-component-tests.mjs --component C10
node project-setup/tests/run-component-tests.mjs --component C11a
node project-setup/tests/run-component-tests.mjs --component C11b
node project-setup/tests/run-component-tests.mjs --component C12
node project-setup/tests/run-tests.mjs --keep
node project-setup/tests/accept-rc1.mjs
npm run check
```

Required results:

- C13: `8 PASS / 0 FAIL / 0 SKIP`, exit 0 and retained RESULTS evidence.
- Every listed earlier component: no failures or skips.
- Full suite and acceptance: 100 required results, no missing or duplicate records.
- Either `100 PASS / 0 FAIL / 0 SKIP`, or the existing Windows R13d exception yielding
  `99 PASS / 0 FAIL / 1 SKIP`.
- No rc.1 complete case may skip; R91 keeps real Windows junction coverage.
- The acceptance runner reports its existing successful acceptance record and retained
  RESULTS/EVIDENCE paths.
- `npm run check` succeeds without unrelated formatting or version-stamp changes.

The rendered reviewer must contain:

```text
Adversarial pass
Contract pass
Consumer pass
Boundary pass
zero is not unknown
a throwing logger is an input
read once, validate the capture
one bad row poisons the batch
beyond plan
Fix the class, not the instance
stack prerequisite
```

Its rendered text must also retain all B1-B6 guards, including bounded projection, per-item
isolation, frozen ownership, real-validator tests, outcome meaning, trusted log classification
and computed overflow.

Rendered docs-sync must contain the recorded-drift rule and preserve C12's exact paragraphs.

Round-4 acceptance additionally requires:

- The installed prerequisite guard contains the read, quote, merge-base and unchanged-range
  obligations and uses the existing reviewer's finding/verdict vocabulary.
- The in-range amendment control leaves the confirmed HIGH finding and `block` verdict intact.
- The rendered Boundary pass includes both missing-evidence clauses.
- The local-worktree clause includes uncommitted consumers.
- The security reference invalidates checks after trusted-policy changes and requires rescanning.
- The full frozen Claude reference paragraph is present.
- Both mandatory hygiene clauses are present.
- New prose satisfies ASCII and 100-column constraints without rewriting historical pinned text.

The acceptance record includes:

- Tested commit/tree and any uncommitted delta.
- Date, platform, Node/Git versions and exact commands.
- Exit codes, totals, elapsed times and evidence paths.
- C13 process-count method and budget result.
- Allowed skip evidence, if applicable.
- Any loaded red run, observed overlapping test/acceptance process and isolated rerun.
- The isolated rerun as the counting result; isolated red remains failure.
- Pending host measurements as pending.
- The reference-only external-review limitation.
- A statement that static instruction tests and evaluation objects do not prove agent behavior.

Do not increase the acceptance timeout or weaken composition to accommodate C13.
The release builder exercised by existing synthetic acceptance is not a real release action.

**C13-22 - Rollback and completion**

Repository rollback is a revert of the C13 commits. C13 introduces no migration or schema change.

For a project already updated, use the existing rollback workflow with the tooling used for the
update before reverting that skill installation. Roll independent runs back newest first.
Preserve later user edits and unresolved backups under the existing recovery rules.

Completion requires the scoped implementation, exact tests and literals, successful runnable
acceptance, retained evidence and review against this frozen plan. It does not authorize tagging,
publication or user-level configuration changes.
