#!/usr/bin/env node
// One setup/update run per checkout.
//
// Why no PID/TTL auto-expiry: agents invoke this script as short-lived child processes,
// so the PID of the process that acquired the lock is gone immediately and says nothing
// about whether the agent session is still alive. A timestamp alone cannot prove the
// owner died either. Breaking a lock is therefore a human decision, made with the
// owner details in front of them.
//
// Usage:
//   node lock.mjs acquire --run-id <id> [--agent claude|codex]
//   node lock.mjs heartbeat --run-id <id>
//   node lock.mjs status
//   node lock.mjs release --run-id <id>
//   node lock.mjs break --confirm-run-id <id-shown-by-status>   (only after the user approves)
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, repoRoot, hostId, ok, fail, skillVersion, validateRunId, secureDir, writeInRepo, readInRepo } from './lib.mjs';

const rawArgs = process.argv.slice(2);
// C5 plan 3.12: a reserved run id (review and its aliases) is refused before root discovery or any project access.
// Every --run-id / --confirm-run-id value is scanned, duplicates included, so parseArgs keeping only the last cannot
// hide one; a following token that starts with -- is not a value and keeps the existing handling.
const RESERVED = { ok: false, code: 'RUN_ID_RESERVED', error: 'run id is reserved for review artifacts' };
function failReserved() {
  process.stdout.write(JSON.stringify(RESERVED, null, 2) + '\n');
  process.exit(1);
}
const isReserved = (v) => { try { validateRunId(v); return false; } catch (e) { return e.code === 'RUN_ID_RESERVED'; } };
rawArgs.forEach((a, i) => {
  const v = rawArgs[i + 1];
  if ((a === '--run-id' || a === '--confirm-run-id') && v !== undefined && !v.startsWith('--') && isReserved(v)) failReserved();
});

const args = parseArgs(rawArgs);
const cmd = args._[0];
const root = repoRoot();
if (!root) fail('not inside a git repository');

// `.ai` and the lock dir must be real directories inside the repo (no symlink/junction redirection).
let aiDir;
try { aiDir = secureDir(root, ['.ai'], { create: cmd === 'acquire' }); } catch (e) { fail(e.message, 2); }
const lockDir = aiDir ? path.join(aiDir, '.setup.lock') : path.join(root, '.ai', '.setup.lock');
const ownerFile = path.join(lockDir, 'owner.json');
if (aiDir) { try { secureDir(root, ['.ai', '.setup.lock']); } catch (e) { fail(e.message, 2); } }

function readOwner() {
  try {
    const o = JSON.parse(readInRepo(root, '.ai/.setup.lock/owner.json').toString('utf8'));
    return o && typeof o === 'object' && typeof o.runId === 'string' && o.runId ? o : null; // invalid shape = unknown
  } catch { return null; }
}
const writeOwner = (o) => writeInRepo(root, '.ai/.setup.lock/owner.json', JSON.stringify(o, null, 2) + '\n', { createDirs: false });

function requireRunId() {
  try { return validateRunId(args['run-id']); } catch (e) { fail(e.message); }
}

switch (cmd) {
  case 'acquire': {
    const runId = requireRunId();
    try {
      fs.mkdirSync(lockDir); // atomic on every supported filesystem
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const owner = readOwner();
      if (owner?.runId === runId) { ok({ acquired: true, reentrant: true, owner }); break; }
      fail('lock is held by another run', 2, { owner, hint: 'Show the owner to the user. Never break it without explicit approval.' });
    }
    const owner = { runId, host: hostId(), agent: args.agent || 'unknown', skillVersion: skillVersion(), acquiredAt: new Date().toISOString(), heartbeatAt: new Date().toISOString() };
    writeInRepo(root, '.ai/.setup.lock/.gitignore', '*\n', { createDirs: false }); // never committable
    writeOwner(owner);
    ok({ acquired: true, owner });
    break;
  }
  case 'heartbeat': {
    const runId = requireRunId();
    const owner = readOwner();
    if (!owner || owner.runId !== runId) fail('lock not held by this run', 2, { owner });
    owner.heartbeatAt = new Date().toISOString();
    writeOwner(owner);
    ok({ owner });
    break;
  }
  case 'status': {
    const held = fs.existsSync(lockDir);
    const owner = held ? readOwner() : null;
    const ageMinutes = owner ? Math.round((Date.now() - Date.parse(owner.heartbeatAt)) / 60000) : null;
    ok({ held, owner, ownerReadable: held ? Boolean(owner) : null, minutesSinceHeartbeat: ageMinutes, sameHost: owner ? owner.host === hostId() : null });
    break;
  }
  case 'release': {
    const runId = requireRunId();
    const owner = readOwner();
    if (!fs.existsSync(lockDir)) { ok({ released: false, reason: 'not held' }); break; }
    // Fail closed: a missing, unreadable, or malformed owner is NOT permission to release.
    if (!owner) fail('lock ownership is unknown (owner.json missing, unreadable, or invalid); refusing to release. If the user confirms no run is active: lock.mjs break --confirm-unknown-owner', 2);
    if (owner.runId !== runId) fail('refusing to release a lock owned by another run', 2, { owner });
    fs.rmSync(lockDir, { recursive: true, force: true });
    ok({ released: true });
    break;
  }
  case 'break': {
    const owner = readOwner();
    if (!fs.existsSync(lockDir)) { ok({ broken: false, reason: 'not held' }); break; }
    if (owner && isReserved(owner.runId)) {
      // A pre-C5 run named review (or an alias) cannot be matched with --confirm-run-id any more: only the explicit
      // human recovery flag removes its lock. That removes the lock only, never .ai/.run/review.
      if (!args['confirm-unknown-owner']) failReserved();
    } else if (owner) {
      const confirm = args['confirm-run-id'];
      if (!confirm || confirm === true || owner.runId !== String(confirm)) {
        fail('break requires --confirm-run-id matching the current owner (prevents breaking a lock that changed hands)', 2, { owner });
      }
    } else if (!args['confirm-unknown-owner']) {
      // Ownership cannot be shown to the user, so a different, explicit confirmation is required.
      fail('lock ownership is unknown; break requires --confirm-unknown-owner after the user confirms no run is active', 2);
    }
    fs.rmSync(lockDir, { recursive: true, force: true });
    ok({ broken: true, previousOwner: owner ?? 'unknown', next: 'check every run with apply.mjs status for a partial apply' });
    break;
  }
  default:
    fail('usage: lock.mjs acquire|heartbeat|status|release|break');
}
