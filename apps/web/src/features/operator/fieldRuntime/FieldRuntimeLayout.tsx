// apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx
// Purpose: render the bilingual Field Runtime shell, boundary, tabs, and read-only content.
// Boundary: this layout owns presentation only and does not create runtime actions or mutate read models.

import React from "react";
import { Link } from "react-router-dom";
import { ProductBoundaryBanner, ProductDataTable, ProductEmptyState, ProductMetricTile, ProductPageHeader, ProductPageShell, ProductScopeBar, ProductSectionCard, ProductStatusBadge } from "../../../design-system/product";
import { localizedText, useLocale, type LocaleCode, type LocalizedCopy } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";
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
import { buildCanonicalFieldRuntimePath, type FieldRuntimeRouteKey, type FieldRuntimeTabDefinition, type FieldRuntimeViewModel } from "./fieldRuntimeViewModel";
import { type FieldRuntimeWorkspaceLoadState } from "./fieldRuntimeWorkspaceAdapter";
import "../../../styles/operatorFieldRuntime.css";

type FieldRuntimeLayoutProps = { viewModel: FieldRuntimeViewModel; workspaceLoadState?: FieldRuntimeWorkspaceLoadState; evidenceLoadState?: FieldRuntimeEvidenceLoadState; forecastLoadState?: FieldRuntimeForecastLoadState; scenarioLoadState?: FieldRuntimeScenarioLoadState; residualLoadState?: FieldRuntimeResidualLoadState; calibrationLoadState?: FieldRuntimeCalibrationLoadState; auditLoadState?: FieldRuntimeAuditLoadState; healthLoadState?: FieldRuntimeHealthLoadState };
type RenderArgs = FieldRuntimeLayoutProps;
type EntryRow = { fieldId: string; fieldName: string; summary: LocalizedCopy };

const fieldCopy = OPERATOR_FORMAL_SURFACE_COPY.fieldRuntime;
const COPY = {
  aria: { zh: "Operator 地块运行审查界面", en: "Operator Field Runtime review surface" },
  metadataRoute: { zh: "路由", en: "Route" },
  metadataMode: { zh: "模式", en: "Mode" },
  nonclaim: { zh: "仅只读审查。实时设备未连接，生产网关未上线，受控执行已禁用。", en: "Read-only review only. Live Device: Not connected. Production Gateway: Not online. Controlled Execution: Disabled." },
  nonclaimTitle: { zh: "地块运行否定声明", en: "Field Runtime Nonclaims" },
  nonclaimLead: { zh: "标签导航只开放审查界面。", en: "Tab navigation exposes review surfaces only." },
  entryTitle: { zh: "地块运行入口", en: "Field Runtime Entry" },
  entryLead: { zh: "选择地块并进入规范运行审查标签；这不是地块管理。", en: "Select a field and enter canonical runtime review tabs; this is not field management." },
  selectorBoundary: { zh: "地块运行选择边界", en: "Field Runtime Selector Boundary" },
  selectorLead: { zh: "选择地块后可审查状态、证据、预测、情景、残差、校准、健康和审计；本页不提供创建、编辑或控制。", en: "Select a field to review state, evidence, forecast, scenario, residual, calibration, health, and audit; create, edit, and control are unavailable." },
  noFieldControls: { zh: "无地块管理控制", en: "No Field Management Controls" },
  notLive: { zh: "非实时监控", en: "Not Live Monitoring" },
  readOnlyNav: { zh: "只读地块运行导航", en: "Read-only Field Runtime Navigation" },
  entries: { zh: "Operator 地块运行条目", en: "Operator Field Runtime Entries" },
  noEntries: { zh: "暂无地块运行条目", en: "No Field Runtime Entries" },
  noEntriesLead: { zh: "当前没有可用的地块运行审查条目。", en: "No field runtime review entry is available." },
  mobileNote: { zh: "在窄屏中可横向滚动查看地块运行入口。", en: "On narrow screens, scroll horizontally to review field runtime entries." },
  field: { zh: "地块", en: "Field" },
  reviewContext: { zh: "审查上下文", en: "Review Context" },
  openOverview: { zh: "打开总览", en: "Open Overview" },
  reviewState: { zh: "审查状态", en: "Review State" },
  reviewEvidence: { zh: "审查证据", en: "Review Evidence" },
  routeSurfaceLead: { zh: "当前规范路由的只读产品审查界面。", en: "Read-only product review surface for the current canonical route." },
  noTask: { zh: "不创建任务", en: "No Task Creation" },
  noDevice: { zh: "不控制设备", en: "No Device Control" },
  noModel: { zh: "不更新模型", en: "No Model Update" },
  fieldLabel: { zh: "地块", en: "Field" },
  routeLabel: { zh: "当前路由", en: "Current Route" },
  familyLabel: { zh: "路由族", en: "Route Family" },
  readOnlyLabel: { zh: "只读", en: "Read-only" },
  runtimeMode: { zh: "运行模式", en: "Runtime Mode" },
  activeTab: { zh: "当前标签", en: "Active Tab" },
  selector: { zh: "地块选择器", en: "Field Selector" },
  tabCount: { zh: "标签数量", en: "Tab Count" },
  tabCountLead: { zh: "相互独立的产品化地块运行审查界面。", en: "Separate productized Field Runtime review surfaces." },
  routeModel: { zh: "地块运行路由模型", en: "Field Runtime Route Model" },
  reviewOnly: { zh: "仅审查", en: "Review Only" },
} as const satisfies Record<string, LocalizedCopy>;

