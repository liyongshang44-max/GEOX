// Purpose: own CAP-08 bounded ReplayHost application composition outside acceptance-only wiring while preserving the frozen Runtime semantics.
// Boundary: replay composition only; no scheduler, live provider access, production cadence, Formal-v5 authority, or online Runtime ownership.

import type { Pool } from "pg";
import type { ReplayEvidenceSourcePortV1 } from "./ports.js";
import { Cap08S4AppendForwardServiceV1 } from "./cap08_s4_append_forward_service_v1.js";

export const CAP08_REPLAY_HOST_COMPOSITION_SCHEMA_VERSION_V1 =
  "geox_mcft_cap08_replay_host_composition_v1" as const;

export const CAP08_REPLAY_HOST_ARCHITECTURE_AUTHORITY_COMMIT_V1 =
  "2f7a065cc95e4a5a2c95411fb381fe5e4479d645" as const;

type MutableServiceSeamsV1 = {
  chainReader: unknown;
  repository: unknown;
  resolver: unknown;
};

type MutableResolverSeamV1 = {
  repository: unknown;
};

function requireObjectV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requireFunctionV1(value: unknown, code: string): void {
  if (typeof value !== "function") throw new Error(code);
}

function requireOwnSeamV1(value: object, key: string, code: string): void {
  if (!Object.prototype.hasOwnProperty.call(value, key)) throw new Error(code);
}

/**
 * CAP-08 historical S6 requires an atomic append-forward persistence adapter that is
 * selected by the bounded replay host. The frozen service predates explicit constructor
 * injection, so Phase 1 centralizes the compatibility binding here instead of allowing
 * acceptance scripts to own or mutate application composition independently.
 *
 * This is deliberately not an online-host factory and does not authorize CAP-09 runtime.
 */
export function createCap08ReplayHostS4AppendForwardServiceV1(input: {
  pool: Pool;
  evidenceSource: ReplayEvidenceSourcePortV1;
  repository: unknown;
  chainReader?: unknown;
}): Cap08S4AppendForwardServiceV1 {
  const repository = requireObjectV1(
    input.repository,
    "CAP08_REPLAY_HOST_S4_REPOSITORY_OBJECT_REQUIRED",
  );
  requireFunctionV1(repository.inspect, "CAP08_REPLAY_HOST_S4_REPOSITORY_INSPECT_REQUIRED");
  requireFunctionV1(repository.establish, "CAP08_REPLAY_HOST_S4_REPOSITORY_ESTABLISH_REQUIRED");

  if (input.chainReader !== undefined) {
    const chainReader = requireObjectV1(
      input.chainReader,
      "CAP08_REPLAY_HOST_S4_CHAIN_READER_OBJECT_REQUIRED",
    );
    requireFunctionV1(chainReader.read, "CAP08_REPLAY_HOST_S4_CHAIN_READER_READ_REQUIRED");
  }

  const service = new Cap08S4AppendForwardServiceV1(input.pool, input.evidenceSource);
  const seams = service as unknown as MutableServiceSeamsV1;

  requireOwnSeamV1(seams, "repository", "CAP08_REPLAY_HOST_S4_REPOSITORY_SEAM_REQUIRED");
  requireOwnSeamV1(seams, "resolver", "CAP08_REPLAY_HOST_S4_RESOLVER_SEAM_REQUIRED");
  requireOwnSeamV1(seams, "chainReader", "CAP08_REPLAY_HOST_S4_CHAIN_READER_SEAM_REQUIRED");

  seams.repository = repository;

  const resolver = requireObjectV1(
    seams.resolver,
    "CAP08_REPLAY_HOST_S4_RESOLVER_OBJECT_REQUIRED",
  ) as unknown as MutableResolverSeamV1;
  requireOwnSeamV1(
    resolver,
    "repository",
    "CAP08_REPLAY_HOST_S4_RESOLVER_REPOSITORY_SEAM_REQUIRED",
  );
  resolver.repository = repository;

  if (input.chainReader !== undefined) seams.chainReader = input.chainReader;

  return service;
}
