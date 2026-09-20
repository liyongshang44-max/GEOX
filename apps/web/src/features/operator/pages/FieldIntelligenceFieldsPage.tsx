import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  fetchFieldRuntimeScopeOptions,
  fetchFields,
  type FieldRuntimeScopeSeasonOption,
} from "../../../api/fields";
import { useLocale } from "../../../lib/locale";
import "../../../styles/fouiFieldOperations.css";

type FieldOption = { field_id: string; name: string; status: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function normalizeFields(value: unknown): FieldOption[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const fieldId = text(row.field_id);
    return {
      field_id: fieldId,
      name: text(row.name ?? row.field_name) || fieldId,
      status: text(row.status) || "UNKNOWN",
    };
  }).filter((item) => item.field_id);
}

export default function FieldIntelligenceFieldsPage(): React.ReactElement {
  const { locale } = useLocale();
  const english = locale === "en-US";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedFieldId = text(searchParams.get("field_id"));
  const [fields, setFields] = React.useState<FieldOption[]>([]);
  const [seasons, setSeasons] = React.useState<FieldRuntimeScopeSeasonOption[]>([]);
  const [fieldId, setFieldId] = React.useState(requestedFieldId);
  const [seasonId, setSeasonId] = React.useState("");
  const [zoneId, setZoneId] = React.useState("");
  const [loadingFields, setLoadingFields] = React.useState(true);
  const [loadingSeasons, setLoadingSeasons] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setLoadingFields(true);
    fetchFields()
      .then((rows) => {
        if (!active) return;
        const next = normalizeFields(rows);
        setFields(next);
        setFieldId((current) => current || next[0]?.field_id || "");
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (active) setLoadingFields(false); });
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    let active = true;
    setSeasons([]);
    setSeasonId("");
    if (!fieldId) return () => { active = false; };
    setLoadingSeasons(true);
    fetchFieldRuntimeScopeOptions(fieldId)
      .then((result) => {
        if (!active) return;
        const next = Array.isArray(result.seasons) ? result.seasons : [];
        setSeasons(next);
        const activeSeason = next.find((item) => text(item.status).toUpperCase() === "ACTIVE");
        setSeasonId(text(activeSeason?.season_id ?? next[0]?.season_id));
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (active) setLoadingSeasons(false); });
    return () => { active = false; };
  }, [fieldId]);

  const ready = Boolean(fieldId && seasonId && zoneId.trim());

  function openField(): void {
    if (!ready) return;
    const query = new URLSearchParams({ season_id: seasonId, zone_id: zoneId.trim() });
    navigate(`/operator/field-intelligence/${encodeURIComponent(fieldId)}?${query.toString()}`);
  }

  return (
    <div className="fouiPage" data-foui-surface="field-intelligence-selector">
      <section className="fouiHero">
        <div>
          <span className="fouiEyebrow">FIELD INTELLIGENCE / MCFT</span>
          <h2>{english ? "Open the exact field world." : "进入精确的田块世界。"}</h2>
          <p>{english ? "Field Intelligence requires the same exact field, season, and zone scope as canonical MCFT. The product layer never degrades to field-only scope." : "Field Intelligence 与 canonical MCFT 使用同一套精确地块、季节、分区范围；产品层绝不降级为仅地块范围。"}</p>
        </div>
      </section>

      <section className="fouiPanel">
        <header className="fouiPanelHeader">
          <div><span className="fouiEyebrow">EXACT SCOPE</span><h3>{english ? "Choose field context" : "选择田块上下文"}</h3></div>
          <span className="fouiStatePill">GET ONLY</span>
        </header>
        <div className="fouiScopeForm">
          <label>
            <span>{english ? "Field" : "田块"}</span>
            <select value={fieldId} onChange={(event) => setFieldId(event.target.value)} disabled={loadingFields}>
              <option value="">{loadingFields ? (english ? "Loading…" : "加载中…") : (english ? "Select field" : "选择田块")}</option>
              {fields.map((field) => <option key={field.field_id} value={field.field_id}>{field.name} · {field.field_id} · {field.status}</option>)}
            </select>
          </label>
          <label>
            <span>{english ? "Season" : "季节"}</span>
            <select value={seasonId} onChange={(event) => setSeasonId(event.target.value)} disabled={!fieldId || loadingSeasons}>
              <option value="">{loadingSeasons ? (english ? "Loading…" : "加载中…") : (english ? "Select season" : "选择季节")}</option>
              {seasons.map((season) => <option key={text(season.season_id)} value={text(season.season_id)}>{text(season.name) || text(season.season_id)} · {text(season.status) || "UNKNOWN"}</option>)}
            </select>
          </label>
          <label>
            <span>zone_id</span>
            <input value={zoneId} onChange={(event) => setZoneId(event.target.value)} placeholder={english ? "Exact zone identifier" : "输入精确分区标识"} />
          </label>
        </div>
        <div className="fouiScopeFooter">
          <p>{english ? "Zone stays explicit because the current backend does not expose an authoritative zone-list API." : "当前后端没有权威分区列表接口，因此 zone_id 保持显式输入，不由前端猜测。"}</p>
          <button type="button" className="fouiButton" disabled={!ready} onClick={openField}>{english ? "Open Field Intelligence" : "打开 Field Intelligence"}</button>
        </div>
        {error ? <div className="fouiBoundaryNotice fouiBoundaryNotice--error">{error}</div> : null}
      </section>
    </div>
  );
}
