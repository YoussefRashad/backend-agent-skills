#!/usr/bin/env node
// Optional local secret scan. Scope and limits are explicit:
//   - runs only if `gitleaks` is installed locally; nothing is uploaded anywhere;
//   - uses --redact; the raw JSON report stays in the run vault (denied to agents);
//   - prints only file, line, rule id, commit and a protected label; never the match;
//   - protected paths, run vaults and canary files stay IN scope (Q4): the scan input is never reduced and no finding is
//     filtered; a finding under a protected path is labelled, not hidden (plan C3 section 3.11);
//   - if gitleaks is missing or fails, or its report is unreadable, the result is "not-scanned", never "clean".
//
// Usage: node secret-scan.mjs --run-id <id> [--scope worktree|history]
//   worktree (default): files currently in the working tree (gitleaks dir)
//   history: full git history (gitleaks git); slower, finds secrets that were committed and later removed
// Importing this module only defines labelScanFindings; the CLI runs only when the file is the entry point.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, repoRoot, run, IS_WINDOWS, ok, fail, validateRunId, secureDir, assertNotLink, loadEffectivePolicy } from './lib.mjs';
import { matchesPolicyPath } from '../assets/tools/security-policy.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const INVALID_PATH_CODES = new Set(['POLICY_PATH_TYPE', 'POLICY_PATH_NUL', 'POLICY_PATH_ABSOLUTE', 'POLICY_PATH_CANONICAL']);

/**
 * Plan 3.11: one label row per scanner finding, same count and order. Only file (root-relative POSIX), line (a positive
 * integer StartLine or null), rule (a nonempty RuleID or "unknown"), commit (first 8 characters or null) and protected
 * (C1 matching against the effective policy; a path that fails the structural checks counts as protected). No match,
 * secret, entropy or other scanner field is ever copied. Synchronous; reads nothing.
 */
export function labelScanFindings(findings, root, policy) {
  if (typeof root !== 'string' || root === '') throw Object.assign(new Error('SCAN_INPUT: scanner root must be a nonempty string'), { code: 'SCAN_INPUT' });
  if (!Array.isArray(findings) || !findings.every(isObj)) throw Object.assign(new Error('SCAN_REPORT_SHAPE: scanner report must be an array of objects'), { code: 'SCAN_REPORT_SHAPE' });
  const isProtected = (rel) => {
    try { return matchesPolicyPath(rel, policy); } catch (e) {
      if (e instanceof Error && INVALID_PATH_CODES.has(e.code)) return true;
      throw e;
    }
  };
  return findings.map((f) => {
    const name = typeof f.File === 'string' ? f.File : '';
    const file = path.relative(root, path.isAbsolute(name) ? name : path.join(root, name)).split(path.sep).join('/');
    return {
      file,
      line: Number.isInteger(f.StartLine) && f.StartLine > 0 ? f.StartLine : null,
      rule: typeof f.RuleID === 'string' && f.RuleID !== '' ? f.RuleID : 'unknown',
      commit: typeof f.Commit === 'string' ? f.Commit.slice(0, 8) : null,
      protected: isProtected(file),
    };
  });
}

// ---------------------------------------------------------------- CLI ----
function cli() {
  const args = parseArgs(process.argv.slice(2));
  const root = repoRoot();
  if (!root) fail('not inside a git repository');
  let runId;
  try { runId = validateRunId(args['run-id']); } catch (e) { fail(e.message); }
  const scope = args.scope === 'history' ? 'history' : 'worktree';
  let policy;
  try { policy = loadEffectivePolicy(root).policy; } catch (e) { if (!e.code) throw e; fail(e.message, e.code === 'POLICY_IO' ? 2 : 3); }

  let vault;
  try { vault = secureDir(root, ['.ai', '.run', runId, 'vault']); } catch (e) { fail(e.message, 2); }
  if (!vault) fail('run not initialised; run apply.mjs init first');
  const report = path.join(vault, `gitleaks-${scope}.json`);
  try { assertNotLink(report); } catch (e) { fail(e.message, 2); }

  const bin = args.gitleaks && args.gitleaks !== true ? String(args.gitleaks) : 'gitleaks';
  const probe = IS_WINDOWS ? run(`${bin} version`, [], { shell: true }) : run(bin, ['version']);
  if (probe.status !== 0) { ok({ status: 'not-scanned', reason: 'gitleaks not installed', scope }); process.exit(0); }

  const common = ['--redact', '--no-banner', '--report-format', 'json', '--report-path', report, '--exit-code', '0'];
  const argv = scope === 'history' ? ['git', ...common, root] : ['dir', ...common, root];
  const r = IS_WINDOWS ? run([bin, ...argv.map((a) => `"${a}"`)].join(' '), [], { shell: true, cwd: root }) : run(bin, argv, { cwd: root });
  if (r.status !== 0 || !fs.existsSync(report)) {
    ok({ status: 'not-scanned', reason: `gitleaks failed (exit ${r.status})`, scope, version: probe.stdout });
    process.exit(0);
  }
  const unreadable = () => { ok({ status: 'not-scanned', reason: 'unreadable report', scope }); process.exit(0); };
  let findings;
  try { findings = JSON.parse(fs.readFileSync(report, 'utf8') || '[]'); } catch { unreadable(); }
  let items;
  try { items = labelScanFindings(findings, root, policy); } catch (e) { if (e && e.code === 'SCAN_REPORT_SHAPE') unreadable(); throw e; }
  ok({ status: 'scanned', scope, tool: `gitleaks ${probe.stdout}`, findings: items, count: items.length, note: 'Matches are redacted and not shown. Protected paths, run vaults and canary files are included. Report file:line:rule to the user; never open the files.' });
}

const norm = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
if (Boolean(process.argv[1]) && norm(process.argv[1]) === norm(fileURLToPath(import.meta.url))) cli();
