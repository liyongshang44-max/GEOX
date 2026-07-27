// Purpose: expose the exact frozen MCFT-CAP-07 S4 source-validation obligations from the committed S0 authority matrix plus explicitly reconciled non-mutating source-contract corrections.
// Boundary: pure read-only contract materialization from versioned repository JSON assets; no database, route, network, filesystem-at-runtime, canonical rewrite, or write authority.

import sourceMatrixJson from "../../../../../docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-SOURCE-VALIDATION-MATRIX-V1.json" with { type: "json" };
import governanceScopeReconciliationJson from "../../../../../docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-CAP06-GOVERNANCE-SCOPE-RECONCILIATION-V1.json" with { type: "json" };
import forecastPointCountReconciliationJson from "../../../../../docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-CAP04-FORECAST-POINT-COUNT-RECONCILIATION-V1.json" with { type: "json" };
import scenarioOptionCountReconciliationJson from "../../../../../docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-CAP04-SCENARIO-OPTION-COUNT-RECONCILIATION-V1.json" with { type: "json" };
import type { FieldTwinSourceValidationObligationRowV1 } from "./contracts_v1.js";
import { validateSourceValidationObligationMatrixV1 } from "./source_validation_registry_v1.js";

export const MCFT_CAP_07_S4_SOURCE_NAMES_V1 = Object.freeze([
  "public.twin_state_history_projection_v1",
  "public.twin_forecast_run_projection_v1",
  "public.twin_scenario_set_projection_v1",
  "public.twin_forecast_residual_projection_v1",
  "public.twin_action_feedback_projection_v1",
  "public.twin_calibration_candidate_projection_v1",
  "public.twin_shadow_evaluation_projection_v1",
  "public.facts#record_json.type=twin_model_activation_v1",
] as const);

