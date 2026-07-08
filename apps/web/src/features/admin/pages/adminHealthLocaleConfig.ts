// apps/web/src/features/admin/pages/adminHealthLocaleConfig.ts
import type { LocalizedCopy } from "../../../lib/locale";
import type { AdminGovernanceLocaleConfig } from "./AdminGovernanceLocalePage";

const c = (zh: string, en: string): LocalizedCopy => ({ zh, en });

export const ADMIN_HEALTH_LOCALE_CONFIG: AdminGovernanceLocaleConfig = {
  route: "/admin/healthz",
  eyebrow: c("后台管理 / 健康", "Admin Console / Healthz"),
  title: c("健康回查", "Health Readback"),
  lead: c("查看内部健康、降级、不可用与路由命名债务状态。", "Review internal health, degraded, unavailable, and route-naming-debt states."),
  metadata: c("路由命名债务：/admin/health 未提升", "Route naming debt: /admin/health not promoted"),
  nonclaim: c("只读健康回查；不是生产就绪证明，也不是实时监控。", "Read-only health readback; not production-readiness proof and not live monitoring."),
  boundaryTitle: c("Healthz 是回查，不是生产证明", "Healthz Is Readback, Not Production Proof"),
  boundaryDescription: c("查看健康元数据和不可用状态，不声明生产就绪或提升 /admin/health。", "Review health metadata and unavailable states without claiming production readiness or promoting /admin/health."),
  boundaryItems: [c("/admin/health 未提升", "/admin/health Not Promoted"), c("交互能力已禁用", "Interactive Capability Disabled"), c("非实时监控", "Not Live Monitoring")],
  mode: c("健康回查", "Health Readback"),
  metrics: [
    { label: c("健康字段", "Health Fields"), value: 4, description: c("健康、降级和不可用状态。", "Health, degraded, and unavailable states."), source: c("健康治理目录", "Health governance catalog"), status: "readOnly" },
    { label: c("降级状态", "Degraded State"), value: "Defined", description: c("降级状态仅用于回查。", "Degraded state is readback only."), source: c("健康治理目录", "Health governance catalog"), status: "degraded" },
    { label: c("路由命名债务", "Route Naming Debt"), value: "Recorded", description: c("/admin/health 仍延期。", "/admin/health remains deferred."), source: c("Admin 路由契约", "Admin route contract"), status: "future" },
  ],
  sections: [{
    title: c("健康状态字段", "Health Status Fields"),
    subtitle: c("健康、降级、不可用和路由命名债务状态。", "Health, degraded, unavailable, and route-naming-debt states."),
    caption: c("Admin 健康回查清单", "Admin Health Readback Inventory"),
    headers: [c("标签", "Label"), c("值", "Value"), c("状态", "State"), c("边界", "Boundary")],
    emptyTitle: c("暂无健康回查记录", "No Health Readback Rows"),
    emptyDescription: c("当前没有可显示的记录。", "No rows are currently available."),
    rows: [
      { key: "system", cells: [{ text: c("系统健康", "System Health") }, { text: c("回查", "Readback") }, { text: c("可用或降级", "Available or Degraded") }, { text: c("非生产就绪证明", "Not Production-readiness Proof") }] },
      { key: "service", cells: [{ text: c("服务状态", "Service Status") }, { text: c("回查", "Readback") }, { text: c("允许不可用", "Unavailable Allowed") }, { text: c("仅状态回查", "Status Readback Only") }] },
      { key: "route", cells: [{ text: c("健康路由", "Health Route") }, { neutral: "/admin/healthz" }, { text: c("正式路由", "Formal Route") }, { text: c("仅回查", "Readback Only") }] },
      { key: "debt", cells: [{ text: c("路由命名债务", "Route Naming Debt") }, { neutral: "/admin/health" }, { text: c("后续阶段", "Future") }, { text: c("不提升路由", "No Route Promotion") }] },
    ],
  }],
  finalState: { kind: "future", title: c("/admin/health 仍延期", "/admin/health Remains Deferred"), description: c("记录路由命名债务，不增加新路由或正式导航。", "The route naming debt is recorded without adding a new route or formal navigation item.") },
};
