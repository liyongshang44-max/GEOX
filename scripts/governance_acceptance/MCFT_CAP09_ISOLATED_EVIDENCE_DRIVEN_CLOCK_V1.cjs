"use strict";
// Isolated qualification candidate only. This is NOT production Formal-v5 timing,
// nor an executable ARM; it cannot authorize Producer or a retry.
const assert = require("node:assert/strict");
function epoch(iso, label) {
  assert(typeof iso === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(iso), label);
  const ms = Date.parse(iso);
  assert(Number.isFinite(ms) && new Date(ms).toISOString() === iso, label);
  return ms;
}
function assessIsolatedReadiness(input) {
  assert(input && typeof input === "object", "READINESS_INPUT_REQUIRED");
  const now = epoch(input.now_utc, "READINESS_NOW_INVALID");
  const authorized = epoch(input.authorized_at_utc, "READINESS_AUTHORIZATION_INVALID");
  const expires = epoch(input.expires_at_utc, "READINESS_EXPIRY_INVALID");
  const deadline = epoch(input.provider_deadline_utc, "READINESS_PROVIDER_DEADLINE_INVALID");
  assert(authorized <= now && expires > now && expires - authorized <= 24 * 3600000, "READINESS_SHORT_LIVED_AUTHORIZATION_REQUIRED");
  assert(input.source_exact_main === true && input.source_clean === true, "READINESS_EXACT_CLEAN_MAIN_REQUIRED");
  assert(input.retry_adjudicated === true && input.prior_attempt_preserved === true, "READINESS_RETRY_ADJUDICATION_REQUIRED");
  assert(input.data_available === true && input.provider_observation_causally_visible === true, "READINESS_REAL_DATA_NOT_AVAILABLE");
  assert(input.resources_fresh === true && input.owner_isolation_verified === true, "READINESS_RESOURCES_NOT_PROVEN");
  assert(input.run_output_absent === true, "READINESS_OUTPUT_REUSE_FORBIDDEN");
  const budget = input.measured_worst_case_ms;
  const margin = input.deadline_safety_margin_ms;
  assert(Number.isSafeInteger(budget) && budget > 0 && Number.isSafeInteger(margin) && margin > 0, "READINESS_MEASURED_BUDGET_REQUIRED");
  assert(deadline > now && deadline > now + budget + margin, "READINESS_REAL_DEADLINE_INSUFFICIENT");
  // Even a fully satisfied proposal returns false. A separate immutable
  // reviewed activation artifact and host-only runtime gate are necessary.
  return {status:"ISOLATED_READINESS_CANDIDATE_PASS_NOT_EXECUTION_AUTHORITY", remaining_ms:deadline-now, measured_budget_ms:budget, safety_margin_ms:margin, execute_authorized:false, retry_authorized:false};
}
module.exports = {assessIsolatedReadiness};
