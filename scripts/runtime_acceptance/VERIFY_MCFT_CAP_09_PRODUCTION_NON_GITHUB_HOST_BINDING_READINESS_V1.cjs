"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const ROOT = process.cwd();
const HOST_AUTH = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json");
const PRIVATE_STORE_AUTH = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-RUNTIME-PRIVATE-STORE-BINDING-V1.json");
const HOST_ARM = path.join(ROOT, "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_ARM_V1.json");
const OWNER_ARM = path.join(ROOT, "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_ARM_V1.json");
const COMPOSE = path.join(ROOT, "docker-compose.mcft-cap09-production-preformal.yml");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_READINESS_V1_RESULT.json");

const EXACT_HOST_ID = "fae5f756-ef25-40d5-9777-5b2c3d4837a1";
const TARGET_DB = "geox_mcft_cap09_production_runtime_v1";
const EVIDENCE_LOGIN = "geox_mcft_cap09_evidence_runtime_login_v1";
const TWIN_LOGIN = "geox_mcft_cap09_twin_runtime_login_v1";
const EVIDENCE_PRIVILEGE = "geox_mcft_cap09_evidence_runtime_v1";
const TWIN_PRIVILEGE = "geox_mcft_cap09_twin_runtime_v1";
const EVIDENCE_BUCKET = "geox-mcft-cap09-evidence-runtime-v1";
const FORMAL_BUCKET = "geox-mcft-cap09-formal-raw-v1";
const REMAT_SUBJECT = "3848376647bd0f7d6f93450644c9e3baed7b15cd";
const REMAT_CANONICAL_RUN_ID = 35054759709;
const REMAT_CANONICAL_ARTIFACT_ID = 10430112693;
const REMAT_CANONICAL_ARTIFACT_DIGEST = "sha256:a0e55a96947d43437b3fb51443d9ccc0cf0838fc56cdcbcfe851e669fc30a0a9";
const REMAT_AUTHORITY_SHA256 = "sha256:a81ad681535cd2e30516449bd94486a7dfbc81f882898572400399dbc824fed3";
const EVIDENCE_SERVICE_ID = `local-docker://${EXACT_HOST_ID}/geox-mcft-cap09-evidence-runtime-v1`;
const TWIN_SERVICE_ID = `local-docker://${EXACT_HOST_ID}/geox-mcft-cap09-twin-runtime-v1`;
const SECRET_NAMES = [
  "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL",
  "GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_REGION",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY",
];
const FORMAL_SECRET_NAMES = [
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_REGION",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY",
];

function j(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256File(file) { return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value, null, 2));
}
function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error("HOST_SECRET_BINDING_ENV_REQUIRED:" + name);
  return value;
}
function exec(command, args, options = {}) {
  return cp.execFileSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: options.env || process.env,
    windowsHide: true,
  }).trim();
}
function redact(text, secrets) {
  let out = String(text || "");
  for (const secret of secrets) if (secret) out = out.split(secret).join("[REDACTED]");
  return out.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]").slice(-1200);
}
function execSafe(command, args, options = {}, secrets = []) {
  try { return exec(command, args, options); }
  catch (error) {
    throw new Error("HOST_SECRET_BINDING_COMMAND_FAILED:" + command + ":" + redact(error && error.stderr, secrets));
  }
}
function bool(value) { return value === "t" || value === "true"; }
function rfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}
function hmac(key, value, encoding) { return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding); }
function amzNow(date = new Date()) { return date.toISOString().replace(/[:-]|\.\d{3}/g, ""); }

