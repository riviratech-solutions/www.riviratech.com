import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import {
  CalendarClock,
  BookOpen,
  Layers,
  Info,
  RotateCw,
  Users,
  ExternalLink,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import { SkeletonTable } from "../../../components/loading";

/* Student → Class Schedule: the weekly class times of the student's own
   batches, set by the admins on Admin → Class Schedules. EST and IST sit side
   by side because the IST day can run a day ahead of the EST one.
   API: api/admin/class-schedules/class-schedules.js (/student/class-schedule) */

const seo = getSeoByPath("");

type Row = {
  day_est: string;
  time_est: string;
  day_ist: string;
  time_ist: string;
};

// The community card shown under the schedule for every student (same links
// as the course guide's student dashboard)
const SKOOL_URL = "https://www.skool.com/riviratech-innovations-9088/about";
const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/Jxu7XnwqibC8SeIeh7EGGb";

type Resource = {
  title: string;
  description: string;
  links: { label: string; href: string }[];
};

// only http(s) links become buttons (the API checks this too)
const isWebLink = (h: string) => /^https?:\/\//i.test(String(h || "").trim());

function decodeHtml(str: any) {
  const txt = document.createElement("textarea");
  txt.innerHTML = str ?? "";
  return txt.value;
}

const fmtDate = (v: any) => {
  if (!v) return "";
  const s = String(v);
  const d = /^\d{9,10}$/.test(s) ? new Date(Number(s) * 1000) : new Date(s);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

export default function ClassSchedule() {
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (fresh = false) => {
    setLoading(true);
    setError("");
    try {
      // v: bump it when the reply's shape changes, so an older saved copy isn't used
      const res = await listFetch("api/student/class-schedule", { v: 2 }, { fresh });
      if (res.data.success) {
        setList(res.data.data || []);
        setResources(res.data.resources || []);
      } else setError(res.data.message || "Could not load your class schedule");
    } catch {
      setError("Could not load your class schedule");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const res = await axios.get(SERVER_URL + "api/check-login", {
        withCredentials: true,
      });
      if (res.data.loggedIn && res.data.id === "1") load();
      else navigate("/logout");
    })();
  }, []);

  return (
    <>
      <Head
        pageTitle={seo.title || "Class Schedule - Student Portal"}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />

      <style>{`
        .sch-page { background:#f8fafc; min-height:calc(100vh - 80px); padding:24px 28px; }
        @media (max-width:560px) { .sch-page { padding:16px; } }
        .sch-head { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:20px; }
        .sch-head-left { display:flex; align-items:center; gap:14px; }
        .sch-head-icon { width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg,#e0a82e,#c9921a); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 12px rgba(201,146,26,.25); }
        .sch-title { font-size:22px; font-weight:700; color:#0f172a; margin:0; }
        .sch-sub { font-size:13.5px; color:#64748b; margin:3px 0 0; }
        .sch-card { background:#fff; border:1px solid #eef2f6; border-radius:18px; padding:22px; box-shadow:0 1px 3px rgba(0,0,0,.03); margin-bottom:18px; }
        .sch-card-top { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-start; margin-bottom:6px; }
        .sch-course { font-size:12.5px; font-weight:600; color:#0284c7; display:flex; align-items:center; gap:6px; }
        .sch-batch { font-size:18px; font-weight:700; color:#0f172a; margin:4px 0 0; display:flex; align-items:center; gap:7px; }
        .sch-dates { font-size:12.5px; font-weight:600; color:#475569; background:#f1f5f9; border-radius:20px; padding:4px 12px; white-space:nowrap; }
        .sch-intro { font-size:13.5px; color:#475569; margin:8px 0 14px; }
        .sch-scroll { overflow-x:auto; border:1px solid #e2e8f0; border-radius:12px; }
        .sch-table { width:100%; border-collapse:collapse; font-size:13.5px; min-width:520px; }
        .sch-table th { background:#0f172a; color:#fff; font-size:11.5px; letter-spacing:.5px; text-transform:uppercase; padding:12px 14px; text-align:left; white-space:nowrap; }
        .sch-table th.ist, .sch-table td.ist-first { border-left:2px solid #334155; }
        .sch-table td { padding:12px 14px; border-top:1px solid #f1f5f9; color:#334155; white-space:nowrap; }
        .sch-table tbody tr:nth-child(even) td { background:#fafbfc; }
        .sch-table td.day { font-weight:700; color:#0f172a; }
        .sch-note { display:flex; gap:8px; align-items:flex-start; font-size:12.5px; color:#64748b; margin:12px 0 0; }
        .sch-empty { background:#fff; border:1px dashed #cbd5e1; border-radius:16px; padding:48px 20px; text-align:center; color:#64748b; font-size:14px; margin-bottom:18px; }
        .sch-community { background:#fff; border:1px solid #eef2f6; border-radius:18px; padding:30px 34px; box-shadow:0 1px 3px rgba(0,0,0,.03); display:flex; align-items:center; gap:30px; }
        .sch-community-icon { width:72px; height:72px; border-radius:18px; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:#fff; background:linear-gradient(135deg,#c9921a,#e8b84a); box-shadow:0 10px 24px rgba(201,146,26,.3); }
        .sch-community h2 { font-size:30px; font-weight:800; color:#0f172a; margin:0 0 12px; letter-spacing:-0.01em; }
        .sch-community p { font-size:15px; line-height:1.75; color:#475569; margin:0 0 18px; max-width:680px; }
        .sch-community-actions { display:flex; gap:14px; flex-wrap:wrap; }
        .sch-community-btn { display:inline-flex; align-items:center; gap:9px; padding:14px 26px; border-radius:999px; font-size:15px; font-weight:700; color:#fff !important; text-decoration:none; transition:transform .15s ease, box-shadow .15s ease; }
        .sch-community-btn:hover { transform:translateY(-1px); }
        .sch-community-btn.sch-btn-skool { background:linear-gradient(135deg,#c9921a,#e8b84a); box-shadow:0 10px 22px rgba(201,146,26,.3); }
        .sch-community-btn.sch-btn-wa { background:#25d366; box-shadow:0 10px 22px rgba(37,211,102,.3); }
        @media (max-width:640px) {
          .sch-community { flex-direction:column; align-items:flex-start; gap:18px; padding:22px; }
          .sch-community h2 { font-size:23px; }
        }
        .sch-res { background:#fff; border:1px solid #eef2f6; border-radius:18px; padding:26px; box-shadow:0 1px 3px rgba(0,0,0,.03); margin-top:18px; }
        .sch-res-head { display:flex; gap:14px; align-items:flex-start; margin-bottom:18px; }
        .sch-res-icon { width:44px; height:44px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:#fff; background:linear-gradient(135deg,#c9921a,#e8b84a); box-shadow:0 6px 16px rgba(201,146,26,.28); }
        .sch-res-head h2 { font-size:26px; font-weight:800; color:#0f172a; margin:2px 0 6px; }
        .sch-res-head p { font-size:14px; color:#475569; margin:0; }
        .sch-res-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:12px; }
        .sch-res-item { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px 18px; }
        .sch-res-item h3 { font-size:17px; font-weight:700; color:#0f172a; margin:0 0 6px; }
        .sch-res-item p { font-size:13.5px; color:#475569; margin:0 0 12px; }
        .sch-res-links { display:flex; gap:8px; flex-wrap:wrap; }
        .sch-res-link { display:inline-flex; align-items:center; gap:7px; background:#0f172a; color:#fff !important; font-size:12.5px; font-weight:700; padding:8px 13px; border-radius:7px; text-decoration:none; }
        .sch-res-link:hover { background:#1e293b; }
        @media (max-width:640px) { .sch-res { padding:18px; } .sch-res-head h2 { font-size:21px; } }
      `}</style>

      <div className="content">
        <div className="container-fluid sch-page">
          <div className="sch-head">
            <div className="sch-head-left">
              <div className="sch-head-icon">
                <CalendarClock size={24} />
              </div>
              <div>
                <h3 className="sch-title">Class Schedule</h3>
                <p className="sch-sub">
                  When your batch's live classes run, in EST and IST.
                </p>
              </div>
            </div>
            <button
              data-refresh
              className="reload-btn"
              title="Reload"
              onClick={() => load(true)}
              disabled={loading}
            >
              <RotateCw size={15} />
            </button>
          </div>

          {loading ? (
            <SkeletonTable cols={4} />
          ) : error ? (
            <div className="sch-empty">{error}</div>
          ) : list.length === 0 ? (
            <div className="sch-empty">
              Your batch's class schedule hasn't been published yet. It will
              appear here as soon as it is.
            </div>
          ) : (
            list.map((s) => (
              <div key={s.id} className="sch-card">
                <div className="sch-card-top">
                  <div>
                    <div className="sch-course">
                      <BookOpen size={14} /> {decodeHtml(s.course_name)}
                    </div>
                    <div className="sch-batch">
                      <Layers size={17} /> {decodeHtml(s.batch_name)}
                    </div>
                  </div>
                  {(s.batch_sdate || s.batch_edate) && (
                    <span className="sch-dates">
                      {fmtDate(s.batch_sdate)} → {fmtDate(s.batch_edate)}
                    </span>
                  )}
                </div>

                {s.intro && <p className="sch-intro">{s.intro}</p>}

                <div className="sch-scroll">
                  <table className="sch-table">
                    <thead>
                      <tr>
                        <th scope="col">Day (EST)</th>
                        <th scope="col">Time (EST)</th>
                        <th scope="col" className="ist">
                          Day (IST)
                        </th>
                        <th scope="col">Time (IST)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(s.rows || []).map((r: Row, i: number) => (
                        <tr key={i}>
                          <td className="day">{r.day_est}</td>
                          <td>{r.time_est}</td>
                          <td className="day ist-first">{r.day_ist}</td>
                          <td>{r.time_ist}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {s.note && (
                  <p className="sch-note">
                    <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />{" "}
                    {s.note}
                  </p>
                )}
              </div>
            ))
          )}

          {/* Community — for every student, with or without a schedule */}
          <div className="sch-community">
            <div className="sch-community-icon" aria-hidden="true">
              <Users size={30} />
            </div>
            <div>
              <h2>Join Our Skool Community</h2>
              <p>
                Connect with fellow learners, access exclusive resources, get
                the latest updates, and engage with instructors — all in one
                place.
              </p>
              <div className="sch-community-actions">
                <a
                  className="sch-community-btn sch-btn-skool"
                  href={SKOOL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={17} /> Open Skool Community
                </a>
                <a
                  className="sch-community-btn sch-btn-wa"
                  href={WHATSAPP_GROUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm0 2a8 8 0 11-4.1 14.9l-.3-.2-2.8.7.7-2.7-.2-.3A8 8 0 0112 4zm4.4 10.3c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.5 6.5 0 01-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.5s-.5-1.3-.7-1.8-.4-.4-.5-.4h-.5a1 1 0 00-.7.3c-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6 1.8 2.8 4.4 3.9c1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1s.2-1 .1-1.1-.2-.2-.4-.3z" />
                  </svg>
                  Join WhatsApp Group
                </a>
              </div>
            </div>
          </div>

          {/* Course resources — managed on Admin → Class Schedules → Course Resources */}
          {resources.length > 0 && (
            <div className="sch-res">
              <div className="sch-res-head">
                <div className="sch-res-icon" aria-hidden="true">
                  <BookOpen size={22} />
                </div>
                <div>
                  <h2>Course resources</h2>
                  <p>
                    Everything Rivira Technologies teaches, in the order the course guide
                    lists it. Each link opens in a new tab.
                  </p>
                </div>
              </div>
              <ol className="sch-res-list">
                {resources.map((r, idx) => (
                  <li key={idx} className="sch-res-item">
                    <h3>{r.title}</h3>
                    {r.description && <p>{r.description}</p>}
                    <div className="sch-res-links">
                      {(r.links || [])
                        .filter((l) => isWebLink(l.href))
                        .map((l) => (
                          <a
                            key={l.href}
                            className="sch-res-link"
                            href={l.href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {l.label} <ExternalLink size={13} />
                          </a>
                        ))}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
