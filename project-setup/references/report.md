# Final report

Use this structure. Keep it factual; every claim maps to something observed in this run.

```
## project-setup v2 — <mode> — <repo> @ <short sha>

### Files
| File | Status (created / merged / unchanged / skipped) | Ownership | Lines |

### Decisions taken with the user
- conflicts resolved, allow-listed commands and why, items deliberately skipped

### Validation (validate.mjs)
pass N / warn N / fail N; list every warn/fail and needs-update info.
Static setup results: <summary>.
Installed hook self-test: <passed / failed / not-run>.
Claude hook loading: <verified with scoped evidence / not verified>.

### Doctor diagnostics
Configuration and diagnostics: <ready / not ready / not run>.
Connector-tool absence and sandbox enforcement: <separate host evidence / not verified>.

### Capability report
<table from references/security.md §5; "not verified" where it was not observed>

### Security findings (names and file:line only)
- tracked secret files, possible real values in env templates, scanner findings, ineffective rules, legacy hooks
- Template contains values: .env.example. Existing values were preserved and were not printed. Manually reduce the template to key names with empty assignments.

### Manual steps for the user
- Codex profile snippet: paste after removing legacy sandbox settings (only if they want Codex deny-read)
- verification steps for the tool not run in this session
- retiring v1 copies, deleting .claudeignore, rotating any secret found in history
- Template missing: .env.example. Manually create the root .env.example with key names and empty assignments only, then rerun project-setup.

### TODO.md
- counts per section; the top 3 items

### Rollback
node <SKILL_DIR>/scripts/apply.mjs rollback --run-id <id>   (available until cleanup)
```

Creating any other environment file is a manual user step outside the agent session; do not
emit a copy command or read its contents.

The two template bullets are conditional: copy the env-keys values step only when it reported one, and its
missing-template step only when the template was missing. Copy them exactly; they name no value.

Never write "secure", "protected", or "no secrets" without the scope: which tool, which layer, which version,
which paths.
