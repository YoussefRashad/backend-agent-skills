<!--
FROZEN 2026-10-19 on branch feat/project-setup-v3-rc1. Never edit this file; changes go through the
maintainer. Component plan C5 (lands sixth, after C11a, C1, C2, C3 and C4) under the frozen
architecture plan docs/plans/2026-10-15-project-setup-v3-rc1.md, which takes precedence, and on the
frozen C4 contract docs/plans/2026-10-18-project-setup-v3-rc1-c4.md. Drafted by the plan lane
(Codex, 1 revision, applying maintainer decision C5-PQ1 option B and the round-1 dispositions);
plan-critique (Claude) round 2 found no BLOCKING gap. The addendum at the end records round 2's
items and the maintainer's choice on C5-P2-9.
-->

# C5. Review-diff and artifact lifecycle

Date: 2026-10-19  
Status: revision 2, for freeze  
Base: `feat/project-setup-v3-rc1`, commit `f4b4385`  
Target: `docs/plans/2026-10-19-project-setup-v3-rc1-c5.md`

## 1. Scope and authority

C5 implements the frozen architecture plan's section 2, "C5. Review-diff and artifact
lifecycle", its section-5 review-artifact edge cases, and the applicable section-6 migration
and rollback requirements.

Its section-4 ownership is:

```text
R65/R66; R90-R92; R100; review-diff portions of R74/R76/R97
```

The ownership notes additionally require Windows junction coverage and reserved-name alias
tests. C5 assertions do not establish complete numbered-case coverage.

Authority, in order:

1. `docs/plans/2026-10-15-project-setup-v3-rc1.md`, including its freeze addendum.
2. `docs/design/project-setup-v3.md`: frozen A3, N5, R2-3, Q1-Q6, PQ1 and PQ2.
3. The frozen C4 component plan, including C4-P3-1 through C4-P3-7.
4. Landed C11a, C1, C2 and C3 contracts and their decision records.
5. The maintainer's C5-PQ1 decision and the accepted revision dispositions recorded here.

C5 lands sixth:

```text
C11a -> C1 -> C2 -> C3 -> C4 -> C5
```

C4 was not implemented at the inspected commit. Its frozen contract, rather than the v2
reader or the concurrent working-tree implementation, is C5's prerequisite.

C5 MUST provide:

- One public CLI through `git-safe.mjs`.
- Committed-head and local-worktree review modes.
- Resolved comparison IDs and review mode in the result.
- Literal selectors, protected-selector refusal and protected-descendant exclusion.
- Whole-result limits without partial successful output.
- Stdout-only operation by default.
- Confined, exclusive artifact creation for explicit `--out`.
- Reservation of `review` and canonical aliases across setup lifecycle operations.
- Safe establishment of the run directory's self-ignore file.
- Protection against setup cleanup reaching review artifacts.

Out of scope:

| Work | Owner |
| --- | --- |
| Shell parsing and raw-Git hook allowance/enforcement | C6 |
| Allow-rule classification and retirement | C7 |
| Reviewer/orchestrator instructions and canonical agent text | C8 |
| README trusted-checkout and copied-content warnings | C8 |
| Setup instructions staging all four runtime members | C8 |
| Environment-template operations | C9 |
| Catalog-aware validation, doctor and host-control evidence | C10 |
| Excluding the reserved review directory from setup-run reporting | C10 |
| Complete numbered-case composition and release acceptance | C11b |
| Release stamps, archives, publication and installed release verification | C11b |

C5 does not change C4-PQ1's six-command grammar or C4-PQ2's uncounted log inventory.
It does not add a separate executable interface for `review-diff.mjs`.

Q1 remains binding: `apply.mjs diff` invokes no Git.

This lane changed no files and ran no tests or fixture scripts. It used no network, MCP,
connector or app. HEAD remains `f4b4385`. The repository's `.ai/security-paths.json`,
`AGENTS.md` and `.ai/agents/` are absent.

A revision-lane source-excerpt command failed because PowerShell constrained language blocked
its `Math` calls. It was not retried through another route. Earlier source reads, the frozen
plans and the critique's verified caller findings supply the relevant evidence.

## 2. Files touched and interfaces

### 2.1 Existing production files

Ranges refer to `f4b4385`. For the new C4 core, the frozen C4 plan supplies the boundary because
the file does not exist at that commit.

Paths are relative to `project-setup/`.

| File | Existing lines or frozen boundary | C5 change |
| --- | --- | --- |
| `assets/tools/git-safe-core.mjs` | C4 sections 2.5 and 3.9 | Dispatch review-diff; extend unknown-command diagnostic |
| `data/runtime-units.json` | 1-17; replaced by C4 section 2.3 | Add review helper |
| `scripts/lib.mjs` | 261-269 | Reserve aliases in `validateRunId` |
| `scripts/lock.mjs` | 18-42, 44-104 | Early ID guard and reserved-owner recovery |
| `scripts/apply.mjs` | 95-128 | Early ID guard; preserve reserved errors through diff parsing |
| `references/security.md` | 17-32; C4 section 3.9 replacement | Add review interface and artifact contract |

C4 replaces `assets/tools/git-safe.mjs:1-68`. C5 retains its unconditional thin CLI unchanged.

C5 does not change C4's runtime enforcement logic in `apply.mjs`. Extending the catalog makes
the existing complete-unit rule apply to the fourth member.

C5 does not change `apply.mjs:1499-1516`, the cleanup implementation. Its existing startup path
checks and recovery-state checks remain. Reserved-ID refusal occurs before reaching them.

`apply.mjs:226-229`, the other-run lifecycle enumeration, also needs no implementation edit.
Its existing `validateRunId` call will exclude reserved aliases before reading their journals.

The following callers change behavior through `validateRunId`, without source edits:

```text
scripts/blocks.mjs:170
scripts/env-keys.mjs:32
scripts/merge-claude-settings.mjs:103
scripts/secret-scan.mjs:57
scripts/canary.mjs:20
scripts/migrate-security-paths.mjs:327
```

Their envelopes are pinned in section 3.12.

### 2.2 New production file

```text
assets/tools/review-diff.mjs
```

It is import-safe and full-owned. Importing it MUST NOT read files, execute processes, write
streams, modify the environment or dispatch a CLI.

It exports exactly:

```text
REVIEW_FORM
parseReviewArgs
defaultReviewArtifactPath
reviewMain
```

No additional production helper file is planned.

### 2.3 Existing tests and live documentation

The tests lane owns all test edits, including earlier-component expectation updates.

| File | Lines at `f4b4385` | Change |
| --- | --- | --- |
| `tests/rc1-cases.mjs` | 8-13, 34-139 | Import and register C5 |
| `tests/run-tests.mjs` | 99-122 | Aggregate C5 inside R01 |
| `tests/run-tests.mjs` | 1146-1172 | Stage fourth runtime member in `freshSetup` |
| `tests/c4.test.mjs` | 232-245 | Update unknown-command message only |
| `tests/c4.test.mjs` | 2367-2382 | Extend production unit constants/catalog |
| `tests/c4.test.mjs` | 2598-3046 | Extend production staging, ordering and recovery expectations |
| `tests/live/LIVE-ACCEPTANCE.md` | 62-65, 67-74, 99-103 | Add C5 procedure |

The C4 integration region contains hard-coded catalog indexes. Use target lookup where adding
a helper would otherwise change the meaning of an index.

Do not change `tests/c4.test.mjs:1195-1210`. Its installed reader fixture runs only the original
six commands and does not need the lazily imported review helper.

C1 and C2 require no expectation changes. `lib.mjs` gains no export.

C3's synthetic two-member catalogs and readers remain unchanged. C4 already separated its
production-catalog expectations. No further C3 test edit is planned.

New test files:

```text
tests/c5.test.mjs
tests/fixtures/review-diff-cases.json
```

No fixture-generation script is added. Test setup stays under `context.tmp`.

The target plan file is the orchestrator's later documentation write.

### 2.4 Runtime catalog

Retain schema 1. The complete ordered catalog becomes:

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
      "source": "assets/tools/review-diff.mjs",
      "target": ".ai/tools/review-diff.mjs",
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

C4 section 3.10 applies unchanged at prepare, unprepared diff, prepared diff and commit.

When any catalog target is created or modified:

- Every member must have the current reviewed bytes.
- An unchanged installed member needs a declared, bound transaction-input role.
- A missing member, arbitrary draft or missing role cannot be authorized by a claimed hash.
- Protected targets are refused before reading.
- Ordinary unrelated plans do not force an upgrade.
- Existing capability, projection, binding and approval precedence remains unchanged.

Write order:

```text
security-policy
git-safe-core
review-diff
git-safe
remaining non-policy content
dependent policy
manifest
```

The new helper uses existing full-file ownership and explicit approval for edited replacements.
There is no new migration schema or approval mechanism.

### 2.5 C4 and C1 dependencies

C5 directly imports these C4 exports:

```text
MAX_OUTPUT_BYTES
NARROWING_GUIDANCE
parseGitSafeArgs
createGitSession
```

It consumes these session fields and methods:

