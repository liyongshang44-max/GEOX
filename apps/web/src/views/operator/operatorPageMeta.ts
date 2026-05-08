export type OperatorPageKey = "workbench" | "approvals" | "dispatch" | "acceptance" | "evidence";

export const OPERATOR_PAGE_META: Record<OperatorPageKey, { title: string; lead: string; emptyTitle: string; emptyDescription: string }> = {
  workbench: {
    title: "运营总队列",
    lead: "汇总待审批、待派发、待验收、证据不足与异常执行事项。",
    emptyTitle: "运营总队列暂未接入",
    emptyDescription: "当前只建立 P1-B 路由与壳层，后续接入 /api/v1/operator/workbench。",
  },
  approvals: {
    title: "审批中心",
    lead: "集中处理建议、处方与关键作业授权。",
    emptyTitle: "审批中心暂未接入",
    emptyDescription: "当前只建立 P1-B 路由与壳层，后续接入 /api/v1/operator/approvals。",
  },
  dispatch: {
    title: "派发状态",
    lead: "查看任务生成、派发、接单和执行回执状态。",
    emptyTitle: "派发状态暂未接入",
    emptyDescription: "当前只建立 P1-B 路由与壳层，后续接入 /api/v1/operator/dispatch。",
  },
  acceptance: {
    title: "验收中心",
    lead: "复核执行结果、验收结论与待补证事项。",
    emptyTitle: "验收中心暂未接入",
    emptyDescription: "当前只建立 P1-B 路由与壳层，后续接入 /api/v1/operator/acceptance。",
  },
  evidence: {
    title: "证据中心",
    lead: "检查证据完整性、证据包摘要和异常证据记录。",
    emptyTitle: "运营证据中心暂未接入",
    emptyDescription: "当前只建立 P1-B 路由与壳层，后续接入 /api/v1/operator/evidence。",
  },
};
