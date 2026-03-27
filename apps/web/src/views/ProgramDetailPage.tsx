import React from "react";
import { useParams, Link } from "react-router-dom";
import { fetchProgramDetail, fetchProgramCost, fetchProgramEfficiency, fetchProgramSla, fetchOperationStates, fetchDashboardEvidenceSummary } from "../api";
import { RelativeTime, absoluteTime } from "../components/RelativeTime";
import { CopyButton } from "../components/CopyButton";
import StatusBadge from "../components/common/StatusBadge";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import { PRODUCT_LABELS } from "../lib/presentation/labels";
import { mapApprovalStatus, mapEvidenceStatus, mapOperationPlanStatus, mapReceiptStatus, mapRecommendationStatus, mapTaskStatus, type StatusPresentation } from "../lib/presentation/statusMap";

type ChainMapper = (value: string | null | undefined) => StatusPresentation;

function chainItem(title: string, status: string | null | undefined, id: string, mapper: ChainMapper, ts?: string | number): React.ReactElement {
  return (
    <div className="timelineItem">
      <div className="timelineTitle">{title}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <StatusBadge presentation={mapper(status)} />
        <span className="muted">时间：{ts ? absoluteTime(ts) : "-"}</span>
        <span className="mono">{id || "-"}</span>
      </div>
    </div>
  );
}

