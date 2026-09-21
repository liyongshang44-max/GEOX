// apps/web/src/layouts/OperatorLayout.tsx
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import LocaleToggle from "../components/common/LocaleToggle";
import { ProductTechnicalDisclosure } from "../design-system/product";
import { localizedText, useLocale, type LocaleCode, type LocalizedCopy } from "../lib/locale";
import { OPERATOR_SHELL_LABELS, type ShellNavCopy } from "../lib/productSurfaceLabels";
import "../styles/operatorShell.css";
import "../styles/operatorShellApple.css";
import "../styles/fouiFieldOperations.css";

export type OperatorRuntimeContextSource = "governed-static-nonclaim" | "authoritative-read-model";

export type OperatorRuntimeContextDetail = {
  label: LocalizedCopy;
  value: LocalizedCopy;
  monospace?: boolean;
};

export type OperatorRuntimeContextDescriptor = {
  mode: LocalizedCopy;
  readOnly: boolean;
  source: OperatorRuntimeContextSource;
  details: OperatorRuntimeContextDetail[];
};

type OperatorLayoutProps = {
  children: React.ReactNode;
  title?: string;
  lead?: string;
  runtimeContext?: OperatorRuntimeContextDescriptor;
};

type OperatorNavItem = {
  key: "overview" | "fields" | "agronomy" | "operations" | "reports" | "administration";
  copy: ShellNavCopy;
  to: string;
};

const FOUI_SHELL_COPY = {
  brand: { zh: "GEOX 田间运营", en: "GEOX Field Operations" },
  navigationAria: { zh: "GEOX 田间运营导航", en: "GEOX Field Operations navigation" },
  productSurface: { zh: "田间运营", en: "Field Operations" },
  boundaryLabel: { zh: "产品边界", en: "Product boundary" },
  boundaryValue: {
    zh: "田块事实由 MCFT 承载；农艺判断与运营授权保持独立权威。",
    en: "MCFT carries field reality; agronomic judgment and operating authority remain separate.",
  },
  footerNote: {
    zh: "Real Fields. Responsible Outcomes.",
    en: "Real Fields. Responsible Outcomes.",
  },
  topbarPrimary: { zh: "权威感知", en: "Authority-aware" },
  topbarSecondary: { zh: "产品界面", en: "Product shell" },
  titles: {
    home: { zh: "田间智能", en: "Field Intelligence" },
    fields: { zh: "田块", en: "Fields" },
    agronomy: { zh: "农艺 / 规划", en: "Agronomy / Planning" },
    operations: { zh: "运营与问责", en: "Operations & Accountability" },
  },
  leads: {
    home: { zh: "从当前田块现实开始，再进入农艺判断与受治理作业。", en: "Start with current field reality, then move into agronomy and governed operations." },
    fields: { zh: "选择精确田块范围并读取 MCFT current-world 数据；canonical 技术面保持独立。", en: "Resolve exact field scope and read MCFT current-world data while keeping the canonical technical surface separate." },
    agronomy: { zh: "规划、农艺建议与决策历史；未建立的 ADR 产品投影保持明确未开放。", en: "Planning, agronomic guidance, and decision history; ADR product projections that are not built remain explicitly unavailable." },
    operations: { zh: "组织审批、派发、执行回执与证据复核；写动作仍由 B-Line command API 重新授权。", en: "Organize approvals, dispatch, execution receipts, and evidence review while B-Line command APIs retain authorization." },
  },
  nav: {
    home: { label: { zh: "首页", en: "Home" }, hint: { zh: "田间智能与当前需要处理的事项。", en: "Field intelligence and current items requiring attention." } },
    fields: { label: { zh: "田块", en: "Fields" }, hint: { zh: "进入产品级 Field Intelligence；规范 MCFT 技术视图仍可回查。", en: "Open product Field Intelligence while preserving access to the canonical MCFT technical view." } },
    agronomy: { label: { zh: "农艺", en: "Agronomy" }, hint: { zh: "种植规划、农艺建议与决策历史。", en: "Season planning, agronomic guidance, and decision history." } },
    operations: { label: { zh: "运营", en: "Operations" }, hint: { zh: "审批、派发、执行与证据复核。", en: "Approval, dispatch, execution, and evidence review." } },
    reports: { label: { zh: "报告", en: "Reports" }, hint: { zh: "进入客户可见报告中心。", en: "Open the customer-visible reports center." } },
    administration: { label: { zh: "管理", en: "Administration" }, hint: { zh: "进入独立 Admin Console。", en: "Open the separate Admin Console." } },
  },
} as const;

