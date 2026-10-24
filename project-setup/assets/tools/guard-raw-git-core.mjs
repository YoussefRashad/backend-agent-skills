// Installed as .ai/tools/guard-raw-git-core.mjs (fully managed), beside guard-raw-git.mjs, the Claude PreToolUse hook.
// The pure decision behind the hook: is a Bash or PowerShell command text a raw Git history read that must go through
// node .ai/tools/git-safe.mjs instead? Plan: docs/plans/2026-10-19-project-setup-v3-rc1-c6.md sections 2.3, 3.1-3.6
// and the C6-P2 addendum.
//
// This is a guardrail, not a sandbox, and the scanner is not a shell evaluator. What it gets right that a substring or
// first-word check does not:
//   - Every command position is inspected: separators, groups, $() and backtick substitutions (also inside double
//     quotes), process substitutions and the simple prefixes (assignments, command, exec, time, env, if/then/do...).
//     "git status; git log" and "node .ai/tools/git-safe.mjs log && git log" both block; there is no git-safe
//     substring exemption.
//   - Text that is not a command is not inspected: quoted arguments, comments and literal bodies (heredocs and
//     PowerShell here-strings). An ordinary commit message that mentions "git diff" never blocks.
//   - Option values are consumed where Git consumes them, so "git commit -m -p" is a message, "git commit -p" is an
//     interactive patch, and "git -C -p" never hides a subcommand. An alias defined before the subcommand, through
//     -c alias.*=... or --config-env alias.*=<variable> (either form), blocks whatever the subcommand is.
//   - A command it cannot scan is MALFORMED (fail open, but loud): exit 1 with a fixed warning, never a silent allow.
//     A lexical failure anywhere wins over a block anywhere, so the result never depends on where the scan stopped.
//
// Pure and synchronous: no filesystem, environment, process or network access, nothing thrown to the caller. Importing
// the module defines it and does nothing else.

/** The raw-history subcommands (plan 3.2), in their pinned order. Compared ASCII case-insensitively. */
export const BLOCKED_SUBCOMMANDS = Object.freeze([
  'diff', 'show', 'log', 'blame', 'cat-file', 'grep', 'archive', 'format-patch', 'whatchanged',
  'stash', 'reflog', 'diff-tree', 'range-diff',
]);

/** The managed hook identity (plan 3.7): what metadata records, never the settings entry shape. */
export const RAW_GIT_HOOK = Object.freeze({
  event: 'PreToolUse',
  matcher: 'Bash|PowerShell',
  command: 'node "$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs"',
});

// Plan 3.1: the three process outcomes. LF on every platform; no command text, input or native error is ever echoed.
const OUTCOMES = {
  allow: [0, ''],
  block: [2, 'guard-raw-git: raw Git command blocked; use node .ai/tools/git-safe.mjs\n'],
  malformed: [1, 'guard-raw-git: could not parse command; allowed without checking\n'],
};
const outcome = (kind) => ({ exitCode: OUTCOMES[kind][0], stdout: '', stderr: OUTCOMES[kind][1] });

// Plan 3.3: nested groups and substitutions beyond this depth are MALFORMED, long before the JS stack is at risk.
const MAX_DEPTH = 128;
const BLOCKED = new Set(BLOCKED_SUBCOMMANDS);
// A substitution contributes this to its word: NUL never survives the input check, so the word can never equal a name.
const OPAQUE = '\0';
const MALFORMED = Object.freeze({ malformed: true });
const asciiLower = (s) => s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * Scans one command text into simple commands: arrays of { text, raw } words, where text is the word after quote and
 * escape removal and raw its source spelling (keywords, assignments and redirections are recognized only when raw,
 * so a quoted "if" is an ordinary word). Every nested list (groups, substitutions) adds its own simple commands.
 * Throws MALFORMED for any lexical failure; the caller maps every throw to "malformed".
 */
