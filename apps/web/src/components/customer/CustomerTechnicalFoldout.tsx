import React from "react";

export type CustomerTechnicalFoldoutVm = {
  title: string;
  description?: string;
  rows: Array<{ label: string; value: string }>;
  open?: boolean;
};

export default function CustomerTechnicalFoldout({ vm }: { vm: CustomerTechnicalFoldoutVm }): React.ReactElement {
  return (
    <details className="customerCard" open={vm.open}>
      <summary className="customerCardTitle">{vm.title}</summary>
      {vm.description ? <div className="customerSpacingTopXs muted">{vm.description}</div> : null}
      <div className="customerGrid2 customerSpacingTopXs">
        {vm.rows.map((row) => (
          <div key={`${row.label}:${row.value}`}>
            <strong>{row.label}：</strong>{row.value}
          </div>
        ))}
      </div>
    </details>
  );
}
