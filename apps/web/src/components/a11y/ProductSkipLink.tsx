// apps/web/src/components/a11y/ProductSkipLink.tsx
// Purpose: provide a shared skip-to-content link for formal product frontend surfaces.
// Boundary: this component changes focus navigation only and does not own routes or product capability.

import React from "react";

type ProductSkipLinkProps = {
  targetId?: string;
  label?: string;
  className?: string;
};

export default function ProductSkipLink({
  targetId = "product-main-content",
  label = "Skip to main content",
  className,
}: ProductSkipLinkProps): React.ReactElement {
  const classes = ["productSkipLink", className].filter(Boolean).join(" ");

  return (
    <a className={classes} href={`#${targetId}`}>
      {label}
    </a>
  );
}
