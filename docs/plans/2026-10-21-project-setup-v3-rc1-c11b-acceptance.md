# project-setup 3.0.0-rc.1 acceptance record

Recorded evidence of the writable candidate acceptance run required by section 6.5 of
`docs/plans/2026-10-20-project-setup-v3-rc1-c11b.md`. It records what was executed; it is not a
test oracle. The run used the uncommitted C11b implementation on top of `1fd5227` (the C11b tests
commit), the same bytes that were then committed. Evidence paths are temporary directories on the
recording host and are not retained elsewhere.

```text
Command: node project-setup/tests/accept-rc1.mjs
Date: 2026-10-21 (host clock at start: 2026-10-21T09:44:44Z)
Platform: win32 10.0.26100 (Microsoft Windows [Version 10.0.26100.8037]), no file-symlink privilege
Node: v24.14.1
Git: git version 2.53.0.windows.2
Totals: 99 PASS / 0 FAIL / 1 SKIP
ACCEPT-RC1: PASS full (exit 0, empty stderr)
RESULTS: <tmp>\ps-tests-xQjE4H\results.json
EVIDENCE: <tmp>\ps-accept-rc1-9Qxara
Elapsed time: 1013 s (wall clock around the command)
Process count: unavailable for the whole run; C11b component: 130 child processes
Process-count method: no host-wide process counter was attached to the full run. The C11b
  figure is the component's own spawn counter, retained in c11b/c11b-diagnostics.log under
  RESULTS (release world 29, release-cli 32, identity 17, archive 0, immutability 2,
  installed-payload 18, v2-compatibility 59, composition 2; cumulative 130).
Synthetic S07 tag: c11b-fixture-rc1
Synthetic S07 commit: b810af0f34417f8263c0ce713e4c0033ebb45611
Synthetic S07 project-setup tree: 462a7a1d4f8a706722a72f28bbd3a9783629572b
First ZIP SHA256: 84fe9a3128d632fe9800973c6e7d4e56db1865c7808c194405996f3fc8f22813
Second ZIP SHA256: 84fe9a3128d632fe9800973c6e7d4e56db1865c7808c194405996f3fc8f22813
Installed-payload evidence: S07/C11b/installed-payload PASS ("both installed copies contain the
  complete candidate payload"), with S07/C11b/archive and S07/C11b/notes PASS; component report
  c11b/integration-results.json under RESULTS. Both ZIPs are 1160736 bytes and the publication
  notes record the tag, commit, tree and archive SHA256 above.
Pending host measurements:
  R83
  R44/R74 host enforcement
  R51 Claude continuation and stderr handling
  A3 trusted-checkout live review
  A5 host negative capability
```

The only skip record was exactly:

```text
SKIP  R13d  a pre-placed backup leaf symlink is never written through  (cannot create file symlink (Windows without Developer Mode))
```

The retained stdout holds 99 PASS records: the 59 passing baseline records and the 40 complete
rc.1 records. No missing-record verdict remained. The C5 optional file-symlink diagnostic reads:
"R91/C5/links: optional file-symlink subcase not exercised (EPERM); the mandatory junction and
synthetic link cases ran."

## Focused acceptance (section 6.4)

| Command | Result | Verdict | Elapsed |
| --- | --- | --- | --- |
| `node project-setup/tests/accept-rc1.mjs --only R86` | `1 PASS / 0 FAIL / 0 SKIP`, exit 0 | `ACCEPT-RC1  PASS  R86` | 281 s |
| `node project-setup/tests/accept-rc1.mjs --only R91` | `1 PASS / 0 FAIL / 0 SKIP`, exit 0 | `ACCEPT-RC1  PASS  R91` | 19 s |
| `node project-setup/tests/accept-rc1.mjs --only R100` | `1 PASS / 0 FAIL / 0 SKIP`, exit 0 | `ACCEPT-RC1  PASS  R100` | 19 s |

## Component acceptance (sections 6.1 and 6.2)

Run the same day on the same tree: C11b `10 PASS / 0 FAIL / 0 SKIP`, C11a 8/0/0, C1 12/0/0,
C2 14/0/0, C3 18/0/0, C4 17/0/0, C5 18/0/0, C6 12/0/0, C7 12/0/0, C8 16/0/0, C9 12/0/0,
C10 20/0/0.

## `npm run check` (section 6.3)

On the recording host `npm run check` exited 1. Prettier reported style issues in 12 files, all
under `.remember/`, a local, Git-ignored data folder of a memory plugin on this machine that is not
part of the repository. The version-stamp guard passed. `npx prettier --check . '!.remember/**'`
printed "All matched files use Prettier code style!". The requirement is therefore recorded as not
met on this host, for that host-local reason; the pull-request CI run of `npm run check` is the
clean measurement.

No tag, upload or deployment was made. The repository's tags were the same before and after the
run (`project-setup-v1`, `project-setup-v2.0.0`, `v2.0.1`).
