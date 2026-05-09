import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerAuthV1Routes } from "../src/routes/auth_v1";

test("GET /api/v1/session/me returns formalized identity/role/scope payload", async () => {
  const app = Fastify();
  registerAuthV1Routes(app);
  await app.ready();

  const originalTokens = process.env.GEOX_TOKENS_JSON;
  process.env.GEOX_TOKENS_JSON = JSON.stringify({
    version: "ao_act_tokens_v0",
    tokens: [{
      token: "tok-session-me",
      token_id: "tid_1",
      actor_id: "user_1",
      tenant_id: "tenant_1",
      project_id: "project_1",
      group_id: "group_1",
      role: "operator",
      scopes: ["fields.read", "alerts.read", "evidence_export.read"],
      allowed_field_ids: ["field_1", "field_2"],
      revoked: false
    }]
  });

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/session/me",
    headers: { authorization: "Bearer tok-session-me" }
  });

  if (originalTokens == null) delete process.env.GEOX_TOKENS_JSON;
  else process.env.GEOX_TOKENS_JSON = originalTokens;

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), {
    user_id: "user_1",
    display_name: null,
    tenant_id: "tenant_1",
    project_id: "project_1",
    group_id: "group_1",
    roles: ["operator"],
    scopes: ["fields.read", "alerts.read", "evidence_export.read"],
    allowed_field_ids: ["field_1", "field_2"],
    permissions: {
      customer_read: true,
      operator_read: true,
      operator_approve: false,
      operator_dispatch: false,
      operator_acceptance: false,
      operator_evidence_export: true,
      operator_alert_ack_close: false,
      admin_device_revoke: false
    }
  });

  await app.close();
});
