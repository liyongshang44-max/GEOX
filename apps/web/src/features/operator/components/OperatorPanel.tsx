import React from "react";

export function OperatorPanel({ children, className = "", ...props }: React.HTMLAttributes<HTMLElement>): React.ReactElement {
  return <article className={["operatorPanel", className].filter(Boolean).join(" ")} {...props}>{children}</article>;
}
