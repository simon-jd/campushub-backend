// Environment contract for the CI auto-heal tool. Like environment.ts, this is the only place
// that reads these variables; values that reach git or gh arguments are validated strictly.
import type { AutoHealConfig } from '../interfaces/autoHeal';

// DeepSeek's Anthropic-compatible endpoint. AUTO_FIX_API_URL overrides it for any other provider.
const DEFAULT_API_BASE_URL = 'https://api.deepseek.com/anthropic';
const DEFAULT_MODEL = 'deepseek-flash';
const DEFAULT_LOG_PATH = 'test-results.log';

export function loadAutoHealConfig(env: NodeJS.ProcessEnv): AutoHealConfig {
  return {
    anthropicApiKey: requireValue(env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY'),
    apiBaseUrl: parseApiBaseUrl(env.AUTO_FIX_API_URL),
    model: matchOrThrow(
      orDefault(env.AUTO_FIX_MODEL, DEFAULT_MODEL),
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

// Unset and empty are the same: GitHub Actions passes an unset `vars.*` as an empty string.
function orDefault(value: string | undefined, fallback: string): string {
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function parseApiBaseUrl(value: string | undefined): string {
  const raw = orDefault(value, DEFAULT_API_BASE_URL);
  // The API key is sent to this URL, so plain http is rejected. The URL is never echoed.
  if (!/^https:\/\/[^\s?#]+$/.test(raw)) {
    throw new Error('Invalid AUTO_FIX_API_URL: expected an https:// base URL.');
  }
  return raw.replace(/\/+$/, '');
}
