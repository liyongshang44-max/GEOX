// apps/web/src/layouts/OperatorLayout.tsx
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import LocaleToggle from "../components/common/LocaleToggle";
import { ProductTechnicalDisclosure } from "../design-system/product";
import { localizedText, useLocale, type LocaleCode, type LocalizedCopy } from "../lib/locale";
import { OPERATOR_SHELL_LABELS, type ShellNavCopy } from "../lib/productSurfaceLabels";
import "../styles/operatorShell.css";
import "../styles/operatorShellApple.css";

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
  key: "overview" | "fields";
  copy: ShellNavCopy;
  to: string;
};

const OPERATOR_NAV_ITEMS: OperatorNavItem[] = [
  { key: "overview", copy: OPERATOR_SHELL_LABELS.nav.overview, to: "/operator/twin" },
  { key: "fields", copy: OPERATOR_SHELL_LABELS.nav.fields, to: "/operator/fields" },
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
  if (item.key === "overview") return pathname === "/operator/twin" || pathname === "/operator";
  return pathname.startsWith("/operator/fields") || pathname.startsWith("/operator/twin/fields/");
}

function resolveTitle(pathname: string, locale: LocaleCode): string {
  if (pathname === "/operator/twin") return localizedText(OPERATOR_SHELL_LABELS.titles.overview, locale);
  if (pathname === "/operator/twin/production-workflow") return localizedText(OPERATOR_SHELL_LABELS.titles.workflow, locale);
  if (pathname === "/operator/twin/gateway-demo") return localizedText(OPERATOR_SHELL_LABELS.titles.gateway, locale);
  if (pathname.startsWith("/operator/fields") || pathname.startsWith("/operator/twin/fields/")) return localizedText(OPERATOR_SHELL_LABELS.titles.fieldRuntime, locale);
  if (pathname.startsWith("/operator/twin/traces/")) return localizedText(OPERATOR_SHELL_LABELS.titles.auditTrace, locale);
  return localizedText(OPERATOR_SHELL_LABELS.titles.fallback, locale);
}

function resolveLead(pathname: string, locale: LocaleCode): string {
  if (pathname === "/operator/twin") return localizedText(OPERATOR_SHELL_LABELS.leads.overview, locale);
  if (pathname === "/operator/twin/production-workflow") return localizedText(OPERATOR_SHELL_LABELS.leads.workflow, locale);
  if (pathname === "/operator/twin/gateway-demo") return localizedText(OPERATOR_SHELL_LABELS.leads.gateway, locale);
  if (pathname.startsWith("/operator/fields") || pathname.startsWith("/operator/twin/fields/")) return localizedText(OPERATOR_SHELL_LABELS.leads.fieldRuntime, locale);
  if (pathname.startsWith("/operator/twin/traces/")) return localizedText(OPERATOR_SHELL_LABELS.leads.auditTrace, locale);
  return localizedText(OPERATOR_SHELL_LABELS.leads.fallback, locale);
}

function navHint(item: OperatorNavItem, locale: LocaleCode, label: string): string {
  if (locale === "zh-CN" && item.key === "overview") return "查看只读运行总览";
  if (locale === "zh-CN" && item.key === "fields") return "查看规范地块运行列表与地块级审查标签";
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
      data-runtime-context-source={runtimeContext.source}
      data-pfa2-locale={locale}
    >
      <aside className="operatorShell__sidebar" aria-label={localizedText(OPERATOR_SHELL_LABELS.navigationAria, locale)}>
        <div className="operatorShell__brand" aria-label={localizedText(OPERATOR_SHELL_LABELS.brand, locale)}>
          <span className="operatorShell__logoMark" aria-hidden="true" />
          <span>{localizedText(OPERATOR_SHELL_LABELS.brand, locale)}</span>
        </div>

        <nav className="operatorShell__nav" aria-label={localizedText(OPERATOR_SHELL_LABELS.navigationAria, locale)}>
          {OPERATOR_NAV_ITEMS.map((item) => renderNavItem(item, location.pathname, locale))}
        </nav>

        <div className="operatorShell__scope" aria-label={localizedText(OPERATOR_SHELL_LABELS.productBoundaryAria, locale)}>
          <span>{localizedText(OPERATOR_SHELL_LABELS.productSurface, locale)}</span>
          <strong>{localizedText(OPERATOR_SHELL_LABELS.titles.fallback, locale)}</strong>
          <span>{localizedText(OPERATOR_SHELL_LABELS.boundaryLabel, locale)}</span>
          <strong>{localizedText(OPERATOR_SHELL_LABELS.boundaryValue, locale)}</strong>
        </div>

        <p className="operatorShell__footer">{localizedText(OPERATOR_SHELL_LABELS.footerNote, locale)}</p>
      </aside>

      <div className="operatorShell__mainWrap">
        <header className="operatorShell__topbar">
          <div className="operatorShell__heading">
            <span className="operatorShell__eyebrow">{localizedText(OPERATOR_SHELL_LABELS.titles.fallback, locale)}</span>
            <h1 className="operatorShell__title">{resolvedTitle}</h1>
            <p className="operatorShell__lead">{resolvedLead}</p>
          </div>
          <div className="operatorShell__topActions">
            <LocaleToggle />
            <span className="operatorShell__readOnly">
              {localizedText(OPERATOR_SHELL_LABELS.topbarReadonly, locale)}
              <small>{localizedText(OPERATOR_SHELL_LABELS.runtimeShell, locale)}</small>
            </span>
          </div>
        </header>

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

        <main className="operatorShell__content">{children}</main>
      </div>
    </div>
  );
}
