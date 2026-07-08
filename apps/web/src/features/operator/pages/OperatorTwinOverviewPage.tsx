// apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx
// Purpose: render the API-backed bilingual read-only Operator Twin overview.
// Boundary: this page does not run forecasts, submit recommendations, approve, dispatch, or create AO-ACT tasks.

import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  buildOperatorTwinScopeQuery,
  fetchOperatorTwinOverview,
  fetchOperatorTwinSourceIndexInventory,
  type OperatorTwinOverviewV1,
  type OperatorTwinRequestScope,
  type OperatorTwinSourceIndexInventoryV1,
  type OperatorTwinScopePolicy,
} from "../../../api/operatorTwin";
import {
  ProductBoundaryBanner,
  ProductDataTable,
  ProductEmptyState,
  ProductErrorState,
  ProductLoadingState,
  ProductMetricTile,
  ProductPageHeader,
  ProductPageShell,
  ProductScopeBar,
  ProductSectionCard,
  ProductStatusBadge,
} from "../../../design-system/product";
import { localizedText, useLocale, type LocaleCode, type LocalizedCopy } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";
import { OPERATOR_TWIN_OVERVIEW_LOCALE_COPY as COPY } from "./operatorTwinOverviewLocaleCopy";

type RuntimeState = "loading" | "ready" | "empty" | "error";
type FieldRow = OperatorTwinOverviewV1["fields"][number];
type SourceRow = OperatorTwinSourceIndexInventoryV1["source_indexes"][number];

const overviewCopy = OPERATOR_FORMAL_SURFACE_COPY.runtimeOverview;

function scopeFromSearchParams(searchParams: URLSearchParams): OperatorTwinRequestScope {
  return {
    tenant_id: searchParams.get("tenant_id"),
    project_id: searchParams.get("project_id"),
    group_id: searchParams.get("group_id"),
  };
}

