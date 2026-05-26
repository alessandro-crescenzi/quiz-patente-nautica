import { register, startRouter } from "./router.js";
import { renderHome } from "./views/home.js";
import { renderEsame, renderRisultato } from "./views/exam.js";
import { renderSbagliate } from "./views/wrong.js";
import { renderAnomalie } from "./views/anomalies.js";

register("home", renderHome);
register("esame", renderEsame);
register("esame/risultato", renderRisultato);
register("sbagliate", renderSbagliate);
register("anomalie", renderAnomalie);

window.addEventListener("error", (e) => {
  console.error(e.error || e.message);
  const view = document.getElementById("view");
  if (view) {
    view.innerHTML = `<div class="bg-rose-50 border border-rose-300 rounded p-4 text-rose-800">
      <div class="font-semibold">Errore: ${e.message}</div>
      <div class="text-xs mt-1">Apri la console del browser per i dettagli. Se hai aperto la pagina come <code>file://</code>, esegui <code>python3 -m http.server</code> nella cartella <code>app/</code>.</div>
    </div>`;
  }
});

startRouter();
