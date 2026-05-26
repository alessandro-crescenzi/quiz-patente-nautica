"""Estrai e ispeziona le immagini incorporate in p2."""

import fitz
from pathlib import Path

PDF = Path(__file__).resolve().parents[1] / "knowledge_base" / "ALLEGATO A QUIZ PATENTI NAUTICHE DD 131 DEL 31 MAGGIO 2022.pdf"
OUT = Path(__file__).resolve().parents[1] / "data" / "_inspect"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PDF)
    for pnum in [2, 3]:
        page = doc[pnum - 1]
        # Trova bbox di tutte le immagini in pagina
        info = page.get_image_info(xrefs=True)
        for i, im in enumerate(info):
            print(f"p{pnum} img{i}: bbox={im['bbox']} xref={im['xref']} size={im['width']}x{im['height']}")
            xref = im["xref"]
            if xref:
                pix = fitz.Pixmap(doc, xref)
                if pix.alpha:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                out = OUT / f"p{pnum}_img{i}_xref{xref}.png"
                pix.save(out)
                print(f"  saved {out}")
    doc.close()


if __name__ == "__main__":
    main()
