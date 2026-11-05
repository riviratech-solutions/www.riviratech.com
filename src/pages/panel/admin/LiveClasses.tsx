import { Head, SERVER_URL } from "../../../components/Includes";
import { useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import { loadAllTrainers, trainersForCourse } from "../../../utils/trainers";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import StudentLiveClasses from "../student/LiveClasses";
import ClassHeroCard from "../../../components/ClassHeroCard";
import ClassVideo from "../../../components/ClassVideo";
import UploadProgress, { type UploadState } from "../../../components/UploadProgress";
import SecurityTokenModal from "../../../components/SecurityTokenModal";
import PickerSelect from "../../../components/PickerSelect";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  Video,
  ChevronLeft,
  Layers,
  GraduationCap,
  Users,
  FileText,
  Type,
  List,
  Info,
  Calendar,
  Clock,
  User,
  Paperclip,
  X,
  Plus,
  Check,
  Link as LinkIcon,
  Key,
  Play,
  CheckCircle2,
  XCircle,
  RotateCw,
  SlidersHorizontal,
  Trash2,
  Edit3,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  FileX2,
  Cloud,
  HardDrive,
  Globe,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { openWebLink } from "../../../utils/openLink";
import { AnimatedNumber, ButtonLoader, SkeletonCards } from "../../../components/loading";
import { classDocUrl } from "../../../utils/classFiles";
import { browserTz, canonicalTz, inputsInTz, tzPickerOptions, tzShort, zonedToEpoch } from "../../../utils/classTime";

const seo = getSeoByPath("");

export default function Dashboard() {
  const navigate = useNavigate();
  const [ptype, setPType] = useState("");

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

    return () => {};
  }, []);
  return (
    <>
      {ptype == "1" && <StudentLiveClasses />}
      {ptype == "2" && <LiveClasses />}
      {(ptype == "X" || ptype == "Y") && <LiveClasses />}
    </>
  );

  function LiveClasses() {
    const permCan = usePagePerm("live-classes");

    const datetime = Math.floor(Date.now() / 1000);

    const getSecurity = async () => {
      const res = await axios.get(SERVER_URL + "api/security/token", {
        withCredentials: true, // 🔥 REQUIRED
      });

      return res.data;
    };

    function decodeHtml(str: any) {
      const txt = document.createElement("textarea");
      txt.innerHTML = str;
      return txt.value;
    }

    const getCourseNamesByIds = (ids: string) => {
      if (!ids || courses.length === 0) return "";
      return ids
        .split(",") // "2,5,7" → ["2","5","7"]
        .map((id) => id.trim()) // remove spaces
        .map((id) => {
          const course = courses.find((c) => c.req_id === id);
          return course ? decodeHtml(course.title) : "";
        })
        .filter((title) => title) // remove empty values
        .join(", "); // join with comma + space
    };

    const getTrainerNameById = (idOrName: string) => {
      if (!idOrName) return "";
      const clean = String(idOrName).trim();
      const found = allTrainers.find(
        (t: any) => t.mem_id === clean || t.id === clean || t.ukey === clean,
      );
      if (found && found.name) return decodeHtml(found.name);
      if (/^[0-9a-fA-F]{20,40}$/.test(clean)) return "";
      return clean;
    };

    const getBatchNameById = (id: string) => {
      if (!id || batches.length === 0) return "";

      for (const res of batches) {
        const batch = res.data.find((b) => b.b_id === id);

        if (batch) {
          return decodeHtml(batch.name);
        }
      }
      return "";
    };

    const [loading, setLoading] = useState(true);
    //const [loadingId, setLoadingId] = useState<string | null>(null);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    const [mode, setMode] = useState("selection");
    const [model, setModel] = useState("");

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
      timezone: browserTz(), // the zone the date + times are in (shown to others in theirs)
      zoom_link: "",
      passcode: "",
      notes: "",
      file: "",
      pwd: "",
      type: "",
      delivery: "hls", // uploaded recording: "hls" encrypted stream (default) / "mp4" private original
      delete_original: "1", // Secure stream: remove the upload once the encrypted copy is ready
      storage: "gdrive", // "gdrive" (default) | "server"
      doc: "",
      attendance: 0,
      datetime: "",
      status: "",
    };
    const [form, setForm] = useState(initialForm);
    // Every trainer, loaded once (utils/trainers.ts); the form's dropdown shows
    // the selected course's trainers from it, so picking a course fetches nothing.
    const [allTrainers, setAllTrainers] = useState<any[]>([]);
    const trainers = useMemo(
      () => trainersForCourse(allTrainers, form.c_id),
      [allTrainers, form.c_id],
    );

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

    const timestampTime24 = (ts: any) => {
      if (!ts) return "";

      const date = new Date(ts * 1000);

      return date.toLocaleString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    };

    interface Batch {
      id: number;
      b_id: string;
      c_id: string;
      name: string;
      sdate: string;
      edate: string;
      datetime: string; // timestamp as string
      status: string; // "0" | "1" | "1D"
    }

    interface BatchResponse {
      req_id: string;
      data: Batch[];
    }

    const [loadingId, setLoadingId] = useState<string | null>(null);
    const limit = 10;
    const [alllists, setAllLists] = useState<any[]>([]);
    // the full class row (recording fields included) for a class in the form
    const rowOf = (f: any) =>
      alllists.find((r: any) => r.req_id === f.req_id) || f;
    const initstats = {
      pending: 0,
      completed: 0,
      canceled: 0,
      upcoming: 0,
      deleted: 0,
      total: 0,
    };
    const [stats, setStats] = useState(initstats);
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [purgeTarget, setPurgeTarget] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("New");
    const [lastPage, setLastPage] = useState(0);
    const [courses, setCourses] = useState<any[]>([]);
    const [batches, setBatches] = useState<BatchResponse[]>([]);
    const [courseid, setCourseid] = useState("");
    const [batchid, setBatchid] = useState("");

    const [ukey, setUkey] = useState("");
    const [ustatus, setUstatus] = useState("");

    const [vform, setvForm] = useState({
      link: "",
      pin: "",
    });

    const handleVChange = (e: any) => {
      setvForm({
        ...vform,
        [e.target.name]: e.target.value,
      });
    };

    const [usercourses, setuserCourses] = useState<any[]>([]);
    const loadMyProfile = async () => {
      try {
        const res = await listFetch("api/get-myprofile", {
          status: "",
        });

        if (res.data.success) {
          //setmyprofile(res.data.data);
          setuserCourses(res.data.courses);
          return (res.data.courses || []) as any[];
        } else {
          toast.error(res.data.message);
        }
      } catch (err) {
        setError(err + "");
      } finally {
      }
    };

    const loadCourses = async (role: string = ustatus) => {
      let mine: any[] = [];
      if (role === "2") {
        mine = (await loadMyProfile()) || [];
      }
      try {
        const res = await listFetch("api/get-courses", {
          status: "",
        });

        if (res.data.success) {
          setCourses(res.data.data);
          if (role === "2") {
            // a trainer sees only their own courses; one course opens directly
            const own = res.data.data.filter(
              (c: any) =>
                c.status === "1" &&
                mine.some((uc: any) => uc.c_id === c.req_id),
            );
            if (own.length === 1) {
              const cid = own[0].req_id;
              setCourseid(cid);
              const list = await loadBatches(cid);
              const myBatch =
                mine.find((uc: any) => uc.c_id === cid)?.b_id || "";
              // their batch if set, else the course's newest active batch (Go Back to switch)
              const active = list.filter((b: any) => b.status === "1");
              const newest = active
                .slice()
                .sort(
                  (x: any, y: any) =>
                    String(y.sdate || "").localeCompare(
                      String(x.sdate || ""),
                    ) || (Number(y.id) || 0) - (Number(x.id) || 0),
                )[0];
              const bid = myBatch || (newest ? newest.b_id : "");
              if (bid) {
                setBatchid(bid);
                await loadDetails(1, "", "New", cid, bid);
                setMode("board");
              }
            }
          } else if (res.data.data.length >= 1) {
            const course = res.data.data.find((c: any) => c.status === "1");
            if (course) {
              await loadBatches(course.req_id); // ✅ works
            }
          }
        } else {
          toast.error(res.data.message);
        }
      } catch (err) {
        setLoading(false);
        setError("❌ Something went wrong");
      } finally {
      }
    };

    const loadBatches = async (c_id: any) => {
      try {
        if (allTrainers.length <= 0) {
          await loadTrainers(c_id);
        }

        const res = await listFetch("api/get-batches", {
          c_id: c_id,
          status: "",
        });

        if (res.data.success) {
          if (res.data.data.length >= 1) {
            // one entry per course: replace it (adding a new one each time a
            // course was picked again listed its batches twice)
            setBatches((prev) => [
              ...prev.filter((b) => b.req_id !== c_id),
              {
                req_id: c_id,
                data: res.data.data,
              },
            ]);
          }
          return res.data.data as any[];
        } else {
          toast.error(res.data.message);
        }
      } catch (err) {
        setError("❌ Something went wrong");
      } finally {
        setLoading(false);
      }
      return [] as any[];
    };

    // all trainers in one request, then from the saved copy (utils/trainers.ts)
    const loadTrainers = async (_courseid?: any) => {
      setAllTrainers(await loadAllTrainers());
    };

    const location = useLocation();

    const loadDetails = async (
      page = 1,
      search = "",
      sort = "",
      courseid = "",
      batchid = "",
    ) => {
      setLoading(true);
      setUp(null);
      setAllLists([]);
      setStats(initstats);
      setPage(page);
      setSearch(search);
      setSort(sort);

      if (courses.length == 0) {
        console.log("courses reloading");
      }

      try {
        const res = await listFetch("api/live-classes", {
          q: search,
          s: sort,
          n: page,
          cid: courseid,
          bid: batchid,
        });

        if (res.data.success) {
          setAllLists(res.data.data);
          setStats(res.data.stats);
          setLastPage(res.data.lastPage);

          if (allTrainers.length == 0) {
            loadTrainers(courseid);
          }
        } else {
          toast.error(res.data.message);
        }
      } catch (err) {
        setError("❌ Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    const [up, setUp] = useState<UploadState>(null);

    // The class's time zone: the date + times above are in it; students, trainers
    // and admins each see the class in their own zone (utils/classTime.ts).
    const tzOptions = useMemo(() => tzPickerOptions(), []);
    const timezoneField = () => {
      const tz = form.timezone || browserTz();
      const mine = browserTz();
      const st = zonedToEpoch(form.classdate, form.stimings, tz);
      const et = zonedToEpoch(form.classdate, form.etimings, tz);
      const when = (ts: number, withDay: boolean) =>
        new Date(ts * 1000).toLocaleString("en-IN", {
          ...(withDay ? { weekday: "short", day: "numeric", month: "short" } : {}),
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      return (
        <div className="col-12">
          <label className="lc-label" htmlFor="lc-tz">
            Time zone <span className="lc-req">*</span>
          </label>
          <div className="lc-input-group">
            <div className="lc-addon">
              <Globe size={18} color="var(--ad-brand)" />
            </div>
            <div className="lc-tz-picker">
              <PickerSelect
                id="lc-tz"
                value={tz}
                options={tzOptions}
                onChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
                searchable
                searchPlaceholder="Search a city, country or IST / EST…"
              />
            </div>
          </div>
          <small className="lc-tz-hint">
            The date and times above are in this time zone. Students, trainers and admins each see the class in
            their own time zone
            {tz !== mine && Number.isFinite(st) ? (
              <>
                {" "}
                — for you:{" "}
                <b>
                  {when(st, true)}
                  {Number.isFinite(et) ? ` – ${when(et, false)}` : ""} {tzShort(st)}
                </b>
              </>
            ) : null}
            .
          </small>
        </div>
      );
    };

    // Secure stream only: remove the uploaded original once the encrypted copy is ready
    // (ticked by default; sent as delete_original with the form)
    const deleteOriginalField = () =>
      form.delivery === "hls" ? (
        <label className="lc-del-orig">
          <input
            type="checkbox"
            checked={form.delete_original !== "0"}
            onChange={(e) =>
              setForm((f) => ({ ...f, delete_original: e.target.checked ? "1" : "0" }))
            }
          />
          <span>
            <b>Delete the original file once the secure stream is ready</b>
            <small>
              Saves disk space. Only the encrypted stream is kept, so to convert it again you
              would upload the video again. If preparing fails, the original is kept.
            </small>
          </span>
        </label>
      ) : null;

    // the error shape the save handlers already show (err.response.data.message)
    const uploadError = (message: string) => Object.assign(new Error(message), { response: { data: { message } } });

    // Google Drive configuration & storage quota status from the backend (service account only)
    const [driveStatus, setDriveStatus] = useState<{
      enabled: boolean;
      maxBytes: number;
      quotaOk: boolean;
      quotaMessage: string;
      folderName: string;
    }>({
      enabled: true,
      maxBytes: 5368709120,
      quotaOk: true,
      quotaMessage: "",
      folderName: "",
    });
    useEffect(() => {
      axios
        .get(SERVER_URL + "api/class-drive-status", { withCredentials: true })
        .then((r) => {
          if (r.data?.success) {
            setDriveStatus({
              enabled: !!r.data.enabled,
              maxBytes: Number(r.data.maxBytes) || 5368709120,
              quotaOk: r.data.quotaOk !== false,
              quotaMessage: String(r.data.quotaMessage || ""),
              folderName: String(r.data.folderName || ""),
            });
          }
        })
        .catch(() => {});
    }, []);

    const ALLOWED_VIDEO_EXTS = ["mp4", "mov", "mkv", "webm", "avi", "m4v"];
    const ALLOWED_DOC_EXTS = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv"];

    const validatePickedFile = (f: File, kind: "video" | "doc"): string => {
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      if (kind === "video") {
        if (!ALLOWED_VIDEO_EXTS.includes(ext)) {
          return `Invalid video extension (.${ext || "unknown"}). Allowed: MP4, MOV, MKV, WEBM, AVI, M4V.`;
        }
        if (f.type && !f.type.startsWith("video/")) {
          return `Invalid video MIME type (${f.type}). Please select a valid video file.`;
        }
        const maxBytes = driveStatus.maxBytes || 5368709120;
        if (f.size <= 0) return "Selected video file is empty (0 bytes).";
        if (f.size > maxBytes) {
          return `Video size (${fmtBytes(f.size)}) exceeds the maximum limit (${fmtBytes(maxBytes)}).`;
        }
      } else {
        if (!ALLOWED_DOC_EXTS.includes(ext)) {
          return `Invalid document extension (.${ext || "unknown"}). Allowed: PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX, TXT, CSV.`;
        }
        if (f.size <= 0) return "Selected document file is empty (0 bytes).";
        if (f.size > 100 * 1024 * 1024) {
          return `Document size (${fmtBytes(f.size)}) exceeds the 100 MB limit.`;
        }
      }
      return "";
    };

    const fmtBytes = (bytes: any): string => {
      const n = Number(bytes) || 0;
      if (n <= 0) return "";
      if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + " GB";
      if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(1) + " MB";
      if (n >= 1024) return Math.round(n / 1024) + " KB";
      return n + " B";
    };

    const getVideoFileName = (item: any): string => {
      if (item?.video_name) return String(item.video_name);
      const raw = String(item?.video_private || item?.file || "").trim();
      if (!raw || /^https?:\/\//i.test(raw)) return "";
      if (raw.startsWith("gdrive:")) return "Google Drive Video (" + raw.slice(7, 15) + "…)";
      if (raw.startsWith("gdrive-hls:")) return "Encrypted HLS Stream (Drive)";
      const base = raw.split("/").pop() || "";
      return base.replace(/^\d+-[a-z0-9_]+-/, "");
    };

    // A class's video or document: validated on the client, uploaded to the backend
    // with progress reporting and automatic retry, and stored on either the server
    // or Google Drive (keeping Google credentials exclusively on the backend).
    const sendFile = async (f: File, kind: "video" | "doc", label: string, security: any): Promise<string> => {
      const vErr = validatePickedFile(f, kind);
      if (vErr) throw uploadError(vErr);
      if (form.storage === "gdrive" && !driveStatus.quotaOk && driveStatus.quotaMessage) {
        throw uploadError(driveStatus.quotaMessage);
      }
      setUp({ label: "Preparing upload…", loaded: 0, total: f.size, start: performance.now() });
      const auth = { key: security.key, token: security.token, aut: security.aut };

      // Direct upload to Google Drive via resumable upload session (for documents or Original MP4 delivery).
      // Secure stream (HLS) uploads to the server (using 20 MB chunks so Cloudflare allows any file size)
      // so FFmpeg on the server can convert it into encrypted HLS segments, which are then uploaded to Drive.
      if (form.storage === "gdrive" && (kind === "doc" || form.delivery === "mp4")) {
        const driveRes = await axios.post(
          SERVER_URL + "api/class-drive-upload",
          {
            kind: kind === "doc" ? "doc" : "video",
            fileName: f.name,
            fileType: f.type || (kind === "video" ? "video/mp4" : "application/octet-stream"),
            size: f.size,
            ...auth,
          },
          { withCredentials: true },
        );
        if (!driveRes.data?.success || !driveRes.data.uploadURL) {
          throw uploadError(driveRes.data?.message || "Couldn't start Google Drive upload");
        }
        const driveUploadRes = await putFile(driveRes.data.uploadURL, f, label + " (Google Drive)");
        const driveId = driveUploadRes?.data?.id;
        if (!driveId) {
          throw uploadError("Google Drive upload completed but returned no file ID");
        }
        return "gdrive:" + driveId;
      }

      const r = await axios.post(
        SERVER_URL + "api/get-upload-url",
        { fileName: f.name, fileType: f.type || "application/octet-stream", ...auth },
        { withCredentials: true },
      );
      if (!r.data?.success || !r.data.uploadURL) {
        throw uploadError(r.data?.message || "Couldn't start the upload");
      }
      await putFile(r.data.uploadURL, f, label);
      return String(r.data.key || "");
    };

    // where the video + document are kept (Server or Google Drive)
    const storageField = () => (
      <div className="lc-storage">
        <span className="lc-storage-label">Storage</span>
        <div className="lc-storage-opts" role="radiogroup" aria-label="Storage">
          {(
            [
              ["gdrive", "Google Drive", Cloud],
              ["server", "Server", HardDrive],
            ] as const
          ).map(([v, l, Icon]) => (
            <label key={v} className={"lc-storage-opt" + (form.storage === v ? " on" : "")}>
              <input
                type="radio"
                name="lc-storage"
                value={v}
                checked={form.storage === v}
                onChange={() => setForm((f) => ({ ...f, storage: v }))}
              />
              <Icon size={16} />
              {l}
            </label>
          ))}
        </div>
        <small>
          {form.storage === "gdrive" ? (
            <>
              {!driveStatus.quotaOk && driveStatus.quotaMessage
                ? "⚠️ " + driveStatus.quotaMessage
                : form.delivery === "hls"
                  ? "The video is converted on the server, then the encrypted stream (and the original, unless deleted) is uploaded to the private Google Drive folder."
                  : "The video and document are uploaded via OAuth to the private Google Drive folder and streamed securely through this site."}{" "}
              {(ustatus === "X" || ustatus === "Y") && (
                <Link to="/panel/google-drive" style={{ fontWeight: 600, marginLeft: 4 }}>
                  Manage Google Drive OAuth →
                </Link>
              )}
            </>
          ) : (
            "The video and document are kept on this server."
          )}
        </small>
      </div>
    );

    // a file PUT to its signed upload URL, with progress for <UploadProgress> and retry on transient network error
    const putFile = async (url: string, f: File, label: string) => {
      const isDrive = url.includes("googleapis.com");
      const isChunkedServer = !isDrive && f.size > 80 * 1024 * 1024;
      const maxTries = 3;

      if (isChunkedServer) {
        // Chunked upload to Server (20 MB chunks) to stay well below Cloudflare's 100 MB proxy limit
        const chunkSize = 20 * 1024 * 1024;
        const total = f.size;
        let uploadedBytes = 0;
        const startTime = performance.now();

        setUp({ label, loaded: 0, total, start: startTime });

        for (let start = 0; start < total; start += chunkSize) {
          const end = Math.min(start + chunkSize, total);
          const chunk = f.slice(start, end);

          let chunkSuccess = false;
          for (let attempt = 1; attempt <= maxTries; attempt++) {
            try {
              setUp({
                label: attempt > 1 ? `${label} (part ${Math.floor(start / chunkSize) + 1}, retry ${attempt})` : label,
                loaded: uploadedBytes,
                total,
                start: startTime,
              });

              await axios.put(url, chunk, {
                headers: {
                  "Content-Type": f.type || "application/octet-stream",
                  "Content-Range": `bytes ${start}-${end - 1}/${total}`,
                },
                onUploadProgress: (e) => {
                  setUp((u) => (u ? { ...u, loaded: uploadedBytes + e.loaded, total } : u));
                },
              });

              uploadedBytes = end;
              setUp((u) => (u ? { ...u, loaded: uploadedBytes, total } : u));
              chunkSuccess = true;
              break;
            } catch (err: any) {
              if (attempt >= maxTries) throw uploadError(err?.response?.data?.message || err.message || "Chunk upload failed");
              await new Promise((r) => setTimeout(r, 1000 * attempt));
            }
          }
          if (!chunkSuccess) throw uploadError("Failed to upload file chunks");
        }
        setUp((u) => (u ? { ...u, loaded: total, saving: true } : u));
        return { data: { success: true } };
      }

      // Normal PUT (Google Drive direct resumable upload OR small server files < 80 MB)
      for (let attempt = 1; attempt <= maxTries; attempt++) {
        try {
          setUp({
            label: attempt > 1 ? `${label} (retry ${attempt}/${maxTries})` : label,
            loaded: 0,
            total: f.size,
            start: performance.now(),
          });
          const res = await axios.put(url, f, {
            headers: { "Content-Type": f.type || "application/octet-stream" },
            onUploadProgress: (e) =>
              setUp((u) => (u ? { ...u, loaded: e.loaded, total: e.total || u.total } : u)),
          });
          setUp((u) => (u ? { ...u, loaded: u.total, saving: true } : u));
          return res;
        } catch (err: any) {
          if (attempt >= maxTries) {
            const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err.message || "Upload failed";
            throw uploadError(msg);
          }
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    };
    const [file, setFile] = useState<File | null>(null);

    // "Ex Class Video": the end time isn't asked for — it is start + the
    // video's length (rounded up to the minute, kept within the class day)
    const [videoDur, setVideoDur] = useState(0); // seconds, 0 = unknown
    const [videoDurFailed, setVideoDurFailed] = useState(false); // the browser couldn't read it
    const [savedVideoDur, setSavedVideoDur] = useState(0); // the edited class's saved end - start
    // the edited class's current video length, from the API (per class, so a
    // late answer for another class is ignored)
    const [currentVideo, setCurrentVideo] = useState({ id: "", sec: 0 });
    const [videoLenLoading, setVideoLenLoading] = useState(""); // the class being asked about
    const loadVideoLength = async (reqId: string) => {
      setVideoLenLoading(reqId);
      try {
        const security = await getSecurity();
        const res = await axios.post(
          SERVER_URL + "api/class-video-length",
          { id: reqId, key: security.key, token: security.token, aut: security.aut },
          { withCredentials: true },
        );
        const sec = Number(res.data?.duration) || 0;
        if (res.data?.success && sec > 0) setCurrentVideo({ id: reqId, sec });
      } catch {
        /* the saved end - start is used instead */
      } finally {
        setVideoLenLoading((id) => (id === reqId ? "" : id));
      }
    };
    // the recording the class being edited already has (from the list): an
    // uploaded video can be kept or replaced; a link is changed from Class Details
    const editRec = String(
      alllists.find((l: any) => l.req_id === form.req_id)?.file || "",
    ).trim();
    const editRecLink =
      /^https?:\/\//i.test(editRec) ||
      (String(form.type) === "2" && editRec.length > 0);
    const editHasVideo = !editRecLink && editRec.length >= 10;
    // editing and keeping the current video: its length (or, if that can't be
    // read, the saved end - start) still applies
    const keepsVideo = mode === "update" && !file && editHasVideo;
    const currentVideoDur = currentVideo.id === form.req_id ? currentVideo.sec : 0;
    const keptVideoDur = currentVideoDur || savedVideoDur;
    const classVideoDur = videoDur || (keepsVideo ? keptVideoDur : 0);
    // the End Time field is shown again only when the length can't be known
    const autoEnd =
      form.status === "2" && !videoDurFailed && !(keepsVideo && !keptVideoDur);
    const readVideoDuration = (f: File) =>
      new Promise<number>((resolve) => {
        const url = URL.createObjectURL(f);
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => {
          const d = Number(v.duration);
          URL.revokeObjectURL(url);
          resolve(isFinite(d) && d > 0 ? d : 0);
        };
        v.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(0);
        };
        v.src = url;
      });
    const endFromStart = (start: string, sec: number) => {
      const m = /^(\d{1,2}):(\d{2})/.exec(start || "");
      if (!m || !sec) return "";
      const total = Math.min(
        Number(m[1]) * 60 + Number(m[2]) + Math.ceil(sec / 60),
        23 * 60 + 59,
      );
      return (
        String(Math.floor(total / 60)).padStart(2, "0") +
        ":" +
        String(total % 60).padStart(2, "0")
      );
    };
    const fmtVideoDur = (sec: number) => {
      const t = Math.round(sec);
      const h = Math.floor(t / 3600),
        m = Math.floor((t % 3600) / 60),
        x = t % 60;
      return (h ? h + "h " : "") + (h || m ? m + "m " : "") + x + "s";
    };
    // "HH:MM" as the time inputs show it (e.g. 2:32 PM)
    const fmtClock = (hm: string) => {
      const [h, m] = hm.split(":").map(Number);
      return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    };
    // another class type or another form: the length no longer applies
    useEffect(() => {
      if (form.status !== "2") {
        setVideoDur(0);
        setVideoDurFailed(false);
      }
    }, [form.status]);
    useEffect(() => {
      setVideoDur(0);
      setVideoDurFailed(false);
    }, [mode]);
    // keep the end time = start + length whenever either changes
    useEffect(() => {
      if (form.status !== "2" || !classVideoDur || !form.stimings) return;
      const end = endFromStart(form.stimings, classVideoDur);
      if (end && end !== form.etimings) setForm((f) => ({ ...f, etimings: end }));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.status, form.stimings, classVideoDur]);
    const [doc, setDoc] = useState<File | null>(null);

    const addList = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      setSuccess("");
      setError("");

      if (!form.title.trim()) {
        setError("❌ Please enter class title");
        return;
      }

      try {
        const validations = [
          { field: form.status, msg: "❌ Please select class type" },
          { field: form.c_id, msg: "❌ Please select course" },
          { field: form.b_id, msg: "❌ Please select batch" },
          { field: form.title, msg: "❌ Please enter title" },
          { field: form.trainer, msg: "❌ Please select trainer" },
          { field: form.classdate, msg: "❌ Please select class date" },
          {
            field: !autoEnd || !form.stimings || (classVideoDur > 0 && form.etimings),
            msg: "❌ Please choose the class video — its length sets the end time",
          },
          {
            field: form.stimings && form.etimings,
            msg: "❌ Please select class time",
          },
        ];

        for (const v of validations) {
          if (!v.field) {
            setError(v.msg);
            return;
          }
        }

        setLoading(true);

        setUp(null);

        // 🔐 Security
        const security = await getSecurity();

        let vfilename = "";
        let gof = true;

        if (form.status == "2") {
          gof = false;
          if (!file) {
            setError("❌ Please select a class video");
            return;
          }

          // 1️⃣ Get S3 presigned URL
          vfilename = await sendFile(file, "video", "Uploading video" + (doc ? " (1 of 2)" : ""), security);
          if (vfilename) gof = true;
        }

        let dfilename = "";

        if (doc && gof) {
          gof = false;
          // 1️⃣ Get S3 presigned URL
          dfilename = await sendFile(doc, "doc", "Uploading document" + (file ? " (2 of 2)" : ""), security);
          if (dfilename) gof = true;
        }

        if (!gof) {
          setError("Something went wrong, try again");
        } else {
          // 3️⃣ Save assignment data (DB)
          const res = await axios.post(
            SERVER_URL + "api/add-class",
            {
              ...form,
              vfile: vfilename,
              dfile: dfilename,
              video_name: file?.name || "",
              video_size: file?.size || 0,
              cst: form.stimings,
              cet: form.etimings,
              key: security.key,
              token: security.token,
              aut: security.aut,
            },
            { withCredentials: true },
          );

          if (res.data.success) {
            setSuccess(res.data.message);
            toast.success(res.data.message);
            setAllLists((prev) => [res.data.data, ...prev]);
            setForm(initialForm);
            setFile(null);
            setDoc(null);
            setUp(null);
          } else {
            toast.error(res.data.message);
            setError(res.data.message);
          }
        }
      } catch (err) {
        console.error(err);
        setError("❌ " + ((err as any)?.response?.data?.message || "Something went wrong, try again"));
      } finally {
        setLoading(false);
      }
    };

    const updateList = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      setSuccess("");
      setError("");

      if (!form.title.trim()) {
        setError("❌ Please enter class title");
        return;
      }

      try {
        const validations = [
          { field: form.status, msg: "❌ Please select class type" },
          { field: form.c_id, msg: "❌ Please select course" },
          { field: form.b_id, msg: "❌ Please select batch" },
          { field: form.title, msg: "❌ Please enter title" },
          { field: form.trainer, msg: "❌ Please select trainer" },
          { field: form.classdate, msg: "❌ Please select class date" },
          {
            field: !autoEnd || !form.stimings || (classVideoDur > 0 && form.etimings),
            msg: "❌ Please choose the class video — its length sets the end time",
          },
          {
            field: form.stimings && form.etimings,
            msg: "❌ Please select class time",
          },
        ];

        for (const v of validations) {
          if (!v.field) {
            setError(v.msg);
            return;
          }
        }

        setLoading(true);

        setUp(null);

        let gof = true;

        // 🔐 Security
        const security = await getSecurity();

        let vfilename = "";
        if (file) {
          gof = false;

          // 1️⃣ Get S3 presigned URL
          vfilename = await sendFile(file, "video", "Uploading video" + (doc ? " (1 of 2)" : ""), security);
          if (vfilename) gof = true;
        }

        let dfilename = "";

        if (doc && gof) {
          gof = false;

          // 1️⃣ Get S3 presigned URL
          dfilename = await sendFile(doc, "doc", "Uploading document" + (file ? " (2 of 2)" : ""), security);
          if (dfilename) gof = true;
        }

        if (!gof) {
          setError("Something went wrong, try again");
        } else {
          // 3️⃣ Save assignment data (DB)
          const res = await axios.post(
            SERVER_URL + "api/update-class",
            {
              ...form,
              vfile: vfilename,
              dfile: dfilename,
              video_name: file?.name || "",
              video_size: file?.size || 0,
              cst: form.stimings,
              cet: form.etimings,
              key: security.key,
              token: security.token,
              aut: security.aut,
            },
            { withCredentials: true },
          );

          if (res.data.success) {
            setSuccess(res.data.message);
            toast.success(res.data.message);
            setAllLists((prev) =>
              prev.map((item) =>
                item.id === res.data.data.id ? res.data.data : item,
              ),
            );
            setFile(null);
            setDoc(null);
            setUp(null);
          } else {
            toast.error(res.data.message);
            setError(res.data.message);
          }
        }
      } catch (err) {
        console.error(err);
        setError("❌ " + ((err as any)?.response?.data?.message || "Upload failed"));
      } finally {
        setLoading(false);
      }
    };

    const cancellist = async (list: any) => {
      setSuccess("");
      setError("");

      // ✅ Ask confirmation first
      const confirm = window.confirm(
        "Are you sure you want to cancel '" + list.title + "' class?",
      );

      if (!confirm) return; // ❌ Cancel clicked

      try {
        setLoadingId(list.id);

        const security = await getSecurity();
        const res = await axios.post(
          SERVER_URL + "api/cancel-class",
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
              b.req_id === list.req_id ? { ...b, status: "0" } : b,
            ),
          );
          setForm((f) => ({ ...f, status: "0" }));
          if (list.status === "1") {
            stats.canceled = stats.canceled + 1;
            stats.pending = stats.pending - 1;
          }
        } else {
          toast.error(res.data.message);
        }
      } catch (err) {
        setError("❌ Something went wrong");
      } finally {
        setLoadingId(null);
      }
    };

    const reopenlist = async (list: any) => {
      setSuccess("");
      setError("");

      // ✅ Ask confirmation first
      const confirm = window.confirm(
        "Are you sure you want to reopen '" + list.title + "' class?",
      );

      if (!confirm) return; // ❌ Cancel clicked

      try {
        setLoadingId(list.id);

        const security = await getSecurity();
        const res = await axios.post(
          SERVER_URL + "api/reopen-class",
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
          setForm((f) => ({ ...f, status: "1" }));

          if (list.status === "0") {
            stats.canceled = stats.canceled - 1;
            stats.pending = stats.pending + 1;
          }
        } else {
          toast.error(res.data.message);
        }
      } catch (err) {
        setError("❌ Something went wrong");
      } finally {
        setLoadingId(null);
      }
    };

    // a ready secure stream that still keeps its uploaded original: delete the original (admins)
    const deleteOriginal = async (list: any) => {
      const ok = window.confirm(
        `Delete the original video file of '${list.title}'?\n\n` +
          "The secure stream keeps playing for students. The original can't be recovered; " +
          "to convert the video again you would have to upload it again.",
      );
      if (!ok) return;
      try {
        setLoadingId(list.id);
        const security = await getSecurity();
        const res = await axios.post(
          SERVER_URL + "api/class-video-delete-original",
          { id: list.req_id, key: security.key, token: security.token, aut: security.aut },
          { withCredentials: true },
        );
        if (res.data.success) {
          toast.success(res.data.message);
          setAllLists((prev) =>
            prev.map((c) => (c.req_id === list.req_id ? { ...c, video_delete_original: 1 } : c)),
          );
        } else {
          toast.error(res.data.message);
        }
      } catch {
        toast.error("Something went wrong, please try again");
      } finally {
        setLoadingId(null);
      }
    };

    // completed classes: disabled ("2S") is hidden from students; enable shows it again
    const setVisibility = async (list: any, enable: boolean) => {
      const ok = window.confirm(
        enable
          ? `Enable '${list.title}'? Students will see this class again.`
          : `Disable '${list.title}'? It will be hidden from students.`,
      );
      if (!ok) return;
      try {
        setLoadingId(list.id);
        const security = await getSecurity();
        const res = await axios.post(
          SERVER_URL + "api/class-visibility",
          {
            id: list.req_id,
            enable: enable ? "1" : "0",
            key: security.key,
            token: security.token,
            aut: security.aut,
          },
          { withCredentials: true },
        );
        if (res.data.success) {
          toast.success(res.data.message);
          setAllLists((prev) =>
            prev.map((c) =>
              c.req_id === list.req_id ? { ...c, status: res.data.status } : c,
            ),
          );
        } else {
          toast.error(res.data.message);
        }
      } catch {
        toast.error("❌ Something went wrong");
      } finally {
        setLoadingId(null);
      }
    };

    // secure (HLS) videos still being prepared: check their progress every 5 seconds
    const preparingIds = alllists
      .filter((l) => l.video_mode === "hls" && ["pending", "processing", "uploading"].includes(l.video_status))
      .map((l) => String(l.req_id))
      .slice(0, 20)
      .join(",");
    useEffect(() => {
      if (!preparingIds) return;
      const ids = preparingIds.split(",");
      const t = window.setInterval(async () => {
        const got = await Promise.all(
          ids.map((id) =>
            axios
              .get(SERVER_URL + "api/class-video-status/" + id, { withCredentials: true })
              .then((r) => (r.data?.success ? { id, ...r.data } : null))
              .catch(() => null),
          ),
        );
        const byId = new Map(got.filter(Boolean).map((g: any) => [g.id, g]));
        if (!byId.size) return;
        setAllLists((prev) =>
          prev.map((l) => {
            const g: any = byId.get(String(l.req_id));
            if (!g || (g.status === l.video_status && g.progress === l.video_progress)) return l;
            return {
              ...l,
              video_status: g.status,
              video_progress: g.progress,
              video_error: g.error || "",
              ...(g.status === "ready" ? { hls_playlist: g.playlist } : {}),
            };
          }),
        );
      }, 5000);
      return () => window.clearInterval(t);
    }, [preparingIds]);

    // a secure (HLS) video whose conversion failed: prepare it again
    const retryVideo = async (list: any) => {
      try {
        setLoadingId(list.id);
        const security = await getSecurity();
        const res = await axios.post(
          SERVER_URL + "api/class-video-retry",
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
            prev.map((c) =>
              c.req_id === list.req_id
                ? { ...c, video_status: "pending", video_error: "" }
                : c,
            ),
          );
        } else {
          toast.error(res.data.message);
        }
      } catch {
        toast.error("❌ Something went wrong");
      } finally {
        setLoadingId(null);
      }
    };

    const deleteclass = async (list: any) => {
      setSuccess("");
      setError("");

      // ✅ Ask confirmation first
      const confirm = window.confirm(
        "Are you sure you want to delete '" + list.title + "' class?",
      );

      if (!confirm) return; // ❌ Cancel clicked

      try {
        setLoadingId(list.id);

        const security = await getSecurity();
        const res = await axios.post(
          SERVER_URL + "api/delete-class",
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
              b.req_id === list.req_id
                ? { ...b, status: String(b.status || "").endsWith("D") ? b.status : b.status + "D" }
                : b,
            ),
          );

          setStats((prev: any) => ({
            ...prev,
            pending: list.status === "1" ? Math.max(0, prev.pending - 1) : prev.pending,
            completed:
              list.status === "2" || list.status === "2S"
                ? Math.max(0, prev.completed - 1)
                : prev.completed,
            canceled: list.status === "0" ? Math.max(0, prev.canceled - 1) : prev.canceled,
            deleted: (prev.deleted || 0) + 1,
            total: Math.max(0, prev.total - 1),
          }));
        } else {
          toast.error(res.data.message);
        }
      } catch (err) {
        setError("❌ Something went wrong");
      } finally {
        setLoadingId(null);
      }
    };

    const restoreClass = async (list: any) => {
      setSuccess("");
      setError("");
      try {
        setLoadingId(list.id);
        const security = await getSecurity();
        const res = await axios.post(
          SERVER_URL + "api/restore-class",
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
          const restoredStatus = String(list.status || "").endsWith("D")
            ? String(list.status).slice(0, -1)
            : list.status;
          setAllLists((prev) =>
            prev.map((b) =>
              b.req_id === list.req_id ? { ...b, status: restoredStatus } : b,
            ),
          );
          setStats((prev: any) => ({
            ...prev,
            pending: restoredStatus === "1" ? prev.pending + 1 : prev.pending,
            completed:
              restoredStatus === "2" || restoredStatus === "2S"
                ? prev.completed + 1
                : prev.completed,
            canceled: restoredStatus === "0" ? prev.canceled + 1 : prev.canceled,
            deleted: Math.max(0, (prev.deleted || 0) - 1),
            total: prev.total + 1,
          }));
        } else {
          toast.error(res.data.message);
        }
      } catch (err) {
        toast.error("Something went wrong");
      } finally {
        setLoadingId(null);
      }
    };

    const purgeClass = async (secToken: string): Promise<string | null> => {
      const list = purgeTarget;
      if (!list) return null;
      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/purge-class",
        {
          id: list.req_id,
          security_token: secToken,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );
      if (!res.data.success) return res.data.message || "Could not delete the class";

      toast.success(res.data.message);
      setAllLists((prev) => prev.filter((b) => b.req_id !== list.req_id));
      setStats((prev: any) => ({
        ...prev,
        deleted: Math.max(0, (prev.deleted || 0) - 1),
      }));
      setPurgeTarget(null);
      return null;
    };

    const updatevideolink = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      setSuccess("");
      setError("");

      // ✅ Ask confirmation first
      const confirm = window.confirm(
        "Are you sure you want to add video link to '" +
          form.title +
          "' class, then it save as completed?",
      );

      if (!confirm) return; // ❌ Cancel clicked

      try {
        setLoading(true);
        setUp(null);

        const security = await getSecurity();
        const res = await axios.post(
          SERVER_URL + "api/update-class-video-link",
          {
            ...vform,
            title: form.title,
            req_id: form.req_id,
            key: security.key,
            token: security.token,
            aut: security.aut,
          },
          { withCredentials: true },
        );

        if (res.data.success) {
          setSuccess(res.data.message);
          toast.success(res.data.message);
          setAllLists((prev) =>
            prev.map((b) =>
              b.req_id === form.req_id ? { ...b, type: "2", status: "2" } : b,
            ),
          );
          setForm((f) => ({ ...f, status: "2" }));
          if (form.status === "1") {
            stats.completed = stats.canceled + 1;
            stats.pending = stats.pending - 1;
          }
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

    const updatevideo = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      setSuccess("");
      setError("");

      // ✅ Ask confirmation first
      const confirm = window.confirm(
        "Are you sure you want to add video to '" +
          form.title +
          "' class, then it save as completed?",
      );

      if (!confirm) return; // ❌ Cancel clicked

      try {
        setLoading(true);
        setUp(null);

        const security = await getSecurity();

        let vfilename = "";
        let gof = false;

        gof = false;
        if (!file) {
          setError("❌ Please select a class video");
          return;
        }

        // 1️⃣ Get S3 presigned URL
        vfilename = await sendFile(file, "video", "Uploading video", security);
        if (vfilename) gof = true;

        if (!gof) {
          setError("Something went wrong, try again");
        } else {
          // 3️⃣ Save assignment data (DB)
          const res = await axios.post(
            SERVER_URL + "api/update-class-video",
            {
              ...form,
              title: form.title,
              vfile: vfilename,
              video_name: file?.name || "",
              video_size: file?.size || 0,
              key: security.key,
              token: security.token,
              aut: security.aut,
            },
            { withCredentials: true },
          );

          if (res.data.success) {
            setSuccess(res.data.message);
            toast.success(res.data.message);

            setAllLists((prev) =>
              prev.map((b) =>
                b.req_id === form.req_id
                  ? {
                      ...b,
                      ...(res.data.data || {}),
                      file: res.data.file,
                      type: "1",
                      status: "2",
                      video_name: file?.name || b.video_name || "",
                      video_size: file?.size || b.video_size || 0,
                      video_updated: Math.floor(Date.now() / 1000),
                      video_storage: form.storage === "gdrive" ? "gdrive" : "server",
                    }
                  : b,
              ),
            );
            setForm((f) => ({ ...f, status: "2" }));
            if (form.status === "1") {
              stats.completed = stats.canceled + 1;
              stats.pending = stats.pending - 1;
            }

            setFile(null);
            setDoc(null);
            setUp(null);
          } else {
            toast.error(res.data.message);
            setError(res.data.message);
          }
        }
      } catch (err) {
        setError("❌ " + ((err as any)?.response?.data?.message || "Something went wrong"));
      } finally {
        setLoading(false);
      }
    };

    const deleteVideo = async (list: any) => {
      const ok = window.confirm(
        `Are you sure you want to delete the uploaded video for '${list.title}'?`,
      );
      if (!ok) return;
      try {
        setLoadingId(list.id);
        const security = await getSecurity();
        const res = await axios.post(
          SERVER_URL + "api/delete-class-video",
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
            prev.map((c) =>
              c.req_id === list.req_id
                ? {
                    ...c,
                    file: "",
                    type: "",
                    video_mode: "",
                    video_status: "",
                    video_private: "",
                    hls_playlist: "",
                    hls_key_id: "",
                    video_name: "",
                    video_size: 0,
                  }
                : c,
            ),
          );
          setForm((f) =>
            f.req_id === list.req_id
              ? { ...f, file: "", type: "" }
              : f,
          );
        } else {
          toast.error(res.data.message);
        }
      } catch {
        toast.error("❌ Failed to delete class video");
      } finally {
        setLoadingId(null);
      }
    };

    const updateclassstart = async () => {
      try {
        const security = await getSecurity();

        const res = await axios.post(
          SERVER_URL + "api/live-class-start",
          {
            title: form.title,
            req_id: form.req_id,
            key: security.key,
            token: security.token,
            aut: security.aut,
          },
          {
            withCredentials: true, // 🔥 REQUIRED
          },
        );

        if (res.data.success) {
          if (!openWebLink(form.zoom_link))
            alert("This class link isn't a web link (https://…).");
        } else {
          toast.error("❌ Something went wrong");
          alert("❌ Something went wrong");
        }
      } catch (err) {
        alert("❌ Something went wrong");
      } finally {
      }
    };

    const navigate = useNavigate();

    const moveto = async (id: any) => {
      setSuccess("");
      setError("");

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
        if (!openWebLink(form.file))
          alert("This class link isn't a web link (https://…).");
      } else {
        setMode(id);
      }

      if (id === "add") {
        if (allTrainers.length == 0) {
          loadTrainers(courseid);
        }
        const initialFormn = {
          id: "",
          req_id: "",
          sno: "",
          c_id: courseid,
          b_id: batchid,
          trainer: "",
          tname: "",
          title: "",
          description: "",
          classdate: "",
          stimings: "",
          etimings: "",
          timezone: browserTz(),
          zoom_link: "",
          passcode: "",
          notes: "",
          file: "",
          pwd: "",
          type: "",
          delivery: "hls",
          delete_original: "1",
          storage: "gdrive",
          doc: "",
          attendance: 0,
          datetime: "",
          status: "",
        };
        setForm(initialFormn);
      }
    };

    const updateto = async (type: any, list: any) => {
      try {
        let classdate = list.classdate;
        let stimings = list.stimings;
        let etimings = list.etimings;
        if (type == "update") {
          const isVideo = list.status === "2" || list.status === "2S";
          const saved = Number(list.etimings) - Number(list.stimings);
          setSavedVideoDur(isVideo && saved > 0 ? saved : 0);
          if (isVideo) loadVideoLength(list.req_id);
          if (allTrainers.length == 0) {
            loadTrainers(courseid);
          }

          // the date + times as they were entered: in the class's own time zone
          const st = inputsInTz(list.stimings, list.timezone || browserTz());
          classdate = st.date || DateTime(classdate);
          stimings = st.time || timestampTime24(list.stimings);
          etimings = inputsInTz(list.etimings, list.timezone || browserTz()).time || timestampTime24(list.etimings);
        }

        setForm({
          id: list.id,
          req_id: list.req_id,
          sno: list.sno,

          c_id: list.c_id,
          b_id: list.b_id,

          trainer: list.trainer,

          tname: list.tname,

          title: list.title,

          description: list.description || "",

          classdate: classdate,

          stimings: stimings,

          etimings: etimings,

          timezone: list.timezone ? canonicalTz(list.timezone) : browserTz(),

          zoom_link: list.zoom_link,

          passcode: list.passcode,

          notes: list.notes,

          file: list.file,

          pwd: list.pwd,

          type: list.type,

          delivery: list.video_mode === "mp4" ? "mp4" : "hls",
          delete_original: "1", // used only with a new upload
          storage: list.video_storage === "server" ? "server" : "gdrive",

          doc: list.doc,

          attendance: list.attendance || 0,

          datetime: list.datetime,

          // a disabled completed class ("2S") is edited as a completed one
          status: type == "update" && list.status === "2S" ? "2" : list.status,
        });
      } catch (error) {
        console.log(error);
      }
      setMode(type);
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
        setUkey(data.key);
        setUstatus(data.id);
        loadCourses(data.id); // the role state isn't updated yet in this tick
      } else {
        navigate("/logout");
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
      const courseidx = params.get("id");
      if (courseidx && courseidx !== "null" && courseidx !== "undefined") {
        setCourseid(courseidx);
      } else {
        setCourseid("");
      }

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

        <ToastContainer position="top-right" autoClose={2500} />
        <SecurityTokenModal
          open={!!purgeTarget}
          danger
          subtitle="Token verification required to permanently delete a class"
          message={
            <>
              Delete <b>{purgeTarget ? purgeTarget.title : ""}</b> permanently? It
              will be permanently removed from the database and all associated
              recording files and documents will be deleted from storage.
              This cannot be undone.
            </>
          }
          confirmLabel="Delete Permanently"
          confirmIcon={<Trash2 size={15} />}
          onSubmit={purgeClass}
          onClose={() => setPurgeTarget(null)}
        />

        {/* Main Content */}
        <div className="content">
          {/* Scoped CSS for Redesigned Live Class Form */}
          <style
            dangerouslySetInnerHTML={{
              __html: `
          .lc-form-wrapper {
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 24px 28px;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
          }
          @media (max-width: 768px) {
            .lc-form-wrapper {
              padding: 16px 14px;
              border-radius: 12px;
            }
          }
          .lc-top-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 22px;
            gap: 12px;
          }
          .lc-top-left {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .lc-top-icon-box {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background-color: #f3f0ff;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .lc-top-title {
            font-size: 1.25rem;
            font-weight: 700;
            color: #111827;
            margin: 0 0 2px 0;
            line-height: 1.3;
          }
          .lc-top-subtitle {
            font-size: 0.84rem;
            color: #6b7280;
            margin: 0;
          }
          .lc-btn-goback {
            background-color: #ffffff;
            color: var(--ad-brand);
            border: 1.5px solid #ede9fe;
            border-radius: 9999px;
            padding: 7px 18px;
            font-size: 0.84rem;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s ease;
            white-space: nowrap;
          }
          .lc-btn-goback:hover {
            background-color: #f5f3ff;
            border-color: #ddd6fe;
            color: var(--ad-brand);
          }
          .lc-section-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            margin-bottom: 18px;
            overflow: hidden;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
          }
          .lc-section-header {
            padding: 12px 18px;
            display: flex;
            align-items: center;
            gap: 12px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.04);
          }
          .lc-header-purple {
            background-color: #f8f7ff;
          }
          .lc-header-blue {
            background-color: #f0f7ff;
          }
          .lc-header-green {
            background-color: #f0fdf4;
          }
          .lc-header-amber {
            background-color: #fffbeb;
          }
          .lc-header-sky {
            background-color: #f0f9ff;
          }
          .lc-icon-box {
            width: 36px;
            height: 36px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            color: #ffffff;
          }
          .lc-section-title {
            font-size: 0.95rem;
            font-weight: 700;
            color: #111827;
            margin: 0 0 1px 0;
          }
          .lc-section-subtitle {
            font-size: 0.8rem;
            color: #6b7280;
            margin: 0;
          }
          .lc-section-body {
            padding: 18px 20px 20px 20px;
          }
          .lc-label {
            font-size: 0.84rem;
            font-weight: 600;
            color: #374151;
            margin-bottom: 6px;
            display: block;
          }
          .lc-req {
            color: #ef4444;
            margin-left: 2px;
          }
          .lc-end-note {
            display: block;
            margin-top: 6px;
            font-size: 12px;
            color: var(--ad-muted, #64748b);
          }
          .lc-end-note b {
            color: #1e293b;
          }
          .lc-input-group {
            display: flex;
            align-items: stretch;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background-color: #ffffff;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
            overflow: hidden;
          }
          .lc-input-group:focus-within {
            border-color: var(--ad-brand);
            box-shadow: 0 0 0 3px rgba(var(--ad-brand-rgb), 0.12);
          }
          .lc-addon {
            width: 44px;
            background-color: #f8fafc;
            border-right: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            color: var(--ad-brand);
          }
          .lc-addon-top {
            align-items: flex-start;
            padding-top: 10px;
          }
          .lc-field {
            flex: 1;
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            padding: 9px 12px;
            font-size: 0.88rem;
            color: #1f2937;
            background-color: transparent;
            width: 100%;
          }
          input.lc-field, select.lc-field {
            height: 42px;
          }
          textarea.lc-field {
            resize: vertical;
            min-height: 72px;
          }
          .lc-field:disabled {
            background-color: #f8fafc;
            color: #6b7280;
            cursor: not-allowed;
          }
          .lc-field::placeholder {
            color: #9ca3af;
            font-size: 0.86rem;
          }
          .lc-counter {
            text-align: right;
            font-size: 0.78rem;
            color: #94a3b8;
            margin-top: 4px;
          }
          .lc-file-help {
            font-size: 0.78rem;
            color: #6b7280;
            margin-top: 6px;
            margin-bottom: 0;
          }
          .lc-action-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-top: 10px;
            padding-bottom: 8px;
          }
          .lc-btn-cancel {
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            color: #374151;
            border-radius: 8px;
            padding: 9px 22px;
            font-size: 0.88rem;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .lc-btn-cancel:hover {
            background-color: #f8fafc;
            border-color: #cbd5e1;
            color: #1f2937;
          }
          .lc-btn-submit {
            background-color: var(--ad-brand);
            border: 1px solid var(--ad-brand);
            color: #ffffff;
            border-radius: 8px;
            padding: 9px 24px;
            font-size: 0.88rem;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb), 0.22);
            transition: all 0.15s ease;
          }
          .lc-btn-submit:hover:not(:disabled) {
            background-color: #4823c9;
            border-color: #4823c9;
          }
          .lc-btn-submit:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }

          /* Scoped CSS for Redesigned Live Classes Board */
          .lc-stats-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 16px;
            margin-bottom: 22px;
          }
          @media (max-width: 1200px) {
            .lc-stats-grid {
              grid-template-columns: repeat(3, 1fr);
            }
          }
          @media (max-width: 768px) {
            .lc-stats-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }
          @media (max-width: 576px) {
            .lc-stats-grid {
              grid-template-columns: 1fr;
            }
          }
          .lc-stat-card {
            border-radius: 16px;
            padding: 16px 20px;
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            user-select: none;
            transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          }
          .lc-stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.07);
          }
          .lc-stat-pending {
            background: #f0f9ff;
            border: 1px solid #e0f2fe;
          }
          .lc-stat-pending.active {
            border-color: #0284c7 !important;
            box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25) !important;
          }
          .lc-stat-upcoming {
            background: #faf5ff;
            border: 1px solid #f3e8ff;
          }
          .lc-stat-upcoming.active {
            border-color: var(--ad-brand) !important;
            box-shadow: 0 0 0 2px rgba(var(--ad-brand-rgb), 0.25) !important;
          }
          .lc-stat-canceled {
            background: #fff1f2;
            border: 1px solid #ffe4e6;
          }
          .lc-stat-canceled.active {
            border-color: #ef4444 !important;
            box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25) !important;
          }
          .lc-stat-completed {
            background: #f0fdf4;
            border: 1px solid #dcfce7;
          }
          .lc-stat-completed.active {
            border-color: #10b981 !important;
            box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25) !important;
          }
          .lc-stat-deleted {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
          }
          .lc-stat-deleted.active {
            border-color: #64748b !important;
            box-shadow: 0 0 0 2px rgba(100, 116, 139, 0.25) !important;
          }
          .lc-stat-left {
            display: flex;
            align-items: center;
            gap: 16px;
            z-index: 1;
          }
          .lc-stat-icon {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .lc-stat-pending .lc-stat-icon {
            background-color: #e0f2fe;
          }
          .lc-stat-upcoming .lc-stat-icon {
            background-color: #ede9fe;
          }
          .lc-stat-canceled .lc-stat-icon {
            background-color: #fee2e2;
          }
          .lc-stat-completed .lc-stat-icon {
            background-color: #dcfce7;
          }
          .lc-stat-deleted .lc-stat-icon {
            background-color: #f1f5f9;
          }
          .lc-stat-label {
            font-size: 0.84rem;
            font-weight: 600;
            color: #64748b;
            margin-bottom: 2px;
          }
          .lc-stat-value {
            font-size: 1.65rem;
            font-weight: 800;
            color: #0f172a;
            line-height: 1;
            margin: 0;
          }
          .lc-stat-watermark {
            position: absolute;
            right: 14px;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none;
            opacity: 0.12;
          }
          .lc-filter-bar {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 10px 18px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 14px;
          }
          .lc-sort-group {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .lc-sort-label {
            font-size: 0.86rem;
            font-weight: 600;
            color: #374151;
            display: flex;
            align-items: center;
            gap: 6px;
            margin: 0;
          }
          .lc-sort-select {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            height: 38px;
            padding: 4px 14px;
            font-size: 0.86rem;
            font-weight: 500;
            color: #1f2937;
            background-color: #ffffff;
            outline: none;
            cursor: pointer;
          }
          .lc-search-group {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .lc-search-input-wrapper {
            position: relative;
          }
          .lc-search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: #94a3b8;
            pointer-events: none;
          }
          .lc-search-input {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            height: 38px;
            padding: 4px 14px 4px 36px;
            font-size: 0.86rem;
            color: #1f2937;
            background: #ffffff;
            min-width: 320px;
            outline: none;
            transition: border-color 0.15s ease;
          }
          @media (max-width: 768px) {
            .lc-search-input {
              min-width: 100%;
            }
            .lc-search-group {
              width: 100%;
            }
            .lc-search-input-wrapper {
              flex: 1;
            }
          }
          .lc-search-input:focus {
            border-color: var(--ad-brand);
          }
          .lc-reload-btn {
            width: 38px;
            height: 38px;
            border-radius: 8px;
            background-color: var(--ad-brand);
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            cursor: pointer;
            transition: background-color 0.15s ease;
            flex-shrink: 0;
          }
          .lc-reload-btn:hover {
            background-color: #4823c9;
          }
          .lc-item-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 16px 20px;
            margin-bottom: 16px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            position: relative;
            overflow: hidden;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }
          .lc-item-card:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          }
          @media (max-width: 992px) {
            .lc-item-card {
              flex-direction: column;
              align-items: flex-start;
            }
          }
          .lc-card-left-section {
            display: flex;
            align-items: center;
            gap: 20px;
            flex: 1;
          }
          @media (max-width: 768px) {
            .lc-card-left-section {
              flex-direction: column;
              align-items: flex-start;
              width: 100%;
            }
          }
          .lc-camera-box {
            width: 110px;
            min-width: 110px;
            height: 82px;
            border-radius: 12px;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .lc-camera-badge {
            position: absolute;
            top: 6px;
            left: 6px;
            border-radius: 9999px;
            padding: 2px 8px;
            font-size: 0.68rem;
            font-weight: 700;
            color: #ffffff;
          }
          .lc-item-content {
            flex: 1;
          }
          .lc-item-title {
            font-size: 1.05rem;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 10px 0;
          }
          .lc-meta-list {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 24px;
          }
          .lc-meta-item {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .lc-meta-icon {
            color: var(--ad-brand);
            flex-shrink: 0;
          }
          .lc-meta-label {
            font-size: 0.73rem;
            color: #94a3b8;
            font-weight: 500;
            line-height: 1.1;
          }
          .lc-meta-val {
            font-size: 0.84rem;
            font-weight: 600;
            color: #1e293b;
            line-height: 1.2;
          }
          .lc-card-actions {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: center;
            flex-shrink: 0;
          }
          @media (max-width: 992px) {
            .lc-card-actions {
              width: 100%;
              flex-direction: row;
              align-items: center;
              justify-content: flex-end;
              border-top: 1px solid #f1f5f9;
              padding-top: 12px;
            }
          }
          .lc-action-icons-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
          }
          .lc-action-icon-btn {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #e2e8f0;
            background-color: #ffffff;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .lc-action-icon-btn.btn-del:hover {
            background-color: #fee2e2;
            border-color: #fca5a5;
          }
          .lc-action-icon-btn.btn-cancel:hover {
            background-color: #fee2e2;
            border-color: #fca5a5;
          }
          .lc-action-icon-btn.btn-reopen:hover {
            background-color: #dcfce7;
            border-color: #86efac;
          }
          .lc-action-icon-btn.btn-edit:hover {
            background-color: #dbeafe;
            border-color: #93c5fd;
          }
          /* a secure (HLS) recording: preparing / ready / failed */
          .lc-video-pill {
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
            background: #fef3c7;
            color: #92400e;
          }
          .lc-video-pill.ready {
            width: 32px;
            height: 32px;
            padding: 0;
            justify-content: center;
            border-radius: 8px;
            background: rgba(var(--ad-brand-rgb), 0.1);
            color: var(--ad-brand);
          }
          .lc-video-pill.failed { background: #fee2e2; color: #b91c1c; }
          .lc-del-orig {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin: 10px 0 0;
            padding: 10px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            background: #f8fafc;
            cursor: pointer;
            font-weight: 400;
          }
          .lc-del-orig input {
            width: 16px;
            height: 16px;
            margin-top: 2px;
            flex: none;
            accent-color: var(--ad-brand);
            cursor: pointer;
          }
          .lc-del-orig b { display: block; font-size: 13px; font-weight: 600; color: #1e293b; }
          .lc-del-orig small { display: block; margin-top: 2px; font-size: 12px; color: #64748b; }
          .panel-dark .lc-del-orig { background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.12); }
          .panel-dark .lc-del-orig b { color: #e2e8f0; }
          .panel-dark .lc-del-orig small { color: #94a3b8; }
          .lc-video-pill.uploading {
            font-variant-numeric: tabular-nums;
            color: #1e40af;
            background: linear-gradient(90deg, #93c5fd var(--p, 0%), #dbeafe var(--p, 0%));
          }
          .lc-drive-badge {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #1a73e8;
            background: #e8f0fe;
          }
          .lc-tz-picker { flex: 1; min-width: 0; }
          .lc-tz-picker .pks-btn { font-weight: 400; font-size: 1rem; color: #1e293b; }
          .lc-tz-hint { display: block; margin-top: 6px; font-size: 12px; color: var(--ad-muted, #64748b); }
          .lc-tz-hint b { color: var(--ad-brand); font-weight: 600; }
          .lc-tz-abbr { font-size: 0.78em; font-weight: 600; color: var(--ad-muted, #64748b); }
          .lc-storage { margin-top: 12px; }
          .lc-storage-label { display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px; }
          .lc-storage-opts { display: flex; flex-wrap: wrap; gap: 8px; }
          .lc-storage-opt {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 9px 14px;
            border: 1.5px solid #e2e8f0;
            border-radius: 10px;
            background: #fff;
            font-size: 14px;
            font-weight: 600;
            color: #334155;
            cursor: pointer;
          }
          .lc-storage-opt input { position: absolute; opacity: 0; pointer-events: none; }
          .lc-storage-opt.on { border-color: var(--ad-brand); background: rgba(var(--ad-brand-rgb), 0.06); color: var(--ad-brand); }
          .lc-storage-opt:focus-within { box-shadow: 0 0 0 3px rgba(var(--ad-brand-rgb), 0.18); }
          .lc-storage small { display: block; margin-top: 6px; font-size: 12px; color: var(--ad-muted, #64748b); }
          .panel-dark .lc-storage-opt { background: transparent; border-color: var(--ad-line); color: #e2e8f0; }
          /* fills from the left as the conversion goes (--p = progress) */
          .lc-video-pill.processing {
            font-variant-numeric: tabular-nums;
            background: linear-gradient(90deg, #fcd34d var(--p, 0%), #fef3c7 var(--p, 0%));
          }
          .lc-btn-details {
            border: 1.5px solid #c7d2fe;
            background-color: #ffffff;
            color: var(--ad-brand);
            border-radius: 8px;
            padding: 6px 16px;
            font-size: 0.85rem;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.15s ease;
          }
          .lc-btn-details:hover {
            background-color: #f5f3ff;
            border-color: #a5b4fc;
          }
        
          /* Scoped CSS for Selection Card View */
          .lc-select-card-wrapper {
            margin: 24px auto 40px auto;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 20px;
            box-shadow: 0 4px 25px rgba(0, 0, 0, 0.04);
            overflow: hidden;
          }
          .lc-select-card-header {
            background: linear-gradient(90deg, #f8faff 0%, #f1f5fd 50%, #e8edfb 100%);
            padding: 24px 32px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: relative;
            overflow: hidden;
            border-bottom: 1px solid #edf2f7;
          }
          .lc-select-card-header-left {
            display: flex;
            align-items: center;
            gap: 16px;
            z-index: 1;
          }
          .lc-select-header-icon {
            width: 54px;
            height: 54px;
            border-radius: 16px;
            background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 4px 14px rgba(var(--ad-brand-rgb), 0.35);
          }
          .lc-select-header-title {
            font-size: 1.45rem;
            font-weight: 800;
            color: #0f172a;
            margin: 0 0 4px 0;
            letter-spacing: -0.01em;
          }
          .lc-select-header-subtitle {
            font-size: 0.88rem;
            color: #64748b;
            margin: 0;
          }
          .lc-select-card-art {
            height: 95px;
            object-fit: contain;
            pointer-events: none;
            z-index: 1;
          }
          @media (max-width: 640px) {
            .lc-select-card-art {
              display: none;
            }
          }
          .lc-select-card-body {
            padding: 28px 32px 34px 32px;
          }
          .lc-select-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
            margin-bottom: 28px;
          }
          @media (max-width: 768px) {
            .lc-select-grid {
              grid-template-columns: 1fr;
              gap: 18px;
            }
            .lc-select-card-body {
              padding: 20px 18px 24px 18px;
            }
            .lc-select-card-header {
              padding: 18px 20px;
            }
          }
          .lc-select-field-group {
            display: flex;
            flex-direction: column;
          }
          .lc-select-label {
            font-size: 0.88rem;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 3px;
          }
          .lc-select-label .req {
            color: #ef4444;
          }
          /* the <select> fills the whole box and the icon sits on top of it, so the
             browser's option list opens aligned with the box at its full width */
          .lc-select-input-box {
            position: relative;
            background-color: #f8fafc;
            border: 1.5px solid #e2e8f0;
            border-radius: 12px;
            height: 52px;
            transition: all 0.2s ease;
          }
          .lc-select-input-box:focus-within {
            border-color: var(--ad-brand);
            background-color: #ffffff;
            box-shadow: 0 0 0 3px rgba(var(--ad-brand-rgb), 0.12);
          }
          .lc-select-input-icon {
            position: absolute;
            left: 9px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 1;
            pointer-events: none;
            width: 36px;
            height: 36px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .lc-select-input-icon.course-icon {
            background-color: #eef2ff;
            color: var(--ad-brand);
            margin-bottom: 0;
          }
          .lc-select-input-icon.batch-icon {
            background-color: #e0f2fe;
            color: #0284c7;
          }
          .lc-select-dropdown {
            display: block;
            width: 100%;
            height: 100% !important;
            border: none !important;
            border-radius: 11px !important;
            /* keep Bootstrap's arrow (background-image), just no fill */
            background-color: transparent !important;
            background-position: right 16px center !important;
            font-size: 0.92rem;
            font-weight: 600;
            color: #1e293b;
            outline: none !important;
            box-shadow: none !important;
            padding: 0 44px 0 58px !important;
            cursor: pointer;
          }
          .lc-select-dropdown option {
            font-weight: 500;
            color: #1e293b;
            background: #ffffff;
          }
          .lc-select-btn-wrap {
            display: flex;
            justify-content: center;
          }
          .lc-select-submit-btn {
            background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%);
            color: #ffffff;
            border: none;
            border-radius: 12px;
            padding: 12px 34px;
            font-size: 0.95rem;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 16px rgba(var(--ad-brand-rgb), 0.35);
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .lc-select-submit-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(var(--ad-brand-rgb), 0.45);
            background: linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%);
          }
          .lc-select-submit-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }

        `,
            }}
          />

          {mode === "selection" && (
            <div className="container-fluid p-3">
              <div className="lc-select-card-wrapper">
                {/* Header with illustration */}
                <div className="lc-select-card-header">
                  <div className="lc-select-card-header-left">
                    <div className="lc-select-header-icon">
                      <Video size={26} color="#ffffff" />
                    </div>
                    <div>
                      <h3 className="lc-select-header-title">Live Classes</h3>
                      <p className="lc-select-header-subtitle">
                        Manage all live classes for your students
                      </p>
                    </div>
                  </div>
                  <img
                    src="/images/liveclass-selection-art.png"
                    alt="Live Classes"
                    className="lc-select-card-art"
                  />
                </div>

                {/* Form Body */}
                <div className="lc-select-card-body">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!courseid || courseid === "null") {
                        alert("Please select course");
                      } else if (!batchid || batchid === "null") {
                        alert("Please select batch");
                      } else {
                        loadDetails(page, search, sort, courseid, batchid);
                        setMode("board");
                      }
                    }}
                  >
                    <div className="lc-select-grid">
                      {/* Course */}
                      <div className="lc-select-field-group">
                        <label
                          className="lc-select-label"
                          htmlFor="select-course"
                        >
                          Preferred Course <span className="req">*</span>
                        </label>
                        <div className="lc-select-input-box">
                          <div className="lc-select-input-icon course-icon">
                            <GraduationCap size={18} />
                          </div>
                          <PickerSelect
                            id="select-course"
                            placeholder={
                              loading ? "Loading Courses..." : "Select Course"
                            }
                            emptyText="No courses available"
                            value={courseid}
                            options={courses
                              .filter((c) => c.status === "1")
                              .filter(
                                (c) =>
                                  ustatus === "X" ||
                                  ustatus === "Y" ||
                                  (ustatus === "2" &&
                                    usercourses.some(
                                      (uc) => uc.c_id === c.req_id,
                                    )),
                              )
                              .map((c) => ({
                                value: c.req_id,
                                label: decodeHtml(c.title),
                              }))}
                            onChange={(val) => {
                              setCourseid(val);
                              setBatchid("");
                              if (val) {
                                const exists = batches.some(
                                  (b) => b.req_id === val,
                                );
                                if (!exists) {
                                  loadBatches(val);
                                } else if (allTrainers.length <= 0) {
                                  loadTrainers(val);
                                }
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* Batch */}
                      <div className="lc-select-field-group">
                        <label
                          className="lc-select-label"
                          htmlFor="select-batch"
                        >
                          Preferred Batch <span className="req">*</span>
                        </label>
                        <div className="lc-select-input-box">
                          <div className="lc-select-input-icon batch-icon">
                            <Users size={18} />
                          </div>
                          <PickerSelect
                            id="select-batch"
                            placeholder={
                              courseid
                                ? "Select Batch"
                                : "Select a course first"
                            }
                            emptyText={
                              courseid
                                ? "No active batches"
                                : "Select a course first"
                            }
                            value={batchid}
                            options={batches
                              .filter((res) => res.req_id === courseid)
                              .flatMap((res) => res.data)
                              .filter(
                                (c, i, list) =>
                                  list.findIndex((x) => x.b_id === c.b_id) ===
                                  i,
                              )
                              .filter((c) => c.status === "1")
                              .filter((c) => {
                                if (ustatus !== "2") return true;
                                // a trainer tied to one batch of this course sees just that one
                                const mine = usercourses.find(
                                  (uc) => uc.c_id === courseid,
                                )?.b_id;
                                return !mine || c.b_id === mine;
                              })
                              .map((c) => ({
                                value: c.b_id,
                                label: decodeHtml(c.name),
                              }))}
                            onChange={(val) => setBatchid(val)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="lc-select-btn-wrap">
                      <button
                        type="submit"
                        className="lc-select-submit-btn"
                        disabled={loading}
                      >
                        <Video size={18} color="#ffffff" />
                        <span>{loading ? <ButtonLoader label="Loading..." /> : "Get Classes"}</span>
                        <ArrowRight size={17} color="#ffffff" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {mode === "board" && (
            <div className="container-fluid p-3 p-md-4 liveclass-page">
              {/* Top Header */}
              <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3">
                <div className="d-flex align-items-center gap-3">
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "14px",
                      backgroundColor: "#f3f0ff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Video size={24} color="var(--ad-brand)" />
                  </div>
                  <div>
                    <h3
                      className="fw-bold mb-1"
                      style={{
                        fontSize: "1.35rem",
                        color: "#111827",
                        lineHeight: "1.25",
                      }}
                    >
                      Live Classes Of {getCourseNamesByIds(courseid)}
                    </h3>
                    <p
                      className="text-muted mb-2"
                      style={{ fontSize: "0.85rem" }}
                    >
                      Manage all live classes for this batch
                    </p>
                    <div className="d-flex align-items-center gap-2">
                      <span
                        className="fw-bold"
                        style={{ fontSize: "0.95rem", color: "#111827" }}
                      >
                        {getBatchNameById(batchid)}
                      </span>
                      <span
                        style={{
                          backgroundColor: "#ede9fe",
                          color: "var(--ad-brand)",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          borderRadius: "9999px",
                          padding: "2px 8px",
                        }}
                      >
                        Batch
                      </span>
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveto("selection")}
                    className="btn"
                    style={{
                      backgroundColor: "#ffffff",
                      color: "var(--ad-brand)",
                      border: "1.5px solid #ede9fe",
                      borderRadius: "9999px",
                      padding: "7px 18px",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <ChevronLeft size={16} /> Go Back
                  </button>
                  {permCan("create") && (
                    <button
                      type="button"
                      onClick={() => moveto("add")}
                      className="btn"
                      style={{
                        backgroundColor: "var(--ad-brand)",
                        color: "#ffffff",
                        borderRadius: "8px",
                        padding: "8px 20px",
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 4px 12px rgba(var(--ad-brand-rgb), 0.22)",
                      }}
                    >
                      <Plus size={16} /> Add New
                    </button>
                  )}
                </div>
              </div>

              {/* 4 Stats Cards */}
              <div className="lc-stats-grid">
                {/* Pending */}
                <div
                  className={`lc-stat-card lc-stat-pending ${statusFilter === "pending" ? "active" : ""}`}
                  onClick={() =>
                    setStatusFilter((prev) =>
                      prev === "pending" ? "ALL" : "pending",
                    )
                  }
                  title={
                    statusFilter === "pending"
                      ? "Click to clear filter"
                      : "Filter by Pending classes"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="lc-stat-left">
                    <div className="lc-stat-icon">
                      <Calendar size={20} color="#0284c7" />
                    </div>
                    <div>
                      <div className="lc-stat-label">Pending</div>
                      <div className="lc-stat-value"><AnimatedNumber value={stats.pending} pending={loading} id="LiveClasses-s1" /></div>
                    </div>
                  </div>
                  <Calendar
                    size={56}
                    color="#0284c7"
                    className="lc-stat-watermark"
                  />
                </div>

                {/* Upcoming */}
                <div
                  className={`lc-stat-card lc-stat-upcoming ${statusFilter === "upcoming" ? "active" : ""}`}
                  onClick={() =>
                    setStatusFilter((prev) =>
                      prev === "upcoming" ? "ALL" : "upcoming",
                    )
                  }
                  title={
                    statusFilter === "upcoming"
                      ? "Click to clear filter"
                      : "Filter by Upcoming classes"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="lc-stat-left">
                    <div className="lc-stat-icon">
                      <Play
                        size={18}
                        fill="var(--ad-brand)"
                        color="var(--ad-brand)"
                      />
                    </div>
                    <div>
                      <div className="lc-stat-label">Upcoming</div>
                      <div className="lc-stat-value"><AnimatedNumber value={stats.upcoming} pending={loading} id="LiveClasses-s2" /></div>
                    </div>
                  </div>
                  <Play
                    size={56}
                    fill="var(--ad-brand)"
                    color="var(--ad-brand)"
                    className="lc-stat-watermark"
                  />
                </div>

                {/* Canceled */}
                <div
                  className={`lc-stat-card lc-stat-canceled ${statusFilter === "canceled" ? "active" : ""}`}
                  onClick={() =>
                    setStatusFilter((prev) =>
                      prev === "canceled" ? "ALL" : "canceled",
                    )
                  }
                  title={
                    statusFilter === "canceled"
                      ? "Click to clear filter"
                      : "Filter by Canceled classes"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="lc-stat-left">
                    <div className="lc-stat-icon">
                      <XCircle size={20} color="#ef4444" />
                    </div>
                    <div>
                      <div className="lc-stat-label">Canceled</div>
                      <div className="lc-stat-value"><AnimatedNumber value={stats.canceled} pending={loading} id="LiveClasses-s3" /></div>
                    </div>
                  </div>
                  <X size={56} color="#ef4444" className="lc-stat-watermark" />
                </div>

                {/* Completed */}
                <div
                  className={`lc-stat-card lc-stat-completed ${statusFilter === "completed" ? "active" : ""}`}
                  onClick={() =>
                    setStatusFilter((prev) =>
                      prev === "completed" ? "ALL" : "completed",
                    )
                  }
                  title={
                    statusFilter === "completed"
                      ? "Click to clear filter"
                      : "Filter by Completed classes"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="lc-stat-left">
                    <div className="lc-stat-icon">
                      <CheckCircle2 size={20} color="#10b981" />
                    </div>
                    <div>
                      <div className="lc-stat-label">Completed</div>
                      <div className="lc-stat-value"><AnimatedNumber value={stats.completed} pending={loading} id="LiveClasses-s4" /></div>
                    </div>
                  </div>
                  <Check
                    size={56}
                    color="#10b981"
                    className="lc-stat-watermark"
                  />
                </div>

                {/* Deleted */}
                <div
                  className={`lc-stat-card lc-stat-deleted ${statusFilter === "deleted" ? "active" : ""}`}
                  onClick={() =>
                    setStatusFilter((prev) =>
                      prev === "deleted" ? "ALL" : "deleted",
                    )
                  }
                  title={
                    statusFilter === "deleted"
                      ? "Click to clear filter"
                      : "Filter by Deleted classes"
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="lc-stat-left">
                    <div className="lc-stat-icon">
                      <Trash2 size={20} color="#64748b" />
                    </div>
                    <div>
                      <div className="lc-stat-label">Deleted</div>
                      <div className="lc-stat-value">
                        <AnimatedNumber
                          value={stats.deleted || 0}
                          pending={loading}
                          id="LiveClasses-s5"
                        />
                      </div>
                    </div>
                  </div>
                  <Trash2
                    size={56}
                    color="#64748b"
                    className="lc-stat-watermark"
                  />
                </div>
              </div>

              {/* Filter / Search Bar */}
              <div className="lc-filter-bar">
                <div className="lc-sort-group">
                  <label className="lc-sort-label">
                    <SlidersHorizontal size={16} color="#64748b" /> Sort By:
                  </label>
                  <select
                    className="lc-sort-select"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      loadDetails(
                        page,
                        search,
                        e.target.value,
                        courseid,
                        batchid,
                      );
                    }}
                  >
                    <option value="New">New</option>
                    <option value="Old">Old</option>
                  </select>
                </div>

                <div className="lc-search-group">
                  <ListSearch
                    placeholder="Search classes by title, trainer, date..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button
                    data-refresh
                    type="button"
                    className="reload-btn"
                    title="Reload"
                    onClick={() => {
                      setSearch("");
                      loadDetails(1, "", sort, courseid, batchid);
                    }}
                  >
                    <RotateCw size={16} />
                  </button>
                </div>
              </div>

              {/* Class Cards List */}
              {(() => {
                const displayedLists = alllists
                  .filter((list) => {
                    const isDel = String(list.status || "").endsWith("D");
                    if (statusFilter === "deleted") return isDel;
                    if (isDel) return false;
                    if (statusFilter === "pending") return list.status === "1";
                    if (statusFilter === "upcoming")
                      return (
                        list.status === "1" && Number(list.stimings) > datetime
                      );
                    if (statusFilter === "canceled") return list.status === "0";
                    if (statusFilter === "completed")
                      return list.status === "2" || list.status === "2S";
                    return true;
                  })
                  .sort((a, b) => {
                    const isDelA = String(a.status || "").endsWith("D");
                    const isDelB = String(b.status || "").endsWith("D");
                    if (isDelA !== isDelB) return isDelA ? 1 : -1;
                    const timeA = Number(a.stimings) || 0;
                    const timeB = Number(b.stimings) || 0;
                    if (sort === "Old") {
                      return timeA - timeB || (Number(a.id) || 0) - (Number(b.id) || 0);
                    }
                    return timeB - timeA || (Number(b.id) || 0) - (Number(a.id) || 0);
                  });

                return (
                  <div className="row g-3">
                    {alllists.length === 0 ? (
                      <div className="col-12">
                        {loading ? (
                          <SkeletonCards count={3} />
                        ) : (
                          <div className="no-data-card text-center p-5 bg-white rounded-3 border">
                            <i
                              className="fa fa-database no-data-icon mb-3"
                              style={{ fontSize: "2rem", color: "#94a3b8" }}
                            ></i>
                            {search.length === 0 ? (
                              <div>
                                <h5 className="fw-bold">No Records</h5>
                                <p className="text-muted">
                                  We couldn’t load any live classes for this
                                  batch.
                                </p>
                              </div>
                            ) : (
                              <div>
                                <h5 className="fw-bold">No Records Found</h5>
                                <p className="text-muted">
                                  We couldn’t find any live classes matching
                                  your search.
                                </p>
                              </div>
                            )}
                            <button
                              className="btn btn-primary mt-2"
                              onClick={() => {
                                setSearch("");
                                loadDetails(1, "", "", courseid, batchid);
                              }}
                            >
                              Reload
                            </button>
                          </div>
                        )}
                      </div>
                    ) : displayedLists.length === 0 ? (
                      <div className="col-12">
                        <div className="no-data-card text-center p-5 bg-white rounded-3 border">
                          <i
                            className="fa fa-filter no-data-icon mb-3"
                            style={{ fontSize: "2rem", color: "#94a3b8" }}
                          ></i>
                          <div>
                            <h5 className="fw-bold">
                              No{" "}
                              {statusFilter.charAt(0).toUpperCase() +
                                statusFilter.slice(1)}{" "}
                              Classes
                            </h5>
                            <p className="text-muted">
                              No live classes match the selected "{statusFilter}
                              " status filter.
                            </p>
                          </div>
                          <button
                            className="btn btn-outline-primary mt-2"
                            onClick={() => setStatusFilter("ALL")}
                          >
                            Clear Filter
                          </button>
                        </div>
                      </div>
                    ) : (
                      displayedLists.map((list) => (
                        <ClassCard key={list.id} list={list} />
                      ))
                    )}

                    <Pagination
                      page={page}
                      total={stats.total}
                      limit={limit}
                      lastPage={lastPage}
                      onPageChange={(p: any) => {
                        setPage(p);
                        loadDetails(p, search, sort, courseid, batchid);
                      }}
                    />
                    <div className="col-12 saved-ago-row">
                      <SavedAgo endpoint="api/live-classes" />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {mode === "add" && (
            <div className="container-fluid p-3 batches-page">
              <div className="lc-form-wrapper">
                {/* Top Header */}
                <div className="lc-top-header">
                  <div className="lc-top-left">
                    <div className="lc-top-icon-box">
                      <Video size={24} color="var(--ad-brand)" />
                    </div>
                    <div>
                      <h3 className="lc-top-title">
                        Adding a Live Class To {getCourseNamesByIds(courseid)}
                      </h3>
                      <p className="lc-top-subtitle">
                        Fill in the class details and schedule for your students
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => moveto("board")}
                    className="lc-btn-goback"
                  >
                    <ChevronLeft size={16} /> Go Back
                  </button>
                </div>

                {permCan("create") && (
                  <form onSubmit={addList}>
                    {/* Section 1: Course Information */}
                    <div className="lc-section-card">
                      <div className="lc-section-header lc-header-purple">
                        <div
                          className="lc-icon-box"
                          style={{ backgroundColor: "var(--ad-brand)" }}
                        >
                          <Layers size={18} color="#ffffff" />
                        </div>
                        <div>
                          <h4 className="lc-section-title">
                            Course Information
                          </h4>
                          <p className="lc-section-subtitle">
                            Select the course and batch for this class
                          </p>
                        </div>
                      </div>
                      <div className="lc-section-body">
                        <div className="row g-3">
                          <div className="col-md-6 col-12">
                            <label className="lc-label">
                              Class Type <span className="lc-req">*</span>
                            </label>
                            <div className="lc-input-group">
                              <div className="lc-addon">
                                <Video size={18} color="var(--ad-brand)" />
                              </div>
                              <select
                                className="form-select lc-field"
                                required
                                name="ctype"
                                id="ctype"
                                value={form.status}
                                onChange={(e) => {
                                  setForm({
                                    ...form,
                                    zoom_link: "",
                                    passcode: "",
                                    file: "",
                                    pwd: "",
                                    status: e.target.value,
                                  });
                                }}
                              >
                                <option value="">Select Class Type</option>
                                <option value="1">Live Class</option>
                                <option value="2">Ex Class Video</option>
                                <option value="3">Ex Class Link</option>
                              </select>
                            </div>
                          </div>

                          <div className="col-md-6 col-12">
                            <label className="lc-label">
                              Preferred Course <span className="lc-req">*</span>
                            </label>
                            <div className="lc-input-group">
                              <div className="lc-addon">
                                <GraduationCap
                                  size={18}
                                  color="var(--ad-brand)"
                                />
                              </div>
                              <select
                                className="form-select lc-field"
                                required
                                name="course"
                                id="course"
                                value={form.c_id || courseid}
                                onChange={(e) => {
                                  const newCid = e.target.value;
                                  setCourseid(newCid);
                                  setBatchid("");
                                  setForm({ ...form, c_id: newCid, b_id: "" });
                                  const exists = batches.some(
                                    (b) => b.req_id === newCid,
                                  );
                                  if (!exists) {
                                    loadBatches(newCid);
                                  } else if (allTrainers.length <= 0) {
                                    loadTrainers(newCid);
                                  }
                                }}
                              >
                                <option value={courseid}>
                                  {getCourseNamesByIds(courseid)}
                                </option>
                                {courses
                                  .filter((c) => c.status === "1" && c.req_id !== courseid)
                                  .map((c) => (
                                    <option key={c.req_id} value={c.req_id}>
                                      {decodeHtml(c.title)}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>

                          <div className="col-md-6 col-12">
                            <label className="lc-label">
                              Preferred Batch <span className="lc-req">*</span>
                            </label>
                            <div className="lc-input-group">
                              <div className="lc-addon">
                                <Users size={18} color="var(--ad-brand)" />
                              </div>
                              <select
                                className="form-select lc-field"
                                required
                                name="b_id"
                                id="b_id"
                                value={batchid}
                                onChange={(e) => {
                                  setBatchid(e.target.value);
                                  setForm({ ...form, b_id: e.target.value });
                                }}
                              >
                                <option value={batchid}>
                                  {getBatchNameById(batchid)}
                                </option>
                                {batches
                                  .filter((res) => res.req_id === courseid)
                                  .flatMap((res) => res.data)
                                  .filter(
                                    (c, i, list) =>
                                      list.findIndex(
                                        (x) => x.b_id === c.b_id,
                                      ) === i,
                                  )
                                  .filter(
                                    (c) =>
                                      c.status === "1" && c.b_id !== batchid,
                                  )
                                  .map((c) => (
                                    <option key={c.b_id} value={c.b_id}>
                                      {decodeHtml(c.name)}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>

                          <div className="col-md-6 col-12">
                            <label className="lc-label">
                              Storage Selection <span className="lc-req">*</span>
                            </label>
                            <div className="lc-input-group">
                              <div className="lc-addon">
                                {form.storage === "gdrive" ? (
                                  <Cloud size={18} color="var(--ad-brand)" />
                                ) : (
                                  <HardDrive size={18} color="var(--ad-brand)" />
                                )}
                              </div>
                              <select
                                className="form-select lc-field"
                                required
                                name="storage"
                                value={form.storage}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    storage: e.target.value,
                                  }))
                                }
                              >
                                <option value="gdrive">Google Drive</option>
                                <option value="server">Server</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Class Details */}
                    <div className="lc-section-card">
                      <div className="lc-section-header lc-header-blue">
                        <div
                          className="lc-icon-box"
                          style={{ backgroundColor: "#2563eb" }}
                        >
                          <FileText size={18} color="#ffffff" />
                        </div>
                        <div>
                          <h4 className="lc-section-title">Class Details</h4>
                          <p className="lc-section-subtitle">
                            Add a clear title and description for the class
                          </p>
                        </div>
                      </div>
                      <div className="lc-section-body">
                        <div className="mb-3">
                          <label className="lc-label" htmlFor="title">
                            Class Title <span className="lc-req">*</span>
                          </label>
                          <div className="lc-input-group">
                            <div className="lc-addon">
                              <Type size={18} color="var(--ad-brand)" />
                            </div>
                            <input
                              value={form.title}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  title: e.target.value,
                                }))
                              }
                              name="title"
                              type="text"
                              className="form-control lc-field"
                              placeholder="Enter Class Title"
                              id="title"
                              autoComplete="off"
                              required
                            />
                          </div>
                        </div>

                        <div className="mb-3">
                          <label className="lc-label" htmlFor="description">
                            Topic / Description{" "}
                            <span className="lc-req">*</span>
                          </label>
                          <div className="lc-input-group">
                            <div className="lc-addon lc-addon-top">
                              <List size={18} color="var(--ad-brand)" />
                            </div>
                            <textarea
                              value={form.description}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  description: e.target.value,
                                }))
                              }
                              name="description"
                              className="form-control lc-field"
                              placeholder="What will this class cover? Topics, agenda, prerequisites..."
                              id="description"
                              rows={5}
                              maxLength={20000}
                            />
                          </div>
                          <div className="lc-counter">
                            {(form.description || "").length}/20000
                          </div>
                        </div>

                        <div>
                          <label className="lc-label" htmlFor="notes">
                            Note
                          </label>
                          <div className="lc-input-group">
                            <div className="lc-addon lc-addon-top">
                              <Info size={18} color="var(--ad-brand)" />
                            </div>
                            <textarea
                              value={form.notes}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  notes: e.target.value,
                                }))
                              }
                              name="notes"
                              className="form-control lc-field"
                              placeholder="Anything students must not miss (shown highlighted in red)"
                              id="notes"
                              rows={3}
                              maxLength={5000}
                            />
                          </div>
                          <div className="lc-counter">
                            {(form.notes || "").length}/5000
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Date & Time */}
                    <div className="lc-section-card">
                      <div className="lc-section-header lc-header-green">
                        <div
                          className="lc-icon-box"
                          style={{ backgroundColor: "#10b981" }}
                        >
                          <Calendar size={18} color="#ffffff" />
                        </div>
                        <div>
                          <h4 className="lc-section-title">Date & Time</h4>
                          <p
                            className="lc-section-subtitle"
                            style={{ color: "#059669" }}
                          >
                            Set the schedule for the class
                          </p>
                        </div>
                      </div>
                      <div className="lc-section-body">
                        <div className="row g-3">
                          <div className="col-md-4 col-12">
                            <label className="lc-label">
                              Class Date <span className="lc-req">*</span>
                            </label>
                            <div className="lc-input-group">
                              <div className="lc-addon">
                                <Calendar size={18} color="var(--ad-brand)" />
                              </div>
                              <input
                                type="date"
                                className="form-control lc-field"
                                value={form.classdate}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    classdate: e.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                          </div>

                          <div className="col-md-4 col-12">
                            <label className="lc-label">
                              Class Start Time <span className="lc-req">*</span>
                            </label>
                            <div className="lc-input-group">
                              <div className="lc-addon">
                                <Clock size={18} color="var(--ad-brand)" />
                              </div>
                              <input
                                type="time"
                                className="form-control lc-field"
                                value={form.stimings}
                                onChange={(e) => {
                                  const st = e.target.value;
                                  setForm((f) => ({ ...f, stimings: st }));
                                }}
                                required
                              />
                            </div>
                            {autoEnd && (
                              <small className="lc-end-note">
                                {!videoDur && keepsVideo && videoLenLoading === form.req_id ? (
                                  "Reading the video's length…"
                                ) : classVideoDur > 0 && form.stimings && form.etimings ? (
                                  <>
                                    Ends <b>{fmtClock(form.etimings)}</b> ·{" "}
                                    {videoDur || currentVideoDur
                                      ? "video length " + fmtVideoDur(videoDur || currentVideoDur)
                                      : "same length as now (" + fmtVideoDur(savedVideoDur) + ")"}
                                  </>
                                ) : classVideoDur > 0 ? (
                                  "Video length " + fmtVideoDur(classVideoDur) + " — choose the start time and the end time follows."
                                ) : (
                                  "The end time is set from the video's length."
                                )}
                              </small>
                            )}
                          </div>

                          {!autoEnd && (
                          <div className="col-md-4 col-12">
                            <label className="lc-label">
                              Class End Time <span className="lc-req">*</span>
                            </label>
                            <div className="lc-input-group">
                              <div className="lc-addon">
                                <Clock size={18} color="var(--ad-brand)" />
                              </div>
                              <input
                                type="time"
                                className="form-control lc-field"
                                value={form.etimings}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    etimings: e.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            {form.status === "2" && (
                              <small className="lc-end-note">
                                Couldn't read the video's length — please enter the end time.
                              </small>
                            )}
                          </div>
                          )}
                          {timezoneField()}
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Trainer */}
                    <div className="lc-section-card">
                      <div className="lc-section-header lc-header-amber">
                        <div
                          className="lc-icon-box"
                          style={{ backgroundColor: "#f59e0b" }}
                        >
                          <User size={18} color="#ffffff" />
                        </div>
                        <div>
                          <h4 className="lc-section-title">Trainer</h4>
                          <p className="lc-section-subtitle">
                            Select the trainer who will take this class
                          </p>
                        </div>
                      </div>
                      <div className="lc-section-body">
                        <label className="lc-label">
                          Trainer <span className="lc-req">*</span>
                        </label>
                        <div className="lc-input-group">
                          <div className="lc-addon">
                            <User size={18} color="var(--ad-brand)" />
                          </div>
                          <select
                            className="form-select lc-field"
                            required
                            name="trainer"
                            id="trainer"
                            value={form.trainer}
                            onChange={(e) => {
                              setForm({ ...form, trainer: e.target.value });
                            }}
                          >
                            <option value="">Select Trainer</option>
                            {trainers.map((c) => (
                              <option key={c.mem_id} value={c.mem_id}>
                                {decodeHtml(c.name)} - {c.email}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Conditional: Live Meeting Details */}
                    {form.status === "1" && (
                      <div className="lc-section-card">
                        <div className="lc-section-header lc-header-purple">
                          <div
                            className="lc-icon-box"
                            style={{ backgroundColor: "var(--ad-brand)" }}
                          >
                            <Video size={18} color="#ffffff" />
                          </div>
                          <div>
                            <h4 className="lc-section-title">
                              Live Meeting Details
                            </h4>
                            <p className="lc-section-subtitle">
                              Set up the Zoom meeting link and passcode for
                              students
                            </p>
                          </div>
                        </div>
                        <div className="lc-section-body">
                          <div className="row g-3">
                            <div className="col-md-7 col-12">
                              <label className="lc-label">
                                Zoom Link <span className="lc-req">*</span>
                              </label>
                              <div className="lc-input-group">
                                <div className="lc-addon">
                                  <LinkIcon size={18} color="var(--ad-brand)" />
                                </div>
                                <input
                                  type="text"
                                  className="form-control lc-field"
                                  value={form.zoom_link}
                                  placeholder="Enter Zoom Link"
                                  onChange={(e) =>
                                    setForm((f) => ({
                                      ...f,
                                      zoom_link: e.target.value,
                                    }))
                                  }
                                  required
                                />
                              </div>
                            </div>
                            <div className="col-md-5 col-12">
                              <label className="lc-label">
                                Zoom Passcode (Optional)
                              </label>
                              <div className="lc-input-group">
                                <div className="lc-addon">
                                  <Key size={18} color="var(--ad-brand)" />
                                </div>
                                <input
                                  type="text"
                                  className="form-control lc-field"
                                  value={form.passcode}
                                  placeholder="Enter Zoom Passcode (optional)"
                                  onChange={(e) =>
                                    setForm((f) => ({
                                      ...f,
                                      passcode: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Conditional: Video Upload */}
                    {form.status === "2" && (
                      <div className="lc-section-card">
                        <div className="lc-section-header lc-header-purple">
                          <div
                            className="lc-icon-box"
                            style={{ backgroundColor: "var(--ad-brand)" }}
                          >
                            <Video size={18} color="#ffffff" />
                          </div>
                          <div>
                            <h4 className="lc-section-title">
                              Class Video Recording
                            </h4>
                            <p className="lc-section-subtitle">
                              Upload recorded video file for this class
                            </p>
                          </div>
                        </div>
                        <div className="lc-section-body">
                          <label className="lc-label">
                            Video <span className="lc-req">*</span>
                          </label>
                          <div className="lc-input-group">
                            <div className="lc-addon">
                              <Video size={18} color="var(--ad-brand)" />
                            </div>
                            <input
                              type="file"
                              className="form-control lc-field"
                              accept="video/*"
                              onChange={(e: any) => {
                                const picked: File | undefined =
                                  e.target.files[0];
                                setFile(picked || null);
                                setUp(null);
                                setForm((f) => ({
                                  ...f,
                                  file: e.target.value,
                                }));
                                setVideoDur(0);
                                setVideoDurFailed(false);
                                if (picked) {
                                  readVideoDuration(picked).then((d) => {
                                    setVideoDur(d);
                                    setVideoDurFailed(!d);
                                  });
                                }
                              }}
                              required
                            />
                          </div>
                          <label className="lc-label" style={{ marginTop: 14 }}>
                            Video delivery
                          </label>
                          <div className="lc-input-group">
                            <div className="lc-addon">
                              <Key size={18} color="var(--ad-brand)" />
                            </div>
                            <select
                              className="form-select lc-field"
                              value={form.delivery}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  delivery: e.target.value,
                                }))
                              }
                            >
                              <option value="hls">
                                Secure stream (HLS, encrypted) — prepared after
                                upload
                              </option>
                              <option value="mp4">
                                Original (MP4) — played only to signed-in
                                viewers
                              </option>
                            </select>
                          </div>
                          <small
                            style={{
                              display: "block",
                              marginTop: 6,
                              color: "var(--ad-muted, #64748b)",
                              fontSize: "12px",
                            }}
                          >
                            {form.delivery === "hls"
                              ? "Converted in the background into encrypted (AES-128) segments; students see “being prepared” until it is ready."
                              : "The original file is kept private and streamed only to signed-in admins, the trainer and enrolled students."}
                          </small>
                          {deleteOriginalField()}
{storageField()}
                        </div>
                      </div>
                    )}

                    {/* Conditional: Video Link */}
                    {form.status === "3" && (
                      <div className="lc-section-card">
                        <div className="lc-section-header lc-header-purple">
                          <div
                            className="lc-icon-box"
                            style={{ backgroundColor: "var(--ad-brand)" }}
                          >
                            <LinkIcon size={18} color="#ffffff" />
                          </div>
                          <div>
                            <h4 className="lc-section-title">
                              Recorded Video Link
                            </h4>
                            <p className="lc-section-subtitle">
                              Provide video link and pin
                            </p>
                          </div>
                        </div>
                        <div className="lc-section-body">
                          <div className="row g-3">
                            <div className="col-md-7 col-12">
                              <label className="lc-label">
                                Video Link <span className="lc-req">*</span>
                              </label>
                              <div className="lc-input-group">
                                <div className="lc-addon">
                                  <LinkIcon size={18} color="var(--ad-brand)" />
                                </div>
                                <input
                                  type="text"
                                  className="form-control lc-field"
                                  value={form.file}
                                  placeholder="Enter Video Link"
                                  onChange={(e) =>
                                    setForm((f) => ({
                                      ...f,
                                      file: e.target.value,
                                    }))
                                  }
                                  required
                                />
                              </div>
                            </div>
                            <div className="col-md-5 col-12">
                              <label className="lc-label">Video Pin</label>
                              <div className="lc-input-group">
                                <div className="lc-addon">
                                  <Key size={18} color="var(--ad-brand)" />
                                </div>
                                <input
                                  type="text"
                                  className="form-control lc-field"
                                  value={form.pwd}
                                  placeholder="Enter Video Pin / Passcode"
                                  onChange={(e) =>
                                    setForm((f) => ({
                                      ...f,
                                      pwd: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section 5: Document (Optional) */}
                    <div className="lc-section-card">
                      <div className="lc-section-header lc-header-sky">
                        <div
                          className="lc-icon-box"
                          style={{ backgroundColor: "#0ea5e9" }}
                        >
                          <Paperclip size={18} color="#ffffff" />
                        </div>
                        <div>
                          <h4 className="lc-section-title">
                            Document (Optional)
                          </h4>
                          <p className="lc-section-subtitle">
                            Upload any related files (slides, agenda, etc.)
                          </p>
                        </div>
                      </div>
                      <div className="lc-section-body">
                        <div className="lc-input-group">
                          <div className="lc-addon">
                            <Paperclip size={18} color="var(--ad-brand)" />
                          </div>
                          <input
                            type="file"
                            className="form-control lc-field"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                            onChange={(e: any) => {
                              setDoc(e.target.files[0]);
                              setUp(null);
                              setForm((f) => ({ ...f, doc: e.target.value }));
                            }}
                          />
                        </div>
                        <p className="lc-file-help">
                          Accepted file types: PDF, PPT, DOC, DOCX (Max 10 MB)
                        </p>
                        {storageField()}
                      </div>
                    </div>

                    {/* Status / Alert Messages */}
                    {success && (
                      <div
                        className="alert alert-success d-flex align-items-center gap-2 mb-3 py-2 px-3"
                        style={{ borderRadius: "8px", fontSize: "0.9rem" }}
                      >
                        <Check size={18} /> {success}
                      </div>
                    )}

                    {error && (
                      <div
                        className="alert alert-danger d-flex align-items-center gap-2 mb-3 py-2 px-3"
                        style={{ borderRadius: "8px", fontSize: "0.9rem" }}
                      >
                        <X size={18} /> {error}
                      </div>
                    )}

                    {loading && <UploadProgress up={up} />}

                    {/* Action Bar */}
                    <div className="lc-action-bar">
                      <button
                        type="button"
                        onClick={() => moveto("board")}
                        className="lc-btn-cancel"
                      >
                        <X size={16} /> Cancel
                      </button>
                      <button
                        type="submit"
                        className="lc-btn-submit"
                        disabled={loading}
                      >
                        <Plus size={16} /> {loading ? <ButtonLoader label="Adding..." /> : "Add Class"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {mode === "update" && (
            <div className="container-fluid p-3 batches-page">
              <div className="lc-form-wrapper">
                {/* Top Header */}
                <div className="lc-top-header">
                  <div className="lc-top-left">
                    <div className="lc-top-icon-box">
                      <Video size={24} color="var(--ad-brand)" />
                    </div>
                    <div>
                      <h3 className="lc-top-title">
                        Updating Live Class -{" "}
                        {form.title || getCourseNamesByIds(courseid)}
                      </h3>
                      <p className="lc-top-subtitle">
                        Fill in the class details and schedule for your students
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => moveto("board")}
                    className="lc-btn-goback"
                  >
                    <ChevronLeft size={16} /> Go Back
                  </button>
                </div>

                {permCan("edit") && (
                  <form onSubmit={updateList}>
                    {/* Section 1: Course Information */}
                    <div className="lc-section-card">
                      <div className="lc-section-header lc-header-purple">
                        <div
                          className="lc-icon-box"
                          style={{ backgroundColor: "var(--ad-brand)" }}
                        >
                          <Layers size={18} color="#ffffff" />
                        </div>
                        <div>
                          <h4 className="lc-section-title">
                            Course Information
                          </h4>
                          <p className="lc-section-subtitle">
                            Select the course and batch for this class
                          </p>
                        </div>
                      </div>
                      <div className="lc-section-body">
                        <div className="row g-3">
                          <div className="col-md-6 col-12">
                            <label className="lc-label">
                              Class Type <span className="lc-req">*</span>
                            </label>
                            <div className="lc-input-group">
                              <div className="lc-addon">
                                <Video size={18} color="var(--ad-brand)" />
                              </div>
                              <select
                                className="form-select lc-field"
                                required
                                name="batch"
                                id="batch"
                                value={form.status}
                                disabled
                                onChange={(e) => {
                                  setForm({ ...form, status: e.target.value });
                                }}
                              >
                                <option value="">Select Class Type</option>
                                <option value="1">Live Class</option>
                                <option value="2">Ex Class</option>
                              </select>
                            </div>
                          </div>

                          <div className="col-md-6 col-12">
                            <label className="lc-label">
                              Preferred Course <span className="lc-req">*</span>
                            </label>
                            <div className="lc-input-group">
                              <div className="lc-addon">
                                <GraduationCap
                                  size={18}
                                  color="var(--ad-brand)"
                                />
                              </div>
                              <select
                                className="form-select lc-field"
                                required
                                name="course"
                                id="course"
                                value={form.c_id || courseid}
                                onChange={(e) => {
                                  const newCid = e.target.value;
                                  setCourseid(newCid);
                                  setBatchid("");
                                  setForm({ ...form, c_id: newCid, b_id: "" });
                                  const exists = batches.some(
                                    (b) => b.req_id === newCid,
                                  );
                                  if (!exists) {
                                    loadBatches(newCid);
                                  }
                                }}
                              >
                                <option value={courseid}>
                                  {getCourseNamesByIds(courseid)}
                                </option>
                                {courses
                                  .filter((c) => c.status === "1" && c.req_id !== courseid)
                                  .map((c) => (
                                    <option key={c.req_id} value={c.req_id}>
                                      {decodeHtml(c.title)}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>

                          <div className="col-md-6 col-12">
                            <label className="lc-label">
                              Preferred Batch <span className="lc-req">*</span>
                            </label>
                            <div className="lc-input-group">
                              <div className="lc-addon">
                                <Users size={18} color="var(--ad-brand)" />
                              </div>
                              <select
                                className="form-select lc-field"
                                required
                                name="batch"
                                id="batch"
                                value={form.b_id || batchid}
                                onChange={(e) => {
                                  setBatchid(e.target.value);
                                  setForm({ ...form, b_id: e.target.value });
                                }}
                              >
                                <option value={batchid}>
                                  {getBatchNameById(batchid)}
                                </option>
                                {batches
                                  .filter((res) => res.req_id === courseid)
                                  .flatMap((res) => res.data)
                                  .filter(
                                    (c, i, list) =>
                                      list.findIndex(
                                        (x) => x.b_id === c.b_id,
                                      ) === i,
                                  )
                                  .filter(
                                    (c) =>
                                      c.status === "1" && c.b_id !== batchid,
                                  )
                                  .map((c) => (
                                    <option key={c.b_id} value={c.b_id}>
                                      {decodeHtml(c.name)}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>

                          <div className="col-md-6 col-12">
                            <label className="lc-label">
                              Storage Selection <span className="lc-req">*</span>
                            </label>
                            <div className="lc-input-group">
                              <div className="lc-addon">
                                {form.storage === "gdrive" ? (
                                  <Cloud size={18} color="var(--ad-brand)" />
                                ) : (
                                  <HardDrive size={18} color="var(--ad-brand)" />
                                )}
                              </div>
                              <select
                                className="form-select lc-field"
                                required
                                name="storage"
                                value={form.storage}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    storage: e.target.value,
                                  }))
                                }
                              >
                                <option value="gdrive">Google Drive</option>
                                <option value="server">Server</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Class Details */}
                    <div className="lc-section-card">
                      <div className="lc-section-header lc-header-blue">
                        <div
                          className="lc-icon-box"
                          style={{ backgroundColor: "#2563eb" }}
                        >
                          <FileText size={18} color="#ffffff" />
                        </div>
                        <div>
                          <h4 className="lc-section-title">Class Details</h4>
                          <p className="lc-section-subtitle">
                            Add a clear title and description for the class
                          </p>
                        </div>
                      </div>
                      <div className="lc-section-body">
                        <div className="mb-3">
                          <label className="lc-label" htmlFor="title">
                            Class Title <span className="lc-req">*</span>
                          </label>
                          <div className="lc-input-group">
                            <div className="lc-addon">
                              <Type size={18} color="var(--ad-brand)" />
                            </div>
                            <input
                              value={form.title}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  title: e.target.value,
                                }))
                              }
                              name="title"
                              type="text"
                              className="form-control lc-field"
                              placeholder="Enter Class Title"
                              id="title"
                              autoComplete="off"
                              required
                            />
                          </div>
                        </div>

                        <div className="mb-3">
                          <label className="lc-label" htmlFor="description">
                            Topic / Description{" "}
                            <span className="lc-req">*</span>
                          </label>
                          <div className="lc-input-group">
                            <div className="lc-addon lc-addon-top">
                              <List size={18} color="var(--ad-brand)" />
                            </div>
                            <textarea
                              value={form.description}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  description: e.target.value,
                                }))
                              }
                              name="description"
                              className="form-control lc-field"
                              placeholder="What will this class cover? Topics, agenda, prerequisites..."
                              id="description"
                              rows={5}
                              maxLength={20000}
                            />
                          </div>
                          <div className="lc-counter">
                            {(form.description || "").length}/20000
                          </div>
                        </div>

                        <div>
                          <label className="lc-label" htmlFor="notes">
                            Note
                          </label>
                          <div className="lc-input-group">
                            <div className="lc-addon lc-addon-top">
                              <Info size={18} color="var(--ad-brand)" />
                            </div>
                            <textarea
                              value={form.notes}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  notes: e.target.value,
                                }))
                              }
                              name="notes"
                              className="form-control lc-field"
                              placeholder="Anything students must not miss (shown highlighted in red)"
                              id="notes"
                              rows={3}
                              maxLength={5000}
                            />
                          </div>
                          <div className="lc-counter">
                            {(form.notes || "").length}/5000
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Date & Time */}
                    <div className="lc-section-card">
                      <div className="lc-section-header lc-header-green">
                        <div
                          className="lc-icon-box"
                          style={{ backgroundColor: "#10b981" }}
                        >
                          <Calendar size={18} color="#ffffff" />
                        </div>
                        <div>
                          <h4 className="lc-section-title">Date & Time</h4>
                          <p
                            className="lc-section-subtitle"
                            style={{ color: "#059669" }}
                          >
                            Set the schedule for the class
                          </p>
                        </div>
                      </div>
                      <div className="lc-section-body">
                        <div className="row g-3">
                          <div className="col-md-4 col-12">
                            <label className="lc-label">
                              Class Date <span className="lc-req">*</span>
                            </label>
                            <div className="lc-input-group">
                              <div className="lc-addon">
                                <Calendar size={18} color="var(--ad-brand)" />
                              </div>
                              <input
                                type="date"
                                className="form-control lc-field"
                                value={form.classdate}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    classdate: e.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                          </div>

                          <div className="col-md-4 col-12">
                            <label className="lc-label">
                              Class Start Time <span className="lc-req">*</span>
                            </label>
                            <div className="lc-input-group">
                              <div className="lc-addon">
                                <Clock size={18} color="var(--ad-brand)" />
                              </div>
                              <input
                                type="time"
                                className="form-control lc-field"
                                value={form.stimings}
                                onChange={(e) => {
                                  const st = e.target.value;
                                  setForm((f) => ({ ...f, stimings: st }));
                                }}
                                required
                              />
                            </div>
                            {autoEnd && (
                              <small className="lc-end-note">
                                {!videoDur && keepsVideo && videoLenLoading === form.req_id ? (
                                  "Reading the video's length…"
                                ) : classVideoDur > 0 && form.stimings && form.etimings ? (
                                  <>
                                    Ends <b>{fmtClock(form.etimings)}</b> ·{" "}
                                    {videoDur || currentVideoDur
                                      ? "video length " + fmtVideoDur(videoDur || currentVideoDur)
                                      : "same length as now (" + fmtVideoDur(savedVideoDur) + ")"}
                                  </>
                                ) : classVideoDur > 0 ? (
                                  "Video length " + fmtVideoDur(classVideoDur) + " — choose the start time and the end time follows."
                                ) : (
                                  "The end time is set from the video's length."
                                )}
                              </small>
                            )}
                          </div>

                          {!autoEnd && (
                          <div className="col-md-4 col-12">
                            <label className="lc-label">
                              Class End Time <span className="lc-req">*</span>
                            </label>
                            <div className="lc-input-group">
                              <div className="lc-addon">
                                <Clock size={18} color="var(--ad-brand)" />
                              </div>
                              <input
                                type="time"
                                className="form-control lc-field"
                                value={form.etimings}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    etimings: e.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            {form.status === "2" && (
                              <small className="lc-end-note">
                                Couldn't read the video's length — please enter the end time.
                              </small>
                            )}
                          </div>
                          )}
                          {timezoneField()}
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Trainer */}
                    <div className="lc-section-card">
                      <div className="lc-section-header lc-header-amber">
                        <div
                          className="lc-icon-box"
                          style={{ backgroundColor: "#f59e0b" }}
                        >
                          <User size={18} color="#ffffff" />
                        </div>
                        <div>
                          <h4 className="lc-section-title">Trainer</h4>
                          <p className="lc-section-subtitle">
                            Select the trainer who will take this class
                          </p>
                        </div>
                      </div>
                      <div className="lc-section-body">
                        <label className="lc-label">
                          Trainer <span className="lc-req">*</span>
                        </label>
                        <div className="lc-input-group">
                          <div className="lc-addon">
                            <User size={18} color="var(--ad-brand)" />
                          </div>
                          <select
                            className="form-select lc-field"
                            required
                            name="trainer"
                            id="trainer"
                            value={form.trainer}
                            onChange={(e) => {
                              setForm({ ...form, trainer: e.target.value });
                            }}
                          >
                            <option value="">Select Trainer</option>
                            {trainers.map((c) => (
                              <option key={c.mem_id} value={c.mem_id}>
                                {decodeHtml(c.name)} - {c.email}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Conditional: Live Meeting Details */}
                    {form.status === "1" && (
                      <div className="lc-section-card">
                        <div className="lc-section-header lc-header-purple">
                          <div
                            className="lc-icon-box"
                            style={{ backgroundColor: "var(--ad-brand)" }}
                          >
                            <Video size={18} color="#ffffff" />
                          </div>
                          <div>
                            <h4 className="lc-section-title">
                              Live Meeting Details
                            </h4>
                            <p className="lc-section-subtitle">
                              Set up the Zoom meeting link and passcode for
                              students
                            </p>
                          </div>
                        </div>
                        <div className="lc-section-body">
                          <div className="row g-3">
                            <div className="col-md-7 col-12">
                              <label className="lc-label">
                                Zoom Link <span className="lc-req">*</span>
                              </label>
                              <div className="lc-input-group">
                                <div className="lc-addon">
                                  <LinkIcon size={18} color="var(--ad-brand)" />
                                </div>
                                <input
                                  type="text"
                                  className="form-control lc-field"
                                  value={form.zoom_link}
                                  placeholder="Enter Zoom Link"
                                  onChange={(e) =>
                                    setForm((f) => ({
                                      ...f,
                                      zoom_link: e.target.value,
                                    }))
                                  }
                                  required
                                />
                              </div>
                            </div>
                            <div className="col-md-5 col-12">
                              <label className="lc-label">
                                Zoom Passcode (Optional)
                              </label>
                              <div className="lc-input-group">
                                <div className="lc-addon">
                                  <Key size={18} color="var(--ad-brand)" />
                                </div>
                                <input
                                  type="text"
                                  className="form-control lc-field"
                                  value={form.passcode}
                                  placeholder="Enter Zoom Passcode (optional)"
                                  onChange={(e) =>
                                    setForm((f) => ({
                                      ...f,
                                      passcode: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Conditional: Video Upload */}
                    {form.status === "2" && editRecLink && (
                      <div className="lc-section-card">
                        <div className="lc-section-body">
                          <label className="lc-label">Recording link</label>
                          <div
                            style={{
                              wordBreak: "break-all",
                              fontSize: "0.9rem",
                            }}
                          >
                            {editRec}
                          </div>
                          <small style={{ color: "var(--ad-muted, #64748b)" }}>
                            This class's recording is a link — change it from
                            Class Details.
                          </small>
                        </div>
                      </div>
                    )}
                    {form.status === "2" && !editRecLink && (
                      <div className="lc-section-card">
                        <div className="lc-section-header lc-header-purple">
                          <div
                            className="lc-icon-box"
                            style={{ backgroundColor: "var(--ad-brand)" }}
                          >
                            <Video size={18} color="#ffffff" />
                          </div>
                          <div>
                            <h4 className="lc-section-title">
                              Class Video Recording
                            </h4>
                            <p className="lc-section-subtitle">
                              Upload recorded video file for this class
                            </p>
                          </div>
                        </div>
                        <div className="lc-section-body">
                          <label className="lc-label">
                            {editHasVideo ? (
                              "Replace video (optional — leave empty to keep the current one)"
                            ) : (
                              <>
                                Video <span className="lc-req">*</span>
                              </>
                            )}
                          </label>
                          <div className="lc-input-group">
                            <div className="lc-addon">
                              <Video size={18} color="var(--ad-brand)" />
                            </div>
                            <input
                              type="file"
                              className="form-control lc-field"
                              accept="video/*"
                              onChange={(e: any) => {
                                const picked: File | undefined =
                                  e.target.files[0];
                                setFile(picked || null);
                                setUp(null);
                                setForm((f) => ({
                                  ...f,
                                  file: e.target.value,
                                }));
                                setVideoDur(0);
                                setVideoDurFailed(false);
                                if (picked) {
                                  readVideoDuration(picked).then((d) => {
                                    setVideoDur(d);
                                    setVideoDurFailed(!d);
                                  });
                                }
                              }}
                              required={!editHasVideo}
                            />
                          </div>
                          <label className="lc-label" style={{ marginTop: 14 }}>
                            Video delivery
                          </label>
                          <div className="lc-input-group">
                            <div className="lc-addon">
                              <Key size={18} color="var(--ad-brand)" />
                            </div>
                            <select
                              className="form-select lc-field"
                              value={form.delivery}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  delivery: e.target.value,
                                }))
                              }
                            >
                              <option value="hls">
                                Secure stream (HLS, encrypted) — prepared after
                                upload
                              </option>
                              <option value="mp4">
                                Original (MP4) — played only to signed-in
                                viewers
                              </option>
                            </select>
                          </div>
                          <small
                            style={{
                              display: "block",
                              marginTop: 6,
                              color: "var(--ad-muted, #64748b)",
                              fontSize: "12px",
                            }}
                          >
                            {form.delivery === "hls"
                              ? "Converted in the background into encrypted (AES-128) segments; students see “being prepared” until it is ready."
                              : "The original file is kept private and streamed only to signed-in admins, the trainer and enrolled students."}
                          </small>
                          {deleteOriginalField()}
{storageField()}
                        </div>
                      </div>
                    )}

                    {/* Section 5: Document (Optional) */}
                    <div className="lc-section-card">
                      <div className="lc-section-header lc-header-sky">
                        <div
                          className="lc-icon-box"
                          style={{ backgroundColor: "#0ea5e9" }}
                        >
                          <Paperclip size={18} color="#ffffff" />
                        </div>
                        <div>
                          <h4 className="lc-section-title">
                            Document (Optional)
                          </h4>
                          <p className="lc-section-subtitle">
                            Upload any related files (slides, agenda, etc.)
                          </p>
                        </div>
                      </div>
                      <div className="lc-section-body">
                        <div className="lc-input-group">
                          <div className="lc-addon">
                            <Paperclip size={18} color="var(--ad-brand)" />
                          </div>
                          <input
                            type="file"
                            className="form-control lc-field"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                            onChange={(e: any) => {
                              setDoc(e.target.files[0]);
                              setUp(null);
                              setForm((f) => ({ ...f, doc: e.target.value }));
                            }}
                          />
                        </div>
                        {form.doc && (
                          <div className="mt-2">
                            <a
                              href={classDocUrl(form.doc, form.req_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="d-inline-flex align-items-center gap-1 text-decoration-none fw-semibold"
                              style={{
                                fontSize: "0.82rem",
                                color: "var(--ad-brand)",
                              }}
                            >
                              <i className="fa fa-file"></i> Current document:{" "}
                              {form.doc.split("/").pop()}
                            </a>
                          </div>
                        )}
                        <p className="lc-file-help">
                          Accepted file types: PDF, PPT, DOC, DOCX (Max 10 MB)
                        </p>
                        {storageField()}
                      </div>
                    </div>

                    {/* Status / Alert Messages */}
                    {success && (
                      <div
                        className="alert alert-success d-flex align-items-center gap-2 mb-3 py-2 px-3"
                        style={{ borderRadius: "8px", fontSize: "0.9rem" }}
                      >
                        <Check size={18} /> {success}
                      </div>
                    )}

                    {error && (
                      <div
                        className="alert alert-danger d-flex align-items-center gap-2 mb-3 py-2 px-3"
                        style={{ borderRadius: "8px", fontSize: "0.9rem" }}
                      >
                        <X size={18} /> {error}
                      </div>
                    )}

                    {loading && <UploadProgress up={up} />}

                    {/* Action Bar */}
                    <div className="lc-action-bar">
                      <button
                        type="button"
                        onClick={() => moveto("board")}
                        className="lc-btn-cancel"
                      >
                        <X size={16} /> Cancel
                      </button>
                      <button
                        type="submit"
                        className="lc-btn-submit"
                        disabled={loading}
                      >
                        <Check size={16} />{" "}
                        {loading ? <ButtonLoader label="Updating..." /> : "Update Class"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {mode === "view" && (
            <div
              className="container-fluid p-3 liveclass-page view"
              style={{ minHeight: "auto", background: "none" }}
            >
              <div className="mx-auto">
                <ClassHeroCard
                  item={rowOf(form)}
                  courseName={getCourseNamesByIds(form.c_id || courseid)}
                  batchName={getBatchNameById(form.b_id || batchid)}
                  trainerName={
                    getTrainerNameById(form.trainer || form.tname) ||
                    getTrainerNameById(form.tname) ||
                    form.tname
                  }
                  isTrainer={
                    ustatus === "2" || ustatus === "X" || ustatus === "Y"
                  }
                  showGoBack={true}
                  onGoBack={() => moveto("board")}
                  onJoinOrStart={() => {
                    const datetime = Math.floor(Date.now() / 1000);
                    const st = Number(form.stimings) - 10 * 60;
                    if (st >= datetime) {
                      alert("You can start before 10min only");
                    } else {
                      updateclassstart();
                    }
                  }}
                  onViewVideo={() => moveto("play")}
                />

                {/* Status Messages */}
                {success && (
                  <div
                    className="alert alert-success d-flex align-items-center gap-2 mb-3 py-2 px-3"
                    style={{ borderRadius: "8px", fontSize: "0.9rem" }}
                  >
                    <Check size={18} /> {success}
                  </div>
                )}

                {error && (
                  <div
                    className="alert alert-danger d-flex align-items-center gap-2 mb-3 py-2 px-3"
                    style={{ borderRadius: "8px", fontSize: "0.9rem" }}
                  >
                    <X size={18} /> {error}
                  </div>
                )}

                {loading && <UploadProgress up={up} />}

                {/* Admin Actions Bar (Upload Class Video / Update Video Link) */}
                {form.status === "1" &&
                  ((ustatus === "2" && form.trainer === ukey) ||
                    ustatus === "X" ||
                    ustatus === "Y") && (
                    <div
                      className="card shadow-sm p-3 mt-3 d-flex flex-row align-items-center justify-content-between flex-wrap gap-3"
                      style={{
                        borderRadius: "16px",
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                      }}
                    >
                      <div>
                        <h6
                          className="fw-bold mb-1"
                          style={{ color: "#1e1b4b" }}
                        >
                          Class Video Management
                        </h6>
                        <small className="text-muted">
                          Upload the recorded class video or update the video
                          link for students
                        </small>
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm fw-semibold px-3 py-2"
                          style={{ borderRadius: "8px" }}
                          onClick={() => setModel("uv")}
                        >
                          <i className="fa fa-upload me-1"></i> Upload Class
                          Video
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm fw-semibold px-3 py-2"
                          style={{ borderRadius: "8px" }}
                          onClick={() => setModel("uvl")}
                        >
                          <i className="fa fa-link me-1"></i> Update Video Link
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

          {mode === "play" && (
            <div className="container-fluid p-4 liveclass-page view">
              <div className="row">
                {/* Title */}
                <h3
                  className="fw-bold pagehead"
                  style={{ position: "relative", padding: "0px" }}
                >
                  <Icon />A Class Details in {getCourseNamesByIds(courseid)}
                  <span className="totalcount">
                    <a
                      onClick={() => moveto("view")}
                      className="add btn btn-success"
                    >
                      Go Back
                    </a>
                  </span>
                </h3>
              </div>

              <div className="row g-4 contentbox">
                <div className="class-view-card shadow-sm col-sm-12 p-3 p-md-4">
                  <div
                    className="lc-player-frame"
                    style={{
                      position: "relative",
                      width: "100%",
                      maxWidth: 1100,
                      margin: "0 auto",
                      aspectRatio: "16 / 9",
                      minHeight: 280,
                      borderRadius: 16,
                      overflow: "hidden",
                      background: "#000",
                      boxShadow: "0 18px 40px -20px rgba(15, 23, 42, 0.45)",
                    }}
                  >
                    <ClassVideo
                      item={rowOf(form)}
                      autoPlay
                      className="w-100 h-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- Modal ---------------- */}
          {model === "uvl" && (
            <div
              className="modal fade show d-block"
              style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            >
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Update Class Video Link</h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setModel("")}
                    ></button>
                  </div>
                  {permCan("recording") && (
                    <form onSubmit={updatevideolink} className="update-form">
                      <div className="modal-body">
                        <div className="form-group mb-3">
                          <label htmlFor="cpassword">
                            Video Link : <span className="text-danger">*</span>
                          </label>

                          <input
                            name="link"
                            type="text"
                            className="form-control"
                            placeholder="Please Enter Video Link *"
                            value={vform.link}
                            onChange={handleVChange}
                            required
                          />
                        </div>

                        {/* New Password */}
                        <div className="form-group mb-3">
                          <label htmlFor="npassword">Password :</label>

                          <input
                            name="pin"
                            type="text"
                            className="form-control"
                            placeholder="Enter Password"
                            value={vform.pin}
                            onChange={handleVChange}
                          />
                        </div>

                        {success && (
                          <div className="col-12 text-success">{success}</div>
                        )}

                        {error && (
                          <div className="col-12 text-danger">{error}</div>
                        )}
                      </div>

                      <div className="modal-footer">
                        <div className="signup-btnD mt-3">
                          <button
                            type="submit"
                            className="submit_btn btn btn-success"
                            style={{ minWidth: "150px" }}
                            disabled={loading}
                          >
                            {loading ? <ButtonLoader label="Updating..." /> : "Update"}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}

          {model === "uv" && (
            <div
              className="modal fade show d-block"
              style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            >
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Update Class Video</h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setModel("")}
                    ></button>
                  </div>
                  {permCan("recording") && (
                    <form onSubmit={updatevideo} className="update-form">
                      <div className="modal-body">
                        <div className="form-group mb-3">
                          <label htmlFor="cpassword">
                            Video : <span className="text-danger">*</span>
                          </label>

                          <input
                            name="link"
                            type="file"
                            className="form-control"
                            accept="video/*"
                            placeholder="Please Enter Video Link *"
                            onChange={(e: any) => {
                              setFile(e.target.files[0]);
                              setUp(null);
                              setForm((f) => ({ ...f, file: e.target.value }));
                            }}
                            required
                          />
                        </div>

                        <div className="form-group mb-3">
                          <label>Video delivery</label>
                          <select
                            className="form-select"
                            value={form.delivery}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                delivery: e.target.value,
                              }))
                            }
                          >
                            <option value="hls">
                              Secure stream (HLS, encrypted) — prepared after
                              upload
                            </option>
                            <option value="mp4">
                              Original (MP4) — played only to signed-in viewers
                            </option>
                          </select>
                          {deleteOriginalField()}
                          {storageField()}
                        </div>

                        {loading && <UploadProgress up={up} />}

                        {success && (
                          <div className="col-12 text-success">{success}</div>
                        )}

                        {error && (
                          <div className="col-12 text-danger">{error}</div>
                        )}
                      </div>

                      <div className="modal-footer">
                        <div className="signup-btnD mt-3">
                          <button
                            type="submit"
                            className="submit_btn btn btn-success"
                            style={{ minWidth: "150px" }}
                            disabled={loading}
                          >
                            {loading ? <ButtonLoader label="Updating..." /> : "Update"}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );

    /* ================= Components ================= */
    function ClassCard({ list }: any) {
      const permCan = usePagePerm("live-classes");

      const isDeleted = String(list.status || "").endsWith("D");
      const isCompleted = !isDeleted && (list.status === "2" || list.status === "2S");
      const isDisabled = !isDeleted && list.status === "2S"; // completed, hidden from students
      const isCanceled = !isDeleted && list.status === "0";
      const isExpired =
        !isDeleted && !isCompleted && !isCanceled && datetime >= Number(list.stimings);

      let statusBorder = "var(--ad-brand)";
      let cameraBg = "#f5f3ff";
      let cameraColor = "#818cf8";
      let badgeText = "Upcoming";
      let badgeBg = "var(--ad-brand)";

      if (isDeleted) {
        statusBorder = "#64748b";
        cameraBg = "#f8fafc";
        cameraColor = "#94a3b8";
        badgeText = "Deleted";
        badgeBg = "#64748b";
      } else if (isDisabled) {
        statusBorder = "#94a3b8";
        cameraBg = "#f1f5f9";
        cameraColor = "#94a3b8";
        badgeText = "Disabled";
        badgeBg = "#64748b";
      } else if (isCompleted) {
        statusBorder = "#10b981";
        cameraBg = "#ecfdf5";
        cameraColor = "#34d399";
        badgeText = "Completed";
        badgeBg = "#10b981";
      } else if (isCanceled) {
        statusBorder = "#ef4444";
        cameraBg = "#fef2f2";
        cameraColor = "#f87171";
        badgeText = "Canceled";
        badgeBg = "#ef4444";
      } else if (isExpired) {
        statusBorder = "#ef4444";
        cameraBg = "#faf5ff";
        cameraColor = "#818cf8";
        badgeText = "Expired";
        badgeBg = "#ef4444";
      }

      return (
        <div className="col-12">
          <div
            className="lc-item-card"
            style={{ borderLeft: `4px solid ${statusBorder}` }}
          >
            <div className="lc-card-left-section">
              {/* Camera Thumbnail */}
              <div
                className="lc-camera-box"
                style={{ backgroundColor: cameraBg }}
              >
                <span
                  className="lc-camera-badge"
                  style={{ backgroundColor: badgeBg }}
                >
                  {badgeText}
                </span>
                <svg
                  width="44"
                  height="34"
                  viewBox="0 0 24 24"
                  fill={cameraColor}
                >
                  <rect x="2" y="5" width="13" height="14" rx="3" />
                  <path d="M16 9.5l5-3v11l-5-3v-5z" />
                </svg>
              </div>

                {/* Title & Meta Details */}
              <div className="lc-item-content">
                <h5 className="lc-item-title">{list.title}</h5>
                <div className="lc-meta-list">
                  {/* Course */}
                  <div className="lc-meta-item">
                    <GraduationCap
                      size={17}
                      color="var(--ad-brand)"
                      className="lc-meta-icon"
                    />
                    <div>
                      <div className="lc-meta-label">Course</div>
                      <div className="lc-meta-val">
                        {getCourseNamesByIds(list.c_id || courseid)}
                      </div>
                    </div>
                  </div>

                  {/* Batch */}
                  <div className="lc-meta-item">
                    <Calendar
                      size={17}
                      color="var(--ad-brand)"
                      className="lc-meta-icon"
                    />
                    <div>
                      <div className="lc-meta-label">Batch</div>
                      <div className="lc-meta-val">
                        {getBatchNameById(list.b_id || batchid)}
                      </div>
                    </div>
                  </div>

                  {/* Trainer */}
                  <div className="lc-meta-item">
                    <User
                      size={17}
                      color="var(--ad-brand)"
                      className="lc-meta-icon"
                    />
                    <div>
                      <div className="lc-meta-label">Trainer</div>
                      <div className="lc-meta-val">
                        {getTrainerNameById(list.trainer || list.tname) ||
                          list.tname ||
                          "Raj"}
                      </div>
                    </div>
                  </div>

                  {/* Class Date */}
                  <div className="lc-meta-item">
                    <Calendar
                      size={17}
                      color="var(--ad-brand)"
                      className="lc-meta-icon"
                    />
                    <div>
                      <div className="lc-meta-label">Class Date</div>
                      <div className="lc-meta-val">
                        {DateTime(list.stimings || list.classdate)}
                      </div>
                    </div>
                  </div>

                  {/* Class Timings */}
                  <div className="lc-meta-item">
                    <Clock
                      size={17}
                      color="var(--ad-brand)"
                      className="lc-meta-icon"
                    />
                    <div>
                      <div className="lc-meta-label">Class Timings</div>
                      <div className="lc-meta-val">
                        {timestampTime(list.stimings)} -{" "}
                        {timestampTime(list.etimings)}{" "}
                        <span className="lc-tz-abbr" title="Shown in your time zone">
                          {tzShort(list.stimings)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attendees */}
                  <div className="lc-meta-item">
                    <Users
                      size={17}
                      color="var(--ad-brand)"
                      className="lc-meta-icon"
                    />
                    <div>
                      <div className="lc-meta-label">Attendees</div>
                      <div className="lc-meta-val">{list.attendance || 0}</div>
                    </div>
                  </div>

                  {/* Video Metadata (Filename, File Size, Upload Date) */}
                  {getVideoFileName(list) && (
                    <>
                      <div className="lc-meta-item">
                        <Video
                          size={17}
                          color="var(--ad-brand)"
                          className="lc-meta-icon"
                        />
                        <div>
                          <div className="lc-meta-label">Video File</div>
                          <div className="lc-meta-val" title={getVideoFileName(list)}>
                            {getVideoFileName(list).slice(0, 28)}
                            {getVideoFileName(list).length > 28 ? "…" : ""}
                            {Number(list.video_size) > 0
                              ? ` (${fmtBytes(list.video_size)})`
                              : ""}
                          </div>
                        </div>
                      </div>
                      {(list.video_updated || list.datetime) && (
                        <div className="lc-meta-item">
                          <Clock
                            size={17}
                            color="var(--ad-brand)"
                            className="lc-meta-icon"
                          />
                          <div>
                            <div className="lc-meta-label">Uploaded</div>
                            <div className="lc-meta-val">
                              {DateTime(list.video_updated || list.datetime)}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="lc-card-actions">
              <div className="lc-action-icons-row">
                {loadingId === list.id ? (
                  <span className="text-muted small">Requesting...</span>
                ) : (
                  ((ustatus === "2" && list.trainer === ukey) ||
                    ustatus === "X" ||
                    ustatus === "Y") && (
                    <div
                      className="lc-action-icons-row"
                      style={{ marginBottom: "0" }}
                    >
                      {isDeleted ? (
                        <>
                          <button
                            type="button"
                            className="lc-action-icon-btn btn-reopen"
                            title="Restore Class"
                            aria-label="Restore Class"
                            disabled={loadingId === list.id}
                            onClick={() => restoreClass(list)}
                          >
                            <RotateCw size={15} color="#10b981" />
                          </button>
                          {(ustatus === "X" || ustatus === "Y") &&
                            permCan("delete") && (
                              <button
                                type="button"
                                className="lc-action-icon-btn btn-del"
                                title="Delete Permanently"
                                aria-label="Delete Permanently"
                                disabled={loadingId === list.id}
                                onClick={() => setPurgeTarget(list)}
                              >
                                <Trash2 size={15} color="#ef4444" />
                              </button>
                            )}
                        </>
                      ) : (
                        <>
                          {permCan("delete") && (
                            <button
                              type="button"
                              className="lc-action-icon-btn btn-del"
                              title="Delete Class Details"
                              onClick={() => deleteclass(list)}
                            >
                              <Trash2 size={15} color="#ef4444" />
                            </button>
                          )}

                          {getVideoFileName(list) && permCan("delete") && (
                            <button
                              type="button"
                              className="lc-action-icon-btn btn-del"
                              title="Delete Class Video"
                              onClick={() => deleteVideo(list)}
                            >
                              <FileX2 size={15} color="#dc2626" />
                            </button>
                          )}

                          {list.status == "1" &&
                            (permCan("cancel") ? (
                              <button
                                type="button"
                                className="lc-action-icon-btn btn-cancel"
                                title="Cancel Class"
                                onClick={() => cancellist(list)}
                              >
                                <X size={15} color="#ef4444" />
                              </button>
                            ) : null)}

                          {list.status == "0" &&
                            (permCan("cancel") ? (
                              <button
                                type="button"
                                className="lc-action-icon-btn btn-reopen"
                                title="Reopen Class"
                                onClick={() => reopenlist(list)}
                              >
                                <RotateCw size={15} color="#10b981" />
                              </button>
                            ) : null)}

                          {list.video_mode === "hls" &&
                            list.video_status === "ready" &&
                            Number(list.video_delete_original) !== 1 &&
                            (ustatus === "X" || ustatus === "Y") &&
                            permCan("delete") ? (
                            <button
                              type="button"
                              className="lc-action-icon-btn btn-del"
                              title="Delete the original video file (the secure stream keeps playing)"
                              aria-label="Delete the original video file"
                              disabled={loadingId === list.id}
                              onClick={() => deleteOriginal(list)}
                            >
                              <FileX2 size={15} color="#ef4444" />
                            </button>
                          ) : null}

                          {(list.status == "1" || isCompleted) &&
                            (permCan("edit") ? (
                              <button
                                type="button"
                                className="lc-action-icon-btn btn-edit"
                                title="Edit Class Details"
                                onClick={() => updateto("update", list)}
                              >
                                <Edit3 size={15} color="#3b82f6" />
                              </button>
                            ) : null)}

                          {isCompleted &&
                            (permCan("cancel") ? (
                              <button
                                type="button"
                                className={
                                  "lc-action-icon-btn " +
                                  (isDisabled ? "btn-reopen" : "btn-cancel")
                                }
                                title={
                                  isDisabled
                                    ? "Enable Class (show to students)"
                                    : "Disable Class (hide from students)"
                                }
                                onClick={() => setVisibility(list, isDisabled)}
                              >
                                {isDisabled ? (
                                  <Eye size={15} color="#10b981" />
                                ) : (
                                  <EyeOff size={15} color="#ef4444" />
                                )}
                              </button>
                            ) : null)}
                        </>
                      )}
                    </div>
                  )
                )}

                {(list.video_storage === "gdrive" ||
                  String(list.file || "").startsWith("gdrive:") ||
                  String(list.doc || "").startsWith("gdrive:")) && (
                  <span className="lc-drive-badge" title="Stored on Google Drive" aria-label="Stored on Google Drive" role="img">
                    <Cloud size={15} />
                  </span>
                )}
                {list.video_mode === "hls" && list.video_status === "ready" ? (
                  <span
                    className="lc-video-pill ready"
                    title="Secure stream (encrypted HLS)"
                    aria-label="Secure stream"
                    role="img"
                  >
                    <ShieldCheck size={16} />
                  </span>
                ) : (
                  list.video_mode === "hls" && (
                    <span
                      className={
                        "lc-video-pill " + (list.video_status || "pending")
                      }
                      title={
                        list.video_status === "failed"
                          ? list.video_error || ""
                          : list.video_status === "processing"
                            ? "Converting into an encrypted HLS stream"
                            : "Waiting to be converted into an encrypted HLS stream"
                      }
                      style={
                        list.video_status === "processing" || list.video_status === "uploading"
                          ? ({ "--p": `${Number(list.video_progress) || 0}%` } as React.CSSProperties)
                          : undefined
                      }
                    >
                      {list.video_status === "failed"
                        ? "Video failed"
                        : list.video_status === "uploading"
                          ? `Uploading to Drive… ${Number(list.video_progress) || 0}%`
                          : list.video_status === "processing" && Number(list.video_progress) > 0
                          ? `Preparing video… ${Number(list.video_progress)}%`
                          : "Preparing video…"}
                    </span>
                  )
                )}
              </div>

              {list.video_mode === "hls" &&
                list.video_status === "failed" &&
                permCan("recording") &&
                ((ustatus === "2" && list.trainer === ukey) ||
                  ustatus === "X" ||
                  ustatus === "Y") && (
                  <button
                    type="button"
                    className="lc-action-icon-btn btn-reopen"
                    title="Prepare the secure video again"
                    onClick={() => retryVideo(list)}
                  >
                    <RotateCw size={15} color="#10b981" />
                  </button>
                )}
              <button
                type="button"
                className="lc-btn-details"
                onClick={() => updateto("view", list)}
              >
                <span>Class Details</span>
                <ArrowRight size={15} />
              </button>
            </div>
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

    function Icon() {
      return (
        <>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <rect
              x="3"
              y="6"
              width="15"
              height="12"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M18 10L22 8V16L18 14"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </>
      );
    }
  }
}
