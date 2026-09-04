import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  deriveExternalFormalA18CropContextIdentityHashV4,
} from "./external_formal_a18_crop_context_v4.js";
import {
  createFileBackedMcftCap09CurrentCropAuthorityResolverV1,
  type McftCap09CurrentCropAuthorityResolverPortV1,
} from "./mcft_cap09_current_crop_authority_resolver_v1.js";
import {
  materializeMcftCap09TwinCropContextV2,
} from "./mcft_cap09_twin_runtime_composition_v2.js";

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json",
);

const cropAuthority = JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json",
  "utf8",
));
const configurationMatrix = JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
  "utf8",
));
const architectureEffectiveness = {
  schema_version: "geox_dt02_biological_stage_authority_effectiveness_v1",
  amendment_id: "DT02-AMENDMENT-03",
  status: "EFFECTIVE",
  effective: true,
};

function currentCrop(authorityAsOf: string, digestChar: string) {
  const validUntil = new Date(
    Date.parse(authorityAsOf) + 30 * 60 * 60 * 1000,
  ).toISOString();
  return {
    schema_version: "geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1",
    status: "PASS",
    qualification_outcome: "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED",
    architecture_effective: true,
    runtime_consumption_authorized: true,
    runtime_config_write_authorized: false,
    database_write_authorized: false,
    scheduler_write_authorized: false,
    formal_evidence_write_authorized: false,
    production_runtime_start_authorized: false,
    production_owner_activation_authorized: false,
    formal_v5_authorized: false,
    a0_authorized: false,
    o00_o23_authorized: false,
    mcft_cap09_completed: false,
    scope: {
      tenant_id: "tenant_mcft_external",
      project_id: "project_mcft_cap09",
      group_id: "group_public_research",
      site_id: "KBS_MCSE_T4R1",
      field_id: "field_kbs_mcse_t4r1",
      season_id: "season_2026_corn",
      zone_id: "zone_kbs_mcse_t4r1_crop_formal_v1",
      crop: "corn",
      hybrid_product_code: "43-96P",
    },
    lifecycle: {
      domain_state: "ACTIVE",
      authority_status: "RESOLVED",
      authority_validity: "VALID",
      authority_mode: "GOVERNED_PERSISTENT_STATE",
      active_consumable_candidate: true,
    },
    biological_stage: {
      epistemic_class: "THERMAL_MODEL_DERIVED",
      resolved_biological_stage: "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
      observed_biological_stage_claimed: false,
      authority_as_of: authorityAsOf,
      authority_valid_until: validUntil,
      forward_stability_hours: 30,
    },
    crop_water_use_stage: "LATE",
    crop_model_parameter: {
      parameter: "Kc",
      stage_code: "LATE",
      value: 0.6,
      configuration_source_id: "mcft_crop_water_use_corn_v1",
      configuration_semantic_hash:
        "sha256:56ac92e34148bd81fe20f2925e1079cb1a3ed647ffefd1471caf1302df70ee4c",
      production_effective: false,
    },
    evidence_digest: `sha256:${digestChar.repeat(64)}`,
    graduation: {
      status: "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH",
    },
  };
}

function expectedIdentity(logicalTime: string, evidenceDigest: string) {
  return deriveExternalFormalA18CropContextIdentityHashV4({
    logical_time: logicalTime,
    crop_stage_code: "LATE",
    current_crop_authority_evidence_digest: evidenceDigest,
  });
}

