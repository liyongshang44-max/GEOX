// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_CLOSURE_ACTIVATION.cjs
// Purpose: validate the governance-only MCFT-CAP-03 S7 Closure activation freeze, exact boundaries, S6/R3 effectiveness prerequisite, pending claims, preserved nonclaims, and downstream blocks.
// Boundary: no Runtime source, persistence source, migration, route, scheduler, web, workflow, canonical fact, S8 activation, completion claim activation, or MCFT-CAP-04 authorization.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '6efdbf2117749649c7ad990c5509a81a11dfa966';
const ACTIVATION_BRANCH = 'mcft-cap-03-s7-closure-activation-v1';
const ACTIVATION_EFFECTIVENESS_BRANCH = 'mcft-cap-03-s7-closure-activation-effectiveness-v1';
const IMPLEMENTATION_BRANCH = 'mcft-cap-03-s7-closure-v1';
const S6 = 'MCFT-CAP-03.MCFT-03-04-07-08.RESTART-BACKFILL-RECOVERY-V1';
const S7 = 'MCFT-CAP-03.CLOSURE-V1';
const S8 = 'MCFT-CAP-03.CLOSURE-FINALIZATION-V1';

const MODE = process.argv.includes('--postmerge')
  ? 'postmerge'
  : process.argv.includes('--draft')
    ? 'draft'
    : 'final';

const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const STATUS_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE-STATUS.json';
const CONTRACT_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE.md';
const GATE_PATH = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_CLOSURE_ACTIVATION.cjs';

const EXACT_ACTIVATION_FILES = Object.freeze([
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE-STATUS.json",
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE.md",
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_CLOSURE_ACTIVATION.cjs"
]);
const ACTIVATION_EFFECTIVENESS_FILES = Object.freeze([
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE-STATUS.json",
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json"
]);
const IMPLEMENTATION_FILES = Object.freeze([
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE-RECORD.json",
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE-STATUS.json",
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE.md",
  "docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_CLOSURE.cjs"
]);
const COMPLETION_CLAIMS = Object.freeze([
  "MCFT_CAP_03_COMPLETE",
  "OBSERVATION_ASSIMILATION_V1_ESTABLISHED",
  "STATE_OBSERVATION_INNOVATION_RESIDUAL_ESTABLISHED",
  "DETERMINISTIC_OBSERVATION_SELECTION_ESTABLISHED",
  "PASS_OBSERVATION_ACCEPTANCE_ESTABLISHED",
  "LIMITED_OBSERVATION_DOWNWEIGHTING_ESTABLISHED",
  "OBSERVATION_CANDIDATE_EXCLUSION_ESTABLISHED",
  "INNOVATION_OUTLIER_REJECTION_ESTABLISHED",
  "POSTERIOR_STATE_CORRECTION_ESTABLISHED",
  "ASSIMILATION_UNCERTAINTY_UPDATE_ESTABLISHED",
  "OBSERVATION_DISPOSITION_TRACE_ESTABLISHED",
  "TWENTY_FOUR_OBSERVATION_AWARE_TICKS_PERSISTED",
  "ASSIMILATION_RESTART_BACKFILL_PROVEN",
  "ASSIMILATED_STATE_CANONICAL_UNIQUENESS_ESTABLISHED",
  "VERSIONED_ASSIMILATION_RECORD_SET_COMPATIBILITY_ESTABLISHED"
]);
const PRESERVED_NONCLAIMS = Object.freeze([
  "NO_MCFT_CAP_03_COMPLETE_CLAIM",
  "NO_FORECAST_RESIDUAL",
  "NO_SUCCESSFUL_FORECAST",
  "NO_72_HOUR_FORECAST",
  "NO_SCENARIO",
  "NO_RECOMMENDATION",
  "NO_POLICY_EVALUATION",
  "NO_DECISION",
  "NO_AO_ACT",
  "NO_CALIBRATION_CANDIDATE",
  "NO_SHADOW_EVALUATION",
  "NO_MODEL_ACTIVATION",
  "NO_ACTIVE_MODEL_PARAMETER_CHANGE",
  "NO_CALIBRATED_CONFIDENCE_MODEL",
  "NO_MULTI_SENSOR_FUSION",
  "NO_DYNAMIC_ROOT_ZONE_GEOMETRY",
  "NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION",
  "NO_LATE_EVIDENCE_REVISION",
  "NO_AUTOMATIC_RECOMPUTE_ON_LATE_EVIDENCE",
  "NO_CONTINUOUS_RUNTIME",
  "NO_CONTINUOUS_SCHEDULER",
  "NO_720_TICK_REPLAY_CLOSURE",
  "NO_LIVE_FIELD_CLAIM",
  "NO_FIELD_VALIDATED_OBSERVATION_OPERATOR",
  "NO_FIELD_CALIBRATED_ASSIMILATION_NOISE_MODEL",
  "NO_MCFT_GATE_A_CLOSURE",
  "NO_MCFT_GATE_B_CLOSURE",
  "NO_MCFT_GATE_C_CLOSURE",
  "NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM"
]);

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

