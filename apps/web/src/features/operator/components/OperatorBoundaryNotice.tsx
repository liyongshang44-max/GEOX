import React from "react";

export function OperatorBoundaryNotice({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={["operatorBoundaryNotice", className].filter(Boolean).join(" ")} {...props}>{children}</div>;
}
