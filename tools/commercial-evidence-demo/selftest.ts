// tools/commercial-evidence-demo/selftest.ts
import assert from "node:assert/strict";
import { buildCommercialEvidencePacketV1 } from "./packet.js";

const packet = buildCommercialEvidencePacketV1();
const cases = new Map(packet.cases.map((item) => [item.case_id, item]));
const healthy = cases.get("healthy_exact_provider_pair");
const late = cases.get("provider_late");
const conflict = cases.get("source_conflict");
const missing = cases.get("missing_evidence");

assert.equal(packet.object_type, "commercial_evidence_demo_v1");
assert.equal(packet.canonical_runtime_code_executed, true);
assert.equal(packet.side_effects.provider_request_count, 0);
assert.equal(packet.side_effects.database_write_count, 0);
assert.equal(packet.side_effects.canonical_runtime_write_count, 0);
assert.ok(healthy);
assert.ok(late);
assert.ok(conflict);
assert.ok(missing);

assert.equal(healthy!.outcome.action, "CONTINUE");
assert.equal(healthy!.outcome.runtime_health, "HEALTHY");
assert.equal(healthy!.outcome.forcing_mode, "EXACT_PROVIDER_INTERVAL_PAIR");
assert.equal(healthy!.outcome.precipitation_epistemic_class, "OBSERVED");
assert.equal(healthy!.outcome.et0_epistemic_class, "ESTIMATED");

assert.equal(late!.outcome.action, "DEGRADE_AND_CONTINUE");
assert.equal(late!.outcome.runtime_health, "DEGRADED");
assert.equal(late!.outcome.forcing_mode, "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR");
assert.equal(late!.outcome.precipitation_epistemic_class, "ASSUMED");
assert.equal(late!.outcome.et0_epistemic_class, "ASSUMED");
assert.equal(late!.outcome.exact_provider_pair_available, false);
assert.equal(late!.outcome.provider_wait_required, false);
assert.equal(late!.outcome.completed_tick_retroactive_rewrite_authorized, false);
assert.equal(packet.comparison.same_exact_payload.rainfall_mm, late!.input.rainfall_mm);
assert.equal(packet.comparison.same_exact_payload.historical_et0_mm, late!.input.historical_et0_mm);

assert.equal(conflict!.outcome.action, "FAIL_CLOSED");
assert.match(String(conflict!.outcome.error_code), /SOURCE_IDENTITY_CONFLICT|CONFLICTING_INTERVAL_RECORDS/);
assert.equal(conflict!.outcome.state_write_authorized, false);

assert.equal(missing!.outcome.action, "FAIL_CLOSED");
assert.equal(missing!.outcome.error_code, "AMENDMENT19_NO_CAUSAL_CURRENT_INTERVAL_FORCING_PAIR");
assert.equal(missing!.outcome.state_write_authorized, false);

assert.deepEqual(packet.architecture.commercial_trace_path, ["Evidence", "State", "Forecast", "Scenario", "Runtime decision boundary"]);
assert.equal(packet.persisted_trace.read_only, true);
assert.equal(packet.hard_nonclaims.includes("NO_FORMAL_O00_O23_CLAIM"), true);

console.log(JSON.stringify({
  ok: true,
  acceptance: "COMMERCIAL_EVIDENCE_DEMO_CANONICAL_SELECTOR_SELFTEST_V1",
  canonical_runtime_code_executed: packet.canonical_runtime_code_executed,
  selector_contract: packet.canonical_selector_contract_id,
  healthy_behavior: healthy!.outcome.action,
  provider_late_behavior: late!.outcome.action,
  source_conflict_behavior: conflict!.outcome.action,
  missing_evidence_behavior: missing!.outcome.action,
  provider_request_count: packet.side_effects.provider_request_count,
  database_write_count: packet.side_effects.database_write_count,
  canonical_runtime_write_count: packet.side_effects.canonical_runtime_write_count,
  hard_nonclaims: packet.hard_nonclaims,
}, null, 2));
