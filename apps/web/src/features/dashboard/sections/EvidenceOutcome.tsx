import React from "react";
import { Link } from "react-router-dom";
import type { DashboardRecommendationItem } from "../../../api/dashboard";
import { mapFieldDisplayName } from "../../../lib/operationLabels";
import SectionCard from "./SectionCard";

function EmptyBlock({ text }: { text: string }): React.ReactElement {
  return <div className="card muted" style={{ padding: 16 }}>{text}</div>;
}

export default function EvidenceOutcome({
  acceptanceTasks,
  smartRecommendations,
  latestMetrics,
}: {
  acceptanceTasks: any[];
  smartRecommendations: {
    todayCount: number;
    latest: (DashboardRecommendationItem & {
      normalized_metrics?: { soil_moisture: number | null; temperature: number | null; humidity: number | null };
    }) | null;
  };
  latestMetrics: { soil_moisture?: number | null; temperature?: number | null; humidity?: number | null };
}): React.ReactElement {
  return (
    <SectionCard title="EvidenceOutcome" subtitle="证据先过，再进验收。">
      <div className="decisionList" style={{ marginTop: 8 }}>
        {acceptanceTasks.map((e: any, i: number) => {
          const card = e?.card || {};
          return (
            <Link key={e?.id || i} to={e?.href || card?.href || "/delivery/export-jobs"} className="decisionItemLink">
              <div className="decisionItemTitle">{mapFieldDisplayName(e?.fieldName, e?.fieldName)}</div>
              <div className="decisionItemMeta">{card?.constraintCheckLabel || "待验收"} · {card?.waterLabel || "--"}</div>
            </Link>
          );
        })}
        {acceptanceTasks.length === 0 ? <EmptyBlock text="当前没有待验收任务" /> : null}
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <Link className="btn primary" to="/operations?status=done_unaccepted">进入证据验收</Link>
        <Link className="btn" to="/evidence">查看证据详情</Link>
      </div>
      <details style={{ marginTop: 10 }}>
        <summary>诊断信息（折叠）</summary>
        <div className="decisionList" style={{ marginTop: 8 }}>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">今日自动建议</div>
            <div className="decisionItemMeta">{smartRecommendations.todayCount} 条</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">soil_moisture</div>
            <div className="decisionItemMeta">{latestMetrics.soil_moisture == null ? "--" : `${Number(latestMetrics.soil_moisture).toFixed(1)}%`}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">temperature</div>
            <div className="decisionItemMeta">{latestMetrics.temperature == null ? "--" : `${Number(latestMetrics.temperature).toFixed(1)}°C`}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">humidity</div>
            <div className="decisionItemMeta">{latestMetrics.humidity == null ? "--" : `${Number(latestMetrics.humidity).toFixed(1)}%`}</div>
          </div>
        </div>
      </details>
    </SectionCard>
  );
}
