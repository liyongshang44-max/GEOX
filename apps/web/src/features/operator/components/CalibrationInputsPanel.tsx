import React from "react";
import type { OperatorCalibrationInputs } from "../../../api/operatorTwin";

export default function CalibrationInputsPanel({ inputs }: { inputs: OperatorCalibrationInputs }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="CalibrationInputs">
      <p className="operatorEyebrow">calibration_inputs_v1</p>
      <h3>Calibration Inputs</h3>
      <ul className="operatorList">
        <li>prediction_sources: {inputs.prediction_sources.length}</li>
        <li>execution_sources: {inputs.execution_sources.length}</li>
        <li>outcome_sources: {inputs.outcome_sources.length}</li>
        <li>evidence_quality_refs: {inputs.evidence_quality_refs.join(", ") || "none"}</li>
      </ul>
    </article>
  );
}
