<!--
FROZEN 2026-10-18 on branch feat/project-setup-v3-rc1. Never edit this file; changes go through the
maintainer. Component plan C4 (lands fifth, after C11a, C1, C2 and C3) under the frozen
architecture plan docs/plans/2026-10-15-project-setup-v3-rc1.md, which takes precedence. Drafted by
the plan lane (Codex, 3 revisions, applying the maintainer requirement on catalog runtime targets,
maintainer decisions C4-PQ1 option (a) and C4-PQ2 option 1, and the round-1/round-2
dispositions); plan-critique (Claude) round 3 found no BLOCKING gap. The addendum at the end
records round 3's items.
-->

# C4. Git object commands and bounded argument builders

Date: 2026-10-18
Status: component plan for freeze
Base: `feat/project-setup-v3-rc1`, commit `4d8d6f8`
Target: `docs/plans/2026-10-18-project-setup-v3-rc1-c4.md`

## 1. Scope and authority

C4 implements frozen rc.1 section 2, "C4. Git object commands and bounded argument builders",
and its section 5 Git edge cases. Its numbered-case ownership is the section 4 C4 row:

- R41-R43.
- R75 Git lookup.
- R76 Git arguments and limits.
- The Git consumers of R47, R74 and R97.

R47 combines C3 rendering with C4 enforcement. Passing C4's assertions alone does not complete
R47 or any other shared numbered case.

The authority order is the frozen rc.1 plan and addendum, design part A frozen at `54ad312`,
applicable implementation decisions, and the landed C11a, C1, C2 and C3 contracts. Applicable
design sections are A1, A3 and A6, with Q1-Q6 and the policy grammar and alias decisions.
The component lands after C11a, C1, C2 and C3.

C4 MUST:

- Retain the supported `diff`, `log` and `show` forms specified below.
- Add `cat`, `ls` and `grep` for committed objects.
- Consume C1's validated effective anchored policy, including project additions.
- Resolve revisions to commits before content operations.
- Separate case-insensitive protection from exact-case Git lookup.
- Use shell-free, subcommand-specific argument builders.
- Disable textconv, external diff, pagers and configured executable helpers.
- Parse Git path inventories with NUL framing.
- Limit each complete command result to 1,048,576 bytes before emission.
- Ship a reader supporting policy schemas 1 and 2.
- Enforce the reviewed runtime unit in ordinary plans as well as migrations.

The last requirement is an authorized C3 contract extension. The existing migration-only gate
does not prevent an ordinary plan from replacing a reader on an already-schema-2 project.
C4 closes that gap in `apply.mjs`; it does not change C2's plan or input-binding schemas.

### 1.1 Supported compatibility

The current reader offers `diff`, `log` and `show`, requires an installed policy, invokes Git
without a shell, excludes protected paths, rejects selected dangerous options, checks revisions
as commits, and requires attached option values.

The retained baseline forms include:

```text
show HEAD
log -p HEAD~1..HEAD
diff <base>...HEAD
diff <base>..<head>
```

The new grammar also accepts single-revision `log`, bare `HEAD^` and `HEAD~`, attached counts,
and the small set of common read-only flags listed in section 3.2.

C4-PQ1 explicitly replaces permissive option and pathspec passthrough. These previously
accepted forms are intentionally refused:

```text
diff <rev>
diff --cached ...
diff --staged ...
log --reverse ...
show --format=...
show --pretty=...
--all
--branches
--tags
--remotes
--follow
```

Also refused are caller-selected rename, copy, diff-algorithm, formatting or traversal options
outside the allowlist; open-ended ranges; separate exclusion revisions such as `^REV`;
reflog and peel expressions; `REV^!`, `REV^@`, `REV^-N`; multiple positional revisions;
and commands without the required revision expression.

`diff <rev>` means a worktree comparison. Neither the documented retained interface nor the
baseline success cases require it. C4 therefore refuses it.

Detached counts such as `-n 5` remain refused. Caller pathspec magic is never interpreted:
a selector beginning with `:` is a literal name.

### 1.2 Count semantics

C4-PQ2 preserves filtered-log count semantics:

- The names-only log inventory runs once over the complete resolved expression.
- It receives no count.
- It uses `--full-history` and explicit separate merge diffs.
- The content log alone receives the caller's count.

Thus `-n1` limits returned commits after path filtering. It does not bound inventory work.
A single-revision log can inventory the full reachable history.

### 1.3 Out of scope

C4 does not implement:

- C5 review-diff, selectors for its artifacts, artifact lifecycle or worktree review.
- C6 hooks or shell parsing.
- C7 permission retirement.
- C8 instruction, agent, wrapper or installation-procedure changes.
- C9 environment-template commands.
- C10 validation, doctor or host-control proof.
- C11b complete numbered cases, release packaging or release version changes.

Q1 remains intact: `apply.mjs diff` performs no Git calls.

The trusted checkout remains the execution boundary from design A3. C4 does not introduce an
out-of-tree runner, secret-content scanner, general Git wrapper or arbitrary Git execution API.

## 2. Files and public contracts

Line ranges below refer to commit `4d8d6f8`. They identify existing regions to change, not
post-change line numbers.

### 2.1 Production files

| File under `project-setup/` | Existing lines | Change |
| --- | --- | --- |
| `assets/tools/git-safe.mjs` | 1-68 | Replace with unconditional thin CLI |
| `data/runtime-units.json` | 1-18 | Add core helper; declare reader schemas 1 and 2 |
| `scripts/apply.mjs` | 672-700 | Catalog integration and runtime ordering |
| `scripts/apply.mjs` | 729-800 | Preserve migration evidence and error precedence |
| `scripts/apply.mjs` | 811-943 | Check complete runtime unit during analysis |
| `scripts/apply.mjs` | 1136-1174 | Check before prepared-review rendering |
| `scripts/apply.mjs` | 1199-1212 | Extend commit runtime verification |
| `scripts/apply.mjs` | 1328-1374 | Invoke verification before commit writes |
| `references/security.md` | 5-7, 19-32 | Effective policy, six commands, limits and guidance |

New production file:

```text
project-setup/assets/tools/git-safe-core.mjs
```

No production contract change is made to:

```text
assets/tools/security-policy.mjs
scripts/lib.mjs
scripts/migrate-security-paths.mjs
scripts/validate.mjs
```

In particular, C4 consumes C1's matcher and schema-1 adapter. It does not implement another
matcher or loosen C3's `checkSecurityToolUnit`.

### 2.2 Test files

New files:

```text
project-setup/tests/c4.test.mjs
project-setup/tests/fixtures/git-safe-cases.json
```

Existing test regions:

| File | Existing lines | Change |
| --- | --- | --- |
| `tests/rc1-cases.mjs` | 8-11, 34-126 | Import and register C4 assertions |
| `tests/run-tests.mjs` | 99-116 | Include C4 assertions inside R01 |
| `tests/run-tests.mjs` | 1140-1166 | Stage the complete runtime unit in `freshSetup` |
| `tests/c3.test.mjs` | 404-410 | Separate production and synthetic catalog expectations |
| `tests/c3.test.mjs` | 2510-2515, 2613-2618 | Remove production-schema incompatibility assumptions |
| `tests/c3.test.mjs` | 2696-2710, 2824-2842 | Retain incompatible-reader tests with scratch catalog |

The tests lane MUST also search every real-catalog dependency in `c3.test.mjs`, particularly
`makeKit(context, check)` followed by genuine-v2 staging or prepare. The line list is not a
substitute for that search.

The tests lane owns these edits. The implementer may not edit its tests.

### 2.3 Runtime catalog

The catalog remains schema 1. Its `units` array MUST be exactly this order and content:

```json
{
  "schema": 1,
  "units": [
    {
      "source": "assets/tools/security-policy.mjs",
      "target": ".ai/tools/security-policy.mjs",
      "role": "helper",
      "policySchemas": [1, 2]
    },
    {
      "source": "assets/tools/git-safe-core.mjs",
      "target": ".ai/tools/git-safe-core.mjs",
      "role": "helper",
      "policySchemas": [1, 2]
    },
    {
      "source": "assets/tools/git-safe.mjs",
      "target": ".ai/tools/git-safe.mjs",
      "role": "entrypoint",
      "policySchemas": [1, 2]
    }
  ]
}
```

The production schema-2 gate opens because the shipped reader now implements the reviewed
schema-2 behavior. Changing the catalog capability alone is insufficient.

C3's synthetic two-unit catalogs remain valid. C4 does not change the catalog reader's existing
required-pair contract to require three units in every synthetic catalog.

Runtime write order remains:

1. `security-policy.mjs`.
2. Other helpers, sorted by target; this puts `git-safe-core.mjs` next.
3. Entrypoints, sorted by target.
4. Remaining non-policy content operations in the existing order.
5. The dependent policy.
6. The manifest last.

### 2.4 Entry point

`git-safe.mjs` exports nothing and runs unconditionally:

```js
#!/usr/bin/env node
import { main } from './git-safe-core.mjs';
const result = await main(process.argv.slice(2));
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
```

There is no `argv[1]` versus `import.meta.url` comparison. Junctions, alternate checkout paths
and `subst` must not turn an invocation into an empty successful no-op.

Import safety applies to the core and test modules, not to this CLI entrypoint.

### 2.5 Core exports

The core exports exactly:

```text
MAX_OUTPUT_BYTES
MAX_GIT_ARG_UNITS
SUPPORTED_FORMS
NARROWING_GUIDANCE
sanitizeGitEnvironment
parseGitSafeArgs
createGitSession
executeGitSafe
main
```

No import starts a process, reads a file, writes output or changes the environment.

Constants:

```js
MAX_OUTPUT_BYTES = 1048576;
MAX_GIT_ARG_UNITS = 24000;
```

`SUPPORTED_FORMS` and `NARROWING_GUIDANCE` are frozen objects with exactly the six subcommand
keys. Their values are pinned in sections 3.2 and 3.9.

#### `sanitizeGitEnvironment(input)`

Synchronous. Accepts a plain object whose own enumerable values are strings. Returns a new
ordinary object. Does not mutate `input`.

It has no platform parameter. Its output depends only on `input`, using section 3.4.

Invalid input throws:

