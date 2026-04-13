import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "../api";

export type Role = "regular" | "business" | "admin";

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
}

interface LoginResponse {
  token: string;
  expiresAt: string;
}
interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);

function parseToken(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { id: payload.id, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

function loadUser(): AuthUser | null {
  const token = localStorage.getItem("token");
  if (!token) return null;
  return parseToken(token);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser);

  const login = useCallback(async (email: string, password: string) => {
    const { token } = await api.post<LoginResponse>("/auth/tokens", {
      email,
      password,
    });
    localStorage.setItem("token", token);
    setUser(parseToken(token));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
    window.location.href = "/";
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
