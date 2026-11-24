# project-setup 3.2.0: TUI runbook execution attempt, results

Status: evidence record, not an acceptance verdict. It follows `docs/plans/2026-11-24-project-setup-v3.2-tui-runbook.md` and
`docs/plans/2026-11-24-project-setup-v3.2-unmeasured-items-results.md`. It changes no shipped byte and edits no frozen plan.
Dated 2026-11-24 (session local time, late evening). Repository base: main at 7fe4017.

Result in one line: none of the TUI-only rows could be measured by this session; the one later run by the maintainer (Codex P4,
see the addendum) passed. Every other row is BLOCKED, for the two
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
| Section 1, row A: default-mode adopt | BLOCKED | Reasons 1 and 2. Not started: needs a person to answer every permission prompt. |
| Rows named in the task (blank section, renamed heading, deleted pointer, local-instruction conflict, unchanged rerun) in default mode | BLOCKED | Reasons 1 and 2. The runbook carries these mutations only as section 4 (Codex, fixtures `D:\ps-live\rows\r1` to `r5`); no interactive run of any of them was made. |
| Section 1, row B: default-mode update on `d9f-ps-first` | BLOCKED | Reasons 1 and 2. Only observation: `detect.mjs` at `6861636` reports mode `update`, one `warnings` entry that `.ai/.setup.lock` exists in the kept fixture (the runbook says clones do not carry it). |
| Section 2: L16 launch rule in the TUI (P3 h) and its negative control | BLOCKED | Reasons 1 and 2. The headless result (Claude Code 2.1.330) in `2026-11-22-project-setup-v3.2.0-live-results.md` D2 stands unchanged and is not extended. |
| Section 3: Codex P4 project-context check | BLOCKED for this session; later MEASURED by the maintainer (see "Addendum: P4 run by the maintainer") | Reason 1, plus the trust dialog. Setup part measured here: the first bullet under `Critical rules` in the clone's `AGENTS.md` starts "Never read, print, copy, or summarize files matching `.ai/security-paths.json`", and the first words of `~/.codex/AGENTS.md` are "## Delegated roles". They differ, so the probe can discriminate. |
| Section 3b: Codex deny-read profile canaries | NOT ATTEMPTED | Needs a paste into `~/.codex/config.toml`, which this session does not edit, and a TUI. Not in the task. |
| Section 4: Codex PS rows r1 to r5 and doc-writing case | NOT ATTEMPTED | Needs a Codex session that may write and approve; reasons 1 and 2. Not in the task's list beyond the row names above. |
| Section 5: P8 Codex ownership grant | BLOCKED | `git config --global --get-all safe.directory` still lists a wildcard (`*`) beside exact entries. The runbook gives no way that leaves the global Git config untouched, and the user's global Git config was not changed. |

## Addendum: P4 run by the maintainer (2026-11-24, about 23:19 local)

The maintainer ran runbook section 3 by hand in their own Terminal tab and pasted Codex's reply into the chat of this session. This
session did not see the TUI; everything below comes from that paste and from the clone on disk. The clone was recreated by the maintainer from the
runbook commands (`D:\ContactRepos\codex-fixtures\tui\p4`, clean at commit `6861636` when checked here after the run; this session had
deleted its own copy earlier), codex-cli 0.163.0 (the version this session read earlier on the same
host). Whether the maintainer answered the trust dialog and how is not recorded here.

- Prompt: the exact section 3 prompt (quote the first bullet under "Critical rules" in the `AGENTS.md` of this project, say which file,
  run no command).
- Reply (paste): a quote of the whole first bullet, then "I quoted the project's AGENTS.md (AGENTS.md) from the text you provided."
  Footer "Worked for 7s".
- Check made here, on disk, ignoring the backtick formatting the paste lost: the quoted text equals the first bullet in the clone's
  `AGENTS.md` lines 18 to 25 (it includes the two indented continuation lines about `git-safe` and the env variable names). It does
  not match the first words of `~/.codex/AGENTS.md` ("## Delegated roles"), so the probe did discriminate.
- Result: PASS on the section 3 criterion (quote equals the project bullet, attribution names the project file), one sample, codex-cli
  0.163.0, Windows, one fixture. It shows that Codex at that fixture root had the project `AGENTS.md` text in its context before any
  command; it does not show the mechanism.
- Caveats: the paste is the final answer only, so "no command was run" is inferred from the 7 s run time and the reply wording, not
  read from the TUI; the phrase "from the text you provided" was Codex's own and is not explained here; model and effort were not
  recorded.

## What stays not measured

Everything the runbook sections 1, 2, 3, 3b, 4 and 5 list. The 2026-11-24 unmeasured-items results file remains the record of what
was measured headless; nothing in it changes.

## For whoever runs the rows

- Run them in your own Terminal tab; fixtures and commands are in the runbook. `D:\ps-live\u32` is still the source for the clones.
- Section 3 on a new clone location needs one trust decision first (above).
- This session's scratch (`D:\ContactRepos\codex-fixtures\tui`) was deleted, so recreate the clone with the section 3 commands.
