import test from "node:test";
import assert from "node:assert/strict";
import { projectProgramCostFromFacts } from "../src/projections/program_cost_v1";
import { projectProgramSlaFromFacts } from "../src/projections/program_sla_v1";
import { projectProgramEfficiencyFromFacts } from "../src/projections/program_efficiency_v1";

type Fact = { fact_id: string; occurred_at: string; record_json: any };

function fact(type: string, payload: any, occurred_at: string, fact_id: string): Fact {
  return { fact_id, occurred_at, record_json: { type, payload } };
}

test("projects cost/sla/efficiency with tenant isolation", () => {
  const rows: Fact[] = [
    fact("field_program_v1", { tenant_id: "t1", project_id: "p1", group_id: "g1", program_id: "prg_1", field_id: "f1", season_id: "s1", crop_code: "rice", budget: { currency: "USD" } }, "2026-03-21T10:00:00.000Z", "p1"),
    fact("resource_usage_v1", { tenant_id: "t1", project_id: "p1", group_id: "g1", program_id: "prg_1", resource_usage: { fuel_l: 5, electric_kwh: 10, water_l: 100, chemical_ml: 25 } }, "2026-03-21T10:01:00.000Z", "u1"),
    fact("cost_record_v1", { tenant_id: "t1", project_id: "p1", group_id: "g1", program_id: "prg_1", cost_amount: 45.5, currency: "USD" }, "2026-03-21T10:02:00.000Z", "c1"),
    fact("sla_evaluation_v1", { tenant_id: "t1", project_id: "p1", group_id: "g1", program_id: "prg_1", sla_name: "dispatch_latency", met: true, status: "MET" }, "2026-03-21T10:03:00.000Z", "s1"),
    fact("sla_evaluation_v1", { tenant_id: "t1", project_id: "p1", group_id: "g1", program_id: "prg_1", sla_name: "completion_time", met: false, status: "BREACH" }, "2026-03-21T10:04:00.000Z", "s2"),

    fact("field_program_v1", { tenant_id: "t2", project_id: "p2", group_id: "g2", program_id: "prg_2", field_id: "f2", season_id: "s2", crop_code: "corn", budget: { currency: "USD" } }, "2026-03-21T11:00:00.000Z", "p2")
  ];

  const cost = projectProgramCostFromFacts(rows);
  assert.equal(cost.length, 2);
  const c1 = cost.find((x) => x.program_id === "prg_1");
  assert.ok(c1);
  assert.equal(c1?.total_cost, 45.5);
  assert.equal(c1?.resource_usage_totals.water_l, 100);

  const sla = projectProgramSlaFromFacts(rows);
  const s1 = sla.find((x) => x.program_id === "prg_1");
  assert.ok(s1);
  assert.equal(s1?.total_checks, 2);
  assert.equal(s1?.met_checks, 1);
  assert.equal(s1?.latest_status, "BREACH");

  const efficiency = projectProgramEfficiencyFromFacts(rows);
  const e1 = efficiency.find((x) => x.program_id === "prg_1");
  assert.ok(e1);
  assert.ok((e1?.efficiency_index ?? 0) > 0);
});
