# project-setup 3.0.0-rc.2 acceptance record for C15

This record holds the evidence of the writable acceptance run that C15-17 and C15-18 of
`docs/plans/2026-10-23-project-setup-v3-rc2-c15.md` require. The decisions behind it are in
`docs/plans/2026-10-23-project-setup-v3-rc2-c15-decisions.md`:

- Q1: a missing guard is a suggestion with severity INFO that on its own never makes the verdict
  block.
- Q2: yes.
- G16: the freeze-time wording.
- The pre-freeze probes P1-P4.

This record states what was executed; it is not a test oracle.

## The tested bytes

The run used the uncommitted C15 implementation on top of `1c0b3e8`. That is the C15 tests commit,
which sits on the frozen plan commit `d8ac59d`. These are the same bytes that were then committed
together with this record.

The uncommitted delta is identified by two SHA-256 values. They were taken before and after the
run and were equal both times, so nothing changed during the run:

```text
git diff 1c0b3e8 | sha256sum                                   7b11e2e62c399b8428ffb87232536b03601da46a99c3f09bc5f6edca81d29585
untracked files: git ls-files --others --exclude-standard
  | xargs -r sha256sum | sha256sum                             e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

The untracked digest is the digest of empty input, because the implementation added no file. The
delta touches exactly the four implement-lane files of C15-3:

- `assets/agents/docs-sync.md` (D15)
- `assets/agents/reviewer.md` (R15)
- `CHANGELOG.md` (L15)
- `RELEASE-NOTES-3.0.0-rc.2.md` (N15a-N15c)

## The run

Evidence paths are temporary directories on the recording host and are not retained elsewhere.

```text
Date: 2026-10-24, 10:46 to 11:44 host clock
Platform: win32 10.0.26100, no file-symlink privilege
Node: v24.14.1
Git: git version 2.53.0.windows.2
Commands, run serially from the repository root, one process at a time:
  node project-setup/tests/run-component-tests.mjs --component C15    exit 0  6 PASS / 0 FAIL / 0 SKIP   8 s
  node project-setup/tests/run-component-tests.mjs --component C14    exit 0  8 PASS / 0 FAIL / 0 SKIP   37 s
  node project-setup/tests/run-component-tests.mjs --component C13    exit 0  8 PASS / 0 FAIL / 0 SKIP   12 s
  node project-setup/tests/run-component-tests.mjs --component C8     exit 0  16 PASS / 0 FAIL / 0 SKIP  24 s
  node project-setup/tests/run-component-tests.mjs --component C9     exit 0  12 PASS / 0 FAIL / 0 SKIP  14 s
  node project-setup/tests/run-component-tests.mjs --component C10    exit 0  20 PASS / 0 FAIL / 0 SKIP  11 s
  node project-setup/tests/run-component-tests.mjs --component C11a   exit 0  8 PASS / 0 FAIL / 0 SKIP   242 s
  node project-setup/tests/run-component-tests.mjs --component C11b   exit 0  10 PASS / 0 FAIL / 0 SKIP  15 s
  node project-setup/tests/run-component-tests.mjs --component C12    exit 0  8 PASS / 0 FAIL / 0 SKIP   128 s
  node project-setup/tests/run-component-tests.mjs --component C1     exit 0  12 PASS / 0 FAIL / 0 SKIP  1 s
  node project-setup/tests/run-component-tests.mjs --component C2     exit 0  14 PASS / 0 FAIL / 0 SKIP  191 s
  node project-setup/tests/run-component-tests.mjs --component C3     exit 0  18 PASS / 0 FAIL / 0 SKIP  136 s
  node project-setup/tests/run-component-tests.mjs --component C4     exit 0  17 PASS / 0 FAIL / 0 SKIP  53 s
  node project-setup/tests/run-component-tests.mjs --component C5     exit 0  18 PASS / 0 FAIL / 0 SKIP  20 s
  node project-setup/tests/run-component-tests.mjs --component C6     exit 0  12 PASS / 0 FAIL / 0 SKIP  37 s
  node project-setup/tests/run-component-tests.mjs --component C7     exit 0  12 PASS / 0 FAIL / 0 SKIP  77 s
  node project-setup/tests/run-tests.mjs --keep                       exit 0  99 PASS / 0 FAIL / 1 SKIP  1224 s
  node project-setup/tests/accept-rc1.mjs                             exit 0  ACCEPT-RC1 PASS full       1242 s
  npm run check                                                       exit 0
