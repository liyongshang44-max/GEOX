import React from "react";
import { Link } from "react-router-dom";
import { SectionCard, StatusPill } from "../../../shared/ui";
import EmptyState from "../../../components/common/EmptyState";

export default function TodayPriority({
  todayPriorityItems,
  todayActionLabel,
}: {
  todayPriorityItems: Array<{
    type: string;
    count: number;
    riskLevel: string;
    reason: string;
    suggestedAction: string;
    linkTarget: string;
    actionLabel: string;
    entryLabel: string;
  }>;
  todayActionLabel: (type: string, count: number) => string;
}): React.ReactElement {
  return (
    <SectionCard title="TodayPriority" subtitle="固定优先级：阻断 > 待验收 > 待审批 > 一般提醒。">
      <div className="decisionList" style={{ marginTop: 8 }}>
        {todayPriorityItems.map((item, idx) => (
          <Link key={`${item.type}_${idx}`} to={item.linkTarget} className="decisionItemLink">
            <div className="decisionItemTitle">{idx + 1}. {todayActionLabel(item.type, item.count)}</div>
            <div className="decisionItemMeta">风险等级：<StatusPill tone={item.riskLevel === "高" ? "danger" : item.riskLevel === "中" ? "warning" : "info"}>{item.riskLevel}</StatusPill></div>
            <div className="decisionItemMeta">原因摘要：{item.reason}</div>
            <div className="decisionItemMeta">建议动作：{item.suggestedAction}</div>
            <div className="decisionItemMeta">跳转入口：{item.entryLabel}</div>
            <div style={{ marginTop: 8 }}>
              <span className="btn">{item.actionLabel}</span>
            </div>
          </Link>
        ))}
        {!todayPriorityItems.length ? (
          <EmptyState
            title="今日重点已清空，下一步建议"
            description="可前往作业列表主动巡检，提前处理潜在风险。"
          />
        ) : null}
      </div>
      <div style={{ marginTop: 8 }}>
        <Link className="btn primary" to="/operations?status=pending">进入作业队列</Link>
      </div>
    </SectionCard>
  );
}
