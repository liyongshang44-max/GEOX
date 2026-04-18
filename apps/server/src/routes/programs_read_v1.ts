import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerProgramsCoreV1Routes } from "./programs_core_v1.js";

// Governance boundary:
// - Program 是策略/编排容器域，不是 execution 主链。
// - 不得以 program detail 替代 `/api/v1/operations/:id/detail`。
// - 与 execution 相关的新读取必须优先接入 operation_state 主链 read model。
export function registerProgramsReadV1Routes(app: FastifyInstance, pool: Pool): void {
  registerProgramsCoreV1Routes(app, pool, { read: true, write: false });
}
