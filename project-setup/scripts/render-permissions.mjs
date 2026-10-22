#!/usr/bin/env node
// Renders every secret-path control from ONE effective policy so Claude, Git and Codex can never drift.
//
// Plan: docs/plans/2026-10-18-project-setup-v3-rc1-c3.md sections 2.4, 3.3 and 3.12. Importing this module only defines
// it; the CLI runs only when the file is the entry point.
//
// Usage: node render-permissions.mjs [json|codex-snippet|pathspec] [--project <root>]
//   json (default) -> { ok, source, claude: {...}, gitPathspecExcludes: [...], codexSnippet }
//   codex-snippet  -> the TOML snippet (for the user's config; never written by the skill)
//   pathspec       -> the git pathspec excludes, one per line
// --project renders the installed .ai/security-paths.json of that root; without it (or when the root has none) the
// shipped defaults render. A present malformed policy fails with C1's error and never falls back to the defaults.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSecurityPolicy } from '../assets/tools/security-policy.mjs';
import { loadEffectivePolicy, ok } from './lib.mjs';

// Noise reduction, NOT a security boundary (rules match command text only; see references/claude.md).
// Windows sessions may use the PowerShell tool, which Bash(...) rules do not cover.
export const CLAUDE_COMMAND_DENY = Object.freeze([
  'Bash(rm -rf *)', 'Bash(git reset --hard*)', 'Bash(git clean *)', 'Bash(git push --force*)', 'Bash(git push -f*)',
  'Bash(git checkout -- *)', 'Bash(git restore *)', 'Bash(curl * | bash*)', 'Bash(curl * | sh*)', 'Bash(wget * | bash*)',
  'Bash(npm publish*)', 'Bash(terraform apply*)', 'Bash(terraform destroy*)', 'Bash(kubectl delete *)', 'Bash(helm uninstall *)',
  'PowerShell(Remove-Item * -Recurse*)', 'PowerShell(git reset --hard*)', 'PowerShell(git clean *)',
  'PowerShell(git push --force*)', 'PowerShell(git push -f*)', 'PowerShell(npm publish*)',
  'PowerShell(Invoke-Expression *)', 'PowerShell(iex *)',
]);

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function codexSnippet(keys, depth) {
  const lines = [
    '# --- project-setup v3: Codex deny-read profile -------------------------------------------',
    '# REVIEW before use. Paste into your USER config (%USERPROFILE%\\.codex\\config.toml or ~/.codex/config.toml).',
    '# The skill never writes this file.',
    '#',
    '# CRITICAL: profiles do not compose with legacy sandbox settings. If `sandbox_mode` or',
    '# [sandbox_workspace_write] appears in ANY loaded config file, or you pass --sandbox, Codex uses',
    '# the legacy settings and this profile is silently inactive. Remove them first.',
    '#',
    '# WINDOWS: with the non-admin ("unelevated") sandbox, Codex 0.160.1 REFUSES TO START with this profile',
    '# ("cannot enforce deny-read restrictions directly; refusing to run unsandboxed"). Only use it with the',
    '# admin-installed Windows sandbox or under WSL2, and verify with a canary run.',
    '#',
    '# Deny-read globs are pre-expanded into a snapshot before the sandbox starts (Linux/WSL/native',
    '# Windows). Files created later in the session may not be covered: verify with canary.mjs.',
    'default_permissions = "project-setup"',
    '',
    '[permissions.project-setup]',
    'description = "Workspace write with secret paths denied (project-setup v3)"',
    'extends = ":workspace"',
    '',
    '[permissions.project-setup.filesystem]',
    `glob_scan_max_depth = ${depth}`,
    '"~/.ssh" = "deny"',
    '"~/.aws" = "deny"',
    '"~/.gnupg" = "deny"',
    '',
    '[permissions.project-setup.filesystem.":workspace_roots"]',
    ...keys.map((k) => `${k} = "deny"`),
    '',
    '# Optional: OS-enforced read-only profile for the reviewer agent. Only after this exists AND a',
    '# canary run passes, add `default_permissions = "project-setup-readonly"` to .codex/agents/reviewer.toml.',
    '[permissions.project-setup-readonly]',
    'description = "Read-only with secret paths denied (project-setup v3 reviewer)"',
    'extends = ":read-only"',
    '',
    '[permissions.project-setup-readonly.filesystem]',
    `glob_scan_max_depth = ${depth}`,
    '"~/.ssh" = "deny"',
    '"~/.aws" = "deny"',
    '"~/.gnupg" = "deny"',
    '',
    '[permissions.project-setup-readonly.filesystem.":workspace_roots"]',
    ...keys.map((k) => `${k} = "deny"`),
    '# -----------------------------------------------------------------------------------------',
  ];
  return lines.join('\n') + '\n';
}

