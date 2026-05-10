import { safeEvidenceDownloadUrl } from "../lib/evidenceDownloadSafety";
import { apiRequestWithPolicy, withQuery } from "./client";

export type OperatorEvidenceDataScope = "OFFICIAL_OPERATOR_API" | "FALLBACK_LIMITED" | "EMPTY" | "ERROR_EMPTY";
export type OperatorEvidenceJobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED" | "UNKNOWN";
export type OperatorEvidenceStorageMode = "OBJECT_STORE" | "LOCAL" | "INLINE" | "NOT_READY" | "UNKNOWN";
export type OperatorEvidenceScopeStatus = "READY" | "NOT_READY" | "UNKNOWN";
export type OperatorEvidenceExportScopeType = "TENANT" | "DEVICE" | "FIELD";

export type OperatorEvidenceItem = {
  jobId: string;
  operationId?: string | null;
  scopeType?: string | null;
  scopeId?: string | null;
  scopeStatus: OperatorEvidenceScopeStatus;
  status: OperatorEvidenceJobStatus;
  manifestText?: string | null;
  sha256?: string | null;
  artifactText?: string | null;
  format?: string | null;
  storageMode: OperatorEvidenceStorageMode;
  downloadStatus?: string | null;
  downloadUrl?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
  failureReason?: string | null;
  source: "operator_evidence_api" | "evidence_export_jobs" | "reports_aggregate";
};

export type OperatorEvidenceResponse = {
  source: "operator_evidence_api" | "fallback_existing_sources" | "empty_error_state";
  dataScope: OperatorEvidenceDataScope;
  generated_at?: string | null;
  items: OperatorEvidenceItem[];
  message?: string;
  exportReady: boolean;
};

export type CreateOperatorEvidenceExportJobInput = {
  operation_id?: string | null;
  scope_type: OperatorEvidenceExportScopeType;
  scope_id: string;
  field_id?: string | null;
  from_ts_ms: number;
  to_ts_ms: number;
  export_format: string;
  export_language: string;
};

export type OperatorEvidenceExportJobCreateResponse = {
  ok: boolean;
  httpStatus: number;
  jobId: string;
  operationId?: string | null;
  jobStatus: OperatorEvidenceJobStatus;
  item: OperatorEvidenceItem | null;
  message: string;
  errorCode?: string | null;
};

export type OperatorEvidenceJobDetailResponse = {
  ok: boolean;
  httpStatus: number;
  item: OperatorEvidenceItem | null;
  message: string;
  errorCode?: string | null;
};

type AnyRecord = Record<string, any>;

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  return raw;
}

function arrayFrom(payload: unknown, keys: string[]): AnyRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is AnyRecord => Boolean(item && typeof item === "object"));
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as AnyRecord;
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) return value.filter((item): item is AnyRecord => Boolean(item && typeof item === "object"));
  }
  if (obj.data) return arrayFrom(obj.data, keys);
  if (obj.items) return arrayFrom(obj.items, keys);
  return [];
}

