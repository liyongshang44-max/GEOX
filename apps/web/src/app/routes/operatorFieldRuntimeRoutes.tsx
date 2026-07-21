// Purpose: own the MCFT-CAP-07 S5 canonical Field Runtime route family under /operator/fields/*.
// Boundary: GET-only canonical Runtime integration; legacy evidence/audit URLs are aliases, not truth fallbacks.

import React from "react";
import { Route, Routes } from "react-router-dom";
import FieldRuntimeRoutePage from "../../features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage";

export default function OperatorFieldRuntimeRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route index element={<FieldRuntimeRoutePage tab="fields" />} />
      <Route path=":fieldId" element={<FieldRuntimeRoutePage tab="overview" />} />
      <Route path=":fieldId/state" element={<FieldRuntimeRoutePage tab="state" />} />
      <Route path=":fieldId/forecast" element={<FieldRuntimeRoutePage tab="forecast" />} />
      <Route path=":fieldId/scenario" element={<FieldRuntimeRoutePage tab="scenario" />} />
      <Route path=":fieldId/action-lifecycle" element={<FieldRuntimeRoutePage tab="action-lifecycle" />} />
      <Route path=":fieldId/residual" element={<FieldRuntimeRoutePage tab="residual" />} />
      <Route path=":fieldId/calibration" element={<FieldRuntimeRoutePage tab="calibration" />} />
      <Route path=":fieldId/evidence-trace" element={<FieldRuntimeRoutePage tab="evidence-trace" />} />
      <Route path=":fieldId/health" element={<FieldRuntimeRoutePage tab="health" />} />
      <Route path=":fieldId/evidence" element={<FieldRuntimeRoutePage tab="evidence" />} />
      <Route path=":fieldId/audit" element={<FieldRuntimeRoutePage tab="audit" />} />
      <Route path="*" element={<FieldRuntimeRoutePage tab="fields" />} />
    </Routes>
  );
}