function scan(src, ps) {
  const L = src.length;
  let i = 0;
  const commands = [];
  const pending = []; // Bash heredocs waiting for the next physical newline, in declaration order
  const bad = () => { throw MALFORMED; };

  // Bash single quotes keep everything literally; PowerShell doubles a quote to escape it. After the opening quote.
  function single() {
    let s = '';
    for (;;) {
      const e = src.indexOf("'", i);
      if (e < 0) bad();
      s += src.slice(i, e);
      i = e + 1;
      if (ps && src[i] === "'") { s += "'"; i++; continue; }
      return s;
    }
  }

  // $'...' (Bash ANSI-C quoting): skipped with its backslash escapes, not decoded (an accepted residual).
  function ansi() {
    let s = '';
    for (;;) {
      if (i >= L) bad();
      const ch = src[i];
      if (ch === '\\') { if (i + 1 >= L) bad(); s += src.slice(i, i + 2); i += 2; continue; }
      if (ch === "'") { i++; return s; }
      s += ch;
      i++;
    }
  }

  // A substitution starting at i ($( or $(( or ${ or a backtick), inspected recursively; returns false if none starts.
  function substitution(depth) {
    const ch = src[i];
    if (ch === '$' && src[i + 1] === '(') {
      if (!ps && src[i + 2] === '(') { i += 3; arith(depth + 1); return true; }
      i += 2;
      list(depth + 1, ')');
      return true;
    }
    if (!ps && ch === '$' && src[i + 1] === '{') { i += 2; param(depth + 1); return true; }
    if (!ps && ch === '`') { i++; list(depth + 1, '`'); return true; }
    return false;
  }

  // Double quotes: Bash escapes only " \ $ backtick and newline; PowerShell escapes with a backtick and doubles a quote.
  // Substitutions inside are commands and are inspected. After the opening quote.
  function double(depth) {
    let s = '';
    for (;;) {
      if (i >= L) bad();
      const ch = src[i];
      if (ch === '"') {
        if (ps && src[i + 1] === '"') { s += '"'; i += 2; continue; }
        i++;
        return s;
      }
      if (!ps && ch === '\\') {
        const n = src[i + 1];
        if (n === undefined) bad();
        if (n === '\n') { i += 2; continue; }
        if (n === '\r' && src[i + 2] === '\n') { i += 3; continue; }
        if ('"\\$`'.includes(n)) { s += n; i += 2; continue; }
        s += '\\';
        i++;
        continue;
      }
      if (ps && ch === '`') { if (i + 1 >= L) bad(); s += src[i + 1]; i += 2; continue; }
      if (substitution(depth)) { s += OPAQUE; continue; }
      s += ch;
      i++;
    }
  }

  // $(( ... )): arithmetic, so << is a shift, not a heredoc (C6-P2-2). Substitutions inside are still inspected.
  function arith(depth) {
    if (depth > MAX_DEPTH) bad();
    let level = 0;
    for (;;) {
      if (i >= L) bad();
      const ch = src[i];
      if (ch === '(') { level++; i++; continue; }
      if (ch === ')') {
        if (level > 0) { level--; i++; continue; }
        if (src[i + 1] === ')') { i += 2; return; }
        bad();
      }
      if (ch === "'") { i++; single(); continue; }
      if (ch === '"') { i++; double(depth); continue; }
      if (ch === '\\') { if (i + 1 >= L) bad(); i += 2; continue; }
      if (substitution(depth)) continue;
      i++;
    }
  }

  // ${ ... }: scanned only for substitutions (C6-P2-3), never as a group.
  function param(depth) {
    if (depth > MAX_DEPTH) bad();
    for (;;) {
      if (i >= L) bad();
      const ch = src[i];
      if (ch === '}') { i++; return; }
      if (ch === '\\') { if (i + 1 >= L) bad(); i += 2; continue; }
      if (ch === "'") { i++; single(); continue; }
      if (ch === '"') { i++; double(depth); continue; }
      if (substitution(depth)) continue;
      i++;
    }
  }

  // The heredoc delimiter word: quote removal only, never evaluated. Empty or missing is MALFORMED.
  function delimiter() {
    let out = '';
    let any = false;
    while (i < L) {
      const ch = src[i];
      if (' \t\r\n;&|<>()'.includes(ch)) break;
      any = true;
      if (ch === "'") { const e = src.indexOf("'", i + 1); if (e < 0) bad(); out += src.slice(i + 1, e); i = e + 1; continue; }
      if (ch === '"') {
        let j = i + 1;
        while (j < L && src[j] !== '"') {
          if (src[j] === '\\' && j + 1 < L && '"\\$`'.includes(src[j + 1])) { out += src[j + 1]; j += 2; continue; }
          out += src[j];
          j++;
        }
        if (j >= L) bad();
        i = j + 1;
        continue;
      }
      if (ch === '\\') { if (i + 1 >= L) bad(); out += src[i + 1]; i += 2; continue; }
      out += ch;
      i++;
    }
    if (!any || out === '') bad();
    return out;
  }

  // After a physical newline: every pending heredoc body, in declaration order, is consumed as literal bytes through a
  // line equal to its delimiter (leading tabs removed for <<-, a trailing CR ignored). A missing terminator is MALFORMED.
  function bodies() {
    while (pending.length) {
      const { delim, strip } = pending.shift();
      for (;;) {
        if (i >= L) bad();
        const nl = src.indexOf('\n', i);
        let line = src.slice(i, nl < 0 ? L : nl);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (strip) line = line.replace(/^\t+/, '');
        i = nl < 0 ? L : nl + 1;
        if (line === delim) break;
        if (nl < 0) bad();
      }
    }
  }

  // A PowerShell here-string opener at i (@' or @" as the last non-whitespace of its line): the body up to a line that
  // starts with the matching closer is one literal argument. Returns null when i is not an opener.
  function hereString() {
    const q = src[i + 1];
    let j = i + 2;
    while (j < L && (src[j] === ' ' || src[j] === '\t' || src[j] === '\r')) j++;
    if (j < L && src[j] !== '\n') return null;
    if (j >= L) bad();
    let p = j + 1;
    for (;;) {
      if (src.startsWith(`${q}@`, p)) { i = p + 2; return src.slice(j + 1, p); }
      const nl = src.indexOf('\n', p);
      if (nl < 0) bad();
      p = nl + 1;
    }
  }

  // One command list, until its terminator (")" or a backtick) or, at the top, the end of the input.
  function list(depth, term) {
    if (depth > MAX_DEPTH) bad();
    let words = [];
    let w = null;
    const begin = () => { if (!w) w = { text: '', start: i }; };
    const add = (s) => { w.text += s; };
    const endWord = () => { if (w) { words.push({ text: w.text, raw: src.slice(w.start, i) }); w = null; } };
    const endCommand = () => { endWord(); if (words.length) commands.push(words); words = []; };
    while (i < L) {
      const c = src[i];
      if (term !== null && c === term) { endCommand(); i++; return; }
      if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') { endWord(); i++; continue; }
      if (c === '\n') { endCommand(); i++; bodies(); continue; }
      if (c === ';') { endCommand(); i++; continue; }
      if (c === '|') { endCommand(); i += src[i + 1] === '|' ? 2 : 1; continue; }
      if (c === '&') {
        if (src[i + 1] === '&') { endCommand(); i += 2; continue; }
        // PowerShell: & is the call operator, an ordinary word. Bash: part of a redirection (2>&1, &>), else background.
        if (ps || (w && (src[i - 1] === '>' || src[i - 1] === '<')) || src[i + 1] === '>') { begin(); add('&'); i++; continue; }
        endCommand();
        i++;
        continue;
      }
      if (!ps && (c === '<' || c === '>') && src[i + 1] === '(') { begin(); i += 2; list(depth + 1, ')'); add(OPAQUE); continue; }
      if (!ps && c === '<' && src[i + 1] === '<') {
        if (src[i + 2] === '<') { if (w && !/^[0-9]*$/.test(src.slice(w.start, i))) endWord(); begin(); add('<<<'); i += 3; continue; } // a here-string word
        endWord();
        i += 2;
        let strip = false;
        if (src[i] === '-') { strip = true; i++; }
        while (i < L && (src[i] === ' ' || src[i] === '\t')) i++;
        pending.push({ delim: delimiter(), strip });
        continue;
      }
      // A redirection operator ends the word before it (git log>out is "git log" plus a redirection), except a file
      // descriptor number (the 2 of 2>&1) or more operator characters (>>, &>); operator and attached target are one word.
      if (c === '<' || c === '>') {
        if (w && !/^[0-9]*[<>&]*$/.test(src.slice(w.start, i))) endWord();
        begin();
        add(c);
        i++;
        continue;
      }
      if (c === '(') { endCommand(); i++; list(depth + 1, ')'); continue; }
      if (c === ')') bad();
      if (c === '#' && !w) { while (i < L && src[i] !== '\n') i++; continue; }
      if (ps && c === '`') {
        if (i + 1 >= L) bad();
        if (src[i + 1] === '\n') { i += 2; continue; }
        if (src[i + 1] === '\r' && src[i + 2] === '\n') { i += 3; continue; }
        begin();
        add(src[i + 1]);
        i += 2;
        continue;
      }
      if (!ps && c === '\\') {
        if (i + 1 >= L) bad();
        if (src[i + 1] === '\n') { i += 2; continue; }
        if (src[i + 1] === '\r' && src[i + 2] === '\n') { i += 3; continue; }
        begin();
        add(src[i + 1]);
        i += 2;
        continue;
      }
      if (ps && c === '@' && (src[i + 1] === "'" || src[i + 1] === '"')) {
        begin();
        const body = hereString();
        if (body !== null) { add(body); continue; }
      }
      if (c === "'") { begin(); i++; add(single()); continue; }
      if (c === '"') { begin(); i++; add(double(depth)); continue; }
      if (c === '$' || c === '`') {
        begin();
        if (!ps && c === '$' && src[i + 1] === "'") { i += 2; add(ansi()); continue; }
        if (substitution(depth)) { add(OPAQUE); continue; }
      }
      begin();
      add(c);
      i++;
    }
    if (term !== null) bad();
    endCommand();
  }

  list(0, null);
  if (pending.length) bad();
  return commands;
}

