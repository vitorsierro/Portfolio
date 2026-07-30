/** @type {import('next').NextConfig} */

// /admin/draw NÃO entra aqui: virou uma página real que embute o Excalidraw
// num iframe, para manter o header do admin visível. Um redirect teria
// precedência sobre a página e a tornaria inalcançável.
//
// /admin/hermes é redirect, e não página com iframe: o comportamento do
// dashboard do Hermes quanto a `X-Frame-Options` não foi verificado, e afrouxar
// embed no proxy é o tipo de coisa que não se faz às cegas numa ferramenta que
// executa comandos. O redirect funciona de todo jeito.
const TOOL_REDIRECTS = [
  { source: '/admin/hermes', env: process.env.NEXT_PUBLIC_HERMES_URL },
];

const nextConfig = {
  async redirects() {
    return TOOL_REDIRECTS.filter((tool) => tool.env).map((tool) => ({
      source: tool.source,
      destination: tool.env,
      permanent: false,
    }));
  },
};

module.exports = nextConfig;
