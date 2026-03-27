function toMs(v: string | number | null | undefined): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const asNum = Number(v);
    if (Number.isFinite(asNum) && /^\d+$/.test(v.trim())) return asNum;
    const parsed = Date.parse(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function formatDateTimeZh(v: string | number | null | undefined): string {
  const ms = toMs(v);
  return ms ? new Date(ms).toLocaleString("zh-CN", { hour12: false }) : "-";
}

export function formatRelativeTimeZh(v: string | number | null | undefined): string {
  const ms = toMs(v);
  if (!ms) return "-";
  const now = Date.now();
  const diff = now - ms;
  const abs = Math.abs(diff);
  const m = 60_000;
  const h = 3_600_000;
  const d = 86_400_000;

  if (abs < m) return "刚刚";
  if (abs < h) return `${Math.floor(abs / m)} 分钟前`;

  const dt = new Date(ms);
  const today = new Date(now);
  const yesterday = new Date(now - d);
  const hm = dt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (dt.toDateString() === today.toDateString()) return `今天 ${hm}`;
  if (dt.toDateString() === yesterday.toDateString()) return `昨天 ${hm}`;
  if (abs < 7 * d) return `${Math.floor(abs / d)} 天前`;
  return formatDateTimeZh(ms);
}

export function formatTimeOrFallback(v: string | number | null | undefined, fallback = "-"): string {
  const s = formatRelativeTimeZh(v);
  return s === "-" ? fallback : s;
}