const OPERATOR_NAV_ITEMS: OperatorNavItem[] = [
  { key: "overview", copy: FOUI_SHELL_COPY.nav.home, to: "/operator/home" },
  { key: "fields", copy: FOUI_SHELL_COPY.nav.fields, to: "/operator/field-intelligence" },
  { key: "agronomy", copy: FOUI_SHELL_COPY.nav.agronomy, to: "/operator/agronomy" },
  { key: "operations", copy: FOUI_SHELL_COPY.nav.operations, to: "/operator/operations" },
  { key: "reports", copy: FOUI_SHELL_COPY.nav.reports, to: "/customer/reports" },
  { key: "administration", copy: FOUI_SHELL_COPY.nav.administration, to: "/admin/dashboard" },
];

const RUNTIME_CONTEXT_COPY = {
  currentContext: { zh: "当前运行上下文", en: "Current Runtime Context" },
  readOnly: { zh: "只读", en: "Read-only" },
  details: { zh: "运行边界详情", en: "Runtime boundary details" },
  detailsLead: {
    zh: "这些状态是当前受治理的非声明边界，不代表 Shadow-online、生产运行或自动控制已经成立。",
    en: "These values are governed nonclaim boundaries. They do not establish Shadow-online, production operation, or automatic control.",
  },
  source: { zh: "上下文来源", en: "Context source" },
  staticSource: { zh: "受治理静态非声明", en: "Governed static nonclaim" },
  authoritativeSource: { zh: "权威只读模型", en: "Authoritative read model" },
  liveDevice: { zh: "实时设备", en: "Live Device" },
  productionGateway: { zh: "生产网关", en: "Production Gateway" },
  fieldPilot: { zh: "田间试点", en: "Field Pilot" },
  controlledExecution: { zh: "受控执行", en: "Controlled Execution" },
  notConnected: { zh: "未连接", en: "Not connected" },
  notOnline: { zh: "未上线", en: "Not online" },
  notStarted: { zh: "未开始", en: "Not started" },
  disabled: { zh: "已禁用", en: "Disabled" },
  replayMode: { zh: "回放支撑演示", en: "Replay-backed Demo" },
} as const satisfies Record<string, LocalizedCopy>;

const DEFAULT_RUNTIME_CONTEXT: OperatorRuntimeContextDescriptor = {
  mode: RUNTIME_CONTEXT_COPY.replayMode,
  readOnly: true,
  source: "governed-static-nonclaim",
  details: [
    { label: RUNTIME_CONTEXT_COPY.liveDevice, value: RUNTIME_CONTEXT_COPY.notConnected },
    { label: RUNTIME_CONTEXT_COPY.productionGateway, value: RUNTIME_CONTEXT_COPY.notOnline },
    { label: RUNTIME_CONTEXT_COPY.fieldPilot, value: RUNTIME_CONTEXT_COPY.notStarted },
    { label: RUNTIME_CONTEXT_COPY.controlledExecution, value: RUNTIME_CONTEXT_COPY.disabled },
  ],
};

function isItemActive(pathname: string, item: OperatorNavItem): boolean {
  if (item.key === "overview") return pathname === "/operator" || pathname.startsWith("/operator/home") || pathname === "/operator/twin";
  if (item.key === "fields") return pathname.startsWith("/operator/field-intelligence") || pathname.startsWith("/operator/fields") || pathname.startsWith("/operator/twin/fields/");
  if (item.key === "agronomy") return pathname.startsWith("/operator/agronomy");
  if (item.key === "operations") return pathname.startsWith("/operator/operations") || pathname.startsWith("/operator/approvals") || pathname.startsWith("/operator/dispatch") || pathname.startsWith("/operator/acceptance") || pathname.startsWith("/operator/evidence");
  if (item.key === "reports") return pathname.startsWith("/customer/reports");
  return pathname.startsWith("/admin");
}

