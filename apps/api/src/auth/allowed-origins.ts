// Web origins allowed to send credentialed requests, comma-separated.
// Never add draw./chat. tool subdomains or shared *.vercel.app origins here.
export function parseAllowedOrigins(): string[] {
  return (process.env.WEB_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const CONTROLLED_PREVIEW_ORIGIN = 'https://*.preview.vitorsierro.com';
const PREVIEW_HOST_SUFFIX = '.preview.vitorsierro.com';
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function isAllowedOrigin(origin: string): boolean {
  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.includes(origin)) return true;
  if (!allowedOrigins.includes(CONTROLLED_PREVIEW_ORIGIN)) return false;

  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:' || parsed.origin !== origin || parsed.port) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname.endsWith(PREVIEW_HOST_SUFFIX)) return false;

    // Match exactly one branch/deployment label; the stable preview host is
    // allowed separately as an explicit WEB_ORIGIN entry.
    const label = hostname.slice(0, -PREVIEW_HOST_SUFFIX.length);
    return DNS_LABEL.test(label);
  } catch {
    return false;
  }
}
