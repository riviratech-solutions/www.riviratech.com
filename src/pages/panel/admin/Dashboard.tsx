import { Head, SERVER_URL } from "../../../components/Includes";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import AdminAccessCard from "../../../components/AdminAccessCard";
import { AnimatedNumber, SkeletonChart, SkeletonList, SkeletonStats } from "../../../components/loading";
import { usePagePerm } from "../../../utils/adminPermissions";
import { useCurrentUser } from "../../../utils/currentUser";
import StudentDashboard from "../student/Dashboard";
import TrainerDashboard from "../trainer/Dashboard";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Bot,
  Briefcase,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  Clock3,
  Coins,
  CreditCard,
  FileText,
  GraduationCap,
  Hourglass,
  Image as ImageIcon,
  Layers,
  ListChecks,
  LogOut,
  Mail,
  FileBadge,
  MailOpen,
  MessageCircle,
  UserCheck,
  UserRoundSearch,
  MessageSquareHeart,
  MessageSquareText,
  MonitorCheck,
  ShieldAlert,
  Star,
  Ticket,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
  RotateCw,
  type LucideIcon,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";

const seo = getSeoByPath("");

export default function Dashboard() {
  const [ptype, setPType] = useState("");
  const navigate = useNavigate();

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true, // 🔥 REQUIRED
    });
    return res.data;
  };

  const initchecklogin = async () => {
    const data = await checklogin();
    const loggedIn = data.loggedIn;
    const ustatus = data.id;
    if (loggedIn) {
      setPType(ustatus);
    } else {
      navigate("/logout");
    }
  };

  const getCookie = (name: string): string | null => {
    const cookies = document.cookie.split("; ");

    for (const cookie of cookies) {
      const [key, ...value] = cookie.split("=");

      if (key === name) {
        return decodeURIComponent(value.join("="));
      }
    }

    return null;
  };

  useEffect(() => {
    const status = getCookie("id");
    if (
      status === "X" ||
      status === "Y" ||
      status === "1" ||
      status === "2" ||
      status === "3"
    ) {
      setPType(status);
    } else {
      navigate("/logout");
    }

    initchecklogin();
  }, []);

  return (
    <>
      {ptype === "1" && <StudentDashboard />}
      {(ptype === "X" || ptype === "Y") && <AdminDashboard />}
      {ptype === "2" && <TrainerDashboard />}
    </>
  );
}

/* Stat card palettes: [gradient start, gradient end] for the icon tile, the
   glow and the soft wave in the corner. */
const TONE: Record<string, [string, string]> = {
  purple: ["#a78bfa", "#7c3aed"],
  blue: ["#60a5fa", "#2563eb"],
  green: ["#4ade80", "#16a34a"],
  orange: ["#fbbf24", "#f97316"],
  pink: ["#f472b6", "#db2777"],
  sky: ["#38bdf8", "#0284c7"],
  violet: ["#c084fc", "#9333ea"],
  rose: ["#fb7185", "#e11d48"],
  emerald: ["#34d399", "#059669"],
  amber: ["#fcd34d", "#f59e0b"],
  cyan: ["#67e8f9", "#0ea5e9"],
  coral: ["#fda4af", "#f43f5e"],
  teal: ["#5eead4", "#0d9488"],
  indigo: ["#a5b4fc", "#4f46e5"],
  fuchsia: ["#f0abfc", "#c026d3"],
  tangerine: ["#fdba74", "#ea580c"],
  ocean: ["#7dd3fc", "#2563eb"],
  lime: ["#bef264", "#65a30d"],
  gold: ["#fde68a", "#d97706"],
};

// Recent activity: icon + colour by the table the activity belongs to.
const ACTIVITY_ICON: Record<string, [LucideIcon, string]> = {
  adminers: [UserRound, "#7c3aed"],
  members: [UserRound, "#7c3aed"],
  login_sessions: [LogOut, "#16a34a"],
  login_blocks: [ShieldAlert, "#ef4444"],
  feedbacks: [Star, "#2563eb"],
  tickets: [Ticket, "#f97316"],
  payments: [CreditCard, "#059669"],
  enrollees: [CreditCard, "#059669"],
  contacts: [Mail, "#db2777"],
  contactus: [Mail, "#db2777"],
  inquiries: [Mail, "#db2777"],
  certificate_requests: [Award, "#f59e0b"],
  courses: [BookOpen, "#16a34a"],
  batches: [Layers, "#f97316"],
  liveclasses: [GraduationCap, "#0284c7"],
  assignments: [ListChecks, "#7c3aed"],
  assignmentsubs: [ListChecks, "#7c3aed"],
  blogs: [FileText, "#475569"],
  blogimgs: [ImageIcon, "#475569"],
  pages: [FileText, "#475569"],
  events: [CalendarDays, "#0ea5e9"],
  gallaryimgs: [ImageIcon, "#0ea5e9"],
  jobs: [Briefcase, "#92400e"],
  surveys: [BarChart3, "#db2777"],  qa_sessions: [MessageCircle, "#0284c7"],
  aichatbot: [Bot, "#6366f1"],
};

