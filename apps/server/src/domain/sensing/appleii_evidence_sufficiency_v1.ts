import type { Pool, PoolClient } from "pg";

export type AppleIIFreshnessV1 = "fresh" | "stale" | "unknown";
export type AppleIIDeviceHealthStatusV1 = "GOOD" | "DEGRADED" | "BAD" | "OFFLINE" | "UNKNOWN";
export type AppleIISensorDriftStatusV1 = "NONE" | "SUSPECT" | "DRIFTING" | "UNKNOWN";
export type AppleIIConflictStatusV1 = "NONE" | "UNRESOLVED" | "UNKNOWN";
export type AppleIIEvidenceSufficiencyStatusV1 = "PASS" | "NEEDS_EVIDENCE";
export type AppleIISampleSourceV1 = "device" | "gateway" | "system" | "human" | "import" | "sim" | "unknown";
export type AppleIITriggerMetricEvidenceV1 = { irrigation_effectiveness: boolean; leak_risk: boolean; supporting_metrics: string[] };
export type AppleIITimeCoverageV1 = { observation_window: { start_ts_ms: number; end_ts_ms: number }; coverage_ratio: number; sample_count: number; formal_sample_count: number; non_formal_sample_count: number; formal_coverage_ratio: number; sample_source_lanes: Record<string, { sample_count: number; formal_eligible: boolean }>; formal_metric_lanes: Record<string, { sample_count: number }>; trigger_metric_evidence: AppleIITriggerMetricEvidenceV1; formal_source_eligible: boolean; gap_count: number; max_gap_ms: number; expected_sample_interval_ms: number; freshness: AppleIIFreshnessV1 };
export type AppleIIDeviceHealthSnapshotV1 = { device_health_status: AppleIIDeviceHealthStatusV1; device_status_present: boolean; heartbeat_present: boolean; telemetry_present: boolean; telemetry_only: boolean; status_unknown_but_sample_fresh: boolean; last_telemetry_ts_ms: number | null; last_heartbeat_ts_ms: number | null; last_sample_ts_ms: number | null; offline: boolean; battery_percent: number | null; rssi_dbm: number | null; reason_codes: string[] };
export type AppleIIConflictDetectionV1 = { sensor_drift_status: AppleIISensorDriftStatusV1; conflict_status: AppleIIConflictStatusV1; device_count: number; conflicting_metric_count: number; conflict_reasons: string[] };
export type AppleIIEvidenceSufficiencyV1 = { evidence_sufficiency: AppleIIEvidenceSufficiencyStatusV1; reason_codes: string[]; time_coverage_v1: AppleIITimeCoverageV1; device_health_snapshot_v1: AppleIIDeviceHealthSnapshotV1; conflict_detection_v1: AppleIIConflictDetectionV1 };

