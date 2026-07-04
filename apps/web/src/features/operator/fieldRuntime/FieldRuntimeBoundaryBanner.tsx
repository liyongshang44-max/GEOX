// apps/web/src/features/operator/fieldRuntime/FieldRuntimeBoundaryBanner.tsx
// Purpose: render Field Runtime replay/live nonclaims and read-only boundary copy.
// Boundary: this banner is informational and does not represent device connectivity or production operation.

import React from "react";
import { FIELD_RUNTIME_NONCLAIMS, FIELD_RUNTIME_READ_ONLY_BOUNDARY } from "./runtimeNonclaims";

export default function FieldRuntimeBoundaryBanner(): React.ReactElement {
  return (
    <section className="operatorFieldRuntime__banner" aria-label="Field Runtime boundary banner">
      {FIELD_RUNTIME_NONCLAIMS.map((claim) => (
        <strong className="operatorFieldRuntime__bannerItem" key={claim}>{claim}</strong>
      ))}
      <strong className="operatorFieldRuntime__bannerItem">{FIELD_RUNTIME_READ_ONLY_BOUNDARY}</strong>
    </section>
  );
}
