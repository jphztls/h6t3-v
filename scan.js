"use strict";
/* Scansione: rilevamento del foglio, raddrizzamento (omografia + curvatura) e filtro carta.
   Ripreso da PAG-1. Tutto locale, nessun modello. */
function canvasOf(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function freeCanvas(c) { if (c) { c.width = 1; c.height = 1; } }

function detectPage(src) {
  const W0 = src.width, H0 = src.height, s = 360 / Math.max(W0, H0);
  const w = Math.max(8, Math.round(W0 * s)), h = Math.max(8, Math.round(H0 * s));
  const c = canvasOf(w, h), x = c.getContext("2d");
  x.drawImage(src, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data; freeCanvas(c);
  const v = new Float32Array(w * h), hist = new Uint32Array(256);
  for (let i = 0; i < w * h; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const val = Math.max(0, Math.min(255, (r * .299 + g * .587 + b * .114) - (mx - mn) * .6));
    v[i] = val; hist[val | 0]++;
  }
  // sfocatura leggera per ignorare inchiostro e righe
  const bl = boxBlur(v, w, h, 2);
  hist.fill(0); for (let i = 0; i < bl.length; i++) hist[Math.max(0, Math.min(255, bl[i] | 0))]++;
  const thr = otsu(hist, w * h);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = bl[i] > thr ? 1 : 0;
  // componente connessa più grande
  const lab = new Int32Array(w * h), stack = new Int32Array(w * h);
  let bestL = 0, bestN = 0, L = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || lab[i]) continue;
    L++; let sp = 0, n = 0; stack[sp++] = i; lab[i] = L;
    while (sp) {
      const k = stack[--sp]; n++;
      const px = k % w, py = (k / w) | 0;
      if (px > 0 && mask[k - 1] && !lab[k - 1]) { lab[k - 1] = L; stack[sp++] = k - 1; }
      if (px < w - 1 && mask[k + 1] && !lab[k + 1]) { lab[k + 1] = L; stack[sp++] = k + 1; }
      if (py > 0 && mask[k - w] && !lab[k - w]) { lab[k - w] = L; stack[sp++] = k - w; }
      if (py < h - 1 && mask[k + w] && !lab[k + w]) { lab[k + w] = L; stack[sp++] = k + w; }
    }
    if (n > bestN) { bestN = n; bestL = L; }
  }
  if (bestN < w * h * .12) return null;
  // angoli: estremi di x+y e x−y
  let tl = [0, 0, 1e9], br = [0, 0, -1e9], tr = [0, 0, -1e9], bL = [0, 0, 1e9];
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    if (lab[py * w + px] !== bestL) continue;
    const a = px + py, b = px - py;
    if (a < tl[2]) tl = [px, py, a];
    if (a > br[2]) br = [px, py, a];
    if (b > tr[2]) tr = [px, py, b];
    if (b < bL[2]) bL = [px, py, b];
  }
  const corners = [tl, tr, br, bL].map(p => [(p[0] + .5) / s, (p[1] + .5) / s]);
  // curvatura: per ogni lato, cerca il bordo reale lungo la normale al punto medio
  const isIn = (px, py) => { px = Math.round(px * s); py = Math.round(py * s); return px >= 0 && py >= 0 && px < w && py < h && lab[py * w + px] === bestL; };
  const cx = corners.reduce((a, p) => a + p[0], 0) / 4, cy = corners.reduce((a, p) => a + p[1], 0) / 4;
  const offs = [];
  for (let e = 0; e < 4; e++) {
    const A = corners[e], B = corners[(e + 1) % 4];
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
    let nx = -(B[1] - A[1]), ny = B[0] - A[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    if ((cx - mx) * nx + (cy - my) * ny < 0) { nx = -nx; ny = -ny; }   // normale verso l'interno
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]), lim = len * .12, step = 1 / s;
    let off = 0;
    if (isIn(mx, my)) { for (let t = 0; t <= lim; t += step) if (!isIn(mx - nx * t, my - ny * t)) { off = -(t - step); break; } else off = -t; }
    else { off = 0; for (let t = 0; t <= lim; t += step) if (isIn(mx + nx * t, my + ny * t)) { off = t; break; } }
    // off positivo = bordo più interno, negativo = più esterno
    offs.push([nx * off, ny * off]);
  }
  return { c: corners, m: offs.map(o => (Math.hypot(o[0], o[1]) < 3 / s) ? [0, 0] : o) };
}
function otsu(hist, total) {
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = i; }
  }
  return thr;
}
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let acc = 0; const row = y * w;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / (2 * r + 1);
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1);
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}
function fullQuad(w, h) { const i = Math.round(Math.min(w, h) * .02); return { c: [[i, i], [w - i, i], [w - i, h - i], [i, h - i]], m: [[0, 0], [0, 0], [0, 0], [0, 0]] }; }

