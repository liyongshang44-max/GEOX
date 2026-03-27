import React from "react";
import { mapGenericStatus, type StatusPresentation } from "../../lib/presentation/statusMap";

export default function StatusBadge({ status, showCode = false, presentation }: { status?: string | null; showCode?: boolean; presentation?: StatusPresentation }): React.ReactElement {
  const p = presentation ?? mapGenericStatus(status);
  return <span className={`statusTag tone-${p.tone}`} title={`原始状态码：${p.raw}`}>{p.label}{showCode ? `（${p.raw}）` : ""}</span>;
}