```text
GIT_SAFE_INPUT: invalid Git helper input
```

#### `parseGitSafeArgs(argv)`

Synchronous. Accepts a dense array of strings. Returns exactly:

```js
{
  subcommand,
  revisions,
  paths,
  format,
  patch,
  maxCount,
  pattern
}
```

Field definitions:

- `subcommand`: one of the six command names.
- `revisions`: a one-element array containing the original expression string.
- `paths`: validated selectors, deduplicated in first-occurrence order.
- `format`: the values below.
- `patch`: boolean.
- `maxCount`: integer or `null`.
- `pattern`: string or `null`.

A range remains one string in `revisions`; the operator is not stored in another field.

Defaults:

| Command | `format` | `patch` | `maxCount` | `pattern` |
| --- | --- | --- | --- | --- |
| diff | `"patch"` | `true` | `null` | `null` |
| log | `"medium"` | `false` | `null` | `null` |
| show | `"patch"` | `true` | `null` | `null` |
| cat | `null` | `false` | `null` | `null` |
| ls | `"name-only"` | `false` | `null` | `null` |
| grep | `null` | `false` | `null` | supplied string |

Diff/show summary formats set `patch: false`. Log's `-p` sets `patch: true`; `--oneline`
changes only its format. Only log can have a non-null count. Only grep has a non-null pattern.

Invalid container or element types give `GIT_SAFE_INPUT`. An absent or unknown command gives
`GIT_SAFE_COMMAND`. Invalid command syntax gives `GIT_SAFE_ARGUMENT`.

#### `createGitSession(options = {})`

Asynchronous. Accepts only these optional keys:

```text
cwd
env
execute
readFile
```

- `cwd`: nonempty absolute path; default `process.cwd()`.
- `env`: environment object accepted by the sanitizer; default a copy of string-valued
  entries in `process.env`.
- `execute`: asynchronous executor described below.
- `readFile`: asynchronous function accepting one absolute path and returning a Buffer.

Unknown keys, invalid types or a relative `cwd` give `GIT_SAFE_INPUT` before any dependency call.

The session snapshots `process.platform` at creation. That value selects `NUL` on Windows and
`/dev/null` elsewhere for the fixed Git prefix.

The returned session is frozen, privately branded, and exposes exactly:

```js
{
  root,
  policy,
  sourceSchema,
  git,
  resolveCommit,
  listTree
}
```

- `root`: normalized absolute root from section 3.3.
- `policy`: deeply frozen effective C1 policy.
- `sourceSchema`: `1` or `2`.
- `git(argv, options = {})`: the low-level bounded Git executor.
- `resolveCommit(revision)`: resolves one validated single revision to a lowercase object ID.
- `listTree(commitId)`: returns parsed recursive tree entries.

`git` accepts a dense string array without the fixed prefix and only these option keys:

```js
{
  limit: null,          // null or MAX_OUTPUT_BYTES
  allowFailure: false  // boolean
}
```

It returns:

```js
{ status, stdout }
```

Here `status` is an integer and `stdout` is a Buffer. A normal nonzero status throws
`GIT_SAFE_GIT` unless `allowFailure` is true. A signal, spawn error or malformed executor result
always throws.

`resolveCommit` returns `Promise<string>`. Its input must be a single revision from section 3.2.
An invalid library input gives `GIT_SAFE_INPUT`.

`listTree` accepts a lowercase 40- or 64-digit hexadecimal commit ID and returns:

```js
[
  { mode, type, oid, path }
]
```

All fields are strings. Entry order is Git's order. Invalid library input gives `GIT_SAFE_INPUT`.
Parsing rules are in section 3.5.

These low-level methods are for trusted consumers implementing their own specified operation.
They are not an arbitrary-argv CLI surface.

#### Executor seam

Every executor call receives exactly:

```js
{
  argv,
  cwd,
  env,
  limit
}
```

`argv` includes the fixed prefix. `limit` is either `null` or `1048576`.

The executor returns exactly:

```js
{
  status,
  signal,
  error,
  stdout,
  overflow
}
```

Valid values and combinations:

- `status`: `null` or an integer from 0 through 255.
- `signal`: `null` or a nonempty string.
- `error`: `null` or a nonempty string.
- `stdout`: Buffer.
- `overflow`: boolean.
- Normal completion has non-null status and null signal and error.
- Failed execution has null status and exactly one non-null signal or error.
- Overflow may have null status, signal and error.
- `overflow: true` is valid only for a call with a non-null limit.

Missing or extra keys, wrong types, both signal and error, or null status without a failure or
overflow are invalid results. They give `GIT_SAFE_GIT`. Rejected executor promises give the
same error.

The production executor always launches executable `git`, without a shell, with `windowsHide:
true`. There is no executable override environment variable.

#### `executeGitSafe(request, session)`

Asynchronous. Returns `Promise<Buffer>` containing the complete successful stdout.

It revalidates the complete request, including exact keys, field combinations, revision grammar,
path validity and absence of duplicate paths. A hand-built invalid request gives
`GIT_SAFE_INPUT`, not a parser usage error.

Only a session created and privately branded by this core's `createGitSession` is accepted.
A foreign, copied or forged session gives `GIT_SAFE_INPUT` before any session or executor call.

#### `main(argv, dependencies = {})`

Asynchronous. `dependencies` has the same allowed keys as session options.

Returns exactly:

```js
{
  exitCode,
  stdout,
  stderr
}
```

`stdout` is a Buffer; `stderr` is a string. Success is exit 0 with empty stderr. Handled failure
is exit 2 with empty stdout and the error line from section 3.9.

`main` does not write streams or set `process.exitCode`. It parses arguments before creating a
session. Unexpected implementation errors become `GIT_SAFE_INTERNAL`.

### 2.6 Later-component dependencies

C5 may import the constants, parser, session factory and execution functions. It must consume
the specified methods and errors, not private builders. Its artifact and selector contracts
remain C5 work.

C8 must update `SKILL.md` Phase 1 step 3 and `references/docs-generation.md` to install both
helpers and the entrypoint as one catalog unit. It must describe any unchanged runtime members
as declared transaction inputs when required by C2/C3.

C10 must make `validate.mjs` check every catalog runtime target, rather than only the current
single reader target. Host-control proof remains C10 work.

C11b must compose the section 4 C4 assertions, including:

```text
R78/C4/reader-unit
R80/C4/runtime-targets
```

The maintainer's runtime-target requirement authorizes the R80 sub-assertion beyond the original
C4 ownership row. R78 supplies the reviewed reader required to complete the C3 migration.

C11b owns the release stamp, installed-payload and packaging changes required by the frozen
landing sequence. C4 does not independently publish or bump the release.

## 3. Behavior specification

### 3.1 Order of operations

For a normal invocation:

1. Validate CLI arguments.
2. Validate dependencies and sanitize the environment.
3. Snapshot the platform and construct the fixed Git prefix.
4. Verify the Git version.
5. Discover the repository root.
6. Read and validate the installed policy.
7. For cat, check the requested path against that policy.
8. Resolve all revision endpoints to commits.
9. Handle zero-count log.
10. Collect the applicable path inventory.
11. Validate names, apply policy and construct literal selectors and exclusions.
12. Return empty success if no selected unprotected inventory name exists.
13. Execute the content operation, if any.
14. Check the complete output bound.
15. Return bytes for emission.

Cat does not collect an inventory. Ls produces its output from its tree inventory.

No content operation runs before policy validation and revision resolution. A failed stage
prevents later calls. Git diagnostics are never copied into user output.

### 3.2 Accepted arguments

The following strings are the exact values of `SUPPORTED_FORMS`:

```text
diff <A>..<B>|<A>...<B> [--stat|--name-status|--name-only] [-- <paths>]
log [-p] [--oneline] [-n<k>|--max-count=<k>] <rev>|<A>..<B>|<A>...<B> [-- <paths>]
show <commit> [--stat|--name-status] [-- <paths>]
cat <commit> -- <path>
ls <commit> [-- <paths>]
grep <commit> <pattern> [-- <paths>]
```

For diff, log and show, allowed options may appear anywhere before the path separator.
Each option may occur at most once. Summary formats are mutually exclusive. Count spellings
are mutually exclusive even if their values agree.

Counts use canonical decimal spelling from `0` through `2147483647`. Leading zeros except
`0`, signs, whitespace, decimals and exponents are invalid.

Cat, ls and grep use fixed positional arguments and accept no options.

For grep, the token immediately after the commit is always the pattern, even when it equals
`--`. Only subsequent tokens can introduce the optional path separator.

Examples:

```text
grep HEAD --
```

This searches for pattern `--` without selectors.

```text
grep HEAD -- -- safe.txt
```

This searches for pattern `--` in literal selector `safe.txt`.

A grep pattern may be empty, start with `-`, or contain LF. NUL is refused. It is a basic regular
expression passed using `-e`; invalid regex execution gives `GIT_SAFE_GIT`.

An optional path separator, when present, must be followed by at least one path. Cat requires
exactly one. After the separator, an additional token `--` is an ordinary literal path.

All paths pass C1 `validateRepoPath` without rewriting. They must be nonempty canonical
repository-relative POSIX paths. Absolute paths, backslashes, NUL, empty components, `.` and
`..` components are refused. Spaces, tabs, LF, non-ASCII characters, leading dashes and literal
wildcard characters are allowed.

CLI structural path failures become `GIT_SAFE_ARGUMENT`; they do not expose the rejected path.

#### Revision grammar

A single revision consists of a base and zero or more suffixes.

Base:

```text
[A-Za-z0-9_][A-Za-z0-9_./-]*
```

Additionally, the base must not contain `..`, start or end with `/`, or contain an empty slash
component.

A suffix is `~`, `^`, `~N` or `^N`. An omitted N means 1. Explicit N uses canonical nonnegative
decimal spelling. Git decides whether that ancestry exists.

Ranges split at the first occurrence of `..`. If the immediately following character is `.`,
the operator is `...`; otherwise it is `..`. Both remaining endpoints must independently
satisfy the single-revision grammar.

Consequences:

```text
v1.2..v1.3    accepted syntax
HEAD^        accepted syntax
HEAD~        accepted syntax
HEAD^2~3     accepted syntax
a....b       refused
A..          refused
..B          refused
A..B..C      refused
```

