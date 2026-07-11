// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION.cjs
// Purpose: gate the exact MCFT-CAP-03 R1 additive V2 semantic-conformance implementation.
// Boundary: governance orchestration only; no persistence, migration, route, scheduler, web, workflow, canonical write, Runtime tick, successful Forecast, or completion claim.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '9d9d218fa030bf38278be7e8877c4b98463ebfe5';
const BRANCH = 'mcft-cap-03-s2-semantic-conformance-v2-v1';
const REMEDIATION_ID =
  'MCFT-CAP-03.S2-SEMANTIC-CONFORMANCE-REMEDIATION-V1';
const S2 =
  'MCFT-CAP-03.MCFT-05-07.OBSERVATION-SELECTION-AND-ASSIMILATION-MATH-V1';
const S6 =
  'MCFT-CAP-03.MCFT-03-04-07-08.RESTART-BACKFILL-RECOVERY-V1';
const S7 = 'MCFT-CAP-03.CLOSURE-V1';
const S8 = 'MCFT-CAP-03.CLOSURE-FINALIZATION-V1';
const MODE = process.argv.includes('--postmerge')
  ? 'postmerge'
  : process.argv.includes('--draft')
    ? 'draft'
    : 'final';

const DELIVERY_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const S2_STATUS_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-OBSERVATION-ASSIMILATION-STATUS.json';
const REMEDIATION_STATUS_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-S2-SEMANTIC-CONFORMANCE-REMEDIATION-STATUS.json';
const CONTRACT_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-S2-SEMANTIC-CONFORMANCE-REMEDIATION.md';
const CONTRACT_V2_PATH =
  'apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v2.ts';
const SELECTOR_V2_PATH =
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts';
const WINDOW_V2_PATH =
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.ts';

const EXACT_CHANGED_FILES = [
  CONTRACT_V2_PATH,
  SELECTOR_V2_PATH,
  WINDOW_V2_PATH,
  DELIVERY_PATH,
  S2_STATUS_PATH,
  REMEDIATION_STATUS_PATH,
  CONTRACT_PATH,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_03_s2_semantic_conformance_remediation_fixture_v1.ts',
].sort();

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

function sameArray(left, right) {
  return JSON.stringify([...left].sort())
    === JSON.stringify([...right].sort());
}

for (const relativePath of EXACT_CHANGED_FILES) {
  check(
    fs.existsSync(path.join(ROOT, relativePath)),
    `${MODE} file exists: ${relativePath}`,
  );
}

try {
  cp.execFileSync(
    process.platform === 'win32' ? 'git.exe' : 'git',
    ['merge-base', '--is-ancestor', BASELINE, 'HEAD'],
    { cwd: ROOT, stdio: 'ignore' },
  );
  check(true, `${MODE} target descends from exact R0 baseline`);
} catch {
  check(false, `${MODE} target descends from exact R0 baseline`);
}

try {
  const changed = git([
    'diff',
    '--name-only',
    `${BASELINE}...HEAD`,
  ])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((value) => value.replaceAll('\\', '/'))
    .sort();

  check(
    sameArray(changed, EXACT_CHANGED_FILES),
    `exact R1 changed-file set has ${EXACT_CHANGED_FILES.length} files`,
  );

  const forbidden = changed.filter((file) =>
    file.startsWith('apps/server/src/persistence/')
    || file.startsWith('apps/server/db/migrations/')
    || file.startsWith('apps/server/src/routes/')
    || file.startsWith('apps/web/')
    || file.startsWith('.github/workflows/')
    || file.includes('/cap_02/')
    || file.endsWith('assimilated_continuation_contracts_v1.ts')
    || file.endsWith('assimilated_continuation_observation_selector_v1.ts')
    || file.endsWith('assimilated_continuation_evidence_window_v1.ts')
  );

  check(
    forbidden.length === 0,
    `no forbidden or V1 source changed: ${forbidden.join(',')}`,
  );

  git(['diff', '--check', `${BASELINE}...HEAD`]);
  check(true, 'R1 git diff --check PASS');
} catch (error) {
  check(false, `R1 boundary check available: ${error.message}`);
}

