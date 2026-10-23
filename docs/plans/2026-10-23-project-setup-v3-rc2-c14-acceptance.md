# project-setup 3.0.0-rc.2 acceptance record for C14

Recorded evidence of the writable acceptance run required by C14-21 of
`docs/plans/2026-10-23-project-setup-v3-rc2-c14.md`, with the maintainer decisions recorded in that
plan: Q1 = yes (the external-review core is installed in the root AGENTS.md `critical-rules`
block) and Q2 = retain the `APPLY_METADATA_TARGET` refusal. There is no C14 decisions file: no
decision was taken after the freeze. This record states what was executed; it is not a test oracle.

The run used the uncommitted C14 implementation on top of `34483cd` (tree
`86cd01c74179616f78751db5b9335f51a66b5ba0`, the C14 tests commit, itself on the frozen plan commit
`1cf43c7`), the same bytes that were then committed together with this record. The uncommitted
delta is identified by two SHA-256 values taken before and after the run, equal both times
(nothing changed during the run):

```text
git diff 34483cd | sha256sum                                   8efde017f9e5f9715c7919e34038e7e744c536b7f6560a8270a74d9382692497
untracked files: git ls-files --others --exclude-standard
  | xargs -r sha256sum | sha256sum                             e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

The untracked digest is the digest of empty input: the implementation added no file.

Evidence paths are temporary directories on the recording host and are not retained elsewhere.

```text
Date: 2026-10-23, 14:13 to 15:09 host clock
Platform: win32 10.0.26100, no file-symlink privilege
Node: v24.14.1
Git: git version 2.53.0.windows.2
Commands, run serially from the repository root, one process at a time:
  node project-setup/tests/run-component-tests.mjs --component C14    exit 0  8 PASS / 0 FAIL / 0 SKIP   41 s
  node project-setup/tests/run-component-tests.mjs --component C13    exit 0  8 PASS / 0 FAIL / 0 SKIP   11 s
  node project-setup/tests/run-component-tests.mjs --component C8     exit 0  16 PASS / 0 FAIL / 0 SKIP  25 s
  node project-setup/tests/run-component-tests.mjs --component C9     exit 0  12 PASS / 0 FAIL / 0 SKIP  13 s
  node project-setup/tests/run-component-tests.mjs --component C10    exit 0  20 PASS / 0 FAIL / 0 SKIP  11 s
  node project-setup/tests/run-component-tests.mjs --component C11a   exit 0  8 PASS / 0 FAIL / 0 SKIP   225 s
  node project-setup/tests/run-component-tests.mjs --component C11b   exit 0  10 PASS / 0 FAIL / 0 SKIP  13 s
  node project-setup/tests/run-component-tests.mjs --component C12    exit 0  8 PASS / 0 FAIL / 0 SKIP   122 s
  node project-setup/tests/run-component-tests.mjs --component C1     exit 0  12 PASS / 0 FAIL / 0 SKIP  0 s
  node project-setup/tests/run-component-tests.mjs --component C2     exit 0  14 PASS / 0 FAIL / 0 SKIP  196 s
  node project-setup/tests/run-component-tests.mjs --component C3     exit 0  18 PASS / 0 FAIL / 0 SKIP  133 s
  node project-setup/tests/run-component-tests.mjs --component C4     exit 0  17 PASS / 0 FAIL / 0 SKIP  50 s
  node project-setup/tests/run-component-tests.mjs --component C5     exit 0  18 PASS / 0 FAIL / 0 SKIP  20 s
  node project-setup/tests/run-component-tests.mjs --component C6     exit 0  12 PASS / 0 FAIL / 0 SKIP  35 s
  node project-setup/tests/run-component-tests.mjs --component C7     exit 0  12 PASS / 0 FAIL / 0 SKIP  69 s
  node project-setup/tests/run-tests.mjs --keep                       exit 0  99 PASS / 0 FAIL / 1 SKIP  1203 s
  node project-setup/tests/accept-rc1.mjs                             exit 0  ACCEPT-RC1 PASS full       1189 s
  npm run check                                                       exit 0
C14 RESULTS: <tmp>\ps-component-GGgFBh\component-results.json
C14 component-results.json SHA-256: 95ec45222da4f34f17fca6a07b26ef8b47fae7451bec89714f030111e1bfa317
C13 RESULTS: <tmp>\ps-component-UNY38K\component-results.json
C13 component-results.json SHA-256: 5af72b4f704746066c426543d9ba6eb5d7d0a96105283937f93837ee0176a555
run-tests RESULTS: <tmp>\ps-tests-bJ0mtW\results.json
accept-rc1 RESULTS: <tmp>\ps-tests-LGM0NL\results.json
accept-rc1 results.json SHA-256: dd8979d152b8d21e5acd0b3ce34970dc13e93a46478b5ce2b85f2b7268ebe131
accept-rc1 EVIDENCE: <tmp>\ps-accept-rc1-vVDFVe
Pending host measurements:
  R83
  R44/R74 host enforcement
  R51 Claude continuation and stderr handling
  A3 trusted-checkout live review
  A5 host negative capability
