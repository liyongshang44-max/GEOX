import React from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchEvidenceControlPlane, fetchOperationEvidenceBundle } from "../../../api";
import EmptyState from "../../../components/common/EmptyState";
import ErrorState from "../../../components/common/ErrorState";
import { normalizeStatusWord } from "../../../lib/statusVocabulary";

export default function EvidenceCenterPage(): React.ReactElement {
  const location = useLocation();
  const [item, setItem] = React.useState<any>(null);
  const [bundle, setBundle] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const operationPlanId = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get("operation_plan_id") ?? "").trim();
  }, [location.search]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchEvidenceControlPlane({ limit: 30 });
      const operationBundle = operationPlanId ? await fetchOperationEvidenceBundle(operationPlanId) : null;
      setItem(res.item ?? null);
      setBundle(operationBundle ?? null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [operationPlanId]);

  React.useEffect(() => { void reload(); }, [reload]);

  const reportItems = Array.isArray(item?.export_jobs) ? item.export_jobs : [];
  const evidenceItems = Array.isArray(item?.recent_evidence_items) ? item.recent_evidence_items : [];
  const successfulOps = evidenceItems.filter((ev: any) => String(ev?.status?.code || "").toUpperCase().includes("SUCC")).slice(0, 6);
  const artifactItems = Array.isArray(bundle?.artifacts) ? bundle.artifacts : [];

  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">报告与证据中心</div>
            <div className="sectionDesc">在一个页面查看报告、证据包状态与最近成功作业。</div>
          </div>
          <button className="btn primary" onClick={() => void reload()} disabled={loading}>刷新</button>
        </div>
      </section>

      {error ? <ErrorState title="报告中心加载失败" message="请稍后重试，或检查证据服务状态。" technical={error} onRetry={() => void reload()} /> : null}

      <section className="card sectionBlock">
        <div className="sectionTitle">最近报告列表</div>
        <div className="list modernList compactList" style={{ marginTop: 8 }}>
          {reportItems.map((job: any) => (
            <article key={job.job_id} className="infoCard">
              <div className="jobTitleRow">
                <div className="title">{String(job?.title || "证据报告")}</div>
                <span className="statusWord data">{normalizeStatusWord(job?.status?.code)}</span>
              </div>
              <div className="meta wrapMeta">
                <span>关联方案：{String(job?.refs?.program_id || "未初始化")}</span>
                <span>生成时间：{job.created_at_label || "-"}</span>
                <span>报告状态：{job.status?.label || "数据不足"}</span>
              </div>
            </article>
          ))}
          {!reportItems.length ? (
            <EmptyState
              title="暂无报告"
              description="报告只会在作业执行并形成证据包后出现。"
              actionText="查看最近作业"
              onAction={() => window.location.assign("/operations")}
              secondaryActionText="查看设备状态"
              onSecondaryAction={() => window.location.assign("/devices")}
            />
          ) : null}
        </div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionTitle">证据包状态</div>
        <div className="operationsSummaryGrid" style={{ marginTop: 8 }}>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">待处理</span><strong>{reportItems.filter((x: any) => normalizeStatusWord(x?.status?.code) === "待处理").length}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">执行中</span><strong>{reportItems.filter((x: any) => normalizeStatusWord(x?.status?.code) === "执行中").length}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">已完成</span><strong>{reportItems.filter((x: any) => normalizeStatusWord(x?.status?.code) === "已完成").length}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">数据不足</span><strong>{reportItems.filter((x: any) => normalizeStatusWord(x?.status?.code) === "数据不足").length}</strong></div>
        </div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionTitle">关联最近成功作业</div>
        <div className="list modernList compactList" style={{ marginTop: 8 }}>
          {successfulOps.map((ev: any) => (
            <article key={ev.evidence_id} className="infoCard">
              <div className="jobTitleRow">
                <div className="title">{String(ev?.title || "执行回执")}</div>
                <span className="statusWord online">已完成</span>
              </div>
              <div className="meta wrapMeta">
                <span>关联作业：{String(ev?.act_task_id || "-")}</span>
                <span>更新时间：{ev.updated_at_label || "-"}</span>
              </div>
            </article>
          ))}
          {!successfulOps.length ? <div className="decisionItemStatic">当前没有最近成功作业，可能是尚未执行或证据未回传。</div> : null}
        </div>
      </section>

      {operationPlanId ? (
        <section className="card sectionBlock">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">作业证据来源</div>
              <div className="sectionDesc">作业 {operationPlanId} 的证据条目与 skill 来源，用于判断验收可靠性。</div>
            </div>
          </div>
          {!artifactItems.length ? (
            <div className="decisionItemStatic" style={{ marginTop: 8 }}>该作业暂无证据条目，或证据尚未聚合。</div>
          ) : (
            <div className="list modernList compactList" style={{ marginTop: 8 }}>
              {artifactItems.map((ev: any, idx: number) => (
                <article key={String(ev?.artifact_id || idx)} className="infoCard">
                  <div className="jobTitleRow">
                    <div className="title">{String(ev?.kind || "artifact")} · {String(ev?.evidence_level || "UNKNOWN")}</div>
                    <span className="statusWord data">{String(ev?.skill_source?.source || "none")}</span>
                  </div>
                  <div className="meta wrapMeta">
                    <span>skill：{String(ev?.skill_id || "-")}@{String(ev?.skill_version || "-")}</span>
                    <span>stage：{String(ev?.skill_source?.trigger_stage || "-")}</span>
                    <span>explanations：{Array.isArray(ev?.explanation_codes) && ev.explanation_codes.length > 0 ? ev.explanation_codes.join(", ") : "-"}</span>
                    <span>创建时间：{String(ev?.created_at || "-")}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="card sectionBlock">
        <div className="sectionTitle">说明与去向</div>
        <p style={{ margin: "8px 0 0", color: "#475467" }}>
          报告会在执行完成且证据齐全后生成。若没有报告，请先检查设备在线、作业执行与回执完整性。
        </p>
        <div className="operationsSummaryActions" style={{ marginTop: 8 }}>
          <Link className="btn secondary" to="/operations">查看作业</Link>
          <Link className="btn weak" to="/devices">查看设备</Link>
        </div>
      </section>
    </div>
  );
}
