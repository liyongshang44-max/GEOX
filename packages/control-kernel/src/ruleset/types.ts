// Control Kernel - RuleSet types (v0)
//
// Normative sources:
// - docs/controlplane/constitution/GEOX-ControlConstitution-RuleSetSkeleton-v0.md
// - docs/controlplane/constitution/GEOX-ControlConstitution-RuleTemplates-v0.md
// - docs/controlplane/constitution/GEOX-ControlKernel-AllowedOutputs-v0.md

import type { TemplateExprV0, TemplateIdV0 } from "../templates/template_engine";

/**
 * Frozen combine strategies in RuleSet Skeleton v0.
 */
export type CombineStrategyV0 = "DENY_OVERRIDES" | "FIRST_MATCH";

/**
 * Frozen verdict values in ControlVerdict v0.
 */
export type VerdictV0 = "ALLOW" | "DENY" | "UNDETERMINED";

/**
 * RuleSet Skeleton v0: organizational container for rules of a single action_code.
 */
export interface ControlRuleSetV0 {
  // Discriminator for schema identification.
  type: "control_ruleset_v0";

  // SemVer for this skeleton definition.
  schema_version: string;

  // Stable identifier for the ruleset.
  ruleset_id: string;

  // Target action code this ruleset evaluates.
  action_code: string;

  // Combination strategy used when multiple rules match.
  combine_strategy: CombineStrategyV0;

  // Default verdict if no rule matches.
  default_verdict: "UNDETERMINED";

  // Explicit list of allowed input leaf paths for this ruleset.
  inputs_used: ReadonlyArray<string>;

  // Explicit list of template ids that may appear in rules.
  allowed_template_ids: ReadonlyArray<TemplateIdV0>;

  // Concrete rules in deterministic order.
  rules: ReadonlyArray<ControlRuleV0>;
}

/**
 * One concrete rule entry, created by choosing a template and filling enum parameters.
 */
export interface ControlRuleV0 {
  // Stable rule identifier.
  rule_id: string;

  // SemVer for rule changes.
  rule_version: string;

  // Template expression tree.
  template: TemplateExprV0;

  // Verdict to emit when the template predicate matches.
  verdict: Exclude<VerdictV0, "UNDETERMINED">;
}

/**
 * ControlVerdict v0: the only allowed kernel output.
 */
export interface ControlVerdictV0 {
  // Discriminator for schema identification.
  type: "control_verdict_v0";

  // SemVer for output shape.
  schema_version: string;

  // Unique id for this verdict instance.
  verdict_id: string;

  // When the kernel evaluated this verdict (ms timestamp).
  evaluated_at_ts: number;

  // Subject reference from inputs (opaque to the kernel).
  subjectRef: unknown;

  // Window from inputs (opaque to the kernel).
  window: unknown;

  // Action code this verdict applies to.
  action_code: string;

  // Final verdict.
  verdict: VerdictV0;

  // Optional reference to the matched rule (auditing only, not an explanation).
  rule_ref?: { ruleset_id: string; rule_id: string; rule_version: string };
}
