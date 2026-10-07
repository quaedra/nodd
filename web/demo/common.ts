import { parseModelConfig } from "@nodd/core";
import type { Device, ModelConfig } from "@nodd/browser";

/** Site root ("/" locally, "/nodd/" on quaedra.com). Every asset URL goes through url(). */
export const BASE = import.meta.env.BASE_URL;
export const url = (path: string) => BASE + path.replace(/^\/+/, "");
/** A page's address: clean URLs (/nodd/train) on quaedra.com, train.html on the dev server. */
export const page = (name: string, query = "") =>
  BASE + (name && import.meta.env.DEV ? `${name}.html` : name) + query;
export const ORT_WASM = url("ort/");

export const params = new URLSearchParams(location.search);
export const MODEL_URL = params.get("model") ?? url("models/comment_moderation/v4");

export interface ModelEntry {
  id: string;
  path: string;
  base: string;
  downloadMB: number;
}

export async function modelIndex(): Promise<ModelEntry[]> {
  try {
    const entries: ModelEntry[] = await (await fetch(url("models/index.json"))).json();
    return entries.map((e) => ({ ...e, path: url(e.path) }));
  } catch {
    return [];
  }
}

export interface Config {
  name: string;
  device: Device;
  dtype: "q8" | "fp32";
  /** compared against parity.jsonl (the exported artifact's Python predictions) */
  parity: boolean;
}

/** Backends, fastest single-input first: WASM beats WebGPU at this model size (see the benchmark). */
export const CONFIGS: Config[] = [
  { name: "transformers.js · wasm · q8", device: "wasm", dtype: "q8", parity: true },
  { name: "transformers.js · webgpu · q8", device: "webgpu", dtype: "q8", parity: true },
  { name: "transformers.js · webgpu · fp32", device: "webgpu", dtype: "fp32", parity: false },
];

/** Reads nodd.json via the library's model cache first (works offline once loaded). */
export async function modelConfig(model = MODEL_URL): Promise<ModelConfig> {
  const file = new URL(`${model.replace(/\/+$/, "")}/nodd.json`, location.href).href;
  const hit = typeof caches !== "undefined" ? await (await caches.open("nodd-models-v1")).match(file) : undefined;
  return parseModelConfig(await (hit ?? (await fetch(file))).json());
}

/** Backend configs for a model, minus ones whose files aren't deployed (e.g. the fp32 file). */
export async function configsFor(model = MODEL_URL): Promise<Config[]> {
  const cfg = await modelConfig(model);
  return CONFIGS.filter((c) => c.dtype !== "fp32" || !!cfg.onnx.fp32_file);
}

/** The backend the demos use: the fastest for single inputs. Bench and parity run every backend. */
export const demoConfig = CONFIGS[0];

/** Vendor/architecture of the WebGPU adapter (tells a real GPU from a software fallback). */
export async function gpuAdapterInfo(): Promise<Record<string, string> | null> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ info?: Record<string, string> } | null> } }).gpu;
  try {
    const info = (await gpu?.requestAdapter())?.info;
    return info ? { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description } : null;
  } catch {
    return null;
  }
}

export async function webgpuAvailable(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  try {
    return !!gpu && (await gpu.requestAdapter()) != null;
  } catch {
    return false;
  }
}

export interface ParityRow {
  text: string;
  label: string;
  probabilities: Record<string, number>;
}

export async function parityRows(model = MODEL_URL): Promise<ParityRow[]> {
  const res = await fetch(`${model}/parity.jsonl`);
  return (await res.text())
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
}

export function percentile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
}

export const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "—");
