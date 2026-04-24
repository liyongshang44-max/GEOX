import Fastify, { type FastifyInstance } from "fastify";
import type { Pool } from "pg";

import type { ServerConfig } from "./config/index.js";
import { createDatabasePool } from "./infra/database.js";
import type { RuntimePaths } from "./infra/runtimePaths.js";
import { registerCoreModule } from "./modules/core/registerCoreModule.js";
import { registerJudgeModule } from "./modules/judge/registerJudgeModule.js";
import { registerStaticModule } from "./modules/static/registerStaticModule.js";
import { registerOpenApiModule } from "./modules/openapi/registerOpenApiModule.js";
import { registerDomainModules } from "./modules/domain/registerDomainModules.js";
import { registerCompatibilityModules } from "./modules/compat/registerCompatibilityModules.js";
import { registerAdminModule } from "./modules/admin/registerAdminModule.js";

type CreateAppOptions = {
  config: ServerConfig;
  paths: RuntimePaths;
};

export function createApp(options: CreateAppOptions): { app: FastifyInstance; pool: Pool } {
  const { config, paths } = options;

  const pool = createDatabasePool(config.databaseUrl);
  const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 });

  registerCoreModule(app);
  registerJudgeModule(app, {
    databaseUrl: config.databaseUrl,
    systemProfile: config.systemProfile,
    disableAppleII: config.disableAppleII,
  });

  registerStaticModule(app, {
    mediaDir: paths.mediaDir,
    acceptanceDir: paths.acceptanceDir,
    tenantHeaders: config.tenantHeaders,
    apiContractHeaders: config.apiContractHeaders,
  });

  registerDomainModules(app, pool, { mediaDir: paths.mediaDir });
  registerCompatibilityModules(app, pool, { mediaDir: paths.mediaDir });
  registerOpenApiModule(app);
  registerAdminModule(app, pool);

  return { app, pool };
}
