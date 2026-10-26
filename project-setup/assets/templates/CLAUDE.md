@AGENTS.md

<!-- project-setup:begin id=claude -->
## Claude Code

- You MUST start Claude Code at this repository's root. For this rule, the root is the
  directory containing this CLAUDE.md; setup installs it next to .claude/settings.json.
  Starting below that root can leave the raw-Git hook and permissions.deny inactive and
  omit the root AGENTS.md import, exposing protected files and unfiltered Git history.
- Before reading files or running any Git command or project tool, you MUST compare the
  session's original working directory in its environment context with the directory of
  the loaded CLAUDE.md carrying this rule. Use only supplied context and loaded instruction
  locations; do not run raw Git or read files to discover the root.
  Compare directory components, case-insensitively on Windows, not a string prefix. The current
  directory after a cd is not the original start directory.
- If several loaded CLAUDE.md files carry this rule, you MUST use the nearest one at or
  above the original start directory. This prevents an outer checkout's rule from rejecting
  a session started at a nested worktree's own root, including .claude/worktrees/<name>.
- If that comparison positively establishes that the session started strictly below the
  selected rule's directory, you MUST say that the root hook, deny rules and shared rules
  may be absent, ask the user to restart Claude Code from that root, and stop before any
  file read, Git command or project tool. Changing directory is not a fix.
- You MUST NOT infer a subdirectory start from missing or ambiguous launch context alone,
  or refuse a root-started session on that basis; uncertainty does not establish the
  condition above. You MUST NOT claim that uncertainty proves the controls are active.
  This prevents false launch refusals without treating unknown host state as verified.
- A sibling worktree uses its own rule and root. A root-started session may later change
  directory within that same repository. A nested .claude/settings.json alone is not a
  root marker for this comparison and MUST NOT be used to bypass an established refusal.
- Shared rules live in AGENTS.md (imported above). Put only Claude-specific notes here.
- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; both load their canonical definition from `.ai/agents/`.
- In a root-started session, permissions.deny in .claude/settings.json protects secret paths
  at the supported tool layers. You MUST treat a denial as final to prevent fallback access.
- If a built-in review preamble is blocked by the managed raw-Git hook, apply its method
  through `node .ai/tools/git-safe.mjs`. You MUST NOT allow-list raw `git diff`, including
  `--name-only`, or disable the hook to load it.
<!-- project-setup:end id=claude -->
