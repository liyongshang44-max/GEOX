import test from "node:test";
import assert from "node:assert/strict";

import type { AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import {
  appendDecisionEligibilityPolicyDeclarationFactV1,
  DecisionEligibilityPolicyDeclarationWriteErrorV1,
  type DecisionEligibilityPolicyDeclarationWriteInputV1,
} from "./decision_eligibility_policy_declaration_fact_v1.js";

const AUTH: AoActAuthContextV0 = {
  actor_id: "agronomist_actor_test",
  token_id: "agronomist_token_test",
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  role: "agronomist",
  scopes: ["decision.eligibility.policy.declare"],
  allowed_field_ids: [],
};

const INPUT: DecisionEligibilityPolicyDeclarationWriteInputV1 = {
  policy_id: "synthetic_policy_alpha",
  policy_version: "v1",
  scope: {
    decision_scope: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "fieldA",
      season_id: "seasonA",
    },
    scope_anchor_type: "PROGRAM",
    scope_anchor_ref: "program_test_only",
  },
  applicable_action_types: ["CUSTOM_ACTION_ALPHA"],
  required_criteria: ["CONSEQUENCE"],
  lifecycle_semantics: "B07D_LIFECYCLE_STATE_V1",
  provenance_refs: ["test-only:synthetic-provenance"],
  effective_from: "2099-01-01T00:00:00.000Z",
  effective_until: null,
  supersedes_policy_ref: null,
  limitations: ["TEST_ONLY_SYNTHETIC_POLICY_CONTENT"],
};

function fakePool(existingRows: any[] = []) {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const client = {
    async query(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      if (sql.includes("SELECT fact_id, occurred_at, record_json")) return { rows: existingRows };
      return { rows: [] };
    },
    release() {
      calls.push({ sql: "RELEASE" });
    },
  };
  return {
    pool: { async connect() { return client; } } as any,
    calls,
  };
}

test("new declaration derives authority/source/identity and appends one audited fact", async () => {
  const { pool, calls } = fakePool();
  const result = await appendDecisionEligibilityPolicyDeclarationFactV1(
    pool,
    AUTH,
    INPUT,
    "Initial synthetic test declaration",
    { now: () => "2098-12-01T00:00:00.000Z" },
  );

  assert.equal(result.created, true);
  assert.equal(result.declaration.policy_ref, "decision_eligibility_policy_v1:synthetic_policy_alpha:v1");
  assert.equal(result.declaration.declaration_id, "decision_eligibility_policy_declaration_v1:synthetic_policy_alpha:v1");
  assert.equal(result.declaration.authority_state, "POLICY_DECLARATION_ONLY");
  assert.equal(result.declaration.declaration_source_type, "AUTHORIZED_HUMAN_API");
  assert.equal(result.declaration.declaration_source_ref, "actor:agronomist_actor_test");
  assert.equal(result.declaration.declared_at, "2098-12-01T00:00:00.000Z");

  const insert = calls.find((call) => call.sql.startsWith("INSERT INTO facts"));
  assert.ok(insert);
  const record = insert?.params?.[3] as any;
  assert.equal(record.type, "decision_eligibility_policy_declaration_v1");
  assert.equal(record.audit.changed_by_actor_id, "agronomist_actor_test");
  assert.equal(record.audit.changed_by_token_id, "agronomist_token_test");
  assert.equal(record.audit.change_reason, "Initial synthetic test declaration");
  assert.equal(record.audit.written_at, "2098-12-01T00:00:00.000Z");
  assert.equal(calls.some((call) => /UPDATE|DELETE/i.test(call.sql)), false);
});

test("same immutable policy_ref and stable declaration intent is idempotent", async () => {
  const first = fakePool();
  const created = await appendDecisionEligibilityPolicyDeclarationFactV1(
    first.pool,
    AUTH,
    INPUT,
    "first write",
    { now: () => "2098-12-01T00:00:00.000Z" },
  );
  const existingRecord = {
    fact_id: created.fact_id,
    occurred_at: created.occurred_at,
    record_json: {
      type: "decision_eligibility_policy_declaration_v1",
      payload: created.declaration,
      audit: {},
    },
  };

  const retry = fakePool([existingRecord]);
  const result = await appendDecisionEligibilityPolicyDeclarationFactV1(
    retry.pool,
    AUTH,
    INPUT,
    "retry may have a different transport reason",
    { now: () => "2100-01-01T00:00:00.000Z" },
  );

  assert.equal(result.created, false);
  assert.equal(result.fact_id, created.fact_id);
  assert.equal(retry.calls.some((call) => call.sql.startsWith("INSERT INTO facts")), false);
});