export default function ProgramDetailPage(): React.ReactElement {
  const { programId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [technical, setTechnical] = React.useState<string | undefined>(undefined);
  const [detail, setDetail] = React.useState<any>(null);
  const [cost, setCost] = React.useState<any>(null);
  const [efficiency, setEfficiency] = React.useState<any>(null);
  const [sla, setSla] = React.useState<any>(null);
  const [ops, setOps] = React.useState<any[]>([]);
  const [evidences, setEvidences] = React.useState<any[]>([]);
  const [showTech, setShowTech] = React.useState(false);

  const reload = React.useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    setError(null);
    setTechnical(undefined);
    try {
      const id = decodeURIComponent(programId);
      const [d, c, e, s, o, ev] = await Promise.all([
        fetchProgramDetail(id),
        fetchProgramCost(id).catch(() => null),
        fetchProgramEfficiency(id).catch(() => null),
        fetchProgramSla(id).catch(() => null),
        fetchOperationStates({ limit: 100 }).catch(() => ({ items: [] } as any)),
        fetchDashboardEvidenceSummary(20).catch(() => []),
      ]);
      setDetail(d);
      setCost(c);
      setEfficiency(e);
      setSla(s);
      setOps((o?.items || []).filter((x: any) => String(x?.program_id || "") === id));
      setEvidences((ev || []).filter((x: any) => String(x?.scope_id || "").includes(id)).slice(0, 6));
      if (!d) setError("当前暂无 Program 详情数据");
    } catch (err: any) {
      setError("Program 详情加载失败，请稍后重试");
      setTechnical(String(err?.bodyText || err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [programId]);

  React.useEffect(() => { void reload(); }, [reload]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !detail) return <ErrorState title="Program 详情暂不可用" message={error || "未找到 Program"} onRetry={() => void reload()} technical={technical} />;

  const latestOp = ops[0];

  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">Program 控制平面</div>
            <h2 className="sectionTitle" style={{ marginTop: 4 }}>{String(detail?.program_id || "-")}</h2>
            <div className="meta"><span>田块 {String(detail?.field_id || "-")}</span><span>季节 {String(detail?.season_id || "-")}</span><span>作物 {String(detail?.crop_code || "-")}</span></div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <StatusBadge presentation={mapOperationPlanStatus(String(detail?.status || "UNKNOWN"))} />
            <Link className="btn" to="/audit-export">查看证据</Link>
            <Link className="btn" to="/operations">查看作业</Link>
            <CopyButton value={String(detail?.program_id || "")} />
          </div>
        </div>
        <div className="muted">最近更新时间：<RelativeTime value={String(detail?.updated_at || "")} /></div>
      </section>

      <section className="summaryGrid3">
        {[
          { label: "建议状态", status: String(detail?.latest_recommendation?.status || "PENDING"), mapper: mapRecommendationStatus },
          { label: "审批状态", status: String(detail?.latest_approval?.status || "PENDING"), mapper: mapApprovalStatus },
          { label: PRODUCT_LABELS.operationPlan, status: String(detail?.latest_operation_plan?.status || latestOp?.final_status || "READY"), mapper: mapOperationPlanStatus },
          { label: "执行状态", status: String(latestOp?.dispatch_status || "READY"), mapper: mapTaskStatus },
          { label: "回执结果", status: String(latestOp?.receipt_status || "PENDING"), mapper: mapReceiptStatus },
          { label: "证据状态", status: String(evidences[0]?.status || "PENDING"), mapper: mapEvidenceStatus },
        ].map((item) => (
          <div key={item.label} className="card" style={{ padding: 12 }}>
            <div className="muted">{item.label}</div>
            <StatusBadge presentation={item.mapper(item.status)} />
          </div>
        ))}
      </section>

      <section className="contentGridTwo alignStart">
        <article className="card sectionBlock">
          <div className="sectionTitle">决策链时间线</div>
          {chainItem(PRODUCT_LABELS.recommendation, String(detail?.latest_recommendation?.status || "PENDING"), String(detail?.latest_recommendation?.recommendation_id || "-"), mapRecommendationStatus, detail?.latest_recommendation?.occurred_at)}
          {chainItem(PRODUCT_LABELS.approval, String(detail?.latest_approval?.status || "PENDING"), String(detail?.latest_approval?.approval_request_id || "-"), mapApprovalStatus, detail?.latest_approval?.occurred_at)}
          {chainItem(PRODUCT_LABELS.approvalDecision, String(detail?.latest_approval?.decision || detail?.latest_approval?.status || "PENDING"), String(detail?.latest_approval?.decision_id || "-"), mapApprovalStatus, detail?.latest_approval?.updated_at)}
        </article>

        <article className="card sectionBlock">
          <div className="sectionTitle">执行链时间线</div>
          {chainItem(PRODUCT_LABELS.operationPlan, String(detail?.latest_operation_plan?.status || latestOp?.final_status || "READY"), String(detail?.latest_operation_plan?.operation_plan_id || "-"), mapOperationPlanStatus, detail?.latest_operation_plan?.updated_at)}
          {chainItem(PRODUCT_LABELS.taskId, String(latestOp?.dispatch_status || "READY"), String(latestOp?.task_id || "-"), mapTaskStatus, latestOp?.last_event_ts)}
          {chainItem(PRODUCT_LABELS.dispatch, String(latestOp?.dispatch_status || "PENDING"), String(latestOp?.operation_id || "-"), mapTaskStatus, latestOp?.last_event_ts)}
          {chainItem(PRODUCT_LABELS.receipt, String(latestOp?.receipt_status || "PENDING"), String(latestOp?.receipt_fact_id || "-"), mapReceiptStatus, latestOp?.last_event_ts)}
        </article>
      </section>

      <section className="contentGridTwo alignStart">
        <article className="card sectionBlock">
          <div className="sectionTitle">证据链</div>
          {evidences.map((ev: any) => (
            <div key={ev.job_id} className="kv"><span className="k">{ev.job_id}</span><span className="v"><StatusBadge presentation={mapEvidenceStatus(String(ev.status || "PENDING"))} /></span></div>
          ))}
          {!evidences.length ? <EmptyState title="最近暂无证据导出记录" description="可前往证据页查看全量导出作业" /> : null}
        </article>

        <article className="card sectionBlock">
          <div className="sectionTitle">资源与结果</div>
          <div className="kv"><span className="k">water_l</span><span className="v">{String(cost?.water_l ?? "-")}</span></div>
          <div className="kv"><span className="k">electric_kwh</span><span className="v">{String(cost?.electric_kwh ?? "-")}</span></div>
          <div className="kv"><span className="k">chemical_ml</span><span className="v">{String(cost?.chemical_ml ?? "-")}</span></div>
          <div className="kv"><span className="k">fuel_l</span><span className="v">{String(cost?.fuel_l ?? "-")}</span></div>
          <div className="kv"><span className="k">observed_parameters</span><span className="v">{String(efficiency?.observed_parameters_count ?? "-")}</span></div>
          <div className="kv"><span className="k">constraint_check</span><span className="v">{String(sla?.constraint_check || "-")}</span></div>
        </article>
      </section>

      <section className="card sectionBlock">
        <button className="btn" onClick={() => setShowTech((s) => !s)}>{showTech ? "收起技术细节" : "展开技术细节"}</button>
        {showTech ? (
          <div style={{ marginTop: 12 }}>
            <div className="kv"><span className="k">recommendation_id</span><span className="v">{String(detail?.latest_recommendation?.recommendation_id || "-")}</span></div>
            <div className="kv"><span className="k">approval_request_id</span><span className="v">{String(detail?.latest_approval?.approval_request_id || "-")}</span></div>
            <div className="kv"><span className="k">operation_plan_id</span><span className="v">{String(detail?.latest_operation_plan?.operation_plan_id || "-")}</span></div>
            <div className="kv"><span className="k">act_task_id</span><span className="v">{String(latestOp?.task_id || "-")}</span></div>
            <div className="kv"><span className="k">receipt_fact_id</span><span className="v">{String(latestOp?.receipt_fact_id || "-")}</span></div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
