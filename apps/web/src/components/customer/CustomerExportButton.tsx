import React from "react";
import { Link } from "react-router-dom";

export type CustomerExportButtonVm = {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  unavailableText?: string;
  tone?: "default" | "primary";
};

export default function CustomerExportButton({ vm }: { vm: CustomerExportButtonVm }): React.ReactElement {
  const className = `customerButton${vm.tone === "primary" ? " customerButtonPrimary" : ""}`;

  if (vm.href && !vm.disabled) return <Link className={className} to={vm.href}>{vm.label}</Link>;

  if (vm.disabled && vm.unavailableText) return <span className="muted">{vm.unavailableText}</span>;

  return <button className={className} type="button" onClick={vm.onClick} disabled={vm.disabled}>{vm.label}</button>;
}
