import { useAuthProviderSession } from "./AuthProvider";

export function useSession(): {
  token: string;
  setToken: (nextToken: string) => void;
  clearToken: () => void;
} {
  return useAuthProviderSession();
}
