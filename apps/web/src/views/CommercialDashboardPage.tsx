import React from "react";
import { Link } from "react-router-dom";
import { type DashboardTrendSeries } from "../api";
import { useDashboard } from "../hooks/useDashboard";

type DashboardProps = { expert: boolean };

function fmtTs(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "-";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtIso(iso: string | null | undefined): string {
  if (typeof iso !== "string" || !iso.trim()) return "-";
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? fmtTs(ms) : iso;
}


function metricTitle(metric: string): string {
  if (metric === "soil_moisture") return "土壤湿度趋势";
  if (metric === "soil_temp" || metric === "soil_temp_c") return "土壤温度趋势";
  return metric || "指标趋势";
}

function metricUnit(metric: string): string {
  if (metric === "soil_moisture") return "%";
  if (metric === "soil_temp" || metric === "soil_temp_c") return "°C";
  return "";
}

function statusTone(status: string): string {
  if (status === "OPEN" || status === "ACKED") return "warn";
  if (status === "executed" || status === "DONE") return "ok";
  if (status === "ERROR" || status === "failed") return "bad";
  return "default";
}

function actionLabel(key: string, fallback: string): string {
  if (key === "create_operation") return "一键创建作业";
  if (key === "export_evidence") return "一键导出证据包";
  if (key === "ack_alerts") return "告警快捷确认";
  return fallback;
}

function buildSparklinePath(series: DashboardTrendSeries): { path: string; lastLabel: string } {
  const values = series.points.map((point) => point.avg_value_num).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length < 1) return { path: "", lastLabel: "暂无数据" };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 100;
  const height = 40;
  const denom = Math.max(1, series.points.length - 1);
  const pathParts: string[] = [];
  let lastValue: number | null = null;
  series.points.forEach((point, index) => {
    const value = point.avg_value_num;
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    const x = (index / denom) * width;
    const y = max === min ? height / 2 : height - ((value - min) / (max - min)) * height;
    pathParts.push(`${pathParts.length < 1 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
    lastValue = value;
  });
  const unit = metricUnit(series.metric);
  return { path: pathParts.join(" "), lastLabel: lastValue == null ? "暂无数据" : `${lastValue}${unit}` };
}

export default function CommercialDashboardPage({ expert }: DashboardProps): React.ReactElement {
  const { overview, session, loading, message } = useDashboard();

  const summary = overview?.summary ?? { field_count: 0, online_device_count: 0, open_alert_count: 0, running_task_count: 0 };
  const trendSeries = overview?.trend_series ?? [];
  const latestAlerts = overview?.latest_alerts ?? [];
  const latestReceipts = overview?.latest_receipts ?? [];
  const quickActions = overview?.quick_actions ?? [];

  return (
    <div className="consolePage">
      <section className="hero card">
        <div>
          <div className="eyebrow">Commercial v1 · Sprint P2</div>
          <h2 className="heroTitle">农业运营控制台</h2>
          <p className="heroText">首页现在直接对齐蓝图中的商业总览面：展示地块、在线设备、告警、进行中作业四张关键卡片，默认土壤湿度/温度趋势，以及最新告警与最新作业回执 Top 10。</p>
        </div>
        <div className="heroActions">
          {quickActions.map((action) => (
            <Link key={action.key} className={`btn ${action.key === "create_operation" ? "primary" : ""}`.trim()} to={action.to}>{actionLabel(action.key, action.label)}</Link>
          ))}
          {!quickActions.length ? <Link className="btn primary" to="/operations">进入作业控制</Link> : null}
        </div>
      </section>

      <section className="summaryGrid">
        <div className="metricCard card"><div className="metricLabel">地块数</div><div className="metricValue">{summary.field_count}</div><div className="metricHint">当前租户田块总数</div></div>
        <div className="metricCard card"><div className="metricLabel">在线设备数</div><div className="metricValue">{summary.online_device_count}</div><div className="metricHint">最近 15 分钟心跳在线</div></div>
        <div className="metricCard card"><div className="metricLabel">告警数</div><div className="metricValue">{summary.open_alert_count}</div><div className="metricHint">OPEN + ACKED 活跃事件</div></div>
        <div className="metricCard card"><div className="metricLabel">进行中作业数</div><div className="metricValue">{summary.running_task_count}</div><div className="metricHint">队列中 READY / LEASED / PUBLISHED / ACKED</div></div>
      </section>

      <div className="contentGridTwo alignStart">
        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">关键指标趋势</div><div className="sectionDesc">默认展示最近 24 小时的土壤湿度与土壤温度趋势。</div></div></div>
          <div className="moduleGrid">
            {trendSeries.map((series) => {
              const sparkline = buildSparklinePath(series);
              return (
                <div key={series.metric} className="moduleCard">
                  <div className="moduleTitle">{metricTitle(series.metric)}</div>
                  <div className="moduleDesc">最近值：{sparkline.lastLabel}</div>
                  <div style={{ borderRadius: 12, background: "#f8fafc", border: "1px solid rgba(0,0,0,0.06)", padding: 12 }}>
                    {sparkline.path ? <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: "100%", height: 88 }}><path d={sparkline.path} fill="none" stroke="currentColor" strokeWidth="2" /></svg> : <div className="emptyState" style={{ minHeight: 88, display: "flex", alignItems: "center", justifyContent: "center" }}>暂无趋势数据</div>}
                  </div>
                  <div className="moduleDesc">时间窗：{fmtTs(overview?.window.from_ts_ms)} → {fmtTs(overview?.window.to_ts_ms)}</div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">当前会话与快捷入口</div><div className="sectionDesc">用最少信息判断当前环境是否处在可演示状态。</div></div><Link className="btn" to="/settings">查看系统设置</Link></div>
          <div className="statusCallout">{loading ? "正在同步首页总览..." : (message || "-")}</div>
          <div className="snapshotRows" style={{ marginTop: 14 }}>
            <div className="kv"><span className="k">角色</span><span className="v">{session?.role === "operator" ? "操作员" : session?.role === "admin" ? "管理员" : "未识别"}</span></div>
            <div className="kv"><span className="k">窗口起点</span><span className="v">{fmtTs(overview?.window.from_ts_ms)}</span></div>
            <div className="kv"><span className="k">窗口终点</span><span className="v">{fmtTs(overview?.window.to_ts_ms)}</span></div>
            <div className="kv"><span className="k">研发模式</span><span className="v">{expert ? "开启" : "关闭"}</span></div>
          </div>
        </section>
      </div>

      <div className="contentGridTwo alignStart">
        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">最新告警 Top 10</div><div className="sectionDesc">首页直接展示最近触发的告警。</div></div><Link className="btn" to="/alerts">进入告警中心</Link></div>
          <div className="timelineList compactTimeline">
            {latestAlerts.length ? latestAlerts.map((item) => (
              <div key={item.event_id} className="timelineItem"><strong>{item.metric}</strong><span><span className={`pill tone-${statusTone(item.status)}`}>{item.status}</span><span style={{ marginLeft: 8 }}>{item.object_type}:{item.object_id}</span><span style={{ marginLeft: 8, color: "#6b7280" }}>{fmtTs(item.raised_ts_ms)}</span></span></div>
            )) : <div className="emptyState">当前没有可展示的告警事件。</div>}
          </div>
        </section>
        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">最新作业回执 Top 10</div><div className="sectionDesc">首页直接展示最新设备回执。</div></div><Link className="btn" to="/operations">进入作业控制</Link></div>
          <div className="timelineList compactTimeline">
            {latestReceipts.length ? latestReceipts.map((item) => (
              <div key={item.fact_id} className="timelineItem"><strong>{item.device_id || item.act_task_id || item.fact_id}</strong><span><span className={`pill tone-${statusTone(item.status || "")}`}>{item.status || "UNKNOWN"}</span><span style={{ marginLeft: 8 }}>{item.act_task_id || "-"}</span><span style={{ marginLeft: 8, color: "#6b7280" }}>{fmtIso(item.occurred_at)}</span></span></div>
            )) : <div className="emptyState">当前没有可展示的作业回执。</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
