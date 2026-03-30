import React from "react";
import { useLocale } from "../../lib/locale";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationAcceptanceCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  const { text } = useLocale();

  return (
    <section className="card sectionBlock geoxSectionCard">
      <div className="sectionTitle">{text("验收（是否达标）", "Acceptance (whether passed)")}</div>
      <div className="muted detailSectionLead">
        {text("直接回答是否达标，并提示是否需要补证或复核。", "Directly answers if this operation meets the target and whether rework is needed.")}
      </div>
      <div className="detailMeaningGrid">
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("验收状态", "Acceptance status")}</span>
          <strong>{model.acceptance.statusLabel}</strong>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("缺失项", "Missing evidence")}</span>
          <strong>{model.acceptance.missingEvidenceLabel}</strong>
        </div>
        <div className="detailMeaningItem">
          <span className="detailMeaningLabel">{text("总结", "Summary")}</span>
          <strong>{model.acceptance.summary}</strong>
        </div>
      </div>
    </section>
  );
}
