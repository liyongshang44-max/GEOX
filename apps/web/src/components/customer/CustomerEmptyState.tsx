import React from "react";
import { Link } from "react-router-dom";

export type CustomerEmptyStateActionVm = {
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: "default" | "primary";
};

export type CustomerEmptyStateVm = {
  title: string;
  description?: string;
  actions?: CustomerEmptyStateActionVm[];
};

function CustomerEmptyStateAction({ vm }: { vm: CustomerEmptyStateActionVm }): React.ReactElement {
  const className = `customerButton${vm.tone === "primary" ? " customerButtonPrimary" : ""}`;

  if (vm.href) return <Link className={className} to={vm.href}>{vm.label}</Link>;

  return <button className={className} type="button" onClick={vm.onClick}>{vm.label}</button>;
}

export default function CustomerEmptyState({ vm }: { vm: CustomerEmptyStateVm }): React.ReactElement {
  return (
    <div className="customerListItem">
      <strong>{vm.title}</strong>
      {vm.description ? <div className="customerMetricLabel">{vm.description}</div> : null}
      {vm.actions?.length ? (
        <div className="customerActionRow customerSpacingTopSm">
          {vm.actions.map((action) => <CustomerEmptyStateAction key={action.label} vm={action} />)}
        </div>
      ) : null}
    </div>
  );
}
