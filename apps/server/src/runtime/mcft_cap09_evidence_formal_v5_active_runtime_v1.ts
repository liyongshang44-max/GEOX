// MCFT-CAP-09 H6B combined Evidence-plane Formal-v5 active runtime.
//
// One container, one Evidence service identity:
// - existing operational Evidence Runtime remains authoritative for live evidence supply;
// - Formal-v5 forcing controller runs as a subordinate task in the same container.
//
// If either task terminates unexpectedly, the supervisor signals the whole process so the
// sibling uses its existing graceful-stop path. This prevents an orphan forcing controller
// from surviving without the operational Evidence owner lifecycle.

import {
  runMcftCap09EvidencePreFormalOwnerRuntimeV1,
} from "./mcft_cap09_evidence_preformal_owner_runtime_v1.js";
import {
  runMcftCap09FormalV5ForcingRuntimeV1,
} from "./mcft_cap09_formal_v5_forcing_runtime_v1.js";
import {
  createMcftCap09ProcessStopV1,
} from "./mcft_cap09_production_process_lifecycle_v1.js";

export const MCFT_CAP09_EVIDENCE_FORMAL_V5_ACTIVE_RUNTIME_ID_V1 =
  "MCFT_CAP09_EVIDENCE_FORMAL_V5_ACTIVE_RUNTIME_V1" as const;

export const MCFT_CAP09_EVIDENCE_FORMAL_V5_ACTIVE_RUNTIME_CONTRACT_V1 = {
  runtime_id: MCFT_CAP09_EVIDENCE_FORMAL_V5_ACTIVE_RUNTIME_ID_V1,
  container_count: 1,
  operational_evidence_runtime:
    "runMcftCap09EvidencePreFormalOwnerRuntimeV1",
  subordinate_formal_forcing_runtime:
    "runMcftCap09FormalV5ForcingRuntimeV1",
  evidence_owner_count_target: 1,
  forcing_controller_is_new_authority_domain: false,
  sibling_failure_policy: "SIGNAL_WHOLE_CONTAINER_AND_FAIL_CLOSED",
  provider_request_authority:
    "EXISTING_EVIDENCE_PLANE_ONLY",
  github_production_clock_allowed: false,
} as const;

type EnvironmentV1 = Readonly<Record<string, string | undefined>>;

type TaskOutcomeV1 = {
  task: "OPERATIONAL_EVIDENCE" | "FORMAL_FORCING";
  status: "RETURNED" | "FAILED";
  error?: unknown;
};

function taskV1(
  task: TaskOutcomeV1["task"],
  promise: Promise<void>,
): Promise<TaskOutcomeV1> {
  return promise.then(
    () => ({ task, status: "RETURNED" as const }),
    (error) => ({ task, status: "FAILED" as const, error }),
  );
}

export async function runMcftCap09EvidenceFormalV5ActiveRuntimeV1(input?: {
  env?: EnvironmentV1;
}): Promise<void> {
  const env = input?.env ?? process.env;
  const supervisorStop = createMcftCap09ProcessStopV1();

  const operational = taskV1(
    "OPERATIONAL_EVIDENCE",
    runMcftCap09EvidencePreFormalOwnerRuntimeV1(),
  );
  const forcing = taskV1(
    "FORMAL_FORCING",
    runMcftCap09FormalV5ForcingRuntimeV1({ env }),
  );

  try {
    const first = await Promise.race([operational, forcing]);
    const externalStopAlreadyRequested = supervisorStop.stopRequested();

    if (!externalStopAlreadyRequested) {
      // Internal early return/failure is not a normal production lifecycle boundary.
      // Signal both child lifecycles so their existing lease-release paths run.
      process.kill(process.pid, "SIGTERM");
    }

    const outcomes = await Promise.all([operational, forcing]);

    if (externalStopAlreadyRequested && outcomes.every(
      (item) => item.status === "RETURNED",
    )) {
      return;
    }

    const failure = outcomes.find((item) => item.status === "FAILED");
    if (failure?.error instanceof Error) throw failure.error;
    if (failure) throw new Error(String(failure.error ?? "UNKNOWN_FAILURE"));

    throw new Error(
      `FORMAL_V5_EVIDENCE_ACTIVE_TASK_RETURNED_UNEXPECTEDLY:${first.task}`,
    );
  } finally {
    supervisorStop.dispose();
  }
}
