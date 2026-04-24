import { createApp, runStartupMigrations, startBackgroundWorkers } from "../app.js";
import { resolveServerConfig } from "../config/index.js";

export async function startServer(): Promise<void> {
  const config = resolveServerConfig();
  const { app, pool } = createApp();

  await runStartupMigrations(pool);
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
