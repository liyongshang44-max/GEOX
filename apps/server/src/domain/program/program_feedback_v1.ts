export function deriveProgramFeedbackV1(input: {
  program: any;
  acceptanceResults: any[];
  trajectories: any[];
  recentTasks: any[];
}): {
  current_stage: string;
  current_goal_progress: Record<string, string>;
  next_action_hint?: {
    kind: string;
    reason: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
  };
} {
  const { program, acceptanceResults, trajectories } = input;
  const current_stage = String(program?.current_stage ?? program?.status ?? "EXECUTING").toUpperCase();
  const current_goal_progress: Record<string, string> = {};
  let next_action_hint: { kind: string; reason: string; priority: "LOW" | "MEDIUM" | "HIGH" } | undefined;

  const asTs = (item: any): number => {
    const n = Number(item?.evaluated_at_ts ?? item?.created_ts ?? item?.updated_ts ?? item?.ts ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  const normalizeResult = (item: any): string => {
    const raw = String(item?.result ?? item?.verdict ?? "").toUpperCase();
    if (raw === "PASS") return "PASSED";
    if (raw === "FAIL") return "FAILED";
    return raw;
  };
  const normalizeRatio = (item: any): number | undefined => {
    const n = Number(item?.in_field_ratio ?? item?.metrics?.in_field_ratio);
    return Number.isFinite(n) ? n : undefined;
  };

  const sortedAcceptance = [...(Array.isArray(acceptanceResults) ? acceptanceResults : [])].sort((a, b) => asTs(b) - asTs(a));
  const latestAcceptance = sortedAcceptance[0];
  const latestAcceptanceResult = normalizeResult(latestAcceptance);

  const sortedTrajectories = [...(Array.isArray(trajectories) ? trajectories : [])].sort((a, b) => asTs(b) - asTs(a));
  const latestTrajectory = sortedTrajectories[0];
  const latestInFieldRatio = normalizeRatio(latestTrajectory);

  if (latestAcceptanceResult === "FAILED") {
    current_goal_progress.execution_reliability = "AT_RISK";
    next_action_hint = {
      kind: "REVIEW_IRRIGATION_PLAN",
      reason: "Latest acceptance result is FAILED.",
      priority: "HIGH"
    };
  }

  if (latestInFieldRatio != null && latestInFieldRatio < 0.6) {
    current_goal_progress.water_management = "OFF_TRACK";
    next_action_hint = {
      kind: "CHECK_DEVICE_PATH_OR_BINDING",
      reason: "Latest in-field ratio is below 0.6.",
      priority: "HIGH"
    };
  }

  const latestThree = sortedAcceptance.slice(0, 3);
  if (latestThree.length === 3 && latestThree.every((item) => normalizeResult(item) === "PASSED")) {
    current_goal_progress.execution_reliability = "ON_TRACK";
    return {
      current_stage: "STABLE_EXECUTION",
      current_goal_progress,
      next_action_hint
    };
  }

  return { current_stage, current_goal_progress, next_action_hint };
}
