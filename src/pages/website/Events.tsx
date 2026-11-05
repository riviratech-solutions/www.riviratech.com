import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CalendarX2,
  Clock,
  GraduationCap,
} from "lucide-react";
import { Head } from "../../components/Includes";
import { getSeoByPath } from "../../utils/seo";
import { siteFetch } from "../../utils/siteCache";
import { safeMarkup } from "../../utils/sanitizeHtml";
import EventNotifyModal from "../../modals/EventNotifyModal";
import { tzShort } from "../../utils/classTime";
import { PageHero } from "../../components/site/PageKit";

const seo = getSeoByPath("events");

// Admin → Events fields are stored as HTML snippets (anything that could run
// script is removed: utils/sanitizeHtml.ts → safeMarkup).
const Html = ({ value }: { value?: string }) => (
  <span dangerouslySetInnerHTML={{ __html: safeMarkup(value || "") }} />
);

const has = (v: any) => typeof v === "string" && v.length >= 1;

// An event field (stored as HTML) as plain text, for the notify message
const plainText = (html: string) => {
  const t = document.createElement("template");
  t.innerHTML = html;
  return (t.content.textContent || "").replace(/\s+/g, " ").trim();
};

export default function Page() {
  const [time, setTime] = useState({
    days: "00",
    hours: "00",
    mins: "00",
    secs: "00",
  });

  const [loading, setLoading] = useState(true);

  // "Notify Me" popup (saved as a contact-form message)
  const [notifyOpen, setNotifyOpen] = useState(false);
  const openNotify = () => setNotifyOpen(true);
  const closeNotify = useCallback(() => setNotifyOpen(false), []);
  const [alllists, setAllLists] = useState<any | null>(null);

  const loadDetails = async () => {
    setLoading(true);
    setAllLists([]);

    try {
      // saved for 10 minutes (utils/siteCache.ts), without database ids
      const res = await siteFetch("api/event-latest", { method: "post" });

      if (res.data.success) {
        setAllLists(res.data.data);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, []);

  useEffect(() => {
    if (!alllists?.b_event_date) return;

    const eventDate = new Date(Number(alllists.b_event_date) * 1000);

    const timer = setInterval(() => {
      const diff = eventDate.getTime() - Date.now();

      if (diff <= 0) {
        setTime({ days: "00", hours: "00", mins: "00", secs: "00" });
        clearInterval(timer);
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);

      setTime({
        days: String(d).padStart(2, "0"),
        hours: String(h).padStart(2, "0"),
        mins: String(m).padStart(2, "0"),
        secs: String(s).padStart(2, "0"),
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [alllists]);

  const empty =
    !alllists ||
    Array.isArray(alllists) ||
    (!alllists.event_id && !has(alllists.title));

  return (
    <div className="enroll-page biz-page">
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />
      <style>{EVENTS_CSS}</style>

      {loading ? (
        <section className="enroll-section ev-state">
          <div className="pageloader">
            <div className="loader-facebook">
              <div className="lds-facebook">
                <div></div>
                <div></div>
                <div></div>
              </div>
            </div>
          </div>
        </section>
      ) : empty ? (
        <>
          <PageHero
            crumb="Events"
            eyebrow="Events & workshops"
            title="AI events,"
            accent="live sessions & bootcamps"
            text="New AI workshops, webinars and live sessions are added regularly — hands-on, online and open to every level."
            image="/images/pages/events.webp"
            imageAlt="A live AI workshop with a presenter screen and audience"
            actions={[{ label: "Join a Free Workshop", to: "/workshop" }, { label: "Talk to Us", to: "/contact", ghost: true }]}
          />

          <section className="enroll-section">
            <div className="enroll-container">
              <div className="ev-empty">
                <CalendarX2 size={44} />
                <h3>No Events Right Now</h3>
                <p>
                  We don&apos;t have any live events at the moment. New AI
                  workshops, webinars, and sessions are added regularly — check
                  back soon or reach out to get notified about the next one.
                </p>
                <div className="ev-actions">
                  <Link to="/courses" className="enroll-btn-primary">
                    <GraduationCap size={17} style={{"color":"white"}} />
                    <span>Explore Training Programs</span>
                  </Link>
                  <button type="button" className="ev-btn-ghost" onClick={openNotify}>
                    <Bell size={16} /> Notify Me
                  </button>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          {/* ── Hero ── */}
          <section className="enroll-hero">
            <div className="enroll-hero-grid" />
            <div className="enroll-hero-glow-left" />
            <div className="enroll-hero-glow-right" />
            <div className="enroll-hero-inner">
              {has(alllists.badge) && (
                <div className="enroll-badge">
                  <span className="ev-pulse" /> <Html value={alllists.badge} />
                </div>
              )}
              {has(alllists.title) && (
                <h1>
                  <Html value={alllists.title} />
                </h1>
              )}
              {has(alllists.description) && (
                <p>
                  <Html value={alllists.description} />
                </p>
              )}
              <div className="enroll-hero-btns">
                {has(alllists.b_link) && (
                  <a
                    href={alllists.b_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="enroll-btn-primary"
                  >
                    <span>Register Now</span>
                    <ArrowRight size={18} />
                  </a>
                )}
                <button
                  type="button"
                  className="enroll-btn-outline"
                  onClick={openNotify}
                >
                  Notify Me
                </button>
              </div>
            </div>
          </section>

          {/* ── Upcoming event ── */}
          <section className="enroll-section">
            <div className="enroll-container">
              {has(alllists.a_badge) && (
                <span className="enroll-section-label">
                  <Html value={alllists.a_badge} />
                </span>
              )}
              {has(alllists.a_title) && (
                <h2 className="enroll-section-title">
                  <Html value={alllists.a_title} />
                </h2>
              )}
              {has(alllists.a_description) && (
                <p className="enroll-section-sub">
                  <Html value={alllists.a_description} />
                </p>
              )}

              <div className="ev-card" data-aos="zoom-in">
                <div className="ev-card-main">
                  {has(alllists.b_badge) && (
                    <span className="ev-tag">
                      <Html value={alllists.b_badge} />
                    </span>
                  )}
                  {has(alllists.b_title) && (
                    <h3 className="ev-card-title">
                      <Html value={alllists.b_title} />
                    </h3>
                  )}
                  {has(alllists.b_description) && (
                    <p className="ev-card-desc">
                      <Html value={alllists.b_description} />
                    </p>
                  )}
                  <p className="ev-when">
                    <span>
                      <CalendarDays size={16} />{" "}
                      {new Date(
                        Number(alllists.b_event_date) * 1000,
                      ).toDateString()}
                    </span>
                    {/* the start in the visitor's own time zone (the admin
                        sets it in the event's zone; the timestamp is absolute) */}
                    {Number(alllists.b_event_date) > 0 ? (
                      <span>
                        <Clock size={16} />{" "}
                        {new Date(
                          Number(alllists.b_event_date) * 1000,
                        ).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        {tzShort(alllists.b_event_date)}
                      </span>
                    ) : (
                      has(alllists.b_event_time) && (
                        <span>
                          <Clock size={16} /> {alllists.b_event_time}
                        </span>
                      )
                    )}
                  </p>

                  {has(alllists.b_features) && (
                    <ul className="ev-list">
                      {alllists.b_features
                        .split(",")
                        .map((item: string, i: number) => (
                          <li key={i}>
                            <Html value={item} />
                          </li>
                        ))}
                    </ul>
                  )}

                  {has(alllists.b_tags) && (
                    <div className="ev-tags">
                      {alllists.b_tags
                        .split(",")
                        .map((tag: string, i: number) => (
                          <span key={i} className="ev-chip">
                            <Html value={tag} />
                          </span>
                        ))}
                    </div>
                  )}

                  {has(alllists.b_link) && (
                    <a
                      href={alllists.b_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="enroll-btn-primary ev-register"
                    >
                      <span>Register Now</span>
                      <ArrowRight size={18} />
                    </a>
                  )}
                </div>

                {has(alllists.timer_title) && (
                  <div className="ev-countdown">
                    <div className="ev-countdown-title">
                      <Html value={alllists.timer_title} />
                    </div>

                    <div className="ev-timer">
                      {Object.entries(time).map(([k, v]) => (
                        <div key={k}>
                          <b>{v}</b>
                          <small>{k.toUpperCase()}</small>
                        </div>
                      ))}
                    </div>

                    <div className="ev-infos">
                      {alllists?.timers?.map((item: any, i: number) => (
                        <div key={item.id ?? i} className="ev-info">
                          <div className="ev-info-icon">
                            <Html value={item.icon} />
                          </div>
                          <div>
                            <small>
                              <Html value={item.title} />
                            </small>
                            <h6>
                              <Html value={item.subtitle} />
                            </h6>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Bootcamp ── */}
          <section className="enroll-section-gray">
            <div className="enroll-container">
              {has(alllists.c_badge) && (
                <span className="enroll-section-label">
                  <Html value={alllists.c_badge} />
                </span>
              )}
              {has(alllists.c_title) && (
                <h2 className="enroll-section-title">
                  <Html value={alllists.c_title} />
                </h2>
              )}
              {has(alllists.c_description) && (
                <p className="enroll-section-sub">
                  <Html value={alllists.c_description} />
                </p>
              )}

              <div className="ev-card ev-bootcamp" data-aos="zoom-in">
                <div className="ev-bootcamp-head">
                  <div>
                    {has(alllists.d_badge) && (
                      <span className="ev-tag">
                        <Html value={alllists.d_badge} />
                      </span>
                    )}
                    {has(alllists.d_title) && (
                      <h3 className="ev-card-title">
                        <Html value={alllists.d_title} />
                      </h3>
                    )}
                    <p className="ev-batch">
                      {has(alllists.bootcamp) && (
                        <span>
                          Bootcamp: <b>{alllists.bootcamp}</b>
                        </span>
                      )}
                      {has(alllists.newbatch) && (
                        <span>
                          New Batch: <b>{alllists.newbatch}</b>
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="ev-soon">🔥 Coming Soon</span>
                </div>

                {has(alllists.learnings_title) && (
                  <div>
                    <h4 className="ev-sub">
                      <Html value={alllists.learnings_title} />
                    </h4>
                    <div className="ev-grid-3">
                      {alllists?.learnings?.map((item: any, i: number) => (
                        <div className="ev-learn" key={item.id ?? i}>
                          <h6>
                            <Html value={item.title} />
                          </h6>
                          <p>
                            <Html value={item.description} />
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {has(alllists.audiences_title) && (
                  <div>
                    <h4 className="ev-sub">
                      <Html value={alllists.audiences_title} />
                    </h4>
                    <div className="ev-grid-4">
                      {alllists?.audience?.map((item: any, i: number) => (
                        <div className="ev-aud" key={item.id ?? i}>
                          <div className="ev-aud-icon">
                            <Html value={item.icon} />
                          </div>
                          <h6>{item.title}</h6>
                          <small>{item.subtitle}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {has(alllists.note_title) && (
                  <div className="ev-notify">
                    <div>
                      <h6>
                        <Html value={alllists.note_title} />
                      </h6>
                      <small>
                        <Html value={alllists.note_desc} />
                      </small>
                    </div>
                    <button
                      className="enroll-btn-primary"
                      onClick={openNotify}
                    >
                      <Bell size={16} />
                      <span>Notify Me</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Notify Me popup — saved like the contact form */}
      <EventNotifyModal
        open={notifyOpen}
        onClose={closeNotify}
        eventTitle={!empty && has(alllists?.title) ? plainText(alllists.title) : ""}
      />
    </div>
  );
}

const EVENTS_CSS = `
.ev-state { min-height: 50vh; display: flex; align-items: center; justify-content: center; }
.ev-muted { color: #64748b; margin: 0 0 16px; }

.ev-pulse { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #5AA9F0; box-shadow: 0 0 0 0 rgba(90, 169, 240,.7); animation: evPulse 1.6s infinite; }
@keyframes evPulse { 70% { box-shadow: 0 0 0 10px rgba(90, 169, 240,0); } 100% { box-shadow: 0 0 0 0 rgba(90, 169, 240,0); } }

.ev-empty { text-align: center; max-width: 620px; margin: 0 auto; }
.ev-empty svg { color: #1F5FAF; margin: 0 auto; }
.ev-empty h3 { color: #0a0f1e; font-family: var(--font-display); margin: 16px 0 10px; }
.ev-empty p { color: #475569; margin: 0 0 24px; line-height: 1.7; }
.ev-actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
.ev-btn-ghost { display: inline-flex; align-items: center; gap: 8px; padding: 13px 24px; border-radius: 999px; border: 1px solid #cbd5e1; background: transparent; color: #0a0f1e; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; }
.ev-btn-ghost:hover { border-color: #1F5FAF; color: #0B3D7A; }

.ev-card { display: grid; grid-template-columns: 1.4fr 1fr; gap: 32px; background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 32px; box-shadow: 0 24px 48px -32px rgba(10,15,30,.45); text-align: left; }
.ev-bootcamp { display: block; }
.ev-tag { display: inline-block; background: rgba(31, 95, 175,.12); color: #0B3D7A; border: 1px solid rgba(31, 95, 175,.35); font-size: .75rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 5px 12px; border-radius: 999px; }
.ev-card-title { color: #0a0f1e; font-family: var(--font-display); font-weight: 700; font-size: clamp(1.35rem, 2.4vw, 1.75rem); margin: 14px 0 8px; }
.ev-card-desc { color: #047857; font-weight: 600; margin: 0 0 10px; }
.ev-when { display: flex; flex-wrap: wrap; gap: 8px 22px; color: #334155; font-weight: 600; margin: 14px 0; }
.ev-when span { display: inline-flex; align-items: center; gap: 7px; }
.ev-when svg { color: #1F5FAF; }
.ev-list { list-style: none; padding: 0; margin: 18px 0; }
.ev-list li { position: relative; padding-left: 26px; margin: 8px 0; color: #334155; }
.ev-list li::before { content: "✓"; position: absolute; left: 0; top: 0; color: #1F5FAF; font-weight: 800; }
.ev-tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 22px; }
.ev-chip { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; border-radius: 999px; padding: 5px 12px; font-size: .8rem; font-weight: 600; }
.ev-register { margin-top: 4px; }

.ev-countdown { background: linear-gradient(160deg, #0a0f1e, #111a33); color: #fff; border-radius: 18px; padding: 26px; text-align: center; align-self: start; }
.ev-countdown-title { font-family: var(--font-display); font-weight: 600; font-size: 1.05rem; color: #f5dfa0; }
.ev-timer { display: flex; justify-content: center; gap: 12px; margin: 18px 0; }
.ev-timer div { min-width: 62px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 10px 6px; }
.ev-timer b { display: block; font-size: 1.6rem; font-family: var(--font-display); color: #5AA9F0; line-height: 1.1; }
.ev-timer small { font-size: .65rem; letter-spacing: .12em; color: #94a3b8; }
.ev-infos { display: flex; flex-direction: column; gap: 10px; text-align: left; }
.ev-info { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; padding: 10px 14px; }
.ev-info-icon { font-size: 1.3rem; color: #5AA9F0; }
.ev-info small { color: #94a3b8; }
.ev-info h6 { color: #fff; margin: 2px 0 0; font-size: .95rem; }

.ev-bootcamp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.ev-batch { display: flex; flex-wrap: wrap; gap: 6px 18px; color: #475569; margin: 4px 0 0; }
.ev-batch b { color: #047857; }
.ev-soon { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; border-radius: 999px; padding: 6px 14px; font-weight: 700; font-size: .85rem; }
.ev-sub { color: #0a0f1e; font-family: var(--font-display); font-weight: 700; font-size: 1.15rem; margin: 32px 0 14px; }
.ev-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.ev-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.ev-learn, .ev-aud { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; height: 100%; }
.ev-learn h6, .ev-aud h6 { color: #0a0f1e; font-weight: 700; margin: 0 0 6px; }
.ev-learn p { color: #64748b; font-size: .9rem; margin: 0; }
.ev-aud { text-align: center; }
.ev-aud-icon { font-size: 1.9rem; margin-bottom: 6px; color: #1F5FAF; }
.ev-aud small { color: #64748b; }
.ev-notify { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 32px; padding: 20px 24px; border-radius: 16px; background: rgba(31, 95, 175,.08); border: 1px solid rgba(31, 95, 175,.3); }
.ev-notify h6 { color: #0a0f1e; font-weight: 700; margin: 0 0 4px; }
.ev-notify small { color: #475569; }

@media (max-width: 991px) {
  .ev-card { grid-template-columns: 1fr; padding: 24px; }
  .ev-grid-4 { grid-template-columns: repeat(2, 1fr); }
  .ev-grid-3 { grid-template-columns: 1fr; }
}
@media (max-width: 480px) { .ev-grid-4 { grid-template-columns: 1fr; } .ev-timer div { min-width: 54px; } }
`;