function git(args) {
  return cp.execFileSync(
    process.platform === 'win32' ? 'git.exe' : 'git',
    args,
    {
      cwd: ROOT,
      encoding: 'utf8',
    },
  ).trim();
}

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  );
}

function readText(relativePath) {
  return fs.readFileSync(
    path.join(ROOT, relativePath),
    'utf8',
  );
}

function exactArray(actual, expected, label) {
  check(Array.isArray(actual), `${label} is array`);
  if (!Array.isArray(actual)) return;

  check(
    JSON.stringify([...actual].sort())
      === JSON.stringify([...expected].sort()),
    `${label} exact`,
  );
}

function changedFiles() {
  const tracked = git(['diff', '--name-only', BASELINE])
    .split(/\r?\n/)
    .filter(Boolean);
  const untracked = git([
    'ls-files',
    '--others',
    '--exclude-standard',
  ])
    .split(/\r?\n/)
    .filter(Boolean);

  return [...new Set([...tracked, ...untracked])].sort();
}

for (const file of EXACT_ACTIVATION_FILES) {
  check(
    fs.existsSync(path.join(ROOT, file)),
    `${MODE} file exists: ${file}`,
  );
}

const delivery = readJson(DELIVERY_PATH);
const status = readJson(STATUS_PATH);
const contract = readText(CONTRACT_PATH);
const s6 = delivery.slices.find(
  (slice) => slice.delivery_slice_id === S6,
);
const s7 = delivery.slices.find(
  (slice) => slice.delivery_slice_id === S7,
);
const s8 = delivery.slices.find(
  (slice) => slice.delivery_slice_id === S8,
);

check(
  status.schema_version
    === 'geox_mcft_cap_03_closure_status_v1',
  'closure status schema exact',
);
check(
  status.capability_line_id === 'MCFT-CAP-03',
  'closure status capability exact',
);
check(
  status.delivery_slice_id === S7,
  'closure status delivery slice exact',
);
check(
  status.baseline_main_commit === BASELINE,
  'closure activation baseline exact',
);
check(
  status.activation_branch === ACTIVATION_BRANCH,
  'closure activation branch exact',
);
check(
  status.activation_effectiveness_branch
    === ACTIVATION_EFFECTIVENESS_BRANCH,
  'closure activation-effectiveness branch exact',
);
check(
  status.implementation_branch === IMPLEMENTATION_BRANCH,
  'closure implementation branch exact',
);

check(
  status.predecessor_effectiveness
    ?.s6_final_ssot_merge_commit === BASELINE,
  'S6 final SSOT merge exact',
);
check(
  status.predecessor_effectiveness
    ?.merged_main_postmerge_gate === 'PASS_141_OF_141',
  'S6 final postmerge Gate exact',
);
check(
  status.predecessor_effectiveness
    ?.effectiveness_condition_satisfied === true,
  'S6 predecessor effectiveness satisfied',
);
check(
  status.predecessor_effectiveness
    ?.s6_positive_in_memory === 'PASS_8_OF_8',
  'S6 positive acceptance exact',
);
check(
  status.predecessor_effectiveness
    ?.s6_negative_semantic === 'PASS_9_OF_9',
  'S6 negative acceptance exact',
);
check(
  status.predecessor_effectiveness
    ?.s6_isolated_postgresql === 'PASS_6_OF_6',
  'S6 PostgreSQL acceptance exact',
);
check(
  status.predecessor_effectiveness
    ?.r2_v2_revalidation_status === 'MERGED_EFFECTIVE',
  'R2 V2 revalidation remains effective',
);

exactArray(
  status.pending_completion_claims,
  COMPLETION_CLAIMS,
  'pending completion claims',
);
exactArray(
  status.preserved_nonclaims,
  PRESERVED_NONCLAIMS,
  'preserved nonclaims',
);
exactArray(
  status.exact_activation_changed_file_boundary,
  EXACT_ACTIVATION_FILES,
  'status activation boundary',
);
exactArray(
  status.activation_effectiveness_changed_file_boundary,
  ACTIVATION_EFFECTIVENESS_FILES,
  'status activation-effectiveness boundary',
);
exactArray(
  status.frozen_implementation_changed_file_boundary,
  IMPLEMENTATION_FILES,
  'status implementation boundary',
);

check(
  s6?.status === 'MERGED',
  'S6 remains MERGED',
);
check(
  s6?.effectiveness_condition_satisfied === true,
  'S6 effectiveness remains satisfied',
);
check(
  s6?.r3_effectiveness_resume?.candidate_status
    === 'MERGED_EFFECTIVE',
  'S6 R3 effectiveness remains merged-effective',
);
check(
  s6?.r3_effectiveness_resume?.final_postmerge_gate
    === 'PASS_141_OF_141',
  'S6 final postmerge Gate remains recorded',
);

