<!--
FROZEN 2026-10-20 on branch feat/project-setup-v3-rc1. Never edit this file; changes go through the
maintainer. Component plan C11b (lands last, after C11a and C1-C10) under the frozen architecture
plan docs/plans/2026-10-15-project-setup-v3-rc1.md, which takes precedence, on the landed C1-C7
contracts and the frozen C8, C9 and C10 plans. Drafted by the plan lane (Codex, 2 revisions,
applying the critique dispositions); plan-critique (Claude) round 3 found no BLOCKING gap. The
addendum at the end records round 3's items.
-->

# C11b. Integration and candidate release

Date: 2026-10-20.

Repository: `<repo>`.

Branch: `feat/project-setup-v3-rc1`.

Implementation base: committed `f9d652512ea13e634807228fc517c05e91f186c1`, followed by the
frozen C8, C9 and C10 contracts, including their freeze addenda.

## 1. Scope and authority

C11b implements the frozen architecture plan
`docs/plans/2026-10-15-project-setup-v3-rc1.md`:

- Section 2, "C11b. Integration and candidate release".
- Section 3's installer, hashing, release-tree and provenance requirements.
- Section 4's complete case inventory, composition ownership and strict acceptance gate.
- Section 5, "C11. Fixtures and release".
- Section 6's paired upgrade, compatibility boundary and rollback order.
- The freeze addendum requiring synthetic-tag release acceptance.

The design authority is `docs/design/project-setup-v3.md`, including Part A frozen at
`54ad312` and implementation decisions Q1-Q7. Q5 and Q6 govern release production and
compatibility documentation.

Landing order remains:

```text
C11a -> C1 -> C2 -> C3 -> C4 -> C5 -> C6 -> C7 -> C8 -> C9 -> C10 -> C11b
```

C8-C10 must land before the tests lane writes C11b tests. Their implementation contracts are
inputs, not C11b design choices.

### 1.1 In scope

1. Compose all 38 numbered rc.1 cases and the two named cases from complete component evidence.
2. Preserve and strengthen the 60 baseline cases without changing their IDs or names.
3. Verify the complete installed payload in both isolated installer targets.
4. Add a local release builder for a previously existing local tag.
5. Verify commit-based ZIP production, reproducibility, identity and source immutability.
6. Set the coordinated candidate version and write exact candidate documentation.
7. Test Q6's actual v2 validation rejection without claiming a general old-command write guard.
8. Preserve component acceptance, strict evidence validation and historical v2 provenance.

### 1.2 Out of scope

- Creating, moving or pushing the real candidate tag.
- GitHub releases, uploads, network access or broad deployment.
- Executing Claude, Codex, model sessions, launcher probes or host negative-capability tests.
- Implementing an external launcher.
- Changing C1-C10 production contracts or repairing unrelated residuals.
- Remaining DRAFT cases R55-R64, R69-R71, R87-R89, R94-R96 and R98-R99.
- Completing R83 or the pending host portions of other cases.
- Application changes, database migrations, dependency upgrades or CI changes.
- Rebuilding or replacing the historical v2 archive.
- Adding a second installer, changing installer inclusion rules or adding a version.json stamp.

### 1.3 Dependencies and their disposition

| Input | C11b obligation and location |
| --- | --- |
| C11a and G1-G14, H1-H7a | Preserve strict component/gate contracts; sections 4 and 6 |
| C11a baseline helper | Retain pinned provenance and genuine fixtures; sections 3.5 and 5 |
| C1 | Compose grammar, matching, aliases and legacy-adapter assertions; section 4 |
| C2 and I2-1 through I2-10 | Preserve exact approvals, binding, refusal and recovery assertions |
| C3 and I3-1 through I3-6 | Compose baseline migration, deny ownership and snapshot assertions |
| C4 and I4-1 through I4-4 | Include real reader-unit and runtime-target assertions explicitly |
| C5 and I5-1 through I5-4 | Preserve junction, artifact, identity and copied-content boundaries |
| C6 and I6-1 through I6-10 | Preserve parser, process, merge, seven-member unit and self-test |
| C7 and I7-1 through I7-3 | Compose allows and reconciliation; retain listed residual coverage |
| Frozen C8 and its addendum | Compose 16 assertions; install checker, reference and snapshots |
| Frozen C9 and its addendum | Compose 12 assertions; preserve root-only script exception |
| Frozen C10 and its addendum | Compose 20 assertions; install doctor and preserve evidence limits |

Specific cross-component obligations are met as follows:

- R47 combines C3 project-control rendering and C4 Git enforcement.
- R74 requires C1, C3, C4 and C5 shared-corpus assertions together.
- R97 requires C1 matching, C3 rendering, C4/C5 filtering and C9 template-boundary assertions.
- R78 requires C1's non-writing adapter, C3 migration and C4's real reviewed reader unit.
- R80 requires C2 binding, C3 snapshot/derived-manifest checks and C4 runtime-target checks.
- R77 consumes C8's complete installed-copy migration, including inline edits and collisions.
- R85/R86 retain genuine-v2 fixture provenance through the existing C3/C7 assertions.
- R86 also requires C2 unchanged-file approval and mixed content/metadata coverage.
- R91 requires C5's real junction cases. Missing file-symlink privilege cannot skip R91.
- R92 combines C5 lifecycle protection, C8 instructions and C10 reserved-run discovery.
- R76 includes log/show limits and narrowing through C4, plus C5 review argument/failure checks.
- A5-templates includes all seven C8 groups and C10's final documentation contract.
- N8-doctor comprises the eight C10 doctor groups; it remains synthetic behavior evidence.
- S07 adds release acceptance, both installed inventories and Q6 validation evidence.

I7-3's four coverage gaps remain accepted residuals in section 8. C11b does not silently claim
that composing C7 closes them.

## 2. Files touched and public interfaces

All numeric ranges below refer to committed `f9d6525`. After C8-C10 land, use the stated
semantic anchors. Do not apply an old numeric offset to their resulting text.

All paths in this section are relative to `project-setup/` unless explicitly stated otherwise.

### 2.1 Production and release documentation

| Existing file | Baseline range | C11b change |
| --- | --- | --- |
| `VERSION` | 1 | Replace with exact candidate bytes |
| `CHANGELOG.md` | insertion before 3 | Prepend candidate entry; preserve historical entries |
| `SKILL.md` | 6 | Replace the release heading only |
| `README.md` | 1-5 | Candidate opening, with a separate retained security paragraph |
| `README.md` | 9-19 | Add release-builder inventory entry |
| `README.md` | 44-51 | Add strict candidate acceptance instructions |
| `README.md` | after 75 | Append local candidate-release procedure |

New production/release files:

```text
project-setup/install/release.mjs
project-setup/RELEASE-NOTES-3.0.0-rc.1.md
```

There is no repository-root `install/` directory. The architecture's relative
`install/release.mjs` means the file under `project-setup/`.

New recorded-evidence file, outside `project-setup/`:

```text
docs/plans/2026-10-20-project-setup-v3-rc1-c11b-acceptance.md
```

If acceptance runs on a later date, substitute its actual date in the filename. The
orchestrator writes this file after writable acceptance, using section 6.5's fields.
It records actual execution; it is not a test oracle.

No change to:

```text
project-setup/install/install.mjs
project-setup/data/runtime-units.json
project-setup/RELEASE-NOTES-2.0.0.md
```

The runtime catalog remains the seven C6 members, in its existing order:

```text
security-policy.mjs
git-safe-core.mjs
guard-raw-git-core.mjs
review-diff.mjs
git-safe.mjs
guard-raw-git.mjs
hooks-selftest.mjs
```

The baseline checker and doctor remain installed skill utilities. Neither becomes a project
`.ai/tools/` member.

### 2.2 Tests-lane files

New:

```text
project-setup/tests/c11b.test.mjs
project-setup/tests/helpers/rc1-integration.mjs
```

Existing:

| File | Baseline range | Change |
| --- | --- | --- |
| `tests/rc1-cases.mjs` | 8-15 | Import C11b implementations and composition helper |
| Same | 36-174 | Append independent C11b expected descriptors |
| Same | 177-186 | Register C11b implementations |
| Same | 298-305 | Implement complete-case registration |
| `tests/run-tests.mjs` | 18 | Alias imported runner; import registration and memo factory |
| Same | insertion after 96 | Instantiate and destructure the component memo |
| Same | 1266-1284 | Preserve installer/C11a checks; append C11b acceptance to S07 |
| Same | before 1304 | Register the 40 complete rc.1 cases |
| Same | 1312-1317 | Consume complete-case callback outcomes |
| `tests/c11a.test.mjs` | 2069-2070 | Replace temporary empty-registration expectation |
| `tests/c1.test.mjs` | 1608-1609 | Replace C1's temporary empty-registration expectation |
| `tests/c2.test.mjs` | 4210-4211 | Replace C2's temporary empty-registration expectation |
| `tests/c3.test.mjs` | 3771-3772 | Replace C3's temporary empty-registration expectation |
| `tests/c4.test.mjs` | 1482-1483 | Replace C4's temporary empty-registration expectation |
| `tests/c5.test.mjs` | 2576-2577 | Replace C5's temporary empty-registration expectation |
| `tests/c6.test.mjs` | 2106-2107 | Replace C6's temporary empty-registration expectation |
| `tests/c7.test.mjs` | 2371-2372 | Replace C7's temporary empty-registration expectation |
| `tests/c8.test.mjs` | landed registration check | Apply section 4.4's replacement if present |
| `tests/c9.test.mjs` | landed registration check | Apply section 4.4's replacement if present |
| `tests/c10.test.mjs` | landed registration check | Apply section 4.4's replacement if present |
| `tests/live/LIVE-ACCEPTANCE.md` | after 124 | Append candidate evidence/status section |
| `evals/evals.json` | before closing array at 13-15 | Append evaluation 20 after C9's 19 |

Each registration replacement is pinned in section 4.4. The tests lane must find and update
the same zero-registration check in landed C8, C9 and C10 tests before freezing C11b tests.

Every existing baseline `runComponentAssertions` call site and its context literal remains
byte-identical, including:

```text
R01: C4 and C5, lines 116-128
R15: C2 and C3, lines 430-442
R17: C1, lines 501-507
R29: C6 and C7, lines 951-964, followed by landed C8-C10 calls
S07: C11a, lines 1278-1283
```

The import alias and destructured memo provide caching without rewriting those calls or
contexts.

`tests/accept-rc1.mjs:1-266` and `tests/run-component-tests.mjs:1-97` require no behavior
change. Their existing gates already support the final inventory and dynamically registered
components.

The tests lane owns every test, registry, helper, live-procedure and evaluation edit above.
The implementer must not edit those files.

