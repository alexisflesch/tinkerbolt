import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

type ProjectLayer =
  | 'app'
  | 'application'
  | 'domain'
  | 'infrastructure'
  | 'presentation'
  | 'simulation'
  | 'ui';

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Matches a layer segment in a project-relative path or a conventional source
 * alias, while leaving bare package names to the package resolver.
 */
const layerImportPattern = (layers: readonly ProjectLayer[]): string => {
  const names = layers.map(escapeRegExp).join('|');

  return String.raw`^(?:(?:(?:\.\.?/)+|(?:@|~|#)/|src/)(?:[^/]+/)*(?:${names})(?:/|$)|(?:@|~|#)(?:${names})(?:/|$))`;
};

interface ConcreteDependencyRestrictions {
  readonly paths?: readonly { readonly name: string; readonly message: string }[];
  readonly patterns?: readonly { readonly group: readonly string[]; readonly message: string }[];
}

/**
 * Forbids importing packages that would let the domain depend on a concrete
 * DOM, rendering, physics or storage implementation (AGENTS.md, invariants
 * d'architecture). Kept separate from `boundaryConfig` so both restrictions
 * can be merged into a single `no-restricted-imports` config: ESLint does not
 * merge two configs for the same rule on the same files, the last one wins.
 */
const domainForbiddenConcreteDependencies: ConcreteDependencyRestrictions = {
  paths: [
    {
      name: 'react',
      message:
        "Le domaine ne peut pas dependre de React. Voir AGENTS.md, invariants d'architecture.",
    },
    {
      name: 'react-dom',
      message:
        "Le domaine ne peut pas dependre du DOM (react-dom). Voir AGENTS.md, invariants d'architecture.",
    },
    {
      name: 'pixi.js',
      message:
        "Le domaine ne peut pas dependre de PixiJS. Voir AGENTS.md, invariants d'architecture.",
    },
    {
      name: 'planck',
      message:
        "Le domaine ne peut pas dependre d'un moteur physique concret (planck). Voir AGENTS.md, invariants d'architecture.",
    },
    {
      name: 'planck-js',
      message:
        "Le domaine ne peut pas dependre d'un moteur physique concret (planck-js). Voir AGENTS.md, invariants d'architecture.",
    },
    {
      name: 'idb',
      message:
        "Le domaine ne peut pas dependre d'IndexedDB (idb). Voir AGENTS.md, invariants d'architecture.",
    },
  ],
  patterns: [
    {
      group: ['@dimforge/*'],
      message:
        "Le domaine ne peut pas dependre d'un moteur physique concret (@dimforge/*). Voir AGENTS.md, invariants d'architecture.",
    },
  ],
};

const boundaryConfig = (
  layer: ProjectLayer,
  forbiddenLayers: readonly ProjectLayer[],
  extraRestrictions: ConcreteDependencyRestrictions = {},
) => ({
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: extraRestrictions.paths ?? [],
        patterns: [
          {
            regex: layerImportPattern(forbiddenLayers),
            message: `La couche ${layer} ne peut pas importer : ${forbiddenLayers.join(', ')}.`,
          },
          ...(extraRestrictions.patterns ?? []),
        ],
      },
    ],
  },
});

export default defineConfig(
  {
    ignores: [
      'dist/**',
      '.claude/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'node_modules/**',
      'pnpm-lock.yaml',
      'tmp/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importX,
      // The plugin publishes no type declaration for its flat-config shape.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      'import-x/resolver-next': [importX.createNodeResolver()],
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'import-x/first': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/no-cycle': ['error', { maxDepth: '∞' }],
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/heading-has-content': 'error',
      'jsx-a11y/no-autofocus': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-refresh/only-export-components': 'error',
    },
  },
  boundaryConfig(
    'domain',
    ['app', 'application', 'infrastructure', 'presentation', 'simulation', 'ui'],
    domainForbiddenConcreteDependencies,
  ),
  boundaryConfig('application', ['app', 'infrastructure', 'presentation', 'simulation', 'ui']),
  boundaryConfig('simulation', ['app', 'application', 'infrastructure', 'presentation', 'ui']),
  boundaryConfig('infrastructure', ['app', 'presentation', 'simulation', 'ui']),
  {
    // Le domaine ne depend ni du DOM ni d'IndexedDB (AGENTS.md, invariants
    // d'architecture). `document` est volontairement absent de cette liste :
    // src/domain/level-document.ts a des parametres nommes `document` et un
    // faux positif serait trompeur.
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message:
            "Le domaine ne peut pas acceder a 'window'. Voir AGENTS.md, invariants d'architecture.",
        },
        {
          name: 'localStorage',
          message:
            "Le domaine ne peut pas acceder a 'localStorage'. Voir AGENTS.md, invariants d'architecture.",
        },
        {
          name: 'indexedDB',
          message:
            "Le domaine ne peut pas acceder a 'indexedDB'. Voir AGENTS.md, invariants d'architecture.",
        },
      ],
    },
  },
  {
    // La simulation utilise un pas de temps fixe : l'horloge et l'aleatoire
    // sont injectes, jamais lus directement (AGENTS.md, invariants
    // d'architecture). src/simulation n'existe pas encore ; cette regle
    // attend la couche.
    files: ['src/domain/**/*.{ts,tsx}', 'src/simulation/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message:
            "Ne pas lire Date.now() : injecter l'horloge. Voir AGENTS.md, invariants d'architecture.",
        },
        {
          object: 'performance',
          property: 'now',
          message:
            "Ne pas lire performance.now() : injecter l'horloge. Voir AGENTS.md, invariants d'architecture.",
        },
        {
          object: 'Math',
          property: 'random',
          message:
            "Ne pas utiliser Math.random() : injecter la graine aleatoire. Voir AGENTS.md, invariants d'architecture.",
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'import-x/no-cycle': 'off',
    },
  },
);
