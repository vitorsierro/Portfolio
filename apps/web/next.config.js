/** @type {import('next').NextConfig} */

// The tools live on their own subdomains (they break when served from a
// subpath, and /admin already belongs to the Next.js CMS routes). These
// redirects keep the /admin/<tool> URLs the user expects as entry points.
const TOOL_REDIRECTS = [
  { source: '/admin/draw', env: process.env.NEXT_PUBLIC_DRAW_URL },
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