/**
 * Plan 3.3: one Read deny, one Git exclusion and one Codex key per effective identity, in effective order (managed before
 * project), each in the STORED spelling of its first source entry. Never C1's lowercase matching projection and never a
 * case companion: host case handling is pending R44/R74 evidence. Claude alone gets the leading "/" of a root anchor.
 * The policy is validated by C1 (its error propagates, nothing is partly rendered); no file is read.
 */
export function renderSecurityControls(policy) {
  const { policy: p, effectivePatterns } = readSecurityPolicy(policy);
  let depth = 6;
  if (own(p, 'codexGlobScanMaxDepth')) {
    depth = p.codexGlobScanMaxDepth;
    if (!Number.isInteger(depth) || depth < 1 || depth > 100) {
      throw Object.assign(new Error('RENDER_DEPTH: codexGlobScanMaxDepth must be an integer from 1 through 100'), { code: 'RENDER_DEPTH' });
    }
  }
  const entries = effectivePatterns.map((e) => ({ anchor: e.anchor, glob: p[e.sources[0].collection][e.sources[0].index].glob }));
  const readDeny = entries.map((e) => `Read(${e.anchor === 'root' ? '/' : ''}${e.glob})`);
  const commandDeny = [...CLAUDE_COMMAND_DENY];
  return {
    claude: { permissionsDeny: [...readDeny, ...commandDeny], readDeny, commandDeny },
    gitPathspecExcludes: entries.map((e) => `:(exclude,glob,icase)${e.glob}`),
    codexSnippet: codexSnippet(entries.map((e) => JSON.stringify(e.glob)), depth),
  };
}

// ---------------------------------------------------------------- CLI ----
const USAGE = 'usage: render-permissions.mjs json|codex-snippet|pathspec [--project <root>]';
function failF(code, error, exit) {
  process.stdout.write(JSON.stringify({ ok: false, code, error }, null, 2) + '\n');
  process.exit(exit);
}

/** At most one subcommand and at most one --project with a nonempty value; anything else is RENDER_USAGE (plan 3.3). */
function parseCli(argv) {
  const o = { sub: null, project: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') {
      const v = argv[i + 1];
      if (o.project !== null || typeof v !== 'string' || v === '' || v.startsWith('--')) return null;
      o.project = v; i++;
    } else if (['json', 'codex-snippet', 'pathspec'].includes(a) && o.sub === null) o.sub = a;
    else return null;
  }
  return o;
}

// The entry check compares resolved paths and, failing that, native real paths, so a launch through a junction or an
// 8.3 short name still runs the CLI (an alternate launch path that missed it would print nothing).
function isEntryPoint() {
  if (!process.argv[1]) return false;
  const self = fileURLToPath(import.meta.url);
  const fold = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  if (fold(path.resolve(process.argv[1])) === fold(path.resolve(self))) return true;
  try { return fold(fs.realpathSync.native(process.argv[1])) === fold(fs.realpathSync.native(self)); } catch { return false; }
}

if (isEntryPoint()) {
  const o = parseCli(process.argv.slice(2));
  if (!o) failF('RENDER_USAGE', USAGE, 1);
  let loaded; let controls;
  try {
    loaded = loadEffectivePolicy(o.project);
    controls = renderSecurityControls(loaded.policy);
  } catch (e) {
    if (!(e instanceof Error) || typeof e.code !== 'string') throw e;
    failF(e.code, e.message, e.code === 'POLICY_IO' ? 2 : 3);
  }
  const sub = o.sub || 'json';
  if (sub === 'json') ok({ source: loaded.source === 'project' ? '.ai/security-paths.json' : 'data/secret-paths.json', ...controls });
  else if (sub === 'codex-snippet') process.stdout.write(controls.codexSnippet);
  else process.stdout.write(controls.gitPathspecExcludes.length ? controls.gitPathspecExcludes.join('\n') + '\n' : '');
}