function maskInternal(value: unknown, fallback = "未提供"): string {
  const raw = text(value, "");
  if (!raw) return fallback;
  if (/^[A-Za-z]:\\/.test(raw) || raw.startsWith("/") || raw.includes("\\") || raw.includes("file://")) return "本地路径已隐藏";
  if (/access[_-]?key|secret|token|password/i.test(raw)) return "敏感凭据已隐藏";
  if (/s3:\/\//i.test(raw)) return "对象存储地址已隐藏";
  if (/https?:\/\//i.test(raw)) return "下载链接已隐藏";
  return raw.length > 96 ? `${raw.slice(0, 48)}...${raw.slice(-16)}` : raw;
}

function normalizeStatus(value: unknown): OperatorEvidenceJobStatus {
  const raw = text(value, "UNKNOWN").toUpperCase();
  if (raw === "DONE" || raw === "SUCCESS" || raw === "COMPLETED") return "DONE";
  if (raw === "FAILED" || raw === "ERROR") return "FAILED";
  if (raw === "RUNNING" || raw === "PROCESSING") return "RUNNING";
  if (raw === "PENDING" || raw === "QUEUED") return "PENDING";
  return "UNKNOWN";
}

function normalizeStorageMode(value: unknown): OperatorEvidenceStorageMode {
  const raw = text(value).toUpperCase();
  if (raw.includes("S3") || raw.includes("OBJECT") || raw.includes("MINIO")) return "OBJECT_STORE";
  if (raw.includes("LOCAL") || raw.includes("FILE")) return "LOCAL";
  if (raw.includes("INLINE")) return "INLINE";
  if (raw.includes("NOT_READY") || raw.includes("未接入")) return "NOT_READY";
  return "UNKNOWN";
}

function normalizeScopeStatus(row: AnyRecord): OperatorEvidenceScopeStatus {
  const raw = text(row.scope_status ?? row.operation_scope_status ?? row.scope_ready).toUpperCase();
  if (raw === "READY" || raw === "TRUE") return "READY";
  if (raw === "NOT_READY" || raw === "FALSE" || raw.includes("未接入")) return "NOT_READY";
  const scopeType = text(row.scope_type ?? row.scope?.type);
  const scopeId = text(row.scope_id ?? row.scope?.id);
  return scopeType && scopeId ? "READY" : "NOT_READY";
}

function manifestText(row: AnyRecord): string {
  const manifest = row.manifest ?? row.manifest_json ?? row.manifest_summary;
  if (!manifest) return "";
  if (typeof manifest === "string") return maskInternal(manifest, "manifest 未提供");
  if (typeof manifest === "object") {
    const keys = Object.keys(manifest).filter((key) => !/secret|token|access|path/i.test(key));
    return keys.length ? `manifest 字段：${keys.slice(0, 8).join("、")}` : "manifest 已形成";
  }
  return "manifest 已形成";
}

function artifactText(row: AnyRecord): string {
  const candidates = [row.artifact_id, row.artifact_ref, row.object_key, row.object_id, row.storage_key, row.bundle_key, row.path, row.download_url];
  const hit = candidates.map((item) => maskInternal(item, "")).find(Boolean);
  return hit || "artifact 标识未提供";
}

function normalizeItem(row: AnyRecord, index: number, source: OperatorEvidenceItem["source"]): OperatorEvidenceItem {
  const operationId = text(row.operation_id ?? row.operationId ?? row.scope?.operation_id, "");
  const status = normalizeStatus(row.status ?? row.job_status ?? row.export_status);
  const failureReason = text(row.failed_reason ?? row.failure_reason ?? row.error_message ?? row.error, "");
  const downloadUrl = safeEvidenceDownloadUrl(row.download_url ?? row.downloadUrl ?? row.download?.url ?? row.artifact?.download_url) ?? "";
  return {
    jobId: text(row.job_id ?? row.export_job_id ?? row.evidence_export_job_id ?? row.id, `${source}-${index}`),
    operationId,
    scopeType: text(row.scope_type ?? row.scope?.type, operationId ? "operation" : ""),
    scopeId: text(row.scope_id ?? row.scope?.id ?? operationId, ""),
    scopeStatus: normalizeScopeStatus(row),
    status,
    manifestText: manifestText(row),
    sha256: text(row.sha256 ?? row.checksum_sha256 ?? row.checksum, ""),
    artifactText: artifactText(row),
    format: text(row.format ?? row.export_format ?? row.bundle_format ?? row.content_type, "未提供"),
    storageMode: normalizeStorageMode(row.storage_mode ?? row.storage?.mode ?? row.object_store_mode),
    downloadStatus: downloadUrl ? "可下载：后端授权入口" : text(row.download_status ?? row.presign_status ?? row.download?.status, status === "DONE" ? "后端未返回安全下载入口" : "不可下载"),
    downloadUrl,
    createdAt: text(row.created_at ?? row.createdAt ?? row.generated_at, ""),
    completedAt: text(row.completed_at ?? row.completedAt ?? row.finished_at, ""),
    failureReason: status === "FAILED" ? (failureReason || "失败原因待补充") : failureReason,
    source,
  };
}

function normalizeOperator(payload: unknown): OperatorEvidenceItem[] {
  return arrayFrom(payload, ["items", "jobs", "export_jobs", "evidence"]).map((row, index) => normalizeItem(row, index, "operator_evidence_api"));
}

function normalizeExportJobs(payload: unknown): OperatorEvidenceItem[] {
  return arrayFrom(payload, ["items", "jobs", "export_jobs", "data"]).map((row, index) => normalizeItem(row, index, "evidence_export_jobs"));
}

function normalizeSingleOperatorItem(payload: unknown, fallbackIndex = 0): OperatorEvidenceItem | null {
  const rows = arrayFrom(payload, ["items", "jobs", "export_jobs", "data", "evidence"]);
  const row = rows[0] ?? (payload && typeof payload === "object" && !Array.isArray(payload) ? payload as AnyRecord : null);
  return row ? normalizeItem(row, fallbackIndex, "operator_evidence_api") : null;
}

function normalizeReportFallback(payload: unknown): OperatorEvidenceItem[] {
  const rows = arrayFrom(payload, ["recent_operations", "operations", "items"]);
  return rows.slice(0, 20).map((row, index) => {
    const operationId = text(row.operation_id ?? row.operation_plan_id ?? row.id, "");
    const evidenceStatus = `${row.evidence_status ?? ""} ${row.evidence_summary ?? ""}`.toUpperCase();
    const status: OperatorEvidenceJobStatus = evidenceStatus.includes("MISSING") || evidenceStatus.includes("INSUFFICIENT") ? "FAILED" : "UNKNOWN";
    return normalizeItem({
      ...row,
      job_id: operationId ? `operation-evidence-${operationId}` : `operation-evidence-${index}`,
      operation_id: operationId,
      scope_type: operationId ? "operation" : "not_ready",
      scope_id: operationId,
      scope_status: operationId ? "READY" : "NOT_READY",
      status,
      failure_reason: status === "FAILED" ? "证据不足或证据摘要缺失" : "",
      storage_mode: "NOT_READY",
      download_status: "operation scope 证据导出未接入",
      format: "未接入",
    }, index, "reports_aggregate");
  });
}

type OptionalApiResult = { ok: boolean; status: number; data: unknown | null; bodyText?: string };

async function fetchOptional(path: string): Promise<OptionalApiResult> {
  try {
    const result = await apiRequestWithPolicy<unknown>(path, undefined, { allowedStatuses: [403, 404, 405, 422, 501], silent: true, timeoutMs: 10000 });
    return { ok: Boolean(result.ok), status: Number(result.status ?? 0), data: result.data ?? null, bodyText: result.ok ? undefined : result.bodyText };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function normalizeCreateScopeType(value: unknown): OperatorEvidenceExportScopeType {
  const raw = text(value).toUpperCase();
  if (raw === "TENANT" || raw === "DEVICE" || raw === "FIELD") return raw;
  if (raw === "OPERATION") throw new Error("创建证据导出任务失败：底层 scope_type 只允许 TENANT、DEVICE 或 FIELD；operation 关联必须通过 operation_id 完成。");
  throw new Error("创建证据导出任务失败：scope_type 必须是 TENANT、DEVICE 或 FIELD。");
}

function normalizeCreateTs(value: unknown, field: "from_ts_ms" | "to_ts_ms"): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`创建证据导出任务失败：${field} 必须由 UI 明确生成，不能为空。`);
  }
  return Math.trunc(num);
}

function safeApiMessage(value: unknown, fallback: string): string {
  const raw = text(value, "");
  if (!raw) return fallback;
  if (/token|secret|credential|private\s*key|password|stack\s*trace|debug\s*json|access[_-]?key/i.test(raw)) return fallback;
  return raw.length > 180 ? `${raw.slice(0, 177)}...` : raw;
}

function parseErrorRecord(bodyText: string): AnyRecord | null {
  try {
    const parsed = JSON.parse(bodyText);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as AnyRecord : null;
  } catch {
    return null;
  }
}

function buildCreatePayload(input: CreateOperatorEvidenceExportJobInput): AnyRecord {
  const operationId = text(input.operation_id, "");
  const scopeType = normalizeCreateScopeType(input.scope_type);
  const scopeId = text(input.scope_id, "");
  const fieldId = text(input.field_id, "");
  const fromTsMs = normalizeCreateTs(input.from_ts_ms, "from_ts_ms");
  const toTsMs = normalizeCreateTs(input.to_ts_ms, "to_ts_ms");
  const exportFormat = text(input.export_format, "");
  const exportLanguage = text(input.export_language, "");

  if (!scopeId) throw new Error("创建证据导出任务失败：scope_id 不能为空。页面应按上下文明确生成 TENANT/FIELD/DEVICE scope。");
  if (toTsMs <= fromTsMs) throw new Error("创建证据导出任务失败：to_ts_ms 必须大于 from_ts_ms。");
  if (!exportFormat) throw new Error("创建证据导出任务失败：export_format 不能为空。");
  if (!exportLanguage) throw new Error("创建证据导出任务失败：export_language 不能为空。");

  return {
    operation_id: operationId || undefined,
    scope_type: scopeType,
    scope_id: scopeId,
    field_id: fieldId || undefined,
    from_ts_ms: fromTsMs,
    to_ts_ms: toTsMs,
    export_format: exportFormat,
    export_language: exportLanguage,
  };
}

function normalizeCreateResponseItem(payload: unknown, requestPayload: AnyRecord): OperatorEvidenceItem | null {
  const rows = arrayFrom(payload, ["items", "jobs", "export_jobs", "data"]);
  const row = rows[0] ?? (payload && typeof payload === "object" && !Array.isArray(payload) ? payload as AnyRecord : null);
  if (!row) return null;
  return normalizeItem({
    ...row,
    operation_id: row.operation_id ?? requestPayload.operation_id,
    scope_type: row.scope_type ?? requestPayload.scope_type,
    scope_id: row.scope_id ?? requestPayload.scope_id,
    format: row.format ?? requestPayload.export_format,
  }, 0, "operator_evidence_api");
}

export async function createOperatorEvidenceExportJob(input: CreateOperatorEvidenceExportJobInput): Promise<OperatorEvidenceExportJobCreateResponse> {
  const payload = buildCreatePayload(input);
  const result = await apiRequestWithPolicy<unknown>(
    withQuery("/api/v1/operator/evidence/export-jobs"),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { allowedStatuses: [400, 403, 404, 405, 409, 422, 501], silent: true, timeoutMs: 15000 },
  );

  if (!result.ok) {
    const errorRecord = parseErrorRecord(result.bodyText);
    const message = safeApiMessage(errorRecord?.message ?? errorRecord?.error ?? result.bodyText, "创建证据导出任务失败。");
    return {
      ok: false,
      httpStatus: result.status,
      jobId: "",
      operationId: text(payload.operation_id, ""),
      jobStatus: "UNKNOWN",
      item: null,
      message,
      errorCode: text(errorRecord?.error_code ?? errorRecord?.code, "") || null,
    };
  }

  const item = normalizeCreateResponseItem(result.data, payload);
  const responseRecord = result.data && typeof result.data === "object" && !Array.isArray(result.data) ? result.data as AnyRecord : {};
  return {
    ok: true,
    httpStatus: result.status,
    jobId: item?.jobId ?? text(responseRecord.job_id ?? responseRecord.export_job_id ?? responseRecord.evidence_export_job_id, ""),
    operationId: item?.operationId ?? text(payload.operation_id, ""),
    jobStatus: item?.status ?? normalizeStatus(responseRecord.status ?? responseRecord.job_status ?? responseRecord.export_status),
    item,
    message: safeApiMessage(responseRecord.message, "证据导出任务已创建。"),
    errorCode: null,
  };
}

export async function fetchOperatorEvidenceJobDetail(jobId: string, operationId?: string): Promise<OperatorEvidenceJobDetailResponse> {
  const id = text(jobId, "");
  if (!id) {
    return { ok: false, httpStatus: 0, item: null, message: "job_id 不能为空。", errorCode: "JOB_ID_REQUIRED" };
  }

  const detail = await fetchOptional(withQuery(`/api/v1/operator/evidence/export-jobs/${encodeURIComponent(id)}`));
  if (detail.ok) {
    const item = normalizeSingleOperatorItem(detail.data);
    return {
      ok: Boolean(item),
      httpStatus: detail.status,
      item,
      message: item ? "job detail 已刷新。" : "job detail 响应为空。",
      errorCode: item ? null : "EMPTY_JOB_DETAIL",
    };
  }

  const op = text(operationId, "");
  if (op) {
    const byOperation = await fetchOptional(withQuery(`/api/v1/operator/evidence/by-operation/${encodeURIComponent(op)}`));
    const items = normalizeOperator(byOperation.data);
    const item = items.find((candidate) => candidate.jobId === id) ?? null;
    if (item) {
      return { ok: true, httpStatus: byOperation.status, item, message: "已通过 by-operation 刷新 job 状态。", errorCode: null };
    }
  }

  const errorRecord = parseErrorRecord(detail.bodyText ?? "");
  return {
    ok: false,
    httpStatus: detail.status,
    item: null,
    message: safeApiMessage(errorRecord?.message ?? errorRecord?.error ?? detail.bodyText, "刷新 job 状态失败。"),
    errorCode: text(errorRecord?.error_code ?? errorRecord?.code, "") || null,
  };
}

export async function fetchOperatorEvidence(operationId?: string): Promise<OperatorEvidenceResponse> {
  const op = text(operationId, "");
  if (op) {
    const byOperation = await fetchOptional(withQuery(`/api/v1/operator/evidence/by-operation/${encodeURIComponent(op)}`));
    const items = normalizeOperator(byOperation.data);
    return {
      source: "operator_evidence_api",
      dataScope: byOperation.ok ? "OFFICIAL_OPERATOR_API" : "ERROR_EMPTY",
      generated_at: new Date().toISOString(),
      items,
      exportReady: false,
      message: byOperation.ok ? `已按 operation_id=${op} 查询证据导出任务。` : "按作业查询证据任务失败。",
    };
  }
  const official = await fetchOptional(withQuery("/api/v1/operator/evidence"));
  const officialItems = normalizeOperator(official.data);
  if (official.ok || (official.data && typeof official.data === "object" && ((official.data as AnyRecord).dataScope === "OFFICIAL_OPERATOR_API" || text((official.data as AnyRecord).source).includes("operator_evidence")))) {
    return {
      source: "operator_evidence_api",
      dataScope: "OFFICIAL_OPERATOR_API",
      generated_at: new Date().toISOString(),
      items: officialItems,
      exportReady: false,
      message: "证据导出写操作需等待后端权限、审计和错误码 ready 后开放。",
    };
  }

  if (![404, 405, 501].includes(official.status)) {
    return {
      source: "operator_evidence_api",
      dataScope: "OFFICIAL_OPERATOR_API",
      generated_at: new Date().toISOString(),
      items: officialItems,
      exportReady: false,
      message: "证据导出写操作需等待后端权限、审计和错误码 ready 后开放。",
    };
  }

  const [exportJobs, aggregate] = await Promise.all([
    fetchOptional(withQuery("/api/v1/evidence/export-jobs")),
    fetchOptional(withQuery("/api/v1/reports/customer-dashboard/aggregate")),
  ]);
  const fallbackItems = [
    ...normalizeExportJobs(exportJobs.data),
    ...normalizeReportFallback(aggregate.data),
  ].filter((item, index, all) => all.findIndex((x) => x.jobId === item.jobId) === index);

  if (fallbackItems.length > 0) {
    return {
      source: "fallback_existing_sources",
      dataScope: "FALLBACK_LIMITED",
      generated_at: new Date().toISOString(),
      items: fallbackItems,
      exportReady: false,
      message: "当前展示 evidence export jobs / reports aggregate 包装后的有限证据中心，非完整 operator evidence。",
    };
  }

  return {
    source: "fallback_existing_sources",
    dataScope: "EMPTY",
    generated_at: new Date().toISOString(),
    items: [],
    exportReady: false,
    message: "暂无证据导出任务。",
  };
}
