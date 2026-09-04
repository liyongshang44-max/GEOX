import { prepareInternalTaskIssuerPrincipalV1 } from "./auth/internal_task_issuer_principal_v1.js";
import { startServer } from "./bootstrap/server.js";

const runtimeEnv = String(process.env.GEOX_RUNTIME_ENV ?? "development").trim().toLowerCase();
if (["pilot", "controlled-pilot", "controlled_pilot", "commercial", "staging", "production"].includes(runtimeEnv)) {
  prepareInternalTaskIssuerPrincipalV1();
}

await startServer();
