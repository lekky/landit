import js from '@eslint/js';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * `eslint-config-next` assumes it is the whole config of an app at the repo
 * root. Here it is one workspace among several, so every block it contributes is
 * narrowed to `apps/web` — except its global-ignores block, which must stay
 * global to keep working.
 */
const nextForWeb = nextCoreWebVitals.map((config) =>
  Object.keys(config).length === 1 && config.ignores
    ? config
    : { ...config, files: ['apps/web/**/*.{js,jsx,mjs,ts,tsx}'] },
);

/**
 * One flat config for the whole workspace. ESLint's flat config does not cascade
 * from nested files, so per-package rules are expressed as scoped blocks here.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      'pocketbase/.bin/**',
      'pocketbase/.pb_data/**',
      // The received design pack is reference material, not our code.
      'design-handoff/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  /**
   * The rule that keeps a native app cheap (plan §2.2): `packages/core` is pure
   * TypeScript. No React, no Next, no React Native, no DOM — and nothing from a
   * layer above it. Every game rule lives here as a pure function so hooks, the
   * web UI and a future Expo app can all call the same one.
   *
   * This is enforcement, not documentation. Do not relax it to make an import
   * work; move the code instead.
   */
  {
    files: ['packages/core/**/*.ts'],
    languageOptions: {
      globals: {},
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
                'next',
                'next/*',
                'react-native',
                'react-native/*',
                '@landit/db',
                '@landit/db/*',
                '@landit/ui-web',
                '@landit/ui-web/*',
                'pocketbase',
              ],
              message:
                'packages/core is pure TypeScript (plan §2.2): no React, Next, React Native, DOM, or anything from a layer above it.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'packages/core must not touch the DOM (plan §2.2).' },
        { name: 'document', message: 'packages/core must not touch the DOM (plan §2.2).' },
        { name: 'navigator', message: 'packages/core must not touch the DOM (plan §2.2).' },
        { name: 'localStorage', message: 'packages/core must not touch the DOM (plan §2.2).' },
        { name: 'sessionStorage', message: 'packages/core must not touch the DOM (plan §2.2).' },
      ],
    },
  },

  // Next.js rules apply to the web app only.
  ...nextForWeb,

  {
    files: ['apps/web/**/*.{js,jsx,mjs,ts,tsx}'],
    rules: {
      // A Pages Router rule. This app is App Router only, and left on it warns
      // on every run that it cannot find a `pages/` directory.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },

  // Prettier owns formatting; this must stay last.
  prettier,
);
