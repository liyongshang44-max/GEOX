// apps/web/src/design-system/product/ProductLoadingState.tsx
import type { ReactNode } from "react";

export interface ProductLoadingStateProps {
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}

// Purpose: render accessible loading copy with polite announcement semantics.
export function ProductLoadingState({ label, description, className }: ProductLoadingStateProps) {
  const classes = ["productLoadingState", className].filter(Boolean).join(" ");

  return (
    <section className={classes} aria-live="polite" aria-busy="true">
      <span className="productLoadingState__indicator" aria-hidden="true" />
      <div className="productLoadingState__copy">
        <strong className="productLoadingState__label">{label}</strong>
        {description ? <p className="productLoadingState__description">{description}</p> : null}
      </div>
    </section>
  );
}
