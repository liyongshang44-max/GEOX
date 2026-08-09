// MCFT-CAP-09 S6-EA5C2A Formal durable raw-store binding contract.
// Boundary: collector-side configuration only. This module never fetches providers,
// never writes facts, never exposes credentials, and never permits a local/CI fallback.

import crypto from "node:crypto";

import {
  MCFT_CAP09_FORMAL_RAW_RETENTION_ADAPTER_ID_V1,
  MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1,
  S3CompatiblePrivateRawEvidenceRetentionAdapterV1,
  type S3CompatiblePrivateRawRetentionConfigV1,
} from "./s3_compatible_raw_evidence_retention_adapter_v1.js";

export const MCFT_CAP09_FORMAL_RAW_BUCKET_V1 = "geox-mcft-cap09-formal-raw-v1" as const;
export const MCFT_CAP09_FORMAL_RAW_BINDING_ID_V1 = "MCFT_CAP09_FORMAL_DURABLE_RAW_STORE_BINDING_V1" as const;

export const MCFT_CAP09_FORMAL_RAW_ENV_V1 = {
  endpoint: "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT",
  bucket: "GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET",
  region: "GEOX_MCFT_CAP09_FORMAL_RAW_S3_REGION",
  access_key_id: "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
  secret_access_key: "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY",
} as const;

type EnvironmentV1 = Record<string, string | undefined>;

export type FormalDurableRawStorePublicDescriptorV1 = {
  binding_id: typeof MCFT_CAP09_FORMAL_RAW_BINDING_ID_V1;
  adapter_id: typeof MCFT_CAP09_FORMAL_RAW_RETENTION_ADAPTER_ID_V1;
  endpoint_origin: string;
  bucket: typeof MCFT_CAP09_FORMAL_RAW_BUCKET_V1;
  region: string;
  object_prefix: typeof MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1;
  retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE";
  credential_source: "PROCESS_ENVIRONMENT_SECRET_BINDING";
  local_or_ci_fallback_allowed: false;
  public_or_presigned_access_allowed: false;
  binding_fingerprint_sha256: string;
};

export type FormalDurableRawStoreBindingV1 = {
  public_descriptor: FormalDurableRawStorePublicDescriptorV1;
  adapter_config: S3CompatiblePrivateRawRetentionConfigV1;
};

function requiredEnvV1(env: EnvironmentV1, key: string): string {
  const value = env[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`EA5C2A_FORMAL_RAW_ENV_REQUIRED:${key}`);
  return value.trim();
}

function sha256JsonV1(value: unknown): string {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function assertRemoteHttpsEndpointV1(raw: string): URL {
  let endpoint: URL;
  try {
    endpoint = new URL(raw);
  } catch {
    throw new Error("EA5C2A_FORMAL_RAW_ENDPOINT_INVALID");
  }
  if (endpoint.protocol !== "https:") throw new Error("EA5C2A_FORMAL_RAW_HTTPS_REQUIRED");
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("EA5C2A_FORMAL_RAW_ENDPOINT_CREDENTIAL_QUERY_OR_FRAGMENT_FORBIDDEN");
  }
  if (endpoint.pathname !== "/") throw new Error("EA5C2A_FORMAL_RAW_ENDPOINT_PATH_FORBIDDEN");
  const host = endpoint.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) {
    throw new Error("EA5C2A_FORMAL_RAW_LOCAL_ENDPOINT_FORBIDDEN");
  }
  return endpoint;
}

function assertCredentialNotKnownCiDefaultV1(accessKey: string, secretKey: string): void {
  if (accessKey === "minioadmin" || secretKey === "minioadmin123") {
    throw new Error("EA5C2A_FORMAL_RAW_CI_CREDENTIAL_FORBIDDEN");
  }
}

export function loadFormalDurableRawStoreBindingV1(env: EnvironmentV1 = process.env): FormalDurableRawStoreBindingV1 {
  const endpoint = assertRemoteHttpsEndpointV1(requiredEnvV1(env, MCFT_CAP09_FORMAL_RAW_ENV_V1.endpoint));
  const bucket = requiredEnvV1(env, MCFT_CAP09_FORMAL_RAW_ENV_V1.bucket);
  if (bucket !== MCFT_CAP09_FORMAL_RAW_BUCKET_V1) throw new Error("EA5C2A_FORMAL_RAW_BUCKET_AUTHORITY_MISMATCH");
  const region = requiredEnvV1(env, MCFT_CAP09_FORMAL_RAW_ENV_V1.region);
  const accessKeyId = requiredEnvV1(env, MCFT_CAP09_FORMAL_RAW_ENV_V1.access_key_id);
  const secretAccessKey = requiredEnvV1(env, MCFT_CAP09_FORMAL_RAW_ENV_V1.secret_access_key);
  assertCredentialNotKnownCiDefaultV1(accessKeyId, secretAccessKey);

  const fingerprintInput = {
    binding_id: MCFT_CAP09_FORMAL_RAW_BINDING_ID_V1,
    adapter_id: MCFT_CAP09_FORMAL_RAW_RETENTION_ADAPTER_ID_V1,
    endpoint_origin: endpoint.origin,
    bucket: MCFT_CAP09_FORMAL_RAW_BUCKET_V1,
    region,
    object_prefix: MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1,
    retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
  } as const;

  return {
    public_descriptor: {
      ...fingerprintInput,
      credential_source: "PROCESS_ENVIRONMENT_SECRET_BINDING",
      local_or_ci_fallback_allowed: false,
      public_or_presigned_access_allowed: false,
      binding_fingerprint_sha256: sha256JsonV1(fingerprintInput),
    },
    adapter_config: {
      endpoint: endpoint.origin,
      bucket: MCFT_CAP09_FORMAL_RAW_BUCKET_V1,
      region,
      access_key_id: accessKeyId,
      secret_access_key: secretAccessKey,
    },
  };
}

export function createFormalDurableRawEvidenceRetentionAdapterV1(
  env: EnvironmentV1 = process.env,
): { descriptor: FormalDurableRawStorePublicDescriptorV1; adapter: S3CompatiblePrivateRawEvidenceRetentionAdapterV1 } {
  const binding = loadFormalDurableRawStoreBindingV1(env);
  return {
    descriptor: binding.public_descriptor,
    adapter: new S3CompatiblePrivateRawEvidenceRetentionAdapterV1(binding.adapter_config),
  };
}
