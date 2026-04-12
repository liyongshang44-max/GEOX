import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerAlertWorkflowV1Routes } from "../src/routes/alert_workflow_v1";
import type { AoActAuthContextV0 } from "../src/auth/ao_act_authz_v0";

type Role = AoActAuthContextV0["role"];

function mkAuth(role: Role, allowed_field_ids: string[]): AoActAuthContextV0 {
  return {
    actor_id: `actor_${role}`,
    token_id: `token_${role}`,
    tenant_id: "tenant_a",
    project_id: "project_a",
    group_id: "group_a",
    role,
    scopes: ["alerts.read", "alerts.write"],
    allowed_field_ids,
  };
}

function buildPoolStub() {
  let status = "OPEN";
  let version = 0;
  return {
    query: async () => ({ rows: [] as any[], rowCount: 0 }),
    connect: async () => ({
      query: async (sql: string) => {
        if (sql.includes("SELECT status, version FROM alert_workflow_v1")) {
          return { rows: [{ status, version }], rowCount: 1 };
        }
        if (sql.includes("UPDATE alert_workflow_v1")) {
          status = "ASSIGNED";
          version += 1;
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes("INSERT INTO alert_workflow_v1")) {
          status = "ASSIGNED";
          version = 0;
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    }),
  } as any;
}

test("alert workflow v1 route: GET allows client/viewer/operator/admin, denies non-matrix role", async () => {
  const app = Fastify();
  const pool = buildPoolStub();
  registerAlertWorkflowV1Routes(app, pool);

  app.decorate("alertWorkflowRequireScopeV0", (req: any) => {
    const role = String(req.headers["x-role"] ?? "").trim() as Role;
    if (!role) return null;
    return mkAuth(role, ["field_in"]);
  });
  app.decorate("alertWorkflowProjectWorkboardItems", async (_auth: AoActAuthContextV0) => ([
    { alert_id: "a1", severity: "HIGH", triggered_at: new Date().toISOString() },
  ]));

  for (const role of ["client", "viewer", "operator", "admin"] as const) {
    const res = await app.inject({ method: "GET", url: "/api/v1/alerts/workboard", headers: { "x-role": role } });
    assert.equal(res.statusCode, 200, `role=${role}`);
  }

  const denied = await app.inject({ method: "GET", url: "/api/v1/alerts/workboard", headers: { "x-role": "executor" } });
  assert.equal(denied.statusCode, 403);
  assert.deepEqual(denied.json(), { ok: false, error: "AUTH_ROLE_DENIED" });

  await app.close();
});

test("alert workflow v1 route: POST assign enforces field scope as 404 and role rejection on in-scope", async () => {
  const app = Fastify();
  const pool = buildPoolStub();
  registerAlertWorkflowV1Routes(app, pool);

  app.decorate("alertWorkflowRequireScopeV0", (req: any) => {
    const role = String(req.headers["x-role"] ?? "").trim() as Role;
    const allowed = String(req.headers["x-allowed"] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    if (!role) return null;
    return mkAuth(role, allowed);
  });

  app.decorate("alertWorkflowResolveAlertFieldId", async (_auth: AoActAuthContextV0, alertId: string) => {
    if (alertId === "alert_field_in") return "field_in";
    if (alertId === "alert_field_out") return "field_out";
    return null;
  });

  app.decorate("alertWorkflowProjectWorkboardItems", async (_auth: AoActAuthContextV0, filter: any) => {
    const targetId = String(filter?.object_id ?? "").trim();
    if (targetId === "alert_field_in") {
      return [{ alert_id: "alert_field_in", severity: "HIGH", triggered_at: new Date().toISOString() }];
    }
    return [];
  });

  const deniedByScope = await app.inject({
    method: "POST",
    url: "/api/v1/alerts/alert_field_out/assign",
    headers: { "x-role": "operator", "x-allowed": "field_in" },
    payload: {},
  });
  assert.equal(deniedByScope.statusCode, 404);
  assert.deepEqual(deniedByScope.json(), { ok: false, error: "NOT_FOUND" });

  const deniedByRole = await app.inject({
    method: "POST",
    url: "/api/v1/alerts/alert_field_in/assign",
    headers: { "x-role": "viewer", "x-allowed": "field_in" },
    payload: {},
  });
  assert.equal(deniedByRole.statusCode, 403);
  assert.deepEqual(deniedByRole.json(), { ok: false, error: "AUTH_ROLE_DENIED" });

  const operatorOk = await app.inject({
    method: "POST",
    url: "/api/v1/alerts/alert_field_in/assign",
    headers: { "x-role": "operator", "x-allowed": "field_in" },
    payload: { assignee_actor_id: "op_1", assignee_name: "Operator A" },
  });
  assert.equal(operatorOk.statusCode, 200);
  assert.equal(operatorOk.json().ok, true);

  const adminOk = await app.inject({
    method: "POST",
    url: "/api/v1/alerts/alert_field_in/assign",
    headers: { "x-role": "admin", "x-allowed": "field_in" },
    payload: { assignee_actor_id: "admin_1", assignee_name: "Admin A" },
  });
  assert.equal(adminOk.statusCode, 200);
  assert.equal(adminOk.json().ok, true);

  await app.close();
});
