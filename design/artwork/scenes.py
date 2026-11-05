"""Rivira Tech illustration set: one function per image the site serves.

    python design/artwork/scenes.py         -> design/artwork/svg/*.svg + manifest.json
    node design/artwork/render.cjs          -> renders them into public/ (needs puppeteer-core)

Each entry names the file it replaces, so pages need no code changes.
"""
import base64
import json
import pathlib
import random

from kit import (BLUE, BLUE_LIGHT, BLUE_MID, NAVY, SILVER, SKY, WHITE, INK, avatar, badge_icon, bar_chart, bars,
                 bg_dark, bg_light, brain_layers, card, chat, donut, line_chart, logo_mark, network, pill, sparkle,
                 svg, text, window_code)

HERE = pathlib.Path(__file__).parent
MARK = "data:image/png;base64," + base64.b64encode((HERE / "assets" / "rivira-mark.png").read_bytes()).decode()
SCENES = []


def scene(out, w, h, fmt="webp", quality=86, transparent=False, size=None):
    """Register a scene. size=(w, h) is the served size if it differs from the drawing size."""
    def wrap(fn):
        SCENES.append(dict(name=fn.__name__, out=out, w=w, h=h, fmt=fmt, quality=quality,
                           transparent=transparent, size=size or (w, h), fn=fn))
        return fn
    return wrap


# =============================================================== website cards
@scene("public/images/hero-home-card.webp", 1920, 1080, quality=84)
def hero_home():
    w, h = 1920, 1080
    b = bg_dark(w, h, glows=((0.8, 0.35, 0.42), (0.18, 0.7, 0.38), (0.5, 0.05, 0.25)))
    b += network(1500, 470, 330, n=40, seed=11)
    b += network(330, 640, 230, n=22, seed=5)
    b += window_code(120, 160, 470, 300, dark=True, seed=8, title="agent.py")
    b += card(1320, 700, 460, 250, dark=True)
    b += line_chart(1350, 760, 400, 150, [.2, .35, .3, .5, .46, .7, .66, .88], dark=True)
    b += text(1350, 940, "Model accuracy", 15, WHITE, 600, opacity=.7)
    b += chat(220, 560, 330, 74, "left", seed=3)
    b += chat(330, 655, 300, 74, "right", seed=4)
    for i, lab in enumerate(["LLMs", "RAG", "Agents", "Python", "Cloud AI"]):
        x = [1240, 1650, 1260, 1700, 1460][i]; y = [190, 230, 850, 640, 120][i]
        b += pill(x, y, lab, dark=True, size=15)
    for (x, y, s) in [(940, 140, 12), (1100, 980, 9), (720, 920, 14), (840, 250, 7)]:
        b += sparkle(x, y, s, op=.55)
    return svg(w, h, b)


@scene("public/images/hero-about-card.webp", 1600, 900, size=(800, 450))
def hero_about():
    w, h = 1600, 900
    b = bg_light(w, h, glows=((0.5, 0.45, 0.5),))
    b += network(800, 430, 360, n=26, seed=21, dark=False)
    b += card(470, 250, 660, 420)
    b += window_code(500, 300, 360, 340, dark=True, seed=12, title="rag_pipeline.py")
    b += chat(890, 320, 210, 70, "left", seed=9)
    b += chat(890, 410, 210, 70, "right", seed=10)
    b += pill(890, 520, "Live mentor review", w=210, size=14)
    b += pill(890, 570, "Project: RAG bot", w=210, size=14)
    for i, (x, y, r, t) in enumerate([(260, 300, 90, 0), (270, 620, 78, 1), (1340, 290, 84, 2), (1330, 610, 92, 3)]):
        b += f'<circle cx="{x}" cy="{y}" r="{r+28}" fill="url(#gGlowSoft)"/>' + avatar(x, y, r, tone=t)
        b += f'<line x1="{x + (r if x < 800 else -r)}" y1="{y}" x2="{470 if x < 800 else 1130}" y2="{y + (0 if i % 2 else 20)}" stroke="{BLUE}" stroke-opacity=".35" stroke-width="2" stroke-dasharray="6 7"/>'
    b += badge_icon(1170, 250, 42, "cap") + badge_icon(430, 690, 38, "check")
    return svg(w, h, b)


