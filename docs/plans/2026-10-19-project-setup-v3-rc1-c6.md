<!--
FROZEN 2026-10-19 on branch feat/project-setup-v3-rc1. Never edit this file; changes go through the
maintainer. Component plan C6 (lands seventh, after C11a, C1, C2, C3, C4 and C5) under the frozen
architecture plan docs/plans/2026-10-15-project-setup-v3-rc1.md, which takes precedence, on the
landed C4 contract and the frozen C5 plan docs/plans/2026-10-19-project-setup-v3-rc1-c5.md.
Drafted by the plan lane (Codex, 1 revision, applying the C6-PQ1 closure (the frozen exit-1
malformed-input contract is kept) and the round-1 dispositions); plan-critique (Claude) round 2
found no BLOCKING gap. The addendum at the end records round 2's items.
-->

# C6. Raw-Git hook, merge and self-test

Status: frozen component plan (critique round 2). No open plan questions.

Repository: `<repo>`.
Branch: `feat/project-setup-v3-rc1`.
Production baseline: `d30fbe5c35afbde7a1238e639d4aa0fb2f140272`.

Intended destination:

```text
docs/plans/2026-10-19-project-setup-v3-rc1-c6.md
```

This lane changed no files, ran no tests or fixture scripts, and used no network, MCP,
connector or app. Concurrent C5 test files were not consulted.

Repository-local `.ai/security-paths.json`, `AGENTS.md`, `.ai/agents/` and the Git wrapper
were absent at the initial inspection. Two revision excerpt commands returned exit 1 without
an error diagnostic after returning content. They were not retried through another route.

## 1. Scope and dependencies

### 1.1 Authority and landing order

Implement the frozen architecture plan:

- Section 2, "C6. Raw-Git hook, merge and self-test".
- Section 4: C6 portions of R50, R51, R52, R72, R84 and R79.
- Section 5, "C6. Hook".
- Section 6 migration and rollback requirements.
- Ownership notes and the freeze addendum.

Consume frozen design A2, A6 hook ownership and N8, plus the applicable implementation
decisions. Q1 prohibits a raw draft-diff exemption. Q2-Q6 remain unchanged. PQ1/PQ2 apply
through the existing policy and runtime-unit controls.

Landing order:

```text
C11a -> C1 -> C2 -> C3 -> C4 -> C5 -> C6
```

C6 is seventh. C5 is a prerequisite through its frozen plan, not its concurrent working tree.

### 1.2 In scope

- A pure raw-Git parser and unconditional Node hook entrypoint.
- The frozen blocked commands, standalone patch arguments and inline alias overrides.
- Common shell separators, substitutions, executable paths and PowerShell escapes.
- Literal-body handling for ordinary commit heredocs and here-strings.
- All seven sanctioned git-safe commands, including later raw-Git segments.
- Conditional managed-hook insertion.
- Hooks-only staging after C3 migration staging.
- Composite hook identity and preservation of user hooks, options and order.
- The narrow C2 content-approval exemption for the canonical managed addition.
- Installed-hook self-test and its C10 consumer contract.
- Runtime catalog membership, focused tests and hook-specific documentation.

### 1.3 Out of scope

| Work | Owner |
| --- | --- |
| Deny ownership, omissions and retained legacy denies | C3 |
| Allow classification and retirement | C7 |
| Setup workflow and reviewer/orchestrator instructions | C8 |
| Environment-template handling | C9 |
| Validate/doctor self-test invocation and R73 | C10 |
| Complete numbered cases, release stamps and installation acceptance | C11b |
| Claude host measurements and R83 execution | Host acceptance |
| General missing-managed-entry validation | Deferred B5 work |
| Codex project hooks and user-level settings writes | Outside rc.1 |
| General shell interpretation or executable sandboxing | Outside C6 |
| New replace/remove hook APIs or CLIs | Deferred |

Managed-hook changes and removals use a reviewed draft and C2's existing approval rules.

The architecture lists `scripts/validate.mjs` under C6, but section 4 assigns R73 integration
to C10. C6 supplies the interface and failure contract; it does not edit validate.

### 1.4 Consumed contracts

C11a:

- Component descriptors and implementations are independent registrations.
- Each implementation returns `{ failures: string[], skipped: null }`.
- Missing modules, exports or fixtures fail assertions.
- Imports run no tests and perform no writes or process launches.
- Component records do not establish complete numbered-case coverage.
- G1-G14, H1-H6 and H7/H7a remain unchanged.
- Genuine-v2 fixtures use the verified tagged source and shipped baseline data.

C1:

- Policy parsing, matching, aliases and path validation stay centralized.
- The hook parses command text; it does not read policy or file contents.
- C6 staging uses the shipped-plus-installed refusal set before protected input reads.
- Runtime target recognition remains C1's implementation through C4.

C2:

- `hookIdentity({event,matcher,command})` returns
  `JSON.stringify([event,matcher,command])`.
- Identity strings are exact; options are not identity fields.
- Invalid identity throws `HOOK_IDENTITY` with message
  `HOOK_IDENTITY: event, matcher and command are required`.
- Duplicate metadata identities throw `HOOK_DUPLICATE`.
- Settings use `ownership:"keys"` and `managed.hooks`.
- Append-only metadata needs no extra approval.
- Metadata replacement, removal or reordering requires settings approval.
- Content and metadata share bindings, one prepared plan and one journal.
- I2-1 through I2-10 remain binding.
- `apply.mjs diff --project <root> --run-id <id>` invokes no Git.

C3:

- `mergeManagedDenies` retains its signature and behavior.
- Stage precedes C6/C7 staging.
- Later staging may extend settings and its own metadata fields while preserving C3's
  deny projection, ownership, omissions and decisions.
- The existing stage loop automatically stages every catalog member or declares an
  already-current installed member as a transaction input.
- C6 requires no C3 production edit for its three new catalog members.
- I3-1 through I3-6 remain unchanged.
- An unchanged runtime operation uses installed bytes.
- Protected runtime/settings inputs are refused before reading.
- Prepared projections, input bindings and manifest derivation stay enforced.

C4:

- The public entrypoint is `.ai/tools/git-safe.mjs`.
- Its six commands are `diff`, `log`, `show`, `cat`, `ls` and `grep`.
- The entrypoint is an unconditional thin CLI over a sibling core.
- Alternate paths must not turn an invocation into a silent successful no-op.
- C6 neither imports that executable nor duplicates its argument grammar.
- Permitting git-safe leaves its validation, policy checks and output limits intact.
- Section 3.10 checks the complete reviewed runtime unit at prepare, both diff
  boundaries and commit.
- Unchanged runtime candidates need declared, bound input roles.
- I4-1 through I4-4 and the C4 freeze addendum remain unchanged.

C5:

- `review-diff` is the seventh public command through `git-safe.mjs`.
- Its public form is:

```text
node .ai/tools/git-safe.mjs review-diff --base <ref> [--head <ref>]
```

- It accepts `--out <file>` and `-- <paths>...`.
- `review-diff.mjs` is an internal helper, not a separate public CLI.
- C5 adds that helper to the catalog, producing four members before C6.
- Reserved run IDs, artifact safety, literal selectors and output limits remain unchanged.
- C5 acceptance is `18 PASS / 0 FAIL / 0 SKIP`.

C6 does not require additional C4/C5 exports.

## 2. Files touched and interfaces

Paths are relative to `project-setup/`. Existing line ranges refer to `d30fbe5`.
C5 may shift lines before C6 starts; named regions identify the edits.

### 2.1 Existing files

| File | Baseline lines | Change |
| --- | --- | --- |
| `scripts/merge-claude-settings.mjs` | 2-29 | Contract, imports and CLI usage |
| Same | 98-100 | Pure hook merge and private staging helpers |
| Same | 100-211 | Conditional normal merge and hooks-only staging |
| `scripts/apply.mjs` | 53-54 | Import canonical hook identity from the core |
| Same | 298-348 | Exact canonical-addition comparison |
| Same | 913-978 | Evaluate exemption after safe reads and runtime checks |
| `data/runtime-units.json` | 1-23 | Extend C5's four members to seven |
| `references/claude.md` | 79-90 | Replace obsolete default-hook text |
| `README.md` | 19-21 | Insert hook-specific contract and limitations |
| `tests/rc1-cases.mjs` | 8-13, 34-139 | Import and register C6 |
| `tests/run-tests.mjs` | 902-945 | Aggregate C6 within R29 |
| Same | 1146-1173 | Stage all seven runtime members in `freshSetup` |
| `tests/c3.test.mjs` | 334 | Extend exact merge export set |
| `tests/c4.test.mjs` | 2383-2400 | Extend production catalog and unit constants |
| Same | 2620-3055 | Extend existing unit loops, order and recovery expectations |

