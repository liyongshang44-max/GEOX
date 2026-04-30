export type GeoxRuntimeEnvV1 = "development" | "test" | "staging" | "production";
const WEAK = new Set(["postgres","password","example","dev","admin","minioadmin","changeme","set-via-env","set-via-env-or-external-secret-file"]);

export function getRuntimeEnvV1(): GeoxRuntimeEnvV1 {
  const explicit = String(process.env.GEOX_RUNTIME_ENV ?? "").trim().toLowerCase();
  if (["development","test","staging","production"].includes(explicit)) return explicit as GeoxRuntimeEnvV1;
  if (String(process.env.NODE_ENV ?? "").trim().toLowerCase() === "production") return "production";
  const profile = String(process.env.GEOX_SYSTEM_PROFILE ?? "").toLowerCase();
  if (/(commercial|prod|staging)/.test(profile)) return "staging";
  return "development";
}
export function isProductionLikeRuntimeV1(): boolean { const e=getRuntimeEnvV1(); return e==="production"||e==="staging"; }

function isWeak(v: string): boolean { return !v || WEAK.has(v.trim().toLowerCase()); }
export function getRuntimeSecurityStatusV1(){
  const productionLike = isProductionLikeRuntimeV1();
  const checks: Record<string, boolean> = {};
  const errors: string[] = [];
  const tokenStructured = Boolean(String(process.env.GEOX_TOKENS_JSON??"").trim()||String(process.env.GEOX_TOKENS_FILE??process.env.GEOX_TOKEN_SSOT_PATH??"").trim());
  const singleToken = Boolean(String(process.env.GEOX_TOKEN??process.env.GEOX_AO_ACT_TOKEN??process.env.AO_ACT_TOKEN??"").trim());
  checks.token_source_configured = tokenStructured;
  if (productionLike && !tokenStructured) errors.push("RUNTIME_TOKEN_SOURCE_REQUIRED");
  checks.single_token_fallback_disabled = !singleToken;
  if (productionLike && singleToken) errors.push("RUNTIME_SINGLE_TOKEN_FALLBACK_FORBIDDEN");
  const tokenPath = String(process.env.GEOX_TOKENS_FILE??process.env.GEOX_TOKEN_SSOT_PATH??"");
  checks.example_token_forbidden = !tokenPath.includes("example_tokens.json");
  if (productionLike && !checks.example_token_forbidden) errors.push("RUNTIME_EXAMPLE_TOKEN_FORBIDDEN");
  const origins = String(process.env.GEOX_ALLOWED_ORIGINS??"").trim();
  checks.cors_origins_configured = Boolean(origins);
  if (productionLike && !origins) errors.push("RUNTIME_CORS_ORIGINS_REQUIRED");
  checks.cors_wildcard_forbidden = origins !== "*";
  if (productionLike && origins === "*") errors.push("RUNTIME_CORS_WILDCARD_FORBIDDEN");
  checks.postgres_password_strong = !isWeak(String(process.env.POSTGRES_PASSWORD??""));
  if (productionLike && !checks.postgres_password_strong) errors.push("RUNTIME_POSTGRES_PASSWORD_WEAK");
  checks.minio_password_strong = !isWeak(String(process.env.MINIO_ROOT_PASSWORD??""));
  if (productionLike && !checks.minio_password_strong) errors.push("RUNTIME_MINIO_PASSWORD_WEAK");
  checks.mqtt_password_required = String(process.env.MQTT_AUTH_REQUIRED??"0")!=="1" || Boolean(String(process.env.MQTT_PASSWORD??"").trim());
  if (productionLike && !checks.mqtt_password_required) errors.push("RUNTIME_MQTT_PASSWORD_REQUIRED");
  const execDisabled = String(process.env.GEOX_EXECUTION_DEFAULT_DISABLED??"") === "1";
  const execExplicit = String(process.env.GEOX_EXECUTION_ENABLE_EXPLICITLY??"") === "1";
  const execReason = Boolean(String(process.env.GEOX_EXECUTION_ENABLE_REASON??"").trim());
  checks.execution_default_disabled = execDisabled || (execExplicit && execReason);
  if (productionLike && !checks.execution_default_disabled) errors.push("RUNTIME_EXECUTION_DEFAULT_DISABLED_REQUIRED");
  checks.execution_enabled_explicitly = execExplicit;
  checks.execution_enable_reason_present = execReason;
  checks.app_secret_configured = Boolean(String(process.env.GEOX_SECRET_KEY??process.env.GEOX_APP_SECRET??"").trim() || String(process.env.GEOX_APP_SECRET_FILE??"").trim());
  if (productionLike && !checks.app_secret_configured) errors.push("RUNTIME_APP_SECRET_REQUIRED");
  const base = String(process.env.GEOX_PUBLIC_BASE_URL??"").trim().toLowerCase();
  checks.public_base_url_configured = Boolean(base) && !base.includes("localhost") && !base.includes("127.0.0.1");
  if (productionLike && !checks.public_base_url_configured) errors.push("RUNTIME_PUBLIC_BASE_URL_REQUIRED");
  return { ok: errors.length===0, runtime_env: getRuntimeEnvV1(), checks, errors };
}
export function assertRuntimeSecurityV1(){ const st=getRuntimeSecurityStatusV1(); if(!st.ok) throw new Error(`RUNTIME_SECURITY_CHECK_FAILED:${st.errors.join(',')}`); return {ok:true as const,runtime_env:st.runtime_env,checks:st.checks}; }
