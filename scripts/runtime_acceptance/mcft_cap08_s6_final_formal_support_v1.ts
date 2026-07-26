// Purpose: assemble one fresh-database MCFT-CAP-08.S6 final-formal S1-S4 predecessor and exact 24-item S5 obligation ledger.
// Boundary: acceptance-only orchestration; reuses production services but never reuses slice-acceptance database objects, never activates a model, and never authorizes MCFT-CAP-09.

import { types as pgTypes } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { CAP08_S1_RUNTIME_START_V1 } from "../../apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import { CAP08_S2_FORMAL_DATASET_ID_V1 } from "../../apps/server/src/domain/twin_runtime/cap08_s2_formal_provider_contracts_v1.js";
import { DirectCap04ExecutionConfigResolverV1 } from "../../apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.js";
import type { CanonicalReplayEvidenceRecordV1, ReplayEvidenceSourcePortV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
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
import { Cap08S4AppendForwardServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s4_append_forward_service_v1.js";
import {
  CAP08_S5_ORDINARY_ASSIMILATION_ORDERS_V1,
  validateCap08S5ResidualObligationsV1,
  type Cap08S5ResidualObligationV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.js";
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
  CAP08_S5_REPLAY_DATASET_V2_CONTRACT_DIGEST_V1,
  CAP08_S5_REPLAY_DATASET_V2_HIDDEN_PARAMETER_V1,
  CAP08_S5_REPLAY_DATASET_V2_ID_V1,
  CAP08_S5_REPLAY_DATASET_V2_OUTCOME_PROFILE_ID_V1,
  CAP08_S5_REPLAY_DATASET_V2_PROFILE_ID_V1,
  Cap08S5ReplayDatasetV2EvidenceSourceV1,
} from "./mcft_cap08_s5_replay_dataset_v2_prequalification_support_v1.js";
import {
  CAP08_S5_S4_PREDECESSOR_EVIDENCE_V1,
  CAP08_S5_V2_PREQUALIFICATION_EVIDENCE_V1,
} from "./mcft_cap08_s5_v2_formal_acceptance_support_v1.js";

export const CAP08_S6_CONTRACT_SEMANTIC_DIGEST_V1 = "sha256:c288a987b007eccc25a22f117eb1d9b53e8f551a9566ce322674a1bd082657ab" as const;
export const CAP08_S6_CREATED_AT_V1 = "2026-07-27T00:00:00.000Z" as const;

function finalFormalEvidenceSourceV1(base: ReplayEvidenceSourcePortV1): ReplayEvidenceSourcePortV1 {
  return {
    async loadCandidateRecords(input) {
      const records = structuredClone(await base.loadCandidateRecords(input));
      return records.map((source) => {
        const retained = source.limitations.filter((item) => !/(?:SLICE_ACCEPTANCE_ONLY|PREQUALIFICATION_ONLY)$/.test(item));
        return {
          ...source,
          limitations: [...new Set([...retained, "FINAL_FORMAL_RUN", "NOT_FIELD_CALIBRATED"])],
        };
      });
    },
  };
}

function exactMemberV1(recordSet: { members: CanonicalObjectEnvelopeV1[] }, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP08_S6_MEMBER_CARDINALITY:${objectType}:${matches.length}`);
  return structuredClone(matches[0]);
}

function commitPhaseV1(order: number): string {
  if (order === 1 || order === 16) return "T16";
  if (order === 24) return "G00";
  return `T${String(order).padStart(2, "0")}`;
}

export async function establishCap08S6FinalFormalPredecessorV1(root: string, runInstanceId: "RUN_A" | "RUN_B") {
  const fixture = buildCap08S2FormalProviderFixtureV1();
  const baseManifest = computeCap08S3SourceManifestV1(root);
  const sourceDigest = semanticHashV1({
    base_manifest_digest: baseManifest.manifest_digest,
    s6_contract_semantic_digest: CAP08_S6_CONTRACT_SEMANTIC_DIGEST_V1,
    replay_v2_contract_digest: CAP08_S5_REPLAY_DATASET_V2_CONTRACT_DIGEST_V1,
    dataset_id: CAP08_S5_REPLAY_DATASET_V2_ID_V1,
    profile_id: CAP08_S5_REPLAY_DATASET_V2_PROFILE_ID_V1,
    outcome_profile_id: CAP08_S5_REPLAY_DATASET_V2_OUTCOME_PROFILE_ID_V1,
    hidden_parameter_value: CAP08_S5_REPLAY_DATASET_V2_HIDDEN_PARAMETER_V1,
  });
  const runtimeRepository = new PostgresRuntimeRepositoryV1(runner);
  const nextTickRepository = new PostgresNextTickRepositoryV1(runner);
  const forecastRepository = new PostgresForecastScenarioRecoveryRepositoryV1(runner);
  const binding = await nextTickRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot);
  if (binding.status !== "INSERTED") throw new Error("CAP08_S6_REALITY_BINDING_INSERT_FAILED");
  for (const config of fixture.runtime_configs) {
    const committed = await runtimeRepository.commitRuntimeConfig(config);
    if (committed.status !== "INSERTED") throw new Error("CAP08_S6_RUNTIME_CONFIG_INSERT_FAILED");
  }

  const bootstrapEvidence = finalFormalEvidenceSourceV1(fixture.bootstrap_evidence_source);
  const replayV2Evidence = new Cap08S5ReplayDatasetV2EvidenceSourceV1(bootstrapEvidence, runtimeRepository);
  const finalEvidence = finalFormalEvidenceSourceV1(replayV2Evidence);
  const frozenEvidence = new Cap08FrozenEvidenceSourceV1(new Cap08S2QualifiedEvidenceSourceV1(finalEvidence));
  const deferred = new Cap08DeferredScenarioPersistenceV1(persistenceAdapterV1(runtimeRepository, forecastRepository, []));
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
  const baseTick = new Cap08S3FormalTickServiceV1(
    handoff,
    frozenEvidence,
    deferred,
    normalTick,
    receiptTick,
    new Cap08S3DecisionActionProviderServiceV1(runner),
    new Cap08S3ReceiptEpisodeGuardV1(runner),
    new Cap08S3AuthorityGuardV1(runner),
  );
  const range = new Cap08S3FormalRangeServiceV1(
    handoff,
    new Cap08S3CompletionEvidenceTickServiceV1(baseTick, new Cap08S3OutcomeCompletionEvidenceServiceV1(runner)),
    new Cap08S3EpisodeInspectorV1(runner),
    sourceDigest,
    new PostgresCap08S3CompletionAuthorityPairRepositoryV1(runner),
  );
  const runtime = new Cap08S3FormalRuntimeServiceV1(
    new A0BootstrapRuntimeServiceV1(runtimeRepository, runtimeRepository, bootstrapEvidence),
    range,
  );
  const formalRunId = `cap08_final_${semanticHashV1({
    run_contract: "MCFT-CAP-08.S6-FINAL-TWO-RUN-CLOSURE-RECOVERY-READ-MODEL-V1",
    contract_digest: CAP08_S6_CONTRACT_SEMANTIC_DIGEST_V1,
    dataset_id: CAP08_S5_REPLAY_DATASET_V2_ID_V1,
    s2_dataset_id: CAP08_S2_FORMAL_DATASET_ID_V1,
    scope: fixture.scope,
    runtime_config_hashes: fixture.runtime_configs.map((item) => item.determinism_hash),
  }).slice(7, 39)}`;
  const runtimeInput = {
    formal_run_id: formalRunId,
    scope: fixture.scope,
    created_at: CAP08_S6_CREATED_AT_V1,
    bootstrap_runtime_config: fixture.bootstrap_runtime_config,
    bootstrap_hydraulic: fixture.hydraulic,
    soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
    runtime_config_refs_by_logical_time: fixture.runtime_config_refs_by_logical_time,
    runtime_config_hashes_by_logical_time: fixture.runtime_config_hashes_by_logical_time,
    authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
    crop_stage_context: fixture.crop_stage_context,
    lease_owner: `mcft-cap08-s6-${runInstanceId.toLowerCase()}`,
    lease_duration_seconds: 300,
  };
  const result = await runtime.execute(runtimeInput);
  if (result.status !== "COMPLETED" || result.range.executed_tick_count !== 24 || result.range.completion_authority_pair_write_delta !== 2) {
    throw new Error("CAP08_S6_S3_CHAIN_NOT_EXACT");
  }

  const s4 = await new Cap08S4AppendForwardServiceV1(runner, replayV2Evidence).execute({
    formal_run_id: formalRunId,
    scope: fixture.scope,
    created_at: CAP08_S6_CREATED_AT_V1,
    phase_engine_source_digest: sourceDigest,
  });
  if (s4.status !== "COMPLETED" || s4.write_delta !== 7 || s4.corrected_set.forecast.object_id !== s4.t17_predecessor.previous_forecast_result_ref) {
    throw new Error("CAP08_S6_S4_APPEND_FORWARD_NOT_EXACT");
  }

  const tickResults = result.range.tick_results;
  if (tickResults.length !== 24) throw new Error(`CAP08_S6_TICK_COUNT:${tickResults.length}`);
  const obligations: Cap08S5ResidualObligationV1[] = [];
  for (let order = 1; order <= 24; order += 1) {
    const sourceForecast = exactMemberV1(tickResults[order - 1].a_record_set, "twin_forecast_run_v1");
    const residualForecast = order === 17 ? s4.corrected_set.forecast : sourceForecast;
    const fvoId = `FVO-${String(order).padStart(2, "0")}`;
    const observation = await replayV2Evidence.buildFvoFromForecastV1({ scope: fixture.scope, fvoId, forecast: sourceForecast });
    const ordinary = (CAP08_S5_ORDINARY_ASSIMILATION_ORDERS_V1 as readonly number[]).includes(order)
      ? exactMemberV1(tickResults[order].a_record_set, "twin_assimilation_update_v1")
      : null;
    obligations.push({
      residual_id: `R-${String(order).padStart(2, "0")}`,
      residual_order: order,
      commit_phase: commitPhaseV1(order),
      forecast_ref: residualForecast.object_id,
      forecast_hash: residualForecast.determinism_hash,
      observation: {
        fvo_id: fvoId,
        source_record_id: observation.source_record_id,
        source_record_hash: observation.source_record_hash,
        observed_at: String(observation.role_time.observed_at),
        available_to_runtime_at: observation.available_to_runtime_at,
        quality_status: observation.quality.status === "LIMITED" ? "LIMITED" : "PASS",
        canonical_value: Number(observation.canonical_payload.value).toFixed(6),
        canonical_unit: "fraction",
      },
      assimilation_update_ref: ordinary?.object_id ?? null,
      assimilation_update_hash: ordinary?.determinism_hash ?? null,
    });
  }
  pgTypes.setTypeParser(1184, (value: string): string => value);
  pgTypes.setTypeParser(1114, (value: string): string => value);
  return {
    fixture: { ...fixture, formal_run_id: formalRunId },
    evidence_source: replayV2Evidence,
    source_digest: sourceDigest,
    source_manifest: baseManifest,
    runtime_repository: runtimeRepository,
    runtime_input: runtimeInput,
    predecessor_result: result,
    s4,
    obligations: validateCap08S5ResidualObligationsV1(obligations),
    predecessor_evidence: structuredClone(CAP08_S5_S4_PREDECESSOR_EVIDENCE_V1),
    prequalification_evidence: structuredClone(CAP08_S5_V2_PREQUALIFICATION_EVIDENCE_V1),
    slice_acceptance_only: false as const,
    final_formal_run_id: formalRunId,
    run_instance_id: runInstanceId,
  };
}
