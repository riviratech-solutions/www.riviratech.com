import { useRef, type InputHTMLAttributes } from "react";
import { Search } from "lucide-react";

/* The search box on admin list pages: a rounded input with the search icon
   inside, and a square search button beside it (styles in panel.css, .ls-*).

   Takes the page's own input props (value, onChange, onKeyDown, placeholder).
   The button runs the page's existing search: inside a form it is that form's
   submit button (so Enter keeps working too); otherwise it presses Enter in the
   input, which is what those pages search on. Pages that filter as you type
   just get focus. */
export default function ListSearch(props: InputHTMLAttributes<HTMLInputElement>) {
  const input = useRef<HTMLInputElement>(null);

  const search = () => {
    const el = input.current;
    if (!el || el.form) return; // in a form the click submits it
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    el.focus();
  };

  return (
    <div className="ls-search">
      <div className="ls-box">
        <Search size={17} className="ls-icon" aria-hidden="true" />
        <input type="text" {...props} ref={input} className="ls-input" />
      </div>
      <button type="submit" className="ls-go" title="Search" aria-label="Search" onClick={search}>
        <Search size={17} />
      </button>
    </div>
  );
}
