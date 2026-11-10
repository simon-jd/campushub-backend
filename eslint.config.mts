import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['node_modules/**', 'dist/**', 'client/dist/**', 'coverage/**', '.superpowers/**'],
  },
  {
    files: ['eslint.config.mts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false }],
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    files: ['src/routes/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['mongoose', 'mongodb'],
          patterns: ['**/services/**', '**/models/**'],
        },
      ],
    },
  },
  {
    files: ['src/controllers/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: ['mongoose', 'mongodb'], patterns: ['**/models/**'] },
      ],
    },
  },
  {
    files: ['src/services/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['express', 'mongodb'],
          patterns: ['**/controllers/**', '**/routes/**'],
        },
      ],
    },
  },
  {
    files: ['src/models/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['express', 'mongodb'],
          patterns: ['**/services/**', '**/controllers/**', '**/routes/**'],
        },
      ],
    },
  },
  {
    files: ['src/config/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['express', 'mongoose', 'mongodb'],
          patterns: ['**/services/**', '**/controllers/**', '**/routes/**', '**/models/**'],
        },
      ],
    },
  },
  {
    files: ['src/scripts/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['express', 'mongoose', 'mongodb'],
          patterns: ['**/controllers/**', '**/routes/**', '**/models/**'],
        },
      ],
    },
  },
  {
    files: ['**/*.{js,cjs,mjs,jsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'Program', message: 'Use TypeScript for authored source and tooling files.' },
      ],
    },
  },
);
