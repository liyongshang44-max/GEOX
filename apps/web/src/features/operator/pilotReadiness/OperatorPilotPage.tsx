// apps/web/src/features/operator/pilotReadiness/OperatorPilotPage.tsx
import React from "react";
import { buildPilotReadinessViewModel } from "./pilotReadinessViewModel";
import "../../../styles/operatorPilotReadiness.css";

export default function OperatorPilotPage(): React.ReactElement {
  const vm = React.useMemo(() => buildPilotReadinessViewModel(), []);
  return <main className="operatorPilotReadiness" data-h63="pilot-readiness-product-surface"><h1>Pilot Readiness</h1><p>{vm.source}</p><p>{vm.mode}</p></main>;
}
