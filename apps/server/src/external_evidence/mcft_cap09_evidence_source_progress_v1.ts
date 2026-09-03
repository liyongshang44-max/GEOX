// MCFT-CAP-09 production Evidence source-specific durable progress view.
// Boundary: read-only composition over EvidenceSupplyCursor snapshots.
// No provider fetch, target selection, due policy, acquisition horizon, cursor advance,
// RuntimeTickCursor, Twin state, process lifecycle, environment, or production activation.

import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import type {
  EvidenceRuntimeScopeV1,
  EvidenceSupplyCursorBindingSetReadPortV1,
  EvidenceSupplyCursorSnapshotV1,
} from "./mcft_cap09_evidence_runtime_persistence_v1.js";

export const MCFT_CAP09_EVIDENCE_SOURCE_PROGRESS_READER_ID_V1 =
  "MCFT_CAP09_EVIDENCE_SOURCE_PROGRESS_READER_V1" as const;

export const MCFT_CAP09_KBS_RAIN_ORIGIN_SOURCE_ID_V1 =
  "KBS002-007.142:rain_mm" as const;
export const MCFT_CAP09_KBS_HISTORICAL_ET0_ORIGIN_SOURCE_ID_V1 =
  "KBS002-007.142:ASCE_SHORT_REFERENCE_ET0" as const;
export const MCFT_CAP09_KBS_SOIL_ORIGIN_SOURCE_ID_V1 =
  "KBS_LTER_CURRENT_WEATHER_VARIATE_25" as const;

export type EvidenceSourcePairStateV1 = "ABSENT" | "PARTIAL" | "PAIRED";

export type KbsRawHourlyPairProgressV1 = {
  state: EvidenceSourcePairStateV1;
  rainfall: EvidenceSupplyCursorSnapshotV1 | null;
  historical_et0: EvidenceSupplyCursorSnapshotV1 | null;
  paired_contiguous_through: string | null;
  pair_skew_seconds: number | null;
};

export type GfsCyclePairProgressV1 = {
  cycle_key: string;
  cycle_issued_at: string;
  state: "PARTIAL" | "PAIRED";
  weather: EvidenceSupplyCursorSnapshotV1 | null;
  future_et0: EvidenceSupplyCursorSnapshotV1 | null;
  paired_valid_from: string | null;
};

export type EvidenceSourceSpecificProgressV1 = {
  reader_id: typeof MCFT_CAP09_EVIDENCE_SOURCE_PROGRESS_READER_ID_V1;
  kbs_raw_hourly: KbsRawHourlyPairProgressV1;
  gfs_bundle: {
    cycles: readonly GfsCyclePairProgressV1[];
    complete_pair_count: number;
    partial_pair_count: number;
  };
  kbs_soil: {
    latest: EvidenceSupplyCursorSnapshotV1 | null;
  };
};

const SOURCE_BINDINGS = [
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
] as const;

function canonicalIsoV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return new Date(parsed).toISOString();
}

function pairStateV1(
  left: EvidenceSupplyCursorSnapshotV1 | null,
  right: EvidenceSupplyCursorSnapshotV1 | null,
): EvidenceSourcePairStateV1 {
  if (!left && !right) return "ABSENT";
  if (!left || !right) return "PARTIAL";
  return "PAIRED";
}

function exactOriginV1(
  rows: readonly EvidenceSupplyCursorSnapshotV1[],
  bindingId: string,
  originSourceId: string,
  code: string,
): EvidenceSupplyCursorSnapshotV1 | null {
  const matching = rows.filter((row) => row.binding_id === bindingId);
  for (const row of matching) {
    if (row.origin_source_id !== originSourceId) {
      throw new Error(code + "_UNEXPECTED_ORIGIN:" + row.origin_source_id);
    }
  }
  if (matching.length > 1) throw new Error(code + "_CARDINALITY");
  return matching[0] ?? null;
}

function gfsCycleIdentityV1(
  originSourceId: string,
  suffix: string,
  code: string,
): { cycle_key: string; cycle_issued_at: string } {
  const prefix = "gfs_";
  if (!originSourceId.startsWith(prefix) || !originSourceId.endsWith(suffix)) {
    throw new Error(code + "_ORIGIN_INVALID:" + originSourceId);
  }
  const key = originSourceId.slice(prefix.length, originSourceId.length - suffix.length);
  const match = /^(\d{4})(\d{2})(\d{2})t(\d{2})(\d{2})(\d{2})z$/.exec(key);
  if (!match) throw new Error(code + "_CYCLE_KEY_INVALID:" + key);
  const iso = match[1] + "-" + match[2] + "-" + match[3] + "T" +
    match[4] + ":" + match[5] + ":" + match[6] + ".000Z";
  if (canonicalIsoV1(iso, code + "_CYCLE_TIME_INVALID") !== iso) {
    throw new Error(code + "_CYCLE_TIME_NONCANONICAL");
  }
  return { cycle_key: key, cycle_issued_at: iso };
}

function roleTimeV1(
  row: EvidenceSupplyCursorSnapshotV1,
  field: string,
  code: string,
): string {
  return canonicalIsoV1(row.role_time[field], code);
}

function minIsoV1(a: string, b: string): string {
  return Date.parse(a) <= Date.parse(b) ? a : b;
}

export class EvidenceSourceSpecificProgressReaderV1 {
  readonly reader_id = MCFT_CAP09_EVIDENCE_SOURCE_PROGRESS_READER_ID_V1;

  constructor(private readonly cursorReader: EvidenceSupplyCursorBindingSetReadPortV1) {}