```text
root
policy
sourceSchema
git(argv, options)
resolveCommit(revision)
listTree(commitId)
```

It depends transitively on C4's:

```text
MAX_GIT_ARG_UNITS
sanitizeGitEnvironment
```

The fixed prefix, executor contract, Git 2.31 gate, root discovery, policy loading, resolution
errors and argument bound remain C4's contracts, including the freeze addendum.

C5 requires no additional C4 export. C4 does not export inventory parsing or filesystem
confinement helpers. C5 owns its private parsers and untracked/artifact filesystem checks.
Installed runtime code MUST NOT import distribution-only `scripts/lib.mjs`.

C1 dependencies are exactly:

```text
validateRepoPath
matchesPolicyPath
```

### 2.6 Export signatures

`REVIEW_FORM` is exactly:

```text
review-diff --base <ref> [--head <ref>] [--out <file>] [-- <paths>...]
```

`parseReviewArgs(argv)` is synchronous. It accepts the complete argument array and returns:

```js
{
  base: string,
  head: string | null,
  out: string | null,
  paths: string[]
}
```

Paths are deduplicated in first-occurrence order. Strings retain their spelling. The function
performs no filesystem or Git operation and does not mutate input.

Invalid containers or non-string/sparse elements throw:

```text
GIT_SAFE_INPUT: invalid Git helper input
```

A valid string array whose first element is absent or is not `review-diff` throws:

```text
GIT_SAFE_COMMAND: supported commands: diff, log, show, cat, ls, grep, review-diff
```

Invalid CLI grammar throws:

```text
GIT_SAFE_ARGUMENT: unsupported arguments; supported: review-diff --base <ref> [--head <ref>] [--out <file>] [-- <paths>...]
```

Invalid `--out` spelling throws `REVIEW_OUT` during parsing, before any Git call.

`defaultReviewArtifactPath(date = new Date())` is synchronous. It accepts a valid `Date` with
UTC year 0 through 9999. Other inputs throw the `GIT_SAFE_INPUT` error above.

Its exact transformation is:

```js
".ai/.run/review/" + date.toISOString().replace(/[-:.]/g, "") + ".diff"
```

For `2026-10-19T12:34:56.789Z`, return:

```text
.ai/.run/review/20261019T123456789Z.diff
```

It does not mutate the Date, create a file or retry collisions.

`reviewMain(argv, dependencies = {})` is asynchronous and returns exactly:

```js
{
  exitCode: number,
  stdout: Buffer,
  stderr: string
}
```

Success is exit 0; handled failure is exit 2. It never writes streams or sets process exit
state.

Allowed dependency keys:

```text
cwd
env
execute
readFile
fs
```

The first four retain C4's definitions. `readFile` is the policy-reader seam, not the untracked
content reader.

`fs`, when supplied, contains exactly these callable synchronous methods:

```text
lstatSync
realpathSync
mkdirSync
openSync
fstatSync
readFileSync
writeSync
fsyncSync
closeSync
unlinkSync
```

Each uses the corresponding Node signature and return contract. The default `realpathSync`
uses `fs.realpathSync.native`.

Tests may supply recording wrappers or synthetic implementations. Unknown dependency keys,
missing methods or invalid dependency types give `GIT_SAFE_INPUT` before dependency calls.
Malformed filesystem return values give `REVIEW_IO`.

No CLI or environment variable exposes these seams.

### 2.7 Core integration and later consumers

C4's `main` delegates lazily to `reviewMain` only for `argv[0] === "review-diff"`, after its
input-container checks. The lazy import avoids an eager cycle with the helper's core imports.

A failed helper import, including a missing installed `review-diff.mjs`, gives
`GIT_SAFE_INTERNAL`, exit 2, empty stdout and the standard diagnostic. The original six
commands do not import the helper and remain unaffected by its absence.

The six-command parser, request shape, exported maps and execution function stay unchanged.
Non-review commands still accept only C4's original dependency keys.

C5 explicitly changes C4's frozen `GIT_SAFE_COMMAND` detail to:

```text
supported commands: diff, log, show, cat, ls, grep, review-diff
```

Later dependencies:

| Component | Required interface or work |
| --- | --- |
| C6 | Public git-safe review-diff invocation; no helper executable |
| C8 | Grammar, header, stdout/artifact distinction and naming |
| C8 | Stage fourth member in SKILL.md Phase 1 and docs-generation |
| C8 | `defaultReviewArtifactPath` if orchestration imports the helper |
| C10 | Validate fourth catalog target |
| C10 | Exclude reserved review directory from setup-run reporting |
| C11b | Four-file inventory and C5 assertion IDs |

Until C8 updates setup instructions, following old staging instructions for a runtime-changing
setup run can fail with `TOOL_UNIT_UNREVIEWED` for the missing fourth member. C5 does not weaken
the unit rule to accommodate stale instructions.

`detect.mjs:134` currently lists the review directory as a run. Correcting that reporting is a
C10 dependency, not a C5 edit.

## 3. Behavior specification

### 3.1 Grammar

Require exactly one detached `--base <ref>`.

`--head <ref>` and `--out <file>` may each occur once. Options may occur in any order before
`--`.

The token following one of these options is its value unless it is absent or exactly `--`.
Either missing-value case gives `GIT_SAFE_ARGUMENT`.

Any other following token is consumed as the value, including a token beginning with `--`.
Then validate that value according to its option:

```text
--out --head      REVIEW_OUT
--base --head     GIT_SAFE_ARGUMENT
--out --          GIT_SAFE_ARGUMENT
```

Reject attached option forms, duplicate options, unknown options and positional tokens before
`--`. Reject an empty path list after `--`.

Refs must satisfy C4's single-revision grammar. Reuse validation through:

```js
parseGitSafeArgs(["ls", revision])
```

Map revision-parser syntax errors to the review supported-form error. Ranges, object forms and
leading-dash refs are not accepted.

After `--`, every token is a literal path, including `--`, `-x`, `a*`, `a?` and `:(glob)a`.
Validate through C1 without trimming, rewriting or case-folding.

Validate `--out`'s lexical grammar inside `parseReviewArgs`. Process tokens left to right;
the first encountered syntax/value failure wins. A missing required base is checked after
token consumption.

### 3.2 Order of operations

1. Parse arguments, including output spelling.
2. Validate dependency shape.
3. Create one C4 Git session.
4. Check explicit selectors against the installed effective policy.
5. Reject explicit artifact-input selectors.
6. Check requested output and self-ignore repository paths against policy.
7. Resolve base, then explicit head or `HEAD`, caching identical spellings.
8. Compute merge-base.
9. Collect mode-specific metadata inventories.
10. Validate and filter names before content operations.
11. Construct the complete result in memory.
12. Check its complete byte length.
13. Return stdout, or establish and write the artifact.
14. Return artifact success only after close succeeds.

A failed stage prevents later operations. Native exception text and Git stderr are never
emitted.

Explicit protected selectors give `GIT_SAFE_SECRET` before resolution. Protected inventory
descendants are omitted before content reads.

### 3.3 Identity and result framing

Let:

```text
B = resolved base commit
H = resolved explicit head, or resolved current HEAD
M = merge-base(B, H)
```

The result starts with:

```text
# review-diff mode=<mode> base=<B> head=<H> merge-base=<M>
```

This line ends with LF, followed by one additional LF.

Mode is exactly:

```text
committed-head
local-worktree
```

No timestamp, caller ref spelling or absolute path appears in the header.

An empty change returns the header and blank line only.

Output order is:

```text
identity header and blank line
tracked patch returned by Git
untracked new-file patches in UTF-8 byte path order
```

Committed mode has no untracked section. Do not insert separators or extra blank lines between
patches.

The header counts toward the 1,048,576-byte result limit. Artifact bytes equal stdout-mode
result bytes.

C8 owns the report and self-review warning. C5 records identity, not a claim that the executing
checkout is trustworthy.

### 3.4 Git notation, inventories and isolation

Every Git operation uses the same C4 session.

`P` is exactly C4 section 3.4's fixed prefix, including its platform-specific null device.
C5 neither adds nor removes prefix settings.

`D` is exactly:

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

Define:

```js
L = request.paths.map((p) => ":(literal)" + p);
```

A name matches selection when:

```js
request.paths.length === 0 ||
request.paths.some((s) => name === s || name.startsWith(s + "/"))
```

Use this predicate for local filtering, including synthetic executor inventories. Do not
interpret caller glob or pathspec magic.

Protected names retain original spelling, are deduplicated, and are sorted by UTF-8 byte
order. Exclusion pathspecs are:

```js
E = excludedNames.map((p) => ":(exclude,literal)" + p);
```

`excludedNames` includes the applicable protected inventory names, artifact-input inventory
names, and these two fixed artifact exclusions:

```text
.ai/.run/review
.ai/.run/.gitignore
```

The fixed review-directory exclusion also excludes descendants. C1-matched alias names from
inventories supply exclusions for aliases on case-sensitive hosts.

Never expand all safe names into positive selectors.

Names-only inventories use C4's strict UTF-8/NUL framing: empty output is valid; nonempty output
ends in NUL; empty records are ignored; names are never trimmed or split on LF.

