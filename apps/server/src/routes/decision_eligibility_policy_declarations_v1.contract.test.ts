import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

import {
  DECISION_ELIGIBILITY_POLICY_DECLARATION_POST_PATH_V1,
  registerDecisionEligibilityPolicyDeclarationV1Routes,
} from "./decision_eligibility_policy_declarations_v1.js";

const declaration = {
  policy_id: "synthetic_route_policy_alpha",
  policy_version: "v1",
  scope: {
    decision_scope: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "fieldA",
      zone_id: null,
      season_id: "seasonA",
    },
    scope_anchor_type: "PROGRAM",
    scope_anchor_ref: "program_test_only",
  },
  applicable_action_types: ["CUSTOM_ACTION_ALPHA"],
  required_criteria: ["CONSEQUENCE"],
  lifecycle_semantics: "B07D_LIFECYCLE_STATE_V1",
  provenance_refs: ["test-only:route-provenance"],
  effective_from: "2099-01-01T00:00:00.000Z",
  effective_until: null,
  supersedes_policy_ref: null,
  limitations: ["TEST_ONLY_SYNTHETIC_POLICY_CONTENT"],
};

function tokenJson(role: string, scopes: string[]) {
  return JSON.stringify({
    version: "ao_act_tokens_v0",
    tokens: [{
      token: "route-secret",
      token_id: "route-token",
      actor_id: "route-actor",
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      role,
      scopes,
      revoked: false,
    }],
  });
}

function fakePool() {
  const calls: string[] = [];
  const client = {
    async query(sql: string) {
      calls.push(sql);
      if (sql.includes("SELECT fact_id, occurred_at, record_json")) return { rows: [] };
      return { rows: [] };
    },
    release() { calls.push("RELEASE"); },
  };
  return { pool: { async connect() { calls.push("CONNECT"); return client; } } as any, calls };
}

async function withTokens<T>(json: string, fn: () => Promise<T>): Promise<T> {
  const before = process.env.GEOX_TOKENS_JSON;
  process.env.GEOX_TOKENS_JSON = json;
  try {
    return await fn();
  } finally {
    if (before === undefined) delete process.env.GEOX_TOKENS_JSON;
    else process.env.GEOX_TOKENS_JSON = before;
  }
}

test("authorized agronomist route appends declaration fact", async () => {
  const { pool, calls } = fakePool();
  const app = Fastify();
  registerDecisionEligibilityPolicyDeclarationV1Routes(app, pool);
  const response = await withTokens(
    tokenJson("agronomist", ["decision.eligibility.policy.declare"]),
    () => app.inject({
      method: "POST",
      url: DECISION_ELIGIBILITY_POLICY_DECLARATION_POST_PATH_V1,
      headers: { authorization: "Bearer route-secret" },
      payload: { declaration, change_reason: "Synthetic route contract test" },
    }),
  );
  await app.close();

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.ok, true);
  assert.equal(body.created, true);
  assert.equal(body.declaration.authority_state, "POLICY_DECLARATION_ONLY");
  assert.equal(body.declaration.declaration_source_ref, "actor:route-actor");
  assert.equal(calls.some((sql) => sql.startsWith("INSERT INTO facts")), true);
});

test("admin with explicit capability is denied before database access", async () => {
  const { pool, calls } = fakePool();
  const app = Fastify();
  registerDecisionEligibilityPolicyDeclarationV1Routes(app, pool);
  const response = await withTokens(
    tokenJson("admin", ["decision.eligibility.policy.declare"]),
    () => app.inject({
      method: "POST",
      url: DECISION_ELIGIBILITY_POLICY_DECLARATION_POST_PATH_V1,
      headers: { authorization: "Bearer route-secret" },
      payload: { declaration, change_reason: "Must not write" },
    }),
  );
  await app.close();

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), { ok: false, error: "AUTH_POLICY_PRINCIPAL_DENIED" });
  assert.equal(calls.length, 0);
});

test("agronomist without capability is denied before database access", async () => {
  const { pool, calls } = fakePool();
  const app = Fastify();
  registerDecisionEligibilityPolicyDeclarationV1Routes(app, pool);
  const response = await withTokens(
    tokenJson("agronomist", ["recommendation.write"]),
    () => app.inject({
      method: "POST",
      url: DECISION_ELIGIBILITY_POLICY_DECLARATION_POST_PATH_V1,
      headers: { authorization: "Bearer route-secret" },
      payload: { declaration, change_reason: "Must not write" },
    }),
  );
  await app.close();

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), { ok: false, error: "AUTH_SCOPE_DENIED" });
  assert.equal(calls.length, 0);
});

test("route rejects body fields outside declaration + change_reason", async () => {
  const { pool, calls } = fakePool();
  const app = Fastify();
  registerDecisionEligibilityPolicyDeclarationV1Routes(app, pool);
  const response = await withTokens(
    tokenJson("agronomist", ["decision.eligibility.policy.declare"]),
    () => app.inject({
      method: "POST",
      url: DECISION_ELIGIBILITY_POLICY_DECLARATION_POST_PATH_V1,
      headers: { authorization: "Bearer route-secret" },
      payload: { declaration, change_reason: "x", authority_state: "FORGED" },
    }),
  );
  await app.close();

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { ok: false, error: "INVALID_BODY" });
  assert.equal(calls.length, 0);
});