function resolveTitle(pathname: string, locale: LocaleCode): string {
  if (pathname === "/operator/home" || pathname === "/operator") return localizedText(FOUI_SHELL_COPY.titles.home, locale);
  if (pathname.startsWith("/operator/field-intelligence")) return localizedText(FOUI_SHELL_COPY.titles.fields, locale);
  if (pathname === "/operator/agronomy") return localizedText(FOUI_SHELL_COPY.titles.agronomy, locale);
  if (pathname === "/operator/operations") return localizedText(FOUI_SHELL_COPY.titles.operations, locale);
  if (pathname === "/operator/twin") return localizedText(OPERATOR_SHELL_LABELS.titles.overview, locale);
  if (pathname === "/operator/twin/production-workflow") return localizedText(OPERATOR_SHELL_LABELS.titles.workflow, locale);
  if (pathname === "/operator/twin/gateway-demo") return localizedText(OPERATOR_SHELL_LABELS.titles.gateway, locale);
  if (pathname.startsWith("/operator/fields") || pathname.startsWith("/operator/twin/fields/")) return localizedText(OPERATOR_SHELL_LABELS.titles.fieldRuntime, locale);
  if (pathname.startsWith("/operator/twin/traces/")) return localizedText(OPERATOR_SHELL_LABELS.titles.auditTrace, locale);
  return localizedText(OPERATOR_SHELL_LABELS.titles.fallback, locale);
}

function resolveLead(pathname: string, locale: LocaleCode): string {
  if (pathname === "/operator/home" || pathname === "/operator") return localizedText(FOUI_SHELL_COPY.leads.home, locale);
  if (pathname.startsWith("/operator/field-intelligence")) return localizedText(FOUI_SHELL_COPY.leads.fields, locale);
  if (pathname === "/operator/agronomy") return localizedText(FOUI_SHELL_COPY.leads.agronomy, locale);
  if (pathname === "/operator/operations") return localizedText(FOUI_SHELL_COPY.leads.operations, locale);
  if (pathname === "/operator/twin") return localizedText(OPERATOR_SHELL_LABELS.leads.overview, locale);
  if (pathname === "/operator/twin/production-workflow") return localizedText(OPERATOR_SHELL_LABELS.leads.workflow, locale);
  if (pathname === "/operator/twin/gateway-demo") return localizedText(OPERATOR_SHELL_LABELS.leads.gateway, locale);
  if (pathname.startsWith("/operator/fields") || pathname.startsWith("/operator/twin/fields/")) return localizedText(OPERATOR_SHELL_LABELS.leads.fieldRuntime, locale);
  if (pathname.startsWith("/operator/twin/traces/")) return localizedText(OPERATOR_SHELL_LABELS.leads.auditTrace, locale);
  return localizedText(OPERATOR_SHELL_LABELS.leads.fallback, locale);
}

function navHint(item: OperatorNavItem, locale: LocaleCode, label: string): string {
  return item.copy.hint ? localizedText(item.copy.hint, locale) : label;
}

function renderNavItem(item: OperatorNavItem, pathname: string, locale: LocaleCode): React.ReactElement {
  const active = isItemActive(pathname, item);
  const label = localizedText(item.copy.label, locale);
  const hint = navHint(item, locale, label);

  return (
    <NavLink
      key={item.key}
      to={item.to}
      title={hint}
      aria-current={active ? "page" : undefined}
      data-nav-status="enabled"
      className={() => `operatorShell__navItem${active ? " isActive" : ""}`}
    >
      <span>{label}</span>
    </NavLink>
  );
}

