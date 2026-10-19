# State, ownership, apply, and concurrency

## Ownership model

| Ownership | Applies to | The skill may | On drift |
|---|---|---|---|
| `full` | Files the skill created entirely: `.ai/agents/*`, wrappers | Regenerate when unchanged | Ask before replacing user edits |
| `blocks` | Markdown and `#`-comment files with managed blocks: `AGENTS.md`, `CLAUDE.md`, `.gitignore` | Rewrite inside its blocks only | Per-block: unchanged / edited-by-user / removed-by-user |
| `keys` | `.claude/settings.json`, `.ai/security-paths.json` | Append missing managed entries; record the approved managed list | Never removes or reorders without approval; reports conflicts |
| `merged` | Living docs, `.env.example`, pre-existing files without markers | Targeted, reviewed edits | Not tracked |

A matching hash means "the skill's region is as the skill left it". It is **not** permission to rewrite the whole
file: user content outside managed regions is never regenerated.

Markers (`blocks.mjs`): no nesting, unique ids, every begin has an end, markers inside fenced code are ignored.
Broken markers stop the run for that file.

JSON has no comments, so `.claude/settings.json` uses key-level ownership; the managed entry list is stored in the
manifest. TOML wrappers are `full` files; the skill never merges into user TOML.

Managed metadata is file-specific (`scripts/ownership.mjs`): the settings record holds exact permission strings per
array (`permissions.allow`, `permissions.deny`), hook identities (event, matcher, command; options such as `timeout`
are not identity) and `heldBack`; the policy record holds the complete `{ schema, patterns }` entries, every field kept.
Approved omissions are stored in the record's `omissions` field, separately from `managed`, and match only the exact
anchor and case-insensitive glob they name. New manifests are schema 3; a valid schema-2 manifest is migration input
that detect and validate report as "needs update".

Allow omissions identify exact permission strings. They are separate from managed ownership.
Retiring an allow removes only its selected managed identity and records its omission in the
same reviewed transaction. An already-absent allow uses an explicit metadata operation and
still requires approval for `.claude/settings.json`. Unselected and user-owned rules remain.

## Hashing

Hashes are SHA-256 of normalised text (BOM stripped, CRLF→LF, trailing newline), so `core.autocrlf` on Windows does
not register as a user edit. Apply preconditions use raw bytes. Written files keep the existing line-ending style.

## Run lifecycle

```
lock acquire → apply init → drafts (agent + blocks.mjs + merge/env scripts)
→ apply prepare: plan with, per file, the target's raw pre-hash and the draft's SHA-256;
                 rejects outside-block / user-edited changes unless --approve-user-content names that file;
                 prints planSha256
→ user reviews `apply.mjs diff` (content and metadata operations) and approves planSha256
→ apply commit --approved-plan <planSha256>:
     1. plan hash, every draft hash, every target hash, manifest hash re-verified → exit 4, nothing written, on any change
     2. per file: backup to vault → journal entry {preRawSha, expectedWriteSha, state "backed-up"}
        → atomic write (temp + rename, retries on Windows locks) → state "applied" + writtenRawSha
     3. manifest written last → journal committed
→ validate → runtime verification → report → lock release → (user confirms) → cleanup
```

All run directories (`.ai`, `.ai/.run/<id>`, `drafts`, `vault`, `vault/backup` and every directory below it,
`.ai/.setup.lock`, `.ai/.canary/<id>`) are resolved segment by segment **from the repository root, at the moment
each read or write happens** (never from a previously resolved subdirectory, which could itself have been replaced):
every existing segment must be a real directory (symlinks and Windows junctions are rejected), the final real path
must be inside the repository, a linked leaf file is refused, and writes go through an exclusive temp file + rename
(never through an existing link). `commit` also checks the whole run chain before its first write (exit 2).

`ownership.json`, `managed-keys.json`, `omissions.json`, `manifest-metadata.json` and `transaction-inputs.json` (run
dir) are validated at prepare and embedded in the plan with their hashes, so the approval covers manifest metadata too;
commit uses only the embedded copy and aborts (exit 4) if any of them appeared, disappeared, or changed after prepare.
The plan holds content operations and metadata operations separately; an explicit ownership, managed-list removal or
reordering, or omission change needs `--approve-user-content <target>` even when the file's bytes are unchanged. One
commit and one journal apply both, the manifest last, exactly as approved. Every bound input (targets, drafts, declared
`transaction-inputs.json` consumers, the installed policy, the manifest) is rechecked before anything is written. Run
ids are `[A-Za-z0-9][A-Za-z0-9._-]{3,63}` with no `..`.

Stage policy and deny changes first, hooks second, and allow retirement last. Use
`merge-claude-settings.mjs --run-id <id> --retire-allow-file <path>` with a selection file inside
the project and outside setup draft and vault directories. Normal merge refuses a pending
allow-omission request. Start a new run to amend a pending retirement selection.

The selection file is a JSON array of exact strings, each a recorded managed allow or an existing allow omission of
the INSTALLED manifest (a staged request never makes a rule eligible); `.ai/.run/<id>/retire-allows.json` is the
recommended place. Staging patches only `ownership.json`, the `permissions.allow` field of `managed-keys.json` and of
`omissions.json`, and the settings draft. A pending result can be repeated in the same run; a different result is
`ALLOW_STAGE_CONFLICT`.

Staging is not approval. Review both content and metadata with apply diff, prepare with the
required path approvals, and approve the resulting plan hash. Metadata-only retirement leaves
settings bytes unchanged. Rollback restores ownership and omissions through the same journal,
subject to protection for later edits. An already-omitted identity is not restored on rerun.