test("same policy_ref with changed declaration content fails closed", async () => {
  const seed = fakePool();
  const created = await appendDecisionEligibilityPolicyDeclarationFactV1(
    seed.pool,
    AUTH,
    INPUT,
    "seed",
    { now: () => "2098-12-01T00:00:00.000Z" },
  );
  const existing = [{
    fact_id: created.fact_id,
    occurred_at: created.occurred_at,
    record_json: { type: "decision_eligibility_policy_declaration_v1", payload: created.declaration },
  }];

  const conflict = fakePool(existing);
  await assert.rejects(
    () => appendDecisionEligibilityPolicyDeclarationFactV1(
      conflict.pool,
      AUTH,
      { ...INPUT, limitations: ["DIFFERENT_CONTENT"] },
      "conflicting rewrite",
      { now: () => "2098-12-02T00:00:00.000Z" },
    ),
    (error: any) =>
      error instanceof DecisionEligibilityPolicyDeclarationWriteErrorV1
      && error.code === "POLICY_REF_CONFLICT",
  );
  assert.equal(conflict.calls.some((call) => call.sql.startsWith("INSERT INTO facts")), false);
});

test("multiple existing facts for one policy_ref fail closed as ambiguous", async () => {
  const duplicate = {
    fact_id: "factA",
    occurred_at: "2098-12-01T00:00:00.000Z",
    record_json: {
      type: "decision_eligibility_policy_declaration_v1",
      payload: {
        schema_version: "decision_eligibility_policy_declaration_v1",
        declaration_id: "decision_eligibility_policy_declaration_v1:synthetic_policy_alpha:v1",
        policy_id: "synthetic_policy_alpha",
        policy_version: "v1",
        policy_ref: "decision_eligibility_policy_v1:synthetic_policy_alpha:v1",
        scope: INPUT.scope,
        applicable_action_types: INPUT.applicable_action_types,
        required_criteria: INPUT.required_criteria,
        lifecycle_semantics: INPUT.lifecycle_semantics,
        declaration_source_type: "AUTHORIZED_HUMAN_API",
        declaration_source_ref: "actor:agronomist_actor_test",
        provenance_refs: INPUT.provenance_refs,
        declared_at: "2098-12-01T00:00:00.000Z",
        effective_from: INPUT.effective_from,
        effective_until: null,
        supersedes_policy_ref: null,
        limitations: INPUT.limitations,
        authority_state: "POLICY_DECLARATION_ONLY",
      },
    },
  };
  const { pool } = fakePool([duplicate, { ...duplicate, fact_id: "factB" }]);

  await assert.rejects(
    () => appendDecisionEligibilityPolicyDeclarationFactV1(pool, AUTH, INPUT, "write"),
    (error: any) =>
      error instanceof DecisionEligibilityPolicyDeclarationWriteErrorV1
      && error.code === "POLICY_REF_AMBIGUOUS",
  );
});

test("decision scope must match authenticated tenant/project/group", async () => {
  const { pool } = fakePool();
  await assert.rejects(
    () => appendDecisionEligibilityPolicyDeclarationFactV1(
      pool,
      AUTH,
      {
        ...INPUT,
        scope: {
          ...INPUT.scope,
          decision_scope: { ...INPUT.scope.decision_scope, tenant_id: "otherTenant" },
        },
      },
      "scope mismatch",
    ),
    (error: any) =>
      error instanceof DecisionEligibilityPolicyDeclarationWriteErrorV1
      && error.code === "POLICY_SCOPE_AUTH_MISMATCH",
  );
});

test("new declaration cannot become effective before server persistence time", async () => {
  const { pool } = fakePool();
  await assert.rejects(
    () => appendDecisionEligibilityPolicyDeclarationFactV1(
      pool,
      AUTH,
      { ...INPUT, effective_from: "2098-01-01T00:00:00.000Z" },
      "retroactive attempt",
      { now: () => "2098-12-01T00:00:00.000Z" },
    ),
    (error: any) =>
      error instanceof DecisionEligibilityPolicyDeclarationWriteErrorV1
      && error.code === "POLICY_DECLARATION_INVALID",
  );
});

test("caller cannot inject authority/source/identity fields into write input", async () => {
  const { pool } = fakePool();
  await assert.rejects(
    () => appendDecisionEligibilityPolicyDeclarationFactV1(
      pool,
      AUTH,
      { ...(INPUT as any), authority_state: "SOMETHING_ELSE" },
      "attempted injection",
    ),
    (error: any) =>
      error instanceof DecisionEligibilityPolicyDeclarationWriteErrorV1
      && error.code === "POLICY_DECLARATION_INVALID",
  );
});
