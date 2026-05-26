"""
Costruisce mappa xref -> numero_figura tramite OCR multi-strategia.

Pratica:
- Estraggo l'immagine "figura N" da ciascun xref unico
- Ritaglio solo la parte BASSA (dove c'è il numero)
- Pad bianco + upscale per migliorare OCR
- Provo PSM 6, 7, 8, 10 con whitelist cifre
- Prendo il consenso. Salvo anomalie in _xref_debug/ per controllo manuale.
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

import fitz
import pytesseract
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "knowledge_base" / "ALLEGATO A QUIZ PATENTI NAUTICHE DD 131 DEL 31 MAGGIO 2022.pdf"
OUT_JSON = ROOT / "data" / "xref_to_figure.json"
DEBUG_DIR = ROOT / "data" / "_xref_debug"

DIGIT_RE = re.compile(r"\d+")
PSMS = [6, 7, 8, 10, 13]


def _prep(img: Image.Image, crop_top: float, pad: int, scale: int) -> Image.Image:
    if img.mode != "L":
        img = img.convert("L")
    img = ImageOps.autocontrast(img)
    w, h = img.size
    img = img.crop((0, int(h * crop_top), w, h))
    new = Image.new("L", (img.width + 2 * pad, img.height + 2 * pad), 255)
    new.paste(img, (pad, pad))
    img = new
    return img.resize((img.width * scale, img.height * scale), Image.LANCZOS)


def ocr_attempts(img: Image.Image) -> list[int]:
    """OCR sul crop bottom con PSM 7 (single line) e 6 (block), prendendo
    il numero "intero" (a piu' cifre) come unita'."""
    nums: list[int] = []
    proc = _prep(img, crop_top=0.42, pad=30, scale=4)
    for psm in (7, 6, 8):
        cfg = f"--psm {psm} -c tessedit_char_whitelist=0123456789"
        txt = pytesseract.image_to_string(proc, config=cfg).strip()
        for s in DIGIT_RE.findall(txt):
            n = int(s)
            if 1 <= n <= 103:
                nums.append(n)
    return nums


def ocr_number(img: Image.Image) -> int | None:
    attempts = ocr_attempts(img)
    if not attempts:
        return None
    cnt = Counter(attempts)
    most, freq = cnt.most_common(1)[0]
    # Almeno 2 conferme oppure unico match
    if freq >= 2 or len(set(attempts)) == 1:
        return most
    return most  # accetto comunque ma sarà flaggato come ambiguo


def main():
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PDF)

    xrefs_seen = set()
    for pnum in range(1, 279):
        page = doc[pnum - 1]
        info = page.get_image_info(xrefs=True)
        for im in info:
            if im["xref"]:
                xrefs_seen.add(im["xref"])

    mapping: dict[int, int] = {}
    ambiguous: list[tuple[int, list[int]]] = []
    failures: list[int] = []

    for xref in sorted(xrefs_seen):
        try:
            pix = fitz.Pixmap(doc, xref)
            if pix.alpha:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        except Exception as e:
            failures.append(xref)
            continue

        # Le immagini "figura N" hanno tutte dimensione esatta 151x151 px
        if img.size != (151, 151):
            continue

        attempts = ocr_attempts(img)
        if not attempts:
            continue
        cnt = Counter(attempts)
        most, freq = cnt.most_common(1)[0]
        unique = set(attempts)
        if freq >= 3 and len(unique) <= 2:
            mapping[xref] = most
        else:
            mapping[xref] = most
            ambiguous.append((xref, attempts))
            img.save(DEBUG_DIR / f"AMB_xref_{xref}_picked_{most}.png")

    doc.close()

    print(f"Mappati: {len(mapping)} / {len(xrefs_seen)} xref")
    print(f"Ambigui (da revisionare manualmente): {len(ambiguous)}")
    for x, atts in ambiguous[:20]:
        print(f"  xref {x}: tentativi={atts}")

    # Validation pass: numeri usati piu' volte (atteso: alcuni xref distinti possono avere lo stesso numero)
    reverse: dict[int, list[int]] = {}
    for x, n in mapping.items():
        reverse.setdefault(n, []).append(x)
    multi = {n: xs for n, xs in reverse.items() if len(xs) > 1}
    print(f"Numeri figura associati a >1 xref: {len(multi)}")
    for n in sorted(multi)[:20]:
        print(f"  figura {n}: xrefs={multi[n]}")

    out = {str(k): v for k, v in mapping.items()}
    OUT_JSON.write_text(json.dumps(out, indent=2))
    print(f"Scritto {OUT_JSON}")


if __name__ == "__main__":
    main()
