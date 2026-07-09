// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_01_TASK_V2_1.cjs
// Purpose: validate that the MCFT-CAP-01 v2.1 task charter is aligned with merged S1/S2/S3A facts and authorizes only S3B next.
// Boundary: governance-only acceptance; no Runtime execution, database access, fixture mutation, or semantic implementation.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const TASK = path.join(ROOT, 'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-TASK.md');
const IMPLEMENTATION_BASELINE = 'b0b364933956a65345b927c6c5618e9d4ebe22af';
const ACTIVE_SLICE = 'MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1';

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

const text = fs.readFileSync(TASK, 'utf8');

check(text.includes('实施任务书 v2.1'), 'task charter version is v2.1');
check(text.includes(`implementation_baseline_commit:\n${IMPLEMENTATION_BASELINE}`), 'implementation baseline is merged PR #2310 main');
check(text.includes('status:\nIN_IMPLEMENTATION'), 'capability remains IN_IMPLEMENTATION');
check(text.includes(`active_delivery_slice:\n${ACTIVE_SLICE}`), 'active delivery slice is S3B');
check(text.includes('S1  MCFT-CAP-01.MCFT-01.CANONICAL-REPLAY-DATASET-V1') && text.includes('S3A MCFT-CAP-01.MCFT-03.A0-PERSISTENCE-V1'), 'completed foundation slices are recorded');
check(text.includes('S3B MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1') && text.includes('READY_FOR_IMPLEMENTATION'), 'S3B is ready for implementation');
check(text.includes('S4  MCFT-CAP-01.MCFT-04-05-08-09.A0-RUNTIME-INTEGRATION-V1') && text.includes('NOT_YET_AUTHORIZED'), 'S4 remains unauthorized');
check(text.includes('common envelope') && text.includes('role-specific source_payload'), 'S1 record structure matches merged role-specific payload contract');
check(text.includes('Future snapshot、approved plan 与 execution Evidence 必须保留结构化 payload'), 'structured Replay payload rule is preserved');
check(text.includes('physical_bound_version:\nROOT_ZONE_WATER_PHYSICAL_BOUNDS_V1'), 'physical bound version is frozen');
check(text.includes('gaussian_interval_rule:\nNORMAL_95_Z_1_96_V1'), 'Gaussian interval rule is frozen');
check(text.includes('uncertainty_interval_clip_rule:\nCLIP_TO_ZERO_AND_SATURATION_WITH_UNCLIPPED_METADATA_V1'), 'interval clipping rule is frozen');
check(text.includes('interval_clip_bounds:\n[0, saturation_fraction]'), 'interval clipping bounds are frozen');
check(text.includes('apps/server/src/domain/twin_runtime/runtime_config_v1.ts'), 'S3B narrowly authorizes Runtime Config type extension');
check(text.includes('apps/server/src/runtime/twin_runtime/runtime_config_compile_service_v1.ts'), 'S3B narrowly authorizes Runtime Config compiler extension');
check(text.includes('禁止借此修改：') && text.includes('canonical identity rules'), 'S3B Runtime Config extension boundary is explicit');
check(text.includes('S3B 当前单独实施') && text.includes('不得同时进入 S4 Runtime Integration'), 'S3B cannot be mixed with S4');
check(text.includes('NO_BOOTSTRAP_STATE_COMMITTED') && text.includes('NO_MCFT_CAP_01_CLOSURE'), 'critical nonclaims are preserved');

try {
  const changed = cp.execFileSync('git', ['diff', '--name-only', `${IMPLEMENTATION_BASELINE}...HEAD`], { cwd: ROOT, encoding: 'utf8' })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  const allowed = new Set([
    'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-TASK.md',
    'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_01_TASK_V2_1.cjs',
  ]);
  const forbidden = changed.filter((file) => !allowed.has(file));
  check(forbidden.length === 0, `governance-only changed-file boundary: ${forbidden.join(',')}`);
} catch (error) {
  check(false, `git changed-file boundary: ${error.message}`);
}

console.log(`MCFT-CAP-01 task v2.1: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