check(
  s7?.baseline_main_commit === BASELINE,
  'delivery S7 baseline exact',
);
check(
  s7?.branch === IMPLEMENTATION_BRANCH,
  'delivery S7 implementation branch exact',
);
check(
  s7?.activation_fields_status === 'FROZEN',
  'delivery S7 activation fields frozen',
);
exactArray(
  s7?.exact_activation_changed_file_boundary,
  EXACT_ACTIVATION_FILES,
  'delivery S7 activation boundary',
);
exactArray(
  s7?.postmerge_activation_effectiveness_changed_file_boundary,
  ACTIVATION_EFFECTIVENESS_FILES,
  'delivery S7 activation-effectiveness boundary',
);
exactArray(
  s7?.exact_changed_file_boundary,
  IMPLEMENTATION_FILES,
  'delivery S7 implementation boundary',
);
exactArray(
  s7?.pending_completion_claims,
  COMPLETION_CLAIMS,
  'delivery S7 pending claims',
);
exactArray(
  s7?.preserved_nonclaims,
  PRESERVED_NONCLAIMS,
  'delivery S7 preserved nonclaims',
);
check(
  s7?.closure_effective === false,
  'S7 closure remains ineffective',
);
check(
  s7?.completion_claims_status
    === 'PENDING_S8_FINALIZATION',
  'S7 completion claims remain pending S8',
);
check(
  s7?.s8_authorized === false,
  'S8 remains unauthorized',
);

check(
  s8?.status === 'BLOCKED',
  'S8 remains BLOCKED',
);
check(
  s8?.baseline_main_commit === null,
  'S8 baseline remains unset',
);
check(
  s8?.branch === null,
  'S8 branch remains unset',
);
check(
  delivery.successor_authorized === false,
  'MCFT-CAP-04 remains unauthorized',
);
check(
  Array.isArray(delivery.next_authorized_slice_ids)
    && delivery.next_authorized_slice_ids.length === 0,
  'no downstream slice implicitly authorized',
);

for (const marker of [
  'aggregate all merged-main CAP-03 evidence',
  'freeze the fifteen completion claims as pending',
  'retain the temporary `NO_MCFT_CAP_03_COMPLETE_CLAIM`',
  'keep closure_effective false',
  'keep S8 blocked',
  'MCFT-CAP-04 remains unauthorized',
]) {
  check(
    contract.includes(marker),
    `contract marker: ${marker}`,
  );
}

if (MODE === 'postmerge') {
  check(
    status.status === 'ACTIVATED',
    'postmerge closure activation status ACTIVATED',
  );
  check(
    status.activation_effective === true,
    'postmerge closure activation effective',
  );
  check(
    status.implementation_status === 'AUTHORIZED',
    'postmerge closure implementation authorized',
  );
  check(
    status.implementation_authorized === true,
    'postmerge implementation authorization true',
  );
  check(
    delivery.status === 'CLOSURE_ACTIVATED',
    'postmerge delivery status CLOSURE_ACTIVATED',
  );
  check(
    delivery.active_delivery_slice_id === S7,
    'postmerge S7 active delivery slice',
  );
  check(
    s7?.status === 'ACTIVATED',
    'postmerge delivery S7 ACTIVATED',
  );
  check(
    s7?.activation?.effective === true,
    'postmerge delivery activation effective',
  );
  check(
    git(['branch', '--show-current']) === 'main',
    'postmerge Gate runs on main',
  );
  check(
    git(['rev-parse', 'HEAD'])
      === git(['rev-parse', 'origin/main']),
    'postmerge local main equals origin/main',
  );
} else {
  check(
    status.status === 'ACTIVATION_READY_FOR_MERGE',
    `${MODE} closure activation ready`,
  );
  check(
    status.activation_effective === false,
    `${MODE} closure activation ineffective`,
  );
  check(
    status.implementation_status === 'NOT_AUTHORIZED',
    `${MODE} closure implementation unauthorized`,
  );
  check(
    status.implementation_authorized === false,
    `${MODE} implementation authorization false`,
  );
  check(
    delivery.status === 'CLOSURE_ACTIVATION_READY_FOR_MERGE',
    `${MODE} delivery status exact`,
  );
  check(
    delivery.active_delivery_slice_id === S7,
    `${MODE} S7 active delivery slice`,
  );
  check(
    s7?.status === 'ACTIVATION_READY_FOR_MERGE',
    `${MODE} delivery S7 activation ready`,
  );
  check(
    s7?.activation?.effective === false,
    `${MODE} delivery activation ineffective`,
  );
  check(
    git(['branch', '--show-current']) === ACTIVATION_BRANCH,
    `${MODE} Gate runs on activation branch`,
  );
}

if (MODE !== 'postmerge') {
  exactArray(
    changedFiles(),
    EXACT_ACTIVATION_FILES,
    'actual activation changed-file set',
  );
}

try {
  git(['diff', '--check', BASELINE]);
  check(true, 'git diff --check PASS');
} catch {
  check(false, 'git diff --check PASS');
}

console.log(
  `MCFT-CAP-03 S7 Closure activation ${MODE}: ${pass} PASS, ${fail} FAIL`,
);

if (fail > 0) {
  process.exit(1);
}