`tests/c5.test.mjs` is absent at d30fbe5. Once C5 lands, its production transaction fixtures
must use the seven-member unit. Its isolated review-command fixtures need no hook assets.

The tests lane owns all test edits. The implementer may not edit those tests.

No changes to C1/C2 expectations, C3's synthetic catalogs or its existing CLI behavior
assertions are needed. No C3 production, ownership-schema, validation or release changes.

### 2.2 New files

```text
assets/tools/guard-raw-git-core.mjs
assets/tools/guard-raw-git.mjs
assets/tools/hooks-selftest.mjs
tests/fixtures/guard-raw-git-cases.json
tests/c6.test.mjs
```

No package dependency or general shell-parser framework.

### 2.3 Guard core

`guard-raw-git-core.mjs` exports exactly:

```typescript
BLOCKED_SUBCOMMANDS: readonly string[];

RAW_GIT_HOOK: Readonly<{
  event: "PreToolUse";
  matcher: "Bash|PowerShell";
  command: 'node "$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs"';
}>;

inspectCommand(
  command: unknown,
  toolName?: unknown
): "allow" | "block" | "malformed";

evaluateHookInput(text: unknown): {
  exitCode: 0 | 1 | 2;
  stdout: string;
  stderr: string;
};
```

`toolName` defaults to `"Bash"` only when omitted.

Both functions are synchronous and pure. Invalid types and parsing failures return malformed
results rather than throwing. They perform no filesystem access, environment lookup or spawning.

Both constants are frozen. Importing the core performs no I/O or exit-code change.

### 2.4 Guard entrypoint

`guard-raw-git.mjs` exports nothing. It unconditionally:

1. Imports `evaluateHookInput` from its sibling core.
2. Reads stdin.
3. Rejects unexpected CLI arguments as malformed input.
4. Writes the returned stdout/stderr.
5. Sets `process.exitCode`.

It never compares `argv[1]` with `import.meta.url` and never calls `process.exit`.

Unexpected runtime exceptions, including `RangeError`, map to the exact malformed result.
No stack trace or native error text is printed.

### 2.5 Merge API

The merge module exports exactly:

```typescript
mergeManagedDenies;

mergeManagedHooks(input: {
  settings: object;
  managed: object;
  guardReady: boolean;
}): {
  settings: object;
  managed: object;
  report: {
    added: HookIdentity[];
    alreadyPresent: HookIdentity[];
    alreadyCovered: HookIdentity[];
    skipped: null | string;
  };
};
```

`HookIdentity` is `{event:string,matcher:string,command:string}`.

The function is synchronous, pure and input-preserving. Returned JSON is detached and mutable.
It inserts or recognizes the canonical hook only. It has no replace/remove operation.

### 2.6 Self-test API and entrypoint choice

Keep `hooks-selftest.mjs` as one import-safe module plus CLI. It exports exactly:

```typescript
runHooksSelfTest(options?: {
  hookPath?: string;
  execute?: (
    executable: string,
    argv: string[],
    options: {
      input: string;
      shell: false;
      windowsHide: true;
      encoding: "utf8";
      timeout: 5000;
      maxBuffer: 65536;
    }
  ) => ProcessResult | Promise<ProcessResult>;
}): Promise<{
  ok: boolean;
  code: null | "HOOK_SELFTEST_FAILED";
  cases: Array<{
    id: "allowed" | "blocked" | "malformed";
    passed: boolean;
  }>;
  exitCode: 0 | 1;
  stdout: string;
  stderr: "";
}>;
```

The smaller alternative to another core file is an exact-transcript consumer requirement:
C10 MUST reject empty or non-exact stdout even when the self-test process exits 0.

Default `hookPath` is the absolute sibling `guard-raw-git.mjs`, resolved from `import.meta.url`,
independently of cwd. An injected path must be a nonempty absolute path.

The executor receives `process.execPath`, `[hookPath]` and the exact options above.
It never executes the command string in the hook input.

A valid executor result has:

- `status`: an integer or null;
- `signal`: a string or null;
- `error`: undefined or null;
- `stdout` and `stderr`: strings.

Other results are invalid. A case passes only with the expected status and streams and
`signal:null`. Executor throws/rejections are failed cases.

Invalid options throw:

```text
code: HOOK_SELFTEST_OPTIONS
message: HOOK_SELFTEST_OPTIONS: invalid self-test options
```

Invalid includes a non-object options value, unknown keys, invalid `hookPath`, or a
non-function `execute`. The CLI accepts no arguments.

### 2.7 Catalog and later consumers

Retain catalog schema 1. Each row below has:

```text
source = assets/tools/<name>
target = .ai/tools/<name>
policySchemas = [1, 2]
```

Exact ordered rows:

| Name | Role |
| --- | --- |
| `security-policy.mjs` | `helper` |
| `git-safe-core.mjs` | `helper` |
| `guard-raw-git-core.mjs` | `helper` |
| `review-diff.mjs` | `helper` |
| `git-safe.mjs` | `entrypoint` |
| `guard-raw-git.mjs` | `entrypoint` |
| `hooks-selftest.mjs` | `entrypoint` |

The three new files are installed runtime members and use full ownership.
`policySchemas` is a required catalog field indicating compatibility; it does not claim that
the hook or self-test reads policy.

The existing write-order algorithm produces the table order, then remaining non-policy
content, dependent policy and manifest.

C3 stage automatically handles all seven members. Its existing migration gate also sees
installed hook assets as installed runtime members. Thus a schema-2 policy change can require
the migration workflow even when only hook assets are installed.

C4's complete-unit rule applies unchanged. Any runtime create/modify requires reviewed
candidates for all seven. An unchanged member needs a declared, bound input role.
Unrelated plans without runtime create/modify do not force an upgrade.

| Consumer | C6 contract |
| --- | --- |
| C7 | Preserve staged settings; patch only its own request fields |
| C8 | Canonical identity, hooks-only staging, installed paths and seven-member unit |
| C10 | Self-test API, CLI transcript and failure conditions |
| C11b | C6 registration, fixtures, catalog and installed asset inventory |

C10 must reject a missing self-test, launch failure, timeout, nonzero exit, nonempty stderr,
empty stdout or stdout different from the exact success transcript.

The self-test proves direct hook behavior. It does not prove that settings references the hook
or that Claude executes it. R73 integration belongs to C10; broader presence checks remain
with their assigned validation/deferred work.

## 3. Behavior

### 3.1 Fixed process outcomes

All output uses LF, including Windows.

```javascript
ALLOW = {
  exitCode: 0,
  stdout: "",
  stderr: ""
};

BLOCK = {
  exitCode: 2,
  stdout: "",
  stderr: "guard-raw-git: raw Git command blocked; use node .ai/tools/git-safe.mjs\n"
};

MALFORMED = {
  exitCode: 1,
  stdout: "",
  stderr: "guard-raw-git: could not parse command; allowed without checking\n"
};
```

Malformed input is the accepted frozen fail-open-but-loud behavior. Deny rules remain the
last line of defense. No command text, input body, native error or stack trace is echoed.

### 3.2 Blocked list and precedence

`BLOCKED_SUBCOMMANDS` is exactly:

```text
diff show log blame cat-file grep archive format-patch whatchanged
stash reflog diff-tree range-diff
```

The array contains those 13 strings in that order.

Comparison of executable names, blocked subcommands and the `alias.` configuration prefix
is ASCII case-insensitive. Actual Git for Windows uppercase-subcommand behavior remains
TO VERIFY; the guard conservatively blocks uppercase equivalents.

Decision precedence:

1. Any lexical failure anywhere in the command gives MALFORMED.
2. Otherwise, any blocked subcommand or inline `-c alias.*` override gives BLOCK,
   regardless of remaining arguments.
3. Otherwise, any qualifying standalone `-p` or `--patch` gives BLOCK.
4. Otherwise, a missing recognized global-option value gives MALFORMED.
5. Otherwise, ALLOW.

A missing post-subcommand option value is not a lexical failure.

Every stash invocation blocks, including unknown future subcommands.

### 3.3 Lexing and command positions

The parser is a small scanner, not a shell evaluator.

Common behavior:

- Recognize whitespace-delimited words and quoted word fragments.
- Remove syntactic quotes and concatenate adjacent fragments of one word.
- Preserve literal quoted regions and substitution boundaries.
- Split on unquoted `;`, `&&`, `||`, `|`, CRLF and LF.
- Inspect `$()` substitutions recursively, except inside single quotes or literal bodies.
- Parentheses delimit executable groups and restore command position inside them.
- Limit nested groups/substitutions to 128. Greater depth gives MALFORMED.
- Unmatched quotes/groups/substitutions, dangling escapes, NUL or unterminated literal
  bodies give MALFORMED.
