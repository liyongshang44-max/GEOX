// apps/web/src/design-system/product/ProductErrorState.tsx
// Purpose: render a safe bilingual error state without exposing internal diagnostics or payload detail.
// Boundary: error copy must be user-safe and must not render Error.stack, raw payload, SQL, tokens, or exception objects.

import type { ReactNode } from "react";
import { localizedText, useResolvedLocale } from "../../lib/locale";
import { PRODUCT_PRIMITIVE_COPY } from "../../lib/productCopy/localeContract";
import type { ProductStateSurface } from "./ProductEmptyState";

export interface ProductErrorStateProps {
  title: ReactNode;
  message: ReactNode;
  retry?: ReactNode;
  traceId?: string;
  surface?: ProductStateSurface;
  ariaLabel?: string;
  className?: string;
}

export function ProductErrorState({
  title,
  message,
  retry,
  traceId,
  surface,
  ariaLabel,
  className,
}: ProductErrorStateProps) {
  const locale = useResolvedLocale();
  const classes = ["productErrorState", className].filter(Boolean).join(" ");
  const resolvedAriaLabel = ariaLabel ?? localizedText(PRODUCT_PRIMITIVE_COPY.safeErrorStateAria, locale);
  const traceLabel = localizedText(PRODUCT_PRIMITIVE_COPY.traceIdLabel, locale);

  return (
    <section className={classes} data-kind="error" data-surface={surface} role="alert" aria-label={resolvedAriaLabel}>
      <h2 className="productErrorState__title">{title}</h2>
      <p className="productErrorState__message">{message}</p>
      {traceId ? <p className="productErrorState__trace">{traceLabel}: <code>{traceId}</code></p> : null}
      {retry ? <div className="productErrorState__retry">{retry}</div> : null}
    </section>
  );
}
