// Exact C15 amendment literals and the placement-aware reversal helper (test-only; never part of the installer payload).
//
// Plan: docs/plans/2026-10-23-project-setup-v3-rc2-c15.md sections C15-4 to C15-8 and C15-10 (amendments D15, R15, L15, N15a, N15b
// and N15c). The literals below are copied from the frozen plan text by a generator script before any implementation exists; they are
// never read back from the files under test. C13, C14 and C15 share this one module, so the reversal logic exists once (plan C15-3).
//
// The module is pure: it imports nothing, reads no file, starts no process, registers nothing and prints nothing when imported or
// called. It does not import any component module. C14's own amendment table is not touched; C14's historical amendments keep their
// own names there, and these C15 identifiers are separate.
//
// An amendment is { file, before, old, neu, after }: before + old + after is the pre-C15 slice and before + neu + after the amended
// slice (C15-4: every inserted or replacing block ends with one LF and has no implicit leading blank line; the blank lines outside a
// block belong to the anchors). A reversal verifies the exact text, its exact surrounding anchors and exactly one occurrence before it
// changes anything; a missing, duplicated, altered, moved or differently spaced amendment is refused (null). There is no substring
// deletion and no refreshed digest.

const D15_LINES = [
  "**Client-visible claims (the reviewer's Consumer pass and Boundary pass)**: for each sentence",
  "you write or edit, or that the reviewed change affects, about an error, status or body that a",
  "client receives, you MUST name the exact value and the code path that produces it through the",
  "final response writer. Trace each transformation; a validator message may pass through an",
  "exception and a filter before reaching the client. This prevents an internal label or intended",
  "fallback from being documented as the value sent on the wire.",
  "You MUST name the class of a value that is a secret or personal data, never the value.",
  "",
  "For example, if a validator uses an i18n key as its message and the filter forwards that message",
  "unchanged when translation fails, the client receives the raw key, not an original English",
  "message. You MUST verify the actual path rather than infer a fallback from a name or comment.",
  "If the path cannot be established within permitted reads, you MUST report the uncertainty and",
  "MUST NOT invent a client-visible value.",
  "",
  "When the reviewed change or your own edit shows one such claim is wrong, you MUST fix the class,",
  "not the instance: search every living doc within your existing permitted reads for the same",
  "claim, including equivalent wording, and correct each affected occurrence within your existing",
  "write scope in the same change. Every occurrence of that same claim counts as an affected doc.",
  "This prevents a second doc from retaining the same false contract. You MUST preserve frozen",
  "records, record repairs outside your write scope in TODO.md, and report any scope not checked.",
  "A narrowed search is not a complete search. These requirements MUST NOT widen reads, writes or",
  "tools, or bypass a failed or denied read. They MUST NOT authorize unrelated cleanup or searching",
  "unrelated frozen drift records. You MUST leave any correct claim the reviewed change does not",
  "affect unchanged, even when it does not name the producing path.",
];

const D15_AFTER_ANCHOR = [
  "- Read the whole target doc before editing it. Preserve everything the change does not invalidate,",
];

const R15_LINES = [
  "**hand-copied value sets**: in the Adversarial pass, you MUST check sets of values copied by hand",
  "from another type or module in the repository for a compile-time or test-time exhaustiveness",
  "guard tied to that authoritative source. Matching today's values is not a drift guard: a later",
  "source addition can silently fall through to null or another fallback. You MUST suggest a guard",
  "when it is missing. Copies from sources outside the repository remain subject to ordinary review.",
  "",
  "You MUST report a missing guard as a suggestion with severity INFO; on its own it never makes",
  "the verdict block. A source extension is a drift scenario, not evidence of a current bug.",
  "If a current consumer misreads the fallback, you MUST instead report that reachable defect with",
  "its normal classification, severity and verdict effect; this rule MUST NOT downgrade it.",
  "Use the Consumer pass and Boundary pass to establish the fallback's meaning at its consumers.",
  "",
  "You MUST NOT flag a copy under this rule when an existing guard checks exhaustiveness against",
  "the authoritative source. Generated or directly derived sets are not hand copies. A test that",
  "only repeats the copied list does not establish exhaustiveness. The guard MAY be a complete",
  "mapping checked by the compiler or a test against the source's full value set. TypeScript",
  "examples include `satisfies Record<Union, true>` or an exhaustive switch; no stack is required.",
  "This prevents missing-guard findings on sets that cannot drift from their source.",
];

const R15_BEFORE_ANCHOR = [
  "that changes the meaning of missing data is a finding.",
];

const R15_AFTER_ANCHOR = [
  "**zero is not unknown**: an unreadable count, flag or state MUST NOT be reported as 0, false or ok.",
];

const L15_LINES = [
  "C15 adds client-visible value and response-path checks to docs-sync, with same-claim repairs",
  "across permitted living docs. The reviewer adds Adversarial pass checks for hand-copied value",
  "sets without exhaustiveness guards, preserving normal severity for misread fallbacks.",
];

const L15_BEFORE_ANCHOR = [
  "block. They remain instructions, not an automated preflight or permission to transmit content.",
];

const L15_AFTER_ANCHOR = [
  "Manifest schema 3 remains unchanged. V2 validation rejects schema 3;",
];

const N15A_LINES = [
  "- C15 client-visible value and response-path checks, with repairs across permitted living docs.",
  "- C15 Adversarial pass checks for hand-copied value sets without exhaustiveness guards.",
];

const N15A_BEFORE_ANCHOR = [
  "- External-review exclusion and scanning prerequisites in installed root AGENTS.md instructions.",
];

const N15B_OLD = [
  "The project manifest schema is 3. C13 and C14 add no policy or apply migration.",
];

