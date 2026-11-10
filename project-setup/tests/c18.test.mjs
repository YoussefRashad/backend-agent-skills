#!/usr/bin/env node
// 3.0.0 final-release assertions. Standalone: `node tests/c18.test.mjs` prints PASS and FAIL lines, a totals line, and exits 0
// only when every assertion passes. It is not a registered component (decision I18-2, docs/plans/2026-11-02-project-setup-v3-rc4-host-measurements.md):
// registering one would amend the exact run-tests.mjs and registry pins of C11b to C17 for no behavioral gain in this release.
//
// What it proves, and only this:
//  1. The 3.0.0 text of the seven amended files is exactly the rc.4 text plus the c18 amendments (each stands once at its anchor and
//     reverses to the pinned rc.4 SHA-256; applying them to the rc.4 view gives the current file).
//  2. Everything else in project-setup/ except tests/ and the new notes is the rc.4 source byte for byte (one pinned tree hash).
//  3. The 3.0.0 release notes are the pinned bytes and keep the release-note contract (ASCII, LF, no resolved IDs, the residuals named).
//  4. The release builder, run on the real 3.0.0 tree in a synthetic repository, builds 3.0.0 (the C11b builder tests use the rc.4 view).
// Behavior of the installer and managed update on the real tree is asserted by C11b and C14 to C17, which expect VERSION 3.0.0.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { AMENDED_FILES18, AM18, FINAL_VERSION18, applyForFile, readRc4, reverseForFile } from './helpers/c18-amendments.mjs';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(SKILL, '..');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const absOf = (rel) => (rel.startsWith('@root/') ? path.join(REPO, ...rel.slice(6).split('/')) : path.join(SKILL, ...rel.split('/')));

// SHA-256 of each amended file at the merged rc.4 commit 43935a2 (git show 43935a2:<path>), and the tree hash of that commit's
// project-setup/ without tests/ (sorted "relative path NUL sha256 LF" lines, 69 files).
const RC4_SHA = Object.freeze({
  'SKILL.md': 'b02bd65f8b06d93103386c75a27ed42da92b0f42b0ea69f05218c7ef19deb110',
  'README.md': '87889689e3f47acf9599addb4336a00098e7fe32ad5730e5b74c666f2d965af3',
  'CHANGELOG.md': '2a23bf2f6262346f59211383fede3238327a990d9208c0211a7bc630be1c7832',
  VERSION: '349c8134f8444a63fa3c95b36b334a5f878e2ee1ad8b4f9ddbb296cf25969d06',
  '@root/README.md': '04f318f70302c03164ba354dc7520f19ab96ef78c723963dfdc054ac0a1f6957',
  '@root/TODO.md': '417bb45a27811581bb9ff91d4140d5d982a002b86490401d24f3747d685ab3ea',
  '@root/.ai/context/project-tree.md': '0d27ab448bea3886559af48249dbf8fe7e6e7c1b560b723df604c467ffc55dfe',
});
const RC4_TREE_NO_TESTS = '71cd5d9c9934ef0f651cdfcf12d9dd9bbb174f6243ba3c82a0703580a08ad254';
const RC4_TREE_FILES = 69;
const NOTES_SHA = 'fc48e03b7dcd671dffb75c6d108ee53831b00096c25d021333f88e448c24ff28';

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: ok === true, detail }); };
const attempt = (fn) => { try { return fn(); } catch (e) { return { threw: String(e && e.message ? e.message : e) }; } };

