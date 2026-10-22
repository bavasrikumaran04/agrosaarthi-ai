import { z } from 'zod';
import { defineSection, envPositiveInt } from '../helpers.js';

/**
 * Conversational AI provider.
 *  - gemini:      real Google Gemini API (requires GEMINI_API_KEY and GEMINI_MODEL).
 *  - development: deterministic rule-based SIMULATOR for local development and tests.
 *                 Every response it produces is labelled `simulated: true`. Forbidden in production.
 *  - none:        AI disabled; the assistant answers only with retrieved source excerpts
 *                 (clearly labelled as non-AI) and offers expert escalation.
 */
export const AI_PROVIDERS = ['gemini', 'development', 'none'] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

export const aiSection = defineSection({
  name: 'ai',
  schema: z.object({
    AI_PROVIDER: z.enum(AI_PROVIDERS).default('none'),
    GEMINI_API_KEY: z.string().optional(),
    /** Exact model identifier; deliberately no default — see docs/research/gemini-api.md for verified IDs. */
    GEMINI_MODEL: z.string().optional(),
    GEMINI_TIMEOUT_MS: envPositiveInt.max(120_000).default(20_000),
    /** Retries for transient failures only (429/5xx/timeouts); never for validation or auth errors. */
    GEMINI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    AI_MAX_CONCURRENCY: envPositiveInt.max(64).default(4),
    AI_MAX_OUTPUT_TOKENS: envPositiveInt.max(8192).default(1024),
    /** Per-user daily cap on AI-backed requests (assistant turns, analyses, voice turns). */
    AI_DAILY_REQUEST_QUOTA_PER_USER: envPositiveInt.default(60),
    /** Platform-wide daily cap on AI provider calls (cost guard). */
    AI_DAILY_REQUEST_QUOTA_GLOBAL: envPositiveInt.default(5_000),
    ASSISTANT_MAX_TURNS_PER_SESSION: envPositiveInt.max(200).default(30),
    /** How many recent turns are sent to the model as context (older turns are summarised). */
    ASSISTANT_CONTEXT_TURNS: envPositiveInt.max(40).default(8),
    ASSISTANT_MAX_QUESTION_CHARS: envPositiveInt.max(10_000).default(1_500),
  }),
  map: (e) => ({
    provider: e.AI_PROVIDER,
    gemini: {
      apiKey: e.GEMINI_API_KEY,
      model: e.GEMINI_MODEL,
      timeoutMs: e.GEMINI_TIMEOUT_MS,
      maxRetries: e.GEMINI_MAX_RETRIES,
    },
    maxConcurrency: e.AI_MAX_CONCURRENCY,
    maxOutputTokens: e.AI_MAX_OUTPUT_TOKENS,
    dailyQuotaPerUser: e.AI_DAILY_REQUEST_QUOTA_PER_USER,
    dailyQuotaGlobal: e.AI_DAILY_REQUEST_QUOTA_GLOBAL,
    assistant: {
      maxTurnsPerSession: e.ASSISTANT_MAX_TURNS_PER_SESSION,
      contextTurns: e.ASSISTANT_CONTEXT_TURNS,
      maxQuestionChars: e.ASSISTANT_MAX_QUESTION_CHARS,
    },
  }),
  validate: (c, ctx) => {
    const issues: string[] = [];
    if (c.provider === 'gemini') {
      if (!c.gemini.apiKey) issues.push('GEMINI_API_KEY is required when AI_PROVIDER=gemini');
      if (!c.gemini.model) issues.push('GEMINI_MODEL is required when AI_PROVIDER=gemini');
    }
    if (ctx.isProduction && c.provider === 'development') {
      issues.push('AI_PROVIDER=development is a simulator and is not allowed in production (use gemini or none)');
    }
    return issues;
  },
});

export type AiConfig = ReturnType<typeof aiSection.map>;