- Empty and whitespace-only strings allow.
- Finish lexical validation before selecting BLOCK or ALLOW.

Bash:

- Unquoted `&` is also a separator.
- `(` and `{` enter command position; corresponding closers end the group.
- At command position, `do`, `then`, `else`, `!`, `if`, `while` and `until` permit the
  following command to be inspected.
- `done` and `fi` are control terminators.
- `command`, optional `--`, `exec`, `time`, and `env` are recognized simple prefixes.
- Leading assignments are skipped, including assignments after `env`.
- This does not interpret arbitrary options to `env`, `exec` or `time`.
- A `#` at the beginning of an unquoted token starts a comment through end of line.
  Quotes and substitutions inside the comment are not parsed.
- Inspect paired backtick command substitutions.
- Inspect process substitutions `<(...)` and `>(...)`.
- Backslash escapes the next character outside single quotes.
- Within double quotes, backslash escapes `"`, `\`, `$`, backtick and physical newline;
  other backslashes are retained.
- Backslash-newline and backslash-CRLF continuations are removed.
- Single quotes preserve backslashes literally.

PowerShell:

- A separate `&` token is a call prefix, not Bash background syntax.
- Backtick escapes the next character outside single quotes.
- Backtick-LF and backtick-CRLF continuations are removed.
- A backtick inside single quotes is literal.
- A final escaping backtick is malformed.
- Inspect executable parenthesized expressions and `$()` inside double quotes.
- A token-start `#` begins a line comment.
- Do not interpret computed invocation names or script blocks.

Command text inside a quoted argument is not a command position. Substitutions inside
double-quoted arguments are inspected.

### 3.4 Literal bodies

Bash heredocs:

- Outside quotes, recognize `<<` and `<<-` followed by a delimiter word.
- Quote removal determines the delimiter. Empty or missing delimiters are malformed.
- Do not evaluate the delimiter.
- The body begins after the next physical newline.
- Consume through a line equal to the delimiter.
- For `<<-`, remove leading tabs for delimiter comparison.
- Treat body bytes as literal: do not parse quotes, groups, comments or commands there.
- Resume scanning after the terminator line.
- Multiple pending heredocs are consumed in declaration order.
- A missing terminator is malformed.

PowerShell here-strings:

- Outside quotes, `@'` or `@"` as the last non-whitespace characters of a line opens a body.
- Close with a line starting respectively `'@` or `"@`.
- Treat the body as one literal argument.
- Resume scanning after the closing marker.
- Missing termination is malformed.

Expansion inside unquoted Bash heredocs and double-quoted PowerShell here-strings is an
accepted residual. Literal-body handling prevents false blocks on ordinary commit messages.

### 3.5 Executables and Git arguments

Recognize at command position:

- `git`, `git.exe`;
- a slash- or backslash-separated path whose final component is `git` or `git.exe`.

Quotes may surround executable paths. Apply shell escaping before executable comparison.

Do not recognize `mygit`, `git-safe.mjs`, `git-wrapper`, `git.dll` or `git.exe.bak`.

Recognized global options:

| Form | Treatment |
| --- | --- |
| `-C <value>`, `-C<value>` | Consume value |
| `-c <value>`, `-c<value>` | Inspect alias key, then consume |
| `--git-dir <value>`, `--git-dir=<value>` | Consume value |
| `--work-tree <value>`, `--work-tree=<value>` | Consume value |
| `--namespace <value>`, `--namespace=<value>` | Consume value |
| `--no-pager`, `-P`, `--paginate` | No value |
| `--bare`, `--no-optional-locks`, `--literal-pathspecs` | No value |

For `-c`, the key is the portion before the first `=`. A key beginning `alias.` blocks.
Attached, separate and quoted configuration forms are covered.

Unknown global options do not consume a following token. Skip the option token and continue
to the first non-option token as the candidate subcommand.

On non-blocked subcommands only, these post-subcommand options consume one separate value
when scanning for standalone patch arguments:

```text
-m --message -F --file -C --reuse-message -c --reedit-message
--author --date --template --cleanup -b -B --orphan
--repo --receive-pack --upload-pack
```

A missing post-subcommand value ends scanning. It does not produce MALFORMED.
Attached short values and `--name=value` remain single tokens.

Examples:

```text
git commit "-p"          BLOCK
git commit '--patch'     BLOCK
git commit -m "-p"       ALLOW
git commit --message=-p  ALLOW
git commit -m            ALLOW
git status -b            ALLOW
git diff -b              BLOCK
git log -m               BLOCK
```

Standalone patch arguments after `--` also block. Bundled short flags such as `-ap` are
outside the frozen standalone-argument rule.

There is no git-safe substring exemption. A Node invocation passes because it is not raw Git;
every later command segment and outer substitution is still checked.

### 3.6 Hook process and host contract

Minimum accepted stdin:

```json
{"tool_name":"Bash","tool_input":{"command":"git status"}}
```

The other accepted tool name is exactly `"PowerShell"`.

Require:

- One complete JSON document, allowing surrounding JSON whitespace.
- A non-array root object.
- One of the two exact tool names.
- A non-array `tool_input` object.
- A string `tool_input.command`.

Other host fields are ignored. Missing fields, incorrect types, invalid JSON, stdin read
failure and unexpected CLI arguments produce MALFORMED. Print no JSON permission response.

Retain the exact candidate:

```text
node "$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs"
```

Host expectations, all TO VERIFY:

| Direct process result | Intended host behavior |
| --- | --- |
| Exit 0, empty streams | Permit |
| Exit 2, fixed stderr | Deny and show explanation |
| Exit 1, fixed stderr | Continue and show warning |

Also TO VERIFY:

- PowerShell tool name spelling and its `tool_input.command` field.
- `Bash|PowerShell` matcher regex semantics.
- Root-variable expansion and quoting.
- `$CLAUDE_PROJECT_DIR` containing backslashes inside Git Bash double quotes.
- Root/subdirectory launches, spaces and non-ASCII project paths.
- Missing Node behavior.

Direct Node tests establish none of these host facts.

### 3.7 Hook identity and pure merge

Define `H` as:

```json
{
  "event": "PreToolUse",
  "matcher": "Bash|PowerShell",
  "command": "node \"$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs\""
}
```

Define canonical settings entry `E`:

```json
{
  "matcher": "Bash|PowerShell",
  "hooks": [
    {
      "type": "command",
      "command": "node \"$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs\""
    }
  ]
}
```

Metadata stores H, not E.

An occurrence matches only when event, enclosing matcher and nested command match exactly,
and the nested hook has `type:"command"`.

Validation order:

1. Require exactly `settings`, `managed`, `guardReady` input keys and their declared types.
2. Validate managed metadata with C2's settings reader.
3. Evaluate readiness.
4. Check hooks containers.
5. Find occurrences and merge.

Invalid API input throws:

```text
code: HOOK_INPUT
message: HOOK_INPUT: invalid hook merge input
```

C2 metadata errors propagate unchanged.

Report always contains:

```javascript
{
  added: [],
  alreadyPresent: [],
  alreadyCovered: [],
  skipped: null
}
```

If `guardReady:false`, preserve settings and metadata and set:

```text
guard-raw-git.mjs not staged or installed
```

If `hooks` is present but not an object, or `hooks.PreToolUse` is present but not an array,
preserve everything and set:

```text
hooks or PreToolUse has an unsupported container; managed hook not added
```

These are successful skips. They do not abort deny merging.

Otherwise:

- No matching occurrence: append E to `hooks.PreToolUse`.
- Add H to `managed.hooks` only if absent.
- One or more matching occurrences and H is owned: leave all occurrences untouched and report
  `alreadyPresent:[H]`.
- One or more matching occurrences and H is unowned: leave them untouched and report
  `alreadyCovered:[H]`; do not adopt.
- Duplicate settings occurrences are neither removed nor fatal.
- Existing metadata duplicates remain C2 validation errors.
- An absent occurrence whose H is already owned is restored once and reported `added:[H]`.

Preserve every user entry, option and order, including same-command hooks under other events
or matchers and legacy shapes.

A created `PreToolUse` key goes last in `hooks`. A created `hooks` key goes last in settings,
after any `permissions` key created by deny composition. A newly created `managed.hooks` key
goes last in managed metadata.

If no hook is owned and no `managed.hooks` key existed, leave the key absent. Preserve an
existing empty array rather than deleting it.

### 3.8 Readiness and safe staging

Normal merge and hooks-only staging may ensure H only when:

- The run has a canonical guard draft equal to the trusted guard source under the existing
  normalized hash function; or
- No canonical guard draft exists, and the installed canonical guard equals that source.

A present draft takes precedence. An unreviewed draft does not fall back to a reviewed
installed file. Missing or unequal candidates produce the exact skipped report above.

