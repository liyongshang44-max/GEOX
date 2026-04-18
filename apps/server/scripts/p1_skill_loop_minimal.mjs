import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3001";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const TOKEN_CANDIDATE_FILES = [
  path.join(REPO_ROOT, "config/auth/ao_act_tokens_v0.json"),
  path.join(REPO_ROOT, "config/auth/example_tokens.json"),
];
const REQUIRED_SCOPES_FOR_P1_SMOKE = Object.freeze([
  "ao_act.task.write",
  "ao_act.index.read",
  "ao_act.receipt.write",
  "evidence_export.read",
  "evidence_export.write",
]);
const EXPECTED_TENANT = String(process.env.GEOX_TENANT_ID ?? "tenantA").trim() || "tenantA";
const EXPECTED_PROJECT = String(process.env.GEOX_PROJECT_ID ?? "projectA").trim() || "projectA";
const EXPECTED_GROUP = String(process.env.GEOX_GROUP_ID ?? "groupA").trim() || "groupA";

function parseTokenFile(tokenFilePath) {
  if (!fs.existsSync(tokenFilePath)) return null;
  const parsed = JSON.parse(fs.readFileSync(tokenFilePath, "utf8"));
  const tokens = Array.isArray(parsed?.tokens) ? parsed.tokens : [];
  for (const row of tokens) {
    const token = typeof row?.token === "string" ? row.token.trim() : "";
    const scopes = Array.isArray(row?.scopes) ? row.scopes.map((s) => String(s)) : [];
    const role = String(row?.role ?? "").trim().toLowerCase();
    const tenant = String(row?.tenant_id ?? "").trim();
    const project = String(row?.project_id ?? "").trim();
    const group = String(row?.group_id ?? "").trim();
    const revoked = Boolean(row?.revoked);
    if (!token || revoked) continue;
    if (token.includes("set-via-env-or-external-secret-file")) continue;
    if (tenant !== EXPECTED_TENANT || project !== EXPECTED_PROJECT || group !== EXPECTED_GROUP) continue;
    if (!["admin", "operator"].includes(role)) continue;
    if (!REQUIRED_SCOPES_FOR_P1_SMOKE.every((scope) => scopes.includes(scope))) continue;
    return token;
  }
  return null;
}

function resolveAccessToken() {
  const fromEnv = String(process.env.GEOX_TOKEN ?? process.env.GEOX_AO_ACT_TOKEN ?? "").trim();
  if (fromEnv) return fromEnv;
  for (const tokenFilePath of TOKEN_CANDIDATE_FILES) {
    const candidate = parseTokenFile(tokenFilePath);
    if (candidate) return candidate;
  }
  throw new Error(
    `MISSING_ENV:GEOX_TOKEN (fallback checked: ${TOKEN_CANDIDATE_FILES.join(", ")})`,
  );
}

const TOKEN = resolveAccessToken();
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
const SMOKE_SUCCESS_BIND_TARGET = `field_p1_smoke_success_${Date.now()}`;
const SMOKE_FAILURE_BIND_TARGET = `field_p1_smoke_failure_${Date.now()}`;
const SMOKE_SUCCESS_ACCEPTANCE_CONFIG_PATCH = Object.freeze({
  smoke: true,
  lane: "success",
  strict_mode: false,
  min_evidence_count: 0,
});
const SMOKE_FAILURE_ACCEPTANCE_CONFIG_PATCH = Object.freeze({
  smoke: true,
  lane: "failure",
  strict_mode: true,
  min_evidence_count: 2,
});
const SUCCESS_LANE_FINAL_STATUSES = Object.freeze(["PENDING_ACCEPTANCE", "SUCCESS", "SUCCEEDED", "VALID"]);
const SUCCESS_TERMINAL_FINAL_STATUSES = Object.freeze(["SUCCESS", "SUCCEEDED", "VALID"]);

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

