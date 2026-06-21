// scripts/runtime_acceptance/ACCEPTANCE_RECOMMENDATION_APPROVAL_DECISION_RUNTIME_V1.cjs
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Pool } = require("pg");

const RUN = `h37_recommendation_approval_decision_acceptance_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3001";

const ADMIN_TOKEN = process.env.GEOX_ACCEPTANCE_TOKEN || "set-via-env-or-external-secret-file-admin";
const APPROVER_TOKEN = process.env.GEOX_APPROVER_ACCEPTANCE_TOKEN || "set-via-env-or-external-secret-file-approver";
const OPERATOR_TOKEN = "set-via-env-or-external-secret-file-pdi-writeonly";
const CLIENT_TOKEN = "set-via-env-or-external-secret-file-client";

const TENANT_ID = process.env.GEOX_TENANT_ID || "tenantA";
const PROJECT_ID = process.env.GEOX_PROJECT_ID || "projectA";
const GROUP_ID = process.env.GEOX_GROUP_ID || "groupA";
const FIELD_ID = process.env.THREE_SURFACE_FIELD_ID || "field_demo_001";
const ZONE_ID = "zoneA";

function authorizationHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

function requestId(suffix) {
  return `${RUN}_${suffix}`;
}

function decisionBody(overrides = {}) {
  return {
    tenant_id: TENANT_ID,
    project_id: PROJECT_ID,
    group_id: GROUP_ID,
    field_id: FIELD_ID,
    zone_id: ZONE_ID,
    approver_id: `approver_${RUN}`,
    decision: "APPROVED",
    decision_reason: "approved for controlled irrigation execution planning",
    idempotency_key: `${RUN}_key_${crypto.randomUUID().slice(0, 8)}`,
    ...overrides,
  };
}

async function postDecision(requestIdValue, body, token = APPROVER_TOKEN) {
  const response = await fetch(
    `${BASE_URL}/api/v1/operator/approval-requests/${encodeURIComponent(requestIdValue)}/decision`,
    {
      method: "POST",
      headers: authorizationHeaders(token),
      body: JSON.stringify(body),
    },
  );

  return {
    status: response.status,
    json: await response.json().catch(() => null),
  };
}

function h36ApprovalRequestPayload(id, patch = {}) {
  return {
    tenant_id: TENANT_ID,
    project_id: PROJECT_ID,
    group_id: GROUP_ID,
    field_id: FIELD_ID,
    zone_id: ZONE_ID,
    request_id: id,
    approval_request_id: id,
    status: "PENDING",
    actor_id: `issuer_${RUN}`,
    token_id: `tok_issuer_${RUN}`,
    proposal: {
      issuer: {
        id: `issuer_${RUN}`,
      },
      meta: {
        source: "DECISION_RECOMMENDATION_V1",
        approval_intent: "REQUEST_HUMAN_APPROVAL_ONLY",
        no_direct_execution: true,
        skip_auto_task_issue: true,
        allow_auto_task_issue: false,
        approval_decision_created: false,
        operation_plan_created: false,
        task_created: false,
        dispatch_created: false,
        roi_created: false,
        field_memory_created: false,
        recommendation_id: `rec_${id}`,
        source_submission_id: `sub_${id}`,
      },
    },
    ...patch,
  };
}

async function insertApprovalRequest(pool, id, patch = {}) {
  const payload = h36ApprovalRequestPayload(id, patch);
  await pool.query(
    "INSERT INTO facts(fact_id, occurred_at, source, record_json) VALUES($1, NOW(), $2, $3::jsonb)",
    [`fact_${id}`, RUN, JSON.stringify({ type: "approval_request_v1", payload })],
  );
  return payload;
}

async function cleanup(pool) {
  await pool.query(
    "DELETE FROM facts WHERE source = $1 OR record_json::text LIKE $2",
    [RUN, `%${RUN}%`],
  ).catch(() => undefined);
}

async function countFacts(pool, type) {
  const result = await pool.query(
    "SELECT count(*)::int AS count FROM facts WHERE record_json->>'type' = $1 AND record_json::text LIKE $2",
    [type, `%${RUN}%`],
  );
  return Number(result.rows[0]?.count || 0);
}

async function latestPayload(pool, type, requestIdValue, extraPredicate = "", extraParams = []) {
  const result = await pool.query(
    `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
      WHERE record_json::jsonb->>'type' = $1
        AND record_json::jsonb#>>'{payload,request_id}' = $2
        AND record_json::text LIKE $3
        ${extraPredicate}
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [type, requestIdValue, `%${RUN}%`, ...extraParams],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    fact_id: String(row.fact_id),
    payload: row.record_json?.payload || null,
  };
}

async function assertNoDownstreamFacts(pool) {
  for (const type of [
    "operation_plan_v1",
    "operation_plan_transition_v1",
    "ao_act_task_v0",
    "roi_ledger_v1",
    "field_memory_v1",
  ]) {
    assert.equal(await countFacts(pool, type), 0, `${type} must not be created`);
  }
}

