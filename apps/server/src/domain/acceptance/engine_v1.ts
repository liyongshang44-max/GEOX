export function evaluateAcceptanceV1(input: {
  action_type: string
  parameters: Record<string, any>
  telemetry: Record<string, any>
}): {
  result: "PASSED" | "FAILED" | "INCONCLUSIVE"
  score?: number
  metrics: Record<string, number>
} {
  const { action_type, parameters, telemetry } = input

  if (action_type !== "IRRIGATE") {
    return { result: "INCONCLUSIVE", metrics: {} }
  }

  const expected = Number(parameters.duration_min)
  const actual = Number(telemetry.duration_min)

  if (!Number.isFinite(expected) || expected <= 0 || !Number.isFinite(actual) || actual <= 0) {
    return { result: "INCONCLUSIVE", metrics: {} }
  }

  const ratio = actual / expected

  return {
    result: ratio >= 0.8 ? "PASSED" : "FAILED",
    score: ratio,
    metrics: {
      actual_duration: actual
    }
  }
}