Colon, whitespace, NUL, backslash, `@`, braces, a leading dash and standalone `^REV` are refused
before any Git call. Hexadecimal blob and tree IDs can pass syntax, but must fail commit
resolution.

### 3.3 Git version, root and policy

Minimum supported Git is 2.31. The requirement comes from
`--diff-merges=separate`; `--end-of-options` requires only 2.24.

The first executor operation is:

```js
["--version"]
```

It receives the fixed prefix and the starting cwd. Successful stdout must be one UTF-8 line
beginning with `git version `, followed by numeric major and minor components, an optional
numeric patch component, and an optional vendor suffix. LF or CRLF is accepted.

A successfully executed version command reporting less than 2.31, or an unparseable version,
gives:

```text
GIT_SAFE_VERSION: Git 2.31 or later is required
```

No root, policy or content operation follows. A spawn failure or nonzero version-command status
gives `GIT_SAFE_GIT`. Version validation happens once per session.

Root discovery is:

```js
["rev-parse", "--show-toplevel"]
```

Its cwd is `path.resolve(options.cwd ?? process.cwd())`.

Decode stdout using strict UTF-8. Remove exactly one terminal LF or CRLF. The remaining value
must be a nonempty absolute path without another CR or LF. Root discovery failure or invalid
root output gives `GIT_SAFE_REPOSITORY`.

The session root and every subsequent executor cwd are:

```js
path.resolve(decodedRoot)
```

Thus a Windows root printed with forward slashes becomes the platform-normalized absolute path
seen by the seam.

Read the policy once at exactly:

```js
path.join(root, '.ai', 'security-paths.json')
```

The reader seam receives native platform separators.

A read failure or non-Buffer result gives `GIT_SAFE_POLICY_IO`. Decode the Buffer with strict
UTF-8; invalid UTF-8 gives `POLICY_JSON`. Pass decoded text to C1 `parseSecurityPolicy`, retaining
its BOM handling, validation, source schema and schema-1 adaptation.

Use the effective validated policy containing both `patterns` and `projectPatterns`. There is
no fallback to shipped defaults, no legacy unvalidated parse and no empty-policy fallback.
A valid explicitly empty policy is accepted.

Unknown policy schemas fail through C1. In particular schema 3 gives:

```text
POLICY_SCHEMA: policy.schema must be 1 or 2
```

#### Commit resolution

Resolve distinct endpoint spellings once, in first-occurrence order:

```js
[
  "rev-parse",
  "--verify",
  "--quiet",
  "--end-of-options",
  revision + "^{commit}"
]
```

A normal nonzero status gives `GIT_SAFE_REVISION`. Successful output must contain exactly one
lowercase 40- or 64-digit hexadecimal ID followed by LF or CRLF. Otherwise give
`GIT_SAFE_RECORD`.

All later content argv uses resolved IDs, not caller revision strings.

For two-dot diff, compare resolved A with resolved B.

For three-dot diff, execute:

```js
["merge-base", A, B]
```

Use its returned ID M as the left side. Nonzero status gives `GIT_SAFE_GIT`; empty or malformed
successful output gives `GIT_SAFE_RECORD`. Use the ordinary single merge-base result; do not
request `--all`.

For log, reconstruct the original single, two-dot or three-dot expression using resolved IDs.

For `log --max-count=0`, version, root, policy and revision resolution still run. Inventory and
content do not run. The result is empty success.

### 3.4 Environment, fixed prefix and argument bound

Environment removal is case-insensitive by variable name.

Remove these names:

```text
GIT_CONFIG
GIT_CONFIG_PARAMETERS
GIT_CONFIG_COUNT
GIT_EXTERNAL_DIFF
GIT_DIFF_OPTS
GIT_PAGER
GIT_DIR
GIT_WORK_TREE
GIT_COMMON_DIR
GIT_INDEX_FILE
GIT_OBJECT_DIRECTORY
GIT_ALTERNATE_OBJECT_DIRECTORIES
GIT_NAMESPACE
GIT_PREFIX
GIT_ATTR_SOURCE
GIT_REPLACE_REF_BASE
GIT_NO_REPLACE_OBJECTS
GIT_TERMINAL_PROMPT
GIT_OPTIONAL_LOCKS
GIT_LITERAL_PATHSPECS
GIT_GLOB_PATHSPECS
GIT_NOGLOB_PATHSPECS
GIT_ICASE_PATHSPECS
PAGER
```

Also remove names matching:

```text
^GIT_CONFIG_KEY_[0-9]+$
^GIT_CONFIG_VALUE_[0-9]+$
```

Then set exactly:

```js
{
  GIT_PAGER: "cat",
  PAGER: "cat",
  GIT_TERMINAL_PROMPT: "0",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_NO_REPLACE_OBJECTS: "1"
}
```

Preserve other string-valued entries, including:

```text
HOME
USERPROFILE
PATH
GIT_CONFIG_GLOBAL
GIT_CONFIG_SYSTEM
GIT_CONFIG_NOSYSTEM
```

The last three retain the user's selected configuration files and system-config policy.
Do not replace them with null devices. Global and system `safe.directory` must remain usable.

Every Git argv is `P` followed by the operation vector specified below. `P` is exactly:

```js
[
  "--no-pager",
  "-c", "core.fsmonitor=false",
  "-c", "core.quotePath=true",
  "-c", "submodule.recurse=false",
  "-c", "log.showSignature=false",
  "-c", "log.showNotes=false",
  "-c", "log.follow=false",
  "-c", "log.mailmap=false",
  "-c", "log.diffMerges=off",
  "-c", "diff.renames=false",
  "-c", "diff.submodule=short",
  "-c", "diff.relative=false",
  "-c", "diff.noprefix=false",
  "-c", "diff.mnemonicPrefix=false",
  "-c", "diff.context=3",
  "-c", "diff.interHunkContext=0",
  "-c", "diff.algorithm=myers",
  "-c", "diff.indentHeuristic=false",
  "-c", "diff.suppressBlankEmpty=false",
  "-c", "diff.orderFile=" + NULL_DEVICE,
  "-c", "color.ui=false"
]
```

`NULL_DEVICE` comes from the platform snapshot at session creation.

Do not use `diff.srcPrefix` or `diff.dstPrefix` configuration as an output contract. Git before
2.45 ignores those settings. Content vectors instead carry explicit `--src-prefix=a/` and
`--dst-prefix=b/`, supported by the minimum version. Expected patch prefixes are therefore
identical on Git 2.31 and later.

Textconv and external diff are disabled on every applicable inventory and content operation.
Cat-file reads blob bytes directly. Fsmonitor, signature display, notes, pager execution,
mailmap use, rename following, color and order-file overrides cannot select external helpers or
change the specified output modes.

Before every executor call, calculate:

```js
argv.reduce((sum, arg) => sum + 2 * arg.length + 3, 0)
```

This uses JavaScript UTF-16 string length and includes all of `P`. Exactly 24000 passes.
A larger value gives `GIT_SAFE_ARG_LIMIT` before process creation.

The bound grows with caller selectors plus protected inventory names, not all safe paths.
The conservative formula reserves room for Windows quoting and executable overhead.

Executor errors `E2BIG` and `ENAMETOOLONG` also map to `GIT_SAFE_ARG_LIMIT`.
Other execution errors map to `GIT_SAFE_GIT`.

### 3.5 Inventories and literal pathspecs

Let:

```js
L = request.paths.map((p) => ":(literal)" + p);
```

All caller selectors receive that wrapper, including selectors beginning with `:`.

For each relevant inventory name, validate its structure with C1 and classify it with C1
`matchesPolicyPath`. Do not lowercase or otherwise rewrite the name used for Git lookup.

Deduplicate protected names and sort them by UTF-8 byte order. Let:

```js
E = protectedNames.map((p) => ":(exclude,literal)" + p);
```

Do not pass `--literal-pathspecs` or set `GIT_LITERAL_PATHSPECS`. Explicit magic is required so
literal selectors and literal exclusions both work.

When L is empty, Git's implicit selection is the whole applicable scope. Do not expand it into
positive pathspecs for every safe name.

#### Diff inventory

Let LEFT be A for a two-dot range or M for a three-dot range:

```js
[
  "diff",
  "--no-ext-diff",
  "--no-textconv",
  "--no-renames",
  "--no-color",
  "--ignore-submodules=none",
  "--name-only",
  "-z",
  LEFT,
  B,
  "--",
  ...L
]
```

This is one changed-path inventory process.

#### Show inventory

```js
[
  "diff-tree",
  "--root",
  "-r",
  "-m",
  "--no-commit-id",
  "--no-ext-diff",
  "--no-textconv",
  "--no-renames",
  "--ignore-submodules=none",
  "--name-only",
  "-z",
  C,
  "--",
  ...L
]
```

This inventories a root commit against the empty tree and a merge against its parents in one
process. `diff-tree -m` is unaffected by `log.diffMerges`.

#### Log inventory

```js
[
  "log",
  "--format=",
  "--no-ext-diff",
  "--no-textconv",
  "--no-renames",
  "--no-color",
  "--no-notes",
  "--no-decorate",
  "--no-show-signature",
  "--no-use-mailmap",
  "--ignore-submodules=none",
  "--name-only",
  "-z",
  "--diff-merges=separate",
  "--full-history",
  EXPR,
  "--",
  ...L
]
```

This runs once over the full resolved expression. It never receives a count.

`--diff-merges=separate` explicitly overrides the configured merge default. `--full-history`
prevents path-limited history simplification from omitting a parent branch that the later
content log can visit after exclusions change TREESAME comparisons.

Keep L on the inventory. Do not widen a requested subtree to the whole repository.

#### Ls and grep inventory

Both use one recursive tree inventory:

```js
["ls-tree", "-r", "-z", "--full-tree", C]
```

For ls, select entries locally. A name n matches a selector s when:

```js
n === s || n.startsWith(s + "/")
```

No selectors means all entries.

For grep, use the same predicate to scope E when selectors are present. Protected names outside
the selected literals and their descendants are omitted from E. With no selectors, E includes
all protected tree names.

