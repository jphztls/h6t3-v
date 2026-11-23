/* DSP-1 · motore del display simulato (v1)
 * Uso in un'altra app:
 *   <script src="display.js"></script>
 *   const d = DSP.create(canvas, preset, { exact: true });   // preset = JSON esportato dal designer
 *   d.clear(); d.drawText("CIAO", 2, 2); d.render(performance.now());   // in un ciclo requestAnimationFrame
 * Il contenuto si disegna su d.ctx (canvas 2D grande quanto la griglia del display, un pixel = un punto).
 * In modalita segmenti si usa d.seg = { text: "12.34", icons: 0b101, colon: true }.
 */
(function (root) {
"use strict";

const DEFAULTS = {
  v: 1, name: "Senza nome",
  type: "lcd", struct: "matrix", light: "trans", color: "rgb",
  nx: 160, ny: 120, pitch: 6, layout: "stripe", fillX: 80, fillY: 88, round: 10, bits: 6, dither: 0,
  tintH: 0, tintS: 0, tintL: 100, bgH: 0, bgS: 0, bgL: 3,
  bright: 100, contrast: 100, black: 6, gamma: 100, sat: 100, unlit: 0,
  scan: 0, bloom: 8, back: 20, curve: 0, persist: 20, flick: 0, noise: 4, view: 0, shadow: 0, mesh: 0, edge: 30,
  glare: 12, glareA: -30, glareW: 30, ghost: 0, ghostD: 6, ghostA: 135, frameW: 24, frameL: 6,
  frost: 0, frostR: 6, gTintH: 200, gTintS: 15, gTintA: 0, haze: 0,
  segN: 6, segK: 7, segH: 160, segT: 14, segSlant: 8, segGap: 20, segSpace: 22, icons: "some", colon: "blink",
  src: "pattern", pattern: "bars", fit: "cover", text: "DSP-1 PRONTO", font: "5x7", tscale: 1, tpos: "bottom", tscroll: 0, tout: 1, invert: 0,
};

/* Valori tipici di ogni tecnologia: scegliere un tipo applica questi parametri */
const TYPES = {
  lcd:     { light: "trans", color: "rgb", layout: "stripe", nx: 160, ny: 120, pitch: 6, fillX: 80, fillY: 88, round: 10, bits: 6, dither: 0, tintH: 0, tintS: 0, tintL: 100, bgH: 0, bgS: 0, bgL: 3, black: 6, unlit: 0, scan: 0, bloom: 8, back: 20, curve: 0, persist: 20, flick: 0, noise: 4, shadow: 0, mesh: 0, edge: 30, glare: 12 },
  lcdmono: { light: "refl", color: "mono", layout: "none", nx: 160, ny: 100, pitch: 6, fillX: 90, fillY: 90, round: 0, bits: 2, dither: 0, tintH: 150, tintS: 25, tintL: 12, bgH: 80, bgS: 18, bgL: 58, black: 0, unlit: 5, scan: 0, bloom: 0, back: 15, curve: 0, persist: 45, flick: 0, noise: 3, shadow: 50, mesh: 0, edge: 20, glare: 15 },
  vfd:     { light: "emit", color: "mono", layout: "none", nx: 128, ny: 32, pitch: 8, fillX: 78, fillY: 78, round: 100, bits: 1, dither: 0, tintH: 168, tintS: 90, tintL: 62, bgH: 180, bgS: 30, bgL: 3, black: 0, unlit: 6, scan: 0, bloom: 45, back: 10, curve: 0, persist: 5, flick: 0, noise: 2, shadow: 0, mesh: 35, edge: 10, glare: 20 },
  crt:     { light: "emit", color: "rgb", layout: "stripe", nx: 160, ny: 120, pitch: 6, fillX: 75, fillY: 100, round: 0, bits: 8, dither: 0, tintH: 0, tintS: 0, tintL: 100, bgH: 120, bgS: 8, bgL: 2, black: 0, unlit: 0, scan: 70, bloom: 35, back: 25, curve: 35, persist: 15, flick: 15, noise: 8, shadow: 0, mesh: 0, edge: 60, glare: 25 },
  led:     { light: "emit", color: "mono", layout: "none", nx: 48, ny: 20, pitch: 20, fillX: 70, fillY: 70, round: 100, bits: 2, dither: 0, tintH: 8, tintS: 100, tintL: 55, bgH: 0, bgS: 0, bgL: 4, black: 0, unlit: 8, scan: 0, bloom: 55, back: 0, curve: 0, persist: 0, flick: 0, noise: 0, shadow: 0, mesh: 0, edge: 0, glare: 10 },
  oled:    { light: "emit", color: "rgb", layout: "pentile", nx: 160, ny: 120, pitch: 6, fillX: 70, fillY: 75, round: 60, bits: 8, dither: 0, tintH: 0, tintS: 0, tintL: 100, bgH: 0, bgS: 0, bgL: 0, black: 0, unlit: 0, scan: 0, bloom: 4, back: 0, curve: 0, persist: 0, flick: 0, noise: 1, shadow: 0, mesh: 0, edge: 10, glare: 10 },
  eink:    { light: "refl", color: "mono", layout: "none", nx: 200, ny: 150, pitch: 5, fillX: 100, fillY: 100, round: 0, bits: 2, dither: 1, tintH: 0, tintS: 0, tintL: 15, bgH: 40, bgS: 8, bgL: 82, black: 0, unlit: 0, scan: 0, bloom: 0, back: 10, curve: 0, persist: 35, flick: 0, noise: 12, shadow: 0, mesh: 0, edge: 5, glare: 8 },
};

/* Carattere bitmap 5×7 (da CCD-1) */
const FONT = {
  "0": "01110100011001110101110011000101110", "1": "00100011000010000100001000010001110", "2": "01110100010000100010001000100011111",
  "3": "11111000100010000010000011000101110", "4": "00010001100101010010111110001000010", "5": "11111100001111000001000011000101110",
  "6": "00110010001000011110100011000101110", "7": "11111000010001000100010000100001000", "8": "01110100011000101110100011000101110",
  "9": "01110100011000101111000010001001100", "A": "01110100011000111111100011000110001", "B": "11110100011000111110100011000111110",
  "C": "01110100011000010000100001000101110", "D": "11100100101000110001100011001011100", "E": "11111100001000011110100001000011111",
  "F": "11111100001000011110100001000010000", "G": "01110100011000010111100011000101111", "H": "10001100011000111111100011000110001",
  "I": "01110001000010000100001000010001110", "J": "00111000100001000010000101001001100", "K": "10001100101010011000101001001010001",
  "L": "10000100001000010000100001000011111", "M": "10001110111010110101100011000110001", "N": "10001100011100110101100111000110001",
  "O": "01110100011000110001100011000101110", "P": "11110100011000111110100001000010000", "Q": "01110100011000110001101011001001101",
  "R": "11110100011000111110101001001010001", "S": "01111100001000001110000010000111110", "T": "11111001000010000100001000010000100",
  "U": "10001100011000110001100011000101110", "V": "10001100011000110001100010101000100", "W": "10001100011000110101101011010101010",
  "X": "10001100010101000100010101000110001", "Y": "10001100011000101010001000010000100", "Z": "11111000010001000100010001000011111",
  " ": "00000000000000000000000000000000000", ":": "00000011000110000000011000110000000", ".": "00000000000000000000000000110001100",
  "/": "00000000010001000100010001000000000", "-": "00000000000000011111000000000000000", "+": "00000001000010011111001000010000000",
  "[": "01110010000100001000010000100001110", "]": "01110000100001000010000100001001110", "?": "01110100010000100010001000000000100",
  "<": "00010001000100010000010000010000010", ">": "01000001000001000001000100010001000", "x": "00000100010101000100010101000100000",
  "!": "00100001000010000100001000000000100", "_": "00000000000000000000000000000011111", "*": "00010001000100011111000100010001000"
};

/* Segmenti: a b c d e f, g/G = meta sinistra/destra del centrale, h i j = diagonale, verticale, diagonale in alto, k l m in basso */
const SEGDEF = {
  a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1],
  g: [0, 1, 0.5, 1], G: [0.5, 1, 1, 1], h: [0, 0, 0.5, 1], i: [0.5, 0, 0.5, 1], j: [1, 0, 0.5, 1],
  k: [0.5, 1, 0, 2], l: [0.5, 1, 0.5, 2], m: [0.5, 1, 1, 2], g7: [0, 1, 1, 1],
};
const SEG7 = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg",
  A: "abcefg", B: "cdefg", C: "adef", D: "bcdeg", E: "adefg", F: "aefg", G: "acdef", H: "bcefg", I: "ef", J: "bcde", K: "befg", L: "def", M: "aceg", N: "ceg",
  O: "abcdef", P: "abefg", Q: "abcfg", R: "eg", S: "afgcd", T: "defg", U: "bcdef", V: "cde", W: "bdfg", X: "bcefg", Y: "bcdfg", Z: "abged",
  "-": "g", "_": "d", "=": "dg", " ": "", "'": "f", "\"": "bf", "°": "abfg", "?": "abeg" };
