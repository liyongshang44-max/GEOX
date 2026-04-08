import { refreshFieldFertilityStateV1 } from "../projections/field_fertility_state_v1";
import { refreshFieldSensingOverviewV1 } from "../projections/field_sensing_overview_v1";
import type { Pool, PoolClient } from "pg";

type DbConn = Pool | PoolClient;

type Freshness = "fresh" | "stale" | "unknown";
type RefreshStatus = "ok" | "fallback_stale" | "no_data" | "error";

type SnapshotEntry<T> = {
  payload: T;
  refreshed_ts_ms: number;
  freshness: Freshness;
};

type RefreshStats = {
  refresh_total: number;
  refresh_fail_total: number;
  retry_total: number;
  last_duration_ms: number | null;
  last_success_ts_ms: number | null;
  last_failure_ts_ms: number | null;
};

type RefreshTracking = {
  last_success_ts: number | null;
  failure_count: number;
  latency_ms: number | null;
  attempts: number;
};

type RefreshOutput<T> = {
  payload: T | null;
  status: RefreshStatus;
  freshness: Freshness;
  refreshed_ts_ms: number | null;
  refresh_metrics: RefreshStats & { attempts: number };
  refresh_tracking: RefreshTracking;
};

const RETRY_LIMIT = 2;
const FERTILITY_STALE_WINDOW_MS = 1000 * 60 * 60 * 12;

const snapshotStore = new Map<string, SnapshotEntry<any>>();
const metricsStore = new Map<string, RefreshStats>();

function getMetrics(key: string): RefreshStats {
  const current = metricsStore.get(key);
  if (current) return current;
  const seeded: RefreshStats = {
    refresh_total: 0,
    refresh_fail_total: 0,
    retry_total: 0,
    last_duration_ms: null,
    last_success_ts_ms: null,
    last_failure_ts_ms: null,
  };
  metricsStore.set(key, seeded);
  return seeded;
}

function fertilityFreshnessFromComputedAt(computed_at_ts_ms: number | null, nowMs: number): Freshness {
  if (!Number.isFinite(computed_at_ts_ms) || computed_at_ts_ms == null) return "unknown";
  return nowMs - computed_at_ts_ms <= FERTILITY_STALE_WINDOW_MS ? "fresh" : "stale";
}

function buildRefreshTracking(metrics: RefreshStats, attempts: number): RefreshTracking {
  return {
    last_success_ts: metrics.last_success_ts_ms,
    failure_count: metrics.refresh_fail_total,
    latency_ms: metrics.last_duration_ms,
    attempts,
  };
}

function withProjectionStatus<T extends object>(payload: T, status: RefreshStatus, freshness: Freshness): T & { status: RefreshStatus; freshness: Freshness } {
  return {
    ...payload,
    status,
    freshness,
  };
}

async function refreshWithFallback<T extends object>(params: {
  key: string;
  refresher: () => Promise<T>;
  resolveFreshness: (payload: T, nowMs: number) => Freshness;
  hasData: (payload: T) => boolean;
}): Promise<RefreshOutput<T>> {
  const nowMs = Date.now();
  const metrics = getMetrics(params.key);
  metrics.refresh_total += 1;

  let attempts = 0;
  let lastError: unknown = null;

  while (attempts < RETRY_LIMIT) {
    attempts += 1;
    const startedAt = Date.now();
    try {
      const payload = await params.refresher();
      const duration = Date.now() - startedAt;
      metrics.last_duration_ms = duration;
      const freshness = params.resolveFreshness(payload, nowMs);
      if (!params.hasData(payload)) {
        return {
          payload: withProjectionStatus(payload, "no_data", freshness),
          status: "no_data",
          freshness,
          refreshed_ts_ms: null,
          refresh_metrics: { ...metrics, attempts },
          refresh_tracking: buildRefreshTracking(metrics, attempts),
        };
      }
      snapshotStore.set(params.key, {
        payload,
        refreshed_ts_ms: nowMs,
        freshness,
      });
      metrics.last_success_ts_ms = nowMs;
      return {
        payload: withProjectionStatus(payload, "ok", freshness),
        status: "ok",
        freshness,
        refreshed_ts_ms: nowMs,
        refresh_metrics: { ...metrics, attempts },
        refresh_tracking: buildRefreshTracking(metrics, attempts),
      };
    } catch (error) {
      lastError = error;
      metrics.refresh_fail_total += 1;
      metrics.last_failure_ts_ms = Date.now();
      if (attempts < RETRY_LIMIT) metrics.retry_total += 1;
    }
  }

  const fallback = snapshotStore.get(params.key) as SnapshotEntry<T> | undefined;
  if (fallback) {
    return {
      payload: withProjectionStatus(fallback.payload, "fallback_stale", "stale"),
      status: "fallback_stale",
      freshness: "stale",
      refreshed_ts_ms: fallback.refreshed_ts_ms,
      refresh_metrics: { ...metrics, attempts },
      refresh_tracking: buildRefreshTracking(metrics, attempts),
    };
  }

  void lastError;
  return {
    payload: null,
    status: "error",
    freshness: "unknown",
    refreshed_ts_ms: null,
    refresh_metrics: { ...metrics, attempts },
    refresh_tracking: buildRefreshTracking(metrics, attempts),
  };
}

export async function refreshFieldReadModelsWithObservabilityV1(db: DbConn, params: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
}): Promise<{
  sensing_overview: RefreshOutput<Awaited<ReturnType<typeof refreshFieldSensingOverviewV1>>>;
  fertility_state: RefreshOutput<Awaited<ReturnType<typeof refreshFieldFertilityStateV1>>>;
}> {
  const base = {
    tenant_id: params.tenant_id,
    project_id: params.project_id,
    group_id: params.group_id,
    field_id: params.field_id,
  };

  const [sensing_overview, fertility_state] = await Promise.all([
    refreshWithFallback({
      key: `sensing_overview:${params.tenant_id}:${params.project_id}:${params.group_id}:${params.field_id}`,
      refresher: () => refreshFieldSensingOverviewV1(db, base),
      resolveFreshness: (payload) => payload.freshness,
      hasData: (payload) => {
        if (Array.isArray(payload.soil_indicators_json) && payload.soil_indicators_json.length > 0) return true;
        return Boolean(
          payload.canopy_temp_status
          || payload.evapotranspiration_risk
          || payload.sensor_quality
          || payload.irrigation_effectiveness
          || payload.leak_risk
          || payload.computed_at_ts_ms
          || payload.source_observed_at_ts_ms
        );
      },
    }),
    refreshWithFallback({
      key: `fertility_state:${params.tenant_id}:${params.project_id}:${params.group_id}:${params.field_id}`,
      refresher: () => refreshFieldFertilityStateV1(db, base),
      resolveFreshness: (payload, nowMs) => fertilityFreshnessFromComputedAt(payload.computed_at_ts_ms, nowMs),
      hasData: (payload) => Boolean(payload.fertility_level || payload.salinity_risk || payload.recommendation_bias || payload.computed_at_ts_ms),
    }),
  ]);

  return { sensing_overview, fertility_state };
}
