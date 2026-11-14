// ESLint for the whole monorepo (backend + frontend).
//
// The workspaces compile with TypeScript 7, which no longer ships the JS API
// typescript-eslint relies on. The root package pins TypeScript 6.0 purely so
// the linter can read the type information; builds still use each workspace's
// own TypeScript 7.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', 'backend/uploads/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,

  // Type-aware rules (promise handling) for all TypeScript sources.
  {
    files: ['**/*.{ts,tsx,mts}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      // Async handlers in JSX props (onSubmit={handleSubmit}) are a normal React
      // pattern; still flag async callbacks passed where a void return is expected.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      // Duplicates @typescript-eslint/no-unused-vars without honouring the `_` convention.
      'sonarjs/no-unused-vars': 'off',
    },
  },

  // Frontend (React).
  {
    files: ['frontend/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },

  // Tests: supertest's .expect() is the assertion, and fixtures use fake secrets.
  {
    files: ['backend/tests/**/*.ts'],
    rules: {
      'sonarjs/assertions-in-tests': 'off',
      'sonarjs/no-hardcoded-passwords': 'off',
      'sonarjs/insecure-jwt-token': 'off',
      'sonarjs/no-floating-point-equality': 'off',
      'sonarjs/no-alphabetical-sort': 'off',
    },
  },
);
