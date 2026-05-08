import React from "react";
import type { OperationEvidenceSummaryVm } from "../../viewmodels/operationReportVm";

type EvidencePackSummaryPanelProps = {
  vm: OperationEvidenceSummaryVm;
  expanded?: boolean;
};

function stateLabel(state: OperationEvidenceSummaryVm["state"]): string {
  if (state === "NO_EVIDENCE") return "无证据";
  if (state === "RECORDS_WITHOUT_SUMMARY") return "有证据但无证据包摘要";
  return "有证据包摘要";
}

export default function EvidencePackSummaryPanel({ vm, expanded = false }: EvidencePackSummaryPanelProps): React.ReactElement {
  return (
    <>
      <div className="operationOneLiner">{vm.summary}</div>
      <div className="operationOneLiner muted">{vm.detail}</div>
      <div className="operationEvidenceMeta customerSpacingTopXs">
        <span>{stateLabel(vm.state)}</span>
        <span>{vm.sourceText}</span>
      </div>
      {expanded ? (
        <div className="customerSpacingTopXs">
          <div className="operationEvidencePrivacy">{vm.privacyText}</div>
          <div className="customerGrid2 customerSpacingTopXs">
            {vm.items.length ? vm.items.map((item) => (
              <div key={item.label}><strong>{item.label}：</strong>{item.value}</div>
            )) : <div className="muted">{vm.summary}</div>}
          </div>
        </div>
      ) : null}
    </>
  );
}
