import test from "node:test";
import assert from "node:assert/strict";

import { evaluateRulesByInput } from "../rule_engine";
import { getRuleSkills } from "./registry";
import { listFallbackSkillSwitches, resetFallbackSkillSwitches } from "./runtime_config";

function evaluateCorn(tenant_id: string): Promise<ReturnType<typeof evaluateRulesByInput> extends Promise<infer T> ? T : never> {
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

test("stage6 fallback_config: priority selects v2 when v1/v2 are both enabled", async () => {
  resetFallbackSkillSwitches();
  const rules = await getRuleSkills({ crop_code: "corn", tenant_id: "tenantA" });
  assert.equal(rules[0]?.version, "v2");

  const result = await evaluateCorn("tenantA");
  assert.equal(result[0]?.rule_id, "corn_water_balance_v2");
});

test("stage6 fallback_config is queryable", () => {
  resetFallbackSkillSwitches();
  const rows = listFallbackSkillSwitches({ crop_code: "corn", enabled_only: true });
  assert.ok(rows.some((row) => row.skill_id === "corn_water_balance" && row.version === "v1"));
  assert.ok(rows.some((row) => row.skill_id === "corn_water_balance" && row.version === "v2"));
});

