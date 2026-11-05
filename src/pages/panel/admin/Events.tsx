import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import DateFilter, {
  dayStartEpoch,
  dayEndEpoch,
} from "../../../components/DateFilter";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  Calendar,
  Plus,
  RotateCw,
  Bell,
  Edit2,
  Copy,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  Clock,
  Sparkles,
  ArrowLeft,
  Layers,
  BookOpen,
  GraduationCap,
  Users,
  Trash2,
  Save,
  Globe,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { safeMarkup } from "../../../utils/sanitizeHtml";
import { AnimatedNumber, ButtonLoader, InlineLoader, SkeletonTable } from "../../../components/loading";
import PickerSelect from "../../../components/PickerSelect";
import { browserTz, canonicalTz, inputsInTz, tzPickerOptions, tzShort, zonedToEpoch } from "../../../utils/classTime";

// events saved before the Time zone field were entered in India time
const EVENT_DEFAULT_TZ = "Asia/Kolkata";

const seo = getSeoByPath("");

// Monotonic counter used to give each dynamic row (learnings / audience /
// timers) a STABLE unique key. Keying by array index left the wrong row's
// text behind after removing a middle row; a stable uid fixes reconciliation.
let rowUidSeq = 0;
const nextRowUid = () => ++rowUidSeq;

