import { createRequire } from "node:module";

import type { FastifyInstance } from "fastify";

const require = createRequire(import.meta.url);

type RegisterJudgeModuleOptions = {
  databaseUrl: string;
  systemProfile: string;
  disableAppleII: boolean;
};

export function registerJudgeModule(app: FastifyInstance, options: RegisterJudgeModuleOptions): void {
  if (options.systemProfile === "commercial_v0" && options.disableAppleII) {
    throw new Error("Apple II is required in commercial_v0 profile; refusing to start with GEOX_DISABLE_APPLE_II=1");
  }

  if (options.disableAppleII) {
    // eslint-disable-next-line no-console
    console.warn("[WARN] Apple II disabled (GEOX_DISABLE_APPLE_II=1). Judge routes/runtime not initialized.");
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AppleIReader } = require("../../../../judge/src/applei_reader");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { JudgeRuntime } = require("../../../../judge/src/runtime");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerJudgeRoutes } = require("../../routes/judge");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerJudgeConfigRoutes } = require("../../routes/judge_config");

  const judgeReader = new AppleIReader(options.databaseUrl);
  const judgeRuntime = new JudgeRuntime(judgeReader);

  registerJudgeRoutes(app, judgeRuntime);
  registerJudgeConfigRoutes(app);
}
