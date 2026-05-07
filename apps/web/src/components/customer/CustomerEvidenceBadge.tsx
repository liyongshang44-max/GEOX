import React from "react";
import CustomerStatusBadge, { type CustomerBadgeToneVm } from "./CustomerStatusBadge";

export type CustomerEvidenceBadgeVm = {
  label: string;
  tone?: CustomerBadgeToneVm;
  title?: string;
};

export default function CustomerEvidenceBadge({ vm }: { vm: CustomerEvidenceBadgeVm }): React.ReactElement {
  return <CustomerStatusBadge vm={vm} />;
}
