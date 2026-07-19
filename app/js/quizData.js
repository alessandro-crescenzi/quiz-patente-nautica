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

// Pesi: mai vista=10, ultima risposta sbagliata=5, ultima risposta corretta=1
const WEIGHT_UNSEEN = 10;
const WEIGHT_WRONG = 5;
const WEIGHT_CORRECT = 1;

export function buildWeightsFromAttempts(attempts) {
  const last = new Map();
  for (const a of attempts) {
    const prev = last.get(a.progressivo);
    if (!prev || a.ts > prev.ts) last.set(a.progressivo, a);
  }
  const weights = new Map();
  for (const [prog, a] of last) {
    weights.set(prog, a.corretta ? WEIGHT_CORRECT : WEIGHT_WRONG);
  }
  return weights; // domande assenti → peso WEIGHT_UNSEEN (mai viste)
}

function weightedPickN(arr, n, rand, weights) {
  const copy = arr.slice();
  const wts = copy.map((q) => weights.get(q.progressivo) ?? WEIGHT_UNSEEN);
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    const total = wts.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let idx = 0;
    for (idx = 0; idx < wts.length - 1; idx++) {
      r -= wts[idx];
      if (r <= 0) break;
    }
    out.push(copy[idx]);
    copy.splice(idx, 1);
    wts.splice(idx, 1);
  }
  return out;
}

// Restituisce 20 quiz base secondo Allegato C + 5 quiz vela
export async function buildExamSet(seed = Date.now(), weights = new Map()) {
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
    baseSelection.push(...weightedPickN(pool, cat.n, rand, weights).map((q) => ({ ...q, _cat: cat.etichetta })));
  }
  const velaSelection = weightedPickN(vela, 5, rand, weights);
  return { base: baseSelection, vela: velaSelection };
}