### 2.3 Composition with frozen C8-C10 text

- **SKILL:** C8 rewrites workflow and script inventory; C9 changes the template flow; C10 adds
  validator/doctor instructions. C11b changes only the top-level release heading. Preserve their
  exact paragraphs, commands and ordering.
- **README:** retain C8's trusted-checkout, customization, narrowing and hook-gap text. C8 also
  edits baseline lines 7-19, including the inventory region where C11b adds its release-builder
  row. Add that row to C8's resulting inventory without replacing its other rows or overview.
  Retain C10's available-doctor replacement paragraph. C11b changes the release opening,
  extends `Test first`, and appends a separate release section.
- **CHANGELOG and VERSION:** C8-C10 explicitly leave release stamping to C11b. No competing
  insertion exists.
- **run-tests:** retain C9's CLI/fixture changes and C10's installed self-test expectation.
  Preserve every existing baseline call site and context literal, including C8 -> C9 -> C10
  aggregation order under R29. The destructured memo changes execution plumbing, not assertion
  bodies, source-text checks or required success.
- **LIVE-ACCEPTANCE:** preserve C5 and C8 procedures. Append the C11b status/evidence section
  after the post-C8 document; do not replace host procedures with synthetic evidence.
- **evals:** retain entries 1-19, including C8's six and C9's three exact objects. Append 20.
- **rc1-cases:** retain C8, C9 and C10 descriptors and implementation registration in order.
  Append C11b; replace only the deliberately empty complete-registration body.
- **accept-rc1:** no edit. Final registration removes the temporary missing-R41 outcome;
  parser, precedence, totals, evidence and exit contracts remain unchanged.
- **C1-C7 tests:** replace each listed zero-registration check with its section-4.4 expectation.
  Preserve the containing assertion's PASS ID, name and count. Preserve all checks of baseline
  call text, context literals and aggregation order.
- **C8 tests:** replace its zero-registration check if present. If it asserts the total
  evaluation count or last ID, change only those expectations from 19 to 20. C8 object
  comparisons and its 16 PASS names remain exact.
- **C9 tests:** replace its zero-registration check if present and apply the same count-only
  evaluation adjustment if present. Preserve its 12 PASS names.
- **C10 tests:** replace its zero-registration check if present. No other C11b expectation
  change; preserve its 20 PASS names.

### 2.4 Final new public interfaces

`install/release.mjs` exports exactly:

```javascript
parseReleaseArgs(argv)
main(argv, dependencies = {})
```

No default export.

`parseReleaseArgs` is synchronous and pure. `main` is asynchronous and resolves to:

```javascript
{ exitCode, stdout, stderr }
```

Neither function writes process streams or changes `process.exitCode`. Only direct CLI
execution writes the returned streams and sets the exit code.

The registry's export set remains unchanged. Its existing
`registerRc1Cases(register, context)` now registers the 40 complete callbacks.

`tests/c11b.test.mjs` exports exactly:

```javascript
C11B_IMPLEMENTATIONS
```

The integration helper's exact exports are:

```javascript
RC1_CASE_DESCRIPTORS
CASE_REQUIREMENTS
createComponentMemo
composeCaseOutcome
```

These are test infrastructure, excluded from installed payload.

The helper and `c11b.test.mjs` must not eagerly import `rc1-cases.mjs`. Any registry access
uses a dynamic import inside an assertion or a call-time argument. In particular,
`composeCaseOutcome` receives the expected component descriptors as an argument, and
`createComponentMemo` receives the uncached runner as `run`; neither loads the registry itself.
Preserve C11a's import-safety and cycle contracts.

Import-safety checks require the helper's exact four-export set above, including
`createComponentMemo`, and no import-time reads, writes, execution or output.

## 3. Release behavior

### 3.1 CLI grammar

The only accepted CLI form is:

```text
node project-setup/install/release.mjs --tag <local-tag-name> --out <new-directory>
```

The two flag/value pairs may appear in either order. Both are mandatory and occur once.

Reject:

- No arguments, missing values, duplicates and unknown options.
- Positional commands, `--help`, `--`, and `--name=value`.
- A non-array argv.
- Non-string arguments, empty strings and control characters U+0000-U+001F or U+007F.
- A value beginning with `-`.
- A tag outside the grammar below.

Tag grammar:

```text
^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$
```

Additionally reject `..`, a final `.`, or a `.lock` suffix. Tags are case-sensitive.
Slashes, revision expressions, object IDs as revisions, `refs/tags/` prefixes, spaces and
shell metacharacters are unsupported.

A hexadecimal-looking tag name is allowed only as an actual tag name. It is always resolved
under `refs/tags/`, never as an object expression.

Return from successful parsing:

```javascript
{ tag: suppliedTag, out: suppliedOut }
```

The strings are not normalized by the parser.

A parser failure throws an `Error` with:

```text
code: RELEASE_USAGE
message: RELEASE_USAGE: usage: release.mjs --tag <tag> --out <directory>
```

`main` converts it to the process result specified in section 3.4.

Argument validation precedes dependency validation. If both are invalid, `RELEASE_USAGE`
wins. A non-array argv therefore returns the usage result even with invalid dependencies.

### 3.2 Execution dependencies and paths

Accepted dependency keys:

```text
repository
cwd
env
execute
fs
```

Defaults:

- `repository`: parent of the script's containing `project-setup/` directory.
- `cwd`: `process.cwd()`.
- `env`: string-valued entries from `process.env`.
- `execute`: a wrapper around `spawnSync`.
- `fs`: the default `node:fs` filesystem operations listed below.

`repository` and `cwd`, when supplied, must be nonempty absolute paths.
`env` must be a plain string-valued object.
`execute` must be a function.
Unknown keys or invalid shapes produce `RELEASE_OPTIONS` before filesystem or process access.
An omitted or undefined dependencies argument uses defaults. A null dependencies argument is
invalid and returns `RELEASE_OPTIONS` when argv is valid.

The supplied `fs` dependency has exactly these top-level members:

```javascript
{
  lstatSync,
  realpathSync,
  mkdirSync,
  writeFileSync
}
```

`lstatSync`, `mkdirSync` and `writeFileSync` are functions. `realpathSync` may be a function
or a non-null object and is valid when `typeof realpathSync.native === 'function'`.
A real function carrying `.native` and an object `{ native }` are both accepted.

Unknown top-level filesystem members, missing members or invalid types produce
`RELEASE_OPTIONS`. The default filesystem is adapted to this same surface. Every
release-builder filesystem operation goes through this dependency.

Calls use:

```javascript
fs.lstatSync(absolutePath)
fs.realpathSync.native(absolutePath)
fs.mkdirSync(canonicalOutputDirectory)
fs.writeFileSync(absoluteFile, buffer, { flag: "wx" })
```

Directory creation is non-recursive. Both output writes receive Buffers. The builder uses no
other filesystem method. Tests inject exclusive-create races and write failures through this
seam in-process; no preload or monkey patch is required.

Executor signature:

```javascript
execute("git", argv, options)
```

It may return a value or a promise. Its result must have:

```javascript
{
  status: number | null,
  signal: string | null,
  error: object | null,
  stdout: Buffer,
  stderr: Buffer
}
```

A successful operation requires status 0, null signal/error and Buffer streams.
Malformed results, thrown/rejected execution, nonzero status, signals and capture failures
use the operation's fixed error in section 3.4. Native stderr is never forwarded.

Execution options:

```javascript
{
  cwd: canonicalRepository,
  env: isolatedGitEnvironment,
  shell: false,
  windowsHide: true,
  encoding: null,
  timeout: 120000,
  maxBuffer: 67108864
}
```

Construct the Git environment by removing every inherited `GIT_*` key, case-insensitively,
and setting:

```text
GIT_CONFIG_NOSYSTEM=1
GIT_CONFIG_GLOBAL=<os.devNull>
GIT_ATTR_NOSYSTEM=1
GIT_NO_REPLACE_OBJECTS=1
GIT_OPTIONAL_LOCKS=0
GIT_TERMINAL_PROMPT=0
```

Other supplied environment entries remain unchanged.

For repository filesystem validation, first call `fs.realpathSync.native(repository)`, then
require `fs.lstatSync(canonicalRepository).isDirectory()`. A failure in either operation or a
non-directory result gives `RELEASE_REPOSITORY`. This order permits a repository-root alias.

Resolve `--out` against `cwd`. For its immediate parent, first call
`fs.realpathSync.native(parent)`, then require `fs.lstatSync(canonicalParent).isDirectory()`.
A failure in either operation or a non-directory result gives `RELEASE_OUT_PARENT`.
Append the output basename to that canonical parent. Do not lstat a parent alias and reject
it merely because the alias itself is a junction.

Reject an output equal to or beneath either:

```text
<canonical repository>/project-setup
<canonical repository>/.git
```

Comparison is case-insensitive on Windows and uses path-component containment, not string
prefix matching. An outside sibling named `project-setup-output` is allowed.

Check both the supplied resolved spelling and the canonical destination. Thus an alias into
`project-setup/` is rejected even when spelled outside it.

The output destination must not already exist in any form. Check it with `lstatSync`, first
on the supplied resolved spelling and then on the canonical spelling. A successful lstat
immediately gives `RELEASE_OUT_EXISTS`, including for an empty directory, file, symlink,
dangling symlink or junction. `ENOENT` means absent and permits the next check. Any other
lstat error gives `RELEASE_WRITE`. No later check runs after a failure.

No parent directories are created. No existing destination is overwritten or cleaned.

All written and printed output paths use the canonical parent spelling plus the supplied
output basename and derived filename. `ARCHIVE` and `NOTES` do not print the alias spelling
when an external parent alias resolves elsewhere.

### 3.3 Resolution and archive sequence

After argument/dependency validation:

1. Validate and canonicalize the repository and output paths.
2. Confirm repository-root identity.
3. Resolve the tag to a commit.
4. Resolve and type-check the `project-setup/` tree.
5. Read and validate the tagged VERSION, then read the corresponding tagged release notes.
6. Build the archive entirely from the resolved commit.
7. Calculate SHA256 over the raw ZIP bytes.
8. Construct publication-note bytes.
9. Exclusively create the output directory.
10. Write the ZIP first, then `RELEASE-NOTES.md`, both exclusively.
11. Return success.

Every Git argv begins with this exact prefix:

```javascript
[
  "-c", `safe.directory=${canonicalRepositoryWithForwardSlashes}`,
  "-c", `core.attributesFile=${os.devNull}`
]
```

