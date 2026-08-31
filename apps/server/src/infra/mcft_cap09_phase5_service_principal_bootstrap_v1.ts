// Phase5 one-shot service-principal bootstrap entry.
// Passwords are deployment inputs; no schema/business/runtime mutation beyond role wiring.

import {
  bootstrapMcftCap09Phase5ServicePrincipalsV1,
} from "./mcft_cap09_phase5_service_principal_provisioning_v1.js";

function requiredEnvV1(name: string): string {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`PHASE5_SERVICE_PRINCIPAL_ENV_REQUIRED:${name}`);
  return value;
}

export async function runMcftCap09Phase5ServicePrincipalBootstrapFromEnvironmentV1(): Promise<void> {
  const result = await bootstrapMcftCap09Phase5ServicePrincipalsV1({
    admin_database_url: requiredEnvV1("GEOX_DB_PLATFORM_ADMIN_DATABASE_URL"),
    expected_database_name: requiredEnvV1("GEOX_MCFT_CAP09_PHASE5_DATABASE_NAME"),
    evidence_runtime_password: requiredEnvV1(
      "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_PASSWORD",
    ),
    twin_runtime_password: requiredEnvV1(
      "GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_PASSWORD",
    ),
  });
  process.stdout.write(`${JSON.stringify({
    bootstrap: "MCFT_CAP09_PHASE5_SERVICE_PRINCIPALS",
    ...result,
  })}\n`);
}
