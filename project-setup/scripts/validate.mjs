#!/usr/bin/env node
// Static validation of the generated setup plus the installed raw-Git hook self-test. Reports evidence; it does NOT
// prove that Claude loads the hook or that any tool enforces the policy at runtime (that is verified per tool in the
// session, see references/security.md "Load verification").
//
// Plan: docs/plans/2026-10-20-project-setup-v3-rc1-c10.md section 4 (and its freeze addendum C10-P3-2).
//
// What this gets right that the v2 validator did not:
//   - Import-safe. main(argv, dependencies) returns { exitCode, stdout, stderr } and never writes a stream, exits or
//     sets process.exitCode; only the direct-entry block at the end does. Every call establishes its own root, so an
//     earlier call's root never leaks into the next one.
//   - One read boundary: the shipped defaults plus the installed policy decide which bodies may be opened. A malformed
//     or unreadable installed policy turns the matcher deny-all; the shipped defaults are never a substitute
//     permission. The installed policy and the manifest are fixed control inputs read through readInRepo (links,
//     junctions and escapes refused), not exemptions for the paths they name.
//   - Ownership is consumed only from an entirely valid manifest. A manifest with any schema issue is reported and
//     never used: no path it names is read and none of its records decides a row.
//   - The installed hook self-test is required whenever a raw-Git hook installation is identified, and only its
//     exact transcript counts: a hook that exits 0 silently permits everything and would otherwise look healthy.
//     The command is the installed self-test, never a command taken from settings.
//
// Usage: node validate.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readSecurityPolicy, validateRepoPath } from '../assets/tools/security-policy.mjs';
import {
  SKILL_DIR, repoRoot, git, normalizedHash, loadSecretSpec, loadEffectivePolicy, isSecretPath, readInRepo, secureDir,
  setFilesystemRoot, WRITE_DENYLIST,
} from './lib.mjs';
import { parseBlocks, blockHashes } from './blocks.mjs';
import { checkClaudeSettings, checkManifest, checkSecurityPolicy } from './schemas.mjs';
import { parseToml } from './toml.mjs';
import { readManifest } from './ownership.mjs';
import { inspectSecurityState, readRuntimeUnits } from './migrate-security-paths.mjs';
import { inspectAllows } from './classify-allows.mjs';

const MANIFEST_REL = '.ai/manifest.json';
const SETTINGS_REL = '.claude/settings.json';
const POLICY_REL = '.ai/security-paths.json';
const HOOK_TARGETS = ['.ai/tools/guard-raw-git-core.mjs', '.ai/tools/guard-raw-git.mjs', '.ai/tools/hooks-selftest.mjs'];
const HOOK_EVENT = 'PreToolUse';
const HOOK_MATCHER = 'Bash|PowerShell';
const HOOK_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs"';
const SELFTEST_STDOUT = 'PASS  guard-raw-git/allowed\nPASS  guard-raw-git/blocked\nPASS  guard-raw-git/malformed\n3 PASS / 0 FAIL\n';
const USAGE_BODY = { ok: false, code: 'VALIDATE_USAGE', error: 'usage: validate.mjs [--json]' };
const DEPENDENCY_KEYS = ['root', 'files', 'execute'];
// Plan 4.2: bodies validation never opens, whatever a manifest records or a policy omits. The personal and user-level
// files are lib.mjs's WRITE_DENYLIST (personal Claude settings and instructions, the Codex user configuration, .git and
// node_modules), applied at ANY depth here (a nested package's personal settings are just as personal); the plan text
// adds environment files, Codex authentication files and sandbox-secret directories.
//
// Both sets are matched with the shared policy matcher (assets/tools/security-policy.mjs through lib.mjs isSecretPath),
// so they get its path identity: JavaScript toLowerCase() on every host plus the Windows aliases (trailing dots and
// spaces, a ':' stream suffix). A plain string comparison would let `.CLAUDE/settings.json` or `.ENV` name the same
// Windows file under another spelling and slip past the check. An invalid path counts as matching, i.e. never read.
const anyEntries = (globs) => globs.map((glob) => ({ glob, anchor: 'any' }));
const NEVER_READ = {
  schema: 2,
  patterns: anyEntries([...new Set([
    ...WRITE_DENYLIST.map((g) => (g.startsWith('**/') ? g : `**/${g}`)),
    '**/.env*', '**/auth.json', '**/.sandbox-secrets/**',
  ])]),
  projectPatterns: [],
};
// The fixed control inputs and every installed runtime or self-test member (everything under .ai/tools/).
const GUARDED = {
  schema: 2,
  patterns: [MANIFEST_REL, SETTINGS_REL, POLICY_REL, '.ai/tools/**'].map((glob) => ({ glob, anchor: 'root' })),
  projectPatterns: [],
};
const BASELINE_UNAVAILABLE = 'Shipped policy inspection data is unavailable or invalid';

