import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Head, SERVER_URL } from "../../../components/Includes";
import { getSeoByPath } from "../../../utils/seo";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  Tag,
  Plus,
  RotateCw,
  CheckCircle2,
  Ticket,
  Award,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, SkeletonRows } from "../../../components/loading";

const seo = getSeoByPath("");

type Coupon = {
  id: string;
  name?: string | null;
  percent_off?: number | null;
  amount_off?: number | null;
  currency?: string | null;
  valid: boolean;
};

type Promo = {
  id: string;
  code: string;
  coupon: Coupon;
  customer_id?: string | null;
  active: boolean;
  max_redemptions?: number | null;
  times_redeemed: number;
  expires_at?: number | null;
  created: number;
  restrictions?: { first_time_transaction?: boolean };
};

const PAGE_SIZE = 10;

export default function StripePromoCodes() {
  const permCan = usePagePerm("promotion-codes");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // ---- filters + pagination ----
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [couponFilter, setCouponFilter] = useState("all");
  const [page, setPage] = useState(1);

  const emptyPromo = {
    coupon: "",
    code: "",
    customerEmail: "",
    singleUse: false,
    maxRedemptions: "",
    expiresAt: "",
    firstTimeOnly: false,
    minimumAmount: "",
    currency: "usd",
  };
  const [pForm, setPForm] = useState(emptyPromo);

  const getSecurity = async () => {
    const res = await axios.get(SERVER_URL + "api/security/token", {
      withCredentials: true,
    });
    return res.data;
  };
  const post = async (path: string, body: any) => {
    const s = await getSecurity();
    const res = await axios.post(
      SERVER_URL + path,
      { ...body, key: s.key, token: s.token, aut: s.aut },
      { withCredentials: true },
    );
    return res.data;
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const call = (path: string) => listFetch(path, {}).then((r) => r.data);
      const [c, p] = await Promise.all([
        call("api/stripe/coupons"),
        call("api/stripe/promotion-codes"),
      ]);
      if (c.success) setCoupons(c.data || []);
      else toast.error(c.message || "Failed to load coupons");
      if (p.success) setPromos(p.data || []);
      else toast.error(p.message || "Failed to load promotion codes");
    } catch {
      toast.error("Failed to load Stripe data");
    } finally {
      setLoading(false);
    }
  };

  const initchecklogin = async () => {
    try {
      const res = await axios.get(SERVER_URL + "api/check-login", {
        withCredentials: true,
      });
      if (res.data.loggedIn && (res.data.id === "X" || res.data.id === "Y"))
        loadAll();
      else navigate("/logout");
    } catch {
      navigate("/logout");
    }
  };
  useEffect(() => {
    initchecklogin();
  }, []);

  /* ---------------- actions ---------------- */
  const createPromo = async (e: any) => {
    e.preventDefault();
    setBusy("promo");
    try {
      const body = {
        ...pForm,
        maxRedemptions: pForm.singleUse ? 1 : pForm.maxRedemptions,
      };
      const r = await post("api/stripe/promotion-code/create", body);
      if (r.success) {
        toast.success(r.message);
        setPForm(emptyPromo);
        setPromos((prev) => [r.data, ...prev]);
        setShowCreateForm(false);
      } else toast.error(r.message);
    } catch {
      toast.error("Stripe error");
    } finally {
      setBusy("");
    }
  };

  const togglePromo = async (p: Promo) => {
    setBusy("toggle-" + p.id);
    try {
      const r = await post("api/stripe/promotion-code/toggle", {
        id: p.id,
        active: !p.active,
      });
      if (r.success) {
        toast.success(r.message);
        setPromos((prev) => prev.map((x) => (x.id === p.id ? r.data : x)));
      } else toast.error(r.message);
    } catch {
      toast.error("Stripe error");
    } finally {
      setBusy("");
    }
  };

  /* ---------------- formatters ---------------- */
  const discountLabel = (c?: Coupon | null) =>
    !c
      ? "—"
      : c.percent_off != null
        ? `${c.percent_off}% off`
        : c.amount_off != null
          ? `${(c.amount_off / 100).toFixed(2)} ${(c.currency || "").toUpperCase()} off`
          : "—";

  const remaining = (times: number, max?: number | null) =>
    max == null ? "∞" : Math.max(0, max - (times || 0));
  const usageLabel = (times: number, max?: number | null) =>
    `${times || 0} used · ${remaining(times, max)} left`;
  const tsDate = (ts?: number | null) =>
    ts ? new Date(ts * 1000).toLocaleDateString("en-IN") : "—";

  /* ---------------- filter + paginate ---------------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return promos.filter((p) => {
      if (q && !`${p.code} ${p.customer_id || ""}`.toLowerCase().includes(q))
        return false;
      if (statusFilter === "active" && !p.active) return false;
      if (statusFilter === "inactive" && p.active) return false;
      if (statusFilter === "redeemed" && Number(p.times_redeemed || 0) <= 0)
        return false;
      if (couponFilter !== "all" && p.coupon?.id !== couponFilter) return false;
      return true;
    });
  }, [promos, search, statusFilter, couponFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (pageSafe - 1) * PAGE_SIZE,
    pageSafe * PAGE_SIZE,
  );
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, couponFilter]);

  const activeCount = useMemo(
    () => promos.filter((p) => p.active).length,
    [promos],
  );
  const totalRedeemed = useMemo(
    () => promos.reduce((sum, p) => sum + (p.times_redeemed || 0), 0),
    [promos],
  );

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
        .si-header-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
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
        .si-total-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #ede9fe;
          color: var(--ad-brand);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }
        .si-total-badge b {
          font-weight: 700;
        }
        .si-btn-primary {
          background: var(--ad-brand);
          border: 1.5px solid var(--ad-brand);
          color: #ffffff;
          border-radius: 10px;
          padding: 8px 18px;
          font-size: 13.5px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .si-btn-primary:hover {
          background: var(--ad-brand-2);
          border-color: var(--ad-brand-2);
          color: #ffffff;
        }
        .si-btn-outline {
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
        .si-btn-outline:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #1e293b;
        }

        /* Stats KPI Grid */
        .si-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 22px;
        }
        .si-stat-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          border: 1px solid #eef2f6;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          cursor: pointer;
          user-select: none;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .si-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.07);
        }
        .si-stat-card.purple.active {
          border-color: var(--ad-brand) !important;
          box-shadow: 0 0 0 2px rgba(var(--ad-brand-rgb), 0.25) !important;
        }
        .si-stat-card.green.active {
          border-color: #16a34a !important;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25) !important;
        }
        .si-stat-card.amber.active {
          border-color: #d97706 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.25) !important;
        }
        .si-stat-card.blue.active {
          border-color: #0284c7 !important;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25) !important;
        }
        .si-stat-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .si-stat-icon-wrapper.purple {
          background: #f5f3ff;
          color: var(--ad-brand);
        }
        .si-stat-icon-wrapper.green {
          background: #f0fdf4;
          color: #16a34a;
        }
        .si-stat-icon-wrapper.amber {
          background: #fffbeb;
          color: #d97706;
        }
        .si-stat-icon-wrapper.blue {
          background: #f0f9ff;
          color: #0284c7;
        }
        .si-stat-label {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
          display: block;
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
          gap: 12px;
          margin-bottom: 20px;
          border: 1px solid #edf2f6;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          flex-wrap: wrap;
        }
        .si-filter-select-wrapper {
          position: relative;
        }
        .si-filter-select {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 32px 8px 14px;
          font-size: 13px;
          font-weight: 500;
          color: #1e293b;
          background-color: #ffffff;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2364748b' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          appearance: none;
          cursor: pointer;
          outline: none;
          min-width: 150px;
        }
        .si-filter-select:focus {
          border-color: var(--ad-brand);
        }
        .si-search-box {
          display: flex;
          align-items: center;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 7px 12px;
          background: #ffffff;
          min-width: 260px;
          gap: 8px;
        }
        .si-search-box:focus-within {
          border-color: var(--ad-brand);
        }
        .si-search-icon {
          color: #94a3b8;
          flex-shrink: 0;
        }
        .si-search-box input {
          border: none;
          outline: none;
          font-size: 13px;
          color: #1e293b;
          width: 100%;
          background: transparent;
        }
        .si-reload-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: var(--ad-brand);
          border: none;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
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
        }
        .si-tbody .si-tr {
          border-bottom: 1px solid #f1f5f9;
          transition: background-color 0.15s ease;
        }
        .si-tbody .si-tr:hover {
          background-color: #fbfcfe;
        }
        .si-td {
          padding: 14px 16px;
          font-size: 13.5px;
          color: #1e293b;
          vertical-align: middle;
        }
        .si-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }
        .si-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
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
        .si-action-btn.view {
          background: #ede9fe;
          color: var(--ad-brand);
        }
        .si-action-btn.view:hover {
          background: #ddd6fe;
        }
        .si-action-btn.delete {
          background: #fee2e2;
          color: #dc2626;
        }
        .si-action-btn.delete:hover {
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
        .si-table-info {
          font-size: 13px;
          color: #64748b;
        }
        .si-pagination {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .si-page-nav-btn {
          height: 32px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 13px;
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
          font-weight: 700;
        }
      `}</style>

      {/* Main Content */}
      <div className="content">
        <div className="container-fluid p-4 si-page-wrapper">
          {/* Header */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <Tag size={24} />
              </div>
              <div>
                <div className="si-header-title-row">
                  <h3 className="si-header-title">Stripe Promotion Codes</h3>
                  <span className="si-total-badge">
                    Total <b>{promos.length}</b>
                  </span>
                </div>
                <p className="si-header-subtitle">
                  Customer-facing promotional discount codes powered by
                  underlying Stripe coupons.
                </p>
              </div>
            </div>
            <div className="si-header-right">
              {permCan("create") && (
                <button
                  className="si-btn-primary"
                  onClick={() => setShowCreateForm(!showCreateForm)}
                >
                  <Plus size={16} />
                  {showCreateForm ? "Close Form" : "Create Promo Code"}
                </button>
              )}
            </div>
          </div>

          {/* Stats KPI Grid */}
          <div className="si-stats-grid">
            <div
              className={`si-stat-card purple ${statusFilter === "all" && couponFilter === "all" ? "active" : ""}`}
              onClick={() => {
                setStatusFilter("all");
                setCouponFilter("all");
                setPage(1);
              }}
              title="Show all promo codes"
              role="button"
              tabIndex={0}
            >
              <div className="si-stat-icon-wrapper purple">
                <Tag size={20} />
              </div>
              <div className="si-stat-content">
                <span className="si-stat-label">Total Promo Codes</span>
                <h4 className="si-stat-value"><AnimatedNumber value={promos.length} pending={loading} id="StripePromoCodes-s1" /></h4>
              </div>
            </div>

            <div
              className={`si-stat-card green ${statusFilter === "active" ? "active" : ""}`}
              onClick={() => {
                setStatusFilter((prev) =>
                  prev === "active" ? "all" : "active",
                );
                setCouponFilter("all");
                setPage(1);
              }}
              title={
                statusFilter === "active"
                  ? "Click to show all promo codes"
                  : "Filter active codes"
              }
              role="button"
              tabIndex={0}
            >
              <div className="si-stat-icon-wrapper green">
                <CheckCircle2 size={20} />
              </div>
              <div className="si-stat-content">
                <span className="si-stat-label">Active Codes</span>
                <h4 className="si-stat-value"><AnimatedNumber value={activeCount} pending={loading} id="StripePromoCodes-s2" /></h4>
              </div>
            </div>

            <div
              className={`si-stat-card amber ${couponFilter !== "all" ? "active" : ""}`}
              onClick={() => {
                setStatusFilter("all");
                setCouponFilter("all");
                setPage(1);
              }}
              title="Show all promo codes with linked coupons"
              role="button"
              tabIndex={0}
            >
              <div className="si-stat-icon-wrapper amber">
                <Ticket size={20} />
              </div>
              <div className="si-stat-content">
                <span className="si-stat-label">Linked Coupons</span>
                <h4 className="si-stat-value"><AnimatedNumber value={coupons.length} pending={loading} id="StripePromoCodes-s3" /></h4>
              </div>
            </div>

            <div
              className={`si-stat-card blue ${statusFilter === "redeemed" ? "active" : ""}`}
              onClick={() => {
                setStatusFilter((prev) =>
                  prev === "redeemed" ? "all" : "redeemed",
                );
                setCouponFilter("all");
                setPage(1);
              }}
              title={
                statusFilter === "redeemed"
                  ? "Click to show all promo codes"
                  : "Filter promo codes with redemptions"
              }
              role="button"
              tabIndex={0}
            >
              <div className="si-stat-icon-wrapper blue">
                <Award size={20} />
              </div>
              <div className="si-stat-content">
                <span className="si-stat-label">Total Redemptions</span>
                <h4 className="si-stat-value"><AnimatedNumber value={totalRedeemed} pending={loading} id="StripePromoCodes-s4" /></h4>
              </div>
            </div>
          </div>

          {/* Create Promo Code Form Card (Collapsible) */}
          {showCreateForm && permCan("create") && (
            <div
              className="card shadow-sm border-0 mb-4"
              style={{ borderRadius: "16px", overflow: "hidden" }}
            >
              <div
                style={{
                  background:
                    "linear-gradient(135deg, var(--ad-brand) 0%, var(--ad-brand-2) 100%)",
                  padding: "16px 22px",
                  color: "#fff",
                }}
              >
                <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                  <Plus size={18} /> Create New Stripe Promotion Code
                </h5>
              </div>
              <div className="p-4" style={{ background: "#ffffff" }}>
                <form onSubmit={createPromo}>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label
                        className="form-label fw-semibold"
                        style={{ fontSize: "13px" }}
                      >
                        Coupon *
                      </label>
                      <select
                        className="form-select"
                        required
                        value={pForm.coupon}
                        onChange={(e) =>
                          setPForm({ ...pForm, coupon: e.target.value })
                        }
                      >
                        <option value="">— Select coupon —</option>
                        {coupons.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name ? `${c.name} (${c.id})` : c.id} —{" "}
                            {discountLabel(c)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-4">
                      <label
                        className="form-label fw-semibold"
                        style={{ fontSize: "13px" }}
                      >
                        Promo Code *
                      </label>
                      <input
                        className="form-control"
                        required
                        placeholder="e.g. VIP50 or SAVE20"
                        value={pForm.code}
                        onChange={(e) =>
                          setPForm({
                            ...pForm,
                            code: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>

                    <div className="col-md-4">
                      <label
                        className="form-label fw-semibold"
                        style={{ fontSize: "13px" }}
                      >
                        Specific Customer Email (Optional)
                      </label>
                      <input
                        className="form-control"
                        type="email"
                        placeholder="Restricts to this email"
                        value={pForm.customerEmail}
                        onChange={(e) =>
                          setPForm({ ...pForm, customerEmail: e.target.value })
                        }
                      />
                    </div>

                    <div className="col-md-3">
                      <label
                        className="form-label fw-semibold"
                        style={{ fontSize: "13px" }}
                      >
                        Max Redemptions
                      </label>
                      <input
                        className="form-control"
                        type="number"
                        min="1"
                        placeholder="unlimited"
                        disabled={pForm.singleUse}
                        value={pForm.singleUse ? 1 : pForm.maxRedemptions}
                        onChange={(e) =>
                          setPForm({ ...pForm, maxRedemptions: e.target.value })
                        }
                      />
                    </div>

                    <div className="col-md-3">
                      <label
                        className="form-label fw-semibold"
                        style={{ fontSize: "13px" }}
                      >
                        Expiration Date
                      </label>
                      <input
                        className="form-control"
                        type="date"
                        value={pForm.expiresAt}
                        onChange={(e) =>
                          setPForm({ ...pForm, expiresAt: e.target.value })
                        }
                      />
                    </div>

                    <div className="col-md-3">
                      <label
                        className="form-label fw-semibold"
                        style={{ fontSize: "13px" }}
                      >
                        Minimum Order Amount (Optional)
                      </label>
                      <input
                        className="form-control"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 50.00"
                        value={pForm.minimumAmount}
                        onChange={(e) =>
                          setPForm({ ...pForm, minimumAmount: e.target.value })
                        }
                      />
                    </div>

                    <div className="col-md-3">
                      <label
                        className="form-label fw-semibold"
                        style={{ fontSize: "13px" }}
                      >
                        Currency
                      </label>
                      <select
                        className="form-select"
                        value={pForm.currency}
                        onChange={(e) =>
                          setPForm({ ...pForm, currency: e.target.value })
                        }
                      >
                        <option value="usd">USD</option>
                        <option value="inr">INR</option>
                        <option value="eur">EUR</option>
                        <option value="gbp">GBP</option>
                      </select>
                    </div>

                    <div className="col-12 mt-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <div className="d-flex align-items-center gap-4 flex-wrap">
                        <label
                          className="d-flex align-items-center gap-2 mb-0"
                          style={{ fontSize: "13px" }}
                        >
                          <input
                            type="checkbox"
                            className="form-check-input mt-0"
                            checked={pForm.singleUse}
                            onChange={(e) =>
                              setPForm({
                                ...pForm,
                                singleUse: e.target.checked,
                              })
                            }
                          />
                          Single-use (max 1 total redemption)
                        </label>

                        <label
                          className="d-flex align-items-center gap-2 mb-0"
                          style={{ fontSize: "13px" }}
                        >
                          <input
                            type="checkbox"
                            className="form-check-input mt-0"
                            checked={pForm.firstTimeOnly}
                            onChange={(e) =>
                              setPForm({
                                ...pForm,
                                firstTimeOnly: e.target.checked,
                              })
                            }
                          />
                          First-time transaction only
                        </label>
                      </div>

                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => setShowCreateForm(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="si-btn-primary"
                          disabled={busy === "promo"}
                        >
                          {busy === "promo" ? <ButtonLoader label="Creating…" /> : "Create Code"}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="si-filter-bar">
            <div className="si-filter-select-wrapper">
              <select
                className="si-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Codes</option>
                <option value="inactive">Inactive Codes</option>
                <option value="redeemed">Has Redemptions</option>
              </select>
            </div>

            <div className="si-filter-select-wrapper">
              <select
                className="si-filter-select"
                value={couponFilter}
                onChange={(e) => setCouponFilter(e.target.value)}
              >
                <option value="all">All Coupons</option>
                {coupons.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.id}
                  </option>
                ))}
              </select>
            </div>

            <ListSearch
              placeholder="Search promo code or customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="ms-auto d-flex align-items-center gap-2">
              <button data-refresh
                className="reload-btn"
                title="Refresh"
                onClick={loadAll}
                disabled={loading}
              >
                <RotateCw size={15} />
              </button>
            </div>
          </div>

          {/* Table Card */}
          <div className="si-table-card">
            <div className="si-table-responsive">
              <table className="si-table">
                <thead className="si-thead">
                  <tr>
                    <th className="si-th">Promo Code</th>
                    <th className="si-th">Coupon</th>
                    <th className="si-th">Discount</th>
                    <th className="si-th">Customer / Restriction</th>
                    <th className="si-th">Usage (Left)</th>
                    <th className="si-th">Expires</th>
                    <th className="si-th">Status</th>
                    <th className="si-th text-end" style={{ width: 130 }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="si-tbody">
                  {loading ? (
                    <SkeletonRows />
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-5 text-muted">
                        No promotion codes found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((p) => (
                      <tr key={p.id} className="si-tr">
                        <td className="si-td">
                          <code
                            style={{
                              background: "#f1f5f9",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontWeight: 700,
                              color: "var(--ad-brand)",
                              fontSize: "13px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            {p.code}
                          </code>
                        </td>
                        <td
                          className="si-td fw-semibold text-dark"
                          style={{ fontSize: "13px" }}
                        >
                          {p.coupon?.name || p.coupon?.id || "—"}
                        </td>
                        <td className="si-td">
                          <span
                            className="si-status-pill"
                            style={{
                              background: "#ede9fe",
                              color: "var(--ad-brand)",
                              fontWeight: 700,
                            }}
                          >
                            {discountLabel(p.coupon)}
                          </span>
                        </td>
                        <td className="si-td" style={{ fontSize: "12.5px" }}>
                          {p.customer_id ? (
                            <code
                              style={{ fontSize: "11.5px", color: "#475569" }}
                            >
                              {p.customer_id}
                            </code>
                          ) : p.restrictions?.first_time_transaction ? (
                            <span className="badge bg-light text-dark border">
                              First order only
                            </span>
                          ) : (
                            <span className="text-muted">Anyone</span>
                          )}
                        </td>
                        <td
                          className="si-td"
                          style={{ fontSize: "13px", fontWeight: 500 }}
                        >
                          {usageLabel(p.times_redeemed, p.max_redemptions)}
                        </td>
                        <td
                          className="si-td text-muted"
                          style={{ fontSize: "12.5px" }}
                        >
                          {tsDate(p.expires_at)}
                        </td>
                        <td className="si-td">
                          <span
                            className="si-status-pill"
                            style={{
                              background: p.active ? "#dcfce7" : "#fee2e2",
                              color: p.active ? "#166534" : "#991b1b",
                            }}
                          >
                            <span
                              className="si-status-dot"
                              style={{
                                background: p.active ? "#16a34a" : "#dc2626",
                              }}
                            />
                            {p.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="si-td text-end">
                          {permCan("edit") && (
                            <button
                              className={`btn btn-sm ${p.active ? "btn-outline-danger" : "btn-outline-success"}`}
                              style={{
                                borderRadius: "8px",
                                fontSize: "12px",
                                fontWeight: 600,
                                padding: "3px 10px",
                              }}
                              disabled={busy === "toggle-" + p.id}
                              onClick={() => togglePromo(p)}
                            >
                              {p.active ? "Disable" : "Enable"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filtered.length > 0 && totalPages > 1 && (
              <div className="si-table-footer">
                <div className="si-table-info">
                  Showing {(pageSafe - 1) * PAGE_SIZE + 1} to{" "}
                  {Math.min(pageSafe * PAGE_SIZE, filtered.length)} of{" "}
                  {filtered.length} codes
                </div>
                <div className="si-pagination">
                  <button
                    className="si-page-nav-btn"
                    disabled={pageSafe <= 1}
                    onClick={() => setPage(pageSafe - 1)}
                  >
                    « Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - pageSafe) <= 2,
                    )
                    .map((p, idx, arr) => (
                      <span key={p} className="d-flex align-items-center">
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="px-1 text-muted">…</span>
                        )}
                        <button
                          className={`si-page-btn ${p === pageSafe ? "active" : ""}`}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </button>
                      </span>
                    ))}
                  <button
                    className="si-page-nav-btn"
                    disabled={pageSafe >= totalPages}
                    onClick={() => setPage(pageSafe + 1)}
                  >
                    Next »
                  </button>
                </div>
              </div>
            )}
            <div className="saved-ago-row">
              <SavedAgo endpoint="api/stripe/promotion-codes" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
