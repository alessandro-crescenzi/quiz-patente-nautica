# Quiz Patente Nautica — Categoria A senza limiti (vela + motore)

WebApp di studio interattivo per l'esame teorico della patente nautica
italiana, basata sul DM 323/2021 e sull'allegato A del DD 131/2022.

## Come avviare la WebApp

I file della webapp sono in `app/`. Serve un server HTTP locale (la fetch di
JSON non funziona con `file://`).

```bash
cd app
python3 -m http.server --bind 127.0.0.1 8000
```

Apri http://127.0.0.1:8000 nel browser. Persistenza in IndexedDB (resta tra
sessioni nello stesso browser; per backup, usa "Esporta" se aggiunto in
seguito o duplica il profilo browser).

## Funzionalità

- **Home**: statistiche aggregate, performance per tema (Allegato C), storico sessioni.
- **Simulazione esame**: 20 quiz base (distribuzione Allegato C: 1+1+3+4+2+2+4+3) + 5 quiz vela, timer 30 min + 15 min, navigazione tra domande.
- **Risultato**: esito ufficiale (idoneo se ≥16/20 base e ≥4/5 vela), elenco completo con risposta corretta evidenziata.
- **Domande sbagliate**: filtro sezione/tema, conteggio errori, "Modalità ripasso" senza timer.
- **Revisione anomalie**: report delle anomalie individuate nell'estrazione PDF.

## Struttura del progetto

```
.
├── knowledge_base/        # PDF ufficiali (DM 323/2021, DD 131/2022)
├── data/
│   ├── images/            # 103 figure ritagliate (figura_001..103.png)
│   ├── quiz.json          # output grezzo estrazione
│   ├── quiz.final.json    # output post-processato (consumato dalla webapp)
│   ├── anomalies.json     # report anomalie
│   └── xref_to_figure.json
├── scripts/               # script Python di estrazione e diagnostica
│   ├── extract_figures.py
│   ├── map_xref_to_figure.py
│   ├── extract_quizzes.py
│   ├── postprocess_quiz.py
│   ├── diagnose_extraction.py
│   ├── test_webapp.py     # smoke test Playwright
│   └── test_full_exam.py  # E2E completo
├── app/                   # WebApp (vanilla HTML/JS + TailwindCSS via CDN)
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── main.js
│   │   ├── db.js          # wrapper IndexedDB
│   │   ├── quizData.js    # caricamento dataset + builder set esame
│   │   ├── router.js      # hash router
│   │   └── views/
│   │       ├── home.js
│   │       ├── exam.js
│   │       ├── wrong.js
│   │       └── anomalies.js
│   └── data/              # symlink a ../data
└── venv/                  # virtualenv Python (pdfplumber, pymupdf, pytesseract, playwright)
```

## Rigenerare il dataset dal PDF

```bash
source venv/bin/activate
python3 scripts/extract_figures.py       # produce data/images/*.png
python3 scripts/map_xref_to_figure.py    # OCR mapping xref -> figura
python3 scripts/extract_quizzes.py       # produce data/quiz.json
python3 scripts/postprocess_quiz.py      # produce data/quiz.final.json + anomalies.json
```

## Numeri del dataset

- Quiz base estratti: 1466 (il PDF ne dichiara ~1470; mancano 4 dovuti a tabelle malformate)
- Quiz vela: 250
- Figure ritagliate: 103
- 103 figure citate da almeno una domanda
- Anomalie residue: 21 (vedi pagina "Revisione" nella webapp). La quasi totalità sono "buchi" nella numerazione ufficiale, non quiz mancanti dall'estrazione.

## Limiti noti

1. Il PDF contiene errori tipografici nei progressivi (es. `1.3.2.113`, `1.6.1.97`) che lasciano voci con prog malformato. Sono catalogate in `anomalies.json`.
2. 4 quiz base non sono stati estratti per come pdfplumber identifica le tabelle in alcune pagine. Si può ricuperarli manualmente analizzando le pagine 23 (gruppo 1.2.1) e 26 (gruppo 1.3.4) — vedi anomalie.
3. La distribuzione tematica della simulazione segue Allegato C in modo casuale uniforme; non c'è ancora un weighting dei quiz "meno visti", lo si può aggiungere in `quizData.js#buildExamSet`.
4. Il carteggio nautico è escluso (come richiesto). Per la patente A senza limiti la prova di carteggio è invece obbligatoria — è un secondo modulo da aggiungere in futuro.

## Test

```bash
# Smoke test della webapp (richiede server attivo su 127.0.0.1:8765)
source venv/bin/activate
python3 -m http.server --bind 127.0.0.1 -d app 8765 &
python3 scripts/test_webapp.py
python3 scripts/test_full_exam.py
# Screenshots in data/_screens/
```
