// apps/web/src/features/operator/pilotReadiness/OperatorPilotPage.tsx
// Purpose: render Pilot Readiness as a bilingual local read-only product surface.
// Boundary: this page is readiness review only.

import React from "react";
import {
  ProductBoundaryBanner,
  ProductDataTable,
  ProductMetricTile,
  ProductPageHeader,
  ProductPageShell,
  ProductScopeBar,
  ProductSectionCard,
  ProductStatusBadge,
} from "../../../design-system/product";
import { localizedText, useLocale, type LocaleCode, type LocalizedCopy } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";
import { buildPilotReadinessViewModel, type PilotReadinessRow } from "./pilotReadinessViewModel";
import "../../../styles/operatorPilotReadiness.css";

type TablePanelProps = {
  title: string;
  rows: PilotReadinessRow[];
  className: string;
  locale: LocaleCode;
};

const pilotCopy = OPERATOR_FORMAL_SURFACE_COPY.pilotReadiness;
const COPY = {
  pageAria: { zh: "操作员试点准备度审查", en: "Operator Pilot Readiness review" },
  route: { zh: "路由", en: "Route" },
  source: { zh: "来源", en: "Source" },
  mode: { zh: "模式", en: "Mode" },
  readOnly: { zh: "只读", en: "Read-only" },
  readinessOnly: { zh: "仅准备度审查。田间试点未开始，受控执行已禁用。", en: "Readiness review only. Field Pilot Not Started. Controlled Execution: Disabled." },
  nonclaimsTitle: { zh: "试点准备度否定声明", en: "Pilot Readiness Nonclaims" },
  planningOnly: { zh: "仅规划资料包。", en: "Planning packet only." },
  fieldPilotNotStarted: { zh: "田间试点未开始", en: "Field Pilot Not Started" },
  controlledExecutionDisabled: { zh: "受控执行：已禁用", en: "Controlled Execution: Disabled" },
  aoActDisabled: { zh: "AO-ACT：已禁用", en: "AO-ACT: Disabled" },
  reviewOnly: { zh: "仅准备度审查", en: "Readiness Review Only" },
  boundaryTitle: { zh: "准备度审查不是田间执行", en: "Readiness Review Is Not Field Execution" },
  boundaryDescription: { zh: "试点准备度汇总规划条件、阻断状态和审查资料元数据。", en: "Pilot Readiness summarizes planning criteria, blocked states, and review-packet metadata." },
  sectionSubtitle: { zh: "只读准备度审查资料区段。", en: "Read-only readiness review packet section." },
  mobileNote: { zh: "在窄屏中可横向滚动查看准备度元数据。", en: "On narrow screens, scroll horizontally to review readiness metadata." },
  label: { zh: "标签", en: "Label" },
  value: { zh: "值", en: "Value" },
  readinessSections: { zh: "准备度区段", en: "Readiness Sections" },
  readinessSectionsLead: { zh: "规划、安全、角色、可追溯性和边界区段。", en: "Planning, safety, role, traceability, and boundary sections." },
  controlledExecution: { zh: "受控执行", en: "Controlled Execution" },
  disabled: { zh: "已禁用", en: "Disabled" },
  displayedNonclaim: { zh: "作为否定声明展示。", en: "Displayed as a nonclaim." },
  fieldPilot: { zh: "田间试点", en: "Field Pilot" },
  notStarted: { zh: "未开始", en: "Not Started" },
  goNoGo: { zh: "放行 / 不放行门禁", en: "Go / No-Go Gate" },
  viewModelSource: { zh: "试点准备度视图模型", en: "Pilot Readiness View Model" },
  boundarySource: { zh: "试点准备度边界", en: "Pilot Readiness Boundary" },
} as const satisfies Record<string, LocalizedCopy>;

