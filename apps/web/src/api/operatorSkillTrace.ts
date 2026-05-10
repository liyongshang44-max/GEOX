import { apiRequestWithPolicy, withQuery } from "./client";

export type OperatorSkillTraceDataScope = "OFFICIAL_OPERATOR_API" | "NOT_READY_EMPTY" | "ERROR_EMPTY";
export type OperatorSkillTraceStatus = "SUCCESS" | "FAILED" | "TIMEOUT" | "SKIPPED" | "UNKNOWN";
export type OperatorSkillClassification = "AGRONOMY" | "SENSING" | "DEVICE" | "ACCEPTANCE" | "UNKNOWN";

export type OperatorSkillTraceRun = {
  skillId: string;
  skillName: string;
  skillVersion: string;
  classification: OperatorSkillClassification;
  bindingScope: string;
  runStage: string;
  lastRunStatus: OperatorSkillTraceStatus;
  failureReason: string | null;
  inputSummary: string | null;
  outputSummary: string | null;
  evidenceRef: string | null;
  enteredLearning: boolean | null;
  traceRef: string | null;
  operationId: string | null;
  fieldId: string | null;
  createdAt: string | null;
  source: "operator_skill_traces";
};

export type OperatorSkillTraceResponse = {
  source: "operator_skill_traces" | "empty_not_ready" | "empty_error";
  dataScope: OperatorSkillTraceDataScope;
  generated_at: string;
  operationId: string;
  items: OperatorSkillTraceRun[];
  message: string;
  notReady: boolean;
};

export type OperatorSkillPerformanceItem = {
  skillId: string;
  fieldId: string | null;
  operationId: string | null;
  runCount: number | null;
  successCount: number | null;
  failureCount: number | null;
  successRate: number | null;
  lastRunStatus: OperatorSkillTraceStatus;
  lastRunAt: string | null;
  performanceSummary: string | null;
  source: "operator_skill_performance";
};

export type OperatorSkillPerformanceResponse = {
  source: "operator_skill_performance" | "empty_not_ready" | "empty_error";
  dataScope: OperatorSkillTraceDataScope;
  generated_at: string;
  skillId: string;
  fieldId: string;
  operationId: string;
  items: OperatorSkillPerformanceItem[];
  message: string;
  notReady: boolean;
};

type AnyRecord = Record<string, any>;

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  return raw;
}

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function arrayFrom(payload: unknown, keys: string[]): AnyRecord[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  if (isRecord(payload.data)) return arrayFrom(payload.data, keys);
  if (Array.isArray(payload.items)) return payload.items.filter(isRecord);
  return [];
}

function normalizeClassification(value: unknown): OperatorSkillClassification {
  const raw = text(value, "UNKNOWN").toUpperCase();
  if (raw === "AGRONOMY" || raw === "AGRONOMY_SKILL") return "AGRONOMY";
  if (raw === "SENSING" || raw === "SENSING_SKILL") return "SENSING";
  if (raw === "DEVICE" || raw === "DEVICE_SKILL") return "DEVICE";
  if (raw === "ACCEPTANCE" || raw === "ACCEPTANCE_SKILL") return "ACCEPTANCE";
  return "UNKNOWN";
}

function normalizeStatus(value: unknown): OperatorSkillTraceStatus {
  const raw = text(value, "UNKNOWN").toUpperCase();
  if (raw === "SUCCESS" || raw === "SUCCEEDED" || raw === "OK") return "SUCCESS";
  if (raw === "FAILED" || raw === "ERROR") return "FAILED";
  if (raw === "TIMEOUT") return "TIMEOUT";
  if (raw === "SKIPPED") return "SKIPPED";
  return "UNKNOWN";
}

function safeReason(value: unknown): string | null {
  const raw = text(value, "");
  if (!raw) return null;
  if (/stack\s*trace|error\.stack|private\s*key|secret|token|credential|password|access[_-]?key/i.test(raw)) return "失败原因已隐藏，详见服务端审计日志。";
  return raw.length > 240 ? `${raw.slice(0, 220)}...` : raw;
}

function safeSummary(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return text(value, "") || null;
  if (Array.isArray(value)) {
    const parts = value.slice(0, 4).map((item) => text(item, "")).filter(Boolean);
    return parts.length ? parts.join("；") : null;
  }
  if (isRecord(value)) {
    const parts = Object.entries(value)
      .filter(([key]) => !/secret|token|credential|password|access[_-]?key|path/i.test(key))
      .slice(0, 5)
      .map(([key, item]) => `${key}:${text(item, "")}`)
      .filter((item) => !item.endsWith(":"));
    return parts.length ? parts.join("；") : null;
  }
  return null;
}