const J = (v) => JSON.stringify(v, null, 2) + '\n';
const own = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
const row = (level, check, detail) => ({ level, check, detail });

function optionsError() {
  return Object.assign(new Error('VALIDATE_OPTIONS: invalid validation dependencies'), { code: 'VALIDATE_OPTIONS' });
}

// Plan 4.1: exactly root, files and execute. files needs root and lists unique canonical repository-relative paths.
function readDependencies(dependencies) {
  if (dependencies === undefined) return {};
  if (!isObj(dependencies)) throw optionsError();
  if (Object.keys(dependencies).some((k) => !DEPENDENCY_KEYS.includes(k))) throw optionsError();
  const out = {};
  if (own(dependencies, 'root')) {
    const r = dependencies.root;
    if (typeof r !== 'string' || r === '' || !path.isAbsolute(r)) throw optionsError();
    out.root = r;
  }
  if (own(dependencies, 'files')) {
    const f = dependencies.files;
    if (!own(out, 'root') || !Array.isArray(f)) throw optionsError();
    const seen = new Set();
    for (let i = 0; i < f.length; i++) {
      try { validateRepoPath(f[i]); } catch { throw optionsError(); }
      if (seen.has(f[i])) throw optionsError();
      seen.add(f[i]);
    }
    out.files = [...f];
  }
  if (own(dependencies, 'execute')) {
    if (typeof dependencies.execute !== 'function') throw optionsError();
    out.execute = dependencies.execute;
  }
  return out;
}

const defaultExecute = (executable, argv, options) => cp.spawnSync(executable, argv, options);

// Plan 4.8: status 0, no signal, no error, empty stderr and exactly the four transcript lines (final LF included).
function selfTestPassed(r) {
  if (!isObj(r)) return false;
  if (!Number.isInteger(r.status) || r.status !== 0 || r.signal !== null) return false;
  if (r.error !== undefined && r.error !== null) return false;
  return r.stdout === SELFTEST_STDOUT && r.stderr === '';
}

// Plan 4.5: both shipped policies parse and validate; hashes are of the normalized bytes. null when unusable.
function shippedInspectionData() {
  try {
    const b = fs.readFileSync(path.join(SKILL_DIR, 'data', 'secret-paths-v2.0.0.json'));
    const d = fs.readFileSync(path.join(SKILL_DIR, 'data', 'secret-paths.json'));
    const baselinePolicy = JSON.parse(stripBom(b.toString('utf8')));
    const desiredPolicy = JSON.parse(stripBom(d.toString('utf8')));
    readSecurityPolicy(baselinePolicy);
    readSecurityPolicy(desiredPolicy);
    return { baselinePolicy, baselineSha256: normalizedHash(b), desiredPolicy, desiredSha256: normalizedHash(d) };
  } catch {
    return null;
  }
}

// Plan 4.9: the trusted catalog through C4's reader; null when missing, unreadable, not JSON or rejected.
function runtimeCatalog() {
  try {
    const text = fs.readFileSync(path.join(SKILL_DIR, 'data', 'runtime-units.json'), 'utf8');
    return readRuntimeUnits(JSON.parse(stripBom(text))).units;
  } catch {
    return null;
  }
}

// Plan 4.8: the exact nested command hook, shape-checked before every property access.
function hasCanonicalSettingsHook(settings) {
  if (!isObj(settings) || !own(settings, 'hooks') || !isObj(settings.hooks) || !own(settings.hooks, HOOK_EVENT)) return false;
  const groups = settings.hooks[HOOK_EVENT];
  return Array.isArray(groups) && groups.some((g) => isObj(g) && g.matcher === HOOK_MATCHER && Array.isArray(g.hooks)
    && g.hooks.some((h) => isObj(h) && h.type === 'command' && h.command === HOOK_COMMAND));
}

