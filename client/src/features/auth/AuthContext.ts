import { createContext } from "react";
import type { User } from "@/lib/types";

export type AuthStatus = "loading" | "authenticated" | "guest";

export interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
