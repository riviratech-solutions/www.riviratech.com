"""Neon wave backgrounds for the indigo bands (hero, CTA band, dark sections).

    python design/artwork/waves.py   -> public/images/home/waves-hero.svg, waves-band.svg
"""
import math
import pathlib

OUT = pathlib.Path(__file__).resolve().parents[2] / "public" / "images" / "home"

GRAD = """<defs>
<linearGradient id="w1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3B7BFF" stop-opacity="0"/><stop offset=".35" stop-color="#5B6BFF"/><stop offset=".7" stop-color="#8B5CF6"/><stop offset="1" stop-color="#A78BFA" stop-opacity="0"/></linearGradient>
<filter id="glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
</defs>"""


def ribbon(x0, x1, y, amp, period, phase, lines, spread, width=1.2, op=.55):
    """A bundle of sine lines, slightly offset, that reads as a glowing ribbon."""
    out = ""
    for k in range(lines):
        t = k / max(1, lines - 1)
        pts = []
        for i in range(0, 121):
            x = x0 + (x1 - x0) * i / 120
            yy = y + spread * t + amp * math.sin((x / period) * math.tau + phase + t * 0.9) * (0.6 + 0.4 * t)
            pts.append(f"{x:.1f},{yy:.1f}")
        out += f'<polyline points="{" ".join(pts)}" fill="none" stroke="url(#w1)" stroke-width="{width}" stroke-opacity="{op * (0.45 + 0.55 * (1 - abs(t - .5) * 2)):.2f}"/>'
    return out


def hero():
    w, h = 1600, 700
    b = GRAD
    b += f'<g filter="url(#glow)" opacity=".7">{ribbon(-100, 900, 560, 70, 900, 0.4, 6, 60, 3, .5)}</g>'
    b += ribbon(-100, 900, 560, 70, 900, 0.4, 26, 60)
    b += f'<g filter="url(#glow)" opacity=".7">{ribbon(700, 1700, 330, 120, 1100, 2.2, 6, 90, 3, .5)}</g>'
    b += ribbon(700, 1700, 330, 120, 1100, 2.2, 30, 90)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMax slice">{b}</svg>'


def band():
    w, h = 1600, 300
    b = GRAD.replace('stop-opacity="0"/><stop offset=".35"', 'stop-opacity=".2"/><stop offset=".35"')
    for x0, x1, ph in [(-200, 520, 0.0), (1080, 1800, 3.14)]:
        b += f'<g filter="url(#glow)" opacity=".85">{ribbon(x0, x1, 230, 80, 1400, ph, 5, 30, 4, .7)}</g>'
        b += ribbon(x0, x1, 230, 80, 1400, ph, 22, 30, 1.3, .7)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" preserveAspectRatio="none">{b}</svg>'


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "waves-hero.svg").write_text(hero(), encoding="utf-8")
    (OUT / "waves-band.svg").write_text(band(), encoding="utf-8")
    print("waves written", [p.stat().st_size for p in (OUT / "waves-hero.svg", OUT / "waves-band.svg")])