This makes path narrowing reduce grep's exclusion argv as well as its content scope.

#### Record parsing

Names-only inventories are strict UTF-8 NUL-delimited records. Empty stdout is valid.
Nonempty stdout must end in NUL. Ignore empty records; never trim a name or split it on LF.

Each nonempty name must pass C1 structural path validation. Invalid UTF-8, invalid paths or
bad framing give `GIT_SAFE_RECORD`.

Tree records have:

```text
<mode> SP <type> SP <oid> TAB <path> NUL
```

Split at the first TAB. Accept exactly these mode/type pairs:

```text
100644 blob
100755 blob
120000 blob
160000 commit
```

The ID must be lowercase hexadecimal of length 40 or 64. Do not accept legacy `100664`, tree
entries in this recursive file listing, or extra header fields.

A malformed record fails the entire command before content execution.

If no selected unprotected name remains, diff, log, show and grep return empty success without
a content call. Ls returns the empty Buffer. This includes an all-protected inventory.

Exclusions operate across the entire content command, including older appearances of the same
name and directory descendants. No additional file-to-directory expansion rule is required.

### 3.6 Content argument vectors

Every vector below receives P.

Define D exactly:

```js
[
  "--no-ext-diff",
  "--no-textconv",
  "--no-renames",
  "--no-color",
  "--submodule=short",
  "--ignore-submodules=none",
  "--src-prefix=a/",
  "--dst-prefix=b/"
]
```

Define H exactly:

```js
[
  "--no-notes",
  "--no-decorate",
  "--no-show-signature",
  "--no-use-mailmap",
  "--date=default",
  "--encoding=UTF-8"
]
```

#### Diff

```js
["diff", ...D, ...FORMAT, LEFT, B, "--", ...L, ...E]
```

FORMAT is exactly one of:

```js
["--patch"]
["--name-status"]
["--name-only"]
["--stat", "--stat-width=80", "--stat-name-width=40", "--stat-graph-width=30"]
```

#### Log

```js
["log", ...D, ...H, ...FORMAT, ...PATCH, ...COUNT, EXPR, "--", ...L, ...E]
```

FORMAT:

```js
["--format=medium", "--no-abbrev-commit"]
```

or:

```js
["--oneline", "--abbrev=12"]
```

PATCH is `["-p"]` or `[]`.

COUNT is `["--max-count=" + request.maxCount]` or `[]`.

No caller-provided revision, option or count string is passed through unparsed.

#### Show

```js
[
  "show",
  ...D,
  ...H,
  "--format=medium",
  "--no-abbrev-commit",
  "--cc",
  ...FORMAT,
  C,
  "--",
  ...L,
  ...E
]
```

FORMAT is the diff patch, stat or name-status vector. Name-only is not a supported show form.

#### Cat

After the path's policy check and commit resolution:

```js
["cat-file", "blob", C + ":" + request.paths[0]]
```

The caller cannot supply an object expression. The core builds this expression from a resolved
commit and validated exact path.

Cat returns stored blob bytes, including binary bytes, without UTF-8 decoding or newline
changes. A symlink returns its blob text; it is not followed. Missing paths, directories and
gitlinks fail with `GIT_SAFE_GIT`.

#### Ls

There is no content Git call.

Return selected unprotected paths, deduplicated and sorted by UTF-8 byte order, with exactly one
NUL after every path. Empty selection returns zero bytes. Modes and object IDs are not printed.

#### Grep

```js
[
  "grep",
  "--no-textconv",
  "--no-color",
  "--full-name",
  "--no-column",
  "--no-heading",
  "--no-break",
  "-G",
  "-I",
  "-n",
  "-z",
  "-e",
  request.pattern,
  C,
  "--",
  ...L,
  ...E
]
```

`-G` forces basic regular expressions. `--no-column` fixes framing despite configuration.
`-I` excludes binary matches.

Successful output is returned unchanged. For a matching text line it contains:

```text
<commit>:<path> NUL <line-number> NUL <line-text> LF
```

Status 0 is success. Status 1 with empty stdout is a successful no-match result. Status 1 with
nonempty stdout, any other nonzero status, a signal or a spawn failure gives `GIT_SAFE_GIT`.

### 3.7 Policy behavior

C1 performs all matching, including root versus any-depth anchors, project additions,
case-insensitive matching and the adopted Windows alias handling.

Examples under a root-anchored `private/**` entry:

```text
private/token.txt          protected
PRIVATE/token.txt         protected
nested/private/token.txt  unprotected unless another entry matches
```

Lookup retains original case. A protected mixed-case alias is refused before cat's revision
resolution. An unprotected `MixedCase.txt` is not rewritten to `mixedcase.txt`.

Reviewed-commit policy files do not replace the installed trusted policy. A dirty worktree copy
of a requested content file does not replace committed content.

For diff/log/show/ls/grep, protected inventory names are omitted rather than reported as errors.
For cat, requesting a protected path gives `GIT_SAFE_SECRET`.

### 3.8 Output limits and executor behavior

Inventory, version, root and resolution calls use `limit: null`. They produce metadata, not
agent-facing content. Content calls use `limit: 1048576`.

The production executor buffers output before returning it. Once a bounded call observes byte
1,048,577, it stops the child and reports overflow. It must not stream a prefix to stdout.

The execution layer also checks returned Buffer length, so an injected executor cannot bypass
the bound by returning oversized stdout with `overflow: false`.

Ls checks the length of its completed NUL-framed result.

The bound counts bytes, including patch headers, commit headers, grep prefixes and NULs:

```text
0 bytes          passes
1,048,575 bytes  passes
1,048,576 bytes  passes
1,048,577 bytes  fails
```

No truncation, partial Buffer, partial diagnostic content or partial success is returned.

Successful stdout is unchanged. The CLI adds no banner or newline. Successful stderr is empty.
Git stderr is drained but never echoed, including on failure.

### 3.9 Errors and guidance

Every core error has an own string `code` and an `Error.message` beginning with `CODE: `.

Exact C4 details:

| Code | Detail after `CODE: ` |
| --- | --- |
| `GIT_SAFE_INPUT` | `invalid Git helper input` |
| `GIT_SAFE_COMMAND` | `supported commands: diff, log, show, cat, ls, grep` |
| `GIT_SAFE_ARGUMENT` | `unsupported arguments; supported: <supported form>` |
| `GIT_SAFE_VERSION` | `Git 2.31 or later is required` |
| `GIT_SAFE_REPOSITORY` | `not inside a Git repository` |
| `GIT_SAFE_POLICY_IO` | `cannot read .ai/security-paths.json; refusing to run without a valid policy` |
| `GIT_SAFE_SECRET` | `requested path is protected by the security policy` |
| `GIT_SAFE_REVISION` | `revision does not resolve to a commit` |
| `GIT_SAFE_RECORD` | `invalid Git metadata; no result was emitted` |
| `GIT_SAFE_GIT` | `Git operation failed; no result was emitted` |
| `GIT_SAFE_INTERNAL` | `internal failure; no result was emitted` |

`<supported form>` is the exact applicable `SUPPORTED_FORMS` value, without added punctuation.

The exact argument-bound message is:

```text
GIT_SAFE_ARG_LIMIT: Git arguments exceed the safe invocation bound; narrow with -- <paths> or a smaller commit range. No result was emitted.
```

The low-level `session.git` overflow error is:

```text
GIT_SAFE_LIMIT: output exceeds 1048576 bytes
```

`executeGitSafe` adds command-specific guidance. `NARROWING_GUIDANCE` values are exactly:

```text
diff: Narrow with -- <paths> or a smaller commit range.
log: Narrow with -- <paths>, attached -n<k>, or a smaller commit range.
show: Narrow with -- <paths>.
cat: Use grep with a more selective pattern or select a smaller file.
ls: Narrow with -- <paths>.
grep: Narrow with -- <paths> or a more selective pattern.
```

The complete command-level limit message is:

```text
GIT_SAFE_LIMIT: output exceeds 1048576 bytes. <guidance> No partial result was emitted; this review is not complete.
```

For every handled CLI failure:

```js
{
  exitCode: 2,
  stdout: Buffer.alloc(0),
  stderr: "git-safe: " + error.message + "\n"
}
```

No rejected revision, path, pattern, raw policy, native exception or Git stderr is interpolated.

C1 policy errors retain their codes and messages. Relevant exact details include:

```text
POLICY_JSON: policy text must be valid JSON
POLICY_ROOT: policy must be a JSON object
POLICY_SCHEMA: policy.schema must be 1 or 2
POLICY_PATTERNS: policy.patterns must be an array
POLICY_PROJECT_PATTERNS: policy.projectPatterns must be an array
POLICY_ENTRY: <location> must be an object
POLICY_GLOB: <location>.glob must be a nonempty string
POLICY_ANCHOR: <location>.anchor must be "any" or "root"
POLICY_GLOB_SYNTAX: <location>.glob uses unsupported syntax
POLICY_GLOBSTAR: <location>.glob must use * or a separate **/ component; ** must be a whole component
POLICY_GLOB_PATH: <location>.glob must be a canonical repository-relative glob
POLICY_ANCHOR_ANY: <location>.glob must start with **/ for anchor "any"
POLICY_ANCHOR_ROOT: <location>.glob must not start with **/ for anchor "root"
POLICY_LEGACY_ANCHOR: <location>.anchor conflicts with the inferred legacy anchor
```

Locations are `patterns[i]` or `projectPatterns[i]`. C1's existing validation order remains
authoritative. C4 does not expose its internal path-validator errors for CLI path arguments.

#### Required reference text

Replace the obsolete policy-source and passthrough description in `references/security.md`.
Include the six supported forms, minimum Git version, supported schemas, and these paragraphs:

```text
Every git-safe command limits its complete stdout result to 1,048,576 bytes. Exactly that
many bytes is allowed. Larger results are refused without partial output. Narrow paths with
-- <paths>; for log, use attached -n<k> or a smaller commit range. For an oversized cat result,
use grep with a more selective pattern or select a smaller file. A refused result is not a
completed review. After narrowing, record the reviewed subset and the scope still unreviewed.
```

