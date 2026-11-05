import { Head, SERVER_URL, AWS_UPLOADS } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import LightGallery from "lightgallery/react";
import lgThumbnail from "lightgallery/plugins/thumbnail";
import lgZoom from "lightgallery/plugins/zoom";
import lgVideo from "lightgallery/plugins/video";

// import styles
import "lightgallery/css/lightgallery.css";
import "lightgallery/css/lg-zoom.css";
import "lightgallery/css/lg-thumbnail.css";
import "lightgallery/css/lg-video.css";
import { VIDEO_THUMB, videoSlide } from "../../../utils/galleryMedia";

import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  Image as ImageIcon,
  Video,
  Play,
  Plus,
  RotateCw,
  Sparkles,
  CheckCircle2,
  GripVertical,
  ArrowUpDown,
  List,
  LayoutGrid,
  Trash2,
  Clock,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, SkeletonTable } from "../../../components/loading";

const seo = getSeoByPath("");

export default function Dashboard() {
  const permCan = usePagePerm("gallery");

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true, // 🔥 REQUIRED
    });
    return res.data;
  };

  const [loading, setLoading] = useState(true);
  const [floading, setfLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [mode, setMode] = useState("board");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const initialForm = {
    id: "",
    req_id: "",
    title: "",
    img: "",
    datetime: "",
    status: "",
  };

  const [form, setForm] = useState(initialForm);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);

  const limit = 12;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  // whole-table counts for the cards above the table (not just this page)
  const [stats, setStats] = useState<{ total: number; images: number; videos: number; active: number } | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [lastPage, setLastPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState("ALL");

  const loadDetails = async (page = 1, search = "", sort = "") => {
    setLoading(true);
    setAllLists([]);
    setPage(page);
    setSearch(search);
    setSort(sort);

    try {

      const res = await listFetch("api/galleryimgs", {
          q: search,
          s: sort,
          n: page,
        });

      if (res.data.stats) setStats(res.data.stats);
      if (res.data.success) {
        setAllLists(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.lastPage);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      alert("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const addList = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setSuccess("");
    setError("");

    if (!form.title.trim()) {
      setError("❌ Please enter image title");
      return;
    }

    if (!file) {
      setError("❌ Please select a file");
      return;
    }

    try {
      setfLoading(true);

      let gof = false;

      // 🔐 Security
      const security = await getSecurity();

      // 1️⃣ Get S3 presigned URL
      const presignRes = await axios.post(
        SERVER_URL + "api/get-upload-url",
        {
          fileName: file.name,
          fileType: file.type,
          prefix: "gallery",
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (!presignRes.data?.success) {
        const msg = presignRes.data?.message || "Failed to get upload URL";
        setError(msg);
        toast.error(msg);
        return;
      }

      const uploadUrl = presignRes.data.uploadURL || presignRes.data.uploadUrl;
      const fileKey = presignRes.data.key || presignRes.data.fileKey;

      if (!uploadUrl || !fileKey) {
        setError("Failed to obtain upload URL");
        toast.error("Failed to obtain upload URL");
        return;
      }

      // 2️⃣ Upload directly to local server / storage
      await axios.put(uploadUrl, file, {
        headers: { "Content-Type": file.type },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            setProgress(percent);
          }
        },
      });

      gof = true;

      if (gof) {
        // 3️⃣ Save metadata in DB
        const saveRes = await axios.post(
          SERVER_URL + "api/add-galleryimg",
          {
            title: form.title.trim(),
            file_key: fileKey,
            img: fileKey,
            file_type: file.type,
            type: file.type.startsWith("video") ? "video" : "image",
            key: security.key,
            token: security.token,
            aut: security.aut,
          },
          { withCredentials: true },
        );

        if (saveRes.data?.success) {
          toast.success(saveRes.data.message || "Gallery image uploaded successfully");
          setSuccess("✅ Media uploaded successfully!");
          setForm(initialForm);
          setFile(null);
          setProgress(0);
          setMode("board");
          loadDetails();
        } else {
          const msg = saveRes.data?.message || "Failed to save details";
          setError(msg);
          toast.error(msg);
        }
      }
    } catch (err: any) {
      console.error("Gallery upload error:", err);
      const msg = err?.response?.data?.message || err?.message || "Upload failed. Please try again.";
      setError(`❌ ${msg}`);
      toast.error(msg);
    } finally {
      setfLoading(false);
    }
  };

  const disableList = async (list: any) => {
    setSuccess("");
    setError("");

    const confirm = window.confirm(
      "Are you sure you want to disable '" + list.title + "' gallery item?",
    );
    if (!confirm) return;

    try {
      setLoadingId(list.req_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/disable-galleryimg",
        {
          id: list.req_id,
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
            b.req_id === list.req_id ? { ...b, status: "1S" } : b,
          ),
        );
      } else {
        toast.error(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const enableList = async (list: any) => {
    setSuccess("");
    setError("");

    const confirm = window.confirm(
      "Are you sure you want to enable '" + list.title + "' gallery item?",
    );
    if (!confirm) return;

    try {
      setLoadingId(list.req_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/enable-galleryimg",
        {
          id: list.req_id,
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
            b.req_id === list.req_id ? { ...b, status: "1" } : b,
          ),
        );
      } else {
        toast.error(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const deleteList = async (list: any) => {
    setSuccess("");
    setError("");

    const confirm = window.confirm(
      "Are you sure you want to delete '" + list.title + "' gallery item?",
    );
    if (!confirm) return;

    try {
      setLoadingId(list.req_id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/delete-galleryimg",
        {
          id: list.req_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists((prev) => prev.filter((b) => b.req_id !== list.req_id));
        setTotal((prev) => Math.max(0, prev - 1));
      } else {
        toast.error(res.data.message);
      }
    } catch {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const navigate = useNavigate();

  const checklogin = async () => {
    const res = await axios.get(SERVER_URL + "api/check-login", {
      withCredentials: true,
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

  useEffect(() => {
    initchecklogin();
  }, []);

  /* ================================
     Drag End & Save Order
  =================================*/
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = alllists.findIndex((i) => i.req_id === active.id);
    const newIndex = alllists.findIndex((i) => i.req_id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const newList = arrayMove(alllists, oldIndex, newIndex);
    setAllLists(newList);
    saveOrder(newList);
  };

  const saveOrder = async (list: any) => {
    try {
      const security = await getSecurity();
      await axios.post(
        SERVER_URL + "api/update-gallery-order",
        {
          items: list.map((i: any, index: any) => ({
            req_id: i.req_id,
            order: index + 1,
          })),
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
    } catch (err) {
      console.log(err);
    }
  };

  const totalCount = stats ? stats.total : listtotal || alllists.length;
  const imageCount = stats
    ? stats.images
    : alllists.filter((i) => i.type !== "video").length;
  const videoCount = stats
    ? stats.videos
    : alllists.filter((i) => i.type === "video").length;
  const activeCount = stats
    ? stats.active
    : alllists.filter((i) => i.status === "1").length;

  const canReorder =
    permCan("reorder") && typeFilter === "ALL" && !search.trim();

  const displayedLists = alllists.filter((item) => {
    if (typeFilter === "image" && item.type === "video") return false;
    if (typeFilter === "video" && item.type !== "video") return false;
    return true;
  });

  const formatDateTime = (ts: any) => {
    if (!ts) return "—";
    const num = Number(ts);
    let date: Date;
    if (!isNaN(num) && num > 0) {
      date = new Date(num < 10000000000 ? num * 1000 : num);
    } else {
      date = new Date(ts);
    }
    if (isNaN(date.getTime())) return String(ts);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <>
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />
      <ToastContainer position="top-right" autoClose={2500} />

      <style>{`
        .si-page-wrapper {
        width:100%;
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
          background: #ede9fe;
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
        .si-view-toggles {
          display: inline-flex;
          align-items: center;
          background: #f1f5f9;
          padding: 3px;
          border-radius: 10px;
          gap: 2px;
        }
        .si-view-btn {
          border: none;
          background: transparent;
          padding: 6px 12px;
          font-size: 12.5px;
          font-weight: 600;
          color: #64748b;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-view-btn.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
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
          background: #ede9fe;
          color: var(--ad-brand);
          border-color: #ddd6fe;
        }

        /* Modern Container Card */
        .si-content-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }
        .si-drag-hint {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          color: #64748b;
          background: #f8fafc;
          padding: 12px 18px;
          border-bottom: 1px solid #e2e8f0;
        }

        /* Modern Table List View */
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
          padding: 14px 18px;
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
        .si-media-thumb-cell {
          width: 64px;
          height: 48px;
          border-radius: 8px;
          overflow: hidden;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .si-thumb-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.2s ease;
        }
        .si-thumb-img:hover {
          transform: scale(1.08);
        }
        .si-media-thumb-cell .lg-react-element,
        .si-video-link {
          display: block;
          width: 100%;
          height: 100%;
        }
        .si-video-link {
          position: relative;
          cursor: pointer;
          background: #0f172a;
        }
        .si-video-link video {
          pointer-events: none;
        }
        .si-video-play {
          position: absolute;
          inset: 0;
          margin: auto;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          padding-left: 2px;
          color: #ffffff;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.7);
          pointer-events: none;
        }
        .si-table-title {
          font-weight: 700;
          color: #0f172a;
          font-size: 14px;
          margin-bottom: 2px;
        }
        .si-table-subtitle {
          font-size: 12px;
          color: #64748b;
          font-family: monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 320px;
        }
        .si-type-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11.5px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 6px;
        }
        .si-type-pill.pill-image {
          background: #ede9fe;
          color: var(--ad-brand);
        }
        .si-type-pill.pill-video {
          background: #fee2e2;
          color: #dc2626;
        }
        .si-date-cell {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          color: #475569;
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
        .si-status-pill.si-status-active {
          background: #dcfce7;
          color: #15803d;
        }
        .si-status-pill.si-status-disabled {
          background: #f1f5f9;
          color: #64748b;
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
          gap: 8px;
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
        .si-action-btn.btn-del:hover {
          background: #fee2e2;
          color: #dc2626;
          border-color: #fecaca;
        }

        /* Modern Grid View */
        .si-grid-wrap {
          padding: 24px;
        }
        .si-media-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
          gap: 20px;
        }
        .si-grid-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          display: flex;
          flex-direction: column;
        }
        .si-grid-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          border-color: #cbd5e1;
        }
        .si-grid-thumb-wrap {
          position: relative;
          height: 180px;
          background: #0f172a;
          overflow: hidden;
        }
        .si-grid-media {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .si-grid-media-link {
          display: block;
          width: 100%;
          height: 100%;
        }
        .si-grid-grip {
          position: absolute;
          top: 10px;
          left: 10px;
          width: 28px;
          height: 28px;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(4px);
          color: #ffffff;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
          z-index: 2;
        }
        .si-grid-badge {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(4px);
          color: #ffffff;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          z-index: 2;
        }
        .si-grid-badge.badge-video {
          background: rgba(220, 38, 38, 0.85);
        }
        .si-grid-badge.badge-image {
          background: rgba(var(--ad-brand-rgb), 0.85);
        }
        .si-grid-card-body {
          padding: 14px 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .si-grid-title {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 6px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .si-grid-meta {
          font-size: 12px;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 12px;
        }
        .si-grid-footer {
          border-top: 1px solid #f1f5f9;
          padding-top: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
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
      `}</style>

      {/* Main Content */}
      <div className="content">
        <div className="si-page-wrapper">
          {/* Header Card */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <ImageIcon size={24} />
              </div>
              <div>
                <h3 className="si-header-title">
                  Gallery Media
                  <span className="si-count-badge">{totalCount} Total</span>
                </h3>
                <p className="si-header-subtitle">
                  Manage campus photos, workshop snapshots and event gallery
                  media
                </p>
              </div>
            </div>

            <div className="si-header-actions">
              {permCan("create") && (
                <button
                  onClick={() => setMode("add")}
                  className="si-btn-primary"
                >
                  <Plus size={16} />
                  <span>Upload New Media</span>
                </button>
              )}
            </div>
          </div>

          {/* 4 Stat Cards */}
          <div className="si-stats-grid">
            <div
              className={`si-stat-card ${typeFilter === "ALL" ? "active" : ""}`}
              onClick={() => setTypeFilter("ALL")}
            >
              <div>
                <div className="si-stat-label">Total Media</div>
                <div className="si-stat-value"><AnimatedNumber value={totalCount} pending={loading} id="Gallery-s1" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-purple">
                <ImageIcon size={22} />
              </div>
            </div>

            <div
              className={`si-stat-card ${typeFilter === "image" ? "active" : ""}`}
              onClick={() => setTypeFilter("image")}
            >
              <div>
                <div className="si-stat-label">Images</div>
                <div className="si-stat-value"><AnimatedNumber value={imageCount} pending={loading} id="Gallery-s2" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-blue">
                <Sparkles size={22} />
              </div>
            </div>

            <div
              className={`si-stat-card ${typeFilter === "video" ? "active" : ""}`}
              onClick={() => setTypeFilter("video")}
            >
              <div>
                <div className="si-stat-label">Videos</div>
                <div className="si-stat-value"><AnimatedNumber value={videoCount} pending={loading} id="Gallery-s3" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-amber">
                <Video size={22} />
              </div>
            </div>

            <div className="si-stat-card" onClick={() => setTypeFilter("ALL")}>
              <div>
                <div className="si-stat-label">Active</div>
                <div className="si-stat-value"><AnimatedNumber value={activeCount} pending={loading} id="Gallery-s4" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-green">
                <CheckCircle2 size={22} />
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
                    loadDetails(page, search, e.target.value);
                  }}
                >
                  <option value="New">Newest First</option>
                  <option value="Old">Oldest First</option>
                </select>
              </div>

              <div className="si-select-wrap">
                <span className="si-select-label">Filter:</span>
                <select
                  className="si-select"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="ALL">All Media</option>
                  <option value="image">Images Only</option>
                  <option value="video">Videos Only</option>
                </select>
              </div>

              <div className="si-view-toggles">
                <button
                  type="button"
                  className={`si-view-btn ${viewMode === "list" ? "active" : ""}`}
                  onClick={() => setViewMode("list")}
                  title="Table List View"
                >
                  <List size={15} />
                  <span>List</span>
                </button>
                <button
                  type="button"
                  className={`si-view-btn ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Cards Grid View"
                >
                  <LayoutGrid size={15} />
                  <span>Grid</span>
                </button>
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
                placeholder="Search gallery media..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button data-refresh
                type="button"
                className="reload-btn"
                title="Reset & Reload"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("ALL");
                  loadDetails(1, "", sort);
                }}
              >
                <RotateCw size={15} />
              </button>
            </form>
          </div>

          {/* Gallery Content Card */}
          <div className="si-content-card">
            <div className="si-drag-hint">
              <GripVertical size={16} />
              <span>
                {canReorder
                  ? "Drag items using the handle (⋮⋮) to reorder how they appear in the website gallery. Order is saved automatically."
                  : "Drag-and-drop reordering is enabled when viewing all media with no search query."}
              </span>
            </div>

            {loading ? (
              <SkeletonTable cols={7} />
            ) : displayedLists.length === 0 ? (
              <div className="si-empty-box">
                <div className="si-empty-icon">
                  <ImageIcon size={28} />
                </div>
                <h4 className="si-empty-title">
                  {search
                    ? "No matching media found"
                    : "No gallery media available"}
                </h4>
                <p className="si-empty-desc">
                  {search
                    ? "Try searching for a different keyword or adjusting your filter."
                    : "No media records found in the gallery. Click 'Upload New Media' to add one."}
                </p>
                {permCan("create") && (
                  <button
                    type="button"
                    className="si-btn-primary mx-auto"
                    onClick={() => setMode("add")}
                  >
                    <Plus size={15} /> Upload Media
                  </button>
                )}
              </div>
            ) : (
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={canReorder ? handleDragEnd : undefined}
              >
                <SortableContext
                  items={displayedLists.map((i) => i.req_id)}
                  strategy={
                    viewMode === "list"
                      ? verticalListSortingStrategy
                      : rectSortingStrategy
                  }
                >
                  {viewMode === "list" ? (
                    <div className="table-responsive">
                      <table className="si-table">
                        <thead>
                          <tr>
                            <th style={{ width: "40px" }}></th>
                            <th style={{ width: "90px" }}>Media</th>
                            <th>Title & Details</th>
                            <th style={{ width: "120px" }}>Type</th>
                            <th style={{ width: "160px" }}>Date Added</th>
                            <th style={{ width: "110px" }}>Status</th>
                            <th style={{ width: "140px", textAlign: "right" }}>
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedLists.map((list) => (
                            <SortableTableRow
                              key={list.req_id}
                              list={list}
                              permCan={permCan}
                              loadingId={loadingId}
                              enableList={enableList}
                              disableList={disableList}
                              deleteList={deleteList}
                              canReorder={canReorder}
                              formatDateTime={formatDateTime}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="si-grid-wrap">
                      <div className="si-media-grid">
                        {displayedLists.map((list) => (
                          <SortableGridCard
                            key={list.req_id}
                            list={list}
                            permCan={permCan}
                            loadingId={loadingId}
                            enableList={enableList}
                            disableList={disableList}
                            deleteList={deleteList}
                            canReorder={canReorder}
                            formatDateTime={formatDateTime}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </SortableContext>
              </DndContext>
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
                <SavedAgo endpoint="api/galleryimgs" />
              </div>
            </div>
          </div>
        </div>

        {/* Add / Upload Modal */}
        {mode === "add" && (
          <div
            className="modal fade show d-block"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            onClick={() => setMode("")}
          >
            <div
              className="modal-dialog modal-dialog-centered"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="modal-content"
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  className="modal-header"
                  style={{
                    background: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <h5
                    className="modal-title fw-bold d-flex align-items-center gap-2"
                    style={{ color: "#0f172a" }}
                  >
                    <ImageIcon size={20} className="text-primary" />
                    <span>Upload Gallery Media</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setMode("")}
                  ></button>
                </div>

                <div className="modal-body p-4">
                  {permCan("create") && (
                    <form onSubmit={addList}>
                      <div className="form-group mb-3">
                        <label className="form-label fw-semibold text-secondary small">
                          Image / Media Title: *
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. AI Innovation Summit 2026"
                          required
                          value={form.title}
                          onChange={(e) =>
                            setForm({ ...form, title: e.target.value })
                          }
                        />
                      </div>

                      <div className="form-group mb-3">
                        <label className="form-label fw-semibold text-secondary small">
                          Select File (Image / Video): *
                        </label>
                        <input
                          type="file"
                          className="form-control"
                          required
                          accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm"
                          onChange={(e: any) => {
                            const selectedFile = e.target.files?.[0] || null;
                            setFile(selectedFile);
                            setProgress(0);
                          }}
                        />
                      </div>

                      {file && (
                        <div className="alert alert-info py-2 px-3 small mb-3">
                          Selected: <b>{file.name}</b> (
                          {(file.size / (1024 * 1024)).toFixed(2)} MB)
                        </div>
                      )}

                      {progress > 0 && progress < 100 && (
                        <div
                          className="progress mb-3"
                          style={{ height: "8px" }}
                        >
                          <div
                            className="progress-bar progress-bar-striped progress-bar-animated bg-primary"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}

                      {success && (
                        <div className="alert alert-success py-2 px-3 small mb-3">
                          {success}
                        </div>
                      )}
                      {error && (
                        <div className="alert alert-danger py-2 px-3 small mb-3">
                          {error}
                        </div>
                      )}

                      <div className="d-flex gap-2 justify-content-end mt-4">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setMode("")}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary px-4 fw-semibold"
                          disabled={floading}
                        >
                          {floading ? <ButtonLoader label="Uploading..." /> : "Upload Media"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  /* ================= Components ================= */
  function Pagination({ page, total, limit, lastPage, onPageChange }: any) {
    if (total === 0 || lastPage <= 1) return null;

    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

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
        <div className="dt-start">
          <div className="dt-info" role="status">
            Showing {start} to {end} of {total} entries
          </div>
        </div>

        <div className="dt-end">
          <div className="dt-paging paging_full_numbers">
            {page >= 2 && (
              <button
                className="dt-paging-button first"
                onClick={() => onPageChange(page - 1)}
              >
                «
              </button>
            )}

            {pages.map((p) => (
              <button
                key={p}
                className={`dt-paging-button ${p === page ? "current" : ""}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            ))}

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

/* ==============================================
   Sortable Table Row (List View)
============================================== */
function SortableTableRow({
  list,
  permCan,
  loadingId,
  enableList,
  disableList,
  deleteList,
  canReorder,
  formatDateTime,
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: list.req_id,
  });
  const isVideo = list.type === "video";
  const isActive = list.status === "1";
  const isBusy = loadingId === list.req_id;

  const style: any = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: isDragging ? "#f8fafc" : undefined,
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td>
        {canReorder ? (
          <span
            {...attributes}
            {...listeners}
            className="si-table-grip"
            title="Drag to reorder"
            style={{
              cursor: "grab",
              color: "#94a3b8",
              display: "inline-flex",
              padding: 4,
            }}
          >
            <GripVertical size={16} />
          </span>
        ) : (
          <span
            style={{ color: "#cbd5e1", display: "inline-flex", padding: 4 }}
          >
            <GripVertical size={16} />
          </span>
        )}
      </td>

      <td>
        <div className="si-media-thumb-cell">
          {isVideo ? (
            /* First frame as the thumbnail; click opens the player, like images */
            <LightGallery speed={500} plugins={[lgThumbnail, lgVideo]} exThumbImage="data-thumb">
              <a
                className="si-gallery-link si-video-link"
                data-lg-size="1280-720"
                data-thumb={VIDEO_THUMB}
                data-video={videoSlide(AWS_UPLOADS + list.img, list.img)}
                aria-label="Play video"
              >
                <video
                  src={AWS_UPLOADS + list.img + "#t=0.5"}
                  muted
                  playsInline
                  preload="metadata"
                  className="si-thumb-img"
                />
                <span className="si-video-play">
                  <Play size={12} fill="currentColor" />
                </span>
              </a>
            </LightGallery>
          ) : (
            <LightGallery speed={500} plugins={[lgThumbnail, lgZoom]}>
              <a href={AWS_UPLOADS + list.img} className="si-gallery-link">
                <img
                  src={AWS_UPLOADS + list.img}
                  alt={list.title}
                  className="si-thumb-img"
                />
              </a>
            </LightGallery>
          )}
        </div>
      </td>

      <td>
        <div style={{ maxWidth: 360 }}>
          <div className="si-table-title" title={list.title}>
            {list.title || "Untitled Media"}
          </div>
          <div className="si-table-subtitle" title={list.img}>
            {list.img}
          </div>
        </div>
      </td>

      <td>
        {isVideo ? (
          <span className="si-type-pill pill-video">
            <Video size={12} /> Video
          </span>
        ) : (
          <span className="si-type-pill pill-image">
            <ImageIcon size={12} /> Image
          </span>
        )}
      </td>

      <td>
        <div className="si-date-cell">
          <Clock size={13} className="text-muted" />
          <span>{formatDateTime(list.datetime)}</span>
        </div>
      </td>

      <td>
        {isActive ? (
          <span className="si-status-pill si-status-active">
            <span className="si-status-dot" /> Active
          </span>
        ) : (
          <span className="si-status-pill si-status-disabled">
            <span className="si-status-dot" /> Disabled
          </span>
        )}
      </td>

      <td>
        <div className="si-action-btns">
          {permCan("status") && (
            <div
              className="form-check form-switch m-0"
              title={isActive ? "Disable media" : "Enable media"}
            >
              <input
                className="form-check-input"
                type="checkbox"
                checked={isActive}
                disabled={isBusy}
                onChange={() =>
                  isActive ? disableList(list) : enableList(list)
                }
                style={{ cursor: "pointer" }}
              />
            </div>
          )}

          {permCan("delete") && (
            <button
              type="button"
              className="si-action-btn btn-del"
              disabled={isBusy}
              onClick={() => deleteList(list)}
              title="Delete Media"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ==============================================
   Sortable Grid Card (Grid View)
============================================== */
function SortableGridCard({
  list,
  permCan,
  loadingId,
  enableList,
  disableList,
  deleteList,
  canReorder,
  formatDateTime,
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: list.req_id,
  });
  const isVideo = list.type === "video";
  const isActive = list.status === "1";
  const isBusy = loadingId === list.req_id;

  const style: any = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="si-grid-card">
      <div className="si-grid-thumb-wrap">
        {canReorder ? (
          <div
            {...attributes}
            {...listeners}
            className="si-grid-grip"
            title="Drag to reorder"
          >
            <GripVertical size={16} />
          </div>
        ) : null}

        <div
          className={`si-grid-badge ${isVideo ? "badge-video" : "badge-image"}`}
        >
          {isVideo ? <Video size={12} /> : <ImageIcon size={12} />}
          <span>{isVideo ? "Video" : "Image"}</span>
        </div>

        {isVideo ? (
          <video
            src={AWS_UPLOADS + list.img}
            controls
            preload="metadata"
            className="si-grid-media"
          />
        ) : (
          <LightGallery speed={500} plugins={[lgThumbnail, lgZoom]}>
            <a href={AWS_UPLOADS + list.img} className="si-grid-media-link">
              <img
                src={AWS_UPLOADS + list.img}
                alt={list.title}
                className="si-grid-media"
              />
            </a>
          </LightGallery>
        )}
      </div>

      <div className="si-grid-card-body">
        <h4 className="si-grid-title" title={list.title}>
          {list.title || "Untitled Media"}
        </h4>

        <div className="si-grid-meta">
          <Clock size={12} className="text-muted" />
          <span>{formatDateTime(list.datetime)}</span>
        </div>

        <div className="si-grid-footer">
          <div>
            {isActive ? (
              <span className="si-status-pill si-status-active">
                <span className="si-status-dot" /> Active
              </span>
            ) : (
              <span className="si-status-pill si-status-disabled">
                <span className="si-status-dot" /> Disabled
              </span>
            )}
          </div>

          <div className="si-action-btns">
            {permCan("status") && (
              <div
                className="form-check form-switch m-0"
                title={isActive ? "Disable media" : "Enable media"}
              >
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={isActive}
                  disabled={isBusy}
                  onChange={() =>
                    isActive ? disableList(list) : enableList(list)
                  }
                  style={{ cursor: "pointer" }}
                />
              </div>
            )}

            {permCan("delete") && (
              <button
                type="button"
                className="si-action-btn btn-del"
                disabled={isBusy}
                onClick={() => deleteList(list)}
                title="Delete Media"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
