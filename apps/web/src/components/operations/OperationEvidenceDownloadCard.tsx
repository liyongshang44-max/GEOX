
import React from "react";
import { useLocale } from "../../lib/locale";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

const EVIDENCE_BUNDLE_TITLE = "证据层";

type Props = {
  evidenceBundle: OperationDetailPageVm["evidenceExport"];
  title?: string;
};

export default function OperationEvidenceDownloadCard({ evidenceBundle, title = EVIDENCE_BUNDLE_TITLE }: Props): React.ReactElement {
  const { text } = useLocale();

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
      <div className="operationsSummaryActions" style={{ marginTop: 14 }}>
        {evidenceBundle.hasExportableBundle && evidenceBundle.downloadUrl ? (
          <a className="btn" href={evidenceBundle.downloadUrl}>{evidenceBundle.actionLabel}</a>
        ) : evidenceBundle.jumpUrl ? (
          <a className="btn" href={evidenceBundle.jumpUrl}>{evidenceBundle.actionLabel}</a>
        ) : (
          <button className="btn" type="button" disabled>{evidenceBundle.actionLabel}</button>
        )}
      </div>
    </section>
  );
}
