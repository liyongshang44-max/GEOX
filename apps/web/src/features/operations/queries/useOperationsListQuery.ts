import { useQuery } from "@tanstack/react-query";
import { fetchOperationStates } from "../../../api";
import { queryKeys } from "../../../shared/query/keys";

export function useOperationsListQuery() {
  return useQuery({
    queryKey: queryKeys.operations.list(),
    queryFn: async () => {
      const res = await fetchOperationStates({ limit: 200 });
      return Array.isArray(res.items) ? res.items : [];
    },
  });
}