@scene("public/images/hero-projects-card.webp", 1600, 900, size=(800, 450))
def hero_projects():
    w, h = 1600, 900
    b = bg_dark(w, h, glows=((0.3, 0.3, 0.45), (0.85, 0.85, 0.35)))
    b += card(110, 110, 860, 680, dark=True)
    b += text(150, 190, "AI project dashboard", 26, WHITE, 800)
    b += text(150, 222, "Proof-of-concept · week 3", 16, WHITE, 500, opacity=.6)
    for i, (lab, val) in enumerate([("Users", "12.4k"), ("Latency", "180ms"), ("Accuracy", "94%")]):
        x = 150 + i * 268
        b += f'<rect x="{x}" y="260" width="245" height="110" rx="14" fill="#FFFFFF" fill-opacity=".06" stroke="#FFFFFF" stroke-opacity=".1"/>'
        b += text(x + 22, 300, lab, 15, WHITE, 600, opacity=.6) + text(x + 22, 345, val, 34, WHITE, 800)
    b += line_chart(150, 420, 780, 320, [.25, .32, .28, .45, .42, .58, .55, .72, .69, .86], dark=True)
    b += card(1030, 110, 460, 330, dark=True)
    b += text(1065, 185, "Tokens by model", 18, WHITE, 700, opacity=.85)
    b += bar_chart(1065, 215, 390, 190, [.45, .7, .55, .9, .65, .8], dark=True)
    b += card(1030, 470, 460, 320, dark=True)
    b += donut(1170, 630, 88, .74, dark=True, label="74%")
    b += text(1300, 600, "Tasks", 18, WHITE, 700, opacity=.85) + text(1300, 632, "automated", 18, WHITE, 500, opacity=.6)
    b += pill(1300, 665, "On track", dark=True, size=14)
    return svg(w, h, b)


@scene("public/images/hero-courses-card.webp", 1600, 900, size=(800, 450))
def hero_courses():
    w, h = 1600, 900
    b = bg_light(w, h, glows=((0.2, 0.3, 0.45), (0.85, 0.8, 0.4)))
    path = "M140 720 C 420 720 420 470 700 470 S 980 230 1260 230 S 1460 180 1500 150"
    b += f'<path d="{path}" fill="none" stroke="{BLUE}" stroke-opacity=".25" stroke-width="10" stroke-linecap="round"/>'
    b += f'<path d="{path}" fill="none" stroke="url(#gBlue)" stroke-width="10" stroke-linecap="round" stroke-dasharray="1500 3000"/>'
    steps = [(140, 720, "01", "Python & data"), (520, 560, "02", "Machine learning"), (900, 380, "03", "LLMs & RAG"), (1260, 230, "04", "Agents & deploy")]
    for i, (x, y, n, lab) in enumerate(steps):
        b += f'<circle cx="{x}" cy="{y}" r="34" fill="url(#gGlowSoft)"/><circle cx="{x}" cy="{y}" r="16" fill="{WHITE}" stroke="{BLUE}" stroke-width="6"/>'
        cx, cy = x - 20, y - 230 if i < 3 else y + 60
        b += card(cx, cy, 300, 170, header=False)
        b += text(cx + 24, cy + 52, n, 34, BLUE, 800) + text(cx + 24, cy + 92, lab, 22, INK, 700)
        prog = [1, 1, .6, .15][i]
        b += f'<rect x="{cx+24}" y="{cy+120}" width="252" height="10" rx="5" fill="#E6ECF4"/><rect x="{cx+24}" y="{cy+120}" width="{252*prog:.0f}" height="10" rx="5" fill="url(#gBlue)"/>'
    b += badge_icon(1460, 640, 70, "cap") + badge_icon(1300, 760, 44, "check")
    return svg(w, h, b)


@scene("public/images/hero-events-card.webp", 1600, 900, size=(800, 450))
def hero_events():
    w, h = 1600, 900
    b = bg_dark(w, h, glows=((0.5, 0.25, 0.55),))
    b += f'<rect x="330" y="90" width="940" height="470" rx="22" fill="#0C2A58" stroke="#FFFFFF" stroke-opacity=".15" filter="url(#fShadow)"/>'
    b += brain_layers(470, 150, 520, 330)
    b += text(1060, 210, "Free AI", 40, WHITE, 800) + text(1060, 258, "Workshop", 40, WHITE, 800)
    b += text(1060, 300, "Build your first", 20, WHITE, 500, opacity=.7) + text(1060, 328, "GenAI app live", 20, WHITE, 500, opacity=.7)
    b += pill(1060, 360, "Live session", dark=True, size=16)
    rnd = random.Random(7)
    for row in range(3):
        for col in range(11):
            x = 170 + col * 125 + (row % 2) * 60
            y = 680 + row * 80
            if x > 1500:
                continue
            b += avatar(x, y, 30 + row * 2, tone=rnd.randint(0, 3), ring=False)
    b += f'<rect x="0" y="830" width="{w}" height="70" fill="{NAVY}" fill-opacity=".6"/>'
    b += badge_icon(1420, 160, 62, "calendar") + badge_icon(200, 200, 48, "users")
    return svg(w, h, b)