```text
Log counts limit content output, not the names-only policy inventory. That inventory runs
once over the full resolved expression. A single-revision log may walk the full reachable
history; use a smaller commit range to reduce that work.
```

```text
Paths are literal and repository-root-relative. Secret checks are case-insensitive through
the shared policy; Git object lookup preserves exact case. The installed policy is required.
The reader supports policy schemas 1 and 2 and refuses unknown schemas.
```

```text
Git 2.31 or later is required. The reader preserves the user's global and system configuration
sources, including safe.directory, while removing environment-injected keys and overriding
the execution and output settings used by these commands.
```

Retain the existing prohibition on agent reads of environment templates and the distinction
between agent-facing controls and script-only inspection.

### 3.10 Complete reviewed runtime unit

This extends C3's gate under the maintainer requirement.

In every plan, migration or ordinary, if any catalog runtime target is created or modified,
every catalog member must end equal to its current trusted source.

An arbitrary draft, a genuine old reader, a matching version label, a claimed source hash or
an approved plan hash cannot authorize different runtime bytes.

#### Target recognition

For each catalog unit, recognize a target or alias with exactly:

```js
matchesPolicyPath(target, {
  schema: 2,
  patterns: [{ anchor: "root", glob: unit.target }],
  projectPatterns: []
})
```

This uses C1's case, trailing-dot/space and colon handling. There is no additional realpath
alias lookup. C2's existing link and path checks remain first.

A matching alias draft must itself equal the trusted source. An alias operation does not
satisfy a missing canonical catalog member on a host where it is a different file.

#### Candidate and trusted bytes

Use C3's reviewed normalized SHA-256 comparison:

1. Remove one initial UTF-8 BOM.
2. Normalize CRLF to LF.
3. Ensure the normalized text ends in LF.
4. Compare the resulting hash with the current trusted source's normalized hash.

Do not compare only labels, run-local hashes or manifest claims.

Raw draft and installed hashes remain bound through C2/C3. Normalized equality does not weaken
raw input-drift detection.

For each canonical catalog target, use its planned candidate when present. Otherwise use its
installed candidate only through a declared and bound transaction-input role as specified by
C2 and C3 I3-2.

Check the role before reading an unchanged installed target. Missing candidates or roles give
`TOOL_UNIT_UNREVIEWED` without reading the unbound target. Do not silently add transaction
inputs or change C2's input-union contract.

Do not read a protected runtime target to establish eligibility. Preserve C3 I3-3's refusal
ordering.

#### Check order and placement

Preserve existing C2 structural, link, refusal-set and binding checks.

In analysis, run the new check only when the earlier rejection-entry map is empty, matching
C3's existing control-check block. Existing earlier errors are not replaced by a runtime error.

Within that block:

1. Preserve `MIGRATION_REQUIRED`.
2. Preserve migration projection validation and `MIGRATION_OUTPUT_MISMATCH`.
3. Preserve C3's existing capability and reviewed-unit checks.
4. Run the new all-plan complete-unit check.
5. Continue to approval evaluation and write-producing prepare work.

The new check uses catalog file order for its first offending target. Existing C3 checks retain
their existing order and precedence, including `TOOL_UNIT_INCOMPATIBLE` before candidate
equality for the same unit.

Run the check at all four boundaries:

- Prepare.
- Unprepared diff.
- Prepared diff.
- Commit.

Prepared diff must check before constructing printable review text. Commit must check current
trusted sources and bound candidates before manifest verification and before journal or target
writes. Prepare must refuse before plan/heartbeat writes attributable to successful prepare.

Do not cache a successful prepare check as commit authority.

An ordinary plan with no runtime create or modify does not force an unrelated runtime upgrade.

#### Exact refusal envelopes

For a bad or missing runtime candidate:

```text
code: TOOL_UNIT_UNREVIEWED
error: TOOL_UNIT_UNREVIEWED: reviewed tool bytes required: <canonical target>
exit: 3
```

Use the canonical catalog target in diagnostics, including for an alias operation.

Prepare uses envelope P:

```json
{
  "ok": false,
  "code": "APPLY_PLAN_REJECTED",
  "error": "plan rejected",
  "errors": [
    {
      "target": "<canonical target>",
      "code": "TOOL_UNIT_UNREVIEWED",
      "error": "TOOL_UNIT_UNREVIEWED: reviewed tool bytes required: <canonical target>"
    }
  ]
}
```

Both reviews and commit use envelope F:

```json
{
  "ok": false,
  "code": "TOOL_UNIT_UNREVIEWED",
  "error": "TOOL_UNIT_UNREVIEWED: reviewed tool bytes required: <canonical target>",
  "target": "<canonical target>"
}
```

Serialize using the existing apply convention: two-space JSON indentation, terminal LF,
stdout only, empty stderr.

A malformed trusted catalog keeps:

```text
code: TOOL_CATALOG
error: TOOL_CATALOG: invalid runtime unit catalog
target: data/runtime-units.json
exit: 3
```

Use P in prepare and F in reviews and commit.

Keep existing IO contracts:

- Prepare: P, exit 3, inner `APPLY_INPUT_IO`, with
  `cannot read transaction input: <relative path>`.
- Review: F, exit 2, `APPLY_DIFF_IO`, with
  `cannot read draft review input: <relative path>`.
- Commit: F, exit 2, `APPLY_INPUT_IO`, with
  `cannot read transaction input: <relative path>`.

These IO messages retain the landed convention; do not prepend a second code token.
Unsafe-path failures retain `APPLY_PATH` and exit 2.

Successful plans retain existing approval requirements. Passing trusted-source comparison does
not approve replacement of user-edited content.

## 4. Tests and assertion registration

### 4.1 Component descriptors

Add these descriptors, in this order, to `COMPONENT_ASSERTIONS.C4`:

```text
R41/C4/cat
commit blob reads and secret refusals

R42/C4/ls
literal tree listings omit protected paths

R42/C4/grep
tree grep filters secrets and distinguishes no match

R43/C4/history
historical secret paths remain protected

R47/C4/project-policy
project additions reach Git commands

R74/C4/corpus
shared policy corpus reaches Git consumers

R75/C4/exact-case
Git lookup preserves exact path case

R75/C4/nul-records
NUL records preserve unusual path names

R76/C4/arguments
explicit command grammars and literal selectors

R76/C4/revisions
content commands receive resolved commits

R76/C4/isolation
Git configuration and executable filters are isolated

R76/C4/failures
policy and Git failures emit no content

R76/C4/limits
whole results obey the exact byte limit

R76/C4/narrowing
limit diagnostics preserve incomplete review scope

R97/C4/environment-names
environment name variants stay protected

R80/C4/runtime-targets
every plan requires a complete reviewed runtime unit

R78/C4/reader-unit
reviewed reader opens schema two migration
```

`tests/c4.test.mjs` exports exactly `C4_IMPLEMENTATIONS`, a frozen array of `{ id, run }`
descriptors. Each run function uses the landed component context and returns:

```js
{ failures: [], skipped: null }
```

Failures are accumulated using the C3 pattern. Missing production exports or missing fixtures
are failures, not skips. Imports perform no work.

Add `COMPONENT_IMPLEMENTATIONS.C4` from these descriptors. Expected assertion names remain
independently written in `COMPONENT_ASSERTIONS`, not derived from implementations.

Do not alter complete-case inventories or emit complete R41, R42 or other numbered records.
C11b owns their composition. Do not add a C4 test of the C11a runner contract.

### 4.2 Fixture format and accepted arguments

`tests/fixtures/git-safe-cases.json` has exactly:

```js
{
  schema: 1,
  arguments: [{ id, argv, command, accepted }],
  names: [{ id, path, content }]
}
```

For every argument row, `command` equals `argv[0]`, including accepted rows A01-A14.

The argument rows are:

```text
A01 ["diff","c4-base..c4-head"]
A02 ["diff","c4-base...c4-head","--stat"]
A03 ["diff","--name-status","c4-base..c4-head"]
A04 ["diff","c4-base..c4-head","--name-only","--","src"]
A05 ["log","-p","HEAD~1..HEAD"]
A06 ["log","--oneline","-n2","c4-head"]
A07 ["log","--max-count=0","c4-base...c4-head"]
A08 ["show","c4-head"]
A09 ["show","--stat","c4-head","--","safe.txt"]
A10 ["show","c4-head","--name-status"]
A11 ["cat","c4-head","--","safe.txt"]
A12 ["ls","c4-head","--","src"]
A13 ["grep","c4-head","-needle","--","safe.txt"]
A14 ["grep","c4-head",""]
A15 ["log","--reverse","c4-head"]
A16 ["diff","--cached","c4-base..c4-head"]
A17 ["show","--format=short","c4-head"]
A18 ["log","-n","2","c4-head"]
A19 ["log","^c4-base","c4-head"]
A20 ["show","HEAD:.env"]
A21 ["cat","--help","--","safe.txt"]
A22 ["diff","-c"]
A23 ["ls","c4-head","--"]
A24 ["cat","c4-head","--","./safe.txt"]
A25 ["cat","c4-head","--","a/../safe.txt"]
A26 ["grep","c4-head","a\u0000b"]
A27 ["show","HEAD^"]
A28 ["show","HEAD~"]
A29 ["diff","HEAD"]
A30 ["grep","c4-head","--"]
A31 ["grep","c4-head","--","--","safe.txt"]
```

Accepted rows are A01-A14, A27-A28 and A30-A31. All other rows give the exact applicable
`GIT_SAFE_ARGUMENT` error.

Names rows N01-N09 use these paths in order, each with content `needle\n`:

```text
safe.txt
MixedCase.txt
space name.txt
tab\tname.txt
line\nname.txt
docs/r\u00e9sum\u00e9.txt
-dash.txt
a*b.txt
:(glob)literal.txt
```

JSON escape sequences represent the corresponding characters.

The tests independently assert fixture IDs, accepted flags and parser results. They do not
derive expected parser values from the implementation.

### 4.3 Test execution strategy

Use real Git for cat, ls and representative grep integration. Use the executor and readFile
seams for the full policy-consumer matrix, exact argv assertions, malformed metadata, failure
paths and output boundaries.

Windows-hostile path names are created in Git objects through fixture plumbing, not through
unsupported worktree filenames. All protected fixtures contain explicit dummy markers.

