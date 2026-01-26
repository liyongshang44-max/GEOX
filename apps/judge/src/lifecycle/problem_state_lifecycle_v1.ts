/**
 * File: apps/judge/src/lifecycle/problem_state_lifecycle_v1.ts
 *
 * GEOX · Sprint 9 · ProblemState Lifecycle v1 (Governance Index)
 *
 * Scope:
 * - Computes governance-only index rows for ProblemStateV1 instances.
 * - Does NOT modify ProblemStateV1 schema or write to Facts/Ledger.
 *
 * Determinism:
 * - All decisions use injected asOfTs.
 * - Window math is pure arithmetic; no Date.now().
 *
 * Frozen semantics (v1):
 * - If a problem_state_id is in frozen_ids, it is lifecycle_state=FROZEN.
 * - A FROZEN instance cannot supersede others AND cannot be superseded by others.
 * - For FROZEN rows, superseded_by MUST be null.
 *
 * Expire semantics (v1):
 * - Expiration is STRICT: asOfTs > window.endTs + EXPIRE_AFTER_MS.
 *
 * Constants:
 * - For backwards fixture compatibility, the engine accepts multiple key styles:
 *   - EXPIRE_AFTER_MS / expire_after_ms / expireAfterMs
 *   - EXPIRY_BUFFER_MS / expiry_buffer_ms / expiryBufferMs   (alias of EXPIRE_AFTER_MS)
 *   - MERGE_OVERLAP_RATIO / merge_overlap_ratio / mergeOverlapRatio
 */

export type ProblemStateV1Like = {
  problem_state_id: string; // Stable id
  created_at_ts: number; // Creation timestamp (ms)
  subjectRef: Record<string, unknown>; // Identity anchor (opaque)
  scale: string; // Scale discriminator
  window: { startTs: number; endTs: number }; // Evidence window
  problem_type: string; // Problem type discriminator
  input_digest?: string | null; // Evidence-set digest (optional in type; required by governance semantics)
};

export type LifecycleConstantsV1 = {
  MERGE_OVERLAP_RATIO: number; // Overlap threshold (0..1)
  EXPIRE_AFTER_MS: number; // Expiry buffer in ms
};

export type ComputeIndexInputV1 = {
  problem_states: ProblemStateV1Like[]; // Input set
  asOfTs: number; // Deterministic "now"
  constants: Record<string, unknown>; // Constants (various key styles accepted)
  frozen_ids?: string[]; // Governance freeze set
};

export type ProblemStateIndexRowV1 = {
  problem_state_id: string; // Primary key
  lifecycle_state: "ACTIVE" | "SUPERSEDED" | "EXPIRED" | "FROZEN"; // Derived state
  superseded_by: string | null; // Superseder id (same key-space)
};

