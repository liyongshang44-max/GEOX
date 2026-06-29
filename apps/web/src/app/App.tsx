import React from "react";
import { Navigate, Route, Routes, generatePath, useLocation, useParams } from "react-router-dom";
import { useSession } from "../auth/useSession";
import { readExpertModeFromStorage } from "../lib/uiPrefs";
import { LocaleProvider } from "../lib/locale";
import AppShell from "./AppShell";
import AdminLayout from "../layouts/AdminLayout";
import CustomerLayout from "../layouts/CustomerLayout";
import OperatorLayout from "../layouts/OperatorLayout";
import RequireSession from "./RequireSession";
import { type AppBreadcrumbItem } from "../components/layout/AppBreadcrumb";
import { renderDashboardRoutes } from "./routes/dashboardRoutes";
import { renderAdminFieldsRoutes, renderCustomerFieldsRoutes } from "./routes/fieldsRoutes";
import { renderDevicesRoutes } from "./routes/devicesRoutes";
import { renderOperationsRoutes } from "./routes/operationsRoutes";
import { renderCustomerOperationsRoutes } from "./routes/customerOperationsRoutes";
import { renderProgramsRoutes } from "./routes/programsRoutes";
import { renderEvidenceRoutes } from "./routes/evidenceRoutes";
import { renderSkillsRoutes } from "./routes/skillsRoutes";
import { trackMainActionClick, usePageEnterEvent } from "../shared/telemetry/pageEvents";
import { fetchAuthMe } from "../api/auth";

const JudgeRunPage = React.lazy(() => import("../views/JudgeRunPage"));
const JudgeRecordsPage = React.lazy(() => import("../views/JudgeRecordsPage"));
const JudgeConfigPage = React.lazy(() => import("../views/JudgeConfigPage"));
const SimConfigPage = React.lazy(() => import("../views/SimConfigPage"));
const AdminHealthPage = React.lazy(() => import("../features/admin/pages/AdminHealthPage"));
const AdminImportPage = React.lazy(() => import("../features/admin/pages/AdminImportPage"));
const LegacyAdminAcceptancePage = React.lazy(() => import("../views/AdminAcceptancePage"));
const ApprovalRequestsPage = React.lazy(() => import("../views/ApprovalRequestsPage"));
const DevToolsPage = React.lazy(() => import("../views/DevToolsPage"));
const SettingsPage = React.lazy(() => import("../views/SettingsPage"));
const LoginPage = React.lazy(() => import("../views/LoginPage"));

