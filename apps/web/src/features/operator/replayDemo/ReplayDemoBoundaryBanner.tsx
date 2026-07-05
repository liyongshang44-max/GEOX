// apps/web/src/features/operator/replayDemo/ReplayDemoBoundaryBanner.tsx
// Purpose: render replay demo nonclaims and demo boundary labels.
// Boundary: this banner is static product copy only.

import React from "react";
import { localizedText, useLocale } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";

export default function ReplayDemoBoundaryBanner(): React.ReactElement {
  const { locale } = useLocale();
  return (
    <section className="operatorReplayDemo__boundaryBanner" aria-label={locale === "en-US" ? "Replay demo boundary" : "回放演示边界"}>
      {OPERATOR_FORMAL_SURFACE_COPY.replayDemo.nonclaims.map((item) => <span className="operatorReplayDemo__boundaryItem" key={item.en}>{localizedText(item, locale)}</span>)}
    </section>
  );
}
