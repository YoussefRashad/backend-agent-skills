# project-setup 3.0.0-rc.2 acceptance record for C13

Recorded evidence of the writable acceptance run required by C13-21 of
`docs/plans/2026-10-22-project-setup-v3-rc2-c13.md`, with the decisions in
`docs/plans/2026-10-22-project-setup-v3-rc2-c13-decisions.md` (I13-1 to I13-4). It records what was
executed; it is not a test oracle. The run used the uncommitted C13 change on top of `bba006b`
(tree `7cdda889f02859ed7e54f0aea668f7ed98147070`, the frozen C13 plan commit), the same bytes that
were then committed together with this record. The uncommitted delta is identified by two SHA-256
values taken before and after the run, equal both times (nothing changed during the run):

```text
git diff bba006b | sha256sum                                   e937d77261308c9490b0334e3adc74c51a2df04f28bf03e30d6238bf54f5dac9
untracked files: git ls-files --others --exclude-standard
  | xargs sha256sum | sha256sum                                cfd4c2d7e95b769a3e2f7c17fc0402cad25a6dd102c6b3707413911395fe52df
```

Evidence paths are temporary directories on the recording host and are not retained elsewhere.

```text
Date: 2026-10-22, 22:43 to 23:33 host clock
Platform: win32 10.0.26100, no file-symlink privilege
Node: v24.14.1
Git: git version 2.53.0.windows.2
Commands, run serially from the repository root, one process at a time:
  node project-setup/tests/run-component-tests.mjs --component C13    exit 0  8 PASS / 0 FAIL / 0 SKIP   16 s
  node project-setup/tests/run-component-tests.mjs --component C8     exit 0  16 PASS / 0 FAIL / 0 SKIP  32 s
  node project-setup/tests/run-component-tests.mjs --component C9     exit 0  12 PASS / 0 FAIL / 0 SKIP  15 s
  node project-setup/tests/run-component-tests.mjs --component C10    exit 0  20 PASS / 0 FAIL / 0 SKIP  12 s
  node project-setup/tests/run-component-tests.mjs --component C11a   exit 0  8 PASS / 0 FAIL / 0 SKIP   254 s
  node project-setup/tests/run-component-tests.mjs --component C11b   exit 0  10 PASS / 0 FAIL / 0 SKIP  13 s
  node project-setup/tests/run-component-tests.mjs --component C12    exit 0  8 PASS / 0 FAIL / 0 SKIP   126 s
  node project-setup/tests/run-tests.mjs --keep                       exit 0  99 PASS / 0 FAIL / 1 SKIP  1175 s
  node project-setup/tests/accept-rc1.mjs                             exit 0  ACCEPT-RC1 PASS full       1358 s
  npm run check                                                       exit 0
C13 RESULTS: <tmp>\ps-component-oZjZ7Q\component-results.json
C13 component-results.json SHA-256: 5af72b4f704746066c426543d9ba6eb5d7d0a96105283937f93837ee0176a555
run-tests RESULTS: <tmp>\ps-tests-pIo9a3\results.json
accept-rc1 RESULTS: <tmp>\ps-tests-Jj6P2J\results.json
accept-rc1 results.json SHA-256: dd8979d152b8d21e5acd0b3ce34970dc13e93a46478b5ce2b85f2b7268ebe131
accept-rc1 EVIDENCE: <tmp>\ps-accept-rc1-Rj74AH
Pending host measurements:
  R83
  R44/R74 host enforcement
  R51 Claude continuation and stderr handling
  A3 trusted-checkout live review
  A5 host negative capability
```

`results.json` carries no timestamps or paths, so its SHA-256 equals the C11b and C12 records: it
proves the outcome (100 required results, 99 PASS, 1 allowed skip), not the run. The delta digests
above identify the tested bytes.

The only skip record, in both the suite and the acceptance run, was exactly:

```text
SKIP  R13d  a pre-placed backup leaf symlink is never written through  (cannot create file symlink (Windows without Developer Mode))
```

No rc.1 complete case skipped; R91 ran with real Windows junction coverage.

## C13 process count and budget

Counting method: every `spawnSync` launch made by `tests/c13.test.mjs`, from the component's
`c13-diagnostics.log`. Total 66 launches (65 in V2/C13/update, 1 in V2/C13/contracts, 0 in the
other six groups), 15 s since the first group, within the plan's targets of at most 100 launches
and 120 s.

## Loaded runs

None. Every command above ran alone; no other test, acceptance or review process was running
(the Codex review round 2 finished at 22:38, before the first command). There was no red run, so
no isolated rerun was needed.

## Earlier runs on the way (not the evidence of record)

- After the implement lane, before review: `accept-rc1.mjs` PASS full, 99/0/1, 1301 s, with the
  tracked delta `e2b7f545...` (before the I13-4 entry), `npm run check` exit 0.
- After the C13-R1 test fix: C13 8/0/0, `accept-rc1.mjs` PASS full, 99/0/1, 1219 s, same tracked
  delta, `npm run check` exit 0.

## Review of record

Codex review lane (xhigh), two rounds on one thread. Round 1: no BLOCKING; C13-R1 (NON-BLOCKING,
blanket fence exemption in the prose checks of `tests/c13.test.mjs`), fixed by the tests lane with
negative controls; all five implementer judgment calls allowed. Round 2: no BLOCKING; C13-R1
partially resolved, with C13-R2 and C13-R3 (NON-BLOCKING, residual exemptions in the same test
helper) recorded as I13-4 and left for the next change to that file.

## Limitations

- The external-review prerequisites live in the skill reference only (`references/security.md`);
  installed project instructions do not carry them yet (C13 Q5, reconsidered with C14).
- Static instruction tests and evaluation objects do not prove agent behavior: they check that the
  installed text says what the plan requires, not that an agent obeys it.
- The tests lane reports 81 of 81 mutants caught; the orchestrator did not rerun the mutation
  round.
