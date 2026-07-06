// apps/web/src/features/operator/pilotReadiness/OperatorPilotPage.tsx
// Purpose: render Pilot Readiness as a local read-only product surface.
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
import { localizedText, useLocale, type LocaleCode } from "../../../lib/locale";
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

function TablePanel({ title, rows, className }: TablePanelProps): React.ReactElement {
  return (
    <ProductSectionCard title={title} subtitle="Read-only readiness review packet section." className={className}>
      <ProductDataTable<PilotReadinessRow>
        caption={title}
        rows={rows}
        getRowKey={(row) => row.label}
        mobileFallbackNote="Scroll horizontally to review readiness metadata."
        columns={[
          { key: "label", header: "Label", render: (row) => row.label },
          { key: "value", header: "Value", render: (row) => row.value },
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
  return (
    <ProductPageShell
      surface="operator"
      width="wide"
      ariaLabel="Operator Pilot Readiness review"
      className="operatorPilotReadiness operatorProductSurface"
      top={
        <ProductPageHeader
          eyebrow={localizedText(pilotCopy.eyebrow, locale)}
          title={localizedText(pilotCopy.title, locale)}
          lead={localizedText(pilotCopy.lead, locale)}
          metadata={`Route: ${vm.route} / Source: ${vm.source} / Mode: ${vm.mode}`}
          nonclaim="Readiness review only. Field Pilot: Not started. Controlled Execution: Disabled."
        />
      }
      aside={
        <ProductSectionCard title="Pilot readiness nonclaims" subtitle="Planning packet only.">
          <div className="operatorProductStatusStack">
            <ProductStatusBadge status="disabled" label="Field Pilot: Not started" />
            <ProductStatusBadge status="disabled" label="Controlled Execution: Disabled" />
            <ProductStatusBadge status="disabled" label="AO-ACT: Disabled" />
            <ProductStatusBadge status="readOnly" label="Readiness review only" />
          </div>
        </ProductSectionCard>
      }
    >
      <ProductBoundaryBanner
        tone="disabled"
        title="Readiness review is not field execution"
        description="Pilot Readiness summarizes planning criteria, blocked states, and review packet metadata."
        items={["Field Pilot: Not started", "Controlled Execution: Disabled", "AO-ACT: Disabled"]}
      />
      <ProductScopeBar surface="operator" items={[{ label: "Route", value: vm.route }, { label: "Source", value: vm.source }, { label: "Mode", value: vm.mode }, { label: "Read-only", value: "true" }]} />
      <div className="operatorProductMetricGrid">
        <ProductMetricTile label="Readiness sections" value={13} description="Planning, safety, role, traceability, and boundary sections." source="pilotReadinessViewModel" status={<ProductStatusBadge status="readOnly" />} />
        <ProductMetricTile label="Controlled execution" value="Disabled" description="Displayed as a nonclaim." source="Pilot readiness boundary" status={<ProductStatusBadge status="disabled" />} />
        <ProductMetricTile label="Field pilot" value="Not started" description="Displayed as a nonclaim." source="Pilot readiness boundary" status={<ProductStatusBadge status="disabled" />} />
      </div>
      <section className="operatorPilotReadiness__hero" aria-label={localizedText(pilotCopy.title, locale)}>
        <div className="operatorPilotReadiness__nonclaims" aria-label={locale === "en-US" ? "Pilot Readiness nonclaims" : "试点准备度否定声明"}>
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
        <TablePanel title="Go / No-Go Gate" rows={goNoGoRows} className="operatorPilotReadiness__goNoGo" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.readinessStatus, locale)} rows={vm.readinessRows} className="operatorPilotReadiness__readiness" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.capabilityMatrix, locale)} rows={vm.capabilityRows} className="operatorPilotReadiness__capability" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.traceability, locale)} rows={vm.traceabilityRows} className="operatorPilotReadiness__traceability" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.boundaryNonclaims, locale)} rows={vm.boundaryRows} className="operatorPilotReadiness__boundary" locale={locale} />
        <TablePanel title={localizedText(pilotCopy.panels.nextAllowedGate, locale)} rows={vm.nextRows} className="operatorPilotReadiness__nextGate" locale={locale} />
      </section>
    </ProductPageShell>
  );
}
