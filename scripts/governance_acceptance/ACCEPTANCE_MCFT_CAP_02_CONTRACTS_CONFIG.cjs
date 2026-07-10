// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG.cjs
// Purpose: gate the exact MCFT-CAP-02 continuation contracts/config slice in draft, final-premerge, and explicit historical postmerge contexts.
// Boundary: governance orchestration only; no A2 continuation State write, hourly Dynamics, Evidence selection, Forecast success, route, scheduler, or production claim.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '65e59aaf5fcfccacdb986258874a5df3c057711d';
const CONTRACTS_CONFIG_MERGE_COMMIT = '2be7c985210d1f34fa5249e1fae68932e801facc';
const BRANCH = 'mcft-cap-02-contracts-config-v2';
const SLICE = 'MCFT-CAP-02.MCFT-02.CONTINUATION-CONTRACTS-CONFIG-V1';
const DYNAMICS_SLICE = 'MCFT-CAP-02.MCFT-06.PURE-HOURLY-DYNAMICS-V1';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : process.argv.includes('--draft') ? 'draft' : 'final';

const EXACT_CHANGED_FILES = [
  'apps/server/src/domain/twin_runtime/continuation_contracts_v1.ts',
  'apps/server/src/domain/twin_runtime/continuation_cross_ref_validator_v1.ts',
  'apps/server/src/domain/twin_runtime/continuation_operation_identity_v1.ts',
  'apps/server/src/domain/twin_runtime/continuation_record_set_identity_v1.ts',
  'apps/server/src/domain/twin_runtime/continuation_runtime_config_v1.ts',
  'apps/server/src/runtime/twin_runtime/continuation_runtime_config_authority_adapter_v1.ts',
  'apps/server/src/runtime/twin_runtime/continuation_runtime_config_service_v1.ts',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-CONTINUATION-OBJECT-CONTRACT.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-IDENTITY-CONTRACT.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-RUNTIME-CONFIG-CONTRACT.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG_NEGATIVE.ts',
].sort();