  async readProgress(input: {
    scope: EvidenceRuntimeScopeV1;
  }): Promise<EvidenceSourceSpecificProgressV1> {
    const rows = await this.cursorReader.readSupplyCursorsByBindings({
      scope: input.scope,
      binding_ids: SOURCE_BINDINGS,
    });

    const rainfall = exactOriginV1(
      rows,
      MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
      MCFT_CAP09_KBS_RAIN_ORIGIN_SOURCE_ID_V1,
      "PRODUCTION_EVIDENCE_KBS_RAIN_PROGRESS",
    );
    const historicalEt0 = exactOriginV1(
      rows,
      MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
      MCFT_CAP09_KBS_HISTORICAL_ET0_ORIGIN_SOURCE_ID_V1,
      "PRODUCTION_EVIDENCE_KBS_ET0_PROGRESS",
    );
    const soil = exactOriginV1(
      rows,
      MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
      MCFT_CAP09_KBS_SOIL_ORIGIN_SOURCE_ID_V1,
      "PRODUCTION_EVIDENCE_KBS_SOIL_PROGRESS",
    );

    const kbsState = pairStateV1(rainfall, historicalEt0);
    const kbsPairedThrough = rainfall && historicalEt0
      ? minIsoV1(rainfall.event_time_contiguous_through, historicalEt0.event_time_contiguous_through)
      : null;
    const kbsSkewSeconds = rainfall && historicalEt0
      ? Math.abs(
          Date.parse(rainfall.event_time_contiguous_through) -
          Date.parse(historicalEt0.event_time_contiguous_through)
        ) / 1000
      : null;

    const cycleMap = new Map<string, {
      cycle_key: string;
      cycle_issued_at: string;
      weather: EvidenceSupplyCursorSnapshotV1 | null;
      future_et0: EvidenceSupplyCursorSnapshotV1 | null;
    }>();

    for (const row of rows) {
      let role: "weather" | "future_et0" | null = null;
      let cycle: { cycle_key: string; cycle_issued_at: string } | null = null;
      if (row.binding_id === MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1) {
        role = "weather";
        cycle = gfsCycleIdentityV1(
          row.origin_source_id,
          "_pgrb2_0p25_kbs",
          "PRODUCTION_EVIDENCE_GFS_WEATHER_PROGRESS",
        );
      } else if (row.binding_id === MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1) {
        role = "future_et0";
        cycle = gfsCycleIdentityV1(
          row.origin_source_id,
          "_asce_short_reference_et0_kbs",
          "PRODUCTION_EVIDENCE_GFS_ET0_PROGRESS",
        );
      }
      if (!role || !cycle) continue;

      const existing = cycleMap.get(cycle.cycle_key) ?? {
        cycle_key: cycle.cycle_key,
        cycle_issued_at: cycle.cycle_issued_at,
        weather: null,
        future_et0: null,
      };
      if (existing.cycle_issued_at !== cycle.cycle_issued_at) {
        throw new Error("PRODUCTION_EVIDENCE_GFS_CYCLE_IDENTITY_CONFLICT");
      }
      if (existing[role]) {
        throw new Error("PRODUCTION_EVIDENCE_GFS_CYCLE_ROLE_CARDINALITY:" + cycle.cycle_key + ":" + role);
      }
      const issuedAt = row.role_time.issued_at === undefined
        ? cycle.cycle_issued_at
        : roleTimeV1(row, "issued_at", "PRODUCTION_EVIDENCE_GFS_ISSUED_AT_INVALID");
      if (issuedAt !== cycle.cycle_issued_at) {
        throw new Error("PRODUCTION_EVIDENCE_GFS_ORIGIN_ISSUED_AT_MISMATCH:" + cycle.cycle_key);
      }
      existing[role] = row;
      cycleMap.set(cycle.cycle_key, existing);
    }

    const cycles: GfsCyclePairProgressV1[] = [...cycleMap.values()]
      .map((cycle) => {
        const state = cycle.weather && cycle.future_et0 ? "PAIRED" as const : "PARTIAL" as const;
        let pairedValidFrom: string | null = null;
        if (cycle.weather && cycle.future_et0) {
          const weatherValidFrom = roleTimeV1(
            cycle.weather,
            "valid_from",
            "PRODUCTION_EVIDENCE_GFS_WEATHER_VALID_FROM_INVALID",
          );
          const et0ValidFrom = roleTimeV1(
            cycle.future_et0,
            "valid_from",
            "PRODUCTION_EVIDENCE_GFS_ET0_VALID_FROM_INVALID",
          );
          if (weatherValidFrom !== et0ValidFrom) {
            throw new Error(
              "PRODUCTION_EVIDENCE_GFS_PAIR_VALID_FROM_SKEW:" +
              cycle.cycle_key + ":" + weatherValidFrom + ":" + et0ValidFrom
            );
          }
          pairedValidFrom = weatherValidFrom;
        }
        return {
          cycle_key: cycle.cycle_key,
          cycle_issued_at: cycle.cycle_issued_at,
          state,
          weather: cycle.weather,
          future_et0: cycle.future_et0,
          paired_valid_from: pairedValidFrom,
        };
      })
      .sort((a, b) => Date.parse(b.cycle_issued_at) - Date.parse(a.cycle_issued_at));

    return {
      reader_id: this.reader_id,
      kbs_raw_hourly: {
        state: kbsState,
        rainfall,
        historical_et0: historicalEt0,
        paired_contiguous_through: kbsPairedThrough,
        pair_skew_seconds: kbsSkewSeconds,
      },
      gfs_bundle: {
        cycles,
        complete_pair_count: cycles.filter((cycle) => cycle.state === "PAIRED").length,
        partial_pair_count: cycles.filter((cycle) => cycle.state === "PARTIAL").length,
      },
      kbs_soil: {
        latest: soil,
      },
    };
  }
}
