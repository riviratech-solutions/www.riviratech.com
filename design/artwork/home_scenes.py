"""Home page artwork for the indigo / violet redesign (2026-11).

Imported by scenes.py; outputs go to public/images/home/.
"""
import random

from kit import NAVY, NAVY_DEEP, WHITE, avatar, bars, card, chat, sparkle, svg, text


def _lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def quad(q, u, v):
    """Point at (u, v) inside the quad q = (top-left, top-right, bottom-right, bottom-left)."""
    tl, tr, br, bl = q
    return _lerp(_lerp(tl, tr, u), _lerp(bl, br, u), v)


def qpoly(q, u0, v0, u1, v1):
    pts = [quad(q, u0, v0), quad(q, u1, v0), quad(q, u1, v1), quad(q, u0, v1)]
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)


DEFS = """
<linearGradient id="hDeck" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2E2A86"/><stop offset="1" stop-color="#14124A"/></linearGradient>
<linearGradient id="hScreen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B1760"/><stop offset=".6" stop-color="#2A1E8C"/><stop offset="1" stop-color="#4C2BBF"/></linearGradient>
<linearGradient id="hRing" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3B7BFF"/><stop offset=".5" stop-color="#8B5CF6"/><stop offset="1" stop-color="#3B7BFF"/></linearGradient>
<linearGradient id="hChip" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4F6BFF"/><stop offset="1" stop-color="#7C3AED"/></linearGradient>
<radialGradient id="hGlow"><stop offset="0" stop-color="#7C5CFF" stop-opacity=".75"/><stop offset="1" stop-color="#7C5CFF" stop-opacity="0"/></radialGradient>
<radialGradient id="hGlowBlue"><stop offset="0" stop-color="#3B7BFF" stop-opacity=".6"/><stop offset="1" stop-color="#3B7BFF" stop-opacity="0"/></radialGradient>
<filter id="hBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="hBlurSm" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>
"""


