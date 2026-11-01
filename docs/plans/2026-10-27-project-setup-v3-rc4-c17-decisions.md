# C17 decisions and pre-freeze probes

Decisions and probe evidence for the frozen plan
docs/plans/2026-10-27-project-setup-v3-rc4-c17.md (project-setup 3.0.0-rc.4). Later decisions
are appended here; the frozen plan is never edited.

## Provenance

The maintainer chose rc.4 for the two rc.3 host-measurement defects and Lanes mode (class
normal) on 2026-10-27. At 21:35 the same day the maintainer asked the orchestrator to continue
without waiting while away. The plan lane (Codex) drafted one round; plan-critique (Claude)
round 1 found no BLOCKING gap, conditional on probes P2 and P3. Both passed, so the plan was
frozen after round 1 with addendum C17-F0..F15.

## Q1-Q6 (taken by the orchestrator, 2026-10-27, maintainer away)

| Q | Decision | Basis |
|---|---|---|
| Q1 HEAD identity | Option (i): argument-free `git-safe head`; reviewer step 2 uses it | Removes the only raw-Git step in a definition whose every other read goes through git-safe; works under a parent brief saying "never raw git"; option (ii) moves every review-diff header consumer and bound fixture |
| Q2 D2 | Options (i) plus (ii): documentation and a distinct GIT_SAFE_OWNERSHIP diagnostic; no acceptance of injected config | Cheap, grants no access; (iii) would trust the injected grant it is validating (circular) |
| Q3 detection | Exact English fatal prefix at stderr byte zero, after a status-128 root-discovery call with empty stdout | P2 shows byte-zero under the real sandbox with no preceding warning; localized or prefixed stderr keeps GIT_SAFE_REPOSITORY |
| Q4 headless P3 h | Parent-brief guidance only (P17); L16 and wrappers unchanged | Narrow, did not reproduce in the TUI; C17-F6 records that P17 does not reach project sessions |
| Q5 budget | Eight descriptors, 180 counted child launches, 90 s; full-suite timeout and 1500 s threshold unchanged | As recommended; overruns are recorded, coverage is not dropped |
| Q6 review-diff.mjs (critique N14) | Rejected: review-diff.mjs changes as C17-6 says | c5.test.mjs uses one COMMANDS_TEXT for the GIT_SAFE_COMMAND line of both modules; the core changes anyway, so keeping review-diff byte-identical would make the same code carry two different command lists |
| Host-notes Source line (critique N15) | Adopted (C17-F14) | The measurement record is on an unmerged branch         |

## Probes

All probes wrote only under new, empty directories outside the repository and printed numbers,
booleans and variable names only (P-own also printed the refusal text, which names the fixture
path and the two Windows accounts; no config value, secret or repository content).

| Probe | Where | Result |
|---|---|---|
| P-own | Codex elevated sandbox (relay --isolated --read-only, codex-cli 0.163.0), fixture <lab>\fx\fixture-fresh with its isolated global config temporarily without safe.directory | `rev-parse --show-toplevel` with GIT_CONFIG_* stripped: status 128, stdout empty, stderr starts `fatal: detected dubious ownership in repository at '<root>'`; identical with LC_ALL=C and for `rev-parse --verify --quiet`; with Codex's injected GIT_CONFIG_* kept: status 0. git-safe returned GIT_SAFE_REPOSITORY. Evidence <lab>\evidence-rc3\cx\ownprobe\ |
| P1 | Host, Git 2.53.0.windows.2, GIT_TEST_ASSUME_DIFFERENT_OWNER=1 | ambient, LC_ALL=C: 128, stdout 0, prefix at byte 0. LANG/LANGUAGE=de: same English prefix (this Git for Windows build prints English; a translated build was not exercised). Grants by Git's own path form, backslash form and 8.3 short-name form, and `*`: exit 0. Wrong path and injected-then-stripped grant: 128 with the prefix. Injected grant not stripped: exit 0 |
| P2 | Codex elevated sandbox, fixture, real launcher | Sandbox env carries GIT_CONFIG_COUNT, KEY_0, KEY_1, VALUE_0, VALUE_1, GLOBAL, NOSYSTEM; one injected key is safe.directory. Empty global config: ambient and LC_ALL=C both 128, stdout 0, prefix at byte 0, no preceding warning, not after LF. Fixture global config with the grant: exit 0. PASS for Q3; critique N16 stays non-blocking. Evidence <lab>\evidence-rc3\cx\c17-p23\ |
| P3 | Codex elevated sandbox, GIT_CONFIG_GLOBAL and GIT_CONFIG_NOSYSTEM removed | HOME and USERPROFILE equal the invoking user's; the invoking user's ~/.gitconfig is readable; `git config --global --get-regexp ^safe\.directory$` exit 0 with 3 entries; `rev-parse --show-toplevel` exit 0. `whoami` is <host>+CodexSandboxOffline while the USERNAME variable is inherited. The O17 `git config --global` remedy is valid. First attempt failed in the probe itself (`os.userInfo()` ENOMEM inside the sandbox); fixed to read USERNAME and rerun. Evidence <lab>\evidence-rc3\cx\c17-p23\ (failed attempt) and cx\c17-p3b\ |
| P4 | Host | Unborn HEAD: `rev-parse --verify --quiet --end-of-options HEAD^{commit}` exit 1, empty output. SHA-256 repository: 64-character ID. Detached HEAD: exit 0, 64 characters |
| P5 | Host, Node v24.14.1 | Replacing child_process.spawn then importing the core: with syncBuiltinESMExports() 2 spawn calls observed, without it 0 (C17-F13) |
| P6 | Repository, read-only grep | 114 candidate meta-pin sites, listed below (C17-F2) |