Readiness concerns the guard entrypoint. The complete-unit gate ensures its helper and the
other runtime members accompany any runtime update. Self-test detects broken installed
execution; readiness is not a substitute for either control.

Never trust a run-local hash, version claim or metadata declaration as byte equality.

Before reading settings, their draft, guard candidates or request files:

- Apply existing containment and link checks.
- Check logical project targets and actual read paths against the shipped-plus-installed
  refusal set.
- Refuse protected content before reading or copying it.
- Do not follow links or junctions in run/project input paths.

No new operation executes staged code.

### 3.9 Hooks-only staging

Add:

```text
node <SKILL_DIR>/scripts/merge-claude-settings.mjs --run-id <id> --hooks-only
```

This mode accepts only `--run-id <id>` and the valueless `--hooks-only` flag.
It rejects positional arguments, unknown options, duplicate options and combinations with
`--allow-file` or `--override-user-exceptions`.

Use the existing run-ID validation, including C5's reserved-name rejection.

Read and validate all inputs before writing:

1. Installed settings and manifest.
2. Existing staged settings draft, if present.
3. `ownership.json` and `managed-keys.json`, if present.
4. Trusted source and selected guard candidate.

Base settings on the staged draft when present, otherwise installed settings. If both are
absent, use:

```json
{"$schema":"https://json.schemastore.org/claude-code-settings.json"}
```

Effective managed metadata is installed settings metadata patched by the staged settings
metadata fields. This is C2's field-patching behavior, not a replacement of the whole record.

Apply only `mergeManagedHooks`. Do not invoke `mergeManagedDenies`, render controls or consume
migration decisions.

Patch only:

```text
managed-keys.json[".claude/settings.json"].hooks
```

If the returned managed object has no hooks key, make no hooks request.
Do not create an empty settings record merely to omit the key.

When a hooks request is staged, set the settings ownership request to `"keys"`, preserving
other targets. A conflicting existing ownership request fails; do not overwrite it.

Preserve every other request field and file, including `permissions.*`, `heldBack`,
omissions, transaction inputs, migration decisions and manifest metadata.

Settings serialization uses the original project file's indentation and EOL, even when the
base is a staged draft. If the merged values equal the base, preserve its bytes and do not
rewrite it. Changed output has no BOM and one final newline.

Request files use two-space JSON plus LF only when changed. Unchanged request bytes are retained.

Success envelope, in this key order:

```javascript
{
  ok: true,
  changed: boolean,
  metadataChanged: boolean,
  needsDecision: false,
  draft: string | null,
  report: { hooks: HookReport }
}
```

- `changed`: this invocation wrote settings draft bytes.
- `metadataChanged`: this invocation changed either request file.
- `draft`: `.ai/.run/<id>/drafts/.claude/settings.json` if that draft exists on success,
  including a previously staged unchanged draft; otherwise null.
- `report.hooks`: the complete pure report.

Serialize with two spaces and final LF on stdout. Exit 0, empty stderr.

Normal merge retains its existing envelope and deny behavior. It adds `report.hooks`,
conditionally ensures H after permission composition, and patches only the hook metadata
field in addition to its existing fields. Its existing `changed` meaning remains unchanged.

Migration sequencing:

```text
C3 stage -> C6 hooks-only -> C7 own-field staging -> prepare -> diff -> commit
```

C7 must follow the same layering rule: use staged settings and preserve C3/C6-owned fields.
C8 owns documenting that workflow in setup instructions.

### 3.10 Staging errors

New C6 staging failures use this exact envelope:

```javascript
{ ok: false, code, error, target }
```

Two-space JSON, final LF, stdout only, empty stderr. `target` is always present and is either
a project-relative path, a skill-relative source path or null.

| Code | Exit | Exact error |
| --- | --- | --- |
| `HOOK_STAGE_USAGE` | 1 | `usage: merge-claude-settings.mjs --run-id <id> --hooks-only` |
| `HOOK_STAGE_JSON` | 3 | `invalid hook staging JSON: <path>` |
| `HOOK_STAGE_METADATA` | 3 | `invalid hook staging metadata: <path>` |
| `HOOK_STAGE_MANIFEST` | 3 | `invalid hook staging manifest: .ai/manifest.json` |
| `HOOK_STAGE_PATH` | 2 | `unsafe hook staging path: <path>` |
| `HOOK_STAGE_PROTECTED` | 3 | `hook staging input is protected: <path>` |
| `HOOK_STAGE_IO` | 2 | `cannot read hook staging input: <path>` |
| `HOOK_STAGE_SOURCE` | 3 | `trusted hook source is unavailable: assets/tools/guard-raw-git.mjs` |
| `HOOK_STAGE_WRITE` | 2 | `cannot write hook staging output: <path>` |

Usage has `target:null`. Other targets are the path appearing in the error.

Invalid settings JSON uses `HOOK_STAGE_JSON`. A non-object settings root also uses that code.
Malformed hooks containers remain successful skips, not JSON failures.

Invalid manifest JSON or schema uses `HOOK_STAGE_MANIFEST`.
Invalid request JSON uses `HOOK_STAGE_JSON`; invalid request structure, managed metadata or
conflicting ownership uses `HOOK_STAGE_METADATA`.

Existing root/run initialization, run-ID and policy-reader failures retain their established
contracts. New input failures occur before writes. A write failure may leave run-local staging
partially updated, but never changes project settings; rerun before prepare.

For the normal merge, these new envelopes apply only to new C6 input/readiness/staging paths.
Its pre-existing failures remain unchanged.

### 3.11 Apply approval boundary

Keep ordinary settings equality order-sensitive through existing `sameJson`.

The sole new content exemption is an exact final E append:

- E is the last `PreToolUse` element.
- E has exactly keys `matcher`, `hooks`, in that order.
- Its hooks array has exactly one element.
- The inner object has exactly keys `type`, `command`, in that order.
- Removing E restores the original hooks value under order-sensitive `sameJson`.
- If original `PreToolUse` was absent, the new key must be last and its value exactly `[E]`.
- If original `hooks` was absent, the new value must be exactly `{PreToolUse:[E]}`.
- No user option, hook, matcher, event or ordering changes accompany it.

The exemption additionally requires reviewed guard bytes.

Evaluate this after existing safe body reads and C3/C4 checks, before approval evaluation.
Use an actual create/modify guard candidate; an unchanged operation uses installed bytes.
For an installed guard without a content operation, require an existing declared transaction
input before reading it. Do not silently add a role or input binding.

If readiness cannot be established, retain the normal hooks-change approval reason.
Existing runtime or path errors retain precedence.

Every other hooks change keeps:

```text
draft changes user settings key "hooks"
```

Managed metadata changes/removals keep:

```text
settings ownership or managed metadata changes
```

No new replacement/removal API is required. Tests create explicit reviewed drafts and metadata
requests under C2.

Missing approval for combined hook content and ownership changes gives P envelope, exit 3:

```text
target: .claude/settings.json
code: APPLY_APPROVAL_REQUIRED
error: draft changes user settings key "hooks"; settings ownership or managed metadata changes. Show the diff; re-run prepare with --approve-user-content .claude/settings.json only after the user approves it
```

Metadata-only removal uses:

```text
metadata changes require --approve-user-content .claude/settings.json
```

Serialization and empty stderr remain C2's contract.

### 3.12 Self-test behavior

Run exactly three cases, in order:

| ID | Exact stdin | Expected |
| --- | --- | --- |
| `allowed` | `{"tool_name":"Bash","tool_input":{"command":"git status"}}` | ALLOW |
| `blocked` | `{"tool_name":"Bash","tool_input":{"command":"git diff"}}` | BLOCK |
| `malformed` | `{` | MALFORMED |

Restate expectations independently; do not import expected results from the guard core.

Continue after failures. Do not forward child output or native errors.

Success stdout:

```text
PASS  guard-raw-git/allowed
PASS  guard-raw-git/blocked
PASS  guard-raw-git/malformed
3 PASS / 0 FAIL
```

Final LF, empty stderr, exit 0, `ok:true`, `code:null`.

Failure uses FAIL on failed cases and actual totals. Exit 1, `ok:false`,
`code:"HOOK_SELFTEST_FAILED"`, empty stderr.

An always-zero silent hook produces:

```text
PASS  guard-raw-git/allowed
FAIL  guard-raw-git/blocked
FAIL  guard-raw-git/malformed
1 PASS / 2 FAIL
```

A missing hook produces three FAIL lines and `0 PASS / 3 FAIL`.

Unexpected self-test CLI arguments produce exit 1, empty stdout and:

```text
hooks-selftest: usage: node .ai/tools/hooks-selftest.mjs
```

with final LF on stderr.

### 3.13 Documentation

