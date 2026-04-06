import React from "react";
import { Link } from "react-router-dom";

export default function EmptyGuide({
  title,
  message,
  actionLabel,
  actionTo,
}: {
  title: string;
  message: string;
  actionLabel: string;
  actionTo: string;
}): React.ReactElement {
  return (
    <div className="uiEmptyGuide">
      <div className="uiEmptyGuideTitle">{title}</div>
      <p className="uiEmptyGuideText">{message}</p>
      <Link className="btn primary" to={actionTo}>{actionLabel}</Link>
    </div>
  );
}
