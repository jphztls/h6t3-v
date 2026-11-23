// Rete prima, cache come riserva: ogni apertura con connessione carica l'ultima versione,
// senza rete l'app funziona con l'ultima copia salvata.
const CACHE = "jrn1-v4";               // alzare a ogni rilascio
const FILES = ["./", "index.html", "scan.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE)
  .then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" }))))   // salta la cache HTTP di GitHub Pages (10 min)
  .then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match("index.html"))));
});
