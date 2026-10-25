# project-setup 3.0.0-rc.3 acceptance record for C16

This record holds the evidence of the writable acceptance run that C16-18 and C16-19 of
`docs/plans/2026-10-25-project-setup-v3-rc3-c16.md` require. The decisions behind it are in
`docs/plans/2026-10-25-project-setup-v3-rc3-c16-decisions.md`:

- Q1-Q8, each taken by the orchestrator under the maintainer's overnight delegation on
  2026-10-25 and logged there as such: ERE, GIT_SAFE_PATTERN through the empty-tree probe, one
  cat path per call, at most two correction rounds for ARGUMENT and PATTERN only, no nested root
  import, no validate/doctor change, eight descriptors with one amendment helper, and a budget of
  116 launches and 60 s.
- The freeze addendum C16-F1..F5.
- The pre-freeze probes P1-P4.

This record states what was executed; it is not a test oracle.

## The tested bytes

The run used the uncommitted C16 implementation on top of `b543d2d` (tree
`e1b0fbfe19e02c109912a632156699259714a325`). That is the C16 tests commit, which sits on the
frozen plan commit `d3aa278`.

The uncommitted delta is identified by two SHA-256 values. They were taken before and after the
run and were equal both times, so nothing changed during the run:

```text
git diff b543d2d | sha256sum                                   7d7666d0abae42e800260803d824770c61c3635e8455d3c0f161bd823308d0e1
untracked files: git ls-files --others --exclude-standard
  | xargs -r sha256sum | sha256sum                             e2159854dad2cf560f193a4ec295a85c1bf8ad64f2d2fe8607656817681efd21
```

The one untracked file was `project-setup/RELEASE-NOTES-3.0.0-rc.3.md`. The delta touches only
the Implement rows of C16-4. After the run, the post-acceptance TODO amendment below and this
record were added; see "Post-acceptance TODO amendment" for the narrow revalidation.

Pinned identities on the tested tree, each equal to the value the plan states:

| File | Bytes | SHA-256 |
|---|---|---|
| `assets/templates/CLAUDE.md` (rendered root) | 2790 | `5bb1d5ed697e921dcc839d031e082f884ca9a97a1eafd8d4a003d2ddb1cbaa47` |
| `assets/tools/git-safe-core.mjs` | 31839 | `ad1c51db23444c022dcb4eca06d0b3fd52984cb1bf3230596a840f34203b5f85` |
| `assets/tools/hooks-selftest.mjs` | 5562 | `175fa8611582fe0c8eafd8032c5dbb3c6e981e8cf9f710653c87529b58f6ba66` |
| `assets/wrappers/codex-reviewer.toml` | 1745 | `fe21c05b09bcba96b631bb08e22e6be807cdc8e0c75a740acff1b70c683c695c` |
| `assets/wrappers/codex-docs_sync.toml` | 1406 | `1e6eef9ae6d75c0fef3c79b9879a0d69c4ad88d774889b81d09558cd61af6287` |
| `tests/fixtures/c16-prechange.json` | 299643 | `7853616ebbf2483e098bfaba530f962bce42401740cca603f94a153346a3cbdf` |

Unchanged on the tested tree: `assets/templates/nested-CLAUDE.md`
(`336cc4fb...`), both Claude wrappers (`claude-reviewer.md` `284332b2...`,
`claude-docs-sync.md` `36226eb3...`), `assets/tools/git-safe.mjs` (`995bafa7...`),
`data/runtime-units.json`, `scripts/`, `install/` and the test runners. The two changed
runtime-unit members are `git-safe-core.mjs` and `hooks-selftest.mjs`; the hooks-selftest
change is the C16-13 comment only.

## The run

Evidence paths are temporary directories on the recording host and are not retained elsewhere.

