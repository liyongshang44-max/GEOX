import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

function inferImpact(model: OperationDetailPageVm): { improve: string; riskIfSkipped: string } {
  const action = String(model.actionLabel ?? "").toUpperCase();
  if (action.includes("灌溉") || action.includes("IRRIGATE")) {
    return {
      improve: "预计 24-72 小时内缓解水分胁迫，稳定长势并降低叶片萎蔫风险。",
      riskIfSkipped: "土壤含水继续下降，可能导致生长停滞、减产风险提升。"
    };
  }
  if (action.includes("喷洒") || action.includes("SPRAY")) {
    return {
      improve: "预计降低病虫害扩散概率，提升叶片健康状态并减少后续补救成本。",
      riskIfSkipped: "病虫害可能继续扩散，后续治理成本与产量损失风险上升。"
    };
  }
  return {
    improve: "预计改善当前作业目标对应的田间指标，并形成可交付证据闭环。",
    riskIfSkipped: "当前风险暴露将持续，可能错过最佳处置窗口。"
  };
}

export default function OperationImpactCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  const copy = inferImpact(model);
  return (
    <section className="card sectionBlock geoxSectionCard">
      <div className="sectionTitle">经营影响评估（Operation Impact）</div>
      <div className="muted detailSectionLead">先给客户看“做了会变好什么”，再说明“不做会有什么风险”。</div>
      <div className="detailMeaningGrid">
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">如果执行（预期改善）</span>
          <strong>{copy.improve}</strong>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">如果不执行（风险）</span>
          <strong>{copy.riskIfSkipped}</strong>
        </div>
      </div>
    </section>
  );
}

