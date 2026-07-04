// apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts
// Purpose: provide the Field Runtime ViewModel contract for layout, tabs, route identity, boundary copy, and migrated read-only tab states through H60-H.
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

export const FIELD_RUNTIME_TABS: FieldRuntimeTabDefinition[] = [
  {
    key: "overview",
    label: "Overview",
    pathSuffix: "",
    status: "available",
    phase: "H60-D workspace-derived overview",
    boundaryCopy: [
      "Overview content is derived from the existing read-only Operator Field Twin workspace.",
      "No facts are written.",
      "No recommendation is created.",
      "No dispatch or AO-ACT task is created.",
    ],
  },
  {
    key: "evidence",
    label: "Evidence",
    pathSuffix: "evidence",
    status: "available",
    phase: "H60-E evidence quality tab",
    boundaryCopy: [
      "Evidence content is derived from the existing read-only Operator Field Twin evidence quality read model.",
      "Full Evidence trace is displayed for review only.",
      "No facts are written.",
      "No recommendation is created.",
      "No approval / dispatch / AO-ACT task is created.",
    ],
  },
  {
    key: "state",
    label: "State",
    pathSuffix: "state",
    status: "available",
    phase: "H60-D workspace-derived state",
    boundaryCopy: [
      "State content is derived from the existing read-only Operator Field Twin workspace.",
      "This shell does not generate state estimates.",
    ],
  },
  {
    key: "forecast",
    label: "Forecast",
    pathSuffix: "forecast",
    status: "available",
    phase: "H60-F forecast tab",
    boundaryCopy: [
      "Forecast content is derived from the existing read-only Operator Field Twin forecast panel.",
      "Forecast window is displayed for review only.",
      "Forecast is not a recommendation.",
      "Forecast does not create task.",
      "Forecast does not imply action.",
      "No scenario comparison is performed.",
      "No approval / dispatch / AO-ACT task is created.",
    ],
  },
  {
    key: "scenario",
    label: "Scenario",
    pathSuffix: "scenario",
    status: "available",
    phase: "H60-G scenario read-only review",
    boundaryCopy: [
      "Scenario content is derived from the existing read-only Operator Field Twin scenario compare read model.",
      "Scenario Review is displayed for comparison only.",
      "Scenario is not a recommendation.",
      "Scenario does not create recommendation.",
      "Scenario does not create task.",
      "Scenario does not imply action.",
      "No scenario submission exists in canonical Field Runtime.",
      "No approval / dispatch / AO-ACT task is created.",
      "Legacy scenario submission, if needed, remains isolated under /operator/twin/fields/:fieldId/scenarios.",
    ],
  },
  {
    key: "residual",
    label: "Residual",
    pathSuffix: "residual",
    status: "available",
    phase: "H60-H residual verification tab",
    boundaryCopy: [
      "Residual content is derived from the existing read-only Operator Field Twin post-irrigation verification read model.",
      "Residual / Verification is displayed for review only.",
      "Residual is not causal proof.",
      "Residual does not write ROI.",
      "Residual does not write Field Memory.",
      "Residual does not create recommendation.",
      "Residual does not create task.",
      "No approval / dispatch / AO-ACT task is created.",
      "Downstream candidate flags are metadata only.",
    ],
  },
  {
    key: "calibration",
    label: "Calibration",
    pathSuffix: "calibration",
    status: "limited",
    phase: "reserved for H60-I",
    boundaryCopy: [
      "Calibration route is reserved for H60-I.",
      "Calibration Review is read-only.",
      "No model update.",
      "No Field Memory write.",
    ],
  },
  {
    key: "health",
    label: "Health",
    pathSuffix: "health",
    status: "not_enabled",
    phase: "planned for H62",
    boundaryCopy: [
      "Health route is reserved for H62.",
      "Runtime Health product surface is planned for H62.",
      "This tab does not claim production monitoring.",
    ],
  },
  {
    key: "audit",
    label: "Audit",
    pathSuffix: "audit",
    status: "limited",
    phase: "reserved for H60-K",
    boundaryCopy: [
      "Audit route is reserved for H60-K.",
      "Audit can show refs and contracts later, but does not create product conclusions.",
    ],
  },
];

const FIELD_LIST_COPY: FieldRuntimeRouteCopy = {
  title: "Field Runtime List",
  phase: "H60-D list route remains unbound",
  lines: [
    "Field Runtime list route is not field-scoped yet.",
    "Select a field before opening Overview, State, or other Field Runtime tabs.",
    "No field list data is loaded in H60-D.",
  ],
};

function findTabCopy(routeKey: FieldRuntimeRouteKey): FieldRuntimeRouteCopy {
  if (routeKey === "fields") return FIELD_LIST_COPY;
  const tab = FIELD_RUNTIME_TABS.find((candidate) => candidate.key === routeKey);
  if (!tab) return FIELD_LIST_COPY;
  return {
    title: tab.label,
    phase: tab.phase,
    lines: tab.boundaryCopy,
  };
}

export function buildCanonicalFieldRuntimePath(fieldId: string, tab: FieldRuntimeTabDefinition): string {
  const safeFieldId = fieldId || "not-selected";
  if (tab.key === "overview") return `/operator/fields/${safeFieldId}`;
  return `/operator/fields/${safeFieldId}/${tab.pathSuffix}`;
}

export function buildFieldRuntimeViewModel(routeKey: FieldRuntimeRouteKey, fieldId: string): FieldRuntimeViewModel {
  const safeFieldId = fieldId || "not-selected";
  const activeTab = routeKey === "fields" ? null : routeKey;
  const currentRoute = routeKey === "fields" ? "/operator/fields" : buildCanonicalFieldRuntimePath(safeFieldId, FIELD_RUNTIME_TABS.find((tab) => tab.key === routeKey) || FIELD_RUNTIME_TABS[0]);

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