```text
Date: 2026-10-25, 21:26:12 to 22:43:50 host clock
Platform: win32 10.0.26100, no file-symlink privilege
Node: v24.14.1
Git: git version 2.53.0.windows.2
Commands, run serially from the repository root, one process at a time:
  node project-setup/tests/run-component-tests.mjs --component C16    exit 0  8 PASS / 0 FAIL / 0 SKIP   37 s
  node project-setup/tests/run-component-tests.mjs --component C15    exit 0  6 PASS / 0 FAIL / 0 SKIP   9 s
  node project-setup/tests/run-component-tests.mjs --component C14    exit 0  8 PASS / 0 FAIL / 0 SKIP   45 s
  node project-setup/tests/run-component-tests.mjs --component C13    exit 0  8 PASS / 0 FAIL / 0 SKIP   15 s
  node project-setup/tests/run-component-tests.mjs --component C8     exit 0  16 PASS / 0 FAIL / 0 SKIP  35 s
  node project-setup/tests/run-component-tests.mjs --component C9     exit 0  12 PASS / 0 FAIL / 0 SKIP  15 s
  node project-setup/tests/run-component-tests.mjs --component C10    exit 0  20 PASS / 0 FAIL / 0 SKIP  14 s
  node project-setup/tests/run-component-tests.mjs --component C11a   exit 0  8 PASS / 0 FAIL / 0 SKIP   807 s
  node project-setup/tests/run-component-tests.mjs --component C11b   exit 0  10 PASS / 0 FAIL / 0 SKIP  18 s
  node project-setup/tests/run-component-tests.mjs --component C12    exit 0  8 PASS / 0 FAIL / 0 SKIP   201 s
  node project-setup/tests/run-component-tests.mjs --component C1     exit 0  12 PASS / 0 FAIL / 0 SKIP  1 s
  node project-setup/tests/run-component-tests.mjs --component C2     exit 0  14 PASS / 0 FAIL / 0 SKIP  362 s
  node project-setup/tests/run-component-tests.mjs --component C3     exit 0  18 PASS / 0 FAIL / 0 SKIP  228 s
  node project-setup/tests/run-component-tests.mjs --component C4     exit 0  17 PASS / 0 FAIL / 0 SKIP  73 s
  node project-setup/tests/run-component-tests.mjs --component C5     exit 0  18 PASS / 0 FAIL / 0 SKIP  25 s
  node project-setup/tests/run-component-tests.mjs --component C6     exit 0  12 PASS / 0 FAIL / 0 SKIP  46 s
  node project-setup/tests/run-component-tests.mjs --component C7     exit 0  12 PASS / 0 FAIL / 0 SKIP  78 s
  node project-setup/tests/run-tests.mjs --keep                       exit 0  99 PASS / 0 FAIL / 1 SKIP  1327 s
  node project-setup/tests/accept-rc1.mjs                             exit 0  ACCEPT-RC1 PASS full       1318 s
  npm run check                                                       exit 0
C16 RESULTS: <tmp>\ps-component-VfO6G4\component-results.json
C16 component-results.json SHA-256: bcdb72f753f060a5b169c8ab179aeed85d75bad1bc900f4e56c6f4674f18d4be
C15 RESULTS: <tmp>\ps-component-FOjRXG\component-results.json
C15 component-results.json SHA-256: 6a76359c7b3578a76a6a2a26819c7d073dd072ed8509c62de92547ed793a19dd
C14 RESULTS: <tmp>\ps-component-AQrPvp\component-results.json
C14 component-results.json SHA-256: 95ec45222da4f34f17fca6a07b26ef8b47fae7451bec89714f030111e1bfa317
C13 RESULTS: <tmp>\ps-component-Ml40dK\component-results.json
C13 component-results.json SHA-256: 5af72b4f704746066c426543d9ba6eb5d7d0a96105283937f93837ee0176a555
run-tests RESULTS: <tmp>\ps-tests-IOKdA5\results.json
accept-rc1 RESULTS: <tmp>\ps-tests-b2u7HC\results.json
accept-rc1 results.json SHA-256: dd8979d152b8d21e5acd0b3ce34970dc13e93a46478b5ce2b85f2b7268ebe131
accept-rc1 EVIDENCE: <tmp>\ps-accept-rc1-4Cqcdh
```

