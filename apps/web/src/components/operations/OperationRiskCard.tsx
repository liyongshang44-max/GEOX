import React from "react";
import type { OperationDetailResponse } from "../../api/operations";

type RiskBreakdown = {
  unfinishedTask: number;
  noReceiptExecution: number;
  timeoutOperation: number;
  total: number;
  level: "低风险" | "中风险" | "高风险";
};

function isCompletedStatus(raw: unknown): boolean {
  const s = String(raw ?? "").toUpperCase();
  return ["SUCCEEDED", "SUCCESS", "DONE", "EXECUTED", "PASS"].includes(s);
}

function toMs(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const parsed = Date.parse(v);
    if (Number.isFinite(parsed)) return parsed;
    const asNum = Number(v);
    if (Number.isFinite(asNum)) return asNum;
  }
  return null;
}

function buildRiskSummary(detail: OperationDetailResponse): RiskBreakdown {
  const plan = detail?.plan ?? {};
  const task = detail?.task ?? {};
  const receipt = detail?.receipt ?? null;

  const taskExists = Boolean(task && Object.keys(task).length > 0);
  const taskStatus = task?.status ?? task?.task_status ?? detail?.dispatch?.status ?? detail?.final_status;
  const unfinishedTask = taskExists && !isCompletedStatus(taskStatus) ? 1 : 0;

  const hasExecutionRecord = taskExists || Boolean(plan && Object.keys(plan).length > 0);
  const noReceiptExecution = hasExecutionRecord && !receipt ? 1 : 0;

  const endTs =
    toMs(plan?.time_window?.end_ts_ms)
    ?? toMs(plan?.time_window?.end_ts)
    ?? toMs(plan?.window_end_ts_ms)
    ?? toMs(plan?.end_ts_ms)
    ?? toMs(plan?.planned_end_ts_ms)
    ?? toMs(plan?.execution_end_ts_ms)
    ?? toMs(plan?.end_at);
  const timeoutOperation = endTs != null && Date.now() > endTs && !isCompletedStatus(detail?.final_status) ? 1 : 0;

  const total = unfinishedTask + noReceiptExecution + timeoutOperation;
  const level: RiskBreakdown["level"] = total >= 3 ? "高风险" : total >= 1 ? "中风险" : "低风险";
  return { unfinishedTask, noReceiptExecution, timeoutOperation, total, level };
}

function riskMessage(total: number): string {
  if (total >= 3) return "当前存在多个阻断点，建议立即介入处理。";
  if (total >= 1) return "已发现潜在问题，建议尽快复核执行与回执。";
  return "当前未发现明显执行风险。";
}

export default function OperationRiskCard({ detail }: { detail: OperationDetailResponse }): React.ReactElement {
  const risk = buildRiskSummary(detail);
  return (
    <section className="card sectionBlock geoxSectionCard operationBusinessCard">
      <div className="sectionTitle">风险（是否存在问题）</div>
      <div className="muted detailSectionLead">基于作业计划、执行任务、执行回执三类现有数据实时计算。</div>
      <div className="detailMeaningGrid">
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">风险等级</span>
          <strong>{risk.level}</strong>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">风险总量</span>
          <strong>{risk.total}</strong>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">风险说明</span>
          <strong>{riskMessage(risk.total)}</strong>
        </div>
      </div>
      <div className="operationsSummaryGrid detailSummaryGridV4" style={{ marginTop: 16 }}>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">未完成任务</span><strong>{risk.unfinishedTask}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">无回执执行</span><strong>{risk.noReceiptExecution}</strong></div>
        <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">超时作业</span><strong>{risk.timeoutOperation}</strong></div>
      </div>
    </section>
  );
}
