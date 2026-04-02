import test from "node:test";
import assert from "node:assert/strict";
import { generateAgronomyRecommendation } from "./engine";
import { resolveCropStage } from "./stage_resolver";

test("stage_resolver can produce crop stage for corn and tomato", () => {
  const now = Date.now();
  const cornStage = resolveCropStage({ cropCode: "corn", startDate: now - 20 * 24 * 60 * 60 * 1000, now });
  const tomatoStage = resolveCropStage({ cropCode: "tomato", startDate: now - 70 * 24 * 60 * 60 * 1000, now });
  assert.equal(cornStage, "vegetative");
  assert.equal(tomatoStage, "fruiting");
});

test("case1 corn + vegetative + soil_moisture=18 -> IRRIGATE", () => {
  const rec = generateAgronomyRecommendation({
    tenantId: "t",
    projectId: "p",
    groupId: "g",
    fieldId: "f1",
    cropCode: "corn",
    cropStage: "vegetative",
    currentMetrics: { soil_moisture: 18 },
  });
  assert.ok(rec);
  assert.equal(rec?.action_type, "IRRIGATE");
  assert.equal(rec?.crop_code, "corn");
  assert.equal(rec?.crop_stage, "vegetative");
  assert.ok(rec?.rule_id);
  assert.ok(Array.isArray(rec?.reason_codes));
  assert.ok(rec?.expected_effect);
  assert.ok(rec?.risk_if_not_execute);
});

test("case2 corn + flowering + soil_moisture=24 -> IRRIGATE(high)", () => {
  const rec = generateAgronomyRecommendation({
    tenantId: "t",
    projectId: "p",
    groupId: "g",
    fieldId: "f2",
    cropCode: "corn",
    cropStage: "flowering",
    currentMetrics: { soil_moisture: 24 },
  });
  assert.ok(rec);
  assert.equal(rec?.action_type, "IRRIGATE");
  assert.equal(rec?.priority, "high");
});

test("case3 tomato + vegetative -> FERTILIZE", () => {
  const rec = generateAgronomyRecommendation({
    tenantId: "t",
    projectId: "p",
    groupId: "g",
    fieldId: "f3",
    cropCode: "tomato",
    cropStage: "vegetative",
    currentMetrics: { soil_moisture: 35 },
  });
  assert.ok(rec);
  assert.equal(rec?.action_type, "FERTILIZE");
});

test("case4 tomato + fruiting + soil_moisture=26 -> IRRIGATE", () => {
  const rec = generateAgronomyRecommendation({
    tenantId: "t",
    projectId: "p",
    groupId: "g",
    fieldId: "f4",
    cropCode: "tomato",
    cropStage: "fruiting",
    currentMetrics: { soil_moisture: 26 },
  });
  assert.ok(rec);
  assert.equal(rec?.action_type, "IRRIGATE");
});