function stableJson(x: unknown): string {
  // Deterministic JSON stringify (sort keys recursively)
  if (x === null || x === undefined) return String(x);
  if (typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return `[${x.map(stableJson).join(",")}]`;
  const obj = x as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`);
  return `{${parts.join(",")}}`;
}

function normalizeConstants(constants: Record<string, unknown>): LifecycleConstantsV1 {
  // Helper to pull a numeric constant from multiple possible keys.
  const pickNumber = (keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = (constants as any)[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return undefined;
  };

  const mergeOverlap = pickNumber(["MERGE_OVERLAP_RATIO", "merge_overlap_ratio", "mergeOverlapRatio"]);
  const expireAfter =
    pickNumber(["EXPIRE_AFTER_MS", "expire_after_ms", "expireAfterMs"]) ??
    pickNumber(["EXPIRY_BUFFER_MS", "expiry_buffer_ms", "expiryBufferMs"]); // Alias support

  if (mergeOverlap === undefined) {
    throw new Error("constants.MERGE_OVERLAP_RATIO must be a finite number");
  }
  if (expireAfter === undefined) {
    throw new Error("constants.EXPIRE_AFTER_MS must be a finite number");
  }

  return { MERGE_OVERLAP_RATIO: mergeOverlap, EXPIRE_AFTER_MS: expireAfter };
}

function keyOf(ps: ProblemStateV1Like): string {
  // Governance grouping key: subjectRef + scale + problem_type + input_digest
  const digest = ps.input_digest ?? "";
  return [stableJson(ps.subjectRef), ps.scale, ps.problem_type, digest].join("|");
}

function overlapRatio(a: { startTs: number; endTs: number }, b: { startTs: number; endTs: number }): number {
  // Overlap ratio = intersection / min(durationA, durationB)
  const aLen = Math.max(0, a.endTs - a.startTs);
  const bLen = Math.max(0, b.endTs - b.startTs);
  if (aLen === 0 || bLen === 0) return 0;

  const interStart = Math.max(a.startTs, b.startTs);
  const interEnd = Math.min(a.endTs, b.endTs);
  const interLen = Math.max(0, interEnd - interStart);
  return interLen / Math.min(aLen, bLen);
}

function contains(outer: { startTs: number; endTs: number }, inner: { startTs: number; endTs: number }): boolean {
  // Containment is inclusive.
  return outer.startTs <= inner.startTs && outer.endTs >= inner.endTs;
}

function isExpired(asOfTs: number, endTs: number, expireAfterMs: number): boolean {
  // IMPORTANT: strict ">" per frozen v1.
  return asOfTs > endTs + expireAfterMs;
}

export function computeProblemStateIndexV1(input: ComputeIndexInputV1): ProblemStateIndexRowV1[] {
  const { problem_states, asOfTs, frozen_ids } = input;
  const constants = normalizeConstants(input.constants ?? {}); // Normalize constants deterministically
  const frozenSet = new Set((frozen_ids ?? []).map(String)); // Normalize frozen ids

  // Group ProblemStates by governance key
  const groups = new Map<string, ProblemStateV1Like[]>();
  for (const ps of problem_states ?? []) {
    const k = keyOf(ps);
    const arr = groups.get(k) ?? [];
    arr.push(ps);
    groups.set(k, arr);
  }

  const rows: ProblemStateIndexRowV1[] = [];

  for (const [, arr] of groups) {
    // Deterministic ordering: created_at_ts asc, then id
    const sorted = [...arr].sort((x, y) => {
      const dt = (x.created_at_ts ?? 0) - (y.created_at_ts ?? 0);
      if (dt !== 0) return dt;
      return String(x.problem_state_id).localeCompare(String(y.problem_state_id));
    });

    // Supersession edges: older -> newer (Containment > OverlapThreshold)
    const supersededBy = new Map<string, string>();

    for (let i = 0; i < sorted.length; i++) {
      const older = sorted[i];
      const olderId = String(older.problem_state_id);

      // Frozen instances do not participate in supersession graph.
      if (frozenSet.has(olderId)) continue;

      // Skip if already superseded.
      if (supersededBy.has(olderId)) continue;

      for (let j = i + 1; j < sorted.length; j++) {
        const newer = sorted[j];
        const newerId = String(newer.problem_state_id);

        // Frozen instances do not participate in supersession graph.
        if (frozenSet.has(newerId)) continue;

        const olderW = older.window;
        const newerW = newer.window;

        if (contains(newerW, olderW)) {
          supersededBy.set(olderId, newerId);
          break;
        }

        const r = overlapRatio(olderW, newerW);
        if (r >= constants.MERGE_OVERLAP_RATIO) {
          supersededBy.set(olderId, newerId);
          break;
        }
      }
    }

    // Emit rows for this group
    for (const ps of sorted) {
      const id = String(ps.problem_state_id);
      const sup = supersededBy.get(id) ?? null;

      let lifecycle_state: ProblemStateIndexRowV1["lifecycle_state"];
      let superseded_by: string | null = sup;

      if (frozenSet.has(id)) {
        lifecycle_state = "FROZEN";
        superseded_by = null; // Forced by v1 (cannot be superseded)
      } else if (sup) {
        lifecycle_state = "SUPERSEDED";
      } else if (isExpired(asOfTs, ps.window.endTs, constants.EXPIRE_AFTER_MS)) {
        lifecycle_state = "EXPIRED";
      } else {
        lifecycle_state = "ACTIVE";
      }

      rows.push({
        problem_state_id: id,
        lifecycle_state,
        superseded_by,
      });
    }
  }

  // Stable output ordering (not semantically meaningful)
  return rows.sort((a, b) => String(a.problem_state_id).localeCompare(String(b.problem_state_id)));
}

// Default export for CJS interop convenience.
const defaultExport = { computeProblemStateIndexV1 };
export default defaultExport;
