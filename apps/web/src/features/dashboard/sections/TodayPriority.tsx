import React from "react";
import { Link } from "react-router-dom";
import { SectionCard, StatusPill } from "../../../shared/ui";


export default function TodayPriority({
  todayActions,
  todayActionHref,
  todayActionLabel,
  todayActionRiskLevel,
  todayActionReason,
  todayActionSuggestion,
  todayActionCTA,
  todayActionEntryLabel,
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
  return (
    <SectionCard title="TodayPriority" subtitle="固定优先级：阻断 > 待验收 > 待审批 > 一般提醒。">
      <div className="decisionList" style={{ marginTop: 8 }}>
        {todayActions.map((item, idx) => (
          <div key={`${item.type}_${idx}`} className="decisionItemStatic">
            <div className="decisionItemTitle">{idx + 1}. {todayActionLabel(item.type, item.count)}</div>
            <div className="decisionItemMeta">风险等级：<StatusPill tone={todayActionRiskLevel(item.type) === "高" ? "danger" : todayActionRiskLevel(item.type) === "中" ? "warning" : "info"}>{todayActionRiskLevel(item.type)}</StatusPill></div>
            <div className="decisionItemMeta">原因摘要：{todayActionReason(item.type, item.count)}</div>
            <div className="decisionItemMeta">建议动作：{todayActionSuggestion(item.type, item.count)}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Link className="btn" to={todayActionHref(item.type)}>{todayActionCTA(item.type)}</Link>
              <Link to={todayActionHref(item.type)}>跳转入口：{todayActionEntryLabel(item.type)}</Link>
            </div>
          </div>
        ))}
        {!todayActions.length ? <EmptyGuide title="今日暂无高优先动作" description="当前没有需要立即处理的阻断项。" actions={[{ label: "进入作业队列", to: "/operations?status=pending", tone: "primary" }, { label: "查看全部作业", to: "/operations" }]} /> : null}
      </div>
      <div style={{ marginTop: 8 }}>
        <Link className="btn primary" to="/operations?status=pending">进入作业队列</Link>
      </div>
    </SectionCard>
  );
}
