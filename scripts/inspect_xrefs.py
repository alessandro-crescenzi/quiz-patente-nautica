"""Conta gli xref unici di immagini incorporate in tutte le pagine quiz."""

import fitz
from pathlib import Path
from collections import Counter

PDF = Path(__file__).resolve().parents[1] / "knowledge_base" / "ALLEGATO A QUIZ PATENTI NAUTICHE DD 131 DEL 31 MAGGIO 2022.pdf"
OUT = Path(__file__).resolve().parents[1] / "data" / "_inspect"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PDF)

    xref_counts = Counter()
    xref_pages = {}
    xref_size = {}
    for pnum in range(1, 279):  # quiz base + vela
        page = doc[pnum - 1]
        info = page.get_image_info(xrefs=True)
        for im in info:
            xref = im["xref"]
            if xref:
                xref_counts[xref] += 1
                xref_pages.setdefault(xref, []).append(pnum)
                xref_size[xref] = (im["width"], im["height"])

    print(f"Xref unici: {len(xref_counts)}")
    print(f"Totale occorrenze: {sum(xref_counts.values())}")
    # Stampa i primi 20 ordinati per xref
    for xref in sorted(xref_counts.keys())[:30]:
        pages = xref_pages[xref]
        cnt = xref_counts[xref]
        w, h = xref_size[xref]
        print(f"  xref={xref} count={cnt} size={w}x{h} first_page={pages[0]}")

    # Salvo una immagine per ogni xref univoco con nome ordinato
    for idx, xref in enumerate(sorted(xref_counts.keys()), start=1):
        try:
            pix = fitz.Pixmap(doc, xref)
            if pix.alpha:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            out = OUT / f"xref_{idx:03d}_{xref}.png"
            pix.save(out)
        except Exception as e:
            print(f"  errore xref {xref}: {e}")
    doc.close()


if __name__ == "__main__":
    main()
