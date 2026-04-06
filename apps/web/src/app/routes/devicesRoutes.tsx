import React from "react";
import { Route } from "react-router-dom";
import RouteErrorBoundary from "../errors/RouteErrorBoundary";

const DevicesPage = React.lazy(() => import("../../features/devices/pages/DevicesPage"));
const DeviceDetailPage = React.lazy(() => import("../../features/devices/pages/DeviceDetailPage"));
const DeviceOnboardingPage = React.lazy(() => import("../../views/DeviceOnboardingPage"));

export function renderDevicesRoutes(): React.ReactElement[] {
  return [
    <Route key="devices" path="/devices" element={<DevicesPage />} />,
    <Route key="devices-onboarding" path="/devices/onboarding" element={<DeviceOnboardingPage />} />,
    <Route key="devices-detail" path="/devices/:deviceId" element={<RouteErrorBoundary><DeviceDetailPage /></RouteErrorBoundary>} />,
  ];
}
