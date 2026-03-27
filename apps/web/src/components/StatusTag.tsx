import React from "react";
import StatusBadge from "./common/StatusBadge";

export function StatusTag({ status, showCode = false }: { status: string; showCode?: boolean }): React.ReactElement {
  return <StatusBadge status={status} showCode={showCode} />;
}
