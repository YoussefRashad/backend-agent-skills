# C2 implement-lane decisions (maintainer, 2026-10-17)

The C2 implement lane stopped on a conflict between two frozen plans, and the orchestrator's
check of the draft-review code found one gap against the C2 plan. The maintainer decided both.
These records amend the frozen plans named below without editing them; where a record and a
frozen plan differ, the record wins.

## I2-1. `schemas.mjs` may import `ownership.mjs`

Conflict: docs/plans/2026-10-17-project-setup-v3-rc1-c2.md section 2.1 says `checkManifest`
(in `scripts/schemas.mjs`) calls `readManifest` (in `scripts/ownership.mjs`), while
docs/plans/2026-10-16-project-setup-v3-rc1-c1.md section 2.4 says "`schemas.mjs` imports no
other relative module". The C1 tests enforce the C1 rule, so C1 fails (11/1/0) and R17 with it.

Decision: the C1 rule is widened to exactly two relative imports, in this order:

```javascript
import { readSecurityPolicy } from '../assets/tools/security-policy.mjs';
import { readManifest } from './ownership.mjs';
```

The rule's purpose is unchanged: `schemas.mjs` keeps a small, known dependency surface, so the
classification test can stub the policy module. The tests lane updates `tests/c1.test.mjs`:

- step "2.4 schemas.mjs imports the shared reader exactly and no other relative module": the
  relative-import set must equal exactly `['../assets/tools/security-policy.mjs',
  './ownership.mjs']`;
- step "4.5 classification": the scratch copy also copies the real `scripts/ownership.mjs`, and
  the stub `assets/tools/security-policy.mjs` also exports `policyEntryKey` and
  `validateRepoPath` (not called by this step). Every assertion of the step is unchanged.

Rejected: a second manifest validator inside `schemas.mjs`. It would duplicate `readManifest`
and could drift from it, and it would still need C1 exports the stub does not provide.

## I2-2. A prepared review re-applies the refusal checks before reading

Gap: with `plan.json` present, `apply.mjs diff` rechecks bindings, but the bindings come from
the plan itself, and diff knows no approved hash (section 6.3). An agent that can write
`.ai/.run/<id>/plan.json` could add an op for `.env` with its current hash and have diff print
the file as text. Section 6.2 requires the refusal checks before any target or draft body read;
the unprepared review applies them, the prepared review did not. Commit is not affected: it
compares the plan with the externally approved hash.

Decision: before reading any target or draft body, the prepared review applies to every plan op
the same per-target checks as the unprepared review, with the same codes, exits and F envelope
as section 7.9's diff column: run-chain and path safety (APPLY_PATH / 2), the common refusal
set, shipped spec plus installed policy (APPLY_SECRET_TARGET / 3, text
`refusing textual diff of secret target: <target>`), write scope and write denial
(APPLY_WRITE_SCOPE / 3, APPLY_WRITE_DENIED / 3), vault eligibility (APPLY_VAULT_TARGET / 3) and
the drafted-manifest refusal (APPLY_MANIFEST_DRAFT / 3). The first refusal in target order is
reported. Nothing is printed on stdout and no target body is read.

The tests lane adds one case to `R02/C2/diff-safety`: after a valid prepare, a draft source for
`.env` is added and `plan.json` is rewritten with an extra op for `.env` (a fixture file with a
known marker value), with every binding made consistent (its `sourceInventory` entry, its
source hash, its `preRawSha` and the matching `inputs` entry), so that only the refusal check
can stop it. Diff exits 3 with
APPLY_SECRET_TARGET and the exact text above, its output does not contain the marker, and the
read-recording preload shows `.env` was never read.

## Review round 1 (Codex, 2026-10-17): I2-3 to I2-7

The C2 review (review lane, effort xhigh) reported four BLOCKING findings, C2-R1 to C2-R4. The
maintainer decided them as follows.

### I2-3. Combination checks may follow body reads (C2-R3, accepted)

Section 6.2 lists "Validate request shapes and combinations" before target and draft body
reads. The implementation validates request shapes first and the section-4.1 combination table
after the body reads. Accepted as written: every body read happens only after path safety, the
secret refusal set, write scope and vault eligibility have passed, so the files read are ones
the run may already write. Moving the combination checks would restructure `analyze()` for no
protection gain. No test change.

### I2-4. Plan inputs are checked before they are hashed (C2-R1)

`loadPlan`, shared by diff and commit, rejects a plan before any binding is hashed unless every
`inputs` entry is one of: a content-op target, a file-metadata-op target, the installed project
policy `.ai/security-paths.json`, or a path that passes the section-4.1 rules for declared
transaction inputs (structurally valid, within the write scope, not write-denied, not in the
refusal set, not under `.ai/.run` or `.ai/.setup.lock`). Any other entry, including one that
names a secret path, gives `APPLY_PLAN_INVALID`, exit 1, text
`invalid prepared plan; run prepare again`, and no target body or input is read.

### I2-5. Plan validation covers metadata values and mandatory bindings (C2-R2)

`loadPlan` also rejects with the same `APPLY_PLAN_INVALID` / 1 / text, before any heartbeat,
journal or body read, when:

