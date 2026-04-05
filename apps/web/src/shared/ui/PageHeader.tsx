import React from "react";
import { Link } from "react-router-dom";
import { themeTokens } from "../styles";

type HeaderAction = {
  label: string;
  to?: string;
  onClick?: () => void;
  tone?: "primary" | "secondary";
};

export default function PageHeader({ eyebrow, title, description, actions = [] }: { eyebrow?: string; title: string; description?: string; actions?: HeaderAction[] }): React.ReactElement {
  return (
    <section className="card" style={{ marginBottom: themeTokens.spacing[3], padding: themeTokens.spacing[5] }}>
      <div style={{ display: "flex", gap: themeTokens.spacing[3], justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          {eyebrow ? <div style={{ color: themeTokens.color.text.tertiary, fontSize: 12, marginBottom: themeTokens.spacing[1] }}>{eyebrow}</div> : null}
          <h1 style={{ margin: 0, color: themeTokens.color.text.primary, fontSize: 24 }}>{title}</h1>
          {description ? <p style={{ marginTop: themeTokens.spacing[2], marginBottom: 0, color: themeTokens.color.text.secondary }}>{description}</p> : null}
        </div>
        {!!actions.length ? (
          <div style={{ display: "flex", gap: themeTokens.spacing[2], flexWrap: "wrap" }}>
            {actions.map((action) => {
              const className = action.tone === "primary" ? "btn primary" : "btn";
              if (action.to) return <Link key={`${action.label}_${action.to}`} className={className} to={action.to}>{action.label}</Link>;
              return <button key={action.label} className={className} type="button" onClick={action.onClick}>{action.label}</button>;
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
