
import React from "react";
import { useLocale } from "../../lib/locale";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

const EVIDENCE_BUNDLE_TITLE = "证据包";

type Props = {
  model: OperationDetailPageVm;
  title?: string;
};

export default function OperationEvidenceDownloadCard({ model, title = EVIDENCE_BUNDLE_TITLE }: Props): React.ReactElement {
  const { text } = useLocale();

  const status = model.evidenceExport.hasExportableBundle
    ? text("已生成，可下载与归档", "Ready for download and archive")
    : model.evidenceExport.latestJobStatus.toUpperCase() === "RUNNING"
      ? text("正在生成证据包", "Generating bundle")
      : text("当前暂不可导出", "Unavailable");

  return (
    <section className="card sectionBlock geoxSectionCard evidenceBundleCardV2">
      <div className="sectionTitle">{title}</div>
      <div className="muted detailSectionLead">
        {text("证据包用于复盘、审计和对外交付，不影响现场执行。", "The bundle is for review, audit, and customer delivery. It does not affect field execution.")}
      </div>
      <div className="detailMeaningGrid">
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("当前状态", "Current state")}</span>
          <strong>{status}</strong>
          <p>{text("最近任务", "Latest job")}：{model.evidenceExport.latestJobStatus}</p>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("最近导出", "Latest export")}</span>
          <strong>{model.evidenceExport.latestExportedAtLabel}</strong>
          <p>{text("包名", "Bundle")}：{model.evidenceExport.latestBundleName}</p>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("为什么需要它", "Why it matters")}</span>
          <strong>{text("用于留痕、复验与交付", "For traceability, verification, and delivery")}</strong>
          <p>{text("缺失原因", "Missing reason")}：{model.evidenceExport.missingReason}</p>
        </div>
      </div>
      <div className="operationsSummaryActions" style={{ marginTop: 14 }}>
        {model.evidenceExport.hasExportableBundle && model.evidenceExport.downloadUrl ? (
          <a className="btn" href={model.evidenceExport.downloadUrl}>{text("下载证据包", "Download Bundle")}</a>
        ) : model.evidenceExport.jumpUrl ? (
          <a className="btn" href={model.evidenceExport.jumpUrl}>{text("查看导出任务", "Open Export Jobs")}</a>
        ) : (
          <button className="btn" type="button" disabled>{text("暂无可下载证据包", "No bundle available")}</button>
        )}
      </div>
    </section>
  );
}
