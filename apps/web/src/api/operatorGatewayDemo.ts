// apps/web/src/api/operatorGatewayDemo.ts
// Purpose: read the checked-in P51.5 gateway-backed demo viewer snapshot from public assets.
// Boundary: static GET only.

import { type GatewayDemoSnapshot } from "../features/operator/gatewayDemo/gatewayDemoTypes";

const P51_GATEWAY_VIEWER_SNAPSHOT_URL = "/demo-runtime/p51-gateway-viewer-snapshot.json";

export async function fetchP51GatewayViewerSnapshot(): Promise<GatewayDemoSnapshot> {
  const response = await fetch(P51_GATEWAY_VIEWER_SNAPSHOT_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`P51.5 gateway viewer snapshot unavailable: ${response.status}`);
  }

  return response.json() as Promise<GatewayDemoSnapshot>;
}

export { P51_GATEWAY_VIEWER_SNAPSHOT_URL };