const AdminControlPlaneDashboardPage = React.lazy(() => import("../features/admin/pages/AdminDashboardPage"));
const AdminFieldsPage = React.lazy(() => import("../features/admin/pages/AdminFieldsPage"));
const AdminOperationsPage = React.lazy(() => import("../features/admin/pages/AdminOperationsPage"));
const AdminDevicesPage = React.lazy(() => import("../features/admin/pages/AdminDevicesPage"));
const AdminAlertsPage = React.lazy(() => import("../features/admin/pages/AdminAlertsPage"));
const AdminEvidencePage = React.lazy(() => import("../features/admin/pages/AdminEvidencePage"));
const AdminSkillsPage = React.lazy(() => import("../features/admin/pages/AdminSkillsPage"));
const AdminControlPlaneAcceptancePage = React.lazy(() => import("../features/admin/pages/AdminControlPlaneAcceptancePage"));
const AdminHealthzPage = React.lazy(() => import("../features/admin/pages/AdminHealthzPage"));
const CommercialDashboardPage = React.lazy(() => import("../features/dashboard/pages/CommercialDashboardPage"));
const FieldsPage = React.lazy(() => import("../features/fields/pages/FieldsPage"));
const DevicesPage = React.lazy(() => import("../features/devices/pages/DevicesPage"));
const OperationsPage = React.lazy(() => import("../features/operations/pages/OperationsPage"));
const AlertsPage = React.lazy(() => import("../features/operations/pages/AlertsPage"));
const EvidenceCenterPage = React.lazy(() => import("../features/evidence/pages/EvidenceCenterPage"));
const SkillRegistryPage = React.lazy(() => import("../features/skills/pages/SkillRegistryPage"));
const AdminOperationDebugPage = React.lazy(() => import("../features/dashboard/pages/AdminOperationDebugPage"));
const CustomerDashboardPage = React.lazy(() => import("../features/customer/pages/CustomerDashboardPage"));
const CustomerDashboardExportPage = React.lazy(() => import("../features/customer/pages/CustomerDashboardExportPage"));
const CustomerFieldsIndexPage = React.lazy(() => import("../features/customer/pages/CustomerFieldsIndexPage"));
const CustomerOperationsIndexPage = React.lazy(() => import("../features/customer/pages/CustomerOperationsIndexPage"));
const CustomerReportsCenterPage = React.lazy(() => import("../features/customer/pages/CustomerReportsCenterPage"));
const FieldReportPage = React.lazy(() => import("../features/fields/pages/FieldReportPage"));
const FieldReportExportPage = React.lazy(() => import("../features/fields/pages/FieldReportExportPage"));
const OperationReportPage = React.lazy(() => import("../features/operations/pages/OperationReportPage"));
const CustomerReportExportPage = React.lazy(() => import("../features/customer/pages/CustomerReportExportPage"));
const OperatorTwinOverviewPage = React.lazy(() => import("../features/operator/pages/OperatorTwinOverviewPage"));
const OperatorProductionWorkflowPage = React.lazy(() => import("../features/operator/pages/OperatorProductionWorkflowPage"));
const OperatorFieldTwinWorkspacePage = React.lazy(() => import("../features/operator/pages/OperatorFieldTwinWorkspacePage"));
const OperatorFieldTwinForecastPage = React.lazy(() => import("../features/operator/pages/OperatorFieldTwinForecastPage"));
const OperatorFieldTwinScenarioComparePage = React.lazy(() => import("../features/operator/pages/OperatorFieldTwinScenarioComparePage"));
const OperatorFieldTwinEvidencePage = React.lazy(() => import("../features/operator/pages/OperatorFieldTwinEvidencePage"));
const OperatorFieldTwinCalibrationPage = React.lazy(() => import("../features/operator/pages/OperatorFieldTwinCalibrationPage"));
const OperatorFieldTwinPostIrrigationPage = React.lazy(() => import("../features/operator/pages/OperatorFieldTwinPostIrrigationPage"));
const OperatorTwinTraceReadbackPage = React.lazy(() => import("../features/operator/pages/OperatorTwinTraceReadbackPage"));

const RouteFallback = <div className="card" style={{ padding: 16 }}>页面加载中...</div>;