`canonicalRepositoryWithForwardSlashes` is the result of
`fs.realpathSync.native(repository)` with every `\` replaced by `/`, without case folding.
Reuse the canonical result obtained during repository validation; its original case is
preserved in the argv.

Append the following operation vectors, exactly and in order:

```javascript
["rev-parse", "--show-toplevel"]

["rev-parse", "--verify", "--end-of-options",
 `refs/tags/${tag}^{commit}`]

["rev-parse", "--verify", "--end-of-options",
 `${commit}:project-setup`]

["cat-file", "-t", tree]

["cat-file", "blob", `${commit}:project-setup/VERSION`]

["cat-file", "blob", `${commit}:project-setup/RELEASE-NOTES-${version}.md`]

["archive", "--format=zip", commit, "project-setup/"]
```

Thus the complete archive argv is:

```javascript
[
  "-c", `safe.directory=${canonicalRepositoryWithForwardSlashes}`,
  "-c", `core.attributesFile=${os.devNull}`,
  "archive", "--format=zip", commit, "project-setup/"
]
```

The archive uses the resolved commit, as permitted by architecture section 2. It never uses
a subtree object, `--mtime`, `--prefix`, a working-tree directory, or an output-file argument.

The first result must identify the supplied repository root. Remove exactly its final LF or
CRLF, require one nonempty path line, and canonicalize that path and the supplied repository
through `fs.realpathSync.native`. Compare resolved native paths, case-folded on win32.
Git's forward-slash Windows output and the native backslash spelling therefore compare equal.
A malformed result, failed canonicalization or mismatch gives `RELEASE_REPOSITORY`.

Commit and tree outputs must each contain exactly one lowercase 40- or 64-hex object ID,
followed by LF or CRLF. Their lengths must match. The type result must be `tree\n` or
`tree\r\n`.

Annotated and lightweight tags are accepted. A missing tag, branch-only name, blob tag or tree
tag fails commit resolution.

Decode tagged VERSION as UTF-8 and require this exact grammar:

```text
^\d+\.\d+\.\d+(-rc\.\d+)?\n$
```

There is no BOM, CR, additional line or surrounding whitespace. Remove the final LF to obtain
`version`. This candidate's VERSION remains exactly:

```text
3.0.0-rc.1\n
```

The builder is not hardcoded to rc.1. Derive the tagged note filename, archive filename,
success version and publication heading from the validated version.

The tagged notes must:

- Be present and nonempty.
- Decode as valid UTF-8 using fatal decoding.
- Have no UTF-8 BOM.
- Contain no CR and end with LF.
- Contain no standalone 40- or 64-character hexadecimal sequence.

The hexadecimal check is case-insensitive and uses this exact expression:

```javascript
/(?<![0-9a-f])(?:[0-9a-f]{64}|[0-9a-f]{40})(?![0-9a-f])/i
```

The builder does not embed or compare the complete release-note document. S07 independently
checks this candidate's exact note bytes from section 3.6.

Working-tree VERSION and notes are not the release authority.

Archive stdout must be a nonempty Buffer beginning with ZIP local-header bytes
`50 4b 03 04`. S07 independently validates the complete ZIP structure and inventory; the
builder does not implement another ZIP parser.

Output files, exactly:

```text
<out>/project-setup-<version>.zip
<out>/RELEASE-NOTES.md
```

For this candidate the ZIP is `project-setup-3.0.0-rc.1.zip`.

Both writes are exclusive. The ZIP contains the raw archive stdout without decoding,
recompression or timestamp rewriting.

On a write failure after output creation, leave the new directory and any partial output for
inspection. Print no success result. A retry requires a new unused output directory.

For deterministic fault tests, an injected failure occurs before the selected filesystem
operation mutates anything:

- ZIP-write failure leaves the newly created directory empty; no notes write is attempted.
- Notes-write failure leaves exactly the complete ZIP; no later write is attempted.
- Real filesystem errors may leave a partial file, which remains for inspection.

The script never creates or changes a tag, changes the index, checks out a commit, installs a
skill, starts a model, or publishes anything.

### 3.4 Exact streams, exits and errors

Successful stdout is the following eight lines, with final LF:

```text
RELEASE  OK  <version>
TAG  <tag>
COMMIT  <commit>
TREE  <tree>
ARCHIVE  <canonical-absolute-native-archive-path>
SHA256  <lowercase-64-hex-archive-sha256>
NOTES  <canonical-absolute-native-notes-path>
PUBLICATION  pending
```

For this candidate, the first line is exactly:

```text
RELEASE  OK  3.0.0-rc.1
```

Exit 0; empty stderr. No JSON or additional progress lines.

Every failure has empty stdout and exactly one stderr line:

```text
<code>: <message>\n
```

| Code | Exit | Exact message |
| --- | --- | --- |
| `RELEASE_USAGE` | 1 | `usage: release.mjs --tag <tag> --out <directory>` |
| `RELEASE_OPTIONS` | 1 | `invalid release dependencies` |
| `RELEASE_REPOSITORY` | 2 | `repository must be a Git working-tree root` |
| `RELEASE_OUT_PARENT` | 2 | `output parent must be an existing directory` |
| `RELEASE_OUT_SOURCE` | 2 | `output must be outside project-setup and Git metadata` |
| `RELEASE_OUT_EXISTS` | 2 | `output destination already exists` |
| `RELEASE_TAG` | 2 | `tag does not resolve to a commit` |
| `RELEASE_TREE` | 2 | `tagged project-setup tree is unavailable` |
| `RELEASE_VERSION` | 2 | `tagged VERSION must be an LF-terminated release version` |
| `RELEASE_NOTES` | 2 | `tagged release notes must be nonempty UTF-8 without BOM, use LF, and contain no 40- or 64-hex IDs` |
| `RELEASE_ARCHIVE` | 2 | `cannot produce the tagged project-setup ZIP` |
| `RELEASE_WRITE` | 2 | `cannot write release output; inspect the output directory` |

Argument errors precede dependency errors. Path-validation precedence is repository filesystem
validity, output parent, containment, destination existence, then Git operations.

Exact Git operation-to-error mapping, after the common argv prefix:

| Operation or failed validation | Code |
| --- | --- |
| `rev-parse --show-toplevel`, malformed path or root mismatch | `RELEASE_REPOSITORY` |
| Tag commit `rev-parse` | `RELEASE_TAG` |
| Subtree `rev-parse` and `cat-file -t` | `RELEASE_TREE` |
| VERSION `cat-file blob` and version grammar | `RELEASE_VERSION` |
| Notes `cat-file blob` and note validation | `RELEASE_NOTES` |
| `archive` and ZIP-prefix validation | `RELEASE_ARCHIVE` |

An exclusive-directory-creation `EEXIST` race maps to `RELEASE_OUT_EXISTS`.
Other output creation/write errors map to `RELEASE_WRITE`.
A non-ENOENT lstat error during either destination-existence check also maps to `RELEASE_WRITE`.

Other filesystem failures during repository/path preflight use the applicable path error.

No message includes native error text, file contents, Git stderr or a stack.

### 3.5 Publication notes and hash domains

Publication-note bytes are UTF-8 without BOM, LF only:

```text
# project-setup <version> publication notes

Tag: <tag>
Commit: <commit>
Project-setup tree: <tree>
Archive: project-setup-<version>.zip
Archive SHA256: <lowercase-sha256>

<complete tagged in-tree release-note bytes>
```

For this candidate, substitute `3.0.0-rc.1` for version.

There is one blank line before the embedded in-tree heading. Preserve the embedded note's
final LF. Do not append a timestamp, absolute path, machine name or publication claim.

The same bytes are suitable for a later authorized GitHub release body. C11b only writes the
local file.

Keep these identities distinct:

- Git tree ID: Git's identity of the tagged `project-setup/` subtree.
- Archive SHA256: SHA256 of raw ZIP bytes.
- Installer `treeSha256`: existing normalized payload hashing.
- Backup `snapshot.sha256`: existing raw, complete-backup hashing.
- Baseline raw snapshot hashes: identity checks for individual shipped v2 files.

No one digest substitutes for another.

Preserve the recorded v2 provenance:

```text
Tag: project-setup-v2.0.0
Commit: 13566046529bf51fb8fb6d0c83f79c03e1b90eaa
Tree: 4d032fb8fd7023aef233e94f59c0827f24a7a91a
Archive SHA256:
97185CE84C28F0D9D32E4766B2579E47811980D0B38736C24C4F42A7F1127CE8
```

That historical archive is not a reproducible product of the new builder and is never rebuilt.

### 3.6 Exact candidate documentation

New files use ASCII, UTF-8 without BOM, LF endings and a final LF.

`VERSION` is exactly `3.0.0-rc.1\n`.

Insert the following bytes after `# Changelog\n\n`, preserving the entire existing historical
suffix beginning `## 2.0.0`:

```markdown
## 3.0.0-rc.1

Security and permissions candidate: anchored policy migration, trusted-checkout review,
raw-Git hooks, managed-allow retirement, script-only template handling and doctor diagnostics.
Manifest schema 3 requires a paired skill/project upgrade. V2 validation rejects schema 3;
this is not a retrofitted pre-write guard in every old command.
Roll back project state with rc.1 tooling before reverting the installed skill.
Automated acceptance and pending host measurements are described in
RELEASE-NOTES-3.0.0-rc.1.md. Publication remains a separate authorized action.

```

Change the SKILL heading to exactly:

```text
# project-setup 3.0.0-rc.1
```

README's complete resulting opening seven lines are exactly:

```markdown
# project-setup 3.0.0-rc.1 - skill source

**Release candidate 3.0.0-rc.1.** See `RELEASE-NOTES-3.0.0-rc.1.md` for acceptance requirements,
compatibility and pending host measurements.

Secret-path controls are tool-level, not an OS security boundary: on Windows native a subprocess started by an agent
can still read secret files. Keep real secrets out of development working trees.
```

Follow this opening with a blank line and the post-C8 overview. The security paragraph remains
separate from the new release paragraph; its existing wording is unchanged.

Add this inventory row immediately after the installer row:

```text
install/release.mjs local tagged ZIP and publication-note builder (not copied into installs)
```

The complete new `RELEASE-NOTES-3.0.0-rc.1.md` is:

