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

function req(): any { return { headers: { authorization: "Bearer tok-secret" } }; }
function reply(): any {
  return {
    statusCode: 200,
    body: null,
    status(code: number) { this.statusCode = code; return this; },
    send(body: unknown) { this.body = body; return this; },
  };
}

test("dedicated policy declaration capability is frozen", () => {
  assert.equal(DECISION_ELIGIBILITY_POLICY_DECLARATION_SCOPE_V1, "decision.eligibility.policy.declare");
});

test("human policy-author set is agronomist only", () => {
  assert.equal(isDecisionEligibilityPolicyDeclarationHumanAuthorRoleV1("agronomist"), true);
  for (const role of ["admin","operator","viewer","client","executor","approver","auditor","support"] as const) {
    assert.equal(isDecisionEligibilityPolicyDeclarationHumanAuthorRoleV1(role), false);
  }
});

test("agronomist with explicit capability passes", () => {
  const fp=writeTokenFile("agronomist",[DECISION_ELIGIBILITY_POLICY_DECLARATION_SCOPE_V1]);
  const rep=reply();
  const auth=requireDecisionEligibilityPolicyDeclarationAuthorityV1(req(),rep,{tokenFilePath:fp});
  assert.ok(auth);
  assert.equal(auth.role,"agronomist");
  assert.equal(auth.actor_id,"actor_b09r_test");
  assert.equal(auth.token_id,"tok_b09r_test");
  assert.equal(rep.statusCode,200);
});

test("admin with explicit capability remains denied", () => {
  const fp=writeTokenFile("admin",[DECISION_ELIGIBILITY_POLICY_DECLARATION_SCOPE_V1]);
  const rep=reply();
  const auth=requireDecisionEligibilityPolicyDeclarationAuthorityV1(req(),rep,{tokenFilePath:fp});
  assert.equal(auth,null);
  assert.equal(rep.statusCode,403);
  assert.deepEqual(rep.body,{ok:false,error:"AUTH_POLICY_PRINCIPAL_DENIED"});
});

test("agronomist without capability remains denied", () => {
  const fp=writeTokenFile("agronomist",["recommendation.write"]);
  const rep=reply();
  const auth=requireDecisionEligibilityPolicyDeclarationAuthorityV1(req(),rep,{tokenFilePath:fp});
  assert.equal(auth,null);
  assert.deepEqual(rep.body,{ok:false,error:"AUTH_SCOPE_DENIED"});
});

test("non-author role with capability remains denied", () => {
  const fp=writeTokenFile("approver",[DECISION_ELIGIBILITY_POLICY_DECLARATION_SCOPE_V1]);
  const rep=reply();
  const auth=requireDecisionEligibilityPolicyDeclarationAuthorityV1(req(),rep,{tokenFilePath:fp});
  assert.equal(auth,null);
  assert.deepEqual(rep.body,{ok:false,error:"AUTH_POLICY_PRINCIPAL_DENIED"});
});
