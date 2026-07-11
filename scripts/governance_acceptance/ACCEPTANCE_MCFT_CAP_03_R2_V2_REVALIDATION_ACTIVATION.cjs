// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_R2_V2_REVALIDATION_ACTIVATION.cjs
// Purpose: prove the governance-only R2 V2 revalidation boundary freeze without authorizing Runtime implementation.
// Boundary: repository files and Git metadata only; no database, network, Runtime execution, canonical write, or downstream activation.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

const baseline =
  '6ef413b7afe6c8bb9997c035aa18cf8bca0f394d';

const activationBranch =
  'mcft-cap-03-s2-semantic-conformance-r2-boundary-freeze-v1';

const r2SliceId =
  'MCFT-CAP-03.S2-SEMANTIC-CONFORMANCE-R2-V2-REVALIDATION-V1';

const deliveryPath =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';

const remediationPath =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-S2-SEMANTIC-CONFORMANCE-REMEDIATION-STATUS.json';

const r2StatusPath =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R2-V2-REVALIDATION-STATUS.json';

const r2DocPath =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R2-V2-REVALIDATION.md';

const gatePath =
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_R2_V2_REVALIDATION_ACTIVATION.cjs';

const activationBoundary = [
  deliveryPath,
  remediationPath,
  r2StatusPath,
  r2DocPath,
  gatePath,
].sort();

const effectivenessBoundary = [
  deliveryPath,
  remediationPath,
  r2StatusPath,
].sort();

const expectedImplementationBoundary = [
  'apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v2.ts',
  'apps/server/src/domain/twin_runtime/assimilated_continuation_cross_ref_validator_v2.ts',
  'apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_identity_v2.ts',
  'apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_validator_v2.ts',
  'apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v2.ts',
  'apps/server/src/domain/twin_runtime/continuation_record_set_dispatch_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts',
  'apps/server/src/runtime/twin_runtime/assimilated_contiguous_range_service_v2.ts',
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_record_set_builder_v2.ts',
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_authority_adapter_v2.ts',
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_service_v2.ts',
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v2.ts',
  'apps/server/src/runtime/twin_runtime/assimilated_restart_resume_service_v2.ts',
  'apps/server/src/runtime/twin_runtime/ports.ts',
  deliveryPath,
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-ASSIMILATED-PERSISTENCE-RECOVERY-STATUS.json',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-ASSIMILATED-RECORD-SET-BUILDER-STATUS.json',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-OBSERVATION-ASSIMILATION-STATUS.json',
  r2StatusPath,
  r2DocPath,
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-RESTART-BACKFILL-RECOVERY-STATUS.json',
  remediationPath,
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-SINGLE-TICK-INTEGRATION-STATUS.json',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_R2_V2_REVALIDATION.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R2_V2_REVALIDATION.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R2_V2_REVALIDATION_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R2_V2_REVALIDATION_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_03_r2_v2_revalidation_fixture_v1.ts',
].sort();

const mode = process.argv[2];

if (!['--draft', '--final', '--postmerge'].includes(mode)) {
  throw new Error('R2_ACTIVATION_GATE_MODE_REQUIRED');
}

let pass = 0;

function git(args) {
  return cp.execFileSync(
    process.platform === 'win32'
      ? 'git.exe'
      : 'git',
    args,
    {
      cwd: root,
      encoding: 'utf8',
      stdio: [
        'ignore',
        'pipe',
        'pipe',
      ],
    },
  ).trim();
}

function check(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
    return;
  }

  pass += 1;
  console.log(`PASS ${message}`);
}

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(
      path.join(root, relativePath),
      'utf8',
    ),
  );
}

function sameArray(left, right) {
  return JSON.stringify([...left].sort())
    === JSON.stringify([...right].sort());
}

for (const relativePath of activationBoundary) {
  check(
    fs.existsSync(path.join(root, relativePath)),
    `${mode.slice(2)} file exists: ${relativePath}`,
  );
}

const branch = git(['branch', '--show-current']);
const head = git(['rev-parse', 'HEAD']);
const originMain = git(['rev-parse', 'origin/main']);

if (mode === '--postmerge') {
  check(branch === 'main', 'postmerge Gate runs on main');
  check(head === originMain, 'postmerge local main equals origin/main');
} else {
  check(branch === activationBranch, 'activation branch exact');
  check(head !== baseline, 'activation candidate commit exists');
}

