import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerSkillsV1Routes } from "../src/routes/skills_v1";

const TOKEN = process.env.GEOX_TOKEN || process.env.GEOX_AO_ACT_TOKEN || "";

test("POST /api/v1/skills/bindings/override returns 400 when payload includes effective", async () => {
  const app = Fastify();
  const pool = {
    query: async () => ({ rows: [] }),
  } as any;

  registerSkillsV1Routes(app, pool);
  await app.ready();

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/skills/bindings/override",
    headers: { authorization: `Bearer ${TOKEN}` },
    payload: {
      skill_id: "skill-irrigation",
      version: "v1",
      category: "AGRONOMY",
      bind_target: "default",
      effective: true,
    },
  });

  assert.equal(res.statusCode, 400);
  const body = res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, "INVALID_PAYLOAD");

  await app.close();
});

test("POST /api/v1/skills/bindings/override succeeds when projection-derived fields are omitted", async () => {
  const app = Fastify();
  let insertCount = 0;
  const pool = {
    query: async () => {
      insertCount += 1;
      return { rows: [] };
    },
  } as any;

  registerSkillsV1Routes(app, pool);
  await app.ready();

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/skills/bindings/override",
    headers: { authorization: `Bearer ${TOKEN}` },
    payload: {
      skill_id: "skill-irrigation",
      version: "v1",
      category: "AGRONOMY",
      bind_target: "default",
      enabled: true,
      priority: 1,
      config_patch: { mode: "safe" },
    },
  });

  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.fact_id, "string");
  assert.equal(typeof body.occurred_at, "string");
  assert.equal(insertCount, 1);
  assert.equal("effective" in body, false);
  assert.equal("overridden_by" in body, false);

  await app.close();
});
