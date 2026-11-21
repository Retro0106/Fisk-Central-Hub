import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Me } from "./api";

type UserContextType = {
  user: Me | null;
  loading: boolean;
  demoLogin: boolean;
  setUser: (u: Me | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoLogin, setDemoLogin] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ user: Me | null; demo_login: boolean }>("/auth/session");
      setUser(res.data.user);
      setDemoLogin(res.data.demo_login);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      localStorage.removeItem("cart");
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, demoLogin, setUser, refresh, logout }}>{children}</UserContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used inside UserProvider");
  return context;
}
