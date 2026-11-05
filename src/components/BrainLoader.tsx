import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/* Full-screen loader with the animated neural brain — the same look as the
   site's first-load loader (public/js/neuralbrain.js + public/css/loader.css),
   for use inside the app. Renders into <body> and stops its animation when it
   unmounts. */
export default function BrainLoader({ label = "Loading" }: { label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const engine = (window as any).NeuralBrain;
    if (!engine || !canvasRef.current) return;
    const reducedMotion = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    return engine.start(canvasRef.current, { reducedMotion });
  }, []);

  return createPortal(
    <div className="rt-brain-loader" role="status" aria-label={label}>
      <div className="kl-box">
        <canvas ref={canvasRef} className="kl-brain" aria-hidden="true" />
        <div className="kl-brand" aria-hidden="true">
          <div className="kl-main">
            <span className="kl-genai" data-text="Rivira Technologies">Rivira Technologies</span>
          </div>
          <div className="kl-sub">
            <span className="kl-line left" />
            <span className="kl-sub-text">INNOVATIONS</span>
            <span className="kl-line right" />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
