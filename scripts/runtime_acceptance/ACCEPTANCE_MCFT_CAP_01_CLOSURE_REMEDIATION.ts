// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_01_CLOSURE_REMEDIATION.ts
// Purpose: prove conflicting-observation rejection, deterministic Evidence selection, complete consumption trace, full A0 cross-reference validation, persisted-handoff DTO semantics, runner presence, and remediation boundaries.
// Boundary: static/in-memory acceptance only; no PostgreSQL, canonical production write, propagation, successful Forecast, Scenario, Recommendation, Decision, AO-ACT, scheduler, or wall-clock reads.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CanonicalReplayFileSourceV1 } from "../../apps/server/src/adapters/twin_runtime/canonical_replay_file_source_v1.js";
import { computeA0RecordSetDeterminismHashV1, computeMemberDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { validateA0RecordSetV1, type A0RecordSetV1, type CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type { SoilHydraulicBoundsV1 } from "../../apps/server/src/domain/twin_runtime/physical_bounds_v1.js";
import { buildA0RecordSetV1 } from "../../apps/server/src/runtime/twin_runtime/a0_record_set_builder_v1.js";
import { buildFrozenEvidenceWindowV1 } from "../../apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import {
  compileRuntimeConfigFromAuthorityArtifactsV1,
  realityBindingRuntimeSnapshotFromAuthorityArtifactV1,
  type Mcft00ConfigurationMatrixArtifactV1,
  type Mcft00RealityArtifactV1,
  type Mcft00SourceMatrixArtifactV1,
} from "../../apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";
import type { CanonicalReplayEvidenceRecordV1, NextTickReadPortV1, PersistedNextTickSnapshotV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOGICAL_TIME = "2026-06-01T01:00:00.000Z";

type ConfigurationMatrixExtendedV1 = Mcft00ConfigurationMatrixArtifactV1 & {
  configuration_source_definitions: Array<{ configuration_source_id: string; parameters: Record<string, { value: unknown }> }>;
};

function readJsonV1<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

function hydraulicFromAuthorityV1(matrix: ConfigurationMatrixExtendedV1): SoilHydraulicBoundsV1 {
  const definition = matrix.configuration_source_definitions.find((item) => item.configuration_source_id === "mcft_soil_hydraulic_config_c8_v1");
  if (!definition) throw new Error("SOIL_HYDRAULIC_DEFINITION_NOT_FOUND");
  const value = (name: string): number => {
    const candidate = definition.parameters[name]?.value;
    if (typeof candidate !== "number") throw new Error(`SOIL_HYDRAULIC_PARAMETER_INVALID:${name}`);
    return candidate;
  };
  return {
    wilting_point_fraction: value("wilting_point_fraction"),
    field_capacity_fraction: value("field_capacity_fraction"),
    saturation_fraction: value("saturation_fraction"),
    root_zone_depth_mm: value("root_zone_depth_mm"),
  };
}

function memberV1(recordSet: A0RecordSetV1, type: CanonicalObjectEnvelopeV1["object_type"]): CanonicalObjectEnvelopeV1 {
  const member = recordSet.members.find((candidate) => candidate.object_type === type);
  if (!member) throw new Error(`MEMBER_NOT_FOUND:${type}`);
  return member;
}

function mutateAndRehashV1(recordSet: A0RecordSetV1, type: CanonicalObjectEnvelopeV1["object_type"], field: string): A0RecordSetV1 {
  const mutated = structuredClone(recordSet);
  const member = memberV1(mutated, type);
  member.payload[field] = "foreign_object_ref";
  member.determinism_hash = computeMemberDeterminismHashV1(member as unknown as Record<string, unknown>);
  mutated.a0_record_set_determinism_hash = computeA0RecordSetDeterminismHashV1({
    a0_record_set_id: mutated.a0_record_set_id,
    members: mutated.members as unknown as Record<string, unknown>[],
  });
  return mutated;
}

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

async function main(): Promise<void> {
  const reality = readJsonV1<Mcft00RealityArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json");
  const sourceMatrix = readJsonV1<Mcft00SourceMatrixArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json");
  const configurationMatrix = readJsonV1<ConfigurationMatrixExtendedV1>("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json");
  const scope = reality.semantic_payload.scope as TwinScopeKeyV1;
  const runtimeConfig = compileRuntimeConfigFromAuthorityArtifactsV1({
    realityArtifact: reality,
    sourceMatrixArtifact: sourceMatrix,
    configurationMatrixArtifact: configurationMatrix,
    logical_time: "2026-06-01T00:00:00.000Z",
    created_at: "2026-06-01T00:00:00.000Z",
  });
  const evidenceSource = new CanonicalReplayFileSourceV1(path.join(ROOT, "fixtures/mcft/water_state/replay_v1"));
  const candidates = await evidenceSource.loadCandidateRecords({ scope, logical_time: LOGICAL_TIME });
  const window = buildFrozenEvidenceWindowV1({ scope, logical_time: LOGICAL_TIME, candidate_records: candidates });

  const soilSummary = window.selected_records.find((record) => record.role === "SOIL_MOISTURE_OBSERVATION");
  const rainSummary = window.selected_records.find((record) => record.role === "RAINFALL_OBSERVATION");
  const et0Summary = window.selected_records.find((record) => record.role === "HISTORICAL_ET0_INPUT");
  assert.ok(soilSummary && rainSummary && et0Summary);
  assert.equal(soilSummary.model_consumption_status, "CONSUMED_BY_BOOTSTRAP_ESTIMATOR");
  assert.equal(rainSummary.model_consumption_status, "CONTEXT_ONLY_NOT_CONSUMED_BY_BOOTSTRAP_ESTIMATOR");
  assert.equal(et0Summary.model_consumption_status, "CONTEXT_ONLY_NOT_CONSUMED_BY_BOOTSTRAP_ESTIMATOR");
  assert.equal(window.consumed_evidence_refs.length, 1);
  assert.equal(window.context_only_evidence_refs.length, 2);
  ok("Evidence Window distinguishes model-consumed soil from context-only rainfall and ET0");

  for (const summary of [soilSummary, rainSummary, et0Summary]) {
    assert.ok(summary.ingested_at);
    assert.equal(typeof summary.freshness.age_seconds, "number");
    assert.ok(summary.unit_conversion.source_unit);
    assert.ok(summary.unit_conversion.canonical_unit);
    assert.ok(summary.unit_conversion.conversion_rule.id);
    assert.ok(summary.limitations.length > 0);
  }
  ok("Evidence Window entries preserve ingestion, freshness, units, conversion, quality and limitations");

  const conflicting = structuredClone(window.assimilation_observation) as CanonicalReplayEvidenceRecordV1;
  conflicting.source_record_id = "mcft_src_conflicting_duplicate";
  conflicting.canonical_payload = { ...conflicting.canonical_payload, value: 0.199 };
  await assert.rejects(async () => buildFrozenEvidenceWindowV1({ scope, logical_time: LOGICAL_TIME, candidate_records: [...candidates, conflicting] }), /CONFLICTING_DUPLICATE_OBSERVATION/);
  ok("same source and observation time with different canonical value is rejected");

  const sameValueNewerIngest = structuredClone(window.assimilation_observation) as CanonicalReplayEvidenceRecordV1;
  sameValueNewerIngest.source_record_id = "mcft_src_same_value_newer_ingest";
  sameValueNewerIngest.role_time = { ...sameValueNewerIngest.role_time, ingested_at: "2026-06-01T00:58:00.000Z" };
  sameValueNewerIngest.available_to_runtime_at = "2026-06-01T00:58:00.000Z";
  const newerWindow = buildFrozenEvidenceWindowV1({ scope, logical_time: LOGICAL_TIME, candidate_records: [...candidates, sameValueNewerIngest] });
  assert.equal(newerWindow.assimilation_observation.source_record_id, sameValueNewerIngest.source_record_id);
  ok("soil selector orders observed_at descending, ingested_at descending, id ascending");

  const recordSet = buildA0RecordSetV1({
    scope,
    logical_time: LOGICAL_TIME,
    created_at: LOGICAL_TIME,
    runtime_config: runtimeConfig,
    evidence_window: window,
    hydraulic: hydraulicFromAuthorityV1(configurationMatrix),
    soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
  });
  validateA0RecordSetV1(recordSet);
  ok("valid A0 object graph passes complete cross-reference validation");

  const graphMutations: Array<[CanonicalObjectEnvelopeV1["object_type"], string]> = [
    ["twin_state_transition_v1", "assimilation_update_ref"],
    ["twin_state_transition_v1", "posterior_state_ref"],
    ["twin_assimilation_update_v1", "state_transition_ref"],
    ["twin_state_estimate_v1", "transition_ref"],
    ["twin_forecast_run_v1", "source_posterior_ref"],
    ["twin_runtime_tick_v1", "posterior_state_ref"],
    ["twin_runtime_tick_v1", "checkpoint_ref"],
    ["twin_runtime_checkpoint_v1", "last_completed_tick_ref"],
    ["twin_runtime_checkpoint_v1", "last_posterior_state_ref"],
    ["twin_runtime_health_v1", "checkpoint_ref"],
    ["twin_runtime_health_v1", "active_lineage_ref"],
  ];
  for (const [type, field] of graphMutations) {
    assert.throws(() => validateA0RecordSetV1(mutateAndRehashV1(recordSet, type, field)), /A0_REF_/);
  }
  ok(`${graphMutations.length} rehashed cross-reference corruptions are rejected`);

  const checkpoint = memberV1(recordSet, "twin_runtime_checkpoint_v1");
  const previousPosterior = memberV1(recordSet, "twin_state_estimate_v1");
  const snapshot: PersistedNextTickSnapshotV1 = {
    active_lineage_ref: checkpoint.lineage_id as string,
    checkpoint,
    previous_posterior: previousPosterior,
    runtime_config: runtimeConfig,
    reality_binding: realityBindingRuntimeSnapshotFromAuthorityArtifactV1(reality),
  };
  const reader: NextTickReadPortV1 = { async readPersistedNextTickSnapshot() { return structuredClone(snapshot); } };
  const prepared = await new PrepareNextTickInputServiceV1(reader).prepareNextTickInput(scope);
  assert.equal(prepared.previous_posterior_ref, previousPosterior.object_id);
  assert.equal(prepared.previous_checkpoint_ref, checkpoint.object_id);
  assert.equal(prepared.lineage_id, checkpoint.lineage_id);
  assert.equal(prepared.prior_mean, 0.192595);
  assert.equal(prepared.prior_variance, 0.002678);
  assert.equal(prepared.next_logical_tick_time, "2026-06-01T02:00:00.000Z");
  ok("prepareNextTickInput returns the required persisted-handoff DTO fields");

  const mismatched = structuredClone(snapshot);
  mismatched.active_lineage_ref = "foreign_lineage";
  await assert.rejects(async () => new PrepareNextTickInputServiceV1({ async readPersistedNextTickSnapshot() { return mismatched; } }).prepareNextTickInput(scope), /ACTIVE_LINEAGE_CHECKPOINT_MISMATCH/);
  ok("persisted handoff rejects active-lineage inconsistency");

  const runnerPath = path.join(ROOT, "apps/server/scripts/mcft/MCFT_1_FIRST_CLASS_WATER_STATE_RUNNER.ts");
  assert.ok(fs.existsSync(runnerPath));
  const runnerText = fs.readFileSync(runnerPath, "utf8");
  assert.ok(runnerText.includes("A0BootstrapRuntimeServiceV1"));
  assert.ok(runnerText.includes("PrepareNextTickInputServiceV1"));
  ok("operator-invokable MCFT-1 manual Runtime runner exists and prepares persisted handoff");

  const context = readJsonV1<Record<string, unknown>>("fixtures/mcft/water_state/replay_v1/configuration_context.json");
  assert.equal(context.context_class, "CONFIGURATION_DERIVED_CONTEXT");
  assert.ok(Array.isArray(context.crop_stage_schedule));
  ok("Replay Dataset exposes time-resolved configuration-derived crop-stage context");

  console.log(`MCFT-CAP-01 closure remediation static: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
