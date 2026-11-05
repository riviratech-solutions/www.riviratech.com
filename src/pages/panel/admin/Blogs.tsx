import { Head, SERVER_URL, AWS_UPLOADS } from "../../../components/Includes";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useEffect, useState, useRef } from "react";
import { getSeoByPath } from "../../../utils/seo";

import Blogimgs from "../admin/Blogimgs";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import MonacoEditor from "@monaco-editor/react";
import { components } from "../../../components/library";
import { usePagePerm } from "../../../utils/adminPermissions";
import {
  BookOpen,
  Plus,
  Search,
  RotateCw,
  Sparkles,
  CheckCircle2,
  Clock,
  Edit2,
  AlertCircle,
  ArrowUpDown,
  Image as ImageIcon,
  Tags,
  ExternalLink,
  ArrowLeft,
  Save,
  Code2,
  Eye,
  Layers,
  Upload,
  Monitor,
  Smartphone,
  Tablet,
  Palette,
  Trash2,
} from "lucide-react";
import { listFetch } from "../../../utils/listCache";
import SavedAgo from "../../../components/SavedAgo";
import ListSearch from "../../../components/ListSearch";
import { AnimatedNumber, ButtonLoader, InlineLoader, SkeletonTable } from "../../../components/loading";

const seo = getSeoByPath("");

const SI_BLOG_STYLES = `
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
        background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
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
        background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
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
      .si-btn-secondary {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: #ffffff;
        color: #334155 !important;
        border: 1px solid #cbd5e1;
        font-size: 13px;
        font-weight: 600;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-decoration: none;
      }
      .si-btn-secondary:hover {
        background: #f8fafc;
        border-color: #94a3b8;
        color: #0f172a !important;
      }
      .si-btn-danger {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: #fee2e2;
        color: #dc2626 !important;
        border: 1px solid #fecaca;
        font-size: 13px;
        font-weight: 600;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-decoration: none;
      }
      .si-btn-danger:hover {
        background: #fecaca;
        border-color: #f87171;
        color: #b91c1c !important;
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
        box-shadow: 0 0 0 2px #0ea5e9, 0 6px 16px rgba(14, 165, 233, 0.15);
        border-color: #0ea5e9;
      }
      .si-stat-card.card-active.active {
        box-shadow: 0 0 0 2px #10b981, 0 6px 16px rgba(16, 185, 129, 0.15);
        border-color: #10b981;
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
        color: #0369a1;
        border-color: #bae6fd;
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
      .si-article-cell {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .si-article-thumb {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #e0f2fe;
        color: #0284c7;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        overflow: hidden;
      }
      .si-article-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .si-article-title {
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 2px;
        display: block;
        font-size: 14px;
      }
      .si-slug-link {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        color: var(--ad-brand);
        text-decoration: none;
        font-weight: 500;
      }
      .si-slug-link:hover {
        text-decoration: underline;
        color: var(--ad-brand);
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
      .si-action-btn.btn-edit:hover {
        background: #e0f2fe;
        color: #0284c7;
        border-color: #bae6fd;
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
        color: #ef4444;
        border-color: #fca5a5;
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

      /* Form Header & Back Button */
      .si-btn-back {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: #ffffff;
        color: #475569;
        border: 1px solid #cbd5e1;
        font-size: 13px;
        font-weight: 600;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-decoration: none;
      }
      .si-btn-back:hover {
        background: #f8fafc;
        color: #0f172a;
        border-color: #94a3b8;
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
        flex-wrap: wrap;
        gap: 12px;
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
        justify-content: space-between;
        gap: 4px;
      }
      .si-label .req {
        color: #ef4444;
      }
      .si-input, .si-select, .si-textarea {
        width: 100%;
        padding: 10px 14px;
        font-size: 13.5px;
        border-radius: 10px;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        color: #0f172a;
        outline: none;
        transition: all 0.2s ease;
      }
      .si-input:focus, .si-select:focus, .si-textarea:focus {
        background: #ffffff;
        border-color: #0ea5e9;
        box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
      }
      .si-input-group {
        display: flex;
        align-items: stretch;
        width: 100%;
      }
      .si-input-prefix {
        display: inline-flex;
        align-items: center;
        padding: 0 12px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-right: none;
        border-radius: 10px 0 0 10px;
        font-size: 12.5px;
        color: #64748b;
        font-weight: 500;
        user-select: none;
      }
      .si-input-grouped {
        border-radius: 0 10px 10px 0 !important;
      }

      /* Thumbnail Dropzone */
      .si-thumb-dropzone {
        border: 2px dashed #cbd5e1;
        background: #f8fafc;
        border-radius: 14px;
        padding: 24px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      }
      .si-thumb-dropzone:hover {
        border-color: #0ea5e9;
        background: #f0f9ff;
      }
      .si-thumb-preview-box {
        position: relative;
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
        background: #0f172a;
        max-width: 380px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      }
      .si-thumb-preview-img {
        width: 100%;
        height: 180px;
        object-fit: cover;
        display: block;
      }
      .si-thumb-overlay {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        gap: 6px;
      }
      .si-btn-remove {
        width: 30px;
        height: 30px;
        border-radius: 8px;
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
      }

      /* Code Workspace */
      .si-workspace-container {
        display: flex;
        gap: 20px;
        min-height: 580px;
        background: #ffffff;
        border-radius: 14px;
      }
      @media (max-width: 992px) {
        .si-workspace-container {
          flex-direction: column;
        }
      }
      .si-components-sidebar {
        width: 300px;
        flex-shrink: 0;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .si-cat-row { display: flex; align-items: stretch; gap: 8px; }
      .si-cat-row .si-select { flex: 1; min-width: 0; }
      .si-cat-reload {
        flex-shrink: 0; width: 38px; border-radius: 10px;
        border: 1px solid #e2e8f0; background: #f8fafc; color: #64748b;
        display: inline-flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.15s ease;
      }
      .si-cat-reload:hover:not(:disabled) { background: #e0f2fe; color: #0284c7; border-color: #bae6fd; }
      .si-cat-reload:disabled { cursor: wait; opacity: 0.7; }
      .si-spin { animation: si-spin 0.8s linear infinite; }
      @keyframes si-spin { to { transform: rotate(360deg); } }
      .si-comp-category-pills {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        margin-bottom: 4px;
      }
      .si-comp-category-pill {
        font-size: 11px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 6px;
        background: #e2e8f0;
        color: #475569;
        cursor: pointer;
        border: none;
        transition: all 0.15s ease;
      }
      .si-comp-category-pill:hover {
        background: #cbd5e1;
        color: #1e293b;
      }
      .si-comp-category-pill.active {
        background: var(--ad-brand);
        color: #ffffff;
      }
      .si-components-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        overflow-y: auto;
        max-height: 520px;
        padding-right: 4px;
      }
      .si-comp-item-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 10px 12px;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .si-comp-item-card:hover {
        border-color: var(--ad-brand);
        background: #faf5ff;
        transform: translateX(2px);
      }
      .si-comp-item-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }
      .si-comp-item-name {
        font-size: 12.5px;
        font-weight: 700;
        color: #1e293b;
      }
      .si-comp-item-badge {
        font-size: 10.5px;
        color: var(--ad-brand);
        font-weight: 700;
        background: #f3e8ff;
        padding: 2px 6px;
        border-radius: 6px;
        flex-shrink: 0;
      }
      .si-comp-item-desc {
        font-size: 11px;
        color: #64748b;
        line-height: 1.35;
      }
      .si-editor-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 0;
      }
      .si-monaco-box {
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        overflow: hidden;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      }
      .si-monaco-header {
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        padding: 10px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .si-monaco-title {
        font-size: 12.5px;
        font-weight: 700;
        color: #334155;
        display: flex;
        align-items: center;
        gap: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Live Preview Simulator */
      .si-preview-simulator {
        background: #f1f5f9;
        border-radius: 16px;
        border: 1px solid #cbd5e1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 650px;
      }
      .si-preview-topbar {
        background: #ffffff;
        border-bottom: 1px solid #e2e8f0;
        padding: 12px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .si-preview-url-bar {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 6px 14px;
        font-size: 12.5px;
        color: #64748b;
        font-family: monospace;
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        max-width: 480px;
      }
      .si-device-pills {
        display: inline-flex;
        background: #f1f5f9;
        border-radius: 8px;
        padding: 3px;
        gap: 3px;
      }
      .si-device-pill {
        border: none;
        background: transparent;
        padding: 5px 10px;
        border-radius: 6px;
        color: #64748b;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: all 0.15s;
      }
      .si-device-pill.active {
        background: #ffffff;
        color: #0ea5e9;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      }
      .si-preview-viewport-wrap {
        flex: 1;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 20px;
        background: #e2e8f0;
        overflow: auto;
      }
      .si-preview-frame-container {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.12);
        overflow: hidden;
        transition: width 0.3s ease;
        height: 680px;
      }
`;

