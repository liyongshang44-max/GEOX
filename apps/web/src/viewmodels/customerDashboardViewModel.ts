import type { CustomerDashboardAggregate, OperationReportV1 } from "../api/reports";

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

const RISK_REASON_COPY: Record<string, string> = {
  missing_evidence: "经营风险高：证据缺失，结果可信度不足",
  acceptance_timeout: "经营风险高：验收超时，影响回款与闭环",
  execution_failure: "经营风险上升：执行未达成目标",
  invalid_execution: "经营风险上升：现场执行异常",
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

function trendCopy(trend: CustomerDashboardAggregate["cost"]["trend"]): string {
  if (trend === "UP") return "成本较上一周期上升";
  if (trend === "DOWN") return "成本较上一周期下降";
  if (trend === "FLAT") return "成本保持平稳";
  return "成本趋势待补充";
}

export function buildCustomerDashboardViewModel(source: OperationReportV1[] | CustomerDashboardAggregate): CustomerDashboardViewModel {
  const aggregate: CustomerDashboardAggregate = Array.isArray(source)
    ? {
        generatedAt: new Date().toISOString(),
        totals: {
          total: source.length,
          completed: source.filter((x) => ["SUCCESS", "SUCCEEDED"].includes(String(x.execution?.final_status ?? "").toUpperCase())).length,
          incomplete: source.filter((x) => !["SUCCESS", "SUCCEEDED"].includes(String(x.execution?.final_status ?? "").toUpperCase())).length,
        },
        recentExecutions: source
          .slice()
          .sort((a, b) => Date.parse(b.generated_at) - Date.parse(a.generated_at))
          .slice(0, 5)
          .map((item) => ({
            operationId: item.identifiers.operation_id,
            title: item.identifiers.operation_plan_id,
            statusCode: item.execution.final_status,
            finishedAt: item.execution.execution_finished_at,
          })),
        risk: {
          high: source.filter((x) => String(x.risk?.level ?? "").toUpperCase() === "HIGH").length,
          medium: source.filter((x) => String(x.risk?.level ?? "").toUpperCase() === "MEDIUM").length,
          low: source.filter((x) => String(x.risk?.level ?? "").toUpperCase() === "LOW").length,
          topSignals: [],
        },
        cost: {
          currentTotal: source.reduce((sum, item) => sum + Number(item.cost?.actual_total ?? item.cost?.estimated_total ?? 0), 0),
          baselineTotal: null,
          trend: "NO_DATA",
          currency: "CNY",
        },
      }
    : source;

  const total = aggregate.totals.total || 0;
  const completionRate = total > 0 ? Math.round((aggregate.totals.completed / total) * 100) : 0;
  const riskLevelText = aggregate.risk.high > 0 ? "高" : aggregate.risk.medium > 0 ? "中" : "低";
  const riskSignals = (aggregate.risk.topSignals || []).map((signal) => RISK_REASON_COPY[signal] ?? signal);

  const advice: string[] = [];
  if (aggregate.risk.high > 0) advice.push("优先处理高风险任务：先补证据、再完成验收闭环。");
  if (aggregate.cost.trend === "UP") advice.push("建议复盘高成本作业，优化频次与资源投放。");
  if (aggregate.totals.incomplete > 0) advice.push("针对未完成任务设置责任人和截止时间，避免延期累计。");
  if (!advice.length) advice.push("本周期整体稳定，按计划推进并维持复盘节奏。");

  return {
    result: {
      title: "结果（完成/未完成）",
      summary: `本周期完成 ${aggregate.totals.completed} 项，未完成 ${aggregate.totals.incomplete} 项`,
      detail: `完成率 ${completionRate}%`,
      recent: (aggregate.recentExecutions || []).slice(0, 5).map((item, idx) => ({
        title: `${idx + 1}. ${item.title || item.operationId || "作业"}`,
        statusText: STATUS_COPY[String(item.statusCode ?? "").toUpperCase()] ?? "状态待确认",
        whenText: fmtDate(item.finishedAt),
      })),
    },
    riskImpact: {
      title: "风险影响",
      summary: `当前经营风险等级：${riskLevelText}（高风险 ${aggregate.risk.high} 项）`,
      detail: aggregate.risk.high > 0 ? "建议先处理高风险事项，降低经营波动。" : "暂无高风险阻断项。",
      signals: riskSignals.length ? riskSignals : ["暂无显著风险信号"],
    },
    costTrend: {
      title: "成本趋势",
      summary: `本周期投入约 ¥${aggregate.cost.currentTotal.toFixed(2)}`,
      detail: trendCopy(aggregate.cost.trend),
    },
    actionAdvice: {
      title: "本周期行动建议",
      summary: "以下建议按“风险优先、成本其次、效率兜底”生成。",
      items: advice,
    },
  };
}
