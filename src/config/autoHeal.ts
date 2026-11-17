// Environment contract for the CI auto-heal tool. Like environment.ts, this is the only place
// that reads these variables; values that reach git or gh arguments are validated strictly.
import type { AutoHealConfig } from '../interfaces/autoHeal';

const DEFAULT_MODEL = 'claude-sonnet-5-5';
const DEFAULT_LOG_PATH = 'test-results.log';

export function loadAutoHealConfig(env: NodeJS.ProcessEnv): AutoHealConfig {
  return {
    anthropicApiKey: requireValue(env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY'),
    model: matchOrThrow(
      env.AUTO_FIX_MODEL ?? DEFAULT_MODEL,
      /^[A-Za-z0-9._-]{1,100}$/,
      'AUTO_FIX_MODEL',
    ),
    logPath: env.AUTO_FIX_LOG_PATH ?? DEFAULT_LOG_PATH,
    // A leading "-" would be read as an option by git/gh, so it is rejected.
    baseBranch: matchOrThrow(
      env.BASE_BRANCH,
      /^[A-Za-z0-9_][A-Za-z0-9._/-]{0,199}$/,
      'BASE_BRANCH',
    ),
    runId: matchOrThrow(env.RUN_ID, /^\d{1,20}$/, 'RUN_ID'),
  };
}

function requireValue(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === '') {
    // Never echo the value: ANTHROPIC_API_KEY is a secret.
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function matchOrThrow(value: string | undefined, pattern: RegExp, name: string): string {
  if (value === undefined || !pattern.test(value)) {
    throw new Error(`Invalid or missing ${name}.`);
  }
  return value;
}
