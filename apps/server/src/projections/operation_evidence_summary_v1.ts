import { evaluateFormalEvidencePolicyV1 } from "../domain/evidence/formal_evidence_policy_v1.js";
import type { OperationStateV1 } from "./operation_state_v1.js";

export type OperationEvidencePackSummaryStatusV1 = "READY" | "PENDING" | "MISSING" | "FAILED";

export type OperationEvidencePackSummaryV1 = {
  status: OperationEvidencePackSummaryStatusV1;
  summary: string | null;
  photos_logs_metrics_trace_summary: string | null;
  evidence_count: number;
  receipt_present: boolean;
  acceptance_present: boolean;
  manifest?: string | null;
  sha256?: string | null;
  download_url?: string | null;
  insufficient_reason?: string | null;
  generated_at?: string | null;
};

export type OperationEvidenceBundleSummaryInputV1 = {
  artifacts?: unknown[];
  logs?: unknown[];
  media?: unknown[];
  metrics?: unknown[];
};

export type OperationEvidenceSummaryBuilderInputV1 = {
  receipt?: unknown | null;
  evidence_bundle?: OperationEvidenceBundleSummaryInputV1 | null;
  evidence_summary?: unknown | null;
  acceptance?: unknown | null;
  operation_state?: Partial<OperationStateV1> | null;
  evidence_export_job?: unknown | null;
  now?: Date;
};

type EvidenceKindCounts = { artifacts: number; logs: number; media: number; metrics: number };