/* ---------- Raddrizzamento: prospettiva (omografia) + curvatura (patch di Coons) ---------- */
function homography(q) {   // quadrato unitario → quadrilatero (TL, TR, BR, BL)
  const [x0, y0] = q[0], [x1, y1] = q[1], [x2, y2] = q[2], [x3, y3] = q[3];
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den; h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}
function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
const apply3 = (m, x, y) => { const w = m[6] * x + m[7] * y + m[8]; return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w]; };
function midpoints(quad) {
  return quad.c.map((A, e) => { const B = quad.c[(e + 1) % 4]; return [(A[0] + B[0]) / 2 + quad.m[e][0], (A[1] + B[1]) / 2 + quad.m[e][1]]; });
}
// Restituisce la funzione (u,v)∈[0,1]² → punto nella foto
function pageMapper(quad) {
  const H = homography(quad.c), Hi = invert3(H), M = midpoints(quad).map(p => apply3(Hi, p[0], p[1]));
  const dyT = M[0][1], dxR = M[1][0] - 1, dyB = M[2][1] - 1, dxL = M[3][0];
  return (u, v) => {
    const x = u + 4 * v * (1 - v) * ((1 - u) * dxL + u * dxR);
    const y = v + 4 * u * (1 - u) * ((1 - v) * dyT + v * dyB);
    return apply3(H, x, y);
  };
}
// Rapporto larghezza/altezza reale di un rettangolo fotografato in prospettiva (centro ottico al centro della foto).
function trueAspect(c, iw, ih) {
  const u0 = iw / 2, v0 = ih / 2;
  const P = p => [p[0] - u0, p[1] - v0, 1];
  const m1 = P(c[0]), m2 = P(c[1]), m3 = P(c[3]), m4 = P(c[2]);     // TL, TR, BL, BR
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const k2 = dot(cross(m1, m4), m3) / dot(cross(m2, m4), m3);
  const k3 = dot(cross(m1, m4), m2) / dot(cross(m3, m4), m2);
  if (!isFinite(k2) || !isFinite(k3)) return 0;
  const n2 = m2.map((v, i) => k2 * v - m1[i]), n3 = m3.map((v, i) => k3 * v - m1[i]);
  const L = Math.max(iw, ih);
  let f2 = -(n2[0] * n3[0] + n2[1] * n3[1]) / (n2[2] * n3[2]);
  // focale stimata non plausibile (foto quasi frontale): si usa quella tipica della fotocamera dell'iPhone
  if (!isFinite(f2) || f2 < (L * .5) ** 2 || f2 > (L * 3) ** 2) f2 = (L * .85) ** 2;
  const r = Math.sqrt((n2[0] ** 2 + n2[1] ** 2) / f2 + n2[2] ** 2) / Math.sqrt((n3[0] ** 2 + n3[1] ** 2) / f2 + n3[2] ** 2);
  return isFinite(r) && r > .2 && r < 5 ? r : 0;
}
function curveLen(map, a, b) {   // lunghezza di un lato campionando la mappa
  let L = 0, p = map(a[0], a[1]);
  for (let i = 1; i <= 16; i++) { const t = i / 16, q = map(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); L += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; }
  return L;
}
function warp(src, quad, maxSide) {
  const map = pageMapper(quad);
  const top = curveLen(map, [0, 0], [1, 0]), bot = curveLen(map, [0, 1], [1, 1]);
  const lef = curveLen(map, [0, 0], [0, 1]), rig = curveLen(map, [1, 0], [1, 1]);
  let W = (top + bot) / 2, H = (lef + rig) / 2;
  // proporzioni vere del foglio dalla prospettiva (metodo di Zhang-He), corrette per la curvatura dei lati
  const r = trueAspect(quad.c, src.width, src.height);
  if (r) {
    const q = quad.c, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const W0 = (d(q[0], q[1]) + d(q[3], q[2])) / 2, H0 = (d(q[0], q[3]) + d(q[1], q[2])) / 2;
    const ratio = r * (W / W0) / (H / H0);          // larghezza / altezza
    const area = W * H; W = Math.sqrt(area * ratio); H = Math.sqrt(area / ratio);
  }
  const s = Math.min(1.25, maxSide / Math.max(W, H)); W = Math.max(16, Math.round(W * s)); H = Math.max(16, Math.round(H * s));
  const sw = src.width, sh = src.height;
  const sd = src.getContext("2d").getImageData(0, 0, sw, sh).data;
  const out = new ImageData(W, H), od = out.data;
  // la mappa si calcola su una griglia ogni 8 px e si interpola: molto più veloce, errore trascurabile
  const G = 8, gw = Math.ceil(W / G) + 1, gh = Math.ceil(H / G) + 1, gx = new Float32Array(gw * gh), gy = new Float32Array(gw * gh);
  const E = .004, inset = t => E + Math.min(1, t) * (1 - 2 * E);   // un filo di margine: niente bordo del tavolo
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const p = map(inset(i * G / (W - 1)), inset(j * G / (H - 1))); gx[j * gw + i] = p[0]; gy[j * gw + i] = p[1]; }
  for (let y = 0; y < H; y++) {
    const j = Math.min(gh - 2, (y / G) | 0), fy = y / G - j;
    for (let x = 0; x < W; x++) {
      const i = Math.min(gw - 2, (x / G) | 0), fx = x / G - i, k = j * gw + i;
      const px = (gx[k] * (1 - fx) + gx[k + 1] * fx) * (1 - fy) + (gx[k + gw] * (1 - fx) + gx[k + gw + 1] * fx) * fy;
      const py = (gy[k] * (1 - fx) + gy[k + 1] * fx) * (1 - fy) + (gy[k + gw] * (1 - fx) + gy[k + gw + 1] * fx) * fy;
      const x0 = Math.max(0, Math.min(sw - 2, Math.floor(px))), y0 = Math.max(0, Math.min(sh - 2, Math.floor(py)));
      const ax = Math.max(0, Math.min(1, px - x0)), ay = Math.max(0, Math.min(1, py - y0));
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4, o = (y * W + x) * 4;
      for (let ch = 0; ch < 3; ch++)
        od[o + ch] = (sd[i00 + ch] * (1 - ax) + sd[i10 + ch] * ax) * (1 - ay) + (sd[i01 + ch] * (1 - ax) + sd[i11 + ch] * ax) * ay;
      od[o + 3] = 255;
    }
  }
  return out;
}

