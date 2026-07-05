// apps/web/src/lib/productSurfaceLabels.ts
// Purpose: define stable bilingual labels for formal frontend product surfaces.
// Boundary: this file defines display labels only.

import { type LocalizedCopy } from "./locale";

export type ProductSurfaceId =
  | "operator-runtime-console"
  | "customer-portal"
  | "admin-console"
  | "field-runtime"
  | "replay-backed-gateway-demo"
  | "pilot-readiness";

export type ProductSurfaceLabel = {
  id: ProductSurfaceId;
  label: LocalizedCopy;
  boundary: LocalizedCopy;
};

export type ShellNavCopy = {
  label: LocalizedCopy;
  hint?: LocalizedCopy;
};

export const PRODUCT_SURFACE_LABELS: ProductSurfaceLabel[] = [
  { id: "operator-runtime-console", label: { zh: "操作员运行控制台", en: "Operator Runtime Console" }, boundary: { zh: "只读运行审查", en: "Read-only runtime review" } },
  { id: "customer-portal", label: { zh: "客户门户", en: "Customer Portal" }, boundary: { zh: "客户可见报告与经营视图", en: "Customer-visible reporting and operating views" } },
  { id: "admin-console", label: { zh: "后台管理", en: "Admin Console" }, boundary: { zh: "内部治理与只读回查界面", en: "Internal governance and readback surface" } },
  { id: "field-runtime", label: { zh: "地块运行视图", en: "Field Runtime" }, boundary: { zh: "地块级只读运行审查", en: "Field-scoped read-only runtime review" } },
  { id: "replay-backed-gateway-demo", label: { zh: "回放支撑网关演示", en: "Replay-backed Gateway Demo" }, boundary: { zh: "回放支撑演示；不是实时设备连接", en: "Replay-backed demo; not a live device connection" } },
  { id: "pilot-readiness", label: { zh: "试点准备度", en: "Pilot Readiness" }, boundary: { zh: "试点准备审查；不启动田间执行", en: "Pilot readiness review; does not start field work" } },
];

export const NAV_STATUS_LABELS = {
  routeActive: { zh: "路由可用", en: "Route active" },
  routePreserved: { zh: "路由保留", en: "Route preserved" },
  comingSoon: { zh: "即将开放", en: "Coming soon" },
} as const satisfies Record<string, LocalizedCopy>;

