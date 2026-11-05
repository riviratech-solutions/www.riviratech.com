"""Drawing kit for the Rivira Tech illustration set.

Every image on the site is drawn here as SVG, in one style: logo navy / metallic
blue / silver, soft glows, a dot grid, white UI cards. scenes.py composes the
scenes; render.cjs turns each SVG into the PNG / WebP / JPG the site serves.
"""
import math
import random

# Indigo / electric-blue / violet body palette (2026-11 redesign)
NAVY = "#17145C"
NAVY_DEEP = "#0B0A2E"
BLUE = "#5B3FE8"
BLUE_MID = "#4F6BFF"
BLUE_LIGHT = "#7C9CFF"
SKY = "#C7D2FE"
VIOLET = "#8B5CF6"
ELECTRIC = "#3B7BFF"
SILVER = "#B7BBBF"
SILVER_LIGHT = "#E3E6EA"
INK = "#111111"
WHITE = "#FFFFFF"
FONT = "'Plus Jakarta Sans', 'Inter Tight', Arial, sans-serif"


def svg(w, h, body, defs=""):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
        f"<defs>{base_defs()}{defs}</defs>{body}</svg>"
    )


def base_defs():
    return f"""
<linearGradient id="gNavy" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="{NAVY_DEEP}"/><stop offset=".55" stop-color="{NAVY}"/><stop offset="1" stop-color="#2B1D86"/>
</linearGradient>
<linearGradient id="gLight" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#F7F9FC"/><stop offset="1" stop-color="#E4EAF2"/>
</linearGradient>
<linearGradient id="gBlue" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#3B7BFF"/><stop offset="1" stop-color="#7C3AED"/>
</linearGradient>
<linearGradient id="gSilver" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#F4F5F7"/><stop offset=".5" stop-color="{SILVER}"/><stop offset="1" stop-color="#8E9399"/>
</linearGradient>
<linearGradient id="gBar" x1="0" y1="1" x2="0" y2="0">
  <stop offset="0" stop-color="#6D28D9"/><stop offset="1" stop-color="#3B82F6"/>
</linearGradient>
<radialGradient id="gGlow"><stop offset="0" stop-color="{BLUE_LIGHT}" stop-opacity=".55"/><stop offset="1" stop-color="{BLUE_LIGHT}" stop-opacity="0"/></radialGradient>
<radialGradient id="gGlowSoft"><stop offset="0" stop-color="{BLUE_LIGHT}" stop-opacity=".22"/><stop offset="1" stop-color="{BLUE_LIGHT}" stop-opacity="0"/></radialGradient>
<radialGradient id="gNode"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#A5B4FC"/><stop offset="1" stop-color="#6D28D9"/></radialGradient>
<pattern id="pDots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="#FFFFFF" fill-opacity=".09"/></pattern>
<pattern id="pDotsDark" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="{NAVY}" fill-opacity=".09"/></pattern>
<filter id="fShadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#021330" flood-opacity=".28"/></filter>
<filter id="fShadowLight" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#1F5FAF" flood-opacity=".16"/></filter>
<filter id="fBlur"><feGaussianBlur stdDeviation="2.2"/></filter>
"""


# ---------------------------------------------------------------- grounds
def bg_dark(w, h, glows=((0.78, 0.25, 0.55), (0.15, 0.85, 0.45))):
    out = f'<rect width="{w}" height="{h}" fill="url(#gNavy)"/>'
    for gx, gy, gr in glows:
        out += f'<circle cx="{gx*w:.0f}" cy="{gy*h:.0f}" r="{gr*max(w,h):.0f}" fill="url(#gGlow)"/>'
    out += f'<rect width="{w}" height="{h}" fill="url(#pDots)"/>'
    # a silver light streak, like the brushed metal of the logo
    out += (f'<path d="M{-0.1*w:.0f} {0.95*h:.0f} L{0.55*w:.0f} {-0.1*h:.0f} L{0.62*w:.0f} {-0.1*h:.0f} L{0*w:.0f} {1.05*h:.0f}Z" '
            f'fill="#FFFFFF" fill-opacity=".035"/>')
    return out


def bg_light(w, h, glows=((0.8, 0.2, 0.5), (0.1, 0.9, 0.4))):
    out = f'<rect width="{w}" height="{h}" fill="url(#gLight)"/>'
    for gx, gy, gr in glows:
        out += f'<circle cx="{gx*w:.0f}" cy="{gy*h:.0f}" r="{gr*max(w,h):.0f}" fill="url(#gGlowSoft)"/>'
    out += f'<rect width="{w}" height="{h}" fill="url(#pDotsDark)"/>'
    return out


