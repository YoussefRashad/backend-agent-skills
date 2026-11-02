# project-setup 3.0.0-rc.4 acceptance record for C17

This record holds the evidence of the writable acceptance run that C17-17 and C17-18 of
`docs/plans/2026-10-27-project-setup-v3-rc4-c17.md` require. The decisions behind it are in
`docs/plans/2026-10-27-project-setup-v3-rc4-c17-decisions.md`:

- Q1-Q6, taken by the orchestrator on 2026-10-27 under the maintainer's instruction to continue
  without waiting: argument-free `git-safe head`, documentation plus a distinct
  GIT_SAFE_OWNERSHIP diagnostic, exact English prefix at stderr byte zero, parent-brief guidance
  only for headless P3 h, eight descriptors with 180 launches and 90 s, and review-diff.mjs
  changed as C17-6 says.
- The freeze addendum C17-F0..F15.
- The pre-freeze probes P-own and P1-P6.
- The tests-lane plan-gap decisions I17-1 (root README tokens on lines 47, 58, 93 and 242) and
  I17-2 (launch overrun accepted), recorded on 2026-11-01.
- I17-3 (the maintainer's disposition of the first run's 1746 s) and the review round 1
  dispositions I17-4..I17-8, recorded on 2026-11-01.

This record states what was executed; it is not a test oracle. No fixture-only ownership test
here proves Codex sandbox behavior; that is the post-release re-measurement (C17-19).

There were two full gate runs. The **run of record** is the second (2026-11-02), made after the
review round 1 test fixes and with the timing and stream evidence C17-18 asks for (I17-5). The
first run (2026-11-01) is kept below as history, because its 1746 s is what I17-3 disposed of.

## The tested bytes

The run of record used the uncommitted C17 implementation and the uncommitted round 1 test fixes
on top of `e6c66a1` (tree `5423297990db048d05b4c2ea4e13555e79d237d3`): the I17-1/I17-2 decisions
commit, on the C17 tests commit `403a848`, on the frozen plan commit `81a03bb`.

The uncommitted delta is identified by these SHA-256 values, taken after the run:

```text
git diff e6c66a1 -- . ':!project-setup/tests' ':!docs/plans' | sha256sum
                                    aa9548eea5ddfffdb52eb25330efdb9db8b49cae03def79bb6b227d3486e7f3a
git diff e6c66a1 -- project-setup/tests | sha256sum
                                    219eec2f569977f794ebdb2a844e163882b5cc2e2b26507bc20e2a12154cc022
git diff e6c66a1 -- docs/plans | sha256sum
                                    b46ef5df5bf424933bb128e579c8dfbaa65314c2c52a690a12f0194da76de274
project-setup/RELEASE-NOTES-3.0.0-rc.4.md (untracked)
                                    5340acd88c392c5fcc2be5d2c908639e6c10d55247d60d678c39e38d76dc55b2
```

The first digest excludes tests and plan records. It is the same value the first run and review
round 1 covered (there it was the whole `git diff e6c66a1`, which then had no test or plan
changes), so the production and documentation bytes did not change between the runs. The tests
digest covers the round 1 fixes in `tests/helpers/c17-amendments.mjs`, `tests/c13.test.mjs`,
`tests/c14.test.mjs`, `tests/c16.test.mjs` and `tests/c17.test.mjs`. The `docs/plans` digest
covers only the decisions file; this record was rewritten after the run and is not part of it.

Every tracked file in the delta was last modified at or before 05:14:18 host clock on 2026-11-02,
before the first gate command started at 06:08:08 host clock (04:08:08 UTC), and no writing
process ran during the gates, so the digests identify the tested bytes. The delta touches only
the Implement rows of C17-4 and the C17 test files.

The implementation came from two implement lanes (Claude Sonnet) on disjoint files: lane A
(runtime) wrote `git-safe-core.mjs`, `review-diff.mjs`, `reviewer.md` and
`references/security.md`; lane B (documentation and release) wrote the other C17-4 Implement
files. Neither reported a deviation. The round 1 test fixes came from a fresh tests lane (Claude
Sonnet) that changed only files under `tests/` and reported no deviation.

