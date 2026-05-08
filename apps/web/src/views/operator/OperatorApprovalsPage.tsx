import React from "react";
import { fetchOperatorApprovals } from "../../api/operatorApprovals";
import ApprovalDecisionPanel from "../../components/operator/ApprovalDecisionPanel";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import OperatorLayout from "../../layouts/OperatorLayout";
import { buildOperatorApprovalsVm, type OperatorApprovalRowVm, type OperatorApprovalsVm } from "../../viewmodels/operatorApprovalsVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

type ApprovalSectionProps = {
  title: string;
  description: string;
  rows: OperatorApprovalRowVm[];
  writeReady: boolean;
};

function ApprovalCard({ row, writeReady }: { row: OperatorApprovalRowVm; writeReady: boolean }): React.ReactElement {
  return (
    <article className="operatorApprovalCard">
      <header className="operatorApprovalCardHead">
        <div>
          <h3>{row.title}</h3>
          <p>{row.description}</p>
        </div>
        <span className={`operatorRiskBadge ${row.riskTone}`}>{row.riskText}</span>
      </header>

      <div className="operatorApprovalMetaGrid">
        <div><span>对象</span><strong>{row.objectText}</strong></div>
        <div><span>状态</span><strong>{row.statusText}</strong></div>
        <div><span>发起人</span><strong>{row.requestedByText}</strong></div>
        <div><span>审批人</span><strong>{row.approverText}</strong></div>
        <div><span>更新时间</span><strong>{row.updatedAtText}</strong></div>
        <div><span>来源</span><strong>{row.sourceText}</strong></div>
      </div>

      <div className="operatorPrescriptionBox">
        <div>
          <span>处方查看</span>
          <strong>{row.prescriptionText}</strong>
          <small>建议关联：{row.recommendationText}</small>
        </div>
        <button type="button" disabled={!row.prescriptionHref}>查看处方</button>
      </div>

      <ApprovalDecisionPanel item={row} writeReady={writeReady} />
    </article>
  );
}

function ApprovalSection({ title, description, rows, writeReady }: ApprovalSectionProps): React.ReactElement {
  return (
    <section className="operatorApprovalSection">
      <header className="operatorApprovalSectionHead">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span>{rows.length}</span>
      </header>
      {rows.length ? (
        <div className="operatorApprovalList">
          {rows.map((row) => <ApprovalCard key={`${title}-${row.approvalRequestId}`} row={row} writeReady={writeReady} />)}
        </div>
      ) : <div className="operatorQueueEmpty">暂无该类审批事项。</div>}
    </section>
  );
}

export default function OperatorApprovalsPage(): React.ReactElement {
  const meta = OPERATOR_PAGE_META.approvals;
  const [loading, setLoading] = React.useState(true);
  const [vm, setVm] = React.useState<OperatorApprovalsVm | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchOperatorApprovals()
      .then((response) => {
        if (!alive) return;
        setVm(buildOperatorApprovalsVm(response));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      {loading ? <div className="operatorEmptyState">审批中心加载中...</div> : null}
      {!loading && vm ? (
        <div className="operatorApprovalsPage">
          <section className="operatorWorkbenchSummary">
            <div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div>
            <div><span>审批事项总数</span><strong>{vm.totalCount}</strong></div>
            <div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div>
          </section>

          {vm.dataScopeWarning ? <div className="operatorScopeWarning">{vm.dataScopeWarning}</div> : null}
          {!vm.writeReady ? <div className="operatorScopeWarning">审批写操作未 ready：后端权限、审计和错误码未完成前，审批中心保持只读。</div> : null}

          {vm.totalCount === 0 ? <OperatorEmptyState title={vm.emptyTitle} description={vm.emptyDescription} reason="没有审批数据时不伪造审批事项。" /> : null}

          <div className="operatorApprovalGrid">
            <ApprovalSection title="待审批列表" description="当前需要运营人员处理的审批请求。" rows={vm.pending} writeReady={vm.writeReady} />
            <ApprovalSection title="高风险处方" description="高风险且关联正式处方的审批事项。" rows={vm.highRiskPrescriptions} writeReady={vm.writeReady} />
            <ApprovalSection title="无权限审批" description="当前身份不可执行审批动作的事项。" rows={vm.noPermission} writeReady={vm.writeReady} />
            <ApprovalSection title="自审批风险" description="发起人与审批人存在重合风险的事项。" rows={vm.selfApprovalRisk} writeReady={vm.writeReady} />
            <ApprovalSection title="审批历史" description="已通过、已拒绝或已退回的审批记录。" rows={vm.history} writeReady={vm.writeReady} />
          </div>
        </div>
      ) : null}
    </OperatorLayout>
  );
}
