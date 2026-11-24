# project-setup 3.2.0: TUI runbook execution attempt, results

Status: evidence record, not an acceptance verdict. It follows `docs/plans/2026-11-24-project-setup-v3.2-tui-runbook.md` and
`docs/plans/2026-11-24-project-setup-v3.2-unmeasured-items-results.md`. It changes no shipped byte and edits no frozen plan.
Dated 2026-11-24 to 2026-11-25 (session local time, around midnight). Repository base: main at 7fe4017.

Result in one line: none of the TUI-only rows could be measured by this session. The later maintainer runs are recorded in the
addenda (Codex P4 passed on one sample; Rows A and B reached Phase 0 only and are incomplete). Every other row is BLOCKED, for the two
reasons below. Nothing was fabricated; the only TUI screen read is the Codex trust dialog quoted under "What was observed".

## Common record

- Host: Windows 11 Pro 10.0.26100, Node v24.14.1, Claude Code 2.1.330, codex-cli 0.163.0. Installed project-setup 3.2.0
  (`detect.mjs` reports `skillVersion` 3.2.0, mode `update` on the `d9f-ps-first` fixture at `6861636`).
- Method attempted: an interactive session in the user's Terminal panel through the terminal tools
  (`run_in_terminal`, `list_terminal_tabs`, `read_terminal`, `stop_terminal_tab`), one tab, started at an absolute fixture root.
- Fixture work done: one throwaway clone `D:\ContactRepos\codex-fixtures\tui\p4` of `D:\ps-live\u32\d9f-ps-first\service` at
  `6861636` (inherits the `CodexSandboxUsers` entry from `D:\ContactRepos\codex-fixtures`; checked with `icacls`). No other clone
  was made. The preserved originals were not touched.
- Global delegation protocol: Normal mode was not asked, because no row ran.

## Why every row is blocked

1. No input channel into a running TUI (measured). `run_in_terminal` types one command line plus Enter and, with a `tab_id`,
   accepts only a tab whose shell is back at its prompt. `list_terminal_tabs` reported the tab with Codex running as
   `is_running_command: true, reusable: false`. `open_terminal_tab` types nothing. `read_terminal` only reads. So this session can
   start `claude` or `codex` and read the first screen, but cannot type a prompt, press a key, or answer a dialog in it.
   Other process drivers were not used: a piped process is not a TTY, so it would not be the interactive default-mode run the
   rows ask for.
2. The approval dialogs are a human step by rule. The default-mode rows exist to show the real Allow/Deny prompts, and
   answering a Claude Code permission prompt for the user is an action this session may not take, whatever a brief says. The
   runbook states no per-prompt answers either. The same holds for the first Codex dialog, which is not in the runbook (below).

## What was observed (the only TUI output read)

`codex` started at `D:\ContactRepos\codex-fixtures\tui\p4` showed, before any prompt, a "Folder access" screen: "Trust this
folder? Codex can read, edit, and run files here, subject to your permission settings. Folder settings can run code automatically,
even without a model request. Your trust decision will be saved." with options "1. Trust and continue" and "2. Back to Agent Command
Center". The runbook does not cover this dialog and the answer writes a trust entry into the user's Codex configuration, so it was
not answered; the tab was closed with its close button. Checked afterwards: `~/.codex/config.toml` has no entry for the fixture path.
Consequence for whoever runs section 3: expect this dialog on a fresh clone location and decide it yourself.

## Rows