// Bash words that leave the next word in command position (plan 3.3, C6-P2-3), matched only as unquoted words.
const BASH_KEYWORDS = new Set(['do', 'then', 'else', 'elif', '!', 'if', 'while', 'until', '{', '}', 'done', 'fi']);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*\+?=/;
// PowerShell (decision I6-5): a leading "$name" or "$scope:name" followed by a plain "=", attached or as its own word,
// is skipped. "+=" and the other compound operators, and typed assignments ([string]$x = ...), stay residuals.
const PS_VARIABLE = /^\$(?:[A-Za-z_][A-Za-z0-9_]*:)?[A-Za-z_][A-Za-z0-9_]*/;
const REDIRECT = /^[0-9]*(?:[<>]|&>)/;
const REDIRECT_OPERATOR = /^[0-9]*(?:<|>|>>|<>|>&|<&|>\||&>|&>>|<<<)$/;
// Plan 3.5: global options that take a value, and the post-subcommand options whose separate value is skipped.
// C12 plan C12-9 adds --config-env (both forms): like -c it can define an alias, so its key (the text before the first
// "=") gets the same alias.* check. The named environment variable is never read or expanded; this module reads no
// environment at all. GIT_CONFIG_COUNT/GIT_CONFIG_KEY_n injection stays an accepted residual.
const GLOBAL_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env']);
const CONFIG_ENV_ATTACHED = '--config-env=';
const GLOBAL_ATTACHED = ['--git-dir=', '--work-tree=', '--namespace='];
const SUB_VALUE = new Set([
  '-m', '--message', '-F', '--file', '-C', '--reuse-message', '-c', '--reedit-message',
  '--author', '--date', '--template', '--cleanup', '-b', '-B', '--orphan',
  '--repo', '--receive-pack', '--upload-pack',
]);
const isPatch = (t) => t === '-p' || t === '--patch';
const isAliasKey = (value) => asciiLower(value.split('=')[0]).startsWith('alias.');

