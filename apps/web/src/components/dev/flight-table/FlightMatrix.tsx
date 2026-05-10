import React from "react";
import type { FlightTableRunV1 } from "../../../api/flightTable";
import type { FlightTableDecisionRunResultV1 } from "../../../api/flightTableDecision";
import type { FlightTableOperationRunResultV1 } from "../../../api/flightTableOperation";
import { flightTableStepStatusLabel } from "../../../viewmodels/flightTableVm";

type Props = {
  run: FlightTableRunV1 | null;
  decisionResult: FlightTableDecisionRunResultV1 | null;
  operationResult: FlightTableOperationRunResultV1 | null;
  onRetryStep: (stepKey: string) => void;
  onRunDecision: () => void;
  onRunOperation: () => void;
  loading: boolean;
  decisionLoading: boolean;
  operationLoading: boolean;
  decisionError: string | null;
  operationError: string | null;
};

function DecisionDrawer({ result, onClose }: { result: FlightTableDecisionRunResultV1; onClose: () => void }): React.ReactElement {
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

function OperationDrawer({ result, onClose }: { result: FlightTableOperationRunResultV1; onClose: () => void }): React.ReactElement {
  return (
    <aside className="flight-decision-drawer flight-operation-drawer">
      <div className="flight-card-head">
        <h3>F 层详情：Operation · AO-ACT · Receipt</h3>
        <button type="button" onClick={onClose}>关闭</button>
      </div>
      <dl className="flight-field-state">
        <dt>operation_plan_id</dt><dd>{result.operation_plan_id}</dd>
        <dt>operation_id</dt><dd>{result.operation_id}</dd>
        <dt>act_task_id</dt><dd>{result.act_task_id}</dd>
        <dt>dispatch_status</dt><dd>{result.dispatch_status}</dd>
        <dt>receipt_id</dt><dd>{result.receipt_id}</dd>
        <dt>receipt_status</dt><dd>{result.receipt_status}</dd>
        <dt>as_executed_status</dt><dd>{result.as_executed_status}</dd>
        <dt>as_applied_status</dt><dd>{result.as_applied_status}</dd>
        <dt>worklist_visible</dt><dd>{result.worklist_visible ? "YES" : "NO"}</dd>
        <dt>receipt_is_acceptance</dt><dd>{String(result.receipt_is_acceptance)}</dd>
      </dl>
      <section className="flight-decision-contract">
        <h4>UI replay links</h4>
        <p><a href={result.customer_operation_url} target="_blank" rel="noreferrer">{result.customer_operation_url}</a></p>
        <p><a href={result.operator_dispatch_url} target="_blank" rel="noreferrer">{result.operator_dispatch_url}</a></p>
      </section>
      <details open>
        <summary>planned_vs_actual_summary</summary>
        <pre className="flight-json">{JSON.stringify(result.planned_vs_actual_summary ?? {}, null, 2)}</pre>
      </details>
      <p className="flight-muted">receipt success 只表示执行回执已提交，不等于 acceptance pass。验收通过必须由后续 acceptance/evidence 评估产生。</p>
    </aside>
  );
}

export default function FlightMatrix({
  run,
  decisionResult,
  operationResult,
  onRetryStep,
  onRunDecision,
  onRunOperation,
  loading,
  decisionLoading,
  operationLoading,
  decisionError,
  operationError,
}: Props): React.ReactElement {
  const [decisionDrawerOpen, setDecisionDrawerOpen] = React.useState(false);
  const [operationDrawerOpen, setOperationDrawerOpen] = React.useState(false);
  return (
    <section className="flight-card">
      <div className="flight-card-head">
        <h2>A-I 链路矩阵</h2>
        <span>{run?.current_step ? `当前：${run.current_step}` : "未开始"}</span>
      </div>
      <div className="flight-actions flight-card-actions">
        <button type="button" onClick={onRunDecision} disabled={loading || decisionLoading || !run}>运行 E 层：推荐 / 处方 / 审批</button>
        <button type="button" onClick={onRunOperation} disabled={loading || operationLoading || !run}>运行 F 层：Operation / AO-ACT / Receipt</button>
        {decisionResult ? <button type="button" onClick={() => setDecisionDrawerOpen(true)}>查看 E 层详情</button> : null}
        {operationResult ? <button type="button" onClick={() => setOperationDrawerOpen(true)}>查看 F 层详情</button> : null}
        {decisionError ? <span className="flight-error-text">{decisionError}</span> : null}
        {operationError ? <span className="flight-error-text">{operationError}</span> : null}
      </div>
      {run ? (
        <div className="flight-matrix">
          {run.steps.map((step) => {
            const isE = step.step_key === "E";
            const isF = step.step_key === "F";
            return (
              <article key={step.step_key} className={`flight-step flight-step-${step.status.toLowerCase()} ${isE ? "flight-step-decision" : ""} ${isF ? "flight-step-operation" : ""}`}>
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
                  {isF && operationResult ? (
                    <dl className="flight-e-layer-inline flight-f-layer-inline">
                      <dt>operation</dt><dd>{operationResult.operation_plan_id}</dd>
                      <dt>task</dt><dd>{operationResult.act_task_id}</dd>
                      <dt>dispatch</dt><dd>{operationResult.dispatch_status}</dd>
                      <dt>receipt</dt><dd>{operationResult.receipt_status}</dd>
                      <dt>as-executed</dt><dd>{operationResult.as_executed_status}</dd>
                    </dl>
                  ) : null}
                </div>
                <div>
                  <em>{flightTableStepStatusLabel(step.status)}</em>
                  {isE && decisionResult ? <button type="button" onClick={() => setDecisionDrawerOpen(true)}>详情</button> : null}
                  {isF && operationResult ? <button type="button" onClick={() => setOperationDrawerOpen(true)}>详情</button> : null}
                  <button type="button" onClick={() => onRetryStep(step.step_key)} disabled={loading}>重试</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="flight-muted">创建 run 后显示 A-I 链路矩阵。</p>
      )}
      {decisionDrawerOpen && decisionResult ? <DecisionDrawer result={decisionResult} onClose={() => setDecisionDrawerOpen(false)} /> : null}
      {operationDrawerOpen && operationResult ? <OperationDrawer result={operationResult} onClose={() => setOperationDrawerOpen(false)} /> : null}
    </section>
  );
}