Relay runs for P2/P3: status completed, mcpViolation false, 0 MCP calls.

## P6 site list (project-setup/tests, at eac5b07)

Command: `grep -n "appends 34-36\|length === 36\|length: 36\|3\.0\.0-rc\.3\|'C15', 'C16'\]\|'C16'\"\|ids 1 through 36" *.mjs helpers/*.mjs | cut -c1-160`

```text
c11b.test.mjs:181:  "## 3.0.0-rc.3",
c11b.test.mjs:201:  "RELEASE-NOTES-3.0.0-rc.3.md. Publication remains a separate authorized action.",
c11b.test.mjs:259:  "# project-setup 3.0.0-rc.3",
c11b.test.mjs:263:  "# project-setup 3.0.0-rc.3 - skill source",
c11b.test.mjs:265:  "**Release candidate 3.0.0-rc.3.** See RELEASE-NOTES-3.0.0-rc.3.md for compatibility,",
c11b.test.mjs:285:// C16-13: the complete RELEASE-NOTES-3.0.0-rc.3.md, exactly (ASCII, LF, one final LF).
c11b.test.mjs:287:  "# project-setup 3.0.0-rc.3",
c11b.test.mjs:570:  "requires or creates project-setup-v3.0.0-rc.3 in the distribution repository.",
c11b.test.mjs:579:  "node install/release.mjs --tag project-setup-v3.0.0-rc.3 --out <unused-directory>",
c11b.test.mjs:696:  "RELEASE-NOTES-3.0.0-rc.3.md",
c11b.test.mjs:877:const CANDIDATE_VERSION = '3.0.0-rc.3';
c11b.test.mjs:988:const FAKE_NOTES = asBuf(lines(['# project-setup 3.0.0-rc.3', '', 'Fixture notes without any object identifier.']));
c11b.test.mjs:1686:    await step('plan 3.3 and 5.2: tagged VERSION validation (grammar, LF, no BOM or CR, missing blob) and the derived note path, ZIP name, su
c11b.test.mjs:1700:        for (const v of ['3.0.0-rc.1', '3.0.0-rc.2', '3.0.0-rc.3', '3.0.0', '4.2.1-rc.12']) {
c11b.test.mjs:1908:      check(sourceNotes === RELEASE_NOTES_TEXT, 'the working-tree RELEASE-NOTES-3.0.0-rc.3.md is exactly the candidate text (byte equality)',
c11b.test.mjs:2708:    await step('plan 3.6 and C13-14: VERSION is exactly 3.0.0-rc.3 plus LF; the release builder and the candidate notes exist in the source t
c11b.test.mjs:2710:      check(v !== null && v.toString('latin1') === `${CANDIDATE_VERSION}\n`, 'VERSION is exactly "3.0.0-rc.3\\n"', v && v.toString('latin1'))
c11b.test.mjs:2711:      check(exists(skillPath(context, 'install/release.mjs')) && exists(skillPath(context, `RELEASE-NOTES-${CANDIDATE_VERSION}.md`)) && exist
c11b.test.mjs:2721:      check(raw !== null && raw.toString('utf8') === RELEASE_NOTES_TEXT && Buffer.compare(raw, Buffer.from(RELEASE_NOTES_TEXT, 'utf8')) === 0
c11b.test.mjs:2741:      check(cl.split('\n## 3.0.0-rc.3\n').length === 2 && cl.split('\n## 3.0.0-rc.2\n').length === 2, 'the candidate entry and the preserved 
c11b.test.mjs:2744:    await step('plan 3.6, C12-15 and C13-14: SKILL.md carries the top-level release heading "# project-setup 3.0.0-rc.3" and every other byte
c11b.test.mjs:2748:      check(ls[5] === SKILL_HEADING_LINES[0], 'line 6 is exactly "# project-setup 3.0.0-rc.3"', ls[5]);
c11b.test.mjs:2791:      check(last && last.includes('```text\nnode install/release.mjs --tag project-setup-v3.0.0-rc.3 --out <unused-directory>\n```') && readm
c11b.test.mjs:2803:    await step('plan 5.9, C12-13, C13-15 and C14-19: evals/evals.json holds evaluations 1 to 36 without duplicates (C15 appends 32-33, C16 ap
c11b.test.mjs:2809:      check(file.evals.length === 36 && eq(file.evals.map((e) => e && e.id), Array.from({ length: 36 }, (_, i) => i + 1)) && new Set(file.eva
c12.test.mjs:2129:// Plan C12-15 (amended by C13-14 and C16-15, which move the current VERSION to 3.0.0-rc.3): VERSION carries no version stamp; the six baselin
c12.test.mjs:2175:    await step('plan C12-15 as amended by C13-14: VERSION is exactly 3.0.0-rc.3 plus LF, no version.json stamp exists, and the six baseline-ch
c12.test.mjs:2177:      check(v !== null && v.toString('latin1') === '3.0.0-rc.3\n', 'VERSION is exactly "3.0.0-rc.3\\n" (C16-15)', v && v.toString('latin1'));
c12.test.mjs:2277:      check(eq(keysA, [...REGISTRY_ORDER_BEFORE, 'C12', 'C13', 'C14', 'C15', 'C16']) && eq(keysI, [...REGISTRY_ORDER_BEFORE, 'C12', 'C13', 'C1
c12.test.mjs:2319:    await step('plan C12-13 as amended by C13-15 and C14-19: evaluation 21 is exactly the plan object, evaluations 1-20 are unchanged, ids run
c12.test.mjs:2323:      check(file.evals.length === 36 && eq(file.evals.map((e) => e && e.id), Array.from({ length: 36 }, (_, i) => i + 1)) && new Set(file.eval
c13.test.mjs:2048:    "const CANDIDATE_VERSION = '3.0.0-rc.3';", 'const RC1_CHANGELOG_ENTRY_LINES = [', 'const RC1_RELEASE_NOTES_LINES = [', 'const RC1_RELEASE_
c13.test.mjs:2049:    '"# project-setup 3.0.0-rc.2",', '"RELEASE-NOTES-3.0.0-rc.2.md",', 'node install/release.mjs --tag project-setup-v3.0.0-rc.2 --out <unused
c13.test.mjs:2050:    'const ROLLBACK_TEXT = \'Roll back project state with the rc.1 tooling before reverting the installed skill.', 'Candidate 3.0.0-rc.1 evide
c13.test.mjs:2054:  ['tests/c8.test.mjs', ['file.evals.length === 36', `rollback1: '${CURRENT_ROLLBACK_TEXT}',`], ['file.evals.length === 21', 'file.evals.lengt
c13.test.mjs:2055:  ['tests/c9.test.mjs', ['file.evals.length === 36'], ['file.evals.length === 21', 'file.evals.length === 26', 'file.evals.length === 31', 'fi
c13.test.mjs:2056:  ['tests/c12.test.mjs', ["'3.0.0-rc.3\\n'", "REGISTRY_ORDER_BEFORE, 'C12', 'C13', 'C14', 'C15', 'C16'", 'file.evals.length === 36'], ["'3.0.0
c13.test.mjs:2286:      check(eq(keysA, [...REGISTRY_ORDER_BEFORE, 'C13', 'C14', 'C15', 'C16']) && eq(keysI, [...REGISTRY_ORDER_BEFORE, 'C13', 'C14', 'C15', 'C1
c13.test.mjs:2327:    await step('plan C13-15, I13-1 and C14-17: evals/evals.json holds 36 ordered unique evaluations (C14 appends 27-31 and asserts them; C15 a
c13.test.mjs:2332:      check(file.evals.length === 36 && eq(ids, Array.from({ length: 36 }, (_, i) => i + 1)) && new Set(ids).size === 36, 'ids 1 through 36 in
c14.test.mjs:2767:  ['tests/c8.test.mjs', ['file.evals.length === 36', 'Array.from({ length: 36 }', 'C13 appends 22-26, C14 appends 27-31, C15 appends 32-33, C1
c14.test.mjs:2768:  ['tests/c9.test.mjs', ['file.evals.length === 36', 'Array.from({ length: 36 }', 'C13 appends 22-26, C14 appends 27-31, C15 appends 32-33, C1
c14.test.mjs:2769:  ['tests/c11b.test.mjs', ['file.evals.length === 36', 'Array.from({ length: 36 }', 'C13 appends 22-26, C14 appends 27-31, C15 appends 32-33, 
c14.test.mjs:2770:  ['tests/c12.test.mjs', ['file.evals.length === 36', 'Array.from({ length: 36 }', "REGISTRY_ORDER_BEFORE, 'C12', 'C13', 'C14', 'C15', 'C16'",
c14.test.mjs:2771:  ['tests/c13.test.mjs', ['file.evals.length === 36', "[...REGISTRY_ORDER_BEFORE, 'C13', 'C14', 'C15', 'C16']", '36 evaluations', 'slice(21, 2
c14.test.mjs:2851:      check(eq(keysA, [...REGISTRY_ORDER_BEFORE, 'C14', 'C15', 'C16']) && eq(keysI, [...REGISTRY_ORDER_BEFORE, 'C14', 'C15', 'C16']), 'both re
c14.test.mjs:2893:    await step('plan C14-17 and C14-19: evals/evals.json holds exactly 36 ordered unique evaluations (C15 appends 32-33; C16 appends 34-36); 1
c14.test.mjs:2898:      check(file.evals.length === 36 && eq(ids, Array.from({ length: 36 }, (_, i) => i + 1)) && new Set(ids).size === 36, 'exactly ids 1 throu
c14.test.mjs:2986:      check(!block('CHANGELOG_ENTRY_LINES').includes('C14') && block('CHANGELOG_ENTRY_LINES').includes(JSON.stringify('## 3.0.0-rc.3')) && blo
c15.test.mjs:372:  "    \"const CANDIDATE_VERSION = '3.0.0-rc.3';\", 'const RC1_CHANGELOG_ENTRY_LINES = [', 'const RC1_RELEASE_NOTES_LINES = [', 'const RC1_RELE
c15.test.mjs:373:  "    '\"# project-setup 3.0.0-rc.2\",', '\"RELEASE-NOTES-3.0.0-rc.2.md\",', 'node install/release.mjs --tag project-setup-v3.0.0-rc.2 --out <
c15.test.mjs:374:  "    'const ROLLBACK_TEXT = \\'Roll back project state with the rc.1 tooling before reverting the installed skill.', 'Candidate 3.0.0-rc.1 ev
c15.test.mjs:378:  "  ['tests/c8.test.mjs', ['file.evals.length === 36', `rollback1: '${CURRENT_ROLLBACK_TEXT}',`], ['file.evals.length === 21', 'file.evals.len
c15.test.mjs:379:  "  ['tests/c9.test.mjs', ['file.evals.length === 36'], ['file.evals.length === 21', 'file.evals.length === 26', 'file.evals.length === 31', '
c15.test.mjs:380:  "  ['tests/c12.test.mjs', [\"'3.0.0-rc.3\\\\n'\", \"REGISTRY_ORDER_BEFORE, 'C12', 'C13', 'C14', 'C15', 'C16'\", 'file.evals.length === 36'], 
c15.test.mjs:386:  "  ['tests/c8.test.mjs', ['file.evals.length === 36', 'Array.from({ length: 36 }', 'C13 appends 22-26, C14 appends 27-31, C15 appends 32-33, 
c15.test.mjs:387:  "  ['tests/c9.test.mjs', ['file.evals.length === 36', 'Array.from({ length: 36 }', 'C13 appends 22-26, C14 appends 27-31, C15 appends 32-33, 
c15.test.mjs:388:  "  ['tests/c11b.test.mjs', ['file.evals.length === 36', 'Array.from({ length: 36 }', 'C13 appends 22-26, C14 appends 27-31, C15 appends 32-33
c15.test.mjs:389:  "  ['tests/c12.test.mjs', ['file.evals.length === 36', 'Array.from({ length: 36 }', \"REGISTRY_ORDER_BEFORE, 'C12', 'C13', 'C14', 'C15', 'C16
c15.test.mjs:390:  "  ['tests/c13.test.mjs', ['file.evals.length === 36', \"[...REGISTRY_ORDER_BEFORE, 'C13', 'C14', 'C15', 'C16']\", '36 evaluations', 'slice(2
c15.test.mjs:396:  ["tests/c8.test.mjs", "check", "'ids 1 through 31 in order (C8 appended 11-16, C9 appends 17-19, C11b appends 20, C12 appends 21, C13 appends
c15.test.mjs:397:  ["tests/c9.test.mjs", "check", "'ids 1 through 31 in order (C11b appends 20, C12 appends 21, C13 appends 22-26, C14 appends 27-31)'", "'ids 1
c15.test.mjs:398:  ["tests/c11b.test.mjs", "check", "'IDs 1 through 31 in order without duplicates (C12 appends 21, C13 appends 22-26, C14 appends 27-31)'", "'I
c15.test.mjs:399:  ["tests/c12.test.mjs", "title", "'plan C12-13 as amended by C13-15 and C14-19: evaluation 21 is exactly the plan object, evaluations 1-20 are
c15.test.mjs:400:  ["tests/c12.test.mjs", "check", "'ids 1 through 31 in order without duplicates'", "'ids 1 through 36 in order without duplicates'"],
c15.test.mjs:405:  ["tests/c11b.test.mjs", "'plan 5.9, C12-13, C13-15 and C14-19: evals/evals.json holds evaluations 1 to 31 without duplicates and evaluation 2
c15.test.mjs:406:  ["tests/c13.test.mjs", "'plan C13-15, I13-1 and C14-17: evals/evals.json holds 31 ordered unique evaluations (C14 appends 27-31 and asserts t
c15.test.mjs:407:  ["tests/c13.test.mjs", "'ids 1 through 31 in order without duplicates (C14 appends 27-31)'", "'ids 1 through 36 in order without duplicates (
c15.test.mjs:410:  ["tests/c14.test.mjs", "'plan C14-17 and C14-19: evals/evals.json holds exactly 31 ordered unique evaluations; 1-20, 21, 22, 23, 25 and 26 ar
c15.test.mjs:411:  ["tests/c14.test.mjs", "'exactly ids 1 through 31 in order without duplicates (an earlier or a larger count is wrong)'", "'exactly ids 1 thro
c15.test.mjs:1679:      check(eq(keysA, [...REGISTRY_ORDER_BEFORE, 'C15', 'C16']) && eq(keysI, [...REGISTRY_ORDER_BEFORE, 'C15', 'C16']), 'both registries list 
c15.test.mjs:1728:    await step('plan C15-9, C15-13 and C16-14/C16-17: evals/evals.json holds exactly 36 ordered unique evaluations (C16 appends 34-36); the 1-
c15.test.mjs:1734:      check(file.evals.length === 36 && eq(ids, Array.from({ length: 36 }, (_, i) => i + 1)) && new Set(ids).size === 36, 'exactly ids 1 throu
c15.test.mjs:1788:        check(t.includes('file.evals.length === 36') && t.includes('Array.from({ length: 36 }') && !t.includes('file.evals.length === 33') && 
c15.test.mjs:1793:        ['tests/c8.test.mjs', 'check(file.evals.length === 36 && eq(file.evals.map((e) => e.id), Array.from({ length: 36 }, (_, i) => i + 1)),
c15.test.mjs:1794:        ['tests/c9.test.mjs', `check(file.evals.length === 36 && eq(${idsA}, Array.from({ length: 36 }, (_, i) => i + 1)), `],
c15.test.mjs:1795:        ['tests/c11b.test.mjs', `check(file.evals.length === 36 && eq(${idsA}, Array.from({ length: 36 }, (_, i) => i + 1)) && new Set(${idsA}
c15.test.mjs:1796:        ['tests/c12.test.mjs', `check(file.evals.length === 36 && eq(${idsA}, Array.from({ length: 36 }, (_, i) => i + 1)) && new Set(${idsA})
c15.test.mjs:1797:        ['tests/c13.test.mjs', 'check(file.evals.length === 36 && eq(ids, Array.from({ length: 36 }, (_, i) => i + 1)) && new Set(ids).size ==
c15.test.mjs:1798:        ['tests/c14.test.mjs', 'check(file.evals.length === 36 && eq(ids, Array.from({ length: 36 }, (_, i) => i + 1)) && new Set(ids).size ==
c15.test.mjs:1800:      for (const [rel, list] of [['tests/c12.test.mjs', "'C12', 'C13', 'C14', 'C15', 'C16'"], ['tests/c13.test.mjs', "'C13', 'C14', 'C15', 'C1
c15.test.mjs:1810:      check(c13.includes("[...REGISTRY_ORDER_BEFORE, 'C13', 'C14', 'C15', 'C16']") && c12.includes("REGISTRY_ORDER_BEFORE, 'C12', 'C13', 'C14'
c16.test.mjs:1:// C16 tests lane: the eight component assertions of "C16. Root-start requirements and reliable review-helper use" (project-setup 3.0.0-rc.3, the
c16.test.mjs:632:      const notes = squash(readText(skillPath(context, 'RELEASE-NOTES-3.0.0-rc.3.md')) || '');
c16.test.mjs:1564:      const notes = squash(readText(skillPath(context, 'RELEASE-NOTES-3.0.0-rc.3.md')) || '');
c16.test.mjs:1582:      check(!/3\.0\.0-rc\.2/.test(rootReadme) && /project-setup` \(3\.0\.0-rc\.3, a release candidate/.test(rootReadme) && r.includes('project
c16.test.mjs:1586:      check(!/3\.0\.0-rc\.2/.test(tree) && t.includes('agent scaffolding (3.0.0-rc.3)') && t.includes('(`project-setup/VERSION` is `3.0.0-rc.3
c16.test.mjs:1948:// Plan C16-4, C16-11, C16-13, C16-14 and C16-F1/C16-F2: the release bookkeeping. VERSION is exactly 3.0.0-rc.3 plus LF; the SKILL heading, th
c16.test.mjs:1949:// entries; RELEASE-NOTES-3.0.0-rc.3.md is exactly the frozen text; the rc.2 notes stay byte for byte; the root TODO.md takes the three C16 am
c16.test.mjs:2048:    await step('plan C16-13 and C16-F2: VERSION is exactly "3.0.0-rc.3" plus LF without a BOM (the prechange VERSION entry is exactly "3.0.0-r
c16.test.mjs:2050:      check(v !== null && v.toString('latin1') === '3.0.0-rc.3\n' && v[0] !== 0xef, 'VERSION is exactly "3.0.0-rc.3\\n" without a BOM', v && v
c16.test.mjs:2055:      check(skill !== null && skill.split('\n')[5] === '# project-setup 3.0.0-rc.3' && COUNT(skill, '3.0.0-rc.2') === 0, 'line 6 of SKILL.md i
c16.test.mjs:2058:      check(readme !== null && COUNT(readme, 'node install/release.mjs --tag project-setup-v3.0.0-rc.3 --out <unused-directory>') === 1 && COU
c16.test.mjs:2063:      check(r.text.startsWith(`# Changelog\n\n${T(C16_BLOCKS.CHANGELOG_ENTRY)}\n## 3.0.0-rc.2\n`) && COUNT(r.text, '\n## 3.0.0-rc.3\n') === 1 
c16.test.mjs:2073:    await step('plan C16-13: RELEASE-NOTES-3.0.0-rc.3.md is exactly the frozen text (ASCII, LF, one final LF, lines within 100 columns outside
c16.test.mjs:2074:      const bytes = readBytes(skillPath(context, 'RELEASE-NOTES-3.0.0-rc.3.md'));
c16.test.mjs:2080:      check(eq(secs, SECTIONS) && notes.startsWith('# project-setup 3.0.0-rc.3\n\nRelease candidate containing C16: root-start instructions an
c16.test.mjs:2140:      check(between(c11b, 'const PAYLOAD_ABSENT = [', '\n];') !== null && between(c11b, 'const PAYLOAD_ABSENT = [', '\n];').includes('RELEASE-
c16.test.mjs:2417:      const r29 = runner.indexOf("test('R29'"); const at15 = runner.indexOf("runComponentAssertions('C15'"); const at16 = runner.indexOf("runC
c16.test.mjs:2418:      check(r29 >= 0 && at15 > r29 && at16 > at15 && r30 > at16 && COUNT(runner, "runComponentAssertions('C16'") === 1, 'exactly one runCompon
c16.test.mjs:2436:      check(file.evals.length === 36 && eq(ids, Array.from({ length: 36 }, (_, i) => i + 1)) && new Set(ids).size === 36, 'exactly ids 1 throu
c16.test.mjs:2511:        check(full.text === preText(fx, 'SKILL.md') && body.text !== null && body.text.split('\n')[5] === '# project-setup 3.0.0-rc.3' && body
c8.test.mjs:1236:      check(file.evals.length === 36 && eq(file.evals.map((e) => e.id), Array.from({ length: 36 }, (_, i) => i + 1)), 'ids 1 through 36 in orde
c9.test.mjs:2245:      check(file.evals.length === 36 && eq(file.evals.map((e) => e && e.id), Array.from({ length: 36 }, (_, i) => i + 1)), 'ids 1 through 36 in
helpers/c16-amendments.mjs:460:  "# project-setup 3.0.0-rc.3 - skill source",
helpers/c16-amendments.mjs:462:  "**Release candidate 3.0.0-rc.3.** See RELEASE-NOTES-3.0.0-rc.3.md for compatibility,",
helpers/c16-amendments.mjs:614:  "remaining platform limitations are in project-setup/RELEASE-NOTES-3.0.0-rc.3.md.",
helpers/c16-amendments.mjs:618:  "## 3.0.0-rc.3",
helpers/c16-amendments.mjs:638:  "RELEASE-NOTES-3.0.0-rc.3.md. Publication remains a separate authorized action.",
helpers/c16-amendments.mjs:642:  "# project-setup 3.0.0-rc.3",
helpers/c16-amendments.mjs:974:  SH: Object.freeze({ file: 'SKILL.md', before: '---\n\n', old: '# project-setup 3.0.0-rc.2\n', neu: '# project-setup 3.0.0-rc.3\
helpers/c16-amendments.mjs:994:  RM4a: Object.freeze({ file: 'README.md', before: 'S07 uses a temporary repository, isolated Git configuration and synthetic tag
helpers/c16-amendments.mjs:995:  RM4b: Object.freeze({ file: 'README.md', before: '', old: 'node install/release.mjs --tag project-setup-v3.0.0-rc.2 --out <unus
helpers/c16-amendments.mjs:998:  V: Object.freeze({ file: 'VERSION', before: '', old: '3.0.0-rc.2\n', neu: '3.0.0-rc.3\n', after: '' }),
```

## Tests-lane plan gaps (taken by the orchestrator, 2026-11-01)

The tests lane (Claude Sonnet) wrote the C17 tests from the frozen plan and reported eight plan
gaps. Two need a recorded reading; the other six are within the plan's wording.

| ID | Gap | Decision | Basis |
|---|---|---|---|
| I17-1 | C17-F7 names root README lines 47, 57 and 93 as the only current-candidate tokens. Line 57 is blank; the notes reference is line 58, and line 242 (the tree line) also names the current candidate | Lines 47, 58, 93 and 242 move to rc.4; nothing else in the root README changes besides 89-90 | F7's intent is "only the current-candidate tokens". C16 (5d54c6e) moved the same four tokens; the line numbers in F7 were taken before C16's three inserted lines were counted. Leaving 242 at rc.3 would make the README contradict itself |
| I17-2 | C17 launches about 242 counted child processes against the Q5 figure of 180 (33-39 s, under the 90 s budget) | Accepted; recorded in the acceptance record | Q5: overruns are recorded, coverage is not dropped |
