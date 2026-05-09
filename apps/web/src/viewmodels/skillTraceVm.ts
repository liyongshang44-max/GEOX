export type SkillTraceInput = unknown;

export type CustomerSkillTraceSourceVm = {
  label: string;
  summary: string;
};

export type CustomerSkillTraceFoldoutVm = {
  title: string;
  summary: string;
  sources: CustomerSkillTraceSourceVm[];
  emptyText: string;
};

export type OperatorSkillTraceRunVm = {
  key: string;
  skillId: string;
  skillVersion: string;
  classification: string;
  bindingScope: string;
  lastRunStatus: string;
  failureReason: string;
  inputSummary: string;
  outputSummary: string;
  traceRef: string;
};

export type OperatorSkillTracePanelVm = {
  title: string;
  summary: string;
  runs: OperatorSkillTraceRunVm[];
  failureRuns: OperatorSkillTraceRunVm[];
  emptyText: string;
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

function arrayFrom(value: unknown): AnyRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value)) return [value];
  return [];
}

function nestedArraysFrom(input: unknown): AnyRecord[] {
  if (!isRecord(input)) return arrayFrom(input);
  const candidates = [
    input.skill_trace,
    input.skillTrace,
    input.skill_traces,
    input.skillTraces,
    input.skill_runs,
    input.skillRuns,
    input.runs,
    input.trace,
    input.explain?.skill_trace,
    input.explain?.skillTrace,
    input.explain?.sources,
    input.decision_sources,
    input.sources,
  ];
  const rows = candidates.flatMap(arrayFrom);
  if (rows.length) return rows;
  return [input];
}

function classificationLabel(value: unknown): string {
  const raw = text(value, "UNKNOWN").toUpperCase();
  if (raw === "AGRONOMY" || raw === "AGRONOMY_SKILL") return "农艺能力";
  if (raw === "SENSING" || raw === "SENSING_SKILL") return "感知能力";
  if (raw === "DEVICE" || raw === "DEVICE_SKILL") return "设备能力";
  if (raw === "ACCEPTANCE" || raw === "ACCEPTANCE_SKILL") return "验收能力";
  if (raw === "UNKNOWN") return "能力类型待确认";
  return text(value, "能力类型待确认");
}

function sourceSummary(row: AnyRecord): CustomerSkillTraceSourceVm {
  const classification = classificationLabel(row.classification ?? row.skill_classification ?? row.type);
  const reason = text(row.source_summary ?? row.summary ?? row.reason ?? row.description, "用于形成本次判断的能力来源。");
  return {
    label: classification,
    summary: reason,
  };
}

function normalizeStatus(value: unknown): string {
  const raw = text(value, "UNKNOWN").toUpperCase();
  if (raw === "SUCCESS" || raw === "SUCCEEDED" || raw === "OK") return "运行成功";
  if (raw === "FAILED" || raw === "ERROR") return "运行失败";
  if (raw === "TIMEOUT") return "运行超时";
  if (raw === "SKIPPED") return "已跳过";
  if (raw === "UNKNOWN") return "状态待确认";
  return text(value, "状态待确认");
}

function bindingScope(row: AnyRecord): string {
  const scope = row.binding_scope ?? row.scope ?? row.binding?.scope;
  if (typeof scope === "string") return text(scope, "绑定范围待确认");
  if (isRecord(scope)) {
    const tenant = text(scope.tenant_id ?? scope.tenantId, "tenant=* ");
    const crop = text(scope.crop_id ?? scope.cropId ?? scope.crop, "crop=* ");
    const field = text(scope.field_id ?? scope.fieldId, "");
    return [tenant, crop, field].filter(Boolean).join(" · ");
  }
  const parts = [
    text(row.tenant_id ?? row.tenantId, ""),
    text(row.crop_id ?? row.cropId ?? row.crop, ""),
    text(row.field_id ?? row.fieldId, ""),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "绑定范围待确认";
}


function summaryText(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  if (typeof value === "string") return text(value, fallback);
  if (Array.isArray(value)) return value.length ? value.slice(0, 3).map((x) => text(x)).join("；") : fallback;
  if (isRecord(value)) {
    const parts = Object.entries(value).slice(0, 4).map(([k,v]) => `${k}:${text(v)}`);
    return parts.length ? parts.join("；") : fallback;
  }
  return fallback;
}

function failureReason(row: AnyRecord): string {
  const reason = text(row.failure_reason ?? row.error_reason ?? row.error_message ?? row.last_error ?? row.reason, "");
  if (!reason) return "无失败原因";
  if (/stack\s*trace|error\.stack/i.test(reason)) return "失败原因已隐藏，详见服务端审计日志。";
  return reason.length > 220 ? `${reason.slice(0, 180)}...` : reason;
}

function operatorRun(row: AnyRecord, index: number): OperatorSkillTraceRunVm {
  const skillId = text(row.skill_id ?? row.skillId ?? row.id, `skill-${index}`);
  const skillVersion = text(row.skill_version ?? row.version ?? row.skillVersion, "版本待确认");
  const classification = classificationLabel(row.classification ?? row.skill_classification ?? row.type);
  const lastRunStatus = normalizeStatus(row.last_run_status ?? row.status ?? row.run_status);
  return {
    key: `${skillId}-${skillVersion}-${index}`,
    skillId,
    skillVersion,
    classification,
    bindingScope: bindingScope(row),
    lastRunStatus,
    failureReason: failureReason(row),
    inputSummary: summaryText(row.input_summary ?? row.input ?? row.request_input, "输入摘要待确认"),
    outputSummary: summaryText(row.output_summary ?? row.output ?? row.response_output, "输出摘要待确认"),
    traceRef: text(row.trace_ref ?? row.skill_trace_ref ?? row.trace_id ?? row.run_id, "trace_ref 待确认"),
  };
}

export function buildCustomerSkillTraceFoldoutVm(input: SkillTraceInput): CustomerSkillTraceFoldoutVm {
  const rows = nestedArraysFrom(input);
  const sources = rows.map(sourceSummary).filter((item) => item.summary || item.label);
  return {
    title: "决策依据来源",
    summary: sources.length ? `本次判断使用了 ${sources.length} 类能力来源。` : "暂无可展示的决策依据来源。",
    sources,
    emptyText: "暂无决策依据来源摘要。",
  };
}

export function buildOperatorSkillTracePanelVm(input: SkillTraceInput): OperatorSkillTracePanelVm {
  const runs = nestedArraysFrom(input).map(operatorRun);
  const failureRuns = runs.filter((run) => /失败|超时/.test(run.lastRunStatus) || run.failureReason !== "无失败原因");
  return {
    title: "Skill Trace 技术详情",
    summary: runs.length ? `共 ${runs.length} 条 skill run 记录，失败/异常 ${failureRuns.length} 条。` : "暂无 skill run 记录。",
    runs,
    failureRuns,
    emptyText: "暂无 skill run 详情。",
  };
}