Add these exact paragraphs to README:

```text
The Claude raw-Git hook is a guardrail, not a sandbox. It blocks the documented raw-history
commands and standalone patch arguments while permitting ordinary orchestrator commands and
the seven git-safe commands. A separate raw-Git command after git-safe is still checked.
Setup draft review uses apply.mjs diff; git diff --no-index has no exemption.

Known gaps include sh -c, aliases, scripts that spawn Git and node -e. PowerShell gaps include
indirect or computed invocation, dynamically constructed command names, script blocks and
encoded commands. Backtick handling does not make this a complete shell parser.

The installed candidate is node "$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs".
Host portability is TO VERIFY. Direct Node self-tests do not establish host launch,
matcher, input-envelope or exit-handling behavior.

The hook executes project code and therefore depends on the trusted-checkout boundary.
```

Replace the obsolete default-hook section in `references/claude.md`. Tests assert these exact
substrings:

- The canonical E JSON shown in section 3.7.
- `PreToolUse`.
- `Bash|PowerShell`.
- `node .ai/tools/hooks-selftest.mjs`.
- `--hooks-only`.
- `guard-raw-git.mjs not staged or installed`.
- `TO VERIFY`.
- The complete BLOCK and MALFORMED messages.
- This exact Markdown table:

```text
| Exit | stdout | stderr | Intended host result |
| --- | --- | --- | --- |
| 0 | empty | empty | permit |
| 2 | empty | blocked message | deny |
| 1 | empty | malformed message | continue with warning |
```

Also state the host uncertainties in section 3.6, conditional insertion, non-adoption of user
duplicates, hooks-only layering, exact self-test success transcript, and C10's exact-output
requirement. Do not claim validate integration is implemented by C6.

## 4. Tests and registration

### 4.1 Descriptors

`tests/c6.test.mjs` exports exactly `C6_IMPLEMENTATIONS`, a frozen array of `{id,run}`.

Register these descriptors in order:

| ID | Name |
| --- | --- |
| `R50/C6/parser` | `raw Git parser handles frozen command forms` |
| `R50/C6/sanctioned` | `seven sanctioned commands preserve later raw Git checks` |
| `R50/C6/documentation` | `hook limitations and host verification remain explicit` |
| `R51/C6/process` | `hook stdin streams and alternate paths are exact` |
| `R51/C6/malformed` | `malformed input follows the frozen fail-open contract` |
| `R52/C6/merge` | `conditional hook merge preserves users and reruns` |
| `R52/C6/staging` | `hooks-only staging preserves migration projections` |
| `R79/C6/identity` | `hook identity preserves event matcher options and order` |
| `V2/C6/transaction` | `hook settings and ownership share existing approval rules` |
| `R72/C6/selftest` | `installed hook self-test reports exact outcomes` |
| `V2/C6/runtime-unit` | `hook assets extend the reviewed runtime unit` |
| `R84/C6/arguments` | `stash patch and alias rules preserve orchestrator commands` |

Add C6 to both registry maps. No complete numbered-case records or host skip records.

### 4.2 Parser fixture

Format:

```typescript
{
  schema: 1;
  cases: Array<{
    id: string;
    toolName: "Bash" | "PowerShell";
    command: string;
    expected: "allow" | "block" | "malformed";
  }>;
}
```

Each row is tested in-process through `inspectCommand` and `evaluateHookInput`.
The latter receives the minimum envelope and must equal the full ALLOW/BLOCK/MALFORMED object.

A/B/M below mean those exact results. Default tool is Bash.
`\n` denotes an actual LF; backticks are literal where shown.

| ID | Command | Result |
| --- | --- | --- |
| P01 | `git diff` | B |
| P02 | `git show HEAD` | B |
| P03 | `git log -n1` | B |
| P04 | `git blame src/a.ts` | B |
| P05 | `git cat-file blob HEAD:a` | B |
| P06 | `git grep needle HEAD` | B |
| P07 | `git archive HEAD` | B |
| P08 | `git format-patch HEAD~1` | B |
| P09 | `git whatchanged` | B |
| P10 | `git stash` | B |
| P11 | `git reflog` | B |
| P12 | `git diff-tree HEAD` | B |
| P13 | `git range-diff A..B C..D` | B |
| P14 | `git -C . diff` | B |
| P15 | `git -C. show HEAD` | B |
| P16 | `git --no-pager log` | B |
| P17 | `git -P log` | B |
| P18 | `git --paginate log` | B |
| P19 | `git --git-dir=.git --work-tree=. diff` | B |
| P20 | `git --git-dir .git --work-tree . diff` | B |
| P21 | `git -c color.ui=false log` | B |
| P22 | `git.exe show HEAD` | B |
| P23 | `/usr/bin/git log` | B |
| P24 | `"C:\Program Files\Git\cmd\git.exe" diff` | B |
| P25 | `command -- git show HEAD` | B |
| P26 | `X=1 git log` | B |
| P27 | `cd src && git show HEAD` | B |
| P28 | `git status; git log` | B |
| P29 | `git status || git show HEAD` | B |
| P30 | `git status | git log` | B |
| P31 | `git status\ngit diff` | B |
| P32 | `echo "$(git log)"` | B |
| P33 | Bash: ``echo `git show HEAD` `` | B |
| P34 | `echo '$(git log)'` | A |
| P35 | PowerShell: ``g`it l`og`` | B |
| P36 | PowerShell: `& "C:\Program Files\Git\cmd\git.exe" show HEAD` | B |
| P37 | PowerShell: ``git `\nlog`` | B |
| P38 | PowerShell: ``git commit "`-p"`` | B |
| P39 | `git commit -p` | B |
| P40 | `git commit --patch` | B |
| P41 | `git commit "-p"` | B |
| P42 | `git commit '--patch'` | B |
| P43 | `git commit -m "-p"` | A |
| P44 | `git commit -m "--patch"` | A |
| P45 | `git commit --message=-p` | A |
| P46 | `git commit -m "git log; git diff"` | A |
| P47 | `git commit -- -p` | B |
| P48 | `git -p status` | B |
| P49 | `git -c alias.x=log x` | B |
| P50 | `git -calias.x=log x` | B |
| P51 | `git -c "alias.x=!git log" status` | B |
| P52 | `git -c ALIAS.x=log status` | B |
| P53 | `git status` | A |
| P54 | `git branch --show-current` | A |
| P55 | `git fetch origin` | A |
| P56 | `git rev-parse HEAD` | A |
| P57 | `git commit -m "normal message"` | A |
| P58 | `git push origin HEAD` | A |
| P59 | `git checkout main` | A |
| P60 | `git add -- src/a.ts` | A |
| P61 | `git switch main` | A |
| P62 | `git merge --no-ff topic` | A |
| P63 | `git reset --soft HEAD~1` | A |
| P64 | `git -C . --no-pager status` | A |
| P65 | `git -c color.ui=false status` | A |
| P66 | `git diff --no-index a b` | B |
| P67 | `mygit log` | A |
| P68 | `git.exe.bak log` | A |
| P69 | `echo "git log"` | A |
| P70 | `git commit "unterminated` | M |
| P71 | `echo "$(git log"` | M |
| P72 | `git -C` | M |
| P73 | `git commit -m` | A |
| P74 | empty string | A |
| P75 | three spaces | A |
| P76 | `git commit -m "$(git show HEAD)"` | B |
| P77 | `git commit -m "-p" --patch` | B |
| P78 | `"git" "log"` | B |
| P79 | `g"i"t l"o"g` | B |
| P80 | PowerShell: final backtick after `git status ` | M |
| P81 | `git diff -b` | B |
| P82 | `git log -m` | B |
| P83 | `git show -c` | B |
| P84 | `git stash push -m` | B |
| P85 | `git status -b` | A |
| P86 | `git log -C` | B |
| P87 | `git status & git log` | B |
| P88 | `(git log)` | B |
| P89 | `{ git log; }` | B |
| P90 | `for c in a b; do git show $c; done` | B |
| P91 | `if true; then git log; fi` | B |
| P92 | `if false; then echo ok; else git log; fi` | B |
| P93 | `! git log` | B |
| P94 | `env X=1 git log` | B |
| P95 | `exec git log` | B |
| P96 | `time git log` | B |
| P97 | `git status # don't parse "git log` | A |
| P98 | `cat <(git log)` | B |
| P99 | PowerShell: ``git commit -m 'a`'`` | A |
| P100 | PowerShell: `Write-Output (git log)` | B |
| P101 | PowerShell: `Write-Output "$(git log)"` | B |
| P102 | PowerShell: `node .ai\tools\git-safe.mjs log` | A |
| P103 | PowerShell: `node .ai\tools\git-safe.mjs log; git log` | B |
| P104 | Bash: `git \` followed by LF then `log` | B |
| P105 | Bash: `C:\Git\cmd\git.exe diff` | A |
| P106 | `git LOG` | B |
| P107 | 2000 `$(`, then `git status`, then 2000 `)` | M |
| P108 | `git diff "unterminated` | M |
| P109 | `git -c alias.x=log -C` | B |
| P110 | `git status # git log\ngit show HEAD` | B |
| P111 | `while true; do git log; done` | B |
| P112 | `until false; do git log; done` | B |
| P113 | `cat >(git log)` | B |

