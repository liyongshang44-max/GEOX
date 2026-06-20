// apps/web/src/features/operator/pages/OperatorFieldTwinEvidencePage.tsx
// Purpose: render the H25 read-only evidence and data quality page for Operator Twin.
// Boundary: this page reviews evidence quality only; it does not write facts, submit recommendations, perform control actions.

import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  buildOperatorTwinScopeQuery,
  fetchOperatorFieldTwinEvidenceQuality,
  type OperatorFieldTwinEvidenceQualityV1,
  type OperatorTwinRequestScope,
} from "../../../api/operatorTwin";
import EvidenceTracePanel from "../components/EvidenceTracePanel";
import DataCoverageMatrix from "../components/DataCoverageMatrix";
import QualitySummaryPanel from "../components/QualitySummaryPanel";
import LowQualityReasonList from "../components/LowQualityReasonList";

type RuntimeState = "loading" | "ready" | "error";

function scopeFromSearchParams(searchParams: URLSearchParams): OperatorTwinRequestScope {
  return {
    tenant_id: searchParams.get("tenant_id"),
    project_id: searchParams.get("project_id"),
    group_id: searchParams.get("group_id"),
  };
}

function SourceIndexInventoryPanel({ evidence }: { evidence: OperatorFieldTwinEvidenceQualityV1 }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="SourceIndexInventory">
      <p className="operatorEyebrow">source_index_inventory</p>
      <h3>Source Index Inventory</h3>
      <table className="operatorTable">
        <thead><tr><th>source</th><th>available</th><th>rows</th><th>missing reason</th><th>evidence_refs</th></tr></thead>
        <tbody>
          {evidence.source_index_inventory.source_indexes.map((row) => (
            <tr key={row.table_name}>
              <td>{row.table_name}</td><td>{row.available ? "true" : "false"}</td><td>{row.row_count}</td>
              <td>{row.missing_reason ?? "none"}</td><td>{row.latest_evidence_refs.join(", ") || "none"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function BoundaryRulesPanel({ evidence }: { evidence: OperatorFieldTwinEvidenceQualityV1 }): React.ReactElement {
  return (
    <article className="operatorPanel operatorBoundaryNotice" data-card="BoundaryRules">
      <h3>Boundary Rules</h3>
      <ul className="operatorList">
        {evidence.boundary_rules.map((rule) => <li key={rule.rule_code}>{rule.rule_code}：{rule.label} · evidence_refs: policy</li>)}
      </ul>
    </article>
  );
}

export default function OperatorFieldTwinEvidencePage(): React.ReactElement {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [searchParams]);
  const scopeQueryString = React.useMemo(() => buildOperatorTwinScopeQuery(scope), [scope]);
  const fieldId = String(params.fieldId ?? "").trim() || "field_c8_demo";
  const [state, setState] = React.useState<RuntimeState>("loading");
  const [evidence, setEvidence] = React.useState<OperatorFieldTwinEvidenceQualityV1 | null>(null);
  const [errorText, setErrorText] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setState("loading");
    setEvidence(null);
    setErrorText("");

    void fetchOperatorFieldTwinEvidenceQuality(fieldId, scope)
      .then((response) => {
        if (!alive) return;
        setEvidence(response.operator_field_twin_evidence_quality_v1);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setErrorText(error instanceof Error ? error.message : "OPERATOR_FIELD_TWIN_EVIDENCE_QUALITY_LOAD_FAILED");
        setState("error");
      });

    return () => { alive = false; };
  }, [fieldId, scope]);

  return (
    <section className="operatorWorkbenchPage" data-surface="operator-twin" data-page="operator-field-twin-evidence-quality" data-contract="operator_field_twin_evidence_quality_v1">
      <div className="operatorWorkbenchHero">
        <div>
          <p className="operatorEyebrow">Operator Evidence</p>
          <h2>证据与数据质量</h2>
          <p>用于复核当前 Twin 判断的证据链、数据覆盖率、低质量原因和数据缺口。本页只读，不生成 recommendation，不审批，不创建 task。</p>
          <span className="operatorPill">read-only evidence quality</span>
        </div>
        <div className="operatorWorkbenchHeroActions">
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + scopeQueryString}>Workspace</Link>
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/forecast" + scopeQueryString}>Forecast</Link>
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/scenarios" + scopeQueryString}>Scenarios</Link>
          <Link className="operatorActionLink" to={"/operator/twin/fields/" + encodeURIComponent(fieldId) + "/evidence" + scopeQueryString}>Evidence</Link>
        </div>
      </div>

      {state === "loading" ? <div className="operatorPanel">Evidence Quality 数据加载中...</div> : null}
      {state === "error" ? <div className="operatorPanel">Evidence Quality 数据加载失败：{errorText}</div> : null}

      {evidence ? (
        <div className="operatorPanelGrid">
          <EvidenceTracePanel items={evidence.evidence_trace_v1.trace_items} />
          <DataCoverageMatrix rows={evidence.data_coverage_matrix_v1.rows} />
          <QualitySummaryPanel summary={evidence.quality_summary} />
          <SourceIndexInventoryPanel evidence={evidence} />
          <LowQualityReasonList reasons={evidence.quality_summary.low_quality_reasons} gaps={evidence.data_gaps} />
          <BoundaryRulesPanel evidence={evidence} />
        </div>
      ) : null}
    </section>
  );
}
