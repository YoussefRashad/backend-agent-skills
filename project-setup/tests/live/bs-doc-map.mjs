#!/usr/bin/env node
// Test-only live helper for the 3.1 backend-standards documentation mapping, and the one module the standalone spec
// (tests/bs-doc-map.test.mjs) shares with it, so pointer inspection exists once (plan 2026-11-11-project-setup-v3.1-bs-doc-map.md section 8,
// "Live workspace and helper contract"; section 12 wins on conflict). It ships nothing: it is not part of the installed payload.
//
// What it never does: install, switch or restore a skill copy; write global or system Git configuration; grant a safe.directory;
// read .env* files, secrets or policy-denied paths; pre-restore, intercept or repair what backend-standards wrote; simulate drafting.
// What it does: create unused fixture workspaces (init), record explicit-inventory snapshots (snapshot), commit fixture-only
// application changes for the agent measurements (seed) and check the state a run left behind (verify).
//
// CLI (importing this file starts nothing; the commands run only when it is the entry point):
//   node tests/live/bs-doc-map.mjs init     --scenario ps-first|bs-existing|bs-new --out <unused absolute dir>
//   node tests/live/bs-doc-map.mjs snapshot --project <dir> --out <file>
//   node tests/live/bs-doc-map.mjs seed     --project <dir> --case docs-sync|reviewer
//   node tests/live/bs-doc-map.mjs verify   --project <dir> --baseline <snapshot file> [--evidence <file>] [--expect-partial]
// Exit codes: 0 ok, 1 usage, 2 refused (unsafe or unrecognized target, or a project policy that cannot be established; init, snapshot and seed).
// verify is an ADVISORY evidence collector (plan amendment 1, docs/plans/2026-11-11-project-setup-v3.1-bs-doc-map-amendment-1.md): it never reports
// an acceptance result. It prints exactly one "OUTCOME <name>" line, and the exit code follows it: not-evaluable 3 (a required input is missing or invalid,
// or a read-boundary check refused it), findings 1, no-automated-findings 0 (the output says "maintainer review required"). A usage error of verify
// also exits 1 but prints to stderr only and carries no OUTCOME line, so read the line, not only the code. verify therefore needs --evidence in practice.
// The acceptance decision is the maintainer's, through the checklist in tests/live/BS-DOC-MAP-ACCEPTANCE.md.
//
// Pointer bullet form (interface the drafting reference must state): the "Sections:" list holds one line per resolved destination,
// `- <Heading>` for a top-level section or `- <Parent> > <Subheading>` for a subordinate one, where every name is the actual heading
// text of the project's 03 after its optional leading section number is removed and whitespace is normalized (parenthetical
// cross-references kept). A subordinate heading is never listed without its parent.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseBlocks } from '../../scripts/blocks.mjs';
import { checkManifest } from '../../scripts/schemas.mjs';
import { matchesPolicyPath, parseSecurityPolicy } from '../../assets/tools/security-policy.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_ROOT = path.resolve(HERE, '..', '..');
export const REPO_ROOT = path.resolve(SKILL_ROOT, '..');

// ---------------------------------------------------------------- constants ----
export const BS_03_REL = '.ai/standards/03-project-architecture.md';
export const STAMP_REL = '.backend-standards.json';
export const POINTER_MARKER = '<!-- project-setup:documentation-pointer v=1 -->';
export const DECISION_SENTENCE = 'Documentation layout decision: use .ai/standards/03-project-architecture.md as the source of truth for project-setup mapped documentation.';
export const DECISION_PREFIX = 'Documentation layout decision:';
// Semantic Versioning 2.0.0 (the semver.org grammar): numeric identifiers carry no leading zero, in the core AND in a numeric prerelease
// identifier; empty identifiers are invalid; build metadata may keep leading zeros. A looser pattern accepted 01.2.3 and 1.2.3-01, which
// would let a malformed provenance record count as valid instead of holding activation (plan D1).
const NUM = '(?:0|[1-9]\\d*)';
const PRE_ID = '(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)';
export const SEMVER = new RegExp(`^${NUM}\\.${NUM}\\.${NUM}(?:-${PRE_ID}(?:\\.${PRE_ID})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`);
export const PLACEHOLDERS = Object.freeze(['TITLE', 'RELATIVE_PATH_TO_03', 'SECTION_BULLETS', 'TOPIC_OR_VENDOR']);
export const BS_IMPORT_03 = '@.ai/standards/03-project-architecture.md';

// ---------------------------------------------------------------- utilities ----
export const sha256 = (b) => createHash('sha256').update(b).digest('hex');
export const normalizeEol = (s) => String(s).replace(/\r\n?/g, '\n');
export const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
// Every lookup whose KEY comes from evidence or parsed JSON asks for an own property: a plain object answers "constructor", "toString" and
// "__proto__" with something inherited, which reads as a record that was never written.
const hasOwn = (o, k) => o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k);
const ownOf = (o, k) => (hasOwn(o, k) ? o[k] : undefined);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fold = (s) => (process.platform === 'win32' ? s.toLowerCase() : s);
const lineCount = (s) => { const t = normalizeEol(s); return t === '' ? 0 : t.split('\n').length - (t.endsWith('\n') ? 1 : 0); };
// A value that comes from input (an argument, a project path, an evidence key or value, file text, an error message) is data, never structure: written to a
// report it must stay on the line it was interpolated into. A line break inside it would start a new line at column 0, and a forged "OUTCOME ..." line there
// would read as the result (review pass 5, N14). Every control character (C0 including CR and LF, DEL, C1 including NEL) and the Unicode line and paragraph
// separators U+2028 and U+2029 is therefore written as a visible escape: \xNN, or \uNNNN above 0xFF. A backslash is not escaped, so the encoding is for reading,
// not for round-tripping. JSON.stringify leaves DEL, C1 and U+2028/9 raw, so the encoder runs after it, never instead of it.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;
export const encodeLine = (v) => String(v).replace(CONTROL_CHARS, (c) => { const n = c.charCodeAt(0); return n <= 0xff ? `\\x${n.toString(16).padStart(2, '0')}` : `\\u${n.toString(16).padStart(4, '0')}`; });
// Confirmed absence, the only error that means "nothing is there" (Windows reports ENOENT for the child of a file, POSIX ENOTDIR). Every other error is a read
// that did not happen, not an empty answer (review pass 5, N15 and N16).
const ABSENT_CODES = Object.freeze(['ENOENT', 'ENOTDIR']);
// Fenced code as CommonMark defines it (the part this scanner models). An OPENING fence is up to three spaces, then three or more backticks or tildes;
// the info string of a backtick fence holds no backtick (otherwise the line is inline code, not a fence). A CLOSING fence is up to three spaces, a run of the
// SAME character at least as long as the opener, and then nothing but spaces or tabs: a matching run followed by any other text ("```js", "``` x") is
// content of the code block, not its end. Treating it as the end made headings and decisions inside a block that never closes look operative (review pass 4, N10).
// The stepper returns true for every line that belongs to a fence (delimiters included) and exposes the opener of a fence still open (openLine, 0-based).
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const makeFenceStepper = () => {
  let f = null;
  const step = (line, i) => {
    const m = FENCE_LINE.exec(line);
    if (f === null) {
      if (m && !(m[1][0] === '`' && m[2].includes('`'))) { f = { ch: m[1][0], n: m[1].length, line: i }; return true; }
      return false;
    }
    if (m && m[1][0] === f.ch && m[1].length >= f.n && /^[ \t]*$/.test(m[2])) f = null;
    return true;
  };
  step.openLine = () => (f === null ? null : f.line);
  return step;
};
/**
 * The inline content of one line (or of what remains of it), scanned left to right: a backtick run opens a code span only when a run of the
 * same length closes it (code is literal, so "<!--" inside it opens nothing), and "<!--" outside code opens a comment that a "-->" closes.
 * A comment closed on this line is removed. One left open ends the visible text there when hideOpen is true ({ text, open: true }); with
 * hideOpen false it is plain text and the scan goes on, which is what CommonMark does with a comment that never closes.
 */
function inlineScan(s, hideOpen) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '`') {
      let n = 1;
      while (s[i + n] === '`') n += 1;
      let close = -1;
      for (let j = i + n; j < s.length && close === -1;) {
        if (s[j] !== '`') { j += 1; continue; }
        let m = 1;
        while (s[j + m] === '`') m += 1;
        if (m === n) close = j; else j += m;
      }
      if (close === -1) { out += s.slice(i, i + n); i += n; } else { out += s.slice(i, close + n); i = close + n; }
      continue;
    }
    if (s.startsWith('<!--', i)) {
      const end = s.indexOf('-->', i + 4);
      if (end !== -1) { i = end + 3; continue; }
      if (hideOpen) return { text: out, open: true };
    }
    out += s[i];
    i += 1;
  }
  return { text: out, open: false };
}
// Where an inline comment opened mid-line really ends. A "<!--" left open at the end of its line closes on the first later line that holds "-->",
// unless the paragraph ends first: a blank line (or the end of the text) before any "-->" leaves the opener as plain text, and that is exact.
// When a "-->" does follow inside the paragraph, the comment spans the lines in between ONLY if every line from the opener to the closing line is a
// plain paragraph line (PLAIN_LINE). Anything else there may end the paragraph (a list item, a block quote, a heading, a fence, a thematic break,
// a setext underline, an HTML block, a table row: the comment then never opens and what follows it is visible) or sit in a container, and this
// scanner models none of that. It does not guess: it reports an unsupported comment shape, which makes every verification that read the file not
// evaluable and holds the layout classification. Why: guessing "comment" hides visible text (a stale value, a conflicting sentence) from the
// checks, and over-hiding fails closed for everything except the checks that look for something that must NOT be there.
// A plain line starts (after at most three spaces of indentation) with a letter, "@", a quote or "(", with a number that is not a list marker, or with
// the "-->" that closes the comment. Every block construct above starts with another character, and a line indented four or more spaces (an indented
// code block, or content of a container) is not plain either, because what it is depends on the lines before it, which the scanner does not model.
const PLAIN_LINE = /^(?:-->|[\p{L}@'"(]|(?!\d{1,9}[.)](?:[ \t]|$))\d)/u;
const isPlainLine = (l) => PLAIN_LINE.test(l.replace(/^ {0,3}/, ''));
function commentSpan(lines, i) {
  let end = -1;
  for (let j = i + 1; j < lines.length && end === -1; j += 1) {
    if (/^\s*$/.test(lines[j])) return { plain: true };
    if (lines[j].includes('-->')) end = j;
  }
  if (end === -1) return { plain: true };
  for (let j = i; j <= end; j += 1) {
    if (!isPlainLine(lines[j])) return { unsupported: `a comment opened on line ${i + 1} would stay open across line ${j + 1}, which starts a construct that can end a paragraph (a list item, quote, heading, fence, thematic break, setext underline, HTML block or table) or sits in a container; the scanner cannot say exactly what is visible` };
  }
  return { end };
}
// What follows the "-->" that ends a comment BLOCK: CommonMark reads the whole line as the HTML block, but a renderer still draws what follows the
// comment. The scanner does not decide which, so a remainder that is more than further closed comments is reported instead of being hidden.
const blockTail = (rest) => (inlineScan(rest, false).text.trim() === '' ? null : 'visible text follows the "-->" that closes an HTML comment block (CommonMark reads the whole line as the block, a renderer draws the remainder); the scanner cannot say exactly what is visible');
const shapesOf = (scan) => scan.flatMap((s, i) => (s.unsupported === null ? [] : [{ line: i + 1, reason: s.unsupported }]));
/**
 * Line-by-line Markdown scan that keeps HTML comments non-operative (CommonMark: a comment block starts at a line beginning with up to
 * three spaces and "<!--" and ends with the line holding "-->", the whole line included; an inline comment opens mid-line and may close on
 * a later line of the same paragraph; inside either nothing is a heading, a fence or a sentence). Returns [{ raw, fenced, comment, single,
 * text, unsupported }]: text is the visible text (comment content removed; the raw line for a fenced line, since code is content); comment marks
 * a line of a comment block, a line wholly inside an inline comment, and the line that closes one (its text is what follows the "-->" of an
 * inline comment, which a reader sees, so signal parsing reads it); single marks a block comment that opens and closes on its own line.
 * unsupported is null, or the reason the scanner cannot say exactly what a reader sees (see commentSpan and blockTail): the shape is never
 * guessed, and callers treat the file as not evaluable. A fence delimiter inside a comment does not open a fence, and "<!--" inside a fence is
 * code. The head of a line that opens an inline comment stays visible and the line is not a comment line.
 * Why: a commented-out heading or owner decision is invisible to a reader, so it must not resolve a destination or record a decision.
 */
export function scanMarkdown(text) {
  const lines = normalizeEol(text).split('\n');
  const fenced = makeFenceStepper();
  let inBlock = false;
  let inInline = false;
  const rec = (raw, o) => ({ raw, fenced: false, comment: false, single: false, text: '', unsupported: null, ...o });
  const visible = (fragment, i) => {
    const r = inlineScan(fragment, true);
    if (!r.open) return { text: r.text, unsupported: null };
    const span = commentSpan(lines, i);
    if (span.end !== undefined) { inInline = true; return { text: r.text, unsupported: null }; }
    return { text: inlineScan(fragment, false).text, unsupported: span.unsupported ?? null };
  };
  const scan = lines.map((raw, i) => {
    if (inBlock) {
      const k = raw.indexOf('-->');
      if (k === -1) return rec(raw, { comment: true });
      inBlock = false;
      return rec(raw, { comment: true, unsupported: blockTail(raw.slice(k + 3)) });
    }
    if (inInline) {
      const k = raw.indexOf('-->');
      if (k === -1) return rec(raw, { comment: true });
      inInline = false;
      const v = visible(raw.slice(k + 3), i);
      return rec(raw, { comment: true, text: v.text, unsupported: v.unsupported });
    }
    if (fenced(raw, i)) return rec(raw, { fenced: true, text: raw });
    const m = /^ {0,3}<!--/.exec(raw);
    if (m) {
      const rest = raw.slice(m[0].length);
      const k = rest.indexOf('-->');
      if (k === -1) inBlock = true;
      return rec(raw, { comment: true, single: k !== -1, unsupported: k === -1 ? null : blockTail(rest.slice(k + 3)) });
    }
    const v = visible(raw, i);
    return rec(raw, { text: v.text, unsupported: v.unsupported });
  });
  // A fence that never closes makes CommonMark read everything after it as code, so every heading, decision and sentence below it would be inert while a
  // text-level check still sees them. The scanner does not decide which: the opener is reported and the file is not evaluable (review pass 4, N10).
  const open = fenced.openLine();
  if (open !== null) scan[open].unsupported = `a code fence opened on line ${open + 1} never closes (CommonMark reads the rest of the document as code, so what follows is not what a text-level check sees)`;
  return scan;
}
/** The unsupported comment shapes of a text: [{ line (1-based), reason }]. Empty means the scanner can say exactly what a reader sees. */
export function unsupportedShapes(text) { return shapesOf(scanMarkdown(text)); }
/**
 * The text a reader sees, one entry per line (line numbers kept): comment content removed. Fenced code is content and stays unless operative is true, which
 * also drops it (an @import or a provenance sentence inside a code block is an example, not an instruction). A check that asks "is this preserved / documented"
 * reads this, never the raw text: a line moved into an HTML comment is gone for the reader (review pass 4, N11).
 */
export const visibleLines = (text, { operative = false } = {}) => scanMarkdown(text).map((s) => (operative && s.fenced ? '' : s.text));
export const visibleText = (text, opts) => visibleLines(text, opts).join('\n');

// ------------------------------------------------------------------ headings ----
/** Section number removed (never one followed by a dash, which is a title like "03 - ..."), whitespace normalized, every other character kept. */
export function normalizeHeadingName(raw) {
  return String(raw).replace(/^\s*\d+(?:\.\d+)*\.?\s+(?![—–-])/, '').replace(/\s+/g, ' ').trim();
}
/**
 * Headings outside fenced code and HTML comments: { headings: [{ index, line, level, raw, name, parent }], lines, topLevel, unsupported }.
 * lines holds the VISIBLE text of every line (comment content removed, line numbers kept), so section text never includes a comment.
 * unsupported lists the comment shapes the scanner cannot place exactly ([{ line, reason }]); every check that reads the document reports them.
 */
export function parseHeadingDoc(text) {
  const scan = scanMarkdown(text);
  const lines = scan.map((s) => s.text);
  const headings = [];
  scan.forEach((s, i) => {
    if (s.fenced || s.comment) return;
    const m = /^(#{1,6})[ \t]+(\S.*?)[ \t]*$/.exec(s.text);
    if (m) headings.push({ index: headings.length, line: i, level: m[1].length, raw: m[2], name: normalizeHeadingName(m[2]), parent: null });
  });
  const stack = [];
  for (const h of headings) {
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) stack.pop();
    h.parent = stack.length > 0 ? stack[stack.length - 1].index : null;
    stack.push(h);
  }
  const body = headings.filter((h) => !(h.index === 0 && h.level === 1));
  return { lines, headings, topLevel: body.length > 0 ? Math.min(...body.map((h) => h.level)) : 2, unsupported: shapesOf(scan) };
}
/** ref = { name } (a top-level section) or { parent, name } (a subordinate heading inside its named parent). Never fuzzy. */
export function resolveHeading(doc, ref) {
  const want = normalizeHeadingName(ref.name);
  if (want === '') return { status: 'missing' };
  if (ref.parent === undefined) {
    const top = doc.headings.filter((h) => h.level === doc.topLevel && h.name === want);
    if (top.length === 1) return { status: 'ok', heading: top[0] };
    if (top.length > 1) return { status: 'ambiguous', candidates: top };
    const sub = doc.headings.filter((h) => h.level > doc.topLevel && h.name === want);
    return sub.length > 0 ? { status: 'needs-parent', candidates: sub } : { status: 'missing' };
  }
  const parents = doc.headings.filter((h) => h.level === doc.topLevel && h.name === normalizeHeadingName(ref.parent));
  if (parents.length === 0) return { status: 'missing', what: 'parent' };
  if (parents.length > 1) return { status: 'ambiguous', what: 'parent', candidates: parents };
  const kids = doc.headings.filter((h) => h.parent === parents[0].index && h.name === want);
  if (kids.length === 1) return { status: 'ok', heading: kids[0] };
  return kids.length > 1 ? { status: 'ambiguous', candidates: kids } : { status: 'missing' };
}
export function parseBulletRef(bullet) {
  const t = String(bullet).trim();
  const i = t.indexOf(' > ');
  return i === -1 ? { name: t } : { parent: t.slice(0, i).trim(), name: t.slice(i + 3).trim() };
}
/** The lines under a heading up to the next heading of the same or a higher level (its subsections included). */
export function sectionText(doc, h) {
  let end = doc.lines.length;
  for (const x of doc.headings) if (x.line > h.line && x.level <= h.level) { end = x.line; break; }
  return doc.lines.slice(h.line + 1, end).join('\n');
}

// -------------------------------------------- drafting-reference extraction ----
export function extractFences(text) {
  const out = [];
  let open = null;
  for (const line of normalizeEol(text).split('\n')) {
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (open === null) { if (m) open = { ch: m[1][0], n: m[1].length, info: m[2].trim(), body: [] }; continue; }
    if (m && m[1][0] === open.ch && m[1].length >= open.n && m[2].trim() === '') { out.push({ info: open.info, body: open.body.join('\n') }); open = null; } else open.body.push(line);
  }
  return out;
}
/** The pointer skeleton: the fenced block that carries the pointer marker and the bullet placeholder. null when the reference has none. */
export function extractSkeleton(refText) {
  const f = extractFences(refText).find((x) => x.body.includes(POINTER_MARKER) && x.body.includes('{{SECTION_BULLETS}}'));
  return f === undefined ? null : f.body;
}
const splitRow = (l) => (/^\s*\|.*\|\s*$/.test(l) ? l.trim().slice(1, -1).split('|').map((c) => c.trim()) : null);
const stripTicks = (c) => c.replace(/^`+|`+$/g, '').trim();
/** The pointer-directory table: Map of directory (no trailing slash) to the relative link text. null when absent. */
export function extractPathTable(refText) {
  const lines = normalizeEol(refText).split('\n');
  for (let i = 0; i + 2 < lines.length; i++) {
    const head = splitRow(lines[i]);
    if (head === null || head.length !== 2 || !/pointer directory/i.test(head[0]) || !/relative path to 03/i.test(head[1]) || !/^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) continue;
    const rows = new Map();
    for (let j = i + 2; j < lines.length; j++) {
      const cells = splitRow(lines[j]);
      if (cells === null || cells.length !== 2) break;
      rows.set(stripTicks(cells[0]).replace(/\/+$/, ''), stripTicks(cells[1]));
    }
    return rows;
  }
  return null;
}
/** Blockquote blocks of the text, each joined and whitespace-squashed. */
export function extractQuoteBlocks(text) {
  const out = [];
  let cur = null;
  for (const line of normalizeEol(text).split('\n')) {
    if (/^\s*>/.test(line)) { cur = cur === null ? [] : cur; cur.push(line.replace(/^\s*>\s?/, '')); } else if (cur !== null) { out.push(squash(cur.join(' '))); cur = null; }
  }
  if (cur !== null) out.push(squash(cur.join(' ')));
  return out;
}
export const extractRootParagraph = (refText) => extractQuoteBlocks(refText).find((b) => b.startsWith('Readers and agents MUST follow documentation pointers')) ?? null;
export const extractNavSentence = (refText) => extractQuoteBlocks(refText).find((b) => b.startsWith('Some entries below are documentation pointers')) ?? null;

// ---------------------------------------------------------- skeleton and pointers ----
function skeletonParts(skeleton) {
  const t = normalizeEol(skeleton);
  const names = [];
  const segs = [];
  let last = 0;
  for (const m of t.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)) { segs.push(t.slice(last, m.index)); names.push(m[1]); last = m.index + m[0].length; }
  segs.push(t.slice(last));
  return { segs, names };
}
/** Fills the placeholders of the extracted skeleton. bullets is an array of bullet texts without the "- " prefix. Ends with one LF. */
export function expandSkeleton(skeleton, { title, relPath, bullets, scope }) {
  const v = { TITLE: title, RELATIVE_PATH_TO_03: relPath, SECTION_BULLETS: bullets.map((b) => `- ${b}`).join('\n'), TOPIC_OR_VENDOR: scope };
  return `${normalizeEol(skeleton).replace(/\{\{([A-Z0-9_]+)\}\}/g, (all, n) => (n in v ? v[n] : all)).replace(/\n*$/, '')}\n`;
}
const segRe = (s, first, last) => {
  const toks = s.split(/\s+/).filter(Boolean).map(esc);
  const lead = !first && /^\s/.test(s) ? '\\s+' : '';
  const trail = /\s$/.test(s) ? (last ? '\\s*' : '\\s+') : '';
  return lead + toks.join('\\s+') + trail;
};
/** Matches a pointer against the extracted skeleton as a template (fixed text equal up to whitespace). { ok, fields } or { ok: false, error }. */
export function parsePointerText(text, skeleton) {
  const { segs, names } = skeletonParts(skeleton);
  if (names.length === 0) return { ok: false, error: 'the skeleton has no placeholder' };
  let src = '^\\s*';
  segs.forEach((s, i) => {
    src += segRe(s, i === 0, i === segs.length - 1);
    if (i < names.length) src += names[i] === 'SECTION_BULLETS' ? '([\\s\\S]+?)' : '([^\\n]+?)';
  });
  const m = new RegExp(`${src}\\s*$`).exec(normalizeEol(text));
  if (m === null) return { ok: false, error: 'the text is not the skeleton with its placeholders filled' };
  const fields = {};
  names.forEach((n, i) => { fields[n] = m[i + 1]; });
  fields.bullets = String(fields.SECTION_BULLETS ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  return { ok: true, fields };
}
export const isPointerText = (text) => normalizeEol(text).includes('project-setup:documentation-pointer');
// The fixed routing obligations every pointer carries when opened alone (plan section 4, the frozen skeleton clauses).
export const ROUTING_OBLIGATIONS = Object.freeze([
  ['follow-source', /Readers and agents MUST follow the source link and read the named sections before relying on or updating this topic/],
  ['navigation-only', /because this file contains navigation only/],
  ['update-source', /Readers and agents making documentation updates MUST change the source sections instead of adding factual content here/],
  ['preserve-pointer', /Preserve this pointer unless its destination changes/],
  ['writer-records-gap', /documentation-writing agents MUST record the gap in the repository-root TODO\.md within their authorized scope/],
  ['read-only-reports', /Read-only agents MUST report the gap in their output/],
  ['read-only-no-write', /MUST NOT create, modify or delete files/],
  ['other-readers', /Other readers MUST report the gap to the documentation owner/],
  ['resolve-first', /Documentation-writing agents MUST resolve the destination before changing the affected documented facts/],
  ['write-boundary', /These duties preserve each actor.s write boundary/],
]);
const FORBIDDEN_IN_POINTER = [
  ['timestamp', /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}:\d{2}(?::\d{2})?\b/],
  ['hash', /\b[0-9a-f]{32,}\b/i],
  ['table', /^\s*\|.*\|\s*$/m],
];
// The documents project-setup turns into pointers on an activated project, with the destinations plan section 3 maps each to
// (bullet form: "Heading" or "Parent > Subheading"; the actual BS 03 heading text decides the names).
export const POINTER_DOCS = Object.freeze({
  '.ai/context/project-tree.md': Object.freeze(['Module layout', 'Landmines']),
  '.ai/context/critical-modules.md': Object.freeze(['Module layout', 'Authentication and authorization', 'Database', 'Database > Money (`01` §6)', 'Cache, locks and queues', 'Outbound integrations', 'Observability', 'Observability > Retention (`02` §3)', 'Landmines']),
  '.ai/context/error-contract.md': Object.freeze(['API surface']),
  '.ai/context/configuration.md': Object.freeze(['Configuration']),
  '.ai/context/glossary.md': Object.freeze(['Domain glossary']),
  'docs/api-conventions.md': Object.freeze(['API surface', 'Authentication and authorization']),
  'docs/database.md': Object.freeze(['Database', 'Database > Schema changes', 'Database > Money (`01` §6)', 'Module layout']),
  'docs/observability.md': Object.freeze(['Observability', 'Health, shutdown, deployment']),
});
export const VENDOR_POINTER_REFS = Object.freeze(['Outbound integrations', 'Observability']);
export const FULL_DOCUMENTS = Object.freeze(['.ai/context/code-patterns.md', '.ai/context/development-rules.md', '.ai/decisions/README.md', 'TODO.md']);
export const isVendorPointerPath = (rel) => /^docs\/integrations\/[^/]+\.md$/.test(rel);
export const mappingRefsFor = (rel) => (isVendorPointerPath(rel) ? VENDOR_POINTER_REFS : (Object.prototype.hasOwnProperty.call(POINTER_DOCS, rel) ? POINTER_DOCS[rel] : null));

function linkProblem(rel, link, expected) {
  if (link === expected) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(link) || link.startsWith('/') || link.includes('\\') || /^[A-Za-z]:/.test(link)) return 'unsafe-path';
  const dir = path.posix.dirname(rel);
  const target = path.posix.normalize(path.posix.join(dir, link));
  if (target === '..' || target.startsWith('../')) return 'escape';
  if (target === BS_03_REL) return 'noncanonical-path';
  return /(^|\/)\.ai\/standards\/03-project-architecture\.md$/.test(link) ? 'wrong-depth' : 'wrong-target';
}
const vendorWords = (rel) => path.posix.basename(rel, '.md').toLowerCase().replace(/[-_]+/g, ' ');

