import React from "react";
import { fetchManualExecutionQuality, type ManualExecutionQualityItem, type ManualExecutionQualityResponse } from "../api/dashboard";

function pct(v: number | null | undefined): string {
  if (!Number.isFinite(Number(v))) return "-";
  return `${Math.round(Number(v) * 100)}%`;
}

function hour(v: number | null | undefined): string {
  if (!Number.isFinite(Number(v))) return "-";
  return `${(Number(v) / 3_600_000).toFixed(1)} 小时`;
}

export default function ManualExecutionAnalysisPage(): React.ReactElement {
  const now = Date.now();
  const [fromTs, setFromTs] = React.useState<number>(now - 7 * 24 * 60 * 60 * 1000);
  const [toTs, setToTs] = React.useState<number>(now);
  const [dimension, setDimension] = React.useState<"team" | "executor">("team");
  const [fieldId, setFieldId] = React.useState<string>("");
  const [actionType, setActionType] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string>("");
  const [data, setData] = React.useState<ManualExecutionQualityResponse | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchManualExecutionQuality({
        from_ts_ms: fromTs,
        to_ts_ms: toTs,
        dimension,
        field_id: fieldId.trim() || undefined,
        action_type: actionType.trim() || undefined,
      });
      setData(result);
    } catch (err: any) {
      setError(String(err?.message ?? "加载失败"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fromTs, toTs, dimension, fieldId, actionType]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const total = (data?.items ?? []).reduce((sum, item) => sum + Number(item.total_assignments ?? 0), 0);
  const alertCount = Number(data?.alerts?.length ?? 0);

  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader" style={{ alignItems: "flex-start", gap: 12 }}>
          <div>
            <div className="eyebrow">GEOX / Dashboard</div>
            <h1 className="pageTitle">人工执行分析</h1>
            <div className="pageLead">按班组/人员查看准时率、一次完成率、回执完整度、异常闭环时长，并输出最小告警。</div>
          </div>
          <button className="btn" disabled={loading} onClick={() => void reload()}>刷新</button>
        </div>
        <div className="operationsSummaryGrid" style={{ marginTop: 12 }}>
          <article className="operationsSummaryMetric"><span className="operationsSummaryLabel">分析记录数</span><strong>{total}</strong></article>
          <article className="operationsSummaryMetric"><span className="operationsSummaryLabel">维度条目</span><strong>{data?.items?.length ?? 0}</strong></article>
          <article className="operationsSummaryMetric"><span className="operationsSummaryLabel">触发告警</span><strong>{alertCount}</strong></article>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <label>维度
            <select className="input" value={dimension} onChange={(e) => setDimension(e.target.value as any)}>
              <option value="team">班组</option>
              <option value="executor">人员</option>
            </select>
          </label>
          <label>地块
            <input className="input" value={fieldId} onChange={(e) => setFieldId(e.target.value)} placeholder="field_id（可选）" />
          </label>
          <label>作业类型
            <input className="input" value={actionType} onChange={(e) => setActionType(e.target.value)} placeholder="如 IRRIGATION" />
          </label>
          <label>开始(ms)
            <input className="input" type="number" value={fromTs} onChange={(e) => setFromTs(Number(e.target.value || 0))} />
          </label>
          <label>结束(ms)
            <input className="input" type="number" value={toTs} onChange={(e) => setToTs(Number(e.target.value || 0))} />
          </label>
          <button className="btn" onClick={() => void reload()} disabled={loading}>应用筛选</button>
        </div>
        {error ? <div className="muted" style={{ marginTop: 10 }}>加载异常：{error}</div> : null}
      </section>

      <section className="card section" style={{ marginTop: 16 }}>
        <h3 className="h3" style={{ marginTop: 0 }}>执行质量明细</h3>
        {loading ? <div className="muted">加载中...</div> : null}
        {!loading && !(data?.items?.length) ? <div className="muted">暂无数据</div> : null}
        {(data?.items ?? []).map((item: ManualExecutionQualityItem) => (
          <article key={`${item.dimension}:${item.dimension_id}`} className="item" style={{ alignItems: "flex-start" }}>
            <div style={{ width: "100%" }}>
              <div className="title">{item.dimension_name}（{item.dimension_id}）</div>
              <div className="meta" style={{ marginTop: 8, gap: 10 }}>
                <span>总任务：{item.total_assignments}</span>
                <span>准时率：{pct(item.on_time_rate)}</span>
                <span>一次完成率：{pct(item.first_pass_rate)}</span>
                <span>回执完整度：{pct(item.receipt_completeness_rate)}</span>
                <span>异常闭环时长：{hour(item.avg_abnormal_closed_loop_ms)}</span>
                <span>连续逾期：{item.overdue_consecutive_streak}</span>
              </div>
              {item.alerts?.length ? (
                <div className="meta" style={{ marginTop: 8 }}>
                  {item.alerts.map((msg) => <span key={msg} className="pill" style={{ background: "#fff1f2", color: "#be123c" }}>{msg}</span>)}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
