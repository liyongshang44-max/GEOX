import React from "react";
import type { FlightTableRunV1 } from "../../../api/flightTable";
import { flightTableStepStatusLabel } from "../../../viewmodels/flightTableVm";

type Props = {
  run: FlightTableRunV1 | null;
  onRetryStep: (stepKey: string) => void;
  loading: boolean;
};

export default function FlightMatrix({ run, onRetryStep, loading }: Props): React.ReactElement {
  return (
    <section className="flight-card">
      <div className="flight-card-head">
        <h2>A-I 链路矩阵</h2>
        <span>{run?.current_step ? `当前：${run.current_step}` : "未开始"}</span>
      </div>
      {run ? (
        <div className="flight-matrix">
          {run.steps.map((step) => (
            <article key={step.step_key} className={`flight-step flight-step-${step.status.toLowerCase()}`}>
              <div>
                <strong>{step.step_key}</strong>
                <span>{step.label}</span>
              </div>
              <div>
                <em>{flightTableStepStatusLabel(step.status)}</em>
                <button type="button" onClick={() => onRetryStep(step.step_key)} disabled={loading}>重试</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="flight-muted">创建 run 后显示 A-I 链路矩阵。</p>
      )}
    </section>
  );
}
