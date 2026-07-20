// apps/server/src/bootstrap/server.ts
// Purpose: bootstrap the Fastify Runtime only after security checks and the read-only MCFT-CAP-07 visibility, device-status, Skill Registry, and field-fertility compatibility preflights pass.
// Boundary: the long-running Runtime process never executes SQL migrations, reads migration credentials, performs DDL, or assumes migration authority.

import { createApp } from "../app.js";
import { resolveServerConfig } from "../config/index.js";
import { ensureRuntimeDirectories, resolveRuntimePaths } from "../infra/runtimePaths.js";
import { runMcftCap07RuntimeStartupPreflightV1 } from "../infra/mcft_cap07_runtime_startup_preflight_v1.js";
import { assertRuntimeDeviceStatusCompatibilityV1 } from "../infra/runtime_device_status_compatibility_bootstrap_v1.js";
import { assertRuntimeSkillRegistryCompatibilityV1 } from "../infra/runtime_skill_registry_compatibility_bootstrap_v1.js";
import { assertRuntimeFieldFertilityCompatibilityV1 } from "../infra/runtime_field_fertility_compatibility_bootstrap_v1.js";
import { startBackgroundWorkers } from "./workers.js";
import { getRuntimeSecurityStatusV1, isProductionLikeRuntimeV1 } from "../runtime/runtime_security_v1.js";

export async function startServer(): Promise<void> {
  const runtimeStatus = getRuntimeSecurityStatusV1();
  if (!runtimeStatus.ok && isProductionLikeRuntimeV1()) {
    throw new Error(`RUNTIME_SECURITY_CHECK_FAILED:${runtimeStatus.errors.join(",")}`);
  }
  const config = resolveServerConfig();
  const paths = resolveRuntimePaths();
  ensureRuntimeDirectories(paths);

  const { app, pool } = createApp({ config, paths });

  try {
    await assertRuntimeDeviceStatusCompatibilityV1(pool);
    await assertRuntimeSkillRegistryCompatibilityV1(pool);
    await assertRuntimeFieldFertilityCompatibilityV1(pool);
    const visibilityPreflight = await runMcftCap07RuntimeStartupPreflightV1(pool);
    app.log.info(
      {
        device_status_compatibility: "PASS",
        skill_registry_compatibility: "PASS",
        field_fertility_compatibility: "PASS",
        visibility_preflight: visibilityPreflight,
      },
      "mcft_cap07_runtime_startup_preflight_completed",
    );
  } catch (error) {
    app.log.error({ err: error }, "mcft_cap07_runtime_startup_preflight_failed");
    await pool.end();
    throw error;
  }

  startBackgroundWorkers(pool);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error(err, "server_listen_failed");
    await pool.end();
    process.exit(1);
  }
}
