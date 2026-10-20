# C9 review decisions

Decisions taken during the C9 implementation review. The frozen plan
`docs/plans/2026-10-19-project-setup-v3-rc1-c9.md` is not edited; where an item below and the plan
differ, the item wins.

## Review round 1 (Codex, 2026-10-20): I9-1 and I9-2

The review found no BLOCKING issue and two NON-BLOCKING findings, allowed all seven implementer
judgment calls and listed coverage gaps. The maintainer approved both items.

- I9-1 (C9-R1, code fix). Section 3.2 declares supplied `cwd` and `projectRoot` options as strings
  and requires malformed options to return `ENV_OPTIONS` before filesystem access. `readOptions` in
  `scripts/env-keys.mjs` treated an explicit `null` like an omitted key, so `{ cwd: null }` used the
  process directory and `{ projectRoot: null }` fell through to Git discovery. A supplied `null` or
  any other non-string value for either key now returns `ENV_OPTIONS`; an omitted key, or one set
  to `undefined`, keeps its default. The fixed root template boundary was never affected. The
  frozen tests do not cover the null cases; C11b acceptance may add them.
- I9-2 (C9-R2, residual). The R67 command-hygiene scanner in `tests/c9.test.mjs` does not select a
  JavaScript literal whose executable is quoted (`'Retry "node" --help .env.example'`), and inspects
  standalone command comments outside a Usage or Commands block one physical line at a time, so an
  environment operand on a continued comment line is missed. No shipped command uses either form.
  The tests are frozen and stay unchanged; C11b acceptance may add both controls.

Coverage gaps recorded as residuals (no test change): null, null-valued and empty-string API
options; commented assignments and BOM, mixed or lone-CR line endings combined with additions in
the merge, and the permissive assertions on existing-block separation and empty-template layout; a
protected alias spelling that resolves to a safe destination, a nonexistent protected spelling,
and an invalid policy combined with an unresolvable key path; non-plain object schema inputs, and
a file-backed matrix that does not exercise every schema violation (the pure tests cover more);
shipped-policy load failures, non-regular policy paths, ordinary `secureDir` I/O errors, separate
write and rename failures, and `ENV_INTERNAL`; the Phase 1 paragraphs are asserted within
the whole phase rather than step 7, and the docs-sync row's meaning is not fully pinned (both are
correct in the current text).

Implementer judgment calls a to g were allowed as implemented: in the AGENTS template, P continues
the first critical-rules bullet before the git-safe line; `references/report.md` notes that the V
and M bullets are conditional and copied exactly; SKILL.md Phase 1 step 7 adds an unpinned paragraph
on the key-list shape and vault staging, and Phase 2 step 1 names the env-keys manual steps;
`references/security.md` section 1 keeps its first sentence and adds explanatory prose after P; the
docs-sync config row now says setup stages `.env.example` additions through its reviewed template
flow; the `apply.mjs` eligibility comment names the permitted root template; and `env-keys.mjs`
strips a BOM from the key-list JSON, maps a shipped-spec load failure to `ENV_POLICY_IO`, an
installed-policy error during refusal checks to `ENV_POLICY`, a canonical path that differs between
refusal checks to `ENV_KEYS_PATH`, a nonexistent protected spelling to `ENV_KEYS_PATH` (section 3.5:
canonical resolution cannot be established), an empty-string `cwd` to `ENV_OPTIONS`, and a
non-path-safety `secureDir` error to `ENV_VAULT_IO`. Interleaved `added` order is not specified by
the plan; request order is kept.
