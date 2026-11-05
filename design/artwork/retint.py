"""Generate .rv-body-scoped overrides that move the old blue / gold accents of
the legacy stylesheets onto the indigo-violet body theme.

    python retint.py <website.css> <rivira-design.css>

Every rule (inside its @media, if any) whose declarations use one of the old
colours is re-emitted, scoped to .rv-body, with only those declarations and
the colours swapped. website.css rules go to the top of rivira-design.css
under a zero-specificity :where(.rv-body); this file's own earlier rules go
right before its BODY THEME section under .rv-body. Either way the
hand-written rules still win, and the scope keeps the header, footer and
floating widgets untouched. Re-running replaces the previous output.
"""
import re
import sys

MARK = "/* ==========================================================================\n   BODY THEME (2026-11)"
BEGIN = "/* RETINT (generated) — begin */"
END = "/* RETINT (generated) — end */"

HEX = {
    # blues of the previous palette
    "1f5faf": "4F46E5", "0b3d7a": "3B2FC9", "5aa9f0": "A78BFA",
    "2563eb": "4F46E5", "1d4ed8": "4338CA", "1e40af": "3730A3", "1e3a8a": "312E81",
    "3b82f6": "6366F1", "60a5fa": "A78BFA", "93c5fd": "C4B5FD",
    "bfdbfe": "DDD6FE", "dbeafe": "EDE9FE", "eff6ff": "F5F3FF",
    # golds / ambers of the original palette
    "f59e0b": "7C3AED", "d97706": "6D28D9", "fbbf24": "A78BFA", "b45309": "5B21B6",
    "92400e": "4338CA", "fde68a": "DDD6FE", "fef3c7": "EEEBFF", "fffbeb": "F5F3FF",
    "fffdf7": "FAF9FF", "f0e2c2": "E4E0FB", "ffd966": "A78BFA", "c9a227": "7C3AED",
    "7c2d12": "312E81", "78350f": "312E81", "022150": "17145C",
}
RGB = {
    (31, 95, 175): (79, 70, 229), (11, 61, 122): (59, 47, 201), (90, 169, 240): (167, 139, 250),
    (37, 99, 235): (79, 70, 229), (59, 130, 246): (99, 102, 241),
    (245, 158, 11): (124, 58, 237), (217, 119, 6): (109, 40, 217), (251, 191, 36): (167, 139, 250),
    (2, 33, 80): (23, 20, 92),
}
HEX_RE = re.compile(r"#(" + "|".join(HEX) + r")(?=(?:[0-9a-f]{2})?(?![0-9a-f]))", re.I)
RGB_RE = re.compile(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)")


def swap(v):
    out = HEX_RE.sub(lambda m: "#" + HEX[m.group(1).lower()], v)

    def rgb(m):
        k = tuple(int(x) for x in m.groups())
        if k not in RGB:
            return m.group(0)
        return m.group(0).split("(")[0] + "(%d, %d, %d" % RGB[k]
    return RGB_RE.sub(rgb, out)


def split_decls(body):
    parts, depth, cur, q = [], 0, "", None
    for ch in body:
        if q:
            cur += ch
            if ch == q:
                q = None
            continue
        if ch in "'\"":
            q = ch
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif ch == ";" and depth == 0:
            parts.append(cur)
            cur = ""
            continue
        cur += ch
    if cur.strip():
        parts.append(cur)
    return [p.strip() for p in parts if ":" in p]


def blocks(css):
    """Yield (at_rule_prelude_or_None, selector, body) for every plain rule."""
    i, n = 0, len(css)
    stack = []  # open at-rule preludes
    while i < n:
        j = css.find("{", i)
        k = css.find("}", i)
        if k != -1 and (j == -1 or k < j):
            if stack:
                stack.pop()
            i = k + 1
            continue
        if j == -1:
            break
        prelude = css[i:j].strip()
        if prelude.startswith("@"):
            if re.match(r"@(media|supports)\b", prelude):
                stack.append(prelude)
                i = j + 1
            else:  # @keyframes, @font-face… skip the whole block
                depth, p = 0, j
                while p < n:
                    if css[p] == "{":
                        depth += 1
                    elif css[p] == "}":
                        depth -= 1
                        if depth == 0:
                            break
                    p += 1
                i = p + 1
            continue
        e = css.find("}", j)
        yield (stack[-1] if stack else None), prelude, css[j + 1:e]
        i = e + 1


