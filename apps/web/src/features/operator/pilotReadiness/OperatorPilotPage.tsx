// apps/web/src/features/operator/pilotReadiness/OperatorPilotPage.tsx
// Purpose: render Pilot Readiness as a local read-only product surface.

import React from "react";
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

function TablePanel({ title, rows, className, locale }: TablePanelProps): React.ReactElement {
  return (
    <section className={"operatorPilotReadiness__panel " + className}>
      <div className="operatorPilotReadiness__panelHeader">
        <p className="operatorPilotReadiness__eyebrow">{title}</p>
        <h2>{title}</h2>
      </div>
      <div className="operatorPilotReadiness__table" role="table" aria-label={title}>
        <div className="operatorPilotReadiness__tableHeader" role="row"><span>{localizedText(pilotCopy.table.label, locale)}</span><span>{localizedText(pilotCopy.table.value, locale)}</span></div>
        {rows.map((row) => <div className="operatorPilotReadiness__tableRow" role="row" key={row.label}><span>{row.label}</span><span>{row.value}</span></div>)}
      </div>
    </section>
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
    <main className="operatorPilotReadiness" data-h63="pilot-readiness-product-surface" data-source={vm.source} data-mode={vm.mode}>
      <section className="operatorPilotReadiness__hero" aria-label={localizedText(pilotCopy.title, locale)}>
        <p className="operatorPilotReadiness__eyebrow">{localizedText(pilotCopy.eyebrow, locale)}</p>
        <h1>{localizedText(pilotCopy.title, locale)}</h1>
        <p className="operatorPilotReadiness__lead">{localizedText(pilotCopy.lead, locale)}</p>
        <div className="operatorPilotReadiness__nonclaims" aria-label={locale === "en-US" ? "Pilot Readiness nonclaims" : "试点准备度否定声明"}>
          {pilotCopy.nonclaims.map((item) => <span key={item.en}>{localizedText(item, locale)}</span>)}
        </div>
        <dl className="operatorPilotReadiness__meta"><div><dt>Route</dt><dd>{vm.route}</dd></div><div><dt>Source</dt><dd>{vm.source}</dd></div><div><dt>Mode</dt><dd>{vm.mode}</dd></div><div><dt>Read-only</dt><dd>true</dd></div></dl>
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
    </main>
  );
}
