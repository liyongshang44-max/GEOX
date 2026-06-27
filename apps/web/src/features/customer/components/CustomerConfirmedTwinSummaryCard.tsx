import React from "react";
import type { CustomerConfirmedTwinSummaryV1 } from "../../../api/customer";

function text(value: unknown, fallback = "暂无记录"): string { const s = String(value ?? "").trim(); return s || fallback; }

function customerReason(value: unknown, fallback = "正式摘要仍待确认"): string {
  const raw = text(value, "");
  if (!raw) return fallback;
  const key = raw.toUpperCase();
  if (key === "NO_CONFIRMED_OPERATOR_RECOMMENDATION") return "暂无运营人员确认的正式建议";
  if (key === "CUSTOMER_SUMMARY_ONLY") return "当前仅有客户摘要，正式报告仍待补齐";
  if (key === "NO_FORECAST_RUN") return "缺少可回放预测结果";
  if (key === "NO_SCENARIO_EDIT") return "情景尚未完成确认";
  if (key === "NO_RECOMMENDATION_SUBMIT") return "建议尚未提交";
  if (key === "NO_APPROVAL") return "审批尚未完成";
  if (key === "NO_DISPATCH") return "任务尚未派发";
  if (key === "NO_TASK_CREATION") return "作业任务尚未创建";
  if (key.startsWith("NO_") || key.endsWith("_MISSING") || key.split("_").length >= 3) return "正式链路仍有待补齐环节";
  return raw.replace(/operator confirmation/gi, "运营人员确认").replace(/recommendation submission/gi, "建议提交").replace(/recommendation/gi, "建议");
}

function customerSummaryTerm(value: unknown, fallback = "待确认"): string {
  const raw = text(value, "");
  const key = raw.toUpperCase();
  if (!raw) return fallback;
  if (key.includes("IRRIGATION") || key.includes("IRRIGATE")) return "灌溉建议";
  if (key.includes("PENDING")) return "待确认";
  if (key.includes("PASS") || key.includes("APPROVED") || key.includes("CONFIRMED")) return "已确认";
  if (key.split("_").length >= 3) return fallback;
  return customerReason(raw, fallback);
}

export default function CustomerConfirmedTwinSummaryCard({ summary }: { summary: CustomerConfirmedTwinSummaryV1 | null | undefined }): React.ReactElement {
  const available = summary?.summary_status === "AVAILABLE";
  const state = summary?.state_summary;
  const risk = summary?.risk_summary;
  const rec = summary?.recommendation_summary;
  const evidence = summary?.evidence_summary;
  return (
    <section className="customerCard">
      <div className="customerCardHeaderRow">
        <div><h2 className="customerCardTitle">已确认交付摘要</h2><p className="customerMetricLabel">最近一次人工确认的正式建议</p></div>
        <span className="customerStatusPill">{available ? "已确认" : "暂无可交付摘要"}</span>
      </div>
      <p className="customerBoundaryNotice">本摘要来自已确认的正式决策链路。客户页不运行预测，不编辑情景，不提交建议，不审批，不派发任务。</p>
      {!available ? <p className="customerMetricLabel">原因：{customerReason(summary?.reason)}</p> : (
        <>
          <div className="customerTable customerSpacingTopSm">
            <div><strong>当前已确认状态</strong><span>{customerSummaryTerm(state?.status_text)} · 水分 {customerSummaryTerm(state?.water_state)} · 置信度 {customerSummaryTerm(state?.confidence)}</span></div>
            <div><strong>主要风险</strong><span>{customerSummaryTerm(risk?.primary_risk)} / {customerSummaryTerm(risk?.risk_level)} / {customerSummaryTerm(risk?.time_window)} / {customerSummaryTerm(risk?.confidence)}</span></div>
            <div><strong>已确认建议摘要</strong><span>{customerSummaryTerm(rec?.action_summary)} · {customerSummaryTerm(rec?.recommendation_type)} · {rec?.amount_mm ?? "--"} mm</span></div>
            <div><strong>审批/作业/任务状态摘要（只读）</strong><span>审批 {customerSummaryTerm(rec?.approval_status)} · 作业 {customerSummaryTerm(rec?.operation_plan_status)} · 任务 {customerSummaryTerm(rec?.task_status)}</span></div>
          </div>
          <div className="customerEvidenceList customerSpacingTopSm"><strong>证据摘要</strong><span>数量 {evidence?.evidence_count ?? 0} · 质量 {customerSummaryTerm(evidence?.quality_status)}</span></div>
        </>
      )}
      <ul className="customerList customerSpacingTopSm">{(summary?.boundary_rules ?? []).map((rule) => <li className="customerListItem" key={rule}>{customerReason(rule)}</li>)}</ul>
    </section>
  );
}
