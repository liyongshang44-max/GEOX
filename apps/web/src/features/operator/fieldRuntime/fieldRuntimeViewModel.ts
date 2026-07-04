// apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts
// Purpose: provide the Field Runtime ViewModel contract for layout, tabs, route identity, and boundary copy.
// Boundary: this file builds local UI state only; read-only data is mapped by Field Runtime adapters.

export type FieldRuntimeTabKey =
  | "overview"
  | "evidence"
  | "state"
  | "forecast"
  | "scenario"
  | "residual"
  | "calibration"
  | "health"
  | "audit";

export type FieldRuntimeRouteKey = "fields" | FieldRuntimeTabKey;
export type FieldRuntimeTabStatus = "available" | "limited" | "not_enabled";

export type FieldRuntimeTabDefinition = {
  key: FieldRuntimeTabKey;
  label: string;
  pathSuffix: string;
  status: FieldRuntimeTabStatus;
  phase: string;
  boundaryCopy: string[];
};

export type FieldRuntimeSummaryCard = {
  label: string;
  value: string;
  detail?: string;
};

export type FieldRuntimeStateVectorItem = {
  label: string;
  value: string;
  confidenceLabel?: string;
  evidenceRefCount?: number;
};

export type FieldRuntimeEvidenceSummaryViewModel = {
  source: "operator_field_twin_workspace_v1";
  evidenceRefs: string[];
  evidenceRefCount: number;
  summaryText: string;
};

export type FieldRuntimeCoverageSummaryViewModel = {
  source: "operator_field_twin_workspace_v1";
  coverageText: string;
  sensingAvailable: boolean;
  weatherAvailable: boolean;
  forecastWindow: string;
  unavailableWindows: string[];
  reason: string;
  evidenceRefCount: number;
};

export type FieldRuntimeDataGapViewModel = {
  gapCode: string;
  label: string;
  severityLabel: string;
};

export type FieldRuntimeOverviewViewModel = {
  fieldId: string;
  fieldName: string;
  cropText: string;
  source: "operator_field_twin_workspace_v1";
  loaded: boolean;
  summaryCards: FieldRuntimeSummaryCard[];
  evidenceSummaryAvailable: boolean;
  coverageSummaryAvailable: boolean;
  dataGapSummaryAvailable: boolean;
  evidenceSummary: FieldRuntimeEvidenceSummaryViewModel;
  coverageSummary: FieldRuntimeCoverageSummaryViewModel;
  dataGaps: FieldRuntimeDataGapViewModel[];
  boundaryRules: string[];
};

export type FieldRuntimeStateViewModel = {
  fieldId: string;
  fieldName: string;
  source: "operator_field_twin_workspace_v1";
  loaded: boolean;
  stateVectorItems: FieldRuntimeStateVectorItem[];
  evidenceRefs: string[];
  boundaryCopy: string[];
};

export type FieldRuntimeRouteCopy = {
  title: string;
  phase: string;
  lines: string[];
};

export type FieldRuntimeViewModel = {
  fieldId: string;
  activeTab: FieldRuntimeTabKey | null;
  routeKey: FieldRuntimeRouteKey;
  currentRoute: string;
  sourceRouteFamily: "canonical_operator_field_runtime";
  runtimeMode: "Replay-backed Demo";
  readOnly: true;
  tabs: FieldRuntimeTabDefinition[];
  routeCopy: FieldRuntimeRouteCopy;
};

const COMMON_REVIEW_BOUNDARY = [
  "Read-only review surface.",
  "Traceability only.",
  "No runtime mutation.",
  "No external system command.",
  "No value ledger mutation.",
  "No long-term field record mutation.",
  "No model state mutation.",
];