| Row (runbook section) | Status | Reason and what is known without the TUI |
|---|---|---|
| Section 1, row A: default-mode adopt | BLOCKED for this session; Phase 0 only run by the maintainer (see addendum), row INCOMPLETE | Reasons 1 and 2. Phase 0 observed from a paste; prompts, plan hash, commit and validate not recorded. |
| Rows named in the task (blank section, renamed heading, deleted pointer, local-instruction conflict, unchanged rerun) in default mode | BLOCKED | Reasons 1 and 2. The runbook carries these mutations only as section 4 (Codex, fixtures `D:\ps-live\rows\r1` to `r5`); no interactive run of any of them was made. |
| Section 1, row B: default-mode update on `d9f-ps-first` | BLOCKED for this session; run to commit by the maintainer (two addenda), outcome PS self-reported, validate and git state independently confirmed by the maintainer, permission prompts not recorded, row PARTIAL | Reasons 1 and 2. Observation made here: `detect.mjs` at `6861636` reports mode `update`, one `warnings` entry that `.ai/.setup.lock` exists in the kept fixture (the runbook says clones do not carry it). |
| Section 2: L16 launch rule in the TUI (P3 h) and its negative control | BLOCKED | Reasons 1 and 2. The headless result (Claude Code 2.1.330) in `2026-11-22-project-setup-v3.2.0-live-results.md` D2 stands unchanged and is not extended. |
| Section 3: Codex P4 project-context check | BLOCKED for this session; later MEASURED by the maintainer (see "Addendum: P4 run by the maintainer") | Reason 1, plus the trust dialog. Setup part measured here: the first bullet under `Critical rules` in the clone's `AGENTS.md` starts "Never read, print, copy, or summarize files matching `.ai/security-paths.json`", and the first words of `~/.codex/AGENTS.md` are "## Delegated roles". They differ, so the probe can discriminate. |
| Section 3b: Codex deny-read profile canaries | NOT ATTEMPTED | Needs a paste into `~/.codex/config.toml`, which this session does not edit, and a TUI. Not in the task. |
| Section 4: Codex PS rows r1 to r5 and doc-writing case | NOT ATTEMPTED | Needs a Codex session that may write and approve; reasons 1 and 2. Not in the task's list beyond the row names above. |
| Section 5: P8 Codex ownership grant | BLOCKED | `git config --global --get-all safe.directory` still lists a wildcard (`*`) beside exact entries. The runbook gives no way that leaves the global Git config untouched, and the user's global Git config was not changed. |

## Addendum: P4 run by the maintainer (2026-11-24, about 23:19 local)

The maintainer ran runbook section 3 by hand in their own Terminal tab and pasted Codex's reply into the chat of this session. This
session did not see the TUI; everything below comes from that paste and from the clone on disk. The clone was recreated by the maintainer from the
runbook commands (`D:\ContactRepos\codex-fixtures\tui\p4`, clean at commit `6861636` when checked here after the run; this session had
deleted its own copy earlier). Version of codex-cli at the run: NOT recorded. This session read 0.163.0 earlier that evening, but the
maintainer's Row A and Row B sessions later reported codex-cli 0.172.0, and `codex --version` on the host reads 0.172.0 at 2026-11-25
shortly after midnight, so the host was upgraded in between and the P4 run was most likely on 0.172.0 (inferred, not observed). Whether the maintainer
answered the trust dialog and how is not recorded here.

- Prompt: the exact section 3 prompt (quote the first bullet under "Critical rules" in the `AGENTS.md` of this project, say which file,
  run no command).
- Reply (paste): a quote of the whole first bullet, then "I quoted the project's AGENTS.md (AGENTS.md) from the text you provided."
  Footer "Worked for 7s".
- Check made here, on disk, ignoring the backtick formatting the paste lost: the quoted text equals the first bullet in the clone's
  `AGENTS.md` lines 18 to 25 (it includes the two indented continuation lines about `git-safe` and the env variable names). It does
  not match the first words of `~/.codex/AGENTS.md` ("## Delegated roles"), so the probe did discriminate.
- Result: PASS on the section 3 criterion (quote equals the project bullet, attribution names the project file), one sample, codex-cli
  version unrecorded (0.163.0 or, more likely, 0.172.0), Windows, one fixture. It shows that Codex at that fixture root had the project `AGENTS.md` text in its context before any
  command; it does not show the mechanism.
- Caveats: the paste is the final answer only, so "no command was run" is inferred from the 7 s run time and the reply wording, not
  read from the TUI; the phrase "from the text you provided" was Codex's own and is not explained here; model and effort were not
  recorded.

