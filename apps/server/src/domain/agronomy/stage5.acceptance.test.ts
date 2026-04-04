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

test("corn vegetative + low moisture -> IRRIGATE", async () => {
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
  assert.equal(rec?.rule_id, "corn_vegetative_low_moisture_irrigate_v1");
  assert.ok((rec?.reasons.length ?? 0) > 0);
});

test("corn reproductive + high canopy temp -> INSPECT", async () => {
  const rec = await generateAgronomyRecommendation({
    tenantId: "t",
    projectId: "p",
    groupId: "g",
    fieldId: "f2",
    cropCode: "corn",
    cropStage: "reproductive",
    currentMetrics: { canopy_temp: 35 },
  });
  assert.ok(rec);
  assert.equal(rec?.action_type, "INSPECT");
  assert.equal(rec?.rule_id, "corn_reproductive_heat_inspect_v1");
  assert.ok((rec?.reasons.length ?? 0) > 0);
});

test("tomato flowering + high canopy temp -> INSPECT", async () => {
  const rec = await generateAgronomyRecommendation({
    tenantId: "t",
    projectId: "p",
    groupId: "g",
    fieldId: "f3",
    cropCode: "tomato",
    cropStage: "flowering",
    currentMetrics: { canopy_temp: 33 },
  });
  assert.ok(rec);
  assert.equal(rec?.action_type, "INSPECT");
  assert.equal(rec?.rule_id, "tomato_flowering_high_temp_inspect_v1");
  assert.ok((rec?.reasons.length ?? 0) > 0);
});

test("tomato fruiting + low ec -> FERTILIZE", async () => {
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
  assert.equal(rec?.rule_id, "tomato_fruiting_low_nutrient_fertilize_v1");
  assert.ok((rec?.reasons.length ?? 0) > 0);
});
