// apps/web/src/design-system/product/ProductErrorState.tsx
import type { ReactNode } from "react";

export interface ProductErrorStateProps {
  title: ReactNode;
  message: ReactNode;
  retry?: ReactNode;
  traceId?: string;
  className?: string;
}

// Purpose: render a safe error state without exposing internal diagnostics or payload detail.
export function ProductErrorState({ title, message, retry, traceId, className }: ProductErrorStateProps) {
  const classes = ["productErrorState", className].filter(Boolean).join(" ");

  return (
    <section className={classes} role="alert" aria-label="Error state">
      <h2 className="productErrorState__title">{title}</h2>
      <p className="productErrorState__message">{message}</p>
      {traceId ? <p className="productErrorState__trace">Trace ID: <code>{traceId}</code></p> : null}
      {retry ? <div className="productErrorState__retry">{retry}</div> : null}
    </section>
  );
}
