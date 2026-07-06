// apps/web/src/design-system/product/ProductPageShell.tsx
// Purpose: provide the shared product page landmark and layout skeleton without owning routes.
// Boundary: this component changes semantic layout and focus navigation only.

import type { ReactNode } from "react";
import ProductSkipLink from "../../components/a11y/ProductSkipLink";

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
  ariaLabelledBy?: string;
  mainContentId?: string;
  skipLinkLabel?: string;
  className?: string;
}

export function ProductPageShell({
  surface,
  children,
  top,
  aside,
  width = "standard",
  ariaLabel,
  ariaLabelledBy,
  mainContentId = "product-main-content",
  skipLinkLabel,
  className,
}: ProductPageShellProps) {
  const classes = ["productPageShell", className].filter(Boolean).join(" ");
  const labelledByProps = ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : { "aria-label": ariaLabel ?? "Product page" };

  return (
    <>
      <ProductSkipLink targetId={mainContentId} label={skipLinkLabel} />
      <main id={mainContentId} className={classes} data-surface={surface} data-width={width} tabIndex={-1} {...labelledByProps}>
        {top ? <div className="productPageShell__top">{top}</div> : null}
        <div className="productPageShell__body">
          <div className="productPageShell__main">{children}</div>
          {aside ? <aside className="productPageShell__aside">{aside}</aside> : null}
        </div>
      </main>
    </>
  );
}