const SEG14 = { "0": "abcdefjk", "1": "bcj", "2": "abgGed", "3": "abcdG", "4": "bcfgG", "5": "adfgm", "6": "acdefgG", "7": "abc", "8": "abcdefgG", "9": "abcdfgG",
  A: "abcefgG", B: "abcdGil", C: "adef", D: "abcdil", E: "adefg", F: "aefg", G: "acdefG", H: "bcefgG", I: "adil", J: "bcde", K: "efgjm", L: "def", M: "bcefhj", N: "bcefhm",
  O: "abcdef", P: "abefgG", Q: "abcdefm", R: "abefgGm", S: "acdfgG", T: "ail", U: "bcdef", V: "efjk", W: "bcefkm", X: "hjkm", Y: "hjl", Z: "adjk",
  "-": "gG", "+": "gGil", "/": "jk", "\\": "hm", "*": "gGhijklm", "_": "d", "=": "dgG", " ": "", "'": "i", "\"": "fi", "°": "abfgG", "?": "abGl", "<": "jm", ">": "hk" };

const VS = `#version 300 es
void main() { vec2 v = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0); }`;

/* Passo 1, alla risoluzione della griglia: colore, livelli, dithering, persistenza */
const FS_CONTENT = `#version 300 es
precision highp float;
uniform sampler2D uSrc, uPrev;
uniform float uSat, uCon, uGam, uLev, uDith, uInv, uMono, uPers, uFirst;
out vec4 o;
const float BAY[16] = float[](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec3 s = texelFetch(uSrc, c, 0).rgb;
  const vec3 W = vec3(0.2126, 0.7152, 0.0722);
  s = mix(vec3(dot(s, W)), s, uSat);
  s = clamp((s - 0.5) * uCon + 0.5, 0.0, 1.0);
  s = pow(s, vec3(uGam));
  if (uMono > 0.5) s = vec3(dot(s, W));
  if (uInv > 0.5) s = 1.0 - s;
  float n = uLev - 1.0;
  float th = uDith > 0.5 ? (BAY[(c.y & 3) * 4 + (c.x & 3)] + 0.5) / 16.0 - 0.5 : 0.0;
  s = clamp(floor(s * n + 0.5 + th), 0.0, n) / n;
  if (uFirst < 0.5) s = mix(s, texelFetch(uPrev, c, 0).rgb, uPers);
  o = vec4(s, 1.0);
}`;

