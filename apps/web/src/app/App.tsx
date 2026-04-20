import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { fetchAuthMe } from "../api/auth";
import { useSession } from "../auth/useSession";
import { readExpertModeFromStorage } from "../lib/uiPrefs";
import { LocaleProvider } from "../lib/locale";
import AppShell from "./AppShell";
import { type AppBreadcrumbItem } from "../components/layout/AppBreadcrumb";
import { renderDashboardRoutes } from "./routes/dashboardRoutes";
import { renderFieldsRoutes } from "./routes/fieldsRoutes";
import { renderDevicesRoutes } from "./routes/devicesRoutes";
import { renderOperationsRoutes } from "./routes/operationsRoutes";
import { renderProgramsRoutes } from "./routes/programsRoutes";
import { renderEvidenceRoutes } from "./routes/evidenceRoutes";
import { renderSkillsRoutes } from "./routes/skillsRoutes";
import { trackMainActionClick, usePageEnterEvent } from "../shared/telemetry/pageEvents";

const JudgeRunPage = React.lazy(() => import("../views/JudgeRunPage"));
const JudgeRecordsPage = React.lazy(() => import("../views/JudgeRecordsPage"));
const JudgeConfigPage = React.lazy(() => import("../views/JudgeConfigPage"));
const SimConfigPage = React.lazy(() => import("../views/SimConfigPage"));
const AdminHealthPage = React.lazy(() => import("../views/AdminHealthPage"));
const AdminImportPage = React.lazy(() => import("../views/AdminImportPage"));
const AdminAcceptancePage = React.lazy(() => import("../views/AdminAcceptancePage"));
const ApprovalRequestsPage = React.lazy(() => import("../views/ApprovalRequestsPage"));
const DevToolsPage = React.lazy(() => import("../views/DevToolsPage"));
const SettingsPage = React.lazy(() => import("../views/SettingsPage"));
const LoginPage = React.lazy(() => import("../views/LoginPage"));

const RouteFallback = <div className="card" style={{ padding: 16 }}>页面加载中...</div>;