export const CUSTOMER_SHELL_LABELS = {
  brand: { zh: "GEOX 客户门户", en: "GEOX Customer Portal" },
  navigationAria: { zh: "客户导航", en: "Customer navigation" },
  nav: {
    dashboard: { label: { zh: "经营总览", en: "Dashboard" }, hint: { zh: "查看授权范围内的经营概况", en: "Review authorized operating overview" } },
    fields: { label: { zh: "地块", en: "Fields" }, hint: { zh: "查看授权地块", en: "Review authorized fields" } },
    operations: { label: { zh: "作业", en: "Operations" }, hint: { zh: "查看作业进展", en: "Review operation progress" } },
    reports: { label: { zh: "报告", en: "Reports" }, hint: { zh: "查看客户报告", en: "Review customer reports" } },
    export: { label: { zh: "导出", en: "Export" }, hint: { zh: "导出客户报告", en: "Export customer reports" } },
  },
  titles: {
    dashboard: { zh: "经营总览", en: "Dashboard" },
    export: { zh: "报告导出", en: "Report Export" },
    reports: { zh: "报告", en: "Reports" },
    fields: { zh: "地块", en: "Fields" },
    operations: { zh: "作业", en: "Operations" },
    fieldReport: { zh: "地块报告", en: "Field Report" },
    operationReport: { zh: "作业报告", en: "Operation Report" },
  },
  subtitles: {
    dashboard: { zh: "查看授权范围内的经营概况、近期进展与可交付报告。", en: "Review operating overview, recent progress, and deliverable reports within the authorized scope." },
    fields: { zh: "查看授权地块、地块报告与当前可展示的经营状态。", en: "Review authorized fields, field reports, and currently visible operating state." },
    operations: { zh: "查看近期作业进展、验收状态与作业报告。", en: "Review recent operation progress, acceptance status, and operation reports." },
    reports: { zh: "汇总查看经营总览、地块报告、作业报告与导出入口。", en: "Review operating overview, field reports, operation reports, and export entry points." },
    export: { zh: "导出客户可见范围内的经营报告。", en: "Export operating reports within the customer-visible scope." },
    fieldReport: { zh: "查看地块报告、近期进展与客户可见的经营状态。", en: "Review field report, recent progress, and customer-visible operating state." },
    operationReport: { zh: "查看作业进展、验收状态、证据摘要与作业报告。", en: "Review operation progress, acceptance status, evidence summary, and operation report." },
    fallback: { zh: "查看客户可见范围内的报告视图。", en: "Review reports within the customer-visible scope." },
  },
  account: {
    label: { zh: "客户账户", en: "Customer account" },
    fallback: { zh: "客户用户", en: "Customer user" },
    scopePending: { zh: "授权范围待确认", en: "Authorized scope pending" },
    readingAccessScope: { zh: "正在读取权限", en: "Reading access scope" },
    previewScope: { zh: "预览范围", en: "Preview scope" },
    globalPreview: { zh: "全域预览", en: "Global preview" },
    noAuthorizedFields: { zh: "暂无授权地块", en: "No authorized fields" },
    contactOperations: { zh: "请联系运营开通", en: "Contact operations to enable access" },
    authorizedFieldsPrefix: { zh: "授权地块", en: "Authorized fields" },
    authorizedScopeConfirmed: { zh: "授权范围已确认", en: "Authorized scope confirmed" },
  },
  searchPlaceholder: { zh: "搜索暂未开放", en: "Search not available yet" },
  searchAria: { zh: "客户侧搜索暂未开放", en: "Customer search is not available yet" },
  sidebarFooter: { zh: "客户门户仅显示授权范围内的报告与经营视图。", en: "Customer Portal only shows reports and operating views within the authorized scope." },
} as const;

