// apps/web/src/features/operator/pilotReadiness/PilotReadinessGateSummaryPanel.tsx
// Purpose: render P53/P54 gate summary.

import React from "react";
import { type PilotKeyValue, type PilotReadinessProductViewModel } from "./pilotReadinessViewModel";

type Props = { vm: PilotReadinessProductViewModel };

function Rows({ rows }: { rows: PilotKeyValue[] }): React.ReactElement {
  return <>{rows.map((row) => <div className="operatorPilotReadiness__tableRow" key={row.label}><span>{row.label}</span><span>{row.value}</span></div>)}</>;
}

export default function PilotReadinessGateSummaryPanel({ vm }: Props): React.ReactElement {
  return (
    <section className="operatorPilotReadiness__panel operatorPilotReadiness__gateSummary" aria-label="Gate Summary">
      <div className="operatorPilotReadiness__panelHeader"><p className="operatorPilotReadiness__eyebrow">Gate Summary</p><h2>Gate Summary</h2></div>
      <div className="operatorPilotReadiness__table"><div className="operatorPilotReadiness__tableHeader"><span>Label</span><span>Value</span></div><Rows rows={[...vm.p53Rows, ...vm.p54Rows, ...vm.gateRows]} /></div>
    </section>
  );
}