function titleForPath(pathname: string): string {
  if (pathname === "/" || pathname === "/dashboard") return "平台控制台";
  if (pathname === "/dashboard/customer") return "客户看板";
  if (pathname.startsWith("/delivery/export-jobs")) return "导出报告";
  if (pathname === "/fields") return "田块";
  if (pathname === "/fields/new") return "新建田块";
  if (pathname.startsWith("/fields/") && pathname.endsWith("/report")) return "地块报告";
  if (pathname.startsWith("/fields/")) return "田块详情";
  if (pathname === "/devices") return "设备";
  if (pathname === "/devices/onboarding") return "设备接入向导";
  if (pathname.startsWith("/devices/")) return "设备详情";
  if (pathname.startsWith("/operations/") && pathname.endsWith("/report")) return "作业报告";
  if (pathname.startsWith("/operations/workboard")) return "运营作业台";
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
  if (pathname.startsWith("/alerts")) return "告警中心";
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
  if (pathname.startsWith("/delivery/export-jobs")) return "作为证据中心下的二级模块，集中查看导出批次与回执状态。";
  if (pathname === "/fields") return "围绕田块、边界、季节与设备绑定进行管理。";
  if (pathname === "/fields/new") return "创建田块并开始开局链路。";
  if (pathname.startsWith("/fields/") && pathname.endsWith("/report")) return "查看地块作业报告及风险、成本汇总。";
  if (pathname.startsWith("/fields/")) return "查看单个田块的边界、季节与绑定设备摘要。";
  if (pathname === "/devices") return "集中查看设备状态、最新遥测与田块绑定关系。";
  if (pathname === "/devices/onboarding") return "从注册到首条 telemetry 上传的标准接入流程。";
  if (pathname.startsWith("/devices/")) return "查看单个设备的状态、最新遥测和最小趋势。";
  if (pathname.startsWith("/operations/") && pathname.endsWith("/report")) return "查看作业报告固定区块：摘要、执行、验收、证据、成本、SLA 与风险。";
  if (pathname.startsWith("/operations/workboard")) return "以人工队列方式统一处理分派、开工、备注、解决和关闭动作。";
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
  if (pathname.startsWith("/alerts")) return "统一管理阈值规则、告警事件与确认关闭动作。";
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
  if (pathname.startsWith("/delivery/export-jobs")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "证据中心", to: "/audit-export" }, { label: "导出报告" }];
  if (pathname === "/fields") return [{ label: "平台控制台", to: "/dashboard" }, { label: "田块" }];
  if (pathname === "/fields/new") return [{ label: "平台控制台", to: "/dashboard" }, { label: "田块", to: "/fields" }, { label: "新建田块" }];
  if (pathname.startsWith("/fields/") && pathname.endsWith("/report")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "田块", to: "/fields" }, { label: "地块报告" }];
  if (pathname.startsWith("/fields/")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "田块", to: "/fields" }, { label: "田块详情" }];
  if (pathname === "/devices") return [{ label: "平台控制台", to: "/dashboard" }, { label: "设备" }];
  if (pathname === "/devices/onboarding") return [{ label: "平台控制台", to: "/dashboard" }, { label: "设备", to: "/devices" }, { label: "设备接入向导" }];
  if (pathname.startsWith("/devices/")) return [{ label: "平台控制台", to: "/dashboard" }, { label: "设备", to: "/devices" }, { label: "设备详情" }];
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
  if (pathname.startsWith("/fields/") && pathname.endsWith("/report")) return { label: "返回田块详情", to: pathname.replace(/\/report$/, "") };
  if (pathname.startsWith("/fields/")) return { label: "返回田块列表", to: "/fields" };
  if (pathname.startsWith("/fields")) return { label: "新建田块", to: "/fields/new" };
  if (pathname.startsWith("/devices/") && pathname !== "/devices/onboarding") return { label: "返回设备列表", to: "/devices" };
  if (pathname.startsWith("/devices")) return { label: "接入设备", to: "/devices/onboarding" };
  if (pathname.startsWith("/operations/") && pathname.endsWith("/report")) return { label: "返回作业详情", to: pathname.replace(/\/report$/, "") };
  if (pathname.startsWith("/operations/workboard")) return { label: "返回作业列表", to: "/operations" };
  if (pathname.startsWith("/operations/")) return { label: "返回作业列表", to: "/operations" };
  if (pathname.startsWith("/operations")) return { label: "查看人工执行", to: "/human-assignments" };
  if (pathname.startsWith("/human-assignments/")) return { label: "返回人工执行列表", to: "/human-assignments" };
  if (pathname.startsWith("/human-assignments")) return { label: "返回作业列表", to: "/operations" };
  if (pathname.startsWith("/dispatch-workbench")) return { label: "返回人工执行列表", to: "/human-assignments" };
  if (pathname.startsWith("/human-execution-analysis")) return { label: "返回人工执行列表", to: "/human-assignments" };
  if (pathname.startsWith("/human-ops-analytics")) return { label: "返回人工执行列表", to: "/human-assignments" };
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
        <Routes>
          {renderDashboardRoutes(expert)}
          {renderEvidenceRoutes()}
          {renderFieldsRoutes()}
          {renderDevicesRoutes()}
          {renderOperationsRoutes()}
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
          <Route path="/legacy/admin/acceptance" element={<AdminAcceptancePage />} />
          <Route path="/legacy/control/approvals" element={<ApprovalRequestsPage />} />
          <Route path="/judge/run" element={<Navigate to="/legacy/judge/run" replace />} />
          <Route path="/judge/records" element={<Navigate to="/legacy/judge/records" replace />} />
          <Route path="/judge/config" element={<Navigate to="/legacy/judge/config" replace />} />
          <Route path="/sim/config" element={<Navigate to="/legacy/sim/config" replace />} />
          <Route path="/admin/healthz" element={<Navigate to="/legacy/admin/healthz" replace />} />
          <Route path="/admin/import" element={<Navigate to="/legacy/admin/import" replace />} />
          <Route path="/admin/acceptance" element={<Navigate to="/legacy/admin/acceptance" replace />} />
          <Route path="/control/approvals" element={<Navigate to="/legacy/control/approvals" replace />} />
          <Route path="/settings" element={<Navigate to="/legacy/settings" replace />} />
          <Route path="/dev" element={<Navigate to="/legacy/dev" replace />} />
        </Routes>
      </React.Suspense>
    </AppShell>
  );
}

function RequireAuthenticated({ children }: { children: React.ReactElement }): React.ReactElement {
  const { token, clearToken } = useSession();
  const [status, setStatus] = React.useState<"checking" | "ok" | "failed">("checking");

  React.useEffect(() => {
    let mounted = true;

    if (!token.trim()) {
      setStatus("failed");
      return () => {
        mounted = false;
      };
    }

    setStatus("checking");
    fetchAuthMe()
      .then(() => {
        if (mounted) setStatus("ok");
      })
      .catch(() => {
        clearToken();
        if (mounted) setStatus("failed");
      });

    return () => {
      mounted = false;
    };
  }, [token, clearToken]);

  if (status === "checking") {
    return <div className="card" style={{ padding: 16, margin: 24 }}>正在验证登录状态...</div>;
  }

  if (status === "failed") {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App(): React.ReactElement {
  const [expert] = React.useState<boolean>(() => readExpertModeFromStorage());
  const { token } = useSession();

  return (
    <LocaleProvider>
      <div className="app appReset">
        <React.Suspense fallback={RouteFallback}>
          <Routes>
            <Route path="/login" element={token.trim() ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
            <Route
              path="*"
              element={(
                <RequireAuthenticated>
                  <Shell expert={expert} />
                </RequireAuthenticated>
              )}
            />
          </Routes>
        </React.Suspense>
      </div>
    </LocaleProvider>
  );
}
