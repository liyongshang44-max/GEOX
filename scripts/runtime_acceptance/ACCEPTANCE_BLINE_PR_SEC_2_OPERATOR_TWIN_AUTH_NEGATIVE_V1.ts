import assert from "node:assert/strict";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerOperatorTwinWriteLegacyRoutesV1 } from "../../apps/server/src/routes/v1/operator_twin_write_legacy_v1.js";

const TOKENS = {
  version: "ao_act_tokens_v0",
  tokens: [
    {
      token: "valid_admin",
      token_id: "tok_valid_admin",
      actor_id: "actor_valid",
      tenant_id: "tenant_auth",
      project_id: "project_auth",
      group_id: "group_auth",
      role: "admin",
      scopes: ["recommendation.write"],
      allowed_field_ids: [],
      revoked: false,
    },
    {
      token: "revoked_admin",
      token_id: "tok_revoked_admin",
      actor_id: "actor_revoked",
      tenant_id: "tenant_auth",
      project_id: "project_auth",
      group_id: "group_auth",
      role: "admin",
      scopes: ["recommendation.write"],
      allowed_field_ids: [],
      revoked: true,
    },
    {
      token: "no_scope_admin",
      token_id: "tok_no_scope",
      actor_id: "actor_no_scope",
      tenant_id: "tenant_auth",
      project_id: "project_auth",
      group_id: "group_auth",
      role: "admin",
      scopes: [],
      allowed_field_ids: [],
      revoked: false,
    },
    {
      token: "operator_with_scope",
      token_id: "tok_operator_scope",
      actor_id: "actor_operator",
      tenant_id: "tenant_auth",
      project_id: "project_auth",
      group_id: "group_auth",
      role: "operator",
      scopes: ["recommendation.write"],
      allowed_field_ids: [],
      revoked: false,
    },
    {
      token: "field_scoped_agronomist",
      token_id: "tok_field_scoped",
      actor_id: "actor_field",
      tenant_id: "tenant_auth",
      project_id: "project_auth",
      group_id: "group_auth",
      role: "agronomist",
      scopes: ["recommendation.write"],
      allowed_field_ids: ["field_allowed"],
      revoked: false,
    },
  ],
};

const routeBuilders = [
  (fieldId: string) => `/api/v1/operator/twin/fields/${fieldId}/root-zone-scenarios/scenario_1/options/option_1/submit-recommendation`,
  (fieldId: string) => `/api/v1/operator/twin/fields/${fieldId}/scenarios/scenario_1/options/option_1/submit-recommendation`,
];

type Case = {
  name: string;
  token?: string;
  fieldId?: string;
  body?: Record<string, unknown>;
  status: number;
  error: string;
};

const baseBody = {
  tenant_id: "tenant_auth",
  project_id: "project_auth",
  group_id: "group_auth",
  operator_id: "actor_valid",
};

const cases: Case[] = [
  { name: "missing bearer", status: 401, error: "AUTH_MISSING" },
  { name: "invalid bearer", token: "not_a_token", status: 401, error: "AUTH_INVALID" },
  { name: "revoked bearer", token: "revoked_admin", status: 403, error: "AUTH_REVOKED" },
  { name: "token missing recommendation.write", token: "no_scope_admin", status: 403, error: "AUTH_SCOPE_DENIED" },
  { name: "role not admitted for recommendation.write", token: "operator_with_scope", status: 403, error: "AUTH_ROLE_SCOPE_DENIED" },
  { name: "tenant mismatch", token: "valid_admin", body: { tenant_id: "tenant_other" }, status: 403, error: "AUTH_TENANT_SCOPE_MISMATCH" },
  { name: "project mismatch", token: "valid_admin", body: { project_id: "project_other" }, status: 403, error: "AUTH_TENANT_SCOPE_MISMATCH" },
  { name: "group mismatch", token: "valid_admin", body: { group_id: "group_other" }, status: 403, error: "AUTH_TENANT_SCOPE_MISMATCH" },
  { name: "field mismatch", token: "field_scoped_agronomist", fieldId: "field_denied", body: { operator_id: "actor_field" }, status: 403, error: "AUTH_FIELD_SCOPE_DENIED" },
  { name: "declared actor mismatch", token: "valid_admin", body: { operator_id: "actor_other" }, status: 403, error: "AUTH_DECLARED_ACTOR_MISMATCH" },
];

async function main(): Promise<void> {
  const originalTokens = process.env.GEOX_TOKENS_JSON;
  const originalRuntimeEnv = process.env.GEOX_RUNTIME_ENV;
  process.env.GEOX_TOKENS_JSON = JSON.stringify(TOKENS);
  process.env.GEOX_RUNTIME_ENV = "development";

  let downstreamQueries = 0;
  const trapPool = {
    async query(): Promise<never> {
      downstreamQueries += 1;
      throw new Error("PR_SEC_2_NEGATIVE_PROOF_DOWNSTREAM_REACHED");
    },
  } as unknown as Pool;

  const app = Fastify();
  registerOperatorTwinWriteLegacyRoutesV1(app, trapPool);
  await app.ready();

  try {
    for (const buildRoute of routeBuilders) {
      for (const c of cases) {
        downstreamQueries = 0;
        const body = { ...baseBody, ...(c.body ?? {}) };
        const headers = c.token
          ? { authorization: `Bearer ${c.token}`, "content-type": "application/json" }
          : { "content-type": "application/json" };
        const response = await app.inject({
          method: "POST",
          url: buildRoute(c.fieldId ?? "field_any"),
          headers,
          payload: body,
        });
        const payload = response.json() as { error?: string };

        assert.equal(response.statusCode, c.status, `${c.name}: status`);
        assert.equal(payload.error, c.error, `${c.name}: error`);
        assert.equal(downstreamQueries, 0, `${c.name}: downstream writer must remain unreachable`);
      }
    }

    console.log(JSON.stringify({
      result: "PASS",
      routes: routeBuilders.length,
      negative_cases_per_route: cases.length,
      total_negative_requests: routeBuilders.length * cases.length,
      downstream_query_count: 0,
    }, null, 2));
  } finally {
    await app.close();
    if (originalTokens == null) delete process.env.GEOX_TOKENS_JSON;
    else process.env.GEOX_TOKENS_JSON = originalTokens;
    if (originalRuntimeEnv == null) delete process.env.GEOX_RUNTIME_ENV;
    else process.env.GEOX_RUNTIME_ENV = originalRuntimeEnv;
  }
}

main().catch((error) => {
  console.error("[BLINE_PR_SEC_2_OPERATOR_TWIN_AUTH_NEGATIVE] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
