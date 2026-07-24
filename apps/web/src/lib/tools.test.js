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
    process.env.NEXT_PUBLIC_CLAW_URL = 'https://claw.vitorsierro.com';
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
    expect(safeNextUrl('https://claw.vitorsierro.com/chat', ORIGIN)).toBe(
      'https://claw.vitorsierro.com/chat',
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

  it('rejects unparseable input', () => {
    expect(safeNextUrl('http://[bad', ORIGIN)).toBeNull();
  });
});
