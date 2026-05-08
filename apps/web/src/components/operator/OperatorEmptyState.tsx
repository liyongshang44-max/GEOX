import React from "react";

type OperatorEmptyStateProps = {
  title: string;
  description: string;
  reason?: string;
};

export default function OperatorEmptyState({ title, description, reason }: OperatorEmptyStateProps): React.ReactElement {
  return (
    <div className="operatorEmptyState">
      <strong>{title}</strong>
      <p>{description}</p>
      {reason ? <small>{reason}</small> : null}
    </div>
  );
}