- an embedded metadata request value fails the shared reader for its file (the readers prepare
  uses on `ownership.json`, `managed-keys.json`, `omissions.json`, `manifest-metadata.json` and
  `transaction-inputs.json`);
- `inputs` holds a duplicate target;
- a content-op target or a file-metadata-op target has no `inputs` entry;
- a content op's `preRawSha` differs from its `inputs` entry's `preRawSha`.

### I2-6. Enumeration and stat failures use the IO envelopes (C2-R4)

A filesystem failure other than an unsafe path while enumerating the run, its drafts or vault, or
while stat-ing a target or source, is reported like an unreadable body, with an empty stderr:
diff `APPLY_DIFF_IO` / 2 / F, `cannot read draft review input: <path>`; prepare
`APPLY_INPUT_IO` / 3 / P, `cannot read transaction input: <path>`; commit `APPLY_INPUT_IO` / 2 /
F with the same text, before any journal. `<path>` is project-relative (judgment call f).
Unsafe paths keep their immediate `APPLY_PATH` / 2 handling.

### I2-7. Added coverage

The tests lane adds steps to the existing C2 assertions (no new assertion IDs):

- `R80/C2/input-binding`: (a) a prepared plan whose only change is an extra `inputs` entry for
  `.env` (marker fixture): diff and commit (with `--approved-plan` set to that plan's hash) both
  give `APPLY_PLAN_INVALID` / 1, nothing is written, and the read-recording preload shows `.env`
  was never read; (b) one case each for the four I2-5 conditions, through diff and commit,
  including `metadata.managedKeys` set to `7`.
- `R02/C2/diff-safety`: an injected `EACCES` from `readdirSync` on the drafts directory and from
  `lstatSync` on a target, through diff, prepare and commit, with the I2-6 codes, exits and
  texts and an empty stderr.
- `R86/C2/metadata-only`: D1 on managed hook lists (append needs no approval; replacement,
  removal and reordering need it, with the reason
  `settings ownership or managed metadata changes`); C2-P3-2 for an unchanged, unrecorded
  `.ai/security-paths.json` given `keys` and complete managed metadata (one file op,
  `before: null`, `requiresApproval: true`, reason
  `policy ownership or managed metadata changes`, and `APPLY_APPROVAL_REQUIRED` without the
  path approval).

Not added, as narrow subcases of already covered categories: schema-1 managed entries without an
explicit anchor, installed-policy appearance and deletion, invalid prior manifests through
`apply.mjs`, and unreadable bound targets during a prepared review.

## Review round 2 (Codex, 2026-10-17): I2-8 and I2-9

The re-review confirmed C2-R4 fixed and the I2-5 cases covered, and reported two BLOCKING
findings next to C2-R1 and C2-R2. This was the second fix/review loop; the maintainer chose one
more narrow loop, limited to these two findings.

### I2-8. A file metadata op must have a role prepare can produce (C2-R5)

`validBindings` exempted every file-metadata-op target from the declared-input rules, so a
forged `metadataOps` entry `{ kind: "file", target: ".env", ... }` plus an `inputs` entry for
`.env` let diff hash `.env` before reporting drift. Prepare emits a file metadata op only for a
target that is also a content op (`plan.ops`), or for one of the two control files
(`.ai/security-paths.json`, `.claude/settings.json`), which are the only metadata-only
ownership moves section 4.1 supports. `loadPlan` (diff and commit) therefore rejects, with
`APPLY_PLAN_INVALID` / 1 / `invalid prepared plan; run prepare again` and before any binding is
hashed, a plan with a file metadata op whose target is neither a `plan.ops` target nor a control
file. Content-op targets stay covered by the prepared review's per-target refusal checks (I2-2).

### I2-9. Plan inputs are exactly the set prepare binds (C2-R6)

Prepare binds exactly: every `plan.ops` target, every file-metadata-op target, the installed
policy `.ai/security-paths.json` (always, also when absent), and every entry of
`metadata.transactionInputs` except `.ai/manifest.json` (bound by `manifestPreRawSha`).
`loadPlan` (diff and commit) rejects with the same `APPLY_PLAN_INVALID` / 1 / text, before any
binding is hashed, a plan whose set of `inputs` targets differs from that set in either
direction: a missing declared-input or policy binding, or an extra entry. This replaces the
last clause of I2-4 ("or a path that passes the section-4.1 rules for declared transaction
inputs"); the duplicate, content-target and `preRawSha` checks of I2-5 stay.

### Tests for I2-8 and I2-9

The tests lane adds steps to `R80/C2/input-binding` (no new assertion IDs). Each case starts
from a valid prepared plan with work, changes only what it names, and runs diff and commit
(with `--approved-plan` set to the modified plan's hash). Each gives `APPLY_PLAN_INVALID` / 1
and writes nothing; where a secret marker is involved, the read-recording preload shows `.env`
was never read:

- I2-8: a forged file metadata op for `.env` (marker fixture) plus a matching `inputs` entry;
  a forged file metadata op for an in-scope documentation path that is neither a content target
  nor a control file, plus a matching `inputs` entry.
- I2-9: a plan declaring a transaction input with that input's `inputs` entry removed; a plan
  with the installed-policy entry removed; a plan with one extra `inputs` entry for an in-scope
  documentation path that is not declared.
