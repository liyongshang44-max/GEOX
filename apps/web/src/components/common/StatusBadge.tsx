import React from "react";
import { mapStatusToZh, statusTone } from "../../lib/presentation/statusMap";

export default function StatusBadge({ status, showCode = false }: { status: string | null | undefined; showCode?: boolean }): React.ReactElement {
  const tone = statusTone(status);
  const label = mapStatusToZh(status);
  const code = String(status || "").toUpperCase();
  return <span className={`statusTag tone-${tone}`}>{label}{showCode && code ? `（${code}）` : ""}</span>;
}
