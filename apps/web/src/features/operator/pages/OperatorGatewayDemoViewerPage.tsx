// apps/web/src/features/operator/pages/OperatorGatewayDemoViewerPage.tsx
// Purpose: keep the existing /operator/twin/gateway-demo route while delegating H61 product presentation to ReplayDemoPage.
// Boundary: this wrapper preserves route topology and introduces no fetch or write behavior.

import React from "react";
import ReplayDemoPage from "../replayDemo/ReplayDemoPage";

export default function OperatorGatewayDemoViewerPage(): React.ReactElement {
  return <ReplayDemoPage />;
}
