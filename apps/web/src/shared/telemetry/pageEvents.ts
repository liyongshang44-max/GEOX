import React from "react";
import { useLocation } from "react-router-dom";

export type PageEventType = "enter_page" | "click_main_action" | "submit_approval" | "complete_acceptance";

export function trackPageEvent(type: PageEventType, payload: Record<string, unknown>): void {
  // Reserved for future analytics pipeline integration.
  // eslint-disable-next-line no-console
  console.debug("[page-event]", type, payload);
}

export function usePageEnterEvent(): void {
  const location = useLocation();

  React.useEffect(() => {
    trackPageEvent("enter_page", {
      path: location.pathname,
      search: location.search,
      at: new Date().toISOString(),
    });
  }, [location.pathname, location.search]);
}

export function trackMainActionClick(path: string, action: string): void {
  trackPageEvent("click_main_action", { path, action, at: new Date().toISOString() });
}

export function trackApprovalSubmit(path: string, entityId: string): void {
  trackPageEvent("submit_approval", { path, entityId, at: new Date().toISOString() });
}

export function trackAcceptanceComplete(path: string, entityId: string): void {
  trackPageEvent("complete_acceptance", { path, entityId, at: new Date().toISOString() });
}