/* Passo 2, alla risoluzione dello schermo: punti, subpixel, luce, effetti, vetro */
const FS_PANEL = `#version 300 es
precision highp float;
uniform sampler2D uC;
uniform vec2 uRes, uOrig, uGrid, uPanel, uFill, uGhostOff;
uniform float uScale, uPitch, uSeg, uLayout, uLight, uMono, uRound, uFactor, uLod, uBez;
uniform vec3 uTint, uBg, uFrame;
uniform float uBright, uBlack, uUnlit, uScan, uBloom, uBack, uCurve, uFlick, uNoise, uView, uShadow, uMesh, uEdge;
uniform float uGlare, uGlareA, uGlareW, uGhost, uT;
out vec4 o;
const vec3 PR = vec3(1.0, 0.11, 0.07), PG = vec3(0.09, 1.0, 0.13), PB = vec3(0.11, 0.17, 1.0);
const vec3 LW = vec3(0.2126, 0.7152, 0.0722);

float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

float shape(vec2 f, vec2 cpx, vec2 fill) {          // punto rettangolare arrotondato, bordo antialias di un pixel
  vec2 b = fill * cpx * 0.5;
  float r = uRound * min(b.x, b.y);
  vec2 c = abs((f - 0.5) * cpx) - b + r;
  float sd = length(max(c, 0.0)) + min(max(c.x, c.y), 0.0) - r;
  return clamp(0.5 - sd / uScale, 0.0, 1.0);
}
vec3 cell(vec2 c) { return texelFetch(uC, ivec2(clamp(c, vec2(0.0), uGrid - 1.0)), 0).rgb; }

struct S { vec3 e; vec3 p; float m; float v; vec2 f; vec2 id; };
S sampleAt(vec2 q) {
  S s; s.p = vec3(1.0);
  if (uSeg > 0.5) {
    vec4 t = texelFetch(uC, ivec2(clamp(q, vec2(0.0), uPanel - 1.0)), 0);
    s.m = t.g; s.v = t.g > 0.002 ? clamp(t.r / t.g, 0.0, 1.0) : 0.0;
    s.e = vec3(s.v); s.f = vec2(0.5, fract(q.y / uPitch)); s.id = floor(q / 2.0);
    return s;
  }
  vec2 d = q / uPitch, c = floor(d), f = fract(d);
  s.f = f; s.id = c;
  int L = int(uLayout + 0.5);
  if (uMono > 0.5 || L == 0) {
    vec3 v = cell(c);
    s.m = shape(f, vec2(uPitch), uFill); s.e = v; s.v = uMono > 0.5 ? v.r : dot(v, LW);
    return s;
  }
  float k, x; vec3 v;
  if (L == 1) {
    float sx = f.x * 3.0; k = floor(sx);
    s.m = shape(vec2(fract(sx), f.y), vec2(uPitch / 3.0, uPitch), uFill);
    v = cell(c);
  } else if (L == 2) {
    float sh = mod(c.y, 2.0) * 1.5;
    float sx = d.x * 3.0 - sh, sc = floor(sx); k = mod(sc, 3.0);
    s.m = shape(vec2(fract(sx), f.y), vec2(uPitch / 3.0, uPitch), uFill);
    v = cell(vec2(floor((sc + 0.5 + sh) / 3.0), c.y));
  } else {
    float sx = f.x * 2.0, kk = floor(sx);
    bool alt = mod(c.x + c.y, 2.0) > 0.5;
    s.m = shape(vec2(fract(sx), f.y), vec2(uPitch / 2.0, uPitch), uFill * (kk > 0.5 ? 0.85 : 1.0));
    v = cell(c);
    k = kk > 0.5 ? 1.0 : (alt ? 2.0 : 0.0);
  }
  x = k < 0.5 ? v.r : (k < 1.5 ? v.g : v.b);
  s.p = (k < 0.5 ? PR : (k < 1.5 ? PG : PB)) * uFactor;
  s.e = s.p * x; s.v = x;
  return s;
}

vec3 panel(vec2 q) {
  S s = sampleAt(q);
  vec2 uv = q / uPanel;
  int Lt = int(uLight + 0.5);
  bool mono = uMono > 0.5 || uSeg > 0.5;
  vec3 col;
  if (Lt == 2) {                                         // riflessivo: inchiostro su carta
    float dark = uSeg > 0.5 ? s.v : 1.0 - s.v;
    if (mono) {
      float a = clamp(dark * s.m * uBright + uUnlit * s.m, 0.0, 1.0);
      col = mix(uBg, uTint, a);
      if (uShadow > 0.0) {
        S s2 = sampleAt(q - vec2(max(1.0, uPitch * 0.35)));
        float d2 = (uSeg > 0.5 ? s2.v : 1.0 - s2.v) * s2.m;
        col *= 1.0 - uShadow * 0.5 * d2 * (1.0 - a);
      }
    } else {
      col = uBg * (s.e * s.m * uBright + (1.0 - s.m) * 0.3);
    }
    col *= 1.0 + (hash(floor(q / uScale)) - 0.5) * uNoise * 0.3;
  } else {
    vec3 e;
    if (Lt == 1) e = (mono ? vec3(uBlack + (1.0 - uBlack) * s.v) : s.p * uBlack + s.e * (1.0 - uBlack)) * uTint;
    else e = mono ? uTint * s.v : s.e * uTint;
    vec3 un = (mono ? uTint : vec3(0.35)) * uUnlit;
    col = uBg + (e * uBright + un) * s.m;
    float sp = exp(-pow((s.f.y - 0.5) * 2.6, 2.0));
    col *= mix(1.0, sp * 1.35, uScan);
    if (uBloom > 0.0) {
      vec3 b = (textureLod(uC, uv, uLod + 1.0) + textureLod(uC, uv, uLod + 2.0) + textureLod(uC, uv, uLod + 3.0) + textureLod(uC, uv, uLod + 4.0)).rgb * 0.25;
      col += (mono ? uTint * b.r : b * uTint) * uBloom * 0.9 * uBright;
    }
    if (uNoise > 0.0) col *= 1.0 + (hash(s.id + floor(uT * 24.0)) - 0.5) * uNoise * 0.6;
  }
  vec2 cc = uv - 0.5;
  float bl = 1.0 - uBack * (0.6 * dot(cc, cc) + 0.12 * (0.5 + 0.5 * sin(uv.x * 9.0 + sin(uv.y * 6.0) * 2.0)));
  if (Lt == 0) col = uBg + (col - uBg) * bl; else if (Lt == 1) col *= bl; else col *= mix(1.0, bl, 0.6);
  if (uFlick > 0.0) {
    float band = exp(-pow((fract(uv.y - uT * 0.35) - 0.5) * 7.0, 2.0));
    col *= 1.0 + uFlick * (0.18 * band - 0.08 * hash(vec2(floor(uT * 60.0), 7.0)));
  }
  if (uView != 0.0) {
    float a = uView * (uv.y - 0.5) * 2.0;
    if (Lt == 1) {
      col = mix(col, vec3(dot(col, LW)) * 0.6 + uTint * 0.22, max(a, 0.0) * 0.8);
      col *= 1.0 + min(a, 0.0) * 0.6; col.b *= 1.0 + min(a, 0.0) * 0.4;
    } else if (Lt == 2) {
      col = mix(col, uBg, max(a, 0.0) * 0.6); col = mix(col, uTint * 0.5 + col * 0.5, max(-a, 0.0) * 0.5);
    } else col *= 1.0 - abs(a) * 0.25;
  }
  if (Lt == 0 && uMesh > 0.0) {
    float g1 = step(fract((q.x + q.y) / 7.0), 0.16), g2 = step(fract((q.x - q.y) / 7.0), 0.16);
    col = uBg + (col - uBg) * (1.0 - uMesh * 0.65 * max(g1, g2));
  }
  vec2 ep = min(q, uPanel - q);
  col *= mix(1.0, 0.25 + 0.75 * smoothstep(0.0, 26.0, ep.x) * smoothstep(0.0, 26.0, ep.y), uEdge);
  return col;
}

bool inPanel(vec2 q) { return q.x >= 0.0 && q.y >= 0.0 && q.x < uPanel.x && q.y < uPanel.y; }

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 dp = p - uOrig, pd = uPanel / uScale;
  if (dp.x < -uBez || dp.y < -uBez || dp.x > pd.x + uBez || dp.y > pd.y + uBez) { o = vec4(0.0); return; }
  vec2 q = dp * uScale;
  if (uCurve > 0.0) {
    vec2 c = q / uPanel * 2.0 - 1.0;
    c *= 1.0 + uCurve * 0.18 * dot(c, c);
    q = (c * 0.5 + 0.5) * uPanel;
  }
  vec3 col;
  if (inPanel(q)) {
    col = panel(q);
    if (uGhost > 0.0) {                                  // doppia immagine: riflessione sulla seconda faccia del vetro
      vec2 q2 = q - uGhostOff;
      vec3 g = inPanel(q2) ? panel(q2) : uBg;
      if (uLight > 1.5) col = mix(col, g, uGhost * 0.3); else col += max(g - uBg, 0.0) * uGhost * 0.45;
    }
  } else col = uFrame;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/* Passo 3: vetro davanti al pannello (satinatura, tinta, velatura, glare) */
const FS_GLASS = `#version 300 es
precision highp float;
uniform sampler2D uS;
uniform vec2 uRes, uOrig, uPanelD;
uniform float uBez, uFrost, uFrostR, uTintA, uHaze, uGlare, uGlareA, uGlareW;
uniform vec3 uGT;
out vec4 o;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y), dp = p - uOrig;
  if (dp.x < -uBez || dp.y < -uBez || dp.x > uPanelD.x + uBez || dp.y > uPanelD.y + uBez) { o = vec4(0.0); return; }
  vec3 c = texture(uS, uv).rgb;
  if (uFrost > 0.0) {                                    // vetro satinato: ogni pixel raccoglie luce da punti vicini a caso
    float a = hash(gl_FragCoord.xy) * 6.2832, r0 = 0.35 + 0.65 * hash(gl_FragCoord.yx + 17.0);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      float fi = float(i), r = uFrostR * sqrt((fi + 0.5) / 12.0) * r0, an = fi * 2.39996 + a;
      acc += texture(uS, uv + vec2(cos(an), -sin(an)) * r / uRes).rgb;
    }
    c = mix(c, acc / 12.0, uFrost);
    c *= 1.0 + (hash(gl_FragCoord.xy * 0.73) - 0.5) * uFrost * 0.08;
  }
  c = mix(c, c * uGT * 1.4, uTintA) + uGT * uHaze * 0.22;
  vec2 g = (dp + uBez) / (uPanelD + 2.0 * uBez) - 0.5;
  float an = radians(uGlareA);
  float t = dot(g, vec2(cos(an), sin(an)));
  float band = exp(-pow((t + 0.18) / max(uGlareW * (1.0 + uFrost * 2.0), 0.02), 2.0));
  c += uGlare * (0.32 * band / (1.0 + uFrost * 1.5) + 0.05 * (0.5 - g.y));
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360; s /= 100; l /= 100;
  if (!s) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
