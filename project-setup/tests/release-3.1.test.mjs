#!/usr/bin/env node
// project-setup 3.1.0 release assertions, STAGE 1 (the implementation commit). Standalone: `node tests/release-3.1.test.mjs` prints PASS and
// FAIL lines, a totals line, and exits 0 only when every assertion passes. It is not a registered component (plan section 8): registering it
// would amend the exact run-tests.mjs and registry pins of C11b to C17 for no behavioral gain, the same decision C18 recorded (I18-2).
// Plan: docs/plans/2026-11-11-project-setup-v3.1-bs-doc-map.md (sections 6, 7, 8 and amendments P1 to P4).
//
// What it proves, and only this:
//  A. The amendment layer (tests/helpers/v31-amendments.mjs and tests/fixtures/v31-prechange.json) is well formed, and the actual 3.1.0 bytes
//     of the ten amendable files are the independently pinned 3.0.0 baseline plus exactly the recorded amendments: insertions, and the closed
//     list of named replacements of plan section 7. The gate engine below is THIS FILE's own. It never asks the helper to decide pass or
//     fail, every baseline identity is pinned here (not read from the helper or the fixture), and the helper is only compared to it. That holds
//     for each approved replacement too: the complete identity of all sixteen (id, file, both anchors, old, neu) is pinned in APPROVED below,
//     and the helper records and the fixture are compared against those pins, so a consistent change of an id, an anchor or a text is rejected.
//  B. The gate is proven by mutation controls on synthetic data, each checked for the intended failure and not just for "something failed".
//  C. Actual inherited obligations survive in the actual bytes (normative baseline lines, the 21 retained C14 adoption sentences, the TODO
//     lines that stage 1 keeps), and new text carries no listed weakening phrase.
//  D. VERSION, headings and the current public claims agree on 3.1.0, historical claims stay, and RELEASE-NOTES-3.1.0.md keeps the notes
//     contract and states the live acceptance as pending evidence.
//  E. Everything else is unchanged: assets (canonical agents, wrappers, templates, tools), scripts, installer and builder, data, evals,
//     historical notes, runners and the historical test sources; only the exact validated notes path is excluded from the enumeration.
//  F. The installer installs 3.1.0 into both destinations in isolation, and a synthetic tagged repository builds the actual 3.1.0 payload
//     with its matching notes.
// What it does not prove: that an agent drafts a mapped project correctly (tests/bs-doc-map.test.mjs states its own evidence boundary and the
// live acceptance document covers the rest), or anything measured on a host. No resolved measurement belongs in stage 1.
//
// ---------------------------------------------------------------------------------------------------------------------------------------
// INTERFACE the implementation MUST provide (this file is written before it exists; both files are implementation deliverables).
//
// tests/helpers/v31-amendments.mjs (test-only, never part of the installer payload; importing it reads no file and starts no process):
//   AM31                frozen object: id -> frozen { file, before, old, neu, after }, all strings, LF only. before + old + after is the verified
//                       3.0.0 slice (commit fd7ae54) and before + neu + after the 3.1.0 slice. Keys are relative to project-setup/; the three
//                       repository-root files are keyed "@root/<path>". An id is a plain identifier ([A-Za-z][A-Za-z0-9_]*): no wildcard ids.
//   FORWARD_ORDER31     frozen object: file key -> frozen array of ids in apply order; every record appears exactly once, under its own file.
//   REVERSAL_ORDER31    the exact per-file reverse of FORWARD_ORDER31.
//   AMENDED_FILES31     Object.keys(FORWARD_ORDER31).
//   CURRENT_VERSION31   the string '3.1.0'. It is a NEW constant: FINAL_VERSION18 stays '3.0.0' and keeps its historical meaning.
//   reverseSteps(text, ids) / applySteps(text, ids)         { text, failed } / text|null over a list of ids (text null and failed = first id that
//                                                            does not stand exactly once at its anchor).
//   reverseForFile(text, rel) -> { text, failed }; applyForFile(text, rel) -> text|null   (all of one file's records, in order).
//   read30(absPath) -> Buffer   the verified 3.0.0 view of an amended file of the real tree; any other path is read as is; throws when a
//                       reversal does not verify.
//   to30Tree(skillDir)  after a copy of the real project-setup/ tree: reverses (verified) the amended project-setup files and removes ONLY
//                       RELEASE-NOTES-3.1.0.md. It throws on an amended file that does not reverse.
// tests/helpers/c18-amendments.mjs: readRc4 and toRc4Tree compose the verified 3.1 reversal FIRST, then the existing 3.0.0 reversal; the
//   dispatch covers the union of the C18 and 3.1 files; AM18, AMENDED_FILES18 (seven files), RR18_*, FINAL_VERSION18 ('3.0.0') are unchanged.
// tests/fixtures/v31-prechange.json: exactly four top-level keys:
//   { "schema": 1, "baseCommit": "<full 40-hex sha of fd7ae54>",
//     "files": { "<amendable key>": { "sha256": "<baseline sha256>", "bytes": <baseline byte length> } },   // exactly the ten amendable keys
//     "replacements": { "<id>": { "file": "<key>", "old": "<exact permitted baseline bytes>", "oldSha256": "<sha256 of old>" } } }
//   replacements has one entry per AM31 record with a nonempty old, and no other. No baseline file text, no personal path, no secret.
// tests/live/BS-DOC-MAP-ACCEPTANCE.md exists and uses only $env:USERPROFILE\.claude\skills and $env:USERPROFILE\.agents\skills for user paths.
// ---------------------------------------------------------------------------------------------------------------------------------------
//
// STAGE 2 (a follow-up commit, after the maintainer's live acceptance) EXTENDS this file; nothing below is skipped or hidden meanwhile:
//   - STAGE becomes 2: the allowlist gains @root/TODO.md baseline lines 72-75 (the competing-document-homes subitem, no RFC 2119 word) and
//     APPROVED gains that one closeout record (APPROVED_STAGE2_EXTRA), the
//     only record allowed an empty neu (a deletion), and the TODO retention check drops exactly those four lines while the BS overwrite item,
//     the integration items and the reviewer residuals stay (control: deleting them alongside the closeout is rejected).
//   - RELEASE-NOTES-3.1.0.md loses "pending evidence" and gains the measured live results (dated, scoped, with the residuals named); the notes
//     contract then requires those sections and still forbids resolved 40- or 64-hex IDs (artifact IDs stay in the acceptance evidence).
//   - The gate runs once more with its own exact amendment set (stage-1 records plus the one TODO closeout record), unchanged otherwise.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(SKILL, '..');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const absOf = (rel) => (rel.startsWith('@root/') ? path.join(REPO, ...rel.slice(6).split('/')) : path.join(SKILL, ...rel.split('/')));

