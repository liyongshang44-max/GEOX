// GEOX/apps/web/src/routes/App.tsx
import React from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import GroupListPage from "../views/GroupListPage";
import GroupTimelinePage from "../views/GroupTimelinePage";
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
import AlertsPage from "../views/AlertsPage";
import AuditExportPage from "../views/AuditExportPage";
import AgronomyRecommendationsPage from "../views/AgronomyRecommendationsPage";
import SettingsPage from "../views/SettingsPage";
import { fetchAuthMe, readStoredAoActToken, type AuthMe } from "../lib/api";

type BreadcrumbItem = {
  label: string;
  to?: string;
};

function titleForPath(pathname: string): string {
  if (pathname === "/" || pathname === "/dashboard") return "总览";
  if (pathname.startsWith("/delivery/export-jobs")) return "证据导出";
  if (pathname === "/fields") return "田块与 GIS";
  if (pathname.startsWith("/fields/")) return "田块详情";
  if (pathname === "/devices") return "设备中心";
  if (pathname === "/devices/onboarding") return "设备接入向导";
  if (pathname.startsWith("/devices/")) return "设备详情";
  if (pathname.startsWith("/operations")) return "作业控制";
  if (pathname.startsWith("/agronomy/recommendations")) return "农业建议";
  if (pathname.startsWith("/alerts")) return "告警中心";
  if (pathname.startsWith("/audit-export")) return "审计与导出";
  if (pathname.startsWith("/settings")) return "系统设置";
  if (pathname.startsWith("/dev")) return "研发工具";
  return "GEOX 控制台";
}

function leadForPath(pathname: string): string {
  if (pathname === "/" || pathname === "/dashboard") return "当前页面汇总 Commercial v1 已完成能力、冻结基线与下一阶段收口任务。";
  if (pathname.startsWith("/delivery/export-jobs")) return "统一查看证据导出任务、详情文件与下载入口。";
  if (pathname === "/fields") return "围绕田块、边界、季节与设备绑定进行最小产品化管理。";
  if (pathname.startsWith("/fields/")) return "查看单个田块的边界、季节与绑定设备摘要。";
  if (pathname === "/devices") return "集中查看设备状态、最新遥测与田块绑定关系。";
  if (pathname === "/devices/onboarding") return "从注册到首条 telemetry 上传的标准接入流程。";
  if (pathname.startsWith("/devices/")) return "查看单个设备的状态、最新遥测和最小趋势。";
  if (pathname.startsWith("/operations")) return "围绕审批、任务、调度与回执形成中文作业控制工作面。";
  if (pathname.startsWith("/agronomy/recommendations")) return "查看农业建议、证据引用、规则命中与审批前状态。";
  if (pathname.startsWith("/alerts")) return "统一管理阈值规则、告警事件与确认关闭动作。";
  if (pathname.startsWith("/audit-export")) return "按对象和时间范围汇总导出、告警、回执与控制动作。";
  if (pathname.startsWith("/settings")) return "查看当前会话、角色、令牌与最小门禁约束。";
  if (pathname.startsWith("/dev")) return "保留旧调试页作为 fallback，不参与商业演示主流程。";
  return "中文商业控制台外壳已建立，后续页面按产品信息架构持续收口。";
}