@scene("public/images/career-card.webp", 1600, 900, size=(800, 450))
def career():
    w, h = 1600, 900
    b = bg_light(w, h, glows=((0.75, 0.3, 0.5),))
    for i in range(6):
        x = 640 + i * 140
        bh = 120 + i * 95
        b += f'<rect x="{x}" y="{820-bh}" width="110" height="{bh}" rx="14" fill="url(#gBar)" fill-opacity="{.35 + i*0.12:.2f}"/>'
    b += f'<path d="M620 690 C 900 640 1100 420 1450 180" fill="none" stroke="{NAVY}" stroke-width="9" stroke-linecap="round"/>'
    b += f'<path d="M1450 180 l-58 6 m58 -6 l-14 56" fill="none" stroke="{NAVY}" stroke-width="9" stroke-linecap="round"/>'
    b += card(130, 170, 420, 540, header=False)
    b += avatar(340, 300, 82, tone=2)
    b += text(340, 430, "AI Engineer", 30, INK, 800, "middle") + text(340, 464, "Portfolio ready", 18, "#6B7685", 600, "middle")
    for i, lab in enumerate(["RAG chatbot project", "Agent workflow demo", "Mock interview passed"]):
        y = 510 + i * 56
        b += f'<circle cx="185" cy="{y}" r="14" fill="url(#gBlue)"/><path d="M178 {y} l5 5 l10 -10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>'
        b += text(212, y + 6, lab, 18, INK, 600)
    b += badge_icon(1450, 560, 70, "case") + badge_icon(560, 150, 44, "rocket")
    return svg(w, h, b)


def _course_card(seed, motif):
    w, h = 1120, 964
    b = bg_dark(w, h, glows=((0.7, 0.35, 0.6), (0.2, 0.85, 0.4)))
    return w, h, b


@scene("public/images/corporate-training-card.webp", 1120, 964, size=(560, 482))
def corporate_training():
    w, h, b = _course_card(1, "team")
    b += card(300, 170, 520, 330, dark=True)
    b += bar_chart(340, 230, 300, 230, [.4, .62, .5, .85, .7], dark=True)
    b += donut(730, 340, 62, .82, dark=True, label="82%")
    pos = [(170, 640), (380, 760), (560, 640), (740, 760), (950, 640)]
    for i, (x, y) in enumerate(pos):
        b += f'<line x1="{x}" y1="{y}" x2="560" y2="500" stroke="#FFFFFF" stroke-opacity=".22" stroke-width="2" stroke-dasharray="5 7"/>'
    for i, (x, y) in enumerate(pos):
        b += f'<circle cx="{x}" cy="{y}" r="88" fill="url(#gGlow)"/>' + avatar(x, y, 62, tone=i)
    b += badge_icon(930, 170, 58, "users")
    return svg(w, h, b)


@scene("public/images/ai-for-coders-card.webp", 1120, 964, size=(560, 482))
def ai_for_coders():
    w, h, b = _course_card(2, "code")
    b += window_code(120, 150, 640, 520, dark=True, seed=31, title="main.py")
    b += f'<rect x="160" y="420" width="560" height="90" rx="10" fill="{BLUE_LIGHT}" fill-opacity=".14" stroke="{BLUE_LIGHT}" stroke-opacity=".5" stroke-dasharray="6 6"/>'
    b += text(180, 452, "AI suggestion", 16, BLUE_LIGHT, 700) + bars(180, 470, 2, 500, dark=True, seed=7, gap=16)
    b += chat(640, 640, 360, 90, "right", seed=5, rows=3)
    b += chat(560, 770, 300, 74, "left", seed=6)
    b += badge_icon(900, 220, 72, "code") + sparkle(980, 420, 22) + sparkle(1010, 360, 12, op=.6)
    return svg(w, h, b)