## Addendum: Row A and Row B, Phase 0 only, run by the maintainer (2026-11-24 about 23:26 to 2026-11-25 00:03 local)

Source: the maintainer's pastes of the two Claude Code TUI screens into the chat of this session. This session did not see either TUI,
so permission-prompt counts, the status line, and the answers the maintainer gave are NOT recorded. Both rows were pasted up to the
first decision dialog and are INCOMPLETE: no plan hash, no commit and no `validate.mjs` result exist for either. Permission mode:
`--permission-mode default` as the runbook says (stated by the runbook command, not read from the paste). Clones on disk after the
pastes: `D:\ps-live\tui\row-a` clean at `688bff6`, `D:\ps-live\tui\row-b` present (state not checked). Claude Code version: Row B's
report says 2.1.331 and `claude --version` on the host reads 2.1.331; Row A's report says it could not read the version because
`claude` was not on its PATH. Codex 0.172.0 in both reports.

Row A (adopt, clone of `d5-adopt` at `688bff6`), observed in the paste:

- Phase 0 wrote nothing (it said so: no lock, run directory or drafts). Mode adopt (no `.ai/manifest.json`, no v1 provenance), one
  active copy (user scope 3.2.0, the synced 3.1.0 copy off by `skillOverrides`, no installer backups). That is the runbook's first
  expectation, observed.
- Mapping on: no stamp, the provenance sentence at `CLAUDE.md:70` and the import at `:26`; 03 273 lines, 19,693 bytes, the same
  baseline as the headless adopt of 2026-11-24. One heading did not resolve: `Database > Schema changes`.
- Provisional pointer set: six applicable (project-tree, critical-modules, error-contract, configuration, api-conventions,
  observability), glossary and database "depend on" the maintainer's answer, integrations not applicable, and `code-patterns.md`
  SKIPPED as near-empty. The headless adopt of 2026-11-24 recommended eight pointers and wrote code-patterns in full, so this
  interactive run differs on the recommended list (the same instability the unmeasured-items results record for update runs).
- It asked nine decisions at once (working mode, adopt and mapping, whether a "None" section is a fact, the missing heading,
  CLAUDE.md handling, three 03 edits, agents, reviewer conflicts, owner sentence), each with a recommended answer. Conflicts it held
  for decision: the `reviewer.md` line that allows unredacted Class B/C logs under a risk acceptance (it said approval cannot make a
  project rule relax a canonical one), the NIT label and the output format. No plan hash was shown in the paste.

Row B (update, clone of `d9f-ps-first` at `408c3bb`), observed in the paste:

- Mode update from `.ai/manifest.json` schema 3, one active copy, the synced copy off. Mapping on with a valid stamp 3.1.0, the sentence
  and the import; all 15 headings of 03 resolve.
- Per-file drift: PS named that backend-standards overwrote both Claude wrappers and printed the hashes `c151e6...` against
  `284332...` (reviewer) and `1d9585...` against `36226e...` (docs-sync), the same prefixes as the headless record in the
  unmeasured-items results 1b. It offered keep / take-new / merge for each wrapper independently, did not overwrite, and held every
  write until the decisions. Expected observation "recovery choices instead of overwriting silently": observed (Phase 0 only).
- `validate.mjs` as PS reported it: 16 pass, 0 fail, 2 warnings (drift on both wrappers).
- It proposed the PORT=3000 consolidation (the planted 8080 contradiction in `configuration.md:7`), two new coverage entries
  `env/**` and `cert/**`, and a TODO consolidation record. Its first dialog (tabs Mode, Reviewer, Docs-sync, Applicable, Submit) offered
  "Normal (Recommended)" for the working mode and stated that approving it also approves the Phase 0 plan; the maintainer's answer is
  not in the paste.
- The 2026-11-24 headless update recorded a recommended list of six pointers on this fixture and a Reading A of eight; this
  interactive run shows "applicable" for six and two "depend on your answer", the same shape.

