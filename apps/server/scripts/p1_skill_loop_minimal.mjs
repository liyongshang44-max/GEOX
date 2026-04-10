import assert from "node:assert/strict";

const BASE_URL = process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3001";
const TOKEN = process.env.GEOX_TOKEN ?? "geox_dev_MqF24b9NHfB6AkBNjKJaxP_T0CnL0XZykhdmSyoQvg4";
const tenant = {
  tenant_id: process.env.GEOX_TENANT_ID ?? "tenantA",
  project_id: process.env.GEOX_PROJECT_ID ?? "projectA",
  group_id: process.env.GEOX_GROUP_ID ?? "groupA",
};

const headers = {
  "content-type": "application/json",
  accept: "application/json",
  authorization: `Bearer ${TOKEN}`,
};
const DEVICE_ID = process.env.GEOX_DEVICE_ID ?? "dev_smoke_01";
const ADAPTER_TYPE = "irrigation_simulator";

const AO_ACT_TASK_SCHEMA_RULES_V0 = Object.freeze({
  forbidden_keys: [
    "problem_state_id",
    "lifecycle_state",
    "recommendation",
    "suggestion",
    "proposal",
    "agronomy",
    "prescription",
    "severity",
    "priority",
    "expected_outcome",
    "effectiveness",
    "quality",
    "desirability",
    "next_action",
    "follow_up",
    "autotrigger",
    "auto",
    "profile",
    "preset",
    "mode",
    "success_criteria",
    "success_score",
    "yield",
    "profit",
  ],
  parameter_schema_parameters_relationship: "parameter_schema.keys must 1:1 match parameters keys (no missing, no extras)",
  irrigate_minimal_example: {
    action_type: "IRRIGATE",
    parameter_schema: {
      keys: [{ name: "duration_sec", type: "number", min: 1 }],
    },
    parameters: { duration_sec: 30 },
  },
});

function preflightAssertAoActTaskMinimalSchema(parameters, actionType = "IRRIGATE") {
  assert.equal(actionType, AO_ACT_TASK_SCHEMA_RULES_V0.irrigate_minimal_example.action_type, "仅支持 IRRIGATE 最小预检");
  const schemaKeys = AO_ACT_TASK_SCHEMA_RULES_V0.irrigate_minimal_example.parameter_schema.keys.map((k) => k.name);
  const parameterKeys = Object.keys(parameters);

  for (const k of parameterKeys) {
    assert.ok(!AO_ACT_TASK_SCHEMA_RULES_V0.forbidden_keys.includes(k), `parameters 命中 forbidden key: ${k}`);
    assert.ok(schemaKeys.includes(k), `parameters 含越界键: ${k}`);
  }
  for (const k of schemaKeys) {
    assert.ok(parameterKeys.includes(k), `parameters 缺少 schema 键: ${k}`);
  }
}


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inferStepFromPath(path) {
  if (path === "/api/v1/operations/manual") return "manual_create";
  if (/^\/api\/v1\/approvals\/[^/]+\/decide$/.test(path)) return "approve_decide";
  if (path === "/api/control/ao_act/task") return "task_create";
  return null;
}

async function request(path, init = {}) {
  const { step, ...fetchInit } = init;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchInit,
    headers: { ...headers, ...(fetchInit.headers ?? {}) },
  });
  const rawBody = await res.text();
  const responseBody = (() => {
    if (!rawBody) return {};
    try {
      return JSON.parse(rawBody);
    } catch {
      return rawBody;
    }
  })();
  if (!res.ok) {
    const parsedRequestPayload = (() => {
      if (!fetchInit.body) return null;
      if (typeof fetchInit.body !== "string") return fetchInit.body;
      try {
        return JSON.parse(fetchInit.body);
      } catch {
        return fetchInit.body;
      }
    })();
    const sanitize = (input) => {
      if (Array.isArray(input)) return input.map((x) => sanitize(x));
      if (input && typeof input === "object") {
        return Object.fromEntries(
          Object.entries(input).map(([key, value]) => {
            if (key.toLowerCase().includes("token")) return [key, "[REDACTED]"];
            return [key, sanitize(value)];
          }),
        );
      }
      return input;
    };
    const detail = {
      step: step ?? inferStepFromPath(path),
      path,
      statusCode: res.status,
      responseBody,
      requestPayload: sanitize(parsedRequestPayload),
    };
    console.error(`[p1-smoke][HTTP_FAIL] ${JSON.stringify(detail)}`);
    throw new Error(`HTTP ${res.status} ${path}`);
  }
  return responseBody;
}

async function ensureSkillBinding() {
  const bind_target = `p1_smoke_${Date.now()}`;
  await request("/api/v1/skills/bindings", {
    method: "POST",
    body: JSON.stringify({
      ...tenant,
      skill_id: "p1_smoke_dispatch_skill",
      version: "v1",
      category: "DEVICE",
      scope_type: "TENANT",
      trigger_stage: "before_dispatch",
      bind_target,
      enabled: true,
      priority: 1,
      config_patch: { smoke: true },
    }),
  });
  const listing = await request("/api/v1/skills/bindings", { method: "GET" });
  const found = (listing.items_effective ?? []).some((item) => item.bind_target === bind_target);
  assert.ok(found, "skills/bindings 链路失败：未找到刚创建的 binding");
}