C15 RESULTS: <tmp>\ps-component-ohm6rf\component-results.json
C15 component-results.json SHA-256: 6a76359c7b3578a76a6a2a26819c7d073dd072ed8509c62de92547ed793a19dd
C14 RESULTS: <tmp>\ps-component-N7ApS5\component-results.json
C14 component-results.json SHA-256: 95ec45222da4f34f17fca6a07b26ef8b47fae7451bec89714f030111e1bfa317
C13 RESULTS: <tmp>\ps-component-ftAF6k\component-results.json
C13 component-results.json SHA-256: 5af72b4f704746066c426543d9ba6eb5d7d0a96105283937f93837ee0176a555
run-tests RESULTS: <tmp>\ps-tests-1UdmuY\results.json
accept-rc1 RESULTS: <tmp>\ps-tests-5ahqfJ\results.json
accept-rc1 results.json SHA-256: dd8979d152b8d21e5acd0b3ce34970dc13e93a46478b5ce2b85f2b7268ebe131
accept-rc1 EVIDENCE: <tmp>\ps-accept-rc1-uKkUrS
Pending host measurements:
  R83
  R44/R74 host enforcement
  R51 Claude continuation and stderr handling
  A3 trusted-checkout live review
  A5 host negative capability
```

Some digests above prove the outcome rather than the run, because the files they cover carry no
timestamps or paths:

- The C13 and C14 `component-results.json` digests equal those in the C14 record: eight PASS and
  the same descriptors.
- The `results.json` digest equals the C11b-C14 records: 100 required results, 99 PASS, 1 allowed
  skip.

The delta digests above identify the tested bytes.

The only skip record, in both the suite and the acceptance run, was exactly:

```text
SKIP  R13d  a pre-placed backup leaf symlink is never written through  (cannot create file symlink (Windows without Developer Mode))
```

No rc.1 complete case skipped, and C15 records no skip.

## Probes (C15-17)

Before the freeze, the orchestrator ran P1-P4 read-only. They are recorded in the decisions file.

After implementation, on the tested tree:

- P1: the prefix digest of evaluations 1-31 is
  `1f7a9ddae2c71d1de3a61ee64541fc8924e739f1fad134d25610bfd2b9394f7a`, unchanged. The raw digest of
  `tests/fixtures/c15-prechange.json` is
  `79e0c2ddb56dd45b314006a4aa6fb4db4bb817e0cb308194710ef11f755fe3ad`, as planned.
- P2: `git check-attr eol` reports `eol: lf` for the three new test paths.
- P3: the four amended files equal their inspected HEAD blobs after the exact C15 reversals. The
  C15 preservation and release descriptors assert this, and both passed.
- P4: `evals/evals.json` holds 33 evaluations with ids 1-33.
- P5: the `V2/C15/contracts` import-safety step passed. Review finding C15-RV1 below limits what
  that step proves.

## C15 process count and budget

The counting method is every `spawnSync` launch made by `tests/c15.test.mjs`, taken from the
component's `c15-diagnostics.log`.

| Descriptor | Launches |
|---|---|
| update | 44 |
| contracts | 1 |
| docs-sync | 0 |
| reviewer | 0 |
| preservation | 0 |
| release | 0 |
| **Total** | **45** |

The 45 launches took 8 s since the first group. That is within the decided target (Q2) of at most
50 launches and 30 s.

The amended C14 component made 176 launches in 37 s, the same count as its own record. Full
acceptance took 1242 s against the unchanged 1,800,000 ms timeout.

## Loaded runs

None. Every command above ran alone; no lane, review or other test process was running. The
implement lane had finished before the first command, and the Codex review was dispatched after
the last. There was no red run, so no isolated rerun was needed.

## Earlier runs on the way (not the evidence of record)

- Before implementation, on the committed tests at `1c0b3e8`:
  - C15: 1 PASS / 5 FAIL.
  - C14: 6 PASS / 2 FAIL.
  - C13: 5 PASS / 3 FAIL.
  - C11b: 7 PASS / 3 FAIL.
  - Each failure was an amendment not yet present.
  - C8, C9 and C12 were green.
- The implement lane's own component runs: C15, C14, C13, C11b, C8, C9, C12, C10, C11a, C2, C3 and
  C7, all green, plus `npm run check`.

## Preservation evidence

The C15, C14 and C13 components assert the following, and all passed:

- C12's docs-sync paragraphs, C13's drift paragraphs and mapping row, C14's `### Project rules`
  subsection, the reviewer's four pass labels, named classes, I13-1 paragraph and project-rules
  hook are unchanged.
