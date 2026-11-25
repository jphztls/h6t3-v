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
  const out = await model.generate({ ...inputs, max_new_tokens: 2048, do_sample: false, repetition_penalty: 1.05 });
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
async function stt(pcm) {
  const p = await loadAsr();
  const r = await p(pcm, { language: "italian", task: "transcribe", chunk_length_s: 30, stride_length_s: 5 });
  return (r.text || "").split(/(?<=[.!?])\s+/).filter((s) => !HALL.test(s.trim())).join(" ").trim();
}

async function retry(fn) {                        // download lunghi: se la rete cade riprova (i file già finiti restano in cache)
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= 2 || !/network|fetch|load/i.test(String(e && e.message))) throw e; postMessage({ type: "load", what: "riprovo", loaded: i + 1, total: 3 }); await new Promise((r) => setTimeout(r, 3000)); } }
}
self.onmessage = async (e) => {
  const { id, kind, blob, pcm, engine } = e.data;
  try {
    const text = kind === "image" ? await retry(() => ocr(blob, engine || "ocr")) : await retry(() => stt(pcm));
    postMessage({ type: "done", id, text });
  } catch (err) { postMessage({ type: "error", id, error: String((err && err.message) || err) }); }
};