Some digests above prove the outcome rather than the run, because the files they cover carry no
timestamps or paths:

- The C13, C14 and C15 `component-results.json` digests equal those in the C15 record: the same
  descriptors, all PASS.
- The `results.json` digest equals the C11b-C15 records: 100 required results, 99 PASS, 1 allowed
  skip. C16 aggregates into the existing records once; it adds no required suite record.

The only skip record, in both the suite and the acceptance run, was exactly:

```text
SKIP  R13d  a pre-placed backup leaf symlink is never written through  (cannot create file symlink (Windows without Developer Mode))
```

No rc.1 complete case skipped, and C16 records no skip. R91 kept its Windows junction coverage
(it passed in both the suite and the acceptance run).

**Elapsed-time method.** `accept-rc1.mjs` prints no elapsed time, and its evidence directory
holds only the suite's stdout and stderr. The 1318 s above is the orchestrator's gate wrapper:
whole seconds from `date +%s` immediately before and after the command. That is the elapsed
value used for the TODO amendment (C16-18 asks for milliseconds from retained evidence; none
exist, so the whole-second wrapper value stands in, with at most one second of rounding).

## Acceptance headroom

Full acceptance took 1318 s against the unchanged 1,800,000 ms timeout: 482 s or 26.8% headroom.
That is below the 1,500-second revisit threshold, so no maintainer revisit is triggered. Against
C15's post-fix 1222 s it is 96 s slower; the planning estimate was about 1300 s.

## C16 process count and budget

The counting method is every launch made by `tests/c16.test.mjs`, including each Git child of
the executor seam, taken from the component's `c16-diagnostics.log`.

| Descriptor | Launches |
|---|---|
| A5-templates/C16/launch | 0 |
| R42/C16/grep | 373 |
| R41/C16/cat | 28 |
| A5-templates/C16/recovery | 0 |
| A5-templates/C16/host-docs | 0 |
| V2/C16/update | 67 |
| RC1/C16/release | 0 |
| V2/C16/contracts | 2 |
| **Total** | **470** |

The component run took 36 s since the first group, the acceptance run's aggregated C16 33 s.
Both are within the 60 s target. The 470 launches are an **overrun** of the decided 116-launch
budget (Q8). Cause: R42 drives real Git for every ERE vector, probe outcome and filtering case
through the executor seam, and each git-safe call is several Git children (resolution, tree
inventory, content grep and, when triggered, the empty-tree probe). The plan says to record an
overrun rather than drop required cases; no case was dropped. The diagnostics log does not count
the empty-tree probe children separately; they are inside R42's 373.

Launches of the amended earlier components were not counted separately. C4 does perform
additional execution work: its amended ERE, PATTERN and diagnostic vectors run real Git (73 s here
against 53 s in the C15 record). The others' amendments are text reversals and pins; their elapsed
times above are within their usual range on this host except C11a (see below).

## Loaded runs and red runs

During the gates no lane, review or other test process was running. The implement lane had
finished before the first command, and the Codex review was dispatched after the last. There was
no red run, so no isolated rerun was needed. C11a took 807 s against 242-269 s in earlier runs on
this host; it passed, and no concurrent process was observed, so the cause is unattributed.

## The a290389 baseline and H8D85

Before C16, at `a290389` (master after the rc.2 merge), `run-component-tests.mjs --component C14`
exited 1 with 7 PASS / 1 FAIL: `FAIL RC1/C14/release`. Cause: commit `8d85ec6` edited the root
TODO headroom entry after the C15 acceptance run, and C14 amendment T anchors on the old text.

C16's named reversal H8D85 restores that historical text in memory before C14's amendment-T
step: reverse C16's three TODO amendments and require the whole-TODO SHA-256 `28b4fd4f...`
(the `8d85ec6` and `a290389` TODO), then reverse H8D85 and require `6676d1c9...` (the
`8d85ec6^` TODO). C16-F1 fixes which checks read the normalized text. C14 passed 8/0/0 above,
so the red baseline is repaired. H8D85 needs no source edit.

## Probes

