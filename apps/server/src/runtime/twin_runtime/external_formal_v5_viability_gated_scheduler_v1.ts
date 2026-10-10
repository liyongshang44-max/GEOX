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

type TerminalSuccessorAdjudicationOutcomeV1 =
  | { status: "NOT_RUN" }
  | { status: "PASS"; adjudication: ExternalFormalSuccessorTerminalAdjudicationResultV1 }
  | { status: "ERROR"; error: unknown };

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
  private lastTerminalSuccessorAdjudicationOutcome: TerminalSuccessorAdjudicationOutcomeV1 = { status: "NOT_RUN" };

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
    // The predecessor terminal commit owns the v3 scheduler contract. A post-COMMIT successor
    // adjudication error must never escape back through that v3 terminal catch and cause a
    // second terminal write for the already-committed predecessor slot.
    this.lastTerminalSuccessorAdjudicationOutcome = { status: "NOT_RUN" };
    await this.inner.recordTerminalResult(input);
    try {
      const adjudication = await this.viability.adjudicateSuccessorAfterTerminal({
        terminal_boundary: input.result.boundary,
        terminal_at: input.result.terminal_at,
      });
      this.lastTerminalSuccessorAdjudicationOutcome = { status: "PASS", adjudication };
    } catch (error) {
      this.lastTerminalSuccessorAdjudicationOutcome = { status: "ERROR", error };
    }
  }

  requireLastTerminalSuccessorAdjudication(): ExternalFormalSuccessorTerminalAdjudicationResultV1 {
    const outcome = this.lastTerminalSuccessorAdjudicationOutcome;
    if (outcome.status === "NOT_RUN") {
      throw new Error("FORMAL_V5_TERMINAL_SUCCESSOR_ADJUDICATION_REQUIRED_AFTER_TERMINAL_COMMIT");
    }
    if (outcome.status === "ERROR") {
      if (outcome.error instanceof Error) throw outcome.error;
      throw new Error(`FORMAL_V5_TERMINAL_SUCCESSOR_ADJUDICATION_FAILED:${String(outcome.error)}`);
    }
    return structuredClone(outcome.adjudication);
  }

  readLastTerminalSuccessorAdjudication(): ExternalFormalSuccessorTerminalAdjudicationResultV1 | null {
    const outcome = this.lastTerminalSuccessorAdjudicationOutcome;
    return outcome.status === "PASS" ? structuredClone(outcome.adjudication) : null;
  }
}