const CUSTOMER_TEXT_MAX = 280;
const PRIVATE_TEXT_PATTERNS = [/\bsha256\b/i, /\bmanifest\b\s*[:=]/i, /\bdownload\b\s*[:=]/i, /s3:\/\//i, /minio:\/\//i, /https?:\/\//i, /(^|\s)\/[\w./-]+/, /[A-Z]:\\[\w\\.-]+/i];

function asRecord(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function toText(value: unknown): string | null { if (typeof value === "string") return value.trim() || null; if (typeof value === "number" && Number.isFinite(value)) return String(value); if (typeof value === "boolean") return value ? "true" : "false"; return null; }
function truncateCustomerText(text: string): string { return text.length <= CUSTOMER_TEXT_MAX ? text : `${text.slice(0, CUSTOMER_TEXT_MAX - 1)}…`; }
function sanitizeCustomerText(value: unknown): string | null {
  if (Array.isArray(value)) {
    const parts = value.map((item) => sanitizeCustomerText(item)).filter((item): item is string => Boolean(item));
    return parts.length > 0 ? truncateCustomerText(parts.join("；")) : null;
  }
  const record = asRecord(value);
  if (record) return sanitizeCustomerText(record.customer_text ?? record.summary_text ?? record.summary ?? record.description ?? record.text ?? record.message);
  const text = toText(value);
  if (!text || text === "--" || text === "[object Object]") return null;
  if (PRIVATE_TEXT_PATTERNS.some((pattern) => pattern.test(text))) return null;
  return truncateCustomerText(text.replace(/\s+/g, " "));
}
function payloadOf(value: unknown): Record<string, unknown> | null { const record = asRecord(value); if (!record) return null; const recordJson = asRecord(record.record_json); const recordPayload = asRecord(recordJson?.payload); if (recordPayload) return recordPayload; const payload = asRecord(record.payload); if (payload) return payload; return record; }
function isMeaningfulObject(value: unknown): boolean {
  const payload = payloadOf(value); if (!payload) return false;
  return Object.values(payload).some((item) => { if (item == null) return false; if (Array.isArray(item)) return item.length > 0; if (typeof item === "string") return item.trim().length > 0; if (typeof item === "number") return Number.isFinite(item); if (typeof item === "boolean") return true; if (typeof item === "object") return Object.keys(item as Record<string, unknown>).length > 0; return false; });
}
function arrayOf(value: unknown): any[] { return Array.isArray(value) ? value : []; }
function countBundleEvidence(bundle: OperationEvidenceBundleSummaryInputV1 | null | undefined): EvidenceKindCounts { return { artifacts: arrayOf(bundle?.artifacts).length, logs: arrayOf(bundle?.logs).length, media: arrayOf(bundle?.media).length, metrics: arrayOf(bundle?.metrics).length }; }
function rawEvidenceCount(counts: EvidenceKindCounts): number { return counts.artifacts + counts.logs + counts.media + counts.metrics; }
function normalizeExportJobStatus(value: unknown): "QUEUED" | "RUNNING" | "DONE" | "ERROR" | null { const status = String(value ?? "").trim().toUpperCase(); if (status === "QUEUED") return "QUEUED"; if (status === "RUNNING") return "RUNNING"; if (status === "DONE" || status === "SUCCESS" || status === "READY") return "DONE"; if (status === "ERROR" || status === "FAILED" || status === "FAIL") return "ERROR"; return null; }
function isSafeSha256(value: unknown): string | null { const text = toText(value); return text && /^[a-f0-9]{64}$/i.test(text) ? text.toLowerCase() : null; }
function isSafeRelativeDownloadUrl(value: unknown): string | null { const text = toText(value); if (!text) return null; if (!text.startsWith("/api/v1/") && !text.startsWith("/customer/")) return null; if (text.includes("//") || text.includes("\\")) return null; return text; }
function normalizeManifestLabel(value: unknown): string | null { const text = sanitizeCustomerText(value); if (!text || text.includes("/") || text.includes("\\") || text.length > 80) return null; return text; }
function firstIso(...values: unknown[]): string | null { for (const value of values) { if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString(); if (typeof value === "number" && Number.isFinite(value) && value > 0) return new Date(value).toISOString(); const text = toText(value); if (!text) continue; const ms = Date.parse(text); if (Number.isFinite(ms) && ms > 0) return new Date(ms).toISOString(); } return null; }
function getEvidenceSummaryRecord(value: unknown): Record<string, unknown> { return asRecord(value) ?? {}; }
function getEvidencePackRecord(exportJob: unknown): Record<string, unknown> { return asRecord(asRecord(exportJob)?.evidence_pack) ?? {}; }
function getEvidencePackFiles(exportJob: unknown): Array<Record<string, unknown>> { const files = getEvidencePackRecord(exportJob).files; return Array.isArray(files) ? files.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item)) : []; }
function findEvidencePackFile(exportJob: unknown, part: "bundle" | "manifest" | "checksums"): Record<string, unknown> | null { return getEvidencePackFiles(exportJob).find((file) => String(file.download_part ?? "").trim().toLowerCase() === part) ?? null; }
function deriveSafeManifest(input: OperationEvidenceSummaryBuilderInputV1): string | null { const explicit = normalizeManifestLabel(getEvidenceSummaryRecord(input.evidence_summary).manifest); if (explicit) return explicit; const manifestFile = findEvidencePackFile(input.evidence_export_job, "manifest"); return manifestFile ? normalizeManifestLabel(manifestFile.name) ?? "manifest.json" : null; }
function deriveSafeSha256(input: OperationEvidenceSummaryBuilderInputV1): string | null { const summary = getEvidenceSummaryRecord(input.evidence_summary); const job = asRecord(input.evidence_export_job) ?? {}; const bundleFile = findEvidencePackFile(input.evidence_export_job, "bundle"); return isSafeSha256(summary.sha256) ?? isSafeSha256(job.artifact_sha256) ?? isSafeSha256(bundleFile?.sha256) ?? null; }
function deriveSafeDownloadUrl(input: OperationEvidenceSummaryBuilderInputV1): string | null { const summary = getEvidenceSummaryRecord(input.evidence_summary); const bundleFile = findEvidencePackFile(input.evidence_export_job, "bundle"); const delivery = asRecord(getEvidencePackRecord(input.evidence_export_job).delivery) ?? {}; return isSafeRelativeDownloadUrl(summary.download_url) ?? isSafeRelativeDownloadUrl(bundleFile?.download_path) ?? isSafeRelativeDownloadUrl(delivery.object_store_download_url) ?? null; }
function hasAcceptanceMissingEvidence(acceptance: unknown): boolean { const payload = payloadOf(acceptance) ?? {}; const missing = payload.missing_evidence; return missing === true || (Array.isArray(missing) && missing.length > 0); }
function hasInvalidEvidenceState(operationState: Partial<OperationStateV1> | null | undefined): boolean { const finalStatus = String(operationState?.final_status ?? "").trim().toUpperCase(); const invalidReason = String(operationState?.invalid_reason ?? "").trim().toLowerCase(); return finalStatus === "INVALID_EXECUTION" || invalidReason === "evidence_missing" || invalidReason === "evidence_invalid"; }
function buildTraceSummary(counts: EvidenceKindCounts, formalCount: number, simulatedCount: number): string { return [`现场照片 ${counts.media} 项`, `执行日志 ${counts.logs} 项`, `监测指标 ${counts.metrics} 项`, `附件记录 ${counts.artifacts} 项`, `正式证据 ${formalCount} 项`, `模拟/调试证据 ${simulatedCount} 项`].join("；"); }
function buildDefaultSummary(status: OperationEvidencePackSummaryStatusV1): string { if (status === "READY") return "本次作业已形成正式证据包摘要，可用于后续验收复核。"; if (status === "PENDING") return "本次作业已有部分证据记录，但正式证据仍待补齐或复核。"; if (status === "FAILED") return "本次作业证据包未通过完整性复核，需要补充证据或由技术支持复核。"; return "暂无有效正式证据。"; }
function buildInsufficientReason(params: { status: OperationEvidencePackSummaryStatusV1; exportJobStatus: ReturnType<typeof normalizeExportJobStatus>; acceptanceMissingEvidence: boolean; invalidEvidenceState: boolean; formalBlockingReasons: string[] }): string | null { if (params.exportJobStatus === "ERROR") return "证据包生成失败，需技术支持复核。"; if (params.invalidEvidenceState) return "执行记录存在，但正式证据不足或无效，需补充后复核。"; if (params.acceptanceMissingEvidence) return "验收记录提示证据不足，需补齐现场记录或监测数据。"; if (params.status === "MISSING") return "当前未查询到可用于验收的正式证据记录。"; if (params.status === "PENDING" && params.formalBlockingReasons.length > 0) return `正式证据未就绪：${params.formalBlockingReasons.slice(0, 3).join("、")}`; if (params.status === "PENDING") return "证据包仍在生成或等待正式证据复核。"; return null; }

