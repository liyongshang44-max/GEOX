import React from "react";
import { Link } from "react-router-dom";

export type CustomerPageHeaderActionVm = {
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: "default" | "primary";
  disabled?: boolean;
};

export type CustomerPageHeaderVm = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  metaItems?: Array<{ label: string; value: string }>;
  actions?: CustomerPageHeaderActionVm[];
};

function CustomerPageHeaderAction({ vm }: { vm: CustomerPageHeaderActionVm }): React.ReactElement {
  const className = `customerButton${vm.tone === "primary" ? " customerButtonPrimary" : ""}`;

  if (vm.href && !vm.disabled) {
    return <Link className={className} to={vm.href}>{vm.label}</Link>;
  }

  return (
    <button className={className} type="button" onClick={vm.onClick} disabled={vm.disabled}>
      {vm.label}
    </button>
  );
}

export default function CustomerPageHeader({ vm }: { vm: CustomerPageHeaderVm }): React.ReactElement {
  return (
    <header className="customerHero">
      <div className="customerHeroTop">
        <div>
          {vm.eyebrow ? <div className="customerEyebrow">{vm.eyebrow}</div> : null}
          <h1 className="customerTitle">{vm.title}</h1>
          {vm.subtitle ? <p className="customerSubtitle">{vm.subtitle}</p> : null}
          {vm.metaItems?.length ? (
            <div className="customerGrid2 customerSpacingTopXs">
              {vm.metaItems.map((item) => (
                <div key={`${item.label}:${item.value}`}>
                  <strong>{item.label}：</strong>{item.value}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {vm.actions?.length ? (
          <div className="customerActions">
            {vm.actions.map((action) => <CustomerPageHeaderAction key={action.label} vm={action} />)}
          </div>
        ) : null}
      </div>
    </header>
  );
}