// ------------------------------------------------------------------------------------------------- independent baseline pins ----
// Everything from here to the "end of pins" line was generated by a scratch script from the git blobs of the base commit (read-only
// plumbing: git rev-parse, ls-tree and show), each value cross-checked against the working tree before this file was written. Nothing
// here is read from the helper or the fixture, so the helper and the fixture are checked against these values and never the reverse.
const BASE_COMMIT = "fd7ae5406ce16fca8444bb574be35704f319ba1d";
// SHA-256 of every project-setup file except tests/ at the base commit (the 3.0.0 source, notes included).
const BASE_FILES = Object.freeze({
  "CHANGELOG.md": "f5a0b5bc6c9667d8a0d6f38a7d019da59c1b8d0f8add1773eb415a4f8f1242d2",
  "README.md": "b7fbc19e9b1ac149c872a74caae2b813b957daa8f5c59f0c4acdfba382f2cc0c",
  "RELEASE-NOTES-2.0.0.md": "27711d116ec2ee4ba012b9cdaec198703e154055341cba793472d2ee79886eba",
  "RELEASE-NOTES-3.0.0-rc.1.md": "5649a736b4b5992d77672bb0f80dcfbf54256b7ef08a01b608204c968395ee64",
  "RELEASE-NOTES-3.0.0-rc.2.md": "4cbf9b9c2573f149e20234985ac7c1867fd256b56e551af8b970ea81d6b89cb4",
  "RELEASE-NOTES-3.0.0-rc.3.md": "68b1921f91d7c821989d810e689894ec0cfaabe494fb61486fe8e2c56ad42fd4",
  "RELEASE-NOTES-3.0.0-rc.4.md": "5340acd88c392c5fcc2be5d2c908639e6c10d55247d60d678c39e38d76dc55b2",
  "RELEASE-NOTES-3.0.0.md": "fc48e03b7dcd671dffb75c6d108ee53831b00096c25d021333f88e448c24ff28",
  "SKILL.md": "6f62732e018228e2ebe518aca9d17d075893d2b39399c79a607de818b40a3f15",
  "VERSION": "2985be8b28d3ade858e8d8fb4bc22f565b1bf6020dff982dce141f7721b9999c",
  "assets/agents/docs-sync.md": "605398911043231f4ec53358986988ccbe8d5648beb0e918ee955d8104fff814",
  "assets/agents/reviewer.md": "696f86bc03f8506075e868465a2b34d76b6384a2809ed1e4ea949cc50f6a305c",
  "assets/templates/AGENTS.md": "616a26a54d2e8f77b0d4df3e78055ca41f6e7638654ad70a0f4d28a0e4eb5a0e",
  "assets/templates/CLAUDE.md": "5bb1d5ed697e921dcc839d031e082f884ca9a97a1eafd8d4a003d2ddb1cbaa47",
  "assets/templates/TODO.md": "ebb2588b4c6e2254b1410b91212bf8db88fc315c402114be6e2954a7e0c9a84d",
  "assets/templates/adr.md": "45b92605a73d8fdda6d6009698b92f60c87fbba7e3f62f6ee3278cc6483e4ffd",
  "assets/templates/gitignore-block.txt": "34c13766d597a8fe6fee66709a24216d4e8cd7c364cae551fef458a8a10dc3b2",
  "assets/templates/nested-AGENTS.md": "11cd44a06e9e50023e8ddcb5e8d476e2338b206c2973e6d4ef6f53997b1ed370",
  "assets/templates/nested-CLAUDE.md": "336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49",
  "assets/tools/git-safe-core.mjs": "d8e7e573b8dfb9edbee90023838547a2b0cae694cbcdc9e66b22a0b4659bcb7a",
  "assets/tools/git-safe.mjs": "995bafa72582acad616982549e4c0aa581831bc25b132f83a533f7bad91bb154",
  "assets/tools/guard-raw-git-core.mjs": "cee120da3205767a4b2e17515948be55185d047175c8f5d91d38eeaa4d9210c9",
  "assets/tools/guard-raw-git.mjs": "7b6b8e7e5d11850656f8395563c0f6d0788a234fbc01b9642b30ae231862276e",
  "assets/tools/hooks-selftest.mjs": "175fa8611582fe0c8eafd8032c5dbb3c6e981e8cf9f710653c87529b58f6ba66",
  "assets/tools/review-diff.mjs": "745d55310baebb72c1683ff6022e1ed8517e370cd5c2ccbc0e5d8bbb4b8d7653",
  "assets/tools/security-policy.mjs": "2ded982e54580fc993add5b4003bc892dd08e230ea3c7d98892fccdb6fc83dbb",
  "assets/wrappers/claude-docs-sync.md": "36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43",
  "assets/wrappers/claude-reviewer.md": "284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423",
  "assets/wrappers/codex-docs_sync.toml": "1e6eef9ae6d75c0fef3c79b9879a0d69c4ad88d774889b81d09558cd61af6287",
  "assets/wrappers/codex-reviewer.toml": "fe21c05b09bcba96b631bb08e22e6be807cdc8e0c75a740acff1b70c683c695c",
  "data/runtime-units.json": "a1867f13ce2760cb1a676a48cdaac5a9fe4a868220dbaf7f528b169b64678ef6",
  "data/secret-paths-v2.0.0.json": "38198a9d326843d69c52034158f7287f71e861fea06bc884ff49ad56a56fa8a6",
  "data/secret-paths.json": "37711ab7b8e1781ce533c705971f93351f1331a44b16e11e846080eb8fed1a79",
  "data/v2.0.0/assets/agents/docs-sync.md": "217562b10ee8d43f47d085307172921f8789b7e8373056f9475e9642bf448571",
  "data/v2.0.0/assets/agents/reviewer.md": "06dd68ac2019369f03e66fc3729a9522286487e643b319a1cd52695d2d35b12d",
  "data/v2.0.0/assets/wrappers/claude-docs-sync.md": "36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43",
  "data/v2.0.0/assets/wrappers/claude-reviewer.md": "284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423",
  "data/v2.0.0/assets/wrappers/codex-docs_sync.toml": "d860e92f20147e70ec61f7fbaaa79d18b385bd7bc8ac247f1f43d2d179f873f0",
  "data/v2.0.0/assets/wrappers/codex-reviewer.toml": "017b9c905f5cc033552ce981340ab04fd794bd8615f8745fe9c1f3048a52bddf",
  "evals/evals.json": "bff1fb4c407b602c0adae3f6e6397f28c25573df8c81bafe8dab17f15db4ea55",
  "install/install.mjs": "9e22d4192aed1c504053e9c499bdaf98450a7bd0a80e44b0aeb4b11b19d5b947",
  "install/release.mjs": "59411fee9168dd936e3e049f5e6242c93cb89c5207a574df181c259f961ba941",
  "references/claude.md": "e4ffc479e77ae295049e8de3a933611facf28162e28205179fa55a5dc74b5913",
  "references/codex.md": "93bf8405651bcdee3ed38638b13ac6a20550f06e72cf257bb1b002e7b3939e45",
  "references/docs-generation.md": "cabdf9cd7df65ee9d7660abc4cf9b95eb0e3f9c1386ea069ec87d55322616503",
  "references/migration-v1.md": "ddba0903b66989812113ccdd16357c7ac964cf282f94b03e9107112dbd7e4a68",
  "references/migration-v2.md": "b4ea4fc870d4c3a9aeea70b817511c62bce6924c6c71f222c2eff094fc8e29b1",
  "references/modes.md": "376435f0faaa768486607c5a6ee461f0795ea6b92cb0b5a0a4d615ae67917bd7",
  "references/report.md": "8d7d3fa6e834895a29d6df64c8768c9e85e35e6a8a68fc30bd4ca7d545056b64",
  "references/security.md": "60bcb592aa29d67d52416f66ee159a944d445089a97a4d12d9f054424a537db8",
  "references/state-and-apply.md": "2c99f9ac0dd9e98656308dec605c8e330dd5e2029f4ce19c773c8ca101eaa3b1",
  "scripts/apply.mjs": "5f2ea3801be0ecae370a453e8a822c336e404c7622bac276a9a873d069da6874",
  "scripts/blocks.mjs": "fcb6606fbfae71b69033bf09c09d608ac65333234c9ae14d212b112daec20753",
  "scripts/canary.mjs": "24d38a195496ffc802f5de3d2aa83b7139c6af0480d953eee2f9bf4cac83e8fe",
  "scripts/check-agent-baselines.mjs": "905c0254d37026eac46aa16976db7726b8abb08349352941f781ce232dae9be8",
  "scripts/classify-allows.mjs": "87f25ca2ecd8fc107e56f296de25b45739e86ecb017d4349e4cf54f795e4612e",
  "scripts/detect.mjs": "485bacd5200319f03b41006fae447718639a74edba4306da63a3e8a9ca4af982",
  "scripts/doctor.mjs": "7d9ee5f39931f13a35a5a9a9bb42e1af6977469485f7debb44a95acb6b8d8d06",
  "scripts/env-keys.mjs": "81329bc2b4a47a0c0c3570f8c6232c2de0554fff513a02fced6faaadfb10382b",
  "scripts/globs.mjs": "4eb71ed206deb641e9032d691e4f3b431e76548fd46ffd6275f6e339fcc59892",
  "scripts/lib.mjs": "7a3f8d32cd1af31f20ff67888cd483165e8dbdfb77a28eb50df21e30bb4cb8fd",
  "scripts/lock.mjs": "fee94a6bac74fa2650cf62fbbfd7569dab5790c391c470c4ff55ffbea068714b",
  "scripts/merge-claude-settings.mjs": "c56888d586c26f64a40afaef095a5df1a7d82551f65aabf3318d433f1709b7fe",
  "scripts/migrate-security-paths.mjs": "0da9855b6351392bb89b2fe5d749f351279139384a1e50ff9cf1e6c9890ea3c1",
  "scripts/ownership.mjs": "dd936e399d465115acf58644024c0b7b179a95a88c0874fd7ed4b7528d13c864",
  "scripts/render-permissions.mjs": "a5c8a88dbdacc743954ed825665e626fefbc2550a025fc8ffb0321bc7a7480ab",
  "scripts/schemas.mjs": "48e4cdedf5a44f097f88da54820e81e1e432fcb53a2db887f864588a01f0ae22",
  "scripts/secret-scan.mjs": "4a77e284014cf8b9d2e7c46b6cc0bde7c5c1c1e7b8f0825807563f2d740869e8",
  "scripts/toml.mjs": "86b1139dd3e98fd151999298ae7940d7c418d11859a6179e3459a03721728391",
  "scripts/validate.mjs": "5b4de7189fdfebed53efa14e2e86524462becdab62b800448a435f0807bc6070",
});
// SHA-256 of every file under project-setup/tests/ at the base commit.
const BASE_TESTS = Object.freeze({
  "tests/REVIEW-live-rc9.md": "17aaf8cf08d43dbcd627cc8ded82b0b8f30bce4fadb7392749f6e4144a3dbe7c",
  "tests/REVIEW-rc1.md": "a158925060bd341286132ff5dd911e5ab326f61752c0ca807b02b28b3074a328",
  "tests/REVIEW-rc10.md": "da05f3c1975bdcf6d2837cdd7834a409157a6afa9d987192d03356ffa576c73d",
  "tests/REVIEW-rc2.md": "9957193c369c33caf18a8609dbc6d9e926e3a76f5d0a79d010456993e5781bfb",
  "tests/REVIEW-rc3.md": "26316dd46c5f8185c74d86bbe9d981a2c060e368728694685e0ddb613afcb3ad",
  "tests/accept-rc1.mjs": "bb75d010152971f95dcdd5663794bc8d3ab0f8cacd99cc474636c6f0ce6155ea",
  "tests/c1.test.mjs": "2baf3f8e2c675d3dd2327183b425e97ca21e34eb58606f1332ebf0ba707a0456",
  "tests/c10.test.mjs": "9baa081075a77144e5983407f7395663458ffcc41c0a75a096b83f069f87e253",
  "tests/c11a.test.mjs": "d4a1e6e2a3fe1bb11296eeae786b7f2f01f6c2a450253749d6ed61d397a0d6c4",
  "tests/c11b.test.mjs": "a6a3022dd62a1e28c12e3bd4ae00c855f729cff476a261ae1da61755cf5afe66",
  "tests/c12.test.mjs": "1484f30bbeeb6bd4b173e56e75d2940d833b54ed582c2041fc374b9e422cc19f",
  "tests/c13.test.mjs": "9461136d582716e5b166b2e401e932b52d697aa7d794e8f1794fbd52ddb2fc5c",
  "tests/c14.test.mjs": "afbd6b6d091014abe80b2b1f794c4bbcac957488356bbd063d813331eaa8d526",
  "tests/c15.test.mjs": "2b7103f6142b49d92cec69d0e23df389de33c30f3cb2b4b91069bd68483abffb",
  "tests/c16.test.mjs": "94976d7a98146935e64a43bb73dc23749e805d0fe610009fe6fb88d6273f43f8",
  "tests/c17.test.mjs": "df0d01eb35f4dd55e66ac36b38e58c4a97e33f479340f5a6e31c873a2a16f669",
  "tests/c18.test.mjs": "a9d4d0c80d9503e0106f769b6c64080530999a1b1a07445e0cbb2dda7109ac1a",
  "tests/c2.test.mjs": "e02b19b3dd9803cf7f489e33628e33ca5230ed24b7678dc758d5c071ef2ae414",
  "tests/c3.test.mjs": "0b144d8670615f0bad233dc689c1a1af231c26c24f7a30539e8bb5cede5f2b00",
  "tests/c4.test.mjs": "f4e54963c0fc15ea444d5316ae1d1e0bd7abedf3806b48318ba3ec3539c044c3",
  "tests/c5.test.mjs": "943119547b89b81ffb907f5998b44f1586fa23e9f371087a0dc419876caeac8c",
  "tests/c6.test.mjs": "e48253e9b15b79c4270c2914e53bf6586059ef2214e580646a1e76a2914ca429",
  "tests/c7.test.mjs": "d1570c774c1c6ae5153210a0b616271a33d877ac7195c0d310c4c34b7f1b9c7e",
  "tests/c8.test.mjs": "bb8193f8dead4f0681453899c0e3c2cdf0cf9fede1112a044a588a400938638b",
  "tests/c9.test.mjs": "42958af4f2b56c66110051987e696925f4f43f01be71f63e10010860b33341ff",
  "tests/fixtures/agent-migration-cases.json": "33d35b81f3172228b1eaf6841af0a07ecb99eaa946ade134864bd9ae9d45ff95",
  "tests/fixtures/allow-cases.json": "ed96a692e880344c305c54f092471c51f80d4cefe52c0a9858337fa8ec2f9900",
  "tests/fixtures/c13-rc1-agents.json": "8d39154626167e0e3b427e0688ab2e088052a42f8b2b074662eec84a609758e2",
  "tests/fixtures/c14-prechange.json": "fc7e57ca8fb04b2f611057630ca9213798f49c18153ed13067b53a1711770175",
  "tests/fixtures/c15-prechange.json": "79e0c2ddb56dd45b314006a4aa6fb4db4bb817e0cb308194710ef11f755fe3ad",
  "tests/fixtures/c16-prechange.json": "7853616ebbf2483e098bfaba530f962bce42401740cca603f94a153346a3cbdf",
  "tests/fixtures/c17-prechange.json": "bf3436d54b9c046edea5ee2b339d0a25412beaf6cdc10a4e4ffc00f84e1efa65",
  "tests/fixtures/c17-upgrade-baselines.json": "0f9532eefd2514291aad44dae0c2200added3348089922eec7f8ebdf7db8b1b9",
  "tests/fixtures/doctor-cases.json": "751a14a91a9c055df02563b152e472f2a5adc3348ba49eeec6f37b13bbfd40b2",
  "tests/fixtures/git-safe-cases.json": "9e1446c27a559c0f7ecfbe06fbf0edc161a36f2605460291fd3d5c5878b63284",
  "tests/fixtures/guard-raw-git-cases.json": "9417db42250fe5dc02304bf2538652f36debfcfed2834f35fc1dd451aa26d7be",
  "tests/fixtures/rc1-migrations.json": "d644f080879ec5af43289cdec446b5edeb72c086be70a35c5cf231ecf86ec5d4",
  "tests/fixtures/review-diff-cases.json": "195f82a13a3fc91de399c9a3ea8add6f451dd3ed8b0708d95a6821e0f344bf15",
  "tests/fixtures/security-policy-corpus.json": "8bfab9ee8b242740ab553f8c0daed3ce128100109de5d22eb57f058990ced8e1",
  "tests/fixtures/toml-corpus.json": "2eb3f17d288f725a2ad18681a80b545ca23fd4b3efe2f5254b11d952222fae68",
  "tests/helpers/c15-amendments.mjs": "724688e375a33a1d7236b95acba2196dbab5a1f2c0846de128f8c1d490a13725",
  "tests/helpers/c16-amendments.mjs": "dfe6ae600532ceb8bf9539a242330bec8d1682019ad0a67576621e69a12f8a33",
  "tests/helpers/c17-amendments.mjs": "a8f3682b4e7f5e373116c2f6b4201c3a3b8e750c26b7e9e2a3d7ac4d2251ed54",
  "tests/helpers/c18-amendments.mjs": "065870ba7611e83d7ddf7170e40f3231e4a16ced2c0c1ef4683cade5e4959644",
  "tests/helpers/prose-check.mjs": "465531aaf0b733045a4af1b51fc91737d7e08465ad93bcfb8b3e09b76ed8d1b0",
  "tests/helpers/rc1-integration.mjs": "267ee65ae6aabd41363c3b9b42c971691ce21ab9cbef53fdd9daa10a741507bf",
  "tests/helpers/v2-baseline.mjs": "85548f284857bb66a83935703357540c776b4c126e4c1c9e65e91b21585b029f",
  "tests/live/LIVE-ACCEPTANCE.md": "6ec4caa7a501e7baab887427f736e36a0e46de881376e546903890757baefa67",
  "tests/live/make-fixture.mjs": "0d947c469cbb6483f7e72e168334030677ddda7394fdf1b7c221c2cf70d3f2e5",
  "tests/rc1-cases.mjs": "3caaa3cd1a6c46c43bdc15874d8690be5c1e1849c18c0560902e5f32af660dad",
  "tests/run-component-tests.mjs": "864b037dcb03eeecca4ef52bc1802a4c4e98ab0ac17a56013c2d7e72a17491df",
  "tests/run-tests.mjs": "bea24641a28b5b69b52c82cf4679145fa8cb4cbb0a96e8423a13649ea8fe4a00",
});
const BASE_ROOT = Object.freeze({
  "@root/README.md": "d5e700cd14549b63be51eaddc0dba2dd868fd3b82197296a7d3a2ab222d06cd5",
  "@root/TODO.md": "e18aad7b0db37b6864417fd46572a77f90ff2be419949087ddc33a130d0751a2",
  "@root/.ai/context/project-tree.md": "ad472b829f1eb7be07e6f6b76051912b952f5b08931fa3df40a9db4a16a79760",
});
// SHA-256 of the rc.4 view (what c13 to c17 read through readRc4) of each amended file at the base commit.
const RC4_VIEW = Object.freeze({
  "SKILL.md": "b02bd65f8b06d93103386c75a27ed42da92b0f42b0ea69f05218c7ef19deb110",
  "README.md": "87889689e3f47acf9599addb4336a00098e7fe32ad5730e5b74c666f2d965af3",
  "CHANGELOG.md": "2a23bf2f6262346f59211383fede3238327a990d9208c0211a7bc630be1c7832",
  "VERSION": "349c8134f8444a63fa3c95b36b334a5f878e2ee1ad8b4f9ddbb296cf25969d06",
  "@root/README.md": "0f11d10eacbd9548788d3c4275da8fb9b4760ee1b603e69d20f60ba15a262981",
  "@root/TODO.md": "fbb493a75fd2297db0a98a7aa5543eff8626ed0655da49200b87539a7d563e79",
  "@root/.ai/context/project-tree.md": "fc0fa5e772c9a053d0e3eb48c7e3bad05d92204eda9b3f18af2125bab86a6c5f",
});
// Distinct 64-hex identities pinned by the historical test sources and helper at the base commit; they must all remain.
const HEX_TOKENS = Object.freeze({
  "tests/c11b.test.mjs": Object.freeze([
    "16a836b7a231cb3fec1670455650a43a278ba3540c579bbedb4630b9ffba0d4b",
    "27711d116ec2ee4ba012b9cdaec198703e154055341cba793472d2ee79886eba",
    "36f2304fa94d385fc61b48481ceb8f98824f1487966c7e376116b19ce757618d",
    "390782771ef21740d67e8c3c53a8d90a3d2f113fc45d42dee460141ebb769aaf",
    "48b9c39c5858d9609f2af1d15aec4214983e5386ad91f8cd2c16a5657bf59cdb",
    "6e01671bcb5994f667808a67e0c481ea88e4289d31fe6df9301a16153929a636",
    "8fadcdcd4c7c7dd256b710b023d4f5f4283fbf2db40fa1859d64a9b39df7ff62",
    "9e22d4192aed1c504053e9c499bdaf98450a7bd0a80e44b0aeb4b11b19d5b947",
    "a502dc650bd566d05485a1b0891de8aaeebe06072371701de3db020ae2859bd9",
    "f3a4c0b1f33d156cc08dbcbec50c84ed842ecaf9ed28c9de2ddfcd5b9e7ba5e1",
  ]),
  "tests/c17.test.mjs": Object.freeze([
    "017b9c905f5cc033552ce981340ab04fd794bd8615f8745fe9c1f3048a52bddf",
    "06bd660c48ee75214b91240b794f71042c8973a928a7fc5f458bfd4b0b12c4c8",
    "06dd68ac2019369f03e66fc3729a9522286487e643b319a1cd52695d2d35b12d",
    "0b3c3712aac615a7a09ada4ac848b959af2c664c1cb196559b6901cb47b702c6",
    "0da9855b6351392bb89b2fe5d749f351279139384a1e50ff9cf1e6c9890ea3c1",
    "0f9532eefd2514291aad44dae0c2200added3348089922eec7f8ebdf7db8b1b9",
    "11cd44a06e9e50023e8ddcb5e8d476e2338b206c2973e6d4ef6f53997b1ed370",
    "135028b89b86ed0f3dcfe46c07119012b8f3ff2b6903fb51a591b833792ea13b",
    "175fa8611582fe0c8eafd8032c5dbb3c6e981e8cf9f710653c87529b58f6ba66",
    "195f82a13a3fc91de399c9a3ea8add6f451dd3ed8b0708d95a6821e0f344bf15",
    "1e6eef9ae6d75c0fef3c79b9879a0d69c4ad88d774889b81d09558cd61af6287",
    "1f7a9ddae2c71d1de3a61ee64541fc8924e739f1fad134d25610bfd2b9394f7a",
    "217562b10ee8d43f47d085307172921f8789b7e8373056f9475e9642bf448571",
    "24d38a195496ffc802f5de3d2aa83b7139c6af0480d953eee2f9bf4cac83e8fe",
    "2762eadfda90518f841b455ed0e37676b17fcdd7be260bab039a663c8a0c7ab8",
    "27711d116ec2ee4ba012b9cdaec198703e154055341cba793472d2ee79886eba",
    "284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423",
    "28af6303436e9c3fce397afbb203265d64bee023b1695fd964d3611b5cd4fab2",
    "2c99f9ac0dd9e98656308dec605c8e330dd5e2029f4ce19c773c8ca101eaa3b1",
    "2ded982e54580fc993add5b4003bc892dd08e230ea3c7d98892fccdb6fc83dbb",
    "336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49",
    "34c13766d597a8fe6fee66709a24216d4e8cd7c364cae551fef458a8a10dc3b2",
    "36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43",
    "376435f0faaa768486607c5a6ee461f0795ea6b92cb0b5a0a4d615ae67917bd7",
    "37711ab7b8e1781ce533c705971f93351f1331a44b16e11e846080eb8fed1a79",
    "38198a9d326843d69c52034158f7287f71e861fea06bc884ff49ad56a56fa8a6",
    "4148477e45a82305663defdb5545a9640ccfd5f89c31861f4171e8fb3026c7b2",
    "45b92605a73d8fdda6d6009698b92f60c87fbba7e3f62f6ee3278cc6483e4ffd",
    "465531aaf0b733045a4af1b51fc91737d7e08465ad93bcfb8b3e09b76ed8d1b0",
    "485bacd5200319f03b41006fae447718639a74edba4306da63a3e8a9ca4af982",
    "48e4cdedf5a44f097f88da54820e81e1e432fcb53a2db887f864588a01f0ae22",
    "49596e4814ef48880a6e08ea2741f667a29c2aa1a12ed098a9cb4b65dc9b3548",
    "4a77e284014cf8b9d2e7c46b6cc0bde7c5c1c1e7b8f0825807563f2d740869e8",
    "4c6eb90964c0106b4a1daa518524096eca4b6a428feab1dcb1cab8d3b981d5be",
    "4cbf9b9c2573f149e20234985ac7c1867fd256b56e551af8b970ea81d6b89cb4",
    "4eb71ed206deb641e9032d691e4f3b431e76548fd46ffd6275f6e339fcc59892",
    "54217f5ecc81c2e048b52ea8458d598a35129ec74dbf6aadea70462287fac458",
    "5649a736b4b5992d77672bb0f80dcfbf54256b7ef08a01b608204c968395ee64",
    "59411fee9168dd936e3e049f5e6242c93cb89c5207a574df181c259f961ba941",
    "5b4de7189fdfebed53efa14e2e86524462becdab62b800448a435f0807bc6070",
    "5bb1d5ed697e921dcc839d031e082f884ca9a97a1eafd8d4a003d2ddb1cbaa47",
    "5bee9e326243ae5bdfe3daf639c27db10f601b4312f081cf61e633bfd1a84977",
    "5f2ea3801be0ecae370a453e8a822c336e404c7622bac276a9a873d069da6874",
    "605398911043231f4ec53358986988ccbe8d5648beb0e918ee955d8104fff814",
    "616a26a54d2e8f77b0d4df3e78055ca41f6e7638654ad70a0f4d28a0e4eb5a0e",
    "62ab18386d6143aa53c98e64361844f93fa799e67ec2b42af1c73381e9c4a1de",
    "64ce67a7c5568488e64f7649ea95fa659f5b604c45f5048d94a1fd7413507210",
    "658e6d6b9369eb61833a4f1a93f0f58557c3fc140d3d6c60913628a9d409ea8e",
    "68b1921f91d7c821989d810e689894ec0cfaabe494fb61486fe8e2c56ad42fd4",
    "6a0bea8db90c18857cb8850f640848fee5bbb63cda34dbc9b641b5eaef3aa50b",
    "724688e375a33a1d7236b95acba2196dbab5a1f2c0846de128f8c1d490a13725",
    "73eacec1cceccf8112e781e882e3d0e867dd46b8ba6817f75b15cd7ddaecd498",
    "7853616ebbf2483e098bfaba530f962bce42401740cca603f94a153346a3cbdf",
    "79e0c2ddb56dd45b314006a4aa6fb4db4bb817e0cb308194710ef11f755fe3ad",
    "7a1d6e004a0f5af60ecf77b7ff22141f08e59379b84ce31e9ced32c7dc87be93",
    "7a3f8d32cd1af31f20ff67888cd483165e8dbdfb77a28eb50df21e30bb4cb8fd",
    "7b6b8e7e5d11850656f8395563c0f6d0788a234fbc01b9642b30ae231862276e",
    "7d9ee5f39931f13a35a5a9a9bb42e1af6977469485f7debb44a95acb6b8d8d06",
    "8059a41c48a4ff78819ca5926ec81bba23f0c4fef29d0c710d77765f8c59ceab",
    "81329bc2b4a47a0c0c3570f8c6232c2de0554fff513a02fced6faaadfb10382b",
    "864b037dcb03eeecca4ef52bc1802a4c4e98ab0ac17a56013c2d7e72a17491df",
    "86b1139dd3e98fd151999298ae7940d7c418d11859a6179e3459a03721728391",
    "87f25ca2ecd8fc107e56f296de25b45739e86ecb017d4349e4cf54f795e4612e",
    "8aae599d95c8cab62ffb3da29354d3a00e3cf8d6c9cea1f7e144709a72dec802",
    "8d39154626167e0e3b427e0688ab2e088052a42f8b2b074662eec84a609758e2",
    "8d7d3fa6e834895a29d6df64c8768c9e85e35e6a8a68fc30bd4ca7d545056b64",
    "905c0254d37026eac46aa16976db7726b8abb08349352941f781ce232dae9be8",
    "911cc865b91a921b5771e8050ab35e03326e921d8674aebbf99ac81fcb06cdbd",
    "9417db42250fe5dc02304bf2538652f36debfcfed2834f35fc1dd451aa26d7be",
    "97d0f72e550f27f12fce591c04d23915868d3d1e7c3549cb9fa87d374fa14eb6",
    "98047599c326944dea419c3d5a5ea9ae6b94691bbdca464ea28a021783964a6e",
    "995bafa72582acad616982549e4c0aa581831bc25b132f83a533f7bad91bb154",
    "9baa081075a77144e5983407f7395663458ffcc41c0a75a096b83f069f87e253",
    "9e22d4192aed1c504053e9c499bdaf98450a7bd0a80e44b0aeb4b11b19d5b947",
    "9f2b6d1ae6a3c7dbe2f726b0df43fc806daa365ffa06f9ceafbdce31ee6ce39b",
    "9fbdc29eeb419100bd00dd882ffd8fbcbfd9a5dffec659f62e91eb6ba0358077",
    "a13aba6625bbcf249013ac90bfa672d6b856b38f6475a338de949f37dd1a9b42",
    "a1867f13ce2760cb1a676a48cdaac5a9fe4a868220dbaf7f528b169b64678ef6",
    "a4b1cd89501615a1d2b69620e33783a4405994c60099140e71037748988260b9",
    "a5c8a88dbdacc743954ed825665e626fefbc2550a025fc8ffb0321bc7a7480ab",
    "a63841f1ebf4dd11cdc420501e74daed07ae0b9b3553273c566331c033a27efa",
    "ad1c51db23444c022dcb4eca06d0b3fd52984cb1bf3230596a840f34203b5f85",
    "ae236ae32405497d5c9bb2340a5cebbe45d37b1c6d50367b478523cf7de06d83",
    "b4ea4fc870d4c3a9aeea70b817511c62bce6924c6c71f222c2eff094fc8e29b1",
    "bb75d010152971f95dcdd5663794bc8d3ab0f8cacd99cc474636c6f0ce6155ea",
    "bf3436d54b9c046edea5ee2b339d0a25412beaf6cdc10a4e4ffc00f84e1efa65",
    "c56888d586c26f64a40afaef095a5df1a7d82551f65aabf3318d433f1709b7fe",
    "cabdf9cd7df65ee9d7660abc4cf9b95eb0e3f9c1386ea069ec87d55322616503",
    "cca922bb9a1baf2e78168c0efcdaca77341fd7d6d0a922ac6a0a8863ae78bcf9",
    "cee120da3205767a4b2e17515948be55185d047175c8f5d91d38eeaa4d9210c9",
    "d3d5661331d7bd2acf65cf699e853d680e3e866559d0deb65f807b81c67c6e46",
    "d860e92f20147e70ec61f7fbaaa79d18b385bd7bc8ac247f1f43d2d179f873f0",
    "da65b61809819f3046ce593b9883e3bf2144ff2ab7a031932f3f3e6c70b03944",
    "dd936e399d465115acf58644024c0b7b179a95a88c0874fd7ed4b7528d13c864",
    "ddba0903b66989812113ccdd16357c7ac964cf282f94b03e9107112dbd7e4a68",
    "dfe6ae600532ceb8bf9539a242330bec8d1682019ad0a67576621e69a12f8a33",
    "e48253e9b15b79c4270c2914e53bf6586059ef2214e580646a1e76a2914ca429",
    "ebb2588b4c6e2254b1410b91212bf8db88fc315c402114be6e2954a7e0c9a84d",
    "ebf6df3a571820278b45f5fa7e3c01604b69812c10593fd80a9bfe951f064afa",
    "ee5e402b523b29e1c57896a0c9200f50725b268edd3f68fbfde98e022f23f5bd",
    "ef2f32bda081d9597a6cfdd463b76a9c85f128974ab3d583f6e8be69464672d7",
    "f0e1d2c3b4a5968778695a4b3c2d1e0f00112233445566778899aabbccddeeff",
    "f356008b89e2c0bd96e314f7d1c05c344bcff8715cfb18bbcd501e60ad43949c",
    "f43ca4c9bae80cbbf7959e9e3ed6a82f130e1feb04889e5cd2240744087a2b31",
    "fb3278a2bee34554c83bb9a1303d82e06932daaf310584843affd44ca844a495",
    "fc7e57ca8fb04b2f611057630ca9213798f49c18153ed13067b53a1711770175",
    "fcb6606fbfae71b69033bf09c09d608ac65333234c9ae14d212b112daec20753",
    "fe21c05b09bcba96b631bb08e22e6be807cdc8e0c75a740acff1b70c683c695c",
    "fee94a6bac74fa2650cf62fbbfd7569dab5790c391c470c4ff55ffbea068714b",
  ]),
  "tests/c18.test.mjs": Object.freeze([
    "04f318f70302c03164ba354dc7520f19ab96ef78c723963dfdc054ac0a1f6957",
    "0d27ab448bea3886559af48249dbf8fe7e6e7c1b560b723df604c467ffc55dfe",
    "2a23bf2f6262346f59211383fede3238327a990d9208c0211a7bc630be1c7832",
    "349c8134f8444a63fa3c95b36b334a5f878e2ee1ad8b4f9ddbb296cf25969d06",
    "417bb45a27811581bb9ff91d4140d5d982a002b86490401d24f3747d685ab3ea",
    "71cd5d9c9934ef0f651cdfcf12d9dd9bbb174f6243ba3c82a0703580a08ad254",
    "87889689e3f47acf9599addb4336a00098e7fe32ad5730e5b74c666f2d965af3",
    "b02bd65f8b06d93103386c75a27ed42da92b0f42b0ea69f05218c7ef19deb110",
    "fc48e03b7dcd671dffb75c6d108ee53831b00096c25d021333f88e448c24ff28",
  ]),
  "tests/helpers/c18-amendments.mjs": Object.freeze([

  ]),
});
const RC3_PINS = Object.freeze({
  "RC3_CHANGELOG_ENTRY_LINES": "d66a8de5d31a54f56ea4f1a0b205ae67dc973c7e5aa669d6a957a01d8aa18fc1",
  "RC3_SKILL_HEADING_LINES": "440409a3037dc95a9d0a7419541496c6744af61cab30f42bc58056e0fbd4d9cb",
  "RC3_README_OPENING_LINES": "bb3729dadc9dc2acb2d7962401a257b76a5aef34029f238fc2b95b53bc30778b",
  "RC3_RELEASE_NOTES_LINES": "db43453568a42c8c63d73219f9cd020e1a5d63db193a4ae034d3d167541ba5c1",
  "RC3_README_RELEASE_SECTION_LINES": "89090253c8022a10c3b30ce7630913744e541bfcf42aa8bc2b7e30ad95d5b283",
});
const AM18_SLICE_SHA = "d8d811995d215517e51b1faea20cd34e4bb59f2b651bd211277c7161e8105c27";
// 16-hex digests of every baseline line holding an uppercase RFC 2119 word (squashed), per amended text file.
const NORMATIVE_LINES = Object.freeze({
  "SKILL.md": Object.freeze([
    "4073b99c6df374fb",
    "4b9b1a59bd97a196",
    "52560c772e148372",
    "88aef36e923d28ad",
    "9f0809dd2f6e89e9",
    "affe999c27ed2fb7",
    "d4e39498669cbfd4",
    "d75185b7e7938521",
    "e22f124f807be954",
    "feb0e901a8a89340",
  ]),
  "README.md": Object.freeze([
    "4073b99c6df374fb",
    "a5a8a889caac77e1",
    "d75185b7e7938521",
    "e4970192cfd4fd18",
    "feb0e901a8a89340",
  ]),
  "references/docs-generation.md": Object.freeze([
    "09886b8abb1614d2",
    "1069f370bdcc876e",
    "465e5e8209c28311",
    "4b12ed9521239464",
    "5de4a74b6a3e48d9",
    "5f543caeb7260370",
    "65573f38d67f2449",
    "7dd9c98ba0a1f81a",
    "87d9f59704477d19",
    "8c7f5b4fbd2023fb",
    "8d06980f82327e81",
    "8d1095a02925a89d",
    "9975979d5100dc21",
    "a6589ab046a38250",
    "a851bd21cf988edb",
    "b7b0ab9f9d784a22",
    "c031e4f4ffcf8cbd",
    "c7c7abc812ed369b",
    "d7f248943853550a",
    "dfc8e9f00496cef5",
    "e82a9a49c6193433",
    "fff946122155c0b1",
  ]),
  "references/modes.md": Object.freeze([
    "0cdb3f9446bed7d0",
    "990962db45c0f792",
    "ae66e73f74731d09",
    "db73cf5c60d90f8f",
    "f6fe18db9c93e6a2",
  ]),
  "references/report.md": Object.freeze([

  ]),
  "@root/README.md": Object.freeze([

  ]),
  "@root/.ai/context/project-tree.md": Object.freeze([

  ]),
  "@root/TODO.md": Object.freeze([
    "c5a43a6f29bbf636",
  ]),
});
// ------------------------------------------------------------------------------------------------------------- end of pins ----

