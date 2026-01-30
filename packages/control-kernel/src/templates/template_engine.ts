// Control Kernel - Rule Template Engine (v0)
//
// Normative sources:
// - docs/controlplane/constitution/GEOX-ControlConstitution-RuleTemplates-v0.md
// - docs/controlplane/constitution/GEOX-ControlConstitution-RuleShape-v0.md
//
// This module evaluates template expressions against a FieldMap.
// It is intentionally minimal:
// - No numeric comparisons
// - No thresholds
// - No aggregation
// - No sorting
// - No text matching

import type { FieldMap } from "../inputs/projector";
import { assertAllowedInputPathV0 } from "../inputs/allowed_input_paths";

/**
 * Frozen template identifiers in Rule Templates v0.
 */
export type TemplateIdV0 =
  | "FIELD_EQ"
  | "FIELD_IN"
  | "FIELD_EXISTS"
  | "SET_INTERSECTS"
  | "WINDOW_MATCH"
  | "LOGICAL_AND"
  | "LOGICAL_OR_NOT";

/**
 * Primitive enum value accepted by templates.
 */
export type EnumValue = string;

/**
 * Enum set accepted by templates.
 */
export type EnumSet = ReadonlyArray<EnumValue>;

/**
 * Base template node used for structural discrimination.
 */
export interface TemplateNodeBase {
  template_id: TemplateIdV0;
}

/** FIELD_EQ: EQ(field_path, enum_value) */
export interface TemplateFieldEq extends TemplateNodeBase {
  template_id: "FIELD_EQ";
  field_path: string;
  value: EnumValue;
}

/** FIELD_IN: IN(field_path, enum_set) */
export interface TemplateFieldIn extends TemplateNodeBase {
  template_id: "FIELD_IN";
  field_path: string;
  values: EnumSet;
}

/** FIELD_EXISTS: EXISTS(field_path) */
export interface TemplateFieldExists extends TemplateNodeBase {
  template_id: "FIELD_EXISTS";
  field_path: string;
}

/** SET_INTERSECTS: INTERSECTS(field_path, enum_set) */
export interface TemplateSetIntersects extends TemplateNodeBase {
  template_id: "SET_INTERSECTS";
  field_path: string;
  values: EnumSet;
}

/** WINDOW_MATCH: WINDOW_MATCH(window) - kept structural; validates start/end types only. */
export interface TemplateWindowMatch extends TemplateNodeBase {
  template_id: "WINDOW_MATCH";
}

/** LOGICAL_AND: AND(children[]) */
export interface TemplateLogicalAnd extends TemplateNodeBase {
  template_id: "LOGICAL_AND";
  children: ReadonlyArray<TemplateExprV0>;
}

/** LOGICAL_OR_NOT: OR(children[]) or NOT(child) */
export interface TemplateLogicalOrNot extends TemplateNodeBase {
  template_id: "LOGICAL_OR_NOT";
  op: "OR" | "NOT";
  children: ReadonlyArray<TemplateExprV0>;
}

/**
 * Union of all template expressions allowed in v0.
 */
export type TemplateExprV0 =
  | TemplateFieldEq
  | TemplateFieldIn
  | TemplateFieldExists
  | TemplateSetIntersects
  | TemplateWindowMatch
  | TemplateLogicalAnd
  | TemplateLogicalOrNot;

/**
 * Extracts the referenced field paths from a template expression.
 *
 * This is used to:
 * - enforce inputs_used discipline (no hidden dependencies)
 * - validate that referenced fields are in the Allowed Input Paths allowlist
 */
export function collectFieldPathsFromTemplateV0(expr: TemplateExprV0): ReadonlySet<string> {
  const paths = new Set<string>();

  // Recursive walk that accumulates field paths.
  const walk = (node: TemplateExprV0): void => {
    switch (node.template_id) {
      case "FIELD_EQ":
      case "FIELD_IN":
      case "FIELD_EXISTS":
      case "SET_INTERSECTS":
        // Each of these nodes references exactly one field_path.
        paths.add(node.field_path);
        break;
      case "WINDOW_MATCH":
        // WINDOW_MATCH does not reference a specific leaf; it is a structural check.
        // We bind it to the explicit window leaf paths to avoid hidden scope expansion.
        paths.add("problem_state.window.startTs");
        paths.add("problem_state.window.endTs");
        paths.add("permission_set.window.startTs");
        paths.add("permission_set.window.endTs");
        break;
      case "LOGICAL_AND":
        for (const child of node.children) {
          walk(child);
        }
        break;
      case "LOGICAL_OR_NOT":
        for (const child of node.children) {
          walk(child);
        }
        break;
      default: {
        // Exhaustiveness guard.
        const _never: never = node;
        throw new Error(`UNREACHABLE_TEMPLATE_ID: ${( _never as any).template_id}`);
      }
    }
  };

  walk(expr);

  // Enforce that every referenced path is in the Allowed Input Paths allowlist.
  for (const p of paths) {
    assertAllowedInputPathV0(p, "collectFieldPathsFromTemplateV0");
  }

  return paths;
}