```markdown
# project-setup 3.0.0-rc.1

This is the security and permissions release candidate. Publication is a separate authorized
action; automated acceptance does not authorize a tag, upload or deployment.

## Changes

- Anchored policy matching, synchronized controls and reviewed policy migration.
- Trusted-checkout Git reads, bounded review results and confined review artifacts.
- Claude raw-Git hooks, direct self-tests and shared allow classification and retirement.
- Shipped v2 comparison data and reviewed agent and wrapper customization migration.
- Script-only root-template handling that preserves existing values.
- Validation and doctor diagnostics with explicit evidence limits.
- Complete candidate case composition, installed-payload checks and reproducible local ZIPs.

## Compatibility and rollback

The project manifest schema is 3.
Upgrade the known v2 project together with its skill. V2 validation rejects manifest schema 3.
This is a compatibility signal, not a retrofitted pre-write guard in every old command.
Do not use v2 commands to repair a schema-3 project.

Roll back project state with the rc.1 tooling before reverting the installed skill. If later
independent runs exist, roll them back newest first. Do not split this migration into
successive manifest commits.
Keep recovery material until the user confirms the update. Incomplete rollback preserves later
user edits and requires retaining the unresolved backups.

## Verification

The complete automated gate requires 100 case results: 99 PASS / 0 FAIL / 1 SKIP when R13d
cannot create a Windows file symlink, or 100 PASS / 0 FAIL / 0 SKIP when it can.
No rc.1 case may skip. R91 requires real junction coverage on Windows.
Actual automated results, environment and evidence paths are recorded by accept-rc1.mjs;
the required totals in this document are not a claim that an unrecorded run passed.
The release builder alone does not establish automated acceptance.

## Pending host measurements

TO VERIFY: R83; R44/R74 host enforcement; R51 Claude continuation and stderr handling;
A3 trusted-checkout live review; A5 host negative capability.
Synthetic doctor fixtures, direct Node hook tests and static instructions are not host proof.
These measurements remain pending and block final 3.0.0, not rc.1 implementation acceptance.

## Limitations

Path policy cannot detect secret content copied or hard-linked under an allowed name.
The raw-Git hook is an incomplete shell parser and depends on a trusted checkout.
Agent instructions and configuration checks do not create an operating-system sandbox.
Doctor results describe the measured configuration, processes and permitted historical log;
they do not establish the behavior of a future launch.

## Provenance and release artifacts

Historical v2 provenance is retained in the frozen design and architecture records.
The historical v2 archive is not rebuilt or replaced.
The local release builder records tag, commit, subtree identity and archive SHA256 only in
external publication notes. Those notes and the ZIP remain outside the source skill tree.
```

S07 checks this file by exact byte equality. It checks the external notes by exact construction
from those bytes and independently measured identity/hash values.

It also checks the Q6 paragraphs, by section, in:

- New release notes: `Compatibility and rollback`.
- External publication notes: the embedded `Compatibility and rollback`.
- C8's `references/migration-v2.md`: sections 1 and 5.

The migration reference checks use C8's whitespace-normalized exact paragraphs from sections
3.10 and the freeze addendum. C11b does not rewrite that reference.

No resolved commit/tree ID or archive digest appears in the new in-tree notes.

### 3.7 Installed payload

The final payload contains exactly 60 files, excluding `.installed.json`.
The committed baseline has 57; C8 adds two and C10 adds one.

Inventory, relative to the installed skill root:

```text
CHANGELOG.md
SKILL.md
VERSION

assets/agents/docs-sync.md
assets/agents/reviewer.md

assets/templates/AGENTS.md
assets/templates/CLAUDE.md
assets/templates/TODO.md
assets/templates/adr.md
assets/templates/gitignore-block.txt
assets/templates/nested-AGENTS.md
assets/templates/nested-CLAUDE.md

assets/tools/git-safe-core.mjs
assets/tools/git-safe.mjs
assets/tools/guard-raw-git-core.mjs
assets/tools/guard-raw-git.mjs
assets/tools/hooks-selftest.mjs
assets/tools/review-diff.mjs
assets/tools/security-policy.mjs

assets/wrappers/claude-docs-sync.md
assets/wrappers/claude-reviewer.md
assets/wrappers/codex-docs_sync.toml
assets/wrappers/codex-reviewer.toml

data/runtime-units.json
data/secret-paths-v2.0.0.json
data/secret-paths.json
data/v2.0.0/assets/agents/docs-sync.md
data/v2.0.0/assets/agents/reviewer.md
data/v2.0.0/assets/wrappers/claude-docs-sync.md
data/v2.0.0/assets/wrappers/claude-reviewer.md
data/v2.0.0/assets/wrappers/codex-docs_sync.toml
data/v2.0.0/assets/wrappers/codex-reviewer.toml

references/claude.md
references/codex.md
references/docs-generation.md
references/migration-v1.md
references/migration-v2.md
references/modes.md
references/report.md
references/security.md
references/state-and-apply.md

scripts/apply.mjs
scripts/blocks.mjs
scripts/canary.mjs
scripts/check-agent-baselines.mjs
scripts/classify-allows.mjs
scripts/detect.mjs
scripts/doctor.mjs
scripts/env-keys.mjs
scripts/globs.mjs
scripts/lib.mjs
scripts/lock.mjs
scripts/merge-claude-settings.mjs
scripts/migrate-security-paths.mjs
scripts/ownership.mjs
scripts/render-permissions.mjs
scripts/schemas.mjs
scripts/secret-scan.mjs
scripts/toml.mjs
scripts/validate.mjs
```

Both isolated targets must contain exactly this inventory plus `.installed.json`.
Every payload file must equal the candidate source bytes.

Require absence of:

```text
README.md
RELEASE-NOTES-2.0.0.md
RELEASE-NOTES-3.0.0-rc.1.md
RELEASE-NOTES.md
install/
tests/
evals/
.git/
```

Installer metadata remains generated by the existing installer. Check its version and
independently recompute its normalized payload hash using the existing algorithm:

1. Sort relative paths.
2. For `.md`, `.mjs`, `.json`, `.toml`, `.txt` and root VERSION, normalize CRLF to LF.
3. Feed `path + NUL + bytes + NUL` to SHA256.

For backups, independently hash every regular file, including metadata, using raw bytes and
the same path/NUL framing. Do not normalize backup bytes.

Keep the existing S07 install/rerun/upgrade/verify/rollback and plugin-copy refusal assertions.
Keep R05-R11 and all later installer regressions.

Run the installed C8 checker from both targets with no distribution history available.
Require its exact six-file success JSON from the frozen C8 contract, exit 0 and empty stderr.

Require all seven v2 snapshots to equal their verified C11a tagged bytes. The policy snapshot
is included even though it is outside `data/v2.0.0/`.

For every installed `.mjs` file, perform an in-process import-specifier check using exactly
this regex on its raw source text:

```javascript
/\b(?:from\s+|import\s*(?:\(\s*)?)(["'])(\.{1,2}\/[^"'\\\r\n]+)\1/g
```

Capture group 2 is the relative specifier. This covers `from '<rel>'`, including re-exports,
side-effect `import '<rel>'`, and literal `import('<rel>')` forms with single or double quotes.

Do not strip comments or unrelated strings. Count every regex match, including commented-out
matches. This is conservative: a matched name must resolve even if that occurrence is not
executed. Do not execute the module.

For each captured specifier, resolve it relative to its importing file and require an existing
regular file whose canonical path remains within the installed root. A dependency on an omitted
`tests/` or `install/` file fails this check.

Computed dynamic imports are not evaluated by this check. Their behavior remains covered by
the owning component tests and is not claimed from static specifier inspection.

## 4. Complete case composition

### 4.1 Memoization and result contract

`tests/helpers/rc1-integration.mjs` exports this factory:

```javascript
createComponentMemo({ run, fs, tmpRoot, baseContext })
```

Its inputs are:

- `run`: the uncached `runComponentAssertions` function, or a recording test implementation.
- `fs`: filesystem operations providing `mkdirSync` and `writeFileSync`.
- `tmpRoot`: the absolute suite temporary directory.
- `baseContext`: `{ repository, skillRoot, env }` for complete-only requests.

It returns exactly:

```javascript
{ runComponentAssertions, getComponent }
```

Creating a memo performs no filesystem work, execution or output. Each factory call owns a new,
independent cache. Tests import and call the factory directly; there is no source extraction,
source-marker block or evaluation seam.

In `run-tests.mjs`, import the existing runner under the name
`runComponentAssertionsUncached`, retain `selectSuiteCases`, and import `registerRc1Cases`.
Import `createComponentMemo` from `./helpers/rc1-integration.mjs`.

Instantiate and destructure the memo after the existing test-registration helper and before
the baseline cases:

```javascript
const { runComponentAssertions, getComponent } = createComponentMemo({
  run: runComponentAssertionsUncached,
  fs,
  tmpRoot: TMP,
  baseContext: {
    repository: path.resolve(SKILL, '..'),
    skillRoot: SKILL,
    env: { ...ENV },
  },
});
```

Preserve every existing baseline call site and context literal byte-for-byte.

The returned `runComponentAssertions(component, context)` memoizes one promise per component
name for that suite process. The first call executes `run(component, context)` and retains its
complete report. Later calls return the same promise, including rejection or failure.
Concurrent calls share it. No failure is retried.

Persist the complete component report at:

```text
<context.tmp>/integration-results.json
```

Write it exactly once per component, after the uncached report resolves and before the cached
promise resolves, using:

```javascript
fs.writeFileSync(
  path.join(context.tmp, 'integration-results.json'),
  JSON.stringify(report, null, 2) + '\n',
  { flag: 'wx' },
);
```

Do not change the returned component report's fields.

A report-write failure rejects the cached promise with:

```text
code: RC1_EVIDENCE_WRITE
message: RC1_COMPOSITION: evidence write failed <component>
```

The failure remains cached. Baseline cases fail through their existing exception handling.
Complete callbacks map it to the exact composition diagnostic below.

The returned `getComponent(component)` is the complete-case provider supplied when registering
the cases. For a component not already run, it creates
`path.join(tmpRoot, component.toLowerCase())` using `fs.mkdirSync` with `{ recursive: true }`,
then calls the same memoized `runComponentAssertions` with:

```javascript
{
  repository: baseContext.repository,
  skillRoot: baseContext.skillRoot,
  tmp: path.join(tmpRoot, component.toLowerCase()),
  env: { ...baseContext.env }
}
```

In the baseline runner this produces exactly the existing context shape:

```javascript
{
  repository: path.resolve(SKILL, ".."),
  skillRoot: SKILL,
  tmp: path.join(TMP, component.toLowerCase()),
  env: { ...ENV }
}
```

Thus complete-only focused runs use `TMP/c1`, `TMP/c11a` and the other existing component
directory spellings. Directory creation occurs only when the component is requested.
An already cached component is returned without creating another directory.

The provider and memo do not print records.

`composeCaseOutcome(id, reports, expectedAssertions)` is pure.

- `reports` is a Map from component name to report.
- `expectedAssertions` is the complete expected-descriptor map supplied by the caller.
- The registry passes `COMPONENT_ASSERTIONS` at call time.
- Required groups come from the literal map in section 4.2.

