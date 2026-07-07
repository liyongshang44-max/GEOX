// apps/web/src/design-system/product/ProductStatusBadge.tsx
// Purpose: render bilingual status as visible text, not color-only state.
// Boundary: this component displays readback state only and does not create business authority.

import type { ReactNode } from "react";
import { localizedText, useLocale, type LocalizedCopy } from "../../lib/locale";
import { SHARED_PRODUCT_STATE_COPY } from "../../lib/productCopy/localeContract";

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

const STATUS_LABELS: Record<ProductStatus, LocalizedCopy> = {
  available: SHARED_PRODUCT_STATE_COPY.available,
  unavailable: SHARED_PRODUCT_STATE_COPY.unavailable,
  partial: SHARED_PRODUCT_STATE_COPY.partial,
  readOnly: SHARED_PRODUCT_STATE_COPY.readOnly,
  replayBacked: SHARED_PRODUCT_STATE_COPY.replayBacked,
  notConnected: SHARED_PRODUCT_STATE_COPY.notConnected,
  notOnline: SHARED_PRODUCT_STATE_COPY.notOnline,
  disabled: SHARED_PRODUCT_STATE_COPY.disabled,
  degraded: SHARED_PRODUCT_STATE_COPY.degraded,
  blocked: SHARED_PRODUCT_STATE_COPY.blocked,
  future: SHARED_PRODUCT_STATE_COPY.future,
  urlOnly: SHARED_PRODUCT_STATE_COPY.urlOnly,
  doNotBuild: SHARED_PRODUCT_STATE_COPY.doNotBuild,
};

export interface ProductStatusBadgeProps {
  status: ProductStatus;
  label?: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function ProductStatusBadge({ status, label, className, ariaLabel }: ProductStatusBadgeProps) {
  const { locale } = useLocale();
  const classes = ["productStatusBadge", className].filter(Boolean).join(" ");
  const defaultLabel = localizedText(STATUS_LABELS[status], locale);
  const visibleLabel = label ?? defaultLabel;

  return (
    <span className={classes} data-status={status} aria-label={ariaLabel ?? defaultLabel}>
      {visibleLabel}
    </span>
  );
}
