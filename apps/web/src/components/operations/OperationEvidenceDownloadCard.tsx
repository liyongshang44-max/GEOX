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
    ? text("已生成（可下载）", "Ready to download")
    : model.evidenceExport.latestJobStatus.toUpperCase() === "RUNNING"
      ? text("生成中", "Generating")
      : text("暂不可用", "Unavailable");

  return (
    <section className="card sectionBlock geoxSectionCard">
      <div className="sectionTitle">{title}</div>
      <div className="kv"><span className="k">{text("状态", "Status")}</span><span className="v">{status}</span></div>
      <div className="kv"><span className="k">{text("最近导出时间", "Latest Export")}</span><span className="v">{model.evidenceExport.latestExportedAtLabel}</span></div>
      <div className="kv"><span className="k">{text("包名", "Bundle Name")}</span><span className="v">{model.evidenceExport.latestBundleName}</span></div>
      {model.evidenceExport.hasExportableBundle && model.evidenceExport.downloadUrl ? (
        <a className="btn" href={model.evidenceExport.downloadUrl}>{text("下载证据包", "Download Bundle")}</a>
      ) : model.evidenceExport.jumpUrl ? (
        <a className="btn" href={model.evidenceExport.jumpUrl}>{text("查看导出任务", "Open Export Jobs")}</a>
      ) : (
        <button className="btn" type="button" disabled>{text("暂无可下载证据包", "No bundle available")}</button>
      )}
    </section>
  );
}
