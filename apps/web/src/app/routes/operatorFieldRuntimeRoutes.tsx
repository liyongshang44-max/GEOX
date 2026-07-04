// apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx
// Purpose: own the canonical Field Runtime route family under /operator/fields/*.
// Boundary: H60-C routes render the shared FieldRuntimeRoutePage shell only; concrete tab content migrates later.

import React from "react";
import { Route, Routes } from "react-router-dom";
import FieldRuntimeRoutePage from "../../features/operator/fieldRuntime/FieldRuntimeRoutePage";

export default function OperatorFieldRuntimeRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route index element={<FieldRuntimeRoutePage tab="fields" />} />
      <Route path=":fieldId" element={<FieldRuntimeRoutePage tab="overview" />} />
      <Route path=":fieldId/evidence" element={<FieldRuntimeRoutePage tab="evidence" />} />
      <Route path=":fieldId/state" element={<FieldRuntimeRoutePage tab="state" />} />
      <Route path=":fieldId/forecast" element={<FieldRuntimeRoutePage tab="forecast" />} />
      <Route path=":fieldId/scenario" element={<FieldRuntimeRoutePage tab="scenario" />} />
      <Route path=":fieldId/residual" element={<FieldRuntimeRoutePage tab="residual" />} />
      <Route path=":fieldId/calibration" element={<FieldRuntimeRoutePage tab="calibration" />} />
      <Route path=":fieldId/health" element={<FieldRuntimeRoutePage tab="health" />} />
      <Route path=":fieldId/audit" element={<FieldRuntimeRoutePage tab="audit" />} />
      <Route path="*" element={<FieldRuntimeRoutePage tab="fields" />} />
    </Routes>
  );
}