function assertStaticContract(subject) {
  assert.match(subject, /^[0-9a-f]{40}$/, "HOST_SECRET_BINDING_SUBJECT_SHA_REQUIRED");
  const host = j(HOST_AUTH);
  const arm = j(HOST_ARM);
  const ownerArm = j(OWNER_ARM);
  const store = j(PRIVATE_STORE_AUTH);
  const remat = store.credential_rematerialization_evidence || {};

  assert.equal(host.status, "LOCAL_OPERATOR_MANAGED_DOCKER_HOST_IDENTITIES_BOUND");
  assert.equal(host.production_execution_host_class, "NON_GITHUB_LONG_RUNNING_SERVICE");
  assert.equal(host.github_actions?.production_execution_host_allowed, false);
  assert.equal(host.local_operator_managed_host_contract?.host_id, EXACT_HOST_ID);
  assert.equal(host.local_operator_managed_host_contract?.evidence_runtime?.service_id, EVIDENCE_SERVICE_ID);
  assert.equal(host.local_operator_managed_host_contract?.twin_runtime?.service_id, TWIN_SERVICE_ID);
  assert.equal(host.local_operator_managed_host_contract?.runtime_start_authorized, false);
  assert.equal(host.local_operator_managed_host_contract?.production_owner_activation_authorized, false);
  assert.equal(host.local_operator_managed_host_contract?.formal_v5_arm_authorized, false);

  assert.equal(arm.armed, false);
  assert.equal(arm.platform_provider, "LOCAL_OPERATOR_MANAGED_DOCKER");
  assert.equal(arm.local_host_id, EXACT_HOST_ID);
  assert.equal(arm.runtime_secret_injection_authorized, true);
  assert.equal(arm.production_runtime_secret_injection_authorized, true);
  assert.equal(arm.runtime_secret_binding_scope, "LOCAL_PROCESS_ENV_BINDING_AND_READBACK_ONLY_NO_DEPLOY_NO_START");
  assert.deepEqual(arm.required_runtime_secret_bindings, SECRET_NAMES);
  assert.equal(arm.repository_secret_materialization_authorized, false);
  assert.equal(arm.github_secret_materialization_authorized, false);
  assert.equal(arm.database_readback_authorized, true);
  assert.equal(arm.database_write_authorized, false);
  assert.equal(arm.r2_transient_capability_probe_authorized, true);
  assert.equal(arm.r2_transient_capability_probe_prefix, "pre-owner-cutover-readiness/");
  assert.equal(arm.compose_render_only_authorized, true);
  for (const key of [
    "compose_build_authorized", "compose_create_authorized", "compose_up_authorized", "container_start_authorized",
    "owner_cutover_execution_authorized", "deployment_authorized", "runtime_process_start_authorized",
    "production_owner_activation_authorized", "formal_v5_arm_authorized", "a0_authorized", "o00_authorized",
  ]) assert.equal(arm[key], false, "HOST_SECRET_BINDING_LATER_EFFECT_FORBIDDEN:" + key);
  assert.equal(arm.pre_owner_cutover_readiness_evaluation_authorized, true);

  assert.equal(ownerArm.armed, false);
  assert.equal(ownerArm.runtime_process_start_authorized, false);
  assert.equal(ownerArm.production_owner_activation_authorized, false);
  assert.equal(ownerArm.formal_v5_arm_authorized, false);

  assert.equal(store.next_stage?.stage, "PRODUCTION_HOST_SECRET_BINDING_AND_PRE_OWNER_CUTOVER_READINESS");
  assert.equal(store.next_stage?.separate_explicit_operator_authorization_required, true);
  assert.equal(store.binding_identity?.bucket, EVIDENCE_BUCKET);
  assert.equal(store.formal_raw_separation?.bucket, FORMAL_BUCKET);
  assert.equal(store.binding_identity?.credential_source, "PROCESS_ENVIRONMENT_SECRET_BINDING");
  assert.equal(store.binding_identity?.credential_material_repository_allowed, false);
  assert.equal(remat.status, "PASS");
  assert.equal(remat.observed_subject_sha, REMAT_SUBJECT);
  assert.equal(remat.operational_database?.database_name, TARGET_DB);
  assert.equal(remat.operational_database?.public_table_count, 41);
  assert.equal(remat.operational_database?.non_lease_table_count, 39);
  assert.equal(remat.operational_database?.non_lease_production_state_row_count, 0);
  assert.deepEqual(remat.operational_database?.evidence_lease, { total: 1, live: 0, expired: 1 });
  assert.deepEqual(remat.operational_database?.twin_lease, { total: 1, live: 0, expired: 1 });
  assert.equal(remat.database_credentials?.login_principals_preserved, true);
  assert.equal(remat.database_credentials?.login_role_recreation, false);
  assert.equal(remat.database_credentials?.password_rotation_only, true);
  assert.equal(remat.database_credentials?.exact_one_privilege_membership_each, true);
  assert.equal(remat.database_credentials?.cross_plane_membership, false);
  assert.equal(remat.database_credentials?.role_specific_connectivity_proof, "PASS");
  assert.equal(remat.private_store?.physical_provider, "CLOUDFLARE_R2");
  assert.equal(remat.private_store?.bucket, EVIDENCE_BUCKET);
  assert.equal(remat.private_store?.formal_raw_bucket, FORMAL_BUCKET);
  assert.equal(remat.private_store?.bucket_distinct_from_formal_raw, true);
  assert.equal(remat.private_store?.credential_separate_from_formal_raw, true);
  assert.equal(remat.private_store?.authenticated_put?.http_status, 200);
  assert.equal(remat.private_store?.authenticated_head?.http_status, 200);
  assert.equal(remat.private_store?.authenticated_delete?.http_status, 204);
  assert.equal(remat.private_store?.post_delete_head?.http_status, 404);
  assert.equal(remat.canonicalization?.github_secret_materialized, false);
  assert.equal(remat.canonicalization?.repository_secret_material_allowed, false);
  assert.equal(remat.non_effects?.runtime_process_start, false);
  assert.equal(remat.non_effects?.production_owner_activation, false);
  assert.equal(remat.non_effects?.formal_v5_arm, false);
  assert.equal(sha256File(PRIVATE_STORE_AUTH), REMAT_AUTHORITY_SHA256);

  const compose = fs.readFileSync(COMPOSE, "utf8");
  for (const marker of [
    "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL", "GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT", "GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_REGION", "GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY", "restart: unless-stopped",
  ]) assert.ok(compose.includes(marker), "HOST_SECRET_BINDING_COMPOSE_MARKER_REQUIRED:" + marker);

  return { host, arm, remat };
}

