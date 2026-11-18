import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // The package is pure: no clock, no randomness, no logging, no DOM or
    // host globals (AGENTS.md). Time and random numbers come in as input.
    // test/purity.test.ts keeps this rule set from being removed silently.
    files: ['src/**/*.ts'],
    rules: {
      'no-console': 'error',
      'no-restricted-globals': [
        'error',
        ...['Date', 'performance', 'crypto'].map((name) => ({
          name,
          message: 'materia gets time and randomness as input.',
        })),
        ...['window', 'document', 'navigator', 'indexedDB', 'fetch', 'localStorage', 'process'].map(
          (name) => ({ name, message: 'materia has no host API.' }),
        ),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: 'materia is deterministic.',
        },
      ],
    },
  },
);
