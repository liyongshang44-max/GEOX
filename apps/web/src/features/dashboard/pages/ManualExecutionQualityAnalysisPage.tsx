import React from "react";
import { Link } from "react-router-dom";
import { fetchManualExecutionQuality, fetchManualExecutionQualityTasks, type ManualExecutionQualityItem, type ManualExecutionTaskDetail } from "../../../api/dashboard";

type DimensionType = "executor" | "team" | "plot";

function toPercent(value: number | null | undefined): string {
  if (!Number.isFinite(Number(value))) return "-";
  return `${Math.round(Number(value) * 100)}%`;
}

function toDuration(value: number | null | undefined): string {
  if (!Number.isFinite(Number(value))) return "-";
  const sec = Math.round(Number(value) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

export default function ManualExecutionQualityAnalysisPage(): React.ReactElement {
  const [dimension, setDimension] = React.useState<DimensionType>("executor");
  const [items, setItems] = React.useState<ManualExecutionQualityItem[]>([]);
  const [kpi, setKpi] = React.useState<{ avg_accept_duration_ms: number | null; on_time_rate: number | null; first_pass_rate: number | null; abnormal_recurrence_rate: number | null }>({ avg_accept_duration_ms: null, on_time_rate: null, first_pass_rate: null, abnormal_recurrence_rate: null });
  const [selected, setSelected] = React.useState<ManualExecutionQualityItem | null>(null);
  const [details, setDetails] = React.useState<ManualExecutionTaskDetail[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const now = Date.now();
      const res = await fetchManualExecutionQuality({ dimension, from_ts_ms: now - 30 * 24 * 60 * 60 * 1000, to_ts_ms: now });
      setItems(res.items ?? []);
      setKpi((res as any).kpi ?? { avg_accept_duration_ms: null, on_time_rate: null, first_pass_rate: null, abnormal_recurrence_rate: null });
      setSelected(null);
      setDetails([]);
    } finally {
      setLoading(false);
    }
  }, [dimension]);

  React.useEffect(() => { void load(); }, [load]);

  const drillDown = async (item: ManualExecutionQualityItem): Promise<void> => {
    setSelected(item);
    const now = Date.now();
    const res = await fetchManualExecutionQualityTasks({
      dimension,
      dimension_id: item.dimension_id,
      from_ts_ms: now - 30 * 24 * 60 * 60 * 1000,
      to_ts_ms: now,
      limit: 100,
    });
    setDetails(res.items ?? []);
  };

  return (
    <div className="productPage" style={{ padding: 20 }}>
      <h1>人工执行 KPI 分析</h1>
      <p>维度：执行人 / 班组 / 地块，支持钻取任务详情并用于派单策略反馈。</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["executor", "team", "plot"] as DimensionType[]).map((d) => (
          <button key={d} onClick={() => setDimension(d)} style={{ padding: "6px 12px", background: dimension === d ? "#2f6feb" : "#fff", color: dimension === d ? "#fff" : "#222", border: "1px solid #d0d7de", borderRadius: 6 }}>
            {d === "executor" ? "执行人" : d === "team" ? "班组" : "地块"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(120px,1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ border: "1px solid #e5e7eb", padding: 12, borderRadius: 8 }}>接单时长：<b>{toDuration(kpi.avg_accept_duration_ms)}</b></div>
        <div style={{ border: "1px solid #e5e7eb", padding: 12, borderRadius: 8 }}>准时率：<b>{toPercent(kpi.on_time_rate)}</b></div>
        <div style={{ border: "1px solid #e5e7eb", padding: 12, borderRadius: 8 }}>一次完成率：<b>{toPercent(kpi.first_pass_rate)}</b></div>
        <div style={{ border: "1px solid #e5e7eb", padding: 12, borderRadius: 8 }}>异常复发率：<b>{toPercent(kpi.abnormal_recurrence_rate)}</b></div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>维度</th>
            <th>总任务</th>
            <th>接单时长</th>
            <th>准时率</th>
            <th>一次完成率</th>
            <th>异常复发率</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(items ?? []).map((item) => (
            <tr key={`${item.dimension}:${item.dimension_id}`}>
              <td>{item.dimension_name}</td>
              <td style={{ textAlign: "center" }}>{item.total_assignments}</td>
              <td style={{ textAlign: "center" }}>{toDuration(item.avg_accept_duration_ms)}</td>
              <td style={{ textAlign: "center" }}>{toPercent(item.on_time_rate)}</td>
              <td style={{ textAlign: "center" }}>{toPercent(item.first_pass_rate)}</td>
              <td style={{ textAlign: "center" }}>{toPercent(item.abnormal_recurrence_rate)}</td>
              <td style={{ textAlign: "right" }}><button onClick={() => void drillDown(item)}>钻取任务</button></td>
            </tr>
          ))}
          {!loading && (!items || items.length < 1) ? <tr><td colSpan={7}>暂无数据</td></tr> : null}
        </tbody>
      </table>

      {selected ? (
        <div>
          <h3>任务详情：{selected.dimension_name}</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>任务ID</th>
                <th>状态</th>
                <th>接单时长</th>
                <th>准时</th>
                <th>一次完成</th>
                <th>异常</th>
                <th style={{ textAlign: "right" }}>跳转</th>
              </tr>
            </thead>
            <tbody>
              {details.map((row) => (
                <tr key={row.assignment_id}>
                  <td>{row.act_task_id}</td>
                  <td style={{ textAlign: "center" }}>{row.status}</td>
                  <td style={{ textAlign: "center" }}>{toDuration(row.accept_duration_ms)}</td>
                  <td style={{ textAlign: "center" }}>{row.on_time ? "是" : "否"}</td>
                  <td style={{ textAlign: "center" }}>{row.first_pass ? "是" : "否"}</td>
                  <td style={{ textAlign: "center" }}>{row.abnormal ? "是" : "否"}</td>
                  <td style={{ textAlign: "right" }}><Link to={`/actions?act_task_id=${encodeURIComponent(row.act_task_id)}`}>查看任务</Link></td>
                </tr>
              ))}
              {details.length < 1 ? <tr><td colSpan={7}>暂无可钻取任务</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
