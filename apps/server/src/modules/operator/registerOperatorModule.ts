import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerOperatorDiagnosticsV1Routes } from "../../routes/operator_diagnostics_v1.js";

export function registerOperatorModule(app: FastifyInstance, pool: Pool): void {
  registerOperatorDiagnosticsV1Routes(app, pool);
}
