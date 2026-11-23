#!/usr/bin/env node
// project-setup 3.2.0 release gate. Standalone: `node tests/release-3.2.0.test.mjs` prints PASS and FAIL lines, a totals line "N PASS / N FAIL / N SKIP", and exits 0 only when
// every assertion passes. Not registered in tests/run-tests.mjs or tests/accept-rc1.mjs (both stay byte-pinned), like tests/release-3.1.test.mjs.
// Plan: docs/plans/2026-11-22-project-setup-v3.2.0-plan.md, section 4.5 (sections A to G below), 5.2 (mutation controls) and the acceptance criteria named on each check.
// Written by the tests lane BEFORE the implementation (plan 4.7 step 1). Every pin that needs final bytes is a stub marked PIN_PENDING: a check that needs one prints a FAIL line
// naming it and never passes silently. The second tests-lane session (4.7 step 3) replaces exactly the stubs in the "independent pins" block and nothing else.
//
// What it proves, and only this:
//  A. The amendment layer (tests/helpers/v320-amendments.mjs and tests/fixtures/v320-prechange.json) is well formed, and the actual bytes of every amended file are the independently
//     pinned 3.1.0 bytes plus exactly the recorded amendments (insertions, and the closed list of replacements, each identity pinned HERE), and the pinned 3.2.0 bytes. The gate
//     engine below is THIS FILE's own: it never asks the helper to decide pass or fail, every identity is pinned here (not read from the helper or the fixture), and the helper
//     and the fixture are compared against these pins, never the reverse.
//  B. The gate and the view are proven by mutation controls on synthetic data, each checked for the intended failure kind (plan 5.2 items 1, 2, 11), without any pin.
//  C. Actual obligations: every 3.1.0 normative line survives (D-4 scope), the root TODO holds exactly its six records, the reviewer and template insertions stand once at their
//     anchors, the shipped policy data is strengthening only (AC-A4-2).
//  D. VERSION, headings and the current public claims say 3.2.0, historical claims stay, and RELEASE-NOTES-3.2.0.md keeps its contract.
//  E. Every other file equals its pinned 3.1.0 bytes and the project-setup file set is the 3.1.0 set plus exactly the eight new files (historical tests and both runners included).
//  F. An isolated install into both targets reports 3.2.0 and adds and removes nothing; the builder builds the zip from a synthetic tagged repository, notes inside the zip only.
//  G. The view identity: buildView (tracked files) then to310Repo gives exactly the pinned 3.1.0 tree, and the unedited release-3.1 and c18 gates pass inside it.
// What it does not prove: agent behaviour, host behaviour (plan section 8), or the duration of the strict gate. Lint: there is none for project-setup (root .prettierignore), so
// no lint result is claimed.
//
// Environment: V320_SCRATCH (a directory outside the OS temp directory, for example D:/ps-live/v320) is where scratch is created; unset means the OS temp directory.
// V320_INCLUDE_UNTRACKED=1 makes section G build the view from tracked and untracked non-ignored files (before a commit exists; the orchestrator sets it, the runner has the same flag).
// Section G runs git with cwd at the repository root: a Git failure there (for example a checkout the user does not own) is a FAIL with its own label, never a skip (plan R2-4).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseBlocks } from '../scripts/blocks.mjs';
import { normalizedHash } from '../scripts/lib.mjs';
import { readSecurityPolicy } from '../assets/tools/security-policy.mjs';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(SKILL, '..');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const absOf = (rel) => (rel.startsWith('@root/') ? path.join(REPO, ...rel.slice(6).split('/')) : path.join(SKILL, ...rel.split('/')));

