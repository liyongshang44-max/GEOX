import { useQuery } from "@tanstack/react-query";
import { fetchOperationStates } from "../../../api";

export function useOperationsListQuery() {
  return useQuery({
    queryKey: ["operations", "list"],
    queryFn: async () => {
      const res = await fetchOperationStates({ limit: 200 });
      return Array.isArray(res.items) ? res.items : [];
    },
  });
}
