// apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx
// Purpose: render the API-backed read-only Operator Twin overview with PFE-2 product primitives.
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
import { localizedText, useLocale, type LocaleCode } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";

type RuntimeState = "loading" | "ready" | "empty" | "error";
type OperatorTwinFieldRow = OperatorTwinOverviewV1["fields"][number];
type OperatorTwinSourceIndexRow = OperatorTwinSourceIndexInventoryV1["source_indexes"][number];

const overviewCopy = OPERATOR_FORMAL_SURFACE_COPY.runtimeOverview;

function scopeFromSearchParams(searchParams: URLSearchParams): OperatorTwinRequestScope {
  return {
    tenant_id: searchParams.get("tenant_id"),
    project_id: searchParams.get("project_id"),
    group_id: searchParams.get("group_id"),
  };
}

function formatInventoryTimestamp(value: number | null): string {
  if (value === null || value === undefined) return "none";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function SourceIndexInventoryCard({
  inventory,
  loadState,
  error,
  locale,
}: {
  inventory: OperatorTwinSourceIndexInventoryV1 | null;
  loadState: "idle" | "loading" | "ready" | "error";
  error: string | null;
  locale: LocaleCode;
}): React.ReactElement {
  const title = localizedText(overviewCopy.sections.sourceIndexInventory, locale);

  if (loadState === "loading") {
    return <ProductSectionCard title={title}><ProductLoadingState label="Loading source index inventory" /></ProductSectionCard>;
  }

  if (loadState === "error") {
    return <ProductSectionCard title={title}><ProductErrorState title="Source index inventory unavailable" message={error ?? "OPERATOR_TWIN_SOURCE_INDEX_INVENTORY_UNAVAILABLE"} /></ProductSectionCard>;
  }

  if (!inventory) {
    return <ProductSectionCard title={title}><ProductEmptyState title="No source index inventory" description="Source index inventory has not been loaded." /></ProductSectionCard>;
  }

  return (
    <ProductSectionCard title={title} subtitle="Read-only source identity, timestamps, and evidence reference counts.">
      <div className="operatorProductMetricGrid">
        <ProductMetricTile label="Tables" value={inventory.summary.table_count} source="operator_twin_source_index_inventory_v1" />
        <ProductMetricTile label="Available tables" value={inventory.summary.available_table_count} source="operator_twin_source_index_inventory_v1" />
        <ProductMetricTile label="Rows" value={inventory.summary.total_row_count} source="operator_twin_source_index_inventory_v1" />
      </div>
      <ProductDataTable<OperatorTwinSourceIndexRow>
        caption="Operator Twin source index inventory"
        rows={inventory.source_indexes}
        getRowKey={(row) => row.table_name}
        mobileFallbackNote="Scroll horizontally to review source identity columns."
        columns={[
          { key: "source", header: "Source index", render: (row) => <><strong>{row.label}</strong><br /><small>{row.table_name}</small></> },
          { key: "available", header: "Available", render: (row) => <ProductStatusBadge status={row.available ? "available" : "unavailable"} label={row.available ? "Available" : "Unavailable"} /> },
          { key: "rows", header: "Rows", render: (row) => row.row_count },
          { key: "latest", header: "Latest timestamp", render: (row) => formatInventoryTimestamp(row.latest_ts_ms) },
          { key: "scope", header: "Scope columns", render: (row) => row.scope_columns_present.join(", ") || "none" },
          { key: "evidence", header: "Evidence refs", render: (row) => row.latest_evidence_refs.length > 0 ? row.latest_evidence_refs.join(", ") : "none" },
        ]}
      />
    </ProductSectionCard>
  );
}

function ScopePolicyCard({ policy, locale }: { policy: OperatorTwinScopePolicy; locale: LocaleCode }): React.ReactElement {
  return (
    <ProductSectionCard title={localizedText(overviewCopy.sections.scopePolicy, locale)} subtitle="Scope policy is displayed for review only.">
      <ProductScopeBar
        surface="operator"
        items={[
          { label: "Scope applied", value: policy.scope_applied ? "true" : "false" },
          { label: "Missing reason", value: policy.missing_reason ?? "none" },
          { label: "Accepted keys", value: policy.accepted_scope_keys.join(", ") || "none" },
        ]}
      />
    </ProductSectionCard>
  );
}

export default function OperatorTwinOverviewPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const { locale } = useLocale();
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
        const nextOverview = response.operator_twin_overview_v1;
        setOverview(nextOverview);
        setState(nextOverview.fields.length > 0 ? "ready" : "empty");
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setState("error");
        setErrorText(error instanceof Error ? error.message : "Operator Twin overview unavailable.");
      });

    void fetchOperatorTwinSourceIndexInventory(scope)
      .then((response) => {
        if (!alive) return;
        setInventory(response.operator_twin_source_index_inventory_v1);
        setInventoryLoadState("ready");
        setInventoryError(null);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setInventory(null);
        setInventoryLoadState("error");
        setInventoryError(error instanceof Error ? error.message : "OPERATOR_TWIN_SOURCE_INDEX_INVENTORY_FAILED");
      });

    return () => { alive = false; };
  }, [scope]);

  return (
    <ProductPageShell
      surface="operator"
      width="wide"
      ariaLabel="Operator Runtime Console overview"
      className="operatorProductSurface"
      top={
        <ProductPageHeader
          eyebrow="Operator Runtime Console"
          title="Operator Runtime Console"
          lead="Read-only runtime review surface for replay-backed Operator Twin snapshots and field runtime entry."
          metadata="Source: operator_twin_overview_v1 / replay-backed snapshot context"
          nonclaim="Live Device: Not connected. Production Gateway: Not online. Field Pilot: Not started. Controlled Execution: Disabled. AO-ACT Dispatch: Disabled."
        />
      }
      aside={
        <ProductSectionCard title="Runtime nonclaims" subtitle="Professional console shell without live runtime authority.">
          <div className="operatorProductStatusStack">
            <ProductStatusBadge status="notConnected" label="Live Device: Not connected" />
            <ProductStatusBadge status="notOnline" label="Production Gateway: Not online" />
            <ProductStatusBadge status="disabled" label="Controlled Execution: Disabled" />
            <ProductStatusBadge status="disabled" label="AO-ACT Dispatch: Disabled" />
          </div>
        </ProductSectionCard>
      }
    >
      <ProductBoundaryBanner
        tone="readOnly"
        title="Read-only runtime review boundary"
        description="This Operator surface supports view, review, inspect, compare, navigate, and trace readback only. It does not control devices or external systems."
        items={["Replay-backed review", "No production gateway authority", "No task or model mutation"]}
      />

      {state === "loading" ? <ProductLoadingState label={localizedText(overviewCopy.loading, locale)} description="Loading Operator Twin review data." /> : null}
      {state === "error" ? <ProductErrorState title={localizedText(overviewCopy.error, locale)} message={errorText || "Operator Twin overview unavailable."} /> : null}
      {state === "empty" ? <ProductEmptyState title={localizedText(overviewCopy.empty, locale)} description="No operator field runtime entries are available for this scope." /> : null}

      {overview ? (
        <>
          <ProductScopeBar
            surface="operator"
            items={[
              { label: "Tenant", value: scope.tenant_id || "default" },
              { label: "Project", value: scope.project_id || "default" },
              { label: "Group", value: scope.group_id || "default" },
              { label: "Runtime mode", value: "Replay-backed review" },
            ]}
          />

          <div className="operatorProductMetricGrid">
            <ProductMetricTile label="Field runtime entries" value={overview.fields.length} description="Fields exposed as read-only runtime review links." source="operator_twin_overview_v1" status={<ProductStatusBadge status="readOnly" />} />
            <ProductMetricTile label="Data gaps" value={overview.data_gaps.length} description="Displayed for review and traceability only." source="operator_twin_overview_v1" />
            <ProductMetricTile label="Boundary rules" value={overview.boundary_rules.length} description="Nonclaims and forbidden mutation reminders." source="operator_twin_overview_v1" />
          </div>

          <ScopePolicyCard policy={overview.scope_policy} locale={locale} />
          <SourceIndexInventoryCard inventory={inventory} loadState={inventoryLoadState} error={inventoryError} locale={locale} />

          <ProductSectionCard title={localizedText(overviewCopy.sections.fieldMatrix, locale)} subtitle="Field runtime entry links use canonical Operator Field Runtime routes.">
            <ProductDataTable<OperatorTwinFieldRow>
              caption="Operator field runtime matrix"
              rows={overview.fields}
              getRowKey={(row) => row.field_id}
              emptyState={<ProductEmptyState title="No field runtime rows" description="No field runtime review entries are available." />}
              mobileFallbackNote="Scroll horizontally to inspect field runtime source columns."
              columns={[
                { key: "field", header: localizedText(overviewCopy.table.field, locale), render: (row) => <><strong>{row.field_name}</strong><br /><small>{row.field_id}</small></> },
                { key: "state", header: localizedText(overviewCopy.table.currentState, locale), render: (row) => row.current_state_text },
                { key: "risk", header: localizedText(overviewCopy.table.risk, locale), render: (row) => row.risk_text },
                { key: "confidence", header: localizedText(overviewCopy.table.confidence, locale), render: (row) => row.confidence_text },
                { key: "coverage", header: localizedText(overviewCopy.table.dataCoverage, locale), render: (row) => row.data_coverage_text },
                { key: "forecast", header: localizedText(overviewCopy.table.forecastWindow, locale), render: (row) => row.forecast_window_text },
                { key: "entry", header: localizedText(overviewCopy.table.entry, locale), render: (row) => <Link data-link="operator-field-twin-workspace" data-field-id={row.field_id} to={row.twin_href + scopeQueryString}>Open Field Runtime</Link> },
              ]}
            />
          </ProductSectionCard>

          <ProductSectionCard title={localizedText(overviewCopy.sections.dataGaps, locale)} subtitle="Coverage gaps are review metadata, not work orders.">
            {overview.data_gaps.length ? <ul className="operatorProductList">{overview.data_gaps.map((gap) => <li key={gap.gap_code}>{gap.label}</li>)}</ul> : <ProductEmptyState title="No data gap rows" description="No data gap metadata is available for this scope." />}
          </ProductSectionCard>

          <ProductSectionCard title={localizedText(overviewCopy.sections.humanBoundary, locale)} subtitle="Human boundary rules are displayed as nonclaims.">
            {overview.boundary_rules.length ? <ul className="operatorProductList">{overview.boundary_rules.map((rule) => <li key={rule.rule_code}>{rule.label}</li>)}</ul> : <ProductEmptyState title="No boundary rules" description="No boundary metadata is available for this scope." />}
          </ProductSectionCard>
        </>
      ) : null}
    </ProductPageShell>
  );
}
