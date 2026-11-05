#!/usr/bin/env python3
"""
fix_color_scheme.py - stop browser auto/forced dark mode from re-theming a site.

Chrome "Auto Dark Mode for Web Contents" and extensions like Dark Reader invert
pages that do not declare a color scheme. On a light site with dark hero bands
this turns white headings dark (e.g. "Explore" on /courses).

The fix has two parts, both applied by this script:
  1. <meta name="color-scheme" content="light" />  in index.html <head>
  2. color-scheme: light;                          in the first :root {} of a CSS file

The script is idempotent: running it twice changes nothing the second time.

Usage:
  python scripts/fix_color_scheme.py                       # this project, defaults
  python scripts/fix_color_scheme.py --dry-run             # show what would change
  python scripts/fix_color_scheme.py --root "E:/other/project" --css public/css/site.css
  python scripts/fix_color_scheme.py --scheme "light dark" # if the site has a real dark theme
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

META_RE = re.compile(r'<meta\s+[^>]*name\s*=\s*["\']color-scheme["\'][^>]*>', re.I)
HEAD_OPEN_RE = re.compile(r"<head[^>]*>", re.I)
THEME_COLOR_RE = re.compile(r'[ \t]*<meta\s+[^>]*name\s*=\s*["\']theme-color["\'][^>]*>\s*\n', re.I)
ROOT_RE = re.compile(r"(^|\n)([ \t]*):root\s*\{", re.M)
CSS_PROP_RE = re.compile(r"color-scheme\s*:\s*([^;}]+)", re.I)


def read(path: Path) -> tuple[str, str]:
    """Return (text, newline) so we write back with the file's own line endings."""
    raw = path.read_bytes().decode("utf-8")
    nl = "\r\n" if "\r\n" in raw else "\n"
    return raw.replace("\r\n", "\n"), nl


def write(path: Path, text: str, nl: str) -> None:
    path.write_bytes(text.replace("\n", nl).encode("utf-8"))


def fix_html(text: str, scheme: str) -> tuple[str, str]:
    meta = f'<meta name="color-scheme" content="{scheme}" />'
    existing = META_RE.search(text)
    if existing:
        if f'content="{scheme}"' in existing.group(0):
            return text, "already has the color-scheme meta"
        return text[: existing.start()] + meta + text[existing.end():], "updated existing color-scheme meta"

    # Prefer placing it right after theme-color; otherwise right after <head>.
    tc = THEME_COLOR_RE.search(text)
    if tc:
        indent = re.match(r"[ \t]*", tc.group(0)).group(0)
        return text[: tc.end()] + f"{indent}{meta}\n" + text[tc.end():], "inserted meta after theme-color"

    head = HEAD_OPEN_RE.search(text)
    if not head:
        raise SystemExit("index.html: no <head> tag found")
    return text[: head.end()] + f"\n  {meta}" + text[head.end():], "inserted meta after <head>"


def fix_css(text: str, scheme: str) -> tuple[str, str]:
    m = ROOT_RE.search(text)
    if not m:
        # No :root rule at all: add one at the top.
        return f":root {{\n  color-scheme: {scheme};\n}}\n\n" + text, "added new :root rule"

    body_start = m.end()
    body_end = text.find("}", body_start)
    body = text[body_start:body_end]
    prop = CSS_PROP_RE.search(body)
    if prop:
        if prop.group(1).strip() == scheme:
            return text, "already has color-scheme in :root"
        s, e = body_start + prop.start(1), body_start + prop.end(1)
        return text[:s] + scheme + text[e:], "updated color-scheme in :root"

    indent = m.group(2) + "  "
    line = f"\n{indent}color-scheme: {scheme};"
    return text[:body_start] + line + text[body_start:], "inserted color-scheme into :root"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=str(Path(__file__).resolve().parent.parent),
                    help="project root (default: parent of this scripts/ folder)")
    ap.add_argument("--html", default="index.html", help="HTML entry file, relative to root")
    ap.add_argument("--css", default="public/css/rivira-design.css", help="CSS file whose :root gets the property")
    ap.add_argument("--scheme", default="light", help='color-scheme value (default "light")')
    ap.add_argument("--dry-run", action="store_true", help="report changes without writing")
    args = ap.parse_args()

    root = Path(args.root)
    targets = [(root / args.html, fix_html), (root / args.css, fix_css)]
    changed = 0

    for path, fixer in targets:
        if not path.is_file():
            print(f"[skip] {path} - not found")
            continue
        text, nl = read(path)
        new_text, note = fixer(text, args.scheme)
        if new_text == text:
            print(f"[ok]   {path.name}: {note}")
            continue
        changed += 1
        if args.dry_run:
            print(f"[dry]  {path.name}: would have {note}")
        else:
            write(path, new_text, nl)
            print(f"[fix]  {path.name}: {note}")

    if changed and not args.dry_run:
        print("\nDone. Hard-refresh the page (Ctrl+Shift+R); run `npm run build` before deploying.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
