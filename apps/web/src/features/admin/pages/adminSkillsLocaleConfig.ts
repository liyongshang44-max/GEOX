// apps/web/src/features/admin/pages/adminSkillsLocaleConfig.ts
import type { LocalizedCopy } from "../../../lib/locale";
import type { AdminGovernanceLocaleConfig } from "./AdminGovernanceLocalePage";

const c = (zh: string, en: string): LocalizedCopy => ({ zh, en });

export const ADMIN_SKILLS_LOCALE_CONFIG: AdminGovernanceLocaleConfig = {
  route: "/admin/skills",
  eyebrow: c("后台管理 / 技能", "Admin Console / Skills"),
  title: c("技能 / 配置回查", "Skills / Config Readback"),
  lead: c("查看内部技能注册表、Worker 状态、最近运行与队列延迟。", "Review the internal skills registry, worker state, last run, and queue lag."),
  metadata: c("路由命名债务：/admin/config 未提升", "Route naming debt: /admin/config not promoted"),
  nonclaim: c("只读治理回查；不是技能执行、派发或生产控制。", "Read-only governance readback; not skill execution, dispatch, or production control."),
  boundaryTitle: c("技能回查不是执行", "Skills Readback Is Not Execution"),
  boundaryDescription: c("记录技能与配置回查并保持 /admin/config 延期，不启动技能运行。", "Records skills and config readback while keeping /admin/config deferred, without starting skill runs."),
  boundaryItems: [c("/admin/config 未提升", "/admin/config Not Promoted"), c("无技能运行修改", "No Skill-run Mutation"), c("非服务操作", "Not a Service Action")],
  mode: c("技能注册表回查", "Skills Registry Readback"),
  metrics: [
    { label: c("回查字段", "Readback Fields"), value: 5, description: c("技能、Worker 和队列元数据。", "Skills, worker, and queue metadata."), source: c("技能治理目录", "Skills governance catalog"), status: "readOnly" },
    { label: c("路由命名债务", "Route Naming Debt"), value: "Recorded", description: c("/admin/config 仍是后续页面。", "/admin/config remains a future page."), source: c("Admin 路由契约", "Admin route contract"), status: "future" },
  ],
  sections: [{
    title: c("技能注册表回查", "Skills Registry Readback"),
    subtitle: c("技能、Worker 状态、最近运行、队列延迟和路由命名债务。", "Skills, worker state, last run, queue lag, and route naming debt."),
    caption: c("Admin 技能回查清单", "Admin Skills Readback Inventory"),
    headers: [c("标签", "Label"), c("值", "Value"), c("来源", "Source"), c("边界", "Boundary")],
    emptyTitle: c("暂无技能回查记录", "No Skills Readback Rows"),
    emptyDescription: c("当前没有可显示的记录。", "No rows are currently available."),
    rows: [
      { key: "registry", cells: [{ text: c("技能注册表", "Skills Registry") }, { text: c("回查", "Readback") }, { text: c("技能来源", "Skills Source") }, { text: c("无运行修改", "No Run Mutation") }] },
      { key: "worker", cells: [{ text: c("Worker 状态", "Worker State") }, { text: c("回查", "Readback") }, { text: c("Worker 状态摘要", "Worker Status Summary") }, { text: c("无执行触发", "No Execution Trigger") }] },
      { key: "last", cells: [{ text: c("最近运行", "Last Run") }, { text: c("回查", "Readback") }, { text: c("运行元数据", "Run Metadata") }, { text: c("仅元数据", "Metadata Only") }] },
      { key: "queue", cells: [{ text: c("队列延迟", "Queue Lag") }, { text: c("回查", "Readback") }, { text: c("队列摘要", "Queue Summary") }, { text: c("非生产控制", "Not Production Control") }] },
      { key: "route", cells: [{ text: c("路由命名债务", "Route Naming Debt") }, { neutral: "/admin/config" }, { text: c("Admin 路由契约", "Admin Route Contract") }, { text: c("后续页面延期", "Future Page Deferred") }] },
    ],
  }],
  finalState: { kind: "future", title: c("/admin/config 仍延期", "/admin/config Remains Deferred"), description: c("记录路由命名债务，不增加新路由或正式导航。", "The route naming debt is recorded without adding a new route or formal navigation item.") },
};
