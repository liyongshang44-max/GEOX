// MCFT-CAP-09.S5 one-slot Shadow-online canonical integration composition.
// Boundary: recover/claim one due slot, run one unchanged canonical Tick through the
// S5 adapter, and terminalize the same scheduler claim. No timer loop, daemon, route,
// public writer, recommendation, approval, action, dispatch, or model activation.

import type {
  SchedulerPortV1,
  ShadowOnlineSlotClaimV1,
  TwinScopeKeyV1,
} from "./ports.js";
import type {
  RestartBackfillClaimResultV1,
  RestartBackfillStaleDetectionServiceV1,
} from "./restart_backfill_stale_detection_service_v1.js";
import type {
  ExecuteShadowOnlineCanonicalTickInputV1,
  ExecuteShadowOnlineCanonicalTickResultV1,
  ShadowOnlineCanonicalTickPortV1,
} from "./postgres_cap04_shadow_online_canonical_tick_adapter_v1.js";

export const SHADOW_ONLINE_CANONICAL_INTEGRATION_CONFIG_V1 = {
  schema_version: "geox_mcft_cap09_shadow_online_canonical_integration_config_v1",
  execution_model: "CALLER_INVOKED_ONE_SLOT_ONLY",
  canonical_core: "UNCHANGED_CAP08_S1_CAP04_RUNTIME",
  canonical_families: ["A", "B", "C", "F"] as const,
  h_policy: "READ_ONLY_WHEN_EXISTING_TRUSTWORTHY_EVIDENCE_IS_PRESENT",
  g_allowed: false,
  action_creation_allowed: false,
  background_scheduler_allowed: false,
  public_http_writer_allowed: false,
  model_activation_allowed: false,
  production_wiring_allowed: false,
} as const;

export type ExecuteOldestDueShadowOnlineTickInputV1 = {
  scope: TwinScopeKeyV1;
  through_logical_time: string;
  lease_owner: string;
  lease_duration_seconds: number;
  terminal_at: string;
  canonical_input: ExecuteShadowOnlineCanonicalTickInputV1["canonical_input"];
};

export type ExecuteOldestDueShadowOnlineTickResultV1 =
  | {
      status: "NO_CANONICAL_TICK";
      preparation: RestartBackfillClaimResultV1;
      canonical: null;
    }
  | {
      status: "CANONICAL_TICK_TERMINAL";
      preparation: RestartBackfillClaimResultV1 & {
        claim: ShadowOnlineSlotClaimV1;
        evidence: NonNullable<RestartBackfillClaimResultV1["evidence"]>;
      };
      canonical: ExecuteShadowOnlineCanonicalTickResultV1;
      terminal_state: "COMPLETED" | "DEGRADED";
    };

function canonicalInstantV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(code);
  }
  return value;
}

export class ShadowOnlineCanonicalIntegrationServiceV1 {
  constructor(
    private readonly preparation: RestartBackfillStaleDetectionServiceV1,
    private readonly scheduler: SchedulerPortV1,
    private readonly canonical: ShadowOnlineCanonicalTickPortV1,
  ) {}

  async executeOldestDueTick(
    input: ExecuteOldestDueShadowOnlineTickInputV1,
  ): Promise<ExecuteOldestDueShadowOnlineTickResultV1> {
    canonicalInstantV1(input.through_logical_time, "S5_THROUGH_LOGICAL_TIME_INVALID");
    canonicalInstantV1(input.terminal_at, "S5_TERMINAL_AT_INVALID");
    const prepared = await this.preparation.recoverOrClaimOldestDueSlot({
      scope: input.scope,
      through_logical_time: input.through_logical_time,
      lease_owner: input.lease_owner,
      lease_duration_seconds: input.lease_duration_seconds,
    });
    if (prepared.status !== "CLAIM_READY" || !prepared.claim || !prepared.evidence) {
      return {
        status: "NO_CANONICAL_TICK",
        preparation: prepared,
        canonical: null,
      };
    }

    const claim = prepared.claim;
    if (input.canonical_input.logical_time !== claim.boundary.logical_time
        || input.canonical_input.lease_owner !== claim.lease_owner) {
      throw new Error("S5_CANONICAL_INPUT_MUST_BIND_SCHEDULER_CLAIM");
    }
    const canonical = await this.canonical.executeOneTick({
      claim,
      evidence: prepared.evidence,
      canonical_input: input.canonical_input,
    });
    const terminalState = prepared.runtime_health_status === "HEALTHY"
      && canonical.forecast_status === "COMPLETED"
      ? "COMPLETED"
      : "DEGRADED";
    await this.scheduler.recordTerminalResult({
      claim,
      result: {
        boundary: structuredClone(claim.boundary),
        state: terminalState,
        tick_ref: canonical.tick_ref,
        health_ref: canonical.health_ref,
        terminal_at: input.terminal_at,
      },
    });
    return {
      status: "CANONICAL_TICK_TERMINAL",
      preparation: {
        ...prepared,
        claim,
        evidence: prepared.evidence,
      },
      canonical,
      terminal_state: terminalState,
    };
  }
}
