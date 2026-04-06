import React from "react";
import { Route } from "react-router-dom";
import RouteErrorBoundary from "../errors/RouteErrorBoundary";

const ProgramListPage = React.lazy(() => import("../../features/programs/pages/ProgramListPage"));
const ProgramDetailPage = React.lazy(() => import("../../features/programs/pages/ProgramDetailPage"));
const ProgramNewPage = React.lazy(() => import("../../features/programs/pages/ProgramNewPage"));
const ProgramCreatePage = React.lazy(() => import("../../features/programs/pages/ProgramCreatePage"));
const AgronomyRecommendationsPage = React.lazy(() => import("../../features/programs/pages/AgronomyRecommendationsPage"));

export function renderProgramsRoutes(): React.ReactElement[] {
  return [
    <Route key="programs" path="/programs" element={<ProgramListPage />} />,
    <Route key="programs-create" path="/programs/create" element={<ProgramCreatePage />} />,
    <Route key="programs-new" path="/programs/new" element={<ProgramNewPage />} />,
    <Route key="programs-detail" path="/programs/:programId" element={<RouteErrorBoundary><ProgramDetailPage /></RouteErrorBoundary>} />,
    <Route key="agronomy-recommendations" path="/agronomy/recommendations" element={<AgronomyRecommendationsPage />} />,
  ];
}
