"""Esamina la struttura grafica delle pagine figure per pianificare il ritaglio."""

import pdfplumber
from pathlib import Path

PDF = Path(__file__).resolve().parents[1] / "knowledge_base" / "ALLEGATO A QUIZ PATENTI NAUTICHE DD 131 DEL 31 MAGGIO 2022.pdf"

FIGURE_PAGES = range(279, 287)


def main():
    with pdfplumber.open(PDF) as pdf:
        for pnum in FIGURE_PAGES:
            page = pdf.pages[pnum - 1]
            rects = page.rects
            chars = page.chars
            # Numeri = chars isdigit, filtra escludendo footer "pagina N di 8"
            digits = []
            words = page.extract_words()
            for w in words:
                if w["text"].isdigit() and 1 <= int(w["text"]) <= 200:
                    if w["top"] < page.height - 30:  # esclude footer
                        digits.append((int(w["text"]), w["x0"], w["top"], w["x1"], w["bottom"]))
            digits.sort(key=lambda d: (d[2], d[1]))
            print(f"\n--- p{pnum} ({page.width:.0f}x{page.height:.0f}) rects={len(rects)} digits_top10={digits[:10]} count={len(digits)}")
            # Stampa anche size dei rettangoli aggregati
            big_rects = [r for r in rects if (r["x1"] - r["x0"]) > 50 and (r["bottom"] - r["top"]) > 50]
            if big_rects:
                w0 = big_rects[0]["x1"] - big_rects[0]["x0"]
                h0 = big_rects[0]["bottom"] - big_rects[0]["top"]
                print(f"   big_rects: {len(big_rects)} sample size {w0:.0f}x{h0:.0f}")


if __name__ == "__main__":
    main()
