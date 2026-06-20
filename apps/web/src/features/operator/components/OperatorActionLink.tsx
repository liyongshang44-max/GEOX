import React from "react";
import { Link, type LinkProps } from "react-router-dom";

export function OperatorActionLink({ children, className = "", ...props }: LinkProps): React.ReactElement {
  return <Link className={["operatorActionLink", className].filter(Boolean).join(" ")} {...props}>{children}</Link>;
}
