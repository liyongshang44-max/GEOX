import React from "react";
import type { ReceiptEvidenceVm } from "../../viewmodels/evidence";

type Props = {
  data?: ReceiptEvidenceVm;
  actionLabel?: string;
  executorTypeLabel?: string;
};

function toDisplayText(v: unknown): string {
  if (v == null) return "-";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.namespace === "string" && typeof o.kind === "string" && typeof o.id === "string") {
      return `${o.namespace}/${o.kind}/${o.id}`;
    }
    if (typeof o.id === "string" || typeof o.id === "number") return String(o.id);
    return JSON.stringify(v);
  }
  return String(v);
}

function buildReadableResultLabel(actionLabel: string | undefined, statusTone: ReceiptEvidenceVm["statusTone"]): string {
  const normalizedAction = actionLabel?.trim() && actionLabel?.trim() !== "-" ? actionLabel.trim() : "作业";
  if (statusTone === "success") return `${normalizedAction}完成 ✔`;
  if (statusTone === "danger") return `${normalizedAction}异常 ✖`;
  return `${normalizedAction}进行中`;
}

export default function ReceiptEvidenceCard({ data, actionLabel, executorTypeLabel }: Props): React.ReactElement {
  if (!data) {
    return (
      <div className="p-4 border rounded-xl text-sm text-gray-500">
        ⚠️ 执行无效：未提供证据，无法完成验收
      </div>
    );
  }

  const resultLabel = buildReadableResultLabel(toDisplayText(actionLabel), data.statusTone);
  const waterLabel = toDisplayText(data.waterLabel);
  const durationLabel = toDisplayText(data.durationLabel);
  const executorLabel = toDisplayText(data.executorLabel ?? executorTypeLabel);

  return (
    <div className="p-6 rounded-2xl border bg-white shadow-sm space-y-5">
      <div className="flex justify-between items-center">
        <div className="text-base font-semibold">{toDisplayText(data.title || "执行证据")}</div>
        <span
          className={`text-xs px-2 py-1 rounded ${
            data.statusTone === "success"
              ? "bg-green-100 text-green-700"
              : data.statusTone === "warning"
                ? "bg-amber-100 text-amber-700"
              : data.statusTone === "danger"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-600"
          }`}
        >
          {toDisplayText(data.statusLabel)}
        </span>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
        <div className="text-lg font-semibold text-emerald-700">{resultLabel}</div>
        <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
          <div>用水：{waterLabel}</div>
          <div>耗时：{durationLabel}</div>
          <div className="col-span-2">执行者：{executorLabel}</div>
        </div>
      </div>

      <div className="text-sm text-gray-600 space-y-2">
        {data.startedAtLabel ? <div>开始执行：{toDisplayText(data.startedAtLabel)}</div> : null}
        {data.finishedAtLabel ? <div>执行结束：{toDisplayText(data.finishedAtLabel)}</div> : null}
        {data.constraintCheckLabel ? <div>约束核验：{toDisplayText(data.constraintCheckLabel)}</div> : null}
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        {data.waterLabel ? <div>用水：{toDisplayText(data.waterLabel)}</div> : null}
        {data.powerLabel ? <div>耗电：{toDisplayText(data.powerLabel)}</div> : null}
        {data.chemicalLabel ? <div>药剂：{toDisplayText(data.chemicalLabel)}</div> : null}
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        {data.logCountLabel ? <div>过程记录：{toDisplayText(data.logCountLabel)}</div> : null}
        {data.violationSummary ? <div className="text-red-500">风险提示：{toDisplayText(data.violationSummary)}</div> : null}
      </div>
    </div>
  );
}
