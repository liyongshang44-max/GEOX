// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION_ACTIVATION.cjs
// Purpose: enforce the governance-only R0 authority freeze for the MCFT-CAP-03 S2 semantic-conformance remediation.
// Boundary: no Runtime, domain-contract, persistence, migration, route, scheduler, web, workflow, canonical-fact, completion-claim, S7, S8, or MCFT-CAP-04 authorization change.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '55f2d56b05d2a1f0ada0e9b46eea5a3baa7187c2';
const ACTIVATION_BRANCH =
  'mcft-cap-03-s2-semantic-conformance-remediation-activation-v1';
const R1_BRANCH = 'mcft-cap-03-s2-semantic-conformance-v2-v1';
const REMEDIATION_ID =
  'MCFT-CAP-03.S2-SEMANTIC-CONFORMANCE-REMEDIATION-V1';
const S2 =
  'MCFT-CAP-03.MCFT-05-07.OBSERVATION-SELECTION-AND-ASSIMILATION-MATH-V1';
const S6 =
  'MCFT-CAP-03.MCFT-03-04-07-08.RESTART-BACKFILL-RECOVERY-V1';
const S7 = 'MCFT-CAP-03.CLOSURE-V1';
const S8 = 'MCFT-CAP-03.CLOSURE-FINALIZATION-V1';

const DRAFT = process.argv.includes('--draft');
const POSTMERGE = process.argv.includes('--postmerge');
const MODE = POSTMERGE ? 'postmerge' : DRAFT ? 'draft' : 'final';

const DELIVERY_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const STATUS_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-S2-SEMANTIC-CONFORMANCE-REMEDIATION-STATUS.json';
const CONTRACT_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-S2-SEMANTIC-CONFORMANCE-REMEDIATION.md';
const GATE_PATH =
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION_ACTIVATION.cjs';

const ACTIVATION_FILES = [
  DELIVERY_PATH,
  STATUS_PATH,
  CONTRACT_PATH,
  GATE_PATH,
].sort();

const R1_FILES = [
  'apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v2.ts',
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts',
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.ts',
  DELIVERY_PATH,
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-OBSERVATION-ASSIMILATION-STATUS.json',
  STATUS_PATH,
  CONTRACT_PATH,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_03_s2_semantic_conformance_remediation_fixture_v1.ts',
].sort();

const FORBIDDEN_ACTIVATION_PATHS = [
  /^apps\/server\/src\//,
  /^apps\/server\/db\/migrations\//,
  /^apps\/web\//,
  /^\.github\/workflows\//,
  /(?:^|\/)routes?(?:\/|\.|$)/i,
];

let pass = 0;
let fail = 0;