function isRetryableNetworkError(err) {
  const code = String(err?.cause?.code ?? err?.code ?? "").toUpperCase();
  if (["UND_ERR_SOCKET", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE"].includes(code)) return true;
  const message = String(err?.message ?? "").toLowerCase();
  return message.includes("fetch failed") || message.includes("socket");
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

async function requestWithRetry(path, init = {}, options = {}) {
  const retries = Number(options.retries ?? 4);
  const baseDelayMs = Number(options.baseDelayMs ?? 250);
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await request(path, init);
    } catch (err) {
      const isLast = attempt >= retries;
      if (isLast || !isRetryableNetworkError(err)) throw err;
      const waitMs = baseDelayMs * (attempt + 1);
      console.warn(`[p1-smoke][RETRY] path=${path} attempt=${attempt + 1}/${retries + 1} wait_ms=${waitMs} reason=${String(err?.cause?.code ?? err?.message ?? "unknown")}`);
      await sleep(waitMs);
    }
  }
  throw new Error(`requestWithRetry exhausted: ${path}`);
}

async function waitForServerHealth(maxWaitMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`, { method: "GET", headers: { accept: "application/json" } });
      if (res.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`[p1-smoke] server not ready: ${BASE_URL}/api/health timeout ${maxWaitMs}ms`);
}

async function ensureSkillBinding() {
  const dispatchBindTarget = `p1_smoke_${Date.now()}`;
  await requestWithRetry("/api/v1/skills/bindings", {
    method: "POST",
    body: JSON.stringify({
      ...tenant,
      skill_id: "p1_smoke_dispatch_skill",
      version: "v1",
      category: "DEVICE",
      scope_type: "TENANT",
      trigger_stage: "before_dispatch",
      bind_target: dispatchBindTarget,
      enabled: true,
      priority: 1,
      config_patch: { smoke: true },
    }),
  });

  // Smoke-only acceptance bindings: do not change production/default tenant strategy.
  await requestWithRetry("/api/v1/skills/bindings", {
    method: "POST",
    body: JSON.stringify({
      ...tenant,
      skill_id: "operation_acceptance_gate_v1",
      version: "1.0.0",
      category: "ACCEPTANCE",
      scope_type: "FIELD",
      trigger_stage: "before_acceptance",
      bind_target: SMOKE_SUCCESS_BIND_TARGET,
      enabled: true,
      priority: 999,
      config_patch: SMOKE_SUCCESS_ACCEPTANCE_CONFIG_PATCH,
    }),
  });

  await requestWithRetry("/api/v1/skills/bindings", {
    method: "POST",
    body: JSON.stringify({
      ...tenant,
      skill_id: "operation_acceptance_gate_v1",
      version: "1.0.0",
      category: "ACCEPTANCE",
      scope_type: "FIELD",
      trigger_stage: "before_acceptance",
      bind_target: SMOKE_FAILURE_BIND_TARGET,
      enabled: true,
      priority: 999,
      config_patch: SMOKE_FAILURE_ACCEPTANCE_CONFIG_PATCH,
    }),
  });

  const listing = await requestWithRetry("/api/v1/skills/bindings", { method: "GET" });
  const effective = listing.items_effective ?? [];
  const foundDispatch = effective.some((item) => item.bind_target === dispatchBindTarget);
  const foundSuccess = effective.some((item) => item.bind_target === SMOKE_SUCCESS_BIND_TARGET && String(item.skill_id) === "operation_acceptance_gate_v1");
  const foundFailure = effective.some((item) => item.bind_target === SMOKE_FAILURE_BIND_TARGET && String(item.skill_id) === "operation_acceptance_gate_v1");
  assert.ok(foundDispatch, "skills/bindings 链路失败：未找到 dispatch smoke binding");
  assert.ok(foundSuccess, "skills/bindings 链路失败：未找到 success smoke acceptance binding");
  assert.ok(foundFailure, "skills/bindings 链路失败：未找到 failure smoke acceptance binding");
}

async function createOperation(actionType, suffix, fieldId) {
  const commandId = `p1_skill_loop_${suffix}_${Date.now()}`;
  const parameters = { duration_sec: 30 }; // 最小合法参数集：仅保留 duration_sec。
  preflightAssertAoActTaskMinimalSchema(parameters, actionType);
  const body = {
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    field_id: fieldId,
    device_id: DEVICE_ID,
    action_type: actionType,
    adapter_type: ADAPTER_TYPE,
    parameters,
    issuer: { kind: "human", id: "smoke_user", namespace: "qa" },
    command_id: commandId,
    meta: { smoke: "p1", case: suffix, device_id: DEVICE_ID, adapter_type: ADAPTER_TYPE },
  };
  const out = await requestWithRetry("/api/v1/operations/manual", {
    step: "manual_create",
    method: "POST",
    body: JSON.stringify(body),
  });
  assert.ok(out.operation_plan_id, "operation 创建失败：缺少 operation_plan_id");
  return { commandId, operationPlanId: out.operation_plan_id };
}

async function waitForTask(operationPlanId) {
  for (let i = 0; i < 10; i += 1) {
    const detail = await requestWithRetry(`/api/v1/operations/${encodeURIComponent(operationPlanId)}/detail`, { method: "GET" });
    const taskId = detail?.operation?.act_task_id;
    if (taskId) {
      return {
        taskId,
        detail,
      };
    }
    await sleep(300);
  }
  throw new Error(`operation ${operationPlanId} 未就绪：无法读取 act_task_id`);
}

async function submitReceipt(operationPlanId, actTaskId, evidenceKinds, fieldId) {
  const now = Date.now();
  const logsRefs = evidenceKinds.map((kind, idx) => ({
    kind,
    ref: `${idx % 2 === 0 ? "log" : "evidence"}://${operationPlanId}/${kind}/${idx + 1}`,
  }));
  return requestWithRetry("/api/control/ao_act/receipt", {
    method: "POST",
    body: JSON.stringify({
      ...tenant,
      operation_plan_id: operationPlanId,
      act_task_id: actTaskId,
      executor_id: { kind: "script", id: "p1_smoke_executor", namespace: "qa" },
      execution_time: { start_ts: now - 2000, end_ts: now },
      execution_coverage: { kind: "field", ref: fieldId },
      resource_usage: { fuel_l: 0, electric_kwh: 0.2, water_l: 15, chemical_ml: 0 },
      logs_refs: logsRefs,
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

async function waitForAcceptanceResolution(operationPlanId) {
  let seenPendingAcceptance = false;
  for (let i = 0; i < 20; i += 1) {
    const state = await waitForFinalState(operationPlanId);
    const status = String(state.finalStatus ?? "").toUpperCase();
    const successMappedBy = resolveSuccessFinalStatus(status);
    if (successMappedBy === "PENDING_ACCEPTANCE") {
      seenPendingAcceptance = true;
      await sleep(300);
      continue;
    }
    if (successMappedBy) {
      return { ...state, seenPendingAcceptance };
    }
    if (status) {
      return { ...state, seenPendingAcceptance };
    }
    await sleep(300);
  }
  throw new Error(
    `operation ${operationPlanId} receipt 后未进入 success 态(${SUCCESS_LANE_FINAL_STATUSES.join("|")})`,
  );
}

async function setDispatchState(actTaskId, state) {
  const body = {
    ...tenant,
    act_task_id: actTaskId,
    command_id: actTaskId,
    state,
  };
  const res = await fetch(`${BASE_URL}/api/v1/ao-act/dispatches/state`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const json = (() => {
    if (!text) return {};
    try { return JSON.parse(text); } catch { return { raw: text }; }
  })();
  if (res.status === 409 && String(json?.error ?? "").toUpperCase() === "STATE_TRANSITION_DENIED") {
    console.warn(`[p1-smoke] dispatch state ${state} denied for task=${actTaskId}, continue with current state`);
    return { ok: false, skipped: true, reason: "STATE_TRANSITION_DENIED" };
  }
  if (!res.ok) {
    throw new Error(`dispatch state failed: HTTP ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

async function waitForFinalState(operationPlanId) {
  for (let i = 0; i < 10; i += 1) {
    const list = await requestWithRetry("/api/v1/operations", { method: "GET" });
    const item = (list.items ?? []).find((x) => x.operation_plan_id === operationPlanId || x.operation_id === operationPlanId);
    if (item?.final_status) {
      return {
        finalStatus: String(item.final_status).toUpperCase(),
        item,
      };
    }
    await sleep(300);
  }
  throw new Error(`operation_state 查询失败：${operationPlanId} 无 final_status`);
}

function isSuccessMapped(status) {
  const s = String(status ?? "").toUpperCase();
  return SUCCESS_LANE_FINAL_STATUSES.includes(s);
}

function resolveSuccessFinalStatus(status) {
  const s = String(status ?? "").toUpperCase();
  return isSuccessMapped(s) ? s : null;
}

function sanitizeParametersForSmoke(actionType, raw) {
  const allowlistByActionType = {
    IRRIGATE: new Set(["duration_sec"]),
  };
  const allowlist = allowlistByActionType[String(actionType ?? "").toUpperCase()] ?? new Set();
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw).filter(([key]) => allowlist.has(key)));
}

function buildMinimalDiagnostics(input) {
  const acceptance = input?.acceptance ?? {};
  const evidenceBundle = input?.evidence_bundle ?? {};
  return {
    lane: input?.lane ?? "unknown",
    operation_plan_id: input?.operation_plan_id ?? null,
    receipt_status: input?.receipt_status ?? null,
    final_status: input?.final_status ?? null,
    invalid_reason: input?.invalid_reason ?? null,
    acceptance: {
      verdict: acceptance.verdict ?? null,
      missing_evidence: acceptance.missing_evidence ?? [],
      summary: acceptance.summary ?? null,
    },
    evidence_bundle: {
      logs_count: Number(evidenceBundle.logs_count ?? 0),
      report_json_present: Boolean(evidenceBundle.report_json_present ?? false),
    },
    base_url: BASE_URL,
    tenant,
  };
}

async function main() {
  // 脚本级自测：success 为 PENDING_ACCEPTANCE 也应视为通过；
  // 同时 invalid lane 仍要求 INVALID_EXECUTION（见下方最终断言）。
  assert.equal(resolveSuccessFinalStatus("PENDING_ACCEPTANCE"), "PENDING_ACCEPTANCE", "自测失败：PENDING_ACCEPTANCE 应命中 success 映射");

  console.log(`[p1-smoke] base=${BASE_URL}`);
  await waitForServerHealth();
  await ensureSkillBinding();
  let successOp = null;
  let successFinal = "FAILED";
  let successAttempts = 0;
  let successReceiptLast = null;
  let successFinalStateLast = null;
  let successDiagnostics = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    successAttempts = attempt;
    successOp = await createOperation("IRRIGATE", `success_${attempt}`, SMOKE_SUCCESS_BIND_TARGET);
    const successTask = await waitForTask(successOp.operationPlanId);
    const successTaskId = successTask.taskId;
    console.log("[p1-smoke][success][waitTask]", {
      attempt,
      operation_plan_id: successOp.operationPlanId,
      act_task_id: successTaskId,
      detail_task: successTask?.detail?.operation?.task ?? successTask?.detail?.task ?? null,
      detail_status: successTask?.detail?.operation?.final_status ?? successTask?.detail?.final_status ?? null,
    });
    const successDispatchState = await setDispatchState(successTaskId, "ACKED");
    console.log("[p1-smoke][success][setDispatchState]", { attempt, ...successDispatchState });
    const successEvidenceKinds = [
      "dispatch_ack",
      "valve_open_confirmation",
      "water_delivery_receipt",
    ];
    const successReceipt = await submitReceipt(
      successOp.operationPlanId,
      successTaskId,
      successEvidenceKinds,
      SMOKE_SUCCESS_BIND_TARGET,
    );
    successReceiptLast = successReceipt;
    const expectedRequirements = Array.isArray(successReceipt?.expected_requirements)
      ? successReceipt.expected_requirements
      : Array.isArray(successReceipt?.acceptance?.expected_requirements)
        ? successReceipt.acceptance.expected_requirements
        : [];
    const providedKinds = Array.isArray(successReceipt?.provided_kinds)
      ? successReceipt.provided_kinds
      : Array.isArray(successReceipt?.acceptance?.provided_kinds)
        ? successReceipt.acceptance.provided_kinds
        : [];
    if (expectedRequirements.length > 0) {
      const missing = expectedRequirements.filter((kind) => !providedKinds.includes(kind));
      assert.equal(
        missing.length,
        0,
        `success receipt 缺少 expected_requirements 对应证据：missing=${JSON.stringify(missing)}`,
      );
    }
    console.log("[p1-smoke][success][submitReceipt]", { attempt, ...successReceipt });
    const successFinalState = await waitForAcceptanceResolution(successOp.operationPlanId);
    successFinalStateLast = successFinalState;
    successFinal = successFinalState.finalStatus;
    const successReportRefs = Array.isArray(successFinalState?.item?.report_json?.evidence_refs)
      ? successFinalState.item.report_json.evidence_refs
      : [];
    assert.ok(
      successReportRefs.length > 0,
      `success smoke 回归失败：report_json.evidence_refs 为空 operation=${successOp.operationPlanId}`,
    );
    console.log("[p1-smoke][success][waitFinal]", {
      attempt,
      ...successFinalState,
      smoke_interpretation:
        successFinal === "PENDING_ACCEPTANCE"
          ? "执行已完成、证据已入链、待验收（链路 smoke 判定：通过）"
          : null,
    });
    if (isSuccessMapped(successFinal)) break;
    console.warn(`[p1-smoke][success] attempt=${attempt} final=${successFinal}, retrying success lane...`);
  }
  if (!successOp) throw new Error("success lane did not produce operation");

  const invalidOp = await createOperation("IRRIGATE", "invalid", SMOKE_FAILURE_BIND_TARGET);
  const invalidTask = await waitForTask(invalidOp.operationPlanId);
  const invalidTaskId = invalidTask.taskId;
  await setDispatchState(invalidTaskId, "ACKED");
  await submitReceipt(invalidOp.operationPlanId, invalidTaskId, ["sim_trace"], SMOKE_FAILURE_BIND_TARGET);
  const invalidFinalState = await waitForFinalState(invalidOp.operationPlanId);
  const invalidFinal = invalidFinalState.finalStatus;

  const statuses = [successFinal, invalidFinal];
  const hasSuccessMapped = statuses.some((x) => isSuccessMapped(x));
  const hasInvalidExecution = statuses.some((x) => x === "INVALID_EXECUTION");
  const successMappedHit = resolveSuccessFinalStatus(successFinal);
  const invalidDiagnostics = buildMinimalDiagnostics({
    lane: "invalid",
    operation_plan_id: invalidOp?.operationPlanId ?? null,
    receipt_status: "executed",
    final_status: invalidFinal,
    invalid_reason: invalidFinalState?.item?.invalid_reason ?? invalidFinalState?.item?.acceptance?.invalid_reason ?? null,
    acceptance: {
      verdict: invalidFinalState?.item?.acceptance?.verdict ?? invalidFinalState?.item?.acceptance?.status ?? null,
      missing_evidence: invalidFinalState?.item?.acceptance?.missing_evidence ?? [],
      summary: invalidFinalState?.item?.acceptance?.summary ?? null,
    },
    evidence_bundle: {
      logs_count: 1,
      report_json_present: Boolean(invalidFinalState?.item?.report_json),
    },
  });
  successDiagnostics = buildMinimalDiagnostics({
    lane: "success",
    operation_plan_id: successOp?.operationPlanId,
    receipt_status: successReceiptLast?.status ?? successReceiptLast?.acceptance?.status ?? null,
    final_status: successFinal,
    invalid_reason: null,
    acceptance: {
      verdict: successFinalStateLast?.item?.acceptance?.verdict ?? successFinalStateLast?.item?.acceptance?.status ?? null,
      missing_evidence: successFinalStateLast?.item?.acceptance?.missing_evidence ?? [],
      summary: successFinalStateLast?.item?.acceptance?.summary ?? successFinalStateLast?.item?.report_json?.summary ?? null,
    },
    evidence_bundle: {
      logs_count: Array.isArray(successReceiptLast?.logs_refs) ? successReceiptLast.logs_refs.length : 0,
      report_json_present: Boolean(successFinalStateLast?.item?.report_json),
    },
  });

  assert.ok(hasSuccessMapped, `断言失败：至少 1 条 final_status=PENDING_ACCEPTANCE|SUCCESS|SUCCEEDED|VALID（映射后）；actual=${JSON.stringify(statuses)}；diagnostics=${JSON.stringify({ success: successDiagnostics, invalid: invalidDiagnostics })}`);
  assert.ok(hasInvalidExecution, `断言失败：至少 1 条 final_status=INVALID_EXECUTION；actual=${JSON.stringify(statuses)}；diagnostics=${JSON.stringify({ success: successDiagnostics, invalid: invalidDiagnostics })}`);

  console.log("[p1-smoke] done", {
    bindings: { success: SMOKE_SUCCESS_BIND_TARGET, failure: SMOKE_FAILURE_BIND_TARGET },
    success: {
      operation_plan_id: successOp?.operationPlanId,
      final_status: successFinal,
      success_mapped_by: successMappedHit,
      attempts: successAttempts,
    },
    invalid: { operation_plan_id: invalidOp.operationPlanId, final_status: invalidFinal },
  });
  console.log(
    `[p1-smoke] RESULT_JSON ${JSON.stringify({
      success_operation_plan_id: successOp?.operationPlanId ?? null,
      invalid_operation_plan_id: invalidOp?.operationPlanId ?? null,
      success_final_status: successFinal,
      invalid_final_status: invalidFinal,
    })}`,
  );

  if (successFinal === "PENDING_ACCEPTANCE") {
    console.log("[p1-smoke][success] 执行已完成，证据已入链，待验收；作为链路 smoke 判定：通过");
  } else if (SUCCESS_TERMINAL_FINAL_STATUSES.includes(successFinal)) {
    console.log("[p1-smoke][success] 已进入成功终态；链路 smoke：通过");
  }
  if (invalidFinal === "INVALID_EXECUTION") {
    console.log("[p1-smoke][invalid] 命中预期状态 INVALID_EXECUTION；负向路径验证通过");
  }

  assert.ok(
    isSuccessMapped(successFinal),
    `断言失败：success case final_status 仅接受 PENDING_ACCEPTANCE|SUCCESS|SUCCEEDED|VALID；actual=${JSON.stringify(statuses)}；diagnostics=${JSON.stringify(successDiagnostics)}`,
  );
  assert.equal(
    invalidFinal,
    "INVALID_EXECUTION",
    `断言失败：failure case final_status 必须为 INVALID_EXECUTION；actual=${JSON.stringify(statuses)}；diagnostics=${JSON.stringify(invalidDiagnostics)}`,
  );

  console.log("[p1-smoke] done", statuses);
}

main().catch((err) => {
  const minimalDiagnostics = buildMinimalDiagnostics({
    lane: "unknown",
  });
  console.error("[p1-smoke] minimal_diagnostics", minimalDiagnostics);
  console.error("[p1-smoke] failed", err);
  process.exitCode = 1;
});
