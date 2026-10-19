# C6 review decisions

Decisions taken during the C6 implementation review. The frozen plan
`docs/plans/2026-10-19-project-setup-v3-rc1-c6.md` is not edited; where an item below and the plan
differ, the item wins.

## Review round 1 (Codex, 2026-10-19): I6-1 to I6-7

The review found one BLOCKING and three NON-BLOCKING findings, and assessed three implementer
observations. The maintainer took five fixes, one recorded behaviour and one documentation item.

- I6-1 (C6-R1, fix). Section 3.8 applies to both staging modes. Before the normal merge reads
  installed settings, the staged settings draft or a request file (`--allow-file`, staged
  `ownership.json` and `managed-keys.json`), it applies the same guarded reader as hooks-only
  staging: containment and link checks, no following of links or junctions in run or project
  input paths, and the shipped-plus-installed refusal set on the logical target and the actual
  read path, all before reading. A protected input gives `HOOK_STAGE_PROTECTED` (exit 3) and an
  unsafe or linked path gives `HOOK_STAGE_PATH` (exit 2), with the section 3.10 envelope; both
  happen before any write. Pre-existing normal-merge failures (for example invalid settings JSON
  and `DENY_SETTINGS`) keep their established envelopes. Tests add normal-mode cases for a
  protected settings path (a project policy pattern covering `.claude/settings.json`) and a
  junctioned `.claude` directory, with read recording (no read of the protected file) and
  unchanged project and run files.
- I6-2 (C6-R2, recorded behaviour). Bash `{` and `}` stay command-position keywords that are not
  balance- or depth-checked. Checking them as the plan states would turn `{ git log` from BLOCK
  into MALFORMED, which the frozen fail-open contract allows with the warning; the current
  behaviour is stricter. A lone `}` allows and deep brace nesting is not limited. No code change
  and no test change.
- I6-3 (C6-R3, fix). The merge script loads `guard-raw-git-core.mjs` so that its absence or a load
  failure is catchable: in either mode, when guard readiness is evaluated and the trusted core
  source is missing or fails to load, the result is `HOOK_STAGE_SOURCE` (exit 3) with error
  `trusted hook source is unavailable: assets/tools/guard-raw-git-core.mjs` and that path as
  `target`, before any write. A normal merge with no hook work does not need the core. Tests add
  the missing-core case for both modes in a scratch skill copy.
- I6-4 (C6-R4, fix). C6-P2-1 applies to both modes: when the normal merge changes
  `transaction-inputs.json`, its success report carries `metadataChanged: true`; otherwise
  `metadataChanged: false`. `changed` keeps its existing meaning. Tests add an installed-guard
  normal merge (append) and its unchanged rerun (`metadataChanged: false`).
- I6-5 (observation k, plan amendment, fix). In PowerShell, a leading variable assignment at
  command position is skipped and the command after it is inspected: a token `$` followed by an
  identifier (`[A-Za-z_][A-Za-z0-9_]*`, optionally with a `scope:` prefix such as `env:` or
  `script:`), then `=` either attached (`$x=git log`) or as a separate token. Only `=` is covered;
  compound operators (`+=` and others) and typed assignments (`[string]$x = ...`) stay residuals.
  New parser rows: `$x = git log -p` BLOCK; `$x=git log` BLOCK; `$env:X = git show HEAD` BLOCK;
  `$x = git status` ALLOW; `$x = "git log"` ALLOW; `$x += git log` ALLOW (residual, pinned).
  Bash is unchanged.
- I6-6 (observation l, documentation). Bash `case` statements are not parsed. The README section
  "Claude raw-Git hook" gains one new paragraph, placed directly after the "Known gaps"
  paragraph, which itself is unchanged: `Bash case statements are not parsed: a command
  containing one is reported as unparseable and allowed with the malformed-input warning.`
  Tests assert the paragraph (whitespace-normalized) and that the existing paragraphs still match.
- I6-7 (observation m, documentation). `references/security.md` section 2 names the installed
  reviewed unit as seven files: `security-policy.mjs`, `git-safe-core.mjs`,
  `guard-raw-git-core.mjs`, `review-diff.mjs`, `git-safe.mjs`, `guard-raw-git.mjs` and
  `hooks-selftest.mjs`, and no longer says "four files". Tests assert that all seven names appear
  in that sentence and that "four files" is gone.

Implementation notes taken with the maintainer (2026-10-19):

- I6-8 (I6-1 scope). `--allow-file` is not moved onto the guarded reader in C6. It may lie outside
  the repository (the C3 CLI tests pass one), and the guarded reader's containment check would
  refuse it. It keeps its existing check against the shipped refusal set and its established
  envelopes. C7 owns `--allow-file` handling: its frozen plan refuses every nonempty selection
  (C7-PQ1) and pins how the file is resolved and checked. I6-1 covers installed settings,
  `ownership.json` and `managed-keys.json`; the normal merge never reads the staged settings
  draft.
- I6-9 (I6-6 wording). The I6-6 sentence describes the usual `case` arm form (`a)`). With the
  optional parenthesised pattern form (`(a) git log;;`) the pattern is lexed as a group and the
  command after it is inspected, so `case x in (a) git log;; esac` gives BLOCK. That is stricter
  than the README sentence states; the sentence stays as written.

## Review round 2 (Codex, 2026-10-19): I6-10

The review found no BLOCKING issue and confirmed the round-1 fixes. One NON-BLOCKING finding is
accepted by the maintainer as recorded behaviour.

- I6-10 (C6-R5). An ordinary read failure (for example `EACCES` or `EIO`) on `ownership.json` or
  `managed-keys.json` in the normal merge now gives the section 3.10 `HOOK_STAGE_IO` envelope
  (`code`, `error`, `target`; exit 2) instead of the earlier `{ ok: false, error }` envelope with
  the native message; the exit code is unchanged. Accepted: the guarded read is what I6-1
  requires, and the new envelope carries more information. No code change and no test change.
