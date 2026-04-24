import type { FastifyInstance } from "fastify";

import { registerOpenApiV1Routes } from "../../routes/openapi_v1.js";

export function registerOpenApiModule(app: FastifyInstance): void {
  registerOpenApiV1Routes(app);
}