export const OPERATOR_SHELL_LABELS = {
  brand: { zh: "GEOX 操作员运行控制台", en: "GEOX Operator Runtime Console" },
  navigationAria: { zh: "操作员运行控制台导航", en: "Operator Runtime Console navigation" },
  productBoundaryAria: { zh: "操作员运行控制台产品边界", en: "Operator Runtime Console product boundary" },
  productSurface: { zh: "产品界面", en: "Product Surface" },
  boundaryLabel: { zh: "边界", en: "Boundary" },
  boundaryValue: { zh: "只读运行审查；不直接执行", en: "Read-only runtime review; no direct execution" },
  footerNote: { zh: "旧操作员 URL 保持可访问。试点准备度仅用于审查，不打开受控执行。", en: "Legacy operator routes remain available by URL. Pilot Readiness is review-only and does not open controlled execution." },
  topbarReadonly: { zh: "只读 v1", en: "Read-only v1" },
  runtimeShell: { zh: "运行 Shell", en: "Runtime shell" },
  titles: {
    overview: { zh: "运行总览", en: "Runtime Overview" },
    pilot: { zh: "试点准备度", en: "Pilot Readiness" },
    workflow: { zh: "运行工作流回查", en: "Runtime Workflow Readback" },
    gateway: { zh: "回放支撑网关快照", en: "Replay-backed Gateway Snapshot" },
    fieldRuntime: { zh: "地块运行视图", en: "Field Runtime" },
    auditTrace: { zh: "审计 / 追踪", en: "Audit / Trace" },
    fallback: { zh: "操作员运行控制台", en: "Operator Runtime Console" },
  },
  leads: {
    pilot: { zh: "审查受控试点规划与准备度门槛，不启动田间执行，也不写入产品记录。", en: "Review controlled pilot planning and readiness gates without starting field execution or writing product records." },
    overview: { zh: "审查运行状态、地块准备度、证据覆盖与回放支撑边界，不创建任务或记录。", en: "Review runtime status, field readiness, evidence coverage, and replay-backed operating boundaries without creating tasks or records." },
    workflow: { zh: "治理物化边界的只读工作流回查；该 Shell 不打开受控执行，也不写入正式记录。", en: "Read-only workflow readback for governed materialization boundaries; this shell does not open controlled execution or write formal records." },
    gateway: { zh: "只读回放支撑网关快照；实时设备未连接，生产网关未上线。", en: "Read-only replay-backed gateway snapshot; live devices are not connected and the production gateway is not online." },
    fieldRuntime: { zh: "通过证据、状态、预测、残差、校准、健康与审计视图审查地块；旧路由保持可访问。", en: "Review a field through Evidence, State, Forecast, Residual, Calibration, Health, and Audit views while legacy routes remain preserved." },
    auditTrace: { zh: "审计追踪回查作为保留路由可用，且不改变运行状态。", en: "Audit trace readback is available as a preserved route and does not mutate runtime state." },
    fallback: { zh: "操作员只读运行审查界面；客户门户与后台管理保持独立。", en: "Read-only runtime surface for operator review; Customer Portal and Admin Console remain separate product surfaces." },
  },
  nav: {
    overview: { label: { zh: "总览", en: "Overview" }, hint: { zh: "运行总览沿用保留的 operator twin overview 路由，直到 canonical route ownership 完成。", en: "Runtime Overview uses the preserved operator twin overview route until canonical route ownership is finalized." } },
    fields: { label: { zh: "地块", en: "Fields" }, hint: { zh: "地块运行列表与地块级审查标签使用 canonical operator field runtime 路由族。", en: "Field Runtime list and field-scoped review tabs use the canonical operator field runtime route family." } },
    evidence: { label: { zh: "证据", en: "Evidence" }, hint: { zh: "证据中心将在路由行为审查后进入正式导航；当前证据能力仍通过 URL 或地块抽屉保留。", en: "Evidence Center enters formal navigation after route behavior review; current evidence capabilities remain preserved by URL or field drawer." } },
    forecast: { label: { zh: "预测", en: "Forecast" }, hint: { zh: "预测可通过地块运行审查标签查看，且不是建议。", en: "Forecast is available through Field Runtime review tabs and is not a recommendation." } },
    calibration: { label: { zh: "校准", en: "Calibration" }, hint: { zh: "校准可通过地块运行审查标签查看，且不更新模型状态。", en: "Calibration is available through Field Runtime review tabs and does not update model state." } },
    health: { label: { zh: "健康", en: "Health" }, hint: { zh: "运行健康可通过地块运行健康审查查看；本阶段不新增操作员聚合健康路由。", en: "Runtime Health is available through Field Runtime Health Review; no broad operator health route is added." } },
    pilot: { label: { zh: "试点", en: "Pilot" }, hint: { zh: "试点准备度审查规划与准备门槛，不代表田间试点执行。", en: "Pilot Readiness reviews planning and readiness gates. It is not field pilot execution." } },
    settings: { label: { zh: "设置", en: "Settings" }, hint: { zh: "操作员设置留待后续路由审查；当前 Shell 仅冻结产品导航槽位。", en: "Operator settings are planned for a later route review; this shell freezes the product navigation slot." } },
  },
  navStatus: NAV_STATUS_LABELS,
  runtimeNonclaims: {
    runtimeMode: { zh: "运行模式：回放支撑演示", en: "Runtime Mode: Replay-backed Demo" },
    liveDevice: { zh: "实时设备：未连接", en: "Live Device: Not connected" },
    productionGateway: { zh: "生产网关：未上线", en: "Production Gateway: Not online" },
    fieldPilot: { zh: "田间试点：未开始", en: "Field Pilot: Not started" },
    controlledExecution: { zh: "受控执行：已禁用", en: "Controlled Execution: Disabled" },
  },
} as const;

