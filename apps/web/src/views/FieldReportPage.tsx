import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchFieldReport, mapReportCode, type FieldReport } from "../api/reports";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import { PageHeader, SectionCard } from "../shared/ui";

export default function FieldReportPage(): React.ReactElement {
  const { fieldId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<FieldReport | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchFieldReport(fieldId)
      .then((res) => {
        if (!alive) return;
        setReport(res);
        setError("");
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(String(e?.message ?? "加载失败"));
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
  if (error || !report) return <ErrorState title="地块报告加载失败" message={error || "暂无地块报告"} onRetry={() => window.location.reload()} />;

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / 地块报告"
        title={report.field_name || `地块报告 ${fieldId}`}
        description="展示地块 operation reports + 风险/成本汇总"
        actions={<Link className="btn" to={`/fields/${encodeURIComponent(fieldId)}`}>返回地块详情</Link>}
      />

      <SectionCard title="Operation Reports">
        <div className="list">
          {(report.operation_reports || []).map((item, idx) => (
            <article key={`${item.operation_plan_id || item.operation_id || idx}`} className="item">
              <div>{idx + 1}. {item.summary?.title || item.operation_plan_id || item.operation_id || "--"}</div>
              <div className="muted">状态：{mapReportCode(item.summary?.final_status || item.execution_result?.final_status).label}</div>
              <div className="muted">错误码：{mapReportCode(item.execution_result?.error_code).label}</div>
            </article>
          ))}
          {!report.operation_reports?.length ? <div className="muted">暂无作业报告</div> : null}
        </div>
      </SectionCard>

      <SectionCard title="风险汇总">
        <div>高：{report.risk_summary?.high ?? 0} · 中：{report.risk_summary?.medium ?? 0} · 低：{report.risk_summary?.low ?? 0}</div>
        <div className="muted">Top Flags：{(report.risk_summary?.top_flags || []).map((x) => mapReportCode(x).label).join(" / ") || "--"}</div>
      </SectionCard>

      <SectionCard title="成本汇总">
        <div>预计总成本：{report.cost_summary?.estimated_total ?? 0}</div>
        <div>实际总成本：{report.cost_summary?.actual_total ?? 0}</div>
        <div>币种：{report.cost_summary?.currency || "CNY"}</div>
      </SectionCard>
    </div>
  );
}
