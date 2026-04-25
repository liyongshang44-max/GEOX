import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

export function registerAsExecutedV1Routes(app: FastifyInstance, _pool: Pool): void {
  app.get("/api/v1/as-executed/health", async () => ({
    ok: true,
    module: "as_executed_v1",
  }));
}
