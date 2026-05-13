import React from "react";
import type {
  CreateFlightTableGeometryResponseV1,
  FlightTableDeviceSummaryV1,
  FlightTableDeviceTemplateV1,
  FlightTableManifestV1,
  FlightTableSkillAssemblyResponseV1,
  FlightTableSkillFailureTypeV1,
} from "../../../api/flightTable";
import type {
  FlightTableTelemetryResponseV1,
  FlightTableTelemetryScenarioKeyV1,
} from "../../../api/flightTableTelemetry";
import FieldAssemblyCard, { type FieldAssemblyDraftV1 } from "./FieldAssemblyCard";
import FieldSpatialCard, { type FieldSpatialDraftV1 } from "./FieldSpatialCard";
import DeviceOnboardingWizard, { type DeviceOnboardingDraftV1 } from "./DeviceOnboardingWizard";
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
  deviceDraft: DeviceOnboardingDraftV1;
  deviceLoading: boolean;
  deviceError: string | null;
  deviceTemplates: FlightTableDeviceTemplateV1[];
  onboardedDevices: FlightTableDeviceSummaryV1[];
  telemetryScenarios: FlightTableTelemetryScenarioKeyV1[];
  selectedTelemetryScenarios: FlightTableTelemetryScenarioKeyV1[];
  telemetryResult: FlightTableTelemetryResponseV1 | null;
  telemetryLoading: boolean;
  telemetryError: string | null;
  skillResult: FlightTableSkillAssemblyResponseV1 | null;
  skillFailureType: FlightTableSkillFailureTypeV1;
  skillLoading: boolean;
  skillError: string | null;
  onFieldDraftChange: (patch: Partial<FieldAssemblyDraftV1>) => void;
  onCreateField: () => void;
  onVerifyField: () => void;
  onSpatialDraftChange: (patch: Partial<FieldSpatialDraftV1>) => void;
  onSubmitGeometry: () => void;
  onDeviceDraftChange: (patch: Partial<DeviceOnboardingDraftV1>) => void;
  onOnboardDevice: () => void;
  onRetryDevice: () => void;
  onTelemetryScenarioToggle: (scenario: FlightTableTelemetryScenarioKeyV1) => void;
  onPublishTelemetry: (deviceId?: string | null) => void;
  onVerifyTelemetry: (deviceId?: string | null) => void;
  onSkillFailureTypeChange: (next: FlightTableSkillFailureTypeV1) => void;
  onBindSkills: () => void;
  onFailOneSkill: () => void;
  onRestoreSkills: () => void;
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
      <DeviceOnboardingWizard
        fieldId={manifest?.field_id}
        deviceIds={manifest?.device_ids ?? []}
        credentials={manifest?.credential_ids ?? []}
        templates={props.deviceTemplates}
        devices={props.onboardedDevices}
        draft={props.deviceDraft}
        loading={props.deviceLoading}
        error={props.deviceError}
        telemetryScenarios={props.telemetryScenarios}
        selectedTelemetryScenarios={props.selectedTelemetryScenarios}
        telemetryResult={props.telemetryResult}
        telemetryLoading={props.telemetryLoading}
        telemetryError={props.telemetryError}
        onDraftChange={props.onDeviceDraftChange}
        onOnboardDevice={props.onOnboardDevice}
        onRetry={props.onRetryDevice}
        onTelemetryScenarioToggle={props.onTelemetryScenarioToggle}
        onPublishTelemetry={props.onPublishTelemetry}
        onVerifyTelemetry={props.onVerifyTelemetry}
      />
      <SkillAssemblyCard
        skillBindingIds={manifest?.skill_binding_ids ?? []}
        skillRunIds={manifest?.skill_run_ids ?? []}
        skillResult={props.skillResult}
        failureType={props.skillFailureType}
        loading={props.skillLoading}
        error={props.skillError}
        onFailureTypeChange={props.onSkillFailureTypeChange}
        onBindSkills={props.onBindSkills}
        onFailOne={props.onFailOneSkill}
        onRestore={props.onRestoreSkills}
      />
    </div>
  );
}
