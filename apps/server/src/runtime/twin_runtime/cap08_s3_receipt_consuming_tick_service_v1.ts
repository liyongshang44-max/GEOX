// Purpose: bind the bounded MCFT-CAP-08.S3 Tick assembly to the first-legal-Tick late Action Feedback policy while reusing the mature CAP-05 receipt-consuming service.
// Boundary: constructor specialization only; no new State, Forecast, Scenario, persistence, route, scheduler, approval, dispatch, or production Runtime authority.

import type { Cap04ExecutionConfigResolverPortV1 } from "../../domain/twin_runtime/runtime_config_execution_view_v1.js";
import {
  CAP08_S3_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
} from "./action_feedback_tick_selector_v1.js";
import type { Cap04SingleTickPersistencePortV1 } from "./forecast_scenario_single_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "./next_tick_input_service_v1.js";
import type { ReplayEvidenceSourcePortV1, RuntimeConfigRepositoryPortV1 } from "./ports.js";
import {
  Cap05ReceiptConsumingForecastScenarioTickServiceV1,
  type Cap05ActionFeedbackSourcePortV1,
} from "./receipt_consuming_forecast_scenario_tick_service_v1.js";

export class Cap08S3ReceiptConsumingForecastScenarioTickServiceV1
  extends Cap05ReceiptConsumingForecastScenarioTickServiceV1 {
  constructor(
    handoffService: PrepareNextTickInputServiceV1,
    baseEvidenceSource: ReplayEvidenceSourcePortV1,
    actionFeedbackSource: Cap05ActionFeedbackSourcePortV1,
    runtimeConfigRepository: RuntimeConfigRepositoryPortV1,
    persistence: Cap04SingleTickPersistencePortV1,
    executionConfigResolver: Cap04ExecutionConfigResolverPortV1,
  ) {
    super(
      handoffService,
      baseEvidenceSource,
      actionFeedbackSource,
      runtimeConfigRepository,
      persistence,
      executionConfigResolver,
      CAP08_S3_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
    );
  }
}
