#!/usr/bin/env node
// Installed as .ai/tools/guard-raw-git.mjs (fully managed), with guard-raw-git-core.mjs beside it: the Claude
// PreToolUse hook for Bash and PowerShell. It reads the hook input from stdin, writes the core's fixed result and sets
// the exit code: 0 permit, 2 block (raw Git history read), 1 could not parse (allowed, with a warning).
// Plan: docs/plans/2026-10-19-project-setup-v3-rc1-c6.md sections 2.4, 3.1 and 3.6 (C6-P2-4, C6-P2-5).
//
// This file always runs, with no entry-point detection: a junction, an alternate checkout path or subst can never turn
// a hook call into a silent successful no-op. The core is loaded inside the same try/catch that maps every failure (a
// missing or broken core, an unreadable stdin, a RangeError) to the exact malformed result, so no stack trace or native
// error text is ever printed. It never calls process.exit, so the streams are flushed before the process ends.
import fs from 'node:fs';

const MALFORMED = { exitCode: 1, stdout: '', stderr: 'guard-raw-git: could not parse command; allowed without checking\n' };
let result = MALFORMED;
try {
  const { evaluateHookInput } = await import('./guard-raw-git-core.mjs');
  const input = fs.readFileSync(0).toString('utf8');
  // Unexpected arguments are malformed input: the installed command passes none.
  result = process.argv.length > 2 ? MALFORMED : evaluateHookInput(input);
  if (!result || typeof result.stdout !== 'string' || typeof result.stderr !== 'string' || ![0, 1, 2].includes(result.exitCode)) result = MALFORMED;
} catch {
  result = MALFORMED;
}
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
