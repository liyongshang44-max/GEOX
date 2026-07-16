// apps/server/src/domain/calibration/exact_ref_port_v1.ts
// Purpose: expose the only Candidate-input data surface allowed by MCFT-CAP-06: exact ordered Residual-ref batch loading.
// Boundary: input-port narrowing and exact-set validation only; no list/search/range/latest/generic facts query, holdout index, replay, persistence, projection, or activation authority.

import type {
  Cap06CalibrationCaseSourceV1,
  Cap06ExactCalibrationResidualPortV1,
} from "./contracts_v1.js";

export type Cap06ExactCalibrationLoaderV1 = Readonly<{
  loadExactCalibrationResiduals(
    orderedResidualRefs: readonly string[],
  ): Promise<readonly Cap06CalibrationCaseSourceV1[]>;
}>;

function validateOrderedRefsV1(orderedResidualRefs: readonly string[]): string[] {
  if (!Array.isArray(orderedResidualRefs) || orderedResidualRefs.length === 0) {
    throw new Error("CAP06_EXACT_RESIDUAL_REFS_REQUIRED");
  }
  const refs = orderedResidualRefs.map((ref) => {
    if (typeof ref !== "string" || ref.length === 0) throw new Error("CAP06_EXACT_RESIDUAL_REF_REQUIRED");
    return ref;
  });
  if (new Set(refs).size !== refs.length) throw new Error("CAP06_EXACT_RESIDUAL_REFS_DUPLICATE");
  return refs;
}

export function createCap06ExactCalibrationLoaderV1(
  port: Cap06ExactCalibrationResidualPortV1,
): Cap06ExactCalibrationLoaderV1 {
  if (!port || typeof port.loadExactCalibrationResiduals !== "function") {
    throw new Error("CAP06_EXACT_RESIDUAL_PORT_REQUIRED");
  }
  return Object.freeze({
    async loadExactCalibrationResiduals(
      orderedResidualRefs: readonly string[],
    ): Promise<readonly Cap06CalibrationCaseSourceV1[]> {
      const refs = validateOrderedRefsV1(orderedResidualRefs);
      const loaded = await port.loadExactCalibrationResiduals(refs);
      if (!Array.isArray(loaded)) throw new Error("CAP06_EXACT_RESIDUAL_PORT_RESULT_REQUIRED");
      const owners = new Map<string, Cap06CalibrationCaseSourceV1>();
      for (const item of loaded) {
        if (!item || typeof item.residual_ref !== "string") {
          throw new Error("CAP06_EXACT_RESIDUAL_PORT_CASE_INVALID");
        }
        if (owners.has(item.residual_ref)) {
          throw new Error(`CAP06_EXACT_RESIDUAL_PORT_DUPLICATE_RESULT:${item.residual_ref}`);
        }
        owners.set(item.residual_ref, structuredClone(item));
      }
      if (owners.size !== refs.length) {
        throw new Error(`CAP06_EXACT_RESIDUAL_PORT_CARDINALITY:${owners.size}:${refs.length}`);
      }
      const ordered = refs.map((ref) => {
        const item = owners.get(ref);
        if (!item) throw new Error(`CAP06_EXACT_RESIDUAL_PORT_MISSING_RESULT:${ref}`);
        return item;
      });
      const unexpected = [...owners.keys()].filter((ref) => !refs.includes(ref));
      if (unexpected.length > 0) {
        throw new Error(`CAP06_EXACT_RESIDUAL_PORT_UNEXPECTED_RESULT:${unexpected.sort().join(",")}`);
      }
      return ordered;
    },
  });
}
