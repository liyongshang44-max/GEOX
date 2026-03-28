import React from "react";
import { Link, useParams } from "react-router-dom";
import EmptyState from "../components/common/EmptyState";
import ReceiptEvidenceCard from "../components/evidence/ReceiptEvidenceCard";
import { fetchDashboardEvidenceSummary } from "../api/dashboard";
import { fetchOperationStates } from "../api/operations";
import { mapDashboardEvidenceToVm } from "../viewmodels/evidence";
import { resolveTimelineLabel } from "../viewmodels/timelineLabels";

export default function OperationDetailPage(): React.ReactElement {
  const { operationPlanId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [op, setOp] = React.useState<any>(null);
  const [evidence, setEvidence] = React.useState<any>(null);

  React.useEffect(() => {
    let mounted = true;
    async function load(): Promise<void> {
      setLoading(true);
      try {
        const [opsRes, evidenceItems] = await Promise.all([
          fetchOperationStates({ limit: 500 }).catch(() => ({ items: [] as any[] })),
          fetchDashboardEvidenceSummary(50).catch(() => [] as any[]),
        ]);
        if (!mounted) return;
        const opItem = (opsRes.items || []).find((x: any) => String(x?.operation_id || x?.operation_plan_id || "") === operationPlanId) || null;
        const evItem = (evidenceItems || []).find((x: any) => String(x?.operation_plan_id || "") === operationPlanId) || null;
        setOp(opItem);
        setEvidence(evItem);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [operationPlanId]);

  if (loading) return <div className="card" style={{ padding: 16 }}>加载中...</div>;
  if (!op && !evidence) return <EmptyState title="作业详情暂不可用" description="未找到对应作业，请返回重试" />;

  const statusLabel = resolveTimelineLabel({ operationPlanStatus: op?.final_status || evidence?.status, dispatchState: op?.dispatch_status });
  const fieldLabel = String(op?.field_id || evidence?.field_name || evidence?.field_id || "-");
  const programLabel = String(op?.program_id || evidence?.program_name || "-");
  const evidenceVm = evidence ? mapDashboardEvidenceToVm(evidence) : undefined;
  const timeline = Array.isArray(op?.timeline) ? op.timeline : [];

  return (
    <div className="productPage" style={{ display: "grid", gap: 14 }}>
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">作业详情</div>
            <div className="muted">operation_plan_id：{operationPlanId}</div>
          </div>
          <Link className="btn" to="/operations">返回作业列表</Link>
        </div>
        <div className="kv"><span className="k">作业状态</span><span className="v">{statusLabel}</span></div>
        <div className="kv"><span className="k">所属田块</span><span className="v">{fieldLabel}</span></div>
        <div className="kv"><span className="k">所属经营方案</span><span className="v">{programLabel}</span></div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionTitle">最新执行证据</div>
        <ReceiptEvidenceCard data={evidenceVm} />
      </section>

      <section className="card sectionBlock">
        <div className="sectionTitle">执行时间线</div>
        <div style={{ display: "grid", gap: 8 }}>
          {timeline.map((item: any, idx: number) => (
            <div key={`${idx}_${item?.ts || 0}`} className="kv">
              <span className="k">[{new Date(Number(item?.ts || Date.now())).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}]</span>
              <span className="v">{resolveTimelineLabel({ factType: item?.type, operationPlanStatus: item?.status, dispatchState: item?.dispatch_state })}</span>
            </div>
          ))}
          {!timeline.length ? <div className="muted">暂无执行时间线</div> : null}
        </div>
      </section>

      <section className="card sectionBlock">
        <button className="btn" type="button">下载证据包</button>
      </section>
    </div>
  );
}
