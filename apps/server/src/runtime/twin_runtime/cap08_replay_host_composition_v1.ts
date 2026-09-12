// Purpose: own the production-grade bounded CAP-08 ReplayHost composition seam while preserving frozen Runtime semantics.
// Boundary: application composition only; no scheduler, provider access, production cadence, Formal-v5 authority, or online Runtime ownership.

import type { Pool } from "pg";
import type { ReplayEvidenceSourcePortV1 } from "./ports.js";
import {
  Cap08S4AppendForwardServiceV1,
  type Cap08S4AppendForwardRepositoryPortV1,
  type Cap08S4PersistedChainReaderPortV1,
  type Cap08S4T17CorrectedPredecessorResolverPortV1,
} from "./cap08_s4_append_forward_service_v1.js";

export const CAP08_REPLAY_HOST_COMPOSITION_SCHEMA_VERSION_V1 =
  "geox_mcft_cap08_replay_host_composition_v1" as const;

export const CAP08_REPLAY_HOST_ARCHITECTURE_AUTHORITY_COMMIT_V1 =
  "2f7a065cc95e4a5a2c95411fb381fe5e4479d645" as const;

export const CAP08_REPLAY_HOST_CP5_PREDECESSOR_COMMIT_V1 =
  "14653ba622bb12261a1ea79f3ea7e42be0b49f92" as const;

export type Cap08ReplayHostS4CompositionInputV1 = Readonly<{
  pool: Pool;
  evidence_source: ReplayEvidenceSourcePortV1;
  repository: Cap08S4AppendForwardRepositoryPortV1;
  chain_reader?: Cap08S4PersistedChainReaderPortV1;
  resolver?: Cap08S4T17CorrectedPredecessorResolverPortV1;
}>;

/**
 * Creates the CAP-08 S4 service through explicit typed dependencies.
 *
 * The shared append-forward repository is an application composition concern. Historical
 * two-argument construction remains supported by Cap08S4AppendForwardServiceV1 itself;
 * successor ReplayHost composition uses this factory so qualification and future hosts do
 * not mutate private service fields or construct a second semantic implementation.
 */
export function createCap08ReplayHostS4AppendForwardServiceV1(
  input: Cap08ReplayHostS4CompositionInputV1,
): Cap08S4AppendForwardServiceV1 {
  return new Cap08S4AppendForwardServiceV1(
    input.pool,
    input.evidence_source,
    {
      repository: input.repository,
      ...(input.chain_reader ? { chain_reader: input.chain_reader } : {}),
      ...(input.resolver ? { resolver: input.resolver } : {}),
    },
  );
}