Literal-body rows, exact commands:

H01, ALLOW:

```bash
git commit -m "$(cat <<'EOF'
don't change parser's handling
1) git diff is faster
EOF
)"
```

H02 is H01 plus LF and `git log`, BLOCK.

H03, PowerShell, ALLOW:

```powershell
git commit -m @'
don't change parser's handling
'@
```

H04, ALLOW:

```bash
git commit -F - <<'EOF'
git diff is faster
EOF
```

H05 is H04 without its final `EOF` line, MALFORMED.

H06, PowerShell, ALLOW:

```powershell
git commit -m @"
keep "quoted" words
"@
```

H07 is H03 without its final `'@` line, MALFORMED.

H08, ALLOW: exact H04 shape with `<<-'EOF'` and one leading tab on both body and terminator.

H09, ALLOW:

```bash
git commit -F - <<EOF
$(git log)
EOF
```

H09 records the accepted unquoted-body substitution residual; it never executes Git.

Stash rows, all BLOCK:

```text
S01 git stash list
S02 git stash show
S03 git stash push
S04 git stash save
S05 git stash pop
S06 git stash apply
S07 git stash drop
S08 git stash clear
S09 git stash branch work
S10 git stash create
S11 git stash store abc
S12 git stash export
S13 git stash import abc
S14 git stash -p
S15 git stash --help
S16 git stash future-subcommand
```

Sanctioned rows, all ALLOW:

```text
G01 node .ai/tools/git-safe.mjs diff A..B
G02 node .ai/tools/git-safe.mjs log -p -n1 HEAD
G03 node .ai/tools/git-safe.mjs show HEAD
G04 node .ai/tools/git-safe.mjs cat HEAD -- src/a.ts
G05 node .ai/tools/git-safe.mjs ls HEAD
G06 node .ai/tools/git-safe.mjs grep HEAD needle
G07 node .ai/tools/git-safe.mjs review-diff --base main --head HEAD
G08 node .ai/tools/git-safe.mjs review-diff --base main --out .ai/.run/review/r.patch -- src
```

For G01-G07 add `-raw` rows with suffix ` && git log`, BLOCK.
G08-raw has suffix `; git show HEAD`, BLOCK.

Residual controls, all ALLOW:

```text
L01 sh -c "git log"
L02 node -e "require('child_process').execSync('git log')"
L03 git lg
L04 PowerShell: & ("g" + "it") log
```

Total: 158 fixture rows. No fixture command is executed.

### 4.3 Process tests

Spawn direct hook processes for:

1. Bash `git status`: ALLOW.
2. Bash `git diff`: BLOCK.
3. PowerShell P35: BLOCK.
4. Invalid JSON `{`: MALFORMED.
5. JSON `{}`: MALFORMED.
6. `command:7`: MALFORMED.
7. Unterminated quoted command: MALFORMED.
8. Valid ALLOW stdin with unexpected argv: MALFORMED.
9. P107 nesting limit: MALFORMED.
10. Alternate-path launch with `git diff`: BLOCK.

For case 10, use a Windows directory junction whose launch path differs from realpath;
use a directory symlink on non-Windows. Failure to establish the alternate path fails the
assertion, following C4's launch-test decision. Do not silently omit it.

Assert exact status and stream bytes. Stdin read failure is additionally covered with a
controlled preload/injected filesystem failure, requiring MALFORMED and no stack trace;
this may reuse case 9's process slot only if both behaviors are tested separately in-process.
Budget one additional process if it cannot.

In-process malformed-envelope matrix:

```text
empty stdin
null
[]
{"tool_name":"Bash"}
{"tool_name":"Bash","tool_input":[]}
{"tool_name":"Other","tool_input":{"command":"git status"}}
{"tool_input":{"command":"git status"}}
{"tool_name":"Bash","tool_input":{"command":null}}
```

All equal MALFORMED. Extra ignored fields do not change a valid result.

### 4.4 Pure merge fixtures

M01-M14 assert values only through `mergeManagedHooks`; they do not assert serialization.

Test-defined symbols:

```javascript
U = {
  matcher: "Bash",
  hooks: [{type:"command", command:"node before.mjs", timeout:9}]
};

V = {
  matcher: "PowerShell",
  hooks: [{type:"command", command:"node after.mjs", async:true}]
};

O = {
  matcher: H.matcher,
  hooks: [{
    type:"command",
    command:H.command,
    timeout:17,
    statusMessage:"Keep"
  }],
  userOption:"Keep"
};

A = {
  matcher:"Bash",
  hooks:[{type:"command", command:H.command}]
};

L = {matcher:"Write", command:"x"};
```

H and E are independent test literals matching section 3.7.

Report notation:

```text
ADD = {added:[H],alreadyPresent:[],alreadyCovered:[],skipped:null}
OWN = {added:[],alreadyPresent:[H],alreadyCovered:[],skipped:null}
USER = {added:[],alreadyPresent:[],alreadyCovered:[H],skipped:null}
BAD = all arrays empty; skipped is the malformed-container text
OFF = all arrays empty; skipped is the readiness text
```

All rows use `guardReady:true` unless stated.

| Case | Settings input | Managed input | Settings result | Managed result | Report |
| --- | --- | --- | --- | --- | --- |
| M01 | `{}` | `{}` | `{hooks:{PreToolUse:[E]}}` | `{hooks:[H]}` | ADD |
| M02 | `{hooks:{PreToolUse:[U,V]}}` | `{}` | `[U,V,E]` in same container | `{hooks:[H]}` | ADD |
| M03 | `{hooks:{PreToolUse:[U,O,V]}}` | `{hooks:[H]}` | unchanged | `{hooks:[H]}` | OWN |
| M04 | M03 settings | `{}` | unchanged | `{}` | USER |
| M05 | `{hooks:{PostToolUse:[E]}}` | `{}` | append `PreToolUse:[E]` key | `{hooks:[H]}` | ADD |
| M06 | `{hooks:{PreToolUse:[A]}}` | `{}` | `[A,E]` | `{hooks:[H]}` | ADD |
| M07 | `{hooks:{PreToolUse:[E,E]}}` | `{}` | unchanged | `{}` | USER |
| M08 | `{hooks:[]}` | `{}` | unchanged | `{}` | BAD |
| M09 | `{hooks:{PreToolUse:{}}}` | `{hooks:[]}` | unchanged | `{hooks:[]}` | BAD |
| M10 | `{hooks:{PostToolUse:[L]}}` | `{}` | append `PreToolUse:[E]` key | `{hooks:[H]}` | ADD |
| M11 | `{permissions:{deny:[]},hooks:{PreToolUse:[U,V]}}` | `{}` | append E | `{hooks:[H]}` | ADD |
| M12 | M03 settings | `{hooks:[H]}` | unchanged | `{hooks:[H]}` | OWN |
| M13 | `{hooks:{PreToolUse:[U,V]}}` | `{hooks:[H]}` | `[U,V,E]` | `{hooks:[H]}` | ADD |
| M14 | M01 result | `{hooks:[H]}` | unchanged | `{hooks:[H]}` | OWN |

Additional pure checks:

- M07 with `{hooks:[H]}` gives OWN once, preserves both occurrences.
- M01 with `guardReady:false` returns `{}`, `{}`, OFF.
- M08 with `guardReady:false` returns OFF, establishing skip precedence.
- Existing unrelated metadata keys retain values and order.
- Adding H appends after other managed identities.
- Invalid API input throws exact HOOK_INPUT.
- Invalid/duplicate metadata preserves C2's exact errors.
- Frozen inputs remain unchanged.

### 4.5 CLI byte fixtures

Use hooks-only mode, trusted staged guard bytes and run ID `run-c6-bytes`.
Define `J(v)=JSON.stringify(v,null,2)+"\n"`.

Each test starts with no unrelated request fields unless specified.

C11:

- Project settings are M11 input serialized with four spaces and CRLF.
- No settings draft; no installed hook ownership.
- Expected draft is M11 result serialized with four spaces and CRLF.
- Exact ownership bytes: `J({".claude/settings.json":"keys"})`.
- Exact managed bytes: `J({".claude/settings.json":{hooks:[H]}})`.
- Envelope: `changed:true`, `metadataChanged:true`, `needsDecision:false`,
  draft path present, hook report ADD.