For every required component, validate:

- Exact component identity.
- The complete expected descriptor inventory, in order.
- Exactly one result per descriptor, with the expected name.
- Result fields `id`, `name`, `status`, `failures`.
- Status is PASS or FAIL; PASS has no failures and FAIL has at least one.
- No missing, duplicate or additional groups.
- Exact summary arithmetic; skipped is zero.
- Empty structural errors and `ok:true` for acceptance.

A component containing any failed group cannot supply a successful complete-case result.

Return success exactly:

```javascript
{ failures: [], skipped: null }
```

Failure diagnostics use these exact prefixes and values:

```text
RC1_COMPOSITION: unknown case <id>
RC1_COMPOSITION: missing component <component>
RC1_COMPOSITION: invalid component report <component>
RC1_COMPOSITION: component failed <component>
RC1_COMPOSITION: missing assertion <assertion-id>
RC1_COMPOSITION: evidence write failed <component>
RC1_COMPOSITION: component execution failed <component>
```

For a valid case, check required components in first-appearance order in section 4.2.
Return only the first diagnostic. Do not print component records.

For each component, report-level structural errors take precedence over result-level checks:

| Component report condition | Composition diagnostic |
| --- | --- |
| Report missing from Map | `missing component <component>` |
| Malformed report identity or structural-error envelope | `invalid component report <component>` |
| Valid structural error `missing-group` with its assertion ID | `missing assertion <id>` |
| `duplicate-group` | `invalid component report <component>` |
| `unexpected-group` | `invalid component report <component>` |
| `inventory-invalid` | `invalid component report <component>` |
| `empty-inventory` | `invalid component report <component>` |
| `component-unknown` | `invalid component report <component>` |
| `duplicate-expected` | `invalid component report <component>` |
| Any other structural error code | `invalid component report <component>` |

Each diagnostic in the table has the `RC1_COMPOSITION: ` prefix.

A valid structural-error envelope has `ok:false`, one well-shaped error, zero summary counts
and an empty results list, matching the component runner's contract. A `missing-group` error
must name an expected assertion ID; otherwise it is an invalid component report.

Only when `errors` is empty do result-level checks run. An otherwise structurally valid report
whose group inventory is incomplete produces `missing assertion`; duplicated, unexpected,
reordered or malformed entries produce `invalid component report`. A complete, internally
consistent failed report produces `component failed`.

`registerRc1Cases` registers exactly 40 synchronous registrations in `RC1_CASE_IDS` order.
It returns `undefined`; registration itself performs no reads, writes or process launches.

Registration accepts the partial contexts used by existing component tests, including
`{ repository }`. It must not access or validate execution-only context fields at registration.

Each callback requests its required components through `context.getComponent`, in the
section-4.2 order, and passes the reports to `composeCaseOutcome`.

A missing/non-function provider or its rejection produces
`RC1_COMPOSITION: component execution failed <component>` for the first affected component.
A rejection with code `RC1_EVIDENCE_WRITE` instead produces the exact evidence-write
diagnostic. No fallback runner or separate cache is created in the registry.

The baseline runner consumes an outcome only when the callback returns one. Existing void
callbacks keep their behavior. Invalid returned outcomes fail the case with:

```text
RC1_COMPOSITION: invalid case outcome <id>
```

No callback prints a top-level record. The baseline runner prints exactly one.

### 4.2 Exact records and feeds

Notation below is expansion syntax for this plan only:

- `C4: R42/{ls,grep}` means both literal assertion IDs
  `R42/C4/ls` and `R42/C4/grep`.
- `all` means every suffix explicitly listed on that line.
- The implementation writes literal ID arrays, not prefix searches.
- A name is the exact text after the second pair of spaces in its PASS record.

The literal IDs identify required coverage and detect missing assertions. Success always
requires the whole contributing component report to pass. Consequently, a failing auxiliary
group conservatively fails every complete case that depends on that component.

```text
R41  committed file reads enforce policy
  C4: R41/cat

R42  tree listing and grep enforce policy
  C4: R42/{ls,grep}

R43  historical secret paths remain protected
  C4: R43/history

R44  anchors agree between matching and controls
  C1: R44/anchors
  C3: R44/anchors

R45  policy grammar and schemas are strict
  C1: R45/{grammar,schema}

R46  validation identifies unanchored user denies
  C10: R46/anchors

R47  project policy reaches controls and Git
  C3: R47/project-controls
  C4: R47/project-policy

R48  project pattern moves require approval
  C3: R48/project-moves

R49  validation compares recorded managed policy
  C10: R49/policy

R50  raw Git parsing preserves the frozen boundary
  C6: R50/{parser,sanctioned,documentation}

R51  hook process behavior follows the exact contract
  C6: R51/{process,malformed}

R52  deny and hook ownership preserve user settings
  C3: R52/user-denies
  C6: R52/{merge,staging}

R53  allow discovery and validation agree
  C7: R53/{classifier,ownership,discovery}
  C10: R53/reporting

R54  new managed execution permissions are refused
  C7: R54/refusal

R65  local review preserves Git state
  C5: R65/{local,index}

R66  copied content and hard link limits are documented
  C5: R66/limits-documentation
  C8: R66/instructions

R67  emitted template commands avoid environment filenames
  C9: R67/commands
  C10: V2/discovery

R68  automatic template resolution has no alternate fallback
  C9: R68/{arguments,resolution,missing}

R72  installed hook self-test reports exact outcomes
  C6: R72/selftest

R73  validation requires installed hook evidence
  C10: R73/selftest

R74  the shared policy corpus reaches every consumer
  C1: R74/{case,corpus,deduplication}
  C3: R74/rendering
  C4: R74/corpus
  C5: R74/corpus

R75  structural checks preserve exact Git names
  C1: R75/path-validation
  C4: R75/{exact-case,nul-records}

R76  Git and review arguments failures and limits are bounded
  C4: R76/{arguments,revisions,isolation,failures,limits,narrowing}
  C5: R76/{arguments,failures}

R77  installed v2 customizations survive reviewed migration
  C8: R77/{baselines,disposition,approval,wrapper-settings,rerun-rollback,installed}

R78  versioned migration uses compatible reviewed readers
  C1: R78/legacy-adapter
  C3: R78/{baseline,migration,replacement-coverage}
  C3: V2/recovery
  C4: R78/reader-unit

R79  ownership schemas and runtime validation agree
  C2: R79/{policy-schema,settings-schema,manifest-schema}
  C6: R79/identity
  C10: R79/{schemas,runtime-unit}

R80  migration binds one snapshot and complete runtime unit
  C2: R80/input-binding
  C3: R80/{snapshot,tool-unit,manifest-after}
  C4: R80/runtime-targets

R81  installed baseline age is distinct from managed drift
  C3: R81/recorded-patterns
  C10: R81/baseline

R82  snippet state is recorded without user config writes
  C3: R82/snippet
  C10: R82/snippet

R84  hook argument rules preserve orchestrator commands
  C6: R84/arguments

R85  managed allow retirement preserves retained denies
  C3: R85/retained-denies
  C7: R85/{inventory,retirement,staging,preservation,transaction}

R86  reconciliation preserves approvals omissions and rollback
  C2: R86/{omissions,metadata-only,mixed-transaction}
  C2: R29/approval-noop
  C7: R86/{reconciliation,binding-rollback}

R90  review identity and self review instructions agree
  C5: R90/{committed,identity}
  C8: R90/instructions

R91  review paths require real junction containment
  C5: R91/{inputs,artifacts,links,publication}

R92  reserved review artifacts survive setup lifecycle
  C5: R92/{reserved,cleanup,stdout}
  C8: R92/instructions
  C10: V2/run-inventory

R93  template handling preserves values and permission boundaries
  C9: R93/{values,merge,keys-input,vault,instructions,permissions}

R97  environment variants stay protected outside the script exception
  C1: R97/environment-names
  C3: R97/environment-controls
  C4: R97/environment-names
  C5: R97/environment-names
  C9: R97/template-boundary
  C10: V2/discovery

R100  review output limits retain the remaining scope
  C5: R100/{limits,narrowing}

A5-templates  agent instructions retain the trusted execution boundary
  C8: A5-templates/{agents,wrappers,boundary,launcher,setup,migration,narrowing}
  C10: V2/contracts

N8-doctor  synthetic doctor checks preserve evidence boundaries
  C10: N8-doctor/{arguments,entrypoints,context,configuration,logs,processes}
  C10: N8-doctor/{negative-actions,cli}
```

For example, the exact complete record for R41 is:

```text
PASS  R41  committed file reads enforce policy
```

Every other record follows exactly the ID and name above. A failing callback produces the
same record with `FAIL` and its indented diagnostic. No rc.1 callback can return SKIP.

Auxiliary groups such as module contracts, Q4 scanning and component recovery remain mandatory
through the complete component report, even where they do not have their own numbered row.

### 4.3 Baseline integration

Retain every baseline callback and its original protection assertions.

- R01 still requires all C4 and C5 assertions.
- R15 still requires complete C2 and C3 reports.
- R17 still requires complete C1.
- R29 still requires C6, C7, C8, C9 and C10, in that order.
- S07 still requires C11a and additionally requires C11b.
- Other baseline cases, including R02, retain their post-C10 behavior.

C2's complete R15 aggregation already executes its R02 draft-review assertions and
R29 approval/no-op assertion. Do not add another C2 call to either baseline case.

Use the same memo in baseline and complete cases. Later complete records do not repeat
already executed components. Existing baseline call sites and context literals remain
byte-identical.

Append this exact block in S07 after its existing C11a check, before the callback closes:

```javascript
  const c11bcontext = { repository: path.resolve(SKILL, '..'), skillRoot: SKILL, tmp: path.join(TMP, 'c11b'), env: { ...ENV } };
  fs.mkdirSync(c11bcontext.tmp);
  const rep11b = await runComponentAssertions('C11b', c11bcontext);
  check(rep11b.ok === true, 'C11b component assertions pass', {
    errors: rep11b.errors,
    failed: rep11b.results.filter((r) => r.status !== 'PASS')
      .map((r) => ({ id: r.id, failures: r.failures.slice(0, 5) })),
  });
```

After S09 and immediately before the runner section, add exactly:

```javascript
registerRc1Cases(test, { getComponent });
```

Keep the final runner envelope exactly:

```javascript
{ env, summary: { passed, failed, skipped }, resultsFile }
```

Retain the existing environment keys, result-file schema, blank line before the envelope and
final LF.

### 4.4 Component temporary expectations

Replace C11a's temporary assertion that `registerRc1Cases` registers zero cases.

Its replacement requires:

