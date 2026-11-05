import { useEffect, useRef, useState, lazy, Suspense } from "react";
import axios from "axios";
import { Head, SERVER_URL } from "../../components/Includes";
import { getSeoByPath } from "../../utils/seo";
import { PageHero } from "../../components/site/PageKit";

/**
 * Request your certificate — the form for students with no portal account.
 *
 * Most people who finish a course never get a portal login, so the request form
 * inside the portal is unreachable for them and their certificate is never
 * asked for. This is the way in.
 *
 * NOTHING HERE IS VERIFIED, and the page says so. There is no account to check
 * against, so a submission is a claim that someone completed a course, not
 * proof of it — the admin review is the only gate. The copy avoids promising a
 * certificate: it says the request will be reviewed, because telling someone
 * "your certificate is on the way" before a human has looked is how an
 * unverified claim turns into an expectation.
 *
 * Turnstile and the honeypot are here for the same reason they are on every
 * other public form: they keep bulk submissions from burying the real ones.
 * Neither makes a claim true.
 */

const seo = getSeoByPath("certificate-request");

const TurnstileWidget = lazy(() => import("../../components/TurnstileWidget"));
const captchaEnabled = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

type Course = { id: string; title: string };
type Batch = {
  id?: number;
  b_id: string;
  name: string;
  c_id?: string;
  sdate?: string | null;
  edate?: string | null;
};

