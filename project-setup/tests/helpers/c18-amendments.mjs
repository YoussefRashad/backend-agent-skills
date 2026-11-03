// Exact 3.0.0 amendment literals and the reversal helper (test-only; never part of the installer payload).
//
// Plan: none. The maintainer chose to ship 3.0.0 on 2026-11-03 with the two unmet rc.4 measurement criteria recorded as residuals
// (docs/plans/2026-11-02-project-setup-v3-rc4-host-measurements.md). The 3.0.0 skill source is the rc.4 source plus the amendments
// below: the version number, the release headings and wording, the changelog entry and the root documents. No runtime file, agent,
// wrapper or reference changes. The release notes are a new file (RELEASE-NOTES-3.0.0.md), checked by hash in c18.test.mjs.
//
// An amendment is { file, before, old, neu, after } exactly as in c17-amendments.mjs: before + old + after is the rc.4 slice and
// before + neu + after the 3.0.0 slice. The rc.4 text is taken from the C17 amendments, never retyped, so the rc.4 side cannot
// drift from what c17.test.mjs pins. Root files are keyed "@root/<path>"; every other key is relative to project-setup/.
// Importing it reads no file and starts no process; only readRc4 reads, and only when called.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AM17, TD17, amendmentOnce as amendmentOnce17, applyOne as applyOne17, reverseOne as reverseOne17 } from './c17-amendments.mjs';

const T = (lines) => lines.map((l) => `${l}\n`).join('');

const CHANGELOG_ENTRY18 = [
  '## 3.0.0',
  '',
  'Final release. The skill source is the rc.4 content; only the version number and the release',
  'headings change. C17 reviewer HEAD identity and Git ownership diagnostics were measured on the',
  'published rc.4 on 2026-11-02 (Windows 11, Claude Code 2.1.311 and 2.1.316, codex-cli 0.163.0).',
  '',
  'Every required review completed with the equal-head warning evaluated through git-safe head.',
  'The Git ownership failure was content-free without a grant and the review succeeded with the',
  'exact fixture grant. Two measurement criteria were not met and are recorded as residuals, not',
  'fixed here: the Codex reviewer rated the seeded lost update INFO in two of two runs, and a',
  'Claude reviewer refused to start after the parent changed into a subdirectory (the L16 launch',
  'rule, now seen in the TUI).',
  '',
  'Manifest schema 3, policy schemas, approval and rollback behavior remain unchanged.',
  '',
  'See RELEASE-NOTES-3.0.0.md. Publication remains a separate authorized action.',
  '',
];

const RR2_OLD_FULL = `${AM17.RR2.neu}limitations and the host measurements still pending before a final 3.0.0). A project installed\n`;
const RR3_OLD_FULL = `This installs the \`project-setup\` release candidate for both tools; update each project installed\nby v2 with \`project-setup/references/migration-v2.md\`.\n${AM17.RR3.neu}`;
const PT2_OLD_FULL = `\`pr-review\` and \`audit\` are single \`SKILL.md\` files. \`project-setup\` is a versioned release\n${AM17.PT2.neu}`;

const TODO_BULLET18 = [
  '- **`project-setup` 3.0.0 reviewer residuals.** The rc.4 host measurements (2026-11-02) completed',
  '  with two criteria unmet, recorded in',
  '  `docs/plans/2026-11-02-project-setup-v3-rc4-host-measurements.md`. The Codex reviewer rated',
  '  the seeded wallet lost update INFO ("no funding path") in two of two runs, so the canonical',
  '  reviewer should say that a MUST-rule money violation keeps its severity whatever its',
  '  reachability. A Claude reviewer refused to start after the parent changed into a',
  '  subdirectory (the L16 launch-rule false refusal, now seen in the TUI). Both belong to a',
  '  3.0.x change; re-measure Codex change-1 and TUI P3 h afterwards.',
];

