import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DECISION_ELIGIBILITY_POLICY_DECLARATION_SCOPE_V1,
  isDecisionEligibilityPolicyDeclarationHumanAuthorRoleV1,
  requireDecisionEligibilityPolicyDeclarationAuthorityV1,
} from "./ao_act_authz_v0.js";
import { isScopeAllowedForRoleV1 } from "../domain/auth/roles.js";

function writeTokenFile(role: string, scopes: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "geox-b09r-authz-"));
  const fp = path.join(dir, "tokens.json");
  fs.writeFileSync(fp, JSON.stringify({
    version: "ao_act_tokens_v0",
    tokens: [{
      token: "tok-secret",
      token_id: "tok_b09r_test",
      actor_id: "actor_b09r_test",
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      role,
      scopes,
      revoked: false,
    }],
  }), "utf8");
  return fp;
}

function makeReq(): any {
  return { headers: { authorization: "Bearer tok-secret" } };
}

function makeReply(): any {
  const reply: any = {
    statusCode: 200,
    body: null,
    status(code: number) { this.statusCode = code; return this; },
    send(body: unknown) { this.body = body; return this; },
  };
  return reply;
}

test("B-09r freezes dedicated policy declaration scope", () => {
  assert.equal(
    DECISION_ELIGIBILITY_POLICY_DECLARATION_SCOPE_V1,
    "decision.eligibility.policy.declare"
  );
});

test("B-09r human policy author principal set is agronomist only", () => {
  assert.equal(isDecisionEligibilityPolicyDeclarationHumanAuthorRoleV1("agronomist"), true);
  for (const role of ["admin","operator","viewer","client","executor","approver","auditor","support"] as const) {
    assert.equal(isDecisionEligibilityPolicyDeclarationHumanAuthorRoleV1(role), false, role);
  }
});

test("agronomist role matrix explicitly permits dedicated declaration scope", () => {
  assert.equal(
    isScopeAllowedForRoleV1("agronomist", DECISION_ELIGIBILITY_POLICY_DECLARATION_SCOPE_V1),
    true
  );
});

test("admin generic wildcard remains technically permissive at the generic role layer", () => {
  assert.equal(
    isScopeAllowedForRoleV1("admin", DECISION_ELIGIBILITY_POLICY_DECLARATION_SCOPE_V1),
    true
  );
});

test("authorized agronomist with explicit scope passes specialized authority gate", () => {
  const fp = writeTokenFile("agronomist", [DECISION_ELIGIBILITY_POLICY_DECLARATION_SCOPE_V1]);
  const reply = makeReply();
  const auth = requireDecisionEligibilityPolicyDeclarationAuthorityV1(
    makeReq(),
    reply,
    { tokenFilePath: fp }
  );
  assert.ok(auth);
  assert.equal(auth.role, "agronomist");
  assert.equal(auth.actor_id, "actor_b09r_test");
  assert.equal(auth.token_id, "tok_b09r_test");
  assert.equal(reply.statusCode, 200);
});

test("admin with explicit dedicated scope is fail-closed by specialized product-author gate", () => {
  const fp = writeTokenFile("admin", [DECISION_ELIGIBILITY_POLICY_DECLARATION_SCOPE_V1]);
  const reply = makeReply();
  const auth = requireDecisionEligibilityPolicyDeclarationAuthorityV1(
    makeReq(),
    reply,
    { tokenFilePath: fp }
  );
  assert.equal(auth, null);
  assert.equal(reply.statusCode, 403);
  assert.deepEqual(reply.body, { ok: false, error: "AUTH_POLICY_PRINCIPAL_DENIED" });
});

test("agronomist without explicit dedicated token scope remains denied by generic scope gate", () => {
  const fp = writeTokenFile("agronomist", ["recommendation.write"]);
  const reply = makeReply();
  const auth = requireDecisionEligibilityPolicyDeclarationAuthorityV1(
    makeReq(),
    reply,
    { tokenFilePath: fp }
  );
  assert.equal(auth, null);
  assert.equal(reply.statusCode, 403);
  assert.deepEqual(reply.body, { ok: false, error: "AUTH_SCOPE_DENIED" });
});

test("non-author role with explicit scope cannot become a policy author", () => {
  const fp = writeTokenFile("approver", [DECISION_ELIGIBILITY_POLICY_DECLARATION_SCOPE_V1]);
  const reply = makeReply();
  const auth = requireDecisionEligibilityPolicyDeclarationAuthorityV1(
    makeReq(),
    reply,
    { tokenFilePath: fp }
  );
  assert.equal(auth, null);
  assert.equal(reply.statusCode, 403);
  assert.deepEqual(reply.body, { ok: false, error: "AUTH_ROLE_SCOPE_DENIED" });
});
