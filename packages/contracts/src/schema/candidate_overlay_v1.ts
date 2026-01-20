import { z } from "zod";

export const CANDIDATE_KIND_ALLOWLIST = ["drift_candidate", "step_candidate"] as const;

export const CandidateKindV1Schema = z.enum(CANDIDATE_KIND_ALLOWLIST);

export type CandidateKind = z.infer<typeof CandidateKindV1Schema>;

export function isCandidateKind(x: unknown): x is CandidateKind {
  return CandidateKindV1Schema.safeParse(x).success;
}
