// GEOX/apps/web/src/routes/App.tsx
import React from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import JudgeRunPage from "../views/JudgeRunPage";
import JudgeRecordsPage from "../views/JudgeRecordsPage";
import JudgeConfigPage from "../views/JudgeConfigPage";
import SimConfigPage from "../views/SimConfigPage";
import AdminHealthPage from "../views/AdminHealthPage";
import AdminImportPage from "../views/AdminImportPage";
import AdminAcceptancePage from "../views/AdminAcceptancePage";
import ApprovalRequestsPage from "../views/ApprovalRequestsPage";
import ExportJobsPage from "../views/ExportJobsPage";
import CommercialDashboardPage from "../views/CommercialDashboardPage";
import DevToolsPage from "../views/DevToolsPage";
import FieldsPage from "../views/FieldsPage";
import FieldDetailPage from "../views/FieldDetailPage";
import DevicesPage from "../views/DevicesPage";
import DeviceDetailPage from "../views/DeviceDetailPage";
import DeviceOnboardingPage from "../views/DeviceOnboardingPage";
import OperationsPage from "../views/OperationsPage";
import OperationDetailPage from "../views/OperationDetailPage";
import AlertsPage from "../views/AlertsPage";
import AuditExportPage from "../views/AuditExportPage";
import AgronomyRecommendationsPage from "../views/AgronomyRecommendationsPage";
import SettingsPage from "../views/SettingsPage";
import ProgramListPage from "../views/ProgramListPage";
import ProgramDetailPage from "../views/ProgramDetailPage";
import HumanAssignmentsPage from "../views/HumanAssignmentsPage";
import HumanAssignmentDetailPage from "../views/HumanAssignmentDetailPage";
import { fetchAuthMe, type AuthMe } from "../api";
import { persistExpertMode, readExpertModeFromStorage } from "../lib/uiPrefs";
import { LocaleProvider } from "../lib/locale";

type BreadcrumbItem = {
  label: string;
  to?: string;
};

function titleForPath(pathname: string): string {
  if (pathname === "/" || pathname === "/dashboard") return "总览";
  if (pathname.startsWith("/delivery/export-jobs")) return "证据中心";
  if (pathname === "/fields") return "田块与 GIS";
  if (pathname.startsWith("/fields/")) return "田块详情";
  if (pathname === "/devices") return "设备中心";
  if (pathname === "/devices/onboarding") return "设备接入向导";
  if (pathname.startsWith("/devices/")) return "设备详情";
  if (pathname.startsWith("/operations/")) return "作业详情";
  if (pathname.startsWith("/operations")) return "作业中心";
  if (pathname.startsWith("/human-assignments/")) return "人工执行详情";
  if (pathname.startsWith("/human-assignments")) return "人工执行";
  if (pathname === "/programs") return "经营方案";
  if (pathname.startsWith("/programs/")) return "经营方案详情";
  if (pathname.startsWith("/agronomy/recommendations")) return "农业建议";
  if (pathname.startsWith("/alerts")) return "告警中心";
  if (pathname.startsWith("/audit-export")) return "证据中心";
  if (pathname.startsWith("/settings")) return "系统设置";
  if (pathname.startsWith("/dev")) return "研发工具";
  return "GEOX 控制台";
}

function leadForPath(pathname: string): string {
  if (pathname === "/" || pathname === "/dashboard") return "一眼查看经营方案运行态、待执行动作、证据状态与风险摘要。";
  if (pathname.startsWith("/delivery/export-jobs")) return "统一查看证据导出、回执追踪与完整性提示。";
  if (pathname === "/fields") return "围绕田块、边界、季节与设备绑定进行最小产品化管理。";
  if (pathname.startsWith("/fields/")) return "查看单个田块的边界、季节与绑定设备摘要。";
  if (pathname === "/devices") return "集中查看设备状态、最新遥测与田块绑定关系。";
  if (pathname === "/devices/onboarding") return "从注册到首条 telemetry 上传的标准接入流程。";
  if (pathname.startsWith("/devices/")) return "查看单个设备的状态、最新遥测和最小趋势。";
  if (pathname.startsWith("/operations/")) return "查看作业状态、执行时间线与最新执行证据。";
  if (pathname.startsWith("/operations")) return "聚焦待执行与长时间未推进动作，支持快速追溯经营方案。";
  if (pathname.startsWith("/human-assignments/")) return "查看任务详情并提交人工执行回执。";
  if (pathname.startsWith("/human-assignments")) return "按状态处理人工任务，完成接单、执行与提交。";
  if (pathname === "/programs") return "按状态和风险筛选经营方案，快速判断优先级并进入详情。";
  if (pathname.startsWith("/programs/")) return "查看经营方案的决策链、执行链、证据链与资源结果。";
  if (pathname.startsWith("/agronomy/recommendations")) return "查看农业建议、证据引用、规则命中与审批前状态。";
  if (pathname.startsWith("/alerts")) return "统一管理阈值规则、告警事件与确认关闭动作。";
  if (pathname.startsWith("/audit-export")) return "统一管理证据导出、回执追踪与完整性校验。";
  if (pathname.startsWith("/settings")) return "查看当前会话、角色、令牌与最小门禁约束。";
  if (pathname.startsWith("/dev")) return "保留旧调试页作为 fallback，不参与商业演示主流程。";
  return "中文商业控制台外壳已建立，后续页面按产品信息架构持续收口。";
}