function AdminDashboard() {
  // Admin (Y) accounts only see the figures of pages they may open (the API
  // also leaves the others out).
  const permCan = usePagePerm("dashboard");
  const sees = (page: string) => permCan(page + ":view");
  const user = useCurrentUser();
  const anyFigure = [
    "students",
    "courses",
    "batches",
    "referred-friends",
    "web-contacts",
    "qa-session",
    "feedbacks",
    "site-feedback",
    "workshop-registrations",
    "newsletter",
    "raised-tickets",
    "enrollees",
    "subscriptions",
    "students-inquiries",
    "assignments",
    "certificate-requests",
    "activities",
  ].some(sees);

  /* ================= LIVE STATE ================= */
  function decodeHtml(str: string) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  const formatTimeAgo = (ts: any) => {
    if (!ts) return "";
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return `${diff} sec ago`;
    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years > 1 ? "s" : ""} ago`;
  };

  const [revenuestats, setRevenueStats] = useState<any>({});

  // Per-metric baselines (value when its page was last viewed), used for the
  // "↑/↓ n (x%)" trend under each figure. null until loaded.
  const [prev, setPrev] = useState<Record<string, number> | null>(null);
  const SNAP_KEY = "adminDashSnap";

  const [stats, setStats] = useState({
    todayStudents: 0,
    totalStudents: 0,
    activeCourses: 0,
    activeBatches: 0,
    refers: 0,
    webContacts: 0,
    qaSessions: 0,
    feedbacks: 0,
    customForms: 0,
    surveys: 0,
    siteFeedback: 0,
    workshopRegistrations: 0,
    newsletter: 0,
    raisedTickets: 0,
    studentInquiries: 0,
    enrolleesCount: 0,
    certificateRequests: 0,
  });

  type PieData = { name: string; value: number };

  const [loading, setLoading] = useState(true);
  const [alllists, setAllLists] = useState<any[]>([]);
  const [loginRaw, setLoginRaw] = useState<any[]>([]);
  const [enrollRaw, setEnrollRaw] = useState<any[]>([]);
  const [loginDays, setLoginDays] = useState(7);
  const [enrollMonths, setEnrollMonths] = useState(6);
  const [studentEquires, setStudentEquires] = useState<PieData[]>([]);
  const [assignmentData, setAssignmentData] = useState<PieData[]>([]);
  const [coursePopularity, setCoursePopularity] = useState<PieData[]>([]);
  const [batchPopularity, setBatchPopularity] = useState<PieData[]>([]);
  const [certRequests, setCertRequests] = useState<PieData[]>([]);

  const navigate = useNavigate();

  // last N days (sign-ups per day), oldest first; short day names for a week,
  // "1 Oct" style for longer ranges
  function buildDays(apiData: any[], n: number) {
    const map = new Map<string, number>();
    apiData.forEach((item) =>
      map.set(
        new Date(item.day).toISOString().slice(0, 10),
        Number(item.total),
      ),
    );
    const out: { day: string; value: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({
        day:
          n <= 7
            ? d.toLocaleDateString("en-US", { weekday: "short" })
            : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        value: map.get(key) || 0,
      });
    }
    return out;
  }

  // last N months (enrolments per month), oldest first
  function buildMonths(apiData: any[], n: number) {
    const map = new Map<string, number>();
    apiData.forEach((item) => map.set(item.month, Number(item.total)));
    const out: { month: string; value: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      out.push({
        month: d.toLocaleDateString("en-IN", { month: "short" }),
        value: map.get(key) || 0,
      });
    }
    return out;
  }

  const buildPopularity = (apiData: any[]): PieData[] =>
    apiData.map((item) => ({
      name: decodeHtml(item.name),
      value: Number(item.total),
    }));

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  const loadDetails = async () => {
    setLoading(true);
    setAllLists([]);
    try {
      const security = await getSecurity();
      const res = await listFetch("api/dashboard-stats", {});

      if (res.data.success) {
        setStats(res.data.stats);
        // parts an Admin may not view come back as null
        setLoginRaw(res.data.last7days || []);
        setEnrollRaw(res.data.enrollees || []);

        const inq = res.data.studentsinquiries || {};
        setStudentEquires([
          { name: "Pending", value: Number(inq.pending) || 0 },
          { name: "Submitted", value: Number(inq.completed) || 0 },
        ]);
        const asg = res.data.assignments || {};
        setAssignmentData([
          { name: "Pending", value: Number(asg.pending) || 0 },
          { name: "Submitted", value: Number(asg.completed) || 0 },
        ]);
        setCoursePopularity(buildPopularity(res.data.coursepopularity || []));
        setBatchPopularity(buildPopularity(res.data.batchpopularity || []));
        setAllLists(res.data.recentactivities || []);

        const cert = res.data.certificaterequests || {};
        setCertRequests([
          { name: "Approved", value: Number(cert.approved) || 0 },
          { name: "Pending", value: Number(cert.pending) || 0 },
          { name: "Rejected", value: Number(cert.rejected) || 0 },
        ]);

        if (res.data.paymentstats) setRevenueStats(res.data.paymentstats);

        // Trend baselines: server first (cross-device), localStorage fallback.
        let baseline: Record<string, number> | null = null;
        try {
          const snap = await axios.post(
            SERVER_URL + "api/dashboard-snapshot",
            { key: security.key, token: security.token, aut: security.aut },
            { withCredentials: true },
          );
          if (snap.data?.success) baseline = snap.data.prev || {};
        } catch {
          /* server unavailable — use localStorage below */
        }
        if (!baseline) {
          try {
            const raw = localStorage.getItem(SNAP_KEY);
            baseline = raw ? JSON.parse(raw) : {};
          } catch {
            baseline = {};
          }
        }
        setPrev(baseline || {});
      } else {
        toast.error("Something went wrong");
      }
    } catch {
      toast.error("Couldn't load the dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    axios
      .get(SERVER_URL + "api/check-login", { withCredentials: true })
      .then((res) => {
        if (res.data.loggedIn) loadDetails();
        else navigate("/signin");
      })
      .catch(() => navigate("/signin"));
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const loginData = buildDays(loginRaw, loginDays);
  const enrollData = buildMonths(enrollRaw, enrollMonths);

  const PURPLE = "var(--ad-brand)"; // the sidebar colour (public/css/panel.css)
  const tick = { fill: "#64748b", fontSize: 12 };

  return (
    <>
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />
      <ToastContainer position="top-right" autoClose={2500} />

      <div className="content adb">
        {/* ---- welcome banner ---- */}
        <div className="adb-hero">
          <div>
            <h3>
              Welcome back{user?.name ? `, ${user.name}` : ""}!{" "}
              <span className="wave" aria-hidden="true">
                👋
              </span>
            </h3>
            <p>Here's what's happening with your portal today.</p>
          </div>
          <div className="adb-hero-actions">
            <SavedAgo endpoint="api/dashboard-stats" />
            <button data-refresh type="button" className="reload-btn" title="Refresh" aria-label="Refresh" onClick={() => loadDetails()}>
              <RotateCw size={17} />
            </button>
            <div className="adb-date">
              <span className="ico">
                <CalendarDays size={22} />
              </span>
              <div>
                <b>{today}</b>
                <small>Have a productive day!</small>
              </div>
            </div>
          </div>
        </div>

        <AdminAccessCard />
        {loading ? (
          // the same layout as the figures below, until they arrive
          <>
            <SkeletonStats
              five
              count={Math.max(1, ["students", "students", "students-inquiries", "enrollees", "certificate-requests", "courses", "batches", "referred-friends", "web-contacts", "qa-session", "feedbacks", "site-feedback", "workshop-registrations", "newsletter", "raised-tickets"].filter(sees).length)}
            />
            {sees("subscriptions") && <SkeletonStats count={4} />}
            {(sees("students") || sees("enrollees")) && (
              <div className="adb-row two">
                <SkeletonChart />
                <SkeletonChart />
              </div>
            )}
            {sees("activities") && (
              <div className="adb-card">
                <SkeletonList rows={5} />
              </div>
            )}
          </>
        ) : (
          <>
            {!anyFigure && (
              <div className="adb-card p-4 text-muted">
                No dashboard figures are part of your access.
              </div>
            )}

            {/* ---- figures ---- */}
            {/* five per row */}
            <div className="adb-stats five">
              {sees("students") && (
                <StatCard
                  tone="purple"
                  icon={Users}
                  title="Today Students"
                  value={stats.todayStudents}
                  to="/panel/students"
                  mkey="todayStudents"
                />
              )}
              {sees("students") && (
                <StatCard
                  tone="blue"
                  icon={UsersRound}
                  title="Total Students"
                  value={stats.totalStudents}
                  to="/panel/students"
                  mkey="totalStudents"
                />
              )}
              {sees("students-inquiries") && (
                <StatCard
                  tone="ocean"
                  icon={UserRoundSearch}
                  title="Student Inquiries"
                  value={stats.studentInquiries ?? 0}
                  to="/panel/students-inquiries"
                  mkey="studentInquiries"
                />
              )}
              {sees("enrollees") && (
                <StatCard
                  tone="lime"
                  icon={UserCheck}
                  title="Enrollees"
                  value={stats.enrolleesCount ?? 0}
                  to="/panel/enrollees"
                  mkey="enrolleesCount"
                />
              )}
              {sees("certificate-requests") && (
                <StatCard
                  tone="gold"
                  icon={FileBadge}
                  title="Certificate Requests"
                  value={stats.certificateRequests ?? 0}
                  to="/panel/certificate-requests"
                  mkey="certificateRequests"
                />
              )}

              {sees("courses") && (
                <StatCard
                  tone="green"
                  icon={BookOpen}
                  title="Active Courses"
                  value={stats.activeCourses}
                  to="/panel/courses"
                  mkey="activeCourses"
                />
              )}
              {sees("batches") && (
                <StatCard
                  tone="orange"
                  icon={Layers}
                  title="Active Batches"
                  value={stats.activeBatches}
                  mkey="activeBatches"
                />
              )}
              {sees("referred-friends") && (
                <StatCard
                  tone="rose"
                  icon={UserPlus}
                  title="Refers"
                  value={stats.refers}
                  to="/panel/referred-friends"
                  mkey="refers"
                />
              )}
              {sees("web-contacts") && (
                <StatCard
                  tone="pink"
                  icon={Mail}
                  title="Web Contacts"
                  value={stats.webContacts}
                  to="/panel/web-contacts"
                  mkey="webContacts"
                />
              )}
              {sees("qa-session") && (
                <StatCard
                  tone="sky"
                  icon={MessageSquareText}
                  title="Q & A Session"
                  value={stats.qaSessions}
                  to="/panel/qa-session"
                  mkey="qaSessions"
                />
              )}

              {sees("feedbacks") && (
                <StatCard
                  tone="violet"
                  icon={Star}
                  title="Feedback"
                  value={stats.feedbacks}
                  to="/panel/feedbacks"
                  mkey="feedbacks"
                />
              )}
              {sees("site-feedback") && (
                <StatCard
                  tone="teal"
                  icon={MessageSquareHeart}
                  title="Site Feedback"
                  value={stats.siteFeedback ?? 0}
                  to="/panel/site-feedback"
                  mkey="siteFeedback"
                />
              )}
              {sees("workshop-registrations") && (
                <StatCard
                  tone="indigo"
                  icon={MonitorCheck}
                  title="Workshop Registrations"
                  value={stats.workshopRegistrations ?? 0}
                  to="/panel/workshop-registrations"
                  mkey="workshopRegistrations"
                />
              )}
              {sees("newsletter") && (
                <StatCard
                  tone="fuchsia"
                  icon={MailOpen}
                  title="Newsletter"
                  value={stats.newsletter ?? 0}
                  to="/panel/newsletter"
                  mkey="newsletter"
                />
              )}
              {sees("raised-tickets") && (
                <StatCard
                  tone="tangerine"
                  icon={Ticket}
                  title="Raised Tickets"
                  value={stats.raisedTickets ?? 0}
                  to="/panel/raised-tickets"
                  mkey="raisedTickets"
                />
              )}
            </div>

            {/* payments (Subscriptions page), at the bottom in their own row */}
            {sees("subscriptions") && (
              <div className="adb-stats">
                <StatCard
                  tone="emerald"
                  icon={Hourglass}
                  title="Payment Pending"
                  value={revenuestats.pending ?? 0}
                  to="/panel/subscriptions?st=1"
                  mkey="paymentPending"
                />
                <StatCard
                  tone="amber"
                  icon={Coins}
                  title="Total Revenue"
                  value={revenuestats.revenue ?? 0}
                  to="/panel/subscriptions?st=2"
                  mkey="totalRevenue"
                />
                <StatCard
                  tone="cyan"
                  icon={CheckCheck}
                  title="Success Payment"
                  value={revenuestats.success ?? 0}
                  to="/panel/subscriptions?st=2"
                  mkey="successPayment"
                />
                <StatCard
                  tone="coral"
                  icon={ListChecks}
                  title="Total Lists"
                  value={revenuestats.total ?? 0}
                  to="/panel/subscriptions"
                  mkey="totalLists"
                />
              </div>
            )}

            {/* ---- trends ---- */}
            {(sees("students") || sees("enrollees")) && (
              <div className="adb-row two">
                {sees("students") && (
                  <div className="adb-card">
                    <CardHead
                      icon={Activity}
                      title={`Login Activity (${loginDays} Days)`}
                    >
                      <RangeSelect
                        value={loginDays}
                        onChange={setLoginDays}
                        options={[
                          [7, "Last 7 Days"],
                          [14, "Last 14 Days"],
                          [30, "Last 30 Days"],
                        ]}
                      />
                    </CardHead>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart
                        data={loginData}
                        margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="4 4"
                          stroke="#e8eaf3"
                          vertical
                        />
                        <XAxis
                          dataKey="day"
                          tick={tick}
                          tickLine={false}
                          axisLine={{ stroke: "#cbd5e1" }}
                          interval={loginDays > 14 ? 3 : 0}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={tick}
                          tickLine={false}
                          axisLine={{ stroke: "#cbd5e1" }}
                        />
                        <Tooltip cursor={{ stroke: "rgba(var(--ad-brand-rgb), .35)" }} />
                        <Line
                          type="monotone"
                          dataKey="value"
                          name="Students"
                          stroke={PURPLE}
                          strokeWidth={3}
                          dot={{
                            r: 4,
                            stroke: PURPLE,
                            strokeWidth: 2,
                            fill: "#fff",
                          }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {sees("enrollees") && (
                  <div className="adb-card">
                    <CardHead
                      icon={TrendingUp}
                      title={`Enrollment Trend (${enrollMonths} Months)`}
                    >
                      <RangeSelect
                        value={enrollMonths}
                        onChange={setEnrollMonths}
                        options={[
                          [6, "Last 6 Months"],
                          [12, "Last 12 Months"],
                        ]}
                      />
                    </CardHead>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart
                        data={enrollData}
                        margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="4 4" stroke="#e8eaf3" />
                        <XAxis
                          dataKey="month"
                          tick={tick}
                          tickLine={false}
                          axisLine={{ stroke: "#cbd5e1" }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={tick}
                          tickLine={false}
                          axisLine={{ stroke: "#cbd5e1" }}
                        />
                        <Tooltip cursor={{ fill: "rgba(var(--ad-brand-rgb), .06)" }} />
                        <Bar
                          dataKey="value"
                          name="Enrollments"
                          fill={PURPLE}
                          radius={[6, 6, 0, 0]}
                          maxBarSize={44}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* ---- status donuts ---- */}
            {["students-inquiries", "assignments", "certificate-requests"].some(
              sees,
            ) && (
              <div className="adb-row three">
                {sees("students-inquiries") && (
                  <DonutCard
                    icon={MessageSquareText}
                    title="Student Inquiries Status"
                    data={studentEquires}
                    colors={["var(--ad-brand)", "rgba(var(--ad-brand-rgb), .22)"]}
                  />
                )}
                {sees("assignments") && (
                  <DonutCard
                    icon={FileText}
                    title="Assignments Submission"
                    data={assignmentData}
                    colors={["var(--ad-brand)", "rgba(var(--ad-brand-rgb), .22)"]}
                  />
                )}
                {sees("certificate-requests") && (
                  <DonutCard
                    icon={Award}
                    title="Certificate Requests"
                    data={certRequests}
                    colors={["#22c55e", "var(--ad-brand)", "#ef4444"]}
                  />
                )}
              </div>
            )}

            {/* ---- popularity ---- */}
            {(sees("courses") || sees("batches")) && (
              <div className="adb-row two">
                {sees("courses") && (
                  <PopularityCard
                    icon={BookOpen}
                    title="Course Popularity"
                    link="/panel/courses"
                    linkText="Top Courses"
                    data={coursePopularity}
                    color="var(--ad-brand)"
                  />
                )}
                {sees("batches") && (
                  <PopularityCard
                    icon={Layers}
                    title="Batch Popularity"
                    link="/panel/batches"
                    linkText="Top Batches"
                    data={batchPopularity}
                    color="var(--ad-accent-2)"
                  />
                )}
              </div>
            )}

            {/* ---- recent activity ---- */}
            {sees("activities") && (
              <div className="adb-card adb-activity">
                <CardHead icon={Clock3} title="Recent Activity">
                  <Link to="/panel/activities" className="adb-pill">
                    View All
                  </Link>
                </CardHead>
                <div className="table-responsive">
                  <table className="table mb-0">
                    <thead>
                      <tr>
                        <th style={{ width: 56 }}>#</th>
                        <th>Activity</th>
                        <th style={{ width: 130 }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alllists.length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="text-center text-muted py-4"
                          >
                            No activity yet.
                          </td>
                        </tr>
                      )}
                      {alllists.map((list, i) => {
                        const [Icon, color] = ACTIVITY_ICON[list.ntable] || [
                          Activity,
                          "#64748b",
                        ];
                        return (
                          <tr key={list.id ?? i}>
                            <td>{i + 1}</td>
                            <td>
                              <span className="adb-act">
                                <Icon
                                  size={17}
                                  color={color}
                                  fill={Icon === Star ? color : "none"}
                                />
                                {decodeHtml(String(list.info || ""))}
                              </span>
                            </td>
                            <td className="text-muted">
                              {formatTimeAgo(list.datetime)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  /* ================= Components ================= */

  // Trend for a metric vs the baseline from when its page was last viewed.
  // A metric with no baseline yet reads 0 (nothing to compare against).
  function trendFor(mkey?: string, value?: any) {
    if (!mkey || !prev) return null;
    const cur = Number(value) || 0;
    const was = mkey in prev ? Number(prev[mkey]) || 0 : cur;
    const delta = cur - was;
    const pct =
      was === 0 ? (cur === 0 ? 0 : 100) : Math.round(((cur - was) / was) * 100);
    return {
      dir: pct > 0 ? 1 : pct < 0 ? -1 : 0,
      pct: Math.abs(pct),
      delta: Math.abs(delta),
    };
  }

  // Card clicked: its current value becomes the new baseline (server +
  // localStorage), so only this metric's trend resets.
  // NOTE: a hoisted `function` — it's declared after the component's return.
  function markViewed(mkey?: string, value?: any) {
    if (!mkey) return;
    const v = Number(value) || 0;
    setPrev((p) => ({ ...(p || {}), [mkey]: v }));
    try {
      const raw = localStorage.getItem(SNAP_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[mkey] = v;
      localStorage.setItem(SNAP_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
    (async () => {
      try {
        const security = await getSecurity();
        await axios.post(
          SERVER_URL + "api/dashboard-snapshot",
          {
            merge: { [mkey]: v },
            key: security.key,
            token: security.token,
            aut: security.aut,
          },
          { withCredentials: true },
        );
      } catch {
        /* ignore */
      }
    })();
  }

  function TrendPill({ t, k }: any) {
    if (!t) return null;
    const cls = t.dir > 0 ? "up" : t.dir < 0 ? "down" : "flat";
    const arrow = t.dir > 0 ? "↑" : t.dir < 0 ? "↓" : "—";
    return (
      <div className={"adb-trend " + cls}>
        {arrow} <AnimatedNumber value={t.delta} id={k + ":d"} /> (<AnimatedNumber value={t.pct} id={k + ":p"} />%)
      </div>
    );
  }

  function StatCard({ tone, icon: Icon, title, value, to, mkey }: any) {
    const [c1, c2] = TONE[tone] || TONE.purple;
    return (
      <div
        className="adb-stat"
        style={
          { ["--c1" as any]: c1, ["--c2" as any]: c2 } as React.CSSProperties
        }
        role={to ? "link" : undefined}
        tabIndex={to ? 0 : undefined}
        onClick={
          to
            ? () => {
                markViewed(mkey, value);
                navigate(to);
              }
            : undefined
        }
        onKeyDown={
          to
            ? (e) => {
                if (e.key === "Enter") {
                  markViewed(mkey, value);
                  navigate(to);
                }
              }
            : undefined
        }
      >
        <div className="adb-ico">
          <Icon size={26} strokeWidth={2} />
        </div>
        <div className="adb-stat-body">
          <p>{title}</p>
          <h4>
            <AnimatedNumber value={value} id={mkey || title} />
          </h4>
          <TrendPill t={trendFor(mkey, value)} k={mkey || title} />
        </div>
        <svg
          className="adb-wave"
          viewBox="0 0 120 60"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 60 C 28 60, 38 14, 66 12 C 92 10, 100 40, 120 34 L 120 60 Z" />
        </svg>
      </div>
    );
  }

  function CardHead({ icon: Icon, title, children }: any) {
    return (
      <div className="adb-card-head">
        <h6>
          <span className="ci">
            <Icon size={20} />
          </span>
          {title}
        </h6>
        {children}
      </div>
    );
  }

  function RangeSelect({
    value,
    onChange,
    options,
  }: {
    value: number;
    onChange: (v: number) => void;
    options: [number, string][];
  }) {
    return (
      <label className="adb-select">
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <ChevronDown size={15} aria-hidden="true" />
      </label>
    );
  }

  function DonutCard({
    icon,
    title,
    data,
    colors,
  }: {
    icon: LucideIcon;
    title: string;
    data: PieData[];
    colors: string[];
  }) {
    const total = data.reduce((n, d) => n + d.value, 0);
    return (
      <div className="adb-card">
        <CardHead icon={icon} title={title} />
        <div className="adb-donut">
          <div className="ring">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                {total > 0 ? (
                  <Pie
                    data={data}
                    dataKey="value"
                    innerRadius="72%"
                    outerRadius="100%"
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                    isAnimationActive
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={colors[i % colors.length]} />
                    ))}
                  </Pie>
                ) : (
                  <Pie
                    data={[{ name: "None", value: 1 }]}
                    dataKey="value"
                    innerRadius="72%"
                    outerRadius="100%"
                    stroke="none"
                    isAnimationActive={false}
                  >
                    <Cell fill="#e5e7f2" />
                  </Pie>
                )}
                {total > 0 && <Tooltip />}
              </PieChart>
            </ResponsiveContainer>
            <div className="center">
              <b>{total}</b>
              <span>Total</span>
            </div>
          </div>
          <ul className="legend">
            {data.map((d, i) => (
              <li key={d.name}>
                <i style={{ background: colors[i % colors.length] }} />
                <span>{d.name}</span>
                <b>{d.value}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  function PopularityCard({ icon, title, link, linkText, data, color }: any) {
    return (
      <div className="adb-card">
        <CardHead icon={icon} title={title}>
          <Link to={link} className="adb-link">
            {linkText}
          </Link>
        </CardHead>
        {data.length === 0 ? (
          <p className="text-muted text-center py-5 mb-0">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data}
              margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="4 4" stroke="#e8eaf3" />
              <XAxis
                dataKey="name"
                tick={<WrapTick />}
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
                interval={0}
                height={52}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
              />
              <Tooltip cursor={{ fill: "rgba(100,116,139,.06)" }} />
              <Bar
                dataKey="value"
                name="Students"
                fill={color}
                radius={[4, 4, 0, 0]}
                maxBarSize={70}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    );
  }

  // x-axis label wrapped onto up to two centred lines
  function WrapTick({ x, y, payload }: any) {
    const words = String(payload?.value || "").split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > 18 && cur) {
        lines.push(cur);
        cur = w;
      } else cur = (cur + " " + w).trim();
    }
    if (cur) lines.push(cur);
    const shown = lines.slice(0, 2);
    if (lines.length > 2) shown[1] = shown[1].replace(/.{0,1}$/, "…");
    return (
      <text x={x} y={y + 12} textAnchor="middle" fill="#475569" fontSize={11.5}>
        {shown.map((l, i) => (
          <tspan key={i} x={x} dy={i === 0 ? 0 : 14}>
            {l}
          </tspan>
        ))}
      </text>
    );
  }
}
