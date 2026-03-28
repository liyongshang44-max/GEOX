import React from "react";
import { fetchEvidenceControlPlane } from "../api";
import { StatusTag } from "../components/StatusTag";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";

export default function AuditExportPage(): React.ReactElement {
  const [item, setItem] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchEvidenceControlPlane({ limit: 30 });
      setItem(res.item ?? null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const evidenceItems = Array.isArray(item?.recent_evidence_items) ? item.recent_evidence_items : [];
  const exportJobs = Array.isArray(item?.export_jobs) ? item.export_jobs : [];

  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">执行证据与导出</div>
            <div className="muted">证明“这个系统不是只会说，它真的能交付证据”。</div>
          </div>
          <button className="btn" onClick={() => void reload()} disabled={loading}>刷新证据数据</button>
        </div>
      </section>

      {error ? <ErrorState title="证据页加载失败" message="请稍后重试，或检查证据服务状态。" technical={error} onRetry={() => void reload()} /> : null}

      <section className="card sectionBlock">
        <div className="sectionTitle">最近证据包</div>
        <div className="list modernList compactList">
          {exportJobs.map((job: any) => (
            <article key={job.job_id} className="infoCard">
              <div className="jobTitleRow">
                <div className="title mono">{job.job_id}</div>
                <StatusTag status={job.status?.code || "PENDING"} />
              </div>
              <div className="meta wrapMeta">
                <span>对应作业：{job.refs?.program_id || "未关联"}</span>
                <span>导出状态：{job.status?.label || "-"}</span>
                <span>更新时间：{job.created_at_label || "-"}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                {job.download?.available ? (
                  <button type="button" className="btn">下载</button>
                ) : (
                  <button type="button" className="btn" disabled>下载</button>
                )}
              </div>
            </article>
          ))}
          {!exportJobs.length ? <EmptyState title="最近暂无证据包" description="请先发起导出任务并等待生成完成。" /> : null}
        </div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionTitle">最近回执</div>
        <div className="list modernList compactList">
          {evidenceItems.map((ev: any) => (
            <article key={ev.evidence_id} className="infoCard">
              <div className="jobTitleRow">
                <div className="title">{ev.operation_plan_id || ev.subtitle || "未关联作业"}</div>
                <StatusTag status={ev.status?.code || "EXECUTED"} />
              </div>
              <div className="meta wrapMeta">
                <span>作业：{ev.operation_plan_id || "未关联"}</span>
                <span>状态：{ev.status?.label || "-"}</span>
                <span>时间：{ev.updated_at_label || "-"}</span>
                <span>日志数量：{ev.act_task_id ? 1 : 0}</span>
              </div>
            </article>
          ))}
          {!evidenceItems.length ? <EmptyState title="最近暂无回执" description="执行链路产生回执后会显示在这里。" /> : null}
        </div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionTitle">证据说明</div>
        <p style={{ margin: "8px 0 0", color: "#475467" }}>
          证据包包含建议、审批、计划、执行、回执等完整链路，用于审计、交付与溯源。
        </p>
      </section>
    </div>
  );
}
