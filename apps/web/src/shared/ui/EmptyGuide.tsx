import React from "react";
import { Link } from "react-router-dom";
import { themeTokens } from "../styles";

export type EmptyGuideAction = { label: string; to: string; tone?: "primary" | "secondary" };

export default function EmptyGuide({ title, description, actions }: { title: string; description: string; actions: EmptyGuideAction[] }): React.ReactElement {
  return (
    <section style={{ border: `1px dashed ${themeTokens.color.border.default}`, borderRadius: themeTokens.radius.lg, padding: themeTokens.spacing[4], background: themeTokens.color.bg.subtle }}>
      <div style={{ color: themeTokens.color.text.primary, fontWeight: 700 }}>{title}</div>
      <p style={{ marginTop: themeTokens.spacing[1], marginBottom: 0, color: themeTokens.color.text.secondary }}>{description}</p>
      <div style={{ marginTop: themeTokens.spacing[2], display: "flex", gap: themeTokens.spacing[2], flexWrap: "wrap" }}>
        {actions.map((action) => (
          <Link key={`${action.label}_${action.to}`} className={action.tone === "primary" ? "btn primary" : "btn"} to={action.to}>{action.label}</Link>
        ))}
      </div>
    </section>
  );
}
