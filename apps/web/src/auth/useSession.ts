import { useAuthProviderSession } from "./AuthProvider";

export function useSession() {
  return useAuthProviderSession();
}