C4's invocation bound remains:

```js
fullArgv.reduce((sum, arg) => sum + 2 * arg.length + 3, 0) <= 24000
```

`fullArgv` includes P. Exactly 24000 passes; 24001 fails before execution.

C4 removes caller `GIT_INDEX_FILE` and other injected Git variables. C5 does not restore them
or create a replacement index. `GIT_OPTIONAL_LOCKS=0` remains set.

### 3.5 Committed-head mode

After C4's version/root/policy sequence, resolve endpoints using:

```js
["rev-parse", "--verify", "--quiet", "--end-of-options", base + "^{commit}"]
["rev-parse", "--verify", "--quiet", "--end-of-options", head + "^{commit}"]
["merge-base", B, H]
```

Identical endpoint spellings resolve once.

Merge-base success must contain one lowercase 40- or 64-digit hexadecimal ID followed by LF
or CRLF. Malformed success gives `GIT_SAFE_RECORD`; nonzero completion gives `GIT_SAFE_GIT`.

Inventory:

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
  M,
  H,
  "--",
  ...L
]
```

Build E from protected and artifact-input names in that committed changed-path inventory,
plus the fixed artifact exclusions.

If a selected unprotected name remains, content is:

```js
["diff", ...D, "--patch", M, H, "--", ...L, ...E]
```

Content uses `limit: 1048576`; metadata uses `limit: null`.

The trusted checkout's staged additions, modifications, deletions and modes, unstaged changes,
and all untracked files are excluded. Working copies never replace reviewed object content.

The installed trusted policy is authoritative. Policy changes in H do not replace it.

### 3.6 Local-worktree mode

Resolve base and `HEAD`, then merge-base.

Collect these metadata inventories in order:

```js
["ls-tree", "-r", "-z", "--full-tree", M]
["ls-files", "--cached", "--stage", "-z", "--", ...L]
["ls-files", "--others", "--exclude-standard", "-z", "--", ...L]
```

The first call uses `session.listTree(M)`.

Index records have:

```text
<mode> SP <oid> SP <stage> TAB <path> NUL
```

Accept C4's four file modes, lowercase 40/64-digit OIDs, and stages `0`, `1`, `2`, `3`.
Malformed framing, invalid paths, extra fields and duplicate same-path/same-stage records give
`GIT_SAFE_RECORD`.

After selection and policy/artifact filtering, a nonzero index stage gives `REVIEW_UNMERGED`.
A protected unresolved entry is omitted without content access.

Build E from protected names in the selected union of the M tree and index, plus artifact
inputs. Never obtain E through a working-tree diff or a stat-sensitive content inventory.

Tracked content uses exactly:

```js
["diff-index", ...D, "-p", M, "--", ...L, ...E]
```

Use `limit: 1048576`. Metadata calls use `limit: null`.

Do not use porcelain `git diff` for this working-tree comparison. Plumbing `diff-index` avoids
porcelain's automatic index refresh while retaining Git's working-file conversion semantics.

If no selected unprotected M-tree or index entry remains, omit the tracked content call.
Untracked processing still proceeds.

Pinned semantics:

- An index entry absent from M and missing from disk produces no tracked patch.
- A tracked file missing from disk is handled as Git handles that deletion.
- A path removed from the index but still present as non-ignored untracked content produces
  a tracked deletion and a separate in-process new-file patch.
- The two entries for that path remain; do not merge them.
- Staged and unstaged changes are compared through Git's final working-state semantics.
- A stat-dirty file with unchanged converted content produces no tracked hunk.
- Git's autocrlf and attribute normalization apply to tracked files.
- Skip-worktree entries retain Git's semantics; missing sparse files are not synthesized as
  deletions by C5.
- Tracked symlinks and gitlinks use Git's handling, including `--submodule=short`.
- C5 does not apply untracked-file `REVIEW_TYPE` checks to tracked gitlinks or symlinks.

C5 does not invoke `add`, `update-index`, `read-tree`, checkout, `hash-object` or index refresh.
It creates no temporary index or Git object.

Configured clean/process filters may run for selected safe tracked content. They come from
trusted user/system/local configuration under A3. The C4 prefix and `--no-textconv` do not
disable those filters.

Protected tracked names are excluded before `diff-index`. Untracked files are read in-process,
without Git conversion or filters.

A usual local invocation uses nine Git processes: version, root, two resolutions, merge-base,
three inventories and diff-index. Identical endpoint spellings or no eligible tracked entries
reduce that count.

### 3.7 Untracked inventory and disk-read safety

Ordinary untracked records use the names-only rules in section 3.4.

Git may report an embedded untracked repository as `dir/`. Recognize exactly one terminal slash
as that directory marker, validate the preceding path, and apply selection/policy/artifact
filtering to it. A selected unprotected directory marker gives `REVIEW_TYPE`. It is never
opened or recursively read.

Other malformed names give `GIT_SAFE_RECORD`. An unselected or protected embedded repository
does not become review content.

Before opening each selected unprotected untracked file:

1. Check its repository-relative path against policy.
2. Resolve the repository root's native real path.
3. Walk every component below that root using `lstatSync`.
4. Refuse linked components, junctions and non-directory ancestors.
5. Require a regular leaf.
6. Resolve its native real path and verify containment.
7. Check the realpath-relative POSIX name against policy.
8. Open read-only, adding `O_NOFOLLOW` where supported.
9. Require `fstatSync` to identify the same regular file checked before open.
10. Check descriptor size before reading.
11. Read through that descriptor and close it.

Containment rejects a relative result exactly equal to `..`, beginning with `..` plus a native
separator, or absolute. A name such as `..work` remains inside.

On Windows, reject `:` in an untracked candidate component before opening it.

A descriptor size greater than 1,048,576 gives the review `GIT_SAFE_LIMIT` error before any body
read. This applies to text and binary candidates. Exactly 1,048,576 permits reading, but its
rendered result can still exceed the whole-result bound.

Require a nonnegative safe-integer size. Malformed stat results give `REVIEW_IO`.
If the file grows and the returned Buffer exceeds 1,048,576, give `GIT_SAFE_LIMIT`.

A resolved protected path gives `GIT_SAFE_SECRET` before open. Links, escapes and unsafe
ancestors give `REVIEW_PATH`. A nonregular leaf gives `REVIEW_TYPE`.

A listed untracked file disappearing before it can be read gives `REVIEW_IO`. Do not silently
omit it.

Check only selected candidates. An unrelated unselected unsafe path must not block narrowing.

A supported alternate spelling of the checkout root may be canonicalized. Links below the
canonical root are refused.

These checks apply to untracked reads and artifacts. Git performs tracked reads without C5's
realpath checks.

### 3.8 Untracked new-file renderer

Render untracked files in UTF-8-byte path order, after the complete tracked patch.

Render raw Buffer bytes. Do not normalize CRLF, BOMs or encoding. In particular, an untracked
CRLF line retains its CR byte, even when Git normalizes tracked CRLF files.

Filename quoting follows Git with `core.quotePath=true`:

- Leave printable ASCII bytes, including spaces, unquoted when no escaping is required.
- Escape BEL, BS, TAB, LF, VT, FF and CR as `\a`, `\b`, `\t`, `\n`, `\v`, `\f`, `\r`.
- Escape `"` and `\` as `\"` and `\\`.
- Encode other bytes outside `0x20` through `0x7e` using three-digit octal escapes.
- When any escape is required, enclose the complete pathname in double quotes.
- Apply this to the complete `a/<path>` and `b/<path>` strings.
- `/dev/null` remains unquoted.

A file starts with:

```text
diff --git <a-label> <b-label>
new file mode <mode>
```

The mode is `100644` on Windows. Elsewhere, any executable permission bit gives `100755`;
otherwise use `100644`.

Do not emit an `index` line.

A file is binary when a NUL occurs among its first 8000 bytes, or among all bytes when shorter.
A NUL at offset 7999 is binary; a first NUL at offset 8000 is not.

For binary content, emit:

```text
Binary files /dev/null and <b-label> differ
```

Do not emit its body.

For an empty file, emit only the diff and new-file-mode lines.

For nonempty text, emit:

```text
--- /dev/null
+++ <b-label>
<hunk-header>
<added-lines>
```

For an unquoted `+++` label containing an ASCII space, append TAB before LF, matching Git's
filename delimiter. Quoted labels and unquoted labels without spaces receive no TAB.

Split body bytes on LF. A terminal LF does not add an empty line. Let N be the line count.
The hunk header is:

```text
@@ -0,0 +1 @@
```

when N is 1, otherwise:

```text
@@ -0,0 +1,<N> @@
```

Prefix every body line with `+`. Preserve line bytes. After an unterminated final line, append
LF and:

```text
\ No newline at end of file
```

Generated structural lines end with LF.

For `new.txt` containing `new\n`, the exact patch is:

```text
diff --git a/new.txt b/new.txt
new file mode 100644
--- /dev/null
+++ b/new.txt
@@ -0,0 +1 @@
+new
```

The final line ends with LF.

### 3.9 Artifact-input exclusion

Use exactly this private policy object:

```js
{
  schema: 2,
  patterns: [
    { anchor: "root", glob: ".ai/.run/review" },
    { anchor: "root", glob: ".ai/.run/review/**" },
    { anchor: "root", glob: ".ai/.run/.gitignore" }
  ],
  projectPatterns: []
}
```

Classify artifact inputs with `matchesPolicyPath(name, artifactPolicy)`. This includes C1's
case and Windows alias handling.

Both exact directory and descendant entries are needed because terminal `/**` requires a
descendant.

Both modes omit these inputs even if force-tracked or no ignore file exists.
A selected containing directory remains valid; its artifact descendants are omitted.

An explicit selector matching this policy gives `REVIEW_ARTIFACT_INPUT`.

No earlier artifact body may be opened as local review content or included in committed
content output.

### 3.10 Artifact names and confinement

`--out` accepts only:

```text
.ai/.run/review/<stem>.diff
```

The prefix is exact and case-sensitive on every platform. Reject absolute paths, backslashes,
additional subdirectories, traversal components and alternate prefixes.

The complete filename is 6 through 128 ASCII characters. Its stem:

- Starts with an ASCII letter or digit.
- Contains only ASCII letters, digits, `_`, `-` and `.`.
- Contains no `..`.
- Does not end with `.`.
- Has no Windows device name before its first dot, case-insensitively.

Device names:

```text
CON PRN AUX NUL COM1-COM9 LPT1-LPT9
```

Violations give `REVIEW_OUT` in the parser, before session creation.

Resolve the accepted output relative to `session.root`, regardless of invocation cwd.
Successful stdout echoes the accepted root-relative POSIX path, not an absolute or cwd-relative
path.

There is no implicit artifact path and no automatic collision suffix.

Before reading or writing output-control paths, check repository-relative and resolved forms
against the installed policy. Protecting the requested artifact or self-ignore path gives
`GIT_SAFE_SECRET`.

Walk `.ai`, `.run` and `review` one component at a time. Existing components must be real
directories inside the repository. Create missing directories non-recursively; revalidate an
`EEXIST` result.

A linked leaf/ancestor, junction, escape or non-directory ancestor gives `REVIEW_PATH`.

An existing regular artifact gives `REVIEW_EXISTS`. An existing nonregular artifact gives
`REVIEW_PATH`. An exclusive-open `EEXIST` race gives `REVIEW_EXISTS`.

Never replace or follow an existing artifact.

### 3.11 Self-ignore and publication

Required `.ai/.run/.gitignore` bytes are exactly:

```js
Buffer.from("*\n", "utf8")
```

Hexadecimal `2a 0a`; no BOM or CR.

Only after the complete result passes its size check:

1. Establish safe `.ai` and `.ai/.run` directories.
2. Establish the self-ignore file.
3. Establish safe `.ai/.run/review`.
4. Revalidate the artifact chain.
5. Create the artifact with `openSync(path, "wx", 0o600)`.
6. Write the complete Buffer, handling short writes.
7. Sync and close.
8. Return the relative artifact path plus LF.

An existing safe regular self-ignore file is accepted only if its bytes equal `*\n`.
Different bytes give `REVIEW_IGNORE`; do not overwrite them.

Create a missing self-ignore file exclusively, then write, sync and close it before opening
the artifact. If another creator wins, revalidate and compare its bytes.

A zero-byte write result is failure, not a retry loop.

Success with `--out` is:

```js
{
  exitCode: 0,
  stdout: Buffer.from(request.out + "\n"),
  stderr: ""
}
```

On publication failure:

- Emit neither a success path nor a patch.
- Close owned descriptors.
- Remove only a file this invocation exclusively created and failed to complete.
- Revalidate parent confinement and leaf identity before unlinking.
- Never recursively remove an artifact directory.
- Preserve existing ignore files and artifacts.
- Keep successfully established directories and a completed valid self-ignore file.

If safe cleanup cannot remove a newly created incomplete file, return `REVIEW_CLEANUP`.
Never delete a replacement file or traverse a replaced parent.

Oversized results fail before output-directory creation or artifact open. They leave no new
artifact or self-ignore file.

### 3.12 Reserved setup IDs and lifecycle behavior

Extend `validateRunId` before its ordinary syntax check.

Preserve its existing conversion of `undefined`, `null` and `true` to an empty string.
For the resulting string, reservation is:

```js
s.replace(/[. ]+$/g, "").toLowerCase() === "review"
```

Reserved aliases throw an Error with own code `RUN_ID_RESERVED` and exact message:

```text
RUN_ID_RESERVED: run id is reserved for review artifacts
```

Examples:

| Input | Result |
| --- | --- |
| `review` | Reserved |
| `REVIEW` | Reserved |
| `Review` | Reserved |
| `review.` | Reserved |
| `review ` | Reserved |
| `review. .` | Reserved |
| `review...` | Reserved |
| `review-1` | Ordinary valid ID |
| `reviewx` | Ordinary valid ID |
| `review/x` | Existing invalid-ID error |
| `abc` | Existing invalid-ID error |

Canonicalization only compares reservation. It never normalizes an invalid ordinary ID into
acceptance.

For lock and apply, scan raw CLI tokens before root discovery or project filesystem access:

- For every token exactly equal to `--run-id` or `--confirm-run-id`, inspect its next token.
- Inspect it only when present and not beginning with `--`.
- Reject it if its reserved-name comparison matches.
- Inspect every occurrence, including duplicates.
- Otherwise retain the command's existing parsing and validation behavior.

Thus `--run-id --x` has no scanned value. A later reserved duplicate still fails even if
`parseArgs` would otherwise discard it.

This early guard applies to:

```text
lock:  acquire heartbeat status release break
apply: init diff prepare commit status rollback cleanup
```

The reserved-ID failure for lock/apply is:

```text
{
  "ok": false,
  "code": "RUN_ID_RESERVED",
  "error": "run id is reserved for review artifacts"
}
```

Serialize with `JSON.stringify(object, null, 2) + "\n"` to stdout, empty stderr, exit 1.

Apply diff preserves this error rather than converting it to `APPLY_DIFF_USAGE`.
Other invalid diff IDs retain C2's usage behavior.

Lock owner handling:

- `status` without a reserved supplied ID retains its existing reporting, including a readable
  reserved owner.
- Heartbeat/release with a reserved supplied ID fail at the early guard.
- Break with a readable reserved owner and no `--confirm-unknown-owner` gives the reserved-ID
  failure above.
- Break with a readable reserved owner and `--confirm-unknown-owner` may remove only the setup
  lock, subject to existing lock path-safety checks.
- A supplied reserved `--confirm-run-id` still fails early, even with the recovery flag.
- Preserve ordinary-owner matching and unknown-owner behavior.

Successful reserved-owner recovery uses the existing break envelope:

```js
{
  ok: true,
  broken: true,
  previousOwner: owner,
  next: "check every run with apply.mjs status for a partial apply"
}
```

Print pretty JSON plus LF, empty stderr, exit 0. `owner` is the actual parsed owner object.
Do not touch `.ai/.run/review`.

Other `validateRunId` callers preserve their existing error mapping:

| Caller | Reserved-ID output and exit |
| --- | --- |
| blocks | Generic failure below; exit 1 |
| env-keys | Generic failure below; exit 1 |
| merge-claude-settings | Generic failure below; exit 1 |
| secret-scan | Generic failure below; exit 1 |
| canary | Generic failure below; exit 1 |
| migrate-security-paths stage | Migration usage failure below; exit 1 |

Generic failure:

```text
{
  "ok": false,
  "error": "RUN_ID_RESERVED: run id is reserved for review artifacts"
}
```

Migration failure:

```text
{
  "ok": false,
  "code": "MIGRATION_USAGE",
  "error": "usage: migrate-security-paths.mjs report --project <root> OR stage --project <root> --run-id <id>"
}
```

Both are pretty JSON plus LF on stdout, with empty stderr. Do not replace these landed caller
envelopes with lock/apply's new envelope.

`assertWritableLifecycle` continues validating each other-run name before loading its journal.
A reserved directory is skipped. Its journal is not read and cannot block an ordinary prepare,
even if it contains a partial journal.

Ordinary setup cleanup retains its existing path and recovery-state checks. Reserved aliases
must fail before access to or deletion of their run directory, with or without
`--confirm-manual-resolution`.

No artifact cleanup command, age expiry or automatic deletion is added. Ordinary cleanup
preserves sibling review artifacts and `.ai/.run/.gitignore`.

### 3.13 Limits and errors

Every handled review failure returns:

```js
{
  exitCode: 2,
  stdout: Buffer.alloc(0),
  stderr: "git-safe: " + error.message + "\n"
}
```

Every thrown library error has an own string `code` and a message beginning `CODE: `.

C5-specific errors:

| Code | Exact detail after `CODE: ` |
| --- | --- |
| `REVIEW_OUT` | `output must be a Windows-safe .diff file directly under .ai/.run/review/` |
| `REVIEW_PATH` | `unsafe review filesystem path; no result was emitted` |
| `REVIEW_TYPE` | `review input is not a regular file; no result was emitted` |
| `REVIEW_IO` | `review filesystem operation failed; no result was emitted` |
| `REVIEW_UNMERGED` | `selected paths contain unresolved index entries; no result was emitted` |
| `REVIEW_ARTIFACT_INPUT` | `review artifacts cannot be selected as review input` |
| `REVIEW_EXISTS` | `review artifact already exists; choose another output name` |
| `REVIEW_CLEANUP` | `artifact cleanup failed; discard the incomplete artifact` |

The exact ignore error line before the CLI prefix is:

```text
REVIEW_IGNORE: .ai/.run/.gitignore must contain exactly "*\n"; no artifact was written
```

Here `\n` inside the quotes is a literal backslash followed by `n`, not a line break.

Inherited C4 details:

| Code | Exact detail |
| --- | --- |
| `GIT_SAFE_INPUT` | `invalid Git helper input` |
| `GIT_SAFE_VERSION` | `Git 2.31 or later is required` |
| `GIT_SAFE_REPOSITORY` | `not inside a Git repository` |
| `GIT_SAFE_POLICY_IO` | `cannot read .ai/security-paths.json; refusing to run without a valid policy` |
| `GIT_SAFE_SECRET` | `requested path is protected by the security policy` |
| `GIT_SAFE_REVISION` | `revision does not resolve to a commit` |
| `GIT_SAFE_RECORD` | `invalid Git metadata; no result was emitted` |
| `GIT_SAFE_GIT` | `Git operation failed; no result was emitted` |
| `GIT_SAFE_INTERNAL` | `internal failure; no result was emitted` |

`GIT_SAFE_ARGUMENT` and `GIT_SAFE_COMMAND` use section 2.6's exact strings.

Argument-limit message:

```text
GIT_SAFE_ARG_LIMIT: Git arguments exceed the safe invocation bound; narrow with -- <paths> or a smaller commit range. No result was emitted.
```

Review overflow uses C4's `NARROWING_GUIDANCE.show`, exactly
`Narrow with -- <paths>.`:

```text
GIT_SAFE_LIMIT: output exceeds 1048576 bytes. Narrow with -- <paths>. No partial result was emitted; this review is not complete.
```

Use this same limit message for oversized untracked descriptor sizes, oversized returned
untracked Buffers, tracked executor overflow and aggregate result overflow.

Test executor-reported overflow and an oversized Buffer with `overflow: false`.

The bound counts all result bytes, including header, patch headers, filename escapes and
untracked output:

```text
1,048,575 passes
1,048,576 passes
1,048,577 fails
```

Relevant inherited C1 errors retain these exact messages:

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

Locations are `patterns[i]` or `projectPatterns[i]`. C1's validation precedence remains
authoritative. C5 adds no policy fallback.

Expected filesystem failures map to the applicable `REVIEW_*` code. Unexpected implementation
exceptions map to `GIT_SAFE_INTERNAL`.

Never interpolate rejected paths, refs, raw policies, native exceptions or Git stderr.

### 3.14 Required documentation

Update the C4 runtime-unit description in `references/security.md` to name all four files.
Keep its six original forms and add the review form.

Add this text:

```text
The sanctioned review interface is:

node .ai/tools/git-safe.mjs review-diff --base <ref> [--head <ref>] [--out <file>] [-- <paths>...]

With --head, review-diff compares the resolved merge-base to the resolved head commit.
The trusted checkout's staged, unstaged and untracked changes are excluded. Without --head,
it compares the merge-base of base and current HEAD with the local working state, including
staged, unstaged and non-ignored untracked changes.

Tracked local changes use Git's diff-index plumbing, preserving Git's normalization and
skip-worktree behavior without refreshing the index. Configured clean/process filters may
run for selected safe tracked files. Such filters are trusted configuration and may have
their own side effects, including Git LFS object-cache writes.

Untracked files are checked before reading and rendered in-process as new files. Their bytes
are raw: CRLF is preserved, unlike tracked content normalized by Git. An untracked file larger
than 1,048,576 bytes is refused before its body is read. A selected embedded repository is
refused as a nonregular input. A path removed from the index but still present as untracked
content appears twice: a tracked deletion followed by an untracked new-file patch.

The result header records the mode, resolved base, resolved head and merge-base IDs.
Selectors are literal repository-relative paths. A protected selector is refused; protected
descendants of a selected directory are omitted.

Stdout is the default. Reviewers use stdout or an artifact supplied by the orchestrator.
They do not use --out. The orchestrator may create a new artifact directly under
.ai/.run/review/ and pass its path to the reviewer. Output paths are repository-root-relative,
even when invoked from a subdirectory. Artifact creation is exclusive. The default name is
a Windows-safe UTC timestamp, for example 20261019T123456789Z.diff.

The setup run ID review and its case or trailing-dot/space aliases are reserved. Older setup
runs with those names require manual resolution. A reserved setup-lock owner can be removed
with lock.mjs break --confirm-unknown-owner after the existing human recovery decision.
That operation removes the lock, not the review directory.

Review output, including its header, is limited to 1,048,576 bytes. An oversized result is
refused whole. Narrow with -- <paths>, then record both the reviewed subset and the scope
still unreviewed. A narrowed result does not establish that the full change was reviewed.

Path rules cannot detect secret content copied to an unrelated allowed path. They are not
a content scanner and cannot guarantee that a review diff is secret-free.
```

Add a subsection named `C5 review-diff procedure (host evidence pending)` to
`tests/live/LIVE-ACCEPTANCE.md`:

```text
Run the reviewer from a trusted checkout. The maintainer supplies base and head refs.
Do not check out the reviewed branch.

Use git --no-optional-locks status for status observations. Do not use ordinary git status,
which can refresh the index. Record status and stash observations, then capture the raw
index hash and .git file inventory immediately before review. Capture the post-review
index and .git snapshot before any verification status command.

From a separate orchestrator step, run git-safe review-diff with --base, --head and an unused
--out path under .ai/.run/review/. Pass that path to the reviewer. Require the reviewer to
record the mode and resolved IDs from the artifact header. The reviewer makes no artifact
write.

Repeat with stdout-only review-diff. Require identical review bytes and no review-helper
filesystem write. A dirty trusted checkout must not contribute staged, unstaged or untracked
content to the committed-head result.

Separately exercise local-worktree mode on a branch the maintainer authored. Require staged,
unstaged and ordinary non-ignored untracked changes, protected paths absent, and index bytes
unchanged. Use a fixture with no configured content filters for the full .git byte comparison.
Record any configured filter and its side effects separately; filter writes are not evidence
that diff-index refreshed the index.

Record versions, commands, exit codes, artifact hash and observed changes. Fixture preparation
and component tests are preflight, not live host proof. C8 supplies canonical reviewer
instructions and the self-review warning; C10 supplies host-control reporting.
```

Do not mark the procedure passed or register pending live evidence as a skipped C5 assertion.

## 4. Tests

### 4.1 Registration

`tests/c5.test.mjs` exports exactly `C5_IMPLEMENTATIONS`, a frozen descriptor array.

Each descriptor has:

```js
{
  id: string,
  run(context): Promise<{ failures: string[], skipped: null }>
}
```

Imports run no tests or production commands. Import production modules lazily so a missing
implementation produces assertion failures instead of breaking registry import.

Register these exact IDs and names, in order:

| ID | Name |
| --- | --- |
| `R65/C5/local` | `local review includes safe working changes` |
| `R65/C5/index` | `local review leaves the index and Git state unchanged` |
| `R66/C5/limits-documentation` | `copied secret content limitation is documented` |
| `R90/C5/committed` | `committed review excludes trusted checkout changes` |
| `R90/C5/identity` | `review headers record resolved comparison identity` |
| `R91/C5/inputs` | `disk inputs are checked before content reads` |
| `R91/C5/artifacts` | `artifact paths and names are confined` |
| `R91/C5/links` | `links junctions and escapes are refused` |
| `R91/C5/publication` | `exclusive publication preserves existing files` |
| `R92/C5/reserved` | `setup lifecycle rejects reserved review aliases` |
| `R92/C5/cleanup` | `setup cleanup preserves review artifacts` |
| `R92/C5/stdout` | `stdout review creates no artifacts` |
| `R74/C5/corpus` | `shared policy corpus reaches both review modes` |
| `R76/C5/arguments` | `review grammar and Git vectors are pinned` |
| `R76/C5/failures` | `review failures emit no partial content` |
| `R97/C5/environment-names` | `environment name variants stay excluded` |
| `R100/C5/limits` | `complete review results obey the byte limit` |
| `R100/C5/narrowing` | `literal narrowing covers safe review subsets` |

Register `Object.freeze([...C5_IMPLEMENTATIONS])` in `COMPONENT_IMPLEMENTATIONS.C5`.
Write expected descriptors independently in `COMPONENT_ASSERTIONS.C5`.

Never emit complete numbered-case records for these partial assertions.

### 4.2 Fixtures, seams and cost

`review-diff-cases.json` holds declarative grammar, artifact-name, alias and untracked-renderer
cases. Use escaped ASCII JSON for unusual names and bytes.

Reuse C1's shared policy corpus. Do not introduce another policy matcher.

