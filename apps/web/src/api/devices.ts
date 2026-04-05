import { apiRequest } from "./client";

export async function bindDeviceToField(input: {
  device_id: string;
  field_id: string;
}): Promise<{ ok?: boolean; device_id?: string; field_id?: string; error?: string }> {
  return apiRequest<{ ok?: boolean; device_id?: string; field_id?: string; error?: string }>(
    `/api/v1/devices/${encodeURIComponent(String(input.device_id ?? "").trim())}/bind-field`,
    {
      method: "POST",
      body: JSON.stringify({ field_id: String(input.field_id ?? "").trim() }),
    },
  );
}
