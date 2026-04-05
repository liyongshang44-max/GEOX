import React from "react";
import { themeTokens } from "../styles";

type Tone = "normal" | "pending" | "risk" | "blocked" | "failed" | "partial" | "data" | "online" | "offline" | "info";

export default function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }): React.ReactElement {
  const semantic = themeTokens.color.semantic[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: themeTokens.radius.pill, border: `1px solid ${semantic.border}`, background: semantic.bg, color: semantic.fg, fontSize: 12, fontWeight: 700, lineHeight: "18px", padding: `2px ${themeTokens.spacing[2]}px` }}>
      {children}
    </span>
  );
}
