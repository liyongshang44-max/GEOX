// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_EXECUTION_CONFIG_RESOLUTION.ts
// Purpose: prove canonical CAP-04 and CAP-05 Runtime Config envelopes remain internally consistent and immutable while reused CAP-04 mathematics consumes only a separate deterministic non-canonical execution payload view.
// Boundary: pure in-memory contract acceptance only; no database, filesystem write, canonical persistence, projection write, active binding, Model Activation, calibration, route, scheduler, CAP-06 Runtime authority, or predecessor-eligibility restoration claim.

import assert from "node:assert/strict";
import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { computeMemberDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  CAP04_CONFIG_SELECTION_MODE_V1,
  CAP04_RUNTIME_CONFIG_PURPOSE_V1,
  compileCap04RuntimeConfigV1,
  validateCap04RuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import {
  CAP05_CONFIG_SELECTION_MODE_V1,
  CAP05_RUNTIME_CONFIG_PURPOSE_V1,
} from "../../apps/server/src/domain/twin_runtime/feedback_runtime_config_v1.js";
import {
  CAP05_INHERITED_CAP04_EXECUTION_VIEW_RESOLUTION_POLICY_ID_V1,
  DIRECT_CAP04_RUNTIME_CONFIG_RESOLUTION_POLICY_ID_V1,
  DirectCap04ExecutionConfigResolverV1,
} from "../../apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.js";
import { Cap05InheritedCap04ExecutionConfigResolverV1 } from "../../apps/server/src/runtime/twin_runtime/cap05_inherited_cap04_execution_config_resolver_v1.js";
import {
  CAP05_EFFECTIVE_RUNTIME_CONFIG_PROFILE_ID_V1,
  compileCap05EffectiveRuntimeConfigV1,
} from "../../apps/server/src/runtime/twin_runtime/effective_feedback_runtime_config_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const scope: TwinScopeKeyV1 = {
  tenant_id: "tenant_cap05_execution_resolution",
  project_id: "project_cap05_execution_resolution",
  group_id: "group_cap05_execution_resolution",
  field_id: "field_cap05_execution_resolution",
  season_id: "season_cap05_execution_resolution",
  zone_id: "zone_cap05_execution_resolution",
};

function cap04ConfigV1(): CanonicalObjectEnvelopeV1 {
  return compileCap04RuntimeConfigV1({
    scope,
    effective_logical_time: "2026-06-04T01:00:00.000Z",
    created_at: "2026-06-04T01:00:00.000Z",
    parent_runtime_config_ref: "runtime_config_cap03_parent",
    parent_runtime_config_hash: "sha256:runtime-config-cap03-parent",
    reality_binding_ref: "reality_binding_cap05_execution_resolution",
    reality_binding_hash: "sha256:reality-binding-cap05-execution-resolution",
    source_matrix_hash: "sha256:source-matrix-cap05-execution-resolution",
    configuration_matrix_hash: "sha256:configuration-matrix-cap05-execution-resolution",
    geometry_semantic_hash: "sha256:geometry-cap05-execution-resolution",
  });
}

function cap05ConfigV1(parent: CanonicalObjectEnvelopeV1): CanonicalObjectEnvelopeV1 {
  return compileCap05EffectiveRuntimeConfigV1({
    scope,
    effective_logical_time: "2026-06-04T02:00:00.000Z",
    created_at: "2026-06-04T02:00:00.000Z",
    parent_runtime_config_ref: parent.object_id,
    parent_runtime_config_hash: parent.determinism_hash,
    reality_binding_ref: "reality_binding_cap05_execution_resolution",
    reality_binding_hash: "sha256:reality-binding-cap05-execution-resolution",
    source_matrix_hash: "sha256:source-matrix-cap05-execution-resolution",
    configuration_matrix_hash: "sha256:configuration-matrix-cap05-execution-resolution",
    geometry_semantic_hash: "sha256:geometry-cap05-execution-resolution",
  });
}

function recomputeHashV1(config: CanonicalObjectEnvelopeV1): CanonicalObjectEnvelopeV1 {
  const candidate = structuredClone(config);
  candidate.determinism_hash = computeMemberDeterminismHashV1(
    candidate as unknown as Record<string, unknown>,
  );
  return candidate;
}

function assertNonCanonicalViewV1(value: unknown): void {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  const record = value as Record<string, unknown>;
  assert.equal("object_id" in record, false, "EXECUTION_VIEW_OBJECT_ID_FORBIDDEN");
  assert.equal("determinism_hash" in record, false, "EXECUTION_VIEW_DETERMINISM_HASH_FORBIDDEN");
  assert.equal("object_type" in record, false, "EXECUTION_VIEW_OBJECT_TYPE_FORBIDDEN");
  assert.equal("idempotency_key" in record, false, "EXECUTION_VIEW_IDEMPOTENCY_KEY_FORBIDDEN");
}

