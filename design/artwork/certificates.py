"""Rebrand the certificate templates (public/certicates/*.png) to Rivira Tech.

Step 1 (this script, already run): erase the previous company logo / name
regions by blending the background on either side of each region, row by row.
Its output, design/artwork/cert-base/, is the starting point from now on (the
pre-rebrand originals are not kept in the repo). Step 2 (certificates.cjs) lays
the Rivira mark and "RIVIRA TECH" over those bases and writes public/certicates/:
    node design/artwork/certificates.cjs
"""
import json
import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "design" / "artwork" / "cert-src"      # untouched originals
OUT = ROOT / "design" / "artwork" / "cert-base"

# (x0, y0, x1, y1) in the 1536x1024 originals; "overlay" says what step 2 draws there
STANDARD = [
    {"box": (34, 48, 292, 202), "overlay": "lockup"},          # logo block, top left
    {"box": (538, 72, 1106, 106), "overlay": "header"},        # company name above CERTIFICATE
    {"box": (300, 945, 610, 977), "overlay": "director-serif"},  # under "Program Director"
]
CERTS = {
    "Certificate of Completion.png": STANDARD,
    "Certificate of Bootcamp Participation.png": STANDARD,
    "Certificate of Kids Completion.png": [
        {"box": (608, 24, 914, 156), "overlay": "lockup-center"},
        {"box": (128, 444, 220, 542), "overlay": "mini-mark"},     # robot chest badge
        {"box": (1224, 446, 1310, 526), "overlay": "mini-mark"},   # laptop lid badge
        {"box": (312, 926, 572, 962), "overlay": "director-sans"},
    ],
}


def erase(im, box):
    x0, y0, x1, y1 = box
    px = im.load()
    for y in range(y0, y1):
        left = px[x0 - 3, y]
        right = px[x1 + 2, y]
        for x in range(x0, x1):
            t = (x - x0) / max(1, (x1 - x0 - 1))
            px[x, y] = tuple(round(left[i] * (1 - t) + right[i] * t) for i in range(3))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    layout = {}
    for name, regions in CERTS.items():
        im = Image.open(SRC / name).convert("RGB")
        for r in regions:
            erase(im, r["box"])
        im.save(OUT / name)
        layout[name] = regions
    (OUT / "layout.json").write_text(json.dumps(layout, indent=1), encoding="utf-8")
    print("cleaned", len(CERTS), "certificates")


if __name__ == "__main__":
    main()
