// apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx
// Purpose: own the H60-B canonical Field Runtime route family under /operator/fields/*.
// Boundary: this module renders route placeholders only and imports no field twin business pages.

import React from "react";
import { Route, Routes } from "react-router-dom";
import FieldRuntimeRoutePlaceholder from "../../features/operator/fieldRuntime/FieldRuntimeRoutePlaceholder";

export default function OperatorFieldRuntimeRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route index element={<FieldRuntimeRoutePlaceholder tab="fields" />} />
      <Route path=":fieldId" element={<FieldRuntimeRoutePlaceholder tab="overview" />} />
      <Route path=":fieldId/evidence" element={<FieldRuntimeRoutePlaceholder tab="evidence" />} />
      <Route path=":fieldId/state" element={<FieldRuntimeRoutePlaceholder tab="state" />} />
      <Route path=":fieldId/forecast" element={<FieldRuntimeRoutePlaceholder tab="forecast" />} />
      <Route path=":fieldId/scenario" element={<FieldRuntimeRoutePlaceholder tab="scenario" />} />
      <Route path=":fieldId/residual" element={<FieldRuntimeRoutePlaceholder tab="residual" />} />
      <Route path=":fieldId/calibration" element={<FieldRuntimeRoutePlaceholder tab="calibration" />} />
      <Route path=":fieldId/health" element={<FieldRuntimeRoutePlaceholder tab="health" />} />
      <Route path=":fieldId/audit" element={<FieldRuntimeRoutePlaceholder tab="audit" />} />
      <Route path="*" element={<FieldRuntimeRoutePlaceholder tab="fields" />} />
    </Routes>
  );
}
