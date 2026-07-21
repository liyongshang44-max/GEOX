// Purpose: discover an exact local/operator Field Runtime scope through existing GET-only field read APIs.
// Boundary: navigation only; no field creation, canonical write, recommendation, approval, dispatch, activation, or persistence.

import React from "react";
import { useNavigate } from "react-router-dom";
import { fetchFieldDetail, fetchFields } from "../../../api/fields";
import { useLocale } from "../../../lib/locale";
import "../../../styles/operatorFieldRuntimeNavigator.css";

const GOVERNED_C8_SCOPE = Object.freeze({
  field_id: "field_c8_demo",
  season_id: "season_2026_c8_corn",
  zone_id: "zone_mcft_c8_water_001",
});

type FieldOption = { field_id: string; name: string; status: string };
type SeasonOption = { season_id: string; name: string; status: string };
type LoadStatus = "idle" | "loading" | "ready" | "error";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedFields(value: unknown): FieldOption[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const fieldId = text(row.field_id);
    return {
      field_id: fieldId,
      name: text(row.name) || text(row.field_name) || fieldId,
      status: text(row.status) || "UNKNOWN",
    };
  }).filter((item) => item.field_id).sort((a, b) => a.name.localeCompare(b.name));
}

function normalizedSeasons(value: unknown): SeasonOption[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const seasonId = text(row.season_id);
    return {
      season_id: seasonId,
      name: text(row.name) || seasonId,
      status: text(row.status) || "UNKNOWN",
    };
  }).filter((item) => item.season_id).sort((a, b) => a.name.localeCompare(b.name));
}