const N15B_NEW = [
  "The project manifest schema is 3. C13, C14 and C15 add no policy or apply migration.",
];

const N15B_AFTER_ANCHOR = [
  "Upgrade the known v2 project together with its skill. V2 validation rejects manifest schema 3.",
];

const N15C_OLD = [
  "C13 and C14 contribute through R29 without adding numbered case records.",
];

const N15C_NEW = [
  "C13, C14 and C15 contribute through R29 without adding numbered case records.",
];

const N15C_BEFORE_ANCHOR = [
  "The rc.1 case names and accept-rc1.mjs are retained for rc.2.",
];

const N15C_AFTER_ANCHOR = [
  "Actual automated results, environment and evidence paths are recorded by accept-rc1.mjs;",
];

const T = (lines) => `${lines.join('\n')}\n`;
const COUNT = (text, part) => (part === '' ? 0 : String(text).split(part).length - 1);

export const AM15 = Object.freeze({
  D15: Object.freeze({ file: 'assets/agents/docs-sync.md', before: '## Rules\n\n', old: '', neu: `${T(D15_LINES)}\n`, after: T(D15_AFTER_ANCHOR) }),
  R15: Object.freeze({ file: 'assets/agents/reviewer.md', before: `${T(R15_BEFORE_ANCHOR)}\n`, old: '', neu: `${T(R15_LINES)}\n`, after: T(R15_AFTER_ANCHOR) }),
  L15: Object.freeze({ file: 'CHANGELOG.md', before: `${T(L15_BEFORE_ANCHOR)}\n`, old: '', neu: `${T(L15_LINES)}\n`, after: T(L15_AFTER_ANCHOR) }),
  N15a: Object.freeze({ file: 'RELEASE-NOTES-3.0.0-rc.2.md', before: T(N15A_BEFORE_ANCHOR), old: '', neu: T(N15A_LINES), after: '\n## Compatibility and rollback\n' }),
  N15b: Object.freeze({ file: 'RELEASE-NOTES-3.0.0-rc.2.md', before: '## Compatibility and rollback\n\n', old: T(N15B_OLD), neu: T(N15B_NEW), after: T(N15B_AFTER_ANCHOR) }),
  N15c: Object.freeze({ file: 'RELEASE-NOTES-3.0.0-rc.2.md', before: T(N15C_BEFORE_ANCHOR), old: T(N15C_OLD), neu: T(N15C_NEW), after: T(N15C_AFTER_ANCHOR) }),
});

// The reversal order of each amended file (the reverse of the order the amendments were applied in), and the forward order.
export const REVERSAL_ORDER = Object.freeze({
  'assets/agents/docs-sync.md': Object.freeze(['D15']),
  'assets/agents/reviewer.md': Object.freeze(['R15']),
  'CHANGELOG.md': Object.freeze(['L15']),
  'RELEASE-NOTES-3.0.0-rc.2.md': Object.freeze(['N15c', 'N15b', 'N15a']),
});
export const FORWARD_ORDER = Object.freeze({
  'assets/agents/docs-sync.md': Object.freeze(['D15']),
  'assets/agents/reviewer.md': Object.freeze(['R15']),
  'CHANGELOG.md': Object.freeze(['L15']),
  'RELEASE-NOTES-3.0.0-rc.2.md': Object.freeze(['N15a', 'N15b', 'N15c']),
});

// The literal line lists, exported for the tests that check their text and their prose limits.
export const C15_BLOCKS = Object.freeze({
  D15: Object.freeze([...D15_LINES]),
  R15: Object.freeze([...R15_LINES]),
  L15: Object.freeze([...L15_LINES]),
  N15a: Object.freeze([...N15A_LINES]),
  N15b: Object.freeze({ old: Object.freeze([...N15B_OLD]), neu: Object.freeze([...N15B_NEW]) }),
  N15c: Object.freeze({ old: Object.freeze([...N15C_OLD]), neu: Object.freeze([...N15C_NEW]) }),
});

/** True only when before + neu + after stands exactly once and neu itself stands exactly once. */
export const amendmentOnce = (text, a) => COUNT(text, a.before + a.neu + a.after) === 1 && COUNT(text, a.neu) === 1;

/** The text with one amendment removed at its anchor, or null when it does not stand exactly once there. */
export function reverseOne(text, a) {
  if (!amendmentOnce(text, a)) return null;
  return text.replace(a.before + a.neu + a.after, () => a.before + a.old + a.after);
}

/** The forward direction (checks the constants themselves): the pre-C15 slice must stand exactly once. */
export function applyOne(text, a) {
  const head = a.before + a.old + a.after;
  return COUNT(text, head) === 1 ? text.replace(head, () => a.before + a.neu + a.after) : null;
}

/** Reverses the named amendments in the given order. { text, failed }: text is null and failed names the first one that does not verify. */
export function reverseSteps(text, ids) {
  let t = text;
  for (const id of ids) {
    t = reverseOne(t, AM15[id]);
    if (t === null) return { text: null, failed: id };
  }
  return { text: t, failed: null };
}

/** Applies the named amendments in the given order; null at the first one whose pre-C15 slice is not found exactly once. */
export function applySteps(text, ids) {
  let t = text;
  for (const id of ids) {
    t = applyOne(t, AM15[id]);
    if (t === null) return null;
  }
  return t;
}

/** The historical view of one amended file: every C15 amendment of that file reversed and verified. { text, failed }. */
export function reverseForFile(text, rel) {
  const ids = REVERSAL_ORDER[rel];
  return ids === undefined ? { text: null, failed: `no C15 amendment for ${rel}` } : reverseSteps(text, ids);
}
