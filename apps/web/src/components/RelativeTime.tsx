import React from "react";
import { formatAbsoluteZh, formatRelativeZh } from "../lib/presentation/time";

export function RelativeTime({ value }: { value: string | number | null | undefined }): React.ReactElement {
  const full = formatAbsoluteZh(value);
  return <span title={full}>{formatRelativeZh(value)}</span>;
}

export function absoluteTime(value: string | number | null | undefined): string {
  return formatAbsoluteZh(value);
}
