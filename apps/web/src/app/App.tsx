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
import { renderCustomerFieldsRoutes } from "./routes/fieldsRoutes";
import { renderDevicesRoutes } from "./routes/devicesRoutes";
import { renderOperationsRoutes } from "./routes/operationsRoutes";
import { renderCustomerOperationsRoutes } from "./routes/customerOperationsRoutes";
import { renderProgramsRoutes } from "./routes/programsRoutes";
import { renderEvidenceRoutes } from "./routes/evidenceRoutes";
import { renderSkillsRoutes } from "./routes/skillsRoutes";
import { trackMainActionClick, usePageEnterEvent } from "../shared/telemetry/pageEvents";

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
const OperatorGatewayDemoViewerPage = React.lazy(() => import("../features/operator/pages/OperatorGatewayDemoViewerPage"));
const OperatorFieldTwinWorkspacePage = React.lazy(() => import("../features/operator/pages/OperatorFieldTwinWorkspacePage"));
const OperatorFieldTwinForecastPage = React.lazy(() => import("../features/operator/pages/OperatorFieldTwinForecastPage"));
const OperatorFieldTwinScenarioComparePage = React.lazy(() => import("../features/operator/pages/OperatorFieldTwinScenarioComparePage"));
const OperatorFieldTwinEvidencePage = React.lazy(() => import("../features/operator/pages/OperatorFieldTwinEvidencePage"));
const OperatorFieldTwinCalibrationPage = React.lazy(() => import("../features/operator/pages/OperatorFieldTwinCalibrationPage"));
const OperatorFieldTwinPostIrrigationPage = React.lazy(() => import("../features/operator/pages/OperatorFieldTwinPostIrrigationPage"));
const OperatorTwinTraceReadbackPage = React.lazy(() => import("../features/operator/pages/OperatorTwinTraceReadbackPage"));

const RouteFallback = <div className="card" style={{ padding: 16 }}>页面加载中...</div>;

type BreadcrumbItem = AppBreadcrumbItem;

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
  if (pathname.startsWith("/operator/twin/gateway-demo")) return "Gateway 支撑的 Twin Demo Viewer";
  if (pathname.startsWith("/operator")) return "操作员数字孪生工作台";
  if (pathname.startsWith("/customer")) return "客户看板";
  if (pathname.startsWith("/admin")) return "后台管理";
  if (pathname.startsWith("/fields")) return "田块";
  if (pathname.startsWith("/devices")) return "设备";
  if (pathname.startsWith("/operations")) return "作业";
  if (pathname.startsWith("/programs")) return "经营方案";
  if (pathname.startsWith("/audit-export")) return "证据中心";
  return "GEOX 控制台";
}

function leadForPath(pathname: string): string {
  if (pathname.startsWith("/operator/twin/gateway-demo")) return "只读展示 P51 gateway-backed snapshot，不重新生成 gateway evidence。";
  if (pathname.startsWith("/operator")) return "操作员侧用于分析、复核和人工确认。";
  if (pathname.startsWith("/admin")) return "内部治理、执行状态、证据、设备、技能、验收与审计边界。";
  if (pathname.startsWith("/customer")) return "面向客户的简化看板。";
  return "GEOX 控制台。";
}

function breadcrumbsForPath(pathname: string): BreadcrumbItem[] {
  if (pathname.startsWith("/operator/twin/gateway-demo")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "操作员 Twin", to: "/operator/twin" }, { label: "Gateway Demo" }];
  if (pathname.startsWith("/operator")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "操作员 Twin" }];
  if (pathname.startsWith("/admin")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "后台管理" }];
  if (pathname.startsWith("/customer")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "客户看板" }];
  return [{ label: "平台控制台" }];
}

function primaryActionForPath(pathname: string): { label: string; to: string } {
  if (pathname.startsWith("/operator/twin/gateway-demo")) return { label: "返回 Twin 总览", to: "/operator/twin" };
  if (pathname.startsWith("/operator")) return { label: "返回总览", to: "/operator/twin" };
  if (pathname.startsWith("/customer")) return { label: "客户看板", to: "/customer/dashboard" };
  if (pathname.startsWith("/admin")) return { label: "后台管理", to: "/admin/dashboard" };
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
      <Route path="twin/gateway-demo" element={<OperatorGatewayDemoViewerPage />} />
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
        lead: "Admin Control Plane：内部治理、状态、证据、设备、技能、验收与审计边界。",
        primaryAction: { label: "查看客户门户", to: "/customer/dashboard" },
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
            <Route path="/customer/*" element={<RequireSession><CustomerShell /></RequireSession>} />
            <Route path="/admin/*" element={<RequireSession><AdminShell /></RequireSession>} />
            <Route path="*" element={<RequireSession>{isCustomerRoute(pathname) ? <CustomerShell /> : (isAdminRoute(pathname) ? <AdminShell /> : <Shell expert={expert} />)}</RequireSession>} />
          </Routes>
        </React.Suspense>
      </div>
    </LocaleProvider>
  );
}
