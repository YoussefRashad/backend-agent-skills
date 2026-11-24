#!/usr/bin/env node
// project-setup 3.2.0: the behavioural and contract checks of docs/plans/2026-11-22-project-setup-v3.2.0-plan.md that run against the REAL tree (scripts, data, assets, references).
// Written by the tests lane BEFORE the implementation (plan 4.7 step 1): against the 3.1.0 tree this spec is red, and each red line names the shipped text or behaviour that is missing.
//
// Covered here (plan 6.1): AC-A1-1, AC-A2-1 to 4, AC-A4-1 and 3 to 11, AC-A5-1 to 7, AC-B1-2 to 5 and 7, AC-B2-3 and 4. The gates (amendment records, pins, view identity, notes, version) are in
// tests/release-3.2.0.test.mjs; the living acceptance spec (A1/A3 helper checks, C1/C2 pins) is tests/bs-doc-map.test.mjs.
//
// Rules this file keeps: the real scripts and the real validators run (never a mock); every "X is rejected when Y" has Y absent, Y inconsistent and the boundary; the exact plan texts are embedded
// below as constants (a typo in a reference shows up as a difference, not as agreement with itself); a pending pin prints a FAIL line naming PIN_PENDING and never passes silently.
// Output: one line "PASS  <name>" or "FAIL  <name>" per assertion (a failing one is followed by an indented detail line), then "N PASS / N FAIL / N SKIP". Exit 0 only with no FAIL.
// There is no lint for project-setup (Prettier ignores it, root .prettierignore), so no lint result is claimed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseBlocks } from '../scripts/blocks.mjs';
import { normalizedHash, isSecretPath } from '../scripts/lib.mjs';
import { policyEntryKey, readSecurityPolicy } from '../assets/tools/security-policy.mjs';
import { classifySecurityMigration, inspectSecurityState, resolveSecurityMigration } from '../scripts/migrate-security-paths.mjs';
import { mergeManagedDenies } from '../scripts/merge-claude-settings.mjs';
import { PIN_PENDING, buildView, to310Repo } from './helpers/v320-amendments.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..');
const REPO = path.resolve(SKILL, '..');
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: ok === true, detail }); };
const skip = (name, reason) => { results.push({ name, skip: true, detail: reason }); };
const sha = (b) => createHash('sha256').update(b).digest('hex');
const lf = (s) => String(s).replace(/\r\n?/g, '\n');
const squash = (s) => lf(s).replace(/\s+/g, ' ').trim();
const rd = (rel) => fs.readFileSync(path.join(SKILL, ...rel.split('/')), 'utf8');
const attempt = (fn) => { try { return fn(); } catch (e) { return { threw: String(e && e.message ? e.message : e).slice(0, 300) }; } };
const threw = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.threw === 'string';
const codeOf = (fn) => { try { fn(); return null; } catch (e) { return e && e.code !== undefined ? e.code : `no code: ${String(e && e.message).slice(0, 100)}`; } };
const J = (v) => `${JSON.stringify(v, null, 2)}\n`;
const count = (hay, needle) => (needle === '' ? 0 : hay.split(needle).length - 1);

// ------------------------------------------------------------------------------------------------------------------ the plan's exact texts ----
const A1_LINES = [
  '- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; both load their canonical definition from `.ai/agents/`.',
  '- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; only `reviewer` loads its canonical definition from `.ai/agents/`. `docs-sync` is a retained project agent (incomplete project-setup agent update).',
  '- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; only `docs-sync` loads its canonical definition from `.ai/agents/`. `reviewer` is a retained project agent (incomplete project-setup agent update).',
  '- Subagents: `reviewer`, `docs-sync` in `.claude/agents/`; both are retained project agents and neither loads a canonical definition from `.ai/agents/` (incomplete project-setup agent update).',
];
// [AT320_1] (A2) and [AT320_2] (B2): the two paragraphs of the AGENTS.md agents block, in this order after line 79 of the 3.1.0 template.
const AT320_1 = ['Text between `<!-- project-setup:begin ... -->` and `<!-- project-setup:end ... -->`', 'markers in AGENTS.md, CLAUDE.md and .gitignore is managed by project-setup. Every', 'agent, including a retained project agent that does not load a canonical definition,', 'MUST NOT add, remove or move these markers, and MUST change text inside a block only', 'when a code change makes that text wrong. It MUST then name the file and the block', 'id in its output, because the next project-setup update shows that edit for a keep,', 'take-new or merge decision and can otherwise replace it.'].join('\n');
const AT320_2 = ['When you delegate to `reviewer` or `docs-sync`, state in every brief the session\'s', 'original start directory, the repository root and the current directory. Do not invent', 'a start directory you were not given; say that it is unknown instead.'].join('\n');
const CT320_1 = ['- For a delegated agent this bullet replaces the directory comparison above. A delegated', '  agent\'s context or brief MAY show the directory its parent was in rather', '  than the session\'s original start directory. As a delegated agent you MUST treat the', '  original start directory as unknown unless the brief states it. You MUST NOT refuse on', '  your own working directory alone, and when the brief does not state the original start', '  directory you MUST state in your output that it was not given. This prevents a false', '  launch refusal after the parent changed directory inside a root-started session. If', '  the brief states an original start directory strictly below the selected rule\'s', '  directory, the refusal above applies unchanged. The parent session stays bound by', '  this rule.'].join('\n');
const RV320_1 = ['Money and state integrity are the exception. Code in the reviewed change that breaks a', 'critical rule in AGENTS.md, whatever its wording, or a MUST-level rule in the documents', 'it names or in the project review rules, for a money, balance, payment, points or limit', 'flow is a finding whatever its current reachability: for example a read-modify-write', 'without a lock or atomic statement, or a retry without proven idempotency. You MUST rate', 'it HIGH or CRITICAL. A missing caller, route or funding path MUST NOT lower that severity', 'or move it to Open questions, because such code is one wiring change away from moving', 'money and the change that wires it is rarely reviewed against this code\'s locking.', 'State the missing reachability in the Scenario (the interleaving once the code is', 'called) and in Confidence. Classify it **likely risk** while nothing calls it and', '**confirmed bug** when something does. For these flows this paragraph overrides the', 'reachability rule above, the "caller that does not exist" sentence below, the', 'open-question rule of section 4 as far as it concerns reachability, and the verdict', 'rule of section 5 as stated there. A project rule MUST NOT relax this paragraph; on', 'conflict follow this paragraph and report the conflict.'].join('\n');
const RV320_2 = ['   A money or state-integrity finding rated HIGH or CRITICAL under the exception in', '   section 2 makes the verdict **block**, including when it is classified likely risk.'].join('\n');
// The 3.1.0 identities of the three files these records amend (tests/release-3.1.test.mjs:102-104): the reconstruction below must reproduce them byte for byte.
const SHA310 = { reviewer: '696f86bc03f8506075e868465a2b34d76b6384a2809ed1e4ea949cc50f6a305c', agents: '616a26a54d2e8f77b0d4df3e78055ca41f6e7638654ad70a0f4d28a0e4eb5a0e', claude: '5bb1d5ed697e921dcc839d031e082f884ca9a97a1eafd8d4a003d2ddb1cbaa47' };
const PRIOR_SHA = '37711ab7b8e1781ce533c705971f93351f1331a44b16e11e846080eb8fed1a79'; // PRIOR_SHIPPED.sha256: the normalized hash of the 3.1.0 data/secret-paths.json (plan A4)

// The 3.1.0 text of each amended template, derived by removing exactly the 3.2.0 insertions (so a record that does not reproduce the 3.1.0 bytes is caught by SHA310 below).
const to310 = {
  agents: (t) => lf(t).replace(`\n${AT320_2}\n\n${AT320_1}\n`, ''),
  claude: (t) => lf(t).replace(`${CT320_1}\n`, ''),
  reviewer: (t) => lf(t).replace(`${RV320_1}\n\n`, '').replace(`${RV320_2}\n`, ''),
};
const TPL_AGENTS = rd('assets/templates/AGENTS.md');
const TPL_CLAUDE = rd('assets/templates/CLAUDE.md');
const REVIEWER = rd('assets/agents/reviewer.md');
const DOCS = rd('references/docs-generation.md');
const rendered = (t) => lf(t).replace(/\{\{PROJECT_NAME\}\}/g, 'fixture-app');
const AGENTS_VALS = { PROJECT_NAME: 'fixture-app', ONE_LINE_PURPOSE: 'A fixture service.', STACK_WITH_VERSIONS: 'NestJS 11', PACKAGE_MANAGER: 'npm', RUNTIME_VERSION: 'Node 24', DB_CHANGE_POLICY: 'migrations only', VERIFIED_COMMANDS: '- npm test', NESTED_INSTRUCTION_INDEX: '- src/wallet/AGENTS.md' };
const fillAgents = (t) => lf(t).replace(/\{\{([A-Z_]+)\}\}/g, (a, k) => AGENTS_VALS[k] ?? a);

// -------------------------------------------------------------------------------------------------------------------------- scratch + processes ----
// Scratch root: V320_SCRATCH (for example D:/ps-live/v320, a directory outside the OS temp directory, which a sandboxed user cannot always use) or, when unset, the OS temp directory.
const SCRATCH_ROOT = process.env.V320_SCRATCH ? path.resolve(process.env.V320_SCRATCH) : os.tmpdir();
fs.mkdirSync(SCRATCH_ROOT, { recursive: true });
const TMP = fs.realpathSync.native(fs.mkdtempSync(path.join(SCRATCH_ROOT, 'ps-v320-')));
let seq = 0;
const scratch = (label) => { const d = path.join(TMP, `${label}-${++seq}`); fs.mkdirSync(d, { recursive: true }); return d; };
const GITCONFIG = path.join(TMP, 'gitconfig');
fs.writeFileSync(GITCONFIG, '[user]\n\tname = Fixture\n\temail = fixture@example.invalid\n[commit]\n\tgpgsign = false\n[core]\n\tautocrlf = false\n');
/** A fresh isolated user environment: HOME and USERPROFILE, CLAUDE_CONFIG_DIR and CODEX_HOME under one scratch directory; the real user directories are never read or written. */
function isolated(label, { codexIsAgents = false } = {}) {
  const base = scratch(label);
  const home = path.join(base, 'home'); const claude = path.join(base, 'claude-config'); const codex = codexIsAgents ? path.join(home, '.agents') : path.join(base, 'codex-home');
  for (const d of [home, claude, codex]) fs.mkdirSync(d, { recursive: true });
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^(GIT_|CLAUDE|CODEX_HOME$)/i.test(k) && typeof v === 'string') env[k] = v;
  Object.assign(env, { HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: claude, CODEX_HOME: codex, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: GITCONFIG, GIT_TERMINAL_PROMPT: '0' });
  return { base, home, claude, codex, env, claudeSkills: path.join(claude, 'skills'), agentsSkills: path.join(home, '.agents', 'skills') };
}
const ISO = isolated('default');
const run = (cmd, args, cwd, env = ISO.env) => spawnSync(cmd, args, { cwd, env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 180000, maxBuffer: 1 << 26 });
const node = (script, args, cwd, env = ISO.env) => { const r = run(process.execPath, [script, ...args], cwd, env); let json = null; try { json = JSON.parse(r.stdout); } catch { /* not JSON */ } return { code: r.status, out: String(r.stdout ?? ''), err: String(r.stderr ?? ''), json, dead: r.error ? String(r.error.message) : null }; };
const S = (name) => path.join(SKILL, 'scripts', `${name}.mjs`);
const git = (cwd, ...args) => { const r = run('git', args, cwd); return { code: r.status, out: String(r.stdout ?? '').trim(), err: String(r.stderr ?? '').trim() }; };
const put = (root, rel, data) => { const p = path.join(root, ...rel.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); };
const getf = (root, rel) => { try { return fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8'); } catch { return null; } };
function mkRepo(label, files) {
  const root = scratch(label);
  git(root, 'init', '-q');
  for (const [rel, text] of Object.entries(files)) put(root, rel, text);
  git(root, 'add', '-A');
  if (git(root, 'commit', '-qm', 'fixture').code !== 0) throw new Error('cannot commit the fixture repository');
  return root;
}
const commitAll = (root, msg = 'fixture') => { git(root, 'add', '-A'); git(root, 'commit', '-qm', msg, '--allow-empty'); };
const baseFiles = (extra = {}) => ({ 'package.json': '{"name":"fixture-app"}\n', '.gitignore': '.claude/settings.local.json\nCLAUDE.local.md\n', ...extra });
const manifestOf = (root) => { try { return JSON.parse(fs.readFileSync(path.join(root, '.ai', 'manifest.json'), 'utf8')); } catch { return null; } };
const validateRows = (root) => (node(S('validate'), ['--json'], root).json?.results ?? []);
const treeHashes = (root) => { const out = {}; const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === '.git' || (rel === '.ai' && (e.name === '.run' || e.name === '.setup.lock'))) continue; const r = rel === '' ? e.name : `${rel}/${e.name}`; if (e.isDirectory()) walk(path.join(d, e.name), r); else out[r] = sha(fs.readFileSync(path.join(d, e.name))); } }; walk(root, ''); return out; };
// One apply transaction through the real scripts: lock, init, drafts and requests, prepare (with the approvals given) and, when prepare succeeds, commit with the printed plan hash.
function tx(root, { drafts = {}, requests = {}, mode = 'update', approve = [], doCommit = true, hold = false } = {}) {
  const id = `v320-${++seq}`;
  const acquire = node(S('lock'), ['acquire', '--run-id', id], root);
  const init = node(S('apply'), ['init', '--run-id', id], root);
  for (const [rel, text] of Object.entries(drafts)) put(root, `.ai/.run/${id}/drafts/${rel}`, text);
  for (const [name, v] of Object.entries(requests)) put(root, `.ai/.run/${id}/${name}`, typeof v === 'string' ? v : J(v));
  const prep = node(S('apply'), ['prepare', '--run-id', id, '--mode', mode, ...(approve.length > 0 ? ['--approve-user-content', approve.join(',')] : [])], root);
  const res = { id, root, acquire, init, prep, commit: null };
  if (doCommit && prep.json?.ok === true) res.commit = node(S('apply'), ['commit', '--run-id', id, '--approved-plan', prep.json.planSha256], root);
  if (!hold) node(S('lock'), ['release', '--run-id', id], root);
  return res;
}
const committed = (r) => r.commit !== null && r.commit.code === 0 && r.commit.json?.ok === true;
const approvalTargets = (r) => (r.prep.json?.errors ?? []).filter((e) => e.code === 'APPROVAL_REQUIRED' || e.code === 'APPLY_APPROVAL_REQUIRED').map((e) => e.target).sort();
const dead = (r) => r.dead !== null;