function breadcrumbsForPath(pathname: string): BreadcrumbItem[] {
  if (pathname === "/" || pathname === "/dashboard") return [{ label: "总览" }];
  if (pathname.startsWith("/delivery/export-jobs")) return [{ label: "总览", to: "/dashboard" }, { label: "证据中心" }];
  if (pathname === "/fields") return [{ label: "总览", to: "/dashboard" }, { label: "田块与 GIS" }];
  if (pathname.startsWith("/fields/")) return [{ label: "总览", to: "/dashboard" }, { label: "田块与 GIS", to: "/fields" }, { label: "田块详情" }];
  if (pathname === "/devices") return [{ label: "总览", to: "/dashboard" }, { label: "设备中心" }];
  if (pathname === "/devices/onboarding") return [{ label: "总览", to: "/dashboard" }, { label: "设备中心", to: "/devices" }, { label: "设备接入向导" }];
  if (pathname.startsWith("/devices/")) return [{ label: "总览", to: "/dashboard" }, { label: "设备中心", to: "/devices" }, { label: "设备详情" }];
  if (pathname.startsWith("/operations/")) return [{ label: "总览", to: "/dashboard" }, { label: "作业中心", to: "/operations" }, { label: "作业详情" }];
  if (pathname.startsWith("/operations")) return [{ label: "总览", to: "/dashboard" }, { label: "作业中心" }];
  if (pathname.startsWith("/human-assignments/")) return [{ label: "总览", to: "/dashboard" }, { label: "人工执行", to: "/human-assignments" }, { label: "任务详情" }];
  if (pathname.startsWith("/human-assignments")) return [{ label: "总览", to: "/dashboard" }, { label: "人工执行" }];
  if (pathname === "/programs") return [{ label: "总览", to: "/dashboard" }, { label: "经营方案" }];
  if (pathname.startsWith("/programs/")) return [{ label: "总览", to: "/dashboard" }, { label: "经营方案", to: "/programs" }, { label: "经营方案详情" }];
  if (pathname.startsWith("/agronomy/recommendations")) return [{ label: "总览", to: "/dashboard" }, { label: "农业建议" }];
  if (pathname.startsWith("/alerts")) return [{ label: "总览", to: "/dashboard" }, { label: "告警中心" }];
  if (pathname.startsWith("/audit-export")) return [{ label: "总览", to: "/dashboard" }, { label: "证据中心" }];
  if (pathname.startsWith("/settings")) return [{ label: "总览", to: "/dashboard" }, { label: "系统设置" }];
  if (pathname.startsWith("/dev")) return [{ label: "总览", to: "/dashboard" }, { label: "研发工具" }];
  return [{ label: "总览", to: "/dashboard" }, { label: "控制台" }];
}

function SidebarLink({ to, label }: { to: string; label: string }): React.ReactElement {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `sideLink ${isActive ? "active" : ""}`}
      end={to === "/" || to === "/dashboard"}
    >
      {label}
    </NavLink>
  );
}