cp.execFileSync(
  process.platform === 'win32'
    ? 'git.exe'
    : 'git',
  [
    'merge-base',
    '--is-ancestor',
    baseline,
    head,
  ],
  {
    cwd: root,
    stdio: 'ignore',
  },
);

check(true, 'target descends from exact R1 effectiveness baseline');

const changedFiles = git([
  'diff',
  '--name-only',
  `${baseline}...${head}`,
])
  .split(/\r?\n/u)
  .filter(Boolean)
  .sort();

check(
  sameArray(changedFiles, activationBoundary),
  'exact five-file R2 activation boundary',
);

const diffCheck = cp.spawnSync(
  process.platform === 'win32'
    ? 'git.exe'
    : 'git',
  [
    'diff',
    '--check',
    `${baseline}...${head}`,
  ],
  {
    cwd: root,
    encoding: 'utf8',
  },
);

check(
  diffCheck.status === 0,
  'R2 activation git diff --check PASS',
);

check(
  changedFiles.every(
    (file) =>
      file.startsWith('docs/')
      || file === gatePath,
  ),
  'R2 activation changes governance files only',
);

const delivery = readJson(deliveryPath);
const remediation = readJson(remediationPath);
const r2 = readJson(r2StatusPath);
const document = fs.readFileSync(
  path.join(root, r2DocPath),
  'utf8',
);

check(
  delivery.status
    === 'S2_SEMANTIC_CONFORMANCE_REMEDIATION_R2_BOUNDARY_FREEZE_CANDIDATE',
  'delivery R2 boundary-freeze candidate exact',
);

check(
  delivery.implementation_status
    === 'R2_BOUNDARY_FREEZE_CANDIDATE',
  'delivery implementation status remains governance-only',
);

check(
  delivery.active_delivery_slice_id === r2SliceId,
  'R2 delivery slice active',
);

check(
  Array.isArray(delivery.next_authorized_slice_ids)
    && delivery.next_authorized_slice_ids.length === 0,
  'no downstream implementation authorized',
);

check(
  delivery.successor_authorized === false,
  'MCFT-CAP-04 remains unauthorized',
);

const r2Slice = delivery.slices.find(
  (slice) => slice.delivery_slice_id === r2SliceId,
);

check(Boolean(r2Slice), 'R2 delivery slice recorded');

check(
  r2Slice?.status === 'BOUNDARY_FREEZE_CANDIDATE',
  'R2 slice status exact',
);

check(
  r2Slice?.implementation_authorized === false,
  'R2 slice implementation unauthorized',
);

check(
  sameArray(
    r2Slice?.exact_activation_changed_file_boundary ?? [],
    activationBoundary,
  ),
  'R2 slice activation boundary exact',
);

check(
  sameArray(
    r2Slice?.frozen_implementation_changed_file_boundary ?? [],
    expectedImplementationBoundary,
  ),
  'R2 slice implementation boundary exact',
);

check(
  remediation.r1_effective === true,
  'R1 remains effective',
);

check(
  remediation.status === 'R2_BOUNDARY_FREEZE_CANDIDATE',
  'remediation status exact',
);

check(
  remediation.r2_boundary_status === 'FREEZE_CANDIDATE',
  'R2 boundary candidate recorded',
);

check(
  remediation.r2_boundary_frozen === false,
  'R2 boundary not yet effective',
);

check(
  remediation.r2_implementation_authorized === false,
  'R2 implementation remains unauthorized',
);

check(
  sameArray(
    remediation.r2_boundary_freeze_changed_file_boundary,
    activationBoundary,
  ),
  'remediation activation boundary exact',
);

check(
  sameArray(
    remediation.r2_boundary_effectiveness_changed_file_boundary,
    effectivenessBoundary,
  ),
  'remediation effectiveness boundary exact',
);

check(
  sameArray(
    remediation.r2_frozen_implementation_changed_file_boundary,
    expectedImplementationBoundary,
  ),
  'remediation implementation boundary exact',
);

const r2Graph = remediation.remediation_graph.find(
  (step) => step.step_id === 'R2',
);

const r3Graph = remediation.remediation_graph.find(
  (step) => step.step_id === 'R3',
);

