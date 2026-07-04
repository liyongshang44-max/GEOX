// apps/web/src/features/operator/pilotReadiness/PilotReadinessReviewGatePanel.tsx
import React from "react";
import { type PilotReadinessProductViewModel } from "./pilotReadinessViewModel";

type Props = { vm: PilotReadinessProductViewModel };
const lines = ["p55_runtime_health_service_gate.allowed=true", "field_pilot_execution_gate.allowed=false", "full_runtime_freeze_gate.allowed=false"];

export default function PilotReadinessReviewGatePanel({ vm }: Props): React.ReactElement {
  return <section className="operatorPilotReadiness__panel operatorPilotReadiness__reviewGate"><h2>Readiness Review</h2>{vm.readinessDimensions.map((row) => <p key={row.label}>{row.label}: {row.value}</p>)}{lines.map((line) => <p key={line}>{line}</p>)}</section>;
}