export default function Dashboard() {
  const permCan = usePagePerm("blogs");

  const getSecurity = async () => {
    const res = await axios.get(
      SERVER_URL + "api/security/token",
      {
        withCredentials: true, // 🔥 REQUIRED
      }
    );

    return res.data;
  };

  function decodeHtml(str: any) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [mode, setMode] = useState("board");
  const [model, setModel] = useState("view");

  const initialForm = {
    id: "",
    req_id: "",
    title: "",
    html: "",
    css: "",
    thumbnail: "",
    datetime: "",
    status: "",
    category_id: "",
    slug: "",
  };

  const [form, setForm] = useState(initialForm);

  /* ---------- Blog categories (for the form dropdown) ---------- */
  const [categories, setCategories] = useState<any[]>([]);
  const [catReloading, setCatReloading] = useState(false);

  // fresh: skip the saved copy — e.g. after adding a category in the
  // "Manage Categories" tab (that tab's change doesn't clear this tab's copy)
  const loadCategories = async (fresh = false) => {
    try {
      const res = await listFetch("api/blog-categories", { q: "", s: "A-Z", n: 1, all: "1" }, { fresh });
      if (res.data.success) {
        setCategories(res.data.data || []);
      }
      return !!res.data.success;
    } catch {
      // non-fatal — form still works without categories
      return false;
    }
  };

  const reloadCategories = async () => {
    if (catReloading) return;
    setCatReloading(true);
    const ok = await loadCategories(true);
    setCatReloading(false);
    if (ok) toast.success("Categories reloaded");
    else toast.error("Could not reload the categories");
  };

  /* ---------- In-form image picker popup (copy uploaded blog-image URLs) ---------- */
  const [imgPop, setImgPop] = useState(false);
  const [imgPopLoading, setImgPopLoading] = useState(false);
  const [imgPopList, setImgPopList] = useState<any[]>([]);
  const [imgPopPage, setImgPopPage] = useState(1);
  const [imgPopLastPage, setImgPopLastPage] = useState(0);
  const [imgPopTotal, setImgPopTotal] = useState(0);

  // s: "New" → the endpoint orders id DESC (newest first). n = page (12 / page).
  const openImgPop = async (page = 1) => {
    setImgPop(true);
    setImgPopLoading(true);
    try {
      const res = await listFetch("api/blogimgs", { q: "", s: "New", n: page });
      if (res.data.success) {
        setImgPopList(res.data.data || []);
        setImgPopTotal(res.data.total || 0);
        setImgPopLastPage(res.data.lastPage || 0);
        setImgPopPage(page);
      } else {
        setImgPopList([]);
      }
    } catch (err) {
      setImgPopList([]);
    } finally {
      setImgPopLoading(false);
    }
  };

  const copyImgUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    toast.success("Image URL copied");
  };

  function timestampToDateTime(ts: any) {
    if (!ts) return "";
    const date = new Date(ts * 1000);

    return date
      .toLocaleString("sv-SE") // gives YYYY-MM-DD HH:MM
      .replace(" ", "T")
      .slice(0, 16);
  }

  const limit = 10;
  const [alllists, setAllLists] = useState<any[]>([]);
  const [listtotal, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("New");
  const [lastPage, setLastPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const loadDetails = async (page = 1, search = "", sort = "") => {

    setLoading(true);
    setAllLists([]);
    setPage(page);
    setSearch(search);
    setSort(sort);

    try {
      const res = await listFetch("api/blogs", {
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
    }

  };

  const addList = async (e: any) => {

    e.preventDefault(); // ❌ Stop page reload

    setSuccess("");
    setError("");

    if (!form.title.trim()) {
      setError("❌ Please enter blog title");
      return;
    }

    try {
      setLoading(true);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/add-blog",
        {
          ...form,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        {
          withCredentials: true
        }
      );
      if (res.data.success) {
        setSuccess(res.data.message);
        toast.success(res.data.message);
        setAllLists(prev => [res.data.data, ...prev]);
        setTotal(listtotal + 1);
        setForm(initialForm);
        setPreview("");
        setThumbPreview("");
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

    e.preventDefault(); // ❌ Stop page reload

    setSuccess("");
    setError("");

    if (!form.title.trim()) {
      setError("❌ Please enter blog title");
      return;
    }

    try {
      setLoading(true);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/update-blog",
        {
          ...form,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        {
          withCredentials: true
        }
      );
      if (res.data.success) {
        setSuccess(res.data.message);
        toast.success(res.data.message);
        setAllLists((prev) =>
          prev.map((b) =>
            b.req_id === res.data.data.req_id
              ? { ...b, ...form }
              : b
          )
        );

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
      "Are you sure you want to disable '" + list.title + "' blog?"
    );

    if (!confirm) return; // ❌ Cancel clicked

    try {
      setLoadingId(list.req_id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/disable-blog",
        {
          id: list.req_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists(prev =>
          prev.map(b =>
            b.req_id === list.req_id ? { ...b, status: "1S" } : b
          )
        );
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
      "Are you sure you want to enable '" + list.title + "' blog?"
    );

    if (!confirm) return; // ❌ Cancel clicked

    try {
      setLoadingId(list.req_id);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/enable-blog",
        {
          id: list.req_id,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        toast.success(res.data.message);
        setAllLists(prev =>
          prev.map(b =>
            b.req_id === list.req_id ? { ...b, status: "1" } : b
          )
        );
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

    const targetTitle = list.title || form.title || "this blog";
    const targetId = list.req_id || list.id || form.req_id || form.id;

    if (!targetId) {
      toast.error("Invalid blog ID");
      return;
    }

    const confirm = window.confirm(
      `Are you sure you want to permanently delete '${targetTitle}'? This action cannot be undone.`
    );

    if (!confirm) return;

    try {
      setLoadingId(targetId);

      const security = await getSecurity();
      const res = await axios.post(
        SERVER_URL + "api/delete-blog",
        {
          id: targetId,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        toast.success(res.data.message || "Blog successfully deleted");
        setAllLists((prev) => prev.filter((b) => b.req_id !== targetId && b.id !== targetId));
        setTotal((prev) => Math.max(0, prev - 1));
        if (mode === "update" && (form.req_id === targetId || form.id === targetId)) {
          moveto("board");
        }
      } else {
        toast.error(res.data.message || "Failed to delete blog");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "❌ Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  const navigate = useNavigate();

  const moveto = async (id: any) => {
    setSuccess("");
    setError("");
    setMode(id);

    if (id === "add") {
      setModel("view");
      setForm(initialForm);
      setThumbPreview("");
    }

  };

  const toSlug = (val: string) =>
    val.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const updateto = async (list: any) => {
    setForm({
      id: list.id,
      req_id: list.req_id,
      title: list.title,
      html: list.html,
      css: list.css,
      thumbnail: list.thumbnail || "",
      datetime: list.datetime,
      status: list.status,
      category_id: list.category_id || "",
      slug: list.slug || "",
    });
    setThumbPreview("");
    setMode("update");
    setModel("view");
  };

  /* ---------- Thumbnail upload (S3 presigned → temp, moved to blogs/ on save) ---------- */
  const [thumbUploading, setThumbUploading] = useState(false);
  const [thumbPreview, setThumbPreview] = useState("");

  const handleThumbnail = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setThumbPreview(URL.createObjectURL(file));
    setThumbUploading(true);

    try {
      const security = await getSecurity();

      const up = await axios.post(
        SERVER_URL + "api/get-upload-url",
        {
          fileName: file.name,
          fileType: file.type,
          key: security.key,
          token: security.token,
          aut: security.aut,
        },
        { withCredentials: true }
      );

      if (!up.data.success) {
        toast.error(up.data.message || "Thumbnail upload failed");
        setThumbUploading(false);
        return;
      }

      // Direct PUT to S3 (temp folder). The server moves it into blogs/ on save.
      await axios.put(up.data.uploadURL, file, {
        headers: { "Content-Type": file.type },
      });

      setForm((f) => ({ ...f, thumbnail: up.data.key }));
      setThumbPreview(up.data.fileURL);
      toast.success("Thumbnail uploaded");
    } catch (err) {
      toast.error("Thumbnail upload failed");
    } finally {
      setThumbUploading(false);
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
    const ustatus = data.id;
    if (loggedIn && (ustatus == "X" || ustatus == "Y")) {
      await loadDetails();
      await loadCategories();
    } else {
      navigate("/logout");
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

  const [preview, setPreview] = useState("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const editorRef = useRef<any>(null);
  const [compCategory, setCompCategory] = useState("All");
  const [compSearch, setCompSearch] = useState("");

  const addComponent = (c: any) => {
    const editor = editorRef.current;

    if (editor) {
      const selection = editor.getSelection();
      editor.executeEdits("", [
        {
          range: selection,
          text: c.html,
          forceMoveMarkers: true,
        },
      ]);
      editor.focus();
    } else {
      setForm((f) => ({
        ...f,
        html: f.html ? f.html + "\n" + c.html : c.html,
      }));
    }

    if (c.css && c.css.trim()) {
      setForm((f) => {
        if (!f.css.includes(c.css.trim())) {
          return { ...f, css: f.css ? f.css + "\n\n" + c.css.trim() : c.css.trim() };
        }
        return f;
      });
    }

    toast.info(`Inserted "${c.name}"`, { autoClose: 1500 });
  };

  const updatePreview = () => {

    setPreview(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 32px 24px;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.6;
    }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    ${form.css}
  </style>
</head>
<body>
  <div class="max-w-4xl mx-auto">
    ${form.title ? `<h1 class="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6">${form.title}</h1>` : ""}
    <div class="tailwind blog-content">
      ${form.html.replaceAll("AWSPATH/", AWS_UPLOADS)}
    </div>
  </div>
</body>
</html>`);

    setModel("preview");

  };

  const totalCount = listtotal || alllists.length;
  const activeCount = alllists.filter((b) => b.status === "1").length;
  const disabledCount = alllists.filter((b) => b.status === "1S" || b.status === "0").length;
  const recentCount = alllists.filter((b) => {
    const ts = Number(b.datetime);
    if (!ts) return false;
    const num = ts < 10000000000 ? ts * 1000 : ts;
    return num >= Date.now() - 30 * 24 * 60 * 60 * 1000;
  }).length;

  const displayedLists = alllists.filter((item) => {
    if (statusFilter === "1" && item.status !== "1") return false;
    if (statusFilter === "1S" && item.status !== "1S" && item.status !== "0") return false;
    return true;
  });

  void BlogCard;
  void Icon;

  return (<>

    <Head
      pageTitle={seo.title}
      pageDesc={seo.description}
      pageKeywords={seo.keywords}
    />

    <ToastContainer position="top-right" autoClose={2500} />
    <style>{SI_BLOG_STYLES}</style>

    {/* Main Content */}
    <div className="content">

      {model == "images" ? (
        <div>

          <div className="container-fluid p-4 trainers-page">
            <h3 className="fw-bold pagehead">
              <span className="totalcount">
                <a onClick={() => setModel("view")} className="add btn btn-success">Back</a>
              </span>

            </h3>
          </div>

          <Blogimgs />
        </div>

      ) : (
        <span>

          {mode === "board" && (

        <div className="si-page-wrapper">
          


          {/* Header Card */}
          <div className="si-header-container">
            <div className="si-header-left">
              <div className="si-header-icon-box">
                <BookOpen size={24} />
              </div>
              <div>
                <h3 className="si-header-title">
                  Blogs & Articles
                  <span className="si-count-badge">
                    {totalCount} Total
                  </span>
                </h3>
                <p className="si-header-subtitle">
                  Manage all articles, news updates and knowledge base blogs
                </p>
              </div>
            </div>

            <div className="si-header-actions">
              <button
                type="button"
                onClick={() => setModel("images")}
                className="si-btn-secondary"
              >
                <ImageIcon size={15} />
                <span>Blog Images</span>
              </button>

              {permCan("blog-categories:view") && (
                <Link to="/panel/blog-categories" className="si-btn-secondary">
                  <Tags size={15} />
                  <span>Blog Categories</span>
                </Link>
              )}

              {permCan("create") && (
                <button
                  type="button"
                  onClick={() => moveto("add")}
                  className="si-btn-primary"
                >
                  <Plus size={16} />
                  <span>Add New Blog</span>
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
                <div className="si-stat-label">Total Blogs</div>
                <div className="si-stat-value"><AnimatedNumber value={totalCount} pending={loading} id="Blogs-s1" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-purple">
                <BookOpen size={22} />
              </div>
            </div>

            <div
              className={`si-stat-card card-active ${statusFilter === "1" ? "active" : ""}`}
              onClick={() => setStatusFilter("1")}
            >
              <div>
                <div className="si-stat-label">Active Articles</div>
                <div className="si-stat-value"><AnimatedNumber value={activeCount} pending={loading} id="Blogs-s2" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-green">
                <Sparkles size={22} />
              </div>
            </div>

            <div
              className={`si-stat-card card-disabled ${statusFilter === "1S" ? "active" : ""}`}
              onClick={() => setStatusFilter("1S")}
            >
              <div>
                <div className="si-stat-label">Inactive</div>
                <div className="si-stat-value"><AnimatedNumber value={disabledCount} pending={loading} id="Blogs-s3" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-amber">
                <AlertCircle size={22} />
              </div>
            </div>

            <div
              className="si-stat-card"
              onClick={() => setStatusFilter("ALL")}
            >
              <div>
                <div className="si-stat-label">Recent (30d)</div>
                <div className="si-stat-value"><AnimatedNumber value={recentCount} pending={loading} id="Blogs-s4" /></div>
              </div>
              <div className="si-stat-icon-wrap si-stat-blue">
                <Clock size={22} />
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
                <span className="si-select-label">Status:</span>
                <select
                  className="si-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Status</option>
                  <option value="1">Active Only</option>
                  <option value="1S">Inactive Only</option>
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
                placeholder="Search blogs..."
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
              <SkeletonTable cols={5} />
            ) : displayedLists.length === 0 ? (
              <div className="si-empty-box">
                <div className="si-empty-icon">
                  <BookOpen size={28} />
                </div>
                <div className="si-empty-title">
                  {search ? "No matching blogs found" : "No blogs available"}
                </div>
                <p className="si-empty-desc">
                  {search
                    ? "Try adjusting your search criteria."
                    : "No blogs recorded yet. Click 'Add New Blog' to publish one."}
                </p>
                <button
                  className="si-btn-primary"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
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
                      <th style={{ width: "42%" }}>Article</th>
                      <th style={{ width: "24%" }}>URL Slug</th>
                      <th style={{ width: "16%" }}>Published Date</th>
                      <th style={{ width: "10%" }}>Status</th>
                      <th style={{ width: "8%", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedLists.map((list) => {
                      const isActive = list.status === "1";
                      const isBusy = loadingId === list.req_id || loadingId === list.b_id;

                      return (
                        <tr key={list.b_id || list.id || list.req_id}>
                          <td>
                            <div className="si-article-cell">
                              <div className="si-article-thumb">
                                {list.thumbnail ? (
                                  <img
                                    src={AWS_UPLOADS + list.thumbnail}
                                    alt={list.title}
                                    onError={(e: any) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <BookOpen size={18} />
                                )}
                              </div>
                              <div>
                                <span className="si-article-title">{decodeHtml(list.title)}</span>
                              </div>
                            </div>
                          </td>

                          <td>
                            {list.slug ? (
                              <a
                                href={`/blogs/${list.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="si-slug-link"
                              >
                                <ExternalLink size={12} />
                                <span>/blogs/{list.slug}</span>
                              </a>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
                            )}
                          </td>

                          <td>
                            <span style={{ fontSize: "12.5px", color: "#475569" }}>
                              {timestampToDateTime(list.datetime) || "—"}
                            </span>
                          </td>

                          <td>
                            {isActive ? (
                              <span className="si-status-pill si-status-active">
                                <span className="si-status-dot" /> Active
                              </span>
                            ) : (
                              <span className="si-status-pill si-status-disabled">
                                <span className="si-status-dot" /> Inactive
                              </span>
                            )}
                          </td>

                          <td>
                            <div className="si-action-btns">
                              {/* Edit */}
                              {permCan("edit") && (
                                <button
                                  className="si-action-btn btn-edit"
                                  title="Edit Blog"
                                  onClick={() => updateto(list)}
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}

                              {/* Disable / Enable */}
                              {permCan("status") && (
                                isActive ? (
                                  <button
                                    className="si-action-btn btn-disable"
                                    title="Disable Blog"
                                    disabled={isBusy}
                                    onClick={() => disableList(list)}
                                  >
                                    <AlertCircle size={14} />
                                  </button>
                                ) : (
                                  <button
                                    className="si-action-btn btn-enable"
                                    title="Enable Blog"
                                    disabled={isBusy}
                                    onClick={() => enableList(list)}
                                  >
                                    <CheckCircle2 size={14} />
                                  </button>
                                )
                              )}

                              {/* Delete */}
                              {permCan("delete") && (
                                <button
                                  className="si-action-btn btn-delete"
                                  title="Delete Blog"
                                  disabled={isBusy}
                                  onClick={() => deleteList(list)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ padding: "16px 20px", borderTop: "1px solid #f1f5f9" }}>
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
                <SavedAgo endpoint="api/blogs" />
              </div>
            </div>
          </div>

        </div>

      )}

          {(mode === "add" || mode === "update") && (
            <div className="si-page-wrapper">
              {/* Header Container */}
              <div className="si-header-container">
                <div className="si-header-left">
                  <button
                    type="button"
                    onClick={() => moveto("board")}
                    className="si-btn-back"
                    title="Return to Blogs List"
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Blogs</span>
                  </button>

                  <div className="si-header-icon-box">
                    <BookOpen size={24} />
                  </div>

                  <div>
                    <h1 className="si-header-title">
                      {mode === "update" ? "Update Blog Post" : "Create New Blog Post"}
                      <span className="si-count-badge">
                        {mode === "update" ? `#${form.req_id || form.id}` : "Draft"}
                      </span>
                    </h1>
                    <p className="si-header-subtitle">
                      {mode === "update"
                        ? `Editing: "${form.title || "Untitled Blog"}"`
                        : "Draft an engaging article, select category, upload cover thumbnail, and format rich content."}
                    </p>
                  </div>
                </div>

                <div className="si-header-actions">
                  <button
                    type="button"
                    className="si-btn-secondary"
                    onClick={() => openImgPop()}
                    title="Browse uploaded blog images to copy their URLs"
                  >
                    <ImageIcon size={16} style={{ color: "#0ea5e9" }} />
                    <span>Insert Image</span>
                  </button>

                  {mode === "add" && permCan("create") && (
                    <button
                      type="button"
                      className="si-btn-primary"
                      disabled={loading}
                      onClick={addList}
                    >
                      <Save size={16} />
                      <span>{loading ? <ButtonLoader label="Publishing..." /> : "Publish Blog"}</span>
                    </button>
                  )}

                  {mode === "update" && permCan("delete") && (
                    <button
                      type="button"
                      className="si-btn-danger"
                      disabled={loading || loadingId === (form.req_id || form.id)}
                      onClick={() => deleteList(form)}
                      title="Permanently delete this blog"
                    >
                      <Trash2 size={15} />
                      <span>Delete Blog</span>
                    </button>
                  )}

                  {mode === "update" && permCan("edit") && (
                    <button
                      type="button"
                      className="si-btn-primary"
                      disabled={loading}
                      onClick={updateList}
                    >
                      <Save size={16} />
                      <span>{loading ? <ButtonLoader label="Updating..." /> : "Save Changes"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Status Alerts */}
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

              {/* SECTION 1: Blog Essentials */}
              <div className="si-form-card">
                <div className="si-form-card-header">
                  <div>
                    <h4 className="si-form-card-title">
                      <Sparkles size={18} style={{ color: "#0ea5e9" }} />
                      <span>Article Essentials</span>
                    </h4>
                    <p className="si-form-card-subtitle">
                      Headline, SEO link slug, and category assignment
                    </p>
                  </div>
                </div>

                <div className="row g-3">
                  {/* Blog Title */}
                  <div className="col-lg-7 col-12">
                    <label className="si-label" htmlFor="blogTitle">
                      <span>Blog Title <span className="req">*</span></span>
                    </label>
                    <input
                      id="blogTitle"
                      type="text"
                      className="si-input"
                      placeholder="e.g. Master Generative AI in 2026: The Practical Roadmap"
                      value={form.title}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          title: e.target.value,
                          slug: toSlug(e.target.value),
                        }))
                      }
                      autoComplete="off"
                      required
                    />
                  </div>

                  {/* Category */}
                  <div className="col-lg-5 col-12">
                    <div className="si-label">
                      <span>Category</span>
                      {permCan("blog-categories:view") && (
                        <Link
                          to="/panel/blog-categories"
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: "11.5px", color: "#0ea5e9", textDecoration: "none" }}
                        >
                          + Manage Categories
                        </Link>
                      )}
                    </div>
                    <div className="si-cat-row">
                      <select
                        id="blogCategory"
                        className="si-select"
                        value={form.category_id}
                        onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                      >
                        <option value="">— Select a category —</option>
                        {categories.map((cat) => (
                          <option key={cat.req_id} value={cat.req_id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="si-cat-reload"
                        onClick={reloadCategories}
                        disabled={catReloading}
                        title="Reload categories"
                        aria-label="Reload categories"
                      >
                        <RotateCw size={14} className={catReloading ? "si-spin" : ""} />
                      </button>
                    </div>
                  </div>

                  {/* Slug / Public URL */}
                  <div className="col-12">
                    <div className="si-label">
                      <span>Page Link (Slug)</span>
                      {form.slug && (
                        <a
                          href={`/blogs/${form.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: "12px",
                            color: "#0ea5e9",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          View Live Page <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <div className="si-input-group">
                      <span className="si-input-prefix">/blogs/</span>
                      <input
                        id="blogSlug"
                        type="text"
                        className="si-input si-input-grouped"
                        placeholder="auto-generated from title"
                        value={form.slug}
                        onChange={(e) => setForm((f) => ({ ...f, slug: toSlug(e.target.value) }))}
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                      Permanent URL path for this article. Leave blank to automatically generate from the title.
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Cover Thumbnail & Media */}
              <div className="si-form-card">
                <div className="si-form-card-header">
                  <div>
                    <h4 className="si-form-card-title">
                      <ImageIcon size={18} style={{ color: "#2563eb" }} />
                      <span>Cover Image & Media Library</span>
                    </h4>
                    <p className="si-form-card-subtitle">
                      Featured thumbnail displayed in article cards, search results, and social share previews
                    </p>
                  </div>

                  <button
                    type="button"
                    className="si-btn-secondary"
                    onClick={() => openImgPop()}
                  >
                    <ImageIcon size={15} style={{ color: "#0ea5e9" }} />
                    <span>Browse Media Library</span>
                  </button>
                </div>

                <div className="row g-4 align-items-center">
                  <div className="col-md-6 col-12">
                    <label className="si-label" htmlFor="thumbnailInput">
                      <span>Article Thumbnail Image</span>
                    </label>

                    <div className="si-thumb-dropzone" onClick={() => document.getElementById("thumbnailInput")?.click()}>
                      <input
                        type="file"
                        accept="image/*"
                        id="thumbnailInput"
                        style={{ display: "none" }}
                        onChange={handleThumbnail}
                      />
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: "#e0f2fe",
                            color: "#0284c7",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Upload size={22} />
                        </div>
                        <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "13.5px" }}>
                          {thumbUploading ? <InlineLoader label="Uploading to Cloud..." /> : "Click to select cover image"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                          JPG, PNG, WebP or GIF up to 5MB. 16:9 ratio recommended.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6 col-12">
                    <label className="si-label">
                      <span>Cover Preview</span>
                    </label>

                    {thumbPreview || form.thumbnail ? (
                      <div className="si-thumb-preview-box">
                        <img
                          src={thumbPreview || (AWS_UPLOADS + form.thumbnail)}
                          alt="Thumbnail preview"
                          className="si-thumb-preview-img"
                        />
                        <div className="si-thumb-overlay">
                          <button
                            type="button"
                            className="si-btn-remove"
                            onClick={() => {
                              setThumbPreview("");
                              setForm((f) => ({ ...f, thumbnail: "" }));
                            }}
                            title="Remove cover thumbnail"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          height: 180,
                          borderRadius: 14,
                          background: "#f8fafc",
                          border: "1px dashed #cbd5e1",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          color: "#94a3b8",
                        }}
                      >
                        <ImageIcon size={32} />
                        <span style={{ fontSize: "12.5px" }}>No cover thumbnail selected</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 3: Content Builder & Code Workspace */}
              <div className="si-form-card">
                <div className="si-form-card-header">
                  <div>
                    <h4 className="si-form-card-title">
                      <Code2 size={18} style={{ color: "var(--ad-brand)" }} />
                      <span>Rich Article Content & Styling</span>
                    </h4>
                    <p className="si-form-card-subtitle">
                      Write HTML structure, insert pre-built component templates, and add custom CSS
                    </p>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    {model === "view" ? (
                      <button
                        type="button"
                        className="si-btn-primary"
                        onClick={updatePreview}
                        style={{ padding: "7px 14px", fontSize: "12.5px" }}
                      >
                        <Eye size={15} />
                        <span>Preview Article</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="si-btn-primary"
                        onClick={() => setModel("view")}
                        style={{ padding: "7px 14px", fontSize: "12.5px" }}
                      >
                        <Code2 size={15} />
                        <span>Code Editor</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Editor View */}
                {model === "view" && (
                  <div className="si-workspace-container">
                    {/* Component Templates Drawer */}
                    <div className="si-components-sidebar">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          paddingBottom: 8,
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Layers size={17} style={{ color: "var(--ad-brand)" }} />
                          <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#1e293b" }}>
                            Components
                          </span>
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ad-brand)", background: "#f3e8ff", padding: "2px 7px", borderRadius: 10 }}>
                          {components.length} Templates
                        </span>
                      </div>

                      {/* Component Search Box */}
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          placeholder="Search templates..."
                          value={compSearch}
                          onChange={(e) => setCompSearch(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 10px 6px 28px",
                            fontSize: "12px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            outline: "none",
                          }}
                        />
                        <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                        {compSearch && (
                          <button
                            type="button"
                            onClick={() => setCompSearch("")}
                            style={{
                              position: "absolute",
                              right: 6,
                              top: "50%",
                              transform: "translateY(-50%)",
                              border: "none",
                              background: "transparent",
                              color: "#94a3b8",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Category Pills */}
                      <div className="si-comp-category-pills">
                        {["All", "Callouts", "Content", "Layout", "Code & Media", "Headers"].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            className={`si-comp-category-pill ${compCategory === cat ? "active" : ""}`}
                            onClick={() => setCompCategory(cat)}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        Click a template to insert at cursor position:
                      </div>

                      <div className="si-components-list">
                        {components
                          .filter((c) => {
                            if (compCategory !== "All" && c.category !== compCategory) return false;
                            if (
                              compSearch.trim() &&
                              !c.name.toLowerCase().includes(compSearch.toLowerCase()) &&
                              !(c.description || "").toLowerCase().includes(compSearch.toLowerCase())
                            ) {
                              return false;
                            }
                            return true;
                          })
                          .map((c: any, i: any) => (
                            <div
                              key={i}
                              className="si-comp-item-card"
                              onClick={() => addComponent(c)}
                              title={`Insert ${c.name} component`}
                            >
                              <div className="si-comp-item-head">
                                <span className="si-comp-item-name">{c.name}</span>
                                <span className="si-comp-item-badge">+ Insert</span>
                              </div>
                              {c.description && (
                                <span className="si-comp-item-desc">{c.description}</span>
                              )}
                              {c.category && (
                                <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>
                                  🏷️ {c.category}
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Monaco Editors Panel */}
                    <div className="si-editor-panel">
                      {/* HTML Editor */}
                      <div className="si-monaco-box">
                        <div className="si-monaco-header">
                          <span className="si-monaco-title">
                            <Code2 size={16} style={{ color: "#ea580c" }} />
                            <span>HTML Structure</span>
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                            Supports Tailwind & HTML5
                          </span>
                        </div>
                        <MonacoEditor
                          height="320px"
                          defaultLanguage="html"
                          value={form.html}
                          onMount={(editor) => (editorRef.current = editor)}
                          onChange={(v: any) => setForm((f) => ({ ...f, html: v || "" }))}
                          options={{
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            fontSize: 13,
                            wordWrap: "on",
                          }}
                        />
                      </div>

                      {/* CSS Editor */}
                      <div className="si-monaco-box">
                        <div className="si-monaco-header">
                          <span className="si-monaco-title">
                            <Palette size={16} style={{ color: "#2563eb" }} />
                            <span>Custom CSS</span>
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                            Scoped Stylesheet
                          </span>
                        </div>
                        <MonacoEditor
                          height="200px"
                          defaultLanguage="css"
                          value={form.css}
                          onChange={(v: any) => setForm((f) => ({ ...f, css: v || "" }))}
                          options={{
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            fontSize: 13,
                            wordWrap: "on",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Live Preview View */}
                {model === "preview" && (
                  <div className="si-preview-simulator">
                    <div className="si-preview-topbar">
                      <div className="d-flex align-items-center gap-2">
                        <button
                          type="button"
                          className="si-btn-back"
                          onClick={() => setModel("view")}
                        >
                          <Code2 size={15} />
                          <span>Back to Editor</span>
                        </button>
                        <button
                          type="button"
                          className="si-btn-secondary"
                          onClick={updatePreview}
                          title="Reload live preview"
                        >
                          <RotateCw size={14} />
                          <span>Refresh</span>
                        </button>
                      </div>

                      <div className="si-device-pills">
                        <button
                          type="button"
                          className={`si-device-pill ${previewDevice === "desktop" ? "active" : ""}`}
                          onClick={() => setPreviewDevice("desktop")}
                        >
                          <Monitor size={14} />
                          <span>Desktop</span>
                        </button>
                        <button
                          type="button"
                          className={`si-device-pill ${previewDevice === "tablet" ? "active" : ""}`}
                          onClick={() => setPreviewDevice("tablet")}
                        >
                          <Tablet size={14} />
                          <span>Tablet</span>
                        </button>
                        <button
                          type="button"
                          className={`si-device-pill ${previewDevice === "mobile" ? "active" : ""}`}
                          onClick={() => setPreviewDevice("mobile")}
                        >
                          <Smartphone size={14} />
                          <span>Mobile</span>
                        </button>
                      </div>

                      <div className="si-preview-url-bar">
                        <span>https://www.riviratech.com/blogs/{form.slug || "post"}</span>
                      </div>
                    </div>

                    <div className="si-preview-viewport-wrap">
                      <div
                        className="si-preview-frame-container"
                        style={{
                          width:
                            previewDevice === "mobile"
                              ? "390px"
                              : previewDevice === "tablet"
                              ? "768px"
                              : "100%",
                        }}
                      >
                        <iframe
                          title="Blog Preview"
                          style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                            background: "#ffffff",
                          }}
                          srcDoc={preview}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Sticky Action Bar */}
              <div
                style={{
                  position: "sticky",
                  bottom: "16px",
                  zIndex: 30,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 16,
                  padding: "14px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.06)",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <button
                    type="button"
                    className="si-btn-secondary"
                    onClick={() => moveto("board")}
                  >
                    <ArrowLeft size={15} />
                    <span>Cancel & Back</span>
                  </button>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="si-btn-secondary"
                    onClick={updatePreview}
                  >
                    <Eye size={15} />
                    <span>Preview</span>
                  </button>

                  {mode === "add" && permCan("create") && (
                    <button
                      type="button"
                      className="si-btn-primary"
                      disabled={loading}
                      onClick={addList}
                    >
                      <Save size={16} />
                      <span>{loading ? <ButtonLoader label="Publishing Blog..." /> : "Publish Blog"}</span>
                    </button>
                  )}

                  {mode === "update" && permCan("delete") && (
                    <button
                      type="button"
                      className="si-btn-danger"
                      disabled={loading || loadingId === (form.req_id || form.id)}
                      onClick={() => deleteList(form)}
                      title="Permanently delete this blog"
                    >
                      <Trash2 size={15} />
                      <span>Delete Blog</span>
                    </button>
                  )}

                  {mode === "update" && permCan("edit") && (
                    <button
                      type="button"
                      className="si-btn-primary"
                      disabled={loading}
                      onClick={updateList}
                    >
                      <Save size={16} />
                      <span>{loading ? <ButtonLoader label="Updating Blog..." /> : "Update Blog"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

        </span>
      )}

    </div>

    {/* ---------- Blog-image picker popup ---------- */}
    {imgPop && (
      <div className="blogimg-pop-overlay" onClick={() => setImgPop(false)}>
        <div className="blogimg-pop" onClick={(e) => e.stopPropagation()}>
          <div className="blogimg-pop-head">
            <h5>Uploaded Blog Images {imgPopTotal > 0 && <span className="blogimg-pop-count">({imgPopTotal})</span>}</h5>
            <button type="button" className="blogimg-pop-close" onClick={() => setImgPop(false)}>×</button>
          </div>
          <p className="blogimg-pop-sub">Click <b>Copy URL</b>, then paste the link into your blog HTML.</p>

          <div className="blogimg-pop-body">
            {imgPopLoading ? (
              <div className="blogimg-pop-empty">Loading…</div>
            ) : imgPopList.length === 0 ? (
              <div className="blogimg-pop-empty">
                No images uploaded yet — use the <b>Blog Images</b> page to upload some.
              </div>
            ) : (
              <div className="blogimg-pop-grid">
                {imgPopList.map((img) => {
                  const url = AWS_UPLOADS + img.file;
                  return (
                    <div className="blogimg-pop-item" key={img.id}>
                      <div className="blogimg-pop-thumb">
                        <img src={url} alt="" loading="lazy" />
                      </div>
                      <button type="button" className="blogimg-pop-copy" onClick={() => copyImgUrl(url)}>
                        <i className="fa-solid fa-copy"></i> Copy URL
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="blogimg-pop-foot">
            {imgPopLastPage > 1 ? (
              <div className="blogimg-pop-pager">
                <button
                  type="button"
                  className="blogimg-pop-pg"
                  disabled={imgPopPage <= 1 || imgPopLoading}
                  onClick={() => openImgPop(imgPopPage - 1)}
                >
                  ‹ Prev
                </button>
                <span className="blogimg-pop-pgtext">Page {imgPopPage} of {imgPopLastPage}</span>
                <button
                  type="button"
                  className="blogimg-pop-pg"
                  disabled={imgPopPage >= imgPopLastPage || imgPopLoading}
                  onClick={() => openImgPop(imgPopPage + 1)}
                >
                  Next ›
                </button>
              </div>
            ) : <span />}

            <button type="button" className="add btn btn-success" onClick={() => { setImgPop(false); setModel("images"); }}>
              Open Full Uploads Page
            </button>
          </div>
        </div>
      </div>
    )}

    <style>{`
      .blogimg-pop-overlay { position: fixed; inset: 0; z-index: 20000; background: rgba(15,12,20,.55); display: flex; align-items: center; justify-content: center; padding: 20px; }
      .blogimg-pop { background: #fff; width: 100%; max-width: 820px; max-height: 86vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,.4); }
      .blogimg-pop-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid #eee; }
      .blogimg-pop-head h5 { margin: 0; font-weight: 700; }
      .blogimg-pop-close { border: none; background: transparent; font-size: 26px; line-height: 1; cursor: pointer; color: #888; }
      .blogimg-pop-sub { margin: 0; padding: 12px 22px 0; font-size: 13px; color: #888; }
      .blogimg-pop-body { padding: 18px 22px; overflow-y: auto; }
      .blogimg-pop-empty { text-align: center; padding: 44px 20px; color: #888; }
      .blogimg-pop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
      .blogimg-pop-item { border: 1px solid #ececec; border-radius: 10px; overflow: hidden; background: #fafafa; }
      .blogimg-pop-thumb { height: 110px; display: flex; align-items: center; justify-content: center; background: #fff; padding: 6px; }
      .blogimg-pop-thumb img { max-width: 100%; max-height: 100%; object-fit: contain; }
      .blogimg-pop-copy { width: 100%; border: none; border-top: 1px solid #ececec; background: #f5c518; color: #201a02; font-weight: 700; font-size: 12px; padding: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
      .blogimg-pop-copy:hover { background: #e0a800; }
      .blogimg-pop-foot { padding: 14px 22px; border-top: 1px solid #eee; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .blogimg-pop-count { color: #9a95a5; font-weight: 600; font-size: 14px; }
      .blogimg-pop-pager { display: inline-flex; align-items: center; gap: 12px; }
      .blogimg-pop-pg { border: 1px solid #e0dccf; background: #fff; color: #201a02; font-weight: 700; font-size: 13px; padding: 6px 14px; border-radius: 50px; cursor: pointer; transition: background .2s, border-color .2s; }
      .blogimg-pop-pg:hover:not(:disabled) { background: #f5c518; border-color: #e0a800; }
      .blogimg-pop-pg:disabled { opacity: .45; cursor: not-allowed; }
      .blogimg-pop-pgtext { font-size: 13px; color: #6b6577; font-weight: 600; }
    `}</style>
  </>);

  /* ================= Components ================= */
  function BlogCard({ list }: any) {
  const permCan = usePagePerm("blogs");

    return (
      <div className="col-lg-12" style={{ position: "relative", "padding": "0px" }}>

        <div className="card batch-card">

          <div className="card-body">

            <h5 className="fw-bold mb-3">
              {decodeHtml(list.title)}
            </h5>

            <div className="info-row">
              <i className="fa fa-calendar"></i>
              <span>
                Created at {timestampToDateTime(list.datetime)} - {list.status === "1" ? "Active" : "InActive"}
              </span>
            </div>

            {list.slug && (
              <div className="info-row" style={{ marginTop: "4px" }}>
                <i className="fa-solid fa-link" style={{ fontSize: "12px" }}></i>
                <a
                  href={`/blogs/${list.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: "13px", marginLeft: "6px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  /blogs/{list.slug}
                </a>
              </div>
            )}

            <hr />

            <div className="btn-row" style={{ textAlign: "right" }}>
              <div></div>

              {loadingId === list.req_id ? <div style={{ textAlign: "right" }}>Requesting...</div> :
                list.status !== "1D" ? (
                  <div style={{ textAlign: "right" }}>

                    {list.status === "1" && (
                      (permCan("status") ? (<button
                        className="btn btn-danger btn-sm" title="Disable Batch"
                        disabled={loadingId === list.b_id}
                        onClick={() => disableList(list)}
                      >
                        {loadingId === list.b_id ? <ButtonLoader label="Disabling..." /> : "Disable"}
                      </button>) : null)
                    )}

                    {list.status === "1S" && (
                      (permCan("status") ? (<button
                        className="btn btn-success btn-sm" title="Enable Batch"
                        disabled={loadingId === list.b_id}
                        onClick={() => enableList(list)}
                      >
                        {loadingId === list.b_id ? <ButtonLoader label="Enabling..." /> : "Enable"}
                      </button>) : null)
                    )}

                    {permCan("edit") && (<button
                      className="btn btn-success btn-sm" title="Update Batch Details" style={{ marginLeft: "20px" }}
                      onClick={() => updateto(list)}
                    >
                      <span className="btn-inner">
                        <i className="fa fa-edit"></i>
                      </span>
                    </button>)}

                    {permCan("delete") && (<button
                      className="btn btn-danger btn-sm" title="Delete Blog" style={{ marginLeft: "10px" }}
                      disabled={loadingId === list.req_id}
                      onClick={() => deleteList(list)}
                    >
                      <span className="btn-inner">
                        <i className="fa fa-trash"></i>
                      </span>
                    </button>)}

                  </div>
                ) : (
                  <div></div>
                )}

            </div>

          </div>

        </div>

      </div>
    );
  }

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
                className={`dt-paging-button ${p === page ? "current" : ""
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

  function Icon() {
    return (<>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="7" y1="8" x2="17" y2="8" />
        <line x1="7" y1="12" x2="17" y2="12" />
        <line x1="7" y1="16" x2="13" y2="16" />
      </svg>
    </>
    );
  }

}

