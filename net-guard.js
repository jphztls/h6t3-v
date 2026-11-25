// JRN-1 · guardia di rete del worker di trascrizione.
// Il worker non è coperto dalla regola di sicurezza (CSP) della pagina, quindi qui la regola è scritta nel codice:
// sono permessi SOLO download (GET) dal sito stesso e da huggingface.co, senza corpo della richiesta.
// Qualsiasi altro tentativo di rete fallisce: i tuoi file non possono uscire dal computer.
const allowed = (u) => {
  const x = new URL(u, self.location.href);
  return x.origin === self.location.origin || x.hostname === "huggingface.co" || x.hostname.endsWith(".huggingface.co") || x.hostname.endsWith(".hf.co");
};
const realFetch = self.fetch.bind(self);
self.fetch = (input, init) => {
  const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
  if (!allowed(url) || (method !== "GET" && method !== "HEAD") || (init && init.body != null))
    return Promise.reject(new Error("rete bloccata: " + method + " " + url));
  return realFetch(input, init);
};
if (self.XMLHttpRequest) {                      // XHR: solo GET verso indirizzi permessi, senza corpo
  const X = self.XMLHttpRequest, open = X.prototype.open, send = X.prototype.send;
  X.prototype.open = function (m, u, ...r) { this.__ok = String(m).toUpperCase() === "GET" && allowed(u); return open.call(this, m, u, ...r); };
  X.prototype.send = function (b) { if (!this.__ok || b != null) throw new Error("rete bloccata"); return send.call(this, null); };
}
for (const k of ["WebSocket", "EventSource", "WebTransport", "RTCPeerConnection"]) { try { Object.defineProperty(self, k, { value: undefined }); } catch (e) {} }
if (self.navigator && navigator.sendBeacon) try { Object.defineProperty(navigator, "sendBeacon", { value: () => false }); } catch (e) {}