Not measured in either row: the permission prompts (count, wording, the status line), the plan hash, any write, commit, final
`validate.mjs --json` and `git status`.

Runbook defect found by the maintainer's run: the command `node ~/.claude/skills/project-setup/scripts/validate.mjs --json`, typed in
PowerShell, failed with MODULE_NOT_FOUND because PowerShell does not expand `~` in a native-command argument (it looked for
`D:\ps-live\tui\row-a\~\.claude\...`). It is a shell-syntax slip, not a skill fault; the PowerShell form is
`node "$HOME\.claude\skills\project-setup\scripts\validate.mjs" --json`. The runbook (a plan document, not edited) and this session's
reply that repeated the command both used the `~` form. No validate result was obtained from it.

## Addendum: Row B continued to commit, run by the maintainer (2026-11-25, about 00:06 to 00:14 local)

Source: further pastes of the same Claude Code TUI (Claude Code 2.1.331, `--permission-mode default` per the runbook command). Every
statement below is PS's own report or dialog text as pasted; this session did not read the repository, the clone's `git status` or
any file of the clone, and has not run `validate.mjs` there. Self-reports are labelled as such.

Observed in the dialogs (as pasted):

- Decisions answered by the maintainer on the first dialog: working mode Normal; reviewer wrapper Merge; docs-sync wrapper Merge;
  "a section that only says None counts as a fact": Yes, literal rule (so glossary and database become pointers). The Applicable tab
  itself held that last question only.
- Prepare stopped with exit 3 and asked for explicit `--approve-user-content` for exactly six paths: `.ai/security-paths.json`,
  `.ai/standards/03-project-architecture.md`, `.ai/standards/known-deviations.md`, `.claude/agents/reviewer.md`,
  `.claude/agents/docs-sync.md`, `CLAUDE.md`. The maintainer chose "Approve all 6". The headless update asked for five (no
  `known-deviations.md`); the sixth is the PORT drift row deletion.
- Plan hash dialog: `155204b7ac894741a13eeb646de3a5cb4bcb6d0a28cee02f732d40c5949842c4` (64 hex characters), "23 files, as reviewed",
  options Commit this plan / Stop. PS's own report: prepare passed, the bound diff matches it, 23 file changes (8 created, 15
  modified) plus metadata, the 7 `.ai/tools/*` files bound as inputs but unchanged. The maintainer's answer to this dialog and the
  run id are in the paste only through PS's later report: it committed (`apply.mjs commit`), run id `ps-20261125-cf70`.
