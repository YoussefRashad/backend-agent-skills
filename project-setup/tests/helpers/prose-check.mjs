// Shared prose checks for the C13 and C14 test components (test-only; never part of the installer payload).
//
// Plan: docs/plans/2026-10-23-project-setup-v3-rc2-c14.md section C14-13 (the C13-R2 and C13-R3 corrections,
// decision I13-4). Newly written installed prose MUST be ASCII and at most 100 columns per line. Tables and actual code
// keep the exemption; prose inside a `text`, an unlabeled or an unknown-language fence is still prose.
//
// The module is pure: it reads no file, starts no process, registers nothing and prints nothing when imported or
// called. It does not import either component module.
//
// C13-R2: there is no blanket exemption for a line that begins with git, node, npm, npx or gh. A line inside a fence is
// exempt only when a small, explicitly recognized command form matches the COMPLETE line (an optional prompt prefix,
// one known script or command, bounded arguments). Text that merely starts with a command name is prose.
//
// C13-R3: a fence is tracked by its opening delimiter character (backtick or tilde), its length (at least three) and
// the language of its info string. Only a delimiter of the same character, at least as long as the opener and followed
// by whitespace only, closes it. Everything else inside is content, whatever it looks like. Recognized code languages
// are exempt; any other language gets prose checking. State never survives the real closing delimiter.
const NL = '\n';
const LFN = (s) => String(s).replace(/\r\n/g, '\n');
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const show = (v, cap = 700) => {
  let s;
  try { s = typeof v === 'string' ? JSON.stringify(v) : (JSON.stringify(v) ?? String(v)); } catch { s = String(v); }
  return s.replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).slice(0, cap);
};
const clip = (s) => show(String(s).length > 90 ? `${String(s).slice(0, 90)}... (${String(s).length} chars)` : s);

export const CODE_FENCE_LANGS = new Set(['js', 'javascript', 'mjs', 'cjs', 'ts', 'typescript', 'json', 'jsonc', 'sh', 'bash', 'shell', 'zsh', 'powershell', 'pwsh', 'ps1', 'toml', 'yaml', 'yml', 'diff', 'sql']);

// ------------------------------------------------------------ command forms ----
// The recognized actual command examples (C13-R2). Every form is a complete-line grammar: an optional prompt, one known
// entry point, then a bounded number of arguments drawn from a closed vocabulary (flags, placeholders, the literal --,
// a run of at least ten x characters, a path with an extension). A trailing English word breaks the match.
const PROMPT = '(?:\\$ |PS> )?';
const FLAG = '--[a-z][a-z0-9-]*';
const PLACEHOLDER = '<[a-z][a-z0-9_-]*>';
const VALUE = `(?:${PLACEHOLDER}|[A-Za-z0-9][A-Za-z0-9._/:,=-]*)`;
const FLAG_WITH_VALUE = `${FLAG}(?: ${VALUE})?`;
const GIT_SAFE_ARG = `(?:--|-n\\d+|${FLAG}|${PLACEHOLDER}|x{10,}|[A-Za-z0-9_./-]+\\.[A-Za-z]{1,5})`;
export const COMMAND_FORMS = Object.freeze([
  ['git-safe', new RegExp(`^${PROMPT}node \\.ai/tools/git-safe\\.mjs (?:cat|ls|grep|diff|log|show|review-diff)(?: ${GIT_SAFE_ARG}){0,12}$`)],
  ['skill-script', new RegExp(`^${PROMPT}node "?<SKILL_DIR>/scripts/[a-z][a-z-]*\\.mjs"?(?: [a-z][a-z-]*)?(?: ${FLAG_WITH_VALUE}){0,8}$`)],
  ['test-runner', new RegExp(`^${PROMPT}node project-setup/tests/(?:run-component-tests|run-tests|accept-rc1)\\.mjs(?: ${FLAG_WITH_VALUE}){0,4}$`)],
  ['release-builder', new RegExp(`^${PROMPT}node install/release\\.mjs(?: ${FLAG_WITH_VALUE}){0,4}$`)],
  ['npm-script', new RegExp(`^${PROMPT}npm run (?:check|format|format:check|check:versions)$`)],
]);
/** True only when the whole line is one recognized command example. */
export function isCommandExample(line) {
  const t = String(line).trim();
  return COMMAND_FORMS.some(([, re]) => re.test(t));
}

