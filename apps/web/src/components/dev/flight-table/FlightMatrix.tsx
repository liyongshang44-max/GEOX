import React from "react";
import type { FlightTableRunV1 } from "../../../api/flightTable";
import type { FlightTableDecisionRunResultV1 } from "../../../api/flightTableDecision";
import { flightTableStepStatusLabel } from "../../../viewmodels/flightTableVm";

type Props = {
  run: FlightTableRunV1 | null;
  decisionResult: FlightTableDecisionRunResultV1 | null;
  onRetryStep: (stepKey: string) => void;
  onRunDecision: () => void;
  loading: boolean;
  decisionLoading: boolean;
  decisionError: string | null;
};

function DetailDrawer({ result, onClose }: { result: FlightTableDecisionRunResultV1; onClose: () => void }): React.ReactElement {
  return (
    <aside className="flight-decision-drawer">
      <div className="flight-card-head">
        <h3>E 层详情：推荐 · 处方 · 审批</h3>
        <button type="button" onClick={onClose}>关闭</button>
      </div>
      <dl className="flight-field-state">
        <dt>recommendation_id</dt><dd>{result.recommendation_id}</dd>
        <dt>prescription_id</dt><dd>{result.prescription_id}</dd>
        <dt>approval_request_id</dt><dd>{result.approval_request_id}</dd>
        <dt>approval_status</dt><dd>{result.approval_status}</dd>
        <dt>operation_plan_id</dt><dd>{result.operation_plan_id ?? "-"}</dd>
      </dl>
      <section className="flight-decision-contract">
        <h4>处方合同回答</h4>
        <dl className="flight-field-state">
          <dt>做什么</dt><dd>{result.contract_answers.what}</dd>
          <dt>在哪做</dt><dd>{result.contract_answers.where}</dd>
          <dt>何时做</dt><dd>{result.contract_answers.when}</dd>
          <dt>做多少</dt><dd>{result.contract_answers.how_much}</dd>
          <dt>谁审批</dt><dd>{result.contract_answers.who_approves}</dd>
          <dt>如何验收</dt><dd>{result.contract_answers.how_to_accept}</dd>
        </dl>
      </section>
      <details open>
        <summary>recommendation explain</summary>
        <pre className="flight-json">{JSON.stringify(result.recommendation_explain ?? {}, null, 2)}</pre>
      </details>
      <details open>
        <summary>prescription summary</summary>
        <pre className="flight-json">{JSON.stringify(result.prescription_summary ?? {}, null, 2)}</pre>
      </details>
      <details>
        <summary>approval audit</summary>
        <pre className="flight-json">{JSON.stringify(result.approval_audit ?? {}, null, 2)}</pre>
      </details>
    </aside>
  );
}

export default function FlightMatrix({ run, decisionResult, onRetryStep, onRunDecision, loading, decisionLoading, decisionError }: Props): React.ReactElement {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  return (
    <section className="flight-card">
      <div className="flight-card-head">
        <h2>A-I 链路矩阵</h2>
        <span>{run?.current_step ? `当前：${run.current_step}` : "未开始"}</span>
      </div>
      <div className="flight-actions flight-card-actions">
        <button type="button" onClick={onRunDecision} disabled={loading || decisionLoading || !run}>运行 E 层：推荐 / 处方 / 审批</button>
        {decisionResult ? <button type="button" onClick={() => setDrawerOpen(true)}>查看 E 层详情</button> : null}
        {decisionError ? <span className="flight-error-text">{decisionError}</span> : null}
      </div>
      {run ? (
        <div className="flight-matrix">
          {run.steps.map((step) => {
            const isE = step.step_key === "E";
            return (
              <article key={step.step_key} className={`flight-step flight-step-${step.status.toLowerCase()} ${isE ? "flight-step-decision" : ""}`}>
                <div>
                  <strong>{step.step_key}</strong>
                  <span>{step.label}</span>
                  {isE && decisionResult ? (
                    <dl className="flight-e-layer-inline">
                      <dt>recommendation</dt><dd>{decisionResult.recommendation_id}</dd>
                      <dt>prescription</dt><dd>{decisionResult.prescription_id}</dd>
                      <dt>approval</dt><dd>{decisionResult.approval_request_id}</dd>
                      <dt>status</dt><dd>{decisionResult.approval_status}</dd>
                    </dl>
                  ) : null}
                </div>
                <div>
                  <em>{flightTableStepStatusLabel(step.status)}</em>
                  {isE && decisionResult ? <button type="button" onClick={() => setDrawerOpen(true)}>详情</button> : null}
                  <button type="button" onClick={() => onRetryStep(step.step_key)} disabled={loading}>重试</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="flight-muted">创建 run 后显示 A-I 链路矩阵。</p>
      )}
      {drawerOpen && decisionResult ? <DetailDrawer result={decisionResult} onClose={() => setDrawerOpen(false)} /> : null}
    </section>
  );
}