function formatDateInput(raw: any): string {
  if (!raw) return "";
  const s = String(raw).trim();
  let d: Date | null = null;
  if (/^\d{10}$/.test(s)) {
    d = new Date(Number(s) * 1000);
  } else if (/^\d{13}$/.test(s)) {
    d = new Date(Number(s));
  } else if (s.length >= 10) {
    d = new Date(s);
  }
  if (d && !isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return s;
}

const TYPES = [
  { value: "course", label: "Course completion" },
  { value: "internship", label: "Internship" },
  { value: "project", label: "Project" },
  { value: "bootcamp", label: "Bootcamp" },
];

const GENDERS = [
  { value: "1", label: "Male" },
  { value: "2", label: "Female" },
  { value: "3", label: "Prefer not to disclose" },
];

const EMPTY = {
  name: "",
  email: "",
  number: "",
  gender: "",
  type: "",
  course: "",
  batch: "",
  sdate: "",
  edate: "",
};

function CertHero() {
  return (
    <PageHero
      crumb="Certificate Request"
      eyebrow="Certificates"
      title="Request your"
      accent="certificate"
      text="Finished a program with us? Send the details below — we'll check them against our records and email your certificate as a PDF once it's approved."
      image="/images/pages/certificate.webp"
      imageAlt="A Rivira Tech certificate of completion"
    />
  );
}

export default function CertificateRequest() {
  const [form, setForm] = useState(EMPTY);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  /* Remounting the widget issues a fresh token — Turnstile tokens are
     single-use, so a failed submit cannot reuse the one it just spent. */
  const [captchaNonce, setCaptchaNonce] = useState(0);

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  // Load courses
  const loadCourses = async () => {
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/courses/get",
        {
          status: "",
          all: "1", // including courses that aren't open for enrolment (certificate only)
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        const mapped = (res.data.data || []).map((c: any) => ({
          id: c.req_id || c.id,
          title: c.title || c.name || "",
        }));
        setCourses(mapped);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadBatches = async (courseId: string) => {
    if (!courseId) {
      setBatches([]);
      return;
    }
    setLoadingBatches(true);
    try {
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/batches/get",
        {
          c_id: courseId,
          status: "1",
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      setLoadingBatches(false);
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setBatches(res.data.data);
        return;
      }
      if (
        res.data?.message === "No Batches" ||
        (res.data?.success === false && !res.data?.data)
      ) {
        setBatches([]);
        return;
      }
    } catch (err) {
      console.error("Error loading batches : ", err);
    }

    setBatches([]);
    setLoadingBatches(false);
  };

  const handleCourseChange = (e: any) => {
    const selectedCourse = e.target.value;
    setForm((f) => ({ ...f, course: selectedCourse, batch: "" }));
    loadBatches(selectedCourse);
  };

  const handleBatchChange = (e: any) => {
    const selectedBatchId = e.target.value;
    const found = batches.find(
      (b) => (b.b_id || String(b.id)) === selectedBatchId,
    );
    setForm((f) => ({
      ...f,
      batch: selectedBatchId,
      sdate: found?.sdate ? formatDateInput(found.sdate) : f.sdate,
      edate: found?.edate ? formatDateInput(found.edate) : f.edate,
    }));
  };

  // Full international number ("+" + dial code + digits), written by the
  // phoneinput.js country picker into the hidden [name="fullphone"] field.
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCourses();

    // ---------- PhoneInput plugin (flag / country-code picker for #phone) ----------
    const piCss = document.createElement("link");
    piCss.rel = "stylesheet";
    piCss.href = "/css/phoneinput.css";
    document.head.appendChild(piCss);
    const piJs = document.createElement("script");
    piJs.src = "/js/phoneinput.js";
    piJs.async = true;
    piJs.onload = () => (window as any).PhoneInput?.initAll?.();
    document.body.appendChild(piJs);
    return () => {
      if (piCss.parentNode) piCss.parentNode.removeChild(piCss);
      if (piJs.parentNode) piJs.parentNode.removeChild(piJs);
    };
  }, []);

  const set = (k: keyof typeof EMPTY) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Phone: digits only — the country code comes from the flag picker. A full
  // number pasted / autofilled with "+<code>" is handed to the picker, which
  // selects that country and leaves just the local number in the box.
  const setPhone = (e: any) => {
    const el = e.target as any;
    const raw = String(el.value || "");
    if (/^\s*\+/.test(raw) && el._phoneInput) {
      el._phoneInput._hydrate(); // re-fires this handler with the local digits
      if (!/^\s*\+/.test(String(el.value || ""))) return;
    }
    setForm((f) => ({ ...f, number: raw.replace(/\D/g, "").slice(0, 15) }));
  };

  // the success card replaces the form at the top — bring it into view
  useEffect(() => {
    if (done) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [done]);

  const submit = async (e: any) => {
    e.preventDefault();
    setError("");

    if (captchaEnabled && !captcha) {
      setError("Please complete the captcha.");
      return;
    }

    setSending(true);
    try {
      // send the number with its country code when the picker has one
      const full = phoneRef.current?.value?.trim() || "";
      const res = await axios.post(
        SERVER_URL + "api/public/certificate-request",
        {
          ...form,
          number: full.replace(/\D/g, "").length > 4 ? full : form.number,
          captcha,
          /* The decoy. Real people never see it, so anything in it is a bot —
           the server rejects on the same field name across every form. */
          company_fax: "",
        },
      );

      if (res.data?.success) {
        setDone(true);
      } else {
        setError(
          res.data?.message || "Something went wrong. Please try again.",
        );
        setCaptcha(null);
        setCaptchaNonce((n) => n + 1);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setCaptcha(null);
      setCaptchaNonce((n) => n + 1);
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <>
        <Head {...seo} />
        <CertHero />
        <main style={S.page}>
          <div style={S.card}>
            <h1 style={S.h1}>Request received</h1>
            <p style={S.lead}>
              Thanks — we have your request. Someone will check it against our
              records, and if everything matches we'll email your certificate to{" "}
              <b>{form.email}</b>.
            </p>
            <p style={S.note}>
              If anything looks wrong we'll get in touch instead. You don't need
              to submit the form again.
            </p>
          </div>
        </main>
      </>
    );
  }

  function decodeHtml(str: any) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  return (
    <>
      <Head {...seo} />
      <CertHero />
      <main style={S.page}>
        <div style={S.card}>
          <h1 style={S.h1}>Request your certificate</h1>
          <p style={S.lead}>
            Finished a course with us? Fill this in and we'll check it against
            our records. Once it's approved we'll email your certificate as a
            PDF.
          </p>

          {/* form.certreq: phoneinput.js attaches its country picker to #phone */}
          <form onSubmit={submit} className="certreq">
            <Field
              label="Full name"
              hint="As it should appear on the certificate"
            >
              <input
                style={S.input}
                value={form.name}
                onChange={set("name")}
                required
                maxLength={120}
                autoComplete="name"
              />
            </Field>

            <Row>
              <Field label="Email" hint="We send the certificate here">
                <input
                  style={S.input}
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  required
                  maxLength={180}
                  autoComplete="email"
                />
              </Field>
              <Field label="Phone">
                <input
                  style={S.input}
                  type="text"
                  id="phone"
                  name="phone"
                  value={form.number}
                  onChange={setPhone}
                  required
                  maxLength={15}
                  autoComplete="tel-national"
                  inputMode="numeric"
                  placeholder="Phone number"
                />
                {/* the plugin keeps these in sync: "+" + dial code + digits, and the ISO country */}
                <input
                  name="fullphone"
                  type="text"
                  defaultValue=""
                  ref={phoneRef}
                  style={{ display: "none" }}
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <input type="hidden" name="country_code" />
              </Field>
            </Row>

            <Row>
              <Field label="Gender">
                <select
                  style={S.input}
                  value={form.gender}
                  onChange={set("gender")}
                  required
                >
                  <option value="">Select</option>
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </Field>
            </Row>

            <Row>
              <Field label="Certificate for">
                <select
                  style={S.input}
                  value={form.type}
                  onChange={set("type")}
                  required
                >
                  <option value="">Select</option>
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
            </Row>

            <Row>
              <Field label="Course">
                <select
                  style={S.input}
                  value={form.course}
                  onChange={handleCourseChange}
                  required
                >
                  <option value="">Select course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {decodeHtml(c.title)}
                    </option>
                  ))}
                </select>
                {courses.length === 0 && (
                  <span style={S.hint}>
                    Courses couldn't be loaded. Please refresh the page.
                  </span>
                )}
              </Field>

              <Field
                label="Batch"
                hint={
                  loadingBatches
                    ? ""
                    : form.course && batches.length === 0
                      ? "No batches found for this course"
                      : undefined
                }
              >
                <select
                  style={S.input}
                  value={form.batch}
                  onChange={handleBatchChange}
                  disabled={!form.course || loadingBatches}
                >
                  <option value="">
                    {loadingBatches
                      ? "Loading batches…"
                      : !form.course
                        ? "Select course first"
                        : batches.length === 0
                          ? "No batches available"
                          : "Select batch"}
                  </option>
                  {batches.map((b) => {
                    const val = b.b_id || String(b.id);
                    return (
                      <option key={val} value={val}>
                        {decodeHtml(b.name)}
                      </option>
                    );
                  })}
                </select>
              </Field>
            </Row>

            {/*
            <Row>
              <Field label="Start date">
                <input style={S.input} type="date" value={form.sdate}
                  onChange={set("sdate")} required />
              </Field>
              <Field label="End date">
                <input style={S.input} type="date" value={form.edate}
                  onChange={set("edate")} required />
              </Field>
            </Row>
*/}

            {/* The decoy, hidden from people and from screen readers. A bot
                filling every input is what trips it. */}
            <input
              type="text"
              name="company_fax"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "-9999px",
                width: 1,
                height: 1,
              }}
              onChange={() => {
                /* deliberately ignored */
              }}
            />

            {captchaEnabled && (
              <div style={{ margin: "18px 0" }}>
                <Suspense fallback={null}>
                  <TurnstileWidget key={captchaNonce} onToken={setCaptcha} />
                </Suspense>
              </div>
            )}

            {error && <p style={S.error}>{error}</p>}

            <button type="submit" style={S.button} disabled={sending}>
              {sending ? "Sending…" : "Submit request"}
            </button>

            <p style={S.note}>
              Submitting this doesn't issue a certificate on its own — we check
              every request against our records first.
            </p>
          </form>
        </div>
      </main>
    </>
  );
}

