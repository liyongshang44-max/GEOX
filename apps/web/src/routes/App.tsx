import React from "react";
import { Route, Routes } from "react-router-dom";
import CoreApp from "../app/App";

const ControlledPilotPrototype = React.lazy(() => import("../prototypes/controlled-pilot"));

const PrototypeFallback = (
  <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#08110e", color: "#dce8e2", fontFamily: "Inter, system-ui, sans-serif" }}>
    正在加载 GEOX Controlled Pilot Prototype…
  </div>
);

export default function App(): React.ReactElement {
  return (
    <Routes>
      <Route
        path="/prototype/controlled-pilot/*"
        element={(
          <React.Suspense fallback={PrototypeFallback}>
            <ControlledPilotPrototype />
          </React.Suspense>
        )}
      />
      <Route path="*" element={<CoreApp />} />
    </Routes>
  );
}
