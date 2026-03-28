import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationEvidenceDownloadCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  return (
    <section className="card sectionBlock">
      <div className="sectionTitle">证据包导出</div>
      <div className="kv"><span className="k">最近任务</span><span className="v mono">{model.evidenceExport.latestJobId}</span></div>
      <div className="kv"><span className="k">任务状态</span><span className="v">{model.evidenceExport.latestJobStatus}</span></div>
      <div className="kv"><span className="k">证据包</span><span className="v">{model.evidenceExport.latestBundleName}</span></div>
      {model.evidenceExport.hasExportableBundle && model.evidenceExport.downloadUrl ? (
        <a className="btn" href={model.evidenceExport.downloadUrl}>下载证据包</a>
      ) : (
        <button className="btn" type="button" disabled>暂无可下载证据包</button>
      )}
    </section>
  );
}
