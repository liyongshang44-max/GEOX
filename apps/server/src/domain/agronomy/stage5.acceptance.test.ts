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

test("stage_resolver priority: explicit stage > days_after_planting > unknown", () => {
  assert.equal(resolveCropStage({ cropCode: "corn", explicitStage: "reproductive", daysAfterPlanting: 5 }), "reproductive");
  assert.equal(resolveCropStage({ cropCode: "corn", daysAfterPlanting: 45 }), "reproductive");
  assert.equal(resolveCropStage({ cropCode: "corn" }), "unknown");
});

test("corn vegetative + low moisture -> skill rule v2", async () => {
  const rec = await generateAgronomyRecommendation({
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
  assert.equal(rec?.rule_id, "corn_water_balance_v2");
  assert.deepEqual(rec?.reasons, ["LOW_SOIL_MOISTURE_V2"]);
  assert.equal(rec?.expected_effect?.[0]?.metric, "moisture_increase");
  assert.equal(rec?.expected_effect?.[0]?.value, 15);
});

test("corn reproductive currently has no enabled skill rule", async () => {
  const rec = await generateAgronomyRecommendation({
    tenantId: "t",
    projectId: "p",
    groupId: "g",
    fieldId: "f2",
    cropCode: "corn",
    cropStage: "reproductive",
    currentMetrics: { canopy_temp: 35 },
  });
  assert.equal(rec, null);
});

test("tomato flowering currently has no enabled skill rule", async () => {
  const rec = await generateAgronomyRecommendation({
    tenantId: "t",
    projectId: "p",
    groupId: "g",
    fieldId: "f3",
    cropCode: "tomato",
    cropStage: "flowering",
    currentMetrics: { canopy_temp: 33 },
  });
  assert.equal(rec, null);
});

test("tomato fruiting -> fertilize skill rule", async () => {
  const rec = await generateAgronomyRecommendation({
    tenantId: "t",
    projectId: "p",
    groupId: "g",
    fieldId: "f4",
    cropCode: "tomato",
    cropStage: "fruiting",
    currentMetrics: {},
    constraints: { ec: 1.2 },
  });
  assert.ok(rec);
  assert.equal(rec?.action_type, "FERTILIZE");
  assert.equal(rec?.rule_id, "tomato_fertilize_v1");
  assert.deepEqual(rec?.reasons, ["FRUITING_STAGE"]);
  assert.equal(rec?.expected_effect?.[0]?.metric, "growth_boost");
  assert.equal(rec?.expected_effect?.[0]?.value, 15);
});