function check(value, message) {
  if (value) {
    pass += 1;
    console.log(`PASS ${message}`);
  } else {
    fail += 1;
    console.error(`FAIL ${message}`);
  }
}

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readText(relativePath) {
  return fs.readFileSync(absolute(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function git(args) {
  return cp.execFileSync(
    process.platform === 'win32' ? 'git.exe' : 'git',
    args,
    {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ).trim();
}

function sortedLines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replaceAll('\\', '/'))
    .filter(Boolean)
    .sort();
}

function sameArray(left, right) {
  return JSON.stringify([...left].sort())
    === JSON.stringify([...right].sort());
}

for (const relativePath of ACTIVATION_FILES) {
  check(
    fs.existsSync(absolute(relativePath)),
    `${MODE} file exists: ${relativePath}`,
  );
}

const status = readJson(STATUS_PATH);
const delivery = readJson(DELIVERY_PATH);
const contract = readText(CONTRACT_PATH);
const gate = readText(GATE_PATH);

check(
  status.schema_version
    === 'geox_mcft_cap_03_s2_semantic_conformance_remediation_status_v1',
  'status schema exact',
);
check(status.capability_line_id === 'MCFT-CAP-03', 'capability exact');
check(status.remediation_id === REMEDIATION_ID, 'remediation id exact');
check(status.baseline_main_commit === BASELINE, 'baseline exact');
check(
  status.s6_implementation_merge_commit === BASELINE,
  'S6 implementation merge baseline exact',
);
check(status.activation_branch === ACTIVATION_BRANCH, 'activation branch exact');
check(status.r1_implementation_branch === R1_BRANCH, 'R1 branch exact');
check(status.status === 'ACTIVATION_READY_FOR_MERGE', 'activation status ready');
check(status.activation_effective === false, 'activation remains ineffective');
check(status.implementation_status === 'NOT_AUTHORIZED', 'R1 remains unauthorized');
check(status.remediation_hold_status === 'CANDIDATE', 'remediation hold candidate');
check(
  status.s6_effectiveness_status === 'PAUSED_PENDING_REMEDIATION',
  'S6 effectiveness paused',
);
check(status.s7_status === 'BLOCKED', 'S7 blocked');
check(status.s8_status === 'BLOCKED', 'S8 blocked');
check(status.mcft_cap_04_authorized === false, 'MCFT-CAP-04 unauthorized');
check(status.r1_authorized === false, 'R1 authorization false');
check(status.successor_authorized === false, 'successor authorization false');
check(
  sameArray(status.r0_exact_changed_file_boundary, ACTIVATION_FILES),
  'R0 changed-file boundary exact',
);
check(
  sameArray(status.r1_frozen_implementation_changed_file_boundary, R1_FILES),
  'R1 frozen changed-file boundary exact',
);
check(status.r2_boundary_status === 'TO_BE_FROZEN_AFTER_R1_EFFECTIVE', 'R2 boundary deferred');

const defects = new Map(
  status.confirmed_nonconformities.map((entry) => [entry.hard_acceptance_id, entry]),
);
check(defects.size === 4, 'exactly four confirmed nonconformities');
check(defects.has(32), 'Hard Acceptance #32 recorded');
check(defects.has(39), 'Hard Acceptance #39 recorded');
check(defects.has(46), 'Hard Acceptance #46 recorded');
check(defects.has(58), 'Hard Acceptance #58 recorded');

check(
  status.frozen_remediation_strategy.historical_v1_contract_and_readback
    === 'IMMUTABLE_AND_MUST_REMAIN_VALID',
  'historical V1 readback immutable',
);
check(
  status.frozen_remediation_strategy.corrected_contract_strategy
    === 'ADDITIVE_VERSIONED_V2',
  'additive V2 strategy exact',
);
check(
  status.frozen_remediation_strategy.v1_canonical_fact_rewrite === 'FORBIDDEN',
  'V1 canonical fact rewrite forbidden',
);
check(
  status.frozen_remediation_strategy.staleness_authority
    === 'LOGICAL_MS_MINUS_OBSERVED_MS_LE_900000',
  'millisecond staleness authority exact',
);
check(
  status.frozen_remediation_strategy.unsupported_record_type_policy
    === 'MALFORMED_CANONICAL_OBSERVATION_FAIL_CLOSED',
  'unsupported record type fail-closed exact',
);

check(delivery.capability_line_id === 'MCFT-CAP-03', 'delivery capability exact');
check(delivery.status === 'S2_SEMANTIC_CONFORMANCE_REMEDIATION_ACTIVATION_READY_FOR_MERGE', 'delivery remediation status ready');
check(delivery.implementation_status === 'REMEDIATION_NOT_AUTHORIZED', 'delivery remediation unauthorized');
check(delivery.active_delivery_slice_id === REMEDIATION_ID, 'delivery active remediation exact');
check(delivery.successor_authorized === false, 'delivery successor unauthorized');

const hold = delivery.remediation_hold;
check(Boolean(hold), 'delivery remediation hold exists');
check(hold?.remediation_id === REMEDIATION_ID, 'delivery remediation hold id exact');
check(hold?.baseline_main_commit === BASELINE, 'delivery remediation baseline exact');
check(hold?.status === 'ACTIVATION_READY_FOR_MERGE', 'delivery remediation hold ready');
check(hold?.activation_effective === false, 'delivery remediation hold ineffective');
check(hold?.r1_authorized === false, 'delivery remediation R1 unauthorized');
check(hold?.s6_effectiveness_status === 'PAUSED_PENDING_REMEDIATION', 'delivery S6 hold exact');
check(
  sameArray(hold?.hard_acceptance_ids ?? [], [32, 39, 46, 58]),
  'delivery hard-acceptance ids exact',
);
check(
  sameArray(hold?.r0_exact_changed_file_boundary ?? [], ACTIVATION_FILES),
  'delivery R0 boundary exact',
);
check(
  sameArray(hold?.r1_frozen_implementation_changed_file_boundary ?? [], R1_FILES),
  'delivery R1 boundary exact',
);

const s2 = delivery.slices.find((slice) => slice.delivery_slice_id === S2);
const s6 = delivery.slices.find((slice) => slice.delivery_slice_id === S6);
const s7 = delivery.slices.find((slice) => slice.delivery_slice_id === S7);
const s8 = delivery.slices.find((slice) => slice.delivery_slice_id === S8);
check(Boolean(s2), 'S2 slice exists');
check(s2?.status === 'MERGED_REMEDIATION_REQUIRED', 'S2 remediation-required status exact');
check(s2?.semantic_conformance === 'DEFECTIVE_CONFIRMED', 'S2 semantic defect recorded');
check(Boolean(s6), 'S6 slice exists');
check(s6?.status === 'IMPLEMENTATION_MERGED_EFFECTIVENESS_PAUSED', 'S6 paused status exact');
check(s6?.implementation_merge_commit === BASELINE, 'S6 implementation merge recorded');
check(s6?.implementation_head_commit === '9cf16dbaab3b281458ac460dfaecc3ed25772d1f', 'S6 implementation head recorded');
check(s6?.implementation_ci_run === 'CI_4721', 'S6 CI recorded');
check(s6?.implementation_final_gate === 'PASS_127_OF_127', 'S6 final Gate recorded');
check(s6?.implementation_isolated_postgresql_gate === 'PASS_128_OF_128', 'S6 DB Gate recorded');
check(s6?.effectiveness_condition_satisfied === false, 'S6 effectiveness remains false');
check(s7?.status === 'BLOCKED', 'delivery S7 blocked');
check(s7?.baseline_main_commit === null && s7?.branch === null, 'delivery S7 remains unset');
check(s8?.status === 'BLOCKED', 'delivery S8 blocked');
check(s8?.baseline_main_commit === null && s8?.branch === null, 'delivery S8 remains unset');

const knownConflicts = delivery.known_ssot_conflicts;
check(Array.isArray(knownConflicts), 'known SSOT conflicts recorded');
for (const value of [
  'NO_OBSERVATION_SELECTOR_IMPLEMENTED',
  'NO_OBSERVATION_SEMANTIC_DUPLICATE_RESOLUTION_IMPLEMENTED',
  'NO_OBSERVATION_SEMANTIC_CONTENT_HASH_IMPLEMENTED',
  'NO_ASSIMILATION_MATH_IMPLEMENTED',
  'NO_OBSERVATION_UPDATE_APPLIED',
  'NO_OBSERVATION_INNOVATION_COMPUTED',
  'NO_CAP_03_A2_TICK_COMMITTED',
]) {
  check(knownConflicts.includes(value), `known SSOT conflict recorded: ${value}`);
}
check(
  delivery.ssot_conflict_cleanup_status === 'DEFERRED_TO_R2_AFTER_R1_EFFECTIVE',
  'SSOT cleanup deferred to R2',
);

for (const marker of [
  'Hard Acceptance #32',
  'Hard Acceptance #39',
  'Hard Acceptance #46',
  'Hard Acceptance #58',
  'ADDITIVE_VERSIONED_V2',
  'MALFORMED_CANONICAL_OBSERVATION:UNSUPPORTED_RECORD_TYPE',
  'logical_time_ms - observed_at_ms <= 900000',
  'S6 effectiveness = PAUSED',
  'S7 = BLOCKED',
  'MCFT-CAP-04 = UNAUTHORIZED',
]) {
  check(contract.includes(marker), `contract marker: ${marker}`);
}

check(gate.includes("const BASELINE = '55f2d56b05d2a1f0ada0e9b46eea5a3baa7187c2'"), 'Gate baseline locked');

try {
  const changed = sortedLines(git(['diff', '--name-only', `${BASELINE}...HEAD`]));
  check(sameArray(changed, ACTIVATION_FILES), 'actual R0 changed-file set exact');
  for (const changedPath of changed) {
    check(
      !FORBIDDEN_ACTIVATION_PATHS.some((pattern) => pattern.test(changedPath)),
      `R0 contains no forbidden source path: ${changedPath}`,
    );
  }
  git(['diff', '--check', `${BASELINE}...HEAD`]);
  check(true, 'R0 git diff --check PASS');
} catch (error) {
  check(false, `R0 git boundary available: ${error.message}`);
}

try {
  if (POSTMERGE) {
    check(git(['branch', '--show-current']) === 'main', 'postmerge Gate runs on main');
    check(
      git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']),
      'postmerge local main equals origin/main',
    );
  } else {
    check(
      git(['branch', '--show-current']) === ACTIVATION_BRANCH,
      `${MODE} Gate runs on activation branch`,
    );
  }
} catch (error) {
  check(false, `${MODE} branch alignment available: ${error.message}`);
}

console.log(
  `MCFT-CAP-03 S2 semantic-conformance remediation activation ${MODE}: ${pass} PASS, ${fail} FAIL`,
);

if (fail > 0) {
  process.exitCode = 1;
}