export const ADMIN_SHELL_LABELS = {
  brand: { zh: "GEOX 后台管理", en: "GEOX Admin Console" },
  navigationAria: { zh: "后台管理导航", en: "Admin navigation" },
  boundaryAria: { zh: "后台管理边界", en: "Admin Console boundary" },
  topbar: { title: { zh: "后台管理", en: "Admin Console" }, lead: { zh: "内部治理、执行状态、证据、设备、技能、验收、健康与审计边界。", en: "Internal governance, execution state, evidence, devices, skills, acceptance, health, and audit boundaries." } },
  nav: {
    dashboard: { label: { zh: "总览", en: "Dashboard" } },
    fields: { label: { zh: "地块", en: "Fields" } },
    operations: { label: { zh: "作业", en: "Operations" } },
    devices: { label: { zh: "设备", en: "Devices" } },
    evidence: { label: { zh: "证据", en: "Evidence" } },
    health: { label: { zh: "运行健康", en: "Runtime Health" } },
    config: { label: { zh: "配置", en: "Config" } },
  },
  meta: {
    internalGovernanceSurface: { zh: "内部治理界面", en: "Internal governance surface" },
    readOnlyShellBoundary: { zh: "只读 Shell 边界", en: "Read-only shell boundary" },
    formalNavigation: { zh: "正式导航", en: "Formal navigation" },
    adminRoutesOnly: { zh: "仅后台管理路由", en: "Admin routes only" },
    routeFamily: { zh: "路由族", en: "Route family" },
    surfaceMode: { zh: "界面模式", en: "Surface mode" },
    governedReadback: { zh: "治理回查", en: "Governed readback" },
    footerNote: { zh: "诊断与兼容 URL 保持 URL-only，直到单独产品化。", en: "Diagnostic and compatibility URLs stay URL-only until separately productized." },
    boundaryText: { zh: "内部治理界面。只读 Shell 边界。该 Shell 不创建 facts，不打开受控执行，不写入价值记录，也不写入长期地块记录。", en: "Internal governance surface. Read-only shell boundary. This shell does not create facts, open controlled execution, write value records, or write long-term field records." },
  },
} as const;

