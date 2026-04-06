import { useQuery } from "@tanstack/react-query";
import { fetchDevices, type DeviceListItem } from "../../../lib/api";
import { queryKeys } from "../../../shared/query/keys";

export function useDevicesListQuery(token: string) {
  return useQuery<DeviceListItem[]>({
    queryKey: queryKeys.devices.list(token),
    queryFn: () => fetchDevices(token),
  });
}