const SCOPE_KEYS_V1 = Object.freeze([
  "tenant_id",
  "project_id",
  "group_id",
  "field_id",
  "season_id",
  "zone_id",
] as const);

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function applyGovernanceScopeReconciliationV1(): ReturnType<typeof validateSourceValidationObligationMatrixV1> {
  const base = validateSourceValidationObligationMatrixV1(sourceMatrixJson);
  const reconciliation = requiredRecordV1(
    governanceScopeReconciliationJson,
    "MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_INVALID",
  );
  if (reconciliation.record_status !== "NON_CANDIDATE_SOURCE_CONTRACT_RECONCILIATION") {
    throw new Error("MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_STATUS_INVALID");
  }
  if (reconciliation.base_matrix_blob !== "9bc4713357f3c89d1f6d799fd2502a4da7181b00") {
    throw new Error("MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_BASE_BLOB_INVALID");
  }
  const affected = reconciliation.affected_sources;
  if (!Array.isArray(affected) || affected.length !== 2) {
    throw new Error("MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_CARDINALITY_INVALID");
  }
  const replacements = new Map<string, {
    prior_scope_path: Record<string, string>;
    effective_scope_path: Record<string, string>;
    prior_canonical_hash_function: string;
    effective_canonical_hash_function: string;
  }>();
  for (const raw of affected) {
    const row = requiredRecordV1(raw, "MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_ROW_INVALID");
    const sourceName = requiredStringV1(row.source_name, "MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_SOURCE_INVALID");
    if (replacements.has(sourceName)) {
      throw new Error(`MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_SOURCE_DUPLICATE:${sourceName}`);
    }
    const priorRaw = requiredRecordV1(row.prior_scope_path, "MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_PRIOR_INVALID");
    const effectiveRaw = requiredRecordV1(row.effective_scope_path, "MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_EFFECTIVE_INVALID");
    const prior: Record<string, string> = {};
    const effective: Record<string, string> = {};
    for (const key of SCOPE_KEYS_V1) {
      prior[key] = requiredStringV1(priorRaw[key], `MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_PRIOR_${key.toUpperCase()}_INVALID`);
      effective[key] = requiredStringV1(effectiveRaw[key], `MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_EFFECTIVE_${key.toUpperCase()}_INVALID`);
      if (effective[key] !== `record_json.payload.scope.${key}`) {
        throw new Error(`MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_EFFECTIVE_PATH_INVALID:${sourceName}:${key}`);
      }
    }
    const priorHash = requiredStringV1(
      row.prior_canonical_hash_function,
      `MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_PRIOR_HASH_INVALID:${sourceName}`,
    );
    const effectiveHash = requiredStringV1(
      row.effective_canonical_hash_function,
      `MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_EFFECTIVE_HASH_INVALID:${sourceName}`,
    );
    if (effectiveHash !== 'semanticHashV1(assign(structuredClone(canonical_object),{determinism_hash:""}))') {
      throw new Error(`MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_EFFECTIVE_HASH_PROFILE_INVALID:${sourceName}`);
    }
    replacements.set(sourceName, {
      prior_scope_path: prior,
      effective_scope_path: effective,
      prior_canonical_hash_function: priorHash,
      effective_canonical_hash_function: effectiveHash,
    });
  }
  const exactSources = [
    "public.twin_calibration_candidate_projection_v1",
    "public.twin_shadow_evaluation_projection_v1",
  ].sort();
  if (JSON.stringify([...replacements.keys()].sort()) !== JSON.stringify(exactSources)) {
    throw new Error("MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_SOURCE_SET_INVALID");
  }
  let applied = 0;
  const rows = base.rows.map((row) => {
    const replacement = replacements.get(row.source_name);
    if (!replacement) return row;
    applied += 1;
    for (const key of SCOPE_KEYS_V1) {
      if ((row.scope_path as Record<string, string>)[key] !== replacement.prior_scope_path[key]) {
        throw new Error(`MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_PRIOR_DRIFT:${row.source_name}:${key}`);
      }
    }
    if (row.canonical_hash_function !== replacement.prior_canonical_hash_function) {
      throw new Error(`MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_PRIOR_HASH_DRIFT:${row.source_name}`);
    }
    const comparisons = row.required_column_comparisons.map((value, index) => {
      const comparison = requiredRecordV1(
        value,
        `MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_COMPARISON_INVALID:${row.source_name}:${index}`,
      );
      const projectionColumn = requiredStringV1(
        comparison.projection_column,
        `MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_COMPARISON_COLUMN_INVALID:${row.source_name}:${index}`,
      );
      const canonicalPath = requiredStringV1(
        comparison.canonical_path,
        `MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_COMPARISON_PATH_INVALID:${row.source_name}:${index}`,
      );
      const scopeKey = SCOPE_KEYS_V1.find((key) => projectionColumn === key);
      if (!scopeKey) return comparison;
      if (canonicalPath !== replacement.prior_scope_path[scopeKey]) {
        throw new Error(`MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_COMPARISON_PRIOR_DRIFT:${row.source_name}:${scopeKey}`);
      }
      return Object.freeze({
        ...comparison,
        canonical_path: replacement.effective_scope_path[scopeKey],
      });
    });
    return Object.freeze({
      ...row,
      scope_path: Object.freeze({ ...replacement.effective_scope_path }),
      required_column_comparisons: Object.freeze(comparisons),
      canonical_hash_function: replacement.effective_canonical_hash_function,
    });
  });
  if (applied !== 2) throw new Error(`MCFT_CAP_07_GOVERNANCE_SCOPE_RECONCILIATION_APPLIED_COUNT_INVALID:${applied}`);
  return validateSourceValidationObligationMatrixV1({ ...base, rows });
}