const ENTRY_ROWS: EntryRow[] = [
  { fieldId: "field_c8_demo", fieldName: "C8 Demo Field", summary: { zh: "用于 CI 与产品审查的回放支撑地块运行入口。", en: "Replay-backed Field Runtime entry for CI and product review." } },
  { fieldId: "field_runtime_review_sample", fieldName: "Runtime Review Sample", summary: { zh: "仅演示标签导航的未选择地块安全入口。", en: "No-field-selected safe entry demonstrating tab navigation only." } },
];

function routeBoundary(key: FieldRuntimeRouteKey): LocalizedCopy {
  const copy: Record<FieldRuntimeRouteKey, LocalizedCopy> = {
    fields: { zh: "地块运行入口不是地块管理。", en: "Field Runtime entry is not field management." },
    overview: { zh: "只读运行审查界面。", en: "Read-only runtime review surface." },
    state: { zh: "状态审查不表示在线估计已经启用。", en: "State review does not mean online estimation is active." },
    evidence: { zh: "证据审查不是证据写入。", en: "Evidence review is not evidence writing." },
    forecast: { zh: "预测审查不是建议。", en: "Forecast review is not a recommendation." },
    scenario: { zh: "情景审查不是派发或任务创建。", en: "Scenario review is not dispatch or task creation." },
    residual: { zh: "残差审查不是 ROI 或因果证明。", en: "Residual review is not ROI or causal proof." },
    calibration: { zh: "校准审查不修改模型状态。", en: "Calibration review does not update model state." },
    health: { zh: "健康审查不是实时监控。", en: "Health review is not live monitoring." },
    audit: { zh: "审计回查不是业务结论。", en: "Audit readback is not a business conclusion." },
  };
  return copy[key];
}

function Overview({ loadState }: { loadState?: FieldRuntimeWorkspaceLoadState }) { return <div className="operatorFieldRuntime__contentGrid"><FieldRuntimeOverviewPanel loadState={loadState} /><FieldRuntimeStatePanel loadState={loadState} mode="summary" /><FieldRuntimeEvidenceSummaryPanel loadState={loadState} /><FieldRuntimeCoverageSummaryPanel loadState={loadState} /><FieldRuntimeDataGapPanel loadState={loadState} /><FieldRuntimeReadOnlyBoundaryPanel loadState={loadState} /></div>; }
function State({ loadState }: { loadState?: FieldRuntimeWorkspaceLoadState }) { return <div className="operatorFieldRuntime__contentGrid"><FieldRuntimeStatePanel loadState={loadState} mode="full" /><FieldRuntimeEvidenceSummaryPanel loadState={loadState} /><FieldRuntimeReadOnlyBoundaryPanel loadState={loadState} /></div>; }

function Entry({ viewModel, locale }: { viewModel: FieldRuntimeViewModel; locale: LocaleCode }) {
  const t = (copy: LocalizedCopy) => localizedText(copy, locale);
  return <ProductSectionCard title={t(COPY.entryTitle)} subtitle={t(COPY.entryLead)}><ProductBoundaryBanner tone="readOnly" title={t(COPY.selectorBoundary)} description={t(COPY.selectorLead)} items={[t(COPY.noFieldControls), t(COPY.notLive), t(COPY.readOnlyNav)]} /><ProductDataTable<EntryRow> caption={t(COPY.entries)} rows={ENTRY_ROWS} getRowKey={(row) => row.fieldId} emptyState={<ProductEmptyState surface="operator" title={t(COPY.noEntries)} description={t(COPY.noEntriesLead)} />} mobileFallbackNote={t(COPY.mobileNote)} columns={[
    { key: "field", header: t(COPY.field), render: (row) => <><strong>{row.fieldName}</strong><br /><small>{row.fieldId}</small></> },
    { key: "summary", header: t(COPY.reviewContext), render: (row) => t(row.summary) },
    { key: "overview", header: localizedText(fieldCopy.tabs.overview, locale), render: (row) => <Link to={buildCanonicalFieldRuntimePath(row.fieldId, viewModel.tabs[0])}>{t(COPY.openOverview)}</Link> },
    { key: "state", header: localizedText(fieldCopy.tabs.state, locale), render: (row) => <Link to={buildCanonicalFieldRuntimePath(row.fieldId, viewModel.tabs[2])}>{t(COPY.reviewState)}</Link> },
    { key: "evidence", header: localizedText(fieldCopy.tabs.evidence, locale), render: (row) => <Link to={buildCanonicalFieldRuntimePath(row.fieldId, viewModel.tabs[1])}>{t(COPY.reviewEvidence)}</Link> },
  ]} /></ProductSectionCard>;
}

