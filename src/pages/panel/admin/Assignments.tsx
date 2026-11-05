import { Head, SERVER_URL, AWS_UPLOADS } from "../../../components/Includes";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { getSeoByPath } from "../../../utils/seo";
import { loadAllTrainers, trainersForCourse } from "../../../utils/trainers";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import StudentAssignments from "../student/Assignments";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  FileText,
  ClipboardList,
  SlidersHorizontal,
  RotateCw,
  Eye,
  Check,
  X,
  Edit,
  Trash2,
  BookOpen,
  Calendar,
  Users,
  Plus,
  FileSpreadsheet,
  ArrowLeft,
  CheckCircle,
  Download,
  UploadCloud,
  Layers,
  UserCheck,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
  Phone,
  Mail,
  GraduationCap,
  User,
} from "lucide-react";
import { listFetch, fetchAllRows } from "../../../utils/listCache";
import { exportWithChoice } from "../../../components/ExportChoice";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, SkeletonCards, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

export default function Dashboard() {
  const [assignmentid, setAssignmentid] = useState("");
  const [mainmode, setMainMode] = useState("");
  const [asslists, setAssLists] = useState([]);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");

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
      if (ustatus === "X" || ustatus === "Y" || ustatus === "2") {
        setMainMode("assignments");
      }
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
    // Admins and trainers see the list straight away. Students ("1") get
    // <StudentAssignments /> once initchecklogin() confirms the role — this
    // page serves /panel/assignments for every role, so the cookie alone must
    // never sign anyone out (it used to, for students); the server check does.
    const ustatus = getCookie("id");
    if (ustatus === "X" || ustatus === "Y" || ustatus === "2") {
      setMainMode("assignments");
    }

    initchecklogin();

    return () => {};
  }, []);
  return (
    <>
      {ptype == "1" && <StudentAssignments />}
      {mainmode == "assignments" && (
        <Assignments
          setMainMode={setMainMode}
          setAssLists={setAssLists}
          setAssignmentid={setAssignmentid}
          page={page}
          setPage={setPage}
          search={search}
          setSearch={setSearch}
          sort={sort}
          setSort={setSort}
        />
      )}

      {mainmode == "subassignments" && (
        <SubAssignments
          setMainMode={setMainMode}
          asslists={asslists}
          assignmentid={assignmentid}
        />
      )}
    </>
  );
}

