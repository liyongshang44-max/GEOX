// apps/web/src/design-system/product/ProductStatusBadge.tsx
// Purpose: render status as visible text, not color-only state.
// Boundary: this component displays readback state only and does not create business authority.

import type { ReactNode } from "react";

// Purpose: define the allowed product status vocabulary for formal frontend surfaces.
export type ProductStatus =
  | "available"
  | "unavailable"
  | "partial"
  | "readOnly"
  | "replayBacked"
  | "notConnected"
  | "notOnline"
  | "disabled"
  | "degraded"
  | "blocked"
  | "future"
  | "urlOnly"
  | "doNotBuild";

// Purpose: keep visible copy deterministic without giving status tones business authority.
const STATUS_LABELS: Record<ProductStatus, string> = {
  available: "Available",
  unavailable: "Unavailable",
  partial: "Partial",
  readOnly: "Read-only",
  replayBacked: "Replay-backed",
  notConnected: "Not connected",
  notOnline: "Not online",
  disabled: "Disabled",
  degraded: "Degraded",
  blocked: "Blocked",
  future: "Future",
  urlOnly: "URL-only",
  doNotBuild: "Do not build",
};

export interface ProductStatusBadgeProps {
  status: ProductStatus;
  label?: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function ProductStatusBadge({ status, label, className, ariaLabel }: ProductStatusBadgeProps) {
  const classes = ["productStatusBadge", className].filter(Boolean).join(" ");
  const visibleLabel = label ?? STATUS_LABELS[status];

  return (
    <span className={classes} data-status={status} aria-label={ariaLabel ?? STATUS_LABELS[status]}>
      {visibleLabel}
    </span>
  );
}
