import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerProgramsCoreV1Routes } from "./programs_core_v1.js";

class ProgramsPoolStub {
  async query(): Promise<{ rows: any[]; rowCount: number }> {
    return { rows: [], rowCount: 0 };
  }
}

async function setupApp() {
  process.env.GEOX_TOKEN = "programs-token";
  process.env.GEOX_TENANT_ID = "tenantA";
  process.env.GEOX_PROJECT_ID = "projectA";
  process.env.GEOX_GROUP_ID = "groupA";
  process.env.GEOX_SCOPES = "ao_act.task.write,ao_act.index.read";

  const app = Fastify();
  registerProgramsCoreV1Routes(app, new ProgramsPoolStub() as any);
  await app.ready();
  return app;
}

test("tenant mismatch on POST /api/v1/programs returns JSON 404 and server remains alive", async () => {
  const app = await setupApp();

  const mismatchRes = await app.inject({
    method: "POST",
    url: "/api/v1/programs",
    headers: { authorization: "Bearer programs-token" },
    payload: {
      tenant_id: "tenantB",
      project_id: "projectB",
      group_id: "groupB",
      field_id: "field_1",
      season_id: "season_1",
      crop_code: "corn",
      goal_profile: {
        yield_priority: "high",
        quality_priority: "medium",
        residue_priority: "low",
        water_saving_priority: "medium",
        cost_priority: "medium"
      },
      constraints: {
        forbid_pesticide_classes: [],
        forbid_fertilizer_types: [],
        manual_approval_required_for: [],
        allow_night_irrigation: true
      }
    }
  });

  assert.equal(mismatchRes.statusCode, 404);
  assert.deepEqual(mismatchRes.json(), { ok: false, error: "NOT_FOUND" });

  const healthRes = await app.inject({ method: "GET", url: "/api/v1/programs", headers: { authorization: "Bearer programs-token" } });
  assert.equal(healthRes.statusCode, 200);
  assert.equal(healthRes.json().ok, true);

  await app.close();
});