# ---------------------------------------------------------------- pieces
def card(x, y, w, h, dark=False, r=16, header=True, shadow=True):
    fill = "#0C2A58" if dark else WHITE
    stroke = "#FFFFFF" if dark else "#DCE3EC"
    so = ".14" if dark else "1"
    filt = ("fShadow" if dark else "fShadowLight") if shadow else None
    out = f'<g filter="url(#{filt})">' if filt else "<g>"
    out += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-opacity="{so}"/>'
    out += "</g>"
    if header:
        for i, c in enumerate(("#FF6B6B", "#FFC94A", "#4ADE80") if not dark else (SILVER, SILVER, SILVER)):
            out += f'<circle cx="{x+18+i*14}" cy="{y+17}" r="4.2" fill="{c}" fill-opacity="{".55" if dark else ".9"}"/>'
        out += f'<rect x="{x}" y="{y+33}" width="{w}" height="1" fill="{stroke}" fill-opacity="{".12" if dark else "1"}"/>'
    return out


def bars(x, y, rows, width, dark=False, seed=1, gap=16, palette=None):
    rnd = random.Random(seed)
    pal = palette or ([BLUE_LIGHT, SILVER, SKY, "#FFFFFF"] if dark else [BLUE, SILVER, BLUE_LIGHT, "#9AA4B2"])
    out = ""
    for i in range(rows):
        indent = rnd.choice([0, 0, 18, 36])
        x0 = x + indent
        rem = width - indent
        while rem > 30:
            seg = min(rem, rnd.randint(28, 110))
            out += f'<rect x="{x0}" y="{y+i*gap}" width="{seg-8}" height="7" rx="3.5" fill="{rnd.choice(pal)}" fill-opacity="{".85" if dark else ".8"}"/>'
            x0 += seg
            rem -= seg
            if rnd.random() < 0.35:
                break
    return out


def text(x, y, s, size=16, fill=INK, weight=700, anchor="start", opacity=1, spacing=0):
    return (f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{fill}" '
            f'fill-opacity="{opacity}" text-anchor="{anchor}" letter-spacing="{spacing}">{s}</text>')


def pill(x, y, label, dark=False, w=None, size=13):
    w = w or (len(label) * size * 0.62 + 26)
    fill = "#FFFFFF" if not dark else "#FFFFFF"
    op = "1" if not dark else ".1"
    tc = BLUE if not dark else WHITE
    return (f'<rect x="{x}" y="{y}" width="{w:.0f}" height="{size+15}" rx="{(size+15)/2}" fill="{fill}" fill-opacity="{op}" '
            f'stroke="{BLUE_LIGHT}" stroke-opacity=".5"/>'
            + text(x + w / 2, y + size + 4, label, size, tc, 700, "middle"))


