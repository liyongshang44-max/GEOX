// GEOX/apps/server/src/routes/judge_config.ts
//
// Judge Config Manifest + Patch preview endpoint (Frozen Manifest v1).
//
// HTTP routes MUST live in apps/server (not apps/judge).
// Backend is the only authority for:
// - ssot_hash computation
// - editable allowlist exposure
// - patch static validation / refusal

import type { FastifyInstance } from "fastify";

import { loadDefaultConfig, getManifest, computeSsotHash, validateEffectiveConfig } from "../../../judge/src/config/ssot";
import type { JudgeConfigPatchV1 } from "../../../judge/src/config/patch";
import {
  applyPatch,
  computeEffectiveConfigHash,
  validatePatchEnvelopeStrict,
  validatePatchStrict,
} from "../../../judge/src/config/patch";

export function registerJudgeConfigRoutes(app: FastifyInstance): void {
  // GET /api/judge/config
  // Returns SSOT fingerprint + editable manifest (machine-readable) for frontend.
  app.get("/api/judge/config", async (_req, reply) => {
    const ssotCfg = loadDefaultConfig();
    const manifest = getManifest(ssotCfg);
    return reply.send(manifest);
  });

  // POST /api/judge/config/patch
  // Validates and previews patch (dryRun=true) or validates+applies (dryRun=false, no storage in v1).
  app.post("/api/judge/config/patch", async (req, reply) => {
    const body = (req.body ?? {}) as any;

    // Step-1: validate request envelope shape + reject unknown keys.
    const envErrors = validatePatchEnvelopeStrict(body);
    if (envErrors.length) return reply.code(400).send({ ok: false, errors: envErrors });

    const ssotCfg = loadDefaultConfig();
    const manifest = getManifest(ssotCfg);
    const ssot_hash = computeSsotHash(ssotCfg);

    // Step-2: ssot_hash match (409)
    if (String(body.base.ssot_hash) !== ssot_hash) {
      return reply.code(409).send({
        ok: false,
        ssot_hash,
        errors: [
          {
            code: "SSOT_HASH_MISMATCH",
            path: "base.ssot_hash",
            message: `ssot_hash mismatch: got=${String(body.base.ssot_hash)} expected=${ssot_hash}`,
          },
        ],
      });
    }

    const patch: JudgeConfigPatchV1 = body.patch;

    // Guard: request.base.ssot_hash and patch.base.ssot_hash must agree (static refusal).
    if (patch?.base?.ssot_hash !== ssot_hash) {
      return reply.code(409).send({
        ok: false,
        ssot_hash,
        errors: [
          {
            code: "SSOT_HASH_MISMATCH",
            path: "patch.base.ssot_hash",
            message: `ssot_hash mismatch: got=${String(patch?.base?.ssot_hash ?? "")} expected=${ssot_hash}`,
          },
        ],
      });
    }

    // Step-3: validate patch strict (allowlist/type/range/enum + reject unknown keys)
    const patchErrors = validatePatchStrict(patch, manifest);
    if (patchErrors.length) return reply.code(400).send({ ok: false, ssot_hash, errors: patchErrors });

    // Step-4: apply patch as pure function
    const effectiveCfg = applyPatch(ssotCfg, patch);

    // Step-5: validate effective config structure (static refusal)
    try {
      validateEffectiveConfig(effectiveCfg);
    } catch (e: any) {
      return reply.code(400).send({
        ok: false,
        ssot_hash,
        errors: [
          {
            code: "INVALID_PATCH_SCHEMA",
            path: "",
            message: String(e?.message ?? e),
          },
        ],
      });
    }

    // Step-6: effective hash for reproducibility
    const effective_hash = computeEffectiveConfigHash(effectiveCfg);

    const changed_paths = patch.ops.map((op) => op.path).sort();
    return reply.send({ ok: true, ssot_hash, effective_hash, changed_paths, errors: [] });
  });
}