export default function McftFieldRuntimeScopeNavigatorPage(): React.ReactElement {
  const { locale } = useLocale();
  const english = locale === "en-US";
  const navigate = useNavigate();
  const [fields, setFields] = React.useState<FieldOption[]>([]);
  const [seasons, setSeasons] = React.useState<SeasonOption[]>([]);
  const [selectedFieldId, setSelectedFieldId] = React.useState("");
  const [selectedSeasonId, setSelectedSeasonId] = React.useState("");
  const [zoneId, setZoneId] = React.useState("");
  const [fieldStatus, setFieldStatus] = React.useState<LoadStatus>("idle");
  const [seasonStatus, setSeasonStatus] = React.useState<LoadStatus>("idle");
  const [errorText, setErrorText] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setFieldStatus("loading");
    void fetchFields().then((rows) => {
      if (!active) return;
      const next = normalizedFields(rows);
      setFields(next);
      const governed = next.find((item) => item.field_id === GOVERNED_C8_SCOPE.field_id);
      setSelectedFieldId((current) => current || governed?.field_id || next[0]?.field_id || "");
      setFieldStatus("ready");
    }).catch((error: unknown) => {
      if (!active) return;
      setErrorText(error instanceof Error ? error.message : String(error));
      setFieldStatus("error");
    });
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    let active = true;
    setSeasons([]);
    setSelectedSeasonId("");
    if (!selectedFieldId) {
      setSeasonStatus("idle");
      return () => { active = false; };
    }
    if (selectedFieldId === GOVERNED_C8_SCOPE.field_id) setZoneId(GOVERNED_C8_SCOPE.zone_id);
    setSeasonStatus("loading");
    void fetchFieldDetail(selectedFieldId).then((detail) => {
      if (!active) return;
      const next = normalizedSeasons(detail && typeof detail === "object" ? (detail as Record<string, unknown>).seasons : []);
      setSeasons(next);
      const governed = next.find((item) => item.season_id === GOVERNED_C8_SCOPE.season_id);
      setSelectedSeasonId(governed?.season_id || next[0]?.season_id || "");
      setSeasonStatus("ready");
    }).catch((error: unknown) => {
      if (!active) return;
      setErrorText(error instanceof Error ? error.message : String(error));
      setSeasonStatus("error");
    });
    return () => { active = false; };
  }, [selectedFieldId]);

  const ready = Boolean(selectedFieldId && selectedSeasonId && zoneId.trim());
  const target = ready
    ? `/operator/fields/${encodeURIComponent(selectedFieldId)}?season_id=${encodeURIComponent(selectedSeasonId)}&zone_id=${encodeURIComponent(zoneId.trim())}`
    : "";

  return (
    <main className="operatorFieldRuntimeNavigator operatorProductSurface" data-mcft-cap-07-scope-navigator="get-only">
      <header className="operatorFieldRuntimeNavigator__header">
        <div>
          <p className="operatorFieldRuntimeNavigator__eyebrow">MCFT-CAP-07 / GET-only scope discovery</p>
          <h1>{english ? "Canonical Field Runtime" : "规范地块运行"}</h1>
          <p>{english ? "Resolve the exact field, season, and zone before opening the deterministic read surface." : "先解析精确地块、季节与分区，再进入确定性只读运行视图。"}</p>
        </div>
        <div className="operatorFieldRuntimeNavigator__boundary">
          <strong>{english ? "Read boundary" : "读取边界"}</strong>
          <span>tenant_id / project_id / group_id / field_id / season_id / zone_id</span>
          <small>{english ? "No field-only degradation and no write action." : "禁止降级为仅地块范围，不提供任何写操作。"}</small>
        </div>
      </header>

      <section className="operatorFieldRuntimeNavigator__panel">
        <div className="operatorFieldRuntimeNavigator__panelHeader">
          <div>
            <h2>{english ? "Exact scope navigator" : "精确范围导航"}</h2>
            <p>{english ? "Fields and seasons come from existing authenticated GET APIs. Zone remains explicit because no authoritative zone-list API exists." : "地块和季节来自现有认证 GET API；由于当前没有权威分区列表 API，zone_id 必须显式确认。"}</p>
          </div>
          <span className="operatorFieldRuntimeNavigator__badge">GET ONLY</span>
        </div>

        <div className="operatorFieldRuntimeNavigator__form">
          <label>
            <span>{english ? "Field" : "地块"}</span>
            <select value={selectedFieldId} onChange={(event) => setSelectedFieldId(event.target.value)} disabled={fieldStatus === "loading" || fields.length === 0} data-mcft-scope-key="field_id">
              <option value="">{fieldStatus === "loading" ? (english ? "Loading fields…" : "正在加载地块…") : (english ? "Select a field" : "选择地块")}</option>
              {fields.map((field) => <option key={field.field_id} value={field.field_id}>{field.name} · {field.field_id} · {field.status}</option>)}
            </select>
          </label>

          <label>
            <span>{english ? "Season" : "季节"}</span>
            <select value={selectedSeasonId} onChange={(event) => setSelectedSeasonId(event.target.value)} disabled={!selectedFieldId || seasonStatus === "loading" || seasons.length === 0} data-mcft-scope-key="season_id">
              <option value="">{seasonStatus === "loading" ? (english ? "Loading seasons…" : "正在加载季节…") : (english ? "Select a season" : "选择季节")}</option>
              {seasons.map((season) => <option key={season.season_id} value={season.season_id}>{season.name} · {season.season_id} · {season.status}</option>)}
            </select>
          </label>

          <label>
            <span>zone_id</span>
            <input value={zoneId} onChange={(event) => setZoneId(event.target.value)} placeholder={GOVERNED_C8_SCOPE.zone_id} autoComplete="off" data-mcft-scope-key="zone_id" />
          </label>
        </div>

        {fields.length === 0 && fieldStatus === "ready" ? (
          <div className="operatorFieldRuntimeNavigator__notice" data-mcft-empty-field-state="true">
            <strong>{english ? "No fields are available" : "当前没有可用地块"}</strong>
            <span>{english ? "Run the local CAP-07 demo loader or establish a real Runtime scope before opening this page." : "请先运行本地 CAP-07 演示装载器，或建立真实 Runtime 范围。"}</span>
            <code>pnpm run seed:three-surface-local-demo -- --apply --confirm-local-demo</code>
          </div>
        ) : null}

        {errorText ? <div className="operatorFieldRuntimeNavigator__error"><strong>{english ? "Scope discovery failed" : "范围发现失败"}</strong><span>{errorText}</span></div> : null}

        <div className="operatorFieldRuntimeNavigator__target">
          <div>
            <span>{english ? "Resolved route" : "解析后的路由"}</span>
            <code>{target || (english ? "Complete all three inputs" : "请完成全部三个输入")}</code>
          </div>
          <button type="button" disabled={!ready} onClick={() => ready && navigate(target)}>{english ? "Open canonical Runtime" : "打开规范 Runtime"}</button>
        </div>
      </section>

      <section className="operatorFieldRuntimeNavigator__panel operatorFieldRuntimeNavigator__nonclaims">
        <h2>{english ? "Nonclaims" : "非声明"}</h2>
        <p>{english ? "The local demo is controlled Replay data. It does not establish live devices, a production gateway, real-field validation, automated control, Runtime source authority, canonical production write authority, or MCFT-CAP-08 authority." : "本地演示数据属于受控回放，不建立实时设备、生产网关、真实田间验证、自动控制、Runtime 来源权限、生产规范写权限或 MCFT-CAP-08 权限。"}</p>
      </section>
    </main>
  );
}
