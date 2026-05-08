import React from "react";
import type { OperationEvidenceSummaryVm } from "../../viewmodels/operationReportVm";

type EvidencePackSummaryPanelProps = {
  vm: OperationEvidenceSummaryVm;
  expanded?: boolean;
};

export default function EvidencePackSummaryPanel({ vm, expanded = false }: EvidencePackSummaryPanelProps): React.ReactElement {
  return (
    <>
      <div className="operationOneLiner">{vm.summary}</div>
      <div className="operationOneLiner muted">{vm.detail}</div>
      {expanded ? (
        <div className="customerGrid2 customerSpacingTopXs">
          {vm.items.length ? vm.items.map((item) => (
            <div key={item.label}><strong>{item.label}：</strong>{item.value}</div>
          )) : <div className="muted">{vm.summary}</div>}
        </div>
      ) : null}
    </>
  );
}
