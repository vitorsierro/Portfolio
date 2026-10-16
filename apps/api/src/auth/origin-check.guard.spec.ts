import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { OriginCheckGuard } from './origin-check.guard';

function contextWith(origin: string | undefined): ExecutionContext {
  const req = { headers: origin ? { origin } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('OriginCheckGuard', () => {
  const guard = new OriginCheckGuard();
  const originalWebOrigin = process.env.WEB_ORIGIN;

  beforeEach(() => {
    process.env.WEB_ORIGIN =
      'https://vitorsierro.com,https://www.vitorsierro.com';
  });

  afterAll(() => {
    process.env.WEB_ORIGIN = originalWebOrigin;
  });

  it('allows a request with no Origin header (non-browser client)', () => {
    expect(guard.canActivate(contextWith(undefined))).toBe(true);
  });

  it('allows an origin in the allowlist', () => {
    expect(guard.canActivate(contextWith('https://vitorsierro.com'))).toBe(
      true,
    );
    expect(
      guard.canActivate(contextWith('https://www.vitorsierro.com')),
    ).toBe(true);
  });

  it('allows the stable preview host and its controlled branch aliases', () => {
    process.env.WEB_ORIGIN =
      'https://vitorsierro.com,https://preview.vitorsierro.com,https://*.preview.vitorsierro.com';

    expect(
      guard.canActivate(contextWith('https://preview.vitorsierro.com')),
    ).toBe(true);
    expect(
      guard.canActivate(contextWith('https://pr-123.preview.vitorsierro.com')),
    ).toBe(true);
  });

  it('does not trust shared Vercel origins or preview-domain lookalikes', () => {
    process.env.WEB_ORIGIN =
      'https://vitorsierro.com,https://preview.vitorsierro.com,https://*.preview.vitorsierro.com';

    for (const origin of [
      'https://vitorsierro-b0eaqq703-vitor-hugo-de-souza-sierros-projects.vercel.app',
      'https://preview.vitorsierro.com.evil.com',
      'https://pr-123.preview.vitorsierro.com.evil.com',
      'http://pr-123.preview.vitorsierro.com',
      'https://pr-123.preview.vitorsierro.com:8443',
    ]) {
      expect(() => guard.canActivate(contextWith(origin))).toThrow(
        ForbiddenException,
      );
    }
  });

  it('rejects an origin outside the allowlist, e.g. a tool subdomain', () => {
    expect(() =>
      guard.canActivate(contextWith('https://draw.vitorsierro.com')),
    ).toThrow(ForbiddenException);
  });

  it('rejects an unrelated origin', () => {
    expect(() => guard.canActivate(contextWith('https://evil.com'))).toThrow(
      ForbiddenException,
    );
  });
});
