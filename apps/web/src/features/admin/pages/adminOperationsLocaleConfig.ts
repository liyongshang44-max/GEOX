// apps/web/src/features/admin/pages/adminOperationsLocaleConfig.ts
import type { LocalizedCopy } from "../../../lib/locale";
import type { AdminGovernanceLocaleConfig } from "./AdminGovernanceLocalePage";

const c = (zh: string, en: string): LocalizedCopy => ({ zh, en });

export const ADMIN_OPERATIONS_LOCALE_CONFIG: AdminGovernanceLocaleConfig = {
  route: "/admin/operations",
  eyebrow: c("后台管理 / 作业", "Admin Console / Operations"),
  title: c("作业清单", "Operation Inventory"),
  lead: c("以非派发框架查看内部作业治理状态。", "Review internal operation-governance state with non-dispatch framing."),
  metadata: c("来源：Admin 作业治理回查", "Source: Admin operation-governance readback"),
  nonclaim: c("只读治理回查；不派发、不创建任务、不改变审批或运行状态。", "Read-only governance readback; no dispatch, task creation, approval mutation, or runtime mutation."),
  boundaryTitle: c("作业治理不是派发", "Operation Governance Is Not Dispatch"),
  boundaryDescription: c("查看作业状态和阻断状态，不提供执行工作流。", "Review operation and blocked state without exposing an execution workflow."),
  boundaryItems: [c("无派发", "No Dispatch"), c("无任务创建", "No Task Creation"), c("非客户作业报告", "Not a Customer Operation Report")],
  mode: c("作业治理回查", "Operation Governance Readback"),
  metrics: [
    { label: c("治理字段", "Governance Fields"), value: 6, description: c("允许的作业治理状态字段。", "Allowed operation-governance state fields."), source: c("作业治理目录", "Operation governance catalog"), status: "readOnly" },
    { label: c("阻断状态", "Blocked State"), value: c("回查", "Readback"), description: c("阻断或降级仅作为回查状态。", "Blocked or degraded state is readback only."), source: c("作业治理目录", "Operation governance catalog"), status: "degraded" },
  ],
  sections: [{
    title: c("作业治理字段", "Operation Governance Fields"),
    subtitle: c("状态、回查含义和角色边界。", "States, readback meaning, and role boundaries."),
    caption: c("Admin 作业治理清单", "Admin Operation Governance Inventory"),
    headers: [c("字段", "Field"), c("回查", "Readback"), c("状态", "State"), c("边界", "Boundary")],
    emptyTitle: c("暂无作业治理记录", "No Operation Governance Rows"),
    emptyDescription: c("当前没有可显示的记录。", "No rows are currently available."),
    rows: [
      { key: "operation_id", cells: [{ neutral: "operation_id" }, { text: c("身份", "Identity") }, { text: c("可用", "Available") }, { text: c("只读", "Read-only") }] },
      { key: "plan_status", cells: [{ neutral: "plan_status" }, { text: c("规划状态", "Planning Status") }, { text: c("可用", "Available") }, { text: c("非派发", "Not Dispatch") }] },
      { key: "approval_status", cells: [{ neutral: "approval_status" }, { text: c("复核状态", "Review Status") }, { text: c("可用", "Available") }, { text: c("无审批修改", "No Approval Mutation") }] },
      { key: "task_status", cells: [{ neutral: "task_status" }, { text: c("任务状态", "Task Status") }, { text: c("可用", "Available") }, { text: c("无任务控制", "No Task Control") }] },
      { key: "receipt_status", cells: [{ neutral: "receipt_status" }, { text: c("回执状态", "Receipt Status") }, { text: c("可用", "Available") }, { text: c("仅回查", "Readback Only") }] },
      { key: "blocking_reason", cells: [{ neutral: "blocking_reason" }, { text: c("阻断状态", "Blocked State") }, { text: c("出现时降级", "Degraded When Present") }, { text: c("无执行工作流", "No Execution Workflow") }] },
    ],
  }],
  finalState: { kind: "degraded", title: c("阻断状态仅用于回查", "Blocked State Is Readback Only"), description: c("阻断或降级记录不会成为 Admin 执行控制。", "Blocked or degraded records do not become Admin execution controls.") },
};