SKIP_SEL = re.compile(r"^(html|body|:root|\*)\b|footer|navbar|custom-nav|rt-fb__|header|cfx-", re.I)


def scope(sel, prefix):
    out = []
    for s in sel.split(","):
        s = s.strip()
        if not s or SKIP_SEL.search(s):
            continue
        out.append(prefix + " " + s)
    return ",\n".join(out)


def family(prop):
    prop = prop.strip().lower()
    return "background" if prop.startswith("background") else prop


def generate(css, prefix):
    """The copies load after the originals, so a declaration that a later rule
    (same selector, same @media) overrides with another colour is left out —
    otherwise the copy would bring the overridden value back."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    parsed = [(m, [s.strip() for s in sel.split(",")], split_decls(body)) for m, sel, body in blocks(css)]
    later = {}  # (media, selector, family) -> [(rule index, important, keeps old colour)]
    for i, (media, sels, decls) in enumerate(parsed):
        for d in decls:
            prop, val = d.split(":", 1)
            for s in sels:
                later.setdefault((media, s, family(prop)), []).append((i, "!important" in val, swap(d) != d))

    def overridden(i, media, s, d):
        prop, val = d.split(":", 1)
        imp = "!important" in val
        return any(j > i and not old and (limp or not imp) for j, limp, old in later[(media, s, family(prop))])

    rules = []
    for i, (media, sels, decls) in enumerate(parsed):
        groups = {}
        for s in sels:
            keep = tuple(swap(d) for d in decls if swap(d) != d and not overridden(i, media, s, d))
            if keep:
                groups.setdefault(keep, []).append(s)
        for keep, ss in groups.items():
            s = scope(", ".join(ss), prefix)
            if s:
                rules.append((media, s + " { " + "; ".join(keep) + "; }"))
    out, last = [], None
    for media, rule in rules:
        if media != last:
            if last:
                out.append("}")
            if media:
                out.append(media + " {")
            last = media
        out.append(rule)
    if last:
        out.append("}")
    return "\n".join(out), len(rules)


if __name__ == "__main__":
    web_path, design_path = sys.argv[1], sys.argv[2]
    web = open(web_path, encoding="utf-8").read()
    raw = open(design_path, "rb").read()
    eol = "\r\n" if b"\r\n" in raw else "\n"
    design = raw.decode("utf-8").replace("\r\n", "\n")
    # drop a previous run, then split the design file at the theme marker
    design = re.sub(re.escape(BEGIN) + r".*?" + re.escape(END) + r"\n*", "", design, flags=re.S)
    at = design.index(MARK)
    # website.css rules keep their own specificity (:where adds none) and sit
    # at the top, so every hand-written rule of this file still beats them …
    a, n1 = generate(web, ":where(.rv-body)")
    # … while this file's own earlier rules need the extra class to beat
    # themselves, and sit just before the BODY THEME section.
    b, n2 = generate(design[:at], ".rv-body")
    head = design.index("*/") + 3  # after the file's title comment
    top = (BEGIN + "\n/* Old blue/gold accents of website.css, moved onto the indigo-violet body\n"
           "   theme inside .rv-body. Regenerate with design/artwork/retint.py. */\n" + a + "\n" + END + "\n\n")
    mid = (BEGIN + "\n/* Old blue/gold accents of the sections above, moved onto the body theme.\n"
           "   Regenerate with design/artwork/retint.py. */\n" + b + "\n" + END + "\n\n")
    out = design[:head] + "\n" + top + design[head:at] + mid + design[at:]
    open(design_path, "w", encoding="utf-8", newline=eol).write(out)
    print("rules:", n1, "+", n2, "bytes:", len(top) + len(mid))
