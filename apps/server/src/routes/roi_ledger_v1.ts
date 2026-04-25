import type { FastifyInstance } from "fastify";

export function registerRoiLedgerV1Routes(app: FastifyInstance): void {
  app.get("/api/v1/roi-ledger/health", async () => ({
    ok: true,
    module: "roi_ledger_v1",
  }));
}
