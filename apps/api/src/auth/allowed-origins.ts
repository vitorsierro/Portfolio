// Web origins allowed to send credentialed requests: the Next.js site
// (apex + www), comma-separated. Never add the draw./claw. tool subdomains
// here — see OriginCheckGuard for why they must stay out of this list.
export function parseAllowedOrigins(): string[] {
  return (process.env.WEB_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
