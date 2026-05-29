export type GeoxRuntimeEnvV1 = "development" | "test" | "pilot" | "staging" | "production";

const WEAK = new Set([
  "postgres",
  "password",
  "example",
  "dev",
  "admin",
  "minioadmin",
  "changeme",
  "set-via-env",
  "set-via-env-or-external-secret-file",
  "landos_pwd",
  "landos",
]);

function isPlaceholderSecretV1(value: string): boolean {
  const lower = String(value ?? "").trim().toLowerCase();
  if (!lower) return true;
  if (/^<[^>]+>$/.test(lower)) return true;
  return [
    "strong-random",
    "placeholder",
    "replace",
    "set-via",
    "secret-manager",
    "todo",
    "fixme",
    "sample",
    "demo",
  ].some((x) => lower.includes(x));
}

function envValue(...keys: string[]): string {
  for (const key of keys) {
    const value = String(process.env[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function isWeak(v: string): boolean {
  const value = String(v ?? "").trim();
  if (!value) return true;
  const lower = value.toLowerCase();
  if (WEAK.has(lower)) return true;
  if (isPlaceholderSecretV1(value)) return true;
  if (lower.includes("changeme") || lower.includes("example") || lower.includes("default")) return true;
  return value.length < 12;
}

function boolEnv(key: string): boolean {
  return ["1", "true", "yes", "on"].includes(String(process.env[key] ?? "").trim().toLowerCase());
}

export function isRuntimeDevtoolsEnabledV1(): boolean {
  return boolEnv("GEOX_DEVTOOLS_ENABLED") || boolEnv("DEVTOOLS_ENABLED") || boolEnv("GEOX_ENABLE_DEVTOOLS");
}

export function getRuntimeEnvV1(): GeoxRuntimeEnvV1 {
  const explicit = String(process.env.GEOX_RUNTIME_ENV ?? "").trim().toLowerCase();
  if (["development", "test", "pilot", "staging", "production"].includes(explicit)) return explicit as GeoxRuntimeEnvV1;
  if (String(process.env.NODE_ENV ?? "").trim().toLowerCase() === "production") return "production";
  const profile = String(process.env.GEOX_SYSTEM_PROFILE ?? "").toLowerCase();
  if (/(pilot|controlled-pilot)/.test(profile)) return "pilot";
  if (/(commercial|prod|staging)/.test(profile)) return "staging";
  return "development";
}

export function isProductionLikeRuntimeV1(): boolean {
  const e = getRuntimeEnvV1();
  return e === "production" || e === "staging" || e === "pilot";
}

export function getRuntimeSecurityStatusV1() {
  const runtimeEnv = getRuntimeEnvV1();
  const productionLike = isProductionLikeRuntimeV1();
  const checks: Record<string, boolean> = {};
  const errors: string[] = [];

  checks.runtime_env_pilot_or_production = runtimeEnv === "pilot" || runtimeEnv === "production";
  if (productionLike && !checks.runtime_env_pilot_or_production) errors.push("RUNTIME_ENV_MUST_BE_PILOT_OR_PRODUCTION");

  const tokenStructured = Boolean(envValue("GEOX_TOKENS_JSON", "GEOX_TOKENS_FILE", "GEOX_TOKEN_SSOT_PATH"));
  const singleToken = Boolean(envValue("GEOX_TOKEN", "GEOX_AO_ACT_TOKEN", "AO_ACT_TOKEN"));
  checks.token_source_configured = tokenStructured;
  if (productionLike && !tokenStructured) errors.push("RUNTIME_TOKEN_SOURCE_REQUIRED");
  checks.single_token_fallback_disabled = !singleToken;
  if (productionLike && singleToken) errors.push("RUNTIME_SINGLE_TOKEN_FALLBACK_FORBIDDEN");

  const tokenPath = envValue("GEOX_TOKENS_FILE", "GEOX_TOKEN_SSOT_PATH");
  checks.example_token_forbidden = !tokenPath.includes("example_tokens.json");
  if (productionLike && !checks.example_token_forbidden) errors.push("RUNTIME_EXAMPLE_TOKEN_FORBIDDEN");

  const origins = envValue("CORS_ORIGINS", "GEOX_ALLOWED_ORIGINS");
  checks.cors_origins_configured = Boolean(origins);
  if (productionLike && !origins) errors.push("RUNTIME_CORS_ORIGINS_REQUIRED");
  checks.cors_wildcard_forbidden = origins !== "*";
  if (productionLike && origins === "*") errors.push("RUNTIME_CORS_WILDCARD_FORBIDDEN");

  checks.postgres_password_strong = !isWeak(envValue("POSTGRES_PASSWORD", "PGPASSWORD"));
  if (productionLike && !checks.postgres_password_strong) errors.push("RUNTIME_POSTGRES_PASSWORD_WEAK");

  checks.minio_password_strong = !isWeak(envValue("MINIO_ROOT_PASSWORD", "GEOX_EVIDENCE_S3_SECRET_ACCESS_KEY"));
  if (productionLike && !checks.minio_password_strong) errors.push("RUNTIME_MINIO_PASSWORD_WEAK");

  const mqttAuthRequired = boolEnv("MQTT_AUTH_REQUIRED") || boolEnv("GEOX_MQTT_AUTH_REQUIRED");
  const mqttPassword = envValue("MQTT_PASSWORD", "GEOX_MQTT_PASSWORD");
  checks.mqtt_auth_enabled = mqttAuthRequired && !isWeak(mqttPassword);
  if (productionLike && !checks.mqtt_auth_enabled) errors.push("RUNTIME_MQTT_AUTH_REQUIRED");

  const executionExplicit = boolEnv("GEOX_EXECUTION_ENABLE_EXPLICITLY") || boolEnv("GEOX_EXECUTION_ENABLED");
  const executionReason = Boolean(envValue("GEOX_EXECUTION_ENABLE_REASON"));
  checks.execution_enable_reason_present = !executionExplicit || executionReason;
  if (productionLike && !checks.execution_enable_reason_present) errors.push("RUNTIME_EXECUTION_ENABLE_REASON_REQUIRED");
  checks.execution_enabled_explicitly = executionExplicit;
  checks.execution_default_disabled = boolEnv("GEOX_EXECUTION_DEFAULT_DISABLED") || executionExplicit;
  if (productionLike && !checks.execution_default_disabled) errors.push("RUNTIME_EXECUTION_DEFAULT_DISABLED_OR_EXPLICIT_REQUIRED");

  const appSecret = envValue("APP_SECRET", "GEOX_SECRET_KEY", "GEOX_APP_SECRET", "GEOX_APP_SECRET_FILE");
  checks.app_secret_configured = !isWeak(appSecret);
  if (productionLike && !checks.app_secret_configured) errors.push("RUNTIME_APP_SECRET_REQUIRED");

  const publicBase = envValue("PUBLIC_BASE_URL", "GEOX_PUBLIC_BASE_URL").toLowerCase();
  checks.public_base_url_configured = Boolean(publicBase) && !publicBase.includes("localhost") && !publicBase.includes("127.0.0.1");
  if (productionLike && !checks.public_base_url_configured) errors.push("RUNTIME_PUBLIC_BASE_URL_REQUIRED");

  const devtoolsEnabled = isRuntimeDevtoolsEnabledV1();
  checks.devtools_disabled = !devtoolsEnabled;
  if (productionLike && devtoolsEnabled) errors.push("RUNTIME_DEVTOOLS_FORBIDDEN");

  return { ok: errors.length === 0, runtime_env: runtimeEnv, checks, errors };
}

export function assertRuntimeSecurityV1() {
  const st = getRuntimeSecurityStatusV1();
  if (!st.ok) throw new Error(`RUNTIME_SECURITY_CHECK_FAILED:${st.errors.join(",")}`);
  return { ok: true as const, runtime_env: st.runtime_env, checks: st.checks };
}