function applyForecastProjectionReconciliationV1(
  base: ReturnType<typeof validateSourceValidationObligationMatrixV1>,
): ReturnType<typeof validateSourceValidationObligationMatrixV1> {
  const reconciliation = requiredRecordV1(
    forecastPointCountReconciliationJson,
    "MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_INVALID",
  );
  if (reconciliation.record_status !== "NON_CANDIDATE_SOURCE_CONTRACT_RECONCILIATION") {
    throw new Error("MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_STATUS_INVALID");
  }
  if (reconciliation.base_matrix_blob !== "9bc4713357f3c89d1f6d799fd2502a4da7181b00") {
    throw new Error("MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_BASE_BLOB_INVALID");
  }
  const affected = reconciliation.affected_sources;
  if (!Array.isArray(affected)
    || affected.length !== 1
    || reconciliation.affected_source_count !== 1
    || reconciliation.affected_comparison_count !== 2) {
    throw new Error("MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_CARDINALITY_INVALID");
  }
  const sourceRule = requiredRecordV1(affected[0], "MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_SOURCE_RULE_INVALID");
  const sourceName = requiredStringV1(sourceRule.source_name, "MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_SOURCE_INVALID");
  const rawRules = sourceRule.comparison_rules;
  if (sourceName !== "public.twin_forecast_run_projection_v1" || !Array.isArray(rawRules) || rawRules.length !== 2) {
    throw new Error("MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_SOURCE_DRIFT");
  }
  const rules = new Map<string, { prior_path: string; effective_path: string; authority_rule: string }>();
  for (const raw of rawRules) {
    const rule = requiredRecordV1(raw, "MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_RULE_INVALID");
    const projectionColumn = requiredStringV1(rule.projection_column, "MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_COLUMN_INVALID");
    if (rules.has(projectionColumn) || rule.prior_comparison !== "EXACT" || rule.effective_comparison !== "EXACT") {
      throw new Error(`MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_RULE_DUPLICATE_OR_MODE:${projectionColumn}`);
    }
    rules.set(projectionColumn, {
      prior_path: requiredStringV1(rule.prior_canonical_path, `MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_PRIOR_PATH_INVALID:${projectionColumn}`),
      effective_path: requiredStringV1(rule.effective_canonical_path, `MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_EFFECTIVE_PATH_INVALID:${projectionColumn}`),
      authority_rule: requiredStringV1(rule.canonical_authority_rule, `MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_AUTHORITY_RULE_INVALID:${projectionColumn}`),
    });
  }
  const forecastStatusRule = rules.get("forecast_status");
  const pointCountRule = rules.get("point_count");
  if (!forecastStatusRule
    || forecastStatusRule.prior_path !== "record_json.payload.payload.forecast_status"
    || forecastStatusRule.effective_path !== "record_json.payload.payload.status"
    || forecastStatusRule.authority_rule !== "CAP04_FORECAST_STATUS_FIELD"
    || !pointCountRule
    || pointCountRule.prior_path !== "record_json.payload.payload.point_count"
    || pointCountRule.effective_path !== "record_json.payload.payload.points.length"
    || pointCountRule.authority_rule !== "ARRAY_LENGTH_EQUALS_PROJECTION_POINT_COUNT") {
    throw new Error("MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_RULE_DRIFT");
  }
  let sourceApplied = 0;
  let comparisonApplied = 0;
  const rows = base.rows.map((row) => {
    if (row.source_name !== sourceName) return row;
    sourceApplied += 1;
    const comparisons = row.required_column_comparisons.map((value, index) => {
      const comparison = requiredRecordV1(
        value,
        `MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_COMPARISON_INVALID:${index}`,
      );
      const projectionColumn = requiredStringV1(
        comparison.projection_column,
        `MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_COMPARISON_COLUMN_INVALID:${index}`,
      );
      const rule = rules.get(projectionColumn);
      if (!rule) return comparison;
      comparisonApplied += 1;
      if (comparison.canonical_path !== rule.prior_path || comparison.comparison !== "EXACT") {
        throw new Error(`MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_PRIOR_DRIFT:${projectionColumn}`);
      }
      return Object.freeze({ ...comparison, canonical_path: rule.effective_path });
    });
    return Object.freeze({ ...row, required_column_comparisons: Object.freeze(comparisons) });
  });
  if (sourceApplied !== 1 || comparisonApplied !== 2) {
    throw new Error(`MCFT_CAP_07_FORECAST_PROJECTION_RECONCILIATION_APPLIED_COUNT_INVALID:${sourceApplied}:${comparisonApplied}`);
  }
  return validateSourceValidationObligationMatrixV1({ ...base, rows });
}

