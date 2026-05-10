import React from "react";
import type { FlightTableManifestV1 } from "../../../api/flightTable";
import FieldAssemblyCard, { type FieldAssemblyDraftV1 } from "./FieldAssemblyCard";
import FieldSpatialCard from "./FieldSpatialCard";
import DeviceOnboardingWizard from "./DeviceOnboardingWizard";
import SkillAssemblyCard from "./SkillAssemblyCard";

type Props = {
  manifest: FlightTableManifestV1 | null;
  fieldDraft: FieldAssemblyDraftV1;
  fieldLoading: boolean;
  fieldError: string | null;
  customerVisible: boolean;
  reportVisible: boolean;
  onFieldDraftChange: (patch: Partial<FieldAssemblyDraftV1>) => void;
  onCreateField: () => void;
  onVerifyField: () => void;
};

export default function FlightAssemblyPanel(props: Props): React.ReactElement {
  const { manifest } = props;
  return (
    <div className="flight-assembly-grid">
      <FieldAssemblyCard
        draft={props.fieldDraft}
        fieldId={manifest?.field_id}
        seasonId={manifest?.season_id}
        crop={manifest?.crop}
        cropStage={manifest?.crop_stage}
        customerVisible={props.customerVisible}
        reportVisible={props.reportVisible}
        loading={props.fieldLoading}
        error={props.fieldError}
        onDraftChange={props.onFieldDraftChange}
        onCreateField={props.onCreateField}
        onVerifyField={props.onVerifyField}
      />
      <FieldSpatialCard geometryId={manifest?.geometry_id} />
      <SkillAssemblyCard skillBindingIds={manifest?.skill_binding_ids ?? []} skillRunIds={manifest?.skill_run_ids ?? []} />
      <DeviceOnboardingWizard deviceIds={manifest?.device_ids ?? []} credentials={manifest?.credential_ids ?? []} />
    </div>
  );
}
