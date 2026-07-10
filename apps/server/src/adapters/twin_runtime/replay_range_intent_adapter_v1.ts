// apps/server/src/adapters/twin_runtime/replay_range_intent_adapter_v1.ts
// Purpose: parse one explicit manual Replay operator invocation into deterministic single-tick, range, resume, or bounded-backfill intent.
// Boundary: argument adaptation only; no filesystem, database, Runtime execution, wall clock, scheduler, route, or canonical write.

export type ReplayRuntimeModeV1 = "single-tick" | "range" | "resume" | "backfill";

export type ReplayRangeIntentV1 = {
  operator_intent: "REPLAY";
  mode: ReplayRuntimeModeV1;
  database_url: string;
  target_logical_time: string;
  created_at: string;
  continuation_runtime_config_ref: string;
  replay_root?: string;
  source_matrix_path?: string;
  lease_owner: string;
  lease_duration_seconds: number;
  requested_start_logical_time?: string;
  evidence_intent: "MISSED_SCHEDULE_CATCH_UP" | "LATE_EVIDENCE_REVISION";
};

const ALLOWED_ARGUMENTS_V1 = new Set([
  "operator-intent",
  "mode",
  "database-url",
  "logical-time",
  "to",
  "created-at",
  "runtime-config-ref",
  "replay-root",
  "source-matrix",
  "lease-owner",
  "lease-duration-seconds",
  "from",
  "evidence-intent",
]);

function parsePairsV1(argv: readonly string[]): Map<string, string> {
  if (argv.length % 2 !== 0) throw new Error("INVALID_ARGUMENT_SEQUENCE");
  const parsed = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error(`INVALID_ARGUMENT_SEQUENCE:${key ?? "END"}`);
    const name = key.slice(2);
    if (!ALLOWED_ARGUMENTS_V1.has(name)) throw new Error(`UNKNOWN_ARGUMENT:${name}`);
    if (parsed.has(name)) throw new Error(`DUPLICATE_ARGUMENT:${name}`);
    parsed.set(name, value);
  }
  return parsed;
}

function requiredV1(args: Map<string, string>, name: string): string {
  const value = args.get(name);
  if (!value?.trim()) throw new Error(`ARGUMENT_REQUIRED:${name}`);
  return value;
}

function canonicalIsoV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function canonicalHourV1(value: string, code: string): string {
  const canonical = canonicalIsoV1(value, code);
  const date = new Date(canonical);
  if (date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) {
    throw new Error(code);
  }
  return canonical;
}

function modeV1(value: string): ReplayRuntimeModeV1 {
  if (value === "single-tick" || value === "range" || value === "resume" || value === "backfill") {
    return value;
  }
  throw new Error(`UNSUPPORTED_MODE:${value}`);
}

export function parseReplayRangeIntentV1(input: {
  argv: readonly string[];
  environment_database_url?: string;
}): ReplayRangeIntentV1 {
  const args = parsePairsV1(input.argv);
  if (requiredV1(args, "operator-intent") !== "REPLAY") throw new Error("REPLAY_OPERATOR_INTENT_REQUIRED");
  const mode = modeV1(requiredV1(args, "mode"));
  const databaseUrl = args.get("database-url") ?? input.environment_database_url;
  if (!databaseUrl?.trim()) throw new Error("DATABASE_URL_REQUIRED");

  const logicalTime = args.get("logical-time");
  const to = args.get("to");
  let targetLogicalTime: string;
  if (mode === "single-tick") {
    if (to !== undefined) throw new Error("SINGLE_TICK_TO_ARGUMENT_FORBIDDEN");
    targetLogicalTime = canonicalHourV1(requiredV1(args, "logical-time"), "LOGICAL_TIME_NOT_CANONICAL_HOUR");
  } else {
    if (logicalTime !== undefined) throw new Error("RANGE_LOGICAL_TIME_ARGUMENT_FORBIDDEN");
    targetLogicalTime = canonicalHourV1(requiredV1(args, "to"), "TARGET_NOT_CANONICAL_HOUR");
  }

  const createdAt = canonicalIsoV1(requiredV1(args, "created-at"), "CREATED_AT_INVALID");
  const leaseDuration = Number(args.get("lease-duration-seconds") ?? "300");
  if (!Number.isInteger(leaseDuration) || leaseDuration <= 0) throw new Error("LEASE_DURATION_INVALID");
  const requestedStart = args.get("from");
  const evidenceIntent = args.get("evidence-intent") ?? "MISSED_SCHEDULE_CATCH_UP";
  if (evidenceIntent !== "MISSED_SCHEDULE_CATCH_UP" && evidenceIntent !== "LATE_EVIDENCE_REVISION") {
    throw new Error(`UNSUPPORTED_EVIDENCE_INTENT:${evidenceIntent}`);
  }
  if (mode !== "backfill" && (requestedStart !== undefined || args.has("evidence-intent"))) {
    throw new Error("BACKFILL_ARGUMENT_USED_OUTSIDE_BACKFILL_MODE");
  }

  return {
    operator_intent: "REPLAY",
    mode,
    database_url: databaseUrl,
    target_logical_time: targetLogicalTime,
    created_at: createdAt,
    continuation_runtime_config_ref: requiredV1(args, "runtime-config-ref"),
    replay_root: args.get("replay-root"),
    source_matrix_path: args.get("source-matrix"),
    lease_owner: args.get("lease-owner") ?? `mcft-cap-02-${mode}-manual-runner`,
    lease_duration_seconds: leaseDuration,
    requested_start_logical_time: requestedStart === undefined
      ? undefined
      : canonicalHourV1(requestedStart, "BACKFILL_START_NOT_CANONICAL_HOUR"),
    evidence_intent: evidenceIntent,
  };
}
