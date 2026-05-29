import type { FastifyInstance } from "fastify";

import {
  getRuntimeEnvV1,
  getRuntimeSecurityStatusV1,
  isRuntimeDevtoolsEnabledV1,
} from "../../runtime/runtime_security_v1.js";

const RUNTIME_FEATURES_PATH_V1 = "/api/v1/runtime/features";

export type RuntimeFeaturesResponseV1 = {
  ok: true;
  runtime_env: ReturnType<typeof getRuntimeEnvV1>;
  runtime_security: ReturnType<typeof getRuntimeSecurityStatusV1>;
  features: {
    devtools_enabled: boolean;
    flight_table_enabled: boolean;
    operator_enabled: boolean;
    customer_pages_enabled: boolean;
  };
};

export function buildRuntimeFeaturesV1(): RuntimeFeaturesResponseV1 {
  const runtimeSecurity = getRuntimeSecurityStatusV1();
  const devtoolsEnabled = isRuntimeDevtoolsEnabledV1();
  return {
    ok: true,
    runtime_env: runtimeSecurity.runtime_env,
    runtime_security: runtimeSecurity,
    features: {
      devtools_enabled: devtoolsEnabled,
      flight_table_enabled: devtoolsEnabled,
      operator_enabled: true,
      customer_pages_enabled: true,
    },
  };
}

export function registerRuntimeFeaturesV1Routes(app: FastifyInstance): void {
  app.get(RUNTIME_FEATURES_PATH_V1, async () => buildRuntimeFeaturesV1());
}
