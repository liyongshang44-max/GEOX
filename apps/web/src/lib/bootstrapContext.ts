export type BootstrapContext = {
  device_mode: string | null;
  simulator_started: boolean | null;
  simulator_status: string | null;
  skill_related_note: string | null;
};

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

export function extractBootstrapContext(...sources: unknown[]): BootstrapContext {
  let device_mode: string | null = null;
  let simulator_started: boolean | null = null;
  let simulator_status: string | null = null;
  let skill_related_note: string | null = null;

  for (const source of sources) {
    const item = source as any;
    if (!item || typeof item !== "object") continue;
    if (device_mode == null) device_mode = normalizeText(item.device_mode);
    if (simulator_started == null) simulator_started = normalizeBoolean(item.simulator_started);
    if (simulator_status == null) simulator_status = normalizeText(item.simulator_status ?? item.status);
    if (skill_related_note == null) {
      skill_related_note = normalizeText(
        item.skill_related_note
          ?? item.skill_carrier_note
          ?? item.skill_note
          ?? item.source_note
      );
    }
  }

  return { device_mode, simulator_started, simulator_status, skill_related_note };
}
