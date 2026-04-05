import React from "react";
import { themeTokens } from "../styles";

export type DetailAsideItem = { label: string; value: React.ReactNode };

export default function DetailAside({ title, items, actions }: { title: string; items: DetailAsideItem[]; actions?: React.ReactNode }): React.ReactElement {
  return (
    <aside className="card" style={{ padding: themeTokens.spacing[4] }}>
      <h3 style={{ margin: 0, color: themeTokens.color.text.primary, fontSize: 16 }}>{title}</h3>
      <div style={{ display: "grid", gap: themeTokens.spacing[2], marginTop: themeTokens.spacing[3] }}>
        {items.map((item) => (
          <div key={item.label}>
            <div style={{ color: themeTokens.color.text.tertiary, fontSize: 12 }}>{item.label}</div>
            <div style={{ color: themeTokens.color.text.primary, fontWeight: 700 }}>{item.value}</div>
          </div>
        ))}
      </div>
      {actions ? <div style={{ marginTop: themeTokens.spacing[3], display: "flex", gap: themeTokens.spacing[2], flexWrap: "wrap" }}>{actions}</div> : null}
    </aside>
  );
}
