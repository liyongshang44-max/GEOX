// apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx
// Purpose: render the Field Runtime product shell, boundary banner, tabs, migrated read-only content through H62, and static future-tab body.
// Boundary: this layout owns presentation only.

import React from "react";
import FieldRuntimeAuditTabPanel from "./FieldRuntimeAuditTabPanel";
import FieldRuntimeBoundaryBanner from "./FieldRuntimeBoundaryBanner";
import FieldRuntimeCalibrationTabPanel from "./FieldRuntimeCalibrationTabPanel";
import FieldRuntimeCoverageSummaryPanel from "./FieldRuntimeCoverageSummaryPanel";
import FieldRuntimeDataGapPanel from "./FieldRuntimeDataGapPanel";
import FieldRuntimeEvidenceSummaryPanel from "./FieldRuntimeEvidenceSummaryPanel";
import FieldRuntimeEvidenceTabPanel from "./FieldRuntimeEvidenceTabPanel";
import FieldRuntimeForecastTabPanel from "./FieldRuntimeForecastTabPanel";
import FieldRuntimeHealthTabPanel from "./FieldRuntimeHealthTabPanel";
import FieldRuntimeOverviewPanel from "./FieldRuntimeOverviewPanel";
import FieldRuntimeReadOnlyBoundaryPanel from "./FieldRuntimeReadOnlyBoundaryPanel";
import FieldRuntimeResidualTabPanel from "./FieldRuntimeResidualTabPanel";
import FieldRuntimeScenarioTabPanel from "./FieldRuntimeScenarioTabPanel";
import FieldRuntimeStatePanel from "./FieldRuntimeStatePanel";
import FieldRuntimeTabs from "./FieldRuntimeTabs";
import FieldRuntimeTabStub from "./FieldRuntimeTabStub";
import { FIELD_RUNTIME_CANONICAL_ROUTE_FAMILY, FIELD_RUNTIME_LEGACY_ROUTE_FAMILY } from "./runtimeNonclaims";
import { type FieldRuntimeAuditLoadState } from "./fieldRuntimeAuditAdapter";
import { type FieldRuntimeCalibrationLoadState } from "./fieldRuntimeCalibrationAdapter";
import { type FieldRuntimeEvidenceLoadState } from "./fieldRuntimeEvidenceAdapter";
import { type FieldRuntimeForecastLoadState } from "./fieldRuntimeForecastAdapter";
import { type FieldRuntimeHealthLoadState } from "./fieldRuntimeHealthAdapter";
import { type FieldRuntimeResidualLoadState } from "./fieldRuntimeResidualAdapter";
import { type FieldRuntimeScenarioLoadState } from "./fieldRuntimeScenarioAdapter";
import { type FieldRuntimeViewModel } from "./fieldRuntimeViewModel";
import { type FieldRuntimeWorkspaceLoadState } from "./fieldRuntimeWorkspaceAdapter";
import "../../../styles/operatorFieldRuntime.css";

type FieldRuntimeLayoutProps = {
  viewModel: FieldRuntimeViewModel;
  workspaceLoadState?: FieldRuntimeWorkspaceLoadState;
  evidenceLoadState?: FieldRuntimeEvidenceLoadState;
  forecastLoadState?: FieldRuntimeForecastLoadState;
  scenarioLoadState?: FieldRuntimeScenarioLoadState;
  residualLoadState?: FieldRuntimeResidualLoadState;
  calibrationLoadState?: FieldRuntimeCalibrationLoadState;
  auditLoadState?: FieldRuntimeAuditLoadState;
  healthLoadState?: FieldRuntimeHealthLoadState;
};

function FieldRuntimeOverviewContent({ loadState }: { loadState: FieldRuntimeWorkspaceLoadState | undefined }): React.ReactElement {
  return <div className="operatorFieldRuntime__contentGrid" data-h60d="overview-state-content"><FieldRuntimeOverviewPanel loadState={loadState} /><FieldRuntimeStatePanel loadState={loadState} mode="summary" /><FieldRuntimeEvidenceSummaryPanel loadState={loadState} /><FieldRuntimeCoverageSummaryPanel loadState={loadState} /><FieldRuntimeDataGapPanel loadState={loadState} /><FieldRuntimeReadOnlyBoundaryPanel loadState={loadState} /></div>;
}