function main(): void {
  let pass = 0;
  const ok = (label: string): void => {
    pass += 1;
    process.stdout.write(`PASS ${label}\n`);
  };

  const cap04 = cap04ConfigV1();
  const cap05 = cap05ConfigV1(cap04);
  const cap04Snapshot = structuredClone(cap04);
  const cap05Snapshot = structuredClone(cap05);

  validateCanonicalObjectV1(cap04);
  validateCanonicalObjectV1(cap05);
  ok("canonical CAP-04 and CAP-05 Config determinism hashes recompute and validate");

  const directResolver = new DirectCap04ExecutionConfigResolverV1();
  const direct = directResolver.resolveExecutionConfig(cap04);
  assertNonCanonicalViewV1(direct);
  assert.equal(direct.source_config_ref, cap04.object_id);
  assert.equal(direct.source_config_hash, cap04.determinism_hash);
  assert.equal(direct.source_config_purpose, CAP04_RUNTIME_CONFIG_PURPOSE_V1);
  assert.equal(direct.resolution_policy_id, DIRECT_CAP04_RUNTIME_CONFIG_RESOLUTION_POLICY_ID_V1);
  assert.equal(direct.payload.config_purpose, CAP04_RUNTIME_CONFIG_PURPOSE_V1);
  assert.equal(direct.payload.config_selection_mode, CAP04_CONFIG_SELECTION_MODE_V1);
  validateCap04RuntimeConfigPayloadV1(direct.payload);
  ok("direct CAP-04 Runtime path remains unchanged and returns a non-canonical execution view");

  const inheritedResolver = new Cap05InheritedCap04ExecutionConfigResolverV1();
  const inheritedFirst = inheritedResolver.resolveExecutionConfig(cap05);
  const inheritedSecond = inheritedResolver.resolveExecutionConfig(cap05);
  assert.deepEqual(inheritedSecond, inheritedFirst);
  assertNonCanonicalViewV1(inheritedFirst);
  assert.equal(inheritedFirst.source_config_ref, cap05.object_id);
  assert.equal(inheritedFirst.source_config_hash, cap05.determinism_hash);
  assert.equal(inheritedFirst.source_config_purpose, CAP05_RUNTIME_CONFIG_PURPOSE_V1);
  assert.equal(
    inheritedFirst.resolution_policy_id,
    CAP05_INHERITED_CAP04_EXECUTION_VIEW_RESOLUTION_POLICY_ID_V1,
  );
  assert.equal(inheritedFirst.payload.config_purpose, CAP04_RUNTIME_CONFIG_PURPOSE_V1);
  assert.equal(inheritedFirst.payload.config_selection_mode, CAP04_CONFIG_SELECTION_MODE_V1);
  validateCap04RuntimeConfigPayloadV1(inheritedFirst.payload);
  ok("CAP-05 inherited execution-view derivation is deterministic and non-canonical");

  assert.deepEqual(cap04, cap04Snapshot);
  assert.deepEqual(cap05, cap05Snapshot);
  assert.equal(cap05.payload.config_purpose, CAP05_RUNTIME_CONFIG_PURPOSE_V1);
  assert.equal(cap05.payload.config_selection_mode, CAP05_CONFIG_SELECTION_MODE_V1);
  assert.equal(cap05.payload.executable_profile_id, CAP05_EFFECTIVE_RUNTIME_CONFIG_PROFILE_ID_V1);
  ok("canonical Config envelopes and CAP-05 payload remain untouched after resolution");

  const serializedView = JSON.stringify(inheritedFirst);
  assert.equal(serializedView.includes(cap05.object_id), true);
  assert.equal(serializedView.includes(cap05.determinism_hash), true);
  assert.equal("object_id" in inheritedFirst.payload, false);
  assert.equal("determinism_hash" in inheritedFirst.payload, false);
  ok("execution view carries source pins only and never receives canonical identity fields");

  const tamperedWithOldHash = structuredClone(cap05);
  tamperedWithOldHash.payload.configuration_matrix_hash = "sha256:tampered-configuration-matrix";
  assert.throws(
    () => inheritedResolver.resolveExecutionConfig(tamperedWithOldHash),
    /SEMANTIC_HASH_MISMATCH/,
  );
  ok("tampered inherited CAP-04 field with stale canonical hash is rejected");

  const wrongPurpose = structuredClone(cap05);
  wrongPurpose.payload.config_purpose = "FORECAST_AND_THREE_SCENARIO_CONTINUATION_RUNTIME_V1";
  assert.throws(
    () => inheritedResolver.resolveExecutionConfig(recomputeHashV1(wrongPurpose)),
    /CAP05_CONFIG_PURPOSE_MISMATCH|CAP05_EXECUTION_CONFIG_PURPOSE_MISMATCH/,
  );
  ok("wrong CAP-05 purpose is rejected after canonical hash recomputation");

  const missingInheritedField = structuredClone(cap05);
  delete missingInheritedField.payload.soil_hydraulic_snapshot;
  assert.throws(
    () => inheritedResolver.resolveExecutionConfig(recomputeHashV1(missingInheritedField)),
    /ASSIMILATED_HYDRAULIC_SNAPSHOT_REQUIRED|CAP04_|CAP05_/,
  );
  ok("missing inherited CAP-04 field is rejected after canonical hash recomputation");

  const wrongProfile = structuredClone(cap05);
  wrongProfile.payload.executable_profile_id = "WRONG_EFFECTIVE_PROFILE_V1";
  assert.throws(
    () => inheritedResolver.resolveExecutionConfig(recomputeHashV1(wrongProfile)),
    /CAP05_EFFECTIVE_CONFIG_PROFILE_MISMATCH|CAP05_EXECUTION_CONFIG_PROFILE_MISMATCH/,
  );
  ok("wrong executable profile is rejected after canonical hash recomputation");

  assert.throws(
    () => inheritedResolver.resolveExecutionConfig(cap04),
    /CAP05_CONFIG_PURPOSE_MISMATCH|CAP05_EXECUTION_CONFIG_PURPOSE_MISMATCH/,
  );
  ok("CAP-05 resolver fails closed for a direct CAP-04 canonical Config");

  assert.equal(pass, 10);
  process.stdout.write(`SUMMARY ${pass} PASS / 0 FAIL\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}