async function validateProject(root, suppliedFiles, execute) {
  const abs = (rel) => path.join(root, ...rel.split('/'));
  const exists = (rel) => fs.existsSync(abs(rel));
  // Existence for activation: the path itself is there, whatever it is (a link or a directory included).
  const present = (rel) => { try { fs.lstatSync(abs(rel)); return true; } catch { return false; } };

  const raw = suppliedFiles !== undefined
    ? suppliedFiles
    : git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], root).stdout.split('\0').filter(Boolean).map((p) => p.replace(/\\/g, '/'));
  const files = raw.filter((p) => !p.startsWith('.ai/.run/') && !p.startsWith('.ai/.canary/') && !p.includes('node_modules/'));

  // Path metadata of a fixed input, before any body access: the directory chain must hold no link, junction or
  // non-directory (secureDir), and the leaf must be a regular file. 'error' is a stat failure other than absence.
  function inspectPath(rel) {
    const segs = rel.split('/');
    let dir;
    try { dir = secureDir(root, segs.slice(0, -1)); } catch (e) { return e && e.unsafePath !== undefined ? 'unsafe' : 'error'; }
    if (dir === null) return 'absent';
    let st;
    try { st = fs.lstatSync(path.join(dir, segs[segs.length - 1])); } catch (e) {
      return e && (e.code === 'ENOENT' || e.code === 'ENOTDIR') ? 'absent' : 'error';
    }
    return st.isSymbolicLink() || !st.isFile() ? 'unsafe' : 'present';
  }
  // The body of a fixed input through readInRepo, which re-checks the whole chain.
  function readFixed(rel) {
    try { return { state: 'ok', buf: readInRepo(root, rel) }; } catch (e) {
      return { state: e && e.unsafePath !== undefined ? 'unsafe' : 'io' };
    }
  }

  // ---- installed policy: loaded first, reported at position 3 (plan 4.3 and 4.4) ----
  let policyState = 'absent';
  let policyRow = null;
  let rawPolicy = null;
  let installedPolicy = null;
  let sourceSchema = null;
  const policyIo = () => {
    policyState = 'failed';
    policyRow = row('fail', 'policy-schema', `${POLICY_REL}: POLICY_IO: cannot read security policy: ${POLICY_REL}`);
  };
  const policyPath = inspectPath(POLICY_REL);
  if (policyPath === 'unsafe' || policyPath === 'error') policyIo();
  else if (policyPath === 'present') {
    const r = readFixed(POLICY_REL);
    if (r.state !== 'ok') policyIo();
    else {
      // The installed policy as written (inspectSecurityState and the snippet hash take it unadapted). Its schema is
      // checked with the shared validator; a body that is not JSON gets the loader's own POLICY_JSON message below.
      let parsed = null;
      try { parsed = JSON.parse(stripBom(r.buf.toString('utf8'))); } catch { parsed = null; }
      const issues = parsed === null ? [] : checkSecurityPolicy(parsed);
      if (issues.length) {
        policyState = 'failed';
        policyRow = row('fail', 'policy-schema', `${POLICY_REL}: ${issues[0]}`);
      } else try {
        const loaded = loadEffectivePolicy(root);
        // A policy that no longer parses, or that vanished between the two reads, is an unreadable policy.
        if (loaded.source !== 'project' || parsed === null) policyIo();
        else {
          installedPolicy = loaded.policy;
          sourceSchema = loaded.sourceSchema;
          rawPolicy = parsed;
          policyState = 'valid';
          policyRow = row('pass', 'policy-schema', POLICY_REL);
        }
      } catch (e) {
        if (!(e instanceof Error) || typeof e.code !== 'string') throw e;
        policyState = 'failed';
        policyRow = row('fail', 'policy-schema', `${POLICY_REL}: ${e.message}`);
      }
    }
  }
  // The shipped protection baseline (the current shipped policy, read and validated). When it is missing or invalid
  // the protection state is unknown: deny-all, like a failed installed policy, reported as the policy-baseline failure.
  let shippedSpec = null;
  try {
    shippedSpec = loadSecretSpec();
    readSecurityPolicy(shippedSpec);
  } catch {
    shippedSpec = null;
  }
  const baselineUnavailable = shippedSpec === null;
  // Protection is unknown after an installed-policy failure or without the shipped baseline.
  const protectionUnknown = policyState === 'failed' || baselineUnavailable;
  // An absent installed policy: the shipped-default protection, which is known. A failed one: deny-all.
  const effectivePolicy = protectionUnknown ? null : policyState === 'valid' ? installedPolicy : loadEffectivePolicy(null).policy;
  const isProtected = (rel) => protectionUnknown || isSecretPath(rel, shippedSpec) || isSecretPath(rel, effectivePolicy);
  // The fixed control inputs and every installed runtime or self-test member are read only through readInRepo (links,
  // junctions and escapes refused), in every consumer, so a path the fixed-control or guarded check refused is never
  // read later through a link (plan 4.2). Classification folds case and aliases; the read keeps the original spelling.
  // An optional content read: null for a never-read, protected, refused or unreadable body, which then yields no
  // content-derived row.
  const readBody = (rel) => {
    if (isSecretPath(rel, NEVER_READ) || isProtected(rel)) return null;
    if (isSecretPath(rel, GUARDED)) {
      const r = readFixed(rel);
      return r.state === 'ok' ? r.buf.toString('utf8') : null;
    }
    try { return fs.readFileSync(abs(rel), 'utf8'); } catch { return null; }
  };

  const results = [];
  const add = (level, check, detail) => results.push(row(level, check, detail));

  // ---- 1. Shared settings and manifest: fixed controls, then syntax and shape ----
  let settings = { state: 'absent', value: undefined };
  const settingsPath = inspectPath(SETTINGS_REL);
  if (settingsPath === 'unsafe') settings = { state: 'unsafe' };
  else if (settingsPath !== 'absent') {
    if (isProtected(SETTINGS_REL)) settings = { state: 'protected' };
    else if (settingsPath === 'error') settings = { state: 'io' };
    else {
      const r = readFixed(SETTINGS_REL);
      if (r.state !== 'ok') settings = { state: r.state };
      else {
        try { settings = { state: 'ok', value: JSON.parse(stripBom(r.buf.toString('utf8'))) }; } catch (e) { settings = { state: 'json', message: e.message }; }
      }
    }
  }
  if (settings.state === 'unsafe') add('fail', 'validation-path', `${SETTINGS_REL}: unsafe validation input`);
  else if (settings.state === 'protected') add('fail', 'validation-protected', `${SETTINGS_REL}: protected validation input was not read`);
  else if (settings.state === 'io') add('fail', 'validation-io', `${SETTINGS_REL}: validation input could not be read`);
  else if (settings.state === 'json') add('fail', 'json-syntax', `${SETTINGS_REL}: ${settings.message}`);
  else if (settings.state === 'ok') {
    const found = checkClaudeSettings(settings.value).map((e) => (typeof e === 'string' ? { level: 'fail', msg: e } : e));
    found.forEach((e) => add(e.level, 'json-schema', `${SETTINGS_REL}: ${e.msg}`));
    if (!found.some((e) => e.level === 'fail')) add('pass', 'json-schema', SETTINGS_REL);
  }

  // A valid schema-2 manifest passes and gets one info record (not counted in the totals): it is migration input that
  // the next prepare converts, not a failure. A manifest that fails anything is never used further down, so no path
  // it names is read. Its parse error never echoes the native parser message or the source text.
  let manifestState = 'absent';
  let manifest = null;
  const manifestPath = inspectPath(MANIFEST_REL);
  if (manifestPath !== 'absent') {
    manifestState = 'invalid';
    const r = manifestPath === 'present' ? readFixed(MANIFEST_REL) : { state: manifestPath === 'unsafe' ? 'unsafe' : 'io' };
    if (r.state === 'unsafe') add('fail', 'validation-path', `${MANIFEST_REL}: unsafe validation input`);
    else if (r.state !== 'ok') add('fail', 'validation-io', `${MANIFEST_REL}: validation input could not be read`);
    else {
      let data;
      let parsed = false;
      try { data = JSON.parse(stripBom(r.buf.toString('utf8'))); parsed = true; } catch { /* reported without the native message */ }
      if (!parsed) add('fail', 'json-syntax', `${MANIFEST_REL}: manifest is not valid JSON`);
      else {
        const found = checkManifest(data).map((e) => (typeof e === 'string' ? { level: 'fail', msg: e } : e));
        found.forEach((e) => add(e.level, 'json-schema', `${MANIFEST_REL}: ${e.msg}`));
        if (!found.some((e) => e.level === 'fail')) {
          add('pass', 'json-schema', MANIFEST_REL);
          manifest = readManifest(data).manifest;
          manifestState = 'valid';
          if (manifest.schema === 2) add('info', 'manifest-version', `${MANIFEST_REL}: schema 2 needs update to schema 3`);
        }
      }
    }
  }
  if (policyRow) results.push(policyRow);
  const settingsRecord = manifestState === 'valid' && own(manifest.files, SETTINGS_REL) && manifest.files[SETTINGS_REL].ownership === 'keys'
    ? manifest.files[SETTINGS_REL] : null;

  // 2. Codex agent wrappers: real TOML parse (subset), required string keys, no legacy sandbox
  for (const rel of files.filter((p) => /^\.codex\/agents\/[^/]+\.toml$/.test(p))) {
    const text = readBody(rel);
    if (text === null) continue;
    const { data, errors, unsupported } = parseToml(text);
    errors.forEach((e) => add('fail', 'toml-syntax', `${rel}: ${e}`));
    // Unsupported constructs are never reported as a successful validation.
    unsupported.forEach((e) => add('fail', 'toml-unsupported', `${rel}: ${e}`));
    if (errors.length || unsupported.length) continue;
    for (const key of ['name', 'description', 'developer_instructions']) {
      if (typeof data[key] !== 'string' || !data[key].trim()) add('fail', 'codex-agent-schema', `${rel}: ${key} must be a non-empty string`);
    }
    if ('sandbox_mode' in data) add('fail', 'codex-agent-sandbox', `${rel}: sets sandbox_mode, which switches that agent to legacy sandbox settings and drops deny-read profiles`);
    const ref = (String(data.developer_instructions || '').match(/\.ai\/agents\/[A-Za-z0-9_-]+\.md/) || [])[0];
    if (!ref || !exists(ref)) add('fail', 'wrapper-target', `${rel}: canonical prompt ${ref || '(none)'} not found`);
    else add('pass', 'codex-agent', rel);
  }
  for (const rel of files.filter((p) => /^\.claude\/agents\/[^/]+\.md$/.test(p))) {
    const text = readBody(rel);
    if (text === null) continue;
    const ref = (text.match(/\.ai\/agents\/[A-Za-z0-9_-]+\.md/) || [])[0];
    if (ref && !exists(ref)) add('fail', 'wrapper-target', `${rel}: ${ref} not found`);
  }

  // 3. Instruction files: size, imports, sibling pairing (a protected body yields no content-derived row)
  const agentsFiles = files.filter((p) => /(^|\/)AGENTS\.md$/.test(p));
  const claudeFiles = files.filter((p) => /(^|\/)CLAUDE\.md$/.test(p));
  const stripCode = (s) => s.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  for (const rel of agentsFiles) {
    const t = readBody(rel);
    if (t !== null) {
      const lines = t.split(/\r?\n/).length; const bytes = Buffer.byteLength(t);
      if (bytes > 32 * 1024) add('fail', 'agents-size', `${rel}: ${bytes} bytes exceeds Codex's default 32 KiB project-doc budget; content past it is not loaded`);
      else if (lines > 150) add('warn', 'agents-size', `${rel}: ${lines} lines (target <= 150)`);
      else add('pass', 'agents-size', `${rel}: ${lines} lines, ${bytes} bytes`);
    }
    const dir = path.posix.dirname(rel); const sibling = dir === '.' ? 'CLAUDE.md' : `${dir}/CLAUDE.md`;
    if (!exists(sibling)) add('warn', 'claude-pairing', `${rel}: no sibling CLAUDE.md; Claude will not load it while a root CLAUDE.md exists (default mode)`);
    if (t !== null && /@[\w./-]+\.md/.test(stripCode(t))) add('warn', 'agents-imports', `${rel}: contains @path text; Claude expands it eagerly through the CLAUDE.md import, Codex treats it as plain text`);
  }
  for (const rel of claudeFiles) {
    const t = readBody(rel);
    if (t === null) continue;
    const lines = t.split(/\r?\n/).length;
    const dir = path.posix.dirname(rel); const agentsSibling = dir === '.' ? 'AGENTS.md' : `${dir}/AGENTS.md`;
    if (exists(agentsSibling) && !/(^|\s)@(\.\/)?AGENTS\.md(\s|$)/m.test(stripCode(t))) add('fail', 'claude-import', `${rel}: sibling AGENTS.md exists but is not imported with @AGENTS.md`);
    if (lines > 200) add('warn', 'claude-size', `${rel}: ${lines} lines (target < 200)`);
    for (const m of stripCode(t).matchAll(/(?:^|\s)@([\w./-]+)/g)) {
      const target = path.posix.normalize(path.posix.join(dir, m[1]));
      if (!exists(target)) add('fail', 'claude-import-target', `${rel}: @${m[1]} -> ${target} does not exist`);
    }
  }

  // 4. Path references in generated docs must exist
  const REF = /`((?:\.ai|docs|\.claude|\.codex)\/[\w./-]+\.(?:md|json|toml|mjs))`|\]\(((?:\.\/)?(?:\.ai|docs|\.claude|\.codex)\/[^)#\s]+)\)/g;
  for (const rel of [...agentsFiles, ...claudeFiles, ...files.filter((p) => /^\.ai\/agents\/.+\.md$/.test(p))]) {
    const t = readBody(rel);
    if (t === null) continue;
    for (const m of t.matchAll(REF)) {
      const target = (m[1] || m[2]).replace(/^\.\//, '');
      if (!exists(target)) add('fail', 'reference-exists', `${rel}: ${target} not found`);
    }
  }

  // 5. Managed markers and drift against the (entirely valid) manifest
  for (const rel of files.filter((p) => /\.(md|gitignore)$/.test(p) || p === '.gitignore')) {
    const t = readBody(rel);
    if (t === null) continue;
    const { errors } = parseBlocks(t);
    if (errors.length) add('fail', 'markers', `${rel}: ${errors.join('; ')}`);
  }
  if (manifestState === 'valid') {
    for (const [rel, entry] of Object.entries(manifest.files)) {
      if (!exists(rel)) { add('warn', 'drift', `${rel}: in manifest but missing on disk`); continue; }
      if (isProtected(rel)) continue;
      if (entry.ownership === 'full') {
        const t = readBody(rel);
        if (t !== null && normalizedHash(t) !== entry.sha256) add('warn', 'drift', `${rel}: fully-managed file edited since install (will not be overwritten without consent)`);
      }
      if (entry.ownership === 'blocks') {
        const t = readBody(rel);
        if (t === null) continue;
        const { hashes } = blockHashes(t);
        for (const [id, sha] of Object.entries(entry.blocks || {})) {
          if (hashes[id] === undefined) add('warn', 'drift', `${rel}: managed block ${id} removed by user`);
          else if (hashes[id] !== sha) add('warn', 'drift', `${rel}: managed block ${id} edited by user`);
        }
      }
    }
  }

  // 6. Secret-shaped content in generated, non-secret files. Reports file:line:rule only.
  const RULES = [
    ['canary-token', /PROJECT_SETUP_CANARY_[0-9a-f]{24}/],
    ['aws-access-key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
    ['private-key-block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['jwt', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
    ['url-credentials', /[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@<>]{3,}@/i],
    ['assigned-secret', /\b(password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*["']?(?!<|\$\{|process\.env|REDACTED|changeme|your)[^\s"'`]{8,}/i],
  ];
  const generated = manifestState === 'valid' ? Object.keys(manifest.files) : [...agentsFiles, ...claudeFiles];
  let hits = 0;
  for (const rel of generated) {
    if (!exists(rel)) continue;
    const t = readBody(rel);
    if (t === null) continue;
    t.split(/\r?\n/).forEach((line, i) => {
      for (const [rule, re] of RULES) if (re.test(line)) { hits++; add('fail', 'secret-shaped-content', `${rel}:${i + 1} (${rule})`); }
    });
  }
  if (!hits) add('pass', 'secret-shaped-content', `${generated.length} generated files scanned (pattern-based; not a guarantee)`);

  // 7. Project-local security tooling
  if (exists('.ai/agents')) {
    for (const rel of [POLICY_REL, '.ai/tools/git-safe.mjs']) if (!exists(rel)) add('fail', 'security-tooling', `${rel} missing; shared agents depend on it`);
  }

  // 8. Catalog runtime targets (plan 4.9, closed PQ2 = A+). Nothing after an installed-policy failure (the
  // policy-schema row already explains the unknown protection state), and nothing while the shipped protection baseline
  // is unavailable (the policy-baseline row explains it). Presence and readability only; the bytes are never executed
  // here or compared with the shipped ones.
  if (!protectionUnknown) {
    let units = null;
    let catalogRead = false;
    const catalog = () => { if (!catalogRead) { units = runtimeCatalog(); catalogRead = true; } return units; };
    let active = present('.ai/agents') || policyState === 'valid' || present('.ai/tools');
    // A broken catalog cannot say whether the manifest records one of its targets: fail closed.
    if (!active && manifestState === 'valid') active = catalog() === null || catalog().some((u) => own(manifest.files, u.target));
    if (active) {
      if (catalog() === null) add('fail', 'runtime-catalog', 'Runtime catalog is unavailable or invalid');
      else {
        for (const { target } of catalog()) {
          const state = inspectPath(target);
          if (state === 'unsafe') add('fail', 'runtime-unit', `${target}: runtime member is unsafe`);
          else if (isProtected(target)) add('fail', 'runtime-unit', `${target}: runtime member is protected; not read`);
          else if (state === 'absent') {
            if (manifestState === 'valid' && own(manifest.files, target)) add('fail', 'runtime-unit', `${target}: runtime member is missing; manifest records it as installed`);
            else if (policyState === 'valid' && sourceSchema === 2) add('fail', 'runtime-unit', `${target}: runtime member is missing; installed policy schema 2 requires it`);
            else add('info', 'runtime-unit', `${target}: runtime unit incomplete; needs update`);
          } else if (state === 'error') add('fail', 'runtime-unit', `${target}: runtime member could not be read`);
          else {
            const r = readFixed(target);
            if (r.state === 'ok') add('pass', 'runtime-unit', `${target}: runtime member is present and readable`);
            else if (r.state === 'unsafe') add('fail', 'runtime-unit', `${target}: runtime member is unsafe`);
            else add('fail', 'runtime-unit', `${target}: runtime member could not be read`);
          }
        }
      }
    }
  }

  // 9. Installed policy and snippet state (plan 4.5): from the installed managed record, never from a byte comparison
  // with the current shipped file. Only for a valid installed policy beside a valid or absent manifest.
  if (baselineUnavailable) add('fail', 'policy-baseline', BASELINE_UNAVAILABLE);
  else if (policyState === 'valid' && manifestState !== 'invalid') {
    const shipped = shippedInspectionData();
    if (shipped === null) add('fail', 'policy-baseline', BASELINE_UNAVAILABLE);
    else results.push(...inspectSecurityState({ policy: rawPolicy, manifest: manifestState === 'valid' ? manifest : null, ...shipped }));
  }

  // 10. User deny rules relative to the working directory (plan 4.6). Managed only by exact membership in the
  // validated keys-owned settings record; an invalid manifest emits nothing.
  if (manifestState !== 'invalid' && settings.state === 'ok' && isObj(settings.value) && isObj(settings.value.permissions) && Array.isArray(settings.value.permissions.deny)) {
    const managedDeny = settingsRecord && isObj(settingsRecord.managed) && Array.isArray(settingsRecord.managed['permissions.deny']) ? settingsRecord.managed['permissions.deny'] : [];
    for (const rule of settings.value.permissions.deny) {
      if (typeof rule !== 'string' || managedDeny.includes(rule)) continue;
      const m = /^(?:Read|Edit)\(([\s\S]*)\)$/.exec(rule);
      if (!m) continue;
      const body = m[1];
      if (body.startsWith('!') || body.startsWith('**/') || body.startsWith('/') || body.startsWith('~/')) continue;
      add('warn', 'deny-anchor', `User deny ${JSON.stringify(rule)} is relative to the session's working directory, so it may not protect what it names`);
    }
  }

  // 11. Shared allows through C7's classifier (plan 4.7 and C10-P3-2): its rows unchanged, personal settings never read.
  {
    const failed = (detail) => {
      add('fail', 'allow-input', detail);
      add('info', 'allow-local', '.claude/settings.local.json is personal and is not managed by project-setup; permissions there do not protect the team.');
    };
    if (manifestState === 'invalid') failed('invalid .ai/manifest.json; allow ownership was not classified');
    // C10-P3-2: after an installed-policy failure (or without the shipped baseline) the settings are protected and
    // unread, whether or not they exist; their own fixed-control row still reports an unsafe path.
    else if (protectionUnknown || settings.state === 'protected') failed('.claude/settings.json is protected; shared allows were not classified');
    else if (settings.state === 'unsafe') failed('unsafe .claude/settings.json; shared allows were not classified');
    else if (settings.state === 'io') failed('cannot read .claude/settings.json; shared allows were not classified');
    else if (settings.state === 'json') failed('invalid .claude/settings.json; shared allows were not classified');
    else {
      let inspection = null;
      try {
        inspection = inspectAllows({
          settings: settings.state === 'ok' ? settings.value : {},
          managed: settingsRecord ? settingsRecord.managed : {},
          omissions: settingsRecord && own(settingsRecord, 'omissions') ? settingsRecord.omissions : {},
        });
      } catch (e) {
        if (!(e instanceof Error) || typeof e.code !== 'string') throw e;
        failed(e.message);
      }
      if (inspection) results.push(...inspection.results);
    }
  }

  // 12. Installed hook self-test (plan 4.8, closed PQ1 = A): the first matching decision row wins.
  let hookSelfTest = 'not-run';
  {
    const info = (detail) => add('info', 'hooks-selftest', detail);
    const failRow = (detail) => add('fail', 'hooks-selftest', detail);
    const settingsAvailable = settings.state === 'absent' || (settings.state === 'ok' && isObj(settings.value));
    const recordedHook = manifestState === 'valid' && HOOK_TARGETS.some((t) => own(manifest.files, t));
    const managedHook = Boolean(settingsRecord) && isObj(settingsRecord.managed) && Array.isArray(settingsRecord.managed.hooks)
      && settingsRecord.managed.hooks.some((h) => isObj(h) && h.event === HOOK_EVENT && h.matcher === HOOK_MATCHER && h.command === HOOK_COMMAND);
    const signal = () => HOOK_TARGETS.some(present) || recordedHook || (settings.state === 'ok' && hasCanonicalSettingsHook(settings.value)) || managedHook;
    if (manifestState === 'valid' && manifest.schema === 2) info('Schema 2 needs update; installed hook self-test was not run');
    else if (manifestState === 'invalid') info('Invalid setup inputs prevented installed hook self-test');
    else if (signal()) {
      const UNSAFE = 'Installed hook self-test was not run because a runtime path is unsafe or protected';
      const UNAVAILABLE = 'Installed hook self-test is unavailable';
      if (protectionUnknown) failRow(UNSAFE);
      else {
        const states = HOOK_TARGETS.map((t) => ({ state: inspectPath(t), protectedPath: isProtected(t) }));
        if (states.some((s) => s.state === 'unsafe' || s.protectedPath)) failRow(UNSAFE);
        else if (states.some((s) => s.state !== 'present')) failRow(UNAVAILABLE);
        else {
          const reads = HOOK_TARGETS.map(readFixed);
          if (reads.some((r) => r.state === 'unsafe')) failRow(UNSAFE);
          else if (reads.some((r) => r.state !== 'ok')) failRow(UNAVAILABLE);
          else {
            let passed = false;
            try {
              const result = await execute(process.execPath, [path.join(root, '.ai', 'tools', 'hooks-selftest.mjs')], {
                cwd: root, env: process.env, shell: false, windowsHide: true, encoding: 'utf8', timeout: 20000, maxBuffer: 65536,
              });
              passed = selfTestPassed(result);
            } catch {
              passed = false; // a throw, a rejection or a spawn failure; nothing about it is reported
            }
            hookSelfTest = passed ? 'passed' : 'failed';
            if (passed) add('pass', 'hooks-selftest', 'Installed hook self-test passed; Claude hook loading is not verified');
            else failRow('Installed hook self-test failed');
          }
        }
      }
    } else if (!settingsAvailable || protectionUnknown) info('Invalid setup inputs prevented installed hook self-test');
    else info('No installed raw-Git hook was identified; installed hook self-test was not run');
  }

  // 13. Hygiene
  if (exists('.claudeignore')) add('warn', 'claudeignore', '.claudeignore has no effect in Claude Code; ensure its entries exist as Read deny rules');
  if (!isProtected('.gitignore')) {
    const gi = exists('.gitignore') ? (readBody('.gitignore') ?? '') : '';
    for (const needle of ['.claude/settings.local.json', 'CLAUDE.local.md']) if (!gi.includes(needle)) add('warn', 'gitignore', `${needle} not ignored`);
  }
  if (!exists('.ai/.run/.gitignore') && exists('.ai/.run')) add('fail', 'run-dir-ignored', '.ai/.run has no self-ignore file');

  const summary = { pass: results.filter((r) => r.level === 'pass').length, warn: results.filter((r) => r.level === 'warn').length, fail: results.filter((r) => r.level === 'fail').length };
  return { ok: summary.fail === 0, summary, results, runtimeEvidence: { hookSelfTest, claudeHookLoading: 'not-verified' } };
}

/**
 * The validator as a function (plan 2.4 and 4.1): argv [] or ["--json"] (identical JSON), dependencies
 * { root?, files?, execute? } for in-process callers only. Resolves { exitCode, stdout, stderr }; stderr is empty.
 * Invalid dependencies, or a root the filesystem-root helper refuses, reject with VALIDATE_OPTIONS before any project
 * body is read or any process is launched.
 */
export async function main(argv, dependencies) {
  if (!Array.isArray(argv) || !(argv.length === 0 || (argv.length === 1 && argv[0] === '--json'))) {
    return { exitCode: 2, stdout: J(USAGE_BODY), stderr: '' };
  }
  const deps = readDependencies(dependencies);
  let root;
  if (deps.root !== undefined) {
    try { root = setFilesystemRoot(deps.root); } catch { throw optionsError(); }
  } else {
    root = repoRoot();
    if (!root) return { exitCode: 1, stdout: J({ ok: false, error: 'not inside a git repository' }), stderr: '' };
  }
  const report = await validateProject(root, deps.files, deps.execute || defaultExecute);
  return { exitCode: report.summary.fail ? 1 : 0, stdout: J(report), stderr: '' };
}

// ---------------------------------------------------------------- CLI ----
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
  main(process.argv.slice(2)).then((r) => {
    process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    process.exitCode = r.exitCode;
  }, () => {
    process.stderr.write('validate.mjs: internal error\n');
    process.exitCode = 1;
  });
}
