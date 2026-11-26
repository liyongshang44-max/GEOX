import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { createManagerAuthorizerV1 } from "../../auth/manager_authority_v1.js";
import { registerManagerFieldCommandsV1 } from "../../routes/manager_field_commands_v1.js";
import { registerManagerSoilDocumentsV1 } from "../../routes/manager_soil_documents_v1.js";

import { registerManagerCropReviewsV1 } from "../../routes/manager_crop_reviews_v1.js";

import { registerManagerNativeReviewV1, type ManagerNativeReviewConfigV1 } from "../../routes/manager_native_review_v1.js";

export type ManagerPilotCompositionV1 = Parameters<typeof createManagerAuthorizerV1>[0] & { adrNativeReview?: ManagerNativeReviewConfigV1 };

// Trusted composition only. No environment switch or legacy credential fallback.
export function registerManagerPilotModuleV1(app: FastifyInstance, pool: Pool, config: ManagerPilotCompositionV1) {
  const authority = createManagerAuthorizerV1(config);
  registerManagerFieldCommandsV1(app, pool, authority);
  registerManagerSoilDocumentsV1(app, pool, authority);
  registerManagerCropReviewsV1(app, pool, authority);
  registerManagerNativeReviewV1(app, pool, authority, config.adrNativeReview);
  return authority;
}