async function createOperation(actionType, suffix) {
  const commandId = `p1_skill_loop_${suffix}_${Date.now()}`;
  const parameters = { duration_sec: 30 }; // 最小合法参数集：仅保留 duration_sec。
  preflightAssertAoActTaskMinimalSchema(parameters, actionType);
  const body = {
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    field_id: "field_p1_smoke",
    device_id: DEVICE_ID,
    action_type: actionType,
    adapter_type: ADAPTER_TYPE,
    parameters,
    issuer: { kind: "human", id: "smoke_user", namespace: "qa" },
    command_id: commandId,
    meta: { smoke: "p1", case: suffix, device_id: DEVICE_ID, adapter_type: ADAPTER_TYPE },
  };
  const out = await request("/api/v1/operations/manual", {
    step: "manual_create",
    method: "POST",
    body: JSON.stringify(body),
  });
  assert.ok(out.operation_plan_id, "operation 创建失败：缺少 operation_plan_id");
  return { commandId, operationPlanId: out.operation_plan_id };
}

async function waitForTask(operationPlanId) {
  for (let i = 0; i < 10; i += 1) {
    const detail = await request(`/api/v1/operations/${encodeURIComponent(operationPlanId)}/detail`, { method: "GET" });
    const taskId = detail?.operation?.act_task_id;
    if (taskId) return taskId;
    await sleep(300);
  }
  throw new Error(`operation ${operationPlanId} 未就绪：无法读取 act_task_id`);
}

async function submitReceipt(operationPlanId, actTaskId, evidenceKind) {
  const now = Date.now();
  return request("/api/control/ao_act/receipt", {
    method: "POST",
    body: JSON.stringify({
      ...tenant,
      operation_plan_id: operationPlanId,
      act_task_id: actTaskId,
      executor_id: { kind: "script", id: "p1_smoke_executor", namespace: "qa" },
      execution_time: { start_ts: now - 2000, end_ts: now },
      execution_coverage: { kind: "field", ref: "field_p1_smoke" },
      resource_usage: { fuel_l: 0, electric_kwh: 0.2, water_l: 15, chemical_ml: 0 },
      logs_refs: [{ kind: evidenceKind, ref: `log://${operationPlanId}/${evidenceKind}` }],
      status: "executed",
      constraint_check: { violated: false, violations: [] },
      observed_parameters: { duration_sec: 30 },
      meta: {
        idempotency_key: `idmp_${actTaskId}_${Date.now()}`,
        command_id: actTaskId,
        device_id: DEVICE_ID,
      },
    }),
  });
}

async function waitForFinalState(operationPlanId) {
  for (let i = 0; i < 10; i += 1) {
    const list = await request("/api/v1/operations", { method: "GET" });
    const item = (list.items ?? []).find((x) => x.operation_plan_id === operationPlanId || x.operation_id === operationPlanId);
    if (item?.final_status) return String(item.final_status).toUpperCase();
    await sleep(300);
  }
  throw new Error(`operation_state 查询失败：${operationPlanId} 无 final_status`);
}

function isSuccessMapped(status) {
  const s = String(status ?? "").toUpperCase();
  return ["SUCCESS", "SUCCEEDED", "VALID"].includes(s);
}

function sanitizeParametersForSmoke(actionType, raw) {
  const allowlistByActionType = {
    IRRIGATE: new Set(["duration_sec"]),
  };
  const allowlist = allowlistByActionType[String(actionType ?? "").toUpperCase()] ?? new Set();
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw).filter(([key]) => allowlist.has(key)));
}

async function main() {
  console.log(`[p1-smoke] base=${BASE_URL}`);
  await ensureSkillBinding();

  const successOp = await createOperation("IRRIGATE", "success");
  const successTaskId = await waitForTask(successOp.operationPlanId);
  await submitReceipt(successOp.operationPlanId, successTaskId, "runtime_log");
  const successFinal = await waitForFinalState(successOp.operationPlanId);

  const invalidOp = await createOperation("IRRIGATE", "invalid");
  const invalidTaskId = await waitForTask(invalidOp.operationPlanId);
  await submitReceipt(invalidOp.operationPlanId, invalidTaskId, "sim_trace");
  const invalidFinal = await waitForFinalState(invalidOp.operationPlanId);

  const operationFinalStates = {
    success: { operation_plan_id: successOp.operationPlanId, final_status: successFinal },
    invalid: { operation_plan_id: invalidOp.operationPlanId, final_status: invalidFinal },
  };

  assert.ok(
    isSuccessMapped(successFinal),
    `断言失败：success case final_status 仅接受 SUCCESS|SUCCEEDED|VALID；实际=${JSON.stringify(operationFinalStates)}`,
  );
  assert.equal(
    invalidFinal,
    "INVALID_EXECUTION",
    `断言失败：failure case final_status 必须为 INVALID_EXECUTION；两条 operation 最终状态=${JSON.stringify(operationFinalStates)}`,
  );

  console.log("[p1-smoke] done", operationFinalStates);
}

main().catch((err) => {
  console.error("[p1-smoke] failed", err);
  process.exitCode = 1;
});
