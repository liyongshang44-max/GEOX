import test from "node:test";
import assert from "node:assert/strict";

import { evaluateRulesByInput } from "../rule_engine";
import { getRuleSkills } from "./registry";
import { resetSkillSwitches, switchSkill } from "./runtime_config";

function evaluateCorn(tenant_id: string): ReturnType<typeof evaluateRulesByInput> {
  return evaluateRulesByInput({
    tenant_id,
    project_id: "p",
    group_id: "g",
    field_id: "f",
    season_id: "s",
    crop_code: "corn",
    crop_stage: "vegetative",
    telemetry: { soil_moisture: 18 },
    constraints: {},
    context: { snapshot_ts: Date.now() },
  } as any);
}

test("stage6: version switch changes recommendation + reasons", () => {
  resetSkillSwitches();
  switchSkill({ skill_id: "corn_water_balance", version: "v2", enabled: false, scope: { crop_code: "corn" } });
  switchSkill({ skill_id: "corn_water_balance", version: "v1", enabled: true, scope: { crop_code: "corn" }, priority: 30 });

  const v1Result = evaluateCorn("tenantA");
  assert.equal(v1Result.length, 1);
  assert.equal(v1Result[0]?.rule_id, "corn_water_balance_v1");
  assert.deepEqual(v1Result[0]?.reasons, ["LOW_SOIL_MOISTURE"]);

  switchSkill({ skill_id: "corn_water_balance", version: "v2", enabled: true, scope: { crop_code: "corn" }, priority: 40 });

  const v2Result = evaluateCorn("tenantA");
  assert.equal(v2Result.length, 1);
  assert.equal(v2Result[0]?.rule_id, "corn_water_balance_v2");
  assert.deepEqual(v2Result[0]?.reasons, ["LOW_SOIL_MOISTURE_V2"]);
});

test("stage6: priority selects v2 when v1/v2 are both enabled", () => {
  resetSkillSwitches();
  switchSkill({ skill_id: "corn_water_balance", version: "v1", enabled: true, scope: { crop_code: "corn" }, priority: 10 });
  switchSkill({ skill_id: "corn_water_balance", version: "v2", enabled: true, scope: { crop_code: "corn" }, priority: 20 });

  const rules = getRuleSkills({ crop_code: "corn", tenant_id: "tenantA" });
  assert.equal(rules[0]?.version, "v2");

  const result = evaluateCorn("tenantA");
  assert.equal(result[0]?.rule_id, "corn_water_balance_v2");
});

test("stage6: tenant scope supported", () => {
  resetSkillSwitches();
  switchSkill({ skill_id: "corn_water_balance", version: "v1", enabled: true, priority: 50, scope: { crop_code: "corn", tenant_id: "tenantA" } });
  switchSkill({ skill_id: "corn_water_balance", version: "v2", enabled: true, priority: 60, scope: { crop_code: "corn", tenant_id: "tenantB" } });
  switchSkill({ skill_id: "corn_water_balance", version: "v2", enabled: false, scope: { crop_code: "corn" } });
  switchSkill({ skill_id: "corn_water_balance", version: "v1", enabled: false, scope: { crop_code: "corn" } });

  const resultA = evaluateCorn("tenantA");
  const resultB = evaluateCorn("tenantB");

  assert.equal(resultA[0]?.rule_id, "corn_water_balance_v1");
  assert.equal(resultB[0]?.rule_id, "corn_water_balance_v2");
});

test.after(() => {
  resetSkillSwitches();
});
