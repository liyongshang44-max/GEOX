import React from "react";
import { fetchEvidenceJobs, fetchRecentEvidenceControlPlane } from "../api";
import { StatusTag } from "../components/StatusTag";
import { RelativeTime } from "../components/RelativeTime";

export default function AuditExportPage(): React.ReactElement {
  const [jobs, setJobs] = React.useState<any[]>([]);
  const [recent, setRecent] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const [j, r] = await Promise.all([
        fetchEvidenceJobs(50).catch(() => []),
        fetchRecentEvidenceControlPlane(30).catch(() => []),
      ]);
      setJobs(j);
      setRecent(r);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void reload(); }, [reload]);

  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">Evidence / Receipt / Export</div>
            <div className="sectionTitle">证据中心</div>
            <div className="muted">用于审计、交付与执行证明的统一页面</div>
          </div>
          <button className="btn" onClick={() => void reload()} disabled={loading}>刷新证据数据</button>
        </div>
      </section>

      <section className="summaryGrid3">
        <div className="card" style={{ padding: 12 }}><div className="muted">证据导出作业</div><div className="metricBig">{loading ? "--" : jobs.length}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">最近 evidence 事件</div><div className="metricBig">{loading ? "--" : recent.length}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">完整性提示</div><div className="muted">manifest / hash 将在可用时显示</div></div>
      </section>

      <div className="contentGridTwo alignStart">
        <section className="card sectionBlock">
          <div className="sectionTitle">evidence-export jobs</div>
          <div className="list modernList compactList">
            {jobs.map((job) => (
              <article key={job.job_id} className="infoCard">
                <div className="jobTitleRow"><div className="title">{job.job_id}</div><StatusTag status={String(job.status || "UNKNOWN")} /></div>
                <div className="meta wrapMeta">
                  <span>类型：证据包导出作业</span>
                  <span>关联对象：{String(job.scope_type || "-")} / {String(job.scope_id || "-")}</span>
                  <span>时间：<RelativeTime value={job.updated_at || job.created_at} /></span>
                  <span>完整性：{job.artifact_sha256 ? "已生成 hash" : "待生成"}</span>
                </div>
              </article>
            ))}
            {!jobs.length ? <div className="emptyState">最近无新的证据导出记录。可稍后刷新重试。</div> : null}
          </div>
        </section>

        <section className="card sectionBlock">
          <div className="sectionTitle">recent evidence / receipt traces</div>
          <div className="list modernList compactList">
            {recent.map((item, idx) => (
              <article key={`${item.job_id || item.fact_id || idx}`} className="infoCard">
                <div className="jobTitleRow"><div className="title">{String(item.job_id || item.fact_id || "证据事件")}</div><StatusTag status={String(item.status || "PENDING")} /></div>
                <div className="meta wrapMeta">
                  <span>证据类型：{String(item.scope_type || item.type || "执行回执")}</span>
                  <span>关联对象：{String(item.scope_id || item.object_id || "-")}</span>
                  <span>时间：<RelativeTime value={item.updated_at || item.created_at || item.occurred_at} /></span>
                </div>
              </article>
            ))}
            {!recent.length ? <div className="emptyState">最近暂无证据事件。待下一轮回执与导出后更新。</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
