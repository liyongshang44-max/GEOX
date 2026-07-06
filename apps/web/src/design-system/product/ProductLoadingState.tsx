// apps/web/src/design-system/product/ProductLoadingState.tsx
// Purpose: render accessible loading copy with polite announcement semantics.
// Boundary: loading state must be readable copy and must not act as a fake progress guarantee.

import type { ReactNode } from "react";
import type { ProductStateSurface } from "./ProductEmptyState";

export interface ProductLoadingStateProps {
  label: ReactNode;
  description?: ReactNode;
  surface?: ProductStateSurface;
  ariaLabel?: string;
  className?: string;
}

export function ProductLoadingState({
  label,
  description,
  surface,
  ariaLabel = "Loading state",
  className,
}: ProductLoadingStateProps) {
  const classes = ["productLoadingState", className].filter(Boolean).join(" ");

  return (
    <section className={classes} data-kind="loading" data-surface={surface} aria-label={ariaLabel} aria-live="polite" aria-busy="true">
      <span className="productLoadingState__indicator" aria-hidden="true" />
      <div className="productLoadingState__copy">
        <strong className="productLoadingState__label">{label}</strong>
        {description ? <p className="productLoadingState__description">{description}</p> : null}
      </div>
    </section>
  );
}