type DbConn = Pool | PoolClient;
type RawSampleRow = { sample_id: string; sensor_id: string; ts_ms: number; metric: string; value: number; qc_quality: string; source: AppleIISampleSourceV1; payload_json: any };
type FormalSourcePolicyV1 = Partial<Record<AppleIISampleSourceV1, boolean>>;
const DEFAULT_FORMAL_SAMPLE_SOURCE_POLICY_V1: Record<AppleIISampleSourceV1, boolean> = { device: true, gateway: true, system: false, human: false, import: false, sim: false, unknown: false };
const IRRIGATION_EFFECTIVENESS_FORMAL_METRICS_V1 = new Set([
  "soil_moisture",
  "soil_moisture_pct",
  "moisture_pct",
  "flow_rate",
  "irrigation_flow_rate",
  "water_flow",
  "pump_flow",
  "water_flow_rate",
  "inlet_flow_lpm",
  "outlet_flow_lpm",
]);
const LEAK_RISK_FORMAL_METRICS_V1 = new Set([
  "soil_moisture",
  "soil_moisture_pct",
  "moisture_pct",
  "flow_rate",
  "irrigation_flow_rate",
  "water_flow",
  "pressure",
  "water_pressure",
  "pressure_drop_kpa",
  "inlet_flow_lpm",
  "outlet_flow_lpm",
]);
const toNumber = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const normalizeMetric = (v: unknown): string => String(v ?? "").trim().toLowerCase();
const normalizeDeviceId = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
function parseJsonObject(v: unknown): Record<string, any> { if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, any>; if (typeof v === "string") { try { const p = JSON.parse(v); return p && typeof p === "object" && !Array.isArray(p) ? p : {}; } catch { return {}; } } return {}; }
function normalizeSampleSource(v: unknown): AppleIISampleSourceV1 { const s = String(v ?? "").trim().toLowerCase(); return s === "device" || s === "gateway" || s === "system" || s === "human" || s === "import" || s === "sim" ? s : "unknown"; }
function buildFormalSourcePolicy(policy?: FormalSourcePolicyV1 | null): Record<AppleIISampleSourceV1, boolean> { return { ...DEFAULT_FORMAL_SAMPLE_SOURCE_POLICY_V1, ...(policy ?? {}) }; }
function isFormalSampleSource(source: AppleIISampleSourceV1, policy: Record<AppleIISampleSourceV1, boolean>): boolean { return policy[source] === true; }
function inferSingleFormalSampleDeviceId(samples: RawSampleRow[]): string | null { const ids = Array.from(new Set(samples.map((sample) => normalizeDeviceId(sample.sensor_id)).filter(Boolean))) as string[]; return ids.length === 1 ? ids[0] : null; }
function buildSampleSourceLanes(samples: RawSampleRow[], policy: Record<AppleIISampleSourceV1, boolean>): Record<string, { sample_count: number; formal_eligible: boolean }> { const lanes: Record<string, { sample_count: number; formal_eligible: boolean }> = {}; for (const sample of samples) { const source = normalizeSampleSource(sample.source); const current = lanes[source] ?? { sample_count: 0, formal_eligible: isFormalSampleSource(source, policy) }; current.sample_count += 1; current.formal_eligible = isFormalSampleSource(source, policy); lanes[source] = current; } return lanes; }
function buildFormalMetricLanes(samples: RawSampleRow[]): Record<string, { sample_count: number }> { const lanes: Record<string, { sample_count: number }> = {}; for (const sample of samples) { const metric = normalizeMetric(sample.metric); if (!metric) continue; const current = lanes[metric] ?? { sample_count: 0 }; current.sample_count += 1; lanes[metric] = current; } return lanes; }
function buildTriggerMetricEvidence(samples: RawSampleRow[]): AppleIITriggerMetricEvidenceV1 {
  const metrics = Array.from(new Set(samples.map((sample) => normalizeMetric(sample.metric)).filter(Boolean)));
  const has = (metric: string): boolean => metrics.includes(metric);
  const hasAny = (pool: Set<string>): boolean => metrics.some((metric) => pool.has(metric));
  const hasFlowTrio = has("inlet_flow_lpm") && has("outlet_flow_lpm") && has("pressure_drop_kpa");
  const hasFlowPair = has("inlet_flow_lpm") && has("outlet_flow_lpm");

  return {
    irrigation_effectiveness: hasAny(IRRIGATION_EFFECTIVENESS_FORMAL_METRICS_V1) || hasFlowPair || hasFlowTrio,
    leak_risk: hasAny(LEAK_RISK_FORMAL_METRICS_V1) || has("pressure_drop_kpa") || hasFlowTrio,
    supporting_metrics: metrics,
  };
}
function computeGapStats(samples: RawSampleRow[], startTs: number, endTs: number, expectedIntervalMs: number) { if (!samples.length) return { gap_count: 1, max_gap_ms: Math.max(0, endTs - startTs), covered_ms: 0 }; const sorted = samples.slice().sort((a, b) => Number(a.ts_ms) - Number(b.ts_ms)); let gapCount = 0, maxGapMs = 0, coveredMs = 0; const firstTs = Number(sorted[0].ts_ms), lastTs = Number(sorted[sorted.length - 1].ts_ms); if (firstTs > startTs) { const gap = firstTs - startTs; gapCount += 1; maxGapMs = Math.max(maxGapMs, gap); } if (lastTs < endTs) { const gap = endTs - lastTs; gapCount += 1; maxGapMs = Math.max(maxGapMs, gap); } for (let i = 1; i < sorted.length; i += 1) { const prev = Number(sorted[i - 1].ts_ms), cur = Number(sorted[i].ts_ms), delta = cur - prev; if (delta > expectedIntervalMs) { gapCount += 1; maxGapMs = Math.max(maxGapMs, delta); } coveredMs += Math.min(Math.max(delta, 0), expectedIntervalMs); } if (sorted.length === 1) { coveredMs = 0; } return { gap_count: gapCount, max_gap_ms: maxGapMs, covered_ms: coveredMs }; }
function latestSampleTs(samples: RawSampleRow[]): number | null { const latest = Math.max(...samples.map((x) => Number(x.ts_ms)).filter(Number.isFinite)); return Number.isFinite(latest) && latest > 0 ? latest : null; }
function deriveFreshness(samples: RawSampleRow[], nowMs: number, maxAgeMs: number): AppleIIFreshnessV1 { const latest = latestSampleTs(samples); if (latest == null) return "unknown"; return nowMs - latest <= maxAgeMs ? "fresh" : "stale"; }
function deriveDeviceHealth(row: any, nowMs: number, maxAgeMs: number, samples: RawSampleRow[]): AppleIIDeviceHealthSnapshotV1 { const deviceStatusPresent = row != null, sampleLatest = latestSampleTs(samples), sampleFresh = sampleLatest != null && nowMs - sampleLatest <= maxAgeMs, lastTelemetry = deviceStatusPresent ? toNumber(row?.last_telemetry_ts_ms) : null, lastHeartbeat = deviceStatusPresent ? toNumber(row?.last_heartbeat_ts_ms) : null, telemetryPresent = lastTelemetry != null, heartbeatPresent = lastHeartbeat != null, telemetryOnly = telemetryPresent && !heartbeatPresent, latestStatusTs = Math.max(lastTelemetry ?? 0, lastHeartbeat ?? 0), offline = deviceStatusPresent ? (!latestStatusTs || nowMs - latestStatusTs > maxAgeMs) : false, battery = deviceStatusPresent ? toNumber(row?.battery_percent) : null, rssi = deviceStatusPresent ? toNumber(row?.rssi_dbm) : null, reasonCodes: string[] = []; let status: AppleIIDeviceHealthStatusV1 = "UNKNOWN"; if (!deviceStatusPresent) { reasonCodes.push("DEVICE_STATUS_MISSING"); if (sampleFresh) reasonCodes.push("STATUS_UNKNOWN_BUT_SAMPLE_FRESH"); status = "UNKNOWN"; } else { if (!heartbeatPresent) reasonCodes.push("DEVICE_HEARTBEAT_MISSING"); if (telemetryOnly) reasonCodes.push("TELEMETRY_ONLY_DEVICE_HEALTH"); if (offline) status = "OFFLINE"; else if ((battery != null && battery <= 10) || (rssi != null && rssi <= -95)) status = "BAD"; else if (!heartbeatPresent || (battery != null && battery <= 20) || (rssi != null && rssi <= -85)) status = "DEGRADED"; else status = "GOOD"; } return { device_health_status: status, device_status_present: deviceStatusPresent, heartbeat_present: heartbeatPresent, telemetry_present: telemetryPresent, telemetry_only: telemetryOnly, status_unknown_but_sample_fresh: !deviceStatusPresent && sampleFresh, last_telemetry_ts_ms: lastTelemetry, last_heartbeat_ts_ms: lastHeartbeat, last_sample_ts_ms: sampleLatest, offline, battery_percent: battery, rssi_dbm: rssi, reason_codes: reasonCodes }; }
async function readDeviceHealthStatusRowV1(db: DbConn, params: { tenant_id: string; project_id?: string | null; group_id?: string | null; field_id?: string | null; device_id?: string | null; candidate_device_ids?: Array<string | null | undefined> | null }): Promise<any | null> { const deviceIds = Array.from(new Set([params.device_id, ...(params.candidate_device_ids ?? [])].map(normalizeDeviceId).filter(Boolean))) as string[]; if (!deviceIds.length) return null; const selectCols = `SELECT last_telemetry_ts_ms, last_heartbeat_ts_ms, battery_percent, rssi_dbm FROM device_status_index_v1`; for (const deviceId of deviceIds) { const attempts: Array<{ sql: string; args: unknown[] }> = [{ sql: `${selectCols} WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`, args: [params.tenant_id, deviceId] }, { sql: `${selectCols} WHERE tenant_id = $1 AND field_id = $2 AND device_id = $3 LIMIT 1`, args: [params.tenant_id, params.field_id ?? "", deviceId] }, { sql: `${selectCols} WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND device_id = $4 LIMIT 1`, args: [params.tenant_id, params.project_id ?? "projectA", params.group_id ?? "groupA", deviceId] }]; for (const attempt of attempts) { try { const got = await db.query(attempt.sql, attempt.args); if (got.rows?.[0]) return got.rows[0]; } catch {} } } return null; }
function detectConflict(samples: RawSampleRow[]): AppleIIConflictDetectionV1 { if (!samples.length) return { sensor_drift_status: "UNKNOWN", conflict_status: "UNKNOWN", device_count: 0, conflicting_metric_count: 0, conflict_reasons: ["NO_SAMPLES"] }; const sensors = new Set(samples.map((x) => String(x.sensor_id ?? "").trim()).filter(Boolean)); const byMetric = new Map<string, number[]>(); for (const row of samples) { const metric = String(row.metric ?? "").trim(), value = Number(row.value); if (!metric || !Number.isFinite(value)) continue; const arr = byMetric.get(metric) ?? []; arr.push(value); byMetric.set(metric, arr); } const conflictReasons: string[] = []; let conflictingMetricCount = 0; for (const [metric, values] of byMetric.entries()) { if (values.length < 2) continue; const min = Math.min(...values), max = Math.max(...values), spread = max - min, threshold = metric.toLowerCase().includes("moisture") ? 20 : Math.max(10, Math.abs((min + max) / 2) * 0.5); if (spread > threshold) { conflictingMetricCount += 1; conflictReasons.push(`UNRESOLVED_CONFLICT:${metric}`); } } const suspectDrift = samples.some((x) => String(x.qc_quality ?? "").toLowerCase() === "suspect"), badDrift = samples.some((x) => String(x.qc_quality ?? "").toLowerCase() === "bad"); return { sensor_drift_status: badDrift ? "DRIFTING" : suspectDrift ? "SUSPECT" : "NONE", conflict_status: conflictingMetricCount > 0 ? "UNRESOLVED" : "NONE", device_count: sensors.size, conflicting_metric_count: conflictingMetricCount, conflict_reasons: conflictReasons }; }

