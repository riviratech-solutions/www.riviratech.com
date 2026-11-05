import { SERVER_URL, AWS_UPLOADS } from "../../../components/Includes";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState } from "react";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Image as ImageIcon,
  Plus,
  RotateCw,
  Sparkles,
  CheckCircle2,
  Layers,
  LayoutGrid,
  List,
  Copy,
  Trash2,
  ExternalLink,
  ArrowUpDown,
  FileImage,
} from "lucide-react";

import LightGallery from "lightgallery/react";
import lgThumbnail from "lightgallery/plugins/thumbnail";
import lgZoom from "lightgallery/plugins/zoom";

// import styles
import "lightgallery/css/lightgallery.css";
import "lightgallery/css/lg-zoom.css";
import "lightgallery/css/lg-thumbnail.css";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, SkeletonTable } from "../../../components/loading";

export default function Dashboard() {
  const navigate = useNavigate();

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };

  const [loading, setLoading] = useState(true);
  const [floading, setfLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [mode, setMode] = useState("board");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");

  const [progress, setProgress] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string; key: string }[]>([]);

  const limit = 12;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  // whole-table counts for the cards above the table (not just this page)
  const [stats, setStats] = useState<{ total: number; files: number } | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [lastPage, setLastPage] = useState(0);
  const [deletingId, setDeletingId] = useState<any>(null);

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
    if (loggedIn && (ustatus === "X" || ustatus === "Y")) {
      loadDetails(1, "", "New");
    } else {
      navigate("/logout");
    }
  };

  useEffect(() => {
    const urls = files.map((file) => ({
      url: URL.createObjectURL(file),
      key: `${file.name}-${file.lastModified}-${file.size}`,
    }));
    setPreviews(urls);
    return () => {
      urls.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [files]);

  const loadDetails = async (pageArg = 1, searchArg = "", sortArg = "New") => {
    setLoading(true);
    setAllLists([]);
    setPage(pageArg);
    setSearch(searchArg);
    setSort(sortArg);

    try {

      const res = await listFetch("api/blogimgs", {
          q: searchArg,
          s: sortArg,
          n: pageArg,
        });

      if (res.data.stats) setStats(res.data.stats);
      if (res.data.success) {
        setAllLists(res.data.data || []);
        setTotal(res.data.total || 0);
        setLastPage(res.data.lastPage || 1);
      } else {
        toast.error(res.data.message);
      }
    } catch {
      toast.error("❌ Something went wrong loading blog images");
    } finally {
      setLoading(false);
    }
  };

  const addList = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccess("");
    setError("");

    if (files.length === 0) {
      setError("❌ Please select images");
      return;
    }

    try {
      setfLoading(true);
      const security = await getSecurity();

      /* 1️⃣ Get presigned URLs */
      const fileData = files.map((file) => ({
        fileName: file.name,
        fileType: file.type,
      }));

      const presignRes = await axios.post(
        SERVER_URL + "api/get-upload-urls",
        {
          files: fileData,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (!presignRes.data.success) {
        setError("Upload URL generation failed");
        return;
      }

      const uploadList = presignRes.data.files;
      const uploadedKeys: string[] = [];

      /* 2️⃣ Upload files to S3 */
      for (let i = 0; i < uploadList.length; i++) {
        await axios.put(uploadList[i].uploadURL, files[i], {
          headers: { "Content-Type": files[i].type },
          onUploadProgress: (eProgress) => {
            if (!eProgress.total) return;
            const percent = Math.round((eProgress.loaded * 100) / eProgress.total);
            setProgress(percent);
          },
        });

        uploadedKeys.push(uploadList[i].key);
      }

      /* 3️⃣ Send ONE request to backend */
      const res = await axios.post(
        SERVER_URL + "api/add-blogimgs",
        {
          file_keys: uploadedKeys,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setSuccess(res.data.message);
        setFiles([]);
        setProgress(0);
        setMode("board");
        loadDetails(1, search, sort);
      } else {
        setError(res.data.message);
        toast.error(res.data.message);
      }
    } catch (err) {
      console.error(err);
      setError("❌ Upload failed");
    } finally {
      setfLoading(false);
    }
  };

  const deleteList = async (list: any) => {
    setSuccess("");
    setError("");

    const confirm = window.confirm(
      "Are you sure you want to delete this blog image?"
    );
    if (!confirm) return;

    try {
      setDeletingId(list.id);
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/delete-blogimg",
        {
          id: list.id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        toast.success(res.data.message || "Image deleted successfully");
        setAllLists((prev) => prev.filter((b) => b.id !== list.id));
        setTotal((prev) => Math.max(0, prev - 1));
      } else {
        toast.error(res.data.message || "Failed to delete image");
      }
    } catch {
      toast.error("❌ Something went wrong while deleting");
    } finally {
      setDeletingId(null);
    }
  };

  const copyUrl = (filePath: string) => {
    const fullUrl = AWS_UPLOADS + filePath;
    navigator.clipboard.writeText(fullUrl);
    toast.success("Image URL copied to clipboard!");
  };

  const getFileName = (path: string) => {
    if (!path) return "blog-image";
    const name = path.split("/").pop() || path;
    const dash = name.indexOf("-");
    return dash > 10 && dash < 45 ? name.slice(dash + 1) : name;
  };

  const getExt = (path: string) => (path?.split(".").pop() || "IMG").toUpperCase();

  useEffect(() => {
    initchecklogin();
  }, []);

  const totalCount = stats ? stats.total : listtotal || alllists.length;
  const s3Count = stats
    ? stats.files
    : alllists.filter((i) => Boolean(i.file)).length;
  const pageItemsCount = alllists.length;

  return (
    <>
      <ToastContainer position="top-right" autoClose={2000} />

      <style>{`
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
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.25);
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
          background: #e0f2fe;
          color: #0369a1;
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
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          color: #ffffff !important;
          font-size: 13.5px;
          font-weight: 600;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2);
          text-decoration: none;
        }
        .si-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(14, 165, 233, 0.3);
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
          user-select: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .si-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
        }
        .si-stat-card.active {
          box-shadow: 0 0 0 2px #0ea5e9, 0 6px 16px rgba(14, 165, 233, 0.15);
          border-color: #0ea5e9;
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
        .si-stat-blue   { background: #eff6ff; color: #0284c7; }
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
          border-color: #0ea5e9;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
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
          background: #e0f2fe;
          color: #0284c7;
          border-color: #bae6fd;
        }

        /* Modern Container Card */
        .si-content-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          overflow: hidden;
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
          width: 68px;
          height: 50px;
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
        .si-table-title {
          font-weight: 700;
          color: #0f172a;
          font-size: 13.5px;
          margin-bottom: 2px;
          word-break: break-all;
        }
        .si-table-subtitle {
          font-size: 11.5px;
          color: #64748b;
          font-family: monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 380px;
        }
        .si-type-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11.5px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 6px;
          background: #e0f2fe;
          color: #0284c7;
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
          text-decoration: none;
        }
        .si-action-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #cbd5e1;
        }
        .si-action-btn.btn-copy:hover {
          background: #ecfdf5;
          color: #059669;
          border-color: #a7f3d0;
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
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
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
        .si-grid-badge.badge-image {
          background: rgba(14, 165, 233, 0.85);
        }
        .si-grid-card-body {
          padding: 14px 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .si-grid-title {
          font-size: 13.5px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 4px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .si-grid-path {
          font-size: 11.5px;
          color: #64748b;
          font-family: monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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

      <div className="si-page-wrapper">
        {/* Header Card */}
        <div className="si-header-container">
          <div className="si-header-left">
            <div className="si-header-icon-box">
              <ImageIcon size={24} />
            </div>
            <div>
              <h3 className="si-header-title">
                Blog Images & Assets
                <span className="si-count-badge">
                  {totalCount} Total
                </span>
              </h3>
              <p className="si-header-subtitle">
                Manage, browse, copy URLs, and upload images for blog articles
              </p>
            </div>
          </div>

          <div className="si-header-actions">
            <button
              type="button"
              onClick={() => {
                setSuccess("");
                setError("");
                setMode("add");
              }}
              className="si-btn-primary"
            >
              <Plus size={16} />
              <span>Upload New Images</span>
            </button>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="si-stats-grid">
          <div className="si-stat-card active">
            <div>
              <div className="si-stat-label">Total Assets</div>
              <div className="si-stat-value"><AnimatedNumber value={totalCount} pending={loading} id="Blogimgs-s1" /></div>
            </div>
            <div className="si-stat-icon-wrap si-stat-purple">
              <ImageIcon size={22} />
            </div>
          </div>

          <div className="si-stat-card">
            <div>
              <div className="si-stat-label">Active Media</div>
              <div className="si-stat-value"><AnimatedNumber value={totalCount} pending={loading} id="Blogimgs-s2" /></div>
            </div>
            <div className="si-stat-icon-wrap si-stat-green">
              <CheckCircle2 size={22} />
            </div>
          </div>

          <div className="si-stat-card">
            <div>
              <div className="si-stat-label">S3 Cloud Files</div>
              <div className="si-stat-value"><AnimatedNumber value={s3Count} pending={loading} id="Blogimgs-s3" /></div>
            </div>
            <div className="si-stat-icon-wrap si-stat-blue">
              <Sparkles size={22} />
            </div>
          </div>

          <div className="si-stat-card">
            <div>
              <div className="si-stat-label">Page Count</div>
              <div className="si-stat-value"><AnimatedNumber value={pageItemsCount} pending={loading} id="Blogimgs-s4" /></div>
            </div>
            <div className="si-stat-icon-wrap si-stat-amber">
              <Layers size={22} />
            </div>
          </div>
        </div>

        {/* Filter Bar with View Mode Switcher */}
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
                  const newSort = e.target.value;
                  setSort(newSort);
                  loadDetails(1, search, newSort);
                }}
              >
                <option value="New">Newest First</option>
                <option value="Old">Oldest First</option>
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
              placeholder="Search blog images..."
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

        {/* Content Card (List or Grid View) */}
        <div className="si-content-card">
          {loading ? (
            <SkeletonTable cols={5} />
          ) : alllists.length === 0 ? (
            <div className="si-empty-box">
              <div className="si-empty-icon">
                <ImageIcon size={28} />
              </div>
              <h4 className="si-empty-title">
                {search ? "No matching blog images found" : "No blog images yet"}
              </h4>
              <p className="si-empty-desc">
                {search
                  ? "Try searching for a different image filename or keyword."
                  : "We couldn’t find any blog images. Click upload to add new media."}
              </p>
              <button
                type="button"
                className="si-btn-primary mx-auto"
                onClick={() => {
                  setSearch("");
                  loadDetails(1, "", "New");
                }}
              >
                <RotateCw size={14} /> Reload
              </button>
            </div>
          ) : viewMode === "list" ? (
            /* Modern Table List View */
            <div className="table-responsive">
              <table className="si-table">
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>S.No</th>
                    <th style={{ width: "90px" }}>Thumbnail</th>
                    <th>Filename & Cloud Path</th>
                    <th style={{ width: "120px" }}>Format</th>
                    <th style={{ width: "150px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {alllists.map((list, idx) => {
                    const sNo = (page - 1) * limit + idx + 1;
                    const fileName = getFileName(list.file);
                    const ext = getExt(list.file);
                    const isBusy = deletingId === list.id;
                    const fileUrl = AWS_UPLOADS + list.file;

                    return (
                      <tr key={list.id || idx}>
                        <td style={{ color: "#64748b", fontWeight: 600 }}>#{sNo}</td>
                        <td>
                          <div className="si-media-thumb-cell">
                            <LightGallery speed={500} plugins={[lgThumbnail, lgZoom]}>
                              <a href={fileUrl} className="si-gallery-link">
                                <img
                                  src={fileUrl}
                                  alt={fileName}
                                  className="si-thumb-img"
                                />
                              </a>
                            </LightGallery>
                          </div>
                        </td>
                        <td>
                          <div style={{ maxWidth: 420 }}>
                            <div className="si-table-title" title={fileName}>
                              {fileName}
                            </div>
                            <div className="si-table-subtitle" title={list.file}>
                              {list.file}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="si-type-pill">
                            <FileImage size={12} /> {ext}
                          </span>
                        </td>
                        <td>
                          <div className="si-action-btns">
                            <button
                              type="button"
                              className="si-action-btn btn-copy"
                              title="Copy Full Image URL"
                              onClick={() => copyUrl(list.file)}
                            >
                              <Copy size={14} />
                            </button>
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="si-action-btn"
                              title="Open image in new tab"
                            >
                              <ExternalLink size={14} />
                            </a>
                            <button
                              type="button"
                              className="si-action-btn btn-del"
                              disabled={isBusy}
                              onClick={() => deleteList(list)}
                              title="Delete Blog Image"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Modern Grid View */
            <div className="si-grid-wrap">
              <div className="si-media-grid">
                {alllists.map((list, idx) => {
                  const fileName = getFileName(list.file);
                  const ext = getExt(list.file);
                  const isBusy = deletingId === list.id;
                  const fileUrl = AWS_UPLOADS + list.file;

                  return (
                    <div key={list.id || idx} className="si-grid-card">
                      <div className="si-grid-thumb-wrap">
                        <div className="si-grid-badge badge-image">
                          <ImageIcon size={12} />
                          <span>{ext}</span>
                        </div>

                        <LightGallery speed={500} plugins={[lgThumbnail, lgZoom]}>
                          <a href={fileUrl} className="si-grid-media-link">
                            <img
                              src={fileUrl}
                              alt={fileName}
                              className="si-grid-media"
                            />
                          </a>
                        </LightGallery>
                      </div>

                      <div className="si-grid-card-body">
                        <div>
                          <h4 className="si-grid-title" title={fileName}>
                            {fileName}
                          </h4>
                          <div className="si-grid-path" title={list.file}>
                            {list.file}
                          </div>
                        </div>

                        <div className="si-grid-footer">
                          <span className="si-type-pill">
                            <FileImage size={12} /> {ext}
                          </span>

                          <div className="si-action-btns">
                            <button
                              type="button"
                              className="si-action-btn btn-copy"
                              title="Copy Full Image URL"
                              onClick={() => copyUrl(list.file)}
                            >
                              <Copy size={14} />
                            </button>
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="si-action-btn"
                              title="Open image in new tab"
                            >
                              <ExternalLink size={14} />
                            </a>
                            <button
                              type="button"
                              className="si-action-btn btn-del"
                              disabled={isBusy}
                              onClick={() => deleteList(list)}
                              title="Delete Blog Image"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid #f1f5f9",
            }}
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
              <SavedAgo endpoint="api/blogimgs" />
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {mode === "add" && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Upload Blog Images</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setMode("")}
                ></button>
              </div>

              <div className="modal-body">
                <form onSubmit={addList}>
                  <div className="form-group mb-3">
                    <label className="form-label fw-semibold">
                      Select Images (Multiple allowed): *
                    </label>
                    <input
                      type="file"
                      className="form-control"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={(e: any) => {
                        setFiles(Array.from(e.target.files));
                        setProgress(0);
                      }}
                    />
                  </div>

                  {files.length > 0 && (
                    <div className="alert alert-info py-2 px-3 small mb-3">
                      Selected <b>{files.length}</b> file(s) for upload
                    </div>
                  )}

                  {/* Status Messages */}
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

                  {floading && (
                    <div className="progress mb-3" style={{ height: "10px" }}>
                      <div
                        className="progress-bar progress-bar-striped progress-bar-animated bg-info"
                        role="progressbar"
                        style={{ width: `${progress}%` }}
                      >
                        {progress}%
                      </div>
                    </div>
                  )}

                  {/* Previews */}
                  {previews.length > 0 && (
                    <div
                      className="d-flex flex-wrap gap-2 mb-3 p-2 bg-light rounded"
                      style={{ maxHeight: "140px", overflowY: "auto" }}
                    >
                      {previews.map((p) => (
                        <img
                          key={p.key}
                          src={p.url}
                          alt="preview"
                          style={{
                            width: 60,
                            height: 60,
                            objectFit: "cover",
                            borderRadius: 6,
                            border: "1px solid #cbd5e1",
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Submit */}
                  <div className="d-flex justify-content-end gap-2 mt-4">
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
                      {floading ? <ButtonLoader label="Uploading..." /> : "Upload Images"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  /* ================= Components ================= */
  function Pagination({
    page,
    total,
    limit,
    lastPage,
    onPageChange,
  }: any) {
    if (total === 0 || lastPage <= 1) return null;

    // Calculate Showing X to Y
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
                className={`dt-paging-button ${
                  p === page ? "current" : ""
                }`}
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