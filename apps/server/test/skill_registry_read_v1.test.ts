import test from "node:test";
import assert from "node:assert/strict";
import { querySkillBindingProjectionV1 } from "../src/projections/skill_registry_read_v1";

function bindingFactRow(
  fact_id: string,
  occurred_at: string,
  payload: Record<string, unknown>
): { fact_id: string; occurred_at: string; record_json: { type: string; payload: Record<string, unknown> } } {
  return {
    fact_id,
    occurred_at,
    record_json: {
      type: "skill_binding_v1",
      payload,
    },
  };
}

test("same skill_id override chain keeps only newest fact effective", async () => {
  const rows = [
    bindingFactRow("f1", "2026-04-01T00:00:00.000Z", {
      tenant_id: "t1",
      project_id: "p1",
      group_id: "g1",
      binding_id: "b1",
      skill_id: "skill.same",
      version: "v1",
      category: "agronomy",
      scope_type: "FIELD",
      bind_target: "field_1",
      status: "ACTIVE",
    }),
    bindingFactRow("f2", "2026-04-01T00:01:00.000Z", {
      tenant_id: "t1",
      project_id: "p1",
      group_id: "g1",
      binding_id: "b2",
      skill_id: "skill.same",
      version: "v1",
      category: "agronomy",
      scope_type: "FIELD",
      bind_target: "field_1",
      status: "ACTIVE",
    }),
    bindingFactRow("f3", "2026-04-01T00:02:00.000Z", {
      tenant_id: "t1",
      project_id: "p1",
      group_id: "g1",
      binding_id: "b3",
      skill_id: "skill.same",
      version: "v1",
      category: "agronomy",
      scope_type: "FIELD",
      bind_target: "field_1",
      status: "ACTIVE",
    }),
  ];

  const pool = {
    query: async () => ({ rows }),
  };

  const out = await querySkillBindingProjectionV1(pool as any, {
    tenant_id: "t1",
    project_id: "p1",
    group_id: "g1",
  });

  assert.equal(out.items_effective.length, 1);
  assert.equal(out.items_effective[0].fact_id, "f3");
  assert.equal(out.items_effective[0].effective, true);
  assert.equal(out.items_effective[0].overridden_by, null);

  const byFact = new Map(out.items_history.map((it) => [it.fact_id, it]));
  assert.equal(byFact.get("f1")?.effective, false);
  assert.equal(byFact.get("f1")?.overridden_by, "f3");
  assert.equal(byFact.get("f2")?.effective, false);
  assert.equal(byFact.get("f2")?.overridden_by, "f3");
  assert.equal(byFact.get("f3")?.effective, true);
  assert.equal(byFact.get("f3")?.overridden_by, null);
});

test("different skill_id can be effective at the same time", async () => {
  const rows = [
    bindingFactRow("f10", "2026-04-01T00:00:00.000Z", {
      tenant_id: "t1",
      project_id: "p1",
      group_id: "g1",
      binding_id: "b10",
      skill_id: "skill.alpha",
      version: "v1",
      category: "agronomy",
      scope_type: "FIELD",
      bind_target: "field_1",
      status: "ACTIVE",
    }),
    bindingFactRow("f11", "2026-04-01T00:01:00.000Z", {
      tenant_id: "t1",
      project_id: "p1",
      group_id: "g1",
      binding_id: "b11",
      skill_id: "skill.beta",
      version: "v1",
      category: "agronomy",
      scope_type: "FIELD",
      bind_target: "field_1",
      status: "ACTIVE",
    }),
  ];

  const pool = {
    query: async () => ({ rows }),
  };

  const out = await querySkillBindingProjectionV1(pool as any, {
    tenant_id: "t1",
    project_id: "p1",
    group_id: "g1",
  });

  const effectiveFactIds = new Set(out.items_effective.map((it) => it.fact_id));
  assert.equal(effectiveFactIds.has("f10"), true);
  assert.equal(effectiveFactIds.has("f11"), true);
  assert.equal(out.items_effective.length, 2);
});

test("maps fixed internal category keys to public category", async () => {
  const rows = [
    bindingFactRow("c1", "2026-04-01T00:00:00.000Z", {
      tenant_id: "t1",
      project_id: "p1",
      group_id: "g1",
      binding_id: "b1",
      skill_id: "skill.crop",
      version: "v1",
      category: "crop_skill",
      scope_type: "FIELD",
      bind_target: "field_1",
      status: "ACTIVE",
    }),
    bindingFactRow("c2", "2026-04-01T00:01:00.000Z", {
      tenant_id: "t1",
      project_id: "p1",
      group_id: "g1",
      binding_id: "b2",
      skill_id: "skill.agronomy",
      version: "v1",
      category: "agronomy_skill",
      scope_type: "FIELD",
      bind_target: "field_2",
      status: "ACTIVE",
    }),
    bindingFactRow("c3", "2026-04-01T00:02:00.000Z", {
      tenant_id: "t1",
      project_id: "p1",
      group_id: "g1",
      binding_id: "b3",
      skill_id: "skill.device",
      version: "v1",
      category: "device_skill",
      scope_type: "FIELD",
      bind_target: "field_3",
      status: "ACTIVE",
    }),
    bindingFactRow("c4", "2026-04-01T00:03:00.000Z", {
      tenant_id: "t1",
      project_id: "p1",
      group_id: "g1",
      binding_id: "b4",
      skill_id: "skill.acceptance",
      version: "v1",
      category: "acceptance_skill",
      scope_type: "FIELD",
      bind_target: "field_4",
      status: "ACTIVE",
    }),
    bindingFactRow("c5", "2026-04-01T00:04:00.000Z", {
      tenant_id: "t1",
      project_id: "p1",
      group_id: "g1",
      binding_id: "b5",
      skill_id: "skill.sensing",
      version: "v1",
      category: "sensing_skill",
      scope_type: "FIELD",
      bind_target: "field_5",
      status: "ACTIVE",
    }),
    bindingFactRow("c6", "2026-04-01T00:05:00.000Z", {
      tenant_id: "t1",
      project_id: "p1",
      group_id: "g1",
      binding_id: "b6",
      skill_id: "skill.unknown",
      version: "v1",
      category: "unexpected_key",
      scope_type: "FIELD",
      bind_target: "field_6",
      status: "ACTIVE",
    }),
  ];

  const pool = {
    query: async () => ({ rows }),
  };

  const out = await querySkillBindingProjectionV1(pool as any, {
    tenant_id: "t1",
    project_id: "p1",
    group_id: "g1",
  });

  const byFact = new Map(out.items_history.map((it) => [it.fact_id, it]));
  assert.equal(byFact.get("c1")?.category, "agronomy");
  assert.equal(byFact.get("c2")?.category, "agronomy");
  assert.equal(byFact.get("c3")?.category, "device");
  assert.equal(byFact.get("c4")?.category, "acceptance");
  assert.equal(byFact.get("c5")?.category, "sensing");
  assert.equal(byFact.get("c6")?.category, "unknown");
});
