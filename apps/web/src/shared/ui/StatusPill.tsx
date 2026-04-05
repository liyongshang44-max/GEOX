import React from "react";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export default function StatusPill({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }): React.ReactElement {
  return <span className={`uiStatusPill ${tone}`}>{children}</span>;
}
