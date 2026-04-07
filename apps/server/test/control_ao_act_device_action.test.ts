import test from "node:test";
import assert from "node:assert/strict";
import { resolveTaskCapabilityViaDeviceSkillsResult } from "@geox/device-skills";
import { validateDeviceActionRequirementsV1 } from "../src/routes/control_ao_act";

test("FERTILIZE accepts dose_ml via fertilizer_unit_v1 capability mapping", () => {
  const capabilityResolution = resolveTaskCapabilityViaDeviceSkillsResult({
    action_type: "FERTILIZE",
    task_type: "FERTILIZE",
    target: { kind: "device", ref: "fert_unit_01" },
    parameters: { dose_ml: 120 },
    meta: { task_type: "FERTILIZE", device_target: "fert_unit_01" }
  });
  assert.equal(capabilityResolution.ok, true);
  assert.equal((capabilityResolution as any).resolution.parameters.chemical_ml, 120);

  const validation = validateDeviceActionRequirementsV1({
    action_type: "FERTILIZE",
    execution_parameters: { dose_ml: 120 },
    capability_resolution: capabilityResolution
  });
  assert.deepEqual(validation, { ok: true });
});

test("returns DEVICE_ACTION_TYPE_MISMATCH for resolved action_type mismatch", () => {
  const validation = validateDeviceActionRequirementsV1({
    action_type: "IRRIGATE",
    execution_parameters: { duration_sec: 30 },
    capability_resolution: {
      ok: true,
      resolution: {
        parameters: { action_type: "FERTILIZE" }
      }
    }
  });
  assert.equal(validation.ok, false);
  assert.equal((validation as any).error, "DEVICE_ACTION_TYPE_MISMATCH");
});

test("returns DEVICE_ACTION_MISSING_PARAMETERS for missing required parameters", () => {
  const validation = validateDeviceActionRequirementsV1({
    action_type: "FERTILIZE",
    execution_parameters: {},
    capability_resolution: {
      ok: true,
      resolution: {
        parameters: { action_type: "FERTILIZE", device_id: "fert_unit_01" }
      }
    }
  });
  assert.equal(validation.ok, false);
  assert.equal((validation as any).error, "DEVICE_ACTION_MISSING_PARAMETERS");
});
