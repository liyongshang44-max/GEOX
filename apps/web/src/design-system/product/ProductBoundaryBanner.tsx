// apps/web/src/design-system/product/ProductBoundaryBanner.tsx
import type { ReactNode } from "react";

// Purpose: restrict banner tone to product boundary semantics, not business conclusions.
export type ProductBoundaryTone = "neutral" | "readOnly" | "replayBacked" | "disabled" | "degraded" | "blocked";

export interface ProductBoundaryBannerProps {
  tone?: ProductBoundaryTone;
  title: ReactNode;
  description?: ReactNode;
  items?: ReactNode[];
  ariaLabel?: string;
  className?: string;
}

// Purpose: render read-only, replay-backed, disabled, degraded, or blocked boundary copy consistently.
export function ProductBoundaryBanner({
  tone = "neutral",
  title,
  description,
  items = [],
  ariaLabel,
  className,
}: ProductBoundaryBannerProps) {
  const classes = ["productBoundaryBanner", className].filter(Boolean).join(" ");

  return (
    <section className={classes} data-tone={tone} aria-label={ariaLabel ?? "Product boundary"}>
      <div className="productBoundaryBanner__content">
        <strong className="productBoundaryBanner__title">{title}</strong>
        {description ? <p className="productBoundaryBanner__description">{description}</p> : null}
      </div>
      {items.length > 0 ? (
        <ul className="productBoundaryBanner__items">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
