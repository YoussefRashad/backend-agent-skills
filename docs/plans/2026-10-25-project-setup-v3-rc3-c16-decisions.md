# C16 decisions and pre-freeze probes

Decisions and probe evidence for the frozen plan
docs/plans/2026-10-25-project-setup-v3-rc3-c16.md (project-setup 3.0.0-rc.3). Later decisions
are appended here; the frozen plan is never edited.

## Provenance

The maintainer chose Lanes mode (class normal) on 2026-10-25 03:35 and delegated overnight
decisions: open plan questions are decided by the orchestrator's recommendation, logged as
"taken overnight under delegation". The freeze followed plan-critique round 3 with no BLOCKING
gap, as that delegation allowed.

## Q1-Q8 (taken overnight under delegation, 2026-10-25)

| Q | Decision | Basis |
|---|---|---|
| Q1 grep syntax | ERE (`-E`), documented with the syntax guidance in C16-9 | BRE silently treats `a|b` as a literal (measured empty success) |
| Q2 invalid pattern | GIT_SAFE_PATTERN through the content-free empty-tree probe (C16-8); GIT_SAFE_GIT unchanged | Plan lane recommended keeping GIT_SAFE_GIT; critique round 1 showed ERE turns `transfer(` into a non-correctable stop and P4 showed the probe works; recommendation reversed |
| Q3 cat cardinality | One path per call | Keeps raw-blob output and bounds |
| Q4 correction budget | At most two rounds per rejected invocation; ARGUMENT and PATTERN only | Recovery without loops; never another tool, never `--out`, never wider paths |
| Q5 nested root import | None; nested-CLAUDE.md unchanged | P2: imports outside the start directory did not load; the root CLAUDE.md always loads |
| Q6 validate/doctor | No change | Low value; would move validate.mjs pins in C13/C14 |
| Q7 structure | Eight descriptors, one pure amendment helper | As recommended |
| Q8 budget | 116 harness-counted launches, 60 s | Includes the probe reserve |

## Facts established before the freeze

- **HEAD was red.** At a290389, `node project-setup/tests/run-component-tests.mjs --component
  C14` exits 1: `FAIL RC1/C14/release`. Cause: commit 8d85ec6 edited the root TODO.md headroom
  entry after the C15 acceptance run, and C14 amendment T anchors on the old text. C16 adds a
  named reversal (H8D85) in its test chain.
- **L10 root cause corrected.** The rc.2 record (branch docs/project-setup-v3-rc2-host-measurements) attributes the Codex `GIT_SAFE_GIT` to a pathspec absent at the commit. Re-probed on the
  fixture: an absent selector is filtered and grep succeeds; the failure was the pattern
  `transfer\(` compiled as a BRE (`\(` opens a group). Under BRE, `validateTransfer|transfer`
  returned an empty success although both words occur.

## Probes

All on Windows 11; one fresh process per case; labs outside this repository.

| Probe | Host | Result |
|---|---|---|
| P1 | Claude Code 2.1.310 headless, rc.2 fixture | Root start: root CLAUDE.md and its AGENTS.md import loaded. Start in src\wallet: root CLAUDE.md loaded, root AGENTS.md import not; nested src\wallet pair loaded |
| P2 | Claude Code 2.1.310 headless, three minimal repos | Start in sub: root AGENTS.md never loaded, `@../AGENTS.md` did not resolve; nested pair loaded when present |
| P3 | Claude Code 2.1.310 headless, labs <lab>\p3 (round-2 L16) and <lab>\p3r3 (final template 5bb1d5ed...) | 8/8 PASS on both, see below |
| P4 | Git 2.53.0.windows.2, SHA-1 and SHA-256 repos | Empty-tree grep: invalid ERE exits 128, valid ERE exits 1, stdout empty; the id must match the object format (the other id exits 128 for every pattern) |

P1, P2 and P3 rest on model self-report and transcripts, one sample per case, not on a host API.
Git 2.31 (the supported floor) and other Claude Code versions and platforms are unprobed.

### P3 detail

Launch: `claude -p '<prompt>' --permission-mode default --output-format stream-json --verbose
--include-hook-events`. Labs built from the rc.2 fixture's installed non-secret files (rc.2
runtime unit and canonical agents, not the C16 candidates) with the candidate root CLAUDE.md;
safe.txt `P3_SAFE_ROOT`, sub/safe.txt `P3_SAFE_SUB`, tags p3-base..p3-head; `outer` holds a real
worktree at .claude/worktrees/x.

| Case | Start, permission flags | Final-template result |
|---|---|---|
| (a) | plain/sub | Zero tool calls; named the root; asked for a root restart. PASS |
| (b) | paired/sub | Zero tool calls; refused despite the nested pair. PASS |
| (c) | plain | Read safe.txt, reported P3_SAFE_ROOT. PASS |
| (d) | plain, cd sub | Set-Location sub, read sub/safe.txt. PASS |
| (e) | plain, `--allowedTools Bash` | Reviewer ran review-diff and completed; no launch refusal. PASS |
| (f) | outer/.claude/worktrees/x | Read the worktree's safe.txt; no outer-rule refusal. PASS |
| (g) | plain, explain prompt | Read safe.txt; stated no restart was needed. PASS |
| (h) | plain, cd sub then reviewer, `--allowedTools Bash PowerShell` | Reviewer ran and completed; no launch refusal. PASS |

On the round-2 text, case (e) first failed because the headless approval gate denied the
reviewer's Bash calls (`--allowedTools 'Bash(node .ai/tools/git-safe.mjs:*)'` did not match a
compound command); with `--allowedTools Bash` it passed. That was a permission failure, not a
launch refusal. In (h) the parent told the subagent that the session started at the root, so the
subagent's own reading of its environment was not isolated. The interactive TUI cases move to the
post-release re-measurement (C16-20).

Transcripts are kept outside the repository (<lab>\evidence-rc2\hm\p3-*.jsonl, p3r3-*.jsonl).

## Plan and critique rounds

| Round | Plan lane (Codex, fresh session each) | Critique (Claude) |
|---|---|---|
| 1 | 1332 lines | 6 BLOCKING, 12 NON-BLOCKING |
| 2 | 1837 lines | 8 BLOCKING, 12 NON-BLOCKING |
| 3 | 2453 lines | No BLOCKING; 4 NON-BLOCKING pinned as freeze addendum C16-F1..F4 |

## Maintainer decisions after the C16 review (2026-10-26)

The Codex review found no BLOCKING gap and three NON-BLOCKING findings (C16-RV1..RV3, listed in
the acceptance record).

| Decision | Disposition |
|---|---|
| Timing of the fixes | Open the PR first; fix RV1-RV3 on the same branch before merge |
| Elapsed milliseconds (C16-13, C16-18) | Not captured: `accept-rc1.mjs` prints no elapsed time. The orchestrator's whole-second wrapper value (1318 s) stands in, with at most one second of rounding. No rerun |
| Empty-tree probe child count (C16-19) | Not captured separately; the probe children are inside `R42/C16/grep`'s 373 launches. No rerun |