const LAYOUT = { none: 0, stripe: 1, delta: 2, pentile: 3 };
const LIGHT = { emit: 0, trans: 1, refl: 2 };
const FACTOR = { none: 1, stripe: 2, delta: 2, pentile: 1.6 };

/* Geometria dei segmenti in pixel fisici */
function segLayout(P) {
  const H = Math.max(8, P.segH), cw = Math.round(H * 0.56), th = Math.max(2, H * P.segT / 100);
  const sp = Math.round(H * P.segSpace / 100), pad = Math.round(H * 0.2), sl = Math.round(H * P.segSlant / 100);
  const ih = P.icons === "none" ? 0 : Math.round(H * 0.24), ig = ih ? Math.round(pad * 0.5) : 0;
  const n = Math.max(1, P.segN | 0);
  const w = pad * 2 + n * cw + (n - 1) * sp + sl, h = pad * 2 + H + ih + ig;
  return { H, cw, th, sp, pad, sl, ih, ig, n, w, h };
}

function drawSegments(c, x, P, seg, t) {
  const L = segLayout(P);
  if (c.width !== L.w || c.height !== L.h) { c.width = L.w; c.height = L.h; }
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = "source-over"; x.fillStyle = "#000"; x.fillRect(0, 0, L.w, L.h);
  x.globalCompositeOperation = "lighter";
  const gap = Math.max(0.5, L.th * P.segGap / 100), h = L.th / 2, top = L.pad + L.ih + L.ig;
  const skew = (X, Y) => [X + (1 - (Y - top) / L.H) * L.sl, Y];
  function hex(p0, p1, diag, lit) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const g = gap + (diag ? h : 0);
    const A = [p0[0] + ux * g, p0[1] + uy * g], B = [p1[0] - ux * g, p1[1] - uy * g];
    const hh = diag ? h * 0.8 : h, tp = Math.max(0, Math.min(hh, (len - 2 * g) * 0.3));   // punta piu corta sui segmenti brevi
    const pts = [A, [A[0] + ux * tp + nx * hh, A[1] + uy * tp + ny * hh], [B[0] - ux * tp + nx * hh, B[1] - uy * tp + ny * hh], B,
      [B[0] - ux * tp - nx * hh, B[1] - uy * tp - ny * hh], [A[0] + ux * tp - nx * hh, A[1] + uy * tp - ny * hh]];
    x.beginPath(); pts.forEach((q, i) => (i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]))); x.closePath();
    x.fillStyle = "#00ff00"; x.fill();
    if (lit) { x.fillStyle = "#ff0000"; x.fill(); }
  }
  // Testo nelle cifre: il punto si aggancia alla cifra precedente; scorre se e piu lungo
  let cells = [];
  const txt = String(seg.text == null ? "" : seg.text).toUpperCase();
  for (const ch of txt) {
    if ((ch === "." || ch === ",") && cells.length && !cells[cells.length - 1].dp) cells[cells.length - 1].dp = true;
    else if (ch === ":") { /* i due punti sono un elemento a parte */ }
    else cells.push({ ch, dp: ch === "." });
  }
  if (cells.length > L.n && P.tscroll) {
    const loop = cells.concat(Array.from({ length: L.n }, () => ({ ch: " " })));
    const off = Math.floor(Math.abs(t / 1000 * P.tscroll)) % loop.length;
    cells = loop.concat(loop).slice(off, off + L.n);
  }
  while (cells.length < L.n) cells.unshift({ ch: " " });
  cells = cells.slice(0, L.n);
  const map = +P.segK === 14 ? SEG14 : SEG7, names = +P.segK === 14 ? "abcdefgGhijklm" : "abcdefG";
  for (let i = 0; i < L.n; i++) {
    const x0 = L.pad + i * (L.cw + L.sp), y0 = top, on = map[cells[i].ch] != null ? map[cells[i].ch] : map["?"] || "";
    const P_ = (u, v) => skew(x0 + h + u * (L.cw - L.th), y0 + h + v * (L.H - L.th) / 2);
    for (const nm of names) {
      let def = SEGDEF[nm], lit = on.includes(nm);
      if (+P.segK !== 14 && nm === "G") { def = SEGDEF.g7; lit = on.includes("g"); }
      hex(P_(def[0], def[1]), P_(def[2], def[3]), "hjkm".includes(nm), lit);
    }
    const dpx = skew(x0 + L.cw + Math.min(L.sp * 0.5, L.th * 1.2) - L.th * 0.5, y0 + L.H - L.th);
    x.beginPath(); x.rect(dpx[0] - L.th * 0.45, dpx[1], L.th * 0.9, L.th * 0.9);
    x.fillStyle = "#00ff00"; x.fill(); if (cells[i].dp) { x.fillStyle = "#ff0000"; x.fill(); }
  }
  // Due punti dopo meta delle cifre
  if (P.colon !== "off" && L.n >= 2) {
    const k = Math.floor(L.n / 2) - 1, cx = L.pad + (k + 1) * (L.cw + L.sp) - L.sp / 2;
    const lit = P.colon === "on" || (seg.colon !== false && Math.floor(t / 500) % 2 === 0);
    for (const v of [0.32, 0.72]) {
      const q = skew(cx, top + L.H * v);
      x.beginPath(); x.rect(q[0] - L.th * 0.45, q[1] - L.th * 0.45, L.th * 0.9, L.th * 0.9);
      x.fillStyle = "#00ff00"; x.fill(); if (lit) { x.fillStyle = "#ff0000"; x.fill(); }
    }
  }
  // Icone fisse sulla riga in alto
  if (L.ih) {
    const icons = [iconBattery, iconSignal, iconBell, iconText("AM"), iconText("PM"), iconArrow];
    const step = (L.w - L.pad * 2) / icons.length, mask = seg.icons != null ? seg.icons : (P.icons === "all" ? 63 : 0b101101);
    icons.forEach((fn, i) => {
      x.save(); x.translate(L.pad + step * i + (step - L.ih * 1.6) / 2, L.pad);
      const path = new Path2D(); fn(path, L.ih * 1.6, L.ih);
      x.fillStyle = "#00ff00"; x.fill(path, "evenodd");
      if (P.icons === "all" || (mask >> i) & 1) { x.fillStyle = "#ff0000"; x.fill(path, "evenodd"); }
      x.restore();
    });
  }
  x.globalCompositeOperation = "source-over";
  return L;
}
function iconBattery(p, w, h) { const t = Math.max(1.5, h * 0.12); p.rect(0, 0, w * 0.88, h); p.rect(t, t, w * 0.88 - 2 * t, h - 2 * t); p.rect(w * 0.88, h * 0.3, w * 0.12, h * 0.4); for (let i = 0; i < 3; i++) p.rect(t * 2 + i * (w * 0.88 - 3 * t) / 3, t * 2, (w * 0.88 - 3 * t) / 3 - t, h - 4 * t); }
function iconSignal(p, w, h) { for (let i = 0; i < 4; i++) { const bh = h * (i + 1) / 4; p.rect(i * w / 4 + w * 0.04, h - bh, w / 4 - w * 0.08, bh); } }
function iconBell(p, w, h) { const cx = w / 2, r = h * 0.38; p.moveTo(cx - r, h * 0.78); p.lineTo(cx - r, h * 0.42); p.arc(cx, h * 0.42, r, Math.PI, 0); p.lineTo(cx + r, h * 0.78); p.lineTo(cx + r * 1.3, h * 0.86); p.lineTo(cx - r * 1.3, h * 0.86); p.closePath(); p.rect(cx - h * 0.1, h * 0.88, h * 0.2, h * 0.12); }
function iconArrow(p, w, h) { p.moveTo(w * 0.3, 0); p.lineTo(w * 0.75, h / 2); p.lineTo(w * 0.3, h); p.closePath(); }
function iconText(s) {
  return function (p, w, h) { const px = h / 7, x0 = (w - (s.length * 6 - 1) * px) / 2; for (let i = 0; i < s.length; i++) { const g = FONT[s[i]]; for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r * 5 + c] === "1") p.rect(x0 + (i * 6 + c) * px, r * px, px * 0.9, px * 0.9); } };
}

