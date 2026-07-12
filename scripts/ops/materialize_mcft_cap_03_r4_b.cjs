'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

function filePath(relativePath) {
  return path.join(root, relativePath);
}

function replaceOnce(relativePath, before, after) {
  const target = filePath(relativePath);
  const current = fs.readFileSync(target, 'utf8');
  const first = current.indexOf(before);
  if (first < 0) throw new Error(`R4_B_SOURCE_NOT_FOUND:${relativePath}`);
  if (current.indexOf(before, first + before.length) >= 0) {
    throw new Error(`R4_B_SOURCE_NOT_UNIQUE:${relativePath}`);
  }
  fs.writeFileSync(
    target,
    current.slice(0, first) + after + current.slice(first + before.length),
    'utf8',
  );
}

const tickPath =
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v2.ts';
const rangePath =
  'apps/server/src/runtime/twin_runtime/assimilated_contiguous_range_service_v2.ts';
const fixturePath =
  'scripts/runtime_acceptance/mcft_cap_03_r2_v2_revalidation_fixture_v1.ts';

replaceOnce(
  tickPath,
  `  assimilated_runtime_config_ref: string;\n  crop_stage_context: ContinuationCropStageConfigurationContextV1;`,
  `  assimilated_runtime_config_ref: string;\n  assimilated_runtime_config_hash: string;\n  crop_stage_context: ContinuationCropStageConfigurationContextV1;`,
);

replaceOnce(
  tickPath,
  `    requiredCanonicalIsoV1(input.created_at, "ASSIMILATED_SINGLE_TICK_CREATED_AT_INVALID");\n    if (!input.lease_owner.trim()) throw new Error("ASSIMILATED_SINGLE_TICK_LEASE_OWNER_REQUIRED");`,
  `    requiredCanonicalIsoV1(input.created_at, "ASSIMILATED_SINGLE_TICK_CREATED_AT_INVALID");\n    const requestedRuntimeConfigRef = requiredStringV1(\n      input.assimilated_runtime_config_ref,\n      "ASSIMILATED_RUNTIME_CONFIG_REF_PIN_REQUIRED",\n    );\n    const requestedRuntimeConfigHash = requiredStringV1(\n      input.assimilated_runtime_config_hash,\n      "ASSIMILATED_RUNTIME_CONFIG_HASH_PIN_REQUIRED",\n    );\n    if (!input.lease_owner.trim()) throw new Error("ASSIMILATED_SINGLE_TICK_LEASE_OWNER_REQUIRED");`,
);

replaceOnce(
  tickPath,
  `    if (previouslyCommitted) {\n      validateAssimilatedContinuationCrossReferencesV2(previouslyCommitted);`,
  `    if (previouslyCommitted) {\n      if (\n        previouslyCommitted.aggregate_identity_input.runtime_config_ref\n        !== requestedRuntimeConfigRef\n      ) {\n        throw new Error("ASSIMILATED_RUNTIME_CONFIG_REF_PIN_MISMATCH");\n      }\n      if (\n        previouslyCommitted.aggregate_identity_input.runtime_config_hash\n        !== requestedRuntimeConfigHash\n      ) {\n        throw new Error("ASSIMILATED_RUNTIME_CONFIG_HASH_PIN_MISMATCH");\n      }\n      validateAssimilatedContinuationCrossReferencesV2(previouslyCommitted);`,
);

replaceOnce(
  tickPath,
  `    const runtimeConfig = await this.runtimeConfigRepository.readRuntimeConfig(\n      input.assimilated_runtime_config_ref,\n    );\n    if (!runtimeConfig) throw new Error("ASSIMILATED_RUNTIME_CONFIG_NOT_FOUND");`,
  `    const runtimeConfig = await this.runtimeConfigRepository.readRuntimeConfig(\n      requestedRuntimeConfigRef,\n    );\n    if (!runtimeConfig) throw new Error("ASSIMILATED_RUNTIME_CONFIG_NOT_FOUND");\n    if (runtimeConfig.object_id !== requestedRuntimeConfigRef) {\n      throw new Error("ASSIMILATED_RUNTIME_CONFIG_REF_PIN_MISMATCH");\n    }\n    if (runtimeConfig.determinism_hash !== requestedRuntimeConfigHash) {\n      throw new Error("ASSIMILATED_RUNTIME_CONFIG_HASH_PIN_MISMATCH");\n    }`,
);

