#!/usr/bin/env node
// Installed as .ai/tools/git-safe.mjs (fully managed), with git-safe-core.mjs and security-policy.mjs beside it.
// Read-only Git object commands with secret paths omitted or refused; the forms and limits are in the core.
// Plan: docs/plans/2026-10-18-project-setup-v3-rc1-c4.md section 2.4. This file always runs main, with no
// entry-point detection, so a junction, an alternate checkout path or subst can never turn a call into a silent no-op.
import { main } from './git-safe-core.mjs';
const result = await main(process.argv.slice(2));
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
