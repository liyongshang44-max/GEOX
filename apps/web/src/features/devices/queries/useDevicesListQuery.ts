import { useQuery } from "@tanstack/react-query";
import { fetchDevices, type DeviceListItem } from "../../../lib/api";

export function useDevicesListQuery(token: string) {
  return useQuery<DeviceListItem[]>({
    queryKey: ["devices", "list", token],
    queryFn: () => fetchDevices(token),
  });
}
