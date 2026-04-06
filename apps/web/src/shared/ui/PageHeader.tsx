import React from "react";
import { Link } from "react-router-dom";

type HeaderAction = {
  label: string;
  to?: string;
  onClick?: () => void;
  tone?: "primary" | "danger" | "warning" | "pending";
};

function renderAction(action: HeaderAction, index: number): React.ReactElement {
  const className = `btn${action.tone ? ` ${action.tone}` : ""}`;
  if (action.to) {
    return <Link key={`${action.label}_${index}`} className={className} to={action.to}>{action.label}</Link>;
  }
  return (
    <button key={`${action.label}_${index}`} className={className} type="button" onClick={action.onClick}>
      {action.label}
    </button>
  );
}

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode | HeaderAction[];
}): React.ReactElement {
  const renderedActions = Array.isArray(actions) ? actions.map(renderAction) : actions;

  return (
    <header className="card uiPageHeader">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h2 className="uiPageHeaderTitle">{title}</h2>
        {description ? <p className="uiPageHeaderDescription">{description}</p> : null}
      </div>
      {renderedActions ? <div className="uiPageHeaderActions">{renderedActions}</div> : null}
    </header>
  );
}