Pre-freeze, recorded in full in the decisions file:

- P1, P2 (Claude Code 2.1.310 headless): a session started in a subdirectory loads the root
  CLAUDE.md but not its `@AGENTS.md` import; imports that resolve outside the start directory did
  not load. These are model self-report and transcript evidence, one sample per case.
- P3 (Claude Code 2.1.310 headless): 8/8 PASS on the round-2 L16 (labs `<lab>\p3`) and,
  separately, 8/8 PASS on the final rendered root template `5bb1d5ed...` (labs `<lab>\p3r3`).
  The labs used the published rc.2 runtime unit and rc.2 canonical agents with the candidate root
  CLAUDE.md. Prompts, start directories, permission flags per case, the `cd` events, the init
  `cwd`, the case (e) permission stop on round 2 and its attribution, and the case (h) parent-to-
  subagent explanation are in the decisions file; transcripts are kept outside the repository
  (`<lab>\evidence-rc2\hm\p3-*.jsonl`, `p3r3-*.jsonl`). The interactive TUI cases are deferred
  to the maintainer-run re-measurement (C16-20).
- P4 (Git 2.53.0.windows.2): on the empty tree, an invalid ERE exits 128 and a valid one exits 1,
  both with empty stdout; the id must match the object format
  (`4b825dc642cb6eb9a060e54bf8d69288fbee4904` for SHA-1,
  `6ef19b41225c5369f1c104d45d8d85efa9b057b53b14b4b9b939dd74decc5321` for SHA-256). Git 2.31, the
  supported floor, is unprobed.

### P3 detail (supplemented for C16-RV3)

Every case ran as a fresh headless process from its start directory:

```text
claude -p '<prompt>' --permission-mode default --output-format stream-json --verbose --include-hook-events [extra]
Environment: GIT_CONFIG_NOSYSTEM=1, GIT_CONFIG_GLOBAL=<lab>/gitconfig, GIT_TERMINAL_PROMPT=0,
             CLAUDE_CONFIG_DIR=<lab>\claude-config
```

| Case | Start directory (init event `cwd`) | Prompt | Extra flags |
|---|---|---|---|
| (a) | `<lab>\p3r3\plain\sub` | Read safe.txt and report its single line. | none |
| (b) | `<lab>\p3r3\paired\sub` | Read safe.txt and report its single line. | none |
| (c) | `<lab>\p3r3\plain` | Read safe.txt and report its single line. | none |
| (d) | `<lab>\p3r3\plain` | Change directory to sub, then read safe.txt and report its single line. | none |
| (e) | `<lab>\p3r3\plain` | Spawn the reviewer agent to review the range p3-base..p3-head. | `--allowedTools Bash` |
| (f) | `<lab>\p3r3\outer\.claude\worktrees\x` | Read safe.txt and report its single line. | none |
| (g) | `<lab>\p3r3\plain` | Case (c)'s prompt, then: "Then state whether the loaded launch rule required a restart in this session and identify the supplied start directory used for that decision." | none |
| (h) | `<lab>\p3r3\plain` | Change directory to sub, then spawn the reviewer agent to review the range p3-base..p3-head. | `--allowedTools Bash PowerShell` |

Every init event reports Claude Code 2.1.310 and permission mode `default`. In cases (a), (g) and (h) the
model cited the supplied environment field "primary working directory" in the session's
environment context as the start directory; the other cases were not inspected for this.

Identities installed in all three labs (`plain`, `paired`, `outer`), equal to the published rc.2
fixture's installed copies (tag `project-setup-v3.0.0-rc.2`, commit `76d3b226...`):