export function buildOperationEvidencePackSummaryV1(input: OperationEvidenceSummaryBuilderInputV1): OperationEvidencePackSummaryV1 {
  const evidenceSummary = getEvidenceSummaryRecord(input.evidence_summary);
  const exportJob = asRecord(input.evidence_export_job) ?? {};
  const exportJobStatus = normalizeExportJobStatus(exportJob.status);
  const receiptPresent = isMeaningfulObject(input.receipt) || Boolean(input.operation_state?.receipt_id);
  const acceptancePresent = isMeaningfulObject(input.acceptance) || ["PASS", "FAIL"].includes(String(input.operation_state?.acceptance?.status ?? "").trim().toUpperCase());
  const bundle: OperationEvidenceBundleSummaryInputV1 = input.evidence_bundle ?? {};
  const counts = countBundleEvidence(bundle);
  const formalPolicy = evaluateFormalEvidencePolicyV1({ artifacts: arrayOf(bundle.artifacts), logs: arrayOf(bundle.logs), media: arrayOf(bundle.media), metrics: arrayOf(bundle.metrics), source: evidenceSummary.source ?? exportJob.source });
  const acceptanceMissingEvidence = hasAcceptanceMissingEvidence(input.acceptance);
  const invalidEvidenceState = hasInvalidEvidenceState(input.operation_state);
  const rawCount = rawEvidenceCount(counts);
  const evidenceCount = formalPolicy.formal_artifact_count;

  let status: OperationEvidencePackSummaryStatusV1;
  if (exportJobStatus === "ERROR" || invalidEvidenceState || acceptanceMissingEvidence) status = "FAILED";
  else if (exportJobStatus === "QUEUED" || exportJobStatus === "RUNNING") status = "PENDING";
  else if (formalPolicy.formal_evidence_passed) status = "READY";
  else if (rawCount > 0) status = "PENDING";
  else status = "MISSING";

  const photosLogsMetricsTraceSummary = sanitizeCustomerText(evidenceSummary.photos_logs_metrics_trace_summary) ?? sanitizeCustomerText(evidenceSummary.trace_summary) ?? buildTraceSummary(counts, formalPolicy.formal_artifact_count, formalPolicy.simulated_artifact_count);
  const summary = sanitizeCustomerText(evidenceSummary.summary) ?? sanitizeCustomerText(evidenceSummary.customer_text) ?? buildDefaultSummary(status);
  const insufficientReason = sanitizeCustomerText(evidenceSummary.insufficient_reason) ?? buildInsufficientReason({ status, exportJobStatus, acceptanceMissingEvidence, invalidEvidenceState, formalBlockingReasons: formalPolicy.blocking_reasons });

  return { status, summary, photos_logs_metrics_trace_summary: photosLogsMetricsTraceSummary, evidence_count: evidenceCount, receipt_present: receiptPresent, acceptance_present: acceptancePresent, manifest: deriveSafeManifest(input), sha256: deriveSafeSha256(input), download_url: deriveSafeDownloadUrl(input), insufficient_reason: insufficientReason, generated_at: firstIso(evidenceSummary.generated_at, exportJob.updated_at, exportJob.updated_ts_ms, exportJob.created_ts_ms, payloadOf(input.acceptance)?.generated_at, input.now ?? new Date()) };
}
