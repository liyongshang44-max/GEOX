import React from "react";

export default function EmptyState({ title, hint }: { title: string; hint?: string }): React.ReactElement {
  return <div className="emptyState"><strong>{title}</strong>{hint ? <div className="muted" style={{ marginTop: 6 }}>{hint}</div> : null}</div>;
}
