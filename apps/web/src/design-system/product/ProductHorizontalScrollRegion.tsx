// apps/web/src/design-system/product/ProductHorizontalScrollRegion.tsx
// Purpose: own the accessible horizontal-overflow boundary for wide semantic product data.
// Boundary: the region contains overflow; it does not change table fields, data semantics, or route behavior.

import type { ReactNode } from "react";

export interface ProductHorizontalScrollRegionProps {
  ariaLabel: string;
  overflowOwner: string;
  children: ReactNode;
  className?: string;
}

export function ProductHorizontalScrollRegion({
  ariaLabel,
  overflowOwner,
  children,
  className,
}: ProductHorizontalScrollRegionProps) {
  const classes = ["productHorizontalScrollRegion", className].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      data-horizontal-scroll-region="true"
      data-overflow-owner={overflowOwner}
    >
      {children}
    </div>
  );
}
