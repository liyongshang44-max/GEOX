#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const HOST_AUTH = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json",
);
const OUT = path.join(
  ROOT,
  "acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1_RESULT.json",
);

function req(ok, code) {
  if (!ok) throw new Error(code);
}

function text(value, code) {
  const out = String(value ?? "").trim();
  if (!out) throw new Error(code);
  return out;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

function psql(databaseUrl, sql) {
  return childProcess.execFileSync(
    "psql",
    [
      databaseUrl,
      "-AtF",
      "|",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    },
  ).trim();
}

function serviceIdentity(host, plane) {
  const contract = host.host_identity_contract;
  req(contract && typeof contract === "object", "OWNER_HOST_IDENTITY_CONTRACT_REQUIRED");
  const node = plane === "EVIDENCE_RUNTIME"
    ? contract.evidence_runtime
    : contract.twin_runtime;
  req(node && typeof node === "object", "OWNER_SERVICE_IDENTITY_NODE_REQUIRED");
  const identity = node.service_identity;
  req(identity && typeof identity === "object", "OWNER_SERVICE_IDENTITY_REQUIRED");
  req(identity.platform_provider === "LOCAL_OPERATOR_MANAGED_DOCKER", "OWNER_SERVICE_PLATFORM_REQUIRED");
  req(identity.execution_class === "LONG_RUNNING_SERVICE", "OWNER_SERVICE_EXECUTION_CLASS_REQUIRED");
  req(identity.runtime_role === plane, "OWNER_SERVICE_RUNTIME_ROLE_REQUIRED");
  return {
    service_id: text(identity.service_id, "OWNER_SERVICE_ID_REQUIRED"),
    service_name: text(identity.service_name, "OWNER_SERVICE_NAME_REQUIRED"),
  };
}

function queryLease(input) {
  const raw = psql(
    input.database_url,
    `
WITH live AS (
  SELECT lease_owner,
         fencing_token,
         acquired_at,
         expires_at,
         heartbeat_at
    FROM public.${input.table_name}
   WHERE expires_at > transaction_timestamp()
),
owners AS (
  SELECT count(*)::int AS live_row_count,
         count(DISTINCT lease_owner)::int AS distinct_owner_count,
         min(lease_owner) AS lease_owner,
         min(fencing_token)::text AS minimum_fencing_token,
         bool_and(fencing_token > 0) AS all_positive_fencing_tokens,
         bool_and(acquired_at <= heartbeat_at) AS acquired_before_heartbeat,
         bool_and(heartbeat_at <= transaction_timestamp()) AS heartbeat_not_future,
         bool_and(expires_at > heartbeat_at) AS expiry_after_heartbeat
    FROM live
)
SELECT current_user,
       transaction_timestamp(),
       live_row_count,
       distinct_owner_count,
       COALESCE(lease_owner,''),
       COALESCE(minimum_fencing_token,''),
       COALESCE(all_positive_fencing_tokens,false),
       COALESCE(acquired_before_heartbeat,false),
       COALESCE(heartbeat_not_future,false),
       COALESCE(expiry_after_heartbeat,false)
  FROM owners;`,
  );
  const fields = raw.split("|");
  req(fields.length === 10, "OWNER_LIVE_LEASE_QUERY_SHAPE_INVALID");
  return {
    database_current_user: fields[0],
    database_now: fields[1],
    live_row_count: Number(fields[2]),
    distinct_owner_count: Number(fields[3]),
    lease_owner: fields[4],
    minimum_fencing_token: fields[5],
    all_positive_fencing_tokens: fields[6] === "t",
    acquired_before_heartbeat: fields[7] === "t",
    heartbeat_not_future: fields[8] === "t",
    expiry_after_heartbeat: fields[9] === "t",
  };
}

function adjudicatePlane(input) {
  const blockers = [];
  if (input.query.database_current_user !== input.expected_login_role) {
    blockers.push(`${input.code}_DATABASE_LOGIN_ROLE_MISMATCH`);
  }
  if (input.query.live_row_count < 1) {
    blockers.push(`${input.code}_LIVE_LEASE_NOT_ESTABLISHED`);
  }
  if (input.query.distinct_owner_count !== 1) {
    blockers.push(`${input.code}_EXACT_ONE_EFFECTIVE_OWNER_NOT_PROVEN`);
  }
  const prefix = `${input.service.service_id}#instance:`;
  if (
    input.query.distinct_owner_count === 1
    && (
      !input.query.lease_owner.startsWith(prefix)
      || input.query.lease_owner.length <= prefix.length
    )
  ) {
    blockers.push(`${input.code}_LEASE_OWNER_SERVICE_IDENTITY_MISMATCH`);
  }
  if (input.query.live_row_count > 0 && !input.query.all_positive_fencing_tokens) {
    blockers.push(`${input.code}_POSITIVE_FENCING_TOKEN_REQUIRED`);
  }
  if (input.query.live_row_count > 0 && !input.query.acquired_before_heartbeat) {
    blockers.push(`${input.code}_LEASE_ACQUIRED_HEARTBEAT_CHRONOLOGY_INVALID`);
  }
  if (input.query.live_row_count > 0 && !input.query.heartbeat_not_future) {
    blockers.push(`${input.code}_LEASE_HEARTBEAT_FUTURE_INVALID`);
  }
  if (input.query.live_row_count > 0 && !input.query.expiry_after_heartbeat) {
    blockers.push(`${input.code}_LEASE_EXPIRY_HEARTBEAT_CHRONOLOGY_INVALID`);
  }
  return {
    runtime_role: input.runtime_role,
    expected_service_id: input.service.service_id,
    expected_service_name: input.service.service_name,
    expected_login_role: input.expected_login_role,
    ...input.query,
    owner_service_prefix_match:
      input.query.distinct_owner_count === 1
      && input.query.lease_owner.startsWith(prefix)
      && input.query.lease_owner.length > prefix.length,
    blockers,
    status: blockers.length === 0 ? "PASS" : "FAIL",
  };
}

try {
  const host = readJson(HOST_AUTH);
  req(
    host.schema_version === "geox_mcft_cap09_production_non_github_host_binding_authority_v1",
    "OWNER_HOST_BINDING_SCHEMA_REQUIRED",
  );
  req(
    host.status === "LOCAL_OPERATOR_MANAGED_DOCKER_HOST_IDENTITIES_BOUND",
    "OWNER_HOST_BINDING_STATUS_REQUIRED",
  );
  req(
    host.binding_state?.exact_two_runtime_service_identities_bound === true
    && host.binding_state?.binding_authorized === true,
    "OWNER_EXACT_TWO_HOST_IDENTITIES_BOUND_REQUIRED",
  );
  req(
    host.github_actions?.production_execution_host_allowed === false,
    "OWNER_GITHUB_PRODUCTION_EXECUTION_HOST_FORBIDDEN",
  );

  const evidenceUrl = text(
    process.env.EVIDENCE_RUNTIME_DATABASE_URL_SECRET,
    "OWNER_EVIDENCE_RUNTIME_DATABASE_URL_REQUIRED",
  );
  const twinUrl = text(
    process.env.TWIN_RUNTIME_DATABASE_URL_SECRET,
    "OWNER_TWIN_RUNTIME_DATABASE_URL_REQUIRED",
  );

  const evidenceService = serviceIdentity(host, "EVIDENCE_RUNTIME");
  const twinService = serviceIdentity(host, "TWIN_RUNTIME");
  req(
    evidenceService.service_id !== twinService.service_id,
    "OWNER_RUNTIME_SERVICE_IDENTITIES_MUST_BE_DISTINCT",
  );

  const evidence = adjudicatePlane({
    code: "EVIDENCE_RUNTIME",
    runtime_role: "EVIDENCE_RUNTIME",
    service: evidenceService,
    expected_login_role: "geox_mcft_cap09_evidence_runtime_login_v1",
    query: queryLease({
      database_url: evidenceUrl,
      table_name: "external_evidence_producer_lease_v1",
    }),
  });
  const twin = adjudicatePlane({
    code: "TWIN_RUNTIME",
    runtime_role: "TWIN_RUNTIME",
    service: twinService,
    expected_login_role: "geox_mcft_cap09_twin_runtime_login_v1",
    query: queryLease({
      database_url: twinUrl,
      table_name: "twin_runtime_lease_v1",
    }),
  });

  const blockers = [...evidence.blockers, ...twin.blockers];
  if (
    evidence.lease_owner
    && twin.lease_owner
    && evidence.lease_owner === twin.lease_owner
  ) {
    blockers.push("CROSS_PLANE_GENERIC_OWNER_FORBIDDEN");
  }

  write({
    schema_version:
      "geox_mcft_cap09_production_owner_live_fenced_leases_v1",
    status: blockers.length === 0 ? "PASS" : "FAIL",
    adjudication:
      blockers.length === 0
        ? "EXACT_ONE_EFFECTIVE_OWNER_PER_RUNTIME_ROLE_PROVEN"
        : "LIVE_OWNER_EVIDENCE_NOT_YET_SUFFICIENT",
    non_github_host_binding_established: true,
    exact_two_runtime_service_identities_bound: true,
    evidence_runtime: evidence,
    twin_runtime_scheduler: twin,
    cross_plane_owner_independent:
      Boolean(evidence.lease_owner)
      && Boolean(twin.lease_owner)
      && evidence.lease_owner !== twin.lease_owner,
    blockers,
    database_write_count: 0,
    production_runtime_start_count: 0,
    provider_request_count: 0,
    production_owner_activation_effect: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  });
} catch (error) {
  write({
    schema_version:
      "geox_mcft_cap09_production_owner_live_fenced_leases_v1",
    status: "FAIL",
    adjudication: "READ_ONLY_OWNER_ADJUDICATION_ERROR",
    blockers: [
      error instanceof Error ? error.message : String(error),
    ],
    database_write_count: 0,
    production_runtime_start_count: 0,
    provider_request_count: 0,
    production_owner_activation_effect: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  });
  process.exitCode = 1;
}
