import { loadAutoHealConfig } from '../../config/autoHeal';
import {
  extractReferencedPaths,
  findToolInput,
  isEditableSourcePath,
  parseAgentPatch,
} from '../autoHeal.validation';

describe('isEditableSourcePath', () => {
  it.each(['src/services/reservation.service.ts', 'src/validation/reservation.validation.ts'])(
    'allows %s',
    (path) => {
      expect(isEditableSourcePath(path)).toBe(true);
    },
  );

  it.each([
    'src/services/__tests__/reservation.service.test.ts',
    'src/tests/lab2.test.ts',
    'src/test/setup.ts',
    'src/scripts/autoHeal.ts',
    'src/../package.json',
    'jest.config.ts',
    'docs/openapi.json',
    '.github/workflows/ci.yml',
    'src/app.js',
  ])('rejects %s', (path) => {
    expect(isEditableSourcePath(path)).toBe(false);
  });
});

describe('extractReferencedPaths', () => {
  it('returns unique src paths in order of appearance', () => {
    const log = [
      'at Object.<anonymous> (src/services/__tests__/reservation.service.test.ts:50:5)',
      'at create (src/services/reservation.service.ts:88:11)',
      'at again (src/services/reservation.service.ts:90:3)',
    ].join('\n');
    expect(extractReferencedPaths(log)).toEqual([
      'src/services/__tests__/reservation.service.test.ts',
      'src/services/reservation.service.ts',
    ]);
  });
});

describe('findToolInput', () => {
  it('finds the named tool_use input', () => {
    const response = {
      content: [
        { type: 'text', text: 'hi' },
        { type: 'tool_use', name: 'submit_patch', input: { a: 1 } },
      ],
    };
    expect(findToolInput(response, 'submit_patch')).toEqual({ a: 1 });
  });

  it('returns undefined for malformed responses', () => {
    expect(findToolInput(null, 'submit_patch')).toBeUndefined();
    expect(findToolInput({ content: 'x' }, 'submit_patch')).toBeUndefined();
    expect(findToolInput({ content: [] }, 'submit_patch')).toBeUndefined();
  });
});

describe('parseAgentPatch', () => {
  const file = { path: 'src/services/reservation.service.ts', content: 'export {};\n' };

  it('accepts a well-formed patch', () => {
    expect(parseAgentPatch({ summary: ' fixed ', files: [file] })).toEqual({
      summary: 'fixed',
      files: [file],
    });
  });

  it.each([
    ['non-object', 'nope'],
    ['missing files', { summary: 's' }],
    ['empty files', { summary: 's', files: [] }],
    ['test file', { summary: 's', files: [{ path: 'src/tests/lab2.test.ts', content: 'x' }] }],
    [
      'unit test file',
      { summary: 's', files: [{ path: 'src/a/__tests__/b.test.ts', content: 'x' }] },
    ],
    ['empty content', { summary: 's', files: [{ path: file.path, content: '' }] }],
    ['duplicate path', { summary: 's', files: [file, file] }],
    ['non-string content', { summary: 's', files: [{ path: file.path, content: 1 }] }],
  ])('rejects %s', (_name, input) => {
    expect(() => parseAgentPatch(input)).toThrow();
  });
});

describe('loadAutoHealConfig', () => {
  const env = {
    ANTHROPIC_API_KEY: 'k',
    BASE_BRANCH: 'test/breaking-reservation-change',
    RUN_ID: '42',
  };

  it('applies defaults', () => {
    expect(loadAutoHealConfig(env)).toMatchObject({
      apiBaseUrl: 'https://api.deepseek.com/anthropic',
      model: 'deepseek-v4-pro',
      logPath: 'test-results.log',
      baseBranch: 'test/breaking-reservation-change',
      runId: '42',
    });
  });

  it('accepts an https override, trims a trailing slash, and treats empty as unset', () => {
    expect(
      loadAutoHealConfig({ ...env, AUTO_FIX_API_URL: 'https://example.com/anthropic/' }).apiBaseUrl,
    ).toBe('https://example.com/anthropic');
    expect(loadAutoHealConfig({ ...env, AUTO_FIX_API_URL: '', AUTO_FIX_MODEL: '' })).toMatchObject({
      apiBaseUrl: 'https://api.deepseek.com/anthropic',
      model: 'deepseek-v4-pro',
    });
  });

  it.each([
    ['http api url', { ...env, AUTO_FIX_API_URL: 'http://example.com' }],
    ['missing key', { ...env, ANTHROPIC_API_KEY: '' }],
    ['option-like branch', { ...env, BASE_BRANCH: '--force' }],
    ['non-numeric run id', { ...env, RUN_ID: 'abc' }],
  ])('rejects %s', (_name, bad) => {
    expect(() => loadAutoHealConfig(bad)).toThrow();
  });
});