function Row({ children }: { children: any }) {
  return <div style={S.row}>{children}</div>;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: any;
}) {
  return (
    <label style={S.field}>
      <span style={S.label}>{label}</span>
      {children}
      {hint && <span style={S.hint}>{hint}</span>}
    </label>
  );
}

const S: Record<string, any> = {
  page: {
    background: "var(--rv-page)",
    minHeight: "auto",
    padding: "56px 16px clamp(48px, 8vw, 80px)",
  },
  card: {
    maxWidth: 620,
    margin: "0 auto",
    background: "#fff",
    border: "1px solid #E2E8F0",
    borderRadius: 16,
    padding: "clamp(22px, 4vw, 40px)",
    boxShadow: "0 10px 30px -12px rgba(15,23,42,0.12)",
  },
  h1: {
    margin: "0 0 10px",
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize: "clamp(24px, 3.4vw, 32px)",
    letterSpacing: "-0.02em",
    color: "#0B1220",
  },
  lead: {
    margin: "0 0 26px",
    fontSize: 16,
    lineHeight: 1.65,
    color: "#475569",
  },
  row: { display: "flex", gap: 16, flexWrap: "wrap" },
  field: { display: "block", flex: "1 1 220px", marginBottom: 18, minWidth: 0 },
  label: {
    display: "block",
    marginBottom: 6,
    fontSize: 14,
    fontWeight: 700,
    color: "#0B1220",
  },
  input: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 13px",
    fontSize: 15,
    color: "#0B1220",
    background: "#fff",
    border: "1px solid #CBD5E1",
    borderRadius: 9,
  },
  hint: { display: "block", marginTop: 5, fontSize: 13, color: "#64748B" },
  error: {
    margin: "0 0 14px",
    padding: "10px 13px",
    fontSize: 14,
    color: "#991B1B",
    background: "#FEF2F2",
    border: "1px solid #FECACA",
    borderRadius: 9,
  },
  button: {
    width: "100%",
    padding: "13px 22px",
    fontSize: 16,
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    color: "#fff",
    background: "linear-gradient(90deg, #3B7BFF 0%, #7C3AED 100%)",
    border: "none",
    borderRadius: 999,
    boxShadow: "0 12px 30px rgba(91, 63, 232, .35)",
    cursor: "pointer",
  },
  note: { margin: "14px 0 0", fontSize: 13, lineHeight: 1.6, color: "#64748B" },
};
