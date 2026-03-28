import React from "react";
import type { ReceiptEvidenceVm } from "../../viewmodels/evidence";

type Props = {
  data?: ReceiptEvidenceVm;
};

export default function ReceiptEvidenceCard({ data }: Props): React.ReactElement {
  if (!data) {
    return (
      <div className="p-4 border rounded-xl text-sm text-gray-500">
        暂无执行证据
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl border bg-white shadow-sm space-y-3">
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

      <div className="text-sm text-gray-600 space-y-1">
        {data.metaLabel ? <div>回执摘要：{data.metaLabel}</div> : null}
        {data.href ? <div>回执链接：{data.href}</div> : null}
        {data.executorLabel ? <div>执行设备：{data.executorLabel}</div> : null}
        {data.startedAtLabel ? <div>开始执行：{data.startedAtLabel}</div> : null}
        {data.finishedAtLabel ? <div>执行结束：{data.finishedAtLabel}</div> : null}
        {data.durationLabel ? <div>总耗时：{data.durationLabel}</div> : null}
      </div>

      <div className="flex gap-4 text-sm">
        {data.waterLabel ? <div>用水：{data.waterLabel}</div> : null}
        {data.powerLabel ? <div>耗电：{data.powerLabel}</div> : null}
        {data.chemicalLabel ? <div>药剂：{data.chemicalLabel}</div> : null}
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        {data.logCountLabel ? <div>过程记录：{data.logCountLabel}</div> : null}
        {data.constraintCheckLabel ? <div>约束核验：{data.constraintCheckLabel}</div> : null}
        {data.violationSummary ? <div className="text-red-500">风险提示：{data.violationSummary}</div> : null}
      </div>
    </div>
  );
}