/**
 * Evaluates a template expression to a boolean.
 *
 * @param fieldMap - Read-only FieldMap projection.
 * @param expr - Template expression.
 * @returns boolean result.
 */
export function evalTemplateV0(fieldMap: FieldMap, expr: TemplateExprV0): boolean {
  switch (expr.template_id) {
    case "FIELD_EQ": {
      // Guard: only allowed paths may be referenced.
      assertAllowedInputPathV0(expr.field_path, "FIELD_EQ");

      // Compare by strict equality against a string enum value.
      return fieldMap[expr.field_path] === expr.value;
    }
    case "FIELD_IN": {
      assertAllowedInputPathV0(expr.field_path, "FIELD_IN");

      // Check membership (field is a string enum value).
      const v = fieldMap[expr.field_path];
      return typeof v === "string" && expr.values.includes(v);
    }
    case "FIELD_EXISTS": {
      assertAllowedInputPathV0(expr.field_path, "FIELD_EXISTS");

      // Existence means field is not undefined/null.
      const v = fieldMap[expr.field_path];
      return v !== undefined && v !== null;
    }
    case "SET_INTERSECTS": {
      assertAllowedInputPathV0(expr.field_path, "SET_INTERSECTS");

      // Field is expected to be an array of strings (enum set).
      const v = fieldMap[expr.field_path];
      if (!Array.isArray(v)) {
        return false;
      }

      // Compute intersection by checking whether any element of v is in expr.values.
      return v.some((x) => typeof x === "string" && expr.values.includes(x));
    }
    case "WINDOW_MATCH": {
      // WINDOW_MATCH is a structural check; it must NOT encode time reasoning.
      // Here we only validate that startTs/endTs are numbers (when present) and that
      // the permission_set window matches the problem_state window when both are present.
      const psStart = fieldMap["problem_state.window.startTs"];
      const psEnd = fieldMap["problem_state.window.endTs"];
      const permStart = fieldMap["permission_set.window.startTs"];
      const permEnd = fieldMap["permission_set.window.endTs"];

      const isNumOrUndef = (x: unknown): boolean => typeof x === "number" || x === undefined;

      // Type checks only.
      if (!isNumOrUndef(psStart) || !isNumOrUndef(psEnd) || !isNumOrUndef(permStart) || !isNumOrUndef(permEnd)) {
        return false;
      }

      // Equality check only when both sides are defined.
      const startOk = psStart === undefined || permStart === undefined ? true : psStart === permStart;
      const endOk = psEnd === undefined || permEnd === undefined ? true : psEnd === permEnd;
      return startOk && endOk;
    }
    case "LOGICAL_AND": {
      // AND: all children must be true.
      return expr.children.every((child) => evalTemplateV0(fieldMap, child));
    }
    case "LOGICAL_OR_NOT": {
      if (expr.op === "OR") {
        // OR: any child true.
        return expr.children.some((child) => evalTemplateV0(fieldMap, child));
      }

      if (expr.op === "NOT") {
        // NOT: exactly one child required to avoid ambiguity.
        if (expr.children.length !== 1) {
          throw new Error("TEMPLATE_NOT_ARITY_INVALID: NOT requires exactly 1 child");
        }
        return !evalTemplateV0(fieldMap, expr.children[0]);
      }

      // Should be unreachable because op is a closed union.
      throw new Error(`TEMPLATE_LOGICAL_OR_NOT_UNKNOWN_OP: ${String(expr.op)}`);
    }
    default: {
      // Exhaustiveness guard.
      const _never: never = expr;
      throw new Error(`UNREACHABLE_TEMPLATE_ID: ${( _never as any).template_id}`);
    }
  }
}