// ------------------------------------------------------------------------------------------------------------------------ harness ----
const STAGE = 1;
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: ok === true, detail }); };
const attempt = (fn) => { try { return fn(); } catch (e) { return { threw: String(e && e.message ? e.message : e).split('\n')[0] }; } };
const failedAttempt = (v) => v !== null && typeof v === 'object' && !Buffer.isBuffer(v) && Object.prototype.hasOwnProperty.call(v, 'threw');
const has = (o, k) => o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k);
const lf = (s) => s.replace(/\r\n?/g, '\n');
const squash = (s) => s.replace(/\s+/g, ' ').trim();
const lineDigest = (l) => sha(squash(l)).slice(0, 16);
const KEYWORD = /\b(?:MUST|SHOULD|MAY)\b/; // uppercase RFC 2119 words; the negative forms (MUST NOT, SHOULD NOT) contain one of them
const msgs = (ps) => ps.map((p) => p.msg).slice(0, 12);
const loadModule = async (rel) => { try { return { mod: await import(pathToFileURL(path.join(SKILL, ...rel.split('/'))).href) }; } catch (e) { return { err: String(e && e.message ? e.message : e).split('\n')[0] }; } };
const NOT_YET = (what, err) => `not implemented yet: ${what}${err ? ` (${err})` : ''}`;

const AMEND_SKILL = ['SKILL.md', 'VERSION', 'README.md', 'CHANGELOG.md', 'references/docs-generation.md', 'references/modes.md', 'references/report.md'];
const AMEND_ROOT = ['@root/README.md', '@root/.ai/context/project-tree.md', '@root/TODO.md'];
const AMENDABLE = [...AMEND_SKILL, ...AMEND_ROOT];
const NOTES31 = 'RELEASE-NOTES-3.1.0.md';
const PIN_OF = Object.freeze({ ...Object.fromEntries(AMEND_SKILL.map((k) => [k, BASE_FILES[k]])), ...BASE_ROOT });
// The closed non-insertion allowlist (plan section 7): baseline line ranges, whole lines, fixed anchors. None holds an RFC 2119 word.
const ALLOW_STAGE1 = Object.freeze({
  'SKILL.md': [[6, 6]],
  VERSION: [[1, 1]],
  'README.md': [[1, 1], [3, 4], [197, 198], [238, 238], [247, 247]],
  'references/modes.md': [[74, 74]],
  '@root/README.md': [[48, 48], [59, 60], [88, 90], [93, 93], [218, 218]],
  '@root/.ai/context/project-tree.md': [[19, 19], [33, 34], [39, 40]],
});
const ALLOW_STAGE2_EXTRA = Object.freeze({ '@root/TODO.md': [[72, 75]] });
const ALLOW = STAGE === 1 ? ALLOW_STAGE1 : { ...ALLOW_STAGE1, ...ALLOW_STAGE2_EXTRA };
const DELETE_OK = STAGE === 1 ? new Set() : new Set(['@root/TODO.md']);
const NEW_TESTS = Object.freeze(['tests/bs-doc-map.test.mjs', 'tests/release-3.1.test.mjs', 'tests/live/bs-doc-map.mjs', 'tests/live/BS-DOC-MAP-ACCEPTANCE.md', 'tests/helpers/v31-amendments.mjs', 'tests/fixtures/v31-prechange.json']);
const EDITED_TESTS = Object.freeze(['tests/c11b.test.mjs', 'tests/c17.test.mjs', 'tests/c18.test.mjs', 'tests/helpers/c18-amendments.mjs']);

// The APPROVED replacements of stage 1 (plan section 7 and amendment P1): the complete identity of each named record, pinned HERE, independently of the
// helper and of the fixture. A replacement is accepted only when its id, file, both anchors, old and new text equal one of these entries exactly, so a
// changed id, a moved or re-anchored record, or an edited old or new text is rejected even when the helper, the fixture and the actual file were all
// changed together. The helper and the fixture are compared against this table; this table is never read from them. Generated once from the reviewed
// records (round 1 of the review, 2026-11-11) and checked against the pinned baseline below; adding or changing an entry is a reviewed change to THIS file.
const APPROVED_STAGE1 = Object.freeze({
  SK31_1: Object.freeze({ file: "SKILL.md", before: "", old: "# project-setup 3.0.0\n", neu: "# project-setup 3.1.0\n", after: "" }),
  VR31_1: Object.freeze({ file: "VERSION", before: "", old: "3.0.0\n", neu: "3.1.0\n", after: "" }),
  RM31_1: Object.freeze({ file: "README.md", before: "", old: "# project-setup 3.0.0 - skill source\n", neu: "# project-setup 3.1.0 - skill source\n", after: "" }),
  RM31_2: Object.freeze({ file: "README.md", before: "", old: "**Release 3.0.0.** See RELEASE-NOTES-3.0.0.md for compatibility, acceptance requirements,\nthe rc.4 host measurement results and the remaining limitations.\n", neu: "**Release 3.1.0.** See RELEASE-NOTES-3.1.0.md for compatibility, the backend-standards\ndocumentation mapping, acceptance requirements, pending live evidence and the remaining limitations.\n", after: "" }),
  RM31_4: Object.freeze({ file: "README.md", before: "", old: "Release acceptance requires the complete strict gate below and, separately, node tests/c18.test.mjs\n(the standalone 3.0.0 final-release assertions; neither run-tests.mjs nor accept-rc1.mjs runs it).\n", neu: "Release acceptance requires the complete strict gate below and, separately, the three standalone\ngates node tests/bs-doc-map.test.mjs, node tests/release-3.1.test.mjs and node tests/c18.test.mjs\n(the 3.1.0 mapping contract, the 3.1.0 release assertions and the historical 3.0.0 assertions;\nneither run-tests.mjs nor accept-rc1.mjs runs them). Run them serially.\n", after: "" }),
  RM31_5: Object.freeze({ file: "README.md", before: "", old: "requires or creates project-setup-v3.0.0 in the distribution repository.\n", neu: "requires or creates project-setup-v3.1.0 in the distribution repository.\n", after: "" }),
  RM31_6: Object.freeze({ file: "README.md", before: "", old: "node install/release.mjs --tag project-setup-v3.0.0 --out <unused-directory>\n", neu: "node install/release.mjs --tag project-setup-v3.1.0 --out <unused-directory>\n", after: "" }),
  MD31_1: Object.freeze({ file: "references/modes.md", before: "", old: "This behavior has not been verified on a real backend-standards scaffold.\n", neu: "A real Nest CLI 11 scaffold was exercised with BS followed by PS adopt on 2026-11-11. Prepare\nheld CLAUDE.md and both standalone Claude agents for approval. That run did not exercise the\nagents, Codex, or PS followed by BS, and did not verify the 3.1 pointer workflow.\n", after: "" }),
  RR31_1: Object.freeze({ file: "@root/README.md", before: "", old: "`project-setup` (3.0.0, shared by Claude Code and Codex) is **not**\n", neu: "`project-setup` (3.1.0, shared by Claude Code and Codex) is **not**\n", after: "" }),
  RR31_2: Object.freeze({ file: "@root/README.md", before: "", old: "See `project-setup/README.md` and `project-setup/RELEASE-NOTES-3.0.0.md` (compatibility,\nlimitations and the rc.4 host measurement results). A project installed\n", neu: "See `project-setup/README.md` and `project-setup/RELEASE-NOTES-3.1.0.md` (compatibility,\nthe backend-standards documentation mapping and limitations). A project installed\n", after: "" }),
  RR31_4: Object.freeze({ file: "@root/README.md", before: "", old: "This installs `project-setup` 3.0.0 for both tools; update each project installed\n", neu: "This installs `project-setup` 3.1.0 for both tools; update each project installed\n", after: "" }),
  RR31_5: Object.freeze({ file: "@root/README.md", before: "", old: "The rc.4 host measurement results and limitations are in the 3.0.0 release notes.\n", neu: "The 3.1.0 live acceptance is pending evidence; its scope and limitations are in the 3.1.0 release notes.\n", after: "" }),
  RR31_6: Object.freeze({ file: "@root/README.md", before: "", old: "`project-setup/RELEASE-NOTES-3.0.0.md` § \"Compatibility and rollback\").\n", neu: "`project-setup/RELEASE-NOTES-3.1.0.md` § \"Rollback\").\n", after: "" }),
  RR31_7: Object.freeze({ file: "@root/README.md", before: "", old: "├── project-setup/               general-purpose — shared Claude Code + Codex setup (3.0.0, own installer and tests)\n", neu: "├── project-setup/               general-purpose — shared Claude Code + Codex setup (3.1.0, own installer and tests)\n", after: "" }),
  PT31_1: Object.freeze({ file: "@root/.ai/context/project-tree.md", before: "", old: "├── project-setup/              skill 3 — shared Claude Code + Codex agent scaffolding (3.0.0)\n", neu: "├── project-setup/              skill 3 — shared Claude Code + Codex agent scaffolding (3.1.0)\n", after: "" }),
  PT31_2: Object.freeze({ file: "@root/.ai/context/project-tree.md", before: "", old: "(`project-setup/VERSION` is `3.0.0`) with its own layout: `SKILL.md`,\n", neu: "(`project-setup/VERSION` is `3.1.0`) with its own layout: `SKILL.md`,\n", after: "" }),
});
// Stage 2 adds exactly one entry here: the TODO closeout (file @root/TODO.md, old = baseline lines 72-75, neu = empty). It is authored with stage 2.
const APPROVED_STAGE2_EXTRA = Object.freeze({});
const APPROVED = STAGE === 1 ? APPROVED_STAGE1 : Object.freeze({ ...APPROVED_STAGE1, ...APPROVED_STAGE2_EXTRA });

// ---------------------------------------------------------------------------------------------------------------- the gate engine ----
// Records are { file, before, old, neu, after } exactly as in c17/c18-amendments: before + old + after is the baseline slice and
// before + neu + after the amended slice. This engine is independent of the helper's.
const ID_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const REC_KEYS = ['after', 'before', 'file', 'neu', 'old'];
function occurrences(text, needle) { const out = []; if (needle === '') return out; for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) out.push(i); return out; }
function reverseRec(text, r) { const key = r.before + r.neu + r.after; const at = occurrences(text, key); if (at.length !== 1) return null; return text.slice(0, at[0]) + r.before + r.old + r.after + text.slice(at[0] + key.length); }
function applyRec(text, r) { const key = r.before + r.old + r.after; const at = occurrences(text, key); if (at.length !== 1) return null; return text.slice(0, at[0]) + r.before + r.neu + r.after + text.slice(at[0] + key.length); }
/** 1-based inclusive line range of a whole-line block that occurs exactly once at a line start, else null. */
function lineRangeOf(base, block) {
  const at = occurrences(base, block).filter((i) => i === 0 || base[i - 1] === '\n');
  if (at.length !== 1 || !block.endsWith('\n')) return null;
  const start = base.slice(0, at[0]).split('\n').length;
  return [start, start + block.split('\n').length - 2];
}
// A heuristic, not a proof: phrases that would grant a new exception to an inherited approval, root-start, security or ownership rule.
// It catches exactly these phrasings; whether new text contradicts an old rule in other words is the reviewer's judgment.
const WEAKENERS = Object.freeze([
  [/\bapproval (?:is|are) (?:not (?:required|needed)|optional)\b/i, 'approval made optional'],
  [/\bno approval (?:is )?(?:needed|required)\b/i, 'approval made unnecessary'],
  [/\b(?:need not|does not need to|do not need to|no need to) (?:obtain|ask for|request|get) (?:\w+ ){0,2}approval\b/i, 'approval made unnecessary'],
  [/\b(?:MAY|may|can|is allowed to|are allowed to) (?:skip|bypass|waive|ignore|override)\b[^.\n]{0,60}\b(?:approval|security|secret|root[- ]start|ownership|manifest|drift|user[- ]content|review)/, 'a permission to skip an inherited rule'],
  [/\boverrides? (?:the )?(?:security|root[- ]start|approval|ownership)\b/i, 'an override of an inherited rule'],
  [/\bexempt(?:ed)? from (?:the )?(?:approval|security|root[- ]start|ownership|drift)\b/i, 'an exemption from an inherited rule'],
]);

function recordProblems(id, r, ctx, add) {
  if (!ID_RE.test(id)) add('shape', ctx.file(r), id, `${id}: the id is not a plain identifier (no wildcard or pattern ids)`);
  if (r === null || typeof r !== 'object' || Array.isArray(r)) { add('shape', null, id, `${id}: the record is not an object`); return; }
  if (JSON.stringify(Object.keys(r).sort()) !== JSON.stringify(REC_KEYS)) add('shape', ctx.file(r), id, `${id}: the record keys are not exactly ${REC_KEYS.join(', ')}`);
  if (REC_KEYS.some((k) => typeof r[k] !== 'string')) { add('shape', ctx.file(r), id, `${id}: a record field is not a string`); return; }
  if (/[*?[\]{}\\]|\.\./.test(r.file) || r.file === '') add('shape', r.file, id, `${id}: the file key is empty or holds a wildcard, backslash or parent segment`);
  if (!ctx.amendable.has(r.file)) add('shape', r.file, id, `${id}: ${r.file} is not in the closed amendable set`);
  if ([r.before, r.old, r.neu, r.after].some((s) => s.includes('\r'))) add('shape', r.file, id, `${id}: a field holds a CR (LF only)`);
  if (r.old === r.neu) add('shape', r.file, id, `${id}: no-op record (old equals neu)`);
  if (r.neu === '') {
    if (r.old === '') add('shape', r.file, id, `${id}: empty record (nothing inserted, nothing removed)`);
    else if (!ctx.deleteOk.has(r.file)) add('shape', r.file, id, `${id}: neu is empty, a deletion, which this file does not allow at this stage`);
  } else if (!r.neu.endsWith('\n')) add('shape', r.file, id, `${id}: neu is not line aligned (no final LF)`);
  if (r.old === '') {
    if (r.before === '' && r.after === '') add('shape', r.file, id, `${id}: the insertion has no anchor`);
    return;
  }
  // A replacement is accepted only as one of the APPROVED named records, its COMPLETE identity (id, file, both anchors, old, neu) equal to the pin.
  // Not an allowlisted line range and not the editable fixture: those alone accept a changed id, a re-anchored record or an edited new text.
  const pin = has(ctx.approved, id) ? ctx.approved[id] : undefined;
  if (pin === undefined) add('approved', r.file, id, `${id}: a replacement that is not one of the approved named records (a new, renamed or re-identified replacement)`);
  else for (const k of ['file', 'before', 'old', 'neu', 'after']) if (r[k] !== pin[k]) add('approved', r.file, id, `${id}: ${k} differs from the pinned approved record`);
  // The closed allowlist still applies to every replacement (defence in depth).
  if (!r.old.endsWith('\n')) add('range', r.file, id, `${id}: old is not whole lines (no final LF)`);
  if (KEYWORD.test(r.old)) add('keyword', r.file, id, `${id}: old holds an RFC 2119 keyword (MUST, SHOULD or MAY), so it would remove an obligation`);
  const allowed = ctx.allow[r.file] ?? [];
  if (allowed.length === 0) { add('range', r.file, id, `${id}: a replacement in ${r.file}, which has no allowlisted line range`); return; }
  const base = ctx.baseline[r.file];
  if (typeof base !== 'string') return; // the chain problem is already reported
  const rg = lineRangeOf(base, r.old);
  if (rg === null) { add('range', r.file, id, `${id}: old is not one whole-line block that occurs exactly once in the baseline of ${r.file}`); return; }
  if (!allowed.some(([a, b]) => rg[0] >= a && rg[1] <= b)) add('range', r.file, id, `${id}: old covers baseline lines ${rg[0]}-${rg[1]}, outside the allowlisted ranges ${JSON.stringify(allowed)}`);
  (ctx.ranges[r.file] ??= []).push([id, rg]);
  if (ctx.fixtureOld !== undefined) {
    if (!has(ctx.fixtureOld, id)) add('fixture', r.file, id, `${id}: the replacement has no entry in the fixture`);
    else if (ctx.fixtureOld[id] !== r.old) add('fixture', r.file, id, `${id}: old differs from the exact bytes the fixture permits`);
  }
}

/** cfg: { actual:{key:text}, records, forward:{key:[ids]}, allow, amendable:Set, deleteOk:Set, pins:{key:sha}, approved:{id:{file,before,old,neu,after}}, fixtureOld?, normative?, phrases? }.
 *  approved is the closed set of replacement records; without it NO replacement is accepted (fail closed). */
function gate(cfg) {
  const problems = [];
  const add = (kind, file, id, msg) => problems.push({ kind, file, id, msg });
  const baseline = {};
  const owner = new Map();
  for (const [file, list] of Object.entries(cfg.forward)) {
    if (!cfg.amendable.has(file)) add('order', file, null, `${file}: ordered, but not in the closed amendable set`);
    for (const id of list) {
      if (owner.has(id)) add('order', file, id, `${id}: listed more than once in the forward order`);
      owner.set(id, file);
      if (!has(cfg.records, id)) add('order', file, id, `${id}: ordered but has no record`);
      else if (cfg.records[id] && cfg.records[id].file !== file) add('order', file, id, `${id}: ordered under ${file} but its record names ${cfg.records[id].file}`);
    }
  }
  for (const id of Object.keys(cfg.records)) if (!owner.has(id)) add('order', cfg.records[id] && cfg.records[id].file, id, `${id}: the record is not listed in any forward order`);
  // The chain: reverse the actual text record by record, last record first; each must stand exactly once, at a line boundary.
  for (const file of cfg.amendable) {
    const actual = cfg.actual[file];
    const list = (cfg.forward[file] ?? []).filter((id) => has(cfg.records, id));
    if (typeof actual !== 'string') { add('chain', file, null, `${file}: the actual text is unavailable`); baseline[file] = null; continue; }
    let t = actual;
    let ok = true;
    for (const id of [...list].reverse()) {
      const r = cfg.records[id];
      if (r === null || typeof r !== 'object' || REC_KEYS.some((k) => typeof r[k] !== 'string')) { ok = false; break; }
      const at = occurrences(t, r.before + r.neu + r.after);
      if (at.length !== 1) { add('chain', file, id, `${file}: ${id} does not stand exactly once at its anchor (found ${at.length})`); ok = false; break; }
      const pos = at[0] + r.before.length;
      if (pos !== 0 && t[pos - 1] !== '\n') add('shape', file, id, `${id}: the amendment does not start at a line boundary`);
      t = reverseRec(t, r);
    }
    baseline[file] = ok ? t : null;
    if (!ok) continue;
    if (sha(t) !== cfg.pins[file]) add('pin', file, null, `${file}: the reversed text is not the pinned 3.0.0 baseline (sha256 ${sha(t).slice(0, 12)}...)`);
    let f = t;
    for (const id of list) f = f === null ? null : applyRec(f, cfg.records[id]);
    if (f !== actual) add('roundtrip', file, null, `${file}: applying the records to the baseline does not give the actual file`);
  }
  const ctx = { amendable: cfg.amendable, allow: cfg.allow, deleteOk: cfg.deleteOk, baseline, fixtureOld: cfg.fixtureOld, approved: cfg.approved ?? {}, ranges: {}, file: (r) => (r && typeof r === 'object' ? r.file ?? null : null) };
  for (const [id, r] of Object.entries(cfg.records)) recordProblems(id, r, ctx, add);
  for (const id of Object.keys(ctx.approved)) if (!has(cfg.records, id)) add('approved', ctx.approved[id].file, id, `${id}: an approved replacement has no record (removed or renamed)`);
  for (const [file, list] of Object.entries(ctx.ranges)) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i][1][0] <= list[j][1][1] && list[j][1][0] <= list[i][1][1]) add('range', file, list[j][0], `${list[i][0]} and ${list[j][0]}: replacement ranges overlap`);
  }
  for (const [id, r] of Object.entries(cfg.records)) {
    if (!r || typeof r.neu !== 'string') continue;
    for (const [rx, what] of WEAKENERS) if (rx.test(r.neu)) add('weaken', r.file, id, `${id}: new text carries ${what}`);
  }
  for (const [file, digests] of Object.entries(cfg.normative ?? {})) {
    if (typeof cfg.actual[file] !== 'string') continue;
    const missing = obligationProblems(cfg.actual[file], digests);
    if (missing > 0) add('obligation', file, null, `${file}: ${missing} baseline normative line(s) are missing from the actual file`);
  }
  for (const [file, phrases] of Object.entries(cfg.phrases ?? {})) {
    if (typeof cfg.actual[file] !== 'string') continue;
    const text = squash(lf(cfg.actual[file]));
    for (const ph of phrases) if (!text.includes(ph)) add('obligation', file, null, `${file}: a required retained sentence is missing: ${ph.slice(0, 70)}`);
  }
  return { problems, baseline };
}
/** Count of baseline normative-line digests that are absent from the text. */
function obligationProblems(text, digests) {
  const have = new Set(lf(text).split('\n').map(lineDigest));
  return digests.filter((d) => !have.has(d)).length;
}

