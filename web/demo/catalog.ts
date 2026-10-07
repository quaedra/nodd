// Catalog entries from models/index.json (written by scripts/sync-model.mjs) with the card fields
// the Repository and model pages show.
import { useEffect, useState } from "react";
import { type ModelEntry, modelIndex, page } from "./common";

export interface LabelMetrics {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface CatalogEntry extends ModelEntry {
  task: string;
  version: string;
  description: string;
  labels: Record<string, string>;
  threshold: number;
  created: string;
  data: { train: number; val: number; test: number };
  metrics: {
    macroF1: number;
    accuracy: number;
    testN: number;
    perLabel: Record<string, LabelMetrics>;
    coverage: number;
    accuracyOnCovered: number | null;
    targetPrecision: number;
    eceBefore: number;
    eceAfter: number;
  } | null;
  examples: string[];
}

const isCatalogEntry = (m: ModelEntry): m is CatalogEntry => "task" in m && "labels" in m;

/** All models in the index (null while loading); catalog entries carry the card fields. */
export function useModels(): ModelEntry[] | null {
  const [models, setModels] = useState<ModelEntry[] | null>(null);
  useEffect(() => void modelIndex().then(setModels), []);
  return models;
}

export const catalogOf = (models: ModelEntry[] | null): CatalogEntry[] => (models ?? []).filter(isCatalogEntry);

/** support_triage → Support triage */
export const title = (task: string) => task.charAt(0).toUpperCase() + task.slice(1).replaceAll("_", " ");

export const pct = (x: number | null | undefined, d = 1) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);

export const modelPage = (m: ModelEntry) => page("model", `?model=${encodeURIComponent(m.path)}`);

/** Newest version first: v10 > v2 > v1. */
export const byVersionDesc = (a: CatalogEntry, b: CatalogEntry) =>
  (Number(b.version.replace(/\D/g, "")) || 0) - (Number(a.version.replace(/\D/g, "")) || 0);
