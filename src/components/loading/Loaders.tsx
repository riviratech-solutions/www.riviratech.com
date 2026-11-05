import { useEffect, useRef, useState, type ReactNode } from "react";
import { onActiveRequests } from "../../utils/loadingBus";

/* Small loading indicators for the panel (styles: "loading system" in
   public/css/panel.css). */

/** A spinner + label inside a button while its request runs, e.g.
    {saving ? <ButtonLoader label="Saving..." /> : "Save"} (the button itself
    stays disabled meanwhile, so it can't be sent twice). */
export function ButtonLoader({ label }: { label?: ReactNode }) {
  return (
    <span className="btn-loading" role="status">
      <span className="btn-spin" aria-hidden="true" />
      {label}
    </span>
  );
}

/** A spinner + text for a part of a form or modal that is still loading
    (dropdown options, details). */
export function InlineLoader({ label = "Loading…", center = false }: { label?: ReactNode; center?: boolean }) {
  return (
    <span className={"inline-loader" + (center ? " center" : "")} role="status">
      <span className="btn-spin" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

/** The thin brand-coloured line across the top of the panel while API requests
    are on their way (utils/loadingBus). Shown only for requests that take longer
    than a moment; nothing is faked: it grows while waiting, completes when the
    last request has finished, then fades. */
export function PageLoader() {
  const [state, setState] = useState<"idle" | "run" | "done">("idle");
  const showTimer = useRef(0);
  const hideTimer = useRef(0);
  const safety = useRef(0);

  useEffect(() => {
    const off = onActiveRequests((n) => {
      if (n > 0) {
        window.clearTimeout(hideTimer.current);
        if (!showTimer.current) {
          showTimer.current = window.setTimeout(() => {
            setState("run");
            // a request that never reports back must not leave the line up
            window.clearTimeout(safety.current);
            safety.current = window.setTimeout(() => setState("idle"), 30000);
          }, 200);
        }
      } else {
        window.clearTimeout(showTimer.current);
        showTimer.current = 0;
        window.clearTimeout(safety.current);
        setState((s) => {
          if (s !== "run") return "idle";
          hideTimer.current = window.setTimeout(() => setState("idle"), 450);
          return "done";
        });
      }
    });
    return () => {
      off();
      window.clearTimeout(showTimer.current);
      window.clearTimeout(hideTimer.current);
      window.clearTimeout(safety.current);
    };
  }, []);

  return (
    <div className={"page-loader " + state} aria-hidden="true">
      <div className="page-loader-bar" />
    </div>
  );
}
