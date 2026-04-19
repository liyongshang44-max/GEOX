import test from "node:test";
import assert from "node:assert/strict";
import {
  IRRIGATION_DEBUG_ONLY_EVIDENCE_KINDS,
  IRRIGATION_SUPPORTING_EVIDENCE_CHANNELS,
  collectIrrigationValidEvidenceRefs,
  evaluateIrrigationEvidenceBundle,
  isIrrigationFormalArtifactKind,
  isIrrigationFormalLogKind,
  shouldMarkInvalidExecutionForIrrigation,
} from "./irrigation_evidence_contract_v1.js";

test("irrigation evidence contract: sim_trace is debug-only and not formal evidence", () => {
  assert.deepEqual(IRRIGATION_DEBUG_ONLY_EVIDENCE_KINDS, ["sim_trace"]);
  assert.equal(isIrrigationFormalLogKind("sim_trace"), false);
  assert.equal(isIrrigationFormalArtifactKind("sim_trace"), false);

  const evaluation = evaluateIrrigationEvidenceBundle({ logs: [{ kind: "sim_trace" }] });
  assert.equal(evaluation.has_formal_evidence, false);
  assert.equal(evaluation.reason, "only_sim_trace");
});

test("irrigation evidence contract: media/metrics are supporting-only and cannot alone create formal evidence", () => {
  assert.deepEqual(IRRIGATION_SUPPORTING_EVIDENCE_CHANNELS, ["media", "metrics"]);

  const evaluation = evaluateIrrigationEvidenceBundle({
    media: [{ kind: "irrigation_photo" }],
    metrics: [{ kind: "metric" }],
  });

  assert.equal(evaluation.has_formal_evidence, false);
  assert.equal(evaluation.reason, "no_evidence");
});

test("irrigation evidence contract: formal log kind enters valid evidence refs", () => {
  const refs = collectIrrigationValidEvidenceRefs({
    artifacts: [],
    logs: [
      { kind: "sim_trace", ref: "log_trace" },
      { kind: "dispatch_ack", ref: "log_formal" },
    ],
  });
  assert.deepEqual(refs, ["log_formal"]);
});

test("irrigation evidence contract: non-debug formal artifact enters valid evidence refs", () => {
  const refs = collectIrrigationValidEvidenceRefs({
    artifacts: [
      { payload: { kind: "sim_trace", ref: "trace_ref" } },
      { payload: { kind: "irrigation_photo", ref: "artifact_ref" } },
    ],
    logs: [],
  });
  assert.deepEqual(refs, ["artifact_ref"]);
});

test("irrigation evidence contract: executed receipt with only debug/supporting evidence => INVALID_EXECUTION", () => {
  const supportingOnly = evaluateIrrigationEvidenceBundle({
    logs: [{ kind: "sim_trace" }],
    media: [{ kind: "irrigation_photo" }],
    metrics: [{ kind: "metric" }],
  });

  const shouldInvalid = shouldMarkInvalidExecutionForIrrigation({
    hasReceipt: true,
    executedReceipt: true,
    evidence: supportingOnly,
  });

  assert.equal(supportingOnly.has_formal_evidence, false);
  assert.equal(shouldInvalid, true);
});