replaceOnce(
  rangePath,
  `  assimilated_runtime_config_refs_by_logical_time:\n    Readonly<Record<string, string>>;\n  crop_stage_context:`,
  `  assimilated_runtime_config_refs_by_logical_time:\n    Readonly<Record<string, string>>;\n  assimilated_runtime_config_hashes_by_logical_time:\n    Readonly<Record<string, string>>;\n  crop_stage_context:`,
);

replaceOnce(
  rangePath,
  `    const runtimeConfigRefs: string[] = [];`,
  `    const runtimeConfigRefs: string[] = [];\n    const runtimeConfigHashes: string[] = [];`,
);

replaceOnce(
  rangePath,
  `      const runtimeConfigRef =\n        input\n          .assimilated_runtime_config_refs_by_logical_time[\n            logicalTime\n          ];`,
  `      const runtimeConfigRef =\n        input\n          .assimilated_runtime_config_refs_by_logical_time[\n            logicalTime\n          ];\n      const runtimeConfigHash =\n        input\n          .assimilated_runtime_config_hashes_by_logical_time[\n            logicalTime\n          ];`,
);

replaceOnce(
  rangePath,
  `      runtimeConfigRefs.push(runtimeConfigRef);`,
  `      if (\n        typeof runtimeConfigHash !== "string"\n        || !runtimeConfigHash.trim()\n      ) {\n        throw new Error(\n          \`ASSIMILATED_RANGE_RUNTIME_CONFIG_HASH_REQUIRED:\${logicalTime}\`,\n        );\n      }\n\n      runtimeConfigRefs.push(runtimeConfigRef);\n      runtimeConfigHashes.push(runtimeConfigHash);`,
);

replaceOnce(
  rangePath,
  `          assimilated_runtime_config_ref:\n            runtimeConfigRefs[index],\n          crop_stage_context:`,
  `          assimilated_runtime_config_ref:\n            runtimeConfigRefs[index],\n          assimilated_runtime_config_hash:\n            runtimeConfigHashes[index],\n          crop_stage_context:`,
);

replaceOnce(
  fixturePath,
  `  const runtimeConfigRefsByLogicalTime =\n    Object.fromEntries(\n      runtimeConfigChain.map((config) => [\n        config.logical_time,\n        config.object_id,\n      ]),\n    );`,
  `  const runtimeConfigRefsByLogicalTime =\n    Object.fromEntries(\n      runtimeConfigChain.map((config) => [\n        config.logical_time,\n        config.object_id,\n      ]),\n    );\n  const runtimeConfigHashesByLogicalTime =\n    Object.fromEntries(\n      runtimeConfigChain.map((config) => [\n        config.logical_time,\n        config.determinism_hash,\n      ]),\n    );`,
);

replaceOnce(
  fixturePath,
  `    assimilated_runtime_config_ref:\n      runtimeConfigRefsByLogicalTime[logicalTime],\n    crop_stage_context:`,
  `    assimilated_runtime_config_ref:\n      runtimeConfigRefsByLogicalTime[logicalTime],\n    assimilated_runtime_config_hash:\n      runtimeConfigHashesByLogicalTime[logicalTime],\n    crop_stage_context:`,
);

replaceOnce(
  fixturePath,
  `    assimilated_runtime_config_refs_by_logical_time:\n      runtimeConfigRefsByLogicalTime,\n    crop_stage_context:`,
  `    assimilated_runtime_config_refs_by_logical_time:\n      runtimeConfigRefsByLogicalTime,\n    assimilated_runtime_config_hashes_by_logical_time:\n      runtimeConfigHashesByLogicalTime,\n    crop_stage_context:`,
);

