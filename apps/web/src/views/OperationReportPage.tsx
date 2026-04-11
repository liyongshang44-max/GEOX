import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOperationReport, mapReportCode, type OperationReport } from "../api/reports";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ErrorState from "../components/common/ErrorState";
import { PageHeader, SectionCard } from "../shared/ui";

function kv(value: unknown): string {
  if (value === null || value === undefined || value === "") return "--";
  return String(value);
}

export default function OperationReportPage(): React.ReactElement {
  const { operationPlanId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const [report, setReport] = React.useState<OperationReport | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void fetchOperationReport(operationPlanId)
      .then((res) => {
        if (!alive) return;
        setReport(res);
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
  }, [operationPlanId]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !report) return <ErrorState title="作业报告加载失败" message={error || "暂无报告"} onRetry={() => window.location.reload()} />;

  const finalStatus = mapReportCode(report.summary?.final_status ?? report.execution_result?.final_status);
  const errorCode = mapReportCode(report.execution_result?.error_code);

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / 作业报告"
        title={report.summary?.title || `作业报告 ${operationPlanId}`}
        description={`状态：${finalStatus.label}`}
        actions={<Link className="btn" to={`/operations/${encodeURIComponent(operationPlanId)}`}>返回作业详情</Link>}
      />

      <SectionCard title="作业摘要">
        <div className="kvGrid2">
          <div><strong>作业ID：</strong>{kv(report.operation_id || report.operation_plan_id || operationPlanId)}</div>
          <div><strong>动作：</strong>{kv(report.summary?.action_type)}</div>
          <div><strong>状态：</strong>{finalStatus.label}</div>
          <div><strong>操作人：</strong>{kv(report.summary?.operator)}</div>
        </div>
      </SectionCard>

      <SectionCard title="执行结果">
        <div className="kvGrid2">
          <div><strong>最终状态：</strong>{finalStatus.label}</div>
          <div><strong>错误码：</strong>{errorCode.label}</div>
          <div><strong>开始时间：</strong>{kv(report.summary?.started_at)}</div>
          <div><strong>结束时间：</strong>{kv(report.summary?.finished_at)}</div>
        </div>
      </SectionCard>

      <SectionCard title="验收">
        <div className="kvGrid2">
          <div><strong>验收结论：</strong>{mapReportCode(report.acceptance?.verdict).label}</div>
          <div><strong>验收人：</strong>{kv(report.acceptance?.accepted_by)}</div>
          <div><strong>验收时间：</strong>{kv(report.acceptance?.accepted_at)}</div>
          <div><strong>备注：</strong>{kv(report.acceptance?.notes)}</div>
        </div>
      </SectionCard>

      <SectionCard title="证据">
        <div className="kvGrid2">
          <div><strong>证据数量：</strong>{kv(report.evidence?.count)}</div>
          <div><strong>完整性：</strong>{mapReportCode(report.evidence?.completeness).label}</div>
          <div><strong>最新时间：</strong>{kv(report.evidence?.latest_at)}</div>
        </div>
      </SectionCard>

      <SectionCard title="成本">
        <div className="kvGrid2">
          <div><strong>预计：</strong>{kv(report.cost?.estimated)}</div>
          <div><strong>实际：</strong>{kv(report.cost?.actual)}</div>
          <div><strong>币种：</strong>{kv(report.cost?.currency || "CNY")}</div>
        </div>
      </SectionCard>

      <SectionCard title="SLA">
        <div className="kvGrid2">
          <div><strong>目标（分钟）：</strong>{kv(report.sla?.target_minutes)}</div>
          <div><strong>实际（分钟）：</strong>{kv(report.sla?.actual_minutes)}</div>
          <div><strong>达成：</strong>{mapReportCode(report.sla?.status).label}</div>
        </div>
      </SectionCard>

      <SectionCard title="风险">
        <div className="kvGrid2">
          <div><strong>等级：</strong>{mapReportCode(report.risk?.level).label}</div>
          <div><strong>标记：</strong>{(report.risk?.flags || []).map((x) => mapReportCode(x).label).join(" / ") || "--"}</div>
          <div><strong>建议：</strong>{kv(report.risk?.advice)}</div>
        </div>
      </SectionCard>
    </div>
  );
}
