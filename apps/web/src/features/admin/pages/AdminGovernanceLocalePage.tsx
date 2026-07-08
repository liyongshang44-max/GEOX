// apps/web/src/features/admin/pages/AdminGovernanceLocalePage.tsx
// Purpose: render formal Admin routes from typed bilingual governance copy.
// Boundary: the primitive renders static readback contracts only and creates no control, dispatch, service action, or backend mutation.

import React from "react";
import { Link } from "react-router-dom";
import { ProductBoundaryBanner, ProductDataTable, ProductEmptyState, ProductMetricTile, ProductPageHeader, ProductPageShell, ProductScopeBar, ProductSectionCard, ProductStateBlock, ProductStatusBadge, type ProductStateKind, type ProductStatus } from "../../../design-system/product";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";

type AdminCell = { text?: LocalizedCopy; neutral?: string; href?: string };
type AdminRow = { key: string; cells: AdminCell[] };
type AdminSection = { title: LocalizedCopy; subtitle: LocalizedCopy; caption: LocalizedCopy; headers: LocalizedCopy[]; rows: AdminRow[]; emptyTitle: LocalizedCopy; emptyDescription: LocalizedCopy };
type AdminMetricValue = React.ReactNode | LocalizedCopy;
type AdminMetric = { label: LocalizedCopy; value: AdminMetricValue; description: LocalizedCopy; source: LocalizedCopy; status?: ProductStatus };
type AdminFinalState = { kind: ProductStateKind; title: LocalizedCopy; description: LocalizedCopy };

export type AdminGovernanceLocaleConfig = {
  route: string;
  eyebrow: LocalizedCopy;
  title: LocalizedCopy;
  lead: LocalizedCopy;
  metadata: LocalizedCopy;
  nonclaim: LocalizedCopy;
  boundaryTitle: LocalizedCopy;
  boundaryDescription: LocalizedCopy;
  boundaryItems: LocalizedCopy[];
  mode: LocalizedCopy;
  metrics: AdminMetric[];
  sections: AdminSection[];
  finalState?: AdminFinalState;
};

const COMMON = {
  route: { zh: "路由", en: "Route" },
  mode: { zh: "模式", en: "Mode" },
  readOnly: { zh: "只读", en: "Read-only" },
  trueValue: { zh: "是", en: "true" },
  mobileNote: { zh: "在窄屏中可横向滚动查看治理回查列。", en: "On narrow screens, scroll horizontally to review governance readback columns." },
} as const satisfies Record<string, LocalizedCopy>;

function cellContent(cell: AdminCell, locale: "zh-CN" | "en-US"): React.ReactNode {
  const value = cell.neutral ?? (cell.text ? localizedText(cell.text, locale) : "--");
  return cell.href ? <Link to={cell.href}>{value}</Link> : value;
}

function isLocalizedCopy(value: AdminMetricValue): value is LocalizedCopy {
  return Boolean(value && typeof value === "object" && !React.isValidElement(value) && "zh" in value && "en" in value);
}

function metricValue(value: AdminMetricValue, locale: "zh-CN" | "en-US"): React.ReactNode {
  return isLocalizedCopy(value) ? localizedText(value, locale) : value;
}

export default function AdminGovernanceLocalePage({ config }: { config: AdminGovernanceLocaleConfig }): React.ReactElement {
  const { locale } = useLocale();
  const t = (copy: LocalizedCopy) => localizedText(copy, locale);

  return (
    <ProductPageShell surface="admin" width="wide" ariaLabel={t(config.title)} className="adminProductSurface" top={<ProductPageHeader eyebrow={t(config.eyebrow)} title={t(config.title)} lead={t(config.lead)} metadata={t(config.metadata)} nonclaim={t(config.nonclaim)} />}>
      <ProductBoundaryBanner tone="readOnly" title={t(config.boundaryTitle)} description={t(config.boundaryDescription)} items={config.boundaryItems.map(t)} />
      <ProductScopeBar surface="admin" items={[{ label: t(COMMON.route), value: config.route }, { label: t(COMMON.mode), value: t(config.mode) }, { label: t(COMMON.readOnly), value: t(COMMON.trueValue) }]} />
      <div className="adminProductMetricGrid">{config.metrics.map((metric) => <ProductMetricTile key={t(metric.label)} label={t(metric.label)} value={metricValue(metric.value, locale)} description={t(metric.description)} source={t(metric.source)} status={metric.status ? <ProductStatusBadge status={metric.status} /> : undefined} />)}</div>
      {config.sections.map((section) => (
        <ProductSectionCard key={t(section.title)} title={t(section.title)} subtitle={t(section.subtitle)}>
          <ProductDataTable<AdminRow>
            caption={t(section.caption)}
            rows={section.rows}
            getRowKey={(row) => row.key}
            emptyState={<ProductEmptyState surface="admin" title={t(section.emptyTitle)} description={t(section.emptyDescription)} />}
            mobileFallbackNote={t(COMMON.mobileNote)}
            columns={section.headers.map((header, index) => ({ key: `${index}`, header: t(header), render: (row: AdminRow) => cellContent(row.cells[index] ?? {}, locale) }))}
          />
        </ProductSectionCard>
      ))}
      {config.finalState ? <ProductStateBlock kind={config.finalState.kind} surface="admin" title={t(config.finalState.title)} description={t(config.finalState.description)} /> : null}
    </ProductPageShell>
  );
}
