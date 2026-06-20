import React from "react";
import type { CustomerConfirmedTwinSummaryV1 } from "../../../api/customer";

function text(value: unknown, fallback = "暂无记录"): string { const s = String(value ?? "").trim(); return s || fallback; }

export default function CustomerConfirmedTwinSummaryCard({ summary }: { summary: CustomerConfirmedTwinSummaryV1 | null | undefined }): React.ReactElement {
  const available = summary?.summary_status === "AVAILABLE";
  const state = summary?.state_summary;
  const risk = summary?.risk_summary;
  const rec = summary?.recommendation_summary;
  const evidence = summary?.evidence_summary;
  return (
    <section className="customerCard">
      <div className="customerCardHeaderRow">
        <div><h2 className="customerCardTitle">已确认 Twin 交付摘要</h2><p className="customerMetricLabel">最近一次 operator confirmation / recommendation submission</p></div>
        <span className="customerStatusPill">{available ? "已确认" : "暂无可交付摘要"}</span>
      </div>
      <p className="customerBoundaryNotice">本摘要来自 Operator 已确认的正式决策链路。客户页不运行预测，不编辑情景，不提交 recommendation，不审批，不派发任务。</p>
      {!available ? <p className="customerMetricLabel">原因：{text(summary?.reason, "NO_CONFIRMED_OPERATOR_RECOMMENDATION")}</p> : (
        <>
          <div className="customerTable customerSpacingTopSm">
            <div><strong>当前已确认状态</strong><span>{text(state?.status_text)} · 水分 {text(state?.water_state)} · 置信度 {text(state?.confidence)}</span></div>
            <div><strong>主要风险</strong><span>{text(risk?.primary_risk)} / {text(risk?.risk_level)} / {text(risk?.time_window)} / {text(risk?.confidence)}</span></div>
            <div><strong>已确认建议摘要</strong><span>{text(rec?.action_summary)} · {text(rec?.recommendation_type)} · {rec?.amount_mm ?? "--"} mm</span></div>
            <div><strong>审批/作业/任务状态摘要（只读）</strong><span>审批 {text(rec?.approval_status)} · 作业 {text(rec?.operation_plan_status)} · 任务 {text(rec?.task_status)}</span></div>
          </div>
          <div className="customerEvidenceList customerSpacingTopSm"><strong>证据摘要</strong><span>数量 {evidence?.evidence_count ?? 0} · 质量 {text(evidence?.quality_status)}</span></div>
        </>
      )}
      <ul className="customerList customerSpacingTopSm">{(summary?.boundary_rules ?? []).map((rule) => <li className="customerListItem" key={rule}>{rule}</li>)}</ul>
    </section>
  );
}
