// Carica e gestisce il dataset quiz
let cache = null;

export async function loadQuiz() {
  if (cache) return cache;
  const res = await fetch("data/quiz.final.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Impossibile caricare il dataset quiz");
  const data = await res.json();
  cache = data;
  return cache;
}

export async function quizByProgressivo(prog) {
  const all = await loadQuiz();
  return all.find((q) => q.progressivo === prog);
}

// Distribuzione tematica per quiz base (Allegato C, DM 323/2021).
// La chiave e' un substring case-insensitive del campo "tema" nel dataset.
export const ALLEGATO_C = [
  { match: "TEORIA DELLO SCAFO", n: 1, etichetta: "Teoria dello scafo" },
  { match: "MOTORI", n: 1, etichetta: "Motori" },
  { match: "SICUREZZA", n: 3, etichetta: "Sicurezza" },
  { match: "MANOVRA E CONDOTTA", n: 4, etichetta: "Manovra e condotta" },
  { match: "COLREG", n: 2, etichetta: "Colreg e segnalamento" },
  { match: "METEOROLOGIA", n: 2, etichetta: "Meteorologia" },
  { match: "NAVIGAZIONE CARTOGRAFICA", n: 4, etichetta: "Navigazione cartografica" },
  { match: "NORMATIVA", n: 3, etichetta: "Normativa diportistica" },
];

function pickN(arr, n, rand) {
  const copy = arr.slice();
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(rand() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

// Restituisce 20 quiz base secondo Allegato C + 5 quiz vela
export async function buildExamSet(seed = Date.now()) {
  const all = await loadQuiz();
  let s = seed >>> 0;
  const rand = () => {
    // xorshift
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };

  const base = all.filter((q) => q.sezione === "base");
  const vela = all.filter((q) => q.sezione === "vela");

  const baseSelection = [];
  for (const cat of ALLEGATO_C) {
    const pool = base.filter((q) => (q.tema || "").toUpperCase().includes(cat.match));
    baseSelection.push(...pickN(pool, cat.n, rand).map((q) => ({ ...q, _cat: cat.etichetta })));
  }
  const velaSelection = pickN(vela, 5, rand);
  return { base: baseSelection, vela: velaSelection };
}
