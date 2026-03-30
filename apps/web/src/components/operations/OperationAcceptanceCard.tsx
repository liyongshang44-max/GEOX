import React from "react";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationAcceptanceCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  return (
    <section className="card sectionBlock geoxSectionCard operationBusinessCard">
      <div className="sectionTitle">验收（是否达标）</div>
      <div className="muted detailSectionLead">直接回答是否达标，并提示是否需要补证或复核。</div>
      <div className="detailMeaningGrid">
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">验收状态</span>
          <strong>{model.acceptance.statusLabel}</strong>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">缺失项</span>
          <strong>{model.acceptance.missingEvidenceLabel}</strong>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">总结</span>
          <strong>{model.acceptance.summary}</strong>
        </div>
      </div>
    </section>
  );
}
