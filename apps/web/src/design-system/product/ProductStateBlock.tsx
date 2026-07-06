// apps/web/src/design-system/product/ProductStateBlock.tsx
// Purpose: render product state messages with accessible status semantics.
// Boundary: state blocks are readback/status surfaces only and do not expose actions by default.

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
  | "blocked"
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
  const isAlert = kind === "error" || kind === "blocked";

  return (
    <section className={classes} data-kind={kind} role={isAlert ? "alert" : "status"} aria-live={isAlert ? "assertive" : "polite"} aria-label="Product state">
      <h2 className="productStateBlock__title">{title}</h2>
      {description ? <p className="productStateBlock__description">{description}</p> : null}
      {details ? <div className="productStateBlock__details">{details}</div> : null}
    </section>
  );
}