New identities on the tested tree:

| File | Bytes | SHA-256 |
|---|---|---|
| `assets/tools/git-safe-core.mjs` | 34748 | `d8e7e573b8dfb9edbee90023838547a2b0cae694cbcdc9e66b22a0b4659bcb7a` |
| `assets/tools/review-diff.mjs` | 30091 | `745d55310baebb72c1683ff6022e1ed8517e370cd5c2ccbc0e5d8bbb4b8d7653` |
| `assets/agents/reviewer.md` | 25177 | `696f86bc03f8506075e868465a2b34d76b6384a2809ed1e4ea949cc50f6a305c` |
| `tests/c17.test.mjs` | 351357 | `af6fb0beaf42981bf6fba749a0d640ebd41954a67363f145860486cf2b9b6a58` |
| `tests/helpers/c17-amendments.mjs` | 67494 | `2057887c8b67af6d48c9ff9d1c44ac3c6cbad27c42d3760a8c69e0c5648e262b` |
| `tests/c13.test.mjs` | 225113 | `7ba8d6e4e3ad5f025413127a5fba9a9dd05b35418848214b8b100a34ac1b6aa0` |
| `tests/c14.test.mjs` | 312061 | `d26dbb11925fdaac16748b5e07404e8e2818afb01e1b5db5ac15d1dd3d97c166` |
| `tests/c16.test.mjs` | 298905 | `99d536a0151ce71ead00bab7e45e93b4266537b0d487d423ff4b8819b5fae8be` |
| `tests/fixtures/c17-prechange.json` | 312580 | `bf3436d54b9c046edea5ee2b339d0a25412beaf6cdc10a4e4ffc00f84e1efa65` |
| `tests/fixtures/c17-upgrade-baselines.json` | 594453 | `0f9532eefd2514291aad44dae0c2200added3348089922eec7f8ebdf7db8b1b9` |

Unchanged against `e6c66a1` (`git diff --quiet` exit 0): `assets/agents/docs-sync.md`
(`60539891...`), the four wrappers (`codex-reviewer.toml` `fe21c05b...`,
`codex-docs_sync.toml` `1e6eef9a...`, `claude-reviewer.md` `284332b2...`,
`claude-docs-sync.md` `36226eb3...`), `assets/tools/git-safe.mjs` (`995bafa7...`),
`data/runtime-units.json` (`a1867f13...`), `scripts/` including
`check-agent-baselines.mjs` (`905c0254...`), `install/`, `references/docs-generation.md`
(`cabdf9cd...`, C17-F8), both C17 fixtures and every test file not named above. The changed
runtime-unit members are `git-safe-core.mjs` and `review-diff.mjs`; `reviewer.md` is the changed
canonical agent.

Frozen C16 records, unchanged:

| File | SHA-256 |
|---|---|
| `docs/plans/2026-10-25-project-setup-v3-rc3-c16.md` | `c08622f9580f1c154fe03d069e802e864d80e6b0ec6dd8f4ce5e7947b5998129` |
| `docs/plans/2026-10-25-project-setup-v3-rc3-c16-decisions.md` | `befc8c52d8fe9a817f070fe17914a0158631455fe1dfe4d1b751a90da044d839` |
| `docs/plans/2026-10-25-project-setup-v3-rc3-c16-acceptance.md` | `adc7d97592f0001f3995744d51f9a90c8bb802c01ce602c96079832c3e833673` |

## The run of record

A gate wrapper ran each command as a child process from the repository root, one at a time, and
measured each with Node's monotonic clock (`process.hrtime.bigint()`) from spawn to close. It
retained every command's stdout and stderr as files and recorded their SHA-256 values in a
`gates.json` summary. Evidence paths are temporary directories on the recording host and are not
retained elsewhere.

