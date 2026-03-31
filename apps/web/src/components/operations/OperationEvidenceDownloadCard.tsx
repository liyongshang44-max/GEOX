
import React from "react";
import { useLocale } from "../../lib/locale";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";
import { createEvidenceReport, fetchEvidenceReportStatus } from "../../api/operations";

const EVIDENCE_BUNDLE_TITLE = "证据层";

type Props = {
  evidenceBundle: OperationDetailPageVm["evidenceExport"];
  operationPlanId: string;
  title?: string;
};

export default function OperationEvidenceDownloadCard({ evidenceBundle, operationPlanId, title = EVIDENCE_BUNDLE_TITLE }: Props): React.ReactElement {
  const { text } = useLocale();
  const [reportBusy, setReportBusy] = React.useState(false);
  const [reportHint, setReportHint] = React.useState<string>("");

  const onGenerateReport = React.useCallback(async () => {
    if (reportBusy) return;
    setReportBusy(true);
    setReportHint("正在创建报告任务…");
    try {
      const created = await createEvidenceReport(operationPlanId);
      const jobId = String(created?.job_id ?? "").trim();
      if (!jobId) throw new Error("创建失败");
      for (let i = 0; i < 30; i += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const status = await fetchEvidenceReportStatus(jobId);
        if (status?.status === "DONE" && status.download_url) {
          setReportHint("报告已生成，正在下载…");
          window.location.href = status.download_url;
          setReportBusy(false);
          return;
        }
        if (status?.status === "FAILED") {
          throw new Error(status?.error || "生成失败");
        }
        setReportHint(`报告生成中…（${i + 1}s）`);
      }
      throw new Error("生成超时，请稍后重试");
    } catch (error: any) {
      setReportHint(`报告生成失败：${String(error?.message ?? error)}`);
      setReportBusy(false);
    }
  }, [operationPlanId, reportBusy]);

  return (
    <section className="card sectionBlock geoxSectionCard evidenceBundleCardV2">
      <div className="sectionTitle">{title}</div>
      <div className="muted detailSectionLead">
        {text("证据包用于复盘、审计和对外交付，属于执行后的证据沉淀层。", "Evidence bundles support audit/review and belong to the post-execution evidence layer.")}
      </div>
      <div className="detailMeaningGrid">
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("当前状态", "Current state")}</span>
          <strong>{evidenceBundle.bundleStatusLabel}</strong>
          <p>{evidenceBundle.latestJobStatusLabel}</p>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("最近导出", "Latest export")}</span>
          <strong>{evidenceBundle.latestExportedAtLabel}</strong>
          <p>{text("包名", "Bundle")}：{evidenceBundle.latestBundleName}</p>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("为什么需要它", "Why it matters")}</span>
          <strong>{evidenceBundle.usageValueLabel}</strong>
          <p>{evidenceBundle.usageHintLabel}</p>
        </div>
      </div>
      <div className="detailMeaningGrid" style={{ marginTop: 10 }}>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">正式证据</span>
          <strong>{evidenceBundle.formalEvidenceCount} 条</strong>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">调试日志</span>
          <strong>{evidenceBundle.debugEvidenceCount} 条</strong>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">证据总量</span>
          <strong>{evidenceBundle.photoCount + evidenceBundle.metricCount + evidenceBundle.logCount} 条</strong>
        </div>
      </div>
      {evidenceBundle.onlySimTrace ? (
        <div style={{ marginTop: 10, color: "#991b1b", fontWeight: 600 }}>
          ⚠️ 当前仅有调试证据，不可用于正式验收
        </div>
      ) : null}
      {evidenceBundle.photoCount + evidenceBundle.metricCount + evidenceBundle.logCount === 0 ? (
        <div style={{ marginTop: 10, color: "#991b1b", fontWeight: 600 }}>
          ❌ 无证据（执行无效）
        </div>
      ) : null}
      <div className="operationsSummaryActions" style={{ marginTop: 14 }}>
        {evidenceBundle.hasExportableBundle && evidenceBundle.downloadUrl ? (
          <a className="btn" href={evidenceBundle.downloadUrl}>{evidenceBundle.actionLabel}</a>
        ) : evidenceBundle.jumpUrl ? (
          <a className="btn" href={evidenceBundle.jumpUrl}>{evidenceBundle.actionLabel}</a>
        ) : (
          <button className="btn" type="button" disabled>{evidenceBundle.actionLabel}</button>
        )}
        <button className="btn" type="button" onClick={() => void onGenerateReport()} disabled={reportBusy} style={{ marginLeft: 8 }}>
          {reportBusy ? "生成中…" : "下载作业报告（PDF）"}
        </button>
      </div>
      {reportHint ? <div className="muted" style={{ marginTop: 8 }}>{reportHint}</div> : null}
    </section>
  );
}