const delivery = readJson(DELIVERY_PATH);
const s2Status = readJson(S2_STATUS_PATH);
const remediation = readJson(REMEDIATION_STATUS_PATH);
const remediationSlice = delivery.slices.find(
  (slice) => slice.delivery_slice_id === REMEDIATION_ID,
);
const s2 = delivery.slices.find(
  (slice) => slice.delivery_slice_id === S2,
);
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
  delivery.status
    === 'S2_SEMANTIC_CONFORMANCE_REMEDIATION_IMPLEMENTATION_READY_FOR_MERGE',
  'delivery R1 status ready for merge',
);
check(
  delivery.implementation_status === 'IMPLEMENTED_CANDIDATE',
  'delivery implementation candidate exact',
);
check(
  delivery.active_delivery_slice_id === REMEDIATION_ID,
  'remediation remains active',
);
check(
  remediationSlice?.status === 'R1_IMPLEMENTATION_READY_FOR_MERGE',
  'remediation slice ready for merge',
);
check(
  remediationSlice?.r1_effective === false,
  'R1 remains ineffective',
);
check(
  s2?.semantic_conformance === 'REMEDIATION_IMPLEMENTED_NOT_EFFECTIVE',
  'S2 remediation candidate recorded',
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
  delivery.ssot_conflict_cleanup_status
    === 'DEFERRED_TO_R2_AFTER_R1_EFFECTIVE',
  'SSOT cleanup remains deferred to R2',
);
check(
  delivery.pending_completion_claims?.includes('MCFT_CAP_03_COMPLETE'),
  'completion claim remains pending',
);
check(
  delivery.preserved_nonclaims?.includes(
    'NO_MCFT_CAP_03_COMPLETE_CLAIM',
  ),
  'no-complete nonclaim remains effective',
);

check(
  remediation.status === 'R1_IMPLEMENTATION_READY_FOR_MERGE',
  'remediation status ready for merge',
);
check(
  remediation.implementation_status === 'IMPLEMENTED_CANDIDATE',
  'remediation implementation candidate exact',
);
check(remediation.r1_authorized === true, 'R1 remains authorized');
check(remediation.r1_effective === false, 'R1 remains ineffective');
check(
  remediation.r1_implementation_baseline_main_commit === BASELINE,
  'R1 baseline exact',
);
check(
  remediation.r1_implementation_branch === BRANCH,
  'R1 branch exact',
);
check(
  sameArray(
    remediation.r1_frozen_implementation_changed_file_boundary,
    EXACT_CHANGED_FILES,
  ),
  'R1 frozen file boundary exact',
);
check(
  remediation.s6_effectiveness_status
    === 'PAUSED_PENDING_REMEDIATION',
  'remediation preserves S6 pause',
);
check(remediation.s7_status === 'BLOCKED', 'remediation preserves S7 block');
check(remediation.s8_status === 'BLOCKED', 'remediation preserves S8 block');
check(
  remediation.mcft_cap_04_authorized === false,
  'MCFT-CAP-04 remains unauthorized',
);

check(
  s2Status.semantic_conformance_status
    === 'REMEDIATION_IMPLEMENTED_NOT_EFFECTIVE',
  'S2 status records remediation candidate',
);
check(
  s2Status.v2_remediation?.contract_id
    === 'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2',
  'S2 status records V2 contract',
);
check(
  s2Status.v2_remediation?.evidence_window_contract_id
    === 'MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V2',
  'S2 status records V2 Evidence Window',
);
check(
  s2Status.v2_remediation?.selector_id
    === 'LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V2',
  'S2 status records V2 selector',
);
check(
  s2Status.v2_remediation?.historical_v1_readback === 'PRESERVED',
  'historical V1 readback preserved',
);
check(
  s2Status.v2_remediation?.effectiveness_condition_satisfied === false,
  'V2 remediation remains ineffective',
);

const document = readText(CONTRACT_PATH);
const contracts = readText(CONTRACT_V2_PATH);
const selector = readText(SELECTOR_V2_PATH);
const window = readText(WINDOW_V2_PATH);

for (const marker of [
  'ADDITIVE_VERSIONED_V2',
  'logical_time_ms - observed_at_ms <= 900000',
  'MALFORMED_CANONICAL_OBSERVATION:UNSUPPORTED_RECORD_TYPE',
  'R1 implementation candidate = NOT_EFFECTIVE_UNTIL_MERGED_MAIN_GATE',
  'S6 effectiveness = PAUSED',
  'S7 = BLOCKED',
  'MCFT-CAP-04 = UNAUTHORIZED',
]) {
  check(document.includes(marker), `contract marker: ${marker}`);
}

