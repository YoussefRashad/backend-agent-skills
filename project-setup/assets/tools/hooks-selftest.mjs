#!/usr/bin/env node
// Installed as .ai/tools/hooks-selftest.mjs (fully managed): runs the installed raw-Git hook (guard-raw-git.mjs beside
// it) as a real child process on three fixed inputs and reports exact outcomes.
// Plan: docs/plans/2026-10-19-project-setup-v3-rc1-c6.md sections 2.6 and 3.12 (C6-P2-9).
//
// What it proves, and what it does not. A broken hook fails open silently: a hook that exits 0 with no output permits
// every command, and nobody notices because permitted commands look normal. The self-test catches that by requiring the
// block and the malformed cases to produce their exact status and bytes, not just "some output". It proves direct hook
// behavior only: not that settings reference the hook, and not that Claude runs it (host behavior is TO VERIFY).
//
// The expected results are restated here, never imported from the hook's core: a self-test that asks the code under
// test what it should print can only agree with it. Child output and native errors are never forwarded.
//
// Unlike the hook, this module is import-safe and runs its CLI only as the entry point; an alternate launch path that
// misses the entry check prints nothing, which is why its consumer (C10) must reject empty or non-exact stdout even
// when the process exits 0.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CASES = [
  { id: 'allowed', input: '{"tool_name":"Bash","tool_input":{"command":"git status"}}', status: 0, stdout: '', stderr: '' },
  { id: 'blocked', input: '{"tool_name":"Bash","tool_input":{"command":"git diff"}}', status: 2, stdout: '', stderr: 'guard-raw-git: raw Git command blocked; use node .ai/tools/git-safe.mjs\n' },
  { id: 'malformed', input: '{', status: 1, stdout: '', stderr: 'guard-raw-git: could not parse command; allowed without checking\n' },
];
const OPTION_KEYS = ['hookPath', 'execute'];
const USAGE = 'hooks-selftest: usage: node .ai/tools/hooks-selftest.mjs\n';

function optionsError() {
  const e = new Error('HOOK_SELFTEST_OPTIONS: invalid self-test options');
  e.code = 'HOOK_SELFTEST_OPTIONS';
  return e;
}

// Plan 2.6: a valid result has an integer-or-null status, a string-or-null signal, an undefined-or-null error and two
// string streams. Other keys (spawnSync's pid and output) are ignored.
function passes(c, r) {
  if (r === null || typeof r !== 'object' || Array.isArray(r)) return false;
  const statusOk = r.status === null || Number.isInteger(r.status);
  const signalOk = r.signal === null || typeof r.signal === 'string';
  const errorOk = r.error === undefined || r.error === null;
  if (!statusOk || !signalOk || !errorOk || typeof r.stdout !== 'string' || typeof r.stderr !== 'string') return false;
  return r.status === c.status && r.signal === null && r.stdout === c.stdout && r.stderr === c.stderr;
}

async function runCases(hookPath, execute) {
  const cases = [];
  for (const c of CASES) {
    let passed = false;
    try {
      const options = { input: c.input, shell: false, windowsHide: true, encoding: 'utf8', timeout: 5000, maxBuffer: 65536 };
      passed = passes(c, await execute(process.execPath, [hookPath], options));
    } catch {
      passed = false; // a throw, a rejection or a spawn failure is a failed case; nothing about it is forwarded
    }
    cases.push({ id: c.id, passed });
  }
  const pass = cases.filter((c) => c.passed).length;
  const stdout = `${cases.map((c) => `${c.passed ? 'PASS' : 'FAIL'}  guard-raw-git/${c.id}`).join('\n')}\n${pass} PASS / ${cases.length - pass} FAIL\n`;
  const ok = pass === cases.length;
  return { ok, code: ok ? null : 'HOOK_SELFTEST_FAILED', cases, exitCode: ok ? 0 : 1, stdout, stderr: '' };
}

/**
 * Runs the three cases against hookPath (default: the absolute sibling guard-raw-git.mjs, independent of cwd) through
 * execute (default: spawnSync), continuing after failures. Invalid options throw HOOK_SELFTEST_OPTIONS synchronously.
 */
export function runHooksSelfTest(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw optionsError();
  if (Object.keys(options).some((k) => !OPTION_KEYS.includes(k))) throw optionsError();
  const { hookPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'guard-raw-git.mjs'), execute = spawnSync } = options;
  if (typeof hookPath !== 'string' || hookPath === '' || !path.isAbsolute(hookPath)) throw optionsError();
  if (typeof execute !== 'function') throw optionsError();
  return runCases(hookPath, execute);
}

// ---------------------------------------------------------------- CLI ----
// The entry check compares resolved paths and, failing that, native real paths, so a launch through a junction or an
// 8.3 short name still runs the CLI.
function isEntryPoint() {
  if (!process.argv[1]) return false;
  const self = fileURLToPath(import.meta.url);
  const fold = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  if (fold(path.resolve(process.argv[1])) === fold(path.resolve(self))) return true;
  try { return fold(fs.realpathSync.native(process.argv[1])) === fold(fs.realpathSync.native(self)); } catch { return false; }
}

if (isEntryPoint()) {
  if (process.argv.length > 2) {
    process.stderr.write(USAGE);
    process.exitCode = 1;
  } else {
    const r = await runHooksSelfTest();
    process.stdout.write(r.stdout);
    process.exitCode = r.exitCode;
  }
}
