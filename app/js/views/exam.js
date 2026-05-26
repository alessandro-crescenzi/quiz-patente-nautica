import { buildExamSet, ALLEGATO_C } from "../quizData.js";
import { addAttempt, addSession, updateSession } from "../db.js";
import { go } from "../router.js";

// Stato corrente esame in memoria
let exam = null;

const BASE_TIME_MS = 30 * 60 * 1000;
const VELA_TIME_MS = 15 * 60 * 1000;

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtTime(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.ceil(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function currentQuestion() {
  if (exam.fase === "base") return exam.base[exam.cursore];
  return exam.vela[exam.cursore];
}

function listForFase() {
  return exam.fase === "base" ? exam.base : exam.vela;
}

function risposteForFase() {
  return exam.fase === "base" ? exam.risposteBase : exam.risposteVela;
}

async function startExam(root) {
  const { base, vela } = await buildExamSet();
  const now = Date.now();
  const sessionId = await addSession({
    startedAt: now,
    finishedAt: null,
    baseScore: null,
    velaScore: null,
    base20: base.map((q) => q.progressivo),
    vela5: vela.map((q) => q.progressivo),
    esito: null,
  });

  exam = {
    sessionId,
    base,
    vela,
    fase: "base",
    cursore: 0,
    risposteBase: new Array(base.length).fill(null),
    risposteVela: new Array(vela.length).fill(null),
    timerBaseFineMs: now + BASE_TIME_MS,
    timerVelaFineMs: null, // partira' quando fase=='vela'
    timerInterval: null,
  };
  renderExam(root);
}

function startTimer(root) {
  if (exam.timerInterval) clearInterval(exam.timerInterval);
  exam.timerInterval = setInterval(() => {
    const el = root.querySelector("#timer");
    if (!el) return;
    const fine = exam.fase === "base" ? exam.timerBaseFineMs : exam.timerVelaFineMs;
    const ms = fine - Date.now();
    el.textContent = `⏱ ${fmtTime(ms)}`;
    if (ms <= 60_000) el.classList.add("timer-warning");
    if (ms <= 0) {
      clearInterval(exam.timerInterval);
      if (exam.fase === "base") onFinishBase(root);
      else onFinishVela(root);
    }
  }, 250);
}

function renderHeader(root) {
  const lista = listForFase();
  const totale = lista.length;
  const cur = exam.cursore + 1;
  const titolo = exam.fase === "base" ? "Quiz base (20)" : "Quiz vela (5)";
  return `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold">${titolo} · ${cur}/${totale}</h1>
      <div id="timer" class="text-lg font-mono px-3 py-1 bg-white rounded shadow">⏱ --:--</div>
    </div>
    <div class="flex flex-wrap gap-1 mb-4">
      ${lista.map((_, i) => {
        const risp = risposteForFase()[i];
        const cls = i === exam.cursore
          ? "bg-sky-700 text-white"
          : risp !== null
          ? "bg-emerald-200"
          : "bg-slate-200";
        return `<button class="qnav w-8 h-8 rounded text-sm font-semibold ${cls}" data-idx="${i}">${i + 1}</button>`;
      }).join("")}
    </div>
  `;
}

function renderQuestion(root) {
  const q = currentQuestion();
  const lista = listForFase();
  const risp = risposteForFase();
  const sel = risp[exam.cursore];
  const fig = q.figura ? `<img class="figura-img mb-3" src="data/images/figura_${String(q.figura).padStart(3, "0")}.png" alt="figura ${q.figura}" />` : "";
  const tema = q._cat ? `<div class="text-xs text-slate-500 mb-2">${escapeHtml(q._cat)}</div>` : `<div class="text-xs text-slate-500 mb-2">${escapeHtml(q.tema)}</div>`;
  const risposteHtml = q.risposte.map((r, i) => {
    const isSel = sel === i;
    return `
      <button class="risp w-full text-left px-4 py-3 rounded-lg border ${isSel ? "border-sky-600 bg-sky-50 ring-2 ring-sky-600" : "border-slate-300 bg-white hover:bg-slate-50"}" data-i="${i}">
        <span class="font-semibold mr-2">${String.fromCharCode(65 + i)}.</span>${escapeHtml(r.testo)}
      </button>
    `;
  }).join("");
  return `
    <div class="bg-white rounded-xl shadow p-5 mb-4">
      ${tema}
      ${fig}
      <div class="text-base mb-4">${escapeHtml(q.domanda)}</div>
      <div class="grid gap-2 btn-grid">
        ${risposteHtml}
      </div>
    </div>
    <div class="flex items-center justify-between">
      <button id="prev" class="px-4 py-2 rounded bg-slate-200 hover:bg-slate-300 ${exam.cursore === 0 ? "invisible" : ""}">← Indietro</button>
      <div class="text-xs text-slate-500">Progressivo: ${q.progressivo}</div>
      ${exam.cursore < lista.length - 1
        ? `<button id="next" class="px-4 py-2 rounded bg-sky-700 text-white hover:bg-sky-800">Avanti →</button>`
        : exam.fase === "base"
        ? `<button id="endbase" class="px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-700">Concludi base →</button>`
        : `<button id="endvela" class="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700">Concludi esame ✓</button>`}
    </div>
  `;
}

function renderExam(root) {
  root.innerHTML = `<div>${renderHeader(root)}${renderQuestion(root)}</div>`;
  bindEvents(root);
  startTimer(root);
}

function bindEvents(root) {
  root.querySelectorAll(".risp").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.i);
      risposteForFase()[exam.cursore] = i;
      renderExam(root);
    });
  });
  root.querySelectorAll(".qnav").forEach((btn) => {
    btn.addEventListener("click", () => {
      exam.cursore = Number(btn.dataset.idx);
      renderExam(root);
    });
  });
  const prev = root.querySelector("#prev");
  if (prev) prev.addEventListener("click", () => { exam.cursore--; renderExam(root); });
  const next = root.querySelector("#next");
  if (next) next.addEventListener("click", () => { exam.cursore++; renderExam(root); });
  const endb = root.querySelector("#endbase");
  if (endb) endb.addEventListener("click", () => onFinishBase(root));
  const endv = root.querySelector("#endvela");
  if (endv) endv.addEventListener("click", () => onFinishVela(root));
}

