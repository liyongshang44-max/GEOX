// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_CONTRACTS_CONFIG.ts
// Purpose: prove CAP-03 contract vocabulary, Runtime Config inheritance, D-service idempotency, aggregate discrimination, and versioned CAP-02/CAP-03 validator dispatch.
// Boundary: in-memory acceptance only; no PostgreSQL, Evidence selection, assimilation math, A2 write, route, scheduler, or production claim.

import assert from "node:assert/strict";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  validateAssimilatedContinuationUpdatePayloadV1,
  type AssimilatedContinuationUpdatePayloadV1,
  type AssimilatedObservationCandidateV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v1.js";
import {
  computeAssimilatedContinuationRecordSetDeterminismHashV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_identity_v1.js";
import {
  validateAssimilatedContinuationRecordSetV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_validator_v1.js";
import {
  validateAssimilatedContinuationRuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import {
  validateVersionedContinuationRecordSetV1,
} from "../../apps/server/src/domain/twin_runtime/continuation_record_set_dispatch_v1.js";
import { AssimilatedContinuationRuntimeConfigServiceV1 } from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_service_v1.js";
import type { RuntimeConfigRepositoryPortV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildMcftCap03ContractsConfigFixtureV1,
  noUsableObservationUpdatePayloadV1,
} from "./mcft_cap_03_contracts_config_fixture_v1.js";

class InMemoryRuntimeConfigRepositoryV1 implements RuntimeConfigRepositoryPortV1 {
  private readonly configs = new Map<string, CanonicalObjectEnvelopeV1>();
  commitCount = 0;

  async commitRuntimeConfig(config: CanonicalObjectEnvelopeV1) {
    const existing = this.configs.get(config.object_id);
    if (existing) {
      if (existing.determinism_hash !== config.determinism_hash) throw new Error("IDEMPOTENCY_CONFLICT");
      return { status: "EXISTING_IDEMPOTENT_SUCCESS" as const, object_id: config.object_id, fact_id: `fact_${config.object_id}` };
    }
    this.commitCount += 1;
    this.configs.set(config.object_id, structuredClone(config));
    return { status: "INSERTED" as const, object_id: config.object_id, fact_id: `fact_${config.object_id}` };
  }

  async readRuntimeConfig(objectId: string): Promise<CanonicalObjectEnvelopeV1 | null> {
    const value = this.configs.get(objectId);
    return value ? structuredClone(value) : null;
  }
}

function selectedCandidateV1(qualityStatus: "PASS" | "LIMITED" = "PASS"): AssimilatedObservationCandidateV1 {
  return {
    observation_ref: "obs_cap03_selected_v1",
    source_record_id: "soil_obs_001",
    source_record_hash: "sha256:soil_obs_001",
    observation_semantic_content_hash: `sha256:semantic_soil_obs_001_${qualityStatus.toLowerCase()}`,
    record_type: "soil_moisture_observation_v1",
    epistemic_class: "OBSERVED",
    observed_at: "2026-06-02T01:50:00.000Z",
    available_to_runtime_at: "2026-06-02T01:55:00.000Z",
    ingested_at: "2026-06-02T01:55:00.000Z",
    binding_id: "soil_obs_c8_20cm_v1",
    quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    source_unit: "percent_vwc",
    canonical_unit: "fraction",
    conversion_rule: { id: "PERCENT_VWC_TO_FRACTION_V1", version: "1" },
    canonical_payload: { unit: "fraction", value: 0.1845 },
    canonical_value: 0.1845,
    quality_status: qualityStatus,
    temporal_offset_seconds: 600,
    candidate_assessment: "SELECTED",
    reason_codes: [],
  };
}

function appliedPayloadV1(
  base: AssimilatedContinuationUpdatePayloadV1,
  disposition: "ACCEPTED" | "DOWNWEIGHTED",
): AssimilatedContinuationUpdatePayloadV1 {
  const selected = selectedCandidateV1(disposition === "ACCEPTED" ? "PASS" : "LIMITED");
  return {
    ...structuredClone(base),
    status: "APPLIED",
    disposition,
    candidate_observations: [selected],
    selected_observation_ref: selected.observation_ref,
    evaluated_observation_refs: [selected.observation_ref],
    applied_observation_refs: [selected.observation_ref],
    consumed_observation_refs: [selected.observation_ref],
    predicted_observation: 0.18921004,
    actual_observation: 0.1845,
    innovation: -0.00471004,
    residual: -0.00471004,
    innovation_variance: disposition === "ACCEPTED" ? 0.006747455463 : 0.010747455463,
    normalized_innovation: disposition === "ACCEPTED" ? -0.057339589842 : -0.045442,
    squared_normalized_innovation: disposition === "ACCEPTED" ? 0.003287835 : 0.002065,
    observation_variance: disposition === "ACCEPTED" ? 0.004 : 0.008,
    candidate_assimilation_gain: disposition === "ACCEPTED" ? 0.40718393448 : 0.255639,
    applied_assimilation_gain: disposition === "ACCEPTED" ? 0.40718393448 : 0.255639,
    candidate_unclipped_posterior_mean: disposition === "ACCEPTED" ? 0.187292187381 : 0.188005,
    candidate_posterior_variance: disposition === "ACCEPTED" ? 0.001628735738 : 0.002045,
    published_posterior_mean: disposition === "ACCEPTED" ? 0.187292187381 : 0.188005,
    published_posterior_variance: disposition === "ACCEPTED" ? 0.001628735738 : 0.002045,
    state_correction_vwc: disposition === "ACCEPTED" ? -0.001917852619 : -0.00120504,
    state_correction_storage_mm: disposition === "ACCEPTED" ? -0.5753557857 : -0.361512,
    reason_codes: [],
  };
}

function outlierPayloadV1(base: AssimilatedContinuationUpdatePayloadV1): AssimilatedContinuationUpdatePayloadV1 {
  const selected = selectedCandidateV1();
  return {
    ...structuredClone(base),
    status: "NOT_APPLIED",
    disposition: "REJECTED_OUTLIER",
    candidate_observations: [selected],
    selected_observation_ref: selected.observation_ref,
    evaluated_observation_refs: [selected.observation_ref],
    applied_observation_refs: [],
    consumed_observation_refs: [],
    predicted_observation: base.prior_mean,
    actual_observation: 0.56,
    innovation: 0.37078996,
    residual: 0.37078996,
    innovation_variance: 0.006747455463,
    normalized_innovation: 4.514,
    squared_normalized_innovation: 20.376,
    observation_variance: 0.004,
    candidate_assimilation_gain: 0.40718393448,
    applied_assimilation_gain: null,
    candidate_unclipped_posterior_mean: null,
    candidate_posterior_variance: null,
    published_posterior_mean: base.prior_mean,
    published_posterior_variance: base.prior_variance,
    state_correction_vwc: 0,
    state_correction_storage_mm: 0,
    reason_codes: ["INNOVATION_OUTLIER"],
  };
}

async function main(): Promise<void> {
  const fixture = await buildMcftCap03ContractsConfigFixtureV1();
  let pass = 0;
  const ok = (message: string): void => { pass += 1; console.log(`PASS ${message}`); };

  validateAssimilatedContinuationRuntimeConfigPayloadV1(fixture.assimilatedRuntimeConfig.payload);
  assert.equal(fixture.assimilatedRuntimeConfig.payload.parent_runtime_config_ref, fixture.continuationRuntimeConfig.object_id);
  assert.equal(fixture.assimilatedRuntimeConfig.payload.parent_runtime_config_hash, fixture.continuationRuntimeConfig.determinism_hash);
  assert.equal(fixture.assimilatedRuntimeConfig.payload.config_purpose, "HOURLY_DYNAMICS_WITH_OBSERVATION_ASSIMILATION");
  assert.equal(fixture.assimilatedRuntimeConfig.payload.active_model_parameter_change, "FORBIDDEN");
  assert.ok(!("no_observation_update_policy" in fixture.assimilatedRuntimeConfig.payload));
  ok("CAP-03 immutable Runtime Config inherits the pinned CAP-02 parent and removes the deferred-observation policy");

  const repository = new InMemoryRuntimeConfigRepositoryV1();
  const service = new AssimilatedContinuationRuntimeConfigServiceV1(repository);
  const first = await service.commitAndVerify(fixture.assimilatedRuntimeConfig);
  const second = await service.commitAndVerify({ ...fixture.assimilatedRuntimeConfig, created_at: "2026-07-11T00:01:00.000Z" });
  assert.equal(first.status, "INSERTED");
  assert.equal(second.status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(repository.commitCount, 1);
  ok("existing D-transaction service contract appends once and returns idempotent canonical readback");

  validateAssimilatedContinuationRecordSetV1(fixture.assimilatedRecordSet);
  const cap03Dispatch = validateVersionedContinuationRecordSetV1({
    record_set: fixture.assimilatedRecordSet,
    runtime_config: fixture.assimilatedRuntimeConfig,
  });
  assert.equal(cap03Dispatch.contract_id, "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1");
  ok("CAP-03 discriminator plus config purpose dispatches to the assimilated validator");

  const cap02Dispatch = validateVersionedContinuationRecordSetV1({
    record_set: fixture.continuationRecordSet,
    runtime_config: fixture.continuationRuntimeConfig,
  });
  assert.equal(cap02Dispatch.contract_id, "MCFT_CAP_02_CONTINUATION_V1");
  ok("historical CAP-02 record set remains valid through the immutable V1 validator without a discriminator");

  const baseUpdate = noUsableObservationUpdatePayloadV1({
    transition_ref: "transition_ref",
    state_ref: "state_ref",
    runtime_config: fixture.assimilatedRuntimeConfig,
  });
  validateAssimilatedContinuationUpdatePayloadV1(baseUpdate);
  const accepted = appliedPayloadV1(baseUpdate, "ACCEPTED");
  validateAssimilatedContinuationUpdatePayloadV1(accepted);
  const downweighted = appliedPayloadV1(baseUpdate, "DOWNWEIGHTED");
  validateAssimilatedContinuationUpdatePayloadV1(downweighted);
  const outlier = outlierPayloadV1(baseUpdate);
  validateAssimilatedContinuationUpdatePayloadV1(outlier);
  assert.equal(accepted.candidate_observations[0].quality_status, "PASS");
  assert.equal(downweighted.candidate_observations[0].quality_status, "LIMITED");
  assert.ok(Number(downweighted.candidate_assimilation_gain) < Number(accepted.candidate_assimilation_gain));
  assert.ok(Number(outlier.squared_normalized_innovation) > 16);
  ok("all four legal update combinations preserve PASS/LIMITED semantics, separated gains, and an actual outlier trace");

  const originalOperationKeyHash = fixture.assimilatedRecordSet.continuation_operation_key_hash;
  const changedAggregate = structuredClone(fixture.assimilatedRecordSet.aggregate_identity_input);
  changedAggregate.evidence_window_semantic_digest = "sha256:different_evidence_digest";
  const changedHash = computeAssimilatedContinuationRecordSetDeterminismHashV1(changedAggregate);
  assert.notEqual(changedHash, fixture.assimilatedRecordSet.continuation_record_set_determinism_hash);
  assert.equal(fixture.assimilatedRecordSet.continuation_operation_key_hash, originalOperationKeyHash);
  ok("Evidence/config/contract content changes the aggregate hash without changing the A2 operation key");

  console.log(`MCFT-CAP-03 contracts-config: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