function Assignments({
  setMainMode,
  setAssLists,
  setAssignmentid,
  page,
  setPage,
  search,
  setSearch,
  sort,
  setSort,
}: any) {
  const permCan = usePagePerm("assignments");

  const [key, setkey] = useState("");
  const [ustatus, setustatus] = useState("");

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true, // 🔥 REQUIRED
    });
    return res.data;
  };

  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [mode, setMode] = useState("board");

  const initialForm = {
    id: "", // users.id
    mem_id: "",
    req_id: "",
    tname: "",
    title: "", // name
    note: "",
    batch: "",
    course: "",
    batch_name: "",
    course_name: "",
    sdate: "",
    edate: "",
    file: "",
    students_count: "",
    subs_count: "",
    datetime: "", // registered date (timestamp)
    updatetime: "",
    status: "", // active/inactive
  };

  const [form, setForm] = useState(initialForm);

  function decodeHtml(str: any) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }
  function timestampToDateTime(ts: any) {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleDateString("sv-SE"); // YYYY-MM-DD
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

  const limit = 10;

  const [lastPage, setLastPage] = useState(0);

  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);

  // Every trainer, loaded once (utils/trainers.ts); the dropdown shows the
  // selected course's trainers from it, so picking a course fetches nothing.
  const [allTrainers, setAllTrainers] = useState<any[]>([]);
  const trainers = useMemo(() => trainersForCourse(allTrainers, form.course), [allTrainers, form.course]);
  const [courses, setCourses] = useState<any[]>([]);
  const [batches, setBatches] = useState<BatchResponse[]>([]);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);

  const formatDate = (ts: any) => {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleDateString("en-IN");
  };

  const getStatus = (s: any) => {
    switch (String(s)) {
      case "1D":
        return "Deleted";
      case "1":
        return "Active";
      case "1S":
        return "Disabled";
      case "2":
        return "Completed";
      default:
        return "Unknown";
    }
  };

  const loadDetails = async (page = 1, search = "", sort = "") => {
    setLoading(true);
    setAllLists([]);
    setTotal(0);
    setPage(page);
    setSearch(search);
    setSort(sort);

    try {
      const res = await listFetch("api/assignments", {
        q: search,
        s: sort,
        n: page,
      });

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
      setLoading(false);
      await loadCourses();
      if (ustatus === "2") {
        await loadMyProfile();
      }
    }
  };

  const loadCourses = async () => {
    try {
      const res = await listFetch("api/get-courses", {
        status: "",
      });

      if (res.data.success) {
        setCourses(res.data.data);
        if (res.data.data.length >= 1) {
          await loadBatches(res.data.data[0].req_id);
        }
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
    }
  };

  const loadBatches = async (c_id: any) => {
    try {
      const res = await listFetch("api/get-batches", {
        c_id: c_id,
        status: "",
      });

      if (res.data.success) {
        if (res.data.data.length >= 1) {
          setBatches((prev) => [
            ...prev,
            {
              req_id: c_id,
              data: res.data.data,
            },
          ]);
        } else {
          toast.error(res.data.message);
        }
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      await loadTrainers(c_id);
    }
  };

  // all trainers in one request, then from the saved copy (utils/trainers.ts)
  const loadTrainers = async (_c_id?: any) => {
    setAllTrainers(await loadAllTrainers());
  };

  const addList = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setSuccess("");
    setError("");

    if (!form.title.trim()) {
      setError("❌ Please enter assignment title");
      return;
    }

    if (!file) {
      setError("❌ Please select a file");
      return;
    }

    try {
      setLoading(true);

      let gof = false;

      // 🔐 Security
      const security = await getSecurity();

      // 1️⃣ Get S3 presigned URL
      const presignRes = await axios.post(
        SERVER_URL + "api/get-upload-url",
        {
          fileName: file.name,
          fileType: file.type,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true },
      );

      if (presignRes.data?.success && presignRes.data?.uploadURL) {
        gof = true;
      }

      const { uploadURL, key } = presignRes.data;

      // 2️⃣ Upload file to S3 (with progress)
      await axios.put(uploadURL, file, {
        headers: { "Content-Type": file.type },
        onUploadProgress: (e) => {
          if (!e.total) return;
          const percent = Math.round((e.loaded * 100) / e.total);
          setProgress(percent); // 🔥 progress bar
        },
      });

      if (!gof) {
        setError("Something went wrong, try again");
      } else {
        // 3️⃣ Save assignment data (DB)
        const res = await axios.post(
          SERVER_URL + "api/add-assignment",
          {
            ...form,
            file_key: key, // ✅ store S3 key
            file_name: file.name,
            file_type: file.type,
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
          setTotal(listtotal + 1);
          setProgress(0);
        } else {
          toast.error(res.data.message);
          setError(res.data.message);
        }
      }
    } catch (err) {
      console.error(err);
      setError("❌ Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const updateList = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setSuccess("");
    setError("");

    if (!form.title.trim()) {
      return setError("❌ Please enter assignment title");
    }

    try {
      setLoading(true);

      const security = await getSecurity();

      let fileKey = null;
      let fileName = null;
      let fileType = null;

      let gof = true;

      /* ---------- Upload only if file selected ---------- */
      if (file) {
        gof = false;
        const presignRes = await axios.post(
          SERVER_URL + "api/get-upload-url",
          {
            fileName: file.name,
            fileType: file.type,
            key: security.key,
            token: security.token,
            aut: security.aut,
          },
          { withCredentials: true },
        );

        if (presignRes.data?.success && presignRes.data?.uploadURL) {
          gof = true;
        }

        const { uploadURL, key } = presignRes.data;

        await axios.put(uploadURL, file, {
          headers: { "Content-Type": file.type },
          onUploadProgress: (e) => {
            if (!e.total) return;
            setProgress(Math.round((e.loaded * 100) / e.total));
          },
        });

        // Save only if uploaded
        fileKey = key;
        fileName = file.name;
        fileType = file.type;
      }

      if (!gof) {
        setError("Something went wrong, try again");
      } else {
        /* ---------- Update DB ---------- */
        const res = await axios.post(
          SERVER_URL + "api/update-assignment", // 🔥 update endpoint
          {
            ...form,

            file_key: fileKey, // null if no new file
            file_name: fileName,
            file_type: fileType,

            key: security.key,
            token: security.token,
            aut: security.aut,
          },
          { withCredentials: true },
        );

        if (res.data.success) {
          toast.success(res.data.message);
          setSuccess(res.data.message);
          setAllLists((prev) =>
            prev.map((item) =>
              item.id === res.data.data.id ? res.data.data : item,
            ),
          );
          setFile(null);
          setProgress(0);
        } else {
          toast.error(res.data.message);
          setError(res.data.message);
        }
      }
    } catch (err) {
      console.error(err);
      setError("❌ Update failed");
    } finally {
      setLoading(false);
    }
  };

  const disableList = async (list: any) => {
    setSuccess("");
    setError("");

    // ✅ Ask confirmation first
    const confirm = window.confirm(
      "Are you sure you want to disable '" +
        decodeHtml(list.title) +
        "' assignment?",
    );

    if (!confirm) return; // ❌ Cancel clicked

    try {
      setLoadingId(list.req_id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/disable-assignment",
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
      "Are you sure you want to enable '" +
        decodeHtml(list.title) +
        "' assignment?",
    );

    if (!confirm) return; // ❌ Cancel clicked

    try {
      setLoadingId(list.req_id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/enable-assignment",
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
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const completeList = async (list: any) => {
    setSuccess("");
    setError("");

    // ✅ Ask confirmation first
    const confirm = window.confirm(
      "Are you sure you want to complete '" +
        decodeHtml(list.title) +
        "' assignment?",
    );

    if (!confirm) return; // ❌ Cancel clicked

    try {
      setLoadingId(list.req_id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/complete-assignment",
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
            b.req_id === list.req_id ? { ...b, status: "2" } : b,
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

    // ✅ Ask confirmation first
    const confirm = window.confirm(
      "Are you sure you want to delete '" +
        decodeHtml(list.title) +
        "' assignment?",
    );

    if (!confirm) return; // ❌ Cancel clicked

    try {
      setLoadingId(list.req_id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/delete-assignment",
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
            b.req_id === list.req_id ? { ...b, status: "1D" } : b,
          ),
        );
        setForm((f) => ({ ...f, status: "1D" }));
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
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
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      setError(err + "");
    } finally {
    }
  };

  const navigate = useNavigate();

  const moveto = async (id: any) => {
    setSuccess("");
    setError("");
    setMode(id);

    if (id === "add") {
      setForm(initialForm);
    }
  };

  const updateto = async (type: any, list: any) => {
    setForm({
      id: list.id,
      req_id: list.req_id,
      mem_id: list.mem_id,
      tname: list.tname,
      title: decodeHtml(list.title),
      note: list.note,
      course: list.course,
      batch: list.batch,
      batch_name: list.batch_name,
      course_name: decodeHtml(list.course_name),
      sdate: type == "update" ? timestampToDateTime(list.sdate) : list.sdate,
      edate: type == "update" ? timestampToDateTime(list.edate) : list.edate,
      file: list.file,
      students_count: list.students_count,
      subs_count: list.subs_count,
      datetime: list.datetime,
      updatetime: list.updatetime,
      status: list.status,
    });

    if (type == "update") {
      const exists = batches.some((b) => b.req_id === list.course);
      if (!exists) {
        loadBatches(list.course);
      } else {
        loadTrainers(list.course);
      }
    }
    setMode(type);
  };

  const exportToExcel = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      alert("No data to export");
      return;
    }

    const data = rows.map((u, i) => ({
      "S No": i + 1,
      Name: u.name,
      Phone: u.number,
      Email: u.email,
      Qualification: u.qualification,
      Date: formatDate(u.datetime),
      Status: u.status === "1" ? "Active" : "Inactive",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Assignments");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const file = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });

    saveAs(file, "assignments_list.xlsx");
  };

  const exportToCSV = (rows: any[] = alllists) => {
    if (rows.length === 0) {
      alert("No data to export");
      return;
    }

    const data = rows.map((u, i) => ({
      "S No": i + 1,
      Name: u.name,
      Phone: u.number,
      Email: u.email,
      Qualification: u.qualification,
      Date: formatDate(u.datetime),
      Status: u.status === "1" ? "Active" : "Inactive",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);

    const csv = XLSX.utils.sheet_to_csv(worksheet);

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    saveAs(blob, "assignments_list.csv");
  };

  // Excel / CSV: this page, or every row matching the current search / filters
  const askExport = (format: "excel" | "csv") =>
    exportWithChoice({
      format,
      loaded: alllists,
      total: listtotal,
      fetchAll: () => fetchAllRows("api/assignments"),
      run: (rows) => (format === "excel" ? exportToExcel(rows) : exportToCSV(rows)),
    });

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
    if (loggedIn && (ustatus == "X" || ustatus == "Y" || ustatus == "2")) {
      setkey(data.key);
      setustatus(ustatus);
      loadDetails(page, search, sort);
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

      <ToastContainer position="top-right" autoClose={2000} />

      {/* Main Content */}
      <div className="content">
        <style>{`
        /* Modern Form Page (.rf-*) */
        .rf-page-wrapper {
          background-color: #f8fafc;
          min-height: calc(100vh - 80px);
          padding: 24px 28px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .rf-container {
          margin: 0 auto;
        }
        .rf-header-card {
          background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #e0f2fe 100%);
          border-radius: 20px;
          padding: 24px 28px;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(var(--ad-brand-rgb), 0.05);
        }
        .rf-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
          z-index: 2;
        }
        .rf-header-icon-box {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: var(--ad-brand);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 16px rgba(var(--ad-brand-rgb), 0.25);
          flex-shrink: 0;
        }
        .rf-header-title {
          font-size: 22px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }
        .rf-header-subtitle {
          font-size: 13.5px;
          color: #64748b;
          margin: 4px 0 0 0;
        }
        .rf-btn-back {
          background: #ffffff;
          border: 1.5px solid var(--ad-brand);
          color: var(--ad-brand);
          border-radius: 10px;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
          z-index: 2;
          text-decoration: none;
        }
        .rf-btn-back:hover {
          background: #f5f3ff;
          transform: translateY(-1px);
          color: var(--ad-brand-2);
        }
        .rf-header-decor {
          position: absolute;
          right: 140px;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0.25;
          pointer-events: none;
        }
        .rf-form-card {
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid #edf2f7;
          padding: 32px 36px;
          box-shadow: 0 4px 24px -2px rgba(15, 23, 42, 0.05);
        }
        .rf-form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }
        @media (max-width: 768px) {
          .rf-form-grid {
            grid-template-columns: 1fr;
          }
          .rf-form-card {
            padding: 20px;
          }
        }
        .rf-field-card {
          background: #f8faff;
          border: 1px solid #edf2f7;
          border-radius: 14px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .rf-field-card:focus-within {
          border-color: #c7d2fe;
          background: #ffffff;
        }
        .rf-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .rf-field-body {
          flex: 1;
          min-width: 0;
        }
        .rf-field-label {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 3px;
        }
        .rf-field-label .req {
          color: #ef4444;
        }
        .rf-input, .rf-select {
          width: 100%;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 13.5px;
          color: #0f172a;
          outline: none;
          transition: all 0.15s ease;
          box-sizing: border-box;
        }
        .rf-input:focus, .rf-select:focus {
          border-color: var(--ad-brand);
          box-shadow: 0 0 0 3px rgba(var(--ad-brand-rgb), 0.08);
        }
        .rf-textarea {
          width: 100%;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 13.5px;
          color: #0f172a;
          outline: none;
          min-height: 80px;
          resize: vertical;
          box-sizing: border-box;
        }
        .rf-textarea:focus {
          border-color: var(--ad-brand);
          box-shadow: 0 0 0 3px rgba(var(--ad-brand-rgb), 0.08);
        }
        .rf-progress-bar-container {
          grid-column: 1 / -1;
          margin-top: 10px;
        }
        .rf-progress {
          height: 10px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }
        .rf-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%);
          border-radius: 999px;
          transition: width 0.3s ease;
        }
        .rf-progress-text {
          font-size: 12px;
          font-weight: 600;
          color: var(--ad-brand);
          margin-top: 4px;
          text-align: right;
        }
        .rf-file-existing {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          padding: 6px 14px;
          background: #ede9fe;
          color: var(--ad-brand);
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.15s ease;
        }
        .rf-file-existing:hover {
          background: #ddd6fe;
          color: var(--ad-brand-2);
        }
        .rf-submit-btn {
          grid-column: 1 / -1;
          background: var(--ad-brand);
          color: #ffffff;
          border: none;
          border-radius: 12px;
          padding: 14px 28px;
          font-size: 15px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-top: 8px;
          box-shadow: 0 4px 14px rgba(var(--ad-brand-rgb), 0.25);
        }
        .rf-submit-btn:hover:not(:disabled) {
          background: var(--ad-brand-2);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(var(--ad-brand-rgb), 0.35);
        }
        .rf-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Board View Styles */
            .asg-wrapper {
              padding: 24px;
              background-color: #f8fafc;
              min-height: calc(100vh - 70px);
            }
            .asg-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 20px;
              flex-wrap: wrap;
              gap: 16px;
            }
            .asg-header-left {
              display: flex;
              align-items: center;
              gap: 14px;
            }
            .asg-header-icon {
              width: 44px;
              height: 44px;
              border-radius: 10px;
              background: var(--ad-brand);
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(var(--ad-brand-rgb), 0.25);
            }
            .asg-header-title {
              font-size: 22px;
              font-weight: 700;
              color: #1e293b;
              margin: 0;
              line-height: 1.2;
            }
            .asg-header-subtitle {
              font-size: 13.5px;
              color: #64748b;
              margin: 2px 0 0 0;
            }
            .asg-header-right {
              display: flex;
              align-items: center;
              gap: 10px;
              flex-wrap: wrap;
            }
            .asg-total-badge {
              background: #ffffff;
              border: 1px solid #e2e8f0;
              color: #475569;
              padding: 7px 16px;
              border-radius: 20px;
              font-size: 13px;
              font-weight: 500;
            }
            .asg-total-badge b {
              color: #1e293b;
              font-weight: 700;
            }
            .asg-btn-add {
              background: var(--ad-brand);
              color: #ffffff;
              border: none;
              border-radius: 8px;
              padding: 8px 16px;
              font-size: 13px;
              font-weight: 600;
              display: inline-flex;
              align-items: center;
              gap: 6px;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .asg-btn-add:hover {
              background: var(--ad-brand);
              color: #ffffff;
            }
            .asg-btn-export {
              background: #ffffff;
              color: var(--ad-brand);
              border: 1.5px solid var(--ad-brand);
              border-radius: 8px;
              padding: 7px 14px;
              font-size: 13px;
              font-weight: 600;
              display: inline-flex;
              align-items: center;
              gap: 6px;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .asg-btn-export:hover {
              background: #f5f3ff;
              color: var(--ad-brand);
            }
              .asg-btn-submit {
  background: var(--ad-brand);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12.5px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  transition: all 0.2s ease;
}
            .asg-filter-card {
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 12px 18px;
              margin-bottom: 20px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 16px;
              flex-wrap: wrap;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
            }
            .asg-sort-group {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .asg-sort-label {
              font-size: 13.5px;
              font-weight: 500;
              color: #64748b;
              white-space: nowrap;
            }
            .asg-sort-select {
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 6px 12px;
              font-size: 13.5px;
              color: #1e293b;
              background-color: #ffffff;
              outline: none;
              cursor: pointer;
            }
            .asg-search-box {
              flex: 1;
              min-width: 260px;
              position: relative;
              display: flex;
              align-items: center;
            }
            .asg-search-icon {
              position: absolute;
              left: 12px;
              color: #94a3b8;
              pointer-events: none;
            }
            .asg-search-input {
              width: 100%;
              padding: 8px 14px 8px 36px;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              font-size: 13.5px;
              color: #1e293b;
              outline: none;
              background-color: #ffffff;
              transition: border-color 0.2s ease;
            }
            .asg-search-input:focus {
              border-color: var(--ad-brand);
            }
            .asg-btn-reload {
              background: var(--ad-brand);
              color: #ffffff;
              border: none;
              border-radius: 8px;
              width: 38px;
              height: 38px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: all 0.2s ease;
              flex-shrink: 0;
            }
            .asg-btn-reload:hover {
              background: var(--ad-brand);
            }
            .asg-card {
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              overflow: hidden;
              margin-bottom: 16px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
              transition: box-shadow 0.2s ease, transform 0.2s ease;
            }
            .asg-card:hover {
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
            }
            .asg-card-top {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 12px 20px;
              border-bottom: 1px solid transparent;
            }
            .asg-card-top-left {
              display: flex;
              align-items: center;
              gap: 14px;
            }
            .asg-card-iconbox {
              width: 40px;
              height: 40px;
              border-radius: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }
            .asg-card-title-group {
              display: flex;
              flex-direction: column;
            }
            .asg-card-title {
              font-size: 15px;
              font-weight: 700;
              color: #0f172a;
              margin: 0;
              line-height: 1.3;
            }
            .asg-card-date {
              font-size: 12px;
              color: #64748b;
              margin: 2px 0 0 0;
            }
            .asg-status-pill {
              border-radius: 20px;
              padding: 4px 12px;
              font-size: 12px;
              font-weight: 600;
              display: inline-flex;
              align-items: center;
              gap: 6px;
              line-height: 1;
            }
            .asg-top-active {
              background-color: #f0f9ff;
              border-bottom-color: #bae6fd;
            }
            .asg-icon-active {
              background-color: #dbeafe;
              color: #0284c7;
            }
            .asg-pill-active {
              background-color: #e0f2fe;
              color: #0284c7;
            }
            .asg-top-disabled {
              background-color: #fef2f2;
              border-bottom-color: #fecaca;
            }
            .asg-icon-disabled {
              background-color: #fee2e2;
              color: #b91c1c;
            }
            .asg-pill-disabled {
              background-color: #fee2e2;
              color: #b91c1c;
            }
            .asg-top-completed {
              background-color: #f0fdf4;
              border-bottom-color: #bbf7d0;
            }
            .asg-icon-completed {
              background-color: #dcfce7;
              color: #15803d;
            }
            .asg-pill-completed {
              background-color: #dcfce7;
              color: #15803d;
            }
            .asg-card-bottom {
              padding: 16px 20px;
              background-color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: space-between;
              flex-wrap: wrap;
              gap: 16px;
            }
            .asg-meta-cols {
              display: flex;
              align-items: center;
              gap: 36px;
              flex-wrap: wrap;
            }
            .asg-meta-item {
              display: flex;
              flex-direction: column;
            }
            .asg-meta-label {
              display: flex;
              align-items: center;
              gap: 5px;
              font-size: 12px;
              color: #64748b;
              font-weight: 500;
              margin-bottom: 3px;
            }
            .asg-meta-value {
              font-size: 13.5px;
              font-weight: 600;
              color: #1e293b;
              margin: 0;
            }
            .asg-actions {
              display: flex;
              align-items: center;
              gap: 8px;
              flex-wrap: wrap;
            }
            .asg-btn-view {
              border: 1.5px solid var(--ad-brand);
              color: var(--ad-brand);
              background: #ffffff;
              border-radius: 8px;
              padding: 6px 14px;
              font-size: 12.5px;
              font-weight: 600;
              display: inline-flex;
              align-items: center;
              gap: 5px;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .asg-btn-view:hover {
              background: #f5f3ff;
            }
            .asg-btn-subm {
              border: none;
              background: #ede9fe;
              color: var(--ad-brand);
              border-radius: 8px;
              width: 34px;
              height: 34px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .asg-btn-subm:hover {
              background: #ddd6fe;
            }
            .asg-btn-disable {
              background: #fef2f2;
              border: 1px solid #f87171;
              color: #b91c1c;
              border-radius: 8px;
              padding: 6px 12px;
              font-size: 12.5px;
              font-weight: 600;
              display: inline-flex;
              align-items: center;
              gap: 5px;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .asg-btn-disable:hover {
              background: #fee2e2;
            }
            .asg-btn-enable {
              background: #ecfdf5;
              border: 1px solid #10b981;
              color: #047857;
              border-radius: 8px;
              padding: 6px 12px;
              font-size: 12.5px;
              font-weight: 600;
              display: inline-flex;
              align-items: center;
              gap: 5px;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .asg-btn-enable:hover {
              background: #d1fae5;
            }
            .asg-btn-update {
              border: 1px solid #cbd5e1;
              background: #ffffff;
              color: #334155;
              border-radius: 8px;
              padding: 6px 12px;
              font-size: 12.5px;
              font-weight: 600;
              display: inline-flex;
              align-items: center;
              gap: 5px;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .asg-btn-update:hover {
              background: #f1f5f9;
            }
            .asg-btn-end {
              background: var(--ad-brand);
              border: none;
              color: #ffffff;
              border-radius: 8px;
              padding: 6px 12px;
              font-size: 12.5px;
              font-weight: 600;
              display: inline-flex;
              align-items: center;
              gap: 5px;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .asg-btn-end:hover {
              background: var(--ad-brand);
            }
            .asg-btn-del {
              background: #ef4444;
              border: none;
              color: #ffffff;
              border-radius: 8px;
              width: 34px;
              height: 34px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .asg-btn-del:hover {
              background: #dc2626;
            }
            .asg-btn-del-soft {
              background: #fee2e2;
              border: none;
              color: #dc2626;
              border-radius: 8px;
              width: 34px;
              height: 34px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .asg-btn-del-soft:hover {
              background: #fecaca;
            }
      `}</style>

        {mode === "board" && (
          <div className="asg-wrapper">
            {/* Header */}
            <div className="asg-header">
              <div className="asg-header-left">
                <div className="asg-header-icon">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <h3 className="asg-header-title">Assignments</h3>
                  <p className="asg-header-subtitle">Manage all assignments</p>
                </div>
              </div>

              <div className="asg-header-right">
                <span className="asg-total-badge">
                  Total <b>{listtotal}</b>
                </span>

                {permCan("create") && (
                  <button className="asg-btn-add" onClick={() => moveto("add")}>
                    <Plus size={16} /> Add New
                  </button>
                )}

                <button className="asg-btn-export" onClick={() => askExport("excel")}>
                  <FileSpreadsheet size={15} /> Export Excel
                </button>

                <button className="asg-btn-export" onClick={() => askExport("csv")}>
                  <FileText size={15} /> Export CSV
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="asg-filter-card">
              <div className="asg-sort-group">
                <SlidersHorizontal size={16} color="var(--ad-brand)" />
                <label className="asg-sort-label">Sort By:</label>
                <select
                  className="asg-sort-select"
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    loadDetails(page, search, e.target.value);
                  }}
                >
                  <option value="New">New</option>
                  <option value="Old">Old</option>
                  <option value="Active">Active</option>
                  <option value="Disabled">Disabled</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <form
                className="si-search-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  loadDetails(1, search, sort);
                }}
                style={{
                  display: "flex",
                  gap: "10px",
                }}
              >
                <ListSearch
                  placeholder="Search assignments by title or course..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      loadDetails(1, search, sort);
                    }
                  }}
                />

                <button
                  data-refresh
                  className="reload-btn"
                  title="Reload assignments"
                  onClick={() => {
                    setSearch("");
                    loadDetails(1, "", sort);
                  }}
                >
                  <RotateCw size={16} />
                </button>
              </form>
            </div>

            {/* Cards List */}
            <div className="row g-3">
              {alllists.length === 0 ? (
                <div className="col-12">
                  {loading ? (
                    <SkeletonCards count={3} />
                  ) : (
                    <div className="no-data-card text-center p-5 bg-white rounded-3 border">
                      <i className="fa fa-database no-data-icon"></i>
                      {search.length === 0 ? (
                        <div>
                          <h4 className="mt-3">No Records</h4>
                          <p className="text-muted">
                            We couldn't load any assignments detail, there is no
                            data.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <h4 className="mt-3">No Records Found</h4>
                          <p className="text-muted">
                            We couldn't find any assignments detail matching
                            your search.
                          </p>
                        </div>
                      )}
                      <button
                        className="btn btn-primary mt-2"
                        onClick={() => {
                          setSearch("");
                          loadDetails(page, "", sort);
                        }}
                      >
                        Reload
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="col-12">
                  {alllists.map((list) => {
                    const isCompleted = String(list.status) === "2";
                    const isDisabled = String(list.status) === "1S";

                    const topClass = isCompleted
                      ? "asg-top-completed"
                      : isDisabled
                        ? "asg-top-disabled"
                        : "asg-top-active";

                    const iconClass = isCompleted
                      ? "asg-icon-completed"
                      : isDisabled
                        ? "asg-icon-disabled"
                        : "asg-icon-active";

                    const pillClass = isCompleted
                      ? "asg-pill-completed"
                      : isDisabled
                        ? "asg-pill-disabled"
                        : "asg-pill-active";

                    const statusLabel = isCompleted
                      ? "Completed"
                      : isDisabled
                        ? "Disabled"
                        : "Active";

                    return (
                      <div className="asg-card" key={list.req_id}>
                        {/* Tier 1 Header */}
                        <div className={`asg-card-top ${topClass}`}>
                          <div className="asg-card-top-left">
                            <div className={`asg-card-iconbox ${iconClass}`}>
                              <FileText size={18} />
                            </div>
                            <div className="asg-card-title-group">
                              <h6 className="asg-card-title">
                                {decodeHtml(list.title)}
                              </h6>
                              <p className="asg-card-date">
                                Created: {formatDate(list.datetime)}
                              </p>
                            </div>
                          </div>

                          <div>
                            <span className={`asg-status-pill ${pillClass}`}>
                              ● {statusLabel}
                            </span>
                          </div>
                        </div>

                        {/* Tier 2 Body & Actions */}
                        <div className="asg-card-bottom">
                          <div className="asg-meta-cols">
                            {/* Course */}
                            <div className="asg-meta-item">
                              <span className="asg-meta-label">
                                <BookOpen size={14} color="var(--ad-brand)" /> Course
                              </span>
                              <p className="asg-meta-value">
                                {decodeHtml(list.course_name)} -{" "}
                                {decodeHtml(list.batch_name)}
                              </p>
                            </div>

                            {/* Due Date */}
                            <div className="asg-meta-item">
                              <span className="asg-meta-label">
                                <Calendar size={14} color="#0284c7" /> Due Date
                              </span>
                              <p className="asg-meta-value">
                                {formatDate(list.edate)}
                              </p>
                            </div>

                            {/* Submissions */}
                            <div className="asg-meta-item">
                              <span className="asg-meta-label">
                                <Users size={14} color="var(--ad-brand)" /> Submissions
                              </span>
                              <p className="asg-meta-value">
                                {list.subs_count || 0}/
                                {list.students_count || 0}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="asg-actions">
                            {loadingId === list.req_id ? (
                              <span
                                className="text-muted"
                                style={{ fontSize: "12px" }}
                              >
                                Requesting...
                              </span>
                            ) : list.status !== "1D" ? (
                              <>
                                <button
                                  className="asg-btn-view"
                                  title="View Full Details"
                                  onClick={() => updateto("view", list)}
                                >
                                  <Eye size={14} /> View
                                </button>

                                <button
                                  className="asg-btn-subm"
                                  title="View Submissions"
                                  onClick={() => {
                                    setAssLists(list);
                                    setAssignmentid(list.req_id);
                                    setMainMode("subassignments");
                                  }}
                                >
                                  <FileText size={16} />
                                </button>

                                {isCompleted && (
                                  <>
                                    {permCan("delete") && (
                                      <button
                                        className="asg-btn-del-soft"
                                        title="Delete Assignment"
                                        onClick={() => deleteList(list)}
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}
                                  </>
                                )}

                                {isDisabled && (
                                  <>
                                    {permCan("status") && (
                                      <button
                                        className="asg-btn-enable"
                                        title="Enable Assignment"
                                        onClick={() => enableList(list)}
                                      >
                                        <Check size={14} /> Enable
                                      </button>
                                    )}
                                    {permCan("edit") && (
                                      <button
                                        className="asg-btn-update"
                                        title="Update Assignment Details"
                                        onClick={() => updateto("update", list)}
                                      >
                                        <Edit size={14} /> Update
                                      </button>
                                    )}
                                    {permCan("delete") && (
                                      <button
                                        className="asg-btn-del"
                                        title="Delete Assignment"
                                        onClick={() => deleteList(list)}
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}
                                  </>
                                )}

                                {!isCompleted && !isDisabled && (
                                  <>
                                    {permCan("status") && (
                                      <button
                                        className="asg-btn-disable"
                                        title="Disable Assignment"
                                        onClick={() => disableList(list)}
                                      >
                                        <X size={14} /> Disable
                                      </button>
                                    )}
                                    {permCan("edit") && (
                                      <button
                                        className="asg-btn-update"
                                        title="Update Assignment Details"
                                        onClick={() => updateto("update", list)}
                                      >
                                        <Edit size={14} /> Update
                                      </button>
                                    )}
                                    {permCan("complete") && (
                                      <button
                                        className="asg-btn-end"
                                        title="End Assignment"
                                        onClick={() => completeList(list)}
                                      >
                                        <Check size={14} /> End
                                      </button>
                                    )}
                                    {permCan("delete") && (
                                      <button
                                        className="asg-btn-del"
                                        title="Delete Assignment"
                                        onClick={() => deleteList(list)}
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                <button
                                  className="asg-btn-subm"
                                  title="View Submissions"
                                  onClick={() => {
                                    setAssLists(list);
                                    setAssignmentid(list.req_id);
                                    setMainMode("subassignments");
                                  }}
                                >
                                  <FileText size={16} />
                                </button>
                                <button
                                  className="asg-btn-view"
                                  title="View Full Details"
                                  onClick={() => updateto("view", list)}
                                >
                                  <Eye size={14} /> View
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

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
              <div className="col-12 saved-ago-row">
                <SavedAgo endpoint="api/assignments" />
              </div>
            </div>
          </div>
        )}

        {mode === "add" && (
          <div className="rf-page-wrapper">
            <div className="rf-container">
              {/* Header Card */}
              <div className="rf-header-card">
                <div className="rf-header-left">
                  <div className="rf-header-icon-box">
                    <FileSpreadsheet size={26} />
                  </div>
                  <div>
                    <h1 className="rf-header-title">Adding an Assignment</h1>
                    <p className="rf-header-subtitle">
                      Create and publish a new assignment for course batches
                    </p>
                  </div>
                </div>

                {/* Decorative graphic */}
                <div className="rf-header-decor">
                  <FileText size={96} color="var(--ad-brand)" />
                </div>

                <a onClick={() => moveto("board")} className="rf-btn-back">
                  <ArrowLeft size={16} /> Go Back
                </a>
              </div>

              {/* Form Card */}
              <div className="rf-form-card">
                {permCan("create") && (
                  <form onSubmit={addList}>
                    {/* Status Messages */}
                    {success && (
                      <div
                        className="alert alert-success d-flex align-items-center mb-4"
                        role="alert"
                      >
                        <CheckCircle size={18} className="me-2 flex-shrink-0" />
                        <div>{success}</div>
                      </div>
                    )}

                    {error && (
                      <div
                        className="alert alert-danger d-flex align-items-center mb-4"
                        role="alert"
                      >
                        <X size={18} className="me-2 flex-shrink-0" />
                        <div>{error}</div>
                      </div>
                    )}

                    <div className="rf-form-grid">
                      {/* Title */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
                        >
                          <FileText size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Title : <span className="req">*</span>
                          </label>
                          <input
                            type="text"
                            className="rf-input"
                            placeholder="Enter Title Name"
                            required
                            value={form.title}
                            onChange={(e) =>
                              setForm({ ...form, title: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Preferred Course */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#e0f2fe", color: "#0284c7" }}
                        >
                          <BookOpen size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Preferred Course : <span className="req">*</span>
                          </label>
                          <select
                            className="rf-select"
                            required
                            name="course"
                            id="course"
                            value={form.course}
                            onChange={(e) => {
                              setForm({
                                ...form,
                                course: e.target.value,
                                course_name: getCourseNamesByIds(
                                  e.target.value,
                                ),
                              });

                              const exists = batches.some(
                                (b) => b.req_id === e.target.value,
                              );
                              if (!exists) {
                                loadBatches(e.target.value);
                              } else {
                                loadTrainers(e.target.value);
                              }
                            }}
                          >
                            <option value="">Select Course</option>

                            {ustatus === "2" &&
                              courses
                                .filter((c) => c.status === "1")
                                .filter((c) =>
                                  usercourses.some(
                                    (uc) => uc.c_id === c.req_id,
                                  ),
                                )
                                .map((c) => (
                                  <option key={c.req_id} value={c.req_id}>
                                    {decodeHtml(c.title)}
                                  </option>
                                ))}

                            {(ustatus === "X" || ustatus === "Y") &&
                              courses
                                .filter((c) => c.status === "1")
                                .map((c) => (
                                  <option key={c.req_id} value={c.req_id}>
                                    {decodeHtml(c.title)}
                                  </option>
                                ))}
                          </select>
                        </div>
                      </div>

                      {/* Preferred Batch */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#fef3c7", color: "#d97706" }}
                        >
                          <Layers size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Preferred Batch : <span className="req">*</span>
                          </label>
                          <select
                            className="rf-select"
                            required
                            name="batch"
                            id="batch"
                            value={form.batch}
                            onChange={(e) => {
                              setForm({
                                ...form,
                                batch: e.target.value,
                                batch_name: getBatchNameById(e.target.value),
                              });
                            }}
                          >
                            <option value="">Select Batch</option>
                            {batches
                              .filter((res) => res.req_id === form.course)
                              .flatMap((res) => res.data)
                              .filter((c) => c.status === "1")
                              .map((c) => (
                                <option key={c.b_id} value={c.b_id}>
                                  {decodeHtml(c.name)}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {/* Trainer */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#d1fae5", color: "#059669" }}
                        >
                          <UserCheck size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Trainer : <span className="req">*</span>
                          </label>
                          <select
                            className="rf-select"
                            required
                            name="trainer"
                            id="trainer"
                            value={form.mem_id}
                            onChange={(e) => {
                              const selectedTrainer = trainers.find(
                                (t) => t.mem_id === e.target.value,
                              );
                              setForm({
                                ...form,
                                mem_id: e.target.value,
                                tname: selectedTrainer
                                  ? selectedTrainer.name
                                  : "",
                              });
                            }}
                          >
                            <option value="">Select Trainer</option>
                            {ustatus === "2" &&
                              trainers
                                .filter((res) => res.mem_id === key)
                                .map((c) => (
                                  <option key={c.mem_id} value={c.mem_id}>
                                    {decodeHtml(c.name)}
                                  </option>
                                ))}

                            {(ustatus === "X" || ustatus === "Y") &&
                              trainers.map((c) => (
                                <option key={c.mem_id} value={c.mem_id}>
                                  {decodeHtml(c.name)}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {/* Submission Start Date */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#e0e7ff", color: "var(--ad-brand-2)" }}
                        >
                          <Calendar size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Submission Start Date :{" "}
                            <span className="req">*</span>
                          </label>
                          <input
                            type="date"
                            className="rf-input"
                            required
                            value={form.sdate}
                            onChange={(e) =>
                              setForm({ ...form, sdate: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Submission End Date */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#fee2e2", color: "#e11d48" }}
                        >
                          <Calendar size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Submission End Date : <span className="req">*</span>
                          </label>
                          <input
                            type="date"
                            className="rf-input"
                            required
                            value={form.edate}
                            onChange={(e) =>
                              setForm({ ...form, edate: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Assignment Document */}
                      <div
                        className="rf-field-card"
                        style={{
                          gridColumn: "1 / -1",
                          alignItems: "flex-start",
                        }}
                      >
                        <div
                          className="rf-icon-wrap"
                          style={{
                            background: "#cffafe",
                            color: "#0891b2",
                            marginTop: 4,
                          }}
                        >
                          <UploadCloud size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Assignment Document : <span className="req">*</span>
                          </label>
                          <input
                            type="file"
                            className="rf-input"
                            required
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                            value={form.file}
                            onChange={(e: any) => {
                              setFile(e.target.files[0]);
                              setProgress(0);
                              setForm({ ...form, file: e.target.value });
                            }}
                          />
                          <small
                            style={{
                              color: "#64748b",
                              fontSize: 12,
                              marginTop: 5,
                              display: "block",
                            }}
                          >
                            Supported file formats: PDF, DOC, DOCX, XLS, XLSX,
                            PPT, PPTX, TXT, CSV
                          </small>
                        </div>
                      </div>

                      {/* Note */}
                      <div
                        className="rf-field-card"
                        style={{
                          gridColumn: "1 / -1",
                          alignItems: "flex-start",
                        }}
                      >
                        <div
                          className="rf-icon-wrap"
                          style={{
                            background: "#f1f5f9",
                            color: "#475569",
                            marginTop: 4,
                          }}
                        >
                          <ClipboardList size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Instructions / Note :
                          </label>
                          <textarea
                            className="rf-textarea"
                            id="note"
                            name="note"
                            placeholder="Provide additional instructions, rubric or guidelines for this assignment..."
                            value={form.note}
                            onChange={(e) =>
                              setForm({ ...form, note: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {loading && (
                        <div className="rf-progress-bar-container">
                          <div className="rf-progress">
                            <div
                              className="rf-progress-fill"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="rf-progress-text">
                            {progress}% Uploading...
                          </div>
                        </div>
                      )}

                      {/* Submit */}
                      <button
                        type="submit"
                        className="rf-submit-btn"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <div
                              className="spinner-border spinner-border-sm"
                              role="status"
                            />
                            <span>Adding Assignment...</span>
                          </>
                        ) : (
                          <>
                            <Plus size={18} />
                            <span>Add Assignment</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {mode === "update" && (
          <div className="rf-page-wrapper">
            <div className="rf-container">
              {/* Header Card */}
              <div className="rf-header-card">
                <div className="rf-header-left">
                  <div className="rf-header-icon-box">
                    <Edit size={24} />
                  </div>
                  <div>
                    <h1 className="rf-header-title">
                      Updating Assignment Details
                    </h1>
                    <p className="rf-header-subtitle">
                      Modify assignment schedule, attachments, or instructions
                    </p>
                  </div>
                </div>

                {/* Decorative graphic */}
                <div className="rf-header-decor">
                  <FileText size={96} color="var(--ad-brand)" />
                </div>

                <a onClick={() => moveto("board")} className="rf-btn-back">
                  <ArrowLeft size={16} /> Go Back
                </a>
              </div>

              {/* Form Card */}
              <div className="rf-form-card">
                {permCan("edit") && (
                  <form onSubmit={updateList}>
                    {/* Status Messages */}
                    {success && (
                      <div
                        className="alert alert-success d-flex align-items-center mb-4"
                        role="alert"
                      >
                        <CheckCircle size={18} className="me-2 flex-shrink-0" />
                        <div>{success}</div>
                      </div>
                    )}

                    {error && (
                      <div
                        className="alert alert-danger d-flex align-items-center mb-4"
                        role="alert"
                      >
                        <X size={18} className="me-2 flex-shrink-0" />
                        <div>{error}</div>
                      </div>
                    )}

                    <div className="rf-form-grid">
                      {/* Title */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
                        >
                          <FileText size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Title : <span className="req">*</span>
                          </label>
                          <input
                            type="text"
                            className="rf-input"
                            placeholder="Enter Title Name"
                            required
                            value={form.title}
                            onChange={(e) =>
                              setForm({ ...form, title: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Preferred Course */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#e0f2fe", color: "#0284c7" }}
                        >
                          <BookOpen size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Preferred Course : <span className="req">*</span>
                          </label>
                          <select
                            className="rf-select"
                            required
                            name="course"
                            id="course"
                            value={form.course}
                            onChange={(e) => {
                              setForm({
                                ...form,
                                course: e.target.value,
                                course_name: getCourseNamesByIds(
                                  e.target.value,
                                ),
                              });

                              const exists = batches.some(
                                (b) => b.req_id === e.target.value,
                              );
                              if (!exists) {
                                loadBatches(e.target.value);
                              } else {
                                loadTrainers(e.target.value);
                              }
                            }}
                          >
                            <option value="">Select Course</option>

                            {ustatus === "2" &&
                              courses
                                .filter((c) => c.status === "1")
                                .filter((c) =>
                                  usercourses.some(
                                    (uc) => uc.c_id === c.req_id,
                                  ),
                                )
                                .map((c) => (
                                  <option key={c.req_id} value={c.req_id}>
                                    {decodeHtml(c.title)}
                                  </option>
                                ))}

                            {(ustatus === "X" || ustatus === "Y") &&
                              courses
                                .filter((c) => c.status === "1")
                                .map((c) => (
                                  <option key={c.req_id} value={c.req_id}>
                                    {decodeHtml(c.title)}
                                  </option>
                                ))}
                          </select>
                        </div>
                      </div>

                      {/* Preferred Batch */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#fef3c7", color: "#d97706" }}
                        >
                          <Layers size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Preferred Batch : <span className="req">*</span>
                          </label>
                          <select
                            className="rf-select"
                            required
                            name="batch"
                            id="batch"
                            value={form.batch}
                            onChange={(e) => {
                              setForm({
                                ...form,
                                batch: e.target.value,
                                batch_name: getBatchNameById(e.target.value),
                              });
                            }}
                          >
                            <option value="">Select Batch</option>
                            {batches
                              .filter((res) => res.req_id === form.course)
                              .flatMap((res) => res.data)
                              .filter((c) => c.status === "1")
                              .map((c) => (
                                <option key={c.b_id} value={c.b_id}>
                                  {decodeHtml(c.name)}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {/* Trainer */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#d1fae5", color: "#059669" }}
                        >
                          <UserCheck size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Trainer : <span className="req">*</span>
                          </label>
                          <select
                            className="rf-select"
                            required
                            name="trainer"
                            id="trainer"
                            value={form.mem_id}
                            onChange={(e) => {
                              const selectedTrainer = trainers.find(
                                (t) => t.mem_id === e.target.value,
                              );
                              setForm({
                                ...form,
                                mem_id: e.target.value,
                                tname: selectedTrainer
                                  ? selectedTrainer.name
                                  : "",
                              });
                            }}
                          >
                            <option value="">Select Trainer</option>
                            {ustatus === "2" &&
                              trainers
                                .filter((res) => res.mem_id === key)
                                .map((c) => (
                                  <option key={c.mem_id} value={c.mem_id}>
                                    {decodeHtml(c.name)}
                                  </option>
                                ))}

                            {(ustatus === "X" || ustatus === "Y") &&
                              trainers.map((c) => (
                                <option key={c.mem_id} value={c.mem_id}>
                                  {decodeHtml(c.name)}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {/* Submission Start Date */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#e0e7ff", color: "var(--ad-brand-2)" }}
                        >
                          <Calendar size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Submission Start Date :{" "}
                            <span className="req">*</span>
                          </label>
                          <input
                            type="date"
                            className="rf-input"
                            required
                            value={form.sdate}
                            onChange={(e) =>
                              setForm({ ...form, sdate: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Submission End Date */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#fee2e2", color: "#e11d48" }}
                        >
                          <Calendar size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Submission End Date : <span className="req">*</span>
                          </label>
                          <input
                            type="date"
                            className="rf-input"
                            required
                            value={form.edate}
                            onChange={(e) =>
                              setForm({ ...form, edate: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Assignment Document */}
                      <div
                        className="rf-field-card"
                        style={{
                          gridColumn: "1 / -1",
                          alignItems: "flex-start",
                        }}
                      >
                        <div
                          className="rf-icon-wrap"
                          style={{
                            background: "#cffafe",
                            color: "#0891b2",
                            marginTop: 4,
                          }}
                        >
                          <UploadCloud size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Assignment Document :
                          </label>
                          <input
                            type="file"
                            className="rf-input"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                            onChange={(e: any) => {
                              setFile(e.target.files[0]);
                              setProgress(0);
                              setForm({ ...form, file: e.target.value });
                            }}
                          />
                          {form.file && (
                            <div style={{ marginTop: 8 }}>
                              <a
                                href={AWS_UPLOADS + form.file}
                                target="_blank"
                                rel="noreferrer"
                                className="rf-file-existing"
                              >
                                <Download size={14} /> Download Current File
                              </a>
                            </div>
                          )}
                          <small
                            style={{
                              color: "#64748b",
                              fontSize: 12,
                              marginTop: 5,
                              display: "block",
                            }}
                          >
                            Note: If you select a new file, the existing file
                            will be replaced. Supported formats: PDF, DOC, DOCX,
                            XLS, XLSX, PPT, PPTX, TXT, CSV
                          </small>
                        </div>
                      </div>

                      {/* Note */}
                      <div
                        className="rf-field-card"
                        style={{
                          gridColumn: "1 / -1",
                          alignItems: "flex-start",
                        }}
                      >
                        <div
                          className="rf-icon-wrap"
                          style={{
                            background: "#f1f5f9",
                            color: "#475569",
                            marginTop: 4,
                          }}
                        >
                          <ClipboardList size={20} />
                        </div>
                        <div className="rf-field-body">
                          <label className="rf-field-label">
                            Instructions / Note :
                          </label>
                          <textarea
                            className="rf-textarea"
                            id="note"
                            name="note"
                            placeholder="Provide additional instructions, rubric or guidelines for this assignment..."
                            value={form.note}
                            onChange={(e) =>
                              setForm({ ...form, note: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {loading && (
                        <div className="rf-progress-bar-container">
                          <div className="rf-progress">
                            <div
                              className="rf-progress-fill"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="rf-progress-text">
                            {progress}% Uploading...
                          </div>
                        </div>
                      )}

                      {/* Submit */}
                      <button
                        type="submit"
                        className="rf-submit-btn"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <div
                              className="spinner-border spinner-border-sm"
                              role="status"
                            />
                            <span>Updating Assignment...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle size={18} />
                            <span>Update Assignment</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {mode === "view" && (
          <div className="rf-page-wrapper">
            <div className="rf-container">
              {/* Header Card */}
              <div className="rf-header-card">
                <div className="rf-header-left">
                  <button
                    type="button"
                    className="asg-btn-view"
                    style={{
                      background: "#ffffff",
                      padding: "8px 12px",
                      borderRadius: "10px",
                    }}
                    onClick={() => moveto("board")}
                    title="Go Back"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="rf-header-icon-box">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h1 className="rf-header-title">Assignment Details</h1>
                    <p className="rf-header-subtitle">
                      Course: <b>{decodeHtml(form.course_name)}</b>
                    </p>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <a onClick={() => moveto("board")} className="rf-btn-back">
                    <ArrowLeft size={16} /> Go Back
                  </a>

                  {permCan("edit") &&
                    form.status !== "2" &&
                    form.status !== "1D" && (
                      <button
                        type="button"
                        className="asg-btn-update"
                        style={{ padding: "8px 16px", borderRadius: "10px" }}
                        onClick={() => updateto("update", form)}
                      >
                        <Edit size={14} /> Edit Assignment
                      </button>
                    )}

                  <button
                    type="button"
                    className="asg-btn-submit"
                    style={{
                      padding: "8px 16px",
                      borderRadius: "10px",
                      textDecoration: "none",
                    }}
                    onClick={() => {
                      setAssLists(form);
                      setAssignmentid(form.req_id);
                      setMainMode("subassignments");
                    }}
                  >
                    <FileText size={15} /> View Submissions (
                    {form.subs_count || 0})
                  </button>
                </div>
              </div>

              {/* Status Messages */}
              {success && (
                <div
                  className="alert alert-success d-flex align-items-center mb-4"
                  role="alert"
                >
                  <CheckCircle size={18} className="me-2 flex-shrink-0" />
                  <div>{success}</div>
                </div>
              )}
              {error && (
                <div
                  className="alert alert-danger d-flex align-items-center mb-4"
                  role="alert"
                >
                  <X size={18} className="me-2 flex-shrink-0" />
                  <div>{error}</div>
                </div>
              )}

              {/* Two Column Layout */}
              <div className="row g-4">
                {/* Left Column: Summary Card */}
                <div className="col-lg-4">
                  <div
                    className="rf-form-card text-center"
                    style={{ padding: "24px" }}
                  >
                    <div
                      className="mx-auto mb-3"
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: "18px",
                        background: "#ede9fe",
                        color: "var(--ad-brand)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FileText size={32} />
                    </div>

                    <h5 className="fw-bold text-dark mb-1">
                      {form.title || "Assignment Title"}
                    </h5>
                    <p
                      className="text-muted mb-3"
                      style={{ fontSize: "12.5px" }}
                    >
                      {decodeHtml(form.course_name)} ·{" "}
                      {decodeHtml(form.batch_name)}
                    </p>

                    <div className="mb-3">
                      <span
                        className={`asg-status-pill ${
                          String(form.status) === "2"
                            ? "asg-pill-completed"
                            : String(form.status) === "1S" ||
                                String(form.status) === "1D"
                              ? "asg-pill-disabled"
                              : "asg-pill-active"
                        }`}
                        style={{ fontSize: "12.5px", padding: "5px 14px" }}
                      >
                        ● {getStatus(form.status)}
                      </span>
                    </div>

                    {/* Submission and Student Stats Box */}
                    <div className="d-grid gap-2 mb-3">
                      <div
                        className="p-3 text-start rounded-3 d-flex align-items-center justify-content-between"
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #edf2f7",
                        }}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <Users size={16} className="text-primary" />
                          <span
                            style={{
                              fontSize: "12.5px",
                              color: "#64748b",
                              fontWeight: 600,
                            }}
                          >
                            Total Students
                          </span>
                        </div>
                        <strong
                          className="text-dark"
                          style={{ fontSize: "15px" }}
                        >
                          {form.students_count || 0}
                        </strong>
                      </div>

                      <div
                        className="p-3 text-start rounded-3 d-flex align-items-center justify-content-between"
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #edf2f7",
                        }}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <UploadCloud size={16} className="text-success" />
                          <span
                            style={{
                              fontSize: "12.5px",
                              color: "#64748b",
                              fontWeight: 600,
                            }}
                          >
                            Submissions
                          </span>
                        </div>
                        <strong
                          className="text-dark"
                          style={{ fontSize: "15px" }}
                        >
                          {form.subs_count || 0}
                        </strong>
                      </div>
                    </div>

                    {/* Document Box */}
                    <div
                      className="p-3 mb-3 text-start rounded-3"
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #edf2f7",
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                          <Download size={18} className="text-primary" />
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#1e293b",
                            }}
                          >
                            Assignment Document
                          </span>
                        </div>
                        {form.file ? (
                          <a
                            href={AWS_UPLOADS + form.file}
                            target="_blank"
                            rel="noreferrer"
                            className="asg-doc-link"
                          >
                            Download
                          </a>
                        ) : (
                          <span
                            className="text-muted"
                            style={{ fontSize: "12px" }}
                          >
                            None
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Submissions Action CTA */}
                    <button
                      type="button"
                      className="rf-submit-btn w-100 justify-content-center"
                      style={{ marginTop: "10px", padding: "11px 20px" }}
                      onClick={() => {
                        setAssLists(form);
                        setAssignmentid(form.req_id);
                        setMainMode("subassignments");
                      }}
                    >
                      <FileText size={17} />
                      <span>View All Submissions</span>
                    </button>
                  </div>
                </div>

                {/* Right Column: Information & Guidelines */}
                <div className="col-lg-8">
                  {/* Metadata Grid Card */}
                  <div className="rf-form-card mb-4">
                    <h5
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#0f172a",
                        marginBottom: 18,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <ClipboardList size={18} color="var(--ad-brand)" /> Assignment
                      Schedule & Instructor
                    </h5>

                    <div className="rf-form-grid">
                      {/* Course */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#ede9fe", color: "var(--ad-brand)" }}
                        >
                          <BookOpen size={20} />
                        </div>
                        <div className="rf-field-body">
                          <span className="rf-field-label">
                            Assigned Course
                          </span>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#0f172a",
                            }}
                          >
                            {decodeHtml(form.course_name) || "—"}
                          </div>
                        </div>
                      </div>

                      {/* Batch */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#fef3c7", color: "#d97706" }}
                        >
                          <Layers size={20} />
                        </div>
                        <div className="rf-field-body">
                          <span className="rf-field-label">Batch Name</span>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#0f172a",
                            }}
                          >
                            {decodeHtml(form.batch_name) || "—"}
                          </div>
                        </div>
                      </div>

                      {/* Trainer */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#dcfce7", color: "#16a34a" }}
                        >
                          <UserCheck size={20} />
                        </div>
                        <div className="rf-field-body">
                          <span className="rf-field-label">
                            Assigned Trainer
                          </span>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#0f172a",
                            }}
                          >
                            {decodeHtml(form.tname) || "Trainer"}
                          </div>
                        </div>
                      </div>

                      {/* Created Date */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#f1f5f9", color: "#475569" }}
                        >
                          <Calendar size={20} />
                        </div>
                        <div className="rf-field-body">
                          <span className="rf-field-label">Created On</span>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#0f172a",
                            }}
                          >
                            {formatDate(form.datetime) || "—"}
                          </div>
                        </div>
                      </div>

                      {/* Start Date */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#e0f2fe", color: "#0284c7" }}
                        >
                          <Calendar size={20} />
                        </div>
                        <div className="rf-field-body">
                          <span className="rf-field-label">
                            Submission Starts
                          </span>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#0f172a",
                            }}
                          >
                            {form.sdate ? formatDate(form.sdate) : "—"}
                          </div>
                        </div>
                      </div>

                      {/* Due Date */}
                      <div className="rf-field-card">
                        <div
                          className="rf-icon-wrap"
                          style={{ background: "#fee2e2", color: "#dc2626" }}
                        >
                          <Calendar size={20} />
                        </div>
                        <div className="rf-field-body">
                          <span className="rf-field-label">
                            Submission Due Date
                          </span>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#0f172a",
                            }}
                          >
                            {form.edate ? formatDate(form.edate) : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes & Instructions Card */}
                  <div className="rf-form-card mb-4">
                    <h5
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#0f172a",
                        marginBottom: 14,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <FileText size={18} color="var(--ad-brand)" /> Instructions &
                      Description
                    </h5>

                    {form.note ? (
                      <div
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          padding: "16px 20px",
                          fontSize: "14px",
                          lineHeight: "1.65",
                          color: "#334155",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {form.note}
                      </div>
                    ) : (
                      <p
                        className="text-muted mb-0"
                        style={{ fontSize: "13.5px" }}
                      >
                        No instructions or guidelines were attached to this
                        assignment.
                      </p>
                    )}
                  </div>

                  {/* Admin Management Action Bar */}
                  <div className="rf-form-card">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <button
                        type="button"
                        className="asg-btn-view"
                        onClick={() => moveto("board")}
                      >
                        ← Back to Board
                      </button>

                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        {loadingId === form.req_id ? (
                          <span className="text-muted">Processing...</span>
                        ) : form.status !== "1D" ? (
                          <>
                            {permCan("edit") && form.status !== "2" && (
                              <button
                                type="button"
                                className="asg-btn-update"
                                onClick={() => updateto("update", form)}
                              >
                                <Edit size={14} /> Edit
                              </button>
                            )}

                            {form.status === "1"
                              ? permCan("status") && (
                                  <button
                                    type="button"
                                    className="asg-btn-disable"
                                    onClick={() => disableList(form)}
                                  >
                                    <X size={14} /> Disable
                                  </button>
                                )
                              : form.status === "1S"
                                ? permCan("status") && (
                                    <button
                                      type="button"
                                      className="asg-btn-enable"
                                      onClick={() => enableList(form)}
                                    >
                                      <Check size={14} /> Enable
                                    </button>
                                  )
                                : null}

                            {form.status !== "2" && permCan("complete") && (
                              <button
                                type="button"
                                className="asg-btn-end"
                                onClick={() => completeList(form)}
                              >
                                <Check size={14} /> End Assignment
                              </button>
                            )}

                            {permCan("delete") && (
                              <button
                                type="button"
                                className="asg-btn-del"
                                onClick={() => deleteList(form)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="badge bg-danger">
                            Deleted Assignment
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
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

function SubAssignments({ setMainMode, asslists, assignmentid }: any) {
  const permCan = usePagePerm("assignments");

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true, // 🔥 REQUIRED
    });

    return res.data;
  };

  /*
  const getAssignmentNamesByIds = (ids: string) => {
    if (!ids || assignments.length === 0) return "";
    return ids
      .split(",")                 // "2,5,7" → ["2","5","7"]
      .map(id => id.trim())       // remove spaces
      .map(id => {
        const course = assignments.find(c => c.req_id === id);
        return course ? decodeHtml(course.title) : "";
      })
      .filter(title => title)     // remove empty values
      .join(", ");                // join with comma + space
  };
*/

  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [mode, setMode] = useState("board");

  const [model, setModel] = useState("");

  const limit = 10;
  const [courses, setAllcourses] = useState<any[]>([]);
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [lastPage, setLastPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  function decodeHtml(str: any) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  const formatDateTime = (ts: any) => {
    if (!ts) return "";

    const date = new Date(ts * 1000);

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

  const location = useLocation();

  const loadDetails = async (page = 1, search = "", sort = "") => {
    setLoading(true);
    setAllLists([]);
    setPage(page);
    setSearch(search);
    setSort(sort);

    try {
      const res = await listFetch("api/sub-assignments", {
        q: search,
        s: sort,
        n: page,
        id: assignmentid + "",
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

  const rejectlist = async (list: any) => {
    // ✅ Ask confirmation first
    const reason = window.prompt(
      "Are you sure you want to reject of '" +
        list.name +
        "' assignment?\n\nEnter reason:",
    );

    if (reason === null) return; // ❌ Cancel clicked

    try {
      setLoadingId(list.id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/reject-subassignment",
        {
          id: list.id,
          req_id: list.req_id,
          mem_id: list.mem_id,
          reason: reason,
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
            b.id === list.id
              ? {
                  ...b,
                  reason: reason,
                  updatetime: res.data.datetime,
                  status: "0",
                }
              : b,
          ),
        );
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      alert("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const approvelist = async (list: any) => {
    // ✅ Ask confirmation first
    const confirm = window.confirm(
      "Are you sure you want to approve of '" + list.name + "' assignment?",
    );

    if (!confirm) return; // ❌ Cancel clicked

    try {
      setLoadingId(list.id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/approve-subassignment",
        {
          id: list.id,
          req_id: list.req_id,
          mem_id: list.mem_id,
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
            b.id === list.id
              ? { ...b, updatetime: res.data.datetime, status: "2" }
              : b,
          ),
        );
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      alert("❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const getGender = (g: any) => {
    return g === "1" ? "Male" : g === "2" ? "Female" : "-";
  };

  const initialForm = {
    name: "",
    gender: "",
    email: "",
    number: "",
    course_name: "",
    batch_name: "",
    qualification: "",
    file: "",
    datetime: "",
    updatetime: "",
    status: "",
    reason: "",
  };

  const [form, setForm] = useState(initialForm);

  const fbmemberList = async (list: any) => {
    setLoading(true);
    setAllcourses([]);
    try {
      const res = await listFetch("api/get-member", {
        mem_id: list.mem_id,
      });
      if (res.data.success) {
        const user = res.data.data?.[0];
        if (!user) {
          toast.error("No data found");
          return;
        }
        setAllcourses(user.courses);
        setForm({
          ...initialForm, // reset first (optional)
          name: user.name || "",
          email: user.email || "",
          number: user.number || "",
          gender: getGender(user.gender) || "",
          course_name: user.course_name || "",
          batch_name: user.batch_name || "",
          qualification: user.qualification || "",
          file: list.file || "",
          datetime: list.datetime || "",
          updatetime: list.updatetime || "",
          reason: list.reason || "",
          status: list.status || "",
        });
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      alert("❌ Something went wrong");
    } finally {
      setLoading(false);
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
    if (loggedIn && (ustatus == "X" || ustatus == "Y" || ustatus == "2")) {
      loadDetails();
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

    initchecklogin();

    // ---------- Admin CSS ----------

    return () => {
      //document.body.removeChild(aosrun);
      //document.head.removeChild(maincss);
      //document.head.removeChild(adminlink);
    };
  }, []);

  const avatarPalette = [
    { bg: "#ede9fe", text: "var(--ad-brand)" },
    { bg: "#e0f2fe", text: "#0284c7" },
    { bg: "#dcfce7", text: "#16a34a" },
    { bg: "#ffe4e6", text: "#e11d48" },
    { bg: "#fef3c7", text: "#d97706" },
  ];

  const getAvatarStyle = (index: number) => {
    return avatarPalette[index % avatarPalette.length];
  };

  const getInitials = (name?: string) => {
    if (!name) return "ST";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatDateTimeLines = (ts: any) => {
    if (!ts) return { date: "-", time: "" };
    let num = Number(ts);
    let d: Date;
    if (!isNaN(num) && num > 0) {
      if (num < 10000000000) {
        d = new Date(num * 1000);
      } else {
        d = new Date(num);
      }
    } else {
      d = new Date(ts);
    }

    if (isNaN(d.getTime())) return { date: String(ts), time: "" };

    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const dateStr = `${day}/${month}/${year}`;
    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return { date: dateStr, time: timeStr };
  };

  const renderStatusBadge = (status: any) => {
    const s = String(status);
    if (s === "2") {
      return (
        <span className="si-status-pill status-approved">
          <span className="si-status-dot"></span>
          Approved
        </span>
      );
    }
    if (s === "0") {
      return (
        <span className="si-status-pill status-rejected">
          <span className="si-status-dot"></span>
          Rejected
        </span>
      );
    }
    return (
      <span className="si-status-pill status-pending">
        <span className="si-status-dot"></span>
        Pending Review
      </span>
    );
  };

  return (
    <>
      <Head
        pageTitle={seo.title}
        pageDesc={seo.description}
        pageKeywords={seo.keywords}
      />

      <style>{`
        .si-wrapper {
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
          border-radius: 14px;
          background: #eef2ff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ad-brand);
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
          margin-right: 6px;
        }
        .si-total-count-text b {
          font-weight: 700;
          color: #0f172a;
        }
        .si-btn-back {
          background: #ffffff;
          border: 1.5px solid #cbd5e1;
          color: #334155;
          border-radius: 10px;
          padding: 8px 16px;
          font-size: 13.5px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-btn-back:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
          color: #0f172a;
        }

        /* Stat Cards */
        .si-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }
        @media (max-width: 1024px) {
          .si-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 600px) {
          .si-stats-grid {
            grid-template-columns: 1fr;
          }
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
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
        }
        .si-stat-card.active {
          box-shadow: 0 0 0 2px var(--ad-brand), 0 6px 16px rgba(var(--ad-brand-rgb), 0.12);
          border-color: var(--ad-brand);
        }
        .si-stat-card.card-pending.active {
          box-shadow: 0 0 0 2px #d97706, 0 6px 16px rgba(217, 119, 6, 0.15);
          border-color: #d97706;
        }
        .si-stat-card.card-approved.active {
          box-shadow: 0 0 0 2px #16a34a, 0 6px 16px rgba(22, 163, 74, 0.15);
          border-color: #16a34a;
        }
        .si-stat-card.card-rejected.active {
          box-shadow: 0 0 0 2px #dc2626, 0 6px 16px rgba(220, 38, 38, 0.15);
          border-color: #dc2626;
        }
        .si-stat-card.card-total {
          background: #f0f8ff;
        }
        .si-stat-card.card-pending {
          background: #fffbeb;
        }
        .si-stat-card.card-approved {
          background: #f0fdf4;
        }
        .si-stat-card.card-rejected {
          background: #fff1f2;
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
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.1;
          margin-top: 4px;
          margin-bottom: 0;
        }

        /* Filter Bar */
        .si-filter-bar {
          background: #ffffff;
          border-radius: 14px;
          padding: 12px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          border: 1px solid #edf2f6;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          flex-wrap: wrap;
          gap: 14px;
        }
        .si-filter-left {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        .si-sort-group {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #334155;
          font-weight: 600;
          font-size: 13.5px;
        }
        .si-select-sort {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 7px 32px 7px 12px;
          font-size: 13.5px;
          font-weight: 500;
          color: #1e293b;
          background-color: #ffffff;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2364748b' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          appearance: none;
          cursor: pointer;
          outline: none;
        }
        .si-select-sort:focus {
          border-color: var(--ad-brand);
        }
        .si-filter-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .si-search-box {
          display: flex;
          align-items: center;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 12px;
          background: #ffffff;
          min-width: 280px;
          gap: 8px;
          transition: border-color 0.15s ease;
        }
        .si-search-box:focus-within {
          border-color: var(--ad-brand);
        }
        .si-search-input {
          border: none;
          outline: none;
          font-size: 13px;
          color: #1e293b;
          width: 100%;
          background: transparent;
        }
        .si-search-input::placeholder {
          color: #94a3b8;
        }
        .si-reload-btn {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--ad-brand);
          border: none;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
        }
        .si-reload-btn:hover {
          background: var(--ad-brand-2);
          transform: rotate(45deg);
        }

        /* Table Card */
        .si-table-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #eef2f6;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          margin-bottom: 24px;
        }
        .si-table-responsive {
          width: 100%;
          overflow-x: auto;
        }
        .si-table {
          width: 100%;
          border-collapse: collapse;
          margin: 0;
        }
        .si-thead {
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        .si-th {
          padding: 14px 16px;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          text-align: left;
          white-space: nowrap;
          border: none;
        }
        .si-tr {
          border-bottom: 1px solid #f1f5f9;
          transition: background 0.15s ease;
        }
        .si-tr:hover {
          background: #fafbff;
        }
        .si-td {
          padding: 14px 16px;
          font-size: 13.5px;
          color: #334155;
          vertical-align: middle;
          border: none;
        }
        .si-avatar-badge {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13.5px;
          flex-shrink: 0;
        }
        .si-user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .si-name {
          font-weight: 600;
          color: #0f172a;
          white-space: nowrap;
        }
        .si-datetime-col {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .si-date-text {
          font-size: 13px;
          font-weight: 500;
          color: #1e293b;
        }
        .si-time-text {
          font-size: 11.5px;
          color: #64748b;
        }
        .si-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }
        .si-status-pill.status-approved {
          background: #dcfce7;
          color: #15803d;
        }
        .si-status-pill.status-rejected {
          background: #fee2e2;
          color: #b91c1c;
        }
        .si-status-pill.status-pending {
          background: #fef3c7;
          color: #b45309;
        }
        .si-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .status-approved .si-status-dot {
          background: #16a34a;
        }
        .status-rejected .si-status-dot {
          background: #ef4444;
        }
        .status-pending .si-status-dot {
          background: #f59e0b;
        }
        .si-actions-cell {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .si-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-action-btn:hover {
          transform: scale(1.06);
        }
        .si-action-btn.btn-view {
          background: #eff6ff;
          color: #2563eb;
        }
        .si-action-btn.btn-view:hover {
          background: #dbeafe;
        }
        .si-action-btn.btn-download {
          background: #ede9fe;
          color: var(--ad-brand);
        }
        .si-action-btn.btn-download:hover {
          background: #ddd6fe;
        }
        .si-action-btn.btn-approve {
          background: #f0fdf4;
          color: #16a34a;
        }
        .si-action-btn.btn-approve:hover {
          background: #dcfce7;
        }
        .si-action-btn.btn-reject {
          background: #fee2e2;
          color: #ef4444;
        }
        .si-action-btn.btn-reject:hover {
          background: #fecaca;
        }

        /* Footer & Pagination */
        .si-table-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-top: 1px solid #f1f5f9;
          flex-wrap: wrap;
          gap: 12px;
        }
        .si-footer-left {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          color: #64748b;
        }
        .si-limit-select {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 5px 24px 5px 10px;
          font-size: 13px;
          color: #1e293b;
          background-color: #ffffff;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%2364748b' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 8px center;
          appearance: none;
          cursor: pointer;
          outline: none;
        }
        .si-pagination {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .si-page-nav-btn {
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
        .si-page-nav-btn:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #1e293b;
        }
        .si-page-nav-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .si-page-btn {
          min-width: 32px;
          height: 32px;
          padding: 0 8px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.15s ease;
        }
        .si-page-btn:hover:not(.active) {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        .si-page-btn.active {
          background: var(--ad-brand);
          border-color: var(--ad-brand);
          color: #ffffff;
          font-weight: 600;
        }

        /* Modern Modal Backdrop & Card */
        .subm-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(4px);
          z-index: 1050;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .subm-modal-card {
          background: #ffffff;
          border-radius: 20px;
          width: 100%;
          max-width: 620px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          border: 1px solid #e2e8f0;
          animation: modalFadeIn 0.2s ease;
        }
        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .subm-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
        }
        .subm-modal-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .subm-modal-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .subm-modal-close:hover {
          background: #f1f5f9;
          color: #0f172a;
        }
        .subm-modal-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .subm-modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          background: #f8fafc;
          border-bottom-left-radius: 20px;
          border-bottom-right-radius: 20px;
        }
      `}</style>

      {/* Main Content */}
      <div className="content">
        {mode === "board" && (
          <div className="si-wrapper" style={{ width: "100%" }}>
            {/* Header Card */}
            <div className="si-header-container">
              <div className="si-header-left">
                <div className="si-header-icon-box">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="si-header-title">
                    Submissions: {asslists.title || "Assignment"}
                  </h3>
                  <p className="si-header-subtitle">
                    {asslists.course_name
                      ? `Course: ${asslists.course_name} • `
                      : ""}
                    {asslists.batch_name
                      ? `Batch: ${asslists.batch_name}`
                      : "All Batches"}
                  </p>
                </div>
              </div>

              <div className="si-header-right">
                <span className="si-total-count-text">
                  Total Submissions <b>{listtotal || alllists.length}</b>
                </span>

                <button
                  type="button"
                  className="si-btn-back"
                  onClick={() => setMainMode("assignments")}
                >
                  <ArrowLeft size={16} /> Back to Assignments
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="si-stats-grid">
              {/* Total Submissions */}
              <div
                className={`si-stat-card card-total ${statusFilter === "ALL" ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter("ALL");
                  setSearch("");
                  loadDetails(1, "", sort);
                }}
                title="Click to view all submissions"
              >
                <div
                  className="si-stat-icon-wrap"
                  style={{ background: "#e0f2fe", color: "#0284c7" }}
                >
                  <FileText size={22} />
                </div>
                <div>
                  <div className="si-stat-label">Total Submissions</div>
                  <div className="si-stat-value">
                    <AnimatedNumber value={listtotal || alllists.length} pending={loading} id="Assignments-s1" />
                  </div>
                </div>
              </div>

              {/* Pending Review */}
              <div
                className={`si-stat-card card-pending ${statusFilter === "1" ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter((prev) => (prev === "1" ? "ALL" : "1"));
                }}
                title="Click to filter by Pending submissions"
              >
                <div
                  className="si-stat-icon-wrap"
                  style={{ background: "#fef3c7", color: "#d97706" }}
                >
                  <Clock size={22} />
                </div>
                <div>
                  <div className="si-stat-label">Pending Review</div>
                  <div className="si-stat-value">
                    <AnimatedNumber value={alllists.filter((l) => String(l.status) === "1").length} pending={loading} id="Assignments-s2" />
                  </div>
                </div>
              </div>

              {/* Approved */}
              <div
                className={`si-stat-card card-approved ${statusFilter === "2" ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter((prev) => (prev === "2" ? "ALL" : "2"));
                }}
                title="Click to filter by Approved submissions"
              >
                <div
                  className="si-stat-icon-wrap"
                  style={{ background: "#dcfce7", color: "#16a34a" }}
                >
                  <CheckCircle size={22} />
                </div>
                <div>
                  <div className="si-stat-label">Approved</div>
                  <div className="si-stat-value">
                    <AnimatedNumber value={alllists.filter((l) => String(l.status) === "2").length} pending={loading} id="Assignments-s3" />
                  </div>
                </div>
              </div>

              {/* Rejected */}
              <div
                className={`si-stat-card card-rejected ${statusFilter === "0" ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter((prev) => (prev === "0" ? "ALL" : "0"));
                }}
                title="Click to filter by Rejected / Revision submissions"
              >
                <div
                  className="si-stat-icon-wrap"
                  style={{ background: "#fff1f2", color: "#e11d48" }}
                >
                  <AlertCircle size={22} />
                </div>
                <div>
                  <div className="si-stat-label">Rejected / Revision</div>
                  <div className="si-stat-value">
                    <AnimatedNumber value={alllists.filter((l) => String(l.status) === "0").length} pending={loading} id="Assignments-s4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="si-filter-bar">
              <div className="si-filter-left">
                <div className="si-sort-group">
                  <ArrowUpDown size={16} color="#334155" />
                  <span>Sort By</span>
                  <select
                    className="si-select-sort"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      loadDetails(1, search, e.target.value);
                    }}
                  >
                    <option value="New">Newest First</option>
                    <option value="Old">Oldest First</option>
                  </select>
                </div>
              </div>

              <div className="si-filter-right">
                <form
                  className="si-search-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    loadDetails(1, search, sort);
                  }}
                  style={{
                    display: "flex",
                    gap: "10px",
                  }}
                >
                  <ListSearch
                    placeholder="Search by student name, email or contact..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        loadDetails(1, search, sort);
                      }
                    }}
                  />

                  <button
                    data-refresh
                    type="button"
                    className="reload-btn"
                    title="Reload submissions"
                    onClick={() => {
                      setSearch("");
                      loadDetails(1, "", sort);
                    }}
                  >
                    <RotateCw size={16} />
                  </button>
                </form>
              </div>
            </div>

            {/* Table Card */}
            <div className="si-table-card">
              <div className="si-table-responsive">
                <table className="si-table">
                  <thead className="si-thead">
                    <tr>
                      <th className="si-th" style={{ width: "50px" }}>
                        #
                      </th>
                      <th className="si-th">Student</th>
                      <th className="si-th">Contact Info</th>
                      <th className="si-th">Submission File</th>
                      <th className="si-th">Submitted Date</th>
                      <th className="si-th">Actioned Date</th>
                      <th className="si-th">Status</th>
                      <th
                        className="si-th"
                        style={{ width: "140px", textAlign: "center" }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const displayedLists =
                        statusFilter === "ALL"
                          ? alllists
                          : alllists.filter(
                              (l) => String(l.status) === statusFilter,
                            );

                      if (loading) {
                        return (
                          <SkeletonRows />
                        );
                      }

                      if (displayedLists.length === 0) {
                        return (
                          <tr>
                            <td
                              colSpan={8}
                              style={{
                                textAlign: "center",
                                padding: "48px 20px",
                                color: "#64748b",
                              }}
                            >
                              <FileText
                                size={40}
                                color="#cbd5e1"
                                style={{
                                  display: "block",
                                  margin: "0 auto 12px",
                                }}
                              />
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: "15px",
                                  color: "#334155",
                                }}
                              >
                                {statusFilter === "1"
                                  ? "No pending submissions found"
                                  : statusFilter === "2"
                                    ? "No approved submissions found"
                                    : statusFilter === "0"
                                      ? "No rejected submissions found"
                                      : search.length === 0
                                        ? "No submissions found"
                                        : "No matching submissions found"}
                              </div>
                              <div
                                style={{ fontSize: "13px", marginTop: "4px" }}
                              >
                                {statusFilter !== "ALL"
                                  ? "Click the card again or click Total Submissions to view all records."
                                  : search.length === 0
                                    ? "No students have submitted this assignment yet."
                                    : "Try adjusting your search criteria or clearing filters."}
                              </div>
                              <button
                                type="button"
                                className="si-btn-back"
                                style={{
                                  margin: "16px auto 0",
                                  display: "inline-flex",
                                }}
                                onClick={() => {
                                  setStatusFilter("ALL");
                                  setSearch("");
                                  loadDetails(1, "", sort);
                                }}
                              >
                                <RotateCw size={15} /> Show All Submissions
                              </button>
                            </td>
                          </tr>
                        );
                      }

                      return displayedLists.map((list, idx) => {
                        const avatarStyle = getAvatarStyle(idx);
                        const initials = getInitials(list.name);
                        const subDt = formatDateTimeLines(list.datetime);
                        const actDt = formatDateTimeLines(list.updatetime);

                        return (
                          <tr key={list.id || idx} className="si-tr">
                            {/* S.No */}
                            <td
                              className="si-td"
                              style={{ color: "#64748b", fontWeight: 500 }}
                            >
                              {(page - 1) * limit + idx + 1}
                            </td>

                            {/* Student Profile Column */}
                            <td className="si-td">
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                }}
                              >
                                {list.profile ? (
                                  <img
                                    src={list.profile}
                                    alt="profile"
                                    style={{
                                      width: 40,
                                      height: 40,
                                      borderRadius: "10px",
                                      objectFit: "cover",
                                      flexShrink: 0,
                                    }}
                                  />
                                ) : (
                                  <div
                                    className="si-avatar-badge"
                                    style={{
                                      background: avatarStyle.bg,
                                      color: avatarStyle.text,
                                    }}
                                  >
                                    {initials}
                                  </div>
                                )}
                                <div className="si-user-info">
                                  <a
                                    style={{
                                      fontWeight: 600,
                                      color: "#0f172a",
                                      textDecoration: "none",
                                      cursor: "pointer",
                                    }}
                                    onClick={() => {
                                      fbmemberList(list);
                                      setModel("view");
                                    }}
                                  >
                                    {list.name || "Student"}
                                  </a>
                                  {list.email && (
                                    <span
                                      style={{
                                        fontSize: "11.5px",
                                        color: "#64748b",
                                      }}
                                    >
                                      {list.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Contact */}
                            <td className="si-td">
                              {list.number ? (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    fontSize: "12.5px",
                                    color: "#334155",
                                  }}
                                >
                                  <Phone size={13} color="#64748b" />
                                  <span>{list.number}</span>
                                </div>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>-</span>
                              )}
                            </td>

                            {/* Assignment Document */}
                            <td className="si-td">
                              {list.file ? (
                                <a
                                  href={AWS_UPLOADS + list.file}
                                  target="_blank"
                                  rel="noreferrer"
                                  download
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    background: "#ede9fe",
                                    color: "var(--ad-brand)",
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    textDecoration: "none",
                                    transition: "all 0.15s ease",
                                  }}
                                  title="Download student submission file"
                                >
                                  <Download size={14} /> Download Document
                                </a>
                              ) : (
                                <span
                                  style={{ color: "#94a3b8", fontSize: "12px" }}
                                >
                                  No document
                                </span>
                              )}
                            </td>

                            {/* Submitted Date */}
                            <td className="si-td">
                              <div className="si-datetime-col">
                                <span className="si-date-text">
                                  {subDt.date}
                                </span>
                                {subDt.time && (
                                  <span className="si-time-text">
                                    {subDt.time}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Actioned Date */}
                            <td className="si-td">
                              {list.updatetime &&
                              String(list.status) !== "1" ? (
                                <div className="si-datetime-col">
                                  <span className="si-date-text">
                                    {actDt.date}
                                  </span>
                                  {actDt.time && (
                                    <span className="si-time-text">
                                      {actDt.time}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span
                                  style={{ color: "#94a3b8", fontSize: "12px" }}
                                >
                                  Awaiting review
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="si-td">
                              {renderStatusBadge(list.status)}
                            </td>

                            {/* Actions */}
                            <td
                              className="si-td"
                              style={{ textAlign: "center" }}
                            >
                              {loadingId === list.id ? (
                                <span
                                  style={{ fontSize: "12px", color: "#64748b" }}
                                >
                                  Processing...
                                </span>
                              ) : (
                                <div
                                  className="si-actions-cell"
                                  style={{ justifyContent: "center" }}
                                >
                                  {/* View Profile / Details */}
                                  <button
                                    type="button"
                                    className="si-action-btn btn-view"
                                    title="View Student Details"
                                    onClick={() => {
                                      fbmemberList(list);
                                      setModel("view");
                                    }}
                                  >
                                    <Eye size={15} />
                                  </button>

                                  {/* Download file */}
                                  {list.file && (
                                    <a
                                      className="si-action-btn btn-download"
                                      title="Download Submission File"
                                      href={AWS_UPLOADS + list.file}
                                      target="_blank"
                                      rel="noreferrer"
                                      download
                                    >
                                      <Download size={15} />
                                    </a>
                                  )}

                                  {/* Action Buttons for Pending */}
                                  {String(list.status) === "1" &&
                                    permCan("review") && (
                                      <>
                                        <button
                                          type="button"
                                          className="si-action-btn btn-approve"
                                          title="Approve Assignment"
                                          onClick={() => approvelist(list)}
                                        >
                                          <Check size={15} />
                                        </button>

                                        <button
                                          type="button"
                                          className="si-action-btn btn-reject"
                                          title="Reject Assignment"
                                          onClick={() => rejectlist(list)}
                                        >
                                          <X size={15} />
                                        </button>
                                      </>
                                    )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Table Footer & Pagination */}
              <div className="si-table-footer">
                <div className="si-footer-left">
                  <select className="si-limit-select" value={limit} disabled>
                    <option value="10">10</option>
                  </select>
                  <span>
                    Showing {listtotal === 0 ? 0 : (page - 1) * limit + 1} to{" "}
                    {Math.min(page * limit, listtotal)} of {listtotal} entries
                  </span>
                </div>

                <div className="si-pagination">
                  <button
                    type="button"
                    className="si-page-nav-btn"
                    disabled={page <= 1}
                    onClick={() => {
                      const prev = Math.max(1, page - 1);
                      setPage(prev);
                      loadDetails(prev, search, sort);
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Pages */}
                  {Array.from(
                    {
                      length: Math.max(
                        1,
                        lastPage || Math.ceil(listtotal / limit),
                      ),
                    },
                    (_, i) => i + 1,
                  )
                    .filter(
                      (p) =>
                        p === 1 || p === lastPage || Math.abs(p - page) <= 1,
                    )
                    .map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`si-page-btn ${page === p ? "active" : ""}`}
                        onClick={() => {
                          setPage(p);
                          loadDetails(p, search, sort);
                        }}
                      >
                        {p}
                      </button>
                    ))}

                  <button
                    type="button"
                    className="si-page-nav-btn"
                    disabled={page >= lastPage}
                    onClick={() => {
                      const next = Math.min(lastPage, page + 1);
                      setPage(next);
                      loadDetails(next, search, sort);
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="saved-ago-row">
                <SavedAgo endpoint="api/sub-assignments" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modern Student Submission Details Modal */}
      {model === "view" && (
        <div className="subm-modal-backdrop" onClick={() => setModel("")}>
          <div className="subm-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="subm-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "#ede9fe",
                    color: "var(--ad-brand)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <User size={20} />
                </div>
                <div>
                  <h4 className="subm-modal-title">
                    Student Submission Details
                  </h4>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#64748b" }}>
                    {asslists.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="subm-modal-close"
                onClick={() => setModel("")}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="subm-modal-body">
              {loading ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div className="spinner-border text-primary" role="status" />
                  <p style={{ color: "#64748b", marginTop: 12, fontSize: 14 }}>
                    Loading student details...
                  </p>
                </div>
              ) : (
                <>
                  {/* Student Profile Card */}
                  <div
                    style={{
                      background: "#f8fafc",
                      borderRadius: 14,
                      padding: "16px 18px",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <div
                      className="si-avatar-badge"
                      style={{
                        background: "#ede9fe",
                        color: "var(--ad-brand)",
                        width: 48,
                        height: 48,
                        fontSize: 16,
                      }}
                    >
                      {getInitials(form.name)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        {form.name || "Student"}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 12,
                          marginTop: 4,
                        }}
                      >
                        {form.email && (
                          <span
                            style={{
                              fontSize: 12.5,
                              color: "#64748b",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Mail size={13} /> {form.email}
                          </span>
                        )}
                        {form.number && (
                          <span
                            style={{
                              fontSize: 12.5,
                              color: "#64748b",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Phone size={13} /> {form.number}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Student Meta Details */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: "10px 14px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "#64748b",
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        Gender
                      </div>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#0f172a",
                          marginTop: 2,
                        }}
                      >
                        {form.gender || "-"}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: "10px 14px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "#64748b",
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        Qualification
                      </div>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#0f172a",
                          marginTop: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <GraduationCap size={14} color="var(--ad-brand)" />{" "}
                        {form.qualification || "-"}
                      </div>
                    </div>
                  </div>

                  {/* Enrolled Courses */}
                  {courses.length > 0 && (
                    <div
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: "12px 14px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                          fontWeight: 600,
                          marginBottom: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <BookOpen size={14} color="var(--ad-brand)" /> Enrolled Course
                        &amp; Batch
                      </div>
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                      >
                        {courses.map((c, i) => (
                          <span
                            key={i}
                            style={{
                              background: "#f1f5f9",
                              color: "#334155",
                              padding: "4px 10px",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 500,
                            }}
                          >
                            {decodeHtml(c.course_name)}{" "}
                            {c.batch_name
                              ? `• ${decodeHtml(c.batch_name)}`
                              : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assignment Document Download Card */}
                  <div
                    style={{
                      background:
                        "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                      borderRadius: 14,
                      padding: "16px 18px",
                      border: "1px solid #ddd6fe",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          background: "var(--ad-brand)",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <FileText size={20} />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#1e1b4b",
                          }}
                        >
                          Submitted Assignment Document
                        </div>
                        <div style={{ fontSize: 12, color: "#6b21a8" }}>
                          Click to open or download student's file
                        </div>
                      </div>
                    </div>

                    {form.file ? (
                      <a
                        href={AWS_UPLOADS + form.file}
                        target="_blank"
                        rel="noreferrer"
                        download
                        style={{
                          background: "var(--ad-brand)",
                          color: "#ffffff",
                          padding: "8px 16px",
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          textDecoration: "none",
                          boxShadow: "0 2px 6px rgba(var(--ad-brand-rgb), 0.25)",
                        }}
                      >
                        <Download size={14} /> Download File
                      </a>
                    ) : (
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>
                        No file attached
                      </span>
                    )}
                  </div>

                  {/* Submission Timeline & Status */}
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 14,
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12.5,
                          color: "#64748b",
                          fontWeight: 500,
                        }}
                      >
                        Current Status
                      </span>
                      {renderStatusBadge(form.status)}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12.5,
                          color: "#64748b",
                          fontWeight: 500,
                        }}
                      >
                        Submitted Date
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#1e293b",
                        }}
                      >
                        {formatDateTime(form.datetime) || "-"}
                      </span>
                    </div>

                    {form.updatetime && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12.5,
                            color: "#64748b",
                            fontWeight: 500,
                          }}
                        >
                          Reviewed Date
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#1e293b",
                          }}
                        >
                          {formatDateTime(form.updatetime)}
                        </span>
                      </div>
                    )}

                    {/* Rejection Reason if any */}
                    {form.status == "0" && form.reason && (
                      <div
                        style={{
                          background: "#fff1f2",
                          border: "1px solid #fecdd3",
                          borderRadius: 10,
                          padding: "12px 14px",
                          marginTop: 6,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#be123c",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <AlertCircle size={14} /> Rejection Reason
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#881337",
                            marginTop: 4,
                          }}
                        >
                          {form.reason}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="subm-modal-footer">
              <button
                type="button"
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "7px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#475569",
                  cursor: "pointer",
                }}
                onClick={() => setModel("")}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