function isGitExecutable(text) {
  const base = asciiLower(text.split(/[\\/]/).pop());
  return base === 'git' || base === 'git.exe';
}

/** One simple command: 'block', 'missing' (a recognized global option without its value) or 'allow'. */
function judgeCommand(words, ps) {
  const n = words.length;
  let k = 0;
  while (k < n) {
    const raw = words[k].raw;
    if (ps) {
      if (raw === '&') { k++; continue; }
      const v = PS_VARIABLE.exec(raw);
      if (v && raw.length === v[0].length && k + 1 < n && words[k + 1].raw === '=') { k += 2; continue; }
      if (v && raw[v[0].length] === '=') {
        // "$x=git": the prefix is literal in both spellings, so what follows "=" is the next command word.
        const p = v[0].length + 1;
        if (raw.length > p) words = [...words.slice(0, k), { text: words[k].text.slice(p), raw: raw.slice(p) }, ...words.slice(k + 1)];
        else k++;
        continue;
      }
      break;
    }
    if (BASH_KEYWORDS.has(raw) || raw === 'exec' || raw === 'time' || raw === 'env' || ASSIGNMENT.test(raw)) { k++; continue; }
    if (raw === 'command') { k++; if (k < n && words[k].raw === '--') k++; continue; }
    if (REDIRECT.test(raw)) { k += REDIRECT_OPERATOR.test(raw) ? 2 : 1; continue; }
    break;
  }
  if (k >= n || !isGitExecutable(words[k].text)) return 'allow';
  const args = words.slice(k + 1).map((x) => x.text);
  let patch = false;
  let alias = false;
  let j = 0;
  let sub = null;
  while (j < args.length) {
    const a = args[j];
    if (GLOBAL_VALUE.has(a)) {
      if (j + 1 >= args.length) return alias || patch ? 'block' : 'missing';
      if ((a === '-c' || a === '--config-env') && isAliasKey(args[j + 1])) alias = true;
      j += 2;
      continue;
    }
    if ((a.startsWith('-C') || a.startsWith('-c')) && a.length > 2) { if (a[1] === 'c' && isAliasKey(a.slice(2))) alias = true; j++; continue; }
    if (a.startsWith(CONFIG_ENV_ATTACHED)) { if (isAliasKey(a.slice(CONFIG_ENV_ATTACHED.length))) alias = true; j++; continue; }
    if (GLOBAL_ATTACHED.some((p) => a.startsWith(p))) { j++; continue; }
    if (isPatch(a)) patch = true;
    if (a.startsWith('-')) { j++; continue; }
    sub = a;
    j++;
    break;
  }
  if (alias || (sub !== null && BLOCKED.has(asciiLower(sub)))) return 'block';
  let afterMarker = false;
  while (sub !== null && j < args.length) {
    const a = args[j];
    if (!afterMarker && a === '--') { afterMarker = true; j++; continue; }
    if (!afterMarker && SUB_VALUE.has(a)) { if (j + 1 >= args.length) break; j += 2; continue; }
    if (isPatch(a)) patch = true;
    j++;
  }
  return patch ? 'block' : 'allow';
}

