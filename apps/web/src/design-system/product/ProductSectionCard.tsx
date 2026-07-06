// apps/web/src/design-system/product/ProductSectionCard.tsx
import type { ReactNode } from "react";

export interface ProductSectionCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

// Purpose: provide a reusable product panel without hard-coded business status logic.
export function ProductSectionCard({ title, subtitle, meta, status, footer, children, className }: ProductSectionCardProps) {
  const classes = ["productSectionCard", className].filter(Boolean).join(" ");

  return (
    <section className={classes}>
      {(title || subtitle || meta || status) ? (
        <header className="productSectionCard__header">
          <div className="productSectionCard__copy">
            {title ? <h2 className="productSectionCard__title">{title}</h2> : null}
            {subtitle ? <p className="productSectionCard__subtitle">{subtitle}</p> : null}
            {meta ? <div className="productSectionCard__meta">{meta}</div> : null}
          </div>
          {status ? <div className="productSectionCard__status">{status}</div> : null}
        </header>
      ) : null}
      <div className="productSectionCard__body">{children}</div>
      {footer ? <footer className="productSectionCard__footer">{footer}</footer> : null}
    </section>
  );
}