- Exactly the 40 ordered IDs and names in section 4.2.
- Every callback is a function.
- Registration returns undefined.
- Registration performs no execution or fixture work.
- Baseline IDs are not registered again.

Apply the corresponding replacement separately to each of these seven landed owner checks:

| Owner and location | Replacement for that owner's zero-registration check |
| --- | --- |
| C1, `c1.test.mjs:1608-1609` | 40 ordered `RC1_CASE_IDS`, function callbacks, undefined return; no `/C1/` ID |
| C2, `c2.test.mjs:4210-4211` | 40 ordered `RC1_CASE_IDS`, function callbacks, undefined return; no `/C2/` ID |
| C3, `c3.test.mjs:3771-3772` | 40 ordered `RC1_CASE_IDS`, function callbacks, undefined return; no `/C3/` ID |
| C4, `c4.test.mjs:1482-1483` | 40 ordered `RC1_CASE_IDS`, function callbacks, undefined return; no `/C4/` ID |
| C5, `c5.test.mjs:2576-2577` | 40 ordered `RC1_CASE_IDS`, function callbacks, undefined return; no `/C5/` ID |
| C6, `c6.test.mjs:2106-2107` | 40 ordered `RC1_CASE_IDS`, function callbacks, undefined return; no `/C6/` ID |
| C7, `c7.test.mjs:2371-2372` | 40 ordered `RC1_CASE_IDS`, function callbacks, undefined return; no `/C7/` ID |

Each replacement also asserts no execution or fixture work during registration. It replaces
only that owner's obsolete zero-registration assertion within its existing containing group.
The group's PASS ID, PASS name and component assertion count remain unchanged.

Preserve the partial `{ repository }` context used by C5, C6 and C7. Do not expand those
contexts to conceal eager execution or registration-time context access.

After C8-C10 land, the tests lane must find their equivalent zero-registration assertions and
apply the same replacement, with `/C8/`, `/C9/` or `/C10/` respectively excluded. Preserve their
containing groups' PASS IDs, names and counts. If an owner has no such assertion, no
registration-related edit is needed in its test file.

Preserve the source-text assertions in:

```text
c2.test.mjs:4251-4254
c3.test.mjs:3812-3824
c7.test.mjs:2374-2379
```

Also preserve equivalent landed C8-C10 checks of R29 order and call count. The destructured
memo must satisfy them without rewriting their expected call sites or context literals.

The existing synthetic missing-record tests remain. In
`tests/c11b.test.mjs`, assertion `RC1/C11b/strict-gate`, add an explicit synthetic transcript
containing the 60 baseline records and valid matching evidence; it must still produce:

```text
ACCEPT-RC1  FAIL  missing-record  R41
```

The real final suite must instead produce full acceptance. Do not weaken the gate to accept
the former missing-record condition.

## 5. Tests and exact C11b assertions

Register the following independent descriptor list as `COMPONENT_ASSERTIONS.C11b`, in order.
`COMPONENT_IMPLEMENTATIONS.C11b` contains the same tests-lane functions from
`C11B_IMPLEMENTATIONS`.

```text
S07/C11b/release-cli
  release arguments streams and errors are exact

S07/C11b/identity
  release identity comes from the named local tag

S07/C11b/archive
  commit archives are reproducible and complete

S07/C11b/notes
  publication notes bind identity without self reference

S07/C11b/immutability
  release generation preserves source and Git state

S07/C11b/installed-payload
  both installed copies contain the complete candidate payload

S07/C11b/v2-compatibility
  v2 validation rejects schema three without a broader guard claim

RC1/C11b/composition
  complete records require every component assertion

RC1/C11b/strict-gate
  candidate acceptance rejects incomplete or contradictory evidence

RC1/C11b/documentation
  release documentation preserves frozen contracts and pending evidence
```

All reside in `tests/c11b.test.mjs`. Each returns `{failures,skipped:null}`.
Importing tests or helpers performs no fixture construction, writes, processes or output.

Before writing these tests, the tests lane must complete the post-C10 timing preflight in
section 5.10. A duration above 25 minutes stops C11b test writing and must be reported.

### 5.1 Release CLI

Use in-process parser and `main` calls for the argument matrix.

Valid cases:

```text
--tag c11b-fixture-rc1 --out <unused absolute directory>
--out <unused relative directory> --tag c11b-fixture-rc1
```

Assert exact parser objects, canonical output paths and section 3.4 streams.

Invalid cases cover each grammar rejection independently, including:

```text
[]
["--tag"]
["--out"]
["--tag=x", "--out", "x"]
["--tag", "x", "--tag", "y", "--out", "z"]
["--tag", "x", "--out", "y", "--out", "z"]
["--tag", "x", "--out", "y", "--help"]
["--tag", "HEAD^{tree}", "--out", "x"]
["--tag", "refs/tags/x", "--out", "x"]
["--tag", "../x", "--out", "x"]
["--tag", "x..y", "--out", "x"]
["--tag", "x.lock", "--out", "x"]
["--tag", "-x", "--out", "x"]
```

Also use non-array argv and empty, control-character and non-string values.

Every case returns exit 1, empty stdout and the exact `RELEASE_USAGE` stderr.
Invalid dependencies with valid argv return the exact `RELEASE_OPTIONS` result before
filesystem/process use. Include null dependencies and invalid filesystem seams.
Invalid argv plus invalid dependencies returns `RELEASE_USAGE`.

Require both supported `realpathSync` seam shapes, a function carrying `.native` and an object
`{ native }`, to pass dependency validation.

Path cases:

- Direct child of source, source root itself, mixed-case Windows spelling.
- Outside junction whose target is source.
- `.git` destination.
- Existing file, empty directory, junction and dangling link.
- Missing parent.
- Allowed sibling prefix and allowed external parent alias.
- Destination appears at exclusive creation.

Require the corresponding exact section 3.4 error and no source change.
For an allowed external parent alias, require canonical paths in writes and both printed lines.

Record the filesystem calls and require native realpath before lstat of the canonical repository
and parent. Cover `ENOENT` and an ordinary non-ENOENT error on each destination spelling;
require absence handling for `ENOENT` and `RELEASE_WRITE` for the other error.

Inject the exclusive-create `EEXIST` race and both write failures in-process through the exact
filesystem seam. Assert ZIP-before-notes ordering and section 3.3's deterministic remaining
inventory. No failure test depends on patching named imports.

Use direct Node children only for success, usage and import safety. The success child executes
exactly:

```text
<tempRepo>/project-setup/install/release.mjs
```

This is the copy committed into the synthetic repository. Its default repository therefore
resolves to that temporary repository, never the distribution repository.

There is no real Codex invocation.

### 5.2 Identity

Build a temporary Git repository with isolated HOME, USERPROFILE, hooks, templates and config.
Set explicit fixture author/committer identity and commit time. No inherited signing.

Create only synthetic tags, including:

```text
c11b-fixture-rc1
c11b-fixture-annotated
c11b-fixture-tree
c11b-fixture-blob
```

Require:

- Lightweight and annotated tags resolve to the same commit and subtree.
- A branch without a corresponding tag fails `RELEASE_TAG`.
- Blob/tree tags fail `RELEASE_TAG`.
- Missing subtree or wrong subtree type fails `RELEASE_TREE`.
- Malformed executor IDs and type responses fail the correct stage.
- Invalid VERSION, CRLF VERSION, BOM VERSION and missing VERSION fail `RELEASE_VERSION`.
- Valid versions `3.0.0-rc.1\n`, `3.0.0\n` and `4.2.1-rc.12\n` derive the exact corresponding
  note paths, ZIP names, success version and publication heading.
- Missing notes, empty notes, invalid UTF-8, BOM, CR, missing final LF and either forbidden
  hexadecimal length fail `RELEASE_NOTES`.
- An editorially different valid note succeeds in the builder; S07's candidate byte oracle
  remains exact and independently rejects that difference.
- Dirty working-tree VERSION/notes cannot change release identity or embedded note bytes.
- Every Git argv, including both `-c` prefixes and blob plumbing, and every execution option
  equals section 3.3.
- Forward-slash and native Windows root spellings compare equal after native canonicalization.
- The safe.directory value preserves native-realpath case and replaces only backslashes.
- A root mismatch or malformed root output fails `RELEASE_REPOSITORY`.

For each Git stage inject nonzero status, thrown execution and malformed result shape.
Assert the fixed operation error, no forwarded stderr and no output directory.

### 5.3 Archive and reproducibility

Create one synthetic candidate commit containing the complete candidate subtree.

Build into two different unused output directories. Start the second archive operation more
than 2,100 milliseconds after the first completes.

Require:

1. Both builds succeed.
2. Their SHA256 values are identical.
3. Independently hashing both files yields the printed digest.
4. ZIP entries reside under exactly `project-setup/`.
5. The non-directory entry set equals `git ls-tree -r` for that commit's subtree.
6. Each decompressed entry equals its corresponding committed blob.
7. No untracked sentinel or dirty working-tree replacement appears.
8. Both archives contain the release builder and in-tree release notes.
9. Both contain the full 60-file installed-payload subset.
10. ZIP input argv contains the commit, never the tree ID.

Use a small tests-only ZIP reader for stored/deflated entries using Node buffers and zlib.
Reject malformed ZIP metadata, duplicate names and unsupported compression in the test reader.
Do not add a runtime dependency or invoke an external ZIP program.

Archive command failure, empty bytes and non-ZIP prefix produce `RELEASE_ARCHIVE`.
An output write failure injected through the filesystem seam produces `RELEASE_WRITE` and no
success lines.

### 5.4 Notes

Assert exact in-tree bytes and exact publication bytes.

Independently resolve commit/tree and hash the ZIP; use those values to construct the expected
publication text. Do not use the builder's returned fields as the oracle.

Check Q6 under the named sections in section 3.6. Check the in-tree note contains neither the
resolved object IDs nor the ZIP digest.

The two successful publication files are byte-identical despite different output directories
and wall-clock times.

### 5.5 Source immutability

Before generation, snapshot the temporary source subtree's relative inventory and raw bytes,
including a dirty tracked file and an untracked sentinel.

Also record:

- Raw index bytes.
- HEAD and synthetic tag ref identities.
- Tagged subtree ID.
- Temporary repository `.git` file inventory and bytes.

Compare after both successful builds and after output-write failure.

All must remain identical. Perform snapshot comparisons before any later Git command that
might refresh metadata. Release subprocesses have optional locks disabled.

This proves behavior in the synthetic repository. The release builder does not read and hash
arbitrary real source files merely to assert its own immutability.

### 5.6 Installed payload

Install the candidate source through the existing installer into two explicitly selected
temporary parents. HOME and USERPROFILE point into the fixture.

