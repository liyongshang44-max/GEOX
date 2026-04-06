import React from "react";
import { Link } from "react-router-dom";
import { fetchHumanOpsExceptionAnalysis, fetchHumanOpsKpi, fetchHumanOpsRanking } from "../api/humanOps";

function pct(v: number | null | undefined): string {
  if (!Number.isFinite(Number(v))) return "-";
  return `${Math.round(Number(v) * 100)}%`;
}

function mins(v: number | null | undefined): string {
  if (!Number.isFinite(Number(v))) return "-";
  return `${Math.round(Number(v) / 60_000)} 分钟`;
}

export default function HumanOpsAnalyticsPage(): React.ReactElement {
  const now = Date.now();
  const [tenantId, setTenantId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [groupId, setGroupId] = React.useState("");
  const [fromTs, setFromTs] = React.useState(now - 7 * 24 * 60 * 60 * 1000);
  const [toTs, setToTs] = React.useState(now);
  const [dimension, setDimension] = React.useState<"executor" | "team">("executor");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [kpi, setKpi] = React.useState<any>(null);
  const [ranking, setRanking] = React.useState<any[]>([]);
  const [exceptions, setExceptions] = React.useState<any[]>([]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const filters = {
        tenant_id: tenantId.trim() || undefined,
        project_id: projectId.trim() || undefined,
        group_id: groupId.trim() || undefined,
        from_ts_ms: fromTs,
        to_ts_ms: toTs,
      };
      const [k, r, e] = await Promise.all([
        fetchHumanOpsKpi(filters),
        fetchHumanOpsRanking({ ...filters, dimension, limit: 20 }),
        fetchHumanOpsExceptionAnalysis({ ...filters, limit: 20 }),
      ]);
      setKpi(k);
      setRanking(Array.isArray(r.items) ? r.items : []);
      setExceptions(Array.isArray(e.items) ? e.items : []);
    } catch (err: any) {
      setError(String(err?.message ?? "加载失败"));
      setKpi(null);
      setRanking([]);
      setExceptions([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, projectId, groupId, fromTs, toTs, dimension]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader" style={{ alignItems: "flex-start" }}>
          <div>
            <div className="eyebrow">GEOX / Human Ops</div>
            <h1 className="pageTitle">人工执行分析</h1>
            <div className="pageLead">KPI 卡片 + 趋势 + 执行人/班组排行 + 异常分布，并支持钻取复盘。</div>
          </div>
          <button className="btn" onClick={() => void reload()} disabled={loading}>刷新</button>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <input className="input" placeholder="tenant_id (可选)" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
          <input className="input" placeholder="project_id (可选)" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
          <input className="input" placeholder="group_id (可选)" value={groupId} onChange={(e) => setGroupId(e.target.value)} />
          <input className="input" type="number" value={fromTs} onChange={(e) => setFromTs(Number(e.target.value || 0))} />
          <input className="input" type="number" value={toTs} onChange={(e) => setToTs(Number(e.target.value || 0))} />
          <select className="input" value={dimension} onChange={(e) => setDimension(e.target.value as any)}>
            <option value="executor">执行人排行</option>
            <option value="team">班组排行</option>
          </select>
          <button className="btn" onClick={() => void reload()} disabled={loading}>应用筛选</button>
        </div>
        {error ? <div className="muted" style={{ marginTop: 8 }}>加载异常：{error}</div> : null}
      </section>

      <section className="card section" style={{ marginTop: 16 }}>
        <div className="operationsSummaryGrid">
          <article className="operationsSummaryMetric"><span className="operationsSummaryLabel">准时率</span><strong>{pct(kpi?.kpi?.on_time_rate)}</strong></article>
          <article className="operationsSummaryMetric"><span className="operationsSummaryLabel">接单时长</span><strong>{mins(kpi?.kpi?.avg_accept_duration_ms)}</strong></article>
          <article className="operationsSummaryMetric"><span className="operationsSummaryLabel">提交时长</span><strong>{mins(kpi?.kpi?.avg_submit_duration_ms)}</strong></article>
          <article className="operationsSummaryMetric"><span className="operationsSummaryLabel">一次完成率</span><strong>{pct(kpi?.kpi?.first_pass_rate)}</strong></article>
        </div>
        <div style={{ marginTop: 12 }}>
          <h3 className="h3" style={{ marginTop: 0 }}>趋势</h3>
          <div className="list">
            {(kpi?.trend ?? []).map((x: any) => (
              <article className="item" key={x.date_bucket}>
                <div className="title">{x.date_bucket}</div>
                <div className="meta">
                  <span>总任务：{x.total_assignments}</span>
                  <span>提交数：{x.submitted_count}</span>
                  <span>准时率：{pct(x.on_time_rate)}</span>
                  <span>一次完成率：{pct(x.first_pass_rate)}</span>
                </div>
              </article>
            ))}
            {loading ? <div className="muted">加载中...</div> : null}
            {!loading && !(kpi?.trend?.length) ? <div className="muted">暂无趋势数据</div> : null}
          </div>
        </div>
      </section>

      <section className="card section" style={{ marginTop: 16 }}>
        <h3 className="h3" style={{ marginTop: 0 }}>{dimension === "executor" ? "执行人排行" : "班组排行"}</h3>
        <div className="list">
          {ranking.map((x) => (
            <article className="item" key={`${x.dimension_id}-${x.rank}`}>
              <div className="title">#{x.rank} {x.dimension_id}</div>
              <div className="meta">
                <span>总任务：{x.total_assignments}</span>
                <span>准时率：{pct(x.on_time_rate)}</span>
                <span>一次完成率：{pct(x.first_pass_rate)}</span>
                <span>接单：{mins(x.avg_accept_duration_ms)}</span>
                <span>提交：{mins(x.avg_submit_duration_ms)}</span>
              </div>
            </article>
          ))}
          {!loading && !ranking.length ? <div className="muted">暂无排行数据</div> : null}
        </div>
      </section>

      <section className="card section" style={{ marginTop: 16 }}>
        <h3 className="h3" style={{ marginTop: 0 }}>异常分布</h3>
        <div className="list">
          {exceptions.map((x) => (
            <article className="item" key={x.exception_code}>
              <div>
                <div className="title">{x.exception_code}</div>
                <div className="meta"><span>数量：{x.count}</span><span>样本任务：{x.sample_task_id || "-"}</span></div>
              </div>
              {x.sample_task_id ? <Link className="btn" to={`/human-assignments?act_task_id=${encodeURIComponent(x.sample_task_id)}`}>钻取任务</Link> : null}
            </article>
          ))}
          {!loading && !exceptions.length ? <div className="muted">暂无异常数据</div> : null}
        </div>
      </section>
    </div>
  );
}
