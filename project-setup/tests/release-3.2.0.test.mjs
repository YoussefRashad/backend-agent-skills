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
  "RELEASE-NOTES-3.2.0.md": '0fcc3a46da566b785d87f09befe937f4ff2bec1ee24edf5be993ab92ad551e57',
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
  "assets/agents/docs-sync.md": Object.freeze(['2fccac12744faecf', '13d6c88a5635f2c8', '793b4404375d14a5', '07c05fb15124d4a6', 'e421f28ca1bc770b', 'b633c869f5f06419', 'a65ea87984db76d9', '07f4b38947ff8e85', 'a0896b361f59f5ae', '658221cb80f3db51', '88aef36e923d28ad', 'd10770598760e93f', '8571002b5eb4353a', '6f69df75ad8fbaa0', '570b8eaecf2123e7', 'cbe5eca2e003588c', 'be63e6df6e616779', '526f703efabc1ae8', '1348768a366d6fd1', '8e87d0122adcd818', '9f0809dd2f6e89e9', 'a12543cc006e83a1', 'e8962085da97b28e', 'd604e9818e4118a7', '54e67263451e6f38', '6a15aa2c1996946e', 'c415e5070ed628da']),
  "assets/agents/reviewer.md": Object.freeze(['596a9ca9d6f4c2f4', '961e3811760a3d1f', 'be63e6df6e616779', '526f703efabc1ae8', '198a11b3563823e0', '749589fcc77d530d', 'a370f67c293d5143', '343c4adb7d18db54', 'e8a0b8ab2a87c527', '93d361b0a37346d7', '57956be0a798d46a', 'e0d4e79e6bb66167', '88b453160dc8bd0f', 'a502f37907d1d5a0', 'b249dc2c15848fd2', 'd2545a2d75690a4e', 'df5df540cec303b4', 'de1abc89191605c7', 'f9d01fdbf4debc97', '9f7e310bcc98e005', '8c2ebf638bb57647', 'e80f8d3208a2f41c', 'ca114ec9e212105f', '01c98d13e6dd3e5a', '5345f02367dae647', '7930cd9baaa0b665', 'a8030712de53049c', 'd760bc1a98191785', '88aef36e923d28ad', '1348768a366d6fd1', '8e87d0122adcd818', '9f0809dd2f6e89e9', 'a12543cc006e83a1', 'e8962085da97b28e', 'd604e9818e4118a7', '54e67263451e6f38', '6a15aa2c1996946e', 'c415e5070ed628da']),
  "assets/templates/AGENTS.md": Object.freeze(['88aef36e923d28ad', 'd010d4059de44a35', 'a4fa6803bb386bce', 'd8efbc971038fa16', 'e96ee13b6d957dd7', 'e13619005c79aded', 'ee7e738ae207895a']),
  "assets/templates/CLAUDE.md": Object.freeze(['45bb182cf4e24f18', '706eb3bf1c7ab5be', '0f8151ffc77d31c3', '7eb82ba1345d6d21', '6610c9fd27ce3703', 'a555dd038e3b7d23', 'cac467d7512b6390', '4da2e3b41ce0e35c', '5bbb378444478c29']),
  "references/claude.md": Object.freeze(['a5a8a889caac77e1', 'e4970192cfd4fd18', 'bc5e8f55c72ed6b2', '912dd361e8bfc780', '9f49cb7a7841a354', 'bc7052175ca022c8', 'd9033339fdce253e']),
  "references/codex.md": Object.freeze(['ffc28013e6d6a15d', '4073b99c6df374fb', 'd75185b7e7938521', 'feb0e901a8a89340']),
  "references/docs-generation.md": Object.freeze(['87d9f59704477d19', 'e82a9a49c6193433', '7dd9c98ba0a1f81a', 'b7b0ab9f9d784a22', 'dfc8e9f00496cef5', '4b12ed9521239464', '8d06980f82327e81', 'd7f248943853550a', '8c7f5b4fbd2023fb', 'c031e4f4ffcf8cbd', 'c7c7abc812ed369b', '1069f370bdcc876e', '8d1095a02925a89d', 'e7503969724cd0d1', '13e41efb16ba7d80', '05585067283df5e8', '2856e926258740ef', '70b58185401f1d38', '6fdc0a84cf94f817', 'a42d4033830601fa', '73c58ea81fba70d8', '1336bf95a9e4abce', '25b1c4d7d42592e5', '47ec1c7d9bc1de90', '5270367c92032516', 'f112ac7ad2c6293a', '27b1fc535d03b3e0', '5cac44b532b3deb1', 'a4e15377ac84a57d', '9cf46648f5c22f45', 'd6ac172fb87557e6', '44c7604c12a07e74', '06a47da9c72fe7b5', '7d6875fb9f8c4454', 'd4389b098c860f57', '3e32a50ef53983e4', '718109fb344ed262', '7cc5ff53925451aa', '9e273305a5eb0842', 'c05c8f1286d874fb', '788bc332855b31d1', '9e4dcc37e27b4948', '1881e34249131fd4', 'ea655e76c92b4a85', '5738b04dfa5ac3df', '7beb9ee702eb79c3', '38c204588a3fd16d', '49dfc49b773ccdcf', 'c0cd974c9cb9464d', '9975979d5100dc21', '5f543caeb7260370', '09886b8abb1614d2', '5de4a74b6a3e48d9', 'fff946122155c0b1', 'a851bd21cf988edb', '465e5e8209c28311', 'a6589ab046a38250', '65573f38d67f2449']),
  "references/migration-v2.md": Object.freeze(['8bb7506f01dbbb3e', '538e27ed53f614cf', '9975979d5100dc21', '5f543caeb7260370', '09886b8abb1614d2', '5de4a74b6a3e48d9', 'fff946122155c0b1', 'a851bd21cf988edb', '465e5e8209c28311', 'a6589ab046a38250', '65573f38d67f2449']),
  "references/modes.md": Object.freeze(['0cdb3f9446bed7d0', 'db73cf5c60d90f8f', '990962db45c0f792', 'ae66e73f74731d09', 'f6fe18db9c93e6a2', '54396dd4a1bdde08']),
  "references/security.md": Object.freeze(['88aef36e923d28ad', '4ffff33329fc4dbf', 'df8811726f1632e9', 'c0601ce60dfe41f3', 'd426b9ec612be885', '12f3ebd5b67c72a5', '7f2733683f88e3a5', '79d70b852449f386', '19a8d7cfc8470c4a', 'fc5bd6dad6fb06c3']),
  "references/state-and-apply.md": Object.freeze(['92eb9f1799833ae0', 'b3c68bfca215834c']),
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
/**
 * The coverage of the normative-line table (finding 8 of review 3): baseTexts is { "<file under project-setup/>": text } of the 3.1.0 tree, table is the shape of
 * NORMATIVE_LINES. { uncovered, stale }: every 3.1.0 line holding MUST, SHOULD or MAY (case-sensitive words) of a file inside NORMATIVE_SCOPE whose digest is not in
 * the table entry of that file (a file with no entry counts all its lines), and every table digest the base does not hold, or whose file is not a normative file of the base.
 */
