import { apiRequestWithPolicy, withQuery } from "./client";

export type OperatorEvidenceDataScope = "OFFICIAL_OPERATOR_API" | "FALLBACK_LIMITED" | "EMPTY" | "ERROR_EMPTY";
export type OperatorEvidenceJobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED" | "UNKNOWN";
export type OperatorEvidenceStorageMode = "OBJECT_STORE" | "LOCAL" | "INLINE" | "NOT_READY" | "UNKNOWN";
export type OperatorEvidenceScopeStatus = "READY" | "NOT_READY" | "UNKNOWN";

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
  if (/s3:\/\//i.test(raw)) return raw.replace(/s3:\/\/([^/]+)\/(.+)/i, (_m, bucket, key) => `对象存储：${String(bucket).slice(0, 3)}*** / ${maskObjectKey(key)}`);
  if (/https?:\/\//i.test(raw)) return "下载链接已隐藏";
  return raw.length > 96 ? `${raw.slice(0, 48)}...${raw.slice(-16)}` : raw;
}

function maskObjectKey(value: unknown): string {
  const raw = text(value, "");
  if (!raw) return "对象标识未提供";
  const safe = raw.replace(/access[_-]?key|secret|token|password/gi, "credential");
  const parts = safe.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || safe;
  return last.length > 48 ? `${last.slice(0, 24)}...${last.slice(-12)}` : last;
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
  const candidates = [row.artifact_id, row.object_key, row.object_id, row.storage_key, row.bundle_key, row.path, row.download_url];
  const hit = candidates.map((item) => maskInternal(item, "")).find(Boolean);
  return hit || "artifact 标识未提供";
}

function normalizeItem(row: AnyRecord, index: number, source: OperatorEvidenceItem["source"]): OperatorEvidenceItem {
  const operationId = text(row.operation_id ?? row.operationId ?? row.scope?.operation_id, "");
  const status = normalizeStatus(row.status ?? row.job_status ?? row.export_status);
  const failureReason = text(row.failure_reason ?? row.error_message ?? row.error, "");
  return {
    jobId: text(row.job_id ?? row.export_job_id ?? row.id, `${source}-${index}`),
    operationId,
    scopeType: text(row.scope_type ?? row.scope?.type, operationId ? "operation" : ""),
    scopeId: text(row.scope_id ?? row.scope?.id ?? operationId, ""),
    scopeStatus: normalizeScopeStatus(row),
    status,
    manifestText: manifestText(row),
    sha256: text(row.sha256 ?? row.checksum_sha256 ?? row.checksum, ""),
    artifactText: artifactText(row),
    format: text(row.format ?? row.bundle_format ?? row.content_type, "未提供"),
    storageMode: normalizeStorageMode(row.storage_mode ?? row.storage?.mode ?? row.object_store_mode),
    downloadStatus: text(row.download_status ?? row.presign_status ?? row.download?.status, status === "DONE" ? "可由后端授权下载" : "不可下载"),
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

async function fetchOptional(path: string): Promise<unknown | null> {
  try {
    const result = await apiRequestWithPolicy<unknown>(path, undefined, { allowedStatuses: [403, 404, 405, 422], silent: true, timeoutMs: 10000 });
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

export async function fetchOperatorEvidence(): Promise<OperatorEvidenceResponse> {
  const official = await fetchOptional(withQuery("/api/v1/operator/evidence"));
  const officialItems = normalizeOperator(official);
  if (officialItems.length > 0) {
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
    ...normalizeExportJobs(exportJobs),
    ...normalizeReportFallback(aggregate),
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
