import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, refreshAccessToken, setAccessToken, setOnAuthFailure } from "@/lib/api";
import type { AuthResponse, User } from "@/lib/types";
import { AuthContext, type AuthStatus } from "./AuthContext";

/**
 * Holds auth state. The access token lives in `@/lib/api` (in-memory); here we
 * track the current user and status. On mount we try to restore the session by
 * refreshing against the httpOnly cookie, then loading the profile.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("guest");
  }, []);

  useEffect(() => {
    let active = true;
    // If a refresh ever fails mid-session, drop to guest.
    setOnAuthFailure(clearSession);

    void (async () => {
      try {
        // Deduped refresh: StrictMode's double-invoke (or a 401 firing during
        // bootstrap) shares one /refresh call, so the rotating token never races
        // into reuse-detection.
        await refreshAccessToken();
        // Bail before the /me call if this run was superseded (StrictMode's
        // double-invoke), so dev makes a single /me too.
        if (!active) return;
        const me = await api.get<{ user: User }>("/auth/me");
        if (!active) return;
        setUser(me.data.user);
        setStatus("authenticated");
      } catch {
        if (active) clearSession();
      }
    })();

    return () => {
      active = false;
      setOnAuthFailure(null);
    };
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthResponse>("/auth/login", { email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      clearSession();
    }
  }, [clearSession]);

  return <AuthContext value={{ user, status, login, logout }}>{children}</AuthContext>;
}