@scene("public/images/foundations-of-ai-card.webp", 1120, 964, size=(560, 482))
def foundations():
    w, h = 1120, 964
    b = bg_light(w, h, glows=((0.5, 0.45, 0.6),))
    b += card(110, 140, 900, 560)
    b += brain_layers(220, 220, 680, 400, layers=(4, 6, 6, 4, 2), dark=False)
    for i, lab in enumerate(["Python", "Machine learning", "Neural networks", "NLP"]):
        b += pill(120 + i * 228, 760, lab, w=214, size=16)
    b += badge_icon(980, 140, 62, "bolt")
    return svg(w, h, b)


@scene("public/images/genai-for-business-card.webp", 1120, 964, size=(560, 482))
def genai_business():
    w, h, b = _course_card(4, "business")
    b += chat(110, 150, 440, 96, "left", seed=11, rows=3)
    b += chat(330, 290, 400, 80, "right", seed=12)
    b += chat(110, 410, 380, 96, "left", seed=13, rows=3)
    b += card(560, 470, 450, 360, dark=True)
    b += text(595, 545, "Hours saved / week", 18, WHITE, 700, opacity=.85)
    b += bar_chart(595, 575, 380, 220, [.3, .45, .6, .72, .9], dark=True)
    b += badge_icon(880, 220, 70, "chat") + sparkle(1010, 120, 18)
    return svg(w, h, b)


# =============================================================== website art
@scene("public/images/counseling-3d-advisor.png", 896, 572, fmt="png", size=(448, 286))
def counseling():
    w, h = 896, 572
    b = bg_light(w, h, glows=((0.4, 0.5, 0.6),))
    b += f'<circle cx="330" cy="300" r="190" fill="url(#gGlowSoft)"/>'
    b += avatar(330, 290, 150, tone=1)
    b += f'<path d="M210 270 a120 120 0 0 1 240 0" fill="none" stroke="{NAVY}" stroke-width="16" stroke-linecap="round"/>'
    b += f'<rect x="190" y="262" width="34" height="62" rx="12" fill="{NAVY}"/><rect x="436" y="262" width="34" height="62" rx="12" fill="{NAVY}"/>'
    b += chat(540, 110, 300, 80, "left", seed=2)
    b += chat(580, 220, 260, 74, "right", seed=3)
    b += card(560, 340, 280, 160, header=False)
    b += badge_icon(615, 420, 34, "calendar") + text(665, 410, "Career call", 20, INK, 800) + text(665, 438, "Booked", 16, BLUE, 700)
    return svg(w, h, b)


@scene("public/images/pagenotfound.png", 1536, 1024, fmt="png")
def page_not_found():
    w, h = 1536, 1024
    b = bg_light(w, h, glows=((0.5, 0.45, 0.6),))
    b += network(768, 470, 520, n=34, seed=40, dark=False)
    b += (f'<text x="768" y="600" font-family="\'Plus Jakarta Sans\', Arial, sans-serif" font-size="360" font-weight="800" '
          f'text-anchor="middle" fill="url(#gBlue)" letter-spacing="-12">404</text>')
    b += f'<rect x="548" y="680" width="440" height="78" rx="39" fill="{WHITE}" filter="url(#fShadowLight)"/>'
    b += text(768, 731, "Page not found", 32, INK, 800, "middle")
    b += sparkle(330, 260, 26, fill=BLUE, op=.6) + sparkle(1200, 790, 20, fill=BLUE, op=.5)
    return svg(w, h, b)


@scene("public/images/login_side.png", 1024, 853, fmt="png")
def login_side():
    w, h = 1024, 853
    b = bg_dark(w, h, glows=((0.6, 0.35, 0.6),))
    b += card(240, 150, 520, 560, dark=False, header=False)
    b += logo_mark(290, 195, 46, MARK) + text(375, 228, "RIVIRA TECH", 24, INK, 800)
    for i, lab in enumerate(["Full name", "Email address", "Phone", "Your goal"]):
        y = 290 + i * 86
        b += text(290, y, lab, 15, "#6B7685", 700)
        b += f'<rect x="290" y="{y+12}" width="420" height="46" rx="10" fill="#F4F6FA" stroke="#DCE3EC"/>'
    b += f'<rect x="290" y="640" width="420" height="48" rx="10" fill="#212529"/>' + text(500, 671, "Submit", 18, WHITE, 700, "middle")
    b += badge_icon(780, 170, 50, "check") + avatar(220, 640, 62, tone=3)
    return svg(w, h, b)


