import React from "react";
import { Route } from "react-router-dom";
import RouteErrorBoundary from "../errors/RouteErrorBoundary";

const FieldsPage = React.lazy(() => import("../../features/fields/pages/FieldsPage"));
const FieldCreatePage = React.lazy(() => import("../../features/fields/pages/FieldCreatePage"));
const FieldDetailPage = React.lazy(() => import("../../features/fields/pages/FieldDetailPage"));

export function renderFieldsRoutes(): React.ReactElement[] {
  return [
    <Route key="fields" path="/fields" element={<FieldsPage />} />,
    <Route key="fields-new" path="/fields/new" element={<FieldCreatePage />} />,
    <Route key="fields-detail" path="/fields/:fieldId" element={<RouteErrorBoundary><FieldDetailPage /></RouteErrorBoundary>} />,
  ];
}
