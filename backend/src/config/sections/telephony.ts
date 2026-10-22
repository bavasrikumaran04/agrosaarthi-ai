import { z } from 'zod';
import { defineSection, envBool, envSecret } from '../helpers.js';

/**
 * Telephony. Real provider adapters are added here by the calls module once
 * provider research (docs/research/telephony-providers.md) is complete.
 *  - none: no real telephone provider configured.
 * The SIMULATOR is controlled separately (TELEPHONY_SIMULATOR_ENABLED) because it can
 * coexist with a real provider; simulated calls are always stored with isSimulated=true.
 */
export const TELEPHONY_PROVIDERS = ['none'] as const;
export type TelephonyProviderName = (typeof TELEPHONY_PROVIDERS)[number];

export const telephonySection = defineSection({
  name: 'telephony',
  schema: z.object({
    TELEPHONY_PROVIDER: z.enum(TELEPHONY_PROVIDERS).default('none'),
    TELEPHONY_SIMULATOR_ENABLED: envBool.optional(),
    /** HMAC secret the simulator uses to sign its webhook calls, exercising the same verification path as real providers. */
    TELEPHONY_SIMULATOR_SECRET: envSecret(32).optional(),
    /** Explicitly allow the simulator in production (admin-only, for demonstrations). */
    ALLOW_TELEPHONY_SIMULATOR_IN_PRODUCTION: envBool.optional(),
  }),
  map: (e, ctx) => ({
    provider: e.TELEPHONY_PROVIDER,
    simulatorEnabled: e.TELEPHONY_SIMULATOR_ENABLED ?? !ctx.isProduction,
    simulatorSecret: e.TELEPHONY_SIMULATOR_SECRET,
    allowSimulatorInProduction: e.ALLOW_TELEPHONY_SIMULATOR_IN_PRODUCTION ?? false,
  }),
  validate: (c, ctx) => {
    const issues: string[] = [];
    if (c.simulatorEnabled && !c.simulatorSecret) {
      issues.push('TELEPHONY_SIMULATOR_SECRET is required when the telephony simulator is enabled');
    }
    if (ctx.isProduction && c.simulatorEnabled && !c.allowSimulatorInProduction) {
      issues.push(
        'The telephony simulator is disabled in production unless ALLOW_TELEPHONY_SIMULATOR_IN_PRODUCTION=true ' +
          '(simulated calls are never real telephone calls)',
      );
    }
    return issues;
  },
});

export type TelephonyConfig = ReturnType<typeof telephonySection.map>;
