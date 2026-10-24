// Shared allow classification (C7): a lexical risk indicator for shared Claude permission allows, not shell analysis.
//
// Plan: docs/plans/2026-10-19-project-setup-v3-rc1-c7.md sections 2.4 and 3.1-3.4. Discovery (detect.mjs), the settings
// merge (merge-claude-settings.mjs) and, later, validation (C10) use these two functions, so every consumer reports the
// same classes, severities and messages.
//
// What this gets right that the v2 merge did not:
//   - Ownership is exact string membership in VALIDATED installed metadata. No trimming, case folding, wildcard
//     expansion or guessing from a familiar tool path: a rule that merely looks like a managed one stays user-owned.
//   - Every installed managed allow is listed, including one the user already removed (present: false) and repeated
//     entries, so a later retirement can be offered for exactly what the manifest records.
//   - Package runners, interpreters and local executables are reported as repository-code execution whoever owns them;
//     a broad shell allow fails only when the project manages it. "other" is not a safety certification.
//   - Messages embed the rule through JSON.stringify, so a quote or newline inside a rule cannot forge a second line.
//
// distribution-only setup code: it is not installed under .ai/tools and no installed tool imports it. Both functions are
// synchronous, read no file, process or environment, print nothing, never exit and never mutate their input. Results are
// detached, mutable JSON. Importing the module does nothing but define it.
import { readManagedMetadata, readOmissions } from './ownership.mjs';

const SETTINGS_TARGET = '.claude/settings.json';
const OWNERS = ['managed', 'user'];
const LOCAL = '.claude/settings.local.json is personal and is not managed by project-setup; permissions there do not protect the team.';
const REMEDY = 'move it to .claude/settings.local.json if you accept this risk on your own machine.';
const SHELL_TOOLS = ['Bash', 'PowerShell'];
// One single version or help flag after npm, node, pwsh or powershell runs no repository code (compared ignoring case).
const VERSION_FLAGS = new Set(['-v', '--version', '-version', '-h', '--help', '-help', '-?']);
const ALWAYS_RUNNERS = new Set(['yarn', 'pnpm', 'npx', 'make']);
const ARG_RUNNERS = new Set(['npm', 'node', 'pwsh', 'powershell']);
const SHELLS = new Set(['bash', 'sh']);
const STAR_RUNNERS = new Set(['npm*', 'node*', 'yarn*', 'pnpm*', 'npx*', 'make*']);
const WS = ' \t\n\r\f\v';

function codedError(code, message) {
  return Object.assign(new Error(`${code}: ${message}`), { code });
}
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// Plan 3.1: a plain object is a non-null, non-array object whose prototype is Object.prototype or null.
const isPlain = (v) => isObj(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const isStrings = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

/**
 * Plan 3.2 steps 5-8: split command text on ASCII whitespace outside quotes. Inside single quotes a double quote is
 * literal and the other way round; nothing is expanded. Returns null for unbalanced quotes, otherwise the tokens with
 * one enclosing quote pair removed (interior literal quotes stay).
 */
function tokenize(text) {
  const tokens = [];
  let cur = '';
  let started = false;
  let quote = null;
  for (const ch of text) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
    } else if (WS.includes(ch)) {
      if (started) { tokens.push(cur); cur = ''; started = false; }
    } else {
      cur += ch;
      started = true;
      if (ch === '"' || ch === "'") quote = ch;
    }
  }
  if (quote) return null;
  if (started) tokens.push(cur);
  return tokens.map((t) => (t.length >= 2 && (t[0] === '"' || t[0] === "'") && t[t.length - 1] === t[0] ? t.slice(1, -1) : t));
}