export default function OperatorLayout({
  children,
  title,
  lead,
  runtimeContext = DEFAULT_RUNTIME_CONTEXT,
}: OperatorLayoutProps): React.ReactElement {
  const location = useLocation();
  const { locale } = useLocale();
  const resolvedTitle = title ?? resolveTitle(location.pathname, locale);
  const resolvedLead = lead ?? resolveLead(location.pathname, locale);
  const showRuntimeContext = location.pathname.startsWith("/operator/fields") || location.pathname.startsWith("/operator/twin");
  const contextSource = runtimeContext.source === "authoritative-read-model"
    ? RUNTIME_CONTEXT_COPY.authoritativeSource
    : RUNTIME_CONTEXT_COPY.staticSource;
  const technicalItems = [
    {
      label: localizedText(RUNTIME_CONTEXT_COPY.source, locale),
      value: localizedText(contextSource, locale),
      monospace: false,
    },
    ...runtimeContext.details.map((detail) => ({
      label: localizedText(detail.label, locale),
      value: localizedText(detail.value, locale),
      monospace: Boolean(detail.monospace),
    })),
  ];

  return (
    <div
      className="operatorShell operatorRuntimeVisualRoot"
      data-surface="operator"
      data-layout="operator-runtime-console-shell"
      data-product-shell="foui-v1"
      data-runtime-context-source={runtimeContext.source}
      data-pfa2-locale={locale}
    >
      <aside className="operatorShell__sidebar" aria-label={localizedText(FOUI_SHELL_COPY.navigationAria, locale)}>
        <div className="operatorShell__brand" aria-label={localizedText(FOUI_SHELL_COPY.brand, locale)}>
          <span className="operatorShell__logoMark" aria-hidden="true" />
          <span>{localizedText(FOUI_SHELL_COPY.brand, locale)}</span>
        </div>

        <nav className="operatorShell__nav" aria-label={localizedText(FOUI_SHELL_COPY.navigationAria, locale)}>
          {OPERATOR_NAV_ITEMS.map((item) => renderNavItem(item, location.pathname, locale))}
        </nav>

        <div className="operatorShell__scope" aria-label={localizedText(FOUI_SHELL_COPY.boundaryLabel, locale)}>
          <span>{localizedText(FOUI_SHELL_COPY.productSurface, locale)}</span>
          <strong>{localizedText(FOUI_SHELL_COPY.brand, locale)}</strong>
          <span>{localizedText(FOUI_SHELL_COPY.boundaryLabel, locale)}</span>
          <strong>{localizedText(FOUI_SHELL_COPY.boundaryValue, locale)}</strong>
        </div>

        <p className="operatorShell__footer">{localizedText(FOUI_SHELL_COPY.footerNote, locale)}</p>
      </aside>

      <div className="operatorShell__mainWrap">
        <header className="operatorShell__topbar">
          <div className="operatorShell__heading">
            <span className="operatorShell__eyebrow">{localizedText(FOUI_SHELL_COPY.productSurface, locale)}</span>
            <h1 className="operatorShell__title">{resolvedTitle}</h1>
            <p className="operatorShell__lead">{resolvedLead}</p>
          </div>
          <div className="operatorShell__topActions">
            <LocaleToggle />
            <span className="operatorShell__readOnly">
              {localizedText(FOUI_SHELL_COPY.topbarPrimary, locale)}
              <small>{localizedText(FOUI_SHELL_COPY.topbarSecondary, locale)}</small>
            </span>
          </div>
        </header>

        {showRuntimeContext ? (
          <section className="operatorShell__runtimeContext" aria-label={localizedText(OPERATOR_SHELL_LABELS.productBoundaryAria, locale)}>
            <div className="operatorShell__runtimePrimary">
              <span className="operatorShell__eyebrow">{localizedText(RUNTIME_CONTEXT_COPY.currentContext, locale)}</span>
              <div className="operatorShell__runtimeHeadline">
                <strong>{localizedText(runtimeContext.mode, locale)}</strong>
                {runtimeContext.readOnly ? <span>{localizedText(RUNTIME_CONTEXT_COPY.readOnly, locale)}</span> : null}
              </div>
              <p>{localizedText(OPERATOR_SHELL_LABELS.boundaryValue, locale)}</p>
            </div>

            <ProductTechnicalDisclosure
              summary={localizedText(RUNTIME_CONTEXT_COPY.details, locale)}
              description={localizedText(RUNTIME_CONTEXT_COPY.detailsLead, locale)}
              items={technicalItems}
            />
          </section>
        ) : null}

        <main className="operatorShell__content">{children}</main>
      </div>
    </div>
  );
}
