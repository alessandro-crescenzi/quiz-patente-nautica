"""
Estrae le figure numerate dalle pagine 280-286 dell'allegato A e le salva come
data/images/figura_NN.png

Strategia:
- Per ogni pagina figure, leggo i numeri visibili in alto-sinistra di ciascun riquadro
- Raggruppo i numeri per riga (Y simile)
- Calcolo il bounding box di ciascuna cella in base alla griglia
- Renderizzo la pagina ad alta risoluzione e ritaglio
"""

from pathlib import Path
import re

import fitz  # PyMuPDF
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "knowledge_base" / "ALLEGATO A QUIZ PATENTI NAUTICHE DD 131 DEL 31 MAGGIO 2022.pdf"
OUT_DIR = ROOT / "data" / "images"

FIGURE_PAGES = list(range(280, 287))  # 1-indexed
RENDER_DPI = 200

DIGIT_RE = re.compile(r"^\d{1,3}$")


def page_figure_numbers(page: fitz.Page):
    """Ritorna lista di (numero, x0, y0, x1, y1) per i numeri di figura della pagina.

    Esclude footer 'pagina N di 8'.
    """
    height = page.rect.height
    words = page.get_text("words")  # list of (x0,y0,x1,y1,word,block,line,word_no)
    results = []
    for x0, y0, x1, y1, w, *_ in words:
        if not DIGIT_RE.match(w):
            continue
        n = int(w)
        if not (1 <= n <= 200):
            continue
        if y0 > height - 30:  # footer
            continue
        results.append((n, float(x0), float(y0), float(x1), float(y1)))
    return results


def group_rows(nums, y_tol=15):
    """Raggruppa i numeri per riga (top simile)."""
    if not nums:
        return []
    sorted_n = sorted(nums, key=lambda n: (n[2], n[1]))
    rows = []
    current = [sorted_n[0]]
    for n in sorted_n[1:]:
        if abs(n[2] - current[0][2]) <= y_tol:
            current.append(n)
        else:
            rows.append(sorted(current, key=lambda r: r[1]))
            current = [n]
    rows.append(sorted(current, key=lambda r: r[1]))
    return rows


def cell_boxes(rows, page_w, page_h, top_margin=2, right_margin=10, bottom_margin=10):
    """Per ogni cella, ritorna (numero, x0, y0, x1, y1) in coordinate PDF (punti)."""
    boxes = []
    for r_idx, row in enumerate(rows):
        # y_top della cella = top del numero - piccolo offset
        y_top = row[0][2] - top_margin
        # y_bottom = top della riga successiva (meno gap), oppure bottom pagina
        if r_idx + 1 < len(rows):
            y_bottom = rows[r_idx + 1][0][2] - top_margin
        else:
            y_bottom = page_h - bottom_margin
        for c_idx, cell in enumerate(row):
            num = cell[0]
            x_left = cell[1] - 2
            if c_idx + 1 < len(row):
                x_right = row[c_idx + 1][1] - 2
            else:
                x_right = page_w - right_margin
            boxes.append((num, x_left, y_top, x_right, y_bottom))
    return boxes


def render_page(page: fitz.Page, dpi=RENDER_DPI):
    scale = dpi / 72.0
    matrix = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=matrix, alpha=False)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    return img, scale


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    seen = {}
    doc = fitz.open(PDF)
    for pnum in FIGURE_PAGES:
        page = doc[pnum - 1]
        page_w = page.rect.width
        page_h = page.rect.height
        nums = page_figure_numbers(page)
        rows = group_rows(nums)
        boxes = cell_boxes(rows, page_w, page_h)
        img, scale = render_page(page)
        print(f"p{pnum}: {len(boxes)} celle  ({page_w:.0f}x{page_h:.0f}) scale={scale:.2f}")
        for num, x0, y0, x1, y1 in boxes:
            if num in seen:
                print(f"  duplicato figura {num} (gia in p{seen[num]})")
                continue
            seen[num] = pnum
            px0, py0, px1, py1 = int(x0 * scale), int(y0 * scale), int(x1 * scale), int(y1 * scale)
            crop = img.crop((px0, py0, px1, py1))
            out_path = OUT_DIR / f"figura_{num:03d}.png"
            crop.save(out_path, optimize=True)
    doc.close()
    nums_found = sorted(seen.keys())
    print(f"\nFigure estratte: {len(nums_found)}, range {nums_found[0]}..{nums_found[-1]}")
    # Verifica continuità
    missing = sorted(set(range(nums_found[0], nums_found[-1] + 1)) - set(nums_found))
    if missing:
        print(f"Mancanti: {missing}")
    else:
        print("Numerazione continua.")


if __name__ == "__main__":
    main()