export const OPERATOR_FORMAL_SURFACE_COPY = {
  runtimeOverview: {
    eyebrow: { zh: "操作员孪生工作台", en: "Operator Twin Workbench" },
    title: { zh: "运行总览", en: "Runtime Overview" },
    hero: { zh: "以只读方式审查运行状态、证据覆盖、回放支撑边界与地块入口。", en: "Review runtime status, evidence coverage, replay-backed boundary, and field entry points in read-only mode." },
    boundary: { zh: "只读运行审查；不运行预测、不提交建议、不审批、不执行。", en: "Read-only runtime review; no forecast run, recommendation submission, approval, or execution." },
    pills: {
      apiBacked: { zh: "API 支撑", en: "API-backed" },
      scopedRead: { zh: "范围化只读", en: "Scoped read" },
      noExecution: { zh: "不直接执行", en: "No direct execution" },
    },
    loading: { zh: "运行总览正在加载。", en: "Runtime Overview is loading." },
    error: { zh: "运行总览暂不可用", en: "Runtime Overview unavailable" },
    empty: { zh: "暂无可展示地块运行数据。请确认 URL 中的 tenant_id / project_id / group_id。", en: "No field runtime data is available. Confirm tenant_id / project_id / group_id in the URL." },
    sections: {
      sourceIndexInventory: { zh: "源索引清单", en: "Source Index Inventory" },
      scopePolicy: { zh: "范围策略", en: "Scope Policy" },
      fieldMatrix: { zh: "地块状态矩阵", en: "Field Status Matrix" },
      dataGaps: { zh: "数据缺口", en: "Data Gaps" },
      humanBoundary: { zh: "人工确认边界", en: "Human Confirmation Boundary" },
    },
    table: {
      field: { zh: "地块", en: "Field" },
      currentState: { zh: "当前状态", en: "Current state" },
      risk: { zh: "风险", en: "Risk" },
      confidence: { zh: "置信度", en: "Confidence" },
      lowConfidence: { zh: "低置信", en: "Low confidence" },
      dataCoverage: { zh: "数据覆盖", en: "Data coverage" },
      forecastWindow: { zh: "预测窗口", en: "Forecast window" },
      entry: { zh: "入口", en: "Entry" },
      openFieldRuntime: { zh: "进入地块运行视图", en: "Open Field Runtime" },
    },
  },
  fieldRuntime: {
    eyebrow: { zh: "地块运行视图", en: "Field Runtime" },
    title: { zh: "地块运行视图", en: "Field Runtime" },
    subtitle: { zh: "地块级只读运行审查界面。", en: "Field-scoped read-only runtime review surface." },
    meta: {
      fieldId: { zh: "地块 ID", en: "Field ID" },
      currentRoute: { zh: "当前路由", en: "Current route" },
      runtimeMode: { zh: "运行模式", en: "Runtime Mode" },
      readOnlyBoundary: { zh: "只读边界", en: "Read-only boundary" },
    },
    tabs: {
      fields: { zh: "地块", en: "Fields" },
      overview: { zh: "总览", en: "Overview" },
      evidence: { zh: "证据", en: "Evidence" },
      state: { zh: "状态", en: "State" },
      forecast: { zh: "预测", en: "Forecast" },
      scenario: { zh: "情景", en: "Scenario" },
      residual: { zh: "残差", en: "Residual" },
      calibration: { zh: "校准", en: "Calibration" },
      health: { zh: "健康", en: "Health" },
      audit: { zh: "审计", en: "Audit" },
    },
    status: {
      available: { zh: "可用", en: "available" },
      limited: { zh: "受限", en: "limited" },
      not_enabled: { zh: "未启用", en: "not enabled" },
      selectFieldFirst: { zh: "请先选择地块", en: "select field first" },
    },
    nonclaims: [
      { zh: "运行模式：回放支撑演示", en: "Runtime Mode: Replay-backed Demo" },
      { zh: "实时设备：未连接", en: "Live Device: Not connected" },
      { zh: "生产网关：未上线", en: "Production Gateway: Not online" },
      { zh: "田间试点：未开始", en: "Field Pilot: Not started" },
      { zh: "受控执行：已禁用", en: "Controlled Execution: Disabled" },
    ],
    boundary: [
      { zh: "只读", en: "Read-only" },
      { zh: "不修改运行状态", en: "No runtime mutation" },
      { zh: "不下发外部命令", en: "No external command" },
      { zh: "不修改模型状态", en: "No model state mutation" },
      { zh: "不写入价值台账", en: "No value ledger mutation" },
      { zh: "不写入长期地块记录", en: "No long-term field record mutation" },
    ],
    routeOwnership: { zh: "路由归属", en: "Route ownership" },
    tabPanel: { zh: "地块运行标签面板", en: "Field Runtime tab panel" },
  },
  replayDemo: {
    eyebrow: { zh: "回放支撑演示", en: "Replay-backed demo" },
    title: { zh: "回放支撑网关演示", en: "Replay-backed Gateway Demo" },
    snapshotTitle: { zh: "回放支撑网关快照", en: "Replay-backed Gateway Snapshot" },
    heroLead: { zh: "该页面渲染签入仓库的网关路径快照，展示设备证据如何被映射、去重、限定时间窗口并保持可追溯。", en: "This page renders a checked-in gateway-path snapshot and shows how device evidence is mapped, deduplicated, time-bounded, and traceable." },
    nonclaimLead: { zh: "这是回放支撑演示，不是实时设备连接，不是生产网关在线，不是实时运行监控，也不是田间试点执行或 AO-ACT 派发界面。", en: "This is a replay-backed demo, not a live device connection, not production gateway online, not live runtime monitoring, and not field pilot execution or AO-ACT dispatch." },
    loading: { zh: "正在加载签入快照。", en: "Loading checked-in snapshot." },
    unavailable: { zh: "快照暂不可用", en: "Snapshot unavailable" },
    staticRequired: { zh: "回放支撑演示需要静态签入快照。", en: "Static checked-in snapshot is required for this replay-backed demo." },
    nonclaims: [
      { zh: "回放支撑演示", en: "Replay-backed demo" },
      { zh: "不是实时设备连接", en: "not a live device connection" },
      { zh: "生产网关：未上线", en: "Production Gateway: Not online" },
      { zh: "未启用实时运行监控", en: "live runtime monitoring disabled" },
      { zh: "田间试点：未开始", en: "Field Pilot: Not started" },
      { zh: "AO-ACT 派发：已禁用", en: "AO-ACT Dispatch: Disabled" },
    ],
    panels: {
      snapshot: { zh: "快照", en: "Snapshot" },
      gatewayPath: { zh: "网关路径", en: "Gateway path" },
      deviceEvidence: { zh: "设备证据", en: "Device evidence" },
      standardsMapping: { zh: "标准映射", en: "Standards mapping" },
      traceability: { zh: "可追溯性", en: "Traceability" },
    },
    table: {
      label: { zh: "标签", en: "Label" },
      value: { zh: "值", en: "Value" },
      metadata: { zh: "元数据", en: "Metadata" },
      status: { zh: "状态", en: "Status" },
    },
  },
  pilotReadiness: {
    eyebrow: { zh: "试点准备度", en: "Pilot Readiness" },
    title: { zh: "试点准备度", en: "Pilot Readiness" },
    lead: { zh: "用于规划门禁与准备度门禁的只读审查界面。", en: "Read-only review surface for planning gate and readiness gate." },
    panelsAria: { zh: "试点准备度面板", en: "Pilot Readiness panels" },
    table: { label: { zh: "标签", en: "Label" }, value: { zh: "值", en: "Value" } },
    panels: {
      planningGate: { zh: "规划门禁", en: "planning gate" },
      readinessGate: { zh: "准备度门禁", en: "readiness gate" },
      candidateSite: { zh: "候选地块范围", en: "Candidate Site Scope" },
      evidenceProtocol: { zh: "证据协议", en: "Evidence Protocol" },
      deviceGateway: { zh: "设备 / 网关准备计划", en: "Device / Gateway Readiness Plan" },
      humanRole: { zh: "人员角色", en: "human role" },
      safetyStopRules: { zh: "安全 / 停止规则", en: "safety / stop rules" },
      rollback: { zh: "回滚", en: "rollback" },
      readinessStatus: { zh: "准备度状态", en: "Readiness Status" },
      capabilityMatrix: { zh: "能力矩阵", en: "Capability Matrix" },
      traceability: { zh: "可追溯性", en: "Traceability" },
      boundaryNonclaims: { zh: "边界 / 否定声明", en: "Boundary / Nonclaims" },
      nextAllowedGate: { zh: "下一允许门禁", en: "Next Allowed Gate" },
    },
    nonclaims: [
      { zh: "试点未开始", en: "Field Pilot: Not started" },
      { zh: "不是田间执行", en: "not field execution" },
      { zh: "不声明真实设备已部署", en: "real devices are not claimed deployed" },
      { zh: "未创建 AO-ACT 任务", en: "AO-ACT task is not created" },
      { zh: "AO-ACT 派发：已禁用", en: "AO-ACT Dispatch: Disabled" },
      { zh: "未计算 ROI", en: "ROI is not computed" },
      { zh: "未写入 Field Memory", en: "Field Memory is not learned" },
    ],
  },
} as const;
