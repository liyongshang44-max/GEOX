import type { PoolClient } from "pg";

export type MqttProjectionDispositionV1 =
  | { kind: "OBSERVATION_ACCEPTED" }
  | { kind: "RAW_COMMITTED_PROJECTION_REJECTED"; error: "DEVICE_OBSERVATION_VALUE_NOT_NUMERIC" };

export function isDurableMqttObservationProjectionFailureV1(error: unknown): boolean {
  return error instanceof Error && error.message === "DEVICE_OBSERVATION_VALUE_NOT_NUMERIC";
}

/**
 * The caller must already have written the authenticated raw source fact
 * inside the current transaction.
 *
 * Only the legacy numeric-representation failure is allowed to partially
 * commit. Any other downstream failure is rethrown so the outer transaction
 * owner can preserve historical all-or-nothing rollback semantics.
 */
export async function runMqttObservationProjectionV1(
  conn: Pick<PoolClient, "query">,
  writeObservation: () => Promise<unknown>,
): Promise<MqttProjectionDispositionV1> {
  try {
    await writeObservation();
    return { kind: "OBSERVATION_ACCEPTED" };
  } catch (error) {
    if (!isDurableMqttObservationProjectionFailureV1(error)) throw error;
    await conn.query("COMMIT");
    return {
      kind: "RAW_COMMITTED_PROJECTION_REJECTED",
      error: "DEVICE_OBSERVATION_VALUE_NOT_NUMERIC",
    };
  }
}