export const AM18 = Object.freeze({
  SH18: Object.freeze({ file: 'SKILL.md', before: AM17.SH17.before, old: AM17.SH17.neu, neu: '# project-setup 3.0.0\n', after: AM17.SH17.after }),

  RM18_OPEN: Object.freeze({
    file: 'README.md',
    before: AM17.RM1_17.before,
    old: AM17.RM1_17.neu,
    neu: T([
      '# project-setup 3.0.0 - skill source',
      '',
      '**Release 3.0.0.** See RELEASE-NOTES-3.0.0.md for compatibility, acceptance requirements,',
      'the rc.4 host measurement results and the remaining limitations.',
    ]),
    after: AM17.RM1_17.after,
  }),
  RM18_S07: Object.freeze({ file: 'README.md', before: AM17.RM4a_17.before, old: AM17.RM4a_17.neu, neu: 'requires or creates project-setup-v3.0.0 in the distribution repository.\n', after: AM17.RM4a_17.after }),
  RM18_CMD: Object.freeze({ file: 'README.md', before: AM17.RM4b_17.before, old: AM17.RM4b_17.neu, neu: 'node install/release.mjs --tag project-setup-v3.0.0 --out <unused-directory>\n', after: AM17.RM4b_17.after }),

  RM18_GATE: Object.freeze({
    file: 'README.md',
    before: '',
    old: T(['These are intended fixes,', 'not measured rc.4 host results. Final 3.0.0 remains gated on the rc.4 measurements.']),
    neu: T(['These were intended fixes,', 'not yet measured when this section was written. Their rc.4 measurement is recorded in', 'RELEASE-NOTES-3.0.0.md.']),
    after: '',
  }),
  RM18_ACC: Object.freeze({
    file: 'README.md',
    before: '',
    old: T(['Candidate acceptance requires the complete strict gate below. A focused run or a zero exit']),
    neu: T([
      'Release acceptance requires the complete strict gate below and, separately, node tests/c18.test.mjs',
      '(the standalone 3.0.0 final-release assertions; neither run-tests.mjs nor accept-rc1.mjs runs it).',
      'A focused run or a zero exit',
    ]),
    after: '',
  }),

  LC18: Object.freeze({ file: 'CHANGELOG.md', before: '# Changelog\n\n', old: '', neu: `${T(CHANGELOG_ENTRY18)}`, after: '## 3.0.0-rc.4\n' }),
  V18: Object.freeze({ file: 'VERSION', before: '', old: AM17.V17.neu, neu: '3.0.0\n', after: '' }),

  RR18_1: Object.freeze({ file: '@root/README.md', before: '', old: AM17.RR1.neu, neu: '`project-setup` (3.0.0, shared by Claude Code and Codex) is **not**\n', after: '' }),
  RR18_2: Object.freeze({
    file: '@root/README.md',
    before: '',
    old: RR2_OLD_FULL,
    neu: 'See `project-setup/README.md` and `project-setup/RELEASE-NOTES-3.0.0.md` (compatibility,\nlimitations and the rc.4 host measurement results). A project installed\n',
    after: '',
  }),
  RR18_3: Object.freeze({
    file: '@root/README.md',
    before: '',
    old: RR3_OLD_FULL,
    neu: 'This installs `project-setup` 3.0.0 for both tools; update each project installed\nby v2 with `project-setup/references/migration-v2.md`.\nThe rc.4 host measurement results and limitations are in the 3.0.0 release notes.\n',
    after: AM17.RR3.after,
  }),
  RR18_4: Object.freeze({ file: '@root/README.md', before: '', old: AM17.RR4.neu, neu: '`project-setup/RELEASE-NOTES-3.0.0.md` § "Compatibility and rollback").\n', after: '' }),
  RR18_5: Object.freeze({ file: '@root/README.md', before: '', old: AM17.RR5.neu, neu: '├── project-setup/               general-purpose — shared Claude Code + Codex setup (3.0.0, own installer and tests)\n', after: '' }),

  PT18_1: Object.freeze({ file: '@root/.ai/context/project-tree.md', before: '', old: AM17.PT1.neu, neu: '├── project-setup/              skill 3 — shared Claude Code + Codex agent scaffolding (3.0.0)\n', after: '' }),
  PT18_2: Object.freeze({
    file: '@root/.ai/context/project-tree.md',
    before: '',
    old: PT2_OLD_FULL,
    neu: '`pr-review` and `audit` are single `SKILL.md` files. `project-setup` is a versioned release\n(`project-setup/VERSION` is `3.0.0`) with its own layout: `SKILL.md`,\n',
    after: '',
  }),
  PT18_3: Object.freeze({
    file: '@root/.ai/context/project-tree.md',
    before: AM17.PT3.before,
    old: AM17.PT3.neu,
    neu: 'The rc.4 host measurements completed with two recorded residuals. Dated observations and\nremaining platform limitations are in project-setup/RELEASE-NOTES-3.0.0.md.\n',
    after: AM17.PT3.after,
  }),

  TD18: Object.freeze({
    file: '@root/TODO.md',
    before: TD17.before,
    old: `${TD17.neu}${TD17.after}\n`,
    neu: `${TD17.after}\n${T(TODO_BULLET18)}`,
    after: '- **Dependency pins are 1–2 majors behind.**',
  }),
});