const PREMERGE_NONCLAIMS = [
  'NO_HOURLY_DYNAMICS_IMPLEMENTED',
  'NO_CONTINUATION_STATE_PERSISTED',
  'NO_OBSERVATION_UPDATE_APPLIED',
  'NO_OBSERVATION_INNOVATION_COMPUTED',
  'NO_FORECAST_RESIDUAL',
  'NO_SUCCESSFUL_FORECAST',
  'NO_SCENARIO',
  'NO_RECOMMENDATION',
  'NO_DECISION',
  'NO_AO_ACT',
  'NO_RESTART_RESUME_PROOF',
  'NO_BOUNDED_BACKFILL_PROOF',
  'NO_MCFT_CAP_02_COMPLETE_CLAIM',
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

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function git(args) {
  return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', args, {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
}

function run(command, args, env = process.env) {
  return cp.execFileSync(command, args, {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function checkExactBoundary() {
  const target = MODE === 'postmerge' ? CONTRACTS_CONFIG_MERGE_COMMIT : 'HEAD';
  try {
    cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', BASELINE, target], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    check(true, `${MODE} target descends from authorization merge commit`);
  } catch {
    check(false, `${MODE} target descends from authorization merge commit`);
  }

  if (MODE === 'postmerge') {
    try {
      cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', CONTRACTS_CONFIG_MERGE_COMMIT, 'HEAD'], {
        cwd: ROOT,
        stdio: 'ignore',
      });
      check(true, 'contracts/config merge commit is an ancestor of current HEAD');
    } catch {
      check(false, 'contracts/config merge commit is an ancestor of current HEAD');
    }
  }

  try {
    const changed = git(['diff', '--name-only', `${BASELINE}...${target}`]).split(/\r?\n/).filter(Boolean).sort();
    check(JSON.stringify(changed) === JSON.stringify(EXACT_CHANGED_FILES), `historical contracts/config changed-file set has ${EXACT_CHANGED_FILES.length} files`);
    const forbidden = changed.filter((file) =>
      file.startsWith('apps/web/')
      || file.startsWith('apps/server/src/routes/')
      || file.startsWith('apps/server/db/migrations/')
      || file.startsWith('apps/server/src/domain/soil_water/')
      || file.startsWith('apps/server/src/persistence/twin_runtime/')
      || file.startsWith('fixtures/mcft/water_state/')
      || file.startsWith('.github/workflows/'),
    );
    check(forbidden.length === 0, `no forbidden or future-slice file changed: ${forbidden.join(',')}`);
    git(['diff', '--check', `${BASELINE}...${target}`]);
    check(true, 'historical contracts/config git diff --check PASS');
  } catch (error) {
    check(false, `historical changed-file boundary and diff check available: ${error.message}`);
  }
}

function checkStatus() {
  const delivery = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json');
  const current = delivery.slices.find((slice) => slice.delivery_slice_id === SLICE);
  check(delivery.capability_line_id === 'MCFT-CAP-02', 'delivery status capability exact');
  check(Boolean(current), 'contracts/config slice declaration exists');
  check(current?.branch === BRANCH, 'contracts/config branch exact');
  check(current?.primary_owner_work_package_id === 'MCFT-02', 'contracts/config primary owner exact');
  check(JSON.stringify((current?.depends_on_delivery_slice_ids || [])) === JSON.stringify(['MCFT-CAP-02.GOV-AUTHORIZATION-V1']), 'contracts/config dependency exact');
  check(JSON.stringify([...(current?.exact_changed_file_boundary || [])].sort()) === JSON.stringify(EXACT_CHANGED_FILES), 'slice artifact exact historical changed-file boundary matches Gate');

  if (MODE === 'postmerge') {
    const dynamics = delivery.slices.find((slice) => slice.delivery_slice_id === DYNAMICS_SLICE);
    const activeDeliverySlices = delivery.slices.filter((slice) => ['IN_PROGRESS', 'READY_FOR_MERGE'].includes(slice.status));
    const debtRegister = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-GOVERNANCE-DEBT-REGISTER.json');
    const debt = debtRegister.debts?.find((candidate) => candidate.debt_id === 'MCFT-CAP-02.GOV-DEBT-001');
    check(current?.status === 'MERGED', 'postmerge contracts/config status exact');
    check(current?.merge_commit === CONTRACTS_CONFIG_MERGE_COMMIT, 'postmerge merge commit exact');
    check(current?.merged_main_acceptance?.final_gate === '63_PASS_0_FAIL', 'merged-main Gate evidence recorded');
    check(delivery.latest_verified_main_commit === CONTRACTS_CONFIG_MERGE_COMMIT, 'latest verified main commit exact');
    check(delivery.active_delivery_slice_id === DYNAMICS_SLICE, 'active slice advanced to pure hourly Dynamics');
    check(
      ['IN_PROGRESS', 'READY_FOR_MERGE'].includes(dynamics?.status)
        && activeDeliverySlices.length === 1
        && activeDeliverySlices[0]?.delivery_slice_id === DYNAMICS_SLICE,
      'pure hourly Dynamics is the only active delivery slice in an allowed premerge state',
    );
    check(debt?.status === 'REMEDIATED_IN_DYNAMICS_PREFLIGHT', 'governance debt remediation recorded');
    check(Array.isArray(delivery.next_authorized_slice_ids) && delivery.next_authorized_slice_ids.length === 0, 'no additional downstream slice authorized while Dynamics is active');
  } else {
    check(delivery.active_delivery_slice_id === SLICE, 'contracts/config is active delivery slice');
    check(MODE === 'draft' ? current?.status === 'IN_PROGRESS' : current?.status === 'READY_FOR_MERGE', `${MODE} slice status exact`);
    check(Array.isArray(delivery.next_authorized_slice_ids) && delivery.next_authorized_slice_ids.length === 0, 'next slice remains unauthorized before merge');
  }

  for (const nonclaim of PREMERGE_NONCLAIMS) check(current?.preserved_nonclaims?.includes(nonclaim), `contracts/config preserved nonclaim: ${nonclaim}`);
}

function checkContractArtifacts() {
  const objectContract = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-CONTINUATION-OBJECT-CONTRACT.json');
  const configContract = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-RUNTIME-CONFIG-CONTRACT.json');
  const identityContract = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-IDENTITY-CONTRACT.json');
  check(objectContract.member_count === 8, 'continuation object contract has exactly eight members');
  check(objectContract.transition_contract?.transition_kind === 'CONTINUATION', 'CONTINUATION transition contract frozen');
  check(objectContract.assimilation_contract?.status === 'NOT_APPLIED', 'NOT_APPLIED assimilation contract frozen');
  check(objectContract.checkpoint_contract?.initial_checkpoint_implicit_tick_sequence === 0, 'INITIAL checkpoint sequence bridge frozen at zero');
  check(configContract.transaction_family === 'D_MODEL_GOVERNANCE_STEP_COMMIT', 'Runtime Config D transaction family frozen');
  check(configContract.config_selection_mode === 'EXPLICIT_REPLAY_PIN', 'Runtime Config explicit Replay pin frozen');
  check(configContract.soil_hydraulic_snapshot?.root_zone_depth_mm === 300, 'fixed 300 mm root-zone policy frozen');
  check(identityContract.operation_key?.forbidden_fields?.includes('evidence_window_semantic_digest'), 'operation key excludes Evidence digest');
  check(identityContract.aggregate_hash?.required_fields?.includes('evidence_window_semantic_digest'), 'aggregate hash includes Evidence digest');
  check(identityContract.canonical_uniqueness_required_when_idempotency_projection_missing === true, 'canonical uniqueness recovery requirement frozen');
}

function checkSourceAnchors() {
  const operation = readText('apps/server/src/domain/twin_runtime/continuation_operation_identity_v1.ts');
  const aggregate = readText('apps/server/src/domain/twin_runtime/continuation_record_set_identity_v1.ts');
  const contracts = readText('apps/server/src/domain/twin_runtime/continuation_contracts_v1.ts');
  const graph = readText('apps/server/src/domain/twin_runtime/continuation_cross_ref_validator_v1.ts');
  const config = readText('apps/server/src/domain/twin_runtime/continuation_runtime_config_v1.ts');
  const service = readText('apps/server/src/runtime/twin_runtime/continuation_runtime_config_service_v1.ts');
  check(operation.includes('EVIDENCE_DIGEST_FORBIDDEN_IN_CONTINUATION_OPERATION_KEY'), 'operation identity rejects Evidence digest');
  check(aggregate.includes('evidence_window_semantic_digest'), 'aggregate identity consumes Evidence digest');
  check(contracts.includes('rejectRecursiveTraceSelfHashV1'), 'mass-balance trace self-hash rejection is recursive');
  check(contracts.includes('CONTINUATION_STORAGE_MEAN_DECIMAL", 6'), 'storage mean computation basis scale is six');
  check(contracts.includes('CONTINUATION_STORAGE_VARIANCE_DECIMAL", 12'), 'storage variance computation basis scale is twelve');
  check(contracts.includes('CONTINUATION_ASSIMILATION_STATUS_MISMATCH'), 'NOT_APPLIED assimilation validation implemented');
  check(contracts.includes('resolvePreviousCheckpointTickSequenceV1'), 'checkpoint sequence bridge implemented');
  check(graph.includes('CONTINUATION_SUBSEQUENT_TICK_VARIANCE_REDERIVATION_FORBIDDEN'), 'subsequent tick variance re-derivation is forbidden');
  check(graph.includes('CONTINUATION_STATE_TRANSITION_TRACE_HASH_MISMATCH'), 'State/Transition trace hash graph validation implemented');
  check(config.includes('D_MODEL_GOVERNANCE_STEP_COMMIT') === false, 'domain config remains independent of transaction I/O');
  check(service.includes('commitAndVerify'), 'D transaction application service performs canonical readback');
}

function runTsxAcceptance(relativePath, summaryPattern, message) {
  try {
    const output = run(pnpmCommand(), ['exec', 'tsx', relativePath]);
    process.stdout.write(output);
    check(summaryPattern.test(output), message);
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    check(false, message);
  }
}

function runStaticAcceptance() {
  runTsxAcceptance(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG.ts',
    /MCFT-CAP-02 contracts-config: \d+ PASS, 0 FAIL/,
    'contracts/config static acceptance PASS',
  );
  runTsxAcceptance(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG_NEGATIVE.ts',
    /MCFT-CAP-02 contracts-config negative: \d+ PASS, 0 FAIL/,
    'contracts/config negative acceptance PASS',
  );
}

function runToolchainAndDatabase() {
  // The destructive D-transaction proof belongs to this slice's own final-premerge Gate.
  // Historical postmerge verification consumes the frozen 63/0 and 6/0 evidence instead
  // of coupling every downstream slice to a repeated destructive predecessor database run.
  if (MODE !== 'final') return;
  for (const [label, args] of [
    ['server typecheck', ['--filter', '@geox/server', 'typecheck']],
    ['server build', ['--filter', '@geox/server', 'build']],
  ]) {
    try {
      const output = run(pnpmCommand(), args);
      process.stdout.write(output);
      check(true, `${label} PASS`);
    } catch (error) {
      process.stderr.write(error.stderr || error.message);
      check(false, `${label} PASS`);
    }
  }

  if (process.env.MCFT_CAP_02_CONTRACTS_CONFIG_DESTRUCTIVE_ACCEPTANCE !== '1' || !process.env.DATABASE_URL) {
    check(false, `${MODE} Gate requires isolated PostgreSQL D-transaction acceptance environment`);
    return;
  }
  try {
    const output = run(
      pnpmCommand(),
      ['exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG_DB.ts'],
      process.env,
    );
    process.stdout.write(output);
    check(/MCFT-CAP-02 contracts-config DB: \d+ PASS, 0 FAIL/.test(output), 'contracts/config PostgreSQL acceptance PASS');
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    check(false, 'contracts/config PostgreSQL acceptance PASS');
  }
}

checkExactBoundary();
checkStatus();
checkContractArtifacts();
checkSourceAnchors();
runStaticAcceptance();
runToolchainAndDatabase();

console.log(`MCFT-CAP-02 contracts-config ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
