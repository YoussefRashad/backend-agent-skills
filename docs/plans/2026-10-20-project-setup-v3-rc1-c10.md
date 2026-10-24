<!--
FROZEN 2026-10-20 on branch feat/project-setup-v3-rc1. Never edit this file; changes go through the
maintainer. Component plan C10 (lands eleventh, after C11a and C1-C9) under the frozen architecture
plan docs/plans/2026-10-15-project-setup-v3-rc1.md, which takes precedence, on the landed C1-C7
contracts and the frozen C8 and C9 plans. Drafted by the plan lane (Codex, 2 revisions, applying
the critique dispositions and the maintainer's PQ1 and PQ2 decisions); plan-critique (Claude) round
3 found no BLOCKING gap. The addendum at the end records round 3's items.
-->

# C10. Doctor and validation

Status: revised for critique, round 2. No plan question is open.

Target: `docs/plans/2026-10-20-project-setup-v3-rc1-c10.md`.

Baseline: committed `0585bad`, plus the frozen C7, C8 and C9 contracts and their
freeze addenda. Concurrent implementation changes are not inputs to this plan.

## 1. Scope and authority

The controlling architecture is `docs/plans/2026-10-15-project-setup-v3-rc1.md`:

- Section 2, C10: doctor diagnostics and validation integration.
- Section 4, C10: N8-doctor, R46/R49, R53 reporting, R73, R79 schema use,
  R81/R82 validation and schema-2 reporting.
- Section 4 ownership notes: component assertions establish partial coverage only.
- Section 5, C10: arguments, entrypoints, context, processes, logs and unknown readiness.
- Section 6: schema-2 migration input, reviewed updates and journaled rollback.
- Freeze addendum: release and complete acceptance remain C11b work.

Design inputs are Part A at `54ad312`, specifically A1, A4, A5 and A6, plus N8 and
implementation decision Q7. Q7 governs over N8's earlier probe wording: the doctor never
starts a model session or sandbox probe.

Landing order remains:

```text
C11a -> C1 -> C2 -> C3 -> C4 -> C5 -> C6 -> C7 -> C8 -> C9 -> C10 -> C11b
```

### 1.1 In scope

- A source-skill doctor that audits supplied lane options and local diagnostics.
- Strict argument parsing and shell-free Codex configuration inspection.
- Supported native and Windows npm entrypoint resolution.
- Sanitized MCP configuration reporting.
- Newest sandbox-log inspection and Windows process inventory.
- Validation through existing policy and ownership schemas.
- Installed policy-baseline and snippet-state reporting.
- Catalog-aware validation of every installed runtime target.
- Unanchored user-deny warnings.
- C7 allow-result integration.
- C6 installed hook self-test integration.
- Excluding reserved review-artifact directories from setup-run discovery.
- Discovery consistency with C9's root-only environment-template exception.
- Exact documentation, fixture and component-test contracts.

### 1.2 Out of scope

- Building or changing the external lane launcher.
- Enumerating configuration-defined servers for the launcher.
- Editing user configuration, permissions, sandbox settings or authentication.
- Model sessions, sandbox probes, process termination or automatic remediation.
- Proving live Claude hook loading or Codex negative capability.
- Changing policy grammar, migration, ownership, hook parsing or allow classification.
- Changing C9's template reader, merge or scanner behavior.
- Agent-baseline verification implementation; C8 already owns its checker.
- Full numbered-case records, installed-payload acceptance, release versions, tags,
  archives and release notes; these belong to C11b.
- Database migrations.

### 1.3 Consumed contracts and where C10 meets them

| Input | C10 obligation |
| --- | --- |
| C11a and G1-G14, H1-H7a | Independent descriptors, import-safe tests, strict result inventory |
| C1 | Use shared policy parsing and schemas; do not duplicate grammar or matching |
| C1 invalid manifest keys | `readManifest` uses `validateRepoPath`; invalid keys give json-schema fails |
| C2 and I2-1 | Keep `schemas.mjs`'s two relative imports and shared manifest reader |
| C2 I2-2 through I2-10 | Do not alter approvals, bindings, refusal checks or transaction outputs |
| C3 | Consume `inspectSecurityState` with installed records and shipped baseline data |
| C3 loader/reader | Use `loadEffectivePolicy` and `readInRepo` as specified in section 4.2 |
| C3 workflow gate | Preserve migration for later policy edits; document it in section 5.2 |
| C3 I3-1 through I3-6 | Preserve exports, transaction ordering, refusal sets and envelopes |
| C4 runtime targets | Read the catalog through `readRuntimeUnits`; check every target in 4.9 |
| C4 decisions I4-1 through I4-4 | Preserve runtime-unit contracts and Git-reader behavior |
| C5 fourth runtime target | Catalog iteration includes `.ai/tools/review-diff.mjs` |
| C5 reserved review directory | Discovery filters reserved names through `validateRunId` |
| C5 host-control reporting | Security section 5 and report fence separate host evidence |
| C5 decisions I5-1 through I5-4 | Preserve artifact behavior and documented copied-content limit |
| C6 | Invoke the installed self-test and require its exact successful transcript |
| C6 I6-2, I6-5, I6-9 | Do not reinterpret the hook's parser outcomes |
| C6 I6-3, I6-4, I6-8, I6-10 | Do not change staging or its error/metadata contracts |
| C6 I6-6, I6-7 | Preserve hook limitations and the seven-member runtime-unit sentence |
| C7 and C7-PQ2 | Import `inspectAllows`; append its result rows without rewriting them |
| C8 | Audit documented launcher prerequisites; preserve separate host-evidence claims |
| C8 checker | Reference its purpose only; doctor does not run agent migration checks |
| C9 | Correct detect's template inventory and guidance without opening template bodies |
| C11b/S07 | Include `scripts/doctor.mjs` in the installed inventory acceptance |

The C7 import is from `scripts/classify-allows.mjs`.

C2/C3 transaction decisions are preservation obligations, not additional C10 test lanes.
Their existing suites remain the checks for those controls.

## 2. Files touched

All numbered ranges below refer to `0585bad`. Insertions after C7-C9 use the named
section or statement as their anchor, not the old numeric position.

### 2.1 Production and documentation

| File | Baseline range | Change |
| --- | --- | --- |
| `scripts/validate.mjs` | 1-20 | Import-safe entrypoint, dependencies and fixed-control reads |
| Same | 22-52 | Shared policy/schema handling and validated state retention |
| Same | 54-151 | Preserve existing checks; apply effective-policy skip semantics |
| Same | 145-151 | Catalog, policy, deny-anchor and allow integration |
| Same | 153-161 | Hook evidence and unchanged summary semantics |
| `scripts/detect.mjs` | 9-12, 134 | Import `validateRunId`; filter reserved run names |
| Same | 141-143 | Root-only template classification |
| Same | 342-343 | Correct tracked-secret and template guidance |
| `SKILL.md` | 58-73 | Update validator row and add doctor row |
| Same | 154-159 | Explain trusted-checkout execution, evidence and doctor scope |
| `references/report.md` | 14-18 | Separate static, direct-hook and doctor evidence |
| `references/security.md` | 160-176 | Extend capability-report guidance |
| Same | after 176 | Add `## 6. Doctor diagnostics` |
| `README.md` | C8 insertion between 42 and 44 | Replace its future-doctor paragraph |
| `references/codex.md` | C8 insertion at 66-69 | Replace its future-doctor paragraph |
| `scripts/doctor.mjs` | New | Doctor implementation |
| `tests/fixtures/doctor-cases.json` | New | Literal synthetic doctor cases |

`schemas.mjs:1-99` is an inspected dependency, not an implementation edit.
Its existing `checkSecurityPolicy`, `checkManifest` and `checkClaudeSettings` are sufficient.
Its exact export set and I2-1 import constraint remain unchanged.

No `runtime-units.json` change is planned. The catalog remains the seven C6 members.
`doctor.mjs` runs from the installed skill's `scripts/` directory; it is not copied into
a project's `.ai/tools/` and is not part of the policy-reader runtime unit.

The installer copies `scripts/` wholesale. No installer implementation edit is needed;
C11b/S07 must name `scripts/doctor.mjs` in its installed inventory checks.

No release/version edit belongs to C10. C11b owns the coordinated rc.1 release stamp.

### 2.2 Tests-lane files

| File | Baseline range or anchor | Change |
| --- | --- | --- |
| `tests/c10.test.mjs` | New | Twenty C10 assertions |
| `tests/rc1-cases.mjs` | 9-15 | Import `C10_IMPLEMENTATIONS` after landed C7-C9 imports |
| Same | 40-174 | Add the independent C10 descriptor list |
| Same | 177-185 | Register `C10_IMPLEMENTATIONS` |
| `tests/run-tests.mjs` | R29, 908-957 | Append C10 aggregation after frozen C9 aggregation |
| `tests/c2.test.mjs` | 1311-1333 | Replace obsolete single-info-row expectation |
| `tests/c3.test.mjs` | 3449-3468 | Replace temporary prohibition on validation inspection rows |
| Same | discovery case near 3357 | Narrow the template exception to root `.env.example` |
| `tests/c8.test.mjs` | Frozen launcher assertion | Expect the available-doctor paragraph |
| `tests/c9.test.mjs` | Frozen command occurrence controls | Replace detect's old regex control |

The tests lane owns all these test edits. The implementer must not edit them.

### 2.3 Composition with C7-C9

- **C7 / detect:** retain `claude.allows`, its final key position, warning order,
  invalid-input behavior and guarded shared-settings reads. C10 changes the
  template-related inventory, its two existing warning strings and reserved-run filtering.
- **C7 / validate:** C7-PQ2 leaves integration entirely to C10. Import its classifier;
  do not copy its classification algorithm or diagnostic generator.
- **C8 / SKILL:** retain the frozen migration/staging sequence, hook identity,
  allow-retirement guidance and baseline-checker prerequisite.
- **C8 / security:** preserve all frozen headings, narrowing paragraphs, artifact
  guidance and seven-member runtime-unit sentence.
- **C8 / launcher:** preserve its prerequisite paragraphs except the future-doctor
  paragraph. Replace that paragraph in README and Codex specifics with section 5.2's
  exact available-doctor text.
- **C8 / tests:** preserve its 16 assertions. Update only the future-doctor expectation
  within `A5-templates/C8/launcher`.
- **C9 / SKILL:** preserve its exact exception paragraph, script row and full commands.
- **C9 / report:** preserve its conditional manual-step and value-classification bullets
  inside the existing report fence, and its sentence after that fence.
- **C9 / security:** preserve its exact root-template exception and scanner exception.
- **C9 / detect:** implement the named discovery residual. This does not add a dependency
  on C9's template-reading behavior: detect still reads names only.
- **C9 / command controls:** replace the old detect regex occurrence control with the
  new filename literal. Keep the `validate.mjs:134` RULES regex byte-identical.
- **C7-C9 / run-tests:** append one C10 aggregation after their frozen aggregations.
  Do not duplicate or reorder them.

### 2.4 Public interfaces consumed by C11b

New production exports:

```typescript
// scripts/doctor.mjs
parseDoctorArgs(argv: string[]): DoctorOptions;
main(argv: string[], dependencies?: DoctorDependencies): Promise<CommandResult>;

// scripts/validate.mjs
main(argv: string[], dependencies?: ValidationDependencies): Promise<CommandResult>;

type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};
```

New test export:

```javascript
C10_IMPLEMENTATIONS
```

No default exports or additional named exports are permitted.

C11b consumes these CLIs:

```text
node <SKILL_DIR>/scripts/doctor.mjs <documented lane options>
node <SKILL_DIR>/scripts/validate.mjs
node <SKILL_DIR>/scripts/validate.mjs --json
```

Both modules are import-safe: imports cause no project reads, writes, output, process
launches or changes to `process.exitCode`.

Both direct-entry checks use the C6 `hooks-selftest.mjs` pattern:

1. Compare resolved `process.argv[1]` and `fileURLToPath(import.meta.url)`.
2. Case-fold both on Windows.
3. If unequal, compare their `fs.realpathSync.native` results with the same folding.
4. A failed fallback means not the entrypoint.

There is no top-level await at module scope. The direct-entry block calls `main` and
handles its promise. Importing from the component registry must not create an await cycle.

A validator CLI test launches through a junctioned skill directory and requires the
complete JSON report, not merely exit 0. Junction-creation failure fails that assertion.

A doctor CLI test launches through a junctioned skill directory with `["--help"]`.
It requires exit 2, empty stderr and exactly:

```javascript
J({ok:false,code:"DOCTOR_OPTION",error:"DOCTOR_OPTION: unsupported argument"})
```

Junction-creation failure fails that assertion. This parse-only case performs no doctor
diagnostics and remains within the CLI restrictions in section 6.2.

## 3. Doctor behavior

### 3.1 Output conventions

`J(value)` means `JSON.stringify(value, null, 2) + "\n"`.

The direct CLI writes `main`'s returned streams and sets its exit code. `main` itself
does none of those things.

All handled doctor outcomes have empty stderr. Native errors, CLI streams, configuration
objects and process command lines are never forwarded.

A syntactically invalid invocation returns:

```javascript
{
  exitCode: 2,
  stdout: J({ok:false, code:CODE, error:MESSAGE}),
  stderr: ""
}
```

A completed diagnostic report returns exit 0 if `ready:true`, otherwise exit 1.

Argument parsing completes before constructing default context or accessing any filesystem,
environment-dependent diagnostic path or executor.

### 3.2 Exact argument grammar

Accepted tokens are only:

```text
--disable apps
--disable plugins
-c mcp_servers.<name>.enabled=false
-p <profile>
--profile <profile>
-C <directory>
--cd <directory>
```

Rules:

- All values are separate argv elements.
- Each disable feature may appear once.
- Each server identifier may appear once.
- Profile may appear once across both aliases.
- Directory may appear once across both aliases.
- Server and profile identifiers match `[A-Za-z0-9_][A-Za-z0-9_-]{0,63}`.
- A directory is nonempty, does not start with `-`, and contains no double quote
  or forbidden control character.
- A directory enclosed in literal single quotes is rejected. Shell quoting removed by
  the caller's shell is not part of argv and remains supported.
- Windows drive-relative values such as `C:repo` are rejected on every platform.
  The parser has no platform input. A drive prefix must be followed by `/` or `\`.
- Spaces, non-ASCII characters, apostrophes inside names, `&`, `;`, `$` and backticks
  inside directory names are literal characters. They are not evaluated.
- No positional command, `--` separator, attached value, general `--config`, arbitrary
  TOML override, help flag, sandbox option or configuration-isolation shortcut is accepted.
- Empty argv is syntactically valid but cannot establish lane readiness.

Forbidden controls are exactly:

```javascript
/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/
```

Parser output has exactly these keys:

```javascript
{
  disableApps: false,
  disablePlugins: false,
  servers: [],
  profile: null,
  directory: null,
  argv: []
}
```

The parser preserves accepted option order. It canonicalizes only `--profile` to `-p`
and `--cd` to `-C`. `servers` preserves first appearance order. No arguments are mutated.

Parser failures throw `Error` with an own `code` and the exact prefixed message below.

| Condition | Code and message |
| --- | --- |
| Non-array argv or non-string element | `DOCTOR_ARGV: arguments must be strings` |
| Any token contains forbidden controls | `DOCTOR_CONTROL: control characters are not allowed` |
| Recognized option lacks a value | `DOCTOR_VALUE: option requires a value` |
| Duplicate option or server | `DOCTOR_DUPLICATE: option may be supplied only once` |
| Invalid `--disable` value | `DOCTOR_DISABLE: only apps and plugins may be disabled` |
| Invalid `-c` assignment | `DOCTOR_OVERRIDE: only a named MCP disable override is allowed` |
| Invalid profile | `DOCTOR_PROFILE: invalid profile identifier` |
| Invalid directory | `DOCTOR_DIRECTORY: invalid directory value` |
| Every other token | `DOCTOR_OPTION: unsupported argument` |

Precedence is deterministic:

1. Validate the entire argv shape. Any non-string element gives `DOCTOR_ARGV`.
2. Scan every token for controls. Any match gives `DOCTOR_CONTROL`.
3. Parse left to right. The first invalid option/value pair wins.
4. For a recognized option, check missing value, then duplication, then value validity.
5. Duplicate server/feature identity is checked only when that identity can be parsed.
   An invalid assignment or unknown feature retains its override/disable error.
6. Do not scan later pairs for a higher-priority category.

A following recognized option counts as a missing value for the preceding option.
Otherwise validate the value according to that option. Do not echo rejected tokens.

For example, an invalid profile followed by an unknown option gives `DOCTOR_PROFILE`.
An invalid profile followed anywhere by an LF-bearing token gives `DOCTOR_CONTROL`,
because the global control precheck runs first.

Exact rejection examples:

| argv | Code |
| --- | --- |
| `["--help"]` | `DOCTOR_OPTION` |
| `["--json"]` | `DOCTOR_OPTION` |
| `["mcp"]` | `DOCTOR_OPTION` |
| `["exec"]` | `DOCTOR_OPTION` |
| `["--"]` | `DOCTOR_OPTION` |
| `["--disable=apps"]` | `DOCTOR_OPTION` |
| `["--profile=x"]` | `DOCTOR_OPTION` |
| `["-Cx"]` | `DOCTOR_OPTION` |
| `["--sandbox","read-only"]` | `DOCTOR_OPTION` |
| `["--ignore-user-config"]` | `DOCTOR_OPTION` |
| `["-c","sandbox_mode=\"danger-full-access\""]` | `DOCTOR_OVERRIDE` |
| `["-c","mcp_servers.a.b.enabled=false"]` | `DOCTOR_OVERRIDE` |
| `["-c","mcp_servers.a.enabled=true"]` | `DOCTOR_OVERRIDE` |
| `["-c","mcp_servers.\"a\".enabled=false"]` | `DOCTOR_OVERRIDE` |
| `["-c","mcp_servers.a.enabled=false\nx=1"]` | `DOCTOR_CONTROL` |

### 3.3 Dependency seam

`DoctorDependencies` permits exactly:

```typescript
{
  context?: {
    platform: string;
    cwd: string;
    home: string;
    env: Record<string,string>;
    node: string;
  };
  fs?: {
    lstatSync: Function;
    realpathSync: Function;
    readdirSync: Function;
    readFileSync: Function;
  };
  execute?: (
    executable: string,
    argv: string[],
    options: object
  ) => ProcessResult | Promise<ProcessResult>;
}
```

`realpathSync` means the native-realpath operation. The default adapter calls
`fs.realpathSync.native`.

A supplied context must contain exactly those five keys. `cwd`, `home` and `node` must
be absolute under the supplied platform's path rules. `env` must be a non-array object
of string values. The filesystem seam must supply every listed function.

Invalid dependency shapes throw:

```text
code: DOCTOR_OPTIONS
message: DOCTOR_OPTIONS: invalid doctor dependencies
```

No CLI option or environment variable enables injected implementations.

Default context uses the current platform, cwd, home, environment and absolute
`process.execPath`. Defaults are constructed when `main` runs, after argument parsing,
not at import time.

Filesystem and executor failures during diagnostics become report outcomes below.
They do not escape as native exceptions.

Platform-dependent operations use:

```javascript
const paths = context.platform === "win32" ? path.win32 : path.posix;
const pathDelimiter = context.platform === "win32" ? ";" : ":";
```

This selection governs absolute checks, dirname, join, resolve and executable/log paths,
including synthetic POSIX cases run on a Windows test host.

On Windows, environment-name lookup is case-insensitive. Iterate `Object.entries(env)`
and take the first key whose lowercase spelling equals the requested lowercase name.
Thus first insertion order wins for duplicate spellings such as `Path` and `PATH`.
On other platforms lookup uses the exact key.

Apply this rule to PATH, SystemRoot and CODEX_HOME. Pass the original environment object
unchanged to child processes.

`ProcessResult` has these fields:

```typescript
{
  status: number | null;       // number must be an integer
  signal: string | null;
  error?: unknown;
  stdout: string;
  stderr: string;
}
```

Additional keys, including native spawnSync `pid` and `output`, are ignored.
A structurally valid successful result requires `error` absent or null.
There is no separate synthetic `overflow` flag: overflow is a failed spawn result with
`error.code === "ENOBUFS"`.

The literal normal result used below is:

```javascript
{status:0,signal:null,stdout:"[]",stderr:""}
```

Each following literal is a separate `DOCTOR_CLI` fixture:

```javascript
// Nonzero exit
{status:1,signal:null,stdout:"",stderr:""}

// Signal
{status:null,signal:"SIGTERM",stdout:"",stderr:""}

// Spawn failure
{status:null,signal:null,error:{code:"ENOENT"},stdout:"",stderr:""}

// Timeout, matching spawnSync's error-plus-signal representation
{status:null,signal:"SIGTERM",error:{code:"ETIMEDOUT"},stdout:"",stderr:""}

// Capture overflow
{status:null,signal:"SIGTERM",error:{code:"ENOBUFS"},stdout:"",stderr:""}

// Nonempty stderr
{status:0,signal:null,stdout:"[]",stderr:"fixture diagnostic\n"}

// Malformed result
{status:"0",signal:null,stdout:"[]",stderr:""}
```

Also test an executor throwing `new Error("fixture marker")` and an executor returning
a rejected promise with that error. Neither marker is reported.

Null results, missing streams, non-string streams and inconsistent status/signal combinations
also fail. A status of 0 with a non-null signal is not success.

### 3.4 Context and executable resolution

The effective directory reported in `context.directory` is `paths.resolve` of the supplied
directory against original cwd, or `paths.resolve(originalCwd)` when omitted.
It is not rewritten to a realpath spelling. It must resolve to an existing directory.

The profile is the supplied exact identifier or `null`. The doctor does not substitute
another profile or alter CODEX_HOME, HOME, USERPROFILE or configuration variables.

Both apps and plugins disable flags are required for readiness. Their absence is a
configuration prerequisite failure, not a parser error.

Executable lookup:

1. Examine PATH directories in order using section 3.3's lookup and delimiter.
2. Ignore empty and relative PATH entries.
3. On Windows, consider `codex.exe`, then `codex.cmd`, within each directory.
4. On other platforms, consider `codex`.
5. A native candidate must resolve to an existing regular file; on POSIX it must have an
   executable mode bit.
6. For `codex.cmd`, establish the regular file at:

```text
<shim-directory>/node_modules/@openai/codex/bin/codex.js
```

7. Never read, parse or execute the shim body.
8. If the first discovered candidate is unsupported or its required entrypoint is
   unavailable, stop resolution. Do not silently switch to another installation.
9. Resolve executable and package-entrypoint paths through native realpath to absolute paths.
10. Linked parent directories are permitted for the trusted executable/package installation.
    The final executable or package entrypoint must be a regular file. This supports
    installations reached through nvm-windows, volta or scoop links.

The selected trusted installation is not authenticated by the doctor. PATH and the
Codex installation are part of the trusted local environment.

Let `A` be the parser's normalized argv. Let:

```javascript
O = [...A, "mcp", "list", "--json"];
```

Exact invocations:

```javascript
// Native
execute(absoluteCodex, O, options);

// Standard Windows npm shim
execute(absoluteNode, [absolutePackageEntrypoint, ...O], options);
```

Exact options:

```javascript
{
  cwd: originalCwd,
  env: originalEnvironment,
  shell: false,
  windowsHide: true,
  encoding: "utf8",
  timeout: 10000,
  maxBuffer: 1048576
}
```

Keeping the original cwd ensures a relative `-C` value is interpreted once.

Example:

```text
Input:
--disable apps --disable plugins -p review -C "D:\Work Repo"
-c mcp_servers.node_repl.enabled=false
```

The directory quotes above are shell syntax. The resulting native argv is:

```javascript
[
  "--disable", "apps",
  "--disable", "plugins",
  "-p", "review",
  "-C", "D:\\Work Repo",
  "-c", "mcp_servers.node_repl.enabled=false",
  "mcp", "list", "--json"
]
```

For npm, prepend only the absolute package entrypoint to this same array.

There is no `cmd /c`, `shell:true`, command concatenation, `--version`, model command
or retry invocation.

### 3.5 MCP output and disable coverage

A successful process result requires:

- Integer `status:0`.
- `signal:null`.
- `error` absent or null.
- String stdout and stderr.
- Empty stderr.

A throw, rejection, timeout, signal, nonzero status, nonempty stderr, malformed process
result or overflow produces `DOCTOR_CLI`.

Successful stdout must parse as a JSON array. Each item must be an object containing:

```typescript
{
  name: string;
  enabled: boolean;
}
```

Names must satisfy the server-identifier grammar and must be unique. Other fields are
ignored and never copied to the report. Empty arrays are valid. Empty stdout, banners,
multiple JSON documents, wrong roots, missing fields and wrong types are invalid.

Report each valid item in CLI order:

```javascript
{name, enabled, covered}
```

`covered` is exact membership in the supplied disable-override identifiers.

Any enabled server means not ready. A disabled server without a matching supplied
override also means not ready: the doctor cannot establish the launcher's disable
coverage from an incidental disabled state.

A supplied override absent from the returned list is allowed. It is not an enabled
server, and the CLI has accepted the effective configuration.

Failure precedence:

1. Process failure: `DOCTOR_CLI`.
2. Invalid output: `DOCTOR_OUTPUT`.
3. Any enabled server: `DOCTOR_ENABLED`.
4. Any uncovered listed server: `DOCTOR_CONFIGURATION`.
5. Otherwise configuration check passes.

On process or output failure, report `servers:[]`; never report partially parsed items.

The command's successful interpretation of the supplied context is configuration
evidence. It cannot prove that a later worker was launched with those same options.

### 3.6 Sandbox logs

Use:

```text
<CODEX_HOME>/.sandbox
```

when CODEX_HOME is a nonempty absolute path; otherwise, when unset or empty, use:

```text
<home>/.codex/.sandbox
```

Use section 3.3's environment and path rules. A relative CODEX_HOME makes the log result
unreadable. Do not relocate or rewrite it.

Only direct children whose basenames match this expression are candidates:

```javascript
/^sandbox\.[A-Za-z0-9._-]+\.log$/
```

Select the greatest `mtimeMs`; ties use descending ordinal basename order.
A candidate mtime must be finite and convertible to a valid JavaScript Date.
An invalid candidate mtime makes enumeration unreadable.

- Missing directory or no candidates: absent.
- Directory enumeration/stat failure: unreadable.
- Linked `.sandbox` directory or linked selected file: unreadable.
- Nonregular selected file: unreadable.
- Selected file larger than 1,048,576 bytes: unreadable.
- Selected file read failure: unreadable.
- Do not fall back to an older file after the selected file fails.

Read only the selected log. Decode UTF-8 and split on CRLF, LF or CR.

The first line matching the following expression is the first setup-refresh error:

```javascript
/\bsetup refresh\b.*\berrors?\b|\berror\b.*\bsetup refresh\b/i
```

Return that line without its terminator, preserving its other characters, subject to this
report bound:

```javascript
firstError = line.length <= 1024 ? line : line.slice(0, 1024) + " [truncated]";
```

The bound counts JavaScript UTF-16 code units. Do not print any other log lines.

A readable selected log without that marker is `clean`. This means only that the
selected log has no recognized setup-refresh error. It is not a successful sandbox probe.

The report exposes the log basename, its mtime as `new Date(mtimeMs).toISOString()`,
and the bounded first matching line. It does not expose the complete log or separately
report the home directory. The error line itself can contain a home path.

A historical error keeps the doctor not ready while that file remains the newest log.
The doctor does not delete, edit or rotate logs. After the user resolves the underlying
problem, a later ordinary Codex operation must produce newer evidence before this check
can become clean; the doctor does not generate that evidence.

Never enumerate `.sandbox-secrets`, read `auth.json`, follow a log link, or accept a
caller-selected arbitrary log path.

### 3.7 Windows process inventory

On Windows, invoke the absolute executable:

```text
<SystemRoot>\System32\WindowsPowerShell\v1.0\powershell.exe
```

Use section 3.3's case-insensitive SystemRoot lookup and Windows path rules.
SystemRoot must be an absolute path. Failure to establish the executable produces an
unavailable inventory.

Exact argv:

```javascript
[
  "-NoLogo",
  "-NoProfile",
  "-NonInteractive",
  "-Command",
  "[Console]::OutputEncoding=[Text.Encoding]::UTF8;" +
    "ConvertTo-Json -InputObject @(Get-CimInstance Win32_Process | " +
    "Select-Object ProcessId,Name,ExecutablePath) -Compress"
]
```

Exact options:

```javascript
{
  cwd: originalCwd,
  env: originalEnvironment,
  shell: false,
  windowsHide: true,
  encoding: "utf8",
  timeout: 15000,
  maxBuffer: 1048576
}
```

The command string is fixed implementation text. No caller value is interpolated into it.

Process-result success uses the same conditions as the MCP command. JSON must be an array
of records with:

- Positive integer `ProcessId`.
- Nonempty string `Name`.
- `ExecutablePath` either null or an absolute path.

Ignore other properties. Never request or report command lines.

Normalize separators and compare paths case-insensitively.

Classify a visible executable as:

- `cua-node` when its path contains `/runtimes/cua_node/`.
- Otherwise `desktop` when it is under a WindowsApps package directory whose name
  contains `Codex`, case-insensitively.
- Otherwise unrelated.

A record with a null executable path and a name containing `codex` or `cua_node` makes
the inventory unavailable. Do not infer that it is harmless.

Report matches as:

```javascript
{pid: ProcessId, name: Name, kind: "desktop" | "cua-node"}
```

Sort by ascending pid, then ordinal name. No window-state filter is applied, so tray
processes are included.

A nonempty match list means not ready. Empty complete visible inventory passes.
Unavailable or malformed inventory means unknown and not ready.

On non-Windows platforms, do not launch a process inventory command. Report
`not-applicable`.

This classifier is deliberately limited to the documented Windows package/runtime layout.
Its residual limits are stated in section 8.

### 3.8 Exact report

A report has exactly this key order:

```javascript
{
  ok: true,
  ready: true,
  scope: "configuration-and-diagnostics",
  context: {directory: EFFECTIVE_ABSOLUTE_DIRECTORY, profile: PROFILE_OR_NULL},
  checks: [
    {check:"context", status:"pass", code:null,
     detail:"Effective lane options established"},
    {check:"entrypoint", status:"pass", code:null,
     detail:"Supported Codex entrypoint established"},
    {check:"mcp", status:"pass", code:null,
     detail:"Every listed MCP server is disabled and covered"},
    {check:"sandbox-log", status:"pass", code:null,
     detail:"Newest sandbox log has no setup-refresh error"},
    {check:"processes", status:"pass", code:null,
     detail:"No matching Codex Desktop or cua_node process observed"}
  ],
  servers: [],
  sandboxLog: {file: LOG_BASENAME, mtime: LOG_MTIME_ISO, firstError: null},
  processes: [],
  runtimeEvidence: {
    connectorTools: "not-verified",
    sandbox: "not-verified"
  }
}
```

The successful report above is the reference object. Tables below define complete
substitutions; all unmentioned fields retain their reference values.

`ok` always equals `ready`. Readiness requires every check to be `pass` or
`not-applicable`. No unknown or skipped measurement establishes readiness.

| Condition | Check | Status | Code |
| --- | --- | --- | --- |
| Invalid effective directory or missing disable flags | context | fail | `DOCTOR_CONFIGURATION` |
| Unsupported/missing entrypoint | entrypoint | fail | `DOCTOR_ENTRYPOINT` |
| CLI failure | mcp | fail | `DOCTOR_CLI` |
| Malformed CLI output | mcp | fail | `DOCTOR_OUTPUT` |
| Enabled server | mcp | fail | `DOCTOR_ENABLED` |
| Uncovered listed server | mcp | fail | `DOCTOR_CONFIGURATION` |
| No log | sandbox-log | unknown | `DOCTOR_LOG_ABSENT` |
| Unreadable log | sandbox-log | unknown | `DOCTOR_LOG_UNREADABLE` |
| First setup-refresh error found | sandbox-log | fail | `DOCTOR_LOG_ERROR` |
| Matching process | processes | fail | `DOCTOR_PROCESS_RUNNING` |
| Inventory unavailable | processes | unknown | `DOCTOR_PROCESS_UNAVAILABLE` |
| Non-Windows host | processes | not-applicable | null |

Exact replacement details:

```text
DOCTOR_CONFIGURATION/context:
Effective lane directory and both apps/plugins disable flags are required

DOCTOR_ENTRYPOINT:
Supported Codex entrypoint could not be established

DOCTOR_CLI:
Codex MCP configuration check failed

DOCTOR_OUTPUT:
Codex MCP configuration output is invalid

DOCTOR_ENABLED:
At least one listed MCP server is enabled

DOCTOR_CONFIGURATION/mcp:
Disable coverage for every listed MCP server could not be established

DOCTOR_LOG_ABSENT:
No sandbox log is available

DOCTOR_LOG_UNREADABLE:
Newest sandbox log could not be read

DOCTOR_LOG_ERROR:
Newest sandbox log contains a setup-refresh error

DOCTOR_PROCESS_RUNNING:
Codex Desktop or cua_node processes are running; quit Codex Desktop and retry

DOCTOR_PROCESS_UNAVAILABLE:
Windows process inventory could not be established

Non-Windows:
Windows process inventory is not applicable
```

Additional substitutions:

- Invalid directory: `context.directory:null`.
- Missing flags with a valid directory: retain the resolved directory.
- Context failure: entrypoint and MCP checks become `not-run`, code null, with details
  `Entrypoint check not run` and `MCP configuration check not run`.
- Entrypoint failure: MCP check becomes that same `not-run` row.
- These failures do not suppress independent log/process diagnostics.
- Absent log: `{file:null,mtime:null,firstError:null}`.
- Enumeration failure: `{file:null,mtime:null,firstError:null}`.
- Selected unreadable log:
  `{file:selectedBasename,mtime:selectedMtimeIso,firstError:null}`.
- If selection/stat never established a valid mtime, both file and mtime are null.
- Error log:
  `{file:selectedBasename,mtime:selectedMtimeIso,firstError:boundedFirstMatchingLine}`.
- Process unavailable: `processes:[]`.
- Non-Windows: `processes:[]`.

A failure never produces a synthetic passing replacement for another unavailable check.

## 4. Validation behavior

### 4.1 CLI and seam

Accept exactly empty argv or `["--json"]`. Both produce identical JSON.

Other argv returns exit 2, empty stderr and:

```javascript
J({
  ok:false,
  code:"VALIDATE_USAGE",
  error:"usage: validate.mjs [--json]"
})
```

`ValidationDependencies` permits exactly:

```typescript
{
  root?: string;
  files?: string[];
  execute?: Function;
}
```

- `root` is an absolute existing repository-root directory.
- `files`, when supplied with `root`, replaces Git's filename inventory.
- `files` must contain unique structurally valid repository-relative paths.
- `execute` has the doctor executor signature.
- Unknown keys, invalid values, or `files` without `root` throw:

```text
code: VALIDATE_OPTIONS
message: VALIDATE_OPTIONS: invalid validation dependencies
```

No CLI exposes these seams. Filesystem failure injection uses the C5/C6 test pattern:
a Node preload or an in-process filesystem recorder with synchronized built-in exports.

Every `main` call establishes its root before project validation, on both paths.
Without a root seam, call `repoRoot` anew for that invocation; do not reuse a module-global
root from an earlier call. Use existing filename exclusions.

Outside a repository retain:

```javascript
{exitCode:1, stdout:J({ok:false,error:"not inside a git repository"}), stderr:""}
```

With the root seam, establish the root through `setFilesystemRoot` before `readInRepo`,
so fixed-control reads do not perform hidden Git discovery. The root returned by that helper
is the filesystem anchor for those reads.

A root seam refused by `setFilesystemRoot`, including a root that is itself a symlink or
junction, rejects `main`'s promise with an Error whose own code is `VALIDATE_OPTIONS` and
whose message is exactly:

```text
VALIDATE_OPTIONS: invalid validation dependencies
```

No report is returned, no process stream is written, and no project body or child process is
used after that refusal. Do not expose the helper's `APPLY_ROOT` error.

### 4.2 Read boundary

Use detect's existing C3 pattern:

```javascript
isProtected(rel) =
  policyFailure !== null ||
  isSecretPath(rel, shippedPolicy) ||
  isSecretPath(rel, installedEffectivePolicy);
```

Use `loadEffectivePolicy` as the effective-policy loader. Before it reads a present installed
policy, establish that fixed control input with `readInRepo`. The installed policy and
manifest are fixed control inputs exempt from name protection, including deny-all after a
policy failure. Both remain subject to `readInRepo` link and containment checks.
This is not a general exemption for paths named inside either file.

Read the fixed control inputs and self-test members with `readInRepo`.
This retains its existing containment and link/junction checks without introducing a general
guarded-read framework.

Malformed or unreadable installed policy produces one policy failure and makes the matcher
deny-all for subsequent project-content reads, except the fixed manifest-control read.
It must not fall back to shipped defaults as permission to read.

Never read personal settings, `.env*`, auth files, sandbox-secret files or arbitrary paths
named by an invalid manifest.

The input classes and their outcomes are:

| Input class | Read requirement and outcome |
| --- | --- |
| Installed policy | Fixed bootstrap input; section 4.4 pins absent, malformed and read errors |
| Manifest | Fixed control exempt from name protection; use `readInRepo` when present |
| Shared settings | Fixed control; if present, use `readInRepo` and report refusal/read failures |
| Catalog runtime members | Section 4.9 pins presence, protection and read outcomes |
| Three self-test members | Section 4.8 pins required preconditions when activated |
| Codex/Claude wrappers | Existing content checks; skip protected bodies |
| AGENTS/CLAUDE instruction files | Existing content checks; skip protected bodies |
| Canonical agent documents | Existing reference checks; skip protected bodies |
| Marker-scan candidates | Optional content reads; skip protected bodies |
| Valid-manifest drift candidates | Existing drift check; skip protected bodies |
| Generated-content scan candidates | Optional content reads; skip protected bodies |
| `.gitignore` hygiene body | Existing check; skip protected body |

For manifest and shared settings only, required-read outcomes are:

```javascript
{level:"fail", check:"validation-path",
 detail:"<rel>: unsafe validation input"}

{level:"fail", check:"validation-protected",
 detail:"<rel>: protected validation input was not read"}

{level:"fail", check:"validation-io",
 detail:"<rel>: validation input could not be read"}
```

The protection row applies only to shared settings; never emit it for the fixed manifest.
For shared settings, precedence is unsafe path, protection, then read failure.
For manifest, precedence is unsafe path, then read failure.

Use path metadata checks before body access; do not open a body to establish protection.
`readInRepo` performs the final path-chain check. Emit one such row per fixed control,
not one per consumer.

Absent manifest/settings remain absent, not read errors. A present but refused, invalid or
unreadable manifest is never treated as absent.

For other existing content checks, protection means no content-derived row from that file.
Do not add `validation-*` rows to every optional read. Existing missing-reference, drift and
hygiene semantics remain, except that a protected body cannot be inspected to manufacture a
content finding. Runtime and hook checks have their own exact rows.

The existing RULES regex at `validate.mjs:134`, including its `process.env` alternative, stays
byte-identical. This preserves C9's non-command occurrence control.

### 4.3 Existing output and evidence separation

Retain the existing top-level order and append `runtimeEvidence`:

```javascript
{
  ok: summary.fail === 0,
  summary: {pass: N, warn: N, fail: N},
  results: ROWS,
  runtimeEvidence: {
    hookSelfTest: "not-run" | "passed" | "failed",
    claudeHookLoading: "not-verified"
  }
}
```

Info rows remain excluded from all three totals. Any fail row gives exit 1.
Otherwise exit 0. Stderr is empty.

Existing TOML, instruction, reference, marker, drift, content and hygiene row text remains
unchanged except for the fixed-control read outcomes in section 4.2.

New row placement:

1. Shared-settings JSON rows.
2. Manifest JSON rows, with schema-2 version info immediately after its pass.
3. Installed-policy schema row, when applicable.
4. Existing sections 2-6.
5. Existing security-tooling checks.
6. Catalog runtime-target rows.
7. Policy-state rows.
8. User-deny anchor rows.
9. Allow rows.
10. Installed-hook self-test row.
11. Existing hygiene rows.

Policy loading happens before content reads, but its buffered result occupies position 3.
A policy failure can therefore make the earlier displayed shared-settings row protected.
The manifest remains a fixed control and is still read and validated.

The direct hook test is runtime evidence about the installed script only. It does not turn
static settings validation into proof of Claude execution.

### 4.4 Schemas and schema-2 reporting

Use `checkManifest`, `checkClaudeSettings` and `checkSecurityPolicy` from `schemas.mjs`.
Use validated manifest data only after the entire manifest passes.

A valid manifest produces:

```javascript
{level:"pass",check:"json-schema",detail:".ai/manifest.json"}
```

For schema 2, immediately follow it with:

```javascript
{
  level:"info",
  check:"manifest-version",
  detail:".ai/manifest.json: schema 2 needs update to schema 3"
}
```

Schema 3 has no manifest-version row.

Examples of exact invalid-manifest rows:

```javascript
{level:"fail",check:"json-schema",
 detail:".ai/manifest.json: schema must be 2 or 3"}

{level:"fail",check:"json-schema",
 detail:".ai/manifest.json: skill must be \"project-setup\""}

{level:"fail",check:"json-syntax",
 detail:".ai/manifest.json: manifest is not valid JSON"}
```

Other schema issues retain the shared reader's exact issue text, prefixed with
`.ai/manifest.json: `. Native JSON parse messages and source text are not exposed.

Invalid manifest file keys fail through `readManifest` and C1's `validateRepoPath`.
No manifest-derived body is read after any manifest schema failure.

A valid installed policy produces:

```javascript
{level:"pass",check:"policy-schema",detail:".ai/security-paths.json"}
```

A policy-reader failure produces:

```javascript
{
  level:"fail",
  check:"policy-schema",
  detail:".ai/security-paths.json: " + EXACT_SHARED_READER_MESSAGE
}
```

An unreadable, unsafe or linked installed policy uses:

```text
.ai/security-paths.json: POLICY_IO: cannot read security policy: .ai/security-paths.json
```

Policy-state handling is exact:

| Installed policy | Policy-schema row | `inspectSecurityState` |
| --- | --- | --- |
| Present and valid | Pass above | Run only with valid/absent manifest |
| Absent | None | Do not run |
| Malformed | One shared-reader failure | Do not run |
| Unreadable/unsafe/linked | One POLICY_IO failure | Do not run |

When the policy is absent and `.ai/agents` exists, emit the existing row:

```javascript
{
  level:"fail",
  check:"security-tooling",
  detail:".ai/security-paths.json missing; shared agents depend on it"
}
```

Do not additionally report managed-policy drift, unknown baseline, behind state or snippet
state for an absent policy. A missing policy outside that existing requirement receives no
policy-schema pass and no policy-state rows.

A malformed installed policy now causes validation exit 1 through `policy-schema`.
This is an intended C10 change; C3's statement that it introduced no validator exit change
applied to C3, before this integration.

Schema 2 is usable migration input. It still receives valid policy inspection and allow
warnings; needing an update alone is not a failure. Hook activation follows section 4.8
and the closed PQ1 decision. Runtime completeness follows section 4.9 and closed PQ2.

Schema 3 receives all applicable current checks. Structural validity alone does not suppress
a policy, permission or hook failure.

### 4.5 Installed policy and snippet state

Call `inspectSecurityState` with exactly:

```javascript
{
  policy: parsedInstalledPolicy,
  manifest: validatedManifestOrNull,
  baselinePolicy: shippedV2Policy,
  baselineSha256: normalizedHashOfShippedV2Policy,
  desiredPolicy: shippedCurrentPolicy,
  desiredSha256: normalizedHashOfShippedCurrentPolicy
}
```

Use `data/secret-paths-v2.0.0.json` and `data/secret-paths.json`.
Never compare project policy bytes directly with the current shipped policy.

Section 4.4 determines whether inspection runs. In particular, do not call it with
`policy:null` to diagnose an absent installed policy.

Append the returned rows unchanged and in order:

```text
pass / policy-managed
.ai/security-paths.json: managed patterns match installed baseline

fail / policy-managed
.ai/security-paths.json: managed patterns edited since install

info / policy-baseline
.ai/security-paths.json: installed baseline unknown

info / policy-version
.ai/security-paths.json: installed managed patterns are behind this skill

info / codex-snippet
Codex deny-read snippet has not been recorded

info / codex-snippet
Codex deny-read snippet is stale; render and review it again
```

Project-pattern detail remains:

```javascript
".ai/security-paths.json: projectPatterns " +
JSON.stringify(projectPatternIdentityKeys)
```

Identity keys come from C1's `policyEntryKey`, preserving project-pattern order.

Required outcomes:

- Recorded managed list unchanged: managed pass.
- Managed entry, metadata, order or count changed: managed fail.
- Older unchanged list missing a desired identity not explicitly omitted: pass, then behind.
- Exact omission covers the missing desired identity: no behind row.
- Unknown installed baseline: baseline info, not an invented edited/behind verdict.
- Valid project additions: project info, not managed drift.
- Missing snippet record: missing info.
- Matching snippet hash: no snippet row.
- Changed effective rendering: stale info.
- Invalid manifest: no inspection of its ownership or snippet fields.
- Invalid policy: no state-inspection success row.

Missing or invalid shipped inspection data gives:

```javascript
{level:"fail",check:"policy-baseline",
 detail:"Shipped policy inspection data is unavailable or invalid"}
```

Do not catch an unrelated programmer exception as a policy-schema issue.

### 4.6 R46 deny-anchor warnings

Inspect only shared `permissions.deny` strings.

A rule is managed only by exact membership in the validated keys-owned settings record's
`managed["permissions.deny"]`. Missing manifest or non-keys ownership supplies no managed
identities. An invalid manifest emits no deny-anchor rows.

For each user-owned `Read(...)` or `Edit(...)` occurrence:

- Ignore exception bodies beginning with `!`.
- Stay silent when the body begins with `**/`, `/`, `//` or `~/`.
- Otherwise append:

```javascript
{
  level:"warn",
  check:"deny-anchor",
  detail:"User deny " + JSON.stringify(rule) +
    " is relative to the session's working directory, " +
    "so it may not protect what it names"
}
```

Preserve settings order and duplicate occurrences. Do not rewrite rules.

`Read(env/**)` and `Edit(cert/*)` warn. The four anchored forms, managed exact identities,
exceptions and unrelated tools do not warn.

### 4.7 R53 allow reporting

Call C7's `inspectAllows` from `scripts/classify-allows.mjs` with exactly
`settings`, `managed`, `omissions`.

- Entire installed manifest must be valid before consuming ownership.
- Keys-owned settings use their validated managed/omission objects.
- Other ownership modes use `{}` for both.
- Missing settings use `{}`.
- Missing manifest uses `{}` metadata.
- Append `inspection.results` without alteration.
- Emit no pass for `other`.
- Emit LOCAL exactly once, including when settings are absent.
- Never read or classify personal settings.

Exact C7 strings remain:

```javascript
REPO(rule, owner) =
  "Shared " + owner + " allow " + JSON.stringify(rule) +
  " runs repository code without a prompt; move it to " +
  ".claude/settings.local.json if you accept this risk on your own machine.";

BROAD(rule, owner) =
  "Shared " + owner + " allow " + JSON.stringify(rule) +
  " permits arbitrary commands without a prompt; move it to " +
  ".claude/settings.local.json if you accept this risk on your own machine.";

LOCAL =
  ".claude/settings.local.json is personal and is not managed by project-setup; " +
  "permissions there do not protect the team.";
```

Rows:

- Repo code: `warn`, `allow-repo-code`, REPO.
- Managed broad: `fail`, `allow-broad`, BROAD.
- User broad: `warn`, `allow-broad`, BROAD.
- Last: `info`, `allow-local`, LOCAL.

Absent managed entries produce no active warning. Duplicates preserve occurrence order.

For unavailable classification, emit `fail/allow-input` and then LOCAL. Exact details:

```text
invalid .ai/manifest.json; allow ownership was not classified
invalid .claude/settings.json; shared allows were not classified
unsafe .claude/settings.json; shared allows were not classified
.claude/settings.json is protected; shared allows were not classified
cannot read .claude/settings.json; shared allows were not classified
```

Precedence is invalid manifest, unsafe settings, protected settings, read failure, invalid
JSON, then C7 pure validation failure. Pure failures retain their full prefixed message.

Managed broad allows fail validation in schema 2 as well as schema 3. A needs-update info
row is not an exemption from R53.

### 4.8 R73 installed self-test

Activation follows the maintainer's closed PQ1 = A decision of 2026-10-20.
The invocation and result contract below is fixed.

First matching row wins:

| Order | Condition | Action |
| --- | --- | --- |
| 1 | Valid schema-2 manifest | Schema-2 info; do not launch |
| 2 | Present invalid/unavailable manifest | Invalid-input info; do not launch |
| 3 | An activation signal is present | Require self-test; apply preconditions below |
| 4 | Settings or policy unavailable | Invalid-input info; do not launch |
| 5 | No activation signal | No-installation info; do not launch |

Activation signals are:

- Any one of these paths exists, including an unsafe existing path:

```text
.ai/tools/guard-raw-git-core.mjs
.ai/tools/guard-raw-git.mjs
.ai/tools/hooks-selftest.mjs
```

- Any of those paths has a record in a valid installed manifest.
- Shared settings contain the exact canonical nested command hook described below.
- The validated keys-owned settings record contains its canonical identity in:

```text
files[".claude/settings.json"].managed.hooks
```

An unrelated permissions-schema error does not make hook identity unavailable when the
settings body is a parsed object. Missing settings is an empty settings object for activation.
Unreadable, protected, unsafe, invalid JSON or a non-object settings root is unavailable.

Absent installed policy uses the shipped-default protection returned by `loadEffectivePolicy`
for activation and preconditions. That protection is known, so absence does not produce an
unsafe-or-protected self-test failure. The existing security-tooling failure still applies
when `.ai/agents` requires the missing policy. Malformed/unreadable policy is unavailable.

An activation signal wins over unavailable settings/policy at decision row 3. It requires a
self-test result, but unavailable protection state prevents launch and produces the
unsafe-or-protected precondition failure below. Invalid manifest still wins at row 2.

Execute the installed path, not the source asset:

```javascript
execute(
  absoluteNode,
  [path.join(absoluteProjectRoot, ".ai", "tools", "hooks-selftest.mjs")],
  {
    cwd:absoluteProjectRoot,
    env:process.env,
    shell:false,
    windowsHide:true,
    encoding:"utf8",
    timeout:20000,
    maxBuffer:65536
  }
)
```

Guard only the three hook paths listed above, in that order, with the effective protection
check and `readInRepo` before launch. The catalog check in section 4.9 owns the other four
runtime members. The hook core has no imports.

A protected, linked, missing or unreadable required hook member prevents launch.
For competing preconditions, unavailable policy or any unsafe/protected member wins over
missing/unreadable members. No guarded member body is read when policy protection is unknown.

Do not execute a command obtained from settings. Settings are inspected for identity only.

Exact successful stdout, including final LF:

```text
PASS  guard-raw-git/allowed
PASS  guard-raw-git/blocked
PASS  guard-raw-git/malformed
3 PASS / 0 FAIL
```

Require status 0, null signal, absent/null error, empty stderr and exactly those stdout bytes.
Reject empty output, extra output, CRLF substitution, truncation, wrong totals, reordered
lines, timeout, nonzero status, signal, throws and malformed result shapes.

Success row:

```javascript
{
  level:"pass",
  check:"hooks-selftest",
  detail:"Installed hook self-test passed; Claude hook loading is not verified"
}
```

Failure rows:

```javascript
// Required file missing or unreadable
{level:"fail",check:"hooks-selftest",
 detail:"Installed hook self-test is unavailable"}

// Unsafe/protected member or unavailable policy protection
{level:"fail",check:"hooks-selftest",
 detail:"Installed hook self-test was not run because a runtime path is unsafe or protected"}

// All launch/process/transcript failures
{level:"fail",check:"hooks-selftest",
 detail:"Installed hook self-test failed"}
```

Info rows from the activation table:

```javascript
// Decision row 1
{level:"info",check:"hooks-selftest",
 detail:"Schema 2 needs update; installed hook self-test was not run"}

// Decision row 2 or 4
{level:"info",check:"hooks-selftest",
 detail:"Invalid setup inputs prevented installed hook self-test"}

// Decision row 5
{level:"info",check:"hooks-selftest",
 detail:"No installed raw-Git hook was identified; installed hook self-test was not run"}
```

Child stdout/stderr and native errors never enter the report.

Set `runtimeEvidence.hookSelfTest` to:

- `passed` after exact execution success.
- `failed` after launch/process/transcript failure.
- `not-run` for precondition failures and every info row.

`claudeHookLoading` remains `not-verified` in every case.

A failed required precondition still fails validation even though execution was not run.

Canonical identity remains:

```javascript
{
  event:"PreToolUse",
  matcher:"Bash|PowerShell",
  command:'node "$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs"'
}
```

The shared-settings activation signal requires:

```javascript
settings.hooks.PreToolUse.some(group =>
  group.matcher === "Bash|PowerShell" &&
  Array.isArray(group.hooks) &&
  group.hooks.some(hook =>
    hook.type === "command" &&
    hook.command === 'node "$CLAUDE_PROJECT_DIR/.ai/tools/guard-raw-git.mjs"'
  )
)
```

Apply shape checks before property access. A nested non-command entry with the same command
string is not an activation signal.

Manifest metadata stores the three-field identity, not the nested settings representation.
Identity uses event, matcher and command together. Options are not identity.
Do not alter C6 merge behavior or claim that matching static identity proves host loading.

### 4.9 Catalog runtime-target validation

Missing-member severity follows the maintainer's closed PQ2 = A+ decision of 2026-10-20.

Read `data/runtime-units.json` and validate it with `readRuntimeUnits` from
`scripts/migrate-security-paths.mjs`. Do not duplicate its catalog schema.

After an installed-policy failure, emit no runtime-unit rows and do not inspect runtime
targets. The policy-schema fail already explains the unavailable protection state and gives
exit 1. This rule applies before catalog-target validation and is distinct from an absent
policy, for which shipped-default protection is known.

Catalog validation is active when any of these is true:

- `.ai/agents` exists.
- An installed policy exists.
- `.ai/tools` exists.
- A valid manifest records a catalog runtime target.

If none is true, emit no runtime-target rows.

A missing, unreadable, invalid JSON or rejected catalog produces exactly:

```javascript
{level:"fail",check:"runtime-catalog",
 detail:"Runtime catalog is unavailable or invalid"}
```

Do not inspect catalog-derived targets after that failure.

For a valid catalog, inspect every target in catalog order:

```text
.ai/tools/security-policy.mjs
.ai/tools/git-safe-core.mjs
.ai/tools/guard-raw-git-core.mjs
.ai/tools/review-diff.mjs
.ai/tools/git-safe.mjs
.ai/tools/guard-raw-git.mjs
.ai/tools/hooks-selftest.mjs
```

Use the effective protection check and `readInRepo`. Do not execute targets or compare them
with current shipped bytes. A readable regular file is a static presence check, not a claim
of reader behavior.

Exact per-target rows:

```javascript
// Present, regular, permitted and readable
{level:"pass",check:"runtime-unit",
 detail:"<target>: runtime member is present and readable"}

// Missing and recorded as installed in a valid manifest
{level:"fail",check:"runtime-unit",
 detail:"<target>: runtime member is missing; manifest records it as installed"}

// Missing, not recorded, with valid installed policy source schema 2
{level:"fail",check:"runtime-unit",
 detail:"<target>: runtime member is missing; installed policy schema 2 requires it"}

// Missing, not recorded, with source schema 1 or absent installed policy
{level:"info",check:"runtime-unit",
 detail:"<target>: runtime unit incomplete; needs update"}

// Unsafe or linked
{level:"fail",check:"runtime-unit",
 detail:"<target>: runtime member is unsafe"}

// Protected
{level:"fail",check:"runtime-unit",
 detail:"<target>: runtime member is protected; not read"}

// Other read/stat failure
{level:"fail",check:"runtime-unit",
 detail:"<target>: runtime member could not be read"}
```

The schema is the installed policy's `sourceSchema`, not the manifest schema.
A schema-1 policy adapted in memory to schema 2 still uses the needs-update outcome for
unrecorded missing members.

A target is recorded as installed when it is an own key of `files` in the entirely validated
manifest. Do not consume records from an invalid manifest.

Per-target precedence is unsafe/link, protection, missing, ordinary read failure, pass.
Within missing, recorded-as-installed failure wins over source-schema-2 failure, which wins
over needs-update info. Do not emit multiple runtime-unit rows for one target.

The existing drift warn remains when a valid manifest records a missing member:

```javascript
{level:"warn",check:"drift",
 detail:"<target>: in manifest but missing on disk"}
```

Both rows appear: the drift warn in existing section 5 precedes the runtime-unit fail in the
catalog section. The fail does not replace the warn.

Fixed security-tooling requirements remain separate: when `.ai/agents` exists, missing
git-safe still emits:

```javascript
{level:"fail",check:"security-tooling",
 detail:".ai/tools/git-safe.mjs missing; shared agents depend on it"}
```

That existing fail is retained even if the catalog row for the same missing target is info.
The policy-absence security-tooling fail is pinned in section 4.4.

Catalog failure does not substitute a hook-selftest result. The hook activation and three-file
preconditions remain independent.

The shipped `data/secret-paths.json` at `0585bad` is schema 1. C7-C9 do not change it.
Fresh S01 installations therefore also use schema 1; migrated schema-2 policies arise from
C3's migration flow.

Required fixture outcomes:

| Fixture | Outcome |
| --- | --- |
| R10/R30 unchanged stub fixture | One runtime pass, six update infos |
| R10 good case | Exit 0; no-installation hook info |
| R10 bad case | Exit 1 for existing JSON/TOML failures |
| R30 legacy-hook case | Exit 0; legacy warning and no-installation info |
| R30 malformed-permissions case | Exit 1; no-installation hook info remains |
| C2 v2base | Six runtime update infos; schema-2 hook info; exit 0 |
| C2 v3base with original schema-1 policy | Six runtime update infos; no-installation info; exit 0 |
| S01 fresh schema-1 setup | Seven runtime passes; executed hook success; exit 0 |
| Explicit schema-2 policy, no recorded/runtime members | Seven runtime fails; exit 1 |
| Fresh schema-1 setup with one recorded member deleted | Drift warn and runtime fail; exit 1 |

R10/R30 fixtures remain unchanged. The explicit schema-2 and recorded-deletion cases are
pinned in section 6.3.

## 5. Discovery and documentation

### 5.1 C9 discovery residual

Replace detect's broad template regex with exact root-name equality.

```javascript
envTemplates = visible.filter(p => p === ".env.example");

trackedSecretPaths =
  tracked.filter(p => isProtected(p) && p !== ".env.example");
```

No environment-template bodies are read.

Exact replacement warnings are the concatenated strings below:

```javascript
"secret-pattern files other than the root .env.example are TRACKED in git; " +
"stop and escalate before generating docs"

"root environment template is present; inspect it only via " +
"node <SKILL_DIR>/scripts/env-keys.mjs keys --template auto; " +
"agents must not open it directly"
```

The invocation-bearing warning contains no `.env` substring and uses C9's supported grammar.
It does not add a nonexistent `--project` option.

Retain their existing positions relative to other warnings.

Fixture inventory:

```text
.env.example
.env.sample
.env.template
nested/.env.example
nested/.env.sample
```

Expected `envTemplates` is exactly `[".env.example"]`.

Expected tracked-secret entries include the other four paths, in Git inventory order.
All five bodies remain unread. Existing C7 fields and warning ordering remain intact.

### 5.2 Exact documentation additions

Tests compare whitespace-normalized paragraphs within the named sections, except for the
explicit exact-line and exact-block checks below.

`SKILL.md`, Scripts table, exact complete lines:

```text
| `validate.mjs` | Static setup checks and installed hook self-test; exit 1 on any failure |
| `doctor.mjs` | Audit lane configuration and local diagnostics without a model session or sandbox probe |
```

`SKILL.md`, Phase 3, after the validation step:

> Validation uses the installed policy baseline and shared ownership schemas. Schema 2
> reports needs update. The installed hook self-test proves direct script behavior only;
> Claude hook loading remains not verified.

Then add:

> Run validation in a trusted checkout because the installed hook self-test executes project code.

Then add the C3 workflow-gate sentence:

> After migration, a schema-2 policy content change in a project with catalog tools, including
> a projectPatterns addition, still goes through migrate-security-paths.mjs and
> security-decisions.json. Validation reports project patterns and stale snippets; it does not
> bypass that reviewed migration workflow.

`SKILL.md`, Phase 4:

> Run doctor.mjs only with the worker's effective lane options. Its configuration and
> diagnostic results do not verify connector-tool absence or sandbox enforcement.

Replace C8's future-doctor paragraph in both:

- `README.md`, `## Review-lane launcher prerequisite`.
- `references/codex.md`, `### Review-lane launcher prerequisite`.

Exact replacement paragraph:

> The doctor is available as scripts/doctor.mjs. It audits these prerequisites without
> starting a model session or sandbox probe. See references/security.md, Doctor diagnostics,
> for its command and result scope. An unresolved prerequisite means the lane is not ready.

`references/security.md`, section 6:

> The doctor runs only codex mcp list --json with validated lane options, reads the newest
> permitted sandbox log and inventories Windows processes. It never starts a model session
> or sandbox probe, reads authentication or sandbox-secret files, kills processes or changes
> sandbox mode.

Include a `text` fenced block containing exactly one command line. Its line is the
concatenation below, with no inserted newline:

```javascript
"node <SKILL_DIR>/scripts/doctor.mjs --disable apps --disable plugins " +
"-c mcp_servers.node_repl.enabled=false -p review -C <project-root>"
```

The tests assert the fence label, one-line contents and exact command bytes.

Follow with:

> Supply only configuration-defined server names. The external launcher owns enumeration
> and must use the same directory, profile, configuration and disable options for the worker.
> An enabled server, failed command, invalid output or unresolved prerequisite means not ready.

Then:

> Exit 0 means the supplied configuration and available diagnostics passed these checks.
> It does not establish host negative capability. An absent or unreadable log and an
> unavailable Windows process inventory remain unknown and produce exit 1.

Then:

> A clean log means no recognized setup-refresh error was found in the newest readable log.
> It is historical diagnostic evidence, not a successful sandbox measurement.

Then:

> The report includes the selected log's modification time. An error in that log remains a
> failure until newer evidence is available. Resolve the underlying problem before retrying;
> the doctor does not delete logs or run a probe to create new evidence.

`references/security.md`, section 5:

> Keep static validation, direct installed-hook results, doctor diagnostics and live host
> evidence separate. Neither a passing self-test nor a ready doctor verifies Claude hook
> loading, connector-tool absence or sandbox enforcement.

Inside the existing unlabeled report fence, replace the validation subsection with this
exact block, immediately before `### Capability report`:

```text
### Validation (validate.mjs)
pass N / warn N / fail N; list every warn/fail and needs-update info.
Static setup results: <summary>.
Installed hook self-test: <passed / failed / not-run>.
Claude hook loading: <verified with scoped evidence / not verified>.

### Doctor diagnostics
Configuration and diagnostics: <ready / not ready / not run>.
Connector-tool absence and sandbox enforcement: <separate host evidence / not verified>.

```

The final blank line is part of the block boundary before `### Capability report`.
Compare this block exactly after normalizing only CRLF to LF.

Preserve C9's report sections and exact bullets.

### 5.3 Reserved setup-run reporting

Import and call C5's `validateRunId` from `scripts/lib.mjs`.

Filter `listDir(".ai/.run")` by excluding only names for which that helper throws an Error
with own `code === "RUN_ID_RESERVED"`. Preserve other names and their enumeration order,
including ordinary invalid-ID names that detect previously reported.

Do not copy the reserved-name regex or turn this change into general run-ID validation.
Do not read the contents of excluded directories.

Given this ordered listing:

```javascript
[
  "run-0001", "review", "REVIEW", "Review", "review.",
  "review ", "review. .", "review...", "review-1", "abc"
]
```

Expected `ai.runs` is exactly:

```javascript
["run-0001", "review-1", "abc"]
```

Run the alias matrix through a Node preload following the C3 makeGuard/C5 preload pattern.
Stub `fs.readdirSync` only when its path is the scratch project's absolute `.ai/.run` path;
return the literal ordered listing above for that call. Delegate every other call to the
original function. Synchronize built-in ESM exports after installing the stub.

This avoids creating case-colliding or trailing-dot/space names on Windows.
The real discovery fixture containing `run-0001` and `review` runs without this stub.
It must report `["run-0001"]` and never read a sentinel inside `review`.

## 6. Tests

### 6.1 Registration

`tests/c10.test.mjs` exports exactly a frozen `C10_IMPLEMENTATIONS` list.
Each entry has `id` and `run(context)`. Each run returns:

```javascript
{failures: string[], skipped: null}
```

Production modules are imported lazily inside assertion functions. Missing exports or files
fail assertions rather than breaking registry import.

`COMPONENT_ASSERTIONS.C10` contains independent literal descriptors in this order:

| ID | Exact name |
| --- | --- |
| `N8-doctor/C10/arguments` | `doctor accepts only documented lane options` |
| `N8-doctor/C10/entrypoints` | `doctor resolves native and Windows npm entrypoints` |
| `N8-doctor/C10/context` | `doctor preserves the effective lane context` |
| `N8-doctor/C10/configuration` | `doctor reports exact MCP readiness outcomes` |
| `N8-doctor/C10/logs` | `doctor reports the newest permitted sandbox log` |
| `N8-doctor/C10/processes` | `doctor reports Desktop and cua_node processes` |
| `N8-doctor/C10/negative-actions` | `doctor performs no model probe or remediation action` |
| `N8-doctor/C10/cli` | `doctor CLI streams and exits are exact` |
| `R46/C10/anchors` | `validation warns only on unanchored user denies` |
| `R49/C10/policy` | `validation compares managed policy with installed state` |
| `R53/C10/reporting` | `validation preserves allow classifier rows and severity` |
| `R73/C10/selftest` | `validation requires exact installed hook evidence` |
| `R79/C10/schemas` | `validation uses shared schemas before consuming ownership` |
| `R79/C10/runtime-unit` | `validation checks every catalog runtime target` |
| `R81/C10/baseline` | `older installed policy is behind rather than edited` |
| `R82/C10/snippet` | `validation reports stale snippet state without user config access` |
| `V2/C10/schema2` | `schema 2 reports needs update without a schema failure` |
| `V2/C10/discovery` | `discovery recognizes only the root environment template` |
| `V2/C10/run-inventory` | `discovery excludes reserved review-artifact directories` |
| `V2/C10/contracts` | `C10 exports documentation and evidence boundaries are exact` |

`COMPONENT_IMPLEMENTATIONS.C10` contains those implementations in the same order.

No C10 test emits a complete `PASS  R46  `, `PASS  R73  ` or other numbered-case record.

### 6.2 Doctor fixture corpus

`doctor-cases.json` has:

```javascript
{
  schema:1,
  argumentCases:[],
  configurationCases:[],
  logCases:[],
  processCases:[]
}
```

Each case has a unique `id`, literal input and literal expected result.
Expected diagnostics must not be imported from production code.

Required argument cases:

- Empty argv.
- Each accepted option and alias.
- Full accepted vector from section 3.4.
- Both aliases together for profile/directory.
- Duplicate feature/server.
- Missing values, unknown options, positional commands and attached forms.
- Every literal rejection example in section 3.2.
- Invalid profile before a later unknown option; profile error wins.
- Invalid profile before a later control-bearing token; control error wins.
- Dot, quote, assignment, whitespace and control injection in server identifiers.
- C0, DEL, C1, U+2028 and U+2029 controls.
- Invalid/empty/overlong profile.
- Spaces, escaped non-ASCII, punctuation and literal quotes in directory values.
- Windows drive-relative and absolute-directory cases, independent of synthetic platform.
- Input arrays remain byte-for-byte unchanged.

Required configuration cases, using the complete section-3.8 report:

- `[]`: ready when all other reference checks pass.
- One disabled covered server: ready.
- Multiple covered servers: preserve CLI order.
- Enabled server: `DOCTOR_ENABLED`, exit 1.
- Disabled uncovered server: `DOCTOR_CONFIGURATION`, exit 1.
- Every literal process-result failure in section 3.3: `DOCTOR_CLI`, exit 1.
- Throw and rejected promise: `DOCTOR_CLI`, exit 1.
- Empty output, banner, object root, wrong field types and duplicate name:
  `DOCTOR_OUTPUT`, exit 1.
- Credential-like fields in otherwise valid JSON: omitted from all output.
- Invalid directory and missing flags: exact not-run rows and no Codex execution.
- Unsupported npm shim: exact entrypoint failure and no shim execution.

Entrypoint tests assert complete executable, argv and options for native Windows, POSIX,
and npm paths. Repeat accepted profile/directory aliases through the npm path.
A shim-body read recorder must remain empty.

Environment/path fixtures include:

- Windows `Path` and `SystemRoot`.
- Windows `PATH` and `SYSTEMROOT`.
- Duplicate `Path`/`PATH` keys with conflicting values; first insertion wins.
- Duplicate CODEX_HOME spellings; first insertion wins.
- Windows PATH separated by `;`.
- POSIX PATH separated by `:`, resolved with `path.posix` on the Windows test host.
- Relative effective directory reported using resolve, not a realpath alias.
- A linked trusted npm installation whose final entrypoint is a regular file.

Log cases:

- Two logs with different mtimes; only newest body read.
- Equal mtimes; descending-basename tie break.
- Missing directory and empty directory.
- Enumeration, stat and read failures.
- Invalid candidate mtime.
- Linked directory/file, nonregular file and oversized selected file.
- Clean log.
- Two setup-refresh errors; only the first exact line reported.
- Earlier unrelated error followed by setup-refresh error.
- Error lines of exactly 1024 and 1025 code units; exact truncation marker.
- Exact selected ISO mtime in clean, error and selected-unreadable reports.
- Newest unreadable with readable older log; no fallback.
- Auth and sandbox-secret sentinels never enumerated or read.

Process cases:

- Empty valid inventory.
- Unrelated native `codex.exe` outside the Desktop package.
- Desktop package executable with no visible window.
- Arbitrary helper executable under that package.
- `cua_node` runtime executable.
- Both kinds, sorted by pid.
- Relevant null executable path.
- Malformed JSON, bad fields and process failure.
- Exact UTF-8 prefix and 15000 ms timeout.
- Non-Windows: no inventory process invocation.

Negative-action recorder permits only the exact MCP and inventory operations.
It fails on writes, subprocess deviations, process termination, authentication reads,
sandbox-secret reads, a model command or a probe.

Timeout termination performed by the configured executor on the doctor's own child is
permitted. It is not a remediation action against a Desktop or unrelated process.
The doctor never calls a separate kill command.

Doctor CLI subprocess tests cover only exit-2 parse failures and import safety.
Include the junctioned `["--help"]` launch from section 2.4.
No doctor CLI test resolves a real codex, reads a real CODEX_HOME or runs live inventory.
All exit-0/exit-1 outcomes and their complete streams are proven in-process through `main`
with all diagnostic dependencies supplied.

### 6.3 Validation cases and exact expectations

Use small scratch repositories and in-process `main` calls. Fixture manifests are literal
valid C2 schema-2/schema-3 objects, with independently computed fixture hashes.

- **R46:** all four anchored forms, two unanchored forms, exceptions, duplicates,
  exact managed membership and invalid manifest producing zero deny-anchor rows.
- **R49:** unchanged recorded list, altered glob, altered entry metadata, deletion,
  reordering and valid project additions. Assert the exact section-4.5 rows and exits.
- **R53:** managed/user repo-code, managed/user broad, other, duplicate rules, absent
  managed identity, omissions, missing settings and invalid ownership. Assert C7's exact
  rows, order, one LOCAL and exit 1 only when a fail row exists.
- **R73:** exact success, silent hook, malformed hook, missing self-test, launch failure,
  timeout, wrong stdout, nonempty stderr, signal and unsafe/protected hook paths.
  Assert exact row, evidence state and exit, including the activation cases below.
- **R79 schemas:** valid policy metadata and composite hook identities; wrong-file metadata,
  malformed manifest, invalid manifest keys, malformed policy and unsupported schema.
  Assert shared issue text. Read recorders prove invalid manifest paths and protected
  content are not traversed.
- **R79 runtime unit:** every catalog target, including review-diff; missing member under
  policy source schemas 1 and 2; missing recorded member regardless of policy schema;
  missing git-safe's retained security-tooling fail; linked/protected/unreadable member;
  invalid catalog; no runtime rows after policy failure; exact catalog order.
- **R81:** older unchanged list gives pass plus behind; edited list gives fail without
  behind; exact omission suppresses behind; unknown baseline produces info only.
- **R82:** missing, matching and stale hashes; project-pattern change changes the expected
  snippet hash. Assert no user-config read/write and no runtime-verification claim.
- **Schema 2:** pass immediately followed by needs-update info; policy/allow rows remain
  applicable; info is excluded from totals; malformed schema 2 never gets needs-update.
- **Discovery:** section-5.1 inventory and warnings, no environment-file reads, C7 output
  unaffected.
- **Run inventory:** section-5.3 exact alias-list output and a real `review` sentinel.
- **Contracts:** exact exports, import safety, direct-entry behavior, root establishment,
  CLI grammar, JSON key order, documentation, unchanged runtime catalog and no nested
  numbered-case records.

Policy absence/malformed/unreadable tests assert the section-4.4 row table.
In particular, policy absence with `.ai/agents` emits its security-tooling fail and no
policy-state rows. Malformed policy exits 1 and denies candidate body reads, while the fixed
manifest remains readable.

For schema 3, use a current policy, matching recorded managed entries, matching snippet hash
and a valid hook fixture. Expected newly integrated successful rows, with catalog rows
expanded literally in the test, are:

```javascript
[
  {level:"pass",check:"policy-schema",detail:".ai/security-paths.json"},

  // Seven rows in section-4.9 catalog order:
  // {level:"pass",check:"runtime-unit",
  //  detail:"<target>: runtime member is present and readable"},

  {level:"pass",check:"policy-managed",
   detail:".ai/security-paths.json: managed patterns match installed baseline"},
  {level:"info",check:"allow-local",detail:LOCAL},
  {level:"pass",check:"hooks-selftest",
   detail:"Installed hook self-test passed; Claude hook loading is not verified"}
]
```

The policy-schema row follows settings and manifest JSON rows. Catalog rows occupy their
section-4.3 position after existing security-tooling checks.

No stale, behind, needs-update or `other` pass row is permitted.

The complete report also contains the preserved baseline validation rows appropriate to the
fixture. Tests compute summary counts from a literal expected row list, never from the
implementation's returned summary.

#### Literal catalog cases

The schema-2 missing-runtime case writes this literal policy, with the shipped entries and
their explicit anchors. Do not derive it by calling a production migration or renderer.

```javascript
{
  schema:2,
  patterns:[
    {
      glob:"**/.env*",
      anchor:"any",
      kind:"env",
      note:"Includes .env.example. Agents never read any .env* file; " +
        "scripts/env-keys.mjs extracts key NAMES only."
    },
    {glob:"**/*.pem",anchor:"any",kind:"key"},
    {glob:"**/*.key",anchor:"any",kind:"key"},
    {glob:"**/*.p12",anchor:"any",kind:"key"},
    {glob:"**/*.pfx",anchor:"any",kind:"key"},
    {glob:"**/*.crt",anchor:"any",kind:"cert"},
    {glob:"**/*.cer",anchor:"any",kind:"cert"},
    {glob:"**/*.cert",anchor:"any",kind:"cert"},
    {glob:"**/*.jks",anchor:"any",kind:"key"},
    {glob:"**/*.keystore",anchor:"any",kind:"key"},
    {glob:"**/id_rsa*",anchor:"any",kind:"key"},
    {glob:"**/id_ed25519*",anchor:"any",kind:"key"},
    {glob:"**/secrets/**",anchor:"any",kind:"dir"},
    {glob:"**/credentials/**",anchor:"any",kind:"dir"},
    {glob:"**/.aws/**",anchor:"any",kind:"dir"},
    {glob:"**/.ssh/**",anchor:"any",kind:"dir"},
    {glob:"**/.gnupg/**",anchor:"any",kind:"dir"},
    {
      glob:"**/.npmrc",
      anchor:"any",
      kind:"token",
      note:"Often holds registry auth tokens."
    },
    {glob:"**/.htpasswd",anchor:"any",kind:"credential"},
    {
      glob:"**/.ai/.run/*/vault/**",
      anchor:"any",
      kind:"staging",
      note:"Script-only area: backups and merged .env.example may contain real values. " +
        "Agents never read it."
    }
  ],
  projectPatterns:[],
  codexGlobScanMaxDepth:6
}
```

There is no manifest, no `.ai/agents` and no runtime file. The fixture `.gitignore` contains
both existing hygiene entries. Expected runtime-unit rows are exactly:

```javascript
[
  {level:"fail",check:"runtime-unit",
   detail:".ai/tools/security-policy.mjs: runtime member is missing; " +
     "installed policy schema 2 requires it"},
  {level:"fail",check:"runtime-unit",
   detail:".ai/tools/git-safe-core.mjs: runtime member is missing; " +
     "installed policy schema 2 requires it"},
  {level:"fail",check:"runtime-unit",
   detail:".ai/tools/guard-raw-git-core.mjs: runtime member is missing; " +
     "installed policy schema 2 requires it"},
  {level:"fail",check:"runtime-unit",
   detail:".ai/tools/review-diff.mjs: runtime member is missing; " +
     "installed policy schema 2 requires it"},
  {level:"fail",check:"runtime-unit",
   detail:".ai/tools/git-safe.mjs: runtime member is missing; " +
     "installed policy schema 2 requires it"},
  {level:"fail",check:"runtime-unit",
   detail:".ai/tools/guard-raw-git.mjs: runtime member is missing; " +
     "installed policy schema 2 requires it"},
  {level:"fail",check:"runtime-unit",
   detail:".ai/tools/hooks-selftest.mjs: runtime member is missing; " +
     "installed policy schema 2 requires it"}
]
```

Require exactly seven fail rows in the complete report, exit 1 and empty stderr.
The no-installation hook info does not override these failures.

For policy failure, write this literal installed policy:

```javascript
{schema:99,patterns:[]}
```

Also write this valid fixed manifest:

```javascript
{
  schema:3,
  skill:"project-setup",
  skillVersion:"3.0.0-rc.1",
  mode:"fresh",
  agents:[],
  sourceCommit:null,
  files:{}
}
```

No runtime file or shared settings exists. Require the manifest json-schema pass and exactly
this policy-schema row:

```javascript
{
  level:"fail",
  check:"policy-schema",
  detail:".ai/security-paths.json: POLICY_SCHEMA: policy.schema must be 1 or 2"
}
```

Require zero runtime-unit rows, zero runtime-target body reads, the invalid-input hook info,
`hookSelfTest:"not-run"`, `claudeHookLoading:"not-verified"`, exit 1 and empty stderr.
The manifest must not receive a validation-protected row.

For recorded deletion, construct a fresh schema-1 installation with all seven runtime assets
and a valid schema-3 manifest recording their installed full-ownership hashes. Use the actual
shipped schema-1 policy and independently compute fixture hashes. Delete only
`.ai/tools/review-diff.mjs`; preserve its manifest record.

The executor seam returns the exact successful hook transcript, so the missing review helper
is the sole runtime failure and does not conflate catalog and hook preconditions.

The report filtered to `drift` and `runtime-unit` must be exactly:

```javascript
[
  {level:"warn",check:"drift",
   detail:".ai/tools/review-diff.mjs: in manifest but missing on disk"},
  {level:"pass",check:"runtime-unit",
   detail:".ai/tools/security-policy.mjs: runtime member is present and readable"},
  {level:"pass",check:"runtime-unit",
   detail:".ai/tools/git-safe-core.mjs: runtime member is present and readable"},
  {level:"pass",check:"runtime-unit",
   detail:".ai/tools/guard-raw-git-core.mjs: runtime member is present and readable"},
  {level:"fail",check:"runtime-unit",
   detail:".ai/tools/review-diff.mjs: runtime member is missing; " +
     "manifest records it as installed"},
  {level:"pass",check:"runtime-unit",
   detail:".ai/tools/git-safe.mjs: runtime member is present and readable"},
  {level:"pass",check:"runtime-unit",
   detail:".ai/tools/guard-raw-git.mjs: runtime member is present and readable"},
  {level:"pass",check:"runtime-unit",
   detail:".ai/tools/hooks-selftest.mjs: runtime member is present and readable"}
]
```

Require exactly one fail in the complete report, the hook success row,
`hookSelfTest:"passed"`, `claudeHookLoading:"not-verified"`, exit 1 and empty stderr.

#### Hook activation cases

Use an otherwise valid schema-1 policy fixture so unrecorded missing unrelated catalog members
produce info rather than independently failing. No source policy or manifest is synthesized
from production output.

Each of these six independent cases requires activation:

1. Only `guard-raw-git-core.mjs` exists.
2. Only `guard-raw-git.mjs` exists.
3. Only `hooks-selftest.mjs` exists.
4. A valid manifest records a hook asset, but no hook asset exists.
5. Settings contain the canonical nested command identity, but no hook asset exists.
6. Valid keys-owned settings metadata contains the canonical managed identity, but no asset exists.

Each produces exactly the unavailable hook fail row, `hookSelfTest:"not-run"`,
`claudeHookLoading:"not-verified"`, zero self-test launches and validation exit 1.
Case 4 also receives the recorded-member runtime fail and existing drift warn from section 4.9.

Additional exact cases:

| Input | Hook row | Hook evidence | Exit |
| --- | --- | --- | --- |
| Valid schema 2, no assets | Schema-2 info | not-run | 0 |
| Valid schema 2, all three assets present | Schema-2 info | not-run | 0 |
| Invalid manifest, assets present | Invalid-input info | not-run | 1 |
| Invalid manifest, no assets | Invalid-input info | not-run | 1 |
| Invalid settings JSON, no signal | Invalid-input info | not-run | 1 |
| Protected/unreadable settings, no signal | Invalid-input info | not-run | 1 |
| Malformed/unreadable policy, no signal | Invalid-input info | not-run | 1 |
| No signal and usable inputs | No-installation info | not-run | 0 |
| Non-command nested type, otherwise same identity | No-installation info | not-run | 0 |
| Signal present, malformed/unreadable policy | Unsafe/protected hook fail | not-run | 1 |
| Absent policy, seven assets, no `.ai/agents` | Hook pass | passed | 0 |
| Absent policy, seven assets, `.ai/agents` present | Hook pass | passed | 1 |
| Three valid hook assets, exact success | Hook pass | passed | 0 |
| Three valid hook assets, silent guard | Hook failed row | failed | 1 |

These exit expectations assume the stated otherwise-valid fixture. The schema-2 partial-apply
case keeps a schema-1 installed policy and valid manifest records, so catalog checks do not
introduce an unrelated failure.

The two absent-policy cases use shipped-default protection and an exact successful executor
result. The `.ai/agents` case's exit 1 comes from the exact missing-policy security-tooling row,
not an unsafe-or-protected hook result.

Repeat the signal-present malformed-policy case both without a manifest and with the valid
literal schema-3 manifest above. Both produce the unsafe/protected hook fail and not-run
evidence. With the valid manifest, its json-schema pass remains; no manifest protection
failure is introduced.

The invalid-input cases retain their independently required schema/read/allow failures.
No info row removes those failures.

The two real self-test runs are:

- The installed success fixture using the three trusted hook files.
- The same fixture with `guard-raw-git.mjs` replaced by a silent exit-0 script.

The latter must make validate fail even though the hook permits every input silently.
Other transcript and executor cases use seams.

#### Direct-entry case

Launch validate through a junction to the skill directory. Use a scratch project containing
only a `.gitignore` whose body ignores `.claude/settings.local.json` and `CLAUDE.local.md`.

Expected complete report:

```javascript
{
  ok:true,
  summary:{pass:1,warn:0,fail:0},
  results:[
    {level:"pass",check:"secret-shaped-content",
     detail:"0 generated files scanned (pattern-based; not a guarantee)"},
    {level:"info",check:"allow-local",detail:LOCAL},
    {level:"info",check:"hooks-selftest",
     detail:"No installed raw-Git hook was identified; installed hook self-test was not run"}
  ],
  runtimeEvidence:{
    hookSelfTest:"not-run",
    claudeHookLoading:"not-verified"
  }
}
```

Require `J(report)`, empty stderr and exit 0. Empty stdout fails the assertion.
The same fixture through the ordinary path must produce identical output.

Separately pass a junctioned project root through the root seam. Require rejection with
`VALIDATE_OPTIONS` and the exact section-4.1 message, no report, no stream output and no
executor calls. This differs from launching the script through a junctioned skill directory.

Call in-process `main` sequentially on two distinct scratch roots and then on the first root
again. Each report must describe its supplied root's fixture, proving each call reestablishes
the module-global anchor instead of inheriting the preceding call's root.

### 6.4 Existing expectation changes

Tests-lane edits:

1. **C2 schema-2 validation:** remove the assertion that the entire report contains exactly
   one info row. Require exactly one `manifest-version` info row immediately after the
   manifest pass. Independently assert additional C3/C7, catalog and schema-2 hook rows,
   plus summary arithmetic.
2. **C2 schema-3 validation:** preserve the absence of a manifest-version row. Its existing
   v3base with schema-1 policy gains six runtime needs-update infos and the no-installation
   hook info. Exit 0 and summary consistency remain under the closed PQ1/PQ2 decisions.
3. **C3 validation handoff:** replace the temporary assertion prohibiting
   `inspectSecurityState` rows. Its depth-only policy edit still exits 0, emits managed
   pass, behind when applicable, and missing-snippet info. It must not emit the obsolete
   `differs from this skill version` text.
4. **C3 discovery:** change the broad environment-template exclusion expectation to exact
   root `.env.example`. Other protected names remain reported.
5. **R29:** aggregate C10 once after C9, with no nested PASS lines.
6. **C8:** within `A5-templates/C8/launcher`, replace the future-doctor paragraph expectation
   with section 5.2's exact available-doctor paragraph in both files. Retain all other
   launcher and host-evidence checks.
7. **C9:** within `R67/C9/commands`, replace the preserved old detect regex occurrence
   with the exact substring `p === ".env.example"` as a filename-literal, non-command
   control. The new invocation warning must pass C9's command rules unchanged.
   Preserve the existing validate RULES regex control byte-for-byte.
8. **C1, C4-C7 and C11a:** no C10 expectation changes.
9. **Baseline R16/S01:** preserve IDs and names. S01 now launches the real installed
   self-test and requires its pass row. New info or warning rows do not change R16's
   success criteria. Unrelated legacy hooks do not activate the installed raw-Git test.

Required existing totals:

```text
Baseline: 59 PASS / 0 FAIL / 1 SKIP
C11a:      8 PASS / 0 FAIL / 0 SKIP
C1:       12 PASS / 0 FAIL / 0 SKIP
C2:       14 PASS / 0 FAIL / 0 SKIP
C3:       18 PASS / 0 FAIL / 0 SKIP
C4:       17 PASS / 0 FAIL / 0 SKIP
C5:       18 PASS / 0 FAIL / 0 SKIP
C6:       12 PASS / 0 FAIL / 0 SKIP
C7:       12 PASS / 0 FAIL / 0 SKIP
C8:       16 PASS / 0 FAIL / 0 SKIP
C9:       12 PASS / 0 FAIL / 0 SKIP
C10:      20 PASS / 0 FAIL / 0 SKIP
```

R13d remains the baseline Windows skip. Preserve the final baseline envelope:

```javascript
{env,summary:{passed:59,failed:0,skipped:1},resultsFile}
```

### 6.5 Cost

Argument, report, configuration, log, process, catalog and activation matrices run in-process
through seams.

Budget approximately:

- 5 doctor CLI/import checks, restricted to parse failures and import safety, including
  the junctioned parse-failure launch.
- 5 validator CLI/import checks, including the junction launch.
- 2 real installed self-test runs, each with three hook children.
- 3 detect CLI runs, including reserved-run discovery.
- Small Git fixture initialization/inventory calls.

Target: 25-40 total child processes and roughly 20-50 seconds on the Windows host,
excluding existing suites. These are estimates, not timing assertions.

R29 runs all C10 assertions again inside `run-tests.mjs`. Running C10 independently and then
the baseline therefore roughly doubles C10's contribution. Baseline S01 additionally launches
one self-test plus its three hook children, four extra processes.

No real Codex, model session, host sandbox probe or live Desktop inventory is part of
automated component acceptance.

## 7. Edge cases and runnable acceptance

### 7.1 Architecture section-5 mapping

| Frozen edge | Coverage |
| --- | --- |
| Unsupported/injected/malformed options | arguments |
| Unsupported Windows shim | entrypoints |
| Shell interpretation, model or probe | entrypoints, negative-actions |
| Invalid/enabled output and wrong context | configuration, context |
| Tray processes and unavailable inventory | processes |
| Newest/missing/unreadable/error log | logs |
| Auth access, process termination or fallback | negative-actions |
| Unknown reported as verified | configuration, logs, processes, contracts |

Additional consumed-contract coverage:

| Obligation | Coverage |
| --- | --- |
| Every catalog runtime target | runtime-unit |
| Schema-1 versus schema-2 policy completeness | runtime-unit |
| Missing recorded runtime member | runtime-unit |
| Reserved review aliases absent from setup runs | run-inventory |
| Alternate validator launch path | contracts |
| Alternate doctor launch path | cli |
| Hook activation and partial installations | selftest |
| C9 command and preserved-occurrence compatibility | discovery, contracts |

### 7.2 C10 command

After C7-C9 land:

```text
node project-setup/tests/run-component-tests.mjs --component C10
```

Exact stdout records:

```text
PASS  N8-doctor/C10/arguments  doctor accepts only documented lane options
PASS  N8-doctor/C10/entrypoints  doctor resolves native and Windows npm entrypoints
PASS  N8-doctor/C10/context  doctor preserves the effective lane context
PASS  N8-doctor/C10/configuration  doctor reports exact MCP readiness outcomes
PASS  N8-doctor/C10/logs  doctor reports the newest permitted sandbox log
PASS  N8-doctor/C10/processes  doctor reports Desktop and cua_node processes
PASS  N8-doctor/C10/negative-actions  doctor performs no model probe or remediation action
PASS  N8-doctor/C10/cli  doctor CLI streams and exits are exact
PASS  R46/C10/anchors  validation warns only on unanchored user denies
PASS  R49/C10/policy  validation compares managed policy with installed state
PASS  R53/C10/reporting  validation preserves allow classifier rows and severity
PASS  R73/C10/selftest  validation requires exact installed hook evidence
PASS  R79/C10/schemas  validation uses shared schemas before consuming ownership
PASS  R79/C10/runtime-unit  validation checks every catalog runtime target
PASS  R81/C10/baseline  older installed policy is behind rather than edited
PASS  R82/C10/snippet  validation reports stale snippet state without user config access
PASS  V2/C10/schema2  schema 2 reports needs update without a schema failure
PASS  V2/C10/discovery  discovery recognizes only the root environment template
PASS  V2/C10/run-inventory  discovery excludes reserved review-artifact directories
PASS  V2/C10/contracts  C10 exports documentation and evidence boundaries are exact
20 PASS / 0 FAIL / 0 SKIP
RESULTS  <absolute evidence path>
```

Exit 0; empty stderr. The final path is the generated absolute component-results path.

Regression commands:

```text
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
node project-setup/tests/run-tests.mjs
```

Each component retains its frozen PASS records, stated total and RESULTS line.
No release tag, installed user skill, network service or real Codex invocation is required.

## 8. Rollback and accepted residual risks

### 8.1 Rollback

C10 changes no project migration format and writes no project state.

If C11b fails:

1. Revert dependent C11b integration before removing C10 exports.
2. Revert C10 production, documentation, fixture, registration and earlier-test amendments
   together.
3. Preserve C1-C9 contracts and the seven-member runtime catalog.
4. Restore the pre-C10 C2/C3/C8/C9 and baseline expectations with the implementation revert.

Do not roll back project policy or retired allows merely because diagnostic code is reverted.

If a user has separately applied an rc.1 setup transaction, its rollback remains:

```text
node <SKILL_DIR>/scripts/apply.mjs rollback --run-id <id>
```

Use rc.1 tooling before reverting the installed skill. Later user edits remain protected by
the existing journal guards. Reverting the skill alone does not downgrade a schema-3 project.

C11b depends on C10's exports, component records, doctor CLI and validation report contract.

### 8.2 Accepted residuals

- Synthetic fixtures establish doctor behavior, not host negative capability.
- The default (unseamed) doctor wiring is not exercised end to end in C10.
- A later launcher can use different options. The doctor cannot authenticate that future launch.
- Codex CLI internals may read their own configuration or authentication state. C10 verifies
  its own direct reads and argv, not undocumented internals of the installed executable.
- The `codex mcp list --json` array schema with `name` and `enabled` is assumed from the
  design contract. A different host schema fails closed as `DOCTOR_OUTPUT`.
- Acceptance of `-p` and `-C` before `mcp` is a host fact. A host that rejects that placement
  fails closed as `DOCTOR_CLI`.
- PATH and installed Codex code are trusted local inputs; no binary-signature verifier is added.
- A WindowsApps execution alias can be the first PATH candidate and stop resolution.
  The doctor does not silently switch installations after that failure.
- Timeout termination can stop the npm Node wrapper while leaving a Codex grandchild alive.
  No process-tree termination or unrelated-process cleanup is added.
- Package/runtime process matching follows the documented Windows layout. A future renamed
  package, inaccessible unrelated helper path or portable Desktop layout can evade that match.
- A non-elevated CIM query can receive null ExecutablePath for processes owned by Codex's
  elevated sandbox users. A relevant Codex process name then makes inventory unavailable,
  including while another Codex sandbox is running.
- A clean historical log is not evidence that a current sandbox operation succeeds.
- The setup-refresh matcher is lexical and can conservatively flag a line mentioning errors.
- Historical setup-refresh errors remain failures until newer evidence exists.
- Error lines are bounded at 1024 code units plus the explicit truncation marker.
- A selected oversized log is unknown rather than partially inspected.
- Filesystem races remain possible between checks and reads. No new general filesystem
  isolation layer is introduced.
- `lib.mjs` keeps a process-global root. Every validation call establishes its own root,
  but tests and other in-process callers must not depend on root state surviving across calls.
- The installed hook executes trusted project code. Its transcript proves the fixed direct
  cases, not that Claude loaded or invoked the hook.
- Under the closed PQ1 decision, schema 2 with hook assets present after a partial apply is
  not self-tested until rollback or update. Existing transaction recovery remains necessary.
- Static catalog presence does not authenticate runtime bytes or prove their behavior.
- Static allow classification retains C7's documented lexical limits.
- Policy/path controls retain C1/C5's Unicode, alias and copied-content limitations.
- C11b still owns installed-payload and complete numbered-case acceptance.

## 9. Plan questions

No plan question is open.

### PQ1. Installed hook self-test activation

Closed by the maintainer on 2026-10-20: option A.

The adopted ordered decision table is in section 4.8. First match wins:

1. Valid schema 2: schema-2 info, no launch.
2. Invalid/unavailable present manifest: invalid-input info, no launch.
3. Activation signal: require self-test subject to its preconditions.
4. Settings or policy unavailable: invalid-input info, no launch.
5. No signal: no-installation info, no launch.

The manifest is a fixed control exempt from name protection, still subject to `readInRepo`
link and containment checks. An absent installed policy uses known shipped-default protection;
its absence is not an unsafe-or-protected self-test failure.

Exact info rows, activation locations, nested `type:"command"` requirement, evidence states
and per-signal tests are pinned in sections 4.8 and 6.3.

Effects:

- C2 v2base gains the schema-2 hook info.
- C2 v3base gains the no-installation hook info.
- Unchanged R10/R30 fixtures gain the no-installation hook info.
- S01 executes the installed self-test and must pass.
- Invalid manifest wins even when an asset exists.
- Schema-2 partial-apply assets do not override the first table row.

Real schema-3 projects can lack newer hook assets: C6's complete-unit contract does not force
runtime upgrades for unrelated plans. This is not only a fixture concern.

### PQ2. Missing runtime-member severity

Closed by the maintainer on 2026-10-20: option A+.

The adopted rules are in section 4.9:

- A missing member recorded as installed in a valid manifest fails, whatever the policy schema.
- Otherwise, valid installed policy source schema 2 makes missing catalog members fail.
- Otherwise, missing members produce `runtime unit incomplete; needs update` info.
- Existing missing git-safe security-tooling failure remains.
- Linked, protected and unreadable members fail independently of policy age.
- Manifest schema alone does not force a complete runtime upgrade.
- After policy failure, emit no runtime-unit rows; the policy-schema failure explains the state.
- A recorded missing member retains both its earlier drift warn and its later runtime fail.

The shipped policy and unchanged R10/R30 fixtures are schema 1. Fresh S01 setup is also
schema 1. Schema-2 policy coverage uses the explicit literal fixture in section 6.3.
The recorded-deletion case separately proves damage to a fresh schema-1 installation fails.

This decision does not weaken C4's transaction gate: runtime-changing plans still require the
complete reviewed unit. It controls validation reporting for existing installations only.

PQ1 remains independent: an identified hook installation can require self-test even when
missing unrecorded unrelated runtime members are informational. Conversely, schema-2 manifest
reporting can skip self-test while a schema-2 installed policy or a missing recorded member
independently fails catalog completeness.

## Addendum at freeze: plan-critique round 3, C10-P3-1 to C10-P3-3 (NON-BLOCKING)

Added by the orchestrator when freezing, with the maintainer's approval (2026-10-20). Where an
item and an earlier section differ, the item wins.

- C10-P3-1. Reserved-run readdir stub matching (section 5.3). Stub `fs.readdirSync` only when the
  requested path, resolved with `fs.realpathSync.native` (falling back to `path.resolve`) and
  case-folded on win32, equals the scratch project's `.ai/.run` path canonicalized the same way.
  Delegate every other call. This follows the C3 `makeGuard` matching, so an 8.3 short spelling of
  the temp directory cannot make the stub silently miss.
- C10-P3-2. R53 allow rows after an installed-policy failure (section 4.7). After an
  installed-policy failure, with a valid or absent manifest, R53 emits
  `{level:"fail",check:"allow-input",detail:".claude/settings.json is protected; shared allows were not classified"}`
  then LOCAL, whether or not `.claude/settings.json` exists, and does not read settings. The
  `validation-protected` row is emitted only when settings are present. The section-6.3
  policy-failure case asserts both allow rows.
- C10-P3-3. Wording only. In section 1.3, "the seven-member runtime-unit sentence" means the C6
  I6-7 security.md text; it adds no new pinned sentence.
