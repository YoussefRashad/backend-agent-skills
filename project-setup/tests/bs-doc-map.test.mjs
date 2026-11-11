#!/usr/bin/env node
// 3.1.0 backend-standards documentation-mapping contract. Standalone, like c18.test.mjs: `node tests/bs-doc-map.test.mjs` prints PASS, FAIL and SKIP
// lines, a totals line, and exits 0 only when every assertion passes. It is not a registered component and no runner executes it
// (plan docs/plans/2026-11-11-project-setup-v3.1-bs-doc-map.md section 8, "Standalone mapping spec"; section 12 amends the plan and wins).
//
// What it proves, and only this:
//  - the drafting instructions (references/docs-generation.md, modes.md, report.md, SKILL.md) state the plan's clauses with their strength.
//    That is a check of the instructions, never of what an agent does with them;
//  - the test-only checker (tests/live/bs-doc-map.mjs, shared with the live helper) detects every violation of the pointer format, paths,
//    headings, ownership, routing, recovery and consolidation it is built to detect, each proved by a negative control. These are checker
//    controls, not backend-standards live evidence. Fixture assertions do not prove an agent discovered every fact;
//  - the EXISTING apply transaction (lock, prepare, commit, drift, rollback, ownership, zero diff) behaves as the plan relies on when it carries
//    pointer paths: no production script changes in 3.1.
// Host routing (does a Claude or Codex agent follow a pointer) and real BS behavior are measured live and are not asserted here.
//
// ----------------------------------------------------------------------------------------------------------------------------------
// INTERFACE the implementation must satisfy (the implement lane reads this; nothing here is guessed)
// 1. references/docs-generation.md gains ONE mapping section between the existing "## `TODO.md` ..." content and "## Ownership hints"
//    (C9: "### Environment template" stays the final heading). It carries, extractable at run time by the helper:
//    - the pointer skeleton: the one fenced block that holds `<!-- project-setup:documentation-pointer v=1 -->` and the placeholders
//      {{TITLE}}, {{RELATIVE_PATH_TO_03}}, {{SECTION_BULLETS}}, {{TOPIC_OR_VENDOR}} in this order, with the plan's section 4 clauses;
//    - a table with the header cells "Pointer directory" and "Relative path to 03" and exactly the three rows of the plan (`.ai/context/`,
//      `docs/`, `docs/integrations/`);
//    - the conditional root paragraph as one blockquote starting "Readers and agents MUST follow documentation pointers" and the navigation
//      sentence as one blockquote starting "Some entries below are documentation pointers";
//    - the exact owner-decision sentence on a line of its own inside a fenced block;
//    - the clauses D1, D2, M1, M2, O1, O2, C1, C2 with the plan's wording (wording of the MUST sentences is frozen by the plan; the failure
//      each prevents follows "because" or "so");
//    - the mapping rows (one table row or list item per PS document of plan section 3) naming the destination headings;
//    - the bullet form: one line `- <Heading>` or `- <Parent> > <Subheading>` (a subordinate heading never without its parent), stated with
//      an example such as `Database > Schema changes`. Every mapped section of the PS document is listed.
// 2. references/modes.md: the per-file PS-first recovery (CLAUDE.md, reviewer wrapper, docs-sync wrapper judged separately; observe before
//    repairing; keep/take-new/merge; held when deficient; collateral changes get their normal disposition) and the replaced observation
//    sentence of plan section 6. references/report.md: the conditional section of plan section 5 between "Decisions taken with the user"
//    and "Validation" inside the existing fence. SKILL.md: the Phase 1 sentence of plan section 6 and a Phase 0 mapping assessment.
// 3. No pointer marker appears in assets/, scripts/ or data/ (the skeleton is documentation, not a shipped template).
// Superseded older cases: none. C8, C9, C10, C12, C13, C14, C15 and C16 are not edited and must keep passing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as H from './live/bs-doc-map.mjs';
import { parseBlocks, upsertBlock } from '../scripts/blocks.mjs';
import { checkManifest } from '../scripts/schemas.mjs';

const TESTS = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(TESTS, '..');
const REPO = path.resolve(SKILL, '..');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const rd = (p) => fs.readFileSync(p, 'utf8');
const T = (...lines) => `${lines.join('\n')}\n`;
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: ok === true, detail }); };
const skip = (name, reason) => { results.push({ name, skip: true, detail: reason }); };
const attempt = (fn) => { try { return fn(); } catch (e) { return { threw: String(e && e.message ? e.message : e) }; } };
const codes = (findings) => findings.map((f) => f.code);
const has = (findings, code) => codes(findings).includes(code);
const grp = (g) => (name, ok, detail) => check(`[${g}] ${name}`, ok, detail);

// ------------------------------------------------------------------------ the actual sources ----
const REFS = { docs: path.join(SKILL, 'references', 'docs-generation.md'), modes: path.join(SKILL, 'references', 'modes.md'), report: path.join(SKILL, 'references', 'report.md'), skill: path.join(SKILL, 'SKILL.md') };
const TXT = Object.fromEntries(Object.entries(REFS).map(([k, p]) => [k, attempt(() => rd(p))]));
for (const [k, v] of Object.entries(TXT)) if (typeof v !== 'string') { check(`the ${k} reference is readable`, false, v); TXT[k] = ''; }
const BS03 = rd(path.join(REPO, 'backend-standards', 'templates', 'docs', '03-project-architecture.md'));
const BS_CLAUDE_TEMPLATE = rd(path.join(REPO, 'backend-standards', 'templates', 'docs', 'CLAUDE.md'));
const PS_CLAUDE_TEMPLATE = rd(path.join(SKILL, 'assets', 'templates', 'CLAUDE.md'));
const PS_AGENTS_TEMPLATE = rd(path.join(SKILL, 'assets', 'templates', 'AGENTS.md'));
const WRAPPER = { reviewer: rd(path.join(SKILL, 'assets', 'wrappers', 'claude-reviewer.md')), 'docs-sync': rd(path.join(SKILL, 'assets', 'wrappers', 'claude-docs-sync.md')) };
const BS_AGENT = { reviewer: rd(path.join(REPO, 'backend-standards', 'templates', 'agents', 'reviewer.md')), 'docs-sync': rd(path.join(REPO, 'backend-standards', 'templates', 'agents', 'docs-sync.md')) };
const DOC03 = H.parseHeadingDoc(BS03);
const SKEL = H.extractSkeleton(TXT.docs);
const PT = H.extractPathTable(TXT.docs);
const ROOT_PARAGRAPH = H.extractRootParagraph(TXT.docs);
const NAV_SENTENCE = H.extractNavSentence(TXT.docs);

// ------------------------------------------------------------------------------ the harness ----
const TMP = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'ps-bsmap-')));
let seq = 0;
const scratch = (label) => { const d = path.join(TMP, `${label}-${++seq}`); fs.mkdirSync(d, { recursive: true }); return d; };
const putF = (root, rel, text) => { const p = path.join(root, ...rel.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
const readF = (root, rel) => { try { return rd(path.join(root, ...rel.split('/'))); } catch { return null; } };
const existsF = (root, rel) => fs.existsSync(path.join(root, ...rel.split('/')));
const GITCONFIG = path.join(TMP, 'gitconfig');
fs.writeFileSync(GITCONFIG, '[user]\n\tname = Fixture\n\temail = fixture@example.invalid\n[commit]\n\tgpgsign = false\n[core]\n\tautocrlf = false\n');
const ENV = H.isolatedGitEnv(GITCONFIG);
const runCmd = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, env: ENV, encoding: 'utf8', shell: false, windowsHide: true, timeout: 120000, maxBuffer: 1 << 26 });
const gitIn = (cwd, ...args) => { const r = runCmd('git', args, cwd); return { code: r.status, out: String(r.stdout ?? '').trim(), err: String(r.stderr ?? '').trim() }; };
function mkRepo(label, files) {
  const root = scratch(label);
  gitIn(root, 'init', '-q');
  for (const [rel, text] of Object.entries(files)) putF(root, rel, text);
  gitIn(root, 'add', '-A');
  if (gitIn(root, 'commit', '-qm', 'fixture').code !== 0) throw new Error('cannot commit the fixture');
  return root;
}
const commitAll = (root, msg = 'fixture') => { gitIn(root, 'add', '-A'); gitIn(root, 'commit', '-qm', msg, '--allow-empty'); };
function skillScript(name, args, cwd) {
  const r = runCmd(process.execPath, [path.join(SKILL, 'scripts', `${name}.mjs`), ...args], cwd);
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* not JSON */ }
  return { code: r.status, out: r.stdout, err: r.stderr, json };
}
const tryJunction = (target, linkPath) => { try { fs.symlinkSync(target, linkPath, 'junction'); return true; } catch { return false; } };
const tryFileLink = (target, linkPath) => { try { fs.symlinkSync(target, linkPath, 'file'); return true; } catch { return false; } };
const cloneTree = (src, dst) => { fs.cpSync(src, dst, { recursive: true }); return dst; };

// --------------------------------------------------------------------- drafting-contract units ----
// A unit is a blank-line separated block, a table row, or a list item, in plain text (no backticks, straight quotes, squashed).
const plain = (s) => String(s).replace(/`/g, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
function units(text) {
  const t = String(text).replace(/\r\n?/g, '\n');
  const out = [];
  const re = /[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    out.push({ raw: m[0], start: m.index, end: m.index + m[0].length, text: plain(m[0]) });
    for (const line of m[0].split('\n')) if (/^\s*\|.*\|\s*$/.test(line) || /^\s*(?:[-*]|\d+\.)\s+/.test(line)) out.push({ raw: line, start: m.index + m[0].indexOf(line), end: m.index + m[0].indexOf(line) + line.length, text: plain(line), line: true });
  }
  return out;
}
// A row clause is satisfied only by a table row, so a sentence elsewhere that happens to mention the same words cannot stand in for the row.
const isRow = (u) => u.line === true && /^\s*\|.*\|\s*$/.test(u.raw);
const findUnit = (us, all, row = false) => us.find((u) => (!row || isRow(u)) && all.every((re) => re.test(u.text)));
const BECAUSE = /\b(because|prevents?|so that|so (?:it|they|generation|adoption|a pointer|the|an?|duplicate)\b)/i;
const D = (id, file, all, why = false, row = false) => ({ id, file, all, why, row });
const CLAUSES = [
  D('D0.owner', 'docs', [/where backend-standards \(BS\) provenance is established, \.ai\/standards\/03-project-architecture\.md \(03\) owns the architectural facts/, /Project-setup writes navigation pointers for the overlapping documents instead of a second full description/]),
  D('D1.distinguish', 'docs', [/Setup MUST distinguish absent signals from denied, unsafe, malformed or unreadable signals/], true),
  D('D1.permitted-boundary', 'docs', [/Setup MUST inspect provenance only within the existing permitted-read boundary/, /grant no additional read, write or ownership permissions/]),
  D('D1.filename-alone', 'docs', [/Setup MUST NOT infer BS provenance from the architecture filename alone/]),
  D('D1.readable-03', 'docs', [/automatic activation requires a readable, permitted 03 and either/]),
  D('D1.stamp-path', 'docs', [/valid root stamp object with appliedBy: ?"backend-standards" and a valid semantic[- ]version string/]),
  D('D1.sentence-path', 'docs', [/unambiguous BS CLAUDE provenance sentence containing a concrete semantic[- ]version, together with the import of this same 03/]),
  D('D1.any-version', 'docs', [/Do not require exactly BS 3\.1\.0\. Resolve the installed document's headings and coverage/]),
  D('D1.row-stamp', 'docs', [/valid stamp/i, /activate/i], false, true),
  D('D1.row-sentence', 'docs', [/(absent|no) stamp/i, /sentence/i, /import/i], false, true),
  D('D1.row-decision', 'docs', [/decision/i, /honor/i], false, true),
  D('D1.row-03-absent', 'docs', [/03 absent/i, /hold/i], false, true),
  D('D1.row-03-alone', 'docs', [/03 alone/i, /(ambigu|disposition)/i, /Do not generate competing full documents while pending/], false, true),
  D('D1.row-conflict', 'docs', [/malformed stamp/i, /hold/i, /cannot silently override the conflict/], false, true),
  D('D1.row-none', 'docs', [/no accepted signal/i, /existing PS (documentation )?rules/i], false, true),
  D('D1.row-unrelated', 'docs', [/unrelated 03/i, /(no automatic conversion|no conversion)/i], false, true),
  D('D1.row-disappear', 'docs', [/signal disappears/i, /preserve pointers/i, /Never automatically expand them into full documents/], false, true),
  D('D2.location', 'docs', [/fixed location is \W*root AGENTS\.md,? outside (?:every|all|any) managed blocks?/i]),
  D('D2.search', 'docs', [/Setup MUST search for this exact standalone sentence in root AGENTS\.md outside managed blocks/], true),
  D('D2.after-approval', 'docs', [/Setup MUST propose and record this sentence only after explicit owner approval through the reviewed instruction-file workflow/]),
  D('D2.not-counted', 'docs', [/Its absence, approximate wording, quotation inside an example, or presence in another file MUST NOT count as this decision/]),
  D('D2.hold-conflicts', 'docs', [/Setup MUST hold conflicting or duplicated decision records for explicit disposition rather than choosing one silently/]),
  D('D2.show-phase0', 'docs', [/Setup MUST show the signals, selected policy, detected mode and unresolved dispositions in Phase 0/], true),
  D('D2.no-stamp-repair', 'docs', [/Setup MUST NOT repair or manufacture the BS stamp/]),
  D('D2.not-proof', 'docs', [/does not prove that BS ran/]),
  D('M1.pointer', 'docs', [/[Ss]etup MUST generate each applicable mapped PS document as a pointer and consolidate its evidenced architectural facts into the mapped sections of 03/], true),
  D('M1.preserve', 'docs', [/Setup MUST preserve the information requirements of the original PS document/, /configuration inventories/, /transaction details/, /error transformations/, /integration safeguards/, /critical-module invariants/]),
  D('M1.summary-exception', 'docs', [/nstruction-summary exception/i, /critical-rule summaries/, /MUST agree with 03/]),
  D('M1.expansion', 'docs', [/03 may require reviewed expansion/, /Configuration and Outbound integrations sections start with comparatively compact structures/, /Changes are to the target project's 03, never the BS template/]),
  D('M2.normalize', 'docs', [/Setup MUST resolve headings after removing an optional leading section number and normalizing whitespace/, /parenthetical cross-references/], true),
  D('M2.parent', 'docs', [/Setup MUST resolve subordinate headings within their named parent section/, /Missing, renamed or ambiguous destinations require explicit disposition/, /MUST NOT choose a similar heading silently or generate a duplicate full document/]),
  D('M2.names', 'docs', [/Pointers MUST reproduce actual resolved heading names/]),
  D('M2.links', 'docs', [/file links with named headings/i, /fragment/i, /Renumbering remains usable; changed cross-references or meaning require review/]),
  D('M2.bullet-form', 'docs', [/Database > Schema changes|Parent > Subheading/i]),
  D('P.expansion-placeholders', 'docs', [/Replace every placeholder/i]),
  D('P.expansion-paths', 'docs', [/Use the relative paths below/]),
  D('P.expansion-bullets', 'docs', [/one section bullet per resolved heading or parent\/subheading pair/i]),
  D('P.expansion-no-copy', 'docs', [/no copied factual summaries, tables, timestamps or hashes/i]),
  D('P.expansion-vendor', 'docs', [/vendor/i, /only with evidence/i]),
  D('P.expansion-near-empty', 'docs', [/Exempt valid pointers from the generic "skip near-empty documents" instruction/]),
  D('P.expansion-marker', 'docs', [/pointer marker/i, /distinct from managed-block markers/i]),
  D('P.alone', 'docs', [/Each pointer MUST supply complete routing when opened alone/, /MUST NOT depend on root text, imports or subagent inheritance/, /Actual agent compliance remains a live measurement/]),
  D('O1.merged', 'docs', [/Setup MUST request merged ownership for pointers and a created or changed 03/, /because these are living project documents/]),
  D('O1.no-claim', 'docs', [/Setup MUST NOT claim ownership of 03 merely by reading or linking it/]),
  D('O1.additions', 'docs', [/Setup MUST preserve user additions to pointers until their disposition is approved/, /marker grants no deletion permission/]),
  D('O1.transitions', 'docs', [/Setup MUST review ownership transitions alongside content changes/]),
  D('R.template-unchanged', 'docs', [/Keep assets\/templates\/AGENTS\.md unchanged/, /Non-activated output receives neither addition/]),
  D('R.money-rule', 'docs', [/Preserve the existing money\/auth critical rule/i, /critical-modules\.md/, /locking, atomicity and idempotency/i, /That document becomes a self-sufficient pointer/]),
  D('O2.no-synth', 'docs', [/Setup MUST NOT synthesize or append a docs-sync extension solely to enable pointer routing/], true),
  D('O2.wrapper', 'docs', [/existing user-modified-file rule separately to that wrapper/, /keep theirs, take new, or merge/]),
  D('O2.inventory', 'docs', [/Setup MUST inventory rules and frontmatter before replacement/, /Approved project rules MUST use the existing project-extension destinations, preserving existing extension bytes/, /Approval cannot relax a canonical restriction/]),
  D('O2.incomplete', 'docs', [/Setup MUST report a retained standalone BS agent or unresolved custom wrapper as an incomplete PS agent update and identify the definition actually invoked/]),
  D('C1.inventory', 'docs', [/[Ss]etup MUST inventory its substantive content and propose a destination for every item/]),
  D('C1.dispositions', 'docs', [/Setup MUST obtain dispositions for contradictions and removals/, /MUST NOT move a known invariant solely into TODO/]),
  D('C1.one-transaction', 'docs', [/Setup MUST stage approved source changes, pointer replacements, routing instructions and ownership changes in one reviewed apply transaction/, /MUST NOT replace an original while necessary consolidation remains unapproved/]),
  D('C1.equal-modes', 'docs', [/Apply this equally to adoption and update/i, /PS provenance does not make existing knowledge disposable/]),
  D('C2.declare', 'docs', [/A pointer transaction MUST declare existing 03 in transaction-inputs\.json when it is not drafted/, /because approval must bind the source/]),
  D('C2.instruction-sources', 'docs', [/MUST also bind unchanged root CLAUDE\.md when activation relies on its provenance/, /unchanged root AGENTS\.md when activation relies on the exact owner decision/]),
  D('C2.stamp-not-declared', 'docs', [/Do not declare \.backend-standards\.json/, /econfirm/i]),
  D('C2.binding', 'docs', [/Drafted targets already receive target-hash binding/]),
  D('C2.limitation', 'docs', [/ccepted limitation/i, /stamp can change between that check and commit/i, /adds neither atomic stamp binding nor a production-script change/]),
  D('E.validation-boundary', 'docs', [/reference-exists examines instruction files and \.ai\/agents\/\*\.md; it does not validate ordinary pointer destinations or headings/]),
  D('E.destination-inspection', 'docs', [/Drafting instructions MUST require destination inspection/]),
  D('E.pointer-facts', 'docs', [/Facts added to a pointer/, /Preserve and inventory them; propose consolidation/], false, true),
  D('E.deleted-pointer', 'docs', [/User deleted a pointer/, /Do not silently recreate it; resolve disposition/, /Docs-sync reports missing navigation/], false, true),
  D('E.declined', 'docs', [/Owner declines necessary completion/, /Retain originals, hold dependent conversions, report incomplete consolidation/], false, true),
  D('E.contradiction', 'docs', [/Existing document contradicts 03/, /Show both locations and verify permitted code; obtain disposition/], false, true),
  D('E.local-conflict', 'docs', [/Local instruction conflicts with routing/, /Resolve before installing contradictory root text/], false, true),
  D('E.03-unreadable', 'docs', [/03 protected, unsafe or unreadable/, /Stop the affected step; no bypass or duplicate-document fallback/], false, true),
  D('E.noop', 'docs', [/All source\/output unchanged/, /Zero diff, including manifest bytes/], false, true),
  D('E.rollback', 'docs', [/Partial apply or intervening rollback edits/, /Preserve recovery material and follow journal handling/], false, true),
  D('E.full-precede', 'docs', [/PS full documents precede BS's 03/, /Inventory and reconcile during PS update/, /do not require a new-service stamp/], false, true),
  D('E.bs-overwrites', 'docs', [/BS overwrites or merges PS instructions\/wrappers/, /Measure first, then apply the per-file recovery table/, /Retain the BS overwrite TODO/], false, true),
  D('E.markers', 'docs', [/Missing or malformed managed markers/, /Apply existing removed-content or marker-error rules/, /no silent repair/], false, true),
  D('E.blank-completion', 'docs', [/Blank mapped section/, /Complete from permitted implementation evidence/, /identify unknowns explicitly/], false, true),
  D('E.detail', 'docs', [/Detail exceeds BS tables/, /Propose reviewed expansion under the matching section/, /apply Q7/], false, true),
  D('E.renumbered', 'docs', [/Heading renumbered/, /Match normalized heading text under its parent/], false, true),
  D('E.heading-changed', 'docs', [/Heading renamed, removed, duplicated or cross-reference changed/, /Hold until a replacement\/addition is approved/], false, true),
  D('E.local-exist', 'docs', [/Local instructions exist/, /Preserve both members of each pair and local constraints/], false, true),
  D('E.no-vendor', 'docs', [/No evidenced vendor\/business flow/, /Do not invent documents/], false, true),
  D('E.after-prepare', 'docs', [/Required source changes after prepare/, /Existing drift binding refuses commit/, /reprepare according to run lifecycle/], false, true),
  D('E.nav-refs', 'docs', [/Preserve applicable navigation references to emitted pointers/]),
  D('E.deleted-ref', 'docs', [/Deleting a referenced pointer must still fail reference-exists/]),
  D('E.checker-scope', 'docs', [/test-only checker validates pointer paths, containment, headings and format/]),
  D('E.checker-not-shipped', 'docs', [/The checker does not become shipped enforcement/]),
  D('E.validator-proof', 'docs', [/Validator success alone does not prove mapping correctness or restored root-start semantics/]),
  D('row:root-AGENTS.md', 'docs', [/^\| Root AGENTS\.md \|/, /Generate instructions with critical rules, navigation and conditional routing/], false, true),
  D('row:root-CLAUDE.md', 'docs', [/^\| Root CLAUDE\.md \|/, /Generate or merge instructions/, /preserving BS imports and version information/, /installing the PS import and managed block through review/], false, true),
  D('row:pairs', 'docs', [/^\| Directory-specific AGENTS\.md \/ CLAUDE\.md pairs \|/, /Preserve local instructions and paired files/, /reference 03 for shared facts/], false, true),
  D('MD.map-header', 'modes', [/^\| File \| If BS overwrites \| If BS merges or preserves \| PS 3\.1 completion\/checker expectation \|$/], false, true),
  D('MD.map-claude', 'modes', [/^\| Root CLAUDE\.md \|/, /Inventory lost PS import\/block and preserved\/new BS content/, /Propose a reviewed merge restoring @AGENTS\.md and the complete current managed claude block, including the root-start rule/, /Preserve BS imports, version sentence, commands and approved user content/, /Inspect the resulting import, block, BS lines and user text/, /Preserve correct content; review missing or changed parts/, /Do not assume a merge preserved every rule/, /one effective sibling import/, /one valid managed claude block with the required source-template content/, /BS imports\/version information retained/, /approved user content preserved/, /no duplicate\/conflicting instructions/], false, true),
  D('MD.map-reviewer', 'modes', [/^\| \.claude\/agents\/reviewer\.md \|/, /Treat it as a user-modified fully owned file when its manifest record says full/, /Offer keep\/take-new\/merge and inventory BS rules\/frontmatter/, /Compare actual bytes against the manifest and shipped wrapper/, /Apply the same disposition rule whenever modified/, /Take-new or approved canonical restoration: exact shipped wrapper plus approved project-extension preservation/, /Keep or unresolved custom merge: exact retained\/approved bytes, actual invoked definition recorded, incomplete PS agent layer/], false, true),
  D('MD.map-docs-sync', 'modes', [/^\| \.claude\/agents\/docs-sync\.md \|/, /Same per-file user-modified workflow/, /preserve approved documentation rules through the existing extension mechanism/, /Same comparison and separate disposition/, /reviewer's choice does not decide docs-sync's choice/, /Same distinction between canonical completion and retained\/custom incomplete installation/], false, true),
  D('MD.map-collateral', 'modes', [/^\| \.ai\/agents\/\*, Codex wrappers, root AGENTS\.md, settings, runtime and manifest \|/, /Inspect the explicit permitted inventory for collateral changes/, /no blanket assumption that BS touched or preserved them/, /Unaffected bytes remain unchanged/, /Any observed change receives its existing ownership\/disposition workflow/, /no unexplained collateral modification is accepted/], false, true),
  D('MD.bs-instructs', 'modes', [/BS instructs the agent to write CLAUDE\.md from its template and copy two Claude agents/, /Its existing-project procedure invokes those operations/]),
  D('MD.bs-todo-recorded', 'modes', [/The repository records the overwrite problem as unfinished BS 4\.0\.0 work/]),
  D('MD.observe-actual', 'modes', [/The actual outcome of a particular agent run.{1,3}overwrite, merge, unchanged or mixed.{1,3}must be observed/]),
  D('MD.helper-no-simulate', 'modes', [/The helper MUST NOT pre-restore PS files, intercept BS writes, or simulate a desired outcome/]),
  D('MD.no-silent-recreate', 'modes', [/Missing blocks are not silently recreated/, /Marker errors stop for repair; removed blocks or files require disposition/]),
  D('MD.record-before', 'modes', [/Before candidate PS, record:/]),
  D('MD.rec-hashes', 'modes', [/Per-file before\/after hashes and overwrite\/merge\/unchanged classification, with evidence/]),
  D('MD.rec-signals', 'modes', [/Whether @AGENTS\.md, the claude block, root-start rule and BS imports\/version sentence exist/]),
  D('MD.rec-diagnostics', 'modes', [/Actual validate\.mjs results and blocks\.mjs drift results/]),
  D('MD.rec-agents', 'modes', [/Actual installed agent definitions and manifest ownership/]),
  D('MD.diag-import', 'modes', [/If BS removed @AGENTS\.md while sibling AGENTS\.md exists, expect claude-import failure/]),
  D('MD.diag-drift', 'modes', [/Full-file differences produce userModified: true in block drift and validator drift warnings; removed managed blocks appear as removed-by-user/]),
  D('MD.diag-actual', 'modes', [/A merge may produce different results; record actual diagnostics rather than forcing overwrite expectations/]),
  D('MD.measure-first', 'modes', [/PS-first recovery: measure BS before proposing repairs/]),
  D('MD.held', 'modes', [/Keeping deficient CLAUDE\.md is a held\/incomplete result, not successful root recovery/]),
  D('MD.assume-merge', 'modes', [/Do not assume a merge preserved every rule/i]),
  D('MD.todo', 'modes', [/Retain the BS overwrite TODO \(BS 4\.0\.0 work\); do not close it here/]),
  D('MD.observation', 'modes', [/A real Nest CLI 11 scaffold was exercised with BS followed by PS adopt on 2026-11-11\. Prepare held CLAUDE\.md and both standalone Claude agents for approval\. That run did not exercise the agents, Codex, or PS followed by BS, and did not verify the 3\.1 pointer workflow\./]),
  D('SK.phase1', 'skill', [/Before drafting overlapping documentation, setup MUST apply the source-of-truth mapping in references\/docs-generation\.md, including activation dispositions, existing-content consolidation and source binding, so generation cannot introduce a second factual owner\./]),
  D('SK.phase0', 'skill', [/Phase 0 mapping assessment: on a project that may be a backend-standards \(BS\) project, show the documentation mapping signals \(stamp, provenance sentence and import, recorded owner decision\), the selected policy, the detected mode and every unresolved disposition, then stop for approval/]),
];
// Mapping rows (plan section 3): the destination heading names each PS document row must carry; full documents say so.
// What each row must keep saying, besides its destination headings: a shorter BS table MUST NOT lose these (M1). One regex per retained word.
const KEEP = {
  '.ai/context/project-tree.md': [/dangerous-module references/],
  '.ai/context/critical-modules.md': [/Preserve/, /invariants/, /ownership boundaries/, /transactions/, /locking/, /idempotency/, /PII facts/],
  '.ai/context/error-contract.md': [/error contracts/, /response-writing paths/],
  '.ai/context/configuration.md': [/Preserve/, /variable name/, /requiredness/, /classification/, /consumer/, /description/, /source coverage/, /Never values/],
  'docs/api-conventions.md': [/rate-limit conventions/],
  'docs/database.md': [/Schema changes/, /Money/, /entity locations/, /naming conventions/],
  'docs/observability.md': [/health-check coverage/],
  'docs/integrations/<vendor>.md': [/scoped to the vendor/, /logging\/redaction/],
  '.ai/context/code-patterns.md': [/implementation examples/, /conventions/, /reference architectural facts in 03/],
  '.ai/context/development-rules.md': [/testing/, /compatibility/, /scope/, /test-run hygiene/, /reference tooling and local-development facts in 03/],
  'docs/business-rules/<flow>.md': [/sufficient domain evidence/, /Reference shared contracts in 03/],
  '.ai/decisions/README.md': [/ADR index/],
  '.ai/decisions/<adr>.md': [/evidence requirement/],
  'TODO.md': [/uncertainty/, /conflicts/, /unverified controls/],
};
const MAPPING_ROWS = [
  ...Object.entries(H.POINTER_DOCS).map(([rel, refs]) => ({ rel, names: refs.flatMap((r) => { const b = H.parseBulletRef(r); return b.parent === undefined ? [b.name] : [b.parent, b.name]; }), keep: KEEP[rel] ?? [] })),
  { rel: 'docs/integrations/<vendor>.md', names: ['Outbound integrations', 'Observability'], keep: KEEP['docs/integrations/<vendor>.md'] },
  ...['.ai/context/code-patterns.md', '.ai/context/development-rules.md', 'docs/business-rules/<flow>.md', '.ai/decisions/README.md', '.ai/decisions/<adr>.md', 'TODO.md'].map((rel) => ({ rel, full: true, keep: KEEP[rel] })),
];
// The table row of a mapped document: a table row naming it, with its destination headings (or "generate in full") and every retained word.
const rowUnit = (docsUnits, row) => docsUnits.find((x) => isRow(x) && x.text.includes(row.rel) && (row.full ? /generate in full/i.test(x.text) : row.names.every((n) => x.text.includes(plain(n)))) && row.keep.every((re) => re.test(x.text)));
/** Evaluates the whole contract on { docs, modes, report, skill } texts. Returns failures [{ id, why }]. */
function evaluateContract(t) {
  const fails = [];
  const U = { docs: units(t.docs), modes: units(t.modes), skill: units(t.skill) };
  const edge = [...U.docs, ...U.modes];
  for (const c of CLAUSES) {
    const pool = c.id.startsWith('E.') ? edge : U[c.file];
    const u = findUnit(pool, c.all, c.row);
    if (u === undefined) { fails.push({ id: c.id, why: 'not implemented yet, or the clause is missing or weakened' }); continue; }
    if (c.why && !BECAUSE.test(u.text)) fails.push({ id: c.id, why: 'the failure it prevents is not stated' });
  }
  for (const row of MAPPING_ROWS) {
    const u = rowUnit(U.docs, row);
    if (u === undefined) fails.push({ id: `row:${row.rel}`, why: row.full ? 'the full-document row is missing' : 'the mapping row or one of its destination headings is missing' });
  }
  const rp = H.extractRootParagraph(t.docs);
  if (rp === null) fails.push({ id: 'R.root-paragraph', why: 'the conditional root paragraph is missing' });
  else for (const p of rootParagraphProblems(rp)) fails.push({ id: 'R.root-paragraph', why: p });
  if (H.extractNavSentence(t.docs) !== 'Some entries below are documentation pointers; follow their source links and named headings.') fails.push({ id: 'R.nav-sentence', why: 'the navigation sentence is missing or changed' });
  const sk = H.extractSkeleton(t.docs);
  if (sk === null) fails.push({ id: 'P.skeleton', why: 'no extractable pointer skeleton' });
  else for (const p of skeletonProblems(sk)) fails.push({ id: 'P.skeleton', why: p });
  if (!H.extractFences(t.docs).some((f) => f.body.split('\n').includes(H.DECISION_SENTENCE))) fails.push({ id: 'D2.sentence', why: 'the exact owner-decision sentence is not on a line of its own in a fenced block' });
  const table = H.extractPathTable(t.docs);
  const want = new Map([['.ai/context', '../standards/03-project-architecture.md'], ['docs', '../.ai/standards/03-project-architecture.md'], ['docs/integrations', '../../.ai/standards/03-project-architecture.md']]);
  if (table === null || table.size !== 3 || [...want].some(([k, v]) => table.get(k) !== v)) fails.push({ id: 'P.path-table', why: 'the path table is missing or its rows are not the three plan rows' });
  const todo = t.docs.indexOf('## `TODO.md`'); const own = t.docs.indexOf('## Ownership hints');
  const d1 = U.docs.find((x) => /Setup MUST distinguish absent signals/.test(x.text));
  const skIdx = sk === null ? -1 : t.docs.indexOf(H.POINTER_MARKER);
  if (todo < 0 || own < 0 || own < todo || d1 === undefined || skIdx < 0 || !(d1.start > todo && d1.start < own && skIdx > todo && skIdx < own)) fails.push({ id: 'P.position', why: 'the mapping section (activation clauses and skeleton) must sit between the TODO.md section and "## Ownership hints"' });
  const heads = [...t.docs.matchAll(/^#{1,6} .*$/gm)].map((m) => m[0]);
  if (heads[heads.length - 1] !== '### Environment template') fails.push({ id: 'P.final-heading', why: '"### Environment template" must stay the final heading (C9)' });
  const rep = reportProblems(t.report);
  for (const p of rep) fails.push({ id: 'REP.block', why: p });
  return fails;
}
// The frozen conditional root paragraph (plan section 4) and the frozen skeleton clauses, as predicates (not copies).
const ROOT_REQUIRED = [
  ['follow-pointers', /Readers and agents MUST follow documentation pointers to their named source sections before relying on or updating the topic/],
  ['owner-of-facts', /03-project-architecture\.md owns the facts; pointer files contain navigation only/],
  ['all-agents', /All agents, including reviewer and docs-sync, MUST follow that routing/],
  ['writers-update-source', /Documentation-writing agents MUST update the affected source sections instead of expanding a pointer, because separate descriptions drift/],
  ['writers-record-gap', /documentation-writing agents MUST record the gap in root TODO\.md within their authorized scope and resolve the destination before changing the affected documented facts/],
  ['read-only-reports', /Read-only agents MUST report the gap in their output and MUST NOT create, modify or delete files/],
  ['other-readers', /Other readers MUST report the gap to the documentation owner/],
  ['write-boundary', /These duties preserve each actor.s write boundary/],
];
function rootParagraphProblems(p) {
  const s = plain(p);
  return ROOT_REQUIRED.filter(([, re]) => !re.test(s)).map(([n]) => `the conditional root paragraph lost: ${n}`).concat(/unconditional|MUST record the gap in (the )?(repository-root |root )?TODO\.md\.(?! Read-only)/.test(s) && !/documentation-writing agents MUST record/.test(s) ? ['the TODO write obligation became unconditional'] : []);
}
function skeletonProblems(sk) {
  const out = [];
  const names = [...sk.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]);
  if (JSON.stringify(names) !== JSON.stringify(H.PLACEHOLDERS)) out.push(`placeholders must be exactly ${H.PLACEHOLDERS.join(', ')} in order`);
  if (sk.split(H.POINTER_MARKER).length - 1 !== 1) out.push('the pointer marker must appear exactly once');
  if (/project-setup:(begin|end)/.test(sk)) out.push('the skeleton must carry no managed-block marker');
  for (const [n, re] of H.ROUTING_OBLIGATIONS) if (!re.test(plain(sk).replace(/\s+/g, ' ')) && !re.test(sk.replace(/\s+/g, ' '))) out.push(`the skeleton lost the routing obligation ${n}`);
  return out;
}
const REPORT_BLOCK = T(
  '### Documentation source mapping',
  '- Layout: <BS-mapped / ordinary PS / pending>.',
  '- Provenance: <signals and approved disposition>.',
  '- Conversion: <complete / partial / held / not applicable>.',
  '| PS path | Source headings | Outcome | Content disposition or remaining action |',
  '- BS outcome by file: <overwrite / merge / unchanged / other, evidence>.',
  '- CLAUDE.md recovery and per-wrapper dispositions.',
  '- Agent definitions retained or replaced; incomplete instruction/agent updates.',
  '- Pointer/source checks performed and their limits.',
  '- Host routing measurements: <host, agent, version, result / not verified>.',
  '- Source-size, BS re-sync and stamp-binding limitations.',
);
const REPORT_VALIDATION_THROUGH_DOCTOR = T(
  '### Validation (validate.mjs)',
  'pass N / warn N / fail N; list every warn/fail and needs-update info.',
  'Static setup results: <summary>.',
  'Installed hook self-test: <passed / failed / not-run>.',
  'Claude hook loading: <verified with scoped evidence / not verified>.',
  '',
  '### Doctor diagnostics',
  'Configuration and diagnostics: <ready / not ready / not run>.',
  'Connector-tool absence and sandbox enforcement: <separate host evidence / not verified>.',
);
function reportProblems(text) {
  const out = [];
  const t = String(text).replace(/\r\n?/g, '\n');
  const decisions = '### Decisions taken with the user\n- conflicts resolved, allow-listed commands and why, items deliberately skipped\n\n';
  if (!t.includes(`${decisions}${REPORT_BLOCK}\n### Validation (validate.mjs)\n`)) out.push('the conditional mapping section must stand exactly once between "Decisions taken with the user" and "Validation", inside the report');
  if (t.split('### Documentation source mapping').length !== 2) out.push('the mapping section appears exactly once');
  if (!t.includes(`${REPORT_VALIDATION_THROUGH_DOCTOR}\n### Capability report\n`)) out.push('the validation and doctor block must stay exact and immediately before the Capability report');
  const fence = t.split('```');
  if (fence.length < 3 || !fence[1].includes('### Documentation source mapping')) out.push('the mapping section belongs inside the existing report fence');
  return out;
}
const CONTRACT_TEXT = { docs: TXT.docs, modes: TXT.modes, report: TXT.report, skill: TXT.skill };
const contract = evaluateContract(CONTRACT_TEXT);

// ============================================================== GROUP: drafting contract ====
{
  const G = grp('Drafting contract');
  const failed = new Map();
  for (const f of contract) failed.set(f.id, [...(failed.get(f.id) ?? []), f.why]);
  for (const c of CLAUSES) G(`clause ${c.id} is stated in ${c.id.startsWith('E.') ? 'the docs-generation or modes reference' : { docs: 'references/docs-generation.md', modes: 'references/modes.md', skill: 'SKILL.md' }[c.file]} with its keyword${c.why ? ' and the failure it prevents' : ''}`, !failed.has(c.id), failed.get(c.id));
  for (const row of MAPPING_ROWS) G(`mapping row ${row.rel} ${row.full ? 'says it is generated in full' : 'names its destination headings'}`, !failed.has(`row:${row.rel}`), failed.get(`row:${row.rel}`));
  for (const id of ['row:root-AGENTS.md', 'row:root-CLAUDE.md', 'row:pairs']) G(`mapping row ${id.slice(4)} is present`, !failed.has(id), failed.get(id));
  G('the conditional root-reinforcement paragraph is present with every frozen clause', !failed.has('R.root-paragraph'), failed.get('R.root-paragraph'));
  G('the navigation sentence is the exact frozen sentence', !failed.has('R.nav-sentence'), failed.get('R.nav-sentence'));
  G('the pointer skeleton is extractable and carries the frozen placeholders, marker and routing', !failed.has('P.skeleton'), failed.get('P.skeleton'));
  G('the path table has exactly the three frozen rows', !failed.has('P.path-table'), failed.get('P.path-table'));
  G('the owner-decision sentence is exact and on a line of its own in a fenced block', !failed.has('D2.sentence'), failed.get('D2.sentence'));
  G('the mapping section sits between the TODO.md section and "## Ownership hints"', !failed.has('P.position'), failed.get('P.position'));
  G('"### Environment template" stays the final heading of docs-generation.md (C9)', !failed.has('P.final-heading'), failed.get('P.final-heading'));
  G('the owner-decision sentence constant equals the frozen sentence', H.DECISION_SENTENCE === 'Documentation layout decision: use .ai/standards/03-project-architecture.md as the source of truth for project-setup mapped documentation.');
  G('the three directory routes of the frozen path table resolve to the one 03 from their own directory', (() => {
    const ok = [['.ai/context/x.md', '../standards/03-project-architecture.md'], ['docs/x.md', '../.ai/standards/03-project-architecture.md'], ['docs/integrations/x.md', '../../.ai/standards/03-project-architecture.md']];
    return ok.every(([rel, link]) => path.posix.normalize(path.posix.join(path.posix.dirname(rel), link)) === H.BS_03_REL);
  })());
  G('no pointer marker or skeleton is shipped under assets/, scripts/ or data/ (the skeleton is documentation, not a template)', (() => {
    const bad = [];
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.isFile() && fs.readFileSync(p, 'utf8').includes('project-setup:documentation-pointer')) bad.push(path.relative(SKILL, p)); } };
    for (const d of ['assets', 'scripts', 'data']) walk(path.join(SKILL, d));
    return bad.length === 0 ? true : bad;
  })(), 'a shipped copy would be a second generator template');
  G('neither this spec nor the live helper carries a duplicate generator template (no filled-in skeleton line; the skeleton is read from the reference at run time)', (() => {
    const needle = ['Source of truth: [Project architecture](', '{{RELATIVE_PATH_TO_03}}).'].join('');
    return ![rd(path.join(TESTS, 'live', 'bs-doc-map.mjs')), fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')].some((s) => s.includes(needle));
  })());
}

// ---- negative controls of the contract evaluator itself: every mutation of a stated clause must fail the contract. ----
const textsWith = (patch) => ({ ...CONTRACT_TEXT, ...patch });
const failedIds = (t) => new Set(evaluateContract(t).map((f) => f.id));
const minimal = (pool, all, row = false) => pool.filter((u) => (!row || isRow(u)) && all.every((re) => re.test(u.text))).sort((a, b) => a.text.length - b.text.length)[0];
const poolOf = (c) => (c.id.startsWith('E.') ? [...units(CONTRACT_TEXT.docs).map((u) => ({ ...u, file: 'docs' })), ...units(CONTRACT_TEXT.modes).map((u) => ({ ...u, file: 'modes' }))] : units(CONTRACT_TEXT[c.file]).map((u) => ({ ...u, file: c.file })));
const splice = (text, u, replacement) => text.slice(0, u.start) + replacement + text.slice(u.end);
// Each word may be wrapped in backticks in the source text; blockquote markers and line breaks may sit between words.
const phraseRe = (phrase) => new RegExp(phrase.trim().split(/\s+/).map((w) => `\`?${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\`?`).join('[\\s>]+'));
const base = new Set(contract.map((f) => f.id));
{
  const G = grp('Drafting contract');
  const deleteSurvivors = []; const weakSurvivors = []; const whySurvivors = []; const unmutable = [];
  let deleted = 0; let weakened = 0; let whyCut = 0; let weakTotal = 0; let whyTotal = 0;
  for (const c of CLAUSES) {
    if (base.has(c.id)) { unmutable.push(c.id); continue; }
    const u = minimal(poolOf(c), c.all, c.row);
    if (u === undefined) { unmutable.push(c.id); continue; }
    const key = c.id.startsWith('E.') ? u.file : c.file;
    const text = CONTRACT_TEXT[key];
    deleted += 1;
    if (!failedIds(textsWith({ [key]: splice(text, u, '') })).has(c.id)) deleteSurvivors.push(c.id);
    if (c.all.some((re) => /MUST/.test(re.source))) {
      weakTotal += 1;
      const raw = u.raw.replace(/MUST NOT/g, 'SHOULD NOT').replace(/MUST/g, 'SHOULD');
      if (raw !== u.raw) { weakened += 1; if (!failedIds(textsWith({ [key]: splice(text, u, raw) })).has(c.id)) weakSurvivors.push(c.id); }
    }
    if (c.why) {
      whyTotal += 1;
      const raw = u.raw.replace(/,?\s*\b(because|so that)\b[^.]*\./g, '.');
      if (raw !== u.raw) { whyCut += 1; if (!failedIds(textsWith({ [key]: splice(text, u, raw) })).has(c.id)) whySurvivors.push(c.id); }
    }
  }
  const all = unmutable.length === 0;
  G(`deleting any single clause fails the contract (${deleted} of ${CLAUSES.length} clauses mutated)`, all && deleteSurvivors.length === 0, all ? deleteSurvivors : `not implemented yet or incomplete: ${unmutable.length} clause(s) are absent, so there is nothing to mutate`);
  G(`weakening MUST or MUST NOT to SHOULD in any single clause fails the contract (${weakened} of ${weakTotal})`, all && weakened === weakTotal && weakSurvivors.length === 0, all ? weakSurvivors : 'clauses absent');
  G(`removing the stated failure from any clause that must carry one fails the contract (${whyCut} of ${whyTotal})`, all && whyCut === whyTotal && whySurvivors.length === 0, all ? whySurvivors : 'clauses absent');
  {
    // A clause is several regexes over one unit. Removing the words that any ONE regex matched must fail the clause; if it still passes, some other
    // unit supplies those words and the clause does not pin the sentence it names. (The plain-text rewrite of the intact unit must itself keep passing.)
    const survivors = []; const unjudged = []; let removals = 0; let judged = 0;
    for (const c of CLAUSES) {
      if (base.has(c.id)) continue;
      const u = minimal(poolOf(c), c.all, c.row);
      if (u === undefined) continue;
      const key = c.id.startsWith('E.') ? u.file : c.file;
      const text = CONTRACT_TEXT[key];
      if (failedIds(textsWith({ [key]: splice(text, u, u.text) })).has(c.id)) { unjudged.push(c.id); continue; }
      judged += 1;
      for (const re of c.all) {
        const cut = u.text.replace(new RegExp(re.source, `${re.flags.replace('g', '')}g`), '');
        if (cut === u.text) continue;
        removals += 1;
        if (!failedIds(textsWith({ [key]: splice(text, u, cut) })).has(c.id)) survivors.push(`${c.id}: ${re}`);
      }
    }
    const complete = CLAUSES.every((c) => !base.has(c.id));
    G(`removing the words matched by any one regex of a clause fails that clause (${removals} removals over ${judged} clauses)`, complete && survivors.length === 0 && unjudged.length === 0, complete ? { survivors, unjudged } : 'not implemented yet or incomplete: clauses absent');
  }
  {
    const survivors = []; const notMutable = []; let tokens = 0;
    for (const row of MAPPING_ROWS) {
      const u = rowUnit(units(CONTRACT_TEXT.docs), row);
      if (u === undefined || base.has(`row:${row.rel}`)) { notMutable.push(row.rel); continue; }
      if (failedIds(textsWith({ docs: splice(CONTRACT_TEXT.docs, u, u.text) })).has(`row:${row.rel}`)) { survivors.push(`${row.rel}: the plain-text rewrite of an intact row already fails`); continue; }
      for (const k of row.keep) { tokens += 1; if (!failedIds(textsWith({ docs: splice(CONTRACT_TEXT.docs, u, u.text.replace(new RegExp(k.source, 'g'), '')) })).has(`row:${row.rel}`)) survivors.push(`${row.rel}: ${k}`); }
    }
    G(`removing any one retained word from any mapped row fails that row (${tokens} words over ${MAPPING_ROWS.length - notMutable.length} rows)`, notMutable.length === 0 && survivors.length === 0, notMutable.length > 0 ? `not implemented yet or incomplete: ${notMutable.length} mapped row(s) are absent or changed (${notMutable.join(', ')})` : survivors);
  }
  const ctl = (name, id, patchFn, requires) => {
    const needsOk = !base.has(id) && (requires === undefined ? true : requires());
    if (!needsOk) { G(name, false, `not implemented yet: nothing present to mutate (${id})`); return; }
    const patch = attempt(patchFn);
    G(name, patch !== null && patch.threw === undefined && failedIds(textsWith(patch)).has(id), patch === null ? 'mutation did not apply' : patch.threw);
  };
  const skelStart = () => { const i = CONTRACT_TEXT.docs.indexOf(H.POINTER_MARKER); return i; };
  const inSkeleton = (phrase, to) => () => { const i = skelStart(); const m = phraseRe(phrase).exec(CONTRACT_TEXT.docs.slice(i)); return m === null ? null : { docs: CONTRACT_TEXT.docs.slice(0, i + m.index) + to + CONTRACT_TEXT.docs.slice(i + m.index + m[0].length) }; };
  ctl('a second pointer marker in the skeleton fails the contract', 'P.skeleton', () => ({ docs: CONTRACT_TEXT.docs.replace(H.POINTER_MARKER, `${H.POINTER_MARKER}\n${H.POINTER_MARKER}`) }));
  ctl('a managed-block marker inside the skeleton fails the contract', 'P.skeleton', () => ({ docs: CONTRACT_TEXT.docs.replace(H.POINTER_MARKER, `${H.POINTER_MARKER}\n<!-- project-setup:begin id=x -->`) }));
  ctl('removing the SECTION_BULLETS placeholder fails the contract', 'P.skeleton', () => ({ docs: CONTRACT_TEXT.docs.replace('{{SECTION_BULLETS}}', 'Database') }));
  ctl('swapping the TITLE placeholder for text fails the contract', 'P.skeleton', () => ({ docs: CONTRACT_TEXT.docs.replace('{{TITLE}}', 'Title') }));
  ctl('removing the source-of-truth link line fails the contract', 'P.skeleton', () => ({ docs: CONTRACT_TEXT.docs.replace(/Source of truth: \[Project architecture\]\(\{\{RELATIVE_PATH_TO_03\}\}\)\.\s*/, '') }));
  ctl('appending a heading after "### Environment template" fails the contract (C9)', 'P.final-heading', () => ({ docs: `${CONTRACT_TEXT.docs}\n## Late section\n` }));
  ctl('moving the pointer table row of docs/ to the wrong depth fails the contract', 'P.path-table', () => { const re = /(\|\s*`?docs\/?`?\s*\|\s*`?)\.\.\/\.ai\/standards\//; return re.test(CONTRACT_TEXT.docs) ? { docs: CONTRACT_TEXT.docs.replace(re, '$1../../.ai/standards/') } : null; });
  ctl('deleting the integrations row of the path table fails the contract', 'P.path-table', () => { const re = /^\|\s*`?docs\/integrations\/?`?\s*\|.*\|\s*\n/m; return re.test(CONTRACT_TEXT.docs) ? { docs: CONTRACT_TEXT.docs.replace(re, '') } : null; });
  ctl('an owner-decision sentence without its final period fails the contract', 'D2.sentence', () => ({ docs: CONTRACT_TEXT.docs.split(`${H.DECISION_SENTENCE}\n`).join(`${H.DECISION_SENTENCE.slice(0, -1)}\n`) }));
  ctl('an owner-decision sentence embedded in prose (not on a line of its own) fails the contract', 'D2.sentence', () => ({ docs: CONTRACT_TEXT.docs.split(`\n${H.DECISION_SENTENCE}\n`).join(`\nRecord ${H.DECISION_SENTENCE} today\n`) }));
  ctl('a changed navigation sentence fails the contract', 'R.nav-sentence', () => ({ docs: CONTRACT_TEXT.docs.replace(/Some entries below are documentation pointers;/g, 'Some entries below are pointers;') }));
  // The read-only duty (plan section 8 row "Read-only duty"): both the skeleton and the root paragraph.
  const RO = [
    ['deleting the read-only agents output-reporting duty', 'Read-only agents MUST report the gap in their output', ''],
    ['weakening the read-only output-reporting duty to SHOULD', 'Read-only agents MUST report the gap in their output', 'Read-only agents SHOULD report the gap in their output'],
    ['deleting the read-only MUST NOT write duty', 'and MUST NOT create, modify or delete files', ''],
    ['weakening MUST NOT create, modify or delete files to a recommendation', 'MUST NOT create, modify or delete files', 'should avoid changing files'],
    ['restoring the unconditional TODO-write obligation (no documentation-writing qualifier)', 'documentation-writing agents MUST record the gap in the repository-root TODO.md within their authorized scope', 'agents MUST record the gap in the repository-root TODO.md'],
    ['deleting the other-readers duty', 'Other readers MUST report the gap to the documentation owner', ''],
    ['deleting the write-boundary sentence', "These duties preserve each actor's write boundary.", ''],
  ];
  for (const [label, phrase, to] of RO) ctl(`${label} in the pointer skeleton fails the contract`, 'P.skeleton', inSkeleton(phrase, to));
  const rootStart = () => CONTRACT_TEXT.docs.indexOf('Readers and agents MUST follow documentation pointers');
  const inRoot = (phrase, to) => () => { const i = rootStart(); const m = phraseRe(phrase).exec(CONTRACT_TEXT.docs.slice(i)); return i < 0 || m === null ? null : { docs: CONTRACT_TEXT.docs.slice(0, i + m.index) + to + CONTRACT_TEXT.docs.slice(i + m.index + m[0].length) }; };
  const RO_ROOT = [
    ['deleting the read-only output-reporting duty', 'Read-only agents MUST report the gap in their output', ''],
    ['weakening the read-only output-reporting duty to MAY', 'Read-only agents MUST report the gap in their output', 'Read-only agents MAY report the gap in their output'],
    ['deleting the read-only MUST NOT write duty', 'and MUST NOT create, modify or delete files', ''],
    ['weakening MUST NOT create, modify or delete files to SHOULD NOT', 'MUST NOT create, modify or delete files', 'SHOULD NOT create, modify or delete files'],
    ['restoring the unconditional TODO-write obligation', 'documentation-writing agents MUST record the gap in root TODO.md within their authorized scope', 'agents MUST record the gap in root TODO.md'],
    ['deleting the other-readers duty', 'Other readers MUST report the gap to the documentation owner', ''],
    ['deleting the all-agents routing sentence', 'All agents, including reviewer and docs-sync, MUST follow that routing.', ''],
  ];
  for (const [label, phrase, to] of RO_ROOT) ctl(`${label} in the root paragraph fails the contract`, 'R.root-paragraph', inRoot(phrase, to));
  G('the root paragraph evaluator also fails on each read-only mutation of the extracted paragraph (direct control)', (() => {
    if (ROOT_PARAGRAPH === null) return false;
    const p = ROOT_PARAGRAPH;
    const variants = [p.replace(/Read-only agents MUST report the gap in their output/, ''), p.replace(/MUST NOT create, modify or delete files/, 'may change files'), p.replace(/documentation-writing agents MUST record/, 'agents MUST record')];
    return rootParagraphProblems(p).length === 0 && variants.every((v) => v !== p && rootParagraphProblems(v).length > 0);
  })(), ROOT_PARAGRAPH === null ? 'not implemented yet: no root paragraph to mutate' : undefined);
}

// ============================================================== GROUP: reporting ====
{
  const G = grp('Reporting');
  G('the conditional mapping section stands once in the report fence between Decisions and Validation, and the validation/doctor block is intact', reportProblems(TXT.report).length === 0, reportProblems(TXT.report));
  const hasBlock = reportProblems(TXT.report).length === 0;
  const r = TXT.report;
  const ctl = (name, mut) => { if (!hasBlock) { G(name, false, 'not implemented yet: no report block to mutate'); return; } const m = mut(r); G(name, m !== r && reportProblems(m).length > 0, m === r ? 'mutation did not apply' : undefined); };
  ctl('removing the conditional section fails', (t) => t.replace(`${REPORT_BLOCK}\n`, ''));
  ctl('duplicating the conditional section fails', (t) => t.replace(REPORT_BLOCK, `${REPORT_BLOCK}\n${REPORT_BLOCK}`));
  ctl('moving the section after Validation fails', (t) => t.replace(`${REPORT_BLOCK}\n`, '').replace('### Capability report', `${REPORT_BLOCK}\n### Capability report`));
  ctl('moving the section outside the report fence fails', (t) => t.replace(`${REPORT_BLOCK}\n`, '').replace('\n```\n\nCreating any other', `\n\`\`\`\n\n${REPORT_BLOCK}\nCreating any other`));
  ctl('dropping the pending/partial/held conversion slot fails', (t) => t.replace('- Conversion: <complete / partial / held / not applicable>.\n', ''));
  ctl('dropping the host-routing-measurements slot fails', (t) => t.replace(/- Host routing measurements:[^\n]*\n/, ''));
  ctl('dropping the BS-outcome-by-file slot fails', (t) => t.replace(/- BS outcome by file:[^\n]*\n/, ''));
  ctl('dropping the incomplete instruction/agent updates slot fails', (t) => t.replace(/- Agent definitions retained or replaced;[^\n]*\n/, ''));
  ctl('dropping the stamp-binding limitation slot fails', (t) => t.replace(/- Source-size, BS re-sync and stamp-binding limitations\.\n/, ''));
  ctl('reordering Doctor diagnostics before Validation fails (C10 ordering)', (t) => t.replace('### Validation (validate.mjs)', '### Doctor diagnostics\nX\n\n### Validation (validate.mjs)'));
  ctl('inserting text between the doctor block and the Capability report fails', (t) => t.replace('\n### Capability report', '\n### Extra\n\n### Capability report'));
  // Structural slots: pending, partial and held outcomes each have their own explicit value; an incomplete outcome cannot be reported complete.
  G('the report slot names pending, partial and held outcomes explicitly', hasBlock && /Layout: <BS-mapped \/ ordinary PS \/ pending>/.test(r) && /Conversion: <complete \/ partial \/ held \/ not applicable>/.test(r) && /BS outcome by file: <overwrite \/ merge \/ unchanged \/ other, evidence>/.test(r), hasBlock ? undefined : 'not implemented yet');
  G('the report names incomplete instruction and agent updates as their own slot (so incomplete recovery cannot be folded into complete)', hasBlock && /incomplete instruction\/agent updates/.test(r), hasBlock ? undefined : 'not implemented yet');
  G('the helper refuses to call a partial case complete: a kept agent forces the partial outcome', (() => {
    const wrapper = WRAPPER['docs-sync'];
    const f = H.checkAgentRecovery({ name: 'docs-sync', disposition: 'keep', text: BS_AGENT['docs-sync'], shippedWrapper: wrapper, retainedBytes: BS_AGENT['docs-sync'], report: { incomplete: false, invokedDefinition: '.claude/agents/docs-sync.md' } });
    return has(f, 'status');
  })());
}

// ====================================================================== shared fixtures ====
const NEEDS = (G, name, deps, fn) => {
  const missing = deps.filter(([, v]) => v === null || v === undefined).map(([n]) => n);
  if (missing.length > 0) { G(name, false, `not implemented yet: ${missing.join(', ')} not extractable from the drafting reference`); return; }
  const r = attempt(fn);
  if (r !== null && typeof r === 'object' && !Array.isArray(r) && r.threw !== undefined) { G(name, false, r.threw); return; }
  G(name, r === true, r === true ? undefined : r);
};
const SK = ['the pointer skeleton', SKEL];
const PTB = ['the pointer path table', PT];
const titleOf = (rel) => path.posix.basename(rel, '.md').replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
const scopeOf = (rel) => (H.isVendorPointerPath(rel) ? `${titleOf(rel)} integration` : `${titleOf(rel).toLowerCase()} documentation`);
const VENDOR = 'docs/integrations/stripe.md';
const ALL_POINTER_RELS = [...Object.keys(H.POINTER_DOCS), VENDOR];
const pointerOf = (rel, over = {}) => H.expandSkeleton(SKEL, { title: over.title ?? titleOf(rel), relPath: over.relPath ?? PT.get(path.posix.dirname(rel)), bullets: over.bullets ?? [...(H.mappingRefsFor(rel) ?? [])], scope: over.scope ?? scopeOf(rel) });
const inspect = (rel, text, doc03 = DOC03) => H.inspectPointerText({ rel, text, skeleton: SKEL, pathTable: PT, doc03 });
const tolerant = (re) => new RegExp(re.source.replace(/ /g, '\\s+'));
const mkProj = (files) => { const root = scratch('proj'); for (const [rel, text] of Object.entries(files)) putF(root, rel, text); return root; };
const STAMP = (v = '3.1.0') => `${JSON.stringify({ version: v, appliedBy: 'backend-standards' })}\n`;
const BS_CLAUDE = (v = '3.1.0') => BS_CLAUDE_TEMPLATE.replace(/(Applied from the `backend-standards` skill, version `)[^`]*(`\.)/, `$1${v}$2`);
const F03 = { [H.BS_03_REL]: BS03 };
const DECISION_AGENTS = (extra = '') => `# svc\n\n${H.DECISION_SENTENCE}\n\n<!-- project-setup:begin id=overview -->\nOverview.\n<!-- project-setup:end id=overview -->\n${extra}`;
const layoutOf = (files, o = {}) => { const root = mkProj(files); const reads = []; const sig = H.collectSignals(root, { reads, ownerDisposition: o.ownerDisposition ?? null }); return { ...H.classifyLayout(sig), reads, sig, root }; };

// ============================================================== GROUP: detection ====
{
  const G = grp('Detection');
  const T0 = (name, files, treatment, extra) => { const r = attempt(() => layoutOf(files, extra?.opts)); G(name, r.threw === undefined && r.treatment === treatment && (extra?.accepted === undefined || extra.accepted.every((a) => r.accepted.includes(a))) && (extra?.fullDocuments === undefined || r.fullDocuments === extra.fullDocuments), r.threw ?? `got ${r.treatment} (${r.reason})`); };
  T0('a valid stamp and a readable 03 activate the mapping', { ...F03, [H.STAMP_REL]: STAMP() }, 'activate', { accepted: ['stamp'], fullDocuments: false });
  for (const v of ['0.0.1', '1.2.3-rc.1', '1.2.3+build.5', '10.20.30']) T0(`a stamp with the semantic version ${v} activates (any BS version, never exactly 3.1.0)`, { ...F03, [H.STAMP_REL]: STAMP(v) }, 'activate');
  T0('no stamp, one provenance sentence and the import of the same 03 activate (Q1, the existing-project path)', { ...F03, 'CLAUDE.md': BS_CLAUDE() }, 'activate', { accepted: ['claude-sentence'] });
  T0('the stamp and a matching sentence activate together', { ...F03, [H.STAMP_REL]: STAMP('3.1.0'), 'CLAUDE.md': BS_CLAUDE('3.1.0') }, 'activate', { accepted: ['stamp', 'claude-sentence'] });
  T0('the unfilled BS CLAUDE.md template (placeholder version) is held, not activated', { ...F03, 'CLAUDE.md': BS_CLAUDE_TEMPLATE }, 'hold');
  T0('a provenance sentence without the import of 03 is held', { ...F03, 'CLAUDE.md': 'Applied from the `backend-standards` skill, version `3.1.0`.\n' }, 'hold');
  T0('a provenance sentence with the import of a different architecture document is held', { ...F03, 'CLAUDE.md': '@docs/03-project-architecture.md\n\nApplied from the `backend-standards` skill, version `3.1.0`.\n' }, 'hold');
  T0('two identical provenance sentences are held (ambiguous)', { ...F03, 'CLAUDE.md': `${BS_CLAUDE('3.1.0')}\nApplied from the \`backend-standards\` skill, version \`3.1.0\`.\n` }, 'hold');
  T0('two provenance sentences with different versions are held', { ...F03, 'CLAUDE.md': `${BS_CLAUDE('3.1.0')}\nApplied from the \`backend-standards\` skill, version \`3.0.0\`.\n` }, 'hold');
  T0('a stamp whose version contradicts the sentence version is held', { ...F03, [H.STAMP_REL]: STAMP('3.1.0'), 'CLAUDE.md': BS_CLAUDE('3.0.0') }, 'hold');
  T0('a provenance sentence inside a fenced example is ignored, so 03 alone asks the owner', { ...F03, 'CLAUDE.md': '```\n@.ai/standards/03-project-architecture.md\nApplied from the `backend-standards` skill, version `3.1.0`.\n```\n' }, 'owner-disposition');
  for (const [label, text] of [['not JSON', '{nope'], ['a JSON array', '[]'], ['an empty file', ''], ['missing appliedBy', '{"version":"3.1.0"}'], ['missing version', '{"appliedBy":"backend-standards"}'], ['a two-part version', '{"version":"3.1","appliedBy":"backend-standards"}'], ['a v-prefixed version', '{"version":"v3.1.0","appliedBy":"backend-standards"}'], ['a numeric version', '{"version":3.1,"appliedBy":"backend-standards"}'], ['an empty version', '{"version":"","appliedBy":"backend-standards"}'], ['a null document', 'null']]) {
    T0(`a malformed stamp (${label}) is held`, { ...F03, [H.STAMP_REL]: text }, 'hold');
    T0(`a malformed stamp (${label}) is held even when a valid sentence and import agree (another signal cannot override the conflict)`, { ...F03, [H.STAMP_REL]: text, 'CLAUDE.md': BS_CLAUDE() }, 'hold');
  }
  T0('a stamp with a different appliedBy is held (conflicting provenance)', { ...F03, [H.STAMP_REL]: '{"version":"3.1.0","appliedBy":"other-tool"}' }, 'hold');
  T0('no accepted signal and no 03 uses the ordinary PS documentation rules', { 'README.md': '# x\n' }, 'ordinary', { fullDocuments: true });
  T0('03 alone is ambiguous: ask for a disposition and generate no competing full document', { ...F03 }, 'owner-disposition', { fullDocuments: false });
  T0('03 alone with the owner confirming it is unrelated uses ordinary rules with no automatic conversion', { ...F03 }, 'ordinary', { opts: { ownerDisposition: 'unrelated' }, fullDocuments: true });
  T0('the architecture filename alone elsewhere infers nothing (a 03-named file outside .ai/standards)', { 'docs/03-project-architecture.md': BS03 }, 'ordinary');
  T0('a valid stamp without 03 holds affected generation (incomplete BS documentation)', { [H.STAMP_REL]: STAMP() }, 'hold');
  T0('a valid sentence and import without 03 hold', { 'CLAUDE.md': BS_CLAUDE() }, 'hold');
  T0('a recorded owner decision without 03 holds', { 'AGENTS.md': DECISION_AGENTS() }, 'hold');
  T0('the exact owner decision and a readable 03 select the layout', { ...F03, 'AGENTS.md': DECISION_AGENTS() }, 'activate', { accepted: ['owner-decision'] });
  T0('the owner decision with a valid stamp activates with both signals accepted', { ...F03, [H.STAMP_REL]: STAMP(), 'AGENTS.md': DECISION_AGENTS() }, 'activate', { accepted: ['stamp', 'owner-decision'] });
  T0('the owner decision cannot override a malformed stamp', { ...F03, [H.STAMP_REL]: '{bad', 'AGENTS.md': DECISION_AGENTS() }, 'hold');
  T0('installed pointers with no accepted signal and a readable 03 are preserved and reported, never ordinary', { ...F03, 'docs/database.md': `# D\n\n${H.POINTER_MARKER}\n` }, 'preserve');
  T0('installed pointers with no signal and no 03 are preserved', { 'docs/database.md': `# D\n\n${H.POINTER_MARKER}\n` }, 'preserve');
  T0('installed pointers plus a valid stamp stay activated', { ...F03, [H.STAMP_REL]: STAMP(), 'docs/database.md': `# D\n\n${H.POINTER_MARKER}\n` }, 'activate');
  T0('a pointer installed under .ai/context and one under docs/integrations are both detected', { ...F03, '.ai/context/glossary.md': `# G\n\n${H.POINTER_MARKER}\n` }, 'preserve');
  T0('a pointer installed under docs/integrations is detected', { ...F03, 'docs/integrations/stripe.md': `# S\n\n${H.POINTER_MARKER}\n` }, 'preserve');
  // A failed read is never "absent".
  for (const [label, rel] of [['stamp', H.STAMP_REL], ['CLAUDE.md', 'CLAUDE.md'], ['AGENTS.md', 'AGENTS.md']]) {
    const files = { ...F03, ...(rel === 'CLAUDE.md' ? {} : { 'CLAUDE.md': BS_CLAUDE() }) };
    const root = mkProj(files); fs.mkdirSync(path.join(root, rel), { recursive: true });
    const r = attempt(() => H.classifyLayout(H.collectSignals(root)));
    G(`an unreadable ${label} (a directory in its place) is held, never treated as absent or ordinary`, r.threw === undefined && r.treatment === 'hold', r.threw ?? `got ${r.treatment}`);
  }
  { const root = mkProj({ [H.BS_03_REL]: BS03 }); fs.rmSync(path.join(root, H.BS_03_REL)); fs.mkdirSync(path.join(root, H.BS_03_REL), { recursive: true });
    const r = attempt(() => H.classifyLayout(H.collectSignals(root)));
    G('an unreadable 03 (a directory in its place) stops the affected step', r.threw === undefined && r.treatment === 'stop', r.threw ?? `got ${r.treatment}`); }
  for (const state of ['denied', 'unsafe', 'unreadable']) {
    const r = H.classifyLayout({ stamp: { state: 'valid', version: '3.1.0' }, claude: { state: 'absent', sentences: [], imports03: false, otherArchImports: [] }, agents: { state: 'absent', decision: { exact: 0, conflicting: [] } }, standards03: { state }, pointersInstalled: false, ownerDisposition: null });
    G(`a ${state} 03 stops the step even with a valid stamp (no bypass, no duplicate-document fallback)`, r.treatment === 'stop' && r.fullDocuments === false, `got ${r.treatment}`);
  }
  for (const state of ['denied', 'unsafe', 'unreadable']) {
    const r = H.classifyLayout({ stamp: { state }, claude: { state: 'absent', sentences: [], imports03: false, otherArchImports: [] }, agents: { state: 'absent', decision: { exact: 0, conflicting: [] } }, standards03: { state: 'readable' }, pointersInstalled: false, ownerDisposition: null });
    G(`a ${state} stamp read holds (a failed read does not establish absence)`, r.treatment === 'hold', `got ${r.treatment}`);
  }
  {
    const root = mkProj({ ...F03, 'real.json': STAMP(), 'realdir/keep.txt': 'x' });
    const linked = tryFileLink(path.join(root, 'real.json'), path.join(root, H.STAMP_REL)) || tryJunction(path.join(root, 'realdir'), path.join(root, H.STAMP_REL));
    if (!linked) skip('a stamp that is a symbolic link or junction is unsafe and held', 'neither a symbolic link nor a junction can be created on this host');
    else { const r = H.classifyLayout(H.collectSignals(root)); G('a stamp that is a symbolic link or junction is unsafe and held, never read through', r.treatment === 'hold', `got ${r.treatment}`); }
  }
  {
    const root = mkProj({ ...F03, [H.STAMP_REL]: STAMP() });
    const canary = 'PROJECT_SETUP_CANARY_0123456789abcdef01234567';
    putF(root, '.env', `TOKEN=${canary}\n`); putF(root, 'docs/.env.local', canary); putF(root, '.ai/standards/secrets/x.md', canary);
    const reads = []; const before = JSON.stringify(H.takeSnapshot(root).files);
    H.collectSignals(root, { reads });
    G('layout detection reads only the stamp, CLAUDE.md, AGENTS.md, 03 and pointer paths (the existing permitted-read boundary; no .env, no denied paths)', reads.every((r) => [H.STAMP_REL, 'CLAUDE.md', 'AGENTS.md', H.BS_03_REL].includes(r) || /^(\.ai\/context|docs|docs\/integrations)\/[^/]+\.md$/.test(r)) && !reads.some((r) => /\.env|secrets/.test(r)), reads);
    G('layout detection writes nothing: the explicit inventory is byte-identical before and after', JSON.stringify(H.takeSnapshot(root).files) === before);
    G('detection does not manufacture or repair a stamp', fs.existsSync(path.join(root, H.STAMP_REL)) && H.parseStamp(rd(path.join(root, H.STAMP_REL))).state === 'valid');
    const none = mkProj({ ...F03, 'AGENTS.md': DECISION_AGENTS() }); H.collectSignals(none);
    G('an owner decision does not manufacture a BS stamp (it records a layout, it does not prove BS ran)', !fs.existsSync(path.join(none, H.STAMP_REL)));
  }
  G('stamp parsing: only a plain object with a semantic version and appliedBy is valid', H.parseStamp(STAMP()).state === 'valid' && ['', '1', '"x"', '[]', '{"version":"1.0.0"}'].every((t) => H.parseStamp(t).state === 'malformed'));
}

// ============================================================== GROUP: durable decision ====
{
  const G = grp('Durable decision');
  const rec = (text) => H.findDecisionRecords(text);
  G('the exact standalone sentence outside managed blocks counts once', rec(`# s\n\n${H.DECISION_SENTENCE}\n`).exact === 1);
  G('a CRLF file still counts (EOL boundary)', rec(`# s\r\n\r\n${H.DECISION_SENTENCE}\r\n`).exact === 1);
  G('the sentence with no trailing newline counts (boundary)', rec(`# s\n${H.DECISION_SENTENCE}`).exact === 1);
  G('the sentence in a fenced example does not count', rec(`# s\n\n\`\`\`\n${H.DECISION_SENTENCE}\n\`\`\`\n`).exact === 0);
  G('the sentence inside a managed block does not count', rec(`<!-- project-setup:begin id=critical-rules -->\n${H.DECISION_SENTENCE}\n<!-- project-setup:end id=critical-rules -->\n`).exact === 0);
  G('a quoted (blockquote) sentence does not count', rec(`> ${H.DECISION_SENTENCE}\n`).exact === 0);
  G('a list-item sentence does not count', rec(`- ${H.DECISION_SENTENCE}\n`).exact === 0);
  G('an indented (nested) sentence does not count', rec(`  ${H.DECISION_SENTENCE}\n`).exact === 0);
  G('a sentence embedded in a longer line does not count', rec(`Note that ${H.DECISION_SENTENCE} was agreed.\n`).exact === 0);
  G('a differently cased approximation is not a decision and not a conflict', (() => { const r = rec(`${H.DECISION_SENTENCE.replace('Documentation', 'documentation')}\n`); return r.exact === 0 && r.conflicting.length === 0; })());
  for (const [label, line] of [['shortened wording', 'Documentation layout decision: use 03 as the source of truth.'], ['a missing final period', H.DECISION_SENTENCE.slice(0, -1)], ['trailing words', `${H.DECISION_SENTENCE} Thanks.`], ['a different path', H.DECISION_SENTENCE.replace('.ai/standards/03-project-architecture.md', 'docs/architecture.md')]]) G(`approximate wording (${label}) is a conflicting record, never a decision`, (() => { const r = rec(`${line}\n`); return r.exact === 0 && r.conflicting.length === 1; })());
  const dup = attempt(() => layoutOf({ ...F03, 'AGENTS.md': `${H.DECISION_SENTENCE}\n\n${H.DECISION_SENTENCE}\n` }));
  G('duplicated exact decision records are held for disposition', dup.treatment === 'hold', dup.threw ?? dup.treatment);
  const mix = attempt(() => layoutOf({ ...F03, 'AGENTS.md': `${H.DECISION_SENTENCE}\n\nDocumentation layout decision: use docs/architecture.md.\n` }));
  G('an exact record beside a conflicting one is held, never silently chosen', mix.treatment === 'hold', mix.threw ?? mix.treatment);
  for (const rel of ['CLAUDE.md', 'README.md', 'docs/decision.md', 'src/wallet/AGENTS.md', '.ai/context/glossary.md']) {
    const r = attempt(() => layoutOf({ ...F03, [rel]: `${H.DECISION_SENTENCE}\n` }));
    G(`the sentence in ${rel} (not root AGENTS.md) does not count as the decision`, r.treatment === 'owner-disposition', r.threw ?? r.treatment);
  }
  G('a decision inside a managed block leaves 03 alone, so the owner is asked again', (() => { const r = layoutOf({ ...F03, 'AGENTS.md': `<!-- project-setup:begin id=overview -->\n${H.DECISION_SENTENCE}\n<!-- project-setup:end id=overview -->\n` }); return r.treatment === 'owner-disposition'; })());
  {
    const agents = DECISION_AGENTS('\n<!-- project-setup:begin id=critical-rules -->\n- rule\n<!-- project-setup:end id=critical-rules -->\n');
    let t = agents;
    for (const id of ['overview', 'critical-rules']) t = upsertBlock(t, id, `${id} rewritten by a rerun`, 'md');
    t = upsertBlock(t, 'navigation', 'new block appended by a rerun', 'md');
    G('a rerun that rewrites or appends managed blocks preserves the decision sentence outside them', rec(t).exact === 1 && t.includes(`${H.DECISION_SENTENCE}\n`), 'the sentence must survive block upserts');
    const o = parseBlocks(t); G('the decision sentence is outside every managed block after a rerun', o.errors.length === 0 && o.blocks.every((b) => !b.inner.includes(H.DECISION_PREFIX)));
  }
}

// ============================================================== GROUP: source-derived skeleton ====
{
  const G = grp('Source-derived skeleton');
  NEEDS(G, 'the skeleton and relative-path table are extracted from the actual docs-generation reference', [SK, PTB], () => true);
  NEEDS(G, 'every placeholder of the skeleton is filled by expansion and none remain', [SK], () => { const t = H.expandSkeleton(SKEL, { title: 'T', relPath: '../standards/03-project-architecture.md', bullets: ['Database'], scope: 'scope' }); return !/\{\{/.test(t) && t.endsWith('\n') && !t.endsWith('\n\n'); });
  NEEDS(G, 'an expanded pointer parses back to the exact field values (round trip through the extracted skeleton)', [SK], () => { const t = H.expandSkeleton(SKEL, { title: 'My Title', relPath: '../standards/03-project-architecture.md', bullets: ['Database', 'Database > Schema changes'], scope: 'my scope' }); const p = H.parsePointerText(t, SKEL); return p.ok && p.fields.TITLE === 'My Title' && p.fields.TOPIC_OR_VENDOR === 'my scope' && JSON.stringify(p.fields.bullets) === JSON.stringify(['- Database', '- Database > Schema changes']) ? true : p; });
  NEEDS(G, 'a text that is not the skeleton is rejected by the template parse', [SK], () => !H.parsePointerText('# T\n\nsome other file\n', SKEL).ok);
  NEEDS(G, 'the skeleton has the marker once, the four placeholders in order, no managed-block marker', [SK], () => skeletonProblems(SKEL).length === 0 || skeletonProblems(SKEL));
  NEEDS(G, 'every one of the ten frozen routing obligations (the nine MUST duties and the write-boundary sentence) is carried by the skeleton', [SK], () => { const s = H.squash(SKEL); const miss = H.ROUTING_OBLIGATIONS.filter(([, re]) => !re.test(s)).map(([n]) => n); return H.ROUTING_OBLIGATIONS.length === 10 && miss.length === 0 ? true : miss; });
  NEEDS(G, 'the pointer marker is distinct from the managed-block marker grammar (no managed block is parsed from a pointer)', [SK], () => { const p = parseBlocks(pointerOf('docs/database.md')); return p.errors.length === 0 && p.blocks.length === 0; });
  G('the heading-level facts the spec relies on match the actual BS 03 (level-1 title, numbered level-2 sections)', DOC03.headings[0].level === 1 && DOC03.topLevel === 2 && DOC03.headings.filter((h) => h.level === 2).length === 15);
}

// ============================================================== GROUP: headings ====
{
  const G = grp('Headings');
  const resolve = (ref, doc = DOC03) => H.resolveHeading(doc, H.parseBulletRef(ref)).status;
  G('normalization removes an optional leading section number and keeps meaning', H.normalizeHeadingName('7. Database') === 'Database' && H.normalizeHeadingName('7 Database') === 'Database' && H.normalizeHeadingName('10.2. Foo bar') === 'Foo bar' && H.normalizeHeadingName('Database') === 'Database');
  G('normalization collapses whitespace but keeps parenthetical cross-references', H.normalizeHeadingName('  8.   Cache,   locks   and queues ') === 'Cache, locks and queues' && H.normalizeHeadingName('Money (`01` §6)') === 'Money (`01` §6)' && H.normalizeHeadingName('Retention (`02` §3)') === 'Retention (`02` §3)');
  G('a title that merely starts with a number and a dash keeps it', H.normalizeHeadingName('03 — Project Architecture') === '03 — Project Architecture');
  const allRefs = [...new Set(Object.values(H.POINTER_DOCS).flat())];
  G(`every destination the plan maps resolves in the actual BS 03 template (${allRefs.length} distinct destinations)`, allRefs.every((r) => resolve(r) === 'ok'), allRefs.filter((r) => resolve(r) !== 'ok'));
  for (const r of ['Database > Schema changes', 'Database > Money (`01` §6)', 'Observability > Retention (`02` §3)']) G(`the subordinate heading ${r} resolves inside its named parent`, resolve(r) === 'ok');
  G('the actual 03 has exactly three subordinate headings the mapping names, under Database and Observability', ['Schema changes', 'Money (`01` §6)', 'Retention (`02` §3)'].every((n) => DOC03.headings.filter((h) => h.name === n).length === 1));
  G('a subordinate heading is never resolved without its parent', ['Schema changes', 'Money (`01` §6)', 'Retention (`02` §3)'].every((n) => resolve(n) === 'needs-parent'));
  G('a subordinate heading under the wrong parent is missing, not guessed', resolve('Observability > Schema changes') === 'missing' && resolve('Database > Retention (`02` §3)') === 'missing');
  G('Money without its parenthetical, and with a changed cross-reference, do not resolve (parentheses are meaningful)', resolve('Database > Money') === 'missing' && resolve('Database > Money (`01` §7)') === 'missing' && resolve('Database > Money (01 §6)') === 'missing');
  G('matching is exact: a different case or a near name is not chosen', ['database', 'Databases', 'DATABASE', 'Data base', 'Module  layouts'].every((r) => resolve(r) === 'missing'));
  const withDecoy = `${BS03}\n\`\`\`md\n## 99. Decoy\n### Money (\`01\` §6)\n\`\`\`\n`;
  G('headings inside fenced code are not headings (the real 03 has a fenced "# <the commands ..." line)', resolve('Decoy', H.parseHeadingDoc(withDecoy)) === 'missing' && resolve('Database > Money (`01` §6)', H.parseHeadingDoc(withDecoy)) === 'ok' && !DOC03.headings.some((h) => /commands that actually work/.test(h.raw)));
  const m = (fn) => H.parseHeadingDoc(fn(BS03));
  const renumbered = m((t) => t.replace(/^## (\d+)\. /gm, (a, n) => `## ${Number(n) + 1}. `));
  G('renumbered sections still resolve every destination (matching is by heading text, not number)', allRefs.every((r) => resolve(r, renumbered) === 'ok'));
  const unnumbered = m((t) => t.replace(/^## \d+\. /gm, '## '));
  G('unnumbered sections still resolve every destination', allRefs.every((r) => resolve(r, unnumbered) === 'ok'));
  const spaced = m((t) => t.replace(/^## 7\. Database$/m, '##   7.    Database   ').replace(/^## 8\. Cache, locks and queues$/m, '## 8.  Cache,  locks   and queues'));
  G('extra whitespace in headings does not change resolution', resolve('Database', spaced) === 'ok' && resolve('Cache, locks and queues', spaced) === 'ok');
  G('a renamed destination is missing (held, no similar heading chosen)', resolve('Database', m((t) => t.replace(/^## 7\. Database$/m, '## 7. Persistence'))) === 'missing');
  G('a removed parent heading makes its subordinate destinations missing', resolve('Database > Schema changes', m((t) => t.replace(/^## 7\. Database\n/m, ''))) === 'missing');
  G('a duplicated top-level destination is ambiguous', resolve('Database', m((t) => `${t}\n## 16. Database\n\nx\n`)) === 'ambiguous');
  G('a duplicated subordinate destination is ambiguous', resolve('Database > Schema changes', m((t) => t.replace(/^### Schema changes$/m, '### Schema changes\n\nx\n\n### Schema changes'))) === 'ambiguous');
  G('a duplicated parent is ambiguous for its subordinate destination', resolve('Database > Schema changes', m((t) => `${t}\n## 16. Database\n\n### Schema changes\n\nx\n`)) === 'ambiguous');
  G('distinct destinations that differ only by a parenthetical both resolve (removing parentheses would collapse them)', (() => { const d = H.parseHeadingDoc('# T\n\n## 1. Database\n\n### Money\n\n### Money (`01` §6)\n'); return resolve('Database > Money', d) === 'ok' && resolve('Database > Money (`01` §6)', d) === 'ok' && d.headings.find((h) => h.raw === 'Money').index !== d.headings.find((h) => h.raw.startsWith('Money (')).index; })());
  G('a document with no numbered body headings still resolves at its own top level', resolve('Database', H.parseHeadingDoc('# T\n\n## Database\n\n### Schema changes\n')) === 'ok');
  G('an empty or unreadable source resolves nothing', resolve('Database', H.parseHeadingDoc('')) === 'missing');
  G('section text reaches its subsections but stops at the next top-level heading', (() => { const h = H.resolveHeading(DOC03, { name: 'Database' }).heading; const s = H.sectionText(DOC03, h); const next = H.resolveHeading(DOC03, { name: 'Cache, locks and queues' }).heading; return s.includes('Schema changes') && !s.includes(next.raw) && H.sectionText(DOC03, next).length > 0; })());
  // Pointer-level: bad destinations in an existing pointer are found by the checker (and by nothing else: see Validation).
  NEEDS(G, 'a pointer naming a missing heading fails the checker with heading-missing', [SK, PTB], () => has(inspect('docs/database.md', pointerOf('docs/database.md', { bullets: [...H.mappingRefsFor('docs/database.md'), 'Persistence'] })), 'heading-missing'));
  NEEDS(G, 'a pointer whose destination became ambiguous fails the checker with heading-ambiguous', [SK, PTB], () => has(inspect('docs/database.md', pointerOf('docs/database.md'), H.parseHeadingDoc(`${BS03}\n## 16. Database\n\nx\n`)), 'heading-ambiguous'));
  NEEDS(G, 'a pointer naming a subordinate heading without its parent fails the checker', [SK, PTB], () => has(inspect('docs/database.md', pointerOf('docs/database.md', { bullets: ['Database', 'Schema changes', 'Database > Money (`01` §6)', 'Module layout'] })), 'heading-parent-required'));
  NEEDS(G, 'a pointer for a renumbered 03 still passes (reproduces the actual resolved names)', [SK, PTB], () => inspect('docs/database.md', pointerOf('docs/database.md'), renumbered).length === 0);
  NEEDS(G, 'a pointer that reproduces a heading with its section number fails (names must be the normalized actual names)', [SK, PTB], () => has(inspect('docs/database.md', pointerOf('docs/database.md', { bullets: ['7. Database', 'Database > Schema changes', 'Database > Money (`01` §6)', 'Module layout'] })), 'heading-not-normalized'));
  NEEDS(G, 'a pointer that keeps extra whitespace inside a heading name fails the checker (names must be the normalized actual names)', [SK, PTB], () => has(inspect('docs/database.md', pointerOf('docs/database.md', { bullets: ['Database', 'Database > Schema  changes', 'Database > Money (`01` §6)', 'Module layout'] })), 'heading-not-normalized'));
}

// ============================================================== GROUP: paths ====
const ptrProject = (rel, text, o = {}) => { const root = scratch('ptr'); if (o.with03 !== false) putF(root, H.BS_03_REL, BS03); putF(root, rel, text); return root; };
const inspectFile = (root, rel) => H.inspectPointerFile(root, rel, { skeleton: SKEL, pathTable: PT });
const CANARY = 'PROJECT_SETUP_CANARY_0123456789abcdef01234567';
{
  const G = grp('Paths');
  for (const rel of ['.ai/context/glossary.md', 'docs/database.md', VENDOR]) NEEDS(G, `a valid pointer at ${path.posix.dirname(rel)}/ resolves to the one 03 and the file passes all checks`, [SK, PTB], () => { const root = ptrProject(rel, pointerOf(rel)); const r = inspectFile(root, rel); return r.findings.length === 0 && r.reads.includes(rel) && r.reads.includes(H.BS_03_REL) ? true : r; });
  const WRONG = [
    ['.ai/context/glossary.md', '../.ai/standards/03-project-architecture.md', 'wrong-depth', 'a docs/-depth link from .ai/context/'],
    ['docs/database.md', '.ai/standards/03-project-architecture.md', 'wrong-depth', 'a repository-root link from docs/'],
    [VENDOR, '../.ai/standards/03-project-architecture.md', 'wrong-depth', 'a docs/-depth link from docs/integrations/'],
    ['docs/database.md', '../../.ai/standards/03-project-architecture.md', 'escape', 'an integrations-depth link from docs/ (escapes the repository)'],
    [VENDOR, '../../../.ai/standards/03-project-architecture.md', 'escape', 'one level too many from docs/integrations/ (escapes the repository)'],
    ['.ai/context/glossary.md', '../../../x/03-project-architecture.md', 'escape', 'a link out of the repository from .ai/context/'],
    ['.ai/context/glossary.md', '../../.ai/standards/03-project-architecture.md', 'noncanonical-path', 'a link that resolves to 03 but is not the table value'],
    ['docs/database.md', '../docs/../.ai/standards/03-project-architecture.md', 'noncanonical-path', 'a dotted link that resolves to 03 but is not the table value'],
    ['docs/database.md', '../docs/other.md', 'wrong-target', 'a link to another document'],
    ['docs/database.md', 'https://example.com/03-project-architecture.md', 'unsafe-path', 'a URL'],
    ['docs/database.md', 'file:///etc/passwd', 'unsafe-path', 'a file URL'],
    ['docs/database.md', '/etc/passwd', 'unsafe-path', 'an absolute path'],
    ['docs/database.md', 'C:\\temp\\03-project-architecture.md', 'unsafe-path', 'a drive-letter path'],
    ['docs/database.md', '..\\.ai\\standards\\03-project-architecture.md', 'unsafe-path', 'a backslash path'],
  ];
  for (const [rel, link, code, label] of WRONG) NEEDS(G, `${label} is rejected as ${code}`, [SK, PTB], () => { const root = ptrProject(rel, pointerOf(rel, { relPath: link })); const r = inspectFile(root, rel); return has(r.findings, code) ? true : r.findings; });
  for (const rel of ['src/overview.md', '.ai/decisions/adr.md', 'docs/sub/x.md', 'docs/integrations/a/b.md', 'README.md', 'docs/business-rules/transfer.md']) NEEDS(G, `a pointer in an unsupported directory (${rel}) is rejected`, [SK, PTB], () => { const root = ptrProject(rel, pointerOf(rel, { relPath: '../standards/03-project-architecture.md' })); return has(inspectFile(root, rel).findings, 'unsupported-directory') ? true : inspectFile(root, rel).findings; });
  NEEDS(G, 'a pointer whose 03 is absent reports a missing source', [SK, PTB], () => { const rel = 'docs/database.md'; const root = ptrProject(rel, pointerOf(rel), { with03: false }); const f = inspectFile(root, rel).findings; return has(f, 'missing-source') ? true : f; });
  NEEDS(G, 'a missing pointer file is reported as missing', [SK, PTB], () => has(inspectFile(scratch('empty'), 'docs/database.md').findings, 'missing-pointer'));
  for (const rel of ['docs/.env.local', 'docs/secrets/x.md', 'docs/server.pem', '.ai/context/.env']) NEEDS(G, `a pointer at the policy-denied path ${rel} is refused without being read`, [SK, PTB], () => { const root = ptrProject(rel, `${CANARY}\n`); const r = inspectFile(root, rel); return has(r.findings, 'forbidden') && r.reads.length === 0 && !JSON.stringify(r).includes(CANARY) ? true : r; });
  for (const [link, label] of [['../.env', '.env'], ['../secrets/03-project-architecture.md', 'a secrets/ directory'], ['../server.pem', 'a .pem file']]) NEEDS(G, `a link that resolves to ${label} is refused and the target is never read`, [SK, PTB], () => { const rel = 'docs/database.md'; const root = ptrProject(rel, pointerOf(rel, { relPath: link })); putF(root, '.env', `${CANARY}\n`); putF(root, 'secrets/03-project-architecture.md', CANARY); putF(root, 'server.pem', CANARY); const r = inspectFile(root, rel); return has(r.findings, 'forbidden') && !r.reads.some((x) => /\.env|secrets|\.pem/.test(x)) && !JSON.stringify(r).includes(CANARY) ? true : r; });
  NEEDS(G, 'a pointer directory that is a junction is refused (no traversal through links)', [SK, PTB], () => {
    const rel = 'docs/database.md'; const root = scratch('lnk'); putF(root, H.BS_03_REL, BS03); putF(root, 'elsewhere/database.md', pointerOf(rel));
    if (!tryJunction(path.join(root, 'elsewhere'), path.join(root, 'docs'))) return true;
    const r = inspectFile(root, rel); return has(r.findings, 'link') && r.reads.length === 0 ? true : r;
  });
  NEEDS(G, 'a 03 directory that is a junction is refused (the link is not followed)', [SK, PTB], () => {
    const rel = 'docs/database.md'; const root = scratch('lnk2'); putF(root, rel, pointerOf(rel)); putF(root, 'elsewhere/03-project-architecture.md', BS03);
    fs.mkdirSync(path.join(root, '.ai'), { recursive: true });
    if (!tryJunction(path.join(root, 'elsewhere'), path.join(root, '.ai', 'standards'))) return true;
    const r = inspectFile(root, rel); return has(r.findings, 'link') && !r.reads.includes(H.BS_03_REL) ? true : r;
  });
  G('the link-containment controls ran on this host (a junction or symbolic link could be created)', (() => { const root = scratch('probe'); fs.mkdirSync(path.join(root, 'a')); return tryJunction(path.join(root, 'a'), path.join(root, 'b')) || tryFileLink(path.join(root, 'a'), path.join(root, 'c')); })(), 'link controls above were vacuous on this host');
  G('every lstat chain classifies a plain path ok, a missing path absent, and a junction link', (() => { const root = scratch('chain'); putF(root, 'a/b.md', 'x'); fs.mkdirSync(path.join(root, 'real')); const j = tryJunction(path.join(root, 'real'), path.join(root, 'lnk')); return H.lstatChain(root, 'a/b.md') === 'ok' && H.lstatChain(root, 'a/none.md') === 'absent' && (!j || (H.lstatChain(root, 'lnk') === 'link' && H.lstatChain(root, 'lnk/x.md') === 'link')); })());
  G('relative traversal, absolute and backslash paths are refused before any read', (() => { const root = scratch('rel'); return ['../x', '/etc/passwd', 'a\\b', 'C:/x', 'a/../b', '', 'a//b'].every((rel) => H.readPermitted(root, rel).state === 'unsafe'); })());
}

// ============================================================== GROUP: format ====
const ORIGINAL_OF = (rel) => pointerOf(rel);
{
  const G = grp('Format');
  const REL = 'docs/database.md';
  NEEDS(G, 'a valid pointer for each mapped family passes with zero findings', [SK, PTB], () => { const bad = ALL_POINTER_RELS.map((r) => [r, inspect(r, pointerOf(r))]).filter(([, f]) => f.length > 0); return bad.length === 0 ? true : bad; });
  NEEDS(G, 'a valid pointer with CRLF line endings passes (EOL boundary)', [SK, PTB], () => inspect(REL, pointerOf(REL).replace(/\n/g, '\r\n')).length === 0);
  NEEDS(G, 'a valid pointer without a trailing newline passes (boundary)', [SK, PTB], () => inspect(REL, pointerOf(REL).replace(/\n+$/, '')).length === 0);
  NEEDS(G, 'a valid pointer with extra blank lines between blocks passes (whitespace is not content)', [SK, PTB], () => inspect(REL, pointerOf(REL).replace(/\n\n/g, '\n\n\n')).length === 0);
  const MUT = [
    ['the pointer marker removed', (t) => t.replace(H.POINTER_MARKER, ''), 'marker'],
    ['the pointer marker duplicated', (t) => t.replace(H.POINTER_MARKER, `${H.POINTER_MARKER}\n${H.POINTER_MARKER}`), 'marker'],
    ['a different marker version (v=2)', (t) => t.replace('v=1', 'v=2'), 'marker'],
    ['a managed-block begin marker added', (t) => t.replace(H.POINTER_MARKER, `${H.POINTER_MARKER}\n<!-- project-setup:begin id=pointer -->`), 'managed-block'],
    ['a managed-block end marker added', (t) => `${t}\n<!-- project-setup:end id=pointer -->\n`, 'managed-block'],
    ['an unresolved placeholder appended', (t) => `${t}\n{{LEFTOVER}}\n`, 'placeholder'],
    ['an unresolved placeholder as the title', (t) => t.replace(/^# .*$/m, '# {{TITLE}}'), 'placeholder'],
    ['a table in the bullets (navigation-only)', (t) => t.replace('Sections:\n', 'Sections:\n| a | b |\n'), 'non-navigation'],
    ['a timestamp in the scope (navigation-only)', (t) => t.replace(/^Scope: .*$/m, 'Scope: database documentation updated 2026-11-11.'), 'non-navigation'],
    ['a clock time in the scope (navigation-only)', (t) => t.replace(/^Scope: .*$/m, 'Scope: database documentation at 12:30.'), 'non-navigation'],
    ['a hash in the scope (navigation-only)', (t) => t.replace(/^Scope: .*$/m, `Scope: database ${'a'.repeat(40)}.`), 'non-navigation'],
    ['a factual paragraph appended (facts added to a pointer)', (t) => `${t}\nThe wallet table has 12 columns.\n`, 'template'],
    ['a factual paragraph inserted before the routing text', (t) => t.replace(/\n\nReaders and agents MUST follow the source link/, '\n\nThe wallet table has 12 columns.\n\nReaders and agents MUST follow the source link'), 'template'],
    ['the source-of-truth line removed', (t) => t.replace(/Source of truth: .*\n\n/, ''), 'template'],
    ['the Sections: label removed', (t) => t.replace('Sections:\n', ''), 'template'],
    ['the Scope: label removed', (t) => t.replace(/^Scope: /m, ''), 'template'],
    ['an empty title', (t) => t.replace(/^# .*$/m, '#'), 'template', 'title'],
    ['an empty scope', (t) => t.replace(/^Scope: .*\./m, 'Scope: .'), 'template', 'scope'],
    ['no section bullets', (t) => t.replace(/Sections:\n[\s\S]*?\n\nScope:/, 'Sections:\n\nScope:'), 'template', 'no-sections'],
    ['a duplicated section bullet', (t) => t.replace('- Database\n', '- Database\n- Database\n'), 'bullet-duplicate'],
    ['a section line that is not a bullet', (t) => t.replace(/^- Module layout$/m, '* Module layout'), 'bullet-format'],
    ['a mapped section left out', (t) => t.replace(/^- Module layout\n/m, ''), 'bullet-missing'],
    ['a section that does not exist in 03', (t) => t.replace('- Database\n', '- Database\n- Persistence layer\n'), 'heading-missing'],
    ['a copied fact in a section bullet', (t) => t.replace('- Database\n', '- Database: 12 tables, all with soft delete\n'), 'heading-missing'],
  ];
  for (const [label, fn, code, alt] of MUT) NEEDS(G, `${label} is detected`, [SK, PTB], () => { const t = pointerOf(REL); const m = fn(t); if (m === t) return 'mutation did not apply'; const f = inspect(REL, m); return has(f, code) || (alt !== undefined && has(f, alt)) ? true : f; });
  NEEDS(G, 'a vendor pointer whose scope does not identify the vendor is detected', [SK, PTB], () => has(inspect(VENDOR, pointerOf(VENDOR, { scope: 'payments documentation' })), 'vendor-scope'));
  NEEDS(G, 'a vendor pointer must carry both mapped sections (Outbound integrations and Observability)', [SK, PTB], () => has(inspect(VENDOR, pointerOf(VENDOR, { bullets: ['Outbound integrations'] })), 'bullet-missing'));
  NEEDS(G, 'a pointer with a title only of whitespace or a different placeholder order is not accepted as the skeleton', [SK, PTB], () => has(inspect(REL, pointerOf(REL).replace('Source of truth: ', 'Scope: x.\n\nSource of truth: ')), 'template'));
  // Routing obligations: delete and weaken each of the nine frozen clauses.
  for (const [name, re] of H.ROUTING_OBLIGATIONS) {
    NEEDS(G, `deleting the routing obligation "${name}" is detected`, [SK, PTB], () => { const t = pointerOf(REL); const m = tolerant(re).exec(t); if (m === null) return 'obligation not found in the expanded skeleton'; return inspect(REL, t.replace(m[0], '')).some((f) => f.code === 'routing' && f.detail.includes(name)) ? true : 'not detected'; });
    if (/MUST/.test(re.source)) NEEDS(G, `weakening MUST in the routing obligation "${name}" is detected`, [SK, PTB], () => { const t = pointerOf(REL); const m = tolerant(re).exec(t); if (m === null) return 'obligation not found in the expanded skeleton'; return inspect(REL, t.replace(m[0], m[0].replace(/MUST NOT/, 'SHOULD NOT').replace(/MUST/, 'SHOULD'))).some((f) => f.code === 'routing' && f.detail.includes(name)) ? true : 'not detected'; });
  }
}

// ============================================================== GROUP: read-only duty ====
{
  const G = grp('Read-only duty');
  const REL = 'docs/database.md';
  const detect = (phrase, to, name) => () => { const t = pointerOf(REL); const m = phraseRe(phrase).exec(t); if (m === null) return 'the phrase is not in the expanded skeleton'; const f = inspect(REL, t.slice(0, m.index) + to + t.slice(m.index + m[0].length)); return f.some((x) => x.code === 'routing' && x.detail.includes(name)) ? true : f; };
  NEEDS(G, 'the expanded pointer carries both halves of the split duty: read-only agents report in their output and must not write', [SK, PTB], () => { const s = H.squash(pointerOf(REL)); return /Read-only agents MUST report the gap in their output/.test(s) && /MUST NOT create, modify or delete files/.test(s) && /documentation-writing agents MUST record the gap in the repository-root TODO\.md within their authorized scope/.test(s) ? true : 'a half of the duty is missing'; });
  NEEDS(G, 'deleting the read-only output-reporting duty from a pointer is detected', [SK, PTB], detect('Read-only agents MUST report the gap in their output', '', 'read-only-reports'));
  NEEDS(G, 'weakening the read-only output-reporting duty (MUST to SHOULD) is detected', [SK, PTB], detect('Read-only agents MUST report the gap in their output', 'Read-only agents SHOULD report the gap in their output', 'read-only-reports'));
  NEEDS(G, 'weakening the read-only output-reporting duty (MUST to MAY) is detected', [SK, PTB], detect('Read-only agents MUST report the gap in their output', 'Read-only agents MAY report the gap in their output', 'read-only-reports'));
  NEEDS(G, 'deleting MUST NOT create, modify or delete files from a pointer is detected', [SK, PTB], detect('and MUST NOT create, modify or delete files', '', 'read-only-no-write'));
  NEEDS(G, 'weakening MUST NOT write to SHOULD NOT is detected', [SK, PTB], detect('MUST NOT create, modify or delete files', 'SHOULD NOT create, modify or delete files', 'read-only-no-write'));
  NEEDS(G, 'restoring the unconditional TODO-write obligation (no documentation-writing qualifier) is detected', [SK, PTB], detect('documentation-writing agents MUST record the gap in the repository-root TODO.md within their authorized scope', 'agents MUST record the gap in the repository-root TODO.md within their authorized scope', 'writer-records-gap'));
  NEEDS(G, 'restoring the old single obligation for all agents (MUST record the gap in TODO.md) is detected', [SK, PTB], detect('documentation-writing agents MUST record the gap in the repository-root TODO.md within their authorized scope', 'all agents MUST record the gap in the repository-root TODO.md', 'writer-records-gap'));
  NEEDS(G, 'dropping the other-readers duty is detected', [SK, PTB], detect('Other readers MUST report the gap to the documentation owner.', '', 'other-readers'));
  NEEDS(G, 'a reviewer wrapper that forbids writes does not conflict with the pointer duty (wrappers state no write tools)', [], () => /read-only|Do not (edit|write|modify)|MUST NOT (create|modify|write)|no (Edit|Write)/i.test(`${WRAPPER.reviewer}\n${rd(path.join(SKILL, 'assets', 'wrappers', 'codex-reviewer.toml'))}`));
}

// ============================================================== GROUP: coverage and blanks ====
const insertUnder = (text, ref, line) => {
  const doc = H.parseHeadingDoc(text);
  const r = H.resolveHeading(doc, H.parseBulletRef(ref));
  if (r.status !== 'ok') throw new Error(`cannot place under ${ref}: ${r.status}`);
  const lines = doc.lines.slice();
  lines.splice(r.heading.line + 1, 0, '', line);
  return lines.join('\n');
};
{
  const G = grp('Coverage/blanks');
  const refs = [...new Set(Object.values(H.POINTER_DOCS).flat())];
  const tmpl = H.checkBlankSections({ doc03Text: BS03, refs });
  G('the unfilled BS 03 template has mapped sections that still hold blanks, and the checker finds them', tmpl.some((f) => f.code === 'blank-section'), tmpl);
  const unknownFilled = BS03.replace(/`<[^`\n>]+>`/g, 'unknown');
  G('replacing every blank with an explicit unknown clears the blank findings (explicit unknowns are allowed)', H.checkBlankSections({ doc03Text: unknownFilled, refs }).length === 0, H.checkBlankSections({ doc03Text: unknownFilled, refs }));
  G('a blank line carrying "not determined" or "not verified" is an explicit unknown, a bare blank is not', (() => { const t = '# T\n\n## 3. Configuration\n\n- `<VAR>` — not determined\n- `<ROUTE>` — not verified from code\n'; const u = '# T\n\n## 3. Configuration\n\n- `<VAR>`\n'; return H.checkBlankSections({ doc03Text: t, refs: ['Configuration'] }).length === 0 && has(H.checkBlankSections({ doc03Text: u, refs: ['Configuration'] }), 'blank-section'); })());
  G('a section filled with evidence has no blank finding', H.checkBlankSections({ doc03Text: '# T\n\n## 3. Configuration\n\n- WALLET_LOCK_TTL_MS: optional, number\n', refs: ['Configuration'] }).length === 0);
  G('a blank in an unmapped section does not count against a mapped one', H.checkBlankSections({ doc03Text: '# T\n\n## 3. Configuration\n\nfilled\n\n## 4. Module layout\n\n- `<path>`\n', refs: ['Configuration'] }).length === 0);
  G('a mapped destination that does not exist is reported, not skipped', has(H.checkBlankSections({ doc03Text: '# T\n\n## 3. Configuration\n\nx\n', refs: ['Database'] }), 'destination-missing'));
  G('a blank in a subordinate mapped section is found inside its parent', has(H.checkBlankSections({ doc03Text: BS03, refs: ['Database > Schema changes'] }), 'blank-section') || H.checkBlankSections({ doc03Text: BS03, refs: ['Database > Schema changes'] }).length === 0);
  NEEDS(G, 'a pointer lists every mapped section of its PS document (a missing mapped bullet is a finding)', [SK, PTB], () => Object.keys(H.POINTER_DOCS).every((rel) => { const refsOf = H.mappingRefsFor(rel); return refsOf.every((r) => has(inspect(rel, pointerOf(rel, { bullets: refsOf.filter((x) => x !== r) })), 'bullet-missing')); }));
  G('the checker proves only the independently enumerated inventory: an unlisted lost fact is outside its scope, so live review stays required', H.checkConsolidation({ doc03Text: BS03, inventory: [] }).length === 0);
}

// ============================================================== GROUP: existing content ====
const INV = [
  { id: 'cfg-1', doc: '.ai/context/configuration.md', token: 'WALLET_LOCK_TTL_MS optional number read by WalletService', ref: 'Configuration', kind: 'config' },
  { id: 'tx-1', doc: 'docs/database.md', token: 'transfer debits and credits inside one serializable transaction', ref: 'Database', kind: 'transaction' },
  { id: 'err-1', doc: '.ai/context/error-contract.md', token: 'WALLET_LOCKED is transformed to HTTP 423 by the global filter', ref: 'API surface', kind: 'error' },
  { id: 'int-1', doc: 'docs/integrations/stripe.md', token: 'Stripe webhook retries are deduplicated by event id', ref: 'Outbound integrations', kind: 'integration' },
  { id: 'inv-1', doc: '.ai/context/critical-modules.md', token: 'Lock order is wallet then ledger and never the reverse', ref: 'Cache, locks and queues', kind: 'invariant' },
  { id: 'money-1', doc: 'docs/database.md', token: 'money is stored as integer minor units', ref: 'Database > Money (`01` §6)', kind: 'money' },
  { id: 'glos-1', doc: '.ai/context/glossary.md', token: 'a hold is a reserved amount not yet captured', ref: 'Domain glossary', kind: 'glossary' },
  { id: 'full-1', doc: '.ai/context/code-patterns.md', token: 'Use the Result helper for service returns', fullDocument: '.ai/context/code-patterns.md', kind: 'pattern' },
];
const FULLDOCS = { '.ai/context/code-patterns.md': '# Code patterns\n\nUse the Result helper for service returns.\n' };
const build03 = (skip = []) => INV.filter((f) => f.fullDocument === undefined && !skip.includes(f.id)).reduce((t, f) => insertUnder(t, f.ref, f.token), BS03);
const consolidate = (o = {}) => H.checkConsolidation({ doc03Text: o.doc03Text ?? build03(), inventory: o.inventory ?? INV, dispositions: o.dispositions ?? {}, todoText: o.todoText ?? '', pointers: o.pointers ?? {}, fullDocuments: o.fullDocuments ?? FULLDOCS });
{
  const G = grp('Existing content');
  G('an independently enumerated inventory covering config, transaction, error, integration, invariant, money, glossary and a full document is fully consolidated', consolidate().length === 0, consolidate());
  for (const f of INV.filter((x) => x.fullDocument === undefined)) G(`omitting the ${f.kind} fact (${f.id}) from 03 is reported as omitted`, consolidate({ doc03Text: build03([f.id]) }).some((x) => x.id === f.id && x.code === 'omitted'), consolidate({ doc03Text: build03([f.id]) }));
  G('a full-document fact that is not in its full document is reported as omitted', consolidate({ fullDocuments: {} }).some((x) => x.id === 'full-1' && x.code === 'omitted'));
  G('a full-document fact placed in a different document does not count', consolidate({ fullDocuments: { 'docs/other.md': FULLDOCS['.ai/context/code-patterns.md'] } }).some((x) => x.id === 'full-1' && x.code === 'omitted'));
  G('a fact present in 03 but under the wrong section is reported as wrong-section', (() => { const t = INV.filter((f) => f.fullDocument === undefined).reduce((a, f) => insertUnder(a, f.id === 'cfg-1' ? 'Landmines' : f.ref, f.token), BS03); return consolidate({ doc03Text: t }).some((x) => x.id === 'cfg-1' && x.code === 'wrong-section'); })());
  G('a known invariant moved only into TODO is reported (a conversion must not look complete)', consolidate({ doc03Text: build03(['inv-1']), todoText: '- Lock order is wallet then ledger and never the reverse\n' }).some((x) => x.id === 'inv-1' && x.code === 'invariant-only-in-todo'));
  G('an unresolved non-invariant item in TODO without the explicit todo disposition is reported', consolidate({ doc03Text: build03(['cfg-1']), todoText: '- WALLET_LOCK_TTL_MS optional number read by WalletService\n' }).some((x) => x.id === 'cfg-1' && x.code === 'todo-without-disposition'));
  G('an unresolved non-invariant item in TODO with the explicit todo disposition is accepted', consolidate({ doc03Text: build03(['cfg-1']), todoText: '- WALLET_LOCK_TTL_MS optional number read by WalletService\n', dispositions: { 'cfg-1': 'todo' } }).length === 0);
  G('a renamed destination heading makes every fact mapped to it unresolvable (destination-missing)', (() => { const t = build03().replace(/^## 7\. Database$/m, '## 7. Persistence'); const f = consolidate({ doc03Text: t }); return ['tx-1', 'money-1'].every((id) => f.some((x) => x.id === id && x.code === 'destination-missing')); })());
  const C1 = { id: 'conf-1', doc: '.ai/context/configuration.md', token: 'WALLET_LOCK_TTL_MS default is 5000 ms', ref: 'Configuration', kind: 'config', conflict: { stale: 'default is 3000 ms', current: 'default is 5000 ms' } };
  const withC = (o = {}) => H.checkConsolidation({ doc03Text: o.doc03Text, inventory: [C1], dispositions: o.dispositions ?? {}, todoText: '', pointers: {}, fullDocuments: {} });
  const good = insertUnder(BS03, 'Configuration', C1.token);
  G('a contradiction with an approved disposition and the approved value in 03 is clean', withC({ doc03Text: good, dispositions: { 'conf-1': 'use-5000' } }).length === 0, withC({ doc03Text: good, dispositions: { 'conf-1': 'use-5000' } }));
  G('a contradiction without a disposition is reported even when 03 holds the approved value', has(withC({ doc03Text: good }), 'conflict-no-disposition'));
  G('a contradicted value left in 03 is reported', has(withC({ doc03Text: insertUnder(BS03, 'Configuration', 'WALLET_LOCK_TTL_MS default is 3000 ms'), dispositions: { 'conf-1': 'x' } }), 'stale-value-retained'));
  G('a contradicted value left beside the approved value is still reported', has(withC({ doc03Text: insertUnder(good, 'Configuration', 'older note: default is 3000 ms'), dispositions: { 'conf-1': 'x' } }), 'stale-value-retained'));
  G('a contradiction whose approved value never reached 03 is reported as unresolved', has(withC({ doc03Text: BS03, dispositions: { 'conf-1': 'x' } }), 'conflict-unresolved'));
  G('a fact copied into a pointer is reported (pointers hold navigation only)', consolidate({ pointers: { 'docs/database.md': `# D\n\n- ${INV[1].token}\n` } }).some((x) => x.code === 'copied-into-pointer' && x.id === 'tx-1'));
  G('pointers without any inventory fact are clean', consolidate({ pointers: { 'docs/database.md': '# D\n\nnavigation only\n' } }).length === 0);
  G('a token that differs only by whitespace still counts as present (whitespace is not content)', consolidate({ doc03Text: build03().replace('transfer debits and credits inside one serializable transaction', 'transfer   debits and credits\ninside one serializable transaction') }).length === 0);
  G('a fact that appears in 03 only as a substring of a different statement is still matched by its full token (no partial credit for half a fact)', consolidate({ doc03Text: build03(['tx-1']) + '\ntransfer debits and credits\n' }).some((x) => x.id === 'tx-1'));
}

// ============================================================== GROUP: BS outcome and recovery ====
const USER_LINE = 'Team note: run npm run lint before pushing.';
const BS_IMPORTS = BS_CLAUDE().split('\n').filter((l) => /^@\S+/.test(l));
const BS_SENTENCE = 'Applied from the `backend-standards` skill, version `3.1.0`.';
const BEFORE_CLAUDE = `${PS_CLAUDE_TEMPLATE}\n${USER_LINE}\n`;
const MERGED_CLAUDE = `${PS_CLAUDE_TEMPLATE}\n${USER_LINE}\n\n${BS_CLAUDE()}`;
const recoverClaude = (text) => H.checkClaudeRecovery({ text, templateText: PS_CLAUDE_TEMPLATE, bsImports: BS_IMPORTS, bsVersionSentence: BS_SENTENCE, userLines: [USER_LINE] });
{
  const G = grp('BS outcome/recovery');
  const out = (file, before, after) => H.classifyBsOutcome(file, before, after).outcome;
  G('preconditions: the BS agents differ from the PS wrappers and carry no canonical reference, so an overwrite is observable', ['reviewer', 'docs-sync'].every((n) => BS_AGENT[n] !== WRAPPER[n] && new RegExp(`\\.ai/agents/${n}\\.md`).test(WRAPPER[n]) && !new RegExp(`\\.ai/agents/${n}\\.md`).test(BS_AGENT[n])));
  G('preconditions: the BS CLAUDE.md carries the BS imports and the provenance sentence but neither the PS import nor the PS block', BS_IMPORTS.length >= 2 && /Applied from the `backend-standards` skill/.test(BS_CLAUDE_TEMPLATE) && !/@AGENTS\.md/.test(BS_CLAUDE_TEMPLATE) && !/project-setup:begin/.test(BS_CLAUDE_TEMPLATE));
  G('CLAUDE.md: an unchanged file is classified unchanged', out('CLAUDE.md', BEFORE_CLAUDE, BEFORE_CLAUDE) === 'unchanged');
  G('CLAUDE.md: BS content replacing the PS file is classified overwrite', out('CLAUDE.md', BEFORE_CLAUDE, BS_CLAUDE()) === 'overwrite');
  G('CLAUDE.md: PS import and block kept beside the BS content is classified merge', out('CLAUDE.md', BEFORE_CLAUDE, MERGED_CLAUDE) === 'merge');
  G('CLAUDE.md: the PS import kept but the managed block lost is classified other (mixed), not merge', out('CLAUDE.md', BEFORE_CLAUDE, `@AGENTS.md\n\n${BS_CLAUDE()}`) === 'other');
  G('CLAUDE.md: the block kept but the import lost is classified other (mixed)', out('CLAUDE.md', BEFORE_CLAUDE, MERGED_CLAUDE.replace('@AGENTS.md\n', '')) === 'other');
  G('CLAUDE.md: a custom rewrite with no BS content is classified other', out('CLAUDE.md', BEFORE_CLAUDE, '# Custom\n\nnotes\n') === 'other');
  G('CLAUDE.md: a file with broken block markers is never classified merge', out('CLAUDE.md', BEFORE_CLAUDE, MERGED_CLAUDE.replace('<!-- project-setup:end id=claude -->', '')) !== 'merge');
  G('CLAUDE.md: a removed file is classified removed', out('CLAUDE.md', BEFORE_CLAUDE, null) === 'removed');
  G('CLAUDE.md: the evidence names each observed property (import, block, BS import, BS version)', (() => { const e = H.classifyBsOutcome('CLAUDE.md', BEFORE_CLAUDE, MERGED_CLAUDE).evidence; return e.psImport && e.psBlock && e.bsImport && e.bsVersion; })());
  for (const n of ['reviewer', 'docs-sync']) {
    const f = `.claude/agents/${n}.md`;
    G(`${n}: BS content replacing the wrapper is classified overwrite`, out(f, WRAPPER[n], BS_AGENT[n]) === 'overwrite');
    G(`${n}: a wrapper kept with BS rules added is classified merge`, out(f, WRAPPER[n], `${WRAPPER[n]}\n## BS rules\nkeep\n`) === 'merge');
    G(`${n}: an unchanged wrapper is classified unchanged`, out(f, WRAPPER[n], WRAPPER[n]) === 'unchanged');
    G(`${n}: an unrelated rewrite is classified other`, out(f, WRAPPER[n], '# something else\n') === 'other' || out(f, WRAPPER[n], '# something else\n') === 'overwrite');
  }
  G('mixed per-file states are classified independently: CLAUDE.md merge, reviewer overwrite, docs-sync unchanged', out('CLAUDE.md', BEFORE_CLAUDE, MERGED_CLAUDE) === 'merge' && out('.claude/agents/reviewer.md', WRAPPER.reviewer, BS_AGENT.reviewer) === 'overwrite' && out('.claude/agents/docs-sync.md', WRAPPER['docs-sync'], WRAPPER['docs-sync']) === 'unchanged');
  // CLAUDE.md recovery expectation.
  G('a restored CLAUDE.md (one import, the current block, BS imports and version, user text) has no findings', recoverClaude(MERGED_CLAUDE).length === 0, recoverClaude(MERGED_CLAUDE));
  const RC = [
    ['the sibling @AGENTS.md import lost', (t) => t.replace('@AGENTS.md\n', ''), 'import-count'],
    ['the @AGENTS.md import duplicated', (t) => `${t}\n@AGENTS.md\n`, 'import-count'],
    ['the managed claude block lost', (t) => t.replace(/<!-- project-setup:begin id=claude -->[\s\S]*<!-- project-setup:end id=claude -->\n?/, ''), 'claude-block-count'],
    ['the managed claude block duplicated', (t) => `${t}\n${t.match(/<!-- project-setup:begin id=claude -->[\s\S]*<!-- project-setup:end id=claude -->/)[0]}\n`, 'marker-error'],
    ['the root-start rule removed from the block', (t) => t.replace("You MUST start Claude Code at this repository's root.", 'Start anywhere.'), 'claude-block-content'],
    ['a rule of the block weakened', (t) => t.replace('You MUST NOT infer a subdirectory start', 'You may infer a subdirectory start'), 'claude-block-content'],
    ['the root-start rule duplicated outside the block', (t) => `${t}\nYou MUST start Claude Code at this repository's root.\n`, 'duplicate-instructions'],
    ['a BS import lost', (t) => t.replace(`${BS_IMPORTS[0]}\n`, ''), 'bs-import-lost'],
    ['a BS import duplicated', (t) => `${t}\n${BS_IMPORTS[0]}\n`, 'bs-import-duplicated'],
    ['the BS version sentence lost', (t) => t.replace(BS_SENTENCE, ''), 'bs-version-lost'],
    ['the approved user line lost', (t) => t.replace(USER_LINE, ''), 'user-content-lost'],
    ['an unclosed block marker', (t) => t.replace('<!-- project-setup:end id=claude -->', ''), 'marker-error'],
  ];
  for (const [label, fn, code] of RC) G(`CLAUDE.md recovery: ${label} is detected`, (() => { const m = fn(MERGED_CLAUDE); return m !== MERGED_CLAUDE && has(recoverClaude(m), code); })());
  G('an overwritten CLAUDE.md (BS content only) is not a valid recovery', has(recoverClaude(BS_CLAUDE()), 'import-count') && has(recoverClaude(BS_CLAUDE()), 'claude-block-count'));
  // Agent recoveries, each wrapper judged on its own.
  const ar = (o) => H.checkAgentRecovery({ shippedWrapper: WRAPPER[o.name], ...o });
  for (const n of ['reviewer', 'docs-sync']) {
    G(`${n}: take-new with the exact shipped wrapper is complete`, ar({ name: n, disposition: 'take-new', text: WRAPPER[n], report: { incomplete: false } }).length === 0);
    G(`${n}: take-new that is not the exact wrapper is detected`, has(ar({ name: n, disposition: 'take-new', text: `${WRAPPER[n]}\n`, report: {} }), 'wrapper-not-canonical'));
    G(`${n}: take-new reported as incomplete is detected`, has(ar({ name: n, disposition: 'take-new', text: WRAPPER[n], report: { incomplete: true } }), 'status'));
    G(`${n}: keep with the exact retained bytes, an incomplete report and the invoked definition is accepted as incomplete`, ar({ name: n, disposition: 'keep', text: BS_AGENT[n], retainedBytes: BS_AGENT[n], report: { incomplete: true, invokedDefinition: `.claude/agents/${n}.md` } }).length === 0);
    G(`${n}: keep with changed bytes is detected`, has(ar({ name: n, disposition: 'keep', text: `${BS_AGENT[n]}x`, retainedBytes: BS_AGENT[n], report: { incomplete: true, invokedDefinition: `.claude/agents/${n}.md` } }), 'bytes'));
    G(`${n}: keep reported as complete is detected (a retained standalone agent is an incomplete PS agent layer)`, has(ar({ name: n, disposition: 'keep', text: BS_AGENT[n], retainedBytes: BS_AGENT[n], report: { incomplete: false, invokedDefinition: `.claude/agents/${n}.md` } }), 'status'));
    G(`${n}: keep without naming the invoked definition is detected`, has(ar({ name: n, disposition: 'keep', text: BS_AGENT[n], retainedBytes: BS_AGENT[n], report: { incomplete: true } }), 'invoked-definition'));
    G(`${n}: an approved custom merge must hold exactly the approved bytes and is still incomplete`, ar({ name: n, disposition: 'merge', text: `${WRAPPER[n]}\nproject rules\n`, approvedBytes: `${WRAPPER[n]}\nproject rules\n`, report: { incomplete: true, invokedDefinition: `.claude/agents/${n}.md` } }).length === 0 && has(ar({ name: n, disposition: 'merge', text: `${WRAPPER[n]}\nother\n`, approvedBytes: `${WRAPPER[n]}\nproject rules\n`, report: { incomplete: true, invokedDefinition: `.claude/agents/${n}.md` } }), 'bytes'));
    G(`${n}: a missing approved-bytes record never passes a merge`, has(ar({ name: n, disposition: 'merge', text: WRAPPER[n], report: { incomplete: true, invokedDefinition: `.claude/agents/${n}.md` } }), 'bytes'));
  }
  G('an unknown disposition is rejected', has(ar({ name: 'reviewer', disposition: 'whatever', text: WRAPPER.reviewer }), 'disposition'));
  G('the wrappers are judged separately: reviewer take-new complete while docs-sync keep is incomplete', ar({ name: 'reviewer', disposition: 'take-new', text: WRAPPER.reviewer, report: { incomplete: false } }).length === 0 && ar({ name: 'docs-sync', disposition: 'keep', text: BS_AGENT['docs-sync'], retainedBytes: BS_AGENT['docs-sync'], report: { incomplete: true, invokedDefinition: '.claude/agents/docs-sync.md' } }).length === 0 && has(ar({ name: 'docs-sync', disposition: 'take-new', text: BS_AGENT['docs-sync'], report: {} }), 'wrapper-not-canonical'));
  G('the live helper never installs, switches or restores a skill copy, grants Git trust, or pre-restores PS files (static scan of its code)', (() => {
    const src = rd(path.join(TESTS, 'live', 'bs-doc-map.mjs')).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    const bad = [/--global\b/, /--system\b/, /safe\.directory/, /install\.mjs/, /\.claude\/skills|\.agents\/skills/, /\bwriteFileSync\([^)]*\.claude/, /rollback/].filter((re) => re.test(src));
    return bad.length === 0 ? true : bad.map(String);
  })());
}

// ============================================================== GROUP: root and local instructions ====
const AGENTS_VALS = { PROJECT_NAME: 'fixture-app', ONE_LINE_PURPOSE: 'A fixture service.', STACK_WITH_VERSIONS: 'NestJS 11', PACKAGE_MANAGER: 'npm', RUNTIME_VERSION: 'Node 24', DB_CHANGE_POLICY: 'migrations only', VERIFIED_COMMANDS: '- npm test', NESTED_INSTRUCTION_INDEX: '- src/wallet/AGENTS.md' };
const fillT = (t) => t.replace(/\{\{([A-Z_]+)\}\}/g, (a, k) => AGENTS_VALS[k] ?? a);
const renderAgents = (activated) => {
  let t = fillT(PS_AGENTS_TEMPLATE);
  if (!activated) return t;
  const blocks = parseBlocks(t).blocks;
  t = upsertBlock(t, 'critical-rules', `${blocks.find((b) => b.id === 'critical-rules').inner}\n\n${ROOT_PARAGRAPH}`, 'md');
  t = upsertBlock(t, 'navigation', `${blocks.find((b) => b.id === 'navigation').inner}\n\n${NAV_SENTENCE}`, 'md');
  return t;
};
const rootCheck = (agentsText, o = {}) => H.checkRootInstructions({ agentsText, activated: o.activated ?? true, paragraph: ROOT_PARAGRAPH, navSentence: NAV_SENTENCE, templateAgentsText: PS_AGENTS_TEMPLATE, nested: o.nested ?? [], unrelatedLines: o.unrelatedLines ?? [] });
{
  const G = grp('Root/local instructions');
  const dep = [['the conditional root paragraph', ROOT_PARAGRAPH], ['the navigation sentence', NAV_SENTENCE]];
  NEEDS(G, 'an activated root AGENTS.md with the paragraph in critical-rules and the sentence in navigation passes, keeping the template rules and summaries', dep, () => { const f = rootCheck(renderAgents(true)); return f.length === 0 ? true : f; });
  NEEDS(G, 'a non-activated root AGENTS.md carries neither addition and passes', dep, () => { const f = rootCheck(renderAgents(false), { activated: false }); return f.length === 0 && !renderAgents(false).includes(ROOT_PARAGRAPH) && !renderAgents(false).includes(NAV_SENTENCE) ? true : f; });
  NEEDS(G, 'routing text in a non-activated project is detected', dep, () => has(rootCheck(renderAgents(true), { activated: false }), 'routing-without-activation') && has(rootCheck(renderAgents(true), { activated: false }), 'navigation-without-activation'));
  const RM_ACT = [
    ['the routing paragraph removed from critical-rules', (t) => t.replace(ROOT_PARAGRAPH, ''), 'routing-paragraph-missing'],
    ['the routing paragraph placed outside every managed block', (t) => `${t.replace(ROOT_PARAGRAPH, '')}\n${ROOT_PARAGRAPH}\n`, 'routing-paragraph-missing'],
    ['the navigation sentence removed', (t) => t.replace(NAV_SENTENCE, ''), 'navigation-sentence-missing'],
  ];
  for (const [label, fn, code] of RM_ACT) NEEDS(G, `${label} is detected`, dep, () => { const base = renderAgents(true); const m = fn(base); return m !== base && has(rootCheck(m), code) ? true : (m === base ? 'mutation did not apply' : rootCheck(m)); });
  G('the template-based instruction checks pass on the rendered canonical template (no activation needed)', rootCheck(renderAgents(false), { activated: false }).length === 0, rootCheck(renderAgents(false), { activated: false }));
  const RM = [
    ['the money and auth critical rule removed', (t) => t.replace(/^- Money, balance, payment, and points flows:[\s\S]*?critical-modules\.md`\.\n/m, ''), 'critical-rule-lost'],
    ['the money and auth rule losing its critical-modules reference', (t) => t.replace(' See `.ai/context/critical-modules.md`.', ''), 'critical-modules-reference'],
    ['the locking and idempotency requirement weakened', (t) => t.replace('no read-modify-write without a lock or atomic statement', 'locking is optional'), 'critical-rule-lost'],
    ['the personal-data critical rule removed', (t) => t.replace(/^- Never log or return personal data or secrets\. Redact before logging\.\n/m, ''), 'critical-rule-lost'],
    ['the database-change policy removed (instruction summary)', (t) => t.replace("Database changes follow the project's own policy: migrations only.", 'Database changes happen.'), 'db-policy-missing'],
    ['the overview summary emptied', (t) => t.replace(/<!-- project-setup:begin id=overview -->[\s\S]*?<!-- project-setup:end id=overview -->/, '<!-- project-setup:begin id=overview -->\n<!-- project-setup:end id=overview -->'), 'summary-missing'],
    ['the commands summary emptied', (t) => t.replace(/<!-- project-setup:begin id=commands -->[\s\S]*?<!-- project-setup:end id=commands -->/, '<!-- project-setup:begin id=commands -->\n<!-- project-setup:end id=commands -->'), 'summary-missing'],
    ['a block marker removed', (t) => t.replace('<!-- project-setup:end id=agents -->', ''), 'marker-error'],
  ];
  const gen = (o = {}) => rootCheck(o.text ?? renderAgents(false), { activated: false, ...o });
  for (const [label, fn, code] of RM) G(`${label} is detected`, (() => { const base = renderAgents(false); const m = fn(base); return m !== base && has(gen({ text: m }), code) ? true : (m === base ? 'mutation did not apply' : gen({ text: m })); })() === true, 'mutation not detected');
  G('both members of each local pair are preserved and the CLAUDE.md imports AGENTS.md', gen({ nested: [{ dir: 'src/wallet', agents: '# local\n', claude: '@AGENTS.md\n' }] }).length === 0);
  G('a missing member of a local pair is detected', has(gen({ nested: [{ dir: 'src/wallet', agents: '# local\n' }] }), 'pair-missing') && has(gen({ nested: [{ dir: 'src/wallet', claude: '@AGENTS.md\n' }] }), 'pair-missing'));
  G('a local CLAUDE.md that no longer imports AGENTS.md is detected', has(gen({ nested: [{ dir: 'src/wallet', agents: '# local\n', claude: 'standalone\n' }] }), 'pair-import'));
  G('unrelated user text outside the managed blocks is preserved, and losing it is detected', (() => { const line = 'Team note: wallet code is reviewed by two people.'; const kept = `${renderAgents(false)}\n${line}\n`; return gen({ text: kept, unrelatedLines: [line] }).length === 0 && has(gen({ unrelatedLines: [line] }), 'unrelated-text-lost'); })());
  G('the canonical AGENTS.md template is unchanged by mapping: it has neither the routing paragraph nor the pointer navigation sentence', !/documentation pointers/.test(PS_AGENTS_TEMPLATE) && !/documentation-pointer/.test(PS_AGENTS_TEMPLATE));
  G('the canonical CLAUDE.md template, agents and wrappers carry no pointer routing (pointers supply their own)', ['assets/templates/CLAUDE.md', 'assets/agents/reviewer.md', 'assets/agents/docs-sync.md', 'assets/wrappers/claude-reviewer.md', 'assets/wrappers/claude-docs-sync.md', 'assets/wrappers/codex-reviewer.toml', 'assets/wrappers/codex-docs_sync.toml'].every((p) => !/documentation[- ]pointer/.test(rd(path.join(SKILL, ...p.split('/'))))));
}

// ============================================================== GROUP: extensions ====
{
  const G = grp('Extensions');
  const ex = (o) => H.checkExtension(o);
  G('no extension is invented: nothing before, nothing approved, nothing after is clean', ex({ before: null, after: null }).length === 0);
  G('an extension created without approved content is detected as invented', has(ex({ before: null, after: '## Docs\nrule\n' }), 'invented'));
  G('a newly approved extension must hold exactly the approved text', ex({ before: null, after: 'rule\n', approvedAppend: 'rule\n' }).length === 0 && has(ex({ before: null, after: 'rule\nextra\n', approvedAppend: 'rule\n' }), 'bytes'));
  G('existing extension bytes are preserved when nothing is approved', ex({ before: 'mine\n', after: 'mine\n' }).length === 0 && has(ex({ before: 'mine\n', after: 'mine2\n' }), 'bytes'));
  G('an existing extension that is removed is detected', has(ex({ before: 'mine\n', after: null }), 'removed'));
  G('only the exact approved text is appended to existing bytes', ex({ before: 'mine\n', after: 'mine\nnew rule\n', approvedAppend: 'new rule\n' }).length === 0 && has(ex({ before: 'mine\n', after: 'mine\nnew rule\nunapproved\n', approvedAppend: 'new rule\n' }), 'bytes') && has(ex({ before: 'mine\n', after: 'new rule\nmine\n', approvedAppend: 'new rule\n' }), 'bytes'));
  G('a file without a final newline gets exactly one EOL before the approved text (boundary)', ex({ before: 'mine', after: 'mine\nnew\n', approvedAppend: 'new\n' }).length === 0 && has(ex({ before: 'mine', after: 'minenew\n', approvedAppend: 'new\n' }), 'bytes'));
  G('a CRLF file keeps CRLF for the added EOL (boundary)', ex({ before: 'mine\r\nmore', after: 'mine\r\nmore\r\nnew\n', approvedAppend: 'new\n' }).length === 0 && has(ex({ before: 'mine\r\nmore', after: 'mine\r\nmore\nnew\n', approvedAppend: 'new\n' }), 'bytes'));
  G('an empty existing extension takes the approved text as is (boundary)', ex({ before: '', after: 'new\n', approvedAppend: 'new\n' }).length === 0);
  G('a changed byte inside the existing extension while appending is detected', has(ex({ before: 'mine\n', after: 'Mine\nnew\n', approvedAppend: 'new\n' }), 'bytes'));
  G('a docs-sync extension may not be synthesized solely to enable pointer routing (declined or absent approval leaves no file)', ex({ before: null, after: null, approvedAppend: null }).length === 0 && has(ex({ before: null, after: 'Follow documentation pointers.\n', approvedAppend: null }), 'invented'));
  G('a declined replacement of a standalone agent stays an incomplete PS agent layer (not complete)', has(H.checkAgentRecovery({ name: 'docs-sync', disposition: 'keep', text: BS_AGENT['docs-sync'], shippedWrapper: WRAPPER['docs-sync'], retainedBytes: BS_AGENT['docs-sync'], report: { incomplete: false, invokedDefinition: '.claude/agents/docs-sync.md' } }), 'status'));
}

// ====================================================================== transaction harness (the EXISTING mechanism) ====
// No production script is changed in 3.1: these groups drive the real lock.mjs, apply.mjs, validate.mjs and blocks.mjs on fixture repositories.
let runSeq = 0;
const P03 = H.BS_03_REL;
const O3 = '# 03\n\n## 7. Database\n\nx\n';
const N3 = '# 03\n\n## 7. Database\n\nx\n\nconsolidated facts\n';
const MINIMAL_POINTER = (link, title = 'T') => `# ${title}\n\n${H.POINTER_MARKER}\n\nSource of truth: [Project architecture](${link}).\n`;
const LINK = { '.ai/context': '../standards/03-project-architecture.md', docs: '../.ai/standards/03-project-architecture.md', 'docs/integrations': '../../.ai/standards/03-project-architecture.md' };
const ptrAt = (rel) => MINIMAL_POINTER(LINK[path.posix.dirname(rel)]);
const baseFiles = (extra = {}) => ({ 'package.json': '{"name":"fixture-app"}\n', '.gitignore': '.claude/settings.local.json\nCLAUDE.local.md\n', ...extra });
function txRun(root, { label = 'run', drafts = {}, ownership = null, inputs = null, mode = 'update', approve = [], doCommit = true, hold = false } = {}) {
  const runId = `bsmap-${label}-${++runSeq}`;
  const acquire = skillScript('lock', ['acquire', '--run-id', runId], root);
  const init = skillScript('apply', ['init', '--run-id', runId], root);
  for (const [rel, text] of Object.entries(drafts)) putF(root, `.ai/.run/${runId}/drafts/${rel}`, text);
  if (ownership !== null) putF(root, `.ai/.run/${runId}/ownership.json`, JSON.stringify(ownership));
  if (inputs !== null) putF(root, `.ai/.run/${runId}/transaction-inputs.json`, JSON.stringify(inputs));
  const prep = skillScript('apply', ['prepare', '--run-id', runId, '--mode', mode, ...(approve.length > 0 ? ['--approve-user-content', approve.join(',')] : [])], root);
  const res = { runId, acquire, init, prep, commit: null, root };
  if (doCommit && prep.json !== null && prep.json.ok === true) res.commit = skillScript('apply', ['commit', '--run-id', runId, '--approved-plan', prep.json.planSha256], root);
  if (!hold) skillScript('lock', ['release', '--run-id', runId], root);
  return res;
}
const commitRun = (res) => skillScript('apply', ['commit', '--run-id', res.runId, '--approved-plan', res.prep.json.planSha256], res.root);
const releaseRun = (res) => skillScript('lock', ['release', '--run-id', res.runId], res.root);
const committed = (res) => res.commit !== null && res.commit.code === 0 && res.commit.json?.ok === true;
const manifestFiles = (root) => { try { return JSON.parse(rd(path.join(root, '.ai', 'manifest.json'))).files; } catch { return null; } };
const treeHashes = (root) => { const out = {}; const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === '.git' || e.name === 'node_modules' || (rel === '.ai' && (e.name === '.run' || e.name === '.setup.lock'))) continue; const r = rel === '' ? e.name : `${rel}/${e.name}`; if (e.isDirectory()) walk(path.join(d, e.name), r); else out[r] = sha(fs.readFileSync(path.join(d, e.name))); } }; walk(root, ''); return out; };
const project = (label, extra = {}) => mkRepo(label, baseFiles(extra));
const validateOf = (root) => { const r = skillScript('validate', ['--json'], root); return r.json?.results ?? []; };
const vlevel = (results, check) => results.filter((x) => x.check === check).map((x) => x.level);

// ============================================================== GROUP: ownership ====
{
  const G = grp('Ownership');
  const POINTERS = ['.ai/context/glossary.md', 'docs/database.md', 'docs/integrations/stripe.md'];
  { const root = project('own1', { [P03]: O3 }); const res = txRun(root, { label: 'own', mode: 'fresh', drafts: Object.fromEntries(POINTERS.map((r) => [r, ptrAt(r)])), inputs: [P03] }); const m = manifestFiles(root);
    G('pointers at all three depths are written by one transaction and recorded merged by the existing inference', committed(res) && m !== null && POINTERS.every((r) => m[r]?.ownership === 'merged' && m[r].sha256 === undefined && rd(path.join(root, r)) === ptrAt(r)), { prepare: res.prep.json, manifest: m });
    G('declaring 03 as an unchanged input leaves no manifest record for it (reading or linking is not ownership)', committed(res) && m !== null && m[P03] === undefined && rd(path.join(root, P03)) === O3, m);
  }
  { const root = project('own2'); const res = txRun(root, { label: 'own', mode: 'fresh', drafts: { [P03]: O3 } }); const m = manifestFiles(root);
    G('a created 03 without an ownership request is recorded full (the failure O1 prevents: PS would then own and overwrite a living document)', committed(res) && m?.[P03]?.ownership === 'full', m);
  }
  { const root = project('own3'); const res = txRun(root, { label: 'own', mode: 'fresh', drafts: { [P03]: O3 }, ownership: { [P03]: 'merged' } }); const m = manifestFiles(root);
    G('a created 03 with an explicit merged request is recorded merged', committed(res) && m?.[P03]?.ownership === 'merged' && m[P03].sha256 === undefined, m);
  }
  { const root = project('own4', { [P03]: O3 });
    const refused = txRun(root, { label: 'own', mode: 'fresh', drafts: { [P03]: N3 }, ownership: { [P03]: 'merged' }, doCommit: false });
    G('changing an existing user-owned 03 is refused without explicit approval (exit 3, APPLY_APPROVAL_REQUIRED)', refused.prep.code === 3 && JSON.stringify(refused.prep.json).includes('APPLY_APPROVAL_REQUIRED'), refused.prep.json);
    const ok = txRun(root, { label: 'own', mode: 'fresh', drafts: { [P03]: N3 }, ownership: { [P03]: 'merged' }, approve: [P03] });
    G('the same change with the user approval commits and records 03 merged', committed(ok) && manifestFiles(root)?.[P03]?.ownership === 'merged' && rd(path.join(root, P03)) === N3, ok.prep.json);
  }
  { const root = project('own5'); txRun(root, { label: 'own', mode: 'fresh', drafts: { [P03]: O3 } }); commitAll(root);
    const noApprove = txRun(root, { label: 'own', drafts: { [P03]: N3 }, ownership: { [P03]: 'merged' }, doCommit: false });
    G('a full to merged ownership transition alongside a content change is refused without approval', noApprove.prep.code === 3 && JSON.stringify(noApprove.prep.json).includes('metadata changes require --approve-user-content'), noApprove.prep.json);
    const approved = txRun(root, { label: 'own', drafts: { [P03]: N3 }, ownership: { [P03]: 'merged' }, approve: [P03] });
    G('with approval the reviewed transition commits (full to merged, the sha record dropped)', committed(approved) && manifestFiles(root)?.[P03]?.ownership === 'merged' && manifestFiles(root)[P03].sha256 === undefined, approved.prep.json);
    const metaOnly = txRun(project('own5b', { [P03]: O3 }), { label: 'own', mode: 'fresh', drafts: { [P03]: O3 }, ownership: { [P03]: 'merged' }, doCommit: false });
    G('a metadata-only transition for unchanged 03 bytes is refused by the existing mechanism (the reviewed transition ships with its content change)', metaOnly.prep.code === 3 && JSON.stringify(metaOnly.prep.json).includes('APPLY_METADATA_TARGET'), metaOnly.prep.json);
  }
  { const root = project('own6', { 'docs/database.md': '# Database\n\nFull PS facts that must be consolidated first.\n', [P03]: O3 });
    const refused = txRun(root, { label: 'own', mode: 'fresh', drafts: { 'docs/database.md': ptrAt('docs/database.md') }, inputs: [P03], doCommit: false });
    G('replacing an existing full document by a pointer is refused without approval for that file (no silent replacement of an original)', refused.prep.code === 3 && JSON.stringify(refused.prep.json).includes('docs/database.md') && rd(path.join(root, 'docs/database.md')).includes('Full PS facts'), refused.prep.json);
    const ok = txRun(root, { label: 'own', mode: 'fresh', drafts: { 'docs/database.md': ptrAt('docs/database.md') }, inputs: [P03], approve: ['docs/database.md'] });
    G('with approval the pointer replaces the original and the file is recorded merged', committed(ok) && manifestFiles(root)?.['docs/database.md']?.ownership === 'merged', ok.prep.json);
  }
  { const root = project('own7', { [P03]: O3 }); txRun(root, { label: 'own', mode: 'fresh', drafts: { 'docs/database.md': ptrAt('docs/database.md') }, inputs: [P03] }); commitAll(root);
    putF(root, 'docs/database.md', `${ptrAt('docs/database.md')}\nUser fact added to the pointer.\n`); commitAll(root);
    const drop = txRun(root, { label: 'own', drafts: { 'docs/database.md': ptrAt('docs/database.md') }, inputs: [P03], doCommit: false });
    G('control: the existing mechanism does not itself refuse a draft that drops user additions from a merged pointer, so the O1 drafting clause (additions kept until their disposition is approved) is the only guard and is asserted in the contract group', drop.prep.code === 0 && drop.prep.json.changed === 1 && rd(path.join(root, 'docs/database.md')).includes('User fact added'), drop.prep.json);
    NEEDS(G, 'the checker flags facts added to a pointer so they can be inventoried and consolidated instead of being lost', [SK, PTB], () => has(inspect('docs/database.md', `${pointerOf('docs/database.md')}\nUser fact added to the pointer.\n`), 'template'));
    const keep = txRun(root, { label: 'own', drafts: { 'docs/database.md': `${ptrAt('docs/database.md')}\nUser fact added to the pointer.\n` }, inputs: [P03], doCommit: false });
    G('a draft that keeps the additions is a no-op for that file (preserved until their disposition is approved)', keep.prep.code === 0 && keep.prep.json.changed === 0, keep.prep.json);
  }
  NEEDS(G, 'a transaction carrying skeleton-derived pointers at all three depths commits, records them merged, and the committed files pass the checker', [SK, PTB], () => {
    const rels = ['.ai/context/glossary.md', 'docs/database.md', VENDOR];
    const root = project('own8', { [P03]: BS03 }); const res = txRun(root, { label: 'own', mode: 'fresh', drafts: Object.fromEntries(rels.map((r) => [r, pointerOf(r)])), inputs: [P03] });
    const m = manifestFiles(root); const findings = rels.flatMap((r) => inspectFile(root, r).findings.map((f) => `${r}: ${f.code}`));
    return committed(res) && rels.every((r) => m?.[r]?.ownership === 'merged') && findings.length === 0 ? true : { findings, prepare: res.prep.json };
  });
}

// ============================================================== GROUP: drift ====
{
  const G = grp('Drift');
  const setup = (label) => { const root = project(label, { [P03]: O3, [H.STAMP_REL]: STAMP(), 'AGENTS.md': DECISION_AGENTS(), 'CLAUDE.md': BS_CLAUDE() }); return root; };
  const PD = { 'docs/database.md': ptrAt('docs/database.md') };
  { const root = setup('drift1'); const manifestBefore = manifestFiles(root);
    const res = txRun(root, { label: 'drift', mode: 'fresh', drafts: PD, inputs: [P03], doCommit: false, hold: true });
    putF(root, P03, N3);
    const c = commitRun(res);
    G('mutating a declared, unchanged 03 after prepare is refused at commit (exit 4, APPLY_DRIFT naming the input) and no pointer is written', res.prep.code === 0 && c.code === 4 && c.json?.code === 'APPLY_DRIFT' && c.json.drift.some((d) => d.target === P03 && /transaction input changed/.test(d.what)) && !existsF(root, 'docs/database.md') && manifestFiles(root) === manifestBefore, c.json);
    putF(root, P03, O3);
    const re = skillScript('apply', ['prepare', '--run-id', res.runId, '--mode', 'fresh'], root);
    const c2 = re.json?.ok === true ? skillScript('apply', ['commit', '--run-id', res.runId, '--approved-plan', re.json.planSha256], root) : null;
    G('after restoring the source, re-prepare and a second approval let the commit succeed (the supplied P6 evidence, as a regression on pointer paths)', c2 !== null && c2.code === 0 && existsF(root, 'docs/database.md'), c2?.json ?? re.json);
    releaseRun(res);
  }
  { const root = setup('drift2');
    const res = txRun(root, { label: 'drift', mode: 'fresh', drafts: PD, doCommit: false, hold: true });
    putF(root, P03, N3);
    const c = commitRun(res);
    G('control: an UNDECLARED 03 is not bound, so a mutation after prepare does not stop the commit (why C2 requires declaring it)', c.code === 0 && c.json?.committed === true, c.json);
    releaseRun(res);
  }
  for (const rel of ['AGENTS.md', 'CLAUDE.md']) { const root = setup(`drift-${rel}`);
    const res = txRun(root, { label: 'drift', mode: 'fresh', drafts: PD, inputs: [P03, rel], doCommit: false, hold: true });
    putF(root, rel, `${rd(path.join(root, rel))}\nchanged after prepare\n`);
    const c = commitRun(res);
    G(`mutating the declared, unchanged root ${rel} (activation relies on it) after prepare is refused at commit with no pointer written`, c.code === 4 && c.json?.code === 'APPLY_DRIFT' && c.json.drift.some((d) => d.target === rel) && !existsF(root, 'docs/database.md'), c.json);
    releaseRun(res);
  }
  { const root = setup('drift3'); const res = txRun(root, { label: 'drift', mode: 'fresh', drafts: PD, inputs: [P03, H.STAMP_REL], doCommit: false });
    G('the BS stamp cannot be declared as a transaction input (refused: outside the existing accepted scope), so its disposition is reconfirmed before prepare', res.prep.code === 3 && JSON.stringify(res.prep.json).includes('APPLY_WRITE_SCOPE') && JSON.stringify(res.prep.json).includes(H.STAMP_REL), res.prep.json);
  }
  { const root = setup('drift4'); const res = txRun(root, { label: 'drift', mode: 'fresh', drafts: PD, inputs: [P03], doCommit: false, hold: true });
    putF(root, H.STAMP_REL, STAMP('3.2.0'));
    const c = commitRun(res);
    G('accepted limitation: the stamp can change between the reconfirmation and commit (no atomic stamp binding is added in 3.1)', c.code === 0 && c.json?.committed === true, c.json);
    releaseRun(res);
  }
  for (const bad of ['.env', '.ai/.run/x/plan.json', '../outside.md']) { const root = setup('drift5'); const res = txRun(root, { label: 'drift', mode: 'fresh', drafts: PD, inputs: [P03, bad], doCommit: false });
    G(`a declared input at ${bad} is refused (never a secret, run-internal or escaping path), so binding cannot read it`, res.prep.code === 3 && !existsF(root, 'docs/database.md'), res.prep.json); }
  { const root = setup('drift6'); const res = txRun(root, { label: 'drift', mode: 'fresh', drafts: { [P03]: N3 }, ownership: { [P03]: 'merged' }, approve: [P03], doCommit: false, hold: true });
    putF(root, P03, `${O3}\nuser edit after prepare\n`);
    const c = commitRun(res);
    G('a drafted target (03 itself) changed on disk after prepare is refused at commit (target-hash binding, no declaration needed)', c.code === 4 && c.json?.code === 'APPLY_DRIFT' && c.json.drift.some((d) => d.target === P03) && rd(path.join(root, P03)).includes('user edit after prepare'), c.json);
    releaseRun(res);
  }
  { const root = setup('drift7'); const res = txRun(root, { label: 'drift', mode: 'fresh', drafts: PD, inputs: [P03], doCommit: false, hold: true });
    putF(root, `.ai/.run/${res.runId}/drafts/docs/database.md`, `${ptrAt('docs/database.md')}\nunreviewed fact\n`);
    const c = commitRun(res);
    G('a draft edited after prepare is refused at commit (the approved plan binds every draft hash)', c.code === 4 && !existsF(root, 'docs/database.md'), c.json);
    releaseRun(res);
  }
}

// ============================================================== GROUP: rollback ====
{
  const G = grp('Rollback');
  const files = { [P03]: O3, 'docs/database.md': '# Database\n\nOriginal full PS facts.\n', 'AGENTS.md': '# svc\n\nuser text\n' };
  const drafts = { 'docs/database.md': ptrAt('docs/database.md'), '.ai/context/glossary.md': ptrAt('.ai/context/glossary.md'), [P03]: N3, 'AGENTS.md': '# svc\n\nuser text\n\nRouting text added by the transaction.\n' };
  const run = (label) => { const root = project(label, files); const before = treeHashes(root); const res = txRun(root, { label: 'rb', mode: 'fresh', drafts, ownership: { [P03]: 'merged' }, approve: ['docs/database.md', P03, 'AGENTS.md'], hold: true }); return { root, before, res }; };
  { const { root, before, res } = run('rb1');
    const rb = skillScript('apply', ['rollback', '--run-id', res.runId], root);
    G('rolling back restores source consolidation, pointers, routing instructions and the manifest as one unit (tree identical to before the transaction)', committed(res) && rb.code === 0 && JSON.stringify(treeHashes(root)) === JSON.stringify(before), { rollback: rb.json, changed: Object.keys({ ...before, ...treeHashes(root) }).filter((k) => before[k] !== treeHashes(root)[k]) });
    const again = skillScript('apply', ['prepare', '--run-id', res.runId, '--mode', 'fresh'], root);
    G('a run with a journal cannot simply be re-prepared after rollback (lifecycle refusal, exit 7)', again.code === 7, again.json);
    releaseRun(res);
  }
  { const { root, res } = run('rb2');
    putF(root, '.ai/context/glossary.md', `${ptrAt('.ai/context/glossary.md')}\nintervening user edit\n`);
    const rb = skillScript('apply', ['rollback', '--run-id', res.runId], root);
    const st = skillScript('apply', ['status', '--run-id', res.runId], root);
    G('rollback skips an intervening edit, restores everything else, exits 6 and reports incomplete recovery with the backup kept', rb.code === 6 && rb.json?.skipped?.some((s) => s.target === '.ai/context/glossary.md') && rd(path.join(root, '.ai/context/glossary.md')).includes('intervening user edit') && rd(path.join(root, 'docs/database.md')).includes('Original full PS facts') && rd(path.join(root, P03)) === O3, rb.json);
    G('the run status then reads rollback-incomplete (recovery material is preserved, not deleted)', st.json?.state === 'rollback-incomplete' && st.json.rollbackComplete === false, st.json);
    releaseRun(res);
  }
  { const root = project('rb3', { [P03]: O3, 'CLAUDE.md': PS_CLAUDE_TEMPLATE });
    const s0 = txRun(root, { label: 'rb', mode: 'fresh', drafts: { 'docs/database.md': MINIMAL_POINTER(LINK.docs) }, inputs: [P03] }); commitAll(root);
    putF(root, 'CLAUDE.md', BS_CLAUDE()); commitAll(root);                      // an observed BS overwrite between the two PS runs (a constructed state, not a simulation of BS)
    const postBs = treeHashes(root);
    const r1 = txRun(root, { label: 'rb', drafts: { 'CLAUDE.md': MERGED_CLAUDE, 'docs/api-conventions.md': MINIMAL_POINTER(LINK.docs) }, approve: ['CLAUDE.md'], hold: true });
    const rb = skillScript('apply', ['rollback', '--run-id', r1.runId], root);
    const after = treeHashes(root);
    const changed = Object.keys({ ...postBs, ...after }).filter((k) => postBs[k] !== after[k]);
    G('rolling back the candidate PS run returns to the post-BS state it started from, not to the pre-BS state (BS changes are outside PS rollback)', committed(s0) && committed(r1) && rb.code === 0 && rd(path.join(root, 'CLAUDE.md')) === BS_CLAUDE() && changed.length === 0, { changed, rollback: rb.json, prepare: r1.prep.json });
    releaseRun(r1);
  }
}

// ============================================================== GROUP: no-op ====
{
  const G = grp('No-op');
  const files = { [P03]: O3 };
  const dr = { 'docs/database.md': ptrAt('docs/database.md'), '.ai/context/glossary.md': ptrAt('.ai/context/glossary.md') };
  const root = project('noop', files);
  const first = txRun(root, { label: 'noop', mode: 'fresh', drafts: dr, inputs: [P03] }); commitAll(root);
  const before = treeHashes(root);
  const again = txRun(root, { label: 'noop', drafts: dr, inputs: [P03] });
  G('identical outputs and sources produce a plan with zero changes', committed(first) && again.prep.json?.changed === 0 && again.prep.json.unchanged === 2, again.prep.json);
  G('the commit reports nothing to change (zero diff)', again.commit?.json?.committed === false && /zero diff/.test(again.commit.json.reason ?? ''), again.commit?.json);
  G('document, 03 and manifest bytes are identical afterwards', JSON.stringify(treeHashes(root)) === JSON.stringify(before), Object.keys(before).filter((k) => before[k] !== treeHashes(root)[k]));
  const third = txRun(root, { label: 'noop', mode: 'update', drafts: dr, inputs: [P03, 'AGENTS.md'].filter((x) => existsF(root, x)) });
  G('a third unchanged run in update mode stays a zero diff (the manifest mode and source commit are not rewritten)', third.commit?.json?.committed === false && JSON.stringify(treeHashes(root)) === JSON.stringify(before));
}

// ============================================================== GROUP: validation ====
{
  const G = grp('Validation');
  const agents = '# svc\n\n| Need | Read |\n|---|---|\n| Database conventions | `docs/database.md` |\n';
  { const root = project('val1', { [P03]: O3, 'AGENTS.md': agents, 'CLAUDE.md': '@AGENTS.md\n', 'docs/database.md': MINIMAL_POINTER(LINK.docs) });
    const present = vlevel(validateOf(root), 'reference-exists');
    G('a pointer that AGENTS.md navigates to satisfies reference-exists', !present.includes('fail'), present);
    fs.rmSync(path.join(root, 'docs', 'database.md'));
    const gone = validateOf(root);
    G('deleting a referenced pointer fails reference-exists (the validator catches missing navigation)', vlevel(gone, 'reference-exists').includes('fail') && gone.some((x) => x.check === 'reference-exists' && /docs\/database\.md/.test(x.detail)), gone.filter((x) => x.check === 'reference-exists'));
  }
  { const root = project('val2', { [P03]: O3, 'AGENTS.md': agents, 'CLAUDE.md': '@AGENTS.md\n', 'docs/database.md': `# Database\n\n${H.POINTER_MARKER}\n\nSource of truth: [Project architecture](../.ai/standards/03-project-architecture.md).\n\nSections:\n- Nonexistent heading\n` });
    G('validator limitation: a pointer naming a heading that does not exist still passes reference-exists (it checks paths, not headings)', !vlevel(validateOf(root), 'reference-exists').includes('fail'));
  }
  NEEDS(G, 'the test-only checker fails the same pointer (bad heading) and a wrong-depth pointer that the validator passes', [SK, PTB], () => {
    const bad = pointerOf('docs/database.md', { bullets: [...H.mappingRefsFor('docs/database.md'), 'Nonexistent heading'] });
    const wrong = pointerOf('docs/database.md', { relPath: '../standards/03-project-architecture.md' });
    const root = project('val3', { [P03]: BS03, 'AGENTS.md': agents, 'CLAUDE.md': '@AGENTS.md\n', 'docs/database.md': bad });
    const a = inspectFile(root, 'docs/database.md').findings; putF(root, 'docs/database.md', wrong); const b = inspectFile(root, 'docs/database.md').findings;
    return has(a, 'heading-missing') && (has(b, 'wrong-depth') || has(b, 'wrong-target')) && !vlevel(validateOf(root), 'reference-exists').includes('fail') ? true : { a, b };
  });
  { const root = project('val4', { 'AGENTS.md': agents, 'CLAUDE.md': BS_CLAUDE(), [P03]: O3, 'docs/database.md': MINIMAL_POINTER(LINK.docs) });
    const r = validateOf(root);
    G('validator success alone does not prove the mapping or the restored root-start rule: a BS-overwritten CLAUDE.md fails claude-import, and no result covers pointer headings', vlevel(r, 'claude-import').includes('fail') && !r.some((x) => /heading|pointer|mapping/i.test(x.check)), r.filter((x) => /claude/.test(x.check)));
  }
}

// ============================================================== GROUP: PS-first recovery through the real tools ====
{
  const G = grp('BS outcome/recovery');
  const files = { [P03]: O3, 'AGENTS.md': fillT(PS_AGENTS_TEMPLATE) };
  const seedDrafts = { 'CLAUDE.md': PS_CLAUDE_TEMPLATE, '.claude/agents/reviewer.md': WRAPPER.reviewer, '.claude/agents/docs-sync.md': WRAPPER['docs-sync'] };
  const prepared = (label) => { const root = project(label, files); const res = txRun(root, { label: 'rec', mode: 'fresh', drafts: seedDrafts }); commitAll(root); return { root, res }; };
  { const { root, res } = prepared('rec1');
    const man = manifestFiles(root);
    G('fixture: a PS run created CLAUDE.md with its blocks and both wrappers as fully owned files', committed(res) && man?.['CLAUDE.md']?.ownership === 'blocks' && man['.claude/agents/reviewer.md']?.ownership === 'full' && man['.claude/agents/docs-sync.md']?.ownership === 'full', man);
    putF(root, 'CLAUDE.md', BS_CLAUDE()); putF(root, '.claude/agents/reviewer.md', BS_AGENT.reviewer); commitAll(root);
    const drift = skillScript('blocks', ['drift', '--file', 'CLAUDE.md'], root);
    const v = validateOf(root);
    G('observed-state diagnostics after a BS overwrite: block drift says removed-by-user, validate fails claude-import and warns about the drift (the evidence recovery records)', drift.json?.blocks?.some((b) => b.id === 'claude' && b.state === 'removed-by-user') && vlevel(v, 'claude-import').includes('fail') && v.some((x) => x.check === 'drift' && x.level === 'warn' && /CLAUDE\.md/.test(x.detail)), { drift: drift.json, drifts: v.filter((x) => x.check === 'drift' || x.check === 'claude-import') });
    const rec = txRun(root, { label: 'rec', drafts: { 'CLAUDE.md': MERGED_CLAUDE, '.claude/agents/reviewer.md': WRAPPER.reviewer }, approve: ['CLAUDE.md', '.claude/agents/reviewer.md'] });
    G('the reviewed merge restores CLAUDE.md through the existing transaction: one import, the current block, BS lines kept, validate claude-import passes', committed(rec) && recoverClaude(rd(path.join(root, 'CLAUDE.md'))).length === 0 && !vlevel(validateOf(root), 'claude-import').includes('fail'), { prepare: rec.prep.json, findings: recoverClaude(rd(path.join(root, 'CLAUDE.md'))) });
    G('take-new for the reviewer wrapper restores the exact shipped bytes, while the untouched docs-sync wrapper keeps its bytes (judged per file)', committed(rec) && H.checkAgentRecovery({ name: 'reviewer', disposition: 'take-new', text: rd(path.join(root, '.claude/agents/reviewer.md')), shippedWrapper: WRAPPER.reviewer, report: {} }).length === 0 && rd(path.join(root, '.claude/agents/docs-sync.md')) === WRAPPER['docs-sync'], rec.prep.json);
  }
  { const { root } = prepared('rec2');
    putF(root, '.claude/agents/docs-sync.md', BS_AGENT['docs-sync']); commitAll(root);
    const refused = txRun(root, { label: 'rec', drafts: { '.claude/agents/docs-sync.md': WRAPPER['docs-sync'] }, doCommit: false });
    G('replacing a BS-modified wrapper is refused without approval (the existing user-modified-file rule applies per wrapper: keep theirs, take new or merge)', refused.prep.code === 3 && JSON.stringify(refused.prep.json).includes('.claude/agents/docs-sync.md'), refused.prep.json);
    const keep = txRun(root, { label: 'rec', drafts: { 'docs/api-conventions.md': MINIMAL_POINTER(LINK.docs) } });
    G('declining the replacement keeps the standalone BS agent byte for byte, and the checker still calls the layer incomplete', committed(keep) && H.checkAgentRecovery({ name: 'docs-sync', disposition: 'keep', text: rd(path.join(root, '.claude/agents/docs-sync.md')), shippedWrapper: WRAPPER['docs-sync'], retainedBytes: BS_AGENT['docs-sync'], report: { incomplete: true, invokedDefinition: '.claude/agents/docs-sync.md' } }).length === 0, keep.prep.json);
    G('no docs-sync extension is created by a pointer transaction (no invented routing extension)', !existsF(root, '.ai/agents/docs-sync.project.md') && !existsF(root, '.ai/agents/reviewer.project.md'));
  }
  { const { root } = prepared('rec3');
    putF(root, 'CLAUDE.md', MERGED_CLAUDE); commitAll(root);
    const drift = skillScript('blocks', ['drift', '--file', 'CLAUDE.md'], root);
    G('after a BS merge that kept the PS import and block, block drift is unchanged, validate passes claude-import, and the checker classifies it merge', drift.json?.blocks?.some((b) => b.id === 'claude' && b.state === 'unchanged') && !vlevel(validateOf(root), 'claude-import').includes('fail') && H.classifyBsOutcome('CLAUDE.md', PS_CLAUDE_TEMPLATE, MERGED_CLAUDE).outcome === 'merge', drift.json);
  }
}

// ============================================================== GROUP: generic project ====
{
  const G = grp('Generic project');
  const root = project('gen1', { 'README.md': '# svc\n' });
  const r = layoutOf({ 'README.md': '# svc\n', 'package.json': '{}\n' });
  G('a project with no BS signal and no 03 keeps the ordinary full-document rules', r.treatment === 'ordinary' && r.fullDocuments === true, r);
  const full = txRun(root, { label: 'gen', mode: 'fresh', drafts: { '.ai/context/glossary.md': '# Glossary\n\n- Hold: a reserved amount.\n', 'docs/database.md': '# Database\n\nFull facts here.\n' } });
  const m = manifestFiles(root);
  G('ordinary full documents are written as before: merged ownership, no pointer marker, and detection stays ordinary afterwards', committed(full) && m?.['docs/database.md']?.ownership === 'merged' && H.classifyLayout(H.collectSignals(root)).treatment === 'ordinary' && !H.isPointerText(rd(path.join(root, 'docs/database.md'))), full.prep.json);
  G('canonical assets are unchanged by mapping: no canonical agent, wrapper or instruction template mentions documentation pointers', ['assets/agents', 'assets/wrappers', 'assets/templates'].every((d) => fs.readdirSync(path.join(SKILL, d)).filter((f) => fs.statSync(path.join(SKILL, d, f)).isFile()).every((f) => !/documentation[- ]pointers?/i.test(rd(path.join(SKILL, d, f))))));
}

// ============================================================== GROUPS: fail-closed live helper (review round 1, R1 to R8) ====
// The live helper is the instrument of the acceptance run, so its own failure modes decide whether a pass means anything. These groups drive
// runSeed, verifyProject, the policy resolution and the CLI themselves on throwaway fixtures, each negative control changing ONE thing from a
// fixture that passes. BS_DOC_MAP_SCRATCH (an existing absolute directory) moves the fixtures out of the OS temp directory; the default is the
// OS temp directory. Nothing is ever created inside the repository.
const LIVE_PARENT = (() => { const b = process.env.BS_DOC_MAP_SCRATCH; return typeof b === 'string' && b !== '' ? path.resolve(b) : os.tmpdir(); })();
const LIVE = fs.realpathSync.native(fs.mkdtempSync(path.join(LIVE_PARENT, 'bsmap-live-')));
let liveSeq = 0;
const liveDir = (label) => { const d = path.join(LIVE, `${label}-${++liveSeq}`); fs.mkdirSync(d, { recursive: true }); return d; };
const LIVE_LINKS = [];
const liveJunction = (target, linkPath) => { const ok = tryJunction(target, linkPath); if (ok) LIVE_LINKS.push(linkPath); return ok; };
const liveProj = (label, files = {}) => { const root = liveDir(label); for (const [rel, text] of Object.entries(files)) if (text !== null) putF(root, rel, text); return root; };
const captureIo = () => { const o = []; const e = []; return { io: { out: (s) => o.push(s), err: (s) => e.push(s) }, o, e }; };
const eacces = () => Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
/** Runs fn with fs.readFileSync and fs.lstatSync observed (and optionally made to fail for one path). The helper calls them through the shared fs object. */
function spyFs(hooks, fn) {
  const saved = { readFileSync: fs.readFileSync, lstatSync: fs.lstatSync };
  const seen = { read: [], lstat: [] };
  fs.readFileSync = function (p, ...a) { seen.read.push(String(p)); if (hooks.read) hooks.read(String(p)); return saved.readFileSync.call(this, p, ...a); };
  fs.lstatSync = function (p, ...a) { seen.lstat.push(String(p)); if (hooks.lstat) hooks.lstat(String(p)); return saved.lstatSync.call(this, p, ...a); };
  try { return { value: fn(), seen }; } finally { fs.readFileSync = saved.readFileSync; fs.lstatSync = saved.lstatSync; }
}
const SHIPPED_POLICY_JSON = JSON.parse(rd(path.join(SKILL, 'data', 'secret-paths.json')));
const policyWith = (extra) => `${JSON.stringify({ ...SHIPPED_POLICY_JSON, projectPatterns: extra }, null, 2)}\n`;
const PRIVATE_DENY = [{ glob: 'docs/private/*', kind: 'project' }];
const POLICY_REL = '.ai/security-paths.json';

// ============================================================== GROUP: policy fails closed (R1) ====
{
  const G = grp('Policy (R1)');
  const PRIV = 'docs/private/notes.md';
  const proj = (policyText, extra = {}) => liveProj('pol', { [PRIV]: 'private notes\n', 'AGENTS.md': '# a\n', ...(policyText === undefined ? {} : { [POLICY_REL]: policyText }), ...extra });
  { const r = proj(); const s = H.policyStatus(r);
    G('no .ai directory and no policy file is a confirmed absence: the shipped defaults apply and an ordinary file reads', s.state === 'default' && H.isForbiddenPath('.env', s.policy) && !H.isForbiddenPath(PRIV, s.policy) && H.readPermitted(r, PRIV).state === 'ok', s); }
  { const r = proj(undefined, { '.ai/context/x.md': 'x\n' }); G('an .ai directory without a policy file is also a confirmed absence (defaults)', H.policyStatus(r).state === 'default'); }
  { const r = proj(policyWith(PRIVATE_DENY)); const s = H.policyStatus(r);
    G('a valid project policy is used, and its own exclusion is honoured (a default-only fallback would have read the file)', s.state === 'project' && H.readPermitted(r, PRIV).state === 'denied' && H.readPermitted(r, 'AGENTS.md').state === 'ok', s);
    const snap = H.takeSnapshot(r);
    G('a snapshot honours the project policy exclusion: the denied path is skipped, never hashed', snap.files[PRIV] === undefined && snap.skipped.some((x) => x.path === PRIV && x.reason === 'policy-denied'), snap.skipped); }
  const BAD = [['not JSON', '{nope'], ['a JSON array', '[]'], ['an empty file', ''], ['an unsupported schema', '{"schema":9,"patterns":[]}'], ['no patterns', '{"schema":1}'], ['an invalid glob', '{"schema":1,"patterns":[{"glob":"a[b]"}]}']];
  for (const [label, text] of BAD) {
    const r = proj(text, { [H.BS_03_REL]: BS03 }); const st = H.policyStatus(r);
    const rp = H.readPermitted(r, PRIV); const ra = H.readPermitted(r, 'AGENTS.md');
    G(`a malformed project policy (${label}) is a stop, not a fallback: state malformed and no project file is read, the private one included`, st.state === 'malformed' && st.policy === undefined && rp.state === 'policy' && rp.text === undefined && ra.state === 'policy' && ra.text === undefined, { st, rp, ra });
    const cls = H.classifyLayout(H.collectSignals(r));
    G(`a malformed project policy (${label}) makes layout detection stop (no signal is read, so none is treated as absent)`, cls.treatment === 'stop' && cls.fullDocuments === false, cls.treatment);
    const th = attempt(() => H.takeSnapshot(r));
    G(`a malformed project policy (${label}) refuses a snapshot with a typed policy error`, th.threw !== undefined && /POLICY_MALFORMED/.test(th.threw), th);
    const ip = H.inspectPointerFile(r, 'docs/database.md', { skeleton: SKEL, pathTable: PT });
    G(`a malformed project policy (${label}) makes pointer inspection report a policy finding and read nothing`, has(ip.findings, 'policy') && ip.reads.length === 0, ip);
  }
  { const r = proj(undefined, { [`${POLICY_REL}/keep.txt`]: 'a directory stands where the policy file should be\n' }); const s = H.policyStatus(r);
    G('a policy path that is a directory is unreadable (a stop), never absent', s.state === 'unreadable' && s.policy === undefined && H.readPermitted(r, PRIV).state === 'policy', s); }
  { const r = proj(undefined, { '.ai': 'a file where the directory .ai belongs\n' }); const s = H.policyStatus(r);
    G('an .ai that is a regular file (ENOTDIR) is unreadable, not a confirmed absence', s.state === 'unreadable' && s.policy === undefined, s); }
  // Links: the policy path is judged by lstat BEFORE any read, so a link target is never opened.
  { const r = liveProj('pol-lnk', { [PRIV]: 'x\n' }); const out = liveProj('pol-lnk-target', { 'sub/keep.txt': 'x\n' }); fs.mkdirSync(path.join(r, '.ai'));
    if (!liveJunction(path.join(out, 'sub'), path.join(r, POLICY_REL))) skip('a junction at the policy path is unsafe and never read', 'a junction cannot be created on this host');
    else { const run = spyFs({}, () => ({ s: H.policyStatus(r), rp: H.readPermitted(r, PRIV) }));
      G('a junction at the policy path is unsafe: no policy file is opened and no project file is read', run.value.s.state === 'unsafe' && run.value.rp.state === 'policy' && !run.seen.read.some((p) => p.endsWith('security-paths.json') || p.endsWith('notes.md')), { s: run.value.s, read: run.seen.read }); } }
  { const r = liveProj('pol-lnk2', { [PRIV]: 'x\n' }); const out = liveProj('pol-lnk2-target', { 'security-paths.json': policyWith([]) });
    if (!liveJunction(out, path.join(r, '.ai'))) skip('a junction at .ai holding a valid policy is unsafe and never read', 'a junction cannot be created on this host');
    else { const run = spyFs({}, () => H.policyStatus(r));
      G('a junction at .ai (holding a perfectly valid policy behind it) is unsafe and its policy file is never opened', run.value.state === 'unsafe' && !run.seen.read.some((p) => p.endsWith('security-paths.json')), { s: run.value, read: run.seen.read }); } }
  { const r = liveProj('pol-lnk3', { [PRIV]: 'x\n' }); const out = liveProj('pol-lnk3-target', { 'real.json': policyWith(PRIVATE_DENY) }); fs.mkdirSync(path.join(r, '.ai'));
    if (!tryFileLink(path.join(out, 'real.json'), path.join(r, POLICY_REL))) skip('a symbolic link at the policy path is unsafe and never read', 'a file symbolic link cannot be created on this host');
    else { LIVE_LINKS.push(path.join(r, POLICY_REL)); const run = spyFs({}, () => H.policyStatus(r));
      G('a symbolic link at the policy path is unsafe and never read', run.value.state === 'unsafe' && !run.seen.read.some((p) => p.endsWith('security-paths.json')), { s: run.value }); } }
  // The in-memory probe of the review: a policy that exists but cannot be read must not be replaced by the defaults.
  { const r = proj(policyWith(PRIVATE_DENY));
    const run = spyFs({ read: (p) => { if (p.endsWith('security-paths.json')) throw eacces(); } }, () => ({ s: H.policyStatus(r), rp: H.readPermitted(r, PRIV), sig: H.classifyLayout(H.collectSignals(r)) }));
    G('an EACCES on reading the policy is unreadable (a stop): the private file is not read through the defaults, and detection stops', run.value.s.state === 'unreadable' && run.value.rp.state === 'policy' && !run.seen.read.some((p) => p.endsWith('notes.md')) && run.value.sig.treatment === 'stop', { s: run.value.s, rp: run.value.rp }); }
  { const r = proj(policyWith(PRIVATE_DENY));
    const run = spyFs({ lstat: (p) => { if (p.endsWith('security-paths.json')) throw eacces(); } }, () => H.policyStatus(r));
    G('an EACCES on the policy path (not ENOENT) is unreadable, never a confirmed absence', run.value.state === 'unreadable' && run.value.policy === undefined, run.value); }
  { const r = proj(policyWith(PRIVATE_DENY));
    const run = spyFs({ lstat: (p) => { if (p.endsWith('security-paths.json')) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); } }, () => H.policyStatus(r));
    G('control: an ENOENT on the policy path IS a confirmed absence (the only case where defaults apply)', run.value.state === 'default', run.value); }
  G('policyOf returns the policy for an absence or a valid file and throws a typed error (code POLICY) for every stop', (() => { const ok1 = H.policyOf(proj()); const ok2 = H.policyOf(proj(policyWith([]))); const e = attempt(() => H.policyOf(proj('{nope'))); return ok1 !== undefined && ok2 !== undefined && /POLICY_MALFORMED/.test(e.threw ?? ''); })());
  { const r = proj('{nope'); const out = path.join(liveDir('pol-snap'), 'snap.json'); const c = captureIo();
    const code = H.main(['snapshot', '--project', r, '--out', out], c.io);
    G('the snapshot command refuses (exit 2, REFUSED policy) on a malformed policy and writes nothing', code === 2 && c.e.some((l) => /REFUSED policy/.test(l)) && !fs.existsSync(out), { code, err: c.e }); }
  G('the helper source holds no silent policy fallback: no catch that returns the shipped policy', !/catch\s*(\([^)]*\))?\s*\{\s*return shippedPolicy\(\)/.test(rd(path.join(TESTS, 'live', 'bs-doc-map.mjs'))));
}

// ============================================================== GROUP: porcelain parsing (R6) ====
{
  const G = grp('Porcelain (R6)');
  const P = (s) => H.parsePorcelainZ(s);
  G('an empty listing is clean, not an error', P('').ok === true && P('').entries.length === 0);
  G('an unstaged modification as the FIRST entry keeps its leading space and its full path', (() => { const r = P(' M AGENTS.md\0'); return r.ok && r.entries.length === 1 && r.entries[0].x === ' ' && r.entries[0].y === 'M' && r.entries[0].path === 'AGENTS.md'; })());
  G('each status pair is read as two columns (staged, unstaged, both, untracked)', (() => { const r = P('M  a.md\0 M b.md\0MM c.md\0?? d.md\0A  e.md\0 D f.md\0D  g.md\0'); return r.ok && r.entries.map((e) => `${e.x}${e.y}:${e.path}`).join('|') === 'M :a.md| M:b.md|MM:c.md|??:d.md|A :e.md| D:f.md|D :g.md'; })());
  G('a rename record is destination then source, and consumes both fields', (() => { const r = P('R  docs/new name.md\0docs/old name.md\0?? z.md\0'); return r.ok && r.entries.length === 2 && r.entries[0].path === 'docs/new name.md' && r.entries[0].from === 'docs/old name.md' && r.entries[1].path === 'z.md' && r.entries[1].from === undefined; })());
  G('a copy and a rename with a worktree change carry a source too', (() => { const r = P('C  b.md\0a.md\0RM d.md\0c.md\0'); return r.ok && r.entries[0].from === 'a.md' && r.entries[1].from === 'c.md' && r.entries[1].y === 'M'; })());
  G('paths with spaces, quotes and non-ASCII are not unquoted or altered (-z does not quote)', (() => { const r = P('?? docs/a "b" é.md\0'); return r.ok && r.entries[0].path === 'docs/a "b" é.md'; })());
  G('a rename without its source field is an error, never a guess', P('R  new.md\0').ok === false && P('R  new.md\0\0').ok === false);
  G('a record that is not "XY path", or output that is not NUL terminated, is an error (an unparseable listing is never clean)', P('M a.md\0').ok === false && P('hello\0').ok === false && P(' M a.md').ok === false && P('??\0').ok === false);
  G('a trimmed listing is exactly the corrupted form the old code parsed (control for the first-entry case)', (() => { const trimmed = ' M AGENTS.md\0'.trim(); return P(trimmed).ok === false || P(trimmed).entries[0].path !== 'AGENTS.md'; })());
}

// ============================================================== GROUP: seed (R2, R6) ====
function mkSeedFixture(label, o = {}) {
  const parent = liveDir(label);
  const proj = path.join(parent, 'service');
  fs.mkdirSync(proj);
  if (o.scenario !== false) fs.writeFileSync(path.join(parent, 'scenario.json'), `${JSON.stringify({ schema: 1, tool: 'bs-doc-map', scenario: 'ps-first', project: 'service', versions: null })}\n`);
  fs.writeFileSync(path.join(parent, 'fixture-gitconfig'), '');
  const env = H.isolatedGitEnv(path.join(parent, 'fixture-gitconfig'));
  const g = (...args) => { const r = spawnSync('git', args, { cwd: proj, env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 120000 }); return { code: r.status, out: String(r.stdout ?? ''), err: String(r.stderr ?? '').trim() }; };
  g('init', '-q');
  for (const [k, v] of [['user.name', H.FIXTURE_NAME], ['user.email', o.email ?? H.FIXTURE_EMAIL], ['commit.gpgsign', 'false'], ['core.autocrlf', 'false']]) g('config', '--local', k, v);
  const files = { '.gitignore': 'node_modules/\n', 'package.json': '{}\n', 'AGENTS.md': '# agents\n', 'CLAUDE.md': '@AGENTS.md\n', '.ai/context/old-name.md': 'an old document with enough text to be detected as a rename\nline two\nline three\nline four\n', 'docs/gone.md': 'gone one\n', 'docs/gone2.md': 'gone two\n', 'src/app.ts': 'export {};\n', ...(o.files ?? {}) };
  for (const k of o.without ?? []) delete files[k];
  for (const [rel, text] of Object.entries(files)) putF(proj, rel, text);
  g('add', '-A');
  if (g('commit', '-qm', 'fixture: scaffold').code !== 0) throw new Error('cannot commit the seed fixture');
  return { parent, proj, g, head: () => g('rev-parse', 'HEAD').out.trim(), porcelain: () => g('status', '--porcelain', '-z', '-uall').out };
}
{
  const G = grp('Seed (R2, R6)');
  const seed = (fx, caseName = 'docs-sync') => H.runSeed({ project: fx.proj, caseName });
  const snapshotOf = (fx) => ({ head: fx.head(), por: fx.porcelain() });
  const same = (fx, before) => fx.head() === before.head && fx.porcelain() === before.por;
  { const fx = mkSeedFixture('seed-ok'); const before = fx.head(); const r = seed(fx);
    G('a clean fixture seeds: the range is printed, exactly the named files are added, the tree is clean and the identity is the fixture one', r.ok === true && r.base === before && r.head === fx.head() && r.range === `${r.base}..${r.head}` && fx.porcelain() === '' && fx.g('log', '-1', '--format=%ae').out.trim() === H.FIXTURE_EMAIL && fx.g('diff', '--name-only', r.range).out.trim().split('\n').map((s) => s.trim()).sort().join('|') === [...r.files].sort().join('|'), r); }
  { const fx = mkSeedFixture('seed-first'); putF(fx.proj, 'AGENTS.md', '# agents\nedited after setup\n');
    const e = H.parsePorcelainZ(fx.porcelain()).entries; const base0 = fx.head(); const r = seed(fx);
    G('fixture sanity: the first and only porcelain entry is an unstaged modification with a leading space', e.length === 1 && e[0].x === ' ' && e[0].y === 'M' && e[0].path === 'AGENTS.md', e);
    G('an unstaged modification of AGENTS.md as the first entry is a permitted post-setup change: committed as the baseline, then the case change is committed', r.ok === true && r.base !== base0 && fx.g('show', 'HEAD~1:AGENTS.md').out.includes('edited after setup') && fx.g('log', '-2', '--format=%s').out.includes('post-setup baseline') && fx.porcelain() === '', r); }
  { const fx = mkSeedFixture('seed-ren'); fx.g('mv', '.ai/context/old-name.md', '.ai/context/new name.md');
    const e = H.parsePorcelainZ(fx.porcelain()).entries; const r = seed(fx);
    G('fixture sanity: a staged rename is one entry, destination then source', e.length === 1 && e[0].x === 'R' && e[0].path === '.ai/context/new name.md' && e[0].from === '.ai/context/old-name.md', e);
    G('a staged rename between permitted paths is committed with the baseline (the old path is not re-added)', r.ok === true && /R\d*\t\.ai\/context\/old-name\.md\t\.ai\/context\/new name\.md/.test(fx.g('show', '--name-status', '--format=', 'HEAD~1').out) && fx.porcelain() === '', r); }
  { const fx = mkSeedFixture('seed-ren-bad1'); fx.g('mv', 'src/app.ts', 'docs/app.md'); const before = snapshotOf(fx); const r = seed(fx);
    G('a rename FROM an unrelated path is refused as unrelated dirty state naming the source', r.ok === false && r.refusal.code === 'dirty' && r.refusal.detail.includes('src/app.ts') && same(fx, before), r); }
  { const fx = mkSeedFixture('seed-ren-bad2'); fx.g('mv', 'docs/gone.md', 'src/gone.ts'); const before = snapshotOf(fx); const r = seed(fx);
    G('a rename INTO an unrelated path is refused naming the destination', r.ok === false && r.refusal.code === 'dirty' && r.refusal.detail.includes('src/gone.ts') && same(fx, before), r); }
  { const fx = mkSeedFixture('seed-del'); fs.rmSync(path.join(fx.proj, 'docs', 'gone.md')); fx.g('rm', '-q', 'docs/gone2.md'); putF(fx.proj, 'docs/note é q.md', 'untracked\n');
    const e = H.parsePorcelainZ(fx.porcelain()).entries.map((x) => `${x.x}${x.y}`).sort().join(','); const r = seed(fx);
    G('a working-tree deletion, a staged deletion and an untracked file with spaces and non-ASCII are all committed through an explicit staging list', e === ' D,??,D ' && r.ok === true && fx.porcelain() === '' && !existsF(fx.proj, 'docs/gone.md') && !existsF(fx.proj, 'docs/gone2.md') && fx.g('-c', 'core.quotepath=off', 'show', '--name-only', '--format=', 'HEAD~1').out.includes('docs/note é q.md'), { e, r }); }
  { const fx = mkSeedFixture('seed-dirty'); putF(fx.proj, 'src/app.ts', 'export const changed = 1;\n'); const before = snapshotOf(fx); const r = seed(fx);
    G('an unrelated modification (the first entry) is refused with its COMPLETE path, and nothing is committed or written', r.ok === false && r.refusal.code === 'dirty' && r.refusal.detail === 'unrelated dirty state: src/app.ts' && same(fx, before) && !existsF(fx.proj, 'src/bs-doc-map-fixture'), r); }
  { const fx = mkSeedFixture('seed-dirty2'); putF(fx.proj, 'scratch.txt', 'x\n'); const before = snapshotOf(fx); const r = seed(fx);
    G('an unrelated untracked file is refused', r.ok === false && r.refusal.code === 'dirty' && r.refusal.detail.includes('scratch.txt') && same(fx, before), r); }
  { const fx = mkSeedFixture('seed-merge'); fx.g('checkout', '-q', '-b', 'side'); putF(fx.proj, 'AGENTS.md', '# side\n'); fx.g('commit', '-qam', 'side'); fx.g('checkout', '-q', '-'); putF(fx.proj, 'AGENTS.md', '# main\n'); fx.g('commit', '-qam', 'main'); fx.g('merge', 'side');
    const before = snapshotOf(fx); const r = seed(fx);
    G('an unmerged (conflicted) path is refused, never committed', r.ok === false && r.refusal.code === 'dirty' && /unmerged/.test(r.refusal.detail) && same(fx, before), r); }
  // R2: links, containment, ancestors and the policy are decided for EVERY target before the first write.
  { const fx = mkSeedFixture('seed-jx'); const outside = liveDir('seed-outside');
    if (!liveJunction(outside, path.join(fx.proj, 'src', 'bs-doc-map-fixture'))) skip('an empty junction at the seed directory is refused before any write', 'a junction cannot be created on this host');
    else { const before = snapshotOf(fx); const r = seed(fx);
      G('an EMPTY junction at src/bs-doc-map-fixture (it passes an existence check) is refused as a linked ancestor: nothing is written through it, committed or changed', r.ok === false && r.refusal.code === 'linked-ancestor' && fs.readdirSync(outside).length === 0 && same(fx, before), { r, outside: fs.readdirSync(outside) }); } }
  { const fx = mkSeedFixture('seed-jx2', { without: ['src/app.ts'] }); const outside = liveDir('seed-outside2');
    if (!liveJunction(outside, path.join(fx.proj, 'src'))) skip('a junction at src is refused before any write', 'a junction cannot be created on this host');
    else { const before = snapshotOf(fx); const r = seed(fx, 'reviewer'); const r2 = seed(fx);
      G('a junction at src (a higher ancestor) is refused for both cases and nothing lands outside the fixture', r2.ok === false && r2.refusal.code === 'linked-ancestor' && fs.readdirSync(outside).length === 0 && same(fx, before) && r.ok === false, { r, r2 }); } }
  { const fx = mkSeedFixture('seed-jx3'); const outside = liveDir('seed-outside3'); const link = path.join(fx.proj, 'src', 'bs-doc-map-fixture');
    if (!liveJunction(outside, link)) skip('a dangling junction at the seed directory is refused', 'a junction cannot be created on this host');
    else { fs.rmSync(outside, { recursive: true, force: true }); const before = snapshotOf(fx); const r = seed(fx);
      G('a dangling junction at the seed directory is refused (a link counts as present even when its target is gone)', r.ok === false && r.refusal.code === 'linked-ancestor' && same(fx, before), r); } }
  { const fx = mkSeedFixture('seed-jx4'); const outside = liveDir('seed-outside4'); fs.mkdirSync(path.join(fx.proj, 'src', 'bs-doc-map-fixture'));
    if (!liveJunction(outside, path.join(fx.proj, 'src', 'bs-doc-map-fixture', 'feature-flag.ts'))) skip('a junction standing at a target file is refused', 'a junction cannot be created on this host');
    else { const before = snapshotOf(fx); const r = seed(fx);
      G('a link standing at a seed target file itself is refused before any write', r.ok === false && r.refusal.code === 'linked-ancestor' && fs.readdirSync(outside).length === 0 && !existsF(fx.proj, 'src/bs-doc-map-fixture/error-filter.ts') && same(fx, before), r); } }
  { const fx = mkSeedFixture('seed-file'); putF(fx.proj, 'src/bs-doc-map-fixture', 'a file where the directory belongs\n'); fx.g('add', '-A'); fx.g('commit', '-qm', 'file in the way'); const before = snapshotOf(fx); const r = seed(fx);
    G('a regular file where a seed directory belongs is refused (not a directory), with nothing written', r.ok === false && r.refusal.code === 'not-directory' && same(fx, before), r); }
  { const fx = mkSeedFixture('seed-exists', { files: { 'src/bs-doc-map-fixture/error-filter.ts': 'existing\n' } }); const before = snapshotOf(fx); const r = seed(fx);
    G('an already existing seed target is refused (the helper never overwrites)', r.ok === false && r.refusal.code === 'dirty' && /already exists/.test(r.refusal.detail) && same(fx, before), r); }
  { const fx = mkSeedFixture('seed-deny', { files: { [POLICY_REL]: policyWith([{ glob: 'src/bs-doc-map-fixture/*', kind: 'project' }]) } }); const before = snapshotOf(fx); const r = seed(fx);
    G('a seed target the project policy denies is refused before any write', r.ok === false && r.refusal.code === 'forbidden' && !existsF(fx.proj, 'src/bs-doc-map-fixture') && same(fx, before), r);
    const fx2 = mkSeedFixture('seed-allow', { files: { [POLICY_REL]: policyWith(PRIVATE_DENY) } }); const r2 = seed(fx2);
    G('control: the same fixture with a policy that does not deny the targets seeds', r2.ok === true, r2); }
  for (const [label, text] of [['malformed', '{nope'], ['wrong schema', '{"schema":9,"patterns":[]}']]) {
    const fx = mkSeedFixture(`seed-pol-${label.replace(/\W/g, '')}`, { files: { [POLICY_REL]: text } }); const before = snapshotOf(fx); const r = seed(fx);
    G(`a ${label} project policy refuses the seed before any write (no fallback to the defaults)`, r.ok === false && r.refusal.code === 'policy' && !existsF(fx.proj, 'src/bs-doc-map-fixture') && same(fx, before), r);
  }
  { const fx = mkSeedFixture('seed-rev'); const before = snapshotOf(fx); const r = seed(fx, 'reviewer');
    G('the reviewer case still needs the lock-order invariant in the baseline 03 (the helper never writes documentation)', r.ok === false && r.refusal.code === 'baseline' && same(fx, before), r);
    const fx2 = mkSeedFixture('seed-rev2', { files: { [H.BS_03_REL]: `${BS03}\nLock order: wallet before ledger.\n` } }); const r2 = seed(fx2, 'reviewer');
    G('the reviewer case seeds once the baseline 03 records the invariant, adding only its named file', r2.ok === true && r2.files.length === 1 && r2.files[0] === 'src/bs-doc-map-fixture/wallet-transfer.ts' && fx2.porcelain() === '', r2); }
  { const fx = mkSeedFixture('seed-misc'); const before = snapshotOf(fx);
    G('a relative project, an unknown case, an unrecognized directory and a repository without the fixture identity are each refused untouched', H.runSeed({ project: 'service', caseName: 'docs-sync' }).refusal.code === 'relative' && H.runSeed({ project: fx.proj, caseName: 'nope' }).refusal.code === 'bad-case' && H.runSeed({ project: liveDir('seed-none'), caseName: 'docs-sync' }).refusal.code === 'unrecognized' && H.runSeed({ project: mkSeedFixture('seed-email', { email: 'someone@example.com' }).proj, caseName: 'docs-sync' }).refusal.code === 'unrecognized' && same(fx, before)); }
  { const fx = mkSeedFixture('seed-cli'); const c = captureIo(); const code = H.main(['seed', '--project', fx.proj, '--case', 'docs-sync'], c.io);
    G('the seed command prints BASE, HEAD and RANGE and exits 0 on success', code === 0 && c.o.length === 3 && /^BASE [0-9a-f]{40}$/.test(c.o[0]) && /^HEAD [0-9a-f]{40}$/.test(c.o[1]) && c.o[2] === `RANGE ${c.o[0].slice(5)}..${c.o[1].slice(5)}`, { code, out: c.o });
    const fx2 = mkSeedFixture('seed-cli2'); putF(fx2.proj, 'src/app.ts', 'changed\n'); const c2 = captureIo(); const code2 = H.main(['seed', '--project', fx2.proj, '--case', 'docs-sync'], c2.io);
    G('the seed command exits 2 with REFUSED on a refusal', code2 === 2 && c2.e.some((l) => /^REFUSED dirty: /.test(l)) && c2.o.length === 0, { code2, err: c2.e }); }
}

// ============================================================== GROUP: verification fails closed (R3, R5) ====
const VERIFY_POINTERS = ['docs/database.md', '.ai/context/glossary.md'];
// A manifest the production checkManifest accepts (schema 3, N13): the verification validates the whole file, so a fixture manifest carries the fields a real one has.
const MANIFEST_BASE = { schema: 3, skill: 'project-setup', skillVersion: '3.1.0', mode: 'adopt', agents: ['claude'], sourceCommit: null };
const ownershipRecord = (v) => (v === 'merged' ? { ownership: 'merged' } : { ownership: v, sha256: 'a'.repeat(64) });
const manifestJson = (files, over = {}) => `${JSON.stringify({ ...MANIFEST_BASE, ...over, files }, null, 2)}\n`;
// 03 with every template blank replaced by an explicit unknown, so the mapped sections of a fixture hold no unresolved blank (N9); the untouched BS03 holds several.
const FILLED03 = BS03.replace(/`<[^`\n>]+>`/g, 'unknown');
function verifyFiles(o = {}) {
  const manifest = Object.fromEntries([...VERIFY_POINTERS.map((r) => [r, { ownership: 'merged' }]), ...(o.manifest03 === undefined ? [] : [[H.BS_03_REL, ownershipRecord(o.manifest03)]])]);
  return {
    [H.BS_03_REL]: FILLED03,
    ...Object.fromEntries(VERIFY_POINTERS.map((r) => [r, pointerOf(r)])),
    'AGENTS.md': renderAgents(true),
    'CLAUDE.md': MERGED_CLAUDE,
    '.claude/agents/reviewer.md': WRAPPER.reviewer,
    '.claude/agents/docs-sync.md': WRAPPER['docs-sync'],
    'TODO.md': '# TODO\n',
    [H.MANIFEST_REL]: manifestJson(manifest),
    ...(o.files ?? {}),
  };
}
const mkVerify = (label, o = {}) => liveProj(label, verifyFiles(o));
const EVID = (o = {}) => ({ schema: 1, layout: 'bs-mapped', conversion: 'complete', pointers: [...VERIFY_POINTERS], fullDocuments: [], inventory: [], dispositions: {}, claude: { bsImports: BS_IMPORTS, bsVersionSentence: BS_SENTENCE, userLines: [USER_LINE] }, agents: { reviewer: { disposition: 'take-new' }, 'docs-sync': { disposition: 'take-new' } }, extensions: {}, ...o });
// The advisory contract (plan amendment 1): verify returns { outcome, findings, notEvaluable, checked, expectPartial } and nothing says passed or complete. Every result and every
// CLI run of verify in this spec is recorded, so the property group at the end asserts the contract over ALL of them, not only over the cases written for it.
const VERIFY_LOG = [];
const CLI_LOG = [];
const clean = (r) => r.outcome === 'no-automated-findings';
// Not evaluable means nothing ran: no finding, no check listed as without a finding, only reasons (optionally one matching re).
const notEval = (r, re) => r.outcome === 'not-evaluable' && r.findings.length === 0 && r.checked.length === 0 && r.notEvaluable.length > 0 && (re === undefined || r.notEvaluable.some((x) => re.test(String(x))));
const findingNames = (r) => r.findings.map((x) => x.name);
const findingDetail = (r, re) => (r.findings.find((x) => re.test(x.name)) ?? {}).detail;
// A check about one file has a CONSTANT name and carries the file in its detail (N17): a string "<path>: <what>" or { path, found }. findingAt is the finding of that check for that path.
const CHK = Object.freeze({ listedPointer: 'a pointer the evidence lists is present and is a pointer', listedFullDoc: 'a full document the evidence lists is present and is not a pointer', pointerInspect: 'a pointer: path, headings, routing and format', pointerOwner: 'a pointer: merged ownership', extension: 'a project extension: existing bytes kept, only the approved text appended' });
const detailPath = (d) => (typeof d === 'string' ? d.split(': ')[0] : d !== null && typeof d === 'object' ? d.path : undefined);
const findingAt = (r, name, rel) => r.findings.find((x) => x.name === name && detailPath(x.detail) === rel);
const diag = (r) => ({ outcome: r.outcome, findings: r.findings.map((x) => x.name), reasons: r.notEvaluable });
const V = (args) => { const r = H.verifyProject(args); VERIFY_LOG.push({ r, expectPartial: args !== null && typeof args === 'object' && args.expectPartial === true }); return r; };
const VF = (args) => { const r = H.verifyFromFiles(args); VERIFY_LOG.push({ r, expectPartial: args.expectPartial === true }); return r; };
const mainV = (argv, io) => { const out = []; const err = []; const code = H.main(argv, { out: (s) => { out.push(s); io.out(s); }, err: (s) => { err.push(s); io.err(s); } }); if (argv[0] === 'verify') CLI_LOG.push({ argv, code, out: out.join('\n'), err: err.join('\n') }); return code; };
const verify = (root, o = {}) => V({ project: root, baseline: o.baseline === undefined ? H.takeSnapshot(root) : o.baseline, evidence: o.evidence === undefined ? EVID() : o.evidence, expectPartial: o.expectPartial === true });
const clone = (v) => JSON.parse(JSON.stringify(v));
{
  const G = grp('Verify (R3)');
  const ok = verify(mkVerify('v-ok'));
  G('control: a fixture in which every check finds nothing returns no-automated-findings, lists the checks that ran, and the report says the maintainer review is required', clean(ok) && ok.findings.length === 0 && ok.notEvaluable.length === 0 && ok.checked.length >= 14 && /^OUTCOME no-automated-findings: maintainer review required/m.test(H.formatVerify(ok, false)), diag(ok));
  const nope = V({ project: path.join(LIVE, 'no-such-project'), baseline: H.takeSnapshot(mkVerify('v-b')), evidence: EVID() });
  G('a project that does not exist is not evaluable: no check ran, no check is listed as without a finding, and the outcome line says not-evaluable', notEval(nope, /does not exist/) && /^OUTCOME not-evaluable/m.test(H.formatVerify(nope, false)) && !/^NO FINDING/m.test(H.formatVerify(nope, false)) && /^0 checks without a finding \/ 0 findings \/ 1 reasons not evaluable$/m.test(H.formatVerify(nope, false)), H.formatVerify(nope, false));
  { const f = liveProj('v-file', { 'x.txt': 'x\n' }); const asFile = V({ project: path.join(f, 'x.txt'), baseline: H.takeSnapshot(mkVerify('v-b2')), evidence: EVID() });
    G('a project that is a file is not evaluable', notEval(asFile), diag(asFile)); }
  { const real = mkVerify('v-real'); const link = path.join(liveDir('v-link'), 'lnk');
    if (!liveJunction(real, link)) skip('a project that is a junction is not evaluable', 'a junction cannot be created on this host');
    else { const r = V({ project: link, baseline: H.takeSnapshot(real), evidence: EVID() }); G('a project that is itself a junction is not evaluable (no read through a link)', notEval(r), diag(r)); } }
  { const root = mkVerify('v-base'); const snap = H.takeSnapshot(root);
    const BASES = [['undefined', undefined], ['null', null], ['an empty object', {}], ['a string', 'x'], ['an array', []],
      ['an empty file inventory', { ...clone(snap), files: {} }], ['no files key', (() => { const b = clone(snap); delete b.files; return b; })()], ['a foreign tool', { ...clone(snap), tool: 'other' }], ['a wrong schema', { ...clone(snap), schema: 2 }],
      ['a file record with a bad sha256', (() => { const b = clone(snap); b.files['AGENTS.md'].sha256 = 'zz'; return b; })()], ['no manifest summary', (() => { const b = clone(snap); delete b.manifest; return b; })()], ['a malformed manifest summary', { ...clone(snap), manifest: { state: 'malformed' } }], ['a skipped manifest summary', { ...clone(snap), manifest: { state: 'skipped' } }], ['a valid manifest summary without ownership', { ...clone(snap), manifest: { state: 'valid' } }]];
    for (const [label, b] of BASES) { const r = V({ project: root, baseline: b, evidence: EVID() }); G(`${label} as the baseline is not evaluable (never a pass, no check runs)`, notEval(r), r.outcome); } }
  { const root = mkVerify('v-ev');
    for (const [label, e] of [['undefined', undefined], ['null', null], ['an empty object', {}], ['an array', []], ['a string', 'x']]) { const r = V({ project: root, baseline: H.takeSnapshot(root), evidence: e }); G(`${label} as the scenario evidence is not evaluable`, notEval(r), r.outcome); }
    for (const k of H.REQUIRED_EVIDENCE) { const e = EVID(); delete e[k]; const r = verify(root, { evidence: e }); G(`omitting evidence.${k} makes the verification not evaluable and names the key (the checks it stands for are never silently skipped)`, r.outcome === 'not-evaluable' && r.notEvaluable.some((x) => String(x).includes(k)), r.notEvaluable); }
    G('an unknown evidence key is not evaluable', verify(root, { evidence: EVID({ surprise: 1 }) }).outcome === 'not-evaluable');
    G('the optional evidence keys may be omitted and an explicit expectPartial equal to the flag is accepted', verify(root, { evidence: EVID({ expectPartial: false }) }).outcome === 'no-automated-findings');
    G('an evidence expectPartial that contradicts the flag is not evaluable', verify(root, { evidence: EVID({ expectPartial: true }) }).outcome === 'not-evaluable' && verify(root, { evidence: EVID({ conversion: 'held', expectPartial: false }), expectPartial: true }).outcome === 'not-evaluable');
    for (const [label, e] of [['an unknown layout', EVID({ layout: 'mapped' })], ['an unknown conversion', EVID({ conversion: 'done' })], ['a pending conversion', EVID({ conversion: 'pending' })], ['schema 2', EVID({ schema: 2 })], ['an empty pointer list on a converted bs-mapped layout', EVID({ pointers: [] })], ['a pointer path outside the pointer directories', EVID({ pointers: ['src/x.md'] })], ['a pointer path that escapes', EVID({ pointers: ['../x.md'] })], ['inventory that is not a list', EVID({ inventory: {} })], ['an inventory fact without a token', EVID({ inventory: [{ id: 'a' }] })], ['dispositions that are not an object', EVID({ dispositions: [] })], ['claude evidence that is not an object', EVID({ claude: 'x' })], ['agents that omit docs-sync', EVID({ agents: { reviewer: { disposition: 'take-new' } } })], ['agents that omit reviewer', EVID({ agents: { 'docs-sync': { disposition: 'take-new' } } })], ['an unknown agent', EVID({ agents: { reviewer: { disposition: 'take-new' }, 'docs-sync': { disposition: 'take-new' }, extra: { disposition: 'keep' } } })], ['an agent with an unknown disposition', EVID({ agents: { reviewer: { disposition: 'maybe' }, 'docs-sync': { disposition: 'take-new' } } })], ['an agent without a disposition', EVID({ agents: { reviewer: {}, 'docs-sync': { disposition: 'take-new' } } })], ['extensions that are not an object', EVID({ extensions: [] })], ['an extension that is not an object', EVID({ extensions: { '.ai/agents/reviewer.project.md': 'x' } })], ['unrelatedAgentsLines that are not text', EVID({ unrelatedAgentsLines: [1] })], ['nested without a dir', EVID({ nested: [{}] })]]) {
      const r = verify(root, { evidence: e }); G(`${label} is not evaluable`, r.outcome === 'not-evaluable', r.outcome);
    }
    G('a pending conversion is not evaluable even when a partial outcome is expected', verify(root, { evidence: EVID({ conversion: 'pending' }), expectPartial: true }).outcome === 'not-evaluable');
  }
  // Conversion outcomes: held, partial and pending are never "complete".
  { const root = mkVerify('v-conv'); const base = H.takeSnapshot(root);
    for (const conv of ['held', 'partial']) {
      const r = verify(root, { baseline: base, evidence: EVID({ conversion: conv }) });
      G(`a ${conv} conversion is reported against the full expectation: a finding, never a clean outcome`, r.outcome === 'findings' && findingNames(r).some((n) => /full conversion and a canonical agent layer/.test(n)) && /^OUTCOME findings: /m.test(H.formatVerify(r, false)) && !/no-automated-findings/.test(H.formatVerify(r, false)), findingNames(r));
      const e = verify(root, { baseline: base, evidence: EVID({ conversion: conv }), expectPartial: true });
      G(`a ${conv} conversion verified with --expect-partial has no findings and says "expected partial outcome — maintainer review required"`, clean(e) && e.expectPartial === true && /^OUTCOME no-automated-findings: expected partial outcome — maintainer review required/m.test(H.formatVerify(e, true)), findingNames(e));
    }
    const c = verify(root, { baseline: base, evidence: EVID({ conversion: 'complete' }), expectPartial: true });
    G('a complete conversion cannot pass as an expected-partial case (the expectation is checked both ways)', c.outcome === 'findings' && findingNames(c).some((n) => /really is partial/.test(n)), findingNames(c)); }
  { const keep = { disposition: 'keep', retainedBytes: BS_AGENT['docs-sync'], incomplete: true, invokedDefinition: '.claude/agents/docs-sync.md' };
    const root = mkVerify('v-keep', { files: { '.claude/agents/docs-sync.md': BS_AGENT['docs-sync'] } }); const base = H.takeSnapshot(root);
    const ev = (o = {}) => EVID({ conversion: 'partial', agents: { reviewer: { disposition: 'take-new' }, 'docs-sync': keep }, ...o });
    const d = verify(root, { baseline: base, evidence: ev() }); const e = verify(root, { baseline: base, evidence: ev(), expectPartial: true });
    G('a declined docs-sync replacement (retained bytes, incomplete, definition named) is a finding in the default run and has none only as an expected partial outcome', d.outcome === 'findings' && clean(e) && e.findings.length === 0, { d: findingNames(d), e: findingNames(e) });
    const a = verify(root, { baseline: base, evidence: ev({ conversion: 'complete' }) });
    G('a kept agent under evidence that says complete is still incomplete (the agent decides, not the label)', a.outcome === 'findings', findingNames(a));
    const w = verify(root, { baseline: base, evidence: ev({ agents: { reviewer: { disposition: 'take-new' }, 'docs-sync': { ...keep, retainedBytes: `${BS_AGENT['docs-sync']}x` } } }), expectPartial: true });
    G('retained bytes that differ from the file fail even when a partial outcome is expected', w.outcome === 'findings' && findingNames(w).some((n) => /docs-sync\.md: keep/.test(n)), findingNames(w)); }
  // Required checks never depend on optional evidence or on the presence of a file.
  const MUT = [
    ['the manifest is missing', (r) => fs.rmSync(path.join(r, '.ai', 'manifest.json')), /manifest\.json is present and parses/],
    ['the manifest is malformed', (r) => putF(r, '.ai/manifest.json', '{nope'), /manifest\.json is present and parses/],
    ['the manifest holds no files object', (r) => putF(r, '.ai/manifest.json', '{"version":"3"}\n'), /manifest\.json is present and parses/],
    ['the root AGENTS.md is missing', (r) => fs.rmSync(path.join(r, 'AGENTS.md')), /root AGENTS\.md is present/],
    ['the routing paragraph was removed from AGENTS.md', (r) => putF(r, 'AGENTS.md', renderAgents(true).replace(ROOT_PARAGRAPH, '')), /root AGENTS\.md: routing/],
    ['CLAUDE.md is missing', (r) => fs.rmSync(path.join(r, 'CLAUDE.md')), /CLAUDE\.md: import/],
    ['the reviewer wrapper is missing', (r) => fs.rmSync(path.join(r, '.claude', 'agents', 'reviewer.md')), /reviewer\.md: take-new/],
    ['the docs-sync wrapper was replaced by other bytes', (r) => putF(r, '.claude/agents/docs-sync.md', 'something else\n'), /docs-sync\.md: take-new/],
    ['a listed pointer is no longer a pointer', (r) => putF(r, 'docs/database.md', '# Database\n\nfull facts\n'), [CHK.listedPointer, 'docs/database.md']],
    ['a pointer names a heading that does not exist', (r) => putF(r, 'docs/database.md', pointerOf('docs/database.md', { bullets: [...H.mappingRefsFor('docs/database.md'), 'Persistence'] })), [CHK.pointerInspect, 'docs/database.md']],
    ['a pointer lost its merged ownership', (r) => putF(r, '.ai/manifest.json', manifestJson({ 'docs/database.md': { ownership: 'full', sha256: 'a'.repeat(64) }, '.ai/context/glossary.md': { ownership: 'merged' } })), [CHK.pointerOwner, 'docs/database.md']],
    ['03 is missing', (r) => fs.rmSync(path.join(r, H.BS_03_REL)), /03 is still present/],
    ['an unexplained new file appeared in the inventory', (r) => putF(r, '.ai/context/extra.md', '# extra\n'), /no unexplained collateral/],
  ];
  for (const [label, fn, re] of MUT) {
    const root = mkVerify('v-mut'); const base = H.takeSnapshot(root); fn(root);
    const r = attempt(() => verify(root, { baseline: base }));
    // re is a name pattern, or [constant check name, path] for a check about one file (the path is in the detail, N17).
    const hit = r.threw === undefined && (Array.isArray(re) ? findingAt(r, re[0], re[1]) !== undefined : findingNames(r).some((n) => re.test(n)));
    G(`${label}: the verification FAILS on that check (it is never skipped as optional)`, r.threw === undefined && r.outcome === 'findings' && hit, r.threw ?? findingNames(r));
  }
  { const ORD_CLAUDE = `${PS_CLAUDE_TEMPLATE}\n${USER_LINE}\n`; const ORD_EV = (o = {}) => EVID({ layout: 'ordinary', pointers: [], fullDocuments: [], conversion: 'complete', claude: { bsImports: [], bsVersionSentence: null, userLines: [USER_LINE] }, ...o });
    const root = mkVerify('v-ordinary', { files: { 'AGENTS.md': renderAgents(false), 'CLAUDE.md': ORD_CLAUDE, [H.BS_03_REL]: null, [H.MANIFEST_REL]: null, ...Object.fromEntries(VERIFY_POINTERS.map((p) => [p, null])) } }); const base = H.takeSnapshot(root);
    const r = verify(root, { baseline: base, evidence: ORD_EV() });
    G('an ordinary (non-mapped) layout needs no manifest or pointers, and still runs the instruction, CLAUDE.md and agent checks', clean(r) && r.checked.some((x) => /root AGENTS\.md/.test(x.name)) && r.checked.some((x) => /CLAUDE\.md: import/.test(x.name)) && r.checked.filter((x) => /take-new/.test(x.name)).length === 2, diag(r));
    const stale = mkVerify('v-ordinary-bs', { files: { 'AGENTS.md': renderAgents(false), [H.MANIFEST_REL]: null } });
    const s = verify(stale, { baseline: H.takeSnapshot(stale), evidence: ORD_EV({ claude: EVID().claude }) });
    G('control (N8): the same ordinary claim over a project that still carries the BS signals and 03 is a finding, because the observed signals activate (an ordinary layout is not taken on the evidence alone)', s.outcome === 'findings' && findingNames(s).some((n) => /observed activation signals agree/.test(n)), diag(s)); }


  { const root = liveProj('v-sparse', { 'AGENTS.md': '# a\n' }); G('control: a scratch project with only one file is not mistaken for a verified one', verify(root, { baseline: H.takeSnapshot(root) }).outcome !== 'no-automated-findings'); }
  // A broken project policy is a stop for the whole verification.
  for (const [label, text] of [['malformed', '{nope'], ['unsupported schema', '{"schema":9,"patterns":[]}']]) {
    const root = mkVerify('v-pol'); const base = H.takeSnapshot(root); putF(root, POLICY_REL, text);
    const r = verify(root, { baseline: base });
    G(`a ${label} project policy makes the verification not evaluable (no fallback to the defaults)`, notEval(r, /POLICY_MALFORMED/), r.notEvaluable);
  }
  // The three outcomes read differently.
  G('the three outcomes read differently: a clean result, a finding and a missing input never share an OUTCOME line, and each line names its outcome', (() => { const line = (r) => H.formatVerify(r, false).match(/^OUTCOME .*$/gm) ?? []; const a = line(ok); const b = line(verify(mkVerify('v-f'), { evidence: EVID({ conversion: 'held' }) })); const c = line(nope); return [a, b, c].every((l) => l.length === 1) && new Set([a[0], b[0], c[0]]).size === 3 && /^OUTCOME no-automated-findings/.test(a[0]) && /^OUTCOME findings/.test(b[0]) && /^OUTCOME not-evaluable/.test(c[0]); })());
}

// ============================================================== GROUP: ownership of an unchanged 03 (R5) ====
{
  const G = grp('Ownership of 03 (R5)');
  const SHA_OTHER = 'a'.repeat(64);
  const run = (o = {}) => {
    const root = mkVerify('v-own', { manifest03: o.now });
    const base = clone(H.takeSnapshot(root));
    base.manifest = o.baseManifest ?? { state: 'valid', ownership: { ...Object.fromEntries(VERIFY_POINTERS.map((p) => [p, 'merged'])), ...(o.baseline03 === undefined ? {} : { [H.BS_03_REL]: o.baseline03 }) } };
    if (o.changed) base.files[H.BS_03_REL].sha256 = SHA_OTHER;
    if (o.baseWithout03) delete base.files[H.BS_03_REL];
    if (o.drop03) fs.rmSync(path.join(root, H.BS_03_REL));
    return verify(root, { baseline: base });
  };
  const own03 = (r) => { const f = r.findings.find((x) => /^03 (unchanged|changed)/.test(x.name)); const c = r.checked.find((x) => /^03 (unchanged|changed)/.test(x.name)); return { name: (f ?? c).name, ok: f === undefined }; };
  const A = run({ now: 'merged', baseline03: 'merged' });
  G('a legitimate unchanged rerun keeps an EXISTING approved merged record on 03 and verifies (the old rule demanded no record at all)', A.outcome === 'no-automated-findings' && own03(A).ok === true && /^03 unchanged/.test(own03(A).name), findingNames(A));
  const B = run({ now: 'merged' });
  G('an unchanged 03 that is newly claimed (merged, with no record in the baseline) fails', B.outcome === 'findings' && /^03 unchanged/.test(own03(B).name) && own03(B).ok === false, findingNames(B));
  const C = run({ baseline03: 'merged' });
  G('an unchanged 03 whose approved record vanished fails (the record must be preserved)', C.outcome === 'findings' && own03(C).ok === false, findingNames(C));
  const D = run({});
  G('an unchanged 03 with no record before and none after is a clean read-only run', D.outcome === 'no-automated-findings' && own03(D).ok === true, findingNames(D));
  const E = run({ now: 'full', baseline03: 'full' });
  G('an unchanged 03 keeps whatever record it had, even a non-merged one (the rule compares to the baseline, it does not rewrite it)', E.outcome === 'no-automated-findings' && own03(E).ok === true, findingNames(E));
  const F = run({ now: 'merged', baseline03: 'full' });
  G('an unchanged 03 whose ownership value changed between runs fails', F.outcome === 'findings' && own03(F).ok === false, findingNames(F));
  const H1 = run({ changed: true, now: 'merged' });
  G('a changed 03 must be merged: merged passes', H1.outcome === 'no-automated-findings' && /^03 changed/.test(own03(H1).name) && own03(H1).ok === true, findingNames(H1));
  const H2 = run({ changed: true });
  G('a changed 03 with no ownership record fails', H2.outcome === 'findings' && /^03 changed/.test(own03(H2).name) && own03(H2).ok === false, findingNames(H2));
  const H3 = run({ changed: true, now: 'merged', baseline03: 'merged' });
  G('a changed 03 under an existing merged record stays merged and passes', H3.outcome === 'no-automated-findings', findingNames(H3));
  const I = run({ baseWithout03: true });
  G('a 03 that did not exist in the baseline counts as changed: it needs a merged record', I.outcome === 'findings' && /^03 changed/.test(own03(I).name), findingNames(I));
  const J = run({ drop03: true, baseline03: 'merged' });
  G('a 03 that was deleted since the baseline fails (present check), whatever the manifest says', J.outcome === 'findings' && findingNames(J).some((n) => /03 is still present/.test(n)), findingNames(J));
  G('a baseline whose manifest could not be summarised is not evaluable for ownership (never compared as absent)', run({ baseManifest: { state: 'malformed' } }).outcome === 'not-evaluable' && run({ baseManifest: { state: 'skipped' } }).outcome === 'not-evaluable');
  G('a baseline manifest that is absent means no record existed: an unchanged 03 must then carry none', run({ baseManifest: { state: 'absent' } }).outcome === 'no-automated-findings' && run({ baseManifest: { state: 'absent' }, now: 'merged' }).outcome === 'findings');
  // A snapshot records the summary the check reads, and a second unchanged run compared with its own predecessor verifies.
  { const root = mkVerify('v-own2', { manifest03: 'merged' }); const s1 = H.takeSnapshot(root);
    G('a snapshot keeps the manifest ownership summary (valid, per path) and nothing else of the manifest', s1.manifest.state === 'valid' && s1.manifest.ownership[H.BS_03_REL] === 'merged' && s1.manifest.ownership['docs/database.md'] === 'merged' && Object.keys(s1.manifest).sort().join() === 'ownership,state' && s1.files[H.MANIFEST_REL].text === undefined);
    const s2 = verify(root, { baseline: s1 });
    G('after a second unchanged run, verification against the snapshot taken before it passes with the 03 record preserved', s2.outcome === 'no-automated-findings', findingNames(s2));
    const none = liveProj('v-own3', { 'AGENTS.md': '# a\n' });
    G('a snapshot of a project without a manifest records state absent', H.takeSnapshot(none).manifest.state === 'absent');
    const bad = liveProj('v-own4', { [H.MANIFEST_REL]: '{nope', 'AGENTS.md': '# a\n' });
    G('a snapshot of a malformed manifest records state malformed', H.takeSnapshot(bad).manifest.state === 'malformed' && H.summarizeManifest('[]').state === 'malformed' && H.summarizeManifest('{"files":[]}').state === 'malformed' && H.summarizeManifest('{"files":{"a":{"ownership":"merged"},"b":{}}}').ownership.b === null); }
}

// ============================================================== GROUP: verify command (R3) ====
{
  const G = grp('Verify command (R3)');
  const dir = liveDir('cli-verify'); const root = mkVerify('cli-proj');
  const bp = path.join(dir, 'baseline.json'); const ep = path.join(dir, 'evidence.json');
  fs.writeFileSync(bp, H.snapshotJson(H.takeSnapshot(root))); fs.writeFileSync(ep, JSON.stringify(EVID()));
  const cli = (args) => { const c = captureIo(); const code = mainV(['verify', ...args], c.io); return { code, out: c.o.join('\n'), err: c.e.join('\n') }; };
  const full = cli(['--project', root, '--baseline', bp, '--evidence', ep]);
  G('control: the command exits 0 with the no-automated-findings outcome and "maintainer review required" when project, baseline and evidence are all present and no check finds anything', full.code === 0 && /^OUTCOME no-automated-findings: maintainer review required/m.test(full.out) && /^KNOWN LIMITATIONS/m.test(full.out) && !/^FINDING|^NOT EVALUABLE/m.test(full.out), full);
  const noEv = cli(['--project', root, '--baseline', bp]);
  G('omitting --evidence is not evaluable: exit 3, NOT EVALUABLE, the not-evaluable outcome and no clean outcome', noEv.code === 3 && /^NOT EVALUABLE/m.test(noEv.out) && /^OUTCOME not-evaluable/m.test(noEv.out) && !/no-automated-findings/.test(noEv.out), noEv);
  G('a missing baseline file is exit 3 and not evaluable', (() => { const r = cli(['--project', root, '--baseline', path.join(dir, 'nope.json'), '--evidence', ep]); return r.code === 3 && /NOT EVALUABLE/.test(r.out) && /baseline file could not be read/.test(r.out); })());
  G('a baseline that is not JSON is exit 3 and not evaluable', (() => { const f = path.join(dir, 'bad-baseline.json'); fs.writeFileSync(f, '{nope'); const r = cli(['--project', root, '--baseline', f, '--evidence', ep]); return r.code === 3 && /baseline file could not be read/.test(r.out); })());
  G('an evidence file that is not JSON is exit 3 and not evaluable', (() => { const f = path.join(dir, 'bad-evidence.json'); fs.writeFileSync(f, '{nope'); const r = cli(['--project', root, '--baseline', bp, '--evidence', f]); return r.code === 3 && /evidence file could not be read/.test(r.out); })());
  G('an empty evidence object is exit 3 and not evaluable', (() => { const f = path.join(dir, 'empty-evidence.json'); fs.writeFileSync(f, '{}'); const r = cli(['--project', root, '--baseline', bp, '--evidence', f]); return r.code === 3 && /NOT EVALUABLE/.test(r.out); })());
  G('a project that does not exist is exit 3 and not evaluable', cli(['--project', path.join(dir, 'no-project'), '--baseline', bp, '--evidence', ep]).code === 3);
  G('--expect-partial on a full conversion is a finding (exit 1), on a held conversion has no findings (exit 0) with the expected-partial wording, and the same held case without the flag is a finding (exit 1)', (() => { const a = cli(['--project', root, '--baseline', bp, '--evidence', ep, '--expect-partial']); const f = path.join(dir, 'held.json'); fs.writeFileSync(f, JSON.stringify(EVID({ conversion: 'held' }))); const h = cli(['--project', root, '--baseline', bp, '--evidence', f, '--expect-partial']); const d = cli(['--project', root, '--baseline', bp, '--evidence', f]); return a.code === 1 && /^OUTCOME findings/m.test(a.out) && h.code === 0 && /^OUTCOME no-automated-findings: expected partial outcome — maintainer review required/m.test(h.out) && d.code === 1 && /^OUTCOME findings/m.test(d.out); })());
}

// ============================================================== GROUP: evidence cannot override the checker (review round 2, N1) ====
// The reviewed evidence says WHAT the project should look like; it never supplies what the checker observes or the canonical sources it
// compares with. Round 2 found `...evidence.claude` letting the evidence replace the observed CLAUDE.md text (and the canonical template), so a
// broken file passed. Every evidence object that reaches a checker is covered here: claude (spread, closed), then the objects that are picked
// field by field (agents, extensions, nested) as pins, and the lookups the evidence chooses the KEY of (dispositions, full documents).
{
  const G = grp('Evidence is checker-controlled (N1)');
  const bad = mkVerify('n1-bad', { files: { 'CLAUDE.md': BS_CLAUDE() } }); // BS content only: the PS import and the managed block are lost
  const badBase = H.takeSnapshot(bad);
  const vb = (e) => attempt(() => verify(bad, { baseline: badBase, evidence: e })); // a throw is a failing case, never an aborted spec
  const claudeWith = (c) => EVID({ claude: { ...EVID().claude, ...c } });
  const okRoot = mkVerify('n1-ok');
  const okBase = H.takeSnapshot(okRoot);
  const vo = (e) => attempt(() => verify(okRoot, { baseline: okBase, evidence: e }));
  const plain = vb(EVID());
  G('control: a CLAUDE.md that lost the PS import and the managed block fails its recovery check, so the run fails', plain.outcome === 'findings' && findingNames(plain).some((n) => /CLAUDE\.md: import/.test(n)), findingNames(plain));
  const probe = vb(claudeWith({ text: MERGED_CLAUDE }));
  G('the review probe: the valid CLAUDE.md supplied as evidence.claude.text is not evaluable and never clean (the spread used to return a pass)', notEval(probe, /\btext\b/), diag(probe));
  const weak = mkVerify('n1-weak', { files: { 'CLAUDE.md': MERGED_CLAUDE.replace('You MUST NOT infer a subdirectory start', 'You may infer a subdirectory start') } });
  const weakBase = H.takeSnapshot(weak);
  const vw = (e) => attempt(() => verify(weak, { baseline: weakBase, evidence: e }));
  G('control: a CLAUDE.md whose managed block was weakened fails claude-block-content', vw(EVID()).outcome === 'findings' && findingNames(vw(EVID())).some((n) => /CLAUDE\.md: import/.test(n)));
  G('the canonical template supplied as evidence.claude.templateText (here: the weakened file itself) is not evaluable and never a pass', notEval(vw(claudeWith({ templateText: rd(path.join(weak, 'CLAUDE.md')) })), /templateText/));
  G('text and templateText supplied together are not evaluable either', notEval(vw(claudeWith({ text: MERGED_CLAUDE, templateText: rd(path.join(weak, 'CLAUDE.md')) })), /text/));
  for (const k of ['text', 'templateText', 'shippedWrapper', 'surprise', 'constructor', 'toString']) G(`an evidence.claude key "${k}" is not accepted (only bsImports, bsVersionSentence and userLines are documented), and the report names it`, notEval(vb(claudeWith({ [k]: 'x' })), new RegExp(k)), vb(claudeWith({ [k]: 'x' })).outcome);
  { const e = EVID(); e.claude = JSON.parse(`{"bsImports":[],"__proto__":{"text":${JSON.stringify(MERGED_CLAUDE)}}}`);
    G('an own "__proto__" key parsed from JSON is an unknown key, not an inheritance channel', notEval(vb(e), /__proto__/)); }
  for (const [label, c] of [['bsImports that is a string', { bsImports: BS_IMPORTS[0] }], ['bsImports with a non-text item', { bsImports: [1] }], ['bsImports with a null item', { bsImports: [null] }], ['bsImports with an empty item', { bsImports: [''] }], ['bsImports with a blank item', { bsImports: ['   '] }], ['bsImports that is an object', { bsImports: {} }],
    ['a bsVersionSentence that is a number', { bsVersionSentence: 1 }], ['an empty bsVersionSentence', { bsVersionSentence: '' }], ['a blank bsVersionSentence', { bsVersionSentence: '  ' }], ['a bsVersionSentence that is a list', { bsVersionSentence: [BS_SENTENCE] }],
    ['userLines that is a string', { userLines: USER_LINE }], ['userLines with a non-text item', { userLines: [2] }], ['userLines with an empty item', { userLines: [''] }], ['userLines that is null', { userLines: null }]]) {
    G(`${label} is not evaluable (a vacuous or mistyped expectation checks nothing)`, notEval(vo(claudeWith(c))), vo(claudeWith(c)).outcome);
  }
  // Superseded (round 3, N3): this control used to say the three fields are each optional and passed `claude: {}` and `{ userLines }` alone. An omitted
  // field turned its preservation check off, so a CLAUDE.md that lost the baseline content passed; the three are required now (group N3 below).
  G('controls: the documented fields stay accepted when all three are stated, bsVersionSentence may be null, and an explicit "none apply" for all three passes', vo(claudeWith({})).outcome === 'no-automated-findings' && vo(claudeWith({ bsVersionSentence: null })).outcome === 'no-automated-findings' && vo(EVID({ claude: { bsImports: [], bsVersionSentence: null, userLines: [] } })).outcome === 'no-automated-findings');
  G('the observed CLAUDE.md is what is judged: the same documented evidence that passes a good file fails the broken one', vo(EVID()).outcome === 'no-automated-findings' && vb(EVID()).outcome === 'findings');
  { const dir = liveDir('n1-cli'); const bp = path.join(dir, 'baseline.json'); const ep = path.join(dir, 'evidence.json');
    fs.writeFileSync(bp, H.snapshotJson(badBase)); fs.writeFileSync(ep, JSON.stringify(claudeWith({ text: MERGED_CLAUDE })));
    const c = captureIo(); const code = mainV(['verify', '--project', bad, '--baseline', bp, '--evidence', ep], c.io); const out = c.o.join('\n');
    G('the verify command refuses the override too: exit 3, NOT EVALUABLE, no pass line', code === 3 && /NOT EVALUABLE/.test(out) && /^OUTCOME not-evaluable/m.test(out) && !/no-automated-findings/.test(out), { code, out }); }
}

// ============================================================== GROUP: the Claude preservation evidence is required (review round 3, N3) ====
// Round 3 found `claude: {}` returning passed/complete for a CLAUDE.md that kept the canonical PS import and managed block but had lost the baseline BS
// imports, the BS provenance sentence and the user's own line: each expectation that is empty turns its preservation check off, so omitting the field
// disabled the check. The three fields are required now; "none apply" is stated explicitly ([] for the lists, null for the sentence).
{
  const G = grp('Claude preservation evidence is required (N3)');
  const lost = mkVerify('n3-lost', { files: { 'CLAUDE.md': PS_CLAUDE_TEMPLATE } }); // canonical PS import and block only: every baseline BS and user line is gone
  const lostBase = H.takeSnapshot(lost);
  const vl = (e) => attempt(() => verify(lost, { baseline: lostBase, evidence: e }));
  const recoveryCodes = (r) => (findingDetail(r, /CLAUDE\.md: import/) ?? []).map((d) => d.code);
  const withClaude = vl(EVID());
  G('control: with all three expectations supplied, the content-loss CLAUDE.md fails and names every loss (BS import, provenance sentence, user line)', withClaude.outcome === 'findings' && ['bs-import-lost', 'bs-version-lost', 'user-content-lost'].every((c) => recoveryCodes(withClaude).includes(c)) && !['import-count', 'claude-block-count', 'claude-block-content'].some((c) => recoveryCodes(withClaude).includes(c)), { outcome: withClaude.outcome, codes: recoveryCodes(withClaude) });
  const empty = vl(EVID({ claude: {} }));
  G('the review probe: claude: {} on the content-loss CLAUDE.md is not evaluable and never clean (it returned a pass), and the report names all three omitted fields', notEval(empty, /omits required fields: bsImports, bsVersionSentence, userLines/) && !clean(empty), diag(empty));
  for (const k of H.CLAUDE_EVIDENCE_KEYS) {
    const c = { ...EVID().claude }; delete c[k];
    const r = vl(EVID({ claude: c }));
    G(`omitting evidence.claude.${k} alone is not evaluable and names that field, with the other two supplied`, notEval(r, new RegExp(`omits required fields: ${k}\\b`)), diag(r));
    const onlyThis = vl(EVID({ claude: { [k]: EVID().claude[k] } }));
    G(`supplying only evidence.claude.${k} is not evaluable either (the other two preservation checks must not be switched off)`, notEval(onlyThis, /omits required fields/), onlyThis.outcome);
  }
  G('omitting evidence.claude altogether is not evaluable and names the key', (() => { const e = EVID(); delete e.claude; const r = vl(e); return notEval(r, /omits required keys: claude/); })());
  G('controls: an explicit "none apply" ([], null, []) is a statement and is accepted as input (the content-loss project has no BS signals, so the run is evaluable and the layout claim is a finding), and on a CLAUDE.md with the full content the full expectations find nothing', (() => { const none = vl(EVID({ claude: { bsImports: [], bsVersionSentence: null, userLines: [] } })); return none.outcome === 'findings' && none.notEvaluable.length === 0 && findingNames(none).some((n) => /observed activation signals agree/.test(n)); })() && attempt(() => verify(mkVerify('n3-good'), { evidence: EVID() })).outcome === 'no-automated-findings');
  G('the three required fields are exactly the three documented ones (a fourth would need its own check)', JSON.stringify(H.CLAUDE_EVIDENCE_KEYS) === JSON.stringify(['bsImports', 'bsVersionSentence', 'userLines']));
  { const dir = liveDir('n3-cli'); const bp = path.join(dir, 'baseline.json'); const ep = path.join(dir, 'evidence.json');
    fs.writeFileSync(bp, H.snapshotJson(lostBase)); fs.writeFileSync(ep, JSON.stringify(EVID({ claude: {} })));
    const c = captureIo(); const code = mainV(['verify', '--project', lost, '--baseline', bp, '--evidence', ep], c.io); const out = c.o.join('\n');
    G('the verify command refuses the empty claude evidence: exit 3, NOT EVALUABLE naming the omitted fields, no pass line', code === 3 && /NOT EVALUABLE/.test(out) && /omits required fields/.test(out) && /^OUTCOME not-evaluable/m.test(out) && !/no-automated-findings/.test(out), { code, out }); }
}

{
  const G = grp('Forwarded evidence (N1 audit)');
  // dispositions: the evidence chooses the KEY (a fact id) looked up in an object parsed from JSON.
  const C = { id: 'conf-x', token: 'WALLET_LOCK_TTL_MS default is 5000 ms', ref: 'Configuration', kind: 'config', conflict: { stale: 'default is 3000 ms', current: 'default is 5000 ms' } };
  const good03 = insertUnder(BS03, 'Configuration', C.token);
  const cons = (inventory, dispositions, fullDocuments = {}) => H.checkConsolidation({ doc03Text: good03, inventory, dispositions, todoText: '', pointers: {}, fullDocuments });
  for (const id of ['constructor', 'toString', 'hasOwnProperty', 'valueOf', '__proto__']) G(`a conflict fact whose id is "${id}" with no own disposition still reports conflict-no-disposition (the lookup must not walk the prototype chain)`, has(cons([{ ...C, id }], JSON.parse('{}')), 'conflict-no-disposition'), codes(cons([{ ...C, id }], JSON.parse('{}'))));
  G('control: an own disposition under such an id is honoured, and an ordinary id behaves as before', !has(cons([{ ...C, id: 'constructor' }], JSON.parse('{"constructor":"use-5000"}')), 'conflict-no-disposition') && !has(cons([C], { 'conf-x': 'use-5000' }), 'conflict-no-disposition') && has(cons([C], {}), 'conflict-no-disposition'));
  G('a non-invariant fact held in TODO under an id that exists on Object.prototype still needs the explicit todo disposition', (() => { const f = { id: 'constructor', token: 'WALLET_LOCK_TTL_MS optional number', ref: 'Landmines', kind: 'config' }; return has(H.checkConsolidation({ doc03Text: BS03, inventory: [f], dispositions: JSON.parse('{}'), todoText: '- WALLET_LOCK_TTL_MS optional number\n' }), 'todo-without-disposition'); })());
  // full documents: the fact names the KEY of the map of documents.
  for (const [key, token] of [['constructor', 'native code'], ['toString', 'native code'], ['__proto__', 'object Object']]) G(`a fact whose fullDocument is "${key}" is not placed by the text of an inherited property (it is omitted)`, has(cons([{ id: 'fd', token, fullDocument: key, kind: 'pattern' }], {}, {}), 'omitted'), codes(cons([{ id: 'fd', token, fullDocument: key, kind: 'pattern' }], {}, {})));
  G('control: an own full document is looked up as before', cons([{ id: 'fd', token: 'Use the Result helper', fullDocument: '.ai/context/code-patterns.md', kind: 'pattern' }], {}, FULLDOCS).length === 0);
  // evidence.fullDocuments names files of the snapshot; the lookup is by own property.
  const root = mkVerify('n1-audit');
  const base = H.takeSnapshot(root);
  const vr = (e) => attempt(() => verify(root, { baseline: base, evidence: e }));
  for (const k of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) { const r = vr(EVID({ fullDocuments: [k] })); G(`evidence.fullDocuments naming "${k}" (no such file) fails its check, never passes on an inherited property`, r.threw === undefined && r.outcome === 'findings' && findingAt(r, CHK.listedFullDoc, k) !== undefined && r.findings.every((x) => !x.name.includes(k)), r.threw ?? findingNames(r)); }
  // evidence.inventory[].fullDocument must be a document the evidence declares and the checker verified (a full, non-pointer file) and not TODO or 03.
  const TODO_TOKEN = INV[4].token;
  const CODE_PATTERNS = '.ai/context/code-patterns.md';
  const fdRoot = mkVerify('n1-fd', { files: { 'TODO.md': `# TODO\n\n- ${TODO_TOKEN}\n`, [CODE_PATTERNS]: FULLDOCS[CODE_PATTERNS] } });
  const fdBase = H.takeSnapshot(fdRoot);
  const vf = (inventory, fullDocuments = [], extra = {}) => attempt(() => verify(fdRoot, { baseline: fdBase, evidence: EVID({ inventory, fullDocuments, ...extra }) }));
  const factCode = { id: 'full-1', token: INV[7].token, kind: 'pattern', fullDocument: CODE_PATTERNS };
  G('control: a fact in a declared, existing full document passes', vf([factCode], [CODE_PATTERNS]).outcome === 'no-automated-findings', vf([factCode], [CODE_PATTERNS]).threw ?? findingNames(vf([factCode], [CODE_PATTERNS])));
  G('a fullDocument the evidence did not declare in evidence.fullDocuments is not evaluable (the old map held every file of the snapshot)', notEval(vf([factCode], []), /fullDocument/), vf([factCode], []).outcome);
  const factTodo = { id: 'inv-1', token: TODO_TOKEN, kind: 'invariant', fullDocument: 'TODO.md' };
  G('an invariant whose fullDocument is TODO.md is not evaluable, declared or not (the rule against moving an invariant solely into TODO cannot be bypassed)', notEval(vf([factTodo], ['TODO.md']), /TODO/) && notEval(vf([factTodo], []), /fullDocument/), [vf([factTodo], ['TODO.md']).outcome, vf([factTodo], []).outcome]);
  G('the same invariant by destination reference is still caught as invariant-only-in-todo (control for the rule the bypass would hide)', (() => { const r = vf([{ ...INV[4] }]); return r.outcome === 'findings' && r.findings.some((x) => JSON.stringify(x.detail).includes('invariant-only-in-todo')); })());
  G('a fullDocument that is 03 is not evaluable (03 facts name their section with ref, which checks the section)', notEval(vf([{ id: 'x', token: 'Landmines', kind: 'config', fullDocument: H.BS_03_REL }], [H.BS_03_REL]), /03|fullDocument/));
  G('a fullDocument that is not a relative path is not evaluable', notEval(vf([{ ...factCode, fullDocument: '../x.md' }], ['../x.md'])) && notEval(vf([{ ...factCode, fullDocument: 7 }], [CODE_PATTERNS])));
  // Shape of facts and dispositions.
  const SHAPES = [['an inventory fact with a blank token', [{ id: 'a', token: '  ', ref: 'Configuration', kind: 'config' }]], ['an inventory fact with a blank id', [{ id: ' ', token: 't', ref: 'Configuration', kind: 'config' }]],
    ['an inventory fact with neither ref nor fullDocument', [{ id: 'a', token: 't' }]], ['an inventory fact whose ref is not text', [{ id: 'a', token: 't', ref: 5 }]],
    ['a conflict that is null', [{ ...C, conflict: null }]], ['a conflict that is a string', [{ ...C, conflict: 'x' }]], ['a conflict without current', [{ ...C, conflict: { stale: 's' } }]], ['a conflict with a blank stale value', [{ ...C, conflict: { stale: ' ', current: 'c' } }]], ['a conflict whose values are not text', [{ ...C, conflict: { stale: 1, current: 2 } }]]];
  for (const [label, inventory] of SHAPES) { const r = vf(inventory); G(`${label} is not evaluable (a crash or a vacuous match is not a verdict)`, r.threw === undefined && notEval(r), r.threw ?? r.outcome); }
  for (const [label, dispositions] of [['a disposition that is a number', { a: 1 }], ['an empty disposition', { a: '' }], ['a null disposition', { a: null }], ['an object disposition', { a: {} }]]) G(`${label} is not evaluable`, notEval(vr(EVID({ dispositions }))), vr(EVID({ dispositions })).outcome);
  G('controls: a well-formed conflict fact with a text disposition is evaluable (it may fail on content, it is not rejected as input)', vf([C], [], { dispositions: { 'conf-x': 'use-5000' } }).outcome !== 'not-evaluable');
  // Objects the verification picks field by field: the evidence has no key that can replace what the checker observed. Pins (they pass today).
  { const r = mkVerify('n1-ag', { files: { '.claude/agents/docs-sync.md': 'something else\n' } });
    const v = verify(r, { baseline: H.takeSnapshot(r), evidence: EVID({ agents: { reviewer: { disposition: 'take-new' }, 'docs-sync': { disposition: 'take-new', shippedWrapper: 'something else\n', text: 'something else\n', name: 'docs-sync' } } }) });
    G('an agent entry carrying shippedWrapper or text cannot make a foreign wrapper pass take-new (the checker supplies both)', v.outcome === 'findings' && findingNames(v).some((n) => /docs-sync\.md: take-new/.test(n)), findingNames(v)); }
  { const rel = '.ai/agents/reviewer.project.md'; const r = mkVerify('n1-ext', { files: { [rel]: 'original\n' } }); const b = H.takeSnapshot(r); putF(r, rel, 'changed\n');
    const v = verify(r, { baseline: b, evidence: EVID({ extensions: { [rel]: { before: 'changed\n', after: 'changed\n' } } }) });
    G('an extension entry carrying before or after cannot excuse an unapproved change (the baseline and the file are the checker\'s)', v.outcome === 'findings' && findingAt(v, CHK.extension, rel) !== undefined, findingNames(v)); }
  { const r = mkVerify('n1-nest', { files: { 'src/wallet/AGENTS.md': '# wallet\n' } });
    const v = verify(r, { baseline: H.takeSnapshot(r), evidence: EVID({ nested: [{ dir: 'src/wallet', agents: '# wallet\n', claude: '@AGENTS.md\n' }] }) });
    const root1 = v.findings.find((x) => /^root AGENTS\.md/.test(x.name));
    G('a nested entry carrying agents or claude text cannot supply the missing pair member (the checker reads both files)', v.outcome === 'findings' && root1 !== undefined && JSON.stringify(root1.detail).includes('pair-missing'), root1); }
}

// ============================================================== GROUP: HTML comments are not operative Markdown (R7) ====
{
  const G = grp('HTML comments (R7)');
  const res = (ref, doc) => H.resolveHeading(doc, H.parseBulletRef(ref)).status;
  const comment = (t) => `<!--\n${t}\n-->`;
  const allRefs = [...new Set(Object.values(H.POINTER_DOCS).flat())];
  const wrapped = H.parseHeadingDoc(`# Title\n\n${comment(BS03.replace(/^# .*\n/, ''))}\n`);
  G('wrapping every 03 heading in one HTML comment leaves no heading (the review probe still resolved them)', wrapped.headings.filter((h) => h.level > 1).length === 0 && allRefs.every((r) => res(r, wrapped) === 'missing'), allRefs.map((r) => res(r, wrapped)));
  NEEDS(G, 'a pointer whose destinations exist only inside a comment fails the checker with heading-missing', [SK, PTB], () => has(inspect('docs/database.md', pointerOf('docs/database.md'), wrapped), 'heading-missing'));
  G('a heading inside a single-line comment is not a heading, but a trailing inline comment does not change the heading it follows', res('Database', H.parseHeadingDoc(BS03.replace(/^## 7\. Database$/m, '<!-- ## 7. Database -->'))) === 'missing' && res('Database', H.parseHeadingDoc(BS03.replace(/^## 7\. Database$/m, '## 7. Database <!-- reviewed -->'))) === 'ok');
  G('a commented-out DUPLICATE heading does not make a destination ambiguous, an uncommented one does (control)', res('Database', H.parseHeadingDoc(`${BS03}\n<!-- ## 16. Database -->\n`)) === 'ok' && res('Database', H.parseHeadingDoc(`${BS03}\n## 16. Database\n`)) === 'ambiguous');
  G('a fence delimiter INSIDE a comment does not open a fence, so a real heading after the comment still resolves', res('After', H.parseHeadingDoc('# T\n\n<!--\n```\n## Fake\n-->\n## After\n')) === 'ok' && res('Fake', H.parseHeadingDoc('# T\n\n<!--\n```\n## Fake\n-->\n## After\n')) === 'missing');
  G('"<!--" inside a fenced block is code and opens no comment, so the heading after the fence resolves', res('After', H.parseHeadingDoc('# T\n\n```md\n<!--\n```\n\n## After\n')) === 'ok');
  G('four-space indented "<!--" is code, not a comment block', res('After', H.parseHeadingDoc('# T\n\n    <!--\n\n## After\n')) === 'ok');
  G('an unclosed comment hides everything after it (a CommonMark HTML block runs to the end of the document)', res('After', H.parseHeadingDoc('# T\n\n<!-- never closed\n\n## After\n')) === 'missing');
  G('a code span containing a comment-looking text keeps it in a heading name', H.parseHeadingDoc('# T\n\n## Use `<!-- x -->` markers\n').headings[1].name === 'Use `<!-- x -->` markers');
  G('section text excludes commented content (a destination section holds only what a reader sees)', (() => { const d = H.parseHeadingDoc('# T\n\n## Database\n\nvisible fact\n<!-- hidden fact -->\n<!--\nhidden two\n-->\n## Next\n'); const t = H.sectionText(d, d.headings.find((h) => h.name === 'Database')); return t.includes('visible fact') && !t.includes('hidden') && d.lines.length === 11; })());
  G('a consolidation fact that exists only inside an HTML comment of 03 is reported omitted (a hidden fact is not documented)', (() => { const tok = INV[0].token; const t03 = insertUnder(BS03, 'Configuration', `<!-- ${tok} -->`); return H.checkConsolidation({ doc03Text: t03, inventory: [INV[0]], fullDocuments: {} }).some((x) => x.id === INV[0].id && x.code === 'omitted'); })());
  G('control: the same fact visible under the destination is clean', H.checkConsolidation({ doc03Text: insertUnder(BS03, 'Configuration', INV[0].token), inventory: [INV[0]], fullDocuments: {} }).length === 0);
  // Owner decisions and signals.
  const dec = (t) => H.findDecisionRecords(t);
  G('a decision sentence inside a one-line comment does not count and is recorded as ignored', (() => { const r = dec(`# s\n\n<!-- ${H.DECISION_SENTENCE} -->\n`); return r.exact === 0 && r.conflicting.length === 0 && r.ignored.some((x) => x.reason === 'inside an HTML comment'); })());
  G('a decision sentence on its own line INSIDE a multi-line comment does not count (the exact standalone line the old code accepted)', (() => { const r = dec(`# s\n\n<!--\nexample for owners:\n${H.DECISION_SENTENCE}\n-->\n`); return r.exact === 0 && r.ignored.some((x) => x.reason === 'inside an HTML comment'); })());
  G('a decision after a closed comment still counts, and one inside an inline comment does not', dec(`<!-- note -->\n${H.DECISION_SENTENCE}\n`).exact === 1 && dec(`Remember <!-- ${H.DECISION_SENTENCE} -->\n`).exact === 0);
  // Review round 2, N2. (1) An inline comment may open mid-line and close on a later line (CommonMark: it cannot span a blank line, and a line that
  // starts a heading or a fence ends the paragraph first). (2) Managed blocks are the ones production parseBlocks reads: its markers are matched on
  // every line outside a fence, inside HTML comments too, in the hash style as well. The old test here asserted the opposite for a marker in a comment.
  const D = H.DECISION_SENTENCE;
  const prodInside = (t) => { const p = parseBlocks(t); return p.errors.length === 0 && p.blocks.some((b) => b.inner.includes(D)); };
  { const r = dec(`Note <!--\n${D}\n-->\n`);
    G('a decision on its own line inside an INLINE comment that opens mid-line and closes on a later line does not count (the review probe: "Note <!--", the sentence, "-->")', r.exact === 0 && r.conflicting.length === 0 && r.ignored.some((x) => x.reason === 'inside an HTML comment'), r); }
  G('the same with text on the opening line, several hidden lines and text after the closing marker', dec(`Note <!-- a\nb\n${D}\nc --> tail\n`).exact === 0 && dec(`   Note <!--\n${D}\n--> tail <!-- again -->\n`).exact === 0);
  G('controls: a comment closed on its own line hides nothing after it, and the sentence after the closing line of a multi-line inline comment counts', dec(`Note <!-- a -->\n${D}\n`).exact === 1 && dec(`Note <!--\nx\n-->\n${D}\n`).exact === 1 && dec(`Note <!--\nx\n--> tail\n${D}\n`).exact === 1);
  G('an inline "<!--" with no "-->" before the paragraph ends (a blank line) is plain text, so the sentence after it still counts (an inline comment cannot span a blank line)', dec(`Note <!--\n${D}\n\nlater -->\n`).exact === 1);
  G('an inline "<!--" that is never closed hides nothing', dec(`Note <!--\n${D}\n`).exact === 1);
  G('an inline "<!--" that never closes stays literal on its own line too (a heading keeps it in its name, as a renderer shows it), while a comment closed before it is removed', H.parseHeadingDoc('# T\n\n## Database <!-- unclosed\n').headings[1].name === 'Database <!-- unclosed' && H.parseHeadingDoc('# T\n\n## Database <!-- a --> and <!-- b\n').headings[1].name === 'Database and <!-- b');
  G('a "<!--" inside a code span is code, not a comment opener (the sentence after it still counts)', dec(`Note \`<!--\`\n${D}\n-->\n`).exact === 1 && dec(`Note \`\`<!-- \` --\`\`\n${D}\n-->\n`).exact === 1);
  G('a comment that holds a code span is still closed on its line, so it opens nothing', dec(`Note <!-- see \`x\` here -->\n${D}\n`).exact === 1);
  { const s = H.scanMarkdown('Note <!--\nx\n--> t\nafter\n');
    G('scanMarkdown: the head of the opening line and the tail of the closing line stay visible, the lines between are comment lines, and the line count is kept', s.length === 5 && s[0].text === 'Note ' && !s[0].comment && s[1].comment && s[1].text === '' && s[2].comment && s[2].text === ' t' && s[3].text === 'after' && !s[3].comment, s.map((x) => [x.text, x.comment])); }
  // Round 3 (N4): a heading or fence between the opener and a later "-->" is now REPORTED as an unsupported shape (the file is then not evaluable) instead of
  // being modelled; the plain-text fallback below is only what the scanner returns beside the report, and the blank-line end stays exact.
  G('a heading line ends the paragraph: with a "-->" after it the shape is reported as unsupported (the fallback still reads the heading as a heading), and with no "-->" before a blank line nothing is reported', (() => { const d = H.parseHeadingDoc('# T\n\n## Database\n\nnote <!--\n## Ghost\n-->\n'); return res('Ghost', d) === 'ok' && d.unsupported.length === 1 && H.parseHeadingDoc('# T\n\nnote <!--\n## Ghost\n\n-->\n').unsupported.length === 0; })());
  G('a fence opener ends the paragraph too: with a "-->" after it the shape is reported as unsupported (the fallback reads the closed fence as code and the heading after it as a heading), while a comment closed before any fence hides nothing after its "-->" and reports nothing', (() => { const d = H.parseHeadingDoc('# T\n\nNote <!--\n```\ncode\n```\n-->\n## Real\n'); const e = H.parseHeadingDoc('# T\n\nNote <!--\n-->\n## Real\n'); return res('Real', d) === 'ok' && d.unsupported.length === 1 && d.unsupported[0].line === 3 && res('Real', e) === 'ok' && e.unsupported.length === 0; })());
  G('a second inline comment opened on the line that closes the first is tracked too, and one closed on that same line is not', dec(`Note <!--\nx\n--> t <!--\n${D}\n-->\n`).exact === 0 && dec(`Note <!--\nx\n--> t <!-- y -->\n${D}\n`).exact === 1);
  G('section text excludes a multi-line inline comment (a destination holds only what a reader sees), keeps the head and the tail, and keeps the line numbers', (() => { const t = '# T\n\n## Database\n\nvisible fact <!--\nhidden fact\nmore hidden\n--> after\n## Next\n'; const d = H.parseHeadingDoc(t); const s = H.sectionText(d, d.headings.find((h) => h.name === 'Database')); return s.includes('visible fact') && s.includes('after') && !s.includes('hidden') && d.lines.length === t.split('\n').length; })());
  G('a consolidation fact that exists only inside a multi-line inline comment of 03 is omitted; the same fact visible is clean', (() => { const tok = INV[0].token; const hidden = insertUnder(BS03, 'Configuration', `Note <!--\n${tok}\n-->`); const shown = insertUnder(BS03, 'Configuration', `Note <!-- x -->\n${tok}`); return H.checkConsolidation({ doc03Text: hidden, inventory: [INV[0]], fullDocuments: {} }).some((x) => x.id === INV[0].id && x.code === 'omitted') && H.checkConsolidation({ doc03Text: shown, inventory: [INV[0]], fullDocuments: {} }).length === 0; })());
  G('an import of 03 and a provenance sentence inside a multi-line INLINE comment are no signal, and the same lines outside one are', (() => { const imp = `@${H.BS_03_REL}`; const sent = 'Applied from the `backend-standards` skill, version `3.1.0`.'; const hid = H.parseClaudeSignals(`Intro <!--\n${imp}\n${sent}\n-->\n`); const vis = H.parseClaudeSignals(`Intro <!-- x -->\n${imp}\n${sent}\n`); return hid.imports03 === false && hid.sentences.length === 0 && vis.imports03 === true && vis.sentences.length === 1; })());
  { const r = layoutOf({ ...F03, 'AGENTS.md': `# svc\n\nNote <!--\n${D}\n-->\n` });
    G('a decision hidden in a multi-line inline comment, with a readable 03 alone, still asks the owner (it does not activate)', r.treatment === 'owner-disposition', r.treatment); }
  { const t = `<!--\n<!-- project-setup:begin id=overview -->\n-->\n${D}\n<!-- project-setup:end id=overview -->\n`; const r = dec(t);
    G('a managed-block marker inside a multi-line comment still opens the block production parseBlocks reads, so a decision between the markers is inside it and does not count (the replaced test endorsed the opposite)', prodInside(t) && r.exact === 0 && r.ignored.some((x) => x.reason === 'inside managed block overview'), { prod: prodInside(t), r }); }
  { const t = `# project-setup:begin id=overview\n${D}\n# project-setup:end id=overview\n`;
    G('hash-style markers, which parseBlocks accepts in any file, delimit a block as well', prodInside(t) && dec(t).exact === 0, dec(t)); }
  { const t = `<!-- project-setup:begin id=overview\n${D}\n<!-- project-setup:end id=overview -->\n${D}\n`;
    G('parity with parseBlocks on a begin marker without a closing "-->": it opens the production block and a comment block alike, so the sentence between the markers is hidden twice and only the one after the end marker counts', dec(t).exact === 1 && parseBlocks(t).errors.length === 0 && parseBlocks(t).blocks[0].inner.includes(D) && dec(t).ignored.length === 1, dec(t)); }
  { const t = `<!-- project-setup:begin id=overview -->\nOverview.\n<!-- project-setup:end id=overview -->\n${D}\n`;
    G('controls: a decision after a closed block counts, and the blocks report no marker error', dec(t).exact === 1 && Array.isArray(dec(t).markerErrors) && dec(t).markerErrors.length === 0 && !prodInside(t), dec(t)); }
  { const t = `\`\`\`\n<!-- project-setup:begin id=overview -->\n\`\`\`\n${D}\n`;
    G('control: a begin marker inside a fenced example is no marker (parseBlocks skips fences), so the sentence after the fence counts', dec(t).exact === 1 && parseBlocks(t).errors.length === 0 && parseBlocks(t).blocks.length === 0, dec(t)); }
  for (const [label, t] of [['a begin marker that is never closed', `<!-- project-setup:begin id=overview -->\n${D}\n`], ['an end marker without a begin', `${D}\n<!-- project-setup:end id=overview -->\n`], ['a begin marker inside a comment whose end never follows', `<!--\n<!-- project-setup:begin id=overview -->\n-->\n${D}\n`], ['two blocks sharing an id', `<!-- project-setup:begin id=a -->\nx\n<!-- project-setup:end id=a -->\n<!-- project-setup:begin id=a -->\ny\n<!-- project-setup:end id=a -->\n${D}\n`]]) {
    const p = parseBlocks(t); const r = dec(t);
    G(`${label}: production reports a marker error, so the block boundaries are unknown and the decision does not count (fail closed), with the errors reported`, p.errors.length > 0 && r.exact === 0 && Array.isArray(r.markerErrors) && r.markerErrors.length === p.errors.length && r.ignored.some((x) => /managed-block markers are broken/.test(x.reason)), { prod: p.errors, r });
  }
  { const r = layoutOf({ ...F03, 'AGENTS.md': `# svc\n\n<!--\n<!-- project-setup:begin id=overview -->\n-->\n${D}\n<!-- project-setup:end id=overview -->\n` });
    G('a decision inside a block whose begin marker sits in a comment does not activate: 03 alone still asks the owner', r.treatment === 'owner-disposition', r.treatment); }
  { const r = layoutOf({ ...F03, 'AGENTS.md': `# svc\n\n<!-- project-setup:begin id=overview -->\n${D}\n` });
    G('a decision after a begin marker that is never closed does not activate either', r.treatment === 'owner-disposition', r.treatment); }
  G('real managed-block markers still delimit blocks: a decision inside one stays ignored', dec(`<!-- project-setup:begin id=overview -->\n${H.DECISION_SENTENCE}\n<!-- project-setup:end id=overview -->\n`).exact === 0);
  G('a four-space indented marker still delimits a block (PS reads it even though CommonMark would not)', dec(`    <!-- project-setup:begin id=overview -->\n${H.DECISION_SENTENCE}\n    <!-- project-setup:end id=overview -->\n${H.DECISION_SENTENCE}\n`).exact === 1);
  { const r = layoutOf({ ...F03, 'AGENTS.md': `# svc\n\n<!--\n${H.DECISION_SENTENCE}\n-->\n` });
    G('a commented owner decision with a readable 03 alone still asks the owner (it does not activate)', r.treatment === 'owner-disposition', r.treatment); }
  { const r = layoutOf({ ...F03, 'CLAUDE.md': `<!--\n@.ai/standards/03-project-architecture.md\nApplied from the \`backend-standards\` skill, version \`3.1.0\`.\n-->\n` });
    G('a provenance sentence and an import of 03 inside a comment are no signal (03 alone asks the owner)', r.treatment === 'owner-disposition' && H.parseClaudeSignals(`<!-- Applied from the \`backend-standards\` skill, version \`3.1.0\`. -->\n`).sentences.length === 0, r.treatment); }
  { const r = layoutOf({ ...F03, 'CLAUDE.md': `${BS_CLAUDE('3.1.0')}\n<!-- Applied from the \`backend-standards\` skill, version \`9.9.9\`. -->\n` });
    G('a second, commented provenance sentence does not create a conflict with the real one', r.treatment === 'activate', r.treatment); }
  { const imp = `@${H.BS_03_REL}`;
    G('an import of 03 inside a multi-line, a one-line or an inline comment is no import (reading the raw line would count it), and an uncommented one is', [`<!--\n${imp}\n-->\n`, `<!-- ${imp} -->\n`, `Intro <!-- ${imp} -->\n`].every((t) => H.parseClaudeSignals(t).imports03 === false) && H.parseClaudeSignals(`${imp}\n`).imports03 === true);
    const live = layoutOf({ ...F03, 'CLAUDE.md': BS_CLAUDE('3.1.0') });
    const hidden = layoutOf({ ...F03, 'CLAUDE.md': BS_CLAUDE('3.1.0').replace(imp, `<!-- ${imp} -->`) });
    G('the real provenance sentence activates with a live import of 03 and does not once that import is commented out', live.treatment === 'activate' && hidden.treatment !== 'activate', `${live.treatment} / ${hidden.treatment}`); }

  // ---- Review round 3, N4. A "<!--" opened mid-paragraph that would stay open across a construct that can end a paragraph (a list item, block quote, setext
  // underline, heading, fence, thematic break, HTML block), or sits in a shape the scanner does not model exactly, is NOT guessed. The old scanner hid the
  // lines up to the "-->", so a stale value written as a visible list item vanished from the stale-value check and the run passed complete. The scanner now
  // reports an unsupported comment shape; every verification that read the file is not evaluable and the layout classification holds.
  const shapes = (t) => H.unsupportedShapes(t);
  const around = (middle) => [`Note <!--\n${middle}\n-->`, `Note\n${middle}\n-->`]; // [with the opener, the same lines without it]
  const N4 = [
    ['a bullet list item', ...around('- older: default is 3000 ms')],
    ['an ordered list item', ...around('1. older: default is 3000 ms')],
    ['a block quote', ...around('> older: default is 3000 ms')],
    ['a setext underline (=)', ...around('older: default is 3000 ms\n===')],
    ['a setext underline (-)', ...around('older: default is 3000 ms\n---')],
    ['an ATX heading', ...around('## older: default is 3000 ms')],
    ['a fence opener', ...around('```\nolder: default is 3000 ms\n```')],
    ['a tilde fence opener', ...around('~~~\nolder: default is 3000 ms\n~~~')],
    ['a thematic break', ...around('***\nolder: default is 3000 ms')],
    ['an HTML block', ...around('<div>older: default is 3000 ms</div>')],
    ['a table', ...around('| older | default is 3000 ms |\n| --- | --- |')],
    ['a footnote definition', ...around('[^1]: older: default is 3000 ms')],
    ['a list item that itself holds the closing marker', 'Note <!--\n- older: default is 3000 ms -->', 'Note\n- older: default is 3000 ms -->'],
    ['a line indented four spaces (an indented code line or a container)', ...around('    older: default is 3000 ms')],
    ['an opener indented as a code block', '    Note <!--\nolder: default is 3000 ms\n-->', '    Note\nolder: default is 3000 ms\n-->'],
    ['an opener inside a block quote', '> Note <!--\n> older: default is 3000 ms\n> -->', '> Note\n> older: default is 3000 ms\n> -->'],
    ['an opener that starts a list item', '- Note <!--\n  older: default is 3000 ms\n  -->', '- Note\n  older: default is 3000 ms\n  -->'],
    ['an opener inside an ATX heading', '## Note <!--\nolder: default is 3000 ms\n-->', '## Note\nolder: default is 3000 ms\n-->'],
  ];
  for (const [label, shape, control] of N4) {
    const s = shapes(shape);
    G(`scanner: a comment opened mid-paragraph over ${label} is reported as an unsupported shape (once, on the opening line), and the same lines without the opener are not`, s.length === 1 && s[0].line === 1 && /would stay open across line/.test(s[0].reason) && shapes(control).length === 0, { shape: s, control: shapes(control) });
  }
  // The reviewer's end-to-end probe and one control per construct: the approved value is present, the stale value is a visible line inside the paragraph.
  const N4C = { id: 'conf-n4', token: 'WALLET_LOCK_TTL_MS default is 5000 ms', ref: 'Configuration', kind: 'config', conflict: { stale: 'default is 3000 ms', current: 'default is 5000 ms' } };
  const approved03 = insertUnder(FILLED03, 'Configuration', N4C.token);
  const v03 = (t03, o = {}) => { const root = mkVerify('n4', { files: { [H.BS_03_REL]: t03, ...(o.files ?? {}) } }); return attempt(() => verify(root, { baseline: H.takeSnapshot(root), evidence: EVID({ inventory: [N4C], dispositions: { 'conf-n4': 'use-5000' }, ...(o.evidence ?? {}) }) })); };
  const consolidationCodes = (r) => (findingDetail(r, /fact inventory is consolidated/) ?? []).map((d) => d.code);
  G('control: the approved value alone (no stale value anywhere) consolidates, so the probes below differ only in the stale line', (() => { const r = v03(approved03); return clean(r); })(), v03(approved03).outcome);
  for (const [label, shape, control] of N4) {
    const r = v03(insertUnder(approved03, 'Configuration', shape));
    G(`end to end: the stale value hidden behind a comment opened over ${label} makes the verification NOT EVALUABLE naming 03 and the line, never a pass (the old scanner returned passed, complete)`, notEval(r, /unsupported Markdown shape: \.ai\/standards\/03-project-architecture\.md line \d+/), diag(r));
    const c = v03(insertUnder(approved03, 'Configuration', control));
    G(`end to end control: the same lines without the opener are visible, so the stale value is found (failed with stale-value-retained)`, c.outcome === 'findings' && consolidationCodes(c).includes('stale-value-retained'), { label, outcome: c.outcome, codes: consolidationCodes(c) });
  }
  { const shape = insertUnder(approved03, 'Configuration', N4[0][1]);
    const direct = H.checkConsolidation({ doc03Text: shape, inventory: [N4C], dispositions: { 'conf-n4': 'use-5000' }, todoText: '', pointers: {}, fullDocuments: {} });
    G('direct check: checkConsolidation on that document reports an unsupported-comment-shape finding and never an empty list (a caller that skips verifyProject is covered too)', has(direct, 'unsupported-comment-shape') && direct.length > 0, direct);
    G('direct check: checkBlankSections reports it too (a template blank hidden by a guess would not be found)', has(H.checkBlankSections({ doc03Text: shape, refs: ['Configuration'] }), 'unsupported-comment-shape'));
    G('direct check: checkClaudeRecovery reports it for a CLAUDE.md (a second @AGENTS.md import hidden behind such a comment would pass the import count)', has(recoverClaude(`${MERGED_CLAUDE}\nNote <!--\n- @AGENTS.md\n-->\n`), 'unsupported-comment-shape') && !has(recoverClaude(MERGED_CLAUDE), 'unsupported-comment-shape'));
    NEEDS(G, 'direct check: a pointer is not valid against a 03 whose comment shape the scanner cannot place (a hidden duplicate heading would resolve instead of being ambiguous)', [SK, PTB], () => { const doc = H.parseHeadingDoc(shape); return doc.unsupported.length === 1 && has(inspect('docs/database.md', pointerOf('docs/database.md'), doc), 'unsupported-comment-shape') && !has(inspect('docs/database.md', pointerOf('docs/database.md'), H.parseHeadingDoc(approved03)), 'unsupported-comment-shape'); }); }
  // Every file the checks read through the scanner gates the verification, whichever file holds the shape.
  { const SH = 'Note <!--\n- older: default is 3000 ms\n-->\n';
    const gate = (rel, r) => notEval(r, new RegExp(`unsupported Markdown shape: ${esc(rel)} line \\d+`));
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    G('the verification is not evaluable when CLAUDE.md holds the shape', gate('CLAUDE.md', v03(BS03, { files: { 'CLAUDE.md': `${MERGED_CLAUDE}\n${SH}` } })));
    G('the verification is not evaluable when the root AGENTS.md holds the shape', gate('AGENTS.md', v03(BS03, { files: { 'AGENTS.md': `${renderAgents(true)}\n${SH}` } })));
    G('the verification is not evaluable when a nested CLAUDE.md or AGENTS.md of an evidence pair holds the shape', ['AGENTS.md', 'CLAUDE.md'].every((m) => gate(`src/wallet/${m}`, v03(BS03, { files: { 'src/wallet/AGENTS.md': m === 'AGENTS.md' ? `# local\n${SH}` : '# local\n', 'src/wallet/CLAUDE.md': m === 'CLAUDE.md' ? `@AGENTS.md\n${SH}` : '@AGENTS.md\n' }, evidence: { nested: [{ dir: 'src/wallet' }] } }))));
    G('the same shape in TODO.md also makes the verification not evaluable (TODO.md is read through the scanner by the consolidation check, so it is gated like 03)', gate('TODO.md', v03(approved03, { files: { 'TODO.md': `# TODO\n\n${SH}` } })), v03(approved03, { files: { 'TODO.md': `# TODO\n\n${SH}` } }).outcome);
    const cli = (() => { const root = mkVerify('n4-cli', { files: { [H.BS_03_REL]: insertUnder(approved03, 'Configuration', N4[0][1]) } }); const dir = liveDir('n4-cli-io'); const bp = path.join(dir, 'b.json'); const ep = path.join(dir, 'e.json'); fs.writeFileSync(bp, H.snapshotJson(H.takeSnapshot(root))); fs.writeFileSync(ep, JSON.stringify(EVID({ inventory: [N4C], dispositions: { 'conf-n4': 'use-5000' } }))); const c = captureIo(); const code = mainV(['verify', '--project', root, '--baseline', bp, '--evidence', ep], c.io); return { code, out: c.o.join('\n') }; })();
    G('the verify command exits 3 with NOT EVALUABLE and no pass line for that shape', cli.code === 3 && /NOT EVALUABLE/.test(cli.out) && /unsupported Markdown shape/.test(cli.out) && /^OUTCOME not-evaluable/m.test(cli.out) && !/no-automated-findings/.test(cli.out), cli); }
  // Layout classification holds: a hidden visible line may be a conflicting sentence, import or decision, so what was read is not evidence of absence.
  for (const [label, shape, control] of N4) {
    const claudeOf = (t) => `${BS_CLAUDE('3.1.0')}\n${t}\n`;
    const agentsOf = (t) => DECISION_AGENTS(`\n${t}\n`);
    const a = layoutOf({ ...F03, 'CLAUDE.md': claudeOf(shape) }); const ac = layoutOf({ ...F03, 'CLAUDE.md': claudeOf(control) });
    G(`classification over ${label} in CLAUDE.md: hold (unsupported comment shape), while the same lines without the opener leave the valid signals to activate`, a.treatment === 'hold' && /unsupported comment shape in CLAUDE\.md/.test(a.reason) && a.accepted.length === 0 && ac.treatment === 'activate', { held: [a.treatment, a.reason], control: ac.treatment });
    const b = layoutOf({ ...F03, 'AGENTS.md': agentsOf(shape) }); const bc = layoutOf({ ...F03, 'AGENTS.md': agentsOf(control) });
    G(`classification over ${label} in AGENTS.md: hold, while the same lines without the opener leave the exact owner decision to activate`, b.treatment === 'hold' && /unsupported comment shape in AGENTS\.md/.test(b.reason) && bc.treatment === 'activate', { held: [b.treatment, b.reason], control: bc.treatment });
  }
  { const r = layoutOf({ ...F03, 'CLAUDE.md': `${BS_CLAUDE('3.1.0')}\nNote <!--\n- Applied from the \`backend-standards\` skill, version \`9.9.9\`.\n-->\n` }); const c = layoutOf({ ...F03, 'CLAUDE.md': `${BS_CLAUDE('3.1.0')}\nNote\n- Applied from the \`backend-standards\` skill, version \`9.9.9\`.\n-->\n` });
    G('a conflicting provenance sentence written as a visible list item behind such a comment holds as an unsupported shape (it used to activate on the 3.1.0 sentence alone), and without the opener it is the ordinary conflicting-sentence hold', r.treatment === 'hold' && /unsupported comment shape/.test(r.reason) && c.treatment === 'hold' && /conflicting or ambiguous provenance/.test(c.reason), { r: [r.treatment, r.reason], c: [c.treatment, c.reason] }); }
  { const both = H.collectSignals(mkProj({ ...F03, 'CLAUDE.md': BS_CLAUDE('3.1.0'), 'AGENTS.md': DECISION_AGENTS() }));
    G('controls: a project whose files hold no unsupported shape reports empty shape lists in the signals and activates', both.claude.unsupported.length === 0 && both.agents.decision.unsupported.length === 0 && H.classifyLayout(both).treatment === 'activate'); }
  G('classifyBsOutcome does not classify a CLAUDE.md whose comment shape is unsupported (not-evaluable, with the shapes as evidence), and classifies the same file without the opener', (() => { const before = `${PS_CLAUDE_TEMPLATE}\n`; const hidden = H.classifyBsOutcome('CLAUDE.md', before, `${BS_CLAUDE()}\n${N4[0][1]}\n`); const plain = H.classifyBsOutcome('CLAUDE.md', before, `${BS_CLAUDE()}\n${N4[0][2]}\n`); return hidden.outcome === 'not-evaluable' && hidden.evidence.unsupported.length === 1 && plain.outcome !== 'not-evaluable'; })());
  G('the other readers expose the shapes too: parseHeadingDoc, findDecisionRecords and parseClaudeSignals each list them, and an ordinary text lists none', H.parseHeadingDoc(N4[0][1]).unsupported.length === 1 && H.findDecisionRecords(N4[0][1]).unsupported.length === 1 && H.parseClaudeSignals(N4[0][1]).unsupported.length === 1 && H.parseHeadingDoc(BS03).unsupported.length === 0 && H.findDecisionRecords(DECISION_AGENTS()).unsupported.length === 0 && H.parseClaudeSignals(BS_CLAUDE()).unsupported.length === 0);
  // The shapes that ARE modelled exactly stay supported (the report is for what cannot be placed, never for every comment).
  const MODELLED = [
    ['a blank line ends the paragraph before any closing marker, so the opener is plain text', 'Note <!--\n- item\n\nlater -->\n'],
    ['a list item after an opener that never closes (end of text)', 'Note <!--\n- item\n'],
    ['a list item after an opener that never closes, with no final newline (the end of the text, not a blank line, ends the search)', 'Note <!--\n- item'],
    ['a comment closed on its own line, with a list item after it', 'Note <!-- x -->\n- item\n'],
    ['plain continuation lines between the opener and the closing line', 'Note <!--\nmore words\nand more\n-->\n'],
    ['a construct that follows the closing line, not the comment', 'Note <!--\nx\n-->\n- item\n## Heading\n'],
    ['a code span holding the opener', 'Note `<!--`\n- item\n-->\n'],
    ['a comment block on its own lines', '<!--\n- item\n-->\n- item\n'],
    ['a comment block followed only by further closed comments on the closing line', '<!-- a --> <!-- b -->\n<!--\nx\n--> <!-- c -->\n'],
    ['a comment block with trailing whitespace on the closing line', '<!-- a -->   \n'],
  ];
  for (const [label, t] of MODELLED) G(`control: ${label} is not an unsupported shape`, shapes(t).length === 0, shapes(t));
  G('control: a plain continuation really hides its lines (exact), and the list item after a blank-line-terminated opener stays visible', (() => { const a = H.scanMarkdown('Note <!--\nmore words\n-->\n'); const b = H.scanMarkdown('Note <!--\n- item\n\nlater -->\n'); return a[1].comment === true && a[1].text === '' && b[1].comment === false && b[1].text === '- item'; })());

  // ---- Review round 3, N5. The visible text after the "-->" that closes an INLINE comment is on the page: its provenance sentence and imports are signals.
  // The old parsers skipped the whole closing line, so a visible conflicting sentence beside the real one was ignored and the layout activated.
  const SENT = (v) => `Applied from the \`backend-standards\` skill, version \`${v}\`.`;
  const sectionTextOf = (d, name) => H.sectionText(d, d.headings.find((h) => h.name === name));
  { const tail = (c) => `${BS_CLAUDE('3.1.0')}\nNote <!--\nx\n--> ${c}\n`;
    const r = layoutOf({ ...F03, 'CLAUDE.md': tail(SENT('9.9.9')) });
    G('a visible conflicting provenance sentence after the closing marker of an inline comment is read, so the two sentences hold the layout (the review probe: it activated on 3.1.0 alone)', H.parseClaudeSignals(tail(SENT('9.9.9'))).sentences.length === 2 && r.treatment === 'hold' && /conflicting or ambiguous provenance/.test(r.reason), { sentences: H.parseClaudeSignals(tail(SENT('9.9.9'))).sentences, r: [r.treatment, r.reason] });
    const same = layoutOf({ ...F03, 'CLAUDE.md': tail(SENT('3.1.0')) });
    G('the same sentence with the SAME version after the marker is a duplicate sentence, which holds as ambiguous', same.treatment === 'hold' && /conflicting or ambiguous provenance/.test(same.reason), [same.treatment, same.reason]);
    const hiddenOne = layoutOf({ ...F03, 'CLAUDE.md': `${BS_CLAUDE('3.1.0')}\nNote <!--\nx ${SENT('9.9.9')}\n-->\n` });
    G('control: the conflicting sentence INSIDE the comment (before the marker) is hidden and does not conflict', hiddenOne.treatment === 'activate', [hiddenOne.treatment, hiddenOne.reason]);
    const afterLine = layoutOf({ ...F03, 'CLAUDE.md': `${BS_CLAUDE('3.1.0')}\nNote <!--\nx\n-->\n${SENT('9.9.9')}\n` });
    G('control: the conflicting sentence on a line AFTER the closing line was always read, and still holds', afterLine.treatment === 'hold' && /conflicting or ambiguous provenance/.test(afterLine.reason), [afterLine.treatment, afterLine.reason]);
    const imp = layoutOf({ ...F03, 'CLAUDE.md': tail('@docs/03-project-architecture.md') });
    G('a visible import of another architecture document after the closing marker holds the layout (another architecture document is imported)', H.parseClaudeSignals(tail('@docs/03-project-architecture.md')).otherArchImports.length === 1 && imp.treatment === 'hold' && /another architecture document is imported/.test(imp.reason), [imp.treatment, imp.reason]);
    const own = H.parseClaudeSignals(`Note <!--\nx\n--> @${H.BS_03_REL}\n${SENT('3.1.0')}\n`);
    G('a visible import of this 03 after the closing marker counts as the import, and the commented part before it does not', own.imports03 === true && own.sentences.length === 1 && H.parseClaudeSignals(`Note <!--\n@${H.BS_03_REL}\n-->\n`).imports03 === false);
    G('the commented portion of the closing line stays excluded: text before the marker is never read, only what follows it', H.parseClaudeSignals(`Note <!--\n${SENT('9.9.9')} @docs/03-project-architecture.md --> ok\n`).sentences.length === 0 && H.parseClaudeSignals(`Note <!--\n${SENT('9.9.9')} @docs/03-project-architecture.md --> ok\n`).otherArchImports.length === 0);
    G('a code span after the closing marker is code: an import inside it is no import', H.parseClaudeSignals(`Note <!--\nx\n--> \`@${H.BS_03_REL}\`\n`).imports03 === false);
    G('a decision sentence after the closing marker is not a standalone line, so it is ignored (not counted, not conflicting), and a heading after it is no heading', (() => { const r = dec(`Note <!--\nx\n--> ${D}\n`); return r.exact === 0 && r.conflicting.length === 0 && res('Real', H.parseHeadingDoc('# T\n\nNote <!--\nx\n--> ## Real\n')) === 'missing'; })());
    G('the visible tail is also part of the visible text of a document (section text and the stale-value check read it), as before', (() => { const d = H.parseHeadingDoc('# T\n\n## Database\n\nNote <!--\nhidden\n--> shown tail\n'); return sectionTextOf(d, 'Database').includes('shown tail') && !sectionTextOf(d, 'Database').includes('hidden'); })()); }
  // The closing line of a comment BLOCK: CommonMark reads the whole line as the HTML block, a renderer draws what follows the comment. Not decided here: reported.
  for (const [label, t] of [['a multi-line comment block', '<!--\nx\n--> Applied from the `backend-standards` skill, version `9.9.9`.\n'], ['a one-line comment block', '<!-- a --> Applied from the `backend-standards` skill, version `9.9.9`.\n'], ['a comment block followed by an unclosed opener', '<!-- a --> <!-- b\n'], ['a comment block followed by a stray closer', '<!-- a --> x -->\n']]) {
    const s = shapes(t);
    G(`${label} with visible text after its closing marker is an unsupported shape (reported once, on the closing line), so the layout holds`, s.length === 1 && /visible text follows the "-->" that closes an HTML comment block/.test(s[0].reason) && layoutOf({ ...F03, 'CLAUDE.md': `${BS_CLAUDE('3.1.0')}\n${t}` }).treatment === 'hold', s);
  }
}

// ============================================================== GROUP: semantic versions (R8) ====
{
  const G = grp('Semantic versions (R8)');
  const VALID = ['0.0.0', '0.0.1', '1.2.3', '10.20.30', '1.2.3-0', '1.2.3-0a', '1.2.3-01a', '1.2.3-a.0.b', '1.2.3-alpha-1', '1.2.3--', '1.2.3-rc.1', '1.2.3-x.7.z.92', '1.2.3+001', '1.2.3+a.01', '1.2.3-rc.1+build.01', '1.2.3-0+0'];
  const INVALID = ['01.2.3', '1.02.3', '1.2.03', '00.0.0', '1.2.3-01', '1.2.3-rc.01', '1.2.3-00', '1.2.3-', '1.2.3-rc.', '1.2.3-.rc', '1.2.3-rc..1', '1.2.3+', '1.2.3+a..b', '1.2.3-+x', '1.2.3-rc_1', 'v1.2.3', '1.2', '1.2.3.4', ' 1.2.3', '1.2.3 ', '1.2.3\n', '1.2.3-rc.1+', '-1.2.3', '1.2.-3', '1.2.3-é'];
  for (const v of VALID) G(`${JSON.stringify(v)} is a valid semantic version (a stamp, a sentence and the grammar agree)`, H.SEMVER.test(v) && H.parseStamp(JSON.stringify({ version: v, appliedBy: 'backend-standards' })).state === 'valid', v);
  for (const v of INVALID) G(`${JSON.stringify(v)} is NOT a semantic version: the stamp is malformed`, !H.SEMVER.test(v) && H.parseStamp(JSON.stringify({ version: v, appliedBy: 'backend-standards' })).state === 'malformed', v);
  for (const v of ['01.2.3', '1.2.3-01']) {
    const r = layoutOf({ ...F03, [H.STAMP_REL]: STAMP(v) });
    G(`a stamp with the invalid version ${v} holds activation (malformed provenance never activates)`, r.treatment === 'hold', r.treatment);
    const s = layoutOf({ ...F03, 'CLAUDE.md': BS_CLAUDE(v) });
    G(`a provenance sentence with the invalid version ${v} holds activation (a sentence without a concrete version)`, s.treatment === 'hold' && H.parseClaudeSignals(BS_CLAUDE(v)).sentences[0] === null, s.treatment);
  }
  G('the numeric core and prerelease rules accept zero itself but not a zero prefix', H.SEMVER.test('0.0.0-0') && !H.SEMVER.test('0.0.0-00') && !H.SEMVER.test('0.00.0'));
}

// ============================================================== GROUPS: advisory verification (plan amendment 1; review pass 4, N6 to N13) ====
// Amendment 1 makes verify an advisory evidence collector: three outcomes, no acceptance wording, and a read boundary that holds for every read it makes. The groups below cover
// the pass-4 findings (N6 to N13) with one negative control each, then the contract itself (a property over EVERY verify result and CLI run of this spec, the exit code of each
// outcome) and a probe matrix: every earlier probe that verify can observe yields findings or not-evaluable, never a clean outcome.
const same = (a, b) => (process.platform === 'win32' ? String(a).toLowerCase() === String(b).toLowerCase() : a === b);
const touched = (seen, file) => seen.some((p) => same(path.resolve(p), path.resolve(file)));
const withRealpath = (override, fn) => { const saved = fs.realpathSync.native; fs.realpathSync.native = (p, ...a) => override(String(p), () => saved.call(fs.realpathSync, p, ...a)); try { return fn(); } finally { fs.realpathSync.native = saved; } };
const writeIn = (dir, name, content) => { const f = path.join(dir, ...name.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof content === 'string' ? content : JSON.stringify(content)); return f; };
const DEC = H.DECISION_SENTENCE;

// ============================================================== GROUP: CLI input paths (N6) ====
{
  const G = grp('CLI input paths (N6)');
  const root = mkVerify('n6-proj'); const base = H.takeSnapshot(root);
  const dir = liveDir('n6-io');
  const goodB = writeIn(dir, 'baseline.json', base); const goodE = writeIn(dir, 'evidence.json', EVID());
  const run = (b, e, project = root) => { const spy = spyFs({}, () => VF({ project, baselineFile: b, evidenceFile: e })); return { r: spy.value, read: spy.seen.read }; };
  const okRun = run(goodB, goodE);
  G('control: valid input files are opened (the spy sees both reads, so the "never opened" assertions below mean something) and the run has no findings', clean(okRun.r) && touched(okRun.read, goodB) && touched(okRun.read, goodE), { outcome: okRun.r.outcome, reads: okRun.read.length });
  const envF = writeIn(dir, '.env.review-probe', base);
  const probe = run(envF, envF);
  G('the review probe: a synthetic .env.review-probe as BOTH inputs is refused before any read, naming both (it used to be read twice before the rejection)', notEval(probe.r, /baseline file is a protected or policy-denied path/) && notEval(probe.r, /evidence file is a protected or policy-denied path/) && !touched(probe.read, envF), { reasons: probe.r.notEvaluable, outcome: probe.r.outcome });
  for (const [label, name] of [['a .env file', '.env'], ['an upper-case .ENV.local file', '.ENV.local'], ['a nested .env.production file', 'sub/.env.production'], ['a file under a .envs directory', '.envs/baseline.json'], ['a .pem file', 'keys/baseline.pem'], ['a .key file', 'baseline.key'], ['an id_rsa file', 'id_rsa'], ['a file under a secrets directory', 'secrets/baseline.json'], ['a file under a credentials directory', 'credentials/baseline.json'], ['a .npmrc file', '.npmrc']]) {
    const f = writeIn(dir, name, base); const a = run(f, goodE); const b = run(goodB, f);
    G(`${label} as the baseline or as the evidence is refused and neither file is opened`, notEval(a.r, /protected or policy-denied/) && !touched(a.read, f) && !touched(a.read, goodE) && notEval(b.r, /protected or policy-denied/) && !touched(b.read, f) && !touched(b.read, goodB), { a: a.r.notEvaluable, b: b.r.notEvaluable });
  }
  G('control: an input whose name merely contains "env" is not protected and is read', (() => { const f = writeIn(dir, 'environment-baseline.json', base); const r = run(f, goodE); return clean(r.r) && touched(r.read, f); })());
  { const pr = mkVerify('n6-pol', { files: { [POLICY_REL]: policyWith(PRIVATE_DENY) } }); const pb = H.takeSnapshot(pr);
    const denied = writeIn(pr, 'docs/private/baseline.json', pb); const allowed = writeIn(pr, 'docs/ok/baseline.json', pb); const ev = writeIn(dir, 'pol-evidence.json', EVID());
    const a = run(denied, ev, pr); const b = run(allowed, ev, pr);
    G('an input the PROJECT policy denies (docs/private/*, a file inside the project) is refused and never opened, while a neighbour the policy allows is read', notEval(a.r, /policy-denied path \(docs\/private\/baseline\.json\)/) && !touched(a.read, denied) && b.r.outcome !== 'not-evaluable' && touched(b.read, allowed), { a: a.r.notEvaluable, b: b.r.outcome }); }
  { const real = liveDir('n6-real'); const realB = writeIn(real, 'baseline.json', base); const lnk = path.join(liveDir('n6-lnkp'), 'lnk');
    if (!liveJunction(real, lnk)) skip('an input path below a junction is refused and never opened', 'a junction cannot be created on this host');
    else { const viaLink = path.join(lnk, 'baseline.json'); const r = run(viaLink, goodE);
      G('an input path BELOW a junction (an ancestor link, not the file itself) is refused, and neither the link path nor its target is opened', notEval(r.r, /symbolic link or junction/) && !touched(r.read, viaLink) && !touched(r.read, realB), r.r.notEvaluable); } }
  { const target = writeIn(dir, 'real-target.json', base); const sym = path.join(dir, 'sym.json');
    if (!tryFileLink(target, sym)) skip('a symbolic-link input file is refused and never opened', 'a file symbolic link cannot be created on this host');
    else { LIVE_LINKS.push(sym); const r = run(sym, goodE); G('a symbolic-link input file is refused and never opened', notEval(r.r, /symbolic link or junction/) && !touched(r.read, sym) && !touched(r.read, target), r.r.notEvaluable); } }
  G('a directory as an input is refused as not a regular file, and a missing input says it could not be read', notEval(run(dir, goodE).r, /baseline path is not a regular file/) && notEval(run(path.join(dir, 'nope.json'), goodE).r, /baseline file could not be read \(it does not exist\)/));
  { const r = run(goodB, goodE, path.join(LIVE, 'n6-no-project'));
    G('when the project cannot be validated no input file is read at all (the boundary is established first)', notEval(r.r, /no input file was read/) && !touched(r.read, goodB) && !touched(r.read, goodE), r.r.notEvaluable); }
  { const bad = mkVerify('n6-badpol', { files: { [POLICY_REL]: '{nope' } }); const r = run(goodB, goodE, bad);
    G('when the project policy cannot be established no input file is read (an input inside the project could be one the policy denies)', notEval(r.r, /policy could not be established/) && !touched(r.read, goodB) && !touched(r.read, goodE), r.r.notEvaluable); }
  { const r = withRealpath((p, real) => (p.endsWith('baseline.json') ? path.join(path.dirname(p), 'ALIASED', 'baseline.json') : real()), () => run(goodB, goodE));
    G('an input path whose canonical form differs from the supplied one (an alias, a short name, a mount) is refused and never opened', notEval(r.r, /baseline path is not its canonical path/) && !touched(r.read, goodB), r.r.notEvaluable); }
  G('an omitted baseline path is not evaluable, and an omitted evidence path is reported by the evidence check (never read as empty)', notEval(VF({ project: root, baselineFile: undefined, evidenceFile: goodE }), /baseline file was not supplied/) && notEval(VF({ project: root, baselineFile: goodB, evidenceFile: undefined }), /scenario evidence is missing/));
  { const c = captureIo(); const spy = spyFs({}, () => mainV(['verify', '--project', root, '--baseline', envF, '--evidence', envF], c.io)); const out = c.o.join('\n');
    G('the verify command refuses the protected inputs: exit 3, NOT EVALUABLE, the not-evaluable outcome, and the file is never opened', spy.value === 3 && /^NOT EVALUABLE/m.test(out) && /^OUTCOME not-evaluable/m.test(out) && !touched(spy.seen.read, envF), { code: spy.value, out }); }
}

// ============================================================== GROUP: project path chain (N7) ====
{
  const G = grp('Project path chain (N7)');
  const parent = liveDir('n7');
  const realDir = path.join(parent, 'real'); fs.mkdirSync(realDir);
  const projReal = path.join(realDir, 'proj'); fs.mkdirSync(projReal);
  for (const [rel, text] of Object.entries(verifyFiles())) putF(projReal, rel, text);
  const base = H.takeSnapshot(projReal); const ev = EVID();
  G('control: the same project reached through its real path has no findings', clean(V({ project: projReal, baseline: base, evidence: ev })));
  const link = path.join(parent, 'lnk');
  if (!liveJunction(realDir, link)) skip('an ancestor junction of the project is refused before any read', 'a junction cannot be created on this host');
  else {
    const viaLink = path.join(link, 'proj');
    const spy = spyFs({}, () => V({ project: viaLink, baseline: base, evidence: ev }));
    G('the review probe: an ANCESTOR junction of the project (the leaf is a real directory) is not evaluable and no project file is read through it (the leaf-only check returned a clean outcome)', notEval(spy.value, /symbolic link or junction/) && !spy.seen.read.some((p) => p.includes(viaLink)) && !spy.seen.lstat.some((p) => p.includes(`${viaLink}${path.sep}`)), { r: diag(spy.value), read: spy.seen.read.filter((p) => p.includes('lnk')) });
    const bp = writeIn(parent, 'b.json', base); const ep = writeIn(parent, 'e.json', ev);
    const spy2 = spyFs({}, () => VF({ project: viaLink, baselineFile: bp, evidenceFile: ep }));
    G('through the CLI path the same project reads no input file either', notEval(spy2.value, /no input file was read/) && !touched(spy2.seen.read, bp) && !touched(spy2.seen.read, ep), diag(spy2.value));
    const c = captureIo(); const code = mainV(['verify', '--project', viaLink, '--baseline', bp, '--evidence', ep], c.io);
    G('the verify command refuses it: exit 3 and the not-evaluable outcome', code === 3 && /^OUTCOME not-evaluable/m.test(c.o.join('\n')), { code, out: c.o });
  }
  { const spy = spyFs({}, () => withRealpath((p, real) => (same(p, projReal) ? path.join(path.parse(projReal).root, 'elsewhere') : real()), () => V({ project: projReal, baseline: base, evidence: ev })));
    G('a project whose canonical form differs from the supplied path (an alias, a short name, a mount) is not evaluable and nothing is read', notEval(spy.value, /not its canonical path/) && !spy.seen.read.some((p) => same(p.slice(0, projReal.length), projReal)), diag(spy.value)); }
  for (const [label, p] of [['a relative path', 'relative/proj'], ['an empty string', ''], ['undefined', undefined], ['a number', 5], ['null', null], ['a path with a NUL character', `${projReal}\0x`], ['the filesystem root (not a project directory)', path.parse(projReal).root]]) {
    const r = attempt(() => V({ project: p, baseline: base, evidence: ev }));
    G(`${label} as the project is not evaluable and never throws`, r.threw === undefined && r.outcome === 'not-evaluable', r.threw ?? diag(r));
  }
  { const tgtParent = liveDir('n7-tgt'); const tgt = path.join(tgtParent, 'sub'); fs.mkdirSync(tgt); const lnk2 = path.join(parent, 'lnk2');
    if (!liveJunction(tgt, lnk2)) skip('a ".." that follows a junction is normalized before any read', 'a junction cannot be created on this host');
    else {
      const p2 = path.join(parent, 'proj2'); fs.mkdirSync(p2); for (const [rel, text] of Object.entries(verifyFiles())) putF(p2, rel, text);
      const b2 = H.takeSnapshot(p2); const poisoned = path.join(tgtParent, 'proj2'); fs.mkdirSync(poisoned); putF(poisoned, 'AGENTS.md', '# a look-alike behind the junction\n');
      const spy = spyFs({}, () => V({ project: `${lnk2}${path.sep}..${path.sep}proj2`, baseline: b2, evidence: ev })); const r = spy.value;
      const dotted = [...spy.seen.read, ...spy.seen.lstat].filter((p) => /[\\/]\.\.(?:[\\/]|$)/.test(p));
      G('a project path whose ".." follows a junction is judged and read in its normalized form (the sibling of the junction), never as the operating system would resolve it (the sibling of the junction target)', clean(r), diag(r));
      G('no file is opened or inspected through a path that still carries a ".." segment (Windows folds ".." lexically, POSIX follows the link; the observed path strings are what proves it on both hosts)', spy.seen.read.length > 0 && dotted.length === 0, { dotted: dotted.slice(0, 3), reads: spy.seen.read.length });
    } }
}

// ============================================================== GROUP: declared layout vs observed signals (N8) ====
{
  const G = grp('Declared layout vs observed signals (N8)');
  const run = (files, evOver = {}) => { const root = mkVerify('n8', { files }); return { root, r: verify(root, { baseline: H.takeSnapshot(root), evidence: EVID(evOver) }) }; };
  const n8 = (r) => findingDetail(r, /observed activation signals agree/);
  const SENT9 = 'Applied from the `backend-standards` skill, version `9.9.9`.';
  const ctl = run({});
  G('control: valid provenance (CLAUDE.md sentence and import, readable 03) activates, agrees with the declared mapped layout, and the check is listed as without a finding', clean(ctl.r) && ctl.r.checked.some((x) => /observed activation signals agree/.test(x.name)), diag(ctl.r));
  const HOLDS = [
    ['a malformed stamp (not JSON) beside valid provenance, the review probe', { [H.STAMP_REL]: '{nope' }, /malformed stamp/],
    ['a stamp with the invalid version 01.2.3', { [H.STAMP_REL]: STAMP('01.2.3') }, /malformed stamp/],
    ['a stamp written by another skill', { [H.STAMP_REL]: `${JSON.stringify({ appliedBy: 'other-skill', version: '1.0.0' })}\n` }, /stamp appliedBy conflicts/],
    ['a stamp version that contradicts the CLAUDE.md sentence', { [H.STAMP_REL]: STAMP('9.9.9') }, /contradictory versions/],
    ['two visible provenance sentences with different versions, the review probe', { 'CLAUDE.md': `${MERGED_CLAUDE}\n${SENT9}\n` }, /conflicting or ambiguous provenance/],
    ['an import of another architecture document', { 'CLAUDE.md': `${MERGED_CLAUDE}\n@docs/03-project-architecture.md\n` }, /another architecture document/],
    ['a conflicting owner-decision record', { 'AGENTS.md': `${renderAgents(true)}\nDocumentation layout decision: use docs/other.md as the source.\n` }, /conflicting decision record/],
    ['a duplicated owner-decision record', { 'AGENTS.md': `${renderAgents(true)}\n${DEC}\n\n${DEC}\n` }, /duplicated decision records/],
  ];
  for (const [label, files, why] of HOLDS) {
    const { root, r } = run(files); const d = n8(r); const direct = H.classifyLayout(H.collectSignals(root));
    G(`${label}: classifyLayout holds, so the declared mapped layout is a finding (never a clean outcome), and the finding carries the reason`, r.outcome === 'findings' && d !== undefined && d.observed === 'hold' && why.test(d.reason) && direct.treatment === 'hold' && d.declared === 'bs-mapped', { d, direct: direct.treatment });
  }
  const NOSIG = { 'CLAUDE.md': `${PS_CLAUDE_TEMPLATE}\n${USER_LINE}\n` };
  // The fixture's pointers are installed, so "no accepted signal" classifies as preserve (pointers kept, the inconsistency reported), which is not the activation the mapped claim needs.
  for (const [label, files, treatment] of [['no signal at all with 03 readable and pointers installed (no stamp, no sentence, no decision)', NOSIG, 'preserve'], ['an owner decision that only a multi-line comment holds (hidden, so not a signal)', { ...NOSIG, 'AGENTS.md': `${renderAgents(true)}\nNote <!--\n${DEC}\n-->\n` }, 'preserve'], ['no 03 and no signal, with pointers still installed', { ...NOSIG, [H.BS_03_REL]: null }, 'preserve']]) {
    const { root, r } = run(files); const d = n8(r);
    G(`${label}: the observed treatment is ${treatment}, which does not support the declared mapped layout (a finding)`, r.outcome === 'findings' && d !== undefined && d.observed === treatment && H.classifyLayout(H.collectSignals(root)).treatment === treatment, d);
  }
  { const { r } = run({}, { layout: 'ordinary' }); const d = n8(r);
    G('the opposite claim is a finding too: a project whose signals activate, declared ordinary', r.outcome === 'findings' && d !== undefined && d.observed === 'activate' && d.declared === 'ordinary', d); }
  G('controls: a valid stamp beside the sentence, and an exact owner decision beside no BS text, still activate and the layout claim is not a finding', (() => { const a = run({ [H.STAMP_REL]: STAMP('3.1.0') }); const b = run({ ...NOSIG, 'AGENTS.md': `${renderAgents(true)}\n${DEC}\n` }); return n8(a.r) === undefined && n8(b.r) === undefined && H.classifyLayout(H.collectSignals(b.root)).treatment === 'activate'; })());
}

// ============================================================== GROUP: unresolved blanks in referenced sections (N9) ====
{
  const G = grp('Unresolved blanks (N9)');
  const run = (t03, files = {}, evOver = {}) => { const root = mkVerify('n9', { files: { [H.BS_03_REL]: t03, ...files } }); return verify(root, { baseline: H.takeSnapshot(root), evidence: EVID(evOver) }); };
  const blanksOf = (r) => findingDetail(r, /unresolved blanks/);
  const refsOfPointers = [...new Set(VERIFY_POINTERS.flatMap((p) => H.mappingRefsFor(p)))];
  const expected = H.checkBlankSections({ doc03Text: BS03, refs: refsOfPointers });
  const tmpl = run(BS03);
  G('the review probe: an untouched BS 03 template under an otherwise correct project is a finding, and the finding is exactly what checkBlankSections reports for the referenced sections (it used to be a clean outcome)', tmpl.outcome === 'findings' && expected.length > 0 && JSON.stringify([...(blanksOf(tmpl) ?? [])].map((b) => b.detail).sort()) === JSON.stringify(expected.map((b) => b.detail).sort()), { expected: expected.length, got: blanksOf(tmpl) });
  G('the template blanks cover the mapped sections the review named (database, schema changes, money, module layout)', ['Database', 'Database > Schema changes', 'Database > Money', 'Module layout'].every((s) => expected.some((e) => e.detail.startsWith(s))), expected.map((e) => e.detail.slice(0, 30)));
  G('control: the same 03 with every blank replaced by an explicit unknown has no findings', clean(run(FILLED03)), diag(run(FILLED03)));
  G('one blank left in a referenced section (Domain glossary, which the installed glossary pointer references) is a finding', (() => { const r = run(insertUnder(FILLED03, 'Domain glossary', '- `<TERM>` and its definition')); const b = blanksOf(r) ?? []; return r.outcome === 'findings' && b.length === 1 && b[0].code === 'blank-section' && b[0].detail.startsWith('Domain glossary'); })());
  G('a blank in a section no installed pointer references (Health, shutdown, deployment) is not a finding (the check is about referenced sections)', clean(run(insertUnder(FILLED03, 'Health, shutdown, deployment', '- `<ENDPOINT>`'))));
  G('a blank line that states an explicit unknown is accepted, and a blank hidden in an HTML comment is not visible to a reader', clean(run(insertUnder(FILLED03, 'Domain glossary', '- `<TERM>` not determined from code'))) && clean(run(insertUnder(FILLED03, 'Domain glossary', '<!-- `<TERM>` -->'))));
  { const bullets = [...H.mappingRefsFor('docs/database.md'), 'Landmines']; const files = { 'docs/database.md': pointerOf('docs/database.md', { bullets }) };
    const withBlank = run(insertUnder(FILLED03, 'Landmines', '- `<RISK>`'), files); const without = run(FILLED03, files);
    G('a section the pointer lists beyond the mapping (its own bullets count as references) is checked too: a blank in it is a finding, and without the blank there is none', withBlank.outcome === 'findings' && (blanksOf(withBlank) ?? []).some((b) => b.detail.startsWith('Landmines')) && clean(without), { withBlank: diag(withBlank), without: diag(without) }); }
  { const mapped = H.mappingRefsFor('docs/database.md'); const files = { 'docs/database.md': pointerOf('docs/database.md', { bullets: mapped.filter((x) => x !== 'Module layout') }) };
    const r = run(insertUnder(FILLED03, 'Module layout', '- `<PATH>`'), files);
    G('a section the MAPPING assigns to a pointer is checked even when the pointer forgot to list it (the bullet-missing finding does not hide the blank): the blank in Module layout is reported through docs/database.md', mapped.includes('Module layout') && r.outcome === 'findings' && (blanksOf(r) ?? []).some((b) => b.detail.startsWith('Module layout')) && findingAt(r, CHK.pointerInspect, 'docs/database.md') !== undefined, { r: diag(r), blanks: blanksOf(r) }); }
  G('a missing 03 is reported by the presence check only (no blank check on a document that is not there)', (() => { const root = mkVerify('n9-no03', { files: { [H.BS_03_REL]: null } }); const r = verify(root, { baseline: H.takeSnapshot(root) }); return r.outcome === 'findings' && findingNames(r).some((n) => /03 is still present/.test(n)) && !findingNames(r).some((n) => /unresolved blanks/.test(n)); })());
}

// ============================================================== GROUP: code fences (N10) ====
{
  const G = grp('Code fences (N10)');
  const shapes = (t) => H.unsupportedShapes(t);
  const CLOSES = [
    ['a matching closing fence', '```\ncode\n```\n## After\n', true],
    ['a longer closing fence', '```\ncode\n````\n', true],
    ['a closing fence with trailing spaces and a tab', '```\ncode\n```  \t\n', true],
    ['a closing fence indented three spaces', '```\ncode\n   ```\n', true],
    ['a tilde fence closed by tildes', '~~~\ncode\n~~~\n', true],
    ['an opener with a backtick in its info string (inline code, not a fence)', '``` a`b\n## Heading\n', true],
    ['a matching run followed by text, the review probe', '```\n## Heading\n``` x\n', false],
    ['a matching run followed by an info string', '```\ncode\n```js\n', false],
    ['a closing run shorter than the opener', '````\ncode\n```\n', false],
    ['a closing run of the other fence character', '```\ncode\n~~~\n', false],
    ['a closing run indented four spaces (code inside the fence)', '```\ncode\n    ```\n', false],
    ['a fence that never meets a closer', '```\ncode only\n', false],
  ];
  for (const [label, t, closes] of CLOSES) {
    const s = shapes(t);
    G(`scanner: ${label} ${closes ? 'leaves no report' : 'is reported once as a fence that never closes (on the opening line)'}`, closes ? s.length === 0 : s.length === 1 && s[0].line === 1 && /never closes/.test(s[0].reason), s);
  }
  G('the decisions and headings after an unclosed fence are not operative: the unclosed file lists the shape while a decision after it is not counted', (() => { const t = `\`\`\`\n${DEC}\n`; const r = H.findDecisionRecords(t); return r.exact === 0 && r.unsupported.length === 1 && H.parseHeadingDoc('```\n## Hidden\n').headings.length === 0 && H.parseHeadingDoc('```\n## Hidden\n').unsupported.length === 1; })());
  // The review probe: an opening fence, an invalid closing fence and every required heading. A longer opener keeps the fences inside BS 03 from closing it.
  const OPEN = '````';
  const probe03 = `${OPEN}\n${FILLED03}\n${OPEN} x\n`; const closed03 = `${OPEN}\n${FILLED03}\n${OPEN}\n`;
  const v03 = (t03, files = {}, evOver = {}) => { const root = mkVerify('n10', { files: { [H.BS_03_REL]: t03, ...files } }); return attempt(() => verify(root, { baseline: H.takeSnapshot(root), evidence: EVID(evOver) })); };
  { const r = v03(probe03);
    G('the review probe: a 03 holding every required heading inside an opening fence with an invalid closing fence is NOT EVALUABLE naming the fence (it returned a clean outcome)', notEval(r, /unsupported Markdown shape: \.ai\/standards\/03-project-architecture\.md line 1: a code fence opened on line 1 never closes/), diag(r));
    const c = v03(closed03);
    G('control: with a valid closing fence the whole 03 is code, so no heading resolves and the pointers are findings (still not a clean outcome, and evaluable)', c.outcome === 'findings' && findingAt(c, CHK.pointerInspect, 'docs/database.md') !== undefined, diag(c)); }
  for (const [label, files] of [['CLAUDE.md', { 'CLAUDE.md': `${MERGED_CLAUDE}\n\`\`\`\nnever closed\n` }], ['the root AGENTS.md', { 'AGENTS.md': `${renderAgents(true)}\n\`\`\`\nnever closed\n` }], ['TODO.md', { 'TODO.md': '# TODO\n\n```\nnever closed\n' }]]) {
    const r = v03(FILLED03, files); const rel = label === 'CLAUDE.md' ? 'CLAUDE.md' : label === 'TODO.md' ? 'TODO.md' : 'AGENTS.md';
    G(`an unclosed fence in ${label} makes the verification not evaluable naming that file`, notEval(r, new RegExp(`${rel.replace('.', '\\.')} line \\d+: a code fence`)), diag(r));
  }
  { const r = v03(FILLED03, { 'src/wallet/AGENTS.md': '# local\n```\nnever closed\n', 'src/wallet/CLAUDE.md': '@AGENTS.md\n' }, { nested: [{ dir: 'src/wallet' }] });
    G('an unclosed fence in a nested instruction file of the evidence is not evaluable too', notEval(r, /src\/wallet\/AGENTS\.md line \d+: a code fence/), diag(r)); }
  { const r = v03(FILLED03, { '.ai/context/code-patterns.md': '# Patterns\n```\nnever closed\n' }, { fullDocuments: ['.ai/context/code-patterns.md'] });
    G('an unclosed fence in a declared full document is not evaluable (it is read through the scanner by the consolidation check)', notEval(r, /code-patterns\.md line \d+: a code fence/), diag(r)); }
  { const claude = `${BS_CLAUDE('3.1.0')}\n\`\`\`\nnever closed\n`; const agents = DECISION_AGENTS('\n```\nnever closed\n');
    G('layout classification holds on an unclosed fence in CLAUDE.md or AGENTS.md (what follows is code, so the signals read are not evidence of absence)', layoutOf({ ...F03, 'CLAUDE.md': claude }).treatment === 'hold' && layoutOf({ ...F03, 'AGENTS.md': agents }).treatment === 'hold' && layoutOf({ ...F03, 'CLAUDE.md': BS_CLAUDE('3.1.0') }).treatment === 'activate'); }
}

// ============================================================== GROUP: preservation reads what a reader sees (N11) ====
{
  const G = grp('Preservation is visible (N11)');
  const rc = (t) => recoverClaude(t);
  const imp = BS_IMPORTS.find((i) => i !== `@${H.BS_03_REL}`);
  const hide = (text, s) => text.replace(s, `<!-- ${s} -->`);
  const fence = (text, s) => text.replace(s, `\`\`\`\n${s}\n\`\`\``);
  G('control: the merged CLAUDE.md keeps its BS imports, its provenance sentence and the user line', rc(MERGED_CLAUDE).length === 0, rc(MERGED_CLAUDE));
  for (const i of BS_IMPORTS) G(`the BS import ${i} moved into an HTML comment is lost (it was found by raw text)`, has(rc(hide(MERGED_CLAUDE, i)), 'bs-import-lost') && !has(rc(MERGED_CLAUDE), 'bs-import-lost'), codes(rc(hide(MERGED_CLAUDE, i))));
  G('the BS provenance sentence moved into an HTML comment is lost, the user line moved into one is lost, and a whole commented BS block loses everything', has(rc(hide(MERGED_CLAUDE, BS_SENTENCE)), 'bs-version-lost') && has(rc(hide(MERGED_CLAUDE, USER_LINE)), 'user-content-lost') && ['bs-import-lost', 'bs-version-lost'].every((c) => has(rc(MERGED_CLAUDE.replace(BS_CLAUDE(), `<!--\n${BS_CLAUDE()}\n-->`)), c)));
  G('an import or the provenance sentence inside a code block is an example, not an instruction (lost), while the user line in a code block is still on the page (kept)', has(rc(fence(MERGED_CLAUDE, imp)), 'bs-import-lost') && has(rc(fence(MERGED_CLAUDE, BS_SENTENCE)), 'bs-version-lost') && !has(rc(fence(MERGED_CLAUDE, USER_LINE)), 'user-content-lost'));
  { const root = mkVerify('n11-e2e', { files: { 'CLAUDE.md': hide(MERGED_CLAUDE, imp) } }); const r = verify(root, { baseline: H.takeSnapshot(root) });
    G('end to end: the same hidden import is a CLAUDE.md finding (bs-import-lost), never a clean outcome (the run returned a clean outcome by raw text)', r.outcome === 'findings' && (findingDetail(r, /CLAUDE\.md: import/) ?? []).some((d) => d.code === 'bs-import-lost'), diag(r)); }
  const FDOC = '.ai/context/code-patterns.md';
  G('an invariant that survives only inside an HTML comment of a declared full document is omitted (the visible copy is consolidated)', consolidate({ fullDocuments: { [FDOC]: '# Code patterns\n\n<!-- Use the Result helper for service returns -->\n' } }).some((x) => x.id === 'full-1' && x.code === 'omitted') && consolidate().length === 0);
  G('a fact whose only copy is inside an HTML comment of TODO.md is omitted (visible, it needs the todo disposition), and an invariant likewise', consolidate({ doc03Text: build03(['cfg-1']), todoText: '<!-- - WALLET_LOCK_TTL_MS optional number read by WalletService -->\n' }).some((x) => x.id === 'cfg-1' && x.code === 'omitted') && consolidate({ doc03Text: build03(['cfg-1']), todoText: '- WALLET_LOCK_TTL_MS optional number read by WalletService\n' }).some((x) => x.code === 'todo-without-disposition') && consolidate({ doc03Text: build03(['inv-1']), todoText: '<!-- - Lock order is wallet then ledger and never the reverse -->\n' }).some((x) => x.id === 'inv-1' && x.code === 'omitted'));
  const base = renderAgents(true);
  const hideIn = (s) => { if (!base.includes(s)) throw new Error(`the fixture does not contain: ${s.slice(0, 40)}`); return hide(base, s); };
  G('control: the activated canonical AGENTS.md has no root-instruction finding', rootCheck(base).length === 0, rootCheck(base));
  for (const [label, s, code] of [['the conditional routing paragraph', ROOT_PARAGRAPH, 'routing-paragraph-missing'], ['the navigation sentence', NAV_SENTENCE, 'navigation-sentence-missing'], ['a template critical rule', '- Never log or return personal data or secrets. Redact before logging.', 'critical-rule-lost'], ['the database-change policy sentence', "Database changes follow the project's own policy: migrations only.", 'db-policy-missing'], ['the critical-modules reference', ' See `.ai/context/critical-modules.md`.', 'critical-modules-reference']]) G(`${label} moved into an HTML comment is gone for the reader (${code})`, has(rootCheck(hideIn(s)), code), codes(rootCheck(hideIn(s))));
  G('a summary block whose only content is an HTML comment is empty (summary-missing), and an unrelated user line moved into a comment is lost while its visible copy is kept', (() => { const line = 'Team note: wallet code is reviewed by two people.'; const emptied = base.replace(/<!-- project-setup:begin id=overview -->[\s\S]*?<!-- project-setup:end id=overview -->/, '<!-- project-setup:begin id=overview -->\n<!-- Overview. -->\n<!-- project-setup:end id=overview -->'); return has(rootCheck(emptied), 'summary-missing') && has(rootCheck(`${base}\n<!-- ${line} -->\n`, { unrelatedLines: [line] }), 'unrelated-text-lost') && !has(rootCheck(`${base}\n${line}\n`, { unrelatedLines: [line] }), 'unrelated-text-lost'); })());
  G('known limitation, listed in the output: a commented copy of the root-start rule is still reported as a duplicate (a "must not be there" check reads raw text, the safe direction)', has(rc(`${MERGED_CLAUDE}\n<!-- You MUST start Claude Code at this repository's root -->\n`), 'duplicate-instructions'));
  G('known limitation, listed in the output: routing text inside a comment of a non-activated project is still reported (raw text, the safe direction)', has(rootCheck(`${renderAgents(false)}\n<!-- ${ROOT_PARAGRAPH} -->\n`, { activated: false }), 'routing-without-activation'));
  G('the raw-text checks that remain are named in the limitations footer', H.KNOWN_LIMITATIONS.some((l) => /raw text/.test(l) && /root-start rule/.test(l) && /not mapped/.test(l) && /copied into a pointer/.test(l)));
}

// ============================================================== GROUP: approved heading rename (N12, a known limitation) ====
{
  const G = grp('Approved rename (N12)');
  const renamed03 = FILLED03.replace(/^## 7\. Database$/m, '## 7. Persistence');
  const bullets = H.mappingRefsFor('docs/database.md').map((b) => b.replace(/^Database/, 'Persistence'));
  const root = mkVerify('n12', { files: { [H.BS_03_REL]: renamed03, 'docs/database.md': pointerOf('docs/database.md', { bullets }) } });
  const r = verify(root, { baseline: H.takeSnapshot(root) });
  G('an approved Database to Persistence rename, with consistent pointer bullets, is a finding the maintainer resolves (the helper has no field for the approved name): never a clean outcome', r.outcome === 'findings' && (findingAt(r, CHK.pointerInspect, 'docs/database.md')?.detail?.found ?? []).some((f) => f.code === 'bullet-missing'), diag(r));
  const ctl = verify(mkVerify('n12-ctl'));
  G('every output states the rename limitation, whatever the outcome', [ctl, r, V({ project: path.join(LIVE, 'n12-none'), baseline: {}, evidence: {} })].every((x) => /approved heading rename/.test(H.formatVerify(x, false)) && /Database to Persistence/.test(H.formatVerify(x, false))), ctl.outcome);
}

// ============================================================== GROUP: manifest validated by the production checkManifest (N13) ====
{
  const G = grp('Manifest (N13)');
  // The baseline is taken from the valid fixture BEFORE the manifest under test is written (a baseline with a malformed manifest is itself not evaluable), as a run would see it.
  const run = (manifestText, files = {}, evOver = {}) => { const root = mkVerify('n13', { files }); const base = H.takeSnapshot(root); putF(root, H.MANIFEST_REL, manifestText); return verify(root, { baseline: base, evidence: EVID(evOver) }); };
  const mfind = (r) => findingDetail(r, /production manifest check/);
  const merged = Object.fromEntries(VERIFY_POINTERS.map((p) => [p, { ownership: 'merged' }]));
  const probe = run(`${JSON.stringify({ files: merged })}\n`);
  G('the review probe: a manifest holding only files is a finding carrying the production issue "schema must be 2 or 3" (it used to allow a clean outcome), though the ownership checks themselves find nothing', probe.outcome === 'findings' && (mfind(probe) ?? []).includes('schema must be 2 or 3') && findingNames(probe).length === 1, diag(probe));
  const M3 = { ...MANIFEST_BASE, files: merged };
  const TABLE = [
    ['a valid schema 3 manifest', M3],
    ['a valid schema 2 manifest (migration input, valid for the production check)', { schema: 2, skill: 'project-setup', skillVersion: '2.0.0', agents: ['claude'], files: merged }],
    ['an unknown schema', { ...M3, schema: 4 }],
    ['a missing skill field', (() => { const m = { ...M3 }; delete m.skill; return m; })()],
    ['a skillVersion that is not text', { ...M3, skillVersion: 3 }],
    ['a missing mode', (() => { const m = { ...M3 }; delete m.mode; return m; })()],
    ['agents that are not a list of text', { ...M3, agents: 'claude' }],
    ['a sourceCommit that is a number', { ...M3, sourceCommit: 7 }],
    ['a record with an ownership the manifest does not know', { ...M3, files: { ...merged, 'docs/database.md': { ownership: 'user' } } }],
    ['a full record without its sha256', { ...M3, files: { ...merged, 'docs/database.md': { ownership: 'full' } } }],
    ['files that is not an object', { ...M3, files: [] }],
    ['a manifest that records itself', { ...M3, files: { ...merged, '.ai/manifest.json': { ownership: 'merged' } } }],
  ];
  for (const [label, m] of TABLE) {
    const issues = checkManifest(m); let r;
    try { r = run(`${JSON.stringify(m)}\n`); } catch (e) { r = { threw: String(e) }; }
    const f = r.threw === undefined ? mfind(r) : undefined;
    G(`${label}: verify reports a manifest finding exactly when the production checkManifest does (${issues.length} issue${issues.length === 1 ? '' : 's'}), with the same issues`, r.threw === undefined && (issues.length === 0 ? f === undefined && !findingNames(r).some((n) => /production manifest check/.test(n)) : JSON.stringify(f) === JSON.stringify(issues)), r.threw ?? { issues, f });
  }
  const ORD_FILES = { 'AGENTS.md': renderAgents(false), 'CLAUDE.md': `${PS_CLAUDE_TEMPLATE}\n${USER_LINE}\n`, [H.BS_03_REL]: null, ...Object.fromEntries(VERIFY_POINTERS.map((p) => [p, null])) };
  const ordEv = (o = {}) => EVID({ layout: 'ordinary', pointers: [], fullDocuments: [], claude: { bsImports: [], bsVersionSentence: null, userLines: [USER_LINE] }, ...o });
  G('an ordinary layout validates a manifest that exists as well (a files-only one is a finding), and one that does not parse is a finding, while no manifest at all is none', (() => { const f = (m) => { const root = mkVerify('n13-ord', { files: { ...ORD_FILES, [H.MANIFEST_REL]: null } }); const base = H.takeSnapshot(root); if (m !== null) putF(root, H.MANIFEST_REL, m); return verify(root, { baseline: base, evidence: ordEv() }); }; const a = f(`${JSON.stringify({ files: {} })}\n`); const b = f('{nope'); const c = f(null); return a.outcome === 'findings' && (mfind(a) ?? []).includes('schema must be 2 or 3') && b.outcome === 'findings' && findingNames(b).some((n) => /present and parses/.test(n)) && clean(c); })());
  G('validate.mjs --json results stay a maintainer-recorded item: the footer says the helper does not run them', H.KNOWN_LIMITATIONS.some((l) => /validate\.mjs --json/.test(l) && /does not run them/.test(l)));
}

// ============================================================== GROUPS: report encoding, read failures, inventory walk, check names (review pass 5, N14 to N17) ====
// Shared with the property group at the end, which applies the report grammar to EVERY recorded run, not only to the cases written here.
const FORBIDDEN = /\bpass(?:ed|es)?\b|\bcomplet(?:e|ed|ely|ion)\b|\bcompatib\w*/i;
// The helper's own lines: everything but the indented "- " lines that echo evidence or project content (a user may name a key "passed"; an echo of that is not a result).
const own = (out) => out.split('\n').filter((l) => !/^ {8}- /.test(l));
const ch = (n) => String.fromCharCode(n);
const LS = ch(0x2028);
const PS = ch(0x2029);
// Every line break a reader, a terminal or a log parser may honor, not only LF: a bare CR, VT, FF, NEL and the two Unicode separators start a line too.
const LINE_BREAK = new RegExp(`\\r\\n|[\\n\\r\\v\\f\\u0085${LS}${PS}]`);
const NON_LF_CONTROL = new RegExp(`[\\u0000-\\u0009\\u000b-\\u001f\\u007f-\\u009f${LS}${PS}]`);
const outcomeLines = (out) => out.split(LINE_BREAK).filter((l) => /^OUTCOME /.test(l));
// The report grammar: every line is one of these shapes, and nothing in it came from input except on an indented detail line (N14).
const REPORT_LINES = [/^NOT EVALUABLE {2}a required input of the verification is present and valid$/, /^FINDING {2}/, /^NO FINDING {2}/, /^\d+ checks without a finding \/ \d+ findings \/ \d+ reasons not evaluable$/, /^OUTCOME (?:not-evaluable|findings|no-automated-findings): /, /^KNOWN LIMITATIONS \(/, /^ {2}- /, /^ {8}- /];
/** What is wrong with a report ([] = nothing): a control character other than LF, a line the helper does not write, anything but exactly one OUTCOME line (every line break counted), and, given its result, a number of NOT EVALUABLE, FINDING or NO FINDING lines that is not the result's. */
const reportGrammarProblems = (text, r = null) => {
  const p = [];
  if (NON_LF_CONTROL.test(text)) p.push('a control character other than LF');
  const lines = text.split('\n');
  const stray = lines.filter((l) => !REPORT_LINES.some((re) => re.test(l)));
  if (stray.length > 0) p.push(`lines the helper does not write: ${JSON.stringify(stray.slice(0, 2))}`);
  const outcomes = outcomeLines(text);
  if (outcomes.length !== 1) p.push(`${outcomes.length} OUTCOME lines`);
  if (r !== null) for (const [re, n, what] of [[/^NOT EVALUABLE {2}/, r.notEvaluable.length, 'NOT EVALUABLE'], [/^FINDING {2}/, r.findings.length, 'FINDING'], [/^NO FINDING {2}/, r.checked.length, 'NO FINDING']]) { const got = lines.filter((l) => re.test(l)).length; if (got !== n) p.push(`${got} ${what} lines for ${n} entries`); }
  return p;
};
const errCode = (code) => Object.assign(new Error(`${code}: simulated`), { code });
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Runs fn with filesystem calls made to fail on demand: hooks.lstat, hooks.read, hooks.readdir and hooks.write receive the path and may throw. The helper calls them through the shared fs object. */
function faultFs(hooks, fn) {
  const saved = { lstatSync: fs.lstatSync, readFileSync: fs.readFileSync, readdirSync: fs.readdirSync, writeFileSync: fs.writeFileSync };
  fs.lstatSync = function (p, ...a) { if (hooks.lstat) hooks.lstat(String(p)); return saved.lstatSync.call(this, p, ...a); };
  fs.readFileSync = function (p, ...a) { if (hooks.read) hooks.read(String(p)); return saved.readFileSync.call(this, p, ...a); };
  fs.readdirSync = function (p, ...a) { if (hooks.readdir) hooks.readdir(String(p)); return saved.readdirSync.call(this, p, ...a); };
  fs.writeFileSync = function (p, ...a) { if (hooks.write) hooks.write(String(p)); return saved.writeFileSync.call(this, p, ...a); };
  try { return fn(); } finally { Object.assign(fs, saved); }
}

// ============================================================== GROUP: report injection (N14) ====
{
  const G = grp('Report encoding (N14)');
  const FORGED = 'OUTCOME no-automated-findings: passed';
  const LF = ch(10);
  const BREAKS = [['LF', LF], ['CR', ch(13)], ['CRLF', ch(13) + ch(10)], ['NEL (U+0085)', ch(0x85)], ['VT', ch(11)], ['FF', ch(12)], ['U+2028', LS], ['U+2029', PS], ['NUL', ch(0)], ['ESC', ch(27)], ['DEL', ch(127)]];
  const forged = (text) => text.split(LINE_BREAK).some((l) => l.startsWith(FORGED));
  const R = (o) => ({ outcome: 'findings', findings: [], notEvaluable: [], checked: [], expectPartial: false, ...o });
  // direct: the encoded value appears as such in the text (a JSON object detail escapes some characters itself, so it is judged by the grammar alone).
  const shapes = (bad) => [
    ['a reason', true, R({ outcome: 'not-evaluable', notEvaluable: [`reason ${bad}`] })],
    ['a finding name', true, R({ findings: [{ name: `name ${bad}` }] })],
    ['a string detail', true, R({ findings: [{ name: 'n', detail: `detail ${bad}` }] })],
    ['an object detail', false, R({ findings: [{ name: 'n', detail: { path: `p ${bad}`, found: [{ code: 'c', detail: `d ${bad}` }] } }] })],
    ['a checked name', true, R({ outcome: 'no-automated-findings', checked: [{ name: `name ${bad}` }] })],
    ['a checked detail', true, R({ outcome: 'no-automated-findings', checked: [{ name: 'n', detail: `d ${bad}` }] })],
  ];
  for (const [label, brk] of BREAKS) {
    const bad = `${brk}${FORGED}`;
    const failing = shapes(bad).filter(([, direct, r]) => { const text = H.formatVerify(r, false); return reportGrammarProblems(text, r).length > 0 || forged(text) || (direct && !text.includes(H.encodeLine(bad))); }).map(([name]) => name);
    G(`${label} inside a reason, a finding name, a string detail, an object detail, a checked name and a checked detail stays on its line: the report keeps its grammar and holds exactly one OUTCOME line, never a forged one`, failing.length === 0, failing);
  }
  G('encodeLine writes every control character, NEL, DEL and both Unicode separators as a visible escape (\\xNN, or \\uNNNN above 0xFF) and leaves ordinary text, a Windows path and non-ASCII letters alone', (() => {
    const all = []; for (let n = 0; n < 0xa0; n += 1) if (n < 0x20 || n >= 0x7f) all.push(n); all.push(0x2028, 0x2029);
    const encoded = all.map((n) => H.encodeLine(ch(n)));
    return H.encodeLine(ch(10)) === '\\x0a' && H.encodeLine(ch(13)) === '\\x0d' && H.encodeLine(ch(0x85)) === '\\x85' && H.encodeLine(LS) === '\\u2028' && H.encodeLine(PS) === '\\u2029'
      && encoded.every((e) => e.length >= 4 && !NON_LF_CONTROL.test(e) && !e.includes(LF)) && H.encodeLine('docs/été.md D:\\x\\y z') === 'docs/été.md D:\\x\\y z';
  })());
  const baseRoot = mkVerify('n14'); const base = H.takeSnapshot(baseRoot);
  const io = liveDir('n14-io'); const bp = writeIn(io, 'b.json', base);
  const cliRun = (project, ev) => { const ep = writeIn(io, `e-${Math.random().toString(16).slice(2)}.json`, ev); const c = captureIo(); const code = mainV(['verify', '--project', project, '--baseline', bp, '--evidence', ep], c.io); return { code, out: c.o.join('\n'), err: c.e.join('\n') }; };
  { const a = cliRun(`${path.join(LIVE, 'n14-none')}${LF}${FORGED}`, EVID());
    G('the review probe: a line break in --project (a normal command) prints ONE OUTCOME line, not-evaluable with exit 3, and the path is on a detail line as escaped text (it printed a forged "OUTCOME no-automated-findings: passed" line too)', a.code === 3 && reportGrammarProblems(a.out).length === 0 && !forged(a.out) && /^OUTCOME not-evaluable/m.test(a.out) && a.out.includes('\\x0a'), a); }
  { const a = cliRun(baseRoot, EVID({ [`k${LF}${FORGED}`]: 1 }));
    G('the review probe: an evidence KEY with a line break is not evaluable with one OUTCOME line and the key escaped on its detail line (it forged a second OUTCOME line)', a.code === 3 && reportGrammarProblems(a.out).length === 0 && !forged(a.out) && /unknown keys: k\\x0aOUTCOME/.test(a.out), a); }
  { const root = mkVerify('n14-str'); const rel = `docs/a${LF}${FORGED}.md`;
    const r = verify(root, { baseline: H.takeSnapshot(root), evidence: EVID({ pointers: [...VERIFY_POINTERS, rel] }) }); const text = H.formatVerify(r, false);
    G('the review probe: a string detail built from an evidence path with a line break (the path of a pointer that is missing) is one escaped detail line (the path was in the check NAME, where a break also forged a line)', r.outcome === 'findings' && r.findings.some((x) => typeof x.detail === 'string' && x.detail.includes(LF)) && reportGrammarProblems(text, r).length === 0 && !forged(text) && text.includes('\\x0a'), { r: diag(r), text }); }
  // Through the helper: every place evidence or project text reaches a reason, a name or a detail, with every kind of line break. Each run is also recorded for the property group.
  const probes = (brk) => [
    ['an evidence pointer path', { pointers: [...VERIFY_POINTERS, `docs/a${brk}${FORGED}.md`] }],
    ['an evidence full-document path', { fullDocuments: [`notes/a${brk}${FORGED}.md`] }],
    ['an evidence extension key', { extensions: { [`ext/a${brk}${FORGED}.md`]: {} } }],
    ['an evidence nested directory', { nested: [{ dir: `pkg${brk}${FORGED}` }] }],
    ['an unknown evidence key', { [`k${brk}${FORGED}`]: 1 }],
    ['an agent name', { agents: { reviewer: { disposition: 'take-new' }, 'docs-sync': { disposition: 'take-new' }, [`x${brk}${FORGED}`]: { disposition: 'keep' } } }],
    ['an unrelated AGENTS.md line the run lost', { unrelatedAgentsLines: [`line${brk}${FORGED}`] }],
    ['a user line of CLAUDE.md the run lost', { claude: { ...EVID().claude, userLines: [USER_LINE, `lost${brk}${FORGED}`] } }],
  ];
  const reached = (r, brk) => JSON.stringify(r).includes(JSON.stringify(brk).slice(1, -1));
  for (const [label, brk] of BREAKS.filter(([l]) => ['LF', 'CR', 'NEL (U+0085)', 'U+2028', 'U+2029', 'VT'].includes(l))) {
    let reachedCount = 0;
    const failing = probes(brk).flatMap(([what, over]) => { const r = attempt(() => verify(baseRoot, { baseline: base, evidence: EVID(over) })); if (r.threw !== undefined) return [`${what}: threw`]; if (reached(r, brk)) reachedCount += 1; const text = H.formatVerify(r, false); return reportGrammarProblems(text, r).length > 0 || forged(text) ? [what] : []; });
    G(`${label} in evidence or project text, through the helper (a path, a key, a name, a lost line): no report line is forged and every report keeps its grammar`, failing.length === 0 && reachedCount >= 5, { failing, reachedCount });
  }
  // A usage error prints no OUTCOME line, on either stream: an argument must not be able to add one.
  for (const [label, argv] of [
    ['an unexpected argument', ['verify', '--project', baseRoot, `x${LF}${FORGED}`]],
    ['an unknown option', ['verify', '--project', baseRoot, '--baseline', bp, `--bad${LF}${FORGED}`, 'v']],
    ['a duplicated option', ['verify', `--dup${LF}${FORGED}`, 'a', `--dup${LF}${FORGED}`, 'b']],
    ['an option without a value', ['verify', `--novalue${LF}${FORGED}`]],
  ]) {
    const c = captureIo(); const code = mainV(argv, c.io);
    G(`${label} with a line break in its text is a one-line usage error on stderr: exit 1, nothing on stdout, and no line of either stream starts with OUTCOME`, code === 1 && c.o.length === 0 && c.e.length === 1 && !NON_LF_CONTROL.test(c.e[0]) && !c.e[0].includes(LF) && outcomeLines(`${c.o.join('\n')}\n${c.e.join('\n')}`).length === 0, { code, out: c.o, err: c.e });
  }
  { const root = mkVerify('n14-err'); const out = path.join(liveDir('n14-err-io'), 'snap.json'); const c = captureIo();
    const code = faultFs({ write: (p) => { if (p === out) throw Object.assign(new Error(`disk full${LF}${FORGED}`), { code: 'EIO' }); } }, () => H.main(['snapshot', '--project', root, '--out', out], c.io));
    G('an unexpected error whose message holds a line break is ONE error line with the message escaped, never a line that starts with OUTCOME', code === 1 && c.e.length === 1 && /^ERROR: disk full\\x0aOUTCOME/.test(c.e[0]) && !c.e[0].includes(LF), { code, err: c.e }); }
}

// ============================================================== GROUP: read failures are not absence (N15) ====
// Enumerated read sites of runVerification and how each fails closed (a file is judged on the bytes the snapshot captured, never reread; any other file keeps the state of its read):
//   scan loop (03, CLAUDE.md, AGENTS.md, TODO.md, fullDocuments, nested), pointer detection, fullDocuments check, the pointer inspection (pointer and its 03 source), the blank-section
//   check, the manifest validation, the root AGENTS.md check and its nested pairs, the consolidation check (03, TODO.md, pointers, full documents), the CLAUDE.md check, both agent
//   wrappers, and every extension: all go through need(), so an unreadable, refused or unsafe file is a reason and the result is not evaluable. The activation signals (stamp, CLAUDE.md,
//   AGENTS.md, 03) are judged by the same states; the baseline text an extension is compared with is checked as well.
{
  const G = grp('Read failures (N15)');
  const unreadable = (target) => (p) => { if (same(p, target)) throw eacces(); };
  const ext = 'tools/ext.project.md';
  { const root = mkVerify('n15-ext', { files: { [ext]: 'x\n' } }); const base = H.takeSnapshot(root); const at = path.join(root, 'tools', 'ext.project.md');
    const ev = (e) => EVID({ extensions: { [ext]: e } });
    // Review pass 5b (N19): an extension OUTSIDE the explicit inventory has no baseline record that could prove it did not exist, so the controls below keep it INSIDE the inventory
    // (.ai/agents/, where every real project extension lives); the outside-inventory shapes are the group "Path states (N18, N19)".
    const inExt = '.ai/agents/ext.project.md'; const inRoot = mkVerify('n15-ext-in', { files: { [inExt]: 'x\n' } }); const inBase = clone(H.takeSnapshot(inRoot)); delete inBase.files[inExt];
    const inEv = (e) => EVID({ extensions: { [inExt]: e } });
    const readable = verify(inRoot, { baseline: inBase, evidence: inEv({}) }); const approved = verify(inRoot, { baseline: inBase, evidence: inEv({ approvedAppend: 'x\n' }) });
    G('controls: a readable extension the baseline did not hold (a confirmed absence: inside the inventory, nothing skipped) is an invented extension (a finding naming the file) unless its exact text was approved (clean)', readable.outcome === 'findings' && findingAt(readable, CHK.extension, inExt) !== undefined && clean(approved), { readable: diag(readable), approved: diag(approved) });
    const fail = (e) => faultFs({ read: unreadable(at) }, () => verify(root, { baseline: base, evidence: ev(e) }));
    const a = fail({}); const b = fail({ approvedAppend: 'x\n' });
    G('the review probe: an evidence-listed extension that fails with EACCES is not evaluable naming the file, with or without an approved append (with nothing approved it was a clean outcome)', notEval(a, /tools\/ext\.project\.md could not be read/) && notEval(b, /tools\/ext\.project\.md could not be read/), { a: diag(a), b: diag(b) });
    const none = verify(root, { baseline: base, evidence: EVID({ extensions: { '.ai/agents/none.project.md': {} } }) });
    G('control: an extension that does not exist is a confirmed absence on both sides (inside the inventory) and, with nothing approved, is clean (absence is a statement; only a failed read is not)', clean(none), diag(none)); }
  for (const [label, rel] of [['the stamp', H.STAMP_REL], ['CLAUDE.md', 'CLAUDE.md'], ['the root AGENTS.md', 'AGENTS.md'], ['03', H.BS_03_REL], ['TODO.md', 'TODO.md'], ['the reviewer wrapper', '.claude/agents/reviewer.md'], ['the docs-sync wrapper', '.claude/agents/docs-sync.md']]) {
    const root = mkVerify('n15-deny', { files: { [POLICY_REL]: policyWith([{ glob: rel, kind: 'project' }]) } }); const base = H.takeSnapshot(root);
    const r = verify(root, { baseline: base });
    G(`${label} denied by the project policy while a check needs it is not evaluable and names it (it read as an absent file: a finding or a clean outcome)`, notEval(r, new RegExp(`${escRe(rel)} is a protected or policy-denied path`)), diag(r));
  }
  { const root = mkVerify('n15-allow', { files: { [POLICY_REL]: policyWith(PRIVATE_DENY) } }); const r = verify(root, { baseline: H.takeSnapshot(root) });
    G('control: a project policy that denies only a path no check needs changes nothing', clean(r), diag(r)); }
  { const root = mkVerify('n15-fd', { files: { 'notes/guide.md': '# guide\n' } }); const base = H.takeSnapshot(root); const at = path.join(root, 'notes', 'guide.md');
    const ev = EVID({ fullDocuments: ['notes/guide.md'] }); const ok = verify(root, { baseline: base, evidence: ev });
    const bad = faultFs({ read: unreadable(at) }, () => verify(root, { baseline: base, evidence: ev }));
    G('an evidence-listed full document outside the snapshot inventory that cannot be read is not evaluable and names it (control: readable, it is judged, here a finding because the snapshot does not hold it)', ok.outcome === 'findings' && notEval(bad, /notes\/guide\.md could not be read/), { ok: diag(ok), bad: diag(bad) }); }
  { const root = mkVerify('n15-nest', { files: { 'pkg/a/AGENTS.md': '# a\n', 'pkg/a/CLAUDE.md': '@AGENTS.md\n' } }); const base = H.takeSnapshot(root); const at = path.join(root, 'pkg', 'a', 'CLAUDE.md');
    const ev = EVID({ nested: [{ dir: 'pkg/a' }] }); const ok = verify(root, { baseline: base, evidence: ev });
    const bad = faultFs({ read: unreadable(at) }, () => verify(root, { baseline: base, evidence: ev }));
    G('a nested CLAUDE.md that cannot be read is not evaluable and names it (it read as a missing pair member, a finding); control: the readable pair is clean', clean(ok) && notEval(bad, /pkg\/a\/CLAUDE\.md could not be read/), { ok: diag(ok), bad: diag(bad) }); }
  { const root = mkVerify('n15-man'); const base = H.takeSnapshot(root);
    putF(root, H.MANIFEST_REL, `${JSON.stringify({ files: Object.fromEntries(VERIFY_POINTERS.map((p) => [p, { ownership: 'merged' }])) })}\n`);
    const at = path.join(root, '.ai', 'manifest.json'); let reads = 0;
    const r = faultFs({ read: (p) => { if (same(p, at) && (reads += 1) > 1) throw eacces(); } }, () => verify(root, { baseline: base }));
    const issues = findingDetail(r, /production manifest check/) ?? [];
    G('the review probe: a files-only manifest whose revalidation read would fail with EACCES is never validated-by-skipping: the verification is not clean and either states the production issue or is not evaluable (the validation was skipped and the outcome was clean)', r.outcome !== 'no-automated-findings' && (r.outcome === 'not-evaluable' || issues.includes('schema must be 2 or 3')), { r: diag(r), issues, reads }); }
  { const root = mkVerify('n15-once'); const base = H.takeSnapshot(root);
    const spy = spyFs({}, () => verify(root, { baseline: base }));
    const counts = {}; for (const p of spy.seen.read) if (same(p.slice(0, root.length), root) && !p.endsWith('security-paths.json')) counts[p] = (counts[p] ?? 0) + 1;
    G('a verification judges the bytes its snapshot captured: no file of the project is read twice (a reread can fail, or differ, and a failed reread must not read as nothing)', clean(spy.value) && Object.keys(counts).length >= 8 && Object.values(counts).every((n) => n === 1), counts); }
  { const rel = '.ai/context/x.project.md'; const root = mkVerify('n15-bt', { files: { [rel]: 'a\n' } }); const base = H.takeSnapshot(root);
    const r = verify(root, { baseline: base, evidence: EVID({ extensions: { [rel]: {} } }) });
    const keeps = '.ai/agents/y.project.md'; const root2 = mkVerify('n15-bt2', { files: { [keeps]: 'a\n' } });
    const r2 = verify(root2, { baseline: H.takeSnapshot(root2), evidence: EVID({ extensions: { [keeps]: {} } }) });
    G('an extension the baseline lists WITHOUT text (only instruction and agent files keep theirs) cannot be compared and is not evaluable (it read as "nothing was there"); control: one whose text is kept is compared and, unchanged, is clean', notEval(r, /baseline keeps no text for \.ai\/context\/x\.project\.md/) && clean(r2), { r: diag(r), r2: diag(r2) }); }
  { const root = mkVerify('n15-sig'); const cand = path.join(root, 'docs', 'database.md');
    const ok = attempt(() => H.collectSignals(root));
    const bad = faultFs({ read: unreadable(cand) }, () => attempt(() => H.collectSignals(root)));
    G('collectSignals: a listed pointer file that cannot be read throws (it was skipped, which could turn "preserve" into "ordinary"); control: readable, it does not', ok.threw === undefined && /docs\/database\.md could not be read \(unreadable\)/.test(bad.threw ?? ''), { ok, bad });
    const denied = mkVerify('n15-sigd', { files: { [POLICY_REL]: policyWith([{ glob: 'docs/database.md', kind: 'project' }]) } });
    G('control: a pointer file the project policy denies is a deliberate skip of collectSignals, not a failure', attempt(() => H.collectSignals(denied)).threw === undefined); }
}

// ============================================================== GROUP: inventory walk (N16) ====
{
  const G = grp('Inventory walk (N16)');
  const root = mkVerify('n16'); const base = H.takeSnapshot(root);
  const atRel = (rel) => path.join(root, ...rel.split('/'));
  const failLstat = (rel, code, fn) => faultFs({ lstat: (p) => { if (same(p, atRel(rel))) throw errCode(code); } }, fn);
  for (const dir of ['src', '.codex/agents']) for (const code of ['EACCES', 'EPERM', 'EIO', 'ELOOP']) {
    const r = failLstat(dir, code, () => verify(root, { baseline: base }));
    G(`${code} while inspecting ${dir} (a directory the fixture does not have) is not evaluable and names the error (it was skipped as absence: an incomplete inventory read as a clean outcome)`, notEval(r, new RegExp(code)), diag(r));
  }
  { const r = failLstat('docs', 'EACCES', () => verify(root, { baseline: base }));
    G('EACCES while inspecting docs, where the pointers are, is not evaluable (the inventory was returned without them)', notEval(r, /EACCES/), diag(r)); }
  for (const dir of ['src', '.codex/agents']) for (const code of ['ENOENT', 'ENOTDIR']) {
    const r = failLstat(dir, code, () => verify(root, { baseline: base }));
    G(`control: ${code} while inspecting ${dir} is a confirmed absence and is skipped`, clean(r), diag(r));
  }
  { const t = attempt(() => failLstat('docs', 'EACCES', () => H.takeSnapshot(root)));
    G('takeSnapshot itself throws that error: a snapshot is never a partial inventory', /EACCES/.test(t.threw ?? ''), t); }
  { const t = attempt(() => faultFs({ readdir: (p) => { if (same(p, atRel('.claude/agents'))) throw errCode('EACCES'); } }, () => H.takeSnapshot(root)));
    G('a directory that cannot be listed also propagates (the listing error was never swallowed, and must stay that way)', /EACCES/.test(t.threw ?? ''), t); }
  { const out = path.join(liveDir('n16-io'), 'snap.json'); const c = captureIo();
    const code = failLstat('src', 'EACCES', () => H.main(['snapshot', '--project', root, '--out', out], c.io));
    G('the snapshot command fails (exit 1, an ERROR line naming the error, no snapshot file) when a directory cannot be inspected', code === 1 && c.e.some((l) => /^ERROR: .*EACCES/.test(l)) && !fs.existsSync(out), { code, err: c.e });
    const ok = path.join(liveDir('n16-io2'), 'snap.json'); const c2 = captureIo(); const code2 = H.main(['snapshot', '--project', root, '--out', ok], c2.io);
    G('control: the same command without the fault exits 0 and writes the snapshot', code2 === 0 && fs.existsSync(ok), { code2, err: c2.e }); }
  { const sigRoot = mkVerify('n16-sig');
    const listing = (code) => faultFs({ readdir: (p) => { if (same(p, path.join(sigRoot, 'docs'))) throw errCode(code); } }, () => attempt(() => H.collectSignals(sigRoot)));
    for (const code of ['EACCES', 'EPERM', 'EIO']) G(`collectSignals: ${code} while listing docs throws (the listing was read as "no pointers")`, new RegExp(code).test(listing(code).threw ?? ''), listing(code));
    for (const code of ['ENOENT', 'ENOTDIR']) G(`control: collectSignals: ${code} while listing docs is a confirmed absence (no pointers, no error)`, listing(code).threw === undefined, listing(code)); }
}

// ============================================================== GROUP: constant check names (N17) ====
{
  const G = grp('Check names (N17)');
  // A file name is data. These are verdict words as names of pointers, a full document and extensions: a check about them must keep its constant name and show the path on a detail line.
  const VERDICT = ['docs/complete.md', '.ai/context/compatible.md', 'docs/integrations/passed.md'];
  const FULLDOC = 'docs/complete-guide.md'; const MISSING = 'docs/passed-missing.md';
  const EXT_OK = '.ai/agents/passed.project.md'; const EXT_BAD = '.ai/agents/complete.project.md';
  const pointerFiles = Object.fromEntries(VERDICT.map((r) => [r, pointerOf(r, H.isVendorPointerPath(r) ? {} : { bullets: ['Database'] })]));
  const root = mkVerify('n17', { files: { ...pointerFiles, [FULLDOC]: '# Guide\n\nfull facts\n', [EXT_OK]: 'x\n', [EXT_BAD]: 'x\n', [H.MANIFEST_REL]: manifestJson(Object.fromEntries([...VERIFY_POINTERS, ...VERDICT].map((r) => [r, { ownership: 'merged' }]))) } });
  const base = H.takeSnapshot(root);
  const good = verify(root, { baseline: base, evidence: EVID({ pointers: [...VERIFY_POINTERS, ...VERDICT], fullDocuments: [FULLDOC], extensions: { [EXT_OK]: {} } }) });
  const bad = verify(root, { baseline: base, evidence: EVID({ pointers: [...VERIFY_POINTERS, ...VERDICT, 'docs/passed-gone.md'], fullDocuments: [FULLDOC, MISSING], extensions: { [EXT_OK]: {}, [EXT_BAD]: { approvedAppend: 'zzz\n' } } }) });
  const names = (r) => [...r.findings.map((x) => x.name), ...r.checked.map((x) => x.name)];
  const pathsOnDetail = (text, rels) => rels.every((p) => new RegExp(`^ {8}- .*${escRe(p)}`, 'm').test(text));
  const everyPath = [...VERDICT, FULLDOC, EXT_OK];
  G('control: the fixture with verdict-named pointers, a full document and an extension is clean, and its checks about those files are listed', clean(good) && everyPath.every((p) => good.checked.some((x) => x.detail === p)), { ...diag(good), details: good.findings.map((x) => x.detail) });
  G('a check about one file keeps a CONSTANT name and carries the path in its detail: no check name of a clean run holds an evidence path or a verdict word', names(good).every((n) => !everyPath.some((p) => n.includes(p)) && !FORBIDDEN.test(n)), names(good));
  G('the same for the findings: a missing pointer, a missing full document and an unapproved extension change keep constant names and name the path in the detail', bad.outcome === 'findings' && [['docs/passed-gone.md', CHK.listedPointer], [MISSING, CHK.listedFullDoc], [EXT_BAD, CHK.extension]].every(([p, n]) => findingAt(bad, n, p) !== undefined) && names(bad).every((n) => !FORBIDDEN.test(n) && ![...everyPath, MISSING, EXT_BAD, 'docs/passed-gone.md'].some((p) => n.includes(p))), { findings: bad.findings.map((x) => [x.name, x.detail]) });
  G('no line the helper writes itself carries a verdict word when a file is named complete, passed or compatible: the path is on an indented detail line (a clean run and a run with findings)', [good, bad].every((r) => { const text = H.formatVerify(r, false); return reportGrammarProblems(text, r).length === 0 && own(text).every((l) => !FORBIDDEN.test(l)); }) && pathsOnDetail(H.formatVerify(good, false), everyPath) && pathsOnDetail(H.formatVerify(bad, false), [MISSING, EXT_BAD, 'docs/passed-gone.md']), 'see the report');
}

// ============================================================== GROUPS: path states, the general rule (review pass 5b, N18 and N19) ====
// Five passes each found one more sibling of "evidence unavailable -> clean outcome". The rule that removes the class (helper, section "path states"): every path a check consults has an
// explicit state on each side the check uses (present | absent | unavailable); only a CONFIRMED absence is absence; an unavailable state on any consulted path makes the verification not
// evaluable, with a reason naming the path, the side (baseline | current) and the state; no state is ever resolved by reading the path.
// The consult points of runVerification and the state function each goes through (the rows below drive every one on every side it has):
//   CURRENT side, need(): the snapshot's captured bytes, else the permitted read (ok | absent | denied | unsafe | unreadable | policy). A failure of the inventory walk (an unreadable or unlistable
//     inventory path, a link) is a failed snapshot that names the path.
//       the manifest (BOTH layouts, N18) | the stamp, CLAUDE.md, AGENTS.md and 03 (the activation signals) | every file of the pointer directories (activation signals and pointer detection)
//       TODO.md | both agent wrappers | every listed pointer | every listed full document | every nested pair member | every extension | the blank-section, consolidation and root checks (their reads)
//   BASELINE side, snapshotPathState(baseline, rel) through baseRec / baseState: present (a record), absent (inside the covered inventory, nothing skipped covers it), unavailable (skipped, below a
//     skipped directory, outside the inventory, no usable skipped list)
//       03 (changed or not) | every extension (the bytes it held) | the baseline manifest summary (baselineManifestProblem: absent | valid | unavailable)
//   BOTH sides, baseState + snapState: every path with a record on either side in the collateral comparison, and every path listed in evidence.explained.
{
  const G = grp('Path states (N18, N19)');
  const FD = '.ai/context/code-patterns.md';
  const NOTES = 'docs/notes.md';
  const EXT = '.ai/agents/reviewer.project.md';
  const OUT_EXT = 'tools/ext.project.md';
  const FIX = { [NOTES]: '# notes\n', [FD]: '# Code patterns\n\nfacts\n', 'src/wallet/AGENTS.md': '# wallet\n', 'src/wallet/CLAUDE.md': '@AGENTS.md\n', [EXT]: 'ext\n', '.ai/context/zz-extra.md': '# extra\n', 'docs/zz-extra.md': '# extra\n', 'docs/integrations/zz-extra.md': '# extra\n' };
  const ORD = { 'AGENTS.md': renderAgents(false), 'CLAUDE.md': `${PS_CLAUDE_TEMPLATE}\n${USER_LINE}\n`, [H.BS_03_REL]: null, [H.MANIFEST_REL]: null, ...Object.fromEntries(VERIFY_POINTERS.map((p) => [p, null])) };
  const ORD_EV = (o = {}) => EVID({ layout: 'ordinary', pointers: [], fullDocuments: [], claude: { bsImports: [], bsVersionSentence: null, userLines: [USER_LINE] }, ...o });
  const FILES_ONLY = `${JSON.stringify({ files: Object.fromEntries(VERIFY_POINTERS.map((p) => [p, { ownership: 'merged' }])) })}\n`;
  const at = (root, rel) => path.join(root, ...rel.split('/'));
  const deny = (...globs) => (root) => putF(root, POLICY_REL, policyWith(globs.map((glob) => ({ glob, kind: 'project' }))));
  // One verification of a fresh fixture. The baseline is taken BEFORE the project is changed; o.project changes the project (the current side), o.baseline changes a clone of the baseline
  // (the baseline side), o.fault(root) returns the fs hooks of faultFs for the verification only. o.ordinary selects the ordinary layout.
  const run = (o = {}) => {
    const root = mkVerify('ps', { files: { ...FIX, ...(o.ordinary ? ORD : {}), ...(o.files ?? {}) } });
    const base = clone(H.takeSnapshot(root));
    if (o.project !== undefined) o.project(root);
    if (o.baseline !== undefined) o.baseline(base, root);
    const ev = o.ordinary ? ORD_EV(o.evidence) : EVID(o.evidence);
    const go = () => verify(root, { baseline: base, evidence: ev });
    return o.fault === undefined ? go() : faultFs(o.fault(root), go);
  };
  // The reason names the path, the side and the state (cause === null: only the path and the side, for a failed snapshot, whose cause is the code of the failure).
  const names = (r, rel, side, cause) => notEval(r) && r.notEvaluable.some((x) => { const s = String(x); return s.includes(rel) && s.includes(`${side} side: unavailable`) && (cause === null || s.includes(`${side} side: unavailable, ${cause}`)); });
  let rows = 0;
  const row = (label, r, rel, side, cause) => { rows += 1; G(`${label}: not evaluable, naming ${rel}, the ${side} side and the state${cause === null ? '' : ` (${cause})`}`, names(r, rel, side, cause), diag(r)); };

  // -------------------------------------------------------------- the units: the inventory predicate and the state of a path in one snapshot
  { const IN = ['AGENTS.md', 'CLAUDE.md', 'TODO.md', '.backend-standards.json', '.toolchain-config.json', '.ai/manifest.json', '.ai/security-paths.json', '.claude/settings.json', 'docs/a.md', 'docs/integrations/x.md', 'docs/deep/er/x.JSON', '.ai/agents/a.project.md', '.ai/context/x.toml', '.ai/decisions/README.md', '.ai/standards/03-project-architecture.md', '.ai/tools/x.mjs', '.claude/agents/reviewer.md', '.codex/agents/x.toml', 'src/AGENTS.md', 'src/a/b/CLAUDE.md'];
    const NOT_IN = ['README.md', 'package.json', '.gitignore', OUT_EXT, 'docs/a.txt', 'docs/node_modules/x.md', 'docs/.git/x.md', 'src/a.ts', 'src/a/README.md', 'src/node_modules/AGENTS.md', '.ai/other/x.md', '.ai/manifest.json.bak', 'docs', '../docs/a.md', 'docs\\a.md', '/docs/a.md', '', 'constructor', '__proto__'];
    G('inInventory: every explicit file, every accepted file below a walked directory (any depth, any case of the extension) and AGENTS.md or CLAUDE.md below src is covered', IN.every((p) => H.inInventory(p)), IN.filter((p) => !H.inInventory(p)));
    G('inInventory: everything else is outside (another extension, below node_modules or .git, an unwalked directory, a non-normalized, absolute or empty path, a prototype key, a non-string)', NOT_IN.every((p) => !H.inInventory(p)) && !H.inInventory(7) && !H.inInventory(null) && !H.inInventory(undefined), NOT_IN.filter((p) => H.inInventory(p)));
    // The predicate and the walk are one definition: over a project holding every one of those files, a file is in the inventory exactly when the snapshot recorded it or skipped it.
    const everything = Object.fromEntries([...IN.filter((p) => p !== '.ai/security-paths.json'), ...NOT_IN.filter((p) => p !== 'docs' && p !== '' && !p.includes('..') && !p.includes('\\') && !p.startsWith('/') && p !== 'constructor' && p !== '__proto__'), 'docs/.env.md', 'docs/secrets/x.md', 'docs/integrations/.env'].map((p) => [p, '{}\n']));
    const dproj = liveProj('ps-drift', everything); const dsnap = H.takeSnapshot(dproj);
    const covers = (e, p) => p === e.path || p.startsWith(`${e.path}/`);
    // Both directions. Sound: a covered file that exists was recorded or skipped (never silently dropped, which would read as an absence). Complete: every recorded file is covered. A file the policy
    // skips by NAME (.env*) is skipped before the extension filter, so a skipped file may lie outside the predicate; the skipped list answers for it first (snapshotPathState).
    const unsound = Object.keys(everything).filter((p) => H.inInventory(p) && dsnap.files[p] === undefined && !dsnap.skipped.some((e) => covers(e, p)));
    const incomplete = Object.keys(dsnap.files).filter((p) => !H.inInventory(p));
    G('inInventory agrees with the walk captureProject performs: over a project holding covered, uncovered, policy-denied and prototype-named files, every covered file was recorded or skipped and every recorded file is covered', unsound.length === 0 && incomplete.length === 0 && Object.keys(dsnap.files).length >= 18 && dsnap.skipped.length >= 3 && Object.keys(everything).filter((p) => !H.inInventory(p) && dsnap.files[p] === undefined).length >= 8, { unsound, incomplete, files: Object.keys(dsnap.files).length, skipped: dsnap.skipped }); }
  { const S = { files: { 'docs/a.md': {}, 'AGENTS.md': {} }, skipped: [{ path: 'docs/private', reason: 'policy-denied' }, { path: 'docs/s.md', reason: 'policy-denied' }, { path: 'AGENTS.md', reason: 'secret-shaped text not stored' }, { path: 'docs/m.md', reason: 'mystery' }] };
    // A throw is a failed case of its own (state 'threw'), never a crash of the whole spec: a malformed skipped entry must be an unavailable state, not an exception.
    const st = (snap, rel) => { try { return H.snapshotPathState(snap, rel); } catch (e) { return { state: 'threw', cause: String(e) }; } };
    G('snapshotPathState: a record is present, also when the skipped list holds the reason that only withholds its text', st(S, 'docs/a.md').state === 'present' && st(S, 'AGENTS.md').state === 'present');
    G('snapshotPathState: no record inside the inventory with nothing skipped over it is a CONFIRMED absence', st(S, 'docs/b.md').state === 'absent' && st(S, '.ai/agents/x.project.md').state === 'absent' && st(S, 'TODO.md').state === 'absent');
    G('snapshotPathState: a path the snapshot skipped, one below a skipped directory and one skipped for any other reason is unavailable (skipped)', ['docs/s.md', 'docs/private/x.md', 'docs/private', 'docs/m.md'].every((p) => st(S, p).state === 'unavailable' && st(S, p).cause === 'skipped'), ['docs/s.md', 'docs/private/x.md', 'docs/private', 'docs/m.md'].map((p) => st(S, p)));
    G('snapshotPathState: a path outside the inventory, a prototype key and a sibling that merely starts with a skipped name are unavailable or absent exactly as the inventory says', st(S, 'README.md').cause === 'outside-inventory' && st(S, 'docs/x.txt').cause === 'outside-inventory' && st(S, 'constructor').cause === 'outside-inventory' && st(S, '__proto__').cause === 'outside-inventory' && st(S, 'docs/private-notes.md').state === 'absent' && st(S, 'docs/s.md.bak').cause === 'outside-inventory');
    for (const [label, skipped] of [['missing', undefined], ['not a list', {}], ['null', null], ['an entry without a path', [{ reason: 'policy-denied' }]], ['an entry without a reason', [{ path: 'x' }]], ['an entry that is text', ['docs/x']], ['an entry with a non-text path', [{ path: 1, reason: 'r' }]]]) {
      const s = { files: S.files, ...(skipped === undefined ? {} : { skipped }) };
      G(`snapshotPathState: a skipped list that is ${label} cannot prove coverage, so a path without a record is unavailable (unprovable), while a record stays present`, st(s, 'docs/b.md').state === 'unavailable' && st(s, 'docs/b.md').cause === 'unprovable' && st(s, 'docs/a.md').state === 'present');
    }
    G('snapshotPathState: a snapshot that records no files at all proves nothing', [null, undefined, {}, { files: null }, 'x'].every((s) => st(s, 'docs/a.md').state === 'unavailable'));
    // A case-insensitive file system (win32) answers for one file under any spelling, so a record or a skipped entry under another case is the same file, never an absence.
    if (process.platform === 'win32') {
      const W = { files: { 'docs/Notes.md': {} }, skipped: [{ path: 'docs/Private', reason: 'policy-denied' }] };
      G('snapshotPathState (win32): a record under another case is unavailable (alias), not absent; the exact spelling is present', st(W, 'docs/notes.md').state === 'unavailable' && st(W, 'docs/notes.md').cause === 'alias' && st(W, 'DOCS/NOTES.MD').cause === 'alias' && st(W, 'docs/Notes.md').state === 'present', [st(W, 'docs/notes.md'), st(W, 'docs/Notes.md')]);
      G('snapshotPathState (win32): a skipped directory covers what is below it whatever the case of the spelling', st(W, 'docs/private/x.md').cause === 'skipped' && st(W, 'DOCS/PRIVATE').cause === 'skipped', [st(W, 'docs/private/x.md'), st(W, 'DOCS/PRIVATE')]);
    } else skip('snapshotPathState: a record or a skipped entry under another case is the same file', 'the file system of this host is case-sensitive (fold is the identity)');
    G('baselineManifestProblem: an absent summary and a valid one with an ownership map are usable; skipped, malformed, a valid one without ownership, a missing one and a non-object are unavailable and name the path, the side and the state', H.baselineManifestProblem({ state: 'absent' }) === null && H.baselineManifestProblem({ state: 'valid', ownership: {} }) === null
      && [[{ state: 'skipped' }, 'skipped'], [{ state: 'malformed' }, 'malformed'], [{ state: 'valid' }, 'unprovable'], [{ state: 'valid', ownership: [] }, 'unprovable'], [{ state: 'other' }, 'unprovable'], [undefined, 'unprovable'], [null, 'unprovable'], ['x', 'unprovable'], [[], 'unprovable']].every(([m, cause]) => { const p = H.baselineManifestProblem(m); return typeof p === 'string' && p.includes(H.MANIFEST_REL) && p.includes(`baseline side: unavailable, ${cause}`); })); }
  // The structure that keeps the rule general: past the accessors, runVerification never indexes a snapshot or its manifest itself, never reads a file except through need(), and takes the
  // activation signals through need() as well, so no future check can consult a path without its state being asked.
  { const src = rd(path.join(TESTS, 'live', 'bs-doc-map.mjs')); const from = src.indexOf('function runVerification('); const end = src.indexOf('==== END path-state accessors ====', from); const body = src.slice(end, src.indexOf('\n}\n', end));
    G('source pin: after the path-state accessors, runVerification never touches baseline.files, snap.files, baseline.manifest, snap.manifest or a skipped list, never calls readPermitted or the raw read, and has no fileRec', from > 0 && end > from && body.length > 2000 && !/\b(?:baseline|snap)\.(?:files|manifest|skipped)\b/.test(body) && !/\b(?:readPermitted|rawRead|fileRec)\b/.test(body), { from, end, hits: body.match(/\b(?:baseline|snap)\.(?:files|manifest|skipped)\b|\b(?:readPermitted|rawRead|fileRec)\b/g) });
    G('source pin: the activation signals are read through need() (a pointer-directory file the policy denies is then a recorded state, not a deliberate skip), and the accessors ask snapshotPathState', /collectSignals\(root, \{ readFile: need \}\)/.test(body) && /snapshotPathState\(/.test(src.slice(from, end)) && /need\(MANIFEST_REL\)/.test(body)); }

  // -------------------------------------------------------------- controls: confirmed absence and plain presence still behave as before
  const base0 = run();
  G('control: the fixture every row below starts from (a mapped layout with a full document, a nested pair, an extension and pointer-directory files) has no finding and nothing unavailable', clean(base0), diag(base0));
  { const r = run({ evidence: { fullDocuments: [FD], nested: [{ dir: 'src/wallet' }], extensions: { [EXT]: {} } } });
    G('control: a full document, a nested pair and an extension that exist on both sides, with every state present, are evaluated and clean', clean(r) && r.checked.some((x) => x.detail === FD) && r.checked.some((x) => x.detail === EXT), diag(r)); }
  { const r = run({ baseline: (b) => { delete b.files['.ai/context/glossary.md']; } });
    G('control: a pointer created by the run (the baseline confirms it did not exist: inside the inventory, nothing skipped) is judged on the current side only and is clean', clean(r) && r.checked.some((x) => x.detail === '.ai/context/glossary.md'), diag(r)); }
  { const r = run({ baseline: (b) => { delete b.files['.ai/context/glossary.md']; delete b.skipped; } });
    G('control: the baseline is consulted only where a check decides on it, so a created pointer is still clean when the baseline has no usable skipped list (nothing compares the baseline with a pointer)', clean(r), diag(r)); }
  { const r = run({ files: { [H.BS_03_REL]: FILLED03, [H.MANIFEST_REL]: manifestJson(Object.fromEntries([...VERIFY_POINTERS.map((p) => [p, { ownership: 'merged' }]), [H.BS_03_REL, { ownership: 'merged' }]])) }, baseline: (b) => { delete b.files[H.BS_03_REL]; } });
    const f = run({ baseline: (b) => { delete b.files[H.BS_03_REL]; } });
    G('control: a 03 the baseline confirms did not exist counts as changed (a new source): its ownership must be merged, clean when it is, a finding when it is not', clean(r) && f.outcome === 'findings' && findingNames(f).some((n) => /^03 changed/.test(n)), { r: diag(r), f: diag(f) }); }
  { const r = run({ evidence: { extensions: { '.ai/agents/none.project.md': {} } } });
    G('control: an extension absent on both sides (inside the inventory) is a confirmed absence and, with nothing approved, is clean', clean(r), diag(r)); }
  { const r = run({ evidence: { explained: [NOTES, 'docs/never-existed.md'] } });
    G('control: an explained path that is present and unchanged on both sides, and one that is absent on both sides inside the inventory, are both seen on both sides and change nothing', clean(r), diag(r)); }
  { const r = run({ files: { 'TODO.md': null } });
    G('control: TODO.md absent on both sides is a confirmed absence (an empty TODO) and is clean', clean(r), diag(r)); }
  { const r = run({ ordinary: true });
    G('control: no manifest on either side in an ordinary layout is a confirmed absence on both sides: nothing to validate, clean', clean(r), diag(r)); }
  { const r = run({ project: (root) => fs.rmSync(at(root, NOTES)) }); const c = run({ project: (root) => putF(root, 'docs/created.md', '# created\n') });
    G('control: a file deleted by the run (a baseline record, the current walk confirms the absence) and one created by it (the baseline confirms it did not exist) are collateral findings, as before', r.outcome === 'findings' && findingNames(r).some((n) => /no unexplained collateral/.test(n)) && c.outcome === 'findings' && findingNames(c).some((n) => /no unexplained collateral/.test(n)), { r: diag(r), c: diag(c) }); }
  { const r = run({ files: { [POLICY_REL]: policyWith([{ glob: 'docs/private/*', kind: 'project' }]), 'docs/private/x.md': 'private\n' } });
    G('control: a path the policy skipped on BOTH sides that no check consults is outside the permitted inventory (the comparison is scoped to it) and changes nothing', clean(r), diag(r)); }
  { const f = run({ evidence: { nested: [{ dir: 'src/wallet' }] }, project: (root) => fs.rmSync(at(root, 'src/wallet/CLAUDE.md')) }); const l = run({ evidence: { fullDocuments: ['docs/absent-guide.md'] } });
    G('control: a nested pair member and a listed full document that are confirmed absent stay findings (an absence is a statement)', f.outcome === 'findings' && findingNames(f).some((n) => /^root AGENTS\.md/.test(n)) && l.outcome === 'findings' && findingAt(l, CHK.listedFullDoc, 'docs/absent-guide.md') !== undefined, { f: diag(f), l: diag(l) }); }

  // -------------------------------------------------------------- CURRENT side: every consult point x policy denial (and the skipped state of the collateral comparison)
  const CUR_DENIED = [
    ['the manifest, mapped layout', H.MANIFEST_REL, {}, 'denied'],
    ['the stamp', H.STAMP_REL, {}, 'denied'],
    ['CLAUDE.md', 'CLAUDE.md', {}, 'denied'],
    ['the root AGENTS.md', 'AGENTS.md', {}, 'denied'],
    ['03', H.BS_03_REL, {}, 'denied'],
    ['TODO.md', 'TODO.md', {}, 'denied'],
    ['the reviewer wrapper', '.claude/agents/reviewer.md', {}, 'denied'],
    ['the docs-sync wrapper', '.claude/agents/docs-sync.md', {}, 'denied'],
    ['a listed pointer', 'docs/database.md', {}, 'denied'],
    ['a file of .ai/context that no evidence lists (pointer detection, activation signals)', '.ai/context/zz-extra.md', {}, 'denied'],
    ['a file of docs that no evidence lists', 'docs/zz-extra.md', {}, 'denied'],
    ['a file of docs/integrations that no evidence lists', 'docs/integrations/zz-extra.md', {}, 'denied'],
    ['a listed full document', FD, { evidence: { fullDocuments: [FD] } }, 'denied'],
    ['a nested AGENTS.md', 'src/wallet/AGENTS.md', { evidence: { nested: [{ dir: 'src/wallet' }] } }, 'denied'],
    ['a nested CLAUDE.md', 'src/wallet/CLAUDE.md', { evidence: { nested: [{ dir: 'src/wallet' }] } }, 'denied'],
    ['an extension', EXT, { evidence: { extensions: { [EXT]: {} } } }, 'denied'],
    ['a file only the collateral comparison looks at (it has a baseline record, the current walk skipped it)', NOTES, {}, 'skipped'],
    ['a path the evidence lists as explained', NOTES, { evidence: { explained: [NOTES] } }, 'skipped'],
  ];
  for (const [label, rel, o, cause] of CUR_DENIED) row(`current side, ${label}, denied by the project policy`, run({ ...o, project: deny(rel) }), rel, 'current', cause);
  // A pointer the evidence lists that exists nowhere (no file, so it is in no directory listing and no snapshot) while the policy denies its name: a denied path is never opened, so its
  // absence is not confirmed. Only the evidence's own list reaches it, so this row is the one that pins that consult.
  row('current side, a listed pointer that does not exist and that the policy denies (no listing and no record can show it: only the evidence list reaches it)', run({ evidence: { pointers: [...VERIFY_POINTERS, 'docs/ghost.md'] }, project: deny('docs/ghost.md') }), 'docs/ghost.md', 'current', 'denied');
  { const r = run({ ordinary: true, project: (root) => { putF(root, H.MANIFEST_REL, FILES_ONLY); deny(H.MANIFEST_REL)(root); } });
    row('current side, the manifest, ORDINARY layout, absent in the baseline and present but policy-denied now (the review replay of N18: it skipped both manifest checks and returned no-automated-findings)', r, H.MANIFEST_REL, 'current', 'denied'); }
  { const r = run({ project: (root) => { putF(root, H.MANIFEST_REL, FILES_ONLY); deny(H.MANIFEST_REL)(root); } });
    row('current side, the manifest, mapped layout, absent in the baseline and present but policy-denied now', r, H.MANIFEST_REL, 'current', 'denied'); }
  { const r = run({ ordinary: true, project: deny(H.MANIFEST_REL) });
    row('current side, the manifest, ORDINARY layout, absent on both sides but denied by the policy (a denied path is never read, so its absence is not confirmed by a read either)', r, H.MANIFEST_REL, 'current', 'denied'); }

  // -------------------------------------------------------------- CURRENT side: read failures of a path outside the inventory (the permitted read), and failures of the inventory walk itself
  const OUTSIDE = [
    ['a listed full document outside the inventory', 'notes/guide.md', { files: { 'notes/guide.md': '# guide\n' }, evidence: { fullDocuments: ['notes/guide.md'] } }],
    ['a nested AGENTS.md outside src', 'pkg/a/AGENTS.md', { files: { 'pkg/a/AGENTS.md': '# a\n', 'pkg/a/CLAUDE.md': '@AGENTS.md\n' }, evidence: { nested: [{ dir: 'pkg/a' }] } }],
    ['a nested CLAUDE.md outside src', 'pkg/a/CLAUDE.md', { files: { 'pkg/a/AGENTS.md': '# a\n', 'pkg/a/CLAUDE.md': '@AGENTS.md\n' }, evidence: { nested: [{ dir: 'pkg/a' }] } }],
    ['an extension outside the inventory, with a baseline record built by hand so that only the current side is unavailable', OUT_EXT, { files: { [OUT_EXT]: 'x\n' }, evidence: { extensions: { [OUT_EXT]: {} } }, baseline: (b) => { b.files[OUT_EXT] = { sha256: 'a'.repeat(64), bytes: 2, lines: 1, text: 'x\n' }; } }],
  ];
  for (const [label, rel, o] of OUTSIDE) {
    row(`current side, ${label}, a read that fails with EACCES`, run({ ...o, fault: (root) => ({ read: (p) => { if (same(p, at(root, rel))) throw eacces(); } }) }), rel, 'current', 'unreadable');
    row(`current side, ${label}, a path that cannot be inspected (lstat fails with EACCES: not a confirmed absence, treated as unsafe)`, run({ ...o, fault: (root) => ({ lstat: (p) => { if (same(p, at(root, rel))) throw eacces(); } }) }), rel, 'current', 'unsafe');
  }
  for (const rel of ['docs/database.md', 'AGENTS.md', EXT, 'docs/zz-extra.md', H.MANIFEST_REL]) row(`current side, ${rel} (inside the inventory), a read that fails with EACCES while the snapshot is taken`, run({ fault: (root) => ({ read: (p) => { if (same(p, at(root, rel))) throw eacces(); } }) }), rel, 'current', null);
  row('current side, docs (a walked directory), a listing that fails with EACCES', run({ fault: (root) => ({ readdir: (p) => { if (same(p, at(root, 'docs'))) throw errCode('EACCES'); } }) }), 'docs', 'current', null);
  { const r = attempt(() => run({ project: (root) => { fs.rmSync(at(root, 'docs/integrations'), { recursive: true }); const target = liveDir('ps-lnk-target'); if (!liveJunction(target, at(root, 'docs/integrations'))) throw new Error('no junction'); } }));
    if (r.threw !== undefined) skip('current side, docs/integrations is a junction: not evaluable naming the path', 'a junction cannot be created on this host');
    else row('current side, docs/integrations is a junction (unsafe)', r, 'docs/integrations', 'current', null); }

  // -------------------------------------------------------------- BASELINE side: every consult point x every unavailable state
  const dirOf = (p) => path.posix.dirname(p);
  const VARIANTS = [
    ['skipped by the policy', 'skipped', (p) => (b) => { delete b.files[p]; b.skipped.push({ path: p, reason: 'policy-denied' }); }],
    ['skipped for an unknown reason', 'skipped', (p) => (b) => { delete b.files[p]; b.skipped.push({ path: p, reason: 'mystery' }); }],
    ['below a skipped directory', 'skipped', (p) => (b) => { delete b.files[p]; b.skipped.push({ path: dirOf(p), reason: 'policy-denied' }); }],
    ['with no skipped list to prove coverage', 'unprovable', (p) => (b) => { delete b.files[p]; delete b.skipped; }],
    ['with a skipped list that is not a list', 'unprovable', (p) => (b) => { delete b.files[p]; b.skipped = {}; }],
    ['with a skipped entry that has no path', 'unprovable', (p) => (b) => { delete b.files[p]; b.skipped = [{ reason: 'policy-denied' }]; }],
    ['with a skipped entry that has no reason', 'unprovable', (p) => (b) => { delete b.files[p]; b.skipped = [{ path: 'docs/other.md' }]; }],
  ];
  const BASE_POINTS = [
    ['an extension that exists unchanged', EXT, {}, { evidence: { extensions: { [EXT]: {} } } }],
    ['an extension the run deleted (the review replay of N19: it was policy-skipped in the baseline, so its deletion read as "it never existed")', EXT, { project: (root) => fs.rmSync(at(root, EXT)) }, { evidence: { extensions: { [EXT]: {} } } }],
    ['03, whether it changed (mapped layout)', H.BS_03_REL, {}, {}],
    ['a file only the collateral comparison looks at (it has a current record)', NOTES, {}, {}],
    ['a path the evidence lists as explained', NOTES, {}, { evidence: { explained: [NOTES] } }],
  ];
  for (const [plabel, rel, p, o] of BASE_POINTS) for (const [vlabel, cause, make] of VARIANTS) {
    const r = run({ ...o, project: p.project, baseline: make(rel) });
    row(`baseline side, ${plabel}, the baseline has no record and the path is ${vlabel}`, r, rel, 'baseline', cause);
  }
  for (const [plabel, rel, files, o] of [
    ['an extension outside the inventory that exists (no baseline can hold a record of it)', OUT_EXT, { [OUT_EXT]: 'x\n' }, { evidence: { extensions: { [OUT_EXT]: {} } } }],
    ['an extension outside the inventory that does not exist (the replay of the outside-inventory deletion of N19)', OUT_EXT, {}, { evidence: { extensions: { [OUT_EXT]: {} } } }],
    ['an extension outside the inventory, even with an approved append', OUT_EXT, { [OUT_EXT]: 'x\n' }, { evidence: { extensions: { [OUT_EXT]: { approvedAppend: 'x\n' } } } }],
    ['a path outside the inventory that the evidence lists as explained', 'README.md', { 'README.md': '# readme\n' }, { evidence: { explained: ['README.md'] } }],
    ['a path the evidence lists as explained that was never anywhere', 'docs/never.txt', {}, { evidence: { explained: ['docs/never.txt'] } }],
  ]) row(`baseline side, ${plabel}`, run({ files, ...o }), rel, 'baseline', 'outside-inventory');
  // The baseline manifest summary, in both layouts (N18, baseline side).
  for (const ordinary of [false, true]) for (const [label, m, cause] of [['skipped', { state: 'skipped' }, 'skipped'], ['malformed', { state: 'malformed' }, 'malformed'], ['valid without an ownership map', { state: 'valid' }, 'unprovable'], ['missing', undefined, 'unprovable'], ['of an unknown state', { state: 'other' }, 'unprovable']]) {
    row(`baseline side, the manifest summary is ${label}, ${ordinary ? 'ORDINARY' : 'mapped'} layout`, run({ ordinary, baseline: (b) => { if (m === undefined) delete b.manifest; else b.manifest = m; } }), H.MANIFEST_REL, 'baseline', cause);
  }
  // The same states through a REAL snapshot, not a hand-edited one: a baseline taken under a policy that denied the path.
  { const files = { [POLICY_REL]: policyWith([{ glob: EXT, kind: 'project' }]) };
    const r = run({ files, evidence: { explained: [POLICY_REL], extensions: { [EXT]: {} } }, project: (root) => { putF(root, POLICY_REL, policyWith([])); fs.rmSync(at(root, EXT)); } });
    G('the review replay of N19, with a real baseline: an existing canonical .ai/agents/reviewer.project.md was policy-skipped in the baseline; after an explained policy change and the deletion of that extension verify returned no-automated-findings', names(r, EXT, 'baseline', 'skipped') && !clean(r), diag(r));
    const kept = run({ files, evidence: { explained: [POLICY_REL], extensions: { [EXT]: {} } }, project: (root) => putF(root, POLICY_REL, policyWith([])) });
    G('the same replay when the extension is kept (the policy no longer denies it): the baseline never held its bytes, so it is not "invented" (a finding) but not evaluable', names(kept, EXT, 'baseline', 'skipped'), diag(kept));
    const still = run({ files, evidence: { extensions: { [EXT]: {} } } });
    G('and with the policy unchanged (skipped on both sides) the extension is still not evaluable, naming the current side (denied) and the baseline side (skipped), never a clean outcome', names(still, EXT, 'current', 'denied') && names(still, EXT, 'baseline', 'skipped') && !clean(still), diag(still)); }
  { const r = run({ files: { [OUT_EXT]: 'x\n' }, evidence: { extensions: { [OUT_EXT]: {} } } }); const gone = run({ evidence: { extensions: { [OUT_EXT]: {} } } });
    G('the review replay of N19, outside the inventory: an extension outside the inventory with no baseline record is not evaluable whether it exists (it read as "did not exist": an invented extension) or was deleted (it read as clean)', names(r, OUT_EXT, 'baseline', 'outside-inventory') && names(gone, OUT_EXT, 'baseline', 'outside-inventory') && !clean(r) && !clean(gone), { r: diag(r), gone: diag(gone) }); }
  if (process.platform === 'win32') {
    const alias = EXT.replace('reviewer', 'Reviewer');
    const r = run({ evidence: { extensions: { [alias]: { approvedAppend: 'ext\n' } } } });
    G('a baseline record under another case of an extension spelling (the same file on a case-insensitive file system) is not "did not exist": not evaluable, naming the baseline side and the alias (it let an approved append read as a brand-new extension)', names(r, alias, 'baseline', 'alias') && !clean(r), diag(r));
  } else skip('an extension spelled in another case than its baseline record is not "did not exist"', 'the file system of this host is case-sensitive (fold is the identity)');
  { const r = run({ ordinary: true, files: { [POLICY_REL]: policyWith([{ glob: H.MANIFEST_REL, kind: 'project' }]) }, project: (root) => putF(root, H.MANIFEST_REL, FILES_ONLY) });
    G('the review replay of N18 through the real mechanics: absent baseline manifest, a newly present files-only manifest the project policy denies, an ordinary layout: not evaluable naming the manifest, never no-automated-findings', names(r, H.MANIFEST_REL, 'current', 'denied') && !clean(r), diag(r));
    const b = run({ ordinary: true, files: { [H.MANIFEST_REL]: manifestJson({}), [POLICY_REL]: policyWith([{ glob: H.MANIFEST_REL, kind: 'project' }]) } });
    G('N18, baseline side, with a real baseline: a manifest the baseline policy skipped leaves a skipped summary, which is not evaluable in an ordinary layout', names(b, H.MANIFEST_REL, 'baseline', 'skipped') && !clean(b), diag(b)); }
  G(`the table drives every consult point on every side it has (${rows} rows of not-evaluable, each naming path, side and state)`, rows >= 85, rows);
}

// ============================================================== GROUP: advisory contract (amendment 1) ====
// (a) No input, evidence or project state of this whole spec makes verify print or return passed, complete or compatible; (b) every outcome maps to its exit code; (c) the earlier probes.
{
  const G = grp('Advisory contract');
  // The sweep adds states the other groups do not: every conversion state, both expectations, both layouts and a kept agent, plus evidence that carries the forbidden words itself.
  { const root = mkVerify('adv-sweep'); const base = H.takeSnapshot(root);
    const keep = { disposition: 'keep', retainedBytes: BS_AGENT['docs-sync'], incomplete: true, invokedDefinition: '.claude/agents/docs-sync.md' };
    for (const conversion of ['complete', 'partial', 'held', 'pending']) for (const expectPartial of [false, true]) for (const layout of ['bs-mapped', 'ordinary']) for (const kept of [false, true]) V({ project: root, baseline: base, evidence: EVID({ conversion, layout, agents: { reviewer: { disposition: 'take-new' }, 'docs-sync': kept ? keep : { disposition: 'take-new' } } }), expectPartial });
    V({ project: root, baseline: base, evidence: EVID({ passed: true, complete: true, compatible: true, status: 'passed' }) });
    V({ project: root, baseline: base, evidence: EVID({ claude: { ...EVID().claude, passed: 'complete', compatible: true } }) }); }
  { const root = mkVerify('adv-cli'); const base = H.takeSnapshot(root);
    const run = (ev, extra = []) => { const dir = liveDir('adv-cli-io'); const bp = writeIn(dir, 'b.json', base); const ep = writeIn(dir, 'e.json', ev); const c = captureIo(); const code = mainV(['verify', '--project', root, '--baseline', bp, '--evidence', ep, ...extra], c.io); return { code, out: c.o.join('\n') }; };
    const a = run(EVID()); const b = run(EVID({ conversion: 'held' })); const c = run(EVID({ schema: 2 }));
    G('each outcome through the command: no findings exits 0, a finding exits 1, a missing or invalid input exits 3, and each prints its own OUTCOME line', a.code === 0 && /^OUTCOME no-automated-findings/m.test(a.out) && b.code === 1 && /^OUTCOME findings/m.test(b.out) && c.code === 3 && /^OUTCOME not-evaluable/m.test(c.out), { a: a.code, b: b.code, c: c.code });
    const cap = captureIo(); const code = mainV(['verify', '--project', root], cap.io);
    G('a usage error of verify exits 1 on stderr only, with no OUTCOME line (the exit code 1 of findings is told apart by the OUTCOME line)', code === 1 && cap.o.length === 0 && cap.e.some((l) => /missing --baseline/.test(l)), { code, out: cap.o, err: cap.e }); }
  { const root = mkVerify('adv-throw'); const base = H.takeSnapshot(root);
    const spy = spyFs({ read: (p) => { if (p.endsWith('docs-generation.md')) throw eacces(); } }, () => attempt(() => V({ project: root, baseline: base, evidence: EVID() })));
    G('a read that fails inside the verification (here the drafting reference) is not evaluable and never throws or reads as "nothing found"', spy.value.threw === undefined && notEval(spy.value, /the verification could not run \(EACCES/), spy.value.threw ?? diag(spy.value)); }
  // (c) The probe matrix: every earlier probe verify can observe now yields findings or not-evaluable. R2, R4, R6 (seed targets, the release spec, porcelain parsing) are not verify inputs and keep their own groups.
  { const G2 = grp('Probe matrix');
    const withFiles = (files, evOver = {}, o = {}) => { const root = mkVerify('probe', { files }); return verify(root, { baseline: H.takeSnapshot(root), evidence: EVID(evOver), ...o }); };
    const SENT9 = 'Applied from the `backend-standards` skill, version `9.9.9`.';
    const NOSIG = `${PS_CLAUDE_TEMPLATE}\n${USER_LINE}\n`;
    const N4SHAPE = 'Note <!--\n- older: default is 3000 ms\n-->';
    const PROBES = [
      ['R1 a malformed project policy', () => { const r = mkVerify('probe-r1'); const b = H.takeSnapshot(r); putF(r, POLICY_REL, '{nope'); return verify(r, { baseline: b }); }, 'not-evaluable'],
      ['R3 a project that does not exist', () => V({ project: path.join(LIVE, 'probe-none'), baseline: H.takeSnapshot(mkVerify('probe-r3')), evidence: EVID() }), 'not-evaluable'],
      ['R3 a missing baseline', () => V({ project: mkVerify('probe-r3b'), baseline: undefined, evidence: EVID() }), 'not-evaluable'],
      ['R3 missing evidence', () => V({ project: mkVerify('probe-r3c'), baseline: H.takeSnapshot(mkVerify('probe-r3d')), evidence: undefined }), 'not-evaluable'],
      ['R3 a held conversion under the full expectation', () => withFiles({}, { conversion: 'held' }), 'findings'],
      ['R7 pointer destinations that exist only inside an HTML comment of 03', () => withFiles({ [H.BS_03_REL]: `# Title\n\n<!--\n${FILLED03.replace(/^# .*\n/, '')}\n-->\n` }), 'findings'],
      ['R8 a stamp with the invalid version 01.2.3', () => withFiles({ [H.STAMP_REL]: STAMP('01.2.3') }), 'findings'],
      ['N1 evidence.claude.text overriding the observed CLAUDE.md', () => withFiles({}, { claude: { ...EVID().claude, text: MERGED_CLAUDE } }), 'not-evaluable'],
      ['N2 an owner decision hidden in a multi-line inline comment, as the only signal', () => withFiles({ 'CLAUDE.md': NOSIG, 'AGENTS.md': `${renderAgents(true)}\nNote <!--\n${DEC}\n-->\n` }), 'findings'],
      ['N3 claude: {} on a CLAUDE.md that lost the baseline content', () => withFiles({ 'CLAUDE.md': PS_CLAUDE_TEMPLATE }, { claude: {} }), 'not-evaluable'],
      ['N4 a list item inside a comment opened mid-paragraph', () => withFiles({ [H.BS_03_REL]: insertUnder(FILLED03, 'Configuration', N4SHAPE) }), 'not-evaluable'],
      ['N5 a conflicting visible provenance sentence after an inline closing marker', () => withFiles({ 'CLAUDE.md': `${MERGED_CLAUDE}\nNote <!--\nx\n--> ${SENT9}\n` }), 'findings'],
      ['N6 a synthetic .env.review-probe as baseline and evidence', () => { const root = mkVerify('probe-n6'); const f = writeIn(liveDir('probe-n6-io'), '.env.review-probe', H.takeSnapshot(root)); return VF({ project: root, baselineFile: f, evidenceFile: f }); }, 'not-evaluable'],
      ['N7 an ancestor junction of the project', () => { const parent = liveDir('probe-n7'); const real = path.join(parent, 'real'); fs.mkdirSync(real); const proj = path.join(real, 'proj'); fs.mkdirSync(proj); for (const [rel, text] of Object.entries(verifyFiles())) putF(proj, rel, text); const b = H.takeSnapshot(proj); const link = path.join(parent, 'lnk'); if (!liveJunction(real, link)) return null; return V({ project: path.join(link, 'proj'), baseline: b, evidence: EVID() }); }, 'not-evaluable'],
      ['N8 malformed stamp JSON beside valid provenance', () => withFiles({ [H.STAMP_REL]: '{nope' }), 'findings'],
      ['N9 an untouched BS 03 template', () => withFiles({ [H.BS_03_REL]: BS03 }), 'findings'],
      ['N10 an opening fence with an invalid closing fence around every heading', () => withFiles({ [H.BS_03_REL]: `\`\`\`\`\n${FILLED03}\n\`\`\`\` x\n` }), 'not-evaluable'],
      ['N11 a BS import moved into an HTML comment', () => withFiles({ 'CLAUDE.md': MERGED_CLAUDE.replace(BS_IMPORTS[0], `<!-- ${BS_IMPORTS[0]} -->`) }), 'findings'],
      ['N12 an approved heading rename with consistent pointers', () => withFiles({ [H.BS_03_REL]: FILLED03.replace(/^## 7\. Database$/m, '## 7. Persistence'), 'docs/database.md': pointerOf('docs/database.md', { bullets: H.mappingRefsFor('docs/database.md').map((b) => b.replace(/^Database/, 'Persistence')) }) }), 'findings'],
      ['N13 a manifest holding only files', () => withFiles({ [H.MANIFEST_REL]: `${JSON.stringify({ files: Object.fromEntries(VERIFY_POINTERS.map((p) => [p, { ownership: 'merged' }])) })}\n` }), 'findings'],
    ];
    for (const [label, fn, expected] of PROBES) {
      const r = attempt(fn);
      if (r === null) { skip(`[Probe matrix] ${label}`, 'a junction cannot be created on this host'); continue; }
      G2(`${label} yields ${expected}, never a clean outcome`, r.threw === undefined && r.outcome === expected, r.threw ?? diag(r));
    }
    G2('the matrix lists every pass-4 finding (N6 to N13) and every earlier probe verify can observe (R1, R3, R7, R8, N1 to N5)', ['R1', 'R3', 'R7', 'R8', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'N12', 'N13'].every((id) => PROBES.some(([l]) => l.startsWith(`${id} `))), PROBES.map(([l]) => l.split(' ')[0])); }
  // FORBIDDEN, own, outcomeLines (every line break counted), LINE_BREAK and reportGrammarProblems are defined above, shared with the groups of review pass 5.
  const KEYS = ['checked', 'expectPartial', 'findings', 'notEvaluable', 'outcome'];
  const bad = { keys: [], outcome: [], shape: [], words: [], line: [], clean: [], say: [], footer: [], tokens: [], grammar: [] };
  const seenOutcomes = new Set();
  VERIFY_LOG.forEach(({ r, expectPartial }, i) => {
    seenOutcomes.add(r.outcome);
    if (JSON.stringify(Object.keys(r).sort()) !== JSON.stringify(KEYS)) bad.keys.push([i, Object.keys(r)]);
    if (!H.VERIFY_OUTCOMES.includes(r.outcome)) bad.outcome.push([i, r.outcome]);
    const shapeOk = r.outcome === 'not-evaluable' ? r.findings.length === 0 && r.checked.length === 0 && r.notEvaluable.length > 0 : r.outcome === 'findings' ? r.findings.length > 0 && r.notEvaluable.length === 0 : r.findings.length === 0 && r.notEvaluable.length === 0 && r.checked.length > 0;
    if (!shapeOk) bad.shape.push([i, r.outcome, r.findings.length, r.checked.length, r.notEvaluable.length]);
    const text = H.formatVerify(r, expectPartial);
    const w = own(text).filter((l) => FORBIDDEN.test(l)); if (w.length > 0) bad.words.push([i, w[0].slice(0, 120)]);
    const ol = outcomeLines(text); if (ol.length !== 1 || !ol[0].startsWith(`OUTCOME ${r.outcome}:`)) bad.line.push([i, ol]);
    if (r.outcome === 'no-automated-findings' && !(ol[0] ?? '').includes(expectPartial ? 'expected partial outcome — maintainer review required' : 'maintainer review required')) bad.clean.push([i, ol[0]]);
    if (r.outcome === 'findings' && !((ol[0] ?? '').includes(`${r.findings.length} automated finding`) && (ol[0] ?? '').endsWith('maintainer review required'))) bad.say.push([i, ol[0]]);
    if (r.outcome === 'not-evaluable' && !(ol[0] ?? '').includes('nothing was verified')) bad.say.push([i, ol[0]]);
    if (!H.KNOWN_LIMITATIONS.every((l) => text.includes(`  - ${l}`)) || !/^KNOWN LIMITATIONS/m.test(text)) bad.footer.push(i);
    if (/^(PASS|FAIL)\b/m.test(text) || /RESULT/.test(text)) bad.tokens.push(i);
    const rp = reportGrammarProblems(text, r); if (rp.length > 0) bad.grammar.push([i, rp]);
  });
  G(`the return value of every verify of this spec (${VERIFY_LOG.length} runs) has exactly the keys outcome, findings, notEvaluable, checked and expectPartial: no status, passed, complete or partial field`, VERIFY_LOG.length >= 250 && bad.keys.length === 0, { runs: VERIFY_LOG.length, bad: bad.keys.slice(0, 3) });
  G('every result is one of the three outcomes and is shaped by it (not evaluable: reasons only; findings: at least one finding; no automated findings: checks ran and nothing was found)', bad.outcome.length === 0 && bad.shape.length === 0, { outcome: bad.outcome.slice(0, 3), shape: bad.shape.slice(0, 3) });
  G('the sweep and the rest of the spec reach all three outcomes, so the property is not vacuous', ['not-evaluable', 'findings', 'no-automated-findings'].every((o) => seenOutcomes.has(o)), [...seenOutcomes]);
  G('no report prints passed, complete or compatible in any line the helper writes itself (lines that echo evidence or project text are the indented detail lines), and none uses a PASS, FAIL or RESULT token', bad.words.length === 0 && bad.tokens.length === 0, { words: bad.words.slice(0, 3), tokens: bad.tokens.slice(0, 3) });
  G('every report has exactly one OUTCOME line naming the result outcome, a clean one says "maintainer review required" (with the expected-partial wording under --expect-partial), one with findings counts them and ends with "maintainer review required", one that is not evaluable says nothing was verified, and every report carries the limitations footer', bad.line.length === 0 && bad.clean.length === 0 && bad.say.length === 0 && bad.footer.length === 0, { line: bad.line.slice(0, 3), clean: bad.clean.slice(0, 3), say: bad.say.slice(0, 3), footer: bad.footer.slice(0, 3) });
  G(`every report of every recorded run (${VERIFY_LOG.length}) keeps the report grammar: no control character but LF, only the lines the helper writes (a NOT EVALUABLE, FINDING or NO FINDING line per reason, finding and check, the summary, one OUTCOME line, the footer, indented detail lines), whatever the input put into a reason, a name or a detail`, VERIFY_LOG.length >= 250 && bad.grammar.length === 0, bad.grammar.slice(0, 3));
  { const verdictRuns = VERIFY_LOG.filter(({ r }) => /(?:complete|passed|compatible)[-\w]*\.(?:project\.)?md/.test(JSON.stringify(r)));
    G('the recorded runs include files named complete, passed and compatible, among both checks and findings, and none of them puts a verdict word on a line the helper writes itself (the path is only ever on a detail line)', verdictRuns.length >= 3 && verdictRuns.some(({ r }) => r.checked.some((x) => /(?:complete|passed|compatible)/.test(x.detail ?? ''))) && verdictRuns.some(({ r }) => r.findings.some((x) => /(?:complete|passed|compatible)/.test(JSON.stringify(x.detail)))) && verdictRuns.every(({ r, expectPartial }) => own(H.formatVerify(r, expectPartial)).every((l) => !FORBIDDEN.test(l))), { runs: verdictRuns.length }); }
  G('the forbidden-word pattern really matches what it must (a mutation that brings a verdict word back would be caught)', ['passed', 'PASS', 'complete', 'completed', 'checks passed', 'compatible', 'compatibility'].every((w) => FORBIDDEN.test(`x ${w} x`)) && !FORBIDDEN.test('incomplete') && !FORBIDDEN.test('maintainer review required'));
  G('an echo of evidence that names a forbidden word appears only on an indented detail line, never on a line the helper writes itself', (() => { const r = V({ project: path.join(LIVE, 'adv-none'), baseline: {}, evidence: { passed: true } }); const text = H.formatVerify(r, false); return /^ {8}- .*\bpassed\b/m.test(text) && !own(text).some((l) => FORBIDDEN.test(l)); })());
  // The CLI: every run of verify in the spec, by its exit code.
  const cliRuns = CLI_LOG.filter((x) => x.out !== ''); const cliUsage = CLI_LOG.filter((x) => x.out === '');
  // Both streams: a report run holds exactly one OUTCOME line on stdout and none on stderr; a usage error holds none on either (an argument must not be able to add one).
  const cliBad = cliRuns.filter((x) => { const ol = outcomeLines(x.out); const name = ol.length === 1 ? ol[0].slice('OUTCOME '.length).split(':')[0] : null; return name === null || H.OUTCOME_EXIT[name] !== x.code || own(x.out).some((l) => FORBIDDEN.test(l)) || reportGrammarProblems(x.out).length > 0 || outcomeLines(x.err).length !== 0; });
  G(`every verify command of this spec (${cliRuns.length} runs) prints exactly one OUTCOME line (and nothing that is not a report line) and exits with the code of that outcome, with no verdict wording, and no OUTCOME line of any command is on stderr`, cliRuns.length >= 15 && cliBad.length === 0 && cliUsage.every((x) => x.code === 1 && outcomeLines(`${x.out}\n${x.err}`).length === 0), { runs: cliRuns.length, bad: cliBad.slice(0, 2).map((x) => ({ code: x.code, out: x.out.slice(0, 200) })) });
  G('the exit codes are exactly: not-evaluable 3, findings 1, no-automated-findings 0, and nothing else is an outcome', JSON.stringify(H.OUTCOME_EXIT) === JSON.stringify({ 'not-evaluable': 3, findings: 1, 'no-automated-findings': 0 }) && JSON.stringify(H.VERIFY_OUTCOMES) === JSON.stringify(['not-evaluable', 'findings', 'no-automated-findings']) && Object.isFrozen(H.OUTCOME_EXIT));
}

// ============================================================== run and report ====
const SKIPPED = results.filter((r) => r.skip === true).length;
let failedCount = 0;
for (const r of results) {
  if (r.skip === true) { console.log(`SKIP  ${r.name} (${r.detail})`); continue; }
  if (r.ok) { console.log(`PASS  ${r.name}`); continue; }
  failedCount += 1;
  console.log(`FAIL  ${r.name}`);
  if (r.detail !== undefined) { const d = typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail); console.log(`      - ${d.length > 500 ? `${d.slice(0, 500)}...` : d}`); }
}
console.log(`${results.length - failedCount - SKIPPED} PASS / ${failedCount} FAIL / ${SKIPPED} SKIP`);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* the scratch directory is under the OS temp directory */ }
// The live fixtures: remove every link or junction itself first (never through it), then the fixture directory.
for (const l of LIVE_LINKS) { try { const st = fs.lstatSync(l); if (st.isSymbolicLink()) { try { fs.unlinkSync(l); } catch { fs.rmdirSync(l); } } } catch { /* already gone */ } }
try { fs.rmSync(LIVE, { recursive: true, force: true }); } catch { /* best effort: the directory is under BS_DOC_MAP_SCRATCH or the OS temp directory */ }
process.exit(failedCount === 0 ? 0 : 1);