export const FORWARD_ORDER18 = Object.freeze({
  'SKILL.md': Object.freeze(['SH18']),
  'README.md': Object.freeze(['RM18_OPEN', 'RM18_S07', 'RM18_CMD', 'RM18_GATE', 'RM18_ACC']),
  'CHANGELOG.md': Object.freeze(['LC18']),
  VERSION: Object.freeze(['V18']),
  '@root/README.md': Object.freeze(['RR18_1', 'RR18_2', 'RR18_3', 'RR18_4', 'RR18_5']),
  '@root/.ai/context/project-tree.md': Object.freeze(['PT18_1', 'PT18_2', 'PT18_3']),
  '@root/TODO.md': Object.freeze(['TD18']),
});
export const REVERSAL_ORDER18 = Object.freeze(Object.fromEntries(Object.entries(FORWARD_ORDER18).map(([f, ids]) => [f, Object.freeze([...ids].reverse())])));
export const AMENDED_FILES18 = Object.freeze(Object.keys(FORWARD_ORDER18));

// The engine is the C17 engine (one implementation); only the table differs.
export const amendmentOnce = amendmentOnce17;
export const reverseOne = reverseOne17;
export const applyOne = applyOne17;
const known = (id) => Object.prototype.hasOwnProperty.call(AM18, id);
/** Reverses the named amendments in the given order. { text, failed }: text is null and failed names the first one that does not verify. */
export function reverseSteps(text, ids) {
  let t = text;
  for (const id of ids) {
    if (!known(id)) return { text: null, failed: id };
    t = reverseOne(t, AM18[id]);
    if (t === null) return { text: null, failed: id };
  }
  return { text: t, failed: null };
}
export function applySteps(text, ids) {
  let t = text;
  for (const id of ids) {
    if (!known(id)) return null;
    t = applyOne(t, AM18[id]);
    if (t === null) return null;
  }
  return t;
}
/** The rc.4 view of one amended file: every 3.0.0 amendment of that file reversed and verified. { text, failed }. */
export function reverseForFile(text, rel) {
  const ids = REVERSAL_ORDER18[rel];
  if (ids === undefined) return { text: null, failed: `no 3.0.0 amendment for ${rel}` };
  return reverseSteps(text, ids);
}
export function applyForFile(text, rel) {
  const ids = FORWARD_ORDER18[rel];
  return ids === undefined ? null : applySteps(text, ids);
}

/** The bytes a rc.4-era test expects: the rc.4 view for an amended file, the same bytes for any other file, null when a reversal does not verify. */
export function rc4Bytes(bytes, rel) {
  if (bytes === null || bytes === undefined) return bytes;
  if (!Object.prototype.hasOwnProperty.call(REVERSAL_ORDER18, rel)) return bytes;
  const r = reverseForFile(Buffer.from(bytes).toString('utf8'), rel);
  return r.text === null ? null : Buffer.from(r.text, 'utf8');
}

const REAL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const absOf = (rel) => path.resolve(rel.startsWith('@root/') ? path.join(REAL_ROOT, ...rel.slice(6).split('/')) : path.join(REAL_ROOT, 'project-setup', ...rel.split('/')));
const REL_BY_ABS = new Map(AMENDED_FILES18.map((rel) => [absOf(rel), rel]));
/** fs.readFileSync for the rc.4-era tests: the real tree's amended files are returned as their verified rc.4 view; every other path is read as is. Throws when a reversal does not verify. */
export function readRc4(p) {
  const b = fs.readFileSync(p);
  const rel = REL_BY_ABS.get(path.resolve(p));
  if (rel === undefined) return b;
  const r = reverseForFile(b.toString('utf8'), rel);
  if (r.text === null) throw new Error(`3.0.0 amendment does not reverse for ${rel}: ${r.failed}`);
  return Buffer.from(r.text, 'utf8');
}

/** The version the 3.0.0 source tree carries. Behavior tests that install or update from the real tree expect it; the pinned rc.4 text is read through readRc4. */
export const FINAL_VERSION18 = '3.0.0';
/** After a copy of the real project-setup tree, makes the copy the rc.4 tree: the four amended project-setup files are reversed (verified) and the 3.0.0 notes are removed. */
export function toRc4Tree(skillDir) {
  for (const rel of AMENDED_FILES18.filter((r) => !r.startsWith('@root/'))) {
    const p = path.join(skillDir, ...rel.split('/'));
    const r = reverseForFile(fs.readFileSync(p, 'utf8'), rel);
    if (r.text === null) throw new Error(`3.0.0 amendment does not reverse for ${rel}: ${r.failed}`);
    fs.writeFileSync(p, r.text, 'utf8');
  }
  fs.rmSync(path.join(skillDir, 'RELEASE-NOTES-3.0.0.md'), { force: true });
}
