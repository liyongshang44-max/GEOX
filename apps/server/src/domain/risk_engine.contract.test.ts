import test from "node:test";
import assert from "node:assert/strict";

import { evaluateRisk, type RiskLevel } from "./risk_engine";

const ALLOWED: RiskLevel[] = ["LOW", "MEDIUM", "HIGH"];

test("risk engine contract: any input returns stable { level, reasons[] }", () => {
  const samples = [
    {},
    { final_status: null, missing_evidence: null, pending_acceptance_elapsed_ms: null },
    { final_status: "INVALID_EXECUTION" },
    { final_status: "pending_acceptance", pending_acceptance_elapsed_ms: 31 * 60 * 1000 },
    { final_status: 123, missing_evidence: "yes", pending_acceptance_over_30m: "true" },
    { final_status: "PENDING_ACCEPTANCE", missing_evidence: true, pending_acceptance_elapsed_ms: "2000000" },
  ];

  for (const input of samples) {
    const out = evaluateRisk(input);
    assert.ok(ALLOWED.includes(out.level));
    assert.ok(Array.isArray(out.reasons));
    assert.notEqual(out.reasons, undefined);
  }
});

test("risk engine contract: multi-hit folds by HIGH > MEDIUM > LOW and reasons are stable", () => {
  const out = evaluateRisk({
    final_status: "INVALID_EXECUTION",
    missing_evidence: true,
    pending_acceptance_over_30m: true,
  });

  assert.equal(out.level, "HIGH");
  assert.deepEqual(out.reasons, ["INVALID_EXECUTION", "MISSING_EVIDENCE", "PENDING_ACCEPTANCE_OVER_30M"]);
});
