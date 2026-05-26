"""
Post-process di data/quiz.json:
- fix progressivi malformati sicuri (riconoscibili dal contesto)
- genera data/anomalies.json
- scrive data/quiz.final.json consumato dalla webapp
"""

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "quiz.json"
OUTPUT = ROOT / "data" / "quiz.final.json"
ANOMALIES = ROOT / "data" / "anomalies.json"

PROG_OK_RE = re.compile(r"^\d+\.\d+\.\d+-\d+$")

# Fix automatici basati su analisi PDF (cfr. note nel piano)
MANUAL_PROG_FIXES = {
    "zzetto1 d.1i. 1p-o8ppa.": "1.1.1-8",
    "1.8.1.38": "1.8.1-38",
}


def main():
    quizzes = json.loads(INPUT.read_text())
    anomalies = []
    fixed = 0

    for q in quizzes:
        prog = q["progressivo"]
        if prog in MANUAL_PROG_FIXES:
            q["progressivo"] = MANUAL_PROG_FIXES[prog]
            q.setdefault("_meta", {})["originalProg"] = prog
            fixed += 1
        elif not PROG_OK_RE.match(prog):
            anomalies.append({
                "tipo": "progressivo_malformato",
                "progressivo": prog,
                "domanda": q["domanda"],
                "tema": q["tema"],
                "voce": q["voce"],
            })

        # risposte corrette
        n_corrette = sum(1 for r in q["risposte"] if r["corretta"])
        if n_corrette != 1:
            anomalies.append({
                "tipo": "risposte_corrette_anomale",
                "progressivo": q["progressivo"],
                "domanda": q["domanda"],
                "n_corrette": n_corrette,
            })

        # domanda vuota
        if not q["domanda"].strip():
            anomalies.append({
                "tipo": "domanda_vuota",
                "progressivo": q["progressivo"],
            })

        # risposte vuote
        for i, r in enumerate(q["risposte"]):
            if not r["testo"].strip():
                anomalies.append({
                    "tipo": "risposta_vuota",
                    "progressivo": q["progressivo"],
                    "indice": i,
                })

    # Gap analysis per gruppo (capitolo, tema, voce decoded da progressivo)
    base = [q for q in quizzes if q["sezione"] == "base" and PROG_OK_RE.match(q["progressivo"])]
    groups = defaultdict(list)
    for q in base:
        m = re.match(r"^(\d+)\.(\d+)\.(\d+)-(\d+)$", q["progressivo"])
        if m:
            k = (int(m.group(1)), int(m.group(2)), int(m.group(3)))
            groups[k].append(int(m.group(4)))
    for k, nums in groups.items():
        nums_set = set(nums)
        expected = set(range(1, max(nums) + 1))
        missing = sorted(expected - nums_set)
        for n in missing:
            anomalies.append({
                "tipo": "numero_progressivo_mancante",
                "gruppo": f"{k[0]}.{k[1]}.{k[2]}",
                "numero_mancante": n,
                "max_nel_gruppo": max(nums),
            })

    # Salva
    OUTPUT.write_text(json.dumps(quizzes, ensure_ascii=False, indent=2))
    ANOMALIES.write_text(json.dumps(anomalies, ensure_ascii=False, indent=2))
    print(f"Prog fix automatici: {fixed}")
    print(f"Anomalie totali: {len(anomalies)}")
    by_type = defaultdict(int)
    for a in anomalies:
        by_type[a["tipo"]] += 1
    for t, n in sorted(by_type.items()):
        print(f"  {t}: {n}")
    print(f"\nScritti:\n  {OUTPUT}\n  {ANOMALIES}")


if __name__ == "__main__":
    main()