def register(scene):
    def home(name):
        return f"public/images/home/{name}"

    @scene(home("hero-laptop.webp"), 1200, 1000, transparent=True, size=(900, 750))
    def home_laptop():
        b = DEFS
        # platform: glow + rings
        b += '<ellipse cx="600" cy="800" rx="520" ry="170" fill="url(#hGlow)" filter="url(#hBlur)"/><ellipse cx="600" cy="560" rx="420" ry="360" fill="url(#hGlowBlue)" opacity=".45"/>'
        for i, (rx, ry, op, sw) in enumerate([(470, 128, .95, 7), (400, 104, .55, 3), (330, 82, .35, 2), (540, 152, .25, 2)]):
            b += f'<ellipse cx="600" cy="800" rx="{rx}" ry="{ry}" fill="none" stroke="url(#hRing)" stroke-opacity="{op}" stroke-width="{sw}"/>'
        b += '<ellipse cx="600" cy="800" rx="470" ry="128" fill="none" stroke="#9DB4FF" stroke-width="16" stroke-opacity=".35" filter="url(#hBlurSm)"/>'
        # laptop deck
        deck = ((395, 585), (965, 645), (1060, 760), (245, 690))
        b += f'<polygon points="{qpoly(deck, 0, 0, 1, 1)}" fill="url(#hDeck)" stroke="#9DB4FF" stroke-opacity=".6" stroke-width="2"/>'
        b += f'<polygon points="{qpoly(deck, 0, .96, 1, 1.07)}" fill="#0E0C36"/>'
        # keyboard keys and touchpad
        rows, cols = 5, 14
        for r in range(rows):
            for c in range(cols):
                u0 = .07 + c * (.86 / cols); v0 = .1 + r * (.5 / rows)
                b += f'<polygon points="{qpoly(deck, u0 + .006, v0 + .02, u0 + .86 / cols - .006, v0 + .5 / rows - .02)}" fill="#1E1A5E" stroke="#6D7CFF" stroke-opacity=".35" stroke-width="1"/>'
        b += f'<polygon points="{qpoly(deck, .38, .68, .62, .92)}" fill="#25206F" stroke="#7C9CFF" stroke-opacity=".4"/>'
        # screen (hinged on the deck's back edge)
        scr = ((470, 150), (1060, 225), (965, 645), (395, 585))
        b += f'<polygon points="{qpoly(scr, -.02, -.02, 1.02, 1.0)}" fill="#0E0C36" stroke="#9DB4FF" stroke-opacity=".7" stroke-width="3"/>'
        b += f'<polygon points="{qpoly(scr, .03, .04, .97, .95)}" fill="url(#hScreen)"/>'
        rnd = random.Random(4)
        for r in range(12):
            v = .1 + r * .065
            u = .07
            while u < .3:
                w = rnd.uniform(.03, .09)
                b += f'<polygon points="{qpoly(scr, u, v, min(u + w, .32), v + .022)}" fill="{rnd.choice(["#7C9CFF", "#A78BFA", "#C7D2FE"])}" fill-opacity=".55"/>'
                u += w + .015
            u = .72
            while u < .93:
                w = rnd.uniform(.03, .07)
                b += f'<polygon points="{qpoly(scr, u, v, min(u + w, .94), v + .022)}" fill="{rnd.choice(["#7C9CFF", "#A78BFA"])}" fill-opacity=".45"/>'
                u += w + .015
        # AI chip in the middle of the screen
        cx, cy = quad(scr, .52, .5)
        b += f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="150" fill="url(#hGlow)"/>'
        for k in range(6):
            off = -66 + k * 26.4
            for (x1, y1, x2, y2) in [(cx + off, cy - 92, cx + off, cy - 112), (cx + off, cy + 92, cx + off, cy + 112), (cx - 92, cy + off, cx - 112, cy + off), (cx + 92, cy + off, cx + 112, cy + off)]:
                b += f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" stroke="#A5B4FC" stroke-width="5" stroke-linecap="round"/>'
        b += f'<rect x="{cx-92:.0f}" y="{cy-92:.0f}" width="184" height="184" rx="28" fill="url(#hChip)" stroke="#C7D2FE" stroke-width="4"/>'
        b += f'<rect x="{cx-72:.0f}" y="{cy-72:.0f}" width="144" height="144" rx="20" fill="none" stroke="#FFFFFF" stroke-opacity=".35" stroke-width="2"/>'
        b += text(cx, cy + 34, "AI", 96, WHITE, 800, "middle")
        for (x, y, s_) in [(260, 260, 14), (1040, 120, 10), (180, 520, 9), (1120, 520, 12)]:
            b += sparkle(x, y, s_, fill="#C7D2FE", op=.8)
        return svg(1200, 1000, b)

    @scene(home("about-team.webp"), 1100, 800, size=(880, 640))
    def home_team():
        w, h = 1100, 800
        b = DEFS
        b += '<defs><linearGradient id="tBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5B8CFF"/><stop offset=".55" stop-color="#7C6BFF"/><stop offset="1" stop-color="#A78BFA"/></linearGradient></defs>'
        b += f'<rect width="{w}" height="{h}" rx="40" fill="url(#tBg)"/>'
        b += f'<rect width="{w}" height="{h}" rx="40" fill="url(#pDots)"/>'
        b += '<circle cx="880" cy="160" r="260" fill="#FFFFFF" fill-opacity=".12"/><circle cx="140" cy="700" r="220" fill="#FFFFFF" fill-opacity=".08"/>'
        # three learners around one laptop
        b += avatar(300, 430, 180, tone=1, ring=False, bg=None) + avatar(810, 430, 180, tone=3, ring=False, bg=None) + avatar(555, 380, 200, tone=0, ring=False, bg=None)
        # laptop
        b += f'<path d="M330 640 L780 640 L840 760 L270 760Z" fill="#E7EBFF"/><rect x="380" y="470" width="350" height="190" rx="14" fill="#DDE3FF" stroke="#FFFFFF" stroke-width="6"/>'
        b += '<rect x="400" y="490" width="310" height="150" rx="8" fill="#1B1760"/>'
        b += bars(420, 510, 6, 270, dark=True, seed=12, gap=20)
        return svg(w, h, b)

    @scene(home("career.webp"), 1100, 820, transparent=True, size=(880, 656))
    def home_career():
        b = DEFS
        b += '<circle cx="520" cy="420" r="330" fill="url(#hGlow)"/>'
        b += '<circle cx="520" cy="430" r="250" fill="none" stroke="#A78BFA" stroke-opacity=".5" stroke-width="3"/>'
        rnd = random.Random(8)
        for (x, wdt, ht) in [(110, 120, 420), (250, 90, 300), (760, 110, 460), (880, 80, 340), (980, 100, 260)]:
            b += f'<rect x="{x}" y="{820-ht}" width="{wdt}" height="{ht}" fill="#1C1760" stroke="#6D5CFF" stroke-opacity=".5"/>'
            for yy in range(820 - ht + 20, 800, 26):
                for xx in range(x + 14, x + wdt - 10, 22):
                    if rnd.random() < .45:
                        b += f'<rect x="{xx}" y="{yy}" width="8" height="12" fill="{rnd.choice(["#7C9CFF", "#A78BFA", "#C7D2FE"])}" fill-opacity=".8"/>'
        # learner with headphones round the neck
        b += '<circle cx="520" cy="540" r="300" fill="#2A1F8F"/>'
        b += avatar(520, 540, 300, tone=1, ring=False, bg=None)
        # headphones resting round the neck
        b += '<path d="M418 690 q102 64 204 0" fill="none" stroke="#0B0A2E" stroke-width="30" stroke-linecap="round"/>'
        b += '<rect x="384" y="650" width="64" height="86" rx="24" fill="#14124A" stroke="#7C9CFF" stroke-opacity=".5" stroke-width="3"/>'
        b += '<rect x="592" y="650" width="64" height="86" rx="24" fill="#14124A" stroke="#7C9CFF" stroke-opacity=".5" stroke-width="3"/>'
        return svg(1100, 820, b)

    @scene(home("faq-bubbles.webp"), 760, 600, transparent=True, size=(570, 450))
    def home_faq():
        b = DEFS
        b += '<circle cx="380" cy="320" r="230" fill="url(#hGlow)" opacity=".55"/>'
        # main bubble with a question mark
        b += '<g filter="url(#fShadowLight)"><path d="M380 130 a170 160 0 1 1 -110 290 l-80 46 l30 -86 a170 160 0 0 1 160 -250z" fill="url(#hChip)"/></g>'
        b += text(390, 370, "?", 220, WHITE, 800, "middle")
        # small chat bubbles with dots
        for (x, y, wd, cols) in [(60, 120, 170, ["#6D5CFF", "#6D5CFF", "#6D5CFF"]), (560, 80, 170, ["#3B7BFF", "#3B7BFF", "#3B7BFF"]), (40, 430, 200, ["#F87171", "#6D5CFF", "#A78BFA"])]:
            b += f'<g filter="url(#fShadowLight)"><rect x="{x}" y="{y}" width="{wd}" height="96" rx="24" fill="#FFFFFF"/></g>'
            for i, c in enumerate(cols):
                b += f'<rect x="{x + 28 + i * 44}" y="{y + 30}" width="32" height="12" rx="6" fill="{c}"/>'
                b += f'<rect x="{x + 28 + i * 44}" y="{y + 54}" width="32" height="12" rx="6" fill="{c}" fill-opacity=".6"/>'
        b += sparkle(640, 330, 16, fill="#8B5CF6", op=.8) + sparkle(120, 330, 12, fill="#3B7BFF", op=.8)
        return svg(760, 600, b)