```text
Date: 2026-11-02, first command started 04:08:08 UTC, last finished about 05:03:15 UTC
Platform: win32 10.0.26100, no file-symlink privilege
Node: v24.14.1
Git: git version 2.53.0.windows.2
Commands (component N = node project-setup/tests/run-component-tests.mjs --component N;
run-tests = node project-setup/tests/run-tests.mjs --keep; accept-rc1 = node
project-setup/tests/accept-rc1.mjs; npm-check = npm run check), in this order:
  component C17    exit 0  8 PASS / 0 FAIL / 0 SKIP     32829 ms
  component C4     exit 0  17 PASS / 0 FAIL / 0 SKIP    54372 ms
  component C5     exit 0  18 PASS / 0 FAIL / 0 SKIP    17864 ms
  component C8     exit 0  16 PASS / 0 FAIL / 0 SKIP    23012 ms
  component C9     exit 0  12 PASS / 0 FAIL / 0 SKIP    12522 ms
  component C11b   exit 0  10 PASS / 0 FAIL / 0 SKIP    12451 ms
  component C12    exit 0  8 PASS / 0 FAIL / 0 SKIP    113003 ms
  component C13    exit 0  8 PASS / 0 FAIL / 0 SKIP     10445 ms
  component C14    exit 0  8 PASS / 0 FAIL / 0 SKIP     35145 ms
  component C15    exit 0  6 PASS / 0 FAIL / 0 SKIP      7960 ms
  component C16    exit 0  8 PASS / 0 FAIL / 0 SKIP     31452 ms
  component C1     exit 0  12 PASS / 0 FAIL / 0 SKIP      393 ms
  component C2     exit 0  14 PASS / 0 FAIL / 0 SKIP   189868 ms
  component C3     exit 0  18 PASS / 0 FAIL / 0 SKIP   128800 ms
  component C6     exit 0  12 PASS / 0 FAIL / 0 SKIP    33786 ms
  component C7     exit 0  12 PASS / 0 FAIL / 0 SKIP    66536 ms
  component C10    exit 0  20 PASS / 0 FAIL / 0 SKIP    10731 ms
  component C11a   exit 0  8 PASS / 0 FAIL / 0 SKIP    227912 ms
  run-tests        exit 0  99 PASS / 0 FAIL / 1 SKIP  1144817 ms
  accept-rc1       exit 0  ACCEPT-RC1 PASS full       1150102 ms
  npm-check        exit 0                                2315 ms
C17 RESULTS: <tmp>\ps-component-6wQwVI\component-results.json
C17 component-results.json SHA-256: 9de298b8b9cf3cbab7e96895fd7c20c1e1835a7c58e2564cfb6243ae96da7f5b
C16 RESULTS: <tmp>\ps-component-G41wIU\component-results.json
C16 component-results.json SHA-256: bcdb72f753f060a5b169c8ab179aeed85d75bad1bc900f4e56c6f4674f18d4be
C15 RESULTS: <tmp>\ps-component-dOn3W5\component-results.json
C15 component-results.json SHA-256: 6a76359c7b3578a76a6a2a26819c7d073dd072ed8509c62de92547ed793a19dd
C14 RESULTS: <tmp>\ps-component-q5rQ2a\component-results.json
C14 component-results.json SHA-256: 95ec45222da4f34f17fca6a07b26ef8b47fae7451bec89714f030111e1bfa317
C13 RESULTS: <tmp>\ps-component-bwMKqI\component-results.json
C13 component-results.json SHA-256: 5af72b4f704746066c426543d9ba6eb5d7d0a96105283937f93837ee0176a555
run-tests RESULTS: <tmp>\ps-tests-8tuwnM\results.json
run-tests results.json SHA-256: dd8979d152b8d21e5acd0b3ce34970dc13e93a46478b5ce2b85f2b7268ebe131
accept-rc1 RESULTS: <tmp>\ps-tests-93qPYp\results.json
accept-rc1 results.json SHA-256: dd8979d152b8d21e5acd0b3ce34970dc13e93a46478b5ce2b85f2b7268ebe131
accept-rc1 EVIDENCE: <tmp>\ps-accept-rc1-tEAk72
```

Retained streams. The wrapper wrote 43 files to one evidence directory on the recording host:

