// apps/web/src/components/customer/IrrigationDecisionReportCard.tsx
// Purpose: render H17 irrigation decision report in the customer operation report page.
// Boundary: no recalculation, no raw technical ids, no execution trigger.

import React from "react";
import type { OperationReportV1 } from "../../api/customerReports";
import { buildIrrigationDecisionReportVm } from "../../viewmodels/irrigationDecisionReportVm";

export function IrrigationDecisionReportCard({ report }: { report: OperationReportV1 }): React.ReactElement | null {
  const vm = buildIrrigationDecisionReportVm(report);
  if (!vm?.visible) return null;

  return (
    <article className="customerCard irrigationDecisionReportCard">
      <div className="customerCardHeaderRow">
        <div>
          <h2 className="customerCardTitle">灌溉决策依据</h2>
          <p className="operationOneLiner">{vm.oneLiner}</p>
        </div>
        <span className="customerPill">{vm.tone === "success" ? "可解释建议" : "证据不足"}</span>
      </div>

      <div className="customerGrid2 customerSpacingTopSm">
        <div><strong>决策结论：</strong>{vm.recommendationLine}</div>
        <div><strong>审批与执行边界：</strong>{vm.boundaryLine}</div>
        <div><strong>证据基础：</strong>{vm.evidenceLine}</div>
        <div><strong>水分状态：</strong>{vm.stateLine}</div>
      </div>

      <section className="customerSpacingTopSm">
        <h3 className="customerCardTitle">情景比较</h3>
        <p className="customerMetricLabel">{vm.scenarioLine}</p>
        {vm.options.length ? (
          <div className="customerGrid2 customerSpacingTopXs">
            {vm.options.map((option) => (
              <div key={option.label} className="customerMetricCard">
                <small>{option.label}</small>
                <strong>{option.amountText}</strong>
                <span>{option.riskText}</span>
                <span>可信度：{option.confidenceText}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="customerMetricLabel customerSpacingTopXs">当前没有可展示的灌溉情景比较。</p>
        )}
      </section>
    </article>
  );
}

export default IrrigationDecisionReportCard;