function confermaEFinisci(msg) {
  return confirm(msg);
}

async function onFinishBase(root) {
  if (exam.fase !== "base") return;
  // Conferma se ci sono domande senza risposta
  const skipped = exam.risposteBase.filter((r) => r === null).length;
  if (skipped > 0 && Date.now() < exam.timerBaseFineMs) {
    if (!confermaEFinisci(`Hai ${skipped} domanda/e senza risposta nel quiz base. Le omesse contano come errate. Procedo?`)) return;
  }
  exam.fase = "vela";
  exam.cursore = 0;
  exam.timerVelaFineMs = Date.now() + VELA_TIME_MS;
  renderExam(root);
}

async function onFinishVela(root) {
  if (exam.fase !== "vela") return;
  const skipped = exam.risposteVela.filter((r) => r === null).length;
  if (skipped > 0 && Date.now() < exam.timerVelaFineMs) {
    if (!confermaEFinisci(`Hai ${skipped} domanda/e senza risposta nel quiz vela. Le omesse contano come errate. Procedo?`)) return;
  }
  clearInterval(exam.timerInterval);
  await persistResults();
  go("#/esame/risultato");
}

async function persistResults() {
  let baseScore = 0;
  for (let i = 0; i < exam.base.length; i++) {
    const q = exam.base[i];
    const idx = exam.risposteBase[i];
    const corretta = idx !== null && q.risposte[idx]?.corretta === true;
    if (corretta) baseScore++;
    await addAttempt({
      sessionId: exam.sessionId,
      progressivo: q.progressivo,
      sezione: "base",
      indiceRispostaScelta: idx,
      corretta,
    });
  }
  let velaScore = 0;
  for (let i = 0; i < exam.vela.length; i++) {
    const q = exam.vela[i];
    const idx = exam.risposteVela[i];
    const corretta = idx !== null && q.risposte[idx]?.corretta === true;
    if (corretta) velaScore++;
    await addAttempt({
      sessionId: exam.sessionId,
      progressivo: q.progressivo,
      sezione: "vela",
      indiceRispostaScelta: idx,
      corretta,
    });
  }
  const esito = baseScore >= 16 && velaScore >= 4 ? "idoneo" : "non_idoneo";
  await updateSession(exam.sessionId, {
    finishedAt: Date.now(),
    baseScore,
    velaScore,
    esito,
  });
  exam.baseScore = baseScore;
  exam.velaScore = velaScore;
  exam.esito = esito;
}

