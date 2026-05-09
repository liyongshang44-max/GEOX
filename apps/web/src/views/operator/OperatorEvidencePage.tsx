import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchOperatorEvidence } from "../../api/operatorEvidence";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import OperatorLayout from "../../layouts/OperatorLayout";
import "../../styles/operatorEvidence.css";
import { buildOperatorEvidenceVm, type OperatorEvidenceRowVm, type OperatorEvidenceVm } from "../../viewmodels/operatorEvidenceVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

function EvidenceRow({ row, exportReady }: { row: OperatorEvidenceRowVm; exportReady: boolean }): React.ReactElement {
  return (
    <article className="operatorEvidenceRow">
      <header className="operatorEvidenceRowHead">
        <div>
          <h3>{row.title}</h3>
          <p>{row.objectText}</p>
        </div>
        <span className={`operatorEvidenceStatus ${row.statusTone}`}>{row.statusText}</span>
      </header>

      <div className="operatorEvidenceMeta">
        <div><span>manifest</span><strong>{row.manifestText}</strong></div>
        <div><span>sha256</span><strong>{row.checksumText}</strong></div>
        <div><span>artifact / 对象标识</span><strong>{row.artifactText}</strong></div>
        <div><span>format</span><strong>{row.formatText}</strong></div>
        <div><span>scope</span><strong>{row.scopeText}</strong></div>
        <div><span>存储模式</span><strong>{row.storageText}</strong></div>
        <div><span>下载状态</span><strong>{row.downloadText}</strong></div>
        <div><span>创建时间</span><strong>{row.createdAtText}</strong></div>
        <div><span>完成时间</span><strong>{row.completedAtText}</strong></div>
        <div><span>失败原因</span><strong>{row.failureReasonText}</strong></div>
        <div><span>数据来源</span><strong>{row.sourceText}</strong></div>
      </div>

      <div className="operatorEvidenceNotice">证据中心不展示本地绝对路径、bucket secret、access key 或内部 runtime path。operation scope 未 ready 时显示未接入。</div>

      <div className="operatorEvidenceActions">
        {row.operationHref ? <Link to={row.operationHref}>查看作业</Link> : null}
        <button type="button" disabled>{exportReady ? "导出操作待授权" : "导出写操作未 ready"}</button>
      </div>
    </article>
  );
}

export default function OperatorEvidencePage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const operationId = searchParams.get("operation_id") ?? "";
  const meta = OPERATOR_PAGE_META.evidence;
  const [loading, setLoading] = React.useState(true);
  const [vm, setVm] = React.useState<OperatorEvidenceVm | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchOperatorEvidence(operationId)
      .then((response) => {
        if (!alive) return;
        setVm(buildOperatorEvidenceVm(response));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [operationId]);

  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      {loading ? <div className="operatorEmptyState">证据中心加载中...</div> : null}
      {!loading && vm ? (
        <div className="operatorEvidencePage">
          <section className="operatorWorkbenchSummary">
            <div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div>
            <div><span>证据任务总数</span><strong>{vm.totalCount}</strong></div>
            <div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div>
          </section>

          {vm.dataScopeWarning ? <div className="operatorScopeWarning">{vm.dataScopeWarning}</div> : null}
          {!vm.exportReady ? <div className="operatorScopeWarning">证据导出写操作未 ready：后端权限、审计和错误码未完成前，当前页面只读。</div> : null}

          {vm.totalCount === 0 ? <OperatorEmptyState title={vm.emptyTitle} description={vm.emptyDescription} reason="没有证据任务时不伪造 manifest、sha256 或下载入口。" /> : null}

          {vm.missingChecksumRows.length ? <div className="operatorEvidenceChecksumEmpty">{vm.missingChecksumRows.length} 个任务暂无 sha256 checksum，checksum 有则显示，无则保留正式空态。</div> : null}

          <section className="operatorEvidenceGrid" aria-label="证据导出任务">
            {vm.rows.map((row) => <EvidenceRow key={row.jobId} row={row} exportReady={vm.exportReady} />)}
          </section>
        </div>
      ) : null}
    </OperatorLayout>
  );
}
