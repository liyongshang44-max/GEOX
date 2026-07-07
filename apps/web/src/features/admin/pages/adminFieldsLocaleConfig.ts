// apps/web/src/features/admin/pages/adminFieldsLocaleConfig.ts
import type { LocalizedCopy } from "../../../lib/locale";
import type { AdminGovernanceLocaleConfig } from "./AdminGovernanceLocalePage";

const c = (zh: string, en: string): LocalizedCopy => ({ zh, en });

export const ADMIN_FIELDS_LOCALE_CONFIG: AdminGovernanceLocaleConfig = {
  route: "/admin/fields",
  eyebrow: c("后台管理 / 地块", "Admin Console / Fields"),
  title: c("地块清单", "Field Inventory"),
  lead: c("查看内部地块治理状态和来源身份。", "Review internal field-governance status and source identity."),
  metadata: c("来源：Admin 地块治理回查", "Source: Admin field-governance readback"),
  nonclaim: c("只读治理回查；不是客户报告，也不提供派发能力。", "Read-only governance readback; not Customer reporting and no dispatch capability."),
  boundaryTitle: c("地块治理回查", "Field Governance Readback"),
  boundaryDescription: c("本页不创建地块、不编辑客户报告、不改变运行状态。", "This page does not create fields, edit customer reports, or change runtime state."),
  boundaryItems: [c("非客户报告", "Not Customer Reporting"), c("无派发", "No Dispatch"), c("只读来源身份", "Read-only Source Identity")],
  mode: c("治理回查", "Governance Readback"),
  metrics: [
    { label: c("治理字段", "Governance Fields"), value: 4, description: c("允许的治理回查字段。", "Allowed governance-readback fields."), source: c("地块治理目录", "Field governance catalog"), status: "readOnly" },
  ],
  sections: [{
    title: c("地块治理字段", "Field Governance Fields"),
    subtitle: c("字段、状态、来源和角色边界。", "Fields, states, sources, and role boundaries."),
    caption: c("Admin 地块治理清单", "Admin Field Governance Inventory"),
    headers: [c("字段", "Field"), c("状态", "Status"), c("来源", "Source"), c("边界", "Boundary")],
    emptyTitle: c("暂无地块治理记录", "No Field Governance Rows"),
    emptyDescription: c("当前没有可显示的记录。", "No rows are currently available."),
    rows: [
      { key: "field_id", cells: [{ neutral: "field_id" }, { text: c("身份回查", "Identity Readback") }, { text: c("地块来源", "Field Source") }, { text: c("非客户报告", "Not Customer Reporting") }] },
      { key: "field_status", cells: [{ neutral: "field_status" }, { text: c("治理状态", "Governance Status") }, { text: c("治理回查", "Governance Readback") }, { text: c("只读", "Read-only") }] },
      { key: "season_context", cells: [{ neutral: "season_context" }, { text: c("上下文回查", "Context Readback") }, { text: c("治理回查", "Governance Readback") }, { text: c("无派发", "No Dispatch") }] },
      { key: "source_identity", cells: [{ neutral: "source_identity" }, { text: c("可追溯来源", "Traceable Source") }, { text: c("来源身份", "Source Identity") }, { text: c("无执行操作", "No Execution Action") }] },
    ],
  }],
};
