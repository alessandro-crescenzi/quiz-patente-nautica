// Hash router minimal
const routes = new Map();

export function register(pattern, handler) {
  routes.set(pattern, handler);
}

function parseHash() {
  const h = location.hash.replace(/^#\/?/, "") || "home";
  return h.split("/");
}

async function dispatch() {
  const segments = parseHash();
  for (const [pattern, handler] of routes) {
    const pSegs = pattern.split("/");
    if (pSegs.length !== segments.length) continue;
    const params = {};
    let match = true;
    for (let i = 0; i < pSegs.length; i++) {
      if (pSegs[i].startsWith(":")) {
        params[pSegs[i].slice(1)] = decodeURIComponent(segments[i]);
      } else if (pSegs[i] !== segments[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      const view = document.getElementById("view");
      view.innerHTML = "";
      await handler(view, params);
      window.scrollTo(0, 0);
      return;
    }
  }
  document.getElementById("view").innerHTML =
    '<div class="text-center text-slate-500 py-10">Pagina non trovata. Torna alla <a class="text-sky-700 underline" href="#/home">home</a>.</div>';
}

export function startRouter() {
  window.addEventListener("hashchange", dispatch);
  if (!location.hash) location.hash = "#/home";
  else dispatch();
}

export function go(path) {
  location.hash = path;
}
