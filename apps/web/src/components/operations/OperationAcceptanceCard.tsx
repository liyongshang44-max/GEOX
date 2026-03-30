import React from "react";
import { useLocale } from "../../lib/locale";
import type { OperationDetailPageVm } from "../../viewmodels/operationDetailViewModel";

export default function OperationAcceptanceCard({ model }: { model: OperationDetailPageVm }): React.ReactElement {
  const { text } = useLocale();

  return (
    <section className="card sectionBlock geoxSectionCard">
      <div className="sectionTitle">{text("验收层", "Acceptance layer")}</div>
      <div className="muted detailSectionLead">
        {text("集中展示验收结论、缺失项与总结，便于快速判断是否需要补证或复核。", "Shows verdict, missing evidence, and summary for quick accept/rework decisions.")}
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