replaceOnce(
  fixturePath,
  `    runtimeConfigRefsByLogicalTime,\n    runtime,`,
  `    runtimeConfigRefsByLogicalTime,\n    runtimeConfigHashesByLogicalTime,\n    runtime,`,
);

const acceptance = `// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R4_B_RUNTIME_CONFIG_PIN.ts
// Purpose: prove every CAP-03 V2 single tick, range, restart, and idempotent replay request explicitly pins and validates Runtime Config ref plus determinism hash.
// Boundary: deterministic in-memory Replay acceptance only; no production database, route, scheduler, successful Forecast, Scenario, Recommendation, Decision, action, calibration, or model activation.

import assert from "node:assert/strict";
import {
  buildMcftCap03R2V2FixtureV1,
} from "./mcft_cap_03_r2_v2_revalidation_fixture_v1.js";

let pass = 0;

function ok(message: string): void {
  pass += 1;
  console.log(\`PASS \${message}\`);
}

async function expectCode(
  action: () => Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.equal(error instanceof Error ? error.message : String(error), code);
    return true;
  });
}

async function main(): Promise<void> {
  const positive = await buildMcftCap03R2V2FixtureV1(1);
  const inserted = await positive.tickService.executeOneTick(
    positive.tickInput(),
  );
  assert.equal(inserted.status, "INSERTED");
  assert.equal(
    inserted.record_set.aggregate_identity_input.runtime_config_ref,
    positive.firstV2Config.object_id,
  );
  assert.equal(
    inserted.record_set.aggregate_identity_input.runtime_config_hash,
    positive.firstV2Config.determinism_hash,
  );
  ok("single tick accepts an exact Runtime Config ref/hash pin");

  const newTickMismatch = await buildMcftCap03R2V2FixtureV1(1);
  await expectCode(
    () => newTickMismatch.tickService.executeOneTick({
      ...newTickMismatch.tickInput(),
      assimilated_runtime_config_hash: "sha256:wrong-new-tick-pin",
    }),
    "ASSIMILATED_RUNTIME_CONFIG_HASH_PIN_MISMATCH",
  );
  assert.equal(newTickMismatch.runtime.commitCount, 0);
  assert.equal(newTickMismatch.runtime.leaseAcquireCount, 0);
  ok("wrong hash on a new tick fails before lease and persistence");

  const replayMismatch = await buildMcftCap03R2V2FixtureV1(1);
  const first = await replayMismatch.tickService.executeOneTick(
    replayMismatch.tickInput(),
  );
  assert.equal(first.status, "INSERTED");
  await expectCode(
    () => replayMismatch.tickService.executeOneTick({
      ...replayMismatch.tickInput(),
      assimilated_runtime_config_hash: "sha256:wrong-replay-pin",
    }),
    "ASSIMILATED_RUNTIME_CONFIG_HASH_PIN_MISMATCH",
  );
  assert.equal(replayMismatch.runtime.commitCount, 1);
  ok("idempotent replay validates the requested hash before returning existing success");

  const missingRangeHash = await buildMcftCap03R2V2FixtureV1(2);
  const missingHashInput = missingRangeHash.rangeInput(
    missingRangeHash.lastLogicalTime,
  );
  const missingLogicalTime = missingRangeHash.lastLogicalTime;
  const reducedHashes = {
    ...missingHashInput.assimilated_runtime_config_hashes_by_logical_time,
  };
  delete reducedHashes[missingLogicalTime];
  await expectCode(
    () => missingRangeHash.rangeService.runAssimilatedContiguousRangeV2({
      ...missingHashInput,
      assimilated_runtime_config_hashes_by_logical_time: reducedHashes,
    }),
    \`ASSIMILATED_RANGE_RUNTIME_CONFIG_HASH_REQUIRED:\${missingLogicalTime}\`,
  );
  assert.equal(missingRangeHash.runtime.commitCount, 0);
  ok("range preflight rejects a missing per-tick Runtime Config hash");

  const wrongRangeHash = await buildMcftCap03R2V2FixtureV1(2);
  const wrongHashInput = wrongRangeHash.rangeInput(
    wrongRangeHash.lastLogicalTime,
  );
  await expectCode(
    () => wrongRangeHash.rangeService.runAssimilatedContiguousRangeV2({
      ...wrongHashInput,
      assimilated_runtime_config_hashes_by_logical_time: {
        ...wrongHashInput.assimilated_runtime_config_hashes_by_logical_time,
        [wrongRangeHash.firstLogicalTime]: "sha256:wrong-range-pin",
      },
    }),
    "ASSIMILATED_RUNTIME_CONFIG_HASH_PIN_MISMATCH",
  );
  assert.equal(wrongRangeHash.runtime.commitCount, 0);
  ok("range execution rejects a nonmatching per-tick Runtime Config hash");

  console.log(\`MCFT-CAP-03 R4-B Runtime Config pin: \${pass} PASS, 0 FAIL\`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`;

