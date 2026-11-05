import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FileSpreadsheet, FileText, Download, X } from "lucide-react";

/* "Export this page or everything?" — asked by every admin list's Excel / CSV
   buttons through exportWithChoice(). <ExportChoiceHost /> is mounted once
   (App.tsx) and shows the dialog; pages only call the function.

   "All matching rows" asks the API for every row matching the list's current
   search / filters (utils/listCache fetchAllRows) and runs the page's own
   export with them, so the columns are the same either way. */

type Format = "excel" | "csv";
type Ask = {
  format: Format;
  pageCount: number;
  total?: number; // unknown when the list doesn't report one
  resolve: (choice: "page" | "all" | null) => void;
};

let current: Ask | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function ask(a: Omit<Ask, "resolve">) {
  return new Promise<"page" | "all" | null>((resolve) => {
    current = { ...a, resolve };
    emit();
  });
}

export async function exportWithChoice(opts: {
  format: Format;
  /** the rows on screen (this page) */
  loaded: any[];
  /** how many rows match the filters, when the list knows */
  total?: number;
  /** every matching row */
  fetchAll: () => Promise<{ rows: any[]; total?: number }>;
  /** the page's own export, given the rows */
  run: (rows: any[]) => void;
}) {
  const { format, loaded, total, fetchAll, run } = opts;
  // nothing more than what's on screen: no need to ask
  if (total !== undefined && total <= loaded.length) return run(loaded);
  if (!loaded.length && !total) return run(loaded);

  const choice = await ask({ format, pageCount: loaded.length, total });
  if (choice === "page") return run(loaded);
  if (choice !== "all") return;

  const id = toast.loading("Loading all rows to export…");
  try {
    const res = await fetchAll();
    toast.dismiss(id);
    if (res.total && res.total > res.rows.length) {
      toast.info(`Exported the first ${res.rows.length.toLocaleString()} of ${res.total.toLocaleString()} rows.`);
    }
    run(res.rows);
  } catch (err: any) {
    toast.dismiss(id);
    toast.error(err?.message || "Could not load the rows to export");
  }
}

export function ExportChoiceHost() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const a = current;
  useEffect(() => {
    if (!a) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [a]);

  if (!a) return null;
  const close = (choice: "page" | "all" | null) => {
    const r = a.resolve;
    current = null;
    emit();
    r(choice);
  };
  const Icon = a.format === "excel" ? FileSpreadsheet : FileText;
  const name = a.format === "excel" ? "Excel" : "CSV";

  return (
    <div
      onClick={() => close(null)}
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,23,42,.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exp-title"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 440, boxShadow: "0 25px 50px -12px rgba(0,0,0,.3)", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, background: a.format === "excel" ? "#ecfdf5" : "#eff6ff",
              color: a.format === "excel" ? "#059669" : "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={19} />
            </span>
            <h5 id="exp-title" style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: "#0f172a" }}>Export to {name}</h5>
          </div>
          <button type="button" aria-label="Close" onClick={() => close(null)}
            style={{ border: "none", background: "#f1f5f9", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: "0 0 4px", fontSize: 13.5, color: "#475569" }}>Which rows do you want to export?</p>
          <Choice
            title="This page"
            sub={`The ${a.pageCount.toLocaleString()} row${a.pageCount === 1 ? "" : "s"} shown now`}
            onClick={() => close("page")}
          />
          <Choice
            title="All matching rows"
            sub={a.total !== undefined
              ? `All ${a.total.toLocaleString()} rows matching the current search and filters`
              : "Every row matching the current search and filters"}
            onClick={() => close("all")}
            primary
          />
        </div>
      </div>
    </div>
  );
}

function Choice({ title, sub, onClick, primary }: { title: string; sub: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={primary}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", textAlign: "left",
        padding: "13px 15px", borderRadius: 12, cursor: "pointer",
        border: primary ? "1.5px solid var(--ad-brand)" : "1.5px solid #e2e8f0", background: primary ? "#f5f3ff" : "#fff" }}
    >
      <span>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "#0f172a" }}>{title}</span>
        <span style={{ display: "block", fontSize: 12.5, color: "#64748b", marginTop: 2 }}>{sub}</span>
      </span>
      <Download size={17} color={primary ? "var(--ad-brand)" : "#94a3b8"} />
    </button>
  );
}
