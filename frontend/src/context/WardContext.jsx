import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { scopeState } from "../access";

const WardContext = createContext(null);
const USER_KEY = "wardzero_user";

function clearStoredUser() {
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function WardProvider({ children }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    clearStoredUser();
    let active = true;
    api("/auth/me")
      .then((result) => {
        if (active) setUser(result.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setState(await api("/state"));
      setError("");
    } catch (err) {
      if (/log in/i.test(err.message)) {
        setUser(null);
        setState(null);
        return;
      }
      setError(err.message);
    }
  }, [user]);

  useEffect(() => {
    if (!authReady || !user || user.role === "pending" || user.status === "pending") return undefined;
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [authReady, user, refresh]);

  const flash = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  const apply = useCallback(async (path, body) => {
    const next = await api(path, { method: "POST", body });
    if (next?.patients) setState(next);
    else if (next?.state) setState(next.state);
    return next;
  }, []);

  const login = useCallback(async (email, password, remember) => {
    const result = await api("/auth/login", { method: "POST", body: { email, password, remember } });
    setUser(result.user);
    return result.user;
  }, []);

  const signup = useCallback(async (form) => {
    const result = await api("/auth/signup", { method: "POST", body: form });
    return result.user;
  }, []);

  const loadAccounts = useCallback(async () => {
    const result = await api("/admin/users", { method: "POST" });
    setAccounts(result.accounts);
    return result.accounts;
  }, []);

  const assignAccount = useCallback(async (id, patch) => {
    const result = await api(`/admin/users/${id}`, { method: "POST", body: patch });
    setAccounts(result.accounts);
    return result.accounts;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* The cookie is cleared locally even if the API is briefly unreachable. */
    }
    clearStoredUser();
    setUser(null);
    setAccounts([]);
    setState(null);
  }, []);

  const visible = useMemo(() => scopeState(state, user), [state, user]);

  const value = useMemo(() => ({
    state: visible, error, toast, user, authReady, accounts, flash, refresh, login, signup, logout, apply, loadAccounts, assignAccount,
  }), [visible, error, toast, user, authReady, accounts, flash, refresh, login, signup, logout, apply, loadAccounts, assignAccount]);

  return (
    <WardContext.Provider value={value}>
      {children}
      {toast ? <div className="toast">{toast}</div> : null}
    </WardContext.Provider>
  );
}

export function useWard() {
  return useContext(WardContext);
}
