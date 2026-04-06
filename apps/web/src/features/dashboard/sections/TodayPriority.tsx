import React from "react";
import { Link } from "react-router-dom";
import { SectionCard, StatusPill } from "../../../shared/ui";
import EmptyState from "../../../components/common/EmptyState";


export default function TodayPriority({
  todayActions,
  todayActionHref,
  todayActionLabel,
  todayActionRiskLevel = () => "中",
  todayActionReason = () => "-",
  todayActionSuggestion = () => "-",
  todayActionCTA = () => "查看详情",
  todayActionEntryLabel = () => "作业",
}: {
  todayActions: Array<{ type: string; count: number }>;
  todayActionHref: (type: string) => string;
  todayActionLabel: (type: string, count: number) => string;
  todayActionRiskLevel?: (type: string) => string;
  todayActionReason?: (type: string, count: number) => string;
  todayActionSuggestion?: (type: string, count: number) => string;
  todayActionCTA?: (type: string) => string;
  todayActionEntryLabel?: (type: string) => string;
}): React.ReactElement {
  const getRiskLevel = todayActionRiskLevel ?? (() => "低");
  const getReason = todayActionReason ?? (() => "暂无原因");
  const getSuggestion = todayActionSuggestion ?? (() => "暂无建议");
  const getCTA = todayActionCTA ?? (() => "查看详情");
  const getEntryLabel = todayActionEntryLabel ?? (() => "作业列表");

  return (
    <SectionCard title="TodayPriority" subtitle="固定优先级：阻断 > 待验收 > 待审批 > 一般提醒。">
      <div className="decisionList" style={{ marginTop: 8 }}>
        {todayActions.map((item, idx) => (
          <div key={`${item.type}_${idx}`} className="decisionItemStatic">
            <div className="decisionItemTitle">{idx + 1}. {todayActionLabel(item.type, item.count)}</div>
            <div className="decisionItemMeta">风险等级：<StatusPill tone={getRiskLevel(item.type) === "高" ? "danger" : getRiskLevel(item.type) === "中" ? "warning" : "info"}>{getRiskLevel(item.type)}</StatusPill></div>
            <div className="decisionItemMeta">原因摘要：{getReason(item.type, item.count)}</div>
            <div className="decisionItemMeta">建议动作：{getSuggestion(item.type, item.count)}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Link className="btn" to={todayActionHref(item.type)}>{getCTA(item.type)}</Link>
              <Link to={todayActionHref(item.type)}>跳转入口：{getEntryLabel(item.type)}</Link>
            </div>
          </div>
        ))}
        {!todayActions.length ? <EmptyState title="今日暂无高优先动作" description="当前没有需要立即处理的阻断项。" /> : null}
      </div>
      <div style={{ marginTop: 8 }}>
        <Link className="btn primary" to="/operations?status=pending">进入作业队列</Link>
      </div>
    </SectionCard>
  );
}
