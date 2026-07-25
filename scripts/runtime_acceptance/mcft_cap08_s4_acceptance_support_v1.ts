// Purpose: establish the exact MCFT-CAP-08.S3 B00-to-T23 predecessor in a caller-provisioned fresh PostgreSQL database for S4 acceptance.
// Boundary: acceptance support only; no formal candidate signal, S4 implementation logic, migration, route, scheduler, production Runtime authority, or MCFT-CAP-09 authority.

import { types as pgTypes } from "pg";
import { DirectCap04ExecutionConfigResolverV1 } from "../../apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.js";
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

export async function establishCap08S3FormalPredecessorV1(root: string) {
  const fixture = buildCap08S2FormalProviderFixtureV1();
  const sourceManifest = computeCap08S3SourceManifestV1(root);
  const runtimeRepository = new PostgresRuntimeRepositoryV1(runner);
  const nextTickRepository = new PostgresNextTickRepositoryV1(runner);
  const forecastRepository = new PostgresForecastScenarioRecoveryRepositoryV1(runner);
  const binding = await nextTickRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot);
  if (binding.status !== "INSERTED") throw new Error("CAP08_S4_PREDECESSOR_REALITY_BINDING_INSERT_FAILED");
  for (const config of fixture.runtime_configs) {
    const committed = await runtimeRepository.commitRuntimeConfig(config);
    if (committed.status !== "INSERTED") throw new Error("CAP08_S4_PREDECESSOR_RUNTIME_CONFIG_INSERT_FAILED");
  }

  const persistence = persistenceAdapterV1(runtimeRepository, forecastRepository, []);
  const deferred = new Cap08DeferredScenarioPersistenceV1(persistence);
  const qualifiedEvidence = new Cap08S2QualifiedEvidenceSourceV1(fixture.formal_evidence_source);
  const frozenEvidence = new Cap08FrozenEvidenceSourceV1(qualifiedEvidence);
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
    sourceManifest.manifest_digest,
    new PostgresCap08S3CompletionAuthorityPairRepositoryV1(runner),
  );
  const runtime = new Cap08S3FormalRuntimeServiceV1(
    new A0BootstrapRuntimeServiceV1(runtimeRepository, runtimeRepository, fixture.bootstrap_evidence_source),
    range,
  );
  const input = {
    formal_run_id: fixture.formal_run_id,
    scope: fixture.scope,
    created_at: CAP08_S1_CREATED_AT_V1,
    bootstrap_runtime_config: fixture.bootstrap_runtime_config,
    bootstrap_hydraulic: fixture.hydraulic,
    soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
    runtime_config_refs_by_logical_time: fixture.runtime_config_refs_by_logical_time,
    runtime_config_hashes_by_logical_time: fixture.runtime_config_hashes_by_logical_time,
    authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
    crop_stage_context: fixture.crop_stage_context,
    lease_owner: "mcft-cap08-s4-predecessor-bootstrap",
    lease_duration_seconds: 300,
  };
  const first = await runtime.execute(input);
  if (first.status !== "COMPLETED"
    || first.range.executed_tick_count !== 24
    || first.range.completion_authority_pair_write_delta !== 2) {
    throw new Error("CAP08_S4_S3_PREDECESSOR_NOT_EXACT");
  }

  // From this point onward the acceptance suite needs exact PostgreSQL timestamp
  // text for corruption backup/restore. Delaying the parser switch preserves all
  // predecessor Runtime paths that require canonical ISO instants.
  pgTypes.setTypeParser(1184, (value: string): string => value);
  pgTypes.setTypeParser(1114, (value: string): string => value);

  return {
    fixture,
    source_manifest: sourceManifest,
    runtime,
    runtime_input: input,
    predecessor_result: first,
  };
}
