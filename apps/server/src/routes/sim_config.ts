// GEOX/apps/server/src/routes/sim_config.ts
//
// Simulator Config Manifest + Patch preview endpoint.
//
// This follows the same governance pattern as JudgeConfig:
// - SSOT = config/sim/default.json
// - manifest = editable projection (frontend must not infer)
// - patch = replace-only, allowlist enforced, unknown keys rejected

import type { FastifyInstance } from "fastify";

import { stableStringify } from "../../../judge/src/util";

import {
  loadDefaultSimConfig,
  getSimManifest,
  computeSimSsotHash,
  validateEffectiveSimConfig,
} from "../../../judge/src/sim_config/ssot";

import type { SimConfigPatchV1 } from "../../../judge/src/sim_config/patch";
import {
  applyPatch,
  computeEffectiveSimConfigHash,
  validatePatchEnvelopeStrict,
  validatePatchStrict,
} from "../../../judge/src/sim_config/patch";

export function registerSimConfigRoutes(app: FastifyInstance): void {
  // GET /api/sim/config
  // Returns SSOT fingerprint + editable manifest for simulator config.
  app.get("/api/sim/config", async (_req, reply) => {
    const ssotCfg = loadDefaultSimConfig();
    const manifest = getSimManifest(ssotCfg);
    return reply.send(manifest);
  });

  // POST /api/sim/config/patch
  // Validates and previews patch (dryRun=true) or validates+applies (dryRun=false, no storage in v1).
  // Unlike JudgeConfig, we return `effective_config` in preview to help generate simulator commands.
  app.post("/api/sim/config/patch", async (req, reply) => {
    const body = (req.body ?? {}) as any;

    // Step-1: validate request envelope shape + reject unknown keys.
    const envErrors = validatePatchEnvelopeStrict(body);
    if (envErrors.length) return reply.code(400).send({ ok: false, errors: envErrors });

    const ssotCfg = loadDefaultSimConfig();
    const manifest = getSimManifest(ssotCfg);
    const ssot_hash = computeSimSsotHash(ssotCfg);

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

    const patch: SimConfigPatchV1 = body.patch;
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

    // Step-3: validate patch strict (allowlist/type/range + reject unknown keys)
    const patchErrors = validatePatchStrict(patch, manifest);
    if (patchErrors.length) return reply.code(400).send({ ok: false, ssot_hash, errors: patchErrors });

    // Step-4: apply patch as pure function
    const effectiveCfg = applyPatch(ssotCfg, patch);

    // Step-5: validate effective config structure (static refusal)
    try {
      validateEffectiveSimConfig(effectiveCfg);
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
    const effective_hash = computeEffectiveSimConfigHash(effectiveCfg);
    const changed_paths = patch.ops.map((op) => op.path).sort();

    // Provide a deterministic config blob for CLI usage (node scripts/sim_sensor_stream.mjs --config-b64 ...)
    // NOTE: this is a convenience payload; authoritative validation remains on server.
    const effective_config_b64 = Buffer.from(stableStringify(effectiveCfg), "utf8").toString("base64");

    return reply.send({
      ok: true,
      ssot_hash,
      effective_hash,
      changed_paths,
      effective_config: effectiveCfg,
      effective_config_b64,
      errors: [],
    });
  });
}