C12:

- Project settings are M12 input with BOM, tab indentation and no final newline.
- Installed manifest owns H.
- Request files already contain the exact ownership and managed objects above.
- No settings draft.
- Original project bytes remain unchanged; no draft is created.
- Request bytes remain unchanged.
- Envelope: `changed:false`, `metadataChanged:false`, `draft:null`, report OWN.

C14:

- Start from C11's resulting run state and invoke hooks-only again.
- Preserve existing draft and both request files byte-for-byte.
- Envelope: `changed:false`, `metadataChanged:false`, draft path still present, report OWN.

These are three merge-CLI invocations. They provide the byte assertions unavailable from
the pure API.

Also test normal merge key placement when it creates permissions and hooks:
root insertion order ends with `permissions`, then `hooks`. This can share a normal-merge
transaction fixture.

### 4.6 Staging, approvals and genuine migration

Conditional readiness cases:

- No guard: normal merge and hooks-only report OFF and add no hook.
- Trusted staged guard: add.
- Trusted installed guard, no draft: add.
- Unreviewed staged guard plus trusted installed guard: OFF.
- Malformed hooks containers: successful skip; normal deny merge still succeeds.
- Protected or linked settings/guard input: exact staging error, no content read.
- Invalid staged settings/request JSON: exact error, no writes.
- Unknown hooks-only option or conflicting mode: exact usage error.
- Staged unrelated settings fields and request fields survive.

For each error table category, assert complete envelope, stream, exit and unchanged project bytes.
Use read-recording preload controls for protected paths.

Genuine-v2 integration:

1. Create one genuine-v2 installed fixture using C11a.
2. Classify and resolve migration through C3's frozen contracts.
3. Use decisions exercising a deny omission and a retained/dropped ownership choice.
4. Run C3 stage.
5. Capture staged deny array, deny ownership, heldBack, omissions and decision bytes.
6. Run hooks-only.
7. Assert those captured projections/bytes are unchanged and E is present.
8. Prepare with exactly the approvals C2/C3 require.
9. Run prepared diff.
10. Commit with the approved hash.
11. Assert the reviewed seven-member unit, E and H are installed.
12. Roll back and assert original settings and manifest bytes.

Use an explicit new run ID; never C5's reserved aliases.
No normal deny-merge call substitutes for hooks-only after C3 stage.

Approval cases use reviewed runtime fixtures so runtime errors do not mask approval behavior:

- Exact canonical append with reviewed staged guard: no extra settings approval.
- Exact canonical append with reviewed, declared installed guard: same.
- Missing/unreviewed guard: exemption unavailable.
- Altered command, matcher, event, options, key order or non-final placement: approval required.
- User hook edit/removal/reordering: approval required.
- Managed identity change/removal: C2 metadata approval required.
- Metadata-only removal: approval required, no settings write.
- Approved content plus metadata commits together.
- Equal rerun is a genuine no-op.
- Drift after prepare is refused.
- Rollback preserves later edits through existing exit-6 behavior.

### 4.7 Runtime and self-test tests

`V2/C6/runtime-unit`:

- Assert exact seven-row catalog, roles, schemas and write order.
- Assert core exports/import safety and unconditional guard CLI structure.
- For each of the three new members, run one prepare refusal with that member missing
  and all others otherwise valid.
- Expect `TOOL_UNIT_UNREVIEWED`, exit 3, canonical target and existing P envelope.
- Do not duplicate C4's four-boundary unit matrix.

C4's existing UNIT loops expand to seven members and retain full boundary coverage.

Self-test executor seam covers:

- Exact executable, argv, input and options.
- All passing results.
- Each single-case mismatch.
- Unexpected stdout/stderr.
- Wrong status, non-integer status, invalid signal and invalid error field.
- Missing/non-string streams.
- Signal, timeout, spawn error, exception and rejected promise.
- All-failed results.
- Invalid options and exact thrown error.

Real self-test CLI cases:

- Installed real guard: exact success transcript.
- Always-zero silent guard: exact `1 PASS / 2 FAIL` transcript.
- Unexpected CLI argument: exact usage result.

No self-test expected output is imported from production.

### 4.8 Process cost and earlier suites

Hook/self-test/byte-case budget:

```text
10 direct hook invocations
1 additional stdin-read-failure invocation if needed
2 self-test CLI invocations
6 hook children
1 self-test usage invocation
3 merge-CLI byte invocations
```

Total: 22-23 processes for those cases.

Including staging, approval, runtime prepare cases, genuine-v2 construction, transaction
commands and their root-discovery Git children, expect approximately 80-120 processes for
C6 alone. Reuse one genuine-v2 fixture and clone prepared base states. No parser row launches
a process. C4's expanded existing matrix is outside this C6-only estimate.

Earlier expectations:

- R29 aggregates C6 without printing nested records.
- `freshSetup` stages seven runtime members.
- C3's exact merge export list becomes
  `["mergeManagedDenies","mergeManagedHooks"]`.
- C3 CLI assertions at lines 1823 and 1846-1856 remain unchanged: their fixtures have no
  guard, so conditional insertion skips.
- C3's synthetic catalogs remain unchanged.
- Existing R09, R17 and R29(d) behavior remains unchanged for the same reason.
- C4 production UNIT/catalog/order/recovery expectations expand to seven.
- C4's isolated original-six-command fixture remains unchanged.
- C5 production setup fixtures expand to seven; isolated command fixtures do not.
- C1 and C2 need no expectation changes.
- Baseline final JSON envelope remains unchanged.

Required totals:

| Suite | Result |
| --- | --- |
| Baseline | 59 PASS / 0 FAIL / 1 SKIP |
| C11a | 8 PASS / 0 FAIL / 0 SKIP |
| C1 | 12 PASS / 0 FAIL / 0 SKIP |
| C2 | 14 PASS / 0 FAIL / 0 SKIP |
| C3 | 18 PASS / 0 FAIL / 0 SKIP |
| C4 | 17 PASS / 0 FAIL / 0 SKIP |
| C5 | 18 PASS / 0 FAIL / 0 SKIP |
| C6 | 12 PASS / 0 FAIL / 0 SKIP |

Baseline R13d remains the Windows skip. No new skip.

## 5. Edge cases and failure modes

| Requirement or failure | Coverage |
| --- | --- |
| Complete blocked list | P01-P13 |
| More than 40 parser cases | 158-row fixture |
| Patch argument versus message | P39-P47, P77 |
| Every stash form | P10, S01-S16 |
| Missing option values cannot override blocked command | P73, P81-P86, P109 |
| PowerShell escapes and single quotes | P35-P38, P80, P99 |
| Substitutions and command groups | P32-P34, P76, P88-P98, P100-P101 |
| Comments and line continuations | P97, P104, P110 |
| Ordinary commit literal bodies | H01-H08 |
| Literal-body expansion residual | H09 |
| git-safe followed by raw Git | G01-raw through G08-raw, P103 |
| Ordinary orchestrator commands | P53-P65 |
| Exact malformed process result | Process matrix and envelope matrix |
| Deep nesting/runtime exception | P107 and CLI exception handling |
| Alternate-path silent no-op | Direct process case 10 |
| Same command under another event/matcher | M05-M06 |
| Duplicate occurrences preserved | M07 |
| Malformed hook containers do not abort denies | M08-M09 and CLI staging cases |
| User options/order preserved | M02-M06, M12 |
| No adoption of identical user hook | M04, M07 |
| Guard absent or unreviewed | Readiness matrix |
| C3 migration projection preserved | Genuine-v2 stage/hooks-only transaction |
| Exact settings/request bytes | C11, C12, C14 |
| Arbitrary addition cannot use canonical exemption | Approval mutation matrix |
| Reviewed removal/change retains C2 approval | Transaction cases |
| No draft-diff exemption | P66 and documentation |
| Broken hook self-test | Real silent-hook fixture and executor matrix |
| Runtime completeness | C6 focused checks plus expanded C4 loops |
| Host behavior remains unverified | Documentation assertions; no host PASS claims |

## 6. Runnable acceptance

Run only in the authorized writable lane after C5 and C6 implementation land.

```powershell
node project-setup/tests/run-component-tests.mjs --component C6
```

Expected stdout:

