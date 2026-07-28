import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

/**
 * Um config na raiz cobrindo os dois workspaces. A API é NestJS (Node, TS) e
 * o web é Next.js — regras de React só fazem sentido no segundo, daí o
 * escopo por caminho.
 */
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
    rules: {
      // O CMS usa <a> em rotas do admin de propósito: um reload completo
      // garante estado limpo entre telas de edição. Não é rota pública, então
      // o custo de navegação não afeta métrica de usuário.
      '@next/next/no-html-link-for-pages': 'off',
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