The R74 and R97 matrices must not multiply every row by real Git process launches. Synthetic
NUL inventories and content executors exercise the production matcher and builders directly.

Expected component-run cost is approximately 350-700 child processes, dominated by real Git
fixtures, installed-reader runs and apply transactions. This is an estimate, not an acceptance
counter.

The test environment is isolated using the landed harness. Do not use the developer's real
global configuration, hooks or credentials.

### 4.4 R41: cat

Required cases:

- `cat <commit> -- safe.txt` returns exactly the stored bytes.
- A dirty worktree version differs; returned bytes remain the committed bytes.
- Empty blob returns empty stdout, exit 0.
- Binary blob, including NUL, is returned unchanged.
- A protected path returns the exact secret error, empty stdout and exit 2.
- The secret refusal occurs before revision resolution or cat-file execution.
- Case and adopted Windows aliases remain protected.
- A symlink returns its link-text blob, without reading its target.
- Missing path, directory and gitlink return `GIT_SAFE_GIT`.
- Caller object syntax is refused before all Git calls.
- Recorded cat argv is exactly section 3.6 after resolved-commit lookup.

### 4.5 R42: ls and grep

For a tree with protected names plus `safe.txt` and `src/a.txt`:

```text
ls C
```

returns exactly:

```js
Buffer.from("safe.txt\0src/a.txt\0")
```

`ls C -- src` returns exactly `Buffer.from("src/a.txt\0")`.

Test exact-file selectors, directory selectors, missing selectors, duplicate selectors,
literal wildcard names and literal magic-looking names. A protected-only selection returns
zero bytes, exit 0.

For a matching safe file, grep returns exactly:

```js
Buffer.from(C + ":safe.txt\0" + "1\0" + "needle\n")
```

Test:

- Empty pattern and leading-dash pattern.
- Pattern `--`, with and without selectors.
- Basic regex semantics despite extended-regexp configuration.
- Column configuration cannot add a field.
- Binary content is omitted.
- Status 1 with empty output is exit 0.
- Status 1 with output, status 2, signal and spawn failure are exact Git failures.
- All-protected selection makes no content call.
- Content argv contains `-e`, the resolved ID and the path separator.
- With selector `src`, protected names outside `src` are absent from E.
- Hundreds of protected names outside `src` cannot cause the narrowed grep to exceed argv
  limits; the same unselected whole-tree request can exceed the limit.
- With no selectors, all protected tree names remain in E.

### 4.6 R43: historical protection

Cover addition, modification and deletion of protected files, including files absent at the
range head. Assert exclusions contain those historical names and content contains no dummy
marker or protected patch header.

Cover:

- Two-dot and three-dot diff.
- Root show.
- Merge show against every parent.
- Log merge inventory using explicit separate diffs.
- A historical file name later used as a directory.
- Empty and protected-only ranges.

#### Count regression: all-protected range

Construct:

```text
A -> B -> C
```

A has no selected files. B adds `private/older.txt`; C adds `private/newer.txt`.
Both names are protected by root-anchored `private/**`.

For:

```text
log -p -n1 A..C
```

assert:

- One names-only inventory, with resolved `A..C`.
- Its exact argv includes `--diff-merges=separate` and `--full-history`.
- It contains no `-n1` or `--max-count=1`.
- Its parsed names include both protected names.
- No content call follows.
- Stdout is an empty Buffer, stderr is empty, exit is 0.

#### Count regression: older safe change

Construct:

```text
A -> S -> B -> C
```

A contains `safe.txt` with `before\n`.
S changes it to `after\n`.
B adds `private/older.txt`.
C adds `private/newer.txt`.

Use SHA-1 fixture objects, local `core.abbrev=7`, no abbreviation collisions, and S metadata:

```text
author: Fixture <fixture@example.invalid>
committer: Fixture <fixture@example.invalid>
author date: 1700000000 +0000
committer date: 1700000000 +0000
message: safe change
```

For `log -p -n1 A..C`, the inventory still has no count. Content argv has
`--max-count=1` and both exclusions in UTF-8 order.

Define `OLD7` and `NEW7` as the first seven hexadecimal characters of the independently
calculated Git blob IDs for `before\n` and `after\n`. Define S as the fixture's full commit ID.

Expected stdout is exactly the following UTF-8 text, with substitutions and terminal LF:

```text
commit <S>
Author: Fixture <fixture@example.invalid>
Date:   Tue Nov 14 22:13:20 2023 +0000

    safe change

diff --git a/safe.txt b/safe.txt
index <OLD7>..<NEW7> 100644
--- a/safe.txt
+++ b/safe.txt
@@ -1 +1 @@
-before
+after
```

No B or C commit header or protected content appears. Stderr is empty and exit is 0.

#### Path-limited merge-history regression

Construct this topology:

```text
A -> S -> U -> V
      \        \
       -> P2 -> M
```

M's ordered parents are `[V, P2]`; V is the first parent.

Trees:

- A: `src/safe.txt` contains `before\n`.
- S: `src/safe.txt` contains `after\n`.
- U, parent S: adds `src/hidden.pem`.
- V, parent U: removes `src/hidden.pem`; its tree equals S.
- P2, parent S: adds `src/current.pem`.
- M: tree equals P2.

Both `.pem` paths contain dummy markers and match root-anchored `src/*.pem`.
S uses the metadata from the preceding control.

Run:

```text
log -p -n1 A..M -- src
```

Assert the exact inventory argv includes:

```text
--diff-merges=separate
--full-history
<resolved-A>..<resolved-M>
--
:(literal)src
```

There is no inventory count. Its names include all three paths:

```text
src/current.pem
src/hidden.pem
src/safe.txt
```

Content argv includes:

```text
--max-count=1
<resolved-A>..<resolved-M>
--
:(literal)src
:(exclude,literal)src/current.pem
:(exclude,literal)src/hidden.pem
```

Expected stdout is exactly the older-safe-change text above with every patch path changed from
`safe.txt` to `src/safe.txt`, and the full S ID from this fixture. OLD7 and NEW7 are unchanged.

Stderr is empty; exit is 0. Neither protected name, marker, U header nor V header appears.

This fixture must retain the specified parent order. The test must not replace it with a
linear history or a merge whose first parent already contains the protected additions.

### 4.7 R47 and R74: effective policy and corpus

R47 tests every command with:

- A root project entry `private/**`.
- Its any-depth counterpart.
- A managed entry plus a project entry.
- A reviewed commit carrying a different policy.
- An installed schema-1 policy adapted by C1.
- An installed schema-2 policy.

Cat refuses protected paths. Other commands omit them. Root policy leaves
`nested/private/...` visible; any-depth policy protects it.

R74 consumes the existing `tests/fixtures/security-policy-corpus.json`.

Run all 78 matching rows through all six consumers, once in managed patterns and once in
project patterns. Use synthetic inventory/content seams for the full matrix. Expected
classification comes from the corpus, not from a second call to the production matcher.

For a protected row:

- Cat gives `GIT_SAFE_SECRET`.
- Other commands omit the name and emit no dummy content.

For an unprotected row:

- Cat returns the known dummy bytes.
- Ls returns the original path plus NUL.
- Grep returns the pinned NUL framing.
- Diff/log/show execute with the expected literal selector and without an exclusion for that
  name.

Run all 27 rejected corpus entries through an installed schema-2 policy, separately at
`patterns[0]` and `projectPatterns[0]`. Keep the other collection empty.

Preserve the corpus error code. Rewrite only its location token `entry` to the applicable
collection location. For example:

```text
POLICY_GLOB_SYNTAX: entry.glob uses unsupported syntax
```

becomes:

```text
POLICY_GLOB_SYNTAX: patterns[0].glob uses unsupported syntax
```

Do not use schema 1 for these rejected rows; that would change anchor-error precedence.

Use a small real-Git representative set for cat, ls and grep to prove installed-reader wiring.
The corpus matrix itself must use the production execute seam.

### 4.8 R75: exact case and NUL records

Assert:

- Secret matching folds case on every platform.
- Unprotected lookup preserves exact case.
- Two Git tree entries differing only by case remain distinct.
- Looking up the wrong case fails rather than selecting another spelling.
- Every N01-N09 name survives inventory parsing and ls framing unchanged.
- LF, TAB and spaces never split records.
- Sorting uses UTF-8 bytes, not locale order.
- Empty NUL records are ignored.
- Missing final NUL, malformed tree headers, invalid IDs, invalid UTF-8, invalid structural
  paths and mode `100664` give `GIT_SAFE_RECORD`.
- No content call follows invalid metadata.

### 4.9 R76: arguments and revisions

Assert every parser return key and value for A01-A31.

Additional parser cases include:

- Each allowed option position.
- Duplicate flags and mutually exclusive formats.
- Counts 0 and 2147483647; overflow, signs, leading zeros and detached forms.
- All intentional compatibility refusals from section 1.1.
- Every existing explicit dangerous-option refusal, including `diff -c`.
- NUL in each argument position.
- Missing and extra positional values.
- Literal `--`, leading-dash paths and magic-looking paths after the separator.
- Range splitting for `v1.2..v1.3`, `a....b` and multiple operators.
- Bare ancestry suffixes and suffix chains.

Assert exact public exports and import safety of the core.

Hand-built requests with invalid fields, unknown keys, invalid paths or revisions, invalid
combinations or duplicates give `GIT_SAFE_INPUT` before executor calls. Foreign session
objects give the same result.

Record and compare complete argv arrays, including P, for every inventory and content variant.
Do not assert only the presence of selected safety flags.

Revision cases include:

- Branch, tag, annotated tag and full commit ID.
- Bare and numbered ancestry suffixes.
- Blob, tree and missing revisions.
- One resolution per distinct endpoint spelling.
- LF and CRLF resolution output.
- Malformed or empty successful output.
- Three-dot merge-base success, nonzero failure and malformed success.
- A moved ref after resolution: content still receives the originally resolved ID.
- Zero-count log: policy and resolution run; inventory and content do not.
- No `rev-list` or per-commit tree inventory loop.

Argument-bound cases include exactly 24000 units, 24001 units, executor `E2BIG`,
executor `ENAMETOOLONG`, many safe paths without positive expansion, and many protected names.
Assert the exact error and absence of the oversized executor call.

