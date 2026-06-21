// apps/server/src/domain/soil_water/root_zone_irrigation_scenario_builder_v1.ts
// Purpose: deterministically compare fixed hypothetical irrigation options against an H33 root-zone no-action forecast.
// Boundary: pure domain builder only; no database access, fact writes, projection writes, routes, environment reads, wall-clock reads, or random values.

import { createHash } from "node:crypto";
import type { RootZoneSoilWaterForecastPayloadV1, RootZoneSoilWaterForecastWaterStatusV1, RootZoneSoilWaterForecastBoundAppliedV1 } from "./root_zone_soil_water_forecast_builder_v1.js";

export const ROOT_ZONE_IRRIGATION_SCENARIO_MODEL_VERSION_V1 = "root_zone_irrigation_scenario_set_v1";
export const ROOT_ZONE_IRRIGATION_SCENARIO_HORIZON_DAYS_V1 = 7;

type OptionId = "NO_ACTION" | "IRRIGATE_10MM_DAY0" | "IRRIGATE_20MM_DAY0" | "IRRIGATE_30MM_DAY0" | "DELAY_3_DAYS_THEN_IRRIGATE_20MM";
type InputStatus = "COMPARABLE" | "INSUFFICIENT_FORECAST" | "INVALID_INPUT" | "UNKNOWN";

type Event = { day_index: number; irrigation_mm: number; application_efficiency: number; effective_irrigation_mm: number };
export type RootZoneIrrigationScenarioSetPayloadV1 = {
  scenario_set_id: string; tenant_id: string; project_id: string; group_id: string; field_id: string; zone_id: string;
  source_forecast_id: string; source_forecast_ref: string; baseline_mode: "FORECAST_BASELINE"; comparison_mode: "HYPOTHETICAL_IRRIGATION_OPTIONS";
  horizon_days: number; root_zone_depth_cm: number; root_zone_available_water_capacity_mm: number;
  baseline_summary: { min_available_water_fraction: number | null; first_stress_date: string | null; stress_day_count: number; limited_day_count: number };
  options: Array<{ option_id: OptionId; action_type: "NO_ACTION" | "IRRIGATE" | "DELAYED_IRRIGATION"; irrigation_events: Event[]; daily_projection: Array<{ day_index: number; date: string; baseline_available_water_fraction: number; projected_available_water_fraction: number; delta_vs_baseline_fraction: number; projected_available_water_mm: number; forecast_water_status: RootZoneSoilWaterForecastWaterStatusV1; bound_applied: RootZoneSoilWaterForecastBoundAppliedV1 }>; option_summary: { min_available_water_fraction: number | null; max_available_water_fraction: number | null; first_stress_date: string | null; stress_day_count: number; limited_day_count: number; total_irrigation_mm: number; total_effective_irrigation_mm: number }; comparison: { stress_days_delta_vs_baseline: number; limited_days_delta_vs_baseline: number; min_awf_delta_vs_baseline: number | null }; quality: { status: "COMPARABLE" | "NOT_COMPARABLE"; reason_codes: string[] }; confidence: { level: "LOW" | "MEDIUM" | "HIGH"; score: number; basis: string }; calculation_trace: Record<string, unknown> }>;
  input_status: InputStatus; blocking_reasons: string[]; calculation_inputs: Record<string, unknown>; derivation: Record<string, unknown>; confidence: { level: "LOW" | "MEDIUM" | "HIGH"; score: number; basis: string }; computed_at: string; determinism_hash: string;
};
export type RootZoneIrrigationScenarioBuildInputV1 = { tenant_id: string; project_id: string; group_id: string; field_id: string; zone_id: string; sourceForecast: RootZoneSoilWaterForecastPayloadV1; application_efficiency: number; computed_at: string };

