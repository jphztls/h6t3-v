/* EDT-1: contenuti finti e parti disegnate (ghiera, striscia, tastiera) dentro l'anteprima di JRN-1.
   Gira dentro l'iframe; l'editor chiama MOCK.apply(cfg, screen). Le formule copiano layout() e drawDial() di JRN-1. */
(function () {
  const $ = (id) => document.getElementById(id);
  const DPR = window.devicePixelRatio || 1;
  const ink = () => getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#000";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let CFG = {}, SCREEN = "consulta";

  const SCAN = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="#fff"/>' +
    [24, 44, 64, 84, 104, 124, 144, 164].map((y, i) => '<rect x="20" y="' + y + '" width="' + [240, 210, 255, 180, 230, 120, 250, 160][i] + '" height="6" fill="#000"/>').join("") + "</svg>");

  const ITEMS = [
    { name: "261123_4", folder: "idee", parts: [{ t: "text", v: "Lampada da tavolo con braccio a molla, base in cemento. Chiedere a Marco per il legno." }] },
    { name: "261123_3", folder: "spesa", type: "tasklist", done: true, parts: [{ t: "text", v: "Caffè, pane, carta da disegno A3" }] },
    { name: "261123_2", folder: "", parts: [{ t: "audio" }] },
    { name: "261123_1", folder: "agenda", type: "calendar", when: "24.11.26 10:30", parts: [{ t: "text", v: "Dentista, portare le lastre" }] },
    { name: "261122_2", folder: "scansioni", parts: [{ t: "image" }] },
    { name: "261122_1", folder: "diario", parts: [{ t: "text", v: "Giornata lunga. Ho finito il primo prototipo della ghiera e funziona meglio del previsto.\nDomani provo con il telefono in tasca." }] },
    { name: "261121_1", folder: "idee", parts: [{ t: "text", v: "Archivio mensile in ZIP, uno per mese." }] },
  ];

  function drawWave(c, h) {
    const w = c.clientWidth || 300; c.width = Math.round(w * DPR); c.height = Math.round(h * DPR);
    const x = c.getContext("2d"); x.fillStyle = ink(); const H = c.height;
    let s = 7; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i * 2 * DPR < c.width; i++) { const a = Math.max(1, (0.15 + 0.85 * Math.abs(Math.sin(i / 9)) * rnd()) * H); x.fillRect(Math.round(i * 2 * DPR), Math.round((H - a) / 2), Math.max(1, Math.round(DPR)), Math.round(a)); }
  }

  function renderFeed() {
    const feed = $("feed"); feed.innerHTML = "";
    ITEMS.forEach((it, i) => {
      const el = document.createElement("div");
      el.className = "it" + (i === 0 ? " sel" : "") + (i && ITEMS[i - 1].name.slice(0, 6) === it.name.slice(0, 6) ? " same" : "");
      let l = "";
      if (it.type === "tasklist") l += '<span class="ck' + (it.done ? " on" : "") + '"></span>';
      l += '<span class="nm">' + it.name + "</span>";
      if (it.when) l += '<span class="ev">' + it.when + "</span>";
      let h = '<div class="hd"><span class="l">' + l + '</span><span class="fd">' + esc(it.folder) + "</span></div>";
      for (const p of it.parts) {
        if (p.t === "text") h += '<div class="part tx">' + esc(p.v) + "</div>";
        else if (p.t === "image") h += '<div class="part"><img class="inv" src="' + SCAN + '" alt=""></div>';
        else if (p.t === "audio") h += '<div class="part"><canvas class="wf"></canvas></div>';
      }
      el.innerHTML = h; feed.appendChild(el);
    });
    requestAnimationFrame(() => feed.querySelectorAll("canvas.wf").forEach((c) => drawWave(c, c.clientHeight || 34)));
  }

  function renderCal() {
    const MESI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    const y = 2026, m = 10, off = (new Date(y, m, 1).getDay() + 6) % 7, n = 30, has = new Set([3, 9, 12, 17, 21, 22, 23]), evd = new Set([24, 27]);
    let h = '<div class="cal-h">' + MESI[m] + " " + y + '</div><div class="cal-g">' + ["L", "M", "M", "G", "V", "S", "D"].map((x) => "<div>" + x + "</div>").join("");
    for (let i = 0; i < off; i++) h += "<div></div>";
    for (let d = 1; d <= n; d++) h += '<div class="' + (has.has(d) ? "has" : "") + (evd.has(d) ? " evd" : "") + (d === 23 ? " sel" : "") + '">' + d + "</div>";
    $("cal").innerHTML = h + '</div><div class="cal-n">testo 2   audio 1\n10:30  261123_1</div>';
  }

  function renderDirs() {
    const R = [["idee", "4"], ["spesa", "tasklist  6"], ["agenda", "calendar  3"], ["scansioni", "2"], ["diario", "11"], ["+ nuova", ""]];
    $("dirs").innerHTML = R.map((r, i) => '<div class="dr' + (i === 1 ? " sel" : "") + '"><span>' + r[0] + "</span><span>" + r[1] + "</span></div>").join("");
  }

  /* Ghiera: come drawDial() di JRN-1, con i parametri dell'editor */
  function drawDial(size) {
    const dial = $("dial"), px = Math.round(size * DPR);
    dial.width = px; dial.height = px; dial.style.width = size + "px"; dial.style.height = size + "px";
    const c = dial.getContext("2d"), R = px / 2, lw = Math.max(1, (CFG["dial.stroke"] || 1) * DPR);
    c.clearRect(0, 0, px, px); c.lineWidth = lw; c.strokeStyle = ink(); c.fillStyle = ink();
    c.beginPath(); c.arc(R, R, R - lw / 2, 0, Math.PI * 2); c.stroke();
    const n = CFG["dial.dots"] ?? 2, rr = R * (CFG["dial.ring"] ?? 82) / 100, dr = R * (CFG["dial.dotr"] ?? 3.5) / 100;
    for (let k = 0; k < n; k++) { const a = (k * Math.PI * 2) / n - Math.PI / 2 - Math.PI / 4; c.beginPath(); c.arc(R + Math.cos(a) * rr, R + Math.sin(a) * rr, dr, 0, Math.PI * 2); c.fill(); }
    if (CFG["dial.centerShow"]) { c.setLineDash([2 * DPR, 2 * DPR]); c.beginPath(); c.arc(R, R, R * 0.36, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
  }

  function drawStrip() {
    const strip = $("strip"), w = strip.clientWidth, h = strip.clientHeight; if (!w) return;
    strip.width = Math.round(w * DPR); strip.height = Math.round(h * DPR);
    const c = strip.getContext("2d"), W = strip.width, H = strip.height, n = CFG["strip.dots"] ?? 2, gap = W / n, r = (CFG["strip.dotr"] ?? 2.5) * DPR;
    c.clearRect(0, 0, W, H); c.fillStyle = ink();
    for (let x = gap / 2; x < W; x += gap) if (x > r * 3 && x < W - r * 3) { c.beginPath(); c.arc(x, H / 2, r, 0, Math.PI * 2); c.fill(); }
  }

  function drawMeter() {
    const cv = $("d1c"), w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
    cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
    const c = cv.getContext("2d"); c.fillStyle = ink();
    const on = Math.floor((cv.width / (2 * DPR)) * 0.62);
    for (let i = 0; i * 2 * DPR < cv.width && i < on; i++) c.fillRect(Math.round(i * 2 * DPR), 0, Math.max(1, Math.round(DPR)), cv.height);
  }

  const PAGES = [["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"], ["a", "s", "d", "f", "g", "h", "j", "k", "l", "'"], ["⇧", "z", "x", "c", "v", "b", "n", "m", ",", "⌫"], ["123", "☺", " ", "⏎"]];
  const WIDE = { "⇧": "w15", "⌫": "w15", "123": "w15", "⏎": "w15", " ": "w6" };
  const ICON = {
    "⇧": '<svg viewBox="0 0 30 20" width="30"><path d="M9.5 18.5 V10.5 H3.5 L15 1.5 L26.5 10.5 H20.5 V18.5 Z"/></svg>',
    "⌫": '<svg viewBox="0 0 40 20" width="40"><path d="M10.5 1.5 H38.5 V18.5 H10.5 L1.5 10 Z M19.5 6 L28.5 14 M28.5 6 L19.5 14"/></svg>',
    "⏎": '<svg viewBox="0 0 36 20" width="36"><path d="M34.5 1.5 V12.5 H3.5 M9.5 6.5 L3.5 12.5 L9.5 18.5"/></svg>',
  };
  function renderKb() {
    const kb = $("kb"); kb.innerHTML = "";
    PAGES.forEach((row) => {
      const r = document.createElement("div"); r.className = "kr";
      row.forEach((k) => { const b = document.createElement("div"); b.className = "k " + (WIDE[k] || ""); b.dataset.k = k; if (k === "g") b.classList.add("down"); b.innerHTML = '<span class="lb">' + (ICON[k] || esc(k === " " ? "" : k)) + "</span>"; r.appendChild(b); });
      kb.appendChild(r);
    });
  }

  const D1 = {
    consulta: ["", "261123_4  idee", ""],
    cartelle: ["DIR", "spesa  apri", ""],
    calendario: ["CAL", "23.11.26  2", ""],
    registra: ["REC", "", "0:12"],
  };

  /* layout(): stesse formule di JRN-1 (ghiera, Shift alto quanto la ghiera, LED nella curva) */
  function layout() {
    const app = $("app"), land = document.body.classList.contains("land"), shiftB = $("shift"), led = $("led"), bar = $("bar");
    bar.style.setProperty("--bh", bar.clientHeight + "px");
    const ls = CFG["led.size"] ?? 16;
    if (!land) {
      const W = app.clientWidth;
      let size = Math.max(CFG["dial.min"] ?? 150, Math.min(CFG["dial.max"] ?? 220, Math.floor(W * (CFG["dial.wpct"] ?? 58) / 100), Math.floor(app.clientHeight * (CFG["dial.hpct"] ?? 28) / 100)));
      if (CFG["dial.size"]) size = CFG["dial.size"];
      $("dial").style.display = ""; drawDial(size);
      const sh = CFG["shift.h"] || size;
      shiftB.style.height = sh + "px";
      const pw = shiftB.clientWidth;
      led.style.left = (pw / 2 - ls / 2) + "px"; led.style.top = ""; led.style.bottom = (pw / 2 - ls / 2) + "px";
    } else {
      shiftB.style.height = "";
      const ph = shiftB.clientHeight; led.style.left = (ph / 2 - ls / 2) + "px"; led.style.bottom = ""; led.style.top = (ph / 2 - ls / 2) + "px";
      drawStrip();
    }
  }

  function apply(cfg, screen) {
    CFG = cfg || {}; SCREEN = screen || SCREEN;
    const panes = { consulta: "feed", registra: "feed", cartelle: "dirs", calendario: "cal" };
    document.querySelectorAll("#d2 .pane").forEach((p) => p.classList.toggle("on", p.id === panes[SCREEN]));
    const d = D1[SCREEN] || D1.consulta;
    $("d1m").textContent = d[0]; $("d1m").style.display = d[0] ? "" : "none";
    $("d1v").textContent = d[1]; $("d1t").textContent = d[2];
    $("d1").classList.toggle("meter", SCREEN === "registra");
    $("led").classList.toggle("rec", SCREEN === "registra");
    $("ed").innerHTML = "Idea per il weekend: mercato delle pul<span class=\"car\"></span>ci";
    $("bar").style.removeProperty("--bh");
    requestAnimationFrame(() => { layout(); drawMeter(); requestAnimationFrame(() => { layout(); renderFeedCanvases(); }); });
  }
  function renderFeedCanvases() { document.querySelectorAll("#feed canvas.wf").forEach((c) => drawWave(c, c.clientHeight || 34)); }

  renderFeed(); renderCal(); renderDirs(); renderKb();
  window.MOCK = { apply, redraw: () => { layout(); drawMeter(); renderFeedCanvases(); } };
})();
