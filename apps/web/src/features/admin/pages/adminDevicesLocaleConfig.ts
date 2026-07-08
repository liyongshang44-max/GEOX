// apps/web/src/features/admin/pages/adminDevicesLocaleConfig.ts
import type { LocalizedCopy } from "../../../lib/locale";
import type { AdminGovernanceLocaleConfig } from "./AdminGovernanceLocalePage";

const c = (zh: string, en: string): LocalizedCopy => ({ zh, en });

export const ADMIN_DEVICES_LOCALE_CONFIG: AdminGovernanceLocaleConfig = {
  route: "/admin/devices",
  eyebrow: c("后台管理 / 设备", "Admin Console / Devices"),
  title: c("设备清单", "Device Inventory"),
  lead: c("查看内部设备清单、连接回查和来源身份。", "Review internal device inventory, connectivity readback, and source identity."),
  metadata: c("来源：Admin 设备治理回查", "Source: Admin device-governance readback"),
  nonclaim: c("只读设备治理；非生产控制，不是实时监控，也不提供交互动作。", "Read-only device governance; not production control, not live monitoring, and no interactive actions are provided."),
  boundaryTitle: c("设备清单不是生产控制", "Device Inventory Is Not Production Control"),
  boundaryDescription: c("显示连接与来源元数据，不声明实时设备已连接，也不提供生产控制。", "Displays connectivity and source metadata without claiming a live device connection or providing production control."),
  boundaryItems: [c("非生产控制", "Not Production Control"), c("实时设备：未连接", "Live Device: Not Connected"), c("生产网关：未上线", "Production Gateway: Not Online"), c("交互动作：已禁用", "Interactive Actions: Disabled")],
  mode: c("设备清单回查", "Device Inventory Readback"),
  metrics: [
    { label: c("清单字段", "Inventory Fields"), value: 6, description: c("设备治理与来源字段。", "Device-governance and source fields."), source: c("设备治理目录", "Device governance catalog"), status: "readOnly" },
    { label: c("连接状态", "Connection State"), value: c("回查", "Readback"), description: c("连接状态是元数据，不是实时监控声明。", "Connectivity is metadata, not a live-monitoring claim."), source: c("设备治理目录", "Device governance catalog"), status: "notConnected" },
    { label: c("不可用状态", "Unavailable State"), value: c("已定义", "Defined"), description: c("未知、不可用、过期和降级均可显示。", "Unknown, unavailable, stale, and degraded display states are supported."), source: c("PFA-2 状态词目录", "PFA-2 state-label catalog"), status: "unavailable" },
  ],
  sections: [{
    title: c("设备治理字段", "Device Governance Fields"),
    subtitle: c("清单字段、含义、状态和角色边界。", "Inventory fields, meaning, state, and role boundaries."),
    caption: c("Admin 设备清单字段", "Admin Device Inventory Fields"),
    headers: [c("字段", "Field"), c("含义", "Meaning"), c("状态", "State"), c("边界", "Boundary")],
    emptyTitle: c("暂无设备清单记录", "No Device Inventory Rows"),
    emptyDescription: c("当前没有可显示的记录。", "No rows are currently available."),
    rows: [
      { key: "device_id", cells: [{ neutral: "device_id" }, { text: c("身份", "Identity") }, { text: c("可用", "Available") }, { text: c("清单回查", "Inventory Readback") }] },
      { key: "binding_status", cells: [{ neutral: "binding_status" }, { text: c("地块绑定", "Field Binding") }, { text: c("可用", "Available") }, { text: c("仅回查", "Readback Only") }] },
      { key: "online_status", cells: [{ neutral: "online_status" }, { text: c("连接回查", "Connectivity Readback") }, { text: c("允许未知或不可用", "Unknown or Unavailable Allowed") }, { text: c("非实时监控", "Not Live Monitoring") }] },
      { key: "last_seen", cells: [{ neutral: "last_seen" }, { text: c("遥测新鲜度", "Telemetry Recency") }, { text: c("过期时降级", "Degraded When Stale") }, { text: c("仅回查", "Readback Only") }] },
      { key: "capability", cells: [{ neutral: "capability" }, { text: c("声明能力", "Declared Capability") }, { text: c("仅元数据", "Metadata Only") }, { text: c("无交互动作", "No Interactive Action") }] },
      { key: "source_evidence_refs", cells: [{ neutral: "source_evidence_refs" }, { text: c("可追溯性", "Traceability") }, { text: c("有来源时可用", "Available When Sourced") }, { text: c("仅来源身份", "Source Identity Only") }] },
    ],
  }],
  finalState: { kind: "notConnected", title: c("非生产控制", "Not Production Control"), description: c("本页仅建立双语显示能力；设备状态数据契约仍由 PFA-5 负责。", "This page establishes bilingual display capability only; the device-status data contract remains owned by PFA-5.") },
};
