// apps/web/src/design-system/product/ProductTraceLink.tsx
import type { ReactNode } from "react";

export interface ProductTraceLinkProps {
  label: ReactNode;
  traceId: string;
  href?: string;
  sourceType?: ReactNode;
  className?: string;
}

export function ProductTraceLink({ label, traceId, href, sourceType, className }: ProductTraceLinkProps) {
  const classes = ["productTraceLink", className].filter(Boolean).join(" ");
  const content = (
    <>
      <span className="productTraceLink__label">{label}</span>
      <code className="productTraceLink__id">{traceId}</code>
      {sourceType ? <span className="productTraceLink__source">{sourceType}</span> : null}
    </>
  );

  if (href) {
    return (
      <a className={classes} href={href} aria-label={`Trace reference ${traceId}`}>
        {content}
      </a>
    );
  }

  return (
    <span className={classes} aria-label={`Trace reference ${traceId}`}>
      {content}
    </span>
  );
}
