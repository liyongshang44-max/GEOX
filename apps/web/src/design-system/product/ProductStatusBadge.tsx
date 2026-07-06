// apps/web/src/design-system/product/ProductStatusBadge.tsx
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

// Purpose: render a small status label using only approved PFE boundary semantics.
export function ProductStatusBadge({ status, label, className, ariaLabel }: ProductStatusBadgeProps) {
  const classes = ["productStatusBadge", className].filter(Boolean).join(" ");

  return (
    <span className={classes} data-status={status} aria-label={ariaLabel ?? STATUS_LABELS[status]}>
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}
