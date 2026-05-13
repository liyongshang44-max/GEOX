import { createApp } from "../app.js";
import { resolveServerConfig } from "../config/index.js";
import { runSqlMigrations } from "../infra/migrations.js";
import { ensureRuntimeDirectories, resolveRuntimePaths } from "../infra/runtimePaths.js";
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

  await runSqlMigrations(pool);
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
    app.log.error(err);
    await pool.end();
    process.exit(1);
  }
}
