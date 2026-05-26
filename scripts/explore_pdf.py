"""
Esplorazione del PDF allegato A per individuare:
- inizio/fine sezione QUIZ BASE
- inizio/fine sezione QUIZ VELA
- inizio/fine sezione QUIZ CARTEGGIO (per saperla escludere)
- pagine con le figure
"""

import pdfplumber
from pathlib import Path

PDF = Path(__file__).resolve().parents[1] / "knowledge_base" / "ALLEGATO A QUIZ PATENTI NAUTICHE DD 131 DEL 31 MAGGIO 2022.pdf"


def main():
    figure_pages = []
    title_hits = []

    with pdfplumber.open(PDF) as pdf:
        total = len(pdf.pages)
        print(f"Totale pagine: {total}\n")

        for idx, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            upper_lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

            # Cerca righe brevi che contengono "QUIZ" - probabili intestazioni di sezione
            for ln in upper_lines[:8]:
                u = ln.upper()
                if u.startswith("QUIZ ") and len(ln) <= 40:
                    title_hits.append((idx, ln))
                if "CARTEGGIO" in u and len(ln) <= 60:
                    title_hits.append((idx, ln))

            if "pagina" in text.lower() and " di 8" in text.lower():
                figure_pages.append(idx)

    print("=== Titoli sezione trovati ===")
    seen = set()
    for p, label in title_hits:
        key = (p, label)
        if key not in seen:
            seen.add(key)
            print(f"p{p}: {label}")

    print(f"\n=== Pagine figure ===\n{figure_pages}")


if __name__ == "__main__":
    main()
