// apps/web/src/features/operator/pilotReadiness/PilotReadinessCapabilityPanel.tsx
import React from "react";

export default function PilotReadinessCapabilityPanel(): React.ReactElement {
  return <section className="operatorPilotReadiness__panel operatorPilotReadiness__capability"><h2>Capability Matrix</h2><p>Planning Gate: available</p><p>Readiness Review Gate: available</p><p>Runtime Health Service Gate: allowed next</p><p>Field Pilot Execution: not allowed</p><p>AO-ACT Task Creation: not allowed</p><p>Dispatch: not allowed</p><p>ROI: not allowed</p><p>Field Memory: not allowed</p><p>Full Runtime v1 Freeze: not allowed</p></section>;
}