fs.writeFileSync(
  filePath(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R4_B_RUNTIME_CONFIG_PIN.ts',
  ),
  acceptance,
  'utf8',
);

const status = {
  schema_version: 'geox_mcft_cap_03_r4_b_runtime_config_pin_status_v1',
  capability_line_id: 'MCFT-CAP-03',
  remediation_issue_number: 2368,
  remediation_step_id: 'R4-B',
  delivery_slice_id: 'MCFT-CAP-03.R4-B.RUNTIME-CONFIG-REF-HASH-PIN-V1',
  runtime_mode: 'REPLAY',
  target_completion_level: 'Level A',
  baseline_main_commit: '5d19ea4d70bd1143b77c102847278853e4f75b36',
  predecessor_r4_a_status: 'MERGED_EFFECTIVE',
  branch: 'mcft-cap-03-r4-b-runtime-config-pin-v1',
  status: 'CANDIDATE_VALIDATED_NOT_EFFECTIVE',
  implementation_scope: {
    single_tick_ref_hash_pin: 'IMPLEMENTED',
    idempotent_replay_ref_hash_pin: 'IMPLEMENTED',
    range_per_tick_ref_hash_pin: 'IMPLEMENTED',
    restart_backfill_inherits_range_pin: 'IMPLEMENTED',
  },
  candidate_validation: {
    server_typecheck: 'REQUIRED',
    server_build: 'REQUIRED',
    historical_r2_positive_acceptance: 'REQUIRED',
    historical_r2_negative_acceptance: 'REQUIRED',
    historical_r4_a_acceptance: 'REQUIRED',
    r4_b_runtime_config_pin_acceptance: 'REQUIRED',
  },
  exact_changed_file_boundary: [
    tickPath,
    rangePath,
    fixturePath,
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R4_B_RUNTIME_CONFIG_PIN.ts',
    'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-B-RUNTIME-CONFIG-PIN-STATUS.json',
  ],
  effectiveness_condition:
    'R4_B_PR_MERGED_TO_MAIN_AND_EXACT_HEAD_CI_PASS_AND_MERGE_TREE_EQUIVALENCE_PASS',
  effectiveness_condition_satisfied: false,
  successor_step_id: 'R4-C',
  successor_authorized: false,
  preserved_nonclaims: [
    'NO_SUCCESSFUL_FORECAST',
    'NO_FORECAST_RESIDUAL',
    'NO_SCENARIO',
    'NO_RECOMMENDATION',
    'NO_DECISION',
    'NO_AO_ACT',
    'NO_CALIBRATION_CANDIDATE',
    'NO_SHADOW_EVALUATION',
    'NO_MODEL_ACTIVATION',
    'NO_LATE_EVIDENCE_REVISION',
    'NO_CONTINUOUS_RUNTIME',
    'NO_LIVE_FIELD_CLAIM',
    'NO_MCFT_CAP_04_AUTHORIZATION',
  ],
};

fs.writeFileSync(
  filePath(
    'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-B-RUNTIME-CONFIG-PIN-STATUS.json',
  ),
  `${JSON.stringify(status, null, 2)}\n`,
  'utf8',
);

console.log('MCFT-CAP-03 R4-B materialization complete');