function content(props: RenderArgs, locale: LocaleCode): React.ReactElement {
  const vm = props.viewModel;
  if (vm.routeKey === "fields") return <Entry viewModel={vm} locale={locale} />;
  if (vm.routeKey === "overview") return <Overview loadState={props.workspaceLoadState} />;
  if (vm.routeKey === "state") return <State loadState={props.workspaceLoadState} />;
  if (vm.routeKey === "evidence") return <FieldRuntimeEvidenceTabPanel loadState={props.evidenceLoadState} />;
  if (vm.routeKey === "forecast") return <FieldRuntimeForecastTabPanel loadState={props.forecastLoadState} />;
  if (vm.routeKey === "scenario") return <FieldRuntimeScenarioTabPanel loadState={props.scenarioLoadState} />;
  if (vm.routeKey === "residual") return <FieldRuntimeResidualTabPanel loadState={props.residualLoadState} />;
  if (vm.routeKey === "calibration") return <FieldRuntimeCalibrationTabPanel loadState={props.calibrationLoadState} />;
  if (vm.routeKey === "audit") return <FieldRuntimeAuditTabPanel loadState={props.auditLoadState} />;
  if (vm.routeKey === "health") return <FieldRuntimeHealthTabPanel loadState={props.healthLoadState} />;
  return <FieldRuntimeTabStub viewModel={vm} />;
}

export default function FieldRuntimeLayout(props: FieldRuntimeLayoutProps): React.ReactElement {
  const { locale } = useLocale();
  const t = (copy: LocalizedCopy) => localizedText(copy, locale);
  const vm = props.viewModel;
  const activeTab = vm.tabs.find((tab) => tab.key === vm.activeTab) as FieldRuntimeTabDefinition | undefined;
  const activeLabel = activeTab ? localizedText(fieldCopy.tabs[activeTab.key], locale) : t(COPY.selector);

  return <ProductPageShell surface="operator" width="wide" ariaLabel={t(COPY.aria)} className="operatorFieldRuntime operatorProductSurface" top={<ProductPageHeader eyebrow={localizedText(fieldCopy.eyebrow, locale)} title={localizedText(fieldCopy.title, locale)} lead={localizedText(fieldCopy.subtitle, locale)} metadata={`${t(COPY.metadataRoute)}: ${vm.currentRoute} / ${t(COPY.metadataMode)}: ${vm.runtimeMode}`} nonclaim={t(COPY.nonclaim)} />} aside={<ProductSectionCard title={t(COPY.nonclaimTitle)} subtitle={t(COPY.nonclaimLead)}><div className="operatorProductStatusStack"><ProductStatusBadge status="readOnly" /><ProductStatusBadge status="replayBacked" /><ProductStatusBadge status="notConnected" label={localizedText(fieldCopy.nonclaims[1], locale)} /><ProductStatusBadge status="notOnline" label={localizedText(fieldCopy.nonclaims[2], locale)} /><ProductStatusBadge status="disabled" label={localizedText(fieldCopy.nonclaims[4], locale)} /></div></ProductSectionCard>}>
    <ProductBoundaryBanner tone="readOnly" title={t(routeBoundary(vm.routeKey))} description={t(COPY.routeSurfaceLead)} items={[t(COPY.noTask), t(COPY.noDevice), t(COPY.noModel)]} />
    <ProductScopeBar surface="operator" items={[{ label: t(COPY.fieldLabel), value: vm.fieldId }, { label: t(COPY.routeLabel), value: vm.currentRoute }, { label: t(COPY.familyLabel), value: vm.sourceRouteFamily }, { label: t(COPY.readOnlyLabel), value: vm.readOnly ? "true" : "false" }]} />
    <div className="operatorProductMetricGrid"><ProductMetricTile label={t(COPY.runtimeMode)} value={vm.runtimeMode} source={t(COPY.routeModel)} status={<ProductStatusBadge status="replayBacked" />} /><ProductMetricTile label={t(COPY.activeTab)} value={activeLabel} description={t(routeBoundary(vm.routeKey))} source="canonical_operator_field_runtime" /><ProductMetricTile label={t(COPY.tabCount)} value={vm.tabs.length} description={t(COPY.tabCountLead)} source={t(COPY.routeModel)} /></div>
    <FieldRuntimeBoundaryBanner />
    <section className="operatorFieldRuntime__routeNotice" aria-label={localizedText(fieldCopy.routeOwnership, locale)}><span>{FIELD_RUNTIME_CANONICAL_ROUTE_FAMILY}</span><span>{FIELD_RUNTIME_LEGACY_ROUTE_FAMILY}</span></section>
    <FieldRuntimeTabs viewModel={vm} />
    <ProductSectionCard title={localizedText(fieldCopy.tabs[vm.routeKey], locale)} subtitle={t(COPY.routeSurfaceLead)} status={<ProductStatusBadge status="readOnly" label={t(COPY.reviewOnly)} />}><section className="operatorFieldRuntime__tabPanel" aria-label={localizedText(fieldCopy.tabPanel, locale)}>{content(props, locale)}</section></ProductSectionCard>
  </ProductPageShell>;
}
