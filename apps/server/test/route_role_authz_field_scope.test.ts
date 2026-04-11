import test from "node:test";
import assert from "node:assert/strict";
import type { AoActAuthContextV0 } from "../src/auth/ao_act_authz_v0";
import { enforceFieldScopeOrDeny, enforceOperationFieldScope, hasFieldAccess } from "../src/auth/route_role_authz";

function mkAuth(role: AoActAuthContextV0["role"], allowed_field_ids: string[]): AoActAuthContextV0 {
  return {
    actor_id: "actor",
    token_id: "token",
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    role,
    scopes: ["ao_act.index.read"],
    allowed_field_ids,
  };
}

function mkReply() {
  const state: { code: number | null; body: any } = { code: null, body: null };
  const reply = {
    status(code: number) {
      state.code = code;
      return this;
    },
    send(body: any) {
      state.body = body;
      return this;
    },
  } as any;
  return { reply, state };
}

test("client operation report access is denied as 404 when operation resolves to unauthorized field", async () => {
  const auth = mkAuth("client", ["field_allowed"]);
  const { reply, state } = mkReply();
  const scopedField = await enforceOperationFieldScope(
    auth,
    "op_1",
    reply,
    async (operationId) => operationId === "op_1" ? "field_denied" : null,
    { asNotFound: true }
  );

  assert.equal(scopedField, null);
  assert.equal(state.code, 404);
  assert.deepEqual(state.body, { ok: false, error: "NOT_FOUND" });
});

test("client operation report access succeeds when operation resolves to authorized field", async () => {
  const auth = mkAuth("client", ["field_allowed"]);
  const { reply, state } = mkReply();
  const scopedField = await enforceOperationFieldScope(
    auth,
    "op_2",
    reply,
    async () => "field_allowed",
    { asNotFound: true }
  );

  assert.equal(scopedField, "field_allowed");
  assert.equal(state.code, null);
  assert.equal(state.body, null);
});

test("viewer/operator/admin enforce allowlist deny and allow paths", () => {
  for (const role of ["viewer", "operator", "admin"] as const) {
    const scopedAuth = mkAuth(role, ["field_x"]);
    const freeAuth = mkAuth(role, []);

    assert.equal(hasFieldAccess(scopedAuth, "field_x"), true);
    assert.equal(hasFieldAccess(scopedAuth, "field_y"), false);
    assert.equal(hasFieldAccess(freeAuth, "field_y"), true);

    const denyReply = mkReply();
    assert.equal(enforceFieldScopeOrDeny(scopedAuth, "field_y", denyReply.reply, { asNotFound: false }), false);
    assert.equal(denyReply.state.code, 403);
    assert.deepEqual(denyReply.state.body, { ok: false, error: "AUTH_FIELD_SCOPE_DENIED" });

    const passReply = mkReply();
    assert.equal(enforceFieldScopeOrDeny(scopedAuth, "field_x", passReply.reply, { asNotFound: true }), true);
    assert.equal(passReply.state.code, null);
  }
});
