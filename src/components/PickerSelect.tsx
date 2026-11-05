import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

/* group: a heading shown above the first option of each group (in list order);
   keywords: extra words the search matches (not shown); hint: small text on the right. */
export type PickerOption = { value: string; label: string; group?: string; keywords?: string; hint?: string };

type Props = {
  id?: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  iconClass?: string; // colour class for the icon tile (e.g. course-icon / batch-icon)
  emptyText?: string;
  disabled?: boolean;
  searchable?: boolean; // a search box at the top of the list
  searchPlaceholder?: string;
};

/* A styled replacement for a native <select>: the browser's own option list
   can't be styled (and opens offset in some browsers), so the list here is
   drawn by us. It is portalled to <body> with fixed positioning so cards with
   overflow:hidden don't clip it. Keyboard: ↑/↓, Home/End, Enter/Space, Esc;
   with `searchable`, typing filters the list (every word must match). */
export default function PickerSelect({
  id, value, options, onChange, placeholder = "Select", icon, iconClass = "",
  emptyText = "No options", disabled = false, searchable = false, searchPlaceholder = "Search…",
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean; max: number }>();
  const [dark, setDark] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  // the options the search leaves (all of them without a search)
  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return options;
    return options.filter((o) => {
      const text = (o.label + " " + (o.keywords || "") + " " + (o.hint || "")).toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [options, query]);

  const place = () => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const below = window.innerHeight - b.bottom - 12;
    const above = b.top - 12;
    const up = below < 220 && above > below;
    setPos({
      left: b.left,
      top: up ? b.top - 6 : b.bottom + 6,
      width: b.width,
      up,
      max: Math.max(140, Math.min(searchable ? 380 : 300, up ? above : below)),
    });
  };

  const openList = () => {
    if (disabled) return;
    setDark(!!btnRef.current?.closest(".panel-dark"));
    place();
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const choose = (v: string) => {
    setOpen(false);
    btnRef.current?.focus();
    if (v !== value) onChange(v);
  };

  // follow the box while the page scrolls or resizes; close on outside click
  useLayoutEffect(() => {
    if (!open) return;
    const onMove = () => place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    // scrolling the list itself (or typing in its search) mustn't move it
    const onScroll = (e: Event) => {
      if (listRef.current && listRef.current.contains(e.target as Node)) return;
      onMove();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onMove);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  // the search box takes the typing as soon as the list opens
  useEffect(() => {
    if (open && searchable) searchRef.current?.focus({ preventScroll: true });
  }, [open, searchable]);

  // keep the highlighted option in view
  useEffect(() => {
    if (!open || active < 0) return;
    const el = listRef.current?.querySelector(`[data-i="${active}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKey = (e: React.KeyboardEvent, fromSearch = false) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    const n = shown.length;
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      setOpen(false);
      if (e.key === "Escape") btnRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (n) setActive((i) => (i + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (n) setActive((i) => (i <= 0 ? n - 1 : i - 1));
    } else if (!fromSearch && e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (!fromSearch && e.key === "End") {
      e.preventDefault();
      setActive(n - 1);
    } else if (e.key === "Enter" || (!fromSearch && e.key === " ")) {
      e.preventDefault();
      if (active >= 0 && shown[active]) choose(shown[active].value);
    }
  };

  return (
    <div className={"pks" + (open ? " is-open" : "") + (disabled ? " is-disabled" : "")}>
      {icon && <div className={"pks-icon " + iconClass}>{icon}</div>}
      <button
        ref={btnRef}
        id={id}
        type="button"
        className={"pks-btn" + (icon ? " has-icon" : "")}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => onKey(e)}
      >
        <span className={"pks-label" + (selected ? "" : " is-placeholder")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={18} className="pks-chev" />
      </button>

      {open && pos &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            className={"pks-list" + (pos.up ? " is-up" : "") + (dark ? " is-dark" : "") + (searchable ? " has-search" : "")}
            style={{
              left: pos.left,
              width: pos.width,
              maxHeight: pos.max,
              ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            }}
          >
            {searchable && (
              <li className="pks-search" role="presentation">
                <Search size={16} aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={(e) => onKey(e, true)}
                />
              </li>
            )}
            {shown.length === 0 && <li className="pks-empty">{query ? "Nothing matches" : emptyText}</li>}
            {shown.map((o, i) => (
              <PickerRow
                key={o.value + "|" + (o.group || "") + "|" + i}
                option={o}
                heading={o.group && o.group !== shown[i - 1]?.group ? o.group : ""}
                index={i}
                selected={o.value === value}
                active={i === active}
                onHover={() => setActive(i)}
                onChoose={() => choose(o.value)}
              />
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}

function PickerRow({ option, heading, index, selected, active, onHover, onChoose }: {
  option: PickerOption; heading: string; index: number; selected: boolean; active: boolean;
  onHover: () => void; onChoose: () => void;
}) {
  return (
    <>
      {heading && (
        <li className="pks-group" role="presentation">
          {heading}
        </li>
      )}
      <li
        role="option"
        data-i={index}
        aria-selected={selected}
        className={"pks-opt" + (selected ? " is-selected" : "") + (active ? " is-active" : "")}
        onMouseEnter={onHover}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onChoose}
      >
        <span className="pks-opt-label">{option.label}</span>
        {option.hint && <span className="pks-hint">{option.hint}</span>}
        {selected && <Check size={16} className="pks-tick" />}
      </li>
    </>
  );
}
