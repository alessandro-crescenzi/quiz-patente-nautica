"""
Estrazione completa quiz BASE (p1-246) e quiz VELA (p247-278) dal PDF Allegato A.

Per ogni pagina:
1. Estrai tabella con pdfplumber (ottiene celle testuali)
2. Recupera immagini incorporate "figura N" (xref + bbox)
3. Per ogni riga della tabella, controlla se nella bbox della cella IMMAGINE
   cade una immagine incorporata; in tal caso il numero figura corrisponde
   all'xref via la mappa xref_to_figure.json
4. Costruisce record {sezione, progressivo, capitolo, tema, voce, domanda,
   risposte:[{testo, corretta}], figura}

Output: data/quiz.json
"""

import json
import re
from pathlib import Path

import fitz
import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "knowledge_base" / "ALLEGATO A QUIZ PATENTI NAUTICHE DD 131 DEL 31 MAGGIO 2022.pdf"
XREF_MAP_PATH = ROOT / "data" / "xref_to_figure.json"
OUT = ROOT / "data" / "quiz.json"

BASE_PAGES = range(1, 247)   # 1-246
VELA_PAGES = range(247, 279) # 247-278

# Indici colonna nella tabella base (13 colonne):
#  0 numero_locale (numero riga in pagina)
#  1 IMMAGINE
#  2 DOMANDA
#  3 RISPOSTA 1
#  4 V/F
#  5 RSPOSTA 2 (sic)
#  6 V/F
#  7 RISPOSTA 3
#  8 V/F
#  9 PROGRESSIVO
# 10 CAPITOLO
# 11 TEMA
# 12 VOCE

# Quiz vela (11 colonne): senza RISPOSTA 3 e V/F


def clean(s: str | None) -> str:
    if not s:
        return ""
    # normalizza newline interni in spazi (i campi pdf hanno \n da wrap)
    s = s.replace(" ", " ")
    s = re.sub(r"\s*\n\s*", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


PROG_OK_RE = re.compile(r"^\d+\.\d+\.\d+-\d+$")


def bbox_overlap(b1, b2) -> bool:
    """True se due bbox (x0,y0,x1,y1) si sovrappongono."""
    return not (b1[2] < b2[0] or b1[0] > b2[2] or b1[3] < b2[1] or b1[1] > b2[3])


def bbox_center_inside(b_inner, b_outer) -> bool:
    cx = (b_inner[0] + b_inner[2]) / 2
    cy = (b_inner[1] + b_inner[3]) / 2
    return b_outer[0] <= cx <= b_outer[2] and b_outer[1] <= cy <= b_outer[3]


def load_xref_map():
    with open(XREF_MAP_PATH) as f:
        return {int(k): int(v) for k, v in json.load(f).items()}


def extract_rows_for_page(pl_page, fitz_page, xref_map, section: str, expected_cols: int):
    """Estrae le righe di una pagina come record dict."""
    out_records = []
    # Tabelle pdfplumber
    tables = pl_page.find_tables()
    # Immagini incorporate con bbox (PyMuPDF). bbox in coord pdf (origine top-left).
    images_info = fitz_page.get_image_info(xrefs=True)

    for t in tables:
        rows = t.rows
        # Skip eventuale prima riga = header
        for r_idx, row in enumerate(rows):
            cells = row.cells  # lista di bbox tuple o None
            # Recupera testo da extract_tables sulla stessa cella
            # Usiamo direttamente t.extract() che restituisce text matrix
            pass
        text_matrix = t.extract()
        if not text_matrix:
            continue
        # Identifica righe dati saltando header
        for r_idx, (row_cells_bbox, row_texts) in enumerate(zip(rows, text_matrix)):
            cells_bbox = row_cells_bbox.cells
            if not row_texts or len(row_texts) < expected_cols:
                continue
            # Header se contiene "DOMANDA"
            joined = " ".join((c or "") for c in row_texts).upper()
            if "DOMANDA" in joined and "RISPOSTA" in joined:
                continue

            if section == "base":
                # 13 colonne attese
                if len(row_texts) != 13:
                    continue
                _num_loc, _img, dom, r1, vf1, r2, vf2, r3, vf3, prog, cap, tema, voce = row_texts
                immagine_bbox = cells_bbox[1] if len(cells_bbox) > 1 else None
                risposte = [
                    (clean(r1), (vf1 or "").strip().upper() == "V"),
                    (clean(r2), (vf2 or "").strip().upper() == "V"),
                    (clean(r3), (vf3 or "").strip().upper() == "V"),
                ]
            else:  # vela
                if len(row_texts) != 11:
                    continue
                _num_loc, _img, dom, r1, vf1, r2, vf2, prog, cap, tema, voce = row_texts
                immagine_bbox = cells_bbox[1] if len(cells_bbox) > 1 else None
                risposte = [
                    (clean(r1), (vf1 or "").strip().upper() == "V"),
                    (clean(r2), (vf2 or "").strip().upper() == "V"),
                ]

            dom = clean(dom)
            prog = clean(prog)
            cap = clean(cap)
            tema = clean(tema)
            voce = clean(voce)

            if not dom or not prog:
                continue

            # Trova figura
            figura = None
            if immagine_bbox is not None:
                # Estendi un po' la bbox per sicurezza
                ex = (immagine_bbox[0] - 1, immagine_bbox[1] - 1, immagine_bbox[2] + 1, immagine_bbox[3] + 1)
                for im in images_info:
                    xref = im.get("xref")
                    if not xref or xref not in xref_map:
                        continue
                    if bbox_center_inside(im["bbox"], ex):
                        figura = xref_map[xref]
                        break

            record = {
                "sezione": section,
                "progressivo": prog,
                "capitolo": cap,
                "tema": tema,
                "voce": voce,
                "domanda": dom,
                "risposte": [{"testo": t_, "corretta": ok} for t_, ok in risposte],
                "figura": figura,
            }
            out_records.append(record)
    return out_records


def main():
    xref_map = load_xref_map()
    all_records = []

    with pdfplumber.open(PDF) as plumber:
        fdoc = fitz.open(PDF)
        for pnum in BASE_PAGES:
            pl_page = plumber.pages[pnum - 1]
            f_page = fdoc[pnum - 1]
            recs = extract_rows_for_page(pl_page, f_page, xref_map, "base", 13)
            all_records.extend(recs)
        print(f"Quiz base estratti: {sum(1 for r in all_records if r['sezione']=='base')}")
        for pnum in VELA_PAGES:
            pl_page = plumber.pages[pnum - 1]
            f_page = fdoc[pnum - 1]
            recs = extract_rows_for_page(pl_page, f_page, xref_map, "vela", 11)
            all_records.extend(recs)
        vela_count = sum(1 for r in all_records if r["sezione"] == "vela")
        print(f"Quiz vela estratti: {vela_count}")
        fdoc.close()

    # Statistiche
    figure_used = sorted({r["figura"] for r in all_records if r["figura"] is not None})
    base_with_fig = sum(1 for r in all_records if r["sezione"] == "base" and r["figura"])
    vela_with_fig = sum(1 for r in all_records if r["sezione"] == "vela" and r["figura"])
    print(f"Domande con figura associata: base={base_with_fig} vela={vela_with_fig}")
    print(f"Numero figure citate distinte: {len(figure_used)} range {figure_used[:5]}..{figure_used[-5:]}")

    OUT.write_text(json.dumps(all_records, ensure_ascii=False, indent=2))
    print(f"Scritto {OUT} con {len(all_records)} quiz")


if __name__ == "__main__":
    main()
