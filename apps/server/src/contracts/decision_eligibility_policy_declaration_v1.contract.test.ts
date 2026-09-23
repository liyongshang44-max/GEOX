import assert from "node:assert/strict";
import test from "node:test";

import { decisionEligibilityPolicyDeclarationV1Schema } from "./decision_eligibility_policy_declaration_v1.js";

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "decision_eligibility_policy_declaration_v1",
    declaration_id: "decision_eligibility_policy_declaration_v1:fixture-policy:v7",
    policy_id: "fixture-policy",
    policy_version: "v7",
    policy_ref: "decision_eligibility_policy_v1:fixture-policy:v7",
    scope: {
      decision_scope: {
        tenant_id: "tenantA",
        project_id: "projectA",
        group_id: "groupA",
        field_id: "fieldA",
        season_id: "seasonA",
        zone_id: null,
      },
      scope_anchor_type: "TEST_ONLY_EXPLICIT_SOURCE",
      scope_anchor_ref: "test-only:policy-source:1",
    },
    applicable_action_types: ["CUSTOM_ACTION_ALPHA"],
    required_criteria: ["CONSEQUENCE"],
    lifecycle_semantics: "B07D_LIFECYCLE_STATE_V1",
    declaration_source_type: "TEST_ONLY_POLICY_DECLARATION",
    declaration_source_ref: "test-only:declaration:1",
    provenance_refs: ["test-only:provenance:1"],
    declared_at: "2026-08-28T12:00:00.000Z",
    effective_from: "2026-08-28T12:00:00.000Z",
    effective_until: null,
    supersedes_policy_ref: null,
    limitations: ["TEST_FIXTURE_IS_NOT_PRODUCT_POLICY"],
    authority_state: "POLICY_DECLARATION_ONLY",
    ...overrides,
  };
}

test("B-09m freezes a versioned policy declaration without choosing product criteria", () => {
  const parsed = decisionEligibilityPolicyDeclarationV1Schema.parse(fixture());
  assert.equal(parsed.policy_ref, "decision_eligibility_policy_v1:fixture-policy:v7");
  assert.deepEqual(parsed.applicable_action_types, ["CUSTOM_ACTION_ALPHA"]);
  assert.deepEqual(parsed.required_criteria, ["CONSEQUENCE"]);
  assert.equal(parsed.authority_state, "POLICY_DECLARATION_ONLY");
});

test("B-09m action vocabulary stays open and does not create an IRRIGATE-only enum", () => {
  const parsed = decisionEligibilityPolicyDeclarationV1Schema.parse(
    fixture({ applicable_action_types: ["CUSTOM_ACTION_X9", "another.action"] }),
  );
  assert.deepEqual(parsed.applicable_action_types, ["CUSTOM_ACTION_X9", "another.action"]);
});

test("B-09m requires explicit nonempty action applicability and criteria", () => {
  assert.equal(
    decisionEligibilityPolicyDeclarationV1Schema.safeParse(
      fixture({ applicable_action_types: [] }),
    ).success,
    false,
  );
  assert.equal(
    decisionEligibilityPolicyDeclarationV1Schema.safeParse(
      fixture({ required_criteria: [] }),
    ).success,
    false,
  );
});

test("B-09m rejects duplicate or non-canonically-trimmed action types", () => {
  assert.equal(
    decisionEligibilityPolicyDeclarationV1Schema.safeParse(
      fixture({ applicable_action_types: ["A", "A"] }),
    ).success,
    false,
  );
  assert.equal(
    decisionEligibilityPolicyDeclarationV1Schema.safeParse(
      fixture({ applicable_action_types: [" A"] }),
    ).success,
    false,
  );
});

test("B-09m rejects duplicate required criteria", () => {
  assert.equal(
    decisionEligibilityPolicyDeclarationV1Schema.safeParse(
      fixture({ required_criteria: ["CONTEXT", "CONTEXT"] }),
    ).success,
    false,
  );
});

test("B-09m policy_ref and declaration_id must identify the declared version", () => {
  assert.equal(
    decisionEligibilityPolicyDeclarationV1Schema.safeParse(
      fixture({ policy_ref: "decision_eligibility_policy_v1:fixture-policy:v8" }),
    ).success,
    false,
  );
  assert.equal(
    decisionEligibilityPolicyDeclarationV1Schema.safeParse(
      fixture({ declaration_id: "decision_eligibility_policy_declaration_v1:fixture-policy:v8" }),
    ).success,
    false,
  );
});

test("B-09m requires explicit tenant/project/group scope provenance", () => {
  assert.equal(
    decisionEligibilityPolicyDeclarationV1Schema.safeParse(
      fixture({
        scope: {
          decision_scope: {
            tenant_id: "tenantA",
            project_id: null,
            group_id: "groupA",
            field_id: "fieldA",
            season_id: "seasonA",
            zone_id: null,
          },
          scope_anchor_type: "TEST_ONLY_EXPLICIT_SOURCE",
          scope_anchor_ref: "test-only:policy-source:1",
        },
      }),
    ).success,
    false,
  );
});

test("B-09m declaration effective window cannot predate declaration or invert", () => {
  assert.equal(
    decisionEligibilityPolicyDeclarationV1Schema.safeParse(
      fixture({
        declared_at: "2026-08-28T12:00:00.000Z",
        effective_from: "2026-08-28T11:59:59.000Z",
      }),
    ).success,
    false,
  );
  assert.equal(
    decisionEligibilityPolicyDeclarationV1Schema.safeParse(
      fixture({
        effective_from: "2026-08-28T12:00:00.000Z",
        effective_until: "2026-08-28T12:00:00.000Z",
      }),
    ).success,
    false,
  );
});

test("B-09m lifecycle tag does not create an ACTION_WINDOW criterion default", () => {
  const parsed = decisionEligibilityPolicyDeclarationV1Schema.parse(fixture());
  assert.equal(parsed.lifecycle_semantics, "B07D_LIFECYCLE_STATE_V1");
  assert.equal(parsed.required_criteria.includes("ACTION_WINDOW"), false);
});

test("B-09m policy declaration carries no verdict, approval or execution authority", () => {
  const parsed = decisionEligibilityPolicyDeclarationV1Schema.parse(fixture());
  const serialized = JSON.stringify(parsed);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, "verdict"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, "eligibility_id"), false);
  assert.equal(serialized.includes("APPROVED"), false);
  assert.equal(serialized.includes("EXECUTE"), false);
});
