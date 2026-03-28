export type ReceiptEvidenceVm = {
  title: string;
  statusLabel: string;
  statusTone: "success" | "warning" | "danger" | "neutral";

  executorLabel?: string;

  startedAtLabel?: string;
  finishedAtLabel?: string;
  durationLabel?: string;

  waterLabel?: string;
  powerLabel?: string;
  chemicalLabel?: string;

  logCountLabel?: string;

  constraintCheckLabel?: string;
  violationSummary?: string;

  metaLabel?: string;
  href?: string;
};

function toMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatTimeLabel(value: unknown): string | undefined {
  const ms = toMs(value);
  return ms == null ? undefined : new Date(ms).toLocaleString();
}

// 把后端 summary 转 UI
export function mapReceiptToVm(r: any): ReceiptEvidenceVm {
  const status = String(r?.receipt_status || r?.status || "").toUpperCase();

  const tone: ReceiptEvidenceVm["statusTone"] =
    status === "SUCCEEDED" || status === "EXECUTED"
      ? "success"
      : status === "FAILED" || status === "NOT_EXECUTED"
        ? "danger"
        : "neutral";

  const startedAtMs = toMs(r?.execution_started_at);
  const finishedAtMs = toMs(r?.execution_finished_at);
  const duration =
    startedAtMs != null && finishedAtMs != null
      ? `${Math.round((finishedAtMs - startedAtMs) / 1000)} 秒`
      : undefined;
  const metaParts = [
    typeof r?.device_id === "string" ? `设备 ${r.device_id}` : null,
    typeof r?.executor_label === "string" ? `执行器 ${r.executor_label}` : null,
  ].filter(Boolean);

  return {
    title: "执行证据",
    statusLabel:
      status === "SUCCEEDED" || status === "EXECUTED"
        ? "已完成"
        : status === "FAILED" || status === "NOT_EXECUTED"
          ? "执行失败"
          : "未知状态",

    statusTone: tone,

    executorLabel: r?.executor_label || r?.executor_id || undefined,

    startedAtLabel: formatTimeLabel(r?.execution_started_at),
    finishedAtLabel: formatTimeLabel(r?.execution_finished_at),

    durationLabel: duration,

    waterLabel: r?.water_l != null ? `${Number(r.water_l).toFixed(0)} L` : undefined,

    powerLabel: r?.electric_kwh != null ? `${Number(r.electric_kwh).toFixed(2)} kWh` : undefined,

    chemicalLabel: r?.chemical_ml != null ? `${Number(r.chemical_ml).toFixed(0)} ml` : undefined,

    logCountLabel: r?.log_ref_count != null ? `${r.log_ref_count} 条日志` : undefined,

    constraintCheckLabel: r?.constraint_violated ? "存在违规" : "符合约束",

    violationSummary: r?.constraint_violated ? "检测到违规操作" : undefined,

    metaLabel: metaParts.length > 0 ? metaParts.join(" · ") : undefined,
    href: typeof r?.href === "string" ? r.href : undefined,
  };
}

export function mapDashboardEvidenceToVm(item: any): ReceiptEvidenceVm {
  const source = item?.summary ?? item ?? {};
  return mapReceiptToVm({
    ...source,
    receipt_status: item?.status ?? source?.receipt_status,
    execution_finished_at: item?.finished_at ?? source?.execution_finished_at,
    water_l: item?.water_l ?? source?.water_l,
    electric_kwh: item?.electric_kwh ?? source?.electric_kwh,
    log_ref_count: item?.log_ref_count ?? source?.log_ref_count,
    constraint_violated: item?.constraint_violated ?? source?.constraint_violated,
    executor_label: item?.executor_label ?? source?.executor_label,
    receipt_fact_id: item?.receipt_fact_id ?? source?.receipt_fact_id,
    receipt_type: item?.receipt_type ?? source?.receipt_type,
    href: item?.href,
  });
}