Review drafts with the apply command. It renders target-versus-draft differences in-process
without invoking Git, including during root discovery. The explicit project root is checked
through the filesystem. Review does not acquire or refresh a lock, create directories, write
a plan, or initialize a journal.

```
node <SKILL_DIR>/scripts/apply.mjs diff --project . --run-id <id>
```

Before prepare, this is an unapproved preview. After prepare, the report identifies
planSha256 and refuses changed inputs. Vault files appear only as key names and value
classifications. Review metadata operations even when the affected file bytes are unchanged.
Any changed input requires a new prepare and approval.

If detect reports mode "invalid", repair or restore .ai/manifest.json before running prepare.

The vault accepts only env templates (`.env.example`, `.env.sample`, `.env.template`) produced by `env-keys.mjs`.
Agent drafts can never target a secret-pattern path.

Failure handling:

- Exit 5 (mid-apply failure): the journal lists what was applied. `apply.mjs rollback` undoes only this run's own
  writes, in reverse order:
  - on-disk hash = what the run wrote → restore the backup (or delete a file the run created);
  - on-disk hash = the pre-run hash → nothing to undo (the write never landed);
  - anything else → someone changed it afterwards: **skip**, keep the backup, report it.
  Any skip makes the rollback incomplete: exit 6, `status.rollbackComplete: false`, and `cleanup` refuses until the
  user resolves those files and passes `--confirm-manual-resolution`.
- Crash or interruption: `lock.mjs status` shows the owner; `apply.mjs status --run-id <id>` shows the run `state`.
  - `partial` or `rollback-incomplete`: recover that run first (`rollback`, repeated after the user resolves any
    skipped files, or `cleanup --confirm-manual-resolution`), then retry with a NEW run id.
  - `aborted-before-write` (journal created, nothing written): nothing to undo; retry with a NEW run id.
  - `fresh` (interrupted before the journal was created, e.g. exit 2 or 4): the only case where `prepare` may be run
    again with the same run id.
  Never re-run `prepare`/`commit` on a run that has a journal; the lifecycle guard refuses it (exit 7).
- The check-then-write window cannot be closed completely on a shared working tree. Lock + immediate re-check +
  short apply narrows it; the real isolation for parallel work is separate git worktrees.

## Run lifecycle (one write per run)

| State (`apply.mjs status`) | prepare / commit in this run | prepare / commit in another run |
|---|---|---|
| `fresh` (no journal; includes exit 2/4 aborts) | allowed | allowed |
| `committed` | refused (exit 7) | allowed |
| `partial` (exit 5) | refused | refused until resolved |
| `rollback-incomplete` (exit 6) | refused | refused until resolved |
| `rollback-in-progress` (rollback interrupted, or a file/journal write failed mid-way) | refused | refused until resolved |
| `rolled-back` | refused | allowed |
| `aborted-before-write` | refused | allowed |

Rollback records `inProgress` in the journal **before its first change**, checkpoints after every restored file, and
clears the flag only when it can record the final result. A crash, a failed rename/write/delete, or a failed journal
write therefore leaves the run `rollback-in-progress` (never `committed`); running rollback again resumes, and the
hash rules guarantee already-restored files are left alone. `cleanup` deletes a run's backups only when the run is
`fresh`, `committed`, `rolled-back`, or `aborted-before-write`; anything else needs `--confirm-manual-resolution`.
Known limitation: if the process is killed inside an atomic write, a `<file>.ps-tmp-*` temp file can remain next to
the target; it is never renamed into place and can be deleted.

Resolution for `partial`: `rollback`. For `rollback-incomplete`: resolve the skipped files with the user and run
`rollback` again (it re-evaluates only unresolved entries), or discard the run with
`cleanup --confirm-manual-resolution`. The journal is never rewritten from scratch; a retry always uses a new run id,
so every earlier run keeps its entries and backups until it is resolved or explicitly cleaned up.

## Backup integrity

Rollback restores a backup only if its bytes hash to the `preRawSha` recorded in the journal. Otherwise the target
and the backup are left exactly as found, the entry is reported as skipped, and the rollback is incomplete.

## Locks

`.ai/.setup.lock/` is created with an atomic `mkdir`. Agents run the script as a short-lived child, so no PID
or TTL can prove the owner is dead. A held lock is shown to the user (run id, host, agent, heartbeat). Breaking it
requires the user's approval and `--confirm-run-id` matching the current owner, then `apply.mjs status` on the old
run to detect a partial apply. If `owner.json` is missing, unreadable, or malformed, ownership is unknown: `release`
and `apply` refuse (fail closed), and only `break --confirm-unknown-owner`, after the user confirms no run is active,
removes the lock.

## Concurrency between tools

- One setup/update run per checkout at a time (the lock). Claude and Codex may each run the skill, not
  simultaneously in the same checkout.
- Parallel work belongs in separate worktrees; merge through git.
- `docs-sync` edits living docs directly (they are `merged`) and must not touch wrappers, settings, or managed
  blocks except where the code change makes a block wrong. Developers and implementation agents may update the
  docs related to their change under the same rules.

## Zero diff

A genuine no-op has neither content writes nor metadata operations. Commit still requires
this run's lock and rechecks the prepared inputs. It leaves project files, manifest bytes
and lock bytes unchanged and creates no journal. An ownership, omission, snippet or schema
change can be a metadata operation even when every content operation is unchanged.
sourceCommit changes only when actual content or metadata work is committed. Nothing time-based is written into
managed content.
