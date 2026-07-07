// apps/web/src/features/admin/pages/adminDashboardLocaleConfig.ts
// Purpose: own bilingual product copy for the formal Admin Dashboard route.

import type { LocalizedCopy } from "../../../lib/locale";
import type { AdminGovernanceLocaleConfig } from "./AdminGovernanceLocalePage";

const c = (zh: string, en: string): LocalizedCopy => ({ zh, en });
const source = c("PFA-2 Admin 治理目录", "PFA-2 Admin governance catalog");

export const ADMIN_DASHBOARD_LOCALE_CONFIG: AdminGovernanceLocaleConfig = {
  route: "/admin/dashboard",
  eyebrow: c("后台管理 / 总览", "Admin Console / Overview"),
  title: c("内部治理总览", "Internal Governance Overview"),
  lead: c("查看正式后台治理、清单与回查界面。", "Review formal administration, inventory, and governance readback surfaces."),
  metadata: source,
  nonclaim: c("只读治理回查；不是派发、AO-ACT 控制、设备控制或生产网关控制。", "Read-only governance readback; not dispatch, AO-ACT control, device control, or production gateway control."),
  boundaryTitle: c("内部治理与回查边界", "Internal Governance and Readback Boundary"),
  boundaryDescription: c("汇总正式 Admin 界面；URL-only 兼容路由和后续页面不进入正式导航。", "Summarizes formal Admin surfaces; URL-only compatibility routes and future pages remain outside formal navigation."),
  boundaryItems: [c("无派发控制台", "No Dispatch Console"), c("非生产控制", "Not Production Control"), c("非客户报告界面", "Not Customer Report UI")],
  mode: c("治理回查", "Governance Readback"),
  metrics: [
    { label: c("正式 Admin 入口", "Formal Admin Entries"), value: 6, description: c("正式导航覆盖的治理回查界面。", "Governance readback surfaces covered by formal navigation."), source, status: "readOnly" },
    { label: c("兼容路由", "Compatibility Routes"), value: 4, description: c("保留但未提升为正式界面的 URL-only 路由。", "URL-only routes preserved without promotion to formal surfaces."), source, status: "urlOnly" },
    { label: c("健康摘要", "Health Summary"), value: "Readback", description: c("Healthz 不是生产就绪证明。", "Healthz is not production readiness proof."), source, status: "partial" },
  ],
  sections: [
    {
      title: c("正式 Admin 入口", "Formal Admin Entries"),
      subtitle: c("治理总览与只读入口。", "Governance overview and read-only entries."),
      caption: c("正式 Admin 治理入口", "Formal Admin Governance Entries"),
      headers: [c("区域", "Area"), c("模式", "Mode"), c("边界", "Boundary")],
      emptyTitle: c("暂无治理入口", "No Governance Entries"),
      emptyDescription: c("当前没有可显示的正式 Admin 入口。", "No formal Admin entry is currently available."),
      rows: [
        { key: "fields", cells: [{ text: c("地块", "Fields"), href: "/admin/fields" }, { text: c("治理回查", "Governance Readback") }, { text: c("非客户报告框架", "Not Customer Report Framing") }] },
        { key: "operations", cells: [{ text: c("作业", "Operations"), href: "/admin/operations" }, { text: c("状态回查", "Status Readback") }, { text: c("非派发", "Not Dispatch") }] },
        { key: "devices", cells: [{ text: c("设备", "Devices"), href: "/admin/devices" }, { text: c("清单回查", "Inventory Readback") }, { text: c("非实时设备监控", "Not Live Device Monitoring") }] },
        { key: "evidence", cells: [{ text: c("证据", "Evidence"), href: "/admin/evidence" }, { text: c("追踪回查", "Trace Readback") }, { text: c("非事实写入", "Not Facts Writing") }] },
        { key: "skills", cells: [{ text: c("技能 / 配置", "Skills / Config"), href: "/admin/skills" }, { text: c("注册表回查", "Registry Readback") }, { text: c("/admin/config 未提升", "/admin/config Not Promoted") }] },
        { key: "health", cells: [{ text: c("健康", "Health"), href: "/admin/healthz" }, { text: c("健康回查", "Health Readback") }, { text: c("/admin/health 未提升", "/admin/health Not Promoted") }] },
      ],
    },
    {
      title: c("URL-only 兼容路由", "URL-only Compatibility Routes"),
      subtitle: c("保留但不纳入正式 Admin 产品导航。", "Preserved without inclusion in formal Admin navigation."),
      caption: c("Admin URL-only 兼容路由", "Admin URL-only Compatibility Routes"),
      headers: [c("路径", "Path"), c("状态", "Status"), c("说明", "Note")],
      emptyTitle: c("暂无兼容路由", "No Compatibility Routes"),
      emptyDescription: c("当前没有登记的兼容路由。", "No compatibility route is currently registered."),
      rows: [
        { key: "alerts", cells: [{ neutral: "/admin/alerts" }, { text: c("仅 URL 兼容", "URL-only Compatibility") }, { text: c("不是正式 PFE-5 界面。", "Not a formal PFE-5 surface.") }] },
        { key: "acceptance", cells: [{ neutral: "/admin/acceptance" }, { text: c("仅 URL 兼容", "URL-only Compatibility") }, { text: c("保持不进入正式导航。", "Formal navigation exclusion is preserved.") }] },
        { key: "import", cells: [{ neutral: "/admin/import" }, { text: c("仅 URL 兼容", "URL-only Compatibility") }, { text: c("导入流程未提升。", "Import workflow is not promoted.") }] },
        { key: "debug", cells: [{ neutral: "/admin/operations/:operationId/debug" }, { text: c("仅 URL 兼容", "URL-only Compatibility") }, { text: c("调试路由未提升。", "Debug route is not promoted.") }] },
      ],
    },
  ],
  finalState: { kind: "future", title: c("后续 Admin 契约仍延期", "Future Admin Contracts Remain Deferred"), description: c("/admin/config、/admin/health、/admin/audit、/admin/imports 和 /admin/tenants 未在 PFA-2 实现或提升。", "/admin/config, /admin/health, /admin/audit, /admin/imports, and /admin/tenants are not implemented or promoted in PFA-2.") },
};
