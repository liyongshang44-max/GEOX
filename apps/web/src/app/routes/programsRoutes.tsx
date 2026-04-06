import React from "react";
import { Route } from "react-router-dom";
import RouteErrorBoundary from "../errors/RouteErrorBoundary";

const ProgramListPage = React.lazy(() => import("../../views/ProgramListPage"));
const ProgramDetailPage = React.lazy(() => import("../../views/ProgramDetailPage"));
const ProgramNewPage = React.lazy(() => import("../../views/ProgramNewPage"));
const ProgramCreatePage = React.lazy(() => import("../../views/ProgramCreatePage"));
const AgronomyRecommendationsPage = React.lazy(() => import("../../views/AgronomyRecommendationsPage"));

export function renderProgramsRoutes(): React.ReactElement[] {
  return [
    <Route key="programs" path="/programs" element={<ProgramListPage />} />,
    <Route key="programs-create" path="/programs/create" element={<ProgramCreatePage />} />,
    <Route key="programs-new" path="/programs/new" element={<ProgramNewPage />} />,
    <Route key="programs-detail" path="/programs/:programId" element={<RouteErrorBoundary><ProgramDetailPage /></RouteErrorBoundary>} />,
    <Route key="agronomy-recommendations" path="/agronomy/recommendations" element={<AgronomyRecommendationsPage />} />,
  ];
}
