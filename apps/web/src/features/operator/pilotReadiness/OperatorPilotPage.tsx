// apps/web/src/features/operator/pilotReadiness/OperatorPilotPage.tsx
// Purpose: render H63 Pilot Readiness as a local read-only product surface.

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

export default function OperatorPilotPage(): React.ReactElement {
  const vm = React.useMemo(() => buildPilotReadinessViewModel(), []);
  return (
    <main className="operatorPilotReadiness" data-h63="pilot-readiness-product-surface" data-source={vm.source} data-mode={vm.mode}>
      <section className="operatorPilotReadiness__hero" aria-label="Pilot Readiness hero">
        <p className="operatorPilotReadiness__eyebrow">Pilot Readiness</p>
        <h1>Pilot Readiness</h1>
        <p className="operatorPilotReadiness__lead">Controlled pilot readiness review for P53/P54 planning and readiness gates.</p>
        <dl className="operatorPilotReadiness__meta"><div><dt>Route</dt><dd>{vm.route}</dd></div><div><dt>Source</dt><dd>{vm.source}</dd></div><div><dt>Mode</dt><dd>{vm.mode}</dd></div><div><dt>Read-only</dt><dd>true</dd></div></dl>
      </section>
      <section className="operatorPilotReadiness__grid" aria-label="Pilot Readiness panels">
        <TablePanel title="P53 Pilot Planning Gate" rows={vm.p53Rows} className="operatorPilotReadiness__p53" />
        <TablePanel title="P54 Readiness Review Gate" rows={vm.p54Rows} className="operatorPilotReadiness__p54" />
        <TablePanel title="Readiness Dimensions" rows={vm.readinessRows} className="operatorPilotReadiness__readiness" />
        <TablePanel title="Capability Matrix" rows={vm.capabilityRows} className="operatorPilotReadiness__capability" />
        <TablePanel title="Traceability" rows={vm.traceabilityRows} className="operatorPilotReadiness__traceability" />
        <TablePanel title="Boundary / Nonclaims" rows={vm.boundaryRows} className="operatorPilotReadiness__boundary" />
        <TablePanel title="Next Allowed Gate" rows={vm.nextRows} className="operatorPilotReadiness__nextGate" />
      </section>
    </main>
  );
}