```

The C13 `component-results.json` digest equals the C13 record: that file carries no timestamps or
paths, so it proves the outcome (eight PASS, the same descriptors) rather than the run, as does
the `results.json` digest, which equals the C11b, C12 and C13 records (100 required results, 99
PASS, 1 allowed skip). The delta digests above identify the tested bytes.

The only skip record, in both the suite and the acceptance run, was exactly:

```text
SKIP  R13d  a pre-placed backup leaf symlink is never written through  (cannot create file symlink (Windows without Developer Mode))
```

No rc.1 complete case skipped; R91 ran with real Windows junction coverage. C14 records no skip:
its linked-leaf variant cannot be created on this host and is neither run nor counted as
measured (a diagnostic line only); its directory-junction parent coverage runs.

## C14 process count and budget

Counting method: every `spawnSync` launch made by `tests/c14.test.mjs`, from the component's
`c14-diagnostics.log`. Total 176 launches (ownership 68, adopt 26, external-review 18, update 43,
path-boundaries 20, contracts 1, docs-sync 0, release 0), 42 s since the first group, within the
plan's targets of at most 180 launches and 120 s. The amended C13 component made 66 launches in
11 s, unchanged from its own record. Full acceptance took 1189 s against the unchanged
1,800,000 ms timeout.

## Loaded runs

None. Every command above ran alone; no lane, review or other test process was running (the
implement lane finished before the first command; the Codex review was dispatched after the last).
There was no red run, so no isolated rerun was needed.

## Earlier runs on the way (not the evidence of record)

- Before implementation, on the committed tests at `34483cd`: C14 1 PASS / 7 FAIL, C13 3 / 5,
  C11b 7 / 3, each failure an amendment not yet present; C8, C9, C10, C11a and C12 green.
- The implement lane's own component runs (C1-C14, all green) and `npm run check`.

## Preservation evidence

The C14 and amended C13 components assert, and passed: C12's docs-sync no-fallback and checkout
paragraphs and C13's recorded-drift paragraphs and mapping row unchanged; the canonical reviewer
unchanged; the historical C13 values (the SKILL pin `e5a0acab...` after reversing amendment S, the
rc.1 fixture bytes, the pre-C13 baselines after reversing only the exact C14 amendments) intact;
the v2 baselines under `data/v2.0.0`, their checker digests and the payload (60) and runtime (7)
memberships unchanged. Installed-extension ownership, update and rollback behavior were exercised
through the real apply and validate code in `V2/C14/update`, `A5-templates/C14/ownership` and
`V2/C14/path-boundaries` (creation with a merged request, approved append in LF, CRLF and
no-final-newline files, the retained `APPLY_METADATA_TARGET` refusal, drift refusal, rollback that
removes only an unchanged created file and keeps later edits, zero-diff rerun).

## Review of record

Codex review lane (xhigh), one round: "No findings." Every named amendment (H, M, D1-D3, V, S,
O1-O2, B, A, E, L, N, T) matched the frozen plan byte for byte at its anchor; the C13 boundary,
including the split between the current C11b SKILL pin `16a836b7...` and the historical C13 pin
`e5a0acab...`, was found consistent; no plan edge case without a covering test was identified.

## Test-owned readings (tests lane, recorded here)

- `evals/evals.json` was treated as tests-owned, as for C13 (I13-3); the plan lists the file
  without naming its owner.
- Pins the plan does not give were taken from the pre-C14 tree or C13's expectations: the
  canonical reviewer and wrapper hashes, the root TODO.md raw digest used by the T reversal, the
  C13 acceptance record digest, and the digests of evaluations 22, 23, 25, 26 and the old 24.
- The append-draft procedure in the tests is a test-owned model; the plan freezes the committed
  bytes, and the real apply turns the draft into them.

## Limitations

- External-review delivery: the prerequisites are now installed instructions in the root AGENTS.md
  `critical-rules` block (Q1). No wrapper or automated preflight enforces them; where the trusted
  shipped defaults cannot be located (for example, project-setup not installed) the instruction
  refuses the external review.
- Residual `C14-R1` (plan): neither project-rules read (reviewer, docs-sync) has a junction
  check or an atomic no-follow guarantee; the setup path tests do not establish agent-read
  confinement. The rules remain instructions on the trusted checked-out branch.
- Nothing was verified on a real backend-standards scaffold; the BS adoption coverage is synthetic.
- Static instruction tests and evaluation objects do not prove agent behavior: they check that the
  installed text says what the plan requires, not that an agent obeys it.
- The tests lane reports 93 of 93 mutants caught; the orchestrator did not rerun the mutation
  rounds.
