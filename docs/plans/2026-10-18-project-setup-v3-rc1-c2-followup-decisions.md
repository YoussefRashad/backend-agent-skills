# C2 follow-up decision (maintainer, 2026-10-18)

After C2 landed (9f28ba0), an automated security review of the pushed change reported two
findings in `project-setup/scripts/apply.mjs`. The orchestrator confirmed both in the code. The
maintainer decided them as below. This record amends
docs/plans/2026-10-17-project-setup-v3-rc1-c2.md and
docs/plans/2026-10-17-project-setup-v3-rc1-c2-implement-decisions.md without editing them; where
they differ, this record wins.

## I2-10. Commit re-applies the per-target refusal checks before any write

Gap: I2-2 made the prepared review refuse every plan op that the unprepared review would refuse,
and exempted commit because it compares `plan.json` with the externally approved hash. Commit
never runs those checks itself. A forged `plan.json` with a draft op for `.env` (or for a path
outside the documentation write scope) passes `loadPlan`, because op targets are roles, not
declared inputs. If its hash is approved, `apply.mjs commit` writes the path, which turns the
tool into a way around the Claude/Codex deny rules that stop the agent from writing it directly.

Decision: after `loadPlan` and before the binding recheck, any heartbeat, journal or write,
commit applies to every plan op, in target order, the same per-target checks as the prepared
review (I2-2), with prepare's texts:

- a target that appears twice: `APPLY_DUPLICATE_TARGET` / 3,
  `target appears in both drafts and vault`;
- `checkSource(op, isSecret, 'prepare')`: path safety (`APPLY_PATH` / 2), the drafted manifest
  (`APPLY_MANIFEST_DRAFT` / 3), the common refusal set for draft ops (`APPLY_SECRET_TARGET` / 3,
  `agent drafts may not target secret-pattern paths`), write denial and scope
  (`APPLY_WRITE_DENIED` / 3, `APPLY_WRITE_SCOPE` / 3), vault eligibility (`APPLY_VAULT_TARGET` /
  3) and the target type (`APPLY_TARGET_TYPE` / 3).

The first refusal in target order is reported in commit's F envelope with an empty stderr.
Nothing is written, no journal or heartbeat is created, and no target body is read. A filesystem
failure during these checks keeps I2-6's commit mapping (`APPLY_INPUT_IO` / 2).

The tests lane adds one step to `R80/C2/input-binding` (no new assertion IDs). After a valid
prepare, `plan.json` is rewritten with an extra draft op, every binding made consistent (draft
source, `sourceInventory` entry, source hash, `preRawSha` and the matching `inputs` entry) so
that only the new check can stop it, and commit runs with `--approved-plan` set to the rewritten
plan's hash:

- an op for `.env` (a fixture file with a known marker value): `APPLY_SECRET_TARGET` / 3 with the
  text above, `.env` bytes unchanged, never read (read-recording preload), nothing written, no
  journal;
- an op for a path outside the documentation write scope (for example `src/forged.ts`):
  `APPLY_WRITE_SCOPE` / 3, nothing written, no journal.

## The second finding goes to C3

`commit` writes `plan.manifestAfter` as stored. `loadPlan` checks that it is a valid schema-3
manifest, not that it is the manifest prepare would compute, and the prepared review does not
show the manifest change. The damage is limited to ownership metadata, and C3 changes exactly
this part of the manifest (the recorded managed pattern list and the Codex snippet hash). The C3
component plan therefore owns binding `manifestAfter` to what was reviewed: either commit
recomputes it from the bound prior manifest, the content ops and the metadata ops and refuses a
mismatch, or the prepared review renders it. Until C3 lands this is an accepted residual risk.
