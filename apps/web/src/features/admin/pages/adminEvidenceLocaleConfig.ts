// apps/web/src/features/admin/pages/adminEvidenceLocaleConfig.ts
import type { LocalizedCopy } from "../../../lib/locale";
import type { AdminGovernanceLocaleConfig } from "./AdminGovernanceLocalePage";

const c = (zh: string, en: string): LocalizedCopy => ({ zh, en });

export const ADMIN_EVIDENCE_LOCALE_CONFIG: AdminGovernanceLocaleConfig = {
  route: "/admin/evidence",
  eyebrow: c("后台管理 / 证据", "Admin Console / Evidence"),
  title: c("来源证据", "Source Evidence"),
  lead: c("查看内部证据来源身份、追踪引用与来源缺失状态。", "Review internal evidence source identity, trace references, and missing-source states."),
  metadata: c("来源：Admin 证据治理回查", "Source: Admin evidence-governance readback"),
  nonclaim: c("只读证据治理；不是事实写入，也不显示原始修改能力。", "Read-only evidence governance; not facts writing and no raw-mutation capability is displayed."),
  boundaryTitle: c("证据治理不是事实写入", "Evidence Governance Is Not Facts Writing"),
  boundaryDescription: c("查看来源身份、追踪引用和缺失状态，不创建或编辑证据记录。", "Review source identity, trace references, and missing states without creating or editing evidence records."),
  boundaryItems: [c("来源身份可见", "Source Identity Visible"), c("保留追踪引用", "Trace References Preserved"), c("无原始修改", "No Raw Mutation")],
  mode: c("治理回查", "Governance Readback"),
  metrics: [
    { label: c("证据字段", "Evidence Fields"), value: 5, description: c("来源和追踪字段。", "Source and trace fields."), source: c("证据治理目录", "Evidence governance catalog"), status: "readOnly" },
    { label: c("来源身份", "Source Identity"), value: "Visible", description: c("来源身份属于 Admin 治理回查。", "Source identity belongs to Admin governance readback."), source: c("证据治理目录", "Evidence governance catalog") },
    { label: c("来源缺失状态", "Source-missing State"), value: "Defined", description: c("缺失或不可用状态必须明确。", "Missing or unavailable source states are explicit."), source: c("证据治理目录", "Evidence governance catalog"), status: "unavailable" },
  ],
  sections: [{
    title: c("证据治理字段", "Evidence Governance Fields"),
    subtitle: c("来源身份、追踪引用和角色边界。", "Source identity, trace references, and role boundaries."),
    caption: c("Admin 证据治理清单", "Admin Evidence Governance Inventory"),
    headers: [c("字段", "Field"), c("来源", "Source"), c("状态", "State"), c("边界", "Boundary")],
    emptyTitle: c("暂无证据治理记录", "No Evidence Governance Rows"),
    emptyDescription: c("当前没有可显示的记录。", "No rows are currently available."),
    rows: [
      { key: "evidence_ref", cells: [{ neutral: "evidence_ref" }, { text: c("证据治理来源", "Evidence Governance Source") }, { text: c("已索引时可用", "Available When Indexed") }, { text: c("仅追踪引用", "Trace Reference Only") }] },
      { key: "fact_id", cells: [{ neutral: "fact_id" }, { text: c("事实来源身份", "Fact Source Identity") }, { text: c("已关联时可用", "Available When Linked") }, { text: c("非事实写入", "Not Facts Writing") }] },
      { key: "source_ref", cells: [{ neutral: "source_ref" }, { text: c("来源回查", "Source Readback") }, { text: c("有来源时可用", "Available When Sourced") }, { text: c("无原始修改", "No Raw Mutation") }] },
      { key: "hashes", cells: [{ neutral: "hashes" }, { text: c("完整性元数据", "Integrity Metadata") }, { text: c("存在时可用", "Available When Present") }, { text: c("仅回查", "Readback Only") }] },
      { key: "trace_ids", cells: [{ neutral: "trace_ids" }, { text: c("追踪回查", "Trace Readback") }, { text: c("允许缺失", "Missing State Allowed") }, { text: c("来源身份明确", "Source Identity Explicit") }] },
    ],
  }],
  finalState: { kind: "unavailable", title: c("来源不可用状态明确", "Source-unavailable State Is Explicit"), description: c("来源缺失或不可用不会暴露原始修改能力。", "Missing or unavailable source metadata does not expose raw-mutation capability.") },
};
