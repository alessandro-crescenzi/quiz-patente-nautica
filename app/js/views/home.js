import { getAllAttempts, getAllSessions, clearAll } from "../db.js";
import { loadQuiz, ALLEGATO_C } from "../quizData.js";

function pct(n, d) {
  if (!d) return "—";
  return ((n / d) * 100).toFixed(1) + "%";
}

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

export async function renderHome(root) {
  const [quiz, attempts, sessions] = await Promise.all([
    loadQuiz(),
    getAllAttempts(),
    getAllSessions(),
  ]);

  const totBase = quiz.filter((q) => q.sezione === "base").length;
  const totVela = quiz.filter((q) => q.sezione === "vela").length;
  const totalAttempts = attempts.length;
  const correct = attempts.filter((a) => a.corretta).length;

  const finished = sessions.filter((s) => s.finishedAt);
  const passed = finished.filter((s) => s.esito === "idoneo").length;
  const lastSession = finished.sort((a, b) => b.finishedAt - a.finishedAt)[0];

  // Statistiche per tema (base)
  const temaStats = {};
  for (const cat of ALLEGATO_C) {
    temaStats[cat.etichetta] = { ok: 0, ko: 0 };
  }
  const matchTema = (tema) => {
    const up = (tema || "").toUpperCase();
    return ALLEGATO_C.find((c) => up.includes(c.match))?.etichetta;
  };
  for (const a of attempts) {
    const q = quiz.find((qq) => qq.progressivo === a.progressivo);
    if (!q || q.sezione !== "base") continue;
    const label = matchTema(q.tema);
    if (!label) continue;
    if (a.corretta) temaStats[label].ok += 1;
    else temaStats[label].ko += 1;
  }

  root.innerHTML = `
    <section class="grid md:grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-xl shadow p-5">
        <div class="text-sm text-slate-500">Domande disponibili</div>
        <div class="text-2xl font-bold mt-1">${totBase + totVela}</div>
        <div class="text-xs text-slate-400 mt-1">${totBase} base · ${totVela} vela</div>
      </div>
      <div class="bg-white rounded-xl shadow p-5">
        <div class="text-sm text-slate-500">Tentativi totali</div>
        <div class="text-2xl font-bold mt-1">${totalAttempts}</div>
        <div class="text-xs text-slate-400 mt-1">${pct(correct, totalAttempts)} corrette</div>
      </div>
      <div class="bg-white rounded-xl shadow p-5">
        <div class="text-sm text-slate-500">Simulazioni completate</div>
        <div class="text-2xl font-bold mt-1">${finished.length}</div>
        <div class="text-xs text-slate-400 mt-1">${passed} idonee · ultima ${fmtDate(lastSession?.finishedAt)}</div>
      </div>
    </section>

    <section class="grid md:grid-cols-2 gap-4 mb-6">
      <a href="#/esame" class="block bg-sky-700 hover:bg-sky-800 text-white rounded-xl shadow p-6 transition">
        <div class="text-lg font-semibold">▶ Inizia simulazione esame</div>
        <div class="text-sm opacity-90 mt-1">20 quiz base + 5 quiz vela, timer ufficiali, distribuzione Allegato C</div>
      </a>
      <a href="#/sbagliate" class="block bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow p-6 transition">
        <div class="text-lg font-semibold">↺ Rivedi domande sbagliate</div>
        <div class="text-sm opacity-90 mt-1">Riprendi le domande che hai sbagliato e migliora i punti deboli</div>
      </a>
    </section>

    <section class="bg-white rounded-xl shadow p-5 mb-6">
      <h2 class="text-lg font-semibold mb-3">Performance per tema (quiz base)</h2>
      <div class="space-y-2">
        ${ALLEGATO_C.map((cat) => {
          const s = temaStats[cat.etichetta];
          const tot = s.ok + s.ko;
          const p = tot ? (s.ok / tot) * 100 : 0;
          return `
          <div>
            <div class="flex justify-between text-sm">
              <span>${cat.etichetta} <span class="text-xs text-slate-400">(${cat.n} in esame)</span></span>
              <span class="text-slate-500">${tot ? `${s.ok}/${tot} · ${p.toFixed(0)}%` : "—"}</span>
            </div>
            <div class="h-2 bg-slate-200 rounded overflow-hidden">
              <div class="h-full ${p >= 80 ? "bg-emerald-500" : p >= 60 ? "bg-amber-500" : "bg-rose-500"}" style="width: ${tot ? p : 0}%"></div>
            </div>
          </div>`;
        }).join("")}
      </div>
    </section>

    <section class="bg-white rounded-xl shadow p-5">
      <h2 class="text-lg font-semibold mb-3">Storico sessioni</h2>
      ${finished.length === 0 ? `<div class="text-slate-500 text-sm">Nessuna sessione completata.</div>` :
        `<table class="w-full text-sm">
          <thead><tr class="text-left text-slate-500 border-b">
            <th class="py-2">Quando</th><th>Base</th><th>Vela</th><th>Esito</th>
          </tr></thead>
          <tbody>
            ${finished.sort((a, b) => b.finishedAt - a.finishedAt).slice(0, 10).map((s) => `
              <tr class="border-b last:border-0">
                <td class="py-2">${fmtDate(s.finishedAt)}</td>
                <td>${s.baseScore ?? "—"} / 20</td>
                <td>${s.velaScore ?? "—"} / 5</td>
                <td>${s.esito === "idoneo" ? `<span class="text-emerald-700 font-semibold">Idoneo</span>` : `<span class="text-rose-700">Non idoneo</span>`}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`}
    </section>

    ${totalAttempts > 0 ? `
      <div class="text-right mt-6">
        <button id="reset-btn" class="text-xs text-rose-600 hover:underline">Azzera statistiche</button>
      </div>
    ` : ""}
  `;

  const reset = root.querySelector("#reset-btn");
  if (reset) {
    reset.addEventListener("click", async () => {
      if (confirm("Azzero tutte le statistiche locali. Procedo?")) {
        await clearAll();
        location.reload();
      }
    });
  }
}
