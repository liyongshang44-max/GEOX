import React from "react";
import {
  fetchAgronomyRecommendationDetailControlPlane,
  fetchAgronomyRecommendationsControlPlane,
  submitRecommendationApproval,
} from "../lib/api";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import StatusBadge from "../components/common/StatusBadge";
import { RelativeTime } from "../components/RelativeTime";

type ListItem = any;
type DetailItem = any;

function shortId(value: string | null | undefined): string {
  const id = String(value ?? "").trim();
  if (!id) return "-";
  return id.length <= 16 ? id : `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function StepChain({ steps }: { steps: Array<{ label: string; done: boolean }> }): React.ReactElement {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
      {steps.map((step, idx) => (
        <React.Fragment key={step.label}>
          <span style={{ fontSize: 11, color: step.done ? "#1d1d1f" : "#8a8a8f", fontWeight: step.done ? 600 : 400 }}>{step.label}</span>
          {idx < steps.length - 1 ? <span style={{ color: "#b1b1b6", fontSize: 11 }}>→</span> : null}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function AgronomyRecommendationsPage(): React.ReactElement {
  const [items, setItems] = React.useState<ListItem[]>([]);
  const [summary, setSummary] = React.useState<{ total: number; pending: number; in_approval: number; receipted: number }>({ total: 0, pending: 0, in_approval: 0, receipted: 0 });
  const [selected, setSelected] = React.useState<DetailItem | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");

  async function refreshAndSelect(recommendationId?: string): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const res = await fetchAgronomyRecommendationsControlPlane({ limit: 50 });
      const nextItems = Array.isArray(res.items) ? res.items : [];
      setItems(nextItems);
      setSummary(res.summary ?? { total: nextItems.length, pending: 0, in_approval: 0, receipted: 0 });
      const targetId = recommendationId || nextItems?.[0]?.recommendation_id;
      if (targetId) {
        const detail = await fetchAgronomyRecommendationDetailControlPlane({ recommendation_id: targetId });
        setSelected(detail.item);
      } else {
        setSelected(null);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void refreshAndSelect();
  }, []);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>农业建议控制台</h2>
        <div className="muted" style={{ marginTop: 4 }}>以产品语言呈现建议、审批与执行链路，便于快速识别待处理项。</div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
        <div className="card" style={{ padding: 12 }}><div className="muted">总建议</div><div style={{ fontSize: 20, fontWeight: 700 }}>{summary.total}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">待处理</div><div style={{ fontSize: 20, fontWeight: 700 }}>{summary.pending}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">审批中</div><div style={{ fontSize: 20, fontWeight: 700 }}>{summary.in_approval}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">已回执</div><div style={{ fontSize: 20, fontWeight: 700 }}>{summary.receipted}</div></div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14 }}>
        <section className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>建议列表</h3>
            <span className="muted">共 {items.length} 条</span>
          </div>
          {loading ? <div className="muted">加载中…</div> : null}
          {error ? <ErrorState title="建议数据加载失败" message="请稍后重试，或检查后端服务状态。" technical={error} onRetry={() => void refreshAndSelect()} /> : null}
          {!loading && !items.length ? <EmptyState title="当前暂无农业建议" description="系统会在下一轮规则评估后补充建议" /> : null}
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((item) => (
              <div key={item.recommendation_id} className="card" style={{ padding: 16, borderColor: selected?.recommendation?.recommendation_id === item.recommendation_id ? "#111" : undefined, display: "grid", gap: 10 }}>
                <button className="btn" style={{ justifyContent: "space-between", background: "transparent", border: "none", padding: 0 }} onClick={() => {
                  fetchAgronomyRecommendationDetailControlPlane({ recommendation_id: item.recommendation_id })
                    .then((res) => setSelected(res.item))
                    .catch((e: any) => setError(String(e?.message ?? e)));
                }}>
                  <div style={{ display: "grid", gap: 8, textAlign: "left", width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <h4 style={{ margin: 0, fontSize: 15 }}>{item.title}</h4>
                      <StatusBadge status={item?.status?.code || item?.status?.label || "PENDING"} />
                    </div>

                    <div className="muted">建议单号：<span className="mono">{shortId(item.recommendation_id)}</span></div>
                    <div>{item.reason_summary || "-"}</div>
                    <StepChain steps={Array.isArray(item?.progress?.steps) ? item.progress.steps : []} />

                    <div className="muted" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span>证据数 {item.evidence_count ?? 0}</span>
                      <span>规则数 {item.rule_count ?? 0}</span>
                      <span>置信度 {item.confidence ?? "-"}</span>
                      <span>更新时间 <RelativeTime value={item.updated_ts_ms || item.updated_at} /></span>
                    </div>
                  </div>
                </button>
                {!item.linked_refs?.approval_request_id ? (
                  <button
                    className="btn primary"
                    onClick={() => {
                      submitRecommendationApproval({ recommendation_id: item.recommendation_id })
                        .then(() => refreshAndSelect(item.recommendation_id))
                        .catch((e: any) => setError(String(e?.message ?? e)));
                    }}
                  >
                    提交到审批链
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>建议详情</h3>
          {!selected ? <EmptyState title="请选择左侧建议" description="可查看建议原因、链路状态与关联审批信息" /> : (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="infoCard">
                <div className="title">A. 建议动作</div>
                <div style={{ marginTop: 6 }}><b>{selected?.suggested_action?.title || "建议动作"}</b></div>
                <div className="muted">{selected?.suggested_action?.summary || "-"}</div>
              </div>

              <div className="infoCard">
                <div className="title">B. 触发原因</div>
                <div style={{ marginTop: 6 }}>
                  {selected?.reasoning?.trigger_reason && selected.reasoning.trigger_reason !== "其他原因" ? selected.reasoning.trigger_reason : "触发原因：监测指标出现异常波动，建议尽快处理。"}
                </div>
                <div className="muted" style={{ marginTop: 6 }}>
                  {(selected?.reasoning?.rule_hits || []).map((hit: any) => `${hit.label}: ${hit.summary}`).join("；") || "暂无规则说明"}
                </div>
              </div>

              <div className="infoCard">
                <div className="title">C. 当前链路状态</div>
                <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                  <div>审批：{selected?.pipeline?.approval?.status?.label || "-"}</div>
                  <div>作业计划：{selected?.pipeline?.operation_plan?.status?.label || "-"}</div>
                  <div>作业执行：{selected?.pipeline?.execution?.status?.label || "-"}</div>
                  <div>执行回执：{selected?.pipeline?.receipt?.status?.label || "-"}</div>
                </div>
              </div>

              <details>
                <summary className="muted">D. 技术折叠区</summary>
                <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                  <div><b>recommendation_id：</b><span className="mono">{selected?.technical_details?.recommendation_id || "-"}</span></div>
                  <div><b>approval_request_id：</b><span className="mono">{selected?.technical_details?.approval_request_id || "-"}</span></div>
                  <div><b>operation_plan_id：</b><span className="mono">{selected?.technical_details?.operation_plan_id || "-"}</span></div>
                  <div><b>act_task_id：</b><span className="mono">{selected?.technical_details?.act_task_id || "-"}</span></div>
                  <div><b>raw_status：</b><span className="mono">{selected?.technical_details?.raw_status || "-"}</span></div>
                </div>
              </details>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
