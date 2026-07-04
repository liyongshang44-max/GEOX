// apps/web/src/features/operator/pilotReadiness/OperatorPilotReadinessPage.tsx
// Purpose: compose the H63 read-only Pilot Readiness product surface.
// Boundary: local metadata only; no backend call and no write surface.

import React from "react";
import PilotReadinessCapabilityPanel from "./PilotReadinessCapabilityPanel";
import PilotReadinessGateSummaryPanel from "./PilotReadinessGateSummaryPanel";
import PilotReadinessHero from "./PilotReadinessHero";
import PilotReadinessPlanGatePanel from "./PilotReadinessPlanGatePanel";
import PilotReadinessReviewGatePanel from "./PilotReadinessReviewGatePanel";
import { buildPilotReadinessViewModel, type PilotKeyValue } from "./pilotReadinessViewModel";
import "../../../styles/operatorPilotReadiness.css";

function ListPanel({ className, title, lines }: { className: string; title: string; lines: string[] }): React.ReactElement {
  return <section className={"operatorPilotReadiness__panel " + className}><div className="operatorPilotReadiness__panelHeader"><p className="operatorPilotReadiness__eyebrow">{title}</p><h2>{title}</h2></div><ul className="operatorPilotReadiness__list">{lines.map((line) => <li key={line}>{line}</li>)}</ul></section>;
}

function TablePanel({ className, title, rows }: { className: string; title: string; rows: PilotKeyValue[] }): React.ReactElement {
  return <section className={"operatorPilotReadiness__panel " + className}><div className="operatorPilotReadiness__panelHeader"><p className="operatorPilotReadiness__eyebrow">{title}</p><h2>{title}</h2></div><div className="operatorPilotReadiness__table"><div className="operatorPilotReadiness__tableHeader"><span>Label</span><span>Value</span></div>{rows.map((row) => <div className="operatorPilotReadiness__tableRow" key={row.label}><span>{row.label}</span><span>{row.value}</span></div>)}</div></section>;
}

export default function OperatorPilotReadinessPage(): React.ReactElement {
  const vm = React.useMemo(() => buildPilotReadinessViewModel(), []);
  const planLines = ["Candidate Site Scope is planning metadata, not active pilot site.", "Evidence Protocol is a collection plan, not live telemetry ingest.", "Device / Gateway Readiness Plan is a plan artifact.", "Human roles are responsibility definitions.", "Safety / Stop Rules", "Rollback Plan", "Manual stop authority", "No autonomous execution", "Go / No-Go Gate is a review gate, not a launch button."];
  return (
    <main className="operatorPilotReadiness" data-h63="pilot-readiness-product-surface" data-source={vm.source} data-mode={vm.mode}>
      <PilotReadinessHero vm={vm} />
      <PilotReadinessGateSummaryPanel vm={vm} />
      <PilotReadinessPlanGatePanel vm={vm} />
      <PilotReadinessReviewGatePanel vm={vm} />
      <PilotReadinessCapabilityPanel />
      <section className="operatorPilotReadiness__grid" aria-label="Pilot Readiness sections">
        <ListPanel className="operatorPilotReadiness__siteScope" title="Candidate Site Scope" lines={[planLines[0]]} />
        <ListPanel className="operatorPilotReadiness__evidenceProtocol" title="Evidence Protocol" lines={[planLines[1]]} />
        <ListPanel className="operatorPilotReadiness__deviceGateway" title="Device / Gateway Readiness Plan" lines={[planLines[2], "It does not deploy real devices.", "It does not bring production gateway online."]} />
        <ListPanel className="operatorPilotReadiness__roles" title="Human Role Matrix" lines={[planLines[3], "They do not assign live tasks.", "They do not create AO-ACT records."]} />
        <ListPanel className="operatorPilotReadiness__safetyRollback" title="Safety / Stop Rules" lines={[planLines[4], planLines[5], planLines[6], planLines[7]]} />
        <ListPanel className="operatorPilotReadiness__goNoGo" title="Go / No-Go Gate" lines={[planLines[8], "It is not a dispatch action."]} />
        <TablePanel className="operatorPilotReadiness__traceability" title="Traceability" rows={vm.traceabilityRows} />
        <TablePanel className="operatorPilotReadiness__nonclaims" title="Nonclaims" rows={vm.nonclaims} />
        <ListPanel className="operatorPilotReadiness__boundary" title="Boundary" lines={vm.boundaryLines} />
        <TablePanel className="operatorPilotReadiness__boundary" title="Next Allowed Gate" rows={vm.nextGateRows} />
      </section>
    </main>
  );
}
