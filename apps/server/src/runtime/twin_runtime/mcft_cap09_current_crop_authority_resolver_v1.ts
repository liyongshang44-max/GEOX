// MCFT-CAP-09 rolling current-crop authority selection seam.
//
// This port is intentionally read-only. It does not discover providers, write runtime
// configuration, mutate the database, activate production ownership, or authorize a
// Runtime start. Production V2 continues to use the static exact-bound snapshot unless
// a separately governed resolver is explicitly injected by a future successor.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type McftCap09CurrentCropAuthorityJsonV1 = Record<string, unknown>;

export type McftCap09CurrentCropAuthorityResolveInputV1 = {
  logical_time: string;
};

export interface McftCap09CurrentCropAuthorityResolverPortV1 {
  resolve(
    input: McftCap09CurrentCropAuthorityResolveInputV1,
  ): McftCap09CurrentCropAuthorityJsonV1;
}

export type McftCap09EffectiveCurrentCropAuthorityRegistryEntryV1 = {
  authority_ref: string;
  authority_sha256: string;
  authority_as_of: string;
  authority_valid_until: string;
  graduation_status: string;
};

export type McftCap09EffectiveCurrentCropAuthorityRegistryV1 = {
  schema_version: "geox_mcft_cap09_effective_current_crop_authority_registry_v1";
  registry_id: "MCFT_CAP09_EFFECTIVE_CURRENT_CROP_AUTHORITY_REGISTRY_V1";
  status: "ACTIVE";
  selection_policy: "LATEST_EFFECTIVE_AUTHORITY_AS_OF_NOT_AFTER_LOGICAL_TIME_WITHIN_VALIDITY_WINDOW";
  candidate_artifacts_admissible: false;
  entries: McftCap09EffectiveCurrentCropAuthorityRegistryEntryV1[];
};

type JsonRecordV1 = Record<string, unknown>;

const EFFECTIVE_GRADUATION_STATUSES_V1 = new Set([
  "EFFECTIVE_FOR_RUNTIME_CONSUMPTION",
  "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH",
]);

const FORBIDDEN_AUTHORITY_EFFECT_KEYS_V1 = [
  "runtime_config_write_authorized",
  "database_write_authorized",
  "scheduler_write_authorized",
  "formal_evidence_write_authorized",
  "production_runtime_start_authorized",
  "production_owner_activation_authorized",
  "formal_v5_authorized",
  "a0_authorized",
  "o00_o23_authorized",
  "mcft_cap09_completed",
] as const;

function jsonRecordV1(value: unknown, code: string): JsonRecordV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(code);
  }
  return value as JsonRecordV1;
}

function exactIsoInstantV1(value: unknown, code: string): string {
  const text = String(value ?? "").trim();
  const epoch = Date.parse(text);
  if (!text || !Number.isFinite(epoch) || new Date(epoch).toISOString() !== text) {
    throw new Error(code);
  }
  return text;
}

function sha256FileV1(filePath: string, code: string): string {
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(filePath);
  } catch (error) {
    throw new Error(`${code}:${error instanceof Error ? error.message : String(error)}`);
  }
  return "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
}