/** Pure inspection of one pointer's text against the extracted skeleton, path table and the parsed 03. Returns findings [{ code, detail }]; empty = valid. */
export function inspectPointerText({ rel, text, skeleton, pathTable, doc03 }) {
  const f = [];
  const add = (code, detail) => f.push({ code, detail });
  const t = normalizeEol(text);
  if (skeleton === null || skeleton === undefined) { add('no-skeleton', 'the drafting reference has no extractable pointer skeleton'); return f; }
  if (t.split(POINTER_MARKER).length - 1 !== 1) add('marker', `the pointer marker must appear exactly once`);
  if (/project-setup:(?:begin|end)\b/.test(t)) add('managed-block', 'a pointer carries no managed-block markers');
  if (/\{\{[^}]*\}\}/.test(t)) add('placeholder', 'an unresolved placeholder remains');
  for (const [name, re] of ROUTING_OBLIGATIONS) if (!re.test(squash(t))) add('routing', `routing obligation missing: ${name}`);
  const parsed = parsePointerText(t, skeleton);
  if (!parsed.ok) { add('template', parsed.error); return f; }
  const { TITLE, RELATIVE_PATH_TO_03: link, TOPIC_OR_VENDOR: scope, bullets } = parsed.fields;
  if (!/\S/.test(TITLE)) add('title', 'empty title');
  if (!/\S/.test(scope)) add('scope', 'empty scope');
  for (const [name, re] of FORBIDDEN_IN_POINTER) if (re.test([TITLE, scope, ...bullets].join('\n'))) add('non-navigation', `${name} in a navigation-only document`);
  if (isVendorPointerPath(rel) && !fold(scope.toLowerCase().replace(/[-_]+/g, ' ')).includes(vendorWords(rel))) add('vendor-scope', `the scope must identify the vendor "${vendorWords(rel)}"`);
  const dir = path.posix.dirname(rel);
  const expected = pathTable === null || pathTable === undefined ? undefined : pathTable.get(dir);
  if (expected === undefined) add('unsupported-directory', `no path-table row for ${dir}`);
  else { const p = linkProblem(rel, link, expected); if (p !== null) add(p, `link "${link}" is not "${expected}"`); }
  if (bullets.length === 0) add('no-sections', 'a pointer names at least one section');
  // A heading the scanner hid by guessing could be a duplicate that makes a destination ambiguous, so a source it cannot read exactly resolves nothing.
  if (doc03 !== null && doc03 !== undefined && (doc03.unsupported ?? []).length > 0) add('unsupported-comment-shape', `the source holds a comment shape the scanner cannot place exactly (line ${doc03.unsupported[0].line}), so no heading resolves reliably`);
  const seen = new Set();
  for (const b of bullets) {
    if (!b.startsWith('- ')) { add('bullet-format', `not a bullet: ${b}`); continue; }
    const text1 = b.slice(2).trim();
    if (seen.has(text1)) add('bullet-duplicate', text1); seen.add(text1);
    if (doc03 === null || doc03 === undefined) { add('no-source', 'the source cannot be read, so no heading resolves'); break; }
    const ref = parseBulletRef(text1);
    // A pointer reproduces the NORMALIZED actual heading names: a bullet that still carries a section number (or extra whitespace)
    // would resolve today and silently depend on the numbering the next BS release changes.
    const unnormalized = [ref.parent, ref.name].filter((x) => x !== undefined && normalizeHeadingName(x) !== x);
    if (unnormalized.length > 0) add('heading-not-normalized', `${text1}: name the heading without its section number or extra whitespace`);
    const r = resolveHeading(doc03, ref);
    if (r.status === 'ok') continue;
    add(r.status === 'ambiguous' ? 'heading-ambiguous' : r.status === 'needs-parent' ? 'heading-parent-required' : 'heading-missing', text1);
  }
  const want = mappingRefsFor(rel);
  if (want !== null) for (const w of want) if (!bullets.some((b) => b.slice(2).trim() === w)) add('bullet-missing', `mapped section not listed: ${w}`);
  return f;
}

// ----------------------------------------------------------- safe file access ----
let policyCache = null;
export function shippedPolicy() {
  if (policyCache === null) policyCache = parseSecurityPolicy(fs.readFileSync(path.join(SKILL_ROOT, 'data', 'secret-paths.json'), 'utf8')).policy;
  return policyCache;
}
export const POLICY_REL = '.ai/security-paths.json';
export class PolicyError extends Error { constructor(state, detail) { super(`POLICY_${String(state).toUpperCase()}: ${detail}`); this.code = 'POLICY'; this.state = state; } }
/**
 * The effective policy of a project, from its installed policy file. The shipped defaults apply ONLY to a confirmed absence (ENOENT on the
 * file or on .ai). Everything else that is not one readable, valid, unlinked policy file is a stop, never a fallback, because a fallback
 * silently drops the project's own exclusions and widens what may be read (plan section 8, the permitted-read boundary):
 * { state: 'project' | 'default', policy } or { state: 'unreadable' | 'malformed' | 'unsafe', detail }. Links are checked BEFORE the read,
 * so a link target is never opened.
 */
export function policyStatus(root) {
  let p = root;
  const segs = POLICY_REL.split('/');
  for (let i = 0; i < segs.length; i++) {
    p = path.join(p, segs[i]);
    let st;
    try { st = fs.lstatSync(p); } catch (e) { return e.code === 'ENOENT' ? { state: 'default', policy: shippedPolicy() } : { state: 'unreadable', detail: `${POLICY_REL}: ${e.code ?? 'lstat failed'}` }; }
    if (st.isSymbolicLink()) return { state: 'unsafe', detail: `${POLICY_REL} is or sits below a symbolic link or junction` };
    // A file where a directory belongs is not an absence (Windows reports ENOENT for the child of a file, so ask instead of inferring).
    if (i < segs.length - 1 && !st.isDirectory()) return { state: 'unreadable', detail: `${segs.slice(0, i + 1).join('/')} is not a directory` };
  }
  let text;
  try { text = fs.readFileSync(path.join(root, ...POLICY_REL.split('/')), 'utf8'); } catch (e) { return { state: 'unreadable', detail: `${POLICY_REL}: ${e.code ?? 'read failed'}` }; }
  try { return { state: 'project', policy: parseSecurityPolicy(text).policy }; } catch (e) { return { state: 'malformed', detail: `${POLICY_REL}: ${e.code ?? 'invalid policy'}` }; }
}
/** The effective policy, or a thrown PolicyError (code POLICY) for anything but a project policy or a confirmed absence. */
export function policyOf(root) {
  const s = policyStatus(root);
  if (s.policy === undefined) throw new PolicyError(s.state, s.detail);
  return s.policy;
}
export const isForbiddenPath = (rel, policy = shippedPolicy()) => /(^|\/)\.env/i.test(rel) || matchesPolicyPath(rel, policy);
const validRel = (rel) => typeof rel === 'string' && rel !== '' && !rel.includes('\\') && !path.posix.isAbsolute(rel) && !/^[A-Za-z]:/.test(rel) && !path.posix.normalize(rel).split('/').includes('..') && path.posix.normalize(rel) === rel;
/** 'ok' | 'absent' | 'link' for every segment from the root down to rel. */
export function lstatChain(root, rel) {
  let p = root;
  for (const seg of rel.split('/')) {
    p = path.join(p, seg);
    let st;
    try { st = fs.lstatSync(p); } catch (e) { return e.code === 'ENOENT' || e.code === 'ENOTDIR' ? 'absent' : 'link'; }
    if (st.isSymbolicLink()) return 'link';
  }
  return 'ok';
}
/**
 * Reads one permitted file. { state: 'ok'|'absent'|'denied'|'unsafe'|'unreadable'|'policy', text? }. Records the read in reads when given.
 * state 'policy' = the project's installed policy could not be established (unreadable, malformed or linked): no file is read.
 */
export function readPermitted(root, rel, { policy = null, reads = null } = {}) {
  if (!validRel(rel)) return { state: 'unsafe' };
  if (policy === null) { const s = policyStatus(root); if (s.policy === undefined) return { state: 'policy', detail: `${s.state}: ${s.detail}` }; policy = s.policy; }
  if (isForbiddenPath(rel, policy)) return { state: 'denied' };
  const c = lstatChain(root, rel);
  if (c === 'link') return { state: 'unsafe' };
  if (c === 'absent') return { state: 'absent' };
  try { const text = fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8'); if (reads !== null) reads.push(rel); return { state: 'ok', text }; } catch { return { state: 'unreadable' }; }
}
/**
 * Inspects one pointer file of a project: containment, links, forbidden paths, the 03 source and the pure checks. { findings, reads }. readFile, when given, replaces the
 * permitted read of a file ((rel) => { state, text? } with the states of readPermitted): a verification passes the bytes its snapshot captured, so the pointer and its
 * source are judged on the same bytes as every other check and a failed read is recorded where the verification can make it not evaluable (review pass 5, N15).
 */
export function inspectPointerFile(root, rel, { skeleton, pathTable, policy = null, readFile = null }) {
  const reads = [];
  const findings = [];
  if (policy === null) { const s = policyStatus(root); if (s.policy === undefined) return { findings: [{ code: 'policy', detail: `${s.state}: ${s.detail}` }], reads }; policy = s.policy; }
  const readOne = (x, o) => (readFile === null ? readPermitted(root, x, o) : readFile(x));
  const first = readOne(rel, { policy, reads });
  if (first.state !== 'ok') return { findings: [{ code: first.state === 'denied' ? 'forbidden' : first.state === 'unsafe' ? (validRel(rel) ? 'link' : 'escape') : 'missing-pointer', detail: rel }], reads };
  const dir = path.posix.dirname(rel);
  const link = (/\]\(([^)\s]+)\)/.exec(first.text.split(/Source of truth:/)[1] ?? '') ?? [])[1];
  let doc03 = null;
  if (link !== undefined && !/^[a-z][a-z0-9+.-]*:/i.test(link) && !link.startsWith('/') && !link.includes('\\')) {
    const target = path.posix.normalize(path.posix.join(dir, link));
    if (target === '..' || target.startsWith('../')) findings.push({ code: 'escape', detail: link });
    else if (isForbiddenPath(target, policy)) findings.push({ code: 'forbidden', detail: `the link resolves to a policy-denied path: ${target}` });
    else if (target === BS_03_REL) {
      const s = readOne(target, { policy, reads });
      if (s.state === 'ok') doc03 = parseHeadingDoc(s.text);
      else findings.push({ code: s.state === 'unsafe' ? 'link' : 'missing-source', detail: `${target}: ${s.state}` });
    }
  }
  return { findings: [...findings, ...inspectPointerText({ rel, text: first.text, skeleton, pathTable, doc03 })], reads };
}