check(
  contracts.includes('MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2'),
  'V2 record-set contract implemented',
);
check(
  contracts.includes(
    'MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V2',
  ),
  'V2 Evidence Window contract implemented',
);
check(
  contracts.includes(
    'computeAssimilatedObservationSemanticContentHashV2',
  ),
  'committed hash recomputation implemented',
);
check(
  contracts.includes(
    'ASSIMILATION_V2_CANDIDATE_SEMANTIC_CONTENT_HASH_MISMATCH',
  ),
  'committed hash mismatch fails closed',
);
check(
  selector.includes(
    'ASSIMILATED_OBSERVATION_MAX_AGE_MILLISECONDS_V2',
  ),
  'millisecond staleness authority implemented',
);
check(!selector.includes('Math.trunc'), 'no second truncation in V2');
check(
  selector.includes(
    'MALFORMED_CANONICAL_OBSERVATION:UNSUPPORTED_RECORD_TYPE',
  ),
  'unsupported record type fails closed',
);
check(
  selector.indexOf('const contentHashes = new Set')
    < selector.lastIndexOf(
      'applyPhysicalAndQualityEligibilityV2(',
    ),
  'duplicate resolution precedes physical and quality eligibility',
);
check(
  selector.includes('structuredClone(canonicalPayload)'),
  'complete canonical payload committed',
);
check(
  window.includes('buildContinuationEvidenceWindowV1'),
  'CAP-02 Evidence Window remains reused',
);
check(
  window.includes('selectAssimilatedContinuationObservationV2'),
  'V2 Evidence Window uses V2 selector',
);

function runTsx(relativePath, pattern, message) {
  try {
    const output = run(
      pnpmCommand(),
      ['-w', 'exec', 'tsx', relativePath],
    );
    process.stdout.write(output);
    check(pattern.test(output), message);
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    check(false, message);
  }
}

runTsx(
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION.ts',
  /MCFT-CAP-03 S2 semantic-conformance remediation: \d+ PASS, 0 FAIL/,
  'R1 positive acceptance PASS',
);
runTsx(
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_S2_SEMANTIC_CONFORMANCE_REMEDIATION_NEGATIVE.ts',
  /MCFT-CAP-03 S2 semantic-conformance remediation negative: \d+ PASS, 0 FAIL/,
  'R1 negative acceptance PASS',
);
runTsx(
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_OBSERVATION_ASSIMILATION.ts',
  /MCFT-CAP-03 observation-assimilation: \d+ PASS, 0 FAIL/,
  'historical V1 positive acceptance PASS',
);
runTsx(
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_OBSERVATION_ASSIMILATION_NEGATIVE.ts',
  /MCFT-CAP-03 observation-assimilation negative: \d+ PASS, 0 FAIL/,
  'historical V1 negative acceptance PASS',
);

if (MODE === 'final') {
  for (const [label, args] of [
    ['server typecheck', ['--filter', '@geox/server', 'typecheck']],
    ['server build', ['--filter', '@geox/server', 'build']],
  ]) {
    try {
      process.stdout.write(run(pnpmCommand(), args));
      check(true, `${label} PASS`);
    } catch (error) {
      process.stderr.write(error.stderr || error.message);
      check(false, `${label} PASS`);
    }
  }
}

try {
  const currentBranch = git(['branch', '--show-current']);
  if (MODE === 'postmerge') {
    check(currentBranch === 'main', 'postmerge Gate runs on main');
    check(
      git(['rev-parse', 'HEAD'])
        === git(['rev-parse', 'refs/remotes/origin/main']),
      'postmerge local main equals origin/main',
    );
  } else {
    check(currentBranch === BRANCH, `${MODE} Gate runs on R1 branch`);
  }
} catch (error) {
  check(false, `Git context readable: ${error.message}`);
}

console.log(
  `MCFT-CAP-03 S2 semantic-conformance remediation ${MODE}: ${pass} PASS, ${fail} FAIL`,
);
if (fail > 0) {
  process.exit(1);
}