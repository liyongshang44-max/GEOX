// apps/server/src/persistence/calibration/postgres_exact_calibration_residual_repository_v1.ts
// Purpose: implement the MCFT-CAP-06 Candidate-input port with one exact ordered Residual-ref PostgreSQL lookup and an injected canonical-graph resolver.
// Boundary: exact primary-key-style batch lookup and graph-resolution delegation only; no list, search, latest, time-range, scope-range, holdout-index, calibration math, persistence, projection, Runtime authority, route, scheduler, filesystem, environment, or network.

import type { Pool } from "pg";
import {
  validateCap05ForecastResidualV1,
  type Cap05ForecastResidualEnvelopeV1,
} from "../../domain/twin_runtime/forecast_observation_residual_v1.js";
import type {
  Cap06CalibrationCaseSourceV1,
  Cap06ExactCalibrationResidualPortV1,
} from "../../domain/calibration/contracts_v1.js";

export type Cap06ExactResidualGraphResolverV1 = Readonly<{
  resolveExactResidualGraph(
    residual: Cap05ForecastResidualEnvelopeV1,
  ): Promise<Cap06CalibrationCaseSourceV1> | Cap06CalibrationCaseSourceV1;
}>;

type ParsedResidualFactV1 = {
  fact_id: string;
  residual: Cap05ForecastResidualEnvelopeV1;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function exactOrderedRefsV1(value: readonly string[]): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("CAP06_POSTGRES_EXACT_RESIDUAL_REFS_REQUIRED");
  }
  const refs = value.map((ref) => requiredStringV1(
    ref,
    "CAP06_POSTGRES_EXACT_RESIDUAL_REF_REQUIRED",
  ));
  if (new Set(refs).size !== refs.length) {
    throw new Error("CAP06_POSTGRES_EXACT_RESIDUAL_REFS_DUPLICATE");
  }
  return refs;
}

function parseResidualFactV1(factId: unknown, recordJson: unknown): ParsedResidualFactV1 {
  const parsed = typeof recordJson === "string" ? JSON.parse(recordJson) : recordJson;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("CAP06_POSTGRES_EXACT_RESIDUAL_RECORD_INVALID");
  }
  const record = parsed as Record<string, unknown>;
  if (record.type !== "twin_forecast_residual_v1") {
    throw new Error("CAP06_POSTGRES_EXACT_RESIDUAL_TYPE_MISMATCH");
  }
  const residual = record.payload as Cap05ForecastResidualEnvelopeV1;
  if (!residual || typeof residual !== "object") {
    throw new Error("CAP06_POSTGRES_EXACT_RESIDUAL_PAYLOAD_REQUIRED");
  }
  validateCap05ForecastResidualV1(residual);
  return {
    fact_id: requiredStringV1(factId, "CAP06_POSTGRES_EXACT_RESIDUAL_FACT_ID_REQUIRED"),
    residual,
  };
}

export class PostgresExactCalibrationResidualRepositoryV1
implements Cap06ExactCalibrationResidualPortV1 {
  constructor(
    private readonly pool: Pool,
    private readonly graphResolver: Cap06ExactResidualGraphResolverV1,
  ) {
    if (!graphResolver
      || typeof graphResolver.resolveExactResidualGraph !== "function") {
      throw new Error("CAP06_POSTGRES_EXACT_RESIDUAL_GRAPH_RESOLVER_REQUIRED");
    }
  }

  async loadExactCalibrationResiduals(
    orderedResidualRefs: readonly string[],
  ): Promise<readonly Cap06CalibrationCaseSourceV1[]> {
    const refs = exactOrderedRefsV1(orderedResidualRefs);
    const result = await this.pool.query(
      `SELECT fact_id,record_json
       FROM facts
       WHERE record_json->>'type'='twin_forecast_residual_v1'
         AND record_json->'payload'->>'object_id'=ANY($1::text[])
       ORDER BY record_json->'payload'->>'object_id' ASC`,
      [refs],
    );
    const owners = new Map<string, ParsedResidualFactV1>();
    for (const row of result.rows) {
      const parsed = parseResidualFactV1(row.fact_id, row.record_json);
      const objectId = requiredStringV1(
        parsed.residual.object_id,
        "CAP06_POSTGRES_EXACT_RESIDUAL_OBJECT_ID_REQUIRED",
      );
      if (!refs.includes(objectId)) {
        throw new Error(`CAP06_POSTGRES_EXACT_RESIDUAL_UNEXPECTED:${objectId}`);
      }
      if (owners.has(objectId)) {
        throw new Error(`CAP06_POSTGRES_EXACT_RESIDUAL_DUPLICATE_RESULT:${objectId}`);
      }
      owners.set(objectId, parsed);
    }
    if (owners.size !== refs.length) {
      const missing = refs.filter((ref) => !owners.has(ref));
      throw new Error(`CAP06_POSTGRES_EXACT_RESIDUAL_MISSING:${missing.join(",")}`);
    }
    const resolved: Cap06CalibrationCaseSourceV1[] = [];
    for (const ref of refs) {
      const owner = owners.get(ref);
      if (!owner) throw new Error(`CAP06_POSTGRES_EXACT_RESIDUAL_MISSING:${ref}`);
      const caseSource = await this.graphResolver.resolveExactResidualGraph(
        structuredClone(owner.residual),
      );
      if (!caseSource || caseSource.residual_ref !== ref) {
        throw new Error(`CAP06_POSTGRES_EXACT_RESIDUAL_GRAPH_IDENTITY_MISMATCH:${ref}`);
      }
      resolved.push(structuredClone(caseSource));
    }
    return resolved;
  }
}
