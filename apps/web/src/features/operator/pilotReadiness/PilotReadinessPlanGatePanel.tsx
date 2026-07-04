// apps/web/src/features/operator/pilotReadiness/PilotReadinessPlanGatePanel.tsx
// Purpose: render P53 required plan sections.

import React from "react";
import { type PilotReadinessProductViewModel } from "./pilotReadinessViewModel";

type Props = { vm: PilotReadinessProductViewModel };

export default function PilotReadinessPlanGatePanel({ vm }: Props): React.ReactElement {
  return (
    <section className="operatorPilotReadiness__panel operatorPilotReadiness__planGate" aria-label="Pilot Planning Gate">
      <div className="operatorPilotReadiness__panelHeader"><p className="operatorPilotReadiness__eyebrow">Pilot Planning Gate</p><h2>Pilot Planning Gate</h2></div>
      <div className="operatorPilotReadiness__table"><div className="operatorPilotReadiness__tableHeader"><span>Required Plan Section</span><span>Status</span></div>{vm.planSections.map((row) => <div className="operatorPilotReadiness__tableRow" key={row.label}><span>{row.label}</span><span>{row.value}</span></div>)}</div>
      <p>candidate site scope</p><p>evidence protocol</p><p>device / gateway readiness</p><p>human roles</p><p>safety / stop rules</p><p>rollback</p><p>entry / exit gates</p><p>go / no-go gate</p><p>limitations</p><p>traceability</p><p>nonclaims</p>
    </section>
  );
}
