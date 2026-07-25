/** @type {import('next').NextConfig} */

// /admin/draw NÃO entra aqui: virou uma página real que embute o Excalidraw
// num iframe, para manter o header do admin visível. Um redirect teria
// precedência sobre a página e a tornaria inalcançável.
//
// /admin/claw continua como redirect porque o OpenClaw manda
// `X-Frame-Options: DENY` — ele não pode ser embutido, e essa proteção
// anti-clickjacking existe por um bom motivo numa ferramenta que executa
// comandos.
const TOOL_REDIRECTS = [
  { source: '/admin/claw', env: process.env.NEXT_PUBLIC_CLAW_URL },
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