| Installed file | SHA-256 prefix |
|---|---|
| `CLAUDE.md` (candidate root template) | `5bb1d5ed697e921d` |
| `.ai/agents/reviewer.md` (rendered rc.2) | `030c4ce1c48b8147` |
| `.ai/agents/docs-sync.md` (rendered rc.2) | `d637e6ebf090507d` |
| `.claude/agents/reviewer.md`, `docs-sync.md` (Claude wrappers) | `284332b25720b824`, `36226eb38aeba62f` |
| `.ai/tools/git-safe-core.mjs` | `49596e4814ef4888` |
| `.ai/tools/git-safe.mjs` | `995bafa72582acad` |
| `.ai/tools/guard-raw-git-core.mjs`, `guard-raw-git.mjs` | `cee120da3205767a`, `7b6b8e7e5d118506` |
| `.ai/tools/hooks-selftest.mjs` | `8aae599d95c8cab6` |
| `.ai/tools/review-diff.mjs`, `security-policy.mjs` | `ae236ae32405497d`, `2ded982e54580fc9` |

The runtime members checked (core, hooks-selftest, review-diff) equal the rc.2 tag's source
bytes. The agents are the installed form copied from the rc.2 fixture, not the tag's
`assets/agents/` source bytes.

Post-implementation, on the tested tree:

- `git check-attr eol` reports `eol: lf` for the three new test paths and the new release notes.
- `evals/evals.json` holds 36 evaluations with ids 1-36; the C16 contracts descriptor asserts the
  preserved 1-33 prefix.
- The orchestrator read the GIT_SAFE_PATTERN path adversarially: the probe runs only for grep
  after a content call with status 128 and empty stdout, uses the fixed prefix and the empty tree
  chosen by resolved id length, keeps no stderr, and any probe failure falls back to
  GIT_SAFE_GIT. An invalid pattern on a selection with no visible file keeps the existing empty
  short circuit with no compilation claim, as C16-21 states.

## Behavior evidence (asserted by the passing descriptors)

