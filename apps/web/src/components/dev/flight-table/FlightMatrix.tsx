import React from "react";
import type { FlightTableRunV1 } from "../../../api/flightTable";
import type { FlightTableDecisionRunResultV1 } from "../../../api/flightTableDecision";
import type { FlightTableEvidenceRunResultV1 } from "../../../api/flightTableEvidence";
import type { FlightTableOperationRunResultV1 } from "../../../api/flightTableOperation";
import type { FlightTableReportLearningRunResultV1 } from "../../../api/flightTableReportLearning";
import { flightTableStepStatusLabel } from "../../../viewmodels/flightTableVm";

type Props = {
  run: FlightTableRunV1 | null;
  decisionResult: FlightTableDecisionRunResultV1 | null;
  operationResult: FlightTableOperationRunResultV1 | null;
  evidenceResult: FlightTableEvidenceRunResultV1 | null;
  reportLearningResult: FlightTableReportLearningRunResultV1 | null;
  onRetryStep: (stepKey: string) => void;
  onRunDecision: () => void;
  onRunOperation: () => void;
  onRunEvidence: () => void;
  onRunReportLearning: () => void;
  loading: boolean;
  decisionLoading: boolean;
  operationLoading: boolean;
  evidenceLoading: boolean;
  reportLearningLoading: boolean;
  decisionError: string | null;
  operationError: string | null;
  evidenceError: string | null;
  reportLearningError: string | null;
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

function EvidenceDrawer({ result, onClose }: { result: FlightTableEvidenceRunResultV1; onClose: () => void }): React.ReactElement {
  return (
    <aside className="flight-decision-drawer flight-evidence-drawer">
      <div className="flight-card-head">
        <h3>G 层详情：Evidence · Acceptance · Export</h3>
        <button type="button" onClick={onClose}>关闭</button>
      </div>
      <dl className="flight-field-state">
        <dt>lane</dt><dd>{result.lane}</dd>
        <dt>operation_id</dt><dd>{result.operation_id}</dd>
        <dt>evidence_status</dt><dd>{result.evidence_status}</dd>
        <dt>acceptance_status</dt><dd>{result.acceptance_status}</dd>
        <dt>final_status</dt><dd>{result.final_status}</dd>
        <dt>evidence_export_job_id</dt><dd>{result.evidence_export_job_id ?? "-"}</dd>
        <dt>raw_export_status</dt><dd>{result.raw_export_status ?? "-"}</dd>
        <dt>normalized_export_status</dt><dd>{result.evidence_export_job_status}</dd>
        <dt>sha256</dt><dd>{result.sha256 ?? "未返回，不伪造"}</dd>
        <dt>learning_excluded</dt><dd>{String(result.learning_excluded)}</dd>
        <dt>by-operation match</dt><dd>{result.evidence_by_operation_match ? "YES" : "NO"}</dd>
      </dl>
      <section className="flight-decision-contract">
        <h4>验收回放链接</h4>
        {result.ui_urls.map((url) => <p key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></p>)}
      </section>
      <details open>
        <summary>operation_report evidence_pack_summary</summary>
        <pre className="flight-json">{JSON.stringify(result.operation_report_evidence_pack_summary ?? {}, null, 2)}</pre>
      </details>
      <p className="flight-muted">sha256 只有后端返回时才展示；无 sha256 时不在前端伪造。证据不足航线不得显示验收通过。</p>
    </aside>
  );
}

function ReportLearningDrawer({ result, onClose }: { result: FlightTableReportLearningRunResultV1; onClose: () => void }): React.ReactElement {
  return (
    <aside className="flight-decision-drawer flight-report-learning-drawer">
      <div className="flight-card-head">
        <h3>H 层详情：Report · Weather · ROI · Field Memory · Learning</h3>
        <button type="button" onClick={onClose}>关闭</button>
      </div>
      <dl className="flight-field-state">
        <dt>operation report</dt><dd>{result.operation_report_ready ? "READY" : "NOT_READY"}</dd>
        <dt>field report</dt><dd>{result.field_report_ready ? "READY" : "NOT_READY"}</dd>
        <dt>customer reports</dt><dd>{result.customer_reports_ready ? "READY" : "NOT_READY"}</dd>
        <dt>weather</dt><dd>{result.weather_status}</dd>
        <dt>weather source</dt><dd>{result.weather_source ?? "-"}</dd>
        <dt>ROI</dt><dd>{result.roi_status}</dd>
        <dt>ROI ids</dt><dd>{result.roi_ids.length ? result.roi_ids.join(", ") : "-"}</dd>
        <dt>Field Memory</dt><dd>{result.field_memory_status}</dd>
        <dt>Field Memory ids</dt><dd>{result.field_memory_ids.length ? result.field_memory_ids.join(", ") : "-"}</dd>
        <dt>Skill Trace</dt><dd>{result.skill_trace_status}</dd>
        <dt>Skill Performance</dt><dd>{result.skill_performance_status}</dd>
        <dt>Learning closure</dt><dd>{result.learning_closure}</dd>
        <dt>Excluded reason</dt><dd>{result.learning_excluded_reason ?? "-"}</dd>
      </dl>
      <section className="flight-decision-contract">
        <h4>验收回放页面链接</h4>
        {result.ui_urls.map((url) => <p key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></p>)}
      </section>
      <details open>
        <summary>诊断建议</summary>
        {result.diagnostic_suggestions.length ? (
          <ul className="flight-diagnostics-list">
            {result.diagnostic_suggestions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : <p className="flight-muted">暂无诊断建议。</p>}
      </details>
      <p className="flight-muted">weather lane 不把雨水学习成灌溉效果；skill failure lane 不写入可信学习。ROI 估算会明确标注为 ESTIMATED，不冒充真实财务结果。</p>
    </aside>
  );
}

export default function FlightMatrix({
  run,
  decisionResult,
  operationResult,
  evidenceResult,
  reportLearningResult,
  onRetryStep,
  onRunDecision,
  onRunOperation,
  onRunEvidence,
  onRunReportLearning,
  loading,
  decisionLoading,
  operationLoading,
  evidenceLoading,
  reportLearningLoading,
  decisionError,
  operationError,
  evidenceError,
  reportLearningError,
}: Props): React.ReactElement {
  const [decisionDrawerOpen, setDecisionDrawerOpen] = React.useState(false);
  const [operationDrawerOpen, setOperationDrawerOpen] = React.useState(false);
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = React.useState(false);
  const [reportLearningDrawerOpen, setReportLearningDrawerOpen] = React.useState(false);
  return (
    <section className="flight-card">
      <div className="flight-card-head">
        <h2>A-I 链路矩阵</h2>
        <span>{run?.current_step ? `当前：${run.current_step}` : "未开始"}</span>
      </div>
      <div className="flight-actions flight-card-actions">
        <button type="button" onClick={onRunDecision} disabled={loading || decisionLoading || !run}>运行 E 层：推荐 / 处方 / 审批</button>
        <button type="button" onClick={onRunOperation} disabled={loading || operationLoading || !run}>运行 F 层：Operation / AO-ACT / Receipt</button>
        <button type="button" onClick={onRunEvidence} disabled={loading || evidenceLoading || !run}>运行 G 层：Evidence / Acceptance / Export</button>
        <button type="button" onClick={onRunReportLearning} disabled={loading || reportLearningLoading || !run}>运行 H 层：Report / Learning Closure</button>
        {decisionResult ? <button type="button" onClick={() => setDecisionDrawerOpen(true)}>查看 E 层详情</button> : null}
        {operationResult ? <button type="button" onClick={() => setOperationDrawerOpen(true)}>查看 F 层详情</button> : null}
        {evidenceResult ? <button type="button" onClick={() => setEvidenceDrawerOpen(true)}>查看 G 层详情</button> : null}
        {reportLearningResult ? <button type="button" onClick={() => setReportLearningDrawerOpen(true)}>查看 H 层详情</button> : null}
        {decisionError ? <span className="flight-error-text">{decisionError}</span> : null}
        {operationError ? <span className="flight-error-text">{operationError}</span> : null}
        {evidenceError ? <span className="flight-error-text">{evidenceError}</span> : null}
        {reportLearningError ? <span className="flight-error-text">{reportLearningError}</span> : null}
      </div>
      {run ? (
        <div className="flight-matrix">
          {run.steps.map((step) => {
            const isE = step.step_key === "E";
            const isF = step.step_key === "F";
            const isG = step.step_key === "G";
            const isH = step.step_key === "H";
            return (
              <article key={step.step_key} className={`flight-step flight-step-${step.status.toLowerCase()} ${isE ? "flight-step-decision" : ""} ${isF ? "flight-step-operation" : ""} ${isG ? "flight-step-evidence" : ""} ${isH ? "flight-step-report-learning" : ""}`}>
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
                  {isG && evidenceResult ? (
                    <dl className="flight-e-layer-inline flight-g-layer-inline">
                      <dt>evidence</dt><dd>{evidenceResult.evidence_status}</dd>
                      <dt>acceptance</dt><dd>{evidenceResult.acceptance_status}</dd>
                      <dt>final</dt><dd>{evidenceResult.final_status}</dd>
                      <dt>export</dt><dd>{evidenceResult.evidence_export_job_status}</dd>
                      <dt>sha256</dt><dd>{evidenceResult.sha256 ?? "-"}</dd>
                    </dl>
                  ) : null}
                  {isH && reportLearningResult ? (
                    <dl className="flight-e-layer-inline flight-h-layer-inline">
                      <dt>operation report</dt><dd>{reportLearningResult.operation_report_ready ? "READY" : "NOT_READY"}</dd>
                      <dt>field report</dt><dd>{reportLearningResult.field_report_ready ? "READY" : "NOT_READY"}</dd>
                      <dt>weather</dt><dd>{reportLearningResult.weather_status}</dd>
                      <dt>ROI</dt><dd>{reportLearningResult.roi_status}</dd>
                      <dt>Field Memory</dt><dd>{reportLearningResult.field_memory_status}</dd>
                      <dt>learning</dt><dd>{reportLearningResult.learning_closure}</dd>
                    </dl>
                  ) : null}
                </div>
                <div>
                  <em>{flightTableStepStatusLabel(step.status)}</em>
                  {isE && decisionResult ? <button type="button" onClick={() => setDecisionDrawerOpen(true)}>详情</button> : null}
                  {isF && operationResult ? <button type="button" onClick={() => setOperationDrawerOpen(true)}>详情</button> : null}
                  {isG && evidenceResult ? <button type="button" onClick={() => setEvidenceDrawerOpen(true)}>详情</button> : null}
                  {isH && reportLearningResult ? <button type="button" onClick={() => setReportLearningDrawerOpen(true)}>详情</button> : null}
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
      {evidenceDrawerOpen && evidenceResult ? <EvidenceDrawer result={evidenceResult} onClose={() => setEvidenceDrawerOpen(false)} /> : null}
      {reportLearningDrawerOpen && reportLearningResult ? <ReportLearningDrawer result={reportLearningResult} onClose={() => setReportLearningDrawerOpen(false)} /> : null}
    </section>
  );
}
