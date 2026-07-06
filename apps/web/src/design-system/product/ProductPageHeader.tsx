// apps/web/src/design-system/product/ProductPageHeader.tsx
import type { ReactNode } from "react";

export interface ProductPageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  lead?: ReactNode;
  metadata?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  nonclaim?: ReactNode;
  className?: string;
}

// Purpose: provide a consistent page title structure without inventing default calls to action.
export function ProductPageHeader({
  title,
  eyebrow,
  lead,
  metadata,
  primaryAction,
  secondaryActions,
  nonclaim,
  className,
}: ProductPageHeaderProps) {
  const classes = ["productPageHeader", className].filter(Boolean).join(" ");

  return (
    <header className={classes}>
      <div className="productPageHeader__copy">
        {eyebrow ? <p className="productPageHeader__eyebrow">{eyebrow}</p> : null}
        <h1 className="productPageHeader__title">{title}</h1>
        {lead ? <p className="productPageHeader__lead">{lead}</p> : null}
        {metadata ? <div className="productPageHeader__metadata">{metadata}</div> : null}
      </div>
      {(primaryAction || secondaryActions || nonclaim) ? (
        <div className="productPageHeader__actions" aria-label="Page actions and boundaries">
          {nonclaim ? <div className="productPageHeader__nonclaim">{nonclaim}</div> : null}
          {secondaryActions ? <div className="productPageHeader__secondaryActions">{secondaryActions}</div> : null}
          {primaryAction ? <div className="productPageHeader__primaryAction">{primaryAction}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
