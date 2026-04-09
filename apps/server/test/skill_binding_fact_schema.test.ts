import test from "node:test";
import assert from "node:assert/strict";
import { ZodError } from "zod";
import { appendSkillBindingFact } from "../src/domain/skill_registry/facts";

const baseInput = {
  tenant_id: "tenant-1",
  project_id: "project-1",
  group_id: "group-1",
  skill_id: "skill-1",
  version: "1.0.0",
  category: "OPS" as const,
  status: "ACTIVE" as const,
  scope_type: "TENANT" as const,
  rollout_mode: "DIRECT" as const,
  trigger_stage: "before_dispatch" as const,
  bind_target: "default",
  priority: 0,
};

const neverCalledDb = {
  async query() {
    throw new Error("db.query should not be called when schema validation fails");
  },
};

test("appendSkillBindingFact rejects legacy effective field in writes", async () => {
  await assert.rejects(
    appendSkillBindingFact(neverCalledDb as any, {
      ...baseInput,
      effective: false,
    } as any),
    (error: unknown) => {
      assert.ok(error instanceof ZodError);
      assert.match(error.message, /Unrecognized key\(s\) in object: 'effective'/);
      return true;
    }
  );
});

test("appendSkillBindingFact rejects legacy overridden_by field in writes", async () => {
  await assert.rejects(
    appendSkillBindingFact(neverCalledDb as any, {
      ...baseInput,
      overridden_by: "fact-123",
    } as any),
    (error: unknown) => {
      assert.ok(error instanceof ZodError);
      assert.match(error.message, /Unrecognized key\(s\) in object: 'overridden_by'/);
      return true;
    }
  );
});
