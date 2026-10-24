@AGENTS.md

<!-- project-setup:begin id=claude -->
## Claude Code

- Shared rules live in AGENTS.md (imported above). Put only Claude-specific notes here.
- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; both load their canonical definition from `.ai/agents/`.
- Secret paths are enforced by `permissions.deny` in `.claude/settings.json`; treat a denial as final.
- If a built-in review preamble is blocked by the managed raw-Git hook, apply its method
  through `node .ai/tools/git-safe.mjs`. You MUST NOT allow-list raw `git diff`, including
  `--name-only`, or disable the hook to load it.
<!-- project-setup:end id=claude -->
