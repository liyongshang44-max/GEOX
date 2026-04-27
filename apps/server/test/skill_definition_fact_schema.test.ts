import test from "node:test";
import assert from "node:assert/strict";
import { appendSkillDefinitionFact } from "../src/domain/skill_registry/facts";

const db = {
  async query(_sql: string, params: unknown[]) {
    void params?.[3];
    return { rowCount: 1 };
  },
};

const baseInput = {
  tenant_id: "tenant-1",
  project_id: "project-1",
  group_id: "group-1",
  skill_id: "skill-1",
  version: "1.0.0",
  display_name: "Skill One",
  category: "AGRONOMY" as const,
  status: "ACTIVE" as const,
  trigger_stage: "before_dispatch" as const,
  scope_type: "TENANT" as const,
  rollout_mode: "DIRECT" as const,
  input_schema_digest: "in-digest",
  output_schema_digest: "out-digest",
};

test("appendSkillDefinitionFact maps legacy version to skill_version", async () => {
  const result = await appendSkillDefinitionFact(db as any, {
    ...baseInput,
  });

  assert.equal(result.payload.version, "1.0.0");
  assert.equal(result.payload.skill_version, "1.0.0");
});

test("appendSkillDefinitionFact accepts skill_version only", async () => {
  const result = await appendSkillDefinitionFact(db as any, {
    ...baseInput,
    version: undefined,
    skill_version: "2.1.0",
  });

  assert.equal(result.payload.version, "2.1.0");
  assert.equal(result.payload.skill_version, "2.1.0");
});

test("appendSkillDefinitionFact parses new governance fields", async () => {
  const result = await appendSkillDefinitionFact(db as any, {
    ...baseInput,
    skill_version: "3.0.0",
    input_schema: { type: "object", properties: { n: { type: "number" } } },
    output_schema: { $ref: "https://schemas.geox.dev/skill/output.json" },
    capabilities: ["RECOMMEND", "DISPATCH"],
    risk_level: "HIGH",
    required_evidence: ["photo_upload", "sensor_snapshot"],
    tenant_scope: ["tenant-1"],
    crop_scope: ["corn"],
    device_scope: ["PUMP"],
    binding_priority: 9,
    enabled: false,
    fallback_policy: { mode: "use_default_skill" },
    audit_policy: { retain_days: 365 },
  });

  assert.deepEqual(result.payload.capabilities, ["RECOMMEND", "DISPATCH"]);
  assert.equal(result.payload.risk_level, "HIGH");
  assert.equal(result.payload.binding_priority, 9);
  assert.equal(result.payload.enabled, false);
  assert.deepEqual(result.payload.fallback_policy, { mode: "use_default_skill" });
  assert.deepEqual(result.payload.audit_policy, { retain_days: 365 });
});
