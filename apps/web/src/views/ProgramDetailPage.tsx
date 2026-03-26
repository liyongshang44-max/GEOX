import React from "react";
import { useParams, Link } from "react-router-dom";
import { fetchProgramDetail, fetchProgramCost, fetchProgramEfficiency, fetchProgramSla, fetchOperationStates, fetchDashboardEvidenceSummary } from "../api";
import { StatusTag } from "../components/StatusTag";
import { RelativeTime, absoluteTime } from "../components/RelativeTime";
import { CopyButton } from "../components/CopyButton";

function chainItem(title: string, status: string, id: string, ts?: string | number): React.ReactElement {
  return (
    <div className="timelineItem">
      <div className="timelineTitle">{title}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <StatusTag status={status} />
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
      if (!d) setError("该 Program 暂无可展示详情");
    } catch (err: any) {
      setError(String(err?.message || "加载失败"));
    } finally {
      setLoading(false);
    }
  }, [programId]);

  React.useEffect(() => { void reload(); }, [reload]);

  if (loading) return <div className="card" style={{ padding: 16 }}>正在加载 Program 控制链路…</div>;
  if (error || !detail) return <div className="card" style={{ padding: 16 }}>{error || "未找到 Program"}</div>;

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
          <div style={{ display: "flex", gap: 8 }}>
            <StatusTag status={String(detail?.status || "UNKNOWN")} />
            <Link className="btn" to="/audit-export">查看证据</Link>
            <Link className="btn" to="/operations">查看作业</Link>
            <CopyButton value={String(detail?.program_id || "")} />
          </div>
        </div>
        <div className="muted">最近更新时间：<RelativeTime value={String(detail?.updated_at || "")} /></div>
      </section>

      <section className="summaryGrid3">
        {[
          ["recommendation", String(detail?.latest_recommendation?.status || "PENDING")],
          ["approval", String(detail?.latest_approval?.status || "PENDING")],
          ["operation plan", String(detail?.latest_operation_plan?.status || latestOp?.final_status || "READY")],
          ["task/executor", String(latestOp?.dispatch_status || "READY")],
          ["receipt", String(latestOp?.receipt_status || "PENDING")],
          ["evidence", evidences[0]?.status || "PENDING"],
        ].map(([label, status]) => <div key={label} className="card" style={{ padding: 12 }}><div className="muted">{label}</div><StatusTag status={status} /></div>)}
      </section>

      <section className="contentGridTwo alignStart">
        <article className="card sectionBlock">
          <div className="sectionTitle">决策链时间线</div>
          {chainItem("recommendation", String(detail?.latest_recommendation?.status || "PENDING"), String(detail?.latest_recommendation?.recommendation_id || "-"), detail?.latest_recommendation?.occurred_at)}
          {chainItem("approval request", String(detail?.latest_approval?.status || "PENDING"), String(detail?.latest_approval?.approval_request_id || "-"), detail?.latest_approval?.occurred_at)}
          {chainItem("approval decision", String(detail?.latest_approval?.decision || detail?.latest_approval?.status || "PENDING"), String(detail?.latest_approval?.decision_id || "-"), detail?.latest_approval?.updated_at)}
        </article>

        <article className="card sectionBlock">
          <div className="sectionTitle">执行链时间线</div>
          {chainItem("operation plan", String(detail?.latest_operation_plan?.status || latestOp?.final_status || "READY"), String(detail?.latest_operation_plan?.operation_plan_id || "-"), detail?.latest_operation_plan?.updated_at)}
          {chainItem("act task", String(latestOp?.dispatch_status || "READY"), String(latestOp?.task_id || "-"), latestOp?.last_event_ts)}
          {chainItem("dispatch", String(latestOp?.dispatch_status || "PENDING"), String(latestOp?.operation_id || "-"), latestOp?.last_event_ts)}
          {chainItem("receipt", String(latestOp?.receipt_status || "PENDING"), String(latestOp?.receipt_fact_id || "-"), latestOp?.last_event_ts)}
        </article>
      </section>

      <section className="contentGridTwo alignStart">
        <article className="card sectionBlock">
          <div className="sectionTitle">证据链</div>
          {evidences.map((ev: any) => (
            <div key={ev.job_id} className="kv"><span className="k">{ev.job_id}</span><span className="v"><StatusTag status={String(ev.status || "PENDING")} /></span></div>
          ))}
          {!evidences.length ? <div className="emptyState">最近暂无证据导出记录。可前往证据页查看全量作业。</div> : null}
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