- The historical C13 and C14 comparisons run on text with exactly D15, R15, L15 and N15c, N15b and
  N15a reversed. No historical digest was refreshed.
- Both frozen C14 records match their digests: plan `a1a87ae3...` and acceptance `2330a2b0...`.

`V2/C15/update` exercised same-version managed delivery through the real apply and validate code:

- both canonical agents, each approved independently;
- keep and remove of a user-modified canonical file;
- no-op rerun;
- rollback that keeps later edits.

## Review of record

The Codex review lane ran one round at the normal-task effort. It reported no BLOCKING finding:

- D15, R15, L15 and N15a-N15c match the frozen plan byte for byte at their anchors.
- Nothing outside the plan moved.
- The C14 boundary is consistent.
- The tests lane's extra `PLAN-GAP` pins are consistent with the preservation requirements.

It found two NON-BLOCKING test-coverage findings. Both are open, and neither changes the installed
text:

- **C15-RV1** (`tests/c15.test.mjs:1758`). The P5 import-safety step captures output and checks
  for written files, but does not observe process launches. Its source regex misses a direct
  `spawnSync(...)` call. A silent top-level child launch would therefore pass. The current module
  has no such launch.
- **C15-RV2** (`tests/c15.test.mjs:1745`). The descriptor-to-runner assertion compares only ids
  copied from the same `EXPECTED_DESCRIPTORS`, so a swapped runner binding would still pass.

## Test-owned readings (tests lane, recorded here)

- The tests lane added pins the plan does not give, marked `PLAN-GAP` in `tests/c15.test.mjs`. It
  took them from the pre-C15 tree. They are:
  - the pre-C14 docs-sync digest;
  - the two historical fixture file digests;
  - the rc.1 and pre-C14 array digests;
  - the raw digest of `evals/evals.json` lines 1-33;
  - a few unchanged-file pins, among them `scripts/schemas.mjs`.
- A few step titles and messages in c13 and c14 were reworded so they no longer claim an agent is
  wholly unchanged. Assertions and digests were not changed by this.

## Limitations

- Static instruction tests and evaluation objects do not prove agent behavior. They check that the
  installed text says what the plan requires, not that an agent obeys it.
- Residual C15-R1 (plan): R15 covers copies of in-repository sources only. Copies of external
  sources remain subject to ordinary review.
- The tests lane reports 89 of 89 mutants caught. The orchestrator did not rerun the mutation
  rounds.
- The tests lane's scratch reference is a sparse `git clone` holding only these paths:
  - `project-setup/`
  - `docs/plans/`
  - `TODO.md`
  - `.gitattributes`
  It carries the repository history, because the C8 and C11b helpers read the v2 source from Git.
  The repository holds no secrets.
