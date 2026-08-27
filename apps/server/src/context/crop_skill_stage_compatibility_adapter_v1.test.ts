import assert from "node:assert/strict";
import test from "node:test";

import type { EvidenceScopeV1 } from "../contracts/canonical_evidence_v1.js";
import type { CropSkill } from "../domain/agronomy/skills/types.js";
import { cornCrop } from "../domain/agronomy/skills/crop/corn/corn.crop.js";
import { tomatoCrop } from "../domain/agronomy/skills/crop/tomato/tomato.crop.js";
import { projectCropSkillStageCompatibilityV1 } from "./crop_skill_stage_compatibility_adapter_v1.js";

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
    state_id: "crop_skill_stage:A",
    scope,
    crop_code: "corn",
    crop_skill: cornCrop,
    evaluated_at: "2026-08-27T10:00:00.000Z",
    decision_time: "2026-08-27T10:00:00.000Z",
    context_snapshot_ref: "context_snapshot:A",
    ...overrides,
  } as any;
}

test("B-05d missing day input remains UNKNOWN instead of accepting skill seedling default", () => {
  const state = projectCropSkillStageCompatibilityV1(base());

  assert.equal(state.stage, null);
  assert.equal(state.authority_state, "UNKNOWN");
  assert.equal(state.source_class, "NONE");
  assert.equal(state.decision_input_eligible, false);
  assert.deepEqual(state.reason_codes, ["B05D_DAYS_INPUT_MISSING"]);
});

test("B-05d explicit zero days is distinguishable from missing and remains compatibility-only", () => {
  const state = projectCropSkillStageCompatibilityV1(base({ days_after_sowing: 0 }));

  assert.equal(state.stage, "seedling");
  assert.equal(state.authority_state, "COMPATIBILITY_NON_AUTHORITATIVE");
  assert.equal(state.source_class, "CROP_SKILL_CALCULATOR");
  assert.equal(state.decision_input_eligible, false);
  assert.equal(state.derived_state_ref, null);
});

test("B-05d valid corn skill result is compatibility-only", () => {
  const state = projectCropSkillStageCompatibilityV1(base({ days_after_sowing: 20 }));

  assert.equal(state.stage, "vegetative");
  assert.equal(state.authority_state, "COMPATIBILITY_NON_AUTHORITATIVE");
  assert.equal(state.source_class, "CROP_SKILL_CALCULATOR");
  assert.equal(state.decision_input_eligible, false);
});

test("B-05d days_after_planting alias is accepted only when explicit and valid", () => {
  const state = projectCropSkillStageCompatibilityV1(
    base({ days_after_planting: 20 }),
  );

  assert.equal(state.stage, "vegetative");
  assert.equal(state.source_class, "CROP_SKILL_CALCULATOR");
});

test("B-05d negative day input preserves UNKNOWN", () => {
  const state = projectCropSkillStageCompatibilityV1(
    base({ days_after_sowing: -1 }),
  );

  assert.equal(state.stage, null);
  assert.equal(state.authority_state, "UNKNOWN");
  assert.deepEqual(state.reason_codes, ["B05D_NEGATIVE_DAYS_AFTER_SOWING_REJECTED"]);
});

test("B-05d non-finite day input preserves UNKNOWN", () => {
  const state = projectCropSkillStageCompatibilityV1(
    base({ days_after_sowing: Number.NaN }),
  );

  assert.equal(state.stage, null);
  assert.equal(state.authority_state, "UNKNOWN");
  assert.deepEqual(state.reason_codes, ["B05D_DAYS_AFTER_SOWING_INVALID"]);
});

test("B-05d crop/skill mismatch preserves UNKNOWN", () => {
  const state = projectCropSkillStageCompatibilityV1(
    base({ crop_code: "tomato", crop_skill: cornCrop, days_after_sowing: 20 }),
  );

  assert.equal(state.stage, null);
  assert.equal(state.authority_state, "UNKNOWN");
  assert.deepEqual(state.reason_codes, ["B05D_CROP_SKILL_SCOPE_MISMATCH"]);
});

test("B-05d disabled crop skill preserves UNKNOWN", () => {
  const disabled: CropSkill = { ...cornCrop, enabled: false };
  const state = projectCropSkillStageCompatibilityV1(
    base({ crop_skill: disabled, days_after_sowing: 20 }),
  );

  assert.equal(state.stage, null);
  assert.equal(state.authority_state, "UNKNOWN");
  assert.deepEqual(state.reason_codes, ["B05D_CROP_SKILL_DISABLED"]);
});

test("B-05d unrecognized skill stage preserves UNKNOWN", () => {
  const weird = {
    ...cornCrop,
    resolveStage() {
      return "mystery-stage";
    },
  } as unknown as CropSkill;

  const state = projectCropSkillStageCompatibilityV1(
    base({ crop_skill: weird, days_after_sowing: 20 }),
  );

  assert.equal(state.stage, null);
  assert.equal(state.authority_state, "UNKNOWN");
  assert.deepEqual(state.reason_codes, ["B05D_CROP_SKILL_STAGE_UNRECOGNIZED"]);
});

test("B-05d resolver exception preserves UNKNOWN", () => {
  const broken = {
    ...cornCrop,
    resolveStage() {
      throw new Error("boom");
    },
  } as CropSkill;

  const state = projectCropSkillStageCompatibilityV1(
    base({ crop_skill: broken, days_after_sowing: 20 }),
  );

  assert.equal(state.stage, null);
  assert.equal(state.authority_state, "UNKNOWN");
  assert.deepEqual(state.reason_codes, ["B05D_CROP_SKILL_RESOLVER_FAILED"]);
});

test("B-05d tomato skill can calculate compatibility stage without gaining authority", () => {
  const state = projectCropSkillStageCompatibilityV1(
    base({
      crop_code: "tomato",
      crop_skill: tomatoCrop,
      days_after_sowing: 50,
    }),
  );

  assert.equal(state.stage, "flowering");
  assert.equal(state.authority_state, "COMPATIBILITY_NON_AUTHORITATIVE");
  assert.equal(state.source_class, "CROP_SKILL_CALCULATOR");
  assert.equal(state.decision_input_eligible, false);
});

test("B-05d invalid evaluated_at fails closed", () => {
  assert.throws(
    () => projectCropSkillStageCompatibilityV1(
      base({ days_after_sowing: 20, evaluated_at: "bad-time" }),
    ),
    /B05D_EVALUATED_AT_INVALID/,
  );
});
