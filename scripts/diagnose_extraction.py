"""Diagnosi della estrazione: trova quiz mancanti e figure sospette."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUIZ_JSON = ROOT / "data" / "quiz.json"
XREF_MAP_PATH = ROOT / "data" / "xref_to_figure.json"

with open(QUIZ_JSON) as f:
    quizzes = json.load(f)

base = [q for q in quizzes if q["sezione"] == "base"]
vela = [q for q in quizzes if q["sezione"] == "vela"]
print(f"base={len(base)} vela={len(vela)}")

# Analizza progressivi base. Formato tipico: 1.1.1-1, 8.4.5-23, ...
prog_re = re.compile(r"^(\d+)\.(\d+)\.(\d+)-(\d+)$")
parsed = []
malformed = []
for q in base:
    m = prog_re.match(q["progressivo"])
    if m:
        parsed.append(tuple(int(g) for g in m.groups()) + (q["progressivo"],))
    else:
        malformed.append(q["progressivo"])

print(f"\nProgressivi malformed (base): {len(malformed)}")
for p in malformed[:20]:
    print(f"  -> {p!r}")

# Trova gap nel progressivo "numero finale" all'interno di ciascun gruppo (cap.tema.voce)
from collections import defaultdict
groups = defaultdict(list)
for cap, tema, voce, n, raw in parsed:
    groups[(cap, tema, voce)].append((n, raw))

gaps = []
for k, lst in groups.items():
    lst.sort(key=lambda x: x[0])
    nums = [n for n, _ in lst]
    expected = set(range(1, max(nums) + 1))
    missing = sorted(expected - set(nums))
    if missing:
        gaps.append((k, missing))

print(f"\nGruppi con gap (potenziali quiz mancanti):")
for k, miss in gaps[:30]:
    print(f"  {k}: missing {miss}")
print(f"Totale numeri mancanti: {sum(len(m) for _, m in gaps)}")

# Conta totale
total_max = sum(max(n for n, _ in lst) for lst in groups.values())
print(f"\nSomma dei massimi nei gruppi: {total_max} (atteso: 1472)")

# Figure sospette
xref_map = json.load(open(XREF_MAP_PATH))
strange = [(x, n) for x, n in xref_map.items() if int(n) > 103]
print(f"\nXref con numero figura > 103 (sospetti): {strange}")
