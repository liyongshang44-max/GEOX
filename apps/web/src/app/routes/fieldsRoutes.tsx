import React from "react";
import { Route } from "react-router-dom";
import RouteErrorBoundary from "../errors/RouteErrorBoundary";

const FieldsPage = React.lazy(() => import("../../views/FieldsPage"));
const FieldCreatePage = React.lazy(() => import("../../views/FieldCreatePage"));
const FieldDetailPage = React.lazy(() => import("../../views/FieldDetailPage"));

export function renderFieldsRoutes(): React.ReactElement[] {
  return [
    <Route key="fields" path="/fields" element={<FieldsPage />} />,
    <Route key="fields-new" path="/fields/new" element={<FieldCreatePage />} />,
    <Route key="fields-detail" path="/fields/:fieldId" element={<RouteErrorBoundary><FieldDetailPage /></RouteErrorBoundary>} />,
  ];
}
