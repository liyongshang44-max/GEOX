import React from "react";
import type { CreateFlightTableGeometryResponseV1, FlightTableManifestV1 } from "../../../api/flightTable";
import FieldAssemblyCard, { type FieldAssemblyDraftV1 } from "./FieldAssemblyCard";
import FieldSpatialCard, { type FieldSpatialDraftV1 } from "./FieldSpatialCard";
import DeviceOnboardingWizard from "./DeviceOnboardingWizard";
import SkillAssemblyCard from "./SkillAssemblyCard";

type Props = {
  manifest: FlightTableManifestV1 | null;
  fieldDraft: FieldAssemblyDraftV1;
  fieldLoading: boolean;
  fieldError: string | null;
  customerVisible: boolean;
  reportVisible: boolean;
  spatialDraft: FieldSpatialDraftV1;
  spatialLoading: boolean;
  spatialError: string | null;
  geometryResult: CreateFlightTableGeometryResponseV1 | null;
  onFieldDraftChange: (patch: Partial<FieldAssemblyDraftV1>) => void;
  onCreateField: () => void;
  onVerifyField: () => void;
  onSpatialDraftChange: (patch: Partial<FieldSpatialDraftV1>) => void;
  onSubmitGeometry: () => void;
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
      <FieldSpatialCard
        geometryId={manifest?.geometry_id}
        fieldId={manifest?.field_id}
        draft={props.spatialDraft}
        geometryResult={props.geometryResult}
        loading={props.spatialLoading}
        error={props.spatialError}
        onDraftChange={props.onSpatialDraftChange}
        onSubmitGeometry={props.onSubmitGeometry}
      />
      <SkillAssemblyCard skillBindingIds={manifest?.skill_binding_ids ?? []} skillRunIds={manifest?.skill_run_ids ?? []} />
      <DeviceOnboardingWizard deviceIds={manifest?.device_ids ?? []} credentials={manifest?.credential_ids ?? []} />
    </div>
  );
}
