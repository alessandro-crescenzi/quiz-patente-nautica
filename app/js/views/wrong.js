import { getWrongAttempts, addAttempt } from "../db.js";
import { loadQuiz, ALLEGATO_C } from "../quizData.js";

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

let ripassoState = null; // { lista, idx, mostrandoRisposta, scelte }

async function buildLista(filtroSezione, filtroTema) {
  const [quiz, wrong] = await Promise.all([loadQuiz(), getWrongAttempts()]);
  const counts = new Map();
  for (const a of wrong) {
    counts.set(a.progressivo, (counts.get(a.progressivo) || 0) + 1);
  }
  const progs = Array.from(counts.keys());
  let items = progs.map((p) => {
    const q = quiz.find((qq) => qq.progressivo === p);
    return q ? { ...q, _ko: counts.get(p) } : null;
  }).filter(Boolean);
  if (filtroSezione !== "tutte") items = items.filter((q) => q.sezione === filtroSezione);
  if (filtroTema !== "tutti") {
    items = items.filter((q) => (q.tema || "").toUpperCase().includes(filtroTema));
  }
  items.sort((a, b) => b._ko - a._ko);
  return items;
}

export async function renderSbagliate(root) {
  const url = new URL(location.href);
  const state = {
    sezione: url.searchParams.get("sez") || "tutte",
    tema: url.searchParams.get("tema") || "tutti",
  };
  const lista = await buildLista(state.sezione, state.tema);

  const temaOpts = ['<option value="tutti">Tutti i temi</option>',
    ...ALLEGATO_C.map((c) => `<option value="${c.match}" ${state.tema === c.match ? "selected" : ""}>${c.etichetta}</option>`)
  ].join("");

  root.innerHTML = `
    <h1 class="text-xl font-bold mb-4">Domande sbagliate</h1>
    <div class="flex flex-wrap gap-3 mb-4 items-end">
      <div>
        <label class="block text-xs text-slate-500 mb-1">Sezione</label>
        <select id="sel-sez" class="border border-slate-300 rounded px-2 py-1 text-sm">
          <option value="tutte" ${state.sezione === "tutte" ? "selected" : ""}>Tutte</option>
          <option value="base" ${state.sezione === "base" ? "selected" : ""}>Base</option>
          <option value="vela" ${state.sezione === "vela" ? "selected" : ""}>Vela</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-slate-500 mb-1">Tema</label>
        <select id="sel-tema" class="border border-slate-300 rounded px-2 py-1 text-sm">${temaOpts}</select>
      </div>
      <button id="ripassa" class="ml-auto px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 ${lista.length ? "" : "opacity-50 cursor-not-allowed"}" ${lista.length ? "" : "disabled"}>
        ▶ Modalità ripasso (${lista.length})
      </button>
    </div>
    ${lista.length === 0 ? `
      <div class="bg-white rounded-xl shadow p-6 text-center text-slate-500">
        Nessuna domanda sbagliata che corrisponda ai filtri. <a href="#/esame" class="text-sky-700 underline">Inizia una simulazione</a> oppure fai qualche errore deliberato.
      </div>
    ` : lista.map((q) => `
      <article class="bg-white rounded-xl shadow p-4 mb-3 q-card">
        <div class="flex items-start justify-between text-xs text-slate-500 mb-1">
          <span>${escapeHtml(q.tema)} · ${q.progressivo}</span>
          <span class="text-rose-700 font-semibold">sbagliata ${q._ko}×</span>
        </div>
        <div class="font-medium">${escapeHtml(q.domanda)}</div>
        ${q.figura ? `<img class="figura-img mt-2" src="data/images/figura_${String(q.figura).padStart(3, "0")}.png" alt="figura ${q.figura}" />` : ""}
        <details class="mt-2 text-sm">
          <summary class="cursor-pointer text-sky-700">Vedi risposta corretta</summary>
          <ul class="mt-2 space-y-1">
            ${q.risposte.map((r, j) => `
              <li class="${r.corretta ? "text-emerald-700 font-semibold" : "text-slate-700"}">${String.fromCharCode(65 + j)}. ${escapeHtml(r.testo)} ${r.corretta ? "✓" : ""}</li>
            `).join("")}
          </ul>
        </details>
      </article>
    `).join("")}
  `;

  root.querySelector("#sel-sez")?.addEventListener("change", (e) => {
    const u = new URL(location.href);
    u.searchParams.set("sez", e.target.value);
    history.replaceState({}, "", u);
    renderSbagliate(root);
  });
  root.querySelector("#sel-tema")?.addEventListener("change", (e) => {
    const u = new URL(location.href);
    u.searchParams.set("tema", e.target.value);
    history.replaceState({}, "", u);
    renderSbagliate(root);
  });
  root.querySelector("#ripassa")?.addEventListener("click", () => {
    ripassoState = { lista, idx: 0, scelta: null, rivelato: false };
    renderRipasso(root);
  });
}