export const FIELD_RUNTIME_TABS: FieldRuntimeTabDefinition[] = [
  {
    key: "overview",
    label: "Overview",
    pathSuffix: "",
    status: "available",
    phase: "Field Runtime Overview",
    boundaryCopy: [
      "Overview content is derived from the existing read-only Operator Field Twin workspace.",
      ...COMMON_REVIEW_BOUNDARY,
    ],
  },
  {
    key: "evidence",
    label: "Evidence",
    pathSuffix: "evidence",
    status: "available",
    phase: "Evidence Review",
    boundaryCopy: [
      "Evidence content is derived from the existing read-only Operator Field Twin evidence quality read model.",
      "Full Evidence trace is displayed for review only.",
      ...COMMON_REVIEW_BOUNDARY,
    ],
  },
  {
    key: "state",
    label: "State",
    pathSuffix: "state",
    status: "available",
    phase: "State Review",
    boundaryCopy: [
      "State content is derived from the existing read-only Operator Field Twin workspace.",
      "This shell does not generate state estimates.",
      ...COMMON_REVIEW_BOUNDARY,
    ],
  },
  {
    key: "forecast",
    label: "Forecast",
    pathSuffix: "forecast",
    status: "available",
    phase: "Forecast Review",
    boundaryCopy: [
      "Forecast content is derived from the existing read-only Operator Field Twin forecast panel.",
      "Forecast window is displayed for review only.",
      "Forecast is not a recommendation.",
      "Forecast does not imply action.",
      "No scenario comparison is performed.",
      ...COMMON_REVIEW_BOUNDARY,
    ],
  },
  {
    key: "scenario",
    label: "Scenario",
    pathSuffix: "scenario",
    status: "available",
    phase: "Scenario Review",
    boundaryCopy: [
      "Scenario content is derived from the existing read-only Operator Field Twin scenario compare read model.",
      "Scenario Review is displayed for comparison only.",
      "Scenario is not a recommendation.",
      "Scenario does not create recommendation.",
      "Scenario does not imply action.",
      "Scenario submission remains outside canonical Field Runtime.",
      "Legacy scenario submission remains isolated under the preserved scenario route family.",
      ...COMMON_REVIEW_BOUNDARY,
    ],
  },
  {
    key: "residual",
    label: "Residual",
    pathSuffix: "residual",
    status: "available",
    phase: "Residual Verification",
    boundaryCopy: [
      "Residual content is derived from the existing read-only Operator Field Twin post-irrigation verification read model.",
      "Residual / Verification is displayed for review only.",
      "Residual is not causal proof.",
      "Downstream candidate flags are metadata only.",
      ...COMMON_REVIEW_BOUNDARY,
    ],
  },
  {
    key: "calibration",
    label: "Calibration",
    pathSuffix: "calibration",
    status: "available",
    phase: "Calibration Review",
    boundaryCopy: [
      "Calibration content is derived from the existing read-only Operator Field Twin calibration replay read model.",
      "Calibration Review is displayed for replay review only.",
      "Calibration route is read-only.",
      "Review availability and readiness flags are metadata only.",
      ...COMMON_REVIEW_BOUNDARY,
    ],
  },
  {
    key: "health",
    label: "Health",
    pathSuffix: "health",
    status: "available",
    phase: "Runtime Health Review",
    boundaryCopy: [
      "Runtime Health content is derived from local Field Runtime health metadata and replay-backed source availability.",
      "Runtime Health Review is displayed for review only.",
      "Runtime Health does not claim live device connection.",
      "Runtime Health does not claim production gateway online.",
      "Runtime Health does not claim continuous production monitoring.",
      "Replay Demo source remains checked-in snapshot only.",
      ...COMMON_REVIEW_BOUNDARY,
    ],
  },
  {
    key: "audit",
    label: "Audit",
    pathSuffix: "audit",
    status: "available",
    phase: "Audit Review",
    boundaryCopy: [
      "Audit content is derived from local Field Runtime route, source, contract, and boundary metadata.",
      "Audit is displayed for traceability review only.",
      "Audit does not create product conclusions.",
      "Trace Readback Bridge links to existing Twin Trace Readback when decision_cycle_id is provided.",
      "Health is available as Runtime Health Review.",
      ...COMMON_REVIEW_BOUNDARY,
    ],
  },
];

const FIELD_LIST_COPY: FieldRuntimeRouteCopy = {
  title: "Field Runtime List",
  phase: "Field Runtime List",
  lines: [
    "Field Runtime list route is not field-scoped yet.",
    "Select a field before opening Overview, State, or other Field Runtime tabs.",
    "No field list data is loaded on this route.",
  ],
};

function findTabCopy(routeKey: FieldRuntimeRouteKey): FieldRuntimeRouteCopy {
  if (routeKey === "fields") {
    return FIELD_LIST_COPY;
  }

  const tab = FIELD_RUNTIME_TABS.find((candidate) => candidate.key === routeKey);

  if (!tab) {
    return FIELD_LIST_COPY;
  }

  return {
    title: tab.label,
    phase: tab.phase,
    lines: tab.boundaryCopy,
  };
}

export function buildCanonicalFieldRuntimePath(
  fieldId: string,
  tab: FieldRuntimeTabDefinition,
): string {
  const safeFieldId = fieldId || "not-selected";

  if (tab.key === "overview") {
    return `/operator/fields/${safeFieldId}`;
  }

  return `/operator/fields/${safeFieldId}/${tab.pathSuffix}`;
}

export function buildFieldRuntimeViewModel(
  routeKey: FieldRuntimeRouteKey,
  fieldId: string,
): FieldRuntimeViewModel {
  const safeFieldId = fieldId || "not-selected";
  const activeTab = routeKey === "fields" ? null : routeKey;
  const tab = FIELD_RUNTIME_TABS.find((candidate) => candidate.key === routeKey) || FIELD_RUNTIME_TABS[0];
  const currentRoute = routeKey === "fields" ? "/operator/fields" : buildCanonicalFieldRuntimePath(safeFieldId, tab);

  return {
    fieldId: safeFieldId,
    activeTab,
    routeKey,
    currentRoute,
    sourceRouteFamily: "canonical_operator_field_runtime",
    runtimeMode: "Replay-backed Demo",
    readOnly: true,
    tabs: FIELD_RUNTIME_TABS,
    routeCopy: findTabCopy(routeKey),
  };
}
