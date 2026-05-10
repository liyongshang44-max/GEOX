import React from "react";
import type { FlightTableManifestV1 } from "../../../api/flightTable";
import FieldAssemblyCard from "./FieldAssemblyCard";
import FieldSpatialCard from "./FieldSpatialCard";
import DeviceOnboardingWizard from "./DeviceOnboardingWizard";
import SkillAssemblyCard from "./SkillAssemblyCard";

type Props = {
  manifest: FlightTableManifestV1 | null;
};

export default function FlightAssemblyPanel({ manifest }: Props): React.ReactElement {
  return (
    <div className="flight-assembly-grid">
      <FieldAssemblyCard
        fieldId={manifest?.field_id}
        seasonId={manifest?.season_id}
        crop={manifest?.crop}
        cropStage={manifest?.crop_stage}
      />
      <FieldSpatialCard geometryId={manifest?.geometry_id} />
      <SkillAssemblyCard skillBindingIds={manifest?.skill_binding_ids ?? []} skillRunIds={manifest?.skill_run_ids ?? []} />
      <DeviceOnboardingWizard deviceIds={manifest?.device_ids ?? []} credentials={manifest?.credential_ids ?? []} />
    </div>
  );
}