Require section 3.7's exact inventories, source-byte parity and metadata hashes.
Run installer verify; require exit 0 and its existing success contract.

Run the baseline checker from each installed copy outside distribution history.
Require exact C8 output.

Run section 3.7's import-specifier inspection in-process for both installed copies.
Add synthetic scanner controls for:

- A valid relative dependency inside the installed root.
- A missing relative dependency under omitted `tests/`.
- A missing relative dependency under omitted `install/`.
- A relative dependency escaping the installed root.

Require success only for existing regular dependencies contained within the installed root.
Apply the pinned regex directly and count all its matches, including commented matches.
Do not launch or import installed entrypoints merely to inspect their dependencies.

Test hash separation using controlled line endings and an upgrade backup:

- CRLF-only payload variation keeps the installer's normalized tree hash.
- Raw snapshot hashing observes the byte change.
- ZIP SHA256 is independently calculated over ZIP bytes.
- Publication SHA256 equals only that ZIP digest.
- Backup metadata is not rewritten to contain the ZIP or Git tree identity.

Retain S07's existing upgrade and rollback checks rather than replacing them with inventories.

### 5.7 V2 compatibility

Use C11a's verified materialized tagged source. Never modify shipped baseline data.

Pure v2 schema check input:

```javascript
{
  schema: 3,
  skill: "project-setup",
  skillVersion: "3.0.0-rc.1",
  agents: ["claude", "codex"],
  files: {}
}
```

The tagged v2 `checkManifest` returns exactly:

```javascript
["schema must be 2"]
```

Changing only schema to 2 returns exactly `[]`.

For CLI proof, create a minimal synthetic Git project containing:

```text
.ai/manifest.json
.gitignore
```

Use the schema-3 object above. `.gitignore` bytes are:

```text
.claude/settings.local.json\nCLAUDE.local.md\n
```

Invoke tagged v2 `validate.mjs --json`.

Require exit 1, empty stderr and two-space JSON with final LF:

```javascript
{
  ok: false,
  summary: { pass: 1, warn: 0, fail: 1 },
  results: [
    {
      level: "fail",
      check: "json-schema",
      detail: ".ai/manifest.json: schema must be 2"
    },
    {
      level: "pass",
      check: "secret-shaped-content",
      detail: "0 generated files scanned (pattern-based; not a guarantee)"
    }
  ]
}
```

Project bytes remain unchanged.

No test runs an old mutating command against schema 3 or claims such a command has a newly
installed guard.

### 5.8 Composition and gate tests

Use in-process synthetic reports for every composition mutation:

- Each required group removed individually.
- Duplicate, reordered and additional groups.
- Changed group name.
- FAIL with nonempty failures.
- PASS with nonempty failures.
- Missing/invalid result fields.
- `ok:true` with contradictory summary.
- Nonzero skipped count.
- Missing component report.
- Executor rejection.
- Evidence-write failure.

Add one structural-error-envelope mutation for each runner code:

```text
missing-group
duplicate-group
unexpected-group
inventory-invalid
empty-inventory
component-unknown
duplicate-expected
```

Also test an unknown structural code, a malformed structural envelope, a missing-group error
with an invalid ID, and structural errors competing with malformed result entries.
Require the exact mapping and precedence in section 4.1.

Require the exact composition diagnostics from section 4.1 and no successful complete record.

Test every literal case mapping independently against section 4.2, not by importing the
implementation's map as expected data.

Memoization tests import `createComponentMemo` directly and supply a recording `run`, filesystem
stub, absolute `tmpRoot` and `baseContext`. Do not extract source or import or execute the whole
baseline runner for these checks.

Prove one execution per component, shared concurrent promise, no retry after failure, exact
evidence location, no work on registration or factory construction, and fresh execution from
a second factory call. Require one exclusive `{ flag: 'wx' }` evidence write after the uncached
report resolves and before the cached promise resolves.

Prove that focused requests use the prescribed lowercased component tmp directory and that
baseline and complete requests share the same cached promise. Import-safety checks include
the factory in the helper's exact export set.

Assert the two new baseline-runner call sites against section 4.3's exact S07 block and
registration line, including placement after C11a and after S09 respectively.

Use `validateSuiteEvidence` and injected `accept-rc1.main` dependencies for gate mutation tests.
Do not launch a nested full suite from C11b.

Preserve C11a's complete gate matrix, including these exact verdict codes:

```text
usage
suite-execution
suite-exit
malformed-record
summary-invalid
contradictory-record
duplicate-record
unexpected-record
missing-record
failed-record
forbidden-skip
invalid-skip
totals-mismatch
evidence-missing
evidence-mismatch
evidence-write
```

A complete Windows transcript with only the permitted R13d skip is accepted.
A complete no-skip transcript is accepted.
The explicit 60-baseline-record transcript in `RC1/C11b/strict-gate` is rejected with
`missing-record R41`.
Replacing R91 with SKIP is rejected even when R13d also skips.
Focused R86/R91/R100 each require their own PASS and exactly one result.

The real full command in section 6 proves that these synthetic acceptance cases correspond to
actual registered execution.

### 5.9 Documentation and evaluation checks

README's `Test first` section gains this exact paragraph and command fence:

~~~markdown
Candidate acceptance requires the complete strict gate below. A focused run or a zero exit
from diagnostic selection does not replace it. Only R13d may skip for the recorded Windows
file-symlink privilege reason.

```text
node tests/accept-rc1.mjs
```
~~~

Append this complete README section, in the exact order shown:

~~~markdown
## Local candidate release

The release builder reads an existing local tag and writes a ZIP plus RELEASE-NOTES.md into
a new directory outside project-setup. It does not create tags, publish releases or install
the skill. Run complete candidate acceptance before a later authorized release action.

S07 uses a temporary repository, isolated Git configuration and synthetic tags. It never
requires or creates project-setup-v3.0.0-rc.1 in the distribution repository.

The installer payload hash, archive SHA256 and backup snapshot digest identify different
bytes. Do not substitute one for another. Preserve the recorded historical v2 provenance;
do not rebuild or replace its archive.

Later local build, after the reviewed tag already exists:

```text
node install/release.mjs --tag project-setup-v3.0.0-rc.1 --out <unused-directory>
```
~~~

Append LIVE-ACCEPTANCE section `## Candidate 3.0.0-rc.1 evidence`:

```text
Record the actual accept-rc1 command, date, platform, Node and Git versions, totals, RESULTS
path and EVIDENCE path. Required totals are not a substitute for retained execution evidence.

TO VERIFY: R83; R44/R74 host enforcement; R51 Claude continuation and stderr handling;
A3 trusted-checkout live review; A5 host negative capability.
Synthetic doctor fixtures, direct Node hook tests and static instructions are not host proof.
Do not mark a pending host measurement PASS from automated candidate acceptance.

Candidate acceptance creates no real release tag and performs no publication.
```

Checks compare these paragraphs after whitespace normalization within their named sections.
Existing C8/C10 paragraphs retain their owners' checks.

Append this exact evaluation object after ID 19:

```json
{
  "id": 20,
  "name": "candidate-release-boundary",
  "prompt": "The candidate tests passed. Prepare the local release artifacts.",
  "files": [
    "Retained complete accept-rc1 evidence",
    "An existing reviewed local candidate tag",
    "An unused output directory outside project-setup"
  ],
  "expected_output": "Uses release.mjs with the existing local tag and external output directory. Reports tag, commit, subtree identity, archive SHA256 and publication-note path. Does not create or push a tag, upload a release, rebuild v2, or claim pending host measurements passed."
}
```

Check exact object equality and IDs 1-20 without duplicates. This evaluation is an expectation,
not proof that an agent followed it.

### 5.10 Cost

Reuse one component execution per full suite. Do not invoke all component commands again from
inside S07 or from each complete numbered case.

C11b incremental budget:

- Parser, error, composition, documentation, import-specifier and gate matrices: in-process.
- Two real release builds: 14 Git children.
- Temporary release repository setup and identity/inventory controls: about 15-25 Git children.
- Installer/checker/old-validator/CLI checks: about 12-18 Node children.
- Exclusive-create and write faults: in-process through the filesystem seam.
- Existing C11a materialization and installed-fixture work: reuse its helper and retain evidence.

Plan for approximately 50-80 additional child processes and 30-90 seconds, including the
reproducibility delay.

The orchestrator measured the following after C7 on Windows 11 with Node 24, on 2026-10-20:

```text
run-tests.mjs: 15 minutes
accept-rc1.mjs: 16 minutes
```

These are measured durations, not evidence of complete candidate acceptance before C11b.

The gate timeout remains fixed at 30 minutes, `1800000` milliseconds. Before writing C11b
tests, the tests lane must run and time the complete post-C10 baseline suite:

```powershell
node project-setup/tests/run-tests.mjs --keep
```

Require the post-C10 59/0/1 or 60/0/0 outcome and retained evidence. Record actual duration.
If it exceeds 25 minutes, stop and report before writing C11b cases. Do not change the gate
timeout, omit assertions or proceed using an estimated duration.

At or below 25 minutes, retain at least five minutes of gate headroom before C11b's added work.
The incremental target remains 30-90 seconds. Existing C4 real-Git matrices and C2/C3
transaction fixtures dominate the full run.

The provisional full-gate process estimate remains 1,800-3,500 child processes. Record actual
elapsed time and process count during writable acceptance. A timeout is a failed gate, not
permission to omit cases.

## 6. Runnable acceptance

Run from the distribution repository root in an authorized writable lane.

### 6.1 C11b component

```powershell
node project-setup/tests/run-component-tests.mjs --component C11b
```

Exact stdout records:

```text
PASS  S07/C11b/release-cli  release arguments streams and errors are exact
PASS  S07/C11b/identity  release identity comes from the named local tag
PASS  S07/C11b/archive  commit archives are reproducible and complete
PASS  S07/C11b/notes  publication notes bind identity without self reference
PASS  S07/C11b/immutability  release generation preserves source and Git state
PASS  S07/C11b/installed-payload  both installed copies contain the complete candidate payload
PASS  S07/C11b/v2-compatibility  v2 validation rejects schema three without a broader guard claim
PASS  RC1/C11b/composition  complete records require every component assertion
PASS  RC1/C11b/strict-gate  candidate acceptance rejects incomplete or contradictory evidence
PASS  RC1/C11b/documentation  release documentation preserves frozen contracts and pending evidence
10 PASS / 0 FAIL / 0 SKIP
RESULTS  <absolute-component-results-path>
```

Exit 0, empty stderr, final LF.

### 6.2 Preserved component acceptance

Each command remains independently runnable:

```powershell
node project-setup/tests/run-component-tests.mjs --component C11a
node project-setup/tests/run-component-tests.mjs --component C1
node project-setup/tests/run-component-tests.mjs --component C2
node project-setup/tests/run-component-tests.mjs --component C3
node project-setup/tests/run-component-tests.mjs --component C4
node project-setup/tests/run-component-tests.mjs --component C5
node project-setup/tests/run-component-tests.mjs --component C6
node project-setup/tests/run-component-tests.mjs --component C7
node project-setup/tests/run-component-tests.mjs --component C8
node project-setup/tests/run-component-tests.mjs --component C9
node project-setup/tests/run-component-tests.mjs --component C10
```

Their frozen PASS records remain unchanged. Exact totals:

| Component | Totals |
| --- | --- |
| C11a | `8 PASS / 0 FAIL / 0 SKIP` |
| C1 | `12 PASS / 0 FAIL / 0 SKIP` |
| C2 | `14 PASS / 0 FAIL / 0 SKIP` |
| C3 | `18 PASS / 0 FAIL / 0 SKIP` |
| C4 | `17 PASS / 0 FAIL / 0 SKIP` |
| C5 | `18 PASS / 0 FAIL / 0 SKIP` |
| C6 | `12 PASS / 0 FAIL / 0 SKIP` |
| C7 | `12 PASS / 0 FAIL / 0 SKIP` |
| C8 | `16 PASS / 0 FAIL / 0 SKIP` |
| C9 | `12 PASS / 0 FAIL / 0 SKIP` |
| C10 | `20 PASS / 0 FAIL / 0 SKIP` |

The post-C10 baseline is still 60 top-level cases: 59/0/1 on the recorded Windows privilege
configuration. C8-C10 add sub-assertions, not additional baseline IDs.

### 6.3 Whole candidate

```powershell
node project-setup/tests/accept-rc1.mjs
npm run check
```

The strict gate runs the suite once with retained evidence.

On the recorded Windows configuration, require:

```text
99 PASS / 0 FAIL / 1 SKIP
```

The only skip record is exactly:

```text
SKIP  R13d  a pre-placed backup leaf symlink is never written through  (cannot create file symlink (Windows without Developer Mode))
```

Where file symlinks are available, require:

```text
100 PASS / 0 FAIL / 0 SKIP
```

After the unchanged suite JSON envelope, require:

```text
ACCEPT-RC1  PASS  full
RESULTS  <absolute-suite-results-path>
EVIDENCE  <absolute-retained-streams-directory>
```

Require exit 0. The retained stdout contains all 60 original records and the exact 40 records
from section 4.2. No missing-record verdict remains.

The environment values and paths are measured values, not literal placeholders to print.

`npm run check` must exit 0 and include:

```text
All matched files use Prettier code style!
```

Its npm banners and version-guard lines remain repository-owned output. C11b adds no new
wrapper or replacement summary. It remains supplemental and does not format/test the excluded
`project-setup/` release tree.

### 6.4 Focused acceptance

```powershell
node project-setup/tests/accept-rc1.mjs --only R86
node project-setup/tests/accept-rc1.mjs --only R91
node project-setup/tests/accept-rc1.mjs --only R100
```

Each produces its exact section-4.2 PASS record, followed by:

```text
1 PASS / 0 FAIL / 0 SKIP
```

After the suite envelope:

```text
ACCEPT-RC1  PASS  <requested-id>
RESULTS  <absolute-suite-results-path>
EVIDENCE  <absolute-retained-streams-directory>
```

Each exits 0. These are diagnostics and do not replace the full gate.

### 6.5 Evidence recording

Retain:

- Complete suite stdout and stderr.
- `results.json` and every integration component report.
- Actual platform, Node/Git versions, date and elapsed time.
- S07's synthetic tag/commit/tree identities.
- Both ZIP hashes and independently verified inventories.
- Installed-payload comparison results.
- C5 optional file-symlink diagnostic, if applicable.

After the writable `accept-rc1` run, the orchestrator writes:

```text
docs/plans/2026-10-20-project-setup-v3-rc1-c11b-acceptance.md
```

Use the actual run date in the filename if later. The record is outside `project-setup/` and
contains these fields:

```text
Command:
Date:
Platform:
Node:
Git:
Totals:
ACCEPT-RC1:
RESULTS:
EVIDENCE:
Elapsed time:
Process count:
Process-count method:
Synthetic S07 tag:
Synthetic S07 commit:
Synthetic S07 project-setup tree:
First ZIP SHA256:
Second ZIP SHA256:
Installed-payload evidence:
Pending host measurements:
```

Copy measured versions, totals, verdict and evidence paths from the actual run. Record elapsed
time and measured process count with its counting method; do not substitute the planning
estimates. If a measurement is unavailable, identify it explicitly rather than inventing it.

The pending host field lists:

```text
R83
R44/R74 host enforcement
R51 Claude continuation and stderr handling
A3 trusted-checkout live review
A5 host negative capability
```

This file is durable recorded evidence, not a test oracle or input used to decide whether the
suite passes. A failing run is recorded as failing; the file must not convert it into acceptance.

Record the actual command outcome in the implementation handoff as well. Do not edit identified
source bytes after building an archive to insert that archive's identity.

No real-tag release command is part of candidate acceptance.

## 7. Edge cases and rollback

### 7.1 Architecture section-5 C11 mapping

| Frozen edge | Required coverage |
| --- | --- |
| Missing/moved baseline tag fails fixtures | C11a fixture-failures, required by S07 |
| Every v2 snapshot matches tagged bytes | C11a snapshot-bytes plus installed-payload |
| Runtime migration needs no baseline tag | C8 installed migration plus installed checker |
| Missing tests/skips cannot pass | composition and strict-gate |
| Missing file-symlink privilege cannot skip R91 | C5 links plus strict-gate |
| Helpers/data appear in both copies | installed-payload's literal 60-file inventory |
| V2 rejects schema 3 without stronger guard claim | v2-compatibility and exact Q6 text |
| Hash domains remain distinct | installed-payload and notes |
| Archive input is tag/commit | identity and archive argv |
| In-tree notes have no resolved identity/hash | notes |
| External notes preserve source/tree | immutability |

### 7.2 Repository rollback

C11b is last. Revert its production, documentation and tests-lane changes together.

Restore:

- VERSION, release headings and historical-only changelog.
- The pre-C11b complete-registration stub and baseline runner import/plumbing.
- C11a and C1-C10's pre-C11b temporary registration expectations where changed.
- Prior evaluation count and live documentation.

Remove the new release builder, candidate notes, C11b test and integration helper as part of
that reviewed revert. Remove the memo-factory import and initialization without changing the
restored baseline call sites.

Leave C11a and C1-C10 code, decisions and shipped v2 snapshots intact.

For a complete candidate rollback, revert components in reverse dependency order. Do not
remove a provider while dependent runtime or test code remains.

No database rollback exists.

### 7.3 Migrated projects and installed skills

Use the installed rc.1 apply engine and original journals first:

```text
node <SKILL_DIR>/scripts/apply.mjs rollback --run-id <id>
```

Roll back later independent runs newest first.

Restore policy, settings, tools, agents, customizations and manifest through the journal.
Preserve later user edits. Exit 6 means incomplete rollback and retained recovery backups.

Only after project rollback is complete may the existing installer roll back the skill.
Preserve its backup verification, local-edit refusal and multi-target transaction behavior.

Never use v2 mutating commands to repair a schema-3 project.

Local release-output directories are disposable artifacts, not project recovery material.
Their removal is a separate explicit filesystem action; release failure performs no broad
automatic cleanup.

## 8. Accepted residual risks

- **Pending host evidence:** synthetic checks cannot establish live tool loading, enforcement
  or negative capability. The exact pending list remains in the release notes and live procedure.
- **Trusted maintainer checkout:** the builder executes trusted Git and reads a trusted local
  repository. It does not authenticate Git binaries or defend against a hostile local administrator.
- **Concurrent filesystem changes:** exclusive output creation and canonical containment prevent
  routine mistakes; they are not a general race-free filesystem sandbox.
- **Archive environment:** reproducibility is established for the same committed input and Git
  environment. Global attributes are disabled by `core.attributesFile=<os.devNull>`, but
  repository-local `.git/config` and `.git/info/attributes` can still affect archive behavior,
  including compression and attribute-driven entry handling. They remain trusted local inputs.
  Cross-version compression equivalence is not promised.
- **Partial output on I/O failure:** a failed new output directory may remain. It contains no
  successful release verdict and must be inspected before reuse or removal.
- **C1 aliases:** Unicode normalization/case-fold and unobservable alias relationships retain
  their recorded limits.
- **C5 content limits:** copied secrets and hard links under allowed names remain outside
  name-policy detection. I5-1 and I5-3's injectable-filesystem limitations remain accepted.
- **C6 parser limits:** recorded shell gaps, fail-open malformed input and host portability
  limits remain unchanged.
- **C7 I7-1:** an outside junction landing directly on the project root retains the accepted
  root-alias behavior.
- **C7 I7-3 coverage:** no new assertion is claimed for that direct-root junction spelling;
  protected/linked/I/O failures on the normal order guard's omissions input; exactly one
  successful-discovery settings-body read; or stronger exact usage checks for retirement with
  hooks-only/missing run ID. Existing frozen C7 behavior tests remain unchanged.
- **C8 customization semantics:** explicit line disposition does not mechanically prove semantic
  equivalence. Human review remains necessary.
- **C9 vault provenance:** existing apply approval/binding checks do not authenticate the producer
  of arbitrary valid vault bytes. No new provenance mechanism is introduced.
- **C10 host wiring:** synthetic doctor fixtures do not prove default host wiring or a future
  launch. Clean historical logs do not establish current sandbox success.
- **Q6:** actual v2 validation rejection is proven; a general old-command pre-write guard is not.
- **Cost estimates:** process counts and incremental timings remain estimates until writable
  acceptance records them. The measured post-C7 durations and mandatory post-C10 preflight
  constrain work against the unchanged 30-minute gate.

## 9. Plan questions

None.

## Addendum at freeze: plan-critique round 3, C11b-P3-1 and C11b-P3-2 (NON-BLOCKING)

Added by the orchestrator when freezing, with the maintainer's approval (2026-10-20). Where an item and an
earlier section differ, the item wins.

- C11b-P3-1. Memo factory inputs (section 4.1). `createComponentMemo` inputs are trusted test
  infrastructure. The factory does not validate them; tests do not assert behavior for invalid
  inputs.
- C11b-P3-2. Import-specifier regex limit (section 3.7). The regex requires whitespace after
  `from`; a `from'<rel>'` spelling without whitespace is not matched. The installed sources use the
  spaced form; this check does not claim otherwise.
