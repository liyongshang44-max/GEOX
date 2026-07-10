// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_OBSERVATION_ASSIMILATION.cjs
// Purpose: gate the exact MCFT-CAP-03 S2 observation-selection and pure assimilation-math slice in draft, final-premerge, and merged-main postmerge contexts.
// Boundary: governance orchestration only; no database, persistence, A2 builder, Runtime tick, migration, route, scheduler, Forecast success, or production claim.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'ed816b9f2f2061183918e0dfb484b949859ff3aa';
const BRANCH = 'mcft-cap-03-observation-selection-assimilation-math-v1';
const S1 = 'MCFT-CAP-03.MCFT-02-07-08.ASSIMILATION-CONTRACTS-CONFIG-V1';
const SLICE = 'MCFT-CAP-03.MCFT-05-07.OBSERVATION-SELECTION-AND-ASSIMILATION-MATH-V1';
const NEXT_SLICE = 'MCFT-CAP-03.MCFT-02-07-08.ASSIMILATED-A2-RECORD-SET-BUILDER-V1';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : process.argv.includes('--draft') ? 'draft' : 'final';

const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const STATUS_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-OBSERVATION-ASSIMILATION-STATUS.json';
const CONTRACT_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-OBSERVATION-ASSIMILATION.md';

const EXACT_CHANGED_FILES = [
  'apps/server/src/domain/soil_water/assimilated_continuation_posterior_v1.ts',
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v1.ts',
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v1.ts',
  DELIVERY_PATH,
  STATUS_PATH,
  CONTRACT_PATH,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_OBSERVATION_ASSIMILATION.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_OBSERVATION_ASSIMILATION.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_OBSERVATION_ASSIMILATION_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_03_observation_assimilation_fixture_v1.ts',
].sort();

