import test from "node:test";
import assert from "node:assert/strict";
import {
  IRRIGATION_SIM_TRACE_KIND_V1,
  collectIrrigationValidEvidenceRefs,
  evaluateIrrigationEvidenceBundle,
  isIrrigationFormalArtifactKind,
  isIrrigationFormalLogKind,
  shouldMarkInvalidExecutionForIrrigation,
} from "./irrigation_evidence_contract_v1.js";

test("irrigation evidence contract: sim_trace is not formal evidence", () => {
  assert.equal(isIrrigationFormalLogKind(IRRIGATION_SIM_TRACE_KIND_V1), false);
  assert.equal(isIrrigationFormalArtifactKind(IRRIGATION_SIM_TRACE_KIND_V1), false);

  const evaluation = evaluateIrrigationEvidenceBundle({
    artifacts: [{ kind: IRRIGATION_SIM_TRACE_KIND_V1 }],
    logs: [{ kind: IRRIGATION_SIM_TRACE_KIND_V1 }],
    media: [],
    metrics: [],
  });
  assert.equal(evaluation.has_formal_evidence, false);
});

test("irrigation evidence contract: only formal log kinds enter valid evidence refs", () => {
  const refs = collectIrrigationValidEvidenceRefs({
    artifacts: [{ payload: { kind: "sim_trace", ref: "trace_ref" } }],
    logs: [
      { kind: "sim_trace", ref: "log_trace" },
      { kind: "dispatch_ack", ref: "log_formal" },
    ],
  });
  assert.deepEqual(refs, ["log_formal"]);
});

test("irrigation evidence contract: executed receipt without formal evidence => INVALID_EXECUTION flag", () => {
  const evidence = evaluateIrrigationEvidenceBundle({ logs: [{ kind: "sim_trace" }] });
  const shouldInvalid = shouldMarkInvalidExecutionForIrrigation({
    hasReceipt: true,
    executedReceipt: true,
    evidence,
  });
  assert.equal(shouldInvalid, true);
});