```text
PASS  R50/C6/parser  raw Git parser handles frozen command forms
PASS  R50/C6/sanctioned  seven sanctioned commands preserve later raw Git checks
PASS  R50/C6/documentation  hook limitations and host verification remain explicit
PASS  R51/C6/process  hook stdin streams and alternate paths are exact
PASS  R51/C6/malformed  malformed input follows the frozen fail-open contract
PASS  R52/C6/merge  conditional hook merge preserves users and reruns
PASS  R52/C6/staging  hooks-only staging preserves migration projections
PASS  R79/C6/identity  hook identity preserves event matcher options and order
PASS  V2/C6/transaction  hook settings and ownership share existing approval rules
PASS  R72/C6/selftest  installed hook self-test reports exact outcomes
PASS  V2/C6/runtime-unit  hook assets extend the reviewed runtime unit
PASS  R84/C6/arguments  stash patch and alias rules preserve orchestrator commands
12 PASS / 0 FAIL / 0 SKIP
RESULTS  <absolute evidence path>
```

Exit 0, empty stderr. Only the evidence path varies.

```powershell
node project-setup/assets/tools/hooks-selftest.mjs
```

Expected stdout:

```text
PASS  guard-raw-git/allowed
PASS  guard-raw-git/blocked
PASS  guard-raw-git/malformed
3 PASS / 0 FAIL
```

Final LF, exit 0, empty stderr.

Regression commands:

```powershell
node project-setup/tests/run-component-tests.mjs --component C11a
node project-setup/tests/run-component-tests.mjs --component C1
node project-setup/tests/run-component-tests.mjs --component C2
node project-setup/tests/run-component-tests.mjs --component C3
node project-setup/tests/run-component-tests.mjs --component C4
node project-setup/tests/run-component-tests.mjs --component C5
node project-setup/tests/run-tests.mjs
```

Each component retains its registered PASS lines, section-4.8 totals and RESULTS line.
Baseline retains:

```text
59 PASS / 0 FAIL / 1 SKIP
```

and its existing final JSON envelope with `env`, `summary` and `resultsFile`.

C6 acceptance does not require complete rc.1 acceptance, R73 or host R83 measurements.
This planning lane ran none of these commands.

## 7. Rollback

No database migration.

Source rollback:

1. Revert later consumers that require C6 interfaces or installed files.
2. Revert C6 production changes and matching tests-lane expectations together.
3. Restore C5's four-member catalog.
4. Preserve all C1-C5 contracts and frozen source plans.

Dependencies include C7 staging composition, C8 setup instructions, C10 self-test integration
and C11b inventory/acceptance.

For an installed project, use reviewed rc.1 tooling before reverting the installed skill:

```text
node <SKILL_DIR>/scripts/apply.mjs rollback --run-id <id>
```

Restore settings, runtime files and manifest through the journal. Newly created runtime files
are removed only when their current bytes match the run. User-owned duplicate hooks survive.

Roll back independent runs newest first. Preserve later edits and retain backups on incomplete
rollback. Exit 6 remains incomplete recovery; do not overwrite a later manifest.

Do not remove the guard/core while settings references the guard. If journal rollback is
unavailable, prepare a reviewed settings and metadata removal under C2, obtain the required
approval, and complete that transaction before a separately reviewed asset cleanup.

Do not use v2 tooling to repair a schema-3 project.

## 8. Accepted residual risks

- Malformed input is frozen fail-open-but-loud. Exit 1 and the warning are intentional;
  deny rules remain the last line of defense.
- Shell aliases, external Git aliases, wrapper scripts, `sh -c`, `node -e` and scripts
  spawning Git are not interpreted.
- `--config-env alias.*=` and `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_n` injection are not
  resolved. The inline `-c alias.*` rule is the defined cheap guard.
- Bash ANSI-C `$'...'` quoting is not decoded.
- Dashed executables such as `git-log` on PATH are not recognized as raw `git`.
- PowerShell computed/indirect names, script blocks, encoded commands and attached
  `&"git"` invocation are outside supported parsing.
- Expansion inside unquoted heredoc bodies and double-quoted PowerShell here-strings is
  not inspected. Literal-body handling prevents routine commit-message false positives.
- `xargs`, `sudo`, `watch` and `timeout` prefixes are not interpreted.
- Options to the inexpensive `env`, `exec` and `time` prefixes are not generally modeled.
- Unknown Git options and uncommon option-value positions may be missed or classified
  conservatively. Bundled short patch flags are outside the standalone-argument rule.
- The hook does not inspect Git configuration or resolve executable identity on disk.
- ASCII executable/subcommand folding is inexpensive protection, not full shell or Unicode
  equivalence. Actual uppercase Git-for-Windows behavior remains TO VERIFY.
- Trusted-checkout code can replace the hook or settings. This guard is not an isolation
  boundary.
- Direct self-test success does not establish settings presence or host enforcement.
- C6 supplies no Codex project hook.

## 9. Plan questions

None open.

C6-PQ1 is CLOSED by the orchestrator on 2026-10-19: retain the frozen A2/N8 exit-1 contract
and exact malformed-input stderr. The brief's fail-closed wording was withdrawn.

Host TO VERIFY items remain measurements, not unresolved implementation choices.

## Addendum at freeze: plan-critique round 2, C6-P2-1 to C6-P2-10 (NON-BLOCKING)

Added by the orchestrator when freezing, with the maintainer's approval (2026-10-19). Each item
pins a value the sections above left open. Where an item and an earlier section differ, the item
wins.

- C6-P2-1. Installed guard as a transaction input. When either staging mode establishes readiness
  from the installed guard (no guard draft), it appends `.ai/tools/guard-raw-git.mjs` and
  `.ai/tools/guard-raw-git-core.mjs` to `transaction-inputs.json`, keeping order, without
  duplicates, and preserving other entries; `metadataChanged` is true when that file changes. Add
  the readiness case "trusted installed guard, no draft, then prepare needs no settings approval".
- C6-P2-2. Literal bodies inside substitutions. Inside `$()`, backtick and process substitutions,
  scanning restarts in unquoted command context whatever quotes enclose the substitution;
  heredocs, comments and command positions are recognized there. The closing `)` is the first
  unquoted `)` at depth zero, outside any literal body. `<<<` is a Bash here-string word, not a
  heredoc. `<<` inside `$((...))` is not a heredoc. A trailing CR is ignored when matching heredoc
  delimiters and here-string openers and closers (`EOF\r` equals `EOF`; `@'\r` opens; `'@\r`
  closes). Rows: `git commit -F - <<< "msg"` gives A; H03 with CRLF line endings gives A.
- C6-P2-3. Brace words. In Bash, `{` opens a group only as a complete word at command position and
  `}` closes only as a complete word at command position; any other brace is ordinary text, and
  `${...}` contents are scanned only for substitutions. In PowerShell, braces are ordinary
  characters and are not balance-checked; script blocks stay a residual. `elif` is a Bash
  command-position word. Rows: `find . -exec rm {} \;` gives A; `echo }` gives A;
  `if false; then :; elif git log; then :; fi` gives B.
- C6-P2-4. Missing or broken core. The guard entrypoint loads the core with
  `await import('./guard-raw-git-core.mjs')` inside the same try/catch that maps exceptions to the
  exact MALFORMED result. Readiness (section 3.8) and the apply exemption (section 3.11) both
  require the guard entrypoint and the guard core to meet the candidate rule.
- C6-P2-5. Stdin-failure seam. The entrypoint reads stdin with `fs.readFileSync(0)` through the
  default `node:fs` object. The test launches the hook with a `-r` CommonJS preload that makes that
  call throw for fd 0 and expects the exact MALFORMED bytes (one budgeted process). The "may reuse
  case 9" sentence in section 4.3 is dropped.
- C6-P2-6. Staging error paths. `<path>` in the section 3.10 errors and in `target` is
  project-relative POSIX, for example `.claude/settings.json`,
  `.ai/.run/<id>/drafts/.claude/settings.json`, `.ai/.run/<id>/managed-keys.json`,
  `.ai/.run/<id>/ownership.json`, `.ai/tools/guard-raw-git.mjs` and
  `.ai/tools/guard-raw-git-core.mjs`. `HOOK_STAGE_SOURCE` uses the skill-relative source path.
- C6-P2-7. Op fields under the exemption. When the canonical-append exemption applies and no other
  content reason exists, the settings op has `userContentChange: false` and
  `userContentReasons: []` in prepare output and in the plan, as permission appends do today.
- C6-P2-8. Normal-merge key placement fixture. With no project settings file and a trusted staged
  guard, the normal merge draft's root keys are exactly `["$schema", "permissions", "hooks"]` and
  `hooks` is exactly `{"PreToolUse": [E]}`.
- C6-P2-9. Executor result validity. Extra keys on an executor result (for example spawnSync's
  `pid` and `output`) are ignored; validity covers only the five listed fields.
- C6-P2-10. Genuine-v2 approvals. In the section 4.6 transaction, prepare uses exactly the approval
  set C3 requires for the same decisions. Hooks-only staging neither adds a required approval nor
  makes any approval unrelated: no `APPLY_APPROVAL_REQUIRED` naming hooks and no
  `APPLY_APPROVAL_UNRELATED`.
