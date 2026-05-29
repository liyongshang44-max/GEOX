import React from "react";

type OperatorEmptyStateProps = {
  title: string;
  description: string;
  reason?: string;
  role?: React.AriaRole;
  ariaLive?: "off" | "polite" | "assertive";
};

export default function OperatorEmptyState({ title, description, reason, role, ariaLive }: OperatorEmptyStateProps): React.ReactElement {
  return (
    <div className="operatorEmptyState" role={role} aria-live={ariaLive}>
      <strong>{title}</strong>
      <p>{description}</p>
      {reason ? <small>{reason}</small> : null}
    </div>
  );
}