Most tests use:

- C4's execute seam for synthetic Git metadata/content and exact argv assertions.
- C4's policy-reader seam.
- C5's filesystem seam for checks, read/write ordering and failures.
- Synthetic 40- and 64-digit IDs.
- Synthetic inventories for Windows-hostile Git names.

Real Git is required for:

- A shared diverged branch graph and dirty trusted checkout.
- Tracked/local and non-ignored-untracked semantics.
- Autocrlf, stat-dirty content, skip-worktree and removed-index cases.
- Clean-filter sentinel behavior.
- Embedded untracked repository inventory.
- Installed CLI dispatch and missing-helper behavior.
- Real Windows junction containment.
- Representative lifecycle CLI guards and ordinary cleanup.

Use only synthetic canary content.

Keep at most three scratch repositories, including the embedded repository fixture.
Expected C5 cost is approximately 80-120 Git processes and 50-70 Node children, excluding
earlier suites. These estimates are not assertions.

Keep the reserved-alias matrix in-process through `validateRunId`. Exercise one representative
CLI alias per lifecycle command, plus duplicate and recovery cases; do not multiply all aliases
by all child commands.

### 4.3 Concrete cases

Review successes have exit 0 and empty stderr. Failures use section 3.13's exact diagnostic,
exit 2 and empty stdout unless explicitly identified as a setup-script failure.

Compare complete output Buffers and envelopes, not only marker substrings.

#### R65/C5/local

Base M contains ordinary modified/deleted files. Current state includes:

- A staged addition.
- An unstaged modification.
- A tracked deletion.
- A safe untracked text file.
- An ignored file.
- Protected tracked and untracked paths.

Require the header, exact synthetic tracked patch, then byte-sorted untracked patches.
Require protected names in E before diff-index and no protected untracked read.

Cover:

- An index addition absent from M and deleted from disk: no tracked patch.
- Removed-from-index but still non-ignored on disk: deletion plus new-file patch.
- Staged change restored to base content: no tracked hunk.
- Selected unresolved entry: `REVIEW_UNMERGED`.
- Protected unresolved entry: omitted.
- Tracked symlink/gitlink handling delegated to Git.
- A missing skip-worktree entry: no invented deletion.
- Empty, unterminated, CRLF, BOM and binary untracked files.
- Quoted control/non-ASCII names and unquoted names containing spaces.
- One-line and multi-line hunk header counts.
- NUL at offsets 7999 and 8000.

Add a repo-local `core.autocrlf=true` fixture. Its LF committed file with a CRLF working copy
produces no hunk. A real line change produces Git's contextual patch, not full-file CRLF noise.

#### R65/C5/index

With no configured content filters, snapshot raw index bytes and all `.git` file paths/bytes
immediately before review and immediately after it. Both must be identical on success and
injected failure.

Take the post-review snapshot before any verification status command. All status observations
use:

```text
git --no-optional-locks status
```

Include a deliberately stat-dirty but content-identical tracked file. Require header-only
output and unchanged index/`.git` snapshots.

The execution trace contains no mutating Git operation, porcelain worktree diff or supplied
`GIT_INDEX_FILE`.

In a separate fixture, configure a repo-local clean-filter sentinel and:

```text
* filter=sentinel
```

Make selected safe tracked content stat-dirty. The sentinel must demonstrate that tracked
conversion is permitted. It must not run for protected tracked paths or for untracked files.

Put sentinel evidence outside `.git`. Assert the index remains unchanged; do not claim a
general absence of filter-owned filesystem writes.

#### R66/C5/limits-documentation

Assert the exact copied-content limitation and incomplete-review guidance from section 3.14.

A synthetic marker copied to an unrelated allowed filename may appear in output.
Do not assert content scanning or secret-free output.

Also assert the documented configured-filter and raw-untracked-CRLF limitations.

#### R90/C5/committed

Construct a diverged graph with M distinct from B and H.

Dirty the trusted checkout with staged, unstaged and untracked markers. Require only the
M-to-H object patch. Content argv contains resolved M/H, not caller ref strings.

A seam that throws on working-file filesystem calls must not prevent committed stdout review.

#### R90/C5/identity

Use:

```text
B = 1111111111111111111111111111111111111111
H = 2222222222222222222222222222222222222222
M = 3333333333333333333333333333333333333333
```

Assert exact headers and blank lines for both modes.

Cover equal endpoint spellings, different spellings resolving to one ID, 64-digit IDs, moved
refs after resolution, empty results and malformed merge-base output.

#### R91/C5/inputs

Recording seams prove no untracked body read for:

- Protected repository spelling.
- Safe spelling resolving to a protected realpath-relative name.
- Escape.
- Nonregular leaf.
- Linked ancestor or leaf.
- Oversized descriptor.
- Invalid inventory record.

Assert the exact applicable error.

Inject ENOENT after untracked enumeration and EACCES at lstat, realpath, open, fstat and read:
`REVIEW_IO`.

A selected unrelated unsafe file outside the narrowed selection does not block review.

Create a real embedded repository. Assert that its untracked inventory is `dir/\0`, and that
selecting it gives `REVIEW_TYPE`, without recursive reads. Malformed trailing-slash forms
still give `GIT_SAFE_RECORD`.

#### R91/C5/artifacts

Accept:

```text
.ai/.run/review/a.diff
.ai/.run/review/run-7.diff
.ai/.run/review/20261019T123456789Z.diff
```

Reject absolute paths, traversal, backslashes, nested output directories, changed prefix case,
spaces, colon streams, missing extension, excessive length and device names:

```text
CON.diff
aux.extra.diff
COM1.diff
Lpt9.diff
```

Lexical failures give `REVIEW_OUT` with zero Git and filesystem calls.

Assert the exact timestamp transformation and invalid-Date behavior.

Invoke from a repository subdirectory. The artifact must be under `session.root`, and stdout
must echo the same root-relative accepted path.

#### R91/C5/links

Windows directory junction tests are mandatory and cannot skip.

Exercise junctions at `.ai`, `.ai/.run`, `.ai/.run/review`, and an untracked ancestor.
Outside sentinels must remain unchanged.

Also cover artifact leaf links, untracked leaf links, non-directory ancestors, synthetic
realpath escapes, protected realpath aliases and a supported alternate checkout-root spelling.

If file-symlink privilege is absent, record that optional subcase in retained diagnostics.
Mandatory junction and synthetic link coverage still run; no component assertion skips.

#### R91/C5/publication

Assert the exact self-ignore bytes are synced and closed before artifact creation.

Cover:

- Missing directories and ignore file.
- Existing exact ignore bytes.
- Different ignore bytes: `REVIEW_IGNORE`, unchanged.
- Existing regular artifact: `REVIEW_EXISTS`, unchanged.
- Exclusive-create race: `REVIEW_EXISTS`.
- Short writes completing.
- Zero writes and write/sync/close failures.
- Safe cleanup of a newly created incomplete file.
- Changed identity or unlink failure: `REVIEW_CLEANUP`, replacement preserved.

Success artifact bytes equal stdout-mode bytes. Success stdout is only the relative output
path plus LF.

#### R92/C5/reserved

Run every alias and ordinary-ID control from section 3.12 through `validateRunId`.

Exercise all seven apply commands and all five lock commands with one representative reserved
CLI alias each. Add duplicate-value, missing-value and `--confirm-run-id` cases.

Require lock/apply's exact pretty JSON, exit 1 and empty stderr.

For early refusal proof, reuse the R02-style platform-appropriate recording/failing Git shim
first on PATH:

1. Prove a control Git invocation reaches it.
2. Reset its record.
3. Invoke the setup script using absolute Node.
4. Require zero Git invocations.

Use a preload recording filesystem calls only when their paths are under the scratch project
root. Distribution module-loading reads are excluded. Supplied reserved IDs must cause zero
project-root filesystem calls.

Add one representative `merge-claude-settings` invocation with a reserved ID. Require its
generic `{ok:false,error}` envelope, exit 1, empty stderr and no review drafts created.

Plant a readable reserved setup-lock owner:

- Status may report it.
- Break without recovery flag returns the reserved-ID failure.
- Break with `--confirm-unknown-owner` succeeds with the existing break envelope.
- The review directory and its sentinels remain unchanged.
- Adding a reserved `--confirm-run-id` still causes early refusal.

#### R92/C5/cleanup

Create sentinel artifacts and exact self-ignore bytes.

Attempt cleanup with required reserved aliases, with and without
`--confirm-manual-resolution`. Require reservation failure before access to the review
directory and unchanged sentinels.

Clean an eligible ordinary setup run. Require its existing success envelope and preservation
of the review subtree and self-ignore file.

Plant `.ai/.run/review/journal.json` with a partial journal, for example:

```json
{"committed":false,"entries":[{"state":"applied"}]}
```

Prepare a valid unrelated ordinary run. Require success under existing C2/C3 rules, no read of
the planted journal, and no lifecycle refusal caused by it. Record project-root read calls to
prove the journal was skipped before access.

Do not add a late junction-swap cleanup test or new cleanup revalidation behavior.

#### R92/C5/stdout

