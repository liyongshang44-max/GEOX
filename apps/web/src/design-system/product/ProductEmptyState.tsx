// apps/web/src/design-system/product/ProductEmptyState.tsx
import type { ReactNode } from "react";

export interface ProductEmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  reason?: ReactNode;
  nextSafeAction?: ReactNode;
  className?: string;
}

// Purpose: render product-safe empty copy without automatically creating an operational action.
export function ProductEmptyState({ title, description, reason, nextSafeAction, className }: ProductEmptyStateProps) {
  const classes = ["productEmptyState", className].filter(Boolean).join(" ");

  return (
    <section className={classes} aria-label="Empty state">
      <h2 className="productEmptyState__title">{title}</h2>
      {description ? <p className="productEmptyState__description">{description}</p> : null}
      {reason ? <p className="productEmptyState__reason">{reason}</p> : null}
      {nextSafeAction ? <div className="productEmptyState__nextSafeAction">{nextSafeAction}</div> : null}
    </section>
  );
}