/**
 * Plan 3.2: "allow", "block" or "malformed" for one command text. The tool name defaults to Bash only when omitted;
 * anything but "Bash" or "PowerShell", a non-string command, or any internal failure is "malformed". Never throws.
 */
export function inspectCommand(command, ...rest) {
  const tool = rest.length ? rest[0] : 'Bash';
  if (typeof command !== 'string' || (tool !== 'Bash' && tool !== 'PowerShell')) return 'malformed';
  try {
    if (command.includes('\0')) return 'malformed';
    const ps = tool === 'PowerShell';
    let missing = false;
    for (const words of scan(command, ps)) {
      const r = judgeCommand(words, ps);
      if (r === 'block') return 'block';
      if (r === 'missing') missing = true;
    }
    return missing ? 'malformed' : 'allow';
  } catch {
    return 'malformed';
  }
}

/**
 * Plan 3.6: the hook's stdin (one JSON document: a root object with tool_name "Bash" or "PowerShell" and an object
 * tool_input whose command is a string; other fields ignored) to a fresh { exitCode, stdout, stderr }. Anything else is
 * the exact MALFORMED outcome. No JSON permission response is ever produced. Never throws.
 */
export function evaluateHookInput(text) {
  try {
    if (typeof text !== 'string') return outcome('malformed');
    let v;
    try { v = JSON.parse(text); } catch { return outcome('malformed'); }
    if (!isObj(v) || !own(v, 'tool_name') || (v.tool_name !== 'Bash' && v.tool_name !== 'PowerShell')) return outcome('malformed');
    if (!own(v, 'tool_input') || !isObj(v.tool_input) || !own(v.tool_input, 'command') || typeof v.tool_input.command !== 'string') return outcome('malformed');
    return outcome(inspectCommand(v.tool_input.command, v.tool_name));
  } catch {
    return outcome('malformed');
  }
}