function isCustomerRoute(pathname: string): boolean {
  return pathname.startsWith("/customer/");
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

function LegacyParamRedirect({ to }: { to: string }): React.ReactElement {
  const params = useParams();
  return <Navigate to={generatePath(to, params)} replace />;
}

function titleForPath(pathname: string): string {
  if (pathname === "/" || pathname === "/dashboard") return "平台控制台";
  if (pathname === "/dashboard/customer") return "客户看板";
  if (pathname === "/dashboard/export" || pathname === "/customer/export") return "客户看板导出";
  if (pathname.startsWith("/delivery/export-jobs")) return "导出报告";
  if (pathname === "/fields") return "田块";
  if (pathname === "/fields/new") return "新建田块";
  if (pathname.startsWith("/fields/") && pathname.endsWith("/report/export")) return "地块报告导出";
  if (pathname.startsWith("/fields/") && pathname.endsWith("/report")) return "地块报告";
  if (pathname.startsWith("/fields/")) return "田块详情";
  if (pathname === "/devices") return "设备";
  if (pathname === "/devices/onboarding") return "设备接入向导";
  if (pathname.startsWith("/devices/")) return "设备详情";
  if (pathname.startsWith("/operations/") && pathname.endsWith("/report/export")) return "作业报告导出";
  if (pathname.startsWith("/operations/") && pathname.endsWith("/report")) return "作业报告";
  if (pathname.startsWith("/operations/workboard")) return "内部运营作业台";
  if (pathname.startsWith("/operations/")) return "作业详情";
  if (pathname.startsWith("/operations")) return "作业";
  if (pathname.startsWith("/human-assignments/")) return "人工执行详情";
  if (pathname.startsWith("/human-assignments")) return "人工执行";
  if (pathname.startsWith("/dispatch-workbench")) return "派单调度台";
  if (pathname.startsWith("/human-execution-analysis")) return "人工执行分析";
  if (pathname.startsWith("/human-ops-analytics")) return "人工作业分析";
  if (pathname === "/programs") return "经营方案";
  if (pathname === "/programs/create") return "初始化经营";
  if (pathname === "/programs/new") return "新建经营方案";
  if (pathname.startsWith("/programs/")) return "经营方案详情";
  if (pathname.startsWith("/agronomy/recommendations")) return "农业建议";
  if (pathname.startsWith("/alerts")) return "内部告警中心";
  if (pathname.startsWith("/audit-export")) return "证据中心";
  if (pathname.startsWith("/skills/registry")) return "技能注册中心";
  if (pathname.startsWith("/skills/bindings")) return "技能绑定";
  if (pathname.startsWith("/skills/runs")) return "技能运行";
  if (pathname.startsWith("/settings")) return "系统设置";
  if (pathname.startsWith("/dev")) return "研发工具";
  return "GEOX 控制台";
}

function leadForPath(pathname: string): string {
  if (pathname === "/" || pathname === "/dashboard") return "以平台控制台为主入口，统一监控田块、设备、作业、技能与证据状态。";
  if (pathname === "/dashboard/customer") return "面向客户的简化看板，仅展示4个关键区块。";
  if (pathname === "/dashboard/export" || pathname === "/customer/export") return "客户看板导出版，保留地块状态、经营汇总、待处理事项、Top 风险地块与近期动作。";
  if (pathname.startsWith("/delivery/export-jobs")) return "作为证据中心下的二级模块，集中查看导出批次与回执状态。";
  if (pathname === "/fields") return "围绕田块、边界、季节与设备绑定进行管理。";
  if (pathname === "/fields/new") return "创建田块并开始开局链路。";
  if (pathname.startsWith("/fields/") && pathname.endsWith("/report/export")) return "地块报告导出版，聚焦只读信息展示。";
  if (pathname.startsWith("/fields/") && pathname.endsWith("/report")) return "查看地块作业报告及风险、成本汇总。";
  if (pathname.startsWith("/fields/")) return "查看单个田块的边界、季节与绑定设备摘要。";
  if (pathname === "/devices") return "集中查看设备状态、最新遥测与田块绑定关系。";
  if (pathname === "/devices/onboarding") return "从注册到首条 telemetry 上传的标准接入流程。";
  if (pathname.startsWith("/devices/")) return "查看单个设备的状态、最新遥测和最小趋势。";
  if (pathname.startsWith("/operations/") && pathname.endsWith("/report/export")) return "作业报告导出版，保留六段叙事并隐藏内部调试信息。";
  if (pathname.startsWith("/operations/") && pathname.endsWith("/report")) return "查看作业报告固定区块：摘要、执行、验收、证据、成本、SLA 与风险。";
  if (pathname.startsWith("/operations/workboard")) return "内部运营页，用于处理作业分派、跟进和关闭，不属于客户主流程。";
  if (pathname.startsWith("/operations/")) return "查看作业状态、执行时间线与最新执行证据。";
  if (pathname.startsWith("/operations")) return "聚焦待执行与长时间未推进动作，支持快速追溯经营方案。";
  if (pathname.startsWith("/human-assignments/")) return "查看任务详情并提交人工执行回执。";
  if (pathname.startsWith("/human-assignments")) return "作为作业下的二级入口，按状态处理人工任务，完成接单、执行与提交。";
  if (pathname.startsWith("/dispatch-workbench")) return "按地块/时间窗/技能筛选未分配任务，并基于执行人资质进行派单。";
  if (pathname.startsWith("/human-execution-analysis")) return "按班组/人员查看人工执行质量指标，追踪逾期与回执缺失告警。";
  if (pathname.startsWith("/human-ops-analytics")) return "查看人工执行 KPI、执行排行与异常聚类，并支持钻取任务复盘。";
  if (pathname === "/programs") return "按状态和风险筛选经营方案，快速判断优先级并进入详情。";
  if (pathname === "/programs/create") return "通过模板快速初始化经营方案。";
  if (pathname === "/programs/new") return "创建新的经营方案，补齐 field/season/crop 上下文。";
  if (pathname.startsWith("/programs/")) return "查看经营方案的决策链、执行链、证据链与资源结果。";
  if (pathname.startsWith("/agronomy/recommendations")) return "作为经营方案下的二级入口，查看农业建议、证据引用与审批前状态。";
  if (pathname.startsWith("/alerts")) return "内部运营页，用于管理告警规则、事件和关闭动作，不属于客户主流程。";
  if (pathname.startsWith("/audit-export")) return "统一管理证据导出、回执追踪与完整性校验。";
  if (pathname.startsWith("/skills/registry")) return "集中管理技能状态、版本和覆盖范围。";
  if (pathname.startsWith("/skills/bindings")) return "查看技能绑定策略、作用域与优先级。";
  if (pathname.startsWith("/skills/runs")) return "按运行记录追踪技能执行结果与诊断信息。";
  if (pathname.startsWith("/settings")) return "查看当前会话、角色、令牌与最小门禁约束。";
  if (pathname.startsWith("/dev")) return "保留旧调试页作为 fallback，不参与商业演示主流程。";
  return "中文商业控制台外壳已建立，后续页面按产品信息架构持续收口。";
}

type BreadcrumbItem = AppBreadcrumbItem;
function breadcrumbsForPath(pathname: string): BreadcrumbItem[] {
  if (pathname === "/" || pathname === "/dashboard") return [{ label: "平台控制台" }];
  if (pathname === "/dashboard/customer") return [{ label: "平台控制台", to: "/dashboard" }, { label: "客户看板" }];
  if (pathname === "/dashboard/export" || pathname === "/customer/export") return [{ label: "平台控制台", to: "/dashboard" }, { label: "客户看板导出" }];
  if (pathname.startsWith("/delivery/export-jobs")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "证据中心", to: "/audit-export" }, { label: "导出报告" }];
  if (pathname === "/fields") return [{ label: "平台控制台", to: "/dashboard" }, { label: "田块" }];
  if (pathname === "/fields/new") return [{ label: "平台控制台", to: "/dashboard" }, { label: "田块", to: "/fields" }, { label: "新建田块" }];
  if (pathname.startsWith("/fields/") && pathname.endsWith("/report/export")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "田块", to: "/fields" }, { label: "地块报告导出" }];
  if (pathname.startsWith("/fields/") && pathname.endsWith("/report")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "田块", to: "/fields" }, { label: "地块报告" }];
  if (pathname.startsWith("/fields/")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "田块", to: "/fields" }, { label: "田块详情" }];
  if (pathname === "/devices") return [{ label: "平台控制台", to: "/dashboard" }, { label: "设备" }];
  if (pathname === "/devices/onboarding") return [{ label: "平台控制台", to: "/dashboard" }, { label: "设备", to: "/devices" }, { label: "设备接入向导" }];
  if (pathname.startsWith("/devices/")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "设备", to: "/devices" }, { label: "设备详情" }];
  if (pathname.startsWith("/operations/") && pathname.endsWith("/report/export")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "作业", to: "/operations" }, { label: "作业报告导出" }];
  if (pathname.startsWith("/operations/") && pathname.endsWith("/report")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "作业", to: "/operations" }, { label: "作业报告" }];
  if (pathname.startsWith("/operations/workboard")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "作业", to: "/operations" }, { label: "运营作业台" }];
  if (pathname.startsWith("/operations/")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "作业", to: "/operations" }, { label: "作业详情" }];
  if (pathname.startsWith("/operations")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "作业" }];
  if (pathname.startsWith("/human-assignments/")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "作业", to: "/operations" }, { label: "人工执行", to: "/human-assignments" }, { label: "任务详情" }];
  if (pathname.startsWith("/human-assignments")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "作业", to: "/operations" }, { label: "人工执行" }];
  if (pathname.startsWith("/dispatch-workbench")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "作业", to: "/operations" }, { label: "派单调度台" }];
  if (pathname.startsWith("/human-execution-analysis")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "作业", to: "/operations" }, { label: "人工执行分析" }];
  if (pathname.startsWith("/human-ops-analytics")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "作业", to: "/operations" }, { label: "人工作业分析" }];
  if (pathname === "/programs") return [{ label: "平台控制台", to: "/dashboard" }, { label: "经营方案" }];
  if (pathname === "/programs/create") return [{ label: "平台控制台", to: "/dashboard" }, { label: "经营方案", to: "/programs" }, { label: "初始化经营" }];
  if (pathname === "/programs/new") return [{ label: "平台控制台", to: "/dashboard" }, { label: "经营方案", to: "/programs" }, { label: "新建" }];
  if (pathname.startsWith("/programs/")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "经营方案", to: "/programs" }, { label: "经营方案详情" }];
  if (pathname.startsWith("/agronomy/recommendations")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "经营方案", to: "/programs" }, { label: "农业建议" }];
  if (pathname.startsWith("/alerts")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "作业", to: "/operations" }, { label: "告警中心" }];
  if (pathname.startsWith("/audit-export")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "证据中心" }];
  if (pathname.startsWith("/skills/registry")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "技能注册中心" }];
  if (pathname.startsWith("/skills/bindings")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "技能注册中心", to: "/skills/registry" }, { label: "技能绑定" }];
  if (pathname.startsWith("/skills/runs")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "技能注册中心", to: "/skills/registry" }, { label: "技能运行" }];
  if (pathname.startsWith("/settings")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "系统设置" }];
  if (pathname.startsWith("/dev")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "研发工具" }];
  return [{ label: "平台控制台", to: "/dashboard" }, { label: "控制台" }];
}