// ------------------------------------------------------------------------------------------------------------- independent pins ----
// Session 2 (plan 4.7 step 3) generated every table below from the git blobs of the base commit and of the reviewed 3.2.0 files with a scratch script outside the repository;
// nothing here is ever read from the helper or the fixture. A table that is the string PIN_PENDING makes the checks that need it FAIL with that label.
const PENDING = 'PIN_PENDING';
const BASE_COMMIT = 'd0cd48e40f8fea897a27b28d7c679e55f0203237';
// { "<key>": "<sha256 of the 3.1.0 bytes>" } for EVERY file under project-setup/ (tests included, keys relative to it) and the three "@root/..." files
const BASE_FILES = Object.freeze({
  "@root/.ai/context/project-tree.md": '49487d54341d81a6ccc67752ece9139621836c353f7ace74437f1b9007129f26',
  "@root/README.md": '69b4c489c6d851851afee71e77198cbe621eee6abc37d4df2ee0bcb76eb2835b',
  "@root/TODO.md": '3ef06eba9a96d9d7c79f631f69b37e4e56032d4df4b96a2f0af0663f0f8fecc5',
  "CHANGELOG.md": 'a5150ae5ef08aea14be765fc3a0be3fb3f627d1bac9b4ce7106bb8b06d6412ef',
  "README.md": '49890168844cffba3378b27c3b31aa1fafeec48dcf5b66c91e2919452749752c',
  "RELEASE-NOTES-2.0.0.md": '27711d116ec2ee4ba012b9cdaec198703e154055341cba793472d2ee79886eba',
  "RELEASE-NOTES-3.0.0-rc.1.md": '5649a736b4b5992d77672bb0f80dcfbf54256b7ef08a01b608204c968395ee64',
  "RELEASE-NOTES-3.0.0-rc.2.md": '4cbf9b9c2573f149e20234985ac7c1867fd256b56e551af8b970ea81d6b89cb4',
  "RELEASE-NOTES-3.0.0-rc.3.md": '68b1921f91d7c821989d810e689894ec0cfaabe494fb61486fe8e2c56ad42fd4',
  "RELEASE-NOTES-3.0.0-rc.4.md": '5340acd88c392c5fcc2be5d2c908639e6c10d55247d60d678c39e38d76dc55b2',
  "RELEASE-NOTES-3.0.0.md": 'fc48e03b7dcd671dffb75c6d108ee53831b00096c25d021333f88e448c24ff28',
  "RELEASE-NOTES-3.1.0.md": '0303b81bf10276ab4b1e4f9f7b6e4b80502c08b49b9bfcdebe36936075a5ce17',
  "SKILL.md": 'de85403e048c67bb5e0d77688c768f50e32afa3dbdaf869c73f61ddde0787ca3',
  "VERSION": 'b2f44d3b6e29f8b1b73ea4735f006affc4d198e1fd9c7d50e736159b1ef636c6',
  "assets/agents/docs-sync.md": '605398911043231f4ec53358986988ccbe8d5648beb0e918ee955d8104fff814',
  "assets/agents/reviewer.md": '696f86bc03f8506075e868465a2b34d76b6384a2809ed1e4ea949cc50f6a305c',
  "assets/templates/AGENTS.md": '616a26a54d2e8f77b0d4df3e78055ca41f6e7638654ad70a0f4d28a0e4eb5a0e',
  "assets/templates/CLAUDE.md": '5bb1d5ed697e921dcc839d031e082f884ca9a97a1eafd8d4a003d2ddb1cbaa47',
  "assets/templates/TODO.md": 'ebb2588b4c6e2254b1410b91212bf8db88fc315c402114be6e2954a7e0c9a84d',
  "assets/templates/adr.md": '45b92605a73d8fdda6d6009698b92f60c87fbba7e3f62f6ee3278cc6483e4ffd',
  "assets/templates/gitignore-block.txt": '34c13766d597a8fe6fee66709a24216d4e8cd7c364cae551fef458a8a10dc3b2',
  "assets/templates/nested-AGENTS.md": '11cd44a06e9e50023e8ddcb5e8d476e2338b206c2973e6d4ef6f53997b1ed370',
  "assets/templates/nested-CLAUDE.md": '336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49',
  "assets/tools/git-safe-core.mjs": 'd8e7e573b8dfb9edbee90023838547a2b0cae694cbcdc9e66b22a0b4659bcb7a',
  "assets/tools/git-safe.mjs": '995bafa72582acad616982549e4c0aa581831bc25b132f83a533f7bad91bb154',
  "assets/tools/guard-raw-git-core.mjs": 'cee120da3205767a4b2e17515948be55185d047175c8f5d91d38eeaa4d9210c9',
  "assets/tools/guard-raw-git.mjs": '7b6b8e7e5d11850656f8395563c0f6d0788a234fbc01b9642b30ae231862276e',
  "assets/tools/hooks-selftest.mjs": '175fa8611582fe0c8eafd8032c5dbb3c6e981e8cf9f710653c87529b58f6ba66',
  "assets/tools/review-diff.mjs": '745d55310baebb72c1683ff6022e1ed8517e370cd5c2ccbc0e5d8bbb4b8d7653',
  "assets/tools/security-policy.mjs": '2ded982e54580fc993add5b4003bc892dd08e230ea3c7d98892fccdb6fc83dbb',
  "assets/wrappers/claude-docs-sync.md": '36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43',
  "assets/wrappers/claude-reviewer.md": '284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423',
  "assets/wrappers/codex-docs_sync.toml": '1e6eef9ae6d75c0fef3c79b9879a0d69c4ad88d774889b81d09558cd61af6287',
  "assets/wrappers/codex-reviewer.toml": 'fe21c05b09bcba96b631bb08e22e6be807cdc8e0c75a740acff1b70c683c695c',
  "data/runtime-units.json": 'a1867f13ce2760cb1a676a48cdaac5a9fe4a868220dbaf7f528b169b64678ef6',
  "data/secret-paths-v2.0.0.json": '38198a9d326843d69c52034158f7287f71e861fea06bc884ff49ad56a56fa8a6',
  "data/secret-paths.json": '37711ab7b8e1781ce533c705971f93351f1331a44b16e11e846080eb8fed1a79',
  "data/v2.0.0/assets/agents/docs-sync.md": '217562b10ee8d43f47d085307172921f8789b7e8373056f9475e9642bf448571',
  "data/v2.0.0/assets/agents/reviewer.md": '06dd68ac2019369f03e66fc3729a9522286487e643b319a1cd52695d2d35b12d',
  "data/v2.0.0/assets/wrappers/claude-docs-sync.md": '36226eb38aeba62fa4fbad6627e2e2843a7857f167eec00f09e9688f69d02a43',
  "data/v2.0.0/assets/wrappers/claude-reviewer.md": '284332b25720b824a6369f7f9fb3af04fa5f7399be407221c4e47c24652f0423',
  "data/v2.0.0/assets/wrappers/codex-docs_sync.toml": 'd860e92f20147e70ec61f7fbaaa79d18b385bd7bc8ac247f1f43d2d179f873f0',
  "data/v2.0.0/assets/wrappers/codex-reviewer.toml": '017b9c905f5cc033552ce981340ab04fd794bd8615f8745fe9c1f3048a52bddf',
  "evals/evals.json": 'bff1fb4c407b602c0adae3f6e6397f28c25573df8c81bafe8dab17f15db4ea55',
  "install/install.mjs": '9e22d4192aed1c504053e9c499bdaf98450a7bd0a80e44b0aeb4b11b19d5b947',
  "install/release.mjs": '59411fee9168dd936e3e049f5e6242c93cb89c5207a574df181c259f961ba941',
  "references/claude.md": 'e4ffc479e77ae295049e8de3a933611facf28162e28205179fa55a5dc74b5913',
  "references/codex.md": '93bf8405651bcdee3ed38638b13ac6a20550f06e72cf257bb1b002e7b3939e45',
  "references/docs-generation.md": '7cb8c9c599c3a80524e4565696069397e28ca688e1b134b2aa7047f938c882e7',
  "references/migration-v1.md": 'ddba0903b66989812113ccdd16357c7ac964cf282f94b03e9107112dbd7e4a68',
  "references/migration-v2.md": 'b4ea4fc870d4c3a9aeea70b817511c62bce6924c6c71f222c2eff094fc8e29b1',
  "references/modes.md": 'c8448d36495794bc684ee974e101788b4d0ba63371809116feed7ed7bd7d55c2',
  "references/report.md": '4abc898abfedf3e1f8942a2210cf0bb4c6d889beff007a4b7b62a789e6c0fa19',
  "references/security.md": '60bcb592aa29d67d52416f66ee159a944d445089a97a4d12d9f054424a537db8',
  "references/state-and-apply.md": '2c99f9ac0dd9e98656308dec605c8e330dd5e2029f4ce19c773c8ca101eaa3b1',
  "scripts/apply.mjs": '5f2ea3801be0ecae370a453e8a822c336e404c7622bac276a9a873d069da6874',
  "scripts/blocks.mjs": 'fcb6606fbfae71b69033bf09c09d608ac65333234c9ae14d212b112daec20753',
  "scripts/canary.mjs": '24d38a195496ffc802f5de3d2aa83b7139c6af0480d953eee2f9bf4cac83e8fe',
  "scripts/check-agent-baselines.mjs": '905c0254d37026eac46aa16976db7726b8abb08349352941f781ce232dae9be8',
  "scripts/classify-allows.mjs": '87f25ca2ecd8fc107e56f296de25b45739e86ecb017d4349e4cf54f795e4612e',
  "scripts/detect.mjs": '485bacd5200319f03b41006fae447718639a74edba4306da63a3e8a9ca4af982',
  "scripts/doctor.mjs": '7d9ee5f39931f13a35a5a9a9bb42e1af6977469485f7debb44a95acb6b8d8d06',
  "scripts/env-keys.mjs": '81329bc2b4a47a0c0c3570f8c6232c2de0554fff513a02fced6faaadfb10382b',
  "scripts/globs.mjs": '4eb71ed206deb641e9032d691e4f3b431e76548fd46ffd6275f6e339fcc59892',
  "scripts/lib.mjs": '7a3f8d32cd1af31f20ff67888cd483165e8dbdfb77a28eb50df21e30bb4cb8fd',
  "scripts/lock.mjs": 'fee94a6bac74fa2650cf62fbbfd7569dab5790c391c470c4ff55ffbea068714b',
  "scripts/merge-claude-settings.mjs": 'c56888d586c26f64a40afaef095a5df1a7d82551f65aabf3318d433f1709b7fe',
  "scripts/migrate-security-paths.mjs": '0da9855b6351392bb89b2fe5d749f351279139384a1e50ff9cf1e6c9890ea3c1',
  "scripts/ownership.mjs": 'dd936e399d465115acf58644024c0b7b179a95a88c0874fd7ed4b7528d13c864',
  "scripts/render-permissions.mjs": 'a5c8a88dbdacc743954ed825665e626fefbc2550a025fc8ffb0321bc7a7480ab',
  "scripts/schemas.mjs": '48e4cdedf5a44f097f88da54820e81e1e432fcb53a2db887f864588a01f0ae22',
  "scripts/secret-scan.mjs": '4a77e284014cf8b9d2e7c46b6cc0bde7c5c1c1e7b8f0825807563f2d740869e8',
  "scripts/toml.mjs": '86b1139dd3e98fd151999298ae7940d7c418d11859a6179e3459a03721728391',
  "scripts/validate.mjs": '5b4de7189fdfebed53efa14e2e86524462becdab62b800448a435f0807bc6070',
  "tests/REVIEW-live-rc9.md": '17aaf8cf08d43dbcd627cc8ded82b0b8f30bce4fadb7392749f6e4144a3dbe7c',
  "tests/REVIEW-rc1.md": 'a158925060bd341286132ff5dd911e5ab326f61752c0ca807b02b28b3074a328',
  "tests/REVIEW-rc10.md": 'da05f3c1975bdcf6d2837cdd7834a409157a6afa9d987192d03356ffa576c73d',
  "tests/REVIEW-rc2.md": '9957193c369c33caf18a8609dbc6d9e926e3a76f5d0a79d010456993e5781bfb',
  "tests/REVIEW-rc3.md": '26316dd46c5f8185c74d86bbe9d981a2c060e368728694685e0ddb613afcb3ad',
  "tests/accept-rc1.mjs": 'bb75d010152971f95dcdd5663794bc8d3ab0f8cacd99cc474636c6f0ce6155ea',
  "tests/bs-doc-map.test.mjs": '44c1ca1590d9ab873afbe9887ff89815e5083149a84d70c51bc447629695a45e',
  "tests/c1.test.mjs": '2baf3f8e2c675d3dd2327183b425e97ca21e34eb58606f1332ebf0ba707a0456',
  "tests/c10.test.mjs": '9baa081075a77144e5983407f7395663458ffcc41c0a75a096b83f069f87e253',
  "tests/c11a.test.mjs": 'd4a1e6e2a3fe1bb11296eeae786b7f2f01f6c2a450253749d6ed61d397a0d6c4',
  "tests/c11b.test.mjs": '072661acf3cba25e696c625e5da4cd3684ce0956beeb47102a2a6e0dbab1c8d8',
  "tests/c12.test.mjs": '1484f30bbeeb6bd4b173e56e75d2940d833b54ed582c2041fc374b9e422cc19f',
  "tests/c13.test.mjs": '9461136d582716e5b166b2e401e932b52d697aa7d794e8f1794fbd52ddb2fc5c',
  "tests/c14.test.mjs": 'afbd6b6d091014abe80b2b1f794c4bbcac957488356bbd063d813331eaa8d526',
  "tests/c15.test.mjs": '2b7103f6142b49d92cec69d0e23df389de33c30f3cb2b4b91069bd68483abffb',
  "tests/c16.test.mjs": '94976d7a98146935e64a43bb73dc23749e805d0fe610009fe6fb88d6273f43f8',
  "tests/c17.test.mjs": '5fd161cddb7956b464e1c8b747c452923ee2d463b7e360d8168cb3321a9bc4c6',
  "tests/c18.test.mjs": '3e1831b0f06c7d7a5a53312c3c9c354d7267154773c64e804d391e2cb99b26a9',
  "tests/c2.test.mjs": 'e02b19b3dd9803cf7f489e33628e33ca5230ed24b7678dc758d5c071ef2ae414',
  "tests/c3.test.mjs": '0b144d8670615f0bad233dc689c1a1af231c26c24f7a30539e8bb5cede5f2b00',
  "tests/c4.test.mjs": 'f4e54963c0fc15ea444d5316ae1d1e0bd7abedf3806b48318ba3ec3539c044c3',
  "tests/c5.test.mjs": '943119547b89b81ffb907f5998b44f1586fa23e9f371087a0dc419876caeac8c',
  "tests/c6.test.mjs": 'e48253e9b15b79c4270c2914e53bf6586059ef2214e580646a1e76a2914ca429',
  "tests/c7.test.mjs": 'd1570c774c1c6ae5153210a0b616271a33d877ac7195c0d310c4c34b7f1b9c7e',
  "tests/c8.test.mjs": 'bb8193f8dead4f0681453899c0e3c2cdf0cf9fede1112a044a588a400938638b',
  "tests/c9.test.mjs": '42958af4f2b56c66110051987e696925f4f43f01be71f63e10010860b33341ff',
  "tests/fixtures/agent-migration-cases.json": '33d35b81f3172228b1eaf6841af0a07ecb99eaa946ade134864bd9ae9d45ff95',
  "tests/fixtures/allow-cases.json": 'ed96a692e880344c305c54f092471c51f80d4cefe52c0a9858337fa8ec2f9900',
  "tests/fixtures/c13-rc1-agents.json": '8d39154626167e0e3b427e0688ab2e088052a42f8b2b074662eec84a609758e2',
  "tests/fixtures/c14-prechange.json": 'fc7e57ca8fb04b2f611057630ca9213798f49c18153ed13067b53a1711770175',
  "tests/fixtures/c15-prechange.json": '79e0c2ddb56dd45b314006a4aa6fb4db4bb817e0cb308194710ef11f755fe3ad',
  "tests/fixtures/c16-prechange.json": '7853616ebbf2483e098bfaba530f962bce42401740cca603f94a153346a3cbdf',
  "tests/fixtures/c17-prechange.json": 'bf3436d54b9c046edea5ee2b339d0a25412beaf6cdc10a4e4ffc00f84e1efa65',
  "tests/fixtures/c17-upgrade-baselines.json": '0f9532eefd2514291aad44dae0c2200added3348089922eec7f8ebdf7db8b1b9',
  "tests/fixtures/doctor-cases.json": '751a14a91a9c055df02563b152e472f2a5adc3348ba49eeec6f37b13bbfd40b2',
  "tests/fixtures/git-safe-cases.json": '9e1446c27a559c0f7ecfbe06fbf0edc161a36f2605460291fd3d5c5878b63284',
  "tests/fixtures/guard-raw-git-cases.json": '9417db42250fe5dc02304bf2538652f36debfcfed2834f35fc1dd451aa26d7be',
  "tests/fixtures/rc1-migrations.json": 'd644f080879ec5af43289cdec446b5edeb72c086be70a35c5cf231ecf86ec5d4',
  "tests/fixtures/review-diff-cases.json": '195f82a13a3fc91de399c9a3ea8add6f451dd3ed8b0708d95a6821e0f344bf15',
  "tests/fixtures/security-policy-corpus.json": '8bfab9ee8b242740ab553f8c0daed3ce128100109de5d22eb57f058990ced8e1',
  "tests/fixtures/toml-corpus.json": '2eb3f17d288f725a2ad18681a80b545ca23fd4b3efe2f5254b11d952222fae68',
  "tests/fixtures/v31-prechange.json": '381003db4452da1778a0f6c38c92295ef50f6a07fe33148bd8e5e9fa69cc81a4',
  "tests/helpers/c15-amendments.mjs": '724688e375a33a1d7236b95acba2196dbab5a1f2c0846de128f8c1d490a13725',
  "tests/helpers/c16-amendments.mjs": 'dfe6ae600532ceb8bf9539a242330bec8d1682019ad0a67576621e69a12f8a33',
  "tests/helpers/c17-amendments.mjs": 'a8f3682b4e7f5e373116c2f6b4201c3a3b8e750c26b7e9e2a3d7ac4d2251ed54',
  "tests/helpers/c18-amendments.mjs": 'bd02894b6e95cb9f028f47c45ab8b8f1a6fb547810e11a14749adeeb11c7cbf0',
  "tests/helpers/prose-check.mjs": '465531aaf0b733045a4af1b51fc91737d7e08465ad93bcfb8b3e09b76ed8d1b0',
  "tests/helpers/rc1-integration.mjs": '267ee65ae6aabd41363c3b9b42c971691ce21ab9cbef53fdd9daa10a741507bf',
  "tests/helpers/v2-baseline.mjs": '85548f284857bb66a83935703357540c776b4c126e4c1c9e65e91b21585b029f',
  "tests/helpers/v31-amendments.mjs": '350aa0f80f3a9dba6bbc8f7b9d2b36f57f117fa24ecbfc3cd83d69f7eb2bebfa',
  "tests/live/BS-DOC-MAP-ACCEPTANCE.md": 'c0d910f6fa59fc7b61e2a1d93c5d922d5fb817c746275d1cdd4c1c95605cf061',
  "tests/live/LIVE-ACCEPTANCE.md": '6ec4caa7a501e7baab887427f736e36a0e46de881376e546903890757baefa67',
  "tests/live/bs-doc-map.mjs": '25641120a49a0aafdbd849557c4677ff8fe6cac17d267480faa2f54b94ba3449',
  "tests/live/make-fixture.mjs": '0d947c469cbb6483f7e72e168334030677ddda7394fdf1b7c221c2cf70d3f2e5',
  "tests/rc1-cases.mjs": '3caaa3cd1a6c46c43bdc15874d8690be5c1e1849c18c0560902e5f32af660dad',
  "tests/release-3.1.test.mjs": 'd11f0cc31d53305437c38a39e3989e91c49174eadae45a59bb768dd0559b09b8',
  "tests/run-component-tests.mjs": '864b037dcb03eeecca4ef52bc1802a4c4e98ab0ac17a56013c2d7e72a17491df',
  "tests/run-tests.mjs": 'bea24641a28b5b69b52c82cf4679145fa8cb4cbb0a96e8423a13649ea8fe4a00',
});
// { "<key>": "<sha256 of the 3.2.0 bytes>" } for every amended skill, root and living-test file and for RELEASE-NOTES-3.2.0.md
const NOW_FILES = Object.freeze({
  "@root/.ai/context/project-tree.md": 'c72199796ff26393a258aa7824647856c8af2a02545fc6861e4bce8db4c09b50',
  "@root/README.md": 'eb969506dd9246adf202458eea3a8adaea5a2a85a3328edde89f05c8f6508a23',
  "@root/TODO.md": '9cf6bc7ddf4df7987d6670fec1d3d916506397b12e8272be723f974ab02a7819',
  "CHANGELOG.md": '4f0b4e2f8d83227b1604e0b3028a89e8c9abc325473c6ce12963b69d5580b8b7',
  "README.md": 'f5ebe51eb46016874eaa3e57066cc9550cc34ec20b354f3ae3b13d003cf0b503',
  "RELEASE-NOTES-3.2.0.md": '30362aee507a258a827d8d1ca06d503083206e316b515bebff8b25c640a42409',
  "SKILL.md": 'f1a74c034ddd4ec56651568a2726763cfc335e50fc8013acd52eeae1f4911483',
  "VERSION": '33bdaf9e2d6bcbde2e4e613e865e403f8fe21fc621078d34c30b0bdc7f68d903',
  "assets/agents/reviewer.md": 'a0a82fb1d05829950fd98a4ebcce78f47dc5a8fde7ba2e37d0caeb68ae18cb2f',
  "assets/templates/AGENTS.md": '846c8dd5696827a459fad998910dab6b8642cde323158df8afc3174130b3e8d4',
  "assets/templates/CLAUDE.md": '074aa5a71cabc04e43262821ee7f65f2db52d6e84ed7d2d790a0dd857b93b7ce',
  "data/secret-paths.json": '929e43a618fba062bc5950e5f91595fb197d4fcfc7e04ee02b6ce4dab80b3eca',
  "references/claude.md": 'c672238ddef7f6a3d1a0ccced592ef6537845036e39378fb9f68720c5ca616fc',
  "references/docs-generation.md": 'bb7f13b228455688ea26878e12355310a99a03fb567a701bbafcb1d7664080c8',
  "references/migration-v2.md": '84593fe6debca947ea5d59840a12c3b6a06fef4aeae009297c4b14d402ddd1e5',
  "references/modes.md": '1ba95e571566317ce20c7ad603768ce8857dd67b0339299ae417e468ac2a86be',
  "references/security.md": '975e7f542742018d275025f5053c83ba07a73a10f472f59888b8c1471cd990fc',
  "scripts/detect.mjs": 'd9c80c5b4af7bce55e48bdbb92e9dfc14db834860094807d73c2e0b9704ba193',
  "scripts/migrate-security-paths.mjs": 'd5766aea5ae2cc40b20a737b7129e8bdffe164a7f0bb53c37a0930e88c07edc8',
  "tests/bs-doc-map.test.mjs": 'dff21103c718b9a33bf322489ec053a6dee6bf0fc0c10c49148b6db82b128f29',
  "tests/live/BS-DOC-MAP-ACCEPTANCE.md": '0aa2b3e0eb661a67b31ae1e085345f0b736c4cf59ad87756e677150451d3f36e',
  "tests/live/bs-doc-map.mjs": 'd47be85e2f0b7e5186759f545208af5899c136be4e0d6219d3cf444bfa096615',
});
// { "<id>": { file, before, old, neu, after } }: file as is, the other four the sha256 of that string (the complete identity of every AM320 record)
const RECORD_PINS = Object.freeze({
  "SK320_1": Object.freeze({ file: "SKILL.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'fb4bce9b4602777adcc40f62fc0b2502e090c42ab7d3d374a7b3cedab910adc6', neu: '8d8f88f52d7fc79ec6f1866f132c98013d0d0bf2ac18a8f29bd2dcccbe7b2d89', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "SK320_3": Object.freeze({ file: "SKILL.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'c5c562c4f898ebd54fff85d0d476f5197e8871f86fcb615608738a5891bb39b6', after: 'ce66169aaa2352af5bb4867c4b6ad640dd6c2af28ccfd755ce189056cf155fe4' }),
  "SK320_2": Object.freeze({ file: "SKILL.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'f9daaa01f1c9c194e13d1b74f021000ab84853160a14107dd891ac5b1ebe9bac', after: '53cc92100f050a5daf57bb6b59658a376282527c2ebbabdab04154ef472d35e4' }),
  "VR320_1": Object.freeze({ file: "VERSION", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'b2f44d3b6e29f8b1b73ea4735f006affc4d198e1fd9c7d50e736159b1ef636c6', neu: '33bdaf9e2d6bcbde2e4e613e865e403f8fe21fc621078d34c30b0bdc7f68d903', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "RM320_1": Object.freeze({ file: "README.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'a1e3d40ce57a446a90ea3864ce570dfbc5525a47a3817e3b321930b72aedfaec', neu: 'dab895cd39efd4a37038ea50e3f40b0741044cb6c04f9dca2ef170be394478dc', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "RM320_2": Object.freeze({ file: "README.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '46e146428d195370a2e010a4d3e59142a5e59e8df93aea66770d2e13af4bd807', neu: 'e5290145a1e0375685b159b6bb908a4762a5ed975bd3fe68c3d9010deb1617be', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "RM320_3": Object.freeze({ file: "README.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '5c31789ad8bb2762421a01d834bf4ed954270d7729f4a04c2d53603bdc2faddd', after: '133b732e2fb1a93b20b75db2b5e25aea012076c14ba1269c8616b7a43cff9734' }),
  "RM320_4": Object.freeze({ file: "README.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e2a230f0dfa92b0424c06be46f706a33cf0295d2d4419fae076275dc6d8d4dfb', neu: '575e7aecdec37cbb433ea0c5d1e24b33afae895ea6dc84519ad2486f3d8ff17d', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "RM320_5": Object.freeze({ file: "README.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '1ffa2c61b45ff20056db8fd206574ba8fd1a92b30ae98c6480992c8c0399a57f', after: '4d33c55e34d5d8c8a1ca94378aa561994a76ee4d1c0c2a05c15ae8ac9c0576b5' }),
  "RM320_6": Object.freeze({ file: "README.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'a6af1f3a1fdbeda393251030f62ebd9297577eb43a694123590b76eb6e997bd2', neu: '471fde6bf8497c339a89705911c620166eb74670aa5412e4d0784e2cf9f44f92', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "RM320_7": Object.freeze({ file: "README.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '00c4fde4d5acc113bc110e66ae0e8146319e59dbe272fdd0326cb19482436b63', neu: 'bf702f400badb8b4473f5529d31b3df354deafed04d5c8efeca9ab86c253cd9d', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "RM320_8": Object.freeze({ file: "README.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '3ad75a5252654a03a9914f1ca7ea29d20c94f09b0288e7728ad01a64ae2e1dad', neu: 'cac625b4ce4f4607bd0f8ca2560f2c4aa2649a9e206fa582fe4d5c72dfcab4dd', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "CL320_1": Object.freeze({ file: "CHANGELOG.md", before: '2d68c5b88ac4872c603d66e65137074cfbf18827dfe756250942f8a213694071', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '2009e43abae86ca6ed9e117c20648c066d4a43404516c65d4f2d8673d1a66612', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "DG320_1": Object.freeze({ file: "references/docs-generation.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'c836544637a4f0c5719de60f0431818004c5647f0d74b2a9bc94100d48e736ec', after: 'b12205ec2d3396c24b51eb2519e2300b790ec136f0935f19d33308541b6c059a' }),
  "DG320_2": Object.freeze({ file: "references/docs-generation.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '599f15ed1fc6bcd1b41d95d9a22d0a75330d9d5ffab90eba5407da7f9da031f5', after: 'eb405dbcfa174cd5835aeeda581b90ef090034e8fa8eb362898c2d1409e86742' }),
  "DG320_5": Object.freeze({ file: "references/docs-generation.md", before: 'df1f06a23dfe0520799db1c36bccd7169b66c2777d3dcb909fbfb29902b08c0a', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'a60f92ca4612d98b476f4b37572c692b812a136759950d4d04767f786bd40364', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "DG320_3": Object.freeze({ file: "references/docs-generation.md", before: 'b83fc2dd65254a28958abbe459b23b1d9f9d411573d446a5f819ad1dbb903ddb', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '04837703dc6474b12475d7846e787e36a446a335a25439ac3de300a63fb08043', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "DG320_6": Object.freeze({ file: "references/docs-generation.md", before: 'f67072564ec92a0581ffaae5a452c6ae63b458effd00891a6aadf280d4351bb5', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '33b13a416edd6269767a13b9bb3602c0b0753b4eec1e6ed5b15d79a556ef3c5e', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "DG320_4": Object.freeze({ file: "references/docs-generation.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '02f62f3d835f63e003c40a78aeb2797859dfbc369a7b78cc63a2290538fddb28', after: 'e1c46321cf281cf21ec27172af81c85a17b7f2ced8364f5fd3c02a2a6eba6bc8' }),
  "DG320_7": Object.freeze({ file: "references/docs-generation.md", before: '47f18c5fe9c2e4977629e977eae042aa1a960aad0b7410f93c7c98354c56d1c2', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '433173f3536f09693b6cc2babfcef726e837de4a1a2511aaa021ac5bf81f017c', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "MD320_1": Object.freeze({ file: "references/modes.md", before: '9f232ab7cbda7562a3103ea0c888c4aa8f5195df96e3769f49fb0f87b96c0694', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'a4d6c65e12446ed06f9b6f42bca1bdacf3e3ae933dfbaa7339fdb4f2c4744004', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "MD320_3": Object.freeze({ file: "references/modes.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '01819ee8df725eafd88377199efd6e70d0a1863c23a9c8f3ad2bd939e95b47cf', after: 'b94e99014353589a54e54e860c89bf8d83ac2929fb943a82f7168df98fd548c3' }),
  "MD320_2": Object.freeze({ file: "references/modes.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '431b8d90c4e0b40ca4fdd53bc7ee54e3343234774d25f9ef95d3bec797f21cd7', after: 'ba71fc95f691ecab87eb52bd254259934d86c1b090f91a809e8eebeea14d347a' }),
  "MV320_1": Object.freeze({ file: "references/migration-v2.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'aae37f2fc88e369996cc78748ec4717214bb625251e8b08f3cbd74bca4485734', after: '1b8133501cd5fed0d493a53f2d30317014866accec623095c9ab951d678dbeb1' }),
  "MV320_2": Object.freeze({ file: "references/migration-v2.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '8726cca063c952f7c64c0a5e0213a10a5f5372de03cb6c4553c0f17eb727a3ff', after: 'cf956c7c7936f32af140cb61657c67e093ba38f11b7ab2da4f76b1af718ac50e' }),
  "SE320_1": Object.freeze({ file: "references/security.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '0b64be91f54a2d3ff60e968febb9f49324cac8844f943ad4758651d614d15c05', after: '4212154e8e39902aac9da65ab0063105e97662aca954caacc3e6b8a591d2c894' }),
  "CM320_1": Object.freeze({ file: "references/claude.md", before: '052df8bc55d769fcc0a16c5788eb089d56bf4c88ef1a8a31b2c1c6cecbc6d23a', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '0b7b716d6da334e63c84bbab65935cce56d2aa8ddd83d06c57859c38ac40b53a', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "RV320_1": Object.freeze({ file: "assets/agents/reviewer.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'dfd2320fc83f01db4dd3bdf72236a72cd2349f485dfc44cfba5bbc11303a9012', after: 'd5da5f9f7347a3918ca01d98d649e77b90eb098b69f09de344f9eb8ec26b8239' }),
  "RV320_2": Object.freeze({ file: "assets/agents/reviewer.md", before: '191be1b97a79354ca5d8f55d55208c821cb10e1df086e9285bc7135e9d82533e', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '425c2d1791a7a4eb52427aceabf6b402e45f1ea94950a3c14531ff14e4fc3f98', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "CT320_1": Object.freeze({ file: "assets/templates/CLAUDE.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '61b5fedcd8550fd29dfddb1461a2e0498820f611e5f643337b5fe59e576f44f1', after: '45b0d92d56a4396603299b5a94f280e3530ed9ea7e79fbc2565a4201edb160a2' }),
  "AT320_2": Object.freeze({ file: "assets/templates/AGENTS.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'b536507df21d44b6888c7970ec3b0e7d82e55609dd57b91d74d4837d9087cc59', after: '8d9dcc61a7dc8465ed628968fe54e50deeb1fe8202ab5c57fe5e75e92da35dd7' }),
  "AT320_1": Object.freeze({ file: "assets/templates/AGENTS.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '58d30bf40c38632cf33655fe600ef02a128631eaa08801fdaec3a1028e5e97d5', after: '8d9dcc61a7dc8465ed628968fe54e50deeb1fe8202ab5c57fe5e75e92da35dd7' }),
  "SP320_1": Object.freeze({ file: "data/secret-paths.json", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'eaf425f56da286af7cb2c081085faa108ffa7c68d0cde86d40e5b36e6b0cf0e4', after: '584576816c953d5a4ca3f236080238a7ff1334aa464838448e0827a13252c6a5' }),
  "DT320_1": Object.freeze({ file: "scripts/detect.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '37409e93f4091eb2d7f65d73ef27cc016272a1ed20bccde8ab8b7c640408adf8', after: '8975d14e9fcf9b15e53a1b200878a273d427ae5799f6b4620dff7db9fd9504a6' }),
  "DT320_2": Object.freeze({ file: "scripts/detect.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '50cfd99d591bed3fb9ca59746277b6bfb477fc68669f7fe2b2cbb23c7c653921', after: '9d7d9ac4e675f9e845108f6b58138fcb0420b5bc8fccb6be5b75842f50506e6b' }),
  "DT320_3": Object.freeze({ file: "scripts/detect.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '1a8870b6335534a2cb255b5d9bf928839bf1ce1002af7ba535db7dc5f148f16c', after: '9f517dc9d1962bdbe79d9d574b27fa77ed29420c6181ab46fab155766d725eaf' }),
  "DT320_4": Object.freeze({ file: "scripts/detect.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '1d14b754a9fb7a81016b63ffb8918d0c18e3aa33c3745ef6c9ff8a09cf3cfa71', after: 'adc606c1b30ce2f06ecf689bff5e33a2cfc217b8c6c457d7e8102fd4b3d549be' }),
  "MS320_1": Object.freeze({ file: "scripts/migrate-security-paths.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '72f8fb103b215a0bc95ee8ccc0f11f6fd0df4ee464f5cdd3db428e0b65361f33', after: 'f8759163103834a82b92514ab670c5217677822ad2b05d666a454329dbabfaca' }),
  "MS320_2": Object.freeze({ file: "scripts/migrate-security-paths.mjs", before: '17b935fab6e4bd55953f5be0c51c01f3fdf90591ebfc0a4f57f3b986cd629a65', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'a548d5bef81be7200c04350a94863bfc7b80c1195bde0790705146d61327615f', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "MS320_3": Object.freeze({ file: "scripts/migrate-security-paths.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '2b8d20b6f198d9b8a93168dd73251b160266a15e088b5eee5ec4be5b0cc80106', neu: 'da7c1a10bd35d394694d317f1d1c2cacafcb86290f7a56d4ad9d3788cde9aab6', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "MS320_4": Object.freeze({ file: "scripts/migrate-security-paths.mjs", before: '473c92a41126c75d186c9f64a60d9c9a5b4ada35c01463c2b828bb340271a36c', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '5ddd9bd735edb3bbe88379261cbc79268019589b633a0d79b773632f95357af1', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "MS320_5": Object.freeze({ file: "scripts/migrate-security-paths.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '4b9e2532e4018112132bf362355a57488411f16a9d1b584c2ffe049c32bbda44', after: 'bc7f8c8e5c032896ee6533b65785057a103361da40d3a30944443f354dccfff4' }),
  "BT320_3": Object.freeze({ file: "tests/bs-doc-map.test.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '5295f2465bf6834825e6839ab727f6bb1998861957d1486d891ee12a33bc81ab', after: 'f3d37bd6ba40d59fbf1b2fb727f9364e1542c818d9c6515b68f819ded429d92d' }),
  "BT320_4": Object.freeze({ file: "tests/bs-doc-map.test.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '2da5fec059ec402e2432bbb4a7b34fe28ecde40dfe09a8c6edc4f982cbd48405', neu: '48ee985565ee1e8680b3fe6512db67e2d626c8dd43dc6bf2473263fcf56830f0', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "BT320_5": Object.freeze({ file: "tests/bs-doc-map.test.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '570ac878a2a9ecf81337315decd59c7ad6399960d8e4200ee4cbbdd2e85c3b39', after: 'dbadd74e3c58aacb34fdb5da30987662ee4420b6539357f3451ead50d4d66a08' }),
  "BT320_2": Object.freeze({ file: "tests/bs-doc-map.test.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'fe8c6abe3f350d7828582036b731e5d1f7fe35fd72e02c8be612375bfec1caf8', neu: 'fba6988f2ef1cc32fa044c570f8cfd84fc96dd0238bd94380ce37abbf1acecac', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "BT320_6": Object.freeze({ file: "tests/bs-doc-map.test.mjs", before: '1ff028c26f4b3323c69624c67f941760bd8c36956ec00f24399e8dfdeb7c7012', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '9bfb010495a3aa4214f50d8fd356342625df559c3eca5422fed43589c7a1922a', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "BT320_7": Object.freeze({ file: "tests/bs-doc-map.test.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'de6d39c633460242980ae42f9863d6a2ab5e6d1973b2273fec88b88db602ccec', after: 'acc92ae0336f1e62667a51524efbafc5aa43cabe4191969da9b33579a4afa7ab' }),
  "BT320_1": Object.freeze({ file: "tests/bs-doc-map.test.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'fd2db3796bd2ee940d98ee67fc92c66e148f1036266d88e237a8d06ee0357276', neu: '066f39ca526018e4f9627ad56cbc644fca0dd4917a9cdd850982466af96b55b5', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "BT320_8": Object.freeze({ file: "tests/bs-doc-map.test.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '132f6111f3be99e894d58dbda57b6e07427e03217cbf6830de863691e5b415a4', neu: '118a89142aa91e7d14ae08dc3cc98cf8c27f4ae3a5517c01d50e4e24befebb9e', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "BT320_9": Object.freeze({ file: "tests/bs-doc-map.test.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'c8d6261225a25b91af34395041ff9c3da7dbd9556d9b95d961f9e8980e667bd7', neu: '412befce5b08d1946ea8ab194f2a41437d4cbb0f550a4a822aa281cdbfa7cb0c', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "BT320_10": Object.freeze({ file: "tests/bs-doc-map.test.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '5cb68b06ae8e46a84a007824ccd50501990f2e3bfd03aa081b3074861633efc0', neu: '28d312be122ac104301967d1f47adf65d3a3b13a4858723678a3a9925222c099', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "BT320_11": Object.freeze({ file: "tests/bs-doc-map.test.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'c872ce14ce5b8d4cc72b237334494b47ae225d3dbaf32f075e8256c944ea8990', neu: '199f760b529f7f2586d94fe9417b1b36f33706982804bbac1d9bcf7ad079ef28', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "BT320_12": Object.freeze({ file: "tests/bs-doc-map.test.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '51ad0122a55f02e78ace5ae16138aae5210af8cca3798de005f6b51ad8b3c324', neu: 'cce3af57f75e9a30c0d2ee5f256471019b9e841128d58cba2a6f8778be59ca8f', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "BT320_13": Object.freeze({ file: "tests/bs-doc-map.test.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '6a54e3ca9d9d894b7a9e89c8c6ac3439ab9431edcbf0c0afd0ba79eb899c6773', neu: '3973f435d7036168d2307916164b8d66c9421d4f97a9e59e3330971392b68f52', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "BT320_14": Object.freeze({ file: "tests/bs-doc-map.test.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'ca06ed9c013a8991519a0f6385811e580e2c53ebc7af2686df359a5faa8a9fe6', after: '37bbbdfb73eb8d5d8d268d5092859e6bb95f268add39ac0775c27df5e1e5392f' }),
  "LH320_1": Object.freeze({ file: "tests/live/bs-doc-map.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e723ae10622d42adadd67aba1fe721c4134066f478f0c7a2482b9a3d2ba7b2a9', neu: '156739c5cc07f280f5c43a12a8df48726479c8290663ebec2653decf3455855a', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "LH320_2": Object.freeze({ file: "tests/live/bs-doc-map.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'af42e56d8594e57ec6c38de9fae427c01b116b61a47169ffb7bd6b8aca52ecb8', neu: '6831faea49dd8c541c0d2d140f7dfb5494b63188d60c37d3a85e4a2aa875e6a8', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "LH320_3": Object.freeze({ file: "tests/live/bs-doc-map.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '5ccc1d3630abb33b50cf4efbe45c2a3c4bd843b8848dff6f9c806014dbd2096a', after: '3cbbd958521641132b708938fcf509348de494b5f4fc623e55dcff1f1a811dd1' }),
  "LH320_4": Object.freeze({ file: "tests/live/bs-doc-map.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'fbe20aa83bcafb4bf7b257f7dc327caa81e27d7ae6548ca7964569236a851a39', neu: '88b424c6ed599bde2455a6ee3215a3fe0bdde8e4d6b6809d79ee35d9c428452b', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "LH320_5": Object.freeze({ file: "tests/live/bs-doc-map.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'f5b40fe4f66029f9f965acc22cb61eadbf9474fc49e3518003ea0e8f2969b39a', neu: 'a718ae8e099dae68ca3bdc6b8183da044910e18c66c8fe4cdefe13f82a5caab7', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "LH320_6": Object.freeze({ file: "tests/live/bs-doc-map.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '85f8d8079192ab1f7122f5968c53213bda9efc48438374b233eae59899e7a27d', after: '5b00dd581cbfa8dc4c7bfa702c652a8c4da16040849947a2cd76bd7b7cc6ff84' }),
  "LH320_7": Object.freeze({ file: "tests/live/bs-doc-map.mjs", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '75533de25fe2f4c9e0e55b3db4a77d2d2b6767cb5ef82fad159e9ba941349bb5', neu: '644213930ce2548d6653bff28578f20620c49b8dc6b0a3920b1ac96180ab7e53', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "LH320_8": Object.freeze({ file: "tests/live/bs-doc-map.mjs", before: 'a2160fa622cfcd50d9061c8ca40acdbe86cb947fd23ee23754cd67868ca8919a', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '830245c463969a553d4456ab6cab0bcfb2b23ccf6094297ceaad6406512adfd9', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "AC320_1": Object.freeze({ file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '4da59232aafb838131d743611ccf3072fd80d98daaa710adcc65f829a452cde0', neu: '072a44d7eaa5718e5738125bfb9bdc9a2e1d5a8a964f28bde7d766257c7a56c6', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "AC320_2": Object.freeze({ file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md", before: '54e6e65a69a4dddc97d746c0a0016ee91aefcdd20efa7213195d902f23c59400', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '49db64e8a0c1de81111e97ed5aa7e352da58cb7778fdc2e70fa4f2fa00ffed67', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "AC320_3": Object.freeze({ file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'f777e466d17d5005338a861f9895f6ffd3d0af2389de8adbff30722a96f22a74', neu: 'ce6629c4f7850b58b2f3364666f1032d443432863ea923cba14fe1f6936bcfe1', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "AC320_4": Object.freeze({ file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'efd27d014029fc2d7abbedebedff167154f5ce7a56a74f68ad79b45c28f98db6', neu: '958d61cefeb14e6f19294b94edba176e87bef77cf50a02c3982c8d9f6382b4bb', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "AC320_5": Object.freeze({ file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md", before: 'd2dc7d135f2a4fd4543670dd7321e1da7fbc7bfc0af73d05f2089502b807ded0', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '15bae2e7988fe7d4c56e70c45b49afa3252036b150cd4819d0e34630b930737f', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "AC320_6": Object.freeze({ file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'a17a9f3d68f9aed1334308ee76c44f90e5cab88dc08f15921863a67bc4298fde', after: '9a34566e3072e7373662a84113b89cf97f4df9297d40b05b992098b6c5fb2460' }),
  "AC320_7": Object.freeze({ file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '764adb41387e81289921b55918bd2d08442e834d333f0508cf980ba2cce3991b', neu: '2c1b22c0b3ce5fa3f1877f459bbd99e3286532e0004f7e49cf99351a2cfba417', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "AC320_8": Object.freeze({ file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'c7ee9e800c05f47037cae3adb7b8af16326ab22a9dd88575b3e69817f890b5cf', after: '32a035864df2589643ea8482ef1ee3a36bb818deea8561080cacbbf3fc3a4f1a' }),
  "AC320_9": Object.freeze({ file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '2163fa78abba8757193eb59542ae50680fda7ddfe1742109eebfb1d413484928', after: 'b3a0a643025c068ef2b8a452203da2fa4c0e764290f42f974119ddb010dc4be4' }),
  "AC320_10": Object.freeze({ file: "tests/live/BS-DOC-MAP-ACCEPTANCE.md", before: '6d7f7fa625cb834bdecf4786acb7195c6a2ef6c8047ecf27643b29cda162f4c2', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'e08ca446980e878f108cbaecbf2c8b30e377281c74d19ac86b342a9330843473', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "RR320_1": Object.freeze({ file: "@root/README.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '8b7ba5a058fa3e65090902dbb85cc5f51e50813b8d636ece64afa9b8e2a91b35', neu: 'f1957a7e98248a20745839da2a1dda61956a64aa6696608104433dc4d032b41a', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "RR320_2": Object.freeze({ file: "@root/README.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '2893ded2c14f2271441611dd18661ba6ecf6ef6f6e8945ece1e2a441b589b742', neu: 'b01c82ba3d04a694fdb6052593eabb62a7c92d0bf7b56c4f8d8cdce580912de5', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "RR320_3": Object.freeze({ file: "@root/README.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '2a40292d24fe4d6692d0c0d524bf133eb65f67dd3bbe80d5e70fc5891f99a393', neu: '5a6d091af068d7cb24f78e4c1e45863d4fbd6d736750c121589f3d820621eba2', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "RR320_4": Object.freeze({ file: "@root/README.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '0de71fb317f6aaebd5466939aeadaad07634f8cabb3e714b9e6687e1468f7700', after: '9f852790eb0c41c02ddeaa6e95bf20196f027c1532bf1b0e7240e38eba01705d' }),
  "RR320_5": Object.freeze({ file: "@root/README.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'ff44490d8636237c3d5c868dad4743e62949374d62e59dc352d7c0b72876248d', neu: 'b5c1d189a07038c2208e5328f3a424ac668c7de0f957c08b96fa3eb1ae1a5fc9', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "TD320_1": Object.freeze({ file: "@root/TODO.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '199379df87fcc0cc8c5d16e74b3b108d881c26096b8237827c3ac37cac1acb01', after: '2b3fd599870c783d30afbbcfd576d42165a564a73802d69829272dddcbda1bb6' }),
  "TD320_2": Object.freeze({ file: "@root/TODO.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '286581d2851e4d40e117b4ac6cc4da347d7dd62b4c507642893152cf2dfa4543', neu: '88023647a08bcf1f5f3e40784f730d9ddd7deea48ebb1b4e5de03ce78c890a38', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "TD320_3": Object.freeze({ file: "@root/TODO.md", before: '5371edd213f832e5ca76dd7b2b0ded4a86dcad674dff95df4e50ef1174cfaa43', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '004afb93be9f6cd19633011e5777b124d852184935a2d3afd3dbce064e3964de', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "TD320_4": Object.freeze({ file: "@root/TODO.md", before: '5f49644097785bdc67a28a0a72495333d21592fac581b30e71f32093a0924d4e', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: 'a9029a5bb3173431b820c69b3c755f6a1313c7d865a8d0382b21e9214eb69503', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "TD320_5": Object.freeze({ file: "@root/TODO.md", before: '17b9f6b0bcad2704dcb96cbed84ce307cec0afd845eeda4bf9715e5750b7885c', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '6d1691da1aec578f668088773d057330f1eef5547f5346151e5d89d6652d9181', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "TD320_6": Object.freeze({ file: "@root/TODO.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '93533285f7d3ff821dbe46898a777e9afedd848613fd9cd77be8c88cb729c808', after: '56af209eaaf10f526808c10fa576f2e42a6c16090aa7e2738b2815a43c48827d' }),
  "PT320_1": Object.freeze({ file: "@root/.ai/context/project-tree.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'b67916526be4c6c09f7ce0d7b8e659fc2affa1e0c2b25eadff369aa7e7d73a45', neu: 'a556652714786d0d11fa39504483b75cbfe8e456c10f166d95c523bddf1083e1', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "PT320_2": Object.freeze({ file: "@root/.ai/context/project-tree.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: '6edda665e2a6fb3abc8bb4175ef7961d8624a3155973e22a0f0c860102dedeeb', neu: 'f6437b3f8744de41cac4c94e528b7732c9b044cdc0523be6ba6b7026b5219d21', after: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
  "PT320_3": Object.freeze({ file: "@root/.ai/context/project-tree.md", before: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', old: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', neu: '52b387454066d66d090e53e839c28da78d46b3ee00066e870fd441e13ffa2297', after: '953234bd99c0bcb17d137c0a2dbc8230edf3e10e58764bc641e729c60849f290' }),
});
// [ "<id>", ... ] the closed list of non-insertion records (SK320_1, VR320_1, the RM320_/RR320_/PT320_ version lines, TD320_2, AC320_1, C1, BT320_1, P01)
const REPLACEMENT_IDS = Object.freeze(['SK320_1', 'VR320_1', 'RM320_1', 'RM320_2', 'RM320_4', 'RM320_6', 'RM320_7', 'RM320_8', 'MS320_3', 'BT320_4', 'BT320_2', 'BT320_1', 'BT320_8', 'BT320_9', 'BT320_10', 'BT320_11', 'BT320_12', 'BT320_13', 'LH320_1', 'LH320_2', 'LH320_4', 'LH320_5', 'LH320_7', 'AC320_1', 'AC320_3', 'AC320_4', 'AC320_7', 'RR320_1', 'RR320_2', 'RR320_3', 'RR320_5', 'TD320_2', 'PT320_1', 'PT320_2']);
// { "<file>": [ "<16-hex sha256 prefix of the whitespace-squashed line>" ] } the 3.1.0 lines holding MUST, SHOULD or MAY in the normative files
const NORMATIVE_LINES = Object.freeze({
  "SKILL.md": Object.freeze(['4b9b1a59bd97a196', 'd4e39498669cbfd4', '52560c772e148372', '88aef36e923d28ad', '9f0809dd2f6e89e9', 'e22f124f807be954', '4073b99c6df374fb', 'd75185b7e7938521', 'feb0e901a8a89340', '7656df23af93553a', 'affe999c27ed2fb7']),
  "assets/agents/reviewer.md": Object.freeze(['596a9ca9d6f4c2f4', '961e3811760a3d1f', 'be63e6df6e616779', '526f703efabc1ae8', '198a11b3563823e0', '749589fcc77d530d', 'a370f67c293d5143', '343c4adb7d18db54', 'e8a0b8ab2a87c527', '93d361b0a37346d7', '57956be0a798d46a', 'e0d4e79e6bb66167', '88b453160dc8bd0f', 'a502f37907d1d5a0', 'b249dc2c15848fd2', 'd2545a2d75690a4e', 'df5df540cec303b4', 'de1abc89191605c7', 'f9d01fdbf4debc97', '9f7e310bcc98e005', '8c2ebf638bb57647', 'e80f8d3208a2f41c', 'ca114ec9e212105f', '01c98d13e6dd3e5a', '5345f02367dae647', '7930cd9baaa0b665', 'a8030712de53049c', 'd760bc1a98191785', '88aef36e923d28ad', '1348768a366d6fd1', '8e87d0122adcd818', '9f0809dd2f6e89e9', 'a12543cc006e83a1', 'e8962085da97b28e', 'd604e9818e4118a7', '54e67263451e6f38', '6a15aa2c1996946e', 'c415e5070ed628da']),
  "assets/templates/AGENTS.md": Object.freeze(['88aef36e923d28ad', 'd010d4059de44a35', 'a4fa6803bb386bce', 'd8efbc971038fa16', 'e96ee13b6d957dd7', 'e13619005c79aded', 'ee7e738ae207895a']),
  "assets/templates/CLAUDE.md": Object.freeze(['45bb182cf4e24f18', '706eb3bf1c7ab5be', '0f8151ffc77d31c3', '7eb82ba1345d6d21', '6610c9fd27ce3703', 'a555dd038e3b7d23', 'cac467d7512b6390', '4da2e3b41ce0e35c', '5bbb378444478c29']),
  "references/claude.md": Object.freeze(['a5a8a889caac77e1', 'e4970192cfd4fd18', 'bc5e8f55c72ed6b2', '912dd361e8bfc780', '9f49cb7a7841a354', 'bc7052175ca022c8', 'd9033339fdce253e']),
  "references/docs-generation.md": Object.freeze(['87d9f59704477d19', 'e82a9a49c6193433', '7dd9c98ba0a1f81a', 'b7b0ab9f9d784a22', 'dfc8e9f00496cef5', '4b12ed9521239464', '8d06980f82327e81', 'd7f248943853550a', '8c7f5b4fbd2023fb', 'c031e4f4ffcf8cbd', 'c7c7abc812ed369b', '1069f370bdcc876e', '8d1095a02925a89d', 'e7503969724cd0d1', '13e41efb16ba7d80', '05585067283df5e8', '2856e926258740ef', '70b58185401f1d38', '6fdc0a84cf94f817', 'a42d4033830601fa', '73c58ea81fba70d8', '1336bf95a9e4abce', '25b1c4d7d42592e5', '47ec1c7d9bc1de90', '5270367c92032516', 'f112ac7ad2c6293a', '27b1fc535d03b3e0', '5cac44b532b3deb1', 'a4e15377ac84a57d', '9cf46648f5c22f45', 'd6ac172fb87557e6', '44c7604c12a07e74', '06a47da9c72fe7b5', '7d6875fb9f8c4454', 'd4389b098c860f57', '3e32a50ef53983e4', '718109fb344ed262', '7cc5ff53925451aa', '9e273305a5eb0842', 'c05c8f1286d874fb', '788bc332855b31d1', '9e4dcc37e27b4948', '1881e34249131fd4', 'ea655e76c92b4a85', '5738b04dfa5ac3df', '7beb9ee702eb79c3', '38c204588a3fd16d', '49dfc49b773ccdcf', 'c0cd974c9cb9464d', '9975979d5100dc21', '5f543caeb7260370', '09886b8abb1614d2', '5de4a74b6a3e48d9', 'fff946122155c0b1', 'a851bd21cf988edb', '465e5e8209c28311', 'a6589ab046a38250', '65573f38d67f2449']),
  "references/migration-v2.md": Object.freeze(['8bb7506f01dbbb3e', '538e27ed53f614cf', '9975979d5100dc21', '5f543caeb7260370', '09886b8abb1614d2', '5de4a74b6a3e48d9', 'fff946122155c0b1', 'a851bd21cf988edb', '465e5e8209c28311', 'a6589ab046a38250', '65573f38d67f2449']),
  "references/modes.md": Object.freeze(['0cdb3f9446bed7d0', 'db73cf5c60d90f8f', '990962db45c0f792', 'ae66e73f74731d09', 'f6fe18db9c93e6a2', '54396dd4a1bdde08']),
  "references/security.md": Object.freeze(['88aef36e923d28ad', '4ffff33329fc4dbf', 'df8811726f1632e9', 'c0601ce60dfe41f3', 'd426b9ec612be885', '12f3ebd5b67c72a5', '7f2733683f88e3a5', '79d70b852449f386', '19a8d7cfc8470c4a', 'fc5bd6dad6fb06c3']),
});
// Pinned now (they need only 3.1.0 bytes that 3.2.0 does not touch):
const TODO_RESIDUAL_SHA = '92977bcb031f0c72d0b871bfcb93a708c4a803c1711de78e104033c7e7c82ee4'; // @root/TODO.md lines 25-32 of the 3.1.0 file, joined with LF plus one final LF (AC-C3-1)
const PRIOR_POLICY_SHA = '37711ab7b8e1781ce533c705971f93351f1331a44b16e11e846080eb8fed1a79'; // normalizedHash of the 3.1.0 data/secret-paths.json (plan A4, PRIOR_SHIPPED.sha256)
const SHA310 = { reviewer: '696f86bc03f8506075e868465a2b34d76b6384a2809ed1e4ea949cc50f6a305c', agents: '616a26a54d2e8f77b0d4df3e78055ca41f6e7638654ad70a0f4d28a0e4eb5a0e', claude: '5bb1d5ed697e921dcc839d031e082f884ca9a97a1eafd8d4a003d2ddb1cbaa47' }; // unchanged since 3.0.0 (tests/release-3.1.test.mjs:102-104)
// ----------------------------------------------------------------------------------------------------------------- end of pins ----

const AMEND_SKILL = ['SKILL.md', 'VERSION', 'README.md', 'CHANGELOG.md', 'references/docs-generation.md', 'references/modes.md', 'references/migration-v2.md', 'references/security.md', 'references/claude.md', 'assets/agents/reviewer.md', 'assets/templates/CLAUDE.md', 'assets/templates/AGENTS.md', 'data/secret-paths.json', 'scripts/detect.mjs', 'scripts/migrate-security-paths.mjs'];
const AMEND_LIVE = ['tests/bs-doc-map.test.mjs', 'tests/live/bs-doc-map.mjs', 'tests/live/BS-DOC-MAP-ACCEPTANCE.md'];
const AMEND_ROOT = ['@root/README.md', '@root/TODO.md', '@root/.ai/context/project-tree.md'];
const AMENDABLE = [...AMEND_SKILL, ...AMEND_LIVE, ...AMEND_ROOT];
const NOTES320 = 'RELEASE-NOTES-3.2.0.md';
const NEW_FILES = ['tests/helpers/v320-amendments.mjs', 'tests/fixtures/v320-prechange.json', 'tests/fixtures/v320-policy-3.1.0.json', 'tests/fixtures/v320-compat-expected.json', 'tests/release-3.2.0.test.mjs', 'tests/v320.test.mjs', 'tests/run-310-view.mjs', NOTES320];
const TODO_RECORDS = ['TD320_1', 'TD320_2', 'TD320_3', 'TD320_4', 'TD320_5', 'TD320_6']; // TD320_6 is the sixth record, added by the fix round of review 1 (the apply.mjs block-edit limitation, SR-01)
const TODO_EXCEPTIONS = ['TD320_2']; // the one non-insertion record of @root/TODO.md at stage 1 (plan 4.5 C); TD320_6 is an insertion, so the closed list of replacements does not grow
const INCLUDE = ['SKILL.md', 'VERSION', 'CHANGELOG.md', 'references', 'assets', 'data', 'scripts']; // install/install.mjs:29
const NORMATIVE_SCOPE = (rel) => rel === 'SKILL.md' || /^(?:references|assets\/agents|assets\/templates|data)\//.test(rel); // plan 4.5 C (D-4)

// ------------------------------------------------------------------------------------------------------------------------ harness ----
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: ok === true, detail }); };
const skip = (name, reason) => { results.push({ name, skip: true, detail: reason }); };
const attempt = (fn) => { try { return fn(); } catch (e) { return { threw: String(e && e.message ? e.message : e).split('\n')[0] }; } };
const failedAttempt = (v) => v !== null && typeof v === 'object' && !Buffer.isBuffer(v) && Object.prototype.hasOwnProperty.call(v, 'threw');
const has = (o, k) => o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k);
const lf = (s) => String(s).replace(/\r\n?/g, '\n');
const squash = (s) => lf(s).replace(/\s+/g, ' ').trim();
const lineDigest = (l) => sha(squash(l)).slice(0, 16);
const count = (hay, needle) => (needle === '' ? 0 : hay.split(needle).length - 1);
const KEYWORD = /\b(?:MUST|SHOULD|MAY)\b/; // uppercase RFC 2119 words; MUST NOT and SHOULD NOT contain one
const msgs = (ps) => ps.map((p) => p.msg).slice(0, 8);
const loadModule = async (rel) => { try { return { mod: await import(pathToFileURL(path.join(SKILL, ...rel.split('/'))).href) }; } catch (e) { return { err: String(e && e.message ? e.message : e).split('\n')[0] }; } };
const NOT_YET = (what, err) => `not implemented yet: ${what}${err ? ` (${err})` : ''}`;
/** A check that needs stub pins: FAIL naming PIN_PENDING while any is a stub; else fn() returns boolean or [boolean, detail]. */
const needPins = (name, pins, fn) => {
  const missing = Object.entries(pins).filter(([, v]) => v === PENDING).map(([k]) => k);
  if (missing.length > 0) { check(name, false, `${PENDING}: ${missing.join(', ')} not written yet (session 2)`); return; }
  const r = fn();
  if (Array.isArray(r)) check(name, r[0], r[1]); else check(name, r);
};
const SCRATCH_ROOT = process.env.V320_SCRATCH ? path.resolve(process.env.V320_SCRATCH) : os.tmpdir();
fs.mkdirSync(SCRATCH_ROOT, { recursive: true });
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(SCRATCH_ROOT, 'ps-r320-')));
let seq = 0;
const scratchDir = (name) => { const d = path.join(scratch, `${name}-${++seq}`); fs.mkdirSync(d, { recursive: true }); return d; };

// ---------------------------------------------------------------------------------------------------------------- the gate engine ----
// Records are { file, before, old, neu, after }: before + old + after is the 3.1.0 slice and before + neu + after the 3.2.0 slice (exactly once, at a line boundary).
const ID_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const REC_KEYS = ['after', 'before', 'file', 'neu', 'old'];
function occurrences(text, needle) { const out = []; if (needle === '') return out; for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) out.push(i); return out; }
function reverseRec(text, r) { const key = r.before + r.neu + r.after; const at = occurrences(text, key); if (at.length !== 1) return null; return text.slice(0, at[0]) + r.before + r.old + r.after + text.slice(at[0] + key.length); }
function applyRec(text, r) { const key = r.before + r.old + r.after; const at = occurrences(text, key); if (at.length !== 1) return null; return text.slice(0, at[0]) + r.before + r.neu + r.after + text.slice(at[0] + key.length); }
// A heuristic, not a proof: phrases that would grant a new exception to an inherited approval, root-start, security or ownership rule (the list of tests/release-3.1.test.mjs:535-542).
const WEAKENERS = Object.freeze([
  [/\bapproval (?:is|are) (?:not (?:required|needed)|optional)\b/i, 'approval made optional'],
  [/\bno approval (?:is )?(?:needed|required)\b/i, 'approval made unnecessary'],
  [/\b(?:need not|does not need to|do not need to|no need to) (?:obtain|ask for|request|get) (?:\w+ ){0,2}approval\b/i, 'approval made unnecessary'],
  [/\b(?:MAY|may|can|is allowed to|are allowed to) (?:skip|bypass|waive|ignore|override)\b[^.\n]{0,60}\b(?:approval|security|secret|root[- ]start|ownership|manifest|drift|user[- ]content|review)/, 'a permission to skip an inherited rule'],
  [/\boverrides? (?:the )?(?:security|root[- ]start|approval|ownership)\b/i, 'an override of an inherited rule'],
  [/\bexempt(?:ed)? from (?:the )?(?:approval|security|root[- ]start|ownership|drift)\b/i, 'an exemption from an inherited rule'],
]);
function recordProblems(id, r, cfg, add) {
  if (!ID_RE.test(id)) add('shape', null, id, `${id}: the id is not a plain identifier (no wildcard or pattern ids)`);
  if (r === null || typeof r !== 'object' || Array.isArray(r)) { add('shape', null, id, `${id}: the record is not an object`); return; }
  const file = typeof r.file === 'string' ? r.file : null;
  if (JSON.stringify(Object.keys(r).sort()) !== JSON.stringify(REC_KEYS)) add('shape', file, id, `${id}: the record keys are not exactly ${REC_KEYS.join(', ')}`);
  if (REC_KEYS.some((k) => typeof r[k] !== 'string')) { add('shape', file, id, `${id}: a record field is not a string`); return; }
  if (/[*?[\]{}\\]|\.\./.test(r.file) || r.file === '') add('shape', file, id, `${id}: the file key is empty or holds a wildcard, backslash or parent segment`);
  if (!cfg.amendable.has(r.file)) add('shape', file, id, `${id}: ${r.file} is not in the closed amendable set`);
  if ([r.before, r.old, r.neu, r.after].some((s) => s.includes('\r'))) add('shape', file, id, `${id}: a field holds a CR (LF only)`);
  if (r.old === r.neu) add('shape', file, id, `${id}: no-op record (old equals neu)`);
  if (r.neu === '') add('shape', file, id, `${id}: neu is empty: a deletion, which 3.2.0 does not have (the sign-off closeout is a later stage)`);
  else if (!r.neu.endsWith('\n')) add('shape', file, id, `${id}: neu is not line aligned (no final LF)`);
  if (r.old === '') {
    if (r.before === '' && r.after === '') add('shape', file, id, `${id}: the insertion has no anchor`);
  } else {
    if (!r.old.endsWith('\n')) add('shape', file, id, `${id}: old is not whole lines (no final LF)`);
    if (!cfg.replacementIds.has(id)) add('approved', file, id, `${id}: a replacement that is not on the closed list (a new, renamed or re-identified replacement)`);
    if (cfg.isNormative(r.file) && KEYWORD.test(r.old)) add('keyword', file, id, `${id}: old holds an RFC 2119 keyword (MUST, SHOULD or MAY) in a normative file, so it would remove an obligation`);
    if (r.file === '@root/TODO.md' && !cfg.todoExceptions.has(id)) add('todo', file, id, `${id}: a replacement in @root/TODO.md that is not in the pinned exception list`);
  }
  const pin = has(cfg.recordPins, id) ? cfg.recordPins[id] : undefined;
  if (pin === undefined) add('identity', file, id, `${id}: the record has no pinned identity (a new or renamed record)`);
  else for (const k of REC_KEYS) { const got = k === 'file' ? r.file : sha(r[k]); if (got !== pin[k]) add('identity', file, id, `${id}: ${k} differs from the pinned identity`); }
}
/** cfg: { actual:{key:text}, records, forward:{key:[ids]}, amendable:Set, pins:{key:sha}, recordPins, replacementIds:Set, todoExceptions:Set, isNormative:fn, normative?:{file:[digest]} }. */
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
  for (const file of cfg.amendable) {
    const actual = cfg.actual[file];
    const list = (cfg.forward[file] ?? []).filter((id) => has(cfg.records, id));
    if (typeof actual !== 'string') { add('chain', file, null, `${file}: the actual text is unavailable`); baseline[file] = null; continue; }
    let t = actual; let ok = true;
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
    if (sha(t) !== cfg.pins[file]) add('pin', file, null, `${file}: the reversed text is not the pinned 3.1.0 bytes (sha256 ${sha(t).slice(0, 12)}...)`);
    let f = t;
    for (const id of list) f = f === null ? null : applyRec(f, cfg.records[id]);
    if (f !== actual) add('roundtrip', file, null, `${file}: applying the records to the 3.1.0 bytes does not give the actual file`);
  }
  for (const [id, r] of Object.entries(cfg.records)) recordProblems(id, r, cfg, add);
  for (const id of Object.keys(cfg.recordPins)) if (!has(cfg.records, id)) add('identity', cfg.recordPins[id].file, id, `${id}: a pinned record has no record (removed or renamed)`);
  for (const id of cfg.replacementIds) if (!has(cfg.records, id)) add('approved', null, id, `${id}: a closed-list replacement has no record`);
  for (const [id, r] of Object.entries(cfg.records)) {
    if (!r || typeof r.neu !== 'string') continue;
    for (const [rx, what] of WEAKENERS) if (rx.test(r.neu)) add('weaken', r.file, id, `${id}: new text carries ${what}`);
  }
  for (const [file, digests] of Object.entries(cfg.normative ?? {})) {
    if (typeof cfg.actual[file] !== 'string') continue;
    const have = new Set(lf(cfg.actual[file]).split('\n').map(lineDigest));
    const missing = digests.filter((d) => !have.has(d)).length;
    if (missing > 0) add('obligation', file, null, `${file}: ${missing} 3.1.0 normative line(s) are missing from the actual file`);
  }
  return { problems, baseline };
}
/** The file-set comparison of section E: now and base are Maps key -> sha256; newFiles and amended are key lists. */
function treeProblems(now, base, newFiles, amended) {
  const allowed = new Set([...base.keys(), ...newFiles]);
  const amend = new Set(amended);
  return {
    extra: [...now.keys()].filter((k) => !allowed.has(k)).sort(),
    missing: [...allowed].filter((k) => !now.has(k)).sort(),
    changed: [...base.keys()].filter((k) => !amend.has(k) && now.has(k) && now.get(k) !== base.get(k)).sort(),
  };
}

// ----------------------------------------------------------------------------------------- notes, claims and acceptance engines ----
function sectionOf(text, rx) {
  const ls = lf(text).split('\n');
  const i = ls.findIndex((l) => rx.test(l));
  if (i < 0) return null;
  const level = /^#+/.exec(ls[i])[0].length;
  let j = i + 1;
  while (j < ls.length && !(/^#+ /.test(ls[j]) && /^#+/.exec(ls[j])[0].length <= level)) j++;
  return ls.slice(i, j).join('\n');
}
/** The notes contract (plan 4.5 D and C3): returns the list of problems of a RELEASE-NOTES-3.2.0.md buffer. */
function notesProblems(buf, version = '3.2.0') {
  const p = [];
  if (!Buffer.isBuffer(buf)) return ['the notes are unreadable'];
  const t = buf.toString('utf8');
  if (buf.length === 0) return ['the notes are empty'];
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) p.push('BOM');
  if (buf.includes(0x0d)) p.push('CR (LF only)');
  if (/[^\x00-\x7f]/.test(buf.toString('latin1'))) p.push('non-ASCII');
  if (!t.endsWith('\n') || t.endsWith('\n\n')) p.push('not exactly one final LF');
  if (/(?<![0-9A-Fa-f])(?:[0-9A-Fa-f]{40}|[0-9A-Fa-f]{64})(?![0-9A-Fa-f])/.test(t)) p.push('a standalone 40- or 64-hex ID (install/release.mjs:55)');
  if (/[A-Za-z]:\\Users\\|\\Users\\|\/home\/|\/Users\//.test(t)) p.push('a personal path');
  if (!t.startsWith(`# project-setup ${version}\n`)) p.push(`the title is not "# project-setup ${version}"`);
  const h = t.split('\n').filter((l) => /^#{2,3} /.test(l));
  if (!h.some((l) => /compatib/i.test(l))) p.push('no heading covers compatibility');
  if (!h.some((l) => /verif/i.test(l))) p.push('no heading covers the verification commands');
  if (!h.some((l) => /limitation/i.test(l))) p.push('no heading covers the known limitations');
  const up = sectionOf(t, /^## Upgrading\b/);
  if (up === null) p.push('no "## Upgrading" section');
  else {
    const steps = up.split('\n').filter((l) => /^\d+\. \S/.test(l));
    if (steps.length < 5 || steps.some((l, i) => !l.startsWith(`${i + 1}. `))) p.push('Upgrading does not hold the numbered steps 1 to 5 in order');
    if (!steps.some((l) => /backup/i.test(l) && /\.meta\.json/.test(l) && /skills director/i.test(l))) p.push('no numbered step moves the installer backup and its .meta.json out of the skills directory');
    if (!steps.some((l) => /\benv\//.test(l) && /\bcert\//.test(l) && /Phase 0/.test(l))) p.push('no numbered step states the tracked root env/ and cert/ files and the Phase 0 stop');
    if (!steps.some((l) => /coverage/i.test(l))) p.push('no numbered step covers the two coverage decisions on update');
  }
  const ver = h.find((l) => /verif/i.test(l));
  const verSec = ver === undefined ? null : sectionOf(t, new RegExp(`^${ver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  if (verSec !== null) {
    if (!verSec.includes('run-310-view.mjs')) p.push('the verification section does not name the view runner tests/run-310-view.mjs');
    if (!/\bCI\b/.test(verSec) || !/(?:does not|do not|not) run|runs? no\b|only .*format/i.test(verSec)) p.push('the verification section does not say that CI does not run the historical gates');
  }
  const nm = sectionOf(t, /^#{2,3} Not measured\b/);
  if (nm === null) p.push('no "Not measured" section');
  else {
    if (!nm.split('\n').slice(1).some((l) => /^(?:- |\d+\. )\S/.test(l))) p.push('the "Not measured" section holds no list');
    if (!/root[- ]anchor/i.test(nm) || !/render/i.test(nm)) p.push('the "Not measured" section does not scope the root-anchor claim to static rendering');
  }
  if (!/known issue/i.test(t) || !/3\.1\.0/.test(t)) p.push('the correction of the 3.1.0 known issue is not stated');
  return p;
}
const ACC_DIRS = ['$env:USERPROFILE\\.claude\\skills', '$env:USERPROFILE\\.agents\\skills'];
/** The acceptance-document rule (AC-C1-2; tests/release-3.1.test.mjs:1213-1243): the only user paths are the two $env:USERPROFILE skill directories. */
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
const MODES_OBSERVATION = 'A real Nest CLI 11 scaffold was exercised with BS followed by PS adopt on 2026-11-11. Prepare held CLAUDE.md and both standalone Claude agents for approval. That run did not exercise the agents, Codex, or PS followed by BS, and did not verify the 3.1 pointer workflow.';
const MD320_1 = 'The 3.1.0 live acceptance (2026-11-14 to 2026-11-22) later exercised the agents on both hosts and PS followed by BS (merge branch only); see RELEASE-NOTES-3.1.0.md.';
/** t: { VERSION, SKILL, PSREADME, CHANGELOG, ROOTREADME, TREE, MODES } as text. The current public claims of 3.2.0; returns [{ area, msg }]. */
function claimsProblems(t) {
  const p = [];
  const bad = (area, msg) => p.push({ area, msg });
  if (t.VERSION !== '3.2.0\n') bad('VERSION', 'VERSION is not exactly "3.2.0" plus one LF');
  const sk = lf(t.SKILL ?? '');
  const skHeads = sk.split('\n').filter((l) => /^# /.test(l));
  if (skHeads[0] !== '# project-setup 3.2.0' || skHeads.includes('# project-setup 3.1.0')) bad('SKILL', 'the SKILL.md title heading is not "# project-setup 3.2.0"');
  const rd = lf(t.PSREADME ?? '');
  const open = rd.split('\n## ')[0];
  if (rd.split('\n')[0] !== '# project-setup 3.2.0 - skill source') bad('PSREADME', 'the PS README title is not "# project-setup 3.2.0 - skill source"');
  if (!open.includes(NOTES320) || open.includes('RELEASE-NOTES-3.1.0.md')) bad('PSREADME', 'the opening release sentence does not cite RELEASE-NOTES-3.2.0.md in place of the 3.1.0 notes');
  for (const g of ['release-3.2.0.test.mjs', 'v320.test.mjs', 'run-310-view.mjs', 'bs-doc-map.test.mjs']) if (!rd.includes(g)) bad('PSREADME', `the README does not name ${g}`);
  const tagLines = rd.split('\n').filter((l) => /project-setup-v3\.\d+\.\d+/.test(l));
  if (tagLines.length === 0 || tagLines.some((l) => !l.includes('project-setup-v3.2.0') || /project-setup-v3\.1\.0/.test(l))) bad('PSREADME', 'the local release section does not carry the 3.2.0 tag token alone');
  const cl = lf(t.CHANGELOG ?? '');
  if (!cl.startsWith('# Changelog\n\n## 3.2.0\n') || cl.split('\n## 3.2.0\n').length !== 2) bad('CHANGELOG', 'the changelog does not start with one "## 3.2.0" entry');
  if (!(cl.indexOf('\n## 3.2.0\n') < cl.indexOf('\n## 3.1.0\n') && cl.indexOf('\n## 3.1.0\n') > 0)) bad('CHANGELOG', 'the 3.1.0 entry is not kept after the 3.2.0 entry');
  const rr = lf(t.ROOTREADME ?? '');
  for (const [rx, what] of [[/\(3\.1\.0, shared by Claude Code and Codex\)/, 'the introduction version'], [/installs `project-setup` 3\.1\.0/, 'the install sentence'], [/\(3\.1\.0, own installer and tests\)/, 'the layout tree line']]) if (rx.test(rr)) bad('ROOTREADME', `a stale current 3.1.0 claim remains: ${what}`);
  if (rr.split('\n').filter((l) => /\b3\.2\.0\b/.test(l)).length < 3) bad('ROOTREADME', 'fewer than three current 3.2.0 claims (introduction, install, layout)');
  if (!rr.includes(NOTES320)) bad('ROOTREADME', 'the root README does not cite RELEASE-NOTES-3.2.0.md');
  if (!/project-setup\/\s+general-purpose.*\(3\.2\.0\b/.test(rr)) bad('ROOTREADME', 'the layout tree line does not say 3.2.0');
  const tr = lf(t.TREE ?? '');
  if (!/project-setup\/\s+skill 3 .*\(3\.2\.0\)/.test(tr) || !tr.includes('`project-setup/VERSION` is `3.2.0`')) bad('TREE', 'the project tree does not say 3.2.0 for the skill line and VERSION');
  if (/project-setup\/\s+skill 3 .*\(3\.1\.0\)/.test(tr) || tr.includes('`project-setup/VERSION` is `3.1.0`')) bad('TREE', 'a stale current 3.1.0 claim remains in the project tree');
  const md = squash(lf(t.MODES ?? ''));
  if (md.split(MODES_OBSERVATION).length !== 2) bad('MODES', 'the dated 3.1.0 scaffold observation (lines 74-76) is not present exactly once');
  if (md.split(MD320_1).length !== 2) bad('MODES', 'the [MD320_1] observation is not present exactly once');
  else if (md.indexOf(MD320_1) < md.indexOf(MODES_OBSERVATION)) bad('MODES', 'the [MD320_1] observation is not after the dated statement it follows');
  return p;
}

// ============================================================================================ A. the amendment layer on the actual bytes ====
const LH = await loadModule('tests/helpers/v320-amendments.mjs');
const LR = await loadModule('tests/run-310-view.mjs');
const H = LH.mod ?? null;
const RUN = LR.mod ?? null;
const FIXTURE_PATH = path.join(SKILL, 'tests', 'fixtures', 'v320-prechange.json');
const FIX_RAW = attempt(() => fs.readFileSync(FIXTURE_PATH, 'utf8'));
const FIX = failedAttempt(FIX_RAW) ? FIX_RAW : attempt(() => JSON.parse(FIX_RAW));
const FIX_OK = !failedAttempt(FIX) && FIX !== null && typeof FIX === 'object';
const ACTUAL = Object.fromEntries(AMENDABLE.map((k) => [k, attempt(() => fs.readFileSync(absOf(k), 'utf8'))]));
const actualText = (k) => (typeof ACTUAL[k] === 'string' ? ACTUAL[k] : '');
const PINS_READY = ![BASE_FILES, NOW_FILES, RECORD_PINS, REPLACEMENT_IDS, NORMATIVE_LINES].includes(PENDING);

check('the helper tests/helpers/v320-amendments.mjs exists and imports', H !== null, NOT_YET('tests/helpers/v320-amendments.mjs', LH.err));
const NAMES = ['AM320', 'FORWARD_ORDER320', 'REVERSAL_ORDER320', 'AMENDED_FILES320', 'NEW_FILES320', 'CURRENT_VERSION320', 'VIEW_COPY_SET', 'reverseSteps', 'applySteps', 'reverseForFile', 'applyForFile', 'read310', 'buildView', 'to310Repo', 'overlay'];
check('the helper exports AM320, the three orders, NEW_FILES320, CURRENT_VERSION320, VIEW_COPY_SET and the eight functions', H !== null && NAMES.every((n) => n in H) && ['reverseSteps', 'applySteps', 'reverseForFile', 'applyForFile', 'read310', 'buildView', 'to310Repo', 'overlay'].every((n) => typeof H[n] === 'function'), H === null ? NOT_YET('helper') : NAMES.filter((n) => !(n in H)));
check('CURRENT_VERSION320 is exactly "3.2.0"', H !== null && H.CURRENT_VERSION320 === '3.2.0', H === null ? NOT_YET('helper') : H.CURRENT_VERSION320);
check('NEW_FILES320 is exactly this spec\'s closed list of eight paths (plan 4.2), and the helper\'s base commit is the pinned one', H !== null && JSON.stringify([...H.NEW_FILES320].sort()) === JSON.stringify([...NEW_FILES].sort()) && H.BASE_COMMIT320 === BASE_COMMIT, H === null ? NOT_YET('helper') : { files: H.NEW_FILES320, base: H.BASE_COMMIT320 });
const shapeFrozen = H !== null && has(H, 'AM320') && Object.isFrozen(H.AM320) && Object.values(H.AM320).every((r) => Object.isFrozen(r) && JSON.stringify(Object.keys(r).sort()) === JSON.stringify(REC_KEYS) && REC_KEYS.every((k) => typeof r[k] === 'string'));
const hasRecords = H !== null && has(H, 'AM320') && Object.keys(H.AM320).length > 0;
check('AM320 holds the records of the final amendments (it is empty until session 2 writes them) and every record is frozen with exactly the keys file, before, old, neu, after as strings', shapeFrozen && hasRecords, H === null ? NOT_YET('AM320') : hasRecords ? undefined : `${PENDING}: AM320 is empty (session 2 writes the literals)`);
const orderOk = (() => {
  if (H === null || !has(H, 'FORWARD_ORDER320') || !has(H, 'REVERSAL_ORDER320') || !has(H, 'AMENDED_FILES320') || !hasRecords) return false;
  const f = H.FORWARD_ORDER320; const r = H.REVERSAL_ORDER320;
  if (!Object.isFrozen(f) || !Object.isFrozen(r) || !Object.values(f).every((a) => Array.isArray(a) && Object.isFrozen(a))) return false;
  if (JSON.stringify(H.AMENDED_FILES320) !== JSON.stringify(Object.keys(f)) || JSON.stringify(Object.keys(r)) !== JSON.stringify(Object.keys(f))) return false;
  if (!Object.keys(f).every((k) => JSON.stringify([...f[k]].reverse()) === JSON.stringify(r[k]))) return false;
  const listed = Object.values(f).flat();
  return new Set(listed).size === listed.length && listed.length === Object.keys(H.AM320).length && Object.keys(f).every((k) => f[k].every((id) => has(H.AM320, id) && H.AM320[id].file === k));
})();
check('FORWARD_ORDER320 lists every record exactly once under its own file, REVERSAL_ORDER320 is its exact reverse and AMENDED_FILES320 its key list', orderOk, H === null ? NOT_YET('orders') : hasRecords ? undefined : `${PENDING}: the orders are empty (session 2)`);
check('every amended file is inside the closed amendable set of 21 files (15 skill, 3 living test, 3 root)', H !== null && hasRecords && H.AMENDED_FILES320.every((k) => AMENDABLE.includes(k)) && AMENDABLE.length === 21, H === null ? NOT_YET('AMENDED_FILES320') : hasRecords ? H.AMENDED_FILES320 : `${PENDING}: no amended file is listed yet`);

check('the fixture tests/fixtures/v320-prechange.json exists and parses', FIX_OK, NOT_YET('tests/fixtures/v320-prechange.json', failedAttempt(FIX) ? FIX.threw : undefined));
check('the fixture has exactly the keys schema, baseCommit, files, replacements, with schema 1 and the pinned base commit', FIX_OK && JSON.stringify(Object.keys(FIX).sort()) === JSON.stringify(['baseCommit', 'files', 'replacements', 'schema']) && FIX.schema === 1 && FIX.baseCommit === BASE_COMMIT, FIX_OK ? { keys: Object.keys(FIX), schema: FIX.schema, base: FIX.baseCommit } : NOT_YET('fixture'));
needPins('the fixture files table is exactly this spec\'s 3.1.0 pins: every file under project-setup/ and the three root files, each { sha256, bytes } with the pinned sha256', { BASE_FILES }, () => [FIX_OK && typeof FIX.files === 'object' && FIX.files !== null && JSON.stringify(Object.keys(FIX.files).sort()) === JSON.stringify(Object.keys(BASE_FILES).sort()) && Object.keys(BASE_FILES).every((k) => JSON.stringify(Object.keys(FIX.files[k]).sort()) === '["bytes","sha256"]' && FIX.files[k].sha256 === BASE_FILES[k]), FIX_OK ? Object.keys(FIX.files ?? {}).length : NOT_YET('fixture')]);
const fixReps = FIX_OK && typeof FIX.replacements === 'object' && FIX.replacements !== null ? FIX.replacements : null;
check('the fixture replacements are one entry per AM320 record with a nonempty old, { file, oldSha256, neuSha256 } with the digests of that record\'s old and neu, and no other entry', fixReps !== null && shapeFrozen && hasRecords && (() => { const reps = Object.entries(H.AM320).filter(([, r]) => r.old !== ''); return reps.length === Object.keys(fixReps).length && reps.every(([id, r]) => has(fixReps, id) && JSON.stringify(Object.keys(fixReps[id]).sort()) === '["file","neuSha256","oldSha256"]' && fixReps[id].file === r.file && fixReps[id].oldSha256 === sha(r.old) && fixReps[id].neuSha256 === sha(r.neu)); })(), fixReps === null || !hasRecords ? NOT_YET('fixture and helper') : undefined);
check('the fixture holds no personal path, no secret-shaped string and no file text', typeof FIX_RAW === 'string' && !/[A-Za-z]:\\\\Users|\/home\/|\/Users\/|ghp_[A-Za-z0-9]{20}|AKIA[0-9A-Z]{12}|BEGIN [A-Z ]*PRIVATE KEY/.test(FIX_RAW) && FIX_OK && !JSON.stringify(Object.values(FIX.files ?? {}).map((v) => Object.keys(v))).includes('text'), typeof FIX_RAW === 'string' ? undefined : NOT_YET('fixture'));
needPins('the pins are well formed: the pinned records are frozen plain-identifier entries with file in the amendable set and four 64-hex digests, the TODO exception is inside the replacement list, and every replacement id has a pinned record', { RECORD_PINS, REPLACEMENT_IDS }, () => [Object.keys(RECORD_PINS).every((id) => ID_RE.test(id) && AMENDABLE.includes(RECORD_PINS[id].file) && ['before', 'old', 'neu', 'after'].every((k) => /^[0-9a-f]{64}$/.test(RECORD_PINS[id][k]))) && REPLACEMENT_IDS.every((id) => has(RECORD_PINS, id) && RECORD_PINS[id].old !== sha('')) && TODO_EXCEPTIONS.every((id) => REPLACEMENT_IDS.includes(id)), undefined]);

const realReady = PINS_READY && shapeFrozen && orderOk && AMENDABLE.every((k) => typeof ACTUAL[k] === 'string');
const REAL = realReady ? gate({ actual: ACTUAL, records: H.AM320, forward: H.FORWARD_ORDER320, amendable: new Set(AMENDABLE), pins: Object.fromEntries(AMENDABLE.map((k) => [k, BASE_FILES[k]])), recordPins: RECORD_PINS, replacementIds: new Set(REPLACEMENT_IDS), todoExceptions: new Set(TODO_EXCEPTIONS), isNormative: NORMATIVE_SCOPE, normative: NORMATIVE_LINES }) : null;
check('the gate can run on the actual bytes (every pin, the helper records and orders written, all 21 amendable files readable)', REAL !== null, !PINS_READY ? `${PENDING}: ${[['BASE_FILES', BASE_FILES], ['NOW_FILES', NOW_FILES], ['RECORD_PINS', RECORD_PINS], ['REPLACEMENT_IDS', REPLACEMENT_IDS], ['NORMATIVE_LINES', NORMATIVE_LINES]].filter(([, v]) => v === PENDING).map(([n]) => n).join(', ')} not written yet (session 2)` : NOT_YET('the amendment layer'));
if (REAL !== null) {
  for (const k of AMENDABLE) {
    const mine = REAL.problems.filter((q) => q.file === k && q.kind !== 'obligation');
    check(`${k}: the actual bytes are the pinned 3.1.0 bytes plus exactly the recorded amendments (reversal, pin, round trip, shapes, identities, closed replacement list)`, mine.length === 0, msgs(mine));
    check(`${k}: the actual bytes equal the pinned 3.2.0 bytes`, NOW_FILES[k] !== undefined && sha(Buffer.from(actualText(k), 'utf8')) === NOW_FILES[k], NOW_FILES[k] === undefined ? 'no 3.2.0 pin' : sha(Buffer.from(actualText(k), 'utf8')));
    check(`${k}: LF only, no BOM, exactly one final LF`, typeof ACTUAL[k] === 'string' && !ACTUAL[k].includes('\r') && ACTUAL[k].charCodeAt(0) !== 0xfeff && ACTUAL[k].endsWith('\n') && !ACTUAL[k].endsWith('\n\n'), undefined);
  }
  check('the amendment records and orders are consistent (no unlisted, duplicated or misfiled record, no pattern id, no unpinned record, no pin without a record)', REAL.problems.filter((q) => q.kind === 'order' || q.kind === 'identity' || (q.file === null && q.kind !== 'obligation')).length === 0, msgs(REAL.problems.filter((q) => q.kind === 'order' || q.kind === 'identity' || q.file === null)));
  check('every non-insertion record is on the closed list, whole lines, with no RFC 2119 word in old inside a normative file, and every @root/TODO.md replacement is in the pinned exception list', REAL.problems.filter((q) => ['approved', 'keyword', 'todo'].includes(q.kind)).length === 0, msgs(REAL.problems.filter((q) => ['approved', 'keyword', 'todo'].includes(q.kind))));
  check('no amendment text carries a listed weakening phrase (approval, root-start, security, ownership exceptions)', REAL.problems.filter((q) => q.kind === 'weaken').length === 0, msgs(REAL.problems.filter((q) => q.kind === 'weaken')));
  for (const k of H.AMENDED_FILES320) {
    const back = attempt(() => H.reverseForFile(ACTUAL[k], k));
    check(`${k}: the helper's reverseForFile gives this spec's reversal (the pinned 3.1.0 bytes) and applyForFile gives the actual file back`, !failedAttempt(back) && back.text === REAL.baseline[k] && attempt(() => H.applyForFile(REAL.baseline[k], k)) === ACTUAL[k], failedAttempt(back) ? back : back.failed);
    check(`${k}: control: reversing the 3.1.0 bytes again is refused by the helper`, attempt(() => H.reverseForFile(REAL.baseline[k], k)).text === null);
    check(`${k}: read310 of the real file is the pinned 3.1.0 bytes`, (() => { const b = attempt(() => H.read310(absOf(k))); return Buffer.isBuffer(b) && sha(b) === BASE_FILES[k]; })());
    const ids = H.FORWARD_ORDER320[k]; const last = H.AM320[ids[ids.length - 1]]; const keyLast = last.before + last.neu + last.after;
    const mutate = (text) => gate({ actual: { ...ACTUAL, [k]: text }, records: H.AM320, forward: H.FORWARD_ORDER320, amendable: new Set(AMENDABLE), pins: Object.fromEntries(AMENDABLE.map((x) => [x, BASE_FILES[x]])), recordPins: RECORD_PINS, replacementIds: new Set(REPLACEMENT_IDS), todoExceptions: new Set(TODO_EXCEPTIONS), isNormative: NORMATIVE_SCOPE }).problems.some((q) => q.file === k && ['chain', 'pin', 'roundtrip'].includes(q.kind));
    const muts = [['missing', ACTUAL[k].replace(keyLast, () => last.before + last.old + last.after)], ['duplicated', ACTUAL[k].replace(keyLast, () => `${last.before}${last.neu}${last.neu}${last.after}`)], ['altered', last.neu.length > 1 ? ACTUAL[k].replace(keyLast, () => `${last.before}${last.neu.slice(0, -2)}#\n${last.after}`) : null], ['appended', `${ACTUAL[k]}Unrecorded line.\n`]].filter(([, m]) => m !== null && m !== ACTUAL[k]);
    check(`${k}: gate control on the real bytes: a missing, a duplicated, an altered and an appended unrecorded last amendment are each rejected`, muts.length >= 3 && muts.every(([, m]) => mutate(m)), Object.fromEntries(muts.map(([n, m]) => [n, mutate(m)])));
  }
}

// ======================================================================================================= B. mutation controls (plan 5.2) ====
const synthText = (ls) => `${ls.join('\n')}\n`;
const SYN_BASE = {
  'SKILL.md': synthText(['# project-setup 3.1.0', '', 'Intro line.', '', '- The agent MUST confirm before writing.', '- The agent SHOULD NOT log secrets.', '', 'Tail paragraph.']),
  'references/a.md': synthText(['# Ref A', '', 'Rule one: the agent MUST stop.', 'Anchor line A.', 'Anchor line B.', '', 'End.']),
  'README.md': synthText(['# readme 3.1.0', 'Version 3.1.0 here.', 'Done.']),
  '@root/TODO.md': synthText(['# TODO', '', '- Item one.', '  Status text.', '', '- Item two.', 'Last.']),
};
const R = (file, before, old, neu, after) => ({ file, before, old, neu, after });
const SYN_RECORDS = () => ({
  SK1: R('SKILL.md', '', '# project-setup 3.1.0\n', '# project-setup 3.2.0\n', ''),
  SK2: R('SKILL.md', 'Intro line.\n', '', 'Inserted paragraph.\n', '\n- The agent MUST confirm before writing.\n'),
  RA1: R('references/a.md', 'Anchor line A.\n', '', 'New rule: the agent MUST NOT skip.\n', 'Anchor line B.\n'),
  RM1: R('README.md', '', 'Version 3.1.0 here.\n', 'Version 3.2.0 here.\n', ''),
  TD1: R('@root/TODO.md', '  Status text.\n', '', '  Status 2026-11-22: shipped as text only.\n', '\n- Item two.\n'),
  TD2: R('@root/TODO.md', '', 'Last.\n', 'Last, updated.\n', ''),
});
const SYN_FORWARD = () => ({ 'SKILL.md': ['SK1', 'SK2'], 'references/a.md': ['RA1'], 'README.md': ['RM1'], '@root/TODO.md': ['TD1', 'TD2'] });
const SYN_FILES = Object.keys(SYN_BASE);
const recordPinsOf = (records) => Object.fromEntries(Object.entries(records).map(([id, r]) => [id, { file: r.file, before: sha(r.before), old: sha(r.old), neu: sha(r.neu), after: sha(r.after) }]));
const SYN_REPL = ['SK1', 'RM1', 'TD2'];
const SYN_NORM = Object.fromEntries(['SKILL.md', 'references/a.md'].map((f) => [f, SYN_BASE[f].split('\n').filter((l) => KEYWORD.test(l)).map(lineDigest)]));
const applyAll = (base, records, forward) => { const out = { ...base }; for (const [f, ids] of Object.entries(forward)) for (const id of ids) out[f] = applyRec(out[f], records[id]); return out; };
const GOOD = { records: SYN_RECORDS(), forward: SYN_FORWARD() };
GOOD.actual = applyAll(SYN_BASE, GOOD.records, GOOD.forward);
GOOD.recordPins = recordPinsOf(GOOD.records);
/** One synthetic gate run: over = { records, forward, actual, recordPins, replacementIds, todoExceptions, normative, amendable }. */
const runSyn = (over = {}) => gate({
  actual: over.actual ?? GOOD.actual, records: over.records ?? GOOD.records, forward: over.forward ?? GOOD.forward,
  amendable: over.amendable ?? new Set(SYN_FILES), pins: Object.fromEntries(SYN_FILES.map((f) => [f, sha(SYN_BASE[f])])),
  recordPins: over.recordPins ?? GOOD.recordPins, replacementIds: over.replacementIds ?? new Set(SYN_REPL), todoExceptions: over.todoExceptions ?? new Set(['TD2']),
  isNormative: (f) => f === 'SKILL.md' || f.startsWith('references/'), normative: over.normative ?? SYN_NORM,
}).problems;
const found = (ps, kind, rx) => ps.some((q) => q.kind === kind && rx.test(q.msg));
const kinds = (ps) => [...new Set(ps.map((q) => q.kind))].sort().join(',');
const control = (name, ps, kind, rx) => check(`gate control: ${name}`, found(ps, kind, rx), ps.map((q) => `${q.kind}: ${q.msg}`).slice(0, 5));
/** A consistent mutation: the records are changed and the actual files follow, so only the identity pins (or the lists) can object. */
const consistent = (records, forward, replacementIds = SYN_REPL) => ({ records, forward, actual: applyAll(SYN_BASE, records, forward), replacementIds: new Set(replacementIds) });
{
  const base = runSyn();
  check('gate control (sanity): the unmutated synthetic world has no problem', base.length === 0, base.map((q) => `${q.kind}: ${q.msg}`));
  { const recs = SYN_RECORDS(); recs.SK2 = { ...recs.SK2, neu: 'Inserted paragraph!\n' }; control('one changed character in a record (the actual file unchanged) does not stand at its anchor', runSyn({ records: recs, recordPins: recordPinsOf(recs) }), 'chain', /does not stand exactly once/); }
  { const act = { ...GOOD.actual, 'SKILL.md': GOOD.actual['SKILL.md'].replace('Inserted paragraph.', 'Inserted paragrapx.') }; control('one changed character in the actual file is rejected', runSyn({ actual: act }), 'chain', /SK2 does not stand exactly once/); }
  { const act = { ...GOOD.actual, 'SKILL.md': GOOD.actual['SKILL.md'].replace('Inserted paragraph.\n', 'Inserted paragraph.\nInserted paragraph.\n') }; control('a record applied twice is rejected', runSyn({ actual: act }), 'chain', /does not stand exactly once/); }
  { const act = { ...GOOD.actual, 'references/a.md': `${GOOD.actual['references/a.md']}An unrecorded extra line.\n` }; const ps = runSyn({ actual: act }); control('an extra unrecorded line in an amended file fails the pin', ps, 'pin', /not the pinned 3\.1\.0 bytes/); check('gate control: ... and the round trip', found(ps, 'roundtrip', /does not give the actual file/) || found(ps, 'pin', /pinned/)); }
  { const act = { ...GOOD.actual, 'README.md': GOOD.actual['README.md'].replace('Done.', 'Done!') }; control('an unrecorded edit away from the anchors in an amended file fails the pin', runSyn({ actual: act }), 'pin', /not the pinned 3\.1\.0 bytes/); }
  { const recs = SYN_RECORDS(); recs.RA2 = R('references/a.md', '', 'Rule one: the agent MUST stop.\n', 'Rule one: the agent stops.\n', ''); const fwd = SYN_FORWARD(); fwd['references/a.md'] = ['RA1', 'RA2']; const c = consistent(recs, fwd, [...SYN_REPL, 'RA2']); const ps = runSyn({ ...c, recordPins: recordPinsOf(recs) }); control('a normative record whose old holds MUST is rejected (D-4), though pinned and on the closed list', ps, 'keyword', /RFC 2119 keyword/); check('gate control: ... and the missing normative line is reported as an obligation', found(ps, 'obligation', /normative line/), msgs(ps)); }
  { const recs = SYN_RECORDS(); recs.SK3 = R('SKILL.md', '', 'Tail paragraph.\n', 'Tail paragraph, reworded.\n', ''); const fwd = SYN_FORWARD(); fwd['SKILL.md'] = ['SK1', 'SK2', 'SK3']; const c = consistent(recs, fwd, [...SYN_REPL, 'SK3']); const ps = runSyn({ ...c, recordPins: recordPinsOf(recs) }); check('gate control: a keyword-free, pinned, closed-list replacement in a normative file is accepted (the D-4 rule is about old holding MUST, not about replacing)', ps.length === 0, ps.map((q) => `${q.kind}: ${q.msg}`)); }
  { const recs = SYN_RECORDS(); recs.TD3 = R('@root/TODO.md', '', '# TODO\n', '# TODO list\n', ''); const fwd = SYN_FORWARD(); fwd['@root/TODO.md'] = ['TD1', 'TD2', 'TD3']; const c = consistent(recs, fwd, [...SYN_REPL, 'TD3']); control('a @root/TODO.md replacement that is not in the pinned exception list is rejected', runSyn({ ...c, recordPins: recordPinsOf(recs) }), 'todo', /not in the pinned exception list/); }
  { const recs = SYN_RECORDS(); recs.SK3 = R('SKILL.md', '', 'Tail paragraph.\n', 'Tail paragraph, reworded.\n', ''); const fwd = SYN_FORWARD(); fwd['SKILL.md'] = ['SK1', 'SK2', 'SK3']; const c = consistent(recs, fwd, SYN_REPL); control('a replacement that is not on the closed list is rejected even though it is pinned', runSyn({ ...c, recordPins: recordPinsOf(recs) }), 'approved', /not on the closed list/); }
  { const recs = SYN_RECORDS(); recs.SK2 = { ...recs.SK2, neu: 'Inserted paragraph, edited.\n' }; const c = consistent(recs, GOOD.forward); const ps = runSyn({ ...c }); check('gate control: a CONSISTENT change of a record\'s new text (record and actual file together) is rejected by the identity pin alone, with no chain, pin or round-trip problem', found(ps, 'identity', /neu differs from the pinned identity/) && !ps.some((q) => ['chain', 'pin', 'roundtrip'].includes(q.kind)), ps.map((q) => `${q.kind}: ${q.msg}`)); }
  { const recs = SYN_RECORDS(); recs.SK2 = { ...recs.SK2, before: 'Intro line.\n\n', after: '- The agent MUST confirm before writing.\n' }; const c = consistent(recs, GOOD.forward); const ps = runSyn({ ...c }); check('gate control: a CONSISTENT re-anchoring (the same insertion, different anchors, still standing once) is rejected by the identity pin alone', found(ps, 'identity', /(?:before|after) differs/) && !ps.some((q) => ['chain', 'pin', 'roundtrip'].includes(q.kind)), ps.map((q) => `${q.kind}: ${q.msg}`)); }
  { const recs = SYN_RECORDS(); recs.RA1 = { ...recs.RA1, old: '' }; const fwdRename = { 'SKILL.md': ['SK1', 'SK2'], 'references/a.md': ['RA1X'], 'README.md': ['RM1'], '@root/TODO.md': ['TD1', 'TD2'] }; const r2 = { ...recs }; delete r2.RA1; r2.RA1X = recs.RA1; const c = consistent(r2, fwdRename); const ps = runSyn({ ...c }); check('gate control: a CONSISTENT rename of a record id is rejected: the new id has no pinned identity and the pinned id has no record', found(ps, 'identity', /RA1X: the record has no pinned identity/) && found(ps, 'identity', /RA1: a pinned record has no record/), ps.map((q) => `${q.kind}: ${q.msg}`)); }
  { const recs = SYN_RECORDS(); recs.SK3 = R('SKILL.md', 'Tail paragraph', '', '', ''); const recs2 = SYN_RECORDS(); recs2.SK3 = R('SKILL.md', '', 'Intro line.\n', 'Intro line.\n', ''); control('a no-op record (old equals neu) is rejected', runSyn({ records: { ...GOOD.records, SK3: recs2.SK3 }, forward: { ...GOOD.forward, 'SKILL.md': ['SK1', 'SK2', 'SK3'] } }), 'shape', /no-op record/); }
  { const recs = { ...GOOD.records, SK3: R('SKILL.md', 'Tail paragraph.\n', '', '', '') }; control('an empty record (a deletion or nothing) is rejected: 3.2.0 has no deletion record', runSyn({ records: recs, forward: { ...GOOD.forward, 'SKILL.md': ['SK1', 'SK2', 'SK3'] } }), 'shape', /neu is empty/); }
  { const recs = { ...GOOD.records, SK3: R('SKILL.md', '', '', 'No anchor line.\n', '') }; control('an insertion without an anchor is rejected', runSyn({ records: recs, forward: { ...GOOD.forward, 'SKILL.md': ['SK1', 'SK2', 'SK3'] } }), 'shape', /no anchor/); }
  { const recs = { ...GOOD.records, SK3: R('SKILL.md', 'Tail paragraph.\n', '', 'Line without a final LF', '') }; control('a neu that is not line aligned is rejected', runSyn({ records: recs, forward: { ...GOOD.forward, 'SKILL.md': ['SK1', 'SK2', 'SK3'] } }), 'shape', /not line aligned/); }
  { const recs = { ...GOOD.records, SK3: R('SKILL.md', 'Tail paragraph.\r\n', '', 'x\n', '') }; control('a CR in a record field is rejected', runSyn({ records: recs, forward: { ...GOOD.forward, 'SKILL.md': ['SK1', 'SK2', 'SK3'] } }), 'shape', /CR/); }
  { const recs = { ...GOOD.records, X1: R('scripts/other.mjs', '', 'a\n', 'b\n', '') }; control('a record on a file outside the closed amendable set is rejected', runSyn({ records: recs, forward: { ...GOOD.forward, 'scripts/other.mjs': ['X1'] } }), 'shape', /not in the closed amendable set/); }
  { const recs = { ...GOOD.records, 'SK*': R('SKILL.md', 'Tail paragraph.\n', '', 'Star id.\n', '') }; control('a wildcard id is rejected', runSyn({ records: recs, forward: { ...GOOD.forward, 'SKILL.md': ['SK1', 'SK2', 'SK*'] } }), 'shape', /not a plain identifier/); }
  { const f = { ...GOOD.forward, 'SKILL.md': ['SK1'] }; control('a record that no forward order lists is rejected', runSyn({ forward: f }), 'order', /not listed in any forward order/); }
  { const f = { ...GOOD.forward, 'SKILL.md': ['SK1', 'SK2', 'SK2'] }; control('a record listed twice in the forward order is rejected', runSyn({ forward: f }), 'order', /more than once/); }
  { const f = { ...GOOD.forward, 'README.md': ['RM1', 'SK1'], 'SKILL.md': ['SK2'] }; control('a record ordered under another file than its own is rejected', runSyn({ forward: f }), 'order', /ordered under/); }
  { const recs = SYN_RECORDS(); recs.SK2 = { ...recs.SK2, neu: 'Approval is optional when the user is busy.\n' }; const c = consistent(recs, GOOD.forward); control('a weakening phrase in new text is rejected', runSyn({ ...c, recordPins: recordPinsOf(recs) }), 'weaken', /approval made optional/); }
  { const recs = SYN_RECORDS(); recs.SK2 = { ...recs.SK2, neu: 'Setup MUST NOT skip approval.\n' }; const c = consistent(recs, GOOD.forward); check('gate control: a strengthening sentence (MUST NOT skip approval) is not read as a weakening', runSyn({ ...c, recordPins: recordPinsOf(recs) }).filter((q) => q.kind === 'weaken').length === 0); }
  { const ps = gate({ actual: GOOD.actual, records: GOOD.records, forward: GOOD.forward, amendable: new Set(SYN_FILES), pins: { ...Object.fromEntries(SYN_FILES.map((f) => [f, sha(SYN_BASE[f])])), 'README.md': sha('another') }, recordPins: GOOD.recordPins, replacementIds: new Set(SYN_REPL), todoExceptions: new Set(['TD2']), isNormative: () => false }).problems; control('a wrong 3.1.0 pin for a file is rejected', ps, 'pin', /README\.md: the reversed text is not the pinned/); }
  { const ps = runSyn({ normative: { 'SKILL.md': [...SYN_NORM['SKILL.md'], lineDigest('- A baseline line that is gone MUST be reported.')] } }); control('a 3.1.0 normative line that is gone from the actual file is rejected', ps, 'obligation', /1 3\.1\.0 normative line/); }
  { const ps = runSyn({ actual: { ...GOOD.actual, 'README.md': undefined } }); control('an unreadable amended file is a chain problem, not a pass', ps, 'chain', /actual text is unavailable/); }
  { const ps = runSyn({ replacementIds: new Set([...SYN_REPL, 'GHOST']) }); control('a closed-list replacement id with no record is rejected', ps, 'approved', /GHOST: a closed-list replacement has no record/); }
}
// The tree comparison of section E (plan 5.2 item 1: an unrecorded edit in an unamended file, a stray extra file, a missing new file).
{
  const base = new Map([['SKILL.md', 'a'], ['scripts/lib.mjs', 'b'], ['tests/c3.test.mjs', 'c'], ['RELEASE-NOTES-3.1.0.md', 'd']]);
  const newFiles = ['tests/v320.test.mjs', NOTES320];
  const good = new Map([...base, ['SKILL.md', 'a2'], ['tests/v320.test.mjs', 'e'], [NOTES320, 'f']]);
  const tp = (now) => treeProblems(now, base, newFiles, ['SKILL.md']);
  check('tree control (sanity): 3.1.0 plus the new files, with the amended file free to differ, has no problem', JSON.stringify(tp(good)) === JSON.stringify({ extra: [], missing: [], changed: [] }), tp(good));
  check('tree control: an unrecorded edit in an unamended file is reported as changed', JSON.stringify(tp(new Map([...good, ['scripts/lib.mjs', 'b2']])).changed) === '["scripts/lib.mjs"]');
  check('tree control: an unrecorded edit in an unamended historical test is reported as changed', JSON.stringify(tp(new Map([...good, ['tests/c3.test.mjs', 'c2']])).changed) === '["tests/c3.test.mjs"]');
  check('tree control: a stray RELEASE-NOTES-3.2.1.md is reported as extra (only the exact new paths are allowed)', JSON.stringify(tp(new Map([...good, ['RELEASE-NOTES-3.2.1.md', 'x']])).extra) === '["RELEASE-NOTES-3.2.1.md"]');
  check('tree control: a stray extra file is reported as extra', JSON.stringify(tp(new Map([...good, ['scripts/new.mjs', 'x']])).extra) === '["scripts/new.mjs"]');
  { const m = new Map(good); m.delete('tests/v320.test.mjs'); check('tree control: a missing new file is reported as missing', JSON.stringify(tp(m).missing) === '["tests/v320.test.mjs"]'); }
  { const m = new Map(good); m.delete('RELEASE-NOTES-3.1.0.md'); check('tree control: a deleted 3.1.0 file is reported as missing', JSON.stringify(tp(m).missing) === '["RELEASE-NOTES-3.1.0.md"]'); }
}
// The view (plan 5.2 item 2), on synthetic trees through the helper's real functions.
const gitEnv = (tmp) => {
  const gitconfig = path.join(tmp, 'gitconfig');
  fs.writeFileSync(gitconfig, '[user]\n\tname = Fixture\n\temail = fixture@example.invalid\n[core]\n\tautocrlf = false\n[commit]\n\tgpgsign = false\n');
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^GIT_/i.test(k) && typeof v === 'string') env[k] = v;
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: gitconfig, GIT_TERMINAL_PROMPT: '0' });
  return env;
};
const runIn = (env, cmd, args, cwd) => spawnSync(cmd, args, { cwd, env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 180000, maxBuffer: 1 << 26 });
const put = (root, rel, data) => { const p = path.join(root, ...rel.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); };
{
  if (H === null) check('view controls need the helper', false, NOT_YET('tests/helpers/v320-amendments.mjs', LH.err));
  else {
    const cfg = { records: GOOD.records, forward: GOOD.forward, pins: Object.fromEntries(SYN_FILES.map((f) => [f, sha(SYN_BASE[f])])), newFiles: ['tests/helpers/new.mjs'] };
    const files320 = { ...GOOD.actual, 'scripts/lib.mjs': 'export const a = 1;\n', 'tests/helpers/new.mjs': 'export const n = 1;\n' };
    const baseMap = new Map([...SYN_FILES.map((f) => [f, sha(SYN_BASE[f])]), ['scripts/lib.mjs', sha('export const a = 1;\n')]]);
    const mkView = (label, mutate = (f) => f) => { const d = scratchDir(label); const files = mutate({ ...files320 }); for (const [rel, text] of Object.entries(files)) put(d, rel.startsWith('@root/') ? rel.slice(6) : `project-setup/${rel}`, text); return d; };
    const compare = (d) => { const got = new Map(); const walk = (dir, rel) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const r = rel === '' ? e.name : `${rel}/${e.name}`; if (e.isDirectory()) walk(path.join(dir, e.name), r); else got.set(r, sha(fs.readFileSync(path.join(dir, e.name)))); } }; walk(path.join(d, 'project-setup'), ''); try { got.set('@root/TODO.md', sha(fs.readFileSync(path.join(d, 'TODO.md')))); } catch { /* absent */ } const want = new Map([...baseMap].map(([k, v]) => [k, v])); return { extra: [...got.keys()].filter((k) => !want.has(k)).sort(), missing: [...want.keys()].filter((k) => !got.has(k)).sort(), changed: [...want.keys()].filter((k) => got.has(k) && got.get(k) !== want.get(k)).sort() }; };
    { const d = mkView('view-good'); const r = attempt(() => H.to310Repo(d, cfg)); check('view control: to310Repo on a copy of the synthetic 3.2.0 tree reverses every amended file to the pinned 3.1.0 bytes and removes exactly the new file', !failedAttempt(r) && JSON.stringify(compare(d)) === JSON.stringify({ extra: [], missing: [], changed: [] }), failedAttempt(r) ? r : compare(d)); }
    { const d = mkView('view-alt', (f) => ({ ...f, 'README.md': f['README.md'].replace('Version 3.2.0 here.', 'Version 3.2.1 here.') })); check('view control: to310Repo on a copy with an altered amendment throws', failedAttempt(attempt(() => H.to310Repo(d, cfg))), 'did not throw'); }
    { const d = mkView('view-ext', (f) => ({ ...f, 'references/a.md': `${f['references/a.md']}An unrecorded extra line.\n` })); check('view control: an unrecorded line in an amended file makes to310Repo throw (the reversal is not the pinned 3.1.0 bytes)', failedAttempt(attempt(() => H.to310Repo(d, cfg))), 'did not throw'); }
    { const d = mkView('view-unrec', (f) => ({ ...f, 'scripts/lib.mjs': 'export const a = 2;\n' })); const r = attempt(() => H.to310Repo(d, cfg)); check('view control: an unrecorded edit in an unamended file survives to310Repo and shows as changed', !failedAttempt(r) && JSON.stringify(compare(d).changed) === '["scripts/lib.mjs"]', failedAttempt(r) ? r : compare(d)); }
    { const d = mkView('view-stray', (f) => ({ ...f, 'RELEASE-NOTES-3.2.1.md': 'x\n' })); const r = attempt(() => H.to310Repo(d, cfg)); check('view control: a stray RELEASE-NOTES-3.2.1.md survives to310Repo and shows as extra', !failedAttempt(r) && JSON.stringify(compare(d).extra) === '["RELEASE-NOTES-3.2.1.md"]', failedAttempt(r) ? r : compare(d)); }
    { const d = mkView('view-pend'); const before = fs.readFileSync(path.join(d, 'project-setup', 'README.md'), 'utf8'); const r = attempt(() => H.to310Repo(d, { ...cfg, pins: PENDING })); check('view control: with the pin table a stub to310Repo throws PIN_PENDING and writes nothing', failedAttempt(r) && /PIN_PENDING/.test(r.threw) && fs.readFileSync(path.join(d, 'project-setup', 'README.md'), 'utf8') === before, r); }
    { const d = mkView('view-miss', (f) => { const g = { ...f }; delete g['references/a.md']; return g; }); check('view control: a missing amended file makes to310Repo throw (never a silent skip)', failedAttempt(attempt(() => H.to310Repo(d, cfg))), 'did not throw'); }
    // buildView: tracked files only, an ignored file never enters, an untracked one only with includeUntracked, a Git failure is its own error.
    const tmp = scratchDir('gv'); const env = gitEnv(tmp);
    const repo = path.join(tmp, 'repo'); fs.mkdirSync(repo);
    const g = (...a) => runIn(env, 'git', a, repo);
    g('init', '-q');
    put(repo, 'project-setup/SKILL.md', '# s\n'); put(repo, 'project-setup/ignored.log', 'ignored\n'); put(repo, '.gitignore', 'project-setup/*.log\n'); put(repo, 'README.md', '# r\n'); put(repo, 'unrelated/x.txt', 'x\n'); put(repo, 'backend-standards/templates/t.md', 't\n');
    g('add', '-A'); const committed = g('commit', '-qm', 'fixture').status === 0;
    put(repo, 'project-setup/untracked.md', 'u\n');
    const viewOf = (opts, label) => { const out = path.join(tmp, label); const r = attempt(() => H.buildView({ repoRoot: repo, outDir: out, ...opts })); return failedAttempt(r) ? r : r.files; };
    const tracked = committed ? viewOf({}, 'out-tracked') : { threw: 'the synthetic repository could not be committed' };
    check('view control: buildView lists the tracked files of the copy set and copies nothing else (no unrelated directory, no .git)', !failedAttempt(tracked) && tracked.includes('project-setup/SKILL.md') && tracked.includes('README.md') && tracked.includes('backend-standards/templates/t.md') && !tracked.some((f) => f.startsWith('unrelated/') || f.startsWith('.git')) && !fs.existsSync(path.join(tmp, 'out-tracked', '.git')), tracked);
    check('view control: an ignored file in the working tree does not enter the view, with or without includeUntracked', !failedAttempt(tracked) && !tracked.includes('project-setup/ignored.log') && (() => { const v = viewOf({ includeUntracked: true }, 'out-untracked'); return !failedAttempt(v) && !v.includes('project-setup/ignored.log'); })(), tracked);
    check('view control: an untracked, not ignored file is absent from the tracked view and present with includeUntracked', !failedAttempt(tracked) && !tracked.includes('project-setup/untracked.md') && (() => { const v = viewOf({ includeUntracked: true }, 'out-untracked2'); return !failedAttempt(v) && v.includes('project-setup/untracked.md'); })(), tracked);
    check('view control: a non-repository directory is a GIT_FAILED error (reported as its own failure, never an empty view)', (() => { const plain = scratchDir('plain'); const r = attempt(() => { try { return H.buildView({ repoRoot: plain, outDir: path.join(tmp, 'out-plain') }); } catch (e) { return { threw: `${e.code}:${e.message}` }; } }); return failedAttempt(r) && /^GIT_FAILED:/.test(r.threw); })());
    check('view control: an outDir inside the repository, and a non-empty outDir, are refused', (() => { const a = attempt(() => H.buildView({ repoRoot: repo, outDir: path.join(repo, 'view') })); const full = scratchDir('full'); fs.writeFileSync(path.join(full, 'x'), 'x'); const b = attempt(() => H.buildView({ repoRoot: repo, outDir: full })); return failedAttempt(a) && failedAttempt(b); })());
    check('view control: overlay replaces only the named project-setup file, refuses a test file, a root key, a parent path and a file that is not in the view', (() => { const d = mkView('view-ov'); const realRoot = scratchDir('ovroot'); put(realRoot, 'project-setup/README.md', 'overlaid\n'); put(realRoot, 'project-setup/tests/x.mjs', 'x\n'); H.overlay(d, realRoot, ['README.md']); const ok = fs.readFileSync(path.join(d, 'project-setup', 'README.md'), 'utf8') === 'overlaid\n'; const refused = ['tests/x.mjs', '@root/TODO.md', '../x', 'nope.md'].every((p) => failedAttempt(attempt(() => H.overlay(d, realRoot, [p])))); return ok && refused; })());
  }
}
// The runner (plan 5.2 item 11 and 4.6): the compat comparison is exact by string; run 1 admits only digest pins that name an overlaid file; run 2 also the shipped-policy assertions.
{
  if (RUN === null) check('runner controls need tests/run-310-view.mjs', false, NOT_YET('tests/run-310-view.mjs', LR.err));
  else {
    const O1 = ['scripts/detect.mjs', 'scripts/migrate-security-paths.mjs']; const O2 = [...O1, 'data/secret-paths.json'];
    const pinned1 = ['c3: scripts/detect.mjs digest pin', 'c14: scripts/migrate-security-paths.mjs digest pin'];
    const same = RUN.compareCompat({ actual: [...pinned1].reverse(), pinned: pinned1, overlaid: O1 });
    check('compat control (sanity): the same set in another order is ok', same.ok === true && same.unlisted.length === 0 && same.stale.length === 0, same);
    const unl = RUN.compareCompat({ actual: [...pinned1, 'c3: a behaviour assertion about detect output'], pinned: pinned1, overlaid: O1 });
    check('compat control: an unlisted failure string is NOT accepted and is reported as unlisted', unl.ok === false && unl.unlisted.length === 1 && /behaviour assertion/.test(unl.unlisted[0]), unl);
    const stale = RUN.compareCompat({ actual: [pinned1[0]], pinned: pinned1, overlaid: O1 });
    check('compat control: a listed string that did not occur is reported as stale (a stale list is a failure)', stale.ok === false && stale.stale.length === 1 && stale.stale[0] === pinned1[1], stale);
    const near = RUN.compareCompat({ actual: [`${pinned1[0]} `], pinned: pinned1, overlaid: O1 });
    check('compat control: matching is by exact string (a trailing space is a different label)', near.ok === false && near.unlisted.length === 1, near);
    const naming = RUN.compareCompat({ actual: ['c9: the keys check of validate.mjs'], pinned: ['c9: the keys check of validate.mjs'], overlaid: O1 });
    check('compat control: a listed label that names no overlaid file is rejected in run 1 (badPins)', naming.ok === false && naming.badPins.length === 1, naming);
    const policy1 = RUN.compareCompat({ actual: ['c3: 20-entry construction of secret-paths.json'], pinned: ['c3: 20-entry construction of secret-paths.json'], overlaid: O1 });
    const policy2 = RUN.compareCompat({ actual: ['c3: 20-entry construction of secret-paths.json'], pinned: ['c3: 20-entry construction of secret-paths.json'], overlaid: O2 });
    check('compat control: an assertion about the shipped policy file is a valid pin in run 2 only (the data is overlaid there), never in run 1', policy1.ok === false && policy1.badPins.length === 1 && policy2.ok === true, { run1: policy1, run2: policy2 });
    check('compat control: a duplicate or empty pinned string is a bad pin', RUN.compareCompat({ actual: [pinned1[0]], pinned: [pinned1[0], pinned1[0]], overlaid: O1 }).badPins.length === 1 && RUN.pinnedListProblems(['', pinned1[0]], O1).length === 1);
    check('compat control: failureStringsOf takes the full set of results[].failures strings of a retained results file, unique and sorted, and refuses a malformed file', (() => { const ok = RUN.failureStringsOf(JSON.stringify({ results: [{ id: 'a', failures: ['y', 'x'] }, { id: 'b', failures: ['x'] }, { id: 'c', failures: [] }] })); const bad = [JSON.stringify({}), JSON.stringify({ results: [{ id: 'a' }] }), JSON.stringify({ results: [{ id: 'a', failures: [1] }] }), '{'].every((t) => failedAttempt(attempt(() => RUN.failureStringsOf(t)))); return JSON.stringify(ok) === '["x","y"]' && bad; })());
    check('runner control: totalsOf reads the last totals line, resultsFileOf the RESULTS line; both are null when absent', (() => { const t = RUN.totalsOf('x\n10 PASS / 2 FAIL / 1 SKIP\nnoise\n11 PASS / 0 FAIL / 0 SKIP\n'); const r = RUN.resultsFileOf('a\nRESULTS  D:/x/y.json\nb\n'); return t !== null && t.passed === 11 && t.failed === 0 && t.skipped === 0 && r === 'D:/x/y.json' && RUN.totalsOf('nothing') === null && RUN.resultsFileOf('nothing') === null; })());
    check('runner control: parseCliArgs refuses an unknown flag, a repeated flag, a missing value, a label without an overlay, a label without accept-rc1 and an unknown gate; it accepts the documented forms', (() => { const P = RUN.parseCliArgs; const refused = [['--out'], ['--out', 'a', '--out', 'b'], ['--x'], ['--out', 'a', '--label', 'l'], ['--out', 'a', '--overlay', 'scripts/detect.mjs', '--label', 'l'], ['--out', 'a', '--run', 'nope'], ['--out', 'a', '--run', 'c18,c18'], []].every((a) => P(a).ok === false); const good = P(['--out', 'a', '--overlay', 'scripts/detect.mjs', '--label', 'scripts', '--run', 'accept-rc1']); const dflt = P(['--out', 'a']); return refused && good.ok === true && good.label === 'scripts' && dflt.ok === true && JSON.stringify(dflt.run) === JSON.stringify(['release-3.1', 'c18', 'bs-doc-map']); })());
    check('runner control: outDirProblems refuses a directory inside the repository, inside the temp directory, and a non-empty one', (() => { const inRepo = RUN.outDirProblems(path.join(REPO, 'view-x')); const inTmp = RUN.outDirProblems(path.join(os.tmpdir(), 'view-x')); const full = scratchDir('fullout'); fs.writeFileSync(path.join(full, 'f'), 'x'); const nonEmpty = RUN.outDirProblems(full, { repoRoot: REPO, tmp: path.join(scratch, 'elsewhere') }); const fine = RUN.outDirProblems(path.join(scratch, 'fresh-view'), { repoRoot: REPO, tmp: path.join(scratch, 'elsewhere') }); return inRepo.some((m) => /inside the repository/.test(m)) && inTmp.some((m) => /temp directory/.test(m)) && nonEmpty.some((m) => /not empty/.test(m)) && fine.length === 0; })());
    check('runner control: the gates the runner can start are exactly release-3.1, c18, bs-doc-map and accept-rc1, run from tests/', JSON.stringify(Object.keys(RUN.GATES).sort()) === '["accept-rc1","bs-doc-map","c18","release-3.1"]' && Object.values(RUN.GATES).every((f) => /^[a-z0-9.-]+\.mjs$/.test(f)));
  }
}
// Notes, claims and acceptance engines: a valid synthetic document passes and each defect is rejected.
const NOTES_GOOD = Buffer.from([
  '# project-setup 3.2.0', '', '## Compatibility', '', 'Projects installed by 3.1.0 update in place.', '', '## What changed', '', '- Item A.', '', '## Upgrading', '',
  '1. Install 3.2.0 with install.mjs.', '2. Move the installer backup directory and its .meta.json out of the skills directory and note the path.', '3. Start a new session and confirm one active copy.',
  '4. If the project tracks files under root env/ or cert/, setup stops in Phase 0: move non-secret files out or escalate.', '5. On update, decide the two coverage rows.', '',
  '## Correction of a 3.1.0 known issue', '', 'The first known issue of 3.1.0 is corrected.', '', '## Verification', '', 'The historical gates run only through node tests/run-310-view.mjs. CI does not run them.', '',
  '## Not measured', '', '- The root-anchor claim is scoped to static rendering until D6 is recorded.', '', '## Known limitations', '', '- None.', '',
].join('\n'), 'utf8');
{
  const n = (name, text, rx) => { const q = notesProblems(Buffer.from(text, 'utf8')); check(`notes control: ${name}`, q.some((m) => rx.test(m)), q); };
  const G = NOTES_GOOD.toString('utf8');
  check('notes control: the valid synthetic notes have no problem', notesProblems(NOTES_GOOD).length === 0, notesProblems(NOTES_GOOD));
  n('a standalone 64-hex id is rejected', G.replace('- Item A.', `- Item A ${'a'.repeat(64)}.`), /hex/);
  n('a standalone 40-hex id is rejected', G.replace('- Item A.', `- Item A ${'b'.repeat(40)}.`), /hex/);
  n('a personal path is rejected', G.replace('- Item A.', '- Item A C:\\Users\\someone\\x.'), /personal path/);
  n('a POSIX personal path is rejected', G.replace('- Item A.', '- Item A /home/someone/x.'), /personal path/);
  n('a CR is rejected', G.replace('## What changed', '## What changed\r'), /CR/);
  n('a non-ASCII character is rejected', G.replace('- Item A.', '- Item \u00e9.'), /non-ASCII/);
  n('a wrong title is rejected', G.replace('# project-setup 3.2.0', '# project-setup 3.1.0'), /title/);
  n('two final LFs are rejected', `${G}\n`, /final LF/);
  n('a missing Upgrading section is rejected', G.replace('## Upgrading', '## Upgrade notes'), /Upgrading/);
  n('Upgrading without five numbered steps is rejected', G.replace('5. On update, decide the two coverage rows.\n', ''), /numbered steps 1 to 5/);
  n('numbered steps out of order are rejected', G.replace('2. Move', '3. Move'), /numbered steps 1 to 5/);
  n('the backup step without the .meta.json is rejected', G.replace('and its .meta.json ', ''), /installer backup/);
  n('the backup step that does not name the skills directory is rejected', G.replace('out of the skills directory', 'somewhere'), /installer backup/);
  n('the tracked env/ and cert/ step without the Phase 0 stop is rejected', G.replace('setup stops in Phase 0', 'setup warns'), /Phase 0 stop/);
  n('the tracked step naming only env/ is rejected', G.replace('under root env/ or cert/', 'under root env/'), /Phase 0 stop/);
  n('no coverage step is rejected', G.replace('decide the two coverage rows', 'decide the rows'), /coverage/);
  n('a missing Not measured section is rejected', G.replace('## Not measured', '## Unmeasured'), /Not measured/);
  n('an empty Not measured list is rejected', G.replace('- The root-anchor claim is scoped to static rendering until D6 is recorded.', 'Nothing.'), /holds no list/);
  n('a Not measured section without the root-anchor scope is rejected', G.replace('root-anchor claim is scoped to static rendering', 'claim is open'), /root-anchor/);
  n('a verification section that does not name the view runner is rejected', G.replace('node tests/run-310-view.mjs', 'the runner'), /view runner/);
  n('a verification section that does not say CI does not run the gates is rejected', G.replace(' CI does not run them.', ''), /CI/);
  n('no compatibility heading is rejected', G.replace('## Compatibility', '## Overview'), /compatibility/);
  n('no limitations heading is rejected', G.replace('## Known limitations', '## Misc'), /limitations/);
  n('no statement about the 3.1.0 known issue is rejected', G.replace('## Correction of a 3.1.0 known issue', '## Corrections').replace('The first known issue of 3.1.0 is corrected.', 'Done.'), /known issue/);
  check('notes control: a BOM is rejected', notesProblems(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), NOTES_GOOD])).some((m) => /BOM/.test(m)));
  check('notes control: an empty or unreadable buffer is rejected', notesProblems(Buffer.alloc(0)).length > 0 && notesProblems(null).length > 0);
}
{
  const ACC_GOOD = 'Install the candidate; the explicit directories are `$env:USERPROFILE\\.claude\\skills` and `$env:USERPROFILE\\.agents\\skills`.\n\nUse tests/live/bs-doc-map.mjs to initialize a workspace. Preserved files go to D:\\ps-live\\preserved\\x.\n';
  check('acceptance control: the valid synthetic document has no problem (a D:\\ps-live path is not a user-profile path)', accProblems(ACC_GOOD).length === 0, accProblems(ACC_GOOD));
  const actl = (name, text, rx) => { const q = accProblems(text); check(`acceptance control: ${name}`, q.some((m) => rx.test(m)), q); };
  actl('a third install directory is rejected', `${ACC_GOOD}Also install into $env:USERPROFILE\\.codex\\skills\n`, /other than the two skill directories/);
  actl('a bare $env:USERPROFILE is rejected', `${ACC_GOOD}Work in $env:USERPROFILE\n`, /other than the two skill directories/);
  actl('a sibling that only shares the prefix is rejected', `${ACC_GOOD}Do not use $env:USERPROFILE\\.claude\\skills-old\n`, /other than the two skill directories/);
  actl('%USERPROFILE% is rejected', `${ACC_GOOD}See %USERPROFILE%\\.claude\\skills\n`, /home-relative spelling/);
  actl('$HOME is rejected', `${ACC_GOOD}See $HOME/.claude/skills\n`, /home-relative spelling/);
  actl('a tilde path is rejected', `${ACC_GOOD}See ~/.claude/skills\n`, /home-relative spelling/);
  actl('a drive-letter personal path is rejected', `${ACC_GOOD}See C:\\Users\\someone\\skills\n`, /personal path/);
  actl('a POSIX personal path is rejected', `${ACC_GOOD}See /home/someone/skills\n`, /personal path/);
  actl('a document naming only the claude directory is rejected', ACC_GOOD.replace(' and `$env:USERPROFILE\\.agents\\skills`', ''), /does not name \$env:USERPROFILE\\\.agents/);
  actl('a document naming only the agents directory is rejected', ACC_GOOD.replace('`$env:USERPROFILE\\.claude\\skills` and ', ''), /does not name \$env:USERPROFILE\\\.claude/);
  actl('a document that does not name the live helper is rejected', ACC_GOOD.replace('bs-doc-map.mjs', 'the helper'), /live helper/);
  check('acceptance control: a path inside one of the two directories is accepted', accProblems(`${ACC_GOOD}The copy lands in $env:USERPROFILE\\.claude\\skills\\project-setup\n`).length === 0);
}
const GOOD_CLAIMS = () => ({
  VERSION: '3.2.0\n',
  SKILL: '---\nname: x\n---\n\n# project-setup 3.2.0\n\n## Workflow\n',
  PSREADME: '# project-setup 3.2.0 - skill source\n\n**Release 3.2.0.** See RELEASE-NOTES-3.2.0.md for compatibility.\n\n## Test first\n\nnode tests/release-3.2.0.test.mjs, node tests/v320.test.mjs, node tests/bs-doc-map.test.mjs and node tests/run-310-view.mjs for the historical gates.\n\n## Local candidate release\n\nrequires or creates project-setup-v3.2.0 in the distribution repository.\n\nnode install/release.mjs --tag project-setup-v3.2.0 --out <unused-directory>\n',
  CHANGELOG: '# Changelog\n\n## 3.2.0\n\nFixes.\n\n## 3.1.0\n\nMapping.\n',
  ROOTREADME: '`project-setup` (3.2.0, shared by Claude Code and Codex) is **not**\nThis installs `project-setup` 3.2.0 for both tools.\n`project-setup/RELEASE-NOTES-3.2.0.md` section "Rollback".\n|-- project-setup/   general-purpose - shared Claude Code + Codex setup (3.2.0, own installer and tests)\nHistorical: project-setup/RELEASE-NOTES-3.1.0.md.\n',
  TREE: '|-- project-setup/   skill 3 - shared Claude Code + Codex agent scaffolding (3.2.0)\n(`project-setup/VERSION` is `3.2.0`) with its own layout\n',
  MODES: `before\n${MODES_OBSERVATION}\nafter\n${MD320_1}\n`,
});
{
  const ok = claimsProblems(GOOD_CLAIMS());
  check('claims control: the valid synthetic public claims have no problem', ok.length === 0, ok.map((q) => q.msg));
  const cctl = (name, mutate, area, rx) => { const t = GOOD_CLAIMS(); mutate(t); const p = claimsProblems(t); check(`claims control: ${name}`, p.some((q) => q.area === area && rx.test(q.msg)), p.map((q) => `${q.area}: ${q.msg}`).slice(0, 4)); };
  cctl('VERSION 3.1.0 is rejected', (t) => { t.VERSION = '3.1.0\n'; }, 'VERSION', /VERSION/);
  cctl('VERSION without the final LF is rejected', (t) => { t.VERSION = '3.2.0'; }, 'VERSION', /VERSION/);
  cctl('a SKILL title still at 3.1.0 is rejected', (t) => { t.SKILL = t.SKILL.replace('# project-setup 3.2.0', '# project-setup 3.1.0'); }, 'SKILL', /title/);
  cctl('a README title at 3.1.0 is rejected', (t) => { t.PSREADME = t.PSREADME.replace('# project-setup 3.2.0', '# project-setup 3.1.0'); }, 'PSREADME', /title/);
  cctl('a README opening that still cites the 3.1.0 notes is rejected', (t) => { t.PSREADME = t.PSREADME.replace('RELEASE-NOTES-3.2.0.md', 'RELEASE-NOTES-3.1.0.md'); }, 'PSREADME', /opening release sentence/);
  for (const g of ['release-3.2.0.test.mjs', 'v320.test.mjs', 'run-310-view.mjs', 'bs-doc-map.test.mjs']) cctl(`a README that does not name ${g} is rejected`, (t) => { t.PSREADME = t.PSREADME.replace(g, 'x'); }, 'PSREADME', new RegExp(g.replace(/\./g, '\\.')));
  cctl('a local release section still on the 3.1.0 tag is rejected', (t) => { t.PSREADME = t.PSREADME.replace(/project-setup-v3\.2\.0/g, 'project-setup-v3.1.0'); }, 'PSREADME', /3\.2\.0 tag token/);
  cctl('a changelog without the 3.2.0 entry first is rejected', (t) => { t.CHANGELOG = t.CHANGELOG.replace('## 3.2.0', '## 3.1.9'); }, 'CHANGELOG', /3\.2\.0/);
  cctl('a changelog that lost the 3.1.0 entry is rejected', (t) => { t.CHANGELOG = '# Changelog\n\n## 3.2.0\n\nFixes.\n'; }, 'CHANGELOG', /3\.1\.0 entry/);
  cctl('a root README that keeps the stale introduction claim is rejected', (t) => { t.ROOTREADME += '`project-setup` (3.1.0, shared by Claude Code and Codex) is **not**\n'; }, 'ROOTREADME', /stale current 3\.1\.0 claim/);
  cctl('a root README that keeps the stale install claim is rejected', (t) => { t.ROOTREADME += 'This installs `project-setup` 3.1.0 for both tools.\n'; }, 'ROOTREADME', /stale current 3\.1\.0 claim/);
  cctl('a root README that keeps the stale layout line is rejected', (t) => { t.ROOTREADME += '|-- project-setup/   general-purpose (3.1.0, own installer and tests)\n'; }, 'ROOTREADME', /stale current 3\.1\.0 claim/);
  cctl('a root README that does not cite the 3.2.0 notes is rejected', (t) => { t.ROOTREADME = t.ROOTREADME.replace('RELEASE-NOTES-3.2.0.md', 'RELEASE-NOTES-3.1.0.md'); }, 'ROOTREADME', /RELEASE-NOTES-3\.2\.0/);
  cctl('a project tree still at 3.1.0 is rejected', (t) => { t.TREE = t.TREE.replace(/3\.2\.0/g, '3.1.0'); }, 'TREE', /3\.2\.0|stale/);
  cctl('a modes file that lost the dated 3.1.0 observation is rejected', (t) => { t.MODES = t.MODES.replace(MODES_OBSERVATION, 'gone'); }, 'MODES', /dated 3\.1\.0/);
  cctl('a modes file without the [MD320_1] observation is rejected', (t) => { t.MODES = t.MODES.replace(MD320_1, ''); }, 'MODES', /MD320_1/);
  cctl('a duplicated [MD320_1] observation is rejected', (t) => { t.MODES += `${MD320_1}\n`; }, 'MODES', /MD320_1/);
  cctl('the [MD320_1] observation placed before the dated statement is rejected', (t) => { t.MODES = `${MD320_1}\n${MODES_OBSERVATION}\n`; }, 'MODES', /not after/);
}

// ===================================================================================================== C. actual obligations ====
const claims = { VERSION: actualText('VERSION'), SKILL: actualText('SKILL.md'), PSREADME: actualText('README.md'), CHANGELOG: actualText('CHANGELOG.md'), ROOTREADME: actualText('@root/README.md'), TREE: actualText('@root/.ai/context/project-tree.md'), MODES: actualText('references/modes.md') };
needPins('every 3.1.0 normative line (a line holding MUST, SHOULD or MAY) of SKILL.md, references/*, assets/agents/*, assets/templates/* and data/* is still present (16-hex line digests pinned in this spec, D-4)', { NORMATIVE_LINES }, () => {
  const lost = Object.entries(NORMATIVE_LINES).map(([k, digests]) => { const have = new Set(lf(actualText(k)).split('\n').map(lineDigest)); return [k, digests.filter((d) => !have.has(d)).length]; }).filter(([, n]) => n > 0);
  return [Object.keys(NORMATIVE_LINES).every(NORMATIVE_SCOPE) && lost.length === 0, lost];
});
// The root TODO (AC-C3-1, AC-A6-1): the 3.1.0 bytes plus exactly six records (the plan's five and TD320_6 of the fix round, dispositions of review 1, SR-01); lines 25 to 32 byte-identical; the texts present once.
{
  const todo = lf(actualText('@root/TODO.md'));
  const lines = todo.split('\n');
  check('AC-C3-1: @root/TODO.md lines 25 to 32 (the reviewer-residuals item) are byte-identical to the 3.1.0 lines (the pinned digest)', lines.length >= 33 && sha(`${lines.slice(24, 32).join('\n')}\n`) === TODO_RESIDUAL_SHA, lines.length >= 33 ? sha(`${lines.slice(24, 32).join('\n')}\n`) : 'the file is too short');
  check('AC-C3-1: the helper holds exactly the six @root/TODO.md records TD320_1 to TD320_6, TD320_2 is the only replacement among them and TD320_6 is an insertion', H !== null && hasRecords && JSON.stringify(Object.entries(H.AM320).filter(([, r]) => r.file === '@root/TODO.md').map(([id]) => id).sort()) === JSON.stringify(TODO_RECORDS) && TODO_RECORDS.length === 6 && JSON.stringify(Object.entries(H.AM320).filter(([, r]) => r.file === '@root/TODO.md' && r.old !== '').map(([id]) => id)) === JSON.stringify(TODO_EXCEPTIONS) && H.AM320.TD320_6?.old === '' && H.AM320.TD320_6?.neu !== '', H === null ? NOT_YET('helper') : hasRecords ? Object.entries(H.AM320).filter(([, r]) => r.file === '@root/TODO.md').map(([id]) => id) : `${PENDING}: AM320 is empty`);
  const S = squash(todo);
  const T = {
    TD320_1: 'Status 2026-11-22: project-setup 3.2.0 ships both fixes as text only (the money-severity rule of the canonical reviewer and the delegated-agent launch bullet); neither is measured. This item stays until measurements D1 and D2 of docs/plans/2026-11-22-project-setup-v3.2.0-plan.md are recorded.',
    TD320_2: 'The 3.1.0 live acceptance (2026-11-14 to 2026-11-22) exercised the agents on both hosts and PS then BS (merge branch only). Not exercised: the BS overwrite branch and Codex PS rows.',
    TD320_3: 'backend-standards stamp behaviour differs between two existing-project runs. BS 3.1.0 wrote .backend-standards.json on the PS-first fixture and not on the BS existing-project fixture (2026-11-14). The existing-project procedure is documented as writing no stamp. Decide which is intended and make the skill do it every time; project-setup accepts both signals.',
    TD320_4: 'project-setup installer backups live inside the skills directory. 3.2.0 makes detect report them and documents the manual move. Moving the backup location out of host discovery is a candidate for the next minor and needs the recorded skill-discovery probe (D8 of the 3.2.0 plan) first.',
    TD320_6: 'project-setup `apply.mjs prepare` accepts a draft that replaces an edited managed block without `--approve-user-content` (the normal `--approved-plan` approval at commit still applies): `onlyAddsBlocks` in `apply.mjs` compares only the text outside blocks, so the 3.2.0 block-edit protection is instruction-level only. A machine check needs a planned `apply.mjs` change and a deliberate update of the c16 case that pins today\'s behaviour.',
  };
  for (const [id, text] of Object.entries(T)) check(`AC-C3-1: the ${id} text of plan C3 is present exactly once in @root/TODO.md${id === 'TD320_3' ? ' (AC-A6-1: the stamp-behaviour entry)' : ''}`, S.split(text).length === 2, S.split(text).length - 1);
  check('AC-C3-1: the TD320_2 replacement removed the 3.1.0 sentence "Not exercised: the agents themselves, Codex, or PS then BS."', !S.includes('Not exercised: the agents themselves, Codex, or PS then BS.'));
  check('AC-C3-1: the TD320_5 entry lists the 3.1.0 rows that were not measured (the entry names "3.1.0 rows not measured")', /project-setup 3\.1\.0 rows not measured/.test(S) && S.split('project-setup 3.1.0 rows not measured').length === 2, undefined);
  check('AC-C3-1: the TD320_6 entry (the recorded deviation of AC-A2-2: apply.mjs onlyAddsBlocks) is the last item of "Needs manual review", after the TD320_5 entry and before "## Missing information"', (() => { const f6 = todo.indexOf('- project-setup `apply.mjs prepare` accepts a draft that replaces an edited managed block'); const f5 = todo.indexOf('- project-setup 3.1.0 rows not measured'); const miss = todo.indexOf('\n## Missing information'); return f6 > 0 && f5 > 0 && miss > 0 && f5 < f6 && f6 < miss && todo.split('- project-setup `apply.mjs prepare` accepts a draft that replaces an edited managed block').length === 2 && /^\n?(?:  [^\n]*\n)+\n## Missing information/.test(todo.slice(todo.indexOf('\n', f6))); })(), { tD6: todo.indexOf('- project-setup `apply.mjs prepare`'), tD5: todo.indexOf('- project-setup 3.1.0 rows not measured') });
  check('AC-C3-1: the TD320_1 status sentence sits inside the reviewer-residuals item (directly after line 32, before the next item)', (() => { const a = lines.findIndex((l) => l.startsWith('- **`project-setup` 3.0.0 reviewer residuals.**')); const next = lines.findIndex((l, i) => i > a && /^- \*\*/.test(l)); const at = lines.findIndex((l) => l.includes('Status 2026-11-22')); return a === 24 && at > 31 && next > at; })(), undefined);
}
// The reviewer and the templates: insertion points and the line caps (AC-B1-1, AC-B2-1; behaviour is tests/v320.test.mjs).
{
  const RV320_1 = ['Money and state integrity are the exception. Code in the reviewed change that breaks a', 'critical rule in AGENTS.md, whatever its wording, or a MUST-level rule in the documents', 'it names or in the project review rules, for a money, balance, payment, points or limit', 'flow is a finding whatever its current reachability: for example a read-modify-write', 'without a lock or atomic statement, or a retry without proven idempotency. You MUST rate', 'it HIGH or CRITICAL. A missing caller, route or funding path MUST NOT lower that severity', 'or move it to Open questions, because such code is one wiring change away from moving', 'money and the change that wires it is rarely reviewed against this code\'s locking.', 'State the missing reachability in the Scenario (the interleaving once the code is', 'called) and in Confidence. Classify it **likely risk** while nothing calls it and', '**confirmed bug** when something does. For these flows this paragraph overrides the', 'reachability rule above, the "caller that does not exist" sentence below, the', 'open-question rule of section 4 as far as it concerns reachability, and the verdict', 'rule of section 5 as stated there. A project rule MUST NOT relax this paragraph; on', 'conflict follow this paragraph and report the conflict.'].join('\n');
  const RV320_2 = ['   A money or state-integrity finding rated HIGH or CRITICAL under the exception in', '   section 2 makes the verdict **block**, including when it is classified likely risk.'].join('\n');
  const AT320_1 = ['Text between `<!-- project-setup:begin ... -->` and `<!-- project-setup:end ... -->`', 'markers in AGENTS.md, CLAUDE.md and .gitignore is managed by project-setup. Every', 'agent, including a retained project agent that does not load a canonical definition,', 'MUST NOT add, remove or move these markers, and MUST change text inside a block only', 'when a code change makes that text wrong. It MUST then name the file and the block', 'id in its output, because the next project-setup update shows that edit for a keep,', 'take-new or merge decision and can otherwise replace it.'].join('\n');
  const AT320_2 = ['When you delegate to `reviewer` or `docs-sync`, state in every brief the session\'s', 'original start directory, the repository root and the current directory. Do not invent', 'a start directory you were not given; say that it is unknown instead.'].join('\n');
  const CT320_1 = ['- For a delegated agent this bullet replaces the directory comparison above. A delegated', '  agent\'s context or brief MAY show the directory its parent was in rather', '  than the session\'s original start directory. As a delegated agent you MUST treat the', '  original start directory as unknown unless the brief states it. You MUST NOT refuse on', '  your own working directory alone, and when the brief does not state the original start', '  directory you MUST state in your output that it was not given. This prevents a false', '  launch refusal after the parent changed directory inside a root-started session. If', '  the brief states an original start directory strictly below the selected rule\'s', '  directory, the refusal above applies unchanged. The parent session stays bound by', '  this rule.'].join('\n');
  const rev = lf(actualText('assets/agents/reviewer.md')); const cl = lf(actualText('assets/templates/CLAUDE.md')); const ag = lf(actualText('assets/templates/AGENTS.md'));
  const rv310 = rev.replace(`${RV320_1}\n\n`, '').replace(`${RV320_2}\n`, ''); const cl310 = cl.replace(`${CT320_1}\n`, ''); const ag310 = ag.replace(`\n${AT320_2}\n\n${AT320_1}\n`, '');
  check('AC-B1-1: [RV320_1] is present once inside section 2, before the "Plan coverage" paragraph, and [RV320_2] once, directly after the Verdict line at the end of the file', count(rev, RV320_1) === 1 && rev.indexOf(RV320_1) > rev.indexOf('## 2. What counts as a finding') && rev.indexOf(RV320_1) < rev.indexOf('Plan coverage is not a correctness boundary.') && count(rev, RV320_2) === 1 && rev.indexOf(RV320_2) > rev.indexOf('4. Verdict: **block**') && rev.endsWith(`${RV320_2}\n`), { rv1: count(rev, RV320_1), rv2: count(rev, RV320_2) });
  check('AC-B1-1: without the two paragraphs the reviewer is the 3.1.0 bytes (digest 696f86bc...), so nothing else changed', sha(rv310) === SHA310.reviewer, sha(rv310));
  check('AC-B1-1: every 3.1.0 reviewer line holding MUST, SHOULD or MAY is still present', rv310.split('\n').filter((l) => KEYWORD.test(l)).every((l) => rev.includes(l)));
  check('AC-B2-1: [CT320_1] is present once inside the claude block (after the line "This prevents false launch refusals..."), and [AT320_2] and [AT320_1] once in the agents block', (() => { const pc = parseBlocks(cl); const pa = parseBlocks(ag); const cb = pc.blocks.find((b) => b.id === 'claude'); const ab = pa.blocks.find((b) => b.id === 'agents'); return cb !== undefined && ab !== undefined && count(lf(cb.inner), CT320_1) === 1 && lf(cb.inner).includes(`  This prevents false launch refusals without treating unknown host state as verified.\n${CT320_1}\n`) && count(lf(ab.inner), AT320_2) === 1 && count(lf(ab.inner), AT320_1) === 1 && lf(ab.inner).indexOf(AT320_2) < lf(ab.inner).indexOf(AT320_1); })(), undefined);
  check('AC-B2-1: every 3.1.0 line of the claude template is still present byte for byte (the 3.1.0 bytes, digest 5bb1d5ed..., without the one bullet), with one begin and one end marker', sha(cl310) === SHA310.claude && count(cl, '<!-- project-setup:begin id=claude') === 1 && count(cl, '<!-- project-setup:end id=claude') === 1, sha(cl310));
  check('AC-B2-1 (A2): without the two paragraphs the AGENTS.md template is the 3.1.0 bytes (digest 616a26a5...), parses to six blocks with no marker error, and is at most 150 lines', sha(ag310) === SHA310.agents && parseBlocks(ag).errors.length === 0 && parseBlocks(ag).blocks.length === 6 && ag.replace(/\n$/, '').split('\n').length <= 150, { sha: sha(ag310), blocks: parseBlocks(ag).blocks.length, lines: ag.replace(/\n$/, '').split('\n').length });
  check('AC-B2-1: the CLAUDE.md template is at most 200 lines (scripts/validate.mjs:365)', cl.replace(/\n$/, '').split('\n').length <= 200, cl.replace(/\n$/, '').split('\n').length);
}
// The shipped policy data (AC-A4-2): strengthening only, by the real readSecurityPolicy.
{
  const dataText = actualText('data/secret-paths.json');
  const prior = attempt(() => JSON.parse(fs.readFileSync(path.join(SKILL, 'tests', 'fixtures', 'v320-policy-3.1.0.json'), 'utf8')));
  const priorBytes = attempt(() => fs.readFileSync(path.join(SKILL, 'tests', 'fixtures', 'v320-policy-3.1.0.json')));
  const data = attempt(() => JSON.parse(dataText));
  const idOf = (e) => JSON.stringify([e.anchor ?? (String(e.glob).startsWith('**/') ? 'any' : 'root'), String(e.glob).toLowerCase()]);
  const NEW_IDS = [JSON.stringify(['root', 'env/**']), JSON.stringify(['root', 'cert/**'])];
  const rp = failedAttempt(data) ? data : attempt(() => readSecurityPolicy(data));
  check('AC-A4-2: the 3.1.0 policy fixture is the pinned prior file (its normalized hash is the PRIOR_SHIPPED digest)', !failedAttempt(priorBytes) && normalizedHash(priorBytes) === PRIOR_POLICY_SHA, failedAttempt(priorBytes) ? priorBytes : normalizedHash(priorBytes));
  check('AC-A4-2: the shipped data/secret-paths.json passes the real readSecurityPolicy with sourceSchema 1 (a schema-1 file, so the installer-side derivation stays valid)', !failedAttempt(rp) && rp.sourceSchema === 1, failedAttempt(rp) ? rp : rp.sourceSchema);
  check('AC-A4-2: its identity set is the 3.1.0 set plus exactly ["root","env/**"] and ["root","cert/**"], each once', !failedAttempt(data) && !failedAttempt(prior) && (() => { const have = data.patterns.map(idOf); const old = prior.patterns.map(idOf); return have.length === old.length + 2 && new Set(have).size === have.length && NEW_IDS.every((x) => have.includes(x)) && JSON.stringify(have.filter((x) => !NEW_IDS.includes(x))) === JSON.stringify(old); })(), failedAttempt(data) ? data : data.patterns.length);
  check('AC-A4-2: the 20 old entries are deep-equal to the 3.1.0 entries and in the same relative order (nothing weakened, dropped, re-anchored or reworded)', !failedAttempt(data) && !failedAttempt(prior) && JSON.stringify(data.patterns.filter((e) => !NEW_IDS.includes(idOf(e)))) === JSON.stringify(prior.patterns), undefined);
  check('AC-A4-2: the two new entries are root-anchored directory entries (no "**/" prefix, so config code under src/ is not matched)', !failedAttempt(data) && data.patterns.filter((e) => NEW_IDS.includes(idOf(e))).length === 2 && data.patterns.filter((e) => NEW_IDS.includes(idOf(e))).every((e) => e.kind === 'dir' && !String(e.glob).startsWith('**/') && e.anchor === undefined), failedAttempt(data) ? data : undefined);
}
// The installer-side contract reached from the release gate: the A4 and A5 behaviour itself is tests/v320.test.mjs; here only the facts the release depends on.
{
  const migrate = actualText('scripts/migrate-security-paths.mjs');
  check('AC-A4-6 (static): PRIOR_SHIPPED in scripts/migrate-security-paths.mjs is named v3.0.0, carries the pinned digest, and adds exactly the two identities (a third identity would be an unreviewed protection change)', migrate.includes('PRIOR_SHIPPED') && migrate.includes(PRIOR_POLICY_SHA) && /v3\.0\.0/.test(migrate) && count(migrate, 'PRIOR_SHIPPED') >= 2, migrate.includes('PRIOR_SHIPPED') ? undefined : NOT_YET('PRIOR_SHIPPED in scripts/migrate-security-paths.mjs'));
  const detect = actualText('scripts/detect.mjs');
  check('AC-A5 (static): scripts/detect.mjs defines scanInstallerLeftovers and emits installerBackups; the file reads names and the existence of SKILL.md only (no readFileSync of a directory entry)', /scanInstallerLeftovers/.test(detect) && /installerBackups/.test(detect), /scanInstallerLeftovers/.test(detect) ? undefined : NOT_YET('scanInstallerLeftovers in scripts/detect.mjs'));
  check('AC-A5 (static): the 3.2.0 detect keeps the installs and installConflicts output (both names still present)', /installConflicts/.test(detect) && /\binstalls\b/.test(detect));
}

// ================================================================================================= D. version, claims, notes ====
{
  const p = claimsProblems(claims);
  check('D: VERSION, headings and every current public claim say 3.2.0; the 3.1.0 entry and observation stay (historical claims are not rewritten)', p.length === 0, p.map((q) => `${q.area}: ${q.msg}`).slice(0, 8));
  const notes = attempt(() => fs.readFileSync(path.join(SKILL, NOTES320)));
  const np = failedAttempt(notes) ? [`${NOTES320} is missing`] : notesProblems(notes);
  check(`D: ${NOTES320} keeps the notes contract (title, no 40- or 64-hex id, LF, no BOM, ASCII, no personal path, Upgrading with the numbered backup step and the tracked env/ and cert/ note, verification commands, Not measured, limitations)`, np.length === 0, failedAttempt(notes) ? NOT_YET(NOTES320) : np);
  check('D: RELEASE-NOTES-3.1.0.md (historical) is not edited: it is the pinned 3.1.0 bytes', (() => { if (BASE_FILES === PENDING) return false; const b = attempt(() => fs.readFileSync(path.join(SKILL, 'RELEASE-NOTES-3.1.0.md'))); return Buffer.isBuffer(b) && sha(b) === BASE_FILES['RELEASE-NOTES-3.1.0.md']; })(), BASE_FILES === PENDING ? `${PENDING}: BASE_FILES not written yet (session 2)` : undefined);
  check('AC-C1-2: the live acceptance document passes the user-path rule (only the two $env:USERPROFILE skill directories; D:\\ps-live paths are not user-profile paths)', accProblems(actualText('tests/live/BS-DOC-MAP-ACCEPTANCE.md')).length === 0, accProblems(actualText('tests/live/BS-DOC-MAP-ACCEPTANCE.md')));
  check('D: no version.json stamp exists (project-setup uses VERSION)', !fs.existsSync(path.join(SKILL, 'version.json')) && !fs.existsSync(path.join(SKILL, 'install', 'version.json')));
}

// =========================================================================================== E. everything else is unchanged ====
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
const SK_NOW = attempt(() => enumerate(SKILL));
{
  const now = failedAttempt(SK_NOW) ? null : SK_NOW;
  needPins('E: the project-setup file set (tests included) is the 3.1.0 set plus exactly the eight new files of plan 4.2, and every unamended file is its pinned 3.1.0 bytes (historical tests, helpers, fixtures, both runners and all unchanged skill files)', { BASE_FILES }, () => {
    const base = new Map(Object.entries(BASE_FILES).filter(([k]) => !k.startsWith('@root/')));
    const tp = now === null ? null : treeProblems(now, base, NEW_FILES, AMENDABLE.filter((k) => !k.startsWith('@root/')));
    return [tp !== null && tp.extra.length === 0 && tp.missing.length === 0 && tp.changed.length === 0, tp === null ? SK_NOW : tp];
  });
  needPins('E: the three root files that are not amended by name stay pinned and the root files amended are covered by section A (the 3.1.0 pin table holds exactly the three root keys)', { BASE_FILES }, () => [JSON.stringify(Object.keys(BASE_FILES).filter((k) => k.startsWith('@root/')).sort()) === JSON.stringify([...AMEND_ROOT].sort()), Object.keys(BASE_FILES).filter((k) => k.startsWith('@root/'))]);
  needPins(`E: ${NOTES320} is the pinned 3.2.0 bytes and no other new non-test file is byte-pinned (the helper, the three fixtures, the runner and the two specs are test infrastructure, pinned by set membership only: their own bytes would be circular)`, { NOW_FILES }, () => [now !== null && now.get(NOTES320) === NOW_FILES[NOTES320] && !Object.keys(NOW_FILES).some((k) => NEW_FILES.filter((f) => f !== NOTES320).includes(k)), undefined]);
  check('E: all eight new files of plan 4.2 exist', now !== null && NEW_FILES.every((f) => now.has(f)), now === null ? SK_NOW : NEW_FILES.filter((f) => !now.has(f)));
  needPins('E: nothing was added to the installed payload: every file the tree holds under SKILL.md, VERSION, CHANGELOG.md, references/, assets/, data/ and scripts/ is a 3.1.0 file (the notes and the tests are outside INCLUDE)', { BASE_FILES }, () => { const added = now === null ? null : [...now.keys()].filter((k) => INCLUDE.some((i) => k === i || k.startsWith(`${i}/`)) && !has(BASE_FILES, k)); return [added !== null && added.length === 0, added === null ? SK_NOW : added]; });
}

// ================================================================================================ F. install and release build ====
const isoEnv = (tmp) => {
  const home = path.join(tmp, 'home'); fs.mkdirSync(home, { recursive: true });
  const hooks = path.join(tmp, 'hooks-empty'); fs.mkdirSync(hooks, { recursive: true });
  const gitconfig = path.join(tmp, 'gitconfig');
  fs.writeFileSync(gitconfig, `[user]\n\tname = Fixture\n\temail = fixture@example.invalid\n[core]\n\tautocrlf = false\n\thooksPath = ${hooks.replace(/\\/g, '/')}\n[commit]\n\tgpgsign = false\n[tag]\n\tgpgsign = false\n`);
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^(GIT_|CLAUDE|CODEX_HOME$)/i.test(k) && typeof v === 'string') env[k] = v;
  Object.assign(env, { HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: path.join(tmp, 'claude-config'), CODEX_HOME: path.join(tmp, 'codex-home'), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: gitconfig, GIT_TERMINAL_PROMPT: '0' });
  return { env, home };
};
const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
{
  const tmp = scratchDir('install');
  const { env, home } = isoEnv(tmp);
  const inst = path.join(SKILL, 'install', 'install.mjs');
  const cd = path.join(tmp, 'claude-skills'); const xd = path.join(tmp, 'codex-skills');
  const r = attempt(() => runIn(env, process.execPath, [inst, '--targets', 'claude,codex', '--claude-dir', cd, '--codex-dir', xd], tmp));
  const out = failedAttempt(r) ? null : json(r.stdout);
  check('F: isolated install into both destinations exits 0 and reports 3.2.0 for the source and for each target', out !== null && r.status === 0 && out.ok === true && out.sourceVersion === '3.2.0' && Array.isArray(out.results) && out.results.length === 2 && out.results.every((x) => x.action === 'install' && x.to === '3.2.0'), failedAttempt(r) ? r : { status: r.status, out: String(r.stdout).slice(0, 300), err: String(r.stderr).slice(0, 200) });
  const v = attempt(() => runIn(env, process.execPath, [inst, 'verify', '--targets', 'claude,codex', '--claude-dir', cd, '--codex-dir', xd], tmp));
  const vo = failedAttempt(v) ? null : json(v.stdout);
  check('F (AC-B1-6): verify reports both installed copies current at 3.2.0 and matching this source', vo !== null && v.status === 0 && vo.ok === true && vo.sourceVersion === '3.2.0' && vo.report.length === 2 && vo.report.every((x) => x.installed === true && x.state === 'current' && x.version === '3.2.0' && x.matchesThisSource === true), failedAttempt(v) ? v : { status: v.status, out: String(v.stdout).slice(0, 300) });
  const treeNow = failedAttempt(SK_NOW) ? null : SK_NOW;
  for (const [name, dir] of [['claude', cd], ['codex', xd]]) {
    const p = path.join(dir, 'project-setup');
    const installed = attempt(() => { const m = enumerate(p); m.delete('.installed.json'); return m; });
    const wantTree = treeNow === null ? null : new Set([...treeNow.keys()].filter((k) => INCLUDE.some((i) => k === i || k.startsWith(`${i}/`))));
    check(`F: ${name} destination: the installed file set is exactly the INCLUDE part of the real tree (SKILL.md, VERSION, CHANGELOG.md, references, assets, data, scripts), with no tests, README, notes or fixtures`, !failedAttempt(installed) && wantTree !== null && JSON.stringify([...installed.keys()].sort()) === JSON.stringify([...wantTree].sort()), failedAttempt(installed) ? installed : { extra: [...installed.keys()].filter((k) => !wantTree.has(k)), missing: [...wantTree].filter((k) => !installed.has(k)) });
    needPins(`F: ${name} destination: the installed file set equals the 3.1.0 installed set (nothing added, nothing removed): every 3.1.0 file of the INCLUDE entries, and no other`, { BASE_FILES }, () => { const want = Object.keys(BASE_FILES).filter((k) => !k.startsWith('@root/') && INCLUDE.some((i) => k === i || k.startsWith(`${i}/`))).sort(); return [!failedAttempt(installed) && JSON.stringify([...installed.keys()].sort()) === JSON.stringify(want), failedAttempt(installed) ? installed : { extra: [...installed.keys()].filter((k) => !want.includes(k)), missing: want.filter((k) => !installed.has(k)) }]; });
    check(`F: ${name} destination: the installed bytes of every file equal the real tree's bytes, and VERSION is "3.2.0" plus LF`, !failedAttempt(installed) && treeNow !== null && [...installed].every(([k, h]) => treeNow.get(k) === h) && attempt(() => fs.readFileSync(path.join(p, 'VERSION'), 'utf8')) === '3.2.0\n', undefined);
    const meta = attempt(() => JSON.parse(fs.readFileSync(path.join(p, '.installed.json'), 'utf8')));
    check(`F: ${name} destination: the install record names project-setup 3.2.0`, !failedAttempt(meta) && meta.name === 'project-setup' && meta.version === '3.2.0', meta);
  }
  check('F: the isolated install wrote nothing to the redirected user home', attempt(() => fs.readdirSync(home).length) === 0);
}
function zipEntries(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('no end-of-central-directory record');
  const n = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let i = 0; i < n; i++) {
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
    must(run('git', ['tag', 'project-setup-v3.2.0'], repo), 'git tag');
    const out = path.join(tmp, 'out');
    const r = run(process.execPath, [path.join(dst, 'install', 'release.mjs'), '--tag', 'project-setup-v3.2.0', '--out', out], tmp);
    const zipPath = path.join(out, 'project-setup-3.2.0.zip');
    const pub = path.join(out, 'RELEASE-NOTES.md');
    const tagged = run('git', ['show', `project-setup-v3.2.0:project-setup/${NOTES320}`], repo);
    return { status: r.status, stdout: r.stdout, stderr: r.stderr, zip: fs.existsSync(zipPath) ? fs.readFileSync(zipPath) : null, listing: fs.existsSync(out) ? fs.readdirSync(out).sort() : [], published: fs.existsSync(pub) ? fs.readFileSync(pub, 'utf8') : '', tagged: tagged.status === 0 ? tagged.stdout : null };
  });
  const okRun = !failedAttempt(rb);
  check('F: the builder, run on the real 3.2.0 tree in a synthetic repository (tag project-setup-v3.2.0), exits 0 with no stderr and prints "RELEASE  OK  3.2.0" and the tag', okRun && rb.status === 0 && rb.stderr === '' && rb.stdout.startsWith('RELEASE  OK  3.2.0\nTAG  project-setup-v3.2.0\n'), okRun ? { status: rb.status, out: rb.stdout.slice(0, 200), err: rb.stderr.slice(0, 200) } : rb);
  check('F: the output holds exactly project-setup-3.2.0.zip and RELEASE-NOTES.md', okRun && JSON.stringify(rb.listing) === JSON.stringify(['RELEASE-NOTES.md', 'project-setup-3.2.0.zip']), okRun ? rb.listing : rb);
  const notesNow = attempt(() => fs.readFileSync(path.join(SKILL, NOTES320), 'utf8'));
  check('F: the publication notes are the identity header followed by the unchanged tagged 3.2.0 notes, which are the actual notes file', okRun && rb.published.startsWith('# project-setup 3.2.0 publication notes\n') && typeof rb.tagged === 'string' && rb.published.endsWith(rb.tagged) && rb.tagged === notesNow, okRun ? rb.published.slice(0, 120) : rb);
  const z = okRun && Buffer.isBuffer(rb.zip) ? attempt(() => zipEntries(rb.zip)) : null;
  const fileNames = z === null || failedAttempt(z) ? null : [...z.keys()].filter((n) => !n.endsWith('/')).sort();
  const wantNames = [...enumerate(SKILL, { skipTests: true }).keys()].map((r) => `project-setup/${r}`).sort();
  check('F: the archive holds exactly the actual project-setup payload (every non-test file, RELEASE-NOTES-3.2.0.md included, nothing else)', fileNames !== null && JSON.stringify(fileNames) === JSON.stringify(wantNames), fileNames === null ? (z === null ? NOT_YET('a built archive') : z) : { extra: fileNames.filter((n) => !wantNames.includes(n)), missing: wantNames.filter((n) => !fileNames.includes(n)) });
  check('F: the archive contains RELEASE-NOTES-3.2.0.md and the installed payload does not (the notes are release material, outside INCLUDE)', fileNames !== null && fileNames.includes(`project-setup/${NOTES320}`) && !INCLUDE.includes(NOTES320), fileNames === null ? NOT_YET('a built archive') : undefined);
  const bytesIn = (name) => (z !== null && !failedAttempt(z) && z.has(name) ? z.get(name) : null);
  const diff = ['SKILL.md', 'VERSION', 'CHANGELOG.md', 'references/docs-generation.md', 'references/modes.md', 'assets/agents/reviewer.md', 'data/secret-paths.json', NOTES320].filter((rel) => { const b = bytesIn(`project-setup/${rel}`); return b === null || !b.equals(fs.readFileSync(path.join(SKILL, ...rel.split('/')))); });
  check('F: the archived amended files and the notes are the actual 3.2.0 bytes, and the archived VERSION is "3.2.0" plus LF', fileNames !== null && diff.length === 0 && bytesIn('project-setup/VERSION') !== null && bytesIn('project-setup/VERSION').toString('utf8') === '3.2.0\n', fileNames === null ? NOT_YET('a built archive') : diff);
}

// ============================================================================================================== G. view identity ====
{
  const label = 'G: the view (tracked files of the copy set, then to310Repo) is exactly the pinned 3.1.0 tree, and the unedited release-3.1 and c18 gates pass inside it';
  if (H === null) check(label, false, NOT_YET('tests/helpers/v320-amendments.mjs', LH.err));
  else {
    const outDir = path.join(scratchDir('view'), 'v');
    const includeUntracked = process.env.V320_INCLUDE_UNTRACKED === '1';
    const built = attempt(() => { try { return H.buildView({ repoRoot: REPO, outDir, includeUntracked }); } catch (e) { return { threw: `${e.code === 'GIT_FAILED' ? 'GIT_FAILED (git ls-files failed: is the checkout owned by this user?)' : 'buildView'}: ${e.message}` }; } });
    check('G: buildView lists the copy set with git (cwd = the repository root); a Git failure is its own FAIL and never a skip', !failedAttempt(built) && built.files.length > 0, failedAttempt(built) ? built : built.files.length);
    if (failedAttempt(built)) check(label, false, `no view was built: ${built.threw}`);
    else {
      const rev = attempt(() => H.to310Repo(outDir));
      if (failedAttempt(rev)) check(label, false, /PIN_PENDING/.test(rev.threw) ? `${PENDING}: ${rev.threw}` : rev.threw);
      else needPins(label, { BASE_FILES }, () => {
        const got = H.viewManifest(outDir); const want = new Map(Object.entries(BASE_FILES));
        const extra = [...got.keys()].filter((k) => !want.has(k)).sort(); const missing = [...want.keys()].filter((k) => !got.has(k)).sort(); const changed = [...want.keys()].filter((k) => got.has(k) && got.get(k).sha256 !== want.get(k)).sort();
        const idOk = extra.length === 0 && missing.length === 0 && changed.length === 0;
        const gateRuns = idOk ? ['release-3.1.test.mjs', 'c18.test.mjs'].map((f) => { const r = spawnSync(process.execPath, [path.join('tests', f)], { cwd: path.join(outDir, 'project-setup'), env: isoEnv(scratchDir('g-env')).env, encoding: 'utf8', shell: false, windowsHide: true, timeout: 580000, maxBuffer: 1 << 26 }); const t = RUN === null ? null : RUN.totalsOf(r.stdout); return { f, code: r.status, totals: t === null ? null : t.line, ok: r.status === 0 && t !== null && t.failed === 0 }; }) : [];
        return [idOk && gateRuns.length === 2 && gateRuns.every((g) => g.ok), { extra, missing, changed, gates: gateRuns }];
      });
    }
  }
}

// ------------------------------------------------------------------------------------------------------------------------- report ----
try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* the scratch directory was created by this run */ }
let failed = 0; let skipped = 0;
for (const r of results) {
  if (r.skip === true) { skipped += 1; console.log(`SKIP  ${r.name} (${r.detail})`); continue; }
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
  if (!r.ok && r.detail !== undefined) console.log(`        - ${(typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail)).slice(0, 600)}`);
}
console.log(`${results.length - failed - skipped} PASS / ${failed} FAIL / ${skipped} SKIP`);
process.exitCode = failed === 0 ? 0 : 1;
