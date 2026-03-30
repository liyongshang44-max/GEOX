
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

  return (
    <section className="card sectionBlock geoxSectionCard evidenceBundleCardV2">
      <div className="sectionTitle">{title}</div>
      <div className="muted detailSectionLead">
        {text("证据包用于复盘、审计和对外交付，不影响现场执行。", "The bundle is for review, audit, and customer delivery. It does not affect field execution.")}
      </div>
      <div className="detailMeaningGrid">
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("当前状态", "Current state")}</span>
          <strong>{model.evidenceExport.bundleStatusLabel}</strong>
          <p>{model.evidenceExport.latestJobStatusLabel}</p>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("最近导出", "Latest export")}</span>
          <strong>{model.evidenceExport.latestExportedAtLabel}</strong>
          <p>{text("包名", "Bundle")}：{model.evidenceExport.latestBundleName}</p>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("为什么需要它", "Why it matters")}</span>
          <strong>{model.evidenceExport.usageValueLabel}</strong>
          <p>{model.evidenceExport.usageHintLabel}</p>
        </div>
      </div>
      <div className="operationsSummaryActions" style={{ marginTop: 14 }}>
        {model.evidenceExport.hasExportableBundle && model.evidenceExport.downloadUrl ? (
          <a className="btn" href={model.evidenceExport.downloadUrl}>{model.evidenceExport.actionLabel}</a>
        ) : model.evidenceExport.jumpUrl ? (
          <a className="btn" href={model.evidenceExport.jumpUrl}>{model.evidenceExport.actionLabel}</a>
        ) : (
          <button className="btn" type="button" disabled>{model.evidenceExport.actionLabel}</button>
        )}
      </div>
    </section>
  );
}
