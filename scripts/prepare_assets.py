"""Turn the raw DAMA source material into web-ready assets under docs/assets.

Run from the project root:  python scripts/prepare_assets.py
Needs only PyMuPDF (pip install pymupdf). Re-run whenever the source photos change.
"""
import math
import os
import random
import urllib.request

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "docs", "assets")
IMG = os.path.join(SITE, "img")
PHOTOS = os.path.join(ROOT, "DAMA Media Assets", "Event Photos")
INFOPACK = os.path.join(ROOT, "DAMA Branding Materials", "DAMA Malaysia Infopack.pdf")
LOGO = os.path.join(ROOT, "DAMA Branding Materials", "DAMA KL Selangor logo.png")


def out(*parts):
    path = os.path.join(IMG, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def to_rgb(pix):
    if pix.alpha:
        pix = pymupdf.Pixmap(pix, 0)
    if pix.colorspace and pix.colorspace.n != 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    return pix


def crop(pix, rect):
    out_pix = pymupdf.Pixmap(pix.colorspace, rect, bool(pix.alpha))
    out_pix.copy(pix, rect)
    out_pix.set_origin(0, 0)
    return out_pix


def bbox(pix, keep):
    """Bounding box of pixels where keep(row_or_col_bytes) is true, scanning one channel."""
    w, h, n, s = pix.width, pix.height, pix.n, pix.samples
    stride, ch = w * n, (n - 1 if pix.alpha else 0)
    rows = [y for y in range(h) if keep(s[y * stride + ch:(y + 1) * stride:n])]
    cols = [x for x in range(w) if keep(s[x * n + ch::stride])]
    return pymupdf.IRect(cols[0], rows[0], cols[-1] + 1, rows[-1] + 1)


def pdf_pixmap(doc, xref):
    """An embedded PDF image with its soft mask applied, cropped to the visible area."""
    pix = pymupdf.Pixmap(doc, xref)
    smask = doc.xref_get_key(xref, "SMask")
    if smask[0] != "xref":
        return pix
    pix = pymupdf.Pixmap(to_rgb(pix), pymupdf.Pixmap(doc, int(smask[1].split()[0])))
    return crop(pix, bbox(pix, lambda b: max(b) > 200))


def save_jpg(pix, dest, max_w, quality=78):
    pix = to_rgb(pix)
    if pix.width > max_w:
        pix = pymupdf.Pixmap(pix, max_w, round(pix.height * max_w / pix.width), None)
    pix.save(dest, jpg_quality=quality)
    print(f"  {os.path.relpath(dest, ROOT)}  {pix.width}x{pix.height}  {os.path.getsize(dest) // 1024} KB")


# --- Event photos from the media folder -------------------------------------
# Only photos stored upright (EXIF orientation 1) are used, so no rotation is needed.
EVENT_PHOTOS = {
    "hero-crowd": ("DAMA Launch event", "Copy of DAMA track crowd.jpg", 2000),
    "launch-button": ("DAMA Launch event", "Copy of group pic press on button to launch.jpg", 1400),
    "launch-group": ("DAMA Launch event", "Copy of DAMA group pic holding logo.jpg", 1400),
    "launch-group-2": ("DAMA Launch event", "Copy of group pic holding dama logo 1.jpg", 1400),
    "launch-intro": ("DAMA Launch event", "Copy of 20250513_161507.jpg", 1400),
    "launch-panel": ("DAMA Launch event", "Copy of panel speaker screen.jpg", 1400),
    "pwc-stage": ("AI Leadership with PWC", "Copy of 20250513_095758.jpg", 1400),
    "pwc-group": ("AI Leadership with PWC", "Copy of group pic with YB Gobind .jpg", 1400),
    "pwc-panel": ("AI Leadership with PWC", "Copy of 20250513_115236.jpg", 1400),
    "um-mou": ("UM x DAMA MOU signing event", "Copy of UMxDAMAxCADS.jpg", 1400),
    "um-signing": ("UM x DAMA MOU signing event", "Copy of Group pic signing 3.jpg", 1400),
    "um-group": ("UM x DAMA MOU signing event", "Copy of group pic outside 1.jpg", 1400),
    "um-court": ("UM x DAMA MOU signing event", "Copy of group pic at bilik court.jpg", 1400),
}

# --- Images embedded in the infopack: (page, xref) ---------------------------
PDF_IMAGES = {
    # Board of Directors (page 9), matched to names by position on the slide
    "team/habsah-nordin": (9, 125),
    "team/faiz-fablillah": (9, 126),
    "team/peggy-low": (9, 127),
    "team/ahmad-yusri-mohamed": (9, 136),
    "team/eva-piramila-poovan": (9, 128),
    "team/sharala-axryd": (9, 129),
    "team/quak-hooi-lee": (9, 130),
    "team/iffah-illani-ismail": (9, 131),
    "team/tan-jian-yip": (9, 132),
    "team/ethan-teh-wei-jen": (9, 133),
    "team/raizil-emeli-juzilman": (9, 831),
    "team/shahril-nizam": (9, 135),
    # Events only available inside the infopack (page 8)
    "events/afed-1": (8, 111),
    "events/afed-2": (8, 112),
    "events/launchpad-1": (8, 113),
    "events/launchpad-2": (8, 114),
    "events/mmu-1": (8, 115),
    "events/mmu-2": (8, 116),
    # Why join (page 10), upcoming activities (page 14), backgrounds
    "misc/join-learn": (10, 143),
    "misc/join-contribute": (10, 145),
    "misc/join-network": (10, 144),
    "misc/activity-workshop": (14, 245),
    "misc/activity-webinar": (14, 247),
    "misc/activity-podcast": (14, 249),
    "misc/activity-forum": (14, 251),
    "misc/hands-globe": (15, 257),
    "misc/malaysia-flag": (5, 689),
    "misc/data-network": (13, 1031),
}


def event_photos():
    print("Event photos")
    for name, (folder, fn, w) in EVENT_PHOTOS.items():
        save_jpg(pymupdf.Pixmap(os.path.join(PHOTOS, folder, fn)), out("events", name + ".jpg"), w)


def pdf_images():
    print("Infopack images")
    doc = pymupdf.open(INFOPACK)
    for name, (_page, xref) in PDF_IMAGES.items():
        save_jpg(pdf_pixmap(doc, xref), out(name + ".jpg"), 1400, quality=82)
    # World map keeps its transparency
    pdf_pixmap(doc, 56).save(out("misc", "world-map.png"))
    print("  docs/assets/img/misc/world-map.png")


def logo():
    """Trim the large white margin around the logo."""
    print("Logo")
    pix = to_rgb(pymupdf.Pixmap(LOGO))
    box = bbox(pix, lambda b: min(b) < 225)
    pad = 12
    clip = pymupdf.IRect(max(box.x0 - pad, 0), max(box.y0 - pad, 0),
                         min(box.x1 + pad, pix.width), min(box.y1 + pad, pix.height))
    cropped = crop(pix, clip)
    for width in (480, 960):
        scaled = pymupdf.Pixmap(cropped, width, round(cropped.height * width / cropped.width), None)
        dest = out(f"logo-{width}.png")
        scaled.save(dest)
        print(f"  {os.path.relpath(dest, ROOT)}  {scaled.width}x{scaled.height}")


def waves():
    """The flowing line-wave motif used throughout the infopack."""
    random.seed(7)
    lines = []
    for i in range(36):
        t = i / 35
        pts = []
        for k in range(0, 61):
            x = k / 60 * 1200
            y = (300 + 140 * math.sin(x / 260 + t * 2.2) + 90 * math.sin(x / 140 - t * 3.1)
                 + (t - 0.5) * 160 * math.cos(x / 400))
            pts.append(f"{x:.1f},{y:.1f}")
        lines.append(f'<polyline points="{" ".join(pts)}"/>')
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" preserveAspectRatio="none" '
           'fill="none" stroke="#4DE1C7" stroke-width="1" stroke-opacity=".55">' + "".join(lines) + "</svg>")
    with open(out("waves.svg"), "w", encoding="utf-8") as f:
        f.write(svg)
    print("  docs/assets/img/waves.svg")


FONTS = {
    "open-sans-400": "open-sans@latest/latin-400-normal.woff2",
    "open-sans-600": "open-sans@latest/latin-600-normal.woff2",
    "open-sans-700": "open-sans@latest/latin-700-normal.woff2",
    "open-sans-400-italic": "open-sans@latest/latin-400-italic.woff2",
    "open-sauce-one-400": "open-sauce-one@latest/latin-400-normal.woff2",
    "open-sauce-one-700": "open-sauce-one@latest/latin-700-normal.woff2",
}


def fonts():
    """Self-host the brand fonts (both SIL Open Font License)."""
    print("Fonts")
    for name, path in FONTS.items():
        dest = os.path.join(SITE, "fonts", name + ".woff2")
        if not os.path.exists(dest):
            urllib.request.urlretrieve("https://cdn.jsdelivr.net/fontsource/fonts/" + path, dest)
        print(f"  {os.path.relpath(dest, ROOT)}")


if __name__ == "__main__":
    event_photos()
    pdf_images()
    logo()
    waves()
    fonts()
