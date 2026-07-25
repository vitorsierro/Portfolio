// Self-hosted tools that live on the VPS behind the nginx forward-auth check.
// Env-configurable, but defaulted to the production subdomains so the admin
// nav always renders — an unset variable used to make the tools vanish from
// the UI with no hint as to why.
export const TOOLS = [
  {
    key: 'draw',
    name: 'Excalidraw',
    description: 'Quadro branco para diagramas e rascunhos.',
    url: process.env.NEXT_PUBLIC_DRAW_URL || 'https://draw.vitorsierro.com',
  },
  {
    key: 'claw',
    name: 'OpenClaw',
    description: 'Assistente de IA pessoal multi-canal.',
    url: process.env.NEXT_PUBLIC_CLAW_URL || 'https://claw.vitorsierro.com',
  },
];

// Hostnames a post-login redirect is allowed to land on, derived from the
// configured tool URLs. Used to reject open-redirect attempts on ?next=.
export function allowedNextHostnames() {
  return TOOLS.map((tool) => {
    try {
      return new URL(tool.url).hostname;
    } catch {
      return null;
    }
  }).filter(Boolean);
}

// Validates a ?next= value against the allowlist.
//
// Parsing with `new URL(raw, origin)` (rather than string matching) is what
// makes this safe: it normalises the classic bypasses before we compare.
// "//evil.com" resolves to https://evil.com, and
// "https://vitorsierro.com@evil.com" has hostname "evil.com" — both fail the
// allowlist. A `startsWith('https://vitorsierro.com')` check would pass both.
export function safeNextUrl(raw, origin) {
  if (!raw) {
    return null;
  }

  let url;
  try {
    url = new URL(raw, origin);
  } catch {
    return null;
  }

  // Same-origin targets stay relative so client-side navigation works.
  if (url.origin === origin) {
    return `${url.pathname}${url.search}${url.hash}`;
  }

  if (url.protocol !== 'https:') {
    return null;
  }
  if (!allowedNextHostnames().includes(url.hostname)) {
    return null;
  }

  return url.toString();
}
