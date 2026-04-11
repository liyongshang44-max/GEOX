import React from "react";
import { Link } from "react-router-dom";
import { fetchDashboardOverviewV2, fetchDashboardRecentExecutions } from "../api/dashboard";
import { mapReportCode } from "../api/reports";
import { PageHeader, SectionCard } from "../shared/ui";

export default function CustomerDashboardPage(): React.ReactElement {
  const [overview, setOverview] = React.useState<any>(null);
  const [recent, setRecent] = React.useState<any[]>([]);

  React.useEffect(() => {
    void fetchDashboardOverviewV2().then(setOverview).catch(() => setOverview(null));
    void fetchDashboardRecentExecutions(5).then((items) => setRecent(items || [])).catch(() => setRecent([]));
  }, []);

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / 客户看板"
        title="客户看板"
        description="仅保留关键4区块"
        actions={<Link className="btn" to="/dashboard">切换平台控制台</Link>}
      />

      <SectionCard title="地块状态">
        <div>正常：{overview?.field_status_summary?.normal ?? 0} · 风险：{overview?.field_status_summary?.risk ?? 0}</div>
      </SectionCard>

      <SectionCard title="最近执行">
        <div className="list">
          {recent.slice(0, 5).map((item, idx) => (
            <div key={`${item?.operation_plan_id || idx}`} className="item">
              {idx + 1}. {item?.title || item?.operation_plan_id || "--"}（{mapReportCode(item?.final_status).label}）
            </div>
          ))}
          {!recent.length ? <div className="muted">暂无执行记录</div> : null}
        </div>
      </SectionCard>

      <SectionCard title="风险告警">
        <div>高风险：{overview?.risk_alert_summary?.high ?? 0} · 中风险：{overview?.risk_alert_summary?.medium ?? 0}</div>
      </SectionCard>

      <SectionCard title="本周期目标">
        <div>{overview?.current_cycle_goal?.summary || "本周期目标尚未配置"}</div>
      </SectionCard>
    </div>
  );
}
