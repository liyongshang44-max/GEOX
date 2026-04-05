import React from "react";

export default function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}): React.ReactElement {
  return (
    <header className="card uiPageHeader">
      <div>
        <h2 className="uiPageHeaderTitle">{title}</h2>
        {description ? <p className="uiPageHeaderDescription">{description}</p> : null}
      </div>
      {actions ? <div className="uiPageHeaderActions">{actions}</div> : null}
    </header>
  );
}