export async function renderEsame(root) {
  await startExam(root);
}

export async function renderRisultato(root) {
  if (!exam || !exam.esito) {
    root.innerHTML = `<div class="text-center py-10">Nessun esame in corso. <a class="text-sky-700 underline" href="#/home">Torna alla home</a>.</div>`;
    return;
  }
  const { base, vela, risposteBase, risposteVela, baseScore, velaScore, esito } = exam;

  function rispostaCardForList(list, risposte, sezione) {
    return list.map((q, i) => {
      const idx = risposte[i];
      const ok = idx !== null && q.risposte[idx]?.corretta;
      const fig = q.figura ? `<img class="figura-img mt-2" src="data/images/figura_${String(q.figura).padStart(3, "0")}.png" alt="figura ${q.figura}" />` : "";
      const rispHtml = q.risposte.map((r, j) => {
        const isSel = idx === j;
        const isCorrect = r.corretta;
        const cls = isCorrect
          ? "bg-emerald-100 border-emerald-500"
          : isSel
          ? "bg-rose-100 border-rose-500"
          : "border-slate-200";
        return `
          <li class="px-3 py-2 rounded border ${cls} text-sm">
            <span class="font-semibold mr-1">${String.fromCharCode(65 + j)}.</span>${escapeHtml(r.testo)}
            ${isCorrect ? '<span class="ml-2 text-emerald-700 font-semibold text-xs">✓ corretta</span>' : ""}
            ${isSel && !isCorrect ? '<span class="ml-2 text-rose-700 font-semibold text-xs">tua scelta</span>' : ""}
            ${isSel && isCorrect ? '<span class="ml-2 text-emerald-700 text-xs">(tua scelta)</span>' : ""}
          </li>`;
      }).join("");
      return `
        <article class="bg-white rounded-xl shadow p-4 mb-3">
          <div class="flex items-start justify-between text-xs text-slate-500 mb-1">
            <span>${sezione === "base" ? (q._cat || q.tema) : q.tema} · ${q.progressivo}</span>
            <span class="${ok ? "text-emerald-700" : "text-rose-700"} font-semibold">${ok ? "✓ Corretta" : "✗ Errata"}</span>
          </div>
          <div class="font-medium mb-2">${escapeHtml(q.domanda)}</div>
          ${fig}
          <ul class="space-y-1 mt-2">${rispHtml}</ul>
        </article>
      `;
    }).join("");
  }

  const idoneo = esito === "idoneo";
  root.innerHTML = `
    <section class="rounded-xl p-6 mb-6 ${idoneo ? "bg-emerald-100 border border-emerald-300" : "bg-rose-100 border border-rose-300"}">
      <div class="text-3xl font-bold mb-2 ${idoneo ? "text-emerald-800" : "text-rose-800"}">${idoneo ? "✓ Idoneo" : "✗ Non idoneo"}</div>
      <div class="grid grid-cols-2 gap-4 mt-3">
        <div>
          <div class="text-sm text-slate-600">Quiz base</div>
          <div class="text-xl font-semibold">${baseScore} / 20 ${baseScore >= 16 ? "(≥16 ✓)" : "(serve ≥16)"}</div>
        </div>
        <div>
          <div class="text-sm text-slate-600">Quiz vela</div>
          <div class="text-xl font-semibold">${velaScore} / 5 ${velaScore >= 4 ? "(≥4 ✓)" : "(serve ≥4)"}</div>
        </div>
      </div>
      <div class="mt-4 flex gap-2">
        <a href="#/home" class="px-4 py-2 rounded bg-slate-200 hover:bg-slate-300">Home</a>
        <a href="#/esame" class="px-4 py-2 rounded bg-sky-700 text-white hover:bg-sky-800">Nuova simulazione</a>
      </div>
    </section>
    <h2 class="text-lg font-semibold mt-6 mb-2">Quiz base</h2>
    ${rispostaCardForList(base, risposteBase, "base")}
    <h2 class="text-lg font-semibold mt-6 mb-2">Quiz vela</h2>
    ${rispostaCardForList(vela, risposteVela, "vela")}
  `;
}
