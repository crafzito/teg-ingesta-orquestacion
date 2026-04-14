"""Combina desktop + mobile screenshots en composites lado a lado."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1] / "docs" / "anexos-screenshots"
DESK_DIR = ROOT
MOB_DIR = ROOT / "_mobile"
OUT_DIR = ROOT / "composites"
OUT_DIR.mkdir(exist_ok=True)

MAX_H = 1600
PADDING = 40
GAP = 60
LABEL_H = 80
BG = (248, 250, 252)
TEXT = (15, 23, 42)
SUB = (71, 85, 105)


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in (
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "arial.ttf",
    ):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


FONT_TITLE = load_font(30)
FONT_SUB = load_font(18)


def scale_down(img: Image.Image, max_h: int = MAX_H) -> Image.Image:
    if img.height > max_h:
        ratio = max_h / img.height
        return img.resize((int(img.width * ratio), max_h), Image.Resampling.LANCZOS)
    return img


def build(name: str) -> None:
    d_path = DESK_DIR / name
    m_path = MOB_DIR / name
    if not d_path.exists() or not m_path.exists():
        print(f"  [skip] {name}")
        return
    d = scale_down(Image.open(d_path).convert("RGB"))
    m = scale_down(Image.open(m_path).convert("RGB"))

    panel_h = max(d.height, m.height)
    total_h = panel_h + LABEL_H + PADDING * 2
    total_w = d.width + m.width + GAP + PADDING * 2

    canvas = Image.new("RGB", (total_w, total_h), BG)
    draw = ImageDraw.Draw(canvas)

    # Labels
    desk_label_x = PADDING
    mob_label_x = PADDING + d.width + GAP
    label_y = PADDING

    draw.text((desk_label_x, label_y), "DESKTOP", fill=TEXT, font=FONT_TITLE)
    draw.text(
        (desk_label_x, label_y + 36),
        f"{d.width}x{d.height} px",
        fill=SUB,
        font=FONT_SUB,
    )
    draw.text((mob_label_x, label_y), "MOBILE", fill=TEXT, font=FONT_TITLE)
    draw.text(
        (mob_label_x, label_y + 36),
        f"{m.width}x{m.height} px (iPhone 13)",
        fill=SUB,
        font=FONT_SUB,
    )

    # Paste screenshots with subtle border
    paste_y = PADDING + LABEL_H
    for img, x in ((d, PADDING), (m, PADDING + d.width + GAP)):
        # subtle border
        draw.rectangle(
            (x - 1, paste_y - 1, x + img.width, paste_y + img.height),
            outline=(203, 213, 225),
            width=1,
        )
        canvas.paste(img, (x, paste_y))

    out = OUT_DIR / name
    canvas.save(out, "PNG", optimize=True)
    print(f"  [ok] {name} -> {canvas.size}")


def main() -> None:
    files = sorted(p.name for p in DESK_DIR.glob("*.png"))
    print(f"Generando {len(files)} composites en {OUT_DIR}")
    for name in files:
        build(name)
    print("Listo.")


if __name__ == "__main__":
    main()