function sha256File(filePath: string) {
  return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function writeRegistryFixture(input: {
  authority: Record<string, unknown>;
  authorityAsOf: string;
  authorityValidUntil: string;
  graduationStatus: string;
  digestOverride?: string;
}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-current-crop-registry-"));
  const authorityPath = path.join(dir, "authority.json");
  fs.writeFileSync(authorityPath, JSON.stringify(input.authority, null, 2) + "\n");
  const registryPath = path.join(dir, "registry.json");
  fs.writeFileSync(registryPath, JSON.stringify({
    schema_version: "geox_mcft_cap09_effective_current_crop_authority_registry_v1",
    registry_id: "MCFT_CAP09_EFFECTIVE_CURRENT_CROP_AUTHORITY_REGISTRY_V1",
    status: "ACTIVE",
    selection_policy: "LATEST_EFFECTIVE_AUTHORITY_AS_OF_NOT_AFTER_LOGICAL_TIME_WITHIN_VALIDITY_WINDOW",
    candidate_artifacts_admissible: false,
    entries: [{
      authority_ref: "authority.json",
      authority_sha256: input.digestOverride ?? sha256File(authorityPath),
      authority_as_of: input.authorityAsOf,
      authority_valid_until: input.authorityValidUntil,
      graduation_status: input.graduationStatus,
    }],
  }, null, 2) + "\n");
  return { dir, registryPath };
}

test("Twin V2 resolves current-crop authority independently for each logical hour", () => {
  const first = currentCrop("2026-09-03T04:00:00.000Z", "a");
  const second = currentCrop("2026-09-04T04:00:00.000Z", "b");
  const calls: string[] = [];
  const resolver: McftCap09CurrentCropAuthorityResolverPortV1 = {
    resolve({ logical_time }) {
      calls.push(logical_time);
      return logical_time < "2026-09-04T04:00:00.000Z" ? first : second;
    },
  };

  const firstLogical = "2026-09-03T05:00:00.000Z";
  const firstResult = materializeMcftCap09TwinCropContextV2(
    {
      crop_authority: cropAuthority,
      configuration_matrix: configurationMatrix,
      biological_stage_architecture_effectiveness: architectureEffectiveness,
      current_crop_authority_resolver: resolver,
    },
    {
      logical_time: firstLogical,
      expected_identity_hash: expectedIdentity(firstLogical, first.evidence_digest),
    },
  );

  const secondLogical = "2026-09-04T05:00:00.000Z";
  const secondResult = materializeMcftCap09TwinCropContextV2(
    {
      crop_authority: cropAuthority,
      configuration_matrix: configurationMatrix,
      biological_stage_architecture_effectiveness: architectureEffectiveness,
      current_crop_authority_resolver: resolver,
    },
    {
      logical_time: secondLogical,
      expected_identity_hash: expectedIdentity(secondLogical, second.evidence_digest),
    },
  );

  assert.deepEqual(calls, [firstLogical, secondLogical]);
  assert.equal(firstResult.current_crop_authority_evidence_digest, first.evidence_digest);
  assert.equal(secondResult.current_crop_authority_evidence_digest, second.evidence_digest);
  assert.notEqual(firstResult.context_identity_hash, secondResult.context_identity_hash);
  assert.equal(firstResult.production_effective, true);
  assert.equal(secondResult.production_effective, true);
});

test("Twin V2 rolling resolver still fails closed when selected authority is stale", () => {
  const stale = currentCrop("2026-09-03T04:00:00.000Z", "c");
  const resolver: McftCap09CurrentCropAuthorityResolverPortV1 = {
    resolve() {
      return stale;
    },
  };
  const logicalTime = "2026-09-04T11:00:00.000Z";

  assert.throws(
    () => materializeMcftCap09TwinCropContextV2(
      {
        crop_authority: cropAuthority,
        configuration_matrix: configurationMatrix,
        biological_stage_architecture_effectiveness: architectureEffectiveness,
        current_crop_authority_resolver: resolver,
      },
      {
        logical_time: logicalTime,
        expected_identity_hash: expectedIdentity(logicalTime, stale.evidence_digest),
      },
    ),
    /EXTERNAL_FORMAL_A18_V4_STAGE_AUTHORITY_FORWARD_WINDOW_EXCEEDED/,
  );
});

test("file-backed resolver selects only graduated effective authorities by logical time", () => {
  const resolver = createFileBackedMcftCap09CurrentCropAuthorityResolverV1({
    registry_path: REGISTRY_PATH,
    artifact_root: ROOT,
  });
  const previous = resolver.resolve({ logical_time: "2026-09-03T05:00:00.000Z" });
  const refreshed = resolver.resolve({ logical_time: "2026-09-04T05:00:00.000Z" });
  assert.equal(
    previous.evidence_digest,
    "sha256:8b479689dfdfc0ec65145e98b1bf5d0ba7fa7534019513ddaa5933e6e1cca81e",
  );
  assert.equal(
    refreshed.evidence_digest,
    "sha256:1d89e3a0f38b4619d44cb6504498641a004144877bb8b38fc8a810bae0d0238e",
  );
});

test("file-backed resolver fails closed after the latest effective validity window", () => {
  const resolver = createFileBackedMcftCap09CurrentCropAuthorityResolverV1({
    registry_path: REGISTRY_PATH,
    artifact_root: ROOT,
  });
  assert.throws(
    () => resolver.resolve({ logical_time: "2026-09-05T11:00:00.000Z" }),
    /MCFT_CAP09_CURRENT_CROP_AUTHORITY_NO_EFFECTIVE_ENTRY_FOR_LOGICAL_TIME/,
  );
});

test("file-backed resolver rejects candidate-only authority even when its digest is registered", () => {
  const candidate = currentCrop("2026-09-04T04:00:00.000Z", "d");
  candidate.architecture_effective = false;
  candidate.runtime_consumption_authorized = false;
  candidate.graduation.status = "CANDIDATE_ONLY";
  const fixture = writeRegistryFixture({
    authority: candidate,
    authorityAsOf: "2026-09-04T04:00:00.000Z",
    authorityValidUntil: "2026-09-05T10:00:00.000Z",
    graduationStatus: "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH",
  });
  const resolver = createFileBackedMcftCap09CurrentCropAuthorityResolverV1({
    registry_path: fixture.registryPath,
    artifact_root: fixture.dir,
  });
  assert.throws(
    () => resolver.resolve({ logical_time: "2026-09-04T05:00:00.000Z" }),
    /MCFT_CAP09_CURRENT_CROP_AUTHORITY_NOT_RUNTIME_EFFECTIVE/,
  );
});

test("file-backed resolver rejects authority bytes that drift from the registered digest", () => {
  const authority = currentCrop("2026-09-04T04:00:00.000Z", "e");
  const fixture = writeRegistryFixture({
    authority,
    authorityAsOf: "2026-09-04T04:00:00.000Z",
    authorityValidUntil: "2026-09-05T10:00:00.000Z",
    graduationStatus: "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH",
    digestOverride: `sha256:${"0".repeat(64)}`,
  });
  const resolver = createFileBackedMcftCap09CurrentCropAuthorityResolverV1({
    registry_path: fixture.registryPath,
    artifact_root: fixture.dir,
  });
  assert.throws(
    () => resolver.resolve({ logical_time: "2026-09-04T05:00:00.000Z" }),
    /MCFT_CAP09_CURRENT_CROP_AUTHORITY_DIGEST_MISMATCH/,
  );
});
