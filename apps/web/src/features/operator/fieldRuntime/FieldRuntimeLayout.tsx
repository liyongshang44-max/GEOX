// apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx
// Purpose: render the Field Runtime product shell, boundary banner, tabs, and read-only content.
// Boundary: this layout owns presentation only and does not create runtime actions or mutate read models.

import React from "react";
import { Link } from "react-router-dom";
import {
  ProductBoundaryBanner,
  ProductDataTable,
  ProductEmptyState,
  ProductMetricTile,
  ProductPageHeader,
  ProductPageShell,
  ProductScopeBar,
  ProductSectionCard,
  ProductStatusBadge,
} from "../../../design-system/product";
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
import { buildCanonicalFieldRuntimePath, type FieldRuntimeTabDefinition, type FieldRuntimeViewModel } from "./fieldRuntimeViewModel";
import { type FieldRuntimeWorkspaceLoadState } from "./fieldRuntimeWorkspaceAdapter";
import { localizedText, useLocale } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";
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

type RenderTabContentArgs = {
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

type FieldRuntimeEntryRow = {
  fieldId: string;
  fieldName: string;
  summary: string;
};

const fieldCopy = OPERATOR_FORMAL_SURFACE_COPY.fieldRuntime;
const FIELD_RUNTIME_ENTRY_ROWS: FieldRuntimeEntryRow[] = [
  { fieldId: "field_c8_demo", fieldName: "C8 Demo Field", summary: "Replay-backed field runtime entry for CI and product review." },
  { fieldId: "field_runtime_review_sample", fieldName: "Runtime Review Sample", summary: "No-field-selected safe entry demonstrating tab navigation only." },
];

function FieldRuntimeOverviewContent({ loadState }: { loadState: FieldRuntimeWorkspaceLoadState | undefined }): React.ReactElement {
  return (
    <div className="operatorFieldRuntime__contentGrid" data-h60d="overview-state-content">
      <FieldRuntimeOverviewPanel loadState={loadState} />
      <FieldRuntimeStatePanel loadState={loadState} mode="summary" />
      <FieldRuntimeEvidenceSummaryPanel loadState={loadState} />
      <FieldRuntimeCoverageSummaryPanel loadState={loadState} />
      <FieldRuntimeDataGapPanel loadState={loadState} />
      <FieldRuntimeReadOnlyBoundaryPanel loadState={loadState} />
    </div>
  );
}

function FieldRuntimeStateContent({ loadState }: { loadState: FieldRuntimeWorkspaceLoadState | undefined }): React.ReactElement {
  return (
    <div className="operatorFieldRuntime__contentGrid" data-h60d="state-content">
      <FieldRuntimeStatePanel loadState={loadState} mode="full" />
      <FieldRuntimeEvidenceSummaryPanel loadState={loadState} />
      <FieldRuntimeReadOnlyBoundaryPanel loadState={loadState} />
    </div>
  );
}

function FieldRuntimeEntrySurface({ viewModel }: { viewModel: FieldRuntimeViewModel }): React.ReactElement {
  return (
    <ProductSectionCard title="Field Runtime entry" subtitle="Field selector and canonical runtime review tab entry. This is not field management.">
      <ProductBoundaryBanner
        tone="readOnly"
        title="Field Runtime selector boundary"
        description="Select a field to review state, evidence, forecast, scenario, residual, calibration, health, and audit surfaces. Create/edit field controls are not available here."
        items={["No field management controls", "Not live monitoring", "Read-only field runtime navigation"]}
      />
      <ProductDataTable<FieldRuntimeEntryRow>
        caption="Operator field runtime entries"
        rows={FIELD_RUNTIME_ENTRY_ROWS}
        getRowKey={(row) => row.fieldId}
        emptyState={<ProductEmptyState title="No field runtime entries" description="No field runtime review entries are available." />}
        mobileFallbackNote="Scroll horizontally to review field runtime entry links."
        columns={[
          { key: "field", header: "Field", render: (row) => <><strong>{row.fieldName}</strong><br /><small>{row.fieldId}</small></> },
          { key: "summary", header: "Review context", render: (row) => row.summary },
          { key: "overview", header: "Overview", render: (row) => <Link to={buildCanonicalFieldRuntimePath(row.fieldId, viewModel.tabs[0])}>Open overview</Link> },
          { key: "state", header: "State", render: (row) => <Link to={buildCanonicalFieldRuntimePath(row.fieldId, viewModel.tabs[2])}>Review state</Link> },
          { key: "evidence", header: "Evidence", render: (row) => <Link to={buildCanonicalFieldRuntimePath(row.fieldId, viewModel.tabs[1])}>Review evidence</Link> },
        ]}
      />
    </ProductSectionCard>
  );
}

function renderTabContent({
  viewModel,
  workspaceLoadState,
  evidenceLoadState,
  forecastLoadState,
  scenarioLoadState,
  residualLoadState,
  calibrationLoadState,
  auditLoadState,
  healthLoadState,
}: RenderTabContentArgs): React.ReactElement {
  if (viewModel.routeKey === "fields") return <FieldRuntimeEntrySurface viewModel={viewModel} />;
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

function routeBoundaryLabel(tab: FieldRuntimeTabDefinition | undefined, routeKey: string): string {
  if (routeKey === "forecast") return "Forecast review is not a recommendation.";
  if (routeKey === "scenario") return "Scenario review is not dispatch or task creation.";
  if (routeKey === "residual") return "Verification review is not ROI proof or causal proof.";
  if (routeKey === "calibration") return "Calibration review is not model update.";
  if (routeKey === "health") return "Health review is not live monitoring.";
  if (routeKey === "audit") return "Audit readback is not a business conclusion.";
  if (routeKey === "state") return "State review does not mean online estimation is active.";
  if (routeKey === "evidence") return "Evidence review is not evidence writing.";
  if (routeKey === "fields") return "Field Runtime entry is not field management.";
  return tab?.boundaryCopy[0] ?? "Read-only runtime review surface.";
}

export default function FieldRuntimeLayout({
  viewModel,
  workspaceLoadState,
  evidenceLoadState,
  forecastLoadState,
  scenarioLoadState,
  residualLoadState,
  calibrationLoadState,
  auditLoadState,
  healthLoadState,
}: FieldRuntimeLayoutProps): React.ReactElement {
  const { locale } = useLocale();
  const activeTab = viewModel.tabs.find((tab) => tab.key === viewModel.activeTab) ?? null;

  return (
    <ProductPageShell
      surface="operator"
      width="wide"
      ariaLabel="Operator Field Runtime review surface"
      className="operatorFieldRuntime operatorProductSurface"
      top={
        <ProductPageHeader
          eyebrow={localizedText(fieldCopy.eyebrow, locale)}
          title={localizedText(fieldCopy.title, locale)}
          lead={localizedText(fieldCopy.subtitle, locale)}
          metadata={`Route: ${viewModel.currentRoute} / Mode: ${viewModel.runtimeMode}`}
          nonclaim="Read-only review only. Live Device: Not connected. Production Gateway: Not online. Controlled Execution: Disabled."
        />
      }
      aside={
        <ProductSectionCard title="Field Runtime nonclaims" subtitle="Tab navigation exposes review surfaces only.">
          <div className="operatorProductStatusStack">
            <ProductStatusBadge status="readOnly" label="Read-only" />
            <ProductStatusBadge status="replayBacked" label="Replay-backed" />
            <ProductStatusBadge status="notConnected" label="Live Device: Not connected" />
            <ProductStatusBadge status="notOnline" label="Production Gateway: Not online" />
            <ProductStatusBadge status="disabled" label="Controlled Execution: Disabled" />
          </div>
        </ProductSectionCard>
      }
    >
      <ProductBoundaryBanner
        tone="readOnly"
        title={routeBoundaryLabel(activeTab ?? undefined, viewModel.routeKey)}
        description="Operator Field Runtime surfaces support view, review, inspect, compare, navigate, read trace, and read source identity. They do not mutate facts, models, ledgers, memory, or execution systems."
        items={["No task creation", "No device control", "No model update"]}
      />

      <ProductScopeBar
        surface="operator"
        items={[
          { label: "Field", value: viewModel.fieldId },
          { label: "Current route", value: viewModel.currentRoute },
          { label: "Route family", value: viewModel.sourceRouteFamily },
          { label: "Read-only", value: viewModel.readOnly ? "true" : "false" },
        ]}
      />

      <div className="operatorProductMetricGrid">
        <ProductMetricTile label="Runtime mode" value={viewModel.runtimeMode} source="Field Runtime route model" status={<ProductStatusBadge status="replayBacked" />} />
        <ProductMetricTile label="Active tab" value={viewModel.activeTab ?? "Field selector"} description={routeBoundaryLabel(activeTab ?? undefined, viewModel.routeKey)} source="canonical_operator_field_runtime" />
        <ProductMetricTile label="Tab count" value={viewModel.tabs.length} description="Separate productized field runtime review surfaces." source="Field Runtime route model" />
      </div>

      <FieldRuntimeBoundaryBanner />

      <section className="operatorFieldRuntime__routeNotice" aria-label={localizedText(fieldCopy.routeOwnership, locale)}>
        <span>{FIELD_RUNTIME_CANONICAL_ROUTE_FAMILY}</span>
        <span>{FIELD_RUNTIME_LEGACY_ROUTE_FAMILY}</span>
      </section>

      <FieldRuntimeTabs viewModel={viewModel} />

      <ProductSectionCard title={viewModel.routeCopy.title} subtitle={viewModel.routeCopy.phase} status={<ProductStatusBadge status="readOnly" label="Review only" />}>
        <section className="operatorFieldRuntime__tabPanel" aria-label={localizedText(fieldCopy.tabPanel, locale)}>
          {renderTabContent({ viewModel, workspaceLoadState, evidenceLoadState, forecastLoadState, scenarioLoadState, residualLoadState, calibrationLoadState, auditLoadState, healthLoadState })}
        </section>
      </ProductSectionCard>
    </ProductPageShell>
  );
}
