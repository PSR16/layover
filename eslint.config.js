import eslintJs from '@eslint/js';
import globals from 'globals';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import prettier from 'eslint-config-prettier';

// Readability rules: keep functions small, flat and clearly named.
const readabilityRules = {
  complexity: ['error', 8],
  'max-depth': ['error', 3],
  'max-nested-callbacks': ['error', 3],
  'max-params': ['error', 4],
  'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
  'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
  'no-nested-ternary': 'error',
  'no-magic-numbers': [
    'warn',
    { ignore: [-1, 0, 1, 2], ignoreArrayIndexes: true, enforceConst: true },
  ],
  'id-length': ['error', { min: 3, exceptions: ['id', 'i', 'x', 'y', 'e'] }],
  'sonarjs/cognitive-complexity': ['error', 10],
  'unicorn/prevent-abbreviations': [
    'error',
    { allowList: { props: true, args: true, params: true, env: true, dev: true, docs: true } },
  ],
  'unicorn/no-array-for-each': 'error',
  'unicorn/no-nested-ternary': 'off',
  'unicorn/filename-case': ['error', { case: 'kebabCase' }],
};

export default [
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  eslintJs.configs.recommended,
  sonarjs.configs.recommended,
  {
    plugins: { unicorn },
    rules: readabilityRules,
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
  },
  { files: ['src/**/*.js'], languageOptions: { globals: globals.browser } },
  {
    // Pure logic: no DOM, no network, no browser globals (see tech.md).
    files: ['src/lib/**/*.js'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'fetch',
        'navigator',
        'XMLHttpRequest',
      ],
      'no-restricted-imports': [
        'error',
        { patterns: ['../views/*', '../components/*', '../map/*', '../api/*', 'leaflet'] },
      ],
    },
  },
  {
    // Build tools run in Node and may print to the console.
    files: ['tools/**/*.js'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off', 'no-magic-numbers': 'off' },
  },
  {
    // The risk config is the one place where raw numbers belong (R30).
    files: ['src/lib/risk-config.js', 'src/config/**/*.js'],
    rules: { 'no-magic-numbers': 'off' },
  },
  {
    files: ['tests/**/*.js', '**/*.config.js'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-magic-numbers': 'off',
      'max-lines-per-function': 'off',
      'sonarjs/no-duplicate-string': 'off',
    },
  },
  prettier,
];
