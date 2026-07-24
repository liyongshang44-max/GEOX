// Purpose: define the exact atomic authority pair required to classify MCFT-CAP-08.S3 as semantically complete.
// Boundary: pure contracts only; no SQL, canonical writes, Runtime execution, route, scheduler, wall clock, or production authority.

import type {
  Cap08CompletionAuthorityV1,
  Cap08CompletionGraphV1,
  InspectCap08CompletionAuthorityInputV1,
} from "./cap08_completion_authority_contracts_v1.js";
import type { Cap08S3CompletionTupleV1 } from "./cap08_s3_completion_tuple_v1.js";

export const CAP08_S3_SEMANTIC_COMPLETION_AUTHORITY_KIND_V1 =
  "MCFT_CAP08_S3_SEMANTIC_COMPLETION" as const;

export type Cap08S3CompletionAuthorityPairDispositionV1 =
  | "NOT_STARTED"
  | "RESUMABLE"
  | "ALREADY_COMPLETE_EXACT";

export type InspectCap08S3CompletionAuthorityPairResultV1 = {
  disposition: Cap08S3CompletionAuthorityPairDispositionV1;
  generic_authority: Cap08CompletionAuthorityV1 | null;
  semantic_authority: Cap08S3CompletionTupleV1 | null;
  rebuilt_semantic_authority: Cap08S3CompletionTupleV1 | null;
  graph: Cap08CompletionGraphV1 | null;
  authority_pair_write_delta: 0;
};

export type EstablishCap08S3CompletionAuthorityPairResultV1 = {
  disposition: "ALREADY_COMPLETE_EXACT";
  write_status: "INSERTED_ATOMIC_PAIR" | "EXISTING_IDEMPOTENT_PAIR";
  generic_authority: Cap08CompletionAuthorityV1;
  semantic_authority: Cap08S3CompletionTupleV1;
  rebuilt_semantic_authority: Cap08S3CompletionTupleV1;
  graph: Cap08CompletionGraphV1;
  authority_pair_write_delta: 0 | 2;
};

export interface Cap08S3CompletionAuthorityPairPortV1 {
  inspect(
    input: InspectCap08CompletionAuthorityInputV1,
  ): Promise<InspectCap08S3CompletionAuthorityPairResultV1>;

  establish(
    input: InspectCap08CompletionAuthorityInputV1,
  ): Promise<EstablishCap08S3CompletionAuthorityPairResultV1>;
}
