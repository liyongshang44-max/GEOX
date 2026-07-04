// apps/web/src/features/operator/fieldRuntime/fieldRuntimeScenarioAdapter.ts
// Purpose: map the existing read-only Operator Field Twin scenario compare response into the H60-G Field Runtime Scenario ViewModel.
// Boundary: this adapter reuses the existing scenario compare read model and does not create recommendation, approval, dispatch, or AO-ACT actions.

import {
  fetchOperatorFieldTwinScenarioCompare,
  type OperatorFieldTwinScenarioCompareV1,
  type OperatorScenarioCompareOption,
  type OperatorTwinRequestScope,
} from "../../../api/operatorTwin";

export type FieldRuntimeScenarioCompareViewModel = {
  source: "scenario_compare_v1";
  status: string;
  noActionBaselinePresent: boolean;
  unavailableReason: string;
  scenarioSetId: string;
};

export type FieldRuntimeScenarioOptionViewModel = {
  optionId: string;
  label: string;
  forecastDeltaText: string;
  confidenceText: string;
  failureConditions: string[];
  isNoActionBaseline: boolean;
};

export type FieldRuntimeScenarioViewModel = {
  fieldId: string;
  fieldName: string;
  cropText: string;
  source: "operator_field_twin_scenario_compare_v1";
  scenarioCompare: FieldRuntimeScenarioCompareViewModel;
  options: FieldRuntimeScenarioOptionViewModel[];
  evidenceRefs: string[];
  boundaryRules: string[];
};

export type FieldRuntimeScenarioLoadState =
  | { status: "idle"; message: string }
  | { status: "loading" }
  | { status: "ready"; scenario: FieldRuntimeScenarioViewModel }
  | { status: "error"; message: string };

function text(value: string | number | boolean | null | undefined, fallback = "Not available"): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "none" || raw === "n/a") return fallback;
  return raw;
}

function uniqueRefs(refs: string[]): string[] {
  return [...new Set(refs.map((ref) => ref.trim()).filter(Boolean))];
}

function isNoActionBaseline(option: OperatorScenarioCompareOption): boolean {
  const identity = `${option.option_id} ${option.label}`.toLowerCase();
  return identity.includes("no_action") || identity.includes("no action") || identity.includes("baseline");
}

function mapOption(option: OperatorScenarioCompareOption): FieldRuntimeScenarioOptionViewModel {
  return {
    optionId: text(option.option_id),
    label: text(option.label),
    forecastDeltaText: text(option.risk_delta, "No delta reported"),
    confidenceText: text(option.confidence_text, "Not reported"),
    failureConditions: option.failure_conditions.map((condition) => text(condition)).filter(Boolean),
    isNoActionBaseline: isNoActionBaseline(option),
  };
}

export function mapFieldRuntimeScenario(panel: OperatorFieldTwinScenarioCompareV1): FieldRuntimeScenarioViewModel {
  const compare = panel.scenario_compare_v1;
  return {
    fieldId: panel.field_context.field_id,
    fieldName: panel.field_context.field_name,
    cropText: panel.field_context.crop_text,
    source: "operator_field_twin_scenario_compare_v1",
    scenarioCompare: {
      source: "scenario_compare_v1",
      status: text(compare.status),
      noActionBaselinePresent: compare.no_action_baseline_present,
      unavailableReason: text(compare.unavailable_reason, "None"),
      scenarioSetId: text(compare.scenario_set_id, "Not available"),
    },
    options: compare.options.map(mapOption),
    evidenceRefs: uniqueRefs(compare.evidence_refs),
    boundaryRules: panel.boundary_rules.map((rule) => rule.label),
  };
}

export async function loadFieldRuntimeScenario(fieldId: string, scope?: OperatorTwinRequestScope | null): Promise<FieldRuntimeScenarioLoadState> {
  const safeFieldId = String(fieldId || "").trim();
  if (!safeFieldId || safeFieldId === "not-selected") {
    return { status: "idle", message: "Select a field before loading Field Runtime Scenario." };
  }

  try {
    const response = await fetchOperatorFieldTwinScenarioCompare(safeFieldId, scope);
    return {
      status: "ready",
      scenario: mapFieldRuntimeScenario(response.operator_field_twin_scenario_compare_v1),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "FIELD_RUNTIME_SCENARIO_LOAD_FAILED",
    };
  }
}
