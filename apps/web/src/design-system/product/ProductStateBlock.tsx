// apps/web/src/design-system/product/ProductStateBlock.tsx
import type { ReactNode } from "react";

export type ProductStateKind =
  | "empty"
  | "loading"
  | "error"
  | "unavailable"
  | "degraded"
  | "permissionLimited"
  | "replayBacked"
  | "notConnected"
  | "notOnline"
  | "disabled"
  | "future"
  | "urlOnly"
  | "doNotBuild";

export interface ProductStateBlockProps {
  kind: ProductStateKind;
  title: ReactNode;
  description?: ReactNode;
  details?: ReactNode;
  className?: string;
}

export function ProductStateBlock({ kind, title, description, details, className }: ProductStateBlockProps) {
  const classes = ["productStateBlock", className].filter(Boolean).join(" ");

  return (
    <section className={classes} data-kind={kind} aria-label="Product state">
      <h2 className="productStateBlock__title">{title}</h2>
      {description ? <p className="productStateBlock__description">{description}</p> : null}
      {details ? <div className="productStateBlock__details">{details}</div> : null}
    </section>
  );
}