/** Plan 3.2: the classification of one rule string. The rule itself is never rewritten; trimming is for matching only. */
function classOf(rule) {
  if (rule === '*' || SHELL_TOOLS.includes(rule)) return 'broad';
  const m = /^(Bash|PowerShell)\(([\s\S]*)\)$/.exec(rule);
  if (!m) return 'other';
  let text = m[2];
  let start = 0;
  let end = text.length;
  while (start < end && WS.includes(text[start])) start++;
  while (end > start && WS.includes(text[end - 1])) end--;
  text = text.slice(start, end);
  // A final legacy ":*" suffix means "followed by anything", like " *".
  if (text.endsWith(':*')) text = `${text.slice(0, -2)} *`;
  const tokens = tokenize(text);
  if (tokens === null || tokens.length === 0) return 'other';
  const [exe, ...args] = tokens;
  // An all-command wildcard in the executable position allows every command, whatever follows it.
  if (/^\*+$/.test(exe)) return 'broad';
  // A relative path with a separator is a local executable. `/x`, `\x` and `C:...` are absolute, not repository paths;
  // `~/x` and `$VAR/x` count as relative because nothing is expanded.
  if (/[\\/]/.test(exe) && !/^[\\/]/.test(exe) && !/^[A-Za-z]:/.test(exe)) return 'repo-code';
  const base = exe.split(/[\\/]/).pop().toLowerCase().replace(/\.(exe|cmd|bat)$/, '');
  if (ALWAYS_RUNNERS.has(base) || STAR_RUNNERS.has(base)) return 'repo-code';
  if (ARG_RUNNERS.has(base)) {
    if (args.length === 0) return 'other';
    if (args.length === 1 && VERSION_FLAGS.has(args[0].toLowerCase())) return 'other';
    return 'repo-code';
  }
  if (SHELLS.has(base) && args.length > 0) return 'repo-code';
  return 'other';
}

/**
 * Plan 2.4 and 3.2-3.3: { rule, ownership, classification, level, detail }. Repository code warns for both owners; a
 * broad rule fails when managed and warns when user-owned; other has level none and no message.
 */
export function classifyAllow(rule, ownership) {
  if (typeof rule !== 'string' || !OWNERS.includes(ownership)) throw codedError('ALLOW_INPUT', 'invalid allow classification input');
  const classification = classOf(rule);
  if (classification === 'other') return { rule, ownership, classification, level: 'none', detail: null };
  const level = classification === 'broad' && ownership === 'managed' ? 'fail' : 'warn';
  const what = classification === 'broad' ? 'permits arbitrary commands without a prompt' : 'runs repository code without a prompt';
  return { rule, ownership, classification, level, detail: `Shared ${ownership} allow ${JSON.stringify(rule)} ${what}; ${REMEDY}` };
}

// Plan 3.1 order 2: settings must be an object whose present permissions is an object whose present allow is strings.
function checkSettings(settings) {
  const bad = () => codedError('ALLOW_SETTINGS', 'settings permissions.allow must be a string array');
  if (!isObj(settings)) throw bad();
  if (own(settings, 'permissions')) {
    if (!isObj(settings.permissions)) throw bad();
    if (own(settings.permissions, 'allow') && !isStrings(settings.permissions.allow)) throw bad();
  }
}

/**
 * Plan 2.4 and 3.4: the inventory of shared allows against validated installed metadata.
 *   { settings, managed, omissions } -> { rules, managed, omitted, results }
 * Validation precedence (plan 3.1): the input object (ALLOW_INPUT), the settings (ALLOW_SETTINGS), the managed metadata
 * (C2 readManagedMetadata errors), the omissions (C2 readOmissions errors). An identity that is both managed and omitted
 * is managed; both records are reported.
 */
export function inspectAllows(input) {
  if (!isPlain(input)) throw codedError('ALLOW_INPUT', 'invalid allow inspection input');
  const keys = Object.keys(input).sort();
  if (keys.length !== 3 || keys[0] !== 'managed' || keys[1] !== 'omissions' || keys[2] !== 'settings') throw codedError('ALLOW_INPUT', 'invalid allow inspection input');
  const { settings, managed, omissions } = input;
  checkSettings(settings);
  const meta = readManagedMetadata(SETTINGS_TARGET, managed);
  const omit = readOmissions(SETTINGS_TARGET, omissions);
  const allow = isObj(settings.permissions) && own(settings.permissions, 'allow') ? settings.permissions.allow : [];
  const managedAllow = own(meta, 'permissions.allow') ? meta['permissions.allow'] : [];
  const rules = allow.map((r) => classifyAllow(r, managedAllow.includes(r) ? 'managed' : 'user'));
  const inventory = managedAllow.map((r) => {
    const c = classifyAllow(r, 'managed');
    return { rule: r, present: allow.includes(r), classification: c.classification, level: c.level };
  });
  const results = rules
    .filter((r) => r.level !== 'none')
    .map((r) => ({ level: r.level, check: r.classification === 'broad' ? 'allow-broad' : 'allow-repo-code', detail: r.detail }));
  results.push({ level: 'info', check: 'allow-local', detail: LOCAL });
  return { rules, managed: inventory, omitted: own(omit, 'permissions.allow') ? [...omit['permissions.allow']] : [], results };
}