@scene("public/images/malepic.jpg", 512, 512, fmt="jpeg", quality=90, size=(225, 225))
def male_pic():
    return svg(512, 512, f'<rect width="512" height="512" fill="#DCE8F6"/>' + avatar(256, 256, 256, tone=1, ring=False))


@scene("public/images/femalepic.jpg", 512, 512, fmt="jpeg", quality=90, size=(225, 225))
def female_pic():
    return svg(512, 512, f'<rect width="512" height="512" fill="#DCE8F6"/>' + avatar(256, 256, 256, tone=0, ring=False))


# =============================================================== panel art
@scene("public/images/signinpeoples.png", 1536, 1024, fmt="png")
def signin_people():
    # blended with "lighten" on the dark sign-in panel, so it is drawn on black
    w, h = 1536, 1024
    b = f'<rect width="{w}" height="{h}" fill="#000"/>'
    b += network(768, 420, 460, n=30, seed=51)
    b += card(470, 360, 600, 380, dark=True)
    b += window_code(500, 410, 300, 300, dark=True, seed=14)
    b += line_chart(830, 470, 210, 140, [.2, .4, .35, .6, .55, .85], dark=True)
    b += avatar(330, 640, 120, tone=1) + avatar(1200, 640, 120, tone=2)
    b += chat(220, 380, 230, 70, "left", seed=8) + chat(1080, 370, 240, 70, "right", seed=9)
    return svg(w, h, b)


@scene("public/images/signinbg.png", 1474, 1067, fmt="png")
def signin_bg():
    w, h = 1474, 1067
    b = bg_dark(w, h, glows=((0.8, 0.2, 0.5), (0.2, 0.9, 0.5)))
    for i in range(7):
        y = 420 + i * 70
        b += (f'<path d="M-50 {y} C 400 {y-160} 800 {y+140} 1550 {y-120}" fill="none" stroke="{BLUE_LIGHT}" '
              f'stroke-opacity="{.06 + i*0.025:.3f}" stroke-width="{2 + i*0.6:.1f}"/>')
    return svg(w, h, b)


@scene("public/images/liveclass-selection-art.png", 736, 196, fmt="png", transparent=True, size=(368, 98))
def liveclass_art():
    w, h = 736, 196
    b = f'<rect x="10" y="20" width="716" height="160" rx="26" fill="url(#gLight)" stroke="#DCE3EC"/>'
    b += badge_icon(120, 100, 52, "calendar") + badge_icon(260, 100, 44, "cap") + badge_icon(380, 100, 36, "chat")
    b += bars(450, 70, 4, 240, seed=3, gap=18)
    return svg(w, h, b)


@scene("public/images/trainer-icon.png", 92, 80, fmt="png", transparent=True, size=(46, 40))
def trainer_icon():
    b = f'<rect x="4" y="4" width="84" height="72" rx="16" fill="url(#gBlue)"/>'
    b += f'<g fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">'
    b += '<rect x="34" y="16" width="40" height="28" rx="4"/><path d="M42 52 l12 -8"/>'
    b += '<circle cx="26" cy="30" r="7"/><path d="M14 64 q2 -18 14 -18 q8 0 12 8 l12 -6"/></g>'
    return svg(92, 80, b)


@scene("public/images/idbg1.png", 640, 646, fmt="png", transparent=True, size=(320, 323))
def id_bg1():
    b = ""
    for r in range(0, 30):
        for c in range(0, 30):
            x, y = 640 - c * 22, r * 22
            d = ((c ** 2 + r ** 2) ** 0.5) / 30
            if d > 1:
                continue
            rad = 7 * (1 - d) + .6
            b += f'<circle cx="{x}" cy="{y}" r="{rad:.1f}" fill="{BLUE}" fill-opacity="{.55*(1-d)+.08:.2f}"/>'
    return svg(640, 646, b)


@scene("public/images/idbg2.png", 2980, 1773, fmt="png", transparent=True)
def id_bg2():
    rnd = random.Random(9)
    b = ""
    for i in range(170):
        x = 2980 - abs(rnd.gauss(0, 900))
        y = 1773 - abs(rnd.gauss(0, 650))
        s = rnd.uniform(40, 150)
        a = rnd.uniform(0, 6.28)
        import math
        pts = " ".join(f"{x+math.cos(a+k*2.1)*s:.0f},{y+math.sin(a+k*2.1)*s:.0f}" for k in range(3))
        col = rnd.choice([BLUE, BLUE_MID, BLUE_LIGHT, SKY, SILVER])
        b += f'<polygon points="{pts}" fill="{col}" fill-opacity="{rnd.uniform(.12, .55):.2f}"/>'
    return svg(2980, 1773, b)


