import { createContext, useContext } from "react";

/* Per-page permissions for Admin (role "Y") accounts. The API is the source of
   truth (api/admin-permissions.js): GET api/my-permissions returns the signed-in
   adminer's permissions plus the page catalogue. A super admin (X) — and an
   Admin saved before permissions existed — gets every permission. */

// "view" on every page, plus the page's own actions (create, edit, status,
// approve, delete, send, reorder …) — see the catalogue in the API.
export type PermAction = string;
export type PermMap = Record<string, PermAction[]>;
export type PermPage = {
  key: string;
  label: string;
  actions: { key: PermAction; label: string }[];
  parent?: string;   // inner page opened from this page (e.g. Batches → Courses)
  desc?: string;     // one-line summary shown in the permission editor
};
export type PermGroup = { group: string; pages: PermPage[] };

export type AdminPerms = {
  loaded: boolean;
  role: string;            // "X" | "Y" | "" (not an adminer)
  full: boolean;           // every permission (super admin / legacy admin)
  permissions: PermMap;
  catalogue: PermGroup[];
};

export const EMPTY_PERMS: AdminPerms = { loaded: false, role: "", full: false, permissions: {}, catalogue: [] };

export const AdminPermsContext = createContext<AdminPerms>(EMPTY_PERMS);
export const useAdminPerms = () => useContext(AdminPermsContext);

// Panel URL -> catalogue page key ("" for pages that are not permission-gated,
// e.g. My Profile). Matches the keys the sidebar uses.
export function pageKeyFromPath(path: string): string {
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return "dashboard";
  const m = path.match(/^\/panel\/([^/?#]+)/);
  if (!m) return "";
  // the Classes page shows Live Classes data (view only): same permission
  return m[1] === "classes" ? "live-classes" : m[1];
}

export function can(perms: AdminPerms, page: string, action: PermAction = "view"): boolean {
  if (perms.role !== "Y" || perms.full) return true;
  return (perms.permissions[page] || []).includes(action);
}

/* For a panel page: permCan("edit") → may the signed-in adminer use that
   action on this page? Several arguments = any of them; "page:action" checks
   another page. Always true for super admins, trainers and students. */
export function usePagePerm(page: string) {
  const perms = useAdminPerms();
  return (...needs: string[]) =>
    needs.some((n) => {
      const i = n.indexOf(":");
      return i < 0 ? can(perms, page, n) : can(perms, n.slice(0, i), n.slice(i + 1));
    });
}

export function isGatedPage(perms: AdminPerms, page: string): boolean {
  return !!page && perms.catalogue.some((g) => g.pages.some((p) => p.key === page));
}

export function findPage(catalogue: PermGroup[], page: string): PermPage | undefined {
  for (const g of catalogue) for (const p of g.pages) if (p.key === page) return p;
  return undefined;
}

// Panel URL for a catalogue page
export const pagePath = (key: string) => (key === "dashboard" ? "/dashboard" : "/panel/" + key);