function primaryActionForPath(pathname: string): { label: string; to: string } {
  if (pathname === "/" || pathname === "/dashboard") return { label: "新建田块", to: "/fields/new" };
  if (pathname.startsWith("/fields/") && pathname.endsWith("/report/export")) return { label: "返回地块报告", to: pathname.replace(/\/export$/, "") };
  if (pathname.startsWith("/fields/") && pathname.endsWith("/report")) return { label: "返回田块详情", to: pathname.replace(/\/report$/, "") };
  if (pathname.startsWith("/fields/")) return { label: "返回田块列表", to: "/fields" };
  if (pathname.startsWith("/fields")) return { label: "新建田块", to: "/fields/new" };
  if (pathname.startsWith("/devices/") && pathname !== "/devices/onboarding") return { label: "返回设备列表", to: "/devices" };
  if (pathname.startsWith("/devices")) return { label: "接入设备", to: "/devices/onboarding" };
  if (pathname.startsWith("/operations/") && pathname.endsWith("/report/export")) return { label: "返回作业报告", to: pathname.replace(/\/export$/, "") };
  if (pathname.startsWith("/operations/") && pathname.endsWith("/report")) return { label: "返回作业详情", to: pathname.replace(/\/report$/, "") };
  if (pathname.startsWith("/operations/workboard")) return { label: "返回作业列表", to: "/operations" };
  if (pathname.startsWith("/operations/")) return { label: "返回作业列表", to: "/operations" };
  if (pathname.startsWith("/operations")) return { label: "查看人工执行", to: "/human-assignments" };
  if (pathname.startsWith("/human-assignments/")) return { label: "返回人工执行列表", to: "/human-assignments" };
  if (pathname.startsWith("/human-assignments")) return { label: "返回作业列表", to: "/operations" };
  if (pathname.startsWith("/dispatch-workbench")) return { label: "返回人工执行列表", to: "/human-assignments" };
  if (pathname.startsWith("/human-execution-analysis")) return { label: "返回人工执行列表", to: "/human-assignments" };
  if (pathname.startsWith("/human-ops-analytics")) return { label: "返回人工执行列表", to: "/human-assignments" };
  if (pathname === "/dashboard/export" || pathname === "/customer/export") return { label: "返回客户看板", to: "/customer/dashboard" };
  if (pathname.startsWith("/agronomy/recommendations")) return { label: "返回经营方案列表", to: "/programs" };
  if (pathname === "/programs/create" || pathname === "/programs/new" || pathname.startsWith("/programs/")) return { label: "返回经营方案列表", to: "/programs" };
  if (pathname.startsWith("/programs")) return { label: "初始化经营", to: "/programs/create" };
  if (pathname.startsWith("/delivery/export-jobs")) return { label: "返回证据中心", to: "/audit-export" };
  if (pathname.startsWith("/audit-export")) return { label: "查看导出报告", to: "/delivery/export-jobs" };
  if (pathname.startsWith("/skills/runs/")) return { label: "返回技能注册中心", to: "/skills/registry" };
  if (pathname.startsWith("/skills")) return { label: "查看技能注册中心", to: "/skills/registry" };
  return { label: "返回总览", to: "/dashboard" };
}

