import type { CustomerDashboardAggregateV1 } from "../api/reports";

const STATUS_COPY: Record<string, string> = {
  SUCCESS: "已完成并通过验收",
  SUCCEEDED: "已完成并通过验收",
  PENDING_ACCEPTANCE: "已执行，等待验收确认",
  INVALID_EXECUTION: "执行结果异常，需复核",
  FAILED: "未达成目标，需补救",
  ERROR: "执行中断，需人工处理",
  NOT_EXECUTED: "本周期未执行",
  RUNNING: "正在执行中",
  PENDING: "待安排执行",
};

export type CustomerDashboardViewModel = {
  result: {
    title: string;
    summary: string;
    detail: string;
    recent: Array<{ title: string; statusText: string; whenText: string }>;
  };
  riskImpact: {
    title: string;
    summary: string;
    detail: string;
    signals: string[];
  };
  costTrend: {
    title: string;
    summary: string;
    detail: string;
  };
  actionAdvice: {
    title: string;
    summary: string;
    items: string[];
  };
};

function fmtDate(value: string | null | undefined): string {
  if (!value) return "时间待补充";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "时间待补充";
  return new Date(ms).toLocaleString();
}

/**
 * 仅允许消费后端 customer-dashboard aggregate 的结果。
 * 禁止在前端基于 reports 列表计算 total_cost / risk level / trend / summary。
 */
export function buildCustomerDashboardViewModel(aggregate: CustomerDashboardAggregateV1): CustomerDashboardViewModel {
  const total = Number(aggregate?.fields?.total ?? 0);
  const healthy = Number(aggregate?.fields?.healthy ?? 0);
  const atRisk = Number(aggregate?.fields?.at_risk ?? 0);

  return {
    result: {
      title: "结果（完成/未完成）",
      summary: `地块总数 ${total}，健康 ${healthy}，风险 ${atRisk}`,
      detail: "统计口径以聚合接口返回为准",
      recent: (aggregate?.recent_operations || []).slice(0, 5).map((item, idx) => ({
        title: `${idx + 1}. ${item.operation_plan_id || item.operation_id || "作业"}`,
        statusText: STATUS_COPY[String(item.risk_level ?? "").toUpperCase()] ?? "状态待确认",
        whenText: fmtDate(item.executed_at),
      })),
    },
    riskImpact: {
      title: "风险影响",
      summary: `当前风险等级：${String(aggregate?.risk_summary?.level ?? "UNKNOWN")}`,
      detail: "风险信息由后端聚合接口直接提供。",
      signals: (aggregate?.risk_summary?.top_reasons || []).slice(0, 5),
    },
    costTrend: {
      title: "成本趋势",
      summary: `本周期预计投入 ¥${Number(aggregate?.period_summary?.estimated_total_cost ?? 0).toFixed(2)}，实际投入 ¥${Number(aggregate?.period_summary?.actual_total_cost ?? 0).toFixed(2)}`,
      detail: "趋势信息由后端定义并返回。",
    },
    actionAdvice: {
      title: "本周期行动建议",
      summary: "行动建议文案由后端聚合结果决定。",
      items: ["请结合后端返回的风险原因与周期指标制定动作。"],
    },
  };
}
