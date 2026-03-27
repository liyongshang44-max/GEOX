import React from "react";
import { formatDateTimeZh, formatRelativeTimeZh } from "../lib/presentation/time";

export function RelativeTime({ value }: { value: string | number | null | undefined }): React.ReactElement {
  const full = formatDateTimeZh(value);
  return <span title={full}>{formatRelativeTimeZh(value)}</span>;
}

export function absoluteTime(value: string | number | null | undefined): string {
  return formatDateTimeZh(value);
}