function safeRef(value: unknown): string | null {
  const raw = text(value, "");
  if (!raw) return null;
  if (/secret|token|credential|password|access[_-]?key|private\s*key/i.test(raw)) return "引用已隐藏";
  return raw.length > 120 ? `${raw.slice(0, 96)}...` : raw;
}

function normalizeLearningFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const raw = text(value, "").toUpperCase();
  if (!raw) return null;
  if (["TRUE", "YES", "Y", "1", "ENTERED", "INCLUDED", "USED_FOR_LEARNING"].includes(raw)) return true;
  if (["FALSE", "NO", "N", "0", "EXCLUDED", "NOT_INCLUDED", "SKIPPED"].includes(raw)) return false;
  return null;
}

function bindingScope(row: AnyRecord): string {
  const scope = row.binding_scope ?? row.scope ?? row.binding?.scope;
  if (typeof scope === "string") return text(scope, "绑定范围待确认");
  if (isRecord(scope)) {
    const parts = [
      text(scope.tenant_id ?? scope.tenantId, ""),
      text(scope.crop_id ?? scope.cropId ?? scope.crop, ""),
      text(scope.field_id ?? scope.fieldId, ""),
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "绑定范围待确认";
  }
  const parts = [
    text(row.tenant_id ?? row.tenantId, ""),
    text(row.crop_id ?? row.cropId ?? row.crop, ""),
    text(row.field_id ?? row.fieldId, ""),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "绑定范围待确认";
}

function normalizeRunStage(row: AnyRecord): string {
  const raw = text(row.run_stage ?? row.stage ?? row.phase ?? row.lifecycle_stage ?? row.step, "");
  if (raw) return raw;
  const classification = normalizeClassification(row.classification ?? row.skill_classification ?? row.type);
  if (classification === "AGRONOMY") return "农艺诊断 / 推荐";
  if (classification === "DEVICE") return "执行 / 设备动作";
  if (classification === "SENSING") return "感知 / 数据读取";
  if (classification === "ACCEPTANCE") return "验收 / 结果判断";
  return "运行阶段待确认";
}

function normalizeTraceRun(row: AnyRecord, index: number): OperatorSkillTraceRun {
  const skillId = text(row.skill_id ?? row.skillId ?? row.id, `skill-${index + 1}`);
  return {
    skillId,
    skillName: text(row.skill_name ?? row.skillName ?? row.display_name ?? row.name, skillId),
    skillVersion: text(row.skill_version ?? row.version ?? row.skillVersion, "版本待确认"),
    classification: normalizeClassification(row.classification ?? row.skill_classification ?? row.type),
    bindingScope: bindingScope(row),
    runStage: normalizeRunStage(row),
    lastRunStatus: normalizeStatus(row.last_run_status ?? row.status ?? row.run_status),
    failureReason: safeReason(row.failure_reason ?? row.error_reason ?? row.error_message ?? row.last_error ?? row.reason),
    inputSummary: safeSummary(row.input_summary ?? row.input ?? row.request_input),
    outputSummary: safeSummary(row.output_summary ?? row.output ?? row.response_output),
    evidenceRef: safeRef(row.evidence_ref ?? row.evidenceRef ?? row.evidence_id ?? row.evidence_bundle_ref ?? row.evidenceBundleRef),
    enteredLearning: normalizeLearningFlag(row.entered_learning ?? row.in_learning ?? row.learning_included ?? row.used_for_learning ?? row.learning_status),
    traceRef: text(row.trace_ref ?? row.skill_trace_ref ?? row.trace_id ?? row.run_id, "") || null,
    operationId: text(row.operation_id ?? row.operationId, "") || null,
    fieldId: text(row.field_id ?? row.fieldId, "") || null,
    createdAt: text(row.created_at ?? row.createdAt ?? row.ts ?? row.timestamp, "") || null,
    source: "operator_skill_traces",
  };
}

function normalizeNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizePerformance(row: AnyRecord, index: number): OperatorSkillPerformanceItem {
  return {
    skillId: text(row.skill_id ?? row.skillId ?? row.id, `skill-${index + 1}`),
    fieldId: text(row.field_id ?? row.fieldId, "") || null,
    operationId: text(row.operation_id ?? row.operationId, "") || null,
    runCount: normalizeNumber(row.run_count ?? row.runCount ?? row.total_runs),
    successCount: normalizeNumber(row.success_count ?? row.successCount ?? row.success_runs),
    failureCount: normalizeNumber(row.failure_count ?? row.failureCount ?? row.failed_runs),
    successRate: normalizeNumber(row.success_rate ?? row.successRate),
    lastRunStatus: normalizeStatus(row.last_run_status ?? row.status ?? row.last_status),
    lastRunAt: text(row.last_run_at ?? row.lastRunAt ?? row.updated_at, "") || null,
    performanceSummary: safeSummary(row.performance_summary ?? row.summary ?? row.explain),
    source: "operator_skill_performance",
  };
}

function notReadyMessage(bodyText: string): string {
  const raw = text(bodyText, "");
  if (/skill trace|skill[-_\s]?trace|not[_\s-]?ready|not found|cannot get|route/i.test(raw)) return "skill trace 查询接口未接入。";
  return "skill trace 查询接口未接入。";
}

function emptySkillTrace(operationId: string, message = "skill trace 查询接口未接入。"): OperatorSkillTraceResponse {
  return {
    source: "empty_not_ready",
    dataScope: "NOT_READY_EMPTY",
    generated_at: new Date().toISOString(),
    operationId,
    items: [],
    message,
    notReady: true,
  };
}

function emptyPerformance(input: { skillId?: string; fieldId?: string; operationId?: string }, message = "skill trace 查询接口未接入。"): OperatorSkillPerformanceResponse {
  return {
    source: "empty_not_ready",
    dataScope: "NOT_READY_EMPTY",
    generated_at: new Date().toISOString(),
    skillId: input.skillId ?? "",
    fieldId: input.fieldId ?? "",
    operationId: input.operationId ?? "",
    items: [],
    message,
    notReady: true,
  };
}

export async function fetchOperatorSkillTraces(input: { operationId?: string }): Promise<OperatorSkillTraceResponse> {
  const operationId = text(input.operationId, "");
  if (!operationId) return emptySkillTrace("", "skill trace 查询接口未接入。");

  const result = await apiRequestWithPolicy<unknown>(
    withQuery("/api/v1/operator/skill-traces", { operation_id: operationId }),
    undefined,
    { allowedStatuses: [400, 404, 405, 422, 501, 503], silent: true, timeoutMs: 10000 },
  );

  if (!result.ok) return emptySkillTrace(operationId, notReadyMessage(result.bodyText));

  const rows = arrayFrom(result.data, ["items", "skill_traces", "skill_trace", "skill_runs", "runs"]);
  return {
    source: "operator_skill_traces",
    dataScope: "OFFICIAL_OPERATOR_API",
    generated_at: new Date().toISOString(),
    operationId,
    items: rows.map(normalizeTraceRun),
    message: rows.length ? "已读取 operator skill trace。" : "skill trace 查询接口未接入。",
    notReady: rows.length === 0,
  };
}

export async function fetchOperatorSkillPerformance(input: { skillId?: string; fieldId?: string; operationId?: string }): Promise<OperatorSkillPerformanceResponse> {
  const skillId = text(input.skillId, "");
  const fieldId = text(input.fieldId, "");
  const operationId = text(input.operationId, "");
  if (!skillId && !fieldId && !operationId) return emptyPerformance({ skillId, fieldId, operationId });

  const result = await apiRequestWithPolicy<unknown>(
    withQuery("/api/v1/operator/skill-performance", {
      skill_id: skillId,
      field_id: fieldId,
      operation_id: operationId,
    }),
    undefined,
    { allowedStatuses: [400, 404, 405, 422, 501, 503], silent: true, timeoutMs: 10000 },
  );

  if (!result.ok) return emptyPerformance({ skillId, fieldId, operationId }, notReadyMessage(result.bodyText));

  const rows = arrayFrom(result.data, ["items", "skill_performance", "performance", "rules", "rule_performance"]);
  return {
    source: "operator_skill_performance",
    dataScope: "OFFICIAL_OPERATOR_API",
    generated_at: new Date().toISOString(),
    skillId,
    fieldId,
    operationId,
    items: rows.map(normalizePerformance),
    message: rows.length ? "已读取 operator skill performance。" : "skill trace 查询接口未接入。",
    notReady: rows.length === 0,
  };
}
