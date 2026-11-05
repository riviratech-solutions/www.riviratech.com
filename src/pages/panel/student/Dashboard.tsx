import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";

import ClassCalendar from "../../../components/Calendar";
import SurveyPopup from "../../../components/SurveyPopup";
import ClassHeroCard from "../../../components/ClassHeroCard";
import ClassVideo from "../../../components/ClassVideo";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { CalendarDays, RotateCw } from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import StudentNotices from "../../../components/DashboardNotices";
import { openWebLink } from "../../../utils/openLink";
import { AnimatedNumber, Skeleton, SkeletonCards } from "../../../components/loading";

const seo = getSeoByPath("");

export default function Dashboard() {
  /* ================= LIVE STATE ================= */
  let usercid = localStorage.getItem("usercid") || "";

  function DateTime(ts: any) {
    if (!ts) return "";

    return new Date(ts * 1000).toLocaleDateString("sv-SE"); // YYYY-MM-DD
  }

  const timestampTime = (ts: any) => {
    if (!ts) return "";
    const date = new Date(ts * 1000);
    return date.toLocaleString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const [stats, setStats] = useState({
    totalAssignments: 0,
    activeAssignments: 0,
    appliedAssignments: 0,
    upcomingClasses: 0,
  });

  interface ClassItem {
    id: number;
    date: string;
    ttype: string;

    req_id: string;
    sno: number;

    c_id: string;
    b_id: string;
    trainer: string;

    title: string;
    description: string; // topic / agenda for the class ('' when unset)

    classdate: number; // Unix timestamp
    stimings: number; // Unix timestamp
    etimings: number; // Unix timestamp

    zoom_link: string;
    passcode: string;
    notes: string;
    file: string;
    pwd: string;
    doc: string;

    type: string; // "0" | "1"
    status: string;

    attedences: number;
    started: number;
    datetime: string;

    tname: string;
    temail: string;
    tphone: string;
  }
  let [selectcid, setSelectcid] = useState(usercid);
  const [loading, setLoading] = useState(true);
  //const [classlisttype, setClassListType] = useState("");
  const [classlist, setClassList] = useState<any[]>([]);
  const [alllists, setAllLists] = useState<any[]>([]);
  // the full class row (recording fields included) for a class in the form
  const rowOf = (f: any) => [...alllists, ...classlist].find((r: any) => r.req_id === f.req_id) || f;
  // bumped by the refresh button so the notices reload too
  const [noticesKey, setNoticesKey] = useState(0);
  const [classData, setClassData] = useState<ClassItem[]>([]);
  interface ClassResponse {
    month: string;
    data: ClassItem[];
  }
  const [monthclassData, setMonthClassData] = useState<ClassResponse[]>([]);

  const [usercourses, setUserCourses] = useState<any[]>([]);
  // the month the calendar is showing ("YYYY-MM"), so a course change reloads
  // that month rather than jumping back to this one
  const calMonth = useRef("");

  const navigate = useNavigate();

  const datetime = Math.floor(Date.now() / 1000);

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true, // 🔥 REQUIRED
    });

    return res.data;
  };

  const loadDetails = async () => {
    setLoading(true);

    try {
      const res = await listFetch("api/my-stats", {});
      if (res.data.success) {
        setStats(res.data.stats);
        setAllLists(res.data.user);
        setClassList(res.data.classrows);
        //setClassListType(res.data.classtype);
        setUserCourses(res.data.courses);
        loadTrainers();
        if (res.data.courses.length >= 1) {
          // The calendar's course: the one just picked at the top (saved to storage
          // before this runs; the `selectcid` state still holds the previous course
          // until the next render), else the first — with that course's own batch.
          const saved = localStorage.getItem("usercid") || "";
          const course = res.data.courses.find((c: any) => c.c_id === saved) || res.data.courses[0];
          if (course.c_id !== selectcid) setSelectcid(course.c_id);
          loadclasses(calMonth.current || timestampToMonth(datetime), course.c_id, course.b_id || "");
        }
      } else {
        toast.error("❌ Something went wrong");
      }
    } catch (err) {
      console.log(err);
      alert("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true, // 🔥 REQUIRED
    });
    return res.data;
  };

  const initchecklogin = async () => {
    const data = await checklogin();
    const loggedIn = data.loggedIn;
    if (loggedIn) {
      loadDetails();
    } else {
      navigate("/logout");
    }
  };

  useEffect(() => {
    // ---------- Main CSS ----------

    // ---------- Admin CSS ----------

    initchecklogin();

    return () => {};
  }, []);

  const loadBatches = async (c_id: any) => {
    try {

      const res = await listFetch("api/get-batches", {
          c_id: c_id,
          status: "",
        });

      if (res.data.success) {
        if (res.data.data.length >= 1) {
          setBatches(res.data.data);
        }
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
    } finally {
    }
  };

  const [batches, setBatches] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [model, setModel] = useState("");
  const [modelin, setModelIn] = useState("");
  const [mode, setMode] = useState("dashboard");

  const [classdate, setClassDate] = useState("");

  const loadTrainers = async () => {
    try {
      const res = await listFetch("api/get-trainers", {
          status: "",
          course: "",
        });

      if (res.data.success && Array.isArray(res.data.data)) {
        setTrainers(res.data.data);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const getTrainerNameById = (idOrName: string) => {
    if (!idOrName) return "";
    const clean = String(idOrName).trim();
    const found = trainers.find(
      (t) => t.mem_id === clean || t.id === clean || t.ukey === clean,
    );
    if (found) {
      return decodeHtml(found.name);
    }
    if (/^[0-9a-fA-F]{20,40}$/.test(clean)) {
      return "";
    }
    return clean;
  };

  const getBatchesNameById = (ids: string) => {
    if (!ids || batches.length === 0) return "";
    return ids
      .split(",") // "2,5,7" → ["2","5","7"]
      .map((id) => id.trim()) // remove spaces
      .map((id) => {
        const course = batches.find((c) => c.b_id === id);
        return course ? decodeHtml(course.name) : "";
      })
      .filter((name) => name) // remove empty values
      .join(", "); // join with comma + space
  };

  const getClassesByDate = (date: string) => {
    return classData.filter((item) => {
      return item.date === date;
    });
  };
  const handleClick = (item: any) => {
    setClassDate(item.date);
    setModelIn("lists");
    setModel("classeslist");
    if (batches.length <= 0) {
      loadBatches("");
    }
    if (trainers.length <= 0) {
      loadTrainers();
    }
  };

  const initialForm = {
    id: "",
    req_id: "",
    sno: "",
    c_id: "",
    b_id: "",
    trainer: "",
    tname: "",
    title: "",
    description: "",
    classdate: "",
    stimings: "",
    etimings: "",
    zoom_link: "",
    passcode: "",
    notes: "",
    file: "",
    pwd: "",
    type: "",
    doc: "",
    attendance: 0,
    datetime: "",
    status: "",
  };
  const [form, setForm] = useState(initialForm);

  const updateto = async (type: any, list: any) => {
    try {
      let classdate = list.classdate;
      let stimings = list.stimings;
      let etimings = list.etimings;

      setForm({
        id: list.id,
        req_id: list.req_id,
        sno: list.sno,

        c_id: list.c_id,
        b_id: list.b_id,

        trainer: list.trainer,

        tname: getTrainerNameById(list.tname || list.trainer) || list.tname,

        title: list.title,

        description: list.description || "",

        classdate: classdate,

        stimings: stimings,

        etimings: etimings,

        zoom_link: list.zoom_link,

        passcode: list.passcode,

        notes: list.notes,

        file: list.file,

        pwd: list.pwd,

        type: list.type,

        doc: list.doc,

        attendance: list.attendance || 0,

        datetime: list.datetime,

        status: list.status,
      });
    } catch (error) {
      console.log(error);
    }
    setModelIn(type);
  };

  const timestampToMonth = (ts: any) => {
    if (!ts) return "";

    const date = new Date(ts * 1000);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    return `${year}-${month}`;
  };

  const moveto = async (id: any) => {
    if (id === "play" && classlist[0].type === "2") {
      let message = "";
      let confirm = null;
      if (classlist[0].pwd.length >= 1) {
        message = "Please use '" + classlist[0].pwd + "' to watch video class";
        confirm = window.prompt(message, classlist[0].pwd);
      } else {
        message = "Open video link to watch video class";
        confirm = window.confirm(message);
      }
      if (!confirm) return; // ❌ Cancel clicked
      if (!openWebLink(classlist[0].file)) alert("This class link isn't a web link (https://…).");
    } else {
      setMode(id);
    }
  };

  const moveto2 = async (id: any) => {
    if (id === "play" && form.type === "2") {
      let message = "";
      let confirm = null;
      if (form.pwd.length >= 1) {
        message = "Please use '" + form.pwd + "' to watch video class";
        confirm = window.prompt(message, form.pwd);
      } else {
        message = "Open video link to watch video class";
        confirm = window.confirm(message);
      }
      if (!confirm) return; // ❌ Cancel clicked
      if (!openWebLink(form.file)) alert("This class link isn't a web link (https://…).");
    } else {
      setModelIn(id);
    }
  };

  const updateattendace = async (target: any = classlist[0]) => {
    try {
      const security = await getSecurity();

      const res = await axios.post(
        SERVER_URL + "api/live-class-join",
        {
          title: target?.title || classlist[0]?.title,
          req_id: target?.req_id || classlist[0]?.req_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        {
          withCredentials: true, // 🔥 REQUIRED
        },
      );

      if (res.data.success) {
        if (!openWebLink(target?.zoom_link || classlist[0]?.zoom_link)) alert("This class link isn't a web link (https://…).");
      } else {
        toast.error("❌ Something went wrong");
      }
    } catch (err) {
      alert("❌ Something went wrong");
    } finally {
    }
  };

  // Calendar months are kept per course + month ("cid|YYYY-MM"), so switching
  // course never shows the other course's month. fresh = the reload button.
  const loadclasses = async (month: String, cid: String, bid: String, fresh = false) => {
    const key = `${cid}|${month}`;
    try {
      if (!fresh) {
        const cached = monthclassData.find((m) => m.month === key);
        if (cached) {
          setClassData(cached.data);
          return;
        }
      }


      const res = await listFetch("api/load-month-classes", {
          month: month,
          cid,
          bid,
        }, { fresh });

      if (res.data.success) {
        mapClasses(res.data.data, key);
      } else {
        toast.error("❌ Something went wrong");
      }
    } catch (err) {
      console.log("❌ Something went wrong");
    } finally {
    }
  };

  // The calendar's course: the one picked at the top, else the first.
  // Its batch is the student's own enrolment (the server checks it too).
  const loadMonth = (month: string, fresh = false) => {
    const saved = localStorage.getItem("usercid") || "";
    const cid =
      (usercourses.some((c) => c.c_id === saved) ? saved : "") ||
      (selectcid && selectcid.length > 10 ? selectcid : "") ||
      usercourses[0]?.c_id ||
      "";
    const bid = usercourses.find((uc) => uc.c_id === cid)?.b_id || "";
    loadclasses(month, cid, bid, fresh);
  };

  const mapClasses = (rows: any[], month: any) => {
    const now = Math.floor(Date.now() / 1000);

    const mapped: ClassItem[] = rows.map((item) => {
      const d = new Date(item.stimings * 1000);

      const formattedDate = `${d.getFullYear()}-${String(
        d.getMonth() + 1,
      ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const ttype: "upcoming" | "previous" =
        item.stimings >= now && item.status === "1" ? "upcoming" : "previous";

      return {
        ...item,
        date: formattedDate,
        ttype,
      };
    });

    // ✅ Set current month data
    setClassData(mapped);

    // ✅ Replace or insert month (no duplicates)
    setMonthClassData((prev) => {
      const exists = prev.find((m) => m.month === month);

      if (exists) {
        return prev.map((m) =>
          m.month === month ? { month, data: mapped } : m,
        );
      }

      return [...prev, { month, data: mapped }];
    });
  };

  const decodeHtml = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return doc.documentElement.textContent || "";
  };

  const getCourseNamesByIds = (ids: string) => {
    if (!ids || usercourses.length === 0) return "";
    return ids
      .split(",") // "2,5,7" → ["2","5","7"]
      .map((id) => id.trim()) // remove spaces
      .map((id) => {
        const course = usercourses.find((c) => c.c_id === id);
        return course ? decodeHtml(course.course_name) : "";
      })
      .filter((course_name) => course_name) // remove empty values
      .join(", "); // join with comma + space
  };

  const getBatchNameById = (ids: string) => {
    if (!ids || usercourses.length === 0) return "";
    return ids
      .split(",") // "2,5,7" → ["2","5","7"]
      .map((id) => id.trim()) // remove spaces
      .map((id) => {
        const course = usercourses.find((c) => c.b_id === id);
        return course ? decodeHtml(course.batch_name) : "";
      })
      .filter((batch_name) => batch_name) // remove empty values
      .join(", "); // join with comma + space
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />

      <ToastContainer position="top-right" autoClose={2500} />

      <SurveyPopup panel />

      {/* Main Content */}
      <div className="content">
        <div
          className="container-fluid profile-page"
          style={{ marginTop: "10px" }}
        >
          {/* ---- welcome banner ---- */}
          <div className="adb-hero">
            <div>
              <h3>
                Welcome back{alllists[0]?.name ? `, ${alllists[0].name}` : ""}!{" "}
                <span className="wave" aria-hidden="true">
                  👋
                </span>
              </h3>
              <p>Here's what's happening with your portal today.</p>
            </div>
            <div className="d-flex align-items-center gap-3 flex-wrap">
              {usercourses.length >= 2 && (
                <div>
                  <select
                    style={{ fontSize: "13px", fontWeight: "bold" }}
                    className="form-select"
                    required
                    name="course"
                    id="course"
                    value={selectcid}
                    onChange={(e) => {
                      localStorage.setItem("usercid", e.target.value);
                      setSelectcid(e.target.value);
                      loadDetails();
                    }}
                  >
                    <option value="">Select Course</option>
                    {usercourses.map((c) => (
                      <option key={c.c_id} value={c.c_id}>
                        {decodeHtml(c.course_name)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <SavedAgo endpoint="api/my-stats" />
              <button data-refresh type="button" className="list-refresh-btn" title="Refresh" aria-label="Refresh" onClick={() => { loadDetails(); setNoticesKey((k) => k + 1); }}>
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

          <div className="dashview">
            {/* Stats */}
            <div className="row g-4 mt-2">
              <StatCard
                pending={loading}
                title="Total Assignments"
                value={stats.totalAssignments}
                icon="file-text"
                color="blue"
                onClick={() => navigate("/panel/assignments")}
                titleTooltip="Click to view all assignments"
              />

              <StatCard
                pending={loading}
                title="Active Assignments"
                value={stats.activeAssignments}
                icon="check-square"
                color="green"
                onClick={() => navigate("/panel/assignments")}
                titleTooltip="Click to view active assignments"
              />

              <StatCard
                pending={loading}
                title="Applied Assignments"
                value={stats.appliedAssignments}
                icon="clipboard"
                color="purple"
                onClick={() => navigate("/panel/assignments")}
                titleTooltip="Click to view your submitted assignments"
              />

              <StatCard
                pending={loading}
                title="Upcoming Classes"
                value={stats.upcomingClasses}
                icon="video-camera"
                color="orange"
                onClick={() => navigate("/panel/live-classes")}
                titleTooltip="Click to view upcoming live classes"
              />
            </div>

            {/* ---- notices from the team (Admin → Dashboard Notices), under the stats ---- */}
            <StudentNotices reloadKey={noticesKey} />

            {loading ? (
              // the next class (hero card) and the lists below it
              <div className="row g-4 mt-4">
                <div className="col-12">
                  <Skeleton h={230} r={18} />
                </div>
                <div className="col-12">
                  <SkeletonCards count={2} />
                </div>
              </div>
            ) : (
              <div>
                {mode === "dashboard" && (
                  <div className="mt-0">
                    <div className="row g-4 mt-4">
                      {classlist.length > 0 && (
                        <div className="col-12">
                          <ClassHeroCard
                            item={classlist[0]}
                            courseName={getCourseNamesByIds(classlist[0].c_id)}
                            batchName={getBatchNameById(classlist[0].b_id)}
                            trainerName={
                              getTrainerNameById(
                                classlist[0].trainer || classlist[0].tname,
                              ) || getTrainerNameById(classlist[0].tname)
                            }
                            onJoinOrStart={() => {
                              const datetime = Math.floor(Date.now() / 1000);
                              const st =
                                Number(classlist[0].stimings) - 10 * 60;
                              if (st >= datetime) {
                                alert("You can join before 10min only");
                              } else {
                                updateattendace(classlist[0]);
                              }
                            }}
                            onViewVideo={() => moveto("play")}
                          />
                        </div>
                      )}
                    </div>
                    <div className="col-sm-12">
                      <ClassCalendar
                        data={classData}
                        onDateClick={handleClick}
                        initialMonth={calMonth.current || undefined}
                        onMonthChange={(month) => { calMonth.current = month; loadMonth(month); }}
                        onReload={(month) => { calMonth.current = month; loadMonth(month, true); }}
                      />
                    </div>
                  </div>
                )}

                {mode === "play" && (
                  <div className="container-fluid p-4 liveclass-page view">
                    {/* Title */}
                    <h3 className="fw-bold pagehead">
                      <span className="totalcount">
                        <a
                          onClick={() => moveto("dashboard")}
                          className="add btn btn-success"
                        >
                          Go Back
                        </a>
                      </span>
                    </h3>

                    <div className="row g-4 contentbox">
                      <div className="class-view-card shadow-sm  col-sm-12">
                        <div>
                          <ClassVideo item={classlist[0]} autoPlay style={{ width: "100%" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {model === "classeslist" && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Classes On {classdate}</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setModel("")}
                ></button>
              </div>

              <div className="modal-body">
                {modelin === "lists" &&
                  getClassesByDate(classdate).map((list) => (
                    <ClassCard
                      key={list.id}
                      list={list}
                      trainer="Not Assigned"
                    />
                  ))}

                {modelin === "view" && (
                  <div
                    className="container-fluid liveclass-page view p-0"
                    style={{ minHeight: "auto", background: "none" }}
                  >
                    <ClassHeroCard
                      item={rowOf(form)}
                      courseName={getCourseNamesByIds(form.c_id)}
                      batchName={getBatchesNameById(form.b_id)}
                      trainerName={
                        getTrainerNameById(form.trainer || form.tname) ||
                        getTrainerNameById(form.tname)
                      }
                      showGoBack={true}
                      onGoBack={() => setModelIn("lists")}
                      onJoinOrStart={() => {
                        const datetime = Math.floor(Date.now() / 1000);
                        const st = Number(form.stimings) - 10 * 60;
                        if (st >= datetime) {
                          alert("You can join before 10min only");
                        } else {
                          updateattendace(form);
                        }
                      }}
                      onViewVideo={() => moveto2("play")}
                    />
                  </div>
                )}

                {modelin === "play" && (
                  <div
                    className="container-fluid liveclass-page view"
                    style={{ minHeight: "auto", background: "none" }}
                  >
                    {/* Title */}
                    <h3 className="fw-bold pagehead">
                      <span
                        className="totalcount"
                        style={{
                          position: "relative",
                          marginTop: "0px",
                          background: "white",
                        }}
                      >
                        <a
                          onClick={() => setModelIn("view")}
                          className="add btn btn-success"
                        >
                          Go Back
                        </a>
                      </span>
                    </h3>

                    <div className="row g-4 contentbox">
                      <div
                        className="class-view-card shadow-sm  col-sm-12"
                        style={{ margin: "0" }}
                      >
                        <div>
                          <ClassVideo item={rowOf(form)} autoPlay style={{ width: "100%" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  function ClassCard({ list }: any) {
    return (
      <div className="col-lg-12 col-md-12">
        <div className="card liveclass-card shadow-sm p-3">
          <div className="row align-items-center">
            <h6 className="fw-bold mb-2">
              📹 {list.title}
              <div style={{ float: "right" }}>
                {list.status == "1" && (
                  <span>
                    {datetime >= Number(list.stimings) ? (
                      <span className="badge bg-danger">Expired</span>
                    ) : (
                      <span className="badge bg-success">Upcoming</span>
                    )}
                  </span>
                )}

                {list.status == "0" && (
                  <span className="badge bg-danger">Canceled</span>
                )}

                {list.status == "2" && (
                  <span className="badge bg-success">Completed</span>
                )}
              </div>
            </h6>

            {/* Left Section */}
            <div className="col-md-3">
              <p className="mb-1 text-muted">Batch</p>
              <p className="fw-semibold">{getBatchesNameById(list.b_id)}</p>
              <button
                className="btn btn-success btn-sm mt-2"
                onClick={() => updateto("view", list)}
              >
                Class Details
              </button>
            </div>

            {/* Instructor */}
            <div className="col-md-3 text-center">
              <p className="mb-1 text-muted">Trainer</p>
              <p className="fw-semibold">
                {getTrainerNameById(list.trainer || list.tname) ||
                  "Venkatesh Dhande"}
              </p>
            </div>

            {/* Date & Time */}
            <div className="col-md-3 text-center">
              <p className="mb-1 text-muted">
                <i className="bi bi-clock"></i> Class Date :{" "}
                {DateTime(list.classdate)}
              </p>
              <p className="fw-semibold">
                {timestampTime(list.stimings)} - {timestampTime(list.etimings)}
              </p>
            </div>

            {/* Attendees */}
            <div className="col-md-2 text-center">
              <p className="mb-1 text-muted">
                <i className="bi bi-people"></i> Attendees
              </p>
              <p className="fw-semibold">{list.attendance}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

/* ================= Components ================= */

function StatCard({ pending, title, value, icon, color, onClick, titleTooltip }: any) {
  return (
    <div className="col-md-3">
      <div
        className="card stat-card"
        onClick={onClick}
        title={titleTooltip || `Click to view ${title}`}
        role="button"
        tabIndex={0}
        style={{
          cursor: "pointer",
          userSelect: "none",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-3px)";
          e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "";
        }}
      >
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <p
              className="mb-1 text-muted"
              style={{ fontSize: "13px", fontWeight: 500 }}
            >
              {title}
            </p>
            <h4 className="mb-0 fw-bold">
              <AnimatedNumber value={value} pending={pending} />
            </h4>
          </div>

          <div className={`icon-box ${color}`}>
            <i className={`fa fa-${icon}`}></i>
          </div>
        </div>
      </div>
    </div>
  );
}