# =============================================================== logos
def lockup(text_fill, w, h):
    """The R/V mark beside a stacked RIVIRA / TECH, at the aspect of the logo file it replaces."""
    mh = h * 0.6
    mw = mh * 898 / 530
    tx = mw + h * 0.08
    fs = h * 0.3
    b = logo_mark(0, (h - mh) / 2, mh, MARK)
    b += text(tx, h * 0.5, "RIVIRA", fs, text_fill, 800, spacing=-fs * 0.02)
    b += text(tx + fs * 0.02, h * 0.5 + fs * 0.92, "TECH", fs * 0.78, text_fill, 700, spacing=fs * 0.2, opacity=.85)
    return svg(w, h, b)


@scene("public/images/logo_mark_dark.png", 948, 418, fmt="png", transparent=True)
def logo_dark():
    return lockup(INK, 948, 418)


@scene("public/images/logo_transparent.png", 1839, 790, fmt="png", transparent=True)
def logo_white():
    return lockup(WHITE, 1839, 790)


@scene("public/images/flogo.png", 1838, 781, fmt="png", transparent=True)
def logo_footer():
    return lockup(WHITE, 1838, 781)


# =============================================================== certificate seal
@scene("public/certicates/rivira-stamp.png", 800, 800, fmt="png", transparent=True)
def stamp():
    import math
    cx = cy = 400
    b = f'<circle cx="{cx}" cy="{cy}" r="380" fill="{NAVY}"/>'
    b += f'<circle cx="{cx}" cy="{cy}" r="352" fill="none" stroke="{SILVER}" stroke-width="6"/>'
    b += f'<circle cx="{cx}" cy="{cy}" r="250" fill="none" stroke="{SILVER}" stroke-width="4"/>'
    for i in range(72):
        a = i / 72 * math.tau
        b += f'<circle cx="{cx+math.cos(a)*366:.1f}" cy="{cy+math.sin(a)*366:.1f}" r="3.2" fill="{SILVER}"/>'
    b += (f'<defs><path id="arcTop" d="M {cx-300} {cy} A 300 300 0 0 1 {cx+300} {cy}"/>'
          f'<path id="arcBot" d="M {cx-300} {cy} A 300 300 0 0 0 {cx+300} {cy}"/></defs>')
    b += (f'<text font-family="\'Plus Jakarta Sans\', Arial" font-weight="800" font-size="64" fill="#FFFFFF" letter-spacing="4">'
          f'<textPath href="#arcTop" startOffset="50%" text-anchor="middle">RIVIRA TECH</textPath></text>')
    b += (f'<text font-family="\'Plus Jakarta Sans\', Arial" font-weight="700" font-size="40" fill="{SKY}" letter-spacing="3" dy="34">'
          f'<textPath href="#arcBot" startOffset="50%" text-anchor="middle">CERTIFIED · AI TRAINING</textPath></text>')
    b += f'<circle cx="{cx}" cy="{cy}" r="230" fill="#FFFFFF"/>'
    b += logo_mark(cx - 190, cy - 112, 224, MARK)
    b += sparkle(cx - 275, cy, 18, fill=SILVER, op=1) + sparkle(cx + 275, cy, 18, fill=SILVER, op=1)
    return svg(800, 800, b)


import page_scenes  # noqa: E402  (inner-page hero artwork)
import home_scenes  # noqa: E402  (home page artwork)
page_scenes.register(scene, MARK, hero_about, hero_projects, hero_courses, hero_events, career, hero_home)
home_scenes.register(scene)


if __name__ == "__main__":
    out_dir = HERE / "svg"
    out_dir.mkdir(exist_ok=True)
    manifest = []
    for s in SCENES:
        path = out_dir / f"{s['name']}.svg"
        path.write_text(s["fn"](), encoding="utf-8")
        manifest.append({k: v for k, v in s.items() if k != "fn"} | {"svg": str(path.relative_to(HERE.parent.parent)).replace("\\", "/")})
    (HERE / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    print(f"{len(manifest)} scenes written")
