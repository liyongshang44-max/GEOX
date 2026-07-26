// Purpose: preserve the frozen S3 FVO-10 business outcome while testing the remaining replay-dataset v2 hidden-0.034 observation design.
// Boundary: disposable architecture diagnostic only; no Candidate Declaration, predecessor effectiveness, final formal run, production Runtime source, Model Activation, active Config switch, or MCFT-CAP-09 authority.

import { types as pgTypes } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { CAP08_S3_OUTCOME_VALUE_V1 } from "../../apps/server/src/domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.js";
import { DirectCap04ExecutionConfigResolverV1 } from "../../apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { PostgresActionFeedbackTickSourceV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_action_feedback_tick_source_v1.js";
import { PostgresCap08S3CompletionAuthorityPairRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_cap08_s3_completion_authority_pair_repository_v1.js";
import { Cap08S2QualifiedEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s2_qualified_evidence_source_v1.js";
import { Cap08S3AuthorityGuardV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_authority_guard_v1.js";
import { Cap08S3CompletionEvidenceTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_completion_evidence_tick_service_v1.js";
import { Cap08S3DecisionActionProviderServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_decision_action_provider_service_v1.js";
import { Cap08S3EpisodeInspectorV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_episode_inspector_v1.js";
import { Cap08S3FormalRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_formal_range_service_v1.js";
import { Cap08S3FormalRuntimeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_formal_runtime_service_v1.js";
import { Cap08S3FormalTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_formal_tick_service_v1.js";
import { Cap08S3OutcomeCompletionEvidenceServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_outcome_completion_evidence_service_v1.js";
import { Cap08S3ReceiptConsumingForecastScenarioTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_receipt_consuming_tick_service_v1.js";
import { Cap08S3ReceiptEpisodeGuardV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_receipt_episode_guard_v1.js";
import {
  A0BootstrapRuntimeServiceV1,
  Cap04ForecastScenarioSingleTickServiceV1,
  Cap08DeferredScenarioPersistenceV1,
  Cap08FrozenEvidenceSourceV1,
  PostgresForecastScenarioRecoveryRepositoryV1,
  PostgresNextTickRepositoryV1,
  PostgresRuntimeRepositoryV1,
  PrepareNextTickInputServiceV1,
  CAP08_S1_CREATED_AT_V1,
  persistenceAdapterV1,
  runner,
} from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { buildCap08S2FormalProviderFixtureV1 } from "./mcft_cap08_s2_formal_provider_fixture_v1.js";
import { computeCap08S3SourceManifestV1 } from "./mcft_cap08_s3_source_manifest_v1.js";
import {
  CAP08_S5_ARCHITECTURE_V2_DIAGNOSTIC_DATASET_ID_V1,
  CAP08_S5_ARCHITECTURE_V2_HIDDEN_PARAMETER_V1,
  CAP08_S5_ARCHITECTURE_V2_PROFILE_ID_V1,
  Cap08S5ArchitectureV2EvidenceSourceV1,
} from "./mcft_cap08_s5_architecture_v2_diagnostic_support_v1.js";

export const CAP08_S5_ARCHITECTURE_V2_OUTCOME_EXCEPTION_PROFILE_V1 =
  "FVO10_FROZEN_BUSINESS_OUTCOME_ANCHOR_V1" as const;

export class Cap08S5ArchitectureV2OutcomePreservingEvidenceSourceV1
extends Cap08S5ArchitectureV2EvidenceSourceV1 {
  override async buildFvoFromForecastV1(input: {
    scope: TwinScopeKeyV1;
    fvoId: string;
    forecast: CanonicalObjectEnvelopeV1;
  }): Promise<CanonicalReplayEvidenceRecordV1> {
    const record = await super.buildFvoFromForecastV1(input);
    if (input.fvoId !== "FVO-10") return record;
    const canonicalPayload = {
      ...record.canonical_payload,
      value: Number(CAP08_S3_OUTCOME_VALUE_V1),
      generation_profile_id: CAP08_S5_ARCHITECTURE_V2_OUTCOME_EXCEPTION_PROFILE_V1,
      hidden_parameter_key: null,
      hidden_parameter_value: null,
      business_outcome_anchor: true,
    };
    record.canonical_payload = canonicalPayload;
    record.source_payload = {
      ...record.source_payload,
      ...canonicalPayload,
      source_version: "2-diagnostic-outcome-preserving",
    };
    record.source_record_hash = semanticHashV1({
      dataset_id: record.dataset_id,
      source_record_id: record.source_record_id,
      binding_id: record.binding_id,
      scope: input.scope,
      role_time: record.role_time,
      canonical_payload: canonicalPayload,
      quality_status: record.quality.status,
    });
    record.limitations = [
      ...record.limitations,
      "FVO10_PRESERVES_FROZEN_S3_BUSINESS_OUTCOME",
    ];
    return record;
  }
}

export async function establishCap08S5ArchitectureV2OutcomePreservingPredecessorV1(root: string) {
  const fixture = buildCap08S2FormalProviderFixtureV1();
  const baseManifest = computeCap08S3SourceManifestV1(root);
  const diagnosticSourceDigest = semanticHashV1({
    base_manifest_digest: baseManifest.manifest_digest,
    dataset_id: CAP08_S5_ARCHITECTURE_V2_DIAGNOSTIC_DATASET_ID_V1,
    profile_id: CAP08_S5_ARCHITECTURE_V2_PROFILE_ID_V1,
    outcome_exception_profile: CAP08_S5_ARCHITECTURE_V2_OUTCOME_EXCEPTION_PROFILE_V1,
    hidden_parameter_value: CAP08_S5_ARCHITECTURE_V2_HIDDEN_PARAMETER_V1,
  });
  const runtimeRepository = new PostgresRuntimeRepositoryV1(runner);
  const nextTickRepository = new PostgresNextTickRepositoryV1(runner);
  const forecastRepository = new PostgresForecastScenarioRecoveryRepositoryV1(runner);
  const binding = await nextTickRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot);
  if (binding.status !== "INSERTED") throw new Error("CAP08_S5_V2_OUTCOME_REALITY_BINDING_INSERT_FAILED");
  for (const config of fixture.runtime_configs) {
    const committed = await runtimeRepository.commitRuntimeConfig(config);
    if (committed.status !== "INSERTED") throw new Error("CAP08_S5_V2_OUTCOME_RUNTIME_CONFIG_INSERT_FAILED");
  }
  const diagnosticEvidence = new Cap08S5ArchitectureV2OutcomePreservingEvidenceSourceV1(
    fixture.bootstrap_evidence_source,
    runtimeRepository,
  );
  const qualifiedEvidence = new Cap08S2QualifiedEvidenceSourceV1(diagnosticEvidence);
  const frozenEvidence = new Cap08FrozenEvidenceSourceV1(qualifiedEvidence);
  const persistence = persistenceAdapterV1(runtimeRepository, forecastRepository, []);
  const deferred = new Cap08DeferredScenarioPersistenceV1(persistence);
  const handoff = new PrepareNextTickInputServiceV1(nextTickRepository);
  const normalTick = new Cap04ForecastScenarioSingleTickServiceV1(
    handoff,
    frozenEvidence,
    runtimeRepository,
    deferred,
    new DirectCap04ExecutionConfigResolverV1(),
  );
  const receiptTick = new Cap08S3ReceiptConsumingForecastScenarioTickServiceV1(
    handoff,
    frozenEvidence,
    new PostgresActionFeedbackTickSourceV1(runner),
    runtimeRepository,
    deferred,
    new DirectCap04ExecutionConfigResolverV1(),
  );
  const provider = new Cap08S3DecisionActionProviderServiceV1(runner);
  const inspector = new Cap08S3EpisodeInspectorV1(runner);
  const baseTick = new Cap08S3FormalTickServiceV1(
    handoff,
    frozenEvidence,
    deferred,
    normalTick,
    receiptTick,
    provider,
    new Cap08S3ReceiptEpisodeGuardV1(runner),
    new Cap08S3AuthorityGuardV1(runner),
  );
  const tick = new Cap08S3CompletionEvidenceTickServiceV1(
    baseTick,
    new Cap08S3OutcomeCompletionEvidenceServiceV1(runner),
  );
  const range = new Cap08S3FormalRangeServiceV1(
    handoff,
    tick,
    inspector,
    diagnosticSourceDigest,
    new PostgresCap08S3CompletionAuthorityPairRepositoryV1(runner),
  );
  const runtime = new Cap08S3FormalRuntimeServiceV1(
    new A0BootstrapRuntimeServiceV1(runtimeRepository, runtimeRepository, fixture.bootstrap_evidence_source),
    range,
  );
  const formalRunId = `cap08_v2out_${semanticHashV1({
    dataset_id: CAP08_S5_ARCHITECTURE_V2_DIAGNOSTIC_DATASET_ID_V1,
    profile_id: CAP08_S5_ARCHITECTURE_V2_PROFILE_ID_V1,
    outcome_exception_profile: CAP08_S5_ARCHITECTURE_V2_OUTCOME_EXCEPTION_PROFILE_V1,
    scope: fixture.scope,
    runtime_config_hashes: fixture.runtime_configs.map((item) => item.determinism_hash),
  }).slice(7, 31)}`;
  const runtimeInput = {
    formal_run_id: formalRunId,
    scope: fixture.scope,
    created_at: CAP08_S1_CREATED_AT_V1,
    bootstrap_runtime_config: fixture.bootstrap_runtime_config,
    bootstrap_hydraulic: fixture.hydraulic,
    soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
    runtime_config_refs_by_logical_time: fixture.runtime_config_refs_by_logical_time,
    runtime_config_hashes_by_logical_time: fixture.runtime_config_hashes_by_logical_time,
    authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
    crop_stage_context: fixture.crop_stage_context,
    lease_owner: "mcft-cap08-s5-v2-outcome-preserving-diagnostic",
    lease_duration_seconds: 300,
  };
  const result = await runtime.execute(runtimeInput);
  if (result.status !== "COMPLETED"
    || result.range.executed_tick_count !== 24
    || result.range.completion_authority_pair_write_delta !== 2) {
    throw new Error("CAP08_S5_V2_OUTCOME_S3_PREDECESSOR_NOT_EXACT");
  }
  pgTypes.setTypeParser(1184, (value: string): string => value);
  pgTypes.setTypeParser(1114, (value: string): string => value);
  return {
    fixture: { ...fixture, formal_run_id: formalRunId },
    diagnostic_evidence_source: diagnosticEvidence,
    diagnostic_source_digest: diagnosticSourceDigest,
    runtime_repository: runtimeRepository,
    runtime,
    runtime_input: runtimeInput,
    predecessor_result: result,
  };
}