function Shell({ expert }: { expert: boolean }): React.ReactElement {
  const location = useLocation();
  const pathname = location.pathname;
  const primaryAction = primaryActionForPath(pathname);

  usePageEnterEvent();

  return (
    <AppShell
      topBar={{
        breadcrumbs: breadcrumbsForPath(pathname),
        title: titleForPath(pathname),
        lead: leadForPath(pathname),
        primaryAction,
        onPrimaryActionClick: () => trackMainActionClick(pathname, primaryAction.label),
      }}
    >
      <React.Suspense fallback={RouteFallback}>
        <AppRoutes expert={expert} />
      </React.Suspense>
    </AppShell>
  );
}

function AppRoutes({ expert }: { expert: boolean }): React.ReactElement {
  return (
    <Routes>
          <Route path="/" element={<Navigate to="/customer/dashboard" replace />} />
          <Route path="/dashboard" element={<Navigate to="/customer/dashboard" replace />} />
          <Route path="/dashboard/customer" element={<Navigate to="/customer/dashboard" replace />} />
          <Route path="/dashboard/export" element={<Navigate to="/customer/export" replace />} />
          <Route path="/operator/*" element={<OperatorShell />} />
          <Route path="/fields/:fieldId/report" element={<LegacyParamRedirect to="/customer/fields/:fieldId" />} />
          <Route path="/fields/:fieldId/report/export" element={<LegacyParamRedirect to="/customer/fields/:fieldId/export" />} />
          <Route path="/operations/:operationId/report" element={<LegacyParamRedirect to="/customer/operations/:operationId" />} />
          <Route path="/operations/:operationId/report/export" element={<LegacyParamRedirect to="/customer/operations/:operationId/export" />} />
          <Route path="/fields" element={<Navigate to="/admin/fields" replace />} />
          <Route path="/fields/portfolio" element={<Navigate to="/admin/fields/portfolio" replace />} />
          <Route path="/fields/:fieldId" element={<LegacyParamRedirect to="/admin/fields/:fieldId" />} />
          <Route path="/devices" element={<Navigate to="/admin/devices" replace />} />
          <Route path="/operations" element={<Navigate to="/admin/operations" replace />} />
          <Route path="/operations/workboard" element={<Navigate to="/admin/operations/workboard" replace />} />
          <Route path="/alerts" element={<Navigate to="/admin/alerts" replace />} />
          <Route path="/audit-export" element={<Navigate to="/admin/evidence" replace />} />
          <Route path="/skills/registry" element={<Navigate to="/admin/skills" replace />} />
          {renderDashboardRoutes(expert)}
          {renderEvidenceRoutes()}
          {renderCustomerFieldsRoutes()}
          {renderDevicesRoutes()}
          {renderOperationsRoutes()}
          {renderCustomerOperationsRoutes()}
          {renderProgramsRoutes()}
          {renderSkillsRoutes()}

          <Route path="/legacy/settings" element={<SettingsPage />} />
          <Route path="/legacy/dev" element={<DevToolsPage />} />
          <Route path="/legacy/judge/run" element={<JudgeRunPage />} />
          <Route path="/legacy/judge/records" element={<JudgeRecordsPage />} />
          <Route path="/legacy/judge/config" element={<JudgeConfigPage />} />
          <Route path="/legacy/sim/config" element={<SimConfigPage />} />
          <Route path="/legacy/admin/healthz" element={<AdminHealthPage />} />
          <Route path="/legacy/admin/import" element={<AdminImportPage />} />
          <Route path="/legacy/admin/acceptance" element={<LegacyAdminAcceptancePage />} />
          <Route path="/legacy/control/approvals" element={<ApprovalRequestsPage />} />
          <Route path="/judge/run" element={<Navigate to="/legacy/judge/run" replace />} />
          <Route path="/judge/records" element={<Navigate to="/legacy/judge/records" replace />} />
          <Route path="/judge/config" element={<Navigate to="/legacy/judge/config" replace />} />
          <Route path="/sim/config" element={<Navigate to="/legacy/sim/config" replace />} />
          <Route path="/admin/healthz" element={<Navigate to="/legacy/admin/healthz" replace />} />
          <Route path="/admin/import" element={<Navigate to="/legacy/admin/import" replace />} />
          <Route path="/admin/acceptance" element={<Navigate to="/legacy/admin/acceptance" replace />} />
          <Route path="/admin/operations/:operationId/debug" element={<Navigate to="/legacy/dev" replace />} />
          <Route path="/control/approvals" element={<Navigate to="/legacy/control/approvals" replace />} />
          <Route path="/settings" element={<Navigate to="/legacy/settings" replace />} />
          <Route path="/dev" element={<Navigate to="/legacy/dev" replace />} />
        </Routes>
  );
}

function CustomerRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<CustomerDashboardPage />} />
      <Route path="export" element={<CustomerDashboardExportPage />} />
      <Route path="fields" element={<CustomerFieldsIndexPage />} />
      <Route path="fields/:fieldId" element={<FieldReportPage />} />
      <Route path="fields/:fieldId/export" element={<FieldReportExportPage />} />
      <Route path="operations" element={<CustomerOperationsIndexPage />} />
      <Route path="operations/:operationId" element={<OperationReportPage />} />
      <Route path="reports" element={<CustomerReportsCenterPage />} />
      <Route path="operations/:operationId/export" element={<CustomerReportExportPage />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}

function CustomerShell(): React.ReactElement {
  return (
    <CustomerLayout>
      <React.Suspense fallback={RouteFallback}>
        <CustomerRoutes />
      </React.Suspense>
    </CustomerLayout>
  );
}


function OperatorRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="twin" replace />} />
      <Route path="twin" element={<OperatorTwinOverviewPage />} />
      <Route path="twin/production-workflow" element={<OperatorProductionWorkflowPage />} />
      <Route path="twin/fields/:fieldId" element={<OperatorFieldTwinWorkspacePage />} />
      <Route path="twin/fields/:fieldId/forecast" element={<OperatorFieldTwinForecastPage />} />
      <Route path="twin/fields/:fieldId/scenarios" element={<OperatorFieldTwinScenarioComparePage />} />
      <Route path="twin/fields/:fieldId/evidence" element={<OperatorFieldTwinEvidencePage />} />
      <Route path="twin/fields/:fieldId/calibration" element={<OperatorFieldTwinCalibrationPage />} />
      <Route path="twin/fields/:fieldId/post-irrigation" element={<OperatorFieldTwinPostIrrigationPage />} />
      <Route path="twin/traces/:decisionCycleId" element={<OperatorTwinTraceReadbackPage />} />
      <Route path="*" element={<Navigate to="twin" replace />} />
    </Routes>
  );
}

