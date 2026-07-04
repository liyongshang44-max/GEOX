// apps/web/src/features/operator/fieldRuntime/fieldRuntimeForecastAdapter.ts
// Purpose: map the existing read-only Operator Field Twin forecast panel response into the H60-F Field Runtime Forecast ViewModel.
// Boundary: this adapter reuses the existing forecast read model and does not create recommendations, compare scenarios, or create control actions.

import {
  fetchOperatorFieldTwinForecastPanel,
  type OperatorFieldTwinForecastPanelV1,
  type OperatorForecastRiskTimelineItem,
  type OperatorTwinRequestScope,
} from "../../../api/operatorTwin";

export type FieldRuntimeForecastWindowViewModel = {
  source: "forecast_window_v1";
  availableHorizon: string;
  horizonLimited: boolean;
  unavailableHorizons: string[];
  limitationReason: string;
  evidenceRefs: string[];
};

export type FieldRuntimeForecastTimelineItem = {
  horizon: string;
  forecastText: string;
  confidenceText: string;
  evidenceRefs: string[];
};

export type FieldRuntimeForecastViewModel = {
  fieldId: string;
  fieldName: string;
  cropText: string;
  source: "operator_field_twin_forecast_panel_v1";
  forecastWindow: FieldRuntimeForecastWindowViewModel;
  timelineItems: FieldRuntimeForecastTimelineItem[];
  evidenceRefs: string[];
  boundaryRules: string[];
};

export type FieldRuntimeForecastLoadState =
  | { status: "idle"; message: string }
  | { status: "loading" }
  | { status: "ready"; forecast: FieldRuntimeForecastViewModel }
  | { status: "error"; message: string };

function text(value: string | number | boolean | null | undefined, fallback = "Not available"): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "none" || raw === "n/a") return fallback;
  return raw;
}

function uniqueRefs(refs: string[]): string[] {
  return [...new Set(refs.map((ref) => ref.trim()).filter(Boolean))];
}

function mapTimelineItem(item: OperatorForecastRiskTimelineItem): FieldRuntimeForecastTimelineItem {
  return {
    horizon: text(item.horizon),
    forecastText: text(item.risk_text),
    confidenceText: text(item.confidence_text),
    evidenceRefs: uniqueRefs(item.evidence_refs),
  };
}

export function mapFieldRuntimeForecast(panel: OperatorFieldTwinForecastPanelV1): FieldRuntimeForecastViewModel {
  const forecastWindow = panel.forecast_window_v1;
  const timelineItems = forecastWindow.risk_timeline.map(mapTimelineItem);
  const timelineEvidenceRefs = timelineItems.flatMap((item) => item.evidenceRefs);

  return {
    fieldId: panel.field_context.field_id,
    fieldName: panel.field_context.field_name,
    cropText: panel.field_context.crop_text,
    source: "operator_field_twin_forecast_panel_v1",
    forecastWindow: {
      source: "forecast_window_v1",
      availableHorizon: text(forecastWindow.available_horizon),
      horizonLimited: forecastWindow.forecast_horizon_limited,
      unavailableHorizons: forecastWindow.unavailable_horizons,
      limitationReason: text(forecastWindow.reason),
      evidenceRefs: uniqueRefs(forecastWindow.evidence_refs),
    },
    timelineItems,
    evidenceRefs: uniqueRefs([...forecastWindow.evidence_refs, ...timelineEvidenceRefs]),
    boundaryRules: panel.boundary_rules.map((rule) => rule.label),
  };
}

export async function loadFieldRuntimeForecast(fieldId: string, scope?: OperatorTwinRequestScope | null): Promise<FieldRuntimeForecastLoadState> {
  const safeFieldId = String(fieldId || "").trim();
  if (!safeFieldId || safeFieldId === "not-selected") {
    return { status: "idle", message: "Select a field before loading Field Runtime Forecast." };
  }

  try {
    const response = await fetchOperatorFieldTwinForecastPanel(safeFieldId, scope);
    return {
      status: "ready",
      forecast: mapFieldRuntimeForecast(response.operator_field_twin_forecast_panel_v1),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "FIELD_RUNTIME_FORECAST_LOAD_FAILED",
    };
  }
}