```text
<scratchpad>\c17\gates2-out\
```

For each command named in the first column below, its stdout is `<Command>.stdout.txt` and its
stderr is `<Command>.stderr.txt` in that directory (for example `C17.stdout.txt`,
`accept-rc1.stderr.txt`, `npm-check.stdout.txt`); the 43rd file is `gates.json`. Every
command's stderr was empty (0 bytes, SHA-256
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`). After review pass 2 the
orchestrator recomputed all 42 stream hashes from those files against `gates.json`: no mismatch.
The stdout files:

| Command | Bytes | stdout SHA-256 |
|---|---|---|
| C17 | 855 | `293ddbd31c2d42c58e0a910161975802d2e58698c520b603908c2e72d53cfdf7` |
| C4 | 1268 | `c95464952aba412aea240e023449db74929e14988f5c46db40fe22853e499279` |
| C5 | 1343 | `d5b0811f255819245ea506ab9f13c86e883d320027313c499b8ad7ffd7d1abf0` |
| C8 | 1451 | `0151fe642e64d6d3eb2da9b772ac43d23b72a401aca5b50f2a0f582cd5e93eb2` |
| C9 | 1115 | `46ac16d1d0dcee86081fe849cd9c8953f1b5c26ac8f742650e4e874723d560cb` |
| C11b | 959 | `0ca37fb451aa113ebca3d252c9ddd9d6287a6ac177b4902bc559a56ca29dfccb` |
| C12 | 759 | `7e695b43d760efb5efaf907fba675a1c642b9a886fdc345a981913f8c44e8bcb` |
| C13 | 834 | `35e26919910fe5bb348e777b4a7ea75e3031f7d45155e98c58716507f555046f` |
| C14 | 849 | `ec39e3070d93e5f291081f934e6bb395a6aab481e5e095007641cb7421d514cd` |
| C15 | 665 | `a4885627fbded39377be535eafa578f990ffbe957f3d85ea35c7d7ab07245351` |
| C16 | 893 | `7b39017162f9f29c483a6a4d99a1689b5d5b2a2cfdc86b06776ff3e4a9ad6c8e` |
| C1 | 877 | `1f3951139fcbe979fa338211d695eb314b9db94128fc244c55756f6080f80aa3` |
| C2 | 1039 | `58b6570a8b698f4d001b64c931764da28555cd7cabdb9a9712e84ea16175658f` |
| C3 | 1378 | `aa78e677a01199816c00c6bc7ec7f056dec04555bd7dfeee67289cafa90b3541` |
| C6 | 1027 | `5bb79b94883091d80e7f72792bf8104d9eb999627b9a312cf7479e2dcfa15473` |
| C7 | 1039 | `2dc576dfd7e083a6f033c69aa2750515923173f18ee21e3a01ea13beafea2a69` |
| C10 | 1686 | `8a97f95af1bb26f57561f8fb1b2a94819cb974763861a63d9ebc2f50cae11b47` |
| C11a | 612 | `dc493a4b041399c350a1227c9edf194daff1272c319c800b2381f94d75631164` |
| run-tests | 7769 | `28b9579cf14419e00f78d32ba516dbc35e3e7d14b151fc0bd7d708402a28669a` |
| accept-rc1 | 7943 | `dda134233a78bd6417aeb70d005928eeed7490f511eeeece3637c65c369966df` |
| npm-check | 432 | `57ec764cf32bf744fd2da3357f98a0ce7483dadbdedc538e2de73ccb6d26f3a2` |

The `gates.json` summary that lists these values, in the same directory, has SHA-256
`83013f83a434770a279289dc83b9ef5187d6a7d43f8d75234ac81c537c629ebb`. It also records, per
command, the start time, exit code, milliseconds and byte counts, and the results path and hash
for every command whose stdout ends with a `RESULTS` line (the components and accept-rc1). The
run-tests results path above comes from its stdout's final JSON line.

Some digests above prove the outcome rather than the run, because the files they cover carry no
timestamps or paths:

- The C13, C14, C15 and C16 `component-results.json` digests equal those in the C16 record: the
  same descriptors, all PASS. The C17 digest equals the first run's: the same eight descriptors,
  all PASS.
- Both `results.json` digests equal the C11b-C16 records: 100 required results, 99 PASS, 1
  allowed skip. C17 aggregates into R29 once (C17-17); it adds no required suite record.

The only skip record, in both the suite and the acceptance run, was exactly:

```text
SKIP  R13d  a pre-placed backup leaf symlink is never written through  (cannot create file symlink (Windows without Developer Mode))
```

No rc.1 complete case skipped, and C17 records no skip. R91 kept its Windows junction coverage
(it passed in both the suite and the acceptance run).

## The first run (2026-11-01, superseded)

The first run used the same production and documentation bytes (`aa9548ee...`) with the C17 tests
as committed at `403a848`, before the round 1 fixes. All gates passed with the same totals and
the same C13-C17 and `results.json` digests. Its times came from a wrapper taking whole seconds
from `date +%s` around each command, not a monotonic millisecond clock, and its streams were not
retained; review round 1 found that short of C17-18 (C17-RV2), which the run of record closes
(I17-5). Its suite took 1599 s and its acceptance run 1746 s.

## Acceptance headroom

Full acceptance in the run of record took 1150102 ms against the unchanged 1,800,000 ms timeout:
649898 ms or 36.1% headroom, below the 1,500-second revisit threshold (maintainer decision of
2026-10-24). The suite took 1144817 ms.

The first run's 1746 s (54 s or 3.0% headroom) was above the threshold. The maintainer's
disposition is I17-3: record it, keep the timeout and coverage, rerun acceptance once in
isolation after review, and treat a timeout change or a suite split as separate work after rc.4.
The run of record is that isolated rerun. Its 1150 s on the same host, with the same production
bytes and 18 more C17 launches, leaves the first run's extra 596 s unattributed to C17;
host load at that time is the remaining candidate and was not measured.

## C17 process count and budget

The counting method is every launch made by `tests/c17.test.mjs`, including each Git child of
the executor seam, taken from the component's `c17-diagnostics.log` in the run of record.

| Descriptor | Launches |
|---|---|
| R76/C17/head | 58 |
| R76/C17/ownership | 49 |
| R90/C17/instructions | 0 |
| A5-templates/C17/host-docs | 0 |
| V2/C17/update | 98 |
| RC1/C17/release | 52 |
| V2/C17/preservation | 1 |
| V2/C17/contracts | 2 |
| **Total** | **260** |

The component logged 33 s since its first group (32829 ms for the whole process), within the 90
s target. The 260 launches are an **overrun** of the decided 180-launch figure (Q5), accepted as
I17-2: Q5 records overruns and does not drop coverage. The first run counted 242; the 18 more
are the clean rollback steps the round 1 fixes added to V2/C17/update (I17-7). Most of the total
is V2/C17/update (three authentic upgrade baselines through setup, apply and rollback) and
RC1/C17/release.

## Loaded runs and red runs

During the run of record no lane, review or other test process was running. The round 1 tests
lane had finished before the first command, and the review pass 2 was dispatched after the last.
There was no red run, so no isolated rerun was needed. Earlier, before implementation, the
tests-lane and orchestrator verification runs failed exactly on unlanded C17 bytes (C17 0/8 and
the listed C4-C16 descriptors); those are the expected pre-implementation failures recorded in
commit `403a848`, not red runs of this tree.

## Behavior evidence (asserted by the passing descriptors)

The following C17-18 items are asserted by descriptors that passed in the run of record; this
record does not repeat their vectors. The mapping follows the descriptor names and the C17-14
table; the review of record checks it.

| C17-18 item | Descriptor |
|---|---|
| HEAD vectors, SHA-1/SHA-256, unborn and detached cases, no inventory or content read | R76/C17/head, R76/C4/arguments |
| Ownership classifier chunk tests, real-Git controls (LC_ALL=C, exact-path grant per C17-F3), zero disclosure, F4 flag consistency | R76/C17/ownership, R76/C4/isolation, R76/C5/failures |
| Unchanged sanitizer, fixed prefix, output bound, review header | R76/C17/head, R76/C17/ownership, V2/C17/preservation |
| Current code and message strings and their consumers, stop-list coverage (C17-F11) | V2/C17/contracts, R90/C17/instructions, R90/C8/instructions, R93/C9/instructions |
| Exact quoted ownership prefix and paragraph boundaries in the security text (I17-6) | R90/C17/instructions |
| No atomic, snapshot or consistent-view claim for the HEAD comparison (I17-8) | R90/C17/instructions |
| Three authentic upgrade baselines (rc.1, rc.2, rc.3) and their source identities; approval, partial-unit refusal (C17-F12), preservation, no-op, clean rollback (I17-7) and conflicting rollback | V2/C17/update |
| New runtime and reviewer hashes, unchanged catalog, checker and wrapper identities | V2/C17/update, RC1/C17/release, RC1/C12/pins |
| Exact preservation chain, including the core reversed through its 21 pinned C17 hunks to the pre-C17 core `ad1c51db...` (I17-4), and TODO negative controls | V2/C17/preservation, C13-C16 historical steps |
| Evaluations 1-36 preserved and evaluations 37-39 exact | V2/C17/contracts, C8, C9, C11b-C16 inventory checks |
| Release-array agreement and unchanged 60-file payload membership | RC1/C17/release, S07/C11b descriptors |
| Living host notes separate measured defects from pending rc.4 results | A5-templates/C17/host-docs |

## Residuals

- The C14, C15 and C16 residuals stand unchanged (see their records). C17 adds none of its own
  beyond the plan's: a localized or warning-prefixed ownership refusal stays
  GIT_SAFE_REPOSITORY (Q3), and the headless P3 h false-refusal observation remains an L16
  residual that P17 does not reach (C17-F6).
- The 21 core hunks are pinned from the implemented bytes (I17-4). They detect drift from the
  reviewed core; they do not verify its behavior independently, which the descriptors above do.
  A later legitimate core edit must update them in the same change.
- Host measurements are pending until separately executed after release (C17-19): the Codex
  elevated-sandbox no-grant and grant runs, the reviewer with the step 7 prompt, and the
  headless and TUI L08 runs on Claude Code 2.1.311.
- No real release build, tag, publication, installer run or user-level write was part of
  acceptance.

## Review of record

The review lane is the review of record: Codex (gpt-6-astra, codex-cli 0.163.0) through the
codex-delegate relay, read-only and isolated, one session (thread
`01a1985d-177e-7273-b610-37002e0ab751`), three passes. Every pass completed with no MCP call and
no `mcpViolation`, and touched no file.

| Pass | Date (UTC) | Effort | Reviewed | Result |
|---|---|---|---|---|
| 1 | 2026-11-01 18:26 | xhigh | Full contract and adversarial pass on the first run's tree | C17-RV1 and C17-RV2 BLOCKING, C17-RV3 and C17-RV4 NON-BLOCKING, one uncovered C17-20 row; no production defect |
| 2 | 2026-11-02 06:30 | high | Delta: round 1 test fixes and this record | RV1, RV3, RV4 and the row closed; C17-RV5 BLOCKING kept RV2 open |
| 3 | 2026-11-02 07:32 | high | Delta: RV5 fix in this record and I17-9 | No findings; RV1-RV5 all closed |

The dispositions are I17-4..I17-9 in the decisions file. Passes 2 and 3 ran at effort high, the
review lane's configured default for a normal-class task, at the maintainer's choice. Pass 3
independently listed the 43 evidence files, recomputed every stream hash and byte count against
`gates.json`, and matched the `gates.json` hash above.

Two fix rounds were used, the limit: round 1 (test fixes and the gate rerun) and round 2 (the
evidence mapping, without a rerun because no tested byte changed). The reviewer ran no test,
fixture or release command; execution results and the twelve-mutant report of the round 1 tests
lane are orchestrator-reported, and the host measurements stay pending under C17-19.
