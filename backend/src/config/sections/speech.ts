import { z } from 'zod';
import { defineSection, envPositiveInt } from '../helpers.js';

/**
 * Speech providers. Real provider adapters are added here by the voice module
 * once provider research (docs/research/speech-providers.md) is complete.
 *  - simulated: development SIMULATOR (labelled `simulated: true`); forbidden in production.
 *  - none:      speech disabled; web users get the text-only fallback.
 */
export const STT_PROVIDERS = ['none', 'simulated'] as const;
export const TTS_PROVIDERS = ['none', 'simulated'] as const;
export type SttProviderName = (typeof STT_PROVIDERS)[number];
export type TtsProviderName = (typeof TTS_PROVIDERS)[number];

export const speechSection = defineSection({
  name: 'speech',
  schema: z.object({
    STT_PROVIDER: z.enum(STT_PROVIDERS).default('none'),
    TTS_PROVIDER: z.enum(TTS_PROVIDERS).default('none'),
    AUDIO_MAX_BYTES: envPositiveInt.max(20 * 1024 * 1024).default(5 * 1024 * 1024),
    AUDIO_MAX_SECONDS: envPositiveInt.max(300).default(60),
    SPEECH_TIMEOUT_MS: envPositiveInt.max(120_000).default(20_000),
  }),
  map: (e) => ({
    sttProvider: e.STT_PROVIDER,
    ttsProvider: e.TTS_PROVIDER,
    audioMaxBytes: e.AUDIO_MAX_BYTES,
    audioMaxSeconds: e.AUDIO_MAX_SECONDS,
    timeoutMs: e.SPEECH_TIMEOUT_MS,
  }),
  validate: (c, ctx) => {
    const issues: string[] = [];
    if (ctx.isProduction && c.sttProvider === 'simulated') issues.push('STT_PROVIDER=simulated is not allowed in production');
    if (ctx.isProduction && c.ttsProvider === 'simulated') issues.push('TTS_PROVIDER=simulated is not allowed in production');
    return issues;
  },
});

export type SpeechConfig = ReturnType<typeof speechSection.map>;