export async function buildAppleIIEvidenceSufficiencyV1(db: DbConn, params: { tenant_id: string; project_id?: string | null; group_id?: string | null; field_id: string; device_id?: string | null; now_ms?: number; observation_window_ms?: number; expected_sample_interval_ms?: number; min_sample_count?: number; min_coverage_ratio?: number; max_gap_ms?: number; freshness_max_age_ms?: number; formal_source_policy?: FormalSourcePolicyV1 | null }): Promise<AppleIIEvidenceSufficiencyV1> {
  const nowMs = Number.isFinite(params.now_ms) ? Number(params.now_ms) : Date.now(), observationWindowMs = Number(params.observation_window_ms ?? 6 * 60 * 60 * 1000), expectedSampleIntervalMs = Number(params.expected_sample_interval_ms ?? 30 * 60 * 1000), minSampleCount = Number(params.min_sample_count ?? 3), minCoverageRatio = Number(params.min_coverage_ratio ?? 0.5), maxAllowedGapMs = Number(params.max_gap_ms ?? Math.max(expectedSampleIntervalMs * 2, 60 * 60 * 1000)), freshnessMaxAgeMs = Number(params.freshness_max_age_ms ?? Math.max(expectedSampleIntervalMs * 2, 60 * 60 * 1000)), formalSourcePolicy = buildFormalSourcePolicy(params.formal_source_policy), startTs = nowMs - observationWindowMs, endTs = nowMs;
  const args: any[] = [params.tenant_id, startTs, endTs], where: string[] = [`(payload_json ->> 'tenant_id') = $1`, `ts_ms >= $2`, `ts_ms <= $3`]; let p = 4; if (params.group_id) { where.push(`(payload_json ->> 'group_id') = $${p++}`); args.push(params.group_id); } if (params.field_id) { where.push(`(payload_json ->> 'field_id') = $${p++}`); args.push(params.field_id); } if (params.device_id) { where.push(`sensor_id = $${p++}`); args.push(params.device_id); }
  const sampleRows = await db.query(`SELECT sample_id, sensor_id, ts_ms, metric, value, qc_quality, source, payload_json FROM raw_samples WHERE ${where.join(" AND ")} ORDER BY ts_ms ASC LIMIT 20000`, args);
  const samples = (sampleRows.rows ?? []).map((row: any) => ({ ...row, source: normalizeSampleSource(row.source), payload_json: parseJsonObject(row.payload_json), ts_ms: Number(row.ts_ms), value: Number(row.value) })) as RawSampleRow[];
  const formalSamples = samples.filter((sample) => isFormalSampleSource(sample.source, formalSourcePolicy));
  const nonFormalSampleCount = samples.length - formalSamples.length;
  const deviceStatusRow = await readDeviceHealthStatusRowV1(db, { ...params, candidate_device_ids: [inferSingleFormalSampleDeviceId(formalSamples)] });
  const gapStats = computeGapStats(samples, startTs, endTs, expectedSampleIntervalMs), formalGapStats = computeGapStats(formalSamples, startTs, endTs, expectedSampleIntervalMs), coverageRatio = clamp01(gapStats.covered_ms / Math.max(1, endTs - startTs)), formalCoverageRatio = clamp01(formalGapStats.covered_ms / Math.max(1, endTs - startTs)), freshness = deriveFreshness(formalSamples, nowMs, freshnessMaxAgeMs);
  const timeCoverage: AppleIITimeCoverageV1 = { observation_window: { start_ts_ms: startTs, end_ts_ms: endTs }, coverage_ratio: Number(coverageRatio.toFixed(6)), sample_count: samples.length, formal_sample_count: formalSamples.length, non_formal_sample_count: nonFormalSampleCount, formal_coverage_ratio: Number(formalCoverageRatio.toFixed(6)), sample_source_lanes: buildSampleSourceLanes(samples, formalSourcePolicy), formal_metric_lanes: buildFormalMetricLanes(formalSamples), trigger_metric_evidence: buildTriggerMetricEvidence(formalSamples), formal_source_eligible: formalSamples.length > 0 && nonFormalSampleCount === 0, gap_count: formalGapStats.gap_count, max_gap_ms: formalGapStats.max_gap_ms, expected_sample_interval_ms: expectedSampleIntervalMs, freshness };
  const deviceHealth = deriveDeviceHealth(deviceStatusRow, nowMs, freshnessMaxAgeMs, formalSamples), conflicts = detectConflict(formalSamples);
  const reasonCodes: string[] = [...deviceHealth.reason_codes];
  if (nonFormalSampleCount > 0) reasonCodes.push("NON_FORMAL_SAMPLE_SOURCE");
  if (samples.some((sample) => sample.source === "sim")) reasonCodes.push("SIMULATED_SAMPLE_NOT_FORMAL");
  if (timeCoverage.formal_sample_count < minSampleCount) reasonCodes.push("INSUFFICIENT_FORMAL_SAMPLE_COUNT");
  if (timeCoverage.formal_coverage_ratio < minCoverageRatio) reasonCodes.push("INSUFFICIENT_FORMAL_COVERAGE_RATIO");
  if (timeCoverage.max_gap_ms > maxAllowedGapMs) reasonCodes.push("MAX_GAP_EXCEEDED");
  if (timeCoverage.freshness !== "fresh") reasonCodes.push("STALE_OR_UNKNOWN_FRESHNESS");
  if (!timeCoverage.formal_source_eligible) reasonCodes.push("FORMAL_SOURCE_NOT_ELIGIBLE");
  if (deviceHealth.device_health_status === "UNKNOWN") reasonCodes.push("DEVICE_HEALTH_UNKNOWN");
  if (deviceHealth.device_health_status === "OFFLINE" || deviceHealth.device_health_status === "BAD") reasonCodes.push("DEVICE_HEALTH_NOT_GOOD");
  if (conflicts.conflict_status === "UNRESOLVED") reasonCodes.push("UNRESOLVED_SENSOR_CONFLICT");
  if (conflicts.sensor_drift_status === "DRIFTING") reasonCodes.push("SENSOR_DRIFTING");
  return {
    evidence_sufficiency: reasonCodes.length ? "NEEDS_EVIDENCE" : "PASS",
    reason_codes: Array.from(new Set(reasonCodes)),
    time_coverage_v1: timeCoverage,
    device_health_snapshot_v1: deviceHealth,
    conflict_detection_v1: conflicts,
  };
}
