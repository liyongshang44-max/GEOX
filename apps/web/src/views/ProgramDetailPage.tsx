import React from "react";
import { useParams, Link } from "react-router-dom";
import { fetchProgramControlPlane, fetchProgramDetail, fetchProgramCost, fetchProgramEfficiency, fetchProgramSla, fetchOperationStates, fetchDashboardEvidenceSummary, type ProgramControlPlaneItem } from "../api";
import { RelativeTime, absoluteTime } from "../components/RelativeTime";
import { CopyButton } from "../components/CopyButton";
import StatusBadge from "../components/common/StatusBadge";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ReceiptEvidenceCard from "../components/evidence/ReceiptEvidenceCard";
import { PRODUCT_LABELS } from "../lib/presentation/labels";
import { mapApprovalStatus, mapEvidenceStatus, mapOperationPlanStatus, mapReceiptStatus, mapRecommendationStatus, mapTaskStatus, type StatusPresentation } from "../lib/presentation/statusMap";
import { mapReceiptToVm } from "../viewmodels/evidence";

function fromStatusObject(status: { code?: string | null; label?: string | null; tone?: string | null } | null | undefined, fallback: (code: string | null | undefined) => StatusPresentation): StatusPresentation {
  const base = fallback(status?.code || "UNKNOWN");
  return {
    label: status?.label || base.label,
    tone: (status?.tone as StatusPresentation["tone"]) || base.tone,
    raw: String(status?.code || base.raw || "UNKNOWN"),
  };
}

function chainItem(item: { title?: string; status?: any; refs?: Record<string, string>; ts_label?: string; ts_ms?: number; summary?: string }, fallback: (code: string | null | undefined) => StatusPresentation): React.ReactElement {
  const refs = item.refs ? Object.values(item.refs).filter(Boolean).join(" · ") : "-";
  return (
    <div className="timelineItem">
      <div className="timelineTitle">{item.title || "-"}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <StatusBadge presentation={fromStatusObject(item.status, fallback)} />
        <span className="muted">时间：{item.ts_label || (item.ts_ms ? absoluteTime(item.ts_ms) : "-")}</span>
        <span className="mono">{refs || "-"}</span>
      </div>
      {item.summary ? <div className="muted" style={{ marginTop: 6 }}>{item.summary}</div> : null}
    </div>
  );
}