function normativeCoverage(baseTexts, table) {
  const uncovered = []; const stale = [];
  for (const [rel, text] of Object.entries(baseTexts)) {
    if (!NORMATIVE_SCOPE(rel)) continue;
    const want = new Set(lf(text).split('\n').filter((l) => KEYWORD.test(l)).map(lineDigest));
    const have = new Set(has(table, rel) ? table[rel] : []);
    for (const d of want) if (!have.has(d)) uncovered.push(`${rel}:${d}`);
    for (const d of have) if (!want.has(d)) stale.push(`${rel}:${d}`);
  }
  for (const rel of Object.keys(table)) if (!has(baseTexts, rel) || !NORMATIVE_SCOPE(rel)) stale.push(`${rel}: not a normative file of the 3.1.0 tree`);
  return { uncovered, stale };
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
/** The 8.3 short spelling of an existing Windows path (cmd "for %~sI"), or null when this is not Windows or the volume has no short name for it. */
const shortPathOf = (p) => {
  if (process.platform !== 'win32') return null;
  const r = spawnSync('cmd.exe', ['/d', '/s', '/c', `"for %I in ("${p}") do @echo %~sI"`], { encoding: 'utf8', windowsVerbatimArguments: true, windowsHide: true, timeout: 30000 });
  const s = r.status === 0 ? String(r.stdout).trim() : '';
  return s !== '' && s.toLowerCase() !== p.toLowerCase() && /~\d/.test(s) ? s : null;
};
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
    // Finding 1 (review 3), the helper's own predicate (isInside, not exported): the segment rule and the real-location comparison, reached through buildView.
    { const dots = path.join(repo, '..view'); const a = committed ? attempt(() => H.buildView({ repoRoot: repo, outDir: dots })) : { threw: 'the synthetic repository could not be committed' };
      const sib = path.join(tmp, 'repo-view'); const b = committed ? attempt(() => H.buildView({ repoRoot: repo, outDir: sib })) : { threw: 'the synthetic repository could not be committed' };
      check('view control (finding 1): buildView refuses an outDir named "..view" inside the repository, creates nothing there, and accepts a sibling directory whose name starts with the repository name', failedAttempt(a) && /outside the repository/.test(a.threw) && !fs.existsSync(dots) && !failedAttempt(b) && b.files.includes('project-setup/SKILL.md') && fs.existsSync(path.join(sib, 'project-setup', 'SKILL.md')), { a, b });
      let linkErr = null; const link = path.join(tmp, 'link-into-repo');
      try { fs.symlinkSync(repo, link, 'junction'); } catch (e) { linkErr = String(e && e.code ? e.code : e); }
      if (linkErr === null) { const c = attempt(() => H.buildView({ repoRoot: repo, outDir: path.join(link, 'v') })); check('view control (finding 1): buildView refuses an outDir reached through a link into the repository (compared by real location) and writes nothing in the repository', failedAttempt(c) && /outside the repository/.test(c.threw) && !fs.existsSync(path.join(repo, 'v')), c); }
      else skip('view control (finding 1): buildView refuses an outDir reached through a link into the repository', `a link could not be created on this platform (${linkErr})`); }
    check('view control: overlay replaces only the named project-setup file, refuses a test file, a root key, a parent path and a file that is not in the view', (() => { const d = mkView('view-ov'); const realRoot = scratchDir('ovroot'); put(realRoot, 'project-setup/README.md', 'overlaid\n'); put(realRoot, 'project-setup/tests/x.mjs', 'x\n'); H.overlay(d, realRoot, ['README.md']); const ok = fs.readFileSync(path.join(d, 'project-setup', 'README.md'), 'utf8') === 'overlaid\n'; const refused = ['tests/x.mjs', '@root/TODO.md', '../x', 'nope.md'].every((p) => failedAttempt(attempt(() => H.overlay(d, realRoot, [p])))); return ok && refused; })());
  }
}
// The runner (plan 5.2 item 11 and 4.6): the compat comparison is exact by string; run 1 admits only digest pins that name an overlaid file; run 2 also the shipped-policy assertions.
{
  if (RUN === null) check('runner controls need tests/run-310-view.mjs', false, NOT_YET('tests/run-310-view.mjs', LR.err));
  else {
    const O1 = ['scripts/detect.mjs', 'scripts/migrate-security-paths.mjs']; const O2 = [...O1, 'data/secret-paths.json'];
    // A valid pin has the structure of the real strings of tests/fixtures/v320-compat-expected.json (finding 7 of review 3): "<Cnn> component assertions pass :: <JSON>" whose failures are digest assertions of overlaid files.
    const cEntry = (n, id, failures, extra = {}) => `C${n} component assertions pass :: ${JSON.stringify({ errors: [], failed: [{ id, failures }], ...extra })}`;
    const D64 = 'd9c80c5b4af7bce55e48bdbb92e9dfc14db834860094807d73c2e0b9704ba193';
    const pinned1 = [cEntry(13, 'RC1/C13/release', ['scripts/detect.mjs is unchanged', 'scripts/migrate-security-paths.mjs is unchanged']), cEntry(16, 'RC1/C16/release', [`scripts/detect.mjs is unchanged :: ${JSON.stringify(D64)}`])];
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
    const polEntry = cEntry(13, 'RC1/C13/release', ['data/secret-paths.json is unchanged']);
    const policy1 = RUN.compareCompat({ actual: [polEntry], pinned: [polEntry], overlaid: O1 });
    const policy2 = RUN.compareCompat({ actual: [polEntry], pinned: [polEntry], overlaid: O2 });
    check('compat control: a digest assertion of the shipped policy file is a valid pin only when that file is overlaid (the second overlay set), never in run 1', policy1.ok === false && policy1.badPins.length === 1 && policy2.ok === true, { run1: policy1, run2: policy2 });
    // Finding 7: the five real strings are valid; a behaviour failure that merely names an overlaid file is not, in any of the shapes it can take.
    { const fx = attempt(() => JSON.parse(fs.readFileSync(path.join(SKILL, 'tests', 'fixtures', 'v320-compat-expected.json'), 'utf8')));
      const real = failedAttempt(fx) || fx === null || typeof fx !== 'object' || fx.runs === null || typeof fx.runs !== 'object' ? null : fx.runs.scripts;
      const realProblems = Array.isArray(real) ? real.map((e) => RUN.pinProblem(e, O1)) : null;
      check('compat control (finding 7): the five real pinned strings of tests/fixtures/v320-compat-expected.json (run "scripts") are all valid pins for the two overlaid scripts, and the validator reports no problem for any of them', Array.isArray(real) && real.length === 5 && RUN.pinnedListProblems(real, O1).length === 0 && realProblems.every((p) => p === null), Array.isArray(real) ? realProblems : fx);
      const behave = cEntry(13, 'RC1/C13/release', ['scripts/detect.mjs fails to report installer backups']);
      const same2 = RUN.compareCompat({ actual: [behave], pinned: [behave], overlaid: O1 });
      check('compat control (finding 7): identical actual and pinned lists holding "scripts/detect.mjs fails to report installer backups" are NOT ok: a behaviour regression that names an overlaid file cannot be pinned', same2.ok === false && same2.badPins.length === 1 && same2.unlisted.length === 0 && same2.stale.length === 0, same2);
      const okShapes = [cEntry(13, 'RC1/C13/release', ['scripts/detect.mjs is unchanged']), cEntry(17, 'V2/C17/preservation', [`scripts/detect.mjs is byte for byte its pre-C17 bytes :: ${JSON.stringify(D64)}`, 'scripts/migrate-security-paths.mjs is byte for byte its pre-C17 bytes']), cEntry(3, 'RC1/C3/release', ['scripts/migrate-security-paths.mjs is unchanged :: "' + 'a'.repeat(64) + '"'])];
      const acceptedWrong = okShapes.map((e, i) => [i, RUN.pinProblem(e, O1)]).filter(([, p]) => p !== null);
      check('compat control (finding 7): each digest-assertion shape is accepted (is unchanged, is byte for byte its pre-C17 bytes, with and without the :: "<64 hex>" suffix, a one-digit component number, several failures in one entry)', acceptedWrong.length === 0, acceptedWrong);
      const real0 = Array.isArray(real) ? real[0] : cEntry(13, 'RC1/C13/release', ['scripts/detect.mjs is unchanged']);
      const wrap = (obj) => `C13 component assertions pass :: ${JSON.stringify(obj)}`;
      const good1 = { errors: [], failed: [{ id: 'RC1/C13/release', failures: ['scripts/detect.mjs is unchanged'] }] };
      const rejected = [
        ['the bare behaviour string', 'scripts/detect.mjs fails to report installer backups'],
        ['a behaviour failure that names an overlaid file, inside the component shape', behave],
        ['a behaviour failure next to a digest failure in one entry', cEntry(13, 'RC1/C13/release', ['scripts/detect.mjs is unchanged', 'scripts/detect.mjs fails to report installer backups'])],
        ['a failure that merely starts with a digest phrase and goes on ("... is unchanged and wrong")', cEntry(13, 'RC1/C13/release', ['scripts/detect.mjs is unchanged and wrong'])],
        ['a digest assertion of a file that is not overlaid', cEntry(13, 'RC1/C13/release', ['scripts/apply.mjs is unchanged'])],
        ['a digest assertion of a file that is overlaid but not under scripts/ and is not the policy file', cEntry(13, 'RC1/C13/release', ['README.md is unchanged'])],
        ['a digest whose hash is not 64 hex digits', cEntry(16, 'RC1/C16/release', ['scripts/detect.mjs is unchanged :: "abc123"'])],
        ['a digest suffix that is not quoted', cEntry(16, 'RC1/C16/release', [`scripts/detect.mjs is unchanged :: ${D64}`])],
        ['a non-empty errors list', wrap({ ...good1, errors: ['an error'] })],
        ['an errors list that is missing', wrap({ failed: good1.failed })],
        ['an empty failed list', wrap({ errors: [], failed: [] })],
        ['an extra key on the object', wrap({ ...good1, note: 'x' })],
        ['an extra key on a failed entry', wrap({ errors: [], failed: [{ id: 'RC1/C13/release', failures: ['scripts/detect.mjs is unchanged'], note: 'x' }] })],
        ['a failed entry with no failures', wrap({ errors: [], failed: [{ id: 'RC1/C13/release', failures: [] }] })],
        ['a failure that is not a string', wrap({ errors: [], failed: [{ id: 'RC1/C13/release', failures: [7] }] })],
        ['an id of another component', wrap({ errors: [], failed: [{ id: 'RC1/C14/release', failures: ['scripts/detect.mjs is unchanged'] }] })],
        ['an id that is not suite/component/name', wrap({ errors: [], failed: [{ id: 'scripts/detect.mjs', failures: ['scripts/detect.mjs is unchanged'] }] })],
        ['a label that is not a component label', `X13 component assertions pass :: ${JSON.stringify(good1)}`],
        ['the label alone, with no JSON', 'C13 component assertions pass'],
        ['a JSON that is not an object', 'C13 component assertions pass :: "scripts/detect.mjs is unchanged"'],
        ['JSON with a duplicate key (the last one would win)', 'C13 component assertions pass :: {"errors":[],"errors":["x"],"failed":[{"id":"RC1/C13/release","failures":["scripts/detect.mjs is unchanged"]}]}'],
        ['JSON with spaces (not the compact form the results file writes)', `C13 component assertions pass :: ${JSON.stringify(good1, null, 1)}`],
        ['text after the JSON', `${real0} trailing`],
        ['a real string cut after 60 characters (truncated JSON is not parseable: fail closed)', real0.slice(0, 60)],
        ['a real string cut one character short', real0.slice(0, -1)],
        ['a real string cut in the middle of its JSON', real0.slice(0, Math.floor(real0.length / 2))],
      ];
      const OX = [...O1, 'README.md']; // README.md is overlaid here only to show that a digest assertion of an overlaid file outside scripts/ is still no pin
      const acceptedBad = rejected.filter(([, e]) => RUN.pinProblem(e, OX) === null || RUN.pinProblem(e, O1) === null).map(([n]) => n);
      check('compat control (finding 7): every malformed or non-digest string is rejected as a pin (a behaviour failure naming an overlaid file, a file that is not overlaid, a bad digest, a non-empty errors list, extra or missing keys, a wrong or foreign id, a duplicate key, loose JSON, trailing text, and truncated strings)', acceptedBad.length === 0 && rejected.length >= 20, { acceptedBad, count: rejected.length });
      const viaList = RUN.pinnedListProblems(rejected.map(([, e]) => e).filter((e) => e !== ''), O1);
      check('compat control (finding 7): pinnedListProblems reports each of those strings (one bad pin per string)', viaList.length === rejected.length, { reported: viaList.length, wanted: rejected.length });
      check('compat control (finding 7): the validator names a reason for a truncated string and for a behaviour failure (an answer, not a crash)', /does not parse/.test(RUN.pinProblem(real0.slice(0, 60), O1) ?? '') && /not a digest assertion/.test(RUN.pinProblem(behave, O1) ?? '') && /not an overlaid skill file/.test(RUN.pinProblem(cEntry(13, 'RC1/C13/release', ['scripts/apply.mjs is unchanged']), O1) ?? ''), [RUN.pinProblem(real0.slice(0, 60), O1), RUN.pinProblem(behave, O1)]);
    }
    check('compat control: a duplicate or empty pinned string is a bad pin', RUN.compareCompat({ actual: [pinned1[0]], pinned: [pinned1[0], pinned1[0]], overlaid: O1 }).badPins.length === 1 && RUN.pinnedListProblems(['', pinned1[0]], O1).length === 1);
    check('compat control: failureStringsOf takes the full set of results[].failures strings of a retained results file, unique and sorted, and refuses a malformed file', (() => { const ok = RUN.failureStringsOf(JSON.stringify({ results: [{ id: 'a', failures: ['y', 'x'] }, { id: 'b', failures: ['x'] }, { id: 'c', failures: [] }] })); const bad = [JSON.stringify({}), JSON.stringify({ results: [{ id: 'a' }] }), JSON.stringify({ results: [{ id: 'a', failures: [1] }] }), '{'].every((t) => failedAttempt(attempt(() => RUN.failureStringsOf(t)))); return JSON.stringify(ok) === '["x","y"]' && bad; })());
    check('runner control: totalsOf reads the last totals line, resultsFileOf the RESULTS line; both are null when absent', (() => { const t = RUN.totalsOf('x\n10 PASS / 2 FAIL / 1 SKIP\nnoise\n11 PASS / 0 FAIL / 0 SKIP\n'); const r = RUN.resultsFileOf('a\nRESULTS  D:/x/y.json\nb\n'); return t !== null && t.passed === 11 && t.failed === 0 && t.skipped === 0 && r === 'D:/x/y.json' && RUN.totalsOf('nothing') === null && RUN.resultsFileOf('nothing') === null; })());
    check('runner control: parseCliArgs refuses an unknown flag, a repeated flag, a missing value, a label without an overlay, a label without accept-rc1 and an unknown gate; it accepts the documented forms', (() => { const P = RUN.parseCliArgs; const refused = [['--out'], ['--out', 'a', '--out', 'b'], ['--x'], ['--out', 'a', '--label', 'l'], ['--out', 'a', '--overlay', 'scripts/detect.mjs', '--label', 'l'], ['--out', 'a', '--run', 'nope'], ['--out', 'a', '--run', 'c18,c18'], []].every((a) => P(a).ok === false); const good = P(['--out', 'a', '--overlay', 'scripts/detect.mjs', '--label', 'scripts', '--run', 'accept-rc1']); const dflt = P(['--out', 'a']); return refused && good.ok === true && good.label === 'scripts' && dflt.ok === true && JSON.stringify(dflt.run) === JSON.stringify(['release-3.1', 'c18', 'bs-doc-map']); })());
    check('runner control: outDirProblems refuses a directory inside the repository, inside the temp directory, and a non-empty one', (() => { const inRepo = RUN.outDirProblems(path.join(REPO, 'view-x')); const inTmp = RUN.outDirProblems(path.join(os.tmpdir(), 'view-x')); const full = scratchDir('fullout'); fs.writeFileSync(path.join(full, 'f'), 'x'); const nonEmpty = RUN.outDirProblems(full, { repoRoot: REPO, tmp: path.join(scratch, 'elsewhere') }); const fine = RUN.outDirProblems(path.join(scratch, 'fresh-view'), { repoRoot: REPO, tmp: path.join(scratch, 'elsewhere') }); return inRepo.some((m) => /inside the repository/.test(m)) && inTmp.some((m) => /temp directory/.test(m)) && nonEmpty.some((m) => /not empty/.test(m)) && fine.length === 0; })());
    // Finding 1 (review 3): containment is decided by a parent SEGMENT, not by a text prefix: "<repo>/..view" is inside the repository and "<temp>/..view" inside the temp directory; a sibling whose name starts with the repository name is outside.
    { const base = scratchDir('contain'); const repo = path.join(base, 'repo'); const tmpd = path.join(base, 'tmpdir'); fs.mkdirSync(repo); fs.mkdirSync(tmpd); fs.mkdirSync(path.join(base, 'repo-view')); fs.mkdirSync(path.join(base, 'repo2')); fs.mkdirSync(path.join(repo, '..a'));
      const opts = { repoRoot: repo, tmp: tmpd }; const has2 = (ps, rx) => ps.some((m) => rx.test(m));
      const inRepoDots = RUN.outDirProblems(path.join(repo, '..view'), opts); const inRepoDotsExisting = RUN.outDirProblems(path.join(repo, '..a'), opts); const inTmpDots = RUN.outDirProblems(path.join(tmpd, '..view'), opts);
      check('runner control (finding 1): a view directory named "..view" or "..a" inside the repository is refused as inside the repository (existing or not), and "..view" inside the temp directory as inside the temp directory', has2(inRepoDots, /inside the repository/) && has2(inRepoDotsExisting, /inside the repository/) && has2(inTmpDots, /temp directory/) && !has2(inTmpDots, /inside the repository/), { inRepoDots, inRepoDotsExisting, inTmpDots });
      const realDots = RUN.outDirProblems(path.join(REPO, '..view')); const realTmpDots = RUN.outDirProblems(path.join(os.tmpdir(), '..view'));
      check('runner control (finding 1): with the real repository and the real temp directory (the defaults), "<repo>/..view" and "<temp>/..view" are refused too', has2(realDots, /inside the repository/) && has2(realTmpDots, /temp directory/), { realDots, realTmpDots });
      const sibling = RUN.outDirProblems(path.join(base, 'repo-view'), opts); const siblingNew = RUN.outDirProblems(path.join(base, 'repo-view-new'), opts); const sibling2 = RUN.outDirProblems(path.join(base, 'repo2'), opts); const tmpSibling = RUN.outDirProblems(path.join(base, 'tmpdir-view'), opts);
      check('runner control (finding 1): a sibling directory whose name merely starts with the repository name ("repo-view", "repo-view-new", "repo2") or the temp directory name is accepted (no problem), not read as inside', sibling.length === 0 && siblingNew.length === 0 && sibling2.length === 0 && tmpSibling.length === 0, { sibling, siblingNew, sibling2, tmpSibling });
      const sameDir = RUN.outDirProblems(repo, opts); const childOfRepo = RUN.outDirProblems(path.join(repo, 'view'), opts);
      check('runner control (finding 1): the repository directory itself and an ordinary child of it are inside the repository (the segment rule keeps the plain cases)', has2(sameDir, /inside the repository/) && has2(childOfRepo, /inside the repository/), { sameDir, childOfRepo });
      let linked = null; const link = path.join(base, 'link-to-repo');
      try { fs.symlinkSync(repo, link, 'junction'); linked = true; } catch (e) { linked = String(e && e.code ? e.code : e); }
      if (linked === true) { const viaLink = RUN.outDirProblems(path.join(link, 'view'), opts); const viaLinkDots = RUN.outDirProblems(path.join(link, '..view'), opts); check('runner control (finding 1): a directory reached through a link (a junction or symbolic link) into the repository is refused: the comparison is by real location', has2(viaLink, /inside the repository/) && has2(viaLinkDots, /inside the repository/), { viaLink, viaLinkDots }); }
      else skip('runner control (finding 1): a directory reached through a link into the repository is refused (the comparison is by real location)', `a link could not be created on this platform (${linked})`);
    }
    // N1 (review 4, tests session 6): a Windows component that ends with a dot or a space is one name to Windows (and to a child process cwd) and another to the Node file-system calls, so a check made with one
    // and a git call made with the other name different directories ("<repo>." is "<repo>" to a child: git init would run in the real repository). The gate is platform-gated; every control passes the platform.
    { const base = scratchDir('alias'); const repo = path.join(base, 'repo'); const tmpd = path.join(base, 'tmpdir'); fs.mkdirSync(repo); fs.mkdirSync(tmpd);
      const W = { repoRoot: repo, tmp: tmpd, platform: 'win32' }; const L = { repoRoot: repo, tmp: tmpd, platform: 'linux' };
      const ALIAS = /ends with a dot or a space/; const probs = (p, o) => RUN.outDirProblems(p, o); const isAlias = (p, o) => probs(p, o).some((m) => ALIAS.test(m));
      const spelled = [['<repo>.', `${repo}.`], ['<repo><space>', `${repo} `], ['<repo>/view.', path.join(repo, 'view.')], ['<repo>/view<space>', `${path.join(repo, 'view')} `], ['<repo>/sub./view (a middle component)', `${repo}${path.sep}sub.${path.sep}view`], ['a sibling "view."', path.join(base, 'view.')], ['<tmp>.', `${tmpd}.`], ['<tmp>/x<space>.', `${path.join(tmpd, 'x')} .`], ['three dots', path.join(base, '...')]];
      const missed = spelled.filter(([, p]) => !isAlias(p, W)).map(([n]) => n);
      check('runner control (N1): on the win32 path a --out spelled with a component that ends with a dot or a space (<repo>., <repo><space>, <repo>/view., a middle component, a sibling, <tmp>., three dots) is refused as an alias before anything is written, whatever its real location', missed.length === 0 && spelled.every(([, p]) => RUN.resolveOutDir(p, W).path === null), missed);
      const roots = [probs(path.join(base, 'ok-new'), { ...W, repoRoot: `${repo}.` }), probs(path.join(base, 'ok-new'), { ...W, tmp: `${tmpd} ` })];
      check('runner control (N1): an alias spelling of the repository path or of the temp path (the roots --out is compared with) is refused too, naming which root it is', roots[0].some((m) => /^the repository path is refused.*ends with a dot or a space/.test(m)) && roots[1].some((m) => /^the temp path is refused.*ends with a dot or a space/.test(m)), roots);
      const off = spelled.filter(([, p]) => isAlias(p, L)).map(([n]) => n);
      check('runner control (N1): the gate is platform-gated: with platform "linux" the same spellings give no alias problem (such names are ordinary and legal there)', off.length === 0, off);
      const fine = [['an inner space', path.join(base, 'my view')], ['an inner dot and a name that starts with two dots', path.join(base, 'a..b')], ['"." and ".." navigation components', `${base}${path.sep}.${path.sep}fresh${path.sep}..${path.sep}fresh2`], ['an extension', path.join(base, 'view.v1')], ['a trailing separator', `${path.join(base, 'fresh3')}${path.sep}`], ['a name that starts with the repository name', path.join(base, 'repo-view')]];
      const refusedFine = fine.filter(([, p]) => probs(p, W).some((m) => ALIAS.test(m) || /device name|reads specially|extended-length/.test(m))).map(([n]) => n);
      check('runner control (N1): ordinary spellings are not refused by the gate on the win32 path (an inner space, an inner dot, "..a", "." and ".." components, an extension, a trailing separator, "repo-view")', refusedFine.length === 0, refusedFine);
      const other = [['a device name', path.join(base, 'nul')], ['a device name with an extension', path.join(base, 'CON.txt')], ['COM1', path.join(base, 'com1')], ['an alternate data stream', `${path.join(base, 'view')}:stream`], ['a wildcard', path.join(base, 'v*')], ['an extended-length prefix', '\\\\?\\D:\\x\\view'], ['a device prefix', '\\\\.\\D:\\x\\view']];
      const notRefused = other.filter(([, p]) => probs(p, W).length === 0).map(([n]) => n); const notOff = other.filter(([, p]) => probs(p, L).some((m) => /device name|reads specially|extended-length/.test(m))).map(([n]) => n);
      check('runner control (N1): the other Windows spellings that name something else than they say (a device name, a stream, a wildcard, an extended-length or device prefix) are refused on the win32 path and are ordinary names elsewhere', notRefused.length === 0 && notOff.length === 0, { notRefused, notOff });
      const WSP = H === null ? null : H.windowsSpellingProblem;
      check('runner control (N1): the helper exports windowsSpellingProblem: null for every path on a platform other than win32, a reason for each Windows alias on win32 and null for the ordinary ones', typeof WSP === 'function' && WSP('D:\\a\\b.', 'linux') === null && WSP('D:\\a\\b.', 'darwin') === null && ['D:\\a\\b.', 'D:\\a\\b ', 'D:\\a\\b.\\c', '\\\\?\\D:\\a', 'D:\\a\\nul', 'D:\\a\\b:s', 'D:\\a\\...', '', 'D:\\a\\b. \\c'].every((p) => typeof WSP(p, 'win32') === 'string') && ['D:\\a\\b', 'D:\\a\\.\\b', 'D:\\a\\..\\b', 'D:\\a b\\c', '/tmp/x/y', 'D:\\a\\b\\', 'D:\\a\\..view', 'D:\\a\\console.txt'].every((p) => WSP(p, 'win32') === null), typeof WSP === 'function' ? ['D:\\a\\..view', 'D:\\a\\console.txt'].map((p) => WSP(p, 'win32')) : 'no helper');
      // The file system against a child cwd, on a real Windows host (deterministic on NTFS): realpath/stat take "<dir>." literally, a child started with that cwd is normalized by Windows to <dir>.
      { const d = scratchDir('alias-probe'); const dotted = `${d}.`; const fsSees = fs.existsSync(dotted); const rp = attempt(() => fs.realpathSync.native(dotted));
        const cw = spawnSync(process.execPath, ['-e', 'process.stdout.write(process.cwd())'], { cwd: dotted, encoding: 'utf8', windowsHide: true }); const landed = cw.status === 0 && String(cw.stdout).toLowerCase() === d.toLowerCase();
        if (process.platform !== 'win32') skip('precondition (N1): the file-system calls and a child cwd read "<dir>." differently', 'a name with a trailing dot is an ordinary name outside Windows: nothing to probe (the gate controls above use the injected platform)');
        else if (!landed) skip('precondition (N1): the file-system calls and a child cwd read "<dir>." differently', `the child did not start in "${d}" when its cwd was "${dotted}" on this Windows host (${cw.error ? cw.error.code : String(cw.stdout).slice(0, 80)}): the alias is not live here`);
        else check('precondition (N1): on this Windows host the file-system calls and a child cwd read "<dir>." differently: realpath (and stat) say it does not exist while a child started with that cwd runs inside <dir> (so a check made with one and a git call made with the other name different directories)', !fsSees || failedAttempt(rp), { fsSees, rp: failedAttempt(rp) ? rp.threw : rp }); }
      // 8.3 short names: a short alias of an EXISTING directory resolves to the long real path (so containment sees the repository), and the canonical path is the long one.
      { const sRepo = shortPathOf(repo); const sTmp = shortPathOf(tmpd);
        if (sRepo === null || sTmp === null) skip('runner control (N1): a --out spelled through an 8.3 short alias of the repository or of the temp directory is refused as inside, and resolves to the long real path', process.platform === 'win32' ? 'not exercised: this volume has no 8.3 short name for the synthetic repository or temp directory (short-name generation is off)' : 'not exercised: 8.3 short names are a Windows feature');
        else {
          const o = { repoRoot: repo, tmp: tmpd }; const viaRepo = probs(path.join(sRepo, 'view'), o); const viaTmp = probs(path.join(sTmp, 'x'), o); const rootShort = probs(path.join(base, 'ok-new'), { repoRoot: sRepo, tmp: sTmp }); const inRootShort = probs(path.join(repo, 'view'), { repoRoot: sRepo, tmp: sTmp });
          check('runner control (N1): a --out spelled through the 8.3 short alias of the repository is refused as inside the repository, and one through the short alias of the temp directory as inside the temp directory (the short spelling is not mistaken for an outside sibling, and is not itself an alias problem)', viaRepo.some((m) => /inside the repository/.test(m)) && viaTmp.some((m) => /temp directory/.test(m)) && !viaRepo.some((m) => ALIAS.test(m)), { sRepo, sTmp, viaRepo, viaTmp });
          check('runner control (N1): the repository and temp roots given as 8.3 short aliases are compared by real location too (an ordinary sibling is fine, a child of the real repository is inside)', rootShort.length === 0 && inRootShort.some((m) => /inside the repository/.test(m)), { rootShort, inRootShort });
          const exist = path.join(base, 'existing-view-dir'); fs.mkdirSync(exist); const sExist = shortPathOf(exist); const newChild = RUN.resolveOutDir(path.join(shortPathOf(base) ?? base, 'new-child'), { repoRoot: path.join(scratch, 'elsewhere-repo'), tmp: path.join(scratch, 'elsewhere-tmp') });
          check('runner control (N1): the canonical path of a --out spelled through a short alias is the long real path, for an existing directory and for a new child of an existing one (what every later call uses)', sExist !== null && RUN.resolveOutDir(sExist, { repoRoot: path.join(scratch, 'elsewhere-repo'), tmp: path.join(scratch, 'elsewhere-tmp') }).path === fs.realpathSync.native(exist) && newChild.path === path.join(fs.realpathSync.native(base), 'new-child'), { sExist, existing: sExist === null ? null : RUN.resolveOutDir(sExist, { repoRoot: path.join(scratch, 'elsewhere-repo'), tmp: path.join(scratch, 'elsewhere-tmp') }).path, newChild: newChild.path });
        } }
    }
    check('runner control: the gates the runner can start are exactly release-3.1, c18, bs-doc-map and accept-rc1, run from tests/', JSON.stringify(Object.keys(RUN.GATES).sort()) === '["accept-rc1","bs-doc-map","c18","release-3.1"]' && Object.values(RUN.GATES).every((f) => /^[a-z0-9.-]+\.mjs$/.test(f)));
  }
}
// BEGIN bootstrap controls (tests session 3)
// The accept-rc1 bootstrap (a recorded deviation from plan 4.3 / 5.4, found by the first full view run): the strict gate reads docs/plans/ (the 3.1.0 records) and a git repository (the tags,
// one commit) that a bare view lacks. bootstrapStrictGate runs REAL git here, on synthetic repositories; the runView controls inject the gate spawn (and, where named, the bootstrap) and
// build the view from the real tree (a read of it, as section G does), passing tmp so that a scratch under the OS temp directory (V320_SCRATCH unset) is not refused.
{
  if (RUN === null || H === null) check('bootstrap controls need tests/run-310-view.mjs and the helper', false, NOT_YET('tests/run-310-view.mjs', LR.err ?? LH.err));
  else {
    check('bootstrap control: the runner exports bootstrapStrictGate, parseTar, planPathProblem and writePlans as functions', ['bootstrapStrictGate', 'parseTar', 'planPathProblem', 'writePlans'].every((n) => typeof RUN[n] === 'function'), ['bootstrapStrictGate', 'parseTar', 'planPathProblem', 'writePlans'].filter((n) => typeof RUN[n] !== 'function'));
    const gitOut = (env, cwd, args, buffer = false) => spawnSync('git', args, { cwd, env, encoding: buffer ? 'buffer' : 'utf8', shell: false, windowsHide: true, timeout: 180000, maxBuffer: 1 << 26 });
    const listFiles = (root) => { const out = []; (function walk(d, rel) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel === '' ? e.name : `${rel}/${e.name}`; if (e.isDirectory()) walk(path.join(d, e.name), r); else out.push(r); } })(root, ''); return out.sort(); };
    const fingerprint = (root) => sha(listFiles(root).map((r) => `${r}:${sha(fs.readFileSync(path.join(root, ...r.split('/'))))}`).join('\n'));
    const withEnv = (vars, fn) => { const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]])); try { Object.assign(process.env, vars); return fn(); } finally { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } } };
    const slashed = (p) => p.replace(/\\/g, '/');
    // A synthetic repository: root commit (README only), base commit (docs/plans), head commit (docs/plans changed), an uncommitted edit; tags: all | none | other.
    const LONG_PAX = `docs/plans/${'segment-'.repeat(13)}end.md`; // a name over 100 bytes: git archive writes a pax "path" record
    const LONG_PREFIX = `docs/plans/${'d'.repeat(45)}/${'e'.repeat(45)}.md`; // over 100 bytes in all, the name part under 100: a ustar prefix
    const BASE_PLANS = { 'docs/plans/a.md': 'base a\n', 'docs/plans/sub/b.md': 'base b\n', [LONG_PAX]: 'pax path\n', [LONG_PREFIX]: 'prefix path\n', 'docs/plans/crlf.txt': Buffer.from('one\r\ntwo\r\n'), 'docs/plans/bin.dat': Buffer.from([0, 1, 2, 255, 254, 13, 10, 0]) };
    // tags: all | none | other (only v9) | a tag NAME starting with "project-setup-v" (that one lightweight tag on the base commit) | treetag (project-setup-v2.0.0 names the base TREE, not a commit); plans: extra files of the base commit.
    const bootRepo = (label, { tags = 'all', plans = {} } = {}) => {
      const tmp = scratchDir(label); const env = gitEnv(tmp); const repo = path.join(tmp, 'repo'); fs.mkdirSync(repo);
      const g = (...a) => gitOut(env, repo, a);
      g('init', '-q'); put(repo, 'README.md', 'root\n'); g('add', '-A'); g('commit', '-qm', 'root');
      const root = g('rev-parse', 'HEAD').stdout.trim();
      for (const [rel, data] of Object.entries({ ...BASE_PLANS, ...plans })) put(repo, rel, data);
      g('add', '-A'); g('commit', '-qm', 'base');
      const base = g('rev-parse', 'HEAD').stdout.trim();
      if (tags === 'treetag') g('tag', 'project-setup-v2.0.0', g('rev-parse', 'HEAD^{tree}').stdout.trim());
      else if (tags !== 'none') g('tag', tags === 'other' ? 'v9' : /^project-setup-v/.test(tags) ? tags : 'project-setup-v2.0.0');
      put(repo, 'docs/plans/c-new.md', 'head new\n'); put(repo, 'docs/plans/a.md', 'head a\n'); fs.rmSync(path.join(repo, 'docs', 'plans', 'sub', 'b.md'));
      g('add', '-A'); g('commit', '-qm', 'head');
      if (tags === 'all') { g('tag', '-a', 'project-setup-v3.1.0', '-m', 'annotated'); g('tag', 'v9'); }
      put(repo, 'docs/plans/a.md', 'working a\n');
      return { tmp, env, repo, root, base, g, ready: /^[0-9a-f]{40}$/.test(root) && /^[0-9a-f]{40}$/.test(base) };
    };
    const bootView = (label) => { const d = scratchDir(label); put(d, 'project-setup/x.md', '# x\n'); put(d, 'project-setup/crlf.md', Buffer.from('a\r\nb\r\n')); put(d, 'project-setup/sub/note.md', 'note\n'); put(d, 'README.md', '# view readme\n'); return d; };
    const F = bootRepo('boot-good');
    const V = bootView('boot-view');
    const pre = { files: Object.fromEntries(H.viewManifest(V)) };
    const repoBefore = fingerprint(F.repo);
    const res = RUN.bootstrapStrictGate(V, F.repo, { baseCommit: F.base });
    const repoAfter = fingerprint(F.repo);
    const gv = (...a) => gitOut(F.env, V, a);
    const baseList = gitOut(F.env, F.repo, ['ls-tree', '-r', '-z', '--name-only', F.base, 'docs/plans']).stdout.split('\0').filter(Boolean).sort();
    check('bootstrap control: on a synthetic view and repository it succeeds and reports the plan files, the project-setup-v* tags and the one commit', F.ready && res.ok === true && res.plans === 6 && baseList.length === 6 && res.tags === 2 && /^[0-9a-f]{40}$/.test(String(res.commit)) && res.commit === gv('rev-parse', 'HEAD').stdout.trim(), { ready: F.ready, res, baseList });
    const present = fs.existsSync(path.join(V, 'docs')) ? listFiles(path.join(V, 'docs')).map((r) => `docs/${r}`) : [];
    check('bootstrap control: docs/plans/ is exactly the base commit (same files, same bytes, CRLF and binary kept, a path over 100 bytes by pax record and by ustar prefix) and not the working tree', JSON.stringify(present) === JSON.stringify(baseList) && baseList.length === 6 && baseList.every((rel) => Buffer.compare(fs.readFileSync(path.join(V, ...rel.split('/'))), gitOut(F.env, F.repo, ['cat-file', 'blob', `${F.base}:${rel}`], true).stdout) === 0) && fs.readFileSync(path.join(V, 'docs', 'plans', 'a.md'), 'utf8') === 'base a\n' && present.includes('docs/plans/sub/b.md') && !present.includes('docs/plans/c-new.md'), { present, baseList });
    const tagsIn = gv('tag', '-l').stdout.split('\n').filter(Boolean).sort();
    check('bootstrap control: every tag of the repository is in the view repository (lightweight and annotated, project-setup-v* and others), at the same commits', JSON.stringify(tagsIn) === JSON.stringify(['project-setup-v2.0.0', 'project-setup-v3.1.0', 'v9']) && gv('rev-parse', '--verify', 'refs/tags/project-setup-v2.0.0^{commit}').stdout.trim() === F.base && gv('rev-parse', '--verify', 'refs/tags/project-setup-v3.1.0^{commit}').stdout.trim() === F.g('rev-parse', '--verify', 'refs/tags/project-setup-v3.1.0^{commit}').stdout.trim() && F.base !== '', tagsIn);
    const tracked = gv('ls-files').stdout.split('\n').filter(Boolean);
    check('bootstrap control: the view is one clean commit: status empty, one commit, every view file and plan tracked, CRLF bytes kept, the fixed identity, no hooks directory', gv('status', '--porcelain').stdout === '' && gv('rev-list', '--count', 'HEAD').stdout.trim() === '1' && ['project-setup/x.md', 'project-setup/crlf.md', 'project-setup/sub/note.md', 'README.md', 'docs/plans/a.md', LONG_PAX].every((f) => tracked.includes(f)) && Buffer.compare(gitOut(F.env, V, ['cat-file', 'blob', 'HEAD:project-setup/crlf.md'], true).stdout, Buffer.from('a\r\nb\r\n')) === 0 && gv('log', '-1', '--format=%an <%ae>').stdout.trim() === 'run-310-view <run-310-view@example.invalid>' && !fs.existsSync(path.join(V, '.git', 'hooks')), { status: gv('status', '--porcelain').stdout.slice(0, 200), tracked: tracked.length });
    check('bootstrap control: the repository is only read: every file under it (its .git and its working tree) is byte for byte what it was, and its uncommitted edit is still there', repoBefore === repoAfter && fs.readFileSync(path.join(F.repo, 'docs', 'plans', 'a.md'), 'utf8') === 'working a\n' && F.g('status', '--porcelain').stdout.includes('docs/plans/a.md'), { repoBefore, repoAfter });
    check('bootstrap control: the pinned manifest check is unaffected: after the bootstrap the view still has no extra, missing or changed file (docs/ and .git are outside the manifest)', JSON.stringify(H.verifyView(V, pre)) === JSON.stringify({ extra: [], missing: [], changed: [] }), H.verifyView(V, pre));
    // Refusals. Each returns { ok: false, error } with one line; before the git init no .git exists, and before the plans are written no docs/ exists.
    const bad = (name, rx, { repo = F.repo, base = F.base, prep = null, view = bootView(`bad-${seq}`), keepsGit = false, writes = false } = {}) => {
      if (prep !== null) prep(view);
      const r = RUN.bootstrapStrictGate(view, repo, base === null ? {} : { baseCommit: base });
      check(`bootstrap control: ${name}`, r.ok === false && typeof r.error === 'string' && r.error !== '' && !r.error.includes('\n') && rx.test(r.error) && (keepsGit || !fs.existsSync(path.join(view, '.git'))) && (writes || !fs.existsSync(path.join(view, 'docs'))), r);
      return view;
    };
    bad('a base commit that is not in the repository is refused (git archive fails) and nothing is written to the view', /git archive/, { base: '1'.repeat(40) });
    bad('a base commit that holds no docs/plans (the root commit) is refused (git archive fails) and nothing is written to the view', /git archive/, { base: F.root });
    for (const [label, value] of [['HEAD', 'HEAD'], ['a short id', F.base.slice(0, 12)], ['an option (--output=injected.tar)', '--output=injected.tar'], ['empty', '']]) {
      bad(`a base commit that is ${label} (not a full 40-hex id) is refused before any git call`, /40-hex/, { base: value });
    }
    check('bootstrap control: an option given as the base commit is not passed to git (no injected.tar anywhere)', !fs.existsSync(path.join(F.repo, 'injected.tar')) && !fs.existsSync(path.join(process.cwd(), 'injected.tar')), undefined);
    { const g0 = bootRepo('boot-notag', { tags: 'none' }); bad('a repository with no tag at all is refused with a message naming project-setup-v*', /no project-setup-v\* tag/, { repo: g0.repo, base: g0.base, keepsGit: true, writes: true }); }
    { const g1 = bootRepo('boot-othertag', { tags: 'other' }); bad('a repository whose only tag is not project-setup-v* is refused too', /no project-setup-v\* tag/, { repo: g1.repo, base: g1.base, keepsGit: true, writes: true }); }
    bad('a directory that is not a repository is refused (git archive fails)', /git archive/, { repo: scratchDir('plain-src') });
    { const v = bad('a view that already holds docs/ is refused and left as it was', /fresh view/, { prep: (d) => put(d, 'docs/plans/mine.md', 'mine\n'), writes: true }); check('bootstrap control: the refused view still holds only its own docs/plans/mine.md and has no .git', JSON.stringify(listFiles(path.join(v, 'docs'))) === '["plans/mine.md"]' && fs.readFileSync(path.join(v, 'docs', 'plans', 'mine.md'), 'utf8') === 'mine\n' && !fs.existsSync(path.join(v, '.git')), listFiles(path.join(v, 'docs'))); }
    { const v = bad('a view that already holds .git is refused and left as it was', /fresh view/, { prep: (d) => fs.mkdirSync(path.join(d, '.git')), keepsGit: true }); check('bootstrap control: the refused view still has an empty .git and no docs/', fs.readdirSync(path.join(v, '.git')).length === 0 && !fs.existsSync(path.join(v, 'docs')), undefined); }
    { const inside = bootRepo('boot-inside'); const v = path.join(inside.repo, 'inside-view'); fs.mkdirSync(v); put(v, 'project-setup/x.md', 'x\n'); bad('a view directory inside the repository is refused and no repository is created there', /inside the repository/, { repo: inside.repo, base: inside.base, view: v }); }
    bad('a view directory that does not exist is refused', /ENOENT|no such file|not a directory/i, { view: path.join(scratchDir('absent-view'), 'nope') });
    // The environment: a runner started from a git hook inherits GIT_DIR and friends; a hostile global configuration must change nothing.
    { const f = bootRepo('boot-env'); const decoy = bootRepo('boot-decoy'); const v = bootView('boot-env-view'); const decoyBefore = fingerprint(decoy.repo);
      const r = withEnv({ GIT_DIR: path.join(decoy.repo, '.git'), GIT_WORK_TREE: decoy.repo, GIT_INDEX_FILE: path.join(decoy.repo, '.git', 'index') }, () => RUN.bootstrapStrictGate(v, f.repo, { baseCommit: f.base }));
      const gx = (...a) => gitOut(f.env, v, a);
      check('bootstrap control: GIT_DIR, GIT_WORK_TREE and GIT_INDEX_FILE in the caller environment (a runner started from a git hook) do not redirect it: the view gets its own repository and the other repository is untouched', r.ok === true && gx('rev-parse', '--git-dir').stdout.trim() === '.git' && gx('rev-list', '--count', 'HEAD').stdout.trim() === '1' && gx('ls-files').stdout.includes('project-setup/x.md') && fingerprint(decoy.repo) === decoyBefore, { r, decoyTouched: fingerprint(decoy.repo) !== decoyBefore });
    }
    { const f = bootRepo('boot-global'); const v = bootView('boot-global-view'); const gd = scratchDir('boot-global-cfg'); const marker = path.join(gd, 'marker.txt'); const hooks = path.join(gd, 'hooks'); fs.mkdirSync(hooks);
      for (const h of ['pre-commit', 'commit-msg', 'post-commit', 'post-index-change']) { fs.writeFileSync(path.join(hooks, h), `#!/bin/sh\necho ${h} >> "${slashed(marker)}"\nexit 1\n`); fs.chmodSync(path.join(hooks, h), 0o755); } // executable, or on POSIX a hook never runs and the control proves nothing
      const excl = path.join(gd, 'excludes'); fs.writeFileSync(excl, '*.md\n');
      const cfg = path.join(gd, 'gitconfig'); fs.writeFileSync(cfg, `[core]\n\thooksPath = ${slashed(hooks)}\n\tautocrlf = true\n\texcludesFile = ${slashed(excl)}\n[commit]\n\tgpgsign = true\n[gpg]\n\tprogram = ${slashed(gd)}/no-such-gpg\n[user]\n\tname = Global Person\n\temail = global@example.invalid\n`);
      fs.copyFileSync(cfg, path.join(gd, '.gitconfig')); // the hostile configuration is in the home directory too (where git finds it when GIT_CONFIG_GLOBAL is absent); since session 6 the runner replaces GIT_CONFIG_GLOBAL and HOME with its own, so none of it may be read
      const hostileHome = { GIT_CONFIG_GLOBAL: cfg, HOME: gd, USERPROFILE: gd, XDG_CONFIG_HOME: path.join(gd, 'xdg') };
      { const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k, val]) => !/^GIT_/i.test(k) && typeof val === 'string')); const pr = scratchDir('boot-global-probe');
        const pe = { ...cleanEnv, HOME: gd, USERPROFILE: gd, XDG_CONFIG_HOME: path.join(gd, 'xdg'), GIT_TERMINAL_PROMPT: '0' };
        const pg = (...a) => spawnSync('git', a, { cwd: pr, env: pe, encoding: 'utf8', shell: false, windowsHide: true, timeout: 120000 });
        pg('init', '-q'); fs.writeFileSync(path.join(pr, 'f.txt'), 'x\n'); pg('add', '-A'); const pc = pg('commit', '-qm', 'probe'); try { fs.rmSync(marker); } catch { /* none */ }
        check('bootstrap control (precondition): the hostile global configuration is live where git reads it (an unpinned commit made with it in the home directory fails: signing with a program that does not exist, a failing pre-commit hook), so the control below is not vacuous', pc.status !== 0, { status: pc.status, err: String(pc.stderr).slice(0, 160) }); }
      const r = withEnv(hostileHome, () => RUN.bootstrapStrictGate(v, f.repo, { baseCommit: f.base }));
      const gx = (...a) => gitOut(f.env, v, a); const ls = gx('ls-files').stdout.split('\n');
      check('bootstrap control: a hostile global git configuration (hooks, signing, autocrlf, a global ignore file, another identity) changes nothing: it commits, runs no hook, keeps the CRLF bytes, tracks every view file and uses the fixed identity', r.ok === true && !fs.existsSync(marker) && Buffer.compare(gitOut(f.env, v, ['cat-file', 'blob', 'HEAD:project-setup/crlf.md'], true).stdout, Buffer.from('a\r\nb\r\n')) === 0 && ls.includes('project-setup/x.md') && ls.includes('README.md') && gx('status', '--porcelain').stdout === '' && gx('log', '-1', '--format=%an').stdout.trim() === 'run-310-view', { r, hooksRan: fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') : null, ls });
    }
    // ---- Review 3 fix round (tests session 5): containment, environment, configuration, archive exactness, prerequisites. ----
    const cleanProcessEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k, val]) => !/^GIT_/i.test(k) && typeof val === 'string'));
    const hostileGitVars = (dir) => ({ GIT_DIR: path.join(dir, 'no-git-dir'), GIT_WORK_TREE: dir, GIT_INDEX_FILE: path.join(dir, 'no-index'), GIT_OBJECT_DIRECTORY: path.join(dir, 'no-objects'), GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(dir, 'no-alt'), GIT_COMMON_DIR: path.join(dir, 'no-common'), GIT_NAMESPACE: 'hostile-ns', GIT_CEILING_DIRECTORIES: dir, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.hooksPath', GIT_CONFIG_VALUE_0: path.join(dir, 'no-hooks'), GIT_CONFIG_PARAMETERS: "'core.fsmonitor'='hostile'", GIT_CONFIG_GLOBAL: path.join(dir, 'no-global'), GIT_CONFIG_SYSTEM: path.join(dir, 'no-system'), GIT_CONFIG_NOSYSTEM: '0', GIT_AUTHOR_NAME: 'Hostile' });
    // Finding 1: the bootstrap's own containment check (the same predicate as the runner's).
    { const inside = bootRepo('boot-dots'); const dv = path.join(inside.repo, '..view'); fs.mkdirSync(dv); put(dv, 'project-setup/x.md', 'x\n');
      bad('a view directory named "..view" inside the repository is refused as inside the repository (a name that only starts with two dots is a child of the repository) and no repository is created there', /inside the repository/, { repo: inside.repo, base: inside.base, view: dv });
      const sib = bootRepo('boot-sibling'); const sv = path.join(sib.tmp, 'repo-view'); fs.mkdirSync(sv); put(sv, 'project-setup/x.md', 'x\n');
      const sr = RUN.bootstrapStrictGate(sv, sib.repo, { baseCommit: sib.base });
      check('bootstrap control (finding 1): a view directory next to the repository whose name starts with the repository name ("repo-view" beside "repo") is accepted and bootstrapped (a text-prefix test would call it inside)', sr.ok === true && fs.existsSync(path.join(sv, '.git')) && fs.existsSync(path.join(sv, 'docs', 'plans', 'a.md')), sr); }
    // Finding 2 and 3: every git call of the bootstrap, as recorded: the pinned configuration and a scrubbed environment, with hostile GIT_* variables in the caller's environment.
    { const f = bootRepo('boot-argv'); const v = bootView('boot-argv-view'); const calls = []; const keepVar = 'V320_KEEP_ME';
      const rec = (cmd, args, o) => { calls.push({ cmd, args: [...args], env: o.env }); return spawnSync(cmd, args, o); };
      const r = withEnv({ ...hostileGitVars(f.tmp), [keepVar]: 'kept' }, () => RUN.bootstrapStrictGate(v, f.repo, { baseCommit: f.base, git: rec }));
      const cfgOf = (args) => { const out = []; for (let i = 0; i < args.length - 1; i++) if (args[i] === '-c') out.push(args[i + 1]); return out; };
      const unpinned = calls.filter((c) => { const p = cfgOf(c.args); return !p.includes('core.fsmonitor=false') || !p.includes('core.untrackedCache=false'); });
      check('bootstrap control (finding 3): every git call of the bootstrap (cat-file, archive, ls-tree, init, fetch, tag, rev-parse, add, commit) carries -c core.fsmonitor=false and -c core.untrackedCache=false, so no configured file-system monitor can run (recorded argv)', r.ok === true && calls.length >= 10 && unpinned.length === 0 && calls.every((c) => c.cmd === 'git'), { r, calls: calls.length, unpinned: unpinned.map((c) => c.args.slice(-8)) });
      // Adapted in the review 4 fix round (session 6): this control asserted the OLD mechanism (no GIT_* variable but GIT_TERMINAL_PROMPT, i.e. scrub and fall back to the user's configuration). The runner now owns the configuration, so
      // exactly four GIT_* variables are expected, with the runner's values: GIT_TERMINAL_PROMPT=0, GIT_CONFIG_NOSYSTEM=1, GIT_ATTR_NOSYSTEM=1 and GIT_CONFIG_GLOBAL naming the runner's own file (never the hostile one of the caller).
      const RUNNER_GIT = ['GIT_TERMINAL_PROMPT', 'GIT_CONFIG_NOSYSTEM', 'GIT_ATTR_NOSYSTEM', 'GIT_CONFIG_GLOBAL'];
      const leaked = calls.filter((c) => Object.keys(c.env).some((k) => /^GIT_/i.test(k) && !RUNNER_GIT.includes(k.toUpperCase())));
      const wrongValue = calls.filter((c) => c.env.GIT_TERMINAL_PROMPT !== '0' || c.env.GIT_CONFIG_NOSYSTEM !== '1' || c.env.GIT_ATTR_NOSYSTEM !== '1' || typeof c.env.GIT_CONFIG_GLOBAL !== 'string' || c.env.GIT_CONFIG_GLOBAL === hostileGitVars(f.tmp).GIT_CONFIG_GLOBAL || !/run310-git-[^\\/]+[\\/]gitconfig$/.test(c.env.GIT_CONFIG_GLOBAL));
      check('bootstrap control (finding 2, adapted in session 6): with GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, GIT_OBJECT_DIRECTORY, GIT_ALTERNATE_OBJECT_DIRECTORIES, GIT_COMMON_DIR, GIT_NAMESPACE, GIT_CEILING_DIRECTORIES, GIT_CONFIG_* and GIT_AUTHOR_NAME in the caller\'s environment, no git call of the bootstrap receives any GIT_* variable but the runner\'s own four (GIT_TERMINAL_PROMPT=0, GIT_CONFIG_NOSYSTEM=1, GIT_ATTR_NOSYSTEM=1, GIT_CONFIG_GLOBAL naming the runner\'s file, never the caller\'s), and the other variables (PATH, a custom one) are kept', r.ok === true && calls.length >= 10 && leaked.length === 0 && wrongValue.length === 0 && calls.every((c) => c.env[keepVar] === 'kept' && Object.keys(c.env).some((k) => k.toUpperCase() === 'PATH')), { r, leaked: leaked.map((c) => Object.keys(c.env).filter((k) => /^GIT_/i.test(k))), wrongValue: wrongValue.map((c) => [c.env.GIT_CONFIG_NOSYSTEM, c.env.GIT_CONFIG_GLOBAL]) });
      check('environment control (finding 2): envWithoutGit removes every GIT_* variable whatever its letter case, keeps GITHUB_ACTIONS and every other variable, and drops a value that is not a string', (() => { const out = RUN.envWithoutGit({ PATH: 'p', HOME: 'h', GITHUB_ACTIONS: 'true', GIT_DIR: 'd', GIT_INDEX_FILE: 'i', git_work_tree: 'w', Git_Object_Directory: 'o', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'k', GIT_NAMESPACE: 'n', GIT_COMMON_DIR: 'c', GIT_ALTERNATE_OBJECT_DIRECTORIES: 'a', GIT_CONFIG_GLOBAL: 'g', X: undefined, Y: 5 }); return JSON.stringify(Object.keys(out).sort()) === '["GITHUB_ACTIONS","HOME","PATH"]'; })()); }
    // Finding 3: an executable core.fsmonitor in a hostile global configuration. Git runs it on every index operation (git add -A included) and core.hooksPath does not stop it.
    { const f = bootRepo('boot-fsm'); const v = bootView('boot-fsm-view'); const gd = scratchDir('boot-fsm-cfg'); const marker = path.join(gd, 'fsmonitor-ran.txt'); const hook = path.join(gd, 'fsmonitor-hook.mjs');
      fs.writeFileSync(hook, `import fs from 'node:fs';\nfs.appendFileSync(${JSON.stringify(slashed(marker))}, 'fsmonitor ' + process.argv.slice(2).join(' ') + '\\n');\nprocess.stdout.write('\\0');\n`);
      const quoted = (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
      fs.writeFileSync(path.join(gd, '.gitconfig'), `[core]\n\tfsmonitor = ${quoted(`"${slashed(process.execPath)}" "${slashed(hook)}"`)}\n[user]\n\tname = Hostile\n\temail = hostile@example.invalid\n`);
      const hostileHome = { HOME: gd, USERPROFILE: gd, XDG_CONFIG_HOME: path.join(gd, 'xdg') };
      const pr = scratchDir('boot-fsm-probe'); const pe = { ...cleanProcessEnv(), ...hostileHome, GIT_TERMINAL_PROMPT: '0' };
      const pg = (...a) => spawnSync('git', a, { cwd: pr, env: pe, encoding: 'utf8', shell: false, windowsHide: true, timeout: 120000 });
      pg('init', '-q'); fs.writeFileSync(path.join(pr, 'f.txt'), 'x\n'); const pa = pg('add', '-A'); const executes = pa.status === 0 && fs.existsSync(marker); try { fs.rmSync(marker); } catch { /* none */ }
      if (!executes) skip('bootstrap control (finding 3): an executable core.fsmonitor in the global configuration is never run (marker file)', `the fsmonitor command could not be made to run on this platform (add status ${pa.status}); the recorded-argv control above asserts the pinned flags on every git call instead`);
      else {
        check('bootstrap control (precondition, finding 3): the marker-producing core.fsmonitor really runs under an unpinned git add -A with this configuration in the home directory (so the control below is not vacuous)', executes, { status: pa.status });
        const r = withEnv(hostileHome, () => RUN.bootstrapStrictGate(v, f.repo, { baseCommit: f.base }));
        check('bootstrap control (finding 3): with an executable core.fsmonitor (a command that writes a marker file) in the global configuration, the bootstrap succeeds and the command never runs: no marker file', r.ok === true && !fs.existsSync(marker), { r, marker: fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8').slice(0, 120) : null });
      } }
    // Finding 4: git archive honours .git/info/attributes. An export-ignore drops a plan file and an export-subst rewrites one, silently; the bootstrap compares the archive with git ls-tree of the commit.
    { const attrib = (repo, text) => { fs.mkdirSync(path.join(repo, '.git', 'info'), { recursive: true }); fs.writeFileSync(path.join(repo, '.git', 'info', 'attributes'), text); };
      const archived = (f) => { const a = gitOut(f.env, f.repo, ['archive', '--format=tar', f.base, 'docs/plans'], true); return a.status === 0 ? RUN.parseTar(a.stdout) : null; };
      const fi = bootRepo('boot-xignore'); attrib(fi.repo, 'docs/plans/a.md export-ignore\n'); const ei = archived(fi);
      check('archive control (precondition, finding 4): a plain git archive of the base commit drops docs/plans/a.md when .git/info/attributes marks it export-ignore and still reports success (the defect is live)', ei !== null && !ei.some((e) => e.path === 'docs/plans/a.md') && ei.some((e) => e.path === 'docs/plans/sub/b.md'), ei === null ? 'git archive failed' : ei.map((e) => e.path));
      bad('an archive that drops a plan file (export-ignore in .git/info/attributes) fails the bootstrap, naming the missing file, and nothing is written to the view', /docs\/plans from the archive is not the base commit's \(1 difference\(s\)\): docs\/plans\/a\.md is missing/, { repo: fi.repo, base: fi.base });
      const subst = 'commit $Format:%H$ end\n'; const fx = bootRepo('boot-xsubst', { plans: { 'docs/plans/subst.md': subst } }); attrib(fx.repo, 'docs/plans/subst.md export-subst\n'); const ex = archived(fx); const sf = ex === null ? undefined : ex.find((e) => e.path === 'docs/plans/subst.md');
      check('archive control (precondition, finding 4): a plain git archive rewrites the $Format:%H$ placeholder of a file marked export-subst, so the plan bytes differ from the commit and git archive still reports success', sf !== undefined && !sf.data.equals(Buffer.from(subst)) && /^commit [0-9a-f]{40} end\n$/.test(sf.data.toString('utf8')), sf === undefined ? 'no subst.md in the archive' : sf.data.toString('utf8'));
      bad('an archive that rewrites a plan file (export-subst of a $Format:...$ placeholder in .git/info/attributes) fails the bootstrap, naming the file, and nothing is written to the view', /docs\/plans from the archive is not the base commit's \(1 difference\(s\)\): docs\/plans\/subst\.md has other bytes/, { repo: fx.repo, base: fx.base });
      const fb = bootRepo('boot-xboth', { plans: { 'docs/plans/subst.md': subst } }); attrib(fb.repo, 'docs/plans/a.md export-ignore\ndocs/plans/subst.md export-subst\n');
      bad('both defects at once are both reported (two differences), and nothing is written', /\(2 difference\(s\)\)/, { repo: fb.repo, base: fb.base });
      const fn = bootRepo('boot-xnone'); attrib(fn.repo, 'docs/plans/a.md -diff\ndocs/plans/sub/* linguist-generated\n'); const vn = bootView('boot-xnone-view'); const rn = RUN.bootstrapStrictGate(vn, fn.repo, { baseCommit: fn.base });
      check('archive control: attributes that do not change the archive (-diff, linguist-generated) are not refused (the comparison is by content, not by the presence of an attributes file)', rn.ok === true && rn.plans === 6, rn);
      // The comparison itself, on synthetic records.
      const blobFile = path.join(scratchDir('blob-id'), 'f.bin'); const odd = Buffer.concat([Buffer.from('one\r\ntwo\r\n'), Buffer.from([0, 255, 13, 10, 36])]); fs.writeFileSync(blobFile, odd);
      const viaGit = gitOut(F.env, F.repo, ['hash-object', '--no-filters', blobFile]).stdout.trim();
      check('archive control: gitBlobId equals git hash-object --no-filters on CRLF and binary bytes, and the id of the empty blob', RUN.gitBlobId(odd) === viaGit && RUN.gitBlobId(Buffer.alloc(0)) === 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391' && /^[0-9a-f]{40}$/.test(viaGit), { mine: RUN.gitBlobId(odd), git: viaGit });
      const A = Buffer.from('A\n'); const B = Buffer.from('B\n'); const rec = (p, buf, extra = {}) => ({ mode: '100644', type: 'blob', oid: RUN.gitBlobId(buf), path: p, ...extra });
      const recs = [rec('docs/plans/a.md', A), rec('docs/plans/b.md', B)]; const mapOf = (o) => new Map(Object.entries(o));
      const D = (r, files) => RUN.plansDifferences(r, mapOf(files));
      const results = [
        ['the same set and bytes', D(recs, { 'docs/plans/a.md': A, 'docs/plans/b.md': B }), (d) => d.length === 0],
        ['a missing file', D(recs, { 'docs/plans/a.md': A }), (d) => d.length === 1 && /b\.md is missing/.test(d[0])],
        ['an extra file', D(recs, { 'docs/plans/a.md': A, 'docs/plans/b.md': B, 'docs/plans/c.md': A }), (d) => d.length === 1 && /c\.md is extra/.test(d[0])],
        ['a file with other bytes of the same length', D(recs, { 'docs/plans/a.md': Buffer.from('X\n'), 'docs/plans/b.md': B }), (d) => d.length === 1 && /a\.md has other bytes/.test(d[0])],
        ['a file with converted line endings', D(recs, { 'docs/plans/a.md': Buffer.from('A\r\n'), 'docs/plans/b.md': B }), (d) => d.length === 1 && /a\.md has other bytes/.test(d[0])],
        ['a file renamed (one missing, one extra)', D(recs, { 'docs/plans/a.md': A, 'docs/plans/B.md': B }), (d) => d.length === 2],
        ['a symbolic link record', D([rec('docs/plans/a.md', A, { mode: '120000' })], { 'docs/plans/a.md': A }), (d) => d.length === 1 && /not a regular file/.test(d[0])],
        ['a submodule record', D([{ mode: '160000', type: 'commit', oid: '1'.repeat(40), path: 'docs/plans/sm' }], {}), (d) => d.some((x) => /not a regular file/.test(x))],
        ['an executable file record is a regular file', D([rec('docs/plans/a.md', A, { mode: '100755' })], { 'docs/plans/a.md': A }), (d) => d.length === 0],
        ['no record at all', D([], {}), (d) => d.length === 1 && /lists no file/.test(d[0])],
      ];
      check('archive control: plansDifferences reports a missing file, an extra file, other bytes (same length, converted line endings), a rename, a symbolic link, a submodule and an empty commit, and nothing for the same set with an executable bit', results.every(([, d, ok]) => ok(d)), results.filter(([, d, ok]) => !ok(d)).map(([n, d]) => [n, d]));
      const real = gitOut(F.env, F.repo, ['ls-tree', '-r', '-z', '--full-tree', F.base, 'docs/plans'], true); const parsed = attempt(() => RUN.parseLsTree(real.stdout));
      check('archive control: parseLsTree reads the real git ls-tree -r -z output (6 files, each oid the one git rev-parse gives), a path with a space and a newline, and refuses output that is not NUL-terminated or malformed', !failedAttempt(parsed) && parsed.length === 6 && parsed.every((r) => r.type === 'blob' && gitOut(F.env, F.repo, ['rev-parse', `${F.base}:${r.path}`]).stdout.trim() === r.oid) && RUN.parseLsTree(`100644 blob ${'a'.repeat(40)}\tdocs/plans/a b\nc.md\0`)[0].path === 'docs/plans/a b\nc.md' && RUN.parseLsTree('').length === 0 && ['100644 blob xyz\tdocs/plans/p\0', `100644 blob ${'a'.repeat(40)}\tdocs/plans/p`, `bad ${'a'.repeat(40)}\tdocs/plans/p\0`].every((t) => failedAttempt(attempt(() => RUN.parseLsTree(t)))), parsed); }
    // Finding 6: the base must be a commit, and the tags the strict gate verifies must exist exactly.
    { const treeId = F.g('rev-parse', `${F.base}^{tree}`).stdout.trim(); const tagObj = F.g('rev-parse', 'refs/tags/project-setup-v3.1.0').stdout.trim(); const blobId = F.g('rev-parse', `${F.base}:docs/plans/a.md`).stdout.trim();
      const kinds = [treeId, tagObj, blobId].map((id) => F.g('cat-file', '-t', id).stdout.trim()); const arch = (id) => gitOut(F.env, F.repo, ['archive', '--format=tar', id, 'docs/plans'], true).status;
      check('prerequisite control (precondition, finding 6): the base TREE id and the annotated tag id are 40-hex ids that git archive accepts for docs/plans exactly like the commit (so only a type check can refuse them)', JSON.stringify(kinds) === '["tree","tag","blob"]' && arch(treeId) === 0 && arch(tagObj) === 0 && arch(F.base) === 0, { kinds, tree: arch(treeId), tag: arch(tagObj) });
      bad('a base that is the id of a TREE object holding docs/plans is refused as not a commit, and nothing is written', /is a tree object, not a commit/, { base: treeId });
      bad('a base that is the id of an annotated TAG object is refused as not a commit (the commit id itself is required)', /is a tag object, not a commit/, { base: tagObj });
      bad('a base that is the id of a BLOB object is refused as not a commit', /is a blob object, not a commit/, { base: blobId });
      for (const name of ['project-setup-vgarbage', 'project-setup-v2.0.0-rc.1', 'project-setup-v2.0.1']) {
        const g = bootRepo(`boot-tag-${seq}`, { tags: name }); bad(`a repository whose only project-setup-v* tag is ${name} is refused: the exact tag project-setup-v2.0.0 is missing`, /lacks the tag project-setup-v2\.0\.0 as a commit/, { repo: g.repo, base: g.base, keepsGit: true, writes: true });
      }
      { const g = bootRepo('boot-treetag', { tags: 'treetag' }); bad('a project-setup-v2.0.0 tag that names a TREE, not a commit, is refused', /lacks the tag project-setup-v2\.0\.0 as a commit/, { repo: g.repo, base: g.base, keepsGit: true, writes: true }); }
      check('prerequisite control: the required tag list is exactly project-setup-v2.0.0 and is the tag tests/helpers/v2-baseline.mjs verifies', JSON.stringify(RUN.REQUIRED_TAGS) === '["project-setup-v2.0.0"]' && /tag: 'project-setup-v2\.0\.0'/.test(fs.readFileSync(path.join(SKILL, 'tests', 'helpers', 'v2-baseline.mjs'), 'utf8')), RUN.REQUIRED_TAGS);
      { const v1 = bootView('boot-req-ok'); const ok = RUN.bootstrapStrictGate(v1, F.repo, { baseCommit: F.base, requiredTags: ['project-setup-v2.0.0', 'project-setup-v3.1.0'] });
        check('prerequisite control: a required tag list is honoured: every listed tag must resolve to a commit (an annotated tag does, through ^{commit}) and the bootstrap succeeds', ok.ok === true, ok); }
    }
    { const v2 = bootView('boot-req-missing2'); const miss = RUN.bootstrapStrictGate(v2, F.repo, { baseCommit: F.base, requiredTags: ['project-setup-v9.9.9'] }); const v3 = bootView('boot-req-opt'); const opt = RUN.bootstrapStrictGate(v3, F.repo, { baseCommit: F.base, requiredTags: ['--output=x'] });
      check('prerequisite control: a required tag that does not exist is refused naming it (the option), and a name that is not a plain tag name (an option) is refused before any git call, with no .git and no docs/ in the view', miss.ok === false && /lacks the tag project-setup-v9\.9\.9 as a commit/.test(miss.error) && opt.ok === false && /plain tag name/.test(opt.error) && !fs.existsSync(path.join(v3, '.git')) && !fs.existsSync(path.join(v3, 'docs')), { miss, opt }); }
    // The tar reader and the writer, on crafted streams.
    const tarHeader = ({ name, size = 0, type = '0', prefix = '', edit = null }) => {
      const h = Buffer.alloc(512);
      h.write(name, 0, 100, 'utf8'); h.write('0000644\0', 100); h.write('0000000\0', 108); h.write('0000000\0', 116); h.write(`${size.toString(8).padStart(11, '0')}\0`, 124); h.write('00000000000\0', 136);
      h.fill(0x20, 148, 156); h.write(type, 156); h.write('ustar\0', 257); h.write('00', 263); h.write(prefix, 345, 155, 'utf8');
      if (edit !== null) edit(h);
      let sum = 0; for (const x of h) sum += x;
      h.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
      return h;
    };
    const tarOf = (entries, { end = true } = {}) => Buffer.concat([...entries.flatMap((e) => { const data = e.data ?? Buffer.alloc(0); return [tarHeader({ ...e, size: data.length }), data, Buffer.alloc((512 - (data.length % 512)) % 512)]; }), ...(end ? [Buffer.alloc(1024)] : [])]);
    const paxRec = (p) => { const body = ` path=${p}\n`; let len = body.length + 1; while (String(len).length + body.length !== len) len = String(len).length + body.length; return Buffer.from(`${len}${body}`); };
    { const entries = attempt(() => RUN.parseTar(tarOf([{ name: 'pax_global_header', type: 'g', data: Buffer.from(`52 comment=${'0123456789abcdef'.repeat(2)}01234567\n`) }, { name: 'docs/', type: '5' }, { name: 'docs/plans/', type: '5' }, { name: 'docs/plans/a.md', data: Buffer.from('A\n') }, { name: 'PaxHeader', type: 'x', data: paxRec(LONG_PAX) }, { name: 'short-name-replaced-by-pax', data: Buffer.from('P') }, { name: 'e.md', prefix: 'docs/plans/pre', data: Buffer.alloc(600, 66) }])));
      check('tar control: parseTar skips a pax global header, strips the trailing slash of directories, reads a file, a pax path record over the entry name, a ustar prefix and a body over one block', !failedAttempt(entries) && JSON.stringify(entries.map((e) => [e.path, e.type, e.data === null ? null : e.data.length])) === JSON.stringify([['docs', 'dir', null], ['docs/plans', 'dir', null], ['docs/plans/a.md', 'file', 2], [LONG_PAX, 'file', 1], ['docs/plans/pre/e.md', 'file', 600]]) && entries[2].data.toString('utf8') === 'A\n' && entries[4].data.equals(Buffer.alloc(600, 66)), entries);
    }
    { const one = (opts, data) => tarOf([{ name: 'docs/plans/a.md', data: data ?? Buffer.from('x'), ...opts }]);
      const flipped = Buffer.from(one({})); flipped[3] ^= 1;
      const cases = [['a header checksum that does not match', flipped, /checksum/], ['a stream cut inside a body', tarOf([{ name: 'docs/plans/a.md', data: Buffer.alloc(600, 65) }]).subarray(0, 700), /truncated/], ['a stream without its end marker', tarOf([{ name: 'docs/plans/a.md', data: Buffer.from('x') }], { end: false }), /end marker/], ['a symbolic link', one({ type: '2', data: Buffer.alloc(0) }), /type "2"/], ['a hard link', one({ type: '1', data: Buffer.alloc(0) }), /type "1"/], ['a character device', one({ type: '3', data: Buffer.alloc(0) }), /type "3"/], ['a size that is not octal', one({ edit: (h) => h.write('zzzzzzzzzzz\0', 124) }), /octal/], ['a base-256 size', one({ edit: (h) => { h[124] = 0x80; } }), /base-256/], ['a pax record with a bad length', tarOf([{ name: 'PaxHeader', type: 'x', data: Buffer.from('999 path=docs/plans/z.md\n') }, { name: 'a', data: Buffer.from('x') }]), /pax/]];
      const got = cases.map(([name, buf, rx]) => { try { RUN.parseTar(buf); return [name, 'parsed']; } catch (e) { return [name, rx.test(String(e.message)) ? 'refused' : `wrong error: ${e.message}`]; } });
      check('tar control: parseTar refuses a header checksum that does not match, a truncated stream, a missing end marker, a link, a device, a size that is not octal, a base-256 size and a malformed pax record, each with its own error', got.every(([, v]) => v === 'refused') && failedAttempt(attempt(() => RUN.parseTar('not a buffer'))), got);
    }
    { const refused = ['', '../x.md', 'docs/plans/../../x.md', '/etc/x', 'C:/x', 'D:x', 'docs\\plans\\x.md', 'docs/plans/x:y', 'docs/plans//x.md', 'docs/plans/./x.md', 'docs/other/x.md', 'other/x.md', 'docs/plans/con.md', 'docs/plans/nul', 'docs/plans/x.', 'docs/plans/x ', 'docs/plans/a\0b', 'docs/plans/a*b', 'docs/plansx/a.md', 'docs/plans/'];
      const accepted = ['docs', 'docs/plans', 'docs/plans/a.md', 'docs/plans/sub/b.md', 'docs/plans/console.md', LONG_PAX];
      const wrong = [...refused.filter((p) => RUN.planPathProblem(p) === null).map((p) => `accepted ${JSON.stringify(p)}`), ...accepted.filter((p) => RUN.planPathProblem(p) !== null).map((p) => `refused ${JSON.stringify(p)}`)];
      check('path control: planPathProblem accepts docs, docs/plans and plain paths below it, and refuses an empty path, a parent segment, an absolute or drive path, a backslash, a colon, an empty or "." segment, a path outside docs/plans, a Windows device name and a trailing dot or space', wrong.length === 0 && RUN.planPathProblem(undefined) !== null, wrong);
    }
    { const ent = (p, d) => ({ path: p, type: d === undefined ? 'dir' : 'file', data: d === undefined ? null : Buffer.from(d) });
      const w1 = scratchDir('wp-good'); const okRes = attempt(() => RUN.writePlans([ent('docs'), ent('docs/plans'), ent('docs/plans/a.md', 'A\n'), ent('docs/plans/s/b.md', 'B\n')], w1));
      const again = attempt(() => RUN.writePlans([ent('docs/plans/a.md', 'other\n')], w1));
      check('write control: writePlans writes the validated entries and returns the number of files, and never writes over an existing file', okRes === 2 && JSON.stringify(listFiles(w1)) === '["docs/plans/a.md","docs/plans/s/b.md"]' && failedAttempt(again) && fs.readFileSync(path.join(w1, 'docs', 'plans', 'a.md'), 'utf8') === 'A\n', { okRes, again });
      const refusals = [['a parent segment (leaves the view directory)', [ent('docs/plans/ok.md', 'ok'), ent('docs/plans/../../evil.md', 'x')]], ['a path outside docs/plans', [ent('docs/plans/ok.md', 'ok'), ent('other/x.md', 'x')]], ['two paths that differ only in letter case', [ent('docs/plans/A.md', 'A'), ent('docs/plans/a.md', 'a')]], ['no file at all (directories only)', [ent('docs'), ent('docs/plans')]]];
      const got = refusals.map(([name, entries]) => { const parent = scratchDir('wp-bad'); const d = path.join(parent, 'v'); fs.mkdirSync(d); const r = attempt(() => RUN.writePlans(entries, d)); return [name, failedAttempt(r) && listFiles(d).length === 0 && !fs.existsSync(path.join(d, 'docs')) && !fs.existsSync(path.join(parent, 'evil.md')) ? 'refused' : { r, files: listFiles(d) }]; });
      check('write control: writePlans refuses a parent segment, a path outside docs/plans, two paths that differ only in letter case and an archive with no file, and writes nothing (every entry is validated before the first is written, and nothing lands next to the view)', got.every(([, v]) => v === 'refused'), got);
    }
    // ======================================================================================================================================================================================
    // Review 4 fix round (tests session 6): N1 (Windows aliases and ONE canonical path), N2 (configuration isolation), N3 (replacement refs), N4 (file names that are not UTF-8).
    // ======================================================================================================================================================================================
    const farTmp = path.join(scratch, 'not-the-temp-dir'); const normP = (p) => String(p).replace(/\\/g, '/').toLowerCase();
    const splitGit = (args) => { let i = 0; const cfg = []; const opts = []; while (i < args.length && args[i].startsWith('-')) { if (args[i] === '-c') { cfg.push(args[i + 1]); i += 2; } else { opts.push(args[i]); i += 1; } } return { cfg, opts, sub: args[i], rest: args.slice(i + 1) }; };
    // ---- N1 ----
    { const f = bootRepo('n1-boot'); const srcBefore = fingerprint(f.repo); const parentBefore = fs.readdirSync(f.tmp).sort(); const sr = scratchDir('n1-scratch'); const calls = [];
      const rec = (cmd, args, o) => { calls.push({ args: [...args], cwd: o.cwd }); return spawnSync(cmd, args, o); };
      const cases = [['<repo>.', `${f.repo}.`], ['<repo><space>', `${f.repo} `], ['<repo>/sub.', path.join(f.repo, 'sub.')], ['<repo>./view (a child of the alias)', path.join(`${f.repo}.`, 'view')]];
      const got = cases.map(([n, v]) => [n, RUN.bootstrapStrictGate(v, f.repo, { baseCommit: f.base, platform: 'win32', scratchRoot: sr, git: rec })]);
      const rootAlias = RUN.bootstrapStrictGate(bootView('n1-root-view'), `${f.repo}.`, { baseCommit: f.base, platform: 'win32', scratchRoot: sr, git: rec });
      const bad1 = got.filter(([, r]) => !(r.ok === false && /ends with a dot or a space/.test(r.error) && !r.error.includes('\n') && /^the view directory is refused before anything is written/.test(r.error))).map(([n, r]) => [n, r]);
      check('bootstrap control (N1): on the win32 path a view directory spelled <repo>., <repo><space>, <repo>/sub. or <repo>./view is refused before ANY git call, isolation directory or write: no recorded call, the source repository byte for byte unchanged, no sibling created, the scratch root empty', bad1.length === 0 && calls.length === 0 && fingerprint(f.repo) === srcBefore && JSON.stringify(fs.readdirSync(f.tmp).sort()) === JSON.stringify(parentBefore) && fs.readdirSync(sr).length === 0, { bad1, calls: calls.length, listing: fs.readdirSync(f.tmp) });
      check('bootstrap control (N1): a repository root spelled <repo>. is refused the same way, naming the repository root, before any git call', rootAlias.ok === false && /^the repository root is refused before anything is written.*ends with a dot or a space/.test(rootAlias.error) && calls.length === 0, rootAlias);
      const opts = { repoRoot: f.repo, tmp: farTmp, spawn: () => { spy.spawn += 1; return { status: 0, stdout: '' }; }, bootstrap: () => { spy.boot += 1; return { ok: true, plans: 0, tags: 0, commit: 'x' }; } }; const spy = { spawn: 0, boot: 0 };
      const runs = [['<repo>.', `${f.repo}.`], ['<repo><space>', `${f.repo} `]].map(([n, v]) => [n, RUN.runView(['--out', v, '--run', 'accept-rc1'], { ...opts, platform: 'win32' })]);
      check('runner control (N1): runView on the win32 path refuses --out <repo>. and --out <repo><space> with exit 2 before the view is built: no gate, no bootstrap, the source repository unchanged, nothing created beside it', runs.every(([, r]) => r.code === 2 && r.lines.some((l) => /^RUN-310-VIEW {2}REFUSED {2}the view directory is refused before anything is written.*ends with a dot or a space/.test(l))) && spy.spawn === 0 && spy.boot === 0 && fingerprint(f.repo) === srcBefore && JSON.stringify(fs.readdirSync(f.tmp).sort()) === JSON.stringify(parentBefore), { runs: runs.map(([n, r]) => [n, r.code, r.lines.slice(0, 2)]), spy });
      if (process.platform === 'win32') { const real = RUN.runView(['--out', `${f.repo}.`, '--run', 'accept-rc1'], opts); check('runner control (N1): on a real Windows host the DEFAULT platform gate (no injected platform) refuses --out <repo>. too, and nothing is built or written', real.code === 2 && real.lines.some((l) => /ends with a dot or a space/.test(l)) && spy.spawn === 0 && spy.boot === 0 && fingerprint(f.repo) === srcBefore && JSON.stringify(fs.readdirSync(f.tmp).sort()) === JSON.stringify(parentBefore), real.lines.slice(0, 3)); }
      else skip('runner control (N1): the default platform gate refuses --out <repo>. on a real Windows host', 'this host is not Windows: the injected-platform control above carries the claim');
      { const vb = scratchDir('n1-bv'); const r1 = attempt(() => H.buildView({ repoRoot: f.repo, outDir: `${path.join(vb, 'v')}.`, platform: 'win32' })); const r2 = attempt(() => H.buildView({ repoRoot: `${f.repo}.`, outDir: path.join(vb, 'w'), platform: 'win32' }));
        check('view control (N1): buildView refuses an outDir or a repoRoot spelled with a trailing dot on the win32 path before anything is written (nothing is created beside it), and says why', failedAttempt(r1) && /ends with a dot or a space/.test(r1.threw) && failedAttempt(r2) && /ends with a dot or a space/.test(r2.threw) && fs.readdirSync(vb).length === 0, { r1, r2, listing: fs.readdirSync(vb) }); }
    }
    // ONE canonical path: a view given through a link, in another letter case or through its 8.3 short name is checked as spelled and then every cwd, --git-dir, --work-tree and init target is the canonical real path.
    { const sr = scratchDir('n1-canon-scratch'); const canonCheck = (label, spelledOf) => {
        const g = bootRepo(`n1-${label}`); const realV = bootView(`n1-${label}-view`); const spelled = spelledOf(realV);
        if (typeof spelled !== 'string') { skip(`bootstrap control (N1): a view directory given ${label} is used only as its canonical real path`, spelled.reason); return; }
        const cs = []; const recc = (cmd, args, o) => { cs.push({ args: [...args], cwd: o.cwd }); return spawnSync(cmd, args, o); };
        const r = RUN.bootstrapStrictGate(spelled, g.repo, { baseCommit: g.base, git: recc, scratchRoot: sr });
        const canon = fs.realpathSync.native(realV); const srcCanon = fs.realpathSync.native(g.repo); const viewCalls = cs.filter((c) => c.cwd !== srcCanon); const srcCalls = cs.filter((c) => c.cwd === srcCanon);
        const usedSpelled = cs.filter((c) => c.cwd === spelled || c.args.some((a) => a.includes(spelled)));
        const bound = viewCalls.every((c) => { const s = splitGit(c.args); return s.sub === 'init' ? c.args[c.args.length - 1] === canon : s.opts.includes(`--git-dir=${path.join(canon, '.git')}`) && s.opts.includes(`--work-tree=${canon}`); }) && srcCalls.every((c) => splitGit(c.args).opts.includes(`--git-dir=${path.join(srcCanon, '.git')}`));
        check(`bootstrap control (N1): a view directory given ${label} is checked as spelled and then used ONLY as its canonical real path: every recorded cwd, --git-dir, --work-tree and init target is the real directory, never the spelling`, spelled !== canon && r.ok === true && cs.length >= 10 && usedSpelled.length === 0 && srcCalls.length === 3 && viewCalls.length === cs.length - 3 && viewCalls.every((c) => c.cwd === canon) && bound && fs.existsSync(path.join(realV, '.git')) && fs.existsSync(path.join(realV, 'docs', 'plans', 'a.md')), { spelled, canon, r, usedSpelled: usedSpelled.length, cwds: [...new Set(cs.map((c) => c.cwd))] });
      };
      canonCheck('through a link', (realV) => { const lp = scratchDir('n1-links'); const link = path.join(lp, 'via-link'); try { fs.symlinkSync(realV, link, 'junction'); return link; } catch (e) { return { reason: `a link could not be created on this platform (${String(e && e.code ? e.code : e)})` }; } });
      canonCheck('in another letter case', (realV) => (process.platform === 'win32' ? realV.toUpperCase() : { reason: 'the file system of this platform is case-sensitive: an upper-cased spelling is another path' }));
      canonCheck('through its 8.3 short name', (realV) => shortPathOf(realV) ?? { reason: process.platform === 'win32' ? 'not exercised: this volume has no 8.3 short name for the view directory (short-name generation is off)' : 'not exercised: 8.3 short names are a Windows feature' });
      { const out2 = scratchDir('n1-run-links'); const target = scratchDir('n1-run-target'); const link = path.join(out2, 'via-link'); let le = null; try { fs.symlinkSync(target, link, 'junction'); } catch (e) { le = String(e && e.code ? e.code : e); }
        if (le !== null) skip('runner control (N1): runView given --out through a link builds the view in the link target and starts the gate with the canonical cwd', `a link could not be created on this platform (${le})`);
        else { const seen = []; const r = RUN.runView(['--out', path.join(link, 'v'), ...(process.env.V320_INCLUDE_UNTRACKED === '1' ? ['--include-untracked'] : []), '--run', 'release-3.1'], { repoRoot: REPO, tmp: farTmp, spawn: (cmd, args, o) => { seen.push({ args, cwd: o.cwd }); return { status: 0, stdout: '1 PASS / 0 FAIL / 0 SKIP\n' }; } });
          const canonOut = path.join(fs.realpathSync.native(target), 'v');
          check('runner control (N1): runView given --out through a link builds the view in the real directory and starts the gate with the canonical path as cwd and in the gate file path, never the link spelling', r.code === 0 && seen.length === 1 && seen[0].cwd === canonOut && path.dirname(path.dirname(path.dirname(seen[0].args[0]))) === canonOut && fs.existsSync(path.join(canonOut, 'project-setup', 'SKILL.md')) && !seen[0].args[0].includes('via-link'), { r: r.lines.slice(0, 3), seen: seen.map((s) => [s.cwd, s.args[0]]) }); } }
    }
    // ---- N2: the configuration is the runner's, not the user's ----
    // A hostile user configuration in every place git reads one: the home directory, XDG, GIT_CONFIG_GLOBAL, the system level (GIT_CONFIG_NOSYSTEM=0) and the command-line style variables.
    const mkHostile = (label, srcRepo) => {
      const gd = scratchDir(label); const marker = path.join(gd, 'ran.txt'); const hooks = path.join(gd, 'hooks'); fs.mkdirSync(hooks);
      for (const h of ['pre-commit', 'commit-msg', 'post-commit', 'post-index-change']) { fs.writeFileSync(path.join(hooks, h), `#!/bin/sh\necho ${h} >> "${slashed(marker)}"\nexit 1\n`); fs.chmodSync(path.join(hooks, h), 0o755); }
      const fsm = path.join(gd, 'fsmonitor.mjs'); fs.writeFileSync(fsm, `import fs from 'node:fs';\nfs.appendFileSync(${JSON.stringify(slashed(marker))}, 'fsmonitor\\n');\nprocess.stdout.write('\\0');\n`);
      const q = (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
      const text = `[core]\n\tworktree = ${slashed(srcRepo)}\n\thooksPath = ${slashed(hooks)}\n\tfsmonitor = ${q(`"${slashed(process.execPath)}" "${slashed(fsm)}"`)}\n\tautocrlf = true\n[protocol "file"]\n\tallow = never\n[commit]\n\tgpgsign = true\n[gpg]\n\tprogram = ${slashed(gd)}/no-such-gpg\n[user]\n\tname = Hostile Person\n\temail = hostile@example.invalid\n`;
      const globalFile = path.join(gd, 'global-hostile.cfg'); fs.writeFileSync(globalFile, text); fs.writeFileSync(path.join(gd, '.gitconfig'), text); fs.mkdirSync(path.join(gd, 'xdg', 'git'), { recursive: true }); fs.writeFileSync(path.join(gd, 'xdg', 'git', 'config'), text);
      const home = { HOME: gd, USERPROFILE: gd, XDG_CONFIG_HOME: path.join(gd, 'xdg') };
      return { gd, marker, home, globalFile, text, env: { ...home, GIT_CONFIG_GLOBAL: globalFile, GIT_CONFIG_NOSYSTEM: '0', GIT_CONFIG_SYSTEM: path.join(gd, 'no-system'), GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.hooksPath', GIT_CONFIG_VALUE_0: hooks, GIT_CONFIG_PARAMETERS: "'protocol.file.allow'='never'" } };
    };
    const originsOf = (eff) => { const parts = String(eff).split('\0'); const out = []; for (let i = 0; i + 1 < parts.length; i += 2) out.push({ origin: parts[i], kv: parts[i + 1] }); return out; };
    { const f = bootRepo('n2-anat'); const v = bootView('n2-anat-view'); const sr = scratchDir('n2-anat-scratch'); const h = mkHostile('n2-anat-cfg', f.repo); const calls = [];
      const probe = (cwd, env, args) => spawnSync('git', args, { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 120000 });
      const rec = (cmd, args, o) => { const cfg = o.env.GIT_CONFIG_GLOBAL; const eff = probe(o.cwd, o.env, ['config', '--list', '--show-origin', '-z']); const keys = probe(o.cwd, o.env, ['config', '--file', cfg, '--list', '--name-only']); const vals = probe(o.cwd, o.env, ['config', '--file', cfg, '--list']);
        calls.push({ args: [...args], cwd: o.cwd, env: o.env, effStatus: eff.status, eff: String(eff.stdout ?? ''), keys: String(keys.stdout ?? '').split('\n').filter(Boolean).sort(), vals: String(vals.stdout ?? '').split('\n').filter(Boolean).sort(), home: fs.readdirSync(o.env.HOME), hooks: fs.readdirSync(path.join(path.dirname(cfg), 'hooks')) }); return spawnSync(cmd, args, o); };
      // precondition: the probe sees the hostile files when nothing isolates git (what scrubbing GIT_CONFIG_GLOBAL used to leave: the home and XDG files, the system file)
      const oldEnv = { ...cleanProcessEnv(), ...h.home, GIT_TERMINAL_PROMPT: '0' }; const oldEff = probe(v, oldEnv, ['config', '--list', '--show-origin', '-z']); const oldFiles = originsOf(oldEff.stdout).map((x) => (x.origin.startsWith('file:') ? normP(path.resolve(v, x.origin.slice(5))) : null)).filter(Boolean);
      check('precondition (N2): with only the environment scrubbing used to leave (no GIT_CONFIG_GLOBAL, the home directory unchanged) git reads the hostile ~/.gitconfig and the hostile XDG file (the effective-configuration probe of the controls below sees them, so it is not vacuous)', oldFiles.includes(normP(path.join(h.gd, '.gitconfig'))) && oldFiles.includes(normP(path.join(h.gd, 'xdg', 'git', 'config'))), oldFiles);
      const r = withEnv({ ...hostileGitVars(f.tmp), ...h.env }, () => RUN.bootstrapStrictGate(v, f.repo, { baseCommit: f.base, git: rec, scratchRoot: sr }));
      const srcCanon = fs.realpathSync.native(f.repo); const viewCanon = fs.realpathSync.native(v); const allowedLocal = [normP(path.join(srcCanon, '.git', 'config')), normP(path.join(viewCanon, '.git', 'config'))];
      const filesOf = (c) => [...new Set(originsOf(c.eff).map((x) => (x.origin.startsWith('file:') ? normP(path.resolve(c.cwd, x.origin.slice(5))) : `non-file:${x.origin}`)))]; // git prints the local file relative to the cwd (".git/config")
      const foreign = calls.map((c, i) => [i, filesOf(c).filter((p) => p !== normP(c.env.GIT_CONFIG_GLOBAL) && !allowedLocal.includes(p))]).filter(([, x]) => x.length > 0);
      check('bootstrap control (N2): the effective configuration of EVERY git call (git config --list --show-origin with the call\'s own environment and cwd, hostile home, XDG, GIT_CONFIG_GLOBAL, GIT_CONFIG_SYSTEM and GIT_CONFIG_NOSYSTEM=0 in the caller\'s environment) comes only from the runner\'s own file and the repository\'s own .git/config: no home, XDG, system or caller file, no command-line style source, and the runner\'s file is really loaded', r.ok === true && calls.length >= 10 && calls.every((c) => c.effStatus === 0) && foreign.length === 0 && calls.every((c) => filesOf(c).includes(normP(c.env.GIT_CONFIG_GLOBAL))), { r, calls: calls.length, foreign, statuses: calls.map((c) => c.effStatus) });
      check('bootstrap control (N2): in no call\'s effective configuration is there a core.worktree, a core.fsmonitor, a core.hooksPath other than the runner\'s empty directory, a gpg setting or a hostile identity; protocol.file.allow is always', calls.length >= 10 && calls.every((c) => { const kvs = originsOf(c.eff).map((x) => x.kv); const get = (k) => kvs.filter((x) => x.toLowerCase().startsWith(`${k}\n`)).map((x) => x.slice(k.length + 1)); const emptyHooks = normP(path.join(path.dirname(c.env.GIT_CONFIG_GLOBAL), 'hooks')); return get('core.worktree').length === 0 && get('core.fsmonitor').length === 0 && get('core.hookspath').every((x) => normP(x) === emptyHooks) && get('gpg.program').length === 0 && get('commit.gpgsign').length === 0 && get('user.name').length === 1 && get('user.name').every((x) => x === 'run-310-view') && get('protocol.file.allow').every((x) => x === 'always') && get('protocol.file.allow').length === 1; }), calls.map((c) => originsOf(c.eff).map((x) => x.kv).filter((x) => /^(core\.worktree|core\.fsmonitor|user\.name|protocol\.file\.allow)\n/i.test(x))).slice(0, 2));
      const cfg0 = calls.length > 0 ? calls[0] : null; const hooksDir0 = cfg0 === null ? '' : normP(path.join(path.dirname(cfg0.env.GIT_CONFIG_GLOBAL), 'hooks'));
      check('bootstrap control (N2): the runner-owned configuration file holds exactly user.name, user.email, core.autocrlf, core.hooksPath (an empty directory) and protocol.file.allow, with these values, and nothing else', cfg0 !== null && JSON.stringify(cfg0.keys) === JSON.stringify(['core.autocrlf', 'core.hookspath', 'protocol.file.allow', 'user.email', 'user.name']) && cfg0.vals.includes('user.name=run-310-view') && cfg0.vals.includes('user.email=run-310-view@example.invalid') && cfg0.vals.includes('core.autocrlf=false') && cfg0.vals.includes('protocol.file.allow=always') && cfg0.vals.some((x) => /^core\.hookspath=/i.test(x) && normP(x.slice(x.indexOf('=') + 1)) === hooksDir0) && calls.every((c) => c.hooks.length === 0), cfg0 === null ? 'no call' : { keys: cfg0.keys, vals: cfg0.vals });
      const envOk = (c) => { const e = c.env; const homeDir = path.join(path.dirname(e.GIT_CONFIG_GLOBAL), 'home'); return e.GIT_CONFIG_NOSYSTEM === '1' && e.GIT_ATTR_NOSYSTEM === '1' && normP(e.HOME) === normP(homeDir) && normP(e.USERPROFILE) === normP(homeDir) && normP(e.XDG_CONFIG_HOME) === normP(homeDir) && normP(e.GIT_CONFIG_GLOBAL).startsWith(`${normP(sr)}/run310-git-`) && normP(e.GIT_CONFIG_GLOBAL).endsWith('/gitconfig') && !normP(e.HOME).includes(normP(h.gd)); };
      check('bootstrap control (N2): every call runs with GIT_CONFIG_NOSYSTEM=1, GIT_ATTR_NOSYSTEM=1, GIT_CONFIG_GLOBAL naming a file in a fresh run310-git-* directory under the scratch root, and HOME, USERPROFILE and XDG_CONFIG_HOME all naming the same EMPTY directory there (never the hostile home), and the home directory stays empty during the whole bootstrap', calls.length >= 10 && calls.every(envOk) && calls.every((c) => c.home.length === 0), calls.map((c) => [c.env.HOME, c.home]).slice(0, 2));
      const subs = calls.map((c) => splitGit(c.args)); const viewSubs = subs.filter((s, i) => calls[i].cwd !== srcCanon);
      check('bootstrap control (N2, N3): the calls, in order, are cat-file, archive and ls-tree (reads of the source) then init, fetch, tag, rev-parse, add, commit, rev-parse (the view); every one carries --no-replace-objects; the source reads name --git-dir=<repo>/.git and have the repository as cwd; every call that touches the view (all but init) names --git-dir=<view>/.git AND --work-tree=<view>, init names the view as its target, and every view call has the view as cwd', JSON.stringify(subs.map((s) => s.sub)) === JSON.stringify(['cat-file', 'archive', 'ls-tree', 'init', 'fetch', 'tag', 'rev-parse', 'add', 'commit', 'rev-parse']) && subs.every((s) => s.opts.includes('--no-replace-objects')) && subs.slice(0, 3).every((s, i) => calls[i].cwd === srcCanon && s.opts.includes(`--git-dir=${path.join(srcCanon, '.git')}`) && !s.opts.some((o) => o.startsWith('--work-tree'))) && subs.slice(3).every((s, i) => calls[i + 3].cwd === viewCanon && (s.sub === 'init' ? calls[i + 3].args[calls[i + 3].args.length - 1] === viewCanon : s.opts.includes(`--git-dir=${path.join(viewCanon, '.git')}`) && s.opts.includes(`--work-tree=${viewCanon}`))) && viewSubs.length === 7, { subs: subs.map((s) => [s.sub, s.opts]), cwds: calls.map((c) => c.cwd) });
      check('bootstrap control (N2): the runner\'s isolation directory is created fresh under the scratch root and removed when the bootstrap ends: the scratch root is empty afterwards and the result says so', r.isolationCleaned === true && fs.readdirSync(sr).length === 0 && calls.length > 0 && !fs.existsSync(path.dirname(calls[0].env.GIT_CONFIG_GLOBAL)), { r, left: fs.readdirSync(sr) });
      { const sr2 = scratchDir('n2-clean-scratch'); const g2 = bootRepo('n2-clean'); const v2 = bootView('n2-clean-view');
        const failed = RUN.bootstrapStrictGate(v2, g2.repo, { baseCommit: '1'.repeat(40), scratchRoot: sr2 }); const early = RUN.bootstrapStrictGate(bootView('n2-clean-view2'), g2.repo, { baseCommit: 'HEAD', scratchRoot: sr2 }); const thrown = RUN.bootstrapStrictGate(bootView('n2-clean-view3'), g2.repo, { baseCommit: g2.base, scratchRoot: sr2, git: () => { throw new Error('the git function exploded'); } });
        check('bootstrap control (N2): the isolation directory is removed on every path: a git failure (unknown base commit) and a git function that throws both leave the scratch root empty with isolationCleaned true, and a refusal before any git call never creates one', failed.ok === false && failed.isolationCleaned === true && thrown.ok === false && /exploded/.test(thrown.error) && thrown.isolationCleaned === true && early.ok === false && early.isolationCleaned === undefined && fs.readdirSync(sr2).length === 0, { failed, early, thrown, left: fs.readdirSync(sr2) }); }
    }
    // The outcome, with the real git: hostile configuration everywhere, the bootstrap still succeeds, the source repository is untouched and the view is the view.
    { const f = bootRepo('n2-out'); const h = mkHostile('n2-out-cfg', f.repo); const oldEnv = { ...cleanProcessEnv(), ...h.home, GIT_TERMINAL_PROMPT: '0' };
      const pr = scratchDir('n2-pre'); const pg = (...a) => spawnSync('git', a, { cwd: pr, env: oldEnv, encoding: 'utf8', windowsHide: true, timeout: 120000 }); pg('init', '-q'); const pf = pg('fetch', '-q', f.repo, 'refs/tags/*:refs/tags/*');
      check('precondition (N2): with only the home-directory configuration (what scrubbing GIT_CONFIG_GLOBAL used to leave) the bootstrap\'s local tag fetch FAILS (protocol.file.allow=never), so the outcome controls below are not vacuous', pf.status !== 0 && /not allowed/.test(String(pf.stderr)), { status: pf.status, err: String(pf.stderr).slice(0, 160) });
      const pw = scratchDir('n2-pre-wt'); fs.writeFileSync(path.join(pw, 'only-here.txt'), 'x\n'); const pgw = (...a) => spawnSync('git', a, { cwd: pw, env: oldEnv, encoding: 'utf8', windowsHide: true, timeout: 120000 }); pgw('init', '-q'); pgw('add', '-A');
      const staged = pgw('ls-files').stdout.split('\n').filter(Boolean); const srcTracked = f.g('ls-files').stdout.split('\n').filter(Boolean); const wtLive = staged.some((n) => srcTracked.includes(n));
      const preRan = fs.existsSync(h.marker) ? fs.readFileSync(h.marker, 'utf8') : ''; fs.rmSync(h.marker, { force: true }); // the unbound probes above are meant to run the hostile monitor and hook: record that, then clear the marker for the outcome controls
      if (/fsmonitor/.test(preRan) && /post-index-change/.test(preRan)) check('precondition (N2): under the home-directory configuration alone an unbound git add -A runs the hostile executable core.fsmonitor and the hostile post-index-change hook (marker file), so "no hook or monitor ran" below is not vacuous', true);
      else skip('precondition (N2): under the home-directory configuration alone an unbound git add -A runs the hostile core.fsmonitor and hook', `the marker shows ${JSON.stringify(preRan)}: a hook or monitor could not be made to run here (executable bits or a missing shell); the argv control asserts the pinned flags instead`);
      if (wtLive) check('precondition (N2): a global core.worktree naming the source repository really redirects an unbound git add -A of a view (the view\'s index gets the source files)', wtLive, staged);
      else skip('precondition (N2): a global core.worktree naming the source repository redirects an unbound git add -A of a view', `not live on ${spawnSync('git', ['--version'], { encoding: 'utf8' }).stdout.trim()}: it ignores a global core.worktree when it finds the repository by its own .git (the view\'s index got only its own file); the setting stays in the hostile configuration below and the bound calls (--git-dir, --work-tree) are asserted by the argv control above`);
      const viewFiles = ['project-setup/x.md', 'project-setup/crlf.md', 'project-setup/sub/note.md', 'README.md'];
      const outcome = (label, envOf, extra = {}) => {
        const v = bootView(`n2-${label}-view`); const sr = scratchDir(`n2-${label}-scratch`); const ff = label === 'home' ? f : bootRepo(`n2-${label}`); const hh = label === 'home' ? h : mkHostile(`n2-${label}-cfg`, ff.repo);
        const before = fingerprint(ff.repo); const gitBefore = fingerprint(path.join(ff.repo, '.git')); const headBefore = fs.readFileSync(path.join(ff.repo, '.git', 'HEAD'), 'utf8'); const idxBefore = fs.readFileSync(path.join(ff.repo, '.git', 'index')); const cfgBefore = fs.readFileSync(path.join(ff.repo, '.git', 'config'), 'utf8');
        const r = withEnv(envOf(hh, ff), () => RUN.bootstrapStrictGate(v, ff.repo, { baseCommit: ff.base, scratchRoot: sr }));
        const gx = (...a) => gitOut(ff.env, v, a); const ls = gx('ls-files').stdout.split('\n').filter(Boolean).sort(); const baseFiles = gitOut(ff.env, ff.repo, ['ls-tree', '-r', '-z', '--name-only', ff.base, 'docs/plans']).stdout.split('\0').filter(Boolean);
        const want = [...viewFiles, ...baseFiles].sort();
        const conds = { succeeded: r.ok === true, 'tracked files are the view and the base plans': JSON.stringify(ls) === JSON.stringify(want), 'README.md is the view\'s': gx('show', 'HEAD:README.md').stdout === '# view readme\n', 'one commit': gx('rev-list', '--count', 'HEAD').stdout.trim() === '1', 'clean status': gx('status', '--porcelain').stdout === '', 'fixed identity': gx('log', '-1', '--format=%an <%ae>').stdout.trim() === 'run-310-view <run-310-view@example.invalid>', 'no worktree in the view config': (() => { try { return !/worktree/i.test(fs.readFileSync(path.join(v, '.git', 'config'), 'utf8')); } catch { return false; } })(), 'no hook or monitor ran': !fs.existsSync(hh.marker), 'source tree unchanged': fingerprint(ff.repo) === before, 'source .git unchanged': fingerprint(path.join(ff.repo, '.git')) === gitBefore, 'source HEAD unchanged': fs.readFileSync(path.join(ff.repo, '.git', 'HEAD'), 'utf8') === headBefore, 'source index unchanged': fs.readFileSync(path.join(ff.repo, '.git', 'index')).equals(idxBefore), 'source config unchanged': fs.readFileSync(path.join(ff.repo, '.git', 'config'), 'utf8') === cfgBefore, 'scratch root empty': fs.readdirSync(sr).length === 0, 'isolation cleaned': r.isolationCleaned === true };
        check(`bootstrap control (N2): ${extra.name}: it still succeeds and builds the view (tracked files are exactly the view's and the base commit's plans, README.md is the view's, one commit, clean status, the fixed identity, no core.worktree in the view's repository), runs no hook and no file-system monitor, and leaves the source repository byte for byte as it was (HEAD, index, refs, config, working tree) and the scratch root empty`, Object.values(conds).every((x) => x === true), { failing: Object.entries(conds).filter(([, x]) => x !== true).map(([k]) => k), r, hooksRan: fs.existsSync(hh.marker) ? fs.readFileSync(hh.marker, 'utf8') : null });
      };
      outcome('home', (hh) => ({ ...hostileGitVars(hh.gd), ...hh.env }), { name: 'a hostile configuration in every place (a home .gitconfig and an XDG file with core.worktree naming the source repository, protocol.file.allow=never, an executable core.fsmonitor, hooks, autocrlf, signing and another identity; a hostile GIT_CONFIG_GLOBAL; GIT_CONFIG_SYSTEM; GIT_CONFIG_NOSYSTEM=0; GIT_CONFIG_COUNT and GIT_CONFIG_PARAMETERS)' });
      outcome('fallback', (hh, ff) => ({ ...hh.home, GIT_CONFIG_GLOBAL: ff.env.GIT_CONFIG_GLOBAL, GIT_CONFIG_NOSYSTEM: '1' }), { name: 'the caller isolates GIT_CONFIG_GLOBAL (a clean file) but the DEFAULT home configuration is hostile (the default-configuration fallback that dropping GIT_CONFIG_GLOBAL used to open)' });
      { const f2 = bootRepo('n2-none'); const v2 = bootView('n2-none-view'); const nd = path.join(scratchDir('n2-none-cfg'), 'does-not-exist'); const sr = scratchDir('n2-none-scratch');
        const r2 = withEnv({ HOME: nd, USERPROFILE: nd, XDG_CONFIG_HOME: nd, GIT_CONFIG_GLOBAL: path.join(nd, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1' }, () => RUN.bootstrapStrictGate(v2, f2.repo, { baseCommit: f2.base, scratchRoot: sr })); const g2 = (...a) => gitOut(f2.env, v2, a);
        check('bootstrap control (N2): the bootstrap does not depend on any user configuration: with no home directory, no XDG directory and no global file at all (no user.name, no user.email anywhere) it still commits, with the runner\'s identity', r2.ok === true && g2('log', '-1', '--format=%an <%ae>').stdout.trim() === 'run-310-view <run-310-view@example.invalid>' && g2('rev-list', '--count', 'HEAD').stdout.trim() === '1', r2); }
    }
    // createGitIsolation itself: the environment is the caller's without GIT_* plus the runner's variables, case-insensitively replaced, and the directory is only ever one it created.
    { const sr = scratchDir('n2-iso'); const iso = RUN.createGitIsolation({ scratchRoot: sr, base: { PATH: 'p', Home: 'stale-home', userprofile: 'stale-up', xdg_config_home: 'stale-x', Git_Config_Global: 'stale', GIT_DIR: 'd', KEEP: 'k', git_no_replace_objects: '1' } });
      const keys = Object.keys(iso.env); const ci = (n) => keys.filter((k) => k.toUpperCase() === n);
      check('isolation control (N2): createGitIsolation returns the caller\'s variables without any GIT_* one, plus exactly one (case-insensitively unique) HOME, USERPROFILE, XDG_CONFIG_HOME, GIT_CONFIG_GLOBAL, GIT_CONFIG_NOSYSTEM, GIT_ATTR_NOSYSTEM and GIT_TERMINAL_PROMPT with the runner\'s values, in a directory it created under the scratch root, which cleanup() removes (and reports so)', iso.env.KEEP === 'k' && iso.env.PATH === 'p' && ['HOME', 'USERPROFILE', 'XDG_CONFIG_HOME', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM', 'GIT_ATTR_NOSYSTEM', 'GIT_TERMINAL_PROMPT'].every((n) => ci(n).length === 1) && iso.env.HOME !== 'stale-home' && iso.env.USERPROFILE === iso.env.HOME && iso.env.GIT_CONFIG_GLOBAL === iso.config && !keys.some((k) => /^GIT_/i.test(k) && !['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM', 'GIT_ATTR_NOSYSTEM', 'GIT_TERMINAL_PROMPT'].includes(k)) && path.dirname(iso.dir) === sr && /^run310-git-/.test(path.basename(iso.dir)) && fs.readFileSync(iso.config, 'utf8') === RUN.runnerGitConfig(iso.hooks) && fs.readdirSync(iso.home).length === 0 && fs.readdirSync(iso.hooks).length === 0 && iso.cleanup() === true && !fs.existsSync(iso.dir) && fs.readdirSync(sr).length === 0, { keys, dir: iso.dir }); }
    // ---- N3: replacement refs ----
    // git reads replacement objects by default: a refs/replace/<base> entry makes archive AND ls-tree read another commit, so their paths and blob ids agree and the plans of that other commit are accepted.
    { const f = bootRepo('n3-repl'); const headC = f.g('rev-parse', 'HEAD').stdout.trim(); const rp = f.g('replace', f.base, headC); const sr = scratchDir('n3-scratch');
      const archOf = (extra) => { const a = gitOut(f.env, f.repo, [...extra, 'archive', '--format=tar', f.base, 'docs/plans'], true); return a.status === 0 ? RUN.parseTar(a.stdout).filter((e) => e.type === 'file') : null; };
      const dataOf = (es, p) => { const e = es === null ? undefined : es.find((x) => x.path === p); return e === undefined ? null : e.data.toString('utf8'); };
      const plain = archOf([]); const pinned = archOf(['--no-replace-objects']);
      check('precondition (N3): with a refs/replace entry for the base commit a plain git archive returns the REPLACEMENT commit\'s plans (a.md "head a", the new c-new.md, no sub/b.md) while --no-replace-objects returns the base commit\'s (so the defect is live and the flag is what protects)', rp.status === 0 && plain !== null && dataOf(plain, 'docs/plans/a.md') === 'head a\n' && plain.some((e) => e.path === 'docs/plans/c-new.md') && !plain.some((e) => e.path === 'docs/plans/sub/b.md') && pinned !== null && dataOf(pinned, 'docs/plans/a.md') === 'base a\n' && pinned.some((e) => e.path === 'docs/plans/sub/b.md'), { replace: rp.status, plain: plain === null ? null : plain.map((e) => e.path) });
      const v = bootView('n3-repl-view'); const r = RUN.bootstrapStrictGate(v, f.repo, { baseCommit: f.base, scratchRoot: sr });
      const present = fs.existsSync(path.join(v, 'docs')) ? listFiles(path.join(v, 'docs')).map((x) => `docs/${x}`) : [];
      const baseNames = gitOut(f.env, f.repo, ['--no-replace-objects', 'ls-tree', '-r', '-z', '--name-only', f.base, 'docs/plans']).stdout.split('\0').filter(Boolean).sort(); const gvn = (...a) => gitOut(f.env, v, a);
      check('bootstrap control (N3): with that refs/replace entry the bootstrap writes the ORIGINAL committed plans of the base commit, byte for byte (a.md is "base a", sub/b.md exists, the replacement\'s c-new.md does not, every blob equals the unreplaced one), and the view repository holds no replacement ref and tags the original base commit', r.ok === true && JSON.stringify(present) === JSON.stringify(baseNames) && baseNames.length === 6 && fs.readFileSync(path.join(v, 'docs', 'plans', 'a.md'), 'utf8') === 'base a\n' && fs.existsSync(path.join(v, 'docs', 'plans', 'sub', 'b.md')) && !fs.existsSync(path.join(v, 'docs', 'plans', 'c-new.md')) && baseNames.every((rel) => Buffer.compare(fs.readFileSync(path.join(v, ...rel.split('/'))), gitOut(f.env, f.repo, ['--no-replace-objects', 'cat-file', 'blob', `${f.base}:${rel}`], true).stdout) === 0) && gvn('for-each-ref', 'refs/replace').stdout.trim() === '' && gvn('rev-parse', '--verify', 'refs/tags/project-setup-v2.0.0^{commit}').stdout.trim() === f.base, { r, present, baseNames }); }
    // ---- N4: file names that are not UTF-8 ----
    { const nm = (mid) => Buffer.concat([Buffer.from('docs/plans/'), Buffer.from(mid), Buffer.from('.md')]); const lsRec = (nameBuf) => Buffer.concat([Buffer.from(`100644 blob ${'a'.repeat(40)}\t`), nameBuf, Buffer.from([0])]);
      const inv = [['a raw 0xFF byte', [0xff]], ['an invalid continuation byte (C3 28)', [0xc3, 0x28]], ['an overlong slash (C0 AF)', [0xc0, 0xaf]], ['an encoded surrogate (ED A0 80)', [0xed, 0xa0, 0x80]], ['a truncated three-byte sequence (E2 82)', [0xe2, 0x82]], ['a code point above U+10FFFF (F4 90 80 80)', [0xf4, 0x90, 0x80, 0x80]]];
      const U = 'docs/plans/\u{e9}-\u{65e5}\u{672c}-\u{1F600}-\u{fffd}-\u{feff}x.md';
      const lsBad = inv.filter(([, m]) => { const r = attempt(() => RUN.parseLsTree(lsRec(nm(m)))); return !(failedAttempt(r) && /not valid UTF-8/.test(r.threw)); }).map(([n]) => n); const lsOk = attempt(() => RUN.parseLsTree(Buffer.concat([lsRec(Buffer.from(U, 'utf8'))])));
      check('utf8 control (N4): parseLsTree refuses a path that is not valid UTF-8 (a raw 0xFF byte, an invalid continuation byte, an overlong sequence, an encoded surrogate, a truncated sequence, a code point above U+10FFFF) with a "not valid UTF-8" error, and keeps valid names exactly (accented, CJK, astral, a literal U+FFFD and a U+FEFF inside the name)', lsBad.length === 0 && !failedAttempt(lsOk) && lsOk.length === 1 && lsOk[0].path === U, { lsBad, lsOk });
      const paxRaw = (value) => { const tail = Buffer.concat([Buffer.from(' path='), value, Buffer.from('\n')]); let len = tail.length + 1; while (String(len).length + tail.length !== len) len = String(len).length + tail.length; return Buffer.concat([Buffer.from(String(len)), tail]); };
      const tarBad = (m) => [['the ustar name field', tarOf([{ name: 'x', data: Buffer.from('A\n'), edit: (h) => { h.fill(0, 0, 100); nm(m).copy(h, 0); } }])], ['the ustar prefix field', tarOf([{ name: 'e.md', data: Buffer.from('A\n'), edit: (h) => { h.fill(0, 345, 500); Buffer.concat([Buffer.from('docs/plans/'), Buffer.from(m)]).copy(h, 345); } }])], ['a pax path record', tarOf([{ name: 'PaxHeader', type: 'x', data: paxRaw(nm(m)) }, { name: 'short-name', data: Buffer.from('x') }])]];
      const tarMissed = []; for (const [label, m] of inv) for (const [where, buf] of tarBad(m)) { const r = attempt(() => RUN.parseTar(buf)); if (!(failedAttempt(r) && /not valid UTF-8/.test(r.threw))) tarMissed.push(`${label} in ${where}`); }
      const goodTar = attempt(() => RUN.parseTar(tarOf([{ name: 'x', data: Buffer.from('A\n'), edit: (h) => { h.fill(0, 0, 100); Buffer.from(U, 'utf8').copy(h, 0); } }, { name: 'e.md', data: Buffer.from('B\n'), edit: (h) => { h.fill(0, 345, 500); Buffer.from('docs/plans/\u{e9}\u{65e5}\u{672c}', 'utf8').copy(h, 345); } }, { name: 'PaxHeader', type: 'x', data: paxRaw(Buffer.from(`docs/plans/${'\u{1F600}'.repeat(30)}.md`, 'utf8')) }, { name: 'short', data: Buffer.from('C\n') }, { name: 'bom', data: Buffer.from('D\n'), edit: (h) => { h.fill(0, 0, 100); Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('docs/plans/a.md')]).copy(h, 0); } }])));
      check('utf8 control (N4): parseTar refuses a name that is not valid UTF-8 in the ustar name field, in the ustar prefix field and in a pax path record (each of the six bad sequences), and keeps valid names exactly: accented, CJK, astral and a literal U+FFFD in a name field, a prefix, a pax record, and a leading U+FEFF (not dropped as a byte-order mark)', tarMissed.length === 0 && !failedAttempt(goodTar) && goodTar.length === 4 && goodTar[0].path === U && goodTar[1].path === 'docs/plans/\u{e9}\u{65e5}\u{672c}/e.md' && goodTar[2].path === `docs/plans/${'\u{1F600}'.repeat(30)}.md` && goodTar[3].path === '\u{feff}docs/plans/a.md', { tarMissed, goodTar: failedAttempt(goodTar) ? goodTar : goodTar.map((e) => e.path) });
      // The real thing: a commit whose docs/plans holds a file named with the raw byte 0xFF, made with git plumbing (mktree -z takes the name bytes as they are).
      { const f = bootRepo('n4-raw'); const sp = (args, input) => spawnSync('git', args, { cwd: f.repo, env: f.env, input, encoding: 'buffer', windowsHide: true, timeout: 120000 });
        const blob = sp(['hash-object', '-w', '--stdin'], Buffer.from('x\n')); const oid = blob.status === 0 ? blob.stdout.toString().trim() : '';
        const mk = (entries) => { const r = sp(['mktree', '-z'], Buffer.concat(entries.map(([mode, type, id, name]) => Buffer.concat([Buffer.from(`${mode} ${type} ${id}\t`), name, Buffer.from([0])])))); return r.status === 0 ? r.stdout.toString().trim() : ''; };
        const plansT = /^[0-9a-f]{40}$/.test(oid) ? mk([['100644', 'blob', oid, Buffer.from('a.md')], ['100644', 'blob', oid, Buffer.from([0xff, 0x2e, 0x6d, 0x64])]]) : ''; const docsT = plansT ? mk([['040000', 'tree', plansT, Buffer.from('plans')]]) : ''; const rootT = docsT ? mk([['040000', 'tree', docsT, Buffer.from('docs')]]) : '';
        const cm = rootT ? sp(['commit-tree', rootT, '-m', 'raw bytes']) : null; const raw = cm !== null && cm.status === 0 ? cm.stdout.toString().trim() : '';
        if (!/^[0-9a-f]{40}$/.test(raw)) skip('bootstrap control (N4): a base commit whose docs/plans holds a file named with the raw byte 0xFF is refused before anything is written', `git could not create a tree entry with a raw 0xFF byte here (blob ${oid.slice(0, 7)}, trees ${plansT.slice(0, 7)}/${docsT.slice(0, 7)}/${rootT.slice(0, 7)}); the unit controls above carry the claim`);
        else {
          const tarB = sp(['archive', '--format=tar', raw, 'docs/plans']); const lsB = sp(['ls-tree', '-r', '-z', '--full-tree', raw, 'docs/plans']);
          const key = Buffer.concat([Buffer.from('docs/plans/'), Buffer.from([0xff])]); const ti = tarB.stdout.indexOf(key); const tarLossy = ti < 0 ? null : tarB.stdout.subarray(ti, tarB.stdout.indexOf(0, ti)).toString('utf8');
          const lsLossy = lsB.stdout.toString('utf8').split('\0').filter(Boolean).map((x) => x.slice(x.indexOf('\t') + 1)).find((p) => p.includes('\u{fffd}')) ?? null;
          check('precondition (N4): git archive and git ls-tree -z of that commit both succeed and carry the raw 0xFF byte, and a LOSSY decode of the tar name and of the ls-tree path agree ("docs/plans/U+FFFD.md"), so the old comparison saw one consistent name and wrote another', tarB.status === 0 && lsB.status === 0 && lsB.stdout.includes(Buffer.from([0xff])) && tarLossy === 'docs/plans/\u{fffd}.md' && lsLossy === 'docs/plans/\u{fffd}.md', { tar: tarB.status, ls: lsB.status, tarLossy, lsLossy });
          bad('a base commit whose docs/plans holds a file named with the raw byte 0xFF (not valid UTF-8) is refused with a "not valid UTF-8" error before anything is written (no docs/, no .git in the view)', /not valid UTF-8/, { repo: f.repo, base: raw });
        } }
      { const uni = '\u{e9}-\u{65e5}\u{672c}-\u{1F600}'; const fu = bootRepo('n4-uni', { plans: { [`docs/plans/${uni}.md`]: 'unicode\n' } }); const vu = bootView('n4-uni-view'); const ru = RUN.bootstrapStrictGate(vu, fu.repo, { baseCommit: fu.base });
        check('bootstrap control (N4): valid UTF-8 names are not refused: a plan file with accented, CJK and astral characters in its name is written under exactly that name and tracked in the view', ru.ok === true && ru.plans === 7 && fs.readdirSync(path.join(vu, 'docs', 'plans')).includes(`${uni}.md`) && gitOut(fu.env, vu, ['ls-files', '-z']).stdout.split('\0').includes(`docs/plans/${uni}.md`), ru); }
    }
    // The runner: runView with the real tree as the repository (read only), the gate spawn injected, and the bootstrap injected where the control is about the call itself.
    { const incl = process.env.V320_INCLUDE_UNTRACKED === '1' ? ['--include-untracked'] : [];
      const notTmp = path.join(scratch, 'not-the-temp-dir');
      const outOf = (label) => path.join(scratchDir(label), 'v');
      const stdout = '3 PASS / 0 FAIL / 0 SKIP\n';
      const drive = (label, run, bootstrap, extra = {}) => {
        const c = { spawn: [], boot: [], logged: [] }; const out = outOf(label);
        const opts = { repoRoot: REPO, tmp: notTmp, log: (s) => c.logged.push(s), spawn: (cmd, args, o) => { c.spawn.push({ cmd, args, cwd: o.cwd, env: o.env, bootsSoFar: c.boot.length, seen: extra.atGate ? extra.atGate(o.cwd) : null }); return { status: 0, stdout }; } };
        if (bootstrap !== null) opts.bootstrap = (...a) => { c.boot.push({ a, seen: c.logged.slice(), git: fs.existsSync(path.join(a[0], '.git')), docs: fs.existsSync(path.join(a[0], 'docs')) }); return bootstrap(...a); };
        const r = attempt(() => RUN.runView(['--out', out, ...incl, '--run', run], opts));
        return { c, out, r, lines: failedAttempt(r) ? [] : r.lines, shown: failedAttempt(r) ? r : { code: r.code, lines: r.lines.slice(0, 8) } };
      };
      const fakeOk = () => ({ ok: true, plans: 53, tags: 7, commit: 'x' });
      { const d = drive('rv-plain', 'release-3.1,c18,bs-doc-map', fakeOk);
        check('runner control: a run without accept-rc1 never calls the bootstrap: all three gates start from a view without .git and docs/', !failedAttempt(d.r) && d.r.code === 0 && d.c.boot.length === 0 && d.c.spawn.length === 3 && !d.lines.some((l) => /BOOTSTRAP/.test(l)) && !fs.existsSync(path.join(d.out, '.git')) && !fs.existsSync(path.join(d.out, 'docs')), { run: d.shown, boot: d.c.boot.length, spawn: d.c.spawn.length }); }
      { const d = drive('rv-accept', 'accept-rc1', fakeOk); const at = (rx) => d.lines.findIndex((l) => rx.test(l)); const [m, b, g] = [at(/^MANIFEST {2}OK /), at(/^BOOTSTRAP {2}OK /), at(/^GATE {2}accept-rc1 /)];
        check('runner control: a run that names accept-rc1 calls the bootstrap exactly once, with the view directory and the repository root, after the manifest check (which found the view without .git and docs/) and before the gate', !failedAttempt(d.r) && d.r.code === 0 && d.c.boot.length === 1 && path.resolve(d.c.boot[0].a[0]) === path.resolve(d.out) && path.resolve(d.c.boot[0].a[1]) === path.resolve(REPO) && d.c.boot[0].seen.some((l) => /^MANIFEST {2}OK /.test(l)) && !d.c.boot[0].git && !d.c.boot[0].docs && m >= 0 && m < b && b < g && d.c.spawn.length === 1 && d.c.spawn[0].bootsSoFar === 1 && /accept-rc1\.mjs$/.test(d.c.spawn[0].args[0]), { run: d.shown, indexes: [m, b, g], boot: d.c.boot.length, spawn: d.c.spawn.length }); }
      { const d = drive('rv-fail', 'release-3.1,accept-rc1', () => ({ ok: false, error: 'boom\nsecond line' }));
        check('runner control: a bootstrap failure is a runner failure: exit 1, the RUN-310-VIEW BOOTSTRAP FAIL line with the first line of the error, and no gate runs (not even one listed before accept-rc1)', !failedAttempt(d.r) && d.r.code === 1 && d.lines.some((l) => /^RUN-310-VIEW {2}BOOTSTRAP FAIL {2}boom$/.test(l)) && d.c.spawn.length === 0 && !d.lines.some((l) => /^GATE /.test(l)) && !d.lines.some((l) => /^BOOTSTRAP {2}OK/.test(l)), d.shown); }
      { const t = drive('rv-throw', 'accept-rc1', () => { throw new Error('exploded'); }); const n = drive('rv-null', 'accept-rc1', () => null);
        check('runner control: a bootstrap that throws, and one that returns no result, are runner failures too (exit 1, the BOOTSTRAP FAIL line, no gate)', [t, n].every((d) => !failedAttempt(d.r) && d.r.code === 1 && d.lines.some((l) => /^RUN-310-VIEW {2}BOOTSTRAP FAIL {2}\S/.test(l)) && d.c.spawn.length === 0) && t.lines.some((l) => /exploded/.test(l)), { thrown: t.shown, none: n.shown }); }
      { const genv = gitEnv(scratchDir('rv-genv'));
        const atGate = (cwd) => { const gg = (...a) => gitOut(genv, cwd, a); return { head: gg('rev-parse', '--verify', 'HEAD^{commit}').stdout.trim(), v2: gg('show-ref', '--verify', '--quiet', 'refs/tags/project-setup-v2.0.0').status, status: gg('status', '--porcelain').stdout, count: gg('rev-list', '--count', 'HEAD').stdout.trim() }; };
        const d = drive('rv-e2e', 'accept-rc1', null, { atGate });
        const seen = d.c.spawn.length === 1 ? d.c.spawn[0].seen : null;
        const baseNow = gitOut(genv, REPO, ['ls-tree', '-r', '-z', '--name-only', H.BASE_COMMIT320, 'docs/plans']).stdout.split('\0').filter(Boolean).sort();
        const here = fs.existsSync(path.join(d.out, 'docs')) ? listFiles(path.join(d.out, 'docs')).map((r) => `docs/${r}`) : [];
        const same = baseNow.length > 0 && JSON.stringify(here) === JSON.stringify(baseNow) && baseNow.every((rel) => Buffer.compare(fs.readFileSync(path.join(d.out, ...rel.split('/'))), gitOut(genv, REPO, ['cat-file', 'blob', `${H.BASE_COMMIT320}:${rel}`], true).stdout) === 0);
        const prechange = attempt(() => JSON.parse(fs.readFileSync(path.join(REPO, 'project-setup', 'tests', 'fixtures', 'v320-prechange.json'), 'utf8')));
        const manifest = failedAttempt(prechange) ? prechange : attempt(() => H.verifyView(d.out, prechange));
        check('runner control: end to end with the real bootstrap, the strict gate would start in a view that holds the base commit\'s docs/plans (byte for byte, and not the 3.2.0 plan), a repository with the project-setup-v2.0.0 tag and one clean commit, and the manifest check found no extra file', !failedAttempt(d.r) && d.r.code === 0 && d.lines.some((l) => /^MANIFEST {2}OK /.test(l)) && d.lines.some((l) => /^BOOTSTRAP {2}OK /.test(l)) && seen !== null && /^[0-9a-f]{40}$/.test(seen.head) && seen.v2 === 0 && seen.status === '' && seen.count === '1' && same && !failedAttempt(manifest) && JSON.stringify(manifest) === JSON.stringify({ extra: [], missing: [], changed: [] }), { run: d.shown, seen, plansEqualBase: same, baseCount: baseNow.length, here: here.length, manifest }); }
      // Finding 2 (review 3): the caller's GIT_INDEX_FILE names a sentinel file; every other redirecting GIT_* variable is hostile too. The real view construction and the real bootstrap run, the gate spawn is injected.
      { const sdir = scratchDir('rv-sentinel-src'); const sentinel = path.join(sdir, 'sentinel-index'); fs.writeFileSync(sentinel, 'SENTINEL: this is not a git index\n'); const bytes = fs.readFileSync(sentinel); const mtime = fs.statSync(sentinel).mtimeMs;
        const genv = gitEnv(scratchDir('rv-sentinel-genv'));
        const atGate = (cwd) => ({ head: gitOut(genv, cwd, ['rev-parse', '--verify', 'HEAD^{commit}']).stdout.trim(), count: gitOut(genv, cwd, ['rev-list', '--count', 'HEAD']).stdout.trim() });
        const hostile = { ...hostileGitVars(sdir), GIT_INDEX_FILE: sentinel, V320_KEEP_ME: 'kept' };
        const d = withEnv(hostile, () => drive('rv-sentinel', 'accept-rc1', null, { atGate }));
        const gateEnv = d.c.spawn.length === 1 ? d.c.spawn[0].env : null; const seen = d.c.spawn.length === 1 ? d.c.spawn[0].seen : null;
        const leaked = gateEnv === null ? ['(no gate started)'] : Object.keys(gateEnv).filter((k) => /^GIT_/i.test(k));
        check('runner control (finding 2): with GIT_INDEX_FILE naming a sentinel file (and GIT_DIR, GIT_WORK_TREE, GIT_OBJECT_DIRECTORY, GIT_COMMON_DIR, GIT_CONFIG_* and the rest hostile) in the environment, the view is built and bootstrapped, the sentinel file is neither read nor written (same bytes, same mtime, no lock file beside it), the view holds its own repository with one commit, and the gate child receives no GIT_* variable', !failedAttempt(d.r) && d.r.code === 0 && d.lines.some((l) => /^VIEW /.test(l)) && d.lines.some((l) => /^BOOTSTRAP {2}OK /.test(l)) && fs.readFileSync(sentinel).equals(bytes) && fs.statSync(sentinel).mtimeMs === mtime && JSON.stringify(fs.readdirSync(sdir)) === '["sentinel-index"]' && seen !== null && /^[0-9a-f]{40}$/.test(seen.head) && seen.count === '1' && gateEnv !== null && leaked.length === 0, { run: d.shown, leaked, seen, sentinelIntact: fs.readFileSync(sentinel).equals(bytes), listing: fs.readdirSync(sdir) });
        check('runner control (finding 2): the gate child keeps the ordinary environment (PATH and a custom variable) while every GIT_* variable is removed, whatever its letter case', gateEnv !== null && gateEnv.V320_KEEP_ME === 'kept' && Object.keys(gateEnv).some((k) => k.toUpperCase() === 'PATH') && Object.keys(gateEnv).every((k) => !/^GIT_/i.test(k)), gateEnv === null ? 'no gate started' : Object.keys(gateEnv).filter((k) => /^GIT_/i.test(k) || k === 'V320_KEEP_ME'));
        const p = withEnv(hostile, () => drive('rv-sentinel-plain', 'release-3.1,c18,bs-doc-map', fakeOk));
        check('runner control (finding 2): in a run without accept-rc1 each of the three gate children receives no GIT_* variable either, and the sentinel file is untouched', !failedAttempt(p.r) && p.r.code === 0 && p.c.spawn.length === 3 && p.c.spawn.every((s) => Object.keys(s.env).every((k) => !/^GIT_/i.test(k)) && s.env.V320_KEEP_ME === 'kept') && fs.readFileSync(sentinel).equals(bytes), { run: p.shown, spawn: p.c.spawn.map((s) => Object.keys(s.env).filter((k) => /^GIT_/i.test(k))) });
      }
      // Review 4 (session 6): the header states what the runner now does besides writing under --out.
      check('runner doc control (N1 to N4, session 6): the header names the runner\'s own temp-directory write (run310-git-*, removed when the bootstrap ends), the runner-owned configuration (GIT_CONFIG_NOSYSTEM=1, GIT_CONFIG_GLOBAL, an empty home), the canonical-path rule (ONE canonical path, a Windows trailing dot or space refused), --no-replace-objects, strict UTF-8 and the view construction keeping the user\'s configuration', (() => { const head = fs.readFileSync(path.join(SKILL, 'tests', 'run-310-view.mjs'), 'utf8').split('\n').slice(0, 50).join('\n'); return /run310-git-\*/.test(head) && /removed when the bootstrap ends/.test(head) && /GIT_CONFIG_NOSYSTEM=1/.test(head) && /GIT_CONFIG_GLOBAL/.test(head) && /empty directory/.test(head) && /ONE canonical path/.test(head) && /ends with a dot or a space/.test(head) && /--no-replace-objects/.test(head) && /not valid UTF-8/.test(head) && /keeps the user's own git configuration/.test(head); })());
      // Finding 5 (review 3): the gates write outside --out (os.tmpdir()), so the header must not claim otherwise.
      check('runner doc control (finding 5): the runner header says that the historical gates it starts are NOT confined to --out (they write under the OS temp directory, os.tmpdir()) and no longer claims that the run writes nothing outside --out', (() => { const src = fs.readFileSync(path.join(SKILL, 'tests', 'run-310-view.mjs'), 'utf8'); const head = src.split('\n').slice(0, 45).join('\n'); return /HISTORICAL GATES IT STARTS ARE NOT CONFINED TO --out/.test(head) && /os\.tmpdir\(\)/.test(head) && /temp directory/.test(head) && !/writes nothing outside --out/i.test(src); })());
    }
  }
}
// END bootstrap controls (tests session 3; the review 3 fix round of session 5 adds the controls marked finding 1 to 8)
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
// The 21 amendable files are read as ACTUAL holds them; the other normative files (assets/agents/docs-sync.md, references/codex.md, references/state-and-apply.md, and any other) from disk.
const normActual = (k) => { if (typeof ACTUAL[k] === 'string') return ACTUAL[k]; const r = attempt(() => fs.readFileSync(absOf(k), 'utf8')); return failedAttempt(r) ? '' : r; };
needPins('every 3.1.0 normative line (a line holding MUST, SHOULD or MAY) of SKILL.md, references/*, assets/agents/*, assets/templates/* and data/* is still present (16-hex line digests pinned in this spec, D-4)', { NORMATIVE_LINES }, () => {
  const lost = Object.entries(NORMATIVE_LINES).map(([k, digests]) => { const have = new Set(lf(normActual(k)).split('\n').map(lineDigest)); return [k, digests.filter((d) => !have.has(d)).length]; }).filter(([, n]) => n > 0);
  return [Object.keys(NORMATIVE_LINES).every(NORMATIVE_SCOPE) && lost.length === 0, lost];
});
// Finding 8 (review 3): the table above is only as strong as its coverage. The base blobs of EVERY normative file are read through git and the table must hold exactly their keyword lines.
const baseNormativeTexts = () => {
  const env = gitEnv(scratchDir('norm-base'));
  const run = (args) => spawnSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd: REPO, env, encoding: 'buffer', shell: false, windowsHide: true, timeout: 180000, maxBuffer: 1 << 27 });
  const ls = run(['ls-tree', '-r', '-z', '--full-tree', BASE_COMMIT, 'project-setup']);
  if (ls.error || ls.status !== 0) return { threw: `git ls-tree of the base commit failed (${ls.error ? ls.error.code : `exit ${ls.status}`})` };
  const out = {};
  for (const rec of ls.stdout.toString('utf8').split('\0').filter(Boolean)) {
    const m = /^\d+ blob ([0-9a-f]{40})\tproject-setup\/(.+)$/.exec(rec);
    if (m === null || !NORMATIVE_SCOPE(m[2])) continue;
    const b = run(['cat-file', 'blob', m[1]]);
    if (b.error || b.status !== 0) return { threw: `git cat-file of ${m[2]} failed` };
    if (has(BASE_FILES, m[2]) && sha(b.stdout) !== BASE_FILES[m[2]]) return { threw: `${m[2]}: the base blob is not the pinned 3.1.0 bytes` };
    out[m[2]] = b.stdout.toString('utf8');
  }
  return out;
};
needPins('the normative-line table covers every 3.1.0 line holding MUST, SHOULD or MAY of EVERY normative file (SKILL.md, references/*, assets/agents/*, assets/templates/*, data/*), read from the base commit blobs through git, and holds no line the base does not have (finding 8)', { NORMATIVE_LINES, BASE_FILES }, () => {
  const texts = baseNormativeTexts();
  if (failedAttempt(texts)) return [false, texts.threw];
  const cov = normativeCoverage(texts, NORMATIVE_LINES);
  const must = ['assets/agents/docs-sync.md', 'references/codex.md', 'references/state-and-apply.md', 'SKILL.md'];
  return [Object.keys(texts).length >= 20 && must.every((k) => has(texts, k) && has(NORMATIVE_LINES, k)) && cov.uncovered.length === 0 && cov.stale.length === 0, { files: Object.keys(texts).length, uncovered: cov.uncovered.slice(0, 5), stale: cov.stale.slice(0, 5) }];
});
{ // the coverage engine on synthetic trees: each defect is reported, and nothing is reported for a faithful table
  const KW = 'The agent MUST stop here.'; const KW2 = 'It SHOULD ask first.'; const MAY = 'A reader MAY skip this.';
  const texts = { 'SKILL.md': `# t\n${KW}\nplain line\n${KW2}\n`, 'references/a.md': `${MAY}\n`, 'references/none.md': 'no keyword here\n', 'scripts/x.mjs': `// ${KW}\n`, 'tests/y.mjs': `${KW}\n` };
  const good = { 'SKILL.md': [lineDigest(KW), lineDigest(KW2)], 'references/a.md': [lineDigest(MAY)] };
  const run = (t, tab) => normativeCoverage(t, tab);
  const faithful = run(texts, good);
  check('normative coverage control (sanity): a table holding exactly the keyword lines of the normative files reports nothing (a file out of scope and a file without a keyword line need no entry)', faithful.uncovered.length === 0 && faithful.stale.length === 0, faithful);
  const noFile = run(texts, { 'SKILL.md': good['SKILL.md'] });
  check('normative coverage control: a normative file with keyword lines and no table entry is reported (the defect of finding 8: three files were simply absent)', noFile.uncovered.length === 1 && noFile.uncovered[0].startsWith('references/a.md:'), noFile);
  const oneShort = run(texts, { ...good, 'SKILL.md': [lineDigest(KW)] });
  check('normative coverage control: a table entry that lacks one keyword line is reported', oneShort.uncovered.length === 1 && oneShort.uncovered[0] === `SKILL.md:${lineDigest(KW2)}`, oneShort);
  const extra = run(texts, { ...good, 'SKILL.md': [...good['SKILL.md'], lineDigest('A line the base never held MUST be reported.')] });
  check('normative coverage control: a table digest that the base file does not hold is reported as stale', extra.stale.length === 1 && extra.uncovered.length === 0, extra);
  const ghost = run(texts, { ...good, 'references/gone.md': [lineDigest(KW)] });
  check('normative coverage control: a table entry for a file that is not a normative file of the base is reported as stale', ghost.stale.some((s) => s.startsWith('references/gone.md')) && ghost.uncovered.length === 0, ghost);
  const lower = run({ 'references/l.md': 'you must not count this, a MUSTARD line, a mayor line, SHOULDER\n' }, {});
  check('normative coverage control: the keywords are the upper-case words only (must, MUSTARD, mayor and SHOULDER are not keyword lines)', lower.uncovered.length === 0 && lower.stale.length === 0, lower);
  const outOfScope = run({ 'scripts/x.mjs': `${KW}\n` }, { 'scripts/x.mjs': [lineDigest(KW)] });
  check('normative coverage control: a table entry for a file outside the normative scope is reported as stale', outOfScope.stale.length === 1 && /scripts\/x\.mjs/.test(outOfScope.stale[0]), outOfScope);
  check('normative coverage control: the pinned table lists the three files finding 8 found missing, with the 33 lines', ['assets/agents/docs-sync.md', 'references/codex.md', 'references/state-and-apply.md'].reduce((n, k) => n + (has(NORMATIVE_LINES, k) ? NORMATIVE_LINES[k].length : 0), 0) === 33 || NORMATIVE_LINES === PENDING, ['assets/agents/docs-sync.md', 'references/codex.md', 'references/state-and-apply.md'].map((k) => [k, has(NORMATIVE_LINES, k) ? NORMATIVE_LINES[k].length : null]));
}
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
