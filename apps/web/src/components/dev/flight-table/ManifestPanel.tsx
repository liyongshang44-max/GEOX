import React from "react";
import type { FlightTableManifestV1 } from "../../../api/flightTable";

type Props = {
  manifest: FlightTableManifestV1 | null;
};

function displayManifest(manifest: FlightTableManifestV1): Record<string, unknown> {
  return {
    ...manifest,
    credential_ids: manifest.credential_ids.map((item) => ({
      credential_id: item.credential_id,
      status: item.status,
      issued_at: item.issued_at,
      masked_value: item.masked_secret,
    })),
  };
}

export default function ManifestPanel({ manifest }: Props): React.ReactElement {
  return (
    <section className="flight-card">
      <div className="flight-card-head">
        <h2>manifest.json</h2>
        <span>核心对象登记</span>
      </div>
      {manifest ? (
        <pre className="flight-json">{JSON.stringify(displayManifest(manifest), null, 2)}</pre>
      ) : (
        <p className="flight-muted">尚未创建 run，manifest 为空。</p>
      )}
    </section>
  );
}
