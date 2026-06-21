// scripts/runtime_acceptance/ACCEPTANCE_OPERATION_PLAN_FROM_APPROVED_DECISION_RUNTIME_V1.cjs
const { Pool } = require("pg");
const crypto = require("crypto");
const fs = require("fs");

const PREFIX = "h38_operation_plan_from_approved_decision_acceptance_";
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3001";
const ADMIN_OR_OPERATOR_TOKEN = process.env.GEOX_ACCEPTANCE_TOKEN || "set-via-env-or-external-secret-file-admin";
const APPROVER_TOKEN = process.env.GEOX_APPROVER_ACCEPTANCE_TOKEN || "set-via-env-or-external-secret-file-approver";
const CLIENT_OR_VIEWER_TOKEN = process.env.GEOX_CLIENT_ACCEPTANCE_TOKEN || process.env.GEOX_VIEWER_ACCEPTANCE_TOKEN || "set-via-env-or-external-secret-file-client";

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail ? ` ${JSON.stringify(detail)}` : "";
    throw new Error(`${message}${suffix}`);
  }
  console.log(`PASS: ${message}`);
}

async function postJson(url, token, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return { status: response.status, json };
}

async function appendFact(pool, source, type, payload) {
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [`fact_${crypto.randomUUID()}`, source, JSON.stringify({ type, payload })],
  );
}