def network(cx, cy, r, n=26, seed=3, dark=True, links=2.1):
    rnd = random.Random(seed)
    pts = []
    for i in range(n):
        a = rnd.random() * math.tau
        d = r * math.sqrt(rnd.random())
        pts.append((cx + math.cos(a) * d, cy + math.sin(a) * d * 0.82))
    out = f'<circle cx="{cx}" cy="{cy}" r="{r*1.25:.0f}" fill="url(#gGlow)" opacity="{".9" if dark else ".5"}"/>'
    lc = "#FFFFFF" if dark else BLUE
    for i, (x1, y1) in enumerate(pts):
        near = sorted(pts, key=lambda p: (p[0]-x1)**2 + (p[1]-y1)**2)[1:4]
        for (x2, y2) in near:
            if math.hypot(x2-x1, y2-y1) < r * 0.62 * links / 2:
                out += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{lc}" stroke-opacity="{".28" if dark else ".25"}" stroke-width="1.3"/>'
    for (x, y) in pts:
        s = rnd.choice([3.5, 4.5, 6, 8])
        out += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{s*2.4:.1f}" fill="url(#gGlow)"/>'
        out += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{s}" fill="url(#gNode)"/>'
    return out


def brain_layers(x, y, w, h, layers=(3, 5, 5, 2), dark=True):
    """A small neural-net diagram: columns of nodes, fully connected."""
    cols = []
    for i, n in enumerate(layers):
        cx = x + w * i / (len(layers) - 1)
        cols.append([(cx, y + h * (j + 1) / (n + 1)) for j in range(n)])
    lc = "#FFFFFF" if dark else BLUE
    out = ""
    for a, b in zip(cols, cols[1:]):
        for (x1, y1) in a:
            for (x2, y2) in b:
                out += f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" stroke="{lc}" stroke-opacity=".2" stroke-width="1.2"/>'
    for ci, col in enumerate(cols):
        for (cx, cy) in col:
            out += f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="17" fill="url(#gGlow)"/>'
            out += f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="8.5" fill="{"url(#gNode)" if ci % 2 == 0 else WHITE}" stroke="{BLUE_LIGHT}" stroke-width="2"/>'
    return out


def bar_chart(x, y, w, h, values, dark=False):
    n = len(values)
    bw = w / n * 0.58
    out = ""
    for i in range(4):
        gy = y + h * i / 3
        out += f'<rect x="{x}" y="{gy:.0f}" width="{w}" height="1" fill="{"#FFFFFF" if dark else "#C9D2DE"}" fill-opacity="{".12" if dark else ".8"}"/>'
    for i, v in enumerate(values):
        bh = h * v
        bx = x + w * i / n + (w / n - bw) / 2
        out += f'<rect x="{bx:.0f}" y="{y+h-bh:.0f}" width="{bw:.0f}" height="{bh:.0f}" rx="5" fill="url(#gBar)" fill-opacity="{1 if i == n-2 else .75}"/>'
    return out


def line_chart(x, y, w, h, values, dark=False, fill=True):
    pts = [(x + w * i / (len(values) - 1), y + h * (1 - v)) for i, v in enumerate(values)]
    d = "M" + " L".join(f"{px:.0f} {py:.0f}" for px, py in pts)
    out = ""
    if fill:
        out += f'<path d="{d} L{x+w} {y+h} L{x} {y+h}Z" fill="{BLUE_LIGHT}" fill-opacity=".18"/>'
    out += f'<path d="{d}" fill="none" stroke="{BLUE_LIGHT if dark else BLUE}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>'
    px, py = pts[-1]
    out += f'<circle cx="{px:.0f}" cy="{py:.0f}" r="7" fill="{WHITE}" stroke="{BLUE}" stroke-width="3"/>'
    return out


def donut(cx, cy, r, frac, dark=False, label=None):
    c = math.tau * r
    out = (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{"#FFFFFF" if dark else SILVER_LIGHT}" stroke-opacity="{".15" if dark else "1"}" stroke-width="{r*0.32:.0f}"/>'
           f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="url(#gBlue)" stroke-width="{r*0.32:.0f}" stroke-linecap="round" '
           f'stroke-dasharray="{c*frac:.1f} {c:.1f}" transform="rotate(-90 {cx} {cy})"/>')
    if label:
        out += text(cx, cy + r * 0.2, label, r * 0.55, WHITE if dark else INK, 800, "middle")
    return out


def chat(x, y, w, h, side="left", dark=False, seed=2, rows=2):
    tail = (f'M{x+18} {y+h} l-8 14 l22 -14Z' if side == "left" else f'M{x+w-18} {y+h} l8 14 l-22 -14Z')
    fill = WHITE if side == "left" else "url(#gBlue)"
    out = f'<g filter="url(#fShadowLight)"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{fill}"/><path d="{tail}" fill="{WHITE if side == "left" else BLUE}"/></g>'
    rnd = random.Random(seed)
    for i in range(rows):
        lw = (w - 36) * (1 if i < rows - 1 else rnd.uniform(.45, .75))
        out += f'<rect x="{x+18}" y="{y+18+i*16}" width="{lw:.0f}" height="7" rx="3.5" fill="{SILVER if side == "left" else WHITE}" fill-opacity="{".9" if side == "left" else ".8"}"/>'
    return out


def avatar(cx, cy, r, tone=0, ring=True, bg="#DCE8F6"):
    tones = [("#F2C9A5", "#3A2A20"), ("#C98E62", "#1E1612"), ("#E8B996", "#5B3A22"), ("#8D5A3B", "#151010")]
    skin, hair = tones[tone % len(tones)]
    shirt = [BLUE, NAVY, BLUE_MID, "#3B4756"][tone % 4]
    cid = f"av{int(cx)}_{int(cy)}_{tone}"
    out = f'<defs><clipPath id="{cid}"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath></defs>'
    if bg:
        out += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{bg}"/>'
    out += f'<g clip-path="url(#{cid})">'
    out += f'<ellipse cx="{cx}" cy="{cy+r*0.98}" rx="{r*0.78}" ry="{r*0.55}" fill="{shirt}"/>'
    out += f'<rect x="{cx-r*0.13}" y="{cy+r*0.12}" width="{r*0.26}" height="{r*0.3}" fill="{skin}"/>'
    out += f'<circle cx="{cx}" cy="{cy-r*0.12}" r="{r*0.36}" fill="{skin}"/>'
    if tone % 2:
        out += f'<path d="M{cx-r*0.38} {cy-r*0.1} q{r*0.05} {-r*0.55} {r*0.38} {-r*0.5} q{r*0.36} {-r*0.04} {r*0.38} {r*0.5} q{-r*0.2} {-r*0.3} {-r*0.38} {-r*0.26} q{-r*0.2} 0 {-r*0.38} {r*0.26}Z" fill="{hair}"/>'
    else:
        out += f'<path d="M{cx-r*0.42} {cy+r*0.25} q{-r*0.05} {-r*0.85} {r*0.42} {-r*0.78} q{r*0.47} {r*0.07} {r*0.42} {r*0.78} l0 {r*0.1} q{-r*0.1} {-r*0.55} {-r*0.42} {-r*0.6} q{-r*0.32} {r*0.05} {-r*0.42} {r*0.5}Z" fill="{hair}"/>'
    out += "</g>"
    if ring:
        out += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{WHITE}" stroke-width="{max(2, r*0.08):.1f}"/>'
    return out


def badge_icon(cx, cy, r, glyph, dark=False):
    """Round icon tile with a simple glyph: cap, calendar, case, rocket, shield, chat, code, chart, check, headset, bolt."""
    out = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#gBlue)"/>'
    out += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#FFFFFF" stroke-opacity=".35" stroke-width="2"/>'
    s = r * 0.5
    g = glyph_path(glyph, cx, cy, s)
    return out + f'<g fill="none" stroke="#FFFFFF" stroke-width="{max(2, r*0.09):.1f}" stroke-linecap="round" stroke-linejoin="round">{g}</g>'


def glyph_path(glyph, cx, cy, s):
    if glyph == "cap":
        return (f'<path d="M{cx-s} {cy-s*0.2} L{cx} {cy-s*0.7} L{cx+s} {cy-s*0.2} L{cx} {cy+s*0.3}Z"/>'
                f'<path d="M{cx-s*0.55} {cy+0.05*s} v{s*0.45} q{s*0.55} {s*0.35} {s*1.1} 0 v{-s*0.45}"/>'
                f'<path d="M{cx+s} {cy-s*0.2} v{s*0.7}"/>')
    if glyph == "calendar":
        return (f'<rect x="{cx-s*0.85}" y="{cy-s*0.6}" width="{s*1.7}" height="{s*1.45}" rx="{s*0.2}"/>'
                f'<path d="M{cx-s*0.85} {cy-s*0.15} h{s*1.7} M{cx-s*0.4} {cy-s*0.85} v{s*0.45} M{cx+s*0.4} {cy-s*0.85} v{s*0.45}"/>')
    if glyph == "case":
        return (f'<rect x="{cx-s*0.9}" y="{cy-s*0.4}" width="{s*1.8}" height="{s*1.2}" rx="{s*0.18}"/>'
                f'<path d="M{cx-s*0.35} {cy-s*0.4} v{-s*0.3} h{s*0.7} v{s*0.3} M{cx-s*0.9} {cy+s*0.05} h{s*1.8}"/>')
    if glyph == "rocket":
        return (f'<path d="M{cx} {cy-s} q{s*0.6} {s*0.5} {s*0.45} {s*1.25} h{-s*0.9} q{-s*0.15} {-s*0.75} {s*0.45} {-s*1.25}Z"/>'
                f'<circle cx="{cx}" cy="{cy-s*0.3}" r="{s*0.18}"/><path d="M{cx-s*0.2} {cy+s*0.5} l-{s*0.1} {s*0.45} M{cx+s*0.2} {cy+s*0.5} l{s*0.1} {s*0.45}"/>')
    if glyph == "shield":
        return f'<path d="M{cx} {cy-s} l{s*0.85} {s*0.32} v{s*0.5} q0 {s*0.75} {-s*0.85} {s*1.1} q{-s*0.85} {-s*0.35} {-s*0.85} {-s*1.1} v{-s*0.5}Z"/><path d="M{cx-s*0.35} {cy} l{s*0.25} {s*0.25} l{s*0.45} {-s*0.5}"/>'
    if glyph == "chat":
        return f'<path d="M{cx-s*0.9} {cy-s*0.6} h{s*1.8} v{s*1.1} h{-s*1.1} l{-s*0.45} {s*0.4} v{-s*0.4} h{-s*0.25}Z"/>'
    if glyph == "code":
        return f'<path d="M{cx-s*0.35} {cy-s*0.6} l{-s*0.55} {s*0.6} l{s*0.55} {s*0.6} M{cx+s*0.35} {cy-s*0.6} l{s*0.55} {s*0.6} l{-s*0.55} {s*0.6}"/>'
    if glyph == "chart":
        return f'<path d="M{cx-s*0.85} {cy+s*0.8} v{-s*1.6} M{cx-s*0.85} {cy+s*0.8} h{s*1.7} M{cx-s*0.5} {cy+s*0.3} l{s*0.45} {-s*0.45} l{s*0.35} {s*0.3} l{s*0.5} {-s*0.65}"/>'
    if glyph == "check":
        return f'<path d="M{cx-s*0.6} {cy} l{s*0.4} {s*0.42} l{s*0.85} {-s*0.85}"/>'
    if glyph == "headset":
        return (f'<path d="M{cx-s*0.8} {cy+s*0.2} v{-s*0.2} a{s*0.8} {s*0.8} 0 0 1 {s*1.6} 0 v{s*0.2}"/>'
                f'<rect x="{cx-s*0.95}" y="{cy+s*0.05}" width="{s*0.4}" height="{s*0.6}" rx="{s*0.12}"/><rect x="{cx+s*0.55}" y="{cy+s*0.05}" width="{s*0.4}" height="{s*0.6}" rx="{s*0.12}"/>')
    if glyph == "bolt":
        return f'<path d="M{cx+s*0.15} {cy-s} l{-s*0.7} {s*1.1} h{s*0.55} l{-s*0.15} {s*0.9} l{s*0.7} {-s*1.1} h{-s*0.55}Z"/>'
    if glyph == "users":
        return (f'<circle cx="{cx-s*0.3}" cy="{cy-s*0.35}" r="{s*0.32}"/><path d="M{cx-s*0.95} {cy+s*0.75} q{s*0.1} {-s*0.75} {s*0.65} {-s*0.75} q{s*0.55} 0 {s*0.65} {s*0.75}"/>'
                f'<circle cx="{cx+s*0.45}" cy="{cy-s*0.2}" r="{s*0.26}"/><path d="M{cx+s*0.2} {cy+s*0.25} q{s*0.25} {-s*0.15} {s*0.5} 0 q{s*0.35} {s*0.15} {s*0.35} {s*0.5}"/>')
    return ""


def window_code(x, y, w, h, dark=True, seed=4, title=None):
    out = card(x, y, w, h, dark=dark)
    if title:
        out += text(x + w - 16, y + 22, title, 11, WHITE if dark else "#6B7685", 700, "end", .7)
    rows = int((h - 60) / 18)
    # gutter numbers
    for i in range(rows):
        out += f'<rect x="{x+16}" y="{y+50+i*18}" width="12" height="6" rx="3" fill="{SILVER}" fill-opacity=".35"/>'
    out += bars(x + 40, y + 50, rows, w - 60, dark=dark, seed=seed, gap=18)
    return out


def sparkle(cx, cy, s, fill=WHITE, op=.9):
    return f'<path d="M{cx} {cy-s} Q{cx+s*0.18} {cy-s*0.18} {cx+s} {cy} Q{cx+s*0.18} {cy+s*0.18} {cx} {cy+s} Q{cx-s*0.18} {cy+s*0.18} {cx-s} {cy} Q{cx-s*0.18} {cy-s*0.18} {cx} {cy-s}Z" fill="{fill}" fill-opacity="{op}"/>'


def logo_mark(x, y, h, mark_href):
    """The real Rivira Tech R/V mark, embedded as an image (898x530 aspect)."""
    w = h * 898 / 530
    return f'<image href="{mark_href}" x="{x}" y="{y}" width="{w:.1f}" height="{h}"/>'
