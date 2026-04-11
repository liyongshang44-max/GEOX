import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAlerts, type AlertV1 } from "../api/alerts";
import { fetchFieldReport, mapReportCode, type OperationReportV1 } from "../api/reports";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import { alertCategoryLabel, alertStatusLabel } from "../lib/alertLabels";
import { PageHeader, SectionCard } from "../shared/ui";

function sum(items: OperationReportV1[], picker: (item: OperationReportV1) => number): number {
  return items.reduce((acc, item) => acc + picker(item), 0);
}

function matchFieldAlert(item: AlertV1, fieldId: string): boolean {
  if (item.object_type === "FIELD" && String(item.object_id) === fieldId) return true;
  return (item.source_refs || []).some((ref) => String(ref.type || "").toUpperCase().includes("FIELD") && String(ref.id) === fieldId);
}

export default function FieldReportPage(): React.ReactElement {
  const { fieldId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<OperationReportV1[]>([]);
  const [alerts, setAlerts] = React.useState<AlertV1[]>([]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void Promise.all([fetchFieldReport(fieldId), fetchAlerts({ status: "OPEN" }), fetchAlerts({ status: "ACKED" })])
      .then(([reports, openAlerts, ackedAlerts]) => {
        if (!alive) return;
        setItems(reports);
        const merged = [...openAlerts, ...ackedAlerts];
        const uniq = new Map<string, AlertV1>();
        for (const a of merged) {
          if (!matchFieldAlert(a, fieldId)) continue;
          uniq.set(a.alert_id, a);
        }
        setAlerts(Array.from(uniq.values()));
        setError("");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(String(e instanceof Error ? e.message : "加载失败"));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fieldId]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error) return <ErrorState title="地块报告加载失败" message={error || "暂无地块报告"} onRetry={() => window.location.reload()} />;

  const high = items.filter((item) => item.risk.level === "HIGH").length;
  const medium = items.filter((item) => item.risk.level === "MEDIUM").length;
  const low = items.filter((item) => item.risk.level === "LOW").length;

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / 地块报告"
        title={`地块报告 ${fieldId}`}
        description="展示地块 operation reports + 风险/成本汇总"
        actions={<Link className="btn" to={`/fields/${encodeURIComponent(fieldId)}`}>返回地块详情</Link>}
      />

      <SectionCard title="未关闭关联告警">
        <div className="list">
          {alerts.map((alert) => (
            <article key={alert.alert_id} className="item">
              <div>{alertCategoryLabel(alert.category)} · {alertStatusLabel(alert.status)}</div>
              <div className="muted">告警ID：{alert.alert_id}</div>
            </article>
          ))}
          {!alerts.length ? <div className="muted">暂无未关闭告警</div> : null}
        </div>
      </SectionCard>

      <SectionCard title="Operation Reports">
        <div className="list">
          {items.map((item, idx) => (
            <article key={`${item.identifiers.operation_plan_id || item.identifiers.operation_id || idx}`} className="item">
              <div>{idx + 1}. {item.identifiers.operation_plan_id || item.identifiers.operation_id || "--"}</div>
              <div className="muted">状态：{mapReportCode(item.execution.final_status).label}</div>
              <div className="muted">风险：{mapReportCode(item.risk.level).label}</div>
            </article>
          ))}
          {!items.length ? <div className="muted">暂无作业报告</div> : null}
        </div>
      </SectionCard>

      <SectionCard title="风险汇总">
        <div>高：{high} · 中：{medium} · 低：{low}</div>
      </SectionCard>

      <SectionCard title="成本汇总">
        <div>预计总成本：{sum(items, (item) => item.cost.estimated_total)}</div>
        <div>实际总成本：{sum(items, (item) => item.cost.actual_total ?? 0)}</div>
      </SectionCard>
    </div>
  );
}