function renderRipasso(root) {
  if (!ripassoState || !ripassoState.lista.length) {
    renderSbagliate(root);
    return;
  }
  const { lista, idx, scelta, rivelato } = ripassoState;
  const q = lista[idx];
  const rispHtml = q.risposte.map((r, j) => {
    const isSel = scelta === j;
    let cls = "border-slate-300 bg-white hover:bg-slate-50";
    if (rivelato) {
      if (r.corretta) cls = "border-emerald-500 bg-emerald-50";
      else if (isSel) cls = "border-rose-500 bg-rose-50";
    } else if (isSel) {
      cls = "border-sky-600 bg-sky-50 ring-2 ring-sky-600";
    }
    return `<button class="ripasso-r w-full text-left px-4 py-3 rounded border ${cls}" data-i="${j}">
      <span class="font-semibold mr-2">${String.fromCharCode(65 + j)}.</span>${escapeHtml(r.testo)}
      ${rivelato && r.corretta ? '<span class="ml-2 text-emerald-700 text-xs">✓ corretta</span>' : ""}
    </button>`;
  }).join("");
  root.innerHTML = `
    <div class="mb-3 flex items-center justify-between">
      <h1 class="text-lg font-semibold">Ripasso · ${idx + 1}/${lista.length}</h1>
      <button id="exit-rip" class="text-sm text-slate-500 hover:underline">Esci ripasso</button>
    </div>
    <div class="bg-white rounded-xl shadow p-5 mb-4">
      <div class="text-xs text-slate-500 mb-1">${escapeHtml(q.tema)} · ${q.progressivo}</div>
      <div class="text-base mb-3">${escapeHtml(q.domanda)}</div>
      ${q.figura ? `<img class="figura-img mb-3" src="data/images/figura_${String(q.figura).padStart(3, "0")}.png" alt="figura ${q.figura}" />` : ""}
      <div class="grid gap-2 btn-grid">${rispHtml}</div>
      ${rivelato ? `
        <div class="mt-4 flex gap-2 justify-end">
          ${idx > 0 ? `<button id="rip-prev" class="px-4 py-2 rounded bg-slate-200 hover:bg-slate-300">← Indietro</button>` : ""}
          ${idx < lista.length - 1
            ? `<button id="rip-next" class="px-4 py-2 rounded bg-sky-700 text-white hover:bg-sky-800">Prossima →</button>`
            : `<button id="rip-end" class="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700">Fine ripasso ✓</button>`}
        </div>
      ` : ""}
    </div>
  `;
  root.querySelectorAll(".ripasso-r").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (ripassoState.rivelato) return;
      const i = Number(btn.dataset.i);
      ripassoState.scelta = i;
      ripassoState.rivelato = true;
      const corretta = q.risposte[i]?.corretta === true;
      await addAttempt({
        sessionId: null,
        progressivo: q.progressivo,
        sezione: q.sezione,
        indiceRispostaScelta: i,
        corretta,
        modo: "ripasso",
      });
      renderRipasso(root);
    });
  });
  root.querySelector("#rip-prev")?.addEventListener("click", () => {
    ripassoState.idx--; ripassoState.scelta = null; ripassoState.rivelato = false;
    renderRipasso(root);
  });
  root.querySelector("#rip-next")?.addEventListener("click", () => {
    ripassoState.idx++; ripassoState.scelta = null; ripassoState.rivelato = false;
    renderRipasso(root);
  });
  root.querySelector("#rip-end")?.addEventListener("click", () => {
    ripassoState = null;
    renderSbagliate(root);
  });
  root.querySelector("#exit-rip")?.addEventListener("click", () => {
    ripassoState = null;
    renderSbagliate(root);
  });
}
