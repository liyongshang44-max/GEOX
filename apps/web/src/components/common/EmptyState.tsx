import React from "react";

export default function EmptyState({
  title,
  description,
  actionText,
  onAction,
}: {
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}): React.ReactElement {
  return (
    <div className="emptyState">
      <strong>{title}</strong>
      {description ? <div className="muted" style={{ marginTop: 6 }}>{description}</div> : null}
      {actionText && onAction ? <button className="btn" style={{ marginTop: 10 }} onClick={onAction}>{actionText}</button> : null}
    </div>
  );
}
