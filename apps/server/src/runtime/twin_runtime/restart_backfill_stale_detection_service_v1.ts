// MCFT-CAP-09.S4 restart/backfill/stale-detection composition service.
// Boundary: read persisted checkpoint, recover one expired active slot or claim
// the oldest missed slot, freeze Evidence, and report Runtime Health only.

import type {
  AvailabilityPortV1,
  EvidenceIngressPortV1,
  FrozenShadowOnlineEvidenceV1,
  NextTickReadPortV1,
  SchedulerPortV1,
  ShadowOnlineAvailabilitySnapshotV1,
  ShadowOnlineBoundaryV1,
  ShadowOnlineSlotClaimV1,
  TwinScopeKeyV1,
} from "./ports.js";
import type {
  ExpiredSlotRecoveryPortV1,
  ExpiredSlotRecoverySnapshotV1,
} from "./postgres_expired_slot_recovery_adapter_v1.js";

export const RESTART_BACKFILL_STALE_DETECTION_CONFIG_V1 = {
  schema_version: "geox_mcft_cap09_restart_backfill_stale_detection_config_v1",
  restart_source: "PERSISTED_NEXT_TICK_CHECKPOINT",
  active_slot_recovery: "EXPIRED_LEASE_NEW_FENCE_SAME_IDEMPOTENCY",
  missed_slot_order: "OLDEST_ELIGIBLE_FIRST",
  evidence_degradation: ["STALE", "MISSING"] as const,
  health_semantics: "RUNTIME_HEALTH_ONLY_NOT_CROP_HEALTH",
  canonical_write_allowed: false,
  background_daemon_allowed: false,
  production_wiring_allowed: false,
} as const;

export type RestartBackfillClaimResultV1 = {
  status: "CLAIM_READY" | "NO_DUE_SLOT" | "UNAVAILABLE_NO_CHECKPOINT";
  mode: "RECOVERED_EXPIRED_ACTIVE_SLOT" | "CLAIMED_OLDEST_MISSED_SLOT" | "NONE";
  checkpoint_ref: string | null;
  claim: ShadowOnlineSlotClaimV1 | null;
  evidence: FrozenShadowOnlineEvidenceV1 | null;
  runtime_health_status: "HEALTHY" | "DEGRADED" | "UNAVAILABLE";
};

function parseTime(value: string, code: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}
function checkpointRef(snapshot: Awaited<ReturnType<NextTickReadPortV1["readPersistedNextTickSnapshot"]>>): string | null {
  return snapshot?.checkpoint.object_id ?? null;
}
function health(input: { checkpoint: string | null; freshness: "FRESH" | "STALE" | "MISSING"; lag: number }): "HEALTHY" | "DEGRADED" | "UNAVAILABLE" {
  if (!input.checkpoint) return "UNAVAILABLE";
  if (input.freshness !== "FRESH" || input.lag > 0) return "DEGRADED";
  return "HEALTHY";
}

export class RestartBackfillStaleDetectionServiceV1 implements AvailabilityPortV1 {
  constructor(
    private readonly scheduler: SchedulerPortV1,
    private readonly recovery: ExpiredSlotRecoveryPortV1,
    private readonly evidence: EvidenceIngressPortV1,
    private readonly nextTick: NextTickReadPortV1,
  ) {}

  private async operational(boundary: ShadowOnlineBoundaryV1): Promise<ExpiredSlotRecoverySnapshotV1> {
    return this.recovery.inspectOperationalState({
      scope: boundary.scope,
      through_logical_time: boundary.scheduler_wall_clock_observed_at,
    });
  }

  async inspectAvailability(input: {
    scope: TwinScopeKeyV1;
    boundary: ShadowOnlineBoundaryV1;
  }): Promise<ShadowOnlineAvailabilitySnapshotV1> {
    const persisted = await this.nextTick.readPersistedNextTickSnapshot(input.scope);
    const operational = await this.operational(input.boundary);
    const frozen = await this.evidence.freezeEligibleEvidence({ boundary: input.boundary });
    const missed = operational.active_slot_id
      ? []
      : await this.scheduler.listMissedSlots({
          scope: input.scope,
          through_logical_time: input.boundary.scheduler_wall_clock_observed_at,
        });
    const oldest = operational.active_slot_id ?? missed[0]?.slot_id ?? null;
    return {
      scope: { ...input.scope },
      observed_at: operational.observed_at,
      checkpoint_ref: checkpointRef(persisted),
      durable_cursor_slot_id: operational.durable_cursor_slot_id,
      oldest_missed_slot_id: oldest,
      scheduler_lag_seconds: operational.scheduler_lag_seconds,
      evidence_freshness_status: frozen.freshness_status,
      runtime_health_status: health({
        checkpoint: checkpointRef(persisted),
        freshness: frozen.freshness_status,
        lag: operational.scheduler_lag_seconds,
      }),
    };
  }

  async recoverOrClaimOldestDueSlot(input: {
    scope: TwinScopeKeyV1;
    through_logical_time: string;
    lease_owner: string;
    lease_duration_seconds: number;
  }): Promise<RestartBackfillClaimResultV1> {
    parseTime(input.through_logical_time, "S4_THROUGH_LOGICAL_TIME_INVALID");
    const persisted = await this.nextTick.readPersistedNextTickSnapshot(input.scope);
    const checkpoint = checkpointRef(persisted);
    if (!checkpoint) {
      return { status: "UNAVAILABLE_NO_CHECKPOINT", mode: "NONE", checkpoint_ref: null, claim: null, evidence: null, runtime_health_status: "UNAVAILABLE" };
    }
    const recovered = await this.recovery.recoverExpiredActiveSlot(input);
    let claim = recovered;
    let mode: RestartBackfillClaimResultV1["mode"] = recovered ? "RECOVERED_EXPIRED_ACTIVE_SLOT" : "NONE";
    if (!claim) {
      const missed = await this.scheduler.listMissedSlots({ scope: input.scope, through_logical_time: input.through_logical_time });
      if (missed.length) {
        claim = await this.scheduler.claimDueSlot({
          boundary: missed[0],
          lease_owner: input.lease_owner,
          lease_duration_seconds: input.lease_duration_seconds,
        });
        mode = "CLAIMED_OLDEST_MISSED_SLOT";
      }
    }
    if (!claim) {
      return { status: "NO_DUE_SLOT", mode: "NONE", checkpoint_ref: checkpoint, claim: null, evidence: null, runtime_health_status: "HEALTHY" };
    }
    const frozen = await this.evidence.freezeEligibleEvidence({ boundary: claim.boundary });
    const lag = Math.max(0, Math.floor((Date.parse(input.through_logical_time) - Date.parse(claim.boundary.logical_time)) / 1000));
    return {
      status: "CLAIM_READY",
      mode,
      checkpoint_ref: checkpoint,
      claim,
      evidence: frozen,
      runtime_health_status: health({ checkpoint, freshness: frozen.freshness_status, lag }),
    };
  }
}
