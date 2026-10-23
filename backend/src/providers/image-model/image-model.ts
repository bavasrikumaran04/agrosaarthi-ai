import { createHash } from 'node:crypto';
import type { ImageModelConfig } from '../../config/sections/image-model.js';
import { Errors } from '../../lib/errors.js';
import { TimeoutError, withRetry, withTimeout } from '../../lib/resilience.js';

/** Normalised output of any crop-disease model adapter. */
export interface ModelPrediction {
  classKey: string;
  cropKey?: string;
  diseaseKey?: string;
  label: string;
  /** Model score (softmax). NOT a verified diagnostic certainty. */
  score: number;
}

export interface ModelResult {
  provider: string;
  model: { name: string; version: string };
  simulated: boolean;
  predictions: ModelPrediction[];
  uncertainty: { maxProbability: number; margin: number; abstain: boolean; reasons: string[] };
  outOfDomain: { flagged: boolean; score: number | null; threshold: number | null; method: string };
  quality: { ok: boolean; issues: string[]; metrics: Record<string, number> };
  inferenceMs: number;
}

export interface CropDiseaseModel {
  readonly name: string;
  readonly simulated: boolean;
  predict(image: Buffer, contentType: string): Promise<ModelResult>;
  modelCard(): Promise<Record<string, unknown> | null>;
  health(): Promise<{ ok: boolean; detail?: string }>;
}

class UpstreamStatusError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super(`model service responded ${status}`);
  }
}

/** HTTP client for the Python model service (model-service/). */
export function createModelServiceAdapter(cfg: ImageModelConfig, fetchImpl: typeof fetch = fetch): CropDiseaseModel {
  const base = cfg.serviceUrl!;
  const headers = { Authorization: `Bearer ${cfg.serviceToken}` };

  const call = async (path: string, init: RequestInit) =>
    withRetry(
      () =>
        withTimeout(async (signal) => {
          const res = await fetchImpl(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) }, signal });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
            throw new UpstreamStatusError(res.status, body.error?.code);
          }
          return res.json() as Promise<unknown>;
        }, cfg.timeoutMs, 'model service'),
      {
        retries: 1,
        baseDelayMs: 300,
        isRetryable: (e) => e instanceof TimeoutError || (e instanceof UpstreamStatusError && (e.status === 503 || e.status >= 500)),
      },
    );

  return {
    name: 'model-service',
    simulated: false,
    async predict(image, contentType) {
      const form = new FormData();
      form.append('image', new Blob([new Uint8Array(image)], { type: contentType }), 'image');
      form.append('top_k', '3');
      try {
        const r = (await call('/v1/predict', { method: 'POST', body: form })) as Omit<ModelResult, 'provider' | 'simulated'>;
        if (!r || !Array.isArray(r.predictions) || r.predictions.length === 0 || !r.model) throw Errors.upstreamError('Crop disease model');
        return { ...r, provider: 'model-service', simulated: false };
      } catch (err) {
        if (err instanceof UpstreamStatusError) {
          if (err.status === 400 || err.status === 415 || err.status === 413) throw Errors.unprocessable('The image could not be analysed. Please take a clearer JPEG or PNG photo.');
          throw Errors.serviceUnavailable('Crop disease model', { cause: err });
        }
        if (err instanceof TimeoutError) throw Errors.upstreamTimeout('Crop disease model', { cause: err });
        if (err instanceof Error && err.name === 'AppError') throw err;
        throw Errors.serviceUnavailable('Crop disease model', { cause: err });
      }
    },
    async modelCard() {
      try {
        return (await call('/v1/model', { method: 'GET' })) as Record<string, unknown>;
      } catch {
        return null;
      }
    },
    async health() {
      try {
        const res = await fetchImpl(`${base}/ready`, { signal: AbortSignal.timeout(3000) });
        return res.ok ? { ok: true } : { ok: false, detail: 'model not loaded' };
      } catch {
        return { ok: false, detail: 'unreachable' };
      }
    },
  };
}

/**
 * DEVELOPMENT SIMULATOR — does not analyse the image. It derives a pseudo-random
 * class from the image hash so the workflow can be exercised without a model.
 * Every result is marked simulated:true and shown with a warning banner. Refused
 * in production by config validation.
 */
export function createSimulatedModel(classes: Array<{ classKey: string; cropKey: string; diseaseKey: string; label: string }>): CropDiseaseModel {
  return {
    name: 'simulated',
    simulated: true,
    async predict(image) {
      const h = createHash('sha256').update(image).digest();
      const pick = (i: number) => classes[h[i]! % classes.length]!;
      const a = pick(0);
      const b = pick(1) === a ? pick(2) : pick(1);
      const top = 0.4 + (h[3]! / 255) * 0.5;
      const second = (1 - top) * 0.6;
      const predictions = [
        { ...a, score: Number(top.toFixed(4)) },
        { ...b, score: Number(second.toFixed(4)) },
      ];
      return {
        provider: 'simulated',
        model: { name: 'SIMULATOR (not a real model)', version: '0' },
        simulated: true,
        predictions,
        uncertainty: { maxProbability: top, margin: top - second, abstain: top < 0.6, reasons: top < 0.6 ? ['LOW_CONFIDENCE'] : [] },
        outOfDomain: { flagged: false, score: null, threshold: null, method: 'none (simulator)' },
        quality: { ok: true, issues: [], metrics: {} },
        inferenceMs: 0,
      };
    },
    async modelCard() {
      return { name: 'SIMULATOR', version: '0', simulated: true };
    },
    async health() {
      return { ok: true, detail: 'simulator' };
    },
  };
}
