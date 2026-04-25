import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerRoiLedgerV1Routes } from "../../routes/roi_ledger_v1.js";

export function registerRoiLedgerModule(app: FastifyInstance, _pool: Pool): void {
  registerRoiLedgerV1Routes(app);
}