// ------------------------------------------------------------- layout detection ----
const FAILED = new Set(['unreadable', 'denied', 'unsafe', 'policy']);
/**
 * Exact owner-decision records of a root AGENTS.md: outside fenced code, HTML comments and managed blocks, one standalone line, exact text.
 * Managed blocks are the ones production reads (parseBlocks in scripts/blocks.mjs, the code that decides what PS may rewrite): its markers are
 * matched on every line outside a fence, inside an HTML comment too and in the hash style as well, so a decision between them is inside the
 * block however a Markdown renderer would draw the comment. When parseBlocks reports marker errors, PS refuses to edit the file and the block
 * boundaries are unknown, so no decision is counted (fail closed: it is ignored with that reason and the errors are returned as markerErrors).
 * unsupported lists the comment shapes the scanner cannot place exactly ([{ line, reason }]): a decision or a conflicting record that a reader sees may
 * sit behind one, so classifyLayout holds instead of activating when it is not empty.
 * Why: a decision inside a managed block is overwritten by the next run, and counting one that production places there would activate on a record that is about to vanish.
 */
export function findDecisionRecords(text) {
  const parsed = parseBlocks(text);
  const scan = scanMarkdown(text);
  const out = { exact: 0, conflicting: [], ignored: [], markerErrors: parsed.errors, unsupported: shapesOf(scan) };
  const blockAt = (i) => parsed.blocks.find((b) => i > b.startLine && i < b.endLine);
  scan.forEach((s, i) => {
    const raw = s.raw;
    if (s.fenced) { if (raw.includes(DECISION_PREFIX)) out.ignored.push({ line: raw, reason: 'fenced example' }); return; }
    if (s.comment) { if (raw.includes(DECISION_PREFIX)) out.ignored.push({ line: raw, reason: 'inside an HTML comment' }); return; }
    if (!raw.includes(DECISION_PREFIX)) return;
    if (!s.text.includes(DECISION_PREFIX)) { out.ignored.push({ line: raw, reason: 'inside an HTML comment' }); return; }
    const block = blockAt(i);
    if (block !== undefined) { out.ignored.push({ line: raw, reason: `inside managed block ${block.id}` }); return; }
    if (parsed.errors.length > 0) { out.ignored.push({ line: raw, reason: 'managed-block markers are broken, so it cannot be placed outside every block' }); return; }
    if (raw === DECISION_SENTENCE) out.exact += 1;
    else if (raw.startsWith(DECISION_PREFIX)) out.conflicting.push(raw);
    else out.ignored.push({ line: raw, reason: 'quoted, nested or approximate' });
  });
  return out;
}
// The signal parsers read the VISIBLE text of every line outside fenced code (s.text): a comment line has none, and the visible remainder after the
// "-->" that closes an inline comment is read like any other text (it is on the page, so a provenance sentence or an import there is a signal).
const importLines = (text) => { const out = []; for (const s of scanMarkdown(text)) { if (s.fenced) continue; for (const m of s.text.replace(/`[^`]*`/g, '').matchAll(/(?:^|\s)@(\S+)/g)) out.push(m[1].replace(/^\.\//, '')); } return out; };
/** The BS CLAUDE.md signals: provenance sentences with their versions and the imports of 03 (neither inside fenced code nor an HTML comment), and the unsupported comment shapes of the file. */
export function parseClaudeSignals(text) {
  const sentences = [];
  const scan = scanMarkdown(text);
  for (const s of scan) {
    if (s.fenced) continue;
    const m = /Applied from the `backend-standards` skill, version `([^`]*)`\./.exec(s.text);
    if (m) sentences.push(SEMVER.test(m[1]) ? m[1] : null);
  }
  const imports = importLines(text);
  return { sentences, imports03: imports.includes(BS_03_REL), otherArchImports: imports.filter((i) => /(^|\/)03-project-architecture\.md$/.test(i) && i !== BS_03_REL), unsupported: shapesOf(scan) };
}
export function parseStamp(text) {
  let j;
  try { j = JSON.parse(text); } catch { return { state: 'malformed' }; }
  if (j === null || typeof j !== 'object' || Array.isArray(j) || typeof j.appliedBy !== 'string' || typeof j.version !== 'string' || !SEMVER.test(j.version)) return { state: 'malformed' };
  return j.appliedBy === 'backend-standards' ? { state: 'valid', appliedBy: j.appliedBy, version: j.version } : { state: 'conflicting', appliedBy: j.appliedBy, version: j.version };
}
/**
 * Reads the layout signals of a project through permitted reads only. When the project's policy cannot be established, every read reports
 * state 'policy' (a failed read), no project file is read and no directory is listed, so the classification holds or stops instead of
 * treating the signals as absent. readFile, when given, replaces the permitted read ((rel) => { state, text? }): a verification passes the bytes its snapshot captured.
 * The listing of the pointer directories is no exception to "a failed read is not absence" (review pass 5, N16): only a confirmed absence (ENOENT, ENOTDIR) of a
 * directory is an empty listing, any other listing error propagates, and a listed file that cannot be read (anything but ok or policy-denied, which is a deliberate
 * skip) throws, because a pointer that could not be read may be the one that decides between "preserve" and "ordinary".
 */
export function collectSignals(root, { reads = null, ownerDisposition = null, readFile = null } = {}) {
  const ps = policyStatus(root);
  const rd = (rel) => (ps.policy === undefined ? { state: 'policy', detail: `${ps.state}: ${ps.detail}` } : readFile === null ? readPermitted(root, rel, { policy: ps.policy, reads }) : readFile(rel));
  const s = { stamp: { state: 'absent' }, claude: { state: 'absent', sentences: [], imports03: false, otherArchImports: [] }, agents: { state: 'absent', decision: { exact: 0, conflicting: [] } }, standards03: { state: 'absent' }, pointersInstalled: false, ownerDisposition };
  const a = rd(STAMP_REL);
  s.stamp = a.state === 'ok' ? parseStamp(a.text) : { state: a.state };
  const c = rd('CLAUDE.md');
  s.claude = c.state === 'ok' ? { state: 'ok', ...parseClaudeSignals(c.text) } : { ...s.claude, state: c.state };
  const g = rd('AGENTS.md');
  s.agents = g.state === 'ok' ? { state: 'ok', decision: findDecisionRecords(g.text) } : { ...s.agents, state: g.state };
  const d = rd(BS_03_REL);
  s.standards03 = { state: d.state === 'ok' ? 'readable' : d.state };
  for (const dir of ps.policy === undefined ? [] : ['.ai/context', 'docs', 'docs/integrations']) {
    let names = [];
    try { names = fs.readdirSync(path.join(root, ...dir.split('/')), { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => `${dir}/${e.name}`); } catch (e) { if (!ABSENT_CODES.includes(e.code)) throw e; }
    for (const rel of names) {
      const r = rd(rel);
      if (r.state === 'ok') { if (isPointerText(r.text)) s.pointersInstalled = true; } else if (r.state !== 'denied') throw Object.assign(new Error(`${rel} could not be read (${r.state}): the layout signals would be incomplete`), { code: 'UNREADABLE' });
    }
  }
  return s;
}
/**
 * The activation decision of plan section 2 (D1, with the Q1 disposition accepted). Treatments:
 * activate (pointers, no competing full documents), owner-disposition (03 alone: ask, generate no competing full document),
 * hold (conflict, malformed or unreadable signal: no activation, no generation of the affected documents), stop (03 itself unreadable),
 * ordinary (existing PS rules, full documents), preserve (pointers installed but no accepted signal: keep them, report the inconsistency).
 */
export function classifyLayout(sig) {
  const out = (treatment, reason, accepted = []) => ({ treatment, reason, accepted, fullDocuments: treatment === 'ordinary' });
  if (FAILED.has(sig.standards03.state)) return out('stop', '03 is protected, unsafe or unreadable, or the project policy could not be established');
  for (const k of ['stamp', 'claude', 'agents']) if (FAILED.has(sig[k].state)) return out('hold', `${k} signal failed to read: a failed read does not establish absence`);
  // A comment shape the scanner cannot place exactly may hide a visible conflicting sentence, import or decision, so the signals it read are not
  // evidence of absence: hold, never activate.
  const unplaced = [['CLAUDE.md', sig.claude.unsupported], ['AGENTS.md', sig.agents.decision?.unsupported]].filter(([, u]) => (u ?? []).length > 0).map(([f]) => f);
  if (unplaced.length > 0) return out('hold', `unsupported comment shape in ${unplaced.join(' and ')}: the scanner cannot say what a reader sees, so the signals there are not evaluable`);
  if (sig.stamp.state === 'malformed') return out('hold', 'malformed stamp');
  if (sig.stamp.state === 'conflicting') return out('hold', 'stamp appliedBy conflicts');
  const sentences = sig.claude.sentences ?? [];
  if (sentences.length > 1) return out('hold', 'conflicting or ambiguous provenance sentences');
  if (sentences.length === 1 && sentences[0] === null) return out('hold', 'provenance sentence without a concrete version');
  if (sig.stamp.state === 'valid' && sentences.length === 1 && sentences[0] !== sig.stamp.version) return out('hold', 'contradictory versions');
  if (sentences.length === 1 && !sig.claude.imports03) return out('hold', 'inconsistent import: the provenance sentence has no import of this 03');
  if ((sig.claude.otherArchImports ?? []).length > 0) return out('hold', 'inconsistent import: another architecture document is imported');
  const dec = sig.agents.decision;
  if (dec.exact > 1) return out('hold', 'duplicated decision records');
  if (dec.conflicting.length > 0) return out('hold', 'conflicting decision record');
  const stampOk = sig.stamp.state === 'valid';
  const sentenceOk = sentences.length === 1 && sig.claude.imports03;
  const decisionOk = dec.exact === 1;
  const accepted = [stampOk ? 'stamp' : null, sentenceOk ? 'claude-sentence' : null, decisionOk ? 'owner-decision' : null].filter(Boolean);
  const bs = stampOk || sentenceOk;
  if (sig.standards03.state === 'absent') {
    if (bs) return out('hold', 'recognized backend-standards provenance but 03 is absent: incomplete BS documentation', accepted);
    if (decisionOk) return out('hold', 'owner decision recorded but 03 is absent', accepted);
    return sig.pointersInstalled ? out('preserve', 'pointers installed, no accepted signal and no 03') : out('ordinary', 'no accepted signal');
  }
  if (accepted.length > 0) return out('activate', `accepted: ${accepted.join(', ')}`, accepted);
  if (sig.pointersInstalled) return out('preserve', 'pointers installed but no accepted signal remains');
  if (sig.ownerDisposition === 'unrelated') return out('ordinary', 'owner confirmed an unrelated 03: no conversion, no ownership claim');
  return out('owner-disposition', '03 alone: ambiguous, request a concrete disposition');
}

// ------------------------------------------------- BS outcome and PS recovery ----
const ownImport = (text) => importLines(text).includes('AGENTS.md');
const claudeBlock = (text) => { const p = parseBlocks(text); return p.errors.length === 0 ? p.blocks.filter((b) => b.id === 'claude') : null; };
/** Classifies what an unchanged BS run left in one file, from the observed before and after (texts or null). Never a prediction. */
export function classifyBsOutcome(file, before, after) {
  if (after === null || after === undefined) return { outcome: before === null || before === undefined ? 'unchanged' : 'removed', evidence: {} };
  if (before !== null && before !== undefined && sha256(before) === sha256(after)) return { outcome: 'unchanged', evidence: {} };
  if (file === 'CLAUDE.md') {
    const blk = claudeBlock(after);
    const sig = parseClaudeSignals(after);
    if (sig.unsupported.length > 0) return { outcome: 'not-evaluable', evidence: { unsupported: sig.unsupported } };
    const e = { psImport: ownImport(after), psBlock: blk !== null && blk.length === 1, bsImport: sig.imports03 || importLines(after).some((i) => i.startsWith('.ai/standards/')), bsVersion: sig.sentences.length > 0 };
    const bs = e.bsImport || e.bsVersion;
    if (e.psImport && e.psBlock && bs) return { outcome: 'merge', evidence: e };
    if (!e.psImport && !e.psBlock && bs) return { outcome: 'overwrite', evidence: e };
    return { outcome: 'other', evidence: e };
  }
  const name = path.posix.basename(file, '.md');
  const refs = new RegExp(`\\.ai/agents/${esc(name)}\\.md`).test(after);
  const hadRef = before !== null && before !== undefined && new RegExp(`\\.ai/agents/${esc(name)}\\.md`).test(before);
  const e = { referencesCanonical: refs, hadCanonicalReference: hadRef };
  if (!refs && hadRef) return { outcome: 'overwrite', evidence: e };
  if (refs && hadRef) return { outcome: 'merge', evidence: e };
  return { outcome: 'other', evidence: e };
}
/** Findings for a root CLAUDE.md after PS recovery (plan section 5 table, first row): one import, one valid current claude block, BS lines and user text kept. */
export function checkClaudeRecovery({ text, templateText, bsImports = [], bsVersionSentence = null, userLines = [] }) {
  const f = [];
  const add = (code, detail) => f.push({ code, detail });
  const shapes = unsupportedShapes(text);
  if (shapes.length > 0) add('unsupported-comment-shape', `line ${shapes[0].line}: ${shapes[0].reason}`);
  const imports = importLines(text).filter((i) => i === 'AGENTS.md');
  if (imports.length !== 1) add('import-count', `expected exactly one sibling @AGENTS.md import, found ${imports.length}`);
  const parsed = parseBlocks(text);
  if (parsed.errors.length > 0) add('marker-error', parsed.errors.join('; '));
  const blocks = parsed.errors.length === 0 ? parsed.blocks.filter((b) => b.id === 'claude') : [];
  if (blocks.length !== 1) add('claude-block-count', `expected exactly one managed claude block, found ${blocks.length}`);
  else {
    const want = parseBlocks(templateText).blocks.find((b) => b.id === 'claude');
    if (want === undefined || normalizeEol(blocks[0].inner) !== normalizeEol(want.inner)) add('claude-block-content', 'the managed claude block is not the current source-template content (root-start rule included)');
  }
  // Preservation is judged on what a reader sees (N11): an import or a sentence moved into an HTML comment (or into a code block, for an import and the
  // provenance sentence) is no longer operative, and the user's own lines count only where they still show.
  const operative = visibleLines(text, { operative: true });
  const operativeText = operative.join('\n');
  const shown = visibleText(text);
  for (const i of bsImports) { const n = operative.filter((l) => l.trim() === i).length; if (n === 0) add('bs-import-lost', i); else if (n > 1) add('bs-import-duplicated', i); }
  if (bsVersionSentence !== null && !operativeText.includes(bsVersionSentence)) add('bs-version-lost', bsVersionSentence);
  for (const l of userLines) if (!shown.includes(l)) add('user-content-lost', l);
  // A "must not be there" check keeps reading the RAW text: a commented copy of the rule is reported (over-reporting is the safe direction). Known limitation.
  if ((normalizeEol(text).match(/You MUST start Claude Code at this repository's root/g) ?? []).length > 1) add('duplicate-instructions', 'the root-start rule appears more than once (raw text, a commented copy included)');
  return f;
}
/** Findings for one Claude agent file after PS: disposition take-new | keep | merge, judged on its own (never from the other agent's choice). */
export function checkAgentRecovery({ name, disposition, text, shippedWrapper, retainedBytes = null, approvedBytes = null, report = {} }) {
  const f = [];
  const add = (code, detail) => f.push({ code, detail });
  const rel = `.claude/agents/${name}.md`;
  if (disposition === 'take-new') {
    if (text !== shippedWrapper) add('wrapper-not-canonical', `${rel} is not the exact shipped wrapper`);
    if (report.incomplete === true) add('status', 'a take-new result must not be reported incomplete');
  } else if (disposition === 'keep' || disposition === 'merge') {
    const want = disposition === 'keep' ? retainedBytes : approvedBytes;
    if (want === null || text !== want) add('bytes', `${rel} must hold exactly the ${disposition === 'keep' ? 'retained' : 'approved merged'} bytes`);
    if (report.incomplete !== true) add('status', 'a kept or custom-merged agent must be reported as an incomplete PS agent layer');
    if (report.invokedDefinition !== rel) add('invoked-definition', `the report must identify the definition actually invoked (${rel})`);
  } else add('disposition', `unknown disposition ${String(disposition)}`);
  return f;
}
/** The project-extension rule: no extension invented, existing bytes kept, only the approved text appended (one EOL added when the file lacked one). */
export function checkExtension({ before, after, approvedAppend = null }) {
  const f = [];
  if (before === null || before === undefined) {
    if (approvedAppend === null) { if (after !== null && after !== undefined) f.push({ code: 'invented', detail: 'an extension was created without approved content' }); return f; }
    if (after !== approvedAppend) f.push({ code: 'bytes', detail: 'a newly approved extension must hold exactly the approved text' });
    return f;
  }
  if (after === null || after === undefined) return [{ code: 'removed', detail: 'an existing extension was removed' }];
  const eol = before.includes('\r\n') ? '\r\n' : '\n';
  const base = before === '' || before.endsWith('\n') ? before : `${before}${eol}`;
  const want = approvedAppend === null ? before : `${base}${approvedAppend}`;
  if (after !== want) f.push({ code: 'bytes', detail: approvedAppend === null ? 'existing extension bytes must be preserved' : 'only the exact approved text may be appended to existing bytes' });
  return f;
}

// ------------------------------------------------- consolidation and blank sections ----
/**
 * inventory: independently enumerated facts [{ id, doc, token, ref, kind, fullDocument?, conflict?: { stale, current } }]. ref is a bullet-form destination
 * ("Database > Schema changes"); kind is "invariant" or any other label. Findings for omissions, wrong sections, an invariant moved only to TODO,
 * copied facts in a pointer, and conflicts without a disposition. Semantic quality (did the agent find every fact) remains live review.
 */
export function checkConsolidation({ doc03Text, inventory, dispositions = {}, todoText = '', pointers = {}, fullDocuments = {} }) {
  const f = [];
  const add = (code, id, detail) => f.push({ code, id, detail });
  const doc = parseHeadingDoc(doc03Text);
  // A stale value that a reader sees but the scanner hid by guessing would pass the stale-value check, the one check that over-hiding does not fail closed.
  if (doc.unsupported.length > 0) add('unsupported-comment-shape', 'doc03', `line ${doc.unsupported[0].line}: ${doc.unsupported[0].reason}`);
  const in03 = squash(doc.lines.join('\n')); // the VISIBLE text of 03: a fact hidden in an HTML comment is not documented
  // The same rule for every other place a fact may be placed (N11): a full document or TODO.md documents a fact only where a reader sees it, so an invariant
  // that survives only inside an HTML comment of a declared full document is omitted, not consolidated. A shape the scanner cannot place exactly is reported.
  for (const [rel, t] of [...Object.entries(fullDocuments), ['TODO.md', todoText]]) { const s = unsupportedShapes(t); if (s.length > 0) add('unsupported-comment-shape', rel, `line ${s[0].line}: ${s[0].reason}`); }
  const todo = squash(visibleText(todoText));
  const dispositionOf = (id) => ownOf(dispositions, id); // an id such as "constructor" must not find Object.prototype's property
  for (const fact of inventory) {
    const tok = squash(fact.token);
    if (fact.conflict !== undefined) {
      if (dispositionOf(fact.id) === undefined) add('conflict-no-disposition', fact.id, 'a contradiction needs an explicit disposition');
      if (in03.includes(squash(fact.conflict.stale))) add('stale-value-retained', fact.id, 'the contradicted value still stands in 03 (alone or beside the approved one)');
      if (!in03.includes(squash(fact.conflict.current))) add('conflict-unresolved', fact.id, 'the approved value is absent from 03');
    }
    let placed = false;
    if (fact.fullDocument !== undefined) placed = squash(visibleText(ownOf(fullDocuments, fact.fullDocument) ?? '')).includes(tok);
    else {
      const r = resolveHeading(doc, parseBulletRef(fact.ref));
      if (r.status !== 'ok') add('destination-missing', fact.id, `${fact.ref}: ${r.status}`);
      else if (squash(sectionText(doc, r.heading)).includes(tok)) placed = true;
      else if (in03.includes(tok)) add('wrong-section', fact.id, `present in 03 but not under ${fact.ref}`);
    }
    if (placed) continue;
    if (todo.includes(tok)) { if (fact.kind === 'invariant') add('invariant-only-in-todo', fact.id, 'a known invariant must not move solely into TODO'); else if (dispositionOf(fact.id) !== 'todo') add('todo-without-disposition', fact.id, 'an unresolved item needs the explicit todo disposition'); } else if (!f.some((x) => x.id === fact.id && (x.code === 'wrong-section' || x.code === 'destination-missing'))) add('omitted', fact.id, 'the fact is in no mapped section, full document or TODO item');
  }
  for (const [rel, text] of Object.entries(pointers)) for (const fact of inventory) if (squash(text).includes(squash(fact.token))) add('copied-into-pointer', fact.id, `${rel} must contain navigation only`);
  return f;
}
/** Mapped sections that still hold a template blank (a backticked <...> placeholder) without an explicit unknown. */
export function checkBlankSections({ doc03Text, refs }) {
  const doc = parseHeadingDoc(doc03Text);
  const f = [];
  // A template blank hidden by a guess would not be found, so a document the scanner cannot read exactly has no verified sections.
  if (doc.unsupported.length > 0) f.push({ code: 'unsupported-comment-shape', detail: `line ${doc.unsupported[0].line}: ${doc.unsupported[0].reason}` });
  for (const ref of refs) {
    const r = resolveHeading(doc, parseBulletRef(ref));
    if (r.status !== 'ok') { f.push({ code: 'destination-missing', detail: ref }); continue; }
    for (const line of sectionText(doc, r.heading).split('\n')) if (/`<[^`\n>]+>`/.test(line) && !/\b(unknown|not determined|not verified)\b/i.test(line)) { f.push({ code: 'blank-section', detail: `${ref}: ${squash(line).slice(0, 80)}` }); break; }
  }
  return f;
}

// ------------------------------------------------------- root and local instructions ----
const topBullets = (inner) => { const out = []; let cur = null; for (const l of normalizeEol(inner).split('\n')) { if (/^- /.test(l)) { if (cur !== null) out.push(cur); cur = l; } else if (cur !== null && /^\s+\S/.test(l)) cur += ` ${l.trim()}`; else if (cur !== null) { out.push(cur); cur = null; } } if (cur !== null) out.push(cur); return out.map(squash); };
/** Root AGENTS.md checks: conditional routing only when activated, the template critical rules kept, summaries present, paired local files, unrelated text. */
export function checkRootInstructions({ agentsText, activated, paragraph, navSentence, templateAgentsText, nested = [], unrelatedLines = [] }) {
  const f = [];
  const add = (code, detail) => f.push({ code, detail });
  const p = parseBlocks(agentsText);
  if (p.errors.length > 0) { add('marker-error', p.errors.join('; ')); return f; }
  const blk = (id) => p.blocks.find((b) => b.id === id);
  const cr = blk('critical-rules');
  const nav = blk('navigation');
  // Raw text answers only the "must NOT be there" questions below (a commented copy is over-reported, the safe direction; a known limitation). Everything
  // that asks "is it still there" reads what a reader sees (N11): a rule, routing paragraph or summary moved into an HTML comment is gone for the reader.
  const all = squash(agentsText);
  const seen = (s) => squash(visibleText(s));
  if (activated) {
    if (cr === undefined || paragraph === null || !seen(cr.inner).includes(paragraph)) add('routing-paragraph-missing', 'the activated critical-rules block must carry the conditional routing paragraph');
    if (nav === undefined || navSentence === null || !seen(nav.inner).includes(navSentence)) add('navigation-sentence-missing', 'the activated navigation block must carry the pointer sentence');
  } else {
    if (paragraph !== null && all.includes(paragraph)) add('routing-without-activation', 'a non-activated project must not receive the routing paragraph');
    if (navSentence !== null && all.includes(navSentence)) add('navigation-without-activation', 'a non-activated project must not receive the pointer sentence');
  }
  if (cr === undefined) add('critical-rules-missing', 'no critical-rules block');
  else {
    const tcr = parseBlocks(templateAgentsText).blocks.find((b) => b.id === 'critical-rules');
    const have = seen(cr.inner);
    const crVisible = visibleText(cr.inner);
    for (const b of tcr === undefined ? [] : topBullets(tcr.inner)) if (!/\{\{/.test(b) && !have.includes(b)) add('critical-rule-lost', b.slice(0, 70));
    if (!/\.ai\/context\/critical-modules\.md/.test(crVisible)) add('critical-modules-reference', 'the money and auth rule must keep its reference to .ai/context/critical-modules.md');
    if (!/Database changes follow the project's own policy:\s*\S/.test(crVisible)) add('db-policy-missing', 'the instruction-summary exception keeps the database-change policy in the critical rules');
  }
  for (const id of ['overview', 'commands']) if (blk(id) === undefined || !/\S/.test(visibleText(blk(id).inner))) add('summary-missing', `the ${id} summary block is part of the instruction role`);
  for (const n of nested) { if (typeof n.agents !== 'string' || typeof n.claude !== 'string') add('pair-missing', `${n.dir}: both members of the pair must exist`); else if (!importLines(n.claude).includes('AGENTS.md')) add('pair-import', `${n.dir}: CLAUDE.md must import @AGENTS.md`); }
  const shownAgents = visibleText(agentsText);
  for (const l of unrelatedLines) if (!shownAgents.includes(l)) add('unrelated-text-lost', l);
  return f;
}

// ------------------------------------------------------------------- snapshots ----
export const SNAPSHOT_FILES = Object.freeze(['AGENTS.md', 'CLAUDE.md', 'TODO.md', STAMP_REL, '.toolchain-config.json', '.ai/manifest.json', '.ai/security-paths.json', '.claude/settings.json']);
export const SNAPSHOT_DIRS = Object.freeze(['.ai/agents', '.ai/context', '.ai/decisions', '.ai/standards', '.ai/tools', '.claude/agents', '.codex/agents', 'docs']);
const SNAPSHOT_NESTED_ROOT = 'src';
// The two extension rules of the walk, named once: captureProject walks with them and inInventory answers "was this path ever collected" with them.
const acceptInventory = (n) => /\.(md|json|toml|mjs)$/i.test(n);
const acceptNested = (n) => n === 'AGENTS.md' || n === 'CLAUDE.md';
// The one skipped-list reason that does NOT make a path unavailable: the file is in files (hashed, and its text is held in memory), only its text is not stored in the snapshot.
const NOT_STORED = 'secret-shaped text not stored';
const SECRET_SHAPED = [/\b(AKIA|ASIA)[0-9A-Z]{16}\b/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, /[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@<>]{3,}@/i, /PROJECT_SETUP_CANARY_[0-9a-f]{24}/];
export class UnsafeLinkError extends Error { constructor(rel) { super(`UNSAFE_LINK: ${rel} is or sits below a symbolic link or junction`); this.code = 'UNSAFE_LINK'; } }
const inventoryError = (rel, what, e) => Object.assign(new Error(`${rel} could not be ${what} while taking the snapshot (${e.code ?? 'failed'}): the inventory would be incomplete`), { code: e.code ?? 'UNREADABLE' });
const keepsText = (rel) => rel === 'AGENTS.md' || rel === 'CLAUDE.md' || rel.startsWith('.claude/agents/') || rel.startsWith('.ai/agents/') || /\/(AGENTS|CLAUDE)\.md$/.test(rel);
function walkInventory(root, dirRel, accept, out, skipped, policy) {
  const abs = path.join(root, ...dirRel.split('/'));
  let st;
  // Only a confirmed absence is skipped. An inspection that failed for any other reason (EACCES, EPERM, EIO, ELOOP...) leaves the inventory incomplete, and an
  // incomplete inventory read as a complete one is a clean result nobody earned: the error propagates (the snapshot command fails, a verification is not evaluable).
  // The error names the path (a path in a reason is how the maintainer finds what was unavailable) and keeps the code of the failure.
  try { st = fs.lstatSync(abs); } catch (e) { if (ABSENT_CODES.includes(e.code)) return; throw inventoryError(dirRel, 'inspected', e); }
  if (st.isSymbolicLink()) throw new UnsafeLinkError(dirRel);
  if (!st.isDirectory()) return;
  let entries;
  try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch (e) { throw inventoryError(dirRel, 'listed', e); }
  for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const rel = `${dirRel}/${e.name}`;
    if (e.name === 'node_modules' || e.name === '.git') continue;
    if (e.isSymbolicLink()) throw new UnsafeLinkError(rel);
    if (/^\.env/i.test(e.name) || isForbiddenPath(rel, policy)) { skipped.push({ path: rel, reason: 'policy-denied' }); continue; }
    if (e.isDirectory()) walkInventory(root, rel, accept, out, skipped, policy);
    else if (e.isFile() && accept(e.name)) out.push(rel);
  }
}
export const MANIFEST_REL = '.ai/manifest.json';
/**
 * The per-file ownership the manifest records, as { state, ownership? }: 'absent' (no manifest), 'valid' (ownership maps each recorded path to its
 * ownership string, or null when a record has none), 'malformed' (present but not a manifest with a files object) or 'skipped' (policy-denied).
 * It is the only manifest content a snapshot keeps, so a later check can tell an ownership record that already existed from a new claim.
 */
export function summarizeManifest(text) {
  if (text === null || text === undefined) return { state: 'absent' };
  let j;
  try { j = JSON.parse(text); } catch { return { state: 'malformed' }; }
  if (j === null || typeof j !== 'object' || Array.isArray(j) || j.files === null || typeof j.files !== 'object' || Array.isArray(j.files)) return { state: 'malformed' };
  return { state: 'valid', ownership: Object.fromEntries(Object.entries(j.files).map(([rel, rec]) => [rel, rec !== null && typeof rec === 'object' && typeof rec.ownership === 'string' ? rec.ownership : null])) };
}
/** An explicit-inventory snapshot of a project: hashes, sizes, the manifest ownership summary and, for instruction and agent files only, text. Throws UnsafeLinkError on any link and PolicyError when the project policy cannot be established. */
export function takeSnapshot(root) { return captureProject(root).snap; }
/**
 * The one pass over a project's explicit inventory: { snap, texts }. texts maps every inventory file to the text that was read for its hash, so a verification
 * judges the bytes the snapshot recorded and never rereads a file it already holds (a reread can fail or differ, and a failed reread must not read as "nothing
 * there": review pass 5, N15). texts stays in memory; only snap is ever written to disk.
 */
function captureProject(root, policy = policyOf(root)) {
  const rels = [];
  const skipped = [];
  const texts = new Map();
  for (const rel of SNAPSHOT_FILES) {
    const c = lstatChain(root, rel);
    if (c === 'link') throw new UnsafeLinkError(rel);
    if (c === 'ok') { if (isForbiddenPath(rel, policy)) skipped.push({ path: rel, reason: 'policy-denied' }); else rels.push(rel); }
  }
  for (const d of SNAPSHOT_DIRS) walkInventory(root, d, acceptInventory, rels, skipped, policy);
  walkInventory(root, SNAPSHOT_NESTED_ROOT, acceptNested, rels, skipped, policy);
  const files = {};
  let manifest = skipped.some((s) => s.path === MANIFEST_REL) ? { state: 'skipped' } : { state: 'absent' };
  for (const rel of [...new Set(rels)].sort()) {
    if (lstatChain(root, rel) === 'link') throw new UnsafeLinkError(rel);
    let buf;
    try { buf = fs.readFileSync(path.join(root, ...rel.split('/'))); } catch (e) { throw inventoryError(rel, 'read', e); }
    const text = buf.toString('utf8');
    texts.set(rel, text);
    const rec = { sha256: sha256(buf), bytes: buf.length, lines: lineCount(text) };
    if (keepsText(rel)) { if (SECRET_SHAPED.some((re) => re.test(text))) skipped.push({ path: rel, reason: NOT_STORED }); else rec.text = text; }
    if (rel === MANIFEST_REL) manifest = summarizeManifest(text);
    files[rel] = rec;
  }
  const snap = { schema: 1, tool: 'bs-doc-map', files, manifest, skipped: skipped.sort((a, b) => (a.path < b.path ? -1 : 1)) };
  if (files[BS_03_REL] !== undefined) snap.size03 = { bytes: files[BS_03_REL].bytes, lines: files[BS_03_REL].lines };
  return { snap, texts };
}
export const snapshotJson = (snap) => `${JSON.stringify(snap, null, 2)}\n`;

// ------------------------------------------------------------------ path states ----
// THE RULE (review pass 5b, N18 and N19; the advisor's decision after five passes that each found one more "evidence unavailable -> clean outcome"): every path a check
// consults has an explicit state on each side the check uses, and only a CONFIRMED absence is absence.
//   present      the snapshot holds a record of it (or, for a current file outside the inventory, the permitted read returned it),
//   absent       confirmed: ENOENT/ENOTDIR on the read of it, or the path lies INSIDE the covered inventory, the walk saw no file there and nothing skipped covers it,
//   unavailable  everything else: skipped (policy-denied, or an unknown reason), covered by a skipped directory, unreadable, unsafe, outside the covered inventory,
//                no usable skipped list to prove coverage, or no text where the bytes are needed.
// An unavailable state on any consulted path makes the verification not evaluable, with a reason naming the path, the side (baseline | current) and the state.
// A state is never resolved by reading the path: a skipped path stays unread, and the read boundary is the one of readPermitted. "No record" is absence only where the
// snapshot proves coverage with what it already records (files and the skipped list) and the helper's own inventory definition (inInventory, the one captureProject walks).
// A snapshot may hold a SECOND record of a path: the manifest ownership summary of MANIFEST_REL. It is trusted only where it agrees with the path state of the same snapshot
// (reconcileManifest, baselineManifestProblem; N20): a summary of "absent" or "valid" over a path that is skipped or contradicts it is not evaluable, never a shortcut around the state.
// That is one instance of a class (N20, N21): a baseline FILE that contradicts itself. baselineContradictions (below) states every relation a snapshot of this helper holds between its own
// fields, once, and inputProblems runs it before any check, so the state function above may assume a consistent baseline (and stays fail-closed when it is not).
/**
 * Whether the explicit inventory covers a path: SNAPSHOT_FILES, every accepted file below SNAPSHOT_DIRS (recursively, never below node_modules or .git) and the AGENTS.md / CLAUDE.md files
 * below src. captureProject walks with the same constants, so this and the walk cannot drift apart unnoticed (the spec compares them over a fixture). A path outside it is never
 * collected, so no snapshot can say whether it existed.
 */
export function inInventory(rel) {
  if (!validRel(rel)) return false;
  if (SNAPSHOT_FILES.includes(rel)) return true;
  const segs = rel.split('/');
  const name = segs[segs.length - 1];
  const below = (rootRel) => { const r = rootRel.split('/'); return segs.length > r.length && r.every((s, i) => segs[i] === s) && segs.slice(r.length).every((s) => s !== 'node_modules' && s !== '.git'); };
  return (acceptInventory(name) && SNAPSHOT_DIRS.some(below)) || (acceptNested(name) && below(SNAPSHOT_NESTED_ROOT));
}
// fold is the identity except on win32, where a file system answers for one file under any case: a skipped entry covers a path spelled in another case there too.
const skipCovers = (entryPath, rel) => entryPath !== '' && (fold(rel) === fold(entryPath) || fold(rel).startsWith(`${fold(entryPath)}/`));
/**
 * The state of one path as ONE snapshot (the baseline or the current one) records it: { state: 'present' } | { state: 'absent' } | { state: 'unavailable', cause, why }.
 * cause is 'no-record' | 'alias' | 'unprovable' | 'skipped' | 'outside-inventory'. A record is present, unless the same snapshot also skipped that path or a directory above it for any
 * reason other than the one that keeps a file's record (NOT_STORED): no snapshot this helper takes holds both (baselineContradictions refuses such a baseline before any check runs, N21),
 * so this is the fail-closed answer for a snapshot that reaches here anyway, never "present". No record is absent only when the skipped list is usable, nothing in it (other than
 * NOT_STORED) equals the path or is a directory above it, and the inventory covers the path.
 */
export function snapshotPathState(snapshot, rel) {
  if (snapshot === null || typeof snapshot !== 'object' || snapshot.files === null || typeof snapshot.files !== 'object') return { state: 'unavailable', cause: 'no-record', why: 'is not in a snapshot that records files' };
  const skipped = snapshot.skipped;
  const usableSkipped = Array.isArray(skipped) && skipped.every((x) => x !== null && typeof x === 'object' && typeof x.path === 'string' && typeof x.reason === 'string');
  const hit = usableSkipped ? skipped.find((x) => x.reason !== NOT_STORED && skipCovers(x.path, rel)) : undefined;
  if (hasOwn(snapshot.files, rel)) return hit === undefined ? { state: 'present' } : { state: 'unavailable', cause: 'skipped', why: `has a record, but the same snapshot also skipped ${hit.path} (${hit.reason}), which is that path or a directory above it, so the two cannot both be true` };
  // The snapshot keys keep the spelling the walk saw. Where the file system is case-insensitive (win32) a record under another case is the SAME file, so the absence of this spelling
  // proves nothing: unavailable (alias). Elsewhere fold is the identity and no other key can match.
  const alias = Object.keys(snapshot.files).find((k) => fold(k) === fold(rel));
  if (alias !== undefined) return { state: 'unavailable', cause: 'alias', why: `has no record under that spelling, but the snapshot holds ${alias}, which a case-insensitive file system treats as the same file` };
  if (!usableSkipped) return { state: 'unavailable', cause: 'unprovable', why: 'has no record, and the snapshot has no usable list of skipped paths, so it cannot prove that the path was covered and empty' };
  if (hit !== undefined) return { state: 'unavailable', cause: 'skipped', why: `has no record because the snapshot skipped ${hit.path} (${hit.reason}), so what it held is unknown` };
  if (!inInventory(rel)) return { state: 'unavailable', cause: 'outside-inventory', why: 'has no record and lies outside the explicit inventory the snapshot covers, so it was never looked at' };
  return { state: 'absent' };
}
// What a manifest ownership summary is, in one word: 'absent' | 'valid' (with an ownership map) | 'valid-without-ownership' | 'skipped' | 'malformed' | 'unrecognised' (missing, not an
// object, or any other state). A summary is a claim about the PATH .ai/manifest.json, so it is read together with the path state the same snapshot records for it (reconcileManifest).
const summaryKind = (m) => {
  if (m === null || typeof m !== 'object' || Array.isArray(m)) return 'unrecognised';
  if (m.state === 'absent') return 'absent';
  if (m.state === 'valid') return m.ownership !== null && typeof m.ownership === 'object' && !Array.isArray(m.ownership) ? 'valid' : 'valid-without-ownership';
  return m.state === 'skipped' || m.state === 'malformed' ? m.state : 'unrecognised';
};
/**
 * The manifest ownership summary of ONE snapshot (N20: it is the one consult that carries a second record of a path, so it must agree with the first) set against the path state
 * snapshotPathState gives MANIFEST_REL from the same snapshot's own file record and skipped list: { path, summary, consistent }.
 * The pairs a snapshot taken by this helper can hold are consistent: absent <-> absent, valid <-> present, malformed <-> present, skipped <-> unavailable (skipped). Anything else is a
 * contradiction (the summary says "absent" or holds an ownership map for a path whose record says the opposite or is unavailable) and a hand-made or damaged snapshot.
 * captureProject builds the summary and the record of the CURRENT project in one pass, so that side agrees by construction (the spec checks it over real snapshots); only the baseline,
 * which is read from a file, can disagree with itself.
 */
export function reconcileManifest(snapshot) {
  const ps = snapshotPathState(snapshot, MANIFEST_REL);
  const summary = summaryKind(snapshot !== null && typeof snapshot === 'object' ? snapshot.manifest : undefined);
  const consistent = (summary === 'absent' && ps.state === 'absent')
    || ((summary === 'valid' || summary === 'valid-without-ownership' || summary === 'malformed') && ps.state === 'present')
    || (summary === 'skipped' && ps.state === 'unavailable' && ps.cause === 'skipped');
  return { path: ps, summary, consistent };
}
/**
 * The BASELINE side of the manifest (the state function of MANIFEST_REL on the baseline, reconciled with the baseline's own record of the path, N20): null when it is usable, which
 * is exactly two pairs, a summary of 'absent' with the path confirmed absent, and a summary that holds an ownership map with the path present. Every other pair is unavailable (a
 * summary of absent or valid over a path that is skipped, an alias, outside the inventory or unprovable; a present-versus-absent contradiction; a skipped, malformed or unrecognised
 * summary), in every layout, and the reason names the path, the side, the path state and the summary state.
 */
export function baselineManifestProblem(baseline) {
  const { path: ps, summary } = reconcileManifest(baseline);
  if ((summary === 'absent' && ps.state === 'absent') || (summary === 'valid' && ps.state === 'present')) return null;
  const unusable = summary === 'skipped' || summary === 'malformed' || summary === 'valid-without-ownership' || summary === 'unrecognised';
  // The summary's own state decides first (as it always did); otherwise the path state does (skipped, alias, unprovable, outside-inventory), else the two records contradict each other.
  const cause = summary === 'skipped' || summary === 'malformed' ? summary : unusable ? 'unprovable' : ps.state === 'unavailable' ? ps.cause : 'inconsistent';
  const detail = unusable
    ? `a ${cause === 'unprovable' ? 'missing or unrecognised' : cause} manifest cannot be compared`
    : ps.state === 'unavailable' ? `the path ${ps.why}, so a summary of ${summary} cannot be trusted`
      : `the baseline's file record says the path is ${ps.state} but its summary says ${summary}, so the two cannot both be true`;
  return `the baseline has no usable manifest ownership summary for ${MANIFEST_REL} (baseline side: unavailable, ${cause}; path state ${ps.state}, summary state ${summary}): ${detail} (retake the baseline with this helper)`;
}
// The reasons the capture gives for a skipped entry: the policy (or a .env name) denied the path, or the file is recorded and only its text is withheld (NOT_STORED).
const SKIPPED_REASONS = Object.freeze(['policy-denied', NOT_STORED]);
const isCount = (n) => Number.isSafeInteger(n) && n >= 0;
// The digest of a file with no bytes: the capture hashes the bytes it read, so a record of 0 bytes holds exactly this and no other record does.
const EMPTY_SHA256 = sha256(Buffer.alloc(0));
/**
 * THE BASELINE GATE (review pass 6, N21; the maintainer's decision of 2026-11-12: fix the class, not the instance). N20 and N21 were one class: a baseline FILE that contradicts itself (a file
 * record, a manifest summary and a skipped entry that say different things about one path). No snapshot this helper takes can do that, because captureProject writes every relation below in
 * one pass, so a baseline that breaks one was edited by hand or damaged, and no check may choose between its halves. Returns the reasons (an empty list is a consistent baseline); inputProblems runs
 * it once, before any check, and any reason makes the verification not evaluable. Each reason names the invariant in brackets and the path or paths, and the helper never reads a path to decide it.
 * The invariants are exactly the relations captureProject / takeSnapshot guarantee, nothing more (the order of keys and entries, and the sha256 or bytes of a text that holds a replacement character, are NOT guaranteed and not checked):
 *   identity       schema is 1 and tool is "bs-doc-map" (the fields takeSnapshot writes);
 *   files          files is an object; every key is a relative path the walk covers (inInventory), and no two keys are one file under case folding (win32);
 *   record         every record is { sha256: 64 lowercase hex, bytes and lines: non-negative integers with lines <= bytes, text?: text }, and bytes is 0 exactly when sha256 is the digest of no bytes;
 *   text           text is held only for the files keepsText names, never when it holds secret-shaped content, and its line count is the record's lines; a text with no replacement character
 *                  (U+FFFD, which is what the capture's decoding writes for a byte that is not UTF-8) is exactly what the capture decoded, so it hashes to the record's sha256 and measures its bytes;
 *                  a keepsText record without text is one the capture withheld, which the skipped list must say (not-stored);
 *   skipped        skipped is a list of { path: a relative path, reason: policy-denied | NOT_STORED }, no path twice (case folded on win32);
 *   not-stored     a NOT_STORED entry names a path that has a record without text and for which keepsText holds (the capture hashes the file and only withholds its text);
 *   record-skipped no file record is at, or below, a skipped entry of any other reason (the capture neither records nor walks what it skips);
 *   manifest       the manifest summary agrees with the baseline's own record and skipped list for MANIFEST_REL (reconcileManifest, N20) and is one baselineManifestProblem can use (N18);
 *   ownership      the ownership map of a valid summary holds only text or null (summarizeManifest);
 *   size03         size03 exists exactly when the file record of BS_03_REL does, and holds that record's bytes and lines.
 * It never throws, whatever it is given.
 */
export function baselineContradictions(baseline) {
  const out = [];
  const bad = (id, detail) => out.push(`the baseline is not a consistent snapshot (${id}): ${detail} (retake the baseline with this helper)`);
  if (!isRecord(baseline)) { bad('identity', 'the baseline is not an object'); return out; }
  if (baseline.schema !== 1 || baseline.tool !== 'bs-doc-map') bad('identity', 'it is not a schema 1 bs-doc-map snapshot');
  const files = isRecord(baseline.files) ? baseline.files : null;
  if (files === null) bad('files', 'files is missing or is not an object');
  // skipped: the well-formed entries are kept for the relations below (an entry of an unknown reason still covers a path, as snapshotPathState reads it).
  const entries = [];
  if (!Array.isArray(baseline.skipped)) bad('skipped', 'skipped is missing or is not a list');
  else {
    const seen = new Map();
    baseline.skipped.forEach((e, i) => {
      if (!isRecord(e) || typeof e.path !== 'string' || typeof e.reason !== 'string') { bad('skipped', `entry ${i} is not { path, reason } with text values`); return; }
      if (!validRel(e.path)) { bad('skipped', `${JSON.stringify(e.path)} is not a relative path`); return; }
      if (!SKIPPED_REASONS.includes(e.reason)) bad('skipped', `${e.path} has the reason ${JSON.stringify(e.reason)}, which the capture never writes (${SKIPPED_REASONS.join(' or ')})`);
      const k = fold(e.path);
      if (seen.has(k)) bad('skipped', `${e.path} is listed twice${seen.get(k) === e.path ? '' : ` (as ${seen.get(k)}; a case-insensitive file system treats the two spellings as one path)`}`);
      else seen.set(k, e.path);
      entries.push(e);
    });
  }
  const notStored = new Set(entries.filter((e) => e.reason === NOT_STORED).map((e) => e.path));
  if (files !== null) {
    const seen = new Map();
    for (const [rel, rec] of Object.entries(files)) {
      if (!inInventory(rel)) bad('files', `${JSON.stringify(rel)} is not a relative path inside the explicit inventory the snapshot walks, so no capture could have recorded it`);
      const k = fold(rel);
      if (seen.has(k)) bad('files', `${rel} and ${seen.get(k)} are one file on a case-insensitive file system, and a capture records a file once`);
      else seen.set(k, rel);
      if (!isRecord(rec)) { bad('record', `${rel} has no record object`); continue; }
      if (typeof rec.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(rec.sha256)) bad('record', `${rel} has no valid sha256 (64 lowercase hexadecimal digits)`);
      if (!isCount(rec.bytes) || !isCount(rec.lines)) bad('record', `${rel} has a bytes or lines value that is not a non-negative integer`);
      else if (rec.lines > rec.bytes) bad('record', `${rel} records more lines (${rec.lines}) than bytes (${rec.bytes})`);
      if (isCount(rec.bytes) && typeof rec.sha256 === 'string' && (rec.bytes === 0) !== (rec.sha256 === EMPTY_SHA256)) bad('record', `${rel} records ${rec.bytes} bytes but a sha256 that ${rec.bytes === 0 ? 'is not' : 'is'} the digest of an empty file`);
      if (rec.text !== undefined) {
        if (typeof rec.text !== 'string') bad('text', `${rel} has a text that is not text`);
        else {
          if (!keepsText(rel)) bad('text', `${rel} holds text, which the capture keeps only for instruction and agent files`);
          if (SECRET_SHAPED.some((re) => re.test(rec.text))) bad('text', `${rel} holds secret-shaped text, which the capture withholds (${NOT_STORED})`);
          if (isCount(rec.lines) && lineCount(rec.text) !== rec.lines) bad('text', `${rel} records ${rec.lines} lines but its text has ${lineCount(rec.text)}`);
          if (!rec.text.includes('\uFFFD') && (sha256(Buffer.from(rec.text, 'utf8')) !== rec.sha256 || Buffer.byteLength(rec.text, 'utf8') !== rec.bytes)) bad('text', `${rel} holds a text that does not match its own record: it hashes to ${sha256(Buffer.from(rec.text, 'utf8'))} and measures ${Buffer.byteLength(rec.text, 'utf8')} bytes, the record says ${JSON.stringify(rec.sha256)} and ${JSON.stringify(rec.bytes)}`);
        }
        if (notStored.has(rel)) bad('not-stored', `${rel} holds its text and is also listed as ${NOT_STORED}`);
      } else if (keepsText(rel) && !notStored.has(rel)) bad('text', `${rel} is an instruction or agent file with neither text nor a ${NOT_STORED} entry: the capture keeps the text of every such file it does not withhold`);
    }
  }
  for (const p of notStored) {
    if (files === null || !hasOwn(files, p)) bad('not-stored', `${p} is listed as ${NOT_STORED} but has no file record (the capture hashes the file and only withholds its text)`);
    else if (!keepsText(p)) bad('not-stored', `${p} is listed as ${NOT_STORED}, but the capture keeps text only for instruction and agent files, so it never withholds this one`);
  }
  if (files !== null) {
    for (const e of entries) {
      if (e.reason === NOT_STORED) continue;
      const under = Object.keys(files).filter((rel) => skipCovers(e.path, rel));
      if (under.length > 0) bad('record-skipped', `${e.path} was skipped (${e.reason}), yet the baseline also holds ${under.length === 1 ? 'a file record' : `${under.length} file records`} at or below it (${under.slice(0, 8).join(', ')}${under.length > 8 ? ', ...' : ''}): the capture neither records nor walks what it skips, so the two cannot both be true`);
    }
  }
  const mp = baselineManifestProblem(baseline);
  if (mp !== null) out.push(`the baseline is not a consistent snapshot (manifest): ${mp}`);
  if (isRecord(baseline.manifest) && baseline.manifest.state === 'valid' && isRecord(baseline.manifest.ownership)) {
    const odd = Object.entries(baseline.manifest.ownership).filter(([, v]) => v !== null && typeof v !== 'string').map(([k]) => k);
    if (odd.length > 0) bad('ownership', `the manifest summary holds an ownership that is neither text nor null for ${odd.slice(0, 5).join(', ')}`);
  }
  const r03 = files !== null && hasOwn(files, BS_03_REL) && isRecord(files[BS_03_REL]) ? files[BS_03_REL] : undefined;
  if (baseline.size03 !== undefined) {
    if (r03 === undefined) bad('size03', `size03 is recorded but the baseline holds no file record of ${BS_03_REL}, and the capture writes size03 only with that record`);
    else if (!isRecord(baseline.size03) || baseline.size03.bytes !== r03.bytes || baseline.size03.lines !== r03.lines) bad('size03', `size03 does not match the file record of ${BS_03_REL} (${JSON.stringify(baseline.size03)} against ${r03.bytes} bytes and ${r03.lines} lines)`);
  } else if (r03 !== undefined) bad('size03', `the baseline holds the file record of ${BS_03_REL} but no size03, which the capture writes with that record`);
  return out;
}

// ------------------------------------------------------------- init (workspaces) ----
export const SCENARIOS = Object.freeze(['ps-first', 'bs-existing', 'bs-new']);
export const SCAFFOLD_COMMAND = Object.freeze({ cmd: 'npx', args: Object.freeze(['--yes', '@nestjs/cli@11', 'new', 'service', '--package-manager', 'npm', '--skip-git']) });
export const FIXTURE_EMAIL = 'fixture@example.invalid';
export const FIXTURE_NAME = 'bs-doc-map fixture';
const FIXTURE_GITIGNORE = 'node_modules/\ndist/\ncoverage/\n.env\n.env.*\n.claude/settings.local.json\nCLAUDE.local.md\n';
const STAGE_LIST = Object.freeze(['.gitignore', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.build.json', 'nest-cli.json', 'eslint.config.mjs', '.prettierrc', 'README.md', 'src', 'test']);
export const defaultRoots = () => ({ repo: REPO_ROOT, temp: os.tmpdir() });
const canon = (p) => { try { return fs.realpathSync.native(p); } catch { return path.resolve(p); } };
const within = (parent, child) => { const r = path.relative(fold(canon(parent)), fold(child)); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };
/** Resolves and checks a destination without creating anything. { ok, dest, refusals: [{ code, detail }] }. */
export function planInit({ scenario, out, roots = defaultRoots() }) {
  const refusals = [];
  const refuse = (code, detail) => refusals.push({ code, detail });
  if (!SCENARIOS.includes(scenario)) refuse('bad-scenario', `scenario must be one of ${SCENARIOS.join(', ')}`);
  if (typeof out !== 'string' || out === '' || !path.isAbsolute(out)) { refuse('relative', 'the destination must be an absolute path'); return { ok: false, dest: null, refusals }; }
  const dest = path.resolve(out);
  let existing = dest;
  const rest = [];
  while (!fs.existsSync(existing) && !(() => { try { fs.lstatSync(existing); return true; } catch { return false; } })()) { rest.unshift(path.basename(existing)); const up = path.dirname(existing); if (up === existing) break; existing = up; }
  let leaf = null;
  try { leaf = fs.lstatSync(dest); } catch { leaf = null; }
  if (leaf !== null) refuse('exists', 'init refuses an existing destination');
  const resolvedBase = canon(existing);
  const real = path.join(resolvedBase, ...rest);
  let linked = fold(resolvedBase) !== fold(path.resolve(existing));
  for (let p = existing; ; p = path.dirname(p)) { try { if (fs.lstatSync(p).isSymbolicLink()) linked = true; } catch { /* absent */ } if (path.dirname(p) === p) break; }
  if (linked) refuse('linked-alias', 'the destination or an ancestor is a link, junction or alias');
  if (within(roots.repo, real)) refuse('inside-repository', 'the workspace must be outside the repository');
  if (within(roots.temp, real)) refuse('inside-temp', 'the workspace must be outside the temporary directory');
  return { ok: refusals.length === 0, dest, real, refusals };
}
export function isolatedGitEnv(gitconfigFile) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^GIT_/i.test(k) && typeof v === 'string') env[k] = v;
  return Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: gitconfigFile, GIT_TERMINAL_PROMPT: '0' });
}
function git(cwd, env, args) {
  const r = spawnSync('git', args, { cwd, env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 120000 });
  return { code: r.status, stdout: String(r.stdout ?? '').trim(), stderr: String(r.stderr ?? '').trim() };
}
// Untrimmed stdout: a trimmed porcelain listing loses the leading space of an unstaged first entry (" M AGENTS.md" -> "M AGENTS.md").
function gitRaw(cwd, env, args) {
  const r = spawnSync('git', args, { cwd, env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 120000, maxBuffer: 1 << 26 });
  return { code: r.status, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? '').trim() };
}
/**
 * Parses `git status --porcelain -z` output exactly as printed (never trimmed): records "XY<space>path" ended by NUL, paths unquoted; a
 * rename or copy (R or C in either status column) is followed by one more NUL-terminated field, the source path.
 * { ok: true, entries: [{ x, y, path, from? }] } or { ok: false, error }. An unparseable listing is an error, never "clean".
 */
export function parsePorcelainZ(raw) {
  const entries = [];
  if (typeof raw !== 'string') return { ok: false, error: 'the status output is not text' };
  if (raw === '') return { ok: true, entries };
  if (!raw.endsWith('\0')) return { ok: false, error: 'the status output is not NUL terminated' };
  const f = raw.slice(0, -1).split('\0');
  for (let i = 0; i < f.length; i++) {
    const rec = f[i];
    if (rec.length < 4 || rec[2] !== ' ') return { ok: false, error: `malformed status record ${JSON.stringify(rec.slice(0, 40))}` };
    const e = { x: rec[0], y: rec[1], path: rec.slice(3) };
    if ('RC'.includes(e.x) || 'RC'.includes(e.y)) { i += 1; if (i >= f.length || f[i] === '') return { ok: false, error: 'a rename or copy record has no source path' }; e.from = f[i]; }
    entries.push(e);
  }
  return { ok: true, entries };
}
function realScaffold({ cwd }) {
  const line = [SCAFFOLD_COMMAND.cmd, ...SCAFFOLD_COMMAND.args].join(' ');
  const r = spawnSync(line, { cwd, shell: true, encoding: 'utf8', windowsHide: true, timeout: 900000, stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) throw new Error(`the Nest scaffold failed: exit ${r.status}`);
}
const versionOf = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')).version ?? null; } catch { return null; } };
/** Actual versions, never assumed: null where the scaffold does not show one. */
export function readVersions(projectDir) {
  return { node: process.version, nestCommon: versionOf(path.join(projectDir, 'node_modules', '@nestjs', 'common', 'package.json')), nestCli: versionOf(path.join(projectDir, 'node_modules', '@nestjs', 'cli', 'package.json')) };
}
/** Creates the workspace of a scenario. The unchanged BS and PS agents do the real work later; this only prepares the ground. */
export function runInit({ scenario, out, roots = defaultRoots(), deps = {} }) {
  const plan = planInit({ scenario, out, roots });
  if (!plan.ok) return { ok: false, refusals: plan.refusals };
  const dest = plan.dest;
  fs.mkdirSync(dest, { recursive: true });
  const gitconfig = path.join(dest, 'fixture-gitconfig');
  fs.writeFileSync(gitconfig, '');
  const meta = { schema: 1, tool: 'bs-doc-map', scenario, project: scenario === 'bs-new' ? null : 'service', versions: null };
  if (scenario !== 'bs-new') {
    (deps.scaffold ?? realScaffold)({ cwd: dest, command: SCAFFOLD_COMMAND });
    const proj = path.join(dest, 'service');
    if (!fs.existsSync(proj)) throw new Error('the scaffold did not create the service directory');
    meta.versions = readVersions(proj);
    const env = isolatedGitEnv(gitconfig);
    if (!fs.existsSync(path.join(proj, '.gitignore'))) fs.writeFileSync(path.join(proj, '.gitignore'), FIXTURE_GITIGNORE);
    git(proj, env, ['init', '-q']);
    for (const [k, v] of [['user.name', FIXTURE_NAME], ['user.email', FIXTURE_EMAIL], ['commit.gpgsign', 'false'], ['core.autocrlf', 'false']]) git(proj, env, ['config', '--local', k, v]);
    git(proj, env, ['add', '--', ...STAGE_LIST.filter((p) => fs.existsSync(path.join(proj, p)))]);
    const c = git(proj, env, ['commit', '-q', '-m', 'fixture: scaffold']);
    if (c.code !== 0) throw new Error(`the fixture commit failed: ${c.stderr}`);
  } else meta.versions = { node: process.version, nestCommon: null, nestCli: null };
  fs.writeFileSync(path.join(dest, 'scenario.json'), `${JSON.stringify(meta, null, 2)}\n`);
  return { ok: true, dest, meta };
}

// ---------------------------------------------------------- seed (agent measurements) ----
export const SEED_CASES = Object.freeze(['docs-sync', 'reviewer']);
export const REVIEWER_INVARIANT_MARKER = 'Lock order';
const BASELINE_PERMITTED = [/^AGENTS\.md$/, /^CLAUDE\.md$/, /^TODO\.md$/, /^\.backend-standards\.json$/, /^\.ai\//, /^\.claude\//, /^\.codex\//, /^docs\//, /^\.gitignore$/, /^(.*\/)?(AGENTS|CLAUDE)\.md$/];
const SEED_FILES = Object.freeze({
  'docs-sync': Object.freeze({
    'src/bs-doc-map-fixture/error-filter.ts': "export function toClientError(code: string): { statusCode: number; message: string } {\n  if (code === 'WALLET_LOCKED') return { statusCode: 423, message: 'wallet.locked' };\n  return { statusCode: 500, message: 'internal.error' };\n}\n",
    'src/bs-doc-map-fixture/feature-flag.ts': "export const FEATURE_TRANSFER_LIMIT_NAME = 'FIXTURE_TRANSFER_LIMIT';\nexport function transferLimit(read: (name: string) => string | undefined): number {\n  return Number(read(FEATURE_TRANSFER_LIMIT_NAME) ?? '1000');\n}\n",
  }),
  reviewer: Object.freeze({
    'src/bs-doc-map-fixture/wallet-transfer.ts': "export async function transfer(db: { balance(id: string): Promise<number>; setBalance(id: string, v: number): Promise<void> }, from: string, to: string, amount: number): Promise<void> {\n  const a = await db.balance(from);\n  const b = await db.balance(to);\n  await db.setBalance(from, a - amount);\n  await db.setBalance(to, b + amount);\n}\n",
  }),
});
function seedRefusal(code, detail) { return { ok: false, refusal: { code, detail } }; }
/**
 * One seed target, checked BEFORE anything is written: a contained relative path, not policy-denied, every existing ancestor a real directory
 * (no symbolic link or junction at any depth, which would redirect the write outside the fixture), nothing already at the target (a dangling
 * link counts), and the deepest existing ancestor really inside the project. Returns a refusal or null.
 */
function checkSeedTarget(proj, rel, policy) {
  if (!validRel(rel)) return seedRefusal('escape', `${String(rel)} is not a contained relative path`);
  if (isForbiddenPath(rel, policy)) return seedRefusal('forbidden', `${rel} is a policy-denied path`);
  const segs = rel.split('/');
  let existing = proj;
  let p = proj;
  for (let i = 0; i < segs.length; i++) {
    p = path.join(p, segs[i]);
    let st;
    try { st = fs.lstatSync(p); } catch (e) { if (e.code === 'ENOENT') break; return seedRefusal('unreadable', `${segs.slice(0, i + 1).join('/')}: ${e.code ?? 'lstat failed'}`); }
    if (st.isSymbolicLink()) return seedRefusal('linked-ancestor', `${segs.slice(0, i + 1).join('/')} is a symbolic link or junction`);
    if (i === segs.length - 1) return seedRefusal('dirty', `${rel} already exists`);
    if (!st.isDirectory()) return seedRefusal('not-directory', `${segs.slice(0, i + 1).join('/')} is not a directory`);
    existing = p;
  }
  if (!within(proj, canon(existing))) return seedRefusal('escape', `${rel} resolves outside the project`);
  return null;
}
/**
 * Commits a fixture-only application change on a recognized disposable fixture and prints the exact range. Never edits instructions, agents or policy.
 * Everything that can refuse (the fixture identity, the project policy, every target's containment, ancestors and policy, the Git state)
 * is decided before the first write or commit; a refusal leaves the repository exactly as it was.
 */
export function runSeed({ project, caseName }) {
  if (!SEED_CASES.includes(caseName)) return seedRefusal('bad-case', `case must be one of ${SEED_CASES.join(', ')}`);
  if (typeof project !== 'string' || !path.isAbsolute(project)) return seedRefusal('relative', 'the project must be an absolute path');
  const proj = path.resolve(project);
  const parent = path.dirname(proj);
  let meta = null;
  try { meta = JSON.parse(fs.readFileSync(path.join(parent, 'scenario.json'), 'utf8')); } catch { /* unrecognized */ }
  if (meta === null || meta.tool !== 'bs-doc-map' || meta.project !== path.basename(proj)) return seedRefusal('unrecognized', 'not a bs-doc-map fixture (no matching scenario.json beside it)');
  if (fold(canon(proj)) !== fold(proj) || lstatChain(parent, path.basename(proj)) !== 'ok') return seedRefusal('linked-alias', 'the project path is linked or aliased');
  const env = isolatedGitEnv(path.join(parent, 'fixture-gitconfig'));
  if (git(proj, env, ['rev-parse', '--show-toplevel']).stdout === '' || fold(canon(git(proj, env, ['rev-parse', '--show-toplevel']).stdout)) !== fold(canon(proj))) return seedRefusal('unrecognized', 'the project is not the root of its own Git repository');
  if (git(proj, env, ['config', '--local', 'user.email']).stdout !== FIXTURE_EMAIL) return seedRefusal('unrecognized', 'the repository carries no fixture-local identity');
  const pol = policyStatus(proj);
  if (pol.policy === undefined) return seedRefusal('policy', `the project policy could not be established (${pol.state}): ${pol.detail}`);
  const files = SEED_FILES[caseName];
  for (const rel of Object.keys(files)) { const refused = checkSeedTarget(proj, rel, pol.policy); if (refused !== null) return refused; }
  const st = gitRaw(proj, env, ['status', '--porcelain', '-z', '-uall']);
  if (st.code !== 0) return seedRefusal('unrecognized', `git status failed: ${st.stderr}`);
  const parsed = parsePorcelainZ(st.stdout);
  if (!parsed.ok) return seedRefusal('unrecognized', parsed.error);
  const unmerged = parsed.entries.filter((e) => e.x === 'U' || e.y === 'U' || (e.x === 'A' && e.y === 'A') || (e.x === 'D' && e.y === 'D'));
  if (unmerged.length > 0) return seedRefusal('dirty', `unmerged paths: ${unmerged.slice(0, 5).map((e) => e.path).join(', ')}`);
  const touched = parsed.entries.flatMap((e) => (e.from === undefined ? [e.path] : [e.path, e.from]));
  const unrelated = touched.filter((p) => !BASELINE_PERMITTED.some((re) => re.test(p)));
  if (unrelated.length > 0) return seedRefusal('dirty', `unrelated dirty state: ${unrelated.slice(0, 5).join(', ')}`);
  if (caseName === 'reviewer') {
    const t03 = readPermitted(proj, BS_03_REL, { policy: pol.policy });
    if (t03.state !== 'ok' || !t03.text.includes(REVIEWER_INVARIANT_MARKER)) return seedRefusal('baseline', `the baseline 03 must already record the project lock-order invariant ("${REVIEWER_INVARIANT_MARKER}"); the helper never writes documentation`);
  }
  if (parsed.entries.length > 0) {
    // Explicit staging list: only a path whose working tree differs from the index needs an add (a staged rename or deletion is already in the
    // index, and its old path no longer matches anything for `git add`).
    const stage = parsed.entries.filter((e) => e.y !== ' ').map((e) => e.path);
    if (stage.length > 0 && git(proj, env, ['add', '--', ...stage]).code !== 0) return seedRefusal('commit', 'staging the post-setup baseline failed');
    if (git(proj, env, ['commit', '-q', '-m', 'fixture: post-setup baseline']).code !== 0) return seedRefusal('commit', 'the baseline commit failed');
  }
  const base = git(proj, env, ['rev-parse', 'HEAD']).stdout;
  for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(proj, ...rel.split('/'))), { recursive: true }); fs.writeFileSync(path.join(proj, ...rel.split('/')), text); }
  git(proj, env, ['add', '--', ...Object.keys(files)]);
  if (git(proj, env, ['commit', '-q', '-m', `fixture: ${caseName} change`]).code !== 0) return seedRefusal('commit', 'the case commit failed');
  const head = git(proj, env, ['rev-parse', 'HEAD']).stdout;
  return { ok: true, base, head, range: `${base}..${head}`, files: Object.keys(files) };
}

// ----------------------------------------------------------------------- verify ----
export const EVIDENCE_KEYS = Object.freeze(['schema', 'layout', 'conversion', 'pointers', 'fullDocuments', 'inventory', 'dispositions', 'claude', 'agents', 'extensions', 'expectPartial', 'explained', 'nested', 'unrelatedAgentsLines']);
// The evidence a verification cannot do without. Each key stands for checks that would otherwise silently not run: an omitted key is not
// "nothing to check", it is an input that was never supplied, so the verification is not evaluable (an explicit empty list or object IS a statement).
export const REQUIRED_EVIDENCE = Object.freeze(['schema', 'layout', 'conversion', 'pointers', 'fullDocuments', 'inventory', 'dispositions', 'claude', 'agents', 'extensions']);
export const CLAUDE_EVIDENCE_KEYS = Object.freeze(['bsImports', 'bsVersionSentence', 'userLines']);
// A fact that lives in one of these is placed with a section reference (03) or the explicit todo disposition (TODO.md), which have their own rules.
const NOT_FULL_DOCUMENTS = Object.freeze([BS_03_REL, 'TODO.md']);
export const CONVERSIONS = Object.freeze(['complete', 'partial', 'held', 'pending']);
const LAYOUTS = Object.freeze(['bs-mapped', 'ordinary']);
const DISPOSITIONS = Object.freeze(['take-new', 'keep', 'merge']);
const AGENT_NAMES = Object.freeze(['reviewer', 'docs-sync']);
const POINTER_PATH = /^(?:\.ai\/context|docs|docs\/integrations)\/[^/]+\.md$/;
const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isPathList = (v) => Array.isArray(v) && v.every((x) => validRel(x));
const isLine = (v) => typeof v === 'string' && /\S/.test(v);
const isLineList = (v) => Array.isArray(v) && v.every(isLine);
const ownerOf = (m, rel) => (m.state === 'valid' && hasOwn(m.ownership, rel) ? m.ownership[rel] : undefined);
/**
 * Problems of one inventory fact, an evidence object that reaches the consolidation check whole. Every field the check reads is typed here, so
 * a fact cannot match vacuously (an empty token is found everywhere), crash the check, or choose WHERE the checker looks: a fullDocument is
 * only ever one of the documents the evidence declares in evidence.fullDocuments (which verifyProject verifies exist and are not pointers).
 */
function factProblems(f, declaredFullDocuments) {
  const p = [];
  if (!isLine(f.id)) p.push('id must be a non-blank text');
  if (!isLine(f.token)) p.push('token must be a non-blank text (an empty one is found everywhere, so it checks nothing)');
  if (hasOwn(f, 'fullDocument')) {
    const d = f.fullDocument;
    if (typeof d !== 'string' || !validRel(d)) p.push('fullDocument must be a relative path');
    else if (NOT_FULL_DOCUMENTS.includes(d)) p.push(`fullDocument must not be ${d} (a fact of 03 or of TODO.md is placed with ref and, for TODO.md, the explicit todo disposition)`);
    else if (!declaredFullDocuments.includes(d)) p.push('fullDocument must also be listed in evidence.fullDocuments (the checker verifies that file exists and is not a pointer)');
  } else if (!isLine(f.ref)) p.push('ref (the destination section) is required when no fullDocument is named');
  if (hasOwn(f, 'conflict') && !(isRecord(f.conflict) && isLine(f.conflict.stale) && isLine(f.conflict.current))) p.push('conflict must be { stale, current } with both values non-blank texts');
  return p;
}
// ----------------------------------------------------------- the read boundary of verify ----
// Plan amendment 1 (review pass 4, N6 and N7): the safety rules of plan section 8 apply to EVERY read the helper makes, advisory or not. Neither the project nor
// either input file is read before the project's whole path and both input paths have been inspected by lstat and realpath alone (no content is read).
/** The three outcomes of verify and the exit code of each. Nothing else is ever returned or printed as an outcome. */
export const OUTCOME_EXIT = Object.freeze({ 'not-evaluable': 3, findings: 1, 'no-automated-findings': 0 });
export const VERIFY_OUTCOMES = Object.freeze(Object.keys(OUTCOME_EXIT));
// Why a file a check needs could not be used, by the state of the read (readPermitted). Only a confirmed absence is a statement about the project; every state named here is a
// read that did not happen, so it is a reason the verification is not evaluable and never an empty file (review pass 5, N15).
const READ_PROBLEM = Object.freeze({
  denied: 'is a protected or policy-denied path, so it is never opened',
  unsafe: 'is not a contained path, or is or sits below a symbolic link or junction, so it is never opened',
  unreadable: 'could not be read',
  policy: 'could not be read because the project policy could not be established',
});
// The CURRENT side of a consulted path: the reason names the path, the side and the state (the read state is the cause).
const readProblem = (rel, state) => `${rel} ${hasOwn(READ_PROBLEM, state) ? READ_PROBLEM[state] : `could not be used (${state})`}, but a check needs it (current side: unavailable, ${state})`;
/** A verification that did not run: nothing was checked, so there are no findings and no checks to list, only the reasons. */
export const notEvaluableResult = (reasons, expectPartial = false) => ({ outcome: 'not-evaluable', findings: [], notEvaluable: reasons, checked: [], expectPartial: expectPartial === true });
/**
 * Every segment of an absolute path, from the filesystem root down, by lstat (no content is read): { problem, at, leaf, real } with problem null, 'missing',
 * 'unreadable', 'link' or 'alias'. A link or junction ANYWHERE on the chain is refused, not only at the leaf, because reading below an ancestor link reads outside
 * the path that was supplied (N7). The canonical form (realpath) must equal the supplied path as well: a short name, another case, a mount or a link the walk
 * could not see is an alias, and an alias of a protected file is no longer recognizable by its name.
 */
export function inspectChain(abs) {
  const top = path.parse(abs).root;
  let p = top;
  let leaf = null;
  for (const seg of path.relative(top, abs).split(path.sep).filter(Boolean)) {
    p = path.join(p, seg);
    try { leaf = fs.lstatSync(p); } catch (e) { return { problem: e.code === 'ENOENT' || e.code === 'ENOTDIR' ? 'missing' : 'unreadable', at: p, leaf: null, real: null }; }
    if (leaf.isSymbolicLink()) return { problem: 'link', at: p, leaf, real: null };
  }
  let real;
  try { real = fs.realpathSync.native(abs); } catch { return { problem: 'unreadable', at: abs, leaf, real: null }; }
  if (fold(real) !== fold(abs)) return { problem: 'alias', at: abs, leaf, real };
  return { problem: null, at: abs, leaf, real };
}
/** [] when the project path is an absolute, canonical path of a real directory with no link on any ancestor; otherwise the reasons. Reads no content (N7). */
export function projectRootProblems(project) {
  if (typeof project !== 'string' || project === '' || project.includes('\0') || !path.isAbsolute(project)) return ['the project must be an absolute path'];
  const c = inspectChain(path.resolve(project));
  switch (c.problem) {
    case 'missing': return [`the project does not exist (${c.at})`];
    case 'unreadable': return [`the project path cannot be inspected (${c.at}): nothing is read`];
    case 'link': return [`the project path is or sits below a symbolic link or junction (${c.at}): nothing is read through a link, whichever segment it is`];
    case 'alias': return [`the project path is not its canonical path (an alias, a short name, another case or a mount): supply ${c.real}`];
    default: return c.leaf !== null && c.leaf.isDirectory() ? [] : ['the project is not a real directory (it is a link, a junction or a file)'];
  }
}
/**
 * [] when an input file of the CLI (the baseline or the evidence) may be opened; otherwise the reasons, and the file is never opened (N6). what is "baseline" or
 * "evidence". Protected names and the policy are asked of the whole absolute path with its root removed (so a ".env" or "*.pem" file anywhere is refused) and, for a file
 * inside the project, of its project-relative path with the project's effective policy; then every ancestor is checked for links, and the file must be a regular file.
 */
export function inputFileProblems({ file, what, root, policy }) {
  if (typeof file !== 'string' || file === '' || file.includes('\0')) return [`the ${what} path is missing or not text`];
  const abs = path.resolve(file);
  const posix = (s) => s.split(path.sep).join('/');
  const views = [posix(path.relative(path.parse(abs).root, abs))];
  const inRoot = path.relative(fold(root), fold(abs));
  if (inRoot !== '' && inRoot !== '..' && !inRoot.startsWith(`..${path.sep}`) && !path.isAbsolute(inRoot)) views.push(posix(path.relative(root, abs)));
  const p = [];
  for (const view of views) {
    let denied;
    try { denied = isForbiddenPath(view, policy); } catch { return [`the ${what} path could not be checked against the policy (${view}): it is never opened`]; }
    if (denied) { p.push(`the ${what} file is a protected or policy-denied path (${view}): it is never opened`); break; }
  }
  const c = inspectChain(abs);
  if (c.problem === 'missing') p.push(`the ${what} file could not be read (it does not exist)`);
  else if (c.problem === 'unreadable') p.push(`the ${what} file could not be read (it cannot be inspected)`);
  else if (c.problem === 'link') p.push(`the ${what} path is or sits below a symbolic link or junction (${c.at}): it is never opened`);
  else if (c.problem === 'alias') p.push(`the ${what} path is not its canonical path (an alias, a short name, another case or a mount): supply ${c.real}`);
  else if (c.leaf === null || !c.leaf.isFile()) p.push(`the ${what} path is not a regular file`);
  return p;
}
/**
 * Problems that make a verification impossible: a missing or malformed project, baseline or scenario evidence. They are never findings about the
 * project, and an empty list is the only state in which any check may run. Fail closed: absence of input is not absence of problems.
 */
export function inputProblems({ project, baseline, evidence, expectPartial = false }) {
  const p = [...projectRootProblems(project)];
  if (!isRecord(baseline)) p.push('the baseline snapshot is missing or not an object');
  else {
    if (!isRecord(baseline.files) || Object.keys(baseline.files).length === 0) p.push('the baseline records no files (an empty baseline cannot show any collateral change)');
    // N20, N21: the ONE gate on the baseline file. Every relation a snapshot of this helper holds between its own fields (the identity, the records, the text, the skipped list, the manifest
    // summary against its path, size03) is checked here, before any check runs, so a baseline that contradicts itself is never read by choosing one of its halves.
    p.push(...baselineContradictions(baseline));
  }
  if (!isRecord(evidence)) { p.push('the scenario evidence is missing or not an object'); return p; }
  const unknown = Object.keys(evidence).filter((k) => !EVIDENCE_KEYS.includes(k));
  if (unknown.length > 0) p.push(`the evidence has unknown keys: ${unknown.join(', ')}`);
  const missing = REQUIRED_EVIDENCE.filter((k) => !hasOwn(evidence, k));
  if (missing.length > 0) p.push(`the evidence omits required keys: ${missing.join(', ')}`);
  if (hasOwn(evidence, 'schema') && evidence.schema !== 1) p.push('evidence.schema must be 1');
  if (hasOwn(evidence, 'layout') && !LAYOUTS.includes(evidence.layout)) p.push(`evidence.layout must be one of ${LAYOUTS.join(', ')}`);
  if (hasOwn(evidence, 'conversion') && !CONVERSIONS.includes(evidence.conversion)) p.push(`evidence.conversion must name one of the ${CONVERSIONS.length} conversion states of references/report.md (the full outcome, partial, held or pending; see CONVERSIONS in the helper)`);
  if (evidence.conversion === 'pending') p.push('the conversion is pending: its outcome is not known yet, so nothing can be verified');
  if (hasOwn(evidence, 'pointers')) {
    if (!isPathList(evidence.pointers) || !evidence.pointers.every((r) => POINTER_PATH.test(r))) p.push('evidence.pointers must list pointer paths under .ai/context, docs or docs/integrations');
    else if (evidence.layout === 'bs-mapped' && ['complete', 'partial'].includes(evidence.conversion) && evidence.pointers.length === 0) p.push('a converted bs-mapped layout must name at least one pointer (an empty list would check nothing)');
  }
  if (hasOwn(evidence, 'fullDocuments') && !isPathList(evidence.fullDocuments)) p.push('evidence.fullDocuments must be a list of relative paths');
  if (hasOwn(evidence, 'inventory')) {
    if (!(Array.isArray(evidence.inventory) && evidence.inventory.every((f) => isRecord(f) && typeof f.id === 'string' && typeof f.token === 'string'))) p.push('evidence.inventory must be a list of { id, token, ... } facts');
    else {
      const declared = Array.isArray(evidence.fullDocuments) ? evidence.fullDocuments : [];
      for (const f of evidence.inventory) for (const why of factProblems(f, declared)) p.push(`evidence.inventory fact ${JSON.stringify(f.id)}: ${why}`);
    }
  }
  if (hasOwn(evidence, 'dispositions')) {
    if (!isRecord(evidence.dispositions)) p.push('evidence.dispositions must be an object');
    else if (!Object.values(evidence.dispositions).every(isLine)) p.push('evidence.dispositions must map fact ids to non-blank texts (an empty or mistyped disposition would count as a decision that was never taken)');
  }
  if (hasOwn(evidence, 'claude')) {
    const c = evidence.claude;
    if (!isRecord(c)) p.push('evidence.claude must be an object');
    else {
      // The observed CLAUDE.md text and the canonical template belong to the checker; the evidence states only what the run must have preserved.
      const extra = Object.keys(c).filter((k) => !CLAUDE_EVIDENCE_KEYS.includes(k));
      if (extra.length > 0) p.push(`evidence.claude has keys the checker does not accept: ${extra.join(', ')} (only ${CLAUDE_EVIDENCE_KEYS.join(', ')}; the observed CLAUDE.md text and the canonical template are never supplied by evidence)`);
      // All three are required: each stands for a preservation check (BS imports, the BS provenance sentence, the user's own lines) that is skipped when
      // its expectation is empty, so an omitted field would turn the check off and a CLAUDE.md that lost the baseline content would pass. "None apply" is
      // a statement and is made explicitly ([] for the two lists, null for the sentence); a missing field is an input that was never supplied.
      const absent = CLAUDE_EVIDENCE_KEYS.filter((k) => !hasOwn(c, k));
      if (absent.length > 0) p.push(`evidence.claude omits required fields: ${absent.join(', ')} (state "none apply" explicitly: [] for bsImports and userLines, null for bsVersionSentence; an omitted field silently turns off the preservation check it stands for)`);
      if (hasOwn(c, 'bsImports') && !isLineList(c.bsImports)) p.push('evidence.claude.bsImports must be a list of non-blank lines');
      if (hasOwn(c, 'bsVersionSentence') && c.bsVersionSentence !== null && !isLine(c.bsVersionSentence)) p.push('evidence.claude.bsVersionSentence must be a non-blank text, or null when there is none');
      if (hasOwn(c, 'userLines') && !isLineList(c.userLines)) p.push('evidence.claude.userLines must be a list of non-blank lines');
    }
  }
  if (hasOwn(evidence, 'agents')) {
    if (!isRecord(evidence.agents)) p.push('evidence.agents must be an object');
    else {
      const names = Object.keys(evidence.agents);
      if (AGENT_NAMES.some((n) => !names.includes(n)) || names.some((n) => !AGENT_NAMES.includes(n))) p.push(`evidence.agents must hold exactly ${AGENT_NAMES.join(' and ')} (each agent is judged on its own)`);
      for (const n of names) if (!isRecord(evidence.agents[n]) || !DISPOSITIONS.includes(evidence.agents[n].disposition)) p.push(`evidence.agents.${n}.disposition must be one of ${DISPOSITIONS.join(', ')}`);
    }
  }
  if (hasOwn(evidence, 'extensions') && !(isRecord(evidence.extensions) && Object.entries(evidence.extensions).every(([rel, e]) => validRel(rel) && isRecord(e)))) p.push('evidence.extensions must map relative paths to objects');
  if (hasOwn(evidence, 'explained') && !isPathList(evidence.explained)) p.push('evidence.explained must be a list of relative paths');
  if (hasOwn(evidence, 'nested') && !(Array.isArray(evidence.nested) && evidence.nested.every((n) => isRecord(n) && validRel(n.dir)))) p.push('evidence.nested must be a list of { dir }');
  if (hasOwn(evidence, 'unrelatedAgentsLines') && !(Array.isArray(evidence.unrelatedAgentsLines) && evidence.unrelatedAgentsLines.every((l) => typeof l === 'string'))) p.push('evidence.unrelatedAgentsLines must be a list of lines');
  if (hasOwn(evidence, 'expectPartial') && evidence.expectPartial !== (expectPartial === true)) p.push('evidence.expectPartial contradicts the expectation the verification was started with');
  return p;
}
/**
 * ADVISORY evidence collector for the state a PS 3.1 run left, against a pre-run snapshot and the reviewed evidence of the scenario (plan amendment 1). A heuristic
 * checker cannot prove the plan's semantic requirements, so this never reports an acceptance result: it returns exactly one of three outcomes,
 *   'not-evaluable'         a required input is missing or invalid, or a read-boundary check refused it: nothing was checked (exit 3),
 *   'findings'              one or more automated findings (exit 1),
 *   'no-automated-findings' none were found; the maintainer's review is still required (exit 0),
 * as { outcome, findings: [{ name, detail }], notEvaluable: [reason], checked: [{ name, detail? }], expectPartial }. checked lists the checks that ran and found nothing; it is the
 * evidence record, never a verdict. A check about one file keeps a constant name and carries the path in its detail (the path of an evidence entry is data, N17). The default expectation for the maintainer's review is a full conversion and recovery, and the findings are reported against it;
 * expectPartial reports against a declined-replacement or held case instead, and says "expected partial outcome", never more. A conversion that is held or partial
 * is a finding under the default expectation, and a pending one cannot be checked. Fail closed: the project, the baseline and the scenario evidence are all required,
 * every check below runs unconditionally, a missing input is "not-evaluable", and anything that throws is "not-evaluable" too (a read that failed is never "nothing found").
 * evidence: { schema: 1, layout: "bs-mapped"|"ordinary", conversion: <one of CONVERSIONS>, pointers: [rel], fullDocuments: [rel],
 *   inventory: [{ id, token, ref | fullDocument (a document also listed in fullDocuments, never 03 or TODO.md), kind?, conflict?: { stale, current } }],
 *   dispositions: { id: non-blank text }, claude: { bsImports, bsVersionSentence (text or null), userLines } all three required ([] / null say "none apply") and NO other key, agents: { reviewer,
 *   docs-sync: { disposition, retainedBytes?, approvedBytes?, incomplete?, invokedDefinition? } }, extensions: { rel: { approvedAppend } },
 *   explained?: [rel], nested?: [{ dir }], unrelatedAgentsLines?: [text], expectPartial?: boolean }.
 * What the evidence never supplies: the observed file texts, the canonical templates and shipped wrappers, the baseline, or where a fact is looked up
 * beyond the documents it declares. The objects the checks take field by field (agents, extensions, nested) are read by name, never spread, and every
 * lookup keyed by something the evidence names asks for an own property.
 * Ownership of 03: changed -> merged; unchanged -> exactly the baseline's record (an existing approved record stays, an unchanged source is never newly claimed).
 * Beyond the checks of earlier rounds: the layout the evidence declares must agree with the activation signals the checker observes (classifyLayout, N8); every 03 section a pointer
 * references must be free of unresolved blanks (checkBlankSections, N9); the manifest must pass the production checkManifest (N13); and preservation and consolidation read what a reader
 * sees (N11). validate.mjs --json results stay a maintainer-recorded item.
 */
export function verifyProject(args) {
  const expectPartial = args !== null && typeof args === 'object' && args.expectPartial === true;
  try {
    return runVerification({ ...args, expectPartial });
  } catch (e) {
    return notEvaluableResult([`the verification could not run (${e !== null && typeof e === 'object' && e.code !== undefined ? `${e.code}: ` : ''}${e !== null && typeof e === 'object' && e.message !== undefined ? e.message : String(e)}): nothing was verified`], expectPartial);
  }
}
function runVerification({ project, baseline, evidence, expectPartial, skeleton, pathTable, refText = null, inputErrors = [] }) {
  const findings = [];
  const checked = [];
  const check = (ok, name, detail) => { if (ok === true) checked.push({ name }); else findings.push({ name, detail }); };
  // A check about one file the evidence or the project names. The NAME is a constant of the helper and the path is data: it goes on the detail line, so no file name
  // (complete.md, passed.md, or one with a line break in it) can put its own words on a line the helper writes itself (review pass 5, N17 and N14).
  const checkAt = (ok, name, rel, detail) => { if (ok === true) checked.push({ name, detail: rel }); else findings.push({ name, detail: typeof detail === 'string' ? `${rel}: ${detail}` : { path: rel, found: detail } }); };
  const problems = [...inputErrors, ...inputProblems({ project, baseline, evidence, expectPartial })];
  if (problems.length > 0) return notEvaluableResult(problems, expectPartial);
  // The project path is validated above (every ancestor, the canonical form). Everything below reads through this normalized root, never through the supplied spelling.
  const root = path.resolve(project);
  let policy;
  let snap;
  let texts;
  try { policy = policyOf(root); ({ snap, texts } = captureProject(root, policy)); } catch (e) { return notEvaluableResult([`the project snapshot could not be taken through the explicit inventory (current side: unavailable): ${e.message}`], expectPartial); }
  // ==== BEGIN path-state accessors (review pass 5b, N18 and N19: the rule in "path states" above) ====
  // Everything below reaches the baseline and the current snapshot ONLY through these accessors, and each one asks for the state of the path first. A check never indexes
  // baseline.files, snap.files, baseline.manifest or snap.manifest itself (the spec pins that on this function's source), so no consult can skip the state: an unavailable path is
  // recorded in `unavailable` with its path, side and state, and the last gate turns every recorded reason into a not-evaluable result.
  // Every rel the evidence names is looked up as an OWN property of the snapshot: "constructor" or "__proto__" is not a file of the project.
  // CURRENT side. A file the snapshot holds is judged on the bytes the snapshot captured (never reread). Any other file is read through the permitted read, and the state of every
  // read is kept: 'absent' (ENOENT/ENOTDIR) is a statement a check may act on, but an unreadable, refused (policy-denied, unsafe) or unavailable file is NOT absence, so it is
  // recorded and the verification is not evaluable. read() returns the text, or null for a confirmed absence only; nothing that failed ever reads as "" or null to a check.
  const rawRead = (rel) => (texts.has(rel) ? { state: 'ok', text: texts.get(rel) } : readPermitted(root, rel, { policy }));
  const unavailable = new Set();
  const readState = new Map();
  const need = (rel) => {
    if (!readState.has(rel)) { const r = rawRead(rel); readState.set(rel, r); if (r.state !== 'ok' && r.state !== 'absent') unavailable.add(readProblem(rel, r.state)); }
    return readState.get(rel);
  };
  const read = (rel) => { const r = need(rel); return r.state === 'ok' ? r.text : null; };
  // The paths whose records are consulted (03 and the listed full documents) are in `scanned` below, which asks need() for each before any record is looked at.
  const curRec = (rel) => ownOf(snap.files, rel);
  const curPaths = () => Object.keys(snap.files);
  const curSha = (rel) => ownOf(snap.files, rel).sha256;
  const curOwner = (rel) => ownerOf(snap.manifest, rel);
  const curManifestState = () => snap.manifest.state;
  // BOTH snapshots, by record: snapshotPathState (present | absent | unavailable). `why` says what the check needed the path for.
  const sideState = (snapshot, side, rel, why) => {
    const s = snapshotPathState(snapshot, rel);
    if (s.state === 'unavailable') unavailable.add(`${rel} ${s.why} (${side} side: unavailable, ${s.cause}), but ${why}`);
    return s.state;
  };
  const baseState = (rel, why = 'a check compares it with the baseline') => sideState(baseline, 'baseline', rel, why);
  const snapState = (rel, why = 'a check compares it with the baseline') => sideState(snap, 'current', rel, why);
  // BASELINE side. The record of a path (undefined for absent AND for unavailable: the second is recorded, so the caller's "no record" can never reach a clean outcome).
  const baseRec = (rel, why) => (baseState(rel, why) === 'present' ? ownOf(baseline.files, rel) : undefined);
  const basePaths = () => Object.keys(baseline.files);
  const baseSha = (rel) => ownOf(baseline.files, rel).sha256;
  // The ownership the baseline manifest recorded for a path: inputProblems has already refused a baseline whose manifest summary is not 'absent' with the manifest path confirmed
  // absent (no manifest, so no record) or 'valid' with the path present (an ownership map that lists every record), reconciled with the baseline's own file record and skipped
  // list of that path (N20, and the rest of the baseline's self-consistency, N21: baselineContradictions), so a missing key here is a confirmed absence of the record.
  const baseOwner = (rel) => ownerOf(baseline.manifest, rel);
  // ==== END path-state accessors ====
  const notEvaluableByReads = () => notEvaluableResult([...unavailable], expectPartial);
  // Every file the checks read through the Markdown scanner. A comment shape the scanner cannot place exactly (see commentSpan, blockTail), or a code fence that never
  // closes, may hide text a reader sees, and the checks that look for something that must NOT be there (a stale value, a duplicate heading or import, a template blank)
  // would pass on the hidden text. So no check runs: the verification is not evaluable, which is never a clean result.
  const scanned = [...new Set([BS_03_REL, 'CLAUDE.md', 'AGENTS.md', 'TODO.md', ...evidence.fullDocuments, ...(evidence.nested ?? []).flatMap((n) => [`${n.dir}/AGENTS.md`, `${n.dir}/CLAUDE.md`])])];
  const unplaced = scanned.flatMap((rel) => unsupportedShapes(read(rel) ?? '').map((x) => `${rel} line ${x.line}: ${x.reason}`));
  if (unplaced.length > 0) return notEvaluableResult([...unavailable, ...unplaced.map((u) => `unsupported Markdown shape: ${u}`)], expectPartial);
  const mapped = evidence.layout === 'bs-mapped';
  const refDoc = refText ?? fs.readFileSync(path.join(SKILL_ROOT, 'references', 'docs-generation.md'), 'utf8');
  const sk = skeleton ?? extractSkeleton(refDoc);
  const pt = pathTable ?? extractPathTable(refDoc);
  // N8: the layout is a claim of the evidence, and the files say what the activation signals are. A declared layout the observed signals do not support (malformed stamp,
  // conflicting provenance sentences, a decision that conflicts, signals that hold activation) is a finding, so the declared layout never overrides what classifyLayout holds.
  // The signals are read through need(), the same captured bytes and the same states: a signal file (the stamp, CLAUDE.md, AGENTS.md, 03) or a file of a pointer directory that
  // could not be read (refused, policy-denied, unreadable, unsafe) is not an absent signal. classifyLayout would hold, which is a finding, but the verification could not look at
  // the file at all, so it is recorded and the result is not evaluable (N15, N19: a policy-denied file of a pointer directory may be the pointer that decides between "preserve" and "ordinary").
  const sig = collectSignals(root, { readFile: need });
  const cls = classifyLayout(sig);
  check((mapped && cls.treatment === 'activate') || (!mapped && cls.treatment === 'ordinary'), 'the observed activation signals agree with evidence.layout (stamp, CLAUDE.md sentence and import, owner decision, 03, installed pointers)', { declared: evidence.layout, observed: cls.treatment, reason: cls.reason, accepted: cls.accepted });
  const pointerRels = curPaths().filter((r) => POINTER_PATH.test(r) && isPointerText(read(r) ?? ''));
  // A listed pointer that the policy denies and that does not exist is in no listing and in no snapshot, yet its state is not "absent": a denied path is never opened, so its
  // existence is unknown. The state is asked of the path itself (a pointer found by the listing was asked as well, by collectSignals above).
  for (const rel of evidence.pointers) { need(rel); checkAt(pointerRels.includes(rel), 'a pointer the evidence lists is present and is a pointer', rel, 'missing or not a pointer'); }
  for (const rel of evidence.fullDocuments) checkAt(curRec(rel) !== undefined && !isPointerText(read(rel) ?? ''), 'a full document the evidence lists is present and is not a pointer', rel, 'missing or a pointer');
  if (mapped) for (const rel of pointerRels) { const r = inspectPointerFile(root, rel, { skeleton: sk, pathTable: pt, policy, readFile: need }); checkAt(r.findings.length === 0, 'a pointer: path, headings, routing and format', rel, r.findings); }
  // N13: a manifest that exists is validated by the production validator (scripts/schemas.mjs), in every layout; a mapped layout needs one. Ownership is checked
  // unconditionally for a mapped layout: a missing or unreadable manifest is a finding, never a skipped check.
  // The manifest is consulted here in EVERY layout, before either manifest check (any state but ok and absent is recorded as a reason); 'ok' means the file exists and its captured bytes are held.
  const manifestFile = need(MANIFEST_REL);
  if (mapped || manifestFile.state === 'ok') check(curManifestState() === 'valid', `${MANIFEST_REL} is present and parses (ownership cannot be verified without it)`, { state: curManifestState() });
  if (manifestFile.state === 'ok') {
    // The production validator reads the bytes the snapshot captured (read() holds them: there is no reread that could fail and skip the validation, N15). Text that does not
    // parse is not skipped silently: the snapshot summary of the same bytes is "malformed", which is the finding recorded just above.
    let parsedManifest;
    try { parsedManifest = JSON.parse(manifestFile.text); } catch { parsedManifest = undefined; }
    if (parsedManifest !== undefined) { const issues = checkManifest(parsedManifest); check(issues.length === 0, `${MANIFEST_REL} is valid under the production manifest check (scripts/schemas.mjs checkManifest)`, issues); }
  }
  if (mapped) {
    for (const rel of pointerRels) checkAt(curOwner(rel) === 'merged', 'a pointer: merged ownership', rel, { ownership: curOwner(rel) ?? null });
    // 03 on the baseline side: a record, a confirmed absence (a new 03: changed), or unavailable (skipped, outside the inventory, no usable skipped list: recorded, never "new").
    const b03 = baseRec(BS_03_REL, 'a check decides whether 03 changed');
    const c03 = curRec(BS_03_REL);
    const has03 = c03 !== undefined;
    check(has03, '03 is still present', 'the source of truth is missing');
    const changed03 = has03 && (b03 === undefined || curSha(BS_03_REL) !== baseSha(BS_03_REL));
    const now = curOwner(BS_03_REL);
    const before = baseOwner(BS_03_REL);
    if (changed03) check(now === 'merged', '03 changed: its ownership record is merged', { ownership: now ?? null });
    else check(now === before, '03 unchanged: its ownership record is exactly the baseline record (an existing approved record stays, an unchanged source is never newly claimed)', { baseline: before ?? null, now: now ?? null });
    // N9: every 03 section a pointer references (its bullets and the sections the mapping assigns to its document) must be free of unresolved template blanks.
    if (has03) {
      const refs = new Set();
      for (const rel of pointerRels) {
        for (const r of mappingRefsFor(rel) ?? []) refs.add(r);
        const parsed = sk === null || sk === undefined ? { ok: false } : parsePointerText(read(rel) ?? '', sk);
        if (parsed.ok) for (const b of parsed.fields.bullets) if (b.startsWith('- ')) refs.add(b.slice(2).trim());
      }
      const blanks = checkBlankSections({ doc03Text: read(BS_03_REL) ?? '', refs: [...refs] });
      check(blanks.length === 0, 'every 03 section a pointer references is free of unresolved blanks', blanks);
    }
  }
  const agentsText = read('AGENTS.md');
  check(agentsText !== null, 'the root AGENTS.md is present and readable', 'missing');
  if (agentsText !== null) {
    const f = checkRootInstructions({ agentsText, activated: mapped, paragraph: extractRootParagraph(refDoc), navSentence: extractNavSentence(refDoc), templateAgentsText: fs.readFileSync(path.join(SKILL_ROOT, 'assets', 'templates', 'AGENTS.md'), 'utf8'), nested: (evidence.nested ?? []).map((n) => ({ dir: n.dir, agents: read(`${n.dir}/AGENTS.md`) ?? undefined, claude: read(`${n.dir}/CLAUDE.md`) ?? undefined })), unrelatedLines: evidence.unrelatedAgentsLines ?? [] });
    check(f.length === 0, 'root AGENTS.md: routing only when activated, template rules and summaries kept', f);
  }
  { // The independent inventory and its dispositions are required evidence (an empty inventory is an explicit statement that there is nothing to consolidate).
    // A fact may be placed only in a document the evidence declares in fullDocuments (checked above to exist and not be a pointer), never in any file of the snapshot.
    const f = checkConsolidation({ doc03Text: read(BS_03_REL) ?? '', inventory: evidence.inventory, dispositions: evidence.dispositions, todoText: read('TODO.md') ?? '', pointers: Object.fromEntries(pointerRels.map((r) => [r, read(r) ?? ''])), fullDocuments: Object.fromEntries(evidence.fullDocuments.filter((r) => curRec(r) !== undefined).map((r) => [r, read(r) ?? ''])) });
    check(f.length === 0, 'independent fact inventory is consolidated with approved dispositions', f);
  }
  {
    // The observed text and the canonical template are the checker's; the evidence supplies only the three documented expectations, passed by name (never spread).
    const c = evidence.claude;
    const f = checkClaudeRecovery({ text: read('CLAUDE.md') ?? '', templateText: fs.readFileSync(path.join(SKILL_ROOT, 'assets', 'templates', 'CLAUDE.md'), 'utf8'), bsImports: ownOf(c, 'bsImports'), bsVersionSentence: ownOf(c, 'bsVersionSentence'), userLines: ownOf(c, 'userLines') });
    check(f.length === 0, 'CLAUDE.md: import, managed block with the root-start rule, BS lines and user content', f);
  }
  let incomplete = evidence.conversion !== 'complete';
  for (const name of AGENT_NAMES) {
    const a = evidence.agents[name];
    const shipped = fs.readFileSync(path.join(SKILL_ROOT, 'assets', 'wrappers', `claude-${name}.md`), 'utf8');
    const f = checkAgentRecovery({ name, disposition: a.disposition, text: read(`.claude/agents/${name}.md`) ?? '', shippedWrapper: shipped, retainedBytes: a.retainedBytes ?? null, approvedBytes: a.approvedBytes ?? null, report: { incomplete: a.incomplete, invokedDefinition: a.invokedDefinition } });
    check(f.length === 0, `.claude/agents/${name}.md: ${a.disposition} result`, f);
    if (a.disposition !== 'take-new') incomplete = true;
  }
  for (const [rel, e] of Object.entries(evidence.extensions)) {
    // before is the baseline's text for the file. "No record in the baseline" is NOT "did not exist" (N19): baseRec answers present, or undefined for a confirmed absence (the path lies
    // inside the covered inventory, the walk saw nothing and nothing skipped covers it) AND for every unavailable state, which it records (skipped in the baseline, below a skipped
    // directory, outside the inventory, no usable skipped list). A baseline record WITHOUT text (only instruction and agent files keep theirs) says the file existed but not what it
    // held: that is not "nothing there" either, so the bytes cannot be compared and the verification is not evaluable (N15).
    const rec = baseRec(rel, 'its existing bytes are compared with what the baseline held');
    if (rec !== undefined && typeof rec.text !== 'string') unavailable.add(`the baseline keeps no text for ${rel} (only instruction and agent files keep theirs), so the bytes of that extension cannot be compared with what was there (baseline side: unavailable, no-text)`);
    const f = checkExtension({ before: rec !== undefined && typeof rec.text === 'string' ? rec.text : null, after: read(rel), approvedAppend: e.approvedAppend ?? null });
    checkAt(f.length === 0, 'a project extension: existing bytes kept, only the approved text appended', rel, f);
  }
  // A path the evidence lists as explained is exempt from the collateral comparison, so a path the helper cannot see on EITHER side (skipped, outside the inventory, no proof of
  // coverage) would be exempted from nothing it could ever have compared: the exemption would only look like a review. Every listed path is therefore asked for its state first.
  for (const rel of evidence.explained ?? []) { baseState(rel, 'the evidence lists it as explained'); snapState(rel, 'the evidence lists it as explained'); }
  const explained = new Set([...(evidence.explained ?? []), ...pointerRels, ...evidence.pointers, ...evidence.fullDocuments, BS_03_REL, 'CLAUDE.md', 'AGENTS.md', 'TODO.md', MANIFEST_REL, ...Object.keys(evidence.extensions), ...AGENT_NAMES.map((n) => `.claude/agents/${n}.md`)]);
  const collateral = [];
  // The collateral comparison consults every path that has a record on either side, on BOTH sides. A record on one side and no record on the other is a creation or a deletion only
  // when the other side CONFIRMS the absence; a path the other side skipped, never covered or cannot prove is unavailable (N19: "no record" is not "did not exist").
  for (const rel of new Set([...basePaths(), ...curPaths()])) {
    if (explained.has(rel)) continue;
    const was = baseState(rel);
    const is = snapState(rel);
    // An unavailable side is already recorded (and the last gate drops every finding), so the comparison below only has to be right where both sides are present or confirmed absent.
    if (was !== is || (was === 'present' && baseSha(rel) !== curSha(rel))) collateral.push(rel);
  }
  check(collateral.length === 0, 'no unexplained collateral modification in the permitted inventory', collateral);
  check(expectPartial ? incomplete : !incomplete, expectPartial ? 'the case really is partial (declined or custom replacement, or a held conversion)' : 'the evidence states a full conversion and a canonical agent layer (no kept or custom agent, no partial or held conversion)', { incomplete, conversion: evidence.conversion });
  // The last gate (N15): a file some check needed could not be read after the first gate (an extension, an agent wrapper, a nested file, a signal), so what the checks above
  // concluded rests on a read that did not happen. Nothing is reported from them: findings and checked are dropped and the reasons are the only output.
  if (unavailable.size > 0) return notEvaluableByReads();
  return { outcome: findings.length > 0 ? 'findings' : 'no-automated-findings', findings, notEvaluable: [], checked, expectPartial };
}
/**
 * The CLI path of verify: reads nothing until the read boundary has been checked (N6, N7). The project path (every ancestor, the canonical form) is validated first, then the
 * project's own policy is established, then both input paths are checked against protected names, the policy and links; only then are the two files opened. A refusal at any step
 * is "not-evaluable" with the reasons, and no input file is read. Anything unexpected is "not-evaluable" too.
 */
export function verifyFromFiles({ project, baselineFile, evidenceFile, expectPartial = false, ...rest }) {
  const stop = (reasons) => notEvaluableResult(reasons, expectPartial);
  try {
    const unread = 'no input file was read because the read boundary could not be established';
    const rp = projectRootProblems(project);
    if (rp.length > 0) return stop([...rp, unread]);
    const root = path.resolve(project);
    const ps = policyStatus(root);
    if (ps.policy === undefined) return stop([`the project policy could not be established (${ps.state}): ${ps.detail}`, unread]);
    const problems = [];
    if (baselineFile === undefined) problems.push('the baseline file was not supplied');
    else problems.push(...inputFileProblems({ file: baselineFile, what: 'baseline', root, policy: ps.policy }));
    if (evidenceFile !== undefined) problems.push(...inputFileProblems({ file: evidenceFile, what: 'evidence', root, policy: ps.policy }));
    if (problems.length > 0) return stop(problems);
    // A file that cannot be read or parsed is a missing input (not evaluable), never an empty one.
    const readJson = (file, what) => { try { return { value: JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')) }; } catch (e) { return { error: `the ${what} file could not be read as JSON (${e.code ?? 'invalid JSON'})` }; } };
    const b = readJson(baselineFile, 'baseline');
    const v = evidenceFile === undefined ? { value: undefined } : readJson(evidenceFile, 'evidence');
    return verifyProject({ ...rest, project: root, baseline: b.value, evidence: v.value, expectPartial, inputErrors: [b.error, v.error].filter(Boolean) });
  } catch (e) {
    return stop([`the verification could not run (${e !== null && typeof e === 'object' && e.message !== undefined ? e.message : String(e)}): nothing was verified`]);
  }
}
// What the output lists, in every outcome, so a clean result is never read as more than it is. Wording avoids any verdict vocabulary on purpose: the tests assert it.
export const KNOWN_LIMITATIONS = Object.freeze([
  'The Markdown scanner models a subset of CommonMark: a shape it does not model (an unusual comment span, a code fence that never closes) makes the verification not evaluable.',
  'An approved heading rename (for example Database to Persistence) produces a finding the maintainer resolves in review: the helper has no field for an approved replacement name.',
  'The helper cannot judge factual accuracy against code, nor whether the inventory in the evidence is independent and covers every fact.',
  'Checks that look for something that must not be there read raw text and may over-report a commented copy: the duplicate root-start rule, routing or navigation text in a layout that is not mapped, and a fact copied into a pointer.',
  'validate.mjs --json results, drift output and host routing are recorded by the maintainer; the helper does not run them.',
]);
/**
 * The report. One "OUTCOME <name>" line states which of the three outcomes it is, and nothing else is a result. Lines that echo evidence or project content are the
 * indented "- " detail lines; every other line is the helper's own text. A clean outcome says that the maintainer's review is required, and the known limitations follow every outcome.
 * Every value that is not the helper's own text (a reason, a check name, a detail, a path inside any of them) is written through encodeLine, so it cannot contain a line break:
 * the report is made of exactly the lines the helper wrote, and the one "OUTCOME " line at column 0 is the only one, whatever the input (N14).
 */
export function formatVerify(r, expectPartial = r.expectPartial === true) {
  const outcome = VERIFY_OUTCOMES.includes(r.outcome) ? r.outcome : 'not-evaluable';
  const findings = Array.isArray(r.findings) ? r.findings : [];
  const reasons = Array.isArray(r.notEvaluable) ? r.notEvaluable : [];
  const checked = Array.isArray(r.checked) ? r.checked : [];
  const lines = [];
  const detailLine = (d) => `\n        - ${encodeLine(typeof d === 'string' ? d : JSON.stringify(d))}`;
  for (const q of reasons) lines.push(`NOT EVALUABLE  a required input of the verification is present and valid\n        - ${encodeLine(q)}`);
  for (const x of findings) lines.push(`FINDING  ${encodeLine(x.name)}${x.detail !== undefined ? detailLine(x.detail) : ''}`);
  for (const c of checked) lines.push(`NO FINDING  ${encodeLine(c.name)}${c.detail !== undefined ? detailLine(c.detail) : ''}`);
  lines.push(`${checked.length} checks without a finding / ${findings.length} findings / ${reasons.length} reasons not evaluable`);
  if (outcome === 'not-evaluable') lines.push('OUTCOME not-evaluable: a required input is missing or invalid, or a read-boundary check refused it; nothing was verified');
  else if (outcome === 'findings') lines.push(`OUTCOME findings: ${findings.length} automated finding${findings.length === 1 ? '' : 's'}; maintainer review required`);
  else lines.push(`OUTCOME no-automated-findings: ${expectPartial ? 'expected partial outcome — maintainer review required' : 'maintainer review required'} (the helper cannot close any item of the acceptance checklist by itself)`);
  lines.push('KNOWN LIMITATIONS (advisory output: the acceptance decision is the maintainer\'s, through the checklist in BS-DOC-MAP-ACCEPTANCE.md)');
  for (const l of KNOWN_LIMITATIONS) lines.push(`  - ${l}`);
  return lines.join('\n');
}

// -------------------------------------------------------------------------- CLI ----
const USAGE = 'usage: bs-doc-map.mjs init --scenario ps-first|bs-existing|bs-new --out <dir> | snapshot --project <dir> --out <file> | seed --project <dir> --case docs-sync|reviewer | verify --project <dir> --baseline <file> [--evidence <file>] [--expect-partial]';
export function parseCli(argv) {
  const [cmd, ...rest] = argv;
  const flags = {};
  const bool = new Set(['expect-partial']);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    // The argument text in an error is encoded (N14): a usage error prints no OUTCOME line, and an argument must not be able to add one.
    if (!a.startsWith('--')) return { error: `unexpected argument ${encodeLine(a)}` };
    const k = a.slice(2);
    if (k in flags) return { error: `duplicate --${encodeLine(k)}` };
    if (bool.has(k)) { flags[k] = true; continue; }
    const v = rest[i + 1];
    if (v === undefined || v.startsWith('--')) return { error: `--${encodeLine(k)} needs a value` };
    flags[k] = v; i++;
  }
  return { cmd, flags };
}
const REQUIRED = { init: ['scenario', 'out'], snapshot: ['project', 'out'], seed: ['project', 'case'], verify: ['project', 'baseline'] };
const ALLOWED = { init: ['scenario', 'out'], snapshot: ['project', 'out'], seed: ['project', 'case'], verify: ['project', 'baseline', 'evidence', 'expect-partial'] };
export function main(argv, io = { out: (s) => process.stdout.write(`${s}\n`), err: (s) => process.stderr.write(`${s}\n`) }) {
  const p = parseCli(argv);
  if (p.error !== undefined || !(p.cmd in REQUIRED)) { io.err(p.error ?? USAGE); return 1; }
  for (const k of REQUIRED[p.cmd]) if (!(k in p.flags)) { io.err(`${USAGE}\nmissing --${k}`); return 1; }
  for (const k of Object.keys(p.flags)) if (!ALLOWED[p.cmd].includes(k)) { io.err(`unknown option --${encodeLine(k)} for ${p.cmd}`); return 1; }
  try {
    if (p.cmd === 'init') {
      const r = runInit({ scenario: p.flags.scenario, out: p.flags.out });
      if (!r.ok) { for (const x of r.refusals) io.err(`REFUSED ${x.code}: ${x.detail}`); return 2; }
      io.out(`INIT ${r.meta.scenario} ${r.dest}`);
      io.out(`VERSIONS ${JSON.stringify(r.meta.versions)}`);
      return 0;
    }
    if (p.cmd === 'snapshot') {
      const project = path.resolve(p.flags.project);
      const out = path.resolve(p.flags.out);
      if (fs.existsSync(out)) { io.err('REFUSED exists: the snapshot file already exists'); return 2; }
      if (within(project, out)) { io.err('REFUSED inside-project: write the snapshot outside the project tree'); return 2; }
      const snap = takeSnapshot(project);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, snapshotJson(snap));
      io.out(`SNAPSHOT ${Object.keys(snap.files).length} files, ${snap.skipped.length} skipped${snap.size03 ? `, 03 ${snap.size03.bytes} bytes ${snap.size03.lines} lines` : ''}`);
      return 0;
    }
    if (p.cmd === 'seed') {
      const r = runSeed({ project: p.flags.project, caseName: p.flags.case });
      if (!r.ok) { io.err(`REFUSED ${r.refusal.code}: ${r.refusal.detail}`); return 2; }
      io.out(`BASE ${r.base}`);
      io.out(`HEAD ${r.head}`);
      io.out(`RANGE ${r.range}`);
      return 0;
    }
    // verify: the read boundary (the project's whole path, the policy, both input paths) is checked before either input file is opened (verifyFromFiles, N6 and N7).
    const expectPartial = p.flags['expect-partial'] === true;
    const r = verifyFromFiles({ project: path.resolve(p.flags.project), baselineFile: p.flags.baseline, evidenceFile: 'evidence' in p.flags ? p.flags.evidence : undefined, expectPartial });
    io.out(formatVerify(r, expectPartial));
    return OUTCOME_EXIT[r.outcome];
  } catch (e) {
    const refused = e.code === 'UNSAFE_LINK' || e.code === 'POLICY';
    io.err(`${e.code === 'UNSAFE_LINK' ? 'REFUSED unsafe-link' : e.code === 'POLICY' ? 'REFUSED policy' : 'ERROR'}: ${encodeLine(e.message)}`);
    return refused ? 2 : 1;
  }
}
const isEntry = () => { if (!process.argv[1]) return false; try { return fold(fs.realpathSync.native(process.argv[1])) === fold(fs.realpathSync.native(fileURLToPath(import.meta.url))); } catch { return false; } };
if (isEntry()) process.exitCode = main(process.argv.slice(2));