/* ---------- Miglioramento: carta bianca, inchiostro scuro ---------- */
function enhance(img, mode) {
  if (mode === "originale") return img;
  const W = img.width, H = img.height, d = img.data;
  // stima dello sfondo (carta) a bassa risoluzione: massimo locale + sfocatura, così l'inchiostro sparisce
  const f = 16, w = Math.ceil(W / f), h = Math.ceil(H / f);
  const bg = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)];
  for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) {
    // 90° percentile approssimato con il massimo di luminosità su una griglia rada
    let best = -1, br = 255, bgc = 255, bb = 255;
    for (let y = by * f; y < Math.min(H, by * f + f); y += 2) for (let x = bx * f; x < Math.min(W, bx * f + f); x += 2) {
      const o = (y * W + x) * 4, l = d[o] + d[o + 1] + d[o + 2];
      if (l > best) { best = l; br = d[o]; bgc = d[o + 1]; bb = d[o + 2]; }
    }
    const k = by * w + bx; bg[0][k] = br; bg[1][k] = bgc; bg[2][k] = bb;
  }
  for (let ch = 0; ch < 3; ch++) {
    let a = bg[ch];
    a = maxFilter(a, w, h, 2);
    bg[ch] = boxBlur(a, w, h, 3);
  }
  const out = new ImageData(W, H), od = out.data;
  for (let y = 0; y < H; y++) {
    const fy = Math.min(h - 1.001, Math.max(0, y / f - .5)), y0 = fy | 0, ay = fy - y0;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(w - 1.001, Math.max(0, x / f - .5)), x0 = fx | 0, ax = fx - x0, k = y0 * w + x0, o = (y * W + x) * 4;
      const n = [0, 0, 0];
      for (let ch = 0; ch < 3; ch++) {
        const b = bg[ch], bv = (b[k] * (1 - ax) + b[k + 1] * ax) * (1 - ay) + (b[k + w] * (1 - ax) + b[k + w + 1] * ax) * ay;
        n[ch] = Math.min(1, d[o + ch] / Math.max(24, bv));
      }
      if (mode === "migliorato") {
        // luminosità con la curva, colore dell'inchiostro conservato, carta neutra (niente aloni colorati)
        const l = n[0] * .299 + n[1] * .587 + n[2] * .114, v = curve(l);
        const k = 1.3 * Math.max(0, Math.min(1, (.88 - l) / .3));
        for (let ch = 0; ch < 3; ch++) od[o + ch] = 255 * Math.max(0, Math.min(1, v + (n[ch] - l) * k));
      } else {
        const l = n[0] * .299 + n[1] * .587 + n[2] * .114;
        let v = curve(l);
        if (mode === "bn") v = Math.max(0, Math.min(1, (v - .55) / .25));
        od[o] = od[o + 1] = od[o + 2] = 255 * v;
      }
      od[o + 3] = 255;
    }
  }
  return out;
}
function curve(v) { v = Math.max(0, Math.min(1, (v - .12) / .78)); return Math.pow(v, 1.6); }   // punto del nero, punto del bianco, contrasto
function maxFilter(a, w, h, r) {
  const t = new Float32Array(w * h), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; for (let k = -r; k <= r; k++) { const xx = Math.min(w - 1, Math.max(0, x + k)); if (a[y * w + xx] > m) m = a[y * w + xx]; } t[y * w + x] = m; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; for (let k = -r; k <= r; k++) { const yy = Math.min(h - 1, Math.max(0, y + k)); if (t[yy * w + x] > m) m = t[yy * w + x]; } o[y * w + x] = m; }
  return o;
}

/* ---------- Segmentazione in righe (per l'OCR) ---------- */