const ROW_LABELS: Record<string, LocalizedCopy> = {
  "Candidate Site Scope": { zh: "候选地块范围", en: "Candidate Site Scope" },
  "Active site": { zh: "活动地块", en: "Active Site" },
  "Evidence Protocol": { zh: "证据协议", en: "Evidence Protocol" },
  "Live ingest": { zh: "实时接入", en: "Live Ingest" },
  "Device / Gateway Readiness Plan": { zh: "设备 / 网关准备计划", en: "Device / Gateway Readiness Plan" },
  "Online claim": { zh: "在线声明", en: "Online Claim" },
  "Human Role Matrix": { zh: "人员角色矩阵", en: "Human Role Matrix" },
  "Live assignment": { zh: "实时指派", en: "Live Assignment" },
  "Safety / Stop Rules": { zh: "安全 / 停止规则", en: "Safety / Stop Rules" },
  "Rollback Plan": { zh: "回滚计划", en: "Rollback Plan" },
  "Go / No-Go Gate": { zh: "放行 / 不放行门禁", en: "Go / No-Go Gate" },
  "Launch action": { zh: "启动动作", en: "Launch Action" },
  "Planning result": { zh: "规划结果", en: "Planning Result" },
  "Pilot plan allowed": { zh: "允许试点规划", en: "Pilot Plan Allowed" },
  "Pilot field run allowed": { zh: "允许田间试点运行", en: "Pilot Field Run Allowed" },
  "Readiness review allowed": { zh: "允许准备度审查", en: "Readiness Review Allowed" },
  "Meaning": { zh: "含义", en: "Meaning" },
  "Readiness result": { zh: "准备度结果", en: "Readiness Result" },
  "Runtime health service gate allowed": { zh: "允许运行健康服务门禁", en: "Runtime Health Service Gate Allowed" },
  "Real device deployed": { zh: "真实设备已部署", en: "Real Device Deployed" },
  "Production gateway online": { zh: "生产网关在线", en: "Production Gateway Online" },
  "Next allowed gate": { zh: "下一允许门禁", en: "Next Allowed Gate" },
  "Does not mean": { zh: "不表示", en: "Does Not Mean" },
};

const ROW_VALUES: Record<string, LocalizedCopy> = {
  "planning metadata": { zh: "规划元数据", en: "Planning Metadata" },
  "collection plan": { zh: "采集计划", en: "Collection Plan" },
  "plan artifact": { zh: "计划工件", en: "Plan Artifact" },
  "responsibility definition": { zh: "职责定义", en: "Responsibility Definition" },
  reviewed: { zh: "已审查", en: "Reviewed" },
  "review gate": { zh: "审查门禁", en: "Review Gate" },
  "planning gate only": { zh: "仅规划门禁", en: "Planning Gate Only" },
  available: { zh: "可用", en: "Available" },
  "allowed next": { zh: "下一步允许", en: "Allowed Next" },
  "not allowed": { zh: "不允许", en: "Not Allowed" },
  "field pilot execution": { zh: "田间试点执行", en: "Field Pilot Execution" },
  true: { zh: "是", en: "Yes" },
  false: { zh: "否", en: "No" },
};

function rowText(value: string, locale: LocaleCode, catalog: Record<string, LocalizedCopy>): string {
  return catalog[value] ? localizedText(catalog[value], locale) : value;
}

function TablePanel({ title, rows, className, locale }: TablePanelProps): React.ReactElement {
  const t = (copy: LocalizedCopy) => localizedText(copy, locale);
  return (
    <ProductSectionCard title={title} subtitle={t(COPY.sectionSubtitle)} className={className}>
      <ProductDataTable<PilotReadinessRow>
        caption={title}
        rows={rows}
        getRowKey={(row) => row.label}
        mobileFallbackNote={t(COPY.mobileNote)}
        columns={[
          { key: "label", header: t(COPY.label), render: (row) => rowText(row.label, locale, ROW_LABELS) },
          { key: "value", header: t(COPY.value), render: (row) => rowText(row.value, locale, ROW_VALUES) },
        ]}
      />
    </ProductSectionCard>
  );
}

const siteScopeRows: PilotReadinessRow[] = [
  { label: "Candidate Site Scope", value: "planning metadata" },
  { label: "Active site", value: "false" },
];

const evidenceProtocolRows: PilotReadinessRow[] = [
  { label: "Evidence Protocol", value: "collection plan" },
  { label: "Live ingest", value: "false" },
];

const deviceGatewayRows: PilotReadinessRow[] = [
  { label: "Device / Gateway Readiness Plan", value: "plan artifact" },
  { label: "Online claim", value: "false" },
];

const roleRows: PilotReadinessRow[] = [
  { label: "Human Role Matrix", value: "responsibility definition" },
  { label: "Live assignment", value: "false" },
];

const safetyRows: PilotReadinessRow[] = [
  { label: "Safety / Stop Rules", value: "reviewed" },
  { label: "Rollback Plan", value: "reviewed" },
];

const goNoGoRows: PilotReadinessRow[] = [
  { label: "Go / No-Go Gate", value: "review gate" },
  { label: "Launch action", value: "false" },
];