function FieldRuntimeStateContent({ loadState }: { loadState: FieldRuntimeWorkspaceLoadState | undefined }): React.ReactElement {
  return <div className="operatorFieldRuntime__contentGrid" data-h60d="state-content"><FieldRuntimeStatePanel loadState={loadState} mode="full" /><FieldRuntimeEvidenceSummaryPanel loadState={loadState} /><FieldRuntimeReadOnlyBoundaryPanel loadState={loadState} /></div>;
}

function renderTabContent(viewModel: FieldRuntimeViewModel, workspaceLoadState: FieldRuntimeWorkspaceLoadState | undefined, evidenceLoadState: FieldRuntimeEvidenceLoadState | undefined, forecastLoadState: FieldRuntimeForecastLoadState | undefined, scenarioLoadState: FieldRuntimeScenarioLoadState | undefined, residualLoadState: FieldRuntimeResidualLoadState | undefined, calibrationLoadState: FieldRuntimeCalibrationLoadState | undefined, auditLoadState: FieldRuntimeAuditLoadState | undefined, healthLoadState: FieldRuntimeHealthLoadState | undefined): React.ReactElement {
  if (viewModel.routeKey === "overview") return <FieldRuntimeOverviewContent loadState={workspaceLoadState} />;
  if (viewModel.routeKey === "state") return <FieldRuntimeStateContent loadState={workspaceLoadState} />;
  if (viewModel.routeKey === "evidence") return <FieldRuntimeEvidenceTabPanel loadState={evidenceLoadState} />;
  if (viewModel.routeKey === "forecast") return <FieldRuntimeForecastTabPanel loadState={forecastLoadState} />;
  if (viewModel.routeKey === "scenario") return <FieldRuntimeScenarioTabPanel loadState={scenarioLoadState} />;
  if (viewModel.routeKey === "residual") return <FieldRuntimeResidualTabPanel loadState={residualLoadState} />;
  if (viewModel.routeKey === "calibration") return <FieldRuntimeCalibrationTabPanel loadState={calibrationLoadState} />;
  if (viewModel.routeKey === "audit") return <FieldRuntimeAuditTabPanel loadState={auditLoadState} />;
  if (viewModel.routeKey === "health") return <FieldRuntimeHealthTabPanel loadState={healthLoadState} />;
  return <FieldRuntimeTabStub viewModel={viewModel} />;
}

export default function FieldRuntimeLayout({ viewModel, workspaceLoadState, evidenceLoadState, forecastLoadState, scenarioLoadState, residualLoadState, calibrationLoadState, auditLoadState, healthLoadState }: FieldRuntimeLayoutProps): React.ReactElement {
  return (
    <main className="operatorFieldRuntime" data-h60c="field-runtime-layout-tabs" data-h60d="field-runtime-overview-state" data-h60e="field-runtime-evidence-tab" data-h60f="field-runtime-forecast-tab" data-h60g="field-runtime-scenario-readonly-split" data-h60h="field-runtime-residual-verification-tab" data-h60i="field-runtime-calibration-tab" data-h60k="field-runtime-audit-tab" data-h62="runtime-health-product-surface" data-field-runtime-route={viewModel.routeKey}>
      <header className="operatorFieldRuntime__header" aria-label="Field Runtime header"><div><p className="operatorFieldRuntime__eyebrow">Field Runtime</p><h1 className="operatorFieldRuntime__title">Field Runtime</h1><p className="operatorFieldRuntime__subtitle">地块运行视图</p></div><dl className="operatorFieldRuntime__meta" aria-label="Field Runtime route identity"><div><dt>Field ID</dt><dd>{viewModel.fieldId}</dd></div><div><dt>Current route</dt><dd>{viewModel.currentRoute}</dd></div><div><dt>Runtime Mode</dt><dd>{viewModel.runtimeMode}</dd></div><div><dt>Read-only boundary</dt><dd>{viewModel.readOnly ? "true" : "false"}</dd></div></dl></header>
      <FieldRuntimeBoundaryBanner />
      <section className="operatorFieldRuntime__routeNotice" aria-label="Field Runtime route ownership"><span>{FIELD_RUNTIME_CANONICAL_ROUTE_FAMILY}</span><span>{FIELD_RUNTIME_LEGACY_ROUTE_FAMILY}</span></section>
      <FieldRuntimeTabs viewModel={viewModel} />
      <section className="operatorFieldRuntime__tabPanel" aria-label="Field Runtime tab panel">{renderTabContent(viewModel, workspaceLoadState, evidenceLoadState, forecastLoadState, scenarioLoadState, residualLoadState, calibrationLoadState, auditLoadState, healthLoadState)}</section>
    </main>
  );
}
