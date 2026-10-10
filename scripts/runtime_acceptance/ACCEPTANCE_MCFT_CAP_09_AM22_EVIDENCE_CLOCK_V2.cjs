"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PHASES, measureEnvelope, validateQualifiedEnvelope } = require("./MCFT_CAP_09_AM22_PREPARATION_ENVELOPE_V1.cjs");
const { selectClock } = require("./MCFT_CAP_09_AM22_EVIDENCE_CLOCK_V2.cjs");
const root = path.resolve(__dirname, "../..");
const stage = JSON.parse(fs.readFileSync(path.join(root, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-10-08T04Z-V1.json"), "utf8"));
const binding = { subject_sha: "a".repeat(40), host_id: "fixture-host", image_id: "sha256:" + "b".repeat(64), preparation_profile_sha256: "sha256:" + "c".repeat(64) };
const envelope = { ...binding, schema_version: "geox_mcft_cap09_qualified_complete_pre_a0_envelope_v1", status: "QUALIFIED", synthetic: false, purpose: "COMPLETE_PRE_A0_PREPARATION_NOT_V13_PER_BASE_ACQUISITION", workload_phases: PHASES, measurement_trace_sha256: "sha256:" + "d".repeat(64), independent_qualification_sha256: "sha256:" + "e".repeat(64), observed_max_elapsed_ms: 600000, enforced_complete_timeout_ms: 600000, safety_margin_ms: 120000, selected_budget_ms: 720000, qualified_at_database_utc: "2026-10-08T05:30:00.000Z", expires_at_database_utc: "2026-10-08T07:00:00.000Z" };
const fixture = () => JSON.parse(JSON.stringify({ database_now_utc: "2026-10-08T05:48:00.000Z", binding, preparation_envelope: envelope, current_crop_authority: stage }));
let count = 0;
function test(fn) { fn(); count++; }
function negative(change, code) { test(() => { const x = fixture(); change(x); assert.throws(() => selectClock(x), new RegExp(code)); }); }
test(() => { const c = selectClock(fixture()); assert.equal(c.a0, "2026-10-08T06:00:00.000Z"); assert.equal(c.o23, "2026-10-09T06:00:00.000Z"); assert.equal(c.fixed_36_hour_lead_used, false); assert.equal(c.production_start_authorized, false); });
negative(x => delete x.preparation_envelope, "INDEPENDENT_QUALIFICATION_REQUIRED");
negative(x => x.preparation_envelope.synthetic = true, "PURPOSE_OR_SOURCE_INVALID");
negative(x => x.preparation_envelope.purpose = "V13_PER_BASE_FORCING_BUDGET", "PURPOSE_OR_SOURCE_INVALID");
negative(x => x.preparation_envelope.workload_phases.pop(), "WORKLOAD_COVERAGE_REQUIRED");
negative(x => x.preparation_envelope.enforced_complete_timeout_ms = 500000, "COMPLETE_TIMEOUT_BOUND_REQUIRED");
negative(x => x.preparation_envelope.safety_margin_ms = 0, "BUDGET_INSUFFICIENT");
negative(x => x.preparation_envelope.selected_budget_ms = 600000, "BUDGET_INSUFFICIENT");
negative(x => x.preparation_envelope.subject_sha = "f".repeat(40), "BINDING_MISMATCH_subject_sha");
negative(x => x.current_crop_authority.scope.field_id = "other", "EXACT_SCOPE_REQUIRED_field_id");
negative(x => x.current_crop_authority.lifecycle.domain_state = "TERMINATED", "INDEPENDENT_LIFECYCLE_REQUIRED");
negative(x => x.current_crop_authority.biological_stage.resolved_biological_stage = "PRE_R5_MODEL_ESTIMATE", "R6_CONSUMER_BINDING_REQUIRED");
negative(x => x.current_crop_authority.biological_stage.authority_valid_until = "2026-10-10T10:00:00.000Z", "QUALIFIED_STAGE_VALIDITY_REQUIRED");
negative(x => x.current_crop_authority.graduation.graduated_at = "2026-10-08T06:00:00.000Z", "STAGE_FUTURE_OR_STALE");
// Use the real adopted authority to reproduce tonight's 24T coverage blocker.
negative(x => { x.database_now_utc = "2026-10-08T13:00:00.000Z"; x.preparation_envelope.qualified_at_database_utc = "2026-10-08T12:00:00.000Z"; x.preparation_envelope.expires_at_database_utc = "2026-10-08T15:00:00.000Z"; }, "CURRENT_STAGE_DOES_NOT_COVER_A0_O23");
const trace = { ...binding, schema_version: "geox_mcft_cap09_complete_pre_a0_measurement_trace_v1", synthetic: false, measurement_class: "ACTUAL_COMPLETE_PRE_A0_PREPARATION", trials: [{ status: "PASS", started_monotonic_ms: 0, finished_monotonic_ms: 600, phases: PHASES.map((phase,i) => ({phase,status:"PASS",evidence_sha256:"sha256:"+"a".repeat(64),started_monotonic_ms:i*100,finished_monotonic_ms:(i+1)*100})) }] };
test(() => { const measured = measureEnvelope(trace, {...binding,safety_margin_ms:100}); assert.equal(measured.status,"MEASURED_PENDING_INDEPENDENT_QUALIFICATION"); assert.equal(measured.production_authorized,false); assert.throws(() => validateQualifiedEnvelope(measured,binding,Date.now()), /INDEPENDENT_QUALIFICATION_REQUIRED/); });
test(() => assert.throws(() => measureEnvelope({...trace,synthetic:true},{...binding,safety_margin_ms:100}), /ACTUAL_MEASUREMENT_REQUIRED/));
test(() => assert.throws(() => measureEnvelope({...trace,trials:[{...trace.trials[0],phases:trace.trials[0].phases.slice(1)}]},{...binding,safety_margin_ms:100}), /COMPLETE_ORDERED_WORKLOAD_REQUIRED/));
console.log(JSON.stringify({status:"PASS",cases:count,unit_fixtures_only:true,real_preparation_measurement:false,production_start_authorized:false}));
