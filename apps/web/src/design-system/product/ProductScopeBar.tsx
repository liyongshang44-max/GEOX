// apps/web/src/design-system/product/ProductScopeBar.tsx
import type { ReactNode } from "react";
import type { ProductSurfaceRole } from "./ProductPageShell";

export interface ProductScopeItem {
  label: ReactNode;
  value: ReactNode;
}

export interface ProductScopeBarProps {
  surface: ProductSurfaceRole;
  items: ProductScopeItem[];
  className?: string;
  ariaLabel?: string;
}

// Purpose: display tenant/project/field/operation/role scope as read-only context.
export function ProductScopeBar({ surface, items, className, ariaLabel }: ProductScopeBarProps) {
  const classes = ["productScopeBar", className].filter(Boolean).join(" ");

  return (
    <dl className={classes} data-surface={surface} aria-label={ariaLabel ?? "Product scope"}>
      {items.map((item, index) => (
        <div className="productScopeBar__item" key={index}>
          <dt className="productScopeBar__label">{item.label}</dt>
          <dd className="productScopeBar__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
