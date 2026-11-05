import { useEffect, useState } from "react";
import axios from "axios";
import { SERVER_URL } from "../components/Includes";

/* The signed-in panel user, cached in localStorage.

   Saved from the sign-in response (Signin.tsx). Readers (panel header,
   dashboard greeting) use the cached copy straight away and only fetch
   GET api/me when it is missing or belongs to a different account than the
   current session (the "key" cookie / check-login key). Cleared on logout. */

export type PanelUser = {
  mem_id: string;
  name: string;
  email?: string;
  number?: string;
  status?: string;   // X super admin · Y admin · 1 student · 2 trainer
  role?: string;
};

const KEY = "kkr_user";
const EVENT = "rt-user-change";

export function getCachedUser(): PanelUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    const u = raw ? JSON.parse(raw) : null;
    return u && u.mem_id ? u : null;
  } catch {
    return null;
  }
}

export function setCachedUser(u: Partial<PanelUser> | null | undefined) {
  if (!u || !u.mem_id) return;
  try { localStorage.setItem(KEY, JSON.stringify(u)); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(EVENT));
}

export function clearCachedUser() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

export const roleLabel = (status?: string) =>
  status === "X" ? "Super Admin" : status === "Y" ? "Admin" : status === "2" ? "Trainer" : status === "1" ? "Student" : "";

// one /me request at a time, shared by every component that asks
let inflight: Promise<PanelUser | null> | null = null;
export function fetchCurrentUser(): Promise<PanelUser | null> {
  if (!inflight) {
    inflight = axios.get(SERVER_URL + "api/me", { withCredentials: true })
      .then((res) => {
        if (!res.data?.success) return null;
        setCachedUser(res.data.data);
        return res.data.data as PanelUser;
      })
      .catch(() => null)
      .finally(() => { setTimeout(() => { inflight = null; }, 0); });
  }
  return inflight;
}

/* The current user: cached copy first, refreshed from the API when it is
   missing or doesn't match the signed-in account. */
export function useCurrentUser(): PanelUser | null {
  const [user, setUser] = useState<PanelUser | null>(() => getCachedUser());

  useEffect(() => {
    const sync = () => setUser(getCachedUser());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);   // other tabs

    let live = true;
    axios.get(SERVER_URL + "api/check-login", { withCredentials: true })
      .then((res) => {
        if (!live || !res.data?.loggedIn) return;
        const cached = getCachedUser();
        if (!cached || (res.data.key && cached.mem_id !== res.data.key)) fetchCurrentUser();
      })
      .catch(() => { /* offline: keep the cached copy */ });

    return () => {
      live = false;
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return user;
}