function OperatorShell(): React.ReactElement {
  return (
    <OperatorLayout>
      <React.Suspense fallback={RouteFallback}>
        <OperatorRoutes />
      </React.Suspense>
    </OperatorLayout>
  );
}

function AdminShell(): React.ReactElement {
  return (
    <AdminLayout
      topBar={{
        breadcrumbs: [{ label: "平台控制台", to: "/dashboard" }, { label: "后台管理" }],
        title: "后台管理",
        lead: "Admin Control Plane：内部治理、执行状态、证据、设备、技能、验收、健康与审计边界。",
        primaryAction: { label: "查看客户门户（外部跳转）", to: "/customer/dashboard" },
      }}
    >
      <React.Suspense fallback={RouteFallback}>
        <Routes>
          <Route path="/" element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminControlPlaneDashboardPage />} />
          <Route path="fields" element={<AdminFieldsPage />} />
          <Route path="operations" element={<AdminOperationsPage />} />
          <Route path="devices" element={<AdminDevicesPage />} />
          <Route path="alerts" element={<AdminAlertsPage />} />
          <Route path="evidence" element={<AdminEvidencePage />} />
          <Route path="skills" element={<AdminSkillsPage />} />
          <Route path="acceptance" element={<AdminControlPlaneAcceptancePage />} />
          <Route path="healthz" element={<AdminHealthzPage />} />
          <Route path="import" element={<Navigate to="dashboard" replace />} />
          <Route path="operations/:operationId/debug" element={<Navigate to="operations" replace />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </React.Suspense>
    </AdminLayout>
  );
}

export default function App(): React.ReactElement {
  const [expert] = React.useState<boolean>(() => readExpertModeFromStorage());
  const { isLoggedIn } = useSession();
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <LocaleProvider>
      <div className="app appReset">
        <React.Suspense fallback={RouteFallback}>
          <Routes>
            <Route path="/login" element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
            <Route path="/" element={<Navigate to="/customer/dashboard" replace />} />
            <Route path="/dashboard" element={<Navigate to="/customer/dashboard" replace />} />
            <Route path="/dashboard/customer" element={<Navigate to="/customer/dashboard" replace />} />
            <Route path="/dashboard/export" element={<Navigate to="/customer/export" replace />} />
            <Route
              path="/customer/*"
              element={(
                <RequireSession>
                  <CustomerShell />
                </RequireSession>
              )}
            />
            <Route path="/admin/*" element={<RequireSession><AdminShell /></RequireSession>} />
            <Route
              path="*"
              element={(
                <RequireSession>
                  {isCustomerRoute(pathname) ? <CustomerShell /> : (isAdminRoute(pathname) ? <AdminShell /> : <Shell expert={expert} />)}
                </RequireSession>
              )}
            />
          </Routes>
        </React.Suspense>
      </div>
    </LocaleProvider>
  );
}
