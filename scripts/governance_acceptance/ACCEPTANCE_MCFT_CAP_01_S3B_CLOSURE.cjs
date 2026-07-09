// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_01_S3B_CLOSURE.cjs
// Purpose: validate S3B closure evidence, successor authorization, changed-file boundary, and preserved Runtime nonclaims.
// Boundary: governance/static acceptance only; no State calculation, Runtime execution, database access, or canonical write.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '4ddd2bbf4d5d421f875e3ab5b1bfd76749f2ca3a';
const CANDIDATE = 'dca5541949f2aff39f3c49feb0ecc95cc3564b2a';
const S3B = 'MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1';
const S4 = 'MCFT-CAP-01.MCFT-04-05-08-09.A0-RUNTIME-INTEGRATION-V1';

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
function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

const delivery = readJson('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-DELIVERY-SLICE-STATUS.json');
const status = readJson('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-S3B-STATUS.json');
const mathDoc = fs.readFileSync(path.join(ROOT, 'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-BOOTSTRAP-MATH.md'), 'utf8');

check(delivery.capability_line_id === 'MCFT-CAP-01', 'capability line identity');
check(delivery.status === 'IN_IMPLEMENTATION', 'capability line remains IN_IMPLEMENTATION');
check(delivery.slices.length === 4, 'exact completed slice count is four');
const s3bSlice = delivery.slices.find((slice) => slice.delivery_slice_id === S3B);
check(s3bSlice?.status === 'COMPLETE', 'S3B delivery slice is COMPLETE');
check(s3bSlice?.depends_on_delivery_slice_ids?.includes('MCFT-CAP-01.MCFT-02.A0-CONTRACTS-AND-CONFIG-V1'), 'S3B depends on S2');
check(s3bSlice?.parallel_dependency_slice_ids?.includes('MCFT-CAP-01.MCFT-03.A0-PERSISTENCE-V1'), 'S3B records completed S3A parallel dependency');
check(JSON.stringify(delivery.next_authorized_slice_ids) === JSON.stringify([S4]), 'S4 is the only next authorized slice');
check(delivery.s3b_closure?.implementation_candidate_head === CANDIDATE, 'S3B implementation candidate head recorded');
check(delivery.s3b_closure?.implementation_candidate_ci?.run_number === 4441, 'S3B exact-head CI run recorded');
check(delivery.s3b_closure?.implementation_candidate_ci?.conclusion === 'success', 'S3B exact-head CI success recorded');
check(delivery.s3b_closure?.local_acceptance?.s3b_state_math === '108_PASS_0_FAIL', 'S3B local Gate evidence recorded');
check(delivery.s3b_closure?.local_acceptance?.working_tree === 'CLEAN', 'clean working tree evidence recorded');
check(delivery.s3b_closure?.transition_effective_condition === 'PR_2312_MERGED_AND_VERIFIED_ON_MAIN', 'closure effectiveness condition recorded');

check(status.delivery_slice_id === S3B, 'S3B status identity');
check(status.status === 'COMPLETE', 'S3B status file is COMPLETE');
check(status.implementation_candidate_head === CANDIDATE, 'S3B status candidate head');
check(status.evidence?.local?.s3b_state_math === '108_PASS_0_FAIL', 'S3B status local evidence');
check(status.evidence?.ci?.run_number === 4441 && status.evidence?.ci?.conclusion === 'success', 'S3B status CI evidence');
check(status.next_authorized_slice_id === S4, 'S3B status authorizes S4 next');
check(mathDoc.includes('status: COMPLETE'), 'bootstrap mathematics document records COMPLETE');
check(mathDoc.includes('S3B State Math Gate: 108 PASS, 0 FAIL'), 'bootstrap mathematics document records exact Gate result');

for (const claim of [
  'BOOTSTRAP_STATE_MATH_ESTABLISHED',
  'STATIC_BOOTSTRAP_ASSIMILATION_ESTABLISHED',
  'POSTERIOR_WATER_STATE_DTO_ESTABLISHED',
  'STATE_UNCERTAINTY_MATH_EXPLICIT',
  'PHYSICAL_BOUNDS_RULE_ESTABLISHED',
]) {
  check(status.completion_claims.includes(claim), `completion claim recorded: ${claim}`);
}

for (const nonclaim of [
  'NO_A0_RUNTIME_EXECUTION',
  'NO_BOOTSTRAP_STATE_COMMITTED',
  'NO_ACTIVE_INITIAL_LINEAGE',
  'NO_INITIAL_CHECKPOINT',
  'NO_FORECAST_CONSTRUCTION',
  'NO_PROPAGATION',
  'NO_CONTINUOUS_RUNTIME',
  'NO_MCFT_CAP_01_CLOSURE',
]) {
  check(status.nonclaims.includes(nonclaim), `S3B nonclaim preserved: ${nonclaim}`);
}

try {
  const changed = cp.execFileSync('git', ['diff', '--name-only', `${BASELINE}...HEAD`], { cwd: ROOT, encoding: 'utf8' })
    .trim().split(/\r?\n/).filter(Boolean);
  const allowedPatterns = [
    /^apps\/server\/src\/domain\/soil_water\/(bootstrap_water_prior_v1|root_zone_observation_operator_v1|scalar_gaussian_assimilation_v1|root_zone_water_posterior_v1)\.ts$/,
    /^apps\/server\/src\/domain\/twin_runtime\/(physical_bounds_v1|runtime_config_v1)\.ts$/,
    /^fixtures\/mcft\/water_state\/(expected|negative)\//,
    /^scripts\/runtime_acceptance\/ACCEPTANCE_MCFT_CAP_01_STATE_MATH\.ts$/,
    /^scripts\/governance_acceptance\/ACCEPTANCE_MCFT_CAP_01_S3B_CLOSURE\.cjs$/,
    /^docs\/digital_twin\/mcft\/cap_01\/(GEOX-MCFT-CAP-01-BOOTSTRAP-MATH\.md|GEOX-MCFT-CAP-01-S3B-STATUS\.json|GEOX-MCFT-CAP-01-DELIVERY-SLICE-STATUS\.json)$/,
  ];
  const forbidden = changed.filter((file) => !allowedPatterns.some((pattern) => pattern.test(file)));
  check(forbidden.length === 0, `S3B closure changed-file boundary: ${forbidden.join(',')}`);
  check(changed.every((file) => !file.startsWith('apps/server/src/runtime/') && !file.startsWith('apps/server/src/persistence/') && !file.startsWith('apps/server/src/routes/') && !file.startsWith('apps/web/') && !file.includes('/migrations/')), 'no S4 Runtime persistence route web or migration files');
} catch (error) {
  check(false, `git changed-file boundary: ${error.message}`);
}

console.log(`MCFT-CAP-01 S3B closure: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
