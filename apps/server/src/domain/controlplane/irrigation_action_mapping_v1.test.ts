import test from "node:test";
import assert from "node:assert/strict";
import {
  IRRIGATION_CONTROL_PLANE_ACTION,
  IRRIGATION_RECOMMENDATION_ACTION,
  mapRecommendationActionToControlPlane,
  toCustomerFacingActionLabel,
} from "./irrigation_action_mapping_v1.js";

test("irrigation mapping: recommendation action name is frozen", () => {
  assert.equal(IRRIGATION_RECOMMENDATION_ACTION, "irrigation.start");
});

test("irrigation mapping: recommendation action maps to control-plane action", () => {
  assert.equal(mapRecommendationActionToControlPlane(IRRIGATION_RECOMMENDATION_ACTION), IRRIGATION_CONTROL_PLANE_ACTION);
  assert.equal(mapRecommendationActionToControlPlane("irrigation.start"), IRRIGATION_CONTROL_PLANE_ACTION);
  assert.equal(mapRecommendationActionToControlPlane(" irrigation.start "), IRRIGATION_CONTROL_PLANE_ACTION);
  assert.equal(mapRecommendationActionToControlPlane("inspection.start"), null);
  assert.equal(mapRecommendationActionToControlPlane("fertilization.start"), null);
});

test("irrigation mapping: control-plane action name is frozen", () => {
  assert.equal(IRRIGATION_CONTROL_PLANE_ACTION, "IRRIGATE");
});

test("irrigation mapping: customer-facing label is frozen to 灌溉", () => {
  assert.equal(toCustomerFacingActionLabel(IRRIGATION_RECOMMENDATION_ACTION), "灌溉");
  assert.equal(toCustomerFacingActionLabel("irrigation.start"), "灌溉");
  assert.equal(toCustomerFacingActionLabel(IRRIGATION_CONTROL_PLANE_ACTION), "灌溉");
  assert.equal(toCustomerFacingActionLabel("IRRIGATE"), "灌溉");
});