function readJsonFileV1(filePath: string, code: string): JsonRecordV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${code}:${error instanceof Error ? error.message : String(error)}`);
  }
  return jsonRecordV1(parsed, code);
}

function parseRegistryV1(
  registryPath: string,
): McftCap09EffectiveCurrentCropAuthorityRegistryV1 {
  const raw = readJsonFileV1(
    registryPath,
    "MCFT_CAP09_CURRENT_CROP_AUTHORITY_REGISTRY_INVALID",
  );
  if (
    raw.schema_version !== "geox_mcft_cap09_effective_current_crop_authority_registry_v1"
    || raw.registry_id !== "MCFT_CAP09_EFFECTIVE_CURRENT_CROP_AUTHORITY_REGISTRY_V1"
    || raw.status !== "ACTIVE"
    || raw.selection_policy
      !== "LATEST_EFFECTIVE_AUTHORITY_AS_OF_NOT_AFTER_LOGICAL_TIME_WITHIN_VALIDITY_WINDOW"
    || raw.candidate_artifacts_admissible !== false
    || !Array.isArray(raw.entries)
    || raw.entries.length === 0
  ) {
    throw new Error("MCFT_CAP09_CURRENT_CROP_AUTHORITY_REGISTRY_CONTRACT_INVALID");
  }

  const entries = raw.entries.map((row, index) => {
    const entry = jsonRecordV1(
      row,
      `MCFT_CAP09_CURRENT_CROP_AUTHORITY_REGISTRY_ENTRY_INVALID:${index}`,
    );
    const authorityRef = String(entry.authority_ref ?? "").trim();
    const authoritySha256 = String(entry.authority_sha256 ?? "").trim();
    const graduationStatus = String(entry.graduation_status ?? "").trim();
    if (!authorityRef || path.isAbsolute(authorityRef) || authorityRef.includes("..")) {
      throw new Error(`MCFT_CAP09_CURRENT_CROP_AUTHORITY_REGISTRY_REF_INVALID:${index}`);
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(authoritySha256)) {
      throw new Error(`MCFT_CAP09_CURRENT_CROP_AUTHORITY_REGISTRY_DIGEST_INVALID:${index}`);
    }
    if (!EFFECTIVE_GRADUATION_STATUSES_V1.has(graduationStatus)) {
      throw new Error(`MCFT_CAP09_CURRENT_CROP_AUTHORITY_REGISTRY_GRADUATION_INVALID:${index}`);
    }
    const authorityAsOf = exactIsoInstantV1(
      entry.authority_as_of,
      `MCFT_CAP09_CURRENT_CROP_AUTHORITY_REGISTRY_AS_OF_INVALID:${index}`,
    );
    const authorityValidUntil = exactIsoInstantV1(
      entry.authority_valid_until,
      `MCFT_CAP09_CURRENT_CROP_AUTHORITY_REGISTRY_VALID_UNTIL_INVALID:${index}`,
    );
    if (Date.parse(authorityValidUntil) < Date.parse(authorityAsOf)) {
      throw new Error(`MCFT_CAP09_CURRENT_CROP_AUTHORITY_REGISTRY_WINDOW_INVALID:${index}`);
    }
    return {
      authority_ref: authorityRef,
      authority_sha256: authoritySha256,
      authority_as_of: authorityAsOf,
      authority_valid_until: authorityValidUntil,
      graduation_status: graduationStatus,
    };
  });

  const seenRefs = new Set<string>();
  const seenAsOf = new Set<string>();
  for (const entry of entries) {
    if (seenRefs.has(entry.authority_ref)) {
      throw new Error("MCFT_CAP09_CURRENT_CROP_AUTHORITY_REGISTRY_DUPLICATE_REF");
    }
    if (seenAsOf.has(entry.authority_as_of)) {
      throw new Error("MCFT_CAP09_CURRENT_CROP_AUTHORITY_REGISTRY_DUPLICATE_AS_OF");
    }
    seenRefs.add(entry.authority_ref);
    seenAsOf.add(entry.authority_as_of);
  }

  return {
    schema_version: raw.schema_version as McftCap09EffectiveCurrentCropAuthorityRegistryV1["schema_version"],
    registry_id: raw.registry_id as McftCap09EffectiveCurrentCropAuthorityRegistryV1["registry_id"],
    status: raw.status as McftCap09EffectiveCurrentCropAuthorityRegistryV1["status"],
    selection_policy: raw.selection_policy as McftCap09EffectiveCurrentCropAuthorityRegistryV1["selection_policy"],
    candidate_artifacts_admissible: false,
    entries,
  };
}

function assertEffectiveAuthorityV1(
  artifact: JsonRecordV1,
  entry: McftCap09EffectiveCurrentCropAuthorityRegistryEntryV1,
): void {
  const lifecycle = jsonRecordV1(
    artifact.lifecycle,
    "MCFT_CAP09_CURRENT_CROP_AUTHORITY_LIFECYCLE_INVALID",
  );
  const biologicalStage = jsonRecordV1(
    artifact.biological_stage,
    "MCFT_CAP09_CURRENT_CROP_AUTHORITY_BIOLOGICAL_STAGE_INVALID",
  );
  const graduation = jsonRecordV1(
    artifact.graduation,
    "MCFT_CAP09_CURRENT_CROP_AUTHORITY_GRADUATION_INVALID",
  );

  if (
    artifact.schema_version
      !== "geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1"
    || artifact.status !== "PASS"
    || artifact.qualification_outcome
      !== "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED"
    || artifact.architecture_effective !== true
    || artifact.runtime_consumption_authorized !== true
    || lifecycle.domain_state !== "ACTIVE"
    || lifecycle.authority_status !== "RESOLVED"
    || lifecycle.authority_validity !== "VALID"
    || lifecycle.authority_mode !== "GOVERNED_PERSISTENT_STATE"
    || lifecycle.active_consumable_candidate !== true
  ) {
    throw new Error("MCFT_CAP09_CURRENT_CROP_AUTHORITY_NOT_RUNTIME_EFFECTIVE");
  }

  const artifactAsOf = exactIsoInstantV1(
    biologicalStage.authority_as_of,
    "MCFT_CAP09_CURRENT_CROP_AUTHORITY_AS_OF_INVALID",
  );
  if (artifactAsOf !== entry.authority_as_of) {
    throw new Error("MCFT_CAP09_CURRENT_CROP_AUTHORITY_AS_OF_REGISTRY_MISMATCH");
  }

  const forwardStabilityHours = Number(biologicalStage.forward_stability_hours);
  if (!Number.isFinite(forwardStabilityHours) || forwardStabilityHours <= 0) {
    throw new Error("MCFT_CAP09_CURRENT_CROP_AUTHORITY_FORWARD_STABILITY_INVALID");
  }
  const derivedValidUntil = new Date(
    Date.parse(artifactAsOf) + forwardStabilityHours * 60 * 60 * 1000,
  ).toISOString();
  const explicitValidUntil = biologicalStage.authority_valid_until === undefined
    ? derivedValidUntil
    : exactIsoInstantV1(
      biologicalStage.authority_valid_until,
      "MCFT_CAP09_CURRENT_CROP_AUTHORITY_VALID_UNTIL_INVALID",
    );
  if (
    explicitValidUntil !== derivedValidUntil
    || explicitValidUntil !== entry.authority_valid_until
  ) {
    throw new Error("MCFT_CAP09_CURRENT_CROP_AUTHORITY_VALIDITY_REGISTRY_MISMATCH");
  }

  const graduationStatus = String(graduation.status ?? "").trim();
  if (
    !EFFECTIVE_GRADUATION_STATUSES_V1.has(graduationStatus)
    || graduationStatus !== entry.graduation_status
  ) {
    throw new Error("MCFT_CAP09_CURRENT_CROP_AUTHORITY_GRADUATION_STATUS_MISMATCH");
  }

  for (const key of FORBIDDEN_AUTHORITY_EFFECT_KEYS_V1) {
    if (artifact[key] !== false) {
      throw new Error(`MCFT_CAP09_CURRENT_CROP_AUTHORITY_EFFECT_CEILING_DRIFT:${key}`);
    }
  }
}

export function createStaticMcftCap09CurrentCropAuthorityResolverV1(
  snapshot: McftCap09CurrentCropAuthorityJsonV1,
): McftCap09CurrentCropAuthorityResolverPortV1 {
  return {
    resolve() {
      return snapshot;
    },
  };
}

export function createFileBackedMcftCap09CurrentCropAuthorityResolverV1(input: {
  registry_path: string;
  artifact_root: string;
}): McftCap09CurrentCropAuthorityResolverPortV1 {
  const registryPath = String(input.registry_path ?? "").trim();
  const artifactRoot = String(input.artifact_root ?? "").trim();
  if (!registryPath) {
    throw new Error("MCFT_CAP09_CURRENT_CROP_AUTHORITY_REGISTRY_PATH_REQUIRED");
  }
  if (!artifactRoot) {
    throw new Error("MCFT_CAP09_CURRENT_CROP_AUTHORITY_ARTIFACT_ROOT_REQUIRED");
  }

  return {
    resolve({ logical_time }) {
      const logicalTime = exactIsoInstantV1(
        logical_time,
        "MCFT_CAP09_CURRENT_CROP_AUTHORITY_LOGICAL_TIME_INVALID",
      );
      const logicalEpoch = Date.parse(logicalTime);
      const registry = parseRegistryV1(registryPath);
      const eligible = registry.entries
        .filter((entry) => {
          return Date.parse(entry.authority_as_of) <= logicalEpoch
            && logicalEpoch <= Date.parse(entry.authority_valid_until);
        })
        .sort((a, b) => Date.parse(b.authority_as_of) - Date.parse(a.authority_as_of));

      const selected = eligible[0];
      if (!selected) {
        throw new Error("MCFT_CAP09_CURRENT_CROP_AUTHORITY_NO_EFFECTIVE_ENTRY_FOR_LOGICAL_TIME");
      }

      const authorityPath = path.resolve(artifactRoot, selected.authority_ref);
      const expectedRoot = path.resolve(artifactRoot) + path.sep;
      if (!authorityPath.startsWith(expectedRoot)) {
        throw new Error("MCFT_CAP09_CURRENT_CROP_AUTHORITY_REF_ESCAPES_ARTIFACT_ROOT");
      }
      if (
        sha256FileV1(
          authorityPath,
          "MCFT_CAP09_CURRENT_CROP_AUTHORITY_FILE_INVALID",
        ) !== selected.authority_sha256
      ) {
        throw new Error("MCFT_CAP09_CURRENT_CROP_AUTHORITY_DIGEST_MISMATCH");
      }

      const artifact = readJsonFileV1(
        authorityPath,
        "MCFT_CAP09_CURRENT_CROP_AUTHORITY_JSON_INVALID",
      );
      assertEffectiveAuthorityV1(artifact, selected);
      return artifact;
    },
  };
}
