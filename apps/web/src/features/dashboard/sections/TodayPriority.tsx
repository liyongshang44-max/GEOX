import React from "react";
import { Link } from "react-router-dom";
import SectionCard from "./SectionCard";
import { EmptyGuide } from "../../../shared/ui";


export default function TodayPriority({
  todayActions,
  todayActionHref,
  todayActionLabel,
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
    <SectionCard title="TodayPriority" subtitle="先清阻断，再推执行。">
      <div className="decisionList" style={{ marginTop: 8 }}>
        {todayActions.map((item, idx) => (
          <Link key={`${item.type}_${idx}`} to={todayActionHref(item.type)} className="decisionItemLink">
            <div className="decisionItemTitle">{idx + 1}. {todayActionLabel(item.type, item.count)}</div>
            <div className="decisionItemMeta">立即处理</div>
          </Link>
        ))}
        {!todayActions.length ? <EmptyGuide title="今日暂无高优先动作" description="当前没有需要立即处理的阻断项。" actions={[{ label: "进入作业队列", to: "/operations?status=pending", tone: "primary" }, { label: "查看全部作业", to: "/operations" }]} /> : null}
      </div>
      <div style={{ marginTop: 8 }}>
        <Link className="btn primary" to="/operations?status=pending">进入作业队列</Link>
      </div>
    </SectionCard>
  );
}