function Shell({ expert, onToggleExpert }: { expert: boolean; onToggleExpert: () => void }): React.ReactElement {
  const location = useLocation();
  const pathname = location.pathname;
  const pageTitle = titleForPath(pathname);
  const pageLead = leadForPath(pathname);
  const crumbs = breadcrumbsForPath(pathname);
  const [session, setSession] = React.useState<AuthMe | null>(null);

    React.useEffect(() => {
    fetchAuthMe().then(setSession).catch(() => setSession(null)); // Refresh the visible session badge on route changes.
  }, [location.pathname]);

  return (
    <div className="consoleShell">
      <aside className="sidebar card">
        <div className="sidebarBrand">
          <div className="brandMark">G</div>
          <div>
            <div className="brandName">GEOX</div>
            <div className="brandSub">农业运营控制台</div>
          </div>
        </div>

        <div className="sideGroupTitle">业务导航</div>
        <nav className="sideNav">
          <SidebarLink to="/dashboard" label="监控台" />
          <SidebarLink to="/fields" label="田块与 GIS" />
          <SidebarLink to="/devices" label="设备中心" />
          <SidebarLink to="/devices/onboarding" label="设备接入向导" />
          <SidebarLink to="/operations" label="作业中心" />
          <SidebarLink to="/human-assignments" label="人工执行" />
          <SidebarLink to="/programs" label="经营方案" />
          <SidebarLink to="/agronomy/recommendations" label="农业建议" />
          <SidebarLink to="/alerts" label="告警中心" />
          <SidebarLink to="/delivery/export-jobs" label="证据中心" />
          <SidebarLink to="/settings" label="系统设置" />
        </nav>

        {expert ? (
          <>
            <div className="sideGroupTitle">研发工具</div>
            <nav className="sideNav">
              <SidebarLink to="/dev" label="研发工具首页" />
            </nav>
          </>
        ) : null}
      </aside>

      <main className="consoleMain">
        <header className="consoleHeader card">
          <div>
            <div className="eyebrow">GEOX / 远程农业运营控制台</div>
            <div className="breadcrumbBar">
              {crumbs.map((crumb, index) => (
                <React.Fragment key={`${crumb.label}_${index}`}>
                  {crumb.to ? <NavLink className="breadcrumbLink" to={crumb.to}>{crumb.label}</NavLink> : <span className="breadcrumbCurrent">{crumb.label}</span>}
                  {index < crumbs.length - 1 ? <span className="breadcrumbSep">/</span> : null}
                </React.Fragment>
              ))}
            </div>
            <h1 className="pageTitle">{pageTitle}</h1>
            <div className="pageLead">{pageLead}</div>
          </div>
          <div className="headerActions">
            <div className="pill">{session?.role === "operator" ? "操作员" : session?.role === "admin" ? "管理员" : "未识别会话"}</div>
            {expert ? <NavLink className="btn" to="/dev">研发工具</NavLink> : null}
            <button className="btn" onClick={onToggleExpert}>{expert ? "研发模式：开启" : "研发模式：关闭"}</button>
          </div>
        </header>

        <div className="consoleContent">
          <Routes>
            <Route path="/" element={<CommercialDashboardPage expert={expert} />} />
            <Route path="/dashboard" element={<CommercialDashboardPage expert={expert} />} />
            <Route path="/delivery/export-jobs" element={<ExportJobsPage />} />
            <Route path="/fields" element={<FieldsPage />} />
            <Route path="/fields/:fieldId" element={<FieldDetailPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/devices/onboarding" element={<DeviceOnboardingPage />} />
            <Route path="/devices/:deviceId" element={<DeviceDetailPage />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/operations/:operationPlanId" element={<OperationDetailPage />} />
            <Route path="/human-assignments" element={<HumanAssignmentsPage />} />
            <Route path="/human-assignments/:assignmentId" element={<HumanAssignmentDetailPage />} />
            <Route path="/programs" element={<ProgramListPage />} />
            <Route path="/programs/:programId" element={<ProgramDetailPage />} />
            <Route path="/agronomy/recommendations" element={<AgronomyRecommendationsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/audit-export" element={<AuditExportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/dev" element={<DevToolsPage />} />

            <Route path="/legacy/judge/run" element={<JudgeRunPage />} />
            <Route path="/legacy/judge/records" element={<JudgeRecordsPage />} />
            <Route path="/legacy/judge/config" element={<JudgeConfigPage />} />
            <Route path="/legacy/sim/config" element={<SimConfigPage />} />
            <Route path="/legacy/admin/healthz" element={<AdminHealthPage />} />
            <Route path="/legacy/admin/import" element={<AdminImportPage />} />
            <Route path="/legacy/admin/acceptance" element={<AdminAcceptancePage />} />
            <Route path="/legacy/control/approvals" element={<ApprovalRequestsPage />} />

            <Route path="/judge/run" element={<JudgeRunPage />} />
            <Route path="/judge/records" element={<JudgeRecordsPage />} />
            <Route path="/judge/config" element={<JudgeConfigPage />} />
            <Route path="/sim/config" element={<SimConfigPage />} />
            <Route path="/admin/healthz" element={<AdminHealthPage />} />
            <Route path="/admin/import" element={<AdminImportPage />} />
            <Route path="/admin/acceptance" element={<AdminAcceptancePage />} />
            <Route path="/control/approvals" element={<ApprovalRequestsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App(): React.ReactElement {
  const [expert, setExpert] = React.useState<boolean>(() => readExpertModeFromStorage());

  return (
    <LocaleProvider>
      <div className="app appReset">
        <Shell
          expert={expert}
          onToggleExpert={() => {
            const next = !expert;
            setExpert(next);
            persistExpertMode(next);
          }}
        />
      </div>
    </LocaleProvider>
  );
}