// ------------------------------------------------------------------ fences ----
// A fence opener: optional indentation, at least three backticks or tildes and an info string. A backtick fence's info
// string cannot hold a backtick (so an inline code span such as ```x``` is not an opener).
function fenceOpener(line) {
  const m = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
  if (!m) return null;
  const info = m[2].trim();
  if (m[1][0] === '`' && info.includes('`')) return null;
  const lang = (/^\S*/.exec(info) || [''])[0].toLowerCase();
  return { ch: m[1][0], len: m[1].length, code: CODE_FENCE_LANGS.has(lang) };
}
// The closing delimiter: the same character, at least the opening length, only whitespace after it.
function closesFence(line, open) {
  const m = /^\s*(`{3,}|~{3,})\s*$/.exec(line);
  return m !== null && m[1][0] === open.ch && m[1].length >= open.len;
}

/**
 * Which lines of a text are exempt from the prose limits. Exempt: table rows outside a fence, the fence delimiter lines
 * themselves, every line inside a fence of a recognized code language, and a line inside any fence that is exactly one
 * recognized command example. Everything else, including every other line of a `text`, unlabeled or unknown-language
 * fence, is prose.
 */
export function proseExemptions(lines) {
  const out = [];
  let fence = null; // null outside a fence, else { ch, len, code }
  for (const l of lines) {
    if (fence === null) {
      const o = fenceOpener(l);
      if (o) { fence = o; out.push(true); continue; }
      out.push(l.trim().startsWith('|'));
    } else if (closesFence(l, fence)) {
      fence = null;
      out.push(true);
    } else {
      out.push(fence.code || isCommandExample(l));
    }
  }
  return out;
}

// -------------------------------------------------------------- the callers ----
const proseProblems = (line, no) => {
  const issues = [];
  if (/[^\x00-\x7f]/.test(line)) issues.push(`line ${no} is not ASCII`);
  if (line.length > 100) issues.push(`line ${no} is ${line.length} columns`);
  return issues;
};
/** Newly written prose: ASCII and at most 100 columns. A line is new prose when it is not a baseline line. */
export function newProseIssues(text, baseline) {
  const base = new Set(LFN(baseline).split(NL).map((l) => l.trim()));
  const lines = LFN(text).split(NL);
  const exempt = proseExemptions(lines);
  const issues = [];
  lines.forEach((l, i) => {
    if (exempt[i] || base.has(l.trim())) return;
    issues.push(...proseProblems(l, i + 1));
  });
  return issues;
}
/** The same limits for the lines that carry the given frozen paragraphs (files with no baseline copy). */
export function proseLineIssues(text, paragraphs) {
  const lines = LFN(text).split(NL);
  const exempt = proseExemptions(lines);
  const segs = []; let S = '';
  lines.forEach((l, i) => { const q = squash(l); if (q === '') return; const start = S === '' ? 0 : S.length + 1; S += (S === '' ? '' : ' ') + q; segs.push({ i, start, end: S.length }); });
  const issues = [];
  for (const p of paragraphs) {
    const at = S.indexOf(p);
    if (at < 0) { issues.push(`paragraph not found: ${clip(p)}`); continue; }
    for (const g of segs) {
      if (!(g.end > at && g.start < at + p.length) || exempt[g.i]) continue;
      issues.push(...proseProblems(lines[g.i], g.i + 1));
    }
  }
  return issues;
}

// ------------------------------------------------------------ the controls ----
// The shared negative and positive controls. Every case is a small document (an array of lines) with the exact issues
// the helper must report for it, as [line number (1-based), 'columns' | 'ascii'] pairs. They run in memory only: the
// real texts are never modified. Non-ASCII characters are built from character codes.
const DASH = String.fromCharCode(0x2014);
const WIDE_WORDS = 'is prose that starts with a command name and is far too wide for the one hundred column limit of newly written prose';
const wideOf = (head) => `${head} ${WIDE_WORDS}`; // always above 100 columns
const exact = (n, ch = 'p') => ch.repeat(n);
const NAMES = ['git', 'node', 'npm', 'npx', 'gh'];
const COMMAND_X100 = `node .ai/tools/git-safe.mjs cat <resolved-head> -- ${'x'.repeat(100)}`;
const columnsOf = (line) => line.length;

/** The case table shared by both callers. Each case: { name, lines, expect: [[lineNo, 'columns'|'ascii'], ...] }. */
export function proseControlCases() {
  const cases = [];
  const add = (name, lines, expect) => cases.push({ name, lines, expect });
  const wide = wideOf('A prose line');
  const fenced = (open, body, close = '```') => [open, ...body, close];
  // plain prose limits, exact boundary
  add('100 columns of ASCII prose are accepted', [exact(100)], []);
  add('101 columns of ASCII prose are rejected', [exact(101)], [[1, 'columns']]);
  add('a non-ASCII prose line is rejected independently of its width', [`short line with a dash ${DASH} inside`], [[1, 'ascii']]);
  add('an overlong non-ASCII prose line has both problems', [`${exact(101)} ${DASH}`], [[1, 'ascii'], [1, 'columns']]);
  add('short ASCII prose passes', ['A short ASCII prose line.'], []);
  for (const kind of ['text', '']) {
    const open = `\`\`\`${kind}`;
    const tag = kind === '' ? 'an unlabeled fence' : 'a text fence';
    add(`100 columns of prose inside ${tag} are accepted`, fenced(open, [exact(100)]), []);
    add(`101 columns of prose inside ${tag} are rejected`, fenced(open, [exact(101)]), [[2, 'columns']]);
    add(`a non-ASCII line inside ${tag} is rejected`, fenced(open, [`fenced prose ${DASH} dash`]), [[2, 'ascii']]);
    add(`short ASCII prose inside ${tag} passes`, fenced(open, ['A short ASCII prose line.']), []);
    for (const name of NAMES) {
      const w = wideOf(name);
      add(`${name} starting overlong English prose inside ${tag} is rejected`, fenced(open, [w]), [[2, 'columns']]);
      add(`${name} starting non-ASCII English prose inside ${tag} is rejected`, fenced(open, [`${name} is prose with a dash ${DASH} inside`]), [[2, 'ascii']]);
      add(`${name} starting exactly 100 columns of prose inside ${tag} is accepted`, fenced(open, [`${name} ${exact(100 - name.length - 1)}`]), []);
      add(`${name} starting 101 columns of prose inside ${tag} is rejected`, fenced(open, [`${name} ${exact(101 - name.length - 1)}`]), [[2, 'columns']]);
    }
    for (const prefix of ['$ ', 'PS> ']) {
      add(`a "${prefix.trim()}" prompt does not turn overlong node prose inside ${tag} into a command`, fenced(open, [wideOf(`${prefix}node`)]), [[2, 'columns']]);
      add(`a "${prefix.trim()}" prompt does not turn overlong npm prose inside ${tag} into a command`, fenced(open, [wideOf(`${prefix}npm`)]), [[2, 'columns']]);
      add(`a "${prefix.trim()}" prompt keeps an actual overlong command example exempt inside ${tag}`, fenced(open, [`${prefix}${COMMAND_X100}`]), []);
    }
    add(`an actual overlong command example inside ${tag} stays exempt`, fenced(open, [COMMAND_X100]), []);
    add(`a recognized command followed by English words inside ${tag} is prose`, fenced(open, [`${COMMAND_X100} and then some English words follow it`]), [[2, 'columns']]);
    add(`an unrecognized script after node inside ${tag} is prose`, fenced(open, [`node ${'x'.repeat(100)}.mjs`]), [[2, 'columns']]);
    add(`an actual test-runner command inside ${tag} stays exempt`, fenced(open, ['node project-setup/tests/run-component-tests.mjs --component C14']), []);
    add(`the npm check command is exempt only as a complete line inside ${tag}`, fenced(open, ['npm run check', `npm run check ${'x'.repeat(100)}`]), [[3, 'columns']]);
  }
  // code languages, unknown languages and tables
  add('a code-language fence keeps the exemption', fenced('```js', [wide, `const dash = '${DASH}';`]), []);
  add('a json fence keeps the exemption', fenced('```json', [wide, `{ "dash": "${DASH}" }`]), []);
  add('an unknown-language fence is prose', fenced('```somelang', [wide]), [[2, 'columns']]);
  add('an unknown-language fence rejects non-ASCII', fenced('```somelang', [`unknown fence ${DASH} dash`]), [[2, 'ascii']]);
  add('a table row keeps the exemption', [`| ${wide} |`, `| ${DASH} | ${DASH} |`], []);
  add('a table row inside a text fence is prose', fenced('```text', [`| ${wide} |`]), [[2, 'columns']]);
  // tilde fences and the reciprocal case (C13-R3)
  add('a tilde text fence rejects overlong prose', fenced('~~~text', [wide], '~~~'), [[2, 'columns']]);
  add('a tilde code fence keeps the exemption', fenced('~~~js', [wide], '~~~'), []);
  add('a tilde fence is closed by a tilde line, not by a backtick line', fenced('~~~js', ['```', wide, '```'], '~~~'), []);
  add('a tilde fence holding a backtick fence line, then invalid prose after the close', ['~~~text', '```text', '~~~', wide], [[4, 'columns']]);
  add('a tilde fence holding a backtick js opener, then invalid prose after the close', ['~~~text', '```js', '~~~', wide], [[4, 'columns']]);
  add('a tilde fence holding a backtick opener, then invalid node prose after the close', ['~~~text', '```text', '~~~', wideOf('node')], [[4, 'columns']]);
  add('a tilde fence holding a backtick opener, then non-ASCII prose after the close', ['~~~text', '```text', '~~~', `after the close ${DASH} dash`], [[4, 'ascii']]);
  add('a backtick fence holding a tilde fence line, then invalid prose after the close', ['```text', '~~~js', '```', wide], [[4, 'columns']]);
  add('a backtick text fence is not changed by a tilde js opener inside it', ['```text', '~~~js', wide, '```'], [[3, 'columns']]);
  add('a backtick js fence is not closed by a tilde line', ['```js', '~~~', wide, '```', wide], [[5, 'columns']]);
  // lengths
  add('a longer backtick opener is not closed by a shorter inner delimiter', ['````js', '```', wide, '````', wide], [[5, 'columns']]);
  add('a longer tilde opener is not closed by a shorter inner delimiter', ['~~~~js', '~~~', wide, '~~~~', wide], [[5, 'columns']]);
  add('a longer opener is closed by an equal-length delimiter', ['````text', '````', wide], [[3, 'columns']]);
  add('a longer opener is closed by a longer delimiter', ['```js', '`````', wide], [[3, 'columns']]);
  add('a shorter inner delimiter inside a text fence is content (prose checked)', ['````text', '```', wide, '````'], [[3, 'columns']]);
  add('a closing-looking line with trailing text does not close the fence', ['```js', '``` trailing words', wide, '```', wide], [[5, 'columns']]);
  add('a closing delimiter may carry trailing whitespace', ['```js', wide, '```   ', wide], [[4, 'columns']]);
  add('a nested opener inside a fence is content and does not nest', ['```text', '```js', wide, '```', wide], [[3, 'columns'], [5, 'columns']]);
  add('state does not leak past the real closing delimiter (code fence then prose)', fenced('```js', [wide]).concat([wide, `after ${DASH} dash`]), [[4, 'columns'], [5, 'ascii']]);
  add('state does not leak past the real closing delimiter (tilde code fence then prose)', fenced('~~~sh', [wide], '~~~').concat([wide]), [[4, 'columns']]);
  return cases;
}
const sameIssues = (got, want) => got.length === want.length && got.every((g, i) => g === want[i]);
// A line with both problems reports "not ASCII" first, then its width: keep the table's pair order consistent with that.
const orderedExpectation = (c, offset) => {
  const out = [];
  const seen = new Map();
  for (const [n, kind] of c.expect) { if (!seen.has(n)) seen.set(n, []); seen.get(n).push(kind); }
  for (const [n, kinds] of [...seen].sort((a, b) => a[0] - b[0])) {
    const text = c.lines[n - 1];
    if (kinds.includes('ascii')) out.push(`line ${n + offset} is not ASCII`);
    if (kinds.includes('columns')) out.push(`line ${n + offset} is ${columnsOf(text)} columns`);
  }
  return out;
};

/**
 * The negative and positive controls for the prose checks, run through both callers.
 *   baseline  (string or null): exercises newProseIssues on the real `text` plus an appended document, with that baseline.
 *   paragraph (string or null): exercises proseLineIssues by wrapping the real frozen paragraph into fences (the C13-R1
 *     controls) and by checking each shared case document in full through its own paragraph.
 * Nothing here modifies a source file; every document is built in memory.
 */
export function proveFenceRules(check, label, { text, baseline = null, paragraph = null }) {
  const fenced = (info, body) => [`\`\`\`${info}`, ...body, '```'].join(NL);
  const wide = 'A fenced prose line that is far too wide for the one hundred column limit of newly written prose.'.repeat(2).replace(/\.A/g, '. A');
  const bad = { columns: (issues) => issues.some((i) => /columns/.test(i)), ascii: (issues) => issues.some((i) => /not ASCII/.test(i)) };
  const cases = proseControlCases();
  if (baseline !== null) {
    const issuesOf = (extra) => newProseIssues(`${text.trimEnd()}${NL}${NL}${extra}${NL}`, baseline);
    check(wide.length > 100 && bad.columns(issuesOf(wide)), `${label}: overlong prose outside a fence is reported (the control for the fence cases)`, wide.length);
    check(bad.columns(issuesOf(fenced('text', [wide]))), `${label}: an overlong prose line inside a text fence is reported (no blanket text-fence exemption)`);
    check(bad.columns(issuesOf(fenced('', [wide]))), `${label}: an overlong prose line inside an unlabeled fence is reported`);
    check(bad.ascii(issuesOf(fenced('text', [`A fenced prose line with a typographic dash ${DASH} inside.`]))), `${label}: a non-ASCII character inside a text fence is reported`);
    check(issuesOf(fenced('text', ['A short ASCII prose line inside a text fence.'])).length === 0, `${label}: short ASCII prose inside a text fence passes`);
    check(issuesOf(fenced('text', [COMMAND_X100])).length === 0, `${label}: an overlong command line inside a text fence is actual code and stays exempt`);
    check(issuesOf(fenced('js', [wide, `const dash = '${DASH}';`])).length === 0, `${label}: a code-language fence keeps the exemption`);
    check(issuesOf(`| ${wide} |`).length === 0, `${label}: a table row keeps the exemption`);
    const offset = `${text.trimEnd()}${NL}`.split(NL).length; // the appended document starts after one blank line
    for (const c of cases) {
      const got = newProseIssues(`${text.trimEnd()}${NL}${NL}${c.lines.join(NL)}${NL}`, baseline).filter((i) => Number(/^line (\d+)/.exec(i)[1]) > offset);
      const want = orderedExpectation(c, offset);
      check(sameIssues(got, want), `${label}: newProseIssues control "${c.name}"`, { got, want });
    }
  }
  if (paragraph !== null) {
    const m = new RegExp(paragraph.split(' ').map(escRe).join('\\s+')).exec(text);
    check(m !== null, `${label}: the frozen paragraph used for the fence controls is in the text`, clip(paragraph));
    if (m !== null) {
      const wrap = (info, tail) => `${text.slice(0, m.index)}\`\`\`${info}${NL}${m[0]} ${tail}${NL}\`\`\`${NL}${text.slice(m.index + m[0].length)}`;
      check(bad.columns(proseLineIssues(wrap('text', 'x'.repeat(110)), [paragraph])), `${label}: a frozen paragraph inside a text fence whose last line passes 100 columns is reported`);
      check(bad.columns(proseLineIssues(wrap('', 'x'.repeat(110)), [paragraph])), `${label}: the same inside an unlabeled fence is reported`);
      check(bad.ascii(proseLineIssues(wrap('text', DASH), [paragraph])), `${label}: a frozen paragraph inside a text fence with a non-ASCII character is reported`);
      check(proseLineIssues(wrap('js', `${'x'.repeat(110)} ${DASH}`), [paragraph]).length === 0, `${label}: the same paragraph inside a code-language fence keeps the exemption`);
      check(proseLineIssues(wrap('text', ''), [paragraph]).every((i) => !/columns|not ASCII/.test(i)), `${label}: a frozen paragraph inside a text fence within the limits passes`);
    }
    for (const c of cases) {
      const doc = c.lines.join(NL);
      const got = proseLineIssues(doc, [squash(doc)]);
      const want = orderedExpectation(c, 0);
      check(sameIssues(got, want), `${label}: proseLineIssues control "${c.name}"`, { got, want });
    }
  }
  return cases.length;
}
