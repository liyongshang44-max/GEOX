// Purpose: assemble the graph-conformant V2 controlled profile into exact resolved S5 Candidate inputs for domain and PostgreSQL acceptance.
// Boundary: deterministic acceptance fixture composition only; no production database, canonical append, Shadow Evaluation, Model Activation, Runtime authority, State/checkpoint mutation, route or scheduler.

import { assembleResolvedForecastObservationCaseV1 } from "../../apps/server/src/domain/twin_runtime/resolved_forecast_observation_case_v1.js";
import { Cap04OrCap05ExecutionConfigResolverV1 } from "../../apps/server/src/runtime/twin_runtime/cap04_or_cap05_execution_config_resolver_v1.js";
import {
  CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  CAP06_HOLDOUT_PURPOSE_V1,
  CAP06_WINDOW_HASH_SEMANTICS_V1,
  type Cap06SourceDatasetIdentityV1,
} from "../../apps/server/src/domain/calibration/contracts_v1.js";
import {
  buildCap06S5GraphConformantDatasetV2,
  type Cap06S5GraphConformantDatasetV2,
} from "./mcft_cap_06_s5_graph_conformant_fixture_v2.js";

export async function buildCap06S5CandidateFixtureV1(): Promise<{
  dataset: Cap06S5GraphConformantDatasetV2;
  resolved: ReturnType<typeof assembleResolvedForecastObservationCaseV1>[];
  source_dataset_identity: Cap06SourceDatasetIdentityV1;
}> {
  const dataset = await buildCap06S5GraphConformantDatasetV2();
  const resolver = new Cap04OrCap05ExecutionConfigResolverV1();
  const resolved = dataset.cases.map((item) => assembleResolvedForecastObservationCaseV1({
    case_index: item.case_index,
    residual: item.residual,
    source_forecast: item.source_forecast,
    source_posterior: item.source_state,
    source_forecast_evidence_window: item.source_evidence_window,
    source_runtime_config: item.source_runtime_config,
    resolved_execution_config: resolver.resolveExecutionConfig(item.source_runtime_config),
    residual_runtime_config: item.source_runtime_config,
    resolved_residual_execution_config: resolver.resolveExecutionConfig(item.source_runtime_config),
    actual_observation: item.observation_record,
    assimilation_update: item.assimilation_update,
    observation_posterior: item.observation_posterior,
    observation_evidence_window: item.observation_evidence_window,
  }));
  return {
    dataset,
    resolved,
    source_dataset_identity: {
      residual_set_hash: dataset.residual_set_hash,
      case_input_set_hash: dataset.case_input_set_hash,
      calibration_window_hash: dataset.calibration_window_hash,
      holdout_window_hash: dataset.holdout_window_hash,
      window_hash_semantics: CAP06_WINDOW_HASH_SEMANTICS_V1,
      holdout_purpose: CAP06_HOLDOUT_PURPOSE_V1,
      holdout_generalization_claim: CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
    },
  };
}
