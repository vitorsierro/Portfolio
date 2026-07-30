import { FlatCompat } from '@eslint/eslintrc';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      'apps/api/prisma/migrations/**',
      'infra/**',
    ],
  },

  // Next.js: core-web-vitals inclui as regras que afetam LCP/CLS.
  ...compat
    .extends('next/core-web-vitals')
    .map((config) => ({ ...config, files: ['apps/web/**/*.{js,jsx}'] })),

  {
    files: ['apps/web/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, React: 'readonly' },
    },
    rules: {
      // O CMS usa <a> em rotas do admin de propósito: um reload completo
      // garante estado limpo entre telas de edição. Não é rota pública, então
      // o custo de navegação não afeta métrica de usuário.
      '@next/next/no-html-link-for-pages': 'off',

      // Pega variável usada sem existir — em JS isso só estoura em runtime,
      // quando alguém clica no botão. Foi exatamente assim que um
      // `VAZIO_RESTAURANTE` renomeado passou despercebido até a tela quebrar.
      // (No lado TS o compilador já cobre isso.)
      'no-undef': 'error',

      // O outro lado da moeda: import que sobrou depois de a chamada sumir.
      // Isolado é só ruído, mas costuma ser o rastro de uma função que
      // deixou de ser chamada sem que ninguém percebesse.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // Arquivos de teste rodam no Jest, que injeta describe/it/expect no escopo
  // global. Sem declarar isso, o no-undef marcaria toda a suíte como erro.
  {
    files: [
      'apps/web/**/*.test.{js,jsx}',
      'apps/web/**/__tests__/**/*.{js,jsx}',
      'apps/web/jest.setup.js',
    ],
    languageOptions: { globals: globals.jest },
  },

  // Specs e2e rodam no Cypress/Mocha, que injeta cy/Cypress/describe/it no
  // escopo global — não vem do pacote `globals`, então declara na mão.
  {
    files: ['apps/web/cypress/**/*.js', 'apps/web/cypress.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        cy: 'readonly',
        Cypress: 'readonly',
        describe: 'readonly',
        context: 'readonly',
        it: 'readonly',
        specify: 'readonly',
        before: 'readonly',
        beforeEach: 'readonly',
        after: 'readonly',
        afterEach: 'readonly',
        expect: 'readonly',
      },
    },
  },

  // API: Node puro, sem React. Precisa do parser TS — sem ele os decorators
  // do NestJS (@Controller, @Get) quebram a análise.
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['apps/api/**/*.ts'],
  })),

  {
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // Os DTOs declaram propriedades sem inicializar de propósito: quem
      // preenche é o ValidationPipe a partir do corpo da requisição.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
