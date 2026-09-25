import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserProfile {
  id: string;
  name: string;
  email: string | null;
  role: string;
  department: string | null;
  license_number: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: string | null;
  user: UserProfile | null;
  setTokens: (access: string, refresh: string, role: string) => void;
  setUser: (user: UserProfile | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      role: null,
      user: null,
      setTokens: (accessToken, refreshToken, role) =>
        set({ accessToken, refreshToken, role }),
      setUser: (user) => set({ user }),
      logout: () =>
        set({ accessToken: null, refreshToken: null, role: null, user: null }),
    }),
    { name: "meditrack-auth" }
  )
);
