// JRN-1 · trascrizione locale (solo desktop).
// Questo worker scarica UNA VOLTA i modelli da huggingface.co (poi restano nella cache del browser)
// e non invia mai i tuoi file: immagini e audio arrivano qui dalla pagina e restano in memoria.
import "./net-guard.js";   // per primo: blocca qualsiasi invio di dati
import { env, pipeline, AutoProcessor, AutoModelForImageTextToText, RawImage } from "./tf/transformers.min.js";

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = new URL("./tf/", import.meta.url).href;

const MODELS = {
  ocr: { id: "onnx-community/GLM-OCR-ONNX", prompt: "Text Recognition:", dtype: { embed_tokens: "q4f16", vision_encoder: "q4f16", decoder_model_merged: "q4f16" } },
  vl: { id: "onnx-community/Qwen3-VL-2B-Instruct-ONNX", prompt: "Trascrivi esattamente tutto il testo scritto in questa pagina, anche a mano, riga per riga, in italiano. Restituisci solo il testo.", dtype: { embed_tokens: "q4f16", vision_encoder: "q4f16", decoder_model_merged: "q4f16" } },
};
let gpu = null, f16 = false;
async function caps() {
  if (gpu !== null) return;
  try { const a = navigator.gpu && (await navigator.gpu.requestAdapter()); gpu = !!a; f16 = !!(a && a.features.has("shader-f16")); } catch (e) { gpu = false; }
}
const prog = (what) => (p) => {
  if (p.status === "progress" && p.total) postMessage({ type: "load", what, file: p.file, loaded: p.loaded, total: p.total });
};

let vlm = null, vlmKey = null;
async function loadVlm(key) {
  if (vlm && vlmKey === key) return vlm;
  await caps();
  if (!gpu) throw new Error("serve WebGPU (Chrome o Safari recenti)");
  const m = MODELS[key];
  const processor = await AutoProcessor.from_pretrained(m.id, { progress_callback: prog("scansioni") });
  const model = await AutoModelForImageTextToText.from_pretrained(m.id, { dtype: f16 ? m.dtype : { embed_tokens: "q4", vision_encoder: "q4", decoder_model_merged: "q4" }, device: "webgpu", use_external_data_format: true, progress_callback: prog("scansioni") });   // i pesi stanno in file .onnx_data separati
  vlm = { processor, model, m }; vlmKey = key; return vlm;
}
async function readImage(blob) {
  let img = await RawImage.fromBlob(blob);
  const M = 1600, s = Math.min(1, M / Math.max(img.width, img.height));   // pagine grandi: lato lungo 1600 px
  if (s < 1) img = await img.resize(Math.round(img.width * s), Math.round(img.height * s));
  return img.rgb();
}
async function ocr(blob, key) {
  const { processor, model, m } = await loadVlm(key);
  const image = await readImage(blob);
  const conv = [{ role: "user", content: [{ type: "image" }, { type: "text", text: m.prompt }] }];
  const text = processor.apply_chat_template(conv, { add_generation_prompt: true });
  const inputs = await processor(text, image);
  let n = 0; const streamer = { put() { n++; if (n % 6 === 0) step(1 - Math.exp(-n / 350)); }, end() {} };   // avanzamento stimato dai token generati
  const out = await model.generate({ ...inputs, max_new_tokens: 2048, do_sample: false, repetition_penalty: 1.05, streamer });
  const dec = processor.batch_decode(out.slice(null, [inputs.input_ids.dims.at(-1), null]), { skip_special_tokens: true });
  return (dec[0] || "").replace(/^```[a-z]*\n?|```$/g, "").replace(/\n{2,}/g, "\n").trim();   // una riga per riga, senza righe vuote in mezzo
}

let asr = null;
async function loadAsr() {
  if (asr) return asr;
  await caps();
  if (gpu && f16) asr = await pipeline("automatic-speech-recognition", "onnx-community/whisper-large-v3-turbo", { device: "webgpu", dtype: { encoder_model: "q4f16", decoder_model_merged: "q4f16" }, progress_callback: prog("audio") });
  else if (gpu) asr = await pipeline("automatic-speech-recognition", "onnx-community/whisper-large-v3-turbo", { device: "webgpu", dtype: { encoder_model: "q4", decoder_model_merged: "q4" }, progress_callback: prog("audio") });
  else asr = await pipeline("automatic-speech-recognition", "onnx-community/whisper-small", { dtype: "q8", progress_callback: prog("audio") });
  return asr;
}
const HALL = /^(sottotitoli( creati)? (a cura|dalla comunità)|grazie (a tutti )?per (la visione|l'ascolto)|grazie a tutti\.?$|amara\.org)/i;   // frasi che Whisper inventa sul silenzio
async function stt(pcm) {                        // a pezzi di massimo 28 s, tagliati nel punto più silenzioso: così si conosce l'avanzamento
  const p = await loadAsr(), R = 16000, out = []; let s = 0;
  while (s < pcm.length) {
    let e = Math.min(pcm.length, s + 28 * R);
    if (e < pcm.length) { let best = e, bv = Infinity; for (let w = s + 20 * R; w + 1600 <= e; w += 800) { let v = 0; for (let j = w; j < w + 1600; j += 4) v += Math.abs(pcm[j]); if (v < bv) { bv = v; best = w + 800; } } e = best; }
    if (e - s > R * 0.3) { const r = await p(pcm.subarray(s, e), { language: "italian", task: "transcribe" }); out.push((r.text || "").trim()); }
    s = e; step(s / pcm.length);
  }
  return out.join(" ").split(/(?<=[.!?])\s+/).filter((s) => !HALL.test(s.trim())).join(" ").trim();
}

async function retry(fn) {                        // download lunghi: se la rete cade riprova (i file già finiti restano in cache)
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= 2 || !/network|fetch|load/i.test(String(e && e.message))) throw e; postMessage({ type: "load", what: "riprovo", loaded: i + 1, total: 3 }); await new Promise((r) => setTimeout(r, 3000)); } }
}
let CUR = 0; const step = (f) => postMessage({ type: "prog", id: CUR, f });
self.onmessage = async (e) => {
  const { id, kind, blob, pcm, engine } = e.data; CUR = id;
  try {
    const text = kind === "image" ? await retry(() => ocr(blob, engine || "ocr")) : await retry(() => stt(pcm));
    postMessage({ type: "done", id, text });
  } catch (err) { postMessage({ type: "error", id, error: String((err && err.message) || err) }); }
};