const thresholds = { saturated_or_near_saturated_min: 0.9, readily_available_min: 0.5, limited_available_min: 0.25, stress_below: 0.25 };
const optionDefs: Array<{ option_id: OptionId; action_type: "NO_ACTION" | "IRRIGATE" | "DELAYED_IRRIGATION"; events: Array<{ day_index: number; irrigation_mm: number }> }> = [
  { option_id: "NO_ACTION", action_type: "NO_ACTION", events: [] },
  { option_id: "IRRIGATE_10MM_DAY0", action_type: "IRRIGATE", events: [{ day_index: 0, irrigation_mm: 10 }] },
  { option_id: "IRRIGATE_20MM_DAY0", action_type: "IRRIGATE", events: [{ day_index: 0, irrigation_mm: 20 }] },
  { option_id: "IRRIGATE_30MM_DAY0", action_type: "IRRIGATE", events: [{ day_index: 0, irrigation_mm: 30 }] },
  { option_id: "DELAY_3_DAYS_THEN_IRRIGATE_20MM", action_type: "DELAYED_IRRIGATION", events: [{ day_index: 3, irrigation_mm: 20 }] },
];
function round6(n: number) { return Math.round(n * 1_000_000) / 1_000_000; }
function finite(v: unknown): v is number { return typeof v === "number" && Number.isFinite(v); }
function stableJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`; if (value && typeof value === "object") { const r = value as Record<string, unknown>; return `{${Object.keys(r).sort().map(k => `${JSON.stringify(k)}:${stableJson(r[k])}`).join(",")}}`; } return JSON.stringify(value); }
function hash(v: Record<string, unknown>) { return createHash("sha256").update(stableJson(v)).digest("hex"); }
function classify(f: number | null): RootZoneSoilWaterForecastWaterStatusV1 { if (f == null || !Number.isFinite(f)) return "UNKNOWN"; if (f >= 0.9) return "SATURATED_OR_NEAR_SATURATED"; if (f >= 0.5) return "READILY_AVAILABLE"; if (f >= 0.25) return "LIMITED_AVAILABLE"; return "STRESS"; }
function summary(rows: Array<{ date: string; projected_available_water_fraction: number; forecast_water_status: string }>) { const fs = rows.map(r => r.projected_available_water_fraction).filter(Number.isFinite); return { min_available_water_fraction: fs.length ? round6(Math.min(...fs)) : null, max_available_water_fraction: fs.length ? round6(Math.max(...fs)) : null, first_stress_date: rows.find(r => r.forecast_water_status === "STRESS")?.date ?? null, stress_day_count: rows.filter(r => r.forecast_water_status === "STRESS").length, limited_day_count: rows.filter(r => r.forecast_water_status === "LIMITED_AVAILABLE").length }; }
function unique(a: string[]) { return [...new Set(a)].sort(); }

export function buildRootZoneIrrigationScenarioSetV1(input: RootZoneIrrigationScenarioBuildInputV1): RootZoneIrrigationScenarioSetPayloadV1 {
  const sf = input.sourceForecast;
  const sortedDefs = [...optionDefs].sort((a, b) => a.option_id.localeCompare(b.option_id));
  const determinism_hash = hash({ tenant_id: input.tenant_id, project_id: input.project_id, group_id: input.group_id, field_id: input.field_id, zone_id: input.zone_id, source_forecast_id: sf?.forecast_id ?? "", source_forecast_determinism_hash: sf?.determinism_hash ?? "", application_efficiency: input.application_efficiency, fixed_scenario_option_definitions: sortedDefs, model_version: ROOT_ZONE_IRRIGATION_SCENARIO_MODEL_VERSION_V1 });
  const insufficient: string[] = [];
  if (sf?.forecast_status !== "ESTIMATED") insufficient.push("source_forecast_not_estimated");
  if (!Array.isArray(sf?.daily_forecast) || sf.daily_forecast.length !== 7) insufficient.push("insufficient_daily_forecast");
  if (!finite(sf?.root_zone_available_water_capacity_mm) || sf.root_zone_available_water_capacity_mm <= 0) insufficient.push("invalid_source_capacity");
  if (!sf?.source_state_id) insufficient.push("missing_source_state_id");
  if (!sf?.determinism_hash) insufficient.push("missing_source_forecast_determinism_hash");
  const invalid: string[] = [];
  if (!finite(input.application_efficiency) || input.application_efficiency <= 0 || input.application_efficiency > 1) invalid.push("invalid_application_efficiency");
  if (sf && (sf.tenant_id !== input.tenant_id || sf.project_id !== input.project_id || sf.group_id !== input.group_id || sf.field_id !== input.field_id || sf.zone_id !== input.zone_id)) invalid.push("source_forecast_scope_mismatch");
  const daily = Array.isArray(sf?.daily_forecast) ? sf.daily_forecast : [];
  for (const d of daily) { if (!finite(d.projected_available_water_mm)) invalid.push("non_finite_projected_available_water_mm"); if (!finite(d.net_water_change_mm)) invalid.push("non_finite_net_water_change_mm"); }
  if (new Set(daily.map(d => d.day_index)).size !== daily.length) invalid.push("duplicate_day_index");
  if (new Set(daily.map(d => d.date)).size !== daily.length) invalid.push("duplicate_date");
  if (daily.length === 7 && daily.map(d => d.day_index).sort((a,b)=>a-b).join(",") !== "0,1,2,3,4,5,6") invalid.push("invalid_day_index_set");
  const input_status: InputStatus = insufficient.length ? "INSUFFICIENT_FORECAST" : invalid.length ? "INVALID_INPUT" : "COMPARABLE";
  const baseSummary = { min_available_water_fraction: sf?.min_available_water_fraction ?? null, first_stress_date: sf?.first_stress_date ?? null, stress_day_count: sf?.stress_day_count ?? 0, limited_day_count: sf?.limited_day_count ?? 0 };
  const capacity = finite(sf?.root_zone_available_water_capacity_mm) && sf.root_zone_available_water_capacity_mm > 0 ? sf.root_zone_available_water_capacity_mm : 1;
  const options = optionDefs.map(def => {
    const events = def.events.map(e => ({ ...e, application_efficiency: input.application_efficiency, effective_irrigation_mm: round6(e.irrigation_mm * input.application_efficiency) }));
    let prev = 0;
    const rows = daily.map((d, i) => { const eventMm = events.filter(e => e.day_index === d.day_index).reduce((s,e)=>s+e.effective_irrigation_mm,0); const raw = i === 0 ? d.projected_available_water_mm + eventMm : prev + d.net_water_change_mm + eventMm; const bounded = Math.max(0, Math.min(capacity, raw)); const bound = raw < 0 ? "LOWER_BOUND" : raw > capacity ? "UPPER_BOUND" : "NONE"; prev = bounded; const f = round6(bounded / capacity); const bf = round6(d.projected_available_water_mm / capacity); return { day_index: d.day_index, date: d.date, baseline_available_water_fraction: bf, projected_available_water_fraction: def.option_id === "NO_ACTION" ? d.projected_available_water_fraction : f, delta_vs_baseline_fraction: def.option_id === "NO_ACTION" ? 0 : round6(f - bf), projected_available_water_mm: def.option_id === "NO_ACTION" ? d.projected_available_water_mm : round6(bounded), forecast_water_status: def.option_id === "NO_ACTION" ? d.forecast_water_status : classify(f), bound_applied: def.option_id === "NO_ACTION" ? d.bound_applied : bound }; });
    const s = summary(rows); const total = events.reduce((x,e)=>x+e.irrigation_mm,0); const eff = events.reduce((x,e)=>x+e.effective_irrigation_mm,0);
    return { option_id: def.option_id, action_type: def.action_type, irrigation_events: events, daily_projection: rows, option_summary: { ...s, total_irrigation_mm: round6(total), total_effective_irrigation_mm: round6(eff) }, comparison: { stress_days_delta_vs_baseline: s.stress_day_count - baseSummary.stress_day_count, limited_days_delta_vs_baseline: s.limited_day_count - baseSummary.limited_day_count, min_awf_delta_vs_baseline: s.min_available_water_fraction == null || baseSummary.min_available_water_fraction == null ? null : round6(s.min_available_water_fraction - baseSummary.min_available_water_fraction) }, quality: { status: (input_status === "COMPARABLE" ? "COMPARABLE" : "NOT_COMPARABLE") as "COMPARABLE" | "NOT_COMPARABLE", reason_codes: unique([...insufficient, ...invalid]) }, confidence: { level: (input_status === "COMPARABLE" ? "MEDIUM" : "LOW") as "LOW" | "MEDIUM" | "HIGH", score: input_status === "COMPARABLE" ? 0.75 : 0.1, basis: "deterministic_hypothetical_irrigation_comparison" }, calculation_trace: { application_efficiency: input.application_efficiency, model_version: ROOT_ZONE_IRRIGATION_SCENARIO_MODEL_VERSION_V1, source: "H33_baseline_net_water_change_mm" } };
  });
  return { scenario_set_id: `rziss_${determinism_hash.slice(0,32)}`, tenant_id: input.tenant_id, project_id: input.project_id, group_id: input.group_id, field_id: input.field_id, zone_id: input.zone_id, source_forecast_id: sf?.forecast_id ?? "", source_forecast_ref: sf?.forecast_id ?? "", baseline_mode: "FORECAST_BASELINE", comparison_mode: "HYPOTHETICAL_IRRIGATION_OPTIONS", horizon_days: daily.length, root_zone_depth_cm: sf?.root_zone_depth_cm ?? 0, root_zone_available_water_capacity_mm: sf?.root_zone_available_water_capacity_mm ?? 0, baseline_summary: baseSummary, options, input_status, blocking_reasons: unique([...insufficient, ...invalid]), calculation_inputs: { source_forecast_id: sf?.forecast_id ?? "", application_efficiency: input.application_efficiency }, derivation: { thresholds, model_version: ROOT_ZONE_IRRIGATION_SCENARIO_MODEL_VERSION_V1, fixed_scenario_option_definitions: optionDefs }, confidence: { level: (input_status === "COMPARABLE" ? "MEDIUM" : "LOW") as "LOW" | "MEDIUM" | "HIGH", score: input_status === "COMPARABLE" ? 0.75 : 0.1, basis: "deterministic_hypothetical_irrigation_comparison" }, computed_at: input.computed_at, determinism_hash };
}