function breadcrumbsForPath(pathname: string): BreadcrumbItem[] {
  if (pathname === "/" || pathname === "/dashboard") return [{ label: "总览" }];
  if (pathname.startsWith("/delivery/export-jobs")) return [{ label: "总览", to: "/dashboard" }, { label: "证据导出" }];
  if (pathname === "/fields") return [{ label: "总览", to: "/dashboard" }, { label: "田块与 GIS" }];
  if (pathname.startsWith("/fields/")) return [{ label: "总览", to: "/dashboard" }, { label: "田块与 GIS", to: "/fields" }, { label: "田块详情" }];
  if (pathname === "/devices") return [{ label: "总览", to: "/dashboard" }, { label: "设备中心" }];
  if (pathname === "/devices/onboarding") return [{ label: "总览", to: "/dashboard" }, { label: "设备中心", to: "/devices" }, { label: "设备接入向导" }];
  if (pathname.startsWith("/devices/")) return [{ label: "总览", to: "/dashboard" }, { label: "设备中心", to: "/devices" }, { label: "设备详情" }];
  if (pathname.startsWith("/operations")) return [{ label: "总览", to: "/dashboard" }, { label: "作业控制" }];
  if (pathname.startsWith("/agronomy/recommendations")) return [{ label: "总览", to: "/dashboard" }, { label: "农业建议" }];
  if (pathname.startsWith("/alerts")) return [{ label: "总览", to: "/dashboard" }, { label: "告警中心" }];
  if (pathname.startsWith("/audit-export")) return [{ label: "总览", to: "/dashboard" }, { label: "审计与导出" }];
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
    const token = readStoredAoActToken(); // Resolve the shared AO-ACT token from storage helpers.
    if (!token) { setSession(null); return; } // Clear the session badge when no token is available.
    fetchAuthMe(token).then(setSession).catch(() => setSession(null)); // Refresh the visible session badge on route changes.
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
          <SidebarLink to="/dashboard" label="总览" />
          <SidebarLink to="/fields" label="田块与 GIS" />
          <SidebarLink to="/devices" label="设备中心" />
          <SidebarLink to="/devices/onboarding" label="设备接入向导" />
          <SidebarLink to="/operations" label="作业控制" />
          <SidebarLink to="/agronomy/recommendations" label="农业建议" />
          <SidebarLink to="/alerts" label="告警中心" />
          <SidebarLink to="/audit-export" label="审计与导出" />
          <SidebarLink to="/delivery/export-jobs" label="证据导出" />
          <SidebarLink to="/settings" label="系统设置" />
        </nav>

        <div className="consoleNotice">
          <div className="consoleNoticeTitle">当前阶段</div>
          <div className="consoleNoticeBody">Commercial v1 中间冻结态，重点做收口与演示一致性，不再随意扩模块。</div>
        </div>

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
            <div className="eyebrow">GEOX / LandOS Control Plane</div>
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
            <div className="pill">中文界面</div>
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
            <Route path="/agronomy/recommendations" element={<AgronomyRecommendationsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/audit-export" element={<AuditExportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/dev" element={<DevToolsPage />} />

            <Route path="/legacy/groups" element={<GroupListPage />} />
            <Route path="/legacy/group/:groupId" element={<GroupTimelinePage />} />
            <Route path="/legacy/judge/run" element={<JudgeRunPage />} />
            <Route path="/legacy/judge/records" element={<JudgeRecordsPage />} />
            <Route path="/legacy/judge/config" element={<JudgeConfigPage />} />
            <Route path="/legacy/sim/config" element={<SimConfigPage />} />
            <Route path="/legacy/admin/healthz" element={<AdminHealthPage />} />
            <Route path="/legacy/admin/import" element={<AdminImportPage />} />
            <Route path="/legacy/admin/acceptance" element={<AdminAcceptancePage />} />
            <Route path="/legacy/control/approvals" element={<ApprovalRequestsPage />} />

            <Route path="/group/:groupId" element={<GroupTimelinePage />} />
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
  const [expert, setExpert] = React.useState<boolean>(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("expert") === "1") {
        localStorage.setItem("geox_expert", "1");
        return true;
      }
      return localStorage.getItem("geox_expert") === "1";
    } catch {
      return false;
    }
  });

  return (
    <div className="app appReset">
      <Shell
        expert={expert}
        onToggleExpert={() => {
          const next = !expert;
          setExpert(next);
          try {
            if (next) localStorage.setItem("geox_expert", "1");
            else localStorage.removeItem("geox_expert");
          } catch {
            // ignore
          }
        }}
      />
    </div>
  );
}
