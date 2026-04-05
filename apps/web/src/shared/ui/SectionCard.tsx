import React from "react";
import { themeTokens } from "../styles";

export default function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="card" style={{ marginBottom: themeTokens.spacing[3], padding: themeTokens.spacing[4] }}>
      <header style={{ marginBottom: themeTokens.spacing[2] }}>
        <h2 style={{ margin: 0, fontSize: 18, color: themeTokens.color.text.primary }}>{title}</h2>
        {subtitle ? <p style={{ margin: `${themeTokens.spacing[1]}px 0 0`, color: themeTokens.color.text.secondary }}>{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}
