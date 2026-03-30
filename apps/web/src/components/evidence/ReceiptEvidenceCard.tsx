import React from "react";
import type { ReceiptEvidenceVm } from "../../viewmodels/evidence";

type Props = {
  data?: ReceiptEvidenceVm;
  actionLabel?: string;
  executorTypeLabel?: string;
};

function buildReadableResultLabel(actionLabel: string | undefined, statusTone: ReceiptEvidenceVm["statusTone"]): string {
  const normalizedAction = actionLabel?.trim() || "作业";
  if (statusTone === "success") return `${normalizedAction}完成 ✔`;
  if (statusTone === "danger") return `${normalizedAction}异常 ✖`;
  return `${normalizedAction}进行中`;
}

export default function ReceiptEvidenceCard({ data, actionLabel, executorTypeLabel }: Props): React.ReactElement {
  if (!data) {
    return (
      <div className="p-4 border rounded-xl text-sm text-gray-500">
        暂无执行证据
      </div>
    );
  }

  const resultLabel = buildReadableResultLabel(actionLabel, data.statusTone);
  const waterLabel = data.waterLabel || "-";
  const durationLabel = data.durationLabel || "-";
  const executorLabel = data.executorLabel || executorTypeLabel || "-";

  return (
    <div className="p-6 rounded-2xl border bg-white shadow-sm space-y-5">
      <div className="flex justify-between items-center">
        <div className="text-base font-semibold">{data.title || "执行证据"}</div>
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
          {data.statusLabel}
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
        {data.startedAtLabel ? <div>开始执行：{data.startedAtLabel}</div> : null}
        {data.finishedAtLabel ? <div>执行结束：{data.finishedAtLabel}</div> : null}
        {data.constraintCheckLabel ? <div>约束核验：{data.constraintCheckLabel}</div> : null}
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        {data.waterLabel ? <div>用水：{data.waterLabel}</div> : null}
        {data.powerLabel ? <div>耗电：{data.powerLabel}</div> : null}
        {data.chemicalLabel ? <div>药剂：{data.chemicalLabel}</div> : null}
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        {data.logCountLabel ? <div>过程记录：{data.logCountLabel}</div> : null}
        {data.violationSummary ? <div className="text-red-500">风险提示：{data.violationSummary}</div> : null}
      </div>
    </div>
  );
}
