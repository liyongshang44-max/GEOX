import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { createManagerAuthorizerV1 } from "../../auth/manager_authority_v1.js";
import { registerManagerFieldCommandsV1 } from "../../routes/manager_field_commands_v1.js";
import { registerManagerSoilDocumentsV1 } from "../../routes/manager_soil_documents_v1.js";

import { registerManagerCropReviewsV1 } from "../../routes/manager_crop_reviews_v1.js";

import { registerManagerNativeReviewV1, type ManagerNativeReviewConfigV1 } from "../../routes/manager_native_review_v1.js";

import { registerManagerContextFollowupV1 } from '../../routes/manager_context_followup_v1.js';

import { registerManagerLandInventoryV1 } from '../../routes/manager_land_inventory_v1.js';

import { registerManagerScientificResultV1 } from '../../routes/manager_scientific_result_v1.js';
import type { ScientificResultDisplayResolverV1 } from '../../product_projection/customer/manager_scientific_result_v1.js';
import { registerManagerObservationHistoryV1, type ManagerObservationHistoryConfigV1 } from '../../routes/manager_observation_history_v1.js';

import { registerManagerHistoricalForecastV1 } from '../../routes/manager_historical_forecast_v1.js';
import type { HistoricalForecastConfigV1 } from '../../product_projection/customer/manager_historical_forecast_v1.js';

export type ManagerPilotCompositionV1 = Parameters<typeof createManagerAuthorizerV1>[0] & { adrNativeReview?: ManagerNativeReviewConfigV1; resolveScientificResultDisplay?: ScientificResultDisplayResolverV1; observationHistory?: ManagerObservationHistoryConfigV1; historicalForecast?: HistoricalForecastConfigV1 };

// Trusted composition only. No environment switch or legacy credential fallback.
export function registerManagerPilotModuleV1(app: FastifyInstance, pool: Pool, config: ManagerPilotCompositionV1) {
  const authority = createManagerAuthorizerV1(config);
  registerManagerFieldCommandsV1(app, pool, authority);
  registerManagerLandInventoryV1(app, pool, authority);
  registerManagerSoilDocumentsV1(app, pool, authority);
  registerManagerCropReviewsV1(app, pool, authority);
  registerManagerNativeReviewV1(app, pool, authority, config.adrNativeReview);
  registerManagerContextFollowupV1(app, pool, authority);
  registerManagerScientificResultV1(app, pool, authority, config.resolveScientificResultDisplay);
  registerManagerObservationHistoryV1(app, pool, authority, config.observationHistory);
  registerManagerHistoricalForecastV1(app, authority, config.historicalForecast);
  return authority;
}

