// Mini UI di revisione: mostra il report anomalie generato dal post-processor
export async function renderAnomalie(root) {
  let anomalies = [];
  try {
    const res = await fetch("data/anomalies.json", { cache: "no-cache" });
    if (res.ok) anomalies = await res.json();
  } catch (e) {
    // file mancante e' tollerabile
  }
  const groups = {};
  for (const a of anomalies) {
    groups[a.tipo] = groups[a.tipo] || [];
    groups[a.tipo].push(a);
  }
  root.innerHTML = `
    <h1 class="text-xl font-bold mb-4">Revisione anomalie del dataset</h1>
    <p class="text-sm text-slate-600 mb-4">
      Queste sono le anomalie individuate durante l'estrazione del PDF ufficiale.
      Le voci con progressivo mancante sono spesso buchi nel database ministeriale (numerazione non continua) e non quiz davvero persi.
    </p>
    ${Object.keys(groups).length === 0
      ? `<div class="bg-white rounded-xl shadow p-6 text-center text-slate-500">Nessuna anomalia. Tutto pulito.</div>`
      : Object.entries(groups).map(([tipo, items]) => `
        <section class="mb-6">
          <h2 class="font-semibold mb-2">${tipo} <span class="text-slate-400 text-sm">(${items.length})</span></h2>
          <div class="space-y-1 bg-white rounded-xl shadow p-3">
            ${items.slice(0, 40).map((a) => `
              <div class="text-sm border-b last:border-0 py-1">
                <pre class="whitespace-pre-wrap font-mono text-xs">${JSON.stringify(a, null, 2)}</pre>
              </div>
            `).join("")}
            ${items.length > 40 ? `<div class="text-xs text-slate-500">… e altre ${items.length - 40} voci</div>` : ""}
          </div>
        </section>
      `).join("")}
  `;
}

