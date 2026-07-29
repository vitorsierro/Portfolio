const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Access token kept only in memory (lost on reload — rehydrated via the
// httpOnly refresh cookie by calling refresh()).
let accessToken = null;

export function getAccessToken() {
  return accessToken;
}

export async function login(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401 ? 'Credenciais invalidas' : `Erro ${response.status}`,
    );
  }

  const data = await response.json();
  accessToken = data.accessToken;
  return data;
}

// Dedupes concurrent refreshes so React StrictMode (double-invoked effects) or
// several 401s at once can't rotate the refresh token against a stale cookie.
let refreshPromise = null;

// Exchanges the refresh cookie for a fresh access token. Returns false when
// the session is gone (no/invalid cookie).
export async function refresh() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        accessToken = null;
        return false;
      }

      const data = await response.json();
      accessToken = data.accessToken;
      return true;
    } catch {
      accessToken = null;
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// Rehydrates the in-memory access token after a cold load (full page reload).
// On client-side navigation the token is still in memory, so no rotation
// happens. Returns true when a usable session exists.
export async function ensureSession() {
  try {
    if (accessToken) {
      return true;
    }
    return await refresh();
  } catch {
    return false;
  }
}

export async function logout() {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } finally {
    accessToken = null;
  }
}

// fetch wrapper that attaches the bearer token and transparently refreshes
// once on a 401.
export async function authFetch(path, options = {}, allowRetry = true) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.headers || {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  if (response.status === 401 && allowRetry) {
    const refreshed = await refresh();
    if (refreshed) {
      return authFetch(path, options, false);
    }
  }

  return response;
}
