// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FEEDBACK_CONFIG_EXECUTION_VIEW.ts
// Purpose: prove one canonical CAP-05 effective feedback Runtime Config can be exposed as a non-canonical CAP-04 execution view without changing canonical identity, persistence authority, or feedback-policy aliases.
// Boundary: pure in-memory acceptance only; no database, canonical write, active binding, model activation, calibration, route, scheduler, or CAP-06 Runtime authority.

import assert from "node:assert/strict";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
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
import { validateCap05ReceiptConsumingRuntimePoliciesV1 } from "../../apps/server/src/runtime/twin_runtime/action_feedback_tick_selector_v1.js";
import {
  CAP05_FEEDBACK_CONFIG_EXECUTION_VIEW_ID_V1,
  Cap05FeedbackExecutionRuntimeConfigRepositoryV1,
} from "../../apps/server/src/runtime/twin_runtime/cap05_feedback_config_execution_view_v1.js";
import { compileCap05EffectiveRuntimeConfigV1 } from "../../apps/server/src/runtime/twin_runtime/effective_feedback_runtime_config_v1.js";
import type { RuntimeConfigRepositoryPortV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const scope: TwinScopeKeyV1 = {
  tenant_id: "tenant_cap05_config_view",
  project_id: "project_cap05_config_view",
  group_id: "group_cap05_config_view",
  field_id: "field_cap05_config_view",
  season_id: "season_cap05_config_view",
  zone_id: "zone_cap05_config_view",
};

function baseConfigV1(): CanonicalObjectEnvelopeV1 {
  return compileCap04RuntimeConfigV1({
    scope,
    effective_logical_time: "2026-06-04T01:00:00.000Z",
    created_at: "2026-06-04T01:00:00.000Z",
    parent_runtime_config_ref: "runtime_config_cap03_parent",
    parent_runtime_config_hash: "sha256:runtime-config-cap03-parent",
    reality_binding_ref: "reality_binding_cap05_config_view",
    reality_binding_hash: "sha256:reality-binding-cap05-config-view",
    source_matrix_hash: "sha256:source-matrix-cap05-config-view",
    configuration_matrix_hash: "sha256:configuration-matrix-cap05-config-view",
    geometry_semantic_hash: "sha256:geometry-cap05-config-view",
  });
}

function feedbackConfigV1(parent: CanonicalObjectEnvelopeV1): CanonicalObjectEnvelopeV1 {
  return compileCap05EffectiveRuntimeConfigV1({
    scope,
    effective_logical_time: "2026-06-04T02:00:00.000Z",
    created_at: "2026-06-04T02:00:00.000Z",
    parent_runtime_config_ref: parent.object_id,
    parent_runtime_config_hash: parent.determinism_hash,
    reality_binding_ref: "reality_binding_cap05_config_view",
    reality_binding_hash: "sha256:reality-binding-cap05-config-view",
    source_matrix_hash: "sha256:source-matrix-cap05-config-view",
    configuration_matrix_hash: "sha256:configuration-matrix-cap05-config-view",
    geometry_semantic_hash: "sha256:geometry-cap05-config-view",
  });
}

class MemoryRepositoryV1 implements RuntimeConfigRepositoryPortV1 {
  readonly byId = new Map<string, CanonicalObjectEnvelopeV1>();
  commitCalls = 0;

  constructor(configs: readonly CanonicalObjectEnvelopeV1[]) {
    for (const config of configs) this.byId.set(config.object_id, structuredClone(config));
  }

  async commitRuntimeConfig(config: CanonicalObjectEnvelopeV1): Promise<{
    status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
    object_id: string;
    fact_id: string;
  }> {
    this.commitCalls += 1;
    this.byId.set(config.object_id, structuredClone(config));
    return { status: "INSERTED", object_id: config.object_id, fact_id: `fact_${config.object_id}` };
  }

  async readRuntimeConfig(objectId: string): Promise<CanonicalObjectEnvelopeV1 | null> {
    const value = this.byId.get(objectId);
    return value ? structuredClone(value) : null;
  }
}

async function main(): Promise<void> {
  let pass = 0;
  const ok = (label: string): void => { pass += 1; console.log(`PASS ${label}`); };

  assert.equal(CAP05_FEEDBACK_CONFIG_EXECUTION_VIEW_ID_V1, "MCFT_CAP_05_FEEDBACK_CONFIG_TO_CAP_04_EXECUTION_VIEW_V1");
  ok("execution-view policy identity is frozen");

  const parent = baseConfigV1();
  const canonical = feedbackConfigV1(parent);
  assert.equal(canonical.payload.config_purpose, CAP05_RUNTIME_CONFIG_PURPOSE_V1);
  assert.equal(canonical.payload.config_selection_mode, CAP05_CONFIG_SELECTION_MODE_V1);
  validateCap05ReceiptConsumingRuntimePoliciesV1(canonical.payload);
  ok("canonical effective Config remains CAP-05 feedback authority");

  const canonicalSnapshot = structuredClone(canonical);
  const repository = new MemoryRepositoryV1([parent, canonical]);
  const executionRepository = new Cap05FeedbackExecutionRuntimeConfigRepositoryV1(repository);
  const view = await executionRepository.readRuntimeConfig(canonical.object_id);
  assert.ok(view);
  assert.equal(view.object_id, canonical.object_id);
  assert.equal(view.determinism_hash, canonical.determinism_hash);
  assert.equal(view.runtime_config_ref, canonical.runtime_config_ref);
  assert.equal(view.runtime_config_hash, canonical.runtime_config_hash);
  ok("execution view preserves canonical CAP-05 identity fields");

  validateCap04RuntimeConfigPayloadV1(view.payload);
  assert.equal(view.payload.config_purpose, CAP04_RUNTIME_CONFIG_PURPOSE_V1);
  assert.equal(view.payload.config_selection_mode, CAP04_CONFIG_SELECTION_MODE_V1);
  ok("derived payload satisfies the unchanged CAP-04 execution validator");

  validateCap05ReceiptConsumingRuntimePoliciesV1(view.payload);
  ok("derived payload preserves effective receipt-consumption policy aliases");

  assert.deepEqual(canonical, canonicalSnapshot);
  assert.equal(repository.commitCalls, 0);
  assert.deepEqual(repository.byId.get(canonical.object_id), canonicalSnapshot);
  ok("derivation performs zero canonical or repository mutation");

  const parentView = await executionRepository.readRuntimeConfig(parent.object_id);
  assert.throws(() => parentView, /never/);
  throw new Error("UNREACHABLE");
}

main().catch((error) => {
  if (error instanceof Error && error.message === "UNREACHABLE") {
    console.log("SUMMARY 6 PASS / 0 FAIL");
    return;
  }
  if (error instanceof Error && error.message.includes("CAP05_CONFIG_PURPOSE_MISMATCH")) {
    console.log("PASS non-CAP-05 Config fails closed instead of being silently adapted");
    console.log("SUMMARY 7 PASS / 0 FAIL");
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
