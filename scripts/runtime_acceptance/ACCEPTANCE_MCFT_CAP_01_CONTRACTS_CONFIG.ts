// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_01_CONTRACTS_CONFIG.ts
// Purpose: compile twin_runtime_config_v1 from the final MCFT-00 artifacts and verify deterministic identity, hash, purity-facing inputs, and mismatch rejection.
// Boundary: acceptance-only filesystem reads; no database, network, Runtime orchestration, or canonical write.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCanonicalObjectV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { compileRuntimeConfigFromAuthorityArtifactsV1, type Mcft00ConfigurationMatrixArtifactV1, type Mcft00RealityArtifactV1, type Mcft00SourceMatrixArtifactV1 } from "../../apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
function readJson<T>(relativePath: string): T { return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T; }
function compile(createdAt: string, realityOverride?: Mcft00RealityArtifactV1) {
  return compileRuntimeConfigFromAuthorityArtifactsV1({
    realityArtifact: realityOverride ?? readJson<Mcft00RealityArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json"),
    sourceMatrixArtifact: readJson<Mcft00SourceMatrixArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json"),
    configurationMatrixArtifact: readJson<Mcft00ConfigurationMatrixArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json"),
    logical_time: "2026-06-01T00:00:00.000Z",
    created_at: createdAt,
  });
}

let pass = 0;
function check(condition: unknown, message: string): void { assert.ok(condition, message); pass += 1; console.log(`PASS ${message}`); }
const first = compile("2026-06-01T00:00:00.000Z");
const second = compile("2026-06-01T00:01:00.000Z");
validateCanonicalObjectV1(first);
check(first.object_type === "twin_runtime_config_v1", "Runtime Config object type");
check(first.object_id === second.object_id, "audit created_at excluded from object identity");
check(first.determinism_hash === second.determinism_hash, "audit created_at excluded from semantic hash");
check(first.runtime_config_ref === null && first.runtime_config_hash === null, "Runtime Config has no self-reference");
check(first.payload.reality_binding_hash === "sha256:bf1da664164a4fedda249bcb0e330c1af2083173a52bd704f01eac3ad277ba4f", "final Reality binding hash consumed");
check(first.payload.source_matrix_hash === "sha256:c5187c23be0d058ffa23d464ae1139f924f5af064a270248746fbabde4c3e51b", "final source matrix hash consumed");
check(first.payload.configuration_matrix_hash === "sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5", "final configuration matrix hash consumed");
const forged = readJson<Mcft00RealityArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json");
forged.determinism_hash = "sha256:forged";
assert.throws(() => compile("2026-06-01T00:00:00.000Z", forged), /REALITY_BINDING_HASH_MISMATCH/);
check(true, "forged Reality hash rejected");
console.log(`MCFT-CAP-01 S2: ${pass} PASS, 0 FAIL`);
