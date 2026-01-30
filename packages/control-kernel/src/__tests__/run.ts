// Minimal test runner for @geox/control-kernel.
//
// This repository does not currently use Jest/Mocha; we use a small
// ts-node executed script that throws on failures.

import assert from "node:assert";

import { evaluateControlV0 } from "../kernel";
import type { ControlRuleSetV0 } from "../ruleset/types";

import "./no_ruleset_loader";// 负向验收：禁止 runtime ruleset loader

// Helper: expect a function to throw and match an error substring.
function expectThrows(fn: () => void, contains: string): void {
  // Track if we observed a throw.
  let threw = false;
  try {
    fn();
  } catch (err: any) {
    threw = true;
    const msg = String(err?.message ?? err);
    assert.ok(msg.includes(contains), `expected error containing "${contains}", got "${msg}"`);
  }

  // If nothing thrown, fail the test.
  assert.ok(threw, `expected throw containing "${contains}", but no error was thrown`);
}

// --- Fixture inputs (minimal shapes) ---
const problemState = {
  subjectRef: { projectId: "p1" },
  window: { startTs: 1000, endTs: 2000 },
  problem_type: "SOME_PROBLEM"
};

const uncertaintyEnvelope = {
  problem_state_ref: "ps_001",
  uncertainty_sources: ["SENSOR_GAP"]
};

const permissionSet = {
  subjectRef: { projectId: "p1" },
  window: { startTs: 1000, endTs: 2000 },
  candidate_actions: [{ action_code: "AO-SENSE" }]
};

// --- Happy-path minimal ruleset ---
const okRuleSet: ControlRuleSetV0 = {
  type: "control_ruleset_v0",
  schema_version: "0.1.0",
  ruleset_id: "rs_ao_sense",
  action_code: "AO-SENSE",
  combine_strategy: "DENY_OVERRIDES",
  default_verdict: "UNDETERMINED",
  inputs_used: [
    "problem_state.window.startTs",
    "problem_state.window.endTs",
    "permission_set.window.startTs",
    "permission_set.window.endTs"
  ],
  allowed_template_ids: ["WINDOW_MATCH"],
  rules: [
    {
      rule_id: "r1",
      rule_version: "0.1.0",
      template: { template_id: "WINDOW_MATCH" },
      verdict: "ALLOW"
    }
  ]
};

// Kernel should produce exactly one verdict.
const verdicts = evaluateControlV0(problemState, uncertaintyEnvelope, permissionSet, [okRuleSet]);
assert.equal(verdicts.length, 1);
assert.equal(verdicts[0].action_code, "AO-SENSE");
assert.equal(verdicts[0].verdict, "ALLOW");

// --- Negative: action_code not in taxonomy ---
const badTaxonomyRuleSet: ControlRuleSetV0 = {
  ...okRuleSet,
  action_code: "AO-UNKNOWN"
};
expectThrows(
  () => evaluateControlV0(problemState, uncertaintyEnvelope, permissionSet, [badTaxonomyRuleSet]),
  "AO_ACTION_CODE_NOT_ALLOWED"
);

// --- Negative: action_code not in permission_set.candidate_actions ---
const badPermissionRuleSet: ControlRuleSetV0 = {
  ...okRuleSet,
  action_code: "AO-ENTER"
};
expectThrows(
  () => evaluateControlV0(problemState, uncertaintyEnvelope, permissionSet, [badPermissionRuleSet]),
  "ACTION_CODE_NOT_IN_PERMISSION_SET"
);

// --- Negative: rule references a field path that is not declared in inputs_used ---
const badInputsUsedRuleSet: ControlRuleSetV0 = {
  ...okRuleSet,
  allowed_template_ids: ["FIELD_EQ"],
  inputs_used: [],
  rules: [
    {
      rule_id: "r2",
      rule_version: "0.1.0",
      template: { template_id: "FIELD_EQ", field_path: "problem_state.problem_type", value: "SOME_PROBLEM" },
      verdict: "ALLOW"
    }
  ]
};
expectThrows(
  () => evaluateControlV0(problemState, uncertaintyEnvelope, permissionSet, [badInputsUsedRuleSet]),
  "INPUT_PATH_NOT_DECLARED_IN_INPUTS_USED"
);

// --- Negative: template id not allowed by ruleset.allowed_template_ids ---
const badTemplateAllowlistRuleSet: ControlRuleSetV0 = {
  ...okRuleSet,
  allowed_template_ids: [],
  inputs_used: ["problem_state.problem_type"],
  rules: [
    {
      rule_id: "r3",
      rule_version: "0.1.0",
      template: { template_id: "FIELD_EQ", field_path: "problem_state.problem_type", value: "SOME_PROBLEM" },
      verdict: "ALLOW"
    }
  ]
};
expectThrows(
  () => evaluateControlV0(problemState, uncertaintyEnvelope, permissionSet, [badTemplateAllowlistRuleSet]),
  "TEMPLATE_ID_NOT_ALLOWED"
);

console.log("control-kernel tests ok");