function create(canvas, preset, opts) {
  opts = opts || {};
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error("WebGL2 non disponibile");
  const half = !!gl.getExtension("EXT_color_buffer_float");
  let P = Object.assign({}, DEFAULTS, preset || {});
  const content = document.createElement("canvas"); content.width = P.nx; content.height = P.ny;
  const ctx = content.getContext("2d");
  const segC = document.createElement("canvas"), sctx = segC.getContext("2d");

  function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function program(fs) {
    const p = gl.createProgram(); gl.attachShader(p, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  const progC = program(FS_CONTENT), progP = program(FS_PANEL), progG = program(FS_GLASS);
  const scrTex = texture(false), scrFb = gl.createFramebuffer(); let scrW = 0, scrH = 0;
  function texture(mip) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mip ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  const srcTex = texture(false), segTex = texture(true);
  let fbs = null, fbi = 0, first = true, segKey = "", segL = segLayout(P);

  function ensureGrid() {
    if (fbs && fbs.w === P.nx && fbs.h === P.ny) return;
    if (fbs) fbs.list.forEach((f) => { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.t); });
    const list = [0, 1].map(() => {
      const t = texture(true);
      if (half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, P.nx, P.ny, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, P.nx, P.ny, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { t, fb };
    });
    fbs = { w: P.nx, h: P.ny, list }; first = true;
    if (content.width !== P.nx || content.height !== P.ny) { content.width = P.nx; content.height = P.ny; }
  }

  const api = {
    canvas, content, ctx, scale: opts.scale || 1, pan: [0, 0], seg: { text: P.text, icons: null, colon: true },
    get preset() { return P; },
    set(patch) { Object.assign(P, patch); if (content.width !== P.nx || content.height !== P.ny) { content.width = P.nx; content.height = P.ny; } },
    setPreset(p) { P = Object.assign({}, DEFAULTS, p); first = true; api.set({}); },
    /* dimensioni del pannello in pixel fisici */
    panelSize() { if (P.struct === "seg") { segL = segLayout(P); return [segL.w, segL.h]; } return [P.nx * P.pitch, P.ny * P.pitch]; },
    /* in modalita "exact" il canvas prende esattamente la dimensione reale del display piu la cornice */
    deviceSize(dpr) { const s = api.panelSize(), b = P.frameW; return [Math.ceil(s[0] / api.scale + 2 * b), Math.ceil(s[1] / api.scale + 2 * b)]; },
    origin: [0, 0],
    paper() { return P.light === "refl" ? "#fff" : "#000"; },
    ink() { return P.light === "refl" ? "#000" : "#fff"; },
    clear(c) { ctx.fillStyle = c || api.paper(); ctx.fillRect(0, 0, content.width, content.height); },
    textWidth(s, sc) { return (String(s).length * 6 - 1) * (sc || 1); },
    drawText(s, x, y, o) {
      o = o || {}; s = String(s).toUpperCase(); const sc = o.scale || 1, col = o.color || api.ink();
      const each = (fn) => { for (let i = 0; i < s.length; i++) { const g = FONT[s[i]] || FONT["?"]; for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r * 5 + c] === "1") fn(x + (i * 6 + c) * sc, y + r * sc); } };
      if (o.outline) { ctx.fillStyle = o.outlineColor || api.paper(); each((px, py) => ctx.fillRect(px - sc, py - sc, sc * 3, sc * 3)); }
      ctx.fillStyle = col; each((px, py) => ctx.fillRect(px, py, sc, sc));
    },
    drawImage(src, fit) {
      const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height; if (!sw || !sh) return;
      const W = content.width, H = content.height, k = fit === "contain" ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh);
      const w = sw * k, h = sh * k; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, (W - w) / 2, (H - h) / 2, w, h);
    },
    render(t) {
      t = t || 0;
      const dpr = opts.dpr || Math.min(window.devicePixelRatio || 1, 3);
      const ps = api.panelSize(), sc = api.scale, bez = P.frameW;
      let W, H;
      if (opts.exact) { [W, H] = api.deviceSize(dpr); canvas.style.width = W / dpr + "px"; canvas.style.height = H / dpr + "px"; }
      else { W = Math.round(canvas.clientWidth * dpr); H = Math.round(canvas.clientHeight * dpr); }
      if (!W || !H) return;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      api.origin = [Math.floor((W - ps[0] / sc) / 2) + Math.round(api.pan[0]), Math.floor((H - ps[1] / sc) / 2) + Math.round(api.pan[1])];
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      let cTex, lod = 0;
      if (P.struct === "seg") {
        const key = JSON.stringify([P.segN, P.segK, P.segH, P.segT, P.segSlant, P.segGap, P.segSpace, P.icons, P.colon, P.tscroll, api.seg.text, api.seg.icons, P.colon === "blink" ? Math.floor(t / 500) % 2 : 0, P.tscroll ? Math.floor(Math.abs(t / 1000 * P.tscroll)) : 0]);
        if (key !== segKey) {
          segKey = key; drawSegments(segC, sctx, P, api.seg, t);
          gl.bindTexture(gl.TEXTURE_2D, segTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, segC); gl.generateMipmap(gl.TEXTURE_2D);
        }
        cTex = segTex; lod = Math.max(0, Math.log2(segL.H / 40));
      } else {
        ensureGrid();
        gl.bindTexture(gl.TEXTURE_2D, srcTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, content);
        const prev = fbs.list[fbi], next = fbs.list[fbi ^ 1];
        gl.useProgram(progC.p); const u = progC.u;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, srcTex); gl.uniform1i(u.uSrc, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, prev.t); gl.uniform1i(u.uPrev, 1);
        gl.uniform1f(u.uSat, P.sat / 100); gl.uniform1f(u.uCon, P.contrast / 100); gl.uniform1f(u.uGam, P.gamma / 100);
        gl.uniform1f(u.uLev, Math.pow(2, P.bits)); gl.uniform1f(u.uDith, +P.dither); gl.uniform1f(u.uInv, +P.invert);
        gl.uniform1f(u.uMono, P.color === "mono" ? 1 : 0); gl.uniform1f(u.uPers, P.persist / 100 * 0.92); gl.uniform1f(u.uFirst, first ? 1 : 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, next.fb); gl.viewport(0, 0, P.nx, P.ny); gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, next.t); gl.generateMipmap(gl.TEXTURE_2D);
        fbi ^= 1; first = false; cTex = next.t;
      }
      gl.useProgram(progP.p); const u = progP.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cTex); gl.uniform1i(u.uC, 0);
      if (scrW !== W || scrH !== H) {
        scrW = W; scrH = H; gl.bindTexture(gl.TEXTURE_2D, scrTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, scrFb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, scrTex, 0);
      }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cTex);
      gl.bindFramebuffer(gl.FRAMEBUFFER, scrFb); gl.viewport(0, 0, W, H);
      gl.uniform2f(u.uRes, W, H); gl.uniform2f(u.uOrig, api.origin[0], api.origin[1]); gl.uniform2f(u.uGrid, P.nx, P.ny); gl.uniform2f(u.uPanel, ps[0], ps[1]);
      gl.uniform2f(u.uFill, P.fillX / 100, P.fillY / 100);
      const ga = P.ghostA * Math.PI / 180; gl.uniform2f(u.uGhostOff, Math.cos(ga) * P.ghostD * sc, Math.sin(ga) * P.ghostD * sc);
      const seg = P.struct === "seg";
      const f1 = { uScale: sc, uPitch: Math.max(1, P.pitch), uSeg: seg ? 1 : 0, uLayout: LAYOUT[P.layout] || 0, uLight: LIGHT[P.light] || 0, uMono: P.color === "mono" ? 1 : 0,
        uRound: P.round / 100, uFactor: FACTOR[P.layout] || 1, uLod: lod, uBez: bez, uBright: P.bright / 100, uBlack: P.black / 100, uUnlit: P.unlit / 100,
        uScan: P.scan / 100, uBloom: P.bloom / 100, uBack: P.back / 100, uCurve: P.curve / 100, uFlick: P.flick / 100, uNoise: P.noise / 100, uView: P.view / 100,
        uShadow: P.shadow / 100, uMesh: P.mesh / 100, uEdge: P.edge / 100, uGlare: P.glare / 100, uGlareA: P.glareA, uGlareW: P.glareW / 200, uGhost: P.ghost / 100, uT: t / 1000 };
      for (const k in f1) if (u[k]) gl.uniform1f(u[k], f1[k]);
      gl.uniform3fv(u.uTint, hsl(P.tintH, P.tintS, P.tintL)); gl.uniform3fv(u.uBg, hsl(P.bgH, P.bgS, P.bgL));
      const fl = P.frameL / 100; gl.uniform3f(u.uFrame, fl, fl, fl);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const g = progG.u; gl.useProgram(progG.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scrTex); gl.uniform1i(g.uS, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
      gl.uniform2f(g.uRes, W, H); gl.uniform2f(g.uOrig, api.origin[0], api.origin[1]); gl.uniform2f(g.uPanelD, ps[0] / sc, ps[1] / sc);
      const f2 = { uBez: bez, uFrost: P.frost / 100, uFrostR: P.frostR, uTintA: P.gTintA / 100, uHaze: P.haze / 100, uGlare: P.glare / 100, uGlareA: P.glareA, uGlareW: P.glareW / 200 };
      for (const k in f2) if (g[k]) gl.uniform1f(g[k], f2[k]);
      gl.uniform3fv(g.uGT, hsl(P.gTintH, P.gTintS, 50));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    /* copia del display (con cornice) a risoluzione nativa */
    snapshot() {
      const ps = api.panelSize(), b = P.frameW, w = Math.ceil(ps[0] / api.scale + 2 * b), h = Math.ceil(ps[1] / api.scale + 2 * b);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(canvas, api.origin[0] - b, api.origin[1] - b, w, h, 0, 0, w, h);
      return c;
    },
  };
  return api;
}

root.DSP = { create, DEFAULTS, TYPES, FONT, SEG7, SEG14, hsl, segLayout, version: 1 };
})(typeof window !== "undefined" ? window : this);