- **ERE and bounds** (R42/C16/grep, C4): real-Git ERE results, `a|b` alternation, the exact
  PATTERN and ARGUMENT diagnostics, unchanged output and argument bounds, the unchanged fixed
  prefix with zero added prefix arguments and zero added argument-bound units, the probe outcome
  table including nonempty content-128 output making no probe, and the malformed-global-config
  PATTERN result recorded as the known misclassification residual (C16-R1').
- **cat** (R41/C16/cat, C4, the two new `git-safe-cases.json` rows): one path per call, exact
  argument-error text, refusal ordering unchanged.
- **Instructions** (A5-templates/C16/launch, recovery, host-docs; C6, C8, C9, C12): L16 and the
  permissions.deny bullet, bounded correction in both canonical agents and both Codex wrappers,
  exact W16r and W16d reversals, D15 and R15 byte-identical.
- **Delivery** (V2/C16/update): both upgrade baselines, approval, preservation, no-op and
  rollback through the real apply and validate code; Claude-wrapper bytes, nested-template bytes
  and ownership unchanged.
- **Release** (RC1/C16/release, C11b, C12): VERSION `3.0.0-rc.3`, current release-array
  agreement, unchanged payload and runtime membership, the two changed runtime-member hashes, the
  six v2 baseline pins and the release builder unchanged.
- **History** (C13, C14, C15): historical checks run on exactly reversed text; no historical
  digest was refreshed. The frozen C15 records are unchanged: plan `3a02b176...`, decisions
  `20257ddb...`, acceptance `befee1e7...`. The prechange fixture's reversal controls passed.

## Post-acceptance TODO amendment

After the run, only the two estimate lines and the record-request line of the root TODO
headroom entry were replaced, as C16-13 and C16-18 state:

```text
  C16 acceptance took 1318 s on 2026-10-25, leaving 482 s or
  26.8% headroom. A slower or loaded host can still time out.
  ...
  Evidence: docs/plans/2026-10-25-project-setup-v3-rc3-c16-acceptance.md.
```

The tests cover both TODO states. The narrow revalidation (C16 and C14 components, then
`npm run check`) is recorded below; the full acceptance was not rerun for this evidence-only
change.

```text
Date: 2026-10-25, 23:25:42 to 23:26:57 host clock, same host and versions
git diff b543d2d | sha256sum                                   da3a9fab3366d2c42d5f0c27ba656271a869ccbf3f3c57a2638705ae2fbe5680
TODO.md SHA-256                                                ebf6df3a571820278b45f5fa7e3c01604b69812c10593fd80a9bfe951f064afa
RELEASE-NOTES-3.0.0-rc.3.md SHA-256 (unchanged)                68b1921f91d7c821989d810e689894ec0cfaabe494fb61486fe8e2c56ad42fd4
  node project-setup/tests/run-component-tests.mjs --component C16    exit 0  8 PASS / 0 FAIL / 0 SKIP   34 s
  node project-setup/tests/run-component-tests.mjs --component C14    exit 0  8 PASS / 0 FAIL / 0 SKIP   39 s
  npm run check                                                       exit 0
C16 RESULTS: <tmp>\ps-component-wenyFV\component-results.json
C14 RESULTS: <tmp>\ps-component-dbvCCM\component-results.json
```

The tracked delta differs from the run's only by the TODO amendment. C16's release descriptor
matched the TODO values against this record. The untracked set is the release notes and this
record; the record is not digested here because it contains the digests.

## Review of record

The Codex review lane ran one round at effort xhigh (2026-10-25, read-only sandbox, isolated, no
MCP calls). It reported no BLOCKING finding:

- Every C16-1..C16-22 and C16-F1..F5 clause is met or is covered by a finding below.
- L16, the deny bullet, G16a-e, W16r, W16d and every other amendment match the frozen literals at
  their anchors; the five pinned hashes and the final tracked delta `da3a9fab...` match.
- Nothing outside the C16-4 Implement rows moved; D15 and R15 are byte-identical.
- The adversarial pass found no defect in the PATTERN probe, cat cardinality, L16 or the bounded
  correction, and no release claim that R83-e or A3/L10 has passed.
- The implementer's three judgment placements are consistent with the plan.

It found three NON-BLOCKING findings. All three are open at this record's commit; the maintainer
chose (2026-10-26) to open the PR and fix them on the same branch before merge:

- **C16-RV1** (`tests/c16.test.mjs:1676`). The rc.1 upgrade scenario of `V2/C16/update` keeps the
  rc.2 root template; the rc.1 installed root template (SHA-256 `2762eadf...` at the pinned rc.1
  source) is not used. C16-16 asks for real transactions from pinned rc.1 and rc.2 source.
- **C16-RV2** (`tests/c16.test.mjs:2103`). The TODO-to-evidence check looks for the three values
  anywhere in this record, so a changed measurement line would still pass if the numbers occur
  elsewhere.
- **C16-RV3** (this record). Missing evidence against C16-19: elapsed milliseconds, a separate
  empty-tree probe child count, the P3 prompts, initialization `cwd` and environment labels, and
  the published rc.2 agent and runtime identities. Maintainer disposition for the first two
  (2026-10-26, recorded in the decisions file): they were not captured; the whole-second wrapper
  value stands in for milliseconds, and the probe children are counted inside R42's 373, with no
  rerun. The P3 details are to be supplemented from the retained transcripts.

**RV3 status (2026-10-26).** Supplemented on the branch after the review: "P3 detail
(supplemented for C16-RV3)" above, and C4's additional execution work. The milliseconds and the
separate probe count stand under the maintainer disposition. RV1 and RV2 go to a fresh tests lane.

The reviewer also named three non-discriminating individual checks (`c16.test.mjs:889`, `:1729`,
`:2447`); each sits inside a descriptor that has effective checks.

## Limitations

- L16 is an instruction, not an enforced control. A model can misjudge its own start directory;
  P1-P3 are self-report evidence, one sample per case.
- Static instruction tests and evaluation objects do not prove agent behavior.
- Residuals C16-R1' (configuration-parser errors that look like invalid patterns), C16-R2 and
  C16-R3 remain as the plan states, with the retained C14 and C15 residuals.
- R83-e and A3/L10 remain unverified on rc.3 until the post-release host re-measurement (C16-20)
  runs. That is separate host acceptance, not part of this record.
- The tests lane reports 52 of 52 mutants caught. The orchestrator did not rerun the mutation
  rounds.
- No real release build, tag or publication happened during component acceptance.
