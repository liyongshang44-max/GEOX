// apps/web/src/features/operator/pilotReadiness/OperatorPilotPage.tsx
// Purpose: render Pilot Readiness as a local read-only product surface.

import React from "react";
import { buildPilotReadinessViewModel, type PilotReadinessRow } from "./pilotReadinessViewModel";
import "../../../styles/operatorPilotReadiness.css";

type TablePanelProps = {
  title: string;
  rows: PilotReadinessRow[];
  className: string;
};

function TablePanel({ title, rows, className }: TablePanelProps): React.ReactElement {
  return (
    <section className={"operatorPilotReadiness__panel " + className}>
      <div className="operatorPilotReadiness__panelHeader">
        <p className="operatorPilotReadiness__eyebrow">{title}</p>
        <h2>{title}</h2>
      </div>
      <div className="operatorPilotReadiness__table" role="table" aria-label={title}>
        <div className="operatorPilotReadiness__tableHeader" role="row"><span>Label</span><span>Value</span></div>
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
  const vm = React.useMemo(() => buildPilotReadinessViewModel(), []);
  return (
    <main className="operatorPilotReadiness" data-h63="pilot-readiness-product-surface" data-source={vm.source} data-mode={vm.mode}>
      <section className="operatorPilotReadiness__hero" aria-label="Pilot Readiness hero">
        <p className="operatorPilotReadiness__eyebrow">Pilot Readiness</p>
        <h1>Pilot Readiness</h1>
        <p className="operatorPilotReadiness__lead">Controlled pilot readiness review for planning and readiness gates.</p>
        <dl className="operatorPilotReadiness__meta"><div><dt>Route</dt><dd>{vm.route}</dd></div><div><dt>Source</dt><dd>{vm.source}</dd></div><div><dt>Mode</dt><dd>{vm.mode}</dd></div><div><dt>Read-only</dt><dd>true</dd></div></dl>
      </section>
      <section className="operatorPilotReadiness__grid" aria-label="Pilot Readiness panels">
        <TablePanel title="Pilot Planning Gate" rows={vm.p53Rows} className="operatorPilotReadiness__p53" />
        <TablePanel title="Readiness Review Gate" rows={vm.p54Rows} className="operatorPilotReadiness__p54" />
        <TablePanel title="Candidate Site Scope" rows={siteScopeRows} className="operatorPilotReadiness__siteScope" />
        <TablePanel title="Evidence Protocol" rows={evidenceProtocolRows} className="operatorPilotReadiness__evidenceProtocol" />
        <TablePanel title="Device / Gateway Readiness Plan" rows={deviceGatewayRows} className="operatorPilotReadiness__deviceGateway" />
        <TablePanel title="Human Role Matrix" rows={roleRows} className="operatorPilotReadiness__roles" />
        <TablePanel title="Safety / Stop Rules and Rollback Plan" rows={safetyRows} className="operatorPilotReadiness__safetyRollback" />
        <TablePanel title="Go / No-Go Gate" rows={goNoGoRows} className="operatorPilotReadiness__goNoGo" />
        <TablePanel title="Readiness Dimensions" rows={vm.readinessRows} className="operatorPilotReadiness__readiness" />
        <TablePanel title="Capability Matrix" rows={vm.capabilityRows} className="operatorPilotReadiness__capability" />
        <TablePanel title="Traceability" rows={vm.traceabilityRows} className="operatorPilotReadiness__traceability" />
        <TablePanel title="Boundary / Nonclaims" rows={vm.boundaryRows} className="operatorPilotReadiness__boundary" />
        <TablePanel title="Next Allowed Gate" rows={vm.nextRows} className="operatorPilotReadiness__nextGate" />
      </section>
    </main>
  );
}
