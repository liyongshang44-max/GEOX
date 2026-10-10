import assert from "node:assert/strict";
import test from "node:test";

import type { EvidenceScopeV1 } from "../contracts/canonical_evidence_v1.js";
import { projectLegacyCropStageCompatibilityV1 } from "./legacy_crop_stage_compatibility_adapter_v1.js";

const scope: EvidenceScopeV1 = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: null,
};

function base(overrides: Record<string, unknown> = {}) {
  return {
    state_id: "stage_state:A",
    scope,
    crop_code: "corn",
    evaluated_at: "2026-08-27T10:00:00.000Z",
    decision_time: "2026-08-27T10:00:00.000Z",
    context_snapshot_ref: "context_snapshot:A",
    ...overrides,
  } as any;
}

test("B-05c explicit legacy stage is compatibility-only and never decision-input eligible", () => {
  const state = projectLegacyCropStageCompatibilityV1(base({ explicit_stage: "vegetative" }));

  assert.equal(state.stage, "vegetative");
  assert.equal(state.authority_state, "COMPATIBILITY_NON_AUTHORITATIVE");
  assert.equal(state.source_class, "DECLARED_STAGE_COMPATIBILITY");
  assert.equal(state.decision_input_eligible, false);
  assert.equal(state.derived_state_ref, null);
});

test("B-05c valid DAP can be represented only as compatibility stage", () => {
  const state = projectLegacyCropStageCompatibilityV1(base({ days_after_planting: 20 }));

  assert.equal(state.stage, "vegetative");
  assert.equal(state.authority_state, "COMPATIBILITY_NON_AUTHORITATIVE");
  assert.equal(state.source_class, "DAP_CALCULATOR");
  assert.equal(state.decision_input_eligible, false);
});

test("B-05c valid start date can be represented only as compatibility stage", () => {
  const state = projectLegacyCropStageCompatibilityV1(
    base({ start_date: "2026-08-17T10:00:00.000Z" }),
  );

  assert.equal(state.stage, "seed");
  assert.equal(state.authority_state, "COMPATIBILITY_NON_AUTHORITATIVE");
  assert.equal(state.source_class, "START_DATE_CALCULATOR");
  assert.equal(state.decision_input_eligible, false);
});

test("B-05c negative DAP preserves canonical UNKNOWN instead of clamping to zero", () => {
  const state = projectLegacyCropStageCompatibilityV1(base({ days_after_planting: -2 }));

  assert.equal(state.stage, null);
  assert.equal(state.authority_state, "UNKNOWN");
  assert.equal(state.source_class, "NONE");
  assert.equal(state.decision_input_eligible, false);
  assert.deepEqual(state.reason_codes, ["B05C_NEGATIVE_DAP_REJECTED"]);
});

test("B-05c invalid start date preserves canonical UNKNOWN instead of producing an early stage", () => {
  const state = projectLegacyCropStageCompatibilityV1(base({ start_date: "not-a-date" }));

  assert.equal(state.stage, null);
  assert.equal(state.authority_state, "UNKNOWN");
  assert.equal(state.source_class, "NONE");
  assert.deepEqual(state.reason_codes, ["B05C_INVALID_START_DATE_REJECTED"]);
});

test("B-05c future start date preserves canonical UNKNOWN", () => {
  const state = projectLegacyCropStageCompatibilityV1(
    base({ start_date: "2026-08-28T10:00:00.000Z" }),
  );

  assert.equal(state.stage, null);
  assert.equal(state.authority_state, "UNKNOWN");
  assert.deepEqual(state.reason_codes, ["B05C_FUTURE_START_DATE_REJECTED"]);
});

test("B-05c unknown crop preserves canonical UNKNOWN", () => {
  const state = projectLegacyCropStageCompatibilityV1(
    base({ crop_code: "unknown-crop", days_after_planting: 20 }),
  );

  assert.equal(state.stage, null);
  assert.equal(state.authority_state, "UNKNOWN");
  assert.equal(state.source_class, "NONE");
  assert.deepEqual(state.reason_codes, ["B05C_LEGACY_RESOLVER_UNKNOWN"]);
});

test("B-05c missing stage input remains canonical UNKNOWN", () => {
  const state = projectLegacyCropStageCompatibilityV1(base());

  assert.equal(state.stage, null);
  assert.equal(state.authority_state, "UNKNOWN");
  assert.equal(state.source_class, "NONE");
  assert.deepEqual(state.reason_codes, ["B05C_STAGE_INPUT_MISSING"]);
});

test("B-05c invalid explicit stage may fall through to a valid nonnegative DAP compatibility path", () => {
  const state = projectLegacyCropStageCompatibilityV1(
    base({ explicit_stage: "not-real", days_after_planting: 20 }),
  );

  assert.equal(state.stage, "vegetative");
  assert.equal(state.source_class, "DAP_CALCULATOR");
  assert.equal(state.authority_state, "COMPATIBILITY_NON_AUTHORITATIVE");
});

test("B-05c invalid explicit stage without a valid lower-priority source remains UNKNOWN", () => {
  const state = projectLegacyCropStageCompatibilityV1(base({ explicit_stage: "not-real" }));

  assert.equal(state.stage, null);
  assert.equal(state.authority_state, "UNKNOWN");
  assert.deepEqual(state.reason_codes, ["B05C_EXPLICIT_STAGE_NOT_ACCEPTED"]);
});

test("B-05c invalid evaluated_at fails closed", () => {
  assert.throws(
    () => projectLegacyCropStageCompatibilityV1(base({ evaluated_at: "bad-time" })),
    /B05C_EVALUATED_AT_INVALID/,
  );
});
