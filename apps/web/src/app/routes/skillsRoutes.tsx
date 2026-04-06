import React from "react";
import { Route } from "react-router-dom";

const SkillRegistryPage = React.lazy(() => import("../../features/skills/pages/SkillRegistryPage"));
const SkillBindingsPage = React.lazy(() => import("../../features/skills/pages/SkillBindingsPage"));
const SkillRunDetailPage = React.lazy(() => import("../../features/skills/pages/SkillRunDetailPage"));

export function renderSkillsRoutes(): React.ReactElement[] {
  return [
    <Route key="skills-registry" path="/skills/registry" element={<SkillRegistryPage />} />,
    <Route key="skills-bindings" path="/skills/bindings" element={<SkillBindingsPage />} />,
    <Route key="skills-runs" path="/skills/runs" element={<SkillRunDetailPage />} />,
    <Route key="skills-run-detail" path="/skills/runs/:runId" element={<SkillRunDetailPage />} />,
  ];
}