function applyScenarioProjectionReconciliationV1(
  base: ReturnType<typeof validateSourceValidationObligationMatrixV1>,
): ReturnType<typeof validateSourceValidationObligationMatrixV1> {
  const reconciliation = requiredRecordV1(
    scenarioOptionCountReconciliationJson,
    "MCFT_CAP_07_SCENARIO_PROJECTION_RECONCILIATION_INVALID",
  );
  if (reconciliation.record_status !== "NON_CANDIDATE_SOURCE_CONTRACT_RECONCILIATION") {
    throw new Error("MCFT_CAP_07_SCENARIO_PROJECTION_RECONCILIATION_STATUS_INVALID");
  }
  if (reconciliation.base_matrix_blob !== "9bc4713357f3c89d1f6d799fd2502a4da7181b00") {
    throw new Error("MCFT_CAP_07_SCENARIO_PROJECTION_RECONCILIATION_BASE_BLOB_INVALID");
  }
  const affected = reconciliation.affected_sources;
  if (!Array.isArray(affected)
    || affected.length !== 1
    || reconciliation.affected_source_count !== 1
    || reconciliation.affected_comparison_count !== 1) {
    throw new Error("MCFT_CAP_07_SCENARIO_PROJECTION_RECONCILIATION_CARDINALITY_INVALID");
  }
  const rule = requiredRecordV1(affected[0], "MCFT_CAP_07_SCENARIO_PROJECTION_RECONCILIATION_RULE_INVALID");
  const sourceName = requiredStringV1(rule.source_name, "MCFT_CAP_07_SCENARIO_PROJECTION_RECONCILIATION_SOURCE_INVALID");
  const projectionColumn = requiredStringV1(rule.projection_column, "MCFT_CAP_07_SCENARIO_PROJECTION_RECONCILIATION_COLUMN_INVALID");
  const priorPath = requiredStringV1(rule.prior_canonical_path, "MCFT_CAP_07_SCENARIO_PROJECTION_RECONCILIATION_PRIOR_PATH_INVALID");
  const effectivePath = requiredStringV1(rule.effective_canonical_path, "MCFT_CAP_07_SCENARIO_PROJECTION_RECONCILIATION_EFFECTIVE_PATH_INVALID");
  if (sourceName !== "public.twin_scenario_set_projection_v1"
    || projectionColumn !== "option_count"
    || priorPath !== "record_json.payload.payload.option_count"
    || effectivePath !== "record_json.payload.payload.options.length"
    || rule.prior_comparison !== "EXACT"
    || rule.effective_comparison !== "EXACT"
    || rule.canonical_authority_rule !== "ARRAY_LENGTH_EQUALS_PROJECTION_OPTION_COUNT") {
    throw new Error("MCFT_CAP_07_SCENARIO_PROJECTION_RECONCILIATION_RULE_DRIFT");
  }
  let sourceApplied = 0;
  let comparisonApplied = 0;
  const rows = base.rows.map((row) => {
    if (row.source_name !== sourceName) return row;
    sourceApplied += 1;
    const comparisons = row.required_column_comparisons.map((value, index) => {
      const comparison = requiredRecordV1(
        value,
        `MCFT_CAP_07_SCENARIO_PROJECTION_RECONCILIATION_COMPARISON_INVALID:${index}`,
      );
      if (comparison.projection_column !== projectionColumn) return comparison;
      comparisonApplied += 1;
      if (comparison.canonical_path !== priorPath || comparison.comparison !== "EXACT") {
        throw new Error("MCFT_CAP_07_SCENARIO_PROJECTION_RECONCILIATION_PRIOR_DRIFT");
      }
      return Object.freeze({ ...comparison, canonical_path: effectivePath });
    });
    return Object.freeze({ ...row, required_column_comparisons: Object.freeze(comparisons) });
  });
  if (sourceApplied !== 1 || comparisonApplied !== 1) {
    throw new Error(`MCFT_CAP_07_SCENARIO_PROJECTION_RECONCILIATION_APPLIED_COUNT_INVALID:${sourceApplied}:${comparisonApplied}`);
  }
  return validateSourceValidationObligationMatrixV1({ ...base, rows });
}

const sourceMatrix = applyScenarioProjectionReconciliationV1(
  applyForecastProjectionReconciliationV1(applyGovernanceScopeReconciliationV1()),
);

export const MCFT_CAP_07_S4_SOURCE_OBLIGATIONS_V1: readonly FieldTwinSourceValidationObligationRowV1[] = Object.freeze(
  MCFT_CAP_07_S4_SOURCE_NAMES_V1.map((sourceName) => {
    const matches = sourceMatrix.rows.filter((row) => row.source_name === sourceName);
    if (matches.length !== 1) throw new Error(`MCFT_CAP_07_S4_SOURCE_OBLIGATION_CARDINALITY_INVALID:${sourceName}:${matches.length}`);
    return matches[0];
  }),
);

export function resolveMcftCap07S4SourceObligationV1(sourceName: string): FieldTwinSourceValidationObligationRowV1 {
  const matches = MCFT_CAP_07_S4_SOURCE_OBLIGATIONS_V1.filter((row) => row.source_name === sourceName);
  if (matches.length !== 1) throw new Error(`MCFT_CAP_07_S4_SOURCE_OBLIGATION_RESOLUTION_INVALID:${sourceName}:${matches.length}`);
  return matches[0];
}
