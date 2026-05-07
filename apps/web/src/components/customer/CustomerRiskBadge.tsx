import React from "react";
import CustomerStatusBadge, { type CustomerBadgeToneVm } from "./CustomerStatusBadge";

export type CustomerRiskBadgeVm = {
  label: string;
  tone?: CustomerBadgeToneVm;
  title?: string;
};

export default function CustomerRiskBadge({ vm }: { vm: CustomerRiskBadgeVm }): React.ReactElement {
  return <CustomerStatusBadge vm={vm} />;
}
