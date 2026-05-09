import test from "node:test";
import assert from "node:assert/strict";
import { buildOperationEvidencePackSummaryV1 } from "./operation_evidence_summary_v1.js";

const HASH = "a".repeat(64);

test("buildOperationEvidencePackSummaryV1 returns a customer-safe READY summary", () => {
  const summary = buildOperationEvidencePackSummaryV1({
    receipt: {
      payload: {
        receipt_id: "receipt_001",
        logs_refs: ["log_1"],
        photo_refs: ["photo_1", "photo_2"],
        metrics: [{ soil_moisture: 31 }],
      },
    },
    evidence_bundle: {
      artifacts: [{ kind: "artifact" }, { kind: "artifact" }],
      logs: [],
      media: [],
      metrics: [],
    },
    evidence_summary: {
      summary: "s3://private-bucket/tenant/job/bundle.json",
      photos_logs_metrics_trace_summary: "现场照片、执行日志和灌后监测数据已归档。",
    },
    acceptance: {
      payload: {
        verdict: "PASS",
        generated_at: "2026-05-09T12:00:00.000Z",
      },
    },
    operation_state: {
      final_status: "SUCCESS",
      receipt_id: "receipt_001",
      acceptance: { status: "PASS", missing: [] },
      timeline: [
        { ts: 1, type: "TASK_CREATED" as any, label: "task created" },
        { ts: 2, type: "RECEIPT_SUBMITTED" as any, label: "receipt submitted" },
      ],
    },
    evidence_export_job: {
      status: "DONE",
      artifact_sha256: HASH,
      evidence_pack: {
        files: [
          { name: "bundle.json", sha256: HASH, download_part: "bundle", download_path: "/api/v1/evidence-export/jobs/job_001/download?part=bundle" },
          { name: "manifest.json", sha256: HASH, download_part: "manifest" },
        ],
      },
    },
    now: new Date("2026-05-09T12:10:00.000Z"),
  });

  assert.equal(summary.status, "READY");
  assert.equal(summary.evidence_count, 8);
  assert.equal(summary.receipt_present, true);
  assert.equal(summary.acceptance_present, true);
  assert.equal(summary.sha256, HASH);
  assert.equal(summary.manifest, "manifest.json");
  assert.equal(summary.download_url, "/api/v1/evidence-export/jobs/job_001/download?part=bundle");
  assert.equal(summary.summary?.includes("s3://"), false);
  assert.equal(summary.photos_logs_metrics_trace_summary, "现场照片、执行日志和灌后监测数据已归档。");
});

test("buildOperationEvidencePackSummaryV1 marks missing evidence as MISSING", () => {
  const summary = buildOperationEvidencePackSummaryV1({
    operation_state: {
      final_status: "PENDING",
      timeline: [],
    },
    now: new Date("2026-05-09T12:10:00.000Z"),
  });

  assert.equal(summary.status, "MISSING");
  assert.equal(summary.evidence_count, 0);
  assert.equal(summary.receipt_present, false);
  assert.equal(summary.acceptance_present, false);
  assert.equal(summary.summary, "暂无有效证据。");
  assert.equal(summary.insufficient_reason, "当前未查询到可用于验收的证据记录。");
});

test("buildOperationEvidencePackSummaryV1 rejects failed or unsafe export metadata", () => {
  const summary = buildOperationEvidencePackSummaryV1({
    receipt: { payload: { receipt_id: "receipt_001", logs_refs: ["log_1"] } },
    acceptance: { payload: { verdict: "FAIL", missing_evidence: ["photo"] } },
    operation_state: {
      final_status: "INVALID_EXECUTION",
      invalid_reason: "evidence_missing",
      receipt_id: "receipt_001",
      acceptance: { status: "FAIL", missing: ["photo"] },
      timeline: [],
    },
    evidence_export_job: {
      status: "ERROR",
      artifact_sha256: "not-a-hash",
      evidence_pack: {
        delivery: { object_store_download_url: "https://storage.example/private-url" },
      },
    },
    now: new Date("2026-05-09T12:10:00.000Z"),
  });

  assert.equal(summary.status, "FAILED");
  assert.equal(summary.sha256, null);
  assert.equal(summary.download_url, null);
  assert.equal(summary.insufficient_reason, "证据包生成失败，需技术支持复核。");
});
