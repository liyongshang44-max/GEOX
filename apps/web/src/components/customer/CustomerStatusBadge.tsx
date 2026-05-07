import React from "react";

export type CustomerBadgeToneVm = "neutral" | "low" | "medium" | "high";

export type CustomerStatusBadgeVm = {
  label: string;
  tone?: CustomerBadgeToneVm;
  title?: string;
};

const TONE_CLASS: Record<CustomerBadgeToneVm, string> = {
  neutral: "",
  low: " customerPillLow",
  medium: " customerPillMedium",
  high: " customerPillHigh",
};

export default function CustomerStatusBadge({ vm }: { vm: CustomerStatusBadgeVm }): React.ReactElement {
  return <span className={`customerPill${TONE_CLASS[vm.tone ?? "neutral"]}`} title={vm.title}>{vm.label}</span>;
}