const SI_STYLES = `

      .si-page-wrapper {
        background-color: #f8fafc;
        min-height: calc(100vh - 80px);
        padding: 24px 28px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .si-header-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 22px;
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
        border-radius: 12px;
        background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb), 0.25);
      }
      .si-header-title {
        font-size: 20px;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .si-count-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: #eef2ff;
        color: var(--ad-brand);
        font-size: 12px;
        font-weight: 700;
        border-radius: 20px;
      }
      .si-header-subtitle {
        font-size: 13px;
        color: #64748b;
        margin: 4px 0 0 0;
      }
      .si-header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .si-btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 18px;
        background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%);
        color: #ffffff !important;
        font-size: 13.5px;
        font-weight: 600;
        border-radius: 10px;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb), 0.2);
        text-decoration: none;
      }
      .si-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(var(--ad-brand-rgb), 0.3);
        color: #ffffff;
      }
      .si-stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 24px;
      }
      @media (max-width: 992px) {
        .si-stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 576px) {
        .si-stats-grid {
          grid-template-columns: 1fr;
        }
      }
      .si-stat-card {
        background: #ffffff;
        border-radius: 14px;
        padding: 16px 20px;
        border: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        cursor: pointer;
        user-select: none;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      }
      .si-stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
      }
      .si-stat-card.active {
        box-shadow: 0 0 0 2px var(--ad-brand), 0 6px 16px rgba(var(--ad-brand-rgb), 0.15);
        border-color: var(--ad-brand);
      }
      .si-stat-card.card-ongoing.active {
        box-shadow: 0 0 0 2px #10b981, 0 6px 16px rgba(16, 185, 129, 0.15);
        border-color: #10b981;
      }
      .si-stat-card.card-ended.active {
        box-shadow: 0 0 0 2px #3b82f6, 0 6px 16px rgba(59, 130, 246, 0.15);
        border-color: #3b82f6;
      }
      .si-stat-card.card-disabled.active {
        box-shadow: 0 0 0 2px #f59e0b, 0 6px 16px rgba(245, 158, 11, 0.15);
        border-color: #f59e0b;
      }
      .si-stat-label {
        font-size: 12.5px;
        color: #64748b;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }
      .si-stat-value {
        font-size: 24px;
        font-weight: 800;
        color: #0f172a;
        margin: 0;
      }
      .si-stat-icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .si-stat-purple { background: #f5f3ff; color: var(--ad-brand); }
      .si-stat-green  { background: #ecfdf5; color: #059669; }
      .si-stat-blue   { background: #eff6ff; color: #2563eb; }
      .si-stat-amber  { background: #fffbeb; color: #d97706; }

      .si-filter-bar {
        background: #ffffff;
        border-radius: 14px;
        padding: 14px 18px;
        border: 1px solid #e2e8f0;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
      }
      .si-filter-left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .si-select-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 4px 10px;
      }
      .si-select-label {
        font-size: 12.5px;
        font-weight: 600;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .si-select {
        border: none;
        background: transparent;
        font-size: 13px;
        font-weight: 600;
        color: #0f172a;
        outline: none;
        cursor: pointer;
      }
      .si-search-form {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        max-width: 360px;
      }
      .si-search-box {
        position: relative;
        width: 100%;
      }
      .si-search-input {
        width: 100%;
        padding: 8px 12px 8px 36px;
        font-size: 13px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        outline: none;
        transition: all 0.2s ease;
      }
      .si-search-input:focus {
        background: #ffffff;
        border-color: var(--ad-brand);
        box-shadow: 0 0 0 3px rgba(var(--ad-brand-rgb), 0.1);
      }
      .si-search-icon {
        position: absolute;
        left: 11px;
        top: 50%;
        transform: translateY(-50%);
        color: #94a3b8;
        pointer-events: none;
      }
      .si-reload-btn {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }
      .si-reload-btn:hover {
        background: #eef2ff;
        color: var(--ad-brand);
        border-color: #c7d2fe;
      }

      /* Modern Table Card */
      .si-table-card {
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        overflow: hidden;
      }
      .si-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
      }
      .si-table th {
        background: #f8fafc;
        padding: 14px 18px;
        font-size: 12px;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;
      }
      .si-table td {
        padding: 16px 18px;
        font-size: 13.5px;
        color: #1e293b;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
      }
      .si-table tbody tr {
        transition: background-color 0.15s ease;
      }
      .si-table tbody tr:hover {
        background-color: #f8fafc;
      }
      .si-table tbody tr:last-child td {
        border-bottom: none;
      }
      .si-event-cell {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .si-event-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: #ede9fe;
        color: var(--ad-brand);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .si-event-title {
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 2px;
        display: block;
        font-size: 14px;
      }
      .si-event-sub {
        font-size: 12px;
        color: #64748b;
        display: block;
      }
      .si-date-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12.5px;
        color: #334155;
        font-weight: 500;
      }
      .si-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 700;
      }
      .si-status-pill.si-status-ongoing {
        background: #dcfce7;
        color: #15803d;
      }
      .si-status-pill.si-status-ended {
        background: #eff6ff;
        color: #1d4ed8;
      }
      .si-status-pill.si-status-disabled {
        background: #fef3c7;
        color: #b45309;
      }
      .si-status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
      }
      .si-action-btns {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
      }
      .si-action-btn {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #475569;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .si-action-btn:hover {
        background: #f1f5f9;
        color: #0f172a;
        border-color: #cbd5e1;
      }
      .si-action-btn.btn-bell:hover {
        background: #ede9fe;
        color: var(--ad-brand);
        border-color: #c7d2fe;
      }
      .si-action-btn.btn-edit:hover {
        background: #e0f2fe;
        color: #0284c7;
        border-color: #bae6fd;
      }
      .si-action-btn.btn-copy:hover {
        background: #f3f4f6;
        color: #374151;
        border-color: #d1d5db;
      }
      .si-action-btn.btn-end:hover {
        background: #dcfce7;
        color: #16a34a;
        border-color: #bbf7d0;
      }
      .si-action-btn.btn-disable:hover {
        background: #fee2e2;
        color: #dc2626;
        border-color: #fecaca;
      }
      .si-action-btn.btn-enable:hover {
        background: #dcfce7;
        color: #16a34a;
        border-color: #bbf7d0;
      }
      .si-action-btn.btn-delete:hover {
        background: #fee2e2;
        color: #dc2626;
        border-color: #fecaca;
      }
      .si-empty-box {
        text-align: center;
        padding: 56px 20px;
      }
      .si-empty-icon {
        width: 56px;
        height: 56px;
        border-radius: 16px;
        background: #f1f5f9;
        color: #94a3b8;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
      }
      .si-empty-title {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 6px;
      }
      .si-empty-desc {
        font-size: 13px;
        color: #64748b;
        max-width: 400px;
        margin: 0 auto 16px;
      }
    
  /* Form Container & Layout */
  .si-form-container {
    margin: 0 auto;
    padding-bottom: 60px;
  }
  .si-form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 20px 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }
  .si-form-header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .si-btn-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .si-btn-back:hover {
    background: #e2e8f0;
    color: #0f172a;
  }
  .si-form-icon-box {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb), 0.25);
  }
  .si-form-title {
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }
  .si-form-subtitle {
    font-size: 13px;
    color: #64748b;
    margin: 4px 0 0 0;
  }

  /* Form Card Sections */
  .si-form-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }
  .si-form-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    padding-bottom: 14px;
    border-bottom: 1px solid #f1f5f9;
  }
  .si-form-card-title {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
  }
  .si-form-card-subtitle {
    font-size: 12.5px;
    color: #64748b;
    margin: 3px 0 0 0;
  }

  /* Form Labels & Inputs */
  .si-label {
    font-size: 13px;
    font-weight: 600;
    color: #334155;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .si-label .req {
    color: #ef4444;
  }
  .si-input, .si-textarea {
    width: 100%;
    padding: 9px 14px;
    font-size: 13.5px;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #0f172a;
    outline: none;
    transition: all 0.2s ease;
  }
  .si-input:focus, .si-textarea:focus {
    background: #ffffff;
    border-color: var(--ad-brand);
    box-shadow: 0 0 0 3px rgba(var(--ad-brand-rgb), 0.1);
  }
  .si-textarea {
    resize: vertical;
    min-height: 80px;
  }
  .si-tz-picker {
    position: relative;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .si-tz-picker .pks-btn {
    min-height: 40px;
    padding-left: 38px;
    font-size: 13.5px;
    font-weight: 400;
    color: #0f172a;
  }
  .si-tz-ico {
    position: absolute;
    left: 13px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--ad-brand);
    z-index: 1;
    pointer-events: none;
  }
  .si-tz-hint {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    color: #64748b;
  }
  .si-tz-hint b {
    color: var(--ad-brand);
    font-weight: 600;
  }

  /* Dynamic Item Row Card */
  .si-dynamic-item {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 14px;
    position: relative;
    transition: all 0.15s ease;
  }
  .si-dynamic-item:hover {
    border-color: #cbd5e1;
    background: #f1f5f9;
  }
  .si-dynamic-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .si-item-num-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: #e0e7ff;
    color: var(--ad-brand-2);
    font-size: 12px;
    font-weight: 700;
  }
  .si-btn-remove {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    border: 1px solid #fecaca;
    background: #fee2e2;
    color: #dc2626;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .si-btn-remove:hover {
    background: #fca5a5;
    color: #b91c1c;
  }
  .si-btn-add-item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: #ffffff;
    border: 1px dashed var(--ad-brand);
    color: var(--ad-brand);
    font-size: 13px;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .si-btn-add-item:hover {
    background: #eef2ff;
    border-style: solid;
  }

  /* Form Actions Footer */
  .si-form-actions-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 16px;
    padding: 16px 24px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }
  .si-btn-cancel {
    padding: 10px 20px;
    background: #f1f5f9;
    color: #475569;
    font-size: 13.5px;
    font-weight: 600;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .si-btn-cancel:hover {
    background: #e2e8f0;
    color: #0f172a;
  }
  .si-btn-submit {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%);
    color: #ffffff;
    font-size: 13.5px;
    font-weight: 600;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb), 0.25);
  }
  .si-btn-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(var(--ad-brand-rgb), 0.35);
  }
  .si-btn-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export default function Dashboard() {
  const [evtid, setevtid] = useState("");
  const [evtinfo, setevtinfo] = useState("");
  const [mainmode, setMainMode] = useState("main");
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");

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
      if (ustatus === "X" || ustatus === "Y") {
        setMainMode("main");
      }
    } else {
      navigate("/logout");
    }
  };

  useEffect(() => {
    initchecklogin();

    return () => {};
  }, []);
  return (
    <>
      <style>{SI_STYLES}</style>

      {mainmode == "main" && (
        <Events
          setMainMode={setMainMode}
          setevtinfo={setevtinfo}
          setevtid={setevtid}
          page={page}
          setPage={setPage}
          search={search}
          setSearch={setSearch}
          sort={sort}
          setSort={setSort}
        />
      )}

      {mainmode == "notifies" && (
        <EventNotifies
          setMainMode={setMainMode}
          evtinfo={evtinfo}
          evtid={evtid}
        />
      )}
    </>
  );
}

function Events({
  setMainMode,
  setevtinfo,
  setevtid,
  page,
  setPage,
  search,
  setSearch,
  sort,
  setSort,
}: any) {
  const permCan = usePagePerm("events");

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true, // 🔥 REQUIRED
    });

    return res.data;
  };

  const initialForm = {
    event_id: "",
    badge: "",
    title: "",
    description: "",

    a_badge: "",
    a_title: "",
    a_description: "",

    b_badge: "",
    b_title: "",
    b_description: "",
    b_event_date: "",
    b_event_time: "",
    b_features: "",
    b_tags: "",
    b_link: "",
    timezone: "", // "" = this browser's zone

    c_badge: "",
    c_title: "",
    c_description: "",

    d_badge: "",
    d_title: "",
    d_description: "",
    bootcamp: "",
    newbatch: "",

    timer_title: "",
    timer_desc: "",

    learnings_title: "",
    audiences_title: "",
    note_title: "",
    note_desc: "",
    datetime: "",
    status: "",
  };

  const [form, setForm] = useState(initialForm);

  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [alllists, setAllLists] = useState<any[]>([]);

  const [mode, setMode] = useState("board");

  type Learning = {
    title: string;
    description: string;
  };

  type Audience = {
    icon: string;
    title: string;
    subtitle: string;
  };

  type Timer = {
    icon: string;
    title: string;
    subtitle: string;
  };

  const [learnings, setLearnings] = useState<(Learning & { uid: number })[]>(
    () => [{ uid: nextRowUid(), title: "", description: "" }],
  );

  const [audience, setAudience] = useState<(Audience & { uid: number })[]>(
    () => [{ uid: nextRowUid(), icon: "", title: "", subtitle: "" }],
  );

  const [timers, setTimers] = useState<(Audience & { uid: number })[]>(() => [
    { uid: nextRowUid(), icon: "", title: "", subtitle: "" },
  ]);

  const handleLearningChange = (
    index: number,
    field: keyof Learning,
    value: string,
  ) => {
    setLearnings((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  const addLearning = () =>
    setLearnings([
      ...learnings,
      { uid: nextRowUid(), title: "", description: "" },
    ]);

  const handleAudienceChange = (
    index: number,
    field: keyof Audience,
    value: string,
  ) => {
    setAudience((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  const addAudience = () =>
    setAudience([
      ...audience,
      { uid: nextRowUid(), icon: "", title: "", subtitle: "" },
    ]);

  const addTimers = () =>
    setTimers([
      ...timers,
      { uid: nextRowUid(), icon: "", title: "", subtitle: "" },
    ]);

  const handleTimerChange = (
    index: number,
    field: keyof Timer,
    value: string,
  ) => {
    setTimers((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  const removeLearning = (index: number) => {
    setLearnings((prev) => prev.filter((_, i) => i !== index));
  };

  const removeAudience = (index: number) => {
    setAudience((prev) => prev.filter((_, i) => i !== index));
  };

  const removeTimer = (index: number) => {
    setTimers((prev) => prev.filter((_, i) => i !== index));
  };

  const timestampToDateTime = (ts: any) => {
    if (!ts) return "";
    const num = Number(ts);
    let date: Date;
    if (!isNaN(num) && num > 0) {
      date = new Date(num < 10000000000 ? num * 1000 : num);
    } else {
      date = new Date(ts);
    }
    if (isNaN(date.getTime())) return String(ts);

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  function inputDateTIme(ts: any) {
    if (!ts) return "";
    const num = Number(ts);
    let date: Date;
    if (!isNaN(num) && num > 0) {
      date = new Date(num < 10000000000 ? num * 1000 : num);
    } else {
      date = new Date(ts);
    }
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("sv-SE"); // YYYY-MM-DD
  }

  const limit = 10;

  const [listtotal, setTotal] = useState(0);
  // whole-table counts for the cards above the table (not just this page)
  const [stats, setStats] = useState<{ total: number; ongoing: number; ended: number; disabled: number } | null>(null);
  const [dfrom, setDfrom] = useState("");
  const [dto, setDto] = useState("");
  const [lastPage, setLastPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const location = useLocation();

  const loadDetails = async (
    page = 1,
    search = "",
    sort = "",
    df = "",
    dt = "",
    quiet = false, // after a save: keep the rows on screen, swap in the new ones
  ) => {
    if (!quiet) {
      setLoading(true);
      setAllLists([]);
    }
    setPage(page);
    setSearch(search);
    setSort(sort);
    setDfrom(df);
    setDto(dt);

    try {
      const res = await listFetch("api/events", {
          q: search,
          s: sort,
          n: page,
          df: dayStartEpoch(df),
          dt: dayEndEpoch(dt),
        });

      if (res.data.stats) setStats(res.data.stats);
      if (res.data.success) {
        setAllLists(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.lastPage);
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  const addList = async (e: any) => {
    e.preventDefault();

    setSuccess("");
    setError("");

    if (!form.title.trim()) {
      setError("❌ Please enter title name");
      return;
    }

    if (!form.b_event_date) {
      setError("❌ Please select event date");
      return;
    }

    if (!form.b_event_time) {
      setError("❌ Please select event time");
      return;
    }

    if (!form.timer_title.trim()) {
      setError("❌ Please enter timer title");
      return;
    }

    if (learnings.length === 0) {
      setError("❌ Please add at least one learning");
      return;
    }

    if (audience.length === 0) {
      setError("❌ Please add at least one audience");
      return;
    }

    try {
      setLoading(true);

      const security = await getSecurity();

      const res = await axios.post(
        SERVER_URL + "api/add-event", // ✅ correct API
        {
          ...form,
          timezone: form.timezone || browserTz(),
          learnings, // ✅ send dynamic state
          audience, // ✅ send dynamic state
          timers,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setSuccess(res.data.message);

        // Reset form
        setForm(initialForm);

        setLearnings([{ uid: nextRowUid(), title: "", description: "" }]);
        setAudience([{ uid: nextRowUid(), icon: "", title: "", subtitle: "" }]);
        setTimers([{ uid: nextRowUid(), icon: "", title: "", subtitle: "" }]);

        // Return to events board and refresh the list in place (no blank + skeleton)
        loadDetails(1, search, sort, dfrom, dto, true);
        setMode("board");
      } else {
        toast.error(res.data.message);
        setError(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const updateList = async (e: any) => {
    e.preventDefault();

    setSuccess("");
    setError("");

    if (!form.event_id.trim()) {
      setError("❌ Please enter title name");
      return;
    }

    if (!form.title.trim()) {
      setError("❌ Please enter title name");
      return;
    }

    if (!form.b_event_date) {
      setError("❌ Please select event date");
      return;
    }

    if (!form.b_event_time) {
      setError("❌ Please select event time");
      return;
    }

    if (!form.timer_title.trim()) {
      setError("❌ Please enter timer title");
      return;
    }

    if (learnings.length === 0) {
      setError("❌ Please add at least one learning");
      return;
    }

    if (audience.length === 0) {
      setError("❌ Please add at least one audience");
      return;
    }

    try {
      setLoading(true);

      const security = await getSecurity();

      const res = await axios.post(
        SERVER_URL + "api/update-event", // ✅ correct API
        {
          ...form,
          timezone: form.timezone || browserTz(),
          timers,
          learnings, // ✅ send dynamic state
          audience, // ✅ send dynamic state
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setSuccess(res.data.message);

        // Re-fetch from the server so the list shows the exact stored values.
        // The old optimistic merge spread `...form` over the list item, which
        // overwrote `b_event_date` (a unix timestamp column) with the raw
        // date-input string — making timestampToDateTime() render "Invalid
        // Date" until a manual page reload. Re-loading matches the DB exactly;
        // quietly, so the rows stay on screen until the fresh ones arrive.
        loadDetails(page, search, sort, dfrom, dto, true);
        setMode("board");
      } else {
        toast.error(res.data.message);
        setError(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const disableList = async (list: any) => {
    setSuccess("");
    setError("");

    // ✅ Ask confirmation first
    const confirm = window.confirm(
      "Are you sure you want to disable '" + list.title + "' event?",
    );

    if (!confirm) return; // ❌ Cancel clicked

    try {
      setLoadingId(list.event_id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/disable-event",
        {
          id: list.event_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) =>
          prev.map((b) =>
            b.event_id === list.event_id ? { ...b, status: "1S" } : b,
          ),
        );
        setForm((f) => ({ ...f, status: "1S" }));
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const enableList = async (list: any) => {
    setSuccess("");
    setError("");

    // ✅ Ask confirmation first
    const confirm = window.confirm(
      "Are you sure you want to enable '" + list.title + "' event?",
    );

    if (!confirm) return; // ❌ Cancel clicked

    try {
      setLoadingId(list.event_id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/enable-event",
        {
          id: list.event_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) =>
          prev.map((b) =>
            b.event_id === list.event_id ? { ...b, status: "1" } : b,
          ),
        );
        setForm((f) => ({ ...f, status: "1" }));
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const endList = async (list: any) => {
    setSuccess("");
    setError("");

    // ✅ Ask confirmation first
    const confirm = window.confirm(
      "Are you sure you want to save as end to '" + list.title + "' event?",
    );

    if (!confirm) return; // ❌ Cancel clicked

    try {
      setLoadingId(list.event_id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/end-event",
        {
          id: list.event_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) =>
          prev.map((b) =>
            b.event_id === list.event_id ? { ...b, status: "2" } : b,
          ),
        );
        setForm((f) => ({ ...f, status: "2" }));
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const deleteList = async (list: any) => {
    setSuccess("");
    setError("");

    const confirm = window.confirm(
      "Are you sure you want to delete '" + (list.title || "this event") + "'?",
    );
    if (!confirm) return;

    try {
      setLoadingId(list.event_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/delete-event",
        {
          id: list.event_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(res.data.message || "Event deleted successfully");
        setAllLists((prev) => prev.filter((b) => b.event_id !== list.event_id));
        setTotal((prev) => Math.max(0, prev - 1));
      } else {
        toast.error(res.data.message || "Failed to delete event");
      }
    } catch {
      setError("❌ Something went wrong deleting event");
      toast.error("❌ Something went wrong deleting event");
    } finally {
      setLoadingId(null);
    }
  };

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
    if (loggedIn && (ustatus == "X" || ustatus == "Y")) {
      loadDetails();
    } else {
      navigate("/logout");
    }
  };

  const moveto = async (id: any) => {
    setSuccess("");
    setError("");
    setMode(id);
  };

  const updateto = async (list: any, t: any) => {
    setSuccess("");
    setError("");

    // the date + time as they were entered: in the event's own time zone
    const eventTz = canonicalTz(list.timezone || EVENT_DEFAULT_TZ);
    const at = inputsInTz(list.b_event_date, eventTz);

    // ✅ Set main form
    setForm({
      event_id: list.event_id || "",
      badge: list.badge || "",
      title: list.title || "",
      description: list.description || "",
      a_badge: list.a_badge || "",
      a_title: list.a_title || "",
      a_description: list.a_description || "",
      b_badge: list.b_badge || "",
      b_title: list.b_title || "",
      b_description: list.b_description || "",
      b_event_date: at.date || inputDateTIme(list.b_event_date) || "",
      b_event_time: at.time || list.b_event_time || "",
      b_features: list.b_features || "",
      b_tags: list.b_tags || "",
      b_link: list.b_link || "",
      timezone: eventTz,
      c_badge: list.c_badge || "",
      c_title: list.c_title || "",
      c_description: list.c_description || "",
      d_badge: list.d_badge || "",
      d_title: list.d_title || "",
      d_description: list.d_description || "",
      bootcamp: list.bootcamp || "",
      newbatch: list.newbatch || "",
      timer_title: list.timer_title || "",
      timer_desc: list.timer_desc || "",
      learnings_title: list.learnings_title || "",
      audiences_title: list.audiences_title || "",
      note_title: list.note_title || "",
      note_desc: list.note_desc || "",
      datetime: list.datetime || "",
      status: list.status || "",
    });

    // ✅ Set timers (attach a stable uid to each server row for React keys)
    const safeTimers = Array.isArray(list.timers) ? list.timers : [];
    const safeLearnings = Array.isArray(list.learnings) ? list.learnings : [];
    const safeAudience = Array.isArray(list.audience) ? list.audience : [];

    setTimers(
      safeTimers.length > 0
        ? safeTimers.map((it: any) => ({ ...it, uid: nextRowUid() }))
        : [{ uid: nextRowUid(), icon: "", title: "", subtitle: "" }],
    );

    // ✅ Set learnings (attach a stable uid to each server row for React keys)
    setLearnings(
      safeLearnings.length > 0
        ? safeLearnings.map((it: any) => ({ ...it, uid: nextRowUid() }))
        : [{ uid: nextRowUid(), title: "", description: "" }],
    );

    // ✅ Set audience (attach a stable uid to each server row for React keys)
    setAudience(
      safeAudience.length > 0
        ? safeAudience.map((it: any) => ({ ...it, uid: nextRowUid() }))
        : [{ uid: nextRowUid(), icon: "", title: "", subtitle: "" }],
    );

    if (t == "update") {
      setMode("update");
    } else {
      setMode("add");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get("t"); // 👈 gets resetnow
    if (type === "add") {
      setMode("add");
    } else if (type === "update") {
      setMode("update");
    }

    initchecklogin();

    // ---------- Admin CSS ----------

    return () => {
      //document.body.removeChild(aosrun);
      //document.head.removeChild(maincss);
      //document.head.removeChild(adminlink);
    };
  }, []);

  const totalCount = stats ? stats.total : listtotal || alllists.length;
  const ongoingCount = stats
    ? stats.ongoing
    : alllists.filter((i) => i.status === "1").length;
  const endedCount = stats
    ? stats.ended
    : alllists.filter((i) => i.status === "2").length;
  const disabledCount = alllists.filter(
    (i) => i.status === "1S" || i.status === "0",
  ).length;

  const displayedLists = alllists.filter((item) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "1") return item.status === "1";
    if (statusFilter === "2") return item.status === "2";
    if (statusFilter === "1S")
      return item.status === "1S" || item.status === "0";
    return true;
  });

  return (
    <>
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />

      <ToastContainer position="top-right" autoClose={2500} />

      {/* Main Content */}
      <div className="content">
        {mode === "board" && (
          <div className="si-page-wrapper">
            {/* Header Card */}
            <div className="si-header-container">
              <div className="si-header-left">
                <div className="si-header-icon-box">
                  <Calendar size={24} />
                </div>
                <div>
                  <h3 className="si-header-title">
                    Events
                    <span className="si-count-badge">{totalCount} Total</span>
                  </h3>
                  <p className="si-header-subtitle">
                    Manage all webinars, bootcamps and scheduled events
                  </p>
                </div>
              </div>

              <div className="si-header-actions">
                {permCan("create") && (
                  <button
                    onClick={() => moveto("add")}
                    className="si-btn-primary"
                  >
                    <Plus size={16} />
                    <span>Add New Event</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4 Stat Cards */}
            <div className="si-stats-grid">
              <div
                className={`si-stat-card ${statusFilter === "ALL" ? "active" : ""}`}
                onClick={() => setStatusFilter("ALL")}
              >
                <div>
                  <div className="si-stat-label">Total Events</div>
                  <div className="si-stat-value"><AnimatedNumber value={totalCount} pending={loading} id="Events-s1" /></div>
                </div>
                <div className="si-stat-icon-wrap si-stat-purple">
                  <Calendar size={22} />
                </div>
              </div>

              <div
                className={`si-stat-card card-ongoing ${statusFilter === "1" ? "active" : ""}`}
                onClick={() => setStatusFilter("1")}
              >
                <div>
                  <div className="si-stat-label">Ongoing</div>
                  <div className="si-stat-value"><AnimatedNumber value={ongoingCount} pending={loading} id="Events-s2" /></div>
                </div>
                <div className="si-stat-icon-wrap si-stat-green">
                  <Sparkles size={22} />
                </div>
              </div>

              <div
                className={`si-stat-card card-ended ${statusFilter === "2" ? "active" : ""}`}
                onClick={() => setStatusFilter("2")}
              >
                <div>
                  <div className="si-stat-label">Ended</div>
                  <div className="si-stat-value"><AnimatedNumber value={endedCount} pending={loading} id="Events-s3" /></div>
                </div>
                <div className="si-stat-icon-wrap si-stat-blue">
                  <CheckCircle2 size={22} />
                </div>
              </div>

              <div
                className={`si-stat-card card-disabled ${statusFilter === "1S" ? "active" : ""}`}
                onClick={() => setStatusFilter("1S")}
              >
                <div>
                  <div className="si-stat-label">Disabled</div>
                  <div className="si-stat-value"><AnimatedNumber value={disabledCount} pending={loading} id="Events-s4" /></div>
                </div>
                <div className="si-stat-icon-wrap si-stat-amber">
                  <AlertCircle size={22} />
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="si-filter-bar">
              <div className="si-filter-left">
                <div className="si-select-wrap">
                  <span className="si-select-label">
                    <ArrowUpDown size={13} /> Sort:
                  </span>
                  <select
                    className="si-select"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      loadDetails(page, search, e.target.value, dfrom, dto);
                    }}
                  >
                    <option value="New">Newest First</option>
                    <option value="Old">Oldest First</option>
                  </select>
                </div>

                <div className="si-select-wrap">
                  <span className="si-select-label">Status:</span>
                  <select
                    className="si-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">All Status</option>
                    <option value="1">Ongoing</option>
                    <option value="2">Ended</option>
                    <option value="1S">Disabled</option>
                  </select>
                </div>

                <DateFilter
                  from={dfrom}
                  to={dto}
                  onApply={(f, t) => loadDetails(1, search, sort, f, t)}
                />
              </div>

              <form
                className="si-search-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  loadDetails(1, search, sort, dfrom, dto);
                }}
              >
                <ListSearch
                  placeholder="Search events..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <button data-refresh
                  type="button"
                  className="reload-btn"
                  title="Reset & Reload"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    loadDetails(1, "", sort, dfrom, dto);
                  }}
                >
                  <RotateCw size={15} />
                </button>
              </form>
            </div>

            {/* Table Card */}
            <div className="si-table-card">
              {loading ? (
                <SkeletonTable cols={5} />
              ) : displayedLists.length === 0 ? (
                <div className="si-empty-box">
                  <div className="si-empty-icon">
                    <Calendar size={28} />
                  </div>
                  <div className="si-empty-title">
                    {search
                      ? "No matching events found"
                      : "No events available"}
                  </div>
                  <p className="si-empty-desc">
                    {search
                      ? "Try adjusting your search terms or filter criteria."
                      : "No event records found in the system. Click 'Add New Event' to create one."}
                  </p>
                  <button
                    className="si-btn-primary"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("ALL");
                      loadDetails(1, "", sort, "", "");
                    }}
                  >
                    <RotateCw size={14} /> Reset Filters
                  </button>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="si-table">
                    <thead>
                      <tr>
                        <th style={{ width: "36%" }}>Event</th>
                        <th style={{ width: "22%" }}>Schedule</th>
                        <th style={{ width: "16%" }}>Created At</th>
                        <th style={{ width: "12%" }}>Status</th>
                        <th style={{ width: "14%", textAlign: "right" }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedLists.map((list) => {
                        const isEnded = list.status === "2";
                        const isOngoing = list.status === "1";
                        const isBusy = loadingId === list.event_id;

                        return (
                          <tr key={list.event_id || list.id}>
                            <td>
                              <div className="si-event-cell">
                                <div className="si-event-icon">
                                  <Calendar size={18} />
                                </div>
                                <div>
                                  <span
                                    className="si-event-title"
                                    dangerouslySetInnerHTML={{
                                      __html: safeMarkup(list.title || "Untitled Event"),
                                    }}
                                  />
                                  {list.b_title && (
                                    <span className="si-event-sub">
                                      {list.b_title}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td>
                              <div>
                                <div className="si-date-pill">
                                  <Clock
                                    size={13}
                                    style={{ color: "var(--ad-brand)" }}
                                  />
                                  <span>
                                    {timestampToDateTime(list.b_event_date) ||
                                      "Not set"}
                                    {Number(list.b_event_date) > 0 &&
                                      " " + tzShort(list.b_event_date)}
                                  </span>
                                </div>
                                {Number(list.b_event_date) > 0 &&
                                  canonicalTz(list.timezone || EVENT_DEFAULT_TZ) !== browserTz() && (
                                  <div
                                    style={{
                                      fontSize: "11.5px",
                                      color: "#64748b",
                                      marginTop: "3px",
                                      paddingLeft: "19px",
                                    }}
                                  >
                                    Set as{" "}
                                    {new Date(Number(list.b_event_date) * 1000).toLocaleTimeString("en-IN", {
                                      timeZone: canonicalTz(list.timezone || EVENT_DEFAULT_TZ),
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                    })}{" "}
                                    {tzShort(list.b_event_date, canonicalTz(list.timezone || EVENT_DEFAULT_TZ))}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td>
                              <span
                                style={{ fontSize: "12.5px", color: "#475569" }}
                              >
                                {timestampToDateTime(list.datetime) || "—"}
                              </span>
                            </td>

                            <td>
                              {isOngoing ? (
                                <span className="si-status-pill si-status-ongoing">
                                  <span className="si-status-dot" /> Ongoing
                                </span>
                              ) : isEnded ? (
                                <span className="si-status-pill si-status-ended">
                                  <span className="si-status-dot" /> Ended
                                </span>
                              ) : (
                                <span className="si-status-pill si-status-disabled">
                                  <span className="si-status-dot" /> Disabled
                                </span>
                              )}
                            </td>

                            <td>
                              {isBusy ? (
                                <b style={{"textAlign":"end", "display":"block"}}>
                                  Loading..
                                </b>
                              ) : (
                                <div className="si-action-btns">
                                  {/* Notifications */}
                                  <button
                                    className="si-action-btn btn-bell"
                                    title="Webinar / Event Notifications"
                                    onClick={() => {
                                      setevtinfo(
                                        list.title +
                                          " On " +
                                          timestampToDateTime(list.datetime),
                                      );
                                      setevtid(list.event_id);
                                      setMainMode("notifies");
                                    }}
                                  >
                                    <Bell size={14} />
                                  </button>

                                  {/* Edit */}
                                  {permCan("edit") && (
                                    <button
                                      className="si-action-btn btn-edit"
                                      title="Edit Event"
                                      onClick={() => updateto(list, "update")}
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                  )}

                                  {/* Duplicate */}
                                  {permCan("create") && (
                                    <button
                                      className="si-action-btn btn-copy"
                                      title="Duplicate Event"
                                      onClick={() => updateto(list, "dup")}
                                    >
                                      <Copy size={14} />
                                    </button>
                                  )}

                                  {/* End Event */}
                                  {!isEnded && permCan("end") && (
                                    <button
                                      className="si-action-btn btn-end"
                                      title="Mark as Ended"
                                      disabled={isBusy}
                                      onClick={() => endList(list)}
                                    >
                                      <CheckCircle2 size={14} />
                                    </button>
                                  )}

                                  {/* Enable / Disable */}
                                  {permCan("status") &&
                                    (isOngoing ? (
                                      <button
                                        className="si-action-btn btn-disable"
                                        title="Disable Event"
                                        disabled={isBusy}
                                        onClick={() => disableList(list)}
                                      >
                                        <AlertCircle size={14} />
                                      </button>
                                    ) : !isEnded ? (
                                      <button
                                        className="si-action-btn btn-enable"
                                        title="Enable Event"
                                        disabled={isBusy}
                                        onClick={() => enableList(list)}
                                      >
                                        <CheckCircle2 size={14} />
                                      </button>
                                    ) : null)}

                                  {/* Delete Event */}
                                  {permCan("delete") && (
                                    <button
                                      className="si-action-btn btn-delete"
                                      title="Delete Event"
                                      disabled={isBusy}
                                      onClick={() => deleteList(list)}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div
                style={{ padding: "16px 20px", borderTop: "1px solid #f1f5f9" }}
              >
                <Pagination
                  page={page}
                  total={listtotal}
                  limit={limit}
                  lastPage={lastPage}
                  onPageChange={(p: any) => {
                    setPage(p);
                    loadDetails(p, search, sort, dfrom, dto);
                  }}
                />
                <div className="saved-ago-row">
                  <SavedAgo endpoint="api/events" />
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === "add" && (
          <EventForm
            mode="add"
            form={form}
            setForm={setForm}
            learnings={learnings}
            handleLearningChange={handleLearningChange}
            addLearning={addLearning}
            removeLearning={removeLearning}
            audience={audience}
            handleAudienceChange={handleAudienceChange}
            addAudience={addAudience}
            removeAudience={removeAudience}
            timers={timers}
            handleTimerChange={handleTimerChange}
            addTimers={addTimers}
            removeTimer={removeTimer}
            onSubmit={addList}
            loading={loading}
            success={success}
            error={error}
            moveto={moveto}
            permCan={permCan}
          />
        )}

        {mode === "update" && (
          <EventForm
            mode="update"
            form={form}
            setForm={setForm}
            learnings={learnings}
            handleLearningChange={handleLearningChange}
            addLearning={addLearning}
            removeLearning={removeLearning}
            audience={audience}
            handleAudienceChange={handleAudienceChange}
            addAudience={addAudience}
            removeAudience={removeAudience}
            timers={timers}
            handleTimerChange={handleTimerChange}
            addTimers={addTimers}
            removeTimer={removeTimer}
            onSubmit={updateList}
            loading={loading}
            success={success}
            error={error}
            moveto={moveto}
            permCan={permCan}
          />
        )}
      </div>
    </>
  );

  /* ================= Components ================= */
  void EventCard;
  function EventCard({ list }: any) {
    const permCan = usePagePerm("events");

    return (
      <div className="card batch-card">
        <div className="card-body">
          <h5
            className="fw-bold mb-3"
            dangerouslySetInnerHTML={{ __html: safeMarkup(list?.title || "") }}
          ></h5>

          {/* Date */}

          <div className="info-row">
            <i className="fa fa-calendar"></i>
            <span>
              Start on {timestampToDateTime(list.b_event_date)}
              {Number(list.b_event_date) > 0 && " " + tzShort(list.b_event_date)}
            </span>
          </div>
          {/* Students */}
          <div className="info-row">
            <span>{list.b_title}</span>
          </div>

          <div className="info-rows">
            <i className="fa fa-calendar"></i>
            <span style={{ marginLeft: "10px" }}>
              Created at {timestampToDateTime(list.datetime)} -{" "}
              {list.status === "1" ? "Ongoing" : "Ended"}
            </span>

            <div
              className="btn-row"
              style={{
                float: "right",
                gridTemplateColumns: "auto",
                margin: "0",
              }}
            >
              {loadingId === list.event_id ? (
                <InlineLoader label="Requesting..." />
              ) : list.status === "2" ? (
                <button
                  className="btn btn-success btn-sm"
                  title="Update Event Details"
                >
                  <span className="btn-inner">Ended</span>
                </button>
              ) : (
                <div
                  style={{
                    gridTemplateColumns: "repeat(5, 1fr)",
                    display: "grid",
                    gap: "10px",
                  }}
                >
                  {list.status === "1" &&
                    (permCan("status") ? (
                      <button
                        className="btn btn-danger btn-sm"
                        title="Disable Event"
                        onClick={() => disableList(list)}
                      >
                        {loadingId === list.event_id
                          ? "Disabling..."
                          : "Disable"}
                      </button>
                    ) : null)}

                  {list.status === "1S" &&
                    (permCan("status") ? (
                      <button
                        className="btn btn-success btn-sm"
                        title="Enable Event"
                        disabled={loadingId === list.event_id}
                        onClick={() => enableList(list)}
                      >
                        {loadingId === list.event_id ? <ButtonLoader label="Enabling..." /> : "Enable"}
                      </button>
                    ) : null)}

                  {list.status != "2" &&
                    (permCan("end") ? (
                      <button
                        className="btn btn-success btn-sm"
                        title="End Event"
                        disabled={loadingId === list.event_id}
                        onClick={() => endList(list)}
                      >
                        {loadingId === list.event_id ? (
                          <ButtonLoader label="Ending..." />
                        ) : (
                          <i className="fa fa-check"></i>
                        )}
                      </button>
                    ) : null)}

                  {list.status != "2" &&
                    (permCan("edit") ? (
                      <button
                        className="btn btn-success btn-sm"
                        title="Update Event Details"
                        onClick={() => updateto(list, "update")}
                      >
                        <span className="btn-inner">
                          <i className="fa fa-edit"></i>
                        </span>
                      </button>
                    ) : null)}

                  {permCan("create") && (
                    <button
                      className="btn btn-success btn-sm"
                      title="Copy This Event Details to New"
                      onClick={() => updateto(list, "dup")}
                    >
                      <span className="btn-inner">
                        <i className="fa-regular fa-copy"></i>
                      </span>
                    </button>
                  )}

                  <button
                    className="btn btn-success btn-sm"
                    title="The next AI webinar or bootcamp notifies"
                    onClick={() => {
                      setevtinfo(
                        list.title +
                          " On " +
                          timestampToDateTime(list.datetime),
                      );
                      setevtid(list.event_id);
                      setMainMode("notifies");
                    }}
                  >
                    <span className="btn-inner">
                      <i className="fa-solid fa-bell"></i>
                    </span>
                  </button>

                  {permCan("delete") && (
                    <button
                      className="btn btn-danger btn-sm"
                      title="Delete Event"
                      disabled={loadingId === list.event_id}
                      onClick={() => deleteList(list)}
                    >
                      <span className="btn-inner">
                        <i className="fa fa-trash"></i>
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <hr />
        </div>
      </div>
    );
  }

  function Pagination({ page, total, limit, lastPage, onPageChange }: any) {
    if (total === 0 || lastPage <= 1) return null;

    // Calculate Showing X to Y
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    // Pagination range logic (same as PHP)
    let pagstart = 1;
    let pagend = 10;

    if (page >= 6) {
      pagstart = page - 3;
      pagend = page + 7;
    }

    if (pagend >= lastPage) {
      pagstart = lastPage - 9;
      pagend = lastPage + 1;
    }

    if (pagstart <= 0) pagstart = 1;

    const pages = [];

    for (let i = pagstart; i < pagend && i <= lastPage; i++) {
      pages.push(i);
    }

    return (
      <div className="col-md-12 pagepagination">
        {/* Info */}
        <div className="dt-start">
          <div className="dt-info" role="status">
            Showing {start} to {end} of {total} entries
          </div>
        </div>

        {/* Pagination */}
        <div className="dt-end">
          <div className="dt-paging paging_full_numbers">
            {/* Previous */}
            {page >= 2 && (
              <button
                className="dt-paging-button first"
                onClick={() => onPageChange(page - 1)}
              >
                «
              </button>
            )}

            {/* Page Numbers */}
            {pages.map((p) => (
              <button
                key={p}
                className={`dt-paging-button ${p === page ? "current" : ""}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            ))}

            {/* Next */}
            {page >= 1 && page < lastPage && (
              <button
                className="dt-paging-button last"
                onClick={() => onPageChange(page + 1)}
              >
                »
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

/* =======================================================
   Redesigned Event Form Component (Add & Update Modes)
======================================================= */
function EventForm({
  mode,
  form,
  setForm,
  learnings,
  handleLearningChange,
  addLearning,
  removeLearning,
  audience,
  handleAudienceChange,
  addAudience,
  removeAudience,
  timers,
  handleTimerChange,
  addTimers,
  removeTimer,
  onSubmit,
  loading,
  success,
  error,
  moveto,
  permCan,
}: any) {
  const isUpdate = mode === "update";

  return (
    <div className="si-form-container">
      {/* Form Header */}
      <div className="si-form-header">
        <div className="si-form-header-left">
          <button
            type="button"
            className="si-btn-back"
            onClick={() => moveto("board")}
            title="Go Back to Events Board"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <div className="si-form-icon-box">
            <Calendar size={22} />
          </div>

          <div>
            <h3 className="si-form-title">
              {isUpdate ? "Update Event" : "Create New Event"}
            </h3>
            <p className="si-form-subtitle">
              {isUpdate
                ? `Editing: ${form.title || "Untitled Event"}`
                : "Configure the webinar details, schedule, syllabus highlights, and registration timers"}
            </p>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="si-btn-cancel"
            onClick={() => moveto("board")}
          >
            Cancel
          </button>

          <button
            type="button"
            className="si-btn-submit"
            disabled={loading || !permCan(isUpdate ? "edit" : "create")}
            onClick={() => {
              const formEl = document.getElementById(
                "event-main-form",
              ) as HTMLFormElement;
              if (formEl) formEl.requestSubmit();
            }}
          >
            <Save size={16} />
            <span>
              {loading
                ? isUpdate
                  ? "Updating..."
                  : "Creating..."
                : isUpdate
                  ? "Update Event"
                  : "Create Event"}
            </span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div
          className="alert alert-success d-flex align-items-center gap-2 mb-4"
          style={{ borderRadius: 12 }}
        >
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div
          className="alert alert-danger d-flex align-items-center gap-2 mb-4"
          style={{ borderRadius: 12 }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form id="event-main-form" onSubmit={onSubmit}>
        {/* Section 1: Basic Event Information */}
        <div className="si-form-card">
          <div className="si-form-card-header">
            <div>
              <h4 className="si-form-card-title">
                <Sparkles size={18} className="text-primary" />
                <span>Basic Event Information</span>
              </h4>
              <p className="si-form-card-subtitle">
                Core headline and summary displayed across event listings and
                banners
              </p>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-md-4">
              <label className="si-label" htmlFor="head_badge">
                <span>Event Badge</span>
              </label>
              <input
                id="head_badge"
                className="si-input"
                type="text"
                placeholder="e.g. 🔥 LIVE WEBINAR or FREE MASTERCLASS"
                value={form.badge}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, badge: e.target.value }))
                }
              />
            </div>

            <div className="col-md-8">
              <label className="si-label" htmlFor="event_title">
                <span>
                  Event Title <span className="req">*</span>
                </span>
              </label>
              <input
                id="event_title"
                className="si-input"
                type="text"
                placeholder="e.g. Generative AI & Large Language Models Intensive"
                required
                value={form.title}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, title: e.target.value }))
                }
              />
            </div>

            <div className="col-md-12">
              <label className="si-label" htmlFor="event_desc">
                <span>Event Description</span>
              </label>
              <textarea
                id="event_desc"
                className="si-textarea"
                rows={3}
                placeholder="Detailed summary of the session, prerequisites, and key takeaways..."
                value={form.description}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        {/* Section 2: Box 1 — Hero Section & Schedule */}
        <div className="si-form-card">
          <div className="si-form-card-header">
            <div>
              <h4 className="si-form-card-title">
                <Layers size={18} style={{ color: "var(--ad-brand)" }} />
                <span>Hero Section & Schedule (Box 1)</span>
              </h4>
              <p className="si-form-card-subtitle">
                Main registration card, date, time, tags, and direct
                registration link
              </p>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-md-4">
              <label className="si-label" htmlFor="a_badge">
                <span>Box 1 Main Badge</span>
              </label>
              <input
                id="a_badge"
                className="si-input"
                type="text"
                placeholder="e.g. Masterclass Series"
                value={form.a_badge}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, a_badge: e.target.value }))
                }
              />
            </div>

            <div className="col-md-8">
              <label className="si-label" htmlFor="a_title">
                <span>
                  Box 1 Main Title <span className="req">*</span>
                </span>
              </label>
              <input
                id="a_title"
                className="si-input"
                type="text"
                placeholder="e.g. Deep Dive into Autonomous AI Agents"
                required
                value={form.a_title}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, a_title: e.target.value }))
                }
              />
            </div>

            <div className="col-md-12">
              <label className="si-label" htmlFor="a_desc">
                <span>Box 1 Main Description</span>
              </label>
              <textarea
                id="a_desc"
                className="si-textarea"
                rows={2}
                placeholder="Introductory overview displayed prominently in the first hero box..."
                value={form.a_description}
                onChange={(e) =>
                  setForm((f: any) => ({
                    ...f,
                    a_description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="col-md-4">
              <label className="si-label" htmlFor="b_badge">
                <span>Box 1 Sub-Badge</span>
              </label>
              <input
                id="b_badge"
                className="si-input"
                type="text"
                placeholder="e.g. Online Workshop"
                value={form.b_badge}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, b_badge: e.target.value }))
                }
              />
            </div>

            <div className="col-md-8">
              <label className="si-label" htmlFor="b_title">
                <span>
                  Box 1 Sub-Title <span className="req">*</span>
                </span>
              </label>
              <input
                id="b_title"
                className="si-input"
                type="text"
                placeholder="e.g. Build Real-world RAG Applications"
                required
                value={form.b_title}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, b_title: e.target.value }))
                }
              />
            </div>

            <div className="col-md-12">
              <label className="si-label" htmlFor="b_desc">
                <span>Box 1 Sub-Description</span>
              </label>
              <textarea
                id="b_desc"
                className="si-textarea"
                rows={2}
                placeholder="Additional notes or highlight points for Box 1..."
                value={form.b_description}
                onChange={(e) =>
                  setForm((f: any) => ({
                    ...f,
                    b_description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="col-md-3">
              <label className="si-label" htmlFor="b_event_date">
                <span>
                  Event Date <span className="req">*</span>
                </span>
              </label>
              <input
                id="b_event_date"
                className="si-input"
                type="date"
                required
                value={form.b_event_date}
                onChange={(e) =>
                  setForm((f: any) => ({
                    ...f,
                    b_event_date: e.target.value,
                  }))
                }
              />
            </div>

            <div className="col-md-3">
              <label className="si-label" htmlFor="b_event_time">
                <span>
                  Event Time <span className="req">*</span>
                </span>
              </label>
              <input
                id="b_event_time"
                className="si-input"
                type="time"
                required
                value={form.b_event_time}
                onChange={(e) =>
                  setForm((f: any) => ({
                    ...f,
                    b_event_time: e.target.value,
                  }))
                }
              />
            </div>

            <div className="col-md-6">
              <label className="si-label" htmlFor="b_tz">
                <span>
                  Time zone <span className="req">*</span>
                </span>
              </label>
              <div className="si-tz-picker">
                <Globe size={16} className="si-tz-ico" />
                <PickerSelect
                  id="b_tz"
                  value={form.timezone || browserTz()}
                  options={tzPickerOptions()}
                  onChange={(v) => setForm((f: any) => ({ ...f, timezone: v }))}
                  searchable
                  searchPlaceholder="Search a city, country or IST / EST…"
                />
              </div>
              {(() => {
                const tz = form.timezone || browserTz();
                const ts = zonedToEpoch(form.b_event_date, form.b_event_time, tz);
                return (
                  <small className="si-tz-hint">
                    The date and time are in this time zone. Website visitors see the event in their own time zone
                    {tz !== browserTz() && Number.isFinite(ts) ? (
                      <>
                        {" "}
                        — for you:{" "}
                        <b>
                          {new Date(ts * 1000).toLocaleString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}{" "}
                          {tzShort(ts)}
                        </b>
                      </>
                    ) : null}
                    .
                  </small>
                );
              })()}
            </div>

            <div className="col-md-12">
              <label className="si-label" htmlFor="b_link">
                <span>Registration Link (URL)</span>
              </label>
              <input
                id="b_link"
                className="si-input"
                type="text"
                placeholder="https://zoom.us/webinar/... or https://..."
                value={form.b_link}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, b_link: e.target.value }))
                }
              />
            </div>

            <div className="col-md-6">
              <label className="si-label" htmlFor="b_features">
                <span>
                  Features{" "}
                  <small className="text-muted">(comma-separated)</small>
                </span>
              </label>
              <input
                id="b_features"
                className="si-input"
                type="text"
                placeholder="e.g. Live Q&A, Certificate, Code Repositories"
                value={form.b_features}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, b_features: e.target.value }))
                }
              />
            </div>

            <div className="col-md-6">
              <label className="si-label" htmlFor="b_tags">
                <span>
                  Tags <small className="text-muted">(comma-separated)</small>
                </span>
              </label>
              <input
                id="b_tags"
                className="si-input"
                type="text"
                placeholder="e.g. GenAI, LLMs, Python, LangChain"
                value={form.b_tags}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, b_tags: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        {/* Section 3: Box 2 — Curriculum & Cohort Details */}
        <div className="si-form-card">
          <div className="si-form-card-header">
            <div>
              <h4 className="si-form-card-title">
                <BookOpen size={18} style={{ color: "#059669" }} />
                <span>Curriculum & Cohort Details (Box 2)</span>
              </h4>
              <p className="si-form-card-subtitle">
                Secondary highlight box with batch cohort information and
                bootcamp references
              </p>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-md-4">
              <label className="si-label" htmlFor="c_badge">
                <span>Box 2 Main Badge</span>
              </label>
              <input
                id="c_badge"
                className="si-input"
                type="text"
                placeholder="e.g. Cohort Spotlight"
                value={form.c_badge}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, c_badge: e.target.value }))
                }
              />
            </div>

            <div className="col-md-8">
              <label className="si-label" htmlFor="c_title">
                <span>Box 2 Main Title</span>
              </label>
              <input
                id="c_title"
                className="si-input"
                type="text"
                placeholder="e.g. Next Level Engineering with AI"
                value={form.c_title}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, c_title: e.target.value }))
                }
              />
            </div>

            <div className="col-md-12">
              <label className="si-label" htmlFor="c_desc">
                <span>Box 2 Main Description</span>
              </label>
              <textarea
                id="c_desc"
                className="si-textarea"
                rows={2}
                placeholder="Detailed description for the secondary highlight section..."
                value={form.c_description}
                onChange={(e) =>
                  setForm((f: any) => ({
                    ...f,
                    c_description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="col-md-4">
              <label className="si-label" htmlFor="d_badge">
                <span>Box 2 Sub-Badge</span>
              </label>
              <input
                id="d_badge"
                className="si-input"
                type="text"
                placeholder="e.g. Certification"
                value={form.d_badge}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, d_badge: e.target.value }))
                }
              />
            </div>

            <div className="col-md-8">
              <label className="si-label" htmlFor="d_title">
                <span>Box 2 Sub-Title</span>
              </label>
              <input
                id="d_title"
                className="si-input"
                type="text"
                placeholder="e.g. Full-Stack GenAI Practitioner Program"
                value={form.d_title}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, d_title: e.target.value }))
                }
              />
            </div>

            <div className="col-md-12">
              <label className="si-label" htmlFor="d_desc">
                <span>Box 2 Sub-Description</span>
              </label>
              <textarea
                id="d_desc"
                className="si-textarea"
                rows={2}
                placeholder="Additional notes for Box 2..."
                value={form.d_description}
                onChange={(e) =>
                  setForm((f: any) => ({
                    ...f,
                    d_description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="col-md-6">
              <label className="si-label" htmlFor="bootcamp">
                <span>Bootcamp Name</span>
              </label>
              <input
                id="bootcamp"
                className="si-input"
                type="text"
                placeholder="e.g. Generative AI Engineering Bootcamp"
                value={form.bootcamp}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, bootcamp: e.target.value }))
                }
              />
            </div>

            <div className="col-md-6">
              <label className="si-label" htmlFor="newbatch">
                <span>New Batch Information</span>
              </label>
              <input
                id="newbatch"
                className="si-input"
                type="text"
                placeholder="e.g. Batch starts October 15, 2026"
                value={form.newbatch}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, newbatch: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        {/* Section 4: What You'll Learn (Dynamic Learnings) */}
        <div className="si-form-card">
          <div className="si-form-card-header">
            <div>
              <h4 className="si-form-card-title">
                <GraduationCap size={18} style={{ color: "var(--ad-brand)" }} />
                <span>What Students Will Learn</span>
              </h4>
              <p className="si-form-card-subtitle">
                Key takeaway topics and learning objectives covered in this
                event
              </p>
            </div>

            <button
              type="button"
              className="si-btn-add-item"
              onClick={addLearning}
            >
              <Plus size={15} />
              <span>Add Learning</span>
            </button>
          </div>

          <div className="mb-4">
            <label className="si-label" htmlFor="learnings_title">
              <span>Section Heading Title</span>
            </label>
            <input
              id="learnings_title"
              className="si-input"
              type="text"
              placeholder="e.g. Key Skills & Concepts Covered in This Session"
              value={form.learnings_title}
              onChange={(e) =>
                setForm((f: any) => ({
                  ...f,
                  learnings_title: e.target.value,
                }))
              }
            />
          </div>

          <div className="d-flex flex-column gap-3">
            {learnings.map((item: any, index: number) => (
              <div key={item.uid} className="si-dynamic-item">
                <div className="si-dynamic-item-header">
                  <div className="d-flex align-items-center gap-2">
                    <span className="si-item-num-badge">#{index + 1}</span>
                    <span className="fw-semibold text-dark small">
                      Learning Objective
                    </span>
                  </div>

                  {learnings.length > 1 && (
                    <button
                      type="button"
                      className="si-btn-remove"
                      onClick={() => removeLearning(index)}
                      title="Remove learning"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <div className="row g-2">
                  <div className="col-md-5">
                    <input
                      className="si-input"
                      placeholder="Topic Title (e.g. Vector Databases & Embeddings)"
                      value={item.title || ""}
                      onChange={(e) =>
                        handleLearningChange(index, "title", e.target.value)
                      }
                    />
                  </div>
                  <div className="col-md-7">
                    <input
                      className="si-input"
                      placeholder="Brief description of what will be taught..."
                      value={item.description || ""}
                      onChange={(e) =>
                        handleLearningChange(
                          index,
                          "description",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 5: Target Audience */}
        <div className="si-form-card">
          <div className="si-form-card-header">
            <div>
              <h4 className="si-form-card-title">
                <Users size={18} style={{ color: "#2563eb" }} />
                <span>Target Audience</span>
              </h4>
              <p className="si-form-card-subtitle">
                Specify who will benefit most from attending this event
              </p>
            </div>

            <button
              type="button"
              className="si-btn-add-item"
              onClick={addAudience}
            >
              <Plus size={15} />
              <span>Add Audience</span>
            </button>
          </div>

          <div className="mb-4">
            <label className="si-label" htmlFor="audiences_title">
              <span>Section Heading Title</span>
            </label>
            <input
              id="audiences_title"
              className="si-input"
              type="text"
              placeholder="e.g. Who Should Attend This Masterclass"
              value={form.audiences_title}
              onChange={(e) =>
                setForm((f: any) => ({
                  ...f,
                  audiences_title: e.target.value,
                }))
              }
            />
          </div>

          <div className="d-flex flex-column gap-3">
            {audience.map((item: any, index: number) => (
              <div key={item.uid} className="si-dynamic-item">
                <div className="si-dynamic-item-header">
                  <div className="d-flex align-items-center gap-2">
                    <span className="si-item-num-badge">#{index + 1}</span>
                    <span className="fw-semibold text-dark small">
                      Audience Profile
                    </span>
                  </div>

                  {audience.length > 1 && (
                    <button
                      type="button"
                      className="si-btn-remove"
                      onClick={() => removeAudience(index)}
                      title="Remove audience"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <div className="row g-2">
                  <div className="col-md-3">
                    <input
                      className="si-input"
                      placeholder="Icon or Emoji (e.g. 💻 or fa-code)"
                      value={item.icon || ""}
                      onChange={(e) =>
                        handleAudienceChange(index, "icon", e.target.value)
                      }
                    />
                  </div>
                  <div className="col-md-4">
                    <input
                      className="si-input"
                      placeholder="Audience Title (e.g. Software Engineers)"
                      value={item.title || ""}
                      onChange={(e) =>
                        handleAudienceChange(index, "title", e.target.value)
                      }
                    />
                  </div>
                  <div className="col-md-5">
                    <input
                      className="si-input"
                      placeholder="Subtitle (e.g. Looking to transition into AI/ML)"
                      value={item.subtitle || ""}
                      onChange={(e) =>
                        handleAudienceChange(index, "subtitle", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 6: Countdown Timer & Notification Info */}
        <div className="si-form-card">
          <div className="si-form-card-header">
            <div>
              <h4 className="si-form-card-title">
                <Clock size={18} style={{ color: "#d97706" }} />
                <span>Countdown Timer & Notification Alerts</span>
              </h4>
              <p className="si-form-card-subtitle">
                Settings for the registration urgency timer and notify-me
                subscriber callout
              </p>
            </div>

            <button
              type="button"
              className="si-btn-add-item"
              onClick={addTimers}
            >
              <Plus size={15} />
              <span>Add Timer Item</span>
            </button>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <label className="si-label" htmlFor="timer_title">
                <span>
                  Timer Section Title <span className="req">*</span>
                </span>
              </label>
              <input
                id="timer_title"
                className="si-input"
                type="text"
                placeholder="e.g. Registration Closes Soon"
                required
                value={form.timer_title}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, timer_title: e.target.value }))
                }
              />
            </div>

            <div className="col-md-6">
              <label className="si-label" htmlFor="timer_desc">
                <span>Timer Description</span>
              </label>
              <input
                id="timer_desc"
                className="si-input"
                type="text"
                placeholder="e.g. Limited to 200 participants for interactive Q&A"
                value={form.timer_desc}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, timer_desc: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="d-flex flex-column gap-3 mb-4">
            {timers.map((item: any, index: number) => (
              <div key={item.uid} className="si-dynamic-item">
                <div className="si-dynamic-item-header">
                  <div className="d-flex align-items-center gap-2">
                    <span className="si-item-num-badge">#{index + 1}</span>
                    <span className="fw-semibold text-dark small">
                      Timer Highlight Item
                    </span>
                  </div>

                  {timers.length > 1 && (
                    <button
                      type="button"
                      className="si-btn-remove"
                      onClick={() => removeTimer(index)}
                      title="Remove timer item"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <div className="row g-2">
                  <div className="col-md-3">
                    <input
                      className="si-input"
                      placeholder="Icon or Emoji (e.g. ⏳ or fa-clock)"
                      value={item.icon || ""}
                      onChange={(e) =>
                        handleTimerChange(index, "icon", e.target.value)
                      }
                    />
                  </div>
                  <div className="col-md-4">
                    <input
                      className="si-input"
                      placeholder="Title (e.g. Days Remaining)"
                      value={item.title || ""}
                      onChange={(e) =>
                        handleTimerChange(index, "title", e.target.value)
                      }
                    />
                  </div>
                  <div className="col-md-5">
                    <input
                      className="si-input"
                      placeholder="Subtitle (e.g. Register before seats fill)"
                      value={item.subtitle || ""}
                      onChange={(e) =>
                        handleTimerChange(index, "subtitle", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h5 className="fw-bold text-dark fs-6 mb-3 pt-3 border-top">
            Notification Callout Banner
          </h5>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="si-label" htmlFor="note_title">
                <span>Notification Title</span>
              </label>
              <input
                id="note_title"
                className="si-input"
                type="text"
                placeholder="e.g. Can't attend live? Get recorded session links"
                value={form.note_title}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, note_title: e.target.value }))
                }
              />
            </div>

            <div className="col-md-6">
              <label className="si-label" htmlFor="note_desc">
                <span>Notification Description</span>
              </label>
              <input
                id="note_desc"
                className="si-input"
                type="text"
                placeholder="e.g. Leave your email and we'll send you recording links & code repositories"
                value={form.note_desc}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, note_desc: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="si-form-actions-footer">
          <button
            type="button"
            className="si-btn-cancel"
            onClick={() => moveto("board")}
          >
            Cancel & Return to Board
          </button>

          <button
            type="submit"
            className="si-btn-submit"
            disabled={loading || !permCan(isUpdate ? "edit" : "create")}
          >
            <Save size={16} />
            <span>
              {loading
                ? isUpdate
                  ? "Updating Event..."
                  : "Creating Event..."
                : isUpdate
                  ? "Update Event"
                  : "Create Event"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}

function EventNotifies({ setMainMode, evtinfo, evtid }: any) {
  const permCan = usePagePerm("events");

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true, // 🔥 REQUIRED
    });

    return res.data;
  };

  const Html = ({ value }: { value?: string }) => (
    <span dangerouslySetInnerHTML={{ __html: safeMarkup(value || "") }} />
  );

  const [alllists, setAllLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState("board");

  const limit = 100;
  const [listtotal, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [lastPage, setLastPage] = useState(0);

  const formatDateTime = (ts: any) => {
    if (!ts) return "";
    const num = Number(ts);
    let date: Date;
    if (!isNaN(num) && num > 0) {
      date = new Date(num < 10000000000 ? num * 1000 : num);
    } else {
      date = new Date(ts);
    }
    if (isNaN(date.getTime())) return String(ts);

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const loadDetails = async (page = 1, search = "", sort = "") => {
    setLoading(true);
    setAllLists([]);
    setPage(page);
    setSearch(search);
    setSort(sort);

    try {
      const res = await listFetch("api/event/notifies", {
          q: search,
          s: sort,
          n: page,
          id: evtid + "",
        });

      if (res.data.success) {
        setAllLists(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.lastPage);
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      alert("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const SendNotifications = async () => {
    setMode("sending");

    try {
      const security = await getSecurity();

      const res = await axios.post(
        SERVER_URL + "api/event/send-notifications",
        {
          id: evtid + "",
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        {
          withCredentials: true,
        },
      );

      if (res.data.success) {
        if (res.data?.message === "No pending emails") {
          setMode("board");
          alert("No pending emails");
        } else {
          setMode("sent");

          setTimeout(() => {
            loadDetails();
            setMode("board");
          }, 4000);
        }
      } else {
        toast.error("❌ Sending failed, please try again");
        setMode("board");
        alert("❌ Sending failed, please try again");
      }
    } catch (err) {
      setMode("board");
      alert("❌ Something went wrong");
    }
  };

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
    if (loggedIn) {
      loadDetails(page, search, sort);
    } else {
      navigate("/");
    }
  };

  useEffect(() => {
    initchecklogin();

    // ---------- Admin CSS ----------

    return () => {
      //document.body.removeChild(aosrun);
      //document.head.removeChild(maincss);
      //document.head.removeChild(adminlink);
    };
  }, []);

  return (
    <>
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />

      {/* Main Content */}
      <div className="content">
        {mode === "board" && (
          <div className="si-page-wrapper">
            {/* Header Card */}
            <div className="si-header-container">
              <div className="si-header-left">
                <div
                  className="si-header-icon-box"
                  style={{
                    background:
                      "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  }}
                >
                  <Bell size={24} />
                </div>
                <div>
                  <h3 className="si-header-title">
                    Subscribed Attendees
                    <span className="si-count-badge">{listtotal} Total</span>
                  </h3>
                  <p className="si-header-subtitle">
                    Subscribed for <Html value={evtinfo} />
                  </p>
                </div>
              </div>

              <div className="si-header-actions">
                <button
                  type="button"
                  onClick={() => setMainMode("main")}
                  className="btn btn-outline-secondary btn-sm"
                  style={{
                    borderRadius: "10px",
                    fontWeight: "600",
                    padding: "8px 14px",
                  }}
                >
                  ← Go Back
                </button>

                {permCan("notify") && (
                  <button
                    type="button"
                    onClick={() => SendNotifications()}
                    className="si-btn-primary"
                    style={{
                      background:
                        "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    }}
                  >
                    <Bell size={16} />
                    <span>Send Notifications</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Bar */}
            <div className="si-filter-bar">
              <div className="si-filter-left">
                <div className="si-select-wrap">
                  <span className="si-select-label">
                    <ArrowUpDown size={13} /> Sort:
                  </span>
                  <select
                    className="si-select"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      loadDetails(page, search, e.target.value);
                    }}
                  >
                    <option value="New">Newest First</option>
                    <option value="Old">Oldest First</option>
                  </select>
                </div>
              </div>

              <form
                className="si-search-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  loadDetails(1, search, sort);
                }}
              >
                <ListSearch
                  placeholder="Search subscribers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <button data-refresh
                  type="button"
                  className="reload-btn"
                  title="Reset & Reload"
                  onClick={() => {
                    setSearch("");
                    loadDetails(1, "", sort);
                  }}
                >
                  <RotateCw size={15} />
                </button>
              </form>
            </div>

            {/* Table Card */}
            <div className="si-table-card">
              {loading ? (
                <SkeletonTable cols={4} />
              ) : alllists.length === 0 ? (
                <div className="si-empty-box">
                  <div className="si-empty-icon">
                    <Bell size={28} />
                  </div>
                  <div className="si-empty-title">
                    {search
                      ? "No matching subscribers found"
                      : "No subscribers yet"}
                  </div>
                  <p className="si-empty-desc">
                    {search
                      ? "Try adjusting your search criteria."
                      : "No one has subscribed to notifications for this event yet."}
                  </p>
                  <button
                    className="si-btn-primary"
                    onClick={() => {
                      setSearch("");
                      loadDetails(1, "", sort);
                    }}
                  >
                    <RotateCw size={14} /> Reload
                  </button>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="si-table">
                    <thead>
                      <tr>
                        <th style={{ width: "80px" }}>#</th>
                        <th>Email Address</th>
                        <th>Subscribed On</th>
                        <th style={{ textAlign: "right" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alllists.map((list, index) => (
                        <tr key={list.id}>
                          <td style={{ fontWeight: 600, color: "#64748b" }}>
                            {(page - 1) * limit + index + 1}
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: "#0f172a" }}>
                              {list.email}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{ fontSize: "12.5px", color: "#475569" }}
                            >
                              {formatDateTime(list.datetime)}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {list.status == "1" ? (
                              <span className="si-status-pill si-status-disabled">
                                <span className="si-status-dot" /> Pending
                              </span>
                            ) : (
                              <span className="si-status-pill si-status-ongoing">
                                <span className="si-status-dot" /> Notified
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div
                style={{ padding: "16px 20px", borderTop: "1px solid #f1f5f9" }}
              >
                <Pagination
                  page={page}
                  total={listtotal}
                  limit={limit}
                  lastPage={lastPage}
                  onPageChange={(p: any) => {
                    setPage(p);
                    loadDetails(p, search, sort);
                  }}
                />
                <div className="saved-ago-row">
                  <SavedAgo endpoint="api/event/notifies" />
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === "sending" && (
          <div className="loader-facebook" style={{ marginTop: "150px" }}>
            <div className="lds-facebook">
              <div></div>
              <div></div>
              <div></div>
            </div>
            <h4>Notifications Sending Please Wait..</h4>
          </div>
        )}

        {mode === "sent" && (
          <div className="loader-facebook" style={{ marginTop: "150px" }}>
            <div className="lds-facebook" style={{ fontSize: "70px" }}>
              <i className="fa-solid fa-envelope-circle-check"></i>
            </div>
            <h4>Notifications Sent Successfully</h4>
          </div>
        )}
      </div>
    </>
  );

  function Pagination({ page, total, limit, lastPage, onPageChange }: any) {
    if (total === 0 || lastPage <= 1) return null;

    // Calculate Showing X to Y
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    // Pagination range logic (same as PHP)
    let pagstart = 1;
    let pagend = 10;

    if (page >= 6) {
      pagstart = page - 3;
      pagend = page + 7;
    }

    if (pagend >= lastPage) {
      pagstart = lastPage - 9;
      pagend = lastPage + 1;
    }

    if (pagstart <= 0) pagstart = 1;

    const pages = [];

    for (let i = pagstart; i < pagend && i <= lastPage; i++) {
      pages.push(i);
    }

    return (
      <div className="col-md-12 pagepagination">
        {/* Info */}
        <div className="dt-start">
          <div className="dt-info" role="status">
            Showing {start} to {end} of {total} entries
          </div>
        </div>

        {/* Pagination */}
        <div className="dt-end">
          <div className="dt-paging paging_full_numbers">
            {/* Previous */}
            {page >= 2 && (
              <button
                className="dt-paging-button first"
                onClick={() => onPageChange(page - 1)}
              >
                «
              </button>
            )}

            {/* Page Numbers */}
            {pages.map((p) => (
              <button
                key={p}
                className={`dt-paging-button ${p === page ? "current" : ""}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            ))}

            {/* Next */}
            {page >= 1 && page < lastPage && (
              <button
                className="dt-paging-button last"
                onClick={() => onPageChange(page + 1)}
              >
                »
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  void Icon;
  function Icon() {
    return (
      <>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7L12 2L21 7L12 12L3 7Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M3 12L12 17L21 12" stroke="currentColor" strokeWidth="2" />
          <path d="M3 17L12 22L21 17" stroke="currentColor" strokeWidth="2" />
        </svg>
      </>
    );
  }
}
