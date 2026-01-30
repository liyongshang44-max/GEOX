// Control Kernel - AO Action Taxonomy v0
//
// Normative source: docs/controlplane/constitution/GEOX-AO-ActionTaxonomy-v0.md
//
// Engineering rule:
// - Treat AO action codes as an allowlist (not a free-form string).
// - Do NOT extend this list in code. Any extension must be done by updating
//   the normative constitution document and then updating this constant to match.

/**
 * AO action codes frozen in AO Action Taxonomy v0.
 */
export const AO_ACTION_CODES_V0 = Object.freeze([
  // AO-ENTER: enter a spatial unit / allow access.
  "AO-ENTER",
  // AO-APPLY: apply something onto the land (e.g., water, fertilizer) in principle.
  "AO-APPLY",
  // AO-REMOVE: remove something from the land (e.g., weeds) in principle.
  "AO-REMOVE",
  // AO-STRUCT: change structure (e.g., till/plow) in principle.
  "AO-STRUCT",
  // AO-EXTRACT: extract something (e.g., harvest) in principle.
  "AO-EXTRACT",
  // AO-SENSE: request sensing/measurement actions.
  "AO-SENSE"
] as const);

/**
 * Literal type representing the frozen AO action codes.
 */
export type AoActionCodeV0 = (typeof AO_ACTION_CODES_V0)[number];

/**
 * Checks whether a string is a valid AO action code according to v0 allowlist.
 *
 * @param actionCode - Candidate action code string.
 * @returns True if the code is in the AO v0 allowlist; false otherwise.
 */
export function isValidAoActionCodeV0(actionCode: string): actionCode is AoActionCodeV0 {
  // Use a Set for O(1) membership checks.
  return AO_ACTION_CODE_SET_V0.has(actionCode);
}

/**
 * Throws a typed error if an action code is not in the v0 allowlist.
 *
 * @param actionCode - Candidate action code string.
 * @param context - Human-friendly location string to aid debugging.
 */
export function assertValidAoActionCodeV0(actionCode: string, context: string): void {
  // Fail hard: unknown action codes are governance violations.
  if (!isValidAoActionCodeV0(actionCode)) {
    throw new Error(`AO_ACTION_CODE_NOT_ALLOWED: ${actionCode} @ ${context}`);
  }
}

// Internal Set derived from the frozen allowlist.
const AO_ACTION_CODE_SET_V0: ReadonlySet<string> = new Set(AO_ACTION_CODES_V0 as readonly string[]);
