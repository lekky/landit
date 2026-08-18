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
      // Any local PocketBase database, not only the two the repo's own scripts
      // make: `.pb_data` (pnpm pb:dev), `.pb_e2e` (playwright.config.ts), and
      // whatever a parallel session picks so it does not share a port with a
      // sibling. PocketBase writes a 24,000-line generated `types.d.ts` into
      // each one, and naming them individually meant `pnpm lint` failing with
      // 693 errors in a directory nobody wrote (T12).
      'pocketbase/.pb_*/**',
      // MapLibre's worker and the module it imports, copied in by
      // `apps/web/scripts/sync-maplibre-worker.mjs` on every dev and build.
      // Vendor code, minified to one 482KB line — linting it means 1,127
      // errors in a file nobody wrote (2026-08-17).
      'apps/web/public/maplibre/**',
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

  /**
   * `pocketbase/migrations` and `pocketbase/hooks` are not our runtime: they are
   * executed by PocketBase's embedded JS engine (goja), which supplies its own
   * globals and its own CommonJS `require`. They are plain `.js` on purpose —
   * the engine does not run TypeScript — so the globals are declared here rather
   * than pretending the files are Node.
   */
  {
    files: ['pocketbase/{migrations,hooks}/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.commonjs,
        console: 'readonly',
        __hooks: 'readonly',
        $app: 'readonly',
        $apis: 'readonly',
        $os: 'readonly',
        $security: 'readonly',
        migrate: 'readonly',
        routerAdd: 'readonly',
        Collection: 'readonly',
        Record: 'readonly',
        DateTime: 'readonly',
        DynamicModel: 'readonly',
        MailerMessage: 'readonly',
        // `ApiError` carries a status the named classes do not cover — 429, for
        // the spot-submission rate limit (T13).
        ApiError: 'readonly',
        BadRequestError: 'readonly',
        ForbiddenError: 'readonly',
        NotFoundError: 'readonly',
        AutodateField: 'readonly',
        BoolField: 'readonly',
        DateField: 'readonly',
        EditorField: 'readonly',
        EmailField: 'readonly',
        FileField: 'readonly',
        JSONField: 'readonly',
        NumberField: 'readonly',
        RelationField: 'readonly',
        SelectField: 'readonly',
        TextField: 'readonly',
        onRecordCreate: 'readonly',
        onRecordUpdate: 'readonly',
        onRecordDelete: 'readonly',
        onRecordCreateRequest: 'readonly',
        onRecordUpdateRequest: 'readonly',
        onRecordDeleteRequest: 'readonly',
        onRecordAuthRequest: 'readonly',
        onRecordAfterCreateSuccess: 'readonly',
        onRecordAfterUpdateSuccess: 'readonly',
        onRecordAfterDeleteSuccess: 'readonly',
      },
    },
    rules: {
      // goja is CommonJS-only, and PocketBase's own type declarations are
      // consumed through a triple-slash reference. Both are how these files are
      // supposed to look; neither is a lapse to be fixed.
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
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
