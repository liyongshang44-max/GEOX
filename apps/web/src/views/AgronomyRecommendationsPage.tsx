import React from "react";
import { fetchAgronomyRecommendationDetail, fetchAgronomyRecommendations, type AgronomyRecommendationItemV1 } from "../lib/api";

export default function AgronomyRecommendationsPage(): React.ReactElement {
  const [items, setItems] = React.useState<AgronomyRecommendationItemV1[]>([]);
  const [selected, setSelected] = React.useState<AgronomyRecommendationItemV1 | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    setLoading(true);
    setError("");
    fetchAgronomyRecommendations({ limit: 50 })
      .then((res) => {
        setItems(Array.isArray(res.items) ? res.items : []);
        if (res.items?.[0]?.recommendation_id) {
          return fetchAgronomyRecommendationDetail({ recommendation_id: res.items[0].recommendation_id });
        }
        return null;
      })
      .then((detail) => {
        if (detail?.item) setSelected(detail.item);
      })
      .catch((e: any) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
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
            <button
              key={item.recommendation_id}
              className="btn"
              style={{ textAlign: "left" }}
              onClick={() => {
                fetchAgronomyRecommendationDetail({ recommendation_id: item.recommendation_id })
                  .then((res) => setSelected(res.item))
                  .catch((e: any) => setError(String(e?.message ?? e)));
              }}
            >
              <div><b>{item.recommendation_type || "-"}</b></div>
              <div className="mono">{item.recommendation_id}</div>
              <div>状态：{item.status}</div>
              <div>置信度：{item.confidence ?? "-"}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 style={{ marginTop: 0 }}>建议详情</h3>
        {!selected ? <div className="emptyState">请选择左侧建议。</div> : (
          <div style={{ display: "grid", gap: 8 }}>
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