async function countFacts(pool, type, runId) {
  const result = await pool.query(
    "SELECT COUNT(*)::int AS count FROM facts WHERE (record_json::jsonb->>'type') = $1 AND record_json::jsonb::text LIKE $2",
    [type, `%${runId}%`],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function cleanup(pool, runId) {
  await pool.query(
    "DELETE FROM public.operation_plan_index_v1 WHERE operation_plan_id LIKE $1 OR source_fact_id IN (SELECT fact_id FROM facts WHERE source = $2 OR record_json::jsonb::text LIKE $3)",
    [`${runId}%`, runId, `%${runId}%`],
  ).catch(() => undefined);

  await pool.query(
    "DELETE FROM facts WHERE source = $1 OR record_json::jsonb::text LIKE $2",
    [runId, `%${runId}%`],
  ).catch(() => undefined);
}

function scope(runId) {
  return {
    tenant_id: process.env.GEOX_TENANT_ID || "tenantA",
    project_id: process.env.GEOX_PROJECT_ID || "projectA",
    group_id: process.env.GEOX_GROUP_ID || "groupA",
    field_id: process.env.THREE_SURFACE_FIELD_ID || "field_demo_001",
    zone_id: `${runId}_zone`,
  };
}

function approvedRequestPayload(ids, overrides = {}) {
  return {
    tenant_id: ids.tenant_id,
    project_id: ids.project_id,
    group_id: ids.group_id,
    field_id: ids.field_id,
    zone_id: ids.zone_id,
    request_id: ids.request_id,
    status: "APPROVED",
    decision_id: ids.decision_id,
    approval_decision_created: true,
    operation_plan_created: false,
    operation_plan_transition_created: false,
    task_created: false,
    dispatch_created: false,
    receipt_created: false,
    roi_created: false,
    field_memory_created: false,
    proposal: {
      recommendation_id: ids.recommendation_id,
      meta: {
        source: "DECISION_RECOMMENDATION_V1",
        approval_intent: "REQUEST_HUMAN_APPROVAL_ONLY",
        no_direct_execution: true,
        skip_auto_task_issue: true,
        allow_auto_task_issue: false,
        source_recommendation_fact_id: ids.recommendation_fact_id,
        source_submission_id: ids.submission_id,
      },
    },
    ...overrides,
  };
}

function approvedDecisionPayload(ids, overrides = {}) {
  return {
    tenant_id: ids.tenant_id,
    project_id: ids.project_id,
    group_id: ids.group_id,
    field_id: ids.field_id,
    zone_id: ids.zone_id,
    type: "approval_decision_v1",
    decision_id: ids.decision_id,
    request_id: ids.request_id,
    approval_request_id: ids.request_id,
    decision: "APPROVED",
    source: "RECOMMENDATION_APPROVAL_REQUEST_DECISION",
    source_recommendation_id: ids.recommendation_id,
    source_submission_id: ids.submission_id,
    auto_task_issued: false,
    operation_plan_created: false,
    operation_plan_transition_created: false,
    task_created: false,
    dispatch_created: false,
    receipt_created: false,
    roi_created: false,
    field_memory_created: false,
    ...overrides,
  };
}

async function seedPair(pool, runId, label, decisionOverrides = {}, requestOverrides = {}) {
  const scoped = scope(runId);
  const ids = {
    ...scoped,
    request_id: `${runId}_${label}_request`,
    decision_id: `${runId}_${label}_decision`,
    recommendation_id: `${runId}_${label}_recommendation`,
    recommendation_fact_id: `${runId}_${label}_recommendation_fact`,
    submission_id: `${runId}_${label}_submission`,
  };

  await appendFact(pool, runId, "approval_decision_v1", approvedDecisionPayload(ids, decisionOverrides));
  await appendFact(pool, runId, "approval_request_v1", approvedRequestPayload(ids, requestOverrides));
  return ids;
}

function requestBody(ids, key) {
  return {
    tenant_id: ids.tenant_id,
    project_id: ids.project_id,
    group_id: ids.group_id,
    field_id: ids.field_id,
    zone_id: ids.zone_id,
    operator_id: `${ids.decision_id}_operator`,
    submission_reason: "create operation plan from approved recommendation decision",
    idempotency_key: key,
  };
}

async function assertRejectedToken(token, label, ids) {
  const response = await postJson(
    `${BASE_URL}/api/v1/operator/approval-decisions/${ids.decision_id}/create-operation-plan`,
    token,
    requestBody(ids, `${ids.decision_id}_${label}_key`),
  );
  assert([401, 403].includes(response.status), `${label} token is rejected`, response);
}

async function main() {
  assert(process.env.DATABASE_URL, "DATABASE_URL set");

  const runId = `${PREFIX}${Date.now()}_${crypto.randomUUID().replace(/-/g, "")}`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query(fs.readFileSync("apps/server/db/migrations/2026_06_21_operation_plan_index_v1.sql", "utf8"));
    await cleanup(pool, runId);

    const happy = await seedPair(pool, runId, "happy");
    assert(true, "insert one scoped approval_decision_v1 APPROVED fact");
    assert(true, "insert one scoped approval_request_v1 APPROVED transition fact");

    const createResponse = await postJson(
      `${BASE_URL}/api/v1/operator/approval-decisions/${happy.decision_id}/create-operation-plan`,
      ADMIN_OR_OPERATOR_TOKEN,
      requestBody(happy, `${runId}_happy_key`),
    );

    assert(createResponse.status < 300, "operator/admin token can call create-operation-plan route", createResponse);
    assert(createResponse.json?.status === "OPERATION_PLAN_CREATED", "response status = OPERATION_PLAN_CREATED", createResponse);
    assert(await countFacts(pool, "operator_approval_decision_operation_plan_submission_v1", runId) === 1, "exactly one submission fact is created");
    assert(await countFacts(pool, "operation_plan_v1", runId) === 1, "exactly one operation_plan_v1 fact is created");

    const planId = String(createResponse.json?.operation_plan_id ?? "");
    const indexResult = await pool.query("SELECT * FROM public.operation_plan_index_v1 WHERE operation_plan_id = $1", [planId]);
    assert(indexResult.rowCount === 1, "operation_plan_index_v1 row is upserted");
    assert(createResponse.json?.operation_plan_v1?.status === "CREATED", "operation plan status = CREATED");
    assert(createResponse.json?.operation_plan_v1?.approval_decision === "APPROVE", "operation plan approval_decision = APPROVE");
    assert(createResponse.json?.operation_plan_v1?.act_task_id === null, "operation plan act_task_id = null");
    assert(createResponse.json?.operation_plan_v1?.receipt_fact_id === null, "operation plan receipt_fact_id = null");

    for (const type of ["operation_plan_transition_v1", "ao_act_task_v0", "roi_ledger_v1", "field_memory_v1"]) {
      assert(await countFacts(pool, type, runId) === 0, `no ${type} fact is created`);
    }

    const duplicateResponse = await postJson(
      `${BASE_URL}/api/v1/operator/approval-decisions/${happy.decision_id}/create-operation-plan`,
      ADMIN_OR_OPERATOR_TOKEN,
      requestBody(happy, `${runId}_happy_key`),
    );
    assert(duplicateResponse.json?.duplicate === true, "duplicate request returns duplicate=true", duplicateResponse);
    assert(await countFacts(pool, "operation_plan_v1", runId) === 1, "duplicate idempotency key creates no additional operation_plan_v1");

    const negativeCases = [
      ["REJECTED approval decision creates no operation_plan_v1", { decision: "REJECTED" }, {}],
      ["non-recommendation-derived decision creates no operation_plan_v1", { source: "MANUAL_DECISION" }, {}],
      ["downstream already exists creates no operation_plan_v1", { operation_plan_transition_created: true }, {}],
      ["scope mismatch creates no operation_plan_v1", { field_id: `${happy.field_id}_other` }, {}],
    ];

    for (const [message, decisionOverrides, requestOverrides] of negativeCases) {
      const before = await countFacts(pool, "operation_plan_v1", runId);
      const ids = await seedPair(pool, runId, message.replace(/\W+/g, "_"), decisionOverrides, requestOverrides);
      await postJson(
        `${BASE_URL}/api/v1/operator/approval-decisions/${ids.decision_id}/create-operation-plan`,
        ADMIN_OR_OPERATOR_TOKEN,
        requestBody({ ...ids, field_id: decisionOverrides.field_id || ids.field_id }, `${ids.decision_id}_key`),
      );
      assert(await countFacts(pool, "operation_plan_v1", runId) === before, message);
    }

    const authzIds = await seedPair(pool, runId, "authz");
    await assertRejectedToken(APPROVER_TOKEN, "approver-only", authzIds);
    await assertRejectedToken(CLIENT_OR_VIEWER_TOKEN, "client/viewer", authzIds);
  } finally {
    await cleanup(pool, runId).catch((error) => console.error("cleanup failed", error));
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