export default function OperatorPilotPage(): React.ReactElement {
  const { locale } = useLocale();
  const vm = React.useMemo(() => buildPilotReadinessViewModel(), []);
  const t = (copy: LocalizedCopy) => localizedText(copy, locale);
  return (
    <ProductPageShell
      surface="operator"
      width="wide"
      ariaLabel={t(COPY.pageAria)}
      className="operatorPilotReadiness operatorProductSurface"
      top={
        <ProductPageHeader
          eyebrow={localizedText(pilotCopy.eyebrow, locale)}
          title={localizedText(pilotCopy.title, locale)}
          lead={localizedText(pilotCopy.lead, locale)}
          metadata={<>{t(COPY.route)}: <span data-locale-neutral="true">{vm.route}</span> / {t(COPY.source)}: <span data-locale-neutral="true">{vm.source}</span> / {t(COPY.mode)}: <span data-locale-neutral="true">{vm.mode}</span></>}
          nonclaim={t(COPY.readinessOnly)}
        />
      }
      aside={
        <ProductSectionCard title={t(COPY.nonclaimsTitle)} subtitle={t(COPY.planningOnly)}>
          <div className="operatorProductStatusStack">
            <ProductStatusBadge status="disabled" label={t(COPY.fieldPilotNotStarted)} />
            <ProductStatusBadge status="disabled" label={t(COPY.controlledExecutionDisabled)} />
            <ProductStatusBadge status="disabled" label={t(COPY.aoActDisabled)} />
            <ProductStatusBadge status="readOnly" label={t(COPY.reviewOnly)} />
          </div>
        </ProductSectionCard>
      }
    >
      <ProductBoundaryBanner
        tone="disabled"
        title={t(COPY.boundaryTitle)}
        description={t(COPY.boundaryDescription)}
        items={[t(COPY.fieldPilotNotStarted), t(COPY.controlledExecutionDisabled), t(COPY.aoActDisabled)]}
      />
      <ProductScopeBar surface="operator" items={[{ label: t(COPY.route), value: <span data-locale-neutral="true">{vm.route}</span> }, { label: t(COPY.source), value: <span data-locale-neutral="true">{vm.source}</span> }, { label: t(COPY.mode), value: <span data-locale-neutral="true">{vm.mode}</span> }, { label: t(COPY.readOnly), value: t(ROW_VALUES.true) }]} />
      <div className="operatorProductMetricGrid">
        <ProductMetricTile label={t(COPY.readinessSections)} value={13} description={t(COPY.readinessSectionsLead)} source={t(COPY.viewModelSource)} status={<ProductStatusBadge status="readOnly" />} />
        <ProductMetricTile label={t(COPY.controlledExecution)} value={t(COPY.disabled)} description={t(COPY.displayedNonclaim)} source={t(COPY.boundarySource)} status={<ProductStatusBadge status="disabled" />} />
        <ProductMetricTile label={t(COPY.fieldPilot)} value={t(COPY.notStarted)} description={t(COPY.displayedNonclaim)} source={t(COPY.boundarySource)} status={<ProductStatusBadge status="disabled" />} />
      </div>
      <section className="operatorPilotReadiness__hero" aria-label={localizedText(pilotCopy.title, locale)}>
        <div className="operatorPilotReadiness__nonclaims" aria-label={t(COPY.nonclaimsTitle)}>
          {pilotCopy.nonclaims.map((item) => <span key={item.en}>{localizedText(item, locale)}</span>)}
        </div>
      </section>
      <section className="operatorPilotReadiness__grid" aria-label={localizedText(pilotCopy.panelsAria, locale)}>
        <TablePanel title={localizedText(pilotCopy.panels.planningGate, locale)} rows={vm.p53Rows} className="operatorPilotReadiness__p53" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.readinessGate, locale)} rows={vm.p54Rows} className="operatorPilotReadiness__p54" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.candidateSite, locale)} rows={siteScopeRows} className="operatorPilotReadiness__siteScope" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.evidenceProtocol, locale)} rows={evidenceProtocolRows} className="operatorPilotReadiness__evidenceProtocol" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.deviceGateway, locale)} rows={deviceGatewayRows} className="operatorPilotReadiness__deviceGateway" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.humanRole, locale)} rows={roleRows} className="operatorPilotReadiness__roles" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.safetyStopRules, locale) + " / " + localizedText(pilotCopy.panels.rollback, locale)} rows={safetyRows} className="operatorPilotReadiness__safetyRollback" locale={locale} />
        <TablePanel title={t(COPY.goNoGo)} rows={goNoGoRows} className="operatorPilotReadiness__goNoGo" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.readinessStatus, locale)} rows={vm.readinessRows} className="operatorPilotReadiness__readiness" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.capabilityMatrix, locale)} rows={vm.capabilityRows} className="operatorPilotReadiness__capability" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.traceability, locale)} rows={vm.traceabilityRows} className="operatorPilotReadiness__traceability" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.boundaryNonclaims, locale)} rows={vm.boundaryRows} className="operatorPilotReadiness__boundary" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.nextAllowedGate, locale)} rows={vm.nextRows} className="operatorPilotReadiness__nextGate" locale={locale} />
      </section>
    </ProductPageShell>
  );
}
