import React from "react";

export function OperatorTable({ children, className = "", ...props }: React.TableHTMLAttributes<HTMLTableElement>): React.ReactElement {
  return <table className={["operatorTable", className].filter(Boolean).join(" ")} {...props}>{children}</table>;
}