- Nothing was written before the plan-hash dialog (PS's report; not independently checked). The two approval dialogs and the first
  decision dialog are PS conversation dialogs; the count and wording of Claude Code permission prompts was not recorded.

PS's own final report (self-report, not verified here):

- All 23 files written, `validate.mjs`: 16 pass, 0 warnings, 0 fail; the two wrapper drift warnings gone.
- Both wrappers replaced by the shipped 3.2.0 wrappers; approved backend-standards rules moved verbatim into
  `.ai/agents/reviewer.project.md` and `.ai/agents/docs-sync.project.md`. Held back and listed as open decisions in `TODO.md`: the
  reviewer's confidence labels, its known-deviations bullet, its severity table and output format, docs-sync's section 1 ("Establish
  what changed") and `model: opus` on both. The headless update of 2026-11-24 dropped these in the maintainer-proxy answers; here they
  are held pending, so the two runs differ in disposition, not in procedure.
- 03: 284 lines / 19,829 bytes to 316 lines / 21,540 bytes; PORT default recorded once as 3000; the drift row and the 8080 Landmines
  row deleted; `.env.example` missing recorded; eight pointer documents; `AGENTS.md` blocks, `development-rules.md` and
  `code-patterns.md` refer to 03.
- PS reported one mistake of its own: in 03 section 12 it placed the new `### Compiler and lint settings` heading above the existing
  Lockfile / Branch naming / Merge strategy table, so the table reads as part of the new subsection. No content lost; fixing it needs
  another reviewed run. Recorded here as a finding on the interactive update, not fixed.
- Not verified, by PS's own statement: the project's lint, typecheck and tests (no `node_modules`; `npx tsc` fetched TypeScript 7.0.2
  instead of the lockfile's 5.9.3), the secret-read canary, Codex.
- State left: nothing committed to Git, "16 files modified and 6 new paths untracked" on a detached HEAD; recovery data kept in
  `.ai/.run/ps-20261125-cf70`; setup lock released. The count is not the same as the plan's 8 created and 15 modified (16 against
  15 and 6 against 8); untracked directories can be collapsed by `git status`, so this is NOT a confirmed mismatch. The maintainer's
  `git status --short -uall`, `git diff --stat` and an own `validate.mjs --json` were requested and are not in the record.

Environment contamination (not project-setup behaviour): the paste shows `PostToolUse:Edit` and `PostToolUse:Write` hooks failing
repeatedly with "Python was not found; run without arguments to install from the Microsoft Store" and the `typescript-lsp` language
server failing to start. They come from the maintainer's Claude Code user and plugin configuration. PS completed regardless.

Independent checks run by the maintainer in `D:\ps-live\tui\row-b` right after (pasted, 2026-11-25 about 00:17 local; this session read
the output only):

- `validate.mjs --json`, run by the maintainer with the PowerShell form: `ok: true`, 16 pass, 0 warn, 0 fail, plus the informational
  `allow-local` note (`.claude/settings.local.json` is personal). Includes `policy-managed` (patterns match the installed baseline),
  `agents-size` (`AGENTS.md` 130 lines, 8350 bytes), 33 generated files scanned for secret-shaped content, and the hook self-test
  passed with `claudeHookLoading: not-verified`. This confirms PS's self-reported validate result.
- `git status --short -uall`: 16 modified paths (`.ai/agents/{docs-sync,reviewer}.md`, `.ai/context/{code-patterns,configuration,
  development-rules,project-tree}.md`, `.ai/manifest.json`, `.ai/security-paths.json`, `03`, `known-deviations.md`, both
  `.claude/agents/*.md`, `.claude/settings.json`, `AGENTS.md`, `CLAUDE.md`, `TODO.md`) and 8 untracked (`reviewer.project.md`,
  `docs-sync.project.md`, `critical-modules.md`, `error-contract.md`, `glossary.md`, `docs/api-conventions.md`, `docs/database.md`,
  `docs/observability.md`). That is the plan's 8 created and 15 modified plus `.ai/manifest.json`, which the plan carries as a metadata
  operation (the headless update likewise reported changes "plus 3 metadata ops"); the earlier "6 untracked" was `git status`
  collapsing directories. Inferred, consistent with the plan, not proven line by line. Only the planned paths changed.
- `git diff --stat`: 16 files, 428 insertions, 337 deletions. No tracked non-wrapper file shows a whole-file rewrite (largest:
  `.ai/manifest.json` 176, `03` 34 changed lines, `TODO.md` 34). The two wrappers show 117 and 135 changed lines because they were
  replaced by the 15-line shipped wrappers, which the plan states. This is evidence against a line-ending rewrite of the other files;
  `git ls-files --eol` was not run, so line endings are not verified directly.

Still not recorded for Row B: the count and wording of Claude Code permission prompts and whether the status line ever said
"Allowed by auto mode classifier"; the keep and take-new answers; and the L16 rule on this clone.

## What stays not measured

Everything the runbook sections 1, 2, 3, 3b, 4 and 5 list, except what the addenda above record (Codex P4 PASS; Row A Phase 0 only;
Row B to commit by self-report). The 2026-11-24 unmeasured-items results file remains the record of what
was measured headless; nothing in it changes.

## For whoever runs the rows

- Run them in your own Terminal tab; fixtures and commands are in the runbook. `D:\ps-live\u32` is still the source for the clones.
- Section 3 on a new clone location needs one trust decision first (above).
- This session's scratch (`D:\ContactRepos\codex-fixtures\tui`) was deleted, so recreate the clone with the section 3 commands.