With `.ai/.run` absent, stdout review performs no mkdir, write-open or unlink.

Pin both ingestion regressions:

1. Local mode: an artifact exists, but `.ai/.run/.gitignore` has been removed, so Git reports
   the artifact as untracked. Omit it without a body read.
2. Committed mode: an artifact is force-tracked in H. Exclude it from content argv and output.

Repeat after normal artifacts exist; their bytes remain unchanged.

Use `--out` only in the orchestrator simulation. The reviewer simulation reads the supplied
artifact and performs no publication.

#### R74/C5/corpus

Run the shared corpus through committed and local modes:

- Managed and project entries.
- Root and any-depth anchors.
- Supported wildcards.
- Mixed case and adopted Windows aliases.
- Rejected policy syntax.

For local tracked paths, require exclusions derived from M/index before diff-index.
For untracked paths, require no protected body read.
For explicit protected selectors, require `GIT_SAFE_SECRET`.
Malformed policies retain C1 errors and prevent resolution/content operations.

#### R76/C5/arguments

Assert:

- Exact exports, import safety and parser return shape.
- Wrong `argv[0]` error.
- Exact option-value token rules and duplicate handling.
- Parse-time output rejection.
- C4 prefix, environment, cwd and limit for every operation.
- All specified Git vectors.
- Original spelling in literal selectors/exclusions.
- No magic expansion.
- UTF-8-sorted exclusions and no positive safe-name expansion.
- Argument bound exactly 24000 versus 24001.
- Seven-command diagnostic.
- Four-member production catalog and installed helper presence.

C4's six-command maps remain unchanged.

#### R76/C5/failures

Cover through C4's seam:

- Git below 2.31.
- Root failure.
- Missing, unreadable and malformed policy.
- Non-commit/missing refs.
- Malformed OIDs and inventories.
- Nonzero metadata/content status.
- Executor rejection, signal, spawn error and malformed result.
- E2BIG and ENAMETOOLONG.
- Unexpected helper exception.

Require exact errors, no raw marker leakage, empty stdout and no later operation.

Install a runtime unit missing only `review-diff.mjs`. Review-diff must give
`GIT_SAFE_INTERNAL`. An original command such as `cat` must still work. This is a runtime
diagnostic test, not permission to install an incomplete unit through apply.

#### R97/C5/environment-names

Run every environment-name corpus row through both modes as inventory candidates and explicit
selectors.

Include root/nested `.env`, `.env.example`, `.envrc`, `.env-prod` and case variants.
There is no environment-template exception.

#### R100/C5/limits

For both modes and stdout/artifact destinations, construct complete results of:

```text
1,048,575 bytes
1,048,576 bytes
1,048,577 bytes
```

Include header bytes and multibyte content.

The first two succeed. The third gives the exact limit error, empty stdout and no output-path
creation. Cover aggregate overflow across smaller tracked/untracked pieces.

Test untracked fstat size 1,048,577 with a read seam that fails if called: the limit error must
occur without reading. Exactly 1,048,576 permits a read but still undergoes rendering and
aggregate checks.

Test oversized binary files receiving the same pre-read refusal. Test binary detection at the
8000-byte boundary independently.

#### R100/C5/narrowing

Create two safe changes whose combined result exceeds the limit and whose individual literal
selections fit.

Require full refusal, narrower success and union coverage of the safe changed paths.

Also require:

- No narrowed subset is reported as a complete full review.
- Directory selection excludes protected descendants.
- Explicit protected selection fails.
- Untracked selection uses the same literal predicate.
- Literal `a*` does not select `abc`.
- Missing selector gives header-only success.
- Narrowing removes unrelated protected M/index names from E and can avoid the argv bound.

### 4.4 Earlier tests and baseline integration

R01 invokes C5 once after C4 with:

```js
const c5context = {
  repository: path.resolve(SKILL, ".."),
  skillRoot: SKILL,
  tmp: path.join(TMP, "c5"),
  env: { ...ENV }
};
```

Create the scratch directory through the test harness. Require report `ok === true`.
Do not print nested component records.

`freshSetup` stages all four runtime members.

C4 production migration/recovery tests include the review helper in bindings, staging, write
order and restoration/removal expectations. Preserve incompatible synthetic-catalog tests,
missing-member tests and declared-unchanged-member positive controls.

No existing numbered case is removed or added by C5. The baseline final envelope is unchanged.

## 5. Edge cases and failure modes

| Edge or failure mode | Assertion |
| --- | --- |
| Dirty trusted checkout excluded | R90/C5/committed |
| Staged, unstaged and untracked local changes | R65/C5/local |
| Index refresh or other helper-owned Git mutation | R65/C5/index |
| Autocrlf and stat-dirty unchanged files | R65/C5/local; R65/C5/index |
| Missing, removed-index and skip-worktree entries | R65/C5/local |
| Unmerged entries and tracked special modes | R65/C5/local |
| Literal selectors | R76/C5/arguments; R100/C5/narrowing |
| Secret selector refusal | R74/C5/corpus |
| Secret descendants | R74/C5/corpus |
| Protected tracked names filtered before conversion | R65/C5/index; R74/C5/corpus |
| Nonregular untracked files and embedded repositories | R91/C5/inputs |
| Linked ancestors/leaves and Windows junctions | R91/C5/links |
| Resolved secrets and escapes | R91/C5/inputs; R91/C5/links |
| Existing artifacts and collisions | R91/C5/publication |
| Output escape, cwd independence and Windows names | R91/C5/artifacts |
| Reserved aliases and duplicate options | R92/C5/reserved |
| Reserved lock recovery | R92/C5/reserved |
| Cleanup touching artifacts | R92/C5/cleanup |
| Reserved partial journal affecting setup | R92/C5/cleanup |
| Self-ignore established before output | R91/C5/publication |
| Earlier artifacts ingested locally or from H | R92/C5/stdout |
| Oversized results or untracked inputs | R100/C5/limits |
| Partial publication and cleanup failures | R91/C5/publication |
| Copied secret content under allowed names | R66/C5/limits-documentation |
| Missing lazily imported helper | R76/C5/failures |

## 6. Runnable acceptance

Run in an authorized writable lane after tests and implementation are complete:

```powershell
node project-setup/tests/run-component-tests.mjs --component C5
node project-setup/tests/run-component-tests.mjs --component C11a
node project-setup/tests/run-component-tests.mjs --component C1
node project-setup/tests/run-component-tests.mjs --component C2
node project-setup/tests/run-component-tests.mjs --component C3
node project-setup/tests/run-component-tests.mjs --component C4
node project-setup/tests/run-tests.mjs
```

All exit 0 with empty stderr.

C5 prints exactly these records, summary and actual evidence path:

```text
PASS  R65/C5/local  local review includes safe working changes
PASS  R65/C5/index  local review leaves the index and Git state unchanged
PASS  R66/C5/limits-documentation  copied secret content limitation is documented
PASS  R90/C5/committed  committed review excludes trusted checkout changes
PASS  R90/C5/identity  review headers record resolved comparison identity
PASS  R91/C5/inputs  disk inputs are checked before content reads
PASS  R91/C5/artifacts  artifact paths and names are confined
PASS  R91/C5/links  links junctions and escapes are refused
PASS  R91/C5/publication  exclusive publication preserves existing files
PASS  R92/C5/reserved  setup lifecycle rejects reserved review aliases
PASS  R92/C5/cleanup  setup cleanup preserves review artifacts
PASS  R92/C5/stdout  stdout review creates no artifacts
PASS  R74/C5/corpus  shared policy corpus reaches both review modes
PASS  R76/C5/arguments  review grammar and Git vectors are pinned
PASS  R76/C5/failures  review failures emit no partial content
PASS  R97/C5/environment-names  environment name variants stay excluded
PASS  R100/C5/limits  complete review results obey the byte limit
PASS  R100/C5/narrowing  literal narrowing covers safe review subsets
18 PASS / 0 FAIL / 0 SKIP
RESULTS  <absolute-component-results-path>
```

The retained report has component `C5`, `ok: true`, no registry errors, 18 ordered passing
results, and:

```json
{"passed":18,"failed":0,"skipped":0}
```

Earlier component descriptor lines remain unchanged. Their count lines are:

| Component | Exact count line |
| --- | --- |
| C11a | `8 PASS / 0 FAIL / 0 SKIP` |
| C1 | `12 PASS / 0 FAIL / 0 SKIP` |
| C2 | `14 PASS / 0 FAIL / 0 SKIP` |
| C3 | `18 PASS / 0 FAIL / 0 SKIP` |
| C4 | `17 PASS / 0 FAIL / 0 SKIP` |

Each is followed by `RESULTS  <absolute-component-results-path>`.

The baseline retains R13d as its only skip on this Windows host. Its final output is:

```text
59 PASS / 0 FAIL / 1 SKIP

{"env":{"platform":"win32","release":"<release>","node":"<node>","git":"<git>"},"summary":{"passed":59,"failed":0,"skipped":1},"resultsFile":"<results-path>"}
```

The final line is compact JSON with actual host values and an escaped results path.
The baseline does not gain a `RESULTS` line.

