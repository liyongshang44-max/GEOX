import React from "react";

export default function EmptyState({
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
}: {
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
}): React.ReactElement {
  return (
    <div className="emptyState">
      <strong>{title}</strong>
      {description ? <div className="muted" style={{ marginTop: 6 }}>{description}</div> : null}
      {(actionText && onAction) || (secondaryActionText && onSecondaryAction) ? (
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {actionText && onAction ? <button className="btn" onClick={onAction}>{actionText}</button> : null}
          {secondaryActionText && onSecondaryAction ? <button className="btn" onClick={onSecondaryAction}>{secondaryActionText}</button> : null}
        </div>
      ) : null}
    </div>
  );
}
