import React from "react";

function toMs(input: string | number | null | undefined): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input === "string" && input.trim()) {
    const num = Number(input);
    if (Number.isFinite(num) && /^\d+$/.test(input.trim())) return num;
    const parsed = Date.parse(input);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function relativeZh(ms: number): string {
  const diff = Date.now() - ms;
  const abs = Math.abs(diff);
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (abs < min) return "刚刚";
  if (abs < hour) return `${Math.floor(abs / min)} 分钟前`;
  if (abs < day) return `${Math.floor(abs / hour)} 小时前`;
  return `${Math.floor(abs / day)} 天前`;
}

export function RelativeTime({ value }: { value: string | number | null | undefined }): React.ReactElement {
  const ms = toMs(value);
  if (!ms) return <span className="muted">-</span>;
  const full = new Date(ms).toLocaleString("zh-CN", { hour12: false });
  return <span title={full}>{relativeZh(ms)}</span>;
}

export function absoluteTime(value: string | number | null | undefined): string {
  const ms = toMs(value);
  return ms ? new Date(ms).toLocaleString("zh-CN", { hour12: false }) : "-";
}