export default function ProgramDetailPage(): React.ReactElement {
  const { programId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [technical, setTechnical] = React.useState<string | undefined>(undefined);
  const [controlPlane, setControlPlane] = React.useState<ProgramControlPlaneItem | null>(null);
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
    setControlPlane(null);
    try {
      const id = decodeURIComponent(programId);
      try {
        const cp = await fetchProgramControlPlane(id);
        if (cp?.program || cp?.summary) {
          setControlPlane(cp);
          setLoading(false);
          return;
        }
      } catch {
        // fallback to legacy chain
      }

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
  if (error) return <ErrorState title="Program 详情暂不可用" message={error} onRetry={() => void reload()} technical={technical} />;

  if (controlPlane) {
    const p = controlPlane.program || {};
    const summary = controlPlane.summary || {};
    const decisionTimeline = controlPlane.decision_timeline || [];
    const executionTimeline = controlPlane.execution_timeline || [];
    const evidenceList = controlPlane.evidence?.recent_items || [];
    const latestEvidence = (controlPlane as any)?.latestEvidence || (controlPlane as any)?.latest_evidence || evidenceList[0];
    const context = (controlPlane as any)?.context || {};
    const nextActions = Array.isArray((controlPlane as any)?.next_actions)
      ? (controlPlane as any).next_actions
      : ((controlPlane as any)?.next_action ? [(controlPlane as any).next_action] : []);
    return (
      <div className="productPage">
        <section className="card sectionBlock">
          <div className="sectionHeader">
            <div>
              <div className="eyebrow">Program 控制平面</div>
              <h2 className="sectionTitle" style={{ marginTop: 4 }}>{p.title || p.program_id || "-"}</h2>
              <div className="meta wrapMeta">
                <span>{p.subtitle || "-"}</span>
                <span>田块：{context.field_name || context.field_id || p.field_id || "-"}</span>
                <span>季节：{context.season_name || context.season_id || p.season_id || "-"}</span>
                <span>作物：{context.crop_name || context.crop_code || p.crop_code || "-"}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <StatusBadge presentation={fromStatusObject(p.status, mapOperationPlanStatus)} />
              <Link className="btn" to="/audit-export">查看证据</Link>
              <Link className="btn" to="/operations">查看作业</Link>
              <CopyButton value={String(p.program_id || "")} />
            </div>
          </div>
          <div className="muted">最近更新时间：{p.updated_at_label || <RelativeTime value={String(p.updated_ts_ms || "")} />}</div>
          <div className="muted" style={{ marginTop: 6 }}>
            下一步动作：{nextActions.length ? nextActions.map((x: any) => x?.title || x?.label).filter(Boolean).join("；") : "当前暂无待办动作"}
          </div>
        </section>

        <section className="summaryGrid3">
          {[
            { label: "建议状态", value: summary.recommendation, mapper: mapRecommendationStatus },
            { label: "审批状态", value: summary.approval, mapper: mapApprovalStatus },
            { label: PRODUCT_LABELS.operationPlan, value: summary.operation_plan, mapper: mapOperationPlanStatus },
            { label: "执行状态", value: summary.execution, mapper: mapTaskStatus },
            { label: "回执结果", value: summary.receipt, mapper: mapReceiptStatus },
            { label: "证据状态", value: summary.evidence, mapper: mapEvidenceStatus },
          ].map((item) => (
            <div key={item.label} className="card" style={{ padding: 12 }}>
              <div className="muted">{item.label}</div>
              <StatusBadge presentation={fromStatusObject(item.value, item.mapper)} />
            </div>
          ))}
        </section>

        <section className="contentGridTwo alignStart">
          <article className="card sectionBlock">
            <div className="sectionTitle">决策链时间线</div>
            {decisionTimeline.map((item, idx) => <React.Fragment key={`${item.kind}_${idx}`}>{chainItem(item, mapRecommendationStatus)}</React.Fragment>)}
            {!decisionTimeline.length ? <EmptyState title="暂无决策链事件" /> : null}
          </article>

          <article className="card sectionBlock">
            <div className="sectionTitle">执行链时间线</div>
            {executionTimeline.map((item, idx) => <React.Fragment key={`${item.kind}_${idx}`}>{chainItem(item, mapTaskStatus)}</React.Fragment>)}
            {!executionTimeline.length ? <EmptyState title="暂无执行链事件" /> : null}
          </article>
        </section>

        <section className="contentGridTwo alignStart">
          <article className="card sectionBlock">
            <div className="sectionTitle">证据链</div>
            <ReceiptEvidenceCard data={latestEvidence ? mapReceiptToVm(latestEvidence) : undefined} />
            {evidenceList.map((ev, idx) => (
              <div key={`${ev.kind}_${idx}`} className="kv"><span className="k">{ev.title || ev.kind || "证据"}</span><span className="v">{ev.summary || "-"}</span></div>
            ))}
            {!evidenceList.length ? <EmptyState title="最近暂无证据导出记录" description="可前往证据页查看全量导出作业" /> : null}
          </article>

          <article className="card sectionBlock">
            <div className="sectionTitle">资源与结果</div>
            <div className="kv"><span className="k">用水量（L）</span><span className="v">{String(controlPlane.resources?.water_l ?? "-")}</span></div>
            <div className="kv"><span className="k">用电量（kWh）</span><span className="v">{String(controlPlane.resources?.electric_kwh ?? "-")}</span></div>
            <div className="kv"><span className="k">药剂用量（ml）</span><span className="v">{String(controlPlane.resources?.chemical_ml ?? "-")}</span></div>
            <div className="kv"><span className="k">燃料用量（L）</span><span className="v">{String(controlPlane.resources?.fuel_l ?? "-")}</span></div>
            <div className="kv"><span className="k">执行结果</span><span className="v">{String(controlPlane.execution_result?.result_label || "-")}</span></div>
          </article>
        </section>

        <section className="card sectionBlock">
          <button className="btn" onClick={() => setShowTech((s) => !s)}>{showTech ? "收起技术细节" : "展开技术细节"}</button>
          {showTech ? <pre className="mono" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{JSON.stringify(controlPlane.technical_details || {}, null, 2)}</pre> : null}
        </section>
      </div>
    );
  }

  if (!detail) return <ErrorState title="Program 详情暂不可用" message="当前暂无 Program 详情数据" onRetry={() => void reload()} technical={technical} />;

  const latestOp = ops[0];
  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">Program 控制平面</div>
            <h2 className="sectionTitle" style={{ marginTop: 4 }}>{String(detail?.program_id || "-")}</h2>
          </div>
        </div>
      </section>
      <section className="card sectionBlock">
        <div className="sectionTitle">执行证据</div>
        <ReceiptEvidenceCard data={detail?.latestEvidence ? mapReceiptToVm(detail.latestEvidence) : undefined} />
      </section>
      <section className="card sectionBlock">
        <div className="kv"><span className="k">water_l</span><span className="v">{String(cost?.water_l ?? "-")}</span></div>
        <div className="kv"><span className="k">observed_parameters</span><span className="v">{String(efficiency?.observed_parameters_count ?? "-")}</span></div>
        <div className="kv"><span className="k">constraint_check</span><span className="v">{String(sla?.constraint_check || "-")}</span></div>
        <div className="kv"><span className="k">task_id</span><span className="v">{String(latestOp?.task_id || "-")}</span></div>
      </section>
    </div>
  );
}
