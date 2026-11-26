import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerProductV1Routes } from "../../routes/product_v1.js";

import { createManagerAuthorizerV1 } from "../../auth/manager_authority_v1.js";
import { registerManagerFieldCommandsV1 } from "../../routes/manager_field_commands_v1.js";
import { registerManagerSoilDocumentsV1 } from "../../routes/manager_soil_documents_v1.js";

export type ManagerProductCompositionV1 = Parameters<typeof createManagerAuthorizerV1>[0];

// Trusted composition only. No environment switch or legacy credential fallback.
export function registerManagerProductModuleV1(app: FastifyInstance, pool: Pool, config: ManagerProductCompositionV1) {
  const authority = createManagerAuthorizerV1(config);
  registerManagerFieldCommandsV1(app, pool, authority);
  registerManagerSoilDocumentsV1(app, pool, authority);
  return authority;
}

export function registerProductModule(app: FastifyInstance, pool: Pool, manager?: ManagerProductCompositionV1): void {
  registerProductV1Routes(app, pool);
  if (manager !== undefined) registerManagerProductModuleV1(app, pool, manager);
}