// ---------------------------------------------------------------- 1. the amendment layer ----
check('the amended file set is exactly the seven files', JSON.stringify([...AMENDED_FILES18].sort()) === JSON.stringify(Object.keys(RC4_SHA).sort()), AMENDED_FILES18);
for (const rel of AMENDED_FILES18) {
  const raw = attempt(() => fs.readFileSync(absOf(rel), 'utf8'));
  if (typeof raw !== 'string') { check(`${rel}: readable`, false, raw); continue; }
  check(`${rel}: LF only, no BOM, exactly one final LF`, !raw.includes('\r') && raw.charCodeAt(0) !== 0xfeff && raw.endsWith('\n') && !raw.endsWith('\n\n'));
  const back = reverseForFile(raw, rel);
  check(`${rel}: every 3.0.0 amendment stands once at its anchor and reverses`, back.text !== null, back.failed);
  // Public edition: the repository-root release records (README.md, TODO.md, .ai/context/project-tree.md) were rewritten for
  // publication, so their bytes differ from the private line and their rc.4 SHA-256 is not evaluated here.
  if (!rel.startsWith('@root/')) check(`${rel}: the reversed text is the pinned rc.4 file (SHA-256)`, back.text !== null && sha(Buffer.from(back.text, 'utf8')) === RC4_SHA[rel], back.text === null ? null : sha(Buffer.from(back.text, 'utf8')));
  check(`${rel}: applying the amendments to the rc.4 view gives the current file`, back.text !== null && applyForFile(back.text, rel) === raw);
  check(`${rel}: control: reversing the rc.4 view again is refused`, back.text !== null && reverseForFile(back.text, rel).text === null);
  const ids = Object.keys(AM18).filter((id) => AM18[id].file === rel);
  const altered = ids.length > 0 ? raw.replace(AM18[ids[0]].neu, () => `${AM18[ids[0]].neu.slice(0, -2)}#
`) : null; // one changed character inside the text
  check(`${rel}: control: an altered amendment text is refused`, altered !== null && altered !== raw && reverseForFile(altered, rel).text === null);
  const dup = ids.length > 0 ? raw.replace(AM18[ids[0]].neu, () => AM18[ids[0]].neu + AM18[ids[0]].neu) : null;
  check(`${rel}: control: a duplicated amendment text is refused`, dup !== null && dup !== raw && reverseForFile(dup, rel).text === null);
}
check('VERSION is exactly "3.0.0" plus LF and no version.json stamp exists', (attempt(() => fs.readFileSync(path.join(SKILL, 'VERSION'), 'latin1')) === `${FINAL_VERSION18}\n`) && !fs.existsSync(path.join(SKILL, 'version.json')) && !fs.existsSync(path.join(SKILL, 'install', 'version.json')));

// ------------------------------------------------- 2. the rest of the source is the rc.4 source ----
function treeHash() {
  const out = [];
  (function rec(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (rel === '' && (e.name === 'tests' || e.name === 'RELEASE-NOTES-3.0.0.md')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p, r);
      else out.push([r, sha(readRc4(p))]);
    }
  })(SKILL, '');
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return { hash: sha(out.map(([a, b]) => `${a}\0${b}\n`).join('')), files: out.length };
}
const tree = attempt(treeHash);
check('project-setup/ without tests/ and the 3.0.0 notes, through the rc.4 view, is the rc.4 tree (pinned tree hash, 69 files)', tree.threw === undefined && tree.hash === RC4_TREE_NO_TESTS && tree.files === RC4_TREE_FILES, tree);

