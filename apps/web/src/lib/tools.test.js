/**
 * Open-redirect protection for the post-login ?next= parameter.
 * nginx puts an attacker-influencable URL in that param, so these cases are
 * the security boundary — not cosmetic validation.
 */
const ORIGIN = 'https://vitorsierro.com';

describe('safeNextUrl', () => {
  let safeNextUrl;

  beforeEach(() => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_DRAW_URL = 'https://draw.vitorsierro.com';
    process.env.NEXT_PUBLIC_HERMES_URL = 'https://chat.vitorsierro.com';
    ({ safeNextUrl } = require('./tools'));
  });

  it('returns null when next is missing', () => {
    expect(safeNextUrl(null, ORIGIN)).toBeNull();
    expect(safeNextUrl('', ORIGIN)).toBeNull();
  });

  it('allows an allowlisted tool subdomain', () => {
    expect(safeNextUrl('https://draw.vitorsierro.com/', ORIGIN)).toBe(
      'https://draw.vitorsierro.com/',
    );
    expect(safeNextUrl('https://chat.vitorsierro.com/', ORIGIN)).toBe(
      'https://chat.vitorsierro.com/',
    );
  });

  it('keeps same-origin targets as relative paths', () => {
    expect(safeNextUrl('/admin/posts/new', ORIGIN)).toBe('/admin/posts/new');
    expect(safeNextUrl(`${ORIGIN}/admin?tab=1`, ORIGIN)).toBe('/admin?tab=1');
  });

  it('rejects a protocol-relative URL pointing off-site', () => {
    // "//evil.com" resolves against the origin to https://evil.com
    expect(safeNextUrl('//evil.com', ORIGIN)).toBeNull();
  });

  it('rejects the userinfo-prefix bypass', () => {
    // hostname here is evil.com, despite the familiar-looking prefix
    expect(
      safeNextUrl('https://vitorsierro.com@evil.com/', ORIGIN),
    ).toBeNull();
  });

  it('rejects a lookalike hostname that merely starts with the domain', () => {
    expect(safeNextUrl('https://vitorsierro.com.evil.com/', ORIGIN)).toBeNull();
  });

  it('rejects a non-allowlisted subdomain', () => {
    expect(safeNextUrl('https://api.vitorsierro.com/', ORIGIN)).toBeNull();
  });

  it('rejects non-https schemes', () => {
    expect(safeNextUrl('http://draw.vitorsierro.com/', ORIGIN)).toBeNull();
    expect(safeNextUrl('javascript:alert(1)', ORIGIN)).toBeNull();
  });

  it('allows http only on loopback, and only if allowlisted', () => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_DRAW_URL = 'http://localhost:8081';
    process.env.NEXT_PUBLIC_HERMES_URL = 'http://localhost:8082';
    const dev = require('./tools');

    expect(dev.safeNextUrl('http://localhost:8081/', ORIGIN)).toBe(
      'http://localhost:8081/',
    );
    // loopback não vira passe livre: o hostname ainda tem de estar na allowlist
    expect(dev.safeNextUrl('http://evil.com/', ORIGIN)).toBeNull();
  });

  it('rejects unparseable input', () => {
    expect(safeNextUrl('http://[bad', ORIGIN)).toBeNull();
  });
});
