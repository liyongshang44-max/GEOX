// Control Kernel - RuleSet evaluator (v0)
//
// This module evaluates a ControlRuleSetV0 against a projected FieldMap.
// It enforces governance constraints:
// - action_code must be in AO Action Taxonomy v0
// - action_code must be present in PermissionSet.candidate_actions
// - templates used must be allowed by the ruleset
// - referenced input paths must be declared in inputs_used
// - referenced input paths must be in Allowed Input Paths v0

import { assertValidAoActionCodeV0 } from "../taxonomy/action_taxonomy";
import { assertAllowedInputPathV0 } from "../inputs/allowed_input_paths";
import type { FieldMap, PermissionSetLike } from "../inputs/projector";
import { evalTemplateV0, collectFieldPathsFromTemplateV0 } from "../templates/template_engine";
import type { ControlRuleSetV0, ControlVerdictV0, VerdictV0 } from "./types";
import type { TemplateExprV0, TemplateIdV0 } from "../templates/template_engine";

/**
 * Evaluates a ruleset and produces a single ControlVerdict v0.
 */
export function evaluateRuleSetV0(
  fieldMap: FieldMap,
  ruleset: ControlRuleSetV0,
  subjectRef: unknown,
  window: unknown,
  context: {
    permissionSet: PermissionSetLike;
  }
): ControlVerdictV0 {
  // Validate action_code against the constitutional taxonomy.
  assertValidAoActionCodeV0(ruleset.action_code, `ruleset:${ruleset.ruleset_id}`);

  // Validate the action_code is present in PermissionSet candidate actions.
  const candidate = context.permissionSet.candidate_actions?.map((x) => x.action_code).filter(Boolean) as
    | string[]
    | undefined;
  if (!candidate || !candidate.includes(ruleset.action_code)) {
    throw new Error(
      `ACTION_CODE_NOT_IN_PERMISSION_SET: ${ruleset.action_code} @ ruleset:${ruleset.ruleset_id}`
    );
  }

  // Validate inputs_used are canonical and allowed.
  for (const p of ruleset.inputs_used) {
    assertAllowedInputPathV0(p, `ruleset.inputs_used:${ruleset.ruleset_id}`);
  }

  // Evaluate rules using the declared combine strategy.
  const result = evaluateRulesV0(fieldMap, ruleset);

  // Build the ControlVerdict output object (only allowed fields).
  return {
    type: "control_verdict_v0",
    schema_version: "0.1.0",
    verdict_id: createDeterministicLikeId("verdict"),
    evaluated_at_ts: Date.now(),
    subjectRef,
    window,
    action_code: ruleset.action_code,
    verdict: result.verdict,
    rule_ref: result.ruleRef
  };
}

/**
 * Internal evaluation that returns the verdict and the matched rule reference.
 */
function evaluateRulesV0(
  fieldMap: FieldMap,
  ruleset: ControlRuleSetV0
): { verdict: VerdictV0; ruleRef?: { ruleset_id: string; rule_id: string; rule_version: string } } {
  // Helper: validate a rule is structurally compatible with the ruleset's allowed templates and inputs.
  const validateRule = (rule: (typeof ruleset.rules)[number]): void => {
    // Collect referenced field paths and enforce allowlist membership.
    const referencedPaths = collectFieldPathsFromTemplateV0(rule.template);

    // Enforce referenced paths are declared in inputs_used.
    for (const p of referencedPaths) {
      if (!ruleset.inputs_used.includes(p)) {
        throw new Error(`INPUT_PATH_NOT_DECLARED_IN_INPUTS_USED: ${p} @ rule:${rule.rule_id}`);
      }
    }

    // Enforce allowed_template_ids discipline: every template_id in the expression tree must be allowed.
    const usedTemplateIds = collectTemplateIds(rule.template);
    for (const tid of usedTemplateIds) {
      if (!ruleset.allowed_template_ids.includes(tid)) {
        throw new Error(`TEMPLATE_ID_NOT_ALLOWED: ${tid} @ rule:${rule.rule_id}`);
      }
    }
  };

  // Pre-validate all rules to fail fast and deterministically.
  for (const r of ruleset.rules) {
    validateRule(r);
  }

  // Evaluate according to the combination strategy.
  if (ruleset.combine_strategy === "FIRST_MATCH") {
    for (const r of ruleset.rules) {
      const matched = evalTemplateV0(fieldMap, r.template);
      if (matched) {
        return {
          verdict: r.verdict,
          ruleRef: { ruleset_id: ruleset.ruleset_id, rule_id: r.rule_id, rule_version: r.rule_version }
        };
      }
    }
    return { verdict: ruleset.default_verdict };
  }

  if (ruleset.combine_strategy === "DENY_OVERRIDES") {
    let anyAllow = false;

    for (const r of ruleset.rules) {
      const matched = evalTemplateV0(fieldMap, r.template);
      if (!matched) {
        continue;
      }

      if (r.verdict === "DENY") {
        return {
          verdict: "DENY",
          ruleRef: { ruleset_id: ruleset.ruleset_id, rule_id: r.rule_id, rule_version: r.rule_version }
        };
      }

      // If matched and not DENY, it must be ALLOW per type definition.
      anyAllow = true;
    }

    if (anyAllow) {
      return { verdict: "ALLOW" };
    }

    return { verdict: ruleset.default_verdict };
  }

  // Exhaustiveness guard.
  const _never: never = ruleset.combine_strategy;
  throw new Error(`UNREACHABLE_COMBINE_STRATEGY: ${String(_never)}`);
}

/**
 * Collects all template_ids used in a template expression tree.
 */
function collectTemplateIds(expr: TemplateExprV0): ReadonlySet<TemplateIdV0> {
  const ids = new Set<TemplateIdV0>();

  const walk = (node: TemplateExprV0): void => {
    // node.template_id 在 TemplateExprV0 上是 TemplateIdV0（强类型）
    ids.add(node.template_id);

    // 只有带 children 的节点才递归
    if ("children" in node && Array.isArray(node.children)) {
      for (const c of node.children) {
        walk(c);
      }
    }
  };

  walk(expr);
  return ids;
}

/**
 * Generates an id-like string.
 *
 * Note: This is NOT intended to be cryptographically secure.
 * In later phases, ids should be produced by the system's fact/ledger conventions.
 */
function createDeterministicLikeId(prefix: string): string {
  // Use timestamp + random suffix to reduce collision risk without adding dependencies.
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