const PRESERVED_NONCLAIMS = [
  'NO_CAP_03_A2_TICK_COMMITTED',
  'NO_PERSISTENCE_CHANGE',
  'NO_OBSERVATION_UPDATE_PERSISTED',
  'NO_SUCCESSFUL_FORECAST',
  'NO_72_HOUR_FORECAST',
  'NO_SCENARIO',
  'NO_RECOMMENDATION',
  'NO_POLICY_EVALUATION',
  'NO_DECISION',
  'NO_AO_ACT',
  'NO_CALIBRATION_CANDIDATE',
  'NO_SHADOW_EVALUATION',
  'NO_MODEL_ACTIVATION',
  'NO_ACTIVE_MODEL_PARAMETER_CHANGE',
  'NO_LATE_EVIDENCE_REVISION',
  'NO_CONTINUOUS_RUNTIME',
  'NO_LIVE_FIELD_CLAIM',
  'NO_MCFT_CAP_03_COMPLETE_CLAIM',
  'NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM',
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

function run(command, args) {
  return cp.execFileSync(command, args, {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function checkRequiredFiles() {
  for (const file of EXACT_CHANGED_FILES) check(fs.existsSync(path.join(ROOT, file)), `${MODE} file exists: ${file}`);
}

function checkExactBoundary() {
  const status = readJson(STATUS_PATH);
  const mergeCommit = status.merge_commit || null;
  const target = MODE === 'postmerge' ? mergeCommit : 'HEAD';
  if (MODE === 'postmerge') check(typeof mergeCommit === 'string' && /^[0-9a-f]{40}$/.test(mergeCommit), 'postmerge status records exact S2 merge commit');
  if (!target) return;

  try {
    cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', BASELINE, target], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    check(true, `${MODE} target descends from exact S1 postmerge baseline`);
  } catch {
    check(false, `${MODE} target descends from exact S1 postmerge baseline`);
  }

  if (MODE === 'postmerge') {
    try {
      cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', target, 'HEAD'], {
        cwd: ROOT,
        stdio: 'ignore',
      });
      check(true, 'S2 merge commit is an ancestor of current main HEAD');
    } catch {
      check(false, 'S2 merge commit is an ancestor of current main HEAD');
    }
  }

  try {
    const changed = git(['diff', '--name-only', `${BASELINE}...${target}`]).split(/\r?\n/).filter(Boolean).sort();
    check(JSON.stringify(changed) === JSON.stringify(EXACT_CHANGED_FILES), `exact S2 changed-file set has ${EXACT_CHANGED_FILES.length} files`);
    const forbidden = changed.filter((file) =>
      file.startsWith('apps/web/')
      || file.startsWith('apps/server/src/routes/')
      || file.startsWith('apps/server/db/migrations/')
      || file.startsWith('apps/server/src/persistence/')
      || file.startsWith('fixtures/mcft/')
      || file.startsWith('.github/workflows/')
      || file.includes('/cap_02/')
      || file.endsWith('/continuation_tick_service_v1.ts')
      || file.endsWith('/continuation_record_set_builder_v1.ts'),
    );
    check(forbidden.length === 0, `no CAP-02, persistence, tick, builder, migration, route, web, fixture, or workflow file changed: ${forbidden.join(',')}`);
    git(['diff', '--check', `${BASELINE}...${target}`]);
    check(true, 'S2 git diff --check PASS');
  } catch (error) {
    check(false, `S2 changed-file boundary available: ${error.message}`);
  }
}

function checkStatus() {
  const delivery = readJson(DELIVERY_PATH);
  const status = readJson(STATUS_PATH);
  const predecessor = delivery.slices.find((slice) => slice.delivery_slice_id === S1);
  const current = delivery.slices.find((slice) => slice.delivery_slice_id === SLICE);
  const next = delivery.slices.find((slice) => slice.delivery_slice_id === NEXT_SLICE);

  check(delivery.capability_line_id === 'MCFT-CAP-03', 'delivery capability exact');
  check(delivery.design_status === 'DESIGN_FROZEN', 'CAP-03 design remains frozen');
  check(delivery.authorization_effective === true, 'CAP-03 authorization remains effective');
  check(predecessor?.status === 'MERGED', 'S1 delivery status MERGED');
  check(predecessor?.merge_commit === 'bbd4c916923b208d78dcf27f6e26ed255abe1262', 'S1 merge commit exact');
  check(predecessor?.merged_main_gate === 'PASS', 'S1 merged-main Gate PASS');
  check(predecessor?.effectiveness_condition_satisfied === true, 'S1 effectiveness condition satisfied');
  check(delivery.active_delivery_slice_id === SLICE, 'S2 is the only active delivery slice');
  check(Boolean(current), 'S2 delivery declaration exists');
  check(current?.branch === BRANCH, 'S2 branch exact');
  check(current?.baseline_main_commit === BASELINE, 'S2 baseline exact');
  check(current?.primary_owner_work_package_id === 'MCFT-07', 'S2 primary owner exact');
  check(JSON.stringify(current?.contributing_owner_work_package_ids) === JSON.stringify(['MCFT-05']), 'S2 contributor exact');
  check(JSON.stringify(current?.depends_on_delivery_slice_ids) === JSON.stringify([S1]), 'S2 dependency exact');
  check(current?.activation_fields_status === 'FROZEN', 'S2 activation fields frozen');
  check(JSON.stringify([...(current?.exact_changed_file_boundary || [])].sort()) === JSON.stringify(EXACT_CHANGED_FILES), 'S2 exact changed-file boundary matches Gate');
  check(Array.isArray(delivery.next_authorized_slice_ids) && delivery.next_authorized_slice_ids.length === 0, 'no parallel downstream slice authorized');
  check(next?.status === 'BLOCKED', 'S3A remains blocked before S2 merged-main effectiveness');
  check(delivery.successor_authorized === false, 'MCFT-CAP-04 remains unauthorized');
  check(status.baseline_main_commit === BASELINE, 'S2 status baseline exact');
  check(status.branch === BRANCH, 'S2 status branch exact');
  check(status.predecessor_effectiveness?.s1_merged_main_gate === 'PASS_116_OF_116', 'S1 local postmerge evidence recorded');
  check(status.successor_authorized === false, 'S2 status does not authorize S3A');

  if (MODE === 'draft') {
    check(status.status === 'IN_PROGRESS', 'draft S2 status IN_PROGRESS');
    check(current?.status === 'IN_PROGRESS', 'draft delivery S2 IN_PROGRESS');
  } else if (MODE === 'final') {
    check(status.status === 'READY_FOR_MERGE', 'final S2 status READY_FOR_MERGE');
    check(current?.status === 'READY_FOR_MERGE', 'final delivery S2 READY_FOR_MERGE');
  } else {
    check(status.status === 'MERGED', 'postmerge S2 status MERGED');
    check(current?.status === 'MERGED', 'postmerge delivery S2 MERGED');
    check(status.effectiveness_condition_satisfied === true, 'postmerge S2 effectiveness recorded');
  }

  for (const nonclaim of PRESERVED_NONCLAIMS) {
    check(status.preserved_nonclaims?.includes(nonclaim), `status preserved nonclaim: ${nonclaim}`);
    check(current?.preserved_nonclaims?.includes(nonclaim), `delivery preserved nonclaim: ${nonclaim}`);
  }
}

function checkContractDocument() {
  const document = readText(CONTRACT_PATH);
  for (const marker of [
    'MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V1',
    'LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V1',
    'IDENTICAL_DUPLICATE_SUPPRESSED',
    'CONFLICTING_DUPLICATE_EVIDENCE',
    'INNOVATION_SQUARED_LE_16_TIMES_VARIANCE',
    'STATE_OBSERVATION_INNOVATION',
    'SCALAR_GAUSSIAN_ASSIMILATION_V1',
    'DECIMAL_HALF_AWAY_FROM_ZERO_V1',
    'NO_CAP_03_A2_TICK_COMMITTED',
  ]) check(document.includes(marker), `contract document marker: ${marker}`);
}

function checkSourceAnchors() {
  const selector = readText('apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v1.ts');
  const window = readText('apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v1.ts');
  const math = readText('apps/server/src/domain/soil_water/assimilated_continuation_posterior_v1.ts');

  check(selector.includes('semanticHashV1'), 'selector uses canonical semantic hash');
  check(selector.includes('source_version'), 'semantic identity includes source version');
  check(selector.includes('CONFLICTING_DUPLICATE_EVIDENCE'), 'conflicting duplicate Evidence fails closed');
  check(selector.includes('IDENTICAL_DUPLICATE_SUPPRESSED'), 'identical duplicate suppression implemented');
  check(selector.includes('ASSIMILATED_OBSERVATION_MAX_AGE_SECONDS_V1'), '15-minute observation age bound implemented');
  check(selector.includes('winner.candidate.candidate_assessment === "ELIGIBLE"'), 'physical and FAIL-quality winners cannot enter usable selection');
  check(window.includes('buildContinuationEvidenceWindowV1'), 'CAP-03 Evidence Window composes immutable CAP-02 builder');
  check(window.includes('dynamics_consumed_evidence_refs'), 'dynamics Evidence trace separated');
  check(window.includes('assimilation_applied_evidence_refs'), 'applied observation Evidence trace separated');
  check(window.includes('uniqueSortedV1([...dynamicsConsumed, ...applied])'), 'compatibility consumed refs are deterministic union');
  check(math.includes('innovationSquared'), 'direct squared innovation authority implemented');
  check(math.includes('<= ASSIMILATED_CONTINUATION_MAX_SQUARED_NORMALIZED_INNOVATION_V1 * innovationVariance'), 'inclusive direct squared threshold implemented');
  check(math.includes('candidate_unclipped_posterior_mean: null'), 'outlier publishes no candidate posterior mean');
  check(math.includes('DECIMAL_HALF_AWAY_FROM_ZERO_V1'), 'canonical decimal rounding rule declared');
  check(math.includes('physical_clipping_reduces_latent_variance: false'), 'clipping retains latent variance');
}

function runTsxAcceptance(relativePath, summaryPattern, message) {
  try {
    const output = run(pnpmCommand(), ['-w', 'exec', 'tsx', relativePath]);
    process.stdout.write(output);
    check(summaryPattern.test(output), message);
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    check(false, message);
  }
}

function runStaticAcceptance() {
  runTsxAcceptance(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_OBSERVATION_ASSIMILATION.ts',
    /MCFT-CAP-03 observation-assimilation: \d+ PASS, 0 FAIL/,
    'S2 positive in-memory acceptance PASS',
  );
  runTsxAcceptance(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_OBSERVATION_ASSIMILATION_NEGATIVE.ts',
    /MCFT-CAP-03 observation-assimilation negative: \d+ PASS, 0 FAIL/,
    'S2 negative in-memory acceptance PASS',
  );
}

function runToolchain() {
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
}

function checkContext() {
  try {
    const branch = git(['branch', '--show-current']);
    if (MODE === 'postmerge') {
      check(branch === 'main', 'postmerge Gate runs on main');
      check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'refs/remotes/origin/main']), 'postmerge local main equals origin/main');
    } else {
      check(branch === BRANCH, `${MODE} Gate runs on S2 branch`);
    }
  } catch (error) {
    check(false, `Git context readable: ${error.message}`);
  }
}

checkRequiredFiles();
checkExactBoundary();
checkStatus();
checkContractDocument();
checkSourceAnchors();
runStaticAcceptance();
runToolchain();
checkContext();

console.log(`MCFT-CAP-03 observation-assimilation ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
