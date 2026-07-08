// apps/web/src/design-system/product/ProductStateBlock.tsx
// Purpose: render bilingual product state messages with accessible status semantics.
// Boundary: state blocks are readback/status surfaces only and do not expose actions by default.

import type { ReactNode } from "react";
import { localizedText, useResolvedLocale } from "../../lib/locale";
import { PRODUCT_PRIMITIVE_COPY } from "../../lib/productCopy/localeContract";
import type { ProductStateSurface } from "./ProductEmptyState";

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
  surface?: ProductStateSurface;
  ariaLabel?: string;
  className?: string;
}

export function ProductStateBlock({ kind, title, description, details, surface, ariaLabel, className }: ProductStateBlockProps) {
  const locale = useResolvedLocale();
  const classes = ["productStateBlock", className].filter(Boolean).join(" ");
  const isAlert = kind === "error" || kind === "blocked";
  const resolvedAriaLabel = ariaLabel ?? localizedText(PRODUCT_PRIMITIVE_COPY.productStateAria, locale);

  return (
    <section
      className={classes}
      data-kind={kind}
      data-surface={surface}
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
      aria-label={resolvedAriaLabel}
    >
      <h2 className="productStateBlock__title">{title}</h2>
      {description ? <p className="productStateBlock__description">{description}</p> : null}
      {details ? <div className="productStateBlock__details">{details}</div> : null}
    </section>
  );
}
