import test from "node:test";
import assert from "node:assert/strict";
import { computeReportV1SlaMetrics } from "../src/projections/report_v1";

test("computes sla durations from timeline, receipt, and acceptance timestamps", () => {
  const metrics = computeReportV1SlaMetrics({
    timeline: [
      { type: "RECOMMENDATION_CREATED", ts: Date.parse("2026-04-01T10:00:00.000Z") },
      { type: "TASK_CREATED", ts: Date.parse("2026-04-01T10:05:00.000Z") },
      { type: "RECEIPT_SUBMITTED", ts: Date.parse("2026-04-01T10:12:00.000Z") },
    ],
    receipt: {
      execution_started_at: "2026-04-01T10:06:00.000Z",
      execution_finished_at: "2026-04-01T10:11:00.000Z",
    },
    acceptance: {
      generated_at: "2026-04-01T10:21:00.000Z",
    },
  });

  assert.equal(metrics.dispatch_latency_ms, 5 * 60 * 1000);
  assert.equal(metrics.execution_duration_ms, 5 * 60 * 1000);
  assert.equal(metrics.acceptance_latency_ms, 10 * 60 * 1000);
  assert.deepEqual(metrics.invalid_reasons, []);
});

test("returns undefined and reasons for missing or negative durations", () => {
  const metrics = computeReportV1SlaMetrics({
    timeline: [
      { type: "TASK_CREATED", ts: Date.parse("2026-04-01T10:00:00.000Z") },
      { type: "RECEIPT_SUBMITTED", ts: Date.parse("2026-04-01T10:20:00.000Z") },
    ],
    receipt: {
      execution_started_at: "2026-04-01T10:10:00.000Z",
      execution_finished_at: "2026-04-01T10:05:00.000Z",
    },
    acceptance: {
      generated_at: "2026-04-01T10:04:00.000Z",
    },
  });

  assert.equal(metrics.dispatch_latency_ms, undefined);
  assert.equal(metrics.execution_duration_ms, undefined);
  assert.equal(metrics.acceptance_latency_ms, undefined);
  assert.deepEqual(metrics.invalid_reasons, [
    "dispatch_latency_missing_timestamp",
    "execution_duration_negative_duration",
    "acceptance_latency_negative_duration",
  ]);
});
