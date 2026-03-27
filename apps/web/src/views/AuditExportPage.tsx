import React from "react";
import { fetchEvidenceControlPlane } from "../api";
import { StatusTag } from "../components/StatusTag";

export default function AuditExportPage(): React.ReactElement {
  const [item, setItem] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchEvidenceControlPlane({ limit: 30 }).catch(() => ({ ok: true, item: null }));
      setItem(res.item ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void reload(); }, [reload]);

  const cards = Array.isArray(item?.headline_cards) ? item.headline_cards : [];
  const evidenceItems = Array.isArray(item?.recent_evidence_items) ? item.recent_evidence_items : [];
  const exportJobs = Array.isArray(item?.export_jobs) ? item.export_jobs : [];
  const detail = item?.selected_detail;

  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">{item?.meta?.page_title || "证据页"}</div>
            <div className="muted">{item?.meta?.page_subtitle || "集中查看执行回执、证据包与导出任务。"}</div>
          </div>
          <button className="btn" onClick={() => void reload()} disabled={loading}>刷新证据数据</button>
        </div>
      </section>

      <section className="summaryGrid4">
        {cards.map((card: any) => (
          <div key={card.key} className="card" style={{ padding: 12 }}>
            <div className="muted">{card.title}</div>
            <div className="metricBig">{loading ? "--" : card.value}</div>
            <div className="muted">{card.description}</div>
          </div>
        ))}
      </section>

      <div className="contentGridTwo alignStart">
        <section className="card sectionBlock">
          <div className="sectionTitle">最近证据与导出任务</div>
          <div className="list modernList compactList">
            {evidenceItems.map((ev: any) => (
              <article key={ev.evidence_id} className="infoCard">
                <div className="jobTitleRow"><div className="title">{ev.title}</div><StatusTag status={ev.status?.code || "EXECUTED"} /></div>
                <div className="meta wrapMeta">
                  <span>{ev.subtitle}</span>
                  <span>{ev.summary}</span>
                  <span>更新时间：{ev.updated_at_label}</span>
                  <span>是否可下载：见导出任务状态</span>
                </div>
              </article>
            ))}
            {exportJobs.map((job: any) => (
              <article key={job.job_id} className="infoCard">
                <div className="jobTitleRow"><div className="title">{job.title}</div><StatusTag status={job.status?.code || "PENDING"} /></div>
                <div className="meta wrapMeta">
                  <span>{job.summary}</span>
                  <span>关联对象：{job.refs?.program_id || "未关联 Program"}</span>
                  <span>状态：{job.status?.label || "-"}</span>
                  <span>{job.download?.available ? "可下载" : "暂不可下载"}</span>
                </div>
              </article>
            ))}
            {!evidenceItems.length && !exportJobs.length ? <div className="emptyState">最近暂无证据与导出记录。</div> : null}
          </div>
        </section>

        <section className="card sectionBlock">
          <div className="sectionTitle">证据详情</div>
          {!detail ? <div className="emptyState">请选择左侧记录查看详情。</div> : (
            <div className="list modernList compactList">
              <article className="infoCard">
                <div className="jobTitleRow"><div className="title">{detail.title}</div><StatusTag status={detail.status?.code || "EXECUTED"} /></div>
                <div className="meta wrapMeta"><span>{detail.summary}</span></div>
                <div className="meta wrapMeta">
                  {(detail.timeline || []).map((x: any, idx: number) => <span key={idx}>{x.title} · {x.ts_label}</span>)}
                </div>
                <div className="meta wrapMeta">
                  <span>完整性：{detail.integrity?.label || "待检查"}</span>
                  <span>{detail.integrity?.manifest_present ? "manifest 可用" : "manifest 缺失"}</span>
                  <span>{detail.integrity?.sha256_present ? "sha256 可用" : "sha256 缺失"}</span>
                </div>
              </article>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
