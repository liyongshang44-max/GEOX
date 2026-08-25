import type {
  SchedulerPortV1,
  ShadowOnlineBoundaryV1,
  ShadowOnlineSlotClaimV1,
  ShadowOnlineTerminalSlotResultV1,
  TwinScopeKeyV1,
} from "./ports.js";
import type {
  ExternalFormalNextTickViabilityResultV1,
  ExternalFormalSuccessorTerminalAdjudicationResultV1,
  ExternalFormalTerminalSuccessorViabilityPortV1,
} from "./postgres_external_formal_next_tick_viability_v1.js";

export const MCFT_CAP09_FORMAL_V5_VIABILITY_GATED_SCHEDULER_ID_V1 =
  "FORMAL_V5_VIABILITY_GATED_SCHEDULER_V1" as const;

type SchedulerPortSubsetV1 = Pick<SchedulerPortV1, "listMissedSlots" | "claimDueSlot" | "recordTerminalResult">;

export class ExternalFormalNextTickNotViablePreclaimErrorV1 extends Error {
  readonly code = "NEXT_TICK_FORCING_NOT_VIABLE_PRECLAIM" as const;

  constructor(
    readonly boundary: ShadowOnlineBoundaryV1,
    readonly viability: Extract<ExternalFormalNextTickViabilityResultV1, { status: "NOT_VIABLE" }>,
  ) {
    super(`${viability.reason}:${viability.detail}`);
    this.name = "ExternalFormalNextTickNotViablePreclaimErrorV1";
  }
}

export class ExternalFormalV5ViabilityGatedSchedulerV1 implements SchedulerPortSubsetV1 {
  readonly adapter_id = MCFT_CAP09_FORMAL_V5_VIABILITY_GATED_SCHEDULER_ID_V1;
  private lastTerminalSuccessorAdjudication: ExternalFormalSuccessorTerminalAdjudicationResultV1 | null = null;

  constructor(
    private readonly inner: SchedulerPortSubsetV1,
    private readonly viability: ExternalFormalTerminalSuccessorViabilityPortV1,
  ) {}

  async listMissedSlots(input: { scope: TwinScopeKeyV1; through_logical_time: string }): Promise<readonly ShadowOnlineBoundaryV1[]> {
    return this.inner.listMissedSlots(input);
  }

  async claimDueSlot(input: {
    boundary: ShadowOnlineBoundaryV1;
    lease_owner: string;
    lease_duration_seconds: number;
  }): Promise<ShadowOnlineSlotClaimV1> {
    const adjudication = await this.viability.checkPreclaimViability(input.boundary);
    if (adjudication.status !== "PASS") {
      throw new ExternalFormalNextTickNotViablePreclaimErrorV1(input.boundary, adjudication);
    }
    return this.inner.claimDueSlot(input);
  }

  async recordTerminalResult(input: { claim: ShadowOnlineSlotClaimV1; result: ShadowOnlineTerminalSlotResultV1 }): Promise<void> {
    // First commit the current slot terminal result and advance the durable runtime cursor.
    // Only after that committed transition can successor identity be adjudicated exactly.
    await this.inner.recordTerminalResult(input);
    this.lastTerminalSuccessorAdjudication = await this.viability.adjudicateSuccessorAfterTerminal({
      terminal_boundary: input.result.boundary,
      terminal_at: input.result.terminal_at,
    });
  }

  readLastTerminalSuccessorAdjudication(): ExternalFormalSuccessorTerminalAdjudicationResultV1 | null {
    return this.lastTerminalSuccessorAdjudication === null
      ? null
      : structuredClone(this.lastTerminalSuccessorAdjudication);
  }
}
