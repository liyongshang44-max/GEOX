import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

function buildRiskSummary(model: OperationDetailPageVm): { level: string; message: string } {
  const acceptance = String(model.acceptance.status ?? "").toUpperCase();
  const violation = String(model.receiptEvidence?.violationSummary ?? "").trim();
  if (acceptance === "FAIL" || (violation && violation !== "-")) {
    return { level: "高风险", message: violation && violation !== "-" ? violation : "验收未通过，建议立即复核并安排补执行。" };
  }
  if (acceptance === "PENDING") {
    return { level: "中风险", message: "当前仍在待验收阶段，业务结果尚未最终闭环。" };
  }
  return { level: "低风险", message: "当前验收结果正常，未发现明显业务阻断风险。" };
}

export default function OperationRiskCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  const risk = buildRiskSummary(model);
  return (
    <section className="card sectionBlock geoxSectionCard operationBusinessCard">
      <div className="sectionTitle">风险（是否存在问题）</div>
      <div className="muted detailSectionLead">用于快速判断是否需要立刻介入、复核或补执行。</div>
      <div className="detailMeaningGrid">
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">风险等级</span>
          <strong>{risk.level}</strong>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">风险说明</span>
          <strong>{risk.message}</strong>
        </div>
      </div>
    </section>
  );
}
