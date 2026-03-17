import React from "react";
import { fetchAgronomyRecommendationDetail, fetchAgronomyRecommendations, submitRecommendationApproval, type AgronomyRecommendationItemV1 } from "../lib/api";

export default function AgronomyRecommendationsPage(): React.ReactElement {
  const [items, setItems] = React.useState<AgronomyRecommendationItemV1[]>([]);
  const [selected, setSelected] = React.useState<AgronomyRecommendationItemV1 | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");

  async function refreshAndSelect(recommendationId?: string): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const res = await fetchAgronomyRecommendations({ limit: 50 });
      const nextItems = Array.isArray(res.items) ? res.items : [];
      setItems(nextItems);
      const targetId = recommendationId || nextItems?.[0]?.recommendation_id;
      if (targetId) {
        const detail = await fetchAgronomyRecommendationDetail({ recommendation_id: targetId });
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
    <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <section>
        <h3 style={{ marginTop: 0 }}>农业建议列表</h3>
        {loading ? <div>加载中…</div> : null}
        {error ? <div className="err">{error}</div> : null}
        {!loading && !items.length ? <div className="emptyState">暂无建议。</div> : null}
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((item) => (
            <div key={item.recommendation_id} style={{ display: "grid", gap: 6 }}>
              <button
                className="btn"
                style={{ textAlign: "left" }}
                onClick={() => {
                  fetchAgronomyRecommendationDetail({ recommendation_id: item.recommendation_id })
                    .then((res) => setSelected(res.item))
                    .catch((e: any) => setError(String(e?.message ?? e)));
                }}
              >
                <div><b>{item.recommendation_type || "-"}</b></div>
                <div className="mono">recommendation_id: {item.recommendation_id}</div>
                <div className="mono">approval_request_id: {item.approval_request_id || "-"}</div>
                <div className="mono">operation_plan_id: {item.operation_plan_id || "-"}</div>
                <div className="mono">act_task_id: {item.act_task_id || "-"}</div>
                <div className="mono">receipt_fact_id: {item.receipt_fact_id || "-"}</div>
                <div>最新状态：{item.latest_status || item.status || "-"}</div>
                <div>置信度：{item.confidence ?? "-"}</div>
              </button>
              <button
                className="btn"
                onClick={() => {
                  submitRecommendationApproval({ recommendation_id: item.recommendation_id })
                    .then(() => refreshAndSelect(item.recommendation_id))
                    .catch((e: any) => setError(String(e?.message ?? e)));
                }}
                disabled={Boolean(item.approval_request_id)}
              >
                {item.approval_request_id ? "已提交审批" : "提交到审批链"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 style={{ marginTop: 0 }}>建议详情</h3>
        {!selected ? <div className="emptyState">请选择左侧建议。</div> : (
          <div style={{ display: "grid", gap: 8 }}>
            <div><b>recommendation_id：</b><span className="mono">{selected.recommendation_id}</span></div>
            <div><b>approval_request_id：</b><span className="mono">{selected.approval_request_id || "-"}</span></div>
            <div><b>operation_plan_id：</b><span className="mono">{selected.operation_plan_id || "-"}</span></div>
            <div><b>act_task_id：</b><span className="mono">{selected.act_task_id || "-"}</span></div>
            <div><b>receipt_fact_id：</b><span className="mono">{selected.receipt_fact_id || "-"}</span></div>
            <div><b>latest status：</b>{selected.latest_status || selected.status || "-"}</div>
            <div><b>建议类型：</b>{selected.recommendation_type || "-"}</div>
            <div><b>状态：</b>{selected.status}</div>
            <div><b>模型版本：</b>{selected.model_version || "-"}</div>
            <div><b>原因代码：</b>{selected.reason_codes.join(", ") || "-"}</div>
            <div><b>证据引用：</b>{selected.evidence_refs.join(", ") || "-"}</div>
            <div><b>建议动作：</b>{selected.suggested_action?.summary || "-"}</div>
            <div><b>参数：</b><pre className="mono" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(selected.suggested_action?.parameters ?? {}, null, 2)}</pre></div>
            <div><b>规则命中：</b><pre className="mono" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(selected.rule_hit ?? [], null, 2)}</pre></div>
          </div>
        )}
      </section>
    </div>
  );
}
