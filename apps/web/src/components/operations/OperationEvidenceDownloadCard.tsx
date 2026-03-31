
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
      <div className="detailMeaningGrid" style={{ marginTop: 10 }}>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">照片</span>
          <strong>{evidenceBundle.photoCount} 张</strong>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">指标</span>
          <strong>{evidenceBundle.metricCount} 条</strong>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">日志</span>
          <strong>{evidenceBundle.logCount} 条</strong>
        </div>
      </div>
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
      </div>
    </section>
  );
}
