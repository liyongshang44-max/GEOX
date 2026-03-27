export function toMs(v: string | number | null | undefined): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const asNum = Number(v);
    if (Number.isFinite(asNum) && /^\d+$/.test(v.trim())) return asNum;
    const parsed = Date.parse(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function formatAbsoluteZh(v: string | number | null | undefined): string {
  const ms = toMs(v);
  return ms ? new Date(ms).toLocaleString("zh-CN", { hour12: false }) : "-";
}

export function formatRelativeZh(v: string | number | null | undefined): string {
  const ms = toMs(v);
  if (!ms) return "-";
  const diff = Date.now() - ms;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  if (abs < minute) return "刚刚";
  if (abs < hour) return `${Math.floor(abs / minute)} 分钟前`;
  if (abs < day) return `${Math.floor(abs / hour)} 小时前`;
  return `${Math.floor(abs / day)} 天前`;
}
