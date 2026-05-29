import { apiRequest } from "./client";

export type RuntimeEnvV1 = "development" | "test" | "pilot" | "staging" | "production";

export type RuntimeFeaturesResponseV1 = {
  ok: true;
  runtime_env: RuntimeEnvV1;
  features: {
    devtools_enabled: boolean;
    flight_table_enabled: boolean;
    operator_enabled: boolean;
    customer_pages_enabled: boolean;
  };
};

export async function fetchRuntimeFeatures(): Promise<RuntimeFeaturesResponseV1> {
  return apiRequest<RuntimeFeaturesResponseV1>("/api/v1/runtime/features");
}
