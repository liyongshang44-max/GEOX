// apps/web/src/design-system/product/ProductEmptyState.tsx
// Purpose: render product-safe bilingual empty copy without automatically creating an operational action.
// Boundary: empty state copy explains absence only and must not imply a mutation, dispatch, approval, or write action.

import type { ReactNode } from "react";
import { localizedText, useResolvedLocale } from "../../lib/locale";
import { PRODUCT_PRIMITIVE_COPY } from "../../lib/productCopy/localeContract";

export type ProductStateSurface = "customer" | "operator" | "admin" | "supporting";

export interface ProductEmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  reason?: ReactNode;
  nextSafeAction?: ReactNode;
  surface?: ProductStateSurface;
  stateKind?: "empty" | "permissionLimited" | "unavailable";
  ariaLabel?: string;
  className?: string;
}

export function ProductEmptyState({
  title,
  description,
  reason,
  nextSafeAction,
  surface,
  stateKind = "empty",
  ariaLabel,
  className,
}: ProductEmptyStateProps) {
  const locale = useResolvedLocale();
  const classes = ["productEmptyState", className].filter(Boolean).join(" ");
  const resolvedAriaLabel = ariaLabel ?? localizedText(PRODUCT_PRIMITIVE_COPY.emptyStateAria, locale);

  return (
    <section
      className={classes}
      data-kind={stateKind}
      data-surface={surface}
      role="status"
      aria-live="polite"
      aria-label={resolvedAriaLabel}
    >
      <h2 className="productEmptyState__title">{title}</h2>
      {description ? <p className="productEmptyState__description">{description}</p> : null}
      {reason ? <p className="productEmptyState__reason">{reason}</p> : null}
      {nextSafeAction ? <div className="productEmptyState__nextSafeAction">{nextSafeAction}</div> : null}
    </section>
  );
}
