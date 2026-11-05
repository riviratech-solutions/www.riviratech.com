import {
  GraduationCap,
  Layers,
  Users,
  Calendar,
  FileText,
  AlertCircle,
  Clock,
  Send,
  Lock,
  FileDown,
  Play,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ClassVideo from "./ClassVideo";
import { classDocUrl } from "../utils/classFiles";
import { tzShort } from "../utils/classTime";

export interface ClassHeroCardItem {
  id?: number | string;
  req_id?: string;
  title: string;
  description?: string;
  notes?: string;
  doc?: string;
  zoom_link?: string;
  passcode?: string;
  classdate: number | string;
  stimings: number | string;
  etimings: number | string;
  status: string; // "0" cancelled, "1" active, "3" started, "2" completed
  // completed classes: the recording — type "1" uploaded video (file = upload
  // key), type "2" video link (file = URL, pwd = the link's passcode)
  file?: string;
  type?: string;
  // how the recording is stored and played (see ClassVideo.tsx)
  video_mode?: string;
  video_status?: string;
  hls_playlist?: string;
  pwd?: string;
  c_id?: string;
  b_id?: string;
  tname?: string;
  [key: string]: any;
}

interface ClassHeroCardProps {
  item: ClassHeroCardItem;
  courseName?: string;
  batchName?: string;
  trainerName?: string;
  isTrainer?: boolean;
  onJoinOrStart?: () => void;
  /** No longer used: the card plays an uploaded recording itself. */
  onViewVideo?: () => void;
  onGoBack?: () => void;
  showGoBack?: boolean;
}

function capitalizeWords(str: string) {
  if (!str) return "";
  return str.replace(/\b\w+/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

export default function ClassHeroCard({
  item,
  courseName = "",
  batchName = "",
  trainerName = "",
  isTrainer = false,
  onJoinOrStart,
  onGoBack,
  showGoBack = false,
}: ClassHeroCardProps) {
  const now = Math.floor(Date.now() / 1000);
  const stimingNum = Number(item.stimings) || 0;
  const etimingNum = Number(item.etimings) || 0;
  const isCompleted = item.status === "2" || item.status === "2S"; // "2S": completed, disabled
  const isCancelled = item.status === "0";
  // Over once the end time has passed (the start time when there is no end).
  const isOver = etimingNum > 0 ? now > etimingNum : stimingNum > 0 && now >= stimingNum;
  const isPrevious = !isCompleted && isOver;
  const isLive = !isCompleted && !isCancelled && !isOver && stimingNum > 0 && now >= stimingNum;
  const canJoin = !isCompleted && !isCancelled && !isOver && !!item.zoom_link && item.zoom_link.length >= 10;

  // The recording of a completed class: an uploaded video or a video link.
  const recFile = String(item.file || "").trim();
  const isUrl = /^https?:\/\//i.test(recFile);
  const recIsLink = String(item.type) === "2" || isUrl;
  const videoFile = isCompleted && recFile.length >= 10 && !recIsLink ? recFile : "";
  const videoLink = isCompleted && recIsLink && isUrl ? recFile : "";
  const linkPasscode = String(item.pwd || "").trim();

  // An uploaded recording plays right here in the card.
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  useEffect(() => setPlaying(false), [item.req_id, item.id]);
  useEffect(() => {
    if (playing) playerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [playing]);

  // Format Class Date: YYYY-MM-DD
  const formatClassDate = (ts: any) => {
    if (!ts || ts === "0" || ts === "-") return "-";
    const num = Number(ts);
    if (!isNaN(num) && num > 0) {
      const d = num < 10000000000 ? new Date(num * 1000) : new Date(num);
      return d.toLocaleDateString("sv-SE"); // YYYY-MM-DD
    }
    const parsed = new Date(ts);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("sv-SE");
    }
    return String(ts);
  };

  // Format Time: 07:28 PM
  const formatTime = (ts: any) => {
    if (!ts || ts === "0" || ts === "-") return "";
    const num = Number(ts);
    if (!isNaN(num) && num > 0) {
      const d = num < 10000000000 ? new Date(num * 1000) : new Date(num);
      return d
        .toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        .toUpperCase();
    }
    return String(ts);
  };

  const startTimeStr = formatTime(item.stimings);
  const endTimeStr = formatTime(item.etimings);
  const timingsDisplay =
    startTimeStr && endTimeStr
      ? `${startTimeStr} – ${endTimeStr} (${tzShort(item.stimings)})`
      : startTimeStr
      ? `${startTimeStr} (${tzShort(item.stimings)})`
      : "-";

  const isHexHash = (val: string) => /^[0-9a-fA-F]{20,40}$/.test(val.trim());

  const getCleanName = (val: any) => {
    if (!val || typeof val !== "string") return "";
    const trimmed = val.trim();
    if (trimmed === "" || trimmed === "Not Assigned" || isHexHash(trimmed)) {
      return "";
    }
    return trimmed;
  };

  const trainerDisplay =
    getCleanName(trainerName) ||
    getCleanName(item.tname) ||
    getCleanName(item.trainer) ||
    "Venkatesh Dhande";

  // Render Class Title matching Image 2 typography
  const renderTitle = (raw: string) => {
    if (!raw) return "Live Training Session";
    const clean = raw.trim();
    const colonIdx = clean.indexOf(":");
    if (colonIdx !== -1) {
      const part1 = capitalizeWords(clean.substring(0, colonIdx).trim());
      const part2 = capitalizeWords(clean.substring(colonIdx + 1).trim());
      return (
        <>
          <span className="d-block">{part1}:</span>
          <span>{part2}</span>
        </>
      );
    }
    return capitalizeWords(clean);
  };

  return (
    <div className="class-hero-container">
      {/* Optional Go Back button if opened from calendar */}
      {showGoBack && onGoBack && (
        <div className="mb-3 d-flex justify-content-between align-items-center">
          <button
            type="button"
            onClick={onGoBack}
            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1.5 rounded-pill px-3 py-1.5 shadow-sm fw-semibold"
          >
            <ArrowLeft size={15} />
            <span>Go Back</span>
          </button>
        </div>
      )}

      {/* Main Redesigned Class Card */}
      <div className="class-hero-card">
        {playing && videoFile ? (
          /* Watching the recording: the player takes the place of the details */
          <div className="class-player-view" ref={playerRef}>
            <div className="class-player-head">
              <div className="class-player-title">
                <span className="class-player-badge">
                  <Play size={13} fill="currentColor" /> Recording
                </span>
                <span className="class-player-name">{capitalizeWords(item.title || "Class recording")}</span>
              </div>
              <button type="button" className="class-player-back" onClick={() => setPlaying(false)}>
                <ArrowLeft size={15} />
                <span>Back to class details</span>
              </button>
            </div>
            <div className="class-video-player">
              <ClassVideo key={videoFile} item={item} autoPlay />
            </div>
          </div>
        ) : (
        <>
        {/* Dynamic Status Badge (Overlay on top-right of the card) */}
        <div className="class-hero-status-badge">
          {isCompleted ? (
            <span className="class-badge-pill class-badge-completed">
              Completed Class
            </span>
          ) : isCancelled ? (
            <span className="class-badge-pill class-badge-previous">
              Cancelled
            </span>
          ) : isLive ? (
            <span className="class-badge-pill class-badge-upcoming">
              Live Now
            </span>
          ) : isPrevious ? (
            <span className="class-badge-pill class-badge-previous">
              Previous Class
            </span>
          ) : (
            <span className="class-badge-pill class-badge-upcoming">
              Upcoming
            </span>
          )}
        </div>

        {/* LEFT SECTION: Details, Meta, Note, Timings, CTA */}
        <div className="class-hero-main-content">
          {/* Header Pill */}
          <div className="class-type-pill">
            <GraduationCap size={13} className="flex-shrink-0" />
            <span>CLASS</span>
          </div>

          {/* Title */}
          <h2 className="class-hero-title">
            {renderTitle(item.title)}
          </h2>

          {/* 3-Column Meta Row (Course, Batch, Class Date) */}
          <div className="class-hero-meta-row">
            {/* Course */}
            <div className="class-meta-item">
              <Layers size={20} className="class-meta-icon" />
              <div>
                <div className="class-meta-label">Course</div>
                <div className="class-meta-value">{courseName || "-"}</div>
              </div>
            </div>

            <div className="class-meta-divider" />

            {/* Batch */}
            <div className="class-meta-item">
              <Users size={20} className="class-meta-icon" />
              <div>
                <div className="class-meta-label">Batch</div>
                <div className="class-meta-value">{batchName || "-"}</div>
              </div>
            </div>

            <div className="class-meta-divider" />

            {/* Class Date */}
            <div className="class-meta-item">
              <Calendar size={20} className="class-meta-icon" />
              <div>
                <div className="class-meta-label">Class Date</div>
                <div className="class-meta-value">{formatClassDate(item.stimings || item.classdate)}</div>
              </div>
            </div>

            <div className="class-meta-divider" />

            {/* Trainer */}
            <div className="class-meta-item">
              <img
                src="/images/trainer-icon.png"
                alt="Trainer"
                className="class-meta-trainer-img"
              />
              <div>
                <div className="class-meta-label">Trainer</div>
                <div className="class-meta-value">{trainerDisplay}</div>
              </div>
            </div>
          </div>

          {/* About this class */}
          {item.description && item.description.trim().length > 0 && (
            <div className="class-about-block">
              <div className="class-about-header">
                <FileText size={16} className="class-about-icon flex-shrink-0" />
                <span>About this class</span>
              </div>
              <p className="class-about-body">
                {item.description}
              </p>
            </div>
          )}

          {/* Note Callout */}
          {item.notes && item.notes.trim().length > 0 && (
            <div className="class-note-callout">
              <AlertCircle size={17} className="class-note-icon text-danger flex-shrink-0" />
              <div className="class-note-text">
                <span className="class-note-prefix">Note: </span>
                {item.notes}
              </div>
            </div>
          )}

          {/* Document / PPT Download if present */}
          {item.doc && item.doc.trim().length >= 10 && (
            <div className="class-doc-banner">
              <div className="d-flex align-items-center gap-2">
                <FileDown size={16} className="text-primary" />
                <span className="class-doc-text">
                  Session Material / Document attached for this class
                </span>
              </div>
              <a
                href={classDocUrl(item.doc, item.req_id)}
                target="_blank"
                rel="noreferrer"
                className="class-doc-btn"
              >
                Download Document
              </a>
            </div>
          )}

          {/* Bottom Row: Timings + Join/Start Button + Passcode */}
          <div className="class-bottom-action-bar">
            {/* Clock & Timings */}
            <div className="class-timings-group">
              <Clock size={26} className="class-clock-icon text-indigo" />
              <div>
                <div className="class-timings-label">Class Timings</div>
                <div className="class-timings-value">{timingsDisplay}</div>
              </div>
            </div>

            <div className="class-bottom-divider" />

            {/* Join / Start while the class can still be joined; afterwards the
                recording (if any) or a short note — never the join button. */}
            <div className="class-actions-cluster">
              {canJoin ? (
                <>
                  <button
                    type="button"
                    className="class-join-btn"
                    onClick={onJoinOrStart}
                  >
                    <Send size={15} className="class-send-icon" />
                    <span>{isTrainer ? "Click to Start Class" : "Click to Join Class"}</span>
                  </button>

                  {/* Passcode Note */}
                  <div className="class-passcode-group">
                    <Lock size={14} className="text-muted flex-shrink-0" />
                    <span className="class-passcode-text">
                      {item.passcode && item.passcode.trim().length >= 3
                        ? `Passcode: ${item.passcode}`
                        : "Passcode: Not required"}
                    </span>
                  </div>
                </>
              ) : videoFile ? (
                <button
                  type="button"
                  className="class-join-btn class-video-btn"
                  onClick={() => setPlaying(true)}
                >
                  <Play size={15} fill="white" />
                  <span>Watch Recording</span>
                </button>
              ) : videoLink ? (
                <>
                  <a
                    href={videoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="class-join-btn class-video-btn"
                  >
                    <ExternalLink size={15} />
                    <span>Open Recording</span>
                  </a>
                  {linkPasscode && (
                    <div className="class-passcode-group">
                      <Lock size={14} className="text-muted flex-shrink-0" />
                      <span className="class-passcode-text">Passcode: {linkPasscode}</span>
                    </div>
                  )}
                </>
              ) : isCancelled ? (
                <span className="class-expired-chip">Class cancelled</span>
              ) : isCompleted ? (
                <span className="class-expired-chip">Recording not available yet</span>
              ) : isPrevious ? (
                <span className="class-expired-chip">Class ended</span>
              ) : null}
            </div>
          </div>

        </div>
        </>
        )}
      </div>

      {/* Scoped CSS Styles for Exact 1:1 Rendering */}
      <style>{`
        .class-hero-container {
          width: 100%;
          margin-bottom: 24px;
        }

        .class-player-view {
          width: 100%;
          padding: 22px 26px 26px;
        }
        .class-player-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .class-player-title {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .class-player-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 999px;
          background: #dcfce7;
          color: #15803d;
          font-size: 12px;
          font-weight: 700;
          flex: none;
        }
        .class-player-name {
          font-size: 17px;
          font-weight: 800;
          color: #4f46e5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .class-player-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #334155;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
        }
        .class-player-back:hover {
          border-color: #c4b5fd;
          color: #582fea;
          background: #f5f3ff;
        }
        .class-video-player {
          margin-top: 0;
          border-radius: 16px;
          overflow: hidden;
          background: #0f172a;
          box-shadow: 0 10px 24px -12px rgba(15, 23, 42, 0.45);
        }
        .class-video-player video {
          display: block;
          width: 100%;
          max-height: 70vh;
          background: #0f172a;
        }
        a.class-join-btn { text-decoration: none; }

        .class-hero-card {
          background: #ffffff;
          border: 1.5px solid #dbeafe;
          border-radius: 24px;
          box-shadow: 0 10px 30px -5px rgba(59, 130, 246, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.02);
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: stretch;
          width: 100%;
        }

        /* Top Right Status Badge */
        .class-hero-status-badge {
          position: absolute;
          top: 18px;
          right: 22px;
          z-index: 1;
          user-select: none;
        }

        .class-badge-pill {
          display: inline-block;
          font-weight: 700;
          font-size: 12px;
          padding: 4px 16px;
          border-radius: 9999px;
          letter-spacing: 0.3px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        }

        .class-badge-upcoming {
          background: #00c2f3;
          color: #ffffff;
        }

        .class-badge-completed {
          background: #10b981;
          color: #ffffff;
        }

        .class-badge-previous {
          background: #ef4444;
          color: #ffffff;
        }

        /* Left Main Content */
        .class-hero-main-content {
          width: 100%;
          padding: 26px 30px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          z-index: 2;
        }

        .class-type-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ede9fe;
          color: #582fea;
          font-weight: 800;
          font-size: 11px;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          padding: 3px 10px;
          border-radius: 9999px;
          margin-bottom: 8px;
          width: fit-content;
        }

        .class-hero-title {
          font-size: 26px;
          font-weight: 900;
          color: #582fea;
          line-height: 1.22;
          letter-spacing: -0.4px;
          margin: 0 0 16px 0;
        }

        /* Metadata Row */
        .class-hero-meta-row {
          display: flex;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 6px 0;
        }

        .class-meta-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .class-meta-icon {
          color: #582fea;
          flex-shrink: 0;
        }

        .class-meta-trainer-img {
          width: 22px;
          height: 22px;
          object-fit: contain;
          flex-shrink: 0;
        }

        .class-meta-label {
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
          line-height: 1;
          margin-bottom: 3px;
        }

        .class-meta-value {
          font-size: 13.5px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.2;
        }

        .class-meta-divider {
          width: 1px;
          height: 28px;
          background: #e2e8f0;
          margin: 0 18px;
          flex-shrink: 0;
        }

        /* About Section */
        .class-about-block {
          margin-bottom: 12px;
        }

        .class-about-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 4px;
        }

        .class-about-icon {
          color: #582fea;
        }

        .class-about-body {
          font-size: 12.5px;
          color: #334155;
          line-height: 1.5;
          margin: 0;
          white-space: pre-wrap;
        }

        /* Note Callout */
        .class-note-callout {
          background: #fef2f2;
          border-left: 4px solid #ef4444;
          border-radius: 8px;
          padding: 8px 12px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 14px;
        }

        .class-note-icon {
          margin-top: 2px;
        }

        .class-note-text {
          font-size: 12px;
          color: #dc2626;
          line-height: 1.4;
          margin: 0;
        }

        .class-note-prefix {
          font-weight: 700;
        }

        /* Document / PPT Banner */
        .class-doc-banner {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          padding: 8px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 14px;
          font-size: 12.5px;
        }

        .class-doc-text {
          color: #0369a1;
          font-weight: 500;
        }

        .class-doc-btn {
          font-size: 11.5px;
          font-weight: 700;
          color: #582fea;
          background: #ffffff;
          border: 1px solid #582fea;
          border-radius: 6px;
          padding: 4px 10px;
          text-decoration: none;
          white-space: nowrap;
          transition: all 0.2s ease;
        }

        .class-doc-btn:hover {
          background: #582fea;
          color: #ffffff;
        }

        /* Bottom Action Bar */
        .class-bottom-action-bar {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          padding-top: 8px;
        }

        .class-timings-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .class-clock-icon {
          color: #582fea;
        }

        .class-timings-label {
          font-size: 11px;
          color: #64748b;
          line-height: 1;
          margin-bottom: 2px;
        }

        .class-timings-value {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.2;
        }

        .class-bottom-divider {
          width: 1px;
          height: 32px;
          background: #e2e8f0;
          margin: 0 4px;
          flex-shrink: 0;
        }

        .class-actions-cluster {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .class-join-btn {
          background: #582fea;
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
          padding: 9px 24px;
          border-radius: 12px;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(88, 47, 234, 0.25);
          transition: all 0.2s ease;
        }

        .class-join-btn:hover {
          background: #4723c7;
          color: #ffffff;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(88, 47, 234, 0.35);
        }

        .class-video-btn {
          background: #10b981;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
        }

        .class-video-btn:hover {
          background: #059669;
          box-shadow: 0 6px 16px rgba(16, 185, 129, 0.35);
        }

        .class-send-icon {
          transform: rotate(-20deg);
        }

        .class-expired-chip {
          display: inline-block;
          font-size: 12.5px;
          font-weight: 700;
          color: #64748b;
          background: #f1f5f9;
          padding: 6px 14px;
          border-radius: 8px;
        }

        .class-passcode-group {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .class-passcode-text {
          font-size: 12.5px;
          color: #64748b;
          font-weight: 500;
        }

        .class-hero-visual-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          user-select: none;
        }

        /* Responsive Breakpoints */
        @media (max-width: 991px) {
          .class-hero-card {
            flex-direction: column;
          }

          .class-hero-main-content {
            flex: 0 0 100%;
            width: 100%;
            padding: 22px 20px;
          }

          .class-meta-divider {
            display: none;
          }

          .class-hero-meta-row {
            gap: 12px 18px;
          }
        }

        @media (max-width: 576px) {
          .class-hero-title {
            font-size: 21px;
          }

          .class-bottom-divider {
            display: none;
          }

          .class-bottom-action-bar {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
