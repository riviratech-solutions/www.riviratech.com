import React, { useState, useEffect, useRef } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  GraduationCap,
  RotateCw,
} from "lucide-react";
import "./calendar.css";

/* ---------------- TYPES ---------------- */

export interface ClassItem {
  id: number;
  date: string;
  ttype: string;

  req_id: string;
  sno: number;

  c_id: string;
  b_id: string;
  trainer: string;

  title: string;

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

interface Props {
  data: ClassItem[];
  // When user clicks a date
  onDateClick?: (item: ClassItem) => void;
  // When user changes month (YYYY-MM)
  onMonthChange?: (month: string) => void;
  // Reload button: fetch the shown month again (YYYY-MM)
  onReload?: (month: string) => void;
  // Month to open on (YYYY-MM); default: this month. Lets a page that rebuilds
  // the calendar (e.g. after changing course) keep the month that was showing.
  initialMonth?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function capitalizeWords(str: string) {
  if (!str) return "";
  return str.replace(/\b\w+/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

function renderDayTitle(raw: string) {
  if (!raw) return null;
  const clean = raw.trim();
  const colonIdx = clean.indexOf(":");
  if (colonIdx !== -1) {
    const part1 = capitalizeWords(clean.substring(0, colonIdx).trim());
    const part2 = capitalizeWords(clean.substring(colonIdx + 1).trim());
    return (
      <>
        <span className="cal-day-title-head">{part1}:</span>
        <span className="cal-day-title-sub">{part2}</span>
      </>
    );
  }
  return <span className="cal-day-title-head">{capitalizeWords(clean)}</span>;
}

/* ---------------- COMPONENT ---------------- */

const ClassCalendar: React.FC<Props> = ({
  data,
  onDateClick,
  onMonthChange,
  onReload,
  initialMonth,
}) => {
  const [current, setCurrent] = useState(() => {
    const m = /^(\d{4})-(\d{2})$/.exec(initialMonth || "");
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date();
  });

  const year = current.getFullYear();
  const month = current.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  /* ---------------- HELPERS ---------------- */

  const getMonthString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  /* ---------------- MONTH CHANGE ---------------- */

  const goTo = (d: Date) => {
    setCurrent(d);
    onMonthChange?.(getMonthString(d));
  };
  const prevMonth = () => goTo(new Date(year, month - 1, 1));
  const nextMonth = () => goTo(new Date(year, month + 1, 1));

  /* ---------------- MONTH PICKER ---------------- */

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const outside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPickerOpen(false);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [pickerOpen]);
  const pickMonth = (m: number) => {
    setPickerOpen(false);
    if (pickerYear !== year || m !== month) goTo(new Date(pickerYear, m, 1));
  };

  /* ---------------- RELOAD ---------------- */

  const [spinning, setSpinning] = useState(false);
  const reload = () => {
    onReload?.(getMonthString(current));
    setSpinning(true);
    window.setTimeout(() => setSpinning(false), 700);
  };

  /* ---------------- AUTO LOAD FIRST MONTH ---------------- */

  const [lastMonth, setLastMonth] = useState("");
  const [cloading, setCLoading] = useState(true);

  useEffect(() => {
    if (!cloading) {
      setCLoading(true);
      const m = getMonthString(current);
      if (m !== lastMonth) {
        setLastMonth(m);
        onMonthChange?.(m);
      }
      setTimeout(() => {
        setCLoading(false);
      }, 3000);
    }
  }, [current]);

  /* ---------------- GET CLASS BY DAY ---------------- */

  const getClassesForDate = (day: number) => {
    const d = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return data.filter((item) => item.date === d);
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="calendar-wrapper">
      {/* ---------- TOP BANNER: TITLE & LEGEND ---------- */}
      <div className="calendar-top-banner">
        <div className="calendar-banner-left">
          <div className="calendar-title-icon-wrap">
            <CalendarIcon size={24} />
          </div>
          <div className="calendar-title-text">
            <h3>
              Class <span className="calendar-title-accent">Schedule</span>
            </h3>
            <p>View upcoming classes, important dates and events</p>
          </div>
        </div>

        {/* Legend Pill */}
        <div className="calendar-legend-pill">
          <div className="cal-legend-item">
            <span className="cal-legend-dot cal-legend-dot-class" />
            <span className="cal-legend-label">Class</span>
          </div>
          <div className="cal-legend-item">
            <span className="cal-legend-dot cal-legend-dot-live" />
            <span className="cal-legend-label">Live Session</span>
          </div>
          <div className="cal-legend-item">
            <span className="cal-legend-dot cal-legend-dot-assignment" />
            <span className="cal-legend-label">Assignment</span>
          </div>
          <div className="cal-legend-item">
            <span className="cal-legend-dot cal-legend-dot-exam" />
            <span className="cal-legend-label">Exam / Assessment</span>
          </div>
        </div>
      </div>

      {/* ---------- MAIN CALENDAR CARD ---------- */}
      <div className="calendar-card">
        {/* Navigation Bar */}
        <div className="cal-nav-row">
          <button
            type="button"
            className="cal-nav-btn"
            onClick={prevMonth}
            aria-label="Previous Month"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="cal-center-group">
            <div className="cal-month-picker" ref={pickerRef}>
              <button
                type="button"
                className="cal-month-pill"
                onClick={() => {
                  setPickerYear(year);
                  setPickerOpen((o) => !o);
                }}
                aria-haspopup="dialog"
                aria-expanded={pickerOpen}
                title="Choose a month"
              >
                <CalendarIcon size={18} className="cal-month-icon" />
                <span className="cal-month-text">
                  {current.toLocaleString("default", { month: "long" })} {year}
                </span>
                <ChevronDown size={16} className={"cal-month-chev" + (pickerOpen ? " is-open" : "")} />
              </button>

              {pickerOpen && (
                <div className="cal-month-popover" role="dialog" aria-label="Choose a month">
                  <div className="cal-pop-year">
                    <button type="button" onClick={() => setPickerYear((y) => y - 1)} aria-label="Previous year">
                      <ChevronLeft size={16} />
                    </button>
                    <span>{pickerYear}</span>
                    <button type="button" onClick={() => setPickerYear((y) => y + 1)} aria-label="Next year">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="cal-pop-months">
                    {MONTHS.map((label, m) => {
                      const now = new Date();
                      const isShown = pickerYear === year && m === month;
                      const isToday = pickerYear === now.getFullYear() && m === now.getMonth();
                      return (
                        <button
                          key={label}
                          type="button"
                          className={"cal-pop-month" + (isShown ? " is-selected" : "") + (isToday ? " is-today" : "")}
                          onClick={() => pickMonth(m)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="cal-pop-today"
                    onClick={() => {
                      const now = new Date();
                      setPickerOpen(false);
                      if (now.getFullYear() !== year || now.getMonth() !== month) goTo(new Date(now.getFullYear(), now.getMonth(), 1));
                    }}
                  >
                    This month
                  </button>
                </div>
              )}
            </div>

            {onReload && (
              <button
                type="button"
                className="cal-nav-btn cal-reload-btn"
                onClick={reload}
                title="Reload this month"
                aria-label="Reload this month"
              >
                <RotateCw size={17} className={spinning ? "cal-spin" : ""} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="cal-nav-btn"
            onClick={nextMonth}
            aria-label="Next Month"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Weekday Headers */}
        <div className="cal-week-row">
          <div className="cal-weekday cal-weekday-sun">Sun</div>
          <div className="cal-weekday cal-weekday-regular">Mon</div>
          <div className="cal-weekday cal-weekday-regular">Tue</div>
          <div className="cal-weekday cal-weekday-regular">Wed</div>
          <div className="cal-weekday cal-weekday-regular">Thu</div>
          <div className="cal-weekday cal-weekday-regular">Fri</div>
          <div className="cal-weekday cal-weekday-sat">Sat</div>
        </div>

        {/* Days Grid */}
        <div className="cal-days-grid">
          {/* Empty slots before 1st day */}
          {[...Array(firstDay)].map((_, i) => (
            <div key={`empty-${i}`} className="cal-empty-cell" />
          ))}

          {/* Month days */}
          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1;
            const items = getClassesForDate(day);
            const firstItem = items[0];
            const remainingCount = items.length - 1;

            // Day column: 0=Sun, 6=Sat
            const colIndex = (firstDay + i) % 7;
            const colClass =
              colIndex === 0
                ? "cal-day-sun"
                : colIndex === 6
                ? "cal-day-sat"
                : "cal-day-regular";

            const isUpcoming = firstItem?.ttype === "upcoming";
            const eventClass = firstItem
              ? isUpcoming
                ? "cal-day-upcoming"
                : "cal-day-previous"
              : "";

            return (
              <div
                key={`day-${day}`}
                className={`cal-day-cell ${colClass} ${eventClass}`}
                onClick={() => firstItem && onDateClick?.(firstItem)}
              >
                {/* Top Row: Day Number and Badge */}
                <div className="cal-day-top">
                  <span className="cal-day-num">{day}</span>

                  {firstItem && (
                    <span
                      className={
                        isUpcoming ? "cal-badge-upcoming" : "cal-badge-previous"
                      }
                    >
                      {isUpcoming ? "Upcoming" : "Completed"}
                    </span>
                  )}
                </div>

                {/* Event Details */}
                {firstItem && (
                  <div className="cal-event-body">
                    <div className="cal-event-icon-wrap">
                      <GraduationCap
                        size={14}
                        className={
                          isUpcoming ? "cal-icon-upcoming" : "cal-icon-previous"
                        }
                      />
                    </div>

                    {renderDayTitle(firstItem.title)}

                    {remainingCount > 0 && (
                      <div className="cal-more-pill">
                        +{remainingCount} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ClassCalendar;