check(
  r2Graph?.status === 'BOUNDARY_FREEZE_CANDIDATE',
  'R2 graph boundary candidate exact',
);

check(
  r3Graph?.status === 'BLOCKED_UNTIL_R2_EFFECTIVE',
  'R3 remains blocked',
);

check(
  r2.status === 'BOUNDARY_FREEZE_CANDIDATE',
  'R2 SSOT status exact',
);

check(
  r2.boundary_freeze_authorized === true,
  'R2 boundary freeze authorized',
);

check(
  r2.boundary_frozen === false,
  'R2 SSOT boundary remains ineffective',
);

check(
  r2.implementation_authorized === false,
  'R2 SSOT implementation unauthorized',
);

check(
  r2.r1_predecessor?.effectiveness_condition_satisfied === true,
  'R1 predecessor effectiveness recorded',
);

check(
  r2.r1_predecessor?.effectiveness_merge_commit === baseline,
  'R1 effectiveness merge commit exact',
);

check(
  sameArray(
    r2.frozen_activation_changed_file_boundary,
    activationBoundary,
  ),
  'R2 SSOT activation boundary exact',
);

check(
  sameArray(
    r2.frozen_activation_effectiveness_changed_file_boundary,
    effectivenessBoundary,
  ),
  'R2 SSOT activation effectiveness boundary exact',
);

check(
  sameArray(
    r2.frozen_implementation_changed_file_boundary,
    expectedImplementationBoundary,
  ),
  'R2 SSOT implementation boundary exact',
);

check(
  r2.excluded_governance_debts?.[0]?.debt_id
    === 'MCFT-CAP-03.GOV-DEBT-001'
    && r2.excluded_governance_debts?.[0]?.issue_number === 2351,
  'P1 smoke debt recorded and excluded',
);

check(
  r2.frozen_strategy?.historical_v1_contract_and_readback
    === 'IMMUTABLE_AND_MUST_REMAIN_VALID',
  'historical V1 remains immutable',
);

check(
  r2.frozen_strategy?.same_operation_key_dual_write
    === 'FORBIDDEN_FAIL_CLOSED',
  'same-key V1/V2 dual write forbidden',
);

check(
  r2.frozen_strategy?.persistence_strategy
    === 'EXISTING_A2_TRANSACTION_AND_PROJECTIONS_ZERO_MIGRATION',
  'zero-migration persistence boundary exact',
);

const s6 = delivery.slices.find(
  (slice) =>
    slice.delivery_slice_id
    === 'MCFT-CAP-03.MCFT-03-04-07-08.RESTART-BACKFILL-RECOVERY-V1',
);

const s7 = delivery.slices.find(
  (slice) =>
    slice.delivery_slice_id
    === 'MCFT-CAP-03.CLOSURE-V1',
);

const s8 = delivery.slices.find(
  (slice) =>
    slice.delivery_slice_id
    === 'MCFT-CAP-03.CLOSURE-FINALIZATION-V1',
);

check(
  s6?.status === 'IMPLEMENTATION_MERGED_EFFECTIVENESS_PAUSED'
    && s6?.effectiveness_condition_satisfied === false,
  'S6 remains paused and ineffective',
);

check(
  s7?.status === 'BLOCKED'
    && s7?.baseline_main_commit === null
    && s7?.branch === null,
  'S7 remains blocked and unset',
);

check(
  s8?.status === 'BLOCKED'
    && s8?.baseline_main_commit === null
    && s8?.branch === null,
  'S8 remains blocked and unset',
);

check(
  r2.preserved_nonclaims.includes(
    'NO_MCFT_CAP_03_COMPLETE_CLAIM',
  ),
  'completion claim remains forbidden',
);

for (const marker of [
  'Historical V1 contracts, validators, facts, and readback remain valid and immutable.',
  'V1 and V2 writes for the same continuation operation key are forbidden',
  'S6 effectiveness remains paused.',
  'GitHub issue #2351',
]) {
  check(
    document.includes(marker),
    `contract marker: ${marker}`,
  );
}

if (process.exitCode) {
  console.error(
    `MCFT-CAP-03 R2 V2 revalidation activation: ${pass} PASS, 1+ FAIL`,
  );
  process.exit(process.exitCode);
}

console.log(
  `MCFT-CAP-03 R2 V2 revalidation activation: ${pass} PASS, 0 FAIL`,
);