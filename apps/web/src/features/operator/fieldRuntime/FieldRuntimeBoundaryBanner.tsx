// apps/web/src/features/operator/fieldRuntime/FieldRuntimeBoundaryBanner.tsx
// Purpose: render Field Runtime replay/live nonclaims and read-only boundary copy.
// Boundary: this banner is informational and does not represent device connectivity or production operation.

import React from "react";
import { localizedText, useLocale } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";

export default function FieldRuntimeBoundaryBanner(): React.ReactElement {
  const { locale } = useLocale();
  const fieldRuntimeCopy = OPERATOR_FORMAL_SURFACE_COPY.fieldRuntime;

  return (
    <section className="operatorFieldRuntime__banner" aria-label={locale === "en-US" ? "Field Runtime boundary banner" : "地块运行边界横幅"}>
      {fieldRuntimeCopy.nonclaims.map((claim) => (
        <strong className="operatorFieldRuntime__bannerItem" key={claim.en}>{localizedText(claim, locale)}</strong>
      ))}
      {fieldRuntimeCopy.boundary.map((claim) => (
        <strong className="operatorFieldRuntime__bannerItem" key={claim.en}>{localizedText(claim, locale)}</strong>
      ))}
    </section>
  );
}
