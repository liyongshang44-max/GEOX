import React from "react";
import { Link } from "react-router-dom";
import { fetchAuditExportOverview, type AuditExportOverview, type AuditOverviewObjectType } from "../lib/api";

const TOKEN_KEY = "geox_ao_act_token";

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem("geox_ao_act_token") || "";
  } catch {
    return "";
  }
}

function fmtTs(v: number | string | null | undefined): string {
  if (typeof v === "number") return v > 0 ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "-";
  if (typeof v === "string" && v.trim()) {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? new Date(ms).toLocaleString("zh-CN", { hour12: false }) : v;
  }
  return "-";
}

function defaultFromTs(): string {
  return String(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

function defaultToTs(): string {
  return String(Date.now() + 60 * 1000);
}

function summaryValue(v: number): string {
  return Number.isFinite(v) ? String(v) : "0";
}

export default function AuditExportPage(): React.ReactElement {
  const [token, setToken] = React.useState<string>(() => readToken());
  const [fieldId, setFieldId] = React.useState<string>("");
  const [deviceId, setDeviceId] = React.useState<string>("");
  const [objectType, setObjectType] = React.useState<AuditOverviewObjectType>("ALL");
  const [fromTs, setFromTs] = React.useState<string>(defaultFromTs());
  const [toTs, setToTs] = React.useState<string>(defaultToTs());
  const [busy, setBusy] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState<string>("正在准备审计与导出视图...");
  const [overview, setOverview] = React.useState<AuditExportOverview | null>(null);

  function persistToken(next: string): void {
    setToken(next);
    try { localStorage.setItem(TOKEN_KEY, next); } catch { /* ignore */ }
  }

  async function refresh(): Promise<void> {
    setBusy(true);
    setStatus("正在读取审计与导出总表...");
    try {
      const next = await fetchAuditExportOverview(token, {
        field_id: fieldId || undefined,
        device_id: deviceId || undefined,
        object_type: objectType,
        from_ts_ms: Number(fromTs),
        to_ts_ms: Number(toTs),
        limit: 10,
      });
      setOverview(next);
      setStatus("审计与导出总表已更新。");
    } catch (e: any) {
      setStatus(`读取失败：${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = overview?.summary ?? { export_job_count: 0, alert_event_count: 0, open_alert_count: 0, approval_count: 0, dispatch_count: 0, receipt_count: 0 };

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Audit / Export · Sprint W1</div>
          <h2 className="heroTitle">审计与导出</h2>
          <p className="heroText">把导出任务、告警、回执和控制动作汇总到一个中文运营台里，先解决“查得到、追得回、导得出”。</p>
        </div>
        <div className="heroActions">
          <Link className="btn" to="/delivery/export-jobs">进入证据导出</Link>
          <button className="btn primary" onClick={() => void refresh()} disabled={busy}>刷新总表</button>
        </div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">筛选条件</div>
            <div className="sectionDesc">支持按田块、设备、时间窗口和对象类型聚合查看。统一收口导出、告警、回执与控制动作，作为演示与排障的总表页。</div>
          </div>
        </div>
        <div className="formGrid fourCols">
          <label className="field">访问令牌<input className="input" value={token} onChange={(e) => persistToken(e.target.value)} /></label>
          <label className="field">田块 ID<input className="input" value={fieldId} onChange={(e) => setFieldId(e.target.value)} placeholder="field_demo_001" /></label>
          <label className="field">设备 ID<input className="input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="dev_001" /></label>
          <label className="field">对象类型
            <select className="select" value={objectType} onChange={(e) => setObjectType(e.target.value as AuditOverviewObjectType)}>
              <option value="ALL">全部对象</option>
              <option value="EXPORT">仅导出任务</option>
              <option value="ALERT">仅告警事件</option>
              <option value="RECEIPT">仅设备回执</option>
              <option value="APPROVAL">仅审批</option>
              <option value="DISPATCH">仅调度动作</option>
            </select>
          </label>
        </div>
        <div className="formGrid twoCols" style={{ marginTop: 12 }}>
          <label className="field">起始时间（ms）<input className="input" value={fromTs} onChange={(e) => setFromTs(e.target.value)} /></label>
          <label className="field">结束时间（ms）<input className="input" value={toTs} onChange={(e) => setToTs(e.target.value)} /></label>
        </div>
      </section>

      <div className="summaryGrid">
        <div className="metricCard card"><div className="metricLabel">导出任务</div><div className="metricValue">{summaryValue(summary.export_job_count)}</div><div className="metricHint">最近窗口内 evidence export jobs</div></div>
        <div className="metricCard card"><div className="metricLabel">告警事件</div><div className="metricValue">{summaryValue(summary.alert_event_count)}</div><div className="metricHint">其中 OPEN：{summaryValue(summary.open_alert_count)}</div></div>
        <div className="metricCard card"><div className="metricLabel">审批</div><div className="metricValue">{summaryValue(summary.approval_count)}</div><div className="metricHint">最近审批请求</div></div>
        <div className="metricCard card"><div className="metricLabel">调度 / 回执</div><div className="metricValue">{summaryValue(summary.dispatch_count)} / {summaryValue(summary.receipt_count)}</div><div className="metricHint">最近控制动作闭环</div></div>
      </div>

      <section className="card sectionBlock statusPanel">
        <div className="sectionHeader"><div><div className="sectionTitle">运行状态</div><div className="sectionDesc">总表页优先展示当前窗口内的汇总结果与最近动作，不直接暴露内部实现细节。</div></div></div>
        <div className="kv"><span className="k">状态消息</span><span className="v statusText">{status}</span></div>
        <div className="kv"><span className="k">当前对象过滤</span><span className="v">{objectType}</span></div>
        <div className="kv"><span className="k">字段过滤</span><span className="v">{fieldId || "-"}</span></div>
        <div className="kv"><span className="k">设备过滤</span><span className="v">{deviceId || "-"}</span></div>
      </section>

      <div className="contentGridTwo alignStart">
        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">导出任务总表</div><div className="sectionDesc">可快速定位 evidence pack 生成情况，再跳转到导出页下载。</div></div></div>
          <div className="list modernList compactList">
            {(overview?.export_jobs ?? []).map((job) => (
              <Link key={job.job_id} className="infoCard linkCard" to="/delivery/export-jobs">
                <div className="jobTitleRow"><div className="title">{job.job_id}</div><div className="pill">{job.status}</div></div>
                <div className="meta wrapMeta"><span>范围：{job.scope_type}</span><span>对象：{job.scope_id || "TENANT"}</span><span>更新：{fmtTs(job.updated_ts_ms)}</span></div>
              </Link>
            ))}
            {!(overview?.export_jobs?.length) ? <div className="emptyState">当前筛选下没有导出任务。</div> : null}
          </div>
        </section>

        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">最近告警事件</div><div className="sectionDesc">帮助运营人员快速从导出视图跳到异常对象。</div></div></div>
          <div className="list modernList compactList">
            {(overview?.alert_events ?? []).map((event) => (
              <Link key={event.event_id} className="infoCard linkCard" to="/alerts">
                <div className="jobTitleRow"><div className="title">{event.metric}</div><div className={`pill tone-${event.status === "OPEN" ? "bad" : event.status === "ACKED" ? "warn" : "ok"}`}>{event.status}</div></div>
                <div className="meta wrapMeta"><span>{event.object_type}</span><span>{event.object_id}</span><span>触发：{fmtTs(event.raised_ts_ms)}</span></div>
              </Link>
            ))}
            {!(overview?.alert_events?.length) ? <div className="emptyState">当前筛选下没有告警事件。</div> : null}
          </div>
        </section>
      </div>

      <div className="contentGridTwo alignStart">
        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">最近设备回执</div><div className="sectionDesc">用于确认控制链是否真正闭环到设备。</div></div></div>
          <div className="list modernList compactList">
            {(overview?.receipts ?? []).map((item) => (
              <div key={item.fact_id} className="infoCard">
                <div className="jobTitleRow"><div className="title">{item.device_id || "未知设备"}</div><div className="pill">{item.status}</div></div>
                <div className="meta wrapMeta"><span>任务：{item.act_task_id || "-"}</span><span>田块：{item.field_id || "-"}</span><span>时间：{fmtTs(item.occurred_at)}</span></div>
              </div>
            ))}
            {!(overview?.receipts?.length) ? <div className="emptyState">当前筛选下没有设备回执。</div> : null}
          </div>
        </section>

        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">最近审批与调度</div><div className="sectionDesc">先把审批与调度摘要并排展示，后续再做完整作业时间线页。</div></div></div>
          <div className="stackList">
            <div className="subSectionTitle">审批请求</div>
            <div className="list modernList compactList">
              {(overview?.approvals ?? []).map((item) => (
                <div key={item.request_fact_id} className="infoCard">
                  <div className="jobTitleRow"><div className="title">{item.action_type || item.request_id}</div><div className="pill">{item.status}</div></div>
                  <div className="meta wrapMeta"><span>请求：{item.request_id}</span><span>田块：{item.field_id || "-"}</span><span>时间：{fmtTs(item.occurred_at)}</span></div>
                </div>
              ))}
              {!(overview?.approvals?.length) ? <div className="emptyState">当前筛选下没有审批记录。</div> : null}
            </div>
            <div className="subSectionTitle" style={{ marginTop: 12 }}>调度动作</div>
            <div className="list modernList compactList">
              {(overview?.dispatches ?? []).map((item) => (
                <div key={item.fact_id} className="infoCard">
                  <div className="jobTitleRow"><div className="title">{item.action_type || item.act_task_id || item.fact_id}</div><div className="pill">DISPATCH</div></div>
                  <div className="meta wrapMeta"><span>任务：{item.act_task_id || "-"}</span><span>设备：{item.device_id || "-"}</span><span>时间：{fmtTs(item.occurred_at)}</span></div>
                </div>
              ))}
              {!(overview?.dispatches?.length) ? <div className="emptyState">当前筛选下没有调度动作。</div> : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
