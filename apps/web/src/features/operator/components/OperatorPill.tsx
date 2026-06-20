import React from "react";

export function OperatorPill({ children, className = "", ...props }: React.HTMLAttributes<HTMLSpanElement>): React.ReactElement {
  return <span className={["operatorPill", className].filter(Boolean).join(" ")} {...props}>{children}</span>;
}
