# project-setup 3.0.0-rc.1 acceptance record after C12

Recorded evidence of the writable acceptance run required by C12-16 of
`docs/plans/2026-10-21-project-setup-v3-rc1-c12.md`, with the decisions in
`docs/plans/2026-10-21-project-setup-v3-rc1-c12-decisions.md` (I12-1 to I12-4). It records what was
executed; it is not a test oracle. The run used the uncommitted C12 change on top of `7f075ba`
(the README caveat commit), the same bytes that were then committed. The uncommitted delta is
identified by the SHA-256 of `git diff 7f075ba` taken before and after the run,
`b0a208afc179f03a42a384f400d879893fbf2b45daccaa291112cebb951125a4` (equal, so nothing changed during
the run). Evidence paths are temporary directories on the recording host
and are not retained elsewhere.

```text
Command: node project-setup/tests/accept-rc1.mjs
Date: 2026-10-22 (host clock at start: 2026-10-22T09:30:48Z)
Platform: win32 10.0.26100, no file-symlink privilege
Node: v24.14.1
Git: git version 2.53.0.windows.2
Totals: 99 PASS / 0 FAIL / 1 SKIP
ACCEPT-RC1: PASS full (exit 0, empty stderr)
RESULTS: <tmp>\ps-tests-swc3kq\results.json
results.json SHA-256: dd8979d152b8d21e5acd0b3ce34970dc13e93a46478b5ce2b85f2b7268ebe131
EVIDENCE: <tmp>\ps-accept-rc1-7eIdD2
Elapsed time: 1435 s (wall clock around the command)
Synthetic S07 identities (fresh in this run, fixture only, not a release):
  Synthetic S07 tag: c11b-fixture-rc1
  Synthetic S07 commit: 1f4977fa953085b81f75ac42f0067b7fa0d5369f
  Synthetic S07 project-setup tree: d9cf9dd89bdc211862db7eecd6f44e89683c8aa5
  First ZIP SHA256: 1e83335e4538fc169a2c5eb95d26f298814f2c63ff827dc3bf9bceebeb2923b9
  Second ZIP SHA256: 1e83335e4538fc169a2c5eb95d26f298814f2c63ff827dc3bf9bceebeb2923b9
  Both ZIPs are 1229791 bytes; the publication notes record the same tag, commit, tree and digest.
  C11b component processes: 130 (its own spawn counter, c11b/c11b-diagnostics.log under RESULTS)
Pending host measurements:
  R83
  R44/R74 host enforcement
  R51 Claude continuation and stderr handling
  A3 trusted-checkout live review
  A5 host negative capability
```

The only skip record was exactly:

```text
SKIP  R13d  a pre-placed backup leaf symlink is never written through  (cannot create file symlink (Windows without Developer Mode))
```

## C12 component report (separate from the full-suite results)

```text
Command: node project-setup/tests/run-component-tests.mjs --component C12
Totals: 8 PASS / 0 FAIL / 0 SKIP (exit 0), on the same bytes, run immediately before the full run
RESULTS: <tmp>\ps-component-scujqN\component-results.json
component-results.json SHA-256: 70e068add2147ebdb9c2195aca7bdeb80961d12fff773b0d91bbc30e880ef801
Diagnostics: c12-diagnostics.log beside it
```

Process counts and budget (C12-P2-2, a recorded target, not a gate). Counting method: every
`spawnSync` launch made by `tests/c12.test.mjs`, plus 3 per hooks-selftest run counted explicitly.

| Descriptor | Launches | Cumulative | Elapsed since first group |
| --- | --- | --- | --- |
| R47/C12/policy-preservation | 110 | 110 | 23 s |
| R80/C12/policy-gates | 425 | 535 | 133 s |
| V2/C12/entrypoints | 64 | 599 | 144 s |
| R51/C12/config-env | 6 | 605 | 145 s |
| R80/C12/runtime-unit | 44 | 649 | 156 s |
| A5-templates/C12/documentation | 0 | 649 | 156 s |
| RC1/C12/pins | 0 | 649 | 156 s |
| V2/C12/contracts | 1 | 650 | 157 s |

The launch count, 650, exceeds the plan's 400-launch target; the review-round coverage of I12-2,
I12-2a and I12-4 in R80/C12/policy-gates accounts for most of it. Elapsed time, 157 s, is within
the 600-second target. Optional subcases not exercised on this host: the file-symlink case in
V2/C12/entrypoints (EPERM; the mandatory junction cases ran), and five I12-4 draft rows whose
spelling is an NTFS stream suffix (`::$DATA`, `::$INDEX_ALLOCATION`), which this filesystem does not
list as separate drafts; those spellings are covered as declared inputs and forged operations.

## Earlier runs on the way (not the evidence of record)

On the C12 tree before the C12-R5 comment-only fix, the orchestrator's serial run gave: all 13
components green (C11a 8, C1 12, C2 14, C3 18, C4 17, C5 18, C6 12, C7 12, C8 16, C9 12, C10 20,
C11b 10, C12 8; 0 FAIL, 0 SKIP), `run-tests.mjs` 99 PASS / 0 FAIL / 1 SKIP in 1204 s,
`accept-rc1.mjs` PASS full in 1540 s, and `npm run check` exit 0.

## Historical C11b reference (not newly measured)

The post-C12 results.json above has the same SHA-256 as the C11b one. results.json holds only the
environment, the totals and each record's id, name, failures and skip reason, with no timestamps or
paths, so two runs with the same 99 PASS and the same R13d skip produce the same bytes. The digest
is therefore evidence of an identical outcome, not of identical bytes under test.

```text
C11b historical full acceptance: 99 PASS / 0 FAIL / 1 SKIP
results.json SHA-256: dd8979d152b8d21e5acd0b3ce34970dc13e93a46478b5ce2b85f2b7268ebe131
```

## npm run check

`npm run check` on the same bytes: exit 0 (format check clean; version stamps backend-standards
2.0.1 and toolchain-config 2.0.0; no BASE_REF, so the bump check is left to CI).

## Review of record

Codex review lane (xhigh), four rounds on one thread. Round 1: C12-R1 (BLOCKING, case-alias policy
target) and C12-R2; decisions I12-2, I12-2a, I12-2b, I12-3. Round 2: R2 resolved; C12-R3 (BLOCKING,
other Windows spellings) and C12-R4; decision I12-4. Round 3: R3 and R4 resolved; C12-R5 (JSDoc
wording, NON-BLOCKING), fixed by a comment-only change. Round 4: R5 resolved, no findings.
