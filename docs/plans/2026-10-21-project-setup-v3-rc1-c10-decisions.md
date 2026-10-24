# C10 review decisions

Decisions taken during the C10 tests and implementation review. The frozen plan
`docs/plans/2026-10-20-project-setup-v3-rc1-c10.md` is not edited; where an item below and the plan
differ, the item wins. Items marked "overnight" were taken by the orchestrator under the
maintainer's delegation for plan-conformance fixes and low-risk choices; the maintainer approved
all of them on 2026-10-21.

## Tests lane: I10-1

- I10-1 (overnight, test scope). Section 6.4 lists the existing expectation changes and names only
  R16 and S01 among the baseline cases. The tests lane also added one R30 assertion for the
  no-installation hook info row, because section 4.9 and the PQ1 effects state that unchanged
  R10/R30 fixtures gain that row. It was kept: it pins a stated plan outcome and changes no case ID
  or name.

## Review rounds 1 to 3 (Codex, 2026-10-21): I10-2 to I10-5

Round 1 found two BLOCKING and three NON-BLOCKING findings, round 2 two further BLOCKING gaps in
the round-1 fixes, round 3 none. Every finding was a conformance gap against the frozen plan, so
all were fixed in `scripts/validate.mjs` (overnight). The frozen tests stay unchanged.

- I10-2 (C10-R1, C10-R6, read boundary). Section 4.2 requires fixed control inputs and self-test
  members to be read with `readInRepo`. Drift, the generated-content scan and the marker scan could
  read a manifest-recorded `.claude/settings.json` or `.ai/tools/` member through a junction the
  fixed-control check had refused, and a case-variant spelling such as `.CLAUDE/settings.json`
  bypassed the guard. Every body read of `.ai/manifest.json`, `.claude/settings.json`,
  `.ai/security-paths.json` and `.ai/tools/**` now goes through `readInRepo` in every consumer,
  classified with the shared C1 policy matcher (case folding on every host plus Windows aliases).
- I10-3 (C10-R2, C10-R7, never-read files). Section 4.2 says validation never reads personal
  settings, `.env*`, auth files or sandbox-secret files. A valid manifest could record
  `.claude/settings.local.json`, a nested copy of it, or `.codex/auth.json`, and the scan read it.
  Validation now never opens a body matching `**/.git/**`, `**/.claude/settings.local.json`,
  `**/CLAUDE.local.md`, `**/.codex/config.toml`, `**/node_modules/**` (from `lib.mjs`
  `WRITE_DENYLIST`), `**/.env*`, `**/auth.json` or `**/.sandbox-secrets/**`, at any depth and in
  any case, whatever the manifest or policy says. This includes a manifest-recorded `.env.example`;
  C9's env-keys flow remains the only reader of the template.
- I10-4 (C10-R3, shipped baseline unavailable). Section 4.5 pins the `fail/policy-baseline` row for
  missing or invalid shipped inspection data. A missing, malformed or schema-invalid current
  `data/secret-paths.json` rejected `main` instead. It now emits that row, treats protection as
  deny-all, reads only the fixed controls and never launches the hook self-test. In that state no
  catalog runtime-unit rows are emitted, mirroring the installed-policy-failure rule in section 4.9
  (overnight; review round 2 allowed it).
- I10-5 (C10-R4, C10-R5, output contract). R53 now follows C10-P3-2: after an installed-policy
  failure, or with no shipped baseline, the protected `allow-input` row wins over the
  unsafe-settings row; with a valid policy, unsafe still wins over protected. This supersedes
  implementer judgment call b. `checkSecurityPolicy` from `schemas.mjs` now validates the installed
  policy, as section 4.4 names it, with the emitted rows unchanged.

The pre-existing `secret-shaped-content` pass row counts candidate files, so it also counts files
skipped unread. Section 4.3 keeps existing output unchanged, and review round 2 found it acceptable
as is.

Implementer judgment calls a and c to h were allowed as implemented: with an unreadable catalog
and only a valid manifest as possible trigger, validation fails closed with the `runtime-catalog`
row; a protected `.gitignore` gives no content-derived `gitignore` warnings while the
existence-based `.claudeignore` and `run-dir-ignored` rows remain; protected instruction files skip
content-dependent rows and keep the existence-based `claude-pairing` warn; an activation path
"exists" when lstat succeeds, and a link or non-regular leaf or parent is unsafe; a `codex.cmd`
shim is resolved to its real path before its package entrypoint is located, a PATH-candidate lstat
error other than absence stops with `DOCTOR_ENTRYPOINT`, the PowerShell path is built from
`SystemRoot` and a failed launch makes the inventory unavailable, and the hidden-path process-name
test is case-insensitive; an unreachable CLI rejection writes only `doctor.mjs: internal error` or
`validate.mjs: internal error`; and a policy body that fails to parse a second time is `POLICY_IO`.

Coverage gaps recorded as residuals (no test change; C11b acceptance may add them): valid manifest
records combined with unsafe, case-variant or junctioned settings and runtime paths; never-read
files named by a valid manifest, at the root and nested; a missing, unreadable, malformed or
schema-invalid current shipped policy; policy failure combined with unsafe settings under
C10-P3-2, and the exact R53 rows for an unsafe or unreadable manifest; PQ1 combinations with
unreadable settings or policy, and a settings-only hook identity hidden by a policy failure;
final-component PATH symlinks and non-absence PATH-candidate stat failures; mixed-case process
names with a null executable path, and a missing `ExecutablePath`; no enumeration of a linked
`.sandbox` and no read through a linked, non-regular or oversized selected log; exact content-row
suppression for protected instruction files and `.gitignore`; invalid argv combined with invalid
dependencies; and the documentation-placement and no-top-level-await checks, which are weaker than
their contracts although the implementation satisfies them.

## Post-commit security review (automated, 2026-10-21): I10-6

- I10-6 (residuals, maintainer decision). An automated security review of the pushed C10 change
  raised two MEDIUM items in `scripts/validate.mjs`. First, the installed
  `.ai/tools/hooks-selftest.mjs` runs with the caller's environment and without a hash check.
  Section 4.8 pins that call, and section 8.2 records that the installed hook executes trusted
  project code and that catalog presence does not authenticate runtime bytes. The same hooks
  already run automatically under Claude and Codex. Second, content bodies outside the fixed
  controls, `.ai/tools/` and the never-read set are read without link refusal. Section 4.2 rules
  out a general guarded-read framework and section 8.2 adds no general isolation layer; the rows
  such a read can produce carry a file, line and rule name, never content. The maintainer kept
  both as accepted residuals for rc.1. A later change may add a hash check against the manifest
  before the self-test, a minimal environment, and link refusal on every content read.
