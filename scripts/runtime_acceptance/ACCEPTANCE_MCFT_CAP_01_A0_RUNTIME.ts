// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_01_A0_RUNTIME.ts
// Purpose: prove controlled Replay Evidence freezing, no-future-leakage, S3B posterior integration, deterministic nine-object A0 construction, idempotency-before-lease, BLOCKED Forecast, and next-tick handoff.
// Boundary: in-memory persistence proof plus governed fixture reads only; no PostgreSQL, canonical production write, propagation, Scenario, Recommendation, AO-ACT, scheduler, or wall-clock reads.

import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CanonicalReplayFileSourceV1 } from "../../apps/server/src/adapters/twin_runtime/canonical_replay_file_source_v1.js";
import { validateA0RecordSetV1, validateCanonicalObjectV1, type A0RecordSetV1, type CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type { SoilHydraulicBoundsV1 } from "../../apps/server/src/domain/twin_runtime/physical_bounds_v1.js";
import { A0BootstrapRuntimeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.js";
import { buildA0RecordSetV1 } from "../../apps/server/src/runtime/twin_runtime/a0_record_set_builder_v1.js";
import { buildFrozenEvidenceWindowV1 } from "../../apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.js";
import { compileRuntimeConfigFromAuthorityArtifactsV1, type Mcft00ConfigurationMatrixArtifactV1, type Mcft00RealityArtifactV1, type Mcft00SourceMatrixArtifactV1 } from "../../apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";
import type { BootstrapPersistencePortV1, CanonicalReplayEvidenceRecordV1, RuntimeConfigRepositoryPortV1, RuntimeLeaseClaimV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASELINE = "5d17e6ad9944376bbb5a71c9d801aa4472afe592";
const LOGICAL_TIME = "2026-06-01T01:00:00.000Z";
const CREATED_AT = "2026-06-01T01:00:00.000Z";

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

class InMemoryRuntimeConfigRepositoryV1 implements RuntimeConfigRepositoryPortV1 {
  private readonly configs = new Map<string, CanonicalObjectEnvelopeV1>();
  async commitRuntimeConfig(config: CanonicalObjectEnvelopeV1) {
    validateCanonicalObjectV1(config);
    const existing = this.configs.get(config.object_id);
    if (existing) {
      if (existing.determinism_hash !== config.determinism_hash) throw new Error("IDEMPOTENCY_CONFLICT");
      return { status: "EXISTING_IDEMPOTENT_SUCCESS" as const, object_id: config.object_id, fact_id: `fact_${config.object_id}` };
    }
    this.configs.set(config.object_id, structuredClone(config));
    return { status: "INSERTED" as const, object_id: config.object_id, fact_id: `fact_${config.object_id}` };
  }
  async readRuntimeConfig(objectId: string): Promise<CanonicalObjectEnvelopeV1 | null> {
    return this.configs.get(objectId) ?? null;
  }
}

class InMemoryBootstrapPersistenceV1 implements BootstrapPersistencePortV1 {
  readonly byKey = new Map<string, A0RecordSetV1>();
  leaseCount = 0;
  commitCount = 0;
  async acquireLease(claim: Omit<RuntimeLeaseClaimV1, "fencing_token">): Promise<RuntimeLeaseClaimV1> {
    this.leaseCount += 1;
    return { ...claim, fencing_token: BigInt(this.leaseCount) };
  }
  async lookupA0RecordSet(idempotencyKey: string): Promise<A0RecordSetV1 | null> {
    return this.byKey.get(idempotencyKey) ?? null;
  }
  async commitBootstrapState(input: Parameters<BootstrapPersistencePortV1["commitBootstrapState"]>[0]) {
    validateA0RecordSetV1(input.record_set);
    this.commitCount += 1;
    const existing = this.byKey.get(input.record_set.a0_idempotency_key);
    if (existing) {
      if (existing.a0_record_set_determinism_hash !== input.record_set.a0_record_set_determinism_hash) throw new Error("IDEMPOTENCY_CONFLICT");
      return { status: "EXISTING_IDEMPOTENT_SUCCESS" as const, record_set: existing, fact_ids_by_object_id: Object.fromEntries(existing.members.map((member) => [member.object_id, `fact_${member.object_id}`])) };
    }
    this.byKey.set(input.record_set.a0_idempotency_key, structuredClone(input.record_set));
    return { status: "INSERTED" as const, record_set: input.record_set, fact_ids_by_object_id: Object.fromEntries(input.record_set.members.map((member) => [member.object_id, `fact_${member.object_id}`])) };
  }
  async readBootstrapRecordSet(recordSetId: string): Promise<A0RecordSetV1 | null> {
    return [...this.byKey.values()].find((recordSet) => recordSet.a0_record_set_id === recordSetId) ?? null;
  }
}

type ConfigurationMatrixExtendedV1 = Mcft00ConfigurationMatrixArtifactV1 & {
  configuration_source_definitions: Array<{
    configuration_source_id: string;
    parameters: Record<string, { value: unknown }>;
  }>;
};

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
  const matches = recordSet.members.filter((member) => member.object_type === type);
  assert.equal(matches.length, 1);
  return matches[0];
}

async function main(): Promise<void> {
  const reality = readJson<Mcft00RealityArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json");
  const sourceMatrix = readJson<Mcft00SourceMatrixArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json");
  const configurationMatrix = readJson<ConfigurationMatrixExtendedV1>("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json");
  const scope = reality.semantic_payload.scope as TwinScopeKeyV1;
  const runtimeConfig = compileRuntimeConfigFromAuthorityArtifactsV1({
    realityArtifact: reality,
    sourceMatrixArtifact: sourceMatrix,
    configurationMatrixArtifact: configurationMatrix,
    logical_time: "2026-06-01T00:00:00.000Z",
    created_at: "2026-06-01T00:00:00.000Z",
  });
  const hydraulic = hydraulicFromAuthorityV1(configurationMatrix);
  const evidenceSource = new CanonicalReplayFileSourceV1(path.join(ROOT, "fixtures/mcft/water_state/replay_v1"));
  const candidates = await evidenceSource.loadCandidateRecords({ scope, logical_time: LOGICAL_TIME });
  assert.ok(candidates.length > 100); ok("controlled Replay file adapter loads and hash-validates tick candidates");

  const window = buildFrozenEvidenceWindowV1({ scope, logical_time: LOGICAL_TIME, candidate_records: candidates });
  assert.equal(window.window_start_exclusive, "2026-06-01T00:00:00.000Z");
  assert.equal(window.window_end_inclusive, LOGICAL_TIME);
  assert.equal(window.coverage.selected_record_count, 3);
  assert.equal(window.coverage.soil_moisture_observation_count, 1);
  assert.equal(window.coverage.rainfall_observation_count, 1);
  assert.equal(window.coverage.historical_et0_input_count, 1);
  assert.equal(window.coverage.future_weather_assumption_count, 0);
  assert.equal(window.coverage.future_et0_assumption_count, 0);
  assert.equal(window.assimilation_observation.source_record_id, "mcft_src_0f8bae003933b54d7d1141e0");
  assert.equal(window.assimilation_observation.canonical_payload.value, 0.184);
  assert.ok((window.exclusion_counts.NOT_AVAILABLE_AT_LOGICAL_TICK ?? 0) >= 2);
  ok("frozen open-start closed-end Evidence Window selects soil rainfall and historical ET0 only");
  ok("latest usable soil observation selected deterministically");
  ok("future assumption snapshots remain unavailable and excluded at A0 tick");

  const futureRecord = structuredClone(window.assimilation_observation) as CanonicalReplayEvidenceRecordV1;
  futureRecord.source_record_id = "mcft_src_future_injection";
  futureRecord.source_record_hash = "sha256:future_injection_fixture";
  futureRecord.role_time = { ...futureRecord.role_time, observed_at: "2026-06-01T01:10:00.000Z" };
  futureRecord.available_to_runtime_at = "2026-06-01T00:59:00.000Z";
  const withFuture = buildFrozenEvidenceWindowV1({ scope, logical_time: LOGICAL_TIME, candidate_records: [...candidates, futureRecord] });
  assert.equal(withFuture.assimilation_observation.source_record_id, window.assimilation_observation.source_record_id);
  assert.ok(withFuture.excluded_records.some((record) => record.source_record_id === futureRecord.source_record_id && record.reason_code === "FUTURE_EVIDENCE_FORBIDDEN"));
  ok("future Evidence is excluded even when its availability timestamp is earlier");

  const lateOnly = structuredClone(window.assimilation_observation) as CanonicalReplayEvidenceRecordV1;
  lateOnly.available_to_runtime_at = "2026-06-01T01:05:00.000Z";
  await assert.rejects(async () => buildFrozenEvidenceWindowV1({ scope, logical_time: LOGICAL_TIME, candidate_records: [lateOnly] }), /NO_USABLE_SOIL_OBSERVATION_IN_A0_WINDOW/);
  ok("late-only soil Evidence cannot bootstrap State");

  const firstBuilt = buildA0RecordSetV1({
    scope,
    logical_time: LOGICAL_TIME,
    created_at: CREATED_AT,
    runtime_config: runtimeConfig,
    evidence_window: window,
    hydraulic,
    soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
  });
  const secondBuilt = buildA0RecordSetV1({
    scope,
    logical_time: LOGICAL_TIME,
    created_at: "2026-06-01T01:30:00.000Z",
    runtime_config: runtimeConfig,
    evidence_window: window,
    hydraulic,
    soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
  });
  validateA0RecordSetV1(firstBuilt);
  assert.equal(firstBuilt.members.length, 9);
  assert.equal(firstBuilt.a0_record_set_id, secondBuilt.a0_record_set_id);
  assert.equal(firstBuilt.a0_idempotency_key, secondBuilt.a0_idempotency_key);
  assert.equal(firstBuilt.a0_record_set_determinism_hash, secondBuilt.a0_record_set_determinism_hash);
  ok("nine-object A0 record set validates");
  ok("audit created_at does not change A0 semantic identity or aggregate hash");

  const lineage = memberV1(firstBuilt, "twin_runtime_lineage_v1");
  const evidence = memberV1(firstBuilt, "twin_evidence_window_v1");
  const transition = memberV1(firstBuilt, "twin_state_transition_v1");
  const assimilation = memberV1(firstBuilt, "twin_assimilation_update_v1");
  const state = memberV1(firstBuilt, "twin_state_estimate_v1");
  const forecast = memberV1(firstBuilt, "twin_forecast_run_v1");
  const tick = memberV1(firstBuilt, "twin_runtime_tick_v1");
  const checkpoint = memberV1(firstBuilt, "twin_runtime_checkpoint_v1");
  const health = memberV1(firstBuilt, "twin_runtime_health_v1");

  assert.equal(lineage.payload.lineage_kind, "INITIAL");
  assert.equal(lineage.payload.parent_lineage_ref, null);
  assert.equal(lineage.payload.revision_run_ref, null);
  assert.equal(lineage.payload.activation_authority_kind, "INITIAL_LINEAGE_DECLARATION");
  assert.equal(evidence.payload.frozen, true);
  assert.equal(transition.payload.transition_kind, "BOOTSTRAP");
  assert.equal(transition.payload.previous_posterior_ref, null);
  assert.equal(transition.payload.process_model_status, "NOT_APPLIED_BOOTSTRAP");
  assert.equal((transition.payload.bootstrap_prior as Record<string, unknown>).mean, 0.21);
  assert.equal(assimilation.payload.observation_ref, "mcft_src_0f8bae003933b54d7d1141e0");
  assert.equal(assimilation.payload.assimilation_gain, 0.669421);
  const statePosterior = state.payload.posterior as Record<string, unknown>;
  assert.equal(statePosterior.mean, 0.192595);
  assert.equal(statePosterior.variance, 0.002678);
  assert.equal((state.payload.derived_state as Record<string, unknown>).available_water_fraction, 0.403306);
  assert.equal((state.payload.confidence as Record<string, unknown>).status, "NOT_ESTABLISHED");
  assert.equal((state.payload.use_eligibility as Record<string, unknown>).recommendation_input_eligible, false);
  assert.equal((state.payload.use_eligibility as Record<string, unknown>).action_input_eligible, false);
  ok("INITIAL lineage and embedded bootstrap prior contracts");
  ok("S3B posterior is embedded as canonical State estimate without numeric confidence");

  assert.equal(forecast.payload.status, "BLOCKED");
  assert.deepEqual(forecast.payload.points, []);
  assert.equal(forecast.payload.scenario_eligible, false);
  assert.ok((forecast.payload.reason_codes as string[]).includes("MCFT_06_PROPAGATION_NOT_ESTABLISHED"));
  assert.equal(tick.payload.status, "COMPLETED_WITH_LIMITATIONS");
  assert.equal(checkpoint.payload.checkpoint_kind, "INITIAL");
  assert.equal(checkpoint.payload.previous_checkpoint_ref, null);
  assert.equal(checkpoint.payload.successful_forecast_ref, null);
  assert.equal(checkpoint.payload.next_tick_logical_time, "2026-06-01T02:00:00.000Z");
  assert.equal(health.payload.operation_status, "A0_COMMITTED_WITH_BLOCKED_FORECAST");
  ok("BLOCKED zero-point Forecast carries prerequisite reasons and remains Scenario-ineligible");
  ok("terminal tick completes with limitations and INITIAL checkpoint advances");
  ok("next-tick handoff is explicit while successful Forecast remains null");

  const configRepository = new InMemoryRuntimeConfigRepositoryV1();
  const persistence = new InMemoryBootstrapPersistenceV1();
  const service = new A0BootstrapRuntimeServiceV1(configRepository, persistence, evidenceSource);
  const first = await service.execute({
    scope,
    logical_time: LOGICAL_TIME,
    created_at: CREATED_AT,
    runtime_config: runtimeConfig,
    hydraulic,
    soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
    lease_owner: "mcft-cap-01-s4-static-acceptance",
    lease_duration_seconds: 300,
  });
  assert.equal(first.status, "INSERTED");
  assert.equal(first.runtime_config_status, "INSERTED");
  assert.equal(persistence.leaseCount, 1);
  assert.equal(persistence.commitCount, 1);
  const second = await service.execute({
    scope,
    logical_time: LOGICAL_TIME,
    created_at: "2026-06-01T01:45:00.000Z",
    runtime_config: runtimeConfig,
    hydraulic,
    soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
    lease_owner: "mcft-cap-01-s4-static-acceptance",
    lease_duration_seconds: 300,
  });
  assert.equal(second.status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(second.runtime_config_status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(persistence.leaseCount, 1);
  assert.equal(persistence.commitCount, 1);
  assert.equal(second.record_set.a0_record_set_determinism_hash, first.record_set.a0_record_set_determinism_hash);
  ok("first A0 execution commits through integration service");
  ok("same-input replay returns existing record set before acquiring another lease");
  ok("idempotent replay does not invoke persistence commit again");

  const pureFiles = [
    "apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.ts",
    "apps/server/src/runtime/twin_runtime/a0_record_set_builder_v1.ts",
    "apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.ts",
  ];
  const forbiddenPattern = /Date\.now|process\.env|Math\.random|randomUUID|nanoid|from ["']pg["']|from ["']node:fs|Fastify|\bfetch\s*\(/;
  for (const relativePath of pureFiles) {
    const text = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    assert.equal(forbiddenPattern.test(text), false, relativePath);
    ok(`${relativePath} controlled Runtime purity`);
  }

  const changed = cp.execFileSync("git", ["diff", "--name-only", `${BASELINE}...HEAD`], { cwd: ROOT, encoding: "utf8" })
    .trim().split(/\r?\n/).filter(Boolean);
  const allowedPatterns = [
    /^apps\/server\/src\/runtime\/twin_runtime\/(ports|evidence_window_builder_v1|a0_record_set_builder_v1|a0_bootstrap_runtime_service_v1)\.ts$/,
    /^apps\/server\/src\/adapters\/twin_runtime\/canonical_replay_file_source_v1\.ts$/,
    /^scripts\/runtime_acceptance\/ACCEPTANCE_MCFT_CAP_01_A0_RUNTIME(_DB)?\.ts$/,
    /^fixtures\/mcft\/water_state\/(expected|negative)\//,
    /^docs\/digital_twin\/mcft\/cap_01\//,
    /^scripts\/governance_acceptance\/ACCEPTANCE_MCFT_CAP_01_S4_CLOSURE\.cjs$/,
  ];
  const forbidden = changed.filter((file) => !allowedPatterns.some((pattern) => pattern.test(file)));
  assert.deepEqual(forbidden, []);
  assert.equal(changed.some((file) => file.includes("propagation") || file.includes("scenario") || file.includes("recommendation") || file.includes("ao_act") || file.startsWith("apps/web/") || file.startsWith("apps/server/src/routes/")), false);
  ok("S4 changed-file boundary contains no propagation Scenario Recommendation AO-ACT route web changes");

  console.log(`MCFT-CAP-01 S4 A0 Runtime: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