// ======================================================================================================================== A1-1 ====
{
  // AC-A1-1: the four lines extracted from references/docs-generation.md are distinct, ASCII and one line each; the first equals the template's Subagents line, found by content.
  const sec = (() => { const i = DOCS.search(/^#{2,4} Subagents line variants\s*$/m); if (i < 0) return null; const rest = DOCS.slice(i); const m = /\n#{2,4} (?!Subagents line variants)/.exec(rest.slice(1)); return m === null ? rest : rest.slice(0, m.index + 1); })();
  const found = sec === null ? null : lf(sec).split('\n').filter((l) => l.startsWith('- Subagents:'));
  const tplLine = lf(TPL_CLAUDE).split('\n').find((l) => l.startsWith('- Subagents:'));
  check('AC-A1-1: references/docs-generation.md has a "Subagents line variants" subsection', sec !== null, 'the subsection is not shipped yet');
  check('AC-A1-1: the subsection holds exactly four Subagents lines, distinct, ASCII and one line each', found !== null && found.length === 4 && new Set(found).size === 4 && found.every((l) => /^[\x20-\x7e]+$/.test(l)), found === null ? 'no subsection' : found.length);
  check('AC-A1-1: the first line equals the template Subagents line, found by content (not by line number)', found !== null && found.length > 0 && found[0] === tplLine && count(lf(TPL_CLAUDE), `${tplLine}\n`) === 1, { template: tplLine });
  check('AC-A1-1: the four lines are the plan\'s closed set, in order (full, docs-sync-retained, reviewer-retained, both-retained)', found !== null && JSON.stringify(found) === JSON.stringify(A1_LINES), found);
  check('AC-A1-1: the template line is unchanged by 3.2.0 (the full-layer line; the variants live in the reference)', tplLine === A1_LINES[0]);
}

// ======================================================================================================================== A2 ====
{
  const agents = lf(TPL_AGENTS);
  const parsed = parseBlocks(agents);
  const agentsBlock = parsed.blocks.find((b) => b.id === 'agents');
  const inner = agentsBlock === undefined ? '' : lf(agentsBlock.inner);
  const ANCHOR = 'Do not create an ad-hoc agent for the same job.';
  check('AC-A2-1: the template agents block contains the managed-block rule paragraph byte for byte, once', count(inner, AT320_1) === 1, 'the [AT320_1] paragraph is not in the agents block');
  check('AC-A2-1: the template parses with the real blocks.mjs rules into six blocks with no marker error', parsed.errors.length === 0 && parsed.blocks.length === 6, { errors: parsed.errors, blocks: parsed.blocks.map((b) => b.id) });
  check('AC-A2-1: the template is at most 150 lines (the limit of scripts/validate.mjs)', agents.replace(/\n$/, '').split('\n').length <= 150, agents.replace(/\n$/, '').split('\n').length);
  check('AC-A2-1: the order inside the agents block is line 79, then [AT320_2], then [AT320_1] (the layer sentence, when present, sits between line 79 and [AT320_2])', (() => { const a = inner.indexOf(ANCHOR); const b = inner.indexOf(AT320_2); const c = inner.indexOf(AT320_1); return a >= 0 && b > a && c > b; })(), { anchor: inner.indexOf(ANCHOR), at2: inner.indexOf(AT320_2), at1: inner.indexOf(AT320_1) });
  check('AC-A2-1: the 3.1.0 template is reproduced byte for byte by removing the two paragraphs (digest 616a26a5...), so nothing else in the template changed', sha(to310.agents(TPL_AGENTS)) === SHA310.agents, sha(to310.agents(TPL_AGENTS)));
  check('AC-A2-1: the paragraph names the markers in backticks mid-line, so no line of it starts a marker', AT320_1.split('\n').every((l) => !/^\s*<!--\s*project-setup:(begin|end)\b/.test(l)));
  // AC-A2-4 (mutant, D-14): a real marker line inside the paragraph makes the real parser report a marker error; the shipped paragraph does not.
  { const bad = agents.replace(AT320_1, AT320_1.replace('markers in AGENTS.md', '<!-- project-setup:begin id=x -->\nmarkers in AGENTS.md')); const ok = parseBlocks(agents);
    check('AC-A2-4: a real marker line (<!-- project-setup:begin id=x --> at a line start) inside the paragraph is a marker error', bad !== agents && parseBlocks(bad).errors.length > 0, parseBlocks(bad).errors);
    check('AC-A2-4: the shipped paragraph is not a marker error', ok.errors.length === 0 && count(agents, AT320_1) === 1, ok.errors); }
  // AC-A2-2 and 3 (real apply.mjs and validate.mjs on a synthetic project): an edit by an agent inside a managed block is a drift warning, and the next update takes it only with the approval.
  const draft1 = fillAgents(TPL_AGENTS);
  const root = mkRepo('a2', baseFiles());
  const first = tx(root, { mode: 'fresh', drafts: { 'AGENTS.md': draft1 } });
  commitAll(root);
  const m1 = manifestOf(root);
  check('AC-A2-2: precondition: the template renders to a blocks-owned AGENTS.md installed by the real apply', committed(first) && m1?.files?.['AGENTS.md']?.ownership === 'blocks' && getf(root, 'AGENTS.md') === draft1, { prepare: first.prep.json, ownership: m1?.files?.['AGENTS.md'] });
  const edited = draft1.replace('A fixture service.', 'A fixture service, edited by a retained agent.');
  put(root, 'AGENTS.md', edited); commitAll(root, 'agent edit');
  const drift = validateRows(root).filter((r) => r.check === 'drift' && r.level === 'warn');
  check('AC-A2-2: an edit inside the overview block is exactly one warn/drift row, and it names overview', edited !== draft1 && drift.length === 1 && /managed block overview edited by user/.test(drift[0].detail), drift);
  // The plan's next two sentences ("Draft a new overview: prepare exits 3 with APPLY_APPROVAL_REQUIRED naming exactly AGENTS.md. With --approve-user-content AGENTS.md, prepare and commit
  // succeed and validate has no drift row") contradict the 3.1.0 files and are NOT asserted (ambiguity rule, brief): for a blocks-owned file scripts/apply.mjs contentReasons() runs
  // onlyAddsBlocks(), which compares only the text OUTSIDE managed blocks, so a draft that replaces an edited block needs no approval (measured below), and --approve-user-content for it is
  // refused with APPLY_APPROVAL_UNRELATED. A2 changes no script (plan A2: one template paragraph), so no implementation of A2 can make the plan's sentences true. Decided in review 1 (SR-01): a
  // recorded deviation (release notes "Known limitations", TODO.md TD320_6); the criterion stays a SKIP below and is never counted as passed.
  const redraft = draft1.replace('A fixture service.', 'A fixture service, redrafted by setup.');
  const measured = tx(root, { drafts: { 'AGENTS.md': redraft }, doCommit: false });
  skip('AC-A2-2 (approval steps): "prepare exits 3 with APPLY_APPROVAL_REQUIRED naming AGENTS.md" and "--approve-user-content AGENTS.md commits" are a RECORDED DEVIATION, not asserted and not counted as passed', `recorded deviation (review 1, SR-01, decided by the orchestrator): apply.mjs onlyAddsBlocks compares only the text outside managed blocks, so replacing an edited block needs no approval and the 3.2.0 block-edit protection is instruction-level only; documented in RELEASE-NOTES-3.2.0.md "Known limitations" and in TODO.md TD320_6; observed now: prepare exit ${measured.prep.code}, ok ${measured.prep.json?.ok}, userContentChange ${measured.prep.json?.ops?.[0]?.userContentChange}`);
  // AC-A2-3: keep theirs. The user's edited text is installed and recorded; a draft equal to the installed bytes leaves AGENTS.md and its manifest block hashes byte-identical.
  const root3 = mkRepo('a2k', baseFiles());
  tx(root3, { mode: 'fresh', drafts: { 'AGENTS.md': draft1 } }); commitAll(root3);
  put(root3, 'AGENTS.md', edited); commitAll(root3, 'agent edit');
  const before = { agents: getf(root3, 'AGENTS.md'), record: JSON.stringify(manifestOf(root3)?.files?.['AGENTS.md']) };
  const keep = tx(root3, { drafts: { 'AGENTS.md': edited, 'TODO.md': '# TODO\n' } });
  check('AC-A2-3: with the edited block kept (no new draft for it) the commit of the run leaves AGENTS.md and its manifest block hash byte-identical', committed(keep) && getf(root3, 'AGENTS.md') === before.agents && JSON.stringify(manifestOf(root3)?.files?.['AGENTS.md']) === before.record && before.record !== undefined, { prepare: keep.prep.json, before: before.record, after: JSON.stringify(manifestOf(root3)?.files?.['AGENTS.md']) });
}

// ======================================================================================================================== A4 ====
const DATA_TEXT = rd('data/secret-paths.json');
const FIX_BYTES = fs.readFileSync(path.join(HERE, 'fixtures', 'v320-policy-3.1.0.json'));
const V2_BYTES = fs.readFileSync(path.join(SKILL, 'data', 'secret-paths-v2.0.0.json'));
const parseJson = (b) => JSON.parse(String(b).replace(/^\uFEFF/, ''));
const DESIRED = parseJson(DATA_TEXT);
const PRIOR = parseJson(FIX_BYTES);
const V2P = parseJson(V2_BYTES);
const POLICY_REL = '.ai/security-paths.json';
const idOf = (e) => (e !== null && typeof e === 'object' ? JSON.stringify([e.anchor ?? (String(e.glob).startsWith('**/') ? 'any' : 'root'), String(e.glob).toLowerCase()]) : 'NOT-AN-ENTRY'); // a missing entry is a failing comparison, never a crash that hides every later check
const NEW_IDS = [JSON.stringify(['root', 'env/**']), JSON.stringify(['root', 'cert/**'])];
const norm = (p) => readSecurityPolicy(p).policy; // the validated snapshot: schema 2 with explicit anchors
const entryNew = (glob) => ({ anchor: 'root', glob, kind: 'dir', note: `${glob} added by hand` });
const MANIFEST = (rec) => ({ schema: 3, skill: 'project-setup', skillVersion: '3.1.0', mode: 'fresh', agents: ['claude'], sourceCommit: null, files: rec === null ? {} : { [POLICY_REL]: rec } });
const FULL = (hash) => ({ ownership: 'full', sha256: hash });
const KEYS = (patterns, extra = {}) => ({ ownership: 'keys', managed: { schema: 2, patterns }, ...extra });
const INPUT = (o = {}) => ({ policy: null, manifest: null, baselinePolicy: V2P, baselineSha256: normalizedHash(V2_BYTES), desiredPolicy: DESIRED, desiredSha256: normalizedHash(DATA_TEXT), ...o });
const classify = (o) => attempt(() => classifySecurityMigration(INPUT(o)));
const globsOf = (list) => list.map((c) => (c.entry ?? c.current ?? c.before ?? c).glob);
const counts = (entries) => entries.reduce((a, e) => ({ ...a, [e.classification]: (a[e.classification] ?? 0) + 1 }), {});
const hash = (report) => sha(Buffer.from(J(report), 'utf8'));
const decisionsFor = (report, entries, coverage, over = {}) => ({ schema: 1, reportSha256: hash(report), entries, coverage, denyOmissions: [], dropDenyOwnership: [], overrideUserExceptions: false, ...over });
{
  const desiredPolicy = attempt(() => norm(DESIRED));
  check('AC-A4-2 (data): the shipped data/secret-paths.json passes the real readSecurityPolicy with sourceSchema 1 and holds 22 entries', !threw(desiredPolicy) && readSecurityPolicy(DESIRED).sourceSchema === 1 && DESIRED.patterns.length === 22, DESIRED.patterns.length);
  // AC-A4-1: the fixture is the 3.1.0 policy; PRIOR_SHIPPED.sha256 is by definition its normalizedHash (never a raw digest, so a CRLF checkout of the fixture cannot fail it).
  check('AC-A4-1: normalizedHash of the fixture copy of the 3.1.0 policy is the PRIOR_SHIPPED digest (37711ab7...), by the real scripts/lib.mjs', normalizedHash(FIX_BYTES) === PRIOR_SHA, normalizedHash(FIX_BYTES));
  check('AC-A4-1: the fixture holds the 20 schema-1 entries of the 3.1.0 policy and none for a root env/ or cert/ directory', readSecurityPolicy(PRIOR).sourceSchema === 1 && PRIOR.patterns.length === 20 && !PRIOR.patterns.some((e) => NEW_IDS.includes(idOf(e))), PRIOR.patterns.length);
  // AC-A4-3 (drift guard): the prior list derived from the shipped file equals the validated patterns of the fixture, in order.
  const derived = DESIRED.patterns.filter((e) => !NEW_IDS.includes(idOf(e)));
  check('AC-A4-3: the shipped file minus exactly the two new identities is deep-equal, in order, to the validated patterns of the 3.1.0 fixture', JSON.stringify(norm({ ...DESIRED, patterns: derived }).patterns) === JSON.stringify(norm(PRIOR).patterns), { derived: derived.length });
  check('AC-A4-2 (identities): the new file has the 3.1.0 identity set plus exactly ["root","env/**"] and ["root","cert/**"], and they sit directly after the **/credentials/** entry', (() => { const have = DESIRED.patterns.map(idOf); const old = PRIOR.patterns.map(idOf); const at = have.indexOf(idOf({ glob: '**/credentials/**' })); return JSON.stringify(have.filter((x) => !NEW_IDS.includes(x))) === JSON.stringify(old) && NEW_IDS.every((x) => have.includes(x)) && have[at + 1] === NEW_IDS[0] && have[at + 2] === NEW_IDS[1]; })(), DESIRED.patterns.map(idOf));
  check('AC-A4-2 (entries): the two new entries are dir entries with the notes of the plan and the 20 old entries are deep-equal and in the same relative order', JSON.stringify(DESIRED.patterns.filter((e) => idOf(e) === NEW_IDS[0] || idOf(e) === NEW_IDS[1])) === JSON.stringify([{ glob: 'env/**', kind: 'dir', note: 'Root env/ directory. Root-anchored: config code under src/ is not matched.' }, { glob: 'cert/**', kind: 'dir', note: 'Root cert/ directory.' }]) && JSON.stringify(DESIRED.patterns.filter((e) => !NEW_IDS.includes(idOf(e)))) === JSON.stringify(PRIOR.patterns));

  // AC-A4-4: the state table, on the real functions with literal inputs.
  const P20 = norm(PRIOR).patterns; // the 20 prior entries with explicit anchors
  const row1 = classify({ policy: PRIOR, manifest: MANIFEST(FULL(PRIOR_SHA)) });
  check('AC-A4-4 row 1: a 3.0.0/3.1.0 fresh install (full record, old shipped hash, file untouched) is baseline v3.0.0 with the prior digest and sourceSchema 1', !threw(row1) && row1.baseline === 'v3.0.0' && row1.baselineSha256 === PRIOR_SHA && row1.sourceSchema === 1, threw(row1) ? row1 : { baseline: row1.baseline, sha: row1.baselineSha256 });
  check('AC-A4-4 row 1: 20 entries, all unchanged; coverage for exactly env/** and cert/**, neither already effective; two decisions (include or omit each)', !threw(row1) && row1.entries.length === 20 && row1.entries.every((e) => e.classification === 'unchanged') && JSON.stringify(globsOf(row1.coverage)) === JSON.stringify(['env/**', 'cert/**']) && row1.coverage.every((c) => c.alreadyEffective === false) && row1.requiredDecisions.length === 2 && row1.requiredDecisions.every((d) => JSON.stringify(d.choices) === JSON.stringify(['include', 'omit'])), threw(row1) ? row1 : { counts: counts(row1.entries), coverage: globsOf(row1.coverage), decisions: row1.requiredDecisions.length });
  { const s1 = attempt(() => inspectSecurityState(INPUT({ policy: PRIOR, manifest: MANIFEST(FULL(PRIOR_SHA)) })));
    check('AC-A4-4 row 1: inspectSecurityState gives policy-managed pass, then policy-version behind, and no policy-baseline (unknown) row', !threw(s1) && s1.some((r) => r.check === 'policy-managed' && r.level === 'pass') && s1.some((r) => r.check === 'policy-version') && !s1.some((r) => r.check === 'policy-baseline') && s1.findIndex((r) => r.check === 'policy-managed') < s1.findIndex((r) => r.check === 'policy-version'), s1); }
  const hand = { ...PRIOR, patterns: [...PRIOR.patterns, { glob: 'env/**', kind: 'dir', note: 'added by hand' }, { glob: 'cert/**', kind: 'dir', note: 'added by hand' }] };
  const row2 = classify({ policy: hand, manifest: MANIFEST(FULL(PRIOR_SHA)) });
  check('AC-A4-4 row 2: the same record with the two globs added by hand to patterns is v3.0.0 (the record decides, not the bytes): 20 unchanged, two project-addition rows, two coverage rows already effective, four decisions', !threw(row2) && row2.baseline === 'v3.0.0' && JSON.stringify(counts(row2.entries)) === JSON.stringify({ unchanged: 20, 'project-addition': 2 }) && row2.coverage.length === 2 && row2.coverage.every((c) => c.alreadyEffective === true) && row2.requiredDecisions.length === 4 && row2.requiredDecisions.filter((d) => d.choices.join() === 'project,keep,omit').length === 2, threw(row2) ? row2 : { counts: counts(row2.entries), coverage: row2.coverage.map((c) => c.alreadyEffective), decisions: row2.requiredDecisions.length });
  { const s2 = attempt(() => inspectSecurityState(INPUT({ policy: hand, manifest: MANIFEST(FULL(PRIOR_SHA)) })));
    check('AC-A4-4 row 2: validate would show policy-managed fail (edited since install): inspectSecurityState does', !threw(s2) && s2.some((r) => r.check === 'policy-managed' && r.level === 'fail'), s2); }
  const projectPolicy = { ...norm(PRIOR), projectPatterns: [entryNew('env/**'), entryNew('cert/**')] };
  const row3 = classify({ policy: projectPolicy, manifest: MANIFEST(FULL(PRIOR_SHA)) });
  check('AC-A4-4 row 3: the globs added to projectPatterns: 20 unchanged, two coverage rows already effective, two decisions', !threw(row3) && row3.baseline === 'v3.0.0' && row3.entries.length === 20 && row3.entries.every((e) => e.classification === 'unchanged') && row3.coverage.length === 2 && row3.coverage.every((c) => c.alreadyEffective === true) && row3.requiredDecisions.length === 2, threw(row3) ? row3 : { counts: counts(row3.entries), coverage: row3.coverage.map((c) => c.alreadyEffective) });
  const migrated = { ...norm(PRIOR) };
  const row4 = classify({ policy: migrated, manifest: MANIFEST(KEYS(P20)) });
  check('AC-A4-4 row 4: a migrated project (keys record) is baseline recorded, with coverage for the two', !threw(row4) && row4.baseline === 'recorded' && JSON.stringify(globsOf(row4.coverage)) === JSON.stringify(['env/**', 'cert/**']) && row4.coverage.every((c) => c.alreadyEffective === false) && row4.requiredDecisions.length === 2, threw(row4) ? row4 : { baseline: row4.baseline, coverage: globsOf(row4.coverage) });
  const row5 = classify({ policy: projectPolicy, manifest: MANIFEST(KEYS(P20)) });
  check('AC-A4-4 row 5: a migrated project that already holds env/** and cert/** in projectPatterns has two coverage rows with alreadyEffective true', !threw(row5) && row5.baseline === 'recorded' && row5.coverage.length === 2 && row5.coverage.every((c) => c.alreadyEffective === true), threw(row5) ? row5 : row5.coverage.map((c) => c.alreadyEffective));
  const row6 = classify({ policy: DESIRED, manifest: MANIFEST(FULL(normalizedHash(DATA_TEXT))) });
  check('AC-A4-4 row 6: a fresh install by 3.2.0 is baseline shipped with no coverage and no decision', !threw(row6) && row6.baseline === 'shipped' && row6.coverage.length === 0 && row6.requiredDecisions.length === 0 && row6.entries.length === 22 && row6.entries.every((e) => e.classification === 'unchanged'), threw(row6) ? row6 : { baseline: row6.baseline, coverage: row6.coverage.length });
  const row7 = classify({ policy: V2P, manifest: MANIFEST(FULL(normalizedHash(V2_BYTES))) });
  const v2Ids = V2P.patterns.map(idOf);
  check('AC-A4-4 row 7: a v2.0.0 project is baseline v2.0.0: coverage is every desired identity the v2 file lacks, and it includes the two new ones', !threw(row7) && row7.baseline === 'v2.0.0' && JSON.stringify(row7.coverage.map((c) => idOf(c.entry))) === JSON.stringify([...new Set(DESIRED.patterns.map(idOf))].filter((x) => !v2Ids.includes(x))) && NEW_IDS.every((x) => row7.coverage.some((c) => idOf(c.entry) === x)), threw(row7) ? row7 : { baseline: row7.baseline, coverage: row7.coverage.map((c) => idOf(c.entry)) });
  const row8 = classify({ policy: PRIOR, manifest: MANIFEST(FULL('0'.repeat(64))) });
  check('AC-A4-4 row 8: a full record with any other hash stays unknown: 20 managed-edit rows and 22 coverage rows, 42 decisions (unchanged behaviour)', !threw(row8) && row8.baseline === 'unknown' && row8.entries.length === 20 && row8.entries.every((e) => e.classification === 'managed-edit') && row8.coverage.length === 22 && row8.requiredDecisions.length === 42, threw(row8) ? row8 : { baseline: row8.baseline, entries: row8.entries.length, coverage: row8.coverage.length, decisions: row8.requiredDecisions.length });
  { const s8 = attempt(() => inspectSecurityState(INPUT({ policy: PRIOR, manifest: MANIFEST(FULL('0'.repeat(64))) })));
    check('AC-A4-4 row 8: inspectSecurityState gives only the unknown baseline row for it', !threw(s8) && s8.some((r) => r.check === 'policy-baseline') && !s8.some((r) => r.check === 'policy-managed'), s8); }
  const rowF = classify({ policy: null, manifest: null });
  check('AC-A4-4 (enumeration): no policy and no record is baseline fresh, with a coverage row for every desired identity', !threw(rowF) && rowF.baseline === 'fresh' && rowF.coverage.length === 22, threw(rowF) ? rowF : { baseline: rowF.baseline, coverage: rowF.coverage.length });

  // AC-A4-6: selection order and the inert derivation.
  check('AC-A4-6: a full record with the desired hash gives shipped (desired wins), and one with the v2 hash gives v2.0.0 (v2 wins a tie)', !threw(row6) && row6.baseline === 'shipped' && !threw(row7) && row7.baseline === 'v2.0.0' && attempt(() => classifySecurityMigration(INPUT({ policy: V2P, baselinePolicy: V2P, desiredPolicy: V2P, baselineSha256: normalizedHash(V2_BYTES), desiredSha256: normalizedHash(V2_BYTES), manifest: MANIFEST(FULL(normalizedHash(V2_BYTES))) }))).baseline === 'v2.0.0');
  { const asDesired = (rec) => classify({ policy: PRIOR, desiredPolicy: PRIOR, desiredSha256: PRIOR_SHA, manifest: MANIFEST(rec) });
    check('AC-A4-6: with the 3.1.0 file as the desired policy (no added identity) the derivation is inert: the prior-hash record equals the desired hash and gives shipped, and any other hash gives unknown', asDesired(FULL(PRIOR_SHA)).baseline === 'shipped' && asDesired(FULL('0'.repeat(64))).baseline === 'unknown', { a: asDesired(FULL(PRIOR_SHA)), b: asDesired(FULL('0'.repeat(64))) });
    const oneOnly = { ...PRIOR, patterns: [...PRIOR.patterns, { glob: 'env/**', kind: 'dir', note: 'only one added' }] };
    check('AC-A4-6: a desired policy lacking either added identity (only env/** present) leaves the derivation inert: the prior-hash record is unknown, not v3.0.0', classify({ policy: PRIOR, desiredPolicy: oneOnly, desiredSha256: sha('x'), manifest: MANIFEST(FULL(PRIOR_SHA)) }).baseline === 'unknown');
    const onlyCert = { ...PRIOR, patterns: [...PRIOR.patterns, { glob: 'cert/**', kind: 'dir', note: 'only one added' }] };
    check('AC-A4-6: ... and likewise when only cert/** is present', classify({ policy: PRIOR, desiredPolicy: onlyCert, desiredSha256: sha('y'), manifest: MANIFEST(FULL(PRIOR_SHA)) }).baseline === 'unknown'); }
  // SR-02 (review round 1), the collision the plan requires: both added identities are in the desired policy (so the prior list CAN be derived) AND the full record hash equals both the desired hash and
  // PRIOR_SHIPPED.sha256. The two branches then both match; the current defaults win a tie with the prior default (plan A4 selection order), so the baseline is shipped and never v3.0.0. A selection that
  // tested PRIOR_SHIPPED first would give v3.0.0 with a derived 20-entry list, and a project that is on the shipped bytes would be offered the two additions as if they were new.
  { const tie = (policy) => classify({ policy, desiredPolicy: DESIRED, desiredSha256: PRIOR_SHA, manifest: MANIFEST(FULL(PRIOR_SHA)) });
    const have = DESIRED.patterns.map(idOf);
    const onDesired = tie(DESIRED); const onPrior = tie(PRIOR);
    check('AC-A4-6: precondition of the collision: the desired policy holds both added identities (env/** and cert/**), PRIOR_SHIPPED.sha256 is the digest of the 3.1.0 fixture, and the shipped file really hashes differently (the tie is built by giving the desired hash the prior digest)', NEW_IDS.every((x) => have.includes(x)) && normalizedHash(FIX_BYTES) === PRIOR_SHA && normalizedHash(DATA_TEXT) !== PRIOR_SHA && normalizedHash(V2_BYTES) !== PRIOR_SHA, have);
    check('AC-A4-6: the collision gives baseline shipped, never v3.0.0: the desired policy is the list (22 entries, all unchanged), the digest is the shared one, and there is no coverage and no decision', !threw(onDesired) && onDesired.baseline === 'shipped' && onDesired.baseline !== 'v3.0.0' && onDesired.baselineSha256 === PRIOR_SHA && onDesired.entries.length === 22 && onDesired.entries.every((e) => e.classification === 'unchanged') && onDesired.coverage.length === 0 && onDesired.requiredDecisions.length === 0, threw(onDesired) ? onDesired : { baseline: onDesired.baseline, entries: onDesired.entries.length, counts: counts(onDesired.entries), coverage: onDesired.coverage.length, decisions: onDesired.requiredDecisions.length });
    check('AC-A4-6: the collision gives baseline shipped whatever file is installed (the 3.1.0 file of 20 entries too: the record decides, the bytes do not)', !threw(onPrior) && onPrior.baseline === 'shipped' && onPrior.baselineSha256 === PRIOR_SHA && onPrior.baseline !== 'v3.0.0', threw(onPrior) ? onPrior : { baseline: onPrior.baseline, sha: onPrior.baselineSha256 });
    const asState = attempt(() => inspectSecurityState(INPUT({ policy: DESIRED, desiredSha256: PRIOR_SHA, manifest: MANIFEST(FULL(PRIOR_SHA)) })));
    check('AC-A4-6: inspectSecurityState agrees with the collision: policy-managed pass and no policy-baseline (unknown) row', !threw(asState) && asState.some((r) => r.check === 'policy-managed' && r.level === 'pass') && !asState.some((r) => r.check === 'policy-baseline'), asState); }
  check('AC-A4-6: a keys record is recorded whatever its list says (the keys branch comes first), and a keys record never becomes v3.0.0', !threw(row4) && row4.baseline === 'recorded' && classify({ policy: PRIOR, manifest: MANIFEST(KEYS(P20)) }).baseline === 'recorded');
  { const asMerged = classify({ policy: PRIOR, manifest: MANIFEST({ ownership: 'merged', sha256: PRIOR_SHA }) }); const asBlocks = classify({ policy: PRIOR, manifest: MANIFEST({ ownership: 'blocks', blocks: {}, sha256: PRIOR_SHA }) });
    check('AC-A4-6: only a record of full ownership proves the shipped bytes are installed: a merged or blocks record that carries the 3.1.0 hash is unknown, not v3.0.0', !threw(asMerged) && !threw(asBlocks) && asMerged.baseline === 'unknown' && asBlocks.baseline === 'unknown', { merged: asMerged.baseline ?? asMerged, blocks: asBlocks.baseline ?? asBlocks }); }
  check('AC-A4-6: the derived prior list keeps the entries it keeps in order: the unchanged rows of row 1 are the 20 prior identities in file order', !threw(row1) && JSON.stringify(row1.entries.map((e) => idOf(e.current))) === JSON.stringify(PRIOR.patterns.map(idOf)));

  // AC-A4-5: the decision combinations, against the real resolve and the real validator.
  const input2 = INPUT({ policy: hand, manifest: MANIFEST(FULL(PRIOR_SHA)) });
  const rep2 = attempt(() => classifySecurityMigration(input2));
  const ids = !threw(rep2) ? { add: rep2.entries.filter((e) => e.classification === 'project-addition').map((e) => e.id), cov: rep2.coverage.map((c) => c.id) } : { add: [], cov: [] };
  const decide = (a, c) => decisionsFor(rep2, ids.add.map((id) => ({ id, action: a })), ids.cov.map((id) => ({ id, action: c })));
  const resolved = (a, c) => attempt(() => resolveSecurityMigration(input2, decide(a, c)));
  const identities = (list) => list.map(idOf);
  for (const [addition, coverage, want] of [['keep', 'include', 'valid'], ['project', 'include', 'valid'], ['project', 'omit', 'valid'], ['omit', 'omit', 'valid'], ['keep', 'omit', 'MIGRATION_DECISIONS'], ['omit', 'include', 'MIGRATION_DECISIONS']]) {
    const r = resolved(addition, coverage);
    const ok = want === 'valid' ? !threw(r) && attempt(() => readSecurityPolicy(r.policy)).sourceSchema === 2 : threw(r) && r.threw.startsWith(`${want}:`);
    check(`AC-A4-5: hand-edited patterns row, addition ${addition} with coverage ${coverage} is ${want === 'valid' ? 'valid and passes the real readSecurityPolicy' : want}`, ids.add.length === 2 && ids.cov.length === 2 && ok, threw(r) ? r.threw : r.policy?.schema);
  }
  { const keepInclude = resolved('keep', 'include'); const projInclude = resolved('project', 'include'); const projOmit = resolved('project', 'omit'); const omitOmit = resolved('omit', 'omit');
    const inP = (r, g) => !threw(r) && r.policy.patterns.some((e) => idOf(e) === JSON.stringify(['root', g]));
    const inProject = (r, g) => !threw(r) && r.policy.projectPatterns.some((e) => idOf(e) === JSON.stringify(['root', g]));
    const omitted = (r) => (threw(r) ? null : r.omissions.patterns.map(idOf));
    check('AC-A4-5: keep + include: one managed entry per identity (recommended), none in projectPatterns, no omission', ['env/**', 'cert/**'].every((g) => inP(keepInclude, g) && !inProject(keepInclude, g)) && keepInclude.policy.patterns.length === 22 && JSON.stringify(omitted(keepInclude)) === '[]', threw(keepInclude) ? keepInclude : keepInclude.policy.patterns.length);
    check('AC-A4-5: project + include: the identity is in patterns and in projectPatterns', ['env/**', 'cert/**'].every((g) => inP(projInclude, g) && inProject(projInclude, g)), threw(projInclude) ? projInclude : projInclude.policy);
    check('AC-A4-5: project + omit: a managed omission is recorded for each and the project entry protects (projectPatterns)', ['env/**', 'cert/**'].every((g) => !inP(projOmit, g) && inProject(projOmit, g)) && JSON.stringify(omitted(projOmit)?.sort()) === JSON.stringify([...NEW_IDS].sort()), threw(projOmit) ? projOmit : omitted(projOmit));
    check('AC-A4-5: omit + omit: both dropped from policy and projectPatterns, the omission recorded', ['env/**', 'cert/**'].every((g) => !inP(omitOmit, g) && !inProject(omitOmit, g)) && JSON.stringify(omitted(omitOmit)?.sort()) === JSON.stringify([...NEW_IDS].sort()), threw(omitOmit) ? omitOmit : omitted(omitOmit)); }
  { // First row: include for both keeps all 20 identities and every projectPatterns entry, no omission; omit for both records exactly two omissions and the next report has no coverage row for them.
    const rep1 = attempt(() => classifySecurityMigration(INPUT({ policy: projectPolicy, manifest: MANIFEST(FULL(PRIOR_SHA)) })));
    const dec = (a) => decisionsFor(rep1, [], rep1.coverage.map((c) => ({ id: c.id, action: a })));
    const inc = attempt(() => resolveSecurityMigration(INPUT({ policy: projectPolicy, manifest: MANIFEST(FULL(PRIOR_SHA)) }), dec('include')));
    check('AC-A4-5: include for both keeps all 20 identities and all projectPatterns, adds the two, and records no omission', !threw(inc) && inc.policy.patterns.length === 22 && PRIOR.patterns.every((e) => inc.policy.patterns.some((p) => idOf(p) === idOf(e))) && JSON.stringify(inc.policy.projectPatterns.map(idOf)) === JSON.stringify(NEW_IDS) && inc.omissions.patterns.length === 0, threw(inc) ? inc : { patterns: inc.policy.patterns.length, omissions: inc.omissions });
    const om = attempt(() => resolveSecurityMigration(INPUT({ policy: PRIOR, manifest: MANIFEST(FULL(PRIOR_SHA)) }), (() => { const r = classifySecurityMigration(INPUT({ policy: PRIOR, manifest: MANIFEST(FULL(PRIOR_SHA)) })); return decisionsFor(r, [], r.coverage.map((c) => ({ id: c.id, action: 'omit' }))); })()));
    check('AC-A4-5: omit for both records exactly two omissions and keeps the 20 identities', !threw(om) && om.omissions.patterns.length === 2 && om.policy.patterns.length === 20, threw(om) ? om : om.omissions);
    const second = !threw(om) ? attempt(() => classifySecurityMigration(INPUT({ policy: om.policy, manifest: MANIFEST(KEYS(om.managed.patterns, { omissions: om.omissions })) }))) : om;
    check('AC-A4-5: a second report after the omission has no coverage row for them (the recorded omission is honoured)', !threw(second) && second.baseline === 'recorded' && second.coverage.length === 0, threw(second) ? second : second.coverage.length); }

  { // On the derived v3.0.0 baseline a hand-edited baseline entry is a managed-edit; deciding project moves the edit to projectPatterns and records the omission of the baseline identity, so the identity is not claimed twice.
    const credId = JSON.stringify(['any', '**/credentials/**']);
    const edited = { ...PRIOR, patterns: PRIOR.patterns.map((e) => (e.glob === '**/credentials/**' ? { ...e, note: 'edited by the project' } : e)) };
    const inp = INPUT({ policy: edited, manifest: MANIFEST(FULL(PRIOR_SHA)) });
    const rp = attempt(() => classifySecurityMigration(inp));
    const edit = !threw(rp) ? rp.entries.find((e) => e.classification === 'managed-edit') : null;
    const out = edit ? attempt(() => resolveSecurityMigration(inp, decisionsFor(rp, [{ id: edit.id, action: 'project' }], rp.coverage.map((c) => ({ id: c.id, action: 'include' }))))) : { threw: 'the report has no managed-edit row for the edited entry' };
    check('AC-A4-5: on the v3.0.0 baseline a hand-edited baseline entry decided project is in projectPatterns, no longer in patterns, and its baseline identity is recorded as omitted', !threw(out) && out.policy.projectPatterns.some((e) => idOf(e) === credId) && !out.policy.patterns.some((e) => idOf(e) === credId) && out.omissions.patterns.some((e) => idOf(e) === credId) && !threw(rp) && rp.baseline === 'v3.0.0', threw(out) ? out : { patterns: out.policy.patterns.length, project: out.policy.projectPatterns.map(idOf), omitted: out.omissions.patterns.map(idOf) }); }
  // AC-A4-11 (Q6): the same identity in patterns and in projectPatterns is valid and yields one effective pattern with two sources.
  { const both = { schema: 2, patterns: [entryNew('env/**')], projectPatterns: [entryNew('env/**')] };
    const r = attempt(() => readSecurityPolicy(both));
    const eff = threw(r) ? [] : r.effectivePatterns.filter((e) => idOf(e) === NEW_IDS[0]);
    check('AC-A4-11: a schema-2 policy with the same identity in patterns and projectPatterns passes the real readSecurityPolicy and yields one effective pattern with two sources', !threw(r) && eff.length === 1 && eff[0].sources.length === 2, threw(r) ? r : eff); }
}

// A4 through the real CLIs: one synthetic project installed with the 3.1.0 policy and a full record.
{
  const files = () => baseFiles({ [POLICY_REL]: FIX_BYTES.toString('utf8'), '.ai/manifest.json': J(MANIFEST(FULL(PRIOR_SHA))) });
  const mk = (label, extra = {}) => mkRepo(label, { ...files(), ...extra });
  const rows = (r) => r.json?.results ?? r.json?.ai?.securityPolicy ?? [];
  const root = mk('a4');
  const rep = node(S('migrate-security-paths'), ['report', '--project', root], root);
  check('AC-A4-7: migrate-security-paths report shows baseline v3.0.0 and a reportSha256', rep.code === 0 && rep.json?.ok === true && rep.json.report?.baseline === 'v3.0.0' && /^[0-9a-f]{64}$/.test(rep.json.reportSha256 ?? ''), rep.json ?? rep.out.slice(0, 300));
  const v0 = node(S('validate'), ['--json'], root);
  const d0 = node(S('detect'), [], root);
  const vrows = v0.json?.results ?? [];
  check('AC-A4-7: before the stage, validate --json shows policy-managed pass and policy-version, and no policy-baseline row', vrows.some((r) => r.check === 'policy-managed' && r.level === 'pass') && vrows.some((r) => r.check === 'policy-version') && !vrows.some((r) => r.check === 'policy-baseline'), vrows.filter((r) => /^policy/.test(r.check)));
  const drows = d0.json?.ai?.securityPolicy ?? [];
  check('AC-A4-7: before the stage, detect shows the same rows (policy-managed pass, policy-version, no policy-baseline)', drows.some((r) => r.check === 'policy-managed' && r.level === 'pass') && drows.some((r) => r.check === 'policy-version') && !drows.some((r) => r.check === 'policy-baseline'), drows);
  // stage with include for both, prepare (playing the user), the diff reviews and commit.
  const id = `v320-a4-${++seq}`;
  const acquire = node(S('lock'), ['acquire', '--run-id', id], root);
  const init = node(S('apply'), ['init', '--run-id', id], root);
  const report = rep.json?.report;
  if (report) put(root, `.ai/.run/${id}/security-decisions.json`, J(decisionsFor(report, [], report.coverage.map((c) => ({ id: c.id, action: 'include' })))));
  const st = node(S('migrate-security-paths'), ['stage', '--project', root, '--run-id', id], root);
  let approve = [POLICY_REL]; let prep = null;
  for (let i = 0; i < 4; i++) { prep = node(S('apply'), ['prepare', '--run-id', id, '--mode', 'update', '--approve-user-content', approve.join(',')], root); if (prep.code === 0) break; const need = (prep.json?.errors ?? []).filter((e) => e.code === 'APPLY_APPROVAL_REQUIRED').map((e) => e.target).filter((t) => !approve.includes(t)); if (need.length === 0) break; approve = [...approve, ...need]; }
  const diff1 = node(S('apply'), ['diff', '--project', root, '--run-id', id], root);
  const diff2 = node(S('apply'), ['diff', '--project', root, '--run-id', id], root);
  const com = prep?.json?.ok === true ? node(S('apply'), ['commit', '--run-id', id, '--approved-plan', prep.json.planSha256], root) : { code: null, json: null, out: '' };
  node(S('lock'), ['release', '--run-id', id], root);
  check('AC-A4-7: stage with include for both, prepare, both apply diff reviews and commit succeed (no MIGRATION_REPORT_CHANGED)', acquire.code === 0 && init.code === 0 && st.code === 0 && st.json?.ok === true && prep?.code === 0 && diff1.code === 0 && diff2.code === 0 && com.code === 0 && com.json?.ok === true && !JSON.stringify([st.json, prep?.json, com.json]).includes('MIGRATION_REPORT_CHANGED'), { stage: st.json ?? st.out.slice(0, 300), prepare: prep?.json, diff: [diff1.code, diff2.code], commit: com.json ?? com.out.slice(0, 300) });
  check('AC-A4-7: after the commit the installed policy is schema 2 with 22 managed patterns and the manifest records it with keys ownership', (() => { const p = (() => { try { return JSON.parse(getf(root, POLICY_REL)); } catch { return null; } })(); const m = manifestOf(root)?.files?.[POLICY_REL]; return p?.schema === 2 && p.patterns.length === 22 && m?.ownership === 'keys' && m.managed?.patterns?.length === 22; })(), { policy: getf(root, POLICY_REL)?.slice(0, 120), record: manifestOf(root)?.files?.[POLICY_REL] });
  // AC-A4-8: rendering after that commit.
  const rj = node(S('render-permissions'), ['json', '--project', root], root);
  const reads = rj.json?.claude?.readDeny ?? []; const excl = rj.json?.gitPathspecExcludes ?? [];
  const snippet = rj.json?.codexSnippet ?? '';
  check('AC-A4-8: render-permissions json holds exactly Read(/env/**) and Read(/cert/**) among the read denies (leading slash: root-anchored)', rj.code === 0 && reads.filter((x) => x === 'Read(/env/**)').length === 1 && reads.filter((x) => x === 'Read(/cert/**)').length === 1 && !reads.includes('Read(**/env/**)') && !reads.includes('Read(env/**)'), reads);
  check('AC-A4-8: the Git pathspec excludes hold :(exclude,glob,icase)env/** and :(exclude,glob,icase)cert/**, and the Codex snippet carries "env/**" and "cert/**"', excl.includes(':(exclude,glob,icase)env/**') && excl.includes(':(exclude,glob,icase)cert/**') && snippet.includes('"env/**"') && snippet.includes('"cert/**"'), { excl: excl.slice(-4), snippet: snippet.slice(0, 120) });
  check('AC-A4-8: isSecretPath("env/x") is true, isSecretPath("src/env/x") is false and the match is case-insensitive (ENV/x), with the real helper', isSecretPath('env/x') === true && isSecretPath('src/env/x') === false && isSecretPath('ENV/x') === true && isSecretPath('cert/x.txt') === true && isSecretPath('src/cert/x') === false, { env: isSecretPath('env/x'), nested: isSecretPath('src/env/x'), upper: isSecretPath('ENV/x') });

  // AC-A4-5/8 (the existing settings omission mechanism meeting the new root-anchored identities): an omission recorded for env/** suppresses exactly Read(/env/**) and nothing else in the managed denies.
  { const pol = { schema: 2, patterns: norm(DESIRED).patterns, projectPatterns: [] };
    const envE = pol.patterns.find((e) => e.glob === 'env/**'); const certE = pol.patterns.find((e) => e.glob === 'cert/**');
    const merge = (omissions) => attempt(() => mergeManagedDenies({ settings: {}, managed: null, policy: pol, omissions, dropOwnership: [], overrideUserExceptions: false }));
    const denies = (m) => (!threw(m) ? m.settings.permissions?.deny ?? [] : []);
    const all = merge({}); const noEnv = merge({ 'permissions.deny': [envE] }); const noCert = merge({ 'permissions.deny': [certE] });
    check('AC-A4-8: the managed settings denies hold Read(/env/**) and Read(/cert/**) when nothing is omitted', !threw(all) && denies(all).includes('Read(/env/**)') && denies(all).includes('Read(/cert/**)'), denies(all).slice(-4));
    check('AC-A4-5: an omission recorded for the root-anchored env/** removes exactly Read(/env/**) from the settings denies and keeps Read(/cert/**), and the other way round', !threw(noEnv) && !denies(noEnv).includes('Read(/env/**)') && !denies(noEnv).includes('Read(env/**)') && denies(noEnv).includes('Read(/cert/**)') && !threw(noCert) && !denies(noCert).includes('Read(/cert/**)') && denies(noCert).includes('Read(/env/**)'), { noEnv: denies(noEnv).slice(-3), noCert: denies(noCert).slice(-3) }); }
  // AC-A4-9 (D-3): protection is immediate. A tracked root env/x is a trackedSecretPath with the stop-and-escalate warning, before any decision and after an omit-for-both commit.
  const r9 = mk('a4d3', { 'env/x': 'KEY=value\n' });
  const before9 = node(S('detect'), [], r9);
  const stopRe = /stop and escalate/;
  check('AC-A4-9: on a 3.1.0-installed project with a tracked env/x, before any decision, detect lists env/x in secrets.trackedSecretPaths and emits the "stop and escalate" warning', before9.json?.secrets?.trackedSecretPaths?.includes('env/x') === true && (before9.json?.warnings ?? []).some((w) => stopRe.test(w)), { tracked: before9.json?.secrets?.trackedSecretPaths, warnings: before9.json?.warnings });
  { const id9 = `v320-a4o-${++seq}`;
    node(S('lock'), ['acquire', '--run-id', id9], r9); node(S('apply'), ['init', '--run-id', id9], r9);
    const rp = node(S('migrate-security-paths'), ['report', '--project', r9], r9).json?.report;
    if (rp) put(r9, `.ai/.run/${id9}/security-decisions.json`, J(decisionsFor(rp, [], rp.coverage.map((c) => ({ id: c.id, action: 'omit' })))));
    const st9 = node(S('migrate-security-paths'), ['stage', '--project', r9, '--run-id', id9], r9);
    let ap = [POLICY_REL]; let pr = null;
    for (let i = 0; i < 4; i++) { pr = node(S('apply'), ['prepare', '--run-id', id9, '--mode', 'update', '--approve-user-content', ap.join(',')], r9); if (pr.code === 0) break; const need = (pr.json?.errors ?? []).filter((e) => e.code === 'APPLY_APPROVAL_REQUIRED').map((e) => e.target).filter((t) => !ap.includes(t)); if (need.length === 0) break; ap = [...ap, ...need]; }
    const cm = pr?.json?.ok === true ? node(S('apply'), ['commit', '--run-id', id9, '--approved-plan', pr.json.planSha256], r9) : { code: null, json: null, out: '' };
    node(S('lock'), ['release', '--run-id', id9], r9);
    const after9 = node(S('detect'), [], r9);
    check('AC-A4-9: after a stage with omit for both and the commit, detect still lists env/x and still emits the warning (omit does not clear the stop)', st9.code === 0 && cm.json?.ok === true && after9.json?.secrets?.trackedSecretPaths?.includes('env/x') === true && (after9.json?.warnings ?? []).some((w) => stopRe.test(w)), { stage: st9.json ?? st9.out.slice(0, 200), commit: cm.json ?? pr?.json, tracked: after9.json?.secrets?.trackedSecretPaths }); }
  // AC-A4-10: a draft that removes env/** after it was included is refused with APPLY_POLICY_REGRESSION. The code is reached through scripts/apply.mjs checkPolicyRegression(), which for a
  // schema-2 draft runs only when no runtime tool unit is installed (otherwise needsMigrationWorkflow() refuses first with MIGRATION_REQUIRED). The plan names the code, so it is asserted on a
  // project that holds the included policy and no tool unit; what the project that the real migration produced (tool units present) answers is recorded separately, as an observation.
  { const incl = { schema: 2, patterns: norm(DESIRED).patterns, projectPatterns: [] };
    const regRoot = mk('a4reg', { [POLICY_REL]: J(incl), '.ai/manifest.json': J(MANIFEST(KEYS(incl.patterns))) });
    const dropped = { ...incl, patterns: incl.patterns.filter((e) => e.glob !== 'env/**') };
    check('AC-A4-10 (precondition): the project holds the included policy (22 managed patterns, env/** among them) and no runtime tool unit', incl.patterns.length === 22 && incl.patterns.some((e) => e.glob === 'env/**') && !fs.existsSync(path.join(regRoot, '.ai', 'tools')), { patterns: incl.patterns.length });
    const r = tx(regRoot, { drafts: { [POLICY_REL]: J(dropped) }, doCommit: false });
    check('AC-A4-10: a draft that removes env/** after it was included is refused with APPLY_POLICY_REGRESSION', r.prep.code !== 0 && JSON.stringify(r.prep.json).includes('APPLY_POLICY_REGRESSION'), r.prep.json ?? r.prep.out.slice(0, 300));
    const dropCert = tx(regRoot, { drafts: { [POLICY_REL]: J({ ...incl, patterns: incl.patterns.filter((e) => e.glob !== 'cert/**') }) }, doCommit: false });
    check('AC-A4-10: and likewise a draft that removes cert/** (each added identity is protected, not only env/**)', dropCert.prep.code !== 0 && JSON.stringify(dropCert.prep.json).includes('APPLY_POLICY_REGRESSION'), dropCert.prep.json ?? dropCert.prep.out.slice(0, 300));
    const keepsAll = tx(regRoot, { drafts: { [POLICY_REL]: J(incl) }, doCommit: false });
    check('AC-A4-10 (control): a draft that keeps every included entry is not a policy regression', keepsAll.prep.code === 0 && !JSON.stringify(keepsAll.prep.json).includes('APPLY_POLICY_REGRESSION'), keepsAll.prep.json);
    // Observation on the project the real migration produced (AC-A4-7): the same removal is refused too, with whichever refusal the existing order of checks reaches first.
    commitAll(root, 'migrated');
    const policyNow = (() => { try { return JSON.parse(getf(root, POLICY_REL)); } catch { return null; } })();
    if (policyNow === null) check('AC-A4-10 (observation): on the migrated project (tool units installed) the removal of env/** is refused', false, 'the migrated policy could not be read (see AC-A4-7)');
    else { const m = tx(root, { drafts: { [POLICY_REL]: J({ ...policyNow, patterns: policyNow.patterns.filter((e) => e.glob !== 'env/**') }) }, doCommit: false });
      const code = ['APPLY_POLICY_REGRESSION', 'MIGRATION_REQUIRED'].find((c) => JSON.stringify(m.prep.json).includes(c));
      check('AC-A4-10 (observation): on the migrated project (tool units installed) the removal of env/** is refused, by APPLY_POLICY_REGRESSION or by MIGRATION_REQUIRED (which the existing order of checks reaches first)', m.prep.code !== 0 && code !== undefined, { code, prepare: m.prep.json }); } }
}

// ======================================================================================================================== A5 ====
const BAK = '.project-setup.bak-3.0.0-1';
const detectIn = (iso, project) => { const r = node(S('detect'), [], project, iso.env); return { ...r, backups: r.json?.installerBackups, warnings: r.json?.warnings ?? [] }; };
const skillCopy = (dir, name, { skillMd = true, version = null } = {}) => { fs.mkdirSync(path.join(dir, name), { recursive: true }); if (skillMd) fs.writeFileSync(path.join(dir, name, 'SKILL.md'), '---\nname: project-setup\n---\n'); if (version !== null) fs.writeFileSync(path.join(dir, name, 'VERSION'), `${version}\n`); };
const warnOf = (r, tool) => r.warnings.filter((w) => w.startsWith(`${tool}: `) && /installer backup/.test(w));
{
  const proj = mkRepo('a5proj', baseFiles());
  const posix = (p) => p.replace(/\\/g, '/');
  // AC-A5-1: no leftover.
  { const iso = isolated('a5-1'); const r = detectIn(iso, proj);
    check('AC-A5-1: with no leftover, installerBackups is [] and no installer-backup warning exists', r.code === 0 && Array.isArray(r.backups) && r.backups.length === 0 && !r.warnings.some((w) => /installer backup/.test(w)), r.backups ?? 'installerBackups is missing from the detect output'); }
  // AC-A5-2: one backup with SKILL.md under the Claude skills dir.
  { const iso = isolated('a5-2'); skillCopy(iso.claudeSkills, BAK); const r = detectIn(iso, proj);
    const entry = r.backups?.[0];
    check('AC-A5-2: one .project-setup.bak-3.0.0-1 with SKILL.md under the Claude skills dir gives exactly one entry: tool claude, kind bak, the path of the directory', Array.isArray(r.backups) && r.backups.length === 1 && entry.tool === 'claude' && entry.kind === 'bak' && posix(entry.path) === posix(path.join(iso.claudeSkills, BAK)) && typeof entry.scope === 'string', r.backups ?? 'installerBackups is missing');
    check('AC-A5-2: and exactly one warning for claude and none for codex', warnOf(r, 'claude').length === 1 && warnOf(r, 'codex').length === 0, r.warnings);
    const want = `claude: 1 project-setup installer backup(s) with SKILL.md are inside the skills directory (${posix(path.join(iso.claudeSkills, BAK))}); the host can list each as another project-setup skill. Move them out of the skills directory, move them back before install.mjs rollback, and confirm one active copy in a new session`;
    check('AC-A5-2: the warning is the plan\'s sentence, word for word, with the count and the paths joined', warnOf(r, 'claude')[0] === want, { got: warnOf(r, 'claude')[0], want }); }
  // AC-A5-3: each non-leftover on its own, beside one real leftover so that "no entry" is not vacuous.
  for (const [label, make] of [
    ['a .project-setup.bak-* directory without SKILL.md', (iso) => skillCopy(iso.claudeSkills, '.project-setup.bak-nomd-1', { skillMd: false })],
    ['a .project-setup.bak-x.meta.json file', (iso) => fs.writeFileSync(path.join(iso.claudeSkills, '.project-setup.bak-x.meta.json'), '{}\n')],
    ['a .project-setup.tmp-* directory with SKILL.md', (iso) => skillCopy(iso.claudeSkills, '.project-setup.tmp-123-456')],
    ['a backup one level deeper', (iso) => skillCopy(path.join(iso.claudeSkills, 'nested'), '.project-setup.bak-deep-1')],
    ['a backup two levels deeper', (iso) => skillCopy(path.join(iso.claudeSkills, 'a', 'b'), '.project-setup.bak-deeper-1')],
    ['a backup in the Claude plugins directory (the plugins base is not scanned)', (iso) => skillCopy(path.join(iso.claude, 'plugins', 'x'), '.project-setup.bak-plug-1')],
    ['a backup named with another prefix (.project-setup-bak-1, .project-setup.backup-1, project-setup.bak-1)', (iso) => { for (const n of ['.project-setup-bak-1', '.project-setup.backup-1', 'project-setup.bak-1', '.other.bak-1']) skillCopy(iso.claudeSkills, n); }],
    ['a name that only contains the pattern after another prefix (x.project-setup.bak-1, old.project-setup.rolledback-1: the pattern is anchored at the start of the name)', (iso) => { for (const n of ['x.project-setup.bak-1', 'old.project-setup.rolledback-1']) skillCopy(iso.claudeSkills, n); }],
    ['a name with another word after the dot (.project-setup.old-1, .project-setup.keep-1: only bak and rolledback count)', (iso) => { for (const n of ['.project-setup.old-1', '.project-setup.keep-1']) skillCopy(iso.claudeSkills, n); }],
    ['a name without the dash after bak or rolledback (.project-setup.bak, .project-setup.bak1, .project-setup.rolledbackx-1)', (iso) => { for (const n of ['.project-setup.bak', '.project-setup.bak1', '.project-setup.rolledbackx-1']) skillCopy(iso.claudeSkills, n); }],
    ['a plain project-setup directory (an install, not a leftover)', (iso) => skillCopy(iso.claudeSkills, 'project-setup', { version: '3.1.0' })],
  ]) {
    const iso = isolated('a5-3'); skillCopy(iso.claudeSkills, BAK); make(iso);
    const r = detectIn(iso, proj);
    check(`AC-A5-3: ${label} produces no entry (the one real leftover is the only one)`, Array.isArray(r.backups) && r.backups.length === 1 && r.backups[0].kind === 'bak' && posix(r.backups[0].path).endsWith(`/${BAK}`), r.backups ?? 'installerBackups is missing');
  }
  { const iso = isolated('a5-3l'); skillCopy(iso.claudeSkills, BAK); const target = path.join(iso.base, 'elsewhere'); skillCopy(target, '.project-setup.bak-linked-1');
    let linked = false; try { fs.symlinkSync(path.join(target, '.project-setup.bak-linked-1'), path.join(iso.claudeSkills, '.project-setup.bak-link-9'), 'junction'); linked = true; } catch { linked = false; }
    if (!linked) skip('AC-A5-3: a symlinked or junctioned backup produces no entry', 'a junction cannot be created on this host');
    else { const r = detectIn(iso, proj); check('AC-A5-3: a symlinked or junctioned backup produces no entry (links are skipped, not followed)', Array.isArray(r.backups) && r.backups.length === 1 && posix(r.backups[0].path).endsWith(`/${BAK}`), r.backups ?? 'installerBackups is missing'); } }
  // AC-A5-4: rolledback.
  { const iso = isolated('a5-4'); skillCopy(iso.claudeSkills, '.project-setup.rolledback-1700000000000'); const r = detectIn(iso, proj);
    check('AC-A5-4: a .project-setup.rolledback-* directory with SKILL.md is reported with kind rolledback', Array.isArray(r.backups) && r.backups.length === 1 && r.backups[0].kind === 'rolledback' && r.backups[0].tool === 'claude', r.backups ?? 'installerBackups is missing'); }
  // The repository-scoped bases: <root>/.claude/skills (claude) and <root>/.agents/skills (codex) are scanned too, each alone in its own project.
  for (const [label, rel, tool, name, kind] of [
    ['<root>/.claude/skills', ['.claude', 'skills'], 'claude', BAK, 'bak'],
    ['<root>/.agents/skills', ['.agents', 'skills'], 'codex', '.project-setup.rolledback-7', 'rolledback'],
  ]) {
    const iso = isolated('a5-repo'); const rp = mkRepo('a5repo', baseFiles()); skillCopy(path.join(rp, ...rel), name);
    const r = detectIn(iso, rp);
    check(`AC-A5-2/4: a backup under ${label} of the project is reported once, with tool ${tool}, kind ${kind} and its own path, and the other tool has no entry or warning`, Array.isArray(r.backups) && r.backups.length === 1 && r.backups[0].tool === tool && r.backups[0].kind === kind && posix(r.backups[0].path) === posix(path.join(rp, ...rel, name)) && typeof r.backups[0].scope === 'string' && warnOf(r, tool).length === 1 && warnOf(r, tool === 'claude' ? 'codex' : 'claude').length === 0, { backups: r.backups, warnings: r.warnings });
  }
  // Codex bases, sorting, dedupe, the warning per tool, and the readable-but-not-a-directory boundary.
  { const iso = isolated('a5-codex'); skillCopy(iso.agentsSkills, '.project-setup.bak-3.0.0-2'); skillCopy(iso.agentsSkills, '.project-setup.bak-3.0.0-1'); skillCopy(path.join(iso.codex, 'skills'), '.project-setup.rolledback-5'); skillCopy(iso.claudeSkills, BAK);
    const r = detectIn(iso, proj);
    const byTool = (t) => (r.backups ?? []).filter((e) => e.tool === t);
    check('AC-A5-2/4: the Codex bases (~/.agents/skills and CODEX_HOME/skills) are scanned: three codex entries and one claude entry, each with its tool', Array.isArray(r.backups) && byTool('codex').length === 3 && byTool('claude').length === 1, r.backups ?? 'installerBackups is missing');
    check('the entries are sorted by path', Array.isArray(r.backups) && JSON.stringify(r.backups.map((e) => e.path)) === JSON.stringify([...r.backups.map((e) => e.path)].sort()), r.backups?.map((e) => e.path));
    check('one warning per tool that has any: one for claude naming 1 backup, one for codex naming 3, paths joined by "; "', warnOf(r, 'claude').length === 1 && warnOf(r, 'codex').length === 1 && /^codex: 3 project-setup installer backup\(s\)/.test(warnOf(r, 'codex')[0] ?? '') && (warnOf(r, 'codex')[0] ?? '').split('; ').length >= 3, r.warnings);
    check('the entry has exactly the keys tool, scope, path and kind', Array.isArray(r.backups) && r.backups.length > 0 && r.backups.every((e) => JSON.stringify(Object.keys(e).sort()) === JSON.stringify(['kind', 'path', 'scope', 'tool'])), r.backups?.[0]); }
  { const iso = isolated('a5-same', { codexIsAgents: true }); skillCopy(iso.agentsSkills, BAK); const r = detectIn(iso, proj);
    check('CODEX_HOME equal to ~/.agents: the same directory reached twice is one entry (deduplicated by canonical path per tool)', Array.isArray(r.backups) && r.backups.filter((e) => e.tool === 'codex').length === 1, r.backups ?? 'installerBackups is missing'); }
  { const iso = isolated('a5-unreadable'); fs.mkdirSync(path.dirname(iso.claudeSkills), { recursive: true }); fs.writeFileSync(iso.claudeSkills, 'not a directory'); const r = detectIn(iso, proj);
    check('an unreadable skills directory (here a file) gives no entry and no throw: detect exits 0', r.code === 0 && Array.isArray(r.backups) && r.backups.length === 0, { code: r.code, backups: r.backups, err: r.err.slice(0, 200) }); }
  // AC-A5-5: installs and installConflicts do not change with the leftovers (host identity and disabled state cannot be known from the filesystem).
  { const iso = isolated('a5-5'); skillCopy(iso.claudeSkills, 'project-setup', { version: '3.1.0' }); skillCopy(iso.agentsSkills, 'project-setup', { version: '3.1.0' });
    const without = detectIn(iso, proj);
    skillCopy(iso.claudeSkills, BAK); skillCopy(iso.claudeSkills, '.project-setup.rolledback-9'); skillCopy(iso.agentsSkills, BAK);
    const withL = detectIn(iso, proj);
    check('AC-A5-5: installs and installConflicts are deep-equal with and without the leftovers (and installs is not empty, so the comparison is not vacuous)', without.json !== null && withL.json !== null && withL.json.installs.length === 2 && JSON.stringify(without.json.installs) === JSON.stringify(withL.json.installs) && JSON.stringify(without.json.installConflicts) === JSON.stringify(withL.json.installConflicts) && Array.isArray(withL.backups) && withL.backups.length === 3, { installs: [without.json?.installs?.length, withL.json?.installs?.length], backups: withL.backups }); }
}

// A5 with the real install.mjs: the documented manual move is safe (AC-A5-6) and detect reports exactly the backup install made (AC-A5-7).
const PAYLOAD = ['SKILL.md', 'VERSION', 'CHANGELOG.md', 'references', 'assets', 'data', 'scripts'];
const copyPayload = (from, to, version = null) => { for (const e of [...PAYLOAD, 'install']) { const src = path.join(from, e); if (fs.existsSync(src)) fs.cpSync(src, path.join(to, e), { recursive: true }); } if (version !== null) fs.writeFileSync(path.join(to, 'VERSION'), `${version}\n`); return to; };
const installerOf = (srcRoot) => path.join(srcRoot, 'install', 'install.mjs');
const flagsOf = (iso) => ['--targets', 'claude,codex', '--claude-dir', iso.claudeSkills, '--codex-dir', iso.agentsSkills];
const leftovers = (dir) => { try { return fs.readdirSync(dir).filter((n) => n.startsWith('.project-setup.')).sort(); } catch { return []; } };
{
  const iso = isolated('a5-6');
  const srcA = copyPayload(SKILL, scratch('a5-6-src'), '3.0.9-a');
  const i1 = node(installerOf(srcA), flagsOf(iso), iso.base, iso.env);
  const i2 = node(installerOf(SKILL), flagsOf(iso), iso.base, iso.env);
  const dirs = [['claude', iso.claudeSkills], ['codex', iso.agentsSkills]];
  const bak = Object.fromEntries(dirs.map(([t, d]) => [t, leftovers(d).filter((n) => /^\.project-setup\.bak-3\.0\.9-a-\d+$/.test(n))]));
  check('AC-A5-6: install 1 (a scratch source) and install 2 (the real tree) succeed, and install 2 creates exactly one backup with its .meta.json in each skills directory', i1.code === 0 && i2.code === 0 && dirs.every(([t, d]) => bak[t].length === 1 && fs.existsSync(path.join(d, `${bak[t][0]}.meta.json`))), { i1: i1.json?.ok, i2: i2.json ?? i2.out.slice(0, 300), bak });
  if (dirs.every(([t]) => bak[t].length === 1)) {
    const out = path.join(iso.base, 'moved');
    for (const [t, d] of dirs) { fs.mkdirSync(path.join(out, t), { recursive: true }); fs.renameSync(path.join(d, bak[t][0]), path.join(out, t, bak[t][0])); fs.renameSync(path.join(d, `${bak[t][0]}.meta.json`), path.join(out, t, `${bak[t][0]}.meta.json`)); }
    const noneLeft = dirs.every(([, d]) => leftovers(d).length === 0);
    const dMoved = detectIn(iso, mkRepo('a5-6p', baseFiles()));
    check('AC-A5-6: after the move, the skills directories hold no leftover and detect reports an empty installerBackups', noneLeft && Array.isArray(dMoved.backups) && dMoved.backups.length === 0, dMoved.backups ?? 'installerBackups is missing');
    const rb1 = node(installerOf(srcA), ['rollback', ...flagsOf(iso)], iso.base, iso.env);
    check('AC-A5-6: with the backups moved out, rollback exits 6 ("no backup to restore"), changing nothing', rb1.code === 6 && /no backup to restore/.test(rb1.out), { code: rb1.code, out: rb1.out.slice(0, 200) });
    for (const [t, d] of dirs) { fs.renameSync(path.join(out, t, bak[t][0]), path.join(d, bak[t][0])); fs.renameSync(path.join(out, t, `${bak[t][0]}.meta.json`), path.join(d, `${bak[t][0]}.meta.json`)); }
    const rb2 = node(installerOf(srcA), ['rollback', ...flagsOf(iso)], iso.base, iso.env);
    const ver = node(installerOf(srcA), ['verify', ...flagsOf(iso)], iso.base, iso.env);
    check('AC-A5-6: with both moved back, rollback exits 0 (the recorded digest still verifies) and verify reports the restored version (3.0.9-a, current)', rb2.code === 0 && rb2.json?.ok === true && ver.code === 0 && ver.json?.report?.length === 2 && ver.json.report.every((x) => x.state === 'current' && x.version === '3.0.9-a'), { rollback: rb2.json ?? rb2.out.slice(0, 300), verify: ver.json ?? ver.out.slice(0, 300) });
  } else check('AC-A5-6: the move out and back', false, 'no backup was created, see the previous line');
}
{
  // AC-A5-7 (D-11 condition 1): a 3.1.0 source (a scratch copy of the tree reversed with to310Repo), then the candidate from the real tree, both with the real install.mjs.
  const view = attempt(() => { const out = scratch('a5-7-view'); fs.rmSync(out, { recursive: true, force: true }); buildView({ repoRoot: REPO, outDir: out, includeUntracked: true }); to310Repo(out); return out; });
  if (threw(view)) check('AC-A5-7: install a 3.1.0 source (the real tree reversed with to310Repo), then the candidate, then detect reports exactly the backup install created for each target', false, /PIN_PENDING/.test(view.threw) ? `${PIN_PENDING}: ${view.threw}` : view.threw);
  else {
    const iso = isolated('a5-7');
    const src310 = path.join(view, 'project-setup');
    const i1 = node(installerOf(src310), flagsOf(iso), iso.base, iso.env);
    const i2 = node(installerOf(SKILL), flagsOf(iso), iso.base, iso.env);
    const r = detectIn(iso, mkRepo('a5-7p', baseFiles()));
    const mine = (t, d) => (r.backups ?? []).filter((e) => e.tool === t && e.path.replace(/\\/g, '/').startsWith(d.replace(/\\/g, '/')));
    const expected = { claude: leftovers(iso.claudeSkills).filter((n) => /^\.project-setup\.bak-3\.1\.0-\d+$/.test(n)), codex: leftovers(iso.agentsSkills).filter((n) => /^\.project-setup\.bak-3\.1\.0-\d+$/.test(n)) };
    check('AC-A5-7: detect reports exactly the backup that install created (kind bak, version token 3.1.0 in the name) for each target', i1.code === 0 && i2.code === 0 && expected.claude.length === 1 && expected.codex.length === 1 && (r.backups ?? []).length === 2 && mine('claude', iso.claudeSkills).length === 1 && mine('codex', iso.agentsSkills).length === 1 && (r.backups ?? []).every((e) => e.kind === 'bak' && /\.project-setup\.bak-3\.1\.0-\d+$/.test(e.path.replace(/\\/g, '/'))), { i1: i1.code, i2: i2.code, backups: r.backups, expected });
  }
}

// ======================================================================================================================== B1 ====
{
  const rv = lf(REVIEWER);
  const sec2 = (t) => { const a = t.indexOf('## 2. What counts as a finding'); const b = t.indexOf('\n## 3.', a + 1); return a < 0 ? null : { a, b: b < 0 ? t.length : b }; };
  const KEYWORD = /\b(?:MUST|SHOULD|MAY)\b/;
  /** The ids of the reviewer contract checks a reviewer text does not meet ([] = all met): both paragraphs once at their anchors, and the sentences the mutants of AC-B1-7 name. */
  const problems = (t0) => {
    const t = lf(t0); const bad = []; const s2 = sec2(t);
    if (count(t, RV320_1) !== 1) bad.push('rv1-once');
    const at1 = t.indexOf(RV320_1);
    if (!(s2 !== null && at1 > s2.a && at1 + RV320_1.length < s2.b)) bad.push('rv1-in-section-2');
    if (!(at1 > t.indexOf('A finding must be reachable **in the code as it is now**') && at1 < t.indexOf('Plan coverage is not a correctness boundary.'))) bad.push('rv1-before-plan-coverage');
    if (count(t, RV320_2) !== 1) bad.push('rv2-once');
    const verdict = t.indexOf('4. Verdict: **block**'); const at2 = t.indexOf(RV320_2);
    if (!(verdict >= 0 && at2 > verdict && !t.slice(verdict, at2).replace(/^.*\n/, '').includes('\n\n') && t.slice(at2 + RV320_2.length).trim() === '')) bad.push('rv2-after-verdict');
    if (!t.includes('You MUST rate\nit HIGH or CRITICAL.')) bad.push('rate-high-or-critical');
    if (!t.includes('A project rule MUST NOT relax this paragraph; on\nconflict follow this paragraph and report the conflict.')) bad.push('project-rule-no-relax');
    if (!t.includes('critical rule in AGENTS.md, whatever its wording,')) bad.push('whatever-its-wording');
    if (!t.includes('A missing caller, route or funding path MUST NOT lower that severity')) bad.push('missing-caller-not-lower');
    if (/\{\{/.test(rendered(t))) bad.push('placeholder-left');
    return bad;
  };
  const rev310 = to310.reviewer(REVIEWER);
  check('AC-B1-1 (reconstruction): removing the two paragraphs reproduces the 3.1.0 reviewer byte for byte (digest 696f86bc...), so nothing else changed', sha(rev310) === SHA310.reviewer, sha(rev310));
  const rev320 = (() => { const base = rev310; const at = base.indexOf('\n\nPlan coverage is not a correctness boundary.'); return `${base.slice(0, at)}\n\n${RV320_1}${base.slice(at)}${RV320_2}\n`; })(); // a 3.2.0 reviewer built from the plan texts, independent of the shipped file
  check('AC-B1 (reference): the reviewer built from the 3.1.0 bytes and the plan texts meets every contract check, so each mutant below can fail only on its own change', JSON.stringify(problems(rev320)) === '[]', problems(rev320));
  const real = problems(REVIEWER);
  for (const id of ['rv1-once', 'rv1-in-section-2', 'rv1-before-plan-coverage', 'rv2-once', 'rv2-after-verdict', 'rate-high-or-critical', 'project-rule-no-relax', 'whatever-its-wording', 'missing-caller-not-lower']) check(`AC-B1-1: assets/agents/reviewer.md: ${id} is met`, !real.includes(id), real);
  check('AC-B1-2: the rendered reviewer (the {{PROJECT_NAME}} placeholder filled) contains no {{', !/\{\{/.test(rendered(REVIEWER)) && !real.includes('placeholder-left'), 'a placeholder is left');
  check('AC-B1-1: every 3.1.0 line holding MUST, SHOULD or MAY is still present (the file is otherwise the 3.1.0 bytes)', rev310.split('\n').filter((l) => KEYWORD.test(l)).every((l) => rv.includes(l)), rev310.split('\n').filter((l) => KEYWORD.test(l) && !rv.includes(l)).slice(0, 3));
  // AC-B1-7 (5.2 item 7): each mutant fails a named assertion.
  for (const [label, id, fn] of [
    ['the paragraph placed in section 4 (after "### Project rules")', 'rv1-in-section-2', (t) => t.replace(`${RV320_1}\n\n`, '').replace('### Project rules\n', `### Project rules\n\n${RV320_1}\n\n`)],
    ['the paragraph placed after the Plan coverage paragraph', 'rv1-before-plan-coverage', (t) => t.replace(`${RV320_1}\n\n`, '').replace('Plan coverage is not a correctness boundary.', 'Plan coverage is not a correctness boundary.').replace('\nFix the class, not the instance:', `\n${RV320_1}\n\nFix the class, not the instance:`)],
    ['"MUST rate it HIGH or CRITICAL" weakened to "should rate it"', 'rate-high-or-critical', (t) => t.replace('You MUST rate\nit HIGH or CRITICAL.', 'You should rate\nit HIGH or CRITICAL.')],
    ['"MUST rate it HIGH or CRITICAL" weakened to "MAY"', 'rate-high-or-critical', (t) => t.replace('You MUST rate\nit HIGH or CRITICAL.', 'You MAY rate\nit HIGH or CRITICAL.')],
    ['the "A project rule MUST NOT relax this paragraph" sentence removed', 'project-rule-no-relax', (t) => t.replace(' A project rule MUST NOT relax this paragraph; on\nconflict follow this paragraph and report the conflict.', '')],
    ['"MUST NOT relax" weakened to "should not relax"', 'project-rule-no-relax', (t) => t.replace('A project rule MUST NOT relax this paragraph', 'A project rule should not relax this paragraph')],
    ['[RV320_2] (the verdict sentence) removed (advisor Q7)', 'rv2-once', (t) => t.replace(`${RV320_2}\n`, '')],
    ['[RV320_2] placed before the Verdict line', 'rv2-after-verdict', (t) => t.replace(`${RV320_2}\n`, '').replace('4. Verdict: **block**', `${RV320_2}\n4. Verdict: **block**`)],
    ['"whatever its wording" removed', 'whatever-its-wording', (t) => t.replace('critical rule in AGENTS.md, whatever its wording,', 'critical rule in AGENTS.md,')],
    ['"A missing caller, route or funding path MUST NOT lower that severity" weakened', 'missing-caller-not-lower', (t) => t.replace('MUST NOT lower that severity', 'may lower that severity')],
    ['the paragraph written twice', 'rv1-once', (t) => t.replace(RV320_1, `${RV320_1}\n\n${RV320_1}`)],
    ['a placeholder left in the file ({{PROJECT_ROOT}} is not filled by the render)', 'placeholder-left', (t) => `${t}\n{{PROJECT_ROOT}}\n`],
  ]) { const m = fn(rev320); check(`AC-B1-7 mutant: ${label} fails ${id}`, m !== rev320 && problems(m).includes(id), m === rev320 ? 'the mutation did not apply' : problems(m)); }

  // AC-B1-3, 4, 5: the update of a project that holds the 3.1.0 reviewer, through the real apply.mjs and validate.mjs.
  const RV = '.ai/agents/reviewer.md'; const EXT = '.ai/agents/reviewer.project.md';
  const mkProject = (label) => { const root = mkRepo(label, baseFiles({ [EXT]: '# Project review rules\n\nKeep wallet reviews strict.\n' })); const inst = tx(root, { mode: 'fresh', drafts: { [RV]: rendered(rev310) } }); commitAll(root); return { root, inst }; };
  { const { root, inst } = mkProject('b1-3');
    const m0 = manifestOf(root);
    check('AC-B1-3: precondition: the rendered 3.1.0 reviewer is installed with its manifest hash', committed(inst) && m0?.files?.[RV]?.ownership === 'full' && m0.files[RV].sha256 === normalizedHash(rendered(rev310)), inst.prep.json);
    const ext0 = getf(root, EXT);
    const upd = tx(root, { drafts: { [RV]: rendered(REVIEWER) } });
    const m1 = manifestOf(root);
    check('AC-B1-3: drafting the 3.2.0 reviewer: prepare exits 0 without --approve-user-content, commit succeeds, and the manifest hash is the normalized hash of the new bytes', upd.prep.code === 0 && committed(upd) && getf(root, RV) === rendered(REVIEWER) && m1?.files?.[RV]?.sha256 === normalizedHash(rendered(REVIEWER)), upd.prep.json);
    check('AC-B1-3: the manifest records skillVersion 3.2.0', m1?.skillVersion === '3.2.0', m1?.skillVersion);
    commitAll(root, 'updated');
    check('AC-B1-3: validate has no drift row, and reviewer.project.md is byte-unchanged', validateRows(root).filter((r) => r.check === 'drift').length === 0 && getf(root, EXT) === ext0, validateRows(root).filter((r) => r.check === 'drift'));
    check('AC-B1-3: the reviewer actually changed (the 3.2.0 paragraphs reached the project), so the update above was not a no-op', getf(root, RV) !== rendered(rev310) && getf(root, RV).includes('Money and state integrity are the exception.'), 'the shipped reviewer does not carry [RV320_1] yet'); }
  { const { root } = mkProject('b1-4'); const edited = `${rendered(rev310)}\nTeam addition: wallet findings go to #wallet-review.\n`; put(root, RV, edited); commitAll(root, 'user edit');
    const refused = tx(root, { drafts: { [RV]: rendered(REVIEWER) }, doCommit: false });
    check('AC-B1-4: with one user-added line in the installed reviewer, prepare exits 3 and APPROVAL_REQUIRED names exactly .ai/agents/reviewer.md', refused.prep.code === 3 && JSON.stringify(approvalTargets(refused)) === JSON.stringify([RV]), refused.prep.json);
    const ok = tx(root, { drafts: { [RV]: rendered(REVIEWER) }, approve: [RV] });
    check('AC-B1-4: with the approval it commits and the installed reviewer is the draft', committed(ok) && getf(root, RV) === rendered(REVIEWER), ok.prep.json); }
  { const { root } = mkProject('b1-5');
    const reviewerBefore = getf(root, RV); const recordBefore = JSON.stringify(manifestOf(root)?.files?.[RV]);
    const a = tx(root, { drafts: { 'TODO.md': '# TODO\n' } }); commitAll(root, 'todo');
    check('AC-B1-5: with no reviewer draft (declined) the commit of the rest leaves the reviewer bytes and its manifest record unchanged', committed(a) && getf(root, RV) === reviewerBefore && JSON.stringify(manifestOf(root)?.files?.[RV]) === recordBefore && recordBefore !== undefined, a.prep.json);
    const t1 = treeHashes(root); const mBefore = getf(root, '.ai/manifest.json');
    const b = tx(root, { drafts: { 'TODO.md': '# TODO\n' } });
    check('AC-B1-5: a second identical run produces zero diff, the manifest included', b.prep.code === 0 && b.prep.json?.changed === 0 && JSON.stringify(treeHashes(root)) === JSON.stringify(t1) && getf(root, '.ai/manifest.json') === mBefore, { prepare: b.prep.json }); }
}

// ======================================================================================================================== B2 ====
{
  const claude = lf(TPL_CLAUDE); const agents = lf(TPL_AGENTS);
  const BULLET_ANCHOR = '  This prevents false launch refusals without treating unknown host state as verified.\n';
  /** The ids of the B2 contract checks a pair of templates does not meet ([] = all met). */
  const problems = (claudeText, agentsText) => {
    const bad = []; const pc = parseBlocks(lf(claudeText)); const blk = pc.blocks.find((b) => b.id === 'claude'); const inner = blk === undefined ? '' : lf(blk.inner);
    if (count(inner, CT320_1) !== 1) bad.push('bullet-in-claude-block');
    if (count(lf(claudeText), CT320_1) !== 1) bad.push('bullet-once');
    if (!inner.includes(`${BULLET_ANCHOR}${CT320_1}\n`)) bad.push('bullet-after-line-26');
    if (!inner.includes('the refusal above applies unchanged')) bad.push('refusal-applies-unchanged');
    if (!inner.includes('you MUST state in your output that it was not given')) bad.push('must-state-in-output');
    if (!inner.includes('As a delegated agent you MUST treat the\n  original start directory as unknown unless the brief states it.')) bad.push('must-treat-unknown');
    if (pc.errors.length > 0 || pc.blocks.filter((b) => b.id === 'claude').length !== 1) bad.push('claude-markers');
    if (lf(claudeText).split('\n').length > 200) bad.push('claude-size');
    const pa = parseBlocks(lf(agentsText)); const ab = pa.blocks.find((b) => b.id === 'agents'); const ai = ab === undefined ? '' : lf(ab.inner);
    if (count(ai, AT320_2) !== 1) bad.push('agents-sentence-in-block');
    if (!ai.includes('state in every brief the session\'s\noriginal start directory, the repository root and the current directory.')) bad.push('agents-sentence-three-directories');
    if (!ai.includes('Do not invent\na start directory you were not given; say that it is unknown instead.')) bad.push('agents-sentence-unknown');
    if (pa.errors.length > 0) bad.push('agents-markers');
    return bad;
  };
  const claude320 = (() => { const base = to310.claude(TPL_CLAUDE); return base.replace(BULLET_ANCHOR, `${BULLET_ANCHOR}${CT320_1}\n`); })();
  const agents320 = (() => { const base = to310.agents(TPL_AGENTS); return base.replace('Codex). Do not create an ad-hoc agent for the same job.\n', `Codex). Do not create an ad-hoc agent for the same job.\n\n${AT320_2}\n\n${AT320_1}\n`); })();
  check('AC-B2 (reconstruction): the 3.1.0 claude template (the shipped one without [CT320_1]) is the 3.1.0 bytes (digest 5bb1d5ed...)', sha(to310.claude(TPL_CLAUDE)) === SHA310.claude, sha(to310.claude(TPL_CLAUDE)));
  check('AC-B2 (reference): the templates built from the 3.1.0 bytes and the plan texts meet every contract check, so each mutant below can fail only on its own change', JSON.stringify(problems(claude320, agents320)) === '[]' && claude320 !== to310.claude(TPL_CLAUDE), problems(claude320, agents320));
  const real = problems(TPL_CLAUDE, TPL_AGENTS);
  for (const id of ['bullet-in-claude-block', 'bullet-once', 'bullet-after-line-26', 'refusal-applies-unchanged', 'must-state-in-output', 'must-treat-unknown', 'claude-markers', 'claude-size', 'agents-sentence-in-block', 'agents-sentence-three-directories', 'agents-sentence-unknown', 'agents-markers']) check(`AC-B2-1/4: the shipped templates: ${id} is met`, !real.includes(id), real);
  // AC-B2-4 (5.2 item 8): the four mutants named by the plan, and the placement and wording around them.
  for (const [label, id, fn] of [
    ['the bullet placed outside the managed claude block (after the end marker)', 'bullet-in-claude-block', (c) => c.replace(`${CT320_1}\n`, '').replace('<!-- project-setup:end id=claude -->', `<!-- project-setup:end id=claude -->\n${CT320_1}`)],
    ['the bullet placed before the "MUST NOT infer" bullet', 'bullet-after-line-26', (c) => c.replace(`${CT320_1}\n`, '').replace('- You MUST NOT infer a subdirectory start', `${CT320_1}\n- You MUST NOT infer a subdirectory start`)],
    ['the sentence "the refusal above applies unchanged" removed', 'refusal-applies-unchanged', (c) => c.replace('\n  directory, the refusal above applies unchanged. The parent session stays bound by', '\n  directory, the parent session stays bound by')],
    ['"MUST state in your output" removed', 'must-state-in-output', (c) => c.replace('you MUST state in your output that it was not given', 'you say that it was not given')],
    ['"MUST state" weakened to "may state"', 'must-state-in-output', (c) => c.replace('you MUST state in your output', 'you may state in your output')],
    ['"MUST treat the original start directory as unknown" weakened', 'must-treat-unknown', (c) => c.replace('you MUST treat the\n  original start directory as unknown', 'you may treat the\n  original start directory as unknown')],
    ['the bullet written twice', 'bullet-once', (c) => c.replace(`${CT320_1}\n`, `${CT320_1}\n${CT320_1}\n`)],
  ]) { const m = fn(claude320); check(`AC-B2-4 mutant: ${label} fails ${id}`, m !== claude320 && problems(m, agents320).includes(id), m === claude320 ? 'the mutation did not apply' : problems(m, agents320)); }
  for (const [label, id, fn] of [
    ['the AGENTS.md sentence limited to "after changing directory"', 'agents-sentence-three-directories', (a) => a.replace('state in every brief the session\'s\noriginal start directory, the repository root and the current directory.', 'state in every brief the current directory after changing directory.')],
    ['the AGENTS.md sentence placed outside the agents block', 'agents-sentence-in-block', (a) => `${a.replace(`\n${AT320_2}\n`, '')}\n${AT320_2}\n`],
    ['the "say that it is unknown instead" clause removed', 'agents-sentence-unknown', (a) => a.replace('Do not invent\na start directory you were not given; say that it is unknown instead.', 'Do not invent\na start directory you were not given.')],
  ]) { const m = fn(agents320); check(`AC-B2-4 mutant: ${label} fails ${id}`, m !== agents320 && problems(claude320, m).includes(id), m === agents320 ? 'the mutation did not apply' : problems(claude320, m)); }

  // AC-B2-3 (real apply.mjs): a project with the 3.1.0 claude block and its recorded block hash takes the new block with no user-content approval; user text and the import are byte-identical.
  const USER = 'Team note: run npm run lint before pushing.';
  const installed310 = `${to310.claude(TPL_CLAUDE)}\n${USER}\n`;
  const next320 = `${lf(TPL_CLAUDE)}\n${USER}\n`;
  const root = mkRepo('b2-3', baseFiles());
  const first = tx(root, { mode: 'fresh', drafts: { 'CLAUDE.md': installed310 } }); commitAll(root);
  const rec0 = manifestOf(root)?.files?.['CLAUDE.md'];
  check('AC-B2-3: precondition: the 3.1.0 claude block is installed by the real apply with a recorded block hash (blocks ownership)', committed(first) && rec0?.ownership === 'blocks' && typeof rec0.blocks === 'object', { prepare: first.prep.json, record: rec0 });
  const upd = tx(root, { drafts: { 'CLAUDE.md': next320 } });
  const after = getf(root, 'CLAUDE.md') ?? '';
  check('AC-B2-3: the 3.2.0 claude block is taken with no --approve-user-content (prepare exits 0, commit succeeds)', upd.prep.code === 0 && committed(upd), upd.prep.json);
  check('AC-B2-3: the user text and the @AGENTS.md import are byte-identical afterwards, and the block is the 3.2.0 one (the delegated-agent bullet reached the project)', after.startsWith('@AGENTS.md\n') && after.includes(`${USER}\n`) && after.split('\n').filter((l) => l === '@AGENTS.md').length === 1 && after.slice(after.indexOf(USER)) === `${USER}\n` && after.includes('For a delegated agent this bullet replaces the directory comparison above.'), after.slice(0, 200));
  commitAll(root, 'claude updated');
  check('AC-B2-3: validate has no drift row after the update (the recorded block hash is the new one)', validateRows(root).filter((r) => r.check === 'drift').length === 0, validateRows(root).filter((r) => r.check === 'drift'));
}

// --------------------------------------------------------------------------------------------------------------------------------- report ----
const SKIPPED = results.filter((r) => r.skip === true).length;
let failed = 0;
for (const r of results) {
  if (r.skip === true) { console.log(`SKIP  ${r.name} (${r.detail})`); continue; }
  if (r.ok) { console.log(`PASS  ${r.name}`); continue; }
  failed += 1;
  console.log(`FAIL  ${r.name}`);
  if (r.detail !== undefined) { const d = typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail); console.log(`      - ${d.length > 600 ? `${d.slice(0, 600)}...` : d}`); }
}
console.log(`${results.length - failed - SKIPPED} PASS / ${failed} FAIL / ${SKIPPED} SKIP`);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* the scratch directory is under the OS temp directory */ }
process.exit(failed === 0 ? 0 : 1);