async function assertTransitionLinkage(pool, requestIdValue, expectedDecision) {
  const decision = await latestPayload(pool, "approval_decision_v1", requestIdValue);
  const transition = await latestPayload(
    pool,
    "approval_request_v1",
    requestIdValue,
    "AND record_json::jsonb#>>'{payload,status}' = $4",
    [expectedDecision],
  );

  assert(decision, "approval_decision_v1 payload exists");
  assert(transition, "approval_request_v1 transition payload exists");
  assert.equal(transition.payload.status, expectedDecision, "transition status matches decision");
  assert.equal(transition.payload.decision_id, decision.payload.decision_id, "transition decision_id links to decision");
  assert.equal(transition.payload.approval_decision_id, decision.payload.decision_id, "transition approval_decision_id links to decision");
  assert.equal(transition.payload.approval_decision_fact_id, decision.fact_id, "transition approval_decision_fact_id links to decision fact");
  assert.equal(transition.payload.approval_decision_created, true, "transition marks approval decision created");
  assert.equal(typeof transition.payload.decided_at, "string", "transition decided_at exists");
  assert(transition.payload.decided_at.length > 0, "transition decided_at is non-empty");
  assert.equal(transition.payload.operation_plan_created, false, "transition does not create operation plan");
  assert.equal(transition.payload.task_created, false, "transition does not create task");
}

async function main() {
  assert(DATABASE_URL, "DATABASE_URL required");

  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    await cleanup(pool);

    const approveRequestId = requestId("approve");
    const approveBody = decisionBody({ idempotency_key: `${RUN}_approve` });
    await insertApprovalRequest(pool, approveRequestId);

    let response = await postDecision(approveRequestId, approveBody);
    assert.equal(response.json.status, "DECISION_RECORDED");
    assert.equal(await countFacts(pool, "operator_recommendation_approval_decision_submission_v1"), 1);
    assert.equal(await countFacts(pool, "approval_decision_v1"), 1);
    assert.equal(await countFacts(pool, "approval_request_v1"), 2);
    assert.equal(response.json.approval_request_transition_fact_id?.length > 0, true);
    await assertTransitionLinkage(pool, approveRequestId, "APPROVED");
    await assertNoDownstreamFacts(pool);

    response = await postDecision(approveRequestId, approveBody);
    assert.equal(response.json.status, "REJECTED_DUPLICATE");
    assert.equal(response.json.duplicate, true);
    assert.equal(await countFacts(pool, "approval_decision_v1"), 1);

    const rejectRequestId = requestId("reject");
    await insertApprovalRequest(pool, rejectRequestId);
    response = await postDecision(
      rejectRequestId,
      decisionBody({ decision: "REJECTED", idempotency_key: `${RUN}_reject` }),
    );
    assert.equal(response.json.status, "DECISION_RECORDED");
    assert.equal(response.json.decision, "REJECTED");
    assert.equal(await countFacts(pool, "approval_decision_v1"), 2);
    await assertTransitionLinkage(pool, rejectRequestId, "REJECTED");
    await assertNoDownstreamFacts(pool);

    const rejectionCases = [
      ["nonpending", { status: "APPROVED" }, "REJECTED_APPROVAL_REQUEST_NOT_PENDING", {}],
      ["nonderived", { proposal: { meta: {} } }, "REJECTED_NOT_RECOMMENDATION_DERIVED", {}],
      ["scope", {}, "REJECTED_APPROVAL_REQUEST_NOT_FOUND", { field_id: `${FIELD_ID}_other` }],
      ["self", {}, "REJECTED_SELF_APPROVAL", { approver_id: `issuer_${RUN}` }],
    ];

    for (const [name, patch, expectedStatus, bodyPatch] of rejectionCases) {
      const id = requestId(name);
      await insertApprovalRequest(pool, id, patch);
      const before = await countFacts(pool, "approval_decision_v1");
      response = await postDecision(
        id,
        decisionBody({ ...bodyPatch, idempotency_key: `${RUN}_${name}` }),
      );
      assert.equal(response.json.status, expectedStatus, name);
      assert.equal(await countFacts(pool, "approval_decision_v1"), before, `${name} creates no approval_decision_v1`);
    }

    const operatorAuthRequestId = requestId("operator_auth");
    await insertApprovalRequest(pool, operatorAuthRequestId);
    let before = await countFacts(pool, "approval_decision_v1");
    response = await postDecision(
      operatorAuthRequestId,
      decisionBody({ idempotency_key: `${RUN}_operator_auth` }),
      OPERATOR_TOKEN,
    );
    assert(response.status === 403 || response.status === 401, "operator token rejected");
    assert.equal(await countFacts(pool, "approval_decision_v1"), before);

    const clientAuthRequestId = requestId("client_auth");
    await insertApprovalRequest(pool, clientAuthRequestId);
    before = await countFacts(pool, "approval_decision_v1");
    response = await postDecision(
      clientAuthRequestId,
      decisionBody({ idempotency_key: `${RUN}_client_auth` }),
      CLIENT_TOKEN,
    );
    assert(response.status === 403 || response.status === 401, "client token rejected");
    assert.equal(await countFacts(pool, "approval_decision_v1"), before);

    response = await postDecision(
      requestId("invalid_decision"),
      decisionBody({ decision: "BAD", idempotency_key: `${RUN}_bad` }),
      ADMIN_TOKEN,
    );
    assert.equal(response.json.status, "REJECTED_INVALID_INPUT");

    response = await postDecision(
      requestId("missing_reason"),
      decisionBody({ decision_reason: "", idempotency_key: `${RUN}_noreason` }),
      ADMIN_TOKEN,
    );
    assert.equal(response.json.status, "REJECTED_INVALID_INPUT");

    console.log("ACCEPTANCE_RECOMMENDATION_APPROVAL_DECISION_RUNTIME_V1 passed");
  } finally {
    await cleanup(pool);
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