Complete rc.1 acceptance remains C11b work. Missing later coverage is not a C5 skip.

## 7. Rollback

There is no database migration.

Source rollback reverts the coupled C5 change:

- Review helper.
- Core dispatch and command diagnostic.
- Fourth catalog member.
- Reserved-ID and lock-recovery behavior.
- Security/live documentation.
- Test registration and production-runtime fixture updates.

First revert later callers requiring review-diff or the fourth runtime member. C6, C8, C10 and
C11b may depend on it.

For an installed project, use current rc.1 transaction tooling:

```text
node <SKILL_DIR>/scripts/apply.mjs rollback --run-id <ordinary-run-id>
```

Roll back update runs newest first, before reverting the installed skill. Restore runtime files
and manifest through the existing journal.

Remove newly created runtime files only when current bytes still match the run. Preserve later
user edits. Incomplete rollback retains recovery material and exits 6.

Review artifacts are not transaction outputs and are not removed by rollback.

A pre-C5 setup run named `review` or an alias cannot be rolled back through the new ID guard.
Resolve such a legacy run manually before treating it as retired. Removing its setup lock does
not resolve its transaction state.

Never advertise a catalog member absent from the installed compatible unit. Q6 does not
authorize using v2 commands to repair a schema-3 project.

C11b owns eventual release/version changes.

## 8. Accepted residual risks

- The executing checkout, installed tools and policy are trusted under A3. C5 does not protect
  a session started on an attacker-controlled checkout.

- Path policy cannot detect secret content copied under an allowed filename. R66 documents
  the limitation rather than claiming content scanning.

- Configured clean/process filters can execute during tracked comparison. Git LFS may write
  `.git/lfs/objects` or other filter-owned state. The helper avoids index mutation; it does not
  promise that trusted filters are side-effect-free.

- Trusted Git configuration can contain `include.path` pointing into the working tree.
  C5 retains C4's configuration-source policy rather than introducing a separate config sandbox.

- Git reads tracked content without C5's untracked realpath checks. This follows N5's boundary,
  which requires those checks before reading untracked files.

- Untracked files are rendered as raw bytes. Their CRLF representation can differ from Git's
  normalized tracked representation.

- Large protected M/index inventories can exceed `GIT_SAFE_ARG_LIMIT`. Narrowing reduces
  exclusions; C5 does not batch content operations or weaken protection.

- C1's adopted case and Windows alias rules remain. Full Unicode normalization and case-fold
  aliases are not added.

- Filesystem checks do not provide a cross-platform atomic directory-handle sandbox against
  hostile concurrent namespace replacement. Artifact/untracked checks and descriptor identity
  checks remain required.

- Existing ordinary setup cleanup has a TOCTOU window between its startup path checks and
  removal. C5 adds no late revalidation. Reserved aliases are still rejected before accessing
  their run directory.

- A process crash or storage failure during publication can leave an incomplete exclusively
  created file. No success path is emitted before close. Handled failures attempt safe cleanup
  and report cleanup failure explicitly.

- Self-ignore does not remove tracked files. Independent artifact-input exclusion prevents
  earlier artifacts from re-entering either review mode.

- Local review is not an atomic snapshot of all working files. Concurrent edits can produce a
  mixed-time view.

- Metadata inventories are not subject to the result bound and may consume substantial memory.
  Untracked bodies have the additional pre-read size limit.

- A pre-C5 run named `review` or an alias becomes inaccessible to setup rollback/cleanup and is
  ignored by other-run lifecycle checks. It requires manual resolution. Reserved-lock recovery
  only releases the lock.

- Until C10 changes reporting, `detect.mjs` can list the review directory as a setup run.

- Until C8 updates installation instructions, old staging instructions can omit the fourth
  runtime member and correctly fail complete-unit enforcement.

- Hook behavior, canonical agent instructions, host evidence and release integration remain
  C6/C8/C10/C11b dependencies.

## 9. Plan questions

None.

Recorded decision C5-PQ1, maintainer, 2026-10-18:

Use option B: Git's working-tree comparison for tracked files, implemented through
`diff-index -p` with C4's fixed prefix. Build protected exclusions from the M tree and index
before content comparison. Preserve Git normalization, special-mode and skip-worktree
semantics. Render checked untracked files in-process.

The specified clean-filter, configuration, tracked-read and resource limitations are accepted
residual risks. No C4 export or frozen command grammar is reopened.

## Addendum at freeze: plan-critique round 2, C5-P2-1 to C5-P2-10 (NON-BLOCKING)

Added by the orchestrator when freezing, with the maintainer's approval (2026-10-19). Each item
pins a value the sections above left open. Where an item and an earlier section differ, the item
wins.

- C5-P2-1. One exclusion list, one sort. `excludedNames` is a single list: the union of the
  selected protected names from the mode's inventory (committed: the changed-path inventory;
  local: the M tree and the index), the selected artifact-input names from that same inventory,
  and the literals `.ai/.run/review` and `.ai/.run/.gitignore`. Deduplicate by exact string and
  sort the whole list once by UTF-8 bytes; E maps every element. Example: protected `.env` plus
  artifact `.ai/.run/review/a.diff` gives
  `E = [":(exclude,literal).ai/.run/.gitignore", ":(exclude,literal).ai/.run/review",
  ":(exclude,literal).ai/.run/review/a.diff", ":(exclude,literal).env"]`.
- C5-P2-2. When the content call runs. The committed `diff` call, or the local `diff-index` call,
  runs if and only if at least one selected inventory name is neither protected nor an artifact
  input; otherwise it is omitted. A committed range whose only change is a force-tracked artifact
  returns the header only, with no content call.
- C5-P2-3. Local processing order and first failure. Local mode runs, in order: (1)
  `listTree(M)`; (2) `ls-files --cached --stage`; (3) `ls-files --others` (all three inventories
  are fully parsed here, so any `GIT_SAFE_RECORD` occurs at this point); (4) selection, policy and
  artifact filtering; (5) `REVIEW_UNMERGED`; (6) `diff-index`, if C5-P2-2 requires it; (7) the
  selected untracked candidates in UTF-8 byte order, each candidate's checks, read and render
  finishing before the next starts (an embedded-repository marker gives `REVIEW_TYPE` at its
  position in this order). The first failure is returned; no Git call or filesystem read follows
  it.
- C5-P2-4. The `+++` TAB rule. Append TAB before the LF of the `+++` line if and only if the
  emitted b-label, after any quoting, contains byte 0x20. `/dev/null` never qualifies. If the
  C5-P2-5 conformance case shows Git differs on this host's minimum supported version, Git's
  bytes win and the tests lane reports it.
- C5-P2-5. Renderer conformance against real Git. R65/C5/local adds one real-Git case: in a
  separate scratch repository, mark the untracked test files intent-to-add; as raw test setup (not
  through git-safe) run `git -c core.quotePath=true diff --no-ext-diff --no-textconv
  --src-prefix=a/ --dst-prefix=b/ -- <file>`; delete each `index ` line; require byte equality
  with C5's untracked section for a name with a space, a non-ASCII name with a space, a one-line
  file, a multi-line file, an unterminated file and a binary file. Use only names valid on the
  host (control-character names are POSIX-only).
- C5-P2-6. Embedded-repository fixture. The real-Git case first checks, as a fixture-sanity step
  with its own failure message, that `ls-files --others --exclude-standard -z` reports exactly
  `<dir>/\0`. C5 behaviour is asserted with synthetic records through the execute seam: a
  selected unprotected marker gives `REVIEW_TYPE` with no read; an unselected or protected marker
  is omitted; `a//` and other malformed trailing-slash forms give `GIT_SAFE_RECORD`.
- C5-P2-7. Stat-dirty files and the sentinel log. Make a tracked file stat-dirty only with
  `fs.utimesSync`, setting its mtime at least 10 seconds away from the index entry's mtime with
  the bytes unchanged; never sleep. The clean-filter sentinel records `%f`; its log is truncated
  after all fixture `add` and `commit` steps, immediately before the review call. Require at least
  one invocation for the selected safe stat-dirty file and zero invocations naming protected
  tracked paths or untracked paths.
- C5-P2-8. The autocrlf expectation. In the `core.autocrlf=true` fixture, a CRLF working copy of
  an LF blob with identical normalized content gives no tracked output; a one-line change gives
  exactly Git's contextual hunk for that line, and the hunk's lines contain no CR byte.
- C5-P2-9. Large untracked binaries (maintainer choice: Git parity). Read `min(size, 8000)` bytes
  through the checked descriptor first. A NUL there renders the binary line without reading
  further. Otherwise a size above 1,048,576 gives `GIT_SAFE_LIMIT` before the rest of the body is
  read. This replaces the refusal of large untracked binaries in sections 3 and 4. R100 tests a
  1,048,577-byte binary succeeding as one binary line, and a 1,048,577-byte text file refused
  after reading at most 8000 bytes.
- C5-P2-10. Accepted residual risk: untracked binary classification uses only the NUL heuristic.
  `.gitattributes` (`binary`, `-diff`, `diff=`) is not consulted for untracked files, so an
  attribute-marked untracked text file renders as text where Git would print a binary line.