// -------------------------------------------------------------------------------------------------- notes, claims: contract engines ----
const NOTES_TERMS = Object.freeze([['compatibility', /compatib/i], ['consolidation', /consolidat/i], ['recovery', /recover/i], ['rollback', /rollback/i], ['verification', /verif/i], ['limitations', /limitation/i], ['provenance', /provenance/i]]);
function notesProblems(buf, version = '3.1.0') {
  const p = [];
  if (!Buffer.isBuffer(buf)) return ['the notes are unreadable'];
  const t = buf.toString('utf8');
  if (buf.length === 0) return ['the notes are empty'];
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) p.push('BOM');
  if (buf.includes(0x0d)) p.push('CR (LF only)');
  if (/[^\x00-\x7f]/.test(buf.toString('latin1'))) p.push('non-ASCII');
  if (!t.endsWith('\n') || t.endsWith('\n\n')) p.push('not exactly one final LF');
  if (/(?<![0-9A-Fa-f])(?:[0-9A-Fa-f]{40}|[0-9A-Fa-f]{64})(?![0-9A-Fa-f])/.test(t)) p.push('a standalone 40- or 64-hex ID');
  if (/[A-Za-z]:\\Users\\|\\Users\\|\/home\/|\/Users\//.test(t)) p.push('a personal path');
  if (!t.startsWith(`# project-setup ${version}\n`)) p.push('the title is not "# project-setup 3.1.0"');
  const h2 = t.split('\n').filter((l) => /^## /.test(l));
  for (const [name, rx] of NOTES_TERMS) if (!h2.some((l) => rx.test(l))) p.push(`no ## heading covers ${name}`);
  if (STAGE === 1) {
    if (!/pending evidence/i.test(t)) p.push('the live acceptance is not stated as "pending evidence"');
    if (/\b(?:live|host) (?:acceptance|measurements?) (?:passed|completed|succeeded|were completed)\b/i.test(t) || /\bacceptance (?:passed|completed|succeeded)\b/i.test(t)) p.push('a resolved acceptance result (stage 1 records none)');
  }
  if (!/re-?sync/i.test(t) || !/overwrit/i.test(t)) p.push('the backend-standards re-sync overwrite limitation is not stated');
  return p;
}

const PHASE1_SENTENCE = 'Before drafting overlapping documentation, setup MUST apply the source-of-truth mapping in `references/docs-generation.md`, including activation dispositions, existing-content consolidation and source binding, so generation cannot introduce a second factual owner.';
const MODES_OBSERVATION = 'A real Nest CLI 11 scaffold was exercised with BS followed by PS adopt on 2026-11-11. Prepare held CLAUDE.md and both standalone Claude agents for approval. That run did not exercise the agents, Codex, or PS followed by BS, and did not verify the 3.1 pointer workflow.';
const MODES_STALE = 'This behavior has not been verified on a real backend-standards scaffold.';
function sectionOf(text, rx) {
  const ls = lf(text).split('\n');
  const i = ls.findIndex((l) => rx.test(l));
  if (i < 0) return null;
  const level = /^#+/.exec(ls[i])[0].length;
  let j = i + 1;
  while (j < ls.length && !(/^#+ /.test(ls[j]) && /^#+/.exec(ls[j])[0].length <= level)) j++;
  return ls.slice(i, j).join('\n');
}
/** t: { VERSION, SKILL, PSREADME, CHANGELOG, ROOTREADME, TREE, MODES } as text. Returns [{ area, msg }]. */
function claimsProblems(t) {
  const p = [];
  const bad = (area, msg) => p.push({ area, msg });
  if (t.VERSION !== '3.1.0\n') bad('VERSION', 'VERSION is not exactly "3.1.0" plus one LF');
  const sk = lf(t.SKILL ?? '');
  const skHeads = sk.split('\n').filter((l) => /^# /.test(l));
  if (skHeads[0] !== '# project-setup 3.1.0' || skHeads.includes('# project-setup 3.0.0')) bad('SKILL', 'the SKILL.md title heading is not "# project-setup 3.1.0"');
  const ph1 = sectionOf(sk, /^### Phase 1\b/);
  const ph0 = sectionOf(sk, /^### Phase 0\b/);
  if (ph1 === null || squash(ph1).split(PHASE1_SENTENCE).length !== 2) bad('SKILL', 'the Phase 1 mapping sentence is not present exactly once inside Phase 1');
  if (sk.split(squash(PHASE1_SENTENCE)).length > 2 || squash(sk).split(PHASE1_SENTENCE).length !== 2) bad('SKILL', 'the Phase 1 mapping sentence does not stand exactly once in SKILL.md');
  if (ph0 === null || !/mapping/i.test(ph0)) bad('SKILL', 'Phase 0 does not carry the mapping assessment');
  const rd = lf(t.PSREADME ?? '');
  const open = rd.split('\n## ')[0];
  if (rd.split('\n')[0] !== '# project-setup 3.1.0 - skill source') bad('PSREADME', 'the PS README title is not "# project-setup 3.1.0 - skill source"');
  if (!open.includes('RELEASE-NOTES-3.1.0.md') || open.includes('RELEASE-NOTES-3.0.0.md')) bad('PSREADME', 'the opening release sentence does not cite RELEASE-NOTES-3.1.0.md in place of the 3.0.0 notes');
  const testFirst = sectionOf(rd, /^## Test first\b/) ?? '';
  for (const g of ['bs-doc-map.test.mjs', 'release-3.1.test.mjs', 'c18.test.mjs']) if (!testFirst.includes(g)) bad('PSREADME', `the acceptance section does not name ${g}`);
  const local = sectionOf(rd, /^## Local candidate release\b/) ?? '';
  if (!local.includes('project-setup-v3.1.0') || local.includes('project-setup-v3.0.0')) bad('PSREADME', 'the local release section does not carry the 3.1.0 tag token alone');
  const cl = lf(t.CHANGELOG ?? '');
  if (!cl.startsWith('# Changelog\n\n## 3.1.0\n') || cl.split('\n## 3.1.0\n').length !== 2) bad('CHANGELOG', 'the changelog does not start with one "## 3.1.0" entry');
  if (!(cl.indexOf('\n## 3.1.0\n') < cl.indexOf('\n## 3.0.0\n') && cl.indexOf('\n## 3.0.0\n') > 0)) bad('CHANGELOG', 'the 3.0.0 entry is not kept after the 3.1.0 entry');
  const rr = lf(t.ROOTREADME ?? '');
  for (const [rx, what] of [[/\(3\.0\.0, shared by Claude Code and Codex\)/, 'the introduction version'], [/installs `project-setup` 3\.0\.0/, 'the install sentence'], [/\(3\.0\.0, own installer and tests\)/, 'the layout tree line']]) if (rx.test(rr)) bad('ROOTREADME', `a stale current 3.0.0 claim remains: ${what}`);
  if (rr.split('\n').filter((l) => /\b3\.1\.0\b/.test(l)).length < 3) bad('ROOTREADME', 'fewer than three current 3.1.0 claims (introduction, install, layout)');
  if (!rr.split('\n').some((l) => l.includes(NOTES31) && /rollback/i.test(l))) bad('ROOTREADME', 'no rollback link to RELEASE-NOTES-3.1.0.md');
  if (!/project-setup\/\s+general-purpose.*\(3\.1\.0\b/.test(rr)) bad('ROOTREADME', 'the layout tree line does not say 3.1.0');
  const tr = lf(t.TREE ?? '');
  if (!/project-setup\/\s+skill 3 .*\(3\.1\.0\)/.test(tr) || !tr.includes('`project-setup/VERSION` is `3.1.0`')) bad('TREE', 'the project tree does not say 3.1.0 for the skill line and VERSION');
  if (/project-setup\/\s+skill 3 .*\(3\.0\.0\)/.test(tr) || tr.includes('`project-setup/VERSION` is `3.0.0`')) bad('TREE', 'a stale current 3.0.0 claim remains in the project tree');
  const md = squash(lf(t.MODES ?? ''));
  if (md.split(MODES_OBSERVATION).length !== 2) bad('MODES', 'the scoped scaffold observation is not present exactly once');
  if (md.includes(MODES_STALE)) bad('MODES', 'the stale scaffold observation remains');
  return p;
}

// ============================================================ A. the amendment layer on the actual bytes ====
const L31 = await loadModule('tests/helpers/v31-amendments.mjs');
const L18 = await loadModule('tests/helpers/c18-amendments.mjs');
const H31 = L31.mod ?? null;
const H18 = L18.mod ?? null;
const FIXTURE_PATH = path.join(SKILL, 'tests', 'fixtures', 'v31-prechange.json');
const FIX = attempt(() => JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')));
const FIX_RAW = attempt(() => fs.readFileSync(FIXTURE_PATH, 'utf8'));
const FIX_OK = !failedAttempt(FIX) && FIX !== null && typeof FIX === 'object';
const ACTUAL = Object.fromEntries(AMENDABLE.map((k) => [k, attempt(() => fs.readFileSync(absOf(k), 'utf8'))]));
const actualText = (k) => (typeof ACTUAL[k] === 'string' ? ACTUAL[k] : '');

check('the helper tests/helpers/v31-amendments.mjs exists and imports', H31 !== null, NOT_YET('tests/helpers/v31-amendments.mjs', L31.err));
const NAMES31 = ['AM31', 'FORWARD_ORDER31', 'REVERSAL_ORDER31', 'AMENDED_FILES31', 'CURRENT_VERSION31', 'reverseSteps', 'applySteps', 'reverseForFile', 'applyForFile', 'read30', 'to30Tree'];
check('the helper exports AM31, the three orders, CURRENT_VERSION31 and the six functions', H31 !== null && NAMES31.every((n) => n in H31) && ['reverseSteps', 'applySteps', 'reverseForFile', 'applyForFile', 'read30', 'to30Tree'].every((n) => typeof H31[n] === 'function'), H31 === null ? NOT_YET('helper') : NAMES31.filter((n) => !(n in H31)));
check('CURRENT_VERSION31 is exactly "3.1.0" and FINAL_VERSION18 stays "3.0.0" (a new constant, the historical one untouched)', H31 !== null && H18 !== null && H31.CURRENT_VERSION31 === '3.1.0' && H18.FINAL_VERSION18 === '3.0.0', H31 === null ? NOT_YET('CURRENT_VERSION31', L31.err) : { v31: H31.CURRENT_VERSION31, v18: H18 && H18.FINAL_VERSION18 });
const shapeFrozen = H31 !== null && has(H31, 'AM31') && Object.isFrozen(H31.AM31) && Object.values(H31.AM31).every((r) => Object.isFrozen(r) && JSON.stringify(Object.keys(r).sort()) === JSON.stringify(REC_KEYS) && REC_KEYS.every((k) => typeof r[k] === 'string'));
check('AM31 is frozen and every record is frozen with exactly the keys file, before, old, neu, after as strings', shapeFrozen, H31 === null ? NOT_YET('AM31') : undefined);
const orderOk = (() => {
  if (H31 === null || !has(H31, 'FORWARD_ORDER31') || !has(H31, 'REVERSAL_ORDER31') || !has(H31, 'AMENDED_FILES31')) return false;
  const f = H31.FORWARD_ORDER31; const r = H31.REVERSAL_ORDER31;
  if (!Object.isFrozen(f) || !Object.isFrozen(r) || !Object.values(f).every((a) => Array.isArray(a) && Object.isFrozen(a))) return false;
  if (JSON.stringify(H31.AMENDED_FILES31) !== JSON.stringify(Object.keys(f))) return false;
  if (JSON.stringify(Object.keys(r)) !== JSON.stringify(Object.keys(f))) return false;
  if (!Object.keys(f).every((k) => JSON.stringify([...f[k]].reverse()) === JSON.stringify(r[k]))) return false;
  const listed = Object.values(f).flat();
  return new Set(listed).size === listed.length && listed.length === Object.keys(H31.AM31).length && Object.keys(f).every((k) => f[k].every((id) => has(H31.AM31, id) && H31.AM31[id].file === k));
})();
check('FORWARD_ORDER31 lists every record exactly once under its own file, REVERSAL_ORDER31 is its exact reverse and AMENDED_FILES31 its key list', orderOk, H31 === null ? NOT_YET('orders') : undefined);
check('every amended file is inside the closed amendable set of ten files', H31 !== null && has(H31, 'AMENDED_FILES31') && H31.AMENDED_FILES31.every((k) => AMENDABLE.includes(k)), H31 === null ? NOT_YET('AMENDED_FILES31') : H31.AMENDED_FILES31);

// The fixture.
check('the fixture tests/fixtures/v31-prechange.json exists and parses', FIX_OK, NOT_YET('tests/fixtures/v31-prechange.json', failedAttempt(FIX) ? FIX.threw : undefined));
check('the fixture has exactly the keys schema, baseCommit, files, replacements, with schema 1 and the pinned base commit', FIX_OK && JSON.stringify(Object.keys(FIX).sort()) === JSON.stringify(['baseCommit', 'files', 'replacements', 'schema']) && FIX.schema === 1 && FIX.baseCommit === BASE_COMMIT, FIX_OK ? { keys: Object.keys(FIX), schema: FIX.schema, base: FIX.baseCommit } : NOT_YET('fixture'));
check('the fixture files table is exactly the ten amendable keys, each { sha256, bytes } equal to this spec\'s independent pins', FIX_OK && typeof FIX.files === 'object' && FIX.files !== null && JSON.stringify(Object.keys(FIX.files).sort()) === JSON.stringify([...AMENDABLE].sort()) && AMENDABLE.every((k) => has(FIX.files, k) && JSON.stringify(Object.keys(FIX.files[k]).sort()) === '["bytes","sha256"]' && FIX.files[k].sha256 === PIN_OF[k]), FIX_OK ? Object.keys(FIX.files ?? {}) : NOT_YET('fixture'));
const fixReps = FIX_OK && typeof FIX.replacements === 'object' && FIX.replacements !== null ? FIX.replacements : null;
check('every fixture replacement is { file, old, oldSha256 } with oldSha256 the digest of old and no RFC 2119 word in old', fixReps !== null && Object.entries(fixReps).every(([id, v]) => ID_RE.test(id) && JSON.stringify(Object.keys(v).sort()) === '["file","old","oldSha256"]' && typeof v.old === 'string' && v.old !== '' && v.oldSha256 === sha(v.old) && !KEYWORD.test(v.old) && AMENDABLE.includes(v.file)), fixReps === null ? NOT_YET('fixture replacements') : undefined);
check('the fixture and the helper agree: one fixture replacement per AM31 record with a nonempty old, same file and same old bytes, and no other', fixReps !== null && shapeFrozen && (() => { const reps = Object.entries(H31.AM31).filter(([, r]) => r.old !== ''); return reps.length === Object.keys(fixReps).length && reps.every(([id, r]) => has(fixReps, id) && fixReps[id].file === r.file && fixReps[id].old === r.old); })(), fixReps === null || !shapeFrozen ? NOT_YET('fixture and helper') : { fixture: Object.keys(fixReps), records: Object.entries(H31.AM31).filter(([, r]) => r.old !== '').map(([id]) => id) });
// The independent pins (review round 1, R4): the helper and the fixture are compared against APPROVED, never the reverse.
const PIN_IDS = Object.keys(APPROVED);
check('the approved pins are well formed: sixteen frozen plain-identifier records in the amendable set (none in @root/TODO.md at stage 1), exactly the keys file, before, old, neu, after as LF-only strings, old and neu whole lines that differ, no RFC 2119 word in old', Object.isFrozen(APPROVED) && PIN_IDS.length === 16 && PIN_IDS.every((id) => { const p = APPROVED[id]; return ID_RE.test(id) && Object.isFrozen(p) && JSON.stringify(Object.keys(p).sort()) === JSON.stringify(REC_KEYS) && REC_KEYS.every((k) => typeof p[k] === 'string' && !p[k].includes('\r')) && AMENDABLE.includes(p.file) && (STAGE !== 1 || p.file !== '@root/TODO.md') && p.old !== '' && p.old.endsWith('\n') && p.neu.endsWith('\n') && p.old !== p.neu && !KEYWORD.test(p.old); }), PIN_IDS.filter((id) => !ID_RE.test(id)));
check('the helper holds exactly the approved replacements: the same ids, and for each the same file, both anchors, old text and new text', shapeFrozen && (() => { const reps = Object.entries(H31.AM31).filter(([, r]) => r.old !== ''); return reps.length === PIN_IDS.length && reps.every(([id, r]) => has(APPROVED, id) && REC_KEYS.every((k) => r[k] === APPROVED[id][k])); })(), shapeFrozen ? Object.entries(H31.AM31).filter(([id, r]) => r.old !== '' && !(has(APPROVED, id) && REC_KEYS.every((k) => r[k] === APPROVED[id][k]))).map(([id]) => id) : NOT_YET('AM31'));
check('the fixture holds exactly the approved replacements: the same ids and files, the pinned old bytes, and oldSha256 the digest of them', fixReps !== null && JSON.stringify(Object.keys(fixReps).sort()) === JSON.stringify([...PIN_IDS].sort()) && PIN_IDS.every((id) => fixReps[id].file === APPROVED[id].file && fixReps[id].old === APPROVED[id].old && fixReps[id].oldSha256 === sha(APPROVED[id].old)), fixReps === null ? NOT_YET('fixture replacements') : Object.keys(fixReps).filter((id) => !has(APPROVED, id) || fixReps[id].old !== APPROVED[id].old));
check('the fixture holds no personal path, no secret-shaped string and no baseline file text', typeof FIX_RAW === 'string' && !/[A-Za-z]:\\\\Users|\/home\/|\/Users\/|ghp_[A-Za-z0-9]{20}|AKIA[0-9A-Z]{12}|BEGIN [A-Z ]*PRIVATE KEY/.test(FIX_RAW) && FIX_OK && !JSON.stringify(Object.keys(FIX.files ?? {}).map((k) => Object.keys(FIX.files[k]))).includes('text'), typeof FIX_RAW === 'string' ? undefined : NOT_YET('fixture'));

// The gate on the actual bytes (this spec's engine, the helper's records).
const realReady = shapeFrozen && orderOk && AMENDABLE.every((k) => typeof ACTUAL[k] === 'string');
const REAL = realReady ? gate({
  actual: ACTUAL, records: H31.AM31, forward: H31.FORWARD_ORDER31, allow: ALLOW, amendable: new Set(AMENDABLE), deleteOk: DELETE_OK, pins: PIN_OF,
  fixtureOld: fixReps === null ? undefined : Object.fromEntries(Object.entries(fixReps).map(([id, v]) => [id, v.old])),
  normative: NORMATIVE_LINES,
  approved: APPROVED,
}) : null;
check('the gate can run on the actual bytes (helper, orders and all ten amendable files readable)', REAL !== null, NOT_YET('the amendment layer'));
for (const k of AMENDABLE) {
  const mine = REAL === null ? null : REAL.problems.filter((q) => q.file === k && q.kind !== 'obligation');
  check(`${k}: the actual bytes are the pinned 3.0.0 baseline plus exactly the recorded amendments (reversal, pin, round trip, shapes, allowlist, fixture)`, mine !== null && mine.length === 0, mine === null ? NOT_YET('gate') : msgs(mine));
}
check('the amendment records and orders are consistent (no unlisted, duplicated or misfiled record, no pattern id)', REAL !== null && REAL.problems.filter((q) => q.kind === 'order' || (q.file === null && q.kind !== 'obligation')).length === 0, REAL === null ? NOT_YET('gate') : msgs(REAL.problems.filter((q) => q.kind === 'order' || q.file === null)));
check('every non-insertion record is one of the approved named replacements (complete identity pinned in this spec), whole lines inside a fixed baseline range, no RFC 2119 word in old, exactly the fixture bytes', REAL !== null && REAL.problems.filter((q) => ['approved', 'range', 'keyword', 'fixture'].includes(q.kind)).length === 0, REAL === null ? NOT_YET('gate') : msgs(REAL.problems.filter((q) => ['approved', 'range', 'keyword', 'fixture'].includes(q.kind))));
check('no amendment text carries a listed weakening phrase (approval, root-start, security, ownership exceptions)', REAL !== null && REAL.problems.filter((q) => q.kind === 'weaken').length === 0, REAL === null ? NOT_YET('gate') : msgs(REAL.problems.filter((q) => q.kind === 'weaken')));
check(`stage ${STAGE}: ${STAGE === 1 ? 'no record touches @root/TODO.md with a replacement or deletion (the closeout waits for the live acceptance)' : 'the TODO closeout is the only deletion'}`, shapeFrozen && Object.values(H31.AM31).every((r) => r.file !== '@root/TODO.md' || r.old === ''), shapeFrozen ? Object.entries(H31.AM31).filter(([, r]) => r.file === '@root/TODO.md' && r.old !== '').map(([id]) => id) : NOT_YET('AM31'));
check('the allowlisted baseline ranges hold no RFC 2119 word (the pinned baseline text, derived by this spec\'s own reversal)', REAL !== null && Object.entries(ALLOW).every(([k, ranges]) => typeof REAL.baseline[k] === 'string' && ranges.every(([a, b]) => REAL.baseline[k].split('\n').slice(a - 1, b).every((l) => !KEYWORD.test(l)))), REAL === null ? NOT_YET('gate') : undefined);
check('every approved pin\'s old text is whole baseline lines inside the allowlisted range of its file (judged on the independently pinned baseline)', REAL !== null && PIN_IDS.every((id) => { const p = APPROVED[id]; const base = REAL.baseline[p.file]; const rg = typeof base === 'string' ? lineRangeOf(base, p.old) : null; return rg !== null && (ALLOW[p.file] ?? []).some(([a, b]) => rg[0] >= a && rg[1] <= b); }), REAL === null ? NOT_YET('gate') : PIN_IDS.filter((id) => { const p = APPROVED[id]; const base = REAL.baseline[p.file]; return typeof base !== 'string' || lineRangeOf(base, p.old) === null; }));
// R4 mutation controls on the REAL bytes. Each mutation is CONSISTENT: the helper record, the fixture and the actual file are changed together, so the
// chain, the baseline pin, the round trip, the line-range allowlist and the fixture comparison all stay satisfied. Only the approved pins can see it.
if (REAL !== null && shapeFrozen && fixReps !== null) {
  const FIXOLD = Object.fromEntries(Object.entries(fixReps).map(([id, v]) => [id, v.old]));
  const reps = Object.entries(H31.AM31).filter(([, r]) => r.old !== '');
  const runGate = (records, forward, actual, fixtureOld) => gate({ actual, records, forward, allow: ALLOW, amendable: new Set(AMENDABLE), deleteOk: DELETE_OK, pins: PIN_OF, approved: APPROVED, fixtureOld }).problems;
  const kindsOf = (ps) => [...new Set(ps.map((q) => q.kind))].sort().join(',');
  const withRec = (id, rec) => ({ ...H31.AM31, [id]: rec });
  const keyOf = (r) => r.before + r.neu + r.after;
  check('control (sanity): the unmutated real records, orders, bytes and fixture pass this same gate call with the pins', runGate(H31.AM31, H31.FORWARD_ORDER31, ACTUAL, FIXOLD).length === 0, msgs(runGate(H31.AM31, H31.FORWARD_ORDER31, ACTUAL, FIXOLD)));
  const sweep = (label, fn, rx) => {
    const failures = []; let ran = 0;
    for (const [id, r] of reps) {
      const out = fn(id, r);
      if (out === null) continue;
      ran += 1;
      if (!(out.some((q) => q.kind === 'approved' && rx.test(q.msg)) && out.every((q) => q.kind === 'approved'))) failures.push({ id, kinds: kindsOf(out), msgs: msgs(out).slice(0, 2) });
    }
    check(`${label} (${ran} of ${reps.length} approved records exercised)`, ran >= 10 && failures.length === 0, failures.length > 0 ? failures : { ran });
  };
  sweep('a consistent change of a record\'s NEW text (an unapproved command flag appended in the helper and the actual file) is rejected by the pin alone, with no chain, pin, round-trip, range or fixture problem', (id, r) => {
    const neu2 = `${r.neu.slice(0, -1)} --unapproved\n`;
    return runGate(withRec(id, { ...r, neu: neu2 }), H31.FORWARD_ORDER31, { ...ACTUAL, [r.file]: ACTUAL[r.file].replace(keyOf(r), () => r.before + neu2 + r.after) }, FIXOLD);
  }, /neu differs from the pinned approved record/);
  { // A consistent RENAME: helper record, forward order and fixture all follow the new id, so nothing but the pins can object.
    const failures = [];
    for (const [id, r] of reps) {
      const nid = `${id}X`; const records = { ...H31.AM31 }; delete records[id]; records[nid] = r;
      const forward = { ...H31.FORWARD_ORDER31, [r.file]: H31.FORWARD_ORDER31[r.file].map((x) => (x === id ? nid : x)) };
      const fix = { ...FIXOLD }; delete fix[id]; fix[nid] = FIXOLD[id];
      const out = runGate(records, forward, ACTUAL, fix);
      if (!(out.some((q) => q.kind === 'approved' && q.id === nid && /not one of the approved named records/.test(q.msg)) && out.some((q) => q.kind === 'approved' && q.id === id && /has no record/.test(q.msg)) && out.every((q) => q.kind === 'approved'))) failures.push({ id, kinds: kindsOf(out) });
    }
    check(`a consistent RENAME of a record id (helper, order and fixture renamed together) is rejected by the pins alone: the new id is unapproved and the pinned id has no record (${reps.length} of ${reps.length} approved records exercised)`, failures.length === 0, failures);
  }
  sweep('a consistent change of the BEFORE anchor (still standing once, same baseline) is rejected by the pin alone', (id, r) => {
    const T = ACTUAL[r.file]; const at = T.indexOf(keyOf(r));
    if (at <= 0) return null;
    const head = T.slice(0, at); const prev = head.slice(head.lastIndexOf('\n', head.length - 2) + 1);
    return runGate(withRec(id, { ...r, before: prev }), H31.FORWARD_ORDER31, ACTUAL, FIXOLD);
  }, /before differs from the pinned approved record/);
  sweep('a consistent change of the AFTER anchor (still standing once, same baseline) is rejected by the pin alone', (id, r) => {
    const T = ACTUAL[r.file]; const at = T.indexOf(keyOf(r)); const tail = T.slice(at + keyOf(r).length);
    const nl = tail.indexOf('\n');
    if (tail === '' || nl < 0) return null;
    return runGate(withRec(id, { ...r, after: tail.slice(0, nl + 1) }), H31.FORWARD_ORDER31, ACTUAL, FIXOLD);
  }, /after differs from the pinned approved record/);
  { // A changed OLD text is rejected by the pin even when the fixture follows it (the old gate trusted the fixture, an editable file).
    const failures = []; let ran = 0;
    for (const [id, r] of reps) {
      const old2 = `${r.old.slice(0, -1)} (edited)\n`;
      const out = runGate(withRec(id, { ...r, old: old2 }), H31.FORWARD_ORDER31, ACTUAL, { ...FIXOLD, [id]: old2 });
      ran += 1;
      if (!(out.some((q) => q.kind === 'approved' && q.id === id && /old differs from the pinned approved record/.test(q.msg)) && !out.some((q) => q.kind === 'fixture'))) failures.push({ id, kinds: kindsOf(out) });
    }
    check(`a changed OLD text is rejected by the pin although the fixture was changed to match it (${ran} of ${reps.length} approved records exercised)`, ran === reps.length && failures.length === 0, failures);
  }
  { // A changed file key (the record moved to another amendable file) and a removed record.
    const failures = [];
    for (const [id, r] of reps) {
      const other = AMENDABLE.find((k) => k !== r.file && k !== '@root/TODO.md');
      const moved = runGate(withRec(id, { ...r, file: other }), H31.FORWARD_ORDER31, ACTUAL, FIXOLD);
      const records = { ...H31.AM31 }; delete records[id];
      const forward = { ...H31.FORWARD_ORDER31, [r.file]: H31.FORWARD_ORDER31[r.file].filter((x) => x !== id) };
      const gone = runGate(records, forward, ACTUAL, FIXOLD);
      if (!moved.some((q) => q.kind === 'approved' && q.id === id && /file differs/.test(q.msg)) || !gone.some((q) => q.kind === 'approved' && q.id === id && /has no record/.test(q.msg))) failures.push({ id, moved: kindsOf(moved), gone: kindsOf(gone) });
    }
    check(`a record moved to another file, and a removed approved record, are each rejected for every approved record (${reps.length} exercised)`, failures.length === 0, failures);
  }
  { // The fixture alone changed: still caught (by the fixture comparison), and the pins keep the identity independent of it.
    const failures = [];
    for (const [id] of reps) { const out = runGate(H31.AM31, H31.FORWARD_ORDER31, ACTUAL, { ...FIXOLD, [id]: `${FIXOLD[id].slice(0, -1)} (edited)\n` }); if (!out.some((q) => q.kind === 'fixture' && q.id === id)) failures.push(id); }
    check('a change of the fixture alone is rejected for every approved record', failures.length === 0, failures);
  }
  { // The finding's own probe: RM31_6 with an unapproved flag, its id renamed consistently, nothing else touched.
    const r = H31.AM31.RM31_6; const neu2 = r.neu.replace('--out', '--force --out'); const nid = 'RM31_6B';
    const records = { ...H31.AM31 }; delete records.RM31_6; records[nid] = { ...r, neu: neu2 };
    const forward = { ...H31.FORWARD_ORDER31, 'README.md': H31.FORWARD_ORDER31['README.md'].map((x) => (x === 'RM31_6' ? nid : x)) };
    const fix = { ...FIXOLD }; delete fix.RM31_6; fix[nid] = FIXOLD.RM31_6;
    const probe = runGate(records, forward, { ...ACTUAL, 'README.md': ACTUAL['README.md'].replace(r.neu, () => neu2) }, fix);
    const legacy = probe.filter((q) => q.kind !== 'approved');
    check('the review probe (RM31_6 gains an unapproved flag AND its id is renamed, helper, fixture and file consistent) leaves every legacy check satisfied and is rejected only by the pins', neu2 !== r.neu && legacy.length === 0 && probe.some((q) => q.kind === 'approved' && q.id === nid) && probe.some((q) => q.kind === 'approved' && q.id === 'RM31_6'), msgs(probe));
  }
}
for (const k of AMENDABLE) {
  const raw = ACTUAL[k];
  check(`${k}: LF only, no BOM, exactly one final LF`, typeof raw === 'string' && !raw.includes('\r') && raw.charCodeAt(0) !== 0xfeff && raw.endsWith('\n') && !raw.endsWith('\n\n'), typeof raw === 'string' ? undefined : raw);
}

// The helper agrees with this spec's engine, and refuses what it must refuse.
for (const k of AMENDABLE) {
  const ready = REAL !== null && typeof REAL.baseline[k] === 'string' && H31.AMENDED_FILES31.includes(k);
  if (REAL !== null && !H31.AMENDED_FILES31.includes(k)) { check(`${k}: has no 3.1 record, so the actual file is the baseline`, typeof ACTUAL[k] === 'string' && sha(ACTUAL[k]) === PIN_OF[k], 'unamended'); continue; }
  const back = ready ? attempt(() => H31.reverseForFile(ACTUAL[k], k)) : null;
  check(`${k}: the helper's reverseForFile gives this spec's reversal (and so the pinned baseline)`, ready && !failedAttempt(back) && back.text === REAL.baseline[k], ready ? (failedAttempt(back) ? back : back.failed) : NOT_YET('helper reversal'));
  check(`${k}: the helper's applyForFile of the baseline gives the actual file`, ready && attempt(() => H31.applyForFile(REAL.baseline[k], k)) === ACTUAL[k], ready ? undefined : NOT_YET('helper apply'));
  check(`${k}: control: reversing the baseline again is refused`, ready && attempt(() => H31.reverseForFile(REAL.baseline[k], k)).text === null, ready ? undefined : NOT_YET('helper'));
  const ids = ready ? H31.FORWARD_ORDER31[k] : [];
  const last = ids.length > 0 ? H31.AM31[ids[ids.length - 1]] : null;
  const altered = last !== null && last.neu.length > 1 ? ACTUAL[k].replace(last.before + last.neu + last.after, () => `${last.before}${last.neu.slice(0, -2)}#\n${last.after}`) : null;
  check(`${k}: control: an altered amendment text is refused by the helper`, altered !== null && altered !== ACTUAL[k] && attempt(() => H31.reverseForFile(altered, k)).text === null, last === null ? NOT_YET('records') : undefined);
  const dup = last !== null ? ACTUAL[k].replace(last.before + last.neu + last.after, () => `${last.before}${last.neu}${last.neu}${last.after}`) : null;
  // A duplicate next to a one-sided anchor still leaves its anchor standing once, so the helper alone cannot always refuse it; what must
  // hold is that the helper never gives the pinned baseline back for it (the pin comparison is the gate's, the helper only reverses).
  const dupBack = dup === null ? null : attempt(() => H31.reverseForFile(dup, k));
  check(`${k}: control: a duplicated amendment text is refused by the helper or does not reverse to the pinned baseline`, dup !== null && dup !== ACTUAL[k] && !failedAttempt(dupBack) && (dupBack.text === null || sha(dupBack.text) !== PIN_OF[k]), last === null ? NOT_YET('records') : undefined);
  // The same three mutations on the real bytes, judged by THIS spec's gate: every one must produce a problem for that file.
  const mutate = (text) => { const c = gate({ actual: { ...ACTUAL, [k]: text }, records: H31.AM31, forward: H31.FORWARD_ORDER31, allow: ALLOW, amendable: new Set(AMENDABLE), deleteOk: DELETE_OK, pins: PIN_OF }); return c.problems.some((q) => q.file === k && ['chain', 'pin', 'roundtrip'].includes(q.kind)); };
  const missing = last !== null ? ACTUAL[k].replace(last.before + last.neu + last.after, () => last.before + last.after) : null;
  const moved = last !== null && last.neu.length > 0 ? `${last.neu}${ACTUAL[k].replace(last.neu, () => '')}` : null;
  // A mutation that leaves the file unchanged (moving the only line of VERSION) is not a mutation; at least three real ones must remain.
  const muts = [['missing', missing], ['duplicated', dup], ['altered', altered], ['moved', moved]].filter(([, m]) => m !== null && m !== ACTUAL[k]);
  check(`${k}: gate control on the real bytes: a missing, a duplicated, an altered and a moved last amendment are each rejected`, ready && last !== null && muts.length >= 3 && muts.every(([, m]) => mutate(m)), last === null ? NOT_YET('records') : Object.fromEntries(muts.map(([n, m]) => [n, mutate(m)])));
  check(`${k}: gate control on the real bytes: an unrecorded appended line is rejected`, ready && mutate(`${ACTUAL[k]}Unrecorded line.\n`), ready ? undefined : NOT_YET('gate'));
  check(`${k}: read30 of the real file is the pinned 3.0.0 baseline`, ready && (() => { const b = attempt(() => H31.read30(absOf(k))); return Buffer.isBuffer(b) && sha(b) === PIN_OF[k]; })(), ready ? undefined : NOT_YET('read30'));
}

// ------------------------------------------------------------- copying the real tree (for to30Tree and the release build) ----
function copyTree(src, to, { skipTests }) {
  (function rec(s, d, rel) {
    fs.mkdirSync(d, { recursive: true });
    for (const e of fs.readdirSync(s, { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.name === '.git' || e.name === 'node_modules' || (skipTests && rel === '' && e.name === 'tests')) continue;
      if (e.isDirectory()) rec(path.join(s, e.name), path.join(d, e.name), r);
      else if (e.isFile()) fs.copyFileSync(path.join(s, e.name), path.join(d, e.name));
    }
  })(src, to, '');
}
function enumerate(dir, { skipTests = false } = {}) {
  const out = new Map();
  (function rec(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (skipTests && rel === '' && e.name === 'tests') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p, r); else out.set(r, sha(fs.readFileSync(p)));
    }
  })(dir, '');
  return out;
}
const diffMaps = (got, want) => ({ extra: [...got.keys()].filter((k) => !want.has(k)).sort(), missing: [...want.keys()].filter((k) => !got.has(k)).sort(), changed: [...want.keys()].filter((k) => got.has(k) && got.get(k) !== want.get(k)).sort() });
const BASE_MAP = new Map(Object.entries(BASE_FILES));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-r31-'));
const scratchDir = (name) => { const d = path.join(scratch, name); fs.mkdirSync(d, { recursive: true }); return d; };

// to30Tree: the verified 3.0.0 tree, and only the exact new notes path removed.
{
  const dst = path.join(scratchDir('t30'), 'project-setup');
  const r = attempt(() => { copyTree(SKILL, dst, { skipTests: true }); H31.to30Tree(dst); return diffMaps(enumerate(dst), BASE_MAP); });
  check('to30Tree on a copy of the real tree gives exactly the pinned 3.0.0 tree (every non-test file, notes included, equals the baseline pin)', H31 !== null && !failedAttempt(r) && r.extra.length === 0 && r.missing.length === 0 && r.changed.length === 0, H31 === null ? NOT_YET('to30Tree') : r);
  const dst2 = path.join(scratchDir('t30b'), 'project-setup');
  const r2 = attempt(() => { copyTree(SKILL, dst2, { skipTests: true }); fs.writeFileSync(path.join(dst2, 'RELEASE-NOTES-3.1.1.md'), 'x\n'); fs.appendFileSync(path.join(dst2, 'scripts', 'lib.mjs'), '// drift\n'); H31.to30Tree(dst2); return diffMaps(enumerate(dst2), BASE_MAP); });
  check('control: to30Tree removes only RELEASE-NOTES-3.1.0.md, so a stray notes file and an unrelated edit stay visible', H31 !== null && !failedAttempt(r2) && JSON.stringify(r2.extra) === '["RELEASE-NOTES-3.1.1.md"]' && JSON.stringify(r2.changed) === '["scripts/lib.mjs"]', H31 === null ? NOT_YET('to30Tree') : r2);
  const dst3 = path.join(scratchDir('t30c'), 'project-setup');
  const r3 = attempt(() => { copyTree(SKILL, dst3, { skipTests: true }); const p = path.join(dst3, 'SKILL.md'); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('# project-setup 3.1.0', '# project-setup 3.1.1')); H31.to30Tree(dst3); return 'no throw'; });
  check('control: to30Tree refuses (throws) when an amended file carries an altered amendment', H31 !== null && failedAttempt(r3), H31 === null ? NOT_YET('to30Tree') : r3);
  const dst4 = path.join(scratchDir('t30d'), 'project-setup');
  const r4 = attempt(() => { copyTree(SKILL, dst4, { skipTests: true }); fs.appendFileSync(path.join(dst4, 'SKILL.md'), '\nunrecorded line\n'); H31.to30Tree(dst4); return diffMaps(enumerate(dst4), BASE_MAP); });
  check('control: an unrecorded edit inside an amended file survives to30Tree and shows as a change against the pinned 3.0.0 tree (nothing is hidden by the reversal)', H31 !== null && !failedAttempt(r4) && JSON.stringify(r4.changed) === '["SKILL.md"]' && r4.extra.length === 0 && r4.missing.length === 0, H31 === null ? NOT_YET('to30Tree') : r4);
}

// ----------------------------------------------- the C18 helper composes the 3.1 reversal before the existing historical views ----
{
  const keys18 = ['SKILL.md', 'README.md', 'CHANGELOG.md', 'VERSION', '@root/README.md', '@root/TODO.md', '@root/.ai/context/project-tree.md'];
  check('AMENDED_FILES18 is still exactly the seven historical files', H18 !== null && JSON.stringify([...H18.AMENDED_FILES18].sort()) === JSON.stringify([...keys18].sort()), H18 && H18.AMENDED_FILES18);
  for (const k of keys18) {
    const v = H18 === null ? null : attempt(() => H18.readRc4(absOf(k)));
    check(`${k}: readRc4 of the real 3.1 file is the rc.4 view (3.1 reversed first, then 3.0.0), SHA-256 equal to the baseline helper's`, Buffer.isBuffer(v) && sha(v) === RC4_VIEW[k], H18 === null ? NOT_YET('c18-amendments', L18.err) : Buffer.isBuffer(v) ? sha(v) : v);
  }
  for (const k of ['references/docs-generation.md', 'references/modes.md', 'references/report.md']) {
    const v = H18 === null ? null : attempt(() => H18.readRc4(absOf(k)));
    check(`${k}: readRc4 of the real file is the 3.0.0 baseline bytes (the 3.1-only files are reversed too)`, Buffer.isBuffer(v) && sha(v) === BASE_FILES[k], H18 === null ? NOT_YET('c18-amendments', L18.err) : Buffer.isBuffer(v) ? sha(v) : v);
  }
  const dst = path.join(scratchDir('rc4'), 'project-setup');
  const r = attempt(() => { copyTree(SKILL, dst, { skipTests: true }); H18.toRc4Tree(dst); return enumerate(dst); });
  const want = new Map(BASE_MAP); want.delete('RELEASE-NOTES-3.0.0.md'); for (const k of ['SKILL.md', 'README.md', 'CHANGELOG.md', 'VERSION']) want.set(k, RC4_VIEW[k]);
  const dd = failedAttempt(r) || H18 === null ? null : diffMaps(r, want);
  check('toRc4Tree on a copy of the real tree removes both notes files and reconstructs the rc.4 tree (the four amended files at their rc.4 pins, everything else at the baseline)', dd !== null && dd.extra.length === 0 && dd.missing.length === 0 && dd.changed.length === 0, H18 === null ? NOT_YET('c18-amendments') : dd ?? r);
}

// ======================================================================== B. mutation controls for the gate ====
const synthText = (ls) => `${ls.join('\n')}\n`;
const SYN_BASE = {
  'A.md': synthText(['# Doc A', '', 'Intro line one.', 'Version token 1.0.0 here.', '', '- The agent MUST confirm before writing.', '- The agent SHOULD NOT log secrets.', '', 'Tail paragraph.']),
  'B.md': synthText(['# Doc B', '', 'Version token 1.0.0 here.', '', 'Repeated line.', '', 'Repeated line.', '', '- Setup MAY ask once.']),
  'T.md': synthText(['# TODO', '', '- keep item.', '- competing homes item line one', '  competing homes item line two', '- overwrite work stays.', '- Reviewer residuals stay.']),
};
const SYN_OTHER = 'unrelated\n';
const R = (file, before, old, neu, after) => ({ file, before, old, neu, after });
const SYN_RECORDS = () => ({
  REP_A: R('A.md', '', 'Version token 1.0.0 here.\n', 'Version token 2.0.0 here.\n', ''),
  INS_A_TAIL: R('A.md', 'Tail paragraph.\n', '', 'Added paragraph one.\n', ''),
  INS_A_TOP: R('A.md', '# Doc A\n\n', '', 'Mapping note.\n\n', 'Intro line one.\n'),
  INS_B: R('B.md', '# Doc B\n\n', '', 'Doc B note.\n\n', 'Version token 1.0.0 here.\n'),
  INS_T: R('T.md', '- Reviewer residuals stay.\n', '', '- New follow-up.\n', ''),
});
const SYN_FORWARD = () => ({ 'A.md': ['REP_A', 'INS_A_TOP', 'INS_A_TAIL'], 'B.md': ['INS_B'], 'T.md': ['INS_T'] });
/** Builds a consistent scenario: the actual files are the baseline with the records applied in order (so a forbidden record is isolated from integrity failures). */
function synth({ stage = 1, mutateRecords, mutateForward, mutateActual, mutateCfg } = {}) {
  const records = SYN_RECORDS();
  const forward = SYN_FORWARD();
  if (mutateRecords) mutateRecords(records, forward);
  if (mutateForward) mutateForward(forward);
  const actual = {};
  for (const [file, base] of Object.entries(SYN_BASE)) {
    let t = base;
    for (const id of forward[file] ?? []) { if (t === null || !has(records, id)) { t = null; break; } t = applyRec(t, records[id]); }
    actual[file] = t === null ? base : t;
  }
  if (mutateActual) mutateActual(actual);
  const cfg = {
    actual, records, forward, amendable: new Set(Object.keys(SYN_BASE)), deleteOk: stage === 2 ? new Set(['T.md']) : new Set(),
    allow: stage === 2 ? { 'A.md': [[4, 4]], 'T.md': [[4, 5]] } : { 'A.md': [[4, 4]] },
    pins: Object.fromEntries(Object.entries(SYN_BASE).map(([k, v]) => [k, sha(v)])),
    // The synthetic approved pins come from the UNMUTATED records, so a mutated record is judged against what was approved.
    approved: stage === 2 ? { REP_A: SYN_RECORDS().REP_A, CLOSE_T: TODO_CLOSEOUT } : { REP_A: SYN_RECORDS().REP_A },
  };
  if (mutateCfg) mutateCfg(cfg);
  return gate(cfg).problems;
}
const found = (ps, kind, rx) => ps.some((q) => q.kind === kind && rx.test(q.msg));
const detail = (ps) => ps.map((q) => `${q.kind}: ${q.msg}`).slice(0, 6);
const control = (name, ps, kind, rx) => check(`gate control: ${name}`, found(ps, kind, rx), detail(ps));
const TODO_CLOSEOUT = R('T.md', '- keep item.\n', '- competing homes item line one\n  competing homes item line two\n', '', '- overwrite work stays.\n');

{
  const base1 = synth();
  check('gate control: the valid synthetic stage-1 set (a replacement in the allowlisted line plus insertions) has no problem', base1.length === 0, detail(base1));
  const stage2 = synth({ stage: 2, mutateRecords: (r, f) => { r.CLOSE_T = TODO_CLOSEOUT; f['T.md'].push('CLOSE_T'); } });
  check('gate control: the valid synthetic stage-2 set (closeout deletion of exactly the allowlisted lines) has no problem', stage2.length === 0, detail(stage2));
  control('the same closeout under the stage-1 allowlist is rejected (the deletion waits for the live acceptance)', synth({ stage: 1, mutateRecords: (r, f) => { r.CLOSE_T = TODO_CLOSEOUT; f['T.md'].push('CLOSE_T'); } }), 'range', /no allowlisted line range/);
  control('stage 2: deleting the adjacent overwrite item alongside the closeout is rejected', synth({ stage: 2, mutateRecords: (r, f) => { r.CLOSE_T = R('T.md', '- keep item.\n', '- competing homes item line one\n  competing homes item line two\n- overwrite work stays.\n', '', '- Reviewer residuals stay.\n'); f['T.md'].push('CLOSE_T'); } }), 'range', /outside the allowlisted ranges/);
  control('stage 2: deleting only the adjacent overwrite item is rejected', synth({ stage: 2, mutateRecords: (r, f) => { r.CLOSE_T = R('T.md', '  competing homes item line two\n', '- overwrite work stays.\n', '', '- Reviewer residuals stay.\n'); f['T.md'].push('CLOSE_T'); } }), 'range', /outside the allowlisted ranges/);
  control('a deletion in a file that allows none is rejected even in an allowlisted-looking position', synth({ mutateRecords: (r, f) => { r.DEL_A = R('A.md', '', 'Tail paragraph.\n', '', ''); f['A.md'].push('DEL_A'); } }), 'shape', /a deletion, which this file does not allow/);

  control('a non-allowlisted replacement is rejected', synth({ mutateRecords: (r, f) => { r.REP_B = R('B.md', '', '- Setup MAY ask once.\n', '- Setup asks twice.\n', ''); f['B.md'].push('REP_B'); } }), 'range', /no allowlisted line range/);
  control('an allowlisted record moved to another path is rejected (the text exists once in B.md, which has no allowlist)', synth({ mutateRecords: (r) => { r.REP_A = { ...r.REP_A, file: 'B.md' }; r.REP_A.before = ''; }, mutateForward: (f) => { f['A.md'] = f['A.md'].filter((id) => id !== 'REP_A'); f['B.md'].push('REP_A'); } }), 'range', /no allowlisted line range/);
  control('an allowlisted record enlarged to cover the next paragraph is rejected', synth({ mutateRecords: (r) => { r.REP_A = R('A.md', '', 'Version token 1.0.0 here.\n\n', 'Version token 2.0.0 here.\n\nExtra paragraph.\n\n', ''); } }), 'range', /outside the allowlisted ranges/);
  control('an allowlisted record enlarged over an obligation line is rejected by the range and by the keyword rule', synth({ mutateRecords: (r) => { r.REP_A = R('A.md', '', 'Version token 1.0.0 here.\n\n- The agent MUST confirm before writing.\n', 'Version token 2.0.0 here.\n', ''); } }), 'keyword', /RFC 2119 keyword/);
  for (const [word, line] of [['MUST', '- The agent MUST confirm before writing.\n'], ['SHOULD NOT', '- The agent SHOULD NOT log secrets.\n'], ['MAY', null]]) {
    const text = line ?? '- Setup MAY ask once.\n';
    const file = line === null ? 'B.md' : 'A.md';
    const ps = synth({ mutateCfg: (c) => { c.allow = { 'A.md': [[4, 7]], 'B.md': [[9, 9]] }; }, mutateRecords: (r, f) => { r.KW = R(file, '', text, text.replace(/MUST|SHOULD NOT|MAY/, 'will'), ''); f[file].push('KW'); } });
    control(`an old holding "${word}" is rejected even where the line range is allowlisted`, ps, 'keyword', /RFC 2119 keyword/);
  }
  control('whole-file baseline substitution is rejected (old is the entire baseline file)', synth({ mutateRecords: (r, f) => { r.WHOLE = R('A.md', '', SYN_BASE['A.md'], SYN_BASE['A.md'].replace('Tail paragraph.', 'Changed paragraph.'), ''); f['A.md'] = ['WHOLE']; delete r.REP_A; delete r.INS_A_TOP; delete r.INS_A_TAIL; } }), 'range', /outside the allowlisted ranges|occurs exactly once/);
  control('a record that replaces another record\'s new text is rejected (its old is not baseline text)', synth({ mutateRecords: (r, f) => { r.REP_A2 = R('A.md', '', 'Version token 2.0.0 here.\n', 'Version token 3.0.0 here.\n', ''); f['A.md'].splice(f['A.md'].indexOf('REP_A') + 1, 0, 'REP_A2'); } }), 'range', /occurs exactly once in the baseline/);

  // Integrity: missing, duplicated, moved, modified additions; unrelated changes; baseline pin.
  control('a missing addition is rejected', synth({ mutateActual: (a) => { a['A.md'] = a['A.md'].replace('Added paragraph one.\n', ''); } }), 'chain', /does not stand exactly once/);
  control('a duplicated addition is rejected (the same text twice)', synth({ mutateActual: (a) => { a['A.md'] = a['A.md'].replace('Added paragraph one.\n', 'Added paragraph one.\nAdded paragraph one.\n'); } }), 'pin', /not the pinned 3.0.0 baseline/);
  control('an addition duplicated at an ambiguous anchor is rejected (the anchor stands twice)', synth({ mutateRecords: (r, f) => { r.INS_B = R('B.md', 'Repeated line.\n', '', 'Doc B note.\n', ''); }, mutateActual: (a) => { a['B.md'] = a['B.md'].replace(/Repeated line\.\n/g, 'Repeated line.\nDoc B note.\n'); } }), 'chain', /does not stand exactly once at its anchor \(found 2\)/);
  control('a moved addition is rejected', synth({ mutateActual: (a) => { a['A.md'] = `Added paragraph one.\n${a['A.md'].replace('Added paragraph one.\n', '')}`; } }), 'chain', /does not stand exactly once/);
  control('a modified addition is rejected (one changed character)', synth({ mutateActual: (a) => { a['A.md'] = a['A.md'].replace('Added paragraph one.', 'Added paragraph 0ne.'); } }), 'chain', /does not stand exactly once/);
  control('an unrecorded change inside an amended file is rejected', synth({ mutateActual: (a) => { a['A.md'] = a['A.md'].replace('log secrets', 'log tokens'); } }), 'pin', /not the pinned 3.0.0 baseline/);
  control('an unrecorded change next to an anchor is rejected (the anchor no longer stands)', synth({ mutateActual: (a) => { a['A.md'] = a['A.md'].replace('Intro line one.', 'Intro line 1.'); } }), 'chain', /does not stand exactly once/);
  control('a removed obligation line (unrecorded) is rejected', synth({ mutateActual: (a) => { a['A.md'] = a['A.md'].replace('- The agent MUST confirm before writing.\n', ''); } }), 'pin', /not the pinned 3.0.0 baseline/);
  control('a weakened obligation (MUST to SHOULD, unrecorded) is rejected', synth({ mutateActual: (a) => { a['A.md'] = a['A.md'].replace('MUST confirm', 'SHOULD confirm'); } }), 'pin', /not the pinned 3.0.0 baseline/);
  control('reversing in the wrong order is rejected (records whose anchors depend on each other, listed swapped)', synth({ mutateRecords: (r, f) => { r.INS_A_NEXT = R('A.md', 'Added paragraph one.\n', '', 'Second paragraph.\n', ''); f['A.md'].push('INS_A_NEXT'); }, mutateForward: (f) => { f['A.md'] = ['REP_A', 'INS_A_TOP', 'INS_A_NEXT', 'INS_A_TAIL']; } }), 'chain', /does not stand exactly once/);
  {
    const ps = synth({ mutateCfg: (c) => { c.others = undefined; } });
    check('gate control: a file outside the amendable set is not part of the gate (the enumeration check below owns it)', ps.length === 0, detail(ps));
  }

  // Shapes.
  control('a wildcard id is rejected', synth({ mutateRecords: (r, f) => { r['REP_*'] = R('B.md', '', '', 'x\n', 'Doc'); f['B.md'].push('REP_*'); } }), 'shape', /not a plain identifier/);
  control('a wildcard file key is rejected', synth({ mutateRecords: (r, f) => { r.WILD = R('docs/*.md', '', '', 'x\n', 'y'); f['A.md'].push('WILD'); } }), 'shape', /wildcard|closed amendable set/);
  control('a record with an extra key is rejected', synth({ mutateRecords: (r) => { r.INS_B = { ...r.INS_B, note: 'x' }; } }), 'shape', /record keys are not exactly/);
  control('a record with a non-string field is rejected', synth({ mutateRecords: (r) => { r.INS_B = { ...r.INS_B, after: 5 }; } }), 'shape', /not a string/);
  control('an insertion with no anchor is rejected', synth({ mutateRecords: (r) => { r.INS_B = R('B.md', '', '', 'Doc B note.\n', ''); } }), 'shape', /no anchor/);
  control('an insertion that starts mid-line is rejected', synth({ mutateRecords: (r) => { r.INS_A_TAIL = R('A.md', 'Tail para', '', 'Added paragraph one.\n', 'graph.\n'); } }), 'shape', /line boundary/);
  control('an addition without a final LF is rejected', synth({ mutateRecords: (r) => { r.INS_A_TAIL = R('A.md', 'Tail paragraph.\n', '', 'Added', ''); } }), 'shape', /no final LF/);
  control('a record with CR in a field is rejected', synth({ mutateRecords: (r) => { r.INS_A_TAIL = R('A.md', 'Tail paragraph.\n', '', 'Added paragraph one.\r\n', ''); } }), 'shape', /CR/);
  control('a no-op record is rejected', synth({ mutateRecords: (r, f) => { r.NOOP = R('A.md', '', 'Version token 2.0.0 here.\n', 'Version token 2.0.0 here.\n', ''); f['A.md'].push('NOOP'); } }), 'shape', /no-op/);
  control('a record listed twice in the forward order is rejected', synth({ mutateForward: (f) => { f['B.md'] = ['INS_B', 'INS_B']; } }), 'order', /more than once/);
  control('a record missing from every order is rejected', synth({ mutateForward: (f) => { f['T.md'] = []; } }), 'order', /not listed in any forward order/);
  control('a record ordered under another file is rejected', synth({ mutateForward: (f) => { f['T.md'] = ['INS_T', 'INS_B']; f['B.md'] = []; } }), 'order', /ordered under T\.md but its record names B\.md/);
  control('an exact fixture mismatch on a replacement is rejected', synth({ mutateCfg: (c) => { c.fixtureOld = { REP_A: 'Version token 0.9.0 here.\n' }; } }), 'fixture', /differs from the exact bytes/);
  control('a replacement with no fixture entry is rejected', synth({ mutateCfg: (c) => { c.fixtureOld = {}; } }), 'fixture', /no entry in the fixture/);
  check('gate control: the exact fixture bytes are accepted', synth({ mutateCfg: (c) => { c.fixtureOld = { REP_A: 'Version token 1.0.0 here.\n' }; } }).length === 0);
  // R4: the approved pins decide a replacement's identity, whatever the helper records, the order and the fixture say.
  const onlyApproved = (ps) => ps.length > 0 && ps.every((q) => q.kind === 'approved');
  control('a changed NEW text with the same id is rejected by the pin (a consistent change: records, actual file and fixture agree)', synth({ mutateRecords: (r) => { r.REP_A = R('A.md', '', 'Version token 1.0.0 here.\n', 'Version token 2.0.0 --unapproved here.\n', ''); } }), 'approved', /neu differs/);
  check('gate control: that changed new text leaves only the approved-pin problem (no chain, pin, round-trip, range or fixture problem), so only the pin can see it', onlyApproved(synth({ mutateRecords: (r) => { r.REP_A = R('A.md', '', 'Version token 1.0.0 here.\n', 'Version token 2.0.0 --unapproved here.\n', ''); } })), detail(synth({ mutateRecords: (r) => { r.REP_A = R('A.md', '', 'Version token 1.0.0 here.\n', 'Version token 2.0.0 --unapproved here.\n', ''); } })));
  { const ps = synth({ mutateRecords: (r, f) => { r.REP_Z = r.REP_A; delete r.REP_A; f['A.md'] = f['A.md'].map((x) => (x === 'REP_A' ? 'REP_Z' : x)); }, mutateCfg: (c) => { c.fixtureOld = { REP_Z: 'Version token 1.0.0 here.\n' }; } });
    control('a renamed id is rejected as an unapproved replacement even with the records, the order and the fixture renamed together', ps, 'approved', /REP_Z: a replacement that is not one of the approved named records/);
    control('a renamed id also leaves the approved id without a record', ps, 'approved', /REP_A: an approved replacement has no record/);
    check('gate control: the renamed id leaves only approved-pin problems', onlyApproved(ps), detail(ps)); }
  control('a changed BEFORE anchor (still standing once) is rejected by the pin', synth({ mutateRecords: (r) => { r.REP_A = R('A.md', 'Intro line one.\n', 'Version token 1.0.0 here.\n', 'Version token 2.0.0 here.\n', ''); } }), 'approved', /before differs/);
  control('a changed AFTER anchor (still standing once) is rejected by the pin', synth({ mutateRecords: (r) => { r.REP_A = R('A.md', '', 'Version token 1.0.0 here.\n', 'Version token 2.0.0 here.\n', '\n'); } }), 'approved', /after differs/);
  control('a changed OLD text is rejected by the pin even when the fixture was changed to match', synth({ mutateRecords: (r) => { r.REP_A = R('A.md', '', 'Version token 1.0.0 here.\n\n', 'Version token 2.0.0 here.\n\n', ''); }, mutateCfg: (c) => { c.fixtureOld = { REP_A: 'Version token 1.0.0 here.\n\n' }; } }), 'approved', /old differs/);
  control('a record moved to another file is rejected by the pin', synth({ mutateRecords: (r) => { r.REP_A = { ...r.REP_A, file: 'B.md' }; } }), 'approved', /file differs/);
  control('a removed approved record is rejected (the approved set is closed in both directions)', synth({ mutateRecords: (r, f) => { delete r.REP_A; f['A.md'] = f['A.md'].filter((x) => x !== 'REP_A'); } }), 'approved', /REP_A: an approved replacement has no record/);
  check('gate control: with no approved set at all, no replacement is accepted (fail closed)', gate({ actual: Object.fromEntries(Object.entries(SYN_BASE).map(([k, v]) => [k, v])), records: {}, forward: {}, amendable: new Set(Object.keys(SYN_BASE)), deleteOk: new Set(), allow: {}, pins: Object.fromEntries(Object.entries(SYN_BASE).map(([k, v]) => [k, sha(v)])) }).problems.length === 0 && found(synth({ mutateCfg: (c) => { delete c.approved; } }), 'approved', /not one of the approved named records/));
  for (const [label, text] of [['approval made optional', 'Approval is optional for this step.\n'], ['approval made unnecessary', 'Setup need not obtain approval first.\n'], ['a permission to skip', 'Setup MAY skip the approval step here.\n'], ['an override', 'This rule overrides the security policy.\n'], ['an exemption', 'The new files are exempt from the root-start rule.\n']]) {
    control(`new text carrying ${label} is rejected`, synth({ mutateRecords: (r) => { r.INS_B = R('B.md', '# Doc B\n\n', '', text, 'Version token 1.0.0 here.\n'); } }), 'weaken', /new text carries/);
  }
  check('gate control: the two plan sentences and a plain prohibition are not mistaken for weakening', synth({ mutateRecords: (r) => { r.INS_B = R('B.md', '# Doc B\n\n', '', `${PHASE1_SENTENCE}\n${MODES_OBSERVATION}\nSetup MUST NOT skip the approval step.\n\n`, 'Version token 1.0.0 here.\n'); } }).length === 0);

  // Obligation checks on actual text.
  const digests = lf(SYN_BASE['A.md']).split('\n').filter((l) => KEYWORD.test(l)).map(lineDigest);
  check('gate control: the obligation check passes on the baseline and on a text with insertions', obligationProblems(SYN_BASE['A.md'], digests) === 0 && obligationProblems(`Extra.\n${SYN_BASE['A.md']}Tail.\n`, digests) === 0);
  check('gate control: the obligation check rejects a deleted obligation and a weakened one', obligationProblems(SYN_BASE['A.md'].replace('- The agent MUST confirm before writing.\n', ''), digests) === 1 && obligationProblems(SYN_BASE['A.md'].replace('MUST confirm', 'SHOULD confirm'), digests) === 1 && obligationProblems(SYN_BASE['A.md'].replace('SHOULD NOT log', 'SHOULD log'), digests) === 1);
  const withPhrases = gate({ ...{ actual: { 'T.md': SYN_BASE['T.md'] }, records: {}, forward: {}, amendable: new Set(['T.md']), deleteOk: new Set(), allow: {}, pins: { 'T.md': sha(SYN_BASE['T.md']) } }, phrases: { 'T.md': ['overwrite work stays.', 'Reviewer residuals stay.'] } }).problems;
  const withoutPhrase = gate({ actual: { 'T.md': SYN_BASE['T.md'].replace('- overwrite work stays.\n', '') }, records: {}, forward: {}, amendable: new Set(['T.md']), deleteOk: new Set(), allow: {}, pins: { 'T.md': sha(SYN_BASE['T.md']) }, phrases: { 'T.md': ['overwrite work stays.'] } }).problems;
  check('gate control: a retained-sentence requirement passes when present and fails when the sentence is deleted', withPhrases.length === 0 && found(withoutPhrase, 'obligation', /required retained sentence is missing/), detail(withoutPhrase));
  const ambiguous = R('B.md', 'Repeated line.\n', '', 'Doc B note.\n', '');
  check('gate control: forward application refuses an ambiguous anchor (the engine never guesses which of two positions)', applyRec(SYN_BASE['B.md'], ambiguous) === null && applyRec(SYN_BASE['B.md'], SYN_RECORDS().INS_B) !== null);
  check('gate control: lineRangeOf is exact (whole lines only, a duplicated line is ambiguous, line numbers are 1-based and inclusive)', JSON.stringify(lineRangeOf(SYN_BASE['A.md'], 'Version token 1.0.0 here.\n')) === '[4,4]' && lineRangeOf(SYN_BASE['B.md'], 'Repeated line.\n') === null && lineRangeOf(SYN_BASE['A.md'], 'Version token') === null && JSON.stringify(lineRangeOf(SYN_BASE['T.md'], '- competing homes item line one\n  competing homes item line two\n')) === '[4,5]');
}

// ===================================================== B2. controls for the notes and public-claims engines ====
const NOTES_GOOD = [
  '# project-setup 3.1.0', '', 'Documentation mapping for backend-standards projects.', '',
  '## Compatibility', '', 'Existing projects keep working; a project without the signals is unaffected.', '',
  '## Consolidation', '', 'Existing full documents are folded into 03 before any pointer replaces them.', '',
  '## Recovery', '', 'A PS-first project records what the backend-standards procedure did before proposing repairs.', '',
  '## Rollback', '', 'Roll back the reviewed transaction as one unit.', '',
  '## Verification', '', 'Live acceptance is pending evidence; nothing here is a measured result.', '',
  '## Limitations', '', 'A later backend-standards re-sync can overwrite consolidated documentation.', '',
  '## Provenance and release artifacts', '', 'Artifact identities are recorded in the acceptance evidence, not here.', '',
].join('\n');
{
  const nb = (s) => Buffer.from(s, 'utf8');
  check('notes control: the valid synthetic notes have no problem', notesProblems(nb(NOTES_GOOD)).length === 0, notesProblems(nb(NOTES_GOOD)));
  const nctl = (name, buf, rx) => { const p = notesProblems(buf); check(`notes control: ${name}`, p.some((m) => rx.test(m)), p); };
  nctl('a BOM is rejected', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), nb(NOTES_GOOD)]), /BOM/);
  nctl('CRLF is rejected', nb(NOTES_GOOD.replace(/\n/g, '\r\n')), /CR/);
  nctl('a missing final LF is rejected', nb(NOTES_GOOD.slice(0, -1)), /final LF/);
  nctl('a second final LF is rejected', nb(`${NOTES_GOOD}\n`), /final LF/);
  nctl('non-ASCII text is rejected', nb(NOTES_GOOD.replace('Existing', 'Exist\u00efng')), /non-ASCII/);
  nctl('a standalone 40-hex ID is rejected', nb(`${NOTES_GOOD}Commit ${'a'.repeat(40)}\n`), /hex/);
  nctl('a standalone 64-hex ID is rejected', nb(`${NOTES_GOOD}Digest ${'0123456789abcdef'.repeat(4)}\n`), /hex/);
  nctl('a personal path is rejected', nb(`${NOTES_GOOD}See C:\\Users\\someone\\skills\n`), /personal path/);
  nctl('a wrong title is rejected', nb(NOTES_GOOD.replace('# project-setup 3.1.0', '# project-setup 3.0.0')), /title/);
  for (const [name, rx] of NOTES_TERMS) nctl(`a missing ${name} heading is rejected`, nb(NOTES_GOOD.split('\n').map((l) => (/^## /.test(l) && rx.test(l) ? '## Other' : l)).join('\n')), new RegExp(`no ## heading covers ${name}`));
  nctl('stage 1: missing "pending evidence" is rejected', nb(NOTES_GOOD.replace('pending evidence', 'something else')), /pending evidence/);
  nctl('stage 1: a resolved acceptance result is rejected', nb(`${NOTES_GOOD}Live acceptance passed on every scenario.\n`), /resolved acceptance/);
  nctl('a missing re-sync overwrite limitation is rejected', nb(NOTES_GOOD.replace('re-sync can overwrite', 'run can change')), /re-sync overwrite limitation/);
}
// The acceptance document (plan P3): it names the live helper, no personal path, and for user paths only the two skill directories.
// A path inside one of those two directories is fine; a sibling directory (.codex, .claude\settings) or a home-relative spelling is not.
const ACC_DIRS = ['$env:USERPROFILE\\.claude\\skills', '$env:USERPROFILE\\.agents\\skills'];
function accProblems(text) {
  if (typeof text !== 'string') return ['the acceptance document is not text'];
  const p = [];
  if (/[A-Za-z]:\\Users\\|\/home\/|\/Users\//.test(text)) p.push('it names a personal path');
  for (const tok of ['%USERPROFILE%', '$HOME', '$env:HOME', '%HOMEPATH%', '$env:LOCALAPPDATA', '$env:APPDATA', '~/', '~\\']) if (text.includes(tok)) p.push('it uses another home-relative spelling (' + tok + ')');
  const used = [...new Set(text.match(/\$env:USERPROFILE(?:\\[A-Za-z0-9_.-]+)*/g) ?? [])];
  for (const u of used) if (!ACC_DIRS.some((d) => u === d || u.startsWith(d + '\\'))) p.push('it names a user path other than the two skill directories (' + u + ')');
  for (const d of ACC_DIRS) if (!used.some((u) => u === d || u.startsWith(d + '\\'))) p.push('it does not name ' + d);
  if (!text.includes('bs-doc-map.mjs')) p.push('it does not name the live helper bs-doc-map.mjs');
  return p;
}
{
  const ACC_GOOD = 'Install the candidate; the explicit directories are `$env:USERPROFILE\\.claude\\skills` and `$env:USERPROFILE\\.agents\\skills`.\n\nUse tests/live/bs-doc-map.mjs to initialize a workspace.\n';
  check('acceptance control: the valid synthetic document has no problem', accProblems(ACC_GOOD).length === 0, accProblems(ACC_GOOD));
  const actl = (name, text, rx) => { const q = accProblems(text); check('acceptance control: ' + name, q.some((m) => rx.test(m)), q); };
  actl('a third install directory is rejected', ACC_GOOD + 'Also install into $env:USERPROFILE\\.codex\\skills\n', /other than the two skill directories/);
  actl('a third directory that replaces the second is rejected (two names, one wrong)', ACC_GOOD.replace('.agents\\skills', '.codex\\skills'), /other than the two skill directories|does not name/);
  actl('a bare $env:USERPROFILE is rejected', ACC_GOOD + 'Work in $env:USERPROFILE\n', /other than the two skill directories/);
  actl('a settings path outside the two directories is rejected', ACC_GOOD + 'Edit $env:USERPROFILE\\.claude\\settings.json\n', /other than the two skill directories/);
  actl('a sibling directory that only shares the prefix is rejected', ACC_GOOD + 'Do not use $env:USERPROFILE\\.claude\\skills-old\n', /other than the two skill directories/);
  actl('%USERPROFILE% is rejected', ACC_GOOD + 'See %USERPROFILE%\\.claude\\skills\n', /home-relative spelling/);
  actl('$HOME is rejected', ACC_GOOD + 'See $HOME/.claude/skills\n', /home-relative spelling/);
  actl('a tilde path is rejected', ACC_GOOD + 'See ~/.claude/skills\n', /home-relative spelling/);
  actl('a drive-letter personal path is rejected', ACC_GOOD + 'See C:\\Users\\someone\\skills\n', /personal path/);
  actl('a POSIX personal path is rejected', ACC_GOOD + 'See /home/someone/skills\n', /personal path/);
  actl('a document that names only the claude directory is rejected', ACC_GOOD.replace(' and `$env:USERPROFILE\\.agents\\skills`', ''), /does not name \$env:USERPROFILE\\\.agents/);
  actl('a document that names only the agents directory is rejected', ACC_GOOD.replace('`$env:USERPROFILE\\.claude\\skills` and ', ''), /does not name \$env:USERPROFILE\\\.claude/);
  actl('a document that does not name the live helper is rejected', ACC_GOOD.replace('bs-doc-map.mjs', 'the helper'), /live helper/);
  check('acceptance control: a path inside one of the two directories is accepted', accProblems(ACC_GOOD + 'The copy lands in $env:USERPROFILE\\.claude\\skills\\project-setup\n').length === 0);
}
const GOOD_CLAIMS = () => ({
  VERSION: '3.1.0\n',
  SKILL: `---\nname: x\n---\n\n# project-setup 3.1.0\n\n## Workflow\n\n### Phase 0 - Discover (read-only), then STOP\n\nAssess the documentation mapping first.\n\n### Phase 1 - Draft (after approval)\n\n${PHASE1_SENTENCE}\n\n### Phase 2 - Review gate, then STOP\n\nx\n`,
  PSREADME: '# project-setup 3.1.0 - skill source\n\n**Release 3.1.0.** See RELEASE-NOTES-3.1.0.md for compatibility.\n\n## Test first (no installation, no real config touched)\n\nnode tests/bs-doc-map.test.mjs, node tests/release-3.1.test.mjs and node tests/c18.test.mjs.\n\n## Install (only when you decide to)\n\nx\n\n## Local candidate release\n\nrequires or creates project-setup-v3.1.0 in the distribution repository.\n\nnode install/release.mjs --tag project-setup-v3.1.0 --out <unused-directory>\n',
  CHANGELOG: '# Changelog\n\n## 3.1.0\n\nMapping.\n\n## 3.0.0\n\nFinal release.\n',
  ROOTREADME: '`project-setup` (3.1.0, shared by Claude Code and Codex) is **not**\nThis installs `project-setup` 3.1.0 for both tools.\n`project-setup/RELEASE-NOTES-3.1.0.md` section "Rollback".\n|-- project-setup/   general-purpose - shared Claude Code + Codex setup (3.1.0, own installer and tests)\nHistorical: project-setup/RELEASE-NOTES-3.0.0.md.\n',
  TREE: '|-- project-setup/   skill 3 - shared Claude Code + Codex agent scaffolding (3.1.0)\n(`project-setup/VERSION` is `3.1.0`) with its own layout\n',
  MODES: `before\n${MODES_OBSERVATION}\nafter\n`,
});
{
  const ok = claimsProblems(GOOD_CLAIMS());
  check('claims control: the valid synthetic public claims have no problem', ok.length === 0, ok.map((q) => q.msg));
  const cctl = (name, mutate, area, rx) => { const t = GOOD_CLAIMS(); mutate(t); const p = claimsProblems(t); check(`claims control: ${name}`, p.some((q) => q.area === area && rx.test(q.msg)), p.map((q) => `${q.area}: ${q.msg}`).slice(0, 4)); };
  cctl('VERSION 3.0.0 is rejected', (t) => { t.VERSION = '3.0.0\n'; }, 'VERSION', /VERSION/);
  cctl('VERSION without the final LF is rejected', (t) => { t.VERSION = '3.1.0'; }, 'VERSION', /VERSION/);
  cctl('a SKILL title still at 3.0.0 is rejected', (t) => { t.SKILL = t.SKILL.replace('# project-setup 3.1.0', '# project-setup 3.0.0'); }, 'SKILL', /title/);
  cctl('a missing Phase 1 sentence is rejected', (t) => { t.SKILL = t.SKILL.replace(PHASE1_SENTENCE, 'Nothing.'); }, 'SKILL', /Phase 1 mapping sentence/);
  cctl('a Phase 1 sentence moved into Phase 2 is rejected', (t) => { t.SKILL = t.SKILL.replace(PHASE1_SENTENCE, 'Nothing.').replace('### Phase 2 - Review gate, then STOP\n\nx\n', `### Phase 2 - Review gate, then STOP\n\n${PHASE1_SENTENCE}\n`); }, 'SKILL', /inside Phase 1/);
  cctl('a duplicated Phase 1 sentence is rejected', (t) => { t.SKILL = t.SKILL.replace(PHASE1_SENTENCE, `${PHASE1_SENTENCE}\n\n${PHASE1_SENTENCE}`); }, 'SKILL', /Phase 1 mapping sentence/);
  cctl('a Phase 0 without the mapping assessment is rejected', (t) => { t.SKILL = t.SKILL.replace('documentation mapping', 'documentation'); }, 'SKILL', /Phase 0/);
  cctl('a README title at 3.0.0 is rejected', (t) => { t.PSREADME = t.PSREADME.replace('# project-setup 3.1.0', '# project-setup 3.0.0'); }, 'PSREADME', /title/);
  cctl('a README opening that still cites the 3.0.0 notes is rejected', (t) => { t.PSREADME = t.PSREADME.replace('RELEASE-NOTES-3.1.0.md', 'RELEASE-NOTES-3.0.0.md'); }, 'PSREADME', /opening release sentence/);
  for (const g of ['bs-doc-map.test.mjs', 'release-3.1.test.mjs', 'c18.test.mjs']) cctl(`an acceptance section missing ${g} is rejected`, (t) => { t.PSREADME = t.PSREADME.replace(g, 'x'); }, 'PSREADME', new RegExp(g.replace(/\./g, '\\.')));
  cctl('a local release section still on the 3.0.0 tag is rejected', (t) => { t.PSREADME = t.PSREADME.replace(/project-setup-v3\.1\.0/g, 'project-setup-v3.0.0'); }, 'PSREADME', /3\.1\.0 tag token/);
  cctl('a changelog without the 3.1.0 entry first is rejected', (t) => { t.CHANGELOG = t.CHANGELOG.replace('## 3.1.0', '## 3.0.9'); }, 'CHANGELOG', /3\.1\.0/);
  cctl('a changelog that lost the 3.0.0 entry is rejected', (t) => { t.CHANGELOG = '# Changelog\n\n## 3.1.0\n\nMapping.\n'; }, 'CHANGELOG', /3\.0\.0 entry/);
  cctl('a root README that keeps the stale introduction claim is rejected', (t) => { t.ROOTREADME += '`project-setup` (3.0.0, shared by Claude Code and Codex) is **not**\n'; }, 'ROOTREADME', /stale current 3\.0\.0 claim/);
  cctl('a root README that keeps the stale install claim is rejected', (t) => { t.ROOTREADME += 'This installs `project-setup` 3.0.0 for both tools.\n'; }, 'ROOTREADME', /stale current 3\.0\.0 claim/);
  cctl('a root README that keeps the stale layout line is rejected', (t) => { t.ROOTREADME += '|-- project-setup/   general-purpose (3.0.0, own installer and tests)\n'; }, 'ROOTREADME', /stale current 3\.0\.0 claim/);
  cctl('a root README without the rollback link is rejected', (t) => { t.ROOTREADME = t.ROOTREADME.replace('section "Rollback"', 'section "Overview"'); }, 'ROOTREADME', /rollback link/);
  cctl('a project tree still at 3.0.0 is rejected', (t) => { t.TREE = t.TREE.replace(/3\.1\.0/g, '3.0.0'); }, 'TREE', /3\.1\.0|stale/);
  cctl('a modes file that keeps the stale observation is rejected', (t) => { t.MODES += `${MODES_STALE}\n`; }, 'MODES', /stale scaffold observation/);
  cctl('a modes file without the scoped observation is rejected', (t) => { t.MODES = 'before\nafter\n'; }, 'MODES', /scoped scaffold observation/);
  cctl('a duplicated scoped observation is rejected', (t) => { t.MODES += `${MODES_OBSERVATION}\n`; }, 'MODES', /scoped scaffold observation/);
}

// ===================================================== C. actual obligations and D. public claims, notes ====
const lines31 = (k) => lf(actualText(k)).split('\n');
// Files whose baseline holds no uppercase RFC 2119 line (references/report.md, the root README, the project tree) have no digest to check
// here; the gate alone protects them (their amendments are insertions or allowlisted replacements without such a word).
for (const k of Object.keys(NORMATIVE_LINES).filter((f) => NORMATIVE_LINES[f].length > 0)) {
  const miss = typeof ACTUAL[k] === 'string' ? obligationProblems(ACTUAL[k], NORMATIVE_LINES[k]) : null;
  check(`${k}: every baseline line holding MUST, SHOULD or MAY is present in the actual file (${NORMATIVE_LINES[k].length} lines)`, miss === 0, miss === null ? ACTUAL[k] : `${miss} missing`);
}
const C14_SRC = attempt(() => fs.readFileSync(path.join(SKILL, 'tests', 'c14.test.mjs'), 'utf8'));
const C14_SENTENCES = (() => {
  if (typeof C14_SRC !== 'string') return null;
  const a = C14_SRC.indexOf('const B_OPPOSITES = [');
  const b = C14_SRC.indexOf('\n];', a);
  if (a < 0 || b < 0) return null;
  const out = [];
  for (const l of C14_SRC.slice(a, b).split('\n')) {
    const m = /^\s*\['b#\d', '/.exec(l);
    if (!m) continue;
    let i = m[0].length; let s = '';
    while (i < l.length && l[i] !== "'") { if (l[i] === '\\') { s += l[i + 1]; i += 2; } else { s += l[i]; i++; } }
    out.push(s);
  }
  return out;
})();
check('the C14 adoption sentences are read from the unchanged c14 source: 22 sentences, one of them the replaced scaffold observation', C14_SENTENCES !== null && C14_SENTENCES.length === 22 && C14_SENTENCES.includes(MODES_STALE), C14_SENTENCES === null ? C14_SRC : C14_SENTENCES.length);
{
  const modes = squash(lf(actualText('references/modes.md')));
  const required = C14_SENTENCES === null ? [] : C14_SENTENCES.filter((s) => s !== MODES_STALE);
  const missing = required.filter((s) => !modes.includes(squash(s)));
  // Read from the ACTUAL 3.1 modes bytes, never from the reconstructed history: C14 reads the history through readRc4 and would pass
  // even if the current file lost these obligations.
  check('actual references/modes.md keeps the 21 retained C14 adoption sentences (BS block is project content, imports and version line stay, reviewed replacement with a disposition for every customization, pending conflicts, validate checks extension references, no BS provenance)', required.length === 21 && missing.length === 0, missing.length > 0 ? missing.map((s) => s.slice(0, 60)) : required.length);
}
{
  const t = lines31('@root/TODO.md').join('\n');
  const keep = ['BS must stop overwriting PS canonical agents and wrappers.', 'Complete backend-standards 4.0.0 and toolchain-config integration.', 'reviewer residuals.', 'a MUST-rule money violation keeps its severity'];
  const stage1Only = ['The two skills use different doc homes.', 'The 4.0.0 integration has to pick one map.'];
  const want = STAGE === 1 ? [...keep, ...stage1Only] : keep;
  const miss = want.filter((s) => !squash(t).includes(s));
  check(`@root/TODO.md keeps the BS overwrite work, the integration items and the reviewer residuals${STAGE === 1 ? ', and the competing-homes subitem (stage 1 carries no closeout)' : ''}`, miss.length === 0 && t.length > 0, miss.length > 0 ? miss : t.length === 0 ? 'unreadable' : undefined);
}
{
  const cl = claimsProblems({ VERSION: ACTUAL.VERSION, SKILL: ACTUAL['SKILL.md'], PSREADME: ACTUAL['README.md'], CHANGELOG: ACTUAL['CHANGELOG.md'], ROOTREADME: ACTUAL['@root/README.md'], TREE: ACTUAL['@root/.ai/context/project-tree.md'], MODES: ACTUAL['references/modes.md'] });
  for (const area of ['VERSION', 'SKILL', 'PSREADME', 'CHANGELOG', 'ROOTREADME', 'TREE', 'MODES']) {
    const mine = cl.filter((q) => q.area === area);
    check(`current claims (${area}): ${{ VERSION: 'VERSION is exactly 3.1.0 plus LF', SKILL: 'title, Phase 0 mapping assessment and the Phase 1 mapping sentence', PSREADME: 'title, opening release sentence, three gates named, release tag tokens', CHANGELOG: 'one 3.1.0 entry first, 3.0.0 kept', ROOTREADME: 'current 3.1.0 introduction, install, rollback link and layout; no stale 3.0.0 claim', TREE: 'project tree and VERSION claim 3.1.0', MODES: 'the stale observation replaced once by the scoped one' }[area]}`, mine.length === 0, mine.length === 0 ? undefined : mine.map((q) => q.msg));
  }
  check('historical references stay: the PS README keeps its 3.0.0 notes citation inside the rc.3 host observations and the dated heading', actualText('README.md').includes('RELEASE-NOTES-3.0.0.md') && actualText('README.md').includes('## rc.3 host observations dated 2026-10-26/27'), typeof ACTUAL['README.md'] === 'string' ? undefined : ACTUAL['README.md']);
  const notesBytes = attempt(() => fs.readFileSync(path.join(SKILL, NOTES31)));
  check(`${NOTES31} exists`, Buffer.isBuffer(notesBytes), NOT_YET(NOTES31, failedAttempt(notesBytes) ? notesBytes.threw : undefined));
  const np = Buffer.isBuffer(notesBytes) ? notesProblems(notesBytes) : null;
  check(`${NOTES31} keeps the notes contract (ASCII, LF, no BOM, one final LF, no 40- or 64-hex ID, no personal path, title, seven covered headings, pending evidence at stage 1, the re-sync overwrite limitation)`, np !== null && np.length === 0, np === null ? NOT_YET(NOTES31) : np);
  const cmdNotes = Buffer.isBuffer(notesBytes) ? notesBytes.toString('utf8') : '';
  check(`${NOTES31} names the check that would close the live acceptance (it is pending, not measured) and keeps the unresolved-provenance contract of the builder`, /pending evidence/i.test(cmdNotes) && !/(?<![0-9A-Fa-f])[0-9A-Fa-f]{40}(?![0-9A-Fa-f])/.test(cmdNotes), Buffer.isBuffer(notesBytes) ? undefined : NOT_YET(NOTES31));
  const acc = attempt(() => fs.readFileSync(path.join(SKILL, 'tests', 'live', 'BS-DOC-MAP-ACCEPTANCE.md'), 'utf8'));
  check('tests/live/BS-DOC-MAP-ACCEPTANCE.md exists, names no personal path (plan P3), uses only the two $env:USERPROFILE skill directories for user paths and names the live helper', typeof acc === 'string' && accProblems(acc).length === 0, typeof acc === 'string' ? accProblems(acc) : NOT_YET('tests/live/BS-DOC-MAP-ACCEPTANCE.md', acc.threw));
}

// ============================================================ E. everything else is unchanged ====
const SK_NOW = attempt(() => enumerate(SKILL, { skipTests: true }));
{
  const now = failedAttempt(SK_NOW) ? null : SK_NOW;
  const amendedHere = new Set(AMEND_SKILL);
  const groupOf = (rel) => {
    if (rel.startsWith('assets/agents/') || rel.startsWith('assets/wrappers/')) return 'canonical agents and wrappers (assets/agents, assets/wrappers)';
    if (rel.startsWith('assets/templates/')) return 'canonical templates (assets/templates)';
    if (rel.startsWith('assets/')) return 'canonical tools (assets/tools)';
    if (rel.startsWith('scripts/')) return 'scripts (including check-agent-baselines.mjs and the validator)';
    if (rel.startsWith('install/')) return 'installer and release builder (install/)';
    if (rel.startsWith('data/')) return 'data (security baselines, runtime units, v2.0.0 copies)';
    if (rel.startsWith('evals/')) return 'evals (evals.json stays untouched: the G16 rejection holds)';
    if (/^RELEASE-NOTES-.*\.md$/.test(rel)) return 'historical release notes';
    if (rel.startsWith('references/')) return 'unamended references';
    return 'other project-setup files';
  };
  const buckets = new Map();
  for (const rel of Object.keys(BASE_FILES)) if (!amendedHere.has(rel)) { const g = groupOf(rel); (buckets.get(g) ?? buckets.set(g, []).get(g)).push(rel); }
  for (const [g, rels] of [...buckets].sort()) {
    const bad = now === null ? null : rels.filter((r) => !now.has(r) || now.get(r) !== BASE_FILES[r]);
    check(`unchanged (${g}): ${rels.length} file(s) are the pinned baseline bytes`, bad !== null && bad.length === 0, bad === null ? SK_NOW : bad);
  }
  const dd = now === null ? null : diffMaps(now, BASE_MAP);
  const extra = dd === null ? null : dd.extra.filter((r) => r !== NOTES31);
  const missing = dd === null ? null : dd.missing;
  check(`the project-setup file set (without tests/) is the baseline set plus exactly ${NOTES31}`, dd !== null && extra.length === 0 && missing.length === 0 && now.has(NOTES31), dd === null ? SK_NOW : { extra, missing, hasNotes: now.has(NOTES31) });
  check('control: a stray extra file next to the exact notes path would be reported (only the exact path is excluded)', (() => { const g = new Map(BASE_MAP); g.set(NOTES31, 'x'); g.set('RELEASE-NOTES-3.1.1.md', 'y'); const d = diffMaps(g, BASE_MAP); return d.extra.filter((r) => r !== NOTES31).length === 1; })());
  check('no version.json stamp exists (project-setup uses VERSION)', !fs.existsSync(path.join(SKILL, 'version.json')) && !fs.existsSync(path.join(SKILL, 'install', 'version.json')));
}

// The test tree: the baseline set plus exactly the six new files; every unedited file at its pin; the four edited files keep their identities.
{
  const t = attempt(() => enumerate(path.join(SKILL, 'tests')));
  const now = failedAttempt(t) ? null : t;
  const want = new Set([...Object.keys(BASE_TESTS).map((r) => r.replace(/^tests\//, '')), ...NEW_TESTS.map((r) => r.replace(/^tests\//, ''))]);
  const extra = now === null ? null : [...now.keys()].filter((k) => !want.has(k)).sort();
  const missing = now === null ? null : [...want].filter((k) => !now.has(k)).sort();
  check('the tests/ file set is the baseline set plus exactly the six new files of plan section 6', now !== null && extra.length === 0 && missing.length === 0, now === null ? t : { extra, missing });
  const edited = new Set(EDITED_TESTS.map((r) => r.replace(/^tests\//, '')));
  const runners = new Set(['run-tests.mjs', 'accept-rc1.mjs']);
  const pinned = Object.entries(BASE_TESTS).map(([r, h]) => [r.replace(/^tests\//, ''), h]).filter(([r]) => !edited.has(r));
  const badAll = now === null ? null : pinned.filter(([r, h]) => !runners.has(r) && now.get(r) !== h).map(([r]) => r);
  check(`every unedited historical test, fixture and helper is the pinned baseline (${pinned.length - 2} files; C8, C9, C10, C12, C13, C14, C15 and C16 stay unmodified)`, badAll !== null && badAll.length === 0, badAll === null ? t : badAll);
  const badRun = now === null ? null : [...runners].filter((r) => now.get(r) !== BASE_TESTS[`tests/${r}`]);
  check('the runners tests/run-tests.mjs and tests/accept-rc1.mjs are the pinned baseline (the new specs are not registered anywhere)', badRun !== null && badRun.length === 0, badRun === null ? t : badRun);
  const rd = (rel) => { const s = attempt(() => fs.readFileSync(path.join(SKILL, ...rel.split('/')), 'utf8')); return typeof s === 'string' ? s : null; };
  for (const rel of EDITED_TESTS.filter((r) => HEX_TOKENS[r].length > 0)) {
    const src = rd(rel);
    const tokens = src === null ? null : new Set(src.match(/(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])/g) ?? []);
    const lost = tokens === null ? null : HEX_TOKENS[rel].filter((x) => !tokens.has(x));
    check(`${rel}: every baseline 64-hex identity it pinned is still there (${HEX_TOKENS[rel].length}): no historical digest was repinned or dropped`, lost !== null && lost.length === 0, lost === null ? 'unreadable' : lost.map((x) => `${x.slice(0, 12)}...`));
  }
  const c11b = rd('tests/c11b.test.mjs');
  const rc3 = c11b === null ? null : Object.fromEntries([...c11b.matchAll(/^const (RC3_[A-Z_0-9]+_LINES) = \[\n([\s\S]*?)\n\];\n/gm)].map((m) => [m[1], sha(m[0])]));
  check('tests/c11b.test.mjs keeps every RC3_*_LINES array byte-identical (same names, same slices)', rc3 !== null && JSON.stringify(Object.entries(rc3).sort()) === JSON.stringify(Object.entries(RC3_PINS).sort()), rc3 === null ? 'unreadable' : { got: Object.keys(rc3), want: Object.keys(RC3_PINS) });
  const am18 = rd('tests/helpers/c18-amendments.mjs');
  const s0 = am18 === null ? -1 : am18.indexOf('const T = (lines)'); const s1 = am18 === null ? -1 : am18.indexOf('export const AMENDED_FILES18'); const s1e = s1 < 0 ? -1 : am18.indexOf('\n', s1) + 1;
  check('tests/helpers/c18-amendments.mjs keeps the AM18 literals and AMENDED_FILES18 byte-identical (one slice digest)', s0 >= 0 && s1 > s0 && sha(am18.slice(s0, s1e)) === AM18_SLICE_SHA, s0 < 0 ? 'markers not found' : sha(am18.slice(s0, s1e)));
  check('tests/helpers/c18-amendments.mjs composes the 3.1 reversal: it imports the 3.1 helper and keeps FINAL_VERSION18 at 3.0.0', am18 !== null && /from '\.\/v31-amendments\.mjs'/.test(am18) && /export const FINAL_VERSION18 = '3\.0\.0';/.test(am18), am18 === null ? 'unreadable' : NOT_YET('the 3.1 composition in c18-amendments.mjs'));
  const imp = (src, name, from) => src !== null && new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from '${from.replace(/[./]/g, '\\$&')}'`).test(src);
  const c17 = rd('tests/c17.test.mjs');
  const c18 = rd('tests/c18.test.mjs');
  check('tests/c11b.test.mjs asserts the installed version with CURRENT_VERSION31 (imported from the 3.1 helper) and no longer with FINAL_VERSION18', imp(c11b, 'CURRENT_VERSION31', './helpers/v31-amendments.mjs') && /meta\.version === CURRENT_VERSION31/.test(c11b) && !/meta\.version === FINAL_VERSION18/.test(c11b), c11b === null ? 'unreadable' : NOT_YET('the c11b installed-version expectation'));
  check('tests/c17.test.mjs uses CURRENT_VERSION31 in specOf and in the manifest-version assertion, and keeps the historical views through readRc4', imp(c17, 'CURRENT_VERSION31', './helpers/v31-amendments.mjs') && /version: CURRENT_VERSION31, kinds: KINDS/.test(c17) && /m\.skillVersion === CURRENT_VERSION31/.test(c17) && !/version: FINAL_VERSION18, kinds/.test(c17) && !/m\.skillVersion === FINAL_VERSION18/.test(c17) && imp(c17, 'readRc4', './helpers/c18-amendments.mjs'), c17 === null ? 'unreadable' : NOT_YET('the c17 specOf and manifest-version expectations'));
  check('tests/c11b.test.mjs keeps its historical readRc4 and toRc4Tree imports from the C18 helper', imp(c11b, 'readRc4', './helpers/c18-amendments.mjs') && imp(c11b, 'toRc4Tree', './helpers/c18-amendments.mjs'), c11b === null ? 'unreadable' : undefined);
  check('tests/c18.test.mjs keeps the rc.4 identities (69 files, the tree hash and the notes digest), the historical 3.0.0 expectation and excludes only the exact 3.1 notes path', c18 !== null && /const RC4_TREE_FILES = 69;/.test(c18) && c18.includes(NOTES31) && /3\.0\.0/.test(c18),c18 === null ? 'unreadable' : NOT_YET('the c18 exclusion of the exact 3.1 notes path'));
}

// ================================================================== F. install and release build ====
const isoEnv = (tmp) => {
  const home = path.join(tmp, 'home'); fs.mkdirSync(home, { recursive: true });
  const hooks = path.join(tmp, 'hooks-empty'); fs.mkdirSync(hooks, { recursive: true });
  const gitconfig = path.join(tmp, 'gitconfig');
  fs.writeFileSync(gitconfig, `[user]\n\tname = Fixture\n\temail = fixture@example.invalid\n[core]\n\tautocrlf = false\n\thooksPath = ${hooks.replace(/\\/g, '/')}\n[commit]\n\tgpgsign = false\n[tag]\n\tgpgsign = false\n`);
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^GIT_/i.test(k) && typeof v === 'string') env[k] = v;
  Object.assign(env, { HOME: home, USERPROFILE: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: gitconfig, GIT_TERMINAL_PROMPT: '0' });
  return { env, home };
};
const runIn = (env, cmd, args, cwd) => spawnSync(cmd, args, { cwd, env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 180000, maxBuffer: 1 << 26 });
const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
{
  const tmp = scratchDir('install');
  const { env, home } = isoEnv(tmp);
  const inst = path.join(SKILL, 'install', 'install.mjs');
  const cd = path.join(tmp, 'claude-skills'); const xd = path.join(tmp, 'codex-skills');
  const r = attempt(() => runIn(env, process.execPath, [inst, '--targets', 'claude,codex', '--claude-dir', cd, '--codex-dir', xd], tmp));
  const out = failedAttempt(r) ? null : json(r.stdout);
  check('isolated install into both destinations exits 0 and reports 3.1.0 for the source and for each target', out !== null && r.status === 0 && out.ok === true && out.sourceVersion === '3.1.0' && Array.isArray(out.results) && out.results.length === 2 && out.results.every((x) => x.action === 'install' && x.to === '3.1.0'), failedAttempt(r) ? r : { status: r.status, out: String(r.stdout).slice(0, 300), err: String(r.stderr).slice(0, 200) });
  const v = attempt(() => runIn(env, process.execPath, [inst, 'verify', '--targets', 'claude,codex', '--claude-dir', cd, '--codex-dir', xd], tmp));
  const vo = failedAttempt(v) ? null : json(v.stdout);
  check('verify reports both installed copies current at 3.1.0 and matching this source', vo !== null && v.status === 0 && vo.ok === true && vo.sourceVersion === '3.1.0' && vo.report.length === 2 && vo.report.every((x) => x.installed === true && x.state === 'current' && x.version === '3.1.0' && x.matchesThisSource === true), failedAttempt(v) ? v : { status: v.status, out: String(v.stdout).slice(0, 300) });
  for (const [name, dir] of [['claude', cd], ['codex', xd]]) {
    const p = path.join(dir, 'project-setup');
    const got = attempt(() => fs.readdirSync(p).sort());
    check(`${name} destination: the installed payload is exactly the existing set (SKILL.md, VERSION, CHANGELOG.md, assets, data, references, scripts and the install record), with no tests, README or notes`, !failedAttempt(got) && JSON.stringify(got) === JSON.stringify(['.installed.json', 'CHANGELOG.md', 'SKILL.md', 'VERSION', 'assets', 'data', 'references', 'scripts']), got);
    const same = attempt(() => ['SKILL.md', 'VERSION', 'CHANGELOG.md', 'references/docs-generation.md', 'references/modes.md', 'references/report.md', 'references/state-and-apply.md'].filter((rel) => !fs.readFileSync(path.join(p, ...rel.split('/'))).equals(fs.readFileSync(path.join(SKILL, ...rel.split('/'))))));
    const installedVersion = attempt(() => fs.readFileSync(path.join(p, 'VERSION'), 'utf8'));
    check(`${name} destination: the installed VERSION is "3.1.0" plus LF and the amended SKILL.md, CHANGELOG.md and references are the actual 3.1 bytes`, !failedAttempt(same) && same.length === 0 && installedVersion === '3.1.0\n', { differing: same, installedVersion });
    const meta = attempt(() => JSON.parse(fs.readFileSync(path.join(p, '.installed.json'), 'utf8')));
    check(`${name} destination: the install record names project-setup 3.1.0`, !failedAttempt(meta) && meta.name === 'project-setup' && meta.version === '3.1.0', meta);
  }
  check('the isolated install wrote nothing to the redirected user home', attempt(() => fs.readdirSync(home).length) === 0);
}
function zipEntries(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('no end-of-central-directory record');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('bad central directory entry');
    const method = buf.readUInt16LE(off + 10); const csize = buf.readUInt32LE(off + 20); const nlen = buf.readUInt16LE(off + 28); const xlen = buf.readUInt16LE(off + 30); const clen = buf.readUInt16LE(off + 32); const lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nlen);
    const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const data = buf.subarray(start, start + csize);
    out.set(name, method === 0 ? Buffer.from(data) : method === 8 ? zlib.inflateRawSync(data) : null);
    off += 46 + nlen + xlen + clen;
  }
  return out;
}
{
  const tmp = scratchDir('release');
  const { env } = isoEnv(tmp);
  const run = (cmd, args, cwd) => runIn(env, cmd, args, cwd);
  const must = (r, what) => { if (r.status !== 0) throw new Error(`${what}: exit ${r.status}`); return r; };
  const rb = attempt(() => {
    const repo = path.join(tmp, 'repo'); fs.mkdirSync(repo);
    must(run('git', ['init', '-q'], repo), 'git init');
    const dst = path.join(repo, 'project-setup');
    copyTree(SKILL, dst, { skipTests: true });
    must(run('git', ['add', '-A'], repo), 'git add');
    must(run('git', ['commit', '-q', '-m', 'release tree'], repo), 'git commit');
    must(run('git', ['tag', 'project-setup-v3.1.0'], repo), 'git tag');
    const out = path.join(tmp, 'out');
    const r = run(process.execPath, [path.join(dst, 'install', 'release.mjs'), '--tag', 'project-setup-v3.1.0', '--out', out], tmp);
    const zipPath = path.join(out, 'project-setup-3.1.0.zip');
    const pub = path.join(out, 'RELEASE-NOTES.md');
    const tagged = run('git', ['show', `project-setup-v3.1.0:project-setup/${NOTES31}`], repo);
    return { status: r.status, stdout: r.stdout, stderr: r.stderr, zip: fs.existsSync(zipPath) ? fs.readFileSync(zipPath) : null, listing: fs.existsSync(out) ? fs.readdirSync(out).sort() : [], published: fs.existsSync(pub) ? fs.readFileSync(pub, 'utf8') : '', tagged: tagged.status === 0 ? tagged.stdout : null };
  });
  const okRun = !failedAttempt(rb);
  check('the builder, run on the real 3.1.0 tree in a synthetic repository, exits 0 with no stderr and prints "RELEASE  OK  3.1.0" and the tag', okRun && rb.status === 0 && rb.stderr === '' && rb.stdout.startsWith('RELEASE  OK  3.1.0\nTAG  project-setup-v3.1.0\n'), okRun ? { status: rb.status, out: rb.stdout.slice(0, 200), err: rb.stderr.slice(0, 200) } : rb);
  check('the output holds exactly project-setup-3.1.0.zip and RELEASE-NOTES.md', okRun && JSON.stringify(rb.listing) === JSON.stringify(['RELEASE-NOTES.md', 'project-setup-3.1.0.zip']), okRun ? rb.listing : rb);
  const notesNow = attempt(() => fs.readFileSync(path.join(SKILL, NOTES31), 'utf8'));
  check('the publication notes are the identity header followed by the unchanged tagged 3.1.0 notes, which are the actual notes file', okRun && rb.published.startsWith('# project-setup 3.1.0 publication notes\n') && typeof rb.tagged === 'string' && rb.published.endsWith(rb.tagged) && rb.tagged === notesNow, okRun ? rb.published.slice(0, 120) : rb);
  const z = okRun && Buffer.isBuffer(rb.zip) ? attempt(() => zipEntries(rb.zip)) : null;
  const fileNames = z === null || failedAttempt(z) ? null : [...z.keys()].filter((n) => !n.endsWith('/')).sort();
  const wantNames = [...enumerate(SKILL, { skipTests: true }).keys()].map((r) => `project-setup/${r}`).sort();
  check('the archive holds exactly the actual project-setup payload (every non-test file, the 3.1.0 notes included, nothing else)', fileNames !== null && JSON.stringify(fileNames) === JSON.stringify(wantNames), fileNames === null ? (z === null ? NOT_YET('a built archive') : z) : { extra: fileNames.filter((n) => !wantNames.includes(n)), missing: wantNames.filter((n) => !fileNames.includes(n)) });
  const bytesIn = (name) => (z !== null && !failedAttempt(z) && z.has(name) ? z.get(name) : null);
  const same = ['SKILL.md', 'VERSION', 'CHANGELOG.md', 'references/docs-generation.md', 'references/modes.md', 'references/report.md', NOTES31].filter((rel) => { const b = bytesIn(`project-setup/${rel}`); return b === null || !b.equals(fs.readFileSync(path.join(SKILL, ...rel.split('/')))); });
  check('the archived amended files and the notes are the actual 3.1.0 bytes, and the archived VERSION is "3.1.0" plus LF', fileNames !== null && same.length === 0 && bytesIn('project-setup/VERSION') !== null && bytesIn('project-setup/VERSION').toString('utf8') === '3.1.0\n', fileNames === null ? NOT_YET('a built archive') : same);
}

// ------------------------------------------------------------------------------------------------------------------------- report ----
try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* the scratch directory is under the OS temp directory */ }
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
  if (!r.ok && r.detail !== undefined) console.log(`        - ${(typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail)).slice(0, 600)}`);
}
console.log(`${results.length - failed} PASS / ${failed} FAIL / 0 SKIP`);
process.exitCode = failed === 0 ? 0 : 1;
