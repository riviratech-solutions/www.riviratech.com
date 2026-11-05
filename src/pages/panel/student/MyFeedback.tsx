import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import {
  MessageSquareHeart,
  Star,
  BookOpen,
  Send,
  RotateCw,
  Sparkles,
  CheckCircle2,
  Clock,
  Edit3,
  X,
} from "lucide-react";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import { AnimatedNumber, SkeletonList } from "../../../components/loading";

const seo = getSeoByPath("");

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

const decodeHtml = (str: string) => {
  const el = document.createElement("textarea");
  el.innerHTML = str ?? "";
  return el.value;
};

export default function MyFeedback() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<{ req_id: string; title: string }[]>(
    [],
  );
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const empty = { course_id: "", rating: 0, feedback: "" };
  const [form, setForm] = useState(empty);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "TOP" | "PENDING">("ALL");

  const getSecurity = async () =>
    (
      await axios.get(SERVER_URL + "api/security/token", {
        withCredentials: true,
      })
    ).data;

  const load = async () => {
    setLoading(true);
    try {
      const res = await listFetch("api/my-feedbacks", {});
      if (res.data.success) {
        setCourses(res.data.courses || []);
        setList(res.data.data || []);
      } else {
        toast.error(res.data.message || "Couldn't load your feedback");
      }
    } catch {
      toast.error("Couldn't load your feedback");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    axios
      .get(SERVER_URL + "api/check-login", { withCredentials: true })
      .then((res) => {
        if (res.data.loggedIn && res.data.id === "1") load();
        else navigate("/logout");
      })
      .catch(() => navigate("/logout"));
  }, []);

  const existingFor = (courseId: string) =>
    list.find((f) => f.course_id === courseId);

  const chooseCourse = (courseId: string) => {
    const prev = existingFor(courseId);
    setForm(
      prev
        ? {
            course_id: courseId,
            rating: Number(prev.rating) || 0,
            feedback: prev.feedback || "",
          }
        : { ...empty, course_id: courseId },
    );
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.course_id) return setError("Please select a course.");
    if (!form.rating) return setError("Please choose a star rating.");
    if (form.feedback.trim().length < 10)
      return setError("Please write a little more (at least 10 characters).");

    setBusy(true);
    try {
      const s = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/add-feedback",
        {
          ...form,
          feedback: form.feedback.trim(),
          key: s.key,
          token: s.token,
          aut: s.aut,
        },
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(res.data.message || "Feedback submitted successfully!");
        setForm(empty);
        await load();
      } else {
        setError(res.data.message || "We couldn't submit your feedback.");
      }
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const fmt = (ts: any) =>
    Number(ts)
      ? new Date(Number(ts) * 1000).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";

  const editing = !!(form.course_id && existingFor(form.course_id));
  const shown = hover || form.rating;

  // Calculate Average Rating
  const avgRating =
    list.length > 0
      ? (
          list.reduce((acc, curr) => acc + (Number(curr.rating) || 0), 0) /
          list.length
        ).toFixed(1)
      : "0.0";

  const pendingReviews = Math.max(0, courses.length - list.length);

  const displayedList =
    filter === "TOP" ? list.filter((f) => Number(f.rating) >= 4) : list;

  const pendingCourses = courses.filter((c) => !existingFor(c.req_id));

  return (
    <>
      <Head
        pageTitle={seo.title || "My Feedback - Student Portal"}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />
      <ToastContainer position="top-right" autoClose={2500} />

      <div className="content">
        <div className="container-fluid p-4 si-wrapper">
          {/* Header Bar */}
          <div className="si-header-card">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <MessageSquareHeart size={24} />
              </div>
              <div>
                <h3 className="si-header-title">Course Feedback & Reviews</h3>
                <p className="si-header-subtitle">
                  Tell us how your classes and mentors are doing — your honest
                  feedback shapes curriculum and batch quality.
                </p>
              </div>
            </div>

            <div className="si-header-right">
              <span className="si-total-count-text">
                Reviews Given: <b>{list.length}</b>
              </span>
              <button
                data-refresh
                type="button"
                className="si-btn-export-excel"
                onClick={load}
                disabled={loading}
                title="Refresh Feedback"
              >
                <RotateCw size={14} className={loading ? "si-spin" : ""} />{" "}
                Refresh
              </button>
            </div>
          </div>

          {/* Stats KPI Cards */}
          <div className="si-stats-grid">
            {/* Enrolled Courses */}
            <div
              className={`si-stat-card card-total ${filter === "ALL" ? "active" : ""}`}
              onClick={() => setFilter("ALL")}
              title="Show all submitted feedback"
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#e0f2fe", color: "#0284c7" }}
              >
                <BookOpen size={22} />
              </div>
              <div>
                <p className="si-stat-label">Enrolled Courses</p>
                <h3 className="si-stat-value"><AnimatedNumber value={courses.length} pending={loading} id="MyFeedback-s1" /></h3>
              </div>
            </div>

            {/* Feedback Given */}
            <div
              className={`si-stat-card card-approved ${filter === "ALL" ? "active" : ""}`}
              onClick={() => setFilter("ALL")}
              title="Show all submitted feedback"
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#dcfce7", color: "#16a34a" }}
              >
                <CheckCircle2 size={22} />
              </div>
              <div>
                <p className="si-stat-label">Reviews Submitted</p>
                <h3 className="si-stat-value"><AnimatedNumber value={list.length} pending={loading} id="MyFeedback-s2" /></h3>
              </div>
            </div>

            {/* Average Rating */}
            <div
              className={`si-stat-card card-recent ${filter === "TOP" ? "active" : ""}`}
              onClick={() =>
                setFilter((prev) => (prev === "TOP" ? "ALL" : "TOP"))
              }
              title={
                filter === "TOP"
                  ? "Click to show all reviews"
                  : "Filter reviews with high ratings (4-5 stars)"
              }
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#fef3c7", color: "#d97706" }}
              >
                <Star size={22} />
              </div>
              <div>
                <p className="si-stat-label">Average Rating</p>
                <h3 className="si-stat-value">
                  <AnimatedNumber value={avgRating} pending={loading} id="MyFeedback-s3" />{" "}
                  <span style={{ fontSize: "16px", color: "#d97706" }}>★</span>
                </h3>
              </div>
            </div>

            {/* Pending Courses */}
            <div
              className={`si-stat-card card-rejected ${filter === "PENDING" ? "active" : ""}`}
              onClick={() =>
                setFilter((prev) => (prev === "PENDING" ? "ALL" : "PENDING"))
              }
              title={
                filter === "PENDING"
                  ? "Click to show submitted reviews"
                  : "Show courses awaiting your feedback"
              }
              role="button"
              tabIndex={0}
            >
              <div
                className="si-stat-icon-wrap"
                style={{ background: "#ede9fe", color: "#7c3aed" }}
              >
                <Clock size={22} />
              </div>
              <div>
                <p className="si-stat-label">Pending Reviews</p>
                <h3 className="si-stat-value"><AnimatedNumber value={pendingReviews} pending={loading} id="MyFeedback-s4" /></h3>
              </div>
            </div>
          </div>

          {/* Main Grid: Form on Left, List on Right */}
          <div className="row g-4">
            {/* Feedback Form Card */}
            <div className="col-lg-5">
              <div className="si-form-card">
                <div className="si-card-header">
                  <div className="d-flex align-items-center gap-2">
                    <Sparkles size={18} className="text-primary" />
                    <h5 className="si-card-title">
                      {editing
                        ? "Update Course Review"
                        : "Submit Course Feedback"}
                    </h5>
                  </div>
                  {editing && (
                    <span
                      className="badge bg-warning text-dark"
                      style={{ fontSize: "11px" }}
                    >
                      Editing Existing
                    </span>
                  )}
                </div>

                {!loading && courses.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <BookOpen
                      size={36}
                      className="text-secondary opacity-50 mb-2"
                    />
                    <p className="mb-0">
                      You are not currently enrolled in any active courses. You
                      can provide feedback once enrolled.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={submit} noValidate>
                    {/* Course Selection */}
                    <div className="mb-3">
                      <label className="si-field-label" htmlFor="fbk-course">
                        Select Enrolled Course{" "}
                        <span className="text-danger">*</span>
                      </label>
                      <select
                        id="fbk-course"
                        className="si-form-control si-select"
                        value={form.course_id}
                        onChange={(e) => chooseCourse(e.target.value)}
                      >
                        <option value="">
                          {loading ? "Loading courses…" : "— Choose Course —"}
                        </option>
                        {courses.map((c) => {
                          const rated = !!existingFor(c.req_id);
                          return (
                            <option key={c.req_id} value={c.req_id}>
                              {decodeHtml(c.title)} {rated ? "✓ (Rated)" : ""}
                            </option>
                          );
                        })}
                      </select>
                      {form.course_id && existingFor(form.course_id) && (
                        <small
                          className="text-muted d-block mt-1"
                          style={{ fontSize: "11.5px" }}
                        >
                          ℹ️ You have previously rated this course. Submitting
                          will update your review.
                        </small>
                      )}
                    </div>

                    {/* Star Rating Picker */}
                    <div className="mb-3">
                      <label className="si-field-label">
                        Your Rating <span className="text-danger">*</span>
                      </label>
                      <div
                        className="si-star-picker"
                        role="radiogroup"
                        aria-label="Rating"
                        onMouseLeave={() => setHover(0)}
                      >
                        <div className="d-flex align-items-center gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              role="radio"
                              aria-checked={form.rating === n}
                              className={`si-star-btn ${n <= shown ? "active" : ""}`}
                              onMouseEnter={() => setHover(n)}
                              onClick={() => setForm({ ...form, rating: n })}
                            >
                              <Star
                                size={26}
                                fill={n <= shown ? "#f59e0b" : "none"}
                                stroke={n <= shown ? "#f59e0b" : "#cbd5e1"}
                              />
                            </button>
                          ))}
                        </div>
                        <span className="si-star-rating-label">
                          {shown ? RATING_WORDS[shown] : "Tap a star to rate"}
                        </span>
                      </div>
                    </div>

                    {/* Feedback Textarea */}
                    <div className="mb-3">
                      <label className="si-field-label" htmlFor="fbk-text">
                        Your Detailed Review{" "}
                        <span className="text-danger">*</span>
                      </label>
                      <textarea
                        id="fbk-text"
                        className="si-form-control"
                        rows={5}
                        maxLength={2000}
                        value={form.feedback}
                        onChange={(e) =>
                          setForm({ ...form, feedback: e.target.value })
                        }
                        placeholder="What's going great, and what can we improve? (Trainer clarity, practical exercises, session pace, materials...)"
                      />
                      <div
                        className="d-flex justify-content-between mt-1 text-muted"
                        style={{ fontSize: "11.5px" }}
                      >
                        <span>Minimum 10 characters</span>
                        <span>{form.feedback.length} / 2000</span>
                      </div>
                    </div>

                    {error && (
                      <div
                        className="alert alert-danger py-2 px-3 mb-3 d-flex align-items-center gap-2"
                        style={{ fontSize: "12.5px" }}
                      >
                        <X size={15} /> {error}
                      </div>
                    )}

                    <div className="d-flex gap-2">
                      {editing && (
                        <button
                          type="button"
                          className="si-btn-export-excel"
                          disabled={busy}
                          onClick={() => setForm(empty)}
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        className="si-btn-export-csv flex-grow-1 justify-content-center"
                        disabled={busy}
                      >
                        {busy ? (
                          <>
                            <RotateCw size={14} className="si-spin" />{" "}
                            Submitting…
                          </>
                        ) : (
                          <>
                            <Send size={15} />{" "}
                            {editing ? "Update Review" : "Submit Feedback"}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Feedback History Card */}
            <div className="col-lg-7">
              <div className="si-table-card p-4">
                <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                  <div>
                    <h5 className="si-card-title mb-1">
                      {filter === "PENDING"
                        ? "Courses Awaiting Your Review"
                        : filter === "TOP"
                          ? "Top Rated Reviews (4★ - 5★)"
                          : "Your Submitted Reviews"}
                    </h5>
                    <p
                      className="text-muted mb-0"
                      style={{ fontSize: "12.5px" }}
                    >
                      {filter === "PENDING"
                        ? "Courses you are enrolled in that haven't been reviewed yet."
                        : filter === "TOP"
                          ? "Reviews where you gave 4 or 5 stars."
                          : "All course ratings & feedback you've shared so far."}
                    </p>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    {filter !== "ALL" && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        style={{ fontSize: "11.5px", padding: "2px 8px" }}
                        onClick={() => setFilter("ALL")}
                      >
                        Reset Filter
                      </button>
                    )}
                    <span
                      className="badge bg-light text-dark border px-2 py-1"
                      style={{ fontSize: "12px" }}
                    >
                      {filter === "PENDING"
                        ? `${pendingCourses.length} Pending`
                        : `${displayedList.length} Shown`}
                    </span>
                  </div>
                </div>

                {loading ? (
                  <SkeletonList rows={4} />
                ) : filter === "PENDING" ? (
                  pendingCourses.length === 0 ? (
                    <div className="si-empty-state py-4">
                      <div className="si-empty-icon">
                        <CheckCircle2 size={36} color="#16a34a" />
                      </div>
                      <h5 className="si-empty-title">All Caught Up!</h5>
                      <p className="si-empty-desc">
                        You have shared feedback for all your enrolled courses.
                        Thank you!
                      </p>
                    </div>
                  ) : (
                    <div className="si-feedback-list">
                      {pendingCourses.map((c) => (
                        <div
                          key={c.req_id}
                          className="si-feedback-item d-flex align-items-center justify-content-between"
                        >
                          <div>
                            <h6 className="si-fb-course-name mb-1">
                              {decodeHtml(c.title || "Course")}
                            </h6>
                            <span
                              className="text-muted"
                              style={{ fontSize: "12px" }}
                            >
                              Enrolled Program · No feedback submitted yet
                            </span>
                          </div>
                          <button
                            type="button"
                            className="si-btn-export-excel"
                            onClick={() => {
                              chooseCourse(c.req_id);
                              window.scrollTo({ top: 120, behavior: "smooth" });
                            }}
                          >
                            <Send size={13} /> Write Review
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                ) : displayedList.length === 0 ? (
                  <div className="si-empty-state py-4">
                    <div className="si-empty-icon">
                      <MessageSquareHeart size={36} />
                    </div>
                    <h5 className="si-empty-title">
                      {filter === "TOP"
                        ? "No 4+ Star Reviews"
                        : "No Feedback Shared Yet"}
                    </h5>
                    <p className="si-empty-desc">
                      {filter === "TOP"
                        ? "None of your submitted reviews have 4 or 5 stars."
                        : "Select one of your enrolled courses on the left and share how your experience has been!"}
                    </p>
                    {filter === "TOP" && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary mt-2"
                        onClick={() => setFilter("ALL")}
                      >
                        Show All Reviews
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="si-feedback-list">
                    {displayedList.map((f) => (
                      <div key={f.id} className="si-feedback-item">
                        <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                          <div>
                            <h6 className="si-fb-course-name">
                              {decodeHtml(f.course || "Course")}
                            </h6>
                            <div className="d-flex align-items-center gap-2 mt-1">
                              <div
                                className="d-flex align-items-center text-warning"
                                title={`${f.rating} / 5`}
                              >
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <Star
                                    key={n}
                                    size={14}
                                    fill={
                                      n <= Number(f.rating) ? "#f59e0b" : "none"
                                    }
                                    stroke={
                                      n <= Number(f.rating)
                                        ? "#f59e0b"
                                        : "#cbd5e1"
                                    }
                                  />
                                ))}
                              </div>
                              <span className="si-fb-score-pill">
                                {f.rating} / 5 ·{" "}
                                {RATING_WORDS[Number(f.rating)] || ""}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="si-btn-edit-pill"
                            onClick={() => {
                              chooseCourse(f.course_id);
                              window.scrollTo({ top: 120, behavior: "smooth" });
                            }}
                            title="Edit this feedback"
                          >
                            <Edit3 size={13} /> Edit
                          </button>
                        </div>

                        <div className="si-fb-body-quote">"{f.feedback}"</div>

                        <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                          <small
                            className="text-muted"
                            style={{ fontSize: "11.5px" }}
                          >
                            <Clock size={11} className="me-1 inline" />{" "}
                            Submitted on {fmt(f.datetime)}
                          </small>
                          <span className="si-fb-verified-badge">
                            <CheckCircle2 size={11} /> Verified Student Review
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="saved-ago-row">
                  <SavedAgo endpoint="api/my-feedbacks" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scoped CSS matching StudentsInquiries.tsx standard */}
      <style>{`
        .si-wrapper {
          background-color: #f8fafc;
          min-height: 100vh;
        }
        .si-header-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 22px;
          border: 1px solid #edf2f7;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          flex-wrap: wrap;
          gap: 16px;
        }
        .si-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .si-header-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: #eef2ff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #582fea;
          flex-shrink: 0;
        }
        .si-header-title {
          font-size: 22px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }
        .si-header-subtitle {
          font-size: 13.5px;
          color: #64748b;
          margin-top: 3px;
          margin-bottom: 0;
        }
        .si-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .si-total-count-text {
          font-size: 14px;
          color: #475569;
          font-weight: 500;
        }
        .si-total-count-text b {
          font-weight: 700;
          color: #0f172a;
        }
        .si-btn-export-excel {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          color: #475569;
          border-radius: 10px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-btn-export-excel:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #1e293b;
        }
        .si-btn-export-csv {
          background: #582fea;
          border: 1.5px solid #582fea;
          color: #ffffff;
          border-radius: 10px;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-btn-export-csv:hover {
          background: #4b24d6;
          border-color: #4b24d6;
          color: #ffffff;
        }
        .si-spin {
          animation: siSpin 1s linear infinite;
        }
        @keyframes siSpin {
          100% { transform: rotate(360deg); }
        }

        /* Stats Grid */
        .si-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }
        @media (max-width: 1024px) {
          .si-stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .si-stats-grid { grid-template-columns: 1fr; }
        }
        .si-stat-card {
          border-radius: 16px;
          padding: 18px 22px;
          display: flex;
          align-items: center;
          gap: 16px;
          border: 1px solid rgba(0, 0, 0, 0.04);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          cursor: pointer;
          user-select: none;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .si-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.07);
        }
        .si-stat-card.card-total { background: #f0f8ff; }
        .si-stat-card.card-total.active {
          border-color: #0284c7 !important;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25) !important;
        }
        .si-stat-card.card-approved { background: #f0fdf4; }
        .si-stat-card.card-approved.active {
          border-color: #16a34a !important;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25) !important;
        }
        .si-stat-card.card-rejected { background: #faf5ff; }
        .si-stat-card.card-rejected.active {
          border-color: #7c3aed !important;
          box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.25) !important;
        }
        .si-stat-card.card-recent { background: #fffdf0; }
        .si-stat-card.card-recent.active {
          border-color: #d97706 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.25) !important;
        }

        .si-stat-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .si-stat-label {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
          margin: 0;
        }
        .si-stat-value {
          font-size: 26px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.1;
          margin-top: 4px;
          margin-bottom: 0;
        }

        /* Form Card */
        .si-form-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 24px;
          border: 1px solid #edf2f7;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        }
        .si-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f1f5f9;
        }
        .si-card-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .si-field-label {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 6px;
          display: block;
        }
        .si-form-control {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13.5px;
          color: #1e293b;
          outline: none;
          transition: all 0.15s ease;
        }
        .si-form-control:focus {
          border-color: #582fea;
          box-shadow: 0 0 0 3px rgba(88, 47, 234, 0.1);
        }
        .si-select {
          background-color: #ffffff;
        }

        /* Star Picker */
        .si-star-picker {
          background: #f8fafc;
          border: 1px solid #edf2f7;
          border-radius: 12px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }
        .si-star-btn {
          background: none;
          border: none;
          padding: 2px;
          cursor: pointer;
          transition: transform 0.1s ease;
        }
        .si-star-btn:hover {
          transform: scale(1.15);
        }
        .si-star-rating-label {
          font-size: 13px;
          font-weight: 700;
          color: #d97706;
        }

        /* Table Card and Feedback list */
        .si-table-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #edf2f7;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        }
        .si-feedback-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .si-feedback-item {
          background: #f8fafc;
          border: 1px solid #edf2f7;
          border-radius: 14px;
          padding: 16px 18px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .si-feedback-item:hover {
          border-color: #cbd5e1;
          box-shadow: 0 2px 6px rgba(0,0,0,0.03);
        }
        .si-fb-course-name {
          font-size: 14.5px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .si-fb-score-pill {
          font-size: 11.5px;
          font-weight: 600;
          color: #475569;
          background: #e2e8f0;
          padding: 2px 8px;
          border-radius: 12px;
        }
        .si-btn-edit-pill {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #475569;
          border-radius: 8px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s ease;
        }
        .si-btn-edit-pill:hover {
          background: #eef2ff;
          border-color: #a5b4fc;
          color: #582fea;
        }
        .si-fb-body-quote {
          font-size: 13.5px;
          line-height: 1.55;
          color: #334155;
          margin-top: 10px;
          font-style: italic;
          background: #ffffff;
          padding: 10px 14px;
          border-radius: 8px;
          border-left: 3px solid #582fea;
        }
        .si-fb-verified-badge {
          font-size: 11px;
          font-weight: 600;
          color: #16a34a;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        /* Empty State */
        .si-empty-state {
          padding: 40px 20px;
          text-align: center;
        }
        .si-empty-icon {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          background: #f1f5f9;
          color: #94a3b8;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }
        .si-empty-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .si-empty-desc {
          font-size: 13px;
          color: #64748b;
          max-width: 360px;
          margin: 0 auto;
        }
      `}</style>
    </>
  );
}