function formatTimestamp(value: number | null, locale: LocaleCode): string {
  if (value === null || value === undefined) return localizedText(COPY.none, locale);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function ScopePolicyCard({ policy, locale }: { policy: OperatorTwinScopePolicy; locale: LocaleCode }): React.ReactElement {
  const t = (copy: LocalizedCopy) => localizedText(copy, locale);
  return (
    <ProductSectionCard title={localizedText(overviewCopy.sections.scopePolicy, locale)} subtitle={t(COPY.scopePolicyLead)}>
      <ProductScopeBar surface="operator" items={[
        { label: t(COPY.scopeApplied), value: policy.scope_applied ? "true" : "false" },
        { label: t(COPY.missingReason), value: policy.missing_reason ?? t(COPY.none) },
        { label: t(COPY.acceptedKeys), value: policy.accepted_scope_keys.join(", ") || t(COPY.none) },
      ]} />
    </ProductSectionCard>
  );
}

function SourceIndexInventoryCard({ inventory, loadState, error, locale }: {
  inventory: OperatorTwinSourceIndexInventoryV1 | null;
  loadState: "idle" | "loading" | "ready" | "error";
  error: string | null;
  locale: LocaleCode;
}): React.ReactElement {
  const t = (copy: LocalizedCopy) => localizedText(copy, locale);
  const title = localizedText(overviewCopy.sections.sourceIndexInventory, locale);

  if (loadState === "loading") return <ProductSectionCard title={title}><ProductLoadingState label={t(COPY.sourceLoading)} /></ProductSectionCard>;
  if (loadState === "error") return <ProductSectionCard title={title}><ProductErrorState title={t(COPY.sourceUnavailable)} message={error ?? t(COPY.sourceUnavailable)} /></ProductSectionCard>;
  if (!inventory) return <ProductSectionCard title={title}><ProductEmptyState title={t(COPY.noSourceInventory)} description={t(COPY.noSourceInventoryLead)} /></ProductSectionCard>;

  return (
    <ProductSectionCard title={title} subtitle={t(COPY.sourceInventoryLead)}>
      <div className="operatorProductMetricGrid">
        <ProductMetricTile label={t(COPY.tables)} value={inventory.summary.table_count} source="operator_twin_source_index_inventory_v1" />
        <ProductMetricTile label={t(COPY.availableTables)} value={inventory.summary.available_table_count} source="operator_twin_source_index_inventory_v1" />
        <ProductMetricTile label={t(COPY.rows)} value={inventory.summary.total_row_count} source="operator_twin_source_index_inventory_v1" />
      </div>
      <ProductDataTable<SourceRow>
        caption={t(COPY.sourceCaption)}
        rows={inventory.source_indexes}
        getRowKey={(row) => row.table_name}
        mobileFallbackNote={t(COPY.sourceMobile)}
        columns={[
          { key: "source", header: t(COPY.sourceIndex), render: (row) => <><strong>{row.label}</strong><br /><small>{row.table_name}</small></> },
          { key: "available", header: t(COPY.available), render: (row) => <ProductStatusBadge status={row.available ? "available" : "unavailable"} label={row.available ? t(COPY.available) : t(COPY.unavailableState)} /> },
          { key: "rows", header: t(COPY.rows), render: (row) => row.row_count },
          { key: "latest", header: t(COPY.latestTimestamp), render: (row) => formatTimestamp(row.latest_ts_ms, locale) },
          { key: "scope", header: t(COPY.scopeColumns), render: (row) => row.scope_columns_present.join(", ") || t(COPY.none) },
          { key: "evidence", header: t(COPY.evidenceRefs), render: (row) => row.latest_evidence_refs.join(", ") || t(COPY.none) },
        ]}
      />
    </ProductSectionCard>
  );
}

export default function OperatorTwinOverviewPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const { locale } = useLocale();
  const t = React.useCallback((copy: LocalizedCopy) => localizedText(copy, locale), [locale]);
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [searchParams]);
  const scopeQueryString = React.useMemo(() => buildOperatorTwinScopeQuery(scope), [scope]);
  const [state, setState] = React.useState<RuntimeState>("loading");
  const [overview, setOverview] = React.useState<OperatorTwinOverviewV1 | null>(null);
  const [inventory, setInventory] = React.useState<OperatorTwinSourceIndexInventoryV1 | null>(null);
  const [inventoryLoadState, setInventoryLoadState] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const [inventoryError, setInventoryError] = React.useState<string | null>(null);
  const [errorText, setErrorText] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setState("loading");
    setErrorText("");
    setOverview(null);
    setInventory(null);
    setInventoryLoadState("loading");
    setInventoryError(null);

    void fetchOperatorTwinOverview(scope)
      .then((response) => {
        if (!alive) return;
        const next = response.operator_twin_overview_v1;
        setOverview(next);
        setState(next.fields.length > 0 ? "ready" : "empty");
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setState("error");
        setErrorText(error instanceof Error ? error.message : t(COPY.unavailable));
      });

    void fetchOperatorTwinSourceIndexInventory(scope)
      .then((response) => {
        if (!alive) return;
        setInventory(response.operator_twin_source_index_inventory_v1);
        setInventoryLoadState("ready");
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setInventoryLoadState("error");
        setInventoryError(error instanceof Error ? error.message : t(COPY.sourceUnavailable));
      });

    return () => { alive = false; };
  }, [scope, t]);

  return (
    <ProductPageShell
      surface="operator"
      width="wide"
      ariaLabel={t(COPY.pageAria)}
      className="operatorProductSurface"
      top={<ProductPageHeader
        eyebrow={localizedText(overviewCopy.eyebrow, locale)}
        title={localizedText(overviewCopy.title, locale)}
        lead={localizedText(overviewCopy.hero, locale)}
        metadata={t(COPY.metadata)}
        nonclaim={localizedText(overviewCopy.boundary, locale)}
      />}
      aside={<ProductSectionCard title={t(COPY.nonclaimsTitle)} subtitle={t(COPY.nonclaimsLead)}>
        <div className="operatorProductStatusStack">
          <ProductStatusBadge status="notConnected" label={t(COPY.liveDevice)} />
          <ProductStatusBadge status="notOnline" label={t(COPY.productionGateway)} />
          <ProductStatusBadge status="disabled" label={t(COPY.controlledExecution)} />
          <ProductStatusBadge status="disabled" label={t(COPY.aoAct)} />
        </div>
      </ProductSectionCard>}
    >
      <ProductBoundaryBanner tone="readOnly" title={t(COPY.boundaryTitle)} description={t(COPY.boundaryDescription)} items={[t(COPY.replayReview), t(COPY.noGatewayAuthority), t(COPY.noMutation)]} />

      {state === "loading" ? <ProductLoadingState label={localizedText(overviewCopy.loading, locale)} description={t(COPY.loadingDescription)} /> : null}
      {state === "error" ? <ProductErrorState title={localizedText(overviewCopy.error, locale)} message={errorText || t(COPY.unavailable)} /> : null}
      {state === "empty" ? <ProductEmptyState title={localizedText(overviewCopy.empty, locale)} description={t(COPY.noEntries)} /> : null}

      {overview ? <>
        <ProductScopeBar surface="operator" items={[
          { label: t(COPY.tenant), value: scope.tenant_id || t(COPY.defaultValue) },
          { label: t(COPY.project), value: scope.project_id || t(COPY.defaultValue) },
          { label: t(COPY.group), value: scope.group_id || t(COPY.defaultValue) },
          { label: t(COPY.runtimeMode), value: t(COPY.replayReview) },
        ]} />

        <div className="operatorProductMetricGrid">
          <ProductMetricTile label={t(COPY.fieldEntries)} value={overview.fields.length} description={t(COPY.fieldEntriesLead)} source="operator_twin_overview_v1" status={<ProductStatusBadge status="readOnly" />} />
          <ProductMetricTile label={t(COPY.dataGaps)} value={overview.data_gaps.length} description={t(COPY.dataGapsLead)} source="operator_twin_overview_v1" />
          <ProductMetricTile label={t(COPY.boundaryRules)} value={overview.boundary_rules.length} description={t(COPY.boundaryRulesLead)} source="operator_twin_overview_v1" />
        </div>

        <ScopePolicyCard policy={overview.scope_policy} locale={locale} />
        <SourceIndexInventoryCard inventory={inventory} loadState={inventoryLoadState} error={inventoryError} locale={locale} />

        <ProductSectionCard title={localizedText(overviewCopy.sections.fieldMatrix, locale)} subtitle={t(COPY.fieldMatrixLead)}>
          <ProductDataTable<FieldRow>
            caption={t(COPY.fieldMatrixCaption)}
            rows={overview.fields}
            getRowKey={(row) => row.field_id}
            emptyState={<ProductEmptyState title={t(COPY.noFieldRows)} description={t(COPY.noFieldRowsLead)} />}
            mobileFallbackNote={t(COPY.mobileField)}
            columns={[
              { key: "field", header: localizedText(overviewCopy.table.field, locale), render: (row) => <><strong>{row.field_name}</strong><br /><small>{row.field_id}</small></> },
              { key: "state", header: localizedText(overviewCopy.table.currentState, locale), render: (row) => row.current_state_text },
              { key: "risk", header: localizedText(overviewCopy.table.risk, locale), render: (row) => row.risk_text },
              { key: "confidence", header: localizedText(overviewCopy.table.confidence, locale), render: (row) => row.confidence_text },
              { key: "coverage", header: localizedText(overviewCopy.table.dataCoverage, locale), render: (row) => row.data_coverage_text },
              { key: "forecast", header: localizedText(overviewCopy.table.forecastWindow, locale), render: (row) => row.forecast_window_text },
              { key: "entry", header: localizedText(overviewCopy.table.entry, locale), render: (row) => <Link data-link="operator-field-twin-workspace" data-field-id={row.field_id} to={row.twin_href + scopeQueryString}>{localizedText(overviewCopy.table.openFieldRuntime, locale)}</Link> },
            ]}
          />
        </ProductSectionCard>

        <ProductSectionCard title={localizedText(overviewCopy.sections.dataGaps, locale)} subtitle={t(COPY.coverageLead)}>
          {overview.data_gaps.length ? <ul className="operatorProductList">{overview.data_gaps.map((gap) => <li key={gap.gap_code}>{gap.label}</li>)}</ul> : <ProductEmptyState title={t(COPY.noGapRows)} description={t(COPY.noGapRowsLead)} />}
        </ProductSectionCard>

        <ProductSectionCard title={localizedText(overviewCopy.sections.humanBoundary, locale)} subtitle={t(COPY.humanLead)}>
          {overview.boundary_rules.length ? <ul className="operatorProductList">{overview.boundary_rules.map((rule) => <li key={rule.rule_code}>{rule.label}</li>)}</ul> : <ProductEmptyState title={t(COPY.noBoundaryRules)} description={t(COPY.noBoundaryRulesLead)} />}
        </ProductSectionCard>
      </> : null}
    </ProductPageShell>
  );
}
