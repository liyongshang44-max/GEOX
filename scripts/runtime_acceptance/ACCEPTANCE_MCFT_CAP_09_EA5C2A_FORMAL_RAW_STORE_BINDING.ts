import assert from "node:assert/strict";
import fs from "node:fs";

import {
  MCFT_CAP09_FORMAL_RAW_BINDING_ID_V1,
  MCFT_CAP09_FORMAL_RAW_BUCKET_V1,
  MCFT_CAP09_FORMAL_RAW_ENV_V1,
  loadFormalDurableRawStoreBindingV1,
} from "../../apps/server/src/external_evidence/formal_durable_raw_store_binding_v1.js";

const OUT = "acceptance-output/MCFT_CAP_09_EA5C2A_FORMAL_RAW_STORE_BINDING_RESULT.json";
const cases: Array<{ name: string; status: "PASS" }> = [];

function pass(name: string): void { cases.push({ name, status: "PASS" }); }

function validEnv(): Record<string, string> {
  return {
    [MCFT_CAP09_FORMAL_RAW_ENV_V1.endpoint]: "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
    [MCFT_CAP09_FORMAL_RAW_ENV_V1.bucket]: MCFT_CAP09_FORMAL_RAW_BUCKET_V1,
    [MCFT_CAP09_FORMAL_RAW_ENV_V1.region]: "auto",
    [MCFT_CAP09_FORMAL_RAW_ENV_V1.access_key_id]: "FORMAL_ACCESS_KEY_FOR_CONTRACT_TEST_ONLY",
    [MCFT_CAP09_FORMAL_RAW_ENV_V1.secret_access_key]: "FORMAL_SECRET_KEY_FOR_CONTRACT_TEST_ONLY",
  };
}

function expectCode(name: string, env: Record<string, string | undefined>, code: string): void {
  assert.throws(() => loadFormalDurableRawStoreBindingV1(env), (error: unknown) => {
    assert(error instanceof Error);
    assert.equal(error.message, code);
    return true;
  });
  pass(name);
}

const first = loadFormalDurableRawStoreBindingV1(validEnv());
assert.equal(first.public_descriptor.binding_id, MCFT_CAP09_FORMAL_RAW_BINDING_ID_V1);
assert.equal(first.public_descriptor.bucket, MCFT_CAP09_FORMAL_RAW_BUCKET_V1);
assert.equal(first.public_descriptor.endpoint_origin, "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com");
assert.equal(first.public_descriptor.region, "auto");
assert.equal(first.public_descriptor.retention_class, "PRIVATE_RESTRICTED_RAW_EVIDENCE");
assert.equal(first.public_descriptor.local_or_ci_fallback_allowed, false);
assert.equal(first.public_descriptor.public_or_presigned_access_allowed, false);
assert.match(first.public_descriptor.binding_fingerprint_sha256, /^sha256:[0-9a-f]{64}$/);
pass("valid remote HTTPS binding produces exact non-secret descriptor");

const second = loadFormalDurableRawStoreBindingV1(validEnv());
assert.equal(second.public_descriptor.binding_fingerprint_sha256, first.public_descriptor.binding_fingerprint_sha256);
assert.equal(JSON.stringify(second.public_descriptor), JSON.stringify(first.public_descriptor));
pass("same non-secret authority yields deterministic binding fingerprint");

const serializedDescriptor = JSON.stringify(first.public_descriptor);
assert.equal(serializedDescriptor.includes("FORMAL_ACCESS_KEY_FOR_CONTRACT_TEST_ONLY"), false);
assert.equal(serializedDescriptor.includes("FORMAL_SECRET_KEY_FOR_CONTRACT_TEST_ONLY"), false);
assert.equal(first.adapter_config.allow_insecure_http_for_test, undefined);
pass("public descriptor contains no credential material and production binding cannot enable insecure test transport");

const missingEndpoint = validEnv();
delete missingEndpoint[MCFT_CAP09_FORMAL_RAW_ENV_V1.endpoint];
expectCode(
  "missing endpoint fails closed",
  missingEndpoint,
  `EA5C2A_FORMAL_RAW_ENV_REQUIRED:${MCFT_CAP09_FORMAL_RAW_ENV_V1.endpoint}`,
);

const httpEnv = validEnv();
httpEnv[MCFT_CAP09_FORMAL_RAW_ENV_V1.endpoint] = "http://objects.example.invalid";
expectCode("HTTP endpoint is forbidden", httpEnv, "EA5C2A_FORMAL_RAW_HTTPS_REQUIRED");

const localEnv = validEnv();
localEnv[MCFT_CAP09_FORMAL_RAW_ENV_V1.endpoint] = "https://localhost";
expectCode("localhost fallback is forbidden", localEnv, "EA5C2A_FORMAL_RAW_LOCAL_ENDPOINT_FORBIDDEN");

const bucketEnv = validEnv();
bucketEnv[MCFT_CAP09_FORMAL_RAW_ENV_V1.bucket] = "some-other-bucket";
expectCode("bucket authority drift fails closed", bucketEnv, "EA5C2A_FORMAL_RAW_BUCKET_AUTHORITY_MISMATCH");

const embeddedCredentialEnv = validEnv();
embeddedCredentialEnv[MCFT_CAP09_FORMAL_RAW_ENV_V1.endpoint] = "https://user:pass@objects.example.invalid";
expectCode(
  "endpoint-embedded credentials are forbidden",
  embeddedCredentialEnv,
  "EA5C2A_FORMAL_RAW_ENDPOINT_CREDENTIAL_QUERY_OR_FRAGMENT_FORBIDDEN",
);

const pathEnv = validEnv();
pathEnv[MCFT_CAP09_FORMAL_RAW_ENV_V1.endpoint] = "https://objects.example.invalid/private-prefix";
expectCode("endpoint path indirection is forbidden", pathEnv, "EA5C2A_FORMAL_RAW_ENDPOINT_PATH_FORBIDDEN");

const ciCredentialEnv = validEnv();
ciCredentialEnv[MCFT_CAP09_FORMAL_RAW_ENV_V1.access_key_id] = "minioadmin";
ciCredentialEnv[MCFT_CAP09_FORMAL_RAW_ENV_V1.secret_access_key] = "minioadmin123";
expectCode("known CI MinIO credentials are forbidden", ciCredentialEnv, "EA5C2A_FORMAL_RAW_CI_CREDENTIAL_FORBIDDEN");

const result = {
  schema_version: "geox_mcft_cap09_ea5c2a_formal_raw_store_binding_result_v1",
  status: "PASS",
  case_count: cases.length,
  cases,
  binding_contract_qualified: true,
  persistent_formal_24h_raw_store_bound: false,
  live_formal_ingress_proved: false,
  formal_neon_write_performed: false,
  ea5c_complete: false,
  ea5d_authorized: false,
  ea5e_authorized: false,
  formal_o00_start_authorized: false,
  mcft_cap09_completed: false,
};

fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
