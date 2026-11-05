import { PROGRAM } from "../utils/program";

const REQUIREMENTS = [
  `Complete all ${PROGRAM.durationWeeks} weeks of the program`,
  "Ship your capstone projects and have them reviewed",
  "Pass the Week 12 Claude AI certification assessment",
];

function Certificate() {
  return (
    <div
      role="img"
      aria-label={`Sample certificate of completion from Rivira Technologies for the ${PROGRAM.name}, marked SAMPLE.`}
      style={{
        position: "relative",
        background: "#E9E7E2",
        padding: "clamp(10px, 2.2vw, 20px)",
        borderRadius: 4,
        boxShadow: "0 10px 30px -12px rgba(15,23,42,0.12)",
        maxWidth: 520,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <div style={{
        position: "relative",
        overflow: "hidden",
        background: "#FFFFFF",
        border: "1px solid #D6D3CE",
        padding: "clamp(20px, 4.4vw, 40px) clamp(16px, 4vw, 44px)",
        textAlign: "center",
      }}>
        {/* The watermark. Behind the text, never selectable, never announced. */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            transform: "rotate(-30deg)",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "clamp(52px, 11.5vw, 104px)",
            letterSpacing: "0.06em",
            color: "rgba(15,23,42,0.07)",
            pointerEvents: "none",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          SAMPLE
        </span>

        <div style={{ position: "relative" }}>
          <img
            src="/images/logo_mark_dark.png"
            alt=""
            width={168}
            height={72}
            loading="lazy"
            decoding="async"
            style={{ height: "auto", maxWidth: 168, width: "38%", margin: "0 auto 4px" }}
          />

          <p style={{
            margin: "0 0 clamp(14px, 3vw, 26px)",
            fontSize: "clamp(9px, 1.5vw, 11px)",
            fontWeight: 700, letterSpacing: "0.22em",
            textTransform: "uppercase", color: "#475569",
          }}>
            Certificate of Completion
          </p>

          <p style={{
            margin: "0 0 6px",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontStyle: "italic",
            fontSize: "clamp(10px, 1.7vw, 12px)",
            color: "#64748B",
          }}>
            This is to confirm that
          </p>

          {/* The blank slots. Ruled, so they read as a form that has not been
              filled in rather than as a certificate belonging to nobody. */}
          <p style={{
            margin: "0 auto clamp(12px, 2.4vw, 20px)",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "clamp(20px, 3.6vw, 30px)",
            color: "#0B1220",
            borderBottom: "1px solid #CBD5E1",
            maxWidth: "62%",
            paddingBottom: 4,
          }}>
            Name
          </p>

          <p style={{
            margin: "0 0 8px",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontStyle: "italic",
            fontSize: "clamp(10px, 1.7vw, 12px)",
            color: "#64748B",
          }}>
            has successfully completed the program:
          </p>

          <p style={{
            margin: "0 0 clamp(14px, 3vw, 24px)",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(15px, 2.6vw, 22px)",
            lineHeight: 1.25,
            letterSpacing: "-0.01em",
            color: "#0B1220",
          }}>
            {PROGRAM.name}
          </p>

          <p style={{
            margin: "0 auto clamp(18px, 3.6vw, 32px)",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "clamp(11px, 1.8vw, 13px)",
            color: "#475569",
            borderBottom: "1px solid #CBD5E1",
            maxWidth: "34%",
            paddingBottom: 4,
          }}>
            Date
          </p>

          {/* Ruled lines with roles, no names and no drawn signatures. */}
          <div style={{
            display: "flex", justifyContent: "center",
            gap: "clamp(18px, 5vw, 56px)", flexWrap: "wrap",
          }}>
            {["Programme Director", "Rivira Technologies"].map(role => (
              <span key={role} style={{
                minWidth: 110, maxWidth: 180, flex: "0 1 auto",
                borderTop: "1px solid #CBD5E1",
                paddingTop: 6,
                fontSize: "clamp(8px, 1.4vw, 10px)",
                fontWeight: 600, letterSpacing: "0.08em",
                textTransform: "uppercase", color: "#64748B",
              }}>
                {role}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SampleCertificate({ id = "certificate" }: { id?: string }) {
  return (
    <section
      id={id}
      style={{ background: "#FBFBFD", padding: "clamp(44px, 7vw, 72px) 0 clamp(34px, 5.4vw, 56px)" }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto clamp(28px, 5vw, 44px)" }}>
          <p style={{
            margin: "0 0 12px",
            fontSize: 15, fontWeight: 800, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "#0B3D7A",
          }}>
            What you finish with
          </p>
          <h2 style={{
            margin: "0 0 14px",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "clamp(24px, 3.4vw, 34px)",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            color: "#0B1220",
          }}>
            Certificate of Completion
          </h2>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: "#475569" }}>
            Receive a certificate of completion after meeting the requirements of the program.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: "clamp(28px, 4vw, 48px)",
          alignItems: "stretch",
        }} className="rt-cert-grid">
          <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            <Certificate />
          </div>

          <div style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minWidth: 0,
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: 14,
            padding: "clamp(22px, 3.2vw, 32px)",
            boxShadow: "0 10px 30px -12px rgba(15,23,42,0.12)",
          }}>
            <h3 style={{
              margin: "0 0 14px",
              fontFamily: "var(--font-display)",
              fontWeight: 700, fontSize: 17, color: "#0B1220",
            }}>
              What it takes to earn it
            </h3>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
              {REQUIREMENTS.map(req => (
                <li key={req} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  fontSize: 15, lineHeight: 1.6, color: "#475569",
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="#0B3D7A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span>{req}</span>
                </li>
              ))}
            </ul>

            <p style={{
              margin: "22px 0 0",
              paddingTop: 22,
              borderTop: "1px solid #E2E8F0",
              fontSize: 13, lineHeight: 1.6, color: "#64748B",
            }}>
              The Week 12 <b>Claude AI certification</b> and this <b>certificate of completion</b>
              {" "}are two separate things — the first is a graded assessment inside the
              curriculum, the second is awarded for finishing the program.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