function parseRuntimeUrl(raw, expectedUser) {
  const url = new URL(raw);
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol), "HOST_SECRET_BINDING_POSTGRES_PROTOCOL_REQUIRED");
  assert.equal(decodeURIComponent(url.username), expectedUser, "HOST_SECRET_BINDING_LOGIN_MISMATCH:" + expectedUser);
  assert.ok(url.password, "HOST_SECRET_BINDING_PASSWORD_REQUIRED:" + expectedUser);
  assert.equal(decodeURIComponent(url.pathname.replace(/^\//, "")), TARGET_DB, "HOST_SECRET_BINDING_DB_MISMATCH:" + expectedUser);
  const password = decodeURIComponent(url.password);
  url.password = "";
  return { url: url.toString(), password, hostname: url.hostname, port: url.port || "5432" };
}

function queryRuntime(parsed, expectedUser, expectedPrivilege, oppositePrivilege, allSecrets) {
  const sql = "SELECT current_database()::text,current_user::text," +
    `pg_catalog.pg_has_role(current_user,'${expectedPrivilege}','USAGE')::text,` +
    `pg_catalog.pg_has_role(current_user,'${oppositePrivilege}','USAGE')::text;`;
  const env = { ...process.env, PGPASSWORD: parsed.password };
  const row = execSafe("psql", ["--dbname", parsed.url, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-At", "-F", "|", "-c", sql], { env }, allSecrets).split("|");
  assert.equal(row[0], TARGET_DB, "HOST_SECRET_BINDING_CONNECTED_DB_MISMATCH:" + expectedUser);
  assert.equal(row[1], expectedUser, "HOST_SECRET_BINDING_CONNECTED_USER_MISMATCH:" + expectedUser);
  assert.equal(bool(row[2]), true, "HOST_SECRET_BINDING_EXPECTED_PRIVILEGE_REQUIRED:" + expectedUser);
  assert.equal(bool(row[3]), false, "HOST_SECRET_BINDING_CROSS_PLANE_PRIVILEGE_FORBIDDEN:" + expectedUser);
}

function signingKey(secret, dateStamp, region) {
  const kDate = hmac(Buffer.from("AWS4" + secret, "utf8"), dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

async function r2Request({ method, endpoint, bucket, region, accessKey, secretKey, key, body }) {
  const endpointUrl = new URL(endpoint);
  assert.equal(endpointUrl.protocol, "https:", "HOST_SECRET_BINDING_R2_HTTPS_REQUIRED");
  assert.equal(endpointUrl.search, "", "HOST_SECRET_BINDING_R2_ENDPOINT_QUERY_FORBIDDEN");
  assert.equal(endpointUrl.hash, "", "HOST_SECRET_BINDING_R2_ENDPOINT_HASH_FORBIDDEN");
  const prefix = endpointUrl.pathname.replace(/\/$/, "");
  const canonicalUri = (prefix || "") + "/" + rfc3986(bucket) + "/" + key.split("/").map(rfc3986).join("/");
  const requestUrl = endpointUrl.origin + canonicalUri;
  const payload = body === undefined ? Buffer.alloc(0) : Buffer.from(body);
  const payloadHash = crypto.createHash("sha256").update(payload).digest("hex");
  const amzDate = amzNow();
  const dateStamp = amzDate.slice(0, 8);
  const host = endpointUrl.host;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, crypto.createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const signature = crypto.createHmac("sha256", signingKey(secretKey, dateStamp, region)).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(requestUrl, {
    method,
    headers: {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      authorization,
      ...(method === "PUT" ? { "content-type": "application/octet-stream" } : {}),
    },
    body: method === "PUT" ? payload : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (response.body) { try { await response.arrayBuffer(); } catch {} }
  return response.status;
}

function runningProductionContainerCount(allSecrets) {
  const raw = execSafe("docker", ["ps", "--filter", "label=com.docker.compose.project=geox-mcft-cap09-production-v1", "--format", "{{.ID}}"], {}, allSecrets);
  return raw ? raw.split(/\r?\n/).filter(Boolean).length : 0;
}

function composeRenderOnly(subject, allSecrets) {
  const env = {
    ...process.env,
    GEOX_DEPLOYMENT_SUBJECT_COMMIT: subject,
    GEOX_MCFT_CAP09_TENANT_ID: "preowner-readiness-only",
    GEOX_MCFT_CAP09_PROJECT_ID: "preowner-readiness-only",
    GEOX_MCFT_CAP09_GROUP_ID: "preowner-readiness-only",
    GEOX_MCFT_CAP09_FIELD_ID: "preowner-readiness-only",
    GEOX_MCFT_CAP09_SEASON_ID: "preowner-readiness-only",
    GEOX_MCFT_CAP09_ZONE_ID: "preowner-readiness-only",
    GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH: PRIVATE_STORE_AUTH,
    GEOX_MCFT_CAP09_PRODUCTION_OWNER_CUTOVER_AUTHORITY_PATH: HOST_AUTH,
    GEOX_MCFT_CAP09_PRODUCTION_CURRENT_CROP_AUTHORITY_PATH: path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json"),
    GEOX_MCFT_CAP09_PRODUCTION_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_PATH: path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json"),
    GEOX_MCFT_CAP09_DURABLE_LOG_ROOT: path.join(os.homedir(), ".geox", "mcft-cap09", "logs"),
  };
  execSafe("docker", ["compose", "-f", COMPOSE, "config", "--quiet"], { env }, allSecrets);
}

async function localMachineProof(expectedSubject) {
  if (String(process.env.GITHUB_ACTIONS || "").toLowerCase() === "true") throw new Error("HOST_SECRET_BINDING_GITHUB_ACTIONS_FORBIDDEN");
  const subject = expectedSubject || requiredEnv("SUBJECT_SHA");
  const { arm } = assertStaticContract(subject);
  assert.equal(arm.runtime_secret_binding_target_host_id, EXACT_HOST_ID);

  execSafe("git", ["fetch", "--no-tags", "origin", "main"]);
  const head = execSafe("git", ["rev-parse", "HEAD"]);
  const main = execSafe("git", ["rev-parse", "origin/main"]);
  assert.equal(head, subject, "HOST_SECRET_BINDING_EXACT_SUBJECT_REQUIRED");
  assert.equal(main, subject, "HOST_SECRET_BINDING_CURRENT_PROTECTED_MAIN_REQUIRED");
  const worktree = execSafe("git", ["status", "--porcelain=v1", "--untracked-files=all"])
    .split(/\r?\n/).filter(Boolean).filter((line) => !/^\?\? acceptance-output[\\/]/.test(line));
  assert.equal(worktree.length, 0, "HOST_SECRET_BINDING_WORKTREE_MUST_BE_CLEAN");

  const hostIdFile = path.join(os.homedir(), ".geox", "mcft-cap09", "local-host-id-v1");
  assert.equal(fs.readFileSync(hostIdFile, "utf8").trim().toLowerCase(), EXACT_HOST_ID, "HOST_SECRET_BINDING_HOST_ID_MISMATCH");

  for (const name of FORMAL_SECRET_NAMES) assert.equal(Boolean(String(process.env[name] || "").trim()), false, "HOST_SECRET_BINDING_FORMAL_SECRET_NAMESPACE_FORBIDDEN:" + name);
  const values = Object.fromEntries(SECRET_NAMES.map((name) => [name, requiredEnv(name)]));
  const allSecrets = Object.values(values);
  assert.equal(values.GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET, EVIDENCE_BUCKET, "HOST_SECRET_BINDING_EVIDENCE_BUCKET_REQUIRED");
  assert.equal(values.GEOX_MCFT_CAP09_EVIDENCE_S3_REGION, "auto", "HOST_SECRET_BINDING_R2_REGION_AUTO_REQUIRED");
  assert.notEqual(values.GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET, FORMAL_BUCKET, "HOST_SECRET_BINDING_FORMAL_BUCKET_REUSE_FORBIDDEN");

  const evidence = parseRuntimeUrl(values.GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL, EVIDENCE_LOGIN);
  const twin = parseRuntimeUrl(values.GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL, TWIN_LOGIN);
  assert.equal(evidence.hostname, twin.hostname, "HOST_SECRET_BINDING_DATABASE_HOST_MISMATCH");
  assert.equal(evidence.port, twin.port, "HOST_SECRET_BINDING_DATABASE_PORT_MISMATCH");
  queryRuntime(evidence, EVIDENCE_LOGIN, EVIDENCE_PRIVILEGE, TWIN_PRIVILEGE, allSecrets);
  queryRuntime(twin, TWIN_LOGIN, TWIN_PRIVILEGE, EVIDENCE_PRIVILEGE, allSecrets);

  const beforeContainers = runningProductionContainerCount(allSecrets);
  assert.equal(beforeContainers, 0, "HOST_SECRET_BINDING_PRODUCTION_CONTAINER_ALREADY_RUNNING");
  composeRenderOnly(subject, allSecrets);
  const afterRenderContainers = runningProductionContainerCount(allSecrets);
  assert.equal(afterRenderContainers, 0, "HOST_SECRET_BINDING_COMPOSE_RENDER_STARTED_CONTAINER");

  const r2 = {
    endpoint: values.GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT,
    bucket: values.GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET,
    region: values.GEOX_MCFT_CAP09_EVIDENCE_S3_REGION,
    accessKey: values.GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID,
    secretKey: values.GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY,
  };
  const key = arm.r2_transient_capability_probe_prefix + subject + "/" + new Date().toISOString().replace(/[:.]/g, "-") + "-" + crypto.randomBytes(6).toString("hex") + ".txt";
  const body = "GEOX MCFT-CAP-09 production-host pre-owner secret-binding proof\n";
  const put = await r2Request({ method: "PUT", ...r2, key, body });
  assert.ok(put === 200 || put === 201, "HOST_SECRET_BINDING_R2_PUT_FAILED:" + put);
  let headStatus = null;
  let deleteStatus = null;
  let postDeleteStatus = null;
  try {
    headStatus = await r2Request({ method: "HEAD", ...r2, key });
    assert.equal(headStatus, 200, "HOST_SECRET_BINDING_R2_HEAD_FAILED:" + headStatus);
    deleteStatus = await r2Request({ method: "DELETE", ...r2, key });
    assert.ok(deleteStatus === 200 || deleteStatus === 204, "HOST_SECRET_BINDING_R2_DELETE_FAILED:" + deleteStatus);
    postDeleteStatus = await r2Request({ method: "HEAD", ...r2, key });
    assert.equal(postDeleteStatus, 404, "HOST_SECRET_BINDING_R2_POST_DELETE_HEAD_REQUIRED_404:" + postDeleteStatus);
  } finally {
    if (deleteStatus === null) { try { await r2Request({ method: "DELETE", ...r2, key }); } catch {} }
  }

  const finalContainers = runningProductionContainerCount(allSecrets);
  assert.equal(finalContainers, 0, "HOST_SECRET_BINDING_RUNTIME_CONTAINER_START_FORBIDDEN");
  return {
    schema_version: "geox_mcft_cap09_production_host_secret_binding_pre_owner_readiness_v1",
    status: "PASS",
    stage: "PRODUCTION_HOST_SECRET_BINDING_PROVEN_PRE_OWNER_CUTOVER_READY",
    subject_sha: subject,
    local_host_id: EXACT_HOST_ID,
    exact_two_runtime_service_identities_bound: true,
    runtime_secret_binding_count: SECRET_NAMES.length,
    repository_secret_materialized: false,
    github_secret_materialized: false,
    evidence_database_connectivity_proven: true,
    twin_database_connectivity_proven: true,
    exact_one_privilege_membership_each_proven_by_current_credentials: true,
    cross_plane_privilege_forbidden_proven: true,
    r2_bucket: EVIDENCE_BUCKET,
    r2_formal_bucket_reused: false,
    r2_put_status: put,
    r2_head_status: headStatus,
    r2_delete_status: deleteStatus,
    r2_post_delete_head_status: postDeleteStatus,
    compose_render_only_pass: true,
    production_container_count_before: beforeContainers,
    production_container_count_after: finalContainers,
    pre_owner_cutover_ready: true,
    remaining_blockers: ["PRODUCTION_RUNTIME_START_AUTHORITY_NOT_ARMED"],
    canonical_rematerialization: {
      run_id: REMAT_CANONICAL_RUN_ID,
      artifact_id: REMAT_CANONICAL_ARTIFACT_ID,
      artifact_digest: REMAT_CANONICAL_ARTIFACT_DIGEST,
      authority_sha256: REMAT_AUTHORITY_SHA256,
    },
    database_write: false,
    compose_build: false,
    compose_create: false,
    compose_up: false,
    runtime_process_start: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  };
}

async function main() {
  const subject = String(process.env.SUBJECT_SHA || "").trim();
  const localFlag = process.argv.includes("--production-host-secret-binding-preflight");
  try {
    if (localFlag) {
      const arg = process.argv.find((x) => x.startsWith("--expected-subject="));
      const expected = arg ? arg.slice("--expected-subject=".length).trim() : subject;
      const proof = await localMachineProof(expected);
      write(proof);
      return;
    }
    assertStaticContract(subject);
    write({
      schema_version: "geox_mcft_cap09_production_non_github_host_binding_readiness_v2",
      status: "PASS",
      stage: "HOST_SECRET_BINDING_AUTHORIZED_MACHINE_PROOF_REQUIRED",
      subject_sha: subject,
      production_execution_host_class: "NON_GITHUB_LONG_RUNNING_SERVICE",
      platform_provider: "LOCAL_OPERATOR_MANAGED_DOCKER",
      local_host_id: EXACT_HOST_ID,
      evidence_service_id: EVIDENCE_SERVICE_ID,
      twin_service_id: TWIN_SERVICE_ID,
      exact_two_runtime_service_identities_bound: true,
      canonical_rematerialization_bound: true,
      canonical_rematerialization_run_id: REMAT_CANONICAL_RUN_ID,
      canonical_rematerialization_artifact_id: REMAT_CANONICAL_ARTIFACT_ID,
      canonical_rematerialization_artifact_digest: REMAT_CANONICAL_ARTIFACT_DIGEST,
      production_host_secret_binding_authorized: true,
      production_host_secret_binding_observed: false,
      local_machine_proof_required: true,
      pre_owner_cutover_ready: false,
      remaining_blockers: ["LOCAL_HOST_SECRET_BINDING_MACHINE_PROOF_REQUIRED"],
      repository_secret_materialized: false,
      github_secret_materialized: false,
      provider_request_count: 0,
      database_connection_attempted: false,
      compose_render_attempted: false,
      runtime_process_start: false,
      production_owner_activation: false,
      formal_v5_arm: false,
      a0_bootstrap: false,
      o00_started: false,
    });
  } catch (error) {
    write({
      schema_version: "geox_mcft_cap09_production_non_github_host_binding_readiness_v2",
      status: "FAIL",
      subject_sha: subject || null,
      error: error instanceof Error ? error.message : String(error),
      runtime_process_start: false,
      production_owner_activation: false,
      formal_v5_arm: false,
      a0_bootstrap: false,
      o00_started: false,
    });
    process.exitCode = 1;
  }
}

main();