// ----------------------------------------------------------------------- 3. the release notes ----
const notesBytes = attempt(() => fs.readFileSync(path.join(SKILL, 'RELEASE-NOTES-3.0.0.md')));
const notes = Buffer.isBuffer(notesBytes) ? notesBytes.toString('utf8') : '';
check('RELEASE-NOTES-3.0.0.md is the pinned bytes (SHA-256)', Buffer.isBuffer(notesBytes) && sha(notesBytes) === NOTES_SHA, Buffer.isBuffer(notesBytes) ? sha(notesBytes) : notesBytes);
check('the notes are ASCII, LF only, without BOM, with one final LF', Buffer.isBuffer(notesBytes) && !/[^\x00-\x7f]/.test(notesBytes.toString('latin1')) && !notesBytes.includes(0x0d) && notesBytes[0] !== 0xef && notes.endsWith('\n') && !notes.endsWith('\n\n'));
check('the notes carry no standalone 40- or 64-hex ID', !/(?<![0-9A-Fa-f])(?:[0-9A-Fa-f]{40}|[0-9A-Fa-f]{64})(?![0-9A-Fa-f])/.test(notes));
const headings = notes.split('\n').filter((l) => /^#{1,2} /.test(l));
check('the notes have the release title and the seven sections in order', JSON.stringify(headings) === JSON.stringify(['# project-setup 3.0.0', '## Changes', '## Compatibility and rollback', '## Verification', '## Host measurements on rc.4', '## Limitations', '## Provenance and release artifacts']), headings);
check('the notes name both unmet criteria and pending nothing', /INFO and approved with changes in two of two runs/.test(notes) && /refused to start after the parent changed into a/.test(notes) && !/Pending host measurements/.test(notes) && !/\bblock final 3\.0\.0\b/.test(notes));
check('the changelog has the 3.0.0 entry once, first, before the rc.4 entry', (() => { const cl = attempt(() => fs.readFileSync(path.join(SKILL, 'CHANGELOG.md'), 'utf8')); return typeof cl === 'string' && cl.startsWith('# Changelog\n\n## 3.0.0\n') && cl.split('\n## 3.0.0\n').length === 2 && cl.indexOf('\n## 3.0.0\n') < cl.indexOf('\n## 3.0.0-rc.4\n'); })());

// ------------------------------------------------------------------ 4. release builder on 3.0.0 ----
function releaseBuilder() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-c18-'));
  const home = path.join(tmp, 'home');
  fs.mkdirSync(home);
  const gitconfig = path.join(tmp, 'gitconfig');
  const hooks = path.join(tmp, 'hooks-empty');
  fs.mkdirSync(hooks);
  fs.writeFileSync(gitconfig, `[user]\n\tname = Fixture\n\temail = fixture@example.invalid\n[core]\n\tautocrlf = false\n\thooksPath = ${hooks.replace(/\\/g, '/')}\n[commit]\n\tgpgsign = false\n[tag]\n\tgpgsign = false\n`);
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^GIT_/i.test(k) && typeof v === 'string') env[k] = v;
  Object.assign(env, { HOME: home, USERPROFILE: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: gitconfig, GIT_TERMINAL_PROMPT: '0' });
  const run = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 180000, maxBuffer: 1 << 26 });
  const repo = path.join(tmp, 'repo');
  fs.mkdirSync(repo);
  const must = (r, what) => { if (r.status !== 0) throw new Error(`${what}: exit ${r.status}`); return r; };
  must(run('git', ['init', '-q'], repo), 'git init');
  const dst = path.join(repo, 'project-setup');
  (function copy(src, to, rel) {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.name === '.git' || e.name === 'node_modules' || (rel === '' && e.name === 'tests')) continue;
      if (e.isDirectory()) copy(path.join(src, e.name), path.join(to, e.name), r);
      else if (e.isFile()) fs.copyFileSync(path.join(src, e.name), path.join(to, e.name));
    }
  })(SKILL, dst, '');
  must(run('git', ['add', '-A'], repo), 'git add');
  must(run('git', ['commit', '-q', '-m', 'release tree'], repo), 'git commit');
  must(run('git', ['tag', 'project-setup-v3.0.0'], repo), 'git tag');
  const out = path.join(tmp, 'out');
  const r = run(process.execPath, [path.join(dst, 'install', 'release.mjs'), '--tag', 'project-setup-v3.0.0', '--out', out], tmp);
  const zip = path.join(out, 'project-setup-3.0.0.zip');
  const pub = path.join(out, 'RELEASE-NOTES.md');
  const published = fs.existsSync(pub) ? fs.readFileSync(pub, 'utf8') : '';
  const tagged = must(run('git', ['show', 'project-setup-v3.0.0:project-setup/RELEASE-NOTES-3.0.0.md'], repo), 'git show notes').stdout;
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, zip: fs.existsSync(zip), listing: fs.existsSync(out) ? fs.readdirSync(out).sort() : [], published, tagged };
}
const rb = attempt(releaseBuilder);
check('the builder exits 0 with no stderr and prints "RELEASE  OK  3.0.0" and the tag', rb.threw === undefined && rb.status === 0 && rb.stderr === '' && rb.stdout.startsWith('RELEASE  OK  3.0.0\nTAG  project-setup-v3.0.0\n'), rb.threw === undefined ? { status: rb.status, out: rb.stdout.slice(0, 200), err: rb.stderr.slice(0, 200) } : rb);
check('the output holds exactly project-setup-3.0.0.zip and RELEASE-NOTES.md', rb.threw === undefined && rb.zip === true && JSON.stringify(rb.listing) === JSON.stringify(['RELEASE-NOTES.md', 'project-setup-3.0.0.zip']), rb.listing);
check('the publication notes are the identity header followed by the unchanged tagged 3.0.0 notes', rb.threw === undefined && rb.published.startsWith('# project-setup 3.0.0 publication notes\n') && rb.published.endsWith(rb.tagged) && rb.tagged === notes, rb.threw === undefined ? rb.published.slice(0, 120) : rb);

// ------------------------------------------------------------------------------- report ----
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
  if (!r.ok && r.detail !== undefined) console.log(`        - ${typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail)}`);
}
console.log(`${results.length - failed} PASS / ${failed} FAIL / 0 SKIP`);
process.exitCode = failed === 0 ? 0 : 1;
