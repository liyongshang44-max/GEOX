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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${path}: ${JSON.stringify(json)}`);
  }
  return json;
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
  const parameters = {
    duration_sec: 30,
  };
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
  return ["SUCCESS", "SUCCEEDED", "VALID", "PENDING_ACCEPTANCE", "COMPLETED"].includes(s);
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

  const statuses = [successFinal, invalidFinal];
  const hasSuccessMapped = statuses.some((x) => isSuccessMapped(x));
  const hasInvalidExecution = statuses.some((x) => x === "INVALID_EXECUTION");

  assert.ok(hasSuccessMapped, `断言失败：至少 1 条 final_status=SUCCESS|VALID（映射后）；实际=${JSON.stringify(statuses)}`);
  assert.ok(hasInvalidExecution, `断言失败：至少 1 条 final_status=INVALID_EXECUTION；实际=${JSON.stringify(statuses)}`);

  console.log("[p1-smoke] done", {
    success: { operation_plan_id: successOp.operationPlanId, final_status: successFinal },
    invalid: { operation_plan_id: invalidOp.operationPlanId, final_status: invalidFinal },
  });
}

main().catch((err) => {
  console.error("[p1-smoke] failed", err);
  process.exitCode = 1;
});
