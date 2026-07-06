// apps/web/src/design-system/product/ProductPageShell.tsx
import type { ReactNode } from "react";

// Purpose: keep role surface vocabulary aligned with PFE formal product areas.
export type ProductSurfaceRole = "customer" | "operator" | "admin";

// Purpose: keep layout width choices finite and reusable across later PFE phases.
export type ProductShellWidth = "standard" | "wide" | "full";

export interface ProductPageShellProps {
  surface: ProductSurfaceRole;
  children: ReactNode;
  top?: ReactNode;
  aside?: ReactNode;
  width?: ProductShellWidth;
  ariaLabel?: string;
  className?: string;
}

// Purpose: provide the shared product page landmark and layout skeleton without owning routes.
export function ProductPageShell({
  surface,
  children,
  top,
  aside,
  width = "standard",
  ariaLabel,
  className,
}: ProductPageShellProps) {
  const classes = ["productPageShell", className].filter(Boolean).join(" ");

  return (
    <main className={classes} data-surface={surface} data-width={width} aria-label={ariaLabel ?? "Product page"}>
      {top ? <div className="productPageShell__top">{top}</div> : null}
      <div className="productPageShell__body">
        <div className="productPageShell__main">{children}</div>
        {aside ? <aside className="productPageShell__aside">{aside}</aside> : null}
      </div>
    </main>
  );
}
