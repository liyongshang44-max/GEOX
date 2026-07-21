// Purpose: decode an untrusted S1 cursor envelope just far enough to establish S4 continuation context before cryptographic verification.
// Boundary: canonical base64url/JSON decoding only; this function never authenticates a cursor and its output must always pass verifyFieldTwinCursorV1 before use.

import { canonicalJsonV1 } from "../domain/twin_runtime/canonical_json_v1.js";
import { cursorWireTextV1, type FieldTwinCursorEnvelopeV1 } from "../domain/field_twin_read_model/cursor_contracts_v1.js";

export function decodeUntrustedFieldTwinCursorEnvelopeV1(wireValue: string): FieldTwinCursorEnvelopeV1 {
  const wire = cursorWireTextV1(wireValue);
  let decoded: string;
  try { decoded = Buffer.from(wire, "base64url").toString("utf8"); } catch { throw new Error("MCFT_CURSOR_WIRE_INVALID"); }
  let value: unknown;
  try { value = JSON.parse(decoded); } catch { throw new Error("MCFT_CURSOR_WIRE_INVALID"); }
  if (canonicalJsonV1(value) !== decoded || Buffer.from(decoded, "utf8").toString("base64url") !== wire) throw new Error("MCFT_CURSOR_WIRE_INVALID");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("MCFT_CURSOR_INVALID");
  const envelope = value as FieldTwinCursorEnvelopeV1;
  if (envelope.cursor_auth_scheme !== "HMAC_SHA256_V1" || !envelope.cursor_signing_key_id || !/^[0-9a-f]{64}$/.test(envelope.cursor_auth_tag)) throw new Error("MCFT_CURSOR_INVALID");
  return envelope;
}