### 4.10 R76: isolation and failures

Environment assertions cover every removed name, case variants, numbered config keys and
preserved unrelated values. Input objects remain unchanged.

Preserve `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_SYSTEM` and `GIT_CONFIG_NOSYSTEM` exactly.

Place the safe.directory test entry in a fixture-owned config file:

```js
path.join(context.tmp, "c4-safe-directory.gitconfig")
```

Select that file through `GIT_CONFIG_GLOBAL`. Do not rely on `$HOME/.gitconfig`.
Assert both its preservation at the seam and successful real-Git use of the selected file.

Use fixture executables or scripts with a sentinel output file to detect attempted execution
from external diff, textconv, fsmonitor and pager settings. The sentinel must remain absent.
Exercise global and local configuration; environment-injected configuration must not reach Git.

Test:

- `log.follow=true` cannot expose protected history through a safe renamed path.
- `grep.patternType`, `grep.extendedRegexp` and `grep.column` cannot change pinned behavior.
- Color, notes, signature, mailmap, prefix and order-file settings cannot change the specified
  command modes.
- Prefix tests use explicit argv flags and do not depend on Git 2.45 configuration support.
- The installed entrypoint executes through a supported alternate path; it does not silently
  exit 0 before main.

Version seam cases:

```text
git version 2.30.9\n             GIT_SAFE_VERSION
git version 2.31.0\n             accepted
git version 2.53.0.windows.2\r\n  accepted
git version 3.0.0\n              accepted
unparseable successful output    GIT_SAFE_VERSION
nonzero status                  GIT_SAFE_GIT
spawn failure                   GIT_SAFE_GIT
```

For a version refusal, no root lookup, policy read or later operation occurs.

Failure cases include missing policy, invalid JSON, invalid UTF-8, malformed policy fields,
unsupported schema, root discovery failure, invalid root bytes, inventory failure, content
failure, signals, rejected executor promises and every invalid executor-result combination.

Put a dummy marker in injected stdout, stderr and error strings. Every failure must have empty
stdout and exactly the specified safe diagnostic, with no marker.

The readFile seam asserts the exact native policy path. Executor seams assert normalized root
cwd and the starting cwd for version/root calls.

### 4.11 R76: byte bounds and guidance

For each of the six commands, test output lengths:

```text
0
1048575
1048576
1048577
```

Use the execution seam for the complete matrix and a real oversized cat blob for production
capture behavior.

Include multibyte UTF-8 data whose character count is below the limit while its byte count
crosses it. Include grep NUL prefixes and log/show headers in the byte total.

Test both:

- `overflow: true`.
- Oversized returned Buffer with `overflow: false`.

Metadata inventory larger than 1 MiB must not be confused with the final stdout bound.

Assert exact command-specific error lines, exit 2, empty stdout and no partial content.
Assert the exact `NARROWING_GUIDANCE` map and required reference paragraphs.

No message may describe the narrowed subset as a completed full review.

### 4.12 R97: environment-name variants

Run every environment-name row of the shared corpus through all six consumers using the same
managed/project placements and seams as R74.

Include root and nested `.env`, `.env.example`, `.envrc`, `.env-prod` and case variants covered
by the shared policy.

There is no template exception in git-safe. Cat refuses protected template content; other
commands omit it. C9 alone owns script-only template inspection.

### 4.13 R80: runtime-target enforcement

Exercise prepare, unprepared diff, prepared diff and commit independently.

For each boundary, cover:

- Already-schema-2 policy plus an ordinary downgrade draft.
- Schema-1 ordinary plan plus an arbitrary runtime draft.
- Migration with arbitrary runtime content.
- Correct entrypoint with a missing core helper.
- Correct helper draft with an outdated reader.
- One matching target with another catalog member missing.
- Missing declaration for an unchanged member.
- Trusted complete unit with required approvals.
- Canonical and case-alias runtime targets.
- Normalized-equal BOM/CRLF text.
- Raw input drift despite normalized equality.
- Changed trusted source after prepare.
- Forged approved-plan hash and forged claimed source hash.
- Missing candidate role checked before reading its path.
- Protected runtime target refused before content read.
- Multiple bad members: first error follows catalog order.
- Earlier analysis errors: runtime checking does not replace them.
- Ordinary unrelated plan: no forced unit upgrade.
- Capability and migration-output errors retain existing precedence.

For isolated ordinary-unit failures, assert the complete P or F envelope from section 3.10,
exit 3, empty stderr and no project, plan, journal, manifest or successful-prepare heartbeat
write.

Prepared review and commit tests must use forged-but-hash-approved plans where needed to prove
that prepare is not the only boundary.

Keep apply's no-Git property. The runtime comparison uses file/hash operations, never Git.

### 4.14 R78: reviewed production reader

Assert the production catalog exactly, including roles, order and `[1, 2]` capabilities.

Install all three real files into scratch projects. Exercise the installed reader with schema 1,
schema 2 and schema 3. Schema 3 must return exactly:

```text
git-safe: POLICY_SCHEMA: policy.schema must be 1 or 2
```

with terminal LF, exit 2 and empty stdout. No resolution or content operation follows policy
rejection.

Use C11a's genuine-v2 fixture construction for production migration. Apply C3's required
decisions and approvals, including explicit replacement-coverage decisions. Stage the complete
production runtime unit.

Assert:

- Production schema-2 migration now succeeds.
- Runtime files precede dependent policy writes.
- Manifest remains last.
- Installed cat and ls work with the migrated policy.
- Unknown-schema rejection occurs through the installed CLI.
- Rollback restores the genuine-v2 policy and runtime state.

Do not import `run-tests.mjs` or add exports to expose `freshSetup`.

### 4.15 Existing test edits and unchanged expectations

R01 includes C4's 17 component assertions internally, following its existing C1-C3 aggregation.
It must not print nested component PASS records or add complete numbered cases.

Update `freshSetup` to stage:

```text
.ai/tools/security-policy.mjs
.ai/tools/git-safe-core.mjs
.ai/tools/git-safe.mjs
```

Existing baseline S01 covers that setup path. No separate assertion against its private function
is required.

C3's synthetic `CATALOG_COMPAT` remains a two-unit synthetic contract. Keep its pure and scratch
tests unchanged unless they actually use the production catalog.

Tests that previously expected the production reader's `[1]` capability must instead use an
explicit incompatible scratch catalog whose entrypoint has `policySchemas: [1]`. Preserve
their exact `TOOL_UNIT_INCOMPATIBLE`, precedence and no-write assertions.

Add production success coverage under `R78/C4/reader-unit`; do not weaken incompatible-catalog
coverage to accommodate the newly compatible production reader.

Expected retained results on this Windows host:

```text
baseline: 59 PASS / 0 FAIL / 1 SKIP
C11a:     8 PASS / 0 FAIL / 0 SKIP
C1:       12 PASS / 0 FAIL / 0 SKIP
C2:       14 PASS / 0 FAIL / 0 SKIP
C3:       18 PASS / 0 FAIL / 0 SKIP
```

The baseline skip remains R13d.

## 5. Edge cases and failure-mode mapping

| Edge or failure mode | Required assertion |
| --- | --- |
| Leading-dash revision or unsafe option | R76 arguments |
| Leading-dash grep pattern or literal path | R42 grep; R76 arguments |
| Object form, blob ID, tree ID, missing revision | R41 cat; R76 revisions |
| Bare ancestry suffix and range parsing | R76 arguments/revisions |
| Historical secret absent at head | R43 history |
| Count applied after protected-path filtering | R43 count regressions |
| Merge branch hidden by path simplification | R43 merge-history regression |
| Merge changes relative to every parent | R43 history |
| Empty result versus actual Git failure | R42 grep; R76 failures |
| Whitespace, LF, TAB and non-ASCII names | R75 NUL records |
| Exact-case lookup after folded protection | R75 exact-case |
| Invalid UTF-8 or unsupported tree mode | R75 NUL records |
| Injected config and pathspec environment | R76 isolation |
| User-selected global safe.directory file | R76 isolation |
| Textconv, external diff, pager or fsmonitor | R76 isolation |
| Basic grep regex and fixed NUL framing | R42 grep; R76 isolation |
| Git below 2.31 | R76 failures |
| Foreign session or invalid hand-built request | R76 arguments |
| Exact byte limit and multibyte data | R76 limits |
| Log/show bounded instead of streamed | R76 limits |
| No partial content in diagnostics | R76 failures/limits |
| Narrowing does not imply full review | R76 narrowing |
| Large safe inventory does not expand argv | R76 arguments |
| Protected names still exceed argv bound | R76 arguments |
| Grep narrowing removes unrelated exclusions | R42 grep |
| Malformed or unknown policy schema | R74 corpus; R76 failures |
| Project policy reaches every consumer | R47 project-policy |
| Environment templates have no reader exception | R97 environment-names |
| Ordinary-plan runtime downgrade | R80 runtime-targets |
| Incomplete runtime installation | R80 runtime-targets |
| Forged plan or changed trusted source | R80 runtime-targets |
| Production schema-2 migration gate opens | R78 reader-unit |
| Alternate CLI path does not silently skip main | R76 isolation |
| Trailing slash or backslash selector | R76 arguments |

## 6. Runnable acceptance

Run from the repository root after the tests and implementation lanes finish:

```powershell
node project-setup/tests/run-component-tests.mjs --component C4
node project-setup/tests/run-component-tests.mjs --component C11a
node project-setup/tests/run-component-tests.mjs --component C1
node project-setup/tests/run-component-tests.mjs --component C2
node project-setup/tests/run-component-tests.mjs --component C3
node project-setup/tests/run-tests.mjs
```

Each command must exit 0 with empty stderr.

C4 stdout must contain exactly these result lines in this order, followed by its summary and
evidence path:

```text
PASS  R41/C4/cat  commit blob reads and secret refusals
PASS  R42/C4/ls  literal tree listings omit protected paths
PASS  R42/C4/grep  tree grep filters secrets and distinguishes no match
PASS  R43/C4/history  historical secret paths remain protected
PASS  R47/C4/project-policy  project additions reach Git commands
PASS  R74/C4/corpus  shared policy corpus reaches Git consumers
PASS  R75/C4/exact-case  Git lookup preserves exact path case
PASS  R75/C4/nul-records  NUL records preserve unusual path names
PASS  R76/C4/arguments  explicit command grammars and literal selectors
PASS  R76/C4/revisions  content commands receive resolved commits
PASS  R76/C4/isolation  Git configuration and executable filters are isolated
PASS  R76/C4/failures  policy and Git failures emit no content
PASS  R76/C4/limits  whole results obey the exact byte limit
PASS  R76/C4/narrowing  limit diagnostics preserve incomplete review scope
PASS  R97/C4/environment-names  environment name variants stay protected
PASS  R80/C4/runtime-targets  every plan requires a complete reviewed runtime unit
PASS  R78/C4/reader-unit  reviewed reader opens schema two migration
17 PASS / 0 FAIL / 0 SKIP
RESULTS  <absolute-component-results-path>
```

The evidence path is the actual retained absolute path returned by the landed runner.
The report must have component `C4`, `ok: true`, no registry errors, 17 ordered passing results,
and summary `{passed:17,failed:0,skipped:0}`.

The other component runs retain their existing descriptor lines and end with:

```text
8 PASS / 0 FAIL / 0 SKIP
RESULTS  <absolute-component-results-path>
```

```text
12 PASS / 0 FAIL / 0 SKIP
RESULTS  <absolute-component-results-path>
```

```text
14 PASS / 0 FAIL / 0 SKIP
RESULTS  <absolute-component-results-path>
```

```text
18 PASS / 0 FAIL / 0 SKIP
RESULTS  <absolute-component-results-path>
```

`run-tests.mjs` retains its existing final envelope format. Its final lines are:

```text
59 PASS / 0 FAIL / 1 SKIP

{"env":{"platform":"win32","release":"<release>","node":"<node>","git":"<git>"},"summary":{"passed":59,"failed":0,"skipped":1},"resultsFile":"<results-path>"}
```

The last line is one compact JSON line containing actual host values and a JSON-escaped path.
There is no `RESULTS` line in the baseline runner.

Do not require complete rc.1 acceptance at C4. Later components still own missing complete-case
assertions. Do not convert their absence into C4 skips or claim release readiness.

This planning lane did not run these commands or write fixtures.

## 7. Rollback

If a later component fails, first revert or disable that component's dependency on C4.
Do not revert C4 while leaving callers that require its exports or new installed reader.

A source rollback must revert the coupled C4 change:

- Core and entrypoint.
- Catalog capabilities and helper registration.
- All-plan runtime enforcement.
- Security reference changes.
- Corresponding test integration.

Never leave a catalog claiming schema-2 support while restoring the v2 reader.

For an already-migrated project, use the current rc.1 apply tooling and its journal:

```text
node <SKILL_DIR>/scripts/apply.mjs rollback --run-id <id>
```

Rollback project runs newest first. Restore policy, settings, runtime files and manifest as the
journaled compatible unit. Remove newly created helpers only when their current bytes still
match the run.

Preserve later user edits. An incomplete rollback returns exit 6 and retains unresolved
backups. Do not discard them or overwrite a later manifest.

Roll back project state before reverting the installed skill. A project retaining schema 2
must retain the complete reviewed schema-2 runtime unit. It cannot safely keep schema 2 with
the old reader.

C5, C8, C10 and C11b depend on the exports, catalog or reader behavior named in section 2.6.
Their changes must be considered before a source revert.

Q6 remains a compatibility signal, not a retroactive pre-write guard in every v2 command.
Do not use v2 commands to repair a schema-3 project.

## 8. Accepted residual risks

- The checkout executing the reader and its policy is trusted. Protecting execution from a
  hostile checked-out tool is outside design A3's chosen boundary.

- Path policy cannot detect secret bytes copied into an allowed filename or placed in a commit
  message. C4 enforces names, not content classification.

- C1's adopted ASCII-oriented case and Windows alias handling remains the protection model.
  Full Unicode normalization and case-fold aliases are not added because the real protected
  names are ASCII and host deny controls remain the final defense.

- Global, system and local configuration remain available so normal Windows ownership handling
  and user configuration sources work. The command prefix and operation flags override the
  executable and output behaviors used by this interface; C4 is not a general Git sandbox.

- Log inventory can be expensive on long histories. It is one names-only Git process over the
  complete expression, with full-history traversal where required. `-n<k>` limits content only.
  This cost preserves filtered-log semantics and protects older and merged secret paths.

- Metadata inventories are not subject to the 1 MiB content limit. Very large histories can
  consume memory. The fixed result limit prevents partial review output but is not a general
  resource quota.

- Caller selectors plus protected names can still exceed the argv bound. The command refuses
  with exact narrowing guidance. It does not batch content commands or weaken exclusions.

- Operating-system command-line limits can still reject a conservatively bounded invocation
  because executable paths and inherited environments vary. Recognized length failures receive
  the pinned argument-limit error.

- Strict UTF-8 decoding and rejection of historical mode `100664` can fail an entire command.
  Changed-path inventories reduce exposure for diff/show/log. Failing closed avoids ambiguous
  policy classification.

- A trailing slash or backslash selector receives the generic supported-form argument error,
  without a specialized correction hint. The narrow grammar keeps this inexpensive and
  predictable.

- Three-dot diff uses Git's ordinary single merge-base choice. It does not enumerate every
  possible merge base in criss-cross histories.

- A literal exclusion can conservatively exclude descendants when a historical filename later
  becomes a directory. Over-filtering is accepted rather than risking protected history.

- Concurrent mutation of trusted policy or tool sources outside the apply transaction is not
  prevented by the reader. Apply binds its own transaction inputs; direct reader sessions use
  one validated policy snapshot and resolved commit IDs.

- Normalized runtime-source equality follows C3. BOM and line-ending differences can compare
  equal, while raw hashes still detect changes to approved inputs.

- Hook enforcement, host deny proof, installed instructions and release acceptance remain
  dependencies of C6, C8, C10 and C11b. C4's component pass does not claim those controls passed.

## 9. Plan questions

None.

Recorded decisions:

- C4-PQ1: use the explicit per-command grammar, retaining documented and baseline-tested forms
  plus the specified common read-only flags. Refuse all other options and interpret caller
  selectors literally.

- C4-PQ2: log inventory has no count and covers the complete resolved expression in one
  process. Apply the count only to content output, preserving filtered-log semantics.

The complete-unit rule is the maintainer-authorized extension to C3 described in section 3.10.

## Addendum at freeze: plan-critique round 3, C4-P3-1 to C4-P3-7 (NON-BLOCKING)

Added by the orchestrator when freezing, under the maintainer's approval to freeze (2026-10-18).
Each item pins a value the sections above left open. Where an item and an earlier section differ,
the item wins.

- C4-P3-1. Error mapping for root discovery, the version check and revision resolution. For
  `rev-parse --show-toplevel`: a normally completed nonzero status, or status 0 with stdout that
  fails the section-3.3 root rules, gives `GIT_SAFE_REPOSITORY`; an executor rejection, throw,
  invalid result, signal, or spawn error other than `E2BIG`/`ENAMETOOLONG` gives `GIT_SAFE_GIT`;
  `E2BIG` or `ENAMETOOLONG` gives `GIT_SAFE_ARG_LIMIT`. The same executor-level mapping applies to
  the version command and to commit resolution; their status-level codes stay as specified
  (`GIT_SAFE_VERSION` / `GIT_SAFE_GIT` for the version command, `GIT_SAFE_REVISION` /
  `GIT_SAFE_RECORD` for resolution).
- C4-P3-2. Version grammar. Stdout is decoded as strict UTF-8 and must match exactly
  `^git version (\d+)\.(\d+)(?:\.(\d+))?(?:[.\- ][^\r\n]*)?\r?\n$`. It is accepted if and only if
  (major, minor) >= (2, 31), compared numerically. Any status-0 output that does not match,
  including invalid UTF-8 or more than one line, gives `GIT_SAFE_VERSION`. Tests add:
  `git version 2.31\n` accepted; `git version 2.39.5 (Apple Git-154)\n` accepted;
  `git version 2.30.9.windows.1\n` gives `GIT_SAFE_VERSION`.
- C4-P3-3. Real `safe.directory` test. Write `path.join(context.tmp, "c4-safe-directory.gitconfig")`
  containing `[safe]\n\tdirectory = *\n`; run the installed CLI with `GIT_CONFIG_GLOBAL=<that
  file>`, `GIT_CONFIG_NOSYSTEM=1` and `GIT_TEST_ASSUME_DIFFERENT_OWNER=1`, and require success.
  Control: an empty fixture global file with the same variables gives exactly
  `git-safe: GIT_SAFE_REPOSITORY: not inside a Git repository\n` on stderr, exit 2, empty stdout.
  The sanitizer preserves `GIT_TEST_ASSUME_DIFFERENT_OWNER` (it is not in the removal list).
- C4-P3-4. The supported alternate-path launch. On win32 create a directory junction with
  `fs.symlinkSync(realProjectDir, linkDir, "junction")` (no privilege needed); on other hosts a
  directory symlink. Run `node <linkDir>/.ai/tools/git-safe.mjs cat <commit> -- safe.txt` with cwd
  under the link spelling and require the committed bytes, exit 0 and empty stderr.
- C4-P3-5. Runtime normalization. "Normalize CRLF to LF" in section 3.10 means exactly C3's
  `lib.mjs` `normalizedHash`: remove one initial BOM, replace `\r\n?` (CRLF and lone CR) with
  `\n`, and add a final LF when absent. A difference only in lone CRs therefore compares equal.
- C4-P3-6. Accepted residual risk (no argv change): a user or local `log.showRoot=false`
  suppresses root-commit patches in the content log and root names in the log inventory
  consistently, so nothing leaks, but the output differs from the default. The isolated test
  configuration keeps the default.
- C4-P3-7. Section 4.13 adds the positive control section 3.10 permits: a plan with a partial
  trusted runtime update plus declared, trusted, untouched catalog members passes in prepare, both
  reviews and commit. The forged dot/space/colon alias cases stay out; the case alias is kept.
