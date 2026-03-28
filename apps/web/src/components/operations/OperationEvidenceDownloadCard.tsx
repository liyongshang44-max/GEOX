import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

const EVIDENCE_BUNDLE_TITLE = "证据包";

type Props = {
  model: OperationDetailPageVm;
  title?: string;
};

export default function OperationEvidenceDownloadCard({ model, title = EVIDENCE_BUNDLE_TITLE }: Props): React.ReactElement {
  const status = model.evidenceExport.hasExportableBundle
    ? "已生成（可下载）"
    : model.evidenceExport.latestJobStatus.toUpperCase() === "RUNNING"
      ? "生成中"
      : "暂不可用";

  return (
    <section className="card sectionBlock">
      <div className="sectionTitle">{title}</div>
      <div className="kv"><span className="k">状态</span><span className="v">{status}</span></div>
      <div className="kv"><span className="k">最近导出时间</span><span className="v">{model.evidenceExport.latestExportedAtLabel}</span></div>
      <div className="kv"><span className="k">包名</span><span className="v">{model.evidenceExport.latestBundleName}</span></div>
      {model.evidenceExport.hasExportableBundle && model.evidenceExport.downloadUrl ? (
        <a className="btn" href={model.evidenceExport.downloadUrl}>下载证据包</a>
      ) : model.evidenceExport.jumpUrl ? (
        <a className="btn" href={model.evidenceExport.jumpUrl}>查看导出任务</a>
      ) : (
        <button className="btn" type="button" disabled>暂无可下载证据包</button>
      )}
    </section>
  );
}
