"""Inner-page hero artwork (16:9, shown on the right of each page's hero).

Imported by scenes.py, so `python design/artwork/scenes.py` registers these too.
"""
import random

from kit import (BLUE, BLUE_LIGHT, NAVY, SILVER, SKY, WHITE, INK, avatar, badge_icon, bar_chart, bars, bg_dark,
                 bg_light, card, chat, donut, line_chart, logo_mark, network, pill, sparkle, svg, text, window_code)


def register(scene, MARK, hero_about, hero_projects, hero_courses, hero_events, career, hero_home):
    def page(name):
        return f"public/images/pages/{name}.webp"

    def reuse(name, fn, w=1600, h=900):
        def build():
            return fn()
        build.__name__ = f"page_{name}"
        scene(page(name), w, h, size=(1200, 675))(build)

    reuse("about", hero_about)
    reuse("projects", hero_projects)
    reuse("courses", hero_courses)
    reuse("events", hero_events)
    reuse("careers", career)
    reuse("program", hero_home, 1920, 1080)

    @scene(page("coders"), 1600, 900, size=(1200, 675))
    def page_coders():
        w, h = 1600, 900
        b = bg_dark(w, h, glows=((0.7, 0.3, 0.5), (0.2, 0.8, 0.4)))
        b += window_code(110, 110, 820, 600, dark=True, seed=41, title="rag_agent.py")
        b += f'<rect x="150" y="420" width="740" height="96" rx="10" fill="{BLUE_LIGHT}" fill-opacity=".14" stroke="{BLUE_LIGHT}" stroke-opacity=".5" stroke-dasharray="6 6"/>'
        b += text(172, 452, "AI suggestion · retrieve_context()", 16, BLUE_LIGHT, 700) + bars(172, 472, 2, 680, dark=True, seed=9, gap=16)
        b += card(990, 130, 500, 300, dark=True)
        b += text(1025, 200, "Retrieval quality", 18, WHITE, 700, opacity=.85)
        b += line_chart(1025, 230, 430, 160, [.3, .42, .4, .58, .64, .78, .9], dark=True)
        b += chat(1000, 500, 420, 92, "right", seed=21, rows=3) + chat(1060, 630, 360, 76, "left", seed=22)
        for i, lab in enumerate(["Python", "LangChain", "Vector DB", "Cloud"]):
            b += pill(140 + i * 190, 770, lab, dark=True, w=170, size=15)
        b += badge_icon(1460, 110, 54, "code")
        return svg(w, h, b)

    @scene(page("kids"), 1600, 900, size=(1200, 675))
    def page_kids():
        w, h = 1600, 900
        b = bg_light(w, h, glows=((0.3, 0.4, 0.5), (0.8, 0.7, 0.45)))
        b += '<circle cx="520" cy="470" r="330" fill="url(#gGlowSoft)"/>'
        b += f'<rect x="380" y="200" width="280" height="220" rx="70" fill="{WHITE}" stroke="{BLUE}" stroke-width="10" filter="url(#fShadowLight)"/>'
        b += f'<rect x="420" y="250" width="200" height="110" rx="45" fill="{NAVY}"/>'
        b += f'<path d="M465 300 q18 -24 36 0 M540 300 q18 -24 36 0" stroke="{BLUE_LIGHT}" stroke-width="10" fill="none" stroke-linecap="round"/>'
        b += f'<path d="M490 330 q30 22 60 0" stroke="{BLUE_LIGHT}" stroke-width="8" fill="none" stroke-linecap="round"/>'
        b += f'<line x1="520" y1="200" x2="520" y2="150" stroke="{BLUE}" stroke-width="10"/><circle cx="520" cy="140" r="18" fill="url(#gBlue)"/>'
        b += f'<rect x="400" y="440" width="240" height="250" rx="50" fill="{WHITE}" stroke="{BLUE}" stroke-width="10" filter="url(#fShadowLight)"/>'
        b += '<circle cx="520" cy="540" r="44" fill="url(#gBlue)"/>' + sparkle(520, 540, 22)
        b += f'<path d="M400 500 q-90 -10 -120 -110" stroke="{BLUE}" stroke-width="22" fill="none" stroke-linecap="round"/><circle cx="276" cy="380" r="30" fill="url(#gBlue)"/>'
        b += f'<path d="M640 500 q80 40 90 120" stroke="{BLUE}" stroke-width="22" fill="none" stroke-linecap="round"/>'
        for i, (x, y, c) in enumerate([(900, 600, BLUE), (1040, 600, BLUE_LIGHT), (970, 480, NAVY), (1180, 600, SKY)]):
            b += f'<rect x="{x}" y="{y}" width="120" height="110" rx="16" fill="{c}" filter="url(#fShadowLight)"/>'
            b += text(x + 60, y + 72, ["A", "I", "Go", "Py"][i], 44, WHITE, 800, "middle")
        b += card(980, 150, 470, 260)
        b += text(1010, 230, "My first AI game", 26, INK, 800)
        b += bars(1010, 262, 5, 400, seed=17, gap=22)
        for (x, y, s) in [(820, 200, 26), (1450, 520, 20), (300, 700, 18), (760, 760, 14)]:
            b += sparkle(x, y, s, fill=BLUE, op=.7)
        b += badge_icon(1400, 760, 62, "cap")
        return svg(w, h, b)

    @scene(page("nocode"), 1600, 900, size=(1200, 675))
    def page_nocode():
        w, h = 1600, 900
        b = bg_light(w, h, glows=((0.5, 0.5, 0.6),))
        nodes = [(230, 300, "Trigger", "bolt"), (620, 220, "AI assistant", "chat"), (620, 560, "Summarise", "check"),
                 (1010, 390, "Report", "chart"), (1370, 390, "Team inbox", "users")]
        for a, c in [(0, 1), (0, 2), (1, 3), (2, 3), (3, 4)]:
            (x1, y1, *_), (x2, y2, *_) = nodes[a], nodes[c]
            b += f'<path d="M{x1+130} {y1} C {x1+260} {y1} {x2-200} {y2} {x2-130} {y2}" fill="none" stroke="{BLUE}" stroke-width="5" stroke-opacity=".5" stroke-dasharray="10 9"/>'
        for (x, y, lab, g) in nodes:
            b += card(x - 130, y - 70, 260, 140, header=False)
            b += badge_icon(x - 70, y, 38, g) + text(x - 20, y + 8, lab, 22, INK, 800)
        b += pill(540, 760, "No code needed", w=260, size=18) + pill(840, 760, "Works in your tools", w=300, size=18)
        return svg(w, h, b)

    @scene(page("business"), 1600, 900, size=(1200, 675))
    def page_business():
        w, h = 1600, 900
        b = bg_dark(w, h, glows=((0.3, 0.3, 0.5), (0.8, 0.8, 0.4)))
        b += chat(120, 120, 520, 100, "left", seed=31, rows=3) + chat(300, 260, 470, 86, "right", seed=32)
        b += chat(120, 390, 450, 100, "left", seed=33, rows=3)
        b += card(820, 110, 660, 380, dark=True)
        b += text(860, 180, "Hours saved per week", 20, WHITE, 700, opacity=.85)
        b += bar_chart(860, 210, 580, 240, [.25, .35, .5, .62, .78, .92], dark=True)
        b += card(820, 530, 310, 250, dark=True) + donut(975, 655, 80, .68, dark=True, label="68%")
        b += card(1170, 530, 310, 250, dark=True)
        b += text(1200, 600, "Tasks automated", 20, WHITE, 700, opacity=.7) + text(1200, 680, "120+", 64, WHITE, 800)
        b += badge_icon(380, 680, 70, "case") + sparkle(640, 700, 22)
        return svg(w, h, b)

    @scene(page("stack"), 1600, 900, size=(1200, 675))
    def page_stack():
        w, h = 1600, 900
        b = bg_dark(w, h, glows=((0.5, 0.5, 0.6),))
        for i, lab in enumerate(["AI Automation", "AI Agents · MCP", "RAG · Vector DB", "LLMs", "Python · Cloud"]):
            y, x, wdt = 150 + i * 120, 380 + i * 30, 840 - i * 60
            b += (f'<g filter="url(#fShadow)"><path d="M{x} {y+40} L{x+wdt/2:.0f} {y} L{x+wdt} {y+40} L{x+wdt/2:.0f} {y+80}Z" '
                  f'fill="#0C2A58" stroke="{BLUE_LIGHT}" stroke-opacity="{.25 + i*0.12:.2f}" stroke-width="2"/></g>')
            b += text(x + wdt / 2, y + 50, lab, 24, WHITE, 800, "middle")
        b += network(1360, 260, 160, n=16, seed=61) + network(220, 640, 150, n=14, seed=62)
        b += badge_icon(240, 220, 56, "bolt") + badge_icon(1380, 700, 56, "rocket")
        return svg(w, h, b)

    @scene(page("corporate"), 1600, 900, size=(1200, 675))
    def page_corporate():
        w, h = 1600, 900
        b = bg_dark(w, h, glows=((0.5, 0.3, 0.55),))
        b += '<rect x="420" y="90" width="760" height="420" rx="20" fill="#0C2A58" stroke="#FFFFFF" stroke-opacity=".15" filter="url(#fShadow)"/>'
        b += text(470, 170, "Team AI enablement", 32, WHITE, 800)
        b += bar_chart(470, 210, 400, 250, [.35, .5, .62, .8, .9], dark=True)
        b += donut(1020, 330, 92, .86, dark=True, label="86%")
        pos = [(250, 680), (520, 760), (800, 680), (1080, 760), (1350, 680)]
        for (x, y) in pos:
            b += f'<line x1="{x}" y1="{y}" x2="800" y2="510" stroke="#FFFFFF" stroke-opacity=".2" stroke-width="2" stroke-dasharray="5 7"/>'
        for i, (x, y) in enumerate(pos):
            b += f'<circle cx="{x}" cy="{y}" r="96" fill="url(#gGlow)"/>' + avatar(x, y, 66, tone=i)
        b += badge_icon(1340, 160, 60, "users") + badge_icon(260, 200, 50, "check")
        return svg(w, h, b)

    @scene(page("contact"), 1600, 900, size=(1200, 675))
    def page_contact():
        w, h = 1600, 900
        b = bg_light(w, h, glows=((0.5, 0.45, 0.55),))
        b += '<circle cx="800" cy="450" r="360" fill="url(#gGlowSoft)"/>'
        b += f'<rect x="640" y="110" width="320" height="640" rx="48" fill="{NAVY}" filter="url(#fShadowLight)"/><rect x="660" y="150" width="280" height="560" rx="30" fill="#EEF3FA"/>'
        b += chat(680, 200, 220, 70, "left", seed=41) + chat(700, 300, 220, 70, "right", seed=42) + chat(680, 400, 230, 86, "left", seed=43, rows=3)
        b += f'<rect x="680" y="640" width="240" height="48" rx="24" fill="{WHITE}" stroke="#DCE3EC"/>'
        for (x, y, g, lab, sub) in [(150, 200, "chat", "WhatsApp", "Message us"), (150, 520, "headset", "Career advisor", "+91 72073 01237"),
                                    (1060, 200, "calendar", "Book a call", "Free career call"), (1060, 520, "check", "Email", "info@riviratech.com")]:
            b += card(x, y, 390, 170, header=False) + badge_icon(x + 66, y + 85, 40, g)
            b += text(x + 122, y + 78, lab, 24, INK, 800) + text(x + 122, y + 112, sub, 17, BLUE, 700)
        return svg(w, h, b)

    @scene(page("legal"), 1600, 900, size=(1200, 675))
    def page_legal():
        w, h = 1600, 900
        b = bg_light(w, h, glows=((0.4, 0.4, 0.55),))
        for i in range(3):
            b += card(440 + i * 40, 120 + i * 30, 560, 660, header=False)
        b += text(560, 250, "Privacy &amp; Terms", 34, INK, 800)
        b += bars(560, 300, 14, 440, seed=51, gap=26)
        b += '<g filter="url(#fShadowLight)"><path d="M1160 260 l170 60 v110 q0 150 -170 220 q-170 -70 -170 -220 v-110Z" fill="url(#gBlue)"/></g>'
        b += '<path d="M1100 440 l45 45 l90 -95" stroke="#fff" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
        b += badge_icon(300, 300, 54, "shield") + badge_icon(300, 620, 46, "check")
        return svg(w, h, b)

    @scene(page("blog"), 1600, 900, size=(1200, 675))
    def page_blog():
        w, h = 1600, 900
        b = bg_light(w, h, glows=((0.6, 0.4, 0.55),))
        for i, (x, y) in enumerate([(160, 220), (600, 140), (1040, 220)]):
            b += card(x, y, 400, 520, header=False)
            b += f'<rect x="{x+20}" y="{y+20}" width="360" height="200" rx="12" fill="url(#gNavy)"/>'
            b += network(x + 200, y + 120, 80, n=10, seed=70 + i)
            b += pill(x + 22, y + 244, ["LLMs", "RAG", "Agents"][i], w=110, size=14)
            b += text(x + 22, y + 320, ["Prompting that works", "Building with RAG", "Agents in practice"][i], 24, INK, 800)
            b += bars(x + 22, y + 350, 5, 350, seed=80 + i, gap=22)
        return svg(w, h, b)

    @scene(page("faq"), 1600, 900, size=(1200, 675))
    def page_faq():
        w, h = 1600, 900
        b = bg_dark(w, h, glows=((0.5, 0.45, 0.6),))
        for i, (x, y, wd, side) in enumerate([(200, 150, 640, "left"), (760, 300, 620, "right"), (200, 450, 600, "left"), (760, 600, 560, "right")]):
            b += chat(x, y, wd, 100, side, seed=90 + i, rows=3)
            mx = x + wd - 40 if side == "left" else x + 40
            b += text(mx, y + 64, "?" if side == "left" else "✓", 40, BLUE if side == "left" else WHITE, 800, "middle")
        b += badge_icon(1380, 170, 60, "chat") + sparkle(1300, 780, 22)
        return svg(w, h, b)

    @scene(page("certificate"), 1600, 900, size=(1200, 675))
    def page_certificate():
        w, h = 1600, 900
        b = bg_dark(w, h, glows=((0.5, 0.45, 0.6),))
        b += f'<g filter="url(#fShadow)"><rect x="280" y="130" width="1040" height="640" rx="18" fill="{WHITE}"/></g>'
        b += f'<rect x="310" y="160" width="980" height="580" rx="10" fill="none" stroke="{BLUE}" stroke-width="3"/>'
        b += f'<rect x="326" y="176" width="948" height="548" rx="6" fill="none" stroke="{SILVER}" stroke-width="2"/>'
        b += logo_mark(740, 200, 70, MARK)
        b += text(800, 340, "CERTIFICATE", 64, NAVY, 800, "middle", spacing=6)
        b += text(800, 385, "OF COMPLETION", 22, BLUE, 700, "middle", spacing=8)
        b += text(800, 455, "Your Name", 40, INK, 700, "middle") + f'<rect x="560" y="472" width="480" height="3" fill="{SILVER}"/>'
        b += text(800, 520, "AI Launchpad Program", 24, "#4B5563", 600, "middle")
        b += '<circle cx="1140" cy="640" r="62" fill="url(#gBlue)"/>' + sparkle(1140, 640, 28)
        b += f'<rect x="420" y="660" width="200" height="2" fill="{SILVER}"/>' + text(520, 690, "Program Director", 16, "#6B7685", 600, "middle")
        return svg(w, h, b)

    @scene(page("checkout"), 1600, 900, size=(1200, 675))
    def page_checkout():
        w, h = 1600, 900
        b = bg_dark(w, h, glows=((0.6, 0.4, 0.55),))
        b += card(470, 110, 660, 680, header=False)
        b += logo_mark(510, 150, 44, MARK) + text(600, 182, "Enrollment", 26, INK, 800)
        for i, (lab, val) in enumerate([("Program", "AI for Coders"), ("Format", "Live + recorded"), ("Mentor support", "Included")]):
            y = 260 + i * 80
            b += text(510, y, lab, 17, "#6B7685", 700) + text(1090, y, val, 19, INK, 800, "end")
            b += f'<rect x="510" y="{y+22}" width="580" height="1" fill="#E3E8EF"/>'
        b += '<rect x="510" y="540" width="580" height="90" rx="14" fill="#F4F6FA"/>'
        b += text(540, 597, "•••• •••• •••• 4242", 26, INK, 700, spacing=2)
        b += '<rect x="510" y="660" width="580" height="70" rx="12" fill="#212529"/>' + text(800, 704, "Secure checkout", 22, WHITE, 700, "middle")
        b += badge_icon(1250, 220, 64, "shield") + badge_icon(330, 640, 54, "check")
        return svg(w, h, b)

    @scene(page("gallery"), 1600, 900, size=(1200, 675))
    def page_gallery():
        w, h = 1600, 900
        b = bg_dark(w, h, glows=((0.5, 0.5, 0.6),))
        rnd = random.Random(5)
        frames = [(160, 160, 420, 300, -4), (620, 110, 380, 270, 3), (1040, 170, 400, 290, -2),
                  (300, 500, 380, 280, 2), (720, 440, 420, 300, -3), (1150, 520, 330, 250, 4)]
        for i, (x, y, fw, fh, rot) in enumerate(frames):
            b += f'<g transform="rotate({rot} {x+fw/2} {y+fh/2})" filter="url(#fShadow)"><rect x="{x}" y="{y}" width="{fw}" height="{fh}" rx="10" fill="{WHITE}"/>'
            b += f'<rect x="{x+12}" y="{y+12}" width="{fw-24}" height="{fh-24}" rx="6" fill="url(#gBlue)" fill-opacity="{.55 + rnd.random()*0.45:.2f}"/>'
            for k in range(3):
                b += avatar(x + 70 + k * ((fw - 140) / 2), y + fh - 70, 34, tone=(i + k) % 4, ring=False)
            b += "</g>"
        return svg(w, h, b)
