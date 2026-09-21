import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  fetchOperatorTwinOverview,
  type OperatorTwinOverviewField,
  type OperatorTwinRequestScope,
} from "../../../api/operatorTwin";
import { useLocale } from "../../../lib/locale";
import "../../../styles/fouiFieldOperations.css";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function scopeFromSearchParams(searchParams: URLSearchParams): OperatorTwinRequestScope {
  return {
    tenant_id: searchParams.get("tenant_id"),
    project_id: searchParams.get("project_id"),
    group_id: searchParams.get("group_id"),
  };
}

export default function FieldIntelligenceFieldsPage(): React.ReactElement {
  const { locale } = useLocale();
  const english = locale === "en-US";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedFieldId = text(searchParams.get("field_id"));
  const scope = React.useMemo(() => scopeFromSearchParams(searchParams), [searchParams]);
  const [fields, setFields] = React.useState<OperatorTwinOverviewField[]>([]);
  const [fieldId, setFieldId] = React.useState(requestedFieldId);
  const [seasonId, setSeasonId] = React.useState(text(searchParams.get("season_id")));
  const [zoneId, setZoneId] = React.useState(text(searchParams.get("zone_id")));
  const [loadingFields, setLoadingFields] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setLoadingFields(true);
    setError("");
    fetchOperatorTwinOverview(scope)
      .then((response) => {
        if (!active) return;
        const next = Array.isArray(response.operator_twin_overview_v1?.fields)
          ? response.operator_twin_overview_v1.fields
          : [];
        setFields(next);
        setFieldId((current) => {
          if (current && next.some((field) => field.field_id === current)) return current;
          return next[0]?.field_id || "";
        });
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setFields([]);
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => { if (active) setLoadingFields(false); });
    return () => { active = false; };
  }, [scope]);

  const selectedField = fields.find((field) => field.field_id === fieldId) ?? null;
  const ready = Boolean(fieldId && seasonId.trim() && zoneId.trim());

  function openField(): void {
    if (!ready) return;
    const query = new URLSearchParams({
      season_id: seasonId.trim(),
      zone_id: zoneId.trim(),
    });
    navigate(`/operator/field-intelligence/${encodeURIComponent(fieldId)}?${query.toString()}`);
  }

  return (
    <div className="fouiPage" data-foui-surface="field-intelligence-selector">
      <section className="fouiHero">
        <div>
          <span className="fouiEyebrow">FIELD INTELLIGENCE / MCFT</span>
          <h2>{english ? "Open the exact field world." : "进入精确的田块世界。"}</h2>
          <p>{english ? "Visible fields come from the existing Operator Twin overview. Canonical MCFT reads begin only after field, season, and zone are all explicit." : "可见田块来自现有 Operator Twin overview；只有 field、season、zone 三个范围轴都明确后，才开始读取 canonical MCFT。"}</p>
        </div>
      </section>

      <section className="fouiPanel">
        <header className="fouiPanelHeader">
          <div><span className="fouiEyebrow">EXACT SCOPE</span><h3>{english ? "Choose field context" : "选择田块上下文"}</h3></div>
          <span className="fouiStatePill">{english ? "READ-ONLY · GET" : "只读 · GET"}</span>
        </header>

        <div className="fouiScopeForm">
          <label>
            <span>{english ? "Field" : "田块"}</span>
            <select value={fieldId} onChange={(event) => setFieldId(event.target.value)} disabled={loadingFields}>
              <option value="">{loadingFields ? (english ? "Loading…" : "加载中…") : (english ? "Select field" : "选择田块")}</option>
              {fields.map((field) => (
                <option key={field.field_id} value={field.field_id}>
                  {field.field_name || field.field_id} · {field.field_id}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>season_id</span>
            <input value={seasonId} onChange={(event) => setSeasonId(event.target.value)} placeholder={english ? "Exact season identifier" : "输入精确季节标识"} />
          </label>
          <label>
            <span>zone_id</span>
            <input value={zoneId} onChange={(event) => setZoneId(event.target.value)} placeholder={english ? "Exact zone identifier" : "输入精确分区标识"} />
          </label>
        </div>

        {selectedField ? (
          <div className="fouiFieldScopePreview">
            <article><span>{english ? "Current state" : "当前状态"}</span><strong>{selectedField.current_state_text || "—"}</strong></article>
            <article><span>{english ? "Risk / limitation" : "风险 / 限制"}</span><strong>{selectedField.risk_text || "—"}</strong></article>
            <article><span>{english ? "Confidence" : "置信度"}</span><strong>{selectedField.confidence_text || "—"}</strong></article>
            <article><span>{english ? "Data coverage" : "数据覆盖"}</span><strong>{selectedField.data_coverage_text || "—"}</strong></article>
            <article><span>{english ? "Forecast window" : "预测窗口"}</span><strong>{selectedField.forecast_window_text || "—"}</strong></article>
            <article><span>{english ? "Next step" : "下一步"}</span><strong>{selectedField.next_step_text || "—"}</strong></article>
          </div>
        ) : null}

        <div className="fouiScopeFooter">
          <p>{english ? "Season and zone remain explicit because the current Operator overview does not establish those canonical MCFT scope axes. The product layer does not guess them." : "当前 Operator overview 不建立 canonical MCFT 的 season 与 zone 范围轴，因此两者保持显式输入；产品层不会猜测。"}</p>
          <button type="button" className="fouiButton" disabled={!ready} onClick={openField}>{english ? "Open Field Intelligence" : "打开 Field Intelligence"}</button>
        </div>
        {error ? <div className="fouiBoundaryNotice fouiBoundaryNotice--error">{error}</div> : null}
      </section>
    </div>
  );
}